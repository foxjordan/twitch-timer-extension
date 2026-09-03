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
    options.wheelOverlayBase || `${base}/overlay/wheel`,
  );
  const promptOverlayBase = String(
    options.promptOverlayBase || `${base}/overlay/prompt`,
  );
  const plinkoOverlayBase = String(
    options.plinkoOverlayBase || `${base}/overlay/plinko`,
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
      .prompt-card { background: var(--surface-color); border: 1px solid var(--surface-border); border-radius: 16px; padding: 20px; box-shadow: 0 20px 40px rgba(15,23,42,0.12); display:flex; flex-direction: column; gap: 14px; max-width: 640px; }
      .prompt-current { font-size: 16px; font-weight: 600; min-height: 24px; }
      .prompt-current .prompt-empty { color: var(--text-muted); font-weight: 400; }
      .prompt-controls { display:flex; gap: 10px; flex-wrap: wrap; }
      .prompt-controls button.secondary { background: var(--secondary-button-bg); color: var(--secondary-button-text); border: 1px solid var(--secondary-button-border); }
      .prompt-list-label { font-size: 13px; letter-spacing:.04em; text-transform: uppercase; color: var(--text-muted); }
      .prompt-textarea { width: 100%; min-height: 220px; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--input-border); background: var(--input-bg); color: var(--text-color); font-family: inherit; font-size: 14px; line-height: 1.6; resize: vertical; box-sizing: border-box; }
      .prompt-hint { font-size: 12px; color: var(--text-muted); }
      .prompt-share { display:flex; flex-wrap: wrap; gap: 8px; align-items: center; font-size: 13px; color: var(--text-muted); }
      .prompt-share button { align-self: flex-start; background: var(--secondary-button-bg); color: var(--secondary-button-text); border: 1px solid var(--secondary-button-border); border-radius: 10px; padding: 8px 14px; cursor: pointer; font-weight: 600; }
      .secondary-tools { margin-top: 8px; }
      .secondary-tools h2 { margin: 0 0 12px; font-size: 18px; color: var(--text-muted); }
      .plinko-grid { display: grid; grid-template-columns: minmax(280px, 360px) minmax(0, 1fr); gap: 18px; align-items: start; margin-top: 20px; }
      @media (max-width: 860px) { .plinko-grid { grid-template-columns: 1fr; } }
      .plinko-card { background: var(--surface-color); border: 1px solid var(--surface-border); border-radius: 16px; padding: 18px; box-shadow: 0 20px 40px rgba(15,23,42,0.12); display:flex; flex-direction: column; gap: 14px; }
      .plinko-card h3 { margin: 0; font-size: 16px; }
      .plinko-field { display:flex; flex-direction: column; gap: 6px; }
      .plinko-field > label { font-size: 13px; letter-spacing:.04em; text-transform: uppercase; color: var(--text-muted); }
      .plinko-field input[type=number] { width: 120px; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--input-border); background: var(--input-bg); color: var(--text-color); font: inherit; }
      .plinko-hint { font-size: 12px; color: var(--text-muted); }
      .plinko-hint a { color: var(--accent-color); text-decoration: none; }
      .plinko-hint a:hover { text-decoration: underline; }
      .plinko-row-between { display:flex; align-items:center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
      .plinko-mini { font-size: 12px; padding: 5px 10px; }
      button.secondary, .plinko-card button.secondary { background: var(--secondary-button-bg); color: var(--secondary-button-text); border: 1px solid var(--secondary-button-border); border-radius: 10px; padding: 8px 14px; cursor: pointer; font-weight: 600; }
      .plinko-bins-editor { display:flex; flex-direction: column; gap: 6px; max-height: 260px; overflow-y: auto; padding-right: 4px; }
      .plinko-bin-row { display:flex; align-items:center; gap: 8px; font-size: 13px; }
      .plinko-bin-row span { width: 26px; color: var(--text-muted); text-align: right; }
      .plinko-bin-row input[type=number] { width: 78px; padding: 6px 8px; border-radius: 8px; border: 1px solid var(--input-border); background: var(--input-bg); color: var(--text-color); font: inherit; }
      .plinko-bin-row input[type=color] { width: 34px; height: 30px; padding: 0; border: 1px solid var(--input-border); border-radius: 6px; background: none; cursor: pointer; }
      .plinko-token-row { display:flex; gap: 12px; align-items: center; }
      .plinko-token-preview { width: 52px; height: 52px; border-radius: 10px; border: 1px solid var(--surface-border); background: #0e0e10 center/contain no-repeat; flex-shrink: 0; }
      .plinko-token-controls { display:flex; flex-direction: column; gap: 6px; }
      .plinko-emote-grid { display:grid; grid-template-columns: repeat(auto-fill, 44px); gap: 6px; max-height: 200px; overflow-y: auto; margin-top: 8px; }
      .plinko-emote-grid img { width: 44px; height: 44px; object-fit: contain; border-radius: 8px; border: 1px solid transparent; background: #0e0e10; cursor: pointer; }
      .plinko-emote-grid img:hover { border-color: var(--accent-color); }
      .plinko-columns { display:flex; flex-wrap: wrap; gap: 4px; }
      .plinko-columns button { min-width: 34px; padding: 6px 4px; border-radius: 8px; border: 1px solid var(--secondary-button-border); background: var(--secondary-button-bg); color: var(--secondary-button-text); cursor: pointer; font: inherit; font-size: 13px; }
      .plinko-columns button.active { background: var(--accent-color); color: #fff; border-color: var(--accent-color); }
      .plinko-style-grid { display:flex; flex-direction: column; gap: 7px; font-size: 13px; }
      .plinko-check { display:flex; align-items:center; gap: 8px; cursor: pointer; }
      .plinko-inline { display:flex; align-items:center; justify-content: space-between; gap: 8px; }
      .plinko-inline input[type=color] { width: 36px; height: 28px; padding: 0; border: 1px solid var(--input-border); border-radius: 6px; background: none; cursor: pointer; }
      .plinko-inline input[type=range] { flex: 1; max-width: 150px; }
      .plinko-preview { width: 100%; max-width: 420px; height: auto; align-self: center; background: #0e0e10; border-radius: 14px; border: 1px solid var(--surface-border); }
      .plinko-share { display:flex; flex-wrap: wrap; gap: 8px; align-items: center; font-size: 13px; color: var(--text-muted); }
      .plinko-share button { background: var(--secondary-button-bg); color: var(--secondary-button-text); border: 1px solid var(--secondary-button-border); border-radius: 10px; padding: 8px 14px; cursor: pointer; font-weight: 600; }
      .plinko-field select { width: 100%; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--input-border); background: var(--input-bg); color: var(--text-color); font: inherit; }
      .plinko-queue { border: 1px solid var(--surface-border); border-radius: 10px; padding: 10px 12px; font-size: 13px; display:flex; flex-direction: column; gap: 4px; }
      .plinko-queue-next { color: var(--text-muted); }
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
          <button class="sidebar-nav-item" data-section="prompts">Prompts</button>
          <button class="sidebar-nav-item" data-section="plinko">Plinko</button>
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

      <div class="section-page" data-section="prompts">
      <div class="wheels-section">
        <h2>Chat prompt engine</h2>
        <p class="lead" style="margin-bottom:0;">Keep a bank of conversation starters and push one to your overlay any time chat goes quiet.</p>
        <div class="prompt-card">
          <div>
            <div class="prompt-list-label">Now showing</div>
            <div class="prompt-current" id="promptCurrent"><span class="prompt-empty">Nothing shown yet</span></div>
          </div>
          <div class="prompt-controls">
            <button id="promptShowBtn" type="button">Show random prompt</button>
            <button id="promptHideBtn" type="button" class="secondary">Hide</button>
          </div>
          <div>
            <div class="prompt-list-label">Prompt bank (one per line)</div>
            <textarea id="promptTextarea" class="prompt-textarea" spellcheck="false"></textarea>
            <div class="prompt-hint">Saved automatically in this browser. Won&rsquo;t repeat the same prompt twice in a row.</div>
          </div>
          <div class="prompt-share">
            <button id="promptCopyBtn" type="button">Copy Browser Source link</button>
            <span id="promptCopyStatus"></span>
          </div>
        </div>
      </div>
      </div>

      <div class="section-page" data-section="plinko">
      <div class="wheels-section">
        <h2>Plinko board</h2>
        <p class="lead" style="margin-bottom:0;">Drop a token from a column at the top &mdash; it bounces down and lands on a multiplier. The multiplier times your base time is added to the subathon timer. Add <code>/overlay/plinko</code> as its own Browser Source.</p>

        <div class="plinko-grid">
          <div class="plinko-card">
            <h3>Board settings</h3>
            <div class="plinko-field">
              <label for="plinkoBaseSeconds">Base time (seconds)</label>
              <input id="plinkoBaseSeconds" type="number" min="1" max="3600" step="1" value="60" />
              <span class="plinko-hint">Landing on <strong>x2</strong> adds <strong>2&times;</strong> this.</span>
            </div>
            <div class="plinko-field">
              <label for="plinkoRows">Peg rows</label>
              <input id="plinkoRows" type="number" min="6" max="16" step="1" value="9" />
              <span class="plinko-hint">More rows &rarr; the edge multipliers land less often.</span>
            </div>
            <div class="plinko-field">
              <div class="plinko-row-between">
                <label>Multipliers (left &rarr; right)</label>
                <button id="plinkoMirrorBtn" type="button" class="secondary plinko-mini">Mirror left &rarr; right</button>
              </div>
              <div id="plinkoBinsEditor" class="plinko-bins-editor"></div>
            </div>
            <div class="plinko-field">
              <label>Token image</label>
              <div class="plinko-token-row">
                <div id="plinkoTokenPreview" class="plinko-token-preview" aria-hidden="true"></div>
                <div class="plinko-token-controls">
                  <span id="plinkoTokenName" class="plinko-hint">No token set &mdash; a coin is used.</span>
                  <div>
                    <button id="plinkoEmotesBtn" type="button" class="secondary plinko-mini">Load my emotes</button>
                    <button id="plinkoTokenClear" type="button" class="secondary plinko-mini">Clear</button>
                  </div>
                </div>
              </div>
              <div id="plinkoEmoteGrid" class="plinko-emote-grid" hidden></div>
            </div>
            <div class="plinko-field">
              <label for="plinkoTriggerSound">Auto-drop on sound alert</label>
              <select id="plinkoTriggerSound"><option value="">&mdash; none &mdash;</option></select>
              <span class="plinko-hint">When this sound is redeemed (Bits or Channel Points), a token drops from a random column and its multiplier is added on top of the sound&rsquo;s normal time. Redemptions queue while one is dropping. &mdash; Set up or add sounds in <a href="${base}/sounds/config">Sound Alerts</a>.</span>
            </div>
            <div class="plinko-field">
              <label>Overlay style</label>
              <div class="plinko-style-grid">
                <label class="plinko-check"><input type="checkbox" id="plinkoStylePanel" checked /> Background panel</label>
                <label class="plinko-inline">Panel color <input type="color" id="plinkoStylePanelColor" value="#0f0f12" /></label>
                <label class="plinko-inline">Panel opacity <input type="range" id="plinkoStylePanelOpacity" min="0" max="100" value="82" /></label>
                <label class="plinko-check"><input type="checkbox" id="plinkoStylePegs" checked /> Show pegs</label>
                <label class="plinko-inline">Peg color <input type="color" id="plinkoStylePegColor" value="#ffffff" /></label>
                <label class="plinko-inline">Text color <input type="color" id="plinkoStyleTextColor" value="#f8fafc" /></label>
                <label class="plinko-check"><input type="checkbox" id="plinkoStyleShowStatus" checked /> Show status text</label>
                <label class="plinko-check"><input type="checkbox" id="plinkoStylePegSound" checked /> Peg click sound</label>
                <label class="plinko-inline">Peg sound volume <input type="range" id="plinkoStylePegVol" min="0" max="100" value="35" /></label>
                <label class="plinko-check"><input type="checkbox" id="plinkoStyleWinSound" checked /> Landing sound</label>
                <label class="plinko-inline">Landing sound volume <input type="range" id="plinkoStyleWinVol" min="0" max="100" value="50" /></label>
              </div>
            </div>
            <div class="plinko-row-between">
              <button id="plinkoSaveBtn" type="button">Save board</button>
              <span id="plinkoSaveStatus" class="plinko-hint"></span>
            </div>
          </div>

          <div class="plinko-card">
            <h3>Drop</h3>
            <div class="plinko-field">
              <label>Drop column</label>
              <div id="plinkoColumns" class="plinko-columns"></div>
            </div>
            <div class="plinko-row-between">
              <div>
                <button id="plinkoDropBtn" class="secondary" type="button">Drop token</button>
                <button id="plinkoRandomBtn" type="button" class="secondary">Drop random</button>
                <button id="plinkoTestBtn" type="button" class="secondary">Test (no timer)</button>
              </div>
              <span id="plinkoDropStatus" class="plinko-hint"></span>
            </div>
            <div class="plinko-queue" id="plinkoQueuePanel" hidden>
              <div><strong>Now dropping:</strong> <span id="plinkoQueueNow">&mdash;</span></div>
              <div class="plinko-queue-next" id="plinkoQueueNext"></div>
            </div>
            <canvas id="plinkoPreview" class="plinko-preview" width="560" height="680"></canvas>
            <div class="plinko-share">
              <button id="plinkoCopyBtn" type="button">Copy Browser Source link</button>
              <span id="plinkoCopyStatus" class="plinko-hint"></span>
            </div>
            <p class="plinko-hint">Set the Browser Source to <strong>560&nbsp;&times;&nbsp;680</strong> (portrait). The board fills that exactly and scales cleanly to any size with the same shape.</p>
          </div>
        </div>
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
                    `<button type="button" data-dice="${sides}">d${sides}</button>`,
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
            history.replaceState(null, '', '#' + btn.getAttribute('data-section'));
          });
        });
        (function() {
          var requested = String(window.location.hash || '').replace('#', '');
          var validSections = Array.prototype.map.call(
            document.querySelectorAll('.sidebar-nav-item'),
            function(el) { return el.getAttribute('data-section'); }
          );
          if (requested && validSections.indexOf(requested) !== -1) {
            switchSection(requested);
          }
        })();

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
            var wheelRel = wheelOverlayBase + '?' + params.toString();
            var shareUrl = /^https?:/i.test(wheelOverlayBase) ? wheelRel : window.location.origin + wheelRel;
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

        /* ---- Chat Prompt Engine ---- */
        var promptOverlayBase = ${JSON.stringify(promptOverlayBase)};
        var PROMPTS_STORAGE_KEY = 'lsh_prompts';
        var DEFAULT_PROMPTS = [
          "What's the best game you've played this year?",
          "If you could instantly master one skill, what would it be?",
          "What's a hot take you have about this game?",
          "What's the last thing that made you laugh?",
          "Coffee, tea, or energy drink — what's fueling you right now?",
          "What's a hobby you'd get into if money wasn't a factor?",
          "What's the weirdest food combo you actually enjoy?",
          "If you could add one feature to this game, what would it be?",
          "What's a movie or show you could rewatch forever?",
          "What's something small that made your day better recently?",
          "Cats or dogs? Defend your answer.",
          "What's a game you're embarrassed to admit you love?",
        ];

        var promptTextarea = document.getElementById('promptTextarea');
        var promptShowBtn = document.getElementById('promptShowBtn');
        var promptHideBtn = document.getElementById('promptHideBtn');
        var promptCurrent = document.getElementById('promptCurrent');
        var promptCopyBtn = document.getElementById('promptCopyBtn');
        var promptCopyStatus = document.getElementById('promptCopyStatus');
        var lastShownPrompt = '';
        var promptLineSplitRegex = new RegExp('\\r?\\n+');

        function loadPromptList() {
          try {
            var raw = localStorage.getItem(PROMPTS_STORAGE_KEY);
            if (raw) {
              var parsed = JSON.parse(raw);
              if (Array.isArray(parsed) && parsed.length) return parsed;
            }
          } catch (e) {}
          return DEFAULT_PROMPTS.slice();
        }

        function savePromptList(list) {
          try { localStorage.setItem(PROMPTS_STORAGE_KEY, JSON.stringify(list)); } catch (e) {}
        }

        function getPromptListFromTextarea() {
          return promptTextarea.value.split(promptLineSplitRegex).map(function(line) { return line.trim(); }).filter(Boolean);
        }

        if (promptTextarea) {
          promptTextarea.value = loadPromptList().join('\\n');
          promptTextarea.addEventListener('input', function() {
            savePromptList(getPromptListFromTextarea());
          });
        }

        function setPromptCurrentDisplay(text) {
          if (!promptCurrent) return;
          if (text) {
            promptCurrent.textContent = text;
          } else {
            promptCurrent.innerHTML = '<span class="prompt-empty">Nothing shown yet</span>';
          }
        }

        function postPrompt(text) {
          if (!overlayShareKey) { if (promptCopyStatus) promptCopyStatus.textContent = 'Set an overlay key first.'; return; }
          fetch('/api/prompt/show', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ overlayKey: overlayShareKey, text: text }),
          }).then(function(resp) {
            if (!resp.ok) throw new Error('Request failed');
            return resp.json();
          }).then(function() {
            setPromptCurrentDisplay(text);
            if (text) lastShownPrompt = text;
          }).catch(function() {
            if (promptCurrent) promptCurrent.textContent = 'Failed to update overlay';
          });
        }

        if (promptShowBtn) {
          promptShowBtn.addEventListener('click', function() {
            var list = getPromptListFromTextarea();
            if (!list.length) { setPromptCurrentDisplay(''); return; }
            var candidates = list.length > 1 ? list.filter(function(p) { return p !== lastShownPrompt; }) : list;
            var pick = candidates[Math.floor(Math.random() * candidates.length)];
            postPrompt(pick);
          });
        }

        if (promptHideBtn) {
          promptHideBtn.addEventListener('click', function() {
            postPrompt('');
          });
        }

        if (promptCopyBtn) {
          promptCopyBtn.addEventListener('click', function() {
            if (!overlayShareKey) { promptCopyStatus.textContent = 'Set an overlay key first.'; return; }
            var params = new URLSearchParams();
            params.set('key', overlayShareKey);
            var promptRel = promptOverlayBase + '?' + params.toString();
            var shareUrl = /^https?:/i.test(promptOverlayBase) ? promptRel : window.location.origin + promptRel;
            navigator.clipboard.writeText(shareUrl).then(function() {
              promptCopyStatus.textContent = 'Copied!';
            }).catch(function() {
              promptCopyStatus.textContent = 'Copy failed';
            });
            setTimeout(function() { promptCopyStatus.textContent = ''; }, 2500);
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

        /* ---- Plinko board ---- */
        (function () {
          var plinkoOverlayBase = ${JSON.stringify(plinkoOverlayBase)};
          var PLINKO_BOARD_ID = 'default';
          var section = document.querySelector('.section-page[data-section="plinko"]');
          if (!section) return;

          var baseInput = document.getElementById('plinkoBaseSeconds');
          var rowsInput = document.getElementById('plinkoRows');
          var binsEditor = document.getElementById('plinkoBinsEditor');
          var mirrorBtn = document.getElementById('plinkoMirrorBtn');
          var tokenPreview = document.getElementById('plinkoTokenPreview');
          var tokenName = document.getElementById('plinkoTokenName');
          var emotesBtn = document.getElementById('plinkoEmotesBtn');
          var tokenClear = document.getElementById('plinkoTokenClear');
          var emoteGrid = document.getElementById('plinkoEmoteGrid');
          var saveBtn = document.getElementById('plinkoSaveBtn');
          var saveStatus = document.getElementById('plinkoSaveStatus');
          var columnsWrap = document.getElementById('plinkoColumns');
          var dropBtn = document.getElementById('plinkoDropBtn');
          var randomBtn = document.getElementById('plinkoRandomBtn');
          var testBtn = document.getElementById('plinkoTestBtn');
          var dropStatus = document.getElementById('plinkoDropStatus');
          var previewCanvas = document.getElementById('plinkoPreview');
          var copyBtn = document.getElementById('plinkoCopyBtn');
          var copyStatus = document.getElementById('plinkoCopyStatus');
          var stylePanel = document.getElementById('plinkoStylePanel');
          var stylePanelColor = document.getElementById('plinkoStylePanelColor');
          var stylePanelOpacity = document.getElementById('plinkoStylePanelOpacity');
          var stylePegs = document.getElementById('plinkoStylePegs');
          var stylePegColor = document.getElementById('plinkoStylePegColor');
          var styleTextColor = document.getElementById('plinkoStyleTextColor');
          var styleShowStatus = document.getElementById('plinkoStyleShowStatus');
          var stylePegSound = document.getElementById('plinkoStylePegSound');
          var stylePegVol = document.getElementById('plinkoStylePegVol');
          var styleWinSound = document.getElementById('plinkoStyleWinSound');
          var styleWinVol = document.getElementById('plinkoStyleWinVol');
          var triggerSound = document.getElementById('plinkoTriggerSound');
          var queuePanel = document.getElementById('plinkoQueuePanel');
          var queueNow = document.getElementById('plinkoQueueNow');
          var queueNext = document.getElementById('plinkoQueueNext');
          var pctx = previewCanvas ? previewCanvas.getContext('2d') : null;

          var STYLE_DEFAULTS = { panel: true, panelColor: '#0f0f12', panelOpacity: 0.82, pegs: true, pegColor: '#ffffff', textColor: '#f8fafc', showStatus: true, pegSound: true, pegSoundVolume: 0.35, winSound: true, winSoundVolume: 0.5 };
          var pendingToken = { name: '', url: '', source: '' };
          var dropColumn = 4;
          var busy = false;
          var previewBusy = false;
          var animToken = null;

          function trimNum(n) { return String(Math.round((Number(n) || 0) * 100) / 100); }
          function clampNum(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
          function currentRows() { return clampNum(parseInt(rowsInput.value, 10) || 9, 6, 16); }

          var plinkPool = [];
          var plinkIdx = 0;
          try {
            for (var _pi = 0; _pi < 6; _pi++) { var _pa = new Audio('/assets/plink_sound.mp3'); _pa.preload = 'auto'; plinkPool.push(_pa); }
          } catch (e) { plinkPool = []; }
          function playPlink() {
            var st = readStyle();
            if (!st.pegSound || !plinkPool.length) return;
            var a = plinkPool[plinkIdx];
            plinkIdx = (plinkIdx + 1) % plinkPool.length;
            try { a.volume = clampNum(st.pegSoundVolume, 0, 1); a.currentTime = 0; var p = a.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
          }
          var winAudio = null;
          try { winAudio = new Audio('/assets/plinko_win_sound.wav'); winAudio.preload = 'auto'; } catch (e) {}
          function playWin() {
            var st = readStyle();
            if (!st.winSound || !winAudio) return;
            try { winAudio.volume = clampNum(st.winSoundVolume, 0, 1); winAudio.currentTime = 0; var p = winAudio.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
          }

          function readStyle() {
            return {
              panel: stylePanel.checked,
              panelColor: stylePanelColor.value,
              panelOpacity: clampNum((parseInt(stylePanelOpacity.value, 10) || 0) / 100, 0, 1),
              pegs: stylePegs.checked,
              pegColor: stylePegColor.value,
              textColor: styleTextColor.value,
              showStatus: styleShowStatus.checked,
              pegSound: stylePegSound.checked,
              pegSoundVolume: clampNum((parseInt(stylePegVol.value, 10) || 0) / 100, 0, 1),
              winSound: styleWinSound.checked,
              winSoundVolume: clampNum((parseInt(styleWinVol.value, 10) || 0) / 100, 0, 1),
            };
          }

          function defaultBin(i, rows) {
            var center = rows / 2;
            var d = center > 0 ? Math.abs(i - center) / center : 0;
            var m = Math.max(1, Math.round((1 + 3 * d * d) * 4) / 4);
            var color = m >= 4 ? '#F97316' : m >= 2 ? '#EC4899' : m >= 1.5 ? '#3B82F6' : '#9146FF';
            return { multiplier: m, color: color };
          }

          function readBins() {
            var rows = [];
            binsEditor.querySelectorAll('.plinko-bin-row').forEach(function (row) {
              rows.push({
                multiplier: parseFloat(row.querySelector('.plinko-bin-mult').value) || 1,
                color: row.querySelector('.plinko-bin-color').value || '#9146FF',
              });
            });
            return rows;
          }

          function renderBins(bins) {
            var rows = currentRows();
            var out = [];
            for (var i = 0; i < rows + 1; i++) {
              var b = (bins && bins[i]) || defaultBin(i, rows);
              out.push(
                '<div class="plinko-bin-row"><span>' + i + '</span>' +
                '<input type="number" class="plinko-bin-mult" min="0.1" max="100" step="0.25" value="' + trimNum(b.multiplier) + '" />' +
                '<input type="color" class="plinko-bin-color" value="' + (/^#[0-9a-fA-F]{6}$/.test(b.color) ? b.color : '#9146FF') + '" /></div>'
              );
            }
            binsEditor.innerHTML = out.join('');
          }

          function renderColumns() {
            var rows = currentRows();
            if (dropColumn > rows) dropColumn = Math.floor(rows / 2);
            var out = [];
            for (var i = 0; i <= rows; i++) {
              out.push('<button type="button" data-col="' + i + '"' + (i === dropColumn ? ' class="active"' : '') + '>' + i + '</button>');
            }
            columnsWrap.innerHTML = out.join('');
          }

          function setToken(tok) {
            pendingToken = { name: (tok && tok.name) || '', url: (tok && tok.url) || '', source: (tok && tok.source) || '' };
            tokenPreview.style.backgroundImage = pendingToken.url ? 'url("' + pendingToken.url + '")' : 'none';
            tokenName.textContent = pendingToken.url ? (pendingToken.name || 'Custom token') : 'No token set — a coin is used.';
            animToken = null;
            if (pendingToken.url) {
              var img = new Image();
              img.onload = function () { animToken = img; };
              img.src = pendingToken.url;
            }
            drawPreviewIdle();
          }

          function applyConfig(cfg) {
            baseInput.value = cfg.baseSeconds;
            rowsInput.value = cfg.rows;
            renderBins(cfg.bins);
            renderColumns();
            setToken(cfg.token || {});
            var st = cfg.style || {};
            stylePanel.checked = st.panel !== false;
            stylePanelColor.value = st.panelColor || STYLE_DEFAULTS.panelColor;
            stylePanelOpacity.value = Math.round((typeof st.panelOpacity === 'number' ? st.panelOpacity : STYLE_DEFAULTS.panelOpacity) * 100);
            stylePegs.checked = st.pegs !== false;
            stylePegColor.value = st.pegColor || STYLE_DEFAULTS.pegColor;
            styleTextColor.value = st.textColor || STYLE_DEFAULTS.textColor;
            styleShowStatus.checked = st.showStatus !== false;
            stylePegSound.checked = st.pegSound !== false;
            stylePegVol.value = Math.round((typeof st.pegSoundVolume === 'number' ? st.pegSoundVolume : STYLE_DEFAULTS.pegSoundVolume) * 100);
            styleWinSound.checked = st.winSound !== false;
            styleWinVol.value = Math.round((typeof st.winSoundVolume === 'number' ? st.winSoundVolume : STYLE_DEFAULTS.winSoundVolume) * 100);
            if ([].slice.call(triggerSound.options).some(function (o) { return o.value === (cfg.triggerSoundId || ''); })) {
              triggerSound.value = cfg.triggerSoundId || '';
            }
          }

          function formPayload() {
            return { baseSeconds: parseInt(baseInput.value, 10) || 60, rows: currentRows(), bins: readBins(), token: pendingToken, style: readStyle(), triggerSoundId: triggerSound.value };
          }

          function populateSounds(sounds) {
            var cur = triggerSound.value;
            triggerSound.innerHTML = '<option value="">none</option>';
            (sounds || []).forEach(function (s) {
              var o = document.createElement('option');
              o.value = s.id;
              o.textContent = s.name || s.id;
              triggerSound.appendChild(o);
            });
            triggerSound.value = cur;
          }

          function loadConfig() {
            var defaults = { baseSeconds: 60, rows: 9, bins: null, token: {}, triggerSoundId: '' };
            Promise.all([
              fetch('/api/plinko/config', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
              fetch('/api/sounds', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
            ]).then(function (res) {
              populateSounds(res[1] && res[1].sounds);
              applyConfig(res[0] || defaults);
            });
          }

          function save() {
            saveStatus.textContent = 'Saving…';
            fetch('/api/plinko/config', {
              method: 'POST', credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(formPayload()),
            })
              .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
              .then(function (cfg) { applyConfig(cfg); saveStatus.textContent = 'Saved'; })
              .catch(function () { saveStatus.textContent = 'Save failed'; });
            setTimeout(function () { saveStatus.textContent = ''; }, 2500);
          }

          function drop(opts) {
            opts = opts || {};
            if (busy) return;
            busy = true;
            dropStatus.textContent = opts.test ? 'Testing…' : opts.random ? 'Dropping (random)…' : 'Dropping…';
            // The preview animates from the plinko_drop SSE event (below), in
            // lock-step with the real overlay — including when this drop waits
            // in the queue behind sound-triggered ones.
            var body = { boardId: PLINKO_BOARD_ID, test: !!opts.test };
            if (!opts.random) body.dropColumn = dropColumn; // omit -> server picks a random column
            fetch('/api/plinko/drop', {
              method: 'POST', credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            })
              .then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
              .then(function () { busy = false; })
              .catch(function () { busy = false; dropStatus.textContent = 'Drop failed'; });
          }

          function loadEmotes() {
            emoteGrid.hidden = false;
            emoteGrid.innerHTML = '<span class="plinko-hint">Loading…</span>';
            Promise.all([
              fetch('/api/sounds/twitch-emotes', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : { emotes: [] }; }).catch(function () { return { emotes: [] }; }),
              fetch('/api/sounds/seventv-emotes', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : { emotes: [] }; }).catch(function () { return { emotes: [] }; }),
            ]).then(function (res) {
              var twitch = (res[0].emotes || []).map(function (e) { return { name: e.name, url: e.url, source: 'twitch' }; });
              var seventv = (res[1].emotes || []).map(function (e) { return { name: e.name, url: e.url, source: '7tv' }; });
              var all = twitch.concat(seventv).filter(function (e) { return e.url; });
              if (!all.length) { emoteGrid.innerHTML = '<span class="plinko-hint">No emotes found.</span>'; return; }
              emoteGrid.innerHTML = '';
              all.forEach(function (e) {
                var img = document.createElement('img');
                img.src = e.url; img.alt = e.name; img.title = e.name;
                img.addEventListener('click', function () { setToken(e); emoteGrid.hidden = true; });
                emoteGrid.appendChild(img);
              });
            });
          }

          /* ---- preview rendering (mirrors plinkoOverlayPage.js) ---- */
          var W = 560, H = 680, PAD_X = 42, TOP_Y = 64, BINS_H = 74;
          var binsTop = H - BINS_H - 16;
          function binW(rows) { return (W - PAD_X * 2) / (rows + 1); }
          function xForPos(u, rows) { return PAD_X + (u + 0.5) * binW(rows); }
          function rowGap(rows) { return (binsTop - TOP_Y) / (rows + 1); }
          function tokenR(rows) { return Math.min(binW(rows) * 0.42, rowGap(rows) * 0.9, 26); }
          function hexA(hex, a) {
            var h = String(hex || '#9146FF').replace('#', '');
            if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
            var n = parseInt(h, 16); if (isNaN(n)) return 'rgba(145,70,255,' + a + ')';
            return 'rgba(' + ((n>>16)&255) + ',' + ((n>>8)&255) + ',' + (n&255) + ',' + a + ')';
          }
          function pRoundRect(x, y, w, h, r) {
            pctx.beginPath();
            pctx.moveTo(x + r, y);
            pctx.arcTo(x + w, y, x + w, y + h, r);
            pctx.arcTo(x + w, y + h, x, y + h, r);
            pctx.arcTo(x, y + h, x, y, r);
            pctx.arcTo(x, y, x + w, y, r);
            pctx.closePath();
          }
          function drawBoard(bins, rows, highlight) {
            if (!pctx) return;
            var s = readStyle();
            pctx.clearRect(0, 0, W, H);

            if (s.panel) {
              pRoundRect(6, 6, W - 12, H - 12, 22);
              pctx.fillStyle = hexA(s.panelColor, s.panelOpacity);
              pctx.fill();
            }

            if (s.pegs) {
              pctx.fillStyle = hexA(s.pegColor, 0.55);
              for (var r = 0; r < rows; r++) {
                var y = TOP_Y + (r + 1) * rowGap(rows);
                var shift = r % 2 === 0 ? 0.5 : 0;
                for (var k = -1; k <= rows + 1; k++) {
                  var u = k + shift;
                  if (u < -0.2 || u > rows + 0.2) continue;
                  pctx.beginPath(); pctx.arc(xForPos(u, rows), y, 3, 0, Math.PI * 2); pctx.fill();
                }
              }
            }

            for (var i = 0; i < rows + 1; i++) {
              var b = bins[i] || bins[bins.length - 1] || { multiplier: 1, color: '#9146FF' };
              var bx = PAD_X + i * binW(rows);
              var active = i === highlight;
              pctx.fillStyle = hexA(b.color, active ? 0.85 : 0.22);
              pctx.fillRect(bx + 2, binsTop, binW(rows) - 4, BINS_H);
              pctx.fillStyle = b.color;
              pctx.fillRect(bx + 2, binsTop, binW(rows) - 4, 4);
              pctx.fillStyle = active ? s.textColor : hexA(s.textColor, 0.9);
              pctx.font = (active ? 'bold ' : '') + Math.min(18, binW(rows) * 0.5) + 'px Inter, sans-serif';
              pctx.textAlign = 'center'; pctx.textBaseline = 'middle';
              pctx.fillText('x' + trimNum(b.multiplier), bx + binW(rows) / 2, binsTop + BINS_H / 2 + 2);
            }
          }
          function drawToken(x, y, rows) {
            var rad = tokenR(rows);
            if (animToken) {
              pctx.save(); pctx.beginPath(); pctx.arc(x, y, rad, 0, Math.PI * 2); pctx.clip();
              pctx.drawImage(animToken, x - rad, y - rad, rad * 2, rad * 2); pctx.restore();
              pctx.beginPath(); pctx.arc(x, y, rad, 0, Math.PI * 2);
              pctx.strokeStyle = 'rgba(255,255,255,0.85)'; pctx.lineWidth = 2; pctx.stroke();
            } else {
              pctx.beginPath(); pctx.arc(x, y, rad, 0, Math.PI * 2);
              pctx.fillStyle = '#FCD34D'; pctx.fill();
              pctx.strokeStyle = 'rgba(0,0,0,0.3)'; pctx.stroke();
            }
          }
          function drawPreviewIdle() {
            var rows = currentRows();
            drawBoard(readBins().length ? readBins() : [], rows, -1);
          }
          function animatePreview(p) {
            if (previewBusy || !p) return;
            previewBusy = true;
            var rows = p.rows || currentRows();
            var bins = (p.bins && p.bins.length) ? p.bins : readBins();
            var path = Array.isArray(p.path) ? p.path : [];
            var n = path.length || rows;
            var start = clampNum(Number(p.dropColumn) || 0, 0, rows);
            var duration = clampNum(Number(p.durationMs) || (1400 + n * 420), 1600, 14000);
            var stops = [start], pos = start;
            for (var i = 0; i < n; i++) {
              pos += path[i] ? 0.5 : -0.5;
              if (pos < 0) pos = 0; if (pos > rows) pos = rows;
              stops.push(pos);
            }
            var landBin = typeof p.binIndex === 'number' ? p.binIndex : Math.round(pos);
            var t0 = performance.now(), segMs = duration / (n + 1), vGap = (binsTop - TOP_Y) / (n + 1);
            var lastPlinkedSeg = -1;
            function frame(now) {
              var el = now - t0;
              var seg = Math.min(n, Math.floor(el / segMs));
              var f = clampNum((el - seg * segMs) / segMs, 0, 1);
              if (seg > lastPlinkedSeg && seg < n) { lastPlinkedSeg = seg; playPlink(); }
              var eased = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
              var u = stops[seg] + (stops[Math.min(seg + 1, stops.length - 1)] - stops[seg]) * eased;
              var y = TOP_Y + (seg + f) * vGap;
              var hop = seg < n ? Math.sin(f * Math.PI) * Math.min(vGap, 46) * 0.5 : 0;
              drawBoard(bins, rows, el >= duration - segMs ? landBin : -1);
              drawToken(xForPos(u, rows), y - hop, rows);
              if (el < duration) { requestAnimationFrame(frame); }
              else {
                previewBusy = false;
                playWin();
                drawBoard(bins, rows, landBin);
                drawToken(xForPos(landBin, rows), binsTop + BINS_H / 2, rows);
                var mult = bins[landBin] ? bins[landBin].multiplier : 1;
                var added = Number(p.secondsAdded) || 0;
                dropStatus.textContent = (p.test ? 'Test landed on x' : 'Landed on x') + trimNum(mult) + (added > 0 ? '  (+' + added + 's)' : '');
              }
            }
            requestAnimationFrame(frame);
          }

          /* ---- wiring ---- */
          rowsInput.addEventListener('change', function () { rowsInput.value = currentRows(); renderBins(readBins()); renderColumns(); drawPreviewIdle(); });
          binsEditor.addEventListener('input', drawPreviewIdle);
          mirrorBtn.addEventListener('click', function () {
            var b = readBins(), n = b.length;
            for (var i = 0; i < Math.floor(n / 2); i++) { b[n - 1 - i] = { multiplier: b[i].multiplier, color: b[i].color }; }
            renderBins(b); drawPreviewIdle();
          });
          emotesBtn.addEventListener('click', function () { if (emoteGrid.hidden) loadEmotes(); else emoteGrid.hidden = true; });
          tokenClear.addEventListener('click', function () { setToken({}); });
          [stylePanel, stylePanelColor, stylePanelOpacity, stylePegs, stylePegColor, styleTextColor, styleShowStatus, stylePegSound, stylePegVol, styleWinSound, styleWinVol]
            .forEach(function (el) { el.addEventListener('input', drawPreviewIdle); });
          saveBtn.addEventListener('click', save);
          columnsWrap.addEventListener('click', function (e) {
            var btn = e.target.closest('button[data-col]'); if (!btn) return;
            dropColumn = parseInt(btn.getAttribute('data-col'), 10) || 0;
            renderColumns();
          });
          dropBtn.addEventListener('click', function () { drop({}); });
          randomBtn.addEventListener('click', function () { drop({ random: true }); });
          testBtn.addEventListener('click', function () { drop({ test: true }); });

          /* ---- live drop + queue stream (mirrors the OBS overlay) ---- */
          function renderQueue(snap) {
            if (!snap || (!snap.nowPlaying && !snap.waitingCount)) { queuePanel.hidden = true; return; }
            queuePanel.hidden = false;
            queueNow.textContent = snap.nowPlaying ? snap.nowPlaying.viewerName : '—';
            var names = (snap.waiting || []).map(function (w) { return '@' + w.viewerName; });
            var extra = (snap.waitingCount || 0) - names.length;
            queueNext.textContent = names.length
              ? 'Up next: ' + names.join(', ') + (extra > 0 ? ' +' + extra + ' more' : '') + '  (' + snap.waitingCount + ' waiting)'
              : '';
          }
          function connectPlinkoStream() {
            if (!overlayShareKey) return;
            var url = '/api/overlay/stream?key=' + encodeURIComponent(overlayShareKey) + '&boardId=' + encodeURIComponent(PLINKO_BOARD_ID);
            var es = new EventSource(url);
            es.addEventListener('plinko_drop', function (ev) {
              try { animatePreview(JSON.parse(ev.data)); } catch (e) {}
            });
            es.addEventListener('plinko_queue', function (ev) {
              try { renderQueue(JSON.parse(ev.data)); } catch (e) {}
            });
            es.addEventListener('error', function () { es.close(); setTimeout(connectPlinkoStream, 5000); });
          }
          copyBtn.addEventListener('click', function () {
            if (!overlayShareKey) { copyStatus.textContent = 'Set an overlay key first.'; return; }
            var cfg = { rows: currentRows(), bins: readBins(), token: pendingToken, style: readStyle() };
            var params = new URLSearchParams();
            params.set('key', overlayShareKey);
            params.set('boardId', PLINKO_BOARD_ID);
            params.set('config', encodeOptions(JSON.stringify(cfg)));
            var rel = plinkoOverlayBase + '?' + params.toString();
            var full = /^https?:/i.test(plinkoOverlayBase) ? rel : window.location.origin + rel;
            navigator.clipboard.writeText(full)
              .then(function () { copyStatus.textContent = 'Copied!'; })
              .catch(function () { copyStatus.textContent = 'Copy failed'; });
            setTimeout(function () { copyStatus.textContent = ''; }, 2500);
          });

          loadConfig();
          connectPlinkoStream();
        })();
      })();
    </script>
  </body>
</html>`;
}
