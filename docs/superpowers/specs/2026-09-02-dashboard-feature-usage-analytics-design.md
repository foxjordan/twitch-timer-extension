# Dashboard Feature-Usage Analytics — Design

Date: 2026-09-02
Status: Approved for planning

## Goal

Give the operator (super admin) a first read on **what registered streamers actually
do on the livestreamerhub.com web dashboard** — which feature areas they open,
which they use for real, and how often — so dead features and hero features are
obvious.

Context: ~215 registered users, and the suspicion is that a large share logged in
once, looked around, and never came back. The Twitch **extension** is already
well instrumented (`logEvent` calls throughout `extension/src/App.jsx`,
`ComponentApp.jsx`, `ConfigApp.jsx`, landing in the first-party `client_events`
Postgres table). The **web dashboard is nearly blind** — only two ad-hoc
`fetch('/api/analytics/dashboard-event')` calls exist across every `ebs/views/*`
page. This feature closes that gap for the "what gets used" question only.

Target consumer: the super admin, via the existing **Analytics** section of
`ebs/views/adminDashboardPage.js`. Not streamer-facing.

Explicitly **not** in v1: retention / cohort analysis, drop-off funnels, per-user
event timelines, and rolling the already-collected extension/viewer events into
this view. Those are later phases; `page_view` data (below) starts accumulating
now so the funnel work has history to draw on.

## Hard constraints

- **First-party only.** Reuse `client_events` + the existing
  `/api/analytics/dashboard-event` ingestion endpoint. No third-party analytics
  product, no new event store.
- **Fire-and-forget on the client.** A tracking call must never block a page or a
  user action, and a failed call must be silent.
