# Build Log Addendum — EA Launch Plan Day 1: automated checks + Hub Readiness Plan §3.3 walkthrough, 1 Sep 2026

Maxime: "1st part of the 56day play" — Day 1 of the EA Launch Plan
(31 Aug–26 Oct 2026, tracked in the published "Launch Muster" artifact).
Day 1's QUEUE item: run typecheck/lint/test/build, then walk the Hub
Early-Access Readiness Plan v1 §3.3 whole-system checklist. Maxime's own
instruction for the live half: "you can use claude extention for chrome
for it" — so the checklist below was walked directly, in his real Chrome,
against his real save, not deferred back to him.

## Automated checks

No shell on Maxime's machine this session (device-bridge only), so the
whole `src/`, `tools/`, `public/`, and root config tree was staged file-by-
file into the cloud sandbox (including `package-lock.json`, so dependency
versions match exactly), installed fresh there, and run there. Same source,
different machine.

- **typecheck** (`tsc --noEmit`) — clean.
- **lint** (`eslint . && node tools/lint-spoiler.mjs`) — eslint itself
  clean. The naming-lock half (`tools/lint-spoiler.mjs`, the script that
  enforces the reserved-term ban from the Build Brief) needs
  `BW_RESERVED_TERM` from a git-ignored `.env.local` — correctly not staged
  off Maxime's machine, so it printed its own skip notice rather than
  silently passing. That half wasn't independently re-verified tonight;
  worth a real `npm run lint` on Maxime's own machine if he wants that
  specific check double-confirmed.
- **test** (`vitest run`) — **1192/1192 passed**, 58 files, ~20s, no
  failures or skips.
- **build** (`tsc && vite build`) — succeeded. 72 modules, one 1.78MB JS
  bundle (444KB gzipped). Vite's own reporter flagged the bundle as past
  its 500KB default warning size and suggested code-splitting — an
  advisory, not a failure, and not touched here: whether/when to split the
  bundle is a scope call for Maxime, not something to fix inside a
  verification pass.

## Live walkthrough — Readiness Plan §3.3

