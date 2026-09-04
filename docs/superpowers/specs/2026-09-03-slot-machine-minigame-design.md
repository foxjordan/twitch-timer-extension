# Slot Machine Mini-Game — Design

Date: 2026-09-03
Status: Approved for planning

## Goal

A second chance-based mini-game in the "Extras" section, alongside Plinko: a
viewer triggers a **3-reel slot spin**, the reels land on random symbols, and the
matched symbols decide a multiplier applied to a configurable base number of
seconds, which is added to the subathon timer. The streamer sets the reel symbols
from their own Twitch / 7TV emotes (the same picker Plinko and the sound-alert
thumbnails use).

It ships as a **standalone sibling to the Plinko subsystem** — its own pure core,
per-broadcaster store, OBS browser source, routes, Extras section, and dashboard
card, each structured file-for-file like the Plinko equivalent. No Plinko code is
refactored. The only shared runtime piece is `plinko_queue.js`
(`createPlinkoQueue` is already game-agnostic — it queues items and calls
`play(item)`), which powers a second queue instance for slots.

## Hard constraints

- **Mirror Plinko, do not refactor it.** Copy the structure; touch `plinko.js` /
  `plinko_store.js` / `plinkoOverlayPage.js` only to *import* an already-exported
  value (`ALLOWED_TOKEN_HOSTS`).
- **Server-authoritative, seeded outcome.** The reels are decided by
  `computeSlotsSpin()` using a seeded PRNG (the xmur3 + mulberry32 pair already in
  `plinko.js`). The overlay and the Extras preview replay the returned `reels`
  array verbatim — no client re-rolls.
- **Timer credit through the one choke-point.** `addSeconds(uid, seconds)` in
  `ebs/state.js` (respects cap / pause / budget). The credit is **deferred** so it
  lands when the reel animation finishes, exactly as Plinko defers its drop
  credit.
- **Concurrent plays queue.** Per-channel FIFO via `createPlinkoQueue`
  (`MAX_PLINKO_QUEUE = 500`, 30-min TTL-skip, one play per `durationMs + gap`, no
  per-play timers).
- **First-party triggers only, and none in the extension for v1.** v1 triggers
  are: the manual "Spin" button on the Extras page, and one designated trigger
  **sound** (a sound the streamer redeems — not the same sound Plinko uses). A
  "Games" section in our own extension is a later phase; no third-party
  integration ever.
