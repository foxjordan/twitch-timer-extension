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

      <!-- Upload Sound -->
      <div class="card">
        <h2>Upload Sound</h2>
        <div class="hint" style="margin-bottom:8px;">Max 1 MB. Accepted formats: MP3, OGG, WAV, WebM, M4A.</div>
        <form id="soundUploadForm">
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
          <button type="submit" id="soundUploadBtn">Upload</button>
          <span id="soundUploadHint" class="hint" style="margin-left:8px;"></span>
        </form>
      </div>

      <!-- Sound List -->
      <div class="card">
        <h2>Sounds (<span id="soundCount">0</span>/20)</h2>
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

            var info = document.createElement('div');
            info.style.cssText = 'flex:1; min-width:0;';

            var nameDiv = document.createElement('div');
            nameDiv.style.cssText = 'font-weight:600; font-size:14px;';
            nameDiv.textContent = s.name;

            var metaDiv = document.createElement('div');
            metaDiv.style.cssText = 'font-size:12px; opacity:0.6;';
            metaDiv.textContent = (TIER_LABELS[s.tier] || s.tier) + ' \\u00b7 Vol ' + s.volume + '%';

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
          var info = card.querySelector('div');
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

          var btnRow = document.createElement('div');
          btnRow.style.cssText = 'display:flex; gap:6px;';
          var saveBtn = document.createElement('button');
          saveBtn.textContent = 'Save';
          saveBtn.style.cssText = 'font-size:12px; padding:4px 10px;';
          saveBtn.addEventListener('click', async function() {
            flashButton(saveBtn);
            setBusy(saveBtn, true);
            await updateSoundAdmin(s.id, {
              name: nameInput.value,
              tier: tierSelect.value,
              volume: Number(volRange.value),
              cooldownMs: Number(cdInput.value) * 1000
            });
            setBusy(saveBtn, false);
          });
          var cancelBtn = document.createElement('button');
          cancelBtn.textContent = 'Cancel';
          cancelBtn.className = 'secondary';
          cancelBtn.style.cssText = 'font-size:12px; padding:4px 10px;';
          cancelBtn.addEventListener('click', function() { form.remove(); });

          btnRow.appendChild(saveBtn);
          btnRow.appendChild(cancelBtn);

          form.appendChild(nameInput);
          form.appendChild(row);
          form.appendChild(cdLabel);
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
