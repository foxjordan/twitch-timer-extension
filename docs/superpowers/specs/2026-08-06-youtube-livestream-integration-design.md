# YouTube Livestream Integration — Design

Date: 2026-08-06
Status: Approved for planning

## Goal

Let a streamer who simulcasts to Twitch *and* YouTube feed their existing subathon
timer from both platforms at once. This is not a YouTube-only mode and not a second
timer — YouTube is an additional, opt-in source of "add N seconds" events on top of
the Twitch pipeline that already exists.

Target user: small number of multistreaming creators (Twitch primary, YouTube
simulcast). Explicitly out of scope: YouTube-only creators with no Twitch stream —
the whole feature is scoped to "also live on YouTube while live on Twitch."

**Hard constraint:** zero added cost — code path, UI, or quota — for the (majority)
of users who never connect YouTube. Nothing about this feature may add visual
clutter to the main rules UI or run any backend work for a broadcaster who hasn't
opted in.

## Event coverage (v1)

Mapped from YouTube Live Chat's `snippet.type` values to existing rule categories:

| YouTube event | New rule key | Modeled on |
|---|---|---|
| `superChatEvent` | `youtube_superchat` | `thirdPartyTip` (USD amount → seconds) |
| `superStickerEvent` | `youtube_superchat` (same rule, same handler) | `thirdPartyTip` |
| `newSponsorEvent` | `youtube_member` | `sub` |
| `memberMilestoneChatEvent` | `youtube_member_milestone` | `resub` |
| `membershipGiftingEvent` | `youtube_membership_gift` | `gift_sub` |

`giftMembershipReceivedEvent` is intentionally not handled separately — it's the
recipient-side echo of `membershipGiftingEvent` and would double-count if both add
time.

There is no YouTube equivalent of `raid`.

## Architecture

A second, self-contained event pipeline that parallels the existing Twitch one and
terminates in the same place:

```
Twitch (existing, unchanged):
  eventsub-ws.js --notification--> server.js switch --> state.js (add seconds)

YouTube (new):
  youtube_live_events.js --normalized event--> server.js switch (new cases) --> state.js (add seconds)
```

Both pipelines call the same underlying "add N seconds to this broadcaster's timer"
path in state.js. YouTube does not get its own timer, its own session concept, or
its own pause/resume state — it's purely an additional input to the timer the
streamer already has running for Twitch.

## New components

- **`youtube_auth.js`** — Google OAuth connect/callback for the YouTube Data API
  (live chat read scope). Same signed-state redirect pattern as
  [routes_auth.js](../../../ebs/routes_auth.js): `/youtube/oauth/start` and
  `/youtube/oauth/callback`, full-page redirect (not inside the Twitch extension
  iframe), matching how Twitch's own OAuth already works.

- **`youtube_accounts_store.js`** — per-broadcaster storage (keyed by Twitch user
  ID, same convention as [rules_store.js](../../../ebs/rules_store.js)) holding:
  the connected Google refresh token, the YouTube channel ID, and the "keep
  polling while live on Twitch" intent flag. This store is the source of truth for
  whether a broadcaster has opted in at all.

- **`youtube_live_api.js`** — thin wrapper around the YouTube Data API calls used:
  `liveBroadcasts.list(broadcastStatus=active)` to resolve the current
  `liveChatId`, and `liveChatMessages.list` to page through chat events. (Named
  distinctly from the existing `youtube_api.js`, which handles unrelated
  yt-dlp-based sound-clip downloads and has nothing to do with the Live Streaming
  API.)

- **`youtube_live_events.js`** — the poll loop and event normalizer. Given a
  broadcaster ID: resolve `liveChatId` once, then loop `liveChatMessages.list`
  using the returned `pollingIntervalMillis` and `nextPageToken`, converting each
  message's `snippet.type` into the same event shape server.js's switch already
  consumes for Twitch (e.g. `{ type: 'youtube.superchat', amountUsd, userName }`).
  Exposes `startYoutubePolling(userId)` / `stopYoutubePolling(userId)`.

