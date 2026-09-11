import { test } from "node:test";
import assert from "node:assert/strict";

import { state, removeSeconds, getRemainingSeconds } from "./state.js";

// Directly seed state.users (exported) to get deterministic starting
// conditions instead of racing the wall clock through addSeconds.
function seedUser(uid, overrides = {}) {
  state.users.set(uid, {
    timerExpiryEpochMs: 0,
    hypeActive: false,
    bonusActive: false,
    bonusStartEpochMs: 0,
    bonusEndEpochMs: 0,
    paused: false,
    pauseRemaining: 0,
    initialSeconds: 0,
    additionsTotal: 0,
    maxTotalSeconds: 0,
    bitsCarry: 0,
    capForcedOn: false,
    ...overrides,
  });
}

test("removeSeconds subtracts from a paused timer's pauseRemaining", () => {
  const uid = "paused-basic";
  seedUser(uid, { paused: true, pauseRemaining: 120 });
  const remaining = removeSeconds(uid, 50);
  assert.equal(remaining, 70);
  assert.equal(getRemainingSeconds(uid), 70);
});

test("removeSeconds floors a paused timer at 0 rather than going negative", () => {
  const uid = "paused-floor";
  seedUser(uid, { paused: true, pauseRemaining: 20 });
  assert.equal(removeSeconds(uid, 50), 0);
});

test("removeSeconds floors a running timer at 'now' rather than going negative", () => {
  const uid = "running-floor";
  seedUser(uid, { timerExpiryEpochMs: Date.now() + 5000 }); // ~5s left
  assert.equal(removeSeconds(uid, 50), 0);
});

test("removeSeconds subtracts from a running timer's expiry", () => {
  const uid = "running-basic";
  seedUser(uid, { timerExpiryEpochMs: Date.now() + 100_000 }); // ~100s left
  const remaining = removeSeconds(uid, 30);
  // wall-clock based; generous tolerance for test execution time
  assert.ok(remaining >= 65 && remaining <= 70, `expected ~70, got ${remaining}`);
});

test("removeSeconds decrements additionsTotal symmetrically with how addSeconds increments it, floored at 0", () => {
  const uid = "additions-total";
  seedUser(uid, { paused: true, pauseRemaining: 100, additionsTotal: 20 });
  removeSeconds(uid, 50); // remove more than was ever recorded as added
  assert.equal(state.users.get(uid).additionsTotal, 0);
});

test("removeSeconds is a no-op for zero or negative amounts", () => {
  const uid = "noop";
  seedUser(uid, { paused: true, pauseRemaining: 100 });
  assert.equal(removeSeconds(uid, 0), 100);
  assert.equal(removeSeconds(uid, -10), 100);
});

test("removeSeconds is not blocked by capForcedOn — removal is corrective, not an addition", () => {
  const uid = "cap-forced";
  seedUser(uid, { paused: true, pauseRemaining: 100, capForcedOn: true });
  assert.equal(removeSeconds(uid, 30), 70);
});
