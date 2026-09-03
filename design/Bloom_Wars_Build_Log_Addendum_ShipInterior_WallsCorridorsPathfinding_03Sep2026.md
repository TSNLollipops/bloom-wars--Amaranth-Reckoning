# Build Log Addendum — The Ship Interior: Walls, Corridors, Rooms, Pathfinding, 3 Sep 2026

Maxime, after the carrier scale-up: *"i like the hub agrandissement. lets
give it corridor and walls now. delimiting the rooms and placing them
aestetically pleasing way. you can change the layout of the hub as you
please... on the lower floor you can add bathrooms individual lance
berth. add details. have fun."* Plan was sent first and executed as
written; this is the account, with the calls I made and why.

## What shipped

**Two new Phaser-free engine modules**, both unit-tested, both on the device:

- `src/engine/hubLayout.ts` — the whole ship as data. Per deck: outer
  floor (rect, or the grotto's ellipse), every room's walkable interior,
  every wall segment, every doorway, every piece of furniture that blocks a
  body, every purely visual detail, and every landmark coordinate Hub.ts's
  systems key off (muster pad, table + seats, hangar terminal, workshop
  bench, vault plinth, the CO's spot, mek cradle spots, reserved-bay
  markers, stairs and their far-side landings, the player spawn). Rooms are
  authored as outer boxes; walls are 14px bands centred on the box edges so
  adjacent rooms share one wall; doorways are gaps cut from a band; a
  doorway cut in one room's wall is subtracted from the neighbour's copy
  automatically. Furniture pieces are one function each (`bunk`, `stall`,
  `mekCradle`, `console`, `planter`, …) returning both their picture and
  their collision shape, so adding a bunk somewhere is one call, not two
  lists to keep in sync.
- `src/engine/hubNav.ts` — navigation. Each deck is rasterised once into a
  20px grid (a cell is blocked if a body of the given radius at its centre
  would touch a wall/solid or sit outside the floor); A* (8-connected, no
  corner cutting, binary-heap open list) finds a cell path; a
  line-of-sight pass pulls it taut into a few straight legs. `findPath`
  returns `[]` for "already in line of sight" and `null` for "no route".

**Hub.ts changes**, in order of how much they matter:

1. `clampToDeckFloor` now runs `resolveAgainstSolids` after the floor clamp.
   That one function was already the funnel every world position flows
   through (player steps, NPC steps, door landings, spawn picks, roam
   targets, the muster pad, `pickClearPoint`), which is the reason walls
   only had to be added in ONE place to apply everywhere. Axis-separated
   movement turns the push-out into wall sliding for free.
2. `updateNpcMovement` paths. The first frame an NPC has a target it asks
   `findPath` for waypoints (cached per target, dropped on arrival, give-up
   or target change) and steers at the next waypoint instead of the target.
   None of the ~10 sites that set `targetX` changed. A `null` path falls
   back to the old straight line and the stuck timeout.
3. The geometry constants are gone — `ROOM_ZONE_BOUNDS`, `GROTTO_BOUNDS`/
   `GROTTO_ELLIPSE`, `LOWER/UPPER/SPAR_ROOM_BOUNDS`, `DECK_FLOOR_*`,
   `ZONE_SPLIT_*`, the hand-typed `DOORS` coordinates, `RECROOM_TABLE`,
   `HANGAR_SHOP_POINT`, `WORKSHOP_BENCH_POINT`, `VAULT_PLINTH_POINT`,
   `MUSTER_POINT`, the CO's `coPos`, the three seats, the five Act I Mek
   spots, the six reserved-bay marker positions, the player's fixed
   `(480,330)` spawn. Every one now derives from `hubLayout.ts`.
   `ROOM_BOUNDS` survives under its old name as the OVERLAY box (poker,
   darts, peg board, workshop, vault, history, highlights, help all draw
   inside it in screen space) — ~40 call sites, none of them world geometry
   any more; its comment says so.
4. New rooms and RoomIds: `berthsB`, `berthsC` (one berth per lance),
   `heads` (the ship's bathrooms), `engineering` and `forwardBays` (the
   reserved-bay markers now stand in real rooms), `lowerHall`/`upperHall`
   (the spine corridors, real zones so the title bar and every "which room
   is this body in" check has an honest answer mid-walk). `RoomId`/`DeckId`
   moved into `hubLayout.ts` so the tests can name rooms.
5. Per-lance berths: `LANCE_BERTHS` + `isBerths()`. Sleep restores in ANY
   berth room (forgiving); a sleepy NPC is BIASED to its own lance's
   (`needRoomFor` resolves `NEED_ROOM.sleep` per NPC; `pickExploreTarget`'s
   `BERTHS_EXPLORE_WEIGHT` bump goes only to the NPC's own berths). Ask Out
   and the intimacy breakdown accept any berth room, and require the
   partner to be in the SAME one.
6. `ROAMABLE_ROOMS` — corridors are never roam destinations or spawn rooms.
7. Rendering: `drawDeckLayout(deck)` builds one Container per deck (hull
   shell, floor, per-room tints, 48px plating grid, corridor centre line,
   furniture, doorway thresholds + jambs, bevelled walls, a name plate per
   walled room centred ON its bow wall band). The four plain floor
   rectangles, `drawGrottoFloor` and the dashed `buildZoneDecor` dividers
   are gone. Stairs are drawn as stair wells with treads and an arrow plate.
8. `roomDeckOf(room)` — a tiny public accessor for the verify scripts.

## The layout (top of screen = bow)

Every rectangular deck is 1500x960 (`60..1560 x 100..1060`) with a 96px
spine corridor across the middle (`y 420..516`) and stairs at the corridor
ends. The old 1650x1350 placeholder had a lot of empty scroll; this is
sized to the plan.

- **Lower deck — crew.** Forward row: Berths 1st/2nd/3rd Lance (six bunks
  each, lockers), Heads (three stalls, three sinks with a mirror, three
  showers), Engineering (Generator/Fabricator/Restock markers, pipe runs).
  Aft row: Rec Room (galley counter with burners and a serving hatch, the
  round table with the three regulars' seats on its rim, three booths, a
  lounge corner with couches and a wall screen, vending, and CARDS / PEGS /
  DARTS on the aft wall where the minigames live in fiction) and the
  Hangar Deck (roster terminal by the west door, staging lanes, the muster
  ring around the BAY pad with a taxi lane to hazard-striped bay doors,
  three mech cradles, fuel drums, tool chests). Grotto stair at the west
  end of the corridor, Spar Deck stair at the east end.
- **Grotto — the CO's post.** Oval, two doors (settled 28 Aug), now
  1120x820 instead of 1610x1250. Dais at the centre with the CO on it,
  reflecting pool behind, six planters, moss patches, a bench, and a
  flagstone path from the west stair past the dais to the east stair.
- **Upper deck — operations.** Forward: the Vault (heirloom strip on the
  bow wall, four display cases, a rug under the plinth, a safe-deposit
  column), CIC/Bridge (main display, six consoles with chairs, a tactical
  table, two side consoles), Forward Bays (Sensor/Weapons/Beacon markers).
  Aft: the three lance workshops, each with five mek cradles flush to the
  aft wall behind a hazard apron, a lift pad, parts crates, tool chests;
  Lance A's also holds the carrier-module bench. Grotto stair at the west
  end, stacking with the lower deck's.
- **Spar deck.** 960x660 gym: a roped ring (mat walkable, only the four
  posts block), benches, lockers, two heavy bags, a mat area, a weight
  rack, a standings board, a water cooler.

## Calls I made (yours to disagree with)

**The launch BAY moved from the Rec Room to the Hangar Deck.** It had been
a "placeholder stand-in for an actual bay/door" since 26 Aug, in the one
room the game had then. With a hangar on the same deck, a deploy pad in
the lounge was the leftover, not a design. `MUSTER_ROOM` is `"hangarDeck"`
now; every consumer already read the constant, so it's two lines.

**Corridors are real rooms (RoomIds), not gaps.** The alternative — let
`zoneAt` snap a corridor point to the nearest room — would have had the
title bar read "REC ROOM" while you're in the hallway, hunger ticking as if
in the Rec Room, and Meks counted as "home" while walking past. A named
zone costs two RoomIds and one exclusion list.

**Furniture is either flush to a wall or a full body-width clear of it.**
Found live, not guessed: the first roam capture flagged two NPCs "inside a
solid" — bunks 15px off a wall, a slot a body gets pushed INTO by one shape
and OUT of by the other, forever. `resolveAgainstSolids` can't converge on
that. It's a unit test now (`no trap gaps`): any 3–37px slot between two
blocking shapes, not already filled by a third, fails the build. Every
piece was re-placed to satisfy it.

**The deck shrank.** 1650x1350 was a placeholder from the scale-up pass;
"how much bigger" was explicitly a number to revisit. The plan needs
1500x960 and fills it.

**The grotto keeps its oval and two doors** (Maxime's 28 Aug call), sized
as a room.

**No cost/gating on the new rooms**, same reasoning as the per-lance
workshops earlier today: berths and heads are where a crew lives, not ship
upgrades that do something mechanical. The build economy is untouched.

## What this deliberately does NOT do

- **No "build your ship" placement.** The Antfarm Grid doc's §3d/§3e
  player-placed layout is still paper. This is a hand-authored fixed plan —
  but authored as the exact data structure a placement system would emit,
  so that system replaces a human typing coordinates, not this code.
- **The player has no pathfinder.** WASD + wall sliding. Only NPCs path.
- **No continuous-scroll ship.** Stairs still teleport between decks.
- **No codex entries** for Heads, Engineering, Forward Bays, the lance
  berths, or the corridors.
- **No new chat keywords** for the new rooms (`chatIntent.ts`'s room
  aliases are untouched — "heads"/"berths" don't route anywhere yet).

## Verification

Static, on the final state: `tsc --noEmit` clean, `eslint .` clean,
`lint-cast-collision` clean (33 reserved names), `vite build` clean,
**74 test files / 1757 tests passing** (up 150: `hubLayout.test.ts` —
geometry sanity, every landmark on free floor, every stair marker and
landing walkable, every room reachable from every other room on its deck
by a real `findPath`, one connected floor component per deck, the
trap-gap rule, and the push-out math). `lint-spoiler` skips in the sandbox
(no `BW_RESERVED_TERM`), same as every prior sandbox run.

Live, in headless Chromium against the real dev server with the standard
15-pilot midgame save:

- **`captureHubDecks.mjs` (new)** — the screenshots you have, plus the
  roam check: 30 NPCs sampled for 40s, 5–8 of them changed ROOM (only
  possible through a doorway now), nobody ever inside a wall or furniture,
  nobody stuck past 4s, zero page errors. It's this run that caught the
  trap-gap bug above.
- **`checkHubDoorReachability.mjs`** — rewritten to approach each stair
  from a DIFFERENT room on its deck along `hubNav` waypoints, driving every
  leg with the real `tryMove()`: **6/6 reachable**, the corridor stairs
  through a doorway (2 waypoints), 0px from the marker.
- **`checkLanceWorkshops.mjs`** — 5/5/5 Meks, zero misfiled; a Lance B Mek
  displaced into Lance A's workshop **walked out its door, along the
  corridor and in through its own** (PASS, was PARTIAL before the harness
  fix below).
- `checkHubCameraScroll`, `checkHubInteractionAfterScroll`,
  `checkMusterMekAck` (MEK PASS / PILOT PASS), `checkHubNpcs`,
  `checkDebriefAndMinigameGate`, `checkSocialActions`, `checkCalendarClock`
  — all pass, zero console errors.

### Harness findings, separate from the game

- **Headless Chromium here runs the game at ~10–15fps** (software
  rendering; measured identical on the UNCHANGED code), and Phaser's
  smoothed delta then moves bodies at ~5px/s against a 90px/s walk speed.
  `Hub.update` itself costs 0.75ms/frame, rendering 3ms — it isn't the game.
  Scripts that care now poll for the camera to settle instead of waiting a
  fixed 1.2s, and the walk-home check tops each 2s window up with 120
  explicit 60fps movement ticks. Written up in the README.
- **Five older verify scripts had hardcoded absolute paths from earlier
  sandboxes** (`/home/claude/bloomwars/...`, `/mnt/user-data/uploads/...`)
  and couldn't run anywhere else. All now resolve relative to the script.
- `checkMusterMekAck` parked the player exactly ON the NPC it then expected
  to walk — which pins it (`tryMoveNpc` refuses any step within
  NPC_R+PLAYER_R of the player). Player now stands 60px beside it.
- Stale geometry in `checkHubCameraScroll` (a `(1500,1200)` teleport, a
  hand-copied door), `checkLanceWorkshops` (`x>=900` as "the workshop
  wing"), `checkSocialActions` and `checkDebriefAndMinigameGate`
  (teleports to old coordinates) — all read the live layout now.

## Still open, deliberately

- **Playtest the feel.** Corridor width (96px), doorway width (84/110/120),
  deck size, NPC walk speed through doors — all placeholders picked by
  pixel-budgeting, none by play. The layout is data; every number is one
  edit.
- **Two NPCs meeting in a doorway** rely on the old stuck-timeout sidestep
  to resolve. It works (nobody stuck >4s in any run) but it's a shove, not
  manners. A "wait for the doorway to clear" rule is a small follow-up.
- **The room-note text** still positions at each room's centre, which on
  the spar deck lands on the ring. Cosmetic.
- **`showSaveAsOverlay`'s 960x640 backdrop** in `ShopPanel.ts` — the
  pre-existing cosmetic bug from the scale-up log, still untouched.
- **Docs owed:** `Bloom_Wars_Antfarm_Grid_v1.md` (deck geometry, room
  count, the fact that fixed walls exist now), `Bloom_Wars_Antfarm_Carrier_Hub_v1.md`
  §11.1's room-to-bay mapping (Engineering and Forward Bays now literally
  hold the markers), codex entries for the new rooms, `chatIntent.ts` room
  aliases for heads/berths.
