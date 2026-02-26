import {
  THEME_CSS_VARS,
  THEME_TOGGLE_STYLES,
  renderThemeBootstrapScript,
} from "./theme.js";
import { GLOBAL_HEADER_STYLES, renderGlobalHeader } from "./globalHeader.js";
import { renderFirebaseScript } from "./firebase.js";

export function renderOverlayConfigPage(options = {}) {
  const {
    base,
    adminName,
    userKey,
    settings,
    rulesSnapshot,
    initialQuery = {},
    showAdminLink = false,
  } = options;

  const defSecs = Number(settings.defaultInitialSeconds || 0);
  const defH = Math.floor(defSecs / 3600);
  const defM = Math.floor((defSecs % 3600) / 60);
  const defS = defSecs % 60;
  const initial = {
    fontSize: Number(initialQuery.fontSize ?? 64),
    color: String(initialQuery.color ?? "#efeff1"),
    bg: String(initialQuery.bg ?? "#111114"),
    transparent: String(initialQuery.transparent ?? "0") !== "0",
    font: String(initialQuery.font ?? "Inter,system-ui,Arial,sans-serif"),
    label: String(initialQuery.label ?? "0") !== "0",
    title: String(initialQuery.title ?? "Stream Countdown"),
    align: String(initialQuery.align ?? "center"),
    weight: Number(initialQuery.weight ?? 700),
    shadow: String(initialQuery.shadow ?? "0") !== "0",
    shadowColor: String(initialQuery.shadowColor ?? "rgba(0,0,0,0.7)"),
    shadowBlur: Number(initialQuery.shadowBlur ?? 8),
    stroke: Number(initialQuery.stroke ?? 0),
    strokeColor: String(initialQuery.strokeColor ?? "#000000"),
    warnEnabled: String(initialQuery.warnEnabled ?? "1") !== "0",
    dangerEnabled: String(initialQuery.dangerEnabled ?? "1") !== "0",
    flashEnabled: String(initialQuery.flashEnabled ?? "1") !== "0",
    key: String(initialQuery.key ?? ""),
  };
  const collapsedSections = (settings && settings.panelCollapsedSections) || {};
  const isCollapsed = (id) =>
    Boolean(collapsedSections && collapsedSections[id]);
  const sectionClass = (id) => `section${isCollapsed(id) ? " collapsed" : ""}`;
  const sectionBodyAttr = (id) =>
    isCollapsed(id) ? 'style="display:none"' : "";
  const sectionExpandedAttr = (id) => (isCollapsed(id) ? "false" : "true");
  const privacyUrl = `/privacy`;
  const gdprUrl = `/gdpr`;

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Countdown Timer – Livestreamer Hub</title>
    <link rel="icon" type="image/png" href="/assets/convertico-coin_24x24.png">
    <script id="Cookiebot" src="https://consent.cookiebot.com/uc.js" data-cbid="6770198d-2c1f-46f8-af4b-694edc70484c" type="text/javascript"></script>
    ${renderThemeBootstrapScript()}
    ${renderFirebaseScript()}
    <style>
      ${THEME_CSS_VARS}
      body { margin: 0; font-family: Inter, system-ui, Arial, sans-serif; background: var(--page-bg); color: var(--text-color); min-height: 100vh; display: flex; flex-direction: column; }
      .page-content { flex: 1; width: min(1100px, 100%); margin: 0 auto; padding: 24px 20px 48px; }
      .page-header { margin-bottom: 20px; }
      .page-header h1 { margin: 0 0 4px; font-size: 26px; }
      .page-header .subtitle { margin: 0; color: var(--text-muted); font-size: 14px; }
      .source-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; background: var(--surface-color); border: 1px solid var(--surface-border); border-radius: 12px; padding: 10px 14px; }
      .source-bar .url { flex: 1; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--code-bg); border: 1px solid var(--code-border); padding: 6px 10px; border-radius: 8px; overflow: auto; font-size: 13px; white-space: nowrap; }
      .source-bar .hint { font-size: 12px; color: var(--text-muted); white-space: nowrap; }
      .hero-preview { margin-bottom: 20px; text-align: center; }
      .hero-preview iframe { width: 100%; max-width: 720px; height: 180px; border: 1px solid var(--surface-border); background: var(--surface-muted); border-radius: 12px; box-shadow: 0 8px 30px var(--goal-card-shadow); }
      .hero-preview .hint { margin-top: 6px; font-size: 12px; color: var(--text-muted); }
      .panel { background: var(--surface-color); border: 1px solid var(--surface-border); border-radius: 12px; padding: 16px; }
      .control { display: grid; grid-template-columns: 140px 1fr; align-items: center; gap: 8px; margin-bottom: 10px; }
      .control label { color: var(--text-muted); font-size: 13px; }
      .row2 { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
      .timer-top { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 12px; }
      .timer-top .timer-col h3 { margin: 0 0 8px; font-size: 13px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
      .timer-col .hms { display: flex; gap: 6px; align-items: center; }
      .timer-col .hms input { width: 56px; text-align: center; padding: 6px 4px; }
      .timer-col .hms span { font-size: 12px; color: var(--text-muted); font-weight: 500; }
      .timer-actions { display: flex; gap: 8px; flex-wrap: wrap; padding-top: 12px; border-top: 1px solid var(--section-border, #303038); }
      .timer-addons { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 10px; }
      @media (max-width: 600px) { .timer-top { grid-template-columns: 1fr; } }
      .bottom-grid { display: grid; grid-template-columns: 1fr 2fr; gap: 16px; margin-top: 16px; }
      @media (max-width: 900px) {
        .bottom-grid { grid-template-columns: 1fr; }
      }
      input[type="text"], input[type="number"], select, textarea {
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        padding: 6px 8px;
        border-radius: 6px;
        border: 1px solid var(--input-border);
        background: var(--input-bg);
        color: var(--text-color);
      }
      input[type="checkbox"] { transform: scale(1.1); }
      input[type="color"] { height: 32px; }

      button { background: var(--accent-color); color: #ffffff; border: 0; padding: 8px 10px; border-radius: 8px; cursor: pointer; }
      button.secondary { background: var(--secondary-button-bg); color: var(--secondary-button-text); border: 1px solid var(--secondary-button-border); }
      button { transition: transform .04s ease, box-shadow .15s ease, filter .15s ease, opacity .2s; }
      button:hover { box-shadow: 0 0 0 1px rgba(0,0,0,0.2) inset; filter: brightness(1.02); }
      button:active { transform: translateY(1px) scale(0.99); filter: brightness(0.98); }
      button:disabled { opacity: 0.5; cursor: not-allowed; }
      @keyframes btnpulse { 0% { transform: scale(0.99); } 100% { transform: scale(1); } }
      .btn-click { animation: btnpulse .18s ease; }
      .hint { font-size: 12px; color: var(--text-muted); }
      .log-box { margin-top: 8px; padding: 8px; background: var(--log-bg); border: 1px solid var(--log-border); border-radius: 8px; max-height: 160px; overflow-y: auto; font-size: 12px; }
      .log-line { margin-bottom: 4px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
      .log-time { color: var(--text-muted); margin-right: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      .log-text { color: var(--text-color); opacity: 0.9; }
      .section { border: 1px solid var(--section-border); border-radius: 12px; margin-bottom: 16px; background: var(--section-bg); }
      .section-toggle { width: 100%; background: none; border: 0; padding: 12px; color: var(--text-color); font-size: 15px; font-weight: 600; display: flex; align-items: center; justify-content: space-between; cursor: pointer; }
      .section-toggle:hover { background: var(--surface-muted); }
      .section-body { padding: 0 12px 12px; }
      .section-arrow { transition: transform .2s ease; font-size: 12px; color: var(--text-muted); }
      .section.collapsed .section-arrow { transform: rotate(-90deg); }
      .section.collapsed .section-body { display: none; }
      .global-footer { margin: 24px 16px 24px; padding: 12px 0; border-top: 1px solid var(--surface-border); text-align: center; font-size: 13px; color: var(--text-muted); }
      .global-footer a { color: var(--text-muted); text-decoration: none; margin: 0 10px; }
      .global-footer a:hover { color: var(--accent-color); }
      ${THEME_TOGGLE_STYLES}
      ${GLOBAL_HEADER_STYLES}
    </style>
  </head>
  <body>
    ${renderGlobalHeader({
      base: "",
      adminName,
      active: "config",
      includeThemeToggle: true,
      showFeedback: true,
      showLogout: true,
      showUtilitiesLink: true,
      showAdminLink,
    })}
    <div class="page-content">
      <!-- Browser Source URL -->
      <div class="page-header">
        <h1>Countdown Timer</h1>
        <p class="subtitle">Configure your countdown timer overlay for OBS or Streamlabs.</p>
      </div>
      <div class="source-bar">
        <button id="copy" style="flex-shrink:0;">Copy URL</button>
        <div class="url" id="url"></div>
        <span class="hint">Browser Source URL</span>
      </div>

      <!-- Hero Preview -->
      <div class="hero-preview">
        <iframe id="preview" referrerpolicy="no-referrer"></iframe>
        <div class="hint">Pause/Resume and Start actions update the live overlay immediately.</div>
      </div>

      <!-- Timer Controls + Bonus Time -->
      <div class="panel">
        <div class="${sectionClass("timer")}" data-section="timer">
          <button class="section-toggle" data-section-toggle="timer" aria-expanded="${sectionExpandedAttr(
            "timer",
          )}">
            <span>Timer Controls</span>
            <span class="section-arrow">▾</span>
          </button>
          <div class="section-body" ${sectionBodyAttr("timer")}>
            <div class="timer-top">
              <div class="timer-col">
                <h3>Starting Time</h3>
                <div class="hms">
                  <input id="h" type="number" min="0" step="1" value="${defH}"><span>h</span>
                  <input id="m" type="number" min="0" max="59" step="1" value="${defM}"><span>m</span>
                  <input id="s" type="number" min="0" max="59" step="1" value="${defS}"><span>s</span>
                </div>
              </div>
              <div class="timer-col">
                <h3>Maximum Time</h3>
                <div class="hms">
                  <input id="maxH" type="number" min="0" step="1" value="0"><span>h</span>
                  <input id="maxM" type="number" min="0" max="59" step="1" value="0"><span>m</span>
                  <input id="maxS" type="number" min="0" max="59" step="1" value="0"><span>s</span>
                  <button class="secondary" id="clearMax" title="Remove the max cap" style="font-size:12px; padding:4px 10px;">Clear</button>
                </div>
              </div>
            </div>
            <div class="timer-actions">
              <button id="startTimer">Start Timer</button>
              <button class="secondary" id="pause">Pause</button>
              <button class="secondary" id="resume">Resume</button>
              <button class="secondary" id="endTimer">End Timer</button>
              <button class="secondary" id="restartTimer">Restart Timer</button>
              <button class="secondary" id="saveDefault">Save Default</button>
            </div>
            <div class="timer-addons">
              <button class="secondary" data-add="300">+5 min</button>
              <button class="secondary" data-add="600">+10 min</button>
              <button class="secondary" data-add="1800">+30 min</button>
              <span style="color:var(--section-border);">|</span>
              <input id="addCustomSeconds" type="number" min="1" step="1" placeholder="Seconds" style="width:90px" />
              <button class="secondary" id="addCustomBtn">Add</button>
              <span style="color:var(--section-border);">|</span>
              <input id="devBitsInput" type="number" min="0" step="1" placeholder="Bits" style="width:80px" />
              <button class="secondary" id="devApplyBits" title="Apply custom bits based on rules">Apply Bits</button>
            </div>

            <div style="margin-top:12px; padding-top:12px; border-top:1px solid var(--section-border,#303038);">
              <div style="font-weight:600; font-size:13px; margin-bottom:8px;">Bonus Time</div>
              <div class="row2" style="align-items:center;">
                <button id="bonusToggle" class="secondary" style="min-width:160px;">Activate Bonus Time</button>
                <span id="bonusStatus" style="font-size:12px; opacity:0.7;"></span>
              </div>
              <div style="margin-top:8px; display:flex; gap:12px; flex-wrap:wrap; align-items:end;">
                <div>
                  <label style="font-size:12px; display:block; margin-bottom:2px;">Start Time</label>
                  <input id="bonusStart" type="datetime-local" style="font-size:12px;" />
                </div>
                <div>
                  <label style="font-size:12px; display:block; margin-bottom:2px;">End Time</label>
                  <input id="bonusEnd" type="datetime-local" style="font-size:12px;" />
                </div>
                <button class="secondary" id="bonusScheduleSave" style="font-size:12px;">Save Schedule</button>
                <button class="secondary" id="bonusScheduleClear" style="font-size:12px;">Clear Schedule</button>
              </div>
              <div class="hint" id="bonusScheduleHint" style="margin-top:4px;"></div>
            </div>

            <div class="hint" style="margin-top:8px">Current remaining: <span id="remain">--:--</span></div>
            <div class="hint" id="capStatus" style="margin-top:4px; opacity:0.8"></div>

            <div style="margin-top:12px; padding-top:12px; border-top:1px solid var(--section-border,#303038);">
              <div style="font-weight:600; font-size:13px; margin-bottom:8px;">Max Time Reached Display</div>
              <label style="display:flex; align-items:center; gap:8px; margin-bottom:8px; cursor:pointer;">
                <input type="checkbox" id="showCapMessage" />
                Display max time reached message on overlay
              </label>
              <div id="capMessageRow" style="display:none; margin-bottom:8px;">
                <input id="capMessageText" type="text" placeholder="e.g. Thanks for watching! Stream ending soon." maxlength="200" style="width:100%; box-sizing:border-box; margin-bottom:8px;" />
                <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
                  <label style="display:flex; align-items:center; gap:4px; font-size:12px;">Color <input id="capMsgColor" type="color" value="#ffffff" style="width:32px; height:24px; border:none; cursor:pointer;" /></label>
                  <label style="font-size:12px;">Position
                    <select id="capMsgPosition" style="margin-left:4px;">
                      <option value="below">Below countdown</option>
                      <option value="above">Above countdown</option>
                    </select>
                  </label>
                  <label style="font-size:12px;">Size
                    <select id="capMsgSize" style="margin-left:4px;">
                      <option value="larger">Larger</option>
                      <option value="same">Same</option>
                      <option value="smaller">Smaller</option>
                    </select>
                  </label>
                </div>
              </div>
              <div class="row2">
                <button class="secondary" id="saveCapMsg">Save Message Settings</button>
                <button class="secondary" id="forceCapBtn" title="Manually force cap-reached state">Force Max Reached</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Grid: Styles (1/3) | Rules + Event Log + Testing (2/3) -->
      <div class="bottom-grid">
        <!-- Left column: Countdown Styles -->
        <div class="panel">
          <div class="${sectionClass("style")}" data-section="style">
            <button class="section-toggle" data-section-toggle="style" aria-expanded="${sectionExpandedAttr(
              "style",
            )}">
              <span>Countdown Styles</span>
            <span class="section-arrow">▾</span>
          </button>
          <div class="section-body" ${sectionBodyAttr("style")}>
            <div class="control"><label>Font Size</label><input id="fontSize" type="number" min="10" max="300" step="1" value="${
              initial.fontSize
            }"></div>
            <div class="control"><label>Color</label><input id="color" type="color" value="${
              initial.color
            }"></div>
            <div class="control"><label>Transparent</label><input id="transparent" type="checkbox" ${
              initial.transparent ? "checked" : ""
            }></div>
            <div class="control"><label>Background</label><input id="bg" type="color" value="${
              initial.bg
            }"></div>
            <div class="control"><label>Font Family</label><input id="font" type="text" value="${
              initial.font
            }"></div>
            <div class="control"><label>Show Label</label><input id="label" type="checkbox" ${
              initial.label ? "checked" : ""
            }></div>
            <div class="control"><label>Label Text</label><input id="title" type="text" value="${
              initial.title
            }"></div>
            <div class="control"><label>Align</label>
              <select id="align">
                <option ${
                  initial.align === "left" ? "selected" : ""
                } value="left">left</option>
                <option ${
                  initial.align === "center" ? "selected" : ""
                } value="center">center</option>
                <option ${
                  initial.align === "right" ? "selected" : ""
                } value="right">right</option>
              </select>
            </div>
            <div class="control"><label>Weight</label><input id="weight" type="number" min="100" max="1000" step="100" value="${
              initial.weight
            }"></div>
            <div class="control"><label>Shadow</label><input id="shadow" type="checkbox" ${
              initial.shadow ? "checked" : ""
            }></div>
            <div class="control"><label>Shadow Color</label><input id="shadowColor" type="color" value="#000000"></div>
            <div class="control"><label>Shadow Blur</label><input id="shadowBlur" type="number" min="0" max="50" step="1" value="${
              initial.shadowBlur
            }"></div>
            <div class="control"><label>Outline Width</label><input id="stroke" type="number" min="0" max="20" step="1" value="${
              initial.stroke
            }"></div>
            <div class="control"><label>Outline Color</label><input id="strokeColor" type="color" value="#000000"></div>
            <div class="control"><label>Time format</label>
              <select id="timeFormat">
                <option value="mm:ss" >mm:ss</option>
                <option value="hh:mm:ss">hh:mm:ss</option>
                <option value="dd:hh:mm:ss">dd:hh:mm:ss</option>
                <option value="auto" selected>auto (expands as needed)</option>
              </select>
            </div>
            <div style="margin:12px 0; opacity:0.85; font-weight:600;">Threshold Styling</div>
            <div class="control"><label>Warn styling</label>
              <label style="display:flex; gap:6px; align-items:center; opacity:.85;">
                <input id="warnEnabled" type="checkbox" ${
                  initial.warnEnabled ? "checked" : ""
                } /> Enabled
              </label>
            </div>
            <div class="control"><label>Warn under (sec)</label><input id="warnUnder" type="number" min="0" step="1" value="300"></div>
            <div class="control"><label>Warn color</label><input id="warnColor" type="color" value="#FFA500"></div>
            <div class="control"><label>Danger styling</label>
              <label style="display:flex; gap:6px; align-items:center; opacity:.85;">
                <input id="dangerEnabled" type="checkbox" ${
                  initial.dangerEnabled ? "checked" : ""
                } /> Enabled
              </label>
            </div>
            <div class="control"><label>Danger under (sec)</label><input id="dangerUnder" type="number" min="0" step="1" value="60"></div>
            <div class="control"><label>Danger color</label><input id="dangerColor" type="color" value="#FF4D4D"></div>
            <div class="control"><label>Flash effect</label>
              <label style="display:flex; gap:6px; align-items:center; opacity:.85;">
                <input id="flashEnabled" type="checkbox" ${
                  initial.flashEnabled ? "checked" : ""
                } /> Enabled
              </label>
            </div>
            <div class="control"><label>Flash under (sec)</label><input id="flashUnder" type="number" min="0" step="1" value="0"></div>
            <div class="control"><label>Hype text</label>
              <div style="display:flex; gap:8px; align-items:center;">
                <label style="display:flex; gap:6px; align-items:center; opacity:.85;">
                  <input id="hypeLabelEnabled" type="checkbox" checked /> Show
                </label>
                <input id="hypeLabel" type="text" value="🔥 Hype Train active" />
              </div>
            </div>
            <div class="control"><label>On-add effect</label>
              <div style="display:flex; gap:8px; align-items:center;">
                <label style="display:flex; gap:6px; align-items:center; opacity:.85;">
                  <input id="addEffectEnabled" type="checkbox" checked /> Enabled
                </label>
                <select id="addEffectMode" style="max-width:180px">
                  <option value="pulse">Pulse</option>
                  <option value="shake">Shake</option>
                  <option value="bounce">Bounce</option>
                  <option value="none">None</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        </div><!-- end left column (Countdown Styles) -->

        <!-- Right column: Rules, then Event Log + Testing side by side -->
        <div>
          <div class="panel" style="margin-bottom:16px;">
            <div class="${sectionClass("rules")}" data-section="rules">
              <button class="section-toggle" data-section-toggle="rules" aria-expanded="${sectionExpandedAttr(
                "rules",
              )}">
                <span>Rules</span>
                <span class="section-arrow">▾</span>
              </button>
              <div class="section-body" ${sectionBodyAttr("rules")}>
                <div class="control"><label>Min. Bits to Trigger</label><input id="r_bits_per" type="number" min="1" step="1" value="100"></div>
                <div class="control"><label>Bits add (sec)</label><input id="r_bits_add" type="number" min="0" step="1" value="60"></div>
                <div class="control"><label>T1 Subs add (sec)</label><input id="r_sub_1000" type="number" min="0" step="1" value="300"></div>
                <div class="control"><label>T2 Subs add (sec)</label><input id="r_sub_2000" type="number" min="0" step="1" value="600"></div>
                <div class="control"><label>T3 Subs add (sec)</label><input id="r_sub_3000" type="number" min="0" step="1" value="900"></div>
                <div class="control"><label>Resub base (sec)</label><input id="r_resub_base" type="number" min="0" step="1" value="300"></div>
                <div class="control"><label>Gift sub per-sub (sec)</label><input id="r_gift_per" type="number" min="0" step="1" value="300"></div>
                <div class="control"><label>Charity per $1 (sec)</label><input id="r_charity_per_usd" type="number" min="0" step="1" value="60"></div>
                <div class="control"><label>Follows add (sec)</label>
                  <div style="display:flex; gap:8px; align-items:center;">
                    <input id="r_follow_add" type="number" min="0" step="1" value="600" style="max-width:140px" />
                    <label style="display:flex; gap:6px; align-items:center; opacity:.85;"><input id="r_follow_enabled" type="checkbox" /> Enabled</label>
                  </div>
                </div>
                <div class="control"><label>Hype Train Multiplier</label><input id="r_hype" type="number" min="0" step="0.1" value="2"></div>
                <div class="control"><label>Bonus Time Multiplier</label><input id="r_bonus" type="number" min="0" step="0.1" value="2"></div>
                <div class="control"><label style="display:flex; gap:6px; align-items:center;"><input id="r_bonus_stack" type="checkbox" /> Stack bonus with hype train</label>
                  <div class="hint" style="margin-top:2px;">When enabled, multipliers multiply together. When disabled, only the higher multiplier applies.</div>
                </div>
                <div class="row2"><button id="saveRules">Save Rules</button></div>
              </div>
            </div>
          </div>

          <div class="panel" style="margin-top:16px;">
              <div class="${sectionClass("events")}" data-section="events">
                <button class="section-toggle" data-section-toggle="events" aria-expanded="${sectionExpandedAttr(
                  "events",
                )}">
                  <span>Event Log</span>
                  <span class="section-arrow">▾</span>
                </button>
                <div class="section-body" ${sectionBodyAttr("events")}>
                  <div id="eventLog" class="log-box"></div>
                  <div class="row2" style="margin-top:8px;">
                    <button class="secondary" id="clearLog">Clear Log</button>
                  </div>
                </div>
              </div>
          </div>
          <div class="panel" style="margin-top:16px;">
              <div class="${sectionClass("testing")}" data-section="testing">
                <button class="section-toggle" data-section-toggle="testing" aria-expanded="${sectionExpandedAttr(
                  "testing",
                )}">
                  <span>Debug Utils</span>
                  <span class="section-arrow">▾</span>
                </button>
                <div class="section-body" ${sectionBodyAttr("testing")}>
                  <div class="control"><label>Overlay Key</label>
                    <div style="display:flex; gap:8px; align-items:center;">
                      <input id="key" type="text" value="${userKey}" readonly>
                      <button class="secondary" id="rotateKey" title="Generate a new overlay key">Rotate</button>
                    </div>
                  </div>
                  <div class="row2" id="devTests">
                    <input id="devSubCount" type="number" min="1" step="1" value="1" style="max-width:100px" />
                    <select id="devSubTier" style="max-width:160px">
                      <option value="1000">Tier 1</option>
                      <option value="2000">Tier 2</option>
                      <option value="3000">Tier 3</option>
                    </select>
                    <button class="secondary" id="devApplySubs" title="Apply N subs">Apply Subs</button>
                  </div>
                  <div class="row2" id="devCustomGifts">
                    <input id="devGiftCount" type="number" min="1" step="1" value="1" style="max-width:100px" />
                    <button class="secondary" id="devApplyGifts" title="Apply N gift subs">Apply Gift Subs</button>
                  </div>
                  <div class="row2" id="devHypeControls">
                    <button class="secondary" id="testHypeOn">Force Hype On</button>
                    <button class="secondary" id="testHypeOff">Force Hype Off</button>
                  </div>
                  <div style="margin-top:10px; padding-top:10px; border-top:1px solid var(--section-border,#303038)">
                    <div class="hint">Sound Alert management and testing has moved to the <a href="/sounds/config" style="color:var(--accent-color)">Sound Alerts</a> page.</div>
                  </div>
                </div>
              </div>
          </div>
        </div><!-- end right column -->
      </div><!-- end bottom-grid -->
    </div><!-- end page-content -->
    <footer class="global-footer">
      <a href="${privacyUrl}">Privacy Policy</a>
      <a href="${gdprUrl}">GDPR / UK GDPR Disclosure</a>
      <a href="https://discord.gg/nwu4w5cUVd" target="_blank" rel="noopener noreferrer"><svg style="width:14px;height:14px;fill:currentColor;vertical-align:-2px;margin-right:3px" viewBox="0 0 127.14 96.36"><path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0 105.89 105.89 0 0 0 19.39 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2.03a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2.03a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69C36.18 65.69 31 60 31 53.05s5-12.68 11.45-12.68S54 46.09 53.89 53.05 48.84 65.69 42.45 65.69Zm42.24 0C78.41 65.69 73.25 60 73.25 53.05s5-12.68 11.44-12.68S96.23 46.09 96.12 53.05 91.08 65.69 84.69 65.69Z"/></svg>Discord</a>
    </footer>
    <script>
      const inputs = [
        'key','fontSize','color','transparent','bg','font','label','title','align','weight','shadow','shadowColor','shadowBlur','stroke','strokeColor','timeFormat',
        'h','m','s','addEffectEnabled','addEffectMode','hypeLabelEnabled','hypeLabel'
      ].reduce((acc, id) => (acc[id] = document.getElementById(id), acc), {});
      const sectionState = ${JSON.stringify(collapsedSections || {})};

      function applySectionState(section, collapsed) {
        if (!section) return;
        section.classList.toggle('collapsed', collapsed);
        const body = section.querySelector('.section-body');
        if (body) body.style.display = collapsed ? 'none' : '';
        const toggle = section.querySelector('.section-toggle');
        if (toggle) toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      }

      async function persistSectionState(id, collapsed) {
        try {
          await fetch('/api/user/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ panelCollapsedSections: { [id]: collapsed } })
          });
        } catch (e) {}
      }

      function initSections() {
        document.querySelectorAll('[data-section]').forEach((section) => {
          const id = section.getAttribute('data-section');
          const collapsed = !!sectionState[id];
          applySectionState(section, collapsed);
          const toggle = section.querySelector('.section-toggle');
          if (!toggle) return;
          toggle.addEventListener('click', () => {
            const next = !section.classList.contains('collapsed');
            applySectionState(section, next);
            sectionState[id] = next;
            persistSectionState(id, next);
          });
        });
      }

      function overlayUrl() {
        const p = new URLSearchParams();
        if (inputs.key.value) p.set('key', inputs.key.value.trim());
        return window.location.origin + '/overlay' + (p.toString() ? ('?' + p.toString()) : '');
      }

      async function saveStyle() {
        const p = new URLSearchParams();
        if (inputs.key.value) p.set('key', inputs.key.value.trim());
        const url = '/api/overlay/style' + (p.toString() ? ('?' + p.toString()) : '');
        const payload = {
          fontSize: Number(inputs.fontSize.value),
          color: inputs.color.value,
          transparent: Boolean(inputs.transparent.checked),
          bg: inputs.bg.value,
          font: inputs.font.value,
          label: Boolean(inputs.label.checked),
          title: inputs.title.value,
          align: inputs.align.value,
          weight: Number(inputs.weight.value),
          shadow: Boolean(inputs.shadow.checked),
          shadowColor: inputs.shadowColor.value,
          shadowBlur: Number(inputs.shadowBlur.value),
          stroke: Number(inputs.stroke.value),
          strokeColor: inputs.strokeColor.value,
          warnEnabled: Boolean((document.getElementById('warnEnabled')||{}).checked),
          warnUnderSeconds: Number(document.getElementById('warnUnder').value||0),
          warnColor: document.getElementById('warnColor').value,
          dangerEnabled: Boolean((document.getElementById('dangerEnabled')||{}).checked),
          dangerUnderSeconds: Number(document.getElementById('dangerUnder').value||0),
          dangerColor: document.getElementById('dangerColor').value,
          flashEnabled: Boolean((document.getElementById('flashEnabled')||{}).checked),
          flashUnderSeconds: Number(document.getElementById('flashUnder').value||0),
          timeFormat: inputs.timeFormat.value,
          addEffectEnabled: Boolean((document.getElementById('addEffectEnabled')||{}).checked),
          addEffectMode: (document.getElementById('addEffectMode')||{}).value || 'pulse',
          hypeLabelEnabled: Boolean((document.getElementById('hypeLabelEnabled')||{}).checked),
          hypeLabel: (document.getElementById('hypeLabel')||{}).value || '🔥 Hype Train active'
        };
        try { await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); } catch(e) {}
      }

      function setBusy(btn, busy) { if (!btn) return; btn.disabled = !!busy; }
      function flashButton(btn) { if (!btn) return; btn.classList.add('btn-click'); setTimeout(() => btn.classList.remove('btn-click'), 160); }

      function totalSeconds() {
        var h = parseInt(inputs.h.value||'0',10)||0;
        var m = parseInt(inputs.m.value||'0',10)||0;
        var s = parseInt(inputs.s.value||'0',10)||0;
        if (m > 59) m = 59; if (s > 59) s = 59; if (h < 0) h = 0; if (m < 0) m = 0; if (s < 0) s = 0;
        return (h*3600)+(m*60)+s;
      }

      async function startTimer(meta) {
        var secs = totalSeconds();
        if (secs <= 0) return;
        const payload = { seconds: secs };
        if (meta && typeof meta === 'object') payload.meta = meta;
        try { await fetch('/api/timer/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); } catch(e) {}
      }

      async function addTime(secs, meta) {
        const payload = { seconds: secs };
        if (meta && typeof meta === 'object') payload.meta = meta;
        try { await fetch('/api/timer/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); } catch(e) {}
      }

      async function setHypeActive(active) {
        try {
          await fetch('/api/hype', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: !!active })
          });
        } catch (e) {}
      }

      function renderLog(entries) {
        const box = document.getElementById('eventLog');
        if (!box) return;
        if (!entries || !entries.length) {
          box.textContent = 'No entries yet.';
          return;
        }
        box.innerHTML = entries
          .slice()
          .reverse()
          .map(function(e) {
            var ts = e.ts ? new Date(e.ts) : new Date();
            var tStr = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            var src = e.type || e.source || 'event';
            var label = e.label || '';
            var base = Number(e.baseSeconds || 0);
            var applied = Number(e.appliedSeconds || 0);
            var actual = Number(e.actualSeconds || applied);
            var hype = Number(e.hypeMultiplier || 1);
            var capNote = (applied > 0 && actual < applied) ? ' (capped)' : '';
            var detail = '';
            if (src === 'channel.cheer' || src === 'channel.bits.use') {
              var bits = Number(e.bits || 0);
              if (bits > 0) detail = bits + ' bits';
            } else if (src === 'channel.subscribe' || src === 'channel.subscription.message') {
              if (e.subTier) detail = 'Tier ' + String(e.subTier).replace(/^0+/, '') || e.subTier;
            } else if (src === 'channel.subscription.gift') {
              var gifts = Number(e.giftCount || 0);
              if (gifts > 0) detail = gifts + ' gift sub' + (gifts === 1 ? '' : 's');
            } else if (src === 'channel.charity_campaign.donate') {
              var amt = Number(e.charityAmount || 0);
              var dec = Number(e.charityDecimals || 2);
              if (amt > 0) detail = '$' + (amt / Math.pow(10, dec)).toFixed(dec);
            } else if (src === 'channel.follow') {
              detail = 'Follow';
            } else if (src === 'channel.hype_train.begin') {
              detail = 'Hype Train started';
            } else if (src === 'channel.hype_train.progress') {
              detail = 'Hype Train progress';
            } else if (src === 'channel.hype_train.end') {
              detail = 'Hype Train ended';
            } else if (src === 'manual_start' || src === 'manual_add' || src === 'manual_clear' || src === 'manual_restart') {
              detail = label || (e.source || 'Manual');
            } else if (src === 'sound_alert') {
              var snd = e.soundName || 'Sound';
              var viewer = e.viewerUserId ? ' (user ' + escHtml(e.viewerUserId) + ')' : '';
              return '<div class="log-line"><span class="log-time">' + tStr + '</span><span class="log-text" style="color:#9146FF">' +
                'Sound Alert – ' + escHtml(snd) + viewer +
                '</span></div>';
            }
            var hypeInfo = hype !== 1 ? (' (base ' + base + 's ×' + hype + ')') : '';
            return '<div class="log-line"><span class="log-time">' + tStr + '</span><span class="log-text">' +
              src + (detail ? ' – ' + detail : '') + ': +' + actual + 's' + hypeInfo + capNote +
              '</span></div>';
          })
          .join('');
      }

      async function fetchLog() {
        try {
          const r = await fetch('/api/events/log', { cache: 'no-store' });
          if (!r.ok) return;
          const j = await r.json();
          renderLog(j.entries || []);
        } catch (e) {}
      }

      async function getHypeActive() {
        try { const r = await fetch('/api/hype'); const j = await r.json(); return !!j.hype; } catch(e) { return false; }
      }

      async function getBonusState() {
        try { const r = await fetch('/api/timer/bonus'); return await r.json(); } catch(e) { return { bonusActive: false, bonusStartEpochMs: 0, bonusEndEpochMs: 0 }; }
      }

      async function getTestMultiplier() {
        const hype = await getHypeActive();
        const bonus = await getBonusState();
        if (!window.DEV_RULES) return { multiplier: 1, hypeMultiplier: 1, bonusMultiplier: 1 };
        const hm = hype ? (Number(window.DEV_RULES.hypeTrain?.multiplier) || 1) : 1;
        const bm = bonus.bonusActive ? (Number(window.DEV_RULES.bonusTime?.multiplier) || 1) : 1;
        const stack = Boolean(window.DEV_RULES.bonusTime?.stackWithHype);
        const total = stack ? (hm * bm) : Math.max(hm, bm);
        return { multiplier: total, hypeMultiplier: hm, bonusMultiplier: bm };
      }

      function updateBonusUI(bonusActive, startMs, endMs) {
        const btn = document.getElementById('bonusToggle');
        const status = document.getElementById('bonusStatus');
        const hint = document.getElementById('bonusScheduleHint');
        if (btn) {
          btn.textContent = bonusActive ? 'Deactivate Bonus Time' : 'Activate Bonus Time';
          btn.style.background = bonusActive ? 'var(--accent,#9147ff)' : '';
          btn.style.color = bonusActive ? '#fff' : '';
        }
        if (status) status.textContent = bonusActive ? 'ACTIVE' : '';
        if (hint) {
          const parts = [];
          if (startMs > 0) parts.push('Start: ' + new Date(startMs).toLocaleString());
          if (endMs > 0) parts.push('End: ' + new Date(endMs).toLocaleString());
          hint.textContent = parts.length ? 'Scheduled — ' + parts.join(' | ') : '';
        }
      }

      function num(v, d){ const n = Number(v); return Number.isFinite(n) ? n : d; }

      async function saveDefaultInitial() {
        var secs = totalSeconds();
        var maxH = parseInt(document.getElementById('maxH').value||'0',10)||0;
        var maxM = parseInt(document.getElementById('maxM').value||'0',10)||0;
        var maxS = parseInt(document.getElementById('maxS').value||'0',10)||0;
        if (maxM > 59) maxM = 59; if (maxS > 59) maxS = 59; if (maxH < 0) maxH = 0; if (maxM < 0) maxM = 0; if (maxS < 0) maxS = 0;
        var maxTotal = (maxH*3600)+(maxM*60)+maxS;
        const payload = { defaultInitialSeconds: secs, maxTotalSeconds: maxTotal };
        try { await fetch('/api/user/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); } catch(e) {}
      }

      async function saveMaxOnly(maxTotal) {
        const payload = { maxTotalSeconds: Math.max(0, parseInt(maxTotal,10)||0) };
        try { await fetch('/api/user/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); } catch(e) {}
      }

      function fmt(sec) {
        sec = Math.max(0, (parseInt(sec,10) || 0));
        var h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60;
        var mm = String(m).padStart(2,'0'); var ss = String(s).padStart(2,'0');
        return (h>0? (h+':') : '') + mm + ':' + ss;
      }

      function refresh() {
        const url = overlayUrl();
        document.getElementById('url').textContent = url;
        document.getElementById('preview').src = url;
      }

      const htmlEscapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

      function escHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (ch) => htmlEscapeMap[ch] || ch);
      }


      async function updateCapStatus(){
        const el = document.getElementById('capStatus');
        if (!el) return;
        try {
          const r = await fetch('/api/timer/totals', { cache: 'no-store' });
          const t = await r.json();
          const max = Number(t.maxTotalSeconds||0);
          const init = Number(t.initialSeconds||0);
          const add = Number(t.additionsTotal||0);
          const used = Math.max(0, init + add);
          var status = '';
          if (max > 0) {
            status = 'Max: ' + fmt(max) + ' • Initial: ' + fmt(init) + ' • Added: ' + fmt(add) + ' • Total: ' + fmt(used);
          } else {
            status = 'No max set • Initial: ' + fmt(init) + ' • Added: ' + fmt(add) + ' • Total: ' + fmt(used);
          }
          if (t.capReached) status += ' • CAP REACHED';
          el.textContent = status;
        } catch(e) {}
      }

      function bind() {
        for (const id in inputs) {
          const el = inputs[id];
          el.addEventListener('input', () => { saveStyle(); });
          el.addEventListener('change', () => { saveStyle(); });
        }
        ['warnUnder','warnColor','warnEnabled','dangerUnder','dangerColor','dangerEnabled','flashUnder','flashEnabled'].forEach(function(id){
          const el = document.getElementById(id);
          if (!el) return;
          el.addEventListener('input', () => { saveStyle(); });
          el.addEventListener('change', () => { saveStyle(); });
        });
        document.getElementById('logout').addEventListener('click', (e) => {
          e.preventDefault();
          window.location.href = '/auth/logout?next=' + encodeURIComponent('/overlay/config');
        });
        const copyBtn = document.getElementById('copy');
        copyBtn.addEventListener('click', async (e) => {
          flashButton(copyBtn);
          const url = document.getElementById('url').textContent;
          const old = copyBtn.textContent;
          try { await navigator.clipboard.writeText(url); copyBtn.textContent = 'Copied!'; } catch(e) { copyBtn.textContent = 'Copy failed'; }
          setTimeout(() => { copyBtn.textContent = old; }, 900);
        });
        const rotateBtn = document.getElementById('rotateKey');
        rotateBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          flashButton(rotateBtn);
          if (!confirm('Rotate key? Your OBS URL will need to be updated.')) return;
          setBusy(rotateBtn, true);
          try {
            const r = await fetch('/api/overlay/key/rotate', { method: 'POST' });
            const j = await r.json();
            if (j.key) { inputs.key.value = j.key; refresh(); saveStyle(); }
          } catch (e) {}
          setBusy(rotateBtn, false);
        });
        // Timer controls
        document.getElementById('startTimer').addEventListener('click', async function(e){ e.preventDefault(); const btn=e.currentTarget; flashButton(btn); setBusy(btn,true); await startTimer({ source: 'panel_start_button', label: 'Start Timer' }); await updateCapStatus(); setBusy(btn,false); });
        document.getElementById('saveDefault').addEventListener('click', async function(e){ e.preventDefault(); const btn=e.currentTarget; flashButton(btn); setBusy(btn,true); await saveDefaultInitial(); await updateCapStatus(); setBusy(btn,false); });
        const clearMaxBtn = document.getElementById('clearMax');
        if (clearMaxBtn) {
          clearMaxBtn.addEventListener('click', async function(e){
            e.preventDefault();
            flashButton(clearMaxBtn);
            setBusy(clearMaxBtn, true);
            document.getElementById('maxH').value = 0;
            document.getElementById('maxM').value = 0;
            document.getElementById('maxS').value = 0;
            await saveMaxOnly(0);
            await updateCapStatus();
            setBusy(clearMaxBtn, false);
          });
        }

        // Cap message toggle
        var showCapCb = document.getElementById('showCapMessage');
        if (showCapCb) {
          showCapCb.addEventListener('change', function() {
            document.getElementById('capMessageRow').style.display = showCapCb.checked ? 'block' : 'none';
          });
        }

        // Save cap message settings
        var saveCapBtn = document.getElementById('saveCapMsg');
        if (saveCapBtn) {
          saveCapBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            flashButton(saveCapBtn);
            setBusy(saveCapBtn, true);
            var payload = {
              showCapMessage: document.getElementById('showCapMessage').checked,
              capMessage: document.getElementById('capMessageText').value.trim(),
              capMessageColor: document.getElementById('capMsgColor').value,
              capMessagePosition: document.getElementById('capMsgPosition').value,
              capMessageSize: document.getElementById('capMsgSize').value,
            };
            try { await fetch('/api/user/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); } catch(e) {}
            setBusy(saveCapBtn, false);
          });
        }

        // Force cap reached button
        var forceCapBtn = document.getElementById('forceCapBtn');
        var capForced = false;
        if (forceCapBtn) {
          fetch('/api/timer/totals', { cache: 'no-store' }).then(function(r) { return r.json(); }).then(function(t) {
            capForced = Boolean(t.capForcedOn);
            forceCapBtn.textContent = capForced ? 'Unforce Max Reached' : 'Force Max Reached';
          }).catch(function() {});

          forceCapBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            flashButton(forceCapBtn);
            setBusy(forceCapBtn, true);
            capForced = !capForced;
            try {
              var r = await fetch('/api/timer/force-cap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ forced: capForced }) });
              var j = await r.json();
              capForced = Boolean(j.forced);
              forceCapBtn.textContent = capForced ? 'Unforce Max Reached' : 'Force Max Reached';
            } catch(e) {}
            await updateCapStatus();
            setBusy(forceCapBtn, false);
          });
        }

        Array.from(document.querySelectorAll('[data-add]')).forEach(function(btn){
          btn.addEventListener('click', async function(e){
            e.preventDefault();
            flashButton(btn);
            var v = parseInt(btn.getAttribute('data-add'),10)||0;
            if (v>0) {
              setBusy(btn,true);
              await addTime(v, { source: 'panel_quick_add', label: btn.textContent.trim(), requestedSeconds: v });
              await updateCapStatus();
              setBusy(btn,false);
            }
          });
        });
        // Custom add seconds
        (function(){
          const input = document.getElementById('addCustomSeconds');
          const btn = document.getElementById('addCustomBtn');
          if (!input || !btn) return;
          const doAdd = async () => {
            const v = parseInt(input.value, 10) || 0;
            if (v <= 0) return;
            flashButton(btn);
            setBusy(btn, true);
            await addTime(v, { source: 'panel_custom_add', label: 'Custom Add', requestedSeconds: v });
            await updateCapStatus();
            setBusy(btn, false);
          };
          btn.addEventListener('click', function(e){ e.preventDefault(); doAdd(); });
          input.addEventListener('keydown', function(e){ if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });
        })();
        document.getElementById('pause').addEventListener('click', async function(e){ e.preventDefault(); const btn=e.currentTarget; flashButton(btn); setBusy(btn,true); try { await fetch('/api/timer/pause', { method: 'POST' }); } catch(e) {} setBusy(btn,false); });
        document.getElementById('resume').addEventListener('click', async function(e){ e.preventDefault(); const btn=e.currentTarget; flashButton(btn); setBusy(btn,true); try { await fetch('/api/timer/resume', { method: 'POST' }); } catch(e) {} setBusy(btn,false); });
        const endBtn = document.getElementById('endTimer');
        if (endBtn) {
          endBtn.addEventListener('click', async function(e){
            e.preventDefault();
            const btn = e.currentTarget;
            flashButton(btn);
            setBusy(btn,true);
            try { await fetch('/api/timer/clear', { method: 'POST' }); } catch(e) {}
            await updateCapStatus();
            setBusy(btn,false);
          });
        }
        const restartBtn = document.getElementById('restartTimer');
        if (restartBtn) {
          restartBtn.addEventListener('click', async function(e){
            e.preventDefault();
            const btn = e.currentTarget;
            flashButton(btn);
            setBusy(btn,true);
            try { await fetch('/api/timer/restart', { method: 'POST' }); } catch(e) {}
            await updateCapStatus();
            setBusy(btn,false);
          });
        }
        const devPanel = document.getElementById('devTests');
        if (devPanel) {
          // Expose rules for client-side calculation
          window.DEV_RULES = ${
            rulesSnapshot ? JSON.stringify(rulesSnapshot) : "null"
          };
          // Custom bits
          const bitsBtn = document.getElementById('devApplyBits');
          if (bitsBtn) bitsBtn.addEventListener('click', async function(e){
            e.preventDefault();
            const bits = num(document.getElementById('devBitsInput')?.value, 0);
            if (!window.DEV_RULES || bits <= 0) return;
            let secs = Math.floor(bits / (Number(window.DEV_RULES.bits?.per)||100)) * (Number(window.DEV_RULES.bits?.add_seconds)||0);
            const meta = { source: 'dev_custom_bits', label: 'Custom Bits', bits: bits, requestedSeconds: secs };
            const m = await getTestMultiplier();
            if (m.multiplier > 1) {
              meta.hypeMultiplier = m.hypeMultiplier;
              meta.bonusMultiplier = m.bonusMultiplier;
              secs = Math.floor(secs * m.multiplier);
            }
            flashButton(bitsBtn); setBusy(bitsBtn,true); await addTime(secs, meta); await updateCapStatus(); setBusy(bitsBtn,false);
          });
          // Custom subs
          const subsBtn = document.getElementById('devApplySubs');
          if (subsBtn) subsBtn.addEventListener('click', async function(e){
            e.preventDefault();
            const count = Math.max(1, num(document.getElementById('devSubCount')?.value, 1));
            const tier = String(document.getElementById('devSubTier')?.value||'1000');
            if (!window.DEV_RULES) return;
            let per = Number((window.DEV_RULES.sub||{})[tier] ?? (window.DEV_RULES.sub||{})['1000'] ?? 0);
            let secs = Math.floor(count * per);
            const m = await getTestMultiplier();
            const meta = { source: 'dev_custom_subs', label: 'Custom Subs', subCount: count, subTier: tier, requestedSeconds: secs };
            if (m.multiplier > 1) {
              meta.hypeMultiplier = m.hypeMultiplier;
              meta.bonusMultiplier = m.bonusMultiplier;
              secs = Math.floor(secs * m.multiplier);
            }
            flashButton(subsBtn); setBusy(subsBtn,true); await addTime(secs, meta); await updateCapStatus(); setBusy(subsBtn,false);
          });
          // Custom gift subs
          const giftsBtn = document.getElementById('devApplyGifts');
          if (giftsBtn) giftsBtn.addEventListener('click', async function(e){
            e.preventDefault();
            const count = Math.max(1, num(document.getElementById('devGiftCount')?.value, 1));
            if (!window.DEV_RULES) return;
            let secs = Math.floor(count * (Number(window.DEV_RULES.gift_sub?.per_sub_seconds)||0));
            const m = await getTestMultiplier();
            const meta = { source: 'dev_custom_gifts', label: 'Custom Gift Subs', giftCount: count, requestedSeconds: secs };
            if (m.multiplier > 1) {
              meta.hypeMultiplier = m.hypeMultiplier;
              meta.bonusMultiplier = m.bonusMultiplier;
              secs = Math.floor(secs * m.multiplier);
            }
            flashButton(giftsBtn); setBusy(giftsBtn,true); await addTime(secs, meta); await updateCapStatus(); setBusy(giftsBtn,false);
          });
        }
        const hypeOnBtn = document.getElementById('testHypeOn');
        const hypeOffBtn = document.getElementById('testHypeOff');
        if (hypeOnBtn) hypeOnBtn.addEventListener('click', async function(e){ e.preventDefault(); flashButton(hypeOnBtn); setBusy(hypeOnBtn,true); await setHypeActive(true); await updateCapStatus(); setBusy(hypeOnBtn,false); });
        if (hypeOffBtn) hypeOffBtn.addEventListener('click', async function(e){ e.preventDefault(); flashButton(hypeOffBtn); setBusy(hypeOffBtn,true); await setHypeActive(false); await updateCapStatus(); setBusy(hypeOffBtn,false); });

        // Load current user settings into inputs in case server changed
        fetch('/api/user/settings').then(function(r){return r.json();}).then(function(j){
          var secs = Number(j.defaultInitialSeconds||0);
          inputs.h.value = Math.floor(secs/3600);
          inputs.m.value = Math.floor((secs%3600)/60);
          inputs.s.value = secs%60;
          var max = Number(j.maxTotalSeconds||0);
          document.getElementById('maxH').value = Math.floor(max/3600);
          document.getElementById('maxM').value = Math.floor((max%3600)/60);
          document.getElementById('maxS').value = max%60;
          var showCap = Boolean(j.showCapMessage);
          var capMsg = String(j.capMessage || '');
          document.getElementById('showCapMessage').checked = showCap;
          document.getElementById('capMessageText').value = capMsg;
          document.getElementById('capMessageRow').style.display = showCap ? 'block' : 'none';
          if (j.capMessageColor) document.getElementById('capMsgColor').value = j.capMessageColor;
          if (j.capMessagePosition) document.getElementById('capMsgPosition').value = j.capMessagePosition;
          if (j.capMessageSize) document.getElementById('capMsgSize').value = j.capMessageSize;
        }).catch(function(){});

        // Load current style thresholds to sync controls
        (function(){
          var u = '/api/overlay/style';
          var key = inputs.key.value.trim();
          if (key) { u += '?key=' + encodeURIComponent(key); }
          fetch(u, { cache: 'no-store' }).then(function(r){return r.json();}).then(function(s){
            try {
              if (typeof s.warnUnderSeconds !== 'undefined') document.getElementById('warnUnder').value = Number(s.warnUnderSeconds)||0;
              if (typeof s.warnColor !== 'undefined') document.getElementById('warnColor').value = s.warnColor || '#FFA500';
              if (document.getElementById('warnEnabled')) {
                document.getElementById('warnEnabled').checked =
                  (typeof s.warnEnabled === 'boolean') ? s.warnEnabled : true;
              }
              if (typeof s.dangerUnderSeconds !== 'undefined') document.getElementById('dangerUnder').value = Number(s.dangerUnderSeconds)||0;
              if (typeof s.dangerColor !== 'undefined') document.getElementById('dangerColor').value = s.dangerColor || '#FF4D4D';
              if (document.getElementById('dangerEnabled')) {
                document.getElementById('dangerEnabled').checked =
                  (typeof s.dangerEnabled === 'boolean') ? s.dangerEnabled : true;
              }
              if (typeof s.flashUnderSeconds !== 'undefined') document.getElementById('flashUnder').value = Number(s.flashUnderSeconds)||0;
              if (document.getElementById('flashEnabled')) {
                document.getElementById('flashEnabled').checked =
                  (typeof s.flashEnabled === 'boolean') ? s.flashEnabled : true;
              }
              if (typeof s.timeFormat !== 'undefined') document.getElementById('timeFormat').value = ['hh:mm:ss','dd:hh:mm:ss','auto'].includes(s.timeFormat) ? s.timeFormat : 'mm:ss';
              if (document.getElementById('addEffectEnabled')) {
                document.getElementById('addEffectEnabled').checked =
                  (typeof s.addEffectEnabled === 'boolean') ? s.addEffectEnabled : true;
              }
              if (document.getElementById('addEffectMode')) {
                document.getElementById('addEffectMode').value = s.addEffectMode || 'pulse';
              }
              if (document.getElementById('hypeLabelEnabled')) {
                document.getElementById('hypeLabelEnabled').checked =
                  (typeof s.hypeLabelEnabled === 'boolean') ? s.hypeLabelEnabled : true;
              }
              if (document.getElementById('hypeLabel')) {
                document.getElementById('hypeLabel').value = s.hypeLabel || '🔥 Hype Train active';
              }
            } catch(e) {}
          }).catch(function(){});
        })();

        // Show current remaining
        function updateRemain(){ fetch('/api/timer/state').then(function(r){return r.json();}).then(function(j){ document.getElementById('remain').textContent = fmt(j.remaining||0); }).catch(function(){}); }
        updateRemain(); setInterval(updateRemain, 1000);
        updateCapStatus(); setInterval(updateCapStatus, 3000);

        // Load rules and populate inputs
        fetch('/api/rules').then(r=>r.json()).then(function(rr){
          try {
            if (rr && rr.bits) {
              document.getElementById('r_bits_per').value = rr.bits.per ?? 100;
              document.getElementById('r_bits_add').value = rr.bits.add_seconds ?? 60;
            }
            if (rr && rr.sub) {
              document.getElementById('r_sub_1000').value = rr.sub['1000'] ?? 300;
              if (document.getElementById('r_sub_2000')) document.getElementById('r_sub_2000').value = rr.sub['2000'] ?? 600;
              if (document.getElementById('r_sub_3000')) document.getElementById('r_sub_3000').value = rr.sub['3000'] ?? 900;
            }
            if (rr && rr.resub) {
              if (document.getElementById('r_resub_base')) document.getElementById('r_resub_base').value = rr.resub.base_seconds ?? 300;
            }
            if (rr && rr.gift_sub) {
              if (document.getElementById('r_gift_per')) document.getElementById('r_gift_per').value = rr.gift_sub.per_sub_seconds ?? 300;
            }
            if (rr && rr.charity) {
              if (document.getElementById('r_charity_per_usd')) document.getElementById('r_charity_per_usd').value = rr.charity.per_usd ?? 60;
            }
            if (rr && rr.follow) {
              const add = Number(rr.follow.add_seconds ?? 600);
              const enabled = Boolean(rr.follow.enabled);
              if (document.getElementById('r_follow_add')) document.getElementById('r_follow_add').value = add;
              if (document.getElementById('r_follow_enabled')) document.getElementById('r_follow_enabled').checked = enabled;
            }
            if (rr && rr.hypeTrain) {
              document.getElementById('r_hype').value = rr.hypeTrain.multiplier ?? 2;
            }
            if (rr && rr.bonusTime) {
              if (document.getElementById('r_bonus')) document.getElementById('r_bonus').value = rr.bonusTime.multiplier ?? 2;
              if (document.getElementById('r_bonus_stack')) document.getElementById('r_bonus_stack').checked = Boolean(rr.bonusTime.stackWithHype);
            }
          } catch (e) {}
        }).catch(function(){});

        // Save rules
        document.getElementById('saveRules').addEventListener('click', async function(e){
          e.preventDefault();
          const body = {
            bits: { per: Number(document.getElementById('r_bits_per').value||100), add_seconds: Number(document.getElementById('r_bits_add').value||60) },
            sub: {
              '1000': Number(document.getElementById('r_sub_1000').value||300),
              '2000': Number((document.getElementById('r_sub_2000')||{}).value||600),
              '3000': Number((document.getElementById('r_sub_3000')||{}).value||900)
            },
            resub: { base_seconds: Number((document.getElementById('r_resub_base')||{}).value||300) },
            gift_sub: { per_sub_seconds: Number((document.getElementById('r_gift_per')||{}).value||300) },
            charity: { per_usd: Number((document.getElementById('r_charity_per_usd')||{}).value||60) },
            follow: { enabled: Boolean((document.getElementById('r_follow_enabled')||{}).checked), add_seconds: Number((document.getElementById('r_follow_add')||{}).value||600) },
            hypeTrain: { multiplier: Number(document.getElementById('r_hype').value||2) },
            bonusTime: { multiplier: Number(document.getElementById('r_bonus')?.value||2), stackWithHype: Boolean(document.getElementById('r_bonus_stack')?.checked) }
          };
          window.DEV_RULES = body;
          try { await fetch('/api/rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); } catch(e) {}
        });

        // (rules UI removed)

        const clearLogBtn = document.getElementById('clearLog');
        if (clearLogBtn) {
          clearLogBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            flashButton(clearLogBtn);
            try { await fetch('/api/events/log/clear', { method: 'POST' }); } catch (err) {}
            renderLog([]);
          });
        }

        // Bonus time controls
        const bonusToggle = document.getElementById('bonusToggle');
        if (bonusToggle) {
          // Initial load
          getBonusState().then(function(s) { updateBonusUI(s.bonusActive, s.bonusStartEpochMs, s.bonusEndEpochMs); });
          bonusToggle.addEventListener('click', async function(e) {
            e.preventDefault();
            flashButton(bonusToggle);
            const cur = await getBonusState();
            try {
              const r = await fetch('/api/timer/bonus', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !cur.bonusActive }) });
              const j = await r.json();
              updateBonusUI(j.bonusActive, j.bonusStartEpochMs, j.bonusEndEpochMs);
            } catch(e) {}
          });
        }
        const bonusScheduleSave = document.getElementById('bonusScheduleSave');
        if (bonusScheduleSave) {
          bonusScheduleSave.addEventListener('click', async function(e) {
            e.preventDefault();
            flashButton(bonusScheduleSave);
            const startVal = document.getElementById('bonusStart')?.value || '';
            const endVal = document.getElementById('bonusEnd')?.value || '';
            const body = {};
            if (startVal) body.startTime = new Date(startVal).toISOString();
            if (endVal) body.endTime = new Date(endVal).toISOString();
            try {
              const r = await fetch('/api/timer/bonus', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
              const j = await r.json();
              updateBonusUI(j.bonusActive, j.bonusStartEpochMs, j.bonusEndEpochMs);
            } catch(e) {}
          });
        }
        const bonusScheduleClear = document.getElementById('bonusScheduleClear');
        if (bonusScheduleClear) {
          bonusScheduleClear.addEventListener('click', async function(e) {
            e.preventDefault();
            flashButton(bonusScheduleClear);
            try {
              const r = await fetch('/api/timer/bonus', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ startTime: null, endTime: null }) });
              const j = await r.json();
              updateBonusUI(j.bonusActive, j.bonusStartEpochMs, j.bonusEndEpochMs);
              if (document.getElementById('bonusStart')) document.getElementById('bonusStart').value = '';
              if (document.getElementById('bonusEnd')) document.getElementById('bonusEnd').value = '';
            } catch(e) {}
          });
        }

        setInterval(fetchLog, 5000);
      }

      initSections();
      bind();
      refresh();
      saveStyle();
    </script>
  </body>
</html>`;

  return html;
}
