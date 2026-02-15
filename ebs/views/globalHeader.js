import { renderThemeToggle } from "./theme.js";

export const GLOBAL_HEADER_STYLES = `
      .global-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: var(--header-bg);
        border-bottom: 1px solid var(--header-border);
        flex-wrap: wrap;
        gap: 12px;
      }
      .global-header .header-brand {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .global-header .brand-link {
        font-weight: 600;
        font-size: 18px;
        color: var(--text-color);
        text-decoration: none;
      }
      .global-header .brand-link:hover {
        color: var(--accent-color);
      }
      .global-header .nav-links {
        display: inline-flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .global-header .nav-link {
        padding: 6px 10px;
        border-radius: 999px;
        color: var(--text-muted);
        text-decoration: none;
        font-weight: 500;
      }
      .global-header .nav-link:hover {
        color: var(--accent-color);
      }
      .global-header .nav-link.active {
        background: var(--surface-muted);
        color: var(--text-color);
      }
      .global-header .header-actions {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        justify-content: flex-end;
        color: var(--text-muted);
      }
      .global-header .header-actions .user-label {
        font-size: 13px;
      }
      .global-header .header-actions .theme-toggle {
        margin: 0;
      }
`;

export function renderGlobalHeader(options = {}) {
  const {
    base = "",
    adminName = "",
    active = "home",
    includeThemeToggle = true,
    showFeedback = false,
    showLogout = false,
    showUtilitiesLink = false,
    feedbackUrl = "https://docs.google.com/forms/d/e/1FAIpQLSdanikaYMRTjwm9TS5HQ4zMMc8tiDRbz9dqyrJ00Zl518hxbw/viewform?usp=dialog",
  } = options;

  const homeHref = `${base}/`;
  const configHref = `${base}/overlay/config`;
  const soundsHref = `${base}/sounds/config`;
  const utilitiesHref = `${base}/utilities`;

  const navLinks = [
    { href: homeHref, label: "Home", key: "home" },
    { href: configHref, label: "Configurator", key: "config" },
    { href: soundsHref, label: "Sound Alerts", key: "sounds" },
    ...(showUtilitiesLink
      ? [{ href: utilitiesHref, label: "Utilities (WIP)", key: "utilities" }]
      : []),
  ]
    .map(
      (link) =>
        `<a class="nav-link${active === link.key ? " active" : ""}" href="${
          link.href
        }">${link.label}</a>`,
    )
    .join("");

  const actions = [];
  if (includeThemeToggle) actions.push(renderThemeToggle({ label: "" }));
  if (adminName)
    actions.push(`<span class="user-label">Logged in as ${adminName}</span>`);
  if (showFeedback)
    actions.push(
      `<a href="${feedbackUrl}" target="_blank" rel="noopener noreferrer"><button class="secondary">Feedback</button></a>`,
    );
  if (showLogout) actions.push(`<button id="logout">Logout</button>`);

  return `
    <header class="global-header">
      <div class="header-brand">
        <a class="brand-link" href="${homeHref}">Livestreamer Hub</a>
        <nav class="nav-links">${navLinks}</nav>
      </div>
      <div class="header-actions">
        ${actions.join("\n")}
      </div>
    </header>
  `;
}
