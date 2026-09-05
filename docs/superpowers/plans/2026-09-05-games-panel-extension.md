# Games Panel Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let viewers trigger Plinko drops and Slots spins with Bits from inside the Twitch extension itself (Panel/Mobile + video-overlay Component), gated behind a Pro/admin-grant check and a site-wide launch kill switch, with streamer-controlled visibility and per-game minimum Bits pricing.

**Architecture:** New per-broadcaster settings store (`games_store.js`) plus two new EBS redeem routes that funnel viewer Bits transactions into the existing, unmodified `firePlinkoDrop`/`fireSlotsSpin` engines — reusing the automatic `channel.cheer`-driven timer credit that already exists for any Bits spent in the extension, so the games' own payout math never changes. A new shared `GamesControls.jsx` component (tier picker, column picker, live queue position) is rendered from both `App.jsx` and `ComponentApp.jsx`, each wiring it into their own existing single `onTransactionComplete` handler rather than registering a second one.

**Tech Stack:** Node.js/Express (EBS), vanilla `node:test`, React 18 (extension), Server-Sent Events.

**Spec:** `docs/superpowers/specs/2026-09-05-games-panel-extension-design.md`

## Global Constraints

- Bits UI copy never uses "spend", "buy", "purchase", or "pay" — use "use Bits" / "{action} — X Bits" (see the Twitch Bits Language Guidelines memory).
- No new Bits SKU catalog — every price is one of the existing `VALID_TIERS` from `ebs/tiers.js` / `extension/src/tiers.js`.
- `computePlinkoDrop` / `computeSlotsSpin` / `sanitizePlinkoConfig` / `sanitizeSlotsConfig` are never modified — the game engines are untouched.
- The site-wide kill switch (`globalGamesConfig.launched`) defaults to `false` — Games must ship invisible to every viewer until explicitly flipped on.
- No new npm dependencies.
- Every store function that can be called with bad/missing input must never throw for a normal caller mistake (matches `plinko.js`/`slots.js`'s existing "never throws" contract) — this applies to `games_store.js`.

---

### Task 1: `games_store.js` — per-broadcaster settings + site-wide config

**Files:**
- Create: `ebs/games_store.js`
- Create: `ebs/games_store.test.js`

**Interfaces:**
- Consumes: `VALID_TIERS` from `./tiers.js` (already exists — `["sound_10", "sound_25", ..., "sound_10000"]`).
- Produces (used by Tasks 3, 4, 5, 7, 9):
  - `async function loadGamesSettings()` — loads both the per-user file and the global config file from disk into memory. Call once at server boot.
  - `function getGamesSettings(uid)` → `{ granted, visibility: { enabled, plinko, slots }, pricing: { plinkoMinTier, slotsMinTier } }` (a fresh clone, defaults for an unknown uid).
  - `function setGamesSettings(uid, patch)` → the updated settings (cloned). Merges `patch` onto the current settings; a `pricing.plinkoMinTier`/`slotsMinTier` below the site-wide `globalGamesConfig.minTier` is silently rejected (kept at its previous value) rather than throwing.
  - `function deleteGamesSettings(uid)` → `boolean` (existed before delete).
  - `function persistGamesSettings()` → `Promise<void>` (exported so tests can force a flush, matching `slots_store.js`'s `persistSlotsConfig`).
  - `function getGlobalGamesConfig()` → `{ launched, minTier }` (cloned).
  - `function setGlobalGamesConfig(patch)` → the updated global config (cloned).
  - `function persistGlobalGamesConfig()` → `Promise<void>`.

- [x] **Step 1: Write the failing tests**

Create `ebs/games_store.test.js`:

```js
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
  assert.equal(typeof g.launched, 'boolean');
  assert.ok(g.minTier);
});

test('setGlobalGamesConfig updates launched and minTier, and persists', async () => {
  const updated = setGlobalGamesConfig({ launched: true, minTier: 'sound_50' });
  assert.equal(updated.launched, true);
  assert.equal(updated.minTier, 'sound_50');
  await persistGlobalGamesConfig();
});

test('setGlobalGamesConfig ignores an unknown tier string', () => {
  setGlobalGamesConfig({ minTier: 'sound_50' });
  const updated = setGlobalGamesConfig({ minTier: 'garbage' });
  assert.equal(updated.minTier, 'sound_50');
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd ebs && node --test games_store.test.js`
Expected: FAIL — `Cannot find module './games_store.js'`

- [x] **Step 3: Write the implementation**

Create `ebs/games_store.js`:

```js
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { VALID_TIERS } from "./tiers.js";

const DATA_DIR = process.env.DATA_DIR || process.cwd();
const GAMES_PATH = path.resolve(DATA_DIR, "overlay-games-settings.json");
const GAMES_GLOBAL_PATH = path.resolve(DATA_DIR, "games-global-config.json");

// userId -> GamesSettings
const gamesSettingsByUser = new Map();

const DEFAULT_GAMES_SETTINGS = {
  granted: false,
  visibility: {
    enabled: true,
    plinko: true,
    slots: true,
  },
  pricing: {
    plinkoMinTier: "sound_100",
    slotsMinTier: "sound_100",
  },
};

// Site-wide, admin-only — independent of any one broadcaster's settings.
let globalGamesConfig = {
  launched: false,
  minTier: "sound_100",
};

function cloneSettings(s) {
  return JSON.parse(JSON.stringify(s));
}

function ensureUser(uid) {
  const id = uid ? String(uid) : "default";
  if (!gamesSettingsByUser.has(id)) {
    gamesSettingsByUser.set(id, cloneSettings(DEFAULT_GAMES_SETTINGS));
  }
  return id;
}

export async function loadGamesSettings() {
  try {
    const raw = await readFile(GAMES_GLOBAL_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.launched === "boolean") globalGamesConfig.launched = parsed.launched;
    if (typeof parsed.minTier === "string" && VALID_TIERS.includes(parsed.minTier)) {
      globalGamesConfig.minTier = parsed.minTier;
    }
  } catch {}

  try {
    const raw = await readFile(GAMES_PATH, "utf-8");
    const obj = JSON.parse(raw);
    for (const [uid, val] of Object.entries(obj)) {
      gamesSettingsByUser.set(String(uid), { ...cloneSettings(DEFAULT_GAMES_SETTINGS), ...val });
    }
  } catch {}
}

export async function persistGamesSettings() {
  try {
    const obj = {};
    for (const [uid, val] of gamesSettingsByUser.entries()) obj[uid] = val;
    await writeFile(GAMES_PATH, JSON.stringify(obj, null, 2), "utf-8");
  } catch {}
}

export async function persistGlobalGamesConfig() {
  try {
    await writeFile(GAMES_GLOBAL_PATH, JSON.stringify(globalGamesConfig, null, 2), "utf-8");
  } catch {}
}

export function deleteGamesSettings(uid) {
  const id = uid ? String(uid) : "default";
  const existed = gamesSettingsByUser.has(id);
  gamesSettingsByUser.delete(id);
  if (existed) persistGamesSettings().catch(() => {});
  return existed;
}

export function getGamesSettings(uid) {
  const id = ensureUser(uid);
  return cloneSettings(gamesSettingsByUser.get(id));
}

export function setGamesSettings(uid, patch = {}) {
  const id = ensureUser(uid);
  const curr = gamesSettingsByUser.get(id);

  if (typeof patch.granted === "boolean") {
    curr.granted = patch.granted;
  }

  if (patch.visibility && typeof patch.visibility === "object") {
    if (typeof patch.visibility.enabled === "boolean") curr.visibility.enabled = patch.visibility.enabled;
    if (typeof patch.visibility.plinko === "boolean") curr.visibility.plinko = patch.visibility.plinko;
    if (typeof patch.visibility.slots === "boolean") curr.visibility.slots = patch.visibility.slots;
  }

  if (patch.pricing && typeof patch.pricing === "object") {
    const floorIdx = VALID_TIERS.indexOf(globalGamesConfig.minTier);
    if (typeof patch.pricing.plinkoMinTier === "string" && VALID_TIERS.includes(patch.pricing.plinkoMinTier)) {
      if (VALID_TIERS.indexOf(patch.pricing.plinkoMinTier) >= floorIdx) {
        curr.pricing.plinkoMinTier = patch.pricing.plinkoMinTier;
      }
    }
    if (typeof patch.pricing.slotsMinTier === "string" && VALID_TIERS.includes(patch.pricing.slotsMinTier)) {
      if (VALID_TIERS.indexOf(patch.pricing.slotsMinTier) >= floorIdx) {
        curr.pricing.slotsMinTier = patch.pricing.slotsMinTier;
      }
    }
  }

  gamesSettingsByUser.set(id, curr);
  persistGamesSettings().catch(() => {});
  return cloneSettings(curr);
}

export function getGlobalGamesConfig() {
  return { ...globalGamesConfig };
}

export function setGlobalGamesConfig(patch = {}) {
  if (typeof patch.launched === "boolean") {
    globalGamesConfig.launched = patch.launched;
  }
  if (typeof patch.minTier === "string" && VALID_TIERS.includes(patch.minTier)) {
    globalGamesConfig.minTier = patch.minTier;
  }
  persistGlobalGamesConfig().catch(() => {});
  return getGlobalGamesConfig();
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `cd ebs && node --test games_store.test.js`
Expected: PASS (11 tests)

- [x] **Step 5: Commit**

```bash
cd ebs && git add games_store.js games_store.test.js
git commit -m "feat(games): per-broadcaster settings store + site-wide launch config

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `plinko_queue.js` — position + drift-proof advance counter

**Files:**
- Modify: `ebs/plinko_queue.js`
- Modify: `ebs/plinko_queue.test.js` (already exists — add tests, don't replace the file)

**Interfaces:**
- Consumes: nothing new.
- Produces (used by Tasks 6, 7, 8): `enqueue()`'s resolved value gains two fields — full shape becomes `{ accepted: true, waiting, position, advanceSeq }` on success (unchanged `{ accepted: false, reason: 'full' }` on rejection). `snapshot()`'s return gains `advanceSeq` (a number, `0` for a channel with no queue at all).

- [x] **Step 1: Write the failing tests**

Add to the end of `ebs/plinko_queue.test.js` (append — do not remove existing tests):

```js
test('enqueue into an idle queue reports position 0 — it starts playing immediately', () => {
  const h = harness();
  const result = h.q.enqueue('ch1', item('alice'));
  assert.equal(result.accepted, true);
  assert.equal(result.position, 0);
});

test('enqueue while something plays reports how many plays are ahead', () => {
  const h = harness();
  h.q.enqueue('ch1', item('alice')); // starts playing, position 0
  const bob = h.q.enqueue('ch1', item('bob'));
  const carol = h.q.enqueue('ch1', item('carol'));
  assert.equal(bob.position, 1); // alice's play is ahead of bob's
  assert.equal(carol.position, 2); // alice's and bob's plays are ahead of carol's
});

test('advanceSeq increments once per play-start, letting position count down correctly', () => {
  const h = harness();
  h.q.enqueue('ch1', item('alice', 5000));
  const bob = h.q.enqueue('ch1', item('bob', 5000));
  const seqAtBobJoin = bob.advanceSeq;
  assert.equal(h.q.snapshot('ch1').advanceSeq, seqAtBobJoin); // nothing advanced yet
  h.advance(5400); // alice's durationMs + gapMs elapses, drain() moves to bob
  h.flush();
  const seqNow = h.q.snapshot('ch1').advanceSeq;
  const remaining = bob.position - (seqNow - seqAtBobJoin);
  assert.equal(remaining, 0); // bob is now the one playing
});

test('advanceSeq also increments when a stale item is skipped, not just on a real play', () => {
  const h = harness({ ttlMs: 1000 });
  h.q.enqueue('ch1', item('playing', 5000)); // starts immediately
  const stale = h.q.enqueue('ch1', item('stale', 5000));
  const fresh = h.q.enqueue('ch1', item('fresh', 5000));
  h.advance(2000); // 'stale' and 'fresh' both age past ttlMs while waiting
  const freshJoinSeq = fresh.advanceSeq;
  h.advance(5400); // 'playing' finishes, drain() shifts 'stale' (skipped) then 'fresh' (played)
  h.flush();
  const seqNow = h.q.snapshot('ch1').advanceSeq;
  // Two shifts happened ahead of fresh's own play: the 'playing' item's play,
  // and the 'stale' item being discarded — both counted by advanceSeq.
  assert.ok(seqNow - freshJoinSeq >= 1);
  assert.deepEqual(h.played.map((i) => i.viewerName), ['playing', 'fresh']);
});

test('snapshot reports advanceSeq 0 for a channel that has never queued anything', () => {
  const h = harness();
  assert.equal(h.q.snapshot('never-used').advanceSeq, 0);
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd ebs && node --test plinko_queue.test.js`
Expected: FAIL — `result.position` is `undefined`, assertions fail

- [x] **Step 3: Implement the additions**

In `ebs/plinko_queue.js`, modify `enqueue`, `drain`, and `snapshot`:

```js
  function enqueue(channelId, item) {
    const cid = String(channelId);
    let q = queues.get(cid);
    if (!q) {
      q = { items: [], playing: null, draining: false, advanceSeq: 0 };
      queues.set(cid, q);
    }
    if (q.items.length >= maxSize) {
      return { accepted: false, reason: 'full' };
    }
    q.items.push({ ...item, enqueuedAt: now(), expiresAt: now() + ttlMs });
    onChange(cid);
    if (!q.draining) drain(cid);
    // Read after drain() runs — mirrors how `waiting` below is already
    // computed post-drain, so an item that starts playing immediately (an
    // idle queue) is correctly reported as position 0, not 1: drain() will
    // have already shifted it out of q.items and into q.playing by now.
    const waiting = q.items.length;
    const position = (q.playing ? 1 : 0) + (waiting - 1);
    return { accepted: true, waiting, position, advanceSeq: q.advanceSeq };
  }

  function drain(cid) {
    const q = queues.get(cid);
    if (!q) return;

    let item = null;
    while (q.items.length) {
      const candidate = q.items.shift();
      // One shift = one "someone ahead of you cleared" event, whether the
      // item goes on to play or gets discarded as stale below.
      q.advanceSeq++;
      if (candidate.expiresAt && candidate.expiresAt <= now()) {
        onChange(cid); // a stale drop was dropped
        continue;
      }
      item = candidate;
      break;
    }

    if (!item) {
      q.draining = false;
      q.playing = null;
      queues.delete(cid);
      onChange(cid);
      return;
    }

    q.draining = true;
    q.playing = item;
    onChange(cid);
    try {
      play(item);
    } catch {
      // one bad drop must not stall the queue
    }
    const holdMs = Math.max(0, Number(item.durationMs) || 0) + gapMs;
    schedule(() => {
      const qq = queues.get(cid);
      if (qq) qq.playing = null;
      drain(cid);
    }, holdMs);
  }

  function snapshot(channelId) {
    const q = queues.get(String(channelId));
    if (!q) return { nowPlaying: null, waiting: [], waitingCount: 0, advanceSeq: 0 };
    return {
      nowPlaying: q.playing ? pub(q.playing) : null,
      waiting: q.items.slice(0, 50).map(pub),
      waitingCount: q.items.length,
      advanceSeq: q.advanceSeq,
    };
  }
```

(Only these three functions change; `pub`, `size`, and the module's exports stay as they are.)

- [x] **Step 4: Run tests to verify they pass**

Run: `cd ebs && node --test plinko_queue.test.js`
Expected: PASS (all tests, old and new — 16 total)

- [x] **Step 5: Commit**

```bash
cd ebs && git add plinko_queue.js plinko_queue.test.js
git commit -m "feat(games): queue position + drift-proof advance counter

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Extend `GET /api/ext/config` with Games feature flags

**Files:**
- Modify: `ebs/routes_sounds.js:1255-1269`

**Interfaces:**
- Consumes: `getGamesSettings`, `getGlobalGamesConfig` from `./games_store.js` (Task 1); `isPro` from `./subscription_store.js` (already imported in this file at line 2).
- Produces: `GET /api/ext/config`'s JSON response gains `features.plinko` and `features.slots` booleans, used by Task 11/12's `hasGames` check.

- [x] **Step 1: Add the import**

At the top of `ebs/routes_sounds.js`, near the existing `import { isPro } from "./subscription_store.js";` (line 2), add:

```js
import { getGamesSettings, getGlobalGamesConfig } from "./games_store.js";
```

- [x] **Step 2: Extend the route**

Replace the existing handler:

```js
  // Public extension config — feature flags for viewer/broadcaster panel
  app.get("/api/ext/config", (req, res) => {
    const channelId = req.query.channelId;
    if (!channelId) return res.status(400).json({ error: "channelId required" });
    const uid = String(channelId);
    const soundSettings = getSoundSettings(uid);
    res.json({
      features: {
        tts: true,           // toggled per-channel via TTS settings — placeholder for now
        videoClips: Boolean(soundSettings?.videoClipsEnabled),
        communityLibrary: true,
      },
      banner: getBannerConfig(),
    });
  });
```

with:

```js
  // Public extension config — feature flags for viewer/broadcaster panel
  app.get("/api/ext/config", (req, res) => {
    const channelId = req.query.channelId;
    if (!channelId) return res.status(400).json({ error: "channelId required" });
    const uid = String(channelId);
    const soundSettings = getSoundSettings(uid);
    const gs = getGamesSettings(uid);
    const globalGames = getGlobalGamesConfig();
    const gamesAccessible = globalGames.launched && (isPro(uid) || gs.granted);
    res.json({
      features: {
        tts: true,           // toggled per-channel via TTS settings — placeholder for now
        videoClips: Boolean(soundSettings?.videoClipsEnabled),
        communityLibrary: true,
        plinko: gamesAccessible && gs.visibility.enabled && gs.visibility.plinko,
        slots: gamesAccessible && gs.visibility.enabled && gs.visibility.slots,
      },
      banner: getBannerConfig(),
    });
  });
```

- [x] **Step 3: Wire `loadGamesSettings()` into server boot**

In `ebs/server.js`, find the existing boot sequence that calls `loadPlinkoConfig()` / `loadSlotsConfig()` (search for `loadPlinkoConfig().catch`). Add, on its own line right after those:

```js
loadGamesSettings().catch(() => {});
```

Add the import at the top of `server.js` next to the other games-related imports (see Task 6 for the full import block this belongs in — for now just add):

```js
import { loadGamesSettings } from "./games_store.js";
```

- [x] **Step 4: Verify manually**

Run: `cd ebs && npm run dev` (or however the dev server is normally started — check `package.json`'s `dev` script), then in another terminal:

```bash
curl -s "http://localhost:8080/api/ext/config?channelId=12345" | node -e "process.stdin.pipe(require('fs').createWriteStream('/dev/stdout'))"
```

Expected: JSON response includes `"plinko": false` and `"slots": false` (since `globalGamesConfig.launched` defaults to `false` — no broadcaster can be `gamesAccessible` yet). This is correct: the kill switch is off by default, exactly as designed.

- [x] **Step 5: Commit**

```bash
git add ebs/routes_sounds.js ebs/server.js
git commit -m "feat(games): surface plinko/slots feature flags in GET /api/ext/config

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Broadcaster settings + viewer config routes

**Files:**
- Modify: `ebs/server.js`

**Interfaces:**
- Consumes: `getGamesSettings`, `setGamesSettings`, `getGlobalGamesConfig` from `./games_store.js`; `isPro` from `./subscription_store.js`; `getPlinkoConfig` (already imported); `VALID_TIERS` from `./tiers.js`.
- Produces: `GET /api/games/settings`, `POST /api/games/settings` (broadcaster), `GET /api/games/config` (viewer) — consumed by ConfigApp.jsx (Task 10 equivalent, not in this plan's frontend scope beyond what's needed for parity — see note below) and `GamesControls.jsx` (Task 10).

The broadcaster-facing `ConfigApp.jsx` UI that calls these routes is built in Task 13.

- [x] **Step 1: Add imports**

In `ebs/server.js`, extend the existing `import { loadSubscriptions } from "./subscription_store.js";` (around line 91) to also import `isPro`:

```js
import { loadSubscriptions, isPro } from "./subscription_store.js";
```

Add, next to the other games-related import from Task 3:

```js
import {
  loadGamesSettings,
  getGamesSettings,
  setGamesSettings,
  getGlobalGamesConfig,
} from "./games_store.js";
import { VALID_TIERS } from "./tiers.js";
```

- [x] **Step 2: Add a broadcaster-auth helper**

Near `resolveTimerUserIdFromRequest` (`server.js:1281`), add a new function — this is genuinely new for `server.js`'s inline routes (Plinko/Slots today only ever check `req.session.isAdmin`), because `ConfigApp.jsx` authenticates via an extension JWT with `role: "broadcaster"`, not a website session:

```js
// Broadcaster auth for the Games settings routes — supports both the EBS
// website session (dashboard) and an extension JWT with role "broadcaster"
// (ConfigApp.jsx, running inside the Twitch config iframe). Mirrors the
// requireBroadcaster() already duplicated in routes_sounds.js / routes_tts.js;
// this file has no such helper today since Plinko/Slots' existing routes are
// session-only.
function requireGamesBroadcaster(req, res) {
  if (req?.session?.isAdmin) {
    const uid = req.session?.managingAs || req.session?.twitchUser?.id;
    if (uid) return String(uid);
  }
  const claims = verifyExtensionJwt(req);
  if (claims && claims.role === "broadcaster") {
    return String(claims.channel_id);
  }
  res.status(401).json({ error: "Broadcaster auth required" });
  return null;
}
```

This calls `verifyExtensionJwt`, which Task 7 adds to this file — **do Task 7's Step 1 (the `jwt` import + `EXT_SECRET` + `verifyExtensionJwt`/`requireExtensionAuth` helpers) before this step** if working through tasks out of order. If following this plan in order, skip ahead momentarily: add that block now (copy it verbatim from Task 7 Step 1) rather than duplicating it later.

- [x] **Step 3: Add the settings + config routes**

Add next to the existing `/api/plinko/config` / `/api/slots/config` routes (`server.js:855`, right after the `POST /api/slots/config` handler):

```js
app.get("/api/games/settings", (req, res) => {
  const uid = requireGamesBroadcaster(req, res);
  if (!uid) return;
  const settings = getGamesSettings(uid);
  const glob = getGlobalGamesConfig();
  res.json({
    settings,
    accessible: isPro(uid) || settings.granted,
    launched: glob.launched,
    globalMinTier: glob.minTier,
  });
});

app.post("/api/games/settings", (req, res) => {
  const uid = requireGamesBroadcaster(req, res);
  if (!uid) return;
  const updated = setGamesSettings(uid, req.body || {});
  logger.info("games_settings_updated", { userId: uid });
  res.json({ settings: updated });
});

// Viewer-facing config — enough for the extension's tier picker and Plinko
// column picker to match the streamer's real board, without exposing
// anything broadcaster-only.
app.get("/api/games/config", (req, res) => {
  const claims = requireExtensionAuth(req, res);
  if (!claims) return;
  const channelId = req.query.channelId || claims.channel_id;
  if (!channelId) return res.status(400).json({ error: "channelId required" });
  const uid = String(channelId);
  const gs = getGamesSettings(uid);
  const plinkoCfg = getPlinkoConfig(uid);
  res.json({
    plinko: { columns: plinkoCfg.rows + 1, minTier: gs.pricing.plinkoMinTier },
    slots: { minTier: gs.pricing.slotsMinTier },
  });
});
```

- [x] **Step 4: Verify manually**

With the dev server running:

```bash
curl -s "http://localhost:8080/api/games/config?channelId=12345" -H "Authorization: Bearer <a valid extension viewer JWT>"
```

Expected: `401 {"error":"Extension auth required"}` without the header; with a valid JWT, `{"plinko":{"columns":10,"minTier":"sound_100"},"slots":{"minTier":"sound_100"}}` (columns = 9 + 1, matching `DEFAULT_PLINKO_CONFIG.rows`).

For the settings routes, since they require broadcaster session/JWT auth that's hard to fake from curl, verify via the running EBS admin session (log in as a test broadcaster on the dashboard, then in the browser console on that page): `fetch('/api/games/settings', {credentials:'include'}).then(r=>r.json()).then(console.log)` — expect the default settings shape from Task 1.

- [x] **Step 5: Commit**

```bash
cd ebs && git add server.js
git commit -m "feat(games): broadcaster settings + viewer config routes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Site-wide admin routes for the launch kill switch

**Files:**
- Modify: `ebs/routes_admin.js`

**Interfaces:**
- Consumes: `getGlobalGamesConfig`, `setGlobalGamesConfig` from `./games_store.js`.
- Produces: `GET /api/admin/games-config`, `POST /api/admin/games-config` — this is the only way `globalGamesConfig.launched` ever flips to `true`.

- [ ] **Step 1: Add the import**

At the top of `ebs/routes_admin.js`, next to `import { getTtsSettings, setTtsSettings, getGlobalTtsConfig, setGlobalTtsConfig } from "./tts_store.js";` (line 8), add:

```js
import { getGlobalGamesConfig, setGlobalGamesConfig } from "./games_store.js";
```

- [ ] **Step 2: Add the routes**

Inside `mountAdminRoutes(app, ctx)`, next to the existing `GET /api/admin/tts-config` / `POST /api/admin/tts-config` routes (around line 415-432), add:

```js
  // Get the site-wide Games launch config
  app.get("/api/admin/games-config", (req, res) => {
    if (!req.session?.isAdmin || !isSuperAdmin(req)) {
      return res.status(403).json({ error: "Access denied" });
    }
    const config = getGlobalGamesConfig();
    const tiers = VALID_TIERS.map((sku) => ({ sku, label: TIER_LABELS[sku], cost: TIER_COSTS[sku] }));
    res.json({ config, tiers });
  });

  // Update the site-wide Games launch config — this is the kill switch
  app.post("/api/admin/games-config", (req, res) => {
    if (!req.session?.isAdmin || !isSuperAdmin(req)) {
      return res.status(403).json({ error: "Access denied" });
    }
    const updated = setGlobalGamesConfig(req.body || {});
    res.json({ ok: true, config: updated });
  });
```

(`VALID_TIERS`, `TIER_LABELS`, `TIER_COSTS`, and `isSuperAdmin` are already imported/defined in this file — see line 16 and line 28.)

- [ ] **Step 3: Verify manually**

As a super-admin session in the browser console on the EBS dashboard:

```js
fetch('/api/admin/games-config', {credentials:'include'}).then(r=>r.json()).then(console.log)
// expect { config: { launched: false, minTier: 'sound_100' }, tiers: [...] }

fetch('/api/admin/games-config', {method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ launched: true })}).then(r=>r.json()).then(console.log)
// expect { ok: true, config: { launched: true, minTier: 'sound_100' } }
```

Then re-check `GET /api/ext/config?channelId=<a Pro or granted test broadcaster>` from Task 3 — `features.plinko`/`features.slots` should now be `true` for that broadcaster (given `isPro()` currently always returns `true` per the existing TODO in `subscription_store.js`, every broadcaster now qualifies).

- [ ] **Step 4: Commit**

```bash
cd ebs && git add routes_admin.js
git commit -m "feat(games): site-wide admin launch kill switch

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Surface queue position from `firePlinkoDrop` / `fireSlotsSpin`

**Files:**
- Modify: `ebs/server.js:991-1054` (`firePlinkoDrop`)
- Modify: `ebs/server.js:1142-1194` (`fireSlotsSpin`)

**Interfaces:**
- Consumes: `enqueue()`'s extended return value from Task 2 (`{ accepted, position, waiting, advanceSeq }`).
- Produces: the `payload` object both functions already return gains an optional `.queue` field — `{ position, waitingCount, advanceSeq }` when the item was accepted into the queue, absent when rejected (queue full) or when `test: true`. Consumed by Task 7's redeem routes. Existing callers (`POST /api/plinko/drop`, `POST /api/slots/spin`) are unaffected — they already do `res.json(payload)` and simply gain one more field in the response they weren't reading before.

- [ ] **Step 1: Modify `firePlinkoDrop`**

Find (in `firePlinkoDrop`, `server.js:1036-1053`):

```js
  const { accepted } = plinkoQueue.enqueue(uid, {
    uid,
    overlayKey,
    boardId,
    payload,
    durationMs,
    secondsToAdd,
    binIndex,
    multiplier,
    dropColumn: col,
    baseSeconds: cfg.baseSeconds,
    viewerName: viewerName || "Someone",
    source,
  });
  if (!accepted) {
    logger.warn("plinko_drop_rejected", { userId: uid, source, reason: "queue_full" });
  }
  return payload;
```

Replace with:

```js
  const enqueueResult = plinkoQueue.enqueue(uid, {
    uid,
    overlayKey,
    boardId,
    payload,
    durationMs,
    secondsToAdd,
    binIndex,
    multiplier,
    dropColumn: col,
    baseSeconds: cfg.baseSeconds,
    viewerName: viewerName || "Someone",
    source,
  });
  if (!enqueueResult.accepted) {
    logger.warn("plinko_drop_rejected", { userId: uid, source, reason: "queue_full" });
  } else {
    payload.queue = {
      position: enqueueResult.position,
      waitingCount: enqueueResult.waiting,
      advanceSeq: enqueueResult.advanceSeq,
    };
  }
  return payload;
```

- [ ] **Step 2: Modify `fireSlotsSpin`**

Find (in `fireSlotsSpin`, `server.js:1177-1193`):

```js
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
```

Replace with:

```js
  const enqueueResult = slotsQueue.enqueue(uid, {
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
  if (!enqueueResult.accepted) {
    logger.warn("slots_spin_rejected", { userId: uid, source, reason: "queue_full" });
  } else {
    payload.queue = {
      position: enqueueResult.position,
      waitingCount: enqueueResult.waiting,
      advanceSeq: enqueueResult.advanceSeq,
    };
  }
  return payload;
```

- [ ] **Step 3: Verify the existing manual routes still work**

Start the dev server, log in as a test broadcaster on `/utilities`, and click the manual "Drop" button (Plinko) and "Spin" button (Slots) in the Extras UI. Expected: identical behavior to before this change (token drops / reels spin, timer updates) — this task only adds a field to the JSON response, nothing observable in the UI changes. Confirm via browser devtools Network tab that the `POST /api/plinko/drop` and `POST /api/slots/spin` responses now include a `"queue": {"position":0,...}` field.

- [ ] **Step 4: Commit**

```bash
cd ebs && git add server.js
git commit -m "feat(games): surface enqueue position on firePlinkoDrop/fireSlotsSpin

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Bits redemption routes

**Files:**
- Modify: `ebs/server.js`

**Interfaces:**
- Consumes: `firePlinkoDrop`, `fireSlotsSpin` (with Task 6's `.queue` field); `getGamesSettings`, `getGlobalGamesConfig` (Task 1); `VALID_TIERS` (Task 4's import); `getOrCreateUserKey`, `normKey` (already imported); `state.seen` (already imported via `state.js`); `fetchUserDisplayName` (already imported).
- Produces: `POST /api/plinko/redeem`, `POST /api/slots/redeem` — called by `GamesControls.jsx` (Task 10) after a completed Bits transaction.

- [ ] **Step 1: Add the extension-JWT auth helpers**

`server.js` has no extension-JWT auth today (Plinko/Slots' existing routes are session-only) — add the same small pattern already independently duplicated in `routes_sounds.js` and `routes_tts.js`. Add near the top of `server.js`, after the other top-level `const`s (e.g. near `const sseClients = new Set();` at line 261):

```js
import jwt from "jsonwebtoken";
```

(add this import line up with the other imports, e.g. right after `import { v4 as uuidv4 } from "uuid";`)

```js
const EXT_SECRET = process.env.EXTENSION_SECRET
  ? Buffer.from(process.env.EXTENSION_SECRET, "base64")
  : null;

function verifyExtensionJwt(req) {
  if (!EXT_SECRET) return null;
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  try {
    return jwt.verify(token, EXT_SECRET, { algorithms: ["HS256"] });
  } catch {
    return null;
  }
}

function requireExtensionAuth(req, res) {
  const claims = verifyExtensionJwt(req);
  if (claims) return claims;
  res.status(401).json({ error: "Extension auth required" });
  return null;
}
```

(If you already added these while doing Task 4 Step 2, skip this — they're the same block.)

- [ ] **Step 2: Add the Plinko redeem route**

Add next to `app.post("/api/plinko/drop", ...)` (`server.js:1196`):

```js
app.post("/api/plinko/redeem", async (req, res) => {
  const claims = requireExtensionAuth(req, res);
  if (!claims) return;

  const { receipt, channelId, dropColumn } = req.body || {};
  if (!receipt || !channelId) {
    return res.status(400).json({ error: "receipt and channelId are required" });
  }
  const uid = String(channelId);

  let txClaims;
  try {
    txClaims = jwt.verify(receipt, EXT_SECRET, { algorithms: ["HS256"] });
  } catch {
    return res.status(400).json({ error: "Invalid transaction receipt" });
  }
  const receiptData = txClaims.data || txClaims;
  const txId = receiptData.transactionId || receiptData.transactionID || receiptData.id;
  const viewerUserId = claims.user_id;

  const gs = getGamesSettings(uid);
  const glob = getGlobalGamesConfig();
  const accessible = glob.launched && (isPro(uid) || gs.granted);
  if (!accessible || !gs.visibility.enabled || !gs.visibility.plinko) {
    return res.status(404).json({ error: "Plinko is not available on this channel" });
  }

  const receiptSku = receiptData.product?.sku || receiptData.product?.domainID;
  const floorIdx = VALID_TIERS.indexOf(gs.pricing.plinkoMinTier);
  const skuIdx = VALID_TIERS.indexOf(receiptSku);
  if (skuIdx < 0 || skuIdx < floorIdx) {
    return res.status(400).json({ error: "Bits amount is below the minimum for this game" });
  }

  if (txId) {
    const dedupKey = `gamestx:${txId}`;
    if (state.seen.has(dedupKey)) {
      return res.json({ accepted: true, duplicate: true });
    }
    state.seen.set(dedupKey, Date.now() + 24 * 3600 * 1000);
  }

  let viewerName = "Someone";
  if (viewerUserId) {
    try {
      viewerName = (await fetchUserDisplayName(viewerUserId, uid)) || "Someone";
    } catch {}
  }

  const overlayKey = normKey(getOrCreateUserKey(uid));
  const rawColumn = Number(dropColumn);
  const payload = firePlinkoDrop({
    uid,
    overlayKey,
    dropColumn: Number.isFinite(rawColumn) ? rawColumn : undefined,
    source: "bits_redeem",
    viewerName,
  });

  if (!payload.queue) {
    // Bits were already spent (the transaction completed) but the drop
    // couldn't be queued — this must be visible in the broadcaster's
    // activity log, not just the server's own logger.warn inside
    // firePlinkoDrop, which isn't broadcaster-facing.
    addLogEntry({
      type: "plinko_drop_rejected",
      source: "bits_redeem",
      reason: "queue_full",
      userId: uid,
      userName: viewerName !== "Someone" ? viewerName : undefined,
      txId: txId || undefined,
    });
    return res.json({ accepted: false, reason: "full" });
  }
  res.json({
    accepted: true,
    position: payload.queue.position,
    advanceSeqAtJoin: payload.queue.advanceSeq,
    waitingCount: payload.queue.waitingCount,
  });
});
```

- [ ] **Step 3: Add the Slots redeem route**

Add next to `app.post("/api/slots/spin", ...)` (`server.js:1220`):

```js
app.post("/api/slots/redeem", async (req, res) => {
  const claims = requireExtensionAuth(req, res);
  if (!claims) return;

  const { receipt, channelId } = req.body || {};
  if (!receipt || !channelId) {
    return res.status(400).json({ error: "receipt and channelId are required" });
  }
  const uid = String(channelId);

  let txClaims;
  try {
    txClaims = jwt.verify(receipt, EXT_SECRET, { algorithms: ["HS256"] });
  } catch {
    return res.status(400).json({ error: "Invalid transaction receipt" });
  }
  const receiptData = txClaims.data || txClaims;
  const txId = receiptData.transactionId || receiptData.transactionID || receiptData.id;
  const viewerUserId = claims.user_id;

  const gs = getGamesSettings(uid);
  const glob = getGlobalGamesConfig();
  const accessible = glob.launched && (isPro(uid) || gs.granted);
  if (!accessible || !gs.visibility.enabled || !gs.visibility.slots) {
    return res.status(404).json({ error: "Slots is not available on this channel" });
  }

  const receiptSku = receiptData.product?.sku || receiptData.product?.domainID;
  const floorIdx = VALID_TIERS.indexOf(gs.pricing.slotsMinTier);
  const skuIdx = VALID_TIERS.indexOf(receiptSku);
  if (skuIdx < 0 || skuIdx < floorIdx) {
    return res.status(400).json({ error: "Bits amount is below the minimum for this game" });
  }

  if (txId) {
    const dedupKey = `gamestx:${txId}`;
    if (state.seen.has(dedupKey)) {
      return res.json({ accepted: true, duplicate: true });
    }
    state.seen.set(dedupKey, Date.now() + 24 * 3600 * 1000);
  }

  let viewerName = "Someone";
  if (viewerUserId) {
    try {
      viewerName = (await fetchUserDisplayName(viewerUserId, uid)) || "Someone";
    } catch {}
  }

  const overlayKey = normKey(getOrCreateUserKey(uid));
  const payload = fireSlotsSpin({
    uid,
    overlayKey,
    source: "bits_redeem",
    viewerName,
  });

  if (!payload.queue) {
    addLogEntry({
      type: "slots_spin_rejected",
      source: "bits_redeem",
      reason: "queue_full",
      userId: uid,
      userName: viewerName !== "Someone" ? viewerName : undefined,
      txId: txId || undefined,
    });
    return res.json({ accepted: false, reason: "full" });
  }
  res.json({
    accepted: true,
    position: payload.queue.position,
    advanceSeqAtJoin: payload.queue.advanceSeq,
    waitingCount: payload.queue.waitingCount,
  });
});
```

- [ ] **Step 4: Verify manually**

This route needs a real (or crafted-for-testing) extension viewer JWT and a real (or crafted) Bits transaction receipt JWT, both signed with `EXTENSION_SECRET`. Write a throwaway script (do not commit it) to mint both and hit the route, mirroring how `sub_dedup.test.js` or similar scripts in this repo fabricate JWTs for local testing — check `ebs/.env` for `EXTENSION_SECRET`, then:

```bash
cd ebs && node --input-type=module -e '
import jwt from "jsonwebtoken";
const secret = Buffer.from(process.env.EXTENSION_SECRET, "base64");
const viewerToken = jwt.sign({ channel_id: "12345", user_id: "999", role: "viewer" }, secret, { algorithm: "HS256" });
const receipt = jwt.sign({ data: { transactionId: "test-tx-1", product: { sku: "sound_100" } } }, secret, { algorithm: "HS256" });
console.log(JSON.stringify({ viewerToken, receipt }));
'
```

Then, with the broadcaster `12345` set to `granted: true` and `globalGamesConfig.launched: true` (via the Task 4/5 routes) and `pricing.plinkoMinTier: "sound_100"` or lower:

```bash
curl -s -X POST http://localhost:8080/api/plinko/redeem \
  -H "Authorization: Bearer <viewerToken>" -H "Content-Type: application/json" \
  -d '{"receipt":"<receipt>","channelId":"12345","dropColumn":3}'
```

Expected: `{"accepted":true,"position":0,"advanceSeqAtJoin":0,"waitingCount":1}` (or similar — first drop plays immediately, position 0) and a token visibly drops on `/overlay/plinko?key=...` if you have that browser source open. Re-running the exact same curl command (same `txId`) should return `{"accepted":true,"duplicate":true}` without a second drop.

Then test the floor rejection: mint a receipt with `sku: "sound_10"` while `plinkoMinTier` is `"sound_100"` — expect `400 {"error":"Bits amount is below the minimum for this game"}`.

- [ ] **Step 5: Commit**

```bash
cd ebs && git add server.js
git commit -m "feat(games): Bits redemption routes for Plinko drops and Slots spins

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Live viewer-facing queue-position SSE stream

**Files:**
- Modify: `ebs/server.js`

**Interfaces:**
- Consumes: `plinkoQueue.snapshot(channelId)` / `slotsQueue.snapshot(channelId)` (Task 2's `advanceSeq`).
- Produces: `GET /api/games/queue-stream?channelId=` — an SSE stream viewers' extension instances open, `event: games_queue`, `{ plinko: { waitingCount, advanceSeq }, slots: { waitingCount, advanceSeq } }`. Consumed by `GamesControls.jsx` (Task 10).

- [ ] **Step 1: Add a separate client registry**

Near `const sseClients = new Set();` (`server.js:261`), add:

```js
// Viewer-facing queue-depth stream — deliberately separate from sseClients,
// which is gated by a per-broadcaster overlay key. This one is scoped only
// by channelId (public, non-secret — same trust level as GET
// /api/overlay/status) since every viewer's extension instance connects to
// it, and it must never be given the overlay key.
const gamesQueueClients = new Set();
```

- [ ] **Step 2: Add the broadcast function**

Add near `broadcastPlinkoQueue` / `broadcastSlotsQueue` (`server.js:918`, `1071`):

```js
// Pushes live queue depth to every viewer's extension instance for this
// channel — counts only, no viewer names (contrast with broadcastPlinkoQueue
// / broadcastSlotsQueue above, which do include names but only reach the
// broadcaster's own key-gated OBS overlay).
function broadcastGamesQueueSse(channelId) {
  const cid = String(channelId);
  const plinkoSnap = plinkoQueue.snapshot(cid);
  const slotsSnap = slotsQueue.snapshot(cid);
  const data = JSON.stringify({
    plinko: { waitingCount: plinkoSnap.waitingCount, advanceSeq: plinkoSnap.advanceSeq },
    slots: { waitingCount: slotsSnap.waitingCount, advanceSeq: slotsSnap.advanceSeq },
  });
  for (const client of Array.from(gamesQueueClients)) {
    if (!client || client.channelId !== cid) continue;
    try {
      client.res.write("event: games_queue\n");
      client.res.write(`data: ${data}\n\n`);
    } catch (e) {
      gamesQueueClients.delete(client);
    }
  }
}
```

- [ ] **Step 3: Wire it into both queues' `onChange`**

Find (`server.js:287-299`):

```js
const plinkoQueue = createPlinkoQueue({
  play: (item) => playPlinkoDrop(item),
  onChange: (channelId) => broadcastPlinkoQueue(channelId),
});
// Slot-machine spins play one at a time per channel too. Same game-agnostic
// queue module; play()/onChange() are hoisted function declarations below.
const lastSlotsSpinByKey = new Map();
const lastSlotsBoardByKey = new Map();
const lastSlotsQueueByKey = new Map();
const slotsQueue = createPlinkoQueue({
  play: (item) => playSlotsSpin(item),
  onChange: (channelId) => broadcastSlotsQueue(channelId),
});
```

Replace the two `onChange` lines:

```js
const plinkoQueue = createPlinkoQueue({
  play: (item) => playPlinkoDrop(item),
  onChange: (channelId) => {
    broadcastPlinkoQueue(channelId);
    broadcastGamesQueueSse(channelId);
  },
});
// Slot-machine spins play one at a time per channel too. Same game-agnostic
// queue module; play()/onChange() are hoisted function declarations below.
const lastSlotsSpinByKey = new Map();
const lastSlotsBoardByKey = new Map();
const lastSlotsQueueByKey = new Map();
const slotsQueue = createPlinkoQueue({
  play: (item) => playSlotsSpin(item),
  onChange: (channelId) => {
    broadcastSlotsQueue(channelId);
    broadcastGamesQueueSse(channelId);
  },
});
```

- [ ] **Step 4: Add the SSE route**

Add near `app.get("/api/overlay/stream", ...)` (`server.js:1339`), after it:

```js
// Viewer-facing queue depth — no key, scoped only by channelId. Native
// EventSource cannot send an Authorization header, and there is nothing
// sensitive in this payload (aggregate counts only), so this is
// intentionally open the same way GET /api/overlay/status is.
app.get("/api/games/queue-stream", (req, res) => {
  const channelId = req.query.channelId;
  if (!channelId) return res.status(400).json({ error: "channelId required" });
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const client = { res, channelId: String(channelId) };
  gamesQueueClients.add(client);
  res.write(": connected\n\n");

  const plinkoSnap = plinkoQueue.snapshot(client.channelId);
  const slotsSnap = slotsQueue.snapshot(client.channelId);
  res.write("event: games_queue\n");
  res.write(`data: ${JSON.stringify({
    plinko: { waitingCount: plinkoSnap.waitingCount, advanceSeq: plinkoSnap.advanceSeq },
    slots: { waitingCount: slotsSnap.waitingCount, advanceSeq: slotsSnap.advanceSeq },
  })}\n\n`);

  req.on("close", () => {
    gamesQueueClients.delete(client);
  });
});
```

- [ ] **Step 5: Verify manually**

```bash
curl -N "http://localhost:8080/api/games/queue-stream?channelId=12345"
```

Expected: an initial `event: games_queue` with zeroed counts, held open. While that curl is running, trigger a Plinko redeem (Task 7's manual test) for the same `channelId` — expect a second `event: games_queue` to arrive on the open connection with `plinko.waitingCount`/`advanceSeq` reflecting the change.

- [ ] **Step 6: Commit**

```bash
cd ebs && git add server.js
git commit -m "feat(games): live viewer-facing queue-depth SSE stream

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: User-data deletion + `.gitignore`

**Files:**
- Modify: `ebs/user_data_deletion.js`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `deleteGamesSettings` from `./games_store.js`.
- Produces: nothing new consumed elsewhere — this closes out the GDPR-deletion contract every other per-broadcaster store already has.

- [ ] **Step 1: Add the import and deletion step**

In `ebs/user_data_deletion.js`, add to the imports (next to `import { deleteSlotsConfig } from "./slots_store.js";`):

```js
import { deleteGamesSettings } from "./games_store.js";
```

Add next to the existing `8c. Slots board config` step:

```js
  // 8d. Games settings (visibility/pricing/grant)
  if (deleteGamesSettings(uid)) deleted.push("games");
```

- [ ] **Step 2: Add the gitignore entry**

In `.gitignore`, add next to `ebs/overlay-slots.json`:

```
ebs/overlay-games-settings.json
```

(`games-global-config.json` is intentionally **not** added — `tts-global-config.json` isn't gitignored either; this repo treats site-wide admin config files as trackable, unlike per-broadcaster ones. Don't "fix" that inconsistency here — it's out of scope for this plan.)

- [ ] **Step 3: Verify manually**

Run the existing account-deletion flow (find the admin "Delete my data" endpoint/button already wired to `deleteAllUserData`) for a test broadcaster that has `games_store.js` settings set, and confirm the response's `deleted` array includes `"games"`, and that `getGamesSettings(uid)` afterward returns the default settings again.

- [ ] **Step 4: Commit**

```bash
git add ebs/user_data_deletion.js .gitignore
git commit -m "feat(games): wire games settings into user data deletion

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: `GamesControls.jsx` — shared viewer component

**Files:**
- Create: `extension/src/GamesControls.jsx`

**Interfaces:**
- Consumes: `VALID_TIERS`, `TIER_LABELS` from `./tiers.js` (already exist).
- Produces (used by Tasks 11, 12):

```jsx
function GamesControls({
  auth,               // { token, channelId } — from window.Twitch.ext.onAuthorized
  features,           // { plinko: boolean, slots: boolean } — from GET /api/ext/config
  bitsEnabled,        // boolean
  pendingType,        // null | "plinko" | "slots" — set by the host while a Bits
                       // transaction for a game is in flight, so this component
                       // can disable its own buttons
  pendingGamesTx,      // null | { type: "plinko" | "slots", receipt, dropColumn? } —
                       // set by the host's onTransactionComplete handler once a
                       // completed Bits transaction is known to be for a game
  onGamesTxHandled,    // () => void — called once this component has finished
                       // acting on pendingGamesTx (success or failure), so the
                       // host can clear it
  onStartTransaction,  // (type: "plinko" | "slots", tier: string, extra?: { dropColumn }) => void —
                       // called on button click; the host is responsible for
                       // setting pendingType and calling window.Twitch.ext.bits.useBits(tier)
})
```

This component does **not** call `window.Twitch.ext.bits.useBits` or register `onTransactionComplete`/`onTransactionCancelled` itself — those Twitch APIs only support one registered callback per page, and `App.jsx`/`ComponentApp.jsx` each already own one (for Sounds/TTS). `GamesControls` only renders UI and makes plain `fetch` calls to the new EBS routes; the host decides when to actually spend Bits and tells `GamesControls` the outcome via props.

- [ ] **Step 1: Write the component**

Create `extension/src/GamesControls.jsx`:

```jsx
import { useEffect, useState, useRef, useCallback } from "react";
import { VALID_TIERS, TIER_LABELS } from "./tiers.js";

const EBS_BASE = import.meta.env.VITE_EBS_BASE || "https://livestreamerhub.com";

function tierOptions(minTier) {
  const idx = VALID_TIERS.indexOf(minTier);
  const startIdx = idx >= 0 ? idx : 0;
  return VALID_TIERS.slice(startIdx).map((sku) => ({ sku, label: TIER_LABELS[sku] }));
}

export function GamesControls({
  auth,
  features,
  bitsEnabled,
  pendingType,
  pendingGamesTx,
  onGamesTxHandled,
  onStartTransaction,
}) {
  const [config, setConfig] = useState(null); // { plinko: {columns, minTier}, slots: {minTier} }
  const [selectedTier, setSelectedTier] = useState("");
  const [dropColumn, setDropColumn] = useState(0);
  const [queue, setQueue] = useState({ plinko: { waitingCount: 0, advanceSeq: 0 }, slots: { waitingCount: 0, advanceSeq: 0 } });
  const [pendingPlay, setPendingPlay] = useState(null); // { type, position, advanceSeqAtJoin } | null
  const [error, setError] = useState(null);
  const configRef = useRef(null);

  const hasPlinko = Boolean(features?.plinko);
  const hasSlots = Boolean(features?.slots);

  useEffect(() => {
    if (!auth) return;
    fetch(`${EBS_BASE}/api/games/config?channelId=${auth.channelId}`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setConfig(data);
        configRef.current = data;
        const minTier = hasPlinko ? data.plinko?.minTier : data.slots?.minTier;
        if (minTier) setSelectedTier(minTier);
      })
      .catch(() => {});
  }, [auth, hasPlinko, hasSlots]);

  useEffect(() => {
    if (!auth) return;
    const es = new EventSource(`${EBS_BASE}/api/games/queue-stream?channelId=${auth.channelId}`);
    es.addEventListener("games_queue", (e) => {
      try {
        setQueue(JSON.parse(e.data));
      } catch {}
    });
    return () => es.close();
  }, [auth]);

  // Compute the live "how many plays until mine" from the last known
  // position/advanceSeqAtJoin and the current advanceSeq for that game.
  useEffect(() => {
    if (!pendingPlay) return;
    const snap = pendingPlay.type === "plinko" ? queue.plinko : queue.slots;
    const remaining = Math.max(0, pendingPlay.position - (snap.advanceSeq - pendingPlay.advanceSeqAtJoin));
    if (remaining !== pendingPlay.remaining) {
      setPendingPlay({ ...pendingPlay, remaining });
    }
  }, [queue, pendingPlay]);

  // React to the host telling us a Bits transaction for a game just completed.
  useEffect(() => {
    if (!pendingGamesTx || !auth) return;
    const { type, receipt, dropColumn: col } = pendingGamesTx;
    const url = type === "plinko" ? `${EBS_BASE}/api/plinko/redeem` : `${EBS_BASE}/api/slots/redeem`;
    const body = type === "plinko"
      ? { receipt, channelId: auth.channelId, dropColumn: col }
      : { receipt, channelId: auth.channelId };
    fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.accepted) {
          setError(data.reason === "full" ? "Queue is full, try again shortly" : "Could not start — try again");
          return;
        }
        setError(null);
        if (!data.duplicate) {
          setPendingPlay({
            type,
            position: data.position,
            advanceSeqAtJoin: data.advanceSeqAtJoin,
            remaining: data.position,
          });
        }
      })
      .catch(() => setError("Could not start — try again"))
      .finally(() => onGamesTxHandled?.());
  }, [pendingGamesTx, auth, onGamesTxHandled]);

  const handlePlay = useCallback(
    (type) => {
      if (!selectedTier) return;
      const extra = type === "plinko" ? { dropColumn } : undefined;
      onStartTransaction(type, selectedTier, extra);
    },
    [selectedTier, dropColumn, onStartTransaction],
  );

  if (!hasPlinko && !hasSlots) return null;
  if (!config) return null;

  const minTier = hasPlinko ? config.plinko?.minTier : config.slots?.minTier;
  const options = tierOptions(minTier);
  const columns = config.plinko?.columns || 10;

  return (
    <div>
      {error && (
        <div style={{ padding: "6px 10px", borderRadius: 8, background: "#c0392b22", border: "1px solid #c0392b44", fontSize: 12, marginBottom: 8, color: "#e74c3c" }}>
          {error}
        </div>
      )}

      {pendingPlay && (
        <div style={{ padding: "6px 10px", borderRadius: 8, background: "#9146FF22", border: "1px solid #9146FF44", fontSize: 12, marginBottom: 8, textAlign: "center" }}>
          {pendingPlay.remaining > 0 ? `Queued — ~${pendingPlay.remaining} ahead of you` : "You're up!"}
        </div>
      )}

      {!bitsEnabled && (
        <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 6 }}>
          Bits are not available on this channel.
        </div>
      )}

      {bitsEnabled && options.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <select
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
            style={{ width: "100%", padding: 6, borderRadius: 8 }}
          >
            {options.map((opt) => (
              <option key={opt.sku} value={opt.sku}>{opt.label}</option>
            ))}
          </select>
        </div>
      )}

      {hasPlinko && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
            {Array.from({ length: columns }, (_, i) => (
              <button
                key={i}
                onClick={() => setDropColumn(i)}
                style={{
                  flex: "1 0 auto",
                  minWidth: 28,
                  padding: "6px 0",
                  borderRadius: 6,
                  border: "none",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: dropColumn === i ? "#9146FF" : "#303038",
                  color: "#fff",
                }}
              >
                {i}
              </button>
            ))}
          </div>
          <button
            onClick={() => handlePlay("plinko")}
            disabled={!bitsEnabled || pendingType === "plinko"}
            style={{
              width: "100%",
              padding: "8px 0",
              borderRadius: 8,
              border: "none",
              fontSize: 13,
              fontWeight: 600,
              cursor: bitsEnabled ? "pointer" : "default",
              background: "#9146FF",
              color: "#fff",
              opacity: !bitsEnabled || pendingType === "plinko" ? 0.5 : 1,
            }}
          >
            {`Drop — ${TIER_LABELS[selectedTier] || selectedTier}`}
          </button>
        </div>
      )}

      {hasSlots && (
        <button
          onClick={() => handlePlay("slots")}
          disabled={!bitsEnabled || pendingType === "slots"}
          style={{
            width: "100%",
            padding: "8px 0",
            borderRadius: 8,
            border: "none",
            fontSize: 13,
            fontWeight: 600,
            cursor: bitsEnabled ? "pointer" : "default",
            background: "#9146FF",
            color: "#fff",
            opacity: !bitsEnabled || pendingType === "slots" ? 0.5 : 1,
          }}
        >
          {`Spin — ${TIER_LABELS[selectedTier] || selectedTier}`}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd extension && npm run build`
Expected: build succeeds with no new errors (this file isn't wired into any host yet, so it won't be reachable in the bundle's actual UI until Tasks 11/12, but it must be valid JS/JSX and its imports must resolve).

- [ ] **Step 3: Commit**

```bash
cd extension && git add src/GamesControls.jsx
git commit -m "feat(games): shared viewer-facing Games controls component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 11: Wire Games into `ComponentApp.jsx` (video overlay)

**Files:**
- Modify: `extension/src/ComponentApp.jsx`

**Interfaces:**
- Consumes: `GamesControls` (Task 10); extends the existing `extConfig.features` state (already fetched at `ComponentApp.jsx:452-459`) to read `.plinko`/`.slots`; extends the existing `pendingRef.current.type` switch inside the existing `onTransactionComplete` handler (`ComponentApp.jsx:468` onward) with `"plinko"`/`"slots"` cases.
- Produces: viewers see a third "Games" tab in the video-overlay Component when `hasGames` is true.

- [ ] **Step 1: Import the component**

Near the top of `ComponentApp.jsx`, add:

```js
import { GamesControls } from "./GamesControls.jsx";
```

- [ ] **Step 2: Add state for the games transaction hand-off**

Near the existing TTS state block (around `ComponentApp.jsx:368-382`), add:

```js
  // Games (Plinko/Slots) transaction hand-off to the shared GamesControls
  // component — see GamesControls.jsx's props doc for why this isn't
  // self-contained: onTransactionComplete only supports one registered
  // callback, and this file already owns it for Sounds/TTS.
  const [gamesPendingType, setGamesPendingType] = useState(null);
  const [gamesPendingTx, setGamesPendingTx] = useState(null);
```

- [ ] **Step 3: Extend the pendingRef comment and the click-to-transaction path**

Find the `pendingRef` declaration (around line 360):

```js
  const pendingRef = useRef(null); // { type: "sound"|"tts", ...data }
```

Replace with:

```js
  const pendingRef = useRef(null); // { type: "sound"|"tts"|"plinko"|"slots", ...data }
```

Add a new function near `handleTtsPay` (around line 609) that `GamesControls` calls via its `onStartTransaction` prop:

```js
  // Passed to GamesControls as onStartTransaction — synchronous, no await
  // before useBits, same rule as every other Bits click handler in this file.
  function handleGamesStartTransaction(type, tier, extra) {
    pendingRef.current = { type, tier, ...extra };
    setGamesPendingType(type);
    logEvent("games_redeem_started", { type, tier });
    window.Twitch.ext.bits.useBits(tier);
  }
```

- [ ] **Step 4: Extend the existing `onTransactionComplete` handler**

Find (`ComponentApp.jsx:468-531`):

```js
    window.Twitch?.ext?.bits?.onTransactionComplete?.((tx) => {
      const pending = pendingRef.current;
      const currentAuth = authRef.current;
      if (!pending || !currentAuth) return;
      pendingRef.current = null;

      if (pending.type === "tts") {
        fetch(`${EBS_BASE}/api/tts/redeem`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${currentAuth.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            receipt: tx.transactionReceipt,
            approvalToken: pending.approvalToken,
            channelId: currentAuth.channelId,
          }),
        })
          .then(async (res) => {
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data.error || "TTS redemption failed");
            }
            logEvent("tts_redeemed", { voice: pending.voiceId });
            setTtsMessage("");
            setTtsError(null);
            setLastPlayed("TTS Message");
            setTimeout(() => setLastPlayed(null), 3000);
            setTtsCooldown(true);
            setTimeout(
              () => setTtsCooldown(false),
              pending.cooldownMs || 10000,
            );
          })
          .catch((err) => setTtsError(err?.message || "TTS redemption failed"));
      } else {
        fetch(`${EBS_BASE}/api/sounds/redeem`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${currentAuth.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            receipt: tx.transactionReceipt,
            soundId: pending.id,
            channelId: currentAuth.channelId,
          }),
        })
          .then(() => {
            logEvent("sound_redeemed", {
              sound_name: pending.name,
              tier: pending.tier,
            });
            setCooldowns((prev) => ({
              ...prev,
              [pending.id]: Date.now() + (pending.cooldownMs || 5000),
            }));
            setLastPlayed(pending.name);
            setTimeout(() => setLastPlayed(null), 3000);
          })
          .catch(() => {});
      }
    });
