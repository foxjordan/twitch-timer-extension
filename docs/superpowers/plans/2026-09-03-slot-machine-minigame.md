# Slot Machine Mini-Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a 3-reel slot-machine chance game in the Extras section that adds `floor(baseSeconds × multiplier)` to the subathon timer, structured as a standalone sibling of the Plinko subsystem.

**Architecture:** A per-broadcaster config (`overlay-slots.json`) drives a seeded, server-authoritative outcome (`computeSlotsSpin`). Spins go through the existing `createPlinkoQueue` (game-agnostic) one at a time per channel; the timer credit is deferred to land when the reel animation finishes. A self-contained `/overlay/slots` OBS browser source and an Extras-page section both consume `slots_spin` / `slots_board` / `slots_queue` SSE events over the existing `/api/overlay/stream`. Every file mirrors its Plinko counterpart.

**Tech Stack:** Node.js (ESM), Express, `node:test` + `node:assert/strict`, SSE. No new dependencies. No DB. Config persisted as JSON via `atomicWriteFile` on the `/data` volume.

**Spec:** [docs/superpowers/specs/2026-09-03-slot-machine-minigame-design.md](../specs/2026-09-03-slot-machine-minigame-design.md)

## Global Constraints

- **Mirror Plinko, never refactor it.** Touch `plinko.js` only to *import* `ALLOWED_TOKEN_HOSTS`. No change to any existing Plinko file, route, or behavior.
- **Seeded + server-authoritative.** `computeSlotsSpin(config, { seed })` decides the reels; overlay + preview replay the returned `reels` array verbatim.
- **Timer credit via `addSeconds(uid, seconds)`** (`ebs/state.js`), **deferred** by `durationMs` inside `playSlotsSpin` — exactly as `playPlinkoDrop` defers.
- **Queue:** reuse `createPlinkoQueue` from `./plinko_queue.js` for a second instance `slotsQueue`. Its `enqueue`/`snapshot`/`size` and the `{ viewerName, source }` `pub` shape are unchanged.
- **Constants (exact):** `MIN_SYMBOLS = 2`, `MAX_SYMBOLS = 8`, `SLOTS_DURATION_MS = 2600`. Reels stop staggered at **1400 / 1900 / 2400 ms**.
- **Multipliers are all `>= 1`** (`anyTwoMultiplier`, `noMatchMultiplier`, every `tripleMultiplier`), clamp range `[1, 100]`. `baseSeconds` clamp `[1, 3600]` floored, default `30`. `weight` clamp `[1, 1000]` rounded.
- **Emote URL rule:** `https:` only, hostname in `ALLOWED_TOKEN_HOSTS` (`static-cdn.jtvnw.net`, `cdn.7tv.app`), else `''`. `emote.source` ∈ `{ 'twitch', '7tv', '' }`. `emote.name` `.slice(0, 100)`.
- **`test` fires** animate immediately via `fanOutSlotsSpin`, never enqueue, never credit (`secondsAdded: 0`).
- **Sound trigger:** in `handleSoundAlert`, after the Plinko trigger block, fire a spin when `getSlotsConfig(channelId).triggerSoundId === String(soundId)` and `!isTestAlert`; bonus on top of the sound's Bits time; `source: 'sound_alert'`.
- **`boardId` is always `''` in v1** — cache key is the bare `overlayKey`, fan-out does not filter on `boardId` (matches Plinko).
- **Seed generator:** use `uuidv4()` (already in `server.js` scope), matching `firePlinkoDrop`.
- **Auth:** config + spin routes gate on `req.session.isAdmin`, resolve the broadcaster with `resolveTimerUserIdFromRequest(req)`, resolve the overlay key with `normKey(req.session?.userOverlayKey || "")` / `normKey(getOrCreateUserKey(String(channelId)))` — same as the Plinko routes.
- Commit after every task. End commit messages with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

## File Structure

| File | Create/Modify | Responsibility |
|---|---|---|
| `ebs/slots.js` | Create | `DEFAULT_SLOTS_CONFIG`, `computeSlotsSpin`, `sanitizeSlotsConfig`, constants, private PRNG |
| `ebs/slots.test.js` | Create | Unit tests for the pure core |
| `ebs/slots_store.js` | Create | Per-broadcaster JSON store, mirrors `plinko_store.js` |
| `ebs/slots_store.test.js` | Create | Unit tests for the store |
| `ebs/views/slotsOverlayPage.js` | Create | Self-contained `/overlay/slots` browser source |
| `ebs/server.js` | Modify | imports + module block (Tasks 4), core fns (5), `/api/slots/*` routes (6), SSE replay + sound trigger (7) |
| `ebs/routes_overlay_page.js` | Modify | `GET /overlay/slots` |
| `ebs/routes_home_page.js` | Modify | pass `slotsOverlayBase` to `renderUtilitiesPage` |
| `ebs/views/utilitiesPage.js` | Modify | "Slots" sidebar section (config + spin + preview + copy link) |
| `ebs/views/dashboardPage.js` | Modify | Slots card in the `overlays` array |
| `ebs/user_data_deletion.js` | Modify | `deleteSlotsConfig(uid)` deletion step |
| `.gitignore` | Modify | `ebs/overlay-slots.json` |

---

### Task 1: `ebs/slots.js` pure core

**Files:**
- Create: `ebs/slots.js`
- Test: `ebs/slots.test.js`

**Interfaces:**
- Produces:
  - `MIN_SYMBOLS = 2`, `MAX_SYMBOLS = 8`, `SLOTS_DURATION_MS = 2600` (exports)
  - `DEFAULT_SLOTS_CONFIG` — the object from the spec's "Config schema".
  - `computeSlotsSpin(config, { seed }) => { reels: number[3], matchKind: 'triple'|'pair'|'none', multiplier: number, secondsToAdd: number }` — `reels` are indices into `config.symbols`.
  - `sanitizeSlotsConfig(patch, base = DEFAULT_SLOTS_CONFIG) => SlotsConfig` — never throws.

- [ ] **Step 1: Write the failing test**

Create `ebs/slots.test.js`:

```js
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
  assert.equal(SLOTS_DURATION_MS, 2600);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ebs && node --test slots.test.js`
Expected: FAIL — `Cannot find module './slots.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `ebs/slots.js`:

```js
// Pure, dependency-free core for the Slot Machine Extras overlay. Mirrors the
// shape of plinko.js: DEFAULT config + sanitizer + a seeded, server-authoritative
// outcome function. The overlay and the Extras preview replay `reels` verbatim.
import { ALLOWED_TOKEN_HOSTS } from './plinko.js';

export const MIN_SYMBOLS = 2;
export const MAX_SYMBOLS = 8;
export const SLOTS_DURATION_MS = 2600;

const clone = (v) => JSON.parse(JSON.stringify(v));
const HEX_COLOR = /^#([0-9a-fA-F]{3}){1,2}$/;
const ALLOWED_EMOTE_SOURCES = new Set(['twitch', '7tv', '']);

