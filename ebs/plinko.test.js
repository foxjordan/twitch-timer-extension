import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  simulatePlinko,
  computePlinkoDrop,
  DEFAULT_PLINKO_CONFIG,
  sanitizePlinkoConfig,
  MIN_ROWS,
  MAX_ROWS,
} from './plinko.js';

function meanBinIndex(rows, dropColumn, count = 4000) {
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += simulatePlinko({ rows, dropColumn, seed: `seed-${dropColumn}-${i}` }).binIndex;
  }
  return total / count;
}

test('simulatePlinko is deterministic for the same rows/dropColumn/seed', () => {
  const a = simulatePlinko({ rows: 9, dropColumn: 4, seed: 'drop-abc-123' });
  const b = simulatePlinko({ rows: 9, dropColumn: 4, seed: 'drop-abc-123' });

  assert.deepEqual(a, b);
  assert.ok(a.path.every((step) => typeof step === 'boolean'));
  assert.ok(Number.isInteger(a.binIndex) && a.binIndex >= 0 && a.binIndex <= 9);
});

test('simulatePlinko takes an even number of half-steps so it lands on a whole bin', () => {
  for (let rows = 6; rows <= 16; rows++) {
    const r = simulatePlinko({ rows, dropColumn: Math.floor(rows / 2), seed: 'even-' + rows });
    assert.equal(r.path.length % 2, 0, `rows ${rows}: bounce count must be even`);
    assert.ok(Number.isInteger(r.binIndex), `rows ${rows}: binIndex must be a whole bin`);
  }
});

test('odd row counts land with no rounding bias', () => {
  // mirror-image entry columns must give means mirrored about the centre;
  // the old odd-rows walk always rounded the half-position up, skewing right.
  const rows = 9;
  const mid = (meanBinIndex(rows, 4) + meanBinIndex(rows, 5)) / 2;
  assert.ok(Math.abs(mid - rows / 2) < 0.25, `midpoint ${mid} should be ~${rows / 2}`);
});

test('an edge-column drop has real spread — momentum carries it inward', () => {
  const rows = 9;
  const trials = 4000;
  let past = 0;
  for (let i = 0; i < trials; i++) {
    if (simulatePlinko({ rows, dropColumn: 0, seed: 'edge-' + i }).binIndex >= 3) past++;
  }
  const pct = past / trials;
  // not a tidy left/right shuffle: a healthy share of column-0 drops carry
  // past bin 2. (The old fair-coin walk left this near 10%.)
  assert.ok(pct > 0.2 && pct < 0.6, `expected 20-60% of column-0 drops past bin 2, got ${(pct * 100).toFixed(0)}%`);
});

test('a centred drop still favours the middle bins over the edges', () => {
  const rows = 9;
  const trials = 4000;
  let center = 0;
  let edge = 0;
  for (let i = 0; i < trials; i++) {
    const b = simulatePlinko({ rows, dropColumn: 4, seed: 'mid-' + i }).binIndex;
    if (b >= 3 && b <= 6) center++;
    if (b === 0 || b === rows) edge++;
  }
  assert.ok(center / trials > 0.4, `middle bins should be common, got ${(100 * center / trials).toFixed(0)}%`);
  assert.ok(edge / trials < 0.15, `edge bins should stay rare, got ${(100 * edge / trials).toFixed(0)}%`);
});

test('dropColumn shifts the landing distribution toward that side', () => {
  const rows = 10;
  const left = meanBinIndex(rows, 0);
  const center = meanBinIndex(rows, 5);
  const right = meanBinIndex(rows, 10);

  // Left drop lands well left of centre, right drop well right of centre.
  assert.ok(left < center - 1.5, `expected left mean ${left} << center ${center}`);
  assert.ok(right > center + 1.5, `expected right mean ${right} >> center ${center}`);
  // A centred drop stays near the middle bin.
  assert.ok(Math.abs(center - rows / 2) < 0.5, `expected center mean ${center} ~ ${rows / 2}`);
});

test('DEFAULT_PLINKO_CONFIG is internally consistent', () => {
  assert.equal(DEFAULT_PLINKO_CONFIG.bins.length, DEFAULT_PLINKO_CONFIG.rows + 1);
  assert.ok(DEFAULT_PLINKO_CONFIG.rows >= MIN_ROWS && DEFAULT_PLINKO_CONFIG.rows <= MAX_ROWS);
  assert.ok(DEFAULT_PLINKO_CONFIG.baseSeconds > 0);
  assert.ok(DEFAULT_PLINKO_CONFIG.bins.every((b) => b.multiplier >= 1));
});

