import { renderThemeToggle } from "./theme.js";

export const GLOBAL_HEADER_STYLES = `
      .global-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 24px;
        background: var(--header-bg);
        border-bottom: 1px solid var(--header-border);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        flex-wrap: wrap;
        gap: 12px;
      }
      .global-header .header-brand {
        display: flex;
        align-items: center;
        gap: 20px;
      }
      .global-header .brand-link {
        font-weight: 800;
        font-size: 17px;
        letter-spacing: -0.01em;
        color: var(--text-color);
        text-decoration: none;
        transition: color .15s ease;
      }
      .global-header .brand-link:hover {
        color: var(--accent-color);
      }
      .global-header .nav-links {
        display: inline-flex;
        gap: 4px;
        flex-wrap: wrap;
      }
      .global-header .nav-link {
        padding: 6px 12px;
        border-radius: 999px;
        color: var(--text-muted);
        text-decoration: none;
        font-weight: 500;
        font-size: 14px;
        transition: color .15s ease, background .15s ease;
      }
      .global-header .nav-link:hover {
        color: var(--text-color);
        background: var(--surface-muted);
      }
      .global-header .nav-link.active {
        background: rgba(145, 70, 255, 0.12);
        color: var(--accent-color);
        font-weight: 600;
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
        font-weight: 500;
      }
      .global-header .header-actions .theme-toggle {
        margin: 0;
      }
      .global-header .header-actions button {
        padding: 6px 14px;
        border-radius: 999px;
        border: 1px solid var(--surface-border);
        background: var(--secondary-button-bg);
        color: var(--secondary-button-text);
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: background .15s ease, border-color .15s ease;
      }
      .global-header .header-actions button:hover {
        border-color: var(--accent-color);
        color: var(--accent-color);
      }
      .global-header .header-actions button.secondary {
        background: transparent;
        border: 1px solid var(--surface-border);
      }
      @media (max-width: 600px) {
        .global-header { padding: 12px 16px; }
        .global-header .header-brand { gap: 12px; }
        .global-header .brand-link { font-size: 15px; }
        .global-header .nav-link { padding: 5px 8px; font-size: 13px; }
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
    showAdminLink = false,
    feedbackUrl = "https://docs.google.com/forms/d/e/1FAIpQLSdanikaYMRTjwm9TS5HQ4zMMc8tiDRbz9dqyrJ00Zl518hxbw/viewform?usp=dialog",
  } = options;

  const homeHref = `${base}/`;
  const configHref = `${base}/overlay/config`;
  const soundsHref = `${base}/sounds/config`;
  const utilitiesHref = `${base}/utilities`;
  const adminHref = `${base}/admin`;

  const navLinks = [
    { href: homeHref, label: "Home", key: "home" },
    { href: configHref, label: "Configurator", key: "config" },
    { href: soundsHref, label: "Sound Alerts", key: "sounds" },
    ...(showUtilitiesLink
      ? [{ href: utilitiesHref, label: "Utilities (WIP)", key: "utilities" }]
      : []),
    ...(showAdminLink
      ? [{ href: adminHref, label: "Admin", key: "admin" }]
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
