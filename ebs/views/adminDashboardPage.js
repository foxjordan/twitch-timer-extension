import {
  THEME_CSS_VARS,
  THEME_TOGGLE_STYLES,
  renderThemeBootstrapScript,
} from "./theme.js";
import { GLOBAL_HEADER_STYLES, renderGlobalHeader } from "./globalHeader.js";

export function renderAdminDashboardPage(options = {}) {
  const base = String(options.base || "");
  const adminName = String(options.adminName || "");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Admin Dashboard – Livestreamer Hub</title>
    ${renderThemeBootstrapScript()}
    <style>
      ${THEME_CSS_VARS}
      body { margin: 0; font-family: Inter, system-ui, Arial, sans-serif; background: var(--page-bg); color: var(--text-color); min-height: 100vh; display: flex; flex-direction: column; }
      main { flex: 1; width: min(1200px, 100%); margin: 32px auto 48px; padding: 0 20px; }
      h1 { margin: 0 0 8px; font-size: 28px; }
      .subtitle { margin: 0 0 24px; color: var(--text-muted); font-size: 14px; }
      .overview-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 28px; }
      .stat-card { background: var(--surface-color); border: 1px solid var(--surface-border); border-radius: 14px; padding: 18px; text-align: center; }
      .stat-value { font-size: 36px; font-weight: 700; line-height: 1.1; }
      .stat-label { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
      .table-card { background: var(--surface-color); border: 1px solid var(--surface-border); border-radius: 14px; padding: 20px; overflow-x: auto; }
      .table-card h2 { margin: 0 0 14px; font-size: 18px; display: flex; align-items: center; gap: 10px; }
      .refresh-info { font-size: 12px; color: var(--text-muted); font-weight: 400; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      thead th { text-align: left; padding: 8px 10px; border-bottom: 2px solid var(--surface-border); color: var(--text-muted); font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; }
      tbody td { padding: 10px; border-bottom: 1px solid var(--surface-border); vertical-align: middle; }
      tbody tr:last-child td { border-bottom: none; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
      .badge-online { background: #10b98133; color: #10b981; }
      .badge-offline { background: #94a3b833; color: #94a3b8; }
      .badge-paused { background: #f59e0b33; color: #f59e0b; }
      .badge-capped { background: #ef444433; color: #ef4444; }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; opacity: 0.7; }
      .empty-state { text-align: center; padding: 40px 20px; color: var(--text-muted); }
      .feature-pills { display: flex; gap: 4px; flex-wrap: wrap; }
      .pill { display: inline-block; padding: 2px 7px; border-radius: 6px; font-size: 11px; background: var(--surface-muted); color: var(--text-muted); }
      .pill-active { background: #9146ff33; color: #bf94ff; }
      ${THEME_TOGGLE_STYLES}
      ${GLOBAL_HEADER_STYLES}
    </style>
  </head>
  <body>
    ${renderGlobalHeader({
      base,
      adminName,
      active: "admin",
      includeThemeToggle: true,
      showLogout: true,
    })}
    <main>
      <h1>Admin Dashboard</h1>
      <p class="subtitle">Service usage overview. Auto-refreshes every 10 seconds.</p>

      <div class="overview-grid">
        <div class="stat-card">
          <div class="stat-value" id="statRegistered">--</div>
          <div class="stat-label">Registered Broadcasters</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" id="statConnected">--</div>
          <div class="stat-label">EventSub Connected</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" id="statOverlays">--</div>
          <div class="stat-label">Active Overlays (SSE)</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" id="statTotalSse">--</div>
          <div class="stat-label">Total SSE Served</div>
        </div>
      </div>

      <div class="table-card">
        <h2>Broadcasters <span class="refresh-info" id="lastRefresh"></span></h2>
        <div id="tableContainer">
          <div class="empty-state">Loading...</div>
        </div>
      </div>
    </main>
    <script>
      (function() {
        var refreshInterval = 10000;
        var tableContainer = document.getElementById('tableContainer');
        var lastRefreshEl = document.getElementById('lastRefresh');

        function formatSeconds(s) {
          if (s == null || s < 0) return '--';
          var h = Math.floor(s / 3600);
          var m = Math.floor((s % 3600) / 60);
          var sec = Math.floor(s % 60);
          return (h > 0 ? h + 'h ' : '') + (m > 0 ? m + 'm ' : '') + sec + 's';
        }

        function timeAgo(iso) {
          if (!iso) return '--';
          var diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
          if (diff < 60) return diff + 's ago';
          if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
          if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
          return Math.floor(diff / 86400) + 'd ago';
        }

        function escapeHtml(str) {
          var div = document.createElement('div');
          div.textContent = str || '';
          return div.innerHTML;
        }

        function renderTable(data) {
          document.getElementById('statRegistered').textContent = data.totalRegistered || 0;
          document.getElementById('statConnected').textContent = data.totalConnected || 0;
          document.getElementById('statOverlays').textContent = data.activeSseClients || 0;
          document.getElementById('statTotalSse').textContent = data.totalSseServed || 0;

          var users = data.users || [];
          if (users.length === 0) {
            tableContainer.textContent = 'No registered broadcasters yet.';
            return;
          }

          users.sort(function(a, b) {
            if (a.connected !== b.connected) return a.connected ? -1 : 1;
            return (a.login || '').localeCompare(b.login || '');
          });

          // Build table with DOM methods to avoid innerHTML with dynamic content
          var table = document.createElement('table');
          var thead = document.createElement('thead');
          var headerRow = document.createElement('tr');
          ['Broadcaster', 'Status', 'Timer', 'Time Added', 'Features', 'Last Event'].forEach(function(label) {
            var th = document.createElement('th');
            th.textContent = label;
            headerRow.appendChild(th);
          });
          thead.appendChild(headerRow);
          table.appendChild(thead);

          var tbody = document.createElement('tbody');
          users.forEach(function(u) {
            var tr = document.createElement('tr');

            // Broadcaster
            var tdBroadcaster = document.createElement('td');
            var nameDiv = document.createElement('div');
            nameDiv.style.fontWeight = '600';
            nameDiv.textContent = u.displayName || u.login || 'Unknown';
            var idDiv = document.createElement('div');
            idDiv.className = 'mono';
            idDiv.textContent = u.userId;
            tdBroadcaster.appendChild(nameDiv);
            tdBroadcaster.appendChild(idDiv);
            tr.appendChild(tdBroadcaster);

            // Status
            var tdStatus = document.createElement('td');
            function addBadge(text, cls) {
              var span = document.createElement('span');
              span.className = 'badge ' + cls;
              span.textContent = text;
              tdStatus.appendChild(span);
              tdStatus.appendChild(document.createTextNode(' '));
            }
            if (u.connected) addBadge('Online', 'badge-online');
            else addBadge('Offline', 'badge-offline');
            if (u.timerPaused) addBadge('Paused', 'badge-paused');
            if (u.capReached) addBadge('Capped', 'badge-capped');
            tr.appendChild(tdStatus);

            // Timer
            var tdTimer = document.createElement('td');
            tdTimer.textContent = u.remaining != null ? formatSeconds(u.remaining) : '--';
            tr.appendChild(tdTimer);

            // Time Added
            var tdAdded = document.createElement('td');
            tdAdded.textContent = formatSeconds(u.additionsTotal || 0);
            tr.appendChild(tdAdded);

            // Features
            var tdFeatures = document.createElement('td');
            var pillsDiv = document.createElement('div');
            pillsDiv.className = 'feature-pills';
            function addPill(text, active) {
              var span = document.createElement('span');
              span.className = 'pill' + (active ? ' pill-active' : '');
              span.textContent = text;
              pillsDiv.appendChild(span);
            }
            addPill('Sounds: ' + (u.soundCount || 0), u.soundsEnabled);
            addPill('Goals: ' + (u.goalCount || 0), u.goalCount > 0);
            addPill('Style', u.hasCustomStyle);
            tdFeatures.appendChild(pillsDiv);
            tr.appendChild(tdFeatures);

            // Last Event
            var tdEvent = document.createElement('td');
            tdEvent.textContent = timeAgo(u.lastEventAt);
            tr.appendChild(tdEvent);

            tbody.appendChild(tr);
          });
          table.appendChild(tbody);

          tableContainer.textContent = '';
          tableContainer.appendChild(table);
        }

        function refresh() {
          fetch('/api/admin/stats', { credentials: 'same-origin' })
            .then(function(r) {
              if (r.status === 401 || r.status === 403) {
                tableContainer.textContent = 'Access denied. Please log in as a super admin.';
                return null;
              }
              return r.json();
            })
            .then(function(data) {
              if (!data) return;
              renderTable(data);
              if (lastRefreshEl) lastRefreshEl.textContent = 'Updated ' + new Date().toLocaleTimeString();
            })
            .catch(function() {
              if (lastRefreshEl) lastRefreshEl.textContent = 'Refresh failed';
            });
        }

        refresh();
        setInterval(refresh, refreshInterval);
      })();
    </script>
  </body>
</html>`;
}