test('sanitizePlinkoConfig with no patch returns a full default config copy', () => {
  const result = sanitizePlinkoConfig();

  assert.equal(result.baseSeconds, DEFAULT_PLINKO_CONFIG.baseSeconds);
  assert.equal(result.rows, DEFAULT_PLINKO_CONFIG.rows);
  assert.equal(result.bins.length, DEFAULT_PLINKO_CONFIG.rows + 1);
  assert.deepEqual(result.token, DEFAULT_PLINKO_CONFIG.token);
  assert.deepEqual(result.style, DEFAULT_PLINKO_CONFIG.style);
  // must be a copy, not the shared default object
  result.bins[0].multiplier = 999;
  result.style.panelColor = '#000000';
  assert.notEqual(DEFAULT_PLINKO_CONFIG.bins[0].multiplier, 999);
  assert.notEqual(DEFAULT_PLINKO_CONFIG.style.panelColor, '#000000');
});

test('sanitizePlinkoConfig merges and clamps the style block', () => {
  const partial = sanitizePlinkoConfig({
    style: { panel: false, panelOpacity: 5, pegColor: 'bogus', textColor: '#112233', pegSound: false, pegSoundVolume: 9, winSoundVolume: -3 },
  });
  assert.equal(partial.style.panel, false);
  assert.equal(partial.style.panelOpacity, 1); // clamped
  assert.equal(partial.style.pegColor, DEFAULT_PLINKO_CONFIG.style.pegColor); // bad hex -> default
  assert.equal(partial.style.textColor, '#112233');
  assert.equal(partial.style.showStatus, DEFAULT_PLINKO_CONFIG.style.showStatus); // untouched field kept
  assert.equal(partial.style.pegSound, false);
  assert.equal(partial.style.pegSoundVolume, 1); // clamped to [0,1]
  assert.equal(partial.style.winSound, DEFAULT_PLINKO_CONFIG.style.winSound); // untouched
  assert.equal(partial.style.winSoundVolume, 0); // clamped up from -3

  // merges onto a given base rather than resetting to defaults
  const next = sanitizePlinkoConfig({ style: { showStatus: false } }, partial);
  assert.equal(next.style.showStatus, false);
  assert.equal(next.style.panel, false);
  assert.equal(next.style.textColor, '#112233');
});

test('sanitizePlinkoConfig clamps baseSeconds and ignores non-numeric input', () => {
  assert.equal(sanitizePlinkoConfig({ baseSeconds: 0 }).baseSeconds, 1);
  assert.equal(sanitizePlinkoConfig({ baseSeconds: 99999 }).baseSeconds, 3600);
  assert.equal(sanitizePlinkoConfig({ baseSeconds: 42.9 }).baseSeconds, 42);
  assert.equal(
    sanitizePlinkoConfig({ baseSeconds: 'nope' }).baseSeconds,
    DEFAULT_PLINKO_CONFIG.baseSeconds,
  );
});

test('sanitizePlinkoConfig clamps rows into [MIN_ROWS, MAX_ROWS]', () => {
  assert.equal(sanitizePlinkoConfig({ rows: 2 }).rows, MIN_ROWS);
  assert.equal(sanitizePlinkoConfig({ rows: 999 }).rows, MAX_ROWS);
  assert.equal(sanitizePlinkoConfig({ rows: 11 }).rows, 11);
});

test('sanitizePlinkoConfig always returns bins of length rows + 1', () => {
  // rows changes but no bins supplied -> reshaped to fit
  assert.equal(sanitizePlinkoConfig({ rows: 12 }).bins.length, 13);
  // caller supplies a wrong-length bins array -> coerced
  const short = sanitizePlinkoConfig({ rows: 8, bins: [{ multiplier: 2, color: '#fff' }] });
  assert.equal(short.bins.length, 9);
  assert.equal(short.bins[0].multiplier, 2);
});