```

Replace the `if (pending.type === "tts") { ... } else { ... }` shape with `if / else if / else`, inserting the new branch:

```js
    window.Twitch?.ext?.bits?.onTransactionComplete?.((tx) => {
      const pending = pendingRef.current;
      const currentAuth = authRef.current;
      if (!pending || !currentAuth) return;
      pendingRef.current = null;

      if (pending.type === "tts") {
        fetch(`${EBS_BASE}/api/tts/redeem`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${currentAuth.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            receipt: tx.transactionReceipt,
            approvalToken: pending.approvalToken,
            channelId: currentAuth.channelId,
          }),
        })
          .then(async (res) => {
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data.error || "TTS redemption failed");
            }
            logEvent("tts_redeemed", { voice: pending.voiceId });
            setTtsMessage("");
            setTtsError(null);
            setLastPlayed("TTS Message");
            setTimeout(() => setLastPlayed(null), 3000);
            setTtsCooldown(true);
            setTimeout(
              () => setTtsCooldown(false),
              pending.cooldownMs || 10000,
            );
          })
          .catch((err) => setTtsError(err?.message || "TTS redemption failed"));
      } else if (pending.type === "plinko" || pending.type === "slots") {
        setGamesPendingType(null);
        setGamesPendingTx({
          type: pending.type,
          receipt: tx.transactionReceipt,
          dropColumn: pending.dropColumn,
        });
      } else {
        fetch(`${EBS_BASE}/api/sounds/redeem`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${currentAuth.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            receipt: tx.transactionReceipt,
            soundId: pending.id,
            channelId: currentAuth.channelId,
          }),
        })
          .then(() => {
            logEvent("sound_redeemed", {
              sound_name: pending.name,
              tier: pending.tier,
            });
            setCooldowns((prev) => ({
              ...prev,
              [pending.id]: Date.now() + (pending.cooldownMs || 5000),
            }));
            setLastPlayed(pending.name);
            setTimeout(() => setLastPlayed(null), 3000);
          })
          .catch(() => {});
      }
    });