const MIN_BASE_SECONDS = 1;
const MAX_BASE_SECONDS = 3600;
const MIN_WEIGHT = 1;
const MAX_WEIGHT = 1000;
const MIN_MULT = 1;
const MAX_MULT = 100;

const roundTo = (n, d) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};
function clampNumber(value, lo, hi, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}
const bool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);
function sanitizeColor(value, fallback) {
  return typeof value === 'string' && HEX_COLOR.test(value.trim()) ? value.trim() : fallback;
}
function sanitizeEmoteUrl(value) {
  if (typeof value !== 'string' || !value) return '';
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return '';
  }
  if (parsed.protocol !== 'https:') return '';
  if (!ALLOWED_TOKEN_HOSTS.has(parsed.hostname)) return '';
  return parsed.toString();
}

export const DEFAULT_SLOTS_CONFIG = {
  baseSeconds: 30,
  symbols: [
    { emote: { name: '', url: '', source: '' }, weight: 1, tripleMultiplier: 2 },
    { emote: { name: '', url: '', source: '' }, weight: 1, tripleMultiplier: 4 },
    { emote: { name: '', url: '', source: '' }, weight: 1, tripleMultiplier: 10 },
  ],
  anyTwoMultiplier: 1.5,
  noMatchMultiplier: 1.0,
  triggerSoundId: '',
  style: {
    panel: true,
    panelColor: '#0f0f12',
    panelOpacity: 0.82,
    reelColor: '#17171b',
    textColor: '#f8fafc',
    showStatus: true,
    reelSound: true,
    reelSoundVolume: 0.35,
    winSound: true,
    winSoundVolume: 0.5,
  },
};

function centreDefaultSymbol() {
  return clone(DEFAULT_SLOTS_CONFIG.symbols[0]);
}

function sanitizeSymbol(raw, fallback) {
  const base = fallback || centreDefaultSymbol();
  if (raw == null || typeof raw !== 'object') return clone(base);
  const rawEmote = raw.emote && typeof raw.emote === 'object' ? raw.emote : {};
  return {
    emote: {
      name: typeof rawEmote.name === 'string' ? rawEmote.name.slice(0, 100) : base.emote.name,
      url: 'url' in rawEmote ? sanitizeEmoteUrl(rawEmote.url) : base.emote.url,
      source: ALLOWED_EMOTE_SOURCES.has(rawEmote.source) ? rawEmote.source : '',
    },
    weight: Math.round(clampNumber(raw.weight, MIN_WEIGHT, MAX_WEIGHT, base.weight)),
    tripleMultiplier: roundTo(
      clampNumber(raw.tripleMultiplier, MIN_MULT, MAX_MULT, base.tripleMultiplier),
      2,
    ),
  };
}

function sanitizeSymbols(rawSymbols, baseSymbols) {
  const source = Array.isArray(rawSymbols)
    ? rawSymbols
    : Array.isArray(baseSymbols)
      ? baseSymbols
      : DEFAULT_SLOTS_CONFIG.symbols;
  const trimmed = source.slice(0, MAX_SYMBOLS);
  const out = trimmed.map((s, i) => sanitizeSymbol(s, (baseSymbols && baseSymbols[i]) || null));
  while (out.length < MIN_SYMBOLS) out.push(centreDefaultSymbol());
  return out;
}

function sanitizeStyle(raw, baseStyle) {
  const base = baseStyle || DEFAULT_SLOTS_CONFIG.style;
  if (raw == null || typeof raw !== 'object') return { ...base };
  const vol = (k) =>
    roundTo(clampNumber(k in raw ? raw[k] : base[k], 0, 1, base[k]), 2);
  return {
    panel: bool(raw.panel, base.panel),
    panelColor: sanitizeColor(raw.panelColor, base.panelColor),
    panelOpacity: roundTo(
      clampNumber('panelOpacity' in raw ? raw.panelOpacity : base.panelOpacity, 0, 1, base.panelOpacity),
      2,
    ),
    reelColor: sanitizeColor(raw.reelColor, base.reelColor),
    textColor: sanitizeColor(raw.textColor, base.textColor),
    showStatus: bool(raw.showStatus, base.showStatus),
    reelSound: bool(raw.reelSound, base.reelSound),
    reelSoundVolume: vol('reelSoundVolume'),
    winSound: bool(raw.winSound, base.winSound),
    winSoundVolume: vol('winSoundVolume'),
  };
}

/**
 * Merge a partial patch onto a base config and clamp every field. Never throws.
 */
export function sanitizeSlotsConfig(patch, base = DEFAULT_SLOTS_CONFIG) {
  const b = clone(base);
  const p = patch && typeof patch === 'object' ? patch : {};
  return {
    baseSeconds: Math.floor(
      clampNumber('baseSeconds' in p ? p.baseSeconds : b.baseSeconds, MIN_BASE_SECONDS, MAX_BASE_SECONDS, b.baseSeconds),
    ),
    symbols: sanitizeSymbols(p.symbols, b.symbols),
    anyTwoMultiplier: roundTo(
      clampNumber('anyTwoMultiplier' in p ? p.anyTwoMultiplier : b.anyTwoMultiplier, MIN_MULT, MAX_MULT, b.anyTwoMultiplier),
      2,
    ),
    noMatchMultiplier: roundTo(
      clampNumber('noMatchMultiplier' in p ? p.noMatchMultiplier : b.noMatchMultiplier, MIN_MULT, MAX_MULT, b.noMatchMultiplier),
      2,
    ),
    triggerSoundId:
      'triggerSoundId' in p
        ? (typeof p.triggerSoundId === 'string' ? p.triggerSoundId.slice(0, 64) : '')
        : (typeof b.triggerSoundId === 'string' ? b.triggerSoundId : ''),
    style: sanitizeStyle(p.style, b.style),
  };
}

// --- seeded PRNG (xmur3 -> mulberry32), kept private like plinko.js -----------
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}
function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedPick(symbols, r) {
  const total = symbols.reduce((s, x) => s + (x.weight || 1), 0) || symbols.length;
  let x = r * total;
  for (let i = 0; i < symbols.length; i++) {
    x -= symbols[i].weight || 1;
    if (x < 0) return i;
  }
  return symbols.length - 1;
}

/**
 * One spin: seeded weighted pick per reel, then resolve the match to a
 * multiplier and the seconds to add. The route layer does auth + queue +
 * addSeconds around this.
 * @returns {{ reels:number[], matchKind:'triple'|'pair'|'none', multiplier:number, secondsToAdd:number }}
 */
