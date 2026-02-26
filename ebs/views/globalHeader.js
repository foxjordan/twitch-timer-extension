import { renderThemeToggle } from "./theme.js";

export const GLOBAL_HEADER_STYLES = `
      .global-header {
        position: sticky;
        top: 0;
        z-index: 100;
        display: flex;
        align-items: center;
        padding: 14px 24px;
        background: var(--header-bg);
        border-bottom: 1px solid var(--header-border);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        gap: 12px;
      }
      .global-header .header-top {
        display: flex;
        align-items: center;
        gap: 20px;
        flex-shrink: 0;
      }
      .global-header .header-collapse {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex: 1;
        min-width: 0;
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
      .global-header .header-actions button:not([data-theme-select]) {
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
      .global-header .header-actions button:not([data-theme-select]):hover {
        border-color: var(--accent-color);
        color: var(--accent-color);
      }
      .global-header .header-actions button.secondary {
        background: transparent;
        border: 1px solid var(--surface-border);
      }

      /* Hamburger button – hidden on desktop */
      .global-header .menu-toggle {
        display: none;
        background: none;
        border: 1px solid var(--surface-border);
        border-radius: 8px;
        padding: 6px 8px;
        cursor: pointer;
        color: var(--text-color);
        line-height: 0;
      }
      .global-header .menu-toggle svg { display: block; }

      @media (max-width: 768px) {
        .global-header {
          flex-wrap: wrap;
          padding: 12px 16px;
        }
        .global-header .header-top {
          width: 100%;
          justify-content: space-between;
        }
        .global-header .brand-link { font-size: 15px; }

        .global-header .menu-toggle { display: inline-flex; }

        .global-header .header-collapse {
          display: none;
          flex-direction: column;
          gap: 14px;
          width: 100%;
          padding-top: 12px;
          border-top: 1px solid var(--header-border);
        }
        .global-header.menu-open .header-collapse {
          display: flex;
        }

        .global-header .nav-links {
          flex-direction: column;
          gap: 2px;
        }
        .global-header .nav-link {
          padding: 10px 14px;
          font-size: 15px;
          border-radius: 10px;
        }

        .global-header .header-actions {
          flex-direction: column;
          align-items: stretch;
          gap: 10px;
        }
        .global-header .header-actions .user-label {
          text-align: center;
        }
        .global-header .header-actions button {
          width: 100%;
          padding: 10px 14px;
          font-size: 14px;
        }
        .global-header .header-actions .theme-toggle {
          justify-content: center;
        }
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
    { href: `${base}/goals/config`, label: "Goals", key: "goals" },
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
    <header class="global-header" id="globalHeader">
      <div class="header-top">
        <a class="brand-link" href="${homeHref}">Livestreamer Hub</a>
        <button class="menu-toggle" id="menuToggle" aria-label="Toggle menu" aria-expanded="false">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
        </button>
      </div>
      <div class="header-collapse">
        <nav class="nav-links">${navLinks}</nav>
        <div class="header-actions">
          ${actions.join("\n")}
        </div>
      </div>
    </header>
    <script>
      (function(){
        var hdr = document.getElementById('globalHeader');
        var btn = document.getElementById('menuToggle');
        if (!btn) return;
        btn.addEventListener('click', function(){
          var open = hdr.classList.toggle('menu-open');
          btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
      })();
    </script>
  `;
}
