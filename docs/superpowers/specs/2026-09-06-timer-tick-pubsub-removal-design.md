# Timer Tick PubSub Broadcast Removal — Design

## Problem

Broadcasters reported the Twitch extension (Config panel, viewer Panel,
Games tab) and the EBS web dashboard's Extras/Utilities page all
intermittently stuck on loading states for many seconds — 15-20s on
Config, 30-60s on the viewer Panel, with the Games tab sometimes blank
for several more seconds after everything else finished. The Extras
page was slow to load and could hang for a long time when navigating
away from it.

## Investigation

A live sample of `fly logs` (structured request timing is already
logged on every request via `logger.js`'s `requestLogger` — one
`http_request_completed` line per request, including `durationMs`)
showed frequent multi-hundred-millisecond to multi-second latency
spikes hitting *simultaneously* across completely unrelated, otherwise
trivial endpoints:

```
16:33:57.782  /api/timer/state    1439ms
16:33:57.782  /api/timer/totals   1438ms
16:33:57.783  /api/overlay/style  1440ms
16:34:03.462  /api/timer/state    1358ms
16:34:03.462  /healthz            1362ms
16:34:12.100  /api/events/log     1677ms
16:34:12.101  /api/timer/state    1592ms
16:34:29.944  /api/timer/state    3046ms
```

`/healthz` is a pure in-memory status check with no DB or external
calls. Seeing it spike to 1362ms at the exact moment three unrelated
endpoints also spike rules out any single endpoint's own logic as the
cause — this is Node's single event loop getting blocked, delaying
every in-flight request together. This pattern repeated throughout the
whole sampled window, not as a rare edge case but as an ongoing,
frequent condition.

**Root cause:** `server.js`'s once-per-second global tick
(`setInterval(async () => {...}, 1000)`, ~line 3293) loops over
`broadcasterConnections.keys()` — every broadcaster with a currently
open EventSub WebSocket connection, which for a mature product means
most-to-all active accounts — and for *each one*, every second,
unconditionally:

1. Synchronously signs a fresh JWT (`broadcast.js`'s
   `signExtensionJwt`, HMAC-SHA256).
2. Fires a real HTTPS `POST` to Twitch's Extensions PubSub API
   (`broadcastToChannel(..., type: "timer_tick", ...)`).

With 43 active broadcasters (current production count per `/healthz`),
that's 43 signs + 43 concurrent outbound Twitch API calls, every
second, forever, regardless of whether anyone is actually viewing that
broadcaster's extension. This is the dominant, unconditionally-scaling
cost in the tick and the best-supported explanation for the observed
stalls.

**This broadcast has no consumer.** Every real `timer_tick` consumer
found in the codebase — the OBS overlay page (`overlayPage.js`),
`routes_timer.js`'s stream endpoints — uses Server-Sent Events, a
completely separate mechanism that the same tick also correctly
maintains (the SSE fan-out loop immediately below the PubSub block,
which stays untouched by this fix). A repo-wide search for
`window.Twitch.ext.listen(...)` — the only way a Twitch extension
client can receive a PubSub broadcast — found zero matches anywhere in
`extension/src`, and `git log --all -S "ext.listen" -- extension/src/`
returns zero commits: the deployed Panel/Component/Config bundle has
never listened for PubSub, in its entire history.

