# Master Index Sync Note — 3 Sep 2026

Same shape as `Bloom_Wars_Master_Index_Sync_Note_2Sep2026.md`: a standalone
note rather than a rewrite of `claude_Bloom_Wars_Master_Index.md`, which is
large enough that a full replacement to append one section is its own risk.
Fold this into the index's own chronology the next time that file is opened
for another reason anyway.

## What shipped, 3 Sep 2026 (later) — the ship interior: walls, corridors, rooms, pathfinding

The Hub is a floor plan now, not four open boxes. Every rectangular deck
has a spine corridor with rooms hanging off it forward and aft, real walls
with doorways, furniture that blocks a body, and NPCs that route through
doors (A* on a per-deck nav grid). New rooms: one berth per lance, the
Heads, Engineering and the Forward Bays (the reserved-bay markers now live
in real rooms), and named corridors. The launch BAY moved from the Rec Room
to the Hangar Deck. The grotto keeps its oval and two doors, sized as a
room. Decks are 1500x960 (was the 1650x1350 placeholder).

**Full account, including the trap-gap bug the live roam check caught and
the harness fixes:**
`Bloom_Wars_Build_Log_Addendum_ShipInterior_WallsCorridorsPathfinding_03Sep2026.md`.

**Files changed on the device:** new `src/engine/hubLayout.ts`,
`src/engine/hubNav.ts`, `src/engine/__tests__/hubLayout.test.ts`,
`tools/verify/captureHubDecks.mjs`; changed `src/scenes/Hub.ts` and every
script in `tools/verify/` plus its README.

**Verification:** `tsc`, `eslint`, `lint-cast-collision`, `vite build`
clean; **74 files / 1757 tests** (up 150); all ten live Playwright scripts
pass with zero console errors, including a displaced Mek walking out one
workshop door, along the corridor and in through its own.

**Two rules worth carrying forward:**
- Every world coordinate in the Hub comes from `engine/hubLayout.ts`.
  Don't type one into `Hub.ts` again; add it to the layout and import it.
- Furniture is flush to a wall or a full body-width clear of it — never a
  3–37px slot. `hubLayout.test.ts`'s `no trap gaps` test enforces it.

## What shipped, 3 Sep 2026 (earlier) — the Hub's carrier scale-up, both phases

`Bloom_Wars_Carrier_Scale_And_Lance_Workshop_Plan_v1.md` is fully built,
verified and on the device. That plan doc now carries inline status notes
and the answers to its own open questions.

**Full account, with the two latent bugs and two regressions caught before
they shipped:**
`Bloom_Wars_Build_Log_Addendum_CarrierScaleUp_Phases1and2_03Sep2026.md`.
The grotto's up-stair hotfix that followed it the same morning:
`Bloom_Wars_Build_Log_Addendum_GrottoUpperStairUnreachable_03Sep2026.md`.

In one paragraph: every Hub deck's walkable floor grew far past one screen,
with a real camera that follows the player and clamps per deck (stairs
between decks are unchanged); every fixed HUD element, overlay, the chat
log and its mask, the chat DOM input and the shared MENU/ShopPanel/HoverTip
modules were pinned to the screen; the Meks now live in one workshop per
lance — Lance A's existing room plus two new ones on the upper deck — which
took the 15-pilot midgame save's Lance A workshop from holding all 15 Meks
to holding 5; and idle pilots now sometimes roam open floor. (The
1650x1350 deck size from this pass was superseded the same day by the
floor-plan pass above.)

**Files changed on the device:** `src/scenes/Hub.ts`,
`src/engine/campaignState.ts`, `src/scenes/MenuOverlay.ts`,
`src/scenes/shop/ShopPanel.ts`, `src/scenes/ui/HoverTip.ts`, plus new
`src/engine/__tests__/lanceOfPilot.test.ts` and three new scripts in
`tools/verify/` (`checkHubCameraScroll.mjs`, `checkLanceWorkshops.mjs`,
`checkHubInteractionAfterScroll.mjs`) with that directory's README updated.

## The one thing worth carrying forward into any future Hub UI work

Phaser renders a container's children using the **container's** scroll
factor but hit-tests them using each **child's own**. Any interactive
element added inside one of Hub.ts's screen-pinned overlays therefore needs
its own `.setScrollFactor(0)` at creation, or it will draw in the right
place and take clicks somewhere else — off by exactly the camera's scroll,
with `tsc`, lint and the entire unit suite passing clean the whole time.
The rule is written up at the first overlay's creation site in `Hub.ts`,
and `tools/verify/checkHubInteractionAfterScroll.mjs` is the test that
catches it.

## Docs now owed a pass (not done in this session)

