# Build Log Addendum — Grotto's Upper-Deck Stair Unreachable, 3 Sep 2026

Hotfix, found live: Maxime, mid-playtest of the same-day Carrier Scale-Up
(`Bloom_Wars_Carrier_Scale_And_Lance_Workshop_Plan_v1.md` Phase 1, also
written up in `Bloom_Wars_Build_Log_Addendum_CarrierScaleUp_Phases1and2_03Sep2026.md`):
*"new hub work. I cant reach the upper deck, the stairs is outside the
groto."*

## Root cause

Phase 1 grew each deck's floor from ~830x552 to 1650x1350 by extending
`GROTTO_BOUNDS`'s `right`/`bottom` only — `left`/`top` stayed at 40/100 on
purpose, to keep clear of the fixed corner text on screen.
`GROTTO_ELLIPSE` (`Hub.ts`) is computed as the ellipse inscribed in that
whole box — `cx`/`cy` at the box's own midpoint, `rx`/`ry` at its own
half-extents. Growing only two sides of a box drags that midpoint hard
toward the grown corner: the ellipse's center moved from roughly (390,326)
to (845,725).

The `grotto-to-workshop` door (the up-stair to the Upper Deck) never moved —
it was still sitting at its old fixed spot, `(480, ROOM_BOUNDS.top + 22)` =
`(480, 130)`, dating from before the grotto even had its own ellipse. That
point used to sit comfortably inside the old, smaller, roughly-centered-on-
it ellipse. Against the new one it doesn't: `(365/805)² + (595/625)² ≈
1.11` — just outside the walkable curve. `clampToDeckFloor` pulls the
player back to roughly `(507, 174)`, about 51px from the actual door —
past `DOOR_RADIUS`'s 45px reach. The player can walk right up next to the
stair marker and never trigger it.

Worth being direct about this since it's a real gap, not just a fix: the
Phase 1 build log's own claim — "the doors... are untouched... nothing
that was reachable stopped being reachable" — was true of the raw
coordinates and false of the outcome, because the shape wrapped around
those coordinates moved out from under them. The three live Playwright
checks that pass added for Phase 1 (`checkHubCameraScroll`,
`checkLanceWorkshops`, `checkHubInteractionAfterScroll`) cover camera
clamping, click hit-testing, and lance/room population — none of them
walk to a door and check it's actually reachable, so this shipped past all
of them and past `tsc`/`eslint`/1607 unit tests (Hub.ts still has none —
it imports Phaser at module scope — so this class of bug is invisible to
the automated suite either way).

`grotto-to-recroom` (the down-stair, at `y = ROOM_BOUNDS.bottom - 22 =
530`) survives the same box growth, but by luck, not by design — its
distance from the new center (195px) happens to stay well inside the new
`ry` (625px). Flagged, not touched — it isn't broken today, and moving it
would have meant re-picking its own landing-point convention for no
reachability gain.

## Fix

One line, in `DOORS` (`Hub.ts`): `grotto-to-workshop`'s `y` now reads
`GROTTO_ELLIPSE.cy - GROTTO_ELLIPSE.ry * 0.7` instead of the old
`ROOM_BOUNDS.top + 22` literal. That's ≈287.5 today — comfortably inside
the ellipse (checks out at e ≈ 0.70, the same margin family as every other
door in the table) — and it's derived from `GROTTO_ELLIPSE` itself rather
than a leftover pre-ellipse anchor, so it stays correct if `GROTTO_BOUNDS`
grows again later instead of silently breaking the same way a second time.
`x` stays at 480, the vertical-alignment column every deck's stairs share.
The door's drawn marker moves with it for free — `buildDoors()` draws
every marker straight from the `DOORS` table, one source of truth.

## `checkHubDoorReachability.mjs` — the follow-up script, now built AND run

Maxime: "lets add it then," then, correctly calling out that the earlier
"no shell on your machine" caveat didn't actually apply — this session has
its own full Linux sandbox with Node/npm/Chromium preinstalled, entirely
separate from Maxime's PC. So the real gap wasn't "no shell anywhere," it
was "hadn't assembled the repo somewhere with one yet." Fixed by copying
the full `src/`, `public/`, `tools/`, and root config over into that cloud
sandbox (194 files, 4.3MB, everything but `node_modules`/`.git`/binary
game assets, which the Hub-logic checks below don't touch), running
`npm install` there, and treating it as a second, disposable clone of the
repo purely for verification — nothing about Maxime's own checkout was
touched by this.

**Script**: pulls the real `DOORS` table live off the running scene
(`hub.doorMarkers.map(m => m.def)` — no hand-copied second table that
could drift from `Hub.ts`'s own), then for each door forces the player
into that door's room, clears every NPC off the deck so a collision can't
mask or fake the result, and calls the REAL `tryMove(dx, dy)` — the exact
method every WASD frame calls, running the exact `clampToDeckFloor` that
broke the grotto's up-stair — repeatedly toward the door's own (x, y)
until it stops making progress, then checks the scene's own `isAtDoor()`.
Generic over the whole table: a seventh door added later gets checked
automatically, no edit owed to this script.

**Actually run, this time, against the real dev server (`vite`, port
5183) with the standard 15-pilot midgame save:**

```
Found 6 doors on the live DOORS table: [
  'recroom-to-grotto', 'grotto-to-recroom', 'grotto-to-workshop',
  'workshop-to-grotto', 'recroom-to-sparRoom', 'sparRoom-to-recroom'
]
PASS — recroom-to-grotto (THE GROTTO) at (480,130): 0px from the marker
PASS — grotto-to-recroom (LOWER DECK) at (480,530): 0px from the marker
PASS — grotto-to-workshop (UPPER DECK) at (480,287.5): 0px from the marker
PASS — workshop-to-grotto (THE GROTTO) at (480,130): 0px from the marker
PASS — recroom-to-sparRoom (THE SPAR ROOM) at (160,150): 0px from the marker
PASS — sparRoom-to-recroom (LOWER DECK) at (480,300): 0px from the marker