export function computeSlotsSpin(config, { seed = '' } = {}) {
  const rand = mulberry32(xmur3(String(seed))());
  const symbols = config.symbols;
  const reels = [
    weightedPick(symbols, rand()),
    weightedPick(symbols, rand()),
    weightedPick(symbols, rand()),
  ];
  const [a, b, c] = reels;
  let matchKind;
  let multiplier;
  if (a === b && b === c) {
    matchKind = 'triple';
    multiplier = symbols[a].tripleMultiplier;
  } else if (a === b || b === c || a === c) {
    matchKind = 'pair';
    multiplier = config.anyTwoMultiplier;
  } else {
    matchKind = 'none';
    multiplier = config.noMatchMultiplier;
  }
  return { reels, matchKind, multiplier, secondsToAdd: Math.floor(config.baseSeconds * multiplier) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ebs && node --test slots.test.js`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add ebs/slots.js ebs/slots.test.js
git commit -m "feat(slots): pure core — config, sanitizer, seeded spin

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `ebs/slots_store.js` per-broadcaster store

**Files:**
- Create: `ebs/slots_store.js`
- Test: `ebs/slots_store.test.js`

**Interfaces:**
- Consumes: `DEFAULT_SLOTS_CONFIG`, `sanitizeSlotsConfig` from `./slots.js`; `atomicWriteFile` from `./atomic_write.js`.
- Produces: `loadSlotsConfig()`, `getSlotsConfig(uid)`, `setSlotsConfig(uid, patch)`, `deleteSlotsConfig(uid)` — signatures identical to the `plinko_store.js` equivalents. `SLOTS_PATH = path.resolve(DATA_DIR, 'overlay-slots.json')`.

- [ ] **Step 1: Write the failing test**

Create `ebs/slots_store.test.js` (mirrors `plinko_store.test.js`):

```js
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

let dir;
let store;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'slots-store-'));
  process.env.DATA_DIR = dir;
  store = await import(`./slots_store.js?d=${encodeURIComponent(dir)}`);
  await store.loadSlotsConfig();
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

test('getSlotsConfig returns the default for an unknown user', async () => {
  const { getSlotsConfig } = store;
  const { DEFAULT_SLOTS_CONFIG } = await import('./slots.js');
  assert.deepEqual(getSlotsConfig('nobody'), DEFAULT_SLOTS_CONFIG);
});

test('setSlotsConfig sanitizes, merges, persists, and returns the saved config', async () => {
  const { setSlotsConfig, getSlotsConfig } = store;
  const saved = setSlotsConfig('u1', { baseSeconds: 45, anyTwoMultiplier: 2 });
  assert.equal(saved.baseSeconds, 45);
  assert.equal(saved.anyTwoMultiplier, 2);
  assert.deepEqual(getSlotsConfig('u1'), saved);
  const raw = JSON.parse(await readFile(path.join(dir, 'overlay-slots.json'), 'utf-8'));
  assert.equal(raw.u1.baseSeconds, 45);
});

test('a partial patch keeps untouched fields', async () => {
  const { setSlotsConfig } = store;
  setSlotsConfig('u2', { baseSeconds: 20 });
  const after = setSlotsConfig('u2', { anyTwoMultiplier: 3 });
  assert.equal(after.baseSeconds, 20);
  assert.equal(after.anyTwoMultiplier, 3);
});

test('setSlotsConfig throws without a broadcaster id', () => {
  assert.throws(() => store.setSlotsConfig('', {}));
});

test('deleteSlotsConfig removes and reports', async () => {
  const { setSlotsConfig, deleteSlotsConfig, getSlotsConfig } = store;
  setSlotsConfig('u3', { baseSeconds: 12 });
  assert.equal(deleteSlotsConfig('u3'), true);
  assert.equal(deleteSlotsConfig('u3'), false);
  const { DEFAULT_SLOTS_CONFIG } = await import('./slots.js');
  assert.deepEqual(getSlotsConfig('u3'), DEFAULT_SLOTS_CONFIG);
});

