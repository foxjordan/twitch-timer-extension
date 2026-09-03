import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FEATURE_CATALOG, shapeFeatureUsage } from './feature_usage.js';

const row = (feature, event_name, distinct_channels, event_count) => ({
  feature, event_name, distinct_channels, event_count,
});

test('FEATURE_CATALOG has the 11 spec keys and unique labels', () => {
  const keys = FEATURE_CATALOG.map((f) => f.feature);
  assert.deepEqual(
    [...keys].sort(),
    ['delegates', 'extras', 'goals', 'plinko', 'prompts', 'sounds', 'streamelements', 'timer', 'tts', 'wheel', 'youtube'],
  );
  assert.equal(new Set(FEATURE_CATALOG.map((f) => f.label)).size, 11);
});

test('maps feature_view -> reached, feature_use -> used + useEvents', () => {
  const out = shapeFeatureUsage({
    currentRows: [
      row('sounds', 'feature_view', 40, 900),
      row('sounds', 'feature_use', 31, 512),
    ],
    prevRows: [],
    activeStreamers: 47,
    registeredTotal: 215,
  });
  const sounds = out.features.find((f) => f.feature === 'sounds');
  assert.equal(sounds.reached, 40);
  assert.equal(sounds.used, 31);
  assert.equal(sounds.useEvents, 512);
  assert.equal(sounds.label, 'Sound Alerts');
  assert.equal(out.activeStreamers, 47);
  assert.equal(out.registeredTotal, 215);
});

test('every catalog feature appears once even with no rows', () => {
  const out = shapeFeatureUsage({ currentRows: [], prevRows: [], activeStreamers: 0, registeredTotal: 10 });
  assert.equal(out.features.length, FEATURE_CATALOG.length);
  for (const f of out.features) {
    assert.equal(f.reached, 0);
    assert.equal(f.used, 0);
    assert.equal(f.useEvents, 0);
    assert.equal(f.trend, 'flat');
    assert.equal(f.useRate, 0);
  }
});

test('trend compares used against the previous window', () => {
  const out = shapeFeatureUsage({
    currentRows: [row('goals', 'feature_use', 9, 41), row('timer', 'feature_use', 34, 288)],
    prevRows: [row('goals', 'feature_use', 20, 120), row('timer', 'feature_use', 30, 240)],
    activeStreamers: 40,
    registeredTotal: 215,
  });
  assert.equal(out.features.find((f) => f.feature === 'goals').trend, 'down');
  assert.equal(out.features.find((f) => f.feature === 'goals').usedPrev, 20);
  assert.equal(out.features.find((f) => f.feature === 'timer').trend, 'up');
});

test('useRate is used / reached, and features sort by used desc', () => {
  const out = shapeFeatureUsage({
    currentRows: [
      row('sounds', 'feature_view', 40, 0), row('sounds', 'feature_use', 30, 100),
      row('goals', 'feature_view', 20, 0), row('goals', 'feature_use', 9, 20),
    ],
    prevRows: [],
    activeStreamers: 47,
    registeredTotal: 215,
  });
  assert.equal(out.features[0].feature, 'sounds'); // used 30 > 9
  assert.equal(out.features.find((f) => f.feature === 'sounds').useRate, 0.75);
  assert.equal(out.features.find((f) => f.feature === 'goals').useRate, 0.45);
});

test('registeredTotal null is preserved', () => {
  const out = shapeFeatureUsage({ currentRows: [], prevRows: [], activeStreamers: 3, registeredTotal: null });
  assert.equal(out.registeredTotal, null);
});
