# Local Extension UI Preview Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** See the config, panel/mobile, and component (overlay) extension UIs side by side locally, hot-reloading on edits, hitting real production data, without pushing to the Twitch dev console.

**Architecture:** Each real view component (`ConfigApp.jsx`/`App.jsx`/`ComponentApp.jsx`) already self-mounts via `ReactDOM.createRoot(document.getElementById("root")).render(<X />)` at module load — so a preview entry HTML just needs a `#root` div and a `window.Twitch.ext` mock installed *before* the component's own script tag runs (ES module scripts execute in document order). No bootstrap/import wrapper needed; the real component files are loaded completely unmodified.

**Tech Stack:** Vite dev server (existing), plain ES modules, `jsonwebtoken` (already an `ebs/` dependency).

Design doc: [docs/superpowers/specs/2026-08-07-extension-ui-preview-tool-design.md](../specs/2026-08-07-extension-ui-preview-tool-design.md)

## Global Constraints

- Zero changes to any real production entry point or component (`config.html`, `index.html`, `mobile.html`, `component.html`, `ConfigApp.jsx`, `App.jsx`, `ComponentApp.jsx`).
- New `.html` files must NOT be added to `vite.config.js`'s `build.rollupOptions.input` — they must only be reachable via the dev server, never bundled into the real extension upload.
- Real production data (`https://livestreamerhub.com`), real signed JWT — no static fixtures.
- `preview.html` must show a persistent "connected to production" warning.

---

### Task 1: Token minting script

**Files:**
- Create: `ebs/scripts/mint_preview_token.mjs`

**Interfaces:**
- Produces: a CLI script printing `VITE_PREVIEW_TOKEN=...` / `VITE_PREVIEW_CHANNEL_ID=...` lines — consumed manually by the developer (pasted into `extension/.env.local`), not imported by any other code.

- [ ] **Step 1: Write the script**

```js
#!/usr/bin/env node
/**
 * Mints a real, correctly-shaped Twitch-extension broadcaster JWT for local
 * preview use (see extension/preview.html) — signed with the same
 * EXTENSION_SECRET the EBS's verifyExtensionJwt() already trusts, so the
 * preview hits real production data as the given channel.
 *
 * Usage:
 *   cd ebs && node scripts/mint_preview_token.mjs --channel <twitch-user-id>
 *
 * Prints two lines to paste into extension/.env.local (already gitignored).
 */
import 'dotenv/config';
import jwt from 'jsonwebtoken';

function parseChannelArg() {
  const idx = process.argv.indexOf('--channel');
  if (idx === -1 || !process.argv[idx + 1]) {
    console.error('Usage: node scripts/mint_preview_token.mjs --channel <twitch-user-id>');
    process.exit(1);
  }
  return process.argv[idx + 1];
}

const channelId = parseChannelArg();

const secretRaw = process.env.EXTENSION_SECRET;
if (!secretRaw) {
  console.error('EXTENSION_SECRET is not set in ebs/.env');
  process.exit(1);
}
// Same base64 decode verifyExtensionJwt()'s EXT_SECRET derivation uses
// (see ebs/routes_sounds.js) — Twitch issues this secret base64-encoded.
const secret = Buffer.from(secretRaw, 'base64');

const token = jwt.sign(
  { role: 'broadcaster', channel_id: channelId, user_id: channelId },
  secret,
  { algorithm: 'HS256', expiresIn: '7d' },
);

console.log(`VITE_PREVIEW_TOKEN=${token}`);
console.log(`VITE_PREVIEW_CHANNEL_ID=${channelId}`);
```

- [ ] **Step 2: Verify**

```bash
cd ebs && node scripts/mint_preview_token.mjs --channel 123456789
```

Expected: two `VITE_PREVIEW_*` lines printed, no errors. Decode the token at jwt.io (or `node -e "console.log(require('jsonwebtoken').decode(process.argv[1]))" '<token>'`) and confirm the payload is exactly `{ role: 'broadcaster', channel_id: '123456789', user_id: '123456789', iat, exp }`.

- [ ] **Step 3: Commit**

```bash
git add ebs/scripts/mint_preview_token.mjs
git commit -m "Add local preview JWT minting script

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Shared Twitch SDK mock module

**Files:**
- Create: `extension/src/previewMock.js`

**Interfaces:**
- Produces: `installPreviewTwitchMock({ channelId, token })` — called by each preview entry HTML's inline module script (Task 3), before that file's real component script tag. Sets `window.Twitch.ext` and installs a `message` listener for live theme updates from the preview shell (Task 4).

- [ ] **Step 1: Write the module**

```js
/**
 * Installs a mock window.Twitch.ext covering exactly the SDK surface
 * extension/src/{App,ComponentApp,ConfigApp}.jsx actually call — see the
 * design doc for how this list was derived. Dev/preview-only; never
 * imported by any real production entry point.
 */
