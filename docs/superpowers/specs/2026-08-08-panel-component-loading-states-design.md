# Panel & Component Loading States — Design

Date: 2026-08-08
Status: Approved for planning

## Goal

Extend the branded loading treatment already shipped for `ConfigApp.jsx` to the
other two Twitch-facing views: `App.jsx` (panel/mobile) and `ComponentApp.jsx`
(video overlay). Fix a related bug found along the way: `ComponentApp.jsx`'s
"No alerts available" empty state has the same missing-card problem as its
loading state.

## What was actually found (not assumed)

- `App.jsx`'s loading state already has a reasonable pulsing-skeleton treatment
  (placeholder tiles shaped like the real sound grid) — not blank, just visually
  inconsistent with Config. User chose to replace it with the same branded pulse
  for consistency across all three views.
- `ComponentApp.jsx`'s loading state is plain "Loading..." text with **no
  background card** — it skips the `contentStyle` frosted-glass wrapper
  (`rgba(14,14,16,0.85)` + `backdrop-filter: blur(12px)`) that the real populated
  content uses, so it renders as bare text floating directly over whatever game
  footage is behind the overlay. This is the actual bug.
- The immediately-following "No alerts available" empty state has the identical
  bug (same missing wrapper) — fixed in the same pass since it's the same root
  cause, confirmed in scope with the user.
- Neither `App.jsx` nor `ComponentApp.jsx` has any theme-token system
  (`THEME_TOKENS`/`onContext`-driven, like `ConfigApp.jsx` has) — both are
  fixed-dark by design. Confirmed via the preview tool's theme toggle test.

## Design

**Extract a shared component**, since three files now use the same visual
language: `extension/src/SplashScreen.jsx`, exporting:

- `SplashScreen({ t, text })` — the existing full-size version (5-bar pulse,
  wordmark, status line), moved out of `ConfigApp.jsx` verbatim. Used by
  `ConfigApp.jsx` (updated to import instead of defining inline) and `App.jsx`.
  Since `App.jsx` has no theme system, it passes a small local constant matching
  `THEME_TOKENS.dark`'s existing values for the four fields `SplashScreen` reads
  (`accent`, `linkColor`, `text`, `textMuted`) — not a new theme system, just the
  fixed colors it already effectively uses everywhere else.
- `CompactPulse({ text })` — new, small 3-bar variant (concept A from the
  visual-companion mockup), no wordmark, sized to sit inside `ComponentApp.jsx`'s
  existing `contentStyle` card rather than provide its own outer container
  (`flex: 1` to fill the card's remaining space below the header).

**`App.jsx`**: replace the pulsing-skeleton loading block with
`<SplashScreen t={FIXED_DARK_TOKENS} text="Loading your sounds…" />`.

**`ComponentApp.jsx`**: both the loading block and the "No alerts available"
block get wrapped in `contentStyle` (matching the real populated-content
structure: `containerStyle` outer, `contentStyle` inner card, `headerStyle`
unchanged inside it). Loading's inner content becomes
`<CompactPulse text="Loading your sounds…" />`; the empty state keeps its
existing "No alerts available" text, just now inside the properly-backed card
instead of bare on transparent.

## Testing

No test harness exists for this extension (established in the earlier splash
screen work). Verification: `npm run build` succeeding, plus a real visual check
via the local preview tool (`extension/preview.html`) — force each loading/empty
state temporarily, screenshot, revert.

## Out of scope

- Any new theme-reactivity for `App.jsx`/`ComponentApp.jsx` — both stay
  fixed-dark, matching their existing (unchanged-by-this-work) design.
- Further changes to `ComponentApp.jsx`'s populated (real content) rendering —
  only the two early-return states are touched.
