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
    ${renderThemeBootstrapScript()}
    ${renderFirebaseScript()}
    <style>
      ${THEME_CSS_VARS}
      body { margin: 0; font-family: Inter, system-ui, Arial, sans-serif; background: var(--page-bg); color: var(--text-color); min-height: 100vh; display: flex; flex-direction: column; }
      main { flex: 1; width: min(1200px, 100%); margin: 32px auto 48px; padding: 0 20px; display: flex; gap: 24px; }
      .sidebar { width: 200px; flex-shrink: 0; position: sticky; top: 32px; align-self: flex-start; }
      .sidebar-nav { display: flex; flex-direction: column; gap: 2px; }
      .sidebar-nav-item { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; color: var(--text-muted); background: transparent; border: none; text-align: left; width: 100%; transition: background .15s, color .15s; font-family: inherit; }
      .sidebar-nav-item:hover { background: var(--surface-color); color: var(--text-color); box-shadow: none; filter: none; }
      .sidebar-nav-item.active { background: #9146ff; color: #fff; }
      .content-area { flex: 1; min-width: 0; }
      .section-page { display: none; }
      .section-page.active { display: block; }
      @media (max-width: 768px) {
        main { flex-direction: column; }
        .sidebar { width: 100%; position: static; }
        .sidebar-nav { flex-direction: row; overflow-x: auto; gap: 4px; padding-bottom: 4px; }
        .sidebar-nav-item { white-space: nowrap; padding: 8px 12px; font-size: 13px; }
      }
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
      .badge-live { background: #eb0400; color: #fff; }
      .badge-online { background: #10b98133; color: #10b981; }
      .badge-offline { background: #94a3b833; color: #94a3b8; }
      .badge-paused { background: #f59e0b33; color: #f59e0b; }
      .badge-capped { background: #ef444433; color: #ef4444; }
      .badge-banned { background: #dc262633; color: #dc2626; }
      .broadcasters-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; font-size: 13px; }
      .broadcasters-toolbar select { padding: 4px 8px; border-radius: 6px; border: 1px solid var(--surface-border); background: var(--surface-muted); color: var(--text-color); font-size: 12px; }
      .broadcasters-toolbar button { padding: 4px 10px; border-radius: 6px; border: 1px solid var(--surface-border); background: var(--surface-muted); color: var(--text-color); font-size: 12px; cursor: pointer; }
      .broadcasters-toolbar button:disabled { opacity: 0.4; cursor: default; }
      .broadcasters-toolbar .spacer { flex: 1; }
      #backToTopBtn { position: fixed; bottom: 24px; right: 24px; z-index: 50; background: #9146ff; color: #fff; border: none; border-radius: 999px; padding: 10px 16px; font-size: 12px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: none; }
      #backToTopBtn:hover { background: #7c3aed; }
      .btn-ban { background: #dc2626; color: #fff; border: none; padding: 4px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; font-weight: 600; }
      .btn-ban:hover { background: #b91c1c; }
      .btn-unban { background: #16a34a; color: #fff; border: none; padding: 4px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; font-weight: 600; }
      .btn-unban:hover { background: #15803d; }
      .btn-delete { background: #7f1d1d; color: #fff; border: none; padding: 4px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; font-weight: 600; }
      .btn-delete:hover { background: #991b1b; }
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
      .log-box { padding: 10px; background: var(--surface-muted); border: 1px solid var(--surface-border); border-radius: 8px; max-height: 500px; overflow-y: auto; font-size: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      .log-line { margin-bottom: 4px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
      .log-time { color: var(--text-muted); margin-right: 8px; }
      .log-type { display: inline-block; min-width: 100px; color: #9146ff; }
      .log-detail { opacity: 0.85; }
      .log-toolbar { display: flex; gap: 10px; align-items: center; margin-bottom: 12px; flex-wrap: wrap; }
      .log-toolbar select { padding: 6px 10px; border-radius: 8px; border: 1px solid var(--surface-border); background: var(--surface-muted); color: var(--text-color); font-size: 13px; min-width: 200px; }
      .log-toolbar button { background: #9146ff; color: #fff; border: none; padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; }
      .log-toolbar button:hover { background: #7c3aed; }
      .log-toolbar .log-status { font-size: 12px; color: var(--text-muted); }
      .analytics-sku-badge { display:inline-block; padding:1px 7px; border-radius:999px; font-size:11px; font-weight:600; margin-right:4px; }
      .analytics-sku-sound { background:#9146ff33; color:#bf94ff; }
      .analytics-sku-tts   { background:#0ea5e933; color:#38bdf8; }
      .analytics-bar { height:6px; border-radius:3px; background:#9146ff; display:inline-block; min-width:2px; vertical-align:middle; }
      .analytics-streamer-row { cursor:pointer; transition:background .1s; }
      .analytics-streamer-row:hover td { background:var(--surface-muted); }
      .analytics-streamer-row.selected td { background:#9146ff22; }
      .detail-section { margin-bottom:14px; }
      .detail-section h3 { font-size:13px; font-weight:700; margin:0 0 8px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.04em; }
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
      showUtilitiesLink: true,
      showLogout: true,
    })}
    <main>
      <nav class="sidebar">
        <div class="sidebar-nav">
          <button class="sidebar-nav-item active" data-section="overview">Overview</button>
          <button class="sidebar-nav-item" data-section="health">Server Health</button>
          <button class="sidebar-nav-item" data-section="banner">Banner</button>
          <button class="sidebar-nav-item" data-section="tts-config">TTS Config</button>
          <button class="sidebar-nav-item" data-section="test-alerts">Test Alerts</button>
          <button class="sidebar-nav-item" data-section="library-moderation">Library Moderation</button>
          <button class="sidebar-nav-item" data-section="official-library">Official Library</button>
          <button class="sidebar-nav-item" data-section="event-logs">Event Logs</button>
          <button class="sidebar-nav-item" data-section="broadcasters">Broadcasters</button>
          <button class="sidebar-nav-item" data-section="analytics">Analytics</button>
        </div>
      </nav>
      <div class="content-area">
      <h1>Admin Dashboard</h1>
      <p class="subtitle">Service usage overview. Auto-refreshes every 10 seconds.</p>

      <div class="section-page active" data-section="overview">
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
      </div>

      <div class="section-page" data-section="health">
      <div class="table-card">
        <h2>Server Health</h2>
        <div id="serverHealth" class="server-health-grid">
          <div class="empty-state">Loading...</div>
        </div>
      </div>
      </div>

      <div class="section-page" data-section="banner">
      <div class="table-card">
        <h2>Config Panel Banner</h2>
        <div style="font-size:12px; color:var(--text-muted); margin-bottom:12px;">Shown at the top of every broadcaster's Twitch config panel. Use it for release notes, incidents, or announcements.</div>
        <label style="display:flex; align-items:center; gap:6px; font-size:13px; font-weight:normal; margin-bottom:10px;">
          <input type="checkbox" id="bannerEnabled"> Enabled
        </label>
        <label style="display:block; font-size:13px; font-weight:600; margin-bottom:6px;">Message</label>
        <textarea id="bannerMessage" placeholder="e.g. Text-to-Speech alerts are now live!" rows="2" maxlength="500" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--surface-border); background:var(--surface-muted); color:var(--text-color); font-size:13px; margin-bottom:10px; resize:vertical; font-family:inherit; box-sizing:border-box;"></textarea>
        <div style="display:grid; grid-template-columns:2fr 1fr; gap:10px; margin-bottom:10px;">
          <div>
            <label style="display:block; font-size:13px; font-weight:600; margin-bottom:6px;">Link URL (optional)</label>
            <input type="url" id="bannerLinkUrl" placeholder="https://discord.gg/..." style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--surface-border); background:var(--surface-muted); color:var(--text-color); font-size:13px; box-sizing:border-box;">
          </div>
          <div>
            <label style="display:block; font-size:13px; font-weight:600; margin-bottom:6px;">Link Text</label>
            <input type="text" id="bannerLinkText" placeholder="Join our Discord" maxlength="60" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--surface-border); background:var(--surface-muted); color:var(--text-color); font-size:13px; box-sizing:border-box;">
          </div>
        </div>
        <div style="font-size:11px; color:var(--text-muted); margin-bottom:10px;">Link URL must start with http:// or https://. Leave blank to show a plain message with no link.</div>
        <div>
          <button class="btn-save" id="bannerSaveBtn">Save Banner</button>
          <span id="bannerSaveStatus" class="tts-status" style="display:none; margin-left: 10px;"></span>
        </div>
      </div>
      </div>

      <div class="section-page" data-section="tts-config">
      <div class="table-card">
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
        <div style="margin-top: 16px;">
          <label style="display:block; font-size:13px; font-weight:600; margin-bottom:6px;">Moderation Settings</label>
          <div style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">These settings apply globally to all streamers (in addition to each streamer's own banned words and moderation toggle).</div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px 18px;">
            <label style="display:flex; align-items:center; gap:6px; font-size:13px; font-weight:normal;">
              <input type="checkbox" id="modOffensive"> Offensive content filter (slurs, hate speech, threats)
            </label>
            <label style="display:flex; align-items:center; gap:6px; font-size:13px; font-weight:normal;">
              <input type="checkbox" id="modBlockUrls"> Block URLs in messages
            </label>
            <label style="display:flex; align-items:center; gap:6px; font-size:13px; font-weight:normal;">
              <input type="checkbox" id="modCaps"> Caps filter
            </label>
            <div style="display:flex; align-items:center; gap:6px; font-size:13px;">
              <span style="white-space:nowrap;">Caps ratio:</span>
              <input type="number" id="modCapsRatio" min="1" max="100" style="width:55px; padding:3px 6px; border-radius:4px; border:1px solid var(--surface-border); background:var(--surface-muted); color:var(--text-color); font-size:12px;">
              <span style="opacity:0.6;">%</span>
              <span style="white-space:nowrap; margin-left:8px;">Min length:</span>
              <input type="number" id="modCapsMinLen" min="1" max="500" style="width:55px; padding:3px 6px; border-radius:4px; border:1px solid var(--surface-border); background:var(--surface-muted); color:var(--text-color); font-size:12px;">
            </div>
            <label style="display:flex; align-items:center; gap:6px; font-size:13px; font-weight:normal;">
              <input type="checkbox" id="modRepeat"> Repeat character filter
            </label>
            <div style="display:flex; align-items:center; gap:6px; font-size:13px;">
              <span style="white-space:nowrap;">Repeat threshold:</span>
              <input type="number" id="modRepeatThreshold" min="2" max="50" style="width:55px; padding:3px 6px; border-radius:4px; border:1px solid var(--surface-border); background:var(--surface-muted); color:var(--text-color); font-size:12px;">
              <span style="opacity:0.6;">chars</span>
            </div>
          </div>
        </div>
      </div>
      </div>

      <div class="section-page" data-section="test-alerts">
      <div class="table-card">
        <h2>Test Alerts</h2>
        <div style="font-size:12px; color:var(--text-muted); margin-bottom:12px;">Trigger sound or TTS alerts without Bits. Useful for testing overlay playback. The alert will be sent to the broadcaster's OBS overlay via SSE.</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:18px;">
          <div>
            <label style="display:block; font-size:13px; font-weight:600; margin-bottom:6px;">Broadcaster</label>
            <select id="testBroadcaster" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--surface-border); background:var(--surface-muted); color:var(--text-color); font-size:13px;">
              <option value="">Select a broadcaster...</option>
            </select>
          </div>
          <div></div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-top:14px;">
          <div style="padding:14px; background:var(--surface-muted); border-radius:10px;">
            <label style="display:block; font-size:13px; font-weight:600; margin-bottom:8px;">Sound Alert Test</label>
            <select id="testSoundSelect" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--surface-border); background:var(--page-bg); color:var(--text-color); font-size:13px; margin-bottom:8px;" disabled>
              <option value="">Select a broadcaster first</option>
            </select>
            <button class="btn-save" id="testSoundBtn" disabled style="padding:6px 14px; font-size:12px;">Test Sound</button>
            <span id="testSoundStatus" class="tts-status" style="display:none; margin-left:8px;"></span>
          </div>
          <div style="padding:14px; background:var(--surface-muted); border-radius:10px;">
            <label style="display:block; font-size:13px; font-weight:600; margin-bottom:8px;">TTS Alert Test</label>
            <select id="testTtsVoice" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--surface-border); background:var(--page-bg); color:var(--text-color); font-size:13px; margin-bottom:8px;" disabled>
              <option value="">Select a broadcaster first</option>
            </select>
            <textarea id="testTtsMessage" placeholder="Enter test message..." rows="2" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--surface-border); background:var(--page-bg); color:var(--text-color); font-size:13px; margin-bottom:8px; resize:vertical; font-family:inherit; box-sizing:border-box;" disabled></textarea>
            <button class="btn-save" id="testTtsBtn" disabled style="padding:6px 14px; font-size:12px;">Test TTS</button>
            <span id="testTtsStatus" class="tts-status" style="display:none; margin-left:8px;"></span>
          </div>
        </div>
      </div>
      </div>

      <div class="section-page" data-section="library-moderation">
      <div class="table-card">
        <h2>Library Moderation <span class="refresh-info" id="libraryModerationCount"></span></h2>
        <div style="font-size:12px; color:var(--text-muted); margin-bottom:12px;">Sounds a broadcaster has newly shared to the community library, awaiting approval before they become publicly visible.</div>
        <div id="libraryModerationList"><div class="empty-state">Loading...</div></div>
      </div>
      </div>

      <div class="section-page" data-section="official-library">
      <div class="table-card" style="margin-bottom:20px;">
        <h2>Add to Official Library</h2>
        <div style="font-size:12px; color:var(--text-muted); margin-bottom:12px;">Upload a properly-licensed sound (CC0 / public domain only). It's added directly to the community library for every broadcaster — no moderation queue, since this <em>is</em> the review. Record the source URL and license for our own paper trail.</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; max-width:700px; margin-bottom:10px;">
          <input type="file" id="officialFile" accept="audio/mpeg,audio/ogg,audio/wav,audio/webm,audio/mp4,audio/flac,.flac" style="grid-column:1 / -1; font-size:12px; color:var(--text-color);">
          <input type="text" id="officialName" placeholder="Sound name" style="padding:8px 10px; border-radius:8px; border:1px solid var(--surface-border); background:var(--surface-muted); color:var(--text-color); font-size:12px;">
          <input type="text" id="officialTags" placeholder="Tags (comma-separated, up to 5)" style="padding:8px 10px; border-radius:8px; border:1px solid var(--surface-border); background:var(--surface-muted); color:var(--text-color); font-size:12px;">
          <input type="text" id="officialSourceUrl" placeholder="Source URL (e.g. Freesound link)" style="padding:8px 10px; border-radius:8px; border:1px solid var(--surface-border); background:var(--surface-muted); color:var(--text-color); font-size:12px;">
          <input type="text" id="officialSourceLicense" placeholder="License (e.g. CC0)" style="padding:8px 10px; border-radius:8px; border:1px solid var(--surface-border); background:var(--surface-muted); color:var(--text-color); font-size:12px;">
        </div>
        <button class="btn-save" id="officialUploadBtn">Upload</button>
        <span id="officialUploadStatus" class="tts-status" style="display:none; margin-left:8px;"></span>
      </div>
      <div class="table-card">
        <h2>Official Library <span class="refresh-info" id="officialCount"></span></h2>
        <div id="officialList"><div class="empty-state">Loading...</div></div>
      </div>
      </div>

      <div class="section-page" data-section="event-logs">
      <div class="table-card">
        <h2>Event Logs</h2>
        <div class="log-toolbar">
          <select id="logBroadcaster">
            <option value="">Select a broadcaster...</option>
          </select>
          <button id="logRefreshBtn">Refresh</button>
          <span class="log-status" id="logStatus"></span>
        </div>
        <div id="logContainer" class="log-box" style="display:none;"></div>
        <div id="logEmpty" class="empty-state">Select a broadcaster to view their event log.</div>
      </div>
      </div>

      <div class="section-page" data-section="broadcasters">
      <div class="table-card">
        <h2>Broadcasters <span class="refresh-info" id="lastRefresh"></span></h2>
        <div class="broadcasters-toolbar">
          <label>Sort:
            <select id="broadcasterSort">
              <option value="live">Live first</option>
              <option value="newest">Newest users</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="last-event">Most recent event</option>
              <option value="time-added">Most time added</option>
            </select>
          </label>
          <label>Per page:
            <select id="broadcasterPageSize">
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="0">All</option>
            </select>
          </label>
          <span class="spacer"></span>
          <span id="broadcasterPageInfo" class="refresh-info"></span>
          <button id="broadcasterPrevBtn" type="button">&larr; Prev</button>
          <button id="broadcasterNextBtn" type="button">Next &rarr;</button>
        </div>
        <div id="tableContainer">
          <div class="empty-state">Loading...</div>
        </div>
      </div>
      </div>
      <button id="backToTopBtn" type="button">&uarr; Back to top</button>

      <div class="section-page" data-section="analytics">
      <div class="overview-grid" id="analyticsStats">
        <div class="stat-card"><div class="stat-value" id="anSoundBits">--</div><div class="stat-label">Sound Alert Bits</div></div>
        <div class="stat-card"><div class="stat-value" id="anTtsBits">--</div><div class="stat-label">TTS Bits</div></div>
        <div class="stat-card"><div class="stat-value" id="anSoundPlayed">--</div><div class="stat-label">Sound Plays</div></div>
        <div class="stat-card"><div class="stat-value" id="anTtsPlayed">--</div><div class="stat-label">TTS Plays</div></div>
        <div class="stat-card"><div class="stat-value" id="anFailedCount">--</div><div class="stat-label">Failed Redemptions</div></div>
        <div class="stat-card"><div class="stat-value" id="anRejectedCount">--</div><div class="stat-label">TTS Rejections</div></div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px;">
        <div class="table-card">
          <h2>Top SKUs</h2>
          <div id="analyticsSkuContainer"><div class="empty-state">Loading...</div></div>
        </div>
        <div class="table-card" id="analyticsStreamerDetail" style="display:none;">
          <h2 id="analyticsStreamerDetailTitle">Streamer Detail</h2>
          <div id="analyticsStreamerDetailBody"></div>
        </div>
      </div>
      <div class="table-card" style="margin-bottom:20px;">
        <h2>Setup Funnel by Language</h2>
        <div style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">Distinct broadcasters who opened the config panel vs. who went on to create at least one alert, grouped by Twitch's reported language for that session.</div>
        <div id="analyticsFunnelContainer"><div class="empty-state">Loading...</div></div>
      </div>
      <div class="table-card">
        <h2>Per-Streamer Breakdown <span class="refresh-info" id="analyticsRefreshInfo"></span></h2>
        <div id="analyticsStreamersContainer"><div class="empty-state">Loading...</div></div>
      </div>
      </div><!-- /section analytics -->

      </div><!-- /content-area -->
    </main>
    <script>
      (function() {
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

        var refreshInterval = 10000;
        var tableContainer = document.getElementById('tableContainer');
        var lastRefreshEl = document.getElementById('lastRefresh');

        // ===== Broadcasters: sort/pagination/back-to-top state =====
        var broadcasterSortEl = document.getElementById('broadcasterSort');
        var broadcasterPageSizeEl = document.getElementById('broadcasterPageSize');
        var broadcasterPageInfoEl = document.getElementById('broadcasterPageInfo');
        var broadcasterPrevBtn = document.getElementById('broadcasterPrevBtn');
        var broadcasterNextBtn = document.getElementById('broadcasterNextBtn');
        var backToTopBtn = document.getElementById('backToTopBtn');
        var broadcasterPage = 0; // zero-indexed
        var lastUsersData = null; // cached full user list from the last successful poll

        function sortUsers(users, sortKey) {
          var sorted = users.slice();
          sorted.sort(function(a, b) {
            switch (sortKey) {
              case 'name-asc':
                return (a.displayName || a.login || '').localeCompare(b.displayName || b.login || '');
              case 'name-desc':
                return (b.displayName || b.login || '').localeCompare(a.displayName || a.login || '');
              case 'last-event':
                return (Date.parse(b.lastEventAt || '') || 0) - (Date.parse(a.lastEventAt || '') || 0);
              case 'time-added':
                return (b.additionsTotal || 0) - (a.additionsTotal || 0);
              case 'newest':
                return (Date.parse(b.firstSeenAt || '') || 0) - (Date.parse(a.firstSeenAt || '') || 0);
              case 'live':
              default:
                if (a.live !== b.live) return a.live ? -1 : 1;
                if (a.connected !== b.connected) return a.connected ? -1 : 1;
                return (a.displayName || a.login || '').localeCompare(b.displayName || b.login || '');
            }
          });
          return sorted;
        }

        function renderBroadcasters() {
          if (!lastUsersData) return;
          var sortKey = broadcasterSortEl ? broadcasterSortEl.value : 'live';
          var pageSize = broadcasterPageSizeEl ? parseInt(broadcasterPageSizeEl.value, 10) : 25;
          var sorted = sortUsers(lastUsersData, sortKey);
          var total = sorted.length;
          var pageItems = sorted;
          if (pageSize > 0) {
            var totalPages = Math.max(1, Math.ceil(total / pageSize));
            if (broadcasterPage >= totalPages) broadcasterPage = totalPages - 1;
            if (broadcasterPage < 0) broadcasterPage = 0;
            var start = broadcasterPage * pageSize;
            pageItems = sorted.slice(start, start + pageSize);
            if (broadcasterPageInfoEl) {
              broadcasterPageInfoEl.textContent = total === 0 ? '' :
                'Showing ' + (start + 1) + '-' + Math.min(start + pageSize, total) + ' of ' + total;
            }
            if (broadcasterPrevBtn) broadcasterPrevBtn.disabled = broadcasterPage <= 0;
            if (broadcasterNextBtn) broadcasterNextBtn.disabled = broadcasterPage >= totalPages - 1;
          } else {
            if (broadcasterPageInfoEl) broadcasterPageInfoEl.textContent = total === 0 ? '' : 'Showing all ' + total;
            if (broadcasterPrevBtn) broadcasterPrevBtn.disabled = true;
            if (broadcasterNextBtn) broadcasterNextBtn.disabled = true;
          }
          renderBroadcasterTable(pageItems);
        }

        if (broadcasterSortEl) broadcasterSortEl.addEventListener('change', function() { broadcasterPage = 0; renderBroadcasters(); });
        if (broadcasterPageSizeEl) broadcasterPageSizeEl.addEventListener('change', function() { broadcasterPage = 0; renderBroadcasters(); });
        if (broadcasterPrevBtn) broadcasterPrevBtn.addEventListener('click', function() { broadcasterPage--; renderBroadcasters(); });
        if (broadcasterNextBtn) broadcasterNextBtn.addEventListener('click', function() { broadcasterPage++; renderBroadcasters(); });

        if (backToTopBtn) {
          window.addEventListener('scroll', function() {
            backToTopBtn.style.display = window.scrollY > 400 ? 'block' : 'none';
          });
          backToTopBtn.addEventListener('click', function() {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          });
        }

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

          lastUsersData = data.users || [];
          if (lastUsersData.length === 0) {
            tableContainer.textContent = 'No registered broadcasters yet.';
            return;
          }
          renderBroadcasters();
        }

        function renderBroadcasterTable(users) {
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
            var nameText = u.displayName || u.login || 'Unknown';
            if (u.login) {
              var nameLink = document.createElement('a');
              nameLink.href = 'https://twitch.tv/' + encodeURIComponent(u.login);
              nameLink.target = '_blank';
              nameLink.rel = 'noopener noreferrer';
              nameLink.textContent = nameText;
              nameLink.style.cssText = 'color:inherit; text-decoration:none;';
              nameLink.addEventListener('mouseenter', function() { this.style.textDecoration = 'underline'; });
              nameLink.addEventListener('mouseleave', function() { this.style.textDecoration = 'none'; });
              nameDiv.appendChild(nameLink);
            } else {
              nameDiv.textContent = nameText;
            }
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
            if (u.live) addBadge('LIVE' + (u.viewerCount != null ? ' \\u00b7 ' + u.viewerCount : ''), 'badge-live');
            if (u.connected) addBadge('Connected', 'badge-online');
            else addBadge('Not Connected', 'badge-offline');
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
            var manageLink = document.createElement('a');
            manageLink.href = '/admin/broadcaster/' + encodeURIComponent(u.userId);
            manageLink.textContent = 'Manage';
            manageLink.style.cssText = 'font-size:12px; color:#9146ff; font-weight:600; margin-right:6px; text-decoration:none;';
            tdActions.appendChild(manageLink);
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
            // Delete user data
            var delBtn = document.createElement('button');
            delBtn.className = 'btn-delete';
            delBtn.textContent = 'Delete';
            delBtn.style.marginLeft = '4px';
            delBtn.addEventListener('click', function() { doDeleteUser(u.userId, u.displayName || u.login || u.userId); });
            tdActions.appendChild(delBtn);
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
              if (typeof populateTestBroadcasters === 'function') populateTestBroadcasters(data.users || []);
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

        function doDeleteUser(userId, displayName) {
          if (!confirm('DELETE ALL DATA for ' + displayName + ' (' + userId + ')? This cannot be undone.')) return;
          if (!confirm('Are you absolutely sure? This will permanently delete their profile, settings, sounds, goals, timer state, and all uploaded content.')) return;
          fetch('/api/admin/users/' + encodeURIComponent(userId), {
            method: 'DELETE',
            credentials: 'same-origin'
          })
          .then(function(r) { return r.json(); })
          .then(function(data) {
            if (data.error) { alert('Error: ' + data.error); return; }
            alert('Deleted data for ' + displayName + ': ' + (data.deleted || []).join(', '));
            refresh();
          })
          .catch(function() { alert('Delete request failed'); });
        }

        refresh();
        setInterval(refresh, refreshInterval);

        // ===== TTS Global Config =====
        var ttsMinTierSelect = document.getElementById('ttsMinTier');
        var ttsVoiceGrid = document.getElementById('ttsVoiceGrid');
        var ttsSaveBtn = document.getElementById('ttsSaveBtn');
        var ttsSaveStatus = document.getElementById('ttsSaveStatus');
        var ttsAllVoices = [];
        var ttsCurrentConfig = { minTier: 'sound_300', availableVoices: [], moderation: {} };
        var previewAudio = null;

        // Moderation elements
        var modOffensiveEl = document.getElementById('modOffensive');
        var modBlockUrlsEl = document.getElementById('modBlockUrls');
        var modCapsEl = document.getElementById('modCaps');
        var modCapsRatioEl = document.getElementById('modCapsRatio');
        var modCapsMinLenEl = document.getElementById('modCapsMinLen');
        var modRepeatEl = document.getElementById('modRepeat');
        var modRepeatThresholdEl = document.getElementById('modRepeatThreshold');

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
              populateModerationFields();
            })
            .catch(function() {});
        }

        function populateModerationFields() {
          var m = ttsCurrentConfig.moderation || {};
          modOffensiveEl.checked = m.offensiveFilterEnabled !== false;
          modBlockUrlsEl.checked = m.blockUrls === true;
          modCapsEl.checked = m.capsFilterEnabled !== false;
          modCapsRatioEl.value = m.capsRatio || 80;
          modCapsMinLenEl.value = m.capsMinLength || 20;
          modRepeatEl.checked = m.repeatFilterEnabled !== false;
          modRepeatThresholdEl.value = m.repeatThreshold || 10;
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
              availableVoices: voicesToSend,
              moderation: {
                offensiveFilterEnabled: modOffensiveEl.checked,
                blockUrls: modBlockUrlsEl.checked,
                capsFilterEnabled: modCapsEl.checked,
                capsRatio: parseInt(modCapsRatioEl.value, 10) || 80,
                capsMinLength: parseInt(modCapsMinLenEl.value, 10) || 20,
                repeatFilterEnabled: modRepeatEl.checked,
                repeatThreshold: parseInt(modRepeatThresholdEl.value, 10) || 10
              }
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

        // ===== Banner =====
        var bannerEnabledEl = document.getElementById('bannerEnabled');
        var bannerMessageEl = document.getElementById('bannerMessage');
        var bannerLinkUrlEl = document.getElementById('bannerLinkUrl');
        var bannerLinkTextEl = document.getElementById('bannerLinkText');
        var bannerSaveBtn = document.getElementById('bannerSaveBtn');
        var bannerSaveStatus = document.getElementById('bannerSaveStatus');

        function fetchBannerConfig() {
          fetch('/api/admin/banner-config', { credentials: 'same-origin' })
            .then(function(r) { return r.json(); })
            .then(function(data) {
              if (data.error || !data.config) return;
              bannerEnabledEl.checked = !!data.config.enabled;
              bannerMessageEl.value = data.config.message || '';
              bannerLinkUrlEl.value = data.config.linkUrl || '';
              bannerLinkTextEl.value = data.config.linkText || '';
            })
            .catch(function() {});
        }

        function showBannerStatus(text, ok) {
          bannerSaveStatus.textContent = text;
          bannerSaveStatus.style.display = 'inline-block';
          bannerSaveStatus.style.background = ok ? '#10b98133' : '#ef444433';
          bannerSaveStatus.style.color = ok ? '#10b981' : '#ef4444';
          if (ok) setTimeout(function() { bannerSaveStatus.style.display = 'none'; }, 3000);
        }

        bannerSaveBtn.addEventListener('click', function() {
          bannerSaveBtn.disabled = true;
          fetch('/api/admin/banner-config', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              enabled: bannerEnabledEl.checked,
              message: bannerMessageEl.value,
              linkUrl: bannerLinkUrlEl.value.trim(),
              linkText: bannerLinkTextEl.value.trim(),
            })
          })
            .then(function(r) { return r.json(); })
            .then(function(data) {
              bannerSaveBtn.disabled = false;
              if (data.error) showBannerStatus('Error: ' + data.error, false);
              else showBannerStatus('Saved!', true);
            })
            .catch(function() {
              bannerSaveBtn.disabled = false;
              showBannerStatus('Save failed', false);
            });
        });

        fetchBannerConfig();

        // ===== Library Moderation =====
        var libraryModerationListEl = document.getElementById('libraryModerationList');
        var libraryModerationCountEl = document.getElementById('libraryModerationCount');

        function fetchLibraryModeration() {
          fetch('/api/admin/library/pending', { credentials: 'same-origin' })
            .then(function(r) { return r.json(); })
            .then(function(data) {
              if (data.error) return;
              renderLibraryModerationList(data.sounds || []);
            })
            .catch(function() {});
        }

        function renderLibraryModerationList(sounds) {
          if (!libraryModerationListEl) return;
          if (libraryModerationCountEl) {
            libraryModerationCountEl.textContent = sounds.length ? '(' + sounds.length + ' pending)' : '';
          }
          libraryModerationListEl.textContent = '';
          if (!sounds.length) {
            var empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'Nothing pending review.';
            libraryModerationListEl.appendChild(empty);
            return;
          }
          sounds.forEach(function(s) {
            var card = document.createElement('div');
            card.style.cssText = 'display:flex; align-items:center; gap:10px; padding:10px; background:var(--surface-muted); border-radius:8px; margin-bottom:8px;';

            var info = document.createElement('div');
            info.style.cssText = 'flex:1; min-width:0;';
            var nameDiv = document.createElement('div');
            nameDiv.style.cssText = 'font-weight:600; font-size:14px;';
            nameDiv.textContent = s.name;
            var metaDiv = document.createElement('div');
            metaDiv.style.cssText = 'font-size:12px; color:var(--text-muted);';
            metaDiv.textContent = 'by ' + (s.ownerDisplayName || s.ownerUserId) + (s.tags && s.tags.length ? ' \\u00b7 ' + s.tags.join(', ') : '');
            info.appendChild(nameDiv);
            info.appendChild(metaDiv);
            card.appendChild(info);

            var approveBtn = document.createElement('button');
            approveBtn.className = 'btn-unban';
            approveBtn.textContent = 'Approve';
            approveBtn.addEventListener('click', function() {
              fetch('/api/admin/library/' + encodeURIComponent(s.ownerUserId) + '/' + encodeURIComponent(s.id) + '/approve', {
                method: 'POST',
                credentials: 'same-origin',
              })
                .then(function(r) { return r.json(); })
                .then(function(data) {
                  if (data.error) { alert('Error: ' + data.error); return; }
                  fetchLibraryModeration();
                })
                .catch(function() { alert('Approve request failed'); });
            });
            card.appendChild(approveBtn);

            var rejectBtn = document.createElement('button');
            rejectBtn.className = 'btn-ban';
            rejectBtn.textContent = 'Reject';
            rejectBtn.style.marginLeft = '4px';
            rejectBtn.addEventListener('click', function() {
              fetch('/api/admin/library/' + encodeURIComponent(s.ownerUserId) + '/' + encodeURIComponent(s.id) + '/reject', {
                method: 'POST',
                credentials: 'same-origin',
              })
                .then(function(r) { return r.json(); })
                .then(function(data) {
                  if (data.error) { alert('Error: ' + data.error); return; }
                  fetchLibraryModeration();
                })
                .catch(function() { alert('Reject request failed'); });
            });
            card.appendChild(rejectBtn);

            libraryModerationListEl.appendChild(card);
          });
        }

        fetchLibraryModeration();

        // ===== Official Library =====
        var officialListEl = document.getElementById('officialList');
        var officialCountEl = document.getElementById('officialCount');
        var officialAudio = null;
        var officialPreviewBtn = null;

        function stopOfficialPreview() {
          if (officialAudio) { officialAudio.pause(); officialAudio = null; }
          if (officialPreviewBtn) { officialPreviewBtn.textContent = 'Preview'; officialPreviewBtn = null; }
        }

        function fetchOfficialLibrary() {
          fetch('/api/admin/official-library', { credentials: 'same-origin' })
            .then(function(r) { return r.json(); })
            .then(function(data) {
              if (data.error) return;
              renderOfficialList(data.sounds || []);
            })
            .catch(function() {});
        }

        function renderOfficialList(sounds) {
          if (!officialListEl) return;
          if (officialCountEl) officialCountEl.textContent = sounds.length ? '(' + sounds.length + ')' : '';
          officialListEl.textContent = '';
          if (!sounds.length) {
            var empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'No official sounds yet — upload one above.';
            officialListEl.appendChild(empty);
            return;
          }
          sounds.forEach(function(s) {
            var wrapper = document.createElement('div');
            wrapper.style.cssText = 'margin-bottom:8px;';

            var card = document.createElement('div');
            card.style.cssText = 'display:flex; align-items:center; gap:10px; padding:10px; background:var(--surface-muted); border-radius:8px;';

            var info = document.createElement('div');
            info.style.cssText = 'flex:1; min-width:0;';
            var nameDiv = document.createElement('div');
            nameDiv.style.cssText = 'font-weight:600; font-size:14px;';
            nameDiv.textContent = s.name;
            var metaDiv = document.createElement('div');
            metaDiv.style.cssText = 'font-size:12px; color:var(--text-muted);';
            var metaParts = [];
            if (s.tags && s.tags.length) metaParts.push(s.tags.join(', '));
            if (s.sourceLicense) metaParts.push(s.sourceLicense);
            metaDiv.textContent = metaParts.length ? metaParts.join(' \\u00b7 ') : 'No tags or source recorded';
            info.appendChild(nameDiv);
            info.appendChild(metaDiv);
            if (s.sourceUrl) {
              var srcLink = document.createElement('a');
              srcLink.href = s.sourceUrl;
              srcLink.target = '_blank';
              srcLink.rel = 'noopener noreferrer';
              srcLink.textContent = 'source';
              srcLink.style.cssText = 'font-size:11px; color:#9146ff;';
              info.appendChild(srcLink);
            }
            card.appendChild(info);

            var previewBtn = document.createElement('button');
            previewBtn.className = 'secondary';
            previewBtn.textContent = 'Preview';
            previewBtn.addEventListener('click', function() {
              var isPlaying = officialPreviewBtn === previewBtn;
              stopOfficialPreview();
              if (isPlaying) return;
              officialAudio = new Audio('/api/admin/official-library/' + encodeURIComponent(s.id) + '/audio');
              officialPreviewBtn = previewBtn;
              previewBtn.textContent = '\\u25A0 Stop';
              officialAudio.onended = stopOfficialPreview;
              officialAudio.onerror = stopOfficialPreview;
              officialAudio.play().catch(stopOfficialPreview);
            });
            card.appendChild(previewBtn);

            var editBtn = document.createElement('button');
            editBtn.textContent = 'Edit Tags';
            editBtn.addEventListener('click', function() {
              var newTags = prompt('Tags (comma-separated, up to 5):', (s.tags || []).join(', '));
              if (newTags === null) return;
              fetch('/api/admin/official-library/' + encodeURIComponent(s.id), {
                method: 'PUT',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tags: newTags })
              })
                .then(function(r) { return r.json(); })
                .then(function() { fetchOfficialLibrary(); })
                .catch(function() {});
            });
            card.appendChild(editBtn);

            // Trim panel — hidden until "Trim" is clicked, fetches duration
            // on first open, then posts trimStart/trimEnd on Apply.
            var trimPanel = document.createElement('div');
            trimPanel.style.cssText = 'display:none; margin-top:6px; padding:10px; background:var(--surface-color); border:1px solid var(--surface-border); border-radius:8px; font-size:12px;';

            var trimBtn = document.createElement('button');
            trimBtn.className = 'secondary';
            trimBtn.textContent = 'Trim';
            trimBtn.addEventListener('click', function() {
              var opening = trimPanel.style.display === 'none';
              trimPanel.style.display = opening ? 'block' : 'none';
              if (!opening || trimPanel.dataset.loaded) return;
              trimPanel.textContent = 'Loading duration…';
              fetch('/api/admin/official-library/' + encodeURIComponent(s.id) + '/duration', { credentials: 'same-origin' })
                .then(function(r) { return r.json(); })
                .then(function(data) {
                  if (data.error) { trimPanel.textContent = 'Error: ' + data.error; return; }
                  trimPanel.dataset.loaded = '1';
                  var duration = data.duration || 0;
                  trimPanel.textContent = '';

                  var label = document.createElement('div');
                  label.style.cssText = 'margin-bottom:6px; color:var(--text-muted);';
                  label.textContent = 'Full length: ' + duration.toFixed(1) + 's';
                  trimPanel.appendChild(label);

                  // Waveform + draggable dual-handle range slider. Handles
                  // are absolutely-positioned divs (not a native <input
                  // type=range> — no browser supports a two-thumb range
                  // natively) driven by mouse events; the numeric inputs
                  // below stay in sync for precise entry.
                  var waveWrap = document.createElement('div');
                  waveWrap.style.cssText = 'position:relative; height:64px; margin-bottom:10px; border-radius:6px; overflow:hidden; background:var(--surface-color); border:1px solid var(--surface-border); cursor:pointer; user-select:none;';
                  var waveCanvas = document.createElement('canvas');
                  waveCanvas.style.cssText = 'display:block; width:100%; height:64px;';
                  waveWrap.appendChild(waveCanvas);
                  var dimLeft = document.createElement('div');
                  dimLeft.style.cssText = 'position:absolute; top:0; bottom:0; left:0; width:0%; background:rgba(0,0,0,0.5); pointer-events:none;';
                  var dimRight = document.createElement('div');
                  dimRight.style.cssText = 'position:absolute; top:0; bottom:0; right:0; width:0%; background:rgba(0,0,0,0.5); pointer-events:none;';
                  waveWrap.appendChild(dimLeft);
                  waveWrap.appendChild(dimRight);
                  var handleStart = document.createElement('div');
                  handleStart.style.cssText = 'position:absolute; top:0; bottom:0; width:8px; left:0%; margin-left:-4px; background:#9146ff; cursor:ew-resize; border-radius:2px; box-shadow:0 0 0 1px rgba(255,255,255,0.5);';
                  var handleEnd = document.createElement('div');
                  handleEnd.style.cssText = 'position:absolute; top:0; bottom:0; width:8px; left:100%; margin-left:-4px; background:#9146ff; cursor:ew-resize; border-radius:2px; box-shadow:0 0 0 1px rgba(255,255,255,0.5);';
                  waveWrap.appendChild(handleStart);
                  waveWrap.appendChild(handleEnd);
                  trimPanel.appendChild(waveWrap);

                  var row = document.createElement('div');
                  row.style.cssText = 'display:flex; align-items:center; gap:6px; margin-bottom:8px;';
                  var startLabel = document.createElement('label');
                  startLabel.textContent = 'Start (s)';
                  var startInput = document.createElement('input');
                  startInput.type = 'number';
                  startInput.min = '0';
                  startInput.max = String(duration);
                  startInput.step = '0.1';
                  startInput.value = '0';
                  startInput.style.cssText = 'width:60px;';
                  var endLabel = document.createElement('label');
                  endLabel.textContent = 'End (s)';
                  var endInput = document.createElement('input');
                  endInput.type = 'number';
                  endInput.min = '0';
                  endInput.max = String(duration);
                  endInput.step = '0.1';
                  endInput.value = String(duration);
                  endInput.style.cssText = 'width:60px;';
                  row.appendChild(startLabel);
                  row.appendChild(startInput);
                  row.appendChild(endLabel);
                  row.appendChild(endInput);

                  var previewSelBtn = document.createElement('button');
                  previewSelBtn.className = 'secondary';
                  previewSelBtn.textContent = '\\u25B6 Preview selection';
                  previewSelBtn.disabled = true;
                  row.appendChild(previewSelBtn);

                  trimPanel.appendChild(row);

                  function updateHandles() {
                    var hs = parseFloat(startInput.value);
                    var he = parseFloat(endInput.value);
                    if (!isFinite(hs)) hs = 0;
                    if (!isFinite(he)) he = duration;
                    var sp = duration > 0 ? Math.max(0, Math.min(100, (hs / duration) * 100)) : 0;
                    var ep = duration > 0 ? Math.max(0, Math.min(100, (he / duration) * 100)) : 100;
                    handleStart.style.left = sp + '%';
                    handleEnd.style.left = ep + '%';
                    dimLeft.style.width = sp + '%';
                    dimRight.style.width = (100 - ep) + '%';
                  }
                  updateHandles();
                  startInput.addEventListener('input', updateHandles);
                  endInput.addEventListener('input', updateHandles);

                  var dragging = null;
                  function posToTime(clientX) {
                    var rect = waveWrap.getBoundingClientRect();
                    var x = Math.max(0, Math.min(rect.width, clientX - rect.left));
                    return rect.width > 0 ? (x / rect.width) * duration : 0;
                  }
                  function beginDrag(which) {
                    return function(ev) { ev.preventDefault(); dragging = which; };
                  }
                  handleStart.addEventListener('mousedown', beginDrag('start'));
                  handleEnd.addEventListener('mousedown', beginDrag('end'));
                  waveWrap.addEventListener('mousedown', function(ev) {
                    if (ev.target === handleStart || ev.target === handleEnd) return;
                    var t = posToTime(ev.clientX);
                    var s0 = parseFloat(startInput.value) || 0;
                    var e0 = parseFloat(endInput.value) || duration;
                    var which = Math.abs(t - s0) <= Math.abs(t - e0) ? 'start' : 'end';
                    dragging = which;
                    if (which === 'start') startInput.value = Math.max(0, Math.min(t, e0 - 0.1)).toFixed(2);
                    else endInput.value = Math.min(duration, Math.max(t, s0 + 0.1)).toFixed(2);
                    updateHandles();
                  });
                  window.addEventListener('mousemove', function(ev) {
                    if (!dragging) return;
                    var t = posToTime(ev.clientX);
                    if (dragging === 'start') {
                      var maxStart = (parseFloat(endInput.value) || duration) - 0.1;
                      startInput.value = Math.max(0, Math.min(t, maxStart)).toFixed(2);
                    } else {
                      var minEnd = (parseFloat(startInput.value) || 0) + 0.1;
                      endInput.value = Math.min(duration, Math.max(t, minEnd)).toFixed(2);
                    }
                    updateHandles();
                  });
                  window.addEventListener('mouseup', function() { dragging = null; });

                  // Waveform rendering + trimmed-selection playback preview
                  // are best-effort — if decoding fails (unsupported codec,
                  // network hiccup) the slider/inputs still work fine, just
                  // without the visual or the preview button.
                  var actx = null;
                  var decodedBuffer = null;
                  var activeSource = null;
                  fetch('/api/admin/official-library/' + encodeURIComponent(s.id) + '/audio', { credentials: 'same-origin' })
                    .then(function(r) { return r.arrayBuffer(); })
                    .then(function(buf) {
                      var Ctx = window.AudioContext || window.webkitAudioContext;
                      actx = new Ctx();
                      return actx.decodeAudioData(buf);
                    })
                    .then(function(buffer) {
                      decodedBuffer = buffer;
                      previewSelBtn.disabled = false;
                      var dpr = window.devicePixelRatio || 1;
                      var w = waveWrap.clientWidth || 300;
                      var h = 64;
                      waveCanvas.width = w * dpr;
                      waveCanvas.height = h * dpr;
                      var wctx = waveCanvas.getContext('2d');
                      wctx.scale(dpr, dpr);
                      var chan = buffer.getChannelData(0);
                      var step = Math.max(1, Math.ceil(chan.length / w));
                      var mid = h / 2;
                      wctx.strokeStyle = '#9146ff';
                      wctx.lineWidth = 1;
                      wctx.beginPath();
                      for (var i = 0; i < w; i++) {
                        var mn = 1.0, mx = -1.0;
                        for (var j = 0; j < step; j++) {
                          var idx = i * step + j;
                          if (idx >= chan.length) break;
                          var v = chan[idx];
                          if (v < mn) mn = v;
                          if (v > mx) mx = v;
                        }
                        if (mx < mn) { mn = 0; mx = 0; }
                        wctx.moveTo(i + 0.5, mid + mn * mid * 0.9);
                        wctx.lineTo(i + 0.5, mid + mx * mid * 0.9);
                      }
                      wctx.stroke();
                    })
                    .catch(function() {});

                  previewSelBtn.addEventListener('click', function() {
                    if (activeSource) {
                      try { activeSource.stop(); } catch (e) {}
                      activeSource = null;
                      previewSelBtn.textContent = '\\u25B6 Preview selection';
                      return;
                    }
                    if (!decodedBuffer || !actx) return;
                    var ps = parseFloat(startInput.value) || 0;
                    var pe = parseFloat(endInput.value) || duration;
                    if (pe <= ps) return;
                    var src = actx.createBufferSource();
                    src.buffer = decodedBuffer;
                    src.connect(actx.destination);
                    src.onended = function() {
                      activeSource = null;
                      previewSelBtn.textContent = '\\u25B6 Preview selection';
                    };
                    src.start(0, ps, pe - ps);
                    activeSource = src;
                    previewSelBtn.textContent = '\\u25A0 Stop';
                  });

                  var applyBtn = document.createElement('button');
                  applyBtn.className = 'btn-save';
                  applyBtn.textContent = 'Apply Trim';
                  var trimStatus = document.createElement('span');
                  trimStatus.style.cssText = 'margin-left:8px;';
                  applyBtn.addEventListener('click', function() {
                    applyBtn.disabled = true;
                    trimStatus.textContent = 'Trimming…';
                    fetch('/api/admin/official-library/' + encodeURIComponent(s.id) + '/trim', {
                      method: 'POST',
                      credentials: 'same-origin',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ trimStart: parseFloat(startInput.value), trimEnd: parseFloat(endInput.value) })
                    })
                      .then(function(r) { return r.json(); })
                      .then(function(result) {
                        applyBtn.disabled = false;
                        if (result.error) { trimStatus.textContent = 'Error: ' + result.error; return; }
                        trimStatus.textContent = 'Trimmed!';
                        delete trimPanel.dataset.loaded;
                        setTimeout(function() { trimPanel.style.display = 'none'; fetchOfficialLibrary(); }, 800);
                      })
                      .catch(function() {
                        applyBtn.disabled = false;
                        trimStatus.textContent = 'Trim failed';
                      });
                  });
                  trimPanel.appendChild(applyBtn);
                  trimPanel.appendChild(trimStatus);
                })
                .catch(function() { trimPanel.textContent = 'Failed to load duration'; });
            });
            card.appendChild(trimBtn);

            var delBtn = document.createElement('button');
            delBtn.className = 'btn-ban';
            delBtn.textContent = 'Delete';
            delBtn.addEventListener('click', function() {
              if (!confirm('Delete "' + s.name + '" from the official library? This removes it for everyone.')) return;
              fetch('/api/admin/official-library/' + encodeURIComponent(s.id), { method: 'DELETE', credentials: 'same-origin' })
                .then(function(r) { return r.json(); })
                .then(function() { fetchOfficialLibrary(); })
                .catch(function() {});
            });
            card.appendChild(delBtn);

            wrapper.appendChild(card);
            wrapper.appendChild(trimPanel);
            officialListEl.appendChild(wrapper);
          });
        }

        var officialUploadBtn = document.getElementById('officialUploadBtn');
        var officialUploadStatus = document.getElementById('officialUploadStatus');
        if (officialUploadBtn) {
          officialUploadBtn.addEventListener('click', function() {
            var fileInput = document.getElementById('officialFile');
            var file = fileInput && fileInput.files ? fileInput.files[0] : null;
            if (!file) { alert('Select an audio file first'); return; }
            officialUploadBtn.disabled = true;
            officialUploadStatus.style.display = 'inline-block';
            officialUploadStatus.textContent = 'Uploading…';
            var fd = new FormData();
            fd.append('file', file);
            fd.append('name', document.getElementById('officialName').value);
            fd.append('tags', document.getElementById('officialTags').value);
            fd.append('sourceUrl', document.getElementById('officialSourceUrl').value);
            fd.append('sourceLicense', document.getElementById('officialSourceLicense').value);
            fetch('/api/admin/official-library', { method: 'POST', credentials: 'same-origin', body: fd })
              .then(function(r) { return r.json(); })
              .then(function(data) {
                officialUploadBtn.disabled = false;
                if (data.error) { officialUploadStatus.textContent = 'Error: ' + data.error; return; }
                officialUploadStatus.textContent = 'Uploaded!';
                setTimeout(function() { officialUploadStatus.style.display = 'none'; }, 2500);
                fileInput.value = '';
                document.getElementById('officialName').value = '';
                document.getElementById('officialTags').value = '';
                document.getElementById('officialSourceUrl').value = '';
                document.getElementById('officialSourceLicense').value = '';
                fetchOfficialLibrary();
              })
              .catch(function() {
                officialUploadBtn.disabled = false;
                officialUploadStatus.textContent = 'Upload failed';
              });
          });
        }

        fetchOfficialLibrary();

        // ===== Test Alerts =====
        var testBroadcasterEl = document.getElementById('testBroadcaster');
        var testSoundSelectEl = document.getElementById('testSoundSelect');
        var testSoundBtn = document.getElementById('testSoundBtn');
        var testSoundStatus = document.getElementById('testSoundStatus');
        var testTtsVoiceEl = document.getElementById('testTtsVoice');
        var testTtsMessageEl = document.getElementById('testTtsMessage');
        var testTtsBtn = document.getElementById('testTtsBtn');
        var testTtsStatus = document.getElementById('testTtsStatus');
        var cachedBroadcasters = [];

        function populateTestBroadcasters(users) {
          cachedBroadcasters = users || [];
          var currentVal = testBroadcasterEl.value;
          testBroadcasterEl.textContent = '';
          var defaultOpt = document.createElement('option');
          defaultOpt.value = '';
          defaultOpt.textContent = 'Select a broadcaster...';
          testBroadcasterEl.appendChild(defaultOpt);
          cachedBroadcasters.forEach(function(u) {
            var opt = document.createElement('option');
            opt.value = u.userId;
            opt.textContent = (u.displayName || u.login || u.userId) + ' (' + u.userId + ')';
            if (u.userId === currentVal) opt.selected = true;
            testBroadcasterEl.appendChild(opt);
          });
        }

        testBroadcasterEl.addEventListener('change', function() {
          var uid = testBroadcasterEl.value;
          testSoundSelectEl.disabled = !uid;
          testSoundBtn.disabled = true;
          testTtsVoiceEl.disabled = !uid;
          testTtsMessageEl.disabled = !uid;
          testTtsBtn.disabled = !uid;
          testSoundSelectEl.textContent = '';
          if (!uid) {
            var ph = document.createElement('option');
            ph.value = '';
            ph.textContent = 'Select a broadcaster first';
            testSoundSelectEl.appendChild(ph);
            return;
          }
          // Load sounds for this broadcaster
          var loadOpt = document.createElement('option');
          loadOpt.value = '';
          loadOpt.textContent = 'Loading sounds...';
          testSoundSelectEl.appendChild(loadOpt);
          fetch('/api/admin/test/sounds/' + encodeURIComponent(uid), { credentials: 'same-origin' })
            .then(function(r) { return r.json(); })
            .then(function(data) {
              testSoundSelectEl.textContent = '';
              var sounds = data.sounds || [];
              if (sounds.length === 0) {
                var noOpt = document.createElement('option');
                noOpt.value = '';
                noOpt.textContent = 'No sounds configured';
                testSoundSelectEl.appendChild(noOpt);
              } else {
                sounds.forEach(function(s) {
                  var opt = document.createElement('option');
                  opt.value = s.id;
                  opt.textContent = s.name + ' (' + s.tier.replace('sound_', '') + ' Bits)';
                  testSoundSelectEl.appendChild(opt);
                });
                testSoundBtn.disabled = false;
              }
            })
            .catch(function() {
              testSoundSelectEl.textContent = '';
              var errOpt = document.createElement('option');
              errOpt.value = '';
              errOpt.textContent = 'Failed to load sounds';
              testSoundSelectEl.appendChild(errOpt);
            });
          // Populate TTS voices
          testTtsVoiceEl.textContent = '';
          ttsAllVoices.forEach(function(v) {
            var opt = document.createElement('option');
            opt.value = v.id;
            opt.textContent = v.name;
            testTtsVoiceEl.appendChild(opt);
          });
        });

        function showTestStatus(el, msg, isError) {
          el.textContent = msg;
          el.style.display = 'inline-block';
          el.style.background = isError ? '#ef444433' : '#10b98133';
          el.style.color = isError ? '#ef4444' : '#10b981';
          setTimeout(function() { el.style.display = 'none'; }, 4000);
        }

        testSoundBtn.addEventListener('click', function() {
          var uid = testBroadcasterEl.value;
          var soundId = testSoundSelectEl.value;
          if (!uid || !soundId) return;
          testSoundBtn.disabled = true;
          fetch('/api/admin/test/sound', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: uid, soundId: soundId })
          })
          .then(function(r) { return r.json(); })
          .then(function(data) {
            testSoundBtn.disabled = false;
            if (data.error) { showTestStatus(testSoundStatus, 'Error: ' + data.error, true); }
            else { showTestStatus(testSoundStatus, 'Sent: ' + (data.sound ? data.sound.name : 'OK'), false); }
          })
          .catch(function() {
            testSoundBtn.disabled = false;
            showTestStatus(testSoundStatus, 'Request failed', true);
          });
        });

        testTtsBtn.addEventListener('click', function() {
          var uid = testBroadcasterEl.value;
          var voiceId = testTtsVoiceEl.value;
          var message = testTtsMessageEl.value.trim();
          if (!uid || !voiceId || !message) {
            showTestStatus(testTtsStatus, 'Enter a message', true);
            return;
          }
          testTtsBtn.disabled = true;
          fetch('/api/admin/test/tts', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: uid, message: message, voiceId: voiceId })
          })
          .then(function(r) { return r.json(); })
          .then(function(data) {
            testTtsBtn.disabled = false;
            if (data.error) { showTestStatus(testTtsStatus, 'Error: ' + data.error, true); }
            else { showTestStatus(testTtsStatus, 'TTS sent to overlay!', false); }
          })
          .catch(function() {
            testTtsBtn.disabled = false;
            showTestStatus(testTtsStatus, 'Request failed', true);
          });
        });

        // ===== Event Logs =====
        var logBroadcaster = document.getElementById('logBroadcaster');
        var logRefreshBtn = document.getElementById('logRefreshBtn');
        var logStatus = document.getElementById('logStatus');
        var logContainer = document.getElementById('logContainer');
        var logEmpty = document.getElementById('logEmpty');

        function populateLogBroadcasters() {
          var currentVal = logBroadcaster.value;
          logBroadcaster.textContent = '';
          var defaultOpt = document.createElement('option');
          defaultOpt.value = '';
          defaultOpt.textContent = 'Select a broadcaster...';
          logBroadcaster.appendChild(defaultOpt);
          cachedBroadcasters.forEach(function(u) {
            var opt = document.createElement('option');
            opt.value = u.userId;
            opt.textContent = (u.displayName || u.login || u.userId) + ' (' + u.userId + ')';
            if (u.userId === currentVal) opt.selected = true;
            logBroadcaster.appendChild(opt);
          });
        }

        function formatLogTime(ts) {
          var d = ts ? new Date(ts) : new Date();
          return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }

        function formatLogDetail(e) {
          var src = e.type || e.source || 'event';
          var label = e.label || '';
          var base = Number(e.baseSeconds || 0);
          var applied = Number(e.appliedSeconds || 0);
          var actual = Number(e.actualSeconds || applied);
          var hype = Number(e.hypeMultiplier || 1);
          var capNote = (applied > 0 && actual < applied) ? ' (capped)' : '';
          var who = e.userName || '';

          if (src === 'sound_alert') {
            var snd = e.soundName || 'Sound';
            var viewer = (e.viewerDisplayName || e.viewerUserId) ? ' by ' + (e.viewerDisplayName || e.viewerUserId) : '';
            var bitsNote = e.bitsAmount ? ' (' + e.bitsAmount + ' bits' + (e.secondsAdded ? ', +' + e.secondsAdded + 's' : '') + ')' : '';
            return { type: 'Sound Alert', detail: snd + viewer + bitsNote, color: '#9146ff', seconds: null };
          }
          if (src === 'tts_alert') {
            var ttsBy = e.viewerDisplayName || '';
            return { type: 'TTS Alert', detail: (ttsBy ? ttsBy + ': ' : '') + (e.message || 'TTS'), color: '#9146ff', seconds: null };
          }

          var detail = '';
          if (src === 'channel.cheer' || src === 'channel.bits.use') {
            var bits = Number(e.bits || 0);
            detail = (who || 'Someone') + ' cheered' + (bits > 0 ? ' ' + bits + ' bits' : '');
          } else if (src === 'channel.subscribe' || src === 'channel.subscription.message') {
            var tierLabel = e.subTier ? ' Tier ' + String(e.subTier).replace(/^0+/, '') : '';
            detail = (who || 'Someone') + ' subscribed' + tierLabel;
          } else if (src === 'channel.subscription.gift') {
            var gifts = Number(e.giftCount || 0);
            detail = (who || 'Someone') + ' gifted ' + gifts + ' sub' + (gifts === 1 ? '' : 's');
          } else if (src === 'channel.charity_campaign.donate') {
            var amt = Number(e.charityAmount || 0);
            var dec = Number(e.charityDecimals || 2);
            var amtStr = amt > 0 ? ' $' + (amt / Math.pow(10, dec)).toFixed(dec) : '';
            detail = (who || 'Someone') + ' donated' + amtStr;
          } else if (src === 'streamelements_tip') {
            var tipAmt = Number(e.tipAmount || 0);
            if (tipAmt > 0) {
              var tipSymbol = e.tipCurrency ? (new Intl.NumberFormat('en', { style: 'currency', currency: e.tipCurrency }).formatToParts(0).find(function(p) { return p.type === 'currency'; }) || {}).value || e.tipCurrency : '$';
              detail = (e.tipUsername || 'Anon') + ' tipped ' + tipSymbol + tipAmt.toFixed(2);
            } else detail = 'SE Tip';
          } else if (src === 'channel.follow') {
            detail = (who || 'Someone') + ' followed';
          } else if (src === 'channel.hype_train.begin') {
            detail = 'Hype Train started';
          } else if (src === 'channel.hype_train.progress') {
            detail = 'Hype Train progress';
          } else if (src === 'channel.hype_train.end') {
            detail = 'Hype Train ended';
          } else if (src === 'manual_start' || src === 'manual_add' || src === 'manual_clear' || src === 'manual_restart') {
            detail = label || src;
          }

          var hypeInfo = hype !== 1 ? (' (base ' + base + 's x' + hype + ')') : '';
          var seconds = actual > 0 ? '+' + actual + 's' + hypeInfo + capNote : '';
          return { type: src, detail: detail, color: null, seconds: seconds };
        }

        function renderLogEntries(entries) {
          logContainer.textContent = '';
          if (!entries || entries.length === 0) {
            logContainer.style.display = 'none';
            logEmpty.textContent = 'No log entries found for this broadcaster.';
            logEmpty.style.display = '';
            return;
          }
          logEmpty.style.display = 'none';
          logContainer.style.display = '';

          var sorted = entries.slice().sort(function(a, b) { return (b.ts || 0) - (a.ts || 0); });
          sorted.forEach(function(e) {
            var line = document.createElement('div');
            line.className = 'log-line';

            var timeSpan = document.createElement('span');
            timeSpan.className = 'log-time';
            timeSpan.textContent = formatLogTime(e.ts);

            var info = formatLogDetail(e);

            var typeSpan = document.createElement('span');
            typeSpan.className = 'log-type';
            typeSpan.textContent = info.type;
            if (info.color) typeSpan.style.color = info.color;

            var detailSpan = document.createElement('span');
            detailSpan.className = 'log-detail';
            var parts = [];
            if (info.detail) parts.push(info.detail);
            if (info.seconds) parts.push(info.seconds);
            detailSpan.textContent = parts.length ? ' – ' + parts.join(' · ') : '';

            line.appendChild(timeSpan);
            line.appendChild(typeSpan);
            line.appendChild(detailSpan);
            logContainer.appendChild(line);
          });

          logStatus.textContent = sorted.length + ' entries';
        }

        function fetchLogEntries() {
          var uid = logBroadcaster.value;
          if (!uid) return;
          logRefreshBtn.disabled = true;
          logStatus.textContent = 'Loading...';
          fetch('/api/admin/events/log/' + encodeURIComponent(uid), { credentials: 'same-origin' })
            .then(function(r) { return r.json(); })
            .then(function(data) {
              logRefreshBtn.disabled = false;
              if (data.error) {
                logStatus.textContent = 'Error: ' + data.error;
                return;
              }
              renderLogEntries(data.entries || []);
            })
            .catch(function() {
              logRefreshBtn.disabled = false;
              logStatus.textContent = 'Failed to load logs';
            });
        }

        logBroadcaster.addEventListener('change', function() {
          if (logBroadcaster.value) {
            fetchLogEntries();
          } else {
            logContainer.style.display = 'none';
            logEmpty.textContent = 'Select a broadcaster to view their event log.';
            logEmpty.style.display = '';
            logStatus.textContent = '';
          }
        });

        logRefreshBtn.addEventListener('click', function() {
          if (logBroadcaster.value) fetchLogEntries();
        });

        // Hook into stats fetch to populate log broadcaster picker
        var origPopulateTest = populateTestBroadcasters;
        populateTestBroadcasters = function(users) {
          origPopulateTest(users);
          populateLogBroadcasters();
        };
      })();
    </script>
    <script>
      (function() {
        var analyticsLoaded = false;
        var selectedStreamer = null;

        function fmtBits(n) {
          if (n == null) return '--';
          if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
          if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
          return String(n);
        }

        function fmtDate(iso) {
          if (!iso) return '--';
          return new Date(iso).toLocaleString();
        }

        function makeEmptyState(msg, padding) {
          var d = document.createElement('div');
          d.className = 'empty-state';
          if (padding) d.style.padding = padding;
          d.textContent = msg;
          return d;
        }

        function renderSkuTable(topSkus) {
          var container = document.getElementById('analyticsSkuContainer');
          container.textContent = '';
          if (!topSkus || topSkus.length === 0) {
            container.appendChild(makeEmptyState('No data yet.'));
            return;
          }
          var maxCount = topSkus.reduce(function(m, r) { return Math.max(m, r.count); }, 0);
          var table = document.createElement('table');
          var thead = document.createElement('thead');
          var hr = document.createElement('tr');
          ['Type', 'Bits', 'Count', ''].forEach(function(h) {
            var th = document.createElement('th'); th.textContent = h; hr.appendChild(th);
          });
          thead.appendChild(hr); table.appendChild(thead);
          var tbody = document.createElement('tbody');
          topSkus.forEach(function(row) {
            var tr = document.createElement('tr');
            var tdType = document.createElement('td');
            var badge = document.createElement('span');
            badge.className = 'analytics-sku-badge analytics-sku-' + row.src;
            badge.textContent = row.src === 'tts' ? 'TTS' : 'Sound';
            tdType.appendChild(badge);
            var tdBits = document.createElement('td');
            tdBits.style.fontWeight = '600';
            tdBits.textContent = row.bitsAmount + ' Bits';
            var tdCount = document.createElement('td');
            tdCount.textContent = row.count.toLocaleString();
            var tdBar = document.createElement('td');
            var bar = document.createElement('span');
            bar.className = 'analytics-bar';
            bar.style.width = Math.max(4, Math.round((row.count / maxCount) * 100)) + 'px';
            tdBar.appendChild(bar);
            tr.appendChild(tdType); tr.appendChild(tdBits); tr.appendChild(tdCount); tr.appendChild(tdBar);
            tbody.appendChild(tr);
          });
          table.appendChild(tbody);
          container.appendChild(table);
        }

        function renderStreamersTable(streamers) {
          var container = document.getElementById('analyticsStreamersContainer');
          container.textContent = '';
          if (!streamers || streamers.length === 0) {
            container.appendChild(makeEmptyState('No data yet.'));
            return;
          }
          var table = document.createElement('table');
          var thead = document.createElement('thead');
          var hr = document.createElement('tr');
          ['Streamer', 'Sound Bits', 'TTS Bits', 'Total Bits', 'Sound Plays', 'TTS Plays'].forEach(function(h) {
            var th = document.createElement('th'); th.textContent = h; hr.appendChild(th);
          });
          thead.appendChild(hr); table.appendChild(thead);
          var tbody = document.createElement('tbody');
          streamers.forEach(function(row) {
            var tr = document.createElement('tr');
            tr.className = 'analytics-streamer-row';
            if (selectedStreamer === row.channelId) tr.classList.add('selected');
            var tdName = document.createElement('td');
            var nameDiv = document.createElement('div');
            nameDiv.style.fontWeight = '600';
            nameDiv.textContent = row.displayName || row.channelId;
            var idDiv = document.createElement('div');
            idDiv.className = 'mono';
            idDiv.textContent = row.channelId;
            tdName.appendChild(nameDiv); tdName.appendChild(idDiv);
            tr.appendChild(tdName);
            [row.soundBits, row.ttsBits, row.totalBits, row.soundCount, row.ttsCount].forEach(function(v, i) {
              var td = document.createElement('td');
              td.textContent = i < 3 ? fmtBits(v) : (v || 0).toLocaleString();
              if (i === 2) td.style.fontWeight = '700';
              tr.appendChild(td);
            });
            tr.addEventListener('click', function() {
              selectedStreamer = row.channelId;
              renderStreamersTable(streamers);
              fetchStreamerDetail(row.channelId, row.displayName || row.channelId);
            });
            tbody.appendChild(tr);
          });
          table.appendChild(tbody);
          container.appendChild(table);
        }

        function makeDetailTable(headers, rows, cellFn) {
          var tbl = document.createElement('table');
          var thead = document.createElement('thead');
          var hr = document.createElement('tr');
          headers.forEach(function(h) { var th = document.createElement('th'); th.textContent = h; hr.appendChild(th); });
          thead.appendChild(hr); tbl.appendChild(thead);
          var tbody = document.createElement('tbody');
          rows.forEach(function(row) {
            var tr = document.createElement('tr');
            cellFn(row).forEach(function(cell) { tr.appendChild(cell); });
            tbody.appendChild(tr);
          });
          tbl.appendChild(tbody);
          return tbl;
        }

        function td(text, opts) {
          var el = document.createElement('td');
          el.textContent = text || '--';
          if (opts && opts.bold) el.style.fontWeight = '600';
          if (opts && opts.mono) el.className = 'mono';
          return el;
        }

        function fetchStreamerDetail(channelId, displayName) {
          var detailCard = document.getElementById('analyticsStreamerDetail');
          var detailTitle = document.getElementById('analyticsStreamerDetailTitle');
          var detailBody = document.getElementById('analyticsStreamerDetailBody');
          detailCard.style.display = '';
          detailTitle.textContent = displayName;
          detailBody.textContent = '';
          detailBody.appendChild(makeEmptyState('Loading...'));
          fetch('/api/admin/analytics/' + encodeURIComponent(channelId), { credentials: 'same-origin' })
            .then(function(r) { return r.json(); })
            .then(function(data) {
              detailBody.textContent = '';

              var s1 = document.createElement('div'); s1.className = 'detail-section';
              var h1 = document.createElement('h3'); h1.textContent = 'Top Sounds'; s1.appendChild(h1);
              if (data.topSounds && data.topSounds.length > 0) {
                s1.appendChild(makeDetailTable(['Sound', 'Plays', 'Total Bits'], data.topSounds, function(row) {
                  return [td(row.sound_name || row.sound_id, {bold:true}), td((row.count||0).toLocaleString()), td(fmtBits(row.totalBits))];
                }));
              } else { s1.appendChild(makeEmptyState('No sound plays yet.', '12px 0')); }
              detailBody.appendChild(s1);

              var s2 = document.createElement('div'); s2.className = 'detail-section';
              var h2 = document.createElement('h3'); h2.textContent = 'Recent Sound Plays'; s2.appendChild(h2);
              if (data.recentSoundEvents && data.recentSoundEvents.length > 0) {
                s2.appendChild(makeDetailTable(['Sound', 'Bits', 'Viewer', 'When'], data.recentSoundEvents, function(row) {
                  return [
                    td(row.sound_name),
                    td(row.bits_amount != null ? row.bits_amount + ' Bits' : '--'),
                    td(row.viewer_user_id, {mono:true}),
                    td(fmtDate(row.created_at)),
                  ];
                }));
              } else { s2.appendChild(makeEmptyState('None yet.', '12px 0')); }
              detailBody.appendChild(s2);

              var s3 = document.createElement('div'); s3.className = 'detail-section';
              var h3el = document.createElement('h3'); h3el.textContent = 'Recent TTS Plays'; s3.appendChild(h3el);
              if (data.recentTtsEvents && data.recentTtsEvents.length > 0) {
                s3.appendChild(makeDetailTable(['Voice', 'Bits', 'Viewer', 'When'], data.recentTtsEvents, function(row) {
                  return [
                    td(row.voice_name),
                    td(row.bits_amount != null ? row.bits_amount + ' Bits' : '--'),
                    td(row.viewer_user_id, {mono:true}),
                    td(fmtDate(row.created_at)),
                  ];
                }));
              } else { s3.appendChild(makeEmptyState('None yet.', '12px 0')); }
              detailBody.appendChild(s3);
            })
            .catch(function() {
              detailBody.textContent = '';
              detailBody.appendChild(makeEmptyState('Failed to load detail.'));
            });
        }

        function renderFunnelTable(rows) {
          var container = document.getElementById('analyticsFunnelContainer');
          if (!container) return;
          container.textContent = '';
          if (!rows || !rows.length) {
            container.appendChild(makeEmptyState('No config panel opens recorded yet.'));
            return;
          }
          var table = document.createElement('table');
          var thead = document.createElement('thead');
          var headerRow = document.createElement('tr');
          ['Language', 'Opened Config', 'Created an Alert', 'Completion Rate'].forEach(function(label) {
            var th = document.createElement('th');
            th.textContent = label;
            headerRow.appendChild(th);
          });
          thead.appendChild(headerRow);
          table.appendChild(thead);
          var tbody = document.createElement('tbody');
          rows.forEach(function(r) {
            var tr = document.createElement('tr');
            [
              r.language || 'unknown',
              String(r.opened),
              String(r.completed_setup),
              r.opened ? Math.round((r.completed_setup / r.opened) * 100) + '%' : '--',
            ].forEach(function(text) {
              var td = document.createElement('td');
              td.textContent = text;
              tr.appendChild(td);
            });
            tbody.appendChild(tr);
          });
          table.appendChild(tbody);
          container.appendChild(table);
        }

        function fetchAnalyticsFunnel() {
          fetch('/api/admin/analytics/funnel', { credentials: 'same-origin' })
            .then(function(r) { return r.json(); })
            .then(function(data) {
              if (data.error) return;
              renderFunnelTable(data.rows);
            })
            .catch(function() {
              var container = document.getElementById('analyticsFunnelContainer');
              if (container) { container.textContent = ''; container.appendChild(makeEmptyState('Failed to load funnel.')); }
            });
        }

        function fetchAnalytics() {
          fetch('/api/admin/analytics', { credentials: 'same-origin' })
            .then(function(r) { return r.json(); })
            .then(function(data) {
              if (data.error) return;
              document.getElementById('anSoundBits').textContent = fmtBits(data.sound.totalBits);
              document.getElementById('anTtsBits').textContent = fmtBits(data.tts.totalBits);
              document.getElementById('anSoundPlayed').textContent = (data.sound.playedCount || 0).toLocaleString();
              document.getElementById('anTtsPlayed').textContent = (data.tts.playedCount || 0).toLocaleString();
              document.getElementById('anFailedCount').textContent = (data.sound.failedCount || 0).toLocaleString();
              document.getElementById('anRejectedCount').textContent = (data.tts.rejectedCount || 0).toLocaleString();
              renderSkuTable(data.topSkus);
              renderStreamersTable(data.streamers);
              document.getElementById('analyticsRefreshInfo').textContent = 'Updated ' + new Date().toLocaleTimeString();
              analyticsLoaded = true;
            })
            .catch(function() {
              document.getElementById('analyticsRefreshInfo').textContent = 'Load failed';
            });
          fetchAnalyticsFunnel();
        }

        document.querySelectorAll('.sidebar-nav-item').forEach(function(btn) {
          btn.addEventListener('click', function() {
            if (btn.getAttribute('data-section') === 'analytics' && !analyticsLoaded) {
              fetchAnalytics();
            }
          });
        });
      })();
    </script>
  </body>
</html>`;
}
