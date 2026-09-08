# Build Log Addendum — Carrier Scale-Up, Phases 1 and 2, 3 Sep 2026

Both phases of `Bloom_Wars_Carrier_Scale_And_Lance_Workshop_Plan_v1.md` are
built, verified and committed to the device. Maxime's instruction for the
session was "keep working on the hub," then "keep going until the hub is
completed. if there is ambiguity. you have the right to make call," then,
going to sleep: "i wana wake up to the hub done and a report." Every open
question this touched is answered below with the reasoning, not just the
outcome — the calls were mine to make, so they're worth being able to
disagree with.

## Phase 1 — bigger decks, camera scrolls inside them

Each deck's walkable floor went from roughly 780x466 to **1650x1350** world
pixels, and the Hub grew a real camera that follows the player and clamps
to whichever deck is active.

- `DECK_FLOOR_RIGHT`/`DECK_FLOOR_BOTTOM` (1650/1350) are new shared
  constants; `GROTTO_BOUNDS`, `LOWER_BOUNDS`, `UPPER_BOUNDS` and
  `SPAR_ROOM_BOUNDS` all read from them. The Spar Room finally got the hull
  pass its own 28 Aug comment said a later pass could give it.
- `ROOM_BOUNDS`, `ROOM_ZONE_BOUNDS`, `RESERVED_BAYS`, the doors and every
  existing landmark are **untouched**. The original room grid still tiles
  the same box it always did, in the same place; all the new floor is
  strictly added around it, so nothing that was reachable stopped being
  reachable.
- `cameras.main.startFollow(player, true, 0.12, 0.12)` once in `create()`;
  per-deck `setBounds` via a new `deckCameraBounds()` helper called from
  `refreshRoomVisibility()`, which already ran on every stair crossing.
  A soft lerp rather than a hard snap — this is a slow-walk social space.
- The `setScrollFactor(0)` audit the plan doc called for, across every
  fixed HUD element, all nine overlay containers, the chat log panel and
  its geometry mask, the chat DOM input, the footer, the shared MENU
  overlay, `ShopPanel` (via a new passthrough method matching its existing
  `setVisible`/`setDepth` shape) and `HoverTip`.

**Deliberately NOT pinned: the room-note text.** It is repositioned to the
centre of whichever room's zone the player is in — a real world-space
point, not a HUD line. Pinning it would have detached it from the room it
labels the moment the camera moved. Flagged in a comment at the site so a
future "finish the audit" pass doesn't helpfully break it.

**How much bigger is a placeholder.** 1650x1350 is roughly double the old
footprint, picked by pixel-budgeting against the live file — it is not
derived from playtest data, because none exists for it. Worth eyeballing
and adjusting; it's two constants.

## Phase 1's own bug, found before it shipped

`hoveredNpc()` and the room-name half of `hubHoverLines()` compared the raw
**screen** pointer position against **world** positions. That was invisible
for as long as the camera never moved (screen and world were the same
numbers) and silently wrong the instant it did. Fixed with new
`pointerWorldX`/`pointerWorldY` fields captured from `p.worldX`/`p.worldY`
in the same `pointermove` handler; the `hoverTip.show()` call still takes
screen coordinates, correctly, because it positions a box on screen.

Same class of latent bug in the shared `MenuOverlay`: its backdrop used
`camera.centerX/centerY`, a **world** midpoint that only equalled plain
screen centre because nothing in this codebase had ever moved a camera.
Under a now-pinned layer that double-counts the scroll. Swapped for
`width/2, height/2`. A no-op for MapSelect/Hangar/Debrief.

## Phase 1's real regression, caught by a live click-test only

This is the one worth reading. **Phaser renders a container's children
using the CONTAINER's scroll factor, but hit-tests them using each CHILD's
own** (`ContainerWebGLRenderer` multiplies child x container;
`InputManager.hitTest` reads only `gameObject.scrollFactorX`). So pinning
the containers made every overlay *draw* correctly while every interactive
element inside them *took clicks somewhere else entirely* — off by exactly
the camera's scroll. The MENU button, every overlay's close and help
button, the peg dots, the workshop and vault rows, the poker and darts
controls: all of it looked perfect and quietly ignored the player.

`tsc`, `eslint` and all 1607 unit tests passed clean the entire time it was
broken. Nothing but a live click-test could have found it, which is exactly
the argument the plan doc made for requiring one.

Fixed by giving every interactive element its own `.setScrollFactor(0)` at
creation — including the ones rebuilt on every render (workshop modules,
vault offers, shop rows), because a one-time sweep over a container only
ever fixes whichever batch happened to exist when it ran. `makeShopButton`
now inherits its host layer's factor, which fixes every shop-style button
in the game at once and stays a no-op in the three scenes whose cameras
don't move. The rule is written up at the first overlay's creation site in
`Hub.ts` so the next person to add an overlay element sees it.

## Phase 2 — one Mek workshop per lance

Two new rooms, `workshopB` (2ND LANCE WORKSHOP) and `workshopC` (3RD LANCE
WORKSHOP), both on the upper deck, each a 420x444 copy of Lance A's own
workshop footprint, stacked in a column at x=900 — entirely inside the
floor Phase 1 opened up, which is why Phase 1 had to land first.

- `lanceOfPilot`/`lanceOfMek` are new exported, unit-tested functions in
  `campaignState.ts` (8 new tests, including one asserting the five static
  rosters never overlap). They answer for **both** campaigns — House
  Amaranth has two lances and no third, and a Warden-only check would have
  silently misfiled every House Amaranth pilot.
- Mek seeding is partitioned by lance. The five hand-placed Act I Meks keep
  their own hand-picked spots in Lance A's workshop unchanged.
