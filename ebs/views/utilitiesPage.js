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
  const showAdminLink = Boolean(options.showAdminLink);
  const coinHeadsSrc = `${base}/assets/foxCoinHeads.png`;
  const coinTailsSrc = `${base}/assets/foxCoinTails.png`;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Utilities – Twitch Timer</title>
    <link rel="icon" type="image/png" href="/assets/convertico-coin_24x24.png">
    <script id="Cookiebot" src="https://consent.cookiebot.com/uc.js" data-cbid="6770198d-2c1f-46f8-af4b-694edc70484c" type="text/javascript"></script>
    ${renderThemeBootstrapScript()}
    ${renderFirebaseScript()}
    <style>
      ${THEME_CSS_VARS}
      body { margin: 0; font-family: Inter, system-ui, Arial, sans-serif; background: var(--page-bg); color: var(--text-color); min-height: 100vh; display:flex; flex-direction: column; }
      main { flex: 1; width: min(1100px, 100%); margin: 32px auto 48px; padding: 0 20px; }
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
      canvas { width: 100%; max-width: 360px; height: 360px; background: var(--surface-color); border-radius: 50%; border: 1px solid var(--surface-border); box-shadow: inset 0 0 20px rgba(0,0,0,0.12); margin: 0 auto; }
      .wheel-result { text-align: center; font-size: 24px; font-weight: 600; }
      .wheel-share { display:flex; flex-wrap: wrap; gap: 8px; align-items: center; font-size: 13px; color: var(--text-muted); }
      .global-footer { margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--surface-border); display:flex; flex-wrap: wrap; gap: 12px; justify-content: center; font-size: 14px; color: var(--text-muted); }
      .global-footer a { color: var(--text-muted); text-decoration: none; }
      .global-footer a:hover { color: var(--accent-color); }
      .todo-card { border-style: dashed; border-color: var(--surface-border); background: var(--surface-muted); }
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
      <h1>Utilities lab</h1>
      <p class="lead">Lightweight, browser-friendly tools you can project to stream or pipe into a Browser Source. Configure them below, copy the URL for OBS, or trigger them with future webhook hooks.</p>
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
        <section class="utility-card" id="wheel-tool" style="grid-column: span 2;">
          <h2>Wheel spinner</h2>
          <p>Enter options and choose colors below. Click spin to animate the wheel.</p>
            <div class="wheel-wrapper">
              <div class="wheel-config">
                <div>
                  <label style="font-size:13px; letter-spacing:.04em; text-transform:uppercase; color:var(--text-muted);">Options</label>
                  <div id="wheelOptionsList" class="wheel-options-list"></div>
                  <button id="addWheelOption" class="secondary wheel-add" type="button">Add option</button>
                </div>
              </div>
              <div class="wheel-duration">
              <label>Spin duration (sec, 2-15)
                <input id="wheelDuration" type="number" step="0.5" inputmode="decimal" value="4" />
              </label>
              <span>Longer spins are more dramatic but take longer to resolve.</span>
            </div>
              <button id="spinWheel" class="secondary" type="button">Spin the wheel</button>
              <canvas id="wheelCanvas" width="360" height="360"></canvas>
              <div id="wheelResult" class="wheel-result">Awaiting spin…</div>
            <div class="wheel-share">
              <button id="copyWheelLink" type="button" class="secondary" ${
                overlayKey ? "" : "disabled"
              }>Copy Browser Source link</button>
              <span id="copyWheelStatus">${
                overlayKey ? "" : "Set an overlay key to enable sharing."
              }</span>
            </div>
          </div>
        </section>
        <section class="utility-card todo-card">
          <h2>Webhooks</h2>
          <p>Coming soon: trigger these utilities from local hotkeys or chat commands via a lightweight webhook bridge.</p>
        </section>
      </div>
      <footer class="global-footer">
        <a href="${privacyUrl}">Privacy Policy</a>
        <a href="${gdprUrl}">GDPR / UK GDPR Disclosure</a>
        <a href="https://discord.gg/nwu4w5cUVd" target="_blank" rel="noopener noreferrer"><svg style="width:14px;height:14px;fill:currentColor;vertical-align:-2px;margin-right:3px" viewBox="0 0 127.14 96.36"><path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0 105.89 105.89 0 0 0 19.39 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2.03a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2.03a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69C36.18 65.69 31 60 31 53.05s5-12.68 11.45-12.68S54 46.09 53.89 53.05 48.84 65.69 42.45 65.69Zm42.24 0C78.41 65.69 73.25 60 73.25 53.05s5-12.68 11.44-12.68S96.23 46.09 96.12 53.05 91.08 65.69 84.69 65.69Z"/></svg>Discord</a>
      </footer>
    </main>
    <script>
      (function(){
        const qs = new URLSearchParams(window.location.search);
        const focusTool = qs.get('tool');
        const wheelOverlayBase = ${JSON.stringify(wheelOverlayBase)};
        const overlayShareKey = ${JSON.stringify(overlayKey)};
        if (focusTool) {
          const el = document.getElementById(focusTool + '-tool') || document.getElementById(focusTool);
          if (el && typeof el.scrollIntoView === 'function') {
            setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 300);
          }
        }

        const coinBtn = document.getElementById('coinFlipBtn');
        const coinResult = document.getElementById('coinResult');
        const coinVisual = document.getElementById('coinVisual');
        const coinFaceTransforms = {
          Heads: 'rotateY(0deg)',
          Tails: 'rotateY(180deg)'
        };
        let coinSpinning = false;
        if (coinVisual) {
          coinVisual.style.transform = coinFaceTransforms.Heads;
        }

        function spinCoin(result, onComplete) {
          if (!coinVisual) return;
          coinSpinning = true;
          coinVisual.classList.remove('coin-spin-heads', 'coin-spin-tails');
          void coinVisual.offsetWidth;
          const animClass = result === 'Heads' ? 'coin-spin-heads' : 'coin-spin-tails';
          const handleDone = () => {
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
          coinBtn.addEventListener('click', () => {
            if (coinSpinning) return;
            const flip = Math.random() < 0.5 ? 'Heads' : 'Tails';
            coinResult.textContent = 'Flipping…';
            spinCoin(flip, (finalResult) => {
              coinResult.textContent = finalResult;
            });
          });
        }

        const diceButtons = document.querySelectorAll('[data-dice]');
        const diceCountInput = document.getElementById('diceCount');
        const diceResult = document.getElementById('diceResult');
        const diceSum = document.getElementById('diceSum');
        const diceNotice = document.getElementById('diceNotice');

        function clampDiceCount(value) {
          let count = Number(value);
          if (!Number.isFinite(count)) count = 1;
          const prev = count;
          count = Math.min(20, Math.max(1, count));
          diceCountInput.value = String(count);
          if (diceNotice) {
            if (prev !== count) {
              diceNotice.textContent = 'Limited to ' + count + ' dice per roll.';
            } else {
              diceNotice.textContent = 'Max 20 dice per roll.';
            }
          }
          return count;
        }

        if (diceCountInput) {
          diceCountInput.addEventListener('input', () => clampDiceCount(diceCountInput.value));
        }
        diceButtons.forEach((btn) => {
          btn.addEventListener('click', () => {
            const sides = Number(btn.getAttribute('data-dice')) || 6;
            const count = clampDiceCount(diceCountInput.value);
            const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
            const total = rolls.reduce((sum, val) => sum + val, 0);
            diceResult.innerHTML = rolls
              .map(function(val, idx) { return '<div>Roll ' + (idx + 1) + ': ' + val + '</div>'; })
              .join('');
            const avg = (total / rolls.length).toFixed(1).replace(/\.0$/, '');
            const sorted = rolls.slice().sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            const median = sorted.length % 2 !== 0 ? sorted[mid] : ((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1).replace(/\.0$/, '');
            diceSum.textContent = 'Total: ' + total + '  \u00B7  Avg: ' + avg + '  \u00B7  Median: ' + median;
          });
        });

        const wheelCanvas = document.getElementById('wheelCanvas');
        const wheelOptionsList = document.getElementById('wheelOptionsList');
        const addWheelOptionBtn = document.getElementById('addWheelOption');
        const wheelResult = document.getElementById('wheelResult');
        const spinBtn = document.getElementById('spinWheel');
        const wheelDurationInput = document.getElementById('wheelDuration');
        const copyWheelLinkBtn = document.getElementById('copyWheelLink');
        const copyWheelStatus = document.getElementById('copyWheelStatus');
        let currentDurationSeconds = wheelDurationInput ? Number(wheelDurationInput.value) || 4 : 4;
        const ctx = wheelCanvas ? wheelCanvas.getContext('2d') : null;
        const defaultColors = ['#9146FF','#F97316','#3B82F6','#10B981','#EC4899','#FCD34D'];
        const TWO_PI = Math.PI * 2;
        const POINTER_ANGLE = Math.PI * 1.5;
        let wheelSegments = [];
        let wheelRotation = 0;
        let spinning = false;

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
            .map((opt, idx) => {
              const label = String(opt && opt.label ? opt.label : '').trim();
              const color = String(opt && opt.color ? opt.color : '').trim() || defaultColors[idx % defaultColors.length];
              return { label: label || 'Option ' + (idx + 1), color };
            })
            .filter((opt) => Boolean(opt.label));
        }

        let wheelOptions = sanitizeWheelOptions(getDefaultWheelOptions());

        function renderWheelOptionsEditor() {
          if (!wheelOptionsList) return;
          wheelOptionsList.innerHTML = '';
          wheelOptions.forEach((opt, idx) => {
            const row = document.createElement('div');
            row.className = 'wheel-option-row';
            const textInput = document.createElement('input');
            textInput.type = 'text';
            textInput.value = opt.label;
            textInput.setAttribute('aria-label', 'Option ' + (idx + 1));
            textInput.addEventListener('input', () => {
              wheelOptions[idx].label = textInput.value;
              refreshWheelSegments();
              updateShareUrl();
            });
            const colorInput = document.createElement('input');
            colorInput.type = 'color';
            colorInput.value = opt.color;
            colorInput.setAttribute('aria-label', 'Color for option ' + (idx + 1));
            colorInput.addEventListener('input', () => {
              wheelOptions[idx].color = colorInput.value;
              refreshWheelSegments();
              updateShareUrl();
            });
            row.appendChild(textInput);
            row.appendChild(colorInput);
            if (wheelOptions.length > 2) {
              const removeBtn = document.createElement('button');
              removeBtn.type = 'button';
              removeBtn.setAttribute('aria-label', 'Remove option ' + (idx + 1));
              removeBtn.textContent = '×';
              removeBtn.addEventListener('click', () => {
                wheelOptions.splice(idx, 1);
                renderWheelOptionsEditor();
                refreshWheelSegments();
                updateShareUrl();
              });
              row.appendChild(removeBtn);
            }
            wheelOptionsList.appendChild(row);
          });
        }

        function refreshWheelSegments() {
          const sanitized = sanitizeWheelOptions(wheelOptions);
          wheelOptions = sanitized.length ? sanitized : getDefaultWheelOptions();
          wheelSegments = wheelOptions.length
            ? wheelOptions.map((opt, idx) => ({
                label: opt.label,
                color: opt.color || defaultColors[idx % defaultColors.length],
              }))
            : [{ label: 'Add options above', color: '#4B5563' }];
          drawWheel(wheelRotation);
        }

        function drawWheel(angle = 0) {
          if (!ctx || !wheelCanvas) return;
          const size = wheelCanvas.width;
          const radius = size / 2 - 4;
          ctx.clearRect(0, 0, size, size);
          ctx.save();
          ctx.translate(size / 2, size / 2);
          ctx.rotate(angle);
          const slice = TWO_PI / wheelSegments.length;
          wheelSegments.forEach((segment, idx) => {
            const start = idx * slice;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, radius, start, start + slice, false);
            ctx.closePath();
            ctx.fillStyle = segment.color || defaultColors[idx % defaultColors.length];
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.stroke();
            ctx.save();
            ctx.rotate(start + slice / 2);
            ctx.fillStyle = '#fff';
            ctx.font = '14px Inter, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(segment.label, radius - 10, 5);
            ctx.restore();
          });
          ctx.restore();
          ctx.fillStyle = '#EF4444';
          ctx.beginPath();
          ctx.moveTo(size / 2, 0);
          ctx.lineTo(size / 2 - 10, 24);
          ctx.lineTo(size / 2 + 10, 24);
          ctx.closePath();
          ctx.fill();
        }

        function announceWinner() {
          if (!wheelSegments.length) {
            wheelResult.textContent = '—';
            return;
          }
          const slice = TWO_PI / wheelSegments.length;
          const rotation = ((wheelRotation % TWO_PI) + TWO_PI) % TWO_PI;
          const pointer = (POINTER_ANGLE + TWO_PI) % TWO_PI;
          const relative = (pointer - rotation + TWO_PI) % TWO_PI;
          const index = Math.floor(relative / slice) % wheelSegments.length;
          const winner = wheelSegments[index];
          wheelResult.textContent = winner ? winner.label : '—';
        }

        function animateWheel(finalAngle, durationMs, onDone) {
          if (spinning || !wheelSegments.length) return;
          const start = wheelRotation;
          const delta = finalAngle - start;
          const duration = Math.max(1000, Number(durationMs || 3200));
          spinning = true;
          const startAt = performance.now();
          function step(now) {
            const progress = Math.min(1, (now - startAt) / duration);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = start + delta * eased;
            drawWheel(current);
            if (progress < 1) {
              requestAnimationFrame(step);
            } else {
              wheelRotation = current % TWO_PI;
              spinning = false;
              if (typeof onDone === 'function') onDone();
            }
          }
          requestAnimationFrame(step);
        }

        function handleWheelSpinPayload(payload) {
          if (!payload) return;
          if (Array.isArray(payload.options) && payload.options.length) {
            const sanitized = sanitizeWheelOptions(payload.options);
            if (sanitized.length) {
              wheelOptions = sanitized;
              renderWheelOptionsEditor();
              refreshWheelSegments();
            }
          }
          const winnerIndex = Number(payload.winnerIndex || 0);
          const lapCount = Math.max(2, Number(payload.lapCount || 6));
          const targetNormalized = Number(payload.targetNormalized);
          const slice = TWO_PI / wheelSegments.length;
          const currentNormalized = ((wheelRotation % TWO_PI) + TWO_PI) % TWO_PI;
          const normalizedTarget = Number.isFinite(targetNormalized)
            ? ((targetNormalized % TWO_PI) + TWO_PI) % TWO_PI
            : ((POINTER_ANGLE - (winnerIndex * slice + slice / 2)) % TWO_PI + TWO_PI) % TWO_PI;
          let baseDelta = normalizedTarget - currentNormalized;
          if (baseDelta < 0) baseDelta += TWO_PI;
          const delta = lapCount * TWO_PI + baseDelta;
          const finalAngle = wheelRotation + delta;
          animateWheel(finalAngle, payload.durationMs || 3200, () => {
            const label = payload.winnerLabel || wheelSegments[winnerIndex]?.label || '—';
            wheelResult.textContent = label;
          });
        }

        function clampDurationSeconds(value, opts) {
          const options = opts || {};
          let secs = Number(value);
          if (!Number.isFinite(secs)) secs = Number(options.fallback ?? currentDurationSeconds ?? 4);
          secs = Math.min(15, Math.max(2, secs));
          secs = Math.round(secs * 2) / 2;
          currentDurationSeconds = secs;
          if (!options.skipWrite && wheelDurationInput) wheelDurationInput.value = String(secs);
          return secs;
        }

        if (wheelDurationInput) {
          const applyClamp = () => clampDurationSeconds(wheelDurationInput.value);
          wheelDurationInput.addEventListener('blur', applyClamp);
          wheelDurationInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              applyClamp();
              wheelDurationInput.blur();
            }
          });
          clampDurationSeconds(wheelDurationInput.value);
        }

        async function requestWheelSpin() {
          if (spinning) return;
          if (!overlayShareKey) {
            if (copyWheelStatus) copyWheelStatus.textContent = 'Set an overlay key first.';
            return;
          }
          const durationSeconds = clampDurationSeconds(
            wheelDurationInput ? wheelDurationInput.value : currentDurationSeconds,
            { fallback: currentDurationSeconds }
          );
          try {
            const resp = await fetch('/api/wheel/spin', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                overlayKey: overlayShareKey,
                options: wheelOptions,
                durationSeconds,
              }),
            });
            if (!resp.ok) throw new Error('Request failed');
            const payload = await resp.json();
            handleWheelSpinPayload(payload);
          } catch (err) {
            wheelResult.textContent = 'Spin failed';
            setTimeout(() => {
              announceWinner();
            }, 2500);
          }
        }

        function encodeOptions(value) {
          try {
            return btoa(
              encodeURIComponent(value).replace(/%([0-9A-F]{2})/g, (_, p1) =>
                String.fromCharCode('0x' + p1)
              )
            );
          } catch (e) {
            return null;
          }
        }

        function decodeOptions(value) {
          try {
            const binary = atob(value);
            const percent = Array.prototype.map
              .call(binary, (c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join('');
            return decodeURIComponent(percent);
          } catch (e) {
            return '';
          }
        }

        const newlineSplitRegex = new RegExp('\\r?\\n+');

        function parseLegacyOptions(text) {
          return String(text || '')
            .split(newlineSplitRegex)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line, idx) => {
              const parts = line.split('|');
              const label = parts[0].trim() || 'Option ' + (idx + 1);
              const color = (parts[1] && parts[1].trim()) || defaultColors[idx % defaultColors.length];
              return { label, color };
            });
        }

        function addWheelOption() {
          wheelOptions.push({
            label: 'Option ' + (wheelOptions.length + 1),
            color: defaultColors[wheelOptions.length % defaultColors.length],
          });
          renderWheelOptionsEditor();
          refreshWheelSegments();
          updateShareUrl();
        }

        function updateShareUrl() {
          const params = new URLSearchParams(window.location.search);
          params.set('tool', 'wheel');
          const payload = wheelOptions.length ? JSON.stringify(wheelOptions) : '';
          const encoded = payload ? encodeOptions(payload) : null;
          if (encoded) {
            params.set('options', encoded);
          } else {
            params.delete('options');
          }
          const query = params.toString();
          const newUrl = window.location.pathname + (query ? '?' + query : '');
          window.history.replaceState(null, '', newUrl);
        }

        const encodedFromQuery = qs.get('options');
        if (encodedFromQuery) {
          const decoded = decodeOptions(encodedFromQuery);
          if (decoded) {
            try {
              const parsed = JSON.parse(decoded);
              wheelOptions = sanitizeWheelOptions(parsed);
            } catch (e) {
              const legacy = parseLegacyOptions(decoded);
              if (legacy.length) wheelOptions = legacy;
            }
          }
        } else {
          const legacyText = qs.get('wheelOptions');
          if (legacyText) {
            const legacy = parseLegacyOptions(legacyText);
            if (legacy.length) wheelOptions = legacy;
          }
        }

        renderWheelOptionsEditor();
        refreshWheelSegments();
        if (addWheelOptionBtn) {
          addWheelOptionBtn.addEventListener('click', addWheelOption);
        }
        updateShareUrl();
        if (spinBtn) spinBtn.addEventListener('click', requestWheelSpin);
        if (copyWheelLinkBtn) {
          copyWheelLinkBtn.addEventListener('click', async () => {
            if (!overlayShareKey) {
              if (copyWheelStatus) copyWheelStatus.textContent = 'Set an overlay key first.';
              return;
            }
            const payload = wheelOptions.length ? JSON.stringify(wheelOptions) : '';
            const encoded = payload ? encodeOptions(payload) : null;
            const params = new URLSearchParams();
            params.set('key', overlayShareKey);
            if (encoded) params.set('options', encoded);
            const shareUrl = wheelOverlayBase + '?' + params.toString();
            try {
              await navigator.clipboard.writeText(shareUrl);
              if (copyWheelStatus) copyWheelStatus.textContent = 'Copied!';
            } catch (e) {
              if (copyWheelStatus) copyWheelStatus.textContent = 'Copy failed';
            }
            setTimeout(() => {
              if (copyWheelStatus) copyWheelStatus.textContent = '';
            }, 2500);
          });
        }
      })();
    </script>
  </body>
</html>`;
}
