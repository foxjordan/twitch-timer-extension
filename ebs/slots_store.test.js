import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';

// Isolate the store's file I/O in a throwaway dir before it reads DATA_DIR.
const DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'slots-store-'));
process.env.DATA_DIR = DATA_DIR;
const STORE_FILE = path.join(DATA_DIR, 'overlay-slots.json');

const { DEFAULT_SLOTS_CONFIG } = await import('./slots.js');
const {
  loadSlotsConfig,
  getSlotsConfig,
  setSlotsConfig,
  persistSlotsConfig,
  deleteSlotsConfig,
} = await import('./slots_store.js');

test('getSlotsConfig returns the default config for an unknown broadcaster', () => {
  assert.deepEqual(getSlotsConfig('nobody-123'), DEFAULT_SLOTS_CONFIG);
});

test('getSlotsConfig returns a copy, not shared mutable state', () => {
  const first = getSlotsConfig('copy-check');
  first.baseSeconds = 9999;
  first.symbols[0].tripleMultiplier = 9999;
  assert.equal(getSlotsConfig('copy-check').baseSeconds, DEFAULT_SLOTS_CONFIG.baseSeconds);
});

test('setSlotsConfig stores a sanitized config that getSlotsConfig returns', () => {
  const saved = setSlotsConfig('user-1', { baseSeconds: 45, anyTwoMultiplier: 200 });
  assert.equal(saved.baseSeconds, 45);
  assert.equal(saved.anyTwoMultiplier, 100); // clamped
  assert.equal(getSlotsConfig('user-1').baseSeconds, 45);
});

test('setSlotsConfig merges a partial patch onto the broadcaster existing config', () => {
  setSlotsConfig('user-2', {
    baseSeconds: 90,
    symbols: [
      { emote: { name: 'catJAM', url: 'https://cdn.7tv.app/emote/abc/2x.webp', source: '7tv' }, weight: 3, tripleMultiplier: 8 },
      { emote: { name: 'PogO', url: 'https://cdn.7tv.app/emote/def/2x.webp', source: '7tv' }, weight: 1, tripleMultiplier: 4 },
    ],
  });
  const next = setSlotsConfig('user-2', { baseSeconds: 45 });
  assert.equal(next.baseSeconds, 45);
  assert.equal(next.symbols.length, 2);
  assert.equal(next.symbols[0].emote.name, 'catJAM');
  assert.equal(next.symbols[0].emote.url, 'https://cdn.7tv.app/emote/abc/2x.webp');
});

test('setSlotsConfig rejects a missing broadcaster id', () => {
  assert.throws(() => setSlotsConfig('', { baseSeconds: 60 }), /id/i);
});

test('config survives a persist + reload round trip', async () => {
  setSlotsConfig('user-3', { baseSeconds: 111, noMatchMultiplier: 1.25 });
  await persistSlotsConfig();

  const onDisk = JSON.parse(readFileSync(STORE_FILE, 'utf-8'));
  assert.equal(onDisk['user-3'].baseSeconds, 111);
  assert.equal(onDisk['user-3'].noMatchMultiplier, 1.25);

  await loadSlotsConfig();
  assert.equal(getSlotsConfig('user-3').baseSeconds, 111);
  assert.equal(getSlotsConfig('user-3').noMatchMultiplier, 1.25);
});

test('loadSlotsConfig sanitizes whatever is already on disk', async () => {
  writeFileSync(
    STORE_FILE,
    JSON.stringify({ 'legacy-user': { baseSeconds: -5, symbols: [{ weight: 0, tripleMultiplier: 0.1 }], junk: true } }),
  );
  await loadSlotsConfig();

  const cfg = getSlotsConfig('legacy-user');
  assert.equal(cfg.baseSeconds, 1); // clamped up
  assert.equal(cfg.symbols.length, 2); // padded up to MIN_SYMBOLS
  assert.ok(cfg.symbols[0].weight >= 1 && cfg.symbols[0].tripleMultiplier >= 1);
  assert.equal(cfg.junk, undefined);
});

test('deleteSlotsConfig drops a broadcaster back to defaults', () => {
  setSlotsConfig('user-4', { baseSeconds: 300 });
  assert.equal(getSlotsConfig('user-4').baseSeconds, 300);
  assert.equal(deleteSlotsConfig('user-4'), true);
  assert.deepEqual(getSlotsConfig('user-4'), DEFAULT_SLOTS_CONFIG);
  assert.equal(deleteSlotsConfig('user-4'), false); // already gone
});