test('sanitizePlinkoConfig clamps each bin multiplier and defaults bad colors', () => {
  const result = sanitizePlinkoConfig({
    rows: 6,
    bins: Array.from({ length: 7 }, (_, i) => ({
      multiplier: i === 0 ? 0 : i === 1 ? 500 : 1.5,
      color: i === 2 ? 'not-a-color' : '#123abc',
    })),
  });
  assert.equal(result.bins[0].multiplier, 0.1);
  assert.equal(result.bins[1].multiplier, 100);
  assert.equal(result.bins[3].color, '#123abc'); // valid color preserved
  assert.match(result.bins[2].color, /^#[0-9a-fA-F]{6}$/); // invalid color replaced with a real hex
});

test('sanitizePlinkoConfig only accepts token URLs on the Twitch/7TV CDNs', () => {
  const ok = sanitizePlinkoConfig({
    token: { name: 'catJAM', url: 'https://cdn.7tv.app/emote/abc/2x.webp', source: '7tv' },
  });
  assert.equal(ok.token.url, 'https://cdn.7tv.app/emote/abc/2x.webp');
  assert.equal(ok.token.name, 'catJAM');

  const twitchOk = sanitizePlinkoConfig({
    token: { name: 'Kappa', url: 'https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/3.0' },
  });
  assert.equal(twitchOk.token.url, 'https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/3.0');

  const evil = sanitizePlinkoConfig({ token: { name: 'x', url: 'https://evil.example.com/a.png' } });
  assert.equal(evil.token.url, '');

  const insecure = sanitizePlinkoConfig({ token: { url: 'http://cdn.7tv.app/emote/abc/2x.webp' } });
  assert.equal(insecure.token.url, '');
});

test('computePlinkoDrop resolves the landing bin to a multiplier and a seconds delta', () => {
  const cfg = sanitizePlinkoConfig({
    baseSeconds: 50,
    rows: 8,
    bins: [
      { multiplier: 4, color: '#F97316' },
      { multiplier: 2, color: '#EC4899' },
      { multiplier: 1.5, color: '#3B82F6' },
      { multiplier: 1.25, color: '#9146FF' },
      { multiplier: 1, color: '#9146FF' },
      { multiplier: 1.25, color: '#9146FF' },
      { multiplier: 1.5, color: '#3B82F6' },
      { multiplier: 2, color: '#EC4899' },
      { multiplier: 4, color: '#F97316' },
    ],
  });

  const drop = computePlinkoDrop(cfg, { dropColumn: 4, seed: 'fixed-seed-1' });

  assert.deepEqual(drop.path, simulatePlinko({ rows: 8, dropColumn: 4, seed: 'fixed-seed-1' }).path);
  assert.ok(drop.binIndex >= 0 && drop.binIndex <= 8);
  assert.equal(drop.multiplier, cfg.bins[drop.binIndex].multiplier);
  assert.equal(drop.secondsToAdd, Math.floor(cfg.baseSeconds * drop.multiplier));
});

test('computePlinkoDrop floors fractional seconds', () => {
  const cfg = sanitizePlinkoConfig({
    baseSeconds: 50,
    rows: 6,
    bins: Array.from({ length: 7 }, () => ({ multiplier: 1.25, color: '#9146FF' })),
  });
  const drop = computePlinkoDrop(cfg, { dropColumn: 3, seed: 'whatever' });
  assert.equal(drop.multiplier, 1.25);
  assert.equal(drop.secondsToAdd, 62); // 50 * 1.25 = 62.5 -> 62
});

test('sanitizePlinkoConfig carries a triggerSoundId string', () => {
  assert.equal(sanitizePlinkoConfig().triggerSoundId, '');
  assert.equal(sanitizePlinkoConfig({ triggerSoundId: 'snd_abc123' }).triggerSoundId, 'snd_abc123');
  assert.equal(sanitizePlinkoConfig({ triggerSoundId: 42 }).triggerSoundId, ''); // non-string -> default
  assert.equal(sanitizePlinkoConfig({ triggerSoundId: 'x'.repeat(200) }).triggerSoundId.length, 64);

  // merges onto a base rather than resetting
  const base = sanitizePlinkoConfig({ triggerSoundId: 'snd_keep', baseSeconds: 90 });
  const next = sanitizePlinkoConfig({ baseSeconds: 30 }, base);
  assert.equal(next.triggerSoundId, 'snd_keep');
});

test('sanitizePlinkoConfig merges a partial patch onto the given base', () => {
  const base = sanitizePlinkoConfig({
    baseSeconds: 90,
    token: { name: 'catJAM', url: 'https://cdn.7tv.app/emote/abc/2x.webp', source: '7tv' },
  });
  const next = sanitizePlinkoConfig({ baseSeconds: 120 }, base);

  assert.equal(next.baseSeconds, 120);
  assert.equal(next.token.name, 'catJAM'); // untouched field preserved
  assert.equal(next.token.url, 'https://cdn.7tv.app/emote/abc/2x.webp');
});
