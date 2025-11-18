import {
  THEME_CSS_VARS,
  THEME_TOGGLE_STYLES,
  renderThemeBootstrapScript,
  renderThemeToggle,
} from "./theme.js";

export function renderLoggedOutPage(options = {}) {
  const base = String(options.base || "");
  const next = options.next || "/overlay/config";
  const encodedNext = encodeURIComponent(String(next));

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Logged out</title>
    ${renderThemeBootstrapScript()}
    <style>
      ${THEME_CSS_VARS}
      body { margin: 0; font-family: Inter, system-ui, Arial, sans-serif; background: var(--page-bg); color: var(--text-color); display: flex; align-items: center; justify-content: center; min-height: 100vh; position: relative; padding: 24px; }
      .box { background: var(--surface-color); border: 1px solid var(--surface-border); border-radius: 12px; padding: 24px; max-width: 520px; width: min(520px, 100%); box-shadow: 0 20px 50px var(--goal-card-shadow); }
      .box h2 { margin: 0 0 8px; }
      .box p { margin: 0 0 16px; color: var(--text-muted); }
      .box small { color: var(--text-muted); display: block; margin-top: 10px; }
      button { background: var(--accent-color); color: #ffffff; border: 0; padding: 10px 14px; border-radius: 8px; cursor: pointer; font-size: 15px; }
      .theme-toggle-wrapper { position: absolute; top: 16px; right: 16px; }
      ${THEME_TOGGLE_STYLES}
    </style>
  </head>
  <body>
    <div class="theme-toggle-wrapper">
      ${renderThemeToggle({ label: "" })}
    </div>
    <div class="box">
      <h2>You are logged out</h2>
      <p>To sign in again, click the button below.</p>
      <a href="${base}/auth/login?next=${encodedNext}"><button>Sign in with Twitch</button></a>
      <small>Note: you may still be signed into Twitch in this browser, which can auto-complete sign-in.</small>
    </div>
  </body>
</html>`;
}