test('loadSlotsConfig re-hydrates and re-sanitizes from disk', async () => {
  store.setSlotsConfig('u4', { baseSeconds: 77 });
  await new Promise((r) => setTimeout(r, 20));
  const fresh = await import(`./slots_store.js?d=${encodeURIComponent(dir)}&x=2`);
  await fresh.loadSlotsConfig();
  assert.equal(fresh.getSlotsConfig('u4').baseSeconds, 77);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ebs && node --test slots_store.test.js`
Expected: FAIL — `Cannot find module './slots_store.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `ebs/slots_store.js` — copy `ebs/plinko_store.js` verbatim and mechanically rename: `PLINKO`→`SLOTS`, `Plinko`→`Slots`, `plinko`→`slots`, `overlay-plinko.json`→`overlay-slots.json`, import from `./slots.js`. Result:

```js
import { readFile } from 'fs/promises';
import path from 'path';
import { atomicWriteFile } from './atomic_write.js';
import { DEFAULT_SLOTS_CONFIG, sanitizeSlotsConfig } from './slots.js';

const DATA_DIR = process.env.DATA_DIR || process.cwd();
const SLOTS_PATH = path.resolve(DATA_DIR, 'overlay-slots.json');

let byUser = {};
let persistChain = Promise.resolve();

export async function loadSlotsConfig() {
  try {
    const raw = await readFile(SLOTS_PATH, 'utf-8');
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object') {
      const next = {};
      for (const [uid, cfg] of Object.entries(obj)) {
        next[String(uid)] = sanitizeSlotsConfig(cfg || {}, DEFAULT_SLOTS_CONFIG);
      }
      byUser = next;
    }
  } catch {
    /* no file yet */
  }
}

export function persistSlotsConfig() {
  const snapshot = JSON.stringify(byUser, null, 2);
  persistChain = persistChain
    .catch(() => {})
    .then(() => atomicWriteFile(SLOTS_PATH, snapshot))
    .catch(() => {});
  return persistChain;
}

export function getSlotsConfig(uid) {
  const id = uid ? String(uid) : null;
  const stored = id && byUser[id] ? byUser[id] : DEFAULT_SLOTS_CONFIG;
  return sanitizeSlotsConfig({}, stored);
}

export function setSlotsConfig(uid, patch = {}) {
  const id = String(uid || '').trim();
  if (!id) throw new Error('Broadcaster id required');
  const curr = byUser[id] || DEFAULT_SLOTS_CONFIG;
  const next = sanitizeSlotsConfig(patch || {}, curr);
  byUser[id] = next;
  persistSlotsConfig().catch(() => {});
  return sanitizeSlotsConfig({}, next);
}

export function deleteSlotsConfig(uid) {
  const id = String(uid || '').trim();
  if (!id) return false;
  const existed = id in byUser;
  delete byUser[id];
  if (existed) persistSlotsConfig().catch(() => {});
  return existed;
}
```

Note: `DATA_DIR` is read at module load. The test's `?d=` query on each import gives a fresh module bound to that test's tmp dir.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ebs && node --test slots_store.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Run both new test files + the full suite**

Run: `cd ebs && node --test slots.test.js slots_store.test.js && npm test`
Expected: all green; the suite total goes up by 16.

- [ ] **Step 6: Commit**

```bash
git add ebs/slots_store.js ebs/slots_store.test.js
git commit -m "feat(slots): per-broadcaster config store

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `ebs/views/slotsOverlayPage.js` OBS overlay

**Files:**
- Create: `ebs/views/slotsOverlayPage.js`

**Interfaces:**
- Consumes: nothing at import time (pure string builder).
- Produces: `renderSlotsOverlayPage() => string` — a full self-contained HTML document.

**Reference:** open `ebs/views/plinkoOverlayPage.js` and follow its structure exactly (single template literal, inline `<style>`, one IIFE `<script>`, `connectSSE()` with 4s→×2→60s backoff reconnect, a `FALLBACK` style object merged under `board.style`, late-join handled by the server replaying cached events). The deltas from Plinko:

- **No canvas.** Three DOM reels: a `.slots-stage` flex row of three `.reel` elements, each containing a `.reel-strip` (`transform: translateY`) built from repeated `<img>` cells. Stage size **540 × 220**.
- **Query params:** `key` (required), `boardId` (optional), optional base64 `config` (`{ symbols, style, baseSeconds }`) for idle look before the first spin — same parsing as Plinko's `config` param.
- **SSE listeners:**
  - `slots_spin` → `handleSpin(payload)`: build/refresh each reel strip from `payload.symbols`, start all three scrolling, then stop reel *i* at `[1400, 1900, 2400][i]` ms easing onto `payload.reels[i]`; play the reel-stop sound as each stops (`style.reelSound`, `Audio('/assets/slots_reel_stop.mp3')` pool of 3, volume `style.reelSoundVolume`); when the last stops, if `payload.matchKind !== 'none'` flash the matched cells + panel and play `Audio('/assets/slots_win.wav')` (`style.winSound`, `style.winSoundVolume`); float `+{payload.secondsAdded}s` for 2500ms unless `payload.test`; then fade to idle.
  - `slots_board` → `applyBoard(payload)`: merge `symbols` / `style` / `baseSeconds`, rebuild idle reels, redraw.
  - `slots_queue` → `queueInfo = JSON.parse(...)`; if `style.showStatus` and (`queueInfo.nowPlaying` or `queueInfo.waitingCount`), draw a top-band header `▶ {nowPlaying.viewerName}` and `next: {waiting[0].viewerName}{waiting.length>1 ? '  +'+(waiting.length-1)+' more' : ''}`.
- **Style application:** panel background = `style.panelColor` at `style.panelOpacity` (only when `style.panel`); `.reel` background = `style.reelColor`; all text = `style.textColor`.
- **Idle state:** reels show `symbols[0..2]` (or blanks if a symbol has no `url`), a muted "Waiting for a spin…" line when `style.showStatus`.
- A resting spin fades ~2.5s after it finishes if no further spin arrives (mirror Plinko's `restingTimer` / `fadeResting`, cancelled by the next `handleSpin`).

- [ ] **Step 1: Write the file**

Create `ebs/views/slotsOverlayPage.js` per the reference above. It is one `export function renderSlotsOverlayPage() { return \`<!doctype html>…\`; }`.

- [ ] **Step 2: Syntax check**

Run: `cd ebs && node --check views/slotsOverlayPage.js`
Expected: no output.

- [ ] **Step 3: Render + inline-script check**

Run:
```bash
cd ebs && node -e "
import('./views/slotsOverlayPage.js').then(m => {
  const h = m.renderSlotsOverlayPage();
  const okDoc = h.startsWith('<!doctype html>') && h.includes('</html>');
  const okSse = h.includes('/api/overlay/stream') && h.includes(\"addEventListener('slots_spin'\") && h.includes(\"addEventListener('slots_board'\") && h.includes(\"addEventListener('slots_queue'\");
  const okAssets = h.includes('/assets/slots_reel_stop.mp3') && h.includes('/assets/slots_win.wav');
  const m2 = h.match(/<script>([\s\S]*?)<\/script>/g) || [];
  m2.forEach((blk, i) => { try { new Function(blk.replace(/<\/?script>/g,'')); } catch (e) { console.log('SCRIPT', i, 'INVALID', e.message); process.exit(1); } });
  console.log(okDoc, okSse, okAssets, 'scripts:', m2.length);
});
"
```
Expected: `true true true scripts: <n>` (no `SCRIPT … INVALID`).

- [ ] **Step 4: Run the full suite**

Run: `cd ebs && npm test`
Expected: unchanged (no new tests here); all green.

- [ ] **Step 5: Commit**

```bash
git add ebs/views/slotsOverlayPage.js
git commit -m "feat(slots): OBS overlay browser source

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: `server.js` — imports, module block, boot load

**Files:**
- Modify: `ebs/server.js`

**Interfaces:**
- Consumes: Task 1/2 exports; `createPlinkoQueue` (already imported).
- Produces: module-scoped `lastSlotsSpinByKey`, `lastSlotsBoardByKey`, `lastSlotsQueueByKey` `Map`s and `slotsQueue`; `loadSlotsConfig()` fired at boot. `playSlotsSpin` / `broadcastSlotsQueue` are referenced here but declared in Task 5 (hoisted function declarations, exactly like `playPlinkoDrop`).

- [ ] **Step 1: Add imports**

After `import { computePlinkoDrop } from "./plinko.js";` (line ~67) add:
```js
import { getSlotsConfig, setSlotsConfig, loadSlotsConfig } from "./slots_store.js";
import { computeSlotsSpin, SLOTS_DURATION_MS } from "./slots.js";
```

- [ ] **Step 2: Add the module block**

Immediately after the `const plinkoQueue = createPlinkoQueue({ … });` block (ends line ~289) add:
```js
const lastSlotsSpinByKey = new Map();
const lastSlotsBoardByKey = new Map();
const lastSlotsQueueByKey = new Map();
const slotsQueue = createPlinkoQueue({
  play: (item) => playSlotsSpin(item),
  onChange: (channelId) => broadcastSlotsQueue(channelId),
});
```

- [ ] **Step 3: Boot load**

After `loadPlinkoConfig().catch(() => {});` (line ~326) add:
```js
loadSlotsConfig().catch(() => {});
```

- [ ] **Step 4: Syntax check**

Run: `cd ebs && node --check server.js`
Expected: no output. (A `playSlotsSpin`/`broadcastSlotsQueue` "not defined" would only surface at runtime; they are added in Task 5 before any dispatch. `node --check` passes because they're function *declarations*.)

- [ ] **Step 5: Commit**

```bash
git add ebs/server.js
git commit -m "feat(slots): server module wiring (queue, caches, boot load)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: `server.js` — `fanOutSlotsSpin` / `broadcastSlotsQueue` / `playSlotsSpin` / `fireSlotsSpin`

**Files:**
- Modify: `ebs/server.js`

**Interfaces:**
- Consumes: `computeSlotsSpin`, `SLOTS_DURATION_MS`, `getSlotsConfig`, `slotsQueue`, `lastSlots*ByKey`, `sseClients`, `normKey`, `getOrCreateUserKey`, `getRemainingSeconds`, `addSeconds`, `addLogEntry`, `broadcastToChannel`, `observability`, `state`, `uuidv4`.
- Produces: `fireSlotsSpin({ uid, overlayKey, boardId='', test=false, source='manual', viewerName='' }) => payload` (used by Task 6 route + Task 7 trigger); `fanOutSlotsSpin`, `broadcastSlotsQueue`, `playSlotsSpin` (function declarations, hoisted).

- [ ] **Step 1: Add the four functions**

Immediately after `firePlinkoDrop` and before `app.post("/api/plinko/drop", …)` (line ~996) add — this is `playPlinkoDrop` / `firePlinkoDrop` / `fanOutPlinkoDrop` / `broadcastPlinkoQueue` reshaped for slots:

```js
// --- Slots ------------------------------------------------------------------

function fanOutSlotsSpin(overlayKey, boardId, payload) {
  for (const client of Array.from(sseClients)) {
    if (!client || client.key !== overlayKey) continue;
    if (boardId && client.boardId && client.boardId !== boardId) continue;
    try {
      client.res.write("event: slots_spin\n");
      client.res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

function broadcastSlotsQueue(channelId) {
  let overlayKey = "";
  try {
    overlayKey = normKey(getOrCreateUserKey(String(channelId)));
  } catch {
    return;
  }
  if (!overlayKey) return;
  const snap = slotsQueue.snapshot(channelId);
  lastSlotsQueueByKey.set(overlayKey, snap);
  const data = JSON.stringify(snap);
  for (const client of Array.from(sseClients)) {
    if (!client || client.key !== overlayKey) continue;
    try {
      client.res.write("event: slots_queue\n");
      client.res.write(`data: ${data}\n\n`);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

function playSlotsSpin(item) {
  const {
    uid, overlayKey, boardId, payload, durationMs, secondsToAdd,
    matchKind, multiplier, baseSeconds,
  } = item;
  const cacheKey = boardId ? `${overlayKey}:${boardId}` : overlayKey;
  lastSlotsSpinByKey.set(cacheKey, payload);
  fanOutSlotsSpin(overlayKey, boardId, payload);

  if (secondsToAdd > 0) {
    setTimeout(() => {
      try {
        const before = getRemainingSeconds(uid);
        const remaining = addSeconds(uid, secondsToAdd);
        const actual = Math.max(0, remaining - before);
        observability.lastTimerMutationAt = new Date().toISOString();
        addLogEntry({
          type: "slots_spin",
          source: item.source || "manual",
          baseSeconds,
          multiplier,
          matchKind,
          appliedSeconds: secondsToAdd,
          actualSeconds: actual,
          userName:
            item.viewerName && item.viewerName !== "Streamer" ? item.viewerName : undefined,
          userId: uid,
        });
        broadcastToChannel({
          broadcasterId: uid,
          type: "timer_add",
          payload: {
            userId: uid,
            secondsAdded: actual,
            newRemaining: remaining,
            hype: state.users.get(String(uid))?.hypeActive,
          },
        }).catch(() => {});
      } catch (e) {
        logger.warn("slots_spin_credit_failed", { userId: uid, message: e?.message });
      }
    }, durationMs);
  }
}

// Single entry point for a spin — used by the manual route and the sound trigger.
// `test` fires animate immediately and never queue or touch the timer.
function fireSlotsSpin({
  uid,
  overlayKey,
  boardId = "",
  test = false,
  source = "manual",
  viewerName = "",
}) {
  const cfg = getSlotsConfig(uid);
  const seed = uuidv4();
  const { reels, matchKind, multiplier, secondsToAdd } = computeSlotsSpin(cfg, { seed });
  const durationMs = SLOTS_DURATION_MS;
  const payload = {
    spinId: seed,
    boardId,
    reels,
    symbols: cfg.symbols.map((s) => s.emote),
    matchKind,
    multiplier,
    baseSeconds: cfg.baseSeconds,
    style: cfg.style,
    secondsAdded: test ? 0 : secondsToAdd,
    source,
    test,
    durationMs,
    triggeredAt: new Date().toISOString(),
  };

  if (test) {
    fanOutSlotsSpin(overlayKey, boardId, payload);
    return payload;
  }

  const { accepted } = slotsQueue.enqueue(uid, {
    uid,
    overlayKey,
    boardId,
    payload,
    durationMs,
    secondsToAdd,
    matchKind,
    multiplier,
    baseSeconds: cfg.baseSeconds,
    viewerName: viewerName || "Someone",
    source,
  });
  if (!accepted) {
    logger.warn("slots_spin_rejected", { userId: uid, source, reason: "queue_full" });
  }
  return payload;
}
```

- [ ] **Step 2: Syntax check**

Run: `cd ebs && node --check server.js`
Expected: no output.

- [ ] **Step 3: Full suite**

Run: `cd ebs && npm test`
Expected: all green (no new tests).

- [ ] **Step 4: Commit**

```bash
git add ebs/server.js
git commit -m "feat(slots): server spin engine (fire/queue/play/fan-out)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: `server.js` — `/api/slots/config` and `/api/slots/spin` routes

**Files:**
- Modify: `ebs/server.js`

**Interfaces:**
- Consumes: `getSlotsConfig`, `setSlotsConfig`, `fireSlotsSpin`, `resolveTimerUserIdFromRequest`, `normKey`, `lastSlotsBoardByKey`, `lastSlotsSpinByKey`, `sseClients`, `logger`.
- Produces: `GET /api/slots/config`, `POST /api/slots/config`, `POST /api/slots/spin`.

- [ ] **Step 1: Add the config routes**

Immediately after the `POST /api/plinko/config` handler's closing `});` (line ~842) add — this is the Plinko config pair with `Plinko`→`Slots`, `plinko_board`→`slots_board`, and the board payload swapped to `{ symbols, style, baseSeconds }`:

```js
app.get("/api/slots/config", (req, res) => {
  if (!req?.session?.isAdmin)
    return res.status(401).json({ error: "Admin login required" });
  const uid = resolveTimerUserIdFromRequest(req);
  if (!uid) return res.status(400).json({ error: "No broadcaster in session" });
  res.json(getSlotsConfig(uid));
});

app.post("/api/slots/config", (req, res) => {
  if (!req?.session?.isAdmin)
    return res.status(401).json({ error: "Admin login required" });
  const uid = resolveTimerUserIdFromRequest(req);
  if (!uid) return res.status(400).json({ error: "No broadcaster in session" });
  try {
    const saved = setSlotsConfig(uid, req.body || {});
    logger.info("slots_config_saved", { requestId: req.requestId, broadcasterId: uid });
    res.json(saved);

    const overlayKey = normKey(req.session?.userOverlayKey || "");
    if (overlayKey) {
      const boardPayload = { symbols: saved.symbols.map((s) => s.emote), style: saved.style, baseSeconds: saved.baseSeconds };
      lastSlotsBoardByKey.set(overlayKey, boardPayload);
      for (const [ck, spinPayload] of lastSlotsSpinByKey) {
        if (ck === overlayKey || ck.startsWith(overlayKey + ":")) {
          Object.assign(spinPayload, boardPayload);
        }
      }
      for (const client of Array.from(sseClients)) {
        if (!client || client.key !== overlayKey) continue;
        try {
          client.res.write("event: slots_board\n");
          client.res.write(`data: ${JSON.stringify(boardPayload)}\n\n`);
        } catch (e) {
          sseClients.delete(client);
        }
      }
    }
  } catch (e) {
    res.status(400).json({ error: "Invalid Slots config" });
  }
});
```

- [ ] **Step 2: Add the spin route**

Immediately after the `POST /api/plinko/drop` handler's closing `});` (find it — it `res.json(payload)` then `});`), add:

```js
app.post("/api/slots/spin", (req, res) => {
  if (!req?.session?.isAdmin)
    return res.status(401).json({ error: "Admin login required" });
  const overlayKey = normKey(
    req.body?.overlayKey || req.query.key || req.session?.userOverlayKey || ""
  );
  if (!overlayKey) return res.status(400).json({ error: "Overlay key is required" });
  const uid = resolveTimerUserIdFromRequest(req);
  if (!uid) return res.status(400).json({ error: "No broadcaster in session" });

  const payload = fireSlotsSpin({
    uid,
    overlayKey,
    boardId: typeof req.body?.boardId === "string" ? req.body.boardId.trim() : "",
    test: Boolean(req.body?.test),
    source: "manual",
    viewerName: "Streamer",
  });
  res.json(payload);
});
```

- [ ] **Step 3: Syntax check + boot smoke**

Run: `cd ebs && node --check server.js`
Expected: no output.

- [ ] **Step 4: Full suite**

Run: `cd ebs && npm test`
Expected: all green.

- [ ] **Step 5: Manual verification (server + curl)**

```bash
cd ebs && node server.js   # wait for "listening"
```
Without a session cookie: `curl -s -X POST localhost:8080/api/slots/spin` → `{"error":"Admin login required"}` (401). `curl -s localhost:8080/api/slots/config` → 401. Confirms the routes are mounted and gated. Ctrl-C.

- [ ] **Step 6: Commit**

```bash
git add ebs/server.js
git commit -m "feat(slots): /api/slots/config + /api/slots/spin routes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: `server.js` — SSE late-join replay + sound-alert trigger