- Measured on the standard 15-pilot midgame save: Lance A's workshop went
  from holding **all 15** Meks to holding **5**, with 5 and 5 in the new
  rooms and zero misfiled.

### Open questions from the plan doc, answered

**Cost/gating — the doc recommended CO-built, I shipped free and always
present.** The rooms exist from the start of every campaign, like every
other room on the ship, and populate when their lance integrates. Three
reasons. Gating the *fix for overcrowding* behind an optional chat request
risks not fixing it at all for a player who never asks. The build economy
is about ship upgrades that do something mechanical, and "where do these
units stand" isn't that. And it needs no new persisted state, so no save
migration on the way into an EA window this feature isn't even scheduled
in. The CO-built version is still available as a follow-up if the *beat* is
what's wanted — nothing here forecloses it.

**Renaming — the existing Workshop keeps its name and id.** Half of
`Hub.ts` references `workshop` by name, plus its bench, codex entries and
chat keywords. Renaming it to "Lance A Workshop" is churn for a cosmetic
gain the plan doc itself left open.

### Phase 2's own regression, also caught live

A Mek whose home is a *different room on the same deck* never walked there.
The Mek-confinement branch only knew how to travel by `nextHopDoor`, which
correctly returns undefined for a same-deck pair (there's no door — it's
one open floor). Left alone, a Second Lance Mek walking home from the Rec
Room would come up the stairs, land inside Lance A's workshop, find no
route to its own room and stop there permanently — the wrong room, and a
fresh little crowd in the exact room this plan exists to thin out. Fixed
with a new `walkToRoomTarget()`: direct walk when the target shares the
deck, existing door hop when it doesn't. Verified live: a displaced Mek
crosses the deck and arrives.

### One more thing a screenshot caught

The new rooms' note read "Empty until they come aboard" — printed across
the middle of a room with five Meks standing in it, in a save where that
lance is very much aboard. Room notes are now resolved through a
`roomNote()` method that drops that line once the lance is actually there.

## The Hub's own NPCs actually use the new space

The plan doc assumed "NPC roaming should mostly just work... a bigger deck
bound is more likely to just mean NPCs have more room to wander." Half
true, and worth stating plainly because the half that was wrong is the half
the whole plan is for: NPC "explore" only ever picked a *named room* and
then a point inside that room's small zone, and the mingle/clique/rival
branches only ever walk toward another NPC. Nothing sent anyone into open
floor, so bigger decks alone would have changed what the *player* can walk
on and nothing at all about where the crowd stands.

Added: `EXPLORE_OPEN_FLOOR_CHANCE` (0.3 of explore rolls, so roughly 4-5%
of idle ticks) sends an idle pilot to a random point on their own deck's
open floor instead of to a named room, via a new `pickOpenFloorPoint()`
that reuses `deckCameraBounds` rather than adding a third copy of the same
per-deck branch. Meks are excluded — they're confined by `homeRoom` and
never reach that branch. The honest trade-off, written at the call site:
this *can* fire when a real need is pulling an NPC somewhere, but
`biasRoom` was already only a weighted nudge, never a guarantee, so it adds
one more possible miss at roughly the same order of magnitude rather than a
new kind of behaviour. 0.3 is a placeholder.

## Verification

Static, on the final state: `tsc --noEmit` clean, `eslint .` clean,
`lint-cast-collision` clean (33 reserved names), **73 test files /
1607 tests passing** (up 8 — the new lance tests), `vite build` clean.
`lint-spoiler` skips in the sandbox (no `BW_RESERVED_TERM` set), same as
every prior sandbox run.

Live, in a real browser against the real dev server, with the standard
seeded 15-pilot midgame save — three new scripts in `tools/verify/`, all
documented in that directory's README:

- `checkHubCameraScroll.mjs` — camera follows real WASD movement and stays
  clamped; a point deep in the new floor (1500,1200) is genuinely walkable
  with the camera correctly pegged to the deck's own edge rather than
  centring; a deck switch re-clamps to the new deck's bounds; hovering an
  NPC after the camera has scrolled still identifies the right one.
- `checkLanceWorkshops.mjs` — the 5/5/5 distribution and zero-misfiled
  numbers above, cross-checked against the real exported `lanceOfMek`
  imported inside the page; the new rooms resolve by zone and title; a
  displaced Mek walks home across the deck.
- `checkHubInteractionAfterScroll.mjs` — the one that caught the click
  regression. World-space NPC clicks, the screen-fixed MENU button and its
  overlay's alignment, the chat DOM input's position, and a canvas
  overlay's position, all with the camera deliberately scrolled off.

Zero browser console errors in every run.

## Still open, deliberately

- **Both placeholder numbers** (deck size, open-floor roam chance) want a
  real playtest, not another opinion.
- **The rest of the Playwright backlog** in `Consolidated_Build_Plan_Progress.md`'s
  "Cross-cutting still-open item" is untouched by this pass: recruit names,
  the original far-side door-landing bug, hangar click-through and depth,
  hold-zone visibility, the NPC bubble-crowd throttle, Battle's Tab-cycle,
  Rec Room table/boredom/spar. The harness makes each one cheap now.
- **A pre-existing cosmetic bug, found and left alone:** `showSaveAsOverlay`
  in `ShopPanel.ts` still hardcodes a 960x640 backdrop centred at (480,320)
  — an old canvas size the 30 Aug Tier 6 hotfix updated everywhere else and
  missed here. It leaves an undimmed strip on the right at the current
  1074x640. Out of scope for this pass, worth a one-line fix.
- **The bigger continuous-scroll carrier** (no more stairs) remains the
  larger option the plan doc parked, untouched.
- **No codex entries** were written for the two new rooms.
