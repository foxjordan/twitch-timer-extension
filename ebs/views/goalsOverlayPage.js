export function renderGoalsOverlayPage(options = {}) {
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
    <meta http-equiv="Pragma" content="no-cache" />
    <meta http-equiv="Expires" content="0" />
    <title>Goal Overlay</title>
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body { margin: 0; background: transparent; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #fff; }
      .goal-root {
        min-height: 100vh;
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 24px;
        padding: 24px;
      }
      .goal-root.board {
        flex-direction: row;
        flex-wrap: wrap;
        align-items: flex-start;
        justify-content: center;
      }
      .goal-card {
        --goal-width: 820px;
        --goal-height: 240px;
        --track-thickness: 38px;
        --fill-color: #9146FF;
        --fill-secondary: var(--fill-color);
        --empty-color: rgba(255,255,255,0.12);
        --label-color: #FFFFFF;
        --value-color: #FFFFFF;
        --percent-color: #FFFFFFCC;
        --border-radius: 20px;
        --text-shadow: none;
        --segment-gap: 2px;
        --subgoal-height: 10px;
        width: min(100%, var(--goal-width));
        min-height: var(--goal-height);
        background: rgba(0,0,0,0.35);
        border-radius: max(16px, var(--border-radius));
        border: 1px solid rgba(255,255,255,0.08);
        padding: 24px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.35);
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .goal-card[data-orientation="vertical"] {
        width: min(100%, var(--goal-width));
      }
      .goal-title {
        font-size: 24px;
        font-weight: 700;
        color: var(--label-color);
        text-shadow: var(--text-shadow);
      }
      .goal-description {
        font-size: 15px;
        opacity: 0.85;
        margin-top: -6px;
        color: var(--label-color);
      }
      .goal-values {
        display: flex;
        flex-wrap: wrap;
        gap: 10px 24px;
        color: var(--value-color);
        font-weight: 600;
        font-size: 18px;
        text-shadow: var(--text-shadow);
      }
      .goal-values .muted { opacity: 0.8; font-size: 15px; font-weight: 500; }
      .goal-track {
        width: 100%;
        height: var(--track-thickness);
        background: var(--empty-color);
        border-radius: var(--border-radius);
        position: relative;
        overflow: hidden;
      }
      .goal-card[data-orientation="vertical"] .goal-track {
        width: var(--track-thickness);
        height: min(420px, calc(var(--goal-height) - 120px));
        margin: 0 auto;
      }
      .goal-fill {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 0%;
        background: var(--fill-color);
        border-radius: var(--border-radius);
        display: flex;
        overflow: hidden;
        gap: var(--segment-gap);
      }
      .goal-card[data-orientation="vertical"] .goal-fill {
        width: 100%;
        height: 0%;
        bottom: 0;
        top: auto;
        flex-direction: column;
      }
      .goal-fill.animate {
        transition: width 0.8s ease, height 0.8s ease;
      }
      .goal-card[data-orientation="vertical"] .goal-fill.animate {
        transition: height 0.8s ease;
      }
      .goal-segment {
        flex: 1;
        min-width: 6px;
        min-height: 6px;
      }
      .goal-percent {
        font-size: 32px;
        font-weight: 700;
        color: var(--percent-color);
        text-shadow: var(--text-shadow);
      }
      .goal-footer {
        display: flex;
        flex-wrap: wrap;
        gap: 12px 24px;
        font-size: 14px;
        color: var(--label-color);
        opacity: 0.85;
      }
      .goal-status {
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 13px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.12);
      }
      .goal-status.future { color: #22d3ee; border-color: #22d3ee55; }
      .goal-status.expired { color: #f87171; border-color: #f8717155; }
      .goal-status.active { color: #34d399; border-color: #34d39955; }
      .segment-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 20px;
        font-size: 13px;
        color: var(--label-color);
      }
      .segment-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        background: rgba(0,0,0,0.25);
        border: 1px solid rgba(255,255,255,0.08);
      }
      .segment-dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        display: inline-flex;
      }
      .empty {
        font-size: 18px;
        opacity: 0.85;
        padding: 24px;
        border-radius: 16px;
        border: 1px dashed rgba(255,255,255,0.15);
      }
    </style>
  </head>
  <body>
    <div id="goal-root" class="goal-root">
      <div class="empty">Loading goal data…</div>
    </div>
    <style id="goal-custom-style"></style>
    <script>
      (function(){
        const params = new URLSearchParams(window.location.search);
        const desiredGoal = params.get('goal') || params.get('id') || '';
        const viewMode = (params.get('view') || '').toLowerCase();
        const boardMode = desiredGoal === 'all' || params.get('multi') === '1' || viewMode === 'board';
        const key = params.get('key') || '';
        const includeInactive = params.get('includeinactive') === '1' || boardMode;
        const state = {
          goals: [],
          desiredGoal,
          boardMode,
          key,
          includeInactive,
          lastRenderId: null
        };
        const root = document.getElementById('goal-root');
        const customCssEl = document.getElementById('goal-custom-style');
        const segmentLabels = {
          tier1000: 'Tier 1',
          tier2000: 'Tier 2',
          tier3000: 'Tier 3',
          resub: 'Resub',
          gift: 'Gift Subs',
          bits: 'Bits',
          tips: 'Tips',
          charity: 'Charity',
          manual: 'Manual',
          other: 'Other'
        };

        function fmtNumber(val) {
          const n = Number(val) || 0;
          if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
          return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
        }

        function formatValue(val, unit, opts) {
          const n = Number(val) || 0;
          const options = opts || {};
          const digits = options.compact ? 1 : 2;
          const formatted = Math.abs(n - Math.trunc(n)) > 0.001 ? n.toFixed(digits) : Math.round(n).toLocaleString();
          return unit ? formatted + ' ' + unit : formatted;
        }

        function pickGoal() {
          if (!state.goals.length) return null;
          if (state.desiredGoal && state.desiredGoal !== 'all') {
            const lower = state.desiredGoal.toLowerCase();
            const exact = state.goals.find((g) => g.id === state.desiredGoal || (g.overlaySlug && g.overlaySlug === state.desiredGoal));
            if (exact) return exact;
            const byTitle = state.goals.find((g) => (g.title || '').toLowerCase() === lower);
            if (byTitle) return byTitle;
          }
          const active = state.goals.find((g) => g.meta && g.meta.isActive);
          return active || state.goals[0];
        }

        function setRootLayout(style) {
          if (!style) return;
          const align = (style.align || 'center').toLowerCase();
          const map = { left: 'flex-start', center: 'center', right: 'flex-end' };
          root.style.justifyContent = state.boardMode ? 'center' : (map[align] || 'center');
          root.style.alignItems = state.boardMode ? 'flex-start' : 'center';
          root.style.padding = (style.overlayPadding || 24) + 'px';
          document.body.style.background = style.backgroundColor || 'transparent';
          document.body.style.fontFamily = style.fontFamily || document.body.style.fontFamily;
          if (customCssEl) customCssEl.textContent = style.customCss || '';
        }

        function buildGoalCard(goal) {
          const style = goal.style || {};
          const card = document.createElement('div');
          const orientation = style.orientation === 'vertical' ? 'vertical' : 'horizontal';
          card.className = 'goal-card';
          card.dataset.orientation = orientation;
          const rawWidth = Number(style.width || 820);
          const rawHeight = Number(style.height || 240);
          const orient = orientation === 'vertical' ? 'vertical' : 'horizontal';
          const goalWidth = orient === 'vertical' ? rawHeight : rawWidth;
          const goalHeight = orient === 'vertical' ? rawWidth : rawHeight;
          card.style.setProperty('--goal-width', goalWidth + 'px');
          card.style.setProperty('--goal-height', goalHeight + 'px');
          card.style.setProperty('--track-thickness', Math.max(12, style.trackThickness || 38) + 'px');
          card.style.setProperty('--fill-color', style.fillColor || '#9146FF');
          card.style.setProperty('--fill-secondary', style.fillSecondaryColor || style.fillColor || '#9146FF');
          card.style.setProperty('--empty-color', style.emptyColor || 'rgba(255,255,255,0.12)');
          card.style.setProperty('--label-color', style.labelColor || '#FFFFFF');
          card.style.setProperty('--value-color', style.valueColor || '#FFFFFF');
          card.style.setProperty('--percent-color', style.percentColor || '#FFFFFFCC');
          card.style.setProperty('--border-radius', Math.max(4, style.borderRadius || 20) + 'px');
          card.style.setProperty('--text-shadow', style.textShadow || 'none');

          if (!state.boardMode) setRootLayout(style);

          let headerEl = null;
          if (style.showLabel !== false) {
            headerEl = document.createElement('div');
            headerEl.className = 'goal-header';
            const title = document.createElement('div');
            title.className = 'goal-title';
            title.textContent = goal.title || 'Untitled Goal';
            headerEl.appendChild(title);
            if (goal.description) {
              const desc = document.createElement('div');
              desc.className = 'goal-description';
              desc.textContent = goal.description;
              headerEl.appendChild(desc);
            }
            if (style.labelPosition !== 'bottom') {
              card.appendChild(headerEl);
            }
          }

          if (style.showValue !== false || style.showRemaining || style.showPercent) {
            const values = document.createElement('div');
            values.className = 'goal-values';
            if (style.showValue !== false) {
              const current = document.createElement('div');
              current.textContent = formatValue(goal.currentValue, goal.unitLabel);
              values.appendChild(current);
              const total = document.createElement('div');
              total.className = 'muted';
              total.textContent = '/ ' + formatValue(goal.targetValue, goal.unitLabel);
              values.appendChild(total);
            }
            if (style.showRemaining) {
              const rem = document.createElement('div');
              rem.className = 'muted';
              const remaining = Math.max(0, (goal.targetValue || 0) - (goal.currentValue || 0));
              rem.textContent = 'Remaining: ' + formatValue(remaining, goal.unitLabel);
              values.appendChild(rem);
            }
            if (style.showPercent !== false) {
              const pct = document.createElement('div');
              pct.className = 'goal-percent';
              const percent = goal.targetValue > 0 ? Math.min(100, Math.max(0, (goal.currentValue / goal.targetValue) * 100)) : 0;
              pct.textContent = percent.toFixed(1).replace(/\\.0$/, '') + '%';
              values.appendChild(pct);
            }
            card.appendChild(values);
          }

          const track = document.createElement('div');
          track.className = 'goal-track';
          const fill = document.createElement('div');
          fill.className = 'goal-fill';
          if (style.animateFill !== false) fill.classList.add('animate');
          const percentComplete = goal.targetValue > 0 ? Math.min(100, Math.max(0, (goal.currentValue / goal.targetValue) * 100)) : 0;
          const gradient =
            style.fillSecondaryColor && style.fillSecondaryColor !== style.fillColor
              ? 'linear-gradient(90deg, ' + (style.fillColor || '#9146FF') + ', ' + style.fillSecondaryColor + ')'
              : style.fillColor || '#9146FF';
          if (orientation === 'vertical') {
            fill.style.background = gradient;
            fill.style.height = percentComplete + '%';
            fill.style.width = '100%';
            fill.style.bottom = '0';
          } else {
            fill.style.background = gradient;
            fill.style.width = percentComplete + '%';
            fill.style.height = '100%';
          }

          const segmentsEnabled = style.showSegmentsOnBar !== false && goal.breakdownEnabled !== false;
          if (segmentsEnabled) {
            const segKeys = ${JSON.stringify([
              "tier1000",
              "tier2000",
              "tier3000",
              "resub",
              "gift",
              "bits",
              "tips",
              "charity",
              "manual",
              "other",
            ])};
            const totalSeg = segKeys.reduce((acc, key) => acc + (Number(goal.segments?.[key]) || 0), 0);
            const divisor = totalSeg > 0 ? totalSeg : goal.currentValue || 1;
            for (const key of segKeys) {
              const val = Number(goal.segments?.[key]) || 0;
              if (val <= 0) continue;
              const seg = document.createElement('div');
              seg.className = 'goal-segment';
              seg.style.background = (style.segmentColors && style.segmentColors[key]) || '#ffffff';
              if (orientation === 'vertical') {
                seg.style.height = (val / divisor) * 100 + '%';
                seg.style.width = '100%';
              } else {
                seg.style.width = (val / divisor) * 100 + '%';
              }
              fill.appendChild(seg);
            }
            if (!fill.childElementCount) {
              const fallbackSeg = document.createElement('div');
              fallbackSeg.className = 'goal-segment';
              fallbackSeg.style.flex = '1';
              fallbackSeg.style.background = gradient;
              fill.appendChild(fallbackSeg);
            }
          }
          track.appendChild(fill);
          card.appendChild(track);

          const footer = document.createElement('div');
          footer.className = 'goal-footer';
          const meta = goal.meta || {};
          if (meta.isFuture) {
            const badge = document.createElement('div');
            badge.className = 'goal-status future';
            badge.textContent = 'Starts soon';
            footer.appendChild(badge);
          } else if (meta.isExpired) {
            const badge = document.createElement('div');
            badge.className = 'goal-status expired';
            badge.textContent = 'Finished';
            footer.appendChild(badge);
          } else {
            const badge = document.createElement('div');
            badge.className = 'goal-status active';
            badge.textContent = 'In progress';
            footer.appendChild(badge);
          }
          if (style.showTimeframe && (goal.startAt || goal.endAt)) {
            const range = document.createElement('div');
            range.textContent = formatRange(goal.startAt, goal.endAt);
            footer.appendChild(range);
          }
          card.appendChild(footer);

          if (headerEl && style.labelPosition === 'bottom') {
            card.appendChild(headerEl);
          }

          if (style.showSegmentLegend !== false && goal.breakdownEnabled !== false) {
            const legend = document.createElement('div');
            legend.className = 'segment-legend';
            const segKeys = Object.keys(goal.segments || {});
            segKeys.forEach((key) => {
              const value = Number(goal.segments[key]) || 0;
              if (value <= 0) return;
              const pill = document.createElement('div');
              pill.className = 'segment-pill';
              const dot = document.createElement('span');
              dot.className = 'segment-dot';
              dot.style.background = (style.segmentColors && style.segmentColors[key]) || '#ffffff';
              const label = document.createElement('span');
              label.textContent = (segmentLabels[key] || key) + ': ' + formatValue(value, goal.unitLabel, { compact: true });
              pill.appendChild(dot);
              pill.appendChild(label);
              legend.appendChild(pill);
            });
            if (legend.childElementCount) card.appendChild(legend);
          }

          return card;
        }

        function formatRange(startAt, endAt) {
          const opts = { month: 'short', day: 'numeric' };
          const timeOpts = { hour: 'numeric', minute: 'numeric' };
          if (startAt && endAt) {
            const start = new Date(startAt);
            const end = new Date(endAt);
            return start.toLocaleDateString(undefined, opts) + ' → ' + end.toLocaleDateString(undefined, opts);
          }
          if (startAt) return 'Starts ' + new Date(startAt).toLocaleString(undefined, { ...opts, ...timeOpts });
          if (endAt) return 'Ends ' + new Date(endAt).toLocaleString(undefined, { ...opts, ...timeOpts });
          return '';
        }

        function render() {
          root.classList.toggle('board', state.boardMode);
          if (!state.goals.length) {
            root.innerHTML = '<div class="empty">No goal data available</div>';
            return;
          }
          if (state.boardMode) {
            root.innerHTML = '';
            setRootLayout(state.goals[0]?.style || {});
            state.goals.forEach((goal) => {
              const card = buildGoalCard(goal);
              root.appendChild(card);
            });
          } else {
            const goal = pickGoal();
            root.innerHTML = '';
            if (!goal) {
              root.innerHTML = '<div class="empty">Goal not found</div>';
              return;
            }
            root.appendChild(buildGoalCard(goal));
          }
        }

        function applySnapshot(goals) {
          if (!Array.isArray(goals)) return;
          state.goals = goals;
          render();
        }

        function fetchSnapshot() {
          let url = '/api/overlay/goals';
          const sp = new URLSearchParams();
          if (state.key) sp.set('key', state.key);
          if (state.includeInactive) sp.set('includeInactive', '1');
          if (sp.toString()) url += '?' + sp.toString();
          fetch(url, { cache: 'no-store' })
            .then((r) => r.json())
            .then((data) => applySnapshot(data.goals))
            .catch(() => {});
        }

        function connectStream() {
          let retryDelay = 4000;
          let streamUrl = '/api/overlay/stream';
          if (state.key) {
            streamUrl += '?key=' + encodeURIComponent(state.key);
          }
          const es = new EventSource(streamUrl);
          es.addEventListener('open', () => { retryDelay = 4000; });
          es.addEventListener('goal_snapshot', (ev) => {
            try {
              const payload = JSON.parse(ev.data || '{}');
              applySnapshot(payload.goals);
            } catch {}
          });
          es.onerror = () => {
            es.close();
            setTimeout(connectStream, retryDelay);
            retryDelay = Math.min(retryDelay * 2, 60000);
          };
        }

        fetchSnapshot();
        connectStream();
      })();
    </script>
  </body>
</html>`;

  return html;
}
