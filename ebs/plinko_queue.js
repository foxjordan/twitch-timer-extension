// Per-channel Plinko drop queue.
//
// A designated sound alert can auto-drop a token, and a burst of redemptions
// must not clobber each other on the overlay (which ignores any drop that
// arrives mid-animation). Drops are queued per channel and played one at a
// time — each occupies its animation length plus a small gap — so every
// redeemer sees their token land and gets their bonus.
//
// State is in-memory; a process restart loses un-played drops (those redeemers
// still got the sound + their Bits time, only the Plinko bonus is forfeited).
// No per-drop timers beyond the single "next drain" timeout that's live while a
// channel is draining.

export const DEFAULT_MAX_QUEUE = 500; // huge headroom; streamers gate via Bit price
export const DEFAULT_TTL_MS = 30 * 60 * 1000; // a drop that has waited this long is skipped when its turn comes
export const DEFAULT_GAP_MS = 400; // breather between tokens

export function createPlinkoQueue({
  maxSize = DEFAULT_MAX_QUEUE,
  ttlMs = DEFAULT_TTL_MS,
  gapMs = DEFAULT_GAP_MS,
  now = () => Date.now(),
  schedule = (fn, ms) => setTimeout(fn, ms),
  play = () => {},
  onChange = () => {},
} = {}) {
  const queues = new Map(); // channelId -> { items: [], playing: item|null, draining: bool }

  function enqueue(channelId, item) {
    const cid = String(channelId);
    let q = queues.get(cid);
    if (!q) {
      q = { items: [], playing: null, draining: false, advanceSeq: 0 };
      queues.set(cid, q);
    }
    if (q.items.length >= maxSize) {
      return { accepted: false, reason: 'full' };
    }
    q.items.push({ ...item, enqueuedAt: now(), expiresAt: now() + ttlMs });
    onChange(cid);
    if (!q.draining) drain(cid);
    // Read after drain() runs — mirrors how `waiting` below is already
    // computed post-drain, so an item that starts playing immediately (an
    // idle queue) is correctly reported as position 0, not 1: drain() will
    // have already shifted it out of q.items and into q.playing by now.
    const waiting = q.items.length;
    const position = (q.playing ? 1 : 0) + (waiting - 1);
    return { accepted: true, waiting, position, advanceSeq: q.advanceSeq };
  }

  function drain(cid) {
    const q = queues.get(cid);
    if (!q) return;

    let item = null;
    while (q.items.length) {
      const candidate = q.items.shift();
      // One shift = one "someone ahead of you cleared" event, whether the
      // item goes on to play or gets discarded as stale below.
      q.advanceSeq++;
      if (candidate.expiresAt && candidate.expiresAt <= now()) {
        onChange(cid); // a stale drop was dropped
        continue;
      }
      item = candidate;
      break;
    }

    if (!item) {
      q.draining = false;
      q.playing = null;
      queues.delete(cid);
      onChange(cid);
      return;
    }

    q.draining = true;
    q.playing = item;
    onChange(cid);
    try {
      play(item);
    } catch {
      // one bad drop must not stall the queue
    }
    const holdMs = Math.max(0, Number(item.durationMs) || 0) + gapMs;
    schedule(() => {
      const qq = queues.get(cid);
      if (qq) qq.playing = null;
      drain(cid);
    }, holdMs);
  }

  function pub(item) {
    return { viewerName: item.viewerName || 'Someone', source: item.source || 'manual' };
  }

  function snapshot(channelId) {
    const q = queues.get(String(channelId));
    if (!q) return { nowPlaying: null, waiting: [], waitingCount: 0, advanceSeq: 0 };
    return {
      nowPlaying: q.playing ? pub(q.playing) : null,
      waiting: q.items.slice(0, 50).map(pub),
      waitingCount: q.items.length,
      advanceSeq: q.advanceSeq,
    };
  }

  function size(channelId) {
    const q = queues.get(String(channelId));
    return q ? q.items.length + (q.playing ? 1 : 0) : 0;
  }

  return { enqueue, snapshot, size };
}
