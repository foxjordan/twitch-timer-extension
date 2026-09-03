// Subscription dedup.
//
// Twitch's EventSub fires BOTH channel.subscribe AND channel.subscription.message
// for many resubs — especially Prime resubs, which the viewer re-ups manually
// every month — contradicting its own docs ("channel.subscribe does not include
// resubscribes"). It also occasionally double-delivers channel.subscribe on a
// WebSocket reconnect with a fresh message_id, which the message_id dedupe
// (state.seen) can't catch. Both cause the subathon timer to count one
// subscription twice.
//
// This guards on subscriber identity: once a sub-ish event has been counted for
// a given ${broadcaster}:${userId}, any further channel.subscribe /
// channel.subscription.message for that user inside the TTL is a duplicate of
// the same subscription and must not add time again. A person cannot
// legitimately subscribe twice within the TTL, so this never eats a real resub.
//
// Plain Map<key, expiryEpochMs>, checked lazily on read and swept periodically —
// no per-subscriber timers.

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 min — huge margin over observed delivery skew (~2 min)
const DEFAULT_GIFT_TTL_MS = 5 * 60 * 1000; // gift recipients: just long enough to absorb a "thanks!" message

export function createSubDedup({ ttlMs = DEFAULT_TTL_MS, giftTtlMs = DEFAULT_GIFT_TTL_MS } = {}) {
  const seen = new Map(); // `${broadcaster}:${userId}` -> expiryEpochMs

  /**
   * @param {{ broadcaster:string, userId:string, subType:string, isGift?:boolean, now?:number }} evt
   * @returns {{ deduped: boolean }} deduped:true => this event is a duplicate of
   *   an already-counted subscription; skip it (and log a sub_deduped line).
   */
  function evaluate({ broadcaster, userId, subType, isGift = false, now = Date.now() }) {
    if (subType !== 'channel.subscribe' && subType !== 'channel.subscription.message') {
      return { deduped: false };
    }
    const id = userId ? String(userId) : '';
    if (!broadcaster || !id) return { deduped: false }; // nothing to key on — count it

    const key = `${broadcaster}:${id}`;
    const prev = seen.get(key);
    const active = typeof prev === 'number' && prev > now;

    // (Re)arm the guard for this subscriber. Gift recipients get a short guard:
    // it only needs to swallow their immediate "thanks for the gift" resub
    // message, not a real sub they might buy for themselves later in the stream.
    seen.set(key, now + (isGift ? giftTtlMs : ttlMs));

    // A gift recipient's own channel.subscribe adds no time (secondsFromEvent
    // returns 0 for is_gift); recording it above is all we need.
    if (isGift) return { deduped: false };

    return { deduped: active };
  }

  function sweep(now = Date.now()) {
    for (const [k, exp] of seen) if (exp <= now) seen.delete(k);
  }

  return {
    evaluate,
    sweep,
    get size() {
      return seen.size;
    },
  };
}
