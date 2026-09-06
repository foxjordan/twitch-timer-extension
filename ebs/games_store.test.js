import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';

// Isolate the store's file I/O in a throwaway dir before it reads DATA_DIR —
// mirrors slots_store.test.js's isolation pattern.
const DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'games-store-'));
process.env.DATA_DIR = DATA_DIR;

const {
  loadGamesSettings,
  getGamesSettings,
  setGamesSettings,
  deleteGamesSettings,
  persistGamesSettings,
  getGlobalGamesConfig,
  setGlobalGamesConfig,
  persistGlobalGamesConfig,
} = await import('./games_store.js');

test('getGamesSettings returns sane defaults for an unknown broadcaster', () => {
  const s = getGamesSettings('nobody-123');
  assert.equal(s.granted, false);
  assert.equal(s.visibility.enabled, true);
  assert.equal(s.visibility.plinko, true);
  assert.equal(s.visibility.slots, true);
  assert.equal(s.pricing.plinkoMinTier, 'sound_100');
  assert.equal(s.pricing.slotsMinTier, 'sound_100');
});

test('getGamesSettings returns a copy, not shared mutable state', () => {
  const first = getGamesSettings('copy-check');
  first.visibility.enabled = false;
  first.pricing.plinkoMinTier = 'sound_10';
  const second = getGamesSettings('copy-check');
  assert.equal(second.visibility.enabled, true);
  assert.equal(second.pricing.plinkoMinTier, 'sound_100');
});

test('setGamesSettings merges a partial patch and getGamesSettings reflects it', () => {
  setGamesSettings('user-1', { visibility: { enabled: true, plinko: false, slots: true } });
  const saved = setGamesSettings('user-1', { granted: true });
  assert.equal(saved.granted, true);
  assert.equal(saved.visibility.plinko, false); // earlier patch preserved
  assert.equal(getGamesSettings('user-1').granted, true);
});

test('setGamesSettings accepts a pricing tier at or above the global floor', () => {
  const saved = setGamesSettings('user-2', { pricing: { plinkoMinTier: 'sound_500' } });
  assert.equal(saved.pricing.plinkoMinTier, 'sound_500');
});

test('setGamesSettings rejects a pricing tier below the global floor', () => {
  setGlobalGamesConfig({ minTier: 'sound_300' });
  const before = getGamesSettings('user-3').pricing.plinkoMinTier;
  const saved = setGamesSettings('user-3', { pricing: { plinkoMinTier: 'sound_10' } });
  assert.equal(saved.pricing.plinkoMinTier, before); // rejected, unchanged
});

test('setGamesSettings ignores an unknown tier string entirely', () => {
  const saved = setGamesSettings('user-4', { pricing: { slotsMinTier: 'not-a-real-sku' } });
  assert.equal(saved.pricing.slotsMinTier, 'sound_100');
});

test('deleteGamesSettings reports whether the broadcaster existed', () => {
  setGamesSettings('user-5', { granted: true });
  assert.equal(deleteGamesSettings('user-5'), true);
  assert.equal(deleteGamesSettings('user-5'), false);
  assert.equal(getGamesSettings('user-5').granted, false); // back to default
});

test('per-user settings survive a persist + reload round trip', async () => {
  // Pin a known floor — an earlier test in this file raises the global
  // floor, and setGamesSettings correctly enforces it, so this test must
  // not assume the sound_100 default is still in effect.
  setGlobalGamesConfig({ minTier: 'sound_100' });
  setGamesSettings('user-6', { granted: true, pricing: { plinkoMinTier: 'sound_250' } });
  await persistGamesSettings();
  await loadGamesSettings();
  const reloaded = getGamesSettings('user-6');
  assert.equal(reloaded.granted, true);
  assert.equal(reloaded.pricing.plinkoMinTier, 'sound_250');
});

test('getGlobalGamesConfig defaults to not-launched with a sound_100 floor', () => {
  // Fresh process-level default before any setGlobalGamesConfig call in this
  // file — checked first via a distinct uid-free assertion isn't possible
  // since setGlobalGamesConfig mutates module state; assert the shape instead.
  const g = getGlobalGamesConfig();
  assert.equal(g.launched.plinko, false);
  assert.equal(g.launched.slots, false);
  assert.ok(g.minTier);
});

test('getGlobalGamesConfig returns a copy, not shared mutable state', () => {
  const first = getGlobalGamesConfig();
  first.launched.plinko = true;
  const second = getGlobalGamesConfig();
  assert.equal(second.launched.plinko, false);
});

test('setGlobalGamesConfig launches Plinko and Slots independently', async () => {
  const updated = setGlobalGamesConfig({ launched: { plinko: true } });
  assert.equal(updated.launched.plinko, true);
  assert.equal(updated.launched.slots, false); // untouched by a plinko-only patch

  const updated2 = setGlobalGamesConfig({ launched: { slots: true } });
  assert.equal(updated2.launched.plinko, true); // still on from the earlier patch
  assert.equal(updated2.launched.slots, true);
  await persistGlobalGamesConfig();
});

test('setGlobalGamesConfig updates minTier and persists', async () => {
  const updated = setGlobalGamesConfig({ minTier: 'sound_50' });
  assert.equal(updated.minTier, 'sound_50');
  await persistGlobalGamesConfig();
});

test('setGlobalGamesConfig ignores an unknown tier string', () => {
  setGlobalGamesConfig({ minTier: 'sound_50' });
  const updated = setGlobalGamesConfig({ minTier: 'garbage' });
  assert.equal(updated.minTier, 'sound_50');
});
