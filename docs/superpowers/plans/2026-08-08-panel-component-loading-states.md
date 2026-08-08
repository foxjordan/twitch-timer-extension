# Panel & Component Loading States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the branded loading splash to `App.jsx` (panel/mobile) and fix `ComponentApp.jsx`'s (overlay) loading + empty states, which currently render as bare text with no background card.

**Architecture:** Extract the existing `SplashScreen` component (currently inline in `ConfigApp.jsx`) into a shared `extension/src/SplashScreen.jsx`, alongside a new smaller `CompactPulse` variant for the overlay's tighter space. All three view files import from this one shared module.

**Tech Stack:** React (existing), inline styles (matches this codebase's existing convention — no CSS modules).

Design doc: [docs/superpowers/specs/2026-08-08-panel-component-loading-states-design.md](../specs/2026-08-08-panel-component-loading-states-design.md)

## Global Constraints

- No new theme-reactivity for `App.jsx`/`ComponentApp.jsx` — both stay fixed-dark, matching their existing design.
- Only the two early-return states in `ComponentApp.jsx` are touched — no change to its populated-content rendering.
- No test harness exists for this extension — verification is `npm run build` plus a real visual check via `extension/preview.html`.

---

### Task 1: Extract shared SplashScreen module

**Files:**
- Create: `extension/src/SplashScreen.jsx`
- Modify: `extension/src/ConfigApp.jsx:1677-1717` (remove the inline `SplashScreen` definition, add an import)

**Interfaces:**
- Produces: `SplashScreen({ t, text })` (unchanged behavior, moved verbatim) and `CompactPulse({ text })` (new) — both consumed by Task 2 and Task 3.

- [ ] **Step 1: Create `extension/src/SplashScreen.jsx`**

```jsx
/**
 * Branded loading treatment shared across all three Twitch-facing views
 * (config, panel/mobile, component overlay). SplashScreen is the full-size
 * version (config, panel); CompactPulse is a smaller variant sized to sit
 * inside the overlay's existing frosted-glass card rather than provide its
 * own outer container.
 */
export function SplashScreen({ t, text }) {
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

export function CompactPulse({ text }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
      }}
    >
      <style>{`
        @keyframes compactPulse {
          0%, 100% { transform: scaleY(0.4); }
          50% { transform: scaleY(1); }
        }
      `}</style>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 22 }}>
        {[10, 22, 15].map((h, i) => (
          <span
            key={i}
            style={{
              width: 4,
              height: h,
              borderRadius: 2,
              background: "linear-gradient(180deg, #bf94ff, #9146ff)",
              animation: "compactPulse 1s ease-in-out infinite",
              animationDelay: `${i * 0.12}s`,
            }}
          />
        ))}
      </div>
      <div style={{ fontSize: 12, color: "rgba(239,239,241,0.6)" }}>{text}</div>
    </div>
  );
}
```

- [ ] **Step 2: Update `ConfigApp.jsx` to import instead of define**

Add near the top, alongside the existing local imports (e.g. right after `import { BrandedFooter } from "./BrandedFooter.jsx";`):

```jsx
import { SplashScreen } from "./SplashScreen.jsx";
```

Then delete the inline `function SplashScreen({ t, text }) { ... }` block currently at `extension/src/ConfigApp.jsx:1677-1717` (everything from `function SplashScreen({ t, text }) {` through its closing `}`, immediately before `function buildStyles(t) {`) — it's now provided by the import instead. Do not change anything about how `SplashScreen` is *called* later in the file (`<SplashScreen t={t} text="..." />` call sites stay exactly as they are).

- [ ] **Step 3: Verify**

```bash
cd extension && npm run build
```

Expected: build succeeds, no errors, no unused-import warnings for `ConfigApp.jsx`.

- [ ] **Step 4: Commit**

```bash
git add extension/src/SplashScreen.jsx extension/src/ConfigApp.jsx
git commit -m "Extract shared SplashScreen component from ConfigApp.jsx

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Use SplashScreen in the panel/mobile view

**Files:**
- Modify: `extension/src/App.jsx:615-660` (the `if (loading)` block)

**Interfaces:**
- Consumes: `SplashScreen({ t, text })` from Task 1.

`App.jsx` has no theme-token system (confirmed: zero `THEME_TOKENS`/`onContext` references anywhere in the file) — it's fixed-dark by design. `SplashScreen` needs a `t` object with `linkColor`, `accent`, `text`, `textMuted` fields; pass a local constant matching `ConfigApp.jsx`'s existing `THEME_TOKENS.dark` values for exactly those four fields, not a new theme system.

- [ ] **Step 1: Add the import and fixed-tokens constant**

Add near the top of `extension/src/App.jsx`, alongside the existing local imports:

```jsx
import { SplashScreen } from "./SplashScreen.jsx";

// App.jsx has no theme system (fixed-dark by design) — these are the same
// four values ConfigApp.jsx's THEME_TOKENS.dark uses for SplashScreen,
// kept as a small local constant rather than introducing theme-reactivity
// this file has never had.
const SPLASH_TOKENS = {
  accent: "#9146ff",
  linkColor: "#bf94ff",
  text: "#efeff1",
  textMuted: "rgba(239, 239, 241, 0.8)",
};
```

- [ ] **Step 2: Replace the loading block**

Replace the entire existing block at `extension/src/App.jsx:615-660`:

```jsx
  if (loading) {
    return (
      <div style={{ padding: 12 }}>
        <div
          style={{
            padding: 14,
            borderRadius: 16,
            background: "#1f1f23",
            boxShadow: "0 0 0 1px #303038 inset",
          }}
        >
          <div
            style={{
              width: 100,
              height: 16,
              borderRadius: 6,
              background: "#2a2a32",
              marginBottom: 10,
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 6,
            }}
          >
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                style={{
                  paddingBottom: "120%",
                  borderRadius: 8,
                  background: "#2a2a32",
                  animation: "pulse 1.5s ease-in-out infinite",
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        </div>
        <style>{`@keyframes pulse { 0%,100% { opacity:.4 } 50% { opacity:.7 } }`}</style>
      </div>
    );
  }
```

with:

```jsx
  if (loading) {
    return <SplashScreen t={SPLASH_TOKENS} text="Loading your sounds…" />;
  }
```

- [ ] **Step 3: Verify**

```bash
cd extension && npm run build
```

Expected: build succeeds, no errors.

- [ ] **Step 4: Commit**

```bash
git add extension/src/App.jsx
git commit -m "Use shared SplashScreen for panel/mobile loading state

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Fix the component overlay's loading and empty states

**Files:**
- Modify: `extension/src/ComponentApp.jsx:664-693` (the `if (loading)` block and the immediately-following `if (!hasSounds && !hasTts)` block)

**Interfaces:**
- Consumes: `CompactPulse({ text })` from Task 1.

Both blocks currently return `<div style={containerStyle}><div style={headerStyle}>...</div>...</div>` — skipping the `contentStyle` frosted-glass wrapper (`rgba(14,14,16,0.85)` + `backdrop-filter: blur(12px)`) that the real populated content uses (see `extension/src/ComponentApp.jsx:695-697` for the pattern to match), so they render as bare text on a fully transparent background. Both get wrapped in `contentStyle` to match.

- [ ] **Step 1: Add the import**

Add near the top of `extension/src/ComponentApp.jsx`, alongside the existing local imports:

```jsx
import { CompactPulse } from "./SplashScreen.jsx";
```

- [ ] **Step 2: Replace the loading block**

Replace (`extension/src/ComponentApp.jsx:664-676`):

```jsx
  // Loading state
  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><img src="./alert_wave.png" alt="" style={{ height: 18, width: 18 }} />Sound Alerts</span>
        </div>
        <div style={{ padding: 12, textAlign: "center", opacity: 0.5 }}>
          Loading...
        </div>
      </div>
    );
  }
```

with:

```jsx
  // Loading state
  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={contentStyle}>
          <div style={headerStyle}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><img src="./alert_wave.png" alt="" style={{ height: 18, width: 18 }} />Sound Alerts</span>
          </div>
          <CompactPulse text="Loading your sounds…" />
        </div>
      </div>
    );
  }
```

- [ ] **Step 3: Replace the empty-state block**

Replace (`extension/src/ComponentApp.jsx:681-693`):

```jsx
  // No sounds or TTS
  if (!hasSounds && !hasTts) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><img src="./alert_wave.png" alt="" style={{ height: 18, width: 18 }} />Sound Alerts</span>
        </div>
        <div style={{ padding: 12, textAlign: "center", opacity: 0.5 }}>
          No alerts available
        </div>
      </div>
    );
  }
```

with:

```jsx
  // No sounds or TTS
  if (!hasSounds && !hasTts) {
    return (
      <div style={containerStyle}>
        <div style={contentStyle}>
          <div style={headerStyle}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><img src="./alert_wave.png" alt="" style={{ height: 18, width: 18 }} />Sound Alerts</span>
          </div>
          <div style={{ padding: 12, textAlign: "center", opacity: 0.5 }}>
            No alerts available
          </div>
        </div>
      </div>
    );
  }
```

- [ ] **Step 4: Verify**

```bash
cd extension && npm run build
```

Expected: build succeeds, no errors.

- [ ] **Step 5: Commit**

```bash
git add extension/src/ComponentApp.jsx
git commit -m "Fix overlay loading/empty states rendering with no background card

Both early-return states skipped the contentStyle frosted-glass
wrapper the real populated content uses, so they rendered as bare
text floating directly over game footage. Now wrapped consistently,
with a small CompactPulse animation replacing the plain loading text.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: End-to-end visual verification

**Files:** none (verification only).

- [ ] **Step 1: Run the preview tool**

```bash
cd extension && npm run dev
```

Open `http://localhost:5173/preview.html` (requires `extension/.env.local` already configured from earlier preview-tool work — re-run `node ../ebs/scripts/mint_preview_token.mjs --channel <id>` first if the token has expired).

- [ ] **Step 2: Force and screenshot each state**

For each of the three panels, temporarily force `loading` to stay `true` (e.g. comment out the `setLoading(false)` call in that file's `finally`/fetch-completion path, or add a `return true` at the top of the `loading` check) to capture the loading state, screenshot, then revert. For `ComponentApp.jsx`, also temporarily force `hasSounds = false; hasTts = false` to capture the empty state, screenshot, then revert.

Confirm:
- Panel/mobile shows the same branded pulse as Config, not the old skeleton grid.
- Component overlay's loading state shows the frosted-glass card with the small pulse, not bare text on transparent.
- Component overlay's empty state shows the same frosted-glass card treatment.
- No console errors in any of the three panels.

- [ ] **Step 3: Report results**

No commit for this task. If any state doesn't match what's described above, note exactly what's wrong (which file, what it looks like) rather than silently adjusting — that's signal an earlier task's code needs a fix, not a new guess.

## Self-Review Notes

**Spec coverage:** Shared component extraction (Task 1), panel replacement (Task 2), overlay loading + empty state fix (Task 3, both blocks per the approved scope), end-to-end visual verification (Task 4) — all present. Out-of-scope items (new theme-reactivity, populated-content changes) correctly have no task.

**Type/interface consistency:** `SplashScreen({ t, text })`'s signature is unchanged from its original inline version, so `ConfigApp.jsx`'s existing call sites need no changes. `CompactPulse({ text })` (no `t` prop — intentional, matches `ComponentApp.jsx` having no theme system) is called identically in both of Task 3's blocks.