export function installPreviewTwitchMock({ channelId, token }) {
  const authListeners = [];
  const contextListeners = [];
  const featureChangeListeners = [];
  let currentContext = { theme: 'dark', language: 'en' };

  window.Twitch = {
    ext: {
      onAuthorized(cb) {
        authListeners.push(cb);
        cb({ channelId, token, clientId: 'preview', userId: channelId });
      },
      onContext(cb) {
        contextListeners.push(cb);
        cb(currentContext);
      },
      features: {
        isBitsEnabled: true,
        onChanged(cb) {
          featureChangeListeners.push(cb);
        },
      },
      bits: {
        showBitsBalance() {
          console.log('[preview] bits.showBitsBalance() called');
        },
        useBits(tier) {
          console.log('[preview] bits.useBits() called with tier', tier);
        },
        onTransactionComplete() {
          // Not fired in v1 — no simulated transactions.
        },
        onTransactionCancelled() {
          // Not fired in v1 — no simulated transactions.
        },
      },
      listen() {
        // Not fired in v1 — no simulated broadcast/alert messages.
      },
    },
  };

  // Lets the preview shell (extension/preview.html) push a live theme
  // change into this iframe without a full reload.
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type !== 'preview-theme') return;
    currentContext = { ...currentContext, theme: event.data.theme };
    contextListeners.forEach((cb) => cb(currentContext));
  });
}
```

- [ ] **Step 2: Verify**

```bash
cd extension && node --check src/previewMock.js
```

Expected: no syntax errors. (Full behavioral verification happens in Task 5, once it's wired into a real page.)

- [ ] **Step 3: Commit**

```bash
git add extension/src/previewMock.js
git commit -m "Add shared Twitch SDK mock for local extension UI preview

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Preview entry pages for each real view

**Files:**
- Create: `extension/preview-config.html`, `extension/preview-panel.html`, `extension/preview-component.html`

**Interfaces:**
- Consumes: `installPreviewTwitchMock` (Task 2), `import.meta.env.VITE_PREVIEW_CHANNEL_ID`/`VITE_PREVIEW_TOKEN` (from `extension/.env.local`, Task 1's output).
- Produces: three URLs the preview shell (Task 4) embeds as iframes: `/preview-config.html`, `/preview-panel.html`, `/preview-component.html`.

Each file mirrors its real counterpart's `<head>`/`<body>` exactly (same background/color/font so there's no visual mismatch from the shell around it), swapping only the Twitch helper `<script>` for the mock-install block, placed *before* the real component's script tag so the mock exists when that component's `useEffect` registers with it.

- [ ] **Step 1: Create `extension/preview-config.html`**

(Real counterpart: `extension/config.html`, loads `ConfigApp.jsx`.)

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Preview: Config</title>
  </head>
  <body style="margin:0;background:#0e0e10;color:#efeff1;font-family:Inter,system-ui,Arial,sans-serif">
    <div id="root"></div>
    <script type="module">
      import { installPreviewTwitchMock } from '/src/previewMock.js';
      installPreviewTwitchMock({
        channelId: import.meta.env.VITE_PREVIEW_CHANNEL_ID,
        token: import.meta.env.VITE_PREVIEW_TOKEN,
      });
    </script>
    <script type="module" src="/src/ConfigApp.jsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `extension/preview-panel.html`**

(Real counterpart: `extension/index.html`, loads `App.jsx`. Check `extension/index.html`'s exact `<body>` background/style first and match it — don't assume it's identical to config.html's.)

Same structure as Step 1, with `<title>Preview: Panel</title>`, matching `index.html`'s actual `<body>` styling, and the final script tag pointing at `/src/App.jsx` instead.

- [ ] **Step 3: Create `extension/preview-component.html`**

(Real counterpart: `extension/component.html`, loads `ComponentApp.jsx`. Check `extension/component.html`'s exact `<body>` styling first — the component view is a transparent overlay in production, so its real background may differ from config/panel's opaque dark background; match whatever it actually is.)

Same structure, `<title>Preview: Component</title>`, final script tag pointing at `/src/ComponentApp.jsx`.

- [ ] **Step 4: Verify**

```bash
cd extension && node --check preview-config.html 2>/dev/null; echo "(html files aren't node-checkable — just confirm no typos by eye and that each references the correct real component path)"
```

Read all three files back and confirm: each `<script type="module" src="/src/...">` path matches its real counterpart's, each mock-install block appears before that script tag, and no file was accidentally added to `vite.config.js` (grep to confirm — see Task 4's verification for the combined check).

- [ ] **Step 5: Commit**

```bash
git add extension/preview-config.html extension/preview-panel.html extension/preview-component.html
git commit -m "Add per-view preview entry pages for local extension UI preview

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Preview shell page

**Files:**
- Create: `extension/preview.html`

**Interfaces:**
- Consumes: the three preview entry pages from Task 3, embedded as iframes.
- Produces: the top-level `npm run dev` → `http://localhost:5173/preview.html` URL the developer actually opens.

