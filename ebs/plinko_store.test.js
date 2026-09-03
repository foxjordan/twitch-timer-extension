import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';

// Isolate the store's file I/O in a throwaway dir before it reads DATA_DIR.
const DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'plinko-store-'));
process.env.DATA_DIR = DATA_DIR;
const STORE_FILE = path.join(DATA_DIR, 'overlay-plinko.json');

const { DEFAULT_PLINKO_CONFIG } = await import('./plinko.js');
const {
  loadPlinkoConfig,
  getPlinkoConfig,
  setPlinkoConfig,
  persistPlinkoConfig,
  deletePlinkoConfig,
} = await import('./plinko_store.js');

test('getPlinkoConfig returns the default config for an unknown broadcaster', () => {
  assert.deepEqual(getPlinkoConfig('nobody-123'), DEFAULT_PLINKO_CONFIG);
});

test('getPlinkoConfig returns a copy, not shared mutable state', () => {
  const first = getPlinkoConfig('copy-check');
  first.baseSeconds = 9999;
  first.bins[0].multiplier = 9999;
  assert.equal(getPlinkoConfig('copy-check').baseSeconds, DEFAULT_PLINKO_CONFIG.baseSeconds);
});

test('setPlinkoConfig stores a sanitized config that getPlinkoConfig returns', () => {
  const saved = setPlinkoConfig('user-1', { baseSeconds: 120, rows: 999 });
  assert.equal(saved.baseSeconds, 120);
  assert.equal(saved.rows, 16); // clamped
  assert.equal(getPlinkoConfig('user-1').baseSeconds, 120);
  assert.equal(getPlinkoConfig('user-1').rows, 16);
});

test('setPlinkoConfig merges a partial patch onto the broadcaster existing config', () => {
  setPlinkoConfig('user-2', {
    baseSeconds: 90,
    token: { name: 'catJAM', url: 'https://cdn.7tv.app/emote/abc/2x.webp', source: '7tv' },
  });
  const next = setPlinkoConfig('user-2', { baseSeconds: 45 });
  assert.equal(next.baseSeconds, 45);
  assert.equal(next.token.name, 'catJAM');
  assert.equal(next.token.url, 'https://cdn.7tv.app/emote/abc/2x.webp');
});

test('setPlinkoConfig rejects a missing broadcaster id', () => {
  assert.throws(() => setPlinkoConfig('', { baseSeconds: 60 }), /id/i);
});

test('config survives a persist + reload round trip', async () => {
  setPlinkoConfig('user-3', { baseSeconds: 111, rows: 12 });
  await persistPlinkoConfig();

  const onDisk = JSON.parse(readFileSync(STORE_FILE, 'utf-8'));
  assert.equal(onDisk['user-3'].baseSeconds, 111);
  assert.equal(onDisk['user-3'].bins.length, 13);

  await loadPlinkoConfig();
  assert.equal(getPlinkoConfig('user-3').baseSeconds, 111);
  assert.equal(getPlinkoConfig('user-3').rows, 12);
});

test('loadPlinkoConfig sanitizes whatever is already on disk', async () => {
  writeFileSync(
    STORE_FILE,
    JSON.stringify({ 'legacy-user': { baseSeconds: -5, rows: 3, junk: true } }),
  );
  await loadPlinkoConfig();

  const cfg = getPlinkoConfig('legacy-user');
  assert.equal(cfg.baseSeconds, 1); // clamped up
  assert.equal(cfg.rows, 6); // clamped up
  assert.equal(cfg.bins.length, 7);
  assert.equal(cfg.junk, undefined);
});

test('deletePlinkoConfig drops a broadcaster back to defaults', () => {
  setPlinkoConfig('user-4', { baseSeconds: 300 });
  assert.equal(getPlinkoConfig('user-4').baseSeconds, 300);
  assert.equal(deletePlinkoConfig('user-4'), true);
  assert.deepEqual(getPlinkoConfig('user-4'), DEFAULT_PLINKO_CONFIG);
  assert.equal(deletePlinkoConfig('user-4'), false); // already gone
});