Historical read (both `broadcast.js` and the SSE overlay stream have
existed since the repo's first commit): an early version of the
extension likely displayed the countdown directly and consumed this
via PubSub. The OBS overlay was always SSE-only, since a plain Browser
Source page has no access to `window.Twitch.ext` at all. At some point
the extension's own Panel/Component pivoted entirely to today's
Sounds/TTS/Games redemption UI and stopped displaying the timer — but
the server-side broadcast was never removed, since nothing broke when
it became dead weight. It has been costing CPU and Twitch API traffic,
unconditionally, once a second, for every connected broadcaster, ever
since.

User-confirmed: no broadcaster is running an extension version older
than 1.0.1 — every version that's ever shipped in this repo's
`extension/src`, none of which ever listened for PubSub. This removes
the one compatibility risk that would otherwise justify keeping the
broadcast around for old clients.

## Fix

**Comment out — not delete — the PubSub broadcast block** inside the
once-per-second tick, leaving a clear note explaining what it was,
why it's disabled, and the evidence, so it can be understood or
restored later without re-doing this investigation. The SSE fan-out
loop immediately below it (the actual, real, currently-used delivery
mechanism for both the OBS overlay and any other SSE consumer) is left
completely untouched.

Concretely, in `ebs/server.js`, inside the tick's `try` block:

```js
  // Check bonus time schedules for all users
  for (const uid of state.users.keys()) {
    checkBonusSchedule(uid);
  }

  // DISABLED 2026-09-06 — this used to broadcast a "timer_tick" PubSub
  // message to every connected broadcaster's extension, once a second,
  // unconditionally, regardless of whether anyone was viewing it. It
  // has no consumer: every real timer_tick consumer (the OBS overlay
  // page, routes_timer.js's stream endpoints) uses the SSE fan-out
  // below instead, which is untouched by this change. A repo-wide
  // search (including full git history) found no extension code that
  // ever calls window.Twitch.ext.listen(...) — the deployed
  // Panel/Component/Config bundle has never received this broadcast.
  // With 40+ active broadcasters this meant 40+ synchronous JWT signs
  // plus 40+ real HTTPS calls to Twitch's PubSub API every single
  // second, forever — confirmed via production request-timing logs
  // (see docs/superpowers/specs/2026-09-06-timer-tick-pubsub-removal-design.md)
  // to be the dominant cause of multi-second event-loop stalls that
  // were hitting every endpoint on the server, not just this one.
  // If a future extension version needs a live PubSub-pushed timer
  // again, restore this block — but scope it to broadcasters who
  // actually have a viewer with the extension open, not everyone with
  // an open EventSub connection (that list is sized for a different
  // purpose — detecting follows/raids/bits/subs — and is much larger
  // than "someone is currently watching the timer").
  //
  // await Promise.allSettled(
  //   Array.from(broadcasterConnections.keys()).map(async (userId) => {
  //     try {
  //       const remaining = getRemainingSeconds(userId);
  //       const hype = state.users.get(String(userId))?.hypeActive;
  //
  //       await broadcastToChannel({
  //         broadcasterId: userId,
  //         type: "timer_tick",
  //         payload: { userId, remaining, hype, capReached: capReached(userId) },
  //       });
  //     } catch (err) {
  //       observability.lastBroadcastErrorAt = new Date().toISOString();
  //       logger.error("broadcast_failed", {
  //         broadcasterId: userId,
  //         reason: err?.message,
  //         type: "timer_tick",
  //       });
  //     }
  //   }),
  // );

  // Fan-out to SSE clients (already handles per-user correctly!)
  for (const client of Array.from(sseClients)) {
    ...
```

No other files change. `broadcastToChannel` itself stays exported and
in use elsewhere (`sound_alert`, `tts_alert`, plinko/slots events) —
only this one call site is disabled.

## Explicitly out of scope (separate follow-ups, not forgotten)

1. **Other `broadcastToChannel` call sites may also have no consumer**
   (`sound_alert`, `tts_alert`, plinko/slots events at various points
   in `server.js`). Worth checking separately — but these are
   event-driven (fire once per real redemption, not once per second
   per broadcaster), so they are not contributing to the measured
   stalls and are not urgent.
2. **Config panel's toggle/select controls show no pending-state
   feedback** while a save request is in flight (checkboxes stay
   unchecked or selects revert to the old value for several seconds,
   which invites rapid re-clicking and redundant server calls). A
   real, separate bug from the tick issue — needs its own bounded
   design pass (either optimistic UI or a Save button with a clear
   in-progress state).
3. **The EBS Extras/Utilities page opens two of its own long-lived SSE
   connections** (Plinko and Slots live preview streams) alongside
   several `fetch()` calls on load. This is a plausible independent
   contributor to that page's own slowness and hang-on-navigate-away,
   separate from the tick issue. Worth investigating if Extras-page
   symptoms persist after this fix ships.

## Verification plan

- Local: `node --check ebs/server.js`; boot the local test EBS and
  confirm it starts cleanly and the SSE-driven timer tick still fires
  (existing local test harness from this session covers this).
- `cd ebs && npm test` — confirm no regressions.
- Production, post-deploy: repeat the same `fly logs` sampling used to
  find this (grab a live window, filter `http_request_completed`,
  check for the same simultaneous-spike pattern on `/healthz`,
  `/api/timer/state`, `/api/timer/totals`, `/api/overlay/style`,
  `/api/events/log`). Expect those spikes to disappear or drop
  sharply. Spot-check that the OBS overlay and extension Panel still
  update normally — their delivery path (SSE) is unchanged by this
  fix, so this is a sanity check, not an expected risk.

## Risk assessment

Low risk. The change disables a confirmed-dead code path; the actual,
real-time delivery mechanism (SSE) that both the OBS overlay and every
found `timer_tick` consumer depend on is completely untouched.
Reverting, if ever needed, is a one-line uncomment.

**Deploy timing:** do not deploy while any broadcaster is mid-subathon
or otherwise in a high-stakes live moment — not because this specific
change is risky, but because *any* EBS deploy briefly restarts the
process and its EventSub WebSocket connections, which is a
standing caution for all deploys, not something this fix introduces.
