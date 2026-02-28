import {
  THEME_CSS_VARS,
  THEME_TOGGLE_STYLES,
  renderThemeBootstrapScript,
} from "./theme.js";
import { GLOBAL_HEADER_STYLES, renderGlobalHeader } from "./globalHeader.js";
import { renderFirebaseScript } from "./firebase.js";

export function renderGoalsConfigPage(options = {}) {
  const base = String(options.base || "");
  const adminName = String(options.adminName || "");
  const userKey = String(options.userKey || "");
  const settings = options.settings || {};
  const showAdminLink = Boolean(options.showAdminLink);

  const privacyUrl = `${base}/privacy`;
  const gdprUrl = `${base}/gdpr`;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Goals – Livestreamer Hub</title>
    <link rel="icon" type="image/png" href="/assets/convertico-coin_24x24.png">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/driver.js@1.3.1/dist/driver.css"/>
    ${renderThemeBootstrapScript()}
    ${renderFirebaseScript()}
    <style>
      ${THEME_CSS_VARS}
      body { margin: 0; font-family: Inter, system-ui, Arial, sans-serif; background: var(--page-bg); color: var(--text-color); min-height: 100vh; display: flex; flex-direction: column; }
      main { flex: 1; width: min(900px, 100%); margin: 32px auto 48px; padding: 0 20px; }
      h1 { margin: 0 0 4px; font-size: 26px; }
      .subtitle { margin: 0 0 24px; color: var(--text-muted); font-size: 14px; }
      input[type="text"], input[type="number"], input[type="datetime-local"], select, textarea {
        box-sizing: border-box;
        padding: 6px 8px;
        border: 1px solid var(--input-border);
        border-radius: 8px;
        background: var(--input-bg);
        color: var(--text-color);
        font-size: 14px;
        width: 100%;
      }
      input[type="checkbox"] { transform: scale(1.1); }
      input[type="color"] { height: 32px; }
      button { background: var(--accent-color); color: #ffffff; border: 0; padding: 8px 10px; border-radius: 8px; cursor: pointer; }
      button.secondary { background: var(--secondary-button-bg); color: var(--secondary-button-text); border: 1px solid var(--secondary-button-border); }
      button { transition: transform .04s ease, box-shadow .15s ease, filter .15s ease, opacity .2s; }
      button:hover { box-shadow: 0 0 0 1px rgba(0,0,0,0.2) inset; filter: brightness(1.02); }
      button:active { transform: translateY(1px) scale(0.99); filter: brightness(0.98); }
      button:disabled { opacity: 0.5; cursor: not-allowed; }
      @keyframes btnpulse { 0% { transform: scale(0.99); } 100% { transform: scale(1); } }
      .btn-click { animation: btnpulse .18s ease; }
      iframe { width: 100%; height: 180px; border: 1px solid var(--surface-border); background: var(--surface-muted); border-radius: 12px; box-shadow: 0 8px 30px var(--goal-card-shadow); }
      .goal-toolbar { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
      .goal-list { display: flex; flex-direction: column; gap: 16px; }
      .goal-card { background: var(--goal-card-bg); border: 1px solid var(--goal-card-border); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 12px 30px var(--goal-card-shadow); }
      .goal-card-header { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: center; }
      .goal-card-header .meta { font-size: 12px; color: var(--text-muted); display: flex; flex-direction: column; gap: 2px; }
      .goal-card-actions { display: flex; gap: 8px; flex-wrap: wrap; }
      .goal-preview { border: 1px solid var(--goal-preview-border); border-radius: 12px; padding: 12px; background: var(--goal-preview-bg); display: flex; flex-direction: column; gap: 8px; }
      .goal-preview-header { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--text-muted); }
      .goal-preview-canvas { min-height: 140px; border-radius: 12px; background: var(--surface-muted); padding: 16px; display: flex; align-items: center; justify-content: center; overflow: hidden; box-sizing: border-box; }
      .goal-preview-note { font-size: 12px; color: var(--text-muted); }
      .goal-preview-card { width: 100%; display: flex; flex-direction: column; gap: 6px; padding: 16px 28px; border-radius: 12px; box-sizing: border-box; }
      .goal-preview-card .goal-preview-title { font-size: 18px; font-weight: 600; }
      .goal-preview-card .goal-preview-values { font-size: 14px; color: var(--text-muted); margin-bottom: 10px; display: flex; gap: 12px; flex-wrap: wrap; }
      .goal-preview-card .goal-preview-track { width: 100%; height: 28px; border-radius: 999px; background: var(--surface-muted); overflow: hidden; position: relative; margin: 0 8px; }
      .goal-preview-card .goal-preview-fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0%; display: flex; }
      .goal-preview-card .goal-preview-pct { font-size: 22px; font-weight: 700; }
      .goal-preview-card .goal-preview-legend { display: flex; flex-wrap: wrap; gap: 6px 12px; font-size: 11px; color: var(--text-muted); margin-top: 8px; }
      .goal-card-section { border: 1px solid var(--section-border); border-radius: 10px; margin-top: 8px; background: var(--section-bg); }
      .goal-card-section:first-of-type { margin-top: 0; }
      .goal-section-header { display: flex; align-items: center; padding-right: 8px; }
      .goal-section-toggle { flex: 1; display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: transparent; border: 0; color: inherit; font-weight: 600; cursor: pointer; border-radius: 10px; }
      .goal-section-toggle span:last-child { font-size: 12px; color: var(--text-muted); }
      .goal-section-body { padding: 0 12px 12px; }
      .goal-card-section.collapsed .goal-section-body { display: none; }
      .goal-card-section.collapsed .goal-section-toggle span:last-child { transform: rotate(-90deg); }
      .goal-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
      .goal-field { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
      .goal-field label { font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; color: var(--text-muted); }
      .goal-url code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; display: block; margin-top: 4px; background: var(--code-bg); border: 1px solid var(--code-border); padding: 6px 8px; border-radius: 6px; color: var(--text-color); }
      .goal-empty { padding: 14px; border: 1px dashed var(--empty-border); border-radius: 10px; text-align: center; color: var(--text-muted); }
      .goal-manual { display: flex; flex-direction: column; gap: 6px; }
      .goal-manual-row { display: flex; gap: 8px; flex-wrap: wrap; }
      .goal-manual-row input[type="number"] { max-width: 140px; }
      button.danger { background: #b91c1c; }
      .goal-pill { padding: 2px 8px; border-radius: 999px; background: var(--pill-bg); border: 1px solid var(--pill-border); font-size: 12px; letter-spacing: 0.05em; text-transform: uppercase; color: var(--text-muted); }
      .hint { font-size: 12px; color: var(--text-muted); }

      .section-help-btn { background: none; border: 1px solid var(--input-border); color: var(--text-muted); width: 22px; height: 22px; border-radius: 50%; font-size: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; padding: 0; flex-shrink: 0; transition: color 0.15s, border-color 0.15s; }
      .section-help-btn:hover { color: #9146ff; border-color: #9146ff; }
      .goal-toolbar { align-items: center; }
      ${GLOBAL_HEADER_STYLES}
      ${THEME_TOGGLE_STYLES}

      .global-footer {
        text-align: center;
        padding: 18px;
        color: var(--text-muted);
        font-size: 12px;
        border-top: 1px solid var(--surface-border);
        display: flex;
        justify-content: center;
        gap: 18px;
        flex-wrap: wrap;
      }
      .global-footer a {
        color: var(--text-muted);
        text-decoration: none;
        transition: color .15s ease;
      }
      .global-footer a:hover { color: var(--text-color); }
    </style>
  </head>
  <body>
    ${renderGlobalHeader({
      base,
      adminName,
      active: "goals",
      includeThemeToggle: true,
      showFeedback: true,
      showLogout: true,
      showAdminLink,
    })}
    <main>
      <h1>Goal Tracking Bars</h1>
      <p class="subtitle">
        Create persistent goal bars for subs, bits, or mixed fundraisers. Customize the layout, auto-counting rules, and copy goal-specific Browser Source URLs for OBS or Streamlabs.
      </p>
      <div class="goal-toolbar">
        <button id="createGoal">New goal</button>
        <button class="secondary" id="createSubGoal">New sub goal</button>
        <button class="secondary" id="refreshGoals">Refresh</button>
        <button class="section-help-btn" data-help="toolbar" title="What are goals?">?</button>
      </div>
      <div id="goalList" class="goal-list">
        <div class="goal-empty">Loading goals\u2026</div>
      </div>
    </main>
    <footer class="global-footer">
      <a href="${privacyUrl}">Privacy Policy</a>
      <a href="${gdprUrl}">GDPR / UK GDPR Disclosure</a>
      <a href="https://discord.gg/nwu4w5cUVd" target="_blank" rel="noopener noreferrer"><svg style="width:14px;height:14px;fill:currentColor;vertical-align:-2px;margin-right:3px" viewBox="0 0 127.14 96.36"><path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0 105.89 105.89 0 0 0 19.39 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2.03a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2.03a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69C36.18 65.69 31 60 31 53.05s5-12.68 11.45-12.68S54 46.09 53.89 53.05 48.84 65.69 42.45 65.69Zm42.24 0C78.41 65.69 73.25 60 73.25 53.05s5-12.68 11.44-12.68S96.23 46.09 96.12 53.05 91.08 65.69 84.69 65.69Z"/></svg>Discord</a>
    </footer>
    <script>
      const GOAL_OVERLAY_BASE = window.location.origin + '/overlay/goal';
      const USER_KEY = '${userKey}';
      const goalListEl = document.getElementById('goalList');
      const goalCreateBtn = document.getElementById('createGoal');
      const goalCreateSubBtn = document.getElementById('createSubGoal');
      const goalRefreshBtn = document.getElementById('refreshGoals');
      const goalState = { goals: [], defaults: null };
      const goalSegmentLabels = {
        tier1000: 'Tier 1',
        tier2000: 'Tier 2',
        tier3000: 'Tier 3',
        resub: 'Resub',
        gift: 'Gift subs',
        bits: 'Bits',
        tips: 'Tips',
        charity: 'Charity',
        manual: 'Manual',
        other: 'Other'
      };
      const goalSectionStateKey = 'overlay_goal_section_state_v1';
      let goalSectionState = {};
      try {
        const saved = JSON.parse(window.localStorage.getItem(goalSectionStateKey) || '{}');
        if (saved && typeof saved === 'object') goalSectionState = saved;
      } catch (e) {}

      const htmlEscapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

      function escHtml(value) {
        return String(value != null ? value : '').replace(/[&<>"']/g, function(ch) { return htmlEscapeMap[ch] || ch; });
      }

      function prettyNumber(value) {
        const n = Number(value) || 0;
        return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
      }

      function setBusy(btn, busy) { if (!btn) return; btn.disabled = !!busy; }
      function flashButton(btn) { if (!btn) return; btn.classList.add('btn-click'); setTimeout(function() { btn.classList.remove('btn-click'); }, 160); }

      function goalDateValue(iso) {
        if (!iso) return '';
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return '';
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        return yyyy + '-' + mm + '-' + dd + 'T' + hh + ':' + min;
      }

      function assignPath(target, path, value) {
        if (!path) return;
        const keys = path.split('.');
        let ref = target;
        for (let i = 0; i < keys.length; i += 1) {
          const key = keys[i];
          if (i === keys.length - 1) {
            ref[key] = value;
          } else {
            if (typeof ref[key] !== 'object' || ref[key] === null) ref[key] = {};
            ref = ref[key];
          }
        }
      }

      function persistGoalSectionState() {
        try { window.localStorage.setItem(goalSectionStateKey, JSON.stringify(goalSectionState)); } catch (e) {}
      }

      function setGoalSectionState(id, collapsed) {
        if (!id) return;
        goalSectionState[id] = Boolean(collapsed);
        persistGoalSectionState();
      }

      function applyGoalSectionState(card) {
        if (!card) return;
        card.querySelectorAll('[data-goal-section]').forEach(function(section) {
          const id = section.getAttribute('data-goal-section');
          if (!id) return;
          const collapsed = Boolean(goalSectionState[id]);
          section.classList.toggle('collapsed', collapsed);
        });
      }

      function deepCloneGoal(goal) {
        return JSON.parse(JSON.stringify(goal || {}));
      }

      function mergeGoalDraft(target, patch) {
        if (!patch || typeof patch !== 'object') return target;
        for (const [key, value] of Object.entries(patch)) {
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            const base = (typeof target[key] === 'object' && target[key] !== null) ? target[key] : {};
            target[key] = mergeGoalDraft(Object.assign({}, base), value);
          } else if (value !== undefined) {
            target[key] = value;
          }
        }
        return target;
      }

      function buildPreviewGoal(goal, card) {
        const draft = collectGoalPayload(card);
        const merged = mergeGoalDraft(deepCloneGoal(goal), draft);
        if (!merged.style) merged.style = {};
        if (!merged.style.segmentColors) merged.style.segmentColors = {};
        if (!merged.segments) merged.segments = {};
        return merged;
      }

      function renderGoalPreview(card) {
        if (!card) return;
        const mount = card.querySelector('[data-goal-preview]');
        if (!mount) return;
        const goalId = card.getAttribute('data-goal-id');
        const goal = goalState.goals.find(function(g) { return g.id === goalId; });
        if (!goal) {
          mount.textContent = '';
          var note = document.createElement('div');
          note.className = 'goal-preview-note';
          note.textContent = 'Save this goal to preview.';
          mount.appendChild(note);
          return;
        }
        const data = buildPreviewGoal(goal, card);
        const style = data.style || {};
        const unit = data.unitLabel || 'points';
        const percent = data.targetValue > 0 ? Math.min(100, Math.max(0, (Number(data.currentValue || 0) / Number(data.targetValue || 0)) * 100)) : 0;
        const container = document.createElement('div');
        container.className = 'goal-preview-card';
        container.style.color = style.labelColor || '#FFFFFF';
        if (style.backgroundColor) container.style.background = style.backgroundColor;
        container.style.padding = '8px 10px';
        container.style.alignItems =
          style.align === 'left' ? 'flex-start' : style.align === 'right' ? 'flex-end' : 'center';
        const title = document.createElement('div');
        title.className = 'goal-preview-title';
        title.textContent = data.title || 'Untitled Goal';
        if (style.showLabel === false) title.style.display = 'none';
        container.appendChild(title);
        const values = document.createElement('div');
        values.className = 'goal-preview-values';
        values.textContent =
          prettyNumber(Math.max(0, data.currentValue || 0)) +
          ' / ' +
          prettyNumber(Math.max(1, data.targetValue || 0)) +
          ' ' +
          unit;
        if (style.showValue === false) values.style.display = 'none';
        container.appendChild(values);
        const track = document.createElement('div');
        track.className = 'goal-preview-track';
        track.style.height = Math.max(16, Number(style.trackThickness || 32)) + 'px';
        track.style.borderRadius = Math.max(4, Number(style.borderRadius || 20)) + 'px';
        track.style.background = style.emptyColor || 'rgba(255,255,255,0.12)';
        const fill = document.createElement('div');
        fill.className = 'goal-preview-fill';
        const gradient =
          style.fillSecondaryColor && style.fillSecondaryColor !== style.fillColor
            ? 'linear-gradient(90deg, ' + (style.fillColor || '#9146FF') + ', ' + style.fillSecondaryColor + ')'
            : (style.fillColor || '#9146FF');
        fill.style.background = gradient;
        fill.style.width = percent + '%';
        const segments = Object.entries(data.segments || {}).filter(function(entry) { return Number(entry[1]) > 0; });
        const totalSegments = segments.reduce(function(sum, entry) { return sum + Number(entry[1] || 0); }, 0) || Math.max(1, Number(data.currentValue || 0));
        if (style.showSegmentsOnBar !== false && totalSegments > 0) {
          fill.style.display = 'flex';
          fill.style.gap = '2px';
          segments.forEach(function(entry) {
            var key = entry[0], val = entry[1];
            const seg = document.createElement('div');
            seg.style.flex = String(Math.max(0, Number(val || 0)));
            seg.style.background = (style.segmentColors && style.segmentColors[key]) || '#ffffff';
            fill.appendChild(seg);
          });
        }
        track.appendChild(fill);
        container.appendChild(track);
        const pct = document.createElement('div');
        pct.className = 'goal-preview-pct';
        pct.style.color = style.percentColor || '#FFFFFF';
        pct.textContent = percent.toFixed(1).replace(/\\.0$/, '') + '%';
        if (style.showPercent === false) pct.style.display = 'none';
        container.appendChild(pct);
        if (style.showSegmentLegend !== false && segments.length) {
          const legend = document.createElement('div');
          legend.className = 'goal-preview-legend';
          segments.forEach(function(entry) {
            var key = entry[0], val = entry[1];
            const span = document.createElement('span');
            const label = goalSegmentLabels[key] || key;
            span.textContent = label + ': ' + prettyNumber(val);
            span.style.color = (style.segmentColors && style.segmentColors[key]) || '#ffffff';
            legend.appendChild(span);
          });
          container.appendChild(legend);
        }
        mount.textContent = '';
        mount.appendChild(container);
      }

      function refreshGoalPreviews(targetCard) {
        if (targetCard) {
          applyGoalSectionState(targetCard);
          renderGoalPreview(targetCard);
          return;
        }
        if (!goalListEl) return;
        goalListEl.querySelectorAll('.goal-card').forEach(function(card) {
          applyGoalSectionState(card);
          renderGoalPreview(card);
        });
      }

      function goalEmbedUrl(goal, slugOverride) {
        if (!goal) return GOAL_OVERLAY_BASE;
        const slug = (slugOverride && String(slugOverride).trim()) || goal.overlaySlug || goal.id;
        let url = GOAL_OVERLAY_BASE + '?goal=' + encodeURIComponent(slug || goal.id);
        if (USER_KEY) url += '&key=' + encodeURIComponent(USER_KEY);
        return url;
      }

      function boolAttr(flag) {
        return flag ? 'checked' : '';
      }

      function goalCardTemplate(goal) {
        const style = goal.style || {};
        const rules = goal.rules || {};
        const isSubGoal = String(goal.type || '').toLowerCase() === 'sub_goal';
        const startVal = goalDateValue(goal.startAt);
        const endVal = goalDateValue(goal.endAt);
        const progress = goal.targetValue > 0 ? Math.min(100, Math.max(0, (goal.currentValue || 0) / goal.targetValue * 100)).toFixed(1).replace(/\\.0$/, '') : '0';
        const subBaseline = isSubGoal ? Number(goal.subBaseline != null ? goal.subBaseline : (goal.meta && goal.meta.subBaseline != null ? goal.meta.subBaseline : 0)) : null;
        const lastSubCount = isSubGoal ? Number(goal.lastSubCount != null ? goal.lastSubCount : (goal.meta && goal.meta.lastSubCount != null ? goal.meta.lastSubCount : 0)) : null;
        const embed = escHtml(goalEmbedUrl(goal));
        const showOverlay = rules.showOnOverlay !== false;
        const archived = Boolean(goal.archived);
        const tierWeights = rules.tierWeights || {};
        const segmentColors = style.segmentColors || {};
        const baselineText = Number.isFinite(subBaseline) ? prettyNumber(subBaseline) : '\u2014';
        const liveText = Number.isFinite(lastSubCount) ? prettyNumber(lastSubCount) : '\u2014';
        const unitField = isSubGoal
          ? '<div class="goal-field"><label>Unit label</label><div class="hint">Sub goals always use subs</div></div>'
          : '<div class="goal-field">' +
                '<label>Unit label</label>' +
                '<input type="text" data-field="unitLabel" value="' + escHtml(goal.unitLabel || 'points') + '" placeholder="points, minutes, subs\u2026" />' +
              '</div>';
        const subInfoBlock = isSubGoal
          ? '<div class="goal-field" style="grid-column:1 / -1;">' +
                '<label>Live sub count</label>' +
                '<div class="hint">Current subs: ' + liveText + ' \u2022 Baseline: ' + baselineText + '</div>' +
             '</div>'
          : '';
        const rulesSection = isSubGoal
          ? ''
          : '<div class="goal-card-section" data-goal-section="rules">' +
               '<div class="goal-section-header">' +
                 '<button type="button" class="goal-section-toggle" data-goal-section-toggle="rules">' +
                   '<span>Rules &amp; contributions</span>' +
                   '<span>\u25BE</span>' +
                 '</button>' +
                 '<button class="section-help-btn" data-help="rules" title="What is this section?">?</button>' +
               '</div>' +
               '<div class="goal-section-body">' +
                 '<div class="goal-grid">' +
                   '<div class="goal-field"><label><input type="checkbox" data-field="rules.autoTrackSubs" ' + boolAttr(rules.autoTrackSubs !== false) + ' /> Auto-count new subs</label></div>' +
                   '<div class="goal-field"><label><input type="checkbox" data-field="rules.autoTrackResubs" ' + boolAttr(rules.autoTrackResubs !== false) + ' /> Auto-count resubs</label></div>' +
                   '<div class="goal-field"><label><input type="checkbox" data-field="rules.autoTrackGifts" ' + boolAttr(rules.autoTrackGifts !== false) + ' /> Auto-count gift subs</label></div>' +
                   '<div class="goal-field"><label><input type="checkbox" data-field="rules.autoTrackBits" ' + boolAttr(rules.autoTrackBits) + ' /> Auto-count bits</label></div>' +
                   '<div class="goal-field"><label><input type="checkbox" data-field="rules.autoTrackTips" ' + boolAttr(rules.autoTrackTips) + ' /> Auto-count tips</label></div>' +
                   '<div class="goal-field"><label><input type="checkbox" data-field="rules.autoTrackCharity" ' + boolAttr(rules.autoTrackCharity) + ' /> Auto-count charity</label></div>' +
                   '<div class="goal-field"><label><input type="checkbox" data-field="rules.autoTrackFollows" ' + boolAttr(rules.autoTrackFollows) + ' /> Auto-count follows</label></div>' +
                   '<div class="goal-follow-options" style="grid-column:1/-1;display:' + (rules.autoTrackFollows ? 'grid' : 'none') + ';grid-template-columns:1fr 1fr;gap:12px;">' +
                     '<div class="goal-field">' +
                       '<label>Follow mode</label>' +
                       '<select data-field="rules.followMode">' +
                         '<option value="new" ' + (rules.followMode !== 'all' ? 'selected' : '') + '>New followers only</option>' +
                         '<option value="all" ' + (rules.followMode === 'all' ? 'selected' : '') + '>Include existing followers</option>' +
                       '</select>' +
                       '<div class="hint">' + (rules.followMode === 'all' ? 'Existing followers count toward the goal' : 'Only new follows after enabling count toward the goal') + '</div>' +
                     '</div>' +
                     '<div class="goal-field">' +
                       '<label>Value per follow</label>' +
                       '<input type="number" min="0" step="0.1" data-field="rules.followWeight" value="' + Number(rules.followWeight || 1) + '" />' +
                     '</div>' +
                     '<div class="goal-field" style="grid-column:1/-1;">' +
                       '<div class="hint">Follower baseline: ' + (Number.isFinite(goal.followBaseline) ? prettyNumber(goal.followBaseline) + ' followers when tracking was enabled' : 'Not yet set \u2014 will be captured when you save') + '</div>' +
                     '</div>' +
                   '</div>' +
                   '<div class="goal-field">' +
                     '<label>Tier 1 weight</label>' +
                     '<input type="number" min="0" step="0.1" data-field="rules.tierWeights.1000" value="' + Number(tierWeights['1000'] != null ? tierWeights['1000'] : 1) + '" />' +
                   '</div>' +
                   '<div class="goal-field">' +
                     '<label>Tier 2 weight</label>' +
                     '<input type="number" min="0" step="0.1" data-field="rules.tierWeights.2000" value="' + Number(tierWeights['2000'] != null ? tierWeights['2000'] : 2) + '" />' +
                   '</div>' +
                   '<div class="goal-field">' +
                     '<label>Tier 3 weight</label>' +
                     '<input type="number" min="0" step="0.1" data-field="rules.tierWeights.3000" value="' + Number(tierWeights['3000'] != null ? tierWeights['3000'] : 6) + '" />' +
                   '</div>' +
                   '<div class="goal-field">' +
                     '<label>Resub weight</label>' +
                     '<input type="number" min="0" step="0.1" data-field="rules.resubWeight" value="' + Number(rules.resubWeight || 1) + '" />' +
                   '</div>' +
                   '<div class="goal-field">' +
                     '<label>Gift weight per sub</label>' +
                     '<input type="number" min="0" step="0.1" data-field="rules.giftWeightPerSub" value="' + Number(rules.giftWeightPerSub || 0) + '" />' +
                   '</div>' +
                   '<div class="goal-field">' +
                     '<label>Bits per unit</label>' +
                     '<input type="number" min="1" step="1" data-field="rules.bitsPerUnit" value="' + Number(rules.bitsPerUnit || 100) + '" />' +
                   '</div>' +
                   '<div class="goal-field">' +
                     '<label>Value per bits unit</label>' +
                     '<input type="number" min="0" step="0.1" data-field="rules.bitsUnitValue" value="' + Number(rules.bitsUnitValue || 1) + '" />' +
                   '</div>' +
                   '<div class="goal-field">' +
                     '<label>Value per USD (tips)</label>' +
                     '<input type="number" min="0" step="0.1" data-field="rules.tipsPerUsd" value="' + Number(rules.tipsPerUsd || 1) + '" />' +
                   '</div>' +
                   '<div class="goal-field">' +
                     '<label>Value per USD (charity)</label>' +
                     '<input type="number" min="0" step="0.1" data-field="rules.charityPerUsd" value="' + Number(rules.charityPerUsd || 1) + '" />' +
                   '</div>' +
                   '<div class="goal-field">' +
                     '<label>Manual unit value</label>' +
                     '<input type="number" min="0" step="0.1" data-field="rules.manualUnitValue" value="' + Number(rules.manualUnitValue || 1) + '" />' +
                   '</div>' +
                 '</div>' +
               '</div>' +
             '</div>';
        const manualSection = isSubGoal
          ? ''
          : '<div class="goal-card-section goal-manual" data-goal-section="manual">' +
               '<div class="goal-section-header">' +
                 '<button type="button" class="goal-section-toggle" data-goal-section-toggle="manual">' +
                   '<span>Manual adjustments</span>' +
                   '<span>\u25BE</span>' +
                 '</button>' +
                 '<button class="section-help-btn" data-help="manual" title="What is this section?">?</button>' +
               '</div>' +
               '<div class="goal-section-body">' +
                 '<div class="goal-manual-row">' +
                   '<select data-manual-field="type">' +
                     '<option value="tier1000">Tier 1 sub</option>' +
                     '<option value="tier2000">Tier 2 sub</option>' +
                     '<option value="tier3000">Tier 3 sub</option>' +
                     '<option value="gift">Gift subs</option>' +
                     '<option value="resub">Resub</option>' +
                     '<option value="bits">Bits</option>' +
                     '<option value="tips">Tips</option>' +
                     '<option value="charity">Charity</option>' +
                     '<option value="follows">Follows</option>' +
                     '<option value="manual" selected>Manual value</option>' +
                   '</select>' +
                   '<input type="number" min="0" step="1" data-manual-field="amount" placeholder="Amount" />' +
                  '<input type="text" data-manual-field="note" placeholder="Note (optional)" />' +
                  '<button class="secondary" data-action="manual">Apply</button>' +
                '</div>' +
               '</div>' +
             '</div>';
        return '<div class="goal-card" data-goal-id="' + goal.id + '" data-goal-slug="' + escHtml(goal.overlaySlug || '') + '">' +
          '<div class="goal-card-header">' +
            '<div class="meta">' +
              '<div>Goal ID: ' + goal.id + '</div>' +
              '<div>Progress: ' + prettyNumber(goal.currentValue || 0) + ' / ' + prettyNumber(goal.targetValue || 0) + ' (' + progress + '%)</div>' +
            '</div>' +
            '<div class="goal-card-actions">' +
              '<button data-action="save">Save goal</button>' +
              '<button class="secondary" data-action="copy">Copy URL</button>' +
            '</div>' +
            (isSubGoal ? '<div class="goal-pill">Sub Goal</div>' : '') +
          '</div>' +
          '<div class="goal-preview">' +
            '<div class="goal-preview-header">' +
              '<span>Live preview</span>' +
              '<button class="secondary" data-action="refresh-preview">Reload</button>' +
            '</div>' +
            '<div class="goal-preview-canvas" data-goal-preview>' +
              '<div class="goal-preview-note">Edit the goal settings below to see changes.</div>' +
            '</div>' +
          '</div>' +
          '<div class="goal-card-section" data-goal-section="basics">' +
            '<div class="goal-section-header">' +
              '<button type="button" class="goal-section-toggle" data-goal-section-toggle="basics">' +
                '<span>Basics</span>' +
                '<span>\u25BE</span>' +
              '</button>' +
              '<button class="section-help-btn" data-help="basics" title="What is this section?">?</button>' +
            '</div>' +
            '<div class="goal-section-body">' +
              '<div class="goal-grid">' +
                '<div class="goal-field">' +
                  '<label>Title</label>' +
                  '<input type="text" data-field="title" value="' + escHtml(goal.title || (isSubGoal ? 'Sub Goal' : 'New Goal')) + '" placeholder="Weekly Sub Goal" />' +
                '</div>' +
                '<div class="goal-field">' +
                  '<label>Description</label>' +
                  '<textarea rows="2" data-field="description" placeholder="Optional context">' + escHtml(goal.description || '') + '</textarea>' +
                '</div>' +
                '<div class="goal-field">' +
                  '<label>Overlay slug</label>' +
                  '<input type="text" data-field="overlaySlug" value="' + escHtml(goal.overlaySlug || '') + '" placeholder="Optional short slug" />' +
                '</div>' +
                '<div class="goal-field">' +
                  '<label>Target value</label>' +
                  '<input type="number" min="1" step="1" data-field="targetValue" value="' + Number(goal.targetValue || 0) + '" />' +
                '</div>' +
                unitField +
                '<div class="goal-field">' +
                  '<label>Start</label>' +
                  '<input type="datetime-local" data-field="startAt" value="' + startVal + '" />' +
                '</div>' +
                '<div class="goal-field">' +
                  '<label>End</label>' +
                  '<input type="datetime-local" data-field="endAt" value="' + endVal + '" />' +
                '</div>' +
                '<div class="goal-field">' +
                  '<label>Show on overlay</label>' +
                  '<label style="display:flex; align-items:center; gap:6px;"><input type="checkbox" data-field="rules.showOnOverlay" ' + boolAttr(showOverlay) + ' /> Visible</label>' +
                '</div>' +
                '<div class="goal-field">' +
                  '<label>Archived</label>' +
                  '<label style="display:flex; align-items:center; gap:6px;"><input type="checkbox" data-field="archived" ' + boolAttr(archived) + ' /> Hide from dashboard</label>' +
                '</div>' +
                subInfoBlock +
              '</div>' +
              '<div class="goal-url">' +
                '<label>Browser Source URL</label>' +
                '<code data-embed="url">' + embed + '</code>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="goal-card-section" data-goal-section="appearance">' +
            '<div class="goal-section-header">' +
              '<button type="button" class="goal-section-toggle" data-goal-section-toggle="appearance">' +
                '<span>Appearance</span>' +
                '<span>\u25BE</span>' +
              '</button>' +
              '<button class="section-help-btn" data-help="appearance" title="What is this section?">?</button>' +
            '</div>' +
            '<div class="goal-section-body">' +
              '<div class="goal-grid">' +
                '<div class="goal-field">' +
                  '<label>Orientation</label>' +
                  '<select data-field="style.orientation">' +
                    '<option value="horizontal" ' + (style.orientation === 'vertical' ? '' : 'selected') + '>Horizontal</option>' +
                    '<option value="vertical" ' + (style.orientation === 'vertical' ? 'selected' : '') + '>Vertical</option>' +
                  '</select>' +
                '</div>' +
                '<div class="goal-field">' +
                  '<label>Align</label>' +
                  '<select data-field="style.align">' +
                    '<option value="left" ' + (style.align === 'left' ? 'selected' : '') + '>Left</option>' +
                    '<option value="center" ' + (!style.align || style.align === 'center' ? 'selected' : '') + '>Center</option>' +
                    '<option value="right" ' + (style.align === 'right' ? 'selected' : '') + '>Right</option>' +
                  '</select>' +
                '</div>' +
                '<div class="goal-field">' +
                  '<label>Width (px)</label>' +
                  '<input type="number" min="200" step="10" data-field="style.width" value="' + Number(style.width || 820) + '" />' +
                '</div>' +
                '<div class="goal-field">' +
                  '<label>Height (px)</label>' +
                  '<input type="number" min="160" step="10" data-field="style.height" value="' + Number(style.height || 240) + '" />' +
                '</div>' +
                '<div class="goal-field">' +
                  '<label>Track thickness</label>' +
                  '<input type="number" min="10" step="2" data-field="style.trackThickness" value="' + Number(style.trackThickness || 38) + '" />' +
                '</div>' +
                '<div class="goal-field">' +
                  '<label>Border radius</label>' +
                  '<input type="number" min="0" step="1" data-field="style.borderRadius" value="' + Number(style.borderRadius || 20) + '" />' +
                '</div>' +
                '<div class="goal-field">' +
                  '<label>Font family</label>' +
                  '<input type="text" data-field="style.fontFamily" value="' + escHtml(style.fontFamily || '') + '" placeholder="Inter, system-ui" />' +
                '</div>' +
                '<div class="goal-field">' +
                  '<label>Font weight</label>' +
                  '<input type="number" min="100" max="900" step="100" data-field="style.fontWeight" value="' + Number(style.fontWeight || 700) + '" />' +
                '</div>' +
                '<div class="goal-field">' +
                  '<label>Overlay padding</label>' +
                  '<input type="number" min="0" step="2" data-field="style.overlayPadding" value="' + Number(style.overlayPadding || 24) + '" />' +
                '</div>' +
                '<div class="goal-field">' +
                  '<label>Fill color</label>' +
                  '<input type="color" data-field="style.fillColor" value="' + escHtml(style.fillColor || '#9146FF') + '" />' +
                '</div>' +
                '<div class="goal-field">' +
                  '<label>Fill gradient</label>' +
                  '<input type="color" data-field="style.fillSecondaryColor" value="' + escHtml(style.fillSecondaryColor || style.fillColor || '#772CE8') + '" />' +
                '</div>' +
                '<div class="goal-field">' +
                  '<label>Empty color</label>' +
                  '<input type="color" data-field="style.emptyColor" value="' + escHtml(style.emptyColor || '#222229') + '" />' +
                '</div>' +
                '<div class="goal-field">' +
                  '<label>Background</label>' +
                  '<input type="color" data-field="style.backgroundColor" value="' + escHtml(style.backgroundColor || '#00000000') + '" />' +
                '</div>' +
                '<div class="goal-field">' +
                  '<label>Label color</label>' +
                  '<input type="color" data-field="style.labelColor" value="' + escHtml(style.labelColor || '#FFFFFF') + '" />' +
                '</div>' +
                '<div class="goal-field">' +
                  '<label>Value color</label>' +
                  '<input type="color" data-field="style.valueColor" value="' + escHtml(style.valueColor || '#FFFFFF') + '" />' +
                '</div>' +
                '<div class="goal-field">' +
                  '<label>Percent color</label>' +
                  '<input type="color" data-field="style.percentColor" value="' + escHtml(style.percentColor || '#FFFFFF') + '" />' +
                '</div>' +
                '<div class="goal-field">' +
                  '<label>Tier 1 color</label>' +
                  '<input type="color" data-field="style.segmentColors.tier1000" value="' + escHtml(segmentColors.tier1000 || '#9146FF') + '" />' +
                '</div>' +
                '<div class="goal-field">' +
                  '<label>Tier 2 color</label>' +
                  '<input type="color" data-field="style.segmentColors.tier2000" value="' + escHtml(segmentColors.tier2000 || '#C08CFF') + '" />' +
                '</div>' +
                '<div class="goal-field">' +
                  '<label>Tier 3 color</label>' +
                  '<input type="color" data-field="style.segmentColors.tier3000" value="' + escHtml(segmentColors.tier3000 || '#FFB347') + '" />' +
                '</div>' +
                '<div class="goal-field">' +
                  '<label>Bits color</label>' +
                  '<input type="color" data-field="style.segmentColors.bits" value="' + escHtml(segmentColors.bits || '#10B981') + '" />' +
                '</div>' +
                '<div class="goal-field">' +
                  '<label>Manual color</label>' +
                  '<input type="color" data-field="style.segmentColors.manual" value="' + escHtml(segmentColors.manual || '#38BDF8') + '" />' +
                '</div>' +
                '<div class="goal-field" style="grid-column: 1 / -1;">' +
                  '<label>Custom CSS</label>' +
                  '<textarea rows="2" data-field="style.customCss" placeholder=".goal-card { }">' + escHtml(style.customCss || '') + '</textarea>' +
                '</div>' +
              '</div>' +
              '<div class="goal-grid">' +
                '<div class="goal-field"><label><input type="checkbox" data-field="style.showLabel" ' + boolAttr(style.showLabel !== false) + ' /> Show label</label></div>' +
                '<div class="goal-field"><label><input type="checkbox" data-field="style.showValue" ' + boolAttr(style.showValue !== false) + ' /> Show values</label></div>' +
                '<div class="goal-field"><label><input type="checkbox" data-field="style.showPercent" ' + boolAttr(style.showPercent !== false) + ' /> Show percent</label></div>' +
                '<div class="goal-field"><label><input type="checkbox" data-field="style.showRemaining" ' + boolAttr(style.showRemaining) + ' /> Show remaining</label></div>' +
                '<div class="goal-field"><label><input type="checkbox" data-field="style.showTimeframe" ' + boolAttr(style.showTimeframe) + ' /> Show timeframe</label></div>' +
                '<div class="goal-field"><label><input type="checkbox" data-field="style.showSegmentsOnBar" ' + boolAttr(style.showSegmentsOnBar !== false) + ' /> Color breakdown</label></div>' +
                '<div class="goal-field"><label><input type="checkbox" data-field="style.showSegmentLegend" ' + boolAttr(style.showSegmentLegend !== false) + ' /> Show legend</label></div>' +
                '<div class="goal-field"><label><input type="checkbox" data-field="style.animateFill" ' + boolAttr(style.animateFill !== false) + ' /> Animate fill</label></div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          rulesSection +
          manualSection +
          '<div class="goal-card-actions" style="justify-content: space-between;">' +
            '<div class="goal-card-actions">' +
              '<button class="secondary" data-action="reset">Reset progress</button>' +
            '</div>' +
            '<div class="goal-card-actions">' +
              '<button class="danger" data-action="delete">Delete</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      }

      function updateGoalUrls(targetCard) {
        if (!goalListEl) return;
        const cards = targetCard ? [targetCard] : Array.from(goalListEl.querySelectorAll('.goal-card'));
        cards.forEach(function(card) {
          const goalId = card.dataset.goalId;
          const goal = goalState.goals.find(function(g) { return g.id === goalId; });
          const slugInput = card.querySelector('[data-field="overlaySlug"]');
          const slug = (slugInput && slugInput.value.trim()) || (goal && goal.overlaySlug) || goalId;
          const code = card.querySelector('[data-embed="url"]');
          if (code && goal) code.textContent = goalEmbedUrl(goal, slug);
        });
      }

      function renderGoals(error) {
        if (!goalListEl) return;
        if (error) {
          goalListEl.textContent = '';
          var errDiv = document.createElement('div');
          errDiv.className = 'goal-empty';
          errDiv.textContent = 'Failed to load goals.';
          goalListEl.appendChild(errDiv);
          return;
        }
        if (!goalState.goals.length) {
          goalListEl.textContent = '';
          var emptyDiv = document.createElement('div');
          emptyDiv.className = 'goal-empty';
          emptyDiv.textContent = 'No goals yet. Click "New goal" to get started.';
          goalListEl.appendChild(emptyDiv);
          return;
        }
        goalListEl.innerHTML = goalState.goals.map(goalCardTemplate).join('');
        updateGoalUrls();
        refreshGoalPreviews();
      }

      async function fetchGoalsAdmin() {
        if (!goalListEl) return;
        goalListEl.textContent = '';
        var loadDiv = document.createElement('div');
        loadDiv.className = 'goal-empty';
        loadDiv.textContent = 'Loading goals\u2026';
        goalListEl.appendChild(loadDiv);
        try {
          const res = await fetch('/api/goals', { cache: 'no-store' });
          if (!res.ok) throw new Error('Failed');
          const data = await res.json();
          goalState.goals = Array.isArray(data.goals) ? data.goals : [];
          goalState.defaults = data.defaults || goalState.defaults;
          renderGoals();
        } catch (err) {
          renderGoals(true);
        }
      }

      async function createGoalAdmin(btn) {
        flashButton(btn);
        setBusy(btn, true);
        try {
          await fetch('/api/goals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'New Goal' }) });
          await fetchGoalsAdmin();
        } catch (err) {}
        setBusy(btn, false);
      }

      async function createSubGoalAdmin(btn) {
        flashButton(btn);
        setBusy(btn, true);
        const defaultEnd = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
        const body = {
          title: 'New Sub Goal',
          targetValue: 25,
          goalType: 'sub_goal',
          type: 'sub_goal',
          endAt: defaultEnd,
        };
        try {
          const res = await fetch('/api/goals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (!res.ok) {
            const msg = await res.text();
            alert('Unable to create sub goal. ' + msg);
          } else {
            await fetchGoalsAdmin();
          }
        } catch (err) {}
        setBusy(btn, false);
      }

      function collectGoalPayload(card) {
        const payload = {};
        if (!card) return payload;
        card.querySelectorAll('[data-field]').forEach(function(el) {
          const field = el.getAttribute('data-field');
          if (!field) return;
          let value = null;
          if (el.type === 'checkbox') {
            value = el.checked;
          } else if (el.type === 'number') {
            value = el.value === '' ? null : Number(el.value);
          } else if (el.type === 'datetime-local') {
            value = el.value ? new Date(el.value).toISOString() : null;
          } else {
            value = el.value;
          }
          assignPath(payload, field, value);
        });
        return payload;
      }

      async function saveGoalAdmin(goalId, card, btn) {
        flashButton(btn);
        setBusy(btn, true);
        const payload = collectGoalPayload(card);
        try {
          const followCheckbox = card.querySelector('[data-field="rules.autoTrackFollows"]');
          if (followCheckbox && followCheckbox.checked) {
            const modeSelect = card.querySelector('[data-field="rules.followMode"]');
            const mode = modeSelect ? modeSelect.value : 'new';
            await fetch('/api/goals/' + goalId + '/enable-follows', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ mode: mode })
            });
          }
          await fetch('/api/goals/' + goalId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          await fetchGoalsAdmin();
        } catch (err) {}
        setBusy(btn, false);
      }

      async function deleteGoalAdmin(goalId, btn) {
        if (!confirm('Delete this goal? This cannot be undone.')) return;
        flashButton(btn);
        setBusy(btn, true);
        try {
          await fetch('/api/goals/' + goalId, { method: 'DELETE' });
          await fetchGoalsAdmin();
        } catch (err) {}
        setBusy(btn, false);
      }

      async function resetGoalAdmin(goalId, btn) {
        if (!confirm('Reset this goal\\'s progress?')) return;
        flashButton(btn);
        setBusy(btn, true);
        try {
          await fetch('/api/goals/' + goalId + '/reset', { method: 'POST' });
          await fetchGoalsAdmin();
        } catch (err) {}
        setBusy(btn, false);
      }

      async function manualGoalApply(goalId, card, btn) {
        const typeEl = card.querySelector('[data-manual-field="type"]');
        const amountEl = card.querySelector('[data-manual-field="amount"]');
        const noteEl = card.querySelector('[data-manual-field="note"]');
        if (!typeEl || !amountEl) return;
        const amount = Number(amountEl.value || 0);
        if (!Number.isFinite(amount) || amount <= 0) return;
        flashButton(btn);
        setBusy(btn, true);
        try {
          await fetch('/api/goals/' + goalId + '/manual', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: typeEl.value, units: amount, note: noteEl ? noteEl.value : '' })
          });
          amountEl.value = '';
          if (noteEl) noteEl.value = '';
          await fetchGoalsAdmin();
        } catch (err) {}
        setBusy(btn, false);
      }

      async function copyGoalUrl(goalId, card, btn) {
        const goal = goalState.goals.find(function(g) { return g.id === goalId; });
        if (!goal) return;
        const slugInput = card.querySelector('[data-field="overlaySlug"]');
        const slug = slugInput && slugInput.value.trim();
        const url = goalEmbedUrl(goal, slug || goal.overlaySlug || goalId);
        const prev = btn.textContent;
        flashButton(btn);
        try {
          await navigator.clipboard.writeText(url);
          btn.textContent = 'Copied!';
        } catch (err) {
          btn.textContent = 'Copy failed';
        }
        setTimeout(function() { btn.textContent = prev; }, 1200);
      }

      async function handleGoalCardClick(e) {
        const sectionToggle = e.target.closest('[data-goal-section-toggle]');
        if (sectionToggle) {
          const section = sectionToggle.closest('[data-goal-section]');
          if (section) {
            const id = section.getAttribute('data-goal-section');
            const next = !section.classList.contains('collapsed');
            section.classList.toggle('collapsed', next);
            setGoalSectionState(id, next);
          }
          return;
        }
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const card = btn.closest('.goal-card');
        if (!card) return;
        const goalId = card.dataset.goalId;
        if (!goalId) return;
        const action = btn.getAttribute('data-action');
        if (action === 'save') {
          await saveGoalAdmin(goalId, card, btn);
        } else if (action === 'delete') {
          await deleteGoalAdmin(goalId, btn);
        } else if (action === 'reset') {
          await resetGoalAdmin(goalId, btn);
        } else if (action === 'manual') {
          await manualGoalApply(goalId, card, btn);
        } else if (action === 'copy') {
          await copyGoalUrl(goalId, card, btn);
        } else if (action === 'refresh-preview') {
          renderGoalPreview(card);
        }
      }

      function handleGoalFieldInput(e) {
        const target = e.target;
        if (!target) return;
        const card = target.closest('.goal-card');
        if (!card) return;
        if (target.hasAttribute('data-field')) {
          refreshGoalPreviews(card);
          if (target.matches('[data-field="overlaySlug"]')) updateGoalUrls(card);
          if (target.matches('[data-field="rules.autoTrackFollows"]')) {
            const opts = card.querySelector('.goal-follow-options');
            if (opts) opts.style.display = target.checked ? 'grid' : 'none';
          }
        }
      }

      // Bind events and load
      if (goalCreateBtn) {
        goalCreateBtn.addEventListener('click', async function(e){
          e.preventDefault();
          await createGoalAdmin(goalCreateBtn);
        });
      }
      if (goalCreateSubBtn) {
        goalCreateSubBtn.addEventListener('click', async function(e){
          e.preventDefault();
          await createSubGoalAdmin(goalCreateSubBtn);
        });
      }
      if (goalRefreshBtn) {
        goalRefreshBtn.addEventListener('click', function(e){
          e.preventDefault();
          flashButton(goalRefreshBtn);
          fetchGoalsAdmin();
        });
      }
      if (goalListEl) {
        goalListEl.addEventListener('click', handleGoalCardClick);
        goalListEl.addEventListener('input', handleGoalFieldInput);
        goalListEl.addEventListener('change', handleGoalFieldInput);
      }

      // Logout handler
      var logoutBtn = document.getElementById('logout');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
          e.preventDefault();
          window.location.href = '/auth/logout?next=' + encodeURIComponent('/goals/config');
        });
      }

      // Initial load
      fetchGoalsAdmin();
    </script>
    <script src="https://cdn.jsdelivr.net/npm/driver.js@1.3.1/dist/driver.js.iife.js"></script>
    <script>
      (function() {
        var helpText = {
          toolbar: {
            title: 'Goal Tracking Bars',
            description: 'Create persistent goal bars for subs, bits, or mixed fundraisers. Click "New goal" for a standalone bar, or "New sub goal" to create one that feeds into a parent goal. Each goal gets its own Browser Source URL for OBS.'
          },
          basics: {
            title: 'Basics',
            description: 'Set the goal\\'s title, target value, unit label (e.g. "subs"), time range, and overlay slug. The overlay slug is used in the Browser Source URL — copy it and add it to OBS to show the bar on stream.'
          },
          appearance: {
            title: 'Appearance',
            description: 'Customize the bar\\'s layout (horizontal or vertical), dimensions, colors for the fill/empty track, labels, and per-tier segment colors. Toggle what\\'s shown on the overlay and add custom CSS for advanced styling.'
          },
          rules: {
            title: 'Rules & Contributions',
            description: 'Toggle which Twitch events auto-count toward the goal — subs (per tier), resubs, gift subs, bits, tips, charity, and follows. Set conversion weights like "100 bits = 1 unit" or "Tier 2 = 2 units".'
          },
          manual: {
            title: 'Manual Adjustments',
            description: 'Add or subtract progress by hand. Pick a contribution type, enter an amount, and optionally add a note. Useful for off-platform donations, corrections, or testing.'
          }
        };

        document.addEventListener('click', function(e) {
          var btn = e.target.closest('[data-help]');
          if (!btn) return;
          e.preventDefault();
          e.stopPropagation();
          var key = btn.getAttribute('data-help');
          var info = helpText[key];
          if (!info) return;

          var section = btn.closest('.goal-card-section');
          var driverObj = window.driver.js.driver({ allowClose: true });
          if (section) {
            driverObj.highlight({
              element: section,
              popover: { title: info.title, description: info.description, side: 'left', align: 'start' }
            });
          } else {
            var toolbar = btn.closest('.goal-toolbar');
            if (toolbar) {
              driverObj.highlight({
                element: toolbar,
                popover: { title: info.title, description: info.description, side: 'bottom', align: 'start' }
              });
            } else {
              driverObj.highlight({
                popover: { title: info.title, description: info.description }
              });
            }
          }
        });
      })();
    </script>
  </body>
</html>`;
}