**Files:**
- Modify: `ebs/server.js`

**Interfaces:**
- Consumes: `lastSlotsSpinByKey`, `lastSlotsBoardByKey`, `lastSlotsQueueByKey`, `getSlotsConfig`, `fireSlotsSpin`, `fetchUserDisplayName`, `normKey`, `getOrCreateUserKey`.

- [ ] **Step 1: Add the SSE replay block**

In the `/api/overlay/stream` connect handler, immediately after the `lastPlinkoQ` replay block (line ~1196, the one that writes `event: plinko_queue`), add — mirroring it, `plinko`→`slots`, board sent last:

```js
  const slotsCacheKey = boardId ? `${key}:${boardId}` : key;
  const lastSlots = lastSlotsSpinByKey.get(slotsCacheKey);
  if (lastSlots) {
    res.write("event: slots_spin\n");
    res.write(`data: ${JSON.stringify(lastSlots)}\n\n`);
  }
  const lastSlotsBoard = lastSlotsBoardByKey.get(key);
  if (lastSlotsBoard) {
    res.write("event: slots_board\n");
    res.write(`data: ${JSON.stringify(lastSlotsBoard)}\n\n`);
  }
  const lastSlotsQ = lastSlotsQueueByKey.get(key);
  if (lastSlotsQ) {
    res.write("event: slots_queue\n");
    res.write(`data: ${JSON.stringify(lastSlotsQ)}\n\n`);
  }
```

