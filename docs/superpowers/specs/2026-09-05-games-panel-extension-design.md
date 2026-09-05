# Games Panel Extension — Design

Date: 2026-09-05
Status: Approved for planning

## Goal

Surface the already-shipped Plinko and Slots mini-games (currently
streamer-only, triggered manually or via a designated sound-alert redemption
from the "Extras" dashboard) as a **viewer-facing "Games" section inside the
Twitch extension itself** — Panel/Mobile (`App.jsx`) and video-overlay
Component (`ComponentApp.jsx`). Viewers use Bits to trigger a Plinko drop
(picking their own drop column) or a Slots spin; the streamer controls
whether the section exists at all, which games are in it, and the Bits price
of each. The actual drop/spin animation and payoff still happens on the
broadcast (the existing OBS overlays) — the extension is a **control and
payment surface**, not a second place the game renders.

This sits on top of the Plinko (`ebs/plinko.js`, `plinko_store.js`,
`plinko_queue.js`) and Slots (`ebs/slots.js`, `slots_store.js`) engines
exactly as shipped; neither is refactored. See
`docs/superpowers/specs/2026-09-03-slot-machine-minigame-design.md` for the
engine this design builds on — that doc explicitly deferred "a Games panel
in our own extension" as a later phase. This is that phase.

## Decisions made during brainstorming

- **Both extension surfaces** (Panel/Mobile and video-overlay Component) get
  the Games tab, mirroring how Sounds/TTS already exist in both — via one
  shared `GamesControls.jsx` component so the viewer-facing logic isn't
  duplicated even though the two host files are.
