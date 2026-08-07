# Config Panel Splash Screen — Design

Date: 2026-08-07
Status: Approved for planning

## Goal

Replace the two plain-text loading states in the in-Twitch extension config panel
("Connecting..." and "Loading sounds...") with one consistent, on-brand animated
splash screen, so the wait (previously investigated — see the `config_load_timing`
instrumentation added ahead of this) reads as polished rather than broken.

## Scope

One file: `extension/src/ConfigApp.jsx`. No backend changes, no new dependencies,
no new image assets. Purely what's rendered during the two existing early-return
loading blocks — no change to the loading/data-fetching logic itself.

## Visual design (selected via visual-companion brainstorming, concept C)

- A 5-bar animated equalizer/pulse (CSS `@keyframes`, staggered animation delays),
  on-brand for a sound-alert product.
- "Livestreamer Hub" wordmark beneath the pulse.
- A status line beneath that, whose text changes per state:
  - `"Connecting to Twitch…"` while `!auth` (waiting on Twitch's own auth handshake)
  - `"Loading your sounds…"` while `loading` (waiting on the `/api/sounds` fetch)
- Theme-aware: colors pulled from the existing `THEME_TOKENS`/`t` object already
  used throughout `ConfigApp.jsx` (accent purple gradient, text color, background),
  not hardcoded — so it matches dark/light Twitch themes automatically, consistent
  with the file's existing "mirrors ebs/views/theme.js" convention.

## Implementation

A small `SplashScreen({ t, text })` component (function, not a separate file —
this codebase keeps single-purpose small components inline in `ConfigApp.jsx`
rather than splitting every helper into its own file; `BrandedFooter.jsx` is the
one exception and it's currently an empty stub, not a pattern to extend for this).

Both existing early-return blocks:

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

become:

```jsx
if (!auth) {
  return <SplashScreen t={t} text="Connecting to Twitch…" />;
}
if (loading) {
  return <SplashScreen t={t} text="Loading your sounds…" />;
}
```

`SplashScreen` renders the equalizer bars, wordmark, and status text, centered in
a full-height container matching `styles.container`'s existing max-width/centering
so there's no layout shift when it's replaced by real content. The five bars use a
shared `@keyframes` pulse (scaleY 0.4 → 1 → 0.4) with staggered `animation-delay`
per bar, matching the timing already validated in the visual-companion mockup.

## Testing

This extension has no test harness (confirmed during the earlier performance
investigation — no test framework anywhere in `extension/`). Verification is
`npm run build` (Vite) succeeding, plus a manual visual check (temporarily forcing
`loading`/`!auth` true, or reviewing the built output) before this ships in the
next extension bundle submission.

## Out of scope

- Any further reduction of the actual wait time (handled separately — see the
  prior commit parallelizing new-user sound seeding and adding
  `config_load_timing` instrumentation).
- A dedicated logo/icon asset (`ebs/assets/livestreamerhub_logo.png` exists but
  the selected concept uses a text wordmark, not an image).
