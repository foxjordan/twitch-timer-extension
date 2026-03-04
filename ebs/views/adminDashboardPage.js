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
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
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
      .btn-save { background: #9146ff; color: #fff; border: none; padding: 8px 18px; border-radius: 8px; font-size: 13px; cursor: pointer; font-weight: 600; }
      .btn-save:hover { background: #7c3aed; }
      .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
      .tts-config-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
      @media (max-width: 700px) { .tts-config-grid { grid-template-columns: 1fr; } }
      .tts-config-grid label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
      .tts-config-grid select { width: 100%; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--surface-border); background: var(--surface-muted); color: var(--text-color); font-size: 13px; }
      .voice-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 6px; max-height: 300px; overflow-y: auto; padding: 8px; background: var(--surface-muted); border-radius: 8px; }
      .voice-item { display: flex; align-items: center; gap: 6px; font-size: 13px; padding: 4px 0; }
      .voice-item input { margin: 0; }
      .voice-meta { font-size: 11px; color: var(--text-muted); }
      .btn-preview { background: none; border: 1px solid var(--surface-border); border-radius: 4px; padding: 1px 5px; font-size: 11px; cursor: pointer; color: var(--text-muted); line-height: 1; }
      .btn-preview:hover { color: var(--text-color); border-color: var(--text-color); }
      .btn-preview.playing { color: #9146ff; border-color: #9146ff; }
      .tts-status { font-size: 12px; margin-top: 8px; padding: 6px 10px; border-radius: 6px; }
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

      <div class="table-card" style="margin-bottom: 18px;">
        <h2>TTS Configuration</h2>
        <div class="tts-config-grid">
          <div>
            <label for="ttsMinTier">Minimum Bits Tier</label>
            <select id="ttsMinTier"></select>
          </div>
          <div style="display: flex; align-items: flex-end;">
            <button class="btn-save" id="ttsSaveBtn">Save TTS Config</button>
            <span id="ttsSaveStatus" class="tts-status" style="display:none; margin-left: 10px;"></span>
          </div>
        </div>
        <div style="margin-top: 16px;">
          <label style="display:block; font-size:13px; font-weight:600; margin-bottom:6px;">Available Voices for Streamers</label>
          <div style="margin-bottom:6px; font-size:12px; color:var(--text-muted); display:flex; align-items:center; gap:10px;">
            <span>Unchecked voices will not appear in streamer or viewer UIs. If none are checked, all voices are available.</span>
            <button type="button" id="ttsToggleAll" class="btn-save" style="padding:4px 10px; font-size:11px; white-space:nowrap;">Uncheck All</button>
          </div>
          <div id="ttsVoiceGrid" class="voice-grid"></div>
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
            addPill('TTS', u.ttsEnabled);
            addPill(u.isPro ? 'Pro' : (u.subscriptionStatus || 'Free'), u.isPro);
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
            // TTS toggle
            var ttsBtn = document.createElement('button');
            ttsBtn.className = u.ttsEnabled ? 'btn-ban' : 'btn-unban';
            ttsBtn.textContent = u.ttsEnabled ? 'Disable TTS' : 'Enable TTS';
            ttsBtn.style.marginLeft = '4px';
            ttsBtn.addEventListener('click', function() { toggleTts(u.userId, !u.ttsEnabled); });
            tdActions.appendChild(ttsBtn);
            if (u.stripeCustomerId) {
              var stripeLink = document.createElement('a');
              stripeLink.href = 'https://dashboard.stripe.com/customers/' + u.stripeCustomerId;
              stripeLink.target = '_blank';
              stripeLink.textContent = 'Stripe';
              stripeLink.style.cssText = 'font-size:11px; color:#9146ff; margin-left:6px;';
              tdActions.appendChild(stripeLink);
            }
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

        function toggleTts(userId, enabled) {
          var action = enabled ? 'Enable' : 'Disable';
          if (!confirm(action + ' TTS alerts for user ' + userId + '?')) return;
          fetch('/api/admin/toggle-tts', {
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

        // ===== TTS Global Config =====
        var ttsMinTierSelect = document.getElementById('ttsMinTier');
        var ttsVoiceGrid = document.getElementById('ttsVoiceGrid');
        var ttsSaveBtn = document.getElementById('ttsSaveBtn');
        var ttsSaveStatus = document.getElementById('ttsSaveStatus');
        var ttsAllVoices = [];
        var ttsCurrentConfig = { minTier: 'sound_300', availableVoices: [] };
        var previewAudio = null;

        function fetchTtsConfig() {
          fetch('/api/admin/tts-config', { credentials: 'same-origin' })
            .then(function(r) { return r.json(); })
            .then(function(data) {
              if (data.error) return;
              ttsCurrentConfig = data.config || ttsCurrentConfig;
              ttsAllVoices = data.allVoices || [];
              var tiers = data.tiers || [];
              renderTtsTierSelect(tiers);
              renderTtsVoiceCheckboxes();
            })
            .catch(function() {});
        }

        function renderTtsTierSelect(tiers) {
          ttsMinTierSelect.textContent = '';
          tiers.forEach(function(t) {
            var opt = document.createElement('option');
            opt.value = t.sku;
            opt.textContent = t.label;
            if (t.sku === ttsCurrentConfig.minTier) opt.selected = true;
            ttsMinTierSelect.appendChild(opt);
          });
        }

        function renderTtsVoiceCheckboxes() {
          ttsVoiceGrid.textContent = '';
          var available = ttsCurrentConfig.availableVoices || [];
          var allChecked = available.length === 0;
          ttsAllVoices.forEach(function(v) {
            var label = document.createElement('label');
            label.className = 'voice-item';
            var cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = v.id;
            cb.checked = allChecked || available.includes(v.id);
            cb.dataset.voiceId = v.id;
            cb.addEventListener('change', updateToggleLabel);
            var nameSpan = document.createElement('span');
            nameSpan.textContent = v.name;
            var metaSpan = document.createElement('span');
            metaSpan.className = 'voice-meta';
            metaSpan.textContent = (v.gender && v.gender !== 'unknown') ? ' (' + v.gender + ')' : '';
            var playBtn = document.createElement('button');
            playBtn.type = 'button';
            playBtn.className = 'btn-preview';
            playBtn.textContent = '\u25B6';
            playBtn.title = 'Preview ' + v.name;
            playBtn.addEventListener('click', function(e) {
              e.preventDefault();
              e.stopPropagation();
              playVoicePreview(v.id, playBtn);
            });
            label.appendChild(cb);
            label.appendChild(nameSpan);
            label.appendChild(metaSpan);
            label.appendChild(playBtn);
            ttsVoiceGrid.appendChild(label);
          });
          updateToggleLabel();
        }

        function playVoicePreview(voiceId, btn) {
          if (previewAudio) {
            previewAudio.pause();
            previewAudio = null;
            var allBtns = ttsVoiceGrid.querySelectorAll('.btn-preview');
            allBtns.forEach(function(b) { b.classList.remove('playing'); b.textContent = '\u25B6'; });
          }
          btn.classList.add('playing');
          btn.textContent = '\u23F9';
          previewAudio = new Audio('/api/tts/preview/' + encodeURIComponent(voiceId));
          previewAudio.play().catch(function() {});
          previewAudio.addEventListener('ended', function() {
            btn.classList.remove('playing');
            btn.textContent = '\u25B6';
            previewAudio = null;
          });
          previewAudio.addEventListener('error', function() {
            btn.classList.remove('playing');
            btn.textContent = '\u25B6';
            previewAudio = null;
          });
        }

        var ttsToggleAllBtn = document.getElementById('ttsToggleAll');
        function updateToggleLabel() {
          var cbs = ttsVoiceGrid.querySelectorAll('input[type=checkbox]');
          var allChecked = true;
          cbs.forEach(function(cb) { if (!cb.checked) allChecked = false; });
          ttsToggleAllBtn.textContent = allChecked ? 'Uncheck All' : 'Check All';
        }
        ttsToggleAllBtn.addEventListener('click', function() {
          var cbs = ttsVoiceGrid.querySelectorAll('input[type=checkbox]');
          var allChecked = true;
          cbs.forEach(function(cb) { if (!cb.checked) allChecked = false; });
          cbs.forEach(function(cb) { cb.checked = !allChecked; });
          updateToggleLabel();
        });

        ttsSaveBtn.addEventListener('click', function() {
          ttsSaveBtn.disabled = true;
          var selectedVoices = [];
          var checkboxes = ttsVoiceGrid.querySelectorAll('input[type=checkbox]');
          var allChecked = true;
          checkboxes.forEach(function(cb) {
            if (cb.checked) selectedVoices.push(cb.value);
            else allChecked = false;
          });
          // If all are checked, send empty array (= all available)
          var voicesToSend = allChecked ? [] : selectedVoices;

          fetch('/api/admin/tts-config', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              minTier: ttsMinTierSelect.value,
              availableVoices: voicesToSend
            })
          })
          .then(function(r) { return r.json(); })
          .then(function(data) {
            ttsSaveBtn.disabled = false;
            if (data.error) {
              ttsSaveStatus.textContent = 'Error: ' + data.error;
              ttsSaveStatus.style.display = 'inline-block';
              ttsSaveStatus.style.background = '#ef444433';
              ttsSaveStatus.style.color = '#ef4444';
            } else {
              ttsCurrentConfig = data.config || ttsCurrentConfig;
              ttsSaveStatus.textContent = 'Saved!';
              ttsSaveStatus.style.display = 'inline-block';
              ttsSaveStatus.style.background = '#10b98133';
              ttsSaveStatus.style.color = '#10b981';
              setTimeout(function() { ttsSaveStatus.style.display = 'none'; }, 3000);
            }
          })
          .catch(function() {
            ttsSaveBtn.disabled = false;
            ttsSaveStatus.textContent = 'Save failed';
            ttsSaveStatus.style.display = 'inline-block';
            ttsSaveStatus.style.background = '#ef444433';
            ttsSaveStatus.style.color = '#ef4444';
          });
        });

        fetchTtsConfig();
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
