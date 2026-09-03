import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createSubDedup } from './sub_dedup.js';

const SUBSCRIBE = 'channel.subscribe';
const MESSAGE = 'channel.subscription.message';
const MIN = 60 * 1000;

test('a silent new sub (only channel.subscribe) counts', () => {
  const d = createSubDedup();
  const v = d.evaluate({ broadcaster: 'b1', userId: 'alice', subType: SUBSCRIBE, now: 0 });
  assert.equal(v.deduped, false);
});

test('a resub that fires BOTH events counts once (subscribe then message)', () => {
  const d = createSubDedup();
  assert.equal(d.evaluate({ broadcaster: 'b1', userId: 'wild', subType: SUBSCRIBE, now: 0 }).deduped, false);
  assert.equal(d.evaluate({ broadcaster: 'b1', userId: 'wild', subType: MESSAGE, now: 13 * 1000 }).deduped, true);
});

test('...and the same when Twitch delivers the message first', () => {
  const d = createSubDedup();
  assert.equal(d.evaluate({ broadcaster: 'b1', userId: 'wild', subType: MESSAGE, now: 0 }).deduped, false);
  assert.equal(d.evaluate({ broadcaster: 'b1', userId: 'wild', subType: SUBSCRIBE, now: 5 * 1000 }).deduped, true);
});

test('the paired event is still deduped two minutes later (the reported failure)', () => {
  const d = createSubDedup();
  d.evaluate({ broadcaster: 'b1', userId: 'arson', subType: SUBSCRIBE, now: 0 });
  assert.equal(d.evaluate({ broadcaster: 'b1', userId: 'arson', subType: MESSAGE, now: 2 * MIN }).deduped, true);
});

test('the dedup window is bounded — a paired event past the TTL is treated as new', () => {
  const d = createSubDedup({ ttlMs: 30 * MIN });
  d.evaluate({ broadcaster: 'b1', userId: 'arson', subType: SUBSCRIBE, now: 0 });
  assert.equal(d.evaluate({ broadcaster: 'b1', userId: 'arson', subType: MESSAGE, now: 29 * MIN }).deduped, true);
  // fresh instance: 31 min gap is outside the guard
  const d2 = createSubDedup({ ttlMs: 30 * MIN });
  d2.evaluate({ broadcaster: 'b1', userId: 'arson', subType: SUBSCRIBE, now: 0 });
  assert.equal(d2.evaluate({ broadcaster: 'b1', userId: 'arson', subType: MESSAGE, now: 31 * MIN }).deduped, false);
});

test('a duplicate channel.subscribe delivery (reconnect / Twitch double-fire) is absorbed', () => {
  const d = createSubDedup();
  assert.equal(d.evaluate({ broadcaster: 'b1', userId: 'arson', subType: SUBSCRIBE, now: 0 }).deduped, false);
  assert.equal(d.evaluate({ broadcaster: 'b1', userId: 'arson', subType: SUBSCRIBE, now: 25 * 1000 }).deduped, true);
});

test('a gift recipient adds nothing itself and their later "thanks" message is absorbed', () => {
  const d = createSubDedup();
  // gift recipient's channel.subscribe (is_gift) — not a dedup, just recorded
  assert.equal(d.evaluate({ broadcaster: 'b1', userId: 'gifted', subType: SUBSCRIBE, isGift: true, now: 0 }).deduped, false);
  // their resub message a couple minutes later must not add a second sub
  assert.equal(d.evaluate({ broadcaster: 'b1', userId: 'gifted', subType: MESSAGE, now: 2 * MIN }).deduped, true);
});

test('a gift recipient who buys their own sub well after the gift is still counted', () => {
  const d = createSubDedup({ giftTtlMs: 5 * MIN });
  d.evaluate({ broadcaster: 'b1', userId: 'gifted', subType: SUBSCRIBE, isGift: true, now: 0 });
  // real self-sub 10 min later — the short gift guard has expired
  assert.equal(d.evaluate({ broadcaster: 'b1', userId: 'gifted', subType: MESSAGE, now: 10 * MIN }).deduped, false);
});

test('different subscribers never interfere', () => {
  const d = createSubDedup();
  assert.equal(d.evaluate({ broadcaster: 'b1', userId: 'alice', subType: SUBSCRIBE, now: 0 }).deduped, false);
  assert.equal(d.evaluate({ broadcaster: 'b1', userId: 'bob', subType: SUBSCRIBE, now: 1000 }).deduped, false);
  // same user id on a different channel is also independent
  assert.equal(d.evaluate({ broadcaster: 'b2', userId: 'alice', subType: SUBSCRIBE, now: 2000 }).deduped, false);
});

test('non-subscribe event types are never deduped', () => {
  const d = createSubDedup();
  assert.equal(d.evaluate({ broadcaster: 'b1', userId: 'x', subType: 'channel.cheer', now: 0 }).deduped, false);
  assert.equal(d.evaluate({ broadcaster: 'b1', userId: 'x', subType: 'channel.cheer', now: 1000 }).deduped, false);
  assert.equal(d.evaluate({ broadcaster: 'b1', userId: 'x', subType: 'channel.subscription.gift', now: 2000 }).deduped, false);
});

test('an event with no usable user id falls through to counting', () => {
  const d = createSubDedup();
  assert.equal(d.evaluate({ broadcaster: 'b1', userId: '', subType: SUBSCRIBE, now: 0 }).deduped, false);
  assert.equal(d.evaluate({ broadcaster: 'b1', userId: '', subType: SUBSCRIBE, now: 1000 }).deduped, false);
});

test('sweep drops expired entries and keeps live ones', () => {
  const d = createSubDedup({ ttlMs: 10 * MIN });
  d.evaluate({ broadcaster: 'b1', userId: 'old', subType: SUBSCRIBE, now: 0 });
  d.evaluate({ broadcaster: 'b1', userId: 'new', subType: SUBSCRIBE, now: 9 * MIN });
  assert.equal(d.size, 2);
  d.sweep(11 * MIN); // 'old' expired at 10min, 'new' expires at 19min
  assert.equal(d.size, 1);
  assert.equal(d.evaluate({ broadcaster: 'b1', userId: 'new', subType: MESSAGE, now: 11 * MIN }).deduped, true);
});