- **New rule keys** in [rules.js](../../../ebs/rules.js) /
  [rules_store.js](../../../ebs/rules_store.js), following the existing
  `enabled: false`-by-default convention already used for `raid`/`follow`:
  ```js
  youtube_superchat:        { enabled: false, per_usd: 60, min_amount: 1 },
  youtube_member:            { enabled: false, base_seconds: 300 },
  youtube_member_milestone:  { enabled: false, base_seconds: 300 },
  youtube_membership_gift:   { enabled: false, per_gift_seconds: 300 },
  ```
  `mergeRules` gets a corresponding block for each, same shape as the existing
  `raid` block at [rules_store.js:62](../../../ebs/rules_store.js#L62).

- **server.js switch**: four new `case` branches alongside the existing
  `channel.raid` one ([server.js:1756](../../../ebs/server.js#L1756)), each
  guarded by `RULES.<key>.enabled`, same shape as the existing cases.

## Lifecycle — tied to Twitch's own stream.online/offline, not a standalone toggle

This is the key design decision from discussion: the YouTube poll loop's
start/stop is **not** independently managed. It rides the exact same signal that
already opens and pauses the Twitch EventSub WebSocket connection:
`handleBroadcasterWentLive` / `handleBroadcasterWentOffline`
([server.js:1114](../../../ebs/server.js#L1114),
[server.js:1144](../../../ebs/server.js#L1144)).

- The config-UI toggle ("also poll YouTube while live on Twitch") only writes the
  intent flag in `youtube_accounts_store.js`. It does not itself start a poll loop.
- `handleBroadcasterWentLive` — already fires on every real `stream.online`
  webhook, including the one that follows Twitch's ~48h forced ingest
  reconnect — checks the intent flag and calls `startYoutubePolling(userId)` if
  set.
- `handleBroadcasterWentOffline` — already fires on every `stream.offline`
  webhook — calls `stopYoutubePolling(userId)`, symmetric to how
  `pauseEventSubForUser` pauses (not tears down) the Twitch WS.

Why this matters: Twitch forces a hard ingest disconnect/reconnect around every
48h of continuous streaming (a real stream-ends/stream-starts pair, not a network
blip — confirmed via community reports of OBS having to reconnect
(<https://obsproject.com/forum/threads/obs-wont-automatically-reconnect-after-48-hour-twitch-stream.184547/>)).
The existing Twitch pipeline already treats that as routine — the timer itself in
state.js never resets on offline/online, only the EventSub connection
pauses/resumes. Hooking YouTube into the same two functions means the 48h
reconnect requires zero manual action: both pipelines go quiet for the same
few-seconds-to-minutes gap while OBS reconnects, then both resume automatically.
YouTube doesn't introduce a new failure mode on top of what Bits/subs already
tolerate during that gap — it rides the existing one.

On EBS process restart, the intent flag and stored refresh token in
`youtube_accounts_store.js` are what let the next `stream.online` webhook restart
polling cheaply — same recovery pattern `handleBroadcasterWentLive` already uses
to rebuild a Twitch connection record from a stored token
([server.js:1116](../../../ebs/server.js#L1116)).

## Quota safety

YouTube Data API quota (10,000 units/day default) is pooled per Google Cloud
project, shared across every connected broadcaster — unlike Twitch, where each
broadcaster's EventSub subscription is independent. `youtube_live_events.js` must
track units spent process-wide per day and refuse to start new poll loops once
near the daily cap, rather than letting one long stream silently starve every
other connected broadcaster. At current user counts this is a cheap safeguard, not
a scaling architecture — it exists because the failure mode (every YouTube-fed
timer silently stops updating, with no obvious cause) is expensive to debug
without it.

As an additional backstop (mirroring the existing 12h idle-disconnect sweep for
Twitch at [server.js:2286](../../../ebs/server.js#L2286)), a poll loop that's
received no `liveChatId` (i.e. `liveBroadcasts.list` shows no active broadcast)
for a bounded number of cycles stops itself and logs a warning, in case a
`stream.offline` webhook is ever missed.

## UI placement

In [overlayConfigPage.js](../../../ebs/views/overlayConfigPage.js), YouTube gets
its own **separate, collapsed-by-default section** — not inline in the main rule
list the way `raid`/`follow` are. Rationale: raid and follow are Twitch-native
concepts relevant to every user of the tool; YouTube fields are meaningless until
a Google account is connected, so surfacing them in the main flat control list
would clutter the page for the near-totality of users who will never touch this.

- Collapsed section labeled "Multistreaming (optional)" with a single "Connect
  YouTube" call-to-action when not connected.
- Once connected, expands to show: the "also poll YouTube while live on Twitch"
  toggle, connection status (channel name, last poll success/failure), and the
  four rule-editing controls (`youtube_superchat`, `youtube_member`,
  `youtube_member_milestone`, `youtube_membership_gift`) in the same control
  style as existing rule rows (see the `raid` controls at
  [overlayConfigPage.js:495](../../../ebs/views/overlayConfigPage.js#L495) for the
  pattern to follow).
- A "Disconnect YouTube" action clears the stored token and intent flag and stops
  any active poll loop immediately.

## Error handling

- **Google token refresh failure** (revoked access, expired refresh token): stop
  polling for that broadcaster, clear the "connected" state back to
  "needs reconnect" in the UI, do not silently retry indefinitely.
- **No active YouTube broadcast found** while the intent flag is set and Twitch is
  live: this is a normal state (streamer is live on Twitch but hasn't started
  their YouTube stream yet, or ended it early) — poll `liveBroadcasts.list` at a
  slow interval (e.g. every few minutes, not the fast chat-polling interval) until
  one appears or Twitch goes offline. Surface as "waiting for YouTube stream" in
  the UI, not an error.
- **Quota exhausted**: stop starting new loops, surface a clear "YouTube polling
  paused — daily limit reached" status rather than failing silently.

## Testing

- Unit tests for the `youtube_live_events.js` normalizer: each `snippet.type` →
  correct internal event shape, including amount/currency parsing for Super
  Chat/Sticker.
- Unit tests for the new `mergeRules` blocks in rules_store.js, matching the
  existing test pattern for `raid`/`follow`.
- Manual end-to-end verification against a real YouTube test broadcast (YouTube
  Studio supports test/private broadcasts) before shipping, since there's no
  sandbox equivalent to Twitch's EventSub CLI test events for Super Chat.
- Explicit manual test of the lifecycle hook: simulate a `stream.offline` →
  `stream.online` pair while YouTube polling is active and confirm it stops and
  restarts without user action, and that the timer is untouched throughout.

## Explicitly out of scope for v1

- YouTube-only creators (no Twitch stream).
- Auto-detecting when a streamer goes live on YouTube independent of Twitch
  status.
- A dedicated polling worker service — the in-process loop is sufficient at
  current scale; revisit only if concurrent YouTube-connected broadcaster count
  grows enough to strain the shared quota pool meaningfully.