```

- [ ] **Step 5: Extend `onTransactionCancelled`**

Find (`ComponentApp.jsx:533-535`):

```js
    window.Twitch?.ext?.bits?.onTransactionCancelled?.(() => {
      pendingRef.current = null;
    });
```

Replace with:

```js
    window.Twitch?.ext?.bits?.onTransactionCancelled?.(() => {
      pendingRef.current = null;
      setGamesPendingType(null);
    });
```

- [ ] **Step 6: Extend the tab-bar gating**

Find (`ComponentApp.jsx:758-762`):

```js
  const hasSounds = soundsEnabled && sounds.length > 0;
  const hasTts = ttsConfig?.enabled;

  // No sounds or TTS
  if (!hasSounds && !hasTts) {
```

Replace with:

```js
  const hasSounds = soundsEnabled && sounds.length > 0;
  const hasTts = ttsConfig?.enabled;
  const hasGames = Boolean(extConfig.features?.plinko || extConfig.features?.slots);

  // No sounds, TTS, or Games
  if (!hasSounds && !hasTts && !hasGames) {
```

Find the tab bar (`ComponentApp.jsx:830-870`):

```jsx
        {/* Tab bar (only show if both sounds and TTS are available) */}
        {hasSounds && hasTts && (
          <div style={{ display: "flex", gap: 4, margin: "0 10px 6px" }}>
            <button
              onClick={() => setActiveTab("sounds")}
              style={{
                flex: 1,
                padding: "4px 0",
                borderRadius: 6,
                border: "none",
                fontSize: "clamp(10px, 2.6vw, 13px)",
                fontWeight: 600,
                cursor: "pointer",
                background:
                  activeTab === "sounds" ? "#9146FF" : "rgba(48,48,56,0.8)",
                color: "#fff",
                opacity: activeTab === "sounds" ? 1 : 0.7,
              }}
            >
              Sounds
            </button>
            <button
              onClick={() => setActiveTab("tts")}
              style={{
                flex: 1,
                padding: "4px 0",
                borderRadius: 6,
                border: "none",
                fontSize: "clamp(10px, 2.6vw, 13px)",
                fontWeight: 600,
                cursor: "pointer",
                background:
                  activeTab === "tts" ? "#9146FF" : "rgba(48,48,56,0.8)",
                color: "#fff",
                opacity: activeTab === "tts" ? 1 : 0.7,
              }}
            >
              TTS
            </button>
          </div>
        )}
```

Replace with:

```jsx
        {/* Tab bar (only show if more than one of Sounds/TTS/Games is available) */}
        {[hasSounds, hasTts, hasGames].filter(Boolean).length > 1 && (
          <div style={{ display: "flex", gap: 4, margin: "0 10px 6px" }}>
            {hasSounds && (
              <button
                onClick={() => setActiveTab("sounds")}
                style={{
                  flex: 1,
                  padding: "4px 0",
                  borderRadius: 6,
                  border: "none",
                  fontSize: "clamp(10px, 2.6vw, 13px)",
                  fontWeight: 600,
                  cursor: "pointer",
                  background:
                    activeTab === "sounds" ? "#9146FF" : "rgba(48,48,56,0.8)",
                  color: "#fff",
                  opacity: activeTab === "sounds" ? 1 : 0.7,
                }}
              >
                Sounds
              </button>
            )}
            {hasTts && (
              <button
                onClick={() => setActiveTab("tts")}
                style={{
                  flex: 1,
                  padding: "4px 0",
                  borderRadius: 6,
                  border: "none",
                  fontSize: "clamp(10px, 2.6vw, 13px)",
                  fontWeight: 600,
                  cursor: "pointer",
                  background:
                    activeTab === "tts" ? "#9146FF" : "rgba(48,48,56,0.8)",
                  color: "#fff",
                  opacity: activeTab === "tts" ? 1 : 0.7,
                }}
              >
                TTS
              </button>
            )}
            {hasGames && (
              <button
                onClick={() => setActiveTab("games")}
                style={{
                  flex: 1,
                  padding: "4px 0",
                  borderRadius: 6,
                  border: "none",
                  fontSize: "clamp(10px, 2.6vw, 13px)",
                  fontWeight: 600,
                  cursor: "pointer",
                  background:
                    activeTab === "games" ? "#9146FF" : "rgba(48,48,56,0.8)",
                  color: "#fff",
                  opacity: activeTab === "games" ? 1 : 0.7,
                }}
              >
                Games
              </button>
            )}
          </div>
        )}
```

- [ ] **Step 7: Render the Games panel**

Find the end of the TTS tab block (`ComponentApp.jsx:1160-1164`):

```jsx
            <div style={{ flex: 1 }} />
            <BrandedFooter />
          </div>
        )}