(`boardId` and `key` are already in scope in this handler — the Plinko block above uses them.)

- [ ] **Step 2: Add the sound-alert trigger branch**

In `handleSoundAlert`, immediately after the Plinko trigger block's closing `}` (the `if (!isTestAlert) { const pk = getPlinkoConfig(...) … }` block ends around line 1633, just before `}` that closes `handleSoundAlert`), add:

```js
  // Auto-spin the slot machine if this sound is its configured trigger. Same
  // rules as the Plinko trigger: Bits/Channel Points reach here, test fires
  // don't; the spin's time is a bonus on top of the sound's own Bits time.
  if (!isTestAlert) {
    const sk = getSlotsConfig(String(channelId));
    if (sk.triggerSoundId && String(soundId) === sk.triggerSoundId) {
      (async () => {
        let viewerName = "";
        if (viewerUserId) {
          viewerName =
            (await fetchUserDisplayName(viewerUserId, channelId).catch(() => "")) || "";
        }
        fireSlotsSpin({
          uid: String(channelId),
          overlayKey: normKey(getOrCreateUserKey(String(channelId))),
          source: "sound_alert",
          viewerName: viewerName || viewerUserId || "Someone",
        });
      })().catch(() => {});
    }
  }
```

- [ ] **Step 3: Syntax check**

Run: `cd ebs && node --check server.js`
Expected: no output.

- [ ] **Step 4: Full suite + boot**

Run: `cd ebs && npm test && node --check server.js`
Expected: all green. Optionally boot `node server.js`, confirm no error at startup, Ctrl-C.

- [ ] **Step 5: Commit**

```bash
git add ebs/server.js
git commit -m "feat(slots): SSE late-join replay + sound-alert trigger

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: `/overlay/slots` route + `slotsOverlayBase` wiring

**Files:**
- Modify: `ebs/routes_overlay_page.js`
- Modify: `ebs/routes_home_page.js`

**Interfaces:**
- Consumes: `renderSlotsOverlayPage` (Task 3); `requireOverlayAuth` (already a dep in `routes_overlay_page.js`).
- Produces: `GET /overlay/slots`; `renderUtilitiesPage` now receives `slotsOverlayBase: "/overlay/slots"`.

- [ ] **Step 1: `routes_overlay_page.js`**

Add the import next to `import { renderPlinkoOverlayPage } from "./views/plinkoOverlayPage.js";` (line ~6):
```js
import { renderSlotsOverlayPage } from "./views/slotsOverlayPage.js";
```
Immediately after the `app.get("/overlay/plinko", …)` handler's closing `});` (line ~68) add:
```js
  app.get("/overlay/slots", (req, res) => {
    if (!requireOverlayAuth(req, res)) return;
    const html = renderSlotsOverlayPage();
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.send(html);
  });
```

- [ ] **Step 2: `routes_home_page.js`**

In the `GET /utilities` handler, next to `const plinkoOverlayBase = \`/overlay/plinko\`;` (line ~182) add:
```js
    const slotsOverlayBase = `/overlay/slots`;
```
and add `slotsOverlayBase,` to the `renderUtilitiesPage({ … })` argument object (next to `plinkoOverlayBase,`).

- [ ] **Step 3: Checks**

Run:
```bash
cd ebs && node --check routes_overlay_page.js && node --check routes_home_page.js && npm test
```
Expected: clean; all green.

- [ ] **Step 4: Commit**

