# Local Side-by-Side Extension UI Preview Tool — Design

Date: 2026-08-07
Status: Approved for planning

## Goal

Let the developer see the Twitch config UI (`ConfigApp.jsx`), the panel/mobile UI
(`App.jsx`), and the video-overlay component UI (`ComponentApp.jsx`) side by side
locally, hot-reloading on edits, without pushing a new extension version through
the Twitch developer console each time.

## Why this shape

Twitch Extensions can't run outside a real Twitch iframe as-is: all three view
components call into `window.Twitch.ext` (`onAuthorized`, `onContext`, `features`,
`bits`, `listen`) for auth, theming, and live data, none of which exists standalone.
The blocker is purely that missing SDK surface — the components themselves need no
changes to run standalone once it's mocked.

## Scope

New, dev-only files. **Nothing in the real production entry points or components is
modified** — zero risk to what actually ships to Twitch.

- `extension/preview.html` — shell page, three side-by-side iframes + a banner.
- `extension/preview-config.html`, `extension/preview-panel.html`,
  `extension/preview-component.html` — minimal per-view entry points, each loading
  a bootstrap that installs the `window.Twitch.ext` mock then mounts the real
  `ConfigApp` / `App` / `ComponentApp` respectively.
- `extension/src/previewTwitchMock.js` — the mock implementation.
- `ebs/scripts/mint_preview_token.mjs` — local-only script to mint a real,
  correctly-shaped broadcaster JWT using the EBS's existing `EXTENSION_SECRET`.
- None of the four new `.html` files are added to `vite.config.js`'s
  `build.rollupOptions.input` — Vite's dev server (`npm run dev`) serves any `.html`
  file in the project root without that registration; only registered entries get
  bundled into `dist/` for the real extension upload.

## Data source (per prior decision)

Real production data (`https://livestreamerhub.com`, the existing default when
`VITE_EBS_BASE` isn't overridden) for a real channel ID, authenticated with a
locally-minted real JWT — not static fixtures. `preview.html` shows a persistent
"⚠️ Connected to PRODUCTION — actions here are real" banner because of this: any
save/write action taken in the preview (e.g. saving rule settings, editing sounds)
is a real mutation against that real account.

## Twitch SDK mock surface

Exactly what was found in use across the three components — no more:

- `onAuthorized(cb)` — calls back once, synchronously, with
  `{ channelId, token, clientId: 'preview', userId: channelId }`, sourced from
  `import.meta.env.VITE_PREVIEW_CHANNEL_ID` / `VITE_PREVIEW_TOKEN`.
- `onContext(cb)` — calls back with `{ theme: 'dark', language: 'en' }` initially;
  the preview shell's theme toggle (see UI below) re-invokes registered callbacks
  with the new theme so dark/light can be checked without editing files.
- `features.isBitsEnabled` — `true`. `features.onChanged(cb)` — stored, never
  fired (no feature-flag simulation in v1).
- `bits.showBitsBalance()`, `bits.useBits(tier)` — no-ops that `console.log` what
  was called, so a click doesn't silently fail but also doesn't spend real Bits.
- `bits.onTransactionComplete(cb)`, `bits.onTransactionCancelled(cb)` — stored,
  never fired (no simulated transactions in v1, matches the "static view" decision
  for live alerts).
- `listen(target, cb)` — stored, never fired (no simulated broadcast messages in
  v1, per the earlier decision).

Each of `onAuthorized`/`onContext`/`features.onChanged` supports **multiple**
registered callbacks (push to an array, invoke all), since a single mock instance
must work correctly no matter which component registers with it — even though each
component lives in its own iframe with its own mock instance in this design, so in
practice each mock only ever gets one registrant, but supporting multiple keeps the
mock correct as a general implementation rather than accidentally relying on
single-registrant behavior.

## Token minting

`ebs/scripts/mint_preview_token.mjs`:

```bash
cd ebs && node scripts/mint_preview_token.mjs --channel <your-twitch-user-id>
```

Reads `EXTENSION_SECRET` from `ebs/.env` (via the same `dotenv/config` pattern
already used elsewhere in `ebs/`), base64-decodes it as `twitch_tokens.js`'s
`EXT_SECRET` derivation already does, signs
`{ role: 'broadcaster', channel_id, user_id: channel_id }` with `jsonwebtoken`
(already a dependency), `HS256`, 7-day expiry (dev convenience — re-run the script
to refresh). Prints:

```
VITE_PREVIEW_TOKEN=<token>
VITE_PREVIEW_CHANNEL_ID=<channel_id>
```

to paste into `extension/.env.local` — already covered by the repo's existing
`.gitignore` patterns (`.env.local`, `.env.*.local`), so the token is never
committed.

## Preview shell UI

`preview.html`: three panels in a flex row, each labeled ("Config", "Panel /
Mobile", "Component (overlay)"), each sized close to its real Twitch context
(config full-width, panel narrow ~330px, component small ~300×200px transparent
box on a checkerboard background so overlay transparency is visible). A small
control bar above the panels: a light/dark theme toggle (re-fires `onContext` in
all three iframes via `postMessage`) and the production-connection banner.

## Testing

No test harness exists for this extension (confirmed in an earlier investigation
this session). Verification: `npm run dev`, load `/preview.html`, confirm all
three panels authenticate and render real data for the configured channel, confirm
theme toggle updates all three, confirm editing `ConfigApp.jsx` hot-reloads that
panel without a manual refresh.

## Out of scope for v1

- Simulated incoming broadcast/alert events (sound alert, TTS, timer update
  pushes) — `ComponentApp.jsx` shows its static/idle state only.
- Simulated Bits transactions.
- Local EBS backend option (production only, per the decision above) — could be
  added later as a `VITE_EBS_BASE` override in `.env.local` without further design
  work, since the components already respect that env var.