- **Sound-triggered spins are a bonus on top** of the sound's own Bits time
  (same rule as Plinko's sound trigger). `test` fires bypass the queue and never
  touch the timer.
- **No new dependencies. No DB.** Config persists as a per-broadcaster JSON file
  on the `/data` volume via `atomicWriteFile`, exactly like `plinko_store.js`.

## Config schema

`ebs/slots.js` exports `DEFAULT_SLOTS_CONFIG`:

```js
{
  baseSeconds: 30,          // lower than Plinko's 60 — every spin now pays >= 1x
  symbols: [                // 2..8 entries
    { emote: { name: '', url: '', source: '' }, weight: 1, tripleMultiplier: 2 },
    { emote: { name: '', url: '', source: '' }, weight: 1, tripleMultiplier: 4 },
    { emote: { name: '', url: '', source: '' }, weight: 1, tripleMultiplier: 10 },
  ],
  anyTwoMultiplier: 1.5,    // paid when exactly two reels match
  noMatchMultiplier: 1.0,   // paid when all three differ — "always at least base"
  triggerSoundId: '',       // a redeemed sound that auto-spins; '' = off
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
}
```

### `sanitizeSlotsConfig(patch, base = DEFAULT_SLOTS_CONFIG)` — never throws

| field | rule |
|---|---|
| `baseSeconds` | `Number`, clamp `[1, 3600]`, `Math.floor` |
| `symbols` | coerce to an array of length `[MIN_SYMBOLS=2, MAX_SYMBOLS=8]`; too few → pad with a centre-default symbol, too many → truncate |
| `symbols[].weight` | `Number`, clamp `[1, 1000]`, `Math.round` |
| `symbols[].tripleMultiplier` | `Number`, clamp `[1, 100]` |
| `symbols[].emote.url` | must parse as `https:` with hostname in `ALLOWED_TOKEN_HOSTS` (imported from `./plinko.js`); else `''` |
| `symbols[].emote.name` | `String`, `.slice(0, 100)` |
| `symbols[].emote.source` | one of `twitch`, `7tv`, `''` |
| `anyTwoMultiplier` | `Number`, clamp `[1, 100]` |
| `noMatchMultiplier` | `Number`, clamp `[1, 100]` |
| `triggerSoundId` | `String`, `.slice(0, 64)` |
| `style` | per-key merge over `DEFAULT_SLOTS_CONFIG.style`: booleans coerced; `*Color` validated against `/^#([0-9a-fA-F]{3}){1,2}$/` else the default; `panelOpacity` / `*Volume` clamped `[0, 1]` |

## Outcome computation

`computeSlotsSpin(config, { seed })` → `{ reels, matchKind, multiplier, secondsToAdd }`

```
h    = xmur3(String(seed))
rand = mulberry32(h())

weightedPick(symbols, r):        // r in [0,1)
  total = Σ weight
  x = r * total
  for i in 0..n-1: x -= symbols[i].weight; if x < 0 return i
  return n - 1                   // fp guard

reels = [ weightedPick(symbols, rand()),
          weightedPick(symbols, rand()),
          weightedPick(symbols, rand()) ]   // indices into config.symbols

[a, b, c] = reels
if a === b && b === c:  matchKind = 'triple'; multiplier = symbols[a].tripleMultiplier
elif a === b || b === c || a === c:  matchKind = 'pair';  multiplier = config.anyTwoMultiplier
else:  matchKind = 'none'; multiplier = config.noMatchMultiplier

secondsToAdd = Math.floor(config.baseSeconds * multiplier)
```

- **Deterministic:** same `{seed}` → identical `reels`.
- `reels` holds **indices** into `config.symbols`; the overlay maps them to emote
  URLs from the payload.
- Edge: with exactly 2 symbols, `matchKind` is never `'none'` (pigeonhole across
  3 reels) — acceptable, documented.
- All multipliers are `>= 1`, so `secondsToAdd >= floor(baseSeconds)` on every
  spin.

## Architecture

```
Extras page (utilitiesPage.js, "Slots" section)
  ├── config: GET/POST /api/slots/config  ──► slots_store.js ──► overlay-slots.json
  ├── symbol picker: reuses GET /api/sounds/{twitch,seventv}-emotes
  └── "Spin" / "Test" ──► POST /api/slots/spin { test? }
                              │
   server.js: fireSlotsSpin() → computeSlotsSpin({symbols, seed})
                              │  multiplier / secondsToAdd
                              ├─ test → fanOutSlotsSpin() now, no queue, no credit
                              └─ else → slotsQueue.enqueue(uid, {...})
                                          │  (one at a time, per channel)
                                          ▼
                            playSlotsSpin(item):
                              ├─ lastSlotsSpinByKey.set(cacheKey, payload)
                              ├─ fanOutSlotsSpin(overlayKey, boardId, payload)  ── SSE: slots_spin
                              └─ setTimeout(durationMs):
                                   addSeconds(uid, secondsAdded)               [state.js choke-point]
                                   addLogEntry({ type:'slots_spin', ... })
                                   broadcastToChannel(uid, 'timer_add', …)
                                          │
         /overlay/slots?key=…  (slotsOverlayPage.js, its own browser source)
              EventSource('/api/overlay/stream?key=…&boardId=…')
              on 'slots_spin'  → animate 3 reels, stop L→R, flash match, +Ns float
              on 'slots_board' → restyle without a spin
              on 'slots_queue' → "▶ now / next" header
```

Transport is **SSE only**, reusing `/api/overlay/stream` and the existing
`sseClients` fan-out, late-join cache, and 30s heartbeat.

## New components

- **`ebs/slots.js`** (+ `ebs/slots.test.js`) — pure core. `MIN_SYMBOLS = 2`,
  `MAX_SYMBOLS = 8`, `SLOTS_DURATION_MS = 2600`. Exports `DEFAULT_SLOTS_CONFIG`,
  `computeSlotsSpin(config, { seed })`, `sanitizeSlotsConfig(patch, base?)`.
  Imports `ALLOWED_TOKEN_HOSTS` from `./plinko.js`; re-implements the xmur3 +
  mulberry32 pair locally (a few lines each — `plinko.js` keeps its PRNG private,
  so `slots.js` does too rather than adding a cross-module dependency).
  Tests: determinism; weighted distribution roughly tracks weights over N seeds;
  `matchKind` / `multiplier` selection for triple / pair / none; `secondsToAdd`
  floor; `sanitizeSlotsConfig` clamps (baseSeconds, symbol count pad/truncate,
  weight, tripleMultiplier, emote-host reject, anyTwo/noMatch floors, style
  merge); no-patch call returns the default.

- **`ebs/slots_store.js`** (+ `ebs/slots_store.test.js`) — mirrors
  `plinko_store.js` exactly, including the serialized `persistChain` promise.
  `SLOTS_PATH = path.resolve(DATA_DIR, 'overlay-slots.json')`. Exports
  `loadSlotsConfig()`, `getSlotsConfig(uid)` (merged copy over
  `DEFAULT_SLOTS_CONFIG`), `setSlotsConfig(uid, patch)`, `deleteSlotsConfig(uid)`.

- **`ebs/views/slotsOverlayPage.js`** — `renderSlotsOverlayPage()`, one
  self-contained HTML string (inline `<style>` + IIFE `<script>`). **DOM-based
  reels** (three vertical `<img>` strips), not canvas — crisper for emotes.
  Size ≈ **540 × 220**.
  - Query params: `key` (required), `boardId` (optional, `"default"` in v1),
    optional base64 `config` for idle geometry before the first spin.
  - `connectSSE()` → `EventSource('/api/overlay/stream?key=…&boardId=…')` with the
    same close/backoff reconnect as the Wheel/Plinko overlays.
  - On `slots_spin`: each reel scrolls fast then eases to rest on its target
    symbol; reels stop **staggered L→R at 1400 / 1900 / 2400 ms**; a reel-stop
    sound plays as each reel lands (`style.reelSound` / `reelSoundVolume`, pooled
    `Audio`); on settle, flash the matching symbols + panel, play the win sound
    (`style.winSound` / `winSoundVolume`), float `+{secondsAdded}s` for ~2.5s
    (suppressed when `payload.test`), then fade to idle.
  - On `slots_board`: apply `symbols` + `style` + `baseSeconds`, redraw idle.
  - On `slots_queue`: draw a "▶ nowName / next: name +N" header in the top band
    when `showStatus` and there is queue activity.
  - Late-join: replay cached `slots_spin`, then `slots_board`, then `slots_queue`.
  - Audio assets: `/assets/slots_reel_stop.mp3`, `/assets/slots_win.wav`
    (streamer-supplied, dropped into `ebs/assets/`; absent files fail silently).

## Modified components

- **`ebs/server.js`**
  - Import `getSlotsConfig`, `setSlotsConfig`, `loadSlotsConfig` from
    `./slots_store.js`; `computeSlotsSpin`, `SLOTS_DURATION_MS` from `./slots.js`.
  - Boot: `loadSlotsConfig().catch(() => {})` next to `loadPlinkoConfig()`.
  - Module-level `lastSlotsSpinByKey`, `lastSlotsBoardByKey`,
    `lastSlotsQueueByKey` `Map`s; `const slotsQueue = createPlinkoQueue({ play: (item) => playSlotsSpin(item), onChange: (cid) => broadcastSlotsQueue(cid) });`.
  - Module-scoped functions (mirror the Plinko ones):
    - `fanOutSlotsSpin(overlayKey, boardId, payload)` — SSE `event: slots_spin`
      to `sseClients` where `client.key === overlayKey` (and `boardId` matches if
      both set).
    - `broadcastSlotsQueue(channelId)` — resolve
      `normKey(getOrCreateUserKey(channelId))`, cache `lastSlotsQueueByKey`, fan
      `event: slots_queue`.
    - `playSlotsSpin(item)` — cache `lastSlotsSpinByKey`, `fanOutSlotsSpin`, then
      `setTimeout(item.durationMs)` → `addSeconds` + `addLogEntry({ type:'slots_spin', matchKind, multiplier, appliedSeconds, actualSeconds, userId, source, viewerName })` +
      `broadcastToChannel('timer_add')`.
    - `fireSlotsSpin({ uid, overlayKey, boardId = '', test = false, source = 'manual', viewerName = '' })` —
      `cfg = getSlotsConfig(uid)`; `seed = crypto.randomUUID()`;
      `{ reels, matchKind, multiplier, secondsToAdd } = computeSlotsSpin(cfg, { seed })`;
      build `payload = { spinId, seed, reels, symbols: cfg.symbols.map(s => s.emote), matchKind, multiplier, secondsAdded: test ? 0 : secondsToAdd, baseSeconds: cfg.baseSeconds, style: cfg.style, durationMs: SLOTS_DURATION_MS, test, source, viewerName, triggeredAt: Date.now() }`;
      `test` → `fanOutSlotsSpin` immediately (no queue, no credit); else
      `slotsQueue.enqueue(uid, { ...payload, uid, overlayKey, boardId })`, and
      `addLogEntry({ type:'slots_spin_rejected', ... })` if `!accepted`.
  - **`POST /api/slots/spin`** next to `/api/plinko/drop`: `req.session.isAdmin`
    gate; resolve `uid` / `overlayKey` the same way; body `{ test?: boolean }`;
    calls `fireSlotsSpin({ uid, overlayKey, source:'manual', viewerName:'Streamer', test: !!req.body?.test })`; `res.json(payload)`.
  - **`GET /api/slots/config` / `POST /api/slots/config`** mirroring the Plinko
    config routes: session/admin, resolve managed broadcaster id, `getSlotsConfig`
    / `setSlotsConfig`. After a successful `POST`, broadcast `slots_board` SSE
    (`{ symbols, style, baseSeconds }`) + cache `lastSlotsBoardByKey` + patch
    cached spins, so a running overlay restyles on Save.
  - **SSE `/api/overlay/stream`** on-connect replay: after the Plinko replays,
    replay `lastSlotsSpinByKey` → `lastSlotsBoardByKey` → `lastSlotsQueueByKey`
    (board last so its look wins).
  - **`handleSoundAlert`** end, after the Plinko trigger branch:
    ```js
    if (!isTestAlert) {
      const sk = getSlotsConfig(String(channelId));
      if (sk.triggerSoundId && String(soundId) === sk.triggerSoundId) {
        (async () => {
          let viewerName = viewerUserId
            ? (await fetchUserDisplayName(viewerUserId, channelId).catch(() => '')) || ''
            : '';
          fireSlotsSpin({
            uid: String(channelId),
            overlayKey: normKey(getOrCreateUserKey(String(channelId))),
            source: 'sound_alert',
            viewerName: viewerName || viewerUserId || 'Someone',
          });
        })().catch(() => {});
      }
    }
    ```

- **`ebs/routes_overlay_page.js`** — `app.get("/overlay/slots", (req, res) => { if (!requireOverlayAuth(req, res)) return; res.send(renderSlotsOverlayPage()); … no-cache headers })`, next to `/overlay/plinko`.

- **`ebs/routes_home_page.js`** — `GET /utilities` passes
  `slotsOverlayBase: "/overlay/slots"` into `renderUtilitiesPage`.

- **`ebs/views/utilitiesPage.js`** — new **"Slots"** sidebar nav item placed
  immediately after "Plinko" (order: Plinko, Slots, Wheels, Quick Tools — Prompts
  stays hidden). New `data-section="slots"` section (not `active` by default —
  Plinko remains the default). Contents:
  - **Board settings:** `baseSeconds` number input; a symbol list (2–8 rows), each
    row = emote picker button + current thumbnail + `weight` number + `tripleMultiplier`
    number + a remove button; an "Add symbol" button (disabled at 8); the emote
    grid fed by `GET /api/sounds/{twitch,seventv}-emotes`; `anyTwoMultiplier` and
    `noMatchMultiplier` inputs (min 1); "Auto-spin on sound alert" `<select>` from
    `GET /api/sounds` with a soft inline warning if the chosen id equals the
    Plinko `triggerSoundId`; overlay style controls (panel on/off + color +
    opacity, reel color, text color, status line on/off, reel-sound on/off +
    volume, win-sound on/off + volume); **Save** → `POST /api/slots/config`.
  - **Spin card:** "Spin" → `POST /api/slots/spin`; "Test" → `{ test: true }`; a
    live "Now spinning / Up next" panel fed by the `slots_queue` SSE event; a
    small DOM preview that animates from the `slots_spin` SSE (lock-step with the
    overlay, `previewBusy` guard); a **Copy Browser Source link** built with
    `window.location.origin` + `slotsOverlayBase + '?key=' + overlayKey + '&boardId=default'`
    and a "540 × 220" size hint.
  - JS: `connectSlotsStream()` EventSource listening `slots_spin` → `animatePreview`,
    `slots_queue` → `renderQueue`; `readStyle()`; audio pools; `loadConfig()` /
    `populateSounds()` via `Promise.all`.

- **`ebs/views/dashboardPage.js`** — a **Slots** entry in the `overlays` array
  immediately after the Plinko entry:
  `{ tag: "Slots", title: "Slot Machine overlay", desc: "Viewers spin a 3-reel slot — matched symbols multiply the time added to your subathon timer.", url: \`${base}/overlay/slots${keyQs}${keyQs ? "&" : "?"}boardId=default\`, configHref: \`${base}/utilities#slots\`, configLabel: "Open Configurator" }`.

- **`ebs/user_data_deletion.js`** — import `deleteSlotsConfig` from
  `./slots_store.js`; a step `if (deleteSlotsConfig(uid)) deleted.push("slots");`
  next to the Plinko one.

- **`.gitignore`** — add `ebs/overlay-slots.json`.

## SSE event payloads

| event | payload |
|---|---|
| `slots_spin` | `{ spinId, seed, reels: number[3], symbols: [{name,url,source}], matchKind: 'triple'\|'pair'\|'none', multiplier, secondsAdded, baseSeconds, style, durationMs, test, source, viewerName, triggeredAt }` |
| `slots_board` | `{ symbols: [{name,url,source}], style, baseSeconds }` |
| `slots_queue` | `{ nowPlaying: {viewerName, source}\|null, waiting: [{viewerName, source}], waitingCount }` |

`symbols` in `slots_spin` is `config.symbols.map(s => s.emote)` so the overlay can
render each reel index without holding the multiplier table.

**`boardId` in v1:** every fire uses `boardId = ''`, so — exactly as in Plinko —
the late-join cache key is the bare `overlayKey` and the fan-out does not filter
on `boardId`. The overlay and the dashboard card still pass `&boardId=default`
in the URL (harmless, forward-compatible); it simply isn't matched yet.

## Error handling

- `computeSlotsSpin` and `sanitizeSlotsConfig` never throw — bad input falls back
  to the default (same contract as `plinko.js`).
- `POST /api/slots/config` returns `400` on a body that isn't an object; on any
  store error returns `500 { error }` like the Plinko config route.
- `POST /api/slots/spin` with the config having `< 2` real symbols (all emote URLs
  empty) still spins — reels just show blank frames; the streamer sees a hint in
  the Extras section prompting them to pick symbols. It never 500s.
- A queue-full `enqueue` result logs `slots_spin_rejected` and the manual route
  responds `{ accepted: false, reason: 'full' }` (mirrors Plinko).
- Overlay: a missing audio asset or a broken emote URL fails silently; the reel
  renders an empty cell.

## Testing

- **Unit (`node:test`, matching the Plinko test files):**
  - `slots.js`: determinism; weighted distribution; triple / pair / none
    detection and the multiplier chosen for each; `secondsToAdd` floor; the
    2-symbol "no `none`" edge; `sanitizeSlotsConfig` clamps and the no-patch
    default.
  - `slots_store.js`: 9 tests mirroring `plinko_store.test.js` (load, get merged,
    set + persist, partial patch merge, delete, serialized writes).
- **Manual E2E:**
  1. Extras → Slots: set `baseSeconds`, add 3 symbols from channel emotes with
     weights + triple multipliers, set `anyTwoMultiplier` / `noMatchMultiplier`,
     Save. Reload — persists (`ebs/overlay-slots.json` written).
  2. Open `/overlay/slots?key=<key>&boardId=default` as an OBS browser source —
     idle board renders with the right symbols.
  3. Click **Spin** — 3 reels animate and stop L→R; the timer jumps by
     `floor(baseSeconds × multiplier)` when the animation finishes (not before);
     a `slots_spin` log entry and a `timer_add` broadcast are emitted; the Extras
     preview matches the overlay.
  4. Reload the overlay while idle → the last spin replays once, then idle.
  5. **Test** → animation plays, timer unchanged, no log entry, no `timer_add`.
  6. Set a trigger sound (different from Plinko's), redeem it → a spin fires from
     a random seed, `source: 'sound_alert'`, bonus on top of the sound's Bits
     time; concurrent redemptions queue and play one at a time.
  7. Save a style change while the overlay is open → it restyles without a
     reload (`slots_board`).
  8. Delete-user path removes `overlay-slots.json` and reports `"slots"`.

## Explicitly out of scope for v1

- Any extension UI. The "Games" panel section is a later phase.
- Per-reel symbol strips (all reels share one weighted pool).
- Configurable reel count (fixed at 3).
- Press-your-luck / re-spin / hold mechanics.
- A losing spin subtracting time (every spin adds ≥ base).
- Multiple independent slot boards per broadcaster (schema carries `boardId` for
  later; v1 is `"default"`).
- Re-hosting emote images (the overlay links straight to the Twitch / 7TV CDN).
- Bespoke bundled audio — the streamer supplies `slots_reel_stop.mp3` /
  `slots_win.wav`.
- Generalising Plinko + Slots into one shared `minigame` engine (revisit when a
  third game exists).