- **Zero new ingestion code.** `/api/analytics/dashboard-event`
  ([routes_analytics.js:71](../../../ebs/routes_analytics.js#L71)) already does
  session auth, string/param sanitisation, and the `client_events` insert. Only
  the client emits more; the server only gains a *reporting* endpoint.
- **Forward-looking.** No backfill. Numbers begin from when instrumentation ships.

## Event taxonomy

Three event names, all sent to `/api/analytics/dashboard-event` with a `params`
object (stored as JSON text in `client_events.params`).

| `event_name` | Fired | `params` | Purpose |
|---|---|---|---|
| `page_view` | every dashboard page load | `{ page: "sound-config" }` | active-user denominator; raw navigation for a later funnel |
| `feature_view` | a feature area is reached — on page load for a feature-dedicated route, or on section-activation for a feature that lives as a sub-section of another page | `{ feature: "sounds" }` | "reached it" |
| `feature_use` | the meaningful action for that feature happened | `{ feature: "sounds", action: "sound_uploaded" }` | "used it for real" |

`feature` keys (v1, 11):

| key | area | representative `feature_use` action(s) |
|---|---|---|
| `timer` | Countdown / subathon timer config | `rules_saved` |
| `sounds` | Sound Alerts config | `sound_uploaded`, `clip_created`, `sound_from_library`, `channel_points_enabled` |
| `tts` | TTS config | `tts_config_saved` |
| `goals` | Goals config | `goal_created`, `goal_style_saved` |
| `extras` | Extras / utilities lab (area open) | — |
| `wheel` | Wheel tool | `wheel_created`, `wheel_spun` |
| `prompts` | Prompt engine | `prompt_shown` |
| `plinko` | Plinko board | `board_saved`, `dropped` |
| `delegates` | Delegate management | `delegate_added` |
| `streamelements` | StreamElements integration | `connected` |
| `youtube` | YouTube multistreaming integration | `connected` |

Plus one universal action available to every overlay-backed feature:
`copy_overlay_link` — a strong "actually wiring it into OBS" signal.

`page` names map 1:1 to the served routes:

| route | `page` |
|---|---|
| `/overlay/config` | `timer-config` |
| `/sounds/config` | `sound-config` |
| `/goals/config` | `goals-config` |
| `/utilities` | `extras` |
| `/dashboard` | `dashboard-home` |
| `/` (logged in) | `home` |

(TTS, delegates, and the StreamElements / YouTube connect UIs live inside
`overlayConfigPage.js` / `soundConfigPage.js` sections, not separate routes — they
still emit their own `feature_view` / `feature_use` when their section is
opened / acted on.)

## Architecture

```
ebs/views/*.js  ──renderAnalyticsScript({page})──►  window.lsh.track(event, params)
                                                         │  fetch(keepalive)
                                                         ▼
                                    POST /api/analytics/dashboard-event   (unchanged)
                                                         │
                                                         ▼
                                             client_events  (Postgres, unchanged schema)
                                                         │
              GET /api/admin/analytics/feature-usage ◄────┘   (new, super-admin)
                                                         │
                                     Analytics section, adminDashboardPage.js  (new card)
```

## New components

- **`ebs/views/analyticsScript.js`** — one export `renderAnalyticsScript({ page })`
  returning a small inline `<script>`. It:
  - defines `window.lsh = window.lsh || {}` with
    - `lsh.track(event, params)` → `fetch('/api/analytics/dashboard-event', { method:'POST', keepalive:true, credentials:'same-origin', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ event, params }) }).catch(()=>{})`
    - `lsh.feature(key)` → `track('feature_view', { feature:key })`
    - `lsh.use(key, action)` → `track('feature_use', { feature:key, action })`
  - on load, fires `lsh.track('page_view', { page })` once.
  - Injected by each page next to `renderThemeBootstrapScript()` /
    `renderFirebaseScript()` (same slot those already use). Mirrors the
    inline-script-helper pattern in `ebs/views/theme.js`.

- **`GET /api/admin/analytics/feature-usage`** in
  [routes_admin.js](../../../ebs/routes_admin.js) — next to the existing
  `/api/admin/analytics` and `/api/admin/analytics/funnel` handlers, same guard
  (`req.session?.isAdmin && isSuperAdmin(req)`), same `parseDateRange(req)`.
  Returns:
  ```jsonc
  {
    "activeStreamers": 47,     // distinct channel_id with any of the 3 events in range
    "registeredTotal": 215,    // existing "registered" count source
    "features": [
      { "feature": "sounds", "label": "Sound Alerts",
        "reached": 40, "used": 31, "useEvents": 512,
        "reachedPrev": 38, "usedPrev": 25 }   // prior equal-length window, for the trend arrow
    ]
  }
  ```
  - `reached` = `COUNT(DISTINCT channel_id)` where `event_name='feature_view' AND params::jsonb->>'feature' = key`
  - `used` = same for `event_name='feature_use'`
  - `useEvents` = `COUNT(*)` of `feature_use` for the key (frequency)
  - `*Prev` computed over `[from - (to-from), from)`.
  - Feature list + labels come from a small constant table in the handler (the
    taxonomy above), so a feature with zero events still shows as a row.

- **"Feature Usage" `table-card`** in the `data-section="analytics"` block of
  `adminDashboardPage.js` (add near "Setup Funnel by Language",
  [adminDashboardPage.js:451](../../../ebs/views/adminDashboardPage.js#L451)).
  Fetched with `rangeQueryString()` like the sibling analytics fetches
  ([adminDashboardPage.js:2581](../../../ebs/views/adminDashboardPage.js#L2581)),
  and re-fetched when the shared range toolbar changes. Header line reflects the
  **selected** range, e.g. `"47 of 215 streamers active · last 30 days"` (reuses
  the section's existing range-label text). Table columns:

  | Feature | Reached | Used | Real-use rate | Events | Trend |
  |---|---|---|---|---|---|
  | Sound Alerts | 40 | 31 | 78% | 512 | ▲ |
  | Goals | 22 | 9 | 41% | 41 | ▼ |
  | Delegates | 3 | 0 | 0% | 0 | – |

  - "Real-use rate" = `used / reached`.
  - Trend arrow: ▲ if `used > usedPrev`, ▼ if `<`, – if equal or `usedPrev` is
    from a window with no data. No sparklines (numbers are small enough that the
    arrow is enough).
  - Default sort: `used` desc — hero features top, `used: 0` rows (dead weight) at
    the bottom.
  - Plain HTML table, matching the section's existing no-chart-library style.

## Modified components

- **`ebs/views/*.js` dashboard pages** — inject `renderAnalyticsScript({ page })`;
  add `lsh.feature(...)` on feature-area render and `lsh.use(...)` at the ~20
  action call sites (save / upload / create / connect / copy handlers, most of
  which already have a JS handler). Remove the two pre-existing ad-hoc
  `fetch('/api/analytics/dashboard-event')` calls
  ([overlayConfigPage.js:1728](../../../ebs/views/overlayConfigPage.js#L1728),
  [soundConfigPage.js:592](../../../ebs/views/soundConfigPage.js#L592)) in favour
  of `lsh.use(...)`.

- **`ebs/user_data_deletion.js`** — add
  `DELETE FROM client_events WHERE channel_id = $1` to `deleteAllUserData`
  (currently **not** wired — analytics rows keyed by `channel_id` survive account
  deletion today). Push `"clientEvents"` onto the `deleted` list.

- **`ebs/server.js`** — a daily
  `DELETE FROM client_events WHERE created_at < now() - interval '12 months'`
  on the existing `setInterval` cleanup-loop pattern (next to the `state.seen`
  sweep).

- **DB indexes** (add if absent — check `\d client_events` first):
  `CREATE INDEX ON client_events (event_name, created_at);` and
  `CREATE INDEX ON client_events ((params::jsonb ->> 'feature'));`

## Error handling

- Client: every `lsh.*` call is wrapped in `try` + `.catch(()=>{})`; a missing
  `window.lsh` (script failed to load) must not throw at call sites — guard with
  `window.lsh && lsh.use(...)` or a no-op stub defined first thing in the helper.
- `feature-usage` endpoint: wrap the queries in `try/catch`, return
  `500 { error }` like the sibling handlers; a malformed `params` row
  (`params::jsonb` cast failing) must not abort the aggregate — filter with
  `params IS NOT NULL AND params ~ '^\\s*\\{'` or use `jsonb` cast in a subquery
  that tolerates nulls.
- `activeStreamers` / `registeredTotal`: if the registered-count source query
  fails, still return feature rows with `registeredTotal: null` and let the UI
  show "— active".

## Testing

- **Endpoint unit/integration** (matches the `node:test` style now in `ebs/`):
  seed `client_events` rows for 2–3 fake channels across `feature_view` /
  `feature_use` / `page_view` inside and outside the range, assert `reached` /
  `used` / `useEvents` / `activeStreamers` and that a zero-event feature still
  appears; assert the `*Prev` window is `[from-(to-from), from)`.
- **`deleteAllUserData`** — extend the deletion test (or add one) to seed
  `client_events` for a channel and assert they're gone after deletion and
  `"clientEvents"` is in `deleted`.
- **Manual E2E**: log into the dashboard, click through Sound Alerts (upload a
  sound), Goals (create a goal), Extras → Plinko (save a board, copy link);
  confirm `client_events` gets `page_view` + `feature_view` + `feature_use` rows
  with the right `params`; open the admin Analytics section and confirm the
  Feature Usage table shows those features with `reached`/`used` = 1 and a `–`
  trend, and that an untouched feature (e.g. Delegates) shows a `0 / 0` row.
- **Sanity**: `lsh.track` with the network offline / endpoint 500 — page and
  action still work, no console error beyond the swallowed fetch rejection.

## Explicitly out of scope for v1

- Retention / cohort view (who comes back).
- Drop-off / setup funnel beyond the language funnel that already exists.
- Per-user drill-down (first seen / last seen / session count / event timeline).
- Rolling extension + viewer-engagement events into this view.
- Sparklines or any charting — plain table + trend arrow only.
- Backfilling feature usage from historical data.
