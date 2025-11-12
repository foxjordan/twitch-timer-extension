Twitch Timer — External Overlay

This project provides a Twitch timer panel and an external overlay view you can capture in OBS/Streamlabs as a Browser Source.

Quick Start (Local)
- EBS: `cd ebs && npm install && npm run dev`
- Configure `ebs/.env` using `ebs/.env.example`. For local overlay tests you only need `PORT` and optionally `OVERLAY_KEY`.
- Add a Browser Source in OBS pointing to: `http://localhost:8080/overlay`

Overlay URL and Styling
- Base URL: `/overlay` with an optional `?key=...`.
- Styling now saves server-side per overlay key. The overlay fetches style from `/api/overlay/style` and updates live via SSE; the URL does not need to change when you adjust styling.
- If you do not use a key, styles are saved under the default profile.

Examples
- Minimal transparent: `http://localhost:8080/overlay?transparent=1&label=0`
- Left-aligned white text, 96px: `http://localhost:8080/overlay?fontSize=96&align=left&color=%23FFFFFF`

Optional Token Gate
- Set `OVERLAY_KEY` in `ebs/.env` to require a key on overlay endpoints.
- Then append `?key=YOUR_KEY` to the overlay URL and it will propagate to the internal API calls.
- Example: `http://localhost:8080/overlay?key=change_me_for_overlay&transparent=1&label=0`

Timer Control Endpoints
- `POST /api/timer/start` — `{ seconds }` to set/reset the timer.
- `POST /api/timer/add` — `{ seconds }` to add time.

Hype Testing (No Twitch Needed)
- `GET /api/hype` — returns `{ hype: boolean }`.
- `POST /api/hype` — `{ active: true|false }` to toggle hype state.
  - Immediately pushes a no-op update to the panel (as `timer_add`) and an SSE tick to overlays so the “Hype Train active” indicator updates right away.

How It Works
- The EBS maintains timer state and broadcasts ticks to the extension.
- The overlay is a minimal HTML page that:
  - Loads initial state from `/api/timer/state`.
  - Subscribes to an SSE stream at `/api/overlay/stream` for real-time updates.
  - Smoothly decrements locally between server ticks.

Overlay Configurator
- Visit `http://localhost:8080/overlay/config`.
- Log in with Twitch (broadcaster account). A unique overlay key is generated for your user automatically and shown in the UI.
- The preview uses a stable URL (`/overlay?key=...`) and style changes are saved via `POST /api/overlay/style` and applied live to the overlay (SSE `style_update`).
- Use presets (Clean, Bold White, Outline, Shadow) as starting points.
 - Time format selector: choose between `mm:ss`, `hh:mm:ss`, or `auto` (auto shows `hh:mm:ss` only when hours > 0).

Timer Controls
- In the configurator, set Hours/Minutes/Seconds and click “Start Timer” to initialize the countdown (uses `POST /api/timer/start`).
- Quick-add buttons add time on top (uses `POST /api/timer/add`).
- “Save Default” stores your preferred initial duration. It auto-fills next time you open the configurator.
- Pause/Resume buttons call admin-only endpoints to pause or resume the countdown immediately.

Pause/Resume API (Admin)
- `POST /api/timer/pause` — pauses the timer; overlays stop decrementing locally and show a paused badge.
- `POST /api/timer/resume` — resumes the timer from where it left off.

Threshold Styling
- Configure warn/danger thresholds and colors, plus an optional “flash under (sec)” to make the timer pulse.
- These are part of the saved style profile and apply live to the overlay.

Persistence
- Styles and per-user keys persist across restarts in JSON files under `ebs/`:
  - `overlay-styles.json` — per-key styles (including thresholds)
  - `overlay-keys.json` — Twitch user ID → overlay key
  - `overlay-user-settings.json` — per-user defaults (initial duration)

Per-User Keys
- On first Twitch login, the server creates and stores a unique overlay key for your Twitch user.
- OBS Browser Source should use `http://<host>:8080/overlay?key=YOUR_USER_KEY`.
- You can rotate the key from the configurator; remember to update the OBS URL afterward.
- Backwards compatible: if `OVERLAY_KEY` is set in `.env`, it remains valid for overlay access.
Deployment — Fly.io (free tier)
- What you get: HTTPS, always-on Node runtime, SSE + EventSub WS compatible, persistent volume for your JSON files.

Prereqs
- Install Fly CLI: https://fly.io/docs/hands-on/install-flyctl/
- Login: `fly auth signup` or `fly auth login`

One-time setup
1) Create app: `fly launch` (choose an app name, keep existing `fly.toml` when prompted)
2) Create volume: `fly volumes create data --size 1 --region iad`
3) Set secrets (replace values):
   - `fly secrets set TWITCH_CLIENT_ID=... TWITCH_CLIENT_SECRET=... BROADCASTER_USER_ID=... BROADCASTER_USER_TOKEN=... SESSION_SECRET=$(openssl rand -hex 16) OVERLAY_KEY=...` 
   - Optionally: `fly secrets set SERVER_BASE_URL=https://<your-app>.fly.dev`
4) Deploy: `fly deploy`

Notes
- The app stores JSON under `/data` (set via `DATA_DIR`). Fly mounts the `data` volume at that path.
- Health check hits `/api/timer/state`. If you use `OVERLAY_KEY`, add `?key=...` in Fly dashboard’s check configuration or leave the key unset.
- Custom domain: `fly certs add overlay.yourdomain.com` and point DNS.