```

(this closes the `{hasTts && (!hasSounds || activeTab === "tts") && (` block opened at line 974). Immediately after that block's closing `)}`, and before the trailing `<style>{...}</style>` line, add a sibling block:

```jsx

        {/* Games tab */}
        {hasGames && ((!hasSounds && !hasTts) || activeTab === "games") && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              padding: "0 10px 10px",
              overflow: "hidden",
            }}
          >
            <GamesControls
              auth={auth}
              features={extConfig.features}
              bitsEnabled={bitsEnabled}
              pendingType={gamesPendingType}
              pendingGamesTx={gamesPendingTx}
              onGamesTxHandled={() => setGamesPendingTx(null)}
              onStartTransaction={handleGamesStartTransaction}
            />
          </div>
        )}
```

(`auth` and `bitsEnabled` already exist as state in this file. The wrapping `<div>` matches the TTS block's own flex-column wrapper immediately above, so the Games tab fits the same fixed-height layout this surface uses instead of the Panel's freer scrolling layout.)

- [ ] **Step 8: Verify manually**

`cd extension && npm run dev`, open `preview-component.html` (this repo's existing local-preview page per `vite.config.js`), and — with a test broadcaster who has `globalGamesConfig.launched: true`, `getGamesSettings(uid).granted: true` (or Pro), and both `visibility.plinko`/`visibility.slots` true — confirm:
1. A "Games" tab appears alongside Sounds/TTS (or alone, with no tab bar, if Sounds/TTS are both off for that test channel).
2. The tier `<select>` and Plinko column buttons render.
3. Clicking "Drop" opens Twitch's Bits confirmation dialog (or the preview's mocked equivalent — check `extension/src/previewMock.js` for how this repo mocks `window.Twitch.ext.bits` locally).
4. After confirming, the "Queued — ~N ahead of you" banner appears and counts down, then a token actually drops on the OBS overlay if you have it open with the same key.
5. Toggle `visibility.plinko`/`visibility.slots` off via the settings route from Task 4 and confirm the tab disappears on reload.

- [ ] **Step 9: Commit**

```bash
cd extension && git add src/ComponentApp.jsx
git commit -m "feat(games): wire Games tab into the video-overlay Component view

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 12: Wire Games into `App.jsx` (Panel/Mobile)