- [ ] **Step 1: Write the shell**

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Extension UI Preview</title>
    <style>
      body {
        margin: 0;
        font-family: Inter, system-ui, Arial, sans-serif;
        background: #18181b;
        color: #efeff1;
      }
      .banner {
        background: #dc2626;
        color: #fff;
        padding: 8px 16px;
        font-size: 13px;
        font-weight: 600;
        text-align: center;
      }
      .controls {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 16px;
        border-bottom: 1px solid #303038;
      }
      .controls button {
        cursor: pointer;
        background: #2c2c31;
        color: #efeff1;
        border: 1px solid #3a3a3d;
        border-radius: 6px;
        padding: 6px 12px;
        font-size: 13px;
      }
      .panels {
        display: flex;
        gap: 16px;
        padding: 16px;
        align-items: flex-start;
        flex-wrap: wrap;
      }
      .panel-col {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .panel-label {
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        opacity: 0.7;
      }
      iframe {
        border: 1px solid #303038;
        border-radius: 8px;
        background: #0e0e10;
      }
      #component-frame-wrap {
        background:
          linear-gradient(45deg, #2c2c31 25%, transparent 25%, transparent 75%, #2c2c31 75%),
          linear-gradient(45deg, #2c2c31 25%, transparent 25%, transparent 75%, #2c2c31 75%);
        background-size: 16px 16px;
        background-position: 0 0, 8px 8px;
        border-radius: 8px;
      }
    </style>
  </head>
  <body>
    <div class="banner">⚠️ Connected to PRODUCTION (livestreamerhub.com) — actions taken here are real</div>
    <div class="controls">
      <button id="theme-toggle">Toggle theme (currently dark)</button>
    </div>
    <div class="panels">
      <div class="panel-col">
        <div class="panel-label">Config</div>
        <iframe src="/preview-config.html" width="420" height="700"></iframe>
      </div>
      <div class="panel-col">
        <div class="panel-label">Panel / Mobile</div>
        <iframe src="/preview-panel.html" width="330" height="700"></iframe>
      </div>
      <div class="panel-col">
        <div class="panel-label">Component (overlay)</div>
        <div id="component-frame-wrap">
          <iframe src="/preview-component.html" width="300" height="200" style="background:transparent"></iframe>
        </div>
      </div>
    </div>
    <script>
      let theme = 'dark';
      const btn = document.getElementById('theme-toggle');
      btn.addEventListener('click', () => {
        theme = theme === 'dark' ? 'light' : 'dark';
        btn.textContent = `Toggle theme (currently ${theme})`;
        document.querySelectorAll('iframe').forEach((frame) => {
          frame.contentWindow.postMessage({ type: 'preview-theme', theme }, window.location.origin);
        });
      });
    </script>
  </body>
</html>
```

- [ ] **Step 2: Verify no build-entry leakage**

```bash
grep -n "preview" /Users/jordanfox/Documents/twitch-timer-extension/extension/vite.config.js
```

Expected: no output — confirms none of the four new preview `.html` files were (accidentally, by some other step) added to the production build entries.

- [ ] **Step 3: Commit**

```bash
git add extension/preview.html
git commit -m "Add side-by-side preview shell for local extension UI preview

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Mint a token and configure `.env.local`**

```bash
cd ebs && node scripts/mint_preview_token.mjs --channel <a-real-twitch-user-id>
```

Paste the two printed lines into `extension/.env.local` (create it if it doesn't exist).

- [ ] **Step 2: Run the dev server and load the preview**

```bash
cd extension && npm run dev
```

Open `http://localhost:5173/preview.html`. Confirm:
- All three panels move past their "Connecting..."/loading states and show real content for the configured channel (config panel shows that channel's real sounds/settings; panel and component views show that channel's real timer/overlay state).
- The theme toggle button visibly changes all three panels between dark and light.
- Editing `extension/src/ConfigApp.jsx` (e.g., temporarily changing a heading string) hot-reloads the config panel without a manual browser refresh, then revert the temporary edit.
- The production warning banner is visible at the top of the shell.

- [ ] **Step 2: Report results**

No commit for this task — if anything in Steps 1-2 doesn't work as expected, note exactly what failed (which panel, what error appeared in the browser console) rather than silently patching around it; that's real signal about which earlier task's code needs a fix.

## Self-Review Notes

**Spec coverage:** Token minting (Task 1), mock SDK surface exactly matching what's actually called (Task 2), three per-view preview entries with zero modification to real components (Task 3), side-by-side shell with production banner and theme toggle (Task 4), and explicit end-to-end verification including the hot-reload property that's the whole point of this tool (Task 5) — all present.

**Type/interface consistency:** `installPreviewTwitchMock({ channelId, token })`'s two named params match exactly how Task 3's three entry pages call it. The `postMessage` `type: 'preview-theme'` string and `{ theme }` shape match exactly between Task 4's sender and Task 2's listener.
