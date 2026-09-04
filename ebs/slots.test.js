import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SLOTS_CONFIG,
  computeSlotsSpin,
  sanitizeSlotsConfig,
  MIN_SYMBOLS,
  MAX_SYMBOLS,
  SLOTS_DURATION_MS,
} from './slots.js';

const sym = (name, weight, tripleMultiplier) => ({
  emote: { name, url: `https://cdn.7tv.app/emote/${name}/2x.webp`, source: '7tv' },
  weight,
  tripleMultiplier,
});

test('constants', () => {
  assert.equal(MIN_SYMBOLS, 2);
  assert.equal(MAX_SYMBOLS, 8);
  assert.equal(SLOTS_DURATION_MS, 2700);
});

test('DEFAULT_SLOTS_CONFIG is internally valid', () => {
  const d = DEFAULT_SLOTS_CONFIG;
  assert.equal(d.baseSeconds, 30);
  assert.ok(d.symbols.length >= MIN_SYMBOLS && d.symbols.length <= MAX_SYMBOLS);
  assert.ok(d.anyTwoMultiplier >= 1 && d.noMatchMultiplier >= 1);
  assert.deepEqual(sanitizeSlotsConfig({}, d), d); // stable under a no-op sanitize
});

test('computeSlotsSpin is deterministic for a given seed', () => {
  const cfg = sanitizeSlotsConfig({ symbols: [sym('a', 1, 2), sym('b', 1, 3), sym('c', 1, 9)] });
  const a = computeSlotsSpin(cfg, { seed: 'seed-1' });
  const b = computeSlotsSpin(cfg, { seed: 'seed-1' });
  assert.deepEqual(a, b);
  assert.equal(a.reels.length, 3);
  a.reels.forEach((i) => assert.ok(i >= 0 && i < cfg.symbols.length));
});

test('triple -> that symbol tripleMultiplier; pair -> anyTwo; none -> noMatch', () => {
  const cfg = sanitizeSlotsConfig({
    symbols: [sym('a', 1, 5), sym('b', 1, 7), sym('c', 1, 11)],
    anyTwoMultiplier: 2,
    noMatchMultiplier: 1,
    baseSeconds: 10,
  });
  // Search seeds until we have one of each matchKind, then assert the multiplier.
  const seen = {};
  for (let i = 0; i < 5000 && Object.keys(seen).length < 3; i++) {
    const r = computeSlotsSpin(cfg, { seed: 'k' + i });
    seen[r.matchKind] = r;
  }
  assert.ok(seen.triple && seen.pair && seen.none, 'all three matchKinds reachable');
  assert.equal(seen.pair.multiplier, 2);
  assert.equal(seen.none.multiplier, 1);
  assert.equal(seen.triple.multiplier, cfg.symbols[seen.triple.reels[0]].tripleMultiplier);
  assert.equal(seen.triple.secondsToAdd, Math.floor(10 * seen.triple.multiplier));
});

test('weighting: a heavily weighted symbol dominates the reels', () => {
  const cfg = sanitizeSlotsConfig({ symbols: [sym('rare', 1, 50), sym('common', 999, 2)] });
  let common = 0;
  const N = 3000;
  for (let i = 0; i < N; i++) {
    for (const r of computeSlotsSpin(cfg, { seed: 'w' + i }).reels) if (r === 1) common++;
  }
  assert.ok(common / (N * 3) > 0.9, 'common symbol lands >90% of reel positions');
});

test('with exactly 2 symbols, matchKind is never "none"', () => {
  const cfg = sanitizeSlotsConfig({ symbols: [sym('a', 1, 2), sym('b', 1, 3)] });
  for (let i = 0; i < 500; i++) {
    assert.notEqual(computeSlotsSpin(cfg, { seed: 'p' + i }).matchKind, 'none');
  }
});

test('sanitizeSlotsConfig clamps and coerces', () => {
  const out = sanitizeSlotsConfig({
    baseSeconds: 99999.7,
    symbols: [sym('x', 0, 0.01)], // 1 symbol, weight/mult below floor
    anyTwoMultiplier: 0.2,
    noMatchMultiplier: -5,
    triggerSoundId: 'z'.repeat(200),
    style: { panelOpacity: 5, reelSoundVolume: -1, panelColor: 'nope' },
  });
  assert.equal(out.baseSeconds, 3600);
  assert.equal(out.symbols.length, MIN_SYMBOLS); // padded up to 2
  assert.ok(out.symbols[0].weight >= 1 && out.symbols[0].tripleMultiplier >= 1);
  assert.equal(out.anyTwoMultiplier, 1);
  assert.equal(out.noMatchMultiplier, 1);
  assert.equal(out.triggerSoundId.length, 64);
  assert.equal(out.style.panelOpacity, 1);
  assert.equal(out.style.reelSoundVolume, 0);
  assert.equal(out.style.panelColor, DEFAULT_SLOTS_CONFIG.style.panelColor);
});

test('sanitizeSlotsConfig rejects a non-allowlisted emote host', () => {
  const out = sanitizeSlotsConfig({
    symbols: [
      { emote: { name: 'ok', url: 'https://cdn.7tv.app/emote/ok/2x.webp', source: '7tv' }, weight: 1, tripleMultiplier: 2 },
      { emote: { name: 'bad', url: 'https://evil.example/x.png', source: '7tv' }, weight: 1, tripleMultiplier: 2 },
    ],
  });
  assert.equal(out.symbols[0].emote.url, 'https://cdn.7tv.app/emote/ok/2x.webp');
  assert.equal(out.symbols[1].emote.url, '');
});

test('sanitizeSlotsConfig truncates > MAX_SYMBOLS', () => {
  const many = Array.from({ length: 20 }, (_, i) => sym('s' + i, 1, 2));
  assert.equal(sanitizeSlotsConfig({ symbols: many }).symbols.length, MAX_SYMBOLS);
});