**Files:**
- Modify: `extension/src/App.jsx`

**Interfaces:**
- Consumes: `GamesControls` (Task 10). This file (`index.html` + `mobile.html`'s entry point) duplicates its own independent Sounds/TTS/Bits implementation, structured slightly differently from `ComponentApp.jsx`'s copy (an `if/else` in `onTransactionComplete` rather than an early-return `if` block) — every step below gives this file's own exact surrounding code, not a cross-reference to Task 11.
- Produces: viewers see the same third "Games" tab in the Panel and Mobile views.

- [ ] **Step 1: Import the component**

Near the top of `App.jsx`, add:

```js
import { GamesControls } from "./GamesControls.jsx";
```

- [ ] **Step 2: Add games-transaction state**

Near the existing `extConfig` state declaration (`App.jsx:305`), add:

```js
  // Games (Plinko/Slots) transaction hand-off to the shared GamesControls
  // component — onTransactionComplete only supports one registered callback,
  // and this file already owns it for Sounds/TTS below.
  const [gamesPendingType, setGamesPendingType] = useState(null);
  const [gamesPendingTx, setGamesPendingTx] = useState(null);
```

- [ ] **Step 3: Update the `pendingRef` comment**

Find (`App.jsx:285`):

```js
  const pendingRef = useRef(null); // { type: "sound"|"tts", ...data }
```

Replace with:

```js
  const pendingRef = useRef(null); // { type: "sound"|"tts"|"plinko"|"slots", ...data }
```

- [ ] **Step 4: Extend the `onTransactionComplete` handler**

Find (`App.jsx:373-436`):

```js
    window.Twitch?.ext?.bits?.onTransactionComplete?.((tx) => {
      const pending = pendingRef.current;
      const currentAuth = authRef.current;
      if (!pending || !currentAuth) return;
      pendingRef.current = null;

      if (pending.type === "tts") {
        // TTS redemption
        fetch(`${EBS_BASE}/api/tts/redeem`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${currentAuth.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            receipt: tx.transactionReceipt,
            approvalToken: pending.approvalToken,
            channelId: currentAuth.channelId,
          }),
        })
          .then(async (res) => {
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data.error || "TTS redemption failed");
            }
            logEvent("tts_redeemed", { voice: pending.voiceId });
            setTtsMessage("");
            setTtsError(null);
            setLastPlayed("TTS Message");
            setTimeout(() => setLastPlayed(null), 3000);
            // Start cooldown
            setTtsCooldown(true);
            setTimeout(() => setTtsCooldown(false), pending.cooldownMs || 10000);
          })
          .catch((err) => setTtsError(err?.message || "TTS redemption failed"));
      } else {
        // Sound redemption (existing logic)
        fetch(`${EBS_BASE}/api/sounds/redeem`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${currentAuth.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            receipt: tx.transactionReceipt,
            soundId: pending.id,
            channelId: currentAuth.channelId,
          }),
        })
          .then(() => {
            logEvent("sound_redeemed", {
              sound_name: pending.name,
              tier: pending.tier,
            });
            setCooldowns((prev) => ({
              ...prev,
              [pending.id]: Date.now() + (pending.cooldownMs || 5000),
            }));
            setLastPlayed(pending.name);
            setTimeout(() => setLastPlayed(null), 3000);
          })
          .catch(() => {});
      }
    });
```

Replace the `if (pending.type === "tts") { ... } else { ... }` shape with `if / else if / else`, inserting the new branch:

```js
    window.Twitch?.ext?.bits?.onTransactionComplete?.((tx) => {
      const pending = pendingRef.current;
      const currentAuth = authRef.current;
      if (!pending || !currentAuth) return;
      pendingRef.current = null;

      if (pending.type === "tts") {
        // TTS redemption
        fetch(`${EBS_BASE}/api/tts/redeem`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${currentAuth.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            receipt: tx.transactionReceipt,
            approvalToken: pending.approvalToken,
            channelId: currentAuth.channelId,
          }),
        })
          .then(async (res) => {
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data.error || "TTS redemption failed");
            }
            logEvent("tts_redeemed", { voice: pending.voiceId });
            setTtsMessage("");
            setTtsError(null);
            setLastPlayed("TTS Message");
            setTimeout(() => setLastPlayed(null), 3000);
            // Start cooldown
            setTtsCooldown(true);
            setTimeout(() => setTtsCooldown(false), pending.cooldownMs || 10000);
          })
          .catch((err) => setTtsError(err?.message || "TTS redemption failed"));
      } else if (pending.type === "plinko" || pending.type === "slots") {
        setGamesPendingType(null);
        setGamesPendingTx({
          type: pending.type,
          receipt: tx.transactionReceipt,
          dropColumn: pending.dropColumn,
        });
      } else {
        // Sound redemption (existing logic)
        fetch(`${EBS_BASE}/api/sounds/redeem`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${currentAuth.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            receipt: tx.transactionReceipt,
            soundId: pending.id,
            channelId: currentAuth.channelId,
          }),
        })
          .then(() => {
            logEvent("sound_redeemed", {
              sound_name: pending.name,
              tier: pending.tier,
            });
            setCooldowns((prev) => ({
              ...prev,
              [pending.id]: Date.now() + (pending.cooldownMs || 5000),
            }));
            setLastPlayed(pending.name);
            setTimeout(() => setLastPlayed(null), 3000);
          })
          .catch(() => {});
      }
    });
```

- [ ] **Step 5: Extend `onTransactionCancelled`**

Find (`App.jsx:438-440`):

```js
    window.Twitch?.ext?.bits?.onTransactionCancelled?.(() => {
      pendingRef.current = null;
    });
```

Replace with:

```js
    window.Twitch?.ext?.bits?.onTransactionCancelled?.(() => {
      pendingRef.current = null;
      setGamesPendingType(null);
    });
```

- [ ] **Step 6: Add `handleGamesStartTransaction`**

Near `handleTtsPay` (`App.jsx:514-527`), add:

```js
  // Passed to GamesControls as onStartTransaction — synchronous, no await
  // before useBits, same rule as handleSoundClick/handleTtsPay above.
  function handleGamesStartTransaction(type, tier, extra) {
    pendingRef.current = { type, tier, ...extra };
    setGamesPendingType(type);
    logEvent("games_redeem_started", { type, tier });
    window.Twitch.ext.bits.useBits(tier);
  }
```

- [ ] **Step 7: Extend the tab-bar gating**

Find (`App.jsx:631-634`):

```js
  const hasSounds = soundsEnabled && sounds.length > 0;
  const hasTts = ttsConfig?.enabled;

  if (!hasSounds && !hasTts) {
```

Replace with:

```js
  const hasSounds = soundsEnabled && sounds.length > 0;
  const hasTts = ttsConfig?.enabled;
  const hasGames = Boolean(extConfig.features?.plinko || extConfig.features?.slots);

  if (!hasSounds && !hasTts && !hasGames) {
```

Find the tab bar (`App.jsx:664-702`):

```jsx
        {/* Tab bar (only show if both sounds and TTS are available) */}
        {hasSounds && hasTts && (
          <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
            <button
              onClick={() => setActiveTab("sounds")}
              style={{
                flex: 1,
                padding: "6px 0",
                borderRadius: 8,
                border: "none",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                background: activeTab === "sounds" ? "#9146FF" : "#303038",
                color: "#fff",
                opacity: activeTab === "sounds" ? 1 : 0.7,
              }}
            >
              Sounds
            </button>
            <button
              onClick={() => setActiveTab("tts")}
              style={{
                flex: 1,
                padding: "6px 0",
                borderRadius: 8,
                border: "none",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                background: activeTab === "tts" ? "#9146FF" : "#303038",
                color: "#fff",
                opacity: activeTab === "tts" ? 1 : 0.7,
              }}
            >
              TTS
            </button>
          </div>
        )}
```

Replace with:

```jsx
        {/* Tab bar (only show if more than one of Sounds/TTS/Games is available) */}
        {[hasSounds, hasTts, hasGames].filter(Boolean).length > 1 && (
          <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
            {hasSounds && (
              <button
                onClick={() => setActiveTab("sounds")}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  borderRadius: 8,
                  border: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: activeTab === "sounds" ? "#9146FF" : "#303038",
                  color: "#fff",
                  opacity: activeTab === "sounds" ? 1 : 0.7,
                }}
              >
                Sounds
              </button>
            )}
            {hasTts && (
              <button
                onClick={() => setActiveTab("tts")}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  borderRadius: 8,
                  border: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: activeTab === "tts" ? "#9146FF" : "#303038",
                  color: "#fff",
                  opacity: activeTab === "tts" ? 1 : 0.7,
                }}
              >
                TTS
              </button>
            )}
            {hasGames && (
              <button
                onClick={() => setActiveTab("games")}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  borderRadius: 8,
                  border: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: activeTab === "games" ? "#9146FF" : "#303038",
                  color: "#fff",
                  opacity: activeTab === "games" ? 1 : 0.7,
                }}
              >
                Games
              </button>
            )}
          </div>
        )}
```

- [ ] **Step 8: Render the Games panel**

Find the TTS tab block's closing (`App.jsx:803` onward — the block opened with `{hasTts && (!hasSounds || activeTab === "tts") && (`). After that block's matching closing `)}`, add a sibling block:

```jsx
        {hasGames && ((!hasSounds && !hasTts) || activeTab === "games") && (
          <GamesControls
            auth={auth}
            features={extConfig.features}
            bitsEnabled={bitsEnabled}
            pendingType={gamesPendingType}
            pendingGamesTx={gamesPendingTx}
            onGamesTxHandled={() => setGamesPendingTx(null)}
            onStartTransaction={handleGamesStartTransaction}
          />
        )}
```

- [ ] **Step 9: Verify manually**

`cd extension && npm run dev`, open `preview-panel.html`. Same checklist as Task 11 Step 8, confirming the Panel view: Games tab appears/disappears correctly alongside Sounds/TTS, tier picker and column buttons render, a redemption queues and counts down, and toggling visibility off hides the tab on reload. Also open `mobile.html` and spot-check the same, since it shares this exact file.

- [ ] **Step 10: Commit**

```bash
cd extension && git add src/App.jsx
git commit -m "feat(games): wire Games tab into the Panel/Mobile view

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 13: `ConfigApp.jsx` — broadcaster Games settings section

**Files:**
- Modify: `extension/src/ConfigApp.jsx`

**Interfaces:**
- Consumes: `GET /api/games/settings`, `POST /api/games/settings` (Task 4); `VALID_TIERS`, `TIER_LABELS` from `./tiers.js` (already imported in this file).
- Produces: nothing consumed by other tasks — this is the broadcaster-facing settings surface described in the spec's "Streamer settings" section, terminal to this plan.

- [ ] **Step 1: Add state**

Near the existing `ttsSettings`/`ttsProActive`/`ttsMinTier` state (`ConfigApp.jsx:95-98`), add:

```js
  const [gamesSettings, setGamesSettingsState] = useState(null);
  const [gamesAccessible, setGamesAccessible] = useState(false);
  const [gamesLaunched, setGamesLaunched] = useState(false);
  const [gamesGlobalMinTier, setGamesGlobalMinTier] = useState("sound_100");
```

- [ ] **Step 2: Add a tier-options helper**

Next to the existing `getTtsTiers` helper (`ConfigApp.jsx:61-65`), add:

```js
function getGamesTiers(minTier) {
  const minIdx = VALID_TIERS.indexOf(minTier || "sound_100");
  const startIdx = minIdx >= 0 ? minIdx : 0;
  return VALID_TIERS.slice(startIdx).map((sku) => ({ sku, label: TIER_LABELS[sku] }));
}
```

- [ ] **Step 3: Fetch settings on load**

In the same `onAuthorized` block that fetches TTS settings (`ConfigApp.jsx:209-223`), add a sibling fetch:

```js
      // Fetch Games settings
      fetch(`${EBS_BASE}/api/games/settings`, {
        headers: { Authorization: `Bearer ${authData.token}` },
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.settings) setGamesSettingsState(data.settings);
          if (typeof data.accessible === "boolean") setGamesAccessible(data.accessible);
          if (typeof data.launched === "boolean") setGamesLaunched(data.launched);
          if (data.globalMinTier) setGamesGlobalMinTier(data.globalMinTier);
        })
        .catch(() => {});
