# Dashboard Feature-Usage Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Instrument the livestreamerhub.com web dashboard so the super admin can see which feature areas registered streamers reach, which they use for real, and how often.

**Architecture:** A tiny inline-script helper (`renderAnalyticsScript`) that every `ebs/views/*` page injects; it posts `page_view` / `feature_view` / `feature_use` events to the **existing** `/api/analytics/dashboard-event` endpoint, which already auths and writes `client_events`. Reporting is one new super-admin JSON endpoint (`GET /api/admin/analytics/feature-usage`) whose aggregation logic is a pure, unit-tested function, plus one HTML table card in the existing Analytics section of `adminDashboardPage.js`.

**Tech Stack:** Node.js (ESM), Express, `pg` (Postgres via `ebs/db.js`), `node:test` + `node:assert/strict` (the test runner already wired as `npm test` in `ebs/`). No new dependencies. No chart library.

**Spec:** [docs/superpowers/specs/2026-09-02-dashboard-feature-usage-analytics-design.md](../specs/2026-09-02-dashboard-feature-usage-analytics-design.md)

## Global Constraints

- **First-party only.** Reuse `client_events` and `POST /api/analytics/dashboard-event` ([ebs/routes_analytics.js:71](../../../ebs/routes_analytics.js#L71)). No third-party analytics, no new event table, no new ingestion route.
- **Client tracking is fire-and-forget.** `fetch(..., { keepalive: true }).catch(() => {})`. It must never block a page or a user action and must be silent on failure. Every call site guarded so a missing `window.lsh` cannot throw.
- **No backfill.** Numbers are forward-looking from deploy.
- **Event names (exact):** `page_view`, `feature_view`, `feature_use`. **`params` shapes (exact):** `{ page: string }`, `{ feature: string }`, `{ feature: string, action: string }`.
- **Feature keys (exact, 11):** `timer`, `sounds`, `tts`, `goals`, `extras`, `wheel`, `prompts`, `plinko`, `delegates`, `streamelements`, `youtube`.
- **`feature_use` actions (exact):** `timer/rules_saved`, `sounds/sound_uploaded`, `sounds/clip_created`, `sounds/sound_from_library`, `sounds/channel_points_enabled`, `tts/tts_config_saved`, `goals/goal_created`, `goals/goal_style_saved`, `wheel/wheel_created`, `wheel/wheel_spun`, `prompts/prompt_shown`, `plinko/board_saved`, `plinko/dropped`, `delegates/delegate_added`, `streamelements/connected`, `youtube/connected`, and the universal `<feature>/copy_overlay_link`.
- **Super-admin gate (exact):** `if (!req.session?.isAdmin || !isSuperAdmin(req)) return res.status(403).json({ error: "Access denied" });` — matches every sibling handler in `routes_admin.js`.
- **`client_events` retention:** 12 months.
- Commit after every task. The repo's convention: end commit messages with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

## File Structure

| File | Create/Modify | Responsibility |
|---|---|---|
| `ebs/views/analyticsScript.js` | Create | `renderAnalyticsScript({ page })` → inline `<script>` defining `window.lsh.{track,feature,use}` and auto-firing `page_view` |
| `ebs/views/analyticsScript.test.js` | Create | Unit tests for the helper's output |
| `ebs/feature_usage.js` | Create | `FEATURE_CATALOG` constant + `shapeFeatureUsage(...)` pure aggregation-shaping function |
| `ebs/feature_usage.test.js` | Create | Unit tests for `shapeFeatureUsage` |
| `ebs/routes_admin.js` | Modify | New `GET /api/admin/analytics/feature-usage` handler (thin glue over `shapeFeatureUsage`) |
| `ebs/views/adminDashboardPage.js` | Modify | "Feature Usage" `table-card` markup + fetch/render JS in `data-section="analytics"` |
| `ebs/views/overlayConfigPage.js` | Modify | inject helper; `page_view: timer-config`; `feature_view`/`feature_use` for `timer`, `tts`, `delegates`, `streamelements`, `youtube` |
| `ebs/views/soundConfigPage.js` | Modify | inject helper; `page_view: sound-config`; `feature`/`use` for `sounds` |
| `ebs/views/goalsConfigPage.js` | Modify | inject helper; `page_view: goals-config`; `feature`/`use` for `goals` |
| `ebs/views/utilitiesPage.js` | Modify | inject helper; `page_view: extras`; `feature`/`use` for `extras`, `wheel`, `prompts`, `plinko` |
| `ebs/views/dashboardPage.js` | Modify | inject helper; `page_view: dashboard-home` |
| `ebs/views/homePage.js` | Modify | inject helper; `page_view: home` |
| `ebs/user_data_deletion.js` | Modify | `DELETE FROM client_events WHERE channel_id = $1` in `deleteAllUserData` |
| `ebs/server.js` | Modify | `ensureAnalyticsIndexes()` at boot + daily 12-month retention sweep |

---

### Task 1: `renderAnalyticsScript` helper

**Files:**
- Create: `ebs/views/analyticsScript.js`
- Test: `ebs/views/analyticsScript.test.js`

**Interfaces:**
- Produces: `renderAnalyticsScript({ page }: { page?: string }) => string` — an HTML `<script>` element as a string. The inline script defines `window.lsh.track(event, params)`, `window.lsh.feature(key)`, `window.lsh.use(key, action)` and, when `page` is truthy, fires `lsh.track('page_view', { page })` on execution.

- [ ] **Step 1: Write the failing test**

Create `ebs/views/analyticsScript.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderAnalyticsScript } from './analyticsScript.js';

function innerScript(html) {
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(m, 'expected a <script> block');
  return m[1];
}

test('renderAnalyticsScript embeds the page name and the three helpers', () => {
  const html = renderAnalyticsScript({ page: 'sound-config' });
  assert.match(html, /window\.lsh/);
  assert.match(html, /'feature_view'/);
  assert.match(html, /'feature_use'/);
  assert.match(html, /'page_view'/);
  assert.match(html, /keepalive: true/);
  assert.match(html, /"sound-config"/);
});

test('the inline script is syntactically valid and defines lsh.{track,feature,use}', () => {
  const body = innerScript(renderAnalyticsScript({ page: 'home' }));
  const win = { lsh: undefined };
  // eslint-disable-next-line no-new-func
  new Function('window', 'fetch', body)(win, () => ({ catch() {} }));
  assert.equal(typeof win.lsh.track, 'function');
  assert.equal(typeof win.lsh.feature, 'function');
  assert.equal(typeof win.lsh.use, 'function');
});

test('no page name -> no page_view call is emitted', () => {
  const body = innerScript(renderAnalyticsScript({}));
  assert.doesNotMatch(body, /page_view/);
});

test('page name is length-capped', () => {
  const html = renderAnalyticsScript({ page: 'x'.repeat(200) });
  const m = html.match(/"(x+)"/);
  assert.ok(m && m[1].length === 60);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ebs && node --test views/analyticsScript.test.js`
Expected: FAIL — `Cannot find module './analyticsScript.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `ebs/views/analyticsScript.js`:

```js
// First-party dashboard analytics. Injected into every ebs/views/* page next to
// renderThemeBootstrapScript()/renderFirebaseScript(). Posts to the existing
// /api/analytics/dashboard-event endpoint (session-authed, sanitised, writes
// client_events). Fire-and-forget: never blocks, silent on failure.
export function renderAnalyticsScript({ page } = {}) {
  const pageName = String(page || '').slice(0, 60);
  const p = JSON.stringify(pageName);
  return `<script>
  (function () {
    var lsh = (window.lsh = window.lsh || {});
    lsh.track = function (event, params) {
      try {
        fetch('/api/analytics/dashboard-event', {
          method: 'POST', credentials: 'same-origin', keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: event, params: params || {} })
        }).catch(function () {});
      } catch (e) {}
    };
    lsh.feature = function (key) { lsh.track('feature_view', { feature: key }); };
    lsh.use = function (key, action) { lsh.track('feature_use', { feature: key, action: action }); };
    if (${p}) lsh.track('page_view', { page: ${p} });
  })();
</script>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ebs && node --test views/analyticsScript.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add ebs/views/analyticsScript.js ebs/views/analyticsScript.test.js
git commit -m "feat(analytics): dashboard tracking helper (window.lsh)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `FEATURE_CATALOG` + `shapeFeatureUsage`

**Files:**
- Create: `ebs/feature_usage.js`
- Test: `ebs/feature_usage.test.js`

**Interfaces:**
- Produces:
  - `FEATURE_CATALOG: Array<{ feature: string, label: string }>` — the 11 feature keys from Global Constraints, in display order, each with a human label.
  - `shapeFeatureUsage({ currentRows, prevRows, activeStreamers, registeredTotal }) => { activeStreamers: number, registeredTotal: number|null, features: Array<{ feature, label, reached, used, useEvents, reachedPrev, usedPrev, trend, useRate }> }`
  - Input row shape (from SQL in Task 3), for both `currentRows` and `prevRows`:
    `{ feature: string, event_name: 'feature_view'|'feature_use', distinct_channels: number, event_count: number }`
  - `trend`: `'up'` if `used > usedPrev`, `'down'` if `used < usedPrev`, `'flat'` otherwise.
  - `useRate`: `reached > 0 ? used / reached : 0` (a 0..1 number; the view formats it as %).
  - Output `features` is sorted by `used` desc, then `reached` desc, then `label` asc. Every catalog feature appears exactly once even with zero rows.

- [ ] **Step 1: Write the failing test**

Create `ebs/feature_usage.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ebs && node --test feature_usage.test.js`
Expected: FAIL — `Cannot find module './feature_usage.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `ebs/feature_usage.js`:

```js
// Reporting model for the "Feature Usage" admin view. Pure — takes pre-aggregated
// rows from client_events and shapes the response. See
// docs/superpowers/specs/2026-09-02-dashboard-feature-usage-analytics-design.md
export const FEATURE_CATALOG = [
  { feature: 'timer', label: 'Timer / Countdown' },
  { feature: 'sounds', label: 'Sound Alerts' },
  { feature: 'tts', label: 'TTS' },
  { feature: 'goals', label: 'Goals' },
  { feature: 'extras', label: 'Extras' },
  { feature: 'wheel', label: 'Wheel' },
  { feature: 'prompts', label: 'Prompts' },
  { feature: 'plinko', label: 'Plinko' },
  { feature: 'delegates', label: 'Delegates' },
  { feature: 'streamelements', label: 'StreamElements' },
  { feature: 'youtube', label: 'YouTube' },
];

function index(rows) {
  // feature -> { reached, used, useEvents }
  const m = new Map();
  for (const r of rows || []) {
    if (!r || !r.feature) continue;
    const e = m.get(r.feature) || { reached: 0, used: 0, useEvents: 0 };
    const dc = Number(r.distinct_channels) || 0;
    const ec = Number(r.event_count) || 0;
    if (r.event_name === 'feature_view') e.reached = dc;
    else if (r.event_name === 'feature_use') { e.used = dc; e.useEvents = ec; }
    m.set(r.feature, e);
  }
  return m;
}

export function shapeFeatureUsage({ currentRows, prevRows, activeStreamers, registeredTotal }) {
  const cur = index(currentRows);
  const prev = index(prevRows);

  const features = FEATURE_CATALOG.map(({ feature, label }) => {
    const c = cur.get(feature) || { reached: 0, used: 0, useEvents: 0 };
    const p = prev.get(feature) || { reached: 0, used: 0, useEvents: 0 };
    const trend = c.used > p.used ? 'up' : c.used < p.used ? 'down' : 'flat';
    return {
      feature,
      label,
      reached: c.reached,
      used: c.used,
      useEvents: c.useEvents,
      reachedPrev: p.reached,
      usedPrev: p.used,
      trend,
      useRate: c.reached > 0 ? c.used / c.reached : 0,
    };
  });

  features.sort((a, b) => b.used - a.used || b.reached - a.reached || a.label.localeCompare(b.label));

  return {
    activeStreamers: Number(activeStreamers) || 0,
    registeredTotal: registeredTotal == null ? null : Number(registeredTotal) || 0,
    features,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ebs && node --test feature_usage.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add ebs/feature_usage.js ebs/feature_usage.test.js
git commit -m "feat(analytics): feature-usage reporting model + catalog

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `GET /api/admin/analytics/feature-usage` endpoint

**Files:**
- Modify: `ebs/routes_admin.js` — add the handler next to `app.get("/api/admin/analytics/funnel", ...)` (search for that string).

**Interfaces:**
- Consumes: `shapeFeatureUsage`, `FEATURE_CATALOG` from `./feature_usage.js`; `isSuperAdmin` (already in file); local `parseDateRange(req)` (already in file); `getAllUserIds` from `./user_profiles.js` (already imported — verify the import line near the top; if missing, add `getAllUserIds` to the existing `./user_profiles.js` import); `db` from `./db.js` (already imported).
- Produces: `GET /api/admin/analytics/feature-usage?from&to` → `200` with the `shapeFeatureUsage(...)` object, or `403 { error: "Access denied" }`, or `500 { error }`.

- [ ] **Step 1: Add the import**

At the top of `ebs/routes_admin.js`, add:

```js
import { FEATURE_CATALOG, shapeFeatureUsage } from "./feature_usage.js";
```

Verify `getAllUserIds` is imported from `./user_profiles.js` (it's used elsewhere in the file). If not, add it to that import.

- [ ] **Step 2: Add the handler**

Immediately after the closing `});` of the `/api/admin/analytics/funnel` handler:

```js
  // Feature usage on the web dashboard: for each feature area, how many distinct
  // streamers reached it (feature_view), how many used it for real (feature_use),
  // total feature_use events, and the trend vs. the previous equal-length window.
  app.get("/api/admin/analytics/feature-usage", async (req, res) => {
    if (!req.session?.isAdmin || !isSuperAdmin(req)) {
      return res.status(403).json({ error: "Access denied" });
    }
    try {
      const { from, to } = parseDateRange(req);
      // Previous window = same length immediately before [from, to). When either
      // bound is open we skip the trend rather than guess.
      let prevFrom = null;
      let prevTo = null;
      if (from && to) {
        const span = new Date(to).getTime() - new Date(from).getTime();
        prevTo = from;
        prevFrom = new Date(new Date(from).getTime() - span).toISOString();
      }

      const aggSql = `
        SELECT params::jsonb ->> 'feature' AS feature,
               event_name,
               COUNT(DISTINCT channel_id)::int AS distinct_channels,
               COUNT(*)::int AS event_count
          FROM client_events
         WHERE event_name IN ('feature_view', 'feature_use')
           AND params IS NOT NULL AND params ~ '^\\s*\\{'
           AND ($1::timestamptz IS NULL OR created_at >= $1)
           AND ($2::timestamptz IS NULL OR created_at < $2)
         GROUP BY 1, 2`;

      const [curRes, prevRes, activeRes] = await Promise.all([
        db.query(aggSql, [from, to]),
        prevFrom ? db.query(aggSql, [prevFrom, prevTo]) : Promise.resolve({ rows: [] }),
        db.query(
          `SELECT COUNT(DISTINCT channel_id)::int AS n
             FROM client_events
            WHERE event_name IN ('page_view', 'feature_view', 'feature_use')
              AND ($1::timestamptz IS NULL OR created_at >= $1)
              AND ($2::timestamptz IS NULL OR created_at < $2)`,
          [from, to],
        ),
      ]);

      let registeredTotal = null;
      try {
        registeredTotal = getAllUserIds().length;
      } catch { /* leave null; UI shows "— active" */ }

      res.json(
        shapeFeatureUsage({
          currentRows: curRes.rows,
          prevRows: prevRes.rows,
          activeStreamers: activeRes.rows?.[0]?.n || 0,
          registeredTotal,
        }),
      );
    } catch (err) {
      logger.error("feature_usage_query_failed", { message: err?.message });
      res.status(500).json({ error: err?.message || "Query failed" });
    }
  });
```

(`logger` is already imported in this file; if the local name differs, match the surrounding handlers.)

- [ ] **Step 3: Syntax-check**

Run: `cd ebs && node --check routes_admin.js`
Expected: no output (valid).

- [ ] **Step 4: Manual verification against a running server**

There is no test-DB harness in this repo, so verify by hand:

```bash
cd ebs && node server.js   # in one terminal; wait for "EBS listening"
```

In `psql "$DATABASE_URL"` seed a couple of rows (use any real registered channel id):

```sql
INSERT INTO client_events (channel_id, event_name, surface, params) VALUES
  ('11111', 'feature_view', 'dashboard', '{"feature":"sounds"}'),
  ('11111', 'feature_use',  'dashboard', '{"feature":"sounds","action":"sound_uploaded"}'),
  ('22222', 'feature_view', 'dashboard', '{"feature":"sounds"}'),
  ('11111', 'page_view',    'dashboard', '{"page":"sound-config"}');
```

Then, logged in as a super admin in a browser, open
`http://localhost:8080/api/admin/analytics/feature-usage?from=2000-01-01&to=2100-01-01`
Expected JSON: `activeStreamers` ≥ 1, `features[]` length 11, the `sounds` row with `reached: 2`, `used: 1`, `useEvents: 1`, `trend: "flat"`; every other feature `0/0/0`. Without a super-admin session: `403`.

Clean up: `DELETE FROM client_events WHERE channel_id IN ('11111','22222');`

- [ ] **Step 5: Commit**

```bash
git add ebs/routes_admin.js
git commit -m "feat(analytics): GET /api/admin/analytics/feature-usage

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: "Feature Usage" card in the admin Analytics section

**Files:**
- Modify: `ebs/views/adminDashboardPage.js` — markup in the `data-section="analytics"` block; render JS in the page's `<script>`.

**Interfaces:**
- Consumes: `GET /api/admin/analytics/feature-usage` (Task 3); the page's existing `rangeQueryString()` helper (search for it — used by the sibling analytics fetches around line 2581) and whatever function re-runs analytics fetches when the range toolbar changes (search for `loadAnalytics` / where `/api/admin/analytics/funnel` is fetched and call the new loader alongside it).

- [ ] **Step 1: Add the markup**

In the `<div class="section-page" data-section="analytics">` block, immediately **before** `<div class="table-card" style="margin-bottom:20px;">` that contains `<h2>Setup Funnel by Language</h2>`, insert:

```html
      <div class="table-card" style="margin-bottom:20px;">
        <h2>Feature Usage <span class="refresh-info" id="featureUsageActive"></span></h2>
        <div style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">Web-dashboard features: distinct streamers who reached each area vs. who used it for real, and how the "used" count compares to the previous equal-length window.</div>
        <div id="featureUsageContainer"><div class="empty-state">Loading...</div></div>
      </div>
```

- [ ] **Step 2: Add the render function**

In the page `<script>`, next to the other analytics loaders (search for the function that fetches `/api/admin/analytics/funnel`), add:

```js
        function loadFeatureUsage() {
          var container = document.getElementById('featureUsageContainer');
          fetch('/api/admin/analytics/feature-usage' + rangeQueryString(), { credentials: 'same-origin' })
            .then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
            .then(function (data) {
              var active = document.getElementById('featureUsageActive');
              active.textContent = data.registeredTotal == null
                ? data.activeStreamers + ' active'
                : data.activeStreamers + ' of ' + data.registeredTotal + ' streamers active';
              if (!data.features || !data.features.length) {
                container.innerHTML = '<div class="empty-state">No data yet.</div>';
                return;
              }
              var arrow = { up: '▲', down: '▼', flat: '–' };
              var rows = data.features.map(function (f) {
                return '<tr>'
                  + '<td>' + f.label + '</td>'
                  + '<td style="text-align:right;">' + f.reached + '</td>'
                  + '<td style="text-align:right;">' + f.used + '</td>'
                  + '<td style="text-align:right;">' + (f.reached ? Math.round(f.useRate * 100) + '%' : '–') + '</td>'
                  + '<td style="text-align:right;">' + f.useEvents + '</td>'
                  + '<td style="text-align:center;">' + arrow[f.trend] + '</td>'
                  + '</tr>';
              }).join('');
              container.innerHTML =
                '<table class="data-table"><thead><tr>'
                + '<th>Feature</th><th style="text-align:right;">Reached</th><th style="text-align:right;">Used</th>'
                + '<th style="text-align:right;">Use rate</th><th style="text-align:right;">Events</th><th style="text-align:center;">Trend</th>'
                + '</tr></thead><tbody>' + rows + '</tbody></table>';
            })
            .catch(function () { container.innerHTML = '<div class="empty-state">Failed to load.</div>'; });
        }
```

(If the section's tables don't use a `data-table` class, copy the `<table ...>` classes/inline styles from the "Setup Funnel by Language" render code so it visually matches.)

- [ ] **Step 3: Call it wherever the other analytics loaders are invoked**

Find every place the funnel/analytics loaders run (initial section load + range-toolbar "apply"/preset handlers) and add `loadFeatureUsage();` next to them.

- [ ] **Step 4: Verify the markup renders**

Run:
```bash
cd ebs && node -e "import('./views/adminDashboardPage.js').then(m => { const h = m.renderAdminDashboardPage ? m.renderAdminDashboardPage({}) : ''; console.log(h.includes('featureUsageContainer'), h.includes('loadFeatureUsage')); })"
```
(Adjust the export name if different — grep `export function render` in the file.)
Expected: `true true`.

- [ ] **Step 5: Manual E2E**

With the server running and the Task 3 seed rows in place, log in as super admin, open the admin dashboard → **Analytics**. The Feature Usage table shows 11 rows, `Sound Alerts` at the top with `Reached 2 / Used 1`, header reads "N of 215 streamers active". Change the range preset — the table re-fetches. Delete the seed rows.

- [ ] **Step 6: Commit**

```bash
git add ebs/views/adminDashboardPage.js
git commit -m "feat(analytics): Feature Usage table in admin Analytics section

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Inject `renderAnalyticsScript` into every dashboard page

**Files:**
- Modify: `ebs/views/overlayConfigPage.js`, `ebs/views/soundConfigPage.js`, `ebs/views/goalsConfigPage.js`, `ebs/views/utilitiesPage.js`, `ebs/views/dashboardPage.js`, `ebs/views/homePage.js`

**Interfaces:**
- Consumes: `renderAnalyticsScript` from `./analyticsScript.js` (Task 1).
- Produces: each page's HTML now contains `window.lsh` and, on load, fires `page_view` with the page name below.

| File | `page` value |
|---|---|
| `overlayConfigPage.js` | `timer-config` |
| `soundConfigPage.js` | `sound-config` |
| `goalsConfigPage.js` | `goals-config` |
| `utilitiesPage.js` | `extras` |
| `dashboardPage.js` | `dashboard-home` |
| `homePage.js` | `home` |

- [ ] **Step 1: Edit each file** (repeat for all six)

Add the import near the other view imports:
```js
import { renderAnalyticsScript } from "./analyticsScript.js";
```
In the returned HTML template, immediately after `${renderFirebaseScript()}` (every one of these files has that line), add:
```js
    ${renderAnalyticsScript({ page: "<PAGE VALUE FROM TABLE>" })}
```

- [ ] **Step 2: Syntax + render check**

Run:
```bash
cd ebs && for f in overlayConfigPage soundConfigPage goalsConfigPage utilitiesPage dashboardPage homePage; do node --check "views/$f.js" && echo "OK $f"; done
```
Expected: `OK` for all six.

Then render-check one representative page contains the tracking:
```bash
cd ebs && node -e "import('./views/utilitiesPage.js').then(m => { const h = m.renderUtilitiesPage({ overlayKey: 'k' }); console.log(h.includes('window.lsh'), h.includes('\"page\": \"extras\"') || h.includes(\"'page': 'extras'\") || h.includes('page_view')); })"
```
Expected: `true true`.

- [ ] **Step 3: Run the full test suite**

Run: `cd ebs && npm test`
Expected: all existing tests still pass; the 2 new files from Tasks 1–2 pass.

- [ ] **Step 4: Commit**

```bash
git add ebs/views/overlayConfigPage.js ebs/views/soundConfigPage.js ebs/views/goalsConfigPage.js ebs/views/utilitiesPage.js ebs/views/dashboardPage.js ebs/views/homePage.js
git commit -m "feat(analytics): emit page_view from every dashboard page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: `feature_view` / `feature_use` call sites

**Files:**
- Modify: `ebs/views/overlayConfigPage.js`, `ebs/views/soundConfigPage.js`, `ebs/views/goalsConfigPage.js`, `ebs/views/utilitiesPage.js`

**Interfaces:**
- Consumes: `window.lsh.feature`, `window.lsh.use` (defined by Task 5's injected script).
- All calls guarded: `window.lsh && lsh.feature('...')` / `window.lsh && lsh.use('...', '...')`.

- [ ] **Step 1: `overlayConfigPage.js` (timer / tts / delegates / integrations)**

- On the page's client-side init (after DOM ready), once per load:
  `if (window.lsh) lsh.feature('timer');`
- In the **"Save Rules"** button handler (search for the `/api/rules` POST): on success add
  `if (window.lsh) lsh.use('timer', 'rules_saved');`
- **Remove** the existing ad-hoc `fetch('/api/analytics/dashboard-event', ...)` call (search `analytics/dashboard-event`); if it was tracking a rules save, that is now covered by the line above — otherwise replace it with the equivalent `lsh.use('timer', '<its old event>')`.
- When the **Rules** section that contains the TTS controls is shown / on load if TTS is always visible: `if (window.lsh) lsh.feature('tts');` and in the TTS save handler: `if (window.lsh) lsh.use('tts', 'tts_config_saved');`
- When the **Delegates** section is opened: `if (window.lsh) lsh.feature('delegates');`; in the "add delegate" success handler: `if (window.lsh) lsh.use('delegates', 'delegate_added');`
- **StreamElements**: when its connect UI is shown `lsh.feature('streamelements')`; in the `/api/streamelements/connect` success handler `lsh.use('streamelements', 'connected')`.
- **YouTube** (the "Multistreaming" section, if present in this build): `lsh.feature('youtube')` on section open; `lsh.use('youtube', 'connected')` after the OAuth-connected callback confirms.
- Any **"Copy Browser Source link"** button on this page: `if (window.lsh) lsh.use('timer', 'copy_overlay_link');` in its click handler.

- [ ] **Step 2: `soundConfigPage.js` (sounds)**

- On load: `if (window.lsh) lsh.feature('sounds');`
- **Remove** the existing ad-hoc `fetch('/api/analytics/dashboard-event', ...)` call; replace with the matching `lsh.use('sounds', '<its old event>')`.
- In the success handlers for: upload → `lsh.use('sounds', 'sound_uploaded')`; create-from-clip → `lsh.use('sounds', 'clip_created')`; add-from-library → `lsh.use('sounds', 'sound_from_library')`; enable channel points on a sound → `lsh.use('sounds', 'channel_points_enabled')`.
- "Copy Browser Source link" for the sound-alert overlay → `lsh.use('sounds', 'copy_overlay_link')`.

- [ ] **Step 3: `goalsConfigPage.js` (goals)**

- On load: `if (window.lsh) lsh.feature('goals');`
- Create-goal success → `lsh.use('goals', 'goal_created')`; save-goal-style success → `lsh.use('goals', 'goal_style_saved')`.
- "Copy Browser Source link" for the goals overlay → `lsh.use('goals', 'copy_overlay_link')`.

- [ ] **Step 4: `utilitiesPage.js` (extras / wheel / prompts / plinko)**

- On load: `if (window.lsh) lsh.feature('extras');`
- In `switchSection(id)` (the sidebar nav handler): when `id === 'wheels'` → `lsh.feature('wheel')`; `'prompts'` → `lsh.feature('prompts')`; `'plinko'` → `lsh.feature('plinko')`. Fire once per section per load (track a `Set` of already-fired keys).
- Wheel: add-wheel / first spin success → `lsh.use('wheel', 'wheel_created')` on add, `lsh.use('wheel', 'wheel_spun')` in the `/api/wheel/spin` success handler.
- Prompts: `/api/prompt/show` success → `lsh.use('prompts', 'prompt_shown')`.
- Plinko: `save()` success (the `/api/plinko/config` POST) → `lsh.use('plinko', 'board_saved')`; `drop()` success (`/api/plinko/drop`) → `lsh.use('plinko', 'dropped')`.
- Each "Copy Browser Source link" button (wheel, prompt, plinko): `lsh.use('<wheel|prompts|plinko>', 'copy_overlay_link')` in its click handler.

- [ ] **Step 5: Render-check every call landed**

Run:
```bash
cd ebs && node --input-type=module -e "
const pages = { overlayConfigPage:['timer','tts','delegates','streamelements','rules_saved'], soundConfigPage:['sounds','sound_uploaded'], goalsConfigPage:['goals','goal_created'], utilitiesPage:['wheel','prompts','plinko','board_saved','dropped'] };
for (const [name, needles] of Object.entries(pages)) {
  const m = await import('./views/' + name + '.js');
  const fn = m['render' + name[0].toUpperCase() + name.slice(1)];
  const html = fn({ overlayKey: 'k', base: '' });
  const missing = needles.filter(n => !html.includes(n));
  console.log(name, missing.length ? 'MISSING ' + missing.join(',') : 'ok');
}
"
```
Expected: `ok` for all four. (Adjust arg shape per page if a render throws — pass whatever minimal options it needs.)

- [ ] **Step 6: Syntax + full suite**

Run: `cd ebs && for f in overlayConfigPage soundConfigPage goalsConfigPage utilitiesPage; do node --check "views/$f.js"; done && npm test`
Expected: clean; all tests pass.

- [ ] **Step 7: Manual E2E**

Server running, logged in as a streamer. In `psql`, `TRUNCATE client_events;` is too destructive — instead note the current `MAX(id)`. Click through: open Sound Alerts (upload a sound), open Goals (create a goal), open Extras → Plinko (save a board, click Drop, click Copy link). Then:
```sql
SELECT event_name, params FROM client_events WHERE id > <MAX_ID_NOTED> ORDER BY id;
```
Expected rows: `page_view {page:sound-config}`, `feature_view {feature:sounds}`, `feature_use {feature:sounds,action:sound_uploaded}`, `page_view {page:goals-config}`, `feature_view {feature:goals}`, `feature_use {feature:goals,action:goal_created}`, `page_view {page:extras}`, `feature_view {feature:extras}`, `feature_view {feature:plinko}`, `feature_use {feature:plinko,action:board_saved}`, `feature_use {feature:plinko,action:dropped}`, `feature_use {feature:plinko,action:copy_overlay_link}`.

- [ ] **Step 8: Commit**

```bash
git add ebs/views/overlayConfigPage.js ebs/views/soundConfigPage.js ebs/views/goalsConfigPage.js ebs/views/utilitiesPage.js
git commit -m "feat(analytics): feature_view/feature_use instrumentation across dashboard pages

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Wipe `client_events` on account deletion

**Files:**
- Modify: `ebs/user_data_deletion.js`

**Interfaces:**
- Consumes: `db` from `./db.js` (add the import if not already present in this file — check the top).
- Produces: `deleteAllUserData(userId)` now also removes that channel's `client_events` rows and includes `"clientEvents"` in the returned `deleted` array.

- [ ] **Step 1: Add the import if missing**

At the top of `ebs/user_data_deletion.js`, ensure:
```js
import { db } from "./db.js";
```

- [ ] **Step 2: Add the delete**

In `deleteAllUserData`, after the block that deletes rules / near the other per-user store deletions, add:
```js
  // Analytics events (first-party client_events table)
  try {
    const r = await db.query("DELETE FROM client_events WHERE channel_id = $1", [uid]);
    if (r.rowCount > 0) deleted.push("clientEvents");
  } catch (err) {
    logger.error("delete_client_events_failed", { userId: uid, message: err?.message });
  }
```
(`uid` is the already-normalised `String(userId)` local in this function; `logger` is imported here — match the surrounding calls.)

- [ ] **Step 3: Syntax-check**

Run: `cd ebs && node --check user_data_deletion.js`
Expected: no output.

- [ ] **Step 4: Manual verification**

Server + `psql`. Insert `INSERT INTO client_events (channel_id, event_name, surface, params) VALUES ('99999','page_view','dashboard','{"page":"home"}');`
Trigger deletion for a disposable test id via the super-admin "delete user" path (or call `deleteAllUserData('99999', {})` from a `node -e` REPL against the module). Then `SELECT COUNT(*) FROM client_events WHERE channel_id='99999';` → `0`.

- [ ] **Step 5: Commit**

```bash
git add ebs/user_data_deletion.js
git commit -m "fix(gdpr): delete client_events on account deletion

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Retention sweep + indexes

**Files:**
- Modify: `ebs/server.js`

**Interfaces:**
- Consumes: `db` from `./db.js` (already imported in `server.js`); `logger` (already imported).
- Produces: on boot, `CREATE INDEX IF NOT EXISTS` runs once (idempotent); a `setInterval` prunes `client_events` older than 12 months daily.

- [ ] **Step 1: Add the boot-time index ensure**

Near the other startup `load*()` fire-and-forget calls (search for `loadRules().catch`), add:
```js
// One-time, idempotent — keeps the feature-usage aggregate cheap as client_events grows.
(async () => {
  try {
    await db.query("CREATE INDEX IF NOT EXISTS client_events_name_created_idx ON client_events (event_name, created_at)");
    await db.query("CREATE INDEX IF NOT EXISTS client_events_feature_idx ON client_events ((params::jsonb ->> 'feature')) WHERE params ~ '^\\s*\\{'");
  } catch (err) {
    logger.error("client_events_index_ensure_failed", { message: err?.message });
  }
})();
```

- [ ] **Step 2: Add the daily retention sweep**

Near the existing `setInterval(...)` cleanup loops (search for `SEEN_CLEANUP_YIELD_BATCH_SIZE` or `10 * 60 * 1000`), add:
```js
// client_events retention: 12 months (spec). Low volume — a single DELETE daily.
setInterval(async () => {
  try {
    const r = await db.query("DELETE FROM client_events WHERE created_at < now() - interval '12 months'");
    if (r.rowCount > 0) logger.info("client_events_pruned", { rows: r.rowCount });
  } catch (err) {
    logger.error("client_events_prune_failed", { message: err?.message });
  }
}, 24 * 60 * 60 * 1000);
```

- [ ] **Step 3: Syntax-check + boot**

Run:
```bash
cd ebs && node --check server.js && (node server.js & SVPID=$!; sleep 6; grep -E "listening on|index_ensure_failed|prune_failed" /dev/stdin <<< "$(jobs -p >/dev/null; true)"; kill $SVPID)
```
Simpler: `node server.js`, wait for `EBS listening on`, confirm no `client_events_index_ensure_failed` in the logs, then Ctrl-C. In `psql`: `\d client_events` shows `client_events_name_created_idx` and `client_events_feature_idx`.

- [ ] **Step 4: Commit**

```bash
git add ebs/server.js
git commit -m "feat(analytics): client_events indexes + 12-month retention sweep

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage**

| Spec section | Task |
|---|---|
| Event taxonomy (`page_view`/`feature_view`/`feature_use`, params) | 1 (helper), 5 (page_view), 6 (feature_*) |
| 11 feature keys + actions | Global Constraints + Task 6 checklist + `FEATURE_CATALOG` (Task 2) |
| `renderAnalyticsScript` helper (`window.lsh`, keepalive, auto page_view) | 1 |
| Injected next to `renderThemeBootstrapScript()`/`renderFirebaseScript()` | 5 |
| Remove the 2 pre-existing ad-hoc `dashboard-event` calls | 6 (steps 1, 2) |
| `GET /api/admin/analytics/feature-usage` (super-admin, `parseDateRange`, response shape) | 3 |
| `reached`/`used`/`useEvents`/`*Prev`/trend/`useRate`, zero-event rows, sort | 2 |
| `activeStreamers` = distinct channel over the 3 events; `registeredTotal` from `getAllUserIds().length`, null-tolerant | 2, 3 |
| Feature Usage `table-card` in `data-section="analytics"`, range toolbar reuse, header line, trend arrow, no sparklines | 4 |
| `client_events` in `deleteAllUserData` | 7 |
| 12-month retention sweep | 8 |
| Indexes `(event_name, created_at)` and `((params::jsonb->>'feature'))` | 8 |
| Error handling: swallowed client fetch; 500 on endpoint; tolerate bad `params` (`~ '^\s*\{'`); `registeredTotal: null` fallback | 1, 3 |
| Out of scope (retention/funnel/per-user/extension rollup/charts/backfill) | not implemented — correct |

No gaps.

**2. Placeholder scan** — no "TBD/handle edge cases/similar to Task N"; every code step has real code. Task 6 lists each call site explicitly rather than "instrument the pages". The only judgement left to the implementer is *which existing handler* a `lsh.use` line goes inside — unavoidable without reproducing each page's full JS here, and the search anchors ("the `/api/rules` POST", "`save()` success") are precise.

**3. Type consistency** — `shapeFeatureUsage` input row `{ feature, event_name, distinct_channels, event_count }` matches the `aggSql` column aliases in Task 3 exactly. Output fields (`reached, used, useEvents, reachedPrev, usedPrev, trend, useRate, activeStreamers, registeredTotal`) are consumed verbatim by Task 4's render JS. `FEATURE_CATALOG` labels ("Sound Alerts", "Timer / Countdown", …) are asserted in Task 2's tests and rendered as-is in Task 4. Event/param string literals are identical across Tasks 1, 3, 6 and Global Constraints.

---

## Execution Handoff

See the offer in chat.
