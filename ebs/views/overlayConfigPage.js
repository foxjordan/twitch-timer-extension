import {
  THEME_CSS_VARS,
  THEME_TOGGLE_STYLES,
  renderThemeBootstrapScript,
} from "./theme.js";
import { GLOBAL_HEADER_STYLES, renderGlobalHeader } from "./globalHeader.js";

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

  const safeNum = (val, fallback = 0) => {
    const num = Number(val);
    return Number.isFinite(num) ? num : fallback;
  };

  const devCharityUsd = 5;
  const devTest = {
    bitsSeconds: safeNum(rulesSnapshot?.bits?.add_seconds, 60),
    bitsPer: safeNum(rulesSnapshot?.bits?.per, 100),
    subSeconds: safeNum(rulesSnapshot?.sub?.["1000"], 300),
    resubSeconds: safeNum(rulesSnapshot?.resub?.base_seconds, 300),
    giftSeconds: safeNum(rulesSnapshot?.gift_sub?.per_sub_seconds, 300),
    charityUsd: devCharityUsd,
    charitySeconds:
      safeNum(rulesSnapshot?.charity?.per_usd, 60) * devCharityUsd,
  };

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
    <title>Timer Overlay Configurator</title>
    <link rel="icon" type="image/png" href="/assets/convertico-coin_24x24.png">
    <script id="Cookiebot" src="https://consent.cookiebot.com/uc.js" data-cbid="6770198d-2c1f-46f8-af4b-694edc70484c" type="text/javascript"></script>
    ${renderThemeBootstrapScript()}
    <style>
      ${THEME_CSS_VARS}
      body { margin: 0; font-family: Inter, system-ui, Arial, sans-serif; background: var(--page-bg); color: var(--text-color); }
      .row { display: flex; gap: 16px; padding: 16px; }
      .panel { background: var(--surface-color); border: 1px solid var(--surface-border); border-radius: 12px; padding: 16px; }
      .controls { width: 420px; }
      .control { display: grid; grid-template-columns: 140px 1fr; align-items: center; gap: 8px; margin-bottom: 10px; }
      .control label { color: var(--text-muted); font-size: 13px; }
      .preview { flex: 1; min-height: 320px; }
      .row2 { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
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
      .time-input { max-width: 50%; }
      button { background: var(--accent-color); color: #ffffff; border: 0; padding: 8px 10px; border-radius: 8px; cursor: pointer; }
      button.secondary { background: var(--secondary-button-bg); color: var(--secondary-button-text); border: 1px solid var(--secondary-button-border); }
      button { transition: transform .04s ease, box-shadow .15s ease, filter .15s ease, opacity .2s; }
      button:hover { box-shadow: 0 0 0 1px rgba(0,0,0,0.2) inset; filter: brightness(1.02); }
      button:active { transform: translateY(1px) scale(0.99); filter: brightness(0.98); }
      button:disabled { opacity: 0.5; cursor: not-allowed; }
      @keyframes btnpulse { 0% { transform: scale(0.99); } 100% { transform: scale(1); } }
      .btn-click { animation: btnpulse .18s ease; }
      .url { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--code-bg); border: 1px solid var(--code-border); padding: 8px; border-radius: 8px; overflow: auto; }
      iframe { width: 100%; height: 180px; border: 1px solid var(--surface-border); background: var(--surface-muted); border-radius: 12px; box-shadow: 0 8px 30px var(--goal-card-shadow); }
      .goal-toolbar { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
      .goal-list { display: flex; flex-direction: column; gap: 16px; }
      .goal-card { background: var(--goal-card-bg); border: 1px solid var(--goal-card-border); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 12px 30px var(--goal-card-shadow); }
      .goal-card-header { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: center; }
      .goal-card-header .meta { font-size: 12px; color: var(--text-muted); display: flex; flex-direction: column; gap: 2px; }
      .goal-card-actions { display: flex; gap: 8px; flex-wrap: wrap; }
      .goal-preview { border: 1px solid var(--goal-preview-border); border-radius: 12px; padding: 12px; background: var(--goal-preview-bg); display: flex; flex-direction: column; gap: 8px; }
      .goal-preview-header { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--text-muted); }
      .goal-preview-canvas { min-height: 140px; border-radius: 12px; background: var(--surface-muted); padding: 16px; display: flex; align-items: center; justify-content: center; overflow: hidden; box-sizing: border-box; }
      .goal-preview-note { font-size: 12px; color: var(--text-muted); }
      .goal-preview-card { width: 100%; display: flex; flex-direction: column; gap: 6px; padding: 16px 28px; border-radius: 12px; box-sizing: border-box; }
      .goal-preview-card .goal-preview-title { font-size: 18px; font-weight: 600; }
      .goal-preview-card .goal-preview-values { font-size: 14px; color: var(--text-muted); margin-bottom: 10px; display: flex; gap: 12px; flex-wrap: wrap; }
      .goal-preview-card .goal-preview-track { width: 100%; height: 28px; border-radius: 999px; background: var(--surface-muted); overflow: hidden; position: relative; margin: 0 8px; }
      .goal-preview-card .goal-preview-fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0%; display: flex; }
      .goal-preview-card .goal-preview-pct { font-size: 22px; font-weight: 700; }
      .goal-preview-card .goal-preview-legend { display: flex; flex-wrap: wrap; gap: 6px 12px; font-size: 11px; color: var(--text-muted); margin-top: 8px; }
      .goal-card-section { border: 1px solid var(--section-border); border-radius: 10px; margin-top: 8px; background: var(--section-bg); }
      .goal-card-section:first-of-type { margin-top: 0; }
      .goal-section-toggle { width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: transparent; border: 0; color: inherit; font-weight: 600; cursor: pointer; border-radius: 10px; }
      .goal-section-toggle span:last-child { font-size: 12px; color: var(--text-muted); }
      .goal-section-body { padding: 0 12px 12px; }
      .goal-card-section.collapsed .goal-section-body { display: none; }
      .goal-card-section.collapsed .goal-section-toggle span:last-child { transform: rotate(-90deg); }
      .goal-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
      .goal-field { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
      .goal-field label { font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; color: var(--text-muted); }
      .goal-url code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; display: block; margin-top: 4px; background: var(--code-bg); border: 1px solid var(--code-border); padding: 6px 8px; border-radius: 6px; color: var(--text-color); }
      .goal-empty { padding: 14px; border: 1px dashed var(--empty-border); border-radius: 10px; text-align: center; color: var(--text-muted); }
      .goal-manual { display: flex; flex-direction: column; gap: 6px; }
      .goal-manual-row { display: flex; gap: 8px; flex-wrap: wrap; }
      .goal-manual-row input[type="number"] { max-width: 140px; }
      button.danger { background: #b91c1c; }
      .goal-pill { padding: 2px 8px; border-radius: 999px; background: var(--pill-bg); border: 1px solid var(--pill-border); font-size: 12px; letter-spacing: 0.05em; text-transform: uppercase; color: var(--text-muted); }
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
    <div class="row">
      <div class="panel controls">
        <div class="${sectionClass("style")}" data-section="style">
          <button class="section-toggle" data-section-toggle="style" aria-expanded="${sectionExpandedAttr(
            "style"
          )}">
            <span>Overlay Style</span>
            <span class="section-arrow">▾</span>
          </button>
          <div class="section-body" ${sectionBodyAttr("style")}>
            <div class="control"><label>Overlay Key</label>
              <div style="display:flex; gap:8px; align-items:center;">
                <input id="key" type="text" value="${userKey}" readonly>
                <button class="secondary" id="rotateKey" title="Generate a new overlay key">Rotate</button>
              </div>
            </div>
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
                <option value="auto" selected>auto (hh:mm:ss when hours > 0)</option>
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

        <div class="${sectionClass("rules")}" data-section="rules">
          <button class="section-toggle" data-section-toggle="rules" aria-expanded="${sectionExpandedAttr(
            "rules"
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
            <div class="control"><label>Hype Train Modifier</label><input id="r_hype" type="number" min="0" step="0.1" value="2"></div>
            <div class="row2"><button id="saveRules">Save Rules</button></div>
          </div>
        </div>

        <div class="${sectionClass("testing")}" data-section="testing">
          <button class="section-toggle" data-section-toggle="testing" aria-expanded="${sectionExpandedAttr(
            "testing"
          )}">
            <span>Testing Tools</span>
            <span class="section-arrow">▾</span>
          </button>
          <div class="section-body" ${sectionBodyAttr("testing")}>
            <div class="row2" id="devTests">
              <button class="secondary" data-test-seconds="${
                devTest.bitsSeconds
              }" title="Simulate ${devTest.bitsPer} bits">
                Quick: ${devTest.bitsPer} bits (+${devTest.bitsSeconds}s)
              </button>
              <button class="secondary" data-test-seconds="${
                devTest.subSeconds
              }" title="Simulate Tier 1 sub">
                Quick: 1x T1 sub (+${devTest.subSeconds}s)
              </button>
              <button class="secondary" data-test-seconds="${
                devTest.giftSeconds
              }" title="Simulate single gift sub">
                Quick: 1x gift sub (+${devTest.giftSeconds}s)
              </button>
            </div>
            <div class="row2" id="devCustomSubs">
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
      <div class="panel preview">
        <div style="margin-bottom:8px; opacity:0.85">Live Preview</div>
        <iframe id="preview" referrerpolicy="no-referrer"></iframe>
        <div style="margin-top:8px" class="url" id="url"></div>
        <div style="margin-top:8px; display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
          <button id="copy">Copy URL</button>
          <div class="hint">Add as a Browser Source in OBS</div>
        </div>
        <div style="margin-top:8px" class="hint">Pause/Resume and Start actions update the live overlay immediately.</div>
        <div class="${sectionClass("timer")}" data-section="timer">
          <button class="section-toggle" data-section-toggle="timer" aria-expanded="${sectionExpandedAttr(
            "timer"
          )}">
            <span>Timer Controls</span>
            <span class="section-arrow">▾</span>
          </button>
          <div class="section-body" ${sectionBodyAttr("timer")}>
            <div class="control"><label>Hours</label><input id="h" class="time-input" type="number" min="0" step="1" value="${defH}"></div>
            <div class="control"><label>Minutes</label><input id="m" class="time-input" type="number" min="0" max="59" step="1" value="${defM}"></div>
            <div class="control"><label>Seconds</label><input id="s" class="time-input" type="number" min="0" max="59" step="1" value="${defS}"></div>
            <div class="control"><label>Max Stream Length</label>
              <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <div style="display:flex; gap:8px; align-items:center;">
                  <input id="maxH" type="number" min="0" step="1" value="0" style="max-width:80px">h
                  <input id="maxM" type="number" min="0" max="59" step="1" value="0" style="max-width:80px">m
                  <input id="maxS" type="number" min="0" max="59" step="1" value="0" style="max-width:80px">s
                </div>
                <button class="secondary" id="clearMax" title="Remove the max cap">Clear Max</button>
              </div>
            </div> 
            <div class="row2">
              <button id="startTimer">Start Timer</button>
              <button class="secondary" id="pause">Pause</button>
              <button class="secondary" id="resume">Resume</button>
              <button class="secondary" id="endTimer">End Timer</button>
              <button class="secondary" id="restartTimer">Restart Timer</button>
            </div>
            <div class="row2">
              <button class="secondary" id="saveDefault">Save Default</button>
            </div>
            <div class="row2" style="margin-top:12px;">
              <button class="secondary" data-add="300">+5 min</button>
              <button class="secondary" data-add="600">+10 min</button>
              <button class="secondary" data-add="1800">+30 min</button>
            </div>
            <div class="row2">
              <input id="addCustomSeconds" type="number" min="1" step="1" placeholder="Seconds" style="max-width:140px" />
              <button class="secondary" id="addCustomBtn">Add</button>
            </div>
            <div class="row2" id="devCustomBits">
              <input id="devBitsInput" type="number" min="0" step="1" placeholder="Bits amount (testing)" style="max-width:150px" />
              <button class="secondary" id="devApplyBits" title="Apply custom bits based on rules">Apply Bits</button>
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

        <div class="${sectionClass("events")}" data-section="events">
          <button class="section-toggle" data-section-toggle="events" aria-expanded="${sectionExpandedAttr(
            "events"
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

        <div class="${sectionClass("goals")}" data-section="goals">
          <button class="section-toggle" data-section-toggle="goals" aria-expanded="${sectionExpandedAttr(
            "goals"
          )}">
            <span>Goal Tracking Bars (Experimental)</span>
            <span class="section-arrow">▾</span>
          </button>
          <div class="section-body" ${sectionBodyAttr("goals")}>
            <p style="opacity:0.85; max-width:640px">
              Create persistent goal bars for subs, bits, or mixed fundraisers. Customize the layout, auto-counting rules, and copy goal-specific Browser Source URLs for OBS or Streamlabs.
            </p>
            <div class="goal-toolbar">
              <button id="createGoal">New goal</button>
              <button class="secondary" id="createSubGoal">New sub goal</button>
              <button class="secondary" id="refreshGoals">Refresh</button>
            </div>
            <div id="goalList" class="goal-list">
              <div class="goal-empty">Loading goals…</div>
            </div>
          </div>
        </div>

      </div>
    </div>
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
      const GOAL_OVERLAY_BASE = window.location.origin + '/overlay/goal';
      const goalListEl = document.getElementById('goalList');
      const goalCreateBtn = document.getElementById('createGoal');
      const goalCreateSubBtn = document.getElementById('createSubGoal');
      const goalRefreshBtn = document.getElementById('refreshGoals');
      const goalState = { goals: [], defaults: null };
      const goalSegmentLabels = {
        tier1000: 'Tier 1',
        tier2000: 'Tier 2',
        tier3000: 'Tier 3',
        resub: 'Resub',
        gift: 'Gift subs',
        bits: 'Bits',
        tips: 'Tips',
        charity: 'Charity',
        manual: 'Manual',
        other: 'Other'
      };
      const goalSectionStateKey = 'overlay_goal_section_state_v1';
      let goalSectionState = {};
      try {
        const saved = JSON.parse(window.localStorage.getItem(goalSectionStateKey) || '{}');
        if (saved && typeof saved === 'object') goalSectionState = saved;
      } catch (e) {}

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

      function prettyNumber(value) {
        const n = Number(value) || 0;
        return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
      }

      function goalDateValue(iso) {
        if (!iso) return '';
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return '';
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        return \`\${yyyy}-\${mm}-\${dd}T\${hh}:\${min}\`;
      }

      function assignPath(target, path, value) {
        if (!path) return;
        const keys = path.split('.');
        let ref = target;
        for (let i = 0; i < keys.length; i += 1) {
          const key = keys[i];
          if (i === keys.length - 1) {
            ref[key] = value;
          } else {
            if (typeof ref[key] !== 'object' || ref[key] === null) ref[key] = {};
            ref = ref[key];
          }
        }
      }

      function persistGoalSectionState() {
        try { window.localStorage.setItem(goalSectionStateKey, JSON.stringify(goalSectionState)); } catch (e) {}
      }

      function setGoalSectionState(id, collapsed) {
        if (!id) return;
        goalSectionState[id] = Boolean(collapsed);
        persistGoalSectionState();
      }

      function applyGoalSectionState(card) {
        if (!card) return;
        card.querySelectorAll('[data-goal-section]').forEach((section) => {
          const id = section.getAttribute('data-goal-section');
          if (!id) return;
          const collapsed = Boolean(goalSectionState[id]);
          section.classList.toggle('collapsed', collapsed);
        });
      }

      function deepCloneGoal(goal) {
        return JSON.parse(JSON.stringify(goal || {}));
      }

      function mergeGoalDraft(target, patch) {
        if (!patch || typeof patch !== 'object') return target;
        for (const [key, value] of Object.entries(patch)) {
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            const base = (typeof target[key] === 'object' && target[key] !== null) ? target[key] : {};
            target[key] = mergeGoalDraft({ ...base }, value);
          } else if (value !== undefined) {
            target[key] = value;
          }
        }
        return target;
      }

      function buildPreviewGoal(goal, card) {
        const draft = collectGoalPayload(card);
        const merged = mergeGoalDraft(deepCloneGoal(goal), draft);
        if (!merged.style) merged.style = {};
        if (!merged.style.segmentColors) merged.style.segmentColors = {};
        if (!merged.segments) merged.segments = {};
        return merged;
      }

      function renderGoalPreview(card) {
        if (!card) return;
        const mount = card.querySelector('[data-goal-preview]');
        if (!mount) return;
        const goalId = card.getAttribute('data-goal-id');
        const goal = goalState.goals.find((g) => g.id === goalId);
        if (!goal) {
          mount.innerHTML = '<div class="goal-preview-note">Save this goal to preview.</div>';
          return;
        }
        const data = buildPreviewGoal(goal, card);
        const style = data.style || {};
        const unit = data.unitLabel || 'points';
        const percent = data.targetValue > 0 ? Math.min(100, Math.max(0, (Number(data.currentValue || 0) / Number(data.targetValue || 0)) * 100)) : 0;
        const container = document.createElement('div');
        container.className = 'goal-preview-card';
        container.style.color = style.labelColor || '#FFFFFF';
        if (style.backgroundColor) container.style.background = style.backgroundColor;
        container.style.padding = '8px 10px';
        container.style.alignItems =
          style.align === 'left' ? 'flex-start' : style.align === 'right' ? 'flex-end' : 'center';
        const title = document.createElement('div');
        title.className = 'goal-preview-title';
        title.textContent = data.title || 'Untitled Goal';
        if (style.showLabel === false) title.style.display = 'none';
        container.appendChild(title);
        const values = document.createElement('div');
        values.className = 'goal-preview-values';
        values.textContent =
          prettyNumber(Math.max(0, data.currentValue || 0)) +
          ' / ' +
          prettyNumber(Math.max(1, data.targetValue || 0)) +
          ' ' +
          unit;
        if (style.showValue === false) values.style.display = 'none';
        container.appendChild(values);
        const track = document.createElement('div');
        track.className = 'goal-preview-track';
        track.style.height = Math.max(16, Number(style.trackThickness || 32)) + 'px';
        track.style.borderRadius = Math.max(4, Number(style.borderRadius || 20)) + 'px';
        track.style.background = style.emptyColor || 'rgba(255,255,255,0.12)';
        const fill = document.createElement('div');
        fill.className = 'goal-preview-fill';
        const gradient =
          style.fillSecondaryColor && style.fillSecondaryColor !== style.fillColor
            ? 'linear-gradient(90deg, ' + (style.fillColor || '#9146FF') + ', ' + style.fillSecondaryColor + ')'
            : (style.fillColor || '#9146FF');
        fill.style.background = gradient;
        fill.style.width = percent + '%';
        const segments = Object.entries(data.segments || {}).filter(([, val]) => Number(val) > 0);
        const totalSegments = segments.reduce((sum, [, val]) => sum + Number(val || 0), 0) || Math.max(1, Number(data.currentValue || 0));
        if (style.showSegmentsOnBar !== false && totalSegments > 0) {
          fill.style.display = 'flex';
          fill.style.gap = '2px';
          segments.forEach(([key, val]) => {
            const seg = document.createElement('div');
            seg.style.flex = String(Math.max(0, Number(val || 0)));
            seg.style.background = (style.segmentColors && style.segmentColors[key]) || '#ffffff';
            fill.appendChild(seg);
          });
        }
        track.appendChild(fill);
        container.appendChild(track);
        const pct = document.createElement('div');
        pct.className = 'goal-preview-pct';
        pct.style.color = style.percentColor || '#FFFFFF';
        pct.textContent = percent.toFixed(1).replace(/\.0$/, '') + '%';
        if (style.showPercent === false) pct.style.display = 'none';
        container.appendChild(pct);
        if (style.showSegmentLegend !== false && segments.length) {
          const legend = document.createElement('div');
          legend.className = 'goal-preview-legend';
          segments.forEach(([key, val]) => {
            const span = document.createElement('span');
            const label = goalSegmentLabels[key] || key;
            span.textContent = label + ': ' + prettyNumber(val);
            span.style.color = (style.segmentColors && style.segmentColors[key]) || '#ffffff';
            legend.appendChild(span);
          });
          container.appendChild(legend);
        }
        mount.innerHTML = '';
        mount.appendChild(container);
      }

      function refreshGoalPreviews(targetCard) {
        if (targetCard) {
          applyGoalSectionState(targetCard);
          renderGoalPreview(targetCard);
          return;
        }
        if (!goalListEl) return;
        goalListEl.querySelectorAll('.goal-card').forEach((card) => {
          applyGoalSectionState(card);
          renderGoalPreview(card);
        });
      }

      function goalEmbedUrl(goal, slugOverride) {
        if (!goal) return GOAL_OVERLAY_BASE;
        const slug = (slugOverride && String(slugOverride).trim()) || goal.overlaySlug || goal.id;
        let url = GOAL_OVERLAY_BASE + '?goal=' + encodeURIComponent(slug || goal.id);
        const keyValue = (inputs.key && inputs.key.value && inputs.key.value.trim()) || '';
        if (keyValue) url += '&key=' + encodeURIComponent(keyValue);
        return url;
      }

      function boolAttr(flag) {
        return flag ? 'checked' : '';
      }

      function goalCardTemplate(goal) {
        const style = goal.style || {};
        const rules = goal.rules || {};
        const isSubGoal = String(goal.type || '').toLowerCase() === 'sub_goal';
        const startVal = goalDateValue(goal.startAt);
        const endVal = goalDateValue(goal.endAt);
        const progress = goal.targetValue > 0 ? Math.min(100, Math.max(0, (goal.currentValue || 0) / goal.targetValue * 100)).toFixed(1).replace(/\.0$/, '') : '0';
        const subBaseline = isSubGoal ? Number(goal.subBaseline ?? (goal.meta?.subBaseline ?? 0)) : null;
        const lastSubCount = isSubGoal ? Number(goal.lastSubCount ?? (goal.meta?.lastSubCount ?? 0)) : null;
        const embed = escHtml(goalEmbedUrl(goal));
        const showOverlay = rules.showOnOverlay !== false;
        const archived = Boolean(goal.archived);
        const tierWeights = rules.tierWeights || {};
        const segmentColors = style.segmentColors || {};
        const baselineText = Number.isFinite(subBaseline) ? prettyNumber(subBaseline) : '—';
        const liveText = Number.isFinite(lastSubCount) ? prettyNumber(lastSubCount) : '—';
        const unitField = isSubGoal
          ? '<div class="goal-field"><label>Unit label</label><div class="hint">Sub goals always use subs</div></div>'
          : \`<div class="goal-field">
                <label>Unit label</label>
                <input type="text" data-field="unitLabel" value="\${escHtml(goal.unitLabel || 'points')}" placeholder="points, minutes, subs…" />
              </div>\`;
        const subInfoBlock = isSubGoal
          ? \`<div class="goal-field" style="grid-column:1 / -1;">
                <label>Live sub count</label>
                <div class="hint">Current subs: \${liveText} • Baseline: \${baselineText}</div>
             </div>\`
          : '';
        const rulesSection = isSubGoal
          ? ''
          : \`<div class="goal-card-section" data-goal-section="rules">
               <button type="button" class="goal-section-toggle" data-goal-section-toggle="rules">
                 <span>Rules &amp; contributions</span>
                 <span>▾</span>
               </button>
               <div class="goal-section-body">
                 <div class="goal-grid">
                   <div class="goal-field"><label><input type="checkbox" data-field="rules.autoTrackSubs" \${boolAttr(rules.autoTrackSubs !== false)} /> Auto-count new subs</label></div>
                   <div class="goal-field"><label><input type="checkbox" data-field="rules.autoTrackResubs" \${boolAttr(rules.autoTrackResubs !== false)} /> Auto-count resubs</label></div>
                   <div class="goal-field"><label><input type="checkbox" data-field="rules.autoTrackGifts" \${boolAttr(rules.autoTrackGifts !== false)} /> Auto-count gift subs</label></div>
                   <div class="goal-field"><label><input type="checkbox" data-field="rules.autoTrackBits" \${boolAttr(rules.autoTrackBits)} /> Auto-count bits</label></div>
                   <div class="goal-field"><label><input type="checkbox" data-field="rules.autoTrackTips" \${boolAttr(rules.autoTrackTips)} /> Auto-count tips</label></div>
                   <div class="goal-field"><label><input type="checkbox" data-field="rules.autoTrackCharity" \${boolAttr(rules.autoTrackCharity)} /> Auto-count charity</label></div>
                   <div class="goal-field">
                     <label>Tier 1 weight</label>
                     <input type="number" min="0" step="0.1" data-field="rules.tierWeights.1000" value="\${Number(tierWeights['1000'] ?? 1)}" />
                   </div>
                   <div class="goal-field">
                     <label>Tier 2 weight</label>
                     <input type="number" min="0" step="0.1" data-field="rules.tierWeights.2000" value="\${Number(tierWeights['2000'] ?? 2)}" />
                   </div>
                   <div class="goal-field">
                     <label>Tier 3 weight</label>
                     <input type="number" min="0" step="0.1" data-field="rules.tierWeights.3000" value="\${Number(tierWeights['3000'] ?? 6)}" />
                   </div>
                   <div class="goal-field">
                     <label>Resub weight</label>
                     <input type="number" min="0" step="0.1" data-field="rules.resubWeight" value="\${Number(rules.resubWeight || 1)}" />
                   </div>
                   <div class="goal-field">
                     <label>Gift weight per sub</label>
                     <input type="number" min="0" step="0.1" data-field="rules.giftWeightPerSub" value="\${Number(rules.giftWeightPerSub || 0)}" />
                   </div>
                   <div class="goal-field">
                     <label>Bits per unit</label>
                     <input type="number" min="1" step="1" data-field="rules.bitsPerUnit" value="\${Number(rules.bitsPerUnit || 100)}" />
                   </div>
                   <div class="goal-field">
                     <label>Value per bits unit</label>
                     <input type="number" min="0" step="0.1" data-field="rules.bitsUnitValue" value="\${Number(rules.bitsUnitValue || 1)}" />
                   </div>
                   <div class="goal-field">
                     <label>Value per USD (tips)</label>
                     <input type="number" min="0" step="0.1" data-field="rules.tipsPerUsd" value="\${Number(rules.tipsPerUsd || 1)}" />
                   </div>
                   <div class="goal-field">
                     <label>Value per USD (charity)</label>
                     <input type="number" min="0" step="0.1" data-field="rules.charityPerUsd" value="\${Number(rules.charityPerUsd || 1)}" />
                   </div>
                   <div class="goal-field">
                     <label>Manual unit value</label>
                     <input type="number" min="0" step="0.1" data-field="rules.manualUnitValue" value="\${Number(rules.manualUnitValue || 1)}" />
                   </div>
                 </div>
               </div>
             </div>\`;
        const manualSection = isSubGoal
          ? ''
          : \`<div class="goal-card-section goal-manual" data-goal-section="manual">
               <button type="button" class="goal-section-toggle" data-goal-section-toggle="manual">
                 <span>Manual adjustments</span>
                 <span>▾</span>
               </button>
               <div class="goal-section-body">
                 <div class="goal-manual-row">
                   <select data-manual-field="type">
                     <option value="tier1000">Tier 1 sub</option>
                     <option value="tier2000">Tier 2 sub</option>
                     <option value="tier3000">Tier 3 sub</option>
                     <option value="gift">Gift subs</option>
                     <option value="resub">Resub</option>
                     <option value="bits">Bits</option>
                     <option value="tips">Tips</option>
                     <option value="charity">Charity</option>
                     <option value="manual" selected>Manual value</option>
                   </select>
                   <input type="number" min="0" step="1" data-manual-field="amount" placeholder="Amount" />
                  <input type="text" data-manual-field="note" placeholder="Note (optional)" />
                  <button class="secondary" data-action="manual">Apply</button>
                </div>
               </div>
             </div>\`;
        return \`
        <div class="goal-card" data-goal-id="\${goal.id}" data-goal-slug="\${escHtml(goal.overlaySlug || '')}">
          <div class="goal-card-header">
            <div class="meta">
              <div>Goal ID: \${goal.id}</div>
              <div>Progress: \${prettyNumber(goal.currentValue || 0)} / \${prettyNumber(goal.targetValue || 0)} (\${progress}%)</div>
            </div>
            <div class="goal-card-actions">
              <button data-action="save">Save goal</button>
              <button class="secondary" data-action="copy">Copy URL</button>
            </div>
            \${isSubGoal ? '<div class="goal-pill">Sub Goal</div>' : ''}
          </div>
          <div class="goal-preview">
            <div class="goal-preview-header">
              <span>Live preview</span>
              <button class="secondary" data-action="refresh-preview">Reload</button>
            </div>
            <div class="goal-preview-canvas" data-goal-preview>
              <div class="goal-preview-note">Edit the goal settings below to see changes.</div>
            </div>
          </div>
          <div class="goal-card-section" data-goal-section="basics">
            <button type="button" class="goal-section-toggle" data-goal-section-toggle="basics">
              <span>Basics</span>
              <span>▾</span>
            </button>
            <div class="goal-section-body">
              <div class="goal-grid">
                <div class="goal-field">
                  <label>Title</label>
                  <input type="text" data-field="title" value="\${escHtml(goal.title || (isSubGoal ? 'Sub Goal' : 'New Goal'))}" placeholder="Weekly Sub Goal" />
                </div>
                <div class="goal-field">
                  <label>Description</label>
                  <textarea rows="2" data-field="description" placeholder="Optional context">\${escHtml(goal.description || '')}</textarea>
                </div>
                <div class="goal-field">
                  <label>Overlay slug</label>
                  <input type="text" data-field="overlaySlug" value="\${escHtml(goal.overlaySlug || '')}" placeholder="Optional short slug" />
                </div>
                <div class="goal-field">
                  <label>Target value</label>
                  <input type="number" min="1" step="1" data-field="targetValue" value="\${Number(goal.targetValue || 0)}" />
                </div>
                \${unitField}
                <div class="goal-field">
                  <label>Start</label>
                  <input type="datetime-local" data-field="startAt" value="\${startVal}" />
                </div>
                <div class="goal-field">
                  <label>End</label>
                  <input type="datetime-local" data-field="endAt" value="\${endVal}" />
                </div>
                <div class="goal-field">
                  <label>Show on overlay</label>
                  <label style="display:flex; align-items:center; gap:6px;"><input type="checkbox" data-field="rules.showOnOverlay" \${boolAttr(showOverlay)} /> Visible</label>
                </div>
                <div class="goal-field">
                  <label>Archived</label>
                  <label style="display:flex; align-items:center; gap:6px;"><input type="checkbox" data-field="archived" \${boolAttr(archived)} /> Hide from dashboard</label>
                </div>
                \${subInfoBlock}
              </div>
              <div class="goal-url">
                <label>Browser Source URL</label>
                <code data-embed="url">\${embed}</code>
              </div>
            </div>
          </div>
          <div class="goal-card-section" data-goal-section="appearance">
            <button type="button" class="goal-section-toggle" data-goal-section-toggle="appearance">
              <span>Appearance</span>
              <span>▾</span>
            </button>
            <div class="goal-section-body">
              <div class="goal-grid">
                <div class="goal-field">
                  <label>Orientation</label>
                  <select data-field="style.orientation">
                    <option value="horizontal" \${style.orientation === 'vertical' ? '' : 'selected'}>Horizontal</option>
                    <option value="vertical" \${style.orientation === 'vertical' ? 'selected' : ''}>Vertical</option>
                  </select>
                </div>
                <div class="goal-field">
                  <label>Align</label>
                  <select data-field="style.align">
                    <option value="left" \${style.align === 'left' ? 'selected' : ''}>Left</option>
                    <option value="center" \${!style.align || style.align === 'center' ? 'selected' : ''}>Center</option>
                    <option value="right" \${style.align === 'right' ? 'selected' : ''}>Right</option>
                  </select>
                </div>
                <div class="goal-field">
                  <label>Width (px)</label>
                  <input type="number" min="200" step="10" data-field="style.width" value="\${Number(style.width || 820)}" />
                </div>
                <div class="goal-field">
                  <label>Height (px)</label>
                  <input type="number" min="160" step="10" data-field="style.height" value="\${Number(style.height || 240)}" />
                </div>
                <div class="goal-field">
                  <label>Track thickness</label>
                  <input type="number" min="10" step="2" data-field="style.trackThickness" value="\${Number(style.trackThickness || 38)}" />
                </div>
                <div class="goal-field">
                  <label>Border radius</label>
                  <input type="number" min="0" step="1" data-field="style.borderRadius" value="\${Number(style.borderRadius || 20)}" />
                </div>
                <div class="goal-field">
                  <label>Font family</label>
                  <input type="text" data-field="style.fontFamily" value="\${escHtml(style.fontFamily || '')}" placeholder="Inter, system-ui" />
                </div>
                <div class="goal-field">
                  <label>Font weight</label>
                  <input type="number" min="100" max="900" step="100" data-field="style.fontWeight" value="\${Number(style.fontWeight || 700)}" />
                </div>
                <div class="goal-field">
                  <label>Overlay padding</label>
                  <input type="number" min="0" step="2" data-field="style.overlayPadding" value="\${Number(style.overlayPadding || 24)}" />
                </div>
                <div class="goal-field">
                  <label>Fill color</label>
                  <input type="color" data-field="style.fillColor" value="\${escHtml(style.fillColor || '#9146FF')}" />
                </div>
                <div class="goal-field">
                  <label>Fill gradient</label>
                  <input type="color" data-field="style.fillSecondaryColor" value="\${escHtml(style.fillSecondaryColor || style.fillColor || '#772CE8')}" />
                </div>
                <div class="goal-field">
                  <label>Empty color</label>
                  <input type="color" data-field="style.emptyColor" value="\${escHtml(style.emptyColor || '#222229')}" />
                </div>
                <div class="goal-field">
                  <label>Background</label>
                  <input type="color" data-field="style.backgroundColor" value="\${escHtml(style.backgroundColor || '#00000000')}" />
                </div>
                <div class="goal-field">
                  <label>Label color</label>
                  <input type="color" data-field="style.labelColor" value="\${escHtml(style.labelColor || '#FFFFFF')}" />
                </div>
                <div class="goal-field">
                  <label>Value color</label>
                  <input type="color" data-field="style.valueColor" value="\${escHtml(style.valueColor || '#FFFFFF')}" />
                </div>
                <div class="goal-field">
                  <label>Percent color</label>
                  <input type="color" data-field="style.percentColor" value="\${escHtml(style.percentColor || '#FFFFFF')}" />
                </div>
                <div class="goal-field">
                  <label>Tier 1 color</label>
                  <input type="color" data-field="style.segmentColors.tier1000" value="\${escHtml(segmentColors.tier1000 || '#9146FF')}" />
                </div>
                <div class="goal-field">
                  <label>Tier 2 color</label>
                  <input type="color" data-field="style.segmentColors.tier2000" value="\${escHtml(segmentColors.tier2000 || '#C08CFF')}" />
                </div>
                <div class="goal-field">
                  <label>Tier 3 color</label>
                  <input type="color" data-field="style.segmentColors.tier3000" value="\${escHtml(segmentColors.tier3000 || '#FFB347')}" />
                </div>
                <div class="goal-field">
                  <label>Bits color</label>
                  <input type="color" data-field="style.segmentColors.bits" value="\${escHtml(segmentColors.bits || '#10B981')}" />
                </div>
                <div class="goal-field">
                  <label>Manual color</label>
                  <input type="color" data-field="style.segmentColors.manual" value="\${escHtml(segmentColors.manual || '#38BDF8')}" />
                </div>
                <div class="goal-field" style="grid-column: 1 / -1;">
                  <label>Custom CSS</label>
                  <textarea rows="2" data-field="style.customCss" placeholder=".goal-card { }">\${escHtml(style.customCss || '')}</textarea>
                </div>
              </div>
              <div class="goal-grid">
                <div class="goal-field"><label><input type="checkbox" data-field="style.showLabel" \${boolAttr(style.showLabel !== false)} /> Show label</label></div>
                <div class="goal-field"><label><input type="checkbox" data-field="style.showValue" \${boolAttr(style.showValue !== false)} /> Show values</label></div>
                <div class="goal-field"><label><input type="checkbox" data-field="style.showPercent" \${boolAttr(style.showPercent !== false)} /> Show percent</label></div>
                <div class="goal-field"><label><input type="checkbox" data-field="style.showRemaining" \${boolAttr(style.showRemaining)} /> Show remaining</label></div>
                <div class="goal-field"><label><input type="checkbox" data-field="style.showTimeframe" \${boolAttr(style.showTimeframe)} /> Show timeframe</label></div>
                <div class="goal-field"><label><input type="checkbox" data-field="style.showSegmentsOnBar" \${boolAttr(style.showSegmentsOnBar !== false)} /> Color breakdown</label></div>
                <div class="goal-field"><label><input type="checkbox" data-field="style.showSegmentLegend" \${boolAttr(style.showSegmentLegend !== false)} /> Show legend</label></div>
                <div class="goal-field"><label><input type="checkbox" data-field="style.animateFill" \${boolAttr(style.animateFill !== false)} /> Animate fill</label></div>
              </div>
            </div>
          </div>
          \${rulesSection}
          \${manualSection}
          <div class="goal-card-actions" style="justify-content: space-between;">
            <div class="goal-card-actions">
              <button class="secondary" data-action="reset">Reset progress</button>
            </div>
            <div class="goal-card-actions">
              <button class="danger" data-action="delete">Delete</button>
            </div>
          </div>
        </div>\`;
      }

      function updateGoalUrls(targetCard) {
        if (!goalListEl) return;
        const cards = targetCard ? [targetCard] : Array.from(goalListEl.querySelectorAll('.goal-card'));
        cards.forEach((card) => {
          const goalId = card.dataset.goalId;
          const goal = goalState.goals.find((g) => g.id === goalId);
          const slugInput = card.querySelector('[data-field="overlaySlug"]');
          const slug = (slugInput && slugInput.value.trim()) || (goal && goal.overlaySlug) || goalId;
          const code = card.querySelector('[data-embed="url"]');
          if (code && goal) code.textContent = goalEmbedUrl(goal, slug);
        });
      }

      function renderGoals(error) {
        if (!goalListEl) return;
        if (error) {
          goalListEl.innerHTML = '<div class="goal-empty">Failed to load goals.</div>';
          return;
        }
        if (!goalState.goals.length) {
          goalListEl.innerHTML = '<div class="goal-empty">No goals yet. Click "New goal" to get started.</div>';
          return;
        }
        goalListEl.innerHTML = goalState.goals.map(goalCardTemplate).join('');
        updateGoalUrls();
        refreshGoalPreviews();
      }

      async function fetchGoalsAdmin() {
        if (!goalListEl) return;
        goalListEl.innerHTML = '<div class="goal-empty">Loading goals…</div>';
        try {
          const res = await fetch('/api/goals', { cache: 'no-store' });
          if (!res.ok) throw new Error('Failed');
          const data = await res.json();
          goalState.goals = Array.isArray(data.goals) ? data.goals : [];
          goalState.defaults = data.defaults || goalState.defaults;
          renderGoals();
        } catch (err) {
          renderGoals(true);
        }
      }

      async function createGoalAdmin(btn) {
        flashButton(btn);
        setBusy(btn, true);
        try {
          await fetch('/api/goals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'New Goal' }) });
          await fetchGoalsAdmin();
        } catch (err) {}
        setBusy(btn, false);
      }

      async function createSubGoalAdmin(btn) {
        flashButton(btn);
        setBusy(btn, true);
        const defaultEnd = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
        const body = {
          title: 'New Sub Goal',
          targetValue: 25,
          goalType: 'sub_goal',
          type: 'sub_goal',
          endAt: defaultEnd,
        };
        try {
          const res = await fetch('/api/goals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (!res.ok) {
            const msg = await res.text();
            alert('Unable to create sub goal. ' + msg);
          } else {
            await fetchGoalsAdmin();
          }
        } catch (err) {}
        setBusy(btn, false);
      }

      function collectGoalPayload(card) {
        const payload = {};
        if (!card) return payload;
        card.querySelectorAll('[data-field]').forEach((el) => {
          const field = el.getAttribute('data-field');
          if (!field) return;
          let value = null;
          if (el.type === 'checkbox') {
            value = el.checked;
          } else if (el.type === 'number') {
            value = el.value === '' ? null : Number(el.value);
          } else if (el.type === 'datetime-local') {
            value = el.value ? new Date(el.value).toISOString() : null;
          } else {
            value = el.value;
          }
          assignPath(payload, field, value);
        });
        return payload;
      }

      async function saveGoalAdmin(goalId, card, btn) {
        flashButton(btn);
        setBusy(btn, true);
        const payload = collectGoalPayload(card);
        try {
          await fetch('/api/goals/' + goalId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          await fetchGoalsAdmin();
        } catch (err) {}
        setBusy(btn, false);
      }

      async function deleteGoalAdmin(goalId, btn) {
        if (!confirm('Delete this goal? This cannot be undone.')) return;
        flashButton(btn);
        setBusy(btn, true);
        try {
          await fetch('/api/goals/' + goalId, { method: 'DELETE' });
          await fetchGoalsAdmin();
        } catch (err) {}
        setBusy(btn, false);
      }

      async function resetGoalAdmin(goalId, btn) {
        if (!confirm('Reset this goal\\'s progress?')) return;
        flashButton(btn);
        setBusy(btn, true);
        try {
          await fetch('/api/goals/' + goalId + '/reset', { method: 'POST' });
          await fetchGoalsAdmin();
        } catch (err) {}
        setBusy(btn, false);
      }

      async function manualGoalApply(goalId, card, btn) {
        const typeEl = card.querySelector('[data-manual-field="type"]');
        const amountEl = card.querySelector('[data-manual-field="amount"]');
        const noteEl = card.querySelector('[data-manual-field="note"]');
        if (!typeEl || !amountEl) return;
        const amount = Number(amountEl.value || 0);
        if (!Number.isFinite(amount) || amount <= 0) return;
        flashButton(btn);
        setBusy(btn, true);
        try {
          await fetch('/api/goals/' + goalId + '/manual', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: typeEl.value, units: amount, note: noteEl ? noteEl.value : '' })
          });
          amountEl.value = '';
          if (noteEl) noteEl.value = '';
          await fetchGoalsAdmin();
        } catch (err) {}
        setBusy(btn, false);
      }

      async function copyGoalUrl(goalId, card, btn) {
        const goal = goalState.goals.find((g) => g.id === goalId);
        if (!goal) return;
        const slugInput = card.querySelector('[data-field="overlaySlug"]');
        const slug = slugInput && slugInput.value.trim();
        const url = goalEmbedUrl(goal, slug || goal.overlaySlug || goalId);
        const prev = btn.textContent;
        flashButton(btn);
        try {
          await navigator.clipboard.writeText(url);
          btn.textContent = 'Copied!';
        } catch (err) {
          btn.textContent = 'Copy failed';
        }
        setTimeout(() => { btn.textContent = prev; }, 1200);
      }

      async function handleGoalCardClick(e) {
        const sectionToggle = e.target.closest('[data-goal-section-toggle]');
        if (sectionToggle) {
          const section = sectionToggle.closest('[data-goal-section]');
          if (section) {
            const id = section.getAttribute('data-goal-section');
            const next = !section.classList.contains('collapsed');
            section.classList.toggle('collapsed', next);
            setGoalSectionState(id, next);
          }
          return;
        }
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const card = btn.closest('.goal-card');
        if (!card) return;
        const goalId = card.dataset.goalId;
        if (!goalId) return;
        const action = btn.getAttribute('data-action');
        if (action === 'save') {
          await saveGoalAdmin(goalId, card, btn);
        } else if (action === 'delete') {
          await deleteGoalAdmin(goalId, btn);
        } else if (action === 'reset') {
          await resetGoalAdmin(goalId, btn);
        } else if (action === 'manual') {
          await manualGoalApply(goalId, card, btn);
        } else if (action === 'copy') {
          await copyGoalUrl(goalId, card, btn);
        } else if (action === 'refresh-preview') {
          renderGoalPreview(card);
        }
      }

      function handleGoalFieldInput(e) {
        const target = e.target;
        if (!target) return;
        const card = target.closest('.goal-card');
        if (!card) return;
        if (target.hasAttribute('data-field')) {
          refreshGoalPreviews(card);
          if (target.matches('[data-field="overlaySlug"]')) updateGoalUrls(card);
        }
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
        if (inputs.key && goalListEl) {
          inputs.key.addEventListener('input', () => { updateGoalUrls(); refreshGoalPreviews(); });
        }
        if (goalCreateBtn) {
          goalCreateBtn.addEventListener('click', async function(e){
            e.preventDefault();
            await createGoalAdmin(goalCreateBtn);
          });
        }
        if (goalCreateSubBtn) {
          goalCreateSubBtn.addEventListener('click', async function(e){
            e.preventDefault();
            await createSubGoalAdmin(goalCreateSubBtn);
          });
        }
        if (goalRefreshBtn) {
          goalRefreshBtn.addEventListener('click', function(e){
            e.preventDefault();
            flashButton(goalRefreshBtn);
            fetchGoalsAdmin();
          });
        }
        if (goalListEl) {
          goalListEl.addEventListener('click', handleGoalCardClick);
          goalListEl.addEventListener('input', handleGoalFieldInput);
          goalListEl.addEventListener('change', handleGoalFieldInput);
        }
        const devPanel = document.getElementById('devTests');
        if (devPanel) {
          // Expose rules for client-side calculation
          window.DEV_RULES = ${
            rulesSnapshot ? JSON.stringify(rulesSnapshot) : "null"
          };
          Array.from(devPanel.querySelectorAll('[data-test-seconds]')).forEach(function(btn){
            btn.addEventListener('click', async function(e){
              e.preventDefault();
              var secs = parseInt(btn.getAttribute('data-test-seconds'), 10) || 0;
              if (secs <= 0) return;
              var meta = { source: 'dev_quick_test', label: btn.textContent.trim(), requestedSeconds: secs };
              flashButton(btn);
              setBusy(btn, true);
              // Apply hype multiplier if active
              try {
                const hype = await getHypeActive();
                if (hype && window.DEV_RULES && window.DEV_RULES.hypeTrain) {
                  const mult = Number(window.DEV_RULES.hypeTrain.multiplier) || 1;
                  meta.hypeMultiplier = mult;
                  secs = Math.floor(secs * mult);
                }
              } catch(e) {}
              await addTime(secs, meta);
              await updateCapStatus();
              setBusy(btn, false);
            });
          });
          // Custom bits
          const bitsBtn = document.getElementById('devApplyBits');
          if (bitsBtn) bitsBtn.addEventListener('click', async function(e){
            e.preventDefault();
            const bits = num(document.getElementById('devBitsInput')?.value, 0);
            if (!window.DEV_RULES || bits <= 0) return;
            let secs = Math.floor(bits / (Number(window.DEV_RULES.bits?.per)||100)) * (Number(window.DEV_RULES.bits?.add_seconds)||0);
            const meta = { source: 'dev_custom_bits', label: 'Custom Bits', bits: bits, requestedSeconds: secs };
            const hype = await getHypeActive();
            if (hype) {
              const mult = Number(window.DEV_RULES.hypeTrain?.multiplier)||1;
              meta.hypeMultiplier = mult;
              secs = Math.floor(secs * mult);
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
            const hype = await getHypeActive();
            const meta = { source: 'dev_custom_subs', label: 'Custom Subs', subCount: count, subTier: tier, requestedSeconds: secs };
            if (hype) {
              const mult = Number(window.DEV_RULES.hypeTrain?.multiplier)||1;
              meta.hypeMultiplier = mult;
              secs = Math.floor(secs * mult);
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
            const hype = await getHypeActive();
            const meta = { source: 'dev_custom_gifts', label: 'Custom Gift Subs', giftCount: count, requestedSeconds: secs };
            if (hype) {
              const mult = Number(window.DEV_RULES.hypeTrain?.multiplier)||1;
              meta.hypeMultiplier = mult;
              secs = Math.floor(secs * mult);
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
              if (typeof s.timeFormat !== 'undefined') document.getElementById('timeFormat').value = (s.timeFormat==='hh:mm:ss' || s.timeFormat==='auto') ? s.timeFormat : 'mm:ss';
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
            hypeTrain: { multiplier: Number(document.getElementById('r_hype').value||2) }
          };
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

        setInterval(fetchLog, 5000);
      }

      initSections();
      bind();
      refresh();
      if (goalListEl) fetchGoalsAdmin();
      saveStyle();
    </script>
  </body>
</html>`;

  return html;
}
