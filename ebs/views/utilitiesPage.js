import {
  THEME_CSS_VARS,
  THEME_TOGGLE_STYLES,
  renderThemeBootstrapScript,
} from "./theme.js";
import { GLOBAL_HEADER_STYLES, renderGlobalHeader } from "./globalHeader.js";
import { renderFirebaseScript } from "./firebase.js";

export function renderUtilitiesPage(options = {}) {
  const base = String(options.base || "");
  const adminName = String(options.adminName || "");
  const overlayKey = String(options.overlayKey || "");
  const wheelOverlayBase = String(
    options.wheelOverlayBase || `${base}/overlay/wheel`
  );
  const privacyUrl = `${base}/privacy`;
  const gdprUrl = `${base}/gdpr`;
  const termsUrl = `${base}/terms`;
  const showAdminLink = Boolean(options.showAdminLink);
  const coinHeadsSrc = `${base}/assets/foxCoinHeads.png`;
  const coinTailsSrc = `${base}/assets/foxCoinTails.png`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Utilities – Livestreamer Hub</title>
    <link rel="icon" type="image/png" href="/assets/convertico-coin_24x24.png">
    <script id="Cookiebot" src="https://consent.cookiebot.com/uc.js" data-cbid="6770198d-2c1f-46f8-af4b-694edc70484c" type="text/javascript"></script>
    ${renderThemeBootstrapScript()}
    ${renderFirebaseScript()}
    <style>
      ${THEME_CSS_VARS}
      body { margin: 0; font-family: Inter, system-ui, Arial, sans-serif; background: var(--page-bg); color: var(--text-color); min-height: 100vh; display:flex; flex-direction: column; }
      main { flex: 1; width: min(1100px, 100%); margin: 32px auto 48px; padding: 0 20px; display: flex; gap: 24px; }
      .sidebar { width: 200px; flex-shrink: 0; position: sticky; top: 32px; align-self: flex-start; }
      .sidebar-nav { display: flex; flex-direction: column; gap: 2px; }
      .sidebar-nav-item { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; color: var(--text-muted); background: transparent; border: none; text-align: left; width: 100%; transition: background .15s, color .15s; font-family: inherit; }
      .sidebar-nav-item:hover { background: var(--surface-color); color: var(--text-color); box-shadow: none; filter: none; }
      .sidebar-nav-item.active { background: var(--accent-color); color: #fff; }
      .content-area { flex: 1; min-width: 0; }
      .section-page { display: none; }
      .section-page.active { display: block; }
      @media (max-width: 768px) {
        main { flex-direction: column; }
        .sidebar { width: 100%; position: static; }
        .sidebar-nav { flex-direction: row; overflow-x: auto; gap: 4px; padding-bottom: 4px; }
        .sidebar-nav-item { white-space: nowrap; padding: 8px 12px; font-size: 13px; }
      }
      h1 { margin: 0 0 12px; font-size: 32px; }
      p.lead { margin: 0 0 32px; color: var(--text-muted); max-width: 760px; }
      .utilities-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 18px; align-items: start; }
      .utility-card { background: var(--surface-color); border: 1px solid var(--surface-border); border-radius: 16px; padding: 20px; box-shadow: 0 20px 40px rgba(15,23,42,0.12); display:flex; flex-direction: column; gap: 16px; }
      .utility-card h2 { margin: 0; font-size: 20px; }
      .utility-card p { margin: 0; color: var(--text-muted); font-size: 14px; line-height: 1.5; }
      .utility-card button { align-self: flex-start; background: var(--accent-color); color: #fff; border: 0; border-radius: 10px; padding: 8px 14px; cursor: pointer; font-weight: 600; }
      .utility-card button.secondary { background: var(--secondary-button-bg); color: var(--secondary-button-text); border: 1px solid var(--secondary-button-border); }
      .utility-result { font-size: 32px; font-weight: 700; }
      .coin-stage { width: min(160px, 40vw); height: min(160px, 40vw); perspective: 1200px; margin: 8px auto 0; }
      .coin { width: 100%; height: 100%; position: relative; transform-style: preserve-3d; transform: rotateY(0deg); }
      .coin-face { position: absolute; inset: 0; border-radius: 50%; backface-visibility: hidden; box-shadow: 0 10px 35px rgba(8,8,25,0.3); width: 100%; height: 100%; object-fit: contain; }
      .coin-face.coin-face-tails { transform: rotateY(180deg); }
      .coin.coin-spin-heads { animation: coinFlipHeads 1.1s ease-out forwards; }
      .coin.coin-spin-tails { animation: coinFlipTails 1.1s ease-out forwards; }
      @keyframes coinFlipHeads {
        0% { transform: rotateY(0deg); }
        100% { transform: rotateY(1980deg); }
      }
      @keyframes coinFlipTails {
        0% { transform: rotateY(0deg); }
        100% { transform: rotateY(1890deg); }
      }
      .dice-buttons { display: flex; flex-wrap: wrap; gap: 6px; }
      .dice-buttons button { background: var(--surface-muted); color: var(--text-color); border: 1px solid var(--surface-border); }
      .dice-bar { display:flex; align-items:center; gap: 8px; flex-wrap: wrap; }
      .dice-bar input { width: 70px; padding: 4px 6px; border-radius: 6px; border: 1px solid var(--input-border); background: var(--input-bg); color: var(--text-color); }
      .dice-output { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--surface-muted); padding: 10px; border-radius: 10px; border: 1px solid var(--surface-border); min-height: 48px; max-height: 160px; overflow-y: auto; line-height: 1.35; }
      .dice-note { font-size: 12px; color: var(--text-muted); }
      .wheels-section { display: flex; flex-direction: column; gap: 18px; margin-bottom: 28px; }
      .wheels-section h2 { margin: 0; font-size: 22px; }
      .wheel-card { background: var(--surface-color); border: 1px solid var(--surface-border); border-radius: 16px; padding: 20px; box-shadow: 0 20px 40px rgba(15,23,42,0.12); display:flex; flex-direction: column; gap: 16px; }
      .wheel-card-header { display:flex; align-items:center; gap: 12px; }
      .wheel-card-header input { flex: 1; font-size: 18px; font-weight: 600; padding: 4px 8px; border-radius: 8px; border: 1px solid var(--input-border); background: var(--input-bg); color: var(--text-color); }
      .wheel-card-header button.delete-wheel { background: transparent; color: var(--text-muted); border: 1px solid var(--surface-border); border-radius: 8px; padding: 6px 12px; font-size: 13px; cursor: pointer; }
      .wheel-card-header button.delete-wheel:hover { color: #EF4444; border-color: #EF4444; }
      .wheel-wrapper { display:flex; flex-direction: column; gap: 12px; }
      .wheel-config { display:grid; grid-template-columns: repeat(auto-fit,minmax(220px,1fr)); gap:12px; }
      .wheel-options-list { display:flex; flex-direction: column; gap: 8px; margin-top: 8px; }
      .wheel-option-row { display:flex; gap: 8px; align-items: center; }
      .wheel-option-row input[type="text"] { flex: 1; padding: 6px 8px; border-radius: 8px; border: 1px solid var(--input-border); background: var(--input-bg); color: var(--text-color); }
      .wheel-option-row input[type="color"] { width: 42px; height: 38px; border-radius: 8px; border: 1px solid var(--surface-border); background: transparent; padding: 0; }
      .wheel-option-row button { border: 0; background: transparent; color: var(--text-muted); cursor: pointer; font-size: 18px; }
      .wheel-option-row button:hover { color: var(--accent-color); }
      .wheel-add { margin-top: 8px; }
      .wheel-duration { display:flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text-muted); }
      .wheel-duration input { width: 80px; padding: 6px 8px; border-radius: 8px; border: 1px solid var(--input-border); background: var(--input-bg); color: var(--text-color); margin-left: 8px; }
      .wheel-duration label { display:flex; align-items:center; gap: 8px; font-weight: 600; color: var(--text-color); }
      .wheel-canvas { width: 100%; max-width: 360px; height: 360px; background: var(--surface-color); border-radius: 50%; border: 1px solid var(--surface-border); box-shadow: inset 0 0 20px rgba(0,0,0,0.12); margin: 0 auto; }
      .wheel-result { text-align: center; font-size: 24px; font-weight: 600; }
      .wheel-result-row { display:flex; align-items:center; justify-content:center; gap: 10px; }
      .wheel-remove-winner { font-size: 13px; padding: 4px 10px; border-radius: 8px; background: var(--secondary-button-bg); color: var(--text-muted); border: 1px solid var(--secondary-button-border); cursor: pointer; white-space: nowrap; }
      .wheel-remove-winner:hover { color: var(--accent-color); }
      .wheel-share { display:flex; flex-wrap: wrap; gap: 8px; align-items: center; font-size: 13px; color: var(--text-muted); }
      .wheel-share button { align-self: flex-start; background: var(--secondary-button-bg); color: var(--secondary-button-text); border: 1px solid var(--secondary-button-border); border-radius: 10px; padding: 8px 14px; cursor: pointer; font-weight: 600; }
      .add-wheel-btn { align-self: flex-start; background: var(--secondary-button-bg); color: var(--secondary-button-text); border: 1px solid var(--secondary-button-border); border-radius: 10px; padding: 10px 18px; cursor: pointer; font-weight: 600; font-size: 14px; }
      .add-wheel-btn:hover { border-color: var(--accent-color); color: var(--accent-color); }
      .secondary-tools { margin-top: 8px; }
      .secondary-tools h2 { margin: 0 0 12px; font-size: 18px; color: var(--text-muted); }
      .global-footer { margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--surface-border); display:flex; flex-wrap: wrap; gap: 12px; justify-content: center; font-size: 14px; color: var(--text-muted); }
      .global-footer a { color: var(--text-muted); text-decoration: none; }
      .global-footer a:hover { color: var(--accent-color); }
      ${THEME_TOGGLE_STYLES}
      ${GLOBAL_HEADER_STYLES}
    </style>
  </head>
  <body>
    ${renderGlobalHeader({
      base,
      adminName,
      active: "utilities",
      includeThemeToggle: true,
      showUtilitiesLink: true,
      showAdminLink,
      showFeedback: false,
      showLogout: true,
    })}
    <main>
      <nav class="sidebar">
        <div class="sidebar-nav">
          <button class="sidebar-nav-item active" data-section="wheels">Wheels</button>
          <button class="sidebar-nav-item" data-section="quick-tools">Quick Tools</button>
        </div>
      </nav>
      <div class="content-area">
      <h1>Utilities lab</h1>
      <p class="lead">Lightweight, browser-friendly tools you can project to stream or pipe into a Browser Source.</p>

      <div class="section-page active" data-section="wheels">
      <div class="wheels-section">
        <div id="wheelsContainer"></div>
        <button id="addWheelBtn" class="add-wheel-btn" type="button">+ Add wheel</button>
      </div>
      </div>

      <div class="section-page" data-section="quick-tools">
      <div class="secondary-tools">
        <h2>Quick tools</h2>
        <div class="utilities-grid">
          <section class="utility-card" id="coin-tool">
            <h2>Coin flip</h2>
            <p>Simple heads/tails resolver. Perfect for chat challenges or quick decisions.</p>
            <div class="coin-stage">
              <div class="coin" id="coinVisual">
                <img src="${coinHeadsSrc}" alt="Coin heads" class="coin-face coin-face-heads" />
                <img src="${coinTailsSrc}" alt="Coin tails" class="coin-face coin-face-tails" />
              </div>
            </div>
            <button id="coinFlipBtn" type="button">Flip</button>
            <div id="coinResult" class="utility-result" aria-live="polite">Ready</div>
          </section>
          <section class="utility-card" id="dice-tool">
            <h2>Dice roller</h2>
            <p>Roll common tabletop dice. Choose how many dice to roll at once and we will total them up.</p>
            <div class="dice-bar">
              <label>Dice count <input id="diceCount" type="number" min="1" max="20" value="1" /></label>
              <span id="diceSum"></span>
            </div>
            <div class="dice-buttons">
              ${[4, 6, 8, 10, 20, 50, 100]
                .map(
                  (sides) =>
                    `<button type="button" data-dice="${sides}">d${sides}</button>`
                )
                .join("")}
            </div>
            <div id="diceResult" class="dice-output">Select a die to start rolling.</div>
            <div id="diceNotice" class="dice-note">Max 20 dice per roll.</div>
          </section>
        </div>
      </div>
      </div>

      </div><!-- /content-area -->
    </main>
    <footer class="global-footer">
      <a href="${termsUrl}">Terms of Service</a>
      <a href="${privacyUrl}">Privacy Policy</a>
      <a href="${gdprUrl}">GDPR / UK GDPR Disclosure</a>
      <a href="https://discord.gg/nwu4w5cUVd" target="_blank" rel="noopener noreferrer"><svg style="width:14px;height:14px;fill:currentColor;vertical-align:-2px;margin-right:3px" viewBox="0 0 127.14 96.36"><path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0 105.89 105.89 0 0 0 19.39 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2.03a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2.03a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69C36.18 65.69 31 60 31 53.05s5-12.68 11.45-12.68S54 46.09 53.89 53.05 48.84 65.69 42.45 65.69Zm42.24 0C78.41 65.69 73.25 60 73.25 53.05s5-12.68 11.44-12.68S96.23 46.09 96.12 53.05 91.08 65.69 84.69 65.69Z"/></svg>Discord</a>
    </footer>
    <script>
      (function(){
        // Sidebar section navigation
        function switchSection(sectionId) {
          document.querySelectorAll('.section-page').forEach(function(el) {
            el.classList.toggle('active', el.getAttribute('data-section') === sectionId);
          });
          document.querySelectorAll('.sidebar-nav-item').forEach(function(el) {
            el.classList.toggle('active', el.getAttribute('data-section') === sectionId);
          });
        }
        document.querySelectorAll('.sidebar-nav-item').forEach(function(btn) {
          btn.addEventListener('click', function() {
            switchSection(btn.getAttribute('data-section'));
          });
        });

        var wheelOverlayBase = ${JSON.stringify(wheelOverlayBase)};
        var overlayShareKey = ${JSON.stringify(overlayKey)};
        var defaultColors = ['#9146FF','#F97316','#3B82F6','#10B981','#EC4899','#FCD34D'];
        var TWO_PI = Math.PI * 2;
        var POINTER_ANGLE = Math.PI * 1.5;
        var FREE_SPIN_SPEED = 0.06;
        var DECEL_DURATION_MS = 3000;
        var WHEELS_STORAGE_KEY = 'lsh_wheels';

        function generateId() {
          return 'wheel_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
        }

        function getDefaultWheelOptions() {
          return [
            { label: 'Option 1', color: '#9146FF' },
            { label: 'Option 2', color: '#F97316' },
            { label: 'Option 3', color: '#3B82F6' },
            { label: 'Option 4', color: '#10B981' },
          ];
        }

        function sanitizeWheelOptions(list) {
          return (Array.isArray(list) ? list : [])
            .map(function(opt, idx) {
              var label = String(opt && opt.label ? opt.label : '').trim();
              var color = String(opt && opt.color ? opt.color : '').trim() || defaultColors[idx % defaultColors.length];
              return { label: label || 'Option ' + (idx + 1), color: color };
            })
            .filter(function(opt) { return Boolean(opt.label); });
        }

        function makeDefaultWheel() {
          return { id: generateId(), name: 'Wheel 1', options: getDefaultWheelOptions(), durationSeconds: 4, manualStopMode: false };
        }

        function encodeOptions(value) {
          try {
            return btoa(
              encodeURIComponent(value).replace(/%([0-9A-F]{2})/g, function(_, p1) {
                return String.fromCharCode('0x' + p1);
              })
            );
          } catch (e) { return null; }
        }

        /* ---- Persistence ---- */
        var wheelInstances = [];

        function saveAllWheels() {
          try {
            var data = wheelInstances.map(function(inst) {
              return { id: inst.config.id, name: inst.config.name, options: inst.config.options, durationSeconds: inst.config.durationSeconds, manualStopMode: inst.config.manualStopMode };
            });
            localStorage.setItem(WHEELS_STORAGE_KEY, JSON.stringify(data));
          } catch (e) {}
        }

        function loadWheels() {
          try {
            var raw = localStorage.getItem(WHEELS_STORAGE_KEY);
            if (raw) {
              var parsed = JSON.parse(raw);
              if (Array.isArray(parsed) && parsed.length) {
                return parsed.map(function(w, idx) {
                  var opts = sanitizeWheelOptions(w.options);
                  return {
                    id: w.id || generateId(),
                    name: w.name || 'Wheel ' + (idx + 1),
                    options: opts.length ? opts : getDefaultWheelOptions(),
                    durationSeconds: Number.isFinite(Number(w.durationSeconds)) ? Number(w.durationSeconds) : 4,
                    manualStopMode: Boolean(w.manualStopMode),
                  };
                });
              }
            }
          } catch (e) {}
          try {
            var oldOpts = localStorage.getItem('lsh_wheel_options');
            if (oldOpts) {
              var opts = sanitizeWheelOptions(JSON.parse(oldOpts));
              var dur = Number(localStorage.getItem('lsh_wheel_duration')) || 4;
              var mode = localStorage.getItem('lsh_wheel_mode') === 'manual';
              localStorage.removeItem('lsh_wheel_options');
              localStorage.removeItem('lsh_wheel_duration');
              localStorage.removeItem('lsh_wheel_mode');
              if (opts.length) {
                return [{ id: generateId(), name: 'Wheel 1', options: opts, durationSeconds: dur, manualStopMode: mode }];
              }
            }
          } catch (e) {}
          return null;
        }

        var container = document.getElementById('wheelsContainer');
        var addWheelBtn = document.getElementById('addWheelBtn');

        function updateDeleteButtons() {
          var canDelete = wheelInstances.length > 1;
          wheelInstances.forEach(function(inst) {
            if (inst.deleteBtn) inst.deleteBtn.style.display = canDelete ? '' : 'none';
          });
        }

        function createWheelInstance(config) {
          var inst = {
            config: config,
            canvas: null, ctx: null,
            segments: [], rotation: 0, spinning: false,
            freeSpinning: false, freeSpinRaf: null,
            lastWinnerIndex: -1,
            currentDurationSeconds: config.durationSeconds || 4,
            manualStopMode: config.manualStopMode || false,
            deleteBtn: null,
          };

          var card = document.createElement('div');
          card.className = 'wheel-card';

          var header = document.createElement('div');
          header.className = 'wheel-card-header';
          var nameInput = document.createElement('input');
          nameInput.type = 'text';
          nameInput.value = config.name;
          nameInput.setAttribute('aria-label', 'Wheel name');
          nameInput.addEventListener('input', function() {
            inst.config.name = nameInput.value;
            saveAllWheels();
          });
          header.appendChild(nameInput);

          var deleteBtn = document.createElement('button');
          deleteBtn.type = 'button';
          deleteBtn.className = 'delete-wheel';
          deleteBtn.textContent = 'Delete';
          deleteBtn.addEventListener('click', function() {
            if (wheelInstances.length <= 1) return;
            var idx = wheelInstances.indexOf(inst);
            if (idx < 0) return;
            if (inst.freeSpinning) { inst.freeSpinning = false; if (inst.freeSpinRaf) cancelAnimationFrame(inst.freeSpinRaf); }
            wheelInstances.splice(idx, 1);
            card.remove();
            saveAllWheels();
            updateDeleteButtons();
          });
          inst.deleteBtn = deleteBtn;
          header.appendChild(deleteBtn);
          card.appendChild(header);

          var wrapper = document.createElement('div');
          wrapper.className = 'wheel-wrapper';

          var configDiv = document.createElement('div');
          configDiv.className = 'wheel-config';
          var optionsCol = document.createElement('div');
          var optionsLabel = document.createElement('label');
          optionsLabel.style.cssText = 'font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:var(--text-muted);';
          optionsLabel.textContent = 'Options';
          optionsCol.appendChild(optionsLabel);
          var optionsList = document.createElement('div');
          optionsList.className = 'wheel-options-list';
          optionsCol.appendChild(optionsList);

          var btnRow = document.createElement('div');
          btnRow.style.cssText = 'display:flex;gap:8px;margin-top:8px;';
          var addOptBtn = document.createElement('button');
          addOptBtn.type = 'button';
          addOptBtn.className = 'secondary';
          addOptBtn.textContent = 'Add option';
          var resetBtn = document.createElement('button');
          resetBtn.type = 'button';
          resetBtn.className = 'secondary';
          resetBtn.style.color = 'var(--text-muted)';
          resetBtn.textContent = 'Reset';
          btnRow.appendChild(addOptBtn);
          btnRow.appendChild(resetBtn);
          optionsCol.appendChild(btnRow);
          configDiv.appendChild(optionsCol);
          wrapper.appendChild(configDiv);

          var durationRow = document.createElement('div');
          durationRow.className = 'wheel-duration';
          var durationLabel = document.createElement('label');
          durationLabel.textContent = 'Spin duration (sec, 2-15) ';
          var durationInput = document.createElement('input');
          durationInput.type = 'number';
          durationInput.step = '0.5';
          durationInput.inputMode = 'decimal';
          durationInput.value = String(inst.currentDurationSeconds);
          durationLabel.appendChild(durationInput);
          durationRow.appendChild(durationLabel);
          var durationHint = document.createElement('span');
          durationHint.textContent = 'Longer spins are more dramatic but take longer to resolve.';
          durationRow.appendChild(durationHint);
          if (inst.manualStopMode) durationRow.style.display = 'none';
          wrapper.appendChild(durationRow);

          var controlRow = document.createElement('div');
          controlRow.style.cssText = 'display:flex;align-items:center;gap:12px;flex-wrap:wrap;';
          var spinBtn = document.createElement('button');
          spinBtn.type = 'button';
          spinBtn.textContent = 'Spin';
          spinBtn.style.cssText = 'background:var(--accent-color);color:#fff;border:0;border-radius:10px;padding:8px 14px;cursor:pointer;font-weight:600;';
          var manualLabel = document.createElement('label');
          manualLabel.style.cssText = 'font-size:13px;display:flex;align-items:center;gap:6px;color:var(--text-muted);cursor:pointer;';
          var manualCheckbox = document.createElement('input');
          manualCheckbox.type = 'checkbox';
          manualCheckbox.checked = inst.manualStopMode;
          manualLabel.appendChild(manualCheckbox);
          manualLabel.appendChild(document.createTextNode(' Manual stop'));
          controlRow.appendChild(spinBtn);
          controlRow.appendChild(manualLabel);
          wrapper.appendChild(controlRow);

          var canvas = document.createElement('canvas');
          canvas.width = 360;
          canvas.height = 360;
          canvas.className = 'wheel-canvas';
          wrapper.appendChild(canvas);
          inst.canvas = canvas;
          inst.ctx = canvas.getContext('2d');

          var resultRow = document.createElement('div');
          resultRow.className = 'wheel-result-row';
          var resultEl = document.createElement('div');
          resultEl.className = 'wheel-result';
          resultEl.textContent = 'Awaiting spin\u2026';
          var removeWinnerBtn = document.createElement('button');
          removeWinnerBtn.type = 'button';
          removeWinnerBtn.className = 'wheel-remove-winner';
          removeWinnerBtn.textContent = 'Remove';
          removeWinnerBtn.style.display = 'none';
          resultRow.appendChild(resultEl);
          resultRow.appendChild(removeWinnerBtn);
          wrapper.appendChild(resultRow);

          var shareRow = document.createElement('div');
          shareRow.className = 'wheel-share';
          var copyBtn = document.createElement('button');
          copyBtn.type = 'button';
          copyBtn.textContent = 'Copy Browser Source link';
          if (!overlayShareKey) copyBtn.disabled = true;
          var copyStatus = document.createElement('span');
          copyStatus.textContent = overlayShareKey ? '' : 'Set an overlay key to enable sharing.';
          shareRow.appendChild(copyBtn);
          shareRow.appendChild(copyStatus);
          wrapper.appendChild(shareRow);

          card.appendChild(wrapper);
          container.appendChild(card);

          function drawWheel(angle) {
            var c = inst.ctx;
            if (!c || !inst.canvas) return;
            var size = inst.canvas.width;
            var radius = size / 2 - 4;
            c.clearRect(0, 0, size, size);
            c.save();
            c.translate(size / 2, size / 2);
            c.rotate(angle);
            var slice = TWO_PI / inst.segments.length;
            inst.segments.forEach(function(segment, idx) {
              var start = idx * slice;
              c.beginPath();
              c.moveTo(0, 0);
              c.arc(0, 0, radius, start, start + slice, false);
              c.closePath();
              c.fillStyle = segment.color || defaultColors[idx % defaultColors.length];
              c.fill();
              c.strokeStyle = 'rgba(0,0,0,0.2)';
              c.stroke();
              c.save();
              c.rotate(start + slice / 2);
              c.fillStyle = '#fff';
              c.font = '14px Inter, sans-serif';
              c.textAlign = 'right';
              c.fillText(segment.label, radius - 10, 5);
              c.restore();
            });
            c.restore();
            c.fillStyle = '#EF4444';
            c.beginPath();
            c.moveTo(size / 2, 0);
            c.lineTo(size / 2 - 10, 24);
            c.lineTo(size / 2 + 10, 24);
            c.closePath();
            c.fill();
          }

          function refreshSegments() {
            var sanitized = sanitizeWheelOptions(inst.config.options);
            inst.config.options = sanitized.length ? sanitized : getDefaultWheelOptions();
            inst.segments = inst.config.options.map(function(opt, idx) {
              return { label: opt.label, color: opt.color || defaultColors[idx % defaultColors.length] };
            });
            drawWheel(inst.rotation);
          }

          function hideRemoveWinner() {
            inst.lastWinnerIndex = -1;
            removeWinnerBtn.style.display = 'none';
          }

          function showRemoveWinner(index) {
            inst.lastWinnerIndex = index;
            if (inst.config.options.length > 2) removeWinnerBtn.style.display = '';
          }

          function announceWinner() {
            if (!inst.segments.length) { resultEl.textContent = '\u2014'; hideRemoveWinner(); return; }
            var slice = TWO_PI / inst.segments.length;
            var rotation = ((inst.rotation % TWO_PI) + TWO_PI) % TWO_PI;
            var pointer = (POINTER_ANGLE + TWO_PI) % TWO_PI;
            var relative = (pointer - rotation + TWO_PI) % TWO_PI;
            var index = Math.floor(relative / slice) % inst.segments.length;
            var winner = inst.segments[index];
            resultEl.textContent = winner ? winner.label : '\u2014';
            showRemoveWinner(index);
          }

          function animateWheel(finalAngle, durationMs, onDone) {
            if (inst.spinning || !inst.segments.length) return;
            var start = inst.rotation;
            var delta = finalAngle - start;
            var duration = Math.max(1000, Number(durationMs || 3200));
            inst.spinning = true;
            var startAt = performance.now();
            function step(now) {
              var progress = Math.min(1, (now - startAt) / duration);
              var eased = 1 - Math.pow(1 - progress, 3);
              var current = start + delta * eased;
              drawWheel(current);
              if (progress < 1) {
                requestAnimationFrame(step);
              } else {
                inst.rotation = current % TWO_PI;
                inst.spinning = false;
                if (typeof onDone === 'function') onDone();
              }
            }
            requestAnimationFrame(step);
          }

          function renderOptionsEditor() {
            optionsList.textContent = '';
            inst.config.options.forEach(function(opt, idx) {
              var row = document.createElement('div');
              row.className = 'wheel-option-row';
              var textInput = document.createElement('input');
              textInput.type = 'text';
              textInput.value = opt.label;
              textInput.setAttribute('aria-label', 'Option ' + (idx + 1));
              textInput.addEventListener('input', function() {
                inst.config.options[idx].label = textInput.value;
                refreshSegments();
                saveAllWheels();
              });
              var colorInput = document.createElement('input');
              colorInput.type = 'color';
              colorInput.value = opt.color;
              colorInput.setAttribute('aria-label', 'Color for option ' + (idx + 1));
              colorInput.addEventListener('input', function() {
                inst.config.options[idx].color = colorInput.value;
                refreshSegments();
                saveAllWheels();
              });
              row.appendChild(textInput);
              row.appendChild(colorInput);
              if (inst.config.options.length > 2) {
                var removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.setAttribute('aria-label', 'Remove option ' + (idx + 1));
                removeBtn.textContent = '\u00d7';
                removeBtn.addEventListener('click', function() {
                  inst.config.options.splice(idx, 1);
                  renderOptionsEditor();
                  refreshSegments();
                  saveAllWheels();
                });
                row.appendChild(removeBtn);
              }
              optionsList.appendChild(row);
            });
          }

          function handleSpinPayload(payload) {
            if (!payload) return;
            if (Array.isArray(payload.options) && payload.options.length) {
              var sanitized = sanitizeWheelOptions(payload.options);
              if (sanitized.length) {
                inst.config.options = sanitized;
                renderOptionsEditor();
                refreshSegments();
              }
            }
            var winnerIndex = Number(payload.winnerIndex || 0);
            var lapCount = Math.max(2, Number(payload.lapCount || 6));
            var targetNormalized = Number(payload.targetNormalized);
            var slice = TWO_PI / inst.segments.length;
            var currentNormalized = ((inst.rotation % TWO_PI) + TWO_PI) % TWO_PI;
            var normalizedTarget = Number.isFinite(targetNormalized)
              ? ((targetNormalized % TWO_PI) + TWO_PI) % TWO_PI
              : ((POINTER_ANGLE - (winnerIndex * slice + slice / 2)) % TWO_PI + TWO_PI) % TWO_PI;
            var baseDelta = normalizedTarget - currentNormalized;
            if (baseDelta < 0) baseDelta += TWO_PI;
            var delta = lapCount * TWO_PI + baseDelta;
            var finalAngle = inst.rotation + delta;
            hideRemoveWinner();
            animateWheel(finalAngle, payload.durationMs || 3200, function() {
              var label = payload.winnerLabel || (inst.segments[winnerIndex] ? inst.segments[winnerIndex].label : '\u2014');
              resultEl.textContent = label;
              showRemoveWinner(winnerIndex);
            });
          }

          function clampDuration(value, opts) {
            opts = opts || {};
            var secs = Number(value);
            if (!Number.isFinite(secs)) secs = Number(opts.fallback != null ? opts.fallback : inst.currentDurationSeconds);
            secs = Math.min(15, Math.max(2, secs));
            secs = Math.round(secs * 2) / 2;
            inst.currentDurationSeconds = secs;
            inst.config.durationSeconds = secs;
            if (!opts.skipWrite) durationInput.value = String(secs);
            return secs;
          }

          function requestTimedSpin() {
            if (inst.spinning || inst.freeSpinning) return;
            hideRemoveWinner();
            if (!overlayShareKey) { copyStatus.textContent = 'Set an overlay key first.'; return; }
            var durationSeconds = clampDuration(durationInput.value, { fallback: inst.currentDurationSeconds });
            fetch('/api/wheel/spin', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                overlayKey: overlayShareKey,
                options: inst.config.options,
                durationSeconds: durationSeconds,
                wheelId: inst.config.id,
              }),
            }).then(function(resp) {
              if (!resp.ok) throw new Error('Request failed');
              return resp.json();
            }).then(function(payload) {
              handleSpinPayload(payload);
            }).catch(function() {
              resultEl.textContent = 'Spin failed';
              setTimeout(function() { announceWinner(); }, 2500);
            });
          }

          function startFreeSpin() {
            if (inst.freeSpinning || inst.spinning) return;
            if (!inst.segments.length) return;
            inst.freeSpinning = true;
            hideRemoveWinner();
            resultEl.textContent = 'Spinning\u2026';
            spinBtn.textContent = 'Stop';
            var lastTs = performance.now();
            function step(now) {
              if (!inst.freeSpinning) return;
              var dt = now - lastTs;
              lastTs = now;
              inst.rotation += FREE_SPIN_SPEED * (dt / 16.67);
              drawWheel(inst.rotation);
              inst.freeSpinRaf = requestAnimationFrame(step);
            }
            inst.freeSpinRaf = requestAnimationFrame(step);
          }

          function stopFreeSpin() {
            if (!inst.freeSpinning) return;
            inst.freeSpinning = false;
            if (inst.freeSpinRaf) { cancelAnimationFrame(inst.freeSpinRaf); inst.freeSpinRaf = null; }
            spinBtn.textContent = 'Spin';
            spinBtn.disabled = true;
            if (!overlayShareKey) { copyStatus.textContent = 'Set an overlay key first.'; spinBtn.disabled = false; return; }
            fetch('/api/wheel/spin', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                overlayKey: overlayShareKey,
                options: inst.config.options,
                durationSeconds: DECEL_DURATION_MS / 1000,
                wheelId: inst.config.id,
              }),
            }).then(function(resp) {
              if (!resp.ok) throw new Error('Request failed');
              return resp.json();
            }).then(function(payload) {
              var winnerIndex = payload.winnerIndex || 0;
              var slice = TWO_PI / inst.segments.length;
              var targetAngle = ((POINTER_ANGLE - (winnerIndex * slice + slice / 2)) % TWO_PI + TWO_PI) % TWO_PI;
              var currentNorm = ((inst.rotation % TWO_PI) + TWO_PI) % TWO_PI;
              var baseDelta = targetAngle - currentNorm;
              if (baseDelta < 0) baseDelta += TWO_PI;
              var finalAngle = inst.rotation + TWO_PI * 3 + baseDelta;
              animateWheel(finalAngle, DECEL_DURATION_MS, function() {
                var label = payload.winnerLabel || (inst.segments[winnerIndex] ? inst.segments[winnerIndex].label : '\u2014');
                resultEl.textContent = label;
                showRemoveWinner(winnerIndex);
                spinBtn.disabled = false;
              });
            }).catch(function() {
              resultEl.textContent = 'Spin failed';
              spinBtn.disabled = false;
              setTimeout(function() { announceWinner(); }, 2500);
            });
          }

          /* ---- Event listeners ---- */
          var applyClamp = function() { clampDuration(durationInput.value); saveAllWheels(); };
          durationInput.addEventListener('blur', applyClamp);
          durationInput.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') { event.preventDefault(); applyClamp(); durationInput.blur(); }
          });
          clampDuration(durationInput.value);

          manualCheckbox.addEventListener('change', function() {
            inst.manualStopMode = manualCheckbox.checked;
            inst.config.manualStopMode = manualCheckbox.checked;
            durationRow.style.display = inst.manualStopMode ? 'none' : '';
            saveAllWheels();
          });

          spinBtn.addEventListener('click', function() {
            if (inst.manualStopMode) {
              if (inst.freeSpinning) stopFreeSpin(); else startFreeSpin();
            } else {
              requestTimedSpin();
            }
          });

          addOptBtn.addEventListener('click', function() {
            inst.config.options.push({
              label: 'Option ' + (inst.config.options.length + 1),
              color: defaultColors[inst.config.options.length % defaultColors.length],
            });
            renderOptionsEditor();
            refreshSegments();
            saveAllWheels();
          });

          resetBtn.addEventListener('click', function() {
            if (inst.freeSpinning) { inst.freeSpinning = false; if (inst.freeSpinRaf) { cancelAnimationFrame(inst.freeSpinRaf); inst.freeSpinRaf = null; } }
            inst.config.options = getDefaultWheelOptions();
            inst.currentDurationSeconds = 4;
            inst.config.durationSeconds = 4;
            durationInput.value = '4';
            inst.rotation = 0;
            inst.spinning = false;
            spinBtn.textContent = 'Spin';
            spinBtn.disabled = false;
            renderOptionsEditor();
            refreshSegments();
            saveAllWheels();
            hideRemoveWinner();
            resultEl.textContent = 'Awaiting spin\u2026';
          });

          removeWinnerBtn.addEventListener('click', function() {
            if (inst.lastWinnerIndex < 0 || inst.lastWinnerIndex >= inst.config.options.length || inst.config.options.length <= 2) return;
            inst.config.options.splice(inst.lastWinnerIndex, 1);
            hideRemoveWinner();
            inst.rotation = 0;
            renderOptionsEditor();
            refreshSegments();
            saveAllWheels();
            resultEl.textContent = 'Removed! Spin again.';
          });

          copyBtn.addEventListener('click', function() {
            if (!overlayShareKey) { copyStatus.textContent = 'Set an overlay key first.'; return; }
            var payload = inst.config.options.length ? JSON.stringify(inst.config.options) : '';
            var encoded = payload ? encodeOptions(payload) : null;
            var params = new URLSearchParams();
            params.set('key', overlayShareKey);
            params.set('wheelId', inst.config.id);
            if (encoded) params.set('options', encoded);
            var shareUrl = wheelOverlayBase + '?' + params.toString();
            navigator.clipboard.writeText(shareUrl).then(function() {
              copyStatus.textContent = 'Copied!';
            }).catch(function() {
              copyStatus.textContent = 'Copy failed';
            });
            setTimeout(function() { copyStatus.textContent = ''; }, 2500);
          });

          renderOptionsEditor();
          refreshSegments();

          return inst;
        }

        /* ---- Bootstrap wheels ---- */
        var stored = loadWheels();
        var initialWheels = stored || [makeDefaultWheel()];
        initialWheels.forEach(function(cfg) {
          wheelInstances.push(createWheelInstance(cfg));
        });
        updateDeleteButtons();

        if (addWheelBtn) {
          addWheelBtn.addEventListener('click', function() {
            var num = wheelInstances.length + 1;
            var cfg = { id: generateId(), name: 'Wheel ' + num, options: getDefaultWheelOptions(), durationSeconds: 4, manualStopMode: false };
            wheelInstances.push(createWheelInstance(cfg));
            updateDeleteButtons();
            saveAllWheels();
          });
        }

        /* ---- Coin flip ---- */
        var coinBtn = document.getElementById('coinFlipBtn');
        var coinResult = document.getElementById('coinResult');
        var coinVisual = document.getElementById('coinVisual');
        var coinFaceTransforms = { Heads: 'rotateY(0deg)', Tails: 'rotateY(180deg)' };
        var coinSpinning = false;
        if (coinVisual) coinVisual.style.transform = coinFaceTransforms.Heads;

        function spinCoin(result, onComplete) {
          if (!coinVisual) return;
          coinSpinning = true;
          coinVisual.classList.remove('coin-spin-heads', 'coin-spin-tails');
          void coinVisual.offsetWidth;
          var animClass = result === 'Heads' ? 'coin-spin-heads' : 'coin-spin-tails';
          var handleDone = function() {
            coinVisual.classList.remove('coin-spin-heads', 'coin-spin-tails');
            coinVisual.style.transform = coinFaceTransforms[result];
            coinSpinning = false;
            if (typeof onComplete === 'function') onComplete(result);
            coinVisual.removeEventListener('animationend', handleDone);
          };
          coinVisual.addEventListener('animationend', handleDone);
          coinVisual.classList.add(animClass);
        }

        if (coinBtn && coinResult) {
          coinBtn.addEventListener('click', function() {
            if (coinSpinning) return;
            var flip = Math.random() < 0.5 ? 'Heads' : 'Tails';
            coinResult.textContent = 'Flipping\u2026';
            spinCoin(flip, function(finalResult) { coinResult.textContent = finalResult; });
          });
        }

        /* ---- Dice roller ---- */
        var diceButtons = document.querySelectorAll('[data-dice]');
        var diceCountInput = document.getElementById('diceCount');
        var diceResult = document.getElementById('diceResult');
        var diceSum = document.getElementById('diceSum');
        var diceNotice = document.getElementById('diceNotice');

        function clampDiceCount(value) {
          var count = Number(value);
          if (!Number.isFinite(count)) count = 1;
          var prev = count;
          count = Math.min(20, Math.max(1, count));
          diceCountInput.value = String(count);
          if (diceNotice) {
            diceNotice.textContent = prev !== count ? 'Limited to ' + count + ' dice per roll.' : 'Max 20 dice per roll.';
          }
          return count;
        }

        if (diceCountInput) diceCountInput.addEventListener('input', function() { clampDiceCount(diceCountInput.value); });
        diceButtons.forEach(function(btn) {
          btn.addEventListener('click', function() {
            var sides = Number(btn.getAttribute('data-dice')) || 6;
            var count = clampDiceCount(diceCountInput.value);
            var rolls = Array.from({ length: count }, function() { return 1 + Math.floor(Math.random() * sides); });
            var total = rolls.reduce(function(sum, val) { return sum + val; }, 0);
            var lines = [];
            for (var i = 0; i < rolls.length; i++) {
              var d = document.createElement('div');
              d.textContent = 'Roll ' + (i + 1) + ': ' + rolls[i];
              lines.push(d);
            }
            diceResult.textContent = '';
            lines.forEach(function(d) { diceResult.appendChild(d); });
            var avg = (total / rolls.length).toFixed(1).replace(/\\.0$/, '');
            var sorted = rolls.slice().sort(function(a, b) { return a - b; });
            var mid = Math.floor(sorted.length / 2);
            var median = sorted.length % 2 !== 0 ? sorted[mid] : ((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1).replace(/\\.0$/, '');
            diceSum.textContent = 'Total: ' + total + '  \\u00B7  Avg: ' + avg + '  \\u00B7  Median: ' + median;
          });
        });
      })();
    </script>
  </body>
</html>`;
}