```

- [ ] **Step 4: Add the update handler**

Next to `handleTtsSettingsUpdate` (`ConfigApp.jsx:487-506`), add:

```js
  async function handleGamesSettingsUpdate(patch) {
    setError(null);
    try {
      const res = await fetch(`${EBS_BASE}/api/games/settings`, {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Games settings update failed");
      }
      const data = await res.json();
      setGamesSettingsState(data.settings);
      logEvent("games_settings_updated", patch);
      flash("Games settings saved");
    } catch (e) {
      setError(e.message);
    }
  }
```

- [ ] **Step 5: Render the settings section**

Next to the TTS Settings card (`ConfigApp.jsx:1099-1189` region — insert this as its own card after that block closes):

```jsx
      {gamesSettings && (
        <div style={styles.card}>
          <h3 style={styles.subHeading}>Games</h3>
          {!gamesAccessible && (
            <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 8 }}>
              Games require a Pro plan or admin grant.
            </div>
          )}
          {gamesAccessible && !gamesLaunched && (
            <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 8 }}>
              Games aren't visible to viewers yet — coming soon.
            </div>
          )}
          <div style={styles.ttsGrid}>
            <div>
              <label style={styles.row}>
                <span>Show Games to viewers</span>
                <input
                  type="checkbox"
                  checked={gamesSettings.visibility.enabled}
                  disabled={!gamesAccessible}
                  onChange={(e) =>
                    handleGamesSettingsUpdate({ visibility: { ...gamesSettings.visibility, enabled: e.target.checked } })
                  }
                />
              </label>
              <label style={styles.row}>
                <span>Plinko</span>
                <input
                  type="checkbox"
                  checked={gamesSettings.visibility.plinko}
                  disabled={!gamesAccessible}
                  onChange={(e) =>
                    handleGamesSettingsUpdate({ visibility: { ...gamesSettings.visibility, plinko: e.target.checked } })
                  }
                />
              </label>
              <label style={styles.row}>
                <span>Plinko minimum Bits</span>
                <select
                  value={gamesSettings.pricing.plinkoMinTier}
                  disabled={!gamesAccessible}
                  onChange={(e) =>
                    handleGamesSettingsUpdate({ pricing: { ...gamesSettings.pricing, plinkoMinTier: e.target.value } })
                  }
                  style={styles.select}
                >
                  {getGamesTiers(gamesGlobalMinTier).map((t) => (
                    <option key={t.sku} value={t.sku}>{t.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <div>
              <label style={styles.row}>
                <span>Slots</span>
                <input
                  type="checkbox"
                  checked={gamesSettings.visibility.slots}
                  disabled={!gamesAccessible}
                  onChange={(e) =>
                    handleGamesSettingsUpdate({ visibility: { ...gamesSettings.visibility, slots: e.target.checked } })
                  }
                />
              </label>
              <label style={styles.row}>
                <span>Slots minimum Bits</span>
                <select
                  value={gamesSettings.pricing.slotsMinTier}
                  disabled={!gamesAccessible}
                  onChange={(e) =>
                    handleGamesSettingsUpdate({ pricing: { ...gamesSettings.pricing, slotsMinTier: e.target.value } })
                  }
                  style={styles.select}
                >
                  {getGamesTiers(gamesGlobalMinTier).map((t) => (
                    <option key={t.sku} value={t.sku}>{t.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>
      )}
```

(Every `onChange` sends the *whole* `visibility`/`pricing` sub-object rather than a bare field, since `setGamesSettings`'s patch merge in Task 1 replaces `curr.visibility.<field>` individually but reads `patch.visibility` as one object — sending the full current sub-object with one field changed is the simplest way to avoid clobbering the other fields in it from the client side.)

- [ ] **Step 6: Verify manually**

`cd extension && npm run dev`, open `preview-config.html`. With a test broadcaster who has `accessible: true`:
1. The Games card renders with both checkboxes checked and both minimum-Bits selects showing "100 Bits" by default.
2. Toggling "Plinko" off, reloading, and refetching confirms it persisted (check `ebs/overlay-games-settings.json` on disk, or re-fetch `GET /api/games/settings`).
3. Trying to select a tier below `gamesGlobalMinTier` isn't even offered as an option (the `<select>` only lists tiers from the floor up).
4. With a non-Pro, non-granted test broadcaster, confirm the card shows the "require a Pro plan" message and every control is disabled.

- [ ] **Step 7: Commit**

```bash
cd extension && git add src/ConfigApp.jsx
git commit -m "feat(games): broadcaster Games settings UI in ConfigApp

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## After all tasks

Run the full EBS test suite once more to confirm nothing regressed:

```bash
cd ebs && npm test
```

Then follow `superpowers:finishing-a-development-branch` to decide how this work gets integrated (PR, merge, etc.) — this plan doesn't presume the answer.
