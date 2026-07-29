import {
  THEME_CSS_VARS,
  THEME_TOGGLE_STYLES,
  renderThemeBootstrapScript,
} from "./theme.js";
import { GLOBAL_HEADER_STYLES, renderGlobalHeader } from "./globalHeader.js";
import { renderFirebaseScript } from "./firebase.js";
import { VALID_TIERS, TIER_LABELS, DEFAULT_TIER } from "../tiers.js";

export function renderSoundConfigPage(options = {}) {
  const base = String(options.base || "");
  const adminName = String(options.adminName || "");
  const userKey = String(options.userKey || "");
  const apiBase = String(options.apiBase || "/api/sounds");
  // Klipy's key stays server-side (unlike Giphy, which required client-side
  // calls per their terms) — this just tells the client whether the GIF
  // search button should render at all.
  const klipyEnabled = Boolean(options.klipyEnabled);
  const ttsApiBase = String(options.ttsApiBase || "/api/tts/settings");
  const isAdminMode = Boolean(options.isAdminMode);
  const managedUserName = String(options.managedUserName || "");
  const delegateMode = Boolean(options.delegateMode);
  const managedByName = String(options.managedByName || "");
  const termsUrl = `${base}/terms`;
  const privacyUrl = `${base}/privacy`;
  const gdprUrl = `${base}/gdpr`;

  const showAdminLink = Boolean(options.showAdminLink);
  const isSuperAdmin = Boolean(options.isSuperAdmin);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>${isAdminMode ? `Admin: ${managedUserName} Sounds` : 'Sound Alerts'} – Livestreamer Hub</title>
    <link rel="icon" type="image/png" href="/assets/convertico-coin_24x24.png">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/driver.js@1.3.1/dist/driver.css"/>
    ${renderThemeBootstrapScript()}
    ${renderFirebaseScript()}
    <style>
      ${THEME_CSS_VARS}
      body { margin: 0; font-family: Inter, system-ui, Arial, sans-serif; background: var(--page-bg); color: var(--text-color); min-height: 100vh; display: flex; flex-direction: column; }
      main { flex: 1; width: min(1100px, 100%); margin: 32px auto 48px; padding: 0 20px; display: flex; gap: 24px; }
      .sidebar { width: 200px; flex-shrink: 0; position: sticky; top: 32px; align-self: flex-start; }
      .sidebar-nav { display: flex; flex-direction: column; gap: 2px; }
      .sidebar-nav-item { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; color: var(--text-muted); background: transparent; border: none; text-align: left; width: 100%; transition: background .15s, color .15s; font-family: inherit; }
      .sidebar-nav-item:hover { background: var(--surface-color); color: var(--text-color); box-shadow: none; filter: none; }
      .sidebar-nav-item.active { background: var(--accent-color); color: #fff; }
      .content-area { flex: 1; min-width: 0; max-width: 800px; }
      .section-page { display: none; }
      .section-page.active { display: block; }
      @media (max-width: 768px) {
        main { flex-direction: column; }
        .sidebar { width: 100%; position: static; }
        .sidebar-nav { flex-direction: row; overflow-x: auto; gap: 4px; padding-bottom: 4px; }
        .sidebar-nav-item { white-space: nowrap; padding: 8px 12px; font-size: 13px; }
        /* Floating "Take A Tour" FAB has no room to float clear of content
           on short mobile viewports — see overlayConfigPage.js for the
           matching fix and full reasoning. */
        .tour-btn { bottom: 12px; right: 12px; padding: 6px 10px; font-size: 12px; }
      }
      h1 { margin: 0 0 4px; font-size: 26px; }
      .subtitle { margin: 0 0 24px; color: var(--text-muted); font-size: 14px; }
      .card { background: var(--surface-color); border: 1px solid var(--surface-border); border-radius: 14px; padding: 20px; margin-bottom: 18px; }
      .card h2 { margin: 0 0 12px; font-size: 17px; }
      .library-search { width: 100%; box-sizing: border-box; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--input-border); background: var(--input-bg); color: var(--text-color); font-size: 14px; margin-bottom: 12px; }
      .library-search::placeholder { color: var(--text-muted); }
      .library-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; }
      .library-card { display: flex; flex-direction: column; align-items: center; padding: 8px 6px; border-radius: 10px; background: var(--surface-muted, #1a1a1e); border: 1px solid var(--surface-border, #303038); cursor: default; transition: background 0.15s, transform 0.1s; position: relative; }
      .library-card:hover { background: var(--surface-color, #2a2a32); transform: scale(1.03); }
      .library-card-thumb { width: 100%; padding-bottom: 100%; border-radius: 8px; position: relative; background: var(--code-bg, #0e0e10); overflow: hidden; margin-bottom: 6px; }
      .library-card-thumb-inner { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
      .library-card-thumb-inner img { width: 100%; height: 100%; object-fit: cover; }
      .library-card-thumb-inner img.fallback { width: 50%; height: 50%; object-fit: contain; opacity: 0.4; }
      .library-card-preview { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.5); border-radius: 8px; cursor: pointer; opacity: 0; transition: opacity 0.15s; }
      .library-card-thumb:hover .library-card-preview { opacity: 1; }
      .library-card-name { font-size: 12px; font-weight: 600; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; margin-bottom: 2px; }
      .library-card-owner { font-size: 11px; color: var(--text-muted); text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; margin-bottom: 6px; }
      .library-card-actions { display: flex; gap: 4px; width: 100%; }
      .library-card-actions button { flex: 1; font-size: 11px; padding: 4px 6px; }
      .library-filter-toggle { position: relative; }
      .library-filter-count { display: inline-block; background: var(--accent-color); color: #fff; border-radius: 10px; font-size: 10px; padding: 1px 6px; margin-left: 6px; }
      .library-filter-panel { display: none; flex-wrap: wrap; gap: 6px 14px; padding: 10px 12px; margin-bottom: 10px; border-radius: 8px; background: var(--surface-muted, #1a1a1e); border: 1px solid var(--surface-border, #303038); }
      .library-filter-panel.open { display: flex; }
      .library-tag-item { display: flex; align-items: center; gap: 5px; font-size: 12px; }
      .library-tag-item input { margin: 0; }
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
      .type-badge { display:inline-block; padding:1px 6px; border-radius:4px; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; margin-left:6px; }
      .type-badge.clip { background:rgba(145,70,255,0.15); color:#bf94ff; }
      .type-badge.video { background:rgba(0,180,120,0.15); color:#00c882; }
      .alert-row { display:flex; align-items:center; gap:10px; padding:8px 10px; border-bottom:1px solid var(--surface-border); font-size:13px; }
      .alert-row:last-child { border-bottom:none; }
      .alert-row .alert-time { color:var(--text-muted); font-size:11px; white-space:nowrap; min-width:60px; }
      .alert-row .alert-info { flex:1; min-width:0; }
      .alert-row .alert-name { font-weight:600; }
      .alert-row .alert-viewer { font-size:11px; color:var(--text-muted); }
      .alert-row .alert-msg { font-size:11px; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:300px; }
      .alert-row button { font-size:11px; padding:3px 8px; white-space:nowrap; }
      .overlay-online { color:#22c55e; }
      .overlay-offline { color:#ef4444; }
      .tour-btn { position: fixed; bottom: 20px; right: 20px; background: #9146ff; color: #fff; border: none; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; z-index: 100; opacity: 0.85; transition: opacity 0.15s; }
      .tour-btn:hover { opacity: 1; }
      ${THEME_TOGGLE_STYLES}
      ${GLOBAL_HEADER_STYLES}

      /* Floating extension promo */
      .ext-promo {
        position: fixed;
        right: 20px;
        top: 50%;
        transform: translateY(-50%);
        z-index: 90;
        width: 180px;
        background: var(--surface-color);
        border: 1px solid var(--surface-border);
        border-radius: 14px;
        padding: 16px 14px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.12);
        display: flex;
        flex-direction: column;
        gap: 10px;
        font-size: 12px;
        line-height: 1.4;
      }
      .ext-promo-title {
        font-weight: 700;
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .ext-promo a {
        display: block;
        text-align: center;
        padding: 7px 10px;
        border-radius: 8px;
        text-decoration: none;
        font-weight: 600;
        font-size: 12px;
        transition: filter .15s ease;
      }
      .ext-promo a:hover { filter: brightness(1.1); }
      .ext-promo .ext-link {
        background: #9146ff;
        color: #fff;
      }

      @media (max-width: 1100px) {
        .ext-promo { display: none; }
      }
      .global-footer { margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--surface-border); display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; font-size: 13px; color: var(--text-muted); }
      .global-footer a { color: var(--text-muted); text-decoration: none; }
      .global-footer a:hover { color: var(--accent-color); }

      /* Create Alert wizard modal */
      .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 20px; box-sizing: border-box; }
      .modal-box { background: var(--surface-color); border: 1px solid var(--surface-border); border-radius: 14px; width: 100%; max-width: 480px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; }
      .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--surface-border); flex-shrink: 0; }
      .modal-close { background: transparent; color: var(--text-muted); font-size: 20px; line-height: 1; padding: 4px 8px; border-radius: 6px; }
      .modal-close:hover { background: var(--surface-muted, #1a1a1e); color: var(--text-color); }
      .modal-body { padding: 20px; overflow-y: auto; flex: 1; }
      .modal-footer { display: flex; align-items: center; gap: 8px; padding: 14px 20px; border-top: 1px solid var(--surface-border); flex-shrink: 0; }
      .wizard-steps { display: flex; gap: 6px; }
      .wizard-step-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--surface-border); }
      .wizard-step-dot.active { background: var(--accent-color); width: 20px; border-radius: 4px; }
      .wizard-step-dot.done { background: var(--accent-color); opacity: 0.5; }
      .wizard-type-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; }
      .wizard-type-card { border: 1px solid var(--surface-border); border-radius: 10px; padding: 16px 10px; text-align: center; cursor: pointer; background: var(--surface-muted, #1a1a1e); font-size: 13px; font-weight: 600; }
      .wizard-type-card:hover { background: var(--surface-color); }
      .wizard-type-card.selected { border-color: var(--accent-color); background: rgba(145,70,255,0.12); }
      .wizard-type-card .icon { font-size: 26px; display: block; margin-bottom: 6px; }
      .wizard-thumb-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; max-height: 160px; overflow-y: auto; }
      .wizard-thumb-grid img { width: 44px; height: 44px; object-fit: cover; cursor: pointer; border-radius: 6px; border: 2px solid transparent; }
      .wizard-thumb-grid img:hover { border-color: var(--accent-color); }
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
      showManageLink: true,
    })}

    <!-- Floating extension promo -->
    <aside class="ext-promo">
      <div class="ext-promo-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9146ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        Twitch Extension
      </div>
      <div style="color:var(--text-muted);">Let viewers trigger sounds directly from your channel page.</div>
      <a class="ext-link" href="https://dashboard.twitch.tv/extensions/l7iuxz2tipmi4ly2g2vg5uzmdqkhx3-0.0.7" target="_blank" rel="noopener noreferrer">Install Extension</a>
    </aside>

    <main>
      <nav class="sidebar">
        <div class="sidebar-nav">
          <button class="sidebar-nav-item active" data-section="alerts">Alerts</button>
          <button class="sidebar-nav-item" data-section="create">Create Alert</button>
          <button class="sidebar-nav-item" data-section="library">Community Library</button>
          <button class="sidebar-nav-item" data-section="settings">Settings</button>
          <button class="sidebar-nav-item" data-section="tts">Text-to-Speech</button>
          <button class="sidebar-nav-item" data-section="queue">Queue</button>
          <button class="sidebar-nav-item" data-section="history">Alert History</button>
          <button class="sidebar-nav-item" data-section="activity">Activity</button>
          ${!delegateMode ? `<button class="sidebar-nav-item" data-section="delegates">Delegates</button>` : ''}
        </div>
      </nav>
      <div class="content-area">
      ${delegateMode ? `
      <div style="background:#f59e0b22; border:2px solid #f59e0b; border-radius:10px; padding:12px 18px; margin-bottom:16px; display:flex; align-items:center; gap:12px; font-size:13px; font-weight:500;">
        <span style="font-size:20px; flex-shrink:0;">⚠️</span>
        <div style="flex:1;">You are managing <strong>${managedByName}</strong>'s settings — changes will affect <strong>their</strong> channel, not yours.</div>
        <a href="/manage" style="flex-shrink:0; padding:5px 14px; border-radius:7px; background:#f59e0b; color:#000; font-size:12px; font-weight:700; text-decoration:none;">Switch Channel</a>
        <a href="/sounds/config?clearDelegate=1" style="flex-shrink:0; padding:5px 14px; border-radius:7px; border:1px solid #f59e0b; color:#f59e0b; font-size:12px; font-weight:600; text-decoration:none;">My Channel</a>
      </div>
      ` : ''}
      ${isAdminMode ? `
      <div style="background:#9146ff22; border:1px solid #9146ff55; border-radius:10px; padding:10px 16px; margin-bottom:16px; display:flex; align-items:center; gap:10px; font-size:13px;">
        <a href="/admin" style="color:#9146ff; text-decoration:none; font-weight:600;">&larr; Back to Dashboard</a>
        <span style="color:var(--text-muted);">|</span>
        <span>Managing sounds for <strong>${managedUserName}</strong></span>
      </div>
      <h1>Sound Alerts</h1>
      <p class="subtitle" style="margin-bottom:12px;">Admin: manage this broadcaster's sound alerts.</p>
      ` : `
      <h1>Sound Alerts</h1>
      <p class="subtitle" style="margin-bottom:12px;">Viewers use Bits to trigger sound alerts on your stream.</p>

      <!-- Browser Source URL (pinned at top) -->
      <div class="card" style="padding:12px 16px;">
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <button id="copySoundUrl" style="padding:5px 12px; font-size:12px; white-space:nowrap;">Copy URL</button>
          <code id="soundOverlayUrl" style="flex:1; min-width:0; font-size:12px; word-break:break-all; opacity:0.8;"></code>
        </div>
        <div class="hint" style="margin-top:4px;">Add as a Browser Source</div>
      </div>
      `}

      <!-- Live preview — a standing overlay connection so "Show in Preview" works
           immediately, without needing OBS or the real browser source open first.
           Lives outside the section-pages (visible on both Create Alert and
           Alerts, hidden elsewhere via switchSection) since it's equally useful
           while building a new alert as while managing existing ones. -->
      <div id="livePreviewWrap" class="card" style="padding:12px 16px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
          <strong style="font-size:13px;">Live Preview</strong>
          <span class="hint" style="margin:0;">This is what plays on your overlay — hit "Show in Preview" on any alert to see it here.</span>
        </div>
        <iframe id="soundLivePreview" allow="autoplay" referrerpolicy="no-referrer"
          style="width:100%; height:200px; border:1px solid var(--surface-border); border-radius:10px; background:#0b0b0e;"></iframe>
      </div>

      <div class="section-page" data-section="settings">
      <!-- Settings -->
      <div class="card" id="settingsCard">
        <h2>Settings</h2>
        <div id="settingsBody">
          <div class="grid-2col" style="gap:8px 20px;">
            <label style="display:flex; align-items:center; gap:8px; font-size:13px;">
              <input type="checkbox" id="soundEnabled" checked>
              Enabled
            </label>
            <label style="font-size:13px; display:flex; align-items:center; gap:8px;">
              Cooldown (sec)
              <input type="number" id="soundGlobalCooldown" min="0" max="60" value="3" style="width:60px">
            </label>
            <label style="font-size:13px; display:flex; align-items:center; gap:8px;">
              Global Volume
              <input type="range" id="soundGlobalVolume" min="0" max="100" value="100" style="width:100px">
              <span id="soundGlobalVolumeVal" style="font-size:12px; opacity:0.7;">100%</span>
            </label>
            <label style="font-size:13px; display:flex; align-items:center; gap:8px;">
              Max Queue
              <input type="number" id="soundMaxQueue" min="1" max="200" value="200" style="width:60px">
            </label>
            <label style="font-size:13px; display:flex; align-items:center; gap:8px; grid-column: 1 / -1;">
              Video/Clip Size
              <select id="videoSize" style="padding:3px 6px; border-radius:4px; border:1px solid #444; background:#1a1a1f; color:#efeff1; font-size:13px;">
                <option value="small">Small (640×360)</option>
                <option value="medium" selected>Medium (1280×720)</option>
                <option value="large">Large (1920×1080)</option>
                <option value="fullscreen">Fullscreen</option>
              </select>
            </label>
          </div>
          <div style="margin-top:10px;">
            <button id="saveSoundSettings">Save Settings</button>
            <span id="soundSettingsHint" class="hint" style="margin-left:8px;"></span>
          </div>
        </div>
      </div>
      </div>

      <div class="section-page" data-section="create">
      <!-- Create Alert -->
      <div class="card" id="createAlertCard">
        <h2>Create Alert</h2>
        <p class="hint" style="margin-bottom:14px;">A guided setup — pick a source, add a thumbnail, and set your Bits cost.</p>
        <button id="openCreateWizardBtn" style="padding:10px 22px; font-size:14px;">+ New Alert</button>
      </div>
      </div>

      <!-- Create Alert wizard -->
      <div id="createWizardBackdrop" class="modal-backdrop" style="display:none;">
        <div class="modal-box">
          <div class="modal-header">
            <div id="wizardStepIndicator" class="wizard-steps"></div>
            <button id="wizardCloseBtn" class="modal-close" type="button" aria-label="Close">&times;</button>
          </div>
          <div id="wizardBody" class="modal-body"></div>
          <div class="modal-footer">
            <span id="wizardHint" class="hint"></span>
            <div style="flex:1;"></div>
            <button id="wizardBackBtn" class="secondary" type="button" style="display:none;">Back</button>
            <button id="wizardNextBtn" type="button">Next</button>
          </div>
        </div>
      </div>

      <div class="section-page" data-section="library">
      <!-- Community Library -->
      <div class="card" id="libraryCard">
        <h2>Community Library</h2>
        <div id="libraryBody">
          <p class="hint" style="margin-bottom:12px;">Browse sounds shared by other streamers. Preview and add to your alerts.</p>
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:10px;">
            <input type="text" id="librarySearch" class="library-search" placeholder="Search by name, uploader, or tag..." style="flex:1; min-width:200px;" />
            <select id="librarySort" style="padding:6px 10px; border-radius:8px; border:1px solid var(--surface-border); background:var(--surface-muted); color:var(--text-color); font-size:13px;">
              <option value="newest">Newest</option>
              <option value="popular">Most Popular</option>
              <option value="trending">Trending (7d)</option>
            </select>
            <button type="button" id="libraryFilterToggle" class="secondary library-filter-toggle">Filters<span id="libraryFilterCount" class="library-filter-count" style="display:none;"></span></button>
          </div>
          <div id="libraryFilterPanel" class="library-filter-panel"></div>
          <div id="libraryList" class="library-grid">
            <div class="hint" style="grid-column: 1 / -1;">Loading library...</div>
          </div>
        </div>
      </div>
      </div>

      <div class="section-page active" data-section="alerts">
      <!-- Sound List -->
      <div class="card">
        <h2>Alerts (<span id="soundCount">0</span>/20) <span id="soundTestHint" class="hint" style="font-size:12px; margin-left:8px;"></span></h2>
        <div id="soundList" style="display:flex; flex-direction:column; gap:6px;">
          <div class="hint">Loading sounds…</div>
        </div>
      </div>
      </div>

      <div class="section-page" data-section="tts">
      <!-- TTS Settings -->
      <div class="card" id="ttsCard">
        <h2>Text-to-Speech</h2>
        <div id="ttsBody">
          <div id="ttsAccessHint" class="hint" style="margin-bottom:10px; display:none;">TTS requires a Pro plan or admin grant.</div>
          <div id="ttsSettings">
            <div class="grid-2col" style="gap:8px 20px;">
              <label style="display:flex; align-items:center; gap:8px; font-size:13px;">
                <input type="checkbox" id="ttsEnabled">
                Enabled
              </label>
              <label style="font-size:13px; display:flex; align-items:center; gap:8px;">
                Bits Cost
                <select id="ttsTier" style="min-width:100px;"></select>
              </label>
              <label style="font-size:13px; display:flex; align-items:center; gap:8px;">
                Volume
                <input type="range" id="ttsVolume" min="0" max="100" value="80" style="width:100px">
                <span id="ttsVolumeVal" style="font-size:12px; opacity:0.7;">80%</span>
              </label>
              <label style="font-size:13px; display:flex; align-items:center; gap:8px;">
                Cooldown (sec)
                <input type="number" id="ttsCooldown" min="0" max="120" value="10" style="width:60px">
              </label>
              <label style="font-size:13px; display:flex; align-items:center; gap:8px;">
                Max Message Length
                <input type="number" id="ttsMaxLength" min="1" max="300" value="200" style="width:60px">
              </label>
              <label style="display:flex; align-items:center; gap:8px; font-size:13px;">
                <input type="checkbox" id="ttsModeration" checked>
                Content Moderation
              </label>
            </div>

            <div style="margin-top:12px;">
              <label style="font-size:13px; font-weight:600; display:block; margin-bottom:6px;">Allowed Voices</label>
              <div id="ttsVoiceList" style="display:flex; flex-wrap:wrap; gap:6px;"></div>
            </div>

            <div style="margin-top:12px;">
              <label style="font-size:13px; font-weight:600; display:block; margin-bottom:4px;">Banned Words</label>
              <textarea id="ttsBannedWords" rows="2" placeholder="comma-separated: badword1, badword2" style="width:100%; max-width:400px; padding:6px 8px; border-radius:6px; border:1px solid var(--input-border); background:var(--input-bg); color:var(--text-color); font-size:12px; resize:vertical;"></textarea>
            </div>

            <div style="margin-top:12px;">
              <label style="font-size:13px; font-weight:600; display:block; margin-bottom:6px;">Test TTS</label>
              <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                <select id="ttsTestVoice" style="min-width:120px;"></select>
                <button id="ttsPreviewVoiceBtn" class="secondary" style="font-size:12px; padding:4px 10px;">Preview Voice</button>
              </div>
              <div style="display:flex; gap:6px; margin-top:6px; flex-wrap:wrap; align-items:center;">
                <input type="text" id="ttsTestMessage" placeholder="Test message..." maxlength="300" style="flex:1; min-width:150px; max-width:300px;">
                <button id="ttsTestBtn" style="font-size:12px; padding:4px 10px;">Send Test to Overlay</button>
                <button id="skipAlertBtn" style="font-size:12px; padding:4px 10px; background:#c0392b; color:#fff; border:none; border-radius:6px; cursor:pointer;">Skip Alert</button>
              </div>
              <span id="ttsTestHint" class="hint" style="margin-top:4px; display:block;"></span>
            </div>

            <div style="margin-top:12px;">
              <button id="saveTtsSettings">Save TTS Settings</button>
              <span id="ttsSettingsHint" class="hint" style="margin-left:8px;"></span>
            </div>
          </div>
        </div>
      </div>
      </div>

      <div class="section-page" data-section="queue">
      <div class="card" id="alertQueueCard">
        <h2>Alert Queue <span id="queueCount" style="font-size:13px; font-weight:400; color:var(--text-muted);"></span></h2>
        <p class="hint" style="margin-bottom:10px;">Alerts waiting to play on your overlay. Use Skip to remove an alert from the queue.</p>
        <div style="display:flex; gap:8px; margin-bottom:12px;">
          <button id="queueRefreshBtn" class="secondary" style="font-size:12px; padding:4px 10px;">Refresh</button>
          <button id="queueSkipAllBtn" class="secondary" style="font-size:12px; padding:4px 10px; color:#ef4444; border-color:#ef4444;">Skip All</button>
        </div>
        <div id="alertQueueList"></div>
        <div id="alertQueueEmpty" class="hint" style="display:none;">Queue is empty.</div>
      </div>
      </div>

      <div class="section-page" data-section="history">
      <!-- Alert History -->
      <div class="card" id="alertHistoryCard">
        <h2>Alert History</h2>
        <div style="display:flex; gap:8px; align-items:center; margin-bottom:10px; flex-wrap:wrap;">
          <div id="overlayStatus" style="font-size:12px; color:var(--text-muted);">Overlay: checking...</div>
          <button id="refreshHistory" class="secondary" style="font-size:12px; padding:4px 10px;">Refresh</button>
        </div>
        <p class="hint" style="margin-bottom:8px;">Recent alerts from viewers. Replay any alert that may not have played (e.g. overlay was closed).</p>
        <div id="alertHistoryList" style="max-height:400px; overflow-y:auto;"></div>
        <div id="alertHistoryEmpty" class="hint" style="display:none;">No alerts yet.</div>
      </div>
      </div>

      <div class="section-page" data-section="activity">
      <!-- Activity: top sounds & top viewers, last 30 days -->
      <div class="grid-2col" style="gap:20px;">
        <div class="card">
          <h2>Top Sounds <span class="hint" style="font-size:11px;">(last 30 days)</span></h2>
          <div id="activityTopSounds"><div class="hint">Loading...</div></div>
        </div>
        <div class="card">
          <h2>Top Viewers <span class="hint" style="font-size:11px;">(last 30 days)</span></h2>
          <div id="activityTopViewers"><div class="hint">Loading...</div></div>
        </div>
      </div>
      </div>

      ${!delegateMode ? `
      <div class="section-page" data-section="delegates">
      <div class="card">
        <h2>Delegates</h2>
        <p class="hint" style="margin-bottom:14px;">Delegates can manage your Sound Alerts, Timer Rules, and Goals settings. Add a Twitch username below. They must log in at <strong>livestreamerhub.com</strong> and navigate to <strong>Manage Channels</strong>.</p>
        <div style="display:flex; gap:8px; margin-bottom:18px;">
          <input type="text" id="delegateLoginInput" placeholder="Twitch username" style="flex:1; padding:8px 12px; border-radius:8px; border:1px solid var(--surface-border); background:var(--surface-muted); color:var(--text-color); font-size:13px;">
          <button id="delegateAddBtn" class="btn-save" style="padding:8px 16px;">Add</button>
          <span id="delegateAddStatus" style="align-self:center; font-size:12px; display:none;"></span>
        </div>
        <div id="delegateList"><div class="empty-state">Loading...</div></div>
      </div>
      </div>
      ` : ''}

      </div><!-- /content-area -->
    </main>
    <footer class="global-footer">
      <a href="${termsUrl}">Terms of Service</a>
      <a href="${privacyUrl}">Privacy Policy</a>
      <a href="${gdprUrl}">GDPR / UK GDPR Disclosure</a>
      <a href="https://discord.gg/nwu4w5cUVd" target="_blank" rel="noopener noreferrer"><svg style="width:14px;height:14px;fill:currentColor;vertical-align:-2px;margin-right:3px" viewBox="0 0 127.14 96.36"><path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0 105.89 105.89 0 0 0 19.39 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2.03a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2.03a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69C36.18 65.69 31 60 31 53.05s5-12.68 11.45-12.68S54 46.09 53.89 53.05 48.84 65.69 42.45 65.69Zm42.24 0C78.41 65.69 73.25 60 73.25 53.05s5-12.68 11.44-12.68S96.23 46.09 96.12 53.05 91.08 65.69 84.69 65.69Z"/></svg>Discord</a>
    </footer>

    <script>
      (function() {
        var USER_KEY = ${JSON.stringify(userKey)};
        var KLIPY_ENABLED = ${JSON.stringify(klipyEnabled)};
        var API_BASE = ${JSON.stringify(apiBase)};
        var TTS_API_BASE = ${JSON.stringify(ttsApiBase)};
        var IS_ADMIN_MODE = ${JSON.stringify(isAdminMode)};
        var IS_SUPER_ADMIN = ${JSON.stringify(isSuperAdmin)};

        function setBusy(btn, busy) { if (!btn) return; btn.disabled = !!busy; }
        function flashButton(btn) { if (!btn) return; btn.classList.add('btn-click'); setTimeout(function() { btn.classList.remove('btn-click'); }, 160); }

        // First-party analytics for this surface (see ebs/routes_analytics.js
        // and extension/src/firebase.js for the extension-panel equivalent).
        // Skipped in admin mode so a super-admin browsing someone else's
        // sounds for support doesn't get counted as that broadcaster's own
        // setup funnel activity.
        function logDashboardEvent(event, params) {
          if (IS_ADMIN_MODE) return;
          try {
            fetch('/api/analytics/dashboard-event', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ event: event, surface: 'dashboard', params: params || {} }),
              keepalive: true,
            }).catch(function() {});
          } catch (e) {}
        }

        var TIER_LABELS = ${JSON.stringify(TIER_LABELS)};

        var soundListEl = document.getElementById('soundList');
        var soundCountEl = document.getElementById('soundCount');
        var soundTestHintEl = document.getElementById('soundTestHint');
        var soundPreviewAudio = null;
        var soundPreviewAudioUrl = null;
        var soundPreviewBtn = null;

        function stopSoundPreview() {
          if (soundPreviewAudio) { soundPreviewAudio.pause(); soundPreviewAudio = null; }
          if (soundPreviewAudioUrl) { URL.revokeObjectURL(soundPreviewAudioUrl); soundPreviewAudioUrl = null; }
          if (soundPreviewBtn) { soundPreviewBtn.textContent = 'Listen'; soundPreviewBtn = null; }
        }
        var soundEnabledEl = document.getElementById('soundEnabled');
        var soundGlobalVolumeEl = document.getElementById('soundGlobalVolume');
        var soundGlobalVolumeValEl = document.getElementById('soundGlobalVolumeVal');
        var soundGlobalCooldownEl = document.getElementById('soundGlobalCooldown');
        var soundMaxQueueEl = document.getElementById('soundMaxQueue');
        var videoSizeEl = document.getElementById('videoSize');
        var saveSoundSettingsBtn = document.getElementById('saveSoundSettings');
        var soundSettingsHintEl = document.getElementById('soundSettingsHint');

        // Set OBS overlay URL
        var soundUrlEl = document.getElementById('soundOverlayUrl');
        var soundLivePreviewEl = document.getElementById('soundLivePreview');
        if (soundUrlEl) {
          var p = new URLSearchParams();
          if (USER_KEY) p.set('key', USER_KEY);
          var overlayFullUrl = window.location.origin + '/overlay/sounds' + (p.toString() ? ('?' + p.toString()) : '');
          soundUrlEl.textContent = overlayFullUrl;
          if (soundLivePreviewEl) soundLivePreviewEl.src = overlayFullUrl;
        }

        if (soundGlobalVolumeEl) soundGlobalVolumeEl.addEventListener('input', function() {
          if (soundGlobalVolumeValEl) soundGlobalVolumeValEl.textContent = this.value + '%';
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

        // Sidebar section navigation
        function switchSection(sectionId) {
          document.querySelectorAll('.section-page').forEach(function(el) {
            el.classList.toggle('active', el.getAttribute('data-section') === sectionId);
          });
          document.querySelectorAll('.sidebar-nav-item').forEach(function(el) {
            el.classList.toggle('active', el.getAttribute('data-section') === sectionId);
          });
          var livePreviewWrapEl = document.getElementById('livePreviewWrap');
          if (livePreviewWrapEl) {
            livePreviewWrapEl.style.display = (sectionId === 'alerts' || sectionId === 'create') ? '' : 'none';
          }
        }
        document.querySelectorAll('.sidebar-nav-item').forEach(function(btn) {
          btn.addEventListener('click', function() {
            switchSection(btn.getAttribute('data-section'));
            history.replaceState(null, '', '#' + btn.getAttribute('data-section'));
          });
        });

        // Deep-link support: /sounds/config#library lands directly on that
        // section instead of always defaulting to "alerts".
        (function() {
          var requested = (window.location.hash || '').replace('#', '');
          var validSections = Array.prototype.map.call(
            document.querySelectorAll('.section-page'),
            function(el) { return el.getAttribute('data-section'); }
          );
          if (requested && validSections.indexOf(requested) !== -1) {
            switchSection(requested);
          }
        })();

        var soundsCache = [];
        // Read by the Create Alert wizard's Step 1 to decide whether to show
        // the Clip/Video type cards at all (same gate the old tabs used).
        var videoClipsEnabled = false;

        async function fetchSoundsAdmin() {
          try {
            var r = await fetch(API_BASE, { cache: 'no-store' });
            var data = await r.json();
            soundsCache = data.sounds || [];
            var settings = data.settings || {};
            if (soundEnabledEl) soundEnabledEl.checked = settings.enabled !== false;
            if (soundGlobalVolumeEl) { soundGlobalVolumeEl.value = settings.globalVolume ?? 100; if (soundGlobalVolumeValEl) soundGlobalVolumeValEl.textContent = soundGlobalVolumeEl.value + '%'; }
            if (soundGlobalCooldownEl) soundGlobalCooldownEl.value = Math.round((settings.globalCooldownMs || 3000) / 1000);
            if (soundMaxQueueEl) soundMaxQueueEl.value = settings.maxQueueSize ?? 5;
            if (videoSizeEl) videoSizeEl.value = settings.videoSize || 'medium';
            videoClipsEnabled = settings.videoClipsEnabled || false;
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

        // After the Create Alert wizard finishes, jump to the Alerts page and
        // scroll the new card into view — the wizard itself already covers
        // thumbnail + settings, so unlike the old inline forms this doesn't
        // need to also pop the full edit form open.
        async function revealNewSound(soundId) {
          await fetchSoundsAdmin();
          // The sound list lives on the "Alerts" page, a separate section-page
          // from "Create Alert" — without switching, the new card exists but
          // sits inside a display:none container the user never sees.
          switchSection('alerts');
          history.replaceState(null, '', '#alerts');
          var card = soundListEl ? soundListEl.querySelector('[data-sound-id="' + soundId + '"]') : null;
          if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // Same as revealNewSound, but for "Add & Trim" from the library —
        // also opens the editor with the trim panel already expanded so
        // trimming reads as one step from the picker instead of two.
        async function revealNewSoundForTrim(soundId) {
          await fetchSoundsAdmin();
          switchSection('alerts');
          history.replaceState(null, '', '#alerts');
          var card = soundListEl ? soundListEl.querySelector('[data-sound-id="' + soundId + '"]') : null;
          if (!card) return;
          var s = soundsCache.find(function(x) { return x.id === soundId; });
          if (!s) return;
          openSoundEditor(s, card, true);
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
            card.style.cssText = 'display:flex; align-items:center; gap:10px; padding:8px 10px; background:var(--surface-muted,#1a1a1e); border-radius:8px; border:1px solid var(--border,#303038); flex-wrap:wrap;';
            card.setAttribute('data-sound-id', s.id);

            // Image thumbnail
            var thumb = document.createElement('div');
            thumb.style.cssText = 'width:40px; height:40px; border-radius:6px; overflow:hidden; flex-shrink:0; background:var(--surface-color,#1f1f23); display:flex; align-items:center; justify-content:center;';
            if (s.imageFilename) {
              var img = document.createElement('img');
              img.src = API_BASE + '/' + encodeURIComponent(s.id) + '/image';
              img.alt = '';
              img.style.cssText = 'width:100%; height:100%; object-fit:cover;';
              img.onerror = function() { this.style.display = 'none'; };
              thumb.appendChild(img);
            } else {
              var defaultImg = document.createElement('img');
              defaultImg.alt = '';
              defaultImg.style.cssText = 'width:60%; height:60%; object-fit:contain; opacity:0.5;';
              var sType = s.type || 'sound';
              if (sType === 'video') {
                defaultImg.src = '/assets/icons/camera_icon.png';
              } else {
                defaultImg.src = '/assets/icons/megaphone.png';
              }
              thumb.appendChild(defaultImg);
            }
            card.appendChild(thumb);

            var info = document.createElement('div');
            info.className = 'sound-info';
            // min-width:0 (not a fixed floor) would let this shrink to a
            // sliver instead of ever triggering the card's flex-wrap below —
            // the controls group (checkbox + 4 buttons) has flex-shrink:0 and
            // won't shrink itself, so without a real floor here the name/meta
            // text was the only thing giving, wrapping mid-phrase into an
            // unreadably narrow column on mobile.
            info.style.cssText = 'flex:1; min-width:140px;';

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

            // Shared / moderation status badge
            if (s.shared) {
              var sharedBadge = document.createElement('span');
              sharedBadge.style.cssText = 'display:inline-block; padding:1px 6px; border-radius:4px; font-size:10px; font-weight:600; letter-spacing:0.04em; margin-left:6px;';
              if (s.moderationStatus === 'pending') {
                sharedBadge.style.background = 'rgba(245,158,11,0.15)';
                sharedBadge.style.color = '#f59e0b';
                sharedBadge.textContent = 'PENDING REVIEW';
              } else {
                sharedBadge.style.background = 'rgba(34,197,94,0.15)';
                sharedBadge.style.color = '#22c55e';
                sharedBadge.textContent = 'SHARED';
              }
              nameDiv.appendChild(sharedBadge);
            } else if (s.moderationStatus === 'rejected') {
              var rejectedBadge = document.createElement('span');
              rejectedBadge.style.cssText = 'display:inline-block; padding:1px 6px; border-radius:4px; font-size:10px; font-weight:600; letter-spacing:0.04em; margin-left:6px; background:rgba(220,38,38,0.15); color:#dc2626;';
              rejectedBadge.textContent = 'REJECTED';
              nameDiv.appendChild(rejectedBadge);
            }

            var metaDiv = document.createElement('div');
            metaDiv.style.cssText = 'font-size:12px; opacity:0.6;';
            var tierText = s.tier ? (TIER_LABELS[s.tier] || s.tier) : 'No Bits';
            var metaText = tierText + ' \\u00b7 Vol ' + s.volume + '%';
            if (s.channelPointsEnabled) metaText += ' \\u00b7 ' + s.channelPointsCost + ' Points';
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
            testBtn.textContent = 'Show in Preview';
            testBtn.title = 'Plays this alert in the Live Preview panel above, exactly as viewers would see it';
            testBtn.className = 'secondary';
            testBtn.style.cssText = 'font-size:12px; padding:3px 8px;';
            testBtn.addEventListener('click', async function() {
              flashButton(testBtn);
              setBusy(testBtn, true);
              if (soundTestHintEl) soundTestHintEl.textContent = '';
              try {
                var statusRes = await fetch('/api/overlay/status');
                var statusData = await statusRes.json().catch(function() { return {}; });
                if (!statusData.connected) {
                  if (soundTestHintEl) soundTestHintEl.textContent = 'Live Preview still connecting — try again in a moment.';
                  setBusy(testBtn, false);
                  return;
                }
                var r = await fetch(API_BASE + '/test/' + encodeURIComponent(s.id), { method: 'POST' });
                if (!r.ok) throw new Error();
                if (soundTestHintEl) {
                  soundTestHintEl.textContent = 'Playing in Live Preview!';
                  setTimeout(function() { soundTestHintEl.textContent = ''; }, 2500);
                }
              } catch (e) {
                if (soundTestHintEl) soundTestHintEl.textContent = 'Couldn\\'t send to Live Preview';
              }
              setBusy(testBtn, false);
            });

            var previewBtn = null;
            if ((s.type || 'sound') === 'sound') {
              previewBtn = document.createElement('button');
              previewBtn.textContent = 'Listen';
              previewBtn.title = 'Quickly plays the raw audio file in your browser only — not the actual alert';
              previewBtn.className = 'secondary';
              previewBtn.style.cssText = 'font-size:12px; padding:3px 8px;';
              previewBtn.addEventListener('click', function() {
                var isPlaying = soundPreviewBtn === previewBtn;
                stopSoundPreview();
                if (isPlaying) return;
                // Play directly against the API URL (no fetch/blob) so the browser's
                // native media loading handles the redirect to storage — fetch()+blob
                // would require CORS on the storage response, which media playback does not.
                soundPreviewAudio = new Audio(API_BASE + '/' + encodeURIComponent(s.id) + '/audio');
                soundPreviewBtn = previewBtn;
                previewBtn.textContent = '\\u25A0 Stop';
                soundPreviewAudio.onended = stopSoundPreview;
                soundPreviewAudio.onerror = function() {
                  stopSoundPreview();
                  if (soundTestHintEl) soundTestHintEl.textContent = 'Listen failed';
                };
                soundPreviewAudio.play().catch(function() { stopSoundPreview(); });
              });
            }

            var delBtn = document.createElement('button');
            delBtn.textContent = 'Del';
            delBtn.className = 'danger';
            delBtn.style.cssText = 'font-size:12px; padding:3px 8px; color:#fff; border:none; border-radius:4px; cursor:pointer;';
            delBtn.addEventListener('click', function() { deleteSoundAdmin(s.id, delBtn); });

            controls.appendChild(toggle);
            controls.appendChild(editBtn);
            if (previewBtn) controls.appendChild(previewBtn);
            controls.appendChild(testBtn);
            controls.appendChild(delBtn);
            card.appendChild(controls);

            soundListEl.appendChild(card);
          });
        }

        // ===== Community Library =====
        var libraryAudio = null;
        var libraryAudioUrl = null;
        var librarySounds = [];
        // Tags checked in the filter panel — persists across re-fetches
        // (sort changes, adding a sound) so the facet selection doesn't
        // reset out from under someone mid-browse.
        var selectedTags = new Set();

        async function fetchLibrary() {
          try {
            var sort = librarySortEl ? librarySortEl.value : 'newest';
            var r = await fetch(API_BASE + '/library?sort=' + encodeURIComponent(sort), { cache: 'no-store' });
            var data = await r.json();
            librarySounds = data.sounds || [];
            renderTagFacets();
            applyLibraryFilter();
          } catch (e) {
            var el = document.getElementById('libraryList');
            if (el) { el.textContent = ''; var h = document.createElement('div'); h.className = 'hint'; h.style.gridColumn = '1 / -1'; h.textContent = 'Failed to load library'; el.appendChild(h); }
          }
        }

        var librarySortEl = document.getElementById('librarySort');
        if (librarySortEl) {
          librarySortEl.addEventListener('change', function() { fetchLibrary(); });
        }

        function applyLibraryFilter() {
          var searchInput = document.getElementById('librarySearch');
          var q = searchInput ? searchInput.value.trim().toLowerCase() : '';
          var filtered = librarySounds.filter(function(s) {
            var matchesSearch = !q ||
                   (s.name || '').toLowerCase().indexOf(q) !== -1 ||
                   (s.ownerDisplayName || '').toLowerCase().indexOf(q) !== -1 ||
                   (s.tags || []).some(function(t) { return t.toLowerCase().indexOf(q) !== -1; });
            if (!matchesSearch) return false;
            if (selectedTags.size === 0) return true;
            // Matches ANY checked tag (not all) — narrowing to sounds with
            // every checked tag would empty-result too easily since sounds
            // only carry up to 5 free-text tags each.
            return (s.tags || []).some(function(t) { return selectedTags.has((t || '').toLowerCase()); });
          });
          renderLibraryList(filtered);
        }

        // Faceted tag filter panel — built from whatever tags actually
        // appear in the currently loaded library (tags are free-text, no
        // fixed taxonomy), so it only ever offers choices with real results.
        function renderTagFacets() {
          var panel = document.getElementById('libraryFilterPanel');
          if (!panel) return;
          var counts = {};
          librarySounds.forEach(function(s) {
            (s.tags || []).forEach(function(t) {
              var tag = (t || '').toLowerCase().trim();
              if (!tag) return;
              counts[tag] = (counts[tag] || 0) + 1;
            });
          });
          var tags = Object.keys(counts).sort(function(a, b) { return counts[b] - counts[a] || a.localeCompare(b); });
          // Drop selections for tags that no longer appear in this fetch.
          Array.from(selectedTags).forEach(function(t) { if (!counts[t]) selectedTags.delete(t); });
          panel.textContent = '';
          if (!tags.length) {
            var hint = document.createElement('div');
            hint.className = 'hint';
            hint.textContent = 'No tags yet.';
            panel.appendChild(hint);
          } else {
            tags.forEach(function(tag) {
              var label = document.createElement('label');
              label.className = 'library-tag-item';
              var cb = document.createElement('input');
              cb.type = 'checkbox';
              cb.checked = selectedTags.has(tag);
              cb.addEventListener('change', function() {
                if (cb.checked) selectedTags.add(tag); else selectedTags.delete(tag);
                updateLibraryFilterBadge();
                applyLibraryFilter();
              });
              label.appendChild(cb);
              label.appendChild(document.createTextNode(tag + ' (' + counts[tag] + ')'));
              panel.appendChild(label);
            });
          }
          updateLibraryFilterBadge();
        }

        function updateLibraryFilterBadge() {
          var badge = document.getElementById('libraryFilterCount');
          if (!badge) return;
          if (selectedTags.size > 0) {
            badge.textContent = String(selectedTags.size);
            badge.style.display = 'inline-block';
          } else {
            badge.style.display = 'none';
          }
        }

        // Search/filter
        (function() {
          var searchInput = document.getElementById('librarySearch');
          var debounceTimer = null;
          if (searchInput) {
            searchInput.addEventListener('input', function() {
              clearTimeout(debounceTimer);
              debounceTimer = setTimeout(applyLibraryFilter, 200);
            });
          }
          var filterToggle = document.getElementById('libraryFilterToggle');
          var filterPanel = document.getElementById('libraryFilterPanel');
          if (filterToggle && filterPanel) {
            filterToggle.addEventListener('click', function() {
              filterPanel.classList.toggle('open');
            });
          }
        })();

        function stopLibraryPreview() {
          if (libraryAudio) { libraryAudio.pause(); libraryAudio = null; }
          if (libraryAudioUrl) { URL.revokeObjectURL(libraryAudioUrl); libraryAudioUrl = null; }
          document.querySelectorAll('.library-card-preview span').forEach(function(el) { el.textContent = '\\u25B6'; });
        }

        function renderLibraryList(sounds) {
          var listEl = document.getElementById('libraryList');
          if (!listEl) return;
          listEl.textContent = '';
          if (!sounds.length) {
            var empty = document.createElement('div');
            empty.className = 'hint';
            empty.style.gridColumn = '1 / -1';
            empty.textContent = 'No shared sounds yet. Upload a sound and share it to see it here!';
            listEl.appendChild(empty);
            return;
          }
          sounds.forEach(function(s) {
            var card = document.createElement('div');
            card.className = 'library-card';

            // Square thumbnail with preview overlay
            var thumb = document.createElement('div');
            thumb.className = 'library-card-thumb';
            var thumbInner = document.createElement('div');
            thumbInner.className = 'library-card-thumb-inner';
            if (s.hasImage) {
              var img = document.createElement('img');
              img.src = API_BASE + '/library/' + encodeURIComponent(s.ownerUserId) + '/' + encodeURIComponent(s.id) + '/image';
              img.alt = s.name;
              img.onerror = function() { this.className = 'fallback'; this.src = '/assets/icons/megaphone.png'; };
              thumbInner.appendChild(img);
            } else {
              var fallbackImg = document.createElement('img');
              fallbackImg.className = 'fallback';
              fallbackImg.src = '/assets/icons/megaphone.png';
              fallbackImg.alt = '';
              thumbInner.appendChild(fallbackImg);
            }
            thumb.appendChild(thumbInner);

            // Preview play overlay
            var previewOverlay = document.createElement('div');
            previewOverlay.className = 'library-card-preview';
            var playIcon = document.createElement('span');
            playIcon.style.cssText = 'font-size:18px; color:#fff;';
            playIcon.textContent = '\\u25B6';
            previewOverlay.appendChild(playIcon);
            previewOverlay.addEventListener('click', function(e) {
              e.stopPropagation();
              var isPlaying = libraryAudio && playIcon.textContent === '\\u25A0';
              stopLibraryPreview();
              if (isPlaying) return;
              // Play directly against the API URL (no fetch/blob) so the browser's
              // native media loading handles the redirect to storage — fetch()+blob
              // would require CORS on the storage response, which media playback does not.
              libraryAudio = new Audio(API_BASE + '/library/' + encodeURIComponent(s.ownerUserId) + '/' + encodeURIComponent(s.id) + '/preview');
              libraryAudio.volume = 0.5;
              playIcon.textContent = '\\u25A0';
              libraryAudio.onended = function() { playIcon.textContent = '\\u25B6'; };
              libraryAudio.onerror = function() { stopLibraryPreview(); };
              libraryAudio.play().catch(function() { stopLibraryPreview(); });
            });
            thumb.appendChild(previewOverlay);
            card.appendChild(thumb);

            // Sound name
            var nameDiv = document.createElement('div');
            nameDiv.className = 'library-card-name';
            nameDiv.textContent = s.name;
            nameDiv.title = s.name;
            card.appendChild(nameDiv);

            // Uploader name
            var ownerDiv = document.createElement('div');
            ownerDiv.className = 'library-card-owner';
            ownerDiv.textContent = s.ownerDisplayName || 'Unknown';
            card.appendChild(ownerDiv);

            // Tags
            if (s.tags && s.tags.length) {
              var tagsDiv = document.createElement('div');
              tagsDiv.style.cssText = 'font-size:11px; color:var(--text-muted); margin-top:2px;';
              tagsDiv.textContent = s.tags.join(', ');
              card.appendChild(tagsDiv);
            }

            // Add / Add & Trim — addArea is its own sub-container so it can
            // be wiped and re-rendered (rename step <-> buttons <-> "Added")
            // without disturbing the admin Delete button appended to
            // actions below.
            var actions = document.createElement('div');
            actions.className = 'library-card-actions';
            var addArea = document.createElement('div');
            addArea.style.cssText = 'display:flex; gap:6px; flex-wrap:wrap; align-items:center;';
            actions.appendChild(addArea);

            function renderAdded() {
              addArea.textContent = '';
              var addedBtn = document.createElement('button');
              addedBtn.className = 'secondary';
              addedBtn.textContent = 'Added';
              addedBtn.disabled = true;
              addedBtn.style.opacity = '0.5';
              addArea.appendChild(addedBtn);
            }

            function renderAddButtons() {
              addArea.textContent = '';
              var addBtn = document.createElement('button');
              addBtn.textContent = 'Add';
              var addTrimBtn = document.createElement('button');
              addTrimBtn.className = 'secondary';
              addTrimBtn.textContent = 'Add & Trim';
              addTrimBtn.style.cssText = 'font-size:12px;';
              addBtn.addEventListener('click', function() { renderRenameStep(false); });
              addTrimBtn.addEventListener('click', function() { renderRenameStep(true); });
              addArea.appendChild(addBtn);
              addArea.appendChild(addTrimBtn);
            }

            // Shared inline rename step for both Add and Add & Trim — lets a
            // streamer rename their copy before it's created rather than
            // having to find it again afterward in their own sound list.
            // Only touches the new copy's own name field (sounds_store.js
            // copySoundToUser), never the shared library original.
            function renderRenameStep(openTrimAfter) {
              addArea.textContent = '';
              var nameInput = document.createElement('input');
              nameInput.type = 'text';
              nameInput.value = s.name;
              nameInput.maxLength = 100;
              nameInput.style.cssText = 'width:140px; font-size:12px; padding:3px 6px;';

              var confirmBtn = document.createElement('button');
              confirmBtn.textContent = openTrimAfter ? 'Add & Trim' : 'Add';
              confirmBtn.style.cssText = 'font-size:12px; padding:3px 8px;';

              var cancelBtn = document.createElement('button');
              cancelBtn.className = 'secondary';
              cancelBtn.textContent = 'Cancel';
              cancelBtn.style.cssText = 'font-size:12px; padding:3px 8px;';
              cancelBtn.addEventListener('click', renderAddButtons);

              confirmBtn.addEventListener('click', async function() {
                flashButton(confirmBtn);
                setBusy(confirmBtn, true);
                try {
                  var r = await fetch(API_BASE + '/library/add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ownerUserId: s.ownerUserId, soundId: s.id, name: nameInput.value })
                  });
                  var data = await r.json().catch(function() { return {}; });
                  if (!r.ok) throw new Error(data.error || 'Failed to add');
                  s.owned = true;
                  renderAdded();
                  // Counts toward the setup funnel's "created an alert" step
                  // alongside sound_uploaded/clip_created/video_uploaded —
                  // someone who only ever adds from the library, never
                  // uploads their own file, should still read as having
                  // completed setup.
                  logDashboardEvent('sound_added_from_library', { openTrimAfter: openTrimAfter });
                  if (openTrimAfter && data.sound && data.sound.id) {
                    await revealNewSoundForTrim(data.sound.id);
                  } else {
                    await fetchSoundsAdmin();
                  }
                } catch (err) {
                  addArea.textContent = '';
                  var errBtn = document.createElement('button');
                  errBtn.className = 'secondary';
                  errBtn.textContent = err.message || 'Error';
                  addArea.appendChild(errBtn);
                  setTimeout(renderAddButtons, 2000);
                }
                setBusy(confirmBtn, false);
              });

              addArea.appendChild(nameInput);
              addArea.appendChild(confirmBtn);
              addArea.appendChild(cancelBtn);
            }

            if (s.owned) renderAdded(); else renderAddButtons();
            if (IS_SUPER_ADMIN) {
              var delBtn = document.createElement('button');
              delBtn.className = 'secondary';
              delBtn.textContent = 'Delete';
              delBtn.title = 'Remove from library (admin)';
              delBtn.style.cssText = 'color:#ef4444; border-color:#ef4444;';
              delBtn.addEventListener('click', async function() {
                if (!confirm('Delete "' + s.name + '" from the library? This removes the sound from the uploader\\'s account permanently.')) return;
                flashButton(delBtn);
                setBusy(delBtn, true);
                try {
                  var r = await fetch('/api/sounds/library/' + encodeURIComponent(s.ownerUserId) + '/' + encodeURIComponent(s.id), {
                    method: 'DELETE',
                    credentials: 'same-origin'
                  });
                  if (!r.ok) {
                    var errData = {};
                    try { errData = await r.json(); } catch(e) {}
                    throw new Error(errData.error || 'Delete failed (' + r.status + ')');
                  }
                  card.remove();
                  librarySounds = librarySounds.filter(function(x) { return !(x.ownerUserId === s.ownerUserId && x.id === s.id); });
                } catch (err) {
                  delBtn.textContent = err.message || 'Error';
                  setTimeout(function() { delBtn.textContent = 'Delete'; }, 3000);
                }
                setBusy(delBtn, false);
              });
              actions.appendChild(delBtn);
            }
            card.appendChild(actions);

            listEl.appendChild(card);
          });
        }

        // Pick a thumbnail from an emote source instead of uploading a file
        // — automatically on-brand, zero design effort. Shared by both the
        // Twitch and 7TV pickers, and by both the per-sound editor and the
        // Create Alert wizard's thumbnail step (only the target soundId,
        // hint element, and post-set callback differ between callers).
        // panelGroup (optional) is an array shared across every picker in
        // the same image-source row — pushing this panel onto it lets each
        // picker close its siblings on open, so only one is ever visible at
        // once instead of stacking Twitch + 7TV + GIF panels on top of
        // each other.
        function createEmotePicker(label, fetchUrl, soundId, hintEl, onSet, panelGroup) {
          var btn = document.createElement('button');
          btn.textContent = label;
          btn.className = 'secondary';
          btn.style.cssText = 'font-size:12px; padding:3px 8px;';

          var panel = document.createElement('div');
          panel.style.cssText = 'display:none; flex-direction:column; gap:6px; margin-top:6px; max-height:160px; overflow-y:auto; padding:6px; border:1px solid var(--border,#303038); border-radius:6px;';
          if (panelGroup) panelGroup.push(panel);

          var loaded = false;
          btn.addEventListener('click', async function() {
            var isOpen = panel.style.display !== 'none';
            if (panelGroup) panelGroup.forEach(function(p) { if (p !== panel) p.style.display = 'none'; });
            if (isOpen) { panel.style.display = 'none'; return; }
            panel.style.display = 'flex';
            if (loaded) return;
            panel.textContent = 'Loading…';
            try {
              var r = await fetch(fetchUrl);
              var body = await r.json().catch(function() { return {}; });
              var emotes = body.emotes || [];
              panel.textContent = '';
              if (body.source === 'global') {
                var note = document.createElement('div');
                note.className = 'hint';
                note.textContent = 'Showing 7TV\\'s global emotes — connect 7TV to your channel for your own set.';
                panel.appendChild(note);
              }
              var grid = document.createElement('div');
              grid.style.cssText = 'display:flex; flex-wrap:wrap; gap:6px;';
              if (!emotes.length) {
                grid.textContent = 'No emotes found.';
              }
              emotes.forEach(function(emote) {
                var img = document.createElement('img');
                img.src = emote.url;
                img.alt = emote.name;
                img.title = emote.name;
                img.style.cssText = 'width:32px; height:32px; object-fit:contain; cursor:pointer; border-radius:4px;';
                img.addEventListener('click', async function() {
                  if (hintEl) hintEl.textContent = 'Setting thumbnail…';
                  try {
                    var setRes = await fetch(API_BASE + '/' + encodeURIComponent(soundId) + '/thumbnail-from-url', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ url: emote.url })
                    });
                    var setBody = await setRes.json().catch(function() { return {}; });
                    if (!setRes.ok) throw new Error(setBody.error || 'Failed to set thumbnail');
                    if (hintEl) {
                      hintEl.textContent = 'Thumbnail set!';
                      setTimeout(function() { hintEl.textContent = ''; }, 2500);
                    }
                    if (typeof onSet === 'function') onSet(setBody.sound);
                  } catch (e) {
                    if (hintEl) hintEl.textContent = e.message || 'Failed to set thumbnail';
                  }
                });
                grid.appendChild(img);
              });
              panel.appendChild(grid);
              loaded = true;
            } catch (e) {
              panel.textContent = 'Failed to load emotes';
            }
          });

          return { btn: btn, panel: panel };
        }

        // GIF search is shaped differently from the emote pickers above —
        // it needs a query box and re-fetches per keystroke. Unlike Giphy
        // (which required Search to be called client-side per their
        // terms), Klipy's search is proxied through our own backend at
        // API_BASE + '/klipy-search' so the API key never reaches the
        // browser. Only the final "use this one" step goes through our
        // API either way, reusing the exact same thumbnail-from-url
        // endpoint and SSRF allowlist as every other source.
        function createGifSearchPicker(soundId, hintEl, onSet, panelGroup) {
          var btn = document.createElement('button');
          btn.textContent = 'GIF Search';
          btn.className = 'secondary';
          btn.style.cssText = 'font-size:12px; padding:3px 8px;';

          var panel = document.createElement('div');
          panel.style.cssText = 'display:none; flex-direction:column; gap:6px; margin-top:6px; padding:6px; border:1px solid var(--border,#303038); border-radius:6px;';
          if (panelGroup) panelGroup.push(panel);

          var searchInput = document.createElement('input');
          searchInput.type = 'text';
          searchInput.placeholder = 'Search KLIPY…';
          searchInput.style.cssText = 'font-size:12px; padding:4px 6px;';

          var grid = document.createElement('div');
          grid.style.cssText = 'display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; max-height:160px; overflow-y:auto;';

          var attribution = document.createElement('div');
          attribution.className = 'hint';
          attribution.style.cssText = 'font-size:10px; opacity:0.7; margin-top:2px;';
          attribution.textContent = 'Powered by KLIPY';

          panel.appendChild(searchInput);
          panel.appendChild(grid);
          panel.appendChild(attribution);

          var debounceTimer = null;
          searchInput.addEventListener('input', function() {
            if (debounceTimer) clearTimeout(debounceTimer);
            var query = searchInput.value.trim();
            if (!query) { grid.textContent = ''; return; }
            debounceTimer = setTimeout(function() { runSearch(query); }, 400);
          });

          async function runSearch(query) {
            grid.textContent = 'Searching…';
            try {
              var r = await fetch(API_BASE + '/klipy-search?q=' + encodeURIComponent(query));
              var body = await r.json().catch(function() { return {}; });
              var results = body.gifs || [];
              grid.textContent = '';
              if (!results.length) grid.textContent = 'No results.';
              results.forEach(function(gif) {
                if (!gif.thumbUrl || !gif.attachUrl) return;
                var img = document.createElement('img');
                img.src = gif.thumbUrl;
                img.alt = gif.title || '';
                img.title = gif.title || '';
                img.style.cssText = 'width:48px; height:48px; object-fit:cover; cursor:pointer; border-radius:4px;';
                img.addEventListener('click', async function() {
                  if (hintEl) hintEl.textContent = 'Setting thumbnail…';
                  try {
                    var setRes = await fetch(API_BASE + '/' + encodeURIComponent(soundId) + '/thumbnail-from-url', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ url: gif.attachUrl })
                    });
                    var setBody = await setRes.json().catch(function() { return {}; });
                    if (!setRes.ok) throw new Error(setBody.error || 'Failed to set thumbnail');
                    if (hintEl) {
                      hintEl.textContent = 'Thumbnail set!';
                      setTimeout(function() { hintEl.textContent = ''; }, 2500);
                    }
                    if (typeof onSet === 'function') onSet(setBody.sound);
                  } catch (e) {
                    if (hintEl) hintEl.textContent = e.message || 'Failed to set thumbnail';
                  }
                });
                grid.appendChild(img);
              });
            } catch (e) {
              grid.textContent = 'Search failed';
            }
          }

          btn.addEventListener('click', function() {
            var isOpen = panel.style.display !== 'none';
            if (panelGroup) panelGroup.forEach(function(p) { if (p !== panel) p.style.display = 'none'; });
            panel.style.display = isOpen ? 'none' : 'flex';
            if (!isOpen) searchInput.focus();
          });

          return { btn: btn, panel: panel };
        }

        function openSoundEditor(s, card, autoOpenTrim) {
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
          row.style.cssText = 'display:flex; align-items:center; gap:8px; flex-wrap:wrap;';

          // Bits can be turned off entirely for a Channel-Points-only alert
          // (tier: null) — it just never shows up in the viewer's Bits panel,
          // no extension changes involved, since that panel only ever sees
          // sounds with a real tier in the first place.
          var enableBitsLabel = document.createElement('label');
          enableBitsLabel.style.cssText = 'display:flex; align-items:center; gap:4px; font-size:12px;';
          var enableBitsCb = document.createElement('input');
          enableBitsCb.type = 'checkbox';
          enableBitsCb.checked = Boolean(s.tier);
          enableBitsLabel.appendChild(enableBitsCb);
          enableBitsLabel.appendChild(document.createTextNode('Bits'));

          var tierSelect = document.createElement('select');
          Object.keys(TIER_LABELS).forEach(function(t) {
            var opt = document.createElement('option');
            opt.value = t;
            opt.textContent = TIER_LABELS[t];
            if (t === s.tier) opt.selected = true;
            tierSelect.appendChild(opt);
          });
          tierSelect.disabled = !s.tier;
          enableBitsCb.addEventListener('change', function() { tierSelect.disabled = !enableBitsCb.checked; });

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

          row.appendChild(enableBitsLabel);
          row.appendChild(tierSelect);
          row.appendChild(volLabel);

          // Channel Points — a second, independent trigger alongside Bits.
          // Unlike everything else in this form, this can't be a plain field:
          // toggling it creates/updates/deletes a real Twitch Custom Reward,
          // so it gets its own immediate action + status hint instead of
          // waiting for the main Save button.
          var cpRow = document.createElement('div');
          cpRow.style.cssText = 'display:flex; align-items:center; gap:8px; flex-wrap:wrap;';

          var cpLabel = document.createElement('label');
          cpLabel.style.cssText = 'display:flex; align-items:center; gap:6px; font-size:12px;';
          var cpCheckbox = document.createElement('input');
          cpCheckbox.type = 'checkbox';
          cpCheckbox.checked = Boolean(s.channelPointsEnabled);
          cpLabel.appendChild(cpCheckbox);
          cpLabel.appendChild(document.createTextNode('Channel Points'));

          var cpCostInput = document.createElement('input');
          cpCostInput.type = 'number';
          cpCostInput.min = '1';
          cpCostInput.step = '1';
          cpCostInput.value = String(s.channelPointsCost || 500);
          cpCostInput.style.cssText = 'width:80px; font-size:12px;';
          cpCostInput.disabled = !s.channelPointsEnabled;

          var cpUpdateBtn = document.createElement('button');
          cpUpdateBtn.textContent = 'Update Cost';
          cpUpdateBtn.className = 'secondary';
          cpUpdateBtn.style.cssText = 'font-size:11px; padding:3px 8px; display:' + (s.channelPointsEnabled ? 'inline-block' : 'none') + ';';

          var cpHint = document.createElement('span');
          cpHint.className = 'hint';

          async function applyChannelPoints(enabled) {
            setBusy(cpCheckbox, true);
            setBusy(cpUpdateBtn, true);
            cpHint.textContent = enabled ? 'Setting up reward…' : 'Removing reward…';
            try {
              var r = await fetch(API_BASE + '/' + encodeURIComponent(s.id) + '/channel-points', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: enabled, cost: Number(cpCostInput.value) || undefined })
              });
              var body = await r.json().catch(function() { return {}; });
              if (!r.ok) throw new Error(body.error || 'Failed to update Channel Points');
              s.channelPointsEnabled = Boolean(body.sound && body.sound.channelPointsEnabled);
              cpCostInput.disabled = !s.channelPointsEnabled;
              cpUpdateBtn.style.display = s.channelPointsEnabled ? 'inline-block' : 'none';
              cpHint.textContent = enabled ? 'Live on your Channel Points!' : 'Removed';
              setTimeout(function() { cpHint.textContent = ''; }, 2500);
            } catch (err) {
              cpCheckbox.checked = !enabled;
              cpHint.textContent = err.message || 'Failed';
            }
            setBusy(cpCheckbox, false);
            setBusy(cpUpdateBtn, false);
          }

          cpCheckbox.addEventListener('change', function() { applyChannelPoints(cpCheckbox.checked); });
          cpUpdateBtn.addEventListener('click', function() { applyChannelPoints(true); });

          cpRow.appendChild(cpLabel);
          cpRow.appendChild(cpCostInput);
          cpRow.appendChild(cpUpdateBtn);
          cpRow.appendChild(cpHint);

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
          imageLabel.textContent = 'Card Image (max 1 MB, PNG/JPG/GIF/WebP)';

          var imageRow = document.createElement('div');
          imageRow.style.cssText = 'display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-top:4px;';

          var imageInput = document.createElement('input');
          imageInput.type = 'file';
          imageInput.accept = 'image/png,image/jpeg,image/gif,image/webp';
          imageInput.style.cssText = 'font-size:12px; flex:1; min-width:160px;';

          var imageHint = document.createElement('span');
          imageHint.className = 'hint';
          imageHint.style.cssText = 'margin-left:4px;';

          imageInput.addEventListener('change', async function() {
            var file = imageInput.files ? imageInput.files[0] : null;
            if (!file) return;
            if (file.size > 1024 * 1024) { imageHint.textContent = 'File too large (max 1 MB)'; return; }
            imageInput.disabled = true;
            imageHint.textContent = 'Uploading…';
            try {
              var fd = new FormData();
              fd.append('image', file);
              var r = await fetch(API_BASE + '/' + encodeURIComponent(s.id) + '/image', { method: 'POST', body: fd });
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

          // API_BASE already differs between the broadcaster's own view
          // (/api/sounds) and the admin-managing-another-channel view
          // (/api/admin/sounds/:userId) — must derive these the same way,
          // not hardcode /api/sounds/... which would silently resolve to
          // the wrong channel (or the admin's own) in the admin view.
          var imagePickerPanels = [];
          var twitchEmotePicker = createEmotePicker('Twitch Emotes', API_BASE + '/twitch-emotes', s.id, imageHint, function() { fetchSoundsAdmin(); }, imagePickerPanels);
          var sevenTvEmotePicker = createEmotePicker('7TV Emotes', API_BASE + '/seventv-emotes', s.id, imageHint, function() { fetchSoundsAdmin(); }, imagePickerPanels);
          // Only offer GIF search if a key is actually configured — no point
          // rendering a button that can only ever fail.
          var gifSearchPicker = KLIPY_ENABLED ? createGifSearchPicker(s.id, imageHint, function() { fetchSoundsAdmin(); }, imagePickerPanels) : null;

          if (s.imageFilename) {
            var removeImgBtn = document.createElement('button');
            removeImgBtn.textContent = 'Remove';
            removeImgBtn.className = 'danger';
            removeImgBtn.style.cssText = 'font-size:12px; padding:3px 8px; color:#fff; border:none; border-radius:4px; cursor:pointer;';
            removeImgBtn.addEventListener('click', async function() {
              flashButton(removeImgBtn);
              setBusy(removeImgBtn, true);
              try {
                await fetch(API_BASE + '/' + encodeURIComponent(s.id) + '/image', { method: 'DELETE' });
                await fetchSoundsAdmin();
              } catch(e) {}
              setBusy(removeImgBtn, false);
            });
            imageRow.appendChild(removeImgBtn);
          }

          imageRow.appendChild(twitchEmotePicker.btn);
          imageRow.appendChild(sevenTvEmotePicker.btn);
          if (gifSearchPicker) imageRow.appendChild(gifSearchPicker.btn);
          imageRow.appendChild(imageHint);
          imageSection.appendChild(imageLabel);
          imageSection.appendChild(imageRow);
          imageSection.appendChild(twitchEmotePicker.panel);
          imageSection.appendChild(sevenTvEmotePicker.panel);
          if (gifSearchPicker) imageSection.appendChild(gifSearchPicker.panel);

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
              var dr = await fetch(API_BASE + '/' + encodeURIComponent(s.id) + '/duration');
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
            trimBtnRow.style.cssText = 'display:flex; gap:6px; align-items:center; flex-wrap:wrap;';

            var previewBtn = document.createElement('button');
            previewBtn.textContent = '\\u25B6 Preview';
            previewBtn.className = 'secondary';
            previewBtn.style.cssText = 'font-size:12px; padding:3px 8px;';
            previewBtn.addEventListener('click', async function() {
              if (trimAudio) { trimAudio.pause(); trimAudio = null; previewBtn.textContent = '\\u25B6 Preview'; }
              else {
                try {
                  if (!trimAudioUrl) {
                    var ar = await fetch(API_BASE + '/' + encodeURIComponent(sound.id) + '/audio');
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
                var r = await fetch(API_BASE + '/' + encodeURIComponent(sound.id) + '/trim', {
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
              tier: enableBitsCb.checked ? tierSelect.value : null,
              volume: Number(volRange.value),
              cooldownMs: Number(cdInput.value) * 1000,
              shared: sharedCb.checked
            };
            if (!s.type || s.type === 'sound') {
              patch.tags = tagsInput.value.split(',').map(function(t) { return t.trim(); }).filter(Boolean).slice(0, 5);
            }
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

          // Share to Library checkbox
          var sharedLabel = document.createElement('label');
          sharedLabel.style.cssText = 'display:flex; align-items:center; gap:6px; font-size:13px;';
          var sharedCb = document.createElement('input');
          sharedCb.type = 'checkbox';
          sharedCb.checked = !!s.shared;
          sharedLabel.appendChild(sharedCb);
          sharedLabel.appendChild(document.createTextNode('Share to Community Library'));

          // Tags (only meaningful for sound-type alerts, the only type the library supports)
          var tagsLabel = document.createElement('label');
          tagsLabel.style.cssText = 'font-size:12px; color:var(--text-muted); display:block; margin-top:4px;';
          tagsLabel.textContent = 'Tags (comma-separated, up to 5 — helps others find it in the library)';
          var tagsInput = document.createElement('input');
          tagsInput.type = 'text';
          tagsInput.value = (s.tags || []).join(', ');
          tagsInput.placeholder = 'e.g. anime, meme, horror';
          tagsInput.maxLength = 200;
          tagsInput.style.cssText = 'width:100%; max-width:400px; margin-top:2px;';

          form.appendChild(nameInput);
          form.appendChild(row);
          form.appendChild(cpRow);
          form.appendChild(cdLabel);
          form.appendChild(imageSection);
          form.appendChild(sharedLabel);
          if (!s.type || s.type === 'sound') {
            form.appendChild(tagsLabel);
            form.appendChild(tagsInput);
          }

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

          // Used by the "Add & Trim" library flow to land the streamer
          // straight in the trim panel instead of making them find and
          // click "Trim Audio" themselves right after adding.
          if (autoOpenTrim) {
            trimToggle.click();
            form.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }

        async function updateSoundAdmin(soundId, patch) {
          try {
            await fetch(API_BASE + '/' + encodeURIComponent(soundId), {
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
            await fetch(API_BASE + '/' + encodeURIComponent(soundId), { method: 'DELETE' });
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
                maxQueueSize: soundMaxQueueEl ? Number(soundMaxQueueEl.value) : 5,
                videoSize: videoSizeEl ? videoSizeEl.value : 'medium'
              };
              await fetch(API_BASE + '/settings', {
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

        // ===== Create Alert Wizard =====
        // Steps: 1) type, 2) source + name (creates the real sound on
        // advance), 3) thumbnail (against the now-real sound, reusing the
        // exact same picker components as the per-sound editor), 4) Bits
        // tier / volume / cooldown / sharing (PUT patch) + finish. Advanced
        // settings (Channel Points, Overlay Display) stay edit-only, same
        // as before this wizard existed.
        var wizardBackdropEl = document.getElementById('createWizardBackdrop');
        var wizardBodyEl = document.getElementById('wizardBody');
        var wizardStepIndicatorEl = document.getElementById('wizardStepIndicator');
        var wizardHintEl = document.getElementById('wizardHint');
        var wizardBackBtn = document.getElementById('wizardBackBtn');
        var wizardNextBtn = document.getElementById('wizardNextBtn');
        var wizardCloseBtn = document.getElementById('wizardCloseBtn');
        var openCreateWizardBtn = document.getElementById('openCreateWizardBtn');
        var TOTAL_WIZARD_STEPS = 4;
        var wizard = null;

        function resetWizard() {
          wizard = { step: 1, type: 'sound', name: '', clipUrl: '', audioOnly: false, file: null, createdSound: null, thumbnailSource: null };
        }

        function isYoutubeClipUrl(url) {
          return /youtube\\.com|youtu\\.be/i.test(url || '');
        }

        function openWizard() {
          resetWizard();
          logDashboardEvent('wizard_started');
          if (wizardBackdropEl) wizardBackdropEl.style.display = 'flex';
          renderWizardStep();
        }

        function closeWizard() {
          if (wizardBackdropEl) wizardBackdropEl.style.display = 'none';
          // A partially-configured sound may already exist (created on the
          // step 2-to-3 transition) even if the wizard is abandoned before
          // finishing — silently resync the list so it is not stale next
          // time the streamer looks, without forcing navigation anywhere.
          if (wizard && wizard.createdSound) fetchSoundsAdmin();
          wizard = null;
        }

        if (openCreateWizardBtn) openCreateWizardBtn.addEventListener('click', openWizard);
        if (wizardCloseBtn) wizardCloseBtn.addEventListener('click', closeWizard);
        if (wizardBackdropEl) {
          wizardBackdropEl.addEventListener('click', function(e) {
            if (e.target === wizardBackdropEl) closeWizard();
          });
        }
        document.addEventListener('keydown', function(e) {
          if (e.key === 'Escape' && wizard && wizardBackdropEl && wizardBackdropEl.style.display !== 'none') {
            closeWizard();
          }
        });
        if (wizardBackBtn) {
          wizardBackBtn.addEventListener('click', function() {
            if (wizard && wizard.step > 1) { wizard.step--; renderWizardStep(); }
          });
        }
        if (wizardNextBtn) wizardNextBtn.addEventListener('click', function() { handleWizardNext(); });

        function updateWizardChrome() {
          if (wizardStepIndicatorEl) {
            wizardStepIndicatorEl.textContent = '';
            for (var i = 1; i <= TOTAL_WIZARD_STEPS; i++) {
              var dot = document.createElement('div');
              dot.className = 'wizard-step-dot' + (i === wizard.step ? ' active' : (i < wizard.step ? ' done' : ''));
              wizardStepIndicatorEl.appendChild(dot);
            }
          }
          // Back only makes sense pre-creation (step 1->2) — once the sound
          // is real (step 3+), changing the type/source would orphan it.
          if (wizardBackBtn) wizardBackBtn.style.display = (wizard.step === 2 && !wizard.createdSound) ? '' : 'none';
          if (wizardNextBtn) {
            wizardNextBtn.textContent = wizard.step === 2 ? 'Create & Continue' : (wizard.step === TOTAL_WIZARD_STEPS ? 'Finish' : 'Next');
          }
          if (wizardHintEl) wizardHintEl.textContent = '';
        }

        function renderWizardStep() {
          updateWizardChrome();
          if (!wizardBodyEl) return;
          if (wizard.step === 1) renderWizardStep1();
          else if (wizard.step === 2) renderWizardStep2();
          else if (wizard.step === 3) renderWizardStep3();
          else if (wizard.step === 4) renderWizardStep4();
        }

        function renderWizardStep1() {
          wizardBodyEl.textContent = '';
          var grid = document.createElement('div');
          grid.className = 'wizard-type-grid';
          var types = [{ id: 'sound', icon: '\\u{1F50A}', label: 'Sound' }];
          if (videoClipsEnabled) {
            types.push({ id: 'clip', icon: '\\u{1F3AC}', label: 'Clip / Video URL' });
            types.push({ id: 'video', icon: '\\u{1F4F9}', label: 'Video' });
          }
          types.forEach(function(t) {
            var card = document.createElement('div');
            card.className = 'wizard-type-card' + (wizard.type === t.id ? ' selected' : '');
            var icon = document.createElement('span');
            icon.className = 'icon';
            icon.textContent = t.icon;
            card.appendChild(icon);
            card.appendChild(document.createTextNode(t.label));
            card.addEventListener('click', function() {
              wizard.type = t.id;
              renderWizardStep1();
            });
            grid.appendChild(card);
          });
          wizardBodyEl.appendChild(grid);
          if (!videoClipsEnabled) {
            var proHint = document.createElement('p');
            proHint.className = 'hint';
            proHint.style.marginTop = '10px';
            proHint.textContent = 'Video & Clip alerts are a Pro feature. Contact the admin to enable them.';
            wizardBodyEl.appendChild(proHint);
          }
        }

        function renderWizardStep2() {
          wizardBodyEl.textContent = '';

          var nameLabel = document.createElement('div');
          nameLabel.className = 'hint';
          nameLabel.style.marginBottom = '4px';
          nameLabel.textContent = 'Name';
          var nameInput = document.createElement('input');
          nameInput.type = 'text';
          nameInput.id = 'wizardName';
          nameInput.maxLength = 100;
          nameInput.style.cssText = 'width:100%; box-sizing:border-box; margin-bottom:14px;';
          nameInput.value = wizard.name || '';
          nameInput.addEventListener('input', function() { wizard.name = nameInput.value; });
          wizardBodyEl.appendChild(nameLabel);
          wizardBodyEl.appendChild(nameInput);

          if (wizard.type === 'sound' || wizard.type === 'video') {
            var isVideo = wizard.type === 'video';
            var srcHint = document.createElement('div');
            srcHint.className = 'hint';
            srcHint.style.marginBottom = '8px';
            srcHint.textContent = isVideo
              ? 'Max 25 MB. Accepted formats: MP4, WebM.'
              : 'Max 5 MB. Accepted formats: MP3, OGG, WAV, WebM, M4A.';
            var fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.id = 'wizardFile';
            fileInput.accept = isVideo ? 'video/mp4,video/webm' : 'audio/mpeg,audio/ogg,audio/wav,audio/webm,audio/mp4';
            fileInput.addEventListener('change', function() { wizard.file = fileInput.files[0] || null; });
            // Restore a file chosen before an intervening Back/Next (native
            // <input type=file> cannot have .value set programmatically,
            // but a stored File can be re-attached via DataTransfer).
            if (wizard.file) {
              try {
                var dt = new DataTransfer();
                dt.items.add(wizard.file);
                fileInput.files = dt.files;
              } catch (e) {}
            }
            wizardBodyEl.appendChild(srcHint);
            wizardBodyEl.appendChild(fileInput);
          } else if (wizard.type === 'clip') {
            var clipHint = document.createElement('div');
            clipHint.className = 'hint';
            clipHint.style.marginBottom = '8px';
            clipHint.textContent = 'Paste a Twitch Clip or YouTube video URL. YouTube videos are limited to 3 minutes \\u2014 this is for short clips, not full videos.';
            var urlInput = document.createElement('input');
            urlInput.type = 'text';
            urlInput.id = 'wizardClipUrl';
            urlInput.placeholder = 'https://clips.twitch.tv/... or https://youtube.com/watch?v=...';
            urlInput.style.cssText = 'width:100%; box-sizing:border-box; margin-bottom:8px;';
            urlInput.value = wizard.clipUrl || '';
            urlInput.addEventListener('input', function() { wizard.clipUrl = urlInput.value; });
            var audioOnlyLabel = document.createElement('label');
            audioOnlyLabel.style.cssText = 'display:flex; align-items:center; gap:6px; font-size:13px;';
            var audioOnlyCb = document.createElement('input');
            audioOnlyCb.type = 'checkbox';
            audioOnlyCb.id = 'wizardClipAudioOnly';
            audioOnlyCb.checked = Boolean(wizard.audioOnly);
            audioOnlyCb.addEventListener('change', function() { wizard.audioOnly = audioOnlyCb.checked; });
            audioOnlyLabel.appendChild(audioOnlyCb);
            audioOnlyLabel.appendChild(document.createTextNode('Audio only (smaller file, no video)'));
            wizardBodyEl.appendChild(clipHint);
            wizardBodyEl.appendChild(urlInput);
            wizardBodyEl.appendChild(audioOnlyLabel);
          }
          wizardBodyEl.appendChild(renderWizardRightsDisclaimer(wizard.type));
        }

        // Subtle rights/takedown notice — was on every upload form before the
        // wizard replaced them; restored here (all types), with an extra
        // sentence on the clip/YouTube step since sourcing from someone
        // else's clip or video is a materially different situation than
        // uploading your own file.
        function renderWizardRightsDisclaimer(type) {
          var p = document.createElement('p');
          p.className = 'hint';
          p.style.cssText = 'margin-top:10px; font-size:11px; line-height:1.5; opacity:0.7;';
          var text = 'By providing this content, you confirm you own it or have the rights to use it, and grant permission for it to be publicly broadcast across Twitch.';
          if (type === 'clip') {
            text += ' This applies to both Twitch Clips and YouTube videos \\u2014 you\\'re responsible for making sure you have the rights to share it, and we will remove content in response to valid rights holder requests.';
          }
          p.textContent = text + ' ';
          var link = document.createElement('a');
          link.href = '/terms';
          link.style.color = 'var(--accent-color)';
          link.textContent = 'See our Terms of Service for details.';
          p.appendChild(link);
          return p;
        }

        function renderWizardThumbPreview(container) {
          container = container || document.getElementById('wizardThumbPreview');
          if (!container) return;
          container.textContent = '';
          if (wizard.createdSound && wizard.createdSound.imageFilename) {
            var img = document.createElement('img');
            img.src = API_BASE + '/' + encodeURIComponent(wizard.createdSound.id) + '/image?_=' + Date.now();
            img.style.cssText = 'width:100%; height:100%; object-fit:cover;';
            container.appendChild(img);
          } else {
            container.textContent = '\\u2014';
          }
        }

        function renderWizardStep3() {
          wizardBodyEl.textContent = '';
          var label = document.createElement('div');
          label.className = 'hint';
          label.style.marginBottom = '8px';
          label.textContent = 'Add a thumbnail (optional) \\u2014 shown on the overlay and in your alert list.';
          wizardBodyEl.appendChild(label);

          var thumbPreview = document.createElement('div');
          thumbPreview.id = 'wizardThumbPreview';
          thumbPreview.style.cssText = 'width:64px; height:64px; border-radius:8px; overflow:hidden; background:var(--surface-muted,#1a1a1e); margin-bottom:10px; display:flex; align-items:center; justify-content:center; font-size:20px; opacity:0.5;';
          wizardBodyEl.appendChild(thumbPreview);
          renderWizardThumbPreview(thumbPreview);

          var pickerRow = document.createElement('div');
          pickerRow.style.cssText = 'display:flex; gap:6px; flex-wrap:wrap;';

          var uploadBtn = document.createElement('button');
          uploadBtn.textContent = 'Upload Image';
          uploadBtn.className = 'secondary';
          uploadBtn.type = 'button';
          uploadBtn.style.cssText = 'font-size:12px; padding:3px 8px;';
          var uploadInput = document.createElement('input');
          uploadInput.type = 'file';
          uploadInput.accept = 'image/png,image/jpeg,image/gif,image/webp';
          uploadInput.style.display = 'none';
          uploadBtn.addEventListener('click', function() { uploadInput.click(); });
          uploadInput.addEventListener('change', async function() {
            var file = uploadInput.files[0];
            if (!file) return;
            if (file.size > 1024 * 1024) { wizardHintEl.textContent = 'Image must be under 1 MB'; return; }
            wizardHintEl.textContent = 'Uploading\\u2026';
            try {
              var fd = new FormData();
              fd.append('image', file);
              var r = await fetch(API_BASE + '/' + encodeURIComponent(wizard.createdSound.id) + '/image', { method: 'POST', body: fd });
              var body = await r.json().catch(function() { return {}; });
  if (!r.ok) throw new Error(body.error || 'Upload failed');
              wizard.createdSound = body.sound;
              wizard.thumbnailSource = 'upload';
              wizardHintEl.textContent = '';
              renderWizardThumbPreview(thumbPreview);
            } catch (e) {
              wizardHintEl.textContent = e.message || 'Upload failed';
            }
          });

          function onThumbSet(source) {
            return function(sound) {
              wizard.createdSound = sound;
              wizard.thumbnailSource = source;
              renderWizardThumbPreview(thumbPreview);
            };
          }
          var wizardPickerPanels = [];
          var twitchPicker = createEmotePicker('Twitch Emotes', API_BASE + '/twitch-emotes', wizard.createdSound.id, wizardHintEl, onThumbSet('twitch_emote'), wizardPickerPanels);
          var sevenTvPicker = createEmotePicker('7TV Emotes', API_BASE + '/seventv-emotes', wizard.createdSound.id, wizardHintEl, onThumbSet('seventv_emote'), wizardPickerPanels);
          var gifPicker = KLIPY_ENABLED ? createGifSearchPicker(wizard.createdSound.id, wizardHintEl, onThumbSet('gif_search'), wizardPickerPanels) : null;

          pickerRow.appendChild(uploadBtn);
          pickerRow.appendChild(twitchPicker.btn);
          pickerRow.appendChild(sevenTvPicker.btn);
          if (gifPicker) pickerRow.appendChild(gifPicker.btn);

          wizardBodyEl.appendChild(pickerRow);
          wizardBodyEl.appendChild(uploadInput);
          wizardBodyEl.appendChild(twitchPicker.panel);
          wizardBodyEl.appendChild(sevenTvPicker.panel);
          if (gifPicker) wizardBodyEl.appendChild(gifPicker.panel);
        }

        function renderWizardStep4() {
          wizardBodyEl.textContent = '';
          var s = wizard.createdSound;

          var tierRow = document.createElement('div');
          tierRow.style.cssText = 'margin-bottom:10px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;';
          // Bits can be turned off for a Channel-Points-only alert — see the
          // matching checkbox in the per-sound editor for why this is safe
          // (never touches the extension, tier-less sounds are filtered out
          // of the viewer's Bits panel server-side).
          var enableBitsLabel = document.createElement('label');
          enableBitsLabel.style.cssText = 'display:flex; align-items:center; gap:4px; font-size:13px;';
          var enableBitsCb = document.createElement('input');
          enableBitsCb.type = 'checkbox';
          enableBitsCb.id = 'wizardEnableBits';
          enableBitsCb.checked = true;
          enableBitsLabel.appendChild(enableBitsCb);
          enableBitsLabel.appendChild(document.createTextNode('Bits'));
          var tierSelect = document.createElement('select');
          tierSelect.id = 'wizardTier';
          Object.keys(TIER_LABELS).forEach(function(t) {
            var opt = document.createElement('option');
            opt.value = t;
            opt.textContent = TIER_LABELS[t];
            if (t === s.tier) opt.selected = true;
            tierSelect.appendChild(opt);
          });
          enableBitsCb.addEventListener('change', function() { tierSelect.disabled = !enableBitsCb.checked; });
          tierRow.appendChild(enableBitsLabel);
          tierRow.appendChild(tierSelect);

          var volRow = document.createElement('div');
          volRow.style.cssText = 'margin-bottom:10px; display:flex; align-items:center; gap:8px;';
          var volLabel = document.createElement('span');
          volLabel.className = 'hint';
          volLabel.textContent = 'Volume';
          var volRange = document.createElement('input');
          volRange.type = 'range';
          volRange.min = '0'; volRange.max = '100'; volRange.value = String(s.volume || 80);
          volRange.id = 'wizardVolume';
          var volVal = document.createElement('span');
          volVal.className = 'hint';
          volVal.textContent = (s.volume || 80) + '%';
          volRange.addEventListener('input', function() { volVal.textContent = this.value + '%'; });
          volRow.appendChild(volLabel);
          volRow.appendChild(volRange);
          volRow.appendChild(volVal);

          var cdRow = document.createElement('div');
          cdRow.style.cssText = 'margin-bottom:10px; display:flex; align-items:center; gap:8px;';
          var cdLabel = document.createElement('span');
          cdLabel.className = 'hint';
          cdLabel.textContent = 'Cooldown (sec)';
          var cdInput = document.createElement('input');
          cdInput.type = 'number';
          cdInput.min = '0'; cdInput.max = '60';
          cdInput.value = String(Math.round((s.cooldownMs || 5000) / 1000));
          cdInput.id = 'wizardCooldown';
          cdInput.style.width = '60px';
          cdRow.appendChild(cdLabel);
          cdRow.appendChild(cdInput);

          // Channel Points here is just the desired end-state (checked +
          // cost) — unlike the per-sound editor, there is no separate
          // immediate action; finishWizard() creates the real Twitch Custom
          // Reward as part of Finish, alongside the rest of the settings.
          var cpRow = document.createElement('div');
          cpRow.style.cssText = 'display:flex; align-items:center; gap:8px; margin-bottom:10px; flex-wrap:wrap;';
          var cpLabel = document.createElement('label');
          cpLabel.style.cssText = 'display:flex; align-items:center; gap:6px; font-size:13px;';
          var cpCb = document.createElement('input');
          cpCb.type = 'checkbox';
          cpCb.id = 'wizardChannelPoints';
          cpLabel.appendChild(cpCb);
          cpLabel.appendChild(document.createTextNode('Channel Points'));
          var cpCostInput = document.createElement('input');
          cpCostInput.type = 'number';
          cpCostInput.min = '1';
          cpCostInput.step = '1';
          cpCostInput.id = 'wizardChannelPointsCost';
          cpCostInput.value = '500';
          cpCostInput.disabled = true;
          cpCostInput.style.cssText = 'width:80px; font-size:12px;';
          cpCb.addEventListener('change', function() { cpCostInput.disabled = !cpCb.checked; });
          cpRow.appendChild(cpLabel);
          cpRow.appendChild(cpCostInput);

          var shareLabel = document.createElement('label');
          shareLabel.style.cssText = 'display:flex; align-items:center; gap:6px; font-size:13px; margin-bottom:10px;';
          var shareCb = document.createElement('input');
          shareCb.type = 'checkbox';
          shareCb.id = 'wizardShare';
          shareCb.checked = true;
          shareLabel.appendChild(shareCb);
          shareLabel.appendChild(document.createTextNode('Share to Community Library'));

          wizardBodyEl.appendChild(tierRow);
          wizardBodyEl.appendChild(volRow);
          wizardBodyEl.appendChild(cdRow);
          wizardBodyEl.appendChild(cpRow);
          wizardBodyEl.appendChild(shareLabel);

          if (!s.type || s.type === 'sound') {
            var tagsLabel = document.createElement('div');
            tagsLabel.className = 'hint';
            tagsLabel.style.marginBottom = '4px';
            tagsLabel.textContent = 'Tags (comma-separated, up to 5)';
            var tagsInput = document.createElement('input');
            tagsInput.type = 'text';
            tagsInput.id = 'wizardTags';
            tagsInput.placeholder = 'e.g. anime, meme, horror';
            tagsInput.style.cssText = 'width:100%; box-sizing:border-box;';
            wizardBodyEl.appendChild(tagsLabel);
            wizardBodyEl.appendChild(tagsInput);
          }
        }

        // Performs the actual creation call once the streamer has picked a
        // type and provided a source — everything after this point (steps 3
        // and 4) is a real edit against wizard.createdSound, not a draft.
        async function createFromWizard() {
          var nameInput = document.getElementById('wizardName');
          var name = nameInput ? nameInput.value.trim() : (wizard.name || '').trim();
          wizardNextBtn.disabled = true;
          wizardHintEl.textContent = 'Creating\\u2026';
          try {
            var r, body;
            if (wizard.type === 'sound') {
              var file = wizard.file;
              if (!file) { wizardHintEl.textContent = 'Select an audio file'; return false; }
              if (file.size > 5 * 1024 * 1024) { wizardHintEl.textContent = 'File must be under 5 MB'; return false; }
              var fd = new FormData();
              fd.append('file', file);
              fd.append('name', name || file.name.replace(/\\.[^.]+$/, ''));
              fd.append('tier', '${DEFAULT_TIER}');
              fd.append('volume', '80');
              fd.append('shared', 'false');
              r = await fetch(API_BASE, { method: 'POST', body: fd });
            } else if (wizard.type === 'video') {
              var fileV = wizard.file;
              if (!fileV) { wizardHintEl.textContent = 'Select a video file'; return false; }
              if (fileV.size > 25 * 1024 * 1024) { wizardHintEl.textContent = 'File must be under 25 MB'; return false; }
              var fdV = new FormData();
              fdV.append('file', fileV);
              fdV.append('name', name || fileV.name.replace(/\\.[^.]+$/, ''));
              fdV.append('tier', '${DEFAULT_TIER}');
              fdV.append('volume', '80');
              fdV.append('shared', 'false');
              r = await fetch(API_BASE + '/video', { method: 'POST', body: fdV });
            } else if (wizard.type === 'clip') {
              var url = (wizard.clipUrl || '').trim();
              if (!url) { wizardHintEl.textContent = 'Enter a Twitch Clip URL'; return false; }
              r = await fetch(API_BASE + '/clip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: name || 'Clip',
                  clipUrl: url,
                  tier: '${DEFAULT_TIER}',
                  volume: 80,
                  audioOnly: Boolean(wizard.audioOnly),
                  shared: false,
                })
              });
            }
            body = await r.json().catch(function() { return {}; });
            if (!r.ok) throw new Error(body.error || 'Failed to create alert');
            wizard.createdSound = body.sound;
            wizardHintEl.textContent = '';
            return true;
          } catch (e) {
            wizardHintEl.textContent = e.message || 'Failed to create alert';
            if (wizard.type === 'clip') {
              logDashboardEvent('clip_conversion_failed', {
                reason: (e.message || 'Unknown error').slice(0, 200),
                isYoutube: isYoutubeClipUrl(wizard.clipUrl),
              });
            }
            return false;
          } finally {
            wizardNextBtn.disabled = false;
          }
        }

        async function finishWizard() {
          var enableBitsCb = document.getElementById('wizardEnableBits');
          var tierSelect = document.getElementById('wizardTier');
          var volRange = document.getElementById('wizardVolume');
          var cdInput = document.getElementById('wizardCooldown');
          var shareCb = document.getElementById('wizardShare');
          var tagsInput = document.getElementById('wizardTags');
          var patch = {
            tier: (enableBitsCb && !enableBitsCb.checked) ? null : (tierSelect ? tierSelect.value : wizard.createdSound.tier),
            volume: volRange ? Number(volRange.value) : wizard.createdSound.volume,
            cooldownMs: cdInput ? Number(cdInput.value) * 1000 : wizard.createdSound.cooldownMs,
            shared: shareCb ? shareCb.checked : false,
          };
          if (!wizard.createdSound.type || wizard.createdSound.type === 'sound') {
            patch.tags = tagsInput
              ? tagsInput.value.split(',').map(function(t) { return t.trim(); }).filter(Boolean).slice(0, 5)
              : [];
          }
          var cpCb = document.getElementById('wizardChannelPoints');
          var cpCostInput = document.getElementById('wizardChannelPointsCost');
          var wantsChannelPoints = Boolean(cpCb && cpCb.checked);

          wizardNextBtn.disabled = true;
          wizardHintEl.textContent = 'Saving\\u2026';
          try {
            var r = await fetch(API_BASE + '/' + encodeURIComponent(wizard.createdSound.id), {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(patch)
            });
            var body = await r.json().catch(function() { return {}; });
            if (!r.ok) throw new Error(body.error || 'Failed to save');

            // Channel Points is a separate call (like the per-sound editor) —
            // it creates a real Twitch Custom Reward, so it can't just be
            // part of the generic patch above.
            if (wantsChannelPoints) {
              wizardHintEl.textContent = 'Setting up Channel Points\\u2026';
              var cpRes = await fetch(API_BASE + '/' + encodeURIComponent(wizard.createdSound.id) + '/channel-points', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: true, cost: Number(cpCostInput.value) || undefined })
              });
              var cpBody = await cpRes.json().catch(function() { return {}; });
              if (!cpRes.ok) throw new Error(cpBody.error || 'Failed to enable Channel Points');
            }

            // Matches the event names the extension panel's upload UI already
            // logs (see ebs/routes_admin.js's funnel query) — the dashboard
            // wizard previously fired none of these, so completions here were
            // invisible to the funnel entirely regardless of language.
            var completionEventByType = { sound: 'sound_uploaded', clip: 'clip_created', video: 'video_uploaded' };
            logDashboardEvent(completionEventByType[wizard.type] || 'sound_uploaded', {
              tier: patch.tier,
              channelPoints: wantsChannelPoints,
              thumbnailSource: wizard.thumbnailSource || 'none',
              isYoutube: wizard.type === 'clip' ? isYoutubeClipUrl(wizard.clipUrl) : undefined,
            });

            var soundId = wizard.createdSound.id;
            closeWizard();
            await revealNewSound(soundId);
          } catch (e) {
            wizardHintEl.textContent = e.message || 'Failed to save';
            wizardNextBtn.disabled = false;
          }
        }

        async function handleWizardNext() {
          if (!wizard) return;
          wizardHintEl.textContent = '';
          if (wizard.step === 1) {
            logDashboardEvent('wizard_step_completed', { step: 1, type: wizard.type });
            wizard.step = 2;
            renderWizardStep();
          } else if (wizard.step === 2) {
            var ok = await createFromWizard();
            if (!ok) return;
            logDashboardEvent('wizard_step_completed', {
              step: 2,
              source: wizard.type,
              isYoutube: wizard.type === 'clip' ? isYoutubeClipUrl(wizard.clipUrl) : undefined,
            });
            wizard.step = 3;
            renderWizardStep();
          } else if (wizard.step === 3) {
            logDashboardEvent('wizard_step_completed', { step: 3, thumbnailSource: wizard.thumbnailSource || 'none' });
            wizard.step = 4;
            renderWizardStep();
          } else if (wizard.step === 4) {
            await finishWizard();
          }
        }

        // ===== TTS Settings =====

        var ttsEnabledEl = document.getElementById('ttsEnabled');
        var ttsTierEl = document.getElementById('ttsTier');
        var ttsVolumeEl2 = document.getElementById('ttsVolume');
        var ttsVolumeValEl = document.getElementById('ttsVolumeVal');
        var ttsCooldownEl = document.getElementById('ttsCooldown');
        var ttsMaxLengthEl = document.getElementById('ttsMaxLength');
        var ttsModerationEl = document.getElementById('ttsModeration');
        var ttsBannedWordsEl = document.getElementById('ttsBannedWords');
        var ttsVoiceListEl = document.getElementById('ttsVoiceList');
        var ttsTestVoiceEl = document.getElementById('ttsTestVoice');
        var ttsPreviewVoiceBtnEl = document.getElementById('ttsPreviewVoiceBtn');
        var ttsTestMessageEl = document.getElementById('ttsTestMessage');
        var ttsTestBtnEl = document.getElementById('ttsTestBtn');
        var ttsTestHintEl = document.getElementById('ttsTestHint');
        var saveTtsBtnEl = document.getElementById('saveTtsSettings');
        var ttsSettingsHintEl2 = document.getElementById('ttsSettingsHint');
        var ttsAccessHintEl = document.getElementById('ttsAccessHint');

        var ttsVoicesCache = [];
        var ttsAllowedSet = new Set();
        var ttsPreviewAudio = null;

        if (ttsVolumeEl2) ttsVolumeEl2.addEventListener('input', function() {
          if (ttsVolumeValEl) ttsVolumeValEl.textContent = this.value + '%';
        });

        async function fetchTtsSettings() {
          try {
            var r = await fetch(TTS_API_BASE, { cache: 'no-store' });
            var data = await r.json();
            var s = data.settings || {};
            var voices = data.voices || [];
            var proActive = data.proActive || false;
            var minTier = data.minTier || 'sound_300';
            ttsVoicesCache = voices;

            // Show/hide access hint
            if (!proActive && !s.granted) {
              if (ttsAccessHintEl) ttsAccessHintEl.style.display = '';
            } else {
              if (ttsAccessHintEl) ttsAccessHintEl.style.display = 'none';
            }

            // Rebuild tier dropdown with admin-enforced minimum
            if (ttsTierEl) {
              var allTiers = ${JSON.stringify(VALID_TIERS)};
              var tierLabels = ${JSON.stringify(TIER_LABELS)};
              var minIdx = allTiers.indexOf(minTier);
              if (minIdx < 0) minIdx = 0;
              ttsTierEl.textContent = '';
              for (var i = minIdx; i < allTiers.length; i++) {
                var opt = document.createElement('option');
                opt.value = allTiers[i];
                opt.textContent = tierLabels[allTiers[i]];
                ttsTierEl.appendChild(opt);
              }
            }

            // Populate fields
            if (ttsEnabledEl) ttsEnabledEl.checked = s.enabled !== false;
            if (ttsTierEl) ttsTierEl.value = s.tier || minTier;
            if (ttsVolumeEl2) { ttsVolumeEl2.value = s.volume ?? 80; if (ttsVolumeValEl) ttsVolumeValEl.textContent = ttsVolumeEl2.value + '%'; }
            if (ttsCooldownEl) ttsCooldownEl.value = Math.round((s.cooldownMs || 10000) / 1000);
            if (ttsMaxLengthEl) ttsMaxLengthEl.value = s.maxMessageLength || 200;
            if (ttsModerationEl) ttsModerationEl.checked = s.moderationEnabled !== false;
            if (ttsBannedWordsEl) ttsBannedWordsEl.value = (s.bannedWords || []).join(', ');

            // Build voice checkboxes + test voice dropdown
            ttsAllowedSet = new Set(s.allowedVoices || []);
            renderTtsVoices(voices);
            renderTtsTestVoiceDropdown(voices);
          } catch (err) {}
        }

        function renderTtsVoices(voices) {
          if (!ttsVoiceListEl) return;
          ttsVoiceListEl.textContent = '';
          voices.forEach(function(v) {
            var label = document.createElement('label');
            label.style.cssText = 'display:flex; align-items:center; gap:4px; font-size:13px; padding:4px 8px; border-radius:6px; border:1px solid var(--input-border); background:var(--input-bg); cursor:pointer; user-select:none;';
            var cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = ttsAllowedSet.has(v.id);
            cb.dataset.voiceId = v.id;
            cb.addEventListener('change', function() {
              if (this.checked) ttsAllowedSet.add(v.id);
              else ttsAllowedSet.delete(v.id);
            });
            var nameSpan = document.createElement('span');
            nameSpan.textContent = v.name;
            var genderSpan = document.createElement('span');
            genderSpan.style.cssText = 'font-size:11px; opacity:0.5; margin-left:2px;';
            genderSpan.textContent = (v.gender && v.gender !== 'unknown') ? '(' + v.gender + ')' : '';
            var playBtn = document.createElement('button');
            playBtn.type = 'button';
            playBtn.style.cssText = 'background:none; border:1px solid var(--input-border); border-radius:4px; padding:1px 5px; font-size:11px; cursor:pointer; color:var(--text-muted); line-height:1; margin-left:auto;';
            playBtn.textContent = '\u25B6';
            playBtn.title = 'Preview ' + v.name;
            playBtn.addEventListener('click', function(e) {
              e.preventDefault();
              e.stopPropagation();
              playInlinePreview(v.id, playBtn);
            });
            label.appendChild(cb);
            label.appendChild(nameSpan);
            label.appendChild(genderSpan);
            label.appendChild(playBtn);
            ttsVoiceListEl.appendChild(label);
          });
        }

        function playInlinePreview(voiceId, btn) {
          if (ttsPreviewAudio) { ttsPreviewAudio.pause(); ttsPreviewAudio = null; }
          var allBtns = ttsVoiceListEl.querySelectorAll('button');
          allBtns.forEach(function(b) { b.textContent = '\u25B6'; b.style.color = 'var(--text-muted)'; });
          btn.textContent = '\u23F9';
          btn.style.color = '#9146ff';
          fetch('/api/tts/preview/' + encodeURIComponent(voiceId))
            .then(function(r) { if (!r.ok) throw new Error(); return r.blob(); })
            .then(function(blob) {
              var url = URL.createObjectURL(blob);
              ttsPreviewAudio = new Audio(url);
              ttsPreviewAudio.volume = 0.6;
              ttsPreviewAudio.onended = function() { URL.revokeObjectURL(url); ttsPreviewAudio = null; btn.textContent = '\u25B6'; btn.style.color = 'var(--text-muted)'; };
              ttsPreviewAudio.onerror = function() { btn.textContent = '\u25B6'; btn.style.color = 'var(--text-muted)'; ttsPreviewAudio = null; };
              ttsPreviewAudio.play().catch(function() {});
            })
            .catch(function() { btn.textContent = '\u25B6'; btn.style.color = 'var(--text-muted)'; });
        }

        function renderTtsTestVoiceDropdown(voices) {
          if (!ttsTestVoiceEl) return;
          ttsTestVoiceEl.textContent = '';
          voices.forEach(function(v) {
            var opt = document.createElement('option');
            opt.value = v.id;
            opt.textContent = v.name;
            ttsTestVoiceEl.appendChild(opt);
          });
        }

        // Preview voice (plays a short sample directly)
        if (ttsPreviewVoiceBtnEl) {
          ttsPreviewVoiceBtnEl.addEventListener('click', async function() {
            var voiceId = ttsTestVoiceEl ? ttsTestVoiceEl.value : '';
            if (!voiceId) return;
            if (ttsPreviewAudio) { ttsPreviewAudio.pause(); ttsPreviewAudio = null; }
            flashButton(ttsPreviewVoiceBtnEl);
            setBusy(ttsPreviewVoiceBtnEl, true);
            if (ttsTestHintEl) ttsTestHintEl.textContent = 'Generating preview…';
            try {
              var r = await fetch('/api/tts/preview/' + encodeURIComponent(voiceId));
              if (!r.ok) throw new Error('Preview failed');
              var blob = await r.blob();
              var url = URL.createObjectURL(blob);
              ttsPreviewAudio = new Audio(url);
              ttsPreviewAudio.volume = 0.6;
              ttsPreviewAudio.onended = function() { URL.revokeObjectURL(url); ttsPreviewAudio = null; };
              await ttsPreviewAudio.play();
              if (ttsTestHintEl) ttsTestHintEl.textContent = '';
            } catch (err) {
              if (ttsTestHintEl) ttsTestHintEl.textContent = 'Preview failed';
            }
            setBusy(ttsPreviewVoiceBtnEl, false);
          });
        }

        // Test TTS (sends to overlay)
        if (ttsTestBtnEl) {
          ttsTestBtnEl.addEventListener('click', async function() {
            var voiceId = ttsTestVoiceEl ? ttsTestVoiceEl.value : '';
            var message = ttsTestMessageEl ? ttsTestMessageEl.value.trim() : '';
            if (!voiceId || !message) { if (ttsTestHintEl) ttsTestHintEl.textContent = 'Select a voice and enter a message'; return; }
            flashButton(ttsTestBtnEl);
            setBusy(ttsTestBtnEl, true);
            if (ttsTestHintEl) ttsTestHintEl.textContent = 'Generating…';
            try {
              var r = await fetch('/api/tts/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: message, voiceId: voiceId })
              });
              if (!r.ok) { var body = await r.json().catch(function() { return {}; }); throw new Error(body.error || 'Test failed'); }
              if (ttsTestHintEl) { ttsTestHintEl.textContent = 'Sent to overlay!'; setTimeout(function() { ttsTestHintEl.textContent = ''; }, 2500); }
            } catch (err) {
              if (ttsTestHintEl) ttsTestHintEl.textContent = err.message || 'Test failed';
            }
            setBusy(ttsTestBtnEl, false);
          });
        }

        // Skip alert (stops current playback on overlay)
        var skipAlertBtnEl = document.getElementById('skipAlertBtn');
        if (skipAlertBtnEl) {
          skipAlertBtnEl.addEventListener('click', async function() {
            try {
              await fetch('/api/tts/skip', { method: 'POST' });
            } catch {}
          });
        }

        // Save TTS settings
        if (saveTtsBtnEl) {
          saveTtsBtnEl.addEventListener('click', async function() {
            flashButton(saveTtsBtnEl);
            setBusy(saveTtsBtnEl, true);
            try {
              var bannedRaw = ttsBannedWordsEl ? ttsBannedWordsEl.value : '';
              var bannedWords = bannedRaw.split(',').map(function(w) { return w.trim(); }).filter(Boolean);
              var payload = {
                enabled: ttsEnabledEl ? ttsEnabledEl.checked : false,
                tier: ttsTierEl ? ttsTierEl.value : 'sound_300',
                volume: ttsVolumeEl2 ? Number(ttsVolumeEl2.value) : 80,
                cooldownMs: ttsCooldownEl ? Number(ttsCooldownEl.value) * 1000 : 10000,
                maxMessageLength: ttsMaxLengthEl ? Number(ttsMaxLengthEl.value) : 200,
                moderationEnabled: ttsModerationEl ? ttsModerationEl.checked : true,
                bannedWords: bannedWords,
                allowedVoices: Array.from(ttsAllowedSet)
              };
              var r = await fetch(TTS_API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });
              if (!r.ok) { var body = await r.json().catch(function() { return {}; }); throw new Error(body.error || 'Save failed'); }
              if (ttsSettingsHintEl2) {
                ttsSettingsHintEl2.textContent = 'TTS settings saved!';
                setTimeout(function() { ttsSettingsHintEl2.textContent = ''; }, 2500);
              }
            } catch (err) {
              if (ttsSettingsHintEl2) ttsSettingsHintEl2.textContent = err.message || 'Save failed';
            }
            setBusy(saveTtsBtnEl, false);
          });
        }

        // ===== Alert Queue =====
        var alertQueueListEl = document.getElementById('alertQueueList');
        var alertQueueEmptyEl = document.getElementById('alertQueueEmpty');
        var queueCountEl = document.getElementById('queueCount');
        var queueRefreshBtn = document.getElementById('queueRefreshBtn');
        var queueSkipAllBtn = document.getElementById('queueSkipAllBtn');
        var queueAutoRefreshInterval = null;

        function timeAgoShort(ms) {
          var s = Math.floor((Date.now() - ms) / 1000);
          if (s < 60) return s + 's ago';
          return Math.floor(s / 60) + 'm ago';
        }

        function renderQueue(queue) {
          alertQueueListEl.textContent = '';
          if (!queue || queue.length === 0) {
            if (alertQueueEmptyEl) alertQueueEmptyEl.style.display = '';
            if (queueCountEl) queueCountEl.textContent = '';
            return;
          }
          if (alertQueueEmptyEl) alertQueueEmptyEl.style.display = 'none';
          if (queueCountEl) queueCountEl.textContent = '(' + queue.length + ')';

          queue.forEach(function(item, idx) {
            var row = document.createElement('div');
            row.style.cssText = 'display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--surface-border);';

            var badge = document.createElement('span');
            badge.style.cssText = 'flex-shrink:0; padding:2px 7px; border-radius:4px; font-size:11px; font-weight:700; letter-spacing:.03em;';
            if (item.type === 'tts') {
              badge.textContent = 'TTS';
              badge.style.background = '#0ea5e933';
              badge.style.color = '#38bdf8';
            } else {
              badge.textContent = item.type === 'clip' ? 'CLIP' : item.type === 'video' ? 'VIDEO' : 'SOUND';
              badge.style.background = '#9146ff33';
              badge.style.color = '#bf94ff';
            }

            var info = document.createElement('div');
            info.style.cssText = 'flex:1; min-width:0;';

            var nameDiv = document.createElement('div');
            nameDiv.style.cssText = 'font-weight:600; font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
            nameDiv.textContent = item.soundName || '--';
            info.appendChild(nameDiv);

            var meta = document.createElement('div');
            meta.style.cssText = 'font-size:11px; color:var(--text-muted); margin-top:2px;';
            var parts = [];
            if (item.bitsAmount) parts.push(item.bitsAmount + ' Bits');
            if (item.viewerDisplayName) parts.push('by ' + item.viewerDisplayName);
            else if (item.viewerUserId) parts.push('by user ' + item.viewerUserId);
            parts.push(timeAgoShort(item.enqueuedAt));
            meta.textContent = parts.join(' · ');
            info.appendChild(meta);

            var skipBtn = document.createElement('button');
            skipBtn.className = 'secondary';
            skipBtn.style.cssText = 'flex-shrink:0; font-size:11px; padding:3px 10px; color:#ef4444; border-color:#ef4444;';
            skipBtn.textContent = idx === 0 ? 'Skip' : 'Remove';
            skipBtn.addEventListener('click', function() {
              skipBtn.disabled = true;
              skipBtn.textContent = '...';
              fetch(API_BASE + '/queue/remove', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alertId: item.alertId }),
              }).then(function() { fetchQueue(); }).catch(function() {
                skipBtn.disabled = false;
                skipBtn.textContent = idx === 0 ? 'Skip' : 'Remove';
              });
            });

            row.appendChild(badge);
            row.appendChild(info);
            row.appendChild(skipBtn);
            alertQueueListEl.appendChild(row);
          });
        }

        function fetchQueue() {
          fetch(API_BASE + '/queue', { credentials: 'same-origin' })
            .then(function(r) { return r.json(); })
            .then(function(data) { renderQueue(data.queue || []); })
            .catch(function() {});
        }

        if (queueRefreshBtn) queueRefreshBtn.addEventListener('click', fetchQueue);
        if (queueSkipAllBtn) {
          queueSkipAllBtn.addEventListener('click', function() {
            fetch('/api/tts/skip', { method: 'POST', credentials: 'same-origin' })
              .then(function() { fetchQueue(); });
          });
        }

        document.querySelectorAll('.sidebar-nav-item').forEach(function(btn) {
          btn.addEventListener('click', function() {
            if (btn.getAttribute('data-section') === 'queue') {
              fetchQueue();
              if (!queueAutoRefreshInterval) {
                queueAutoRefreshInterval = setInterval(fetchQueue, 4000);
              }
            } else {
              if (queueAutoRefreshInterval) {
                clearInterval(queueAutoRefreshInterval);
                queueAutoRefreshInterval = null;
              }
            }
          });
        });

        // ===== Alert History & Overlay Status =====
        var alertHistoryListEl = document.getElementById('alertHistoryList');
        var alertHistoryEmptyEl = document.getElementById('alertHistoryEmpty');
        var overlayStatusEl = document.getElementById('overlayStatus');
        var refreshHistoryBtn = document.getElementById('refreshHistory');

        async function fetchOverlayStatus() {
          try {
            var r = await fetch('/api/overlay/status');
            var data = await r.json();
            if (overlayStatusEl) {
              overlayStatusEl.textContent = '';
              var dot = document.createElement('span');
              dot.className = data.connected ? 'overlay-online' : 'overlay-offline';
              dot.textContent = '\\u25CF ';
              overlayStatusEl.appendChild(dot);
              var label = data.connected
                ? 'Overlay connected' + (data.clients > 1 ? ' (' + data.clients + ' clients)' : '')
                : 'Overlay not connected';
              overlayStatusEl.appendChild(document.createTextNode(label));
            }
          } catch {
            if (overlayStatusEl) overlayStatusEl.textContent = 'Status unknown';
          }
        }

        function formatTime(ts) {
          var d = new Date(ts);
          var now = new Date();
          var diff = now - d;
          if (diff < 60000) return 'just now';
          if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
          if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
          return d.toLocaleDateString();
        }

        function buildAlertRow(e) {
          var row = document.createElement('div');
          row.className = 'alert-row';

          var timeEl = document.createElement('span');
          timeEl.className = 'alert-time';
          timeEl.textContent = formatTime(e.ts);
          row.appendChild(timeEl);

          var iconEl = document.createElement('span');
          iconEl.style.fontSize = '16px';
          if (e.type === 'tts_alert') iconEl.textContent = '\\u{1F5E3}';
          else if (e.alertType === 'clip') iconEl.textContent = '\\u{1F3AC}';
          else if (e.alertType === 'video') iconEl.textContent = '\\u{1F4F9}';
          else iconEl.textContent = '\\u{1F50A}';
          row.appendChild(iconEl);

          var info = document.createElement('div');
          info.className = 'alert-info';

          var nameEl = document.createElement('div');
          nameEl.className = 'alert-name';
          nameEl.textContent = e.type === 'tts_alert' ? (e.voiceName || 'TTS') : (e.soundName || 'Sound');
          info.appendChild(nameEl);

          if (e.viewerDisplayName || e.viewerUserId) {
            var viewerEl = document.createElement('div');
            viewerEl.className = 'alert-viewer';
            viewerEl.textContent = 'by ' + (e.viewerDisplayName || 'user ' + e.viewerUserId);
            info.appendChild(viewerEl);
          }

          if (e.type === 'tts_alert' && e.message) {
            var msgEl = document.createElement('div');
            msgEl.className = 'alert-msg';
            msgEl.textContent = e.message;
            info.appendChild(msgEl);
          }

          row.appendChild(info);

          var replayBtn = document.createElement('button');
          replayBtn.className = 'secondary';
          replayBtn.textContent = 'Replay';
          if (e.type === 'tts_alert' && !e.voiceId) {
            replayBtn.disabled = true;
            replayBtn.title = 'Missing voice data for replay';
          }
          replayBtn.addEventListener('click', async function() {
            setBusy(replayBtn, true);
            replayBtn.textContent = 'Sending...';
            try {
              var r2 = await fetch('/api/alerts/replay/' + encodeURIComponent(e.id), { method: 'POST' });
              var result = await r2.json();
              if (result.ok) {
                replayBtn.textContent = result.sent > 0 ? 'Sent!' : 'No overlay';
              } else {
                replayBtn.textContent = result.error || 'Failed';
              }
            } catch {
              replayBtn.textContent = 'Error';
            }
            setTimeout(function() { replayBtn.textContent = 'Replay'; setBusy(replayBtn, false); }, 2000);
          });
          row.appendChild(replayBtn);

          return row;
        }

        async function fetchAlertHistory() {
          try {
            var r = await fetch('/api/events/log');
            var data = await r.json();
            var entries = (data.entries || []).filter(function(e) {
              return e.type === 'sound_alert' || e.type === 'tts_alert';
            });
            entries.reverse();

            if (!alertHistoryListEl) return;
            alertHistoryListEl.textContent = '';

            if (entries.length === 0) {
              if (alertHistoryEmptyEl) alertHistoryEmptyEl.style.display = '';
              return;
            }
            if (alertHistoryEmptyEl) alertHistoryEmptyEl.style.display = 'none';

            entries.slice(0, 50).forEach(function(e) {
              alertHistoryListEl.appendChild(buildAlertRow(e));
            });
          } catch {}
        }

        if (refreshHistoryBtn) {
          refreshHistoryBtn.addEventListener('click', function() {
            flashButton(refreshHistoryBtn);
            fetchAlertHistory();
            fetchOverlayStatus();
          });
        }

        // ===== Activity (top sounds / top viewers, last 30 days) =====
        function fetchActivity() {
          var topSoundsEl = document.getElementById('activityTopSounds');
          var topViewersEl = document.getElementById('activityTopViewers');
          fetch(API_BASE + '/activity')
            .then(function(r) { return r.json(); })
            .then(function(data) {
              if (data.error) throw new Error(data.error);
              renderActivityList(topSoundsEl, data.topSounds || [], function(row) {
                return row.sound_name + ' (' + row.count + (row.count === 1 ? ' play' : ' plays') + ')';
              }, 'No sound plays yet in the last 30 days.');
              renderActivityList(topViewersEl, data.topViewers || [], function(row) {
                return row.displayName + ' (' + row.count + (row.count === 1 ? ' alert' : ' alerts') + ')';
              }, 'No viewer activity yet in the last 30 days.');
            })
            .catch(function() {
              setActivityError(topSoundsEl);
              setActivityError(topViewersEl);
            });
        }

        function setActivityError(container) {
          if (!container) return;
          container.textContent = '';
          var msg = document.createElement('div');
          msg.className = 'hint';
          msg.textContent = 'Could not load activity.';
          container.appendChild(msg);
        }

        function renderActivityList(container, rows, formatRow, emptyText) {
          if (!container) return;
          container.textContent = '';
          if (!rows.length) {
            var empty = document.createElement('div');
            empty.className = 'hint';
            empty.textContent = emptyText;
            container.appendChild(empty);
            return;
          }
          var list = document.createElement('ol');
          list.style.cssText = 'margin:0; padding-left:20px; font-size:13px; line-height:1.9;';
          rows.forEach(function(row) {
            var li = document.createElement('li');
            li.textContent = formatRow(row);
            list.appendChild(li);
          });
          container.appendChild(list);
        }

        // Logout handler
        var logoutBtn = document.getElementById('logout');
        if (logoutBtn) {
          logoutBtn.addEventListener('click', function() {
            window.location.href = '/auth/logout';
          });
        }

        // Initial load
        logDashboardEvent('config_loaded');
        fetchSoundsAdmin();
        fetchLibrary();
        fetchTtsSettings();
        fetchAlertHistory();
        fetchOverlayStatus();
        fetchActivity();
      })();
    </script>
    ${!delegateMode ? `<script>
      (function() {
        var delegateListEl = document.getElementById('delegateList');
        var delegateAddBtn = document.getElementById('delegateAddBtn');
        var delegateLoginInput = document.getElementById('delegateLoginInput');
        var delegateAddStatus = document.getElementById('delegateAddStatus');
        if (!delegateListEl) return;

        function makeEmptyState(msg) {
          var d = document.createElement('div'); d.className = 'empty-state'; d.textContent = msg; return d;
        }

        function renderDelegates(delegates) {
          delegateListEl.textContent = '';
          if (!delegates || delegates.length === 0) {
            delegateListEl.appendChild(makeEmptyState('No delegates yet.'));
            return;
          }
          delegates.forEach(function(d) {
            var row = document.createElement('div');
            row.style.cssText = 'display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--surface-border);';
            var info = document.createElement('div'); info.style.flex = '1';
            var name = document.createElement('div'); name.style.fontWeight = '600'; name.style.fontSize = '13px'; name.textContent = d.displayName || d.userId;
            var id = document.createElement('div'); id.className = 'mono'; id.style.fontSize = '11px'; id.style.color = 'var(--text-muted)'; id.textContent = d.userId;
            info.appendChild(name); info.appendChild(id);
            var removeBtn = document.createElement('button');
            removeBtn.className = 'secondary';
            removeBtn.style.cssText = 'font-size:11px; padding:3px 10px; color:#ef4444; border-color:#ef4444;';
            removeBtn.textContent = 'Remove';
            removeBtn.addEventListener('click', function() {
              removeBtn.disabled = true;
              fetch('/api/delegate/' + encodeURIComponent(d.userId), { method: 'DELETE', credentials: 'same-origin' })
                .then(function() { fetchDelegates(); })
                .catch(function() { removeBtn.disabled = false; });
            });
            row.appendChild(info); row.appendChild(removeBtn);
            delegateListEl.appendChild(row);
          });
        }

        function fetchDelegates() {
          fetch('/api/delegate/list', { credentials: 'same-origin' })
            .then(function(r) { return r.json(); })
            .then(function(data) { renderDelegates(data.delegates || []); })
            .catch(function() { delegateListEl.appendChild(makeEmptyState('Failed to load.')); });
        }

        if (delegateAddBtn) {
          delegateAddBtn.addEventListener('click', function() {
            var login = delegateLoginInput ? delegateLoginInput.value.trim() : '';
            if (!login) return;
            delegateAddBtn.disabled = true;
            delegateAddStatus.style.display = 'inline';
            delegateAddStatus.style.color = 'var(--text-muted)';
            delegateAddStatus.textContent = 'Adding...';
            fetch('/api/delegate/add', {
              method: 'POST', credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ login: login }),
            })
              .then(function(r) { return r.json(); })
              .then(function(data) {
                if (data.error) {
                  delegateAddStatus.style.color = '#ef4444';
                  delegateAddStatus.textContent = data.error;
                } else {
                  delegateLoginInput.value = '';
                  delegateAddStatus.style.color = '#22c55e';
                  delegateAddStatus.textContent = (data.displayName || login) + ' added.';
                  fetchDelegates();
                }
              })
              .catch(function() {
                delegateAddStatus.style.color = '#ef4444';
                delegateAddStatus.textContent = 'Request failed.';
              })
              .finally(function() { delegateAddBtn.disabled = false; setTimeout(function() { delegateAddStatus.style.display = 'none'; }, 3000); });
          });
        }

        document.querySelectorAll('.sidebar-nav-item').forEach(function(btn) {
          btn.addEventListener('click', function() {
            if (btn.getAttribute('data-section') === 'delegates') fetchDelegates();
          });
        });
      })();
    </script>` : ''}
    <button class="tour-btn" id="tourBtn" title="Show guided tour">Take A Tour</button>
    <script src="https://cdn.jsdelivr.net/npm/driver.js@1.3.1/dist/driver.js.iife.js"></script>
    <script>
      (function() {
        var TOUR_KEY = 'sounds_tour_seen';
        function tourSwitchSection(s) {
          document.querySelectorAll('.section-page').forEach(function(el) { el.classList.toggle('active', el.getAttribute('data-section') === s); });
          document.querySelectorAll('.sidebar-nav-item').forEach(function(el) { el.classList.toggle('active', el.getAttribute('data-section') === s); });
          var livePreviewWrapEl = document.getElementById('livePreviewWrap');
          if (livePreviewWrapEl) livePreviewWrapEl.style.display = (s === 'alerts' || s === 'create') ? '' : 'none';
        }
        var tourSteps = [
          {
            element: '#copySoundUrl',
            popover: {
              title: 'Browser Source URL',
              description: 'Copy this URL and add it as a Browser Source in OBS. This is how sound alerts appear on your stream.',
              side: 'bottom', align: 'start'
            }
          },
          {
            element: '.sidebar-nav',
            popover: {
              title: 'Navigation',
              description: 'Use the sidebar to switch between sections: Alerts, Create, Library, Settings, TTS, and History.',
              side: 'right', align: 'start'
            }
          },
          {
            element: '#soundList',
            popover: {
              title: 'Your Alerts',
              description: 'All your alerts appear here. You can preview, edit, reorder, or delete them.',
              side: 'top', align: 'center'
            },
            onHighlightStarted: function() { tourSwitchSection('alerts'); }
          },
          {
            element: '#createAlertCard',
            popover: {
              title: 'Create Alert',
              description: 'Upload a sound, paste a Twitch clip URL, or upload a video. Each alert gets its own Bits tier and volume.',
              side: 'bottom', align: 'center'
            },
            onHighlightStarted: function() { tourSwitchSection('create'); }
          },
          {
            element: '.ext-promo',
            popover: {
              title: 'Twitch Extension',
              description: 'Install the companion extension so viewers can browse and trigger alerts directly from your channel page.',
              side: 'left', align: 'center'
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
