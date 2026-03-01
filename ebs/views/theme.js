const themeBootstrapSource = `(function () {
  const storageKey = "ebs_theme_pref_v1";
  const root = document.documentElement;
  const mediaQuery = window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;
  const listeners = new Set();
  let storedPref = null;

  function readStoredPreference() {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved === "light" || saved === "dark") return saved;
    } catch (e) {}
    return null;
  }

  function systemTheme() {
    return mediaQuery && mediaQuery.matches ? "dark" : "light";
  }

  function emitChange() {
    const detail = {
      pref: storedPref,
      theme: root.dataset.theme === "dark" ? "dark" : "light",
    };
    listeners.forEach((fn) => {
      try {
        fn(detail);
      } catch (e) {}
    });
  }

  function applyTheme(theme) {
    const next = theme === "dark" ? "dark" : "light";
    root.dataset.theme = next;
    root.classList.toggle("theme-dark", next === "dark");
    root.classList.toggle("theme-light", next === "light");
  }

  function persist(pref) {
    try {
      if (pref) {
        window.localStorage.setItem(storageKey, pref);
      } else {
        window.localStorage.removeItem(storageKey);
      }
    } catch (e) {}
  }

  function setTheme(pref, options) {
    const opts = options || {};
    if (pref === "light" || pref === "dark") {
      storedPref = pref;
    } else {
      storedPref = null;
    }
    const effective = storedPref || systemTheme();
    applyTheme(effective);
    if (!opts.skipSave) {
      persist(storedPref);
    }
    emitChange();
    return effective;
  }

  storedPref = readStoredPreference();
  setTheme(storedPref, { skipSave: true });

  function handleSystemChange() {
    if (!storedPref) {
      setTheme(null, { skipSave: true });
    }
  }

  if (mediaQuery) {
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleSystemChange);
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(handleSystemChange);
    }
  }

  function setupToggle(group) {
    if (!group || group.__ebsThemeToggleInit) return;
    group.__ebsThemeToggleInit = true;
    const buttons = group.querySelectorAll("[data-theme-select]");

    function syncState() {
      buttons.forEach((btn) => {
        const value = btn.getAttribute("data-theme-select");
        const isAuto = value === "auto";
        const active = isAuto ? !storedPref : storedPref === value;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-pressed", active ? "true" : "false");
      });
    }

    buttons.forEach((btn) => {
      btn.type = "button";
      btn.addEventListener("click", () => {
        const value = btn.getAttribute("data-theme-select");
        if (value === "light" || value === "dark") {
          setTheme(value);
        } else {
          setTheme(null);
        }
      });
    });

    syncState();
    listeners.add(syncState);
  }

  function scanToggles(rootNode) {
    (rootNode || document)
      .querySelectorAll("[data-theme-toggle]")
      .forEach(setupToggle);
  }

  const ready = () => scanToggles(document);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ready, { once: true });
  } else {
    ready();
  }

  window.__ebsTheme = {
    setTheme(value) {
      setTheme(value);
    },
    clearPreference() {
      setTheme(null);
    },
    getPreference() {
      return storedPref;
    },
    getTheme() {
      return root.dataset.theme === "dark" ? "dark" : "light";
    },
    onChange(fn) {
      if (typeof fn !== "function") return () => {};
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    resync(rootNode) {
      scanToggles(rootNode || document);
    },
  };
})();`;