- **Flat access price, not tier-scaled payout.** The Bits amount a viewer
  pays does not change the outcome distribution or the multiplier table —
  same rule already used for Plinko/Slots sound-alert triggers ("bonus on
  top," not "bigger bonus for more Bits"). Because of this, pricing is a
  **single fixed tier per game that the streamer sets** (same as
  `sound.tier` / `ttsConfig.tier` today) — not a viewer-selectable range
  above a floor. Paying more would buy nothing, so a "streamer sets a
  minimum, viewer can exceed it" UI was considered and dropped in favor of
  matching the one-price-per-feature pattern already used everywhere else
  in this codebase.
- **Games rides the existing Pro subscription gate** (`isPro(uid)` from
  `subscription_store.js`), the same gate as TTS and video clips — no new
  Stripe plan/price.
- **Live queue position is shown to viewers**, counts-only (no other
  viewers' names), over a **new, channel-scoped SSE stream** — deliberately
  *not* the existing overlay-key-gated stream, since that key is a
  semi-private, rotatable secret meant only for the broadcaster's own OBS
  browser source and must not be handed to every viewer's extension
  instance.

## Extensibility finding: can new games ship without a new extension version?

Partial yes, and the split matters:

- **Toggling/reconfiguring games already in the bundle** (on/off, which
  games are visible, price, min tier if that's ever added) — **yes, no new
  version.** `GET /api/ext/config` already does exactly this today for
  `tts` / `videoClips` / `communityLibrary`, fetched at runtime per channel
  (`ebs/routes_sounds.js:1256`). Games extends the same `features` object.
- **A genuinely new game type** (new reel/board rendering and interaction
  code) — **no**, that requires new client code in the extension bundle,
  which means a new extension version and a new Twitch review. There is no
  way around this: Twitch reviews the actual bundle, not server-side
  config. Plinko and Slots ship in this version; a hypothetical "Game 3"
  would need its own version bump later, but that doesn't need to happen
  often.

## Architecture

### Config delivery

Two tiers, mirroring the TTS split (`features.tts` boolean +
`/api/tts/public` for the richer payload):

- **`GET /api/ext/config`** (`ebs/routes_sounds.js`) — `features` gains two
  booleans, computed server-side so the client never reasons about
  visibility/gating itself:

  ```js
  const gs = getGamesSettings(uid);
  const glob = getGlobalGamesConfig();
  const accessible = glob.launched && (isPro(uid) || gs.granted);
  features: {
    ...
    plinko: accessible && gs.visibility.enabled && gs.visibility.plinko,
    slots:  accessible && gs.visibility.enabled && gs.visibility.slots,
  }
  ```

  If both end up `false` — whether from the site-wide kill switch, the
  streamer's master toggle, or both per-game toggles being off — the client
  sees two `false`s and hides the tab. It never has to special-case "both
  off."

- **`GET /api/games/config?channelId=`** (new, `ebs/server.js`) — the
  richer payload the controls need, mirroring `/api/tts/public`:

  ```js
  { plinko: { columns, price: sku }, slots: { price: sku } }
  ```

  `columns` is derived from the streamer's actual Plinko `rows` config
  (`rows + 1`), so the viewer's column picker always matches the real
  board — never hand-maintained separately.

### Gating and the launch kill switch

New `ebs/games_store.js` (+ `ebs/games_store.test.js`), mirroring
`ebs/tts_store.js`'s structure exactly (per-user `Map`, plain
`readFile`/`writeFile` persistence — not `plinko_store.js`'s atomic
serialized-write chain, since this is low-frequency broadcaster settings
like TTS settings, not something under SSE-driven concurrent mutation like
a live board config):

```js
// overlay-games-settings.json — per broadcaster
const DEFAULT_GAMES_SETTINGS = {
  granted: false,          // admin-grant escape hatch, mirrors TTS's `granted`
  visibility: {
    enabled: true,         // master toggle, once accessible
    plinko: true,
    slots: true,
  },
  pricing: {
    plinko: "sound_100",   // reuses the existing VALID_TIERS catalog — no new SKUs
    slots: "sound_100",
  },
};

// games-global-config.json — site-wide, admin-only
let globalGamesConfig = {
  launched: false,         // OFF by default — the "hidden until Twitch approves" lever
};
```

`isPro(uid) || gs.granted` is computed inline at each call site (in
`routes_sounds.js` for `/api/ext/config`, in `server.js` for the redeem/
config routes) rather than factored into a shared exported helper — this
matches the existing convention of small per-file auth/gating helpers
(`verifyExtensionJwt` is independently redefined in three different route
files already; `isTtsAccessible` lives only inside `routes_tts.js`).

Admin routes to read/set `globalGamesConfig` go in `ebs/routes_admin.js`
next to `getGlobalTtsConfig`/`setGlobalTtsConfig` (`routes_admin.js:395-430`
is the pattern to mirror).

**Note for whoever implements this:** `isPro()` in `subscription_store.js`
currently always returns `true` ("Temporary — grant Pro to everyone for
open testing"). That's an existing, unrelated condition — Games' gating
logic should still be written against `isPro(uid)` correctly; it just won't
restrict anyone until that TODO is reverted, same as it doesn't restrict
TTS/video-clips today.

### Redemption routes

`POST /api/plinko/redeem` and `POST /api/slots/redeem`, both in
`ebs/server.js` next to the existing manual-trigger routes (`firePlinkoDrop`/
`fireSlotsSpin` are module-scoped there, not exported, so this is where
anything calling them has to live). Each mirrors `POST /api/sounds/redeem`
(`ebs/routes_sounds.js:1625`) closely:

1. `verifyExtensionJwt` — reject unauthenticated.
2. Verify the Bits transaction receipt JWT.
3. Recompute accessibility + visibility server-side (never trust the
   client's cached `features` flags) — 404/403 if the game isn't actually
   enabled right now.
4. **Verify the receipt's SKU matches `gs.pricing.plinko` /
   `gs.pricing.slots`** — stops a stale/tampered client claiming a cheaper
   tier bought the drop, same check `routes_sounds.js:1664` already does
   for sounds.
5. Dedupe by `transactionId` (existing `deduplicateTx`).
6. Call `firePlinkoDrop({ uid, overlayKey, dropColumn, source: 'bits_redeem', viewerName })`
   / `fireSlotsSpin({ uid, overlayKey, source: 'bits_redeem', viewerName })` —
   unchanged internals, same queue, same `addSeconds` choke-point, same OBS
   SSE fan-out.

Request/response:

```
POST /api/plinko/redeem  { receipt, channelId, dropColumn }
POST /api/slots/redeem   { receipt, channelId }
  → 200 { accepted: true, position, advanceSeqAtJoin, waitingCount }
  → 200 { accepted: false, reason: 'full' }
  → 400 / 403 / 404 on the failure modes above
```

`firePlinkoDrop` / `fireSlotsSpin` need a small change: return the
`queue.enqueue()` result (`{ accepted, position, waitingCount }`, see below)
to their caller instead of discarding it, so the redeem routes can surface
it. This doesn't change behavior for their existing callers (the manual
`/api/plinko/drop` and `/api/slots/spin` routes), which simply ignore the
added return value as they do today.

### Queue: position and a live, drift-proof advance counter

`ebs/plinko_queue.js` (already shared by both games — `createPlinkoQueue` is
game-agnostic per the Slots design doc) gets two additions, both derived
from state it already tracks:

1. **`enqueue()` returns a `position`** — the number of plays that happen
   before this one: `(q.playing ? 1 : 0) + (q.items.length - 1)`. Fully
   knowable at insertion time from data already in scope.
2. **A per-channel monotonic `advanceSeq` counter**, incremented once every
   time `drain()` shifts an item off the front of the queue — whether it
   gets played or is skipped for having expired. This is the one event that
   actually means "someone ahead of you cleared." `snapshot()` gains
   `advanceSeq` alongside `waitingCount`, and **`enqueue()`'s return value
   also gains the current `advanceSeq`** (read at the same moment as
   `position`) — this is what a caller passes back to the client as
   `advanceSeqAtJoin`. So `enqueue()`'s full return shape becomes
   `{ accepted, position, waitingCount, advanceSeq }`.

The client tracks its own position without any server-side per-viewer
bookkeeping: at redemption it stores `position` and the `advanceSeq` at
that moment; on every live update it computes
`remaining = max(0, position - (currentAdvanceSeq - advanceSeqAtJoin))`.
This stays correct no matter how many other viewers join the queue in the
meantime — only *advances*, not raw `waitingCount` deltas, move it down.

### Live viewer-facing queue transport

A **new SSE endpoint**, `GET /api/games/queue-stream?channelId=`
(`ebs/server.js`), deliberately separate from `/api/overlay/stream`:

- Scoped by `channelId` only, no secret key — same trust level
  `GET /api/overlay/status?channelId=` already uses (already called
  unauthenticated by `ComponentApp.jsx`).
- A new in-memory client registry, `gamesQueueClients` (`Set` of
  `{res, channelId}`), kept **separate** from the existing overlay
  `sseClients` set — the two must never be conflated, since one is
  key-gated and this one isn't.
- One connection covers both games. Event `games_queue`:

  ```js
  { plinko: { waitingCount, advanceSeq }, slots: { waitingCount, advanceSeq } }
  ```

- Broadcast from the same `onChange` hooks already wired to
  `broadcastPlinkoQueue` / `broadcastSlotsQueue` — a new
  `broadcastGamesQueueSse(channelId)` call added alongside them, not a
  replacement.
- **Deliberately omits `waiting: [{viewerName, ...}]`** — the OBS-facing
  queue payload includes other queued viewers' display names; this
  viewer-facing stream does not, by design (see Decisions above).

## Streamer settings (`ConfigApp.jsx` + new EBS routes)

`GET /api/games/settings` / `POST /api/games/settings` (broadcaster-only,
`requireBroadcaster`), returning
`{ settings, accessible: isPro(uid) || settings.granted, launched: globalGamesConfig.launched }`.

A new **"Games"** section in the config UI, following the exact
`settings.enabled` / `ttsSettings.enabled` checkbox pattern already used for
Sounds/TTS:

- Not `accessible` → an upsell/locked state, same treatment TTS gives
  non-Pro streamers today, instead of the controls.
- `accessible` but `!launched` → controls are still shown and fully
  configurable (so streamers can set everything up ahead of time), with a
  small inline note: "Games aren't visible to viewers yet — coming soon."
- **Master toggle** — "Show Games to viewers" (`visibility.enabled`).
- **Per-game toggles** — "Plinko" / "Slots" checkboxes
  (`visibility.plinko`, `visibility.slots`). No special-casing needed for
  "both off hides the section" — that's already just what
  `features.plinko === false && features.slots === false` produces.
- **Price per game** — a `<select>` of `VALID_TIERS`, reusing
  `TIER_LABELS` exactly as the existing per-sound and TTS tier dropdowns
  do. No new SKU catalog.

## Viewer flow (`GamesControls.jsx`, shared by `App.jsx` and `ComponentApp.jsx`)

1. Tab renders only if `extConfig.features.plinko || extConfig.features.slots`.
   Both host files currently gate their tab bar on exactly two boolean
   flags (`hasSounds && hasTts`) — this needs generalizing to "more than
   one of {sounds, tts, games} available shows a tab bar," a small but
   real change to existing logic in both `App.jsx` and `ComponentApp.jsx`.
2. On tab select: fetch `GET /api/games/config?channelId=`; open the one
   shared `games_queue` SSE connection.
3. **Plinko**: a row of numbered column buttons (`data-col`), reusing the
   exact button-row pattern already built for the broadcaster's manual-drop
   UI in `ebs/views/utilitiesPage.js`; a "Drop — {TIER_LABELS[price]}"
   button. No new bounds-checking needed on `dropColumn` — `simulatePlinko`
   already clamps it (`Math.min(nRows, Math.max(0, Number(dropColumn) || 0))`,
   `ebs/plinko.js`), so a stale/out-of-range value from the client is
   already handled by the existing core.
4. **Slots**: a single "Spin — {TIER_LABELS[price]}" button, no extra
   controls (matches the Slots design doc's v1 scope — no per-reel
   picking).
5. Click → `window.Twitch.ext.bits.useBits(price)` (synchronous, no `await`
   before it — matches the existing TTS/sound click handlers exactly) →
   `onTransactionComplete` → `POST /api/{plinko,slots}/redeem` with the
   receipt (+ `dropColumn` for Plinko) → response gives
   `{ position, advanceSeqAtJoin, waitingCount }` → UI shows "Queued — ~N
   ahead of you," live-decrementing via `games_queue`'s `advanceSeq`, down
   to "You're up!" — the extension never renders the drop/spin itself, the
   payoff plays on the broadcast, same as sound alerts today.
6. `onTransactionCancelled` clears pending state, mirroring the existing
   TTS/sound cancel handling exactly.

## Error handling

- Redeem routes: `400` missing/invalid receipt, `403`/`404` if the game
  isn't accessible/visible right now (streamer toggled it off mid-flight),
  `400` on SKU mismatch, queue-full → `{ accepted: false, reason: 'full' }`
  (mirrors the existing Plinko manual-drop full-queue handling) shown as
  "Queue is full, try again shortly" rather than a silent failure.
- Any redeem failure **after** a completed Bits transaction is still
  logged server-side (`addLogEntry`, existing pattern) even though the
  drop/spin didn't fire, and surfaced as an error to the viewer rather than
  swallowed — Bits were already spent, so silence isn't acceptable here,
  matching the trust bar the sound-redemption path already holds itself to.
- `computePlinkoDrop`/`computeSlotsSpin`/`sanitize*Config` are unchanged —
  still never throw.

## Testing

- **Unit**: `ebs/plinko_queue.test.js` (new — no test file exists for this
  module yet) covering `position` computation and `advanceSeq` incrementing
  on play-start and TTL-skip, including interleavings with concurrent
  enqueues from other viewers. `ebs/games_store.test.js` mirroring
  `tts_store.test.js`'s shape (load/get/set/persist/delete, gating field
  handling, tier-catalog validation on `pricing.*`).
- **Route tests**: redeem routes mirroring `routes_sounds.js`'s existing
  dedupe/SKU-mismatch coverage for `/api/sounds/redeem`.
- **Manual E2E**: toggle every visibility combination and confirm the tab
  appears/disappears correctly in both surfaces; redeem a Plinko drop
  (verify the picked column reaches `dropColumn`) and a Slots spin from
  both surfaces; queue a burst of test redemptions and confirm the live
  position countdown reaches zero in step with the broadcast; toggle
  `globalGamesConfig.launched` off and confirm the tab disappears even for
  an `accessible` streamer; confirm `/api/games/queue-stream` never emits
  viewer names.

## Explicitly out of scope for this phase

- Any change to `plinko.js` / `slots.js` outcome math — flat pricing means
  the redemption path is purely a new *trigger*, not a new *mode*.
- Viewer-selectable price tiers / "pay more than the floor" — dropped per
  the Decisions section above; revisit only if tier-scaled payouts are
  ever wanted.
- Showing other queued viewers' names/order in the extension.
- A fourth extension surface (this covers Panel/Mobile + Component; no
  mobile-specific layout beyond what `App.jsx` already handles).
- A third game type — adding one is a new-extension-version project of its
  own, per the Extensibility finding above.
