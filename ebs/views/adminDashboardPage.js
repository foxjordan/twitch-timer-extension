import {
  THEME_CSS_VARS,
  THEME_TOGGLE_STYLES,
  renderThemeBootstrapScript,
} from "./theme.js";
import { GLOBAL_HEADER_STYLES, renderGlobalHeader } from "./globalHeader.js";
import { renderFirebaseScript } from "./firebase.js";

export function renderAdminDashboardPage(options = {}) {
  const base = String(options.base || "");
  const adminName = String(options.adminName || "");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Admin Dashboard – Livestreamer Hub</title>
    <link rel="icon" type="image/png" href="/assets/convertico-coin_24x24.png">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/driver.js@1.3.1/dist/driver.css"/>
    ${renderThemeBootstrapScript()}
    ${renderFirebaseScript()}
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
      .badge-banned { background: #dc262633; color: #dc2626; }
      .btn-ban { background: #dc2626; color: #fff; border: none; padding: 4px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; font-weight: 600; }
      .btn-ban:hover { background: #b91c1c; }
      .btn-unban { background: #16a34a; color: #fff; border: none; padding: 4px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; font-weight: 600; }
      .btn-unban:hover { background: #15803d; }
      .ban-reason { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; opacity: 0.7; }
      .empty-state { text-align: center; padding: 40px 20px; color: var(--text-muted); }
      .feature-pills { display: flex; gap: 4px; flex-wrap: wrap; }
      .pill { display: inline-block; padding: 2px 7px; border-radius: 6px; font-size: 11px; background: var(--surface-muted); color: var(--text-muted); }
      .pill-active { background: #9146ff33; color: #bf94ff; }
      .server-health-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; font-size: 13px; }
      .health-item { padding: 8px 10px; background: var(--surface-muted); border-radius: 8px; }
      .health-label { color: var(--text-muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 2px; }
      .health-value { font-weight: 600; }
      .health-error { color: #ef4444; }
      .tour-btn { position: fixed; bottom: 20px; right: 20px; background: #9146ff; color: #fff; border: none; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; z-index: 10; opacity: 0.85; transition: opacity 0.15s; }
      .tour-btn:hover { opacity: 1; }
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
      showAdminLink: true,
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

      <div class="table-card" style="margin-bottom: 18px;">
        <h2>Server Health</h2>
        <div id="serverHealth" class="server-health-grid">
          <div class="empty-state">Loading...</div>
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

        function formatUptime(seconds) {
          if (!seconds) return '--';
          var d = Math.floor(seconds / 86400);
          var h = Math.floor((seconds % 86400) / 3600);
          var m = Math.floor((seconds % 3600) / 60);
          var parts = [];
          if (d > 0) parts.push(d + 'd');
          if (h > 0) parts.push(h + 'h');
          parts.push(m + 'm');
          return parts.join(' ');
        }

        function renderServerHealth(server) {
          var container = document.getElementById('serverHealth');
          if (!server) { container.textContent = '--'; return; }
          container.textContent = '';

          var items = [
            ['Uptime', formatUptime(server.uptimeSeconds)],
            ['Memory (RSS)', server.memoryMB + ' MB'],
            ['Heap Used', server.heapUsedMB + ' MB'],
            ['Last EventSub Event', (server.lastEventSubType || '--') + ' ' + timeAgo(server.lastEventSubEvent)],
            ['Last Keepalive', timeAgo(server.lastEventSubKeepalive)],
            ['EventSub Connected', timeAgo(server.lastEventSubConnected)],
            ['Reconnects', String(server.totalEventSubReconnects || 0)],
            ['Last Timer Mutation', timeAgo(server.lastTimerMutation)],
          ];

          if (server.lastEventSubError) {
            items.push(['Last Error', timeAgo(server.lastEventSubError) + ' — ' + (server.lastEventSubErrorMessage || '')]);
          }
          if (server.lastBroadcastError) {
            items.push(['Last Broadcast Error', timeAgo(server.lastBroadcastError)]);
          }

          items.forEach(function(pair) {
            var div = document.createElement('div');
            div.className = 'health-item';
            var label = document.createElement('div');
            label.className = 'health-label';
            label.textContent = pair[0];
            var value = document.createElement('div');
            value.className = 'health-value';
            if (pair[0].indexOf('Error') !== -1) value.className += ' health-error';
            value.textContent = pair[1];
            div.appendChild(label);
            div.appendChild(value);
            container.appendChild(div);
          });
        }

        function renderTable(data) {
          document.getElementById('statRegistered').textContent = data.totalRegistered || 0;
          document.getElementById('statConnected').textContent = data.totalConnected || 0;
          document.getElementById('statOverlays').textContent = data.activeSseClients || 0;
          document.getElementById('statTotalSse').textContent = data.totalSseServed || 0;

          renderServerHealth(data.server);

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
          ['Broadcaster', 'Status', 'Timer', 'Time Added', 'Features', 'Last Event', 'Actions'].forEach(function(label) {
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
            if (u.banned) addBadge('Banned', 'badge-banned');
            tr.appendChild(tdStatus);

            // Timer
            var tdTimer = document.createElement('td');
            var timerMain = document.createElement('div');
            timerMain.textContent = u.remaining != null ? formatSeconds(u.remaining) : '--';
            tdTimer.appendChild(timerMain);
            if (u.initialSeconds || u.maxTotalSeconds) {
              var timerDetail = document.createElement('div');
              timerDetail.className = 'mono';
              var parts = [];
              if (u.initialSeconds) parts.push('init: ' + formatSeconds(u.initialSeconds));
              if (u.maxTotalSeconds) parts.push('max: ' + formatSeconds(u.maxTotalSeconds));
              timerDetail.textContent = parts.join(' / ');
              tdTimer.appendChild(timerDetail);
            }
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
            addPill('Video/Clips', u.videoClipsEnabled);
            addPill('Goals: ' + (u.goalCount || 0), u.goalCount > 0);
            addPill('Style', u.hasCustomStyle);
            tdFeatures.appendChild(pillsDiv);
            tr.appendChild(tdFeatures);

            // Last Event
            var tdEvent = document.createElement('td');
            tdEvent.textContent = timeAgo(u.lastEventAt);
            tr.appendChild(tdEvent);

            // Actions
            var tdActions = document.createElement('td');
            if (u.banned) {
              var unbanBtn = document.createElement('button');
              unbanBtn.className = 'btn-unban';
              unbanBtn.textContent = 'Unban';
              unbanBtn.addEventListener('click', function() { doUnban(u.userId); });
              tdActions.appendChild(unbanBtn);
              if (u.banReason) {
                var reasonDiv = document.createElement('div');
                reasonDiv.className = 'ban-reason';
                reasonDiv.textContent = u.banReason;
                tdActions.appendChild(reasonDiv);
              }
            } else {
              var banBtn = document.createElement('button');
              banBtn.className = 'btn-ban';
              banBtn.textContent = 'Ban';
              banBtn.addEventListener('click', function() { doBan(u.userId, u.displayName || u.login); });
              tdActions.appendChild(banBtn);
            }
            // Video/Clips toggle
            var vcBtn = document.createElement('button');
            vcBtn.className = u.videoClipsEnabled ? 'btn-ban' : 'btn-unban';
            vcBtn.textContent = u.videoClipsEnabled ? 'Disable V/C' : 'Enable V/C';
            vcBtn.style.marginLeft = '4px';
            vcBtn.addEventListener('click', function() { toggleVideoClips(u.userId, !u.videoClipsEnabled); });
            tdActions.appendChild(vcBtn);
            tr.appendChild(tdActions);

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

        function doBan(userId, displayName) {
          var reason = prompt('Ban ' + (displayName || userId) + '? Enter an optional reason:');
          if (reason === null) return; // cancelled
          fetch('/api/admin/ban', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: userId, reason: reason })
          })
          .then(function(r) { return r.json(); })
          .then(function(data) {
            if (data.error) { alert('Error: ' + data.error); return; }
            refresh();
          })
          .catch(function() { alert('Ban request failed'); });
        }

        function doUnban(userId) {
          if (!confirm('Unban user ' + userId + '?')) return;
          fetch('/api/admin/unban', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: userId })
          })
          .then(function(r) { return r.json(); })
          .then(function(data) {
            if (data.error) { alert('Error: ' + data.error); return; }
            refresh();
          })
          .catch(function() { alert('Unban request failed'); });
        }

        function toggleVideoClips(userId, enabled) {
          var action = enabled ? 'Enable' : 'Disable';
          if (!confirm(action + ' video/clip alerts for user ' + userId + '?')) return;
          fetch('/api/admin/toggle-video-clips', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: userId, enabled: enabled })
          })
          .then(function(r) { return r.json(); })
          .then(function(data) {
            if (data.error) { alert('Error: ' + data.error); return; }
            refresh();
          })
          .catch(function() { alert('Toggle request failed'); });
        }

        refresh();
        setInterval(refresh, refreshInterval);
      })();
    </script>
    <button class="tour-btn" id="tourBtn" title="Show guided tour">Take A Tour</button>
    <script src="https://cdn.jsdelivr.net/npm/driver.js@1.3.1/dist/driver.js.iife.js"></script>
    <script>
      (function() {
        var TOUR_KEY = 'admin_tour_seen';
        var tourSteps = [
          {
            element: '.overview-grid',
            popover: {
              title: 'Overview Stats',
              description: 'Quick glance at your service: registered broadcasters, EventSub connections, active overlays, and total SSE connections served.',
              side: 'bottom', align: 'center'
            }
          },
          {
            element: '#serverHealth',
            popover: {
              title: 'Server Health',
              description: 'Live server metrics — uptime, memory usage, EventSub status, and any recent errors.',
              side: 'bottom', align: 'center'
            }
          },
          {
            element: '#tableContainer',
            popover: {
              title: 'Broadcasters Table',
              description: 'Every registered broadcaster, their connection status, timer state, enabled features, and moderation actions.',
              side: 'top', align: 'center'
            }
          }
        ];

        function startTour() {
          var driverObj = window.driver.js.driver({
            showProgress: true,
            progressText: '{{current}} of {{total}}',
            allowClose: true,
            steps: tourSteps,
            onDestroyed: function() {
              localStorage.setItem(TOUR_KEY, 'true');
            }
          });
          driverObj.drive();
        }

        document.getElementById('tourBtn').addEventListener('click', startTour);
      })();
    </script>
  </body>
</html>`;
}
