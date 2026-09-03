import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createPlinkoQueue } from './plinko_queue.js';

// Test harness: a manual clock + a scheduler that just collects callbacks so a
// flush() drains the whole queue synchronously.
function harness(opts = {}) {
  let clock = 0;
  const pending = []; // { fn, at }
  const played = [];
  const changes = [];
  const q = createPlinkoQueue({
    now: () => clock,
    schedule: (fn, ms) => pending.push({ fn, at: clock + ms }),
    play: (item) => played.push(item),
    onChange: (cid) => changes.push(cid),
    ...opts,
  });
  return {
    q,
    played,
    changes,
    advance: (ms) => { clock += ms; },
    flush: () => {
      // run due callbacks repeatedly (draining schedules the next drain)
      let guard = 0;
      while (pending.some((p) => p.at <= clock) && guard++ < 10000) {
        const i = pending.findIndex((p) => p.at <= clock);
        const [p] = pending.splice(i, 1);
        p.fn();
      }
    },
    runAll: () => {
      let guard = 0;
      while (pending.length && guard++ < 100000) {
        const [p] = pending.splice(0, 1);
        clock = Math.max(clock, p.at);
        p.fn();
      }
    },
    get clock() { return clock; },
  };
}

const item = (name, durationMs = 5000) => ({ viewerName: name, durationMs, source: 'sound_alert' });

test('plays queued drops in FIFO order', () => {
  const h = harness();
  h.q.enqueue('ch1', item('alice'));
  h.q.enqueue('ch1', item('bob'));
  h.q.enqueue('ch1', item('carol'));
  h.runAll();
  assert.deepEqual(h.played.map((i) => i.viewerName), ['alice', 'bob', 'carol']);
});

test('the first drop plays immediately; the rest wait their turn', () => {
  const h = harness();
  h.q.enqueue('ch1', item('alice'));
  h.q.enqueue('ch1', item('bob'));
  assert.deepEqual(h.played.map((i) => i.viewerName), ['alice']); // bob still waiting
  h.runAll();
  assert.deepEqual(h.played.map((i) => i.viewerName), ['alice', 'bob']);
});

test('rejects drops past maxSize', () => {
  const h = harness({ maxSize: 3 });
  assert.equal(h.q.enqueue('ch1', item('a')).accepted, true); // this one starts playing
  assert.equal(h.q.enqueue('ch1', item('b')).accepted, true);
  assert.equal(h.q.enqueue('ch1', item('c')).accepted, true);
  assert.equal(h.q.enqueue('ch1', item('d')).accepted, true); // 3 waiting now
  const rejected = h.q.enqueue('ch1', item('e'));
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.reason, 'full');
});

test('skips drops that expired while waiting', () => {
  const h = harness({ ttlMs: 10 * 60 * 1000 });
  h.q.enqueue('ch1', item('playing'));      // starts immediately
  h.q.enqueue('ch1', item('stale'));        // waits
  h.q.enqueue('ch1', item('fresh'));        // waits
  h.advance(11 * 60 * 1000);                // 'stale' and 'fresh' both age out... enqueue a truly fresh one
  h.q.enqueue('ch1', item('reallyFresh'));
  h.runAll();
  const names = h.played.map((i) => i.viewerName);
  assert.ok(names.includes('playing'));
  assert.ok(names.includes('reallyFresh'));
  assert.ok(!names.includes('stale'));
  assert.ok(!names.includes('fresh'));
});

test('snapshot shows who is dropping and who is waiting', () => {
  const h = harness();
  h.q.enqueue('ch1', item('alice'));
  h.q.enqueue('ch1', item('bob'));
  h.q.enqueue('ch1', item('carol'));
  const s = h.q.snapshot('ch1');
  assert.equal(s.nowPlaying.viewerName, 'alice');
  assert.deepEqual(s.waiting.map((i) => i.viewerName), ['bob', 'carol']);
  assert.equal(s.waitingCount, 2);
});

test('snapshot is empty once the queue drains', () => {
  const h = harness();
  h.q.enqueue('ch1', item('alice'));
  h.runAll();
  assert.deepEqual(h.q.snapshot('ch1'), { nowPlaying: null, waiting: [], waitingCount: 0 });
  assert.equal(h.q.size('ch1'), 0);
});

test('channels drain independently', () => {
  const h = harness();
  h.q.enqueue('chA', item('a1'));
  h.q.enqueue('chA', item('a2'));
  h.q.enqueue('chB', item('b1'));
  assert.equal(h.q.snapshot('chA').nowPlaying.viewerName, 'a1');
  assert.equal(h.q.snapshot('chB').nowPlaying.viewerName, 'b1');
  h.runAll();
  assert.deepEqual(h.played.map((i) => i.viewerName).sort(), ['a1', 'a2', 'b1']);
});

test('each drop holds the queue for durationMs + gapMs', () => {
  let scheduledMs = null;
  const h = harness({
    gapMs: 400,
    schedule: (fn, ms) => { scheduledMs = ms; },
  });
  h.q.enqueue('ch1', item('alice', 5000));
  assert.equal(scheduledMs, 5400);
});

test('onChange fires on enqueue and when a drop finishes', () => {
  const h = harness();
  h.q.enqueue('ch1', item('alice'));
  h.q.enqueue('ch1', item('bob'));
  const afterEnqueue = h.changes.length;
  assert.ok(afterEnqueue >= 2);
  h.runAll();
  assert.ok(h.changes.length > afterEnqueue); // more changes as drops play/finish
});
