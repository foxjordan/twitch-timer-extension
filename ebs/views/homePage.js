import {
  THEME_CSS_VARS,
  THEME_TOGGLE_STYLES,
  renderThemeBootstrapScript,
} from "./theme.js";
import {
  GLOBAL_HEADER_STYLES,
  renderGlobalHeader,
} from "./globalHeader.js";

export function renderHomePage(options = {}) {
  const base = String(options.base || "");
  const loginUrl = `${base}/auth/login?next=${encodeURIComponent(
    "/overlay/config"
  )}`;
  const configUrl = `${base}/overlay/config`;
  const overlayUrl = String(options.overlayUrl || `${base}/overlay`);
  const isAdmin = Boolean(options.isAdmin);
  const adminName = options.adminName
    ? String(options.adminName)
    : "your Twitch account";
  const privacyUrl = `${base}/privacy`;
  const gdprUrl = `${base}/gdpr`;
  const showUtilitiesLink = Boolean(options.showUtilitiesLink);
  const headerAdminName = isAdmin ? adminName : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Twitch Timer Extension</title>
    <script id="Cookiebot" src="https://consent.cookiebot.com/uc.js" data-cbid="6770198d-2c1f-46f8-af4b-694edc70484c" type="text/javascript"></script>
    ${renderThemeBootstrapScript()}
    <style>
      ${THEME_CSS_VARS}
      body { margin: 0; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--home-bg); color: var(--text-color); display:flex; flex-direction:column; min-height:100vh; }
      main { width: 100%; max-width: 960px; margin: auto; padding: 40px 24px 56px; }
      h1 { margin-top: 0; font-size: 36px; }
      p { line-height: 1.6; color: var(--text-color); }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 18px; margin-top: 28px; }
      .card { background: var(--surface-color); border: 1px solid var(--surface-border); border-radius: 14px; padding: 18px; box-shadow: 0 4px 20px var(--goal-card-shadow); }
      .card h2 { margin-top: 0; font-size: 20px; color: var(--text-color); }
      .cta { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 16px; border-radius: 999px; border: 0; font-weight: 600; font-size: 15px; cursor: pointer; text-decoration: none; transition: transform .1s ease, box-shadow .2s ease, opacity .15s ease; }
      .cta.primary { background: linear-gradient(135deg, #9146FF, #772CE8); color: #fff; box-shadow: 0 6px 18px rgba(145,70,255,0.35); }
      .cta.secondary { background: var(--secondary-button-bg); color: var(--secondary-button-text); border: 1px solid var(--secondary-button-border); }
      .cta:hover { transform: translateY(-1px); box-shadow: 0 10px 24px rgba(0,0,0,0.2); }
      .cta:active { transform: translateY(0); }
      code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; display: block; padding: 10px 12px; border-radius: 8px; background: var(--code-bg); border: 1px solid var(--code-border); margin: 10px 0; word-break: break-all; font-size: 14px; color: var(--text-color); }
      ul { padding-left: 20px; margin-top: 8px; color: var(--text-muted); }
      .status { margin-top: 22px; padding: 16px; border-radius: 12px; background: var(--surface-muted); border: 1px solid var(--surface-border); color: var(--text-color); }
      .status strong { color: var(--accent-color); }
      .global-footer { margin-top: 40px; display: flex; flex-wrap: wrap; gap: 16px; font-size: 14px; color: var(--text-muted); }
      .global-footer a { color: var(--text-muted); text-decoration: none; font-weight: 500; }
      .global-footer a:hover { color: var(--accent-color); }
      @media (max-width: 600px) {
        main { padding: 32px 18px; }
        h1 { font-size: 30px; }
      }
      ${THEME_TOGGLE_STYLES}
      ${GLOBAL_HEADER_STYLES}
    </style>
  </head>
  <body>
    ${renderGlobalHeader({ base, adminName: headerAdminName, active: "home", includeThemeToggle: true, showUtilitiesLink })}
    <main>
      <h1>Hyper Timer Overlay</h1>
      <p>This service powers your Twitch charity/subathon style timer. Sign in with Twitch to configure the overlay, tune the rules, and monitor inbound events.</p>

      <div class="grid">
        <section class="card">
          <h2>1. Configure &amp; control</h2>
          <p>Admins can manage timer rules, pause/resume, and preview styles in the configurator.</p>
          <a class="cta primary" href="${loginUrl}">Sign in with Twitch</a>
          <a class="cta secondary" style="margin-left:8px;margin-top:12px" href="${configUrl}">Open configurator</a>
          <ul>
            <li>Requires signing in as the channel admin</li>
            <li>Customize fonts, colors, add effects, and thresholds</li>
            <li>See event log and manual timer controls</li>
          </ul>
        </section>
        <section class="card">
          <h2>2. Add overlay to OBS</h2>
          <p>Point a Browser Source at the overlay URL. Include your overlay key if one is required.</p>
          <code>${overlayUrl}</code>
          <p style="margin-top:12px; font-size:14px; opacity:0.85">
            Goal trackers live at <code>${base}/overlay/goal?goal=GOAL_ID</code>. Create and copy goal-specific URLs inside the configurator to include your overlay key.
          </p>
          <ul>
            <li>Recommended size: 1920×1080 or match your canvas</li>
            <li>Enable <em>Shutdown source when not visible</em> to save bandwidth</li>
            <li>Refresh the source after changing styles</li>
          </ul>
        </section>
      </div>

      <section class="card" style="margin-top:26px">
        <h2>Need help?</h2>
        <p>After signing in you can rotate overlay keys, edit contribution rules, and reset timers from the configurator. If you're seeing "Cannot GET /overlay", double-check that your overlay key matches the one generated in the configurator.</p>
      </section>

      <div class="status">
        ${
          isAdmin
            ? `<strong>Signed in:</strong> ${adminName}. Your overlay link above already includes your saved key.`
            : `Not signed in. Use the Sign in button above to manage settings for ${adminName}.`
        }
      </div>

      <footer class="global-footer">
        
        <a href="${privacyUrl}">Privacy Policy</a>
        <a href="${gdprUrl}">GDPR / UK GDPR Disclosure</a>
      </footer>
    </main>
  </body>
</html>`;
}
