import {
  THEME_CSS_VARS,
  THEME_TOGGLE_STYLES,
  renderThemeBootstrapScript,
} from "./theme.js";
import { GLOBAL_HEADER_STYLES, renderGlobalHeader } from "./globalHeader.js";
import { renderFirebaseScript } from "./firebase.js";
import { renderAnalyticsScript } from "./analyticsScript.js";

export function renderDashboardPage(options = {}) {
  const base = String(options.base || "");
  const adminName = String(options.adminName || "");
  const overlayKey = String(options.overlayKey || "");
  const showUtilitiesLink = Boolean(options.showUtilitiesLink);
  const showAdminLink = Boolean(options.showAdminLink);
  const delegateMode = Boolean(options.delegateMode);
  const managedByName = String(options.managedByName || "");
  const privacyUrl = `${base}/privacy`;
  const gdprUrl = `${base}/gdpr`;
  const termsUrl = `${base}/terms`;

  const keyQs = overlayKey ? `?key=${encodeURIComponent(overlayKey)}` : "";
  const overlays = [
    {
      tag: "Timer",
      title: "Countdown Timer overlay",
      desc: "The live countdown clock — Bits, subs, gift subs, and follows all add time.",
      url: `${base}/overlay${keyQs}`,
      configHref: `${base}/overlay/config`,
      configLabel: "Open Configurator",
    },
    {
      tag: "Alerts",
      title: "Sound & Bit Alerts overlay",
      desc: "On-screen popups and sound playback whenever a viewer uses Bits.",
      url: `${base}/overlay/sounds${keyQs}`,
      configHref: `${base}/sounds/config`,
      configLabel: "Open Configurator",
    },
    {
      tag: "Goals",
      title: "Goal Bar overlay",
      desc: "Milestone progress bars for fundraising and community goals.",
      url: `${base}/overlay/goal${keyQs}`,
      configHref: `${base}/goals/config`,
      configLabel: "Open Configurator",
    },
    {
      tag: "Plinko",
      title: "Plinko overlay",
      desc: "Drop a token down the peg board — the landing slot multiplies the time added to your subathon timer.",
      url: `${base}/overlay/plinko${keyQs}${keyQs ? "&" : "?"}boardId=default`,
      configHref: `${base}/utilities#plinko`,
      configLabel: "Open Configurator",
    },
    // Chat Prompt overlay — temporarily hidden from the dashboard (not removed).
    // To restore, un-comment this entry.
    // {
    //   tag: "Prompts",
    //   title: "Chat Prompt overlay",
    //   desc: "Shows a conversation starter on screen whenever you push one from Utilities.",
    //   url: `${base}/overlay/prompt${keyQs}`,
    //   configHref: `${base}/utilities#prompts`,
    //   configLabel: "Manage Prompts",
    // },
  ];

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Dashboard – Livestreamer Hub</title>
    <link rel="icon" type="image/png" href="/assets/convertico-coin_24x24.png">
    <script id="Cookiebot" src="https://consent.cookiebot.com/uc.js" data-cbid="6770198d-2c1f-46f8-af4b-694edc70484c" type="text/javascript"></script>
    ${renderThemeBootstrapScript()}
    ${renderFirebaseScript()}
    ${renderAnalyticsScript({ page: "dashboard-home" })}
    <style>
      ${THEME_CSS_VARS}
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--page-bg); color: var(--text-color); min-height: 100vh; display:flex; flex-direction:column; }
      main { flex: 1; width: min(1000px, 100%); margin: 0 auto; padding: 40px 24px 64px; }
      h1 { margin: 0 0 8px; font-size: 30px; }
      p.lead { margin: 0 0 32px; color: var(--text-muted); max-width: 640px; line-height: 1.6; }
      .overlay-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 40px; }
      .overlay-card { background: var(--surface-color); border: 1px solid var(--surface-border); border-radius: 16px; padding: 20px; box-shadow: 0 20px 40px rgba(15,23,42,0.12); display:flex; flex-direction: column; gap: 10px; }
      .overlay-card .tag-pill { display: inline-block; align-self: flex-start; padding: 3px 10px; border-radius: 999px; background: rgba(145, 70, 255, 0.12); color: var(--accent-color); font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
      .overlay-card h2 { margin: 0; font-size: 17px; }
      .overlay-card p { margin: 0; color: var(--text-muted); font-size: 13.5px; line-height: 1.5; }
      .overlay-card-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 4px; }
      .overlay-card-actions button, .overlay-card-actions a.btn-link { font-size: 13px; padding: 7px 12px; border-radius: 8px; cursor: pointer; text-decoration: none; font-weight: 600; }
      .overlay-card-actions button { background: var(--accent-color); color: #fff; border: 0; }
      .overlay-card-actions a.btn-link { background: var(--secondary-button-bg); color: var(--secondary-button-text); border: 1px solid var(--secondary-button-border); display: inline-flex; align-items: center; }
      .overlay-card-status { font-size: 12px; color: var(--text-muted); min-height: 16px; }
      .wheels-note { display:flex; flex-direction: column; gap: 10px; }
      .steps-section { margin-top: 8px; }
      .steps-section h2 { font-size: 20px; font-weight: 700; margin: 0 0 16px; }
      .steps-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
      .step-card { background: var(--surface-color); border: 1px solid var(--surface-border); border-radius: 14px; padding: 20px; box-shadow: 0 4px 20px var(--goal-card-shadow); }
      .step-number { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #9146FF, #772CE8); color: #fff; font-weight: 800; font-size: 14px; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }
      .step-card h3 { margin: 0 0 6px; font-size: 15px; font-weight: 700; }
      .step-card p { margin: 0; font-size: 13.5px; color: var(--text-muted); line-height: 1.5; }
      .global-footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid var(--surface-border); display:flex; flex-wrap: wrap; gap: 16px; justify-content: center; font-size: 14px; color: var(--text-muted); }
      .global-footer a { color: var(--text-muted); text-decoration: none; }
      .global-footer a:hover { color: var(--accent-color); }
      @media (max-width: 700px) {
        .steps-grid { grid-template-columns: 1fr; }
      }
      ${THEME_TOGGLE_STYLES}
      ${GLOBAL_HEADER_STYLES}
    </style>
  </head>
  <body>
    ${renderGlobalHeader({ base, adminName, active: "dashboard", includeThemeToggle: true, showUtilitiesLink, showAdminLink, showLogout: true })}
    <main>
      ${delegateMode ? `
      <div style="background:#f59e0b22; border:2px solid #f59e0b; border-radius:10px; padding:12px 18px; margin-bottom:16px; display:flex; align-items:center; gap:12px; font-size:13px; font-weight:500;">
        <span style="font-size:20px; flex-shrink:0;">⚠️</span>
        <div style="flex:1;">You are managing <strong>${managedByName}</strong>'s settings — everything here and on the config pages affects <strong>their</strong> channel, not yours.</div>
        <button type="button" id="stopManagingBtn" style="flex-shrink:0; padding:5px 14px; border-radius:7px; border:1px solid #f59e0b; color:#f59e0b; background:transparent; font-size:12px; font-weight:700; cursor:pointer;">Stop managing</button>
      </div>` : ''}
      <h1>Dashboard</h1>
      <p class="lead">Every Browser Source link for your stream, in one place — copy what you need instead of hunting across separate config pages.</p>

      <div class="overlay-grid">
        ${overlays
          .map(
            (o, i) => `<div class="overlay-card">
          <span class="tag-pill">${o.tag}</span>
          <h2>${o.title}</h2>
          <p>${o.desc}</p>
          <div class="overlay-card-actions">
            <button type="button" class="copy-overlay-link-btn" data-url="${o.url}" data-status="overlayStatus${i}">Copy Browser Source link</button>
            <a class="btn-link" href="${o.configHref}">${o.configLabel}</a>
          </div>
          <div class="overlay-card-status" id="overlayStatus${i}"></div>
        </div>`,
          )
          .join("")}
        <div class="overlay-card wheels-note">
          <span class="tag-pill">Wheels</span>
          <h2>Wheel Spinner overlays</h2>
          <p>Wheels are saved per-browser and each has its own link, so they live in Utilities rather than here.</p>
          <div class="overlay-card-actions">
            <a class="btn-link" href="${base}/utilities">Manage Wheels</a>
          </div>
        </div>
      </div>

      <section class="steps-section">
        <h2>Adding a link to OBS</h2>
        <div class="steps-grid">
          <div class="step-card">
            <div class="step-number">1</div>
            <h3>Copy a link above</h3>
            <p>Each card has a Browser Source URL that already includes your overlay key.</p>
          </div>
          <div class="step-card">
            <div class="step-number">2</div>
            <h3>Add a Browser Source</h3>
            <p>In OBS, add a new Browser Source and paste the link into the URL field.</p>
          </div>
          <div class="step-card">
            <div class="step-number">3</div>
            <h3>Resize and position it</h3>
            <p>Drag and resize the source in your scene like any other. Refresh after style changes.</p>
          </div>
        </div>
      </section>

      <footer class="global-footer">
        <a href="${termsUrl}">Terms of Service</a>
        <a href="${privacyUrl}">Privacy Policy</a>
        <a href="${gdprUrl}">GDPR / UK GDPR Disclosure</a>
      </footer>
    </main>
    <script>
      (function(){
        document.querySelectorAll('.copy-overlay-link-btn').forEach(function(btn) {
          btn.addEventListener('click', function() {
            var url = btn.getAttribute('data-url');
            var statusEl = document.getElementById(btn.getAttribute('data-status'));
            navigator.clipboard.writeText(url).then(function() {
              if (statusEl) statusEl.textContent = 'Copied!';
            }).catch(function() {
              if (statusEl) statusEl.textContent = 'Copy failed';
            });
            setTimeout(function() { if (statusEl) statusEl.textContent = ''; }, 2500);
          });
        });

        var stopBtn = document.getElementById('stopManagingBtn');
        if (stopBtn) {
          stopBtn.addEventListener('click', function() {
            stopBtn.disabled = true;
            fetch('/api/delegate/stop', { method: 'POST', credentials: 'same-origin' })
              .then(function() { window.location.href = '/admin'; })
              .catch(function() { window.location.href = '/admin'; });
          });
        }
      })();
    </script>
  </body>
</html>`;
}
