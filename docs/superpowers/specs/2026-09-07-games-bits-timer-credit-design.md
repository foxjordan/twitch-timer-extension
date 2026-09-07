# Games Bits Timer Credit — Design

## Problem

A viewer's Plinko drop or Slots spin (paid for with real Bits, via the
extension) was crediting the timer using the Extras page's "Base Time"
setting × the game's landing multiplier — and nothing else. The
countdown timer's own Bits rule (`RULES.bits.per` / `add_seconds`, the
same rule that applies to a chat cheer, a Sound Alert, or a TTS
message) never applied to Games at all.

## Investigation

This took three passes to land correctly, worth recording so the
reasoning isn't lost:

1. **First read**: assumed `channel.bits.use` (the event Twitch fires
   for Bits spent inside an extension) was deliberately ignored
   *because* `channel.cheer` already covers the same spend — meaning
   the standard Bits credit already applied everywhere, Games
   included. Wrong: misread an ambiguous code comment.
2. **Second read**: found this project's own prior design spec
   (`2026-09-05-games-panel-extension-design.md`) asserting the
   opposite explicitly — that Bits spent inside the extension *do*
   fire `channel.cheer`, and built Games' whole tier-choice-matters
   pricing on that premise. Twitch's own public docs turned out
   inconsistent across three different pages when checked directly.
   Also wrong, but wasn't caught until:
3. **Real test**: the user ran an actual 10-Bit Plinko drop (10 bits
   min, 100s/10-bits rule) and a 10-Bit Slots spin, both landing on
   ×1. Plinko credited exactly 100s (Base Time 100 × 1); Slots
   credited exactly 1s (Base Time 1 × 1). If the standard Bits rule
   had *also* applied, Plinko would have shown 200s and Slots 101s.
   Neither did — proof the rule genuinely never fires for Games.

Tracing every place in `server.js` that actually credits Bits to the
timer explained why: **Sound Alerts and TTS already know
`channel.cheer` doesn't fire for extension Bits, and both have their
own explicit block** (`handleSoundAlert`, the `onTtsAlert` handler)
that manually replicates the `RULES.bits.per`/`add_seconds` math,
literally commented `"Add timer time for Bits-in-Extensions usage
(same rules as cheers)"`. Games was built later and never got the
same block — its author (a past instance of this assistant) assumed
the automatic path already covered it, which is exactly mistake #1
above, just made earlier and un-caught until now.

## Decision

Confirmed with the user: Games should **not** add Base Time for a
real Bits play. Base Time is a manual-testing-only concept:

- **Manual/test play** (streamer clicks Drop/Spin/Test on the Extras
  page, or a sound-alert-triggered bonus drop/spin): unchanged —
  `Base Time × landing multiplier`. No real Bits were spent by the
  viewer in either case (the sound-triggered case already spent its
  Bits on the sound itself, crediting the standard rule through the
  sound's own tier — the attached game trigger is deliberately a bonus
  on top, not a second charge for the same spend).
- **Viewer Bits play** (`POST /api/plinko/redeem` /
  `POST /api/slots/redeem`): `(the countdown timer's Bits-rule seconds
  for the tier actually redeemed) × landing multiplier`. Base Time
  plays no part.

## Implementation

- New shared function `bitsInExtensionSeconds(timerUid, bits)` in
  `server.js` — the same `RULES.bits.per`/`add_seconds` math, plus the
  same fractional-bits carry-forward pool, that `handleSoundAlert` and
  `onTtsAlert` already had inline, now factored out into one place.
  Both call sites refactored to call it (pure refactor, no behavior
  change there — verified via the existing 102-test suite, unchanged).
- `firePlinkoDrop`/`fireSlotsSpin` gained a `bits` parameter (0 for
  manual/test/sound-triggered — untouched code paths). When `bits >
  0`, the multiplier's base becomes `bitsInExtensionSeconds(uid,
  bits)` instead of `cfg.baseSeconds`.
- `POST /api/plinko/redeem`/`POST /api/slots/redeem` pass the actual
  Bits amount from the verified transaction receipt's SKU (not a
  client-supplied value) as `bits`.

## Verification

Local end-to-end test against the real HTTP routes (fake DB, so this
didn't touch the DB-backed event log — confirmed via the SSE stream's
`plinko_drop`/`slots_spin` payload instead, which carries the same
`baseSeconds`/`multiplier`/`secondsAdded` fields before the DB is ever
touched):

- Test rule: 100 bits → 500s. Board Base Time deliberately set to 999
  (a clearly-wrong value if it leaked through) on both games.
- A 100-Bit Plinko drop landing on ×1: `baseSeconds: 500`,
  `secondsAdded: 500`. Not 999.
- A 100-Bit Slots spin landing on a ×10 triple: `baseSeconds: 500`,
  `secondsAdded: 5000`. Not 999.

Full `ebs` test suite: 102/102 passing. Not yet deployed.