export const THEME_CSS_VARS = `
      :root {
        color-scheme: light;
        --page-bg: #f5f5f7;
        --home-bg: #f5f5f7;
        --text-color: #111827;
        --text-muted: rgba(17, 24, 39, 0.7);
        --header-bg: #ffffff;
        --header-border: #e5e7eb;
        --surface-color: #ffffff;
        --surface-border: #e5e7eb;
        --surface-muted: #f3f4f6;
        --input-bg: #ffffff;
        --input-border: #d1d5db;
        --code-bg: #f3f4f6;
        --code-border: #e5e7eb;
        --log-bg: #ffffff;
        --log-border: #e5e7eb;
        --section-bg: #ffffff;
        --section-border: #e5e7eb;
        --secondary-button-bg: #f3f4f6;
        --secondary-button-border: #d1d5db;
        --secondary-button-text: #1f2937;
        --goal-card-bg: #ffffff;
        --goal-card-border: #e5e7eb;
        --goal-card-shadow: rgba(15, 23, 42, 0.08);
        --goal-preview-bg: #f9fafb;
        --goal-preview-border: rgba(15, 23, 42, 0.08);
        --pill-bg: rgba(17, 24, 39, 0.05);
        --pill-border: rgba(17, 24, 39, 0.12);
        --empty-border: rgba(15, 23, 42, 0.2);
        --accent-color: #9146ff;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          color-scheme: dark;
          --page-bg: #0e0e10;
          --home-bg: radial-gradient(circle at top, #1f1f23, #0e0e10);
          --text-color: #efeff1;
          --text-muted: rgba(239, 239, 241, 0.8);
          --header-bg: #1b1b1f;
          --header-border: #303038;
          --surface-color: #1f1f23;
          --surface-border: #303038;
          --surface-muted: #151517;
          --input-bg: #151517;
          --input-border: #3a3a3d;
          --code-bg: #151517;
          --code-border: #3a3a3d;
          --log-bg: #151517;
          --log-border: #3a3a3d;
          --section-bg: #151517;
          --section-border: #303038;
          --secondary-button-bg: #2c2c31;
          --secondary-button-border: #3a3a3d;
          --secondary-button-text: #efeff1;
          --goal-card-bg: #17171b;
          --goal-card-border: #2d2d30;
          --goal-card-shadow: rgba(0, 0, 0, 0.35);
          --goal-preview-bg: #111114;
          --goal-preview-border: rgba(255, 255, 255, 0.08);
          --pill-bg: rgba(255, 255, 255, 0.08);
          --pill-border: rgba(255, 255, 255, 0.12);
          --empty-border: rgba(255, 255, 255, 0.15);
        }
      }
      :root[data-theme="light"] {
        color-scheme: light;
        --page-bg: #f5f5f7;
        --home-bg: #f5f5f7;
        --text-color: #111827;
        --text-muted: rgba(17, 24, 39, 0.7);
        --header-bg: #ffffff;
        --header-border: #e5e7eb;
        --surface-color: #ffffff;
        --surface-border: #e5e7eb;
        --surface-muted: #f3f4f6;
        --input-bg: #ffffff;
        --input-border: #d1d5db;
        --code-bg: #f3f4f6;
        --code-border: #e5e7eb;
        --log-bg: #ffffff;
        --log-border: #e5e7eb;
        --section-bg: #ffffff;
        --section-border: #e5e7eb;
        --secondary-button-bg: #f3f4f6;
        --secondary-button-border: #d1d5db;
        --secondary-button-text: #1f2937;
        --goal-card-bg: #ffffff;
        --goal-card-border: #e5e7eb;
        --goal-card-shadow: rgba(15, 23, 42, 0.08);
        --goal-preview-bg: #f9fafb;
        --goal-preview-border: rgba(15, 23, 42, 0.08);
        --pill-bg: rgba(17, 24, 39, 0.05);
        --pill-border: rgba(17, 24, 39, 0.12);
        --empty-border: rgba(15, 23, 42, 0.2);
      }
      :root[data-theme="dark"] {
        color-scheme: dark;
        --page-bg: #0e0e10;
        --home-bg: radial-gradient(circle at top, #1f1f23, #0e0e10);
        --text-color: #efeff1;
        --text-muted: rgba(239, 239, 241, 0.8);
        --header-bg: #1b1b1f;
        --header-border: #303038;
        --surface-color: #1f1f23;
        --surface-border: #303038;
        --surface-muted: #151517;
        --input-bg: #151517;
        --input-border: #3a3a3d;
        --code-bg: #151517;
        --code-border: #3a3a3d;
        --log-bg: #151517;
        --log-border: #3a3a3d;
        --section-bg: #151517;
        --section-border: #303038;
        --secondary-button-bg: #2c2c31;
        --secondary-button-border: #3a3a3d;
        --secondary-button-text: #efeff1;
        --goal-card-bg: #17171b;
        --goal-card-border: #2d2d30;
        --goal-card-shadow: rgba(0, 0, 0, 0.35);
        --goal-preview-bg: #111114;
        --goal-preview-border: rgba(255, 255, 255, 0.08);
        --pill-bg: rgba(255, 255, 255, 0.08);
        --pill-border: rgba(255, 255, 255, 0.12);
        --empty-border: rgba(255, 255, 255, 0.15);
      }
`;

export const THEME_TOGGLE_STYLES = `
      .theme-toggle {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        padding: 3px;
        border-radius: 999px;
        border: 1px solid var(--surface-border);
        background: var(--surface-muted);
      }
      .theme-toggle .theme-toggle-label {
        display: none;
      }
      .theme-toggle-buttons {
        display: inline-flex;
        align-items: center;
        gap: 2px;
      }
      .theme-toggle button {
        border: 0;
        background: transparent;
        padding: 5px;
        border-radius: 50%;
        cursor: pointer;
        color: var(--text-muted);
        line-height: 0;
        transition: background .15s ease, color .15s ease, box-shadow .15s ease;
      }
      .theme-toggle button:hover:not(.active) {
        color: var(--text-color);
        background: rgba(145, 70, 255, 0.08);
      }
      .theme-toggle button.active {
        background: var(--accent-color);
        color: #ffffff;
        box-shadow: 0 1px 4px rgba(145, 70, 255, 0.4);
      }
      .theme-toggle button svg {
        width: 14px;
        height: 14px;
        display: block;
      }
`;

export function renderThemeBootstrapScript() {
  return `<script>${themeBootstrapSource}</script>`;
}

export function renderThemeToggle(options = {}) {
  const { label = "Theme", className = "" } = options;
  const extraClass = className ? ` ${className}` : "";
  const labelHtml = label
    ? `<span class="theme-toggle-label">${label}</span>`
    : "";
  return `
    <div class="theme-toggle${extraClass}" data-theme-toggle>
      ${labelHtml}
      <div class="theme-toggle-buttons">
        <button type="button" data-theme-select="auto" aria-pressed="false" aria-label="System theme"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></button>
        <button type="button" data-theme-select="light" aria-pressed="false" aria-label="Light theme"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg></button>
        <button type="button" data-theme-select="dark" aria-pressed="false" aria-label="Dark theme"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg></button>
      </div>
    </div>
  `;
}