- `Bloom_Wars_Antfarm_Grid_v1.md` — deck geometry, per-deck room counts,
  and the fact that a fixed walled floor plan exists now (still not the
  player-placed system that doc wants; see the addendum's "what this does
  NOT do"). **Closed later the same day — see below.**
- `Bloom_Wars_Antfarm_Carrier_Hub_v1.md` §11.1 — Engineering and the
  Forward Bays now literally hold the reserved-bay markers. **Closed later
  the same day — see below.**
- Codex entries for Heads, Engineering, Forward Bays, the lance berths.
  **Checked, not actually a gap — see below.**
- `chatIntent.ts` room aliases for "heads" / the lance berths. **Already
  shipped — see below.**
- `Bloom_Wars_EA_Launch_Plan_31Aug2026.md` — none of today's Hub work was
  in the 8-week schedule as written, and it was built anyway, deliberately.
  **Closed later the same day — see below.**

## What shipped, 3 Sep 2026 (later still) — Vault Phase 2, both slices, and a naming cleanup

**Vault Phase 2 ("the shelf") is now fully shipped**, closing out all four
Vault phases from `Bloom_Wars_Vault_Build_Plan_v1.md`. Two slices:

- **Slice 1** (earlier, 2 Sep 2026): wired 5 of the ~28 Heirloom combat
  abilities into real effects — `oath_iron_word`, `lastword_field_triage`,
  `farsight_signature`, `salt_root_salt`, `ledger_overextended`.
- **Slice 2** (this session): built the shop UI itself in `Hub.ts`'s
  Vault overlay — a `[ field ]`/`[ unfield ]` toggle and a per-ability
  rank-up shop, honestly gated: only the 5 live abilities get a buy
  button, the other 23 show "(not implemented in combat yet)" with none.
  `HEIRLOOM_ABILITIES_LIVE_IN_COMBAT` (`data/heirlooms.ts`) is the single
  source of truth for which is which.

Full account, including a live-browser Playwright click-test of the real
field/rank-up buttons (not just calling the handlers):
`Bloom_Wars_Build_Log_Addendum_VaultPhase2Slice2_03Sep2026.md`. The Vault
Build Plan's own §11 now records this status.

**"BACK TO HANGAR" renamed to "BACK TO THE CARRIER"** (`Hub.ts`, Maxime's
call) — the button jumps to the separate Hangar SCENE ("CAMPAIGN SHOP"),
not the Hub's own internal "Hangar Deck" ROOM, and the old label read as
if it meant the latter.

**Verification:** `tsc`, `eslint`, `vite build` clean; **74 files / 1758
tests** (up 1 from the ship-interior pass's 1757); live-browser Playwright
checks for both the Vault shelf and the renamed button, zero console
errors. Both changes committed to device with fresh drift guards.

## Correction to this note's own "Docs now owed" list, above

Two of the five items that list named turned out to be already closed, on
inspection rather than assumption:

- **`chatIntent.ts` room aliases for "heads"/the lance berths — already
  shipped.** `KnownUnbuildableId` picked up `"heads" | "berths"` the same
  day this note was written (see that file's own 3 Sep 2026 comment) —
  a player asking the CO to build a bathroom or a bunk room now gets an
  honest "already built, nothing to build" answer, same pattern as the
  Rec Room and Mek Workshop.
- **Codex entries for Heads, Engineering, Forward Bays, the lance
  berths — checked, and this isn't actually a gap.** Every Codex category
  that exists (Systems, World, Glossary) covers diegetic game knowledge —
  mechanics, lore, jargon — gated on mission unlocks. None of it is
  physical-room descriptions, and no other Hub room has a Codex entry
  either: not the Rec Room, not the Vault, not the Workshop, not CIC/
  Bridge. There's no established category these four rooms would fit
  into without inventing one — which nothing has asked for. Recorded
  here so this doesn't get re-flagged as an open item next time someone
  reads this note's own list.

The other two closed items — `Bloom_Wars_Antfarm_Grid_v1.md`'s deck
geometry/room-count update and `Bloom_Wars_Antfarm_Carrier_Hub_v1.md`
§11.1's room-to-bay mapping — were both closed earlier this same session
(see those docs' own 3 Sep addenda, and `Bloom_Wars_Antfarm_Grid_v1.md`
§3f / `Bloom_Wars_Antfarm_Carrier_Hub_v1.md`'s closing addendum for the
"wall is better" resolution specifically).
`Bloom_Wars_EA_Launch_Plan_31Aug2026.md` also already carries its own
addendum recording the ship-interior detour.

**Net effect: every item this note originally flagged as owed is now
closed**, one way or another — three by doc updates, one by code that
had already shipped, and one by turning out not to be a real gap.