```bash
git add ebs/routes_overlay_page.js ebs/routes_home_page.js
git commit -m "feat(slots): /overlay/slots route + utilities wiring

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: `ebs/views/utilitiesPage.js` — "Slots" Extras section

**Files:**
- Modify: `ebs/views/utilitiesPage.js`

**Interfaces:**
- Consumes: `options.slotsOverlayBase` (Task 8); the emote endpoints `GET /api/sounds/twitch-emotes` + `/api/sounds/seventv-emotes`; `GET /api/sounds`; `GET/POST /api/slots/config`; `POST /api/slots/spin`; the `slots_spin` / `slots_queue` SSE events on `/api/overlay/stream`.
- Produces: a new `data-section="slots"` section and its sidebar nav item.

**Reference:** the existing `data-section="plinko"` section in this file (nav button ~line 189, section markup ~line 233, its JS IIFE ~line 1217). Mirror it. Deltas:

- **Nav:** add `<button class="sidebar-nav-item" data-section="slots">Slots</button>` immediately after the Plinko nav button (order: Plinko, Slots, Wheels, Quick Tools). Plinko stays `active`; the Slots button is not `active`.
- **`switchSection` fire-once map** (line ~382): add `slots: 'slots'` so `lshFeatureOnce({ …, slots: 'slots' }[sectionId])` is called — but only if a `slots` feature key already exists in the analytics catalog; if `lshFeatureOnce` is called with an unknown key it is a harmless no-op, so add `slots: 'slots'` regardless.
- **Section markup** (`<div class="section-page" data-section="slots">`, not `active`), placed right after the Plinko section's closing `</div>`:
  - **Board settings card:** `baseSeconds` number input (`id="slotsBaseSeconds"`); a symbols list `<div id="slotsSymbols">` where each row has: an emote-pick button (opens `<div id="slotsEmoteGrid" hidden>` populated from the two emote endpoints), the chosen emote thumbnail + name, a `weight` number input, a `tripleMultiplier` number input (min 1), a remove button; an `<button id="slotsAddSymbol">Add symbol</button>` (disable at 8 rows, keep ≥ 2); `anyTwoMultiplier` input (`id="slotsAnyTwo"`, min 1); `noMatchMultiplier` input (`id="slotsNoMatch"`, min 1); an "Auto-spin on sound alert" `<select id="slotsTriggerSound">` populated from `GET /api/sounds` (blank option = off) with a `<span id="slotsTriggerWarn">` that shows *"This sound already triggers Plinko"* when the selected value equals the Plinko trigger (read it from the `GET /api/plinko/config` response — fetch it alongside); overlay-style controls (`slotsStylePanel`, `slotsStylePanelColor`, `slotsStylePanelOpacity`, `slotsStyleReelColor`, `slotsStyleTextColor`, `slotsStyleShowStatus`, `slotsStyleReelSound`, `slotsStyleReelSoundVol`, `slotsStyleWinSound`, `slotsStyleWinSoundVol`); `<button id="slotsSaveBtn">Save</button>` + `<span id="slotsSaveStatus">`.
  - **Spin card:** `<button id="slotsSpinBtn">Spin</button>`, `<button id="slotsTestBtn">Test</button>`, `<span id="slotsSpinStatus">`; a live queue panel `<div id="slotsQueuePanel">` / `#slotsQueueNow` / `#slotsQueueNext`; a small DOM preview `<div id="slotsPreview">` (3 mini reels); a "Copy Browser Source link" row: `<button id="slotsCopyBtn">` + `<span id="slotsCopyStatus">` + a `540 × 220` size hint.
- **JS IIFE** (mirror the Plinko one; add it after the Plinko IIFE): `var slotsOverlayBase = ${JSON.stringify(slotsOverlayBase)};` and `var SLOTS_BOARD_ID = 'default';`. Functions:
  - `loadConfig()` — `Promise.all([fetch('/api/slots/config'), fetch('/api/sounds'), fetch('/api/plinko/config')])`, populate every input + the symbols list + the trigger `<select>`; wire the Plinko-trigger warning.
  - `formPayload()` — read every input into the `{ baseSeconds, symbols:[{emote,weight,tripleMultiplier}], anyTwoMultiplier, noMatchMultiplier, triggerSoundId, style:{…} }` shape.
  - `save()` — `POST /api/slots/config` with `formPayload()`, on `.ok` set status "Saved" and re-apply the returned config.
  - `spin(opts)` — `POST /api/slots/spin` with `{ test: !!opts.test }`; `busy` guard.
  - `renderQueue(snap)` — fill `#slotsQueueNow` / `#slotsQueueNext` from `{ nowPlaying, waiting, waitingCount }`.
  - `animatePreview(payload)` — replay `payload.reels` onto the 3 mini reels (no timer text needed).
  - `connectSlotsStream()` — `new EventSource('/api/overlay/stream?key=' + encodeURIComponent(overlayShareKey))`, `addEventListener('slots_spin', e => animatePreview(JSON.parse(e.data)))`, `addEventListener('slots_queue', e => renderQueue(JSON.parse(e.data)))`, reconnect on error after 5s.
  - Copy button: `var rel = slotsOverlayBase + '?key=' + encodeURIComponent(overlayShareKey) + '&boardId=' + SLOTS_BOARD_ID; var full = /^https?:/i.test(slotsOverlayBase) ? rel : window.location.origin + rel;` then `navigator.clipboard.writeText(full)` → "Copied!" / "Copy failed".

- [ ] **Step 1: Edit the file** per the reference above.

- [ ] **Step 2: Syntax + render check**

Run:
```bash
cd ebs && node --check views/utilitiesPage.js && node -e "
import('./views/utilitiesPage.js').then(m => {
  const h = m.renderUtilitiesPage({ overlayKey:'k', wheelOverlayBase:'/overlay/wheel', promptOverlayBase:'/overlay/prompt', plinkoOverlayBase:'/overlay/plinko', slotsOverlayBase:'/overlay/slots' });
  const nav = h.indexOf('data-section=\"slots\">Slots');
  const plinkoNav = h.indexOf('data-section=\"plinko\">Plinko');
  console.log('slots nav after plinko nav:', plinkoNav > 0 && nav > plinkoNav);
  console.log('slots section + ids:', h.includes('data-section=\"slots\"'), h.includes('id=\"slotsSaveBtn\"'), h.includes('id=\"slotsSpinBtn\"'), h.includes('id=\"slotsCopyBtn\"'), h.includes('/api/slots/config'), h.includes('/api/slots/spin'));
  const scripts = h.match(/<script>([\s\S]*?)<\/script>/g) || [];
  scripts.forEach((blk,i)=>{ try { new Function(blk.replace(/<\/?script>/g,'')); } catch(e){ console.log('SCRIPT',i,'INVALID',e.message); process.exit(1); } });
  console.log('scripts ok:', scripts.length);
});
"
```
Expected: `slots nav after plinko nav: true`; `slots section + ids: true true true true true true`; no `SCRIPT … INVALID`.

- [ ] **Step 3: Full suite**

Run: `cd ebs && npm test`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add ebs/views/utilitiesPage.js
git commit -m "feat(slots): Extras section (config, spin, preview, copy link)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: `ebs/views/dashboardPage.js` — Slots card

