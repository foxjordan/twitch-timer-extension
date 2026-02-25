import {
  THEME_CSS_VARS,
  THEME_TOGGLE_STYLES,
  renderThemeBootstrapScript,
} from "./theme.js";
import { GLOBAL_HEADER_STYLES, renderGlobalHeader } from "./globalHeader.js";
import { renderFirebaseScript } from "./firebase.js";

export function renderSoundConfigPage(options = {}) {
  const base = String(options.base || "");
  const adminName = String(options.adminName || "");
  const userKey = String(options.userKey || "");
  const showAdminLink = Boolean(options.showAdminLink);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sound Alerts – Livestreamer Hub</title>
    <link rel="icon" type="image/png" href="/assets/convertico-coin_24x24.png">
    ${renderThemeBootstrapScript()}
    ${renderFirebaseScript()}
    <style>
      ${THEME_CSS_VARS}
      body { margin: 0; font-family: Inter, system-ui, Arial, sans-serif; background: var(--page-bg); color: var(--text-color); min-height: 100vh; display: flex; flex-direction: column; }
      main { flex: 1; width: min(800px, 100%); margin: 32px auto 48px; padding: 0 20px; }
      h1 { margin: 0 0 4px; font-size: 26px; }
      .subtitle { margin: 0 0 24px; color: var(--text-muted); font-size: 14px; }
      .card { background: var(--surface-color); border: 1px solid var(--surface-border); border-radius: 14px; padding: 20px; margin-bottom: 18px; }
      .card h2 { margin: 0 0 12px; font-size: 17px; }
      .row2 { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
      input[type="text"], input[type="number"], select {
        box-sizing: border-box;
        padding: 6px 8px;
        border-radius: 6px;
        border: 1px solid var(--input-border);
        background: var(--input-bg);
        color: var(--text-color);
      }
      input[type="checkbox"] { transform: scale(1.1); }
      button { background: var(--accent-color); color: #ffffff; border: 0; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-size: 13px; }
      button.secondary { background: var(--secondary-button-bg); color: var(--secondary-button-text); border: 1px solid var(--secondary-button-border); }
      button { transition: transform .04s ease, box-shadow .15s ease, filter .15s ease, opacity .2s; }
      button:hover { box-shadow: 0 0 0 1px rgba(0,0,0,0.2) inset; filter: brightness(1.02); }
      button:active { transform: translateY(1px) scale(0.99); filter: brightness(0.98); }
      button:disabled { opacity: 0.5; cursor: not-allowed; }
      @keyframes btnpulse { 0% { transform: scale(0.99); } 100% { transform: scale(1); } }
      .btn-click { animation: btnpulse .18s ease; }
      button.danger { background: #b91c1c; }
      .hint { font-size: 12px; color: var(--text-muted); }
      .tab-btn { background: var(--secondary-button-bg); color: var(--secondary-button-text); border: 1px solid var(--secondary-button-border); }
      .tab-btn.active { background: var(--accent-color); color: #fff; border-color: var(--accent-color); }
      .type-badge { display:inline-block; padding:1px 6px; border-radius:4px; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; margin-left:6px; }
      .type-badge.clip { background:rgba(145,70,255,0.15); color:#bf94ff; }
      .type-badge.video { background:rgba(0,180,120,0.15); color:#00c882; }
      ${THEME_TOGGLE_STYLES}
      ${GLOBAL_HEADER_STYLES}
    </style>
  </head>
  <body>
    ${renderGlobalHeader({
      base,
      adminName,
      active: "sounds",
      includeThemeToggle: true,
      showFeedback: true,
      showLogout: true,
      showUtilitiesLink: true,
      showAdminLink,
    })}
    <main>
      <h1>Sound Alerts</h1>
      <p class="subtitle">Viewers spend Bits to trigger sound alerts on your stream. Upload sounds, configure settings, and copy the OBS Browser Source URL.</p>

      <!-- Settings -->
      <div class="card">
        <h2>Settings</h2>
        <div style="margin-bottom:6px;">
          <label style="display:flex; align-items:center; gap:8px; font-size:13px;">
            <input type="checkbox" id="soundEnabled" checked>
            Enabled
          </label>
        </div>
        <div style="margin-bottom:6px;">
          <label style="font-size:13px; display:flex; align-items:center; gap:8px;">
            Global Volume
            <input type="range" id="soundGlobalVolume" min="0" max="100" value="100" style="width:120px">
            <span id="soundGlobalVolumeVal" style="font-size:12px; opacity:0.7;">100%</span>
          </label>
        </div>
        <div style="margin-bottom:6px;">
          <label style="font-size:13px; display:flex; align-items:center; gap:8px;">
            Cooldown (sec)
            <input type="number" id="soundGlobalCooldown" min="0" max="60" value="3" style="width:60px">
          </label>
        </div>
        <div style="margin-bottom:6px;">
          <label style="font-size:13px; display:flex; align-items:center; gap:8px;">
            Max Queue
            <input type="number" id="soundMaxQueue" min="1" max="20" value="5" style="width:60px">
          </label>
        </div>
        <button id="saveSoundSettings" style="margin-top:4px;">Save Settings</button>
        <span id="soundSettingsHint" class="hint" style="margin-left:8px;"></span>
      </div>

      <!-- Create Alert -->
      <div class="card">
        <h2>Create Alert</h2>
        <div style="display:flex; gap:4px; margin-bottom:12px;">
          <button id="tabSound" class="tab-btn active" data-tab="sound" style="font-size:12px; padding:5px 12px; border-radius:6px;">Sound</button>
          <button id="tabClip" class="tab-btn" data-tab="clip" style="font-size:12px; padding:5px 12px; border-radius:6px; display:none;">Twitch Clip</button>
          <button id="tabVideo" class="tab-btn" data-tab="video" style="font-size:12px; padding:5px 12px; border-radius:6px; display:none;">Video</button>
        </div>
        <div id="proFeatureHint" class="hint" style="margin-bottom:10px;">Video &amp; clip alerts are a Pro feature. Contact the admin to enable them.</div>

        <!-- Sound upload tab -->
        <form id="soundUploadForm" class="tab-panel" data-tab="sound">
          <div class="hint" style="margin-bottom:8px;">Max 1 MB. Accepted formats: MP3, OGG, WAV, WebM, M4A.</div>
          <div style="margin-bottom:8px;">
            <input type="file" id="soundFile" accept="audio/mpeg,audio/ogg,audio/wav,audio/webm,audio/mp4" style="font-size:12px;">
          </div>
          <div style="margin-bottom:8px;">
            <input type="text" id="soundName" placeholder="Sound name" maxlength="100" style="width:100%; max-width:300px;">
          </div>
          <div class="row2" style="margin-bottom:8px;">
            <select id="soundTier">
              <option value="sound_10">10 Bits</option>
              <option value="sound_25">25 Bits</option>
              <option value="sound_50">50 Bits</option>
              <option value="sound_75">75 Bits</option>
              <option value="sound_100" selected>100 Bits</option>
              <option value="sound_150">150 Bits</option>
              <option value="sound_200">200 Bits</option>
              <option value="sound_300">300 Bits</option>
              <option value="sound_500">500 Bits</option>
              <option value="sound_1000">1000 Bits</option>
            </select>
            <label style="display:flex; align-items:center; gap:6px; font-size:13px;">
              Vol
              <input type="range" id="soundUploadVolume" min="0" max="100" value="80" style="width:80px">
              <span id="soundUploadVolumeVal" style="font-size:12px; opacity:0.7;">80%</span>
            </label>
          </div>
          <button type="submit" id="soundUploadBtn">Upload Sound</button>
          <span id="soundUploadHint" class="hint" style="margin-left:8px;"></span>
        </form>

        <!-- Twitch Clip tab -->
        <form id="clipUploadForm" class="tab-panel" data-tab="clip" style="display:none;">
          <div class="hint" style="margin-bottom:8px;">Paste a Twitch Clip URL. The clip will play with audio through the browser source when redeemed.</div>
          <div style="margin-bottom:8px;">
            <input type="text" id="clipName" placeholder="Alert name" maxlength="100" style="width:100%; max-width:300px;">
          </div>
          <div style="margin-bottom:8px;">
            <input type="text" id="clipUrl" placeholder="https://clips.twitch.tv/..." style="width:100%; max-width:400px;">
          </div>
          <div class="row2" style="margin-bottom:8px;">
            <select id="clipTier">
              <option value="sound_10">10 Bits</option>
              <option value="sound_25">25 Bits</option>
              <option value="sound_50">50 Bits</option>
              <option value="sound_75">75 Bits</option>
              <option value="sound_100" selected>100 Bits</option>
              <option value="sound_150">150 Bits</option>
              <option value="sound_200">200 Bits</option>
              <option value="sound_300">300 Bits</option>
              <option value="sound_500">500 Bits</option>
              <option value="sound_1000">1000 Bits</option>
            </select>
            <label style="display:flex; align-items:center; gap:6px; font-size:13px;">
              Vol
              <input type="range" id="clipVolume" min="0" max="100" value="80" style="width:80px">
              <span id="clipVolumeVal" style="font-size:12px; opacity:0.7;">80%</span>
            </label>
          </div>
          <button type="submit" id="clipUploadBtn">Add Clip</button>
          <span id="clipUploadHint" class="hint" style="margin-left:8px;"></span>
        </form>

        <!-- Video upload tab -->
        <form id="videoUploadForm" class="tab-panel" data-tab="video" style="display:none;">
          <div class="hint" style="margin-bottom:8px;">Max 10 MB. Accepted formats: MP4, WebM. The video will play through the browser source when redeemed.</div>
          <div style="margin-bottom:8px;">
            <input type="file" id="videoFile" accept="video/mp4,video/webm" style="font-size:12px;">
          </div>
          <div style="margin-bottom:8px;">
            <input type="text" id="videoName" placeholder="Video name" maxlength="100" style="width:100%; max-width:300px;">
          </div>
          <div class="row2" style="margin-bottom:8px;">
            <select id="videoTier">
              <option value="sound_10">10 Bits</option>
              <option value="sound_25">25 Bits</option>
              <option value="sound_50">50 Bits</option>
              <option value="sound_75">75 Bits</option>
              <option value="sound_100" selected>100 Bits</option>
              <option value="sound_150">150 Bits</option>
              <option value="sound_200">200 Bits</option>
              <option value="sound_300">300 Bits</option>
              <option value="sound_500">500 Bits</option>
              <option value="sound_1000">1000 Bits</option>
            </select>
            <label style="display:flex; align-items:center; gap:6px; font-size:13px;">
              Vol
              <input type="range" id="videoVolume" min="0" max="100" value="80" style="width:80px">
              <span id="videoVolumeVal" style="font-size:12px; opacity:0.7;">80%</span>
            </label>
          </div>
          <button type="submit" id="videoUploadBtn">Upload Video</button>
          <span id="videoUploadHint" class="hint" style="margin-left:8px;"></span>
        </form>
      </div>

      <!-- Sound List -->
      <div class="card">
        <h2>Alerts (<span id="soundCount">0</span>/20)</h2>
        <div id="soundList" style="display:flex; flex-direction:column; gap:6px;">
          <div class="hint">Loading sounds…</div>
        </div>
      </div>

      <!-- OBS URL -->
      <div class="card">
        <h2>Browser Source URL</h2>
        <code id="soundOverlayUrl" style="display:block; padding:8px 10px; background:var(--surface-muted,#1a1a1e); border-radius:6px; font-size:12px; word-break:break-all;"></code>
        <div style="margin-top:8px; display:flex; gap:12px; align-items:center;">
          <button id="copySoundUrl">Copy URL</button>
          <div class="hint">Add as a Browser Source in OBS (width: 800, height: 200)</div>
        </div>
      </div>
    </main>

    <script>
      (function() {
        var USER_KEY = ${JSON.stringify(userKey)};

        function setBusy(btn, busy) { if (!btn) return; btn.disabled = !!busy; }
        function flashButton(btn) { if (!btn) return; btn.classList.add('btn-click'); setTimeout(function() { btn.classList.remove('btn-click'); }, 160); }

        var TIER_LABELS = {
          sound_10:'10 Bits', sound_25:'25 Bits', sound_50:'50 Bits', sound_75:'75 Bits',
          sound_100:'100 Bits', sound_150:'150 Bits', sound_200:'200 Bits',
          sound_300:'300 Bits', sound_500:'500 Bits', sound_1000:'1000 Bits'
        };

        var soundListEl = document.getElementById('soundList');
        var soundCountEl = document.getElementById('soundCount');
        var soundEnabledEl = document.getElementById('soundEnabled');
        var soundGlobalVolumeEl = document.getElementById('soundGlobalVolume');
        var soundGlobalVolumeValEl = document.getElementById('soundGlobalVolumeVal');
        var soundGlobalCooldownEl = document.getElementById('soundGlobalCooldown');
        var soundMaxQueueEl = document.getElementById('soundMaxQueue');
        var saveSoundSettingsBtn = document.getElementById('saveSoundSettings');
        var soundSettingsHintEl = document.getElementById('soundSettingsHint');
        var soundUploadForm = document.getElementById('soundUploadForm');
        var soundFileEl = document.getElementById('soundFile');
        var soundNameEl = document.getElementById('soundName');
        var soundTierEl = document.getElementById('soundTier');
        var soundUploadVolumeEl = document.getElementById('soundUploadVolume');
        var soundUploadVolumeValEl = document.getElementById('soundUploadVolumeVal');
        var soundUploadBtn = document.getElementById('soundUploadBtn');
        var soundUploadHintEl = document.getElementById('soundUploadHint');

        // Set OBS overlay URL
        var soundUrlEl = document.getElementById('soundOverlayUrl');
        if (soundUrlEl) {
          var p = new URLSearchParams();
          if (USER_KEY) p.set('key', USER_KEY);
          soundUrlEl.textContent = window.location.origin + '/overlay/sounds' + (p.toString() ? ('?' + p.toString()) : '');
        }

        if (soundGlobalVolumeEl) soundGlobalVolumeEl.addEventListener('input', function() {
          if (soundGlobalVolumeValEl) soundGlobalVolumeValEl.textContent = this.value + '%';
        });
        if (soundUploadVolumeEl) soundUploadVolumeEl.addEventListener('input', function() {
          if (soundUploadVolumeValEl) soundUploadVolumeValEl.textContent = this.value + '%';
        });

        // Clip/video volume sliders
        var clipVolumeEl = document.getElementById('clipVolume');
        var clipVolumeValEl = document.getElementById('clipVolumeVal');
        var videoVolumeEl = document.getElementById('videoVolume');
        var videoVolumeValEl = document.getElementById('videoVolumeVal');
        if (clipVolumeEl) clipVolumeEl.addEventListener('input', function() {
          if (clipVolumeValEl) clipVolumeValEl.textContent = this.value + '%';
        });
        if (videoVolumeEl) videoVolumeEl.addEventListener('input', function() {
          if (videoVolumeValEl) videoVolumeValEl.textContent = this.value + '%';
        });

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(function(btn) {
          btn.addEventListener('click', function() {
            document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            var tab = btn.getAttribute('data-tab');
            document.querySelectorAll('.tab-panel').forEach(function(panel) {
              panel.style.display = panel.getAttribute('data-tab') === tab ? '' : 'none';
            });
          });
        });

        // Copy URL button
        var copySoundBtn = document.getElementById('copySoundUrl');
        if (copySoundBtn) {
          copySoundBtn.addEventListener('click', async function() {
            flashButton(copySoundBtn);
            var url = soundUrlEl ? soundUrlEl.textContent : '';
            var old = copySoundBtn.textContent;
            try { await navigator.clipboard.writeText(url); copySoundBtn.textContent = 'Copied!'; } catch(e) { copySoundBtn.textContent = 'Copy failed'; }
            setTimeout(function() { copySoundBtn.textContent = old; }, 900);
          });
        }

        var soundsCache = [];

        async function fetchSoundsAdmin() {
          try {
            var r = await fetch('/api/sounds', { cache: 'no-store' });
            var data = await r.json();
            soundsCache = data.sounds || [];
            var settings = data.settings || {};
            if (soundEnabledEl) soundEnabledEl.checked = settings.enabled !== false;
            if (soundGlobalVolumeEl) { soundGlobalVolumeEl.value = settings.globalVolume ?? 100; if (soundGlobalVolumeValEl) soundGlobalVolumeValEl.textContent = soundGlobalVolumeEl.value + '%'; }
            if (soundGlobalCooldownEl) soundGlobalCooldownEl.value = Math.round((settings.globalCooldownMs || 3000) / 1000);
            if (soundMaxQueueEl) soundMaxQueueEl.value = settings.maxQueueSize ?? 5;
            // Gate clip/video tabs behind videoClipsEnabled
            var vcEnabled = settings.videoClipsEnabled || false;
            var tabClipEl = document.getElementById('tabClip');
            var tabVideoEl = document.getElementById('tabVideo');
            var proHintEl = document.getElementById('proFeatureHint');
            if (tabClipEl) tabClipEl.style.display = vcEnabled ? '' : 'none';
            if (tabVideoEl) tabVideoEl.style.display = vcEnabled ? '' : 'none';
            if (proHintEl) proHintEl.style.display = vcEnabled ? 'none' : '';
            renderSoundList(soundsCache);
          } catch (err) {
            if (soundListEl) {
              soundListEl.textContent = '';
              var hint = document.createElement('div');
              hint.className = 'hint';
              hint.textContent = 'Failed to load sounds';
              soundListEl.appendChild(hint);
            }
          }
        }

        function renderSoundList(sounds) {
          if (!soundListEl) return;
          soundListEl.textContent = '';
          if (soundCountEl) soundCountEl.textContent = String(sounds.length);
          if (!sounds.length) {
            var empty = document.createElement('div');
            empty.className = 'hint';
            empty.textContent = 'No sounds uploaded yet.';
            soundListEl.appendChild(empty);
            return;
          }
          sounds.forEach(function(s) {
            var card = document.createElement('div');
            card.style.cssText = 'display:flex; align-items:center; gap:10px; padding:8px 10px; background:var(--surface-muted,#1a1a1e); border-radius:8px; border:1px solid var(--border,#303038);';
            card.setAttribute('data-sound-id', s.id);

            // Image thumbnail
            var thumb = document.createElement('div');
            thumb.style.cssText = 'width:40px; height:40px; border-radius:6px; overflow:hidden; flex-shrink:0; background:var(--surface-color,#1f1f23); display:flex; align-items:center; justify-content:center;';
            if (s.imageFilename) {
              var img = document.createElement('img');
              img.src = '/api/sounds/' + encodeURIComponent(s.id) + '/image';
              img.alt = '';
              img.style.cssText = 'width:100%; height:100%; object-fit:cover;';
              img.onerror = function() { this.style.display = 'none'; };
              thumb.appendChild(img);
            } else {
              var svgNs = 'http://www.w3.org/2000/svg';
              var svg = document.createElementNS(svgNs, 'svg');
              svg.setAttribute('width', '20');
              svg.setAttribute('height', '20');
              svg.setAttribute('viewBox', '0 0 24 24');
              svg.setAttribute('fill', 'none');
              svg.setAttribute('stroke', 'currentColor');
              svg.setAttribute('stroke-width', '2');
              svg.setAttribute('stroke-linecap', 'round');
              svg.setAttribute('stroke-linejoin', 'round');
              svg.style.opacity = '0.3';
              var poly = document.createElementNS(svgNs, 'polygon');
              poly.setAttribute('points', '11 5 6 9 2 9 2 15 6 15 11 19 11 5');
              var path = document.createElementNS(svgNs, 'path');
              path.setAttribute('d', 'M15.54 8.46a5 5 0 0 1 0 7.07');
              svg.appendChild(poly);
              svg.appendChild(path);
              thumb.appendChild(svg);
            }
            card.appendChild(thumb);

            var info = document.createElement('div');
            info.className = 'sound-info';
            info.style.cssText = 'flex:1; min-width:0;';

            var nameDiv = document.createElement('div');
            nameDiv.style.cssText = 'font-weight:600; font-size:14px;';
            nameDiv.textContent = s.name;

            // Type badge
            if (s.type && s.type !== 'sound') {
              var badge = document.createElement('span');
              badge.className = 'type-badge ' + s.type;
              badge.textContent = s.type;
              nameDiv.appendChild(badge);
            }

            var metaDiv = document.createElement('div');
            metaDiv.style.cssText = 'font-size:12px; opacity:0.6;';
            var metaText = (TIER_LABELS[s.tier] || s.tier) + ' \\u00b7 Vol ' + s.volume + '%';
            if (s.type === 'clip' && s.clipUrl) metaText += ' \\u00b7 ' + s.clipUrl.slice(0, 40);
            metaDiv.textContent = metaText;

            info.appendChild(nameDiv);
            info.appendChild(metaDiv);
            card.appendChild(info);

            var controls = document.createElement('div');
            controls.style.cssText = 'display:flex; align-items:center; gap:6px; flex-shrink:0;';

            var toggle = document.createElement('input');
            toggle.type = 'checkbox';
            toggle.checked = s.enabled;
            toggle.title = 'Enabled';
            toggle.addEventListener('change', function() {
              updateSoundAdmin(s.id, { enabled: this.checked });
            });

            var editBtn = document.createElement('button');
            editBtn.textContent = 'Edit';
            editBtn.style.cssText = 'font-size:12px; padding:3px 8px;';
            editBtn.addEventListener('click', function() { openSoundEditor(s, card); });

            var testBtn = document.createElement('button');
            testBtn.textContent = 'Test';
            testBtn.className = 'secondary';
            testBtn.style.cssText = 'font-size:12px; padding:3px 8px;';
            testBtn.addEventListener('click', async function() {
              flashButton(testBtn);
              setBusy(testBtn, true);
              try { await fetch('/api/sounds/test/' + encodeURIComponent(s.id), { method: 'POST' }); } catch(e) {}
              setBusy(testBtn, false);
            });

            var delBtn = document.createElement('button');
            delBtn.textContent = 'Del';
            delBtn.className = 'danger';
            delBtn.style.cssText = 'font-size:12px; padding:3px 8px; color:#fff; border:none; border-radius:4px; cursor:pointer;';
            delBtn.addEventListener('click', function() { deleteSoundAdmin(s.id, delBtn); });

            controls.appendChild(toggle);
            controls.appendChild(editBtn);
            controls.appendChild(testBtn);
            controls.appendChild(delBtn);
            card.appendChild(controls);

            soundListEl.appendChild(card);
          });
        }

        function openSoundEditor(s, card) {
          var info = card.querySelector('.sound-info');
          if (!info) return;
          var existing = card.querySelector('.sound-edit-form');
          if (existing) { existing.remove(); return; }

          var form = document.createElement('div');
          form.className = 'sound-edit-form';
          form.style.cssText = 'display:flex; flex-direction:column; gap:6px; margin-top:6px; padding-top:8px; border-top:1px solid var(--border,#303038);';

          var nameInput = document.createElement('input');
          nameInput.type = 'text';
          nameInput.value = s.name;
          nameInput.maxLength = 100;
          nameInput.style.cssText = 'max-width:280px;';

          var row = document.createElement('div');
          row.style.cssText = 'display:flex; align-items:center; gap:8px;';

          var tierSelect = document.createElement('select');
          Object.keys(TIER_LABELS).forEach(function(t) {
            var opt = document.createElement('option');
            opt.value = t;
            opt.textContent = TIER_LABELS[t];
            if (t === s.tier) opt.selected = true;
            tierSelect.appendChild(opt);
          });

          var volLabel = document.createElement('label');
          volLabel.style.cssText = 'display:flex; align-items:center; gap:4px; font-size:12px;';
          volLabel.textContent = 'Vol ';
          var volRange = document.createElement('input');
          volRange.type = 'range';
          volRange.min = '0';
          volRange.max = '100';
          volRange.value = String(s.volume);
          volRange.style.cssText = 'width:60px;';
          var volSpan = document.createElement('span');
          volSpan.textContent = s.volume + '%';
          volRange.addEventListener('input', function() { volSpan.textContent = this.value + '%'; });
          volLabel.appendChild(volRange);
          volLabel.appendChild(volSpan);

          row.appendChild(tierSelect);
          row.appendChild(volLabel);

          var cdLabel = document.createElement('label');
          cdLabel.style.cssText = 'display:flex; align-items:center; gap:4px; font-size:12px;';
          cdLabel.textContent = 'Cooldown (sec) ';
          var cdInput = document.createElement('input');
          cdInput.type = 'number';
          cdInput.min = '0';
          cdInput.max = '60';
          cdInput.value = String(Math.round((s.cooldownMs || 5000) / 1000));
          cdInput.style.cssText = 'width:60px;';
          cdLabel.appendChild(cdInput);

          // Image upload section
          var imageSection = document.createElement('div');
          imageSection.style.cssText = 'margin-top:4px;';

          var imageLabel = document.createElement('label');
          imageLabel.style.cssText = 'font-size:12px; color:var(--text-muted);';
          imageLabel.textContent = 'Card Image (max 256 KB, PNG/JPG/GIF/WebP)';

          var imageRow = document.createElement('div');
          imageRow.style.cssText = 'display:flex; gap:6px; align-items:center; margin-top:4px;';

          var imageInput = document.createElement('input');
          imageInput.type = 'file';
          imageInput.accept = 'image/png,image/jpeg,image/gif,image/webp';
          imageInput.style.cssText = 'font-size:12px; flex:1;';

          var imageHint = document.createElement('span');
          imageHint.className = 'hint';
          imageHint.style.cssText = 'margin-left:4px;';

          imageInput.addEventListener('change', async function() {
            var file = imageInput.files ? imageInput.files[0] : null;
            if (!file) return;
            if (file.size > 256 * 1024) { imageHint.textContent = 'File too large (max 256 KB)'; return; }
            imageInput.disabled = true;
            imageHint.textContent = 'Uploading…';
            try {
              var fd = new FormData();
              fd.append('image', file);
              var r = await fetch('/api/sounds/' + encodeURIComponent(s.id) + '/image', { method: 'POST', body: fd });
              if (!r.ok) throw new Error('Upload failed');
              imageHint.textContent = 'Image uploaded!';
              setTimeout(function() { imageHint.textContent = ''; }, 2500);
              await fetchSoundsAdmin();
            } catch(e) {
              imageHint.textContent = e.message || 'Upload failed';
            }
            imageInput.disabled = false;
            imageInput.value = '';
          });

          imageRow.appendChild(imageInput);

          if (s.imageFilename) {
            var removeImgBtn = document.createElement('button');
            removeImgBtn.textContent = 'Remove';
            removeImgBtn.className = 'danger';
            removeImgBtn.style.cssText = 'font-size:12px; padding:3px 8px; color:#fff; border:none; border-radius:4px; cursor:pointer;';
            removeImgBtn.addEventListener('click', async function() {
              flashButton(removeImgBtn);
              setBusy(removeImgBtn, true);
              try {
                await fetch('/api/sounds/' + encodeURIComponent(s.id) + '/image', { method: 'DELETE' });
                await fetchSoundsAdmin();
              } catch(e) {}
              setBusy(removeImgBtn, false);
            });
            imageRow.appendChild(removeImgBtn);
          }

          imageRow.appendChild(imageHint);
          imageSection.appendChild(imageLabel);
          imageSection.appendChild(imageRow);

          // Trim section
          var trimSection = document.createElement('div');
          trimSection.style.cssText = 'margin-top:4px;';

          var trimToggle = document.createElement('button');
          trimToggle.textContent = 'Trim Audio';
          trimToggle.className = 'secondary';
          trimToggle.style.cssText = 'font-size:12px; padding:3px 8px;';

          var trimControls = document.createElement('div');
          trimControls.style.cssText = 'display:none; flex-direction:column; gap:6px; margin-top:6px; padding:8px; background:var(--surface-muted,#1a1a1e); border-radius:6px;';

          var trimAudio = null;
          var trimAudioUrl = null;
          var trimDuration = 0;

          function fmtTime(sec) {
            var m = Math.floor(sec / 60);
            var s = (sec % 60).toFixed(1);
            return m + ':' + (s < 10 ? '0' : '') + s;
          }

          trimToggle.addEventListener('click', async function() {
            if (trimControls.style.display !== 'none') {
              trimControls.style.display = 'none';
              if (trimAudio) { trimAudio.pause(); trimAudio = null; }
              if (trimAudioUrl) { URL.revokeObjectURL(trimAudioUrl); trimAudioUrl = null; }
              return;
            }
            trimControls.style.display = 'flex';
            trimControls.textContent = '';
            var loadHint = document.createElement('div');
            loadHint.className = 'hint';
            loadHint.textContent = 'Loading audio info…';
            trimControls.appendChild(loadHint);
            try {
              var dr = await fetch('/api/sounds/' + encodeURIComponent(s.id) + '/duration');
              var dd = await dr.json();
              trimDuration = dd.duration || 0;
              if (trimDuration < 0.5) { loadHint.textContent = 'Clip too short to trim'; return; }
              buildTrimUI(trimControls, s, trimDuration);
            } catch(e) {
              loadHint.textContent = 'Could not load audio info';
            }
          });

          function buildTrimUI(container, sound, duration) {
            container.textContent = '';

            var startLabel = document.createElement('label');
            startLabel.style.cssText = 'display:flex; align-items:center; gap:6px; font-size:12px;';
            startLabel.textContent = 'Start ';
            var startRange = document.createElement('input');
            startRange.type = 'range'; startRange.min = '0'; startRange.max = String(duration);
            startRange.step = '0.1'; startRange.value = '0';
            startRange.style.cssText = 'flex:1;';
            var startVal = document.createElement('span');
            startVal.style.cssText = 'font-size:12px; opacity:0.7; min-width:44px; text-align:right;';
            startVal.textContent = fmtTime(0);
            startLabel.appendChild(startRange);
            startLabel.appendChild(startVal);

            var endLabel = document.createElement('label');
            endLabel.style.cssText = 'display:flex; align-items:center; gap:6px; font-size:12px;';
            endLabel.textContent = 'End  ';
            var endRange = document.createElement('input');
            endRange.type = 'range'; endRange.min = '0'; endRange.max = String(duration);
            endRange.step = '0.1'; endRange.value = String(duration);
            endRange.style.cssText = 'flex:1;';
            var endVal = document.createElement('span');
            endVal.style.cssText = 'font-size:12px; opacity:0.7; min-width:44px; text-align:right;';
            endVal.textContent = fmtTime(duration);
            endLabel.appendChild(endRange);
            endLabel.appendChild(endVal);

            startRange.addEventListener('input', function() {
              if (parseFloat(startRange.value) >= parseFloat(endRange.value) - 0.5) {
                startRange.value = String(Math.max(0, parseFloat(endRange.value) - 0.5));
              }
              startVal.textContent = fmtTime(parseFloat(startRange.value));
            });
            endRange.addEventListener('input', function() {
              if (parseFloat(endRange.value) <= parseFloat(startRange.value) + 0.5) {
                endRange.value = String(Math.min(duration, parseFloat(startRange.value) + 0.5));
              }
              endVal.textContent = fmtTime(parseFloat(endRange.value));
            });

            var trimBtnRow = document.createElement('div');
            trimBtnRow.style.cssText = 'display:flex; gap:6px; align-items:center;';

            var previewBtn = document.createElement('button');
            previewBtn.textContent = '\\u25B6 Preview';
            previewBtn.className = 'secondary';
            previewBtn.style.cssText = 'font-size:12px; padding:3px 8px;';
            previewBtn.addEventListener('click', async function() {
              if (trimAudio) { trimAudio.pause(); trimAudio = null; previewBtn.textContent = '\\u25B6 Preview'; }
              else {
                try {
                  if (!trimAudioUrl) {
                    var ar = await fetch('/api/sounds/' + encodeURIComponent(sound.id) + '/audio');
                    if (!ar.ok) throw new Error('Could not load audio');
                    var blob = await ar.blob();
                    trimAudioUrl = URL.createObjectURL(blob);
                  }
                  trimAudio = new Audio(trimAudioUrl);
                  trimAudio.currentTime = parseFloat(startRange.value);
                  var stopAt = parseFloat(endRange.value);
                  trimAudio.ontimeupdate = function() { if (trimAudio && trimAudio.currentTime >= stopAt) { trimAudio.pause(); trimAudio = null; previewBtn.textContent = '\\u25B6 Preview'; } };
                  trimAudio.onended = function() { trimAudio = null; previewBtn.textContent = '\\u25B6 Preview'; };
                  previewBtn.textContent = '\\u25A0 Stop';
                  await trimAudio.play();
                } catch(e) { previewBtn.textContent = '\\u25B6 Preview'; }
              }
            });

            var applyBtn = document.createElement('button');
            applyBtn.textContent = 'Apply Trim';
            applyBtn.style.cssText = 'font-size:12px; padding:3px 8px;';
            var trimHint = document.createElement('span');
            trimHint.className = 'hint';
            trimHint.style.cssText = 'margin-left:4px;';

            applyBtn.addEventListener('click', async function() {
              var ts = parseFloat(startRange.value);
              var te = parseFloat(endRange.value);
              if (ts === 0 && te === duration) { trimHint.textContent = 'No change — adjust the range first'; setTimeout(function() { trimHint.textContent = ''; }, 2500); return; }
              if (trimAudio) { trimAudio.pause(); trimAudio = null; }
              if (trimAudioUrl) { URL.revokeObjectURL(trimAudioUrl); trimAudioUrl = null; }
              flashButton(applyBtn);
              setBusy(applyBtn, true);
              trimHint.textContent = 'Trimming…';
              try {
                var r = await fetch('/api/sounds/' + encodeURIComponent(sound.id) + '/trim', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ trimStart: ts, trimEnd: te })
                });
                if (!r.ok) { var b = await r.json().catch(function() { return {}; }); throw new Error(b.error || 'Trim failed'); }
                trimHint.textContent = 'Trimmed!';
                setTimeout(function() { trimHint.textContent = ''; }, 2500);
                await fetchSoundsAdmin();
              } catch(e) {
                trimHint.textContent = e.message || 'Trim failed';
              }
              setBusy(applyBtn, false);
            });

            trimBtnRow.appendChild(previewBtn);
            trimBtnRow.appendChild(applyBtn);
            trimBtnRow.appendChild(trimHint);

            container.appendChild(startLabel);
            container.appendChild(endLabel);
            container.appendChild(trimBtnRow);
          }

          trimSection.appendChild(trimToggle);
          trimSection.appendChild(trimControls);

          var btnRow = document.createElement('div');
          btnRow.style.cssText = 'display:flex; gap:6px;';
          var saveBtn = document.createElement('button');
          saveBtn.textContent = 'Save';
          saveBtn.style.cssText = 'font-size:12px; padding:4px 10px;';
          saveBtn.addEventListener('click', async function() {
            flashButton(saveBtn);
            setBusy(saveBtn, true);
            var patch = {
              name: nameInput.value,
              tier: tierSelect.value,
              volume: Number(volRange.value),
              cooldownMs: Number(cdInput.value) * 1000
            };
            if (s.type === 'clip') {
              var clipUrlInput = document.getElementById('editClipUrl_' + s.id);
              if (clipUrlInput) {
                patch.clipUrl = clipUrlInput.value;
                // Extract slug from URL
                var m = clipUrlInput.value.match(/clips\\.twitch\\.tv\\/([A-Za-z0-9_-]+)/) || clipUrlInput.value.match(/twitch\\.tv\\/[^/]+\\/clip\\/([A-Za-z0-9_-]+)/);
                if (m) patch.clipSlug = m[1];
              }
            }
            await updateSoundAdmin(s.id, patch);
            setBusy(saveBtn, false);
          });
          var cancelBtn = document.createElement('button');
          cancelBtn.textContent = 'Cancel';
          cancelBtn.className = 'secondary';
          cancelBtn.style.cssText = 'font-size:12px; padding:4px 10px;';
          cancelBtn.addEventListener('click', function() {
            if (trimAudio) { trimAudio.pause(); trimAudio = null; }
            if (trimAudioUrl) { URL.revokeObjectURL(trimAudioUrl); trimAudioUrl = null; }
            form.remove();
          });

          btnRow.appendChild(saveBtn);
          btnRow.appendChild(cancelBtn);

          form.appendChild(nameInput);
          form.appendChild(row);
          form.appendChild(cdLabel);
          form.appendChild(imageSection);

          // Clip URL field (only for clip type)
          if (s.type === 'clip') {
            var clipSection = document.createElement('div');
            clipSection.style.cssText = 'margin-top:4px;';
            var clipLabel = document.createElement('label');
            clipLabel.style.cssText = 'font-size:12px; color:var(--text-muted);';
            clipLabel.textContent = 'Twitch Clip URL';
            var clipInput = document.createElement('input');
            clipInput.type = 'text';
            clipInput.value = s.clipUrl || '';
            clipInput.placeholder = 'https://clips.twitch.tv/...';
            clipInput.style.cssText = 'width:100%; max-width:400px; margin-top:4px;';
            clipInput.id = 'editClipUrl_' + s.id;
            clipSection.appendChild(clipLabel);
            clipSection.appendChild(clipInput);
            form.appendChild(clipSection);
          }

          // Trim section (only for sound type)
          if (!s.type || s.type === 'sound') {
            form.appendChild(trimSection);
          }

          form.appendChild(btnRow);
          info.appendChild(form);
        }

        async function updateSoundAdmin(soundId, patch) {
          try {
            await fetch('/api/sounds/' + encodeURIComponent(soundId), {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(patch)
            });
            await fetchSoundsAdmin();
          } catch (err) {}
        }

        async function deleteSoundAdmin(soundId, btn) {
          if (!confirm('Delete this sound? This cannot be undone.')) return;
          flashButton(btn);
          setBusy(btn, true);
          try {
            await fetch('/api/sounds/' + encodeURIComponent(soundId), { method: 'DELETE' });
            await fetchSoundsAdmin();
          } catch (err) {}
          setBusy(btn, false);
        }

        if (saveSoundSettingsBtn) {
          saveSoundSettingsBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            flashButton(saveSoundSettingsBtn);
            setBusy(saveSoundSettingsBtn, true);
            try {
              var payload = {
                enabled: soundEnabledEl ? soundEnabledEl.checked : true,
                globalVolume: soundGlobalVolumeEl ? Number(soundGlobalVolumeEl.value) : 100,
                globalCooldownMs: soundGlobalCooldownEl ? Number(soundGlobalCooldownEl.value) * 1000 : 3000,
                maxQueueSize: soundMaxQueueEl ? Number(soundMaxQueueEl.value) : 5
              };
              await fetch('/api/sounds/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });
              if (soundSettingsHintEl) {
                soundSettingsHintEl.textContent = 'Settings saved!';
                setTimeout(function() { soundSettingsHintEl.textContent = ''; }, 2500);
              }
            } catch (err) {
              if (soundSettingsHintEl) soundSettingsHintEl.textContent = 'Save failed';
            }
            setBusy(saveSoundSettingsBtn, false);
          });
        }

        if (soundUploadForm) {
          soundUploadForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            var file = soundFileEl ? soundFileEl.files[0] : null;
            if (!file) { if (soundUploadHintEl) soundUploadHintEl.textContent = 'Select an audio file'; return; }
            if (file.size > 1024 * 1024) { if (soundUploadHintEl) soundUploadHintEl.textContent = 'File must be under 1 MB'; return; }
            flashButton(soundUploadBtn);
            setBusy(soundUploadBtn, true);
            if (soundUploadHintEl) soundUploadHintEl.textContent = 'Uploading…';
            try {
              var fd = new FormData();
              fd.append('file', file);
              fd.append('name', (soundNameEl ? soundNameEl.value : '') || file.name.replace(/\\.[^.]+$/, ''));
              fd.append('tier', soundTierEl ? soundTierEl.value : 'sound_100');
              fd.append('volume', soundUploadVolumeEl ? soundUploadVolumeEl.value : '80');
              var r = await fetch('/api/sounds', { method: 'POST', body: fd });
              if (!r.ok) {
                var body = await r.json().catch(function() { return {}; });
                throw new Error(body.error || 'Upload failed');
              }
              if (soundFileEl) soundFileEl.value = '';
              if (soundNameEl) soundNameEl.value = '';
              if (soundUploadHintEl) {
                soundUploadHintEl.textContent = 'Sound uploaded!';
                setTimeout(function() { soundUploadHintEl.textContent = ''; }, 2500);
              }
              await fetchSoundsAdmin();
            } catch (err) {
              if (soundUploadHintEl) soundUploadHintEl.textContent = err.message || 'Upload failed';
            }
            setBusy(soundUploadBtn, false);
          });
        }

        // Clip form handler
        var clipUploadForm = document.getElementById('clipUploadForm');
        if (clipUploadForm) {
          clipUploadForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            var clipUrlEl = document.getElementById('clipUrl');
            var clipNameEl = document.getElementById('clipName');
            var clipTierEl = document.getElementById('clipTier');
            var clipVolumeEl = document.getElementById('clipVolume');
            var clipUploadBtn = document.getElementById('clipUploadBtn');
            var clipUploadHintEl = document.getElementById('clipUploadHint');
            var url = clipUrlEl ? clipUrlEl.value.trim() : '';
            if (!url) { if (clipUploadHintEl) clipUploadHintEl.textContent = 'Enter a Twitch Clip URL'; return; }
            flashButton(clipUploadBtn);
            setBusy(clipUploadBtn, true);
            if (clipUploadHintEl) clipUploadHintEl.textContent = 'Creating…';
            try {
              var r = await fetch('/api/sounds/clip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: (clipNameEl ? clipNameEl.value : '') || 'Clip',
                  clipUrl: url,
                  tier: clipTierEl ? clipTierEl.value : 'sound_100',
                  volume: clipVolumeEl ? Number(clipVolumeEl.value) : 80,
                })
              });
              if (!r.ok) {
                var body = await r.json().catch(function() { return {}; });
                throw new Error(body.error || 'Failed to create clip');
              }
              if (clipUrlEl) clipUrlEl.value = '';
              if (clipNameEl) clipNameEl.value = '';
              if (clipUploadHintEl) {
                clipUploadHintEl.textContent = 'Clip added!';
                setTimeout(function() { clipUploadHintEl.textContent = ''; }, 2500);
              }
              await fetchSoundsAdmin();
            } catch (err) {
              if (clipUploadHintEl) clipUploadHintEl.textContent = err.message || 'Failed';
            }
            setBusy(clipUploadBtn, false);
          });
        }

        // Video form handler
        var videoUploadForm = document.getElementById('videoUploadForm');
        if (videoUploadForm) {
          videoUploadForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            var videoFileEl = document.getElementById('videoFile');
            var videoNameEl = document.getElementById('videoName');
            var videoTierEl = document.getElementById('videoTier');
            var videoVolumeEl = document.getElementById('videoVolume');
            var videoUploadBtn = document.getElementById('videoUploadBtn');
            var videoUploadHintEl = document.getElementById('videoUploadHint');
            var file = videoFileEl ? videoFileEl.files[0] : null;
            if (!file) { if (videoUploadHintEl) videoUploadHintEl.textContent = 'Select a video file'; return; }
            if (file.size > 10 * 1024 * 1024) { if (videoUploadHintEl) videoUploadHintEl.textContent = 'File must be under 10 MB'; return; }
            flashButton(videoUploadBtn);
            setBusy(videoUploadBtn, true);
            if (videoUploadHintEl) videoUploadHintEl.textContent = 'Uploading…';
            try {
              var fd = new FormData();
              fd.append('file', file);
              fd.append('name', (videoNameEl ? videoNameEl.value : '') || file.name.replace(/\\.[^.]+$/, ''));
              fd.append('tier', videoTierEl ? videoTierEl.value : 'sound_100');
              fd.append('volume', videoVolumeEl ? videoVolumeEl.value : '80');
              var r = await fetch('/api/sounds/video', { method: 'POST', body: fd });
              if (!r.ok) {
                var body = await r.json().catch(function() { return {}; });
                throw new Error(body.error || 'Upload failed');
              }
              if (videoFileEl) videoFileEl.value = '';
              if (videoNameEl) videoNameEl.value = '';
              if (videoUploadHintEl) {
                videoUploadHintEl.textContent = 'Video uploaded!';
                setTimeout(function() { videoUploadHintEl.textContent = ''; }, 2500);
              }
              await fetchSoundsAdmin();
            } catch (err) {
              if (videoUploadHintEl) videoUploadHintEl.textContent = err.message || 'Upload failed';
            }
            setBusy(videoUploadBtn, false);
          });
        }

        // Logout handler
        var logoutBtn = document.getElementById('logout');
        if (logoutBtn) {
          logoutBtn.addEventListener('click', function() {
            window.location.href = '/auth/logout';
          });
        }

        // Initial load
        fetchSoundsAdmin();
      })();
    </script>
  </body>
</html>`;
}
