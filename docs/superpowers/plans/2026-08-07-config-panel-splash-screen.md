# Config Panel Splash Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two plain-text loading states in the Twitch extension config panel with one consistent, animated, on-brand splash screen.

**Architecture:** A single `SplashScreen({ t, text })` function component added to `extension/src/ConfigApp.jsx`, rendering an animated 5-bar equalizer pulse, the product wordmark, and state-specific status text — replacing both existing early-return loading blocks. No backend or data-flow changes.

**Tech Stack:** React (existing), inline styles + a `<style>` block for `@keyframes` (matches this file's existing CSS-in-JS convention — no CSS modules or styled-components in this codebase).

Design doc: [docs/superpowers/specs/2026-08-07-config-panel-splash-screen-design.md](../specs/2026-08-07-config-panel-splash-screen-design.md)

## Global Constraints

- One file only: `extension/src/ConfigApp.jsx`. No new dependencies, no new image assets, no backend changes.
- Must be theme-aware using the existing `THEME_TOKENS`/`t` object — no hardcoded colors.
- No test harness exists for this extension — verification is `npm run build` succeeding plus a manual visual check.

---

### Task 1: Add SplashScreen component and use it in both loading states

**Files:**
- Modify: `extension/src/ConfigApp.jsx:556-568` (the two early-return loading blocks), plus a new `SplashScreen` function added near `buildStyles` (around line 1685, right before it, so both are defined at module scope alongside the other helper functions in this file).

**Interfaces:**
- Produces: `function SplashScreen({ t, text })` — a React function component taking the current theme tokens object (`t`, same shape already passed to `buildStyles`) and a status-line string.

- [ ] **Step 1: Add the `SplashScreen` component**

Add this function immediately before `function buildStyles(t) {` (currently at `extension/src/ConfigApp.jsx:1685`):

```jsx
function SplashScreen({ t, text }) {
  return (
    <div
      style={{
        maxWidth: 900,
        margin: "0 auto",
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
      }}
    >
      <style>{`
        @keyframes splashPulse {
          0%, 100% { transform: scaleY(0.4); }
          50% { transform: scaleY(1); }
        }
      `}</style>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 44 }}>
        {[16, 30, 44, 22, 34].map((h, i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: h,
              borderRadius: 3,
              background: `linear-gradient(180deg, ${t.linkColor}, ${t.accent})`,
              animation: "splashPulse 1s ease-in-out infinite",
              animationDelay: `${i * 0.12}s`,
            }}
          />
        ))}
      </div>
      <div style={{ color: t.text, fontSize: 15, fontWeight: 600 }}>Livestreamer Hub</div>
      <div style={{ color: t.textMuted, fontSize: 13 }}>{text}</div>
    </div>
  );
}
```

- [ ] **Step 2: Use it in both loading states**

Replace (`extension/src/ConfigApp.jsx:556-568`):

```jsx
  if (!auth) {
    return (
      <div style={styles.container}>
        <p style={styles.muted}>Connecting...</p>
      </div>
    );
  }
  if (loading) {
    return (
      <div style={styles.container}>
        <p style={styles.muted}>Loading sounds...</p>
      </div>
    );
  }
```

with:

```jsx
  if (!auth) {
    return <SplashScreen t={t} text="Connecting to Twitch…" />;
  }
  if (loading) {
    return <SplashScreen t={t} text="Loading your sounds…" />;
  }
```

(`t` is already in scope at this point in the component — it's computed at the top of `ConfigApp()` via `const t = THEME_TOKENS[twitchTheme] || THEME_TOKENS.dark;`, the same object already passed to `buildStyles(t)`.)

- [ ] **Step 3: Verify**

```bash
cd extension && npm run build
```

Expected: build succeeds with no errors (matches the clean build already confirmed for this file's earlier edits this session).

Then manually verify the visual result: temporarily change `const [loading, setLoading] = useState(true);` to log or inspect in a local dev run (`npm run dev` if available, or by briefly forcing `if (true)` on one branch), confirm:
- The five bars animate with a staggered pulse.
- The wordmark and status text render in the correct theme colors for both dark and light (`twitchTheme` state).
- No layout shift/jump when the splash is replaced by real content (centered, no fixed height mismatch causing scroll-jank).

Revert any temporary debug changes before committing — only the `SplashScreen` addition and the two replaced blocks should remain in the diff.

- [ ] **Step 4: Commit**

```bash
git add extension/src/ConfigApp.jsx
git commit -m "Add animated splash screen for config panel loading states

Replaces the plain 'Connecting...' / 'Loading sounds...' text with a
consistent, on-brand animated splash (equalizer pulse + wordmark +
per-state status text), selected via visual-companion brainstorming.
Theme-aware, no new dependencies or assets.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

## Self-Review Notes

**Spec coverage:** Both loading states covered, theme-aware via `t`, per-state status text — all present in Task 1. Out-of-scope items (further wait-time reduction, a dedicated logo asset) correctly have no task.

**Type/interface consistency:** `SplashScreen({ t, text })`'s two props match exactly how it's called at both call sites (`t={t} text="..."`).