6/6 doors reachable, pageErrors: none
```

`grotto-to-workshop` — the door that was broken — now walks the player
exactly to (480, 288) and `isAtDoor()` fires correctly. This is the actual
regression test passing, not hand-checked arithmetic.

**Also re-ran, same sandbox, same save, as a check on what's immediately
around the fix** (per the project's own standing rule about checking a
fix's neighbors): `tsc --noEmit` clean; `vitest run` — **73 test files,
1607 tests, all passing**, matching the exact count the Phase 1 build log
itself reported, so nothing regressed there either; `checkHubCameraScroll.mjs`
— camera clamping, the direct-teleport-into-new-floor check, hover-after-
scroll, and grotto re-clamp on a real door hop all PASS, zero page errors.
One line in that script's own output reads `cameraScrolled: false` (the
organic short WASD-walk portion didn't cover enough ground to register a
scroll in this run) — pre-existing, documented behavior per that script's
own README entry ("can legitimately cover very little ground... if the
seeded roster is crowding the spawn rooms"), not something this fix
touched.

Added to `tools/verify/README.md` and its run list, and both files
(`checkHubDoorReachability.mjs`, `README.md`) are committed to Maxime's
actual repo on his machine, same as the `Hub.ts` fix itself.

## Still open

- The verification above used a disposable clone of the repo inside this
  session's own cloud sandbox, not Maxime's real checkout — worth Maxime
  running the same script on his own machine once, if only to confirm the
  two environments agree (they should; nothing here is environment-
  specific).
- `grotto-to-recroom`'s "safe by luck" status (noted above) isn't
  re-tested by anything special; the new script covers it like any other
  door, so a future `GROTTO_BOUNDS` change that finally breaks it will get
  caught the same way this one should have been.