**Files:**
- Modify: `ebs/views/dashboardPage.js`

**Interfaces:**
- Consumes: the `overlays` array + `keyQs`.
- Produces: a Slots entry rendered as a full overlay card next to Plinko.

- [ ] **Step 1: Add the entry**

In the `overlays` array, immediately after the Plinko entry (the one with `tag: "Plinko"`), add:
```js
    {
      tag: "Slots",
      title: "Slot Machine overlay",
      desc: "Viewers spin a 3-reel slot — matched symbols multiply the time added to your subathon timer.",
      url: `${base}/overlay/slots${keyQs}${keyQs ? "&" : "?"}boardId=default`,
      configHref: `${base}/utilities#slots`,
      configLabel: "Open Configurator",
    },
```

- [ ] **Step 2: Render check**

Run:
```bash
cd ebs && node --check views/dashboardPage.js && node -e "
import('./views/dashboardPage.js').then(m => {
  const h = m.renderDashboardPage({ adminName:'A', overlayKey:'abc' });
  console.log(h.includes('Slot Machine overlay'), h.includes('/overlay/slots?key=abc&boardId=default'), h.indexOf('Slot Machine overlay') > h.indexOf('Plinko overlay'));
});
"
```
Expected: `true true true`.

- [ ] **Step 3: Full suite**

Run: `cd ebs && npm test`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add ebs/views/dashboardPage.js
git commit -m "feat(slots): dashboard overlay card

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 11: account-deletion + `.gitignore`

**Files:**
- Modify: `ebs/user_data_deletion.js`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `deleteSlotsConfig` from `./slots_store.js`.
- Produces: `deleteAllUserData` now removes `overlay-slots.json`'s entry and pushes `"slots"`.

- [ ] **Step 1: `user_data_deletion.js`**

Add the import next to `import { deletePlinkoConfig } from "./plinko_store.js";` (line ~10):
```js
import { deleteSlotsConfig } from "./slots_store.js";
```
Immediately after the line `if (deletePlinkoConfig(uid)) deleted.push("plinko");` (line ~76) add:
```js
  // 8c. Slots board config
  if (deleteSlotsConfig(uid)) deleted.push("slots");
```

- [ ] **Step 2: `.gitignore`**

Add a line next to `ebs/overlay-plinko.json`:
```
ebs/overlay-slots.json
```

- [ ] **Step 3: Checks**

Run:
```bash
cd ebs && node --check user_data_deletion.js && npm test && grep -q "overlay-slots.json" ../.gitignore && echo gitignore-ok
```
Expected: clean; all green; `gitignore-ok`.

- [ ] **Step 4: Commit**

```bash
git add ebs/user_data_deletion.js .gitignore
git commit -m "feat(slots): wipe slots config on account deletion; gitignore data file

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Manual E2E (after all tasks, needs a running server + a logged-in broadcaster + an OBS-style browser)

Follow the spec's "Manual E2E" list (steps 1–8): configure symbols/weights/multipliers and Save (file written); open `/overlay/slots?key=<key>&boardId=default`; **Spin** and confirm reels stop L→R and the timer jumps by `floor(baseSeconds × multiplier)` *when the animation finishes*; reload the overlay → last spin replays once; **Test** → no timer change, no log entry; set a trigger sound (not Plinko's) and redeem it → spin fires `source: 'sound_alert'` as a bonus, bursts queue; save a style change → overlay restyles live; delete-user path removes `overlay-slots.json` and reports `"slots"`.

---

## Self-Review

**1. Spec coverage**

| Spec section | Task |
|---|---|
| Config schema + `sanitizeSlotsConfig` clamp table | 1 |
| `computeSlotsSpin` algorithm (weighted pick, match → multiplier, floor) | 1 |
| `slots_store.js` mirrors `plinko_store.js` | 2 |
| `slotsOverlayPage.js` — DOM reels, staggered stops, sounds, `slots_board`/`slots_queue`, late-join, size | 3 |
| server module block (`lastSlots*ByKey`, `slotsQueue`, boot load) | 4 |
| `fanOutSlotsSpin` / `broadcastSlotsQueue` / `playSlotsSpin` (deferred credit + `addLogEntry({type:'slots_spin'})`) / `fireSlotsSpin` | 5 |
| `GET/POST /api/slots/config` (+ `slots_board` broadcast), `POST /api/slots/spin` | 6 |
| SSE late-join replay (spin → board → queue), `handleSoundAlert` trigger branch (bonus, not test) | 7 |
| `GET /overlay/slots`, `slotsOverlayBase` | 8 |
| Extras "Slots" section (symbol editor, multipliers, trigger select + Plinko-trigger warning, style, Spin/Test, queue panel, preview, copy link) | 9 |
| dashboard Slots card next to Plinko | 10 |
| `deleteSlotsConfig` in `deleteAllUserData`; `.gitignore` | 11 |
| Out-of-scope (extension UI, per-reel strips, configurable reel count, press-your-luck, time subtraction, multi-board, re-hosting, bundled audio, shared engine) | not implemented — correct |

No gaps.

**2. Placeholder scan** — Tasks 1, 2, 4–8, 10, 11 carry complete code. Tasks 3 and 9 are large self-contained view files specified as "mirror this exact existing file, with these enumerated deltas" plus concrete ids, event names, timings, and endpoint URLs, and a render/inline-script check that fails loudly — this is the tightest form possible without transcribing ~600 lines of HTML that already exist to copy. No "TBD", no "handle edge cases", no "similar to Task N".

**3. Type consistency** — `computeSlotsSpin` returns `{ reels, matchKind, multiplier, secondsToAdd }`; `fireSlotsSpin` (Task 5) destructures exactly those and never reads a field the function doesn't return. The `slots_spin` payload keys (`spinId, boardId, reels, symbols, matchKind, multiplier, baseSeconds, style, secondsAdded, source, test, durationMs, triggeredAt`) are produced in Task 5 and consumed by the overlay (Task 3) and preview (Task 9) — `symbols` is `cfg.symbols.map(s => s.emote)` in both the payload and the `slots_board` payload (Task 6), so the overlay renders reels the same way for a spin and a restyle. `slotsQueue` items carry `{ durationMs, viewerName, source, … }` — `durationMs` drives `createPlinkoQueue`'s hold and `viewerName`/`source` its `pub`; `playSlotsSpin` reads `matchKind`/`multiplier`/`baseSeconds`/`secondsToAdd` off the same item. `SLOTS_DURATION_MS = 2600` (Task 1) is the sole source of `durationMs` and matches the overlay's last-reel stop (2400) + settle (200). Event names `slots_spin` / `slots_board` / `slots_queue` are identical across Tasks 3, 5, 6, 7, 9. Store signatures (`loadSlotsConfig`/`getSlotsConfig`/`setSlotsConfig`/`deleteSlotsConfig`) match their `plinko_store` counterparts and their call sites in Tasks 4, 6, 7, 11.

---

## Execution Handoff

See the offer in chat.
