# Build log addendum — muster acknowledgment bug, actually diagnosed and fixed, 2 Sep 2026

Resolves `Bloom_Wars_Bug_MusterCrossDeckNoMove_02Sep2026.md`. Short version: the bug doc's three hypotheses were all about door-hop routing, and all three were wrong. The real cause was already half-fixed back on 31 Aug and nobody noticed the other half was still live.

## What the bug actually was

`sendToMuster()` in `Hub.ts` already had a guard that's been there since the 31 Aug Tier 1 pass: it early-returns for any NPC with no entry in `campaignState.pilots`. That's Meks and the CO — they have no deployable mission slot, so there's nothing for muster to send them toward. That guard is exactly what closed the 29 Aug complaint ("muster also connect to mek which it shouldnt") — Meks genuinely do not get pulled into muster movement, and never have since that fix. The Consolidated Build Plan's "Meks/CO answering muster" line under Tier 1 is correct as far as it goes.

What it missed: `broadcastMessage()` and `propagate()` — the two places that decide who *hears* a muster call at all — never checked that same guard. Both fired the "aye, heading out" acknowledgment bubble at every in-range or relayed NPC unconditionally, Meks and CO included, then called `sendToMuster()` on them, which silently did nothing. From the player's chair that's indistinguishable from a routing failure: the NPC replies, then never moves, forever. That's the exact shape of what Maxime reported ("tried to use muster to make my ant move from the 3rd deck stack to the 1st lvl hangar. they replied, but didnt move") — "ant" being a Mek, home-roomed in the Workshop, which happens to sit on the Upper deck. The cross-deck detail in the report is real but incidental — this reproduces on any deck, same-deck included, for any Mek or the CO. It was never a hop-routing bug.

## Why the bug doc's hypotheses were wrong, confirmed rather than assumed

The doc's three candidates all assumed the multi-hop stair logic (`nextHopDoor`/`completeDoorHop`) was failing to resolve or stalling out for a mustered NPC. Rather than trust that read, I wrote a standalone script replicating `ROOM_DECK`, `DECK_ORDER`, and `DOORS` exactly and simulated `nextHopDoor` across all 64 room-pair combinations, plus a full journey simulation from every room to the Rec Room. Zero failures — every room resolves correctly, and Workshop/Vault/CIC (the three Upper-deck rooms) each take exactly 2 hops via Workshop→Grotto→Rec Room, as expected. The hop-chaining logic that shipped 31 Aug is solid. That's what pointed me at the messaging layer instead.

## The fix (first pass)

Both `broadcastMessage()` and `propagate()` skip an NPC's actual muster response — no `sendToMuster` call, no relay — using the same `campaignState.pilots[npc.pilotId]` check `sendToMuster()` already enforced:

```ts
if (message.kind === "muster" && !this.campaignState.pilots[npc.pilotId]) { /* see follow-up below */ }
```

Non-muster messages (ambient chat, other broadcast kinds) are untouched.

## Follow-up, same day — Meks/CO get a real decline line instead of silence

Flagged as an open UX question in this addendum's first pass, then confirmed by Maxime ("yes"): before this fix, muster'd Meks/CO gave a false "on my way" reply. The first-pass fix above made them go completely silent instead — technically honest, but reads as the game just not reacting.

Added `pickMusterDeclineLine(role: "mek" | "co")` to `src/data/ambientLines.ts`, with two small line banks (`MEK_MUSTER_DECLINE_LINES`, `CO_MUSTER_DECLINE_LINES`) written in-voice for each role — a Mek stays at the bench ("Not my post, boss — my war's fought at the bench"), the CO redirects with rank ("You don't summon me — I send you. Get to the bay."). `broadcastMessage()` and `propagate()` now show this bubble for a Mek/CO in earshot of a muster call, but still never call `sendToMuster` and still never relay the call onward for them — a decline reacts, it doesn't deploy or spread the word.

**Deliberately not catalyst-flavored.** Most of this file's other line banks (`STAGE_PROMOTION_LINES`, `RANK_GREETING_LINES`) are written per-catalyst, 9 variants each. Doing the same for both muster-decline roles would be real new content-authoring scope for what's meant to be a small polish fix, so I kept it to a handful of generic lines per role instead. Worth a real catalyst pass later if wanted — flagged, not built.

## Verification

- `npx tsc --noEmit` — clean (both passes).
- `npx eslint src/` — clean (both passes).
- `npx vitest run` — 1599/1599 passing, 72 test files, no change from before the decline-line follow-up (nothing in the muster/Hub path has dedicated unit coverage — `Hub.ts` still has no real unit-test suite, same standing gap every Hub doc flags).
- `npm run build` — clean (spoiler lint still a no-op pending `BW_RESERVED_TERM`, same standing gap, not touched).
- **Real live-browser check, both passes.** `tools/verify/checkMusterMekAck.mjs` (new script, committed to the device) uses this project's existing Playwright harness (`tools/verify/`, cloud-sandbox Chromium, the `window.__bwGame` dev hook, a seeded 15-pilot midgame save via `genSave.ts`). Booted the real dev server, landed in the live Hub scene, and drove the exact shipped code path (`hub.callMuster()`, same function the M key calls) against real NPC objects:
  - **First pass (silent decline):** Mek's `targetX`/`targetY` were byte-identical before/after the muster call, no bubble, `mustered` stayed `false`. Real pilot in the same test got the bubble, `mustered: true`, and a genuine 165px walk toward the bay.
  - **Second pass (decline line), re-run after the follow-up:** Mek now shows a real bubble reading exactly `"Not my post, boss — my war's fought at the bench."`, while `mustered` stays `false` and `targetX`/`targetY` remain byte-identical to before the call (confirms `sendToMuster` still never runs for it). Same pilot, re-run clean: bubble, `mustered: true`, 185px walk to the bay this time (movement is randomized per pilot AI, not a fixed distance — variance between runs is expected).
  - Full numbers in `tools/verify/muster_ack_report.json` (sandbox-local, not committed, regenerate by re-running the script per this harness's own convention).
- Mtime-drift checked clean before each commit; both `Hub.ts` and `ambientLines.ts` confirmed via a fresh device listing showing the new size/mtime after commit. The check script itself was also committed to `tools/verify/checkMusterMekAck.mjs` for reuse, updated in place for the second pass rather than duplicated.

## Status: fully closed

Both the original bug and its own flagged follow-up are done, verified live, and committed. No open items remain on this specific thread.