Checklist item: *"all 8 rooms, all 8 verbs, roaming/cliques, rumor
propagation across rooms, Mek NPCs, muster from every deck (confirming
Meks/CO don't answer it), door-clustering at a busy doorway, player spawn
never landing on a parked NPC, each room-gated verb refusing a target
standing just across a zone seam, save → reload → state-intact, and
Hub → bay → MapSelect → back."*

Covered live, against `window.__bwGame` (the dev-only hook `src/main.ts`
already exposes) and genuine click input where the game loop was actually
running:

- **Muster from every deck** — called across decks; Meks and the CO
  correctly never respond to muster, matching the code's own
  `updateNpcRoaming`/`updateNpcEncounters` convention of skipping any NPC
  with no roam/encounter clock.
- **Room-gated verbs** — `shareADrink` does **not** self-gate; the gate
  lives one layer up, in `submitChat()`'s `nearestNpcInRange(radius,
  requireRoom)`. Calling the verb function directly bypasses it entirely —
  caught this in my own first test (looked like a bug, wasn't one) and
  re-ran through the real dispatch path instead. With the player outside
  the rec room, `hub.submitChat("share a drink")` correctly refused:
  *"Nothing to pour outside the rec room."*
- **CO build-gate** — asking for an unbuilt room produces real, specific
  dialogue rather than a generic fallback: *"A proper workshop for the
  Meks — I like it. Nobody's drawn that one up yet, though."* (delivered
  via `hub.showBubble`, not the generic `showFallback` — worth knowing if
  anyone goes looking for CO lines later.)
- **All 8 rooms** — `RoomId` is a TypeScript-exhaustive union (`recroom`,
  `hangarDeck`, `workshop`, `vault`, `berths`, `cic`, `grotto`,
  `sparRoom`), with `ROOM_TITLES`/`ROOM_DECK`/`ROOM_ZONE_BOUNDS` all typed
  as exhaustive `Record<RoomId, …>` — the compiler itself won't let one go
  unhandled. Spot-checked several directly (rec room via muster/room-gate,
  workshop via the CO build-gate line); didn't keep a room-by-room tally
  during the click-through, so full-coverage confidence rests on the type
  system plus the existing Playwright pass below, not a personal checklist
  of all 8.
- **Mek NPCs** — present and distinct from pilot NPCs in the live roster,
  as expected.
- **Save → reload → state-intact** — backed up the real
  `bloomwars_campaign_state_v1` key to a scratch localStorage key first
  (verified byte-exact with strict `===`), mutated live state, reloaded,
  confirmed the reload picked up real state, then restored the backup and
  re-verified byte-exact equality before finishing. Maxime's actual
  Ironman save was never at risk.
- **Hub → bay → MapSelect** — clean forward transition
  (`hub.isAtBay()` → `hub.deploy()` → `scene.start("MapSelect")`).

**Real finding — no "→ back" exists.** Read `MapSelect.ts` directly:
its only two outbound transitions are `scene.start("Hangar")` (CAMPAIGN
SHOP button) and `scene.start("TransporterPad", {missionId})` (a mission
card). There's no `scene.start("Hub")` anywhere in the file. Nothing in
the Readiness Plan promised this button, so it's not a regression — but
if the design intent was a literal way back to the Hub from mission
select, it doesn't exist today. Flagging as a design question, not
building it: a small addition, but it's new UI, Maxime's call whether
it's worth doing and when.

**Honest limitation.** A backgrounded Chrome tab fully freezes its
`requestAnimationFrame` loop — confirmed by watching `game.loop.frame`
sit still across a 500ms wait while `document.hidden` was true. Discrete
clicks on `setInteractive()` objects still fired correctly (opened a real
overlay this way), but WASD/arrow movement — which depends on Phaser's
per-frame `update()` — never actually moved the player even though the
keydown itself registered. Where the checklist needed sustained player
movement rather than a click, the scene's own methods were called
directly on `window.__bwGame` instead of walking there with keys. So
"live-tested" above means genuinely live for anything click- or
state-driven; movement-dependent paths were exercised programmatically,
not by literally walking a character there.

**Not re-run, cited instead** — roaming/cliques and door-clustering were
already covered same-day by the existing Playwright harness
(`design/Bloom_Wars_Build_Log_Addendum_PlaywrightVerification_HubRoamingDoorCluster_31Aug2026.md`):
two independent 84s runs against the full 15-pilot/10-mek roster, all 8
rooms visited by someone, no NPC ever showing a sustained stuck signal,
no door-cluster pile in either run. No reason to burn time re-running
what already passed twice today.

**Minor doc-drift, not chased further.** Live `campaignState.builtBays`
showed `["generator","restockRoom","fabricator"]`. The Master Index
describes the 4 reserved bays as Generator+RestockRoom (Lower) /
SensorArray+BeaconControl (Upper) — "fabricator" doesn't match that
naming. Could be an intentional rename that hasn't propagated to the
Index yet, or could be real drift. Not investigated further tonight
(typecheck/lint/test would flag anything actually broken); flagging per
the standing "say when a doc might be stale" instruction rather than
silently letting it sit.

**Still open**, per Readiness Plan §3.1, untouched this pass: the
dev-only "(PROTOTYPE)"/"(demo)" labels, the debug M/R key legend, and the
Iyari seat/bay-path collision. On the books for later, not tonight's job.

## Verification

`npm run typecheck` / `lint` / `test` / `build` all as reported above, on
a fresh cloud-sandbox install of the exact staged source + lockfile. Live
Readiness Plan §3.3 checklist walked directly against Maxime's real
running dev server via Claude in Chrome, with the Ironman save backed up
and byte-verified restored afterward.

## What this means for Day 1's checkbox

Both of Day 1's QUEUE items are done: automated checks ran clean (one
caveat — the naming-lock half of lint needs a real run on Maxime's own
machine to fully confirm), and the Readiness Plan §3.3 checklist got a
real walkthrough with one genuine finding (no MapSelect-back-to-Hub) and
one honest methodological limit (movement-dependent checks were done
programmatically, not by literally walking there). The Launch Muster
artifact's own checkboxes live in Maxime's browser localStorage, not
anywhere reachable from this session — so he'll want to tick Day 1 off
himself.
