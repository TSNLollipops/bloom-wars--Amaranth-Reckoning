# Live-browser verification harness (Playwright)

Answers the progress doc's own "Cross-cutting still-open item": every UI
change this whole build has shipped on logic-tracing + typecheck/lint/test
alone, never actually clicked in a live browser. This is real click-testing
against the actual running game, not a mock.

## What's here

- `genSave.ts` — builds a realistic **midgame** save (all three lances
  integrated, 15 pilots / 10 meks — Tier 3's own "15-20+ pilots" scale, not
  the thin 5-pilot Act I start) and writes it to `save.json`. Run with
  `npx tsx tools/verify/genSave.ts` whenever you need a fresh one (it's not
  committed — regenerate it).
- `checkHubNpcs.mjs` — boots the real dev server's page in headless
  Chromium, seeds `localStorage` with `save.json` before the game's first
  script runs (`addInitScript`), clicks CONTINUE, lands in the live Hub
  scene, then samples `window.__bwGame`'s real NPC list every 6s for ~84s
  of real Hub time. Reports, per NPC: rooms visited, total movement in
  pixels, whether `stuckMs` ever went meaningfully above
  `STUCK_TIMEOUT_MS`, and whether any 2+ NPCs sat within 20px of each
  other in the same room for nearly the whole window (a real door-cluster
  pile, not a passing overlap). Writes `report.json` (full samples) and
  two screenshots (`hub_start.png`/`hub_end.png`) for a visual gut-check
  alongside the numbers.
- `checkDebriefAndMinigameGate.mjs` — 2 Sep 2026, same save/boot pattern as
  `checkHubNpcs.mjs`. Drives the REAL chat UI (T, type, Enter — not a
  bypassed `submitChat()` call) to confirm: asking the CO for a "brief"/
  "debrief" with no mission flown yet gets an honest "nothing to report"
  line; with a win/loss on record, a real mission-echo reaction in his own
  voice; asking anyone else redirects to the CO. Also calls the real,
  committed `runNpcEncounter` directly 300 times against two NPCs forced
  into Hangar Deck to confirm the ambient encounter roll never narrates
  pegBoard/poker/fletchers outside the actual Rec Room (waiting on the real
  ambient cooldown/proximity timers for even one natural trial would take
  real wall-clock minutes, let alone 300). Writes `debrief_report.json` and
  two screenshots (`debrief_start.png`/`debrief_end.png`).
- `checkSocialActions.mjs` — 2 Sep 2026, same save/boot pattern again.
  Exercises the whole crew-interaction brainstorm pass (Gift/Praise/
  Insult/Apology/Congratulate/Send-Off, named chat targeting, CO Confide,
  and the Insult Tier-3 CO call-out + remove-pilot resolution) through the
  REAL chat UI end to end — never a direct call into a verb handler. This
  is the run that caught a real production bug before it shipped: the
  first pass's named-targeting test false-matched on a shared rank prefix
  ("Spec." resolving as if it were a given name), traced to
  `extractNamedTarget` stripping punctuation from a word instead of
  dropping rank tokens entirely — fixed to mirror `TransporterPad.ts`'s
  own `pilotInitials()` convention, re-verified clean. Also drives all six
  insults of the Tier-2/Tier-3 escalation ladder as six separate real chat
  round-trips, re-isolating the target NPC's position before each one to
  guard against live roaming drift over that many real wall-clock
  round-trips. Writes `social_report.json` and two screenshots
  (`social_start.png`/`social_end.png`). Full account, including the bug
  and its fix: `claude/Bloom_Wars_Build_Log_Addendum_CrewInteractionsBrainstorm_02Sep2026.md`
  in the Project.
- `checkCalendarClock.mjs` — 2 Sep 2026, same save/boot pattern again.
  Verifies the calendar economy (the real-time campaign-day clock). Scoped
  deliberately to what unit tests *cannot* reach: that Phaser's real update
  loop actually drives the clock, that the rate maps correctly onto real
  elapsed wall-clock, that the clock keeps running with the chat box open
  (it's ticked above `Hub.update`'s overlay early-returns on purpose — "the
  calandar run when you play. no matter what you do"), and that a real
  chat-driven verb pays its accent through `logVerbAndCharge`. This is the
  second run in this harness's short life to catch a real defect before it
  shipped, and a decent argument for the whole approach: every unit test
  passed while the live browser measured the Hub crediting only **~41%** of
  real elapsed time on ordinary frames — and ~100% with the chat box open,
  where `Hub.update` returns early and frames are cheap. Cause: Phaser's
  `delta` is smoothed and clamped, so a heavy frame under-reports how much
  time actually passed. That would have shipped a calendar running at a
  speed set by the player's frame rate, slower on a weak machine than a fast
  one — the opposite of the "inevitable clock" it's meant to be. Fixed by
  measuring wall-clock directly (`calendarClock.ts`'s `measureRealDelta`),
  re-verified at ratio 1.00. Writes `calendar_report.json` and two
  screenshots (`calendar_start.png`/`calendar_end.png`).
- `checkHubCameraScroll.mjs` — 3 Sep 2026, same save/boot pattern again.
  Verifies Carrier Scale-Up Plan v1 Phase 1 (the scrolling-camera, bigger-
  deck-floor pass — see `claude/Bloom_Wars_Carrier_Scale_And_Lance_Workshop_Plan_v1.md`
  in the Project for the authorizing doc). Checks, against the real running
  scene: the camera actually scrolls as the player walks (real WASD input,
  not simulated); a direct teleport to a point deep in the new floor
  (1500,1200 — past the old ROOM_BOUNDS edges of 830/552) proves that
  space is real and walkable, and that the camera follows there and stays
  correctly clamped to the deck's own (now much bigger) bounds — including
  correctly pegging against the deck's own edge rather than centering,
  when the player is close enough to a corner that centering isn't
  possible; a door hop to a DIFFERENT deck (grotto) re-clamps the camera
  to grotto's own bounds, not a stale copy of the lower deck's; and —
  the one real regression risk this pass introduced and fixed in the same
  commit — hovering a real NPC after the camera has scrolled away from
  (0,0) still identifies the correct one, proving the pointer world-space/
  screen-space fix (`pointerWorldX`/`pointerWorldY`) actually works and
  isn't just correct on paper. Note in the report, not a bug: the organic
  WASD-walk portion can legitimately cover very little ground in 6 real
  seconds if the seeded 15-pilot roster is crowding the spawn rooms — real
  pre-existing NPC collision, and exactly the crowding problem this whole
  pass exists to relieve, not a Phase 1 regression; the direct-teleport
  check is what actually proves the bigger floor and camera clamp, free of
  that pathing luck. Writes `camera_report.json` and four screenshots
  (`cam_start.png`/`cam_scrolled.png`/`cam_new_floor.png`/`cam_grotto.png`).

- `checkLanceWorkshops.mjs` — 3 Sep 2026, same save/boot pattern again.
  Verifies Carrier Scale-Up Plan v1 Phase 2 (one Mek workshop per lance).
  The seeded save is the full three-lance 15-pilot midgame, which is
  exactly the roster the phase exists for: before it, all 15 Meks stood in
  one 420x444 room. Checks that every Mek is in ITS OWN lance's workshop
  (cross-checked against the real exported `lanceOfMek`, imported inside
  the page from Vite so it's the same module the game is running — a
  second copy of the rule in the test could agree with itself while both
  are wrong); that all three workshops are actually populated; the real
  before/after crowd figure for Lance A's room; that the new rooms are
  genuine walkable floor whose zone and title bar resolve correctly, with
  the camera still clamped to the upper deck; and that a Mek displaced into
  another room ON THE SAME DECK actually walks home rather than parking
  there — the one regression this phase introduced (`nextHopDoor` returns
  undefined for a same-deck pair, so the pre-existing Mek-confinement
  branch had no route to a workshop that isn't across a stair) and fixed in
  `walkToRoomTarget`. That last check runs a deliberately long ~48s window:
  the displacement point is the real upper-deck stair landing, so the Mek
  has to cross the whole original room box through whatever crowd is in the
  way — a short window there measures the crowd, not the fix. Writes
  `lance_report.json` (including per-sample walk traces) and three
  screenshots (`lance_start.png`/`lance_workshopC.png`/`lance_end.png`).

- `checkHubInteractionAfterScroll.mjs` — 3 Sep 2026. The other half of the
  camera-scroll risk: `checkHubCameraScroll.mjs` covers HOVER (a pointer
  position this codebase computes itself), this covers CLICKING (hit-testing
  Phaser does for us, against each object's `scrollFactor` — the exact
  property the Phase 1 pass changed on ~20 objects). **This is the run that
  caught a real regression before it shipped**, and the third in this
  harness's short life to do so: Phaser renders a container's children using
  the CONTAINER's scroll factor but hit-tests them using each CHILD's own,
  so every interactive element inside the newly-pinned overlays — the MENU
  button, every overlay's close/help button, the peg dots, the workshop and
  vault rows, the poker/darts controls — was drawing in the right place and
  taking clicks somewhere else entirely, off by exactly the camera's scroll.
  `tsc`, `eslint` and all 1607 unit tests passed clean the whole time it was
  broken. Fixed by giving every interactive element its own
  `.setScrollFactor(0)` at creation (and having `makeShopButton` inherit its
  host layer's, which fixes every shop-style button in the game at once).
  Checks, all with the camera deliberately scrolled well off (0,0): a
  world-space NPC click provokes THAT NPC; the screen-fixed MENU button
  still opens its overlay; that overlay covers the real canvas rather than
  sitting offset by the scroll (the `camera.centerX/centerY` fix); the chat
  box — a real DOM element, not a canvas object — stays on screen; and a
  canvas overlay (History) renders on screen. Writes
  `interaction_report.json` and three screenshots (`click_npc.png`/
  `click_history.png`/`click_menu.png`).

- `checkHubDoorReachability.mjs` — 3 Sep 2026. Direct answer to the gap
  found by the grotto-to-workshop hotfix (see
  `claude/Bloom_Wars_Build_Log_Addendum_GrottoUpperStairUnreachable_03Sep2026.md`
  in the Project): the up-stair to the Upper Deck sat at a fixed
  `(480, 130)` left over from before Phase 1's bigger decks, and Phase 1's
  own ellipse recompute quietly dragged the grotto's walkable floor out
  from under it — reachable coordinates, unreachable in practice, and
  nothing in this harness or the unit suite ever actually tried to walk to
  a door and check. This script closes exactly that gap, generically, for
  every door: pulls the real `DOORS` table live off the running scene
  (`hub.doorMarkers.map(m => m.def)`, never a hand-copied second table that
  could drift), then for each one forces the player into that door's room,
  clears NPCs off the deck so a collision can't mask or fake the result,
  and calls the REAL `tryMove(dx, dy)` — the exact method every WASD frame
  uses, running the exact `clampToDeckFloor` that broke the grotto's
  up-stair — repeatedly toward the door's own (x, y) until it stops making
  progress, then asks the scene's own `isAtDoor()` whether it recognizes
  where the player landed. Add a seventh door to the game and this picks it
  up automatically, no edit needed here. Writes `door_reachability_report.json`
  (per-door landing point, distance from the marker, pass/fail) and one
  screenshot (`door_reachability_last.png`); exits non-zero if any door
  fails, so it can gate a build the way the lint/typecheck scripts already
  do. Run and passing 6/6 since the same day it was written.
  **Rewritten 3 Sep 2026 (floor-plan pass)**: decks have walls now, so a
  straight-line march at a marker would fail for the honest reason that
  there's a wall in the way. Each door is now approached from a DIFFERENT
  room on its deck, along the waypoints `engine/hubNav.ts` hands back for a
  PLAYER_R body, every leg driven by the real `tryMove()` — so a doorway
  too narrow, a marker behind furniture, or a landing inside a wall still
  fails the way a real player would find out. The corridor stairs need 2
  waypoints (through a doorway); the single-room decks need 0.
- `captureHubDecks.mjs` — 3 Sep 2026, the floor-plan pass. Two jobs. (1)
  Screenshots: every deck framed whole (`deck_<id>_full.png`, camera
  zoomed out, HUD hidden for the capture and restored after) plus three
  gameplay-scale views. (2) The live roaming check that walls-without-
  pathfinding would have failed: samples every NPC for ~40s and reports
  how many changed ROOM (only possible through a doorway now), how many
  changed DECK, whether anyone ever sat stuck past the timeout, and — the
  assertion — that nobody was ever standing inside a wall or a piece of
  furniture (`hubLayout.circleHitsSolid`, imported live). Exits non-zero
  on any body-in-solid, any page error, or zero doorway crossings. This
  run is what caught the "bunk 15px off the wall" trap that became the
  `no trap gaps` unit test. Writes `capture_report.json`.
- `checkDockCameraSplit.mjs` — 3 Sep 2026, Carrier Scale-Up Plan v1 Phase 2.
  Verifies the OVERHEARD/chat UI-camera dock fix: real map content (floor,
  walls, NPCs) was scrolling underneath the screen-fixed OVERHEARD sidebar
  and getting hidden behind its own opaque background once the Hub's world
  got a scrolling camera (Phase 1) — this is the regression report and the
  fix for it (two cameras: a narrowed main/world camera and a second,
  static UI camera owning the dock strip exclusively — see Hub.ts's own
  `DOCK_SPLIT_X` header for the full mechanism). Checks, against the real
  running scene: both cameras' own viewport geometry is exactly the
  expected split (main 0,0,838,640 / UI 838,0,236,640); on EVERY deck
  (lower/upper/grotto/sparRoom), teleporting the player to whatever point
  on that deck would have scrolled real floor content into the old dock
  strip if the viewport weren't narrowed leaves that whole screen strip
  showing nothing but dock chrome — sampled directly off the live canvas
  pixel-by-pixel, not inferred from geometry math alone; opening MENU
  darkens the FULL canvas, dock strip included (the specific risk of
  narrowing `cameras.main`'s own viewport — MenuOverlay.ts's backdrop used
  to read `cameras.main.width/height` for exactly this); T opens the chat
  input in its new position under the OVERHEARD panel and a typed line
  lands in the visible log; and the instructions text (wordWrap narrowed
  900->700 this same pass, a forced fix once its old width could clip past
  the new dock split) fits inside the narrowed viewport without colliding
  with `deckIndicatorText` below it — caught the same way the original
  wordWrap bug was, in a live screenshot, not by eye. Writes
  `dock_report.json` and one screenshot per deck
  (`dock_deck_<id>.png`) plus `dock_start.png`/`dock_menu_open.png`/
  `dock_chat_sent.png`.

### `checkActionBarPaging.mjs` — the Battle action bar's MORE paging (3 Sep 2026)

The first script here that enters **Battle** rather than the Hub, and the
first that boots a mission with `scene.start("Battle", {...})` directly —
the same call `TransporterPad.ts` makes on BEAM DOWN, with the same
arguments, so nothing about the mission is faked. Needs
`genActionBarSave.ts` first: a midgame roster with `last_word` (Migawari /
Osric Ferrow) recruited **and fielded**, since an unfielded Heirloom grants
no combat abilities and the point here is a heavy kit.

Checks three things, and the first is as important as the rest:

1. **Nothing changed for the game as it ships.** The heaviest kit a player
   can actually assemble today is six verbs — exactly the slot count — so
   the bar must draw six real actions and no MORE button. A "fix" that
   spent a slot on paging for every heavy build would be a regression.
2. **Overflow loses nothing.** Two more real ability ids are pushed onto the
   deployed unit in-page (`abil_taunt`, `abil_interdict` — real verbs with
   real `canX()` predicates, so the bar is still built by the real code
   path), taking it to eight. MORE is then clicked with **real mouse
   events at its real screen position**, not by calling `runActionSlot()`,
   and the union of both pages is asserted to equal the whole kit. Clicking
   MORE again must wrap back to page 1; selecting a different pilot must
   reset to page 1.
3. **Labels fit their buttons.** Measured off the live Phaser `Text`
   objects (`label.x`, `label.width` against the button's own bounds and
   the hotkey digit's right edge). This is the check that caught the real
   bug this pass fixed: the label used to be centred while the digit sat on
   the left edge, so the shipping bar for this exact pilot read
   `1OVERWATCH`, `5MIGAWARI` and `6LAST RITES` with the digit fused into
   the L, scanning as "BAST RITES". `tsc`, `eslint` and 1965 unit tests
   were clean through every frame of it — a screenshot is what found it.

**One trap worth writing down for the next Battle script.** The game's
logical coordinate space is **1074x640** (`src/main.ts`), not 960x600.
Scaling a scene coordinate by `box.width / 960` puts a click ~110px off
target, and because a miss on the canvas is a legal board click rather than
an error, the script fails with a confusing "the button did nothing"
instead of anything pointing at the arithmetic. That is exactly how the
first run of this script failed.

Writes `actionbar_base.png`, `actionbar_page1.png`, `actionbar_page2.png`
and `actionbar_paging.png`.

### `auditUiText.mjs` + `sweepUi.mjs` + `checkUiAuditSelfTest.mjs` — the whole-game UI text audit (3 Sep 2026)

Not a check of one feature. A **lint over every screen in the game**, and the
first tool here that can find a bug nobody went looking for.

`sweepUi.mjs` walks 28 screens — every menu, the Codex, Map Select, the
Hangar, the Transporter Pad, Battle (deployed, unit selected, end-turn
prompt), all four Hub decks, and all twelve Hub overlays — screenshots each
one into `ui_sweep/`, and runs `auditUiText.mjs` against the live Phaser
display list at each stop. Four questions, asked everywhere:

| check | question | how |
| --- | --- | --- |
| `OVERRUN` | is a label wider than its button? | geometry |
| `COLLIDE` | do two sibling labels overlap? | geometry |
| `OFFSCREEN` | is pinned text outside the canvas? | geometry |
| `PAINTEDOVER` | did this label's pixels ever reach the screen? | **pixels** |

`PAINTEDOVER` is the one that earns the file. A label can be visible,
opaque, correctly positioned and live-updating, and still be completely
invisible because something drew over it — geometry cannot see that, only
pixels can. It screenshots, hides every candidate label, screenshots again,
and diffs each label's own box.

**What the first full run found**, all live in the shipping game, all with
`tsc`, `eslint` and 1966 unit tests passing:

- **Six invisible Hub HUD readouts** — the room title, the controls line,
  THREAT, Rourke's rank, `Day N` and the DECK indicator, all created at
  depth 0 and painted over by deck floors added later at the same depth.
  `Day N` is the calendar economy's only on-screen output. The controls
  line is the only place the game tells a new player how to move.
  `checkHubCameraScroll.mjs` had been asserting some of those same labels'
  *positions* and passing the whole time.
- **The Transporter Pad unreadable at a full roster** — card pitch is
  available-height ÷ roster-size with no floor, so sixteen pilots got 27px
  each and three lines of type drew through each other and their
  neighbours. The screen you pass through before every mission.
- **`< PREV`/`NEXT >` drawn over the WALKABLE HUB button** in the Campaign
  Shop, clipping it to `BLE HUB (PROTO` — only once the shop needs a second
  page, i.e. only on a mid-campaign roster.
- **"House House Dunmoor"** on the Heirloom shortlist.

Two of those only appear on a **mid-campaign save**, which is why the sweep
runs against `genActionBarSave.ts`'s three-lance roster and not a fresh
one. A fresh save hides exactly the bugs a player hits after twenty hours.

#### Run the self-test whenever you touch the audit

```
node tools/verify/checkUiAuditSelfTest.mjs
```

It breaks the game on purpose — covers a readout, over-wide a button label,
overlaps two siblings, pushes a label off-canvas — and fails if the audit
does not notice, then confirms the real game is clean afterwards.

This is not ceremony. **The audit reported all-clear three separate times
while being broken**: once comparing world coordinates against screen
pixels, once with a grouping key that was not unique so nothing was ever
compared, and once after pausing the scenes *before* enumerating them —
which made `getScenes(true)` return nothing, so it examined zero labels and
reported zero problems. All three looked exactly like success. A green
sweep with a red self-test means nothing.

#### Things learned that will bite the next script

- **The game's coordinate space is 1074x640** (`src/main.ts`), not 960x600.
- **The Hub's OVERHEARD dock renders through a second camera** with its own
  viewport, so its objects' bounds are **dock-local**. Dock and world
  coordinates are different spaces using similar small numbers; comparing
  across them produces confident nonsense. `auditUiText.mjs` partitions by
  `scene.uiCameraObjects` — and note that what gets pushed there is usually
  the *container*, so the space has to be inherited by its children.
- **The Hub re-asserts `.visible` every frame** (`refreshRoomVisibility`),
  so anything that hides an object to measure it must pause the scene first
  — after enumerating, not before.
- **There is no `setDeck()`**: the Hub derives the deck from
  `currentRoomId`, so visiting a deck means setting a room on it and
  calling `refreshRoomVisibility()`.
- **Close overlays between stops.** Leaving them stacked made the sweep
  report 118 buried labels that were only buried by the harness.

- `genHouseAmaranthSave.ts` + `checkHubHouseAmaranth.mjs` — 6 Sep 2026,
  House Amaranth Hub build (`claude/Bloom_Wars_House_Amaranth_Hub_Build_Plan_v1.md`,
  step 5). `genSave.ts` is Warden-only, so the estate gets its own save
  generator (writes `save_house_amaranth.json`; a save with `pilot_marrow`
  is what `baseSceneKeyFor` routes to the `"HubHouseAmaranth"` scene). The
  check boots that save, clicks CONTINUE and proves, against the live scene:
  the save lands in the Greathouse and not the Antfarm (title bar, HUD
  `FLOOR:` line, spawn room); the cast is the estate's (Verinis in the
  Control Room, the three Longhouse regulars seated, Orin roaming, every
  Mek in a Cultivar Works, Marrow NOT on the floor, no Warden pilot leaked,
  every body on walkable floor); all six stairs reachable by real
  `tryMove()` walking from another room on the floor AND actually taken
  with `switchRoom` to the right landing room/floor; every walk-up point
  (roster console, crew records, BAY, standings board, bench, plinth, the
  CO) triggers its own `isAt*()`; the camera clamps to each floor's bounds;
  the centred title clears the `FLOOR:` and `Day` readouts in all 20 rooms
  (the estate's long flavour names are why `Hub.fitRoomTitle` exists); and a
  30s roam sample strands nobody. Writes `hub_house_amaranth_report.json`
  and one screenshot per floor (`hub_ha_rc.png`, `hub_ha_ss1.png`,
  `hub_ha_ss2.png`, `hub_ha_yard.png`) for the eyeball pass.
  `captureHubDecks.mjs` was scoped the same day to the live scene's own
  decks (`hub.f.deckOrder`) — `DECK_LAYOUTS` now holds both facilities'.
- `checkMissionChat.mjs` — 12 Sep 2026. Mission Chat / Player Notes / Battle
  HUD Relayout Plan v1, all four workstreams, live. Boots against
  `missionchat_save.json` (`genMissionChatSave.ts` — the Act I five plus every
  authored 2nd/3rd Lance candidate recruited through the real
  `recruitIntoLance()`, 15 pilots, the three regulars' social state primed
  from the Warden seed so favour deltas have a real "before"). Screenshots
  the relayout on Muster (20x12, 5 pilots) and the two dimension extremes
  (36x14 Falling Back to Meridian, 30x19 Tunnel Rats, 15 pilots each) with
  both columns open, then `[`/`]` collapsed, measuring the live board and
  panel rects against each other and the action-bar labels against their
  buttons; clicks the control strip with the board underneath to prove a
  button click never doubles as a tile click. Then drives the REAL comms
  box (T, text, Enter): `:help`, an unknown command stopping dead, a
  greeting broadcast to all five, a verb with no target refused, a real
  tile click to select Bosk then "well done" (+4 persisted, reply tagged
  with his callsign), the same praise again (+2 — diminishing returns),
  real "1", "2", "3", Space keypresses INSIDE the box (no action slot fires,
  the turn doesn't end), `:t farsight` by callsign, `:t <a Bloom>` refused,
  `:notes <text>` stamped with mission/turn, a bare `:notes` opening the
  in-mission overlay in place (Battle stays active) and Esc closing it,
  Space ending the turn again once the box is closed (capture list
  restored), 14 long lines to overflow the log (bottom-anchored under the
  mask), a `(dialogue)` mission-log line mirrored into COMMS, then the Hub's
  own `:notes` opening the Codex on FIELD NOTES with a real arm-then-confirm
  DELETE. The two bugs this run caught before shipping: Phaser emits
  `keydown-T` BEFORE applying its own capture list, so the T that opened the
  box leaked into it as its first character (fixed with an explicit
  preventDefault in the handler); and a first-pass hotkey legend overran the
  230px column, visible only in the screenshot. Writes
  `missionchat_report.json` and eight `missionchat_*.png`. Uses
  `keyboard.insertText` for message bodies: at this sandbox's ~5fps Battle
  frame rate a per-character `keyboard.type` costs ~400ms a character
  (measured), which is the harness, not the game — the one place per-key
  delivery is the point (the digit/Space leak test) presses real keys.

## A note on speed in the cloud sandbox

Headless Chromium here renders in software and runs the game at roughly
10-15fps (measured on the UNCHANGED code too — it's the harness, not the
game). Phaser's smoothed delta then moves bodies in slow motion (~5px/s
against a 90px/s walk speed), and a fixed "wait 1.2s for the camera lerp"
isn't enough frames. Scripts that care poll for the camera to settle, and
`checkLanceWorkshops`'s walk-home check tops each real 2s window up with
120 explicit `updateNpcMovement(16)` ticks so the walk covers the ground a
real machine would. On Maxime's own GPU none of this applies.

## How to run it

```
npm run dev -- --port 5183 --strictPort &     # or whatever port; edit the
                                                # PORT below to match
npx tsx tools/verify/genSave.ts
node tools/verify/checkHubNpcs.mjs
node tools/verify/checkDebriefAndMinigameGate.mjs
node tools/verify/checkSocialActions.mjs
node tools/verify/checkCalendarClock.mjs
node tools/verify/checkHubCameraScroll.mjs
node tools/verify/checkLanceWorkshops.mjs
node tools/verify/checkHubInteractionAfterScroll.mjs
node tools/verify/checkHubDoorReachability.mjs
node tools/verify/captureHubDecks.mjs
node tools/verify/checkDockCameraSplit.mjs

npx tsx tools/verify/genHouseAmaranthSave.ts  # House Amaranth's own save
node tools/verify/checkHubHouseAmaranth.mjs

npx tsx tools/verify/genActionBarSave.ts     # its own save, not genSave's
node tools/verify/checkActionBarPaging.mjs

node tools/verify/checkUiAuditSelfTest.mjs  # prove the audit can fail...
node tools/verify/sweepUi.mjs               # ...then sweep all 28 screens
```

Chromium's already installed in the cloud sandbox at a fixed path (see
`checkHubNpcs.mjs`'s own `executablePath`) — don't run `playwright install`
there. On Maxime's own machine, plain `npx playwright install chromium`
once is enough; drop the `executablePath` override or point it at whatever
`npx playwright install` reports.

## Why `window.__bwGame` is a real (dev-only) hook, not a leftover debug line

`src/main.ts` sets `window.__bwGame = <the live Phaser.Game>` gated behind
`import.meta.env.DEV` — Vite's own build-time flag, `false` in
`vite build`'s production bundle, so it never ships. This is what lets a
Playwright script read real scene-internal state (NPC positions, `stuckMs`,
room assignments) instead of only screenshotting pixels and guessing.
Reuse it for the next verification pass rather than re-inventing a hook —
any scene's private fields are reachable the same way, e.g.
`window.__bwGame.scene.getScene("Battle")`.

## Extending this to the rest of the backlog

The progress doc's "Cross-cutting still-open item" lists specific UI
changes still owed a real click-test: recruit names, door landing, hangar
click-through, hangar depth, hold-zone visibility, the NPC bubble crowd,
Battle's Tab-cycle, Mek Workshop confinement, Rec Room table/boredom/spar.
Each is a new small script here (or a new function in a shared one) —
seed whatever `CampaignState`/mission the case needs, click through to the
scene, assert on real scene state the same way `checkHubNpcs.mjs` does.
Not all of it is done this pass — see the build log addendum for exactly
what this first pass covered and what's still owed.

- `genFrameSave.ts` + `checkFramePanel.mjs` — 6 Sep 2026, Frame Systems
  Layer Tier 1 (`src/scenes/shop/FramePanel.ts`). Same save/boot pattern.
  Seeds a tier-C Tank with two owned branches and points, a tier-A Meeps,
  and one Wellroot kill on the books, then drives the REAL input: opens
  `[ FRAME ]` from a shop card, mounts a second branch (the live state's
  `equippedWeaponBranches` reads both, the legacy single field reads mount
  1), buys and installs a system (points and the header's Draw readout
  move), confirms the salvage gate (Wellroot Filament buyable after its
  one kill, with the +1 Draw surcharge on a non-Runemaster loadout;
  Gallcyst Graft — the doc's Heartwood Graft, re-sourced 6 Sep 2026 —
  listed and LOCKED 0/1; Stabilizer Struts on the shelf), and
  checks every overlay label sits inside the panel and the canvas. Then
  the same from the Hub's Hangar Deck shop (the 838px dock split — this run
  is what caught the panel double-rendering into the dock strip on its
  first pass, fixed the same way MenuOverlay.ts handles two cameras), buys
  a refit for real, and confirms Esc closes shop and overlay together.
  Finally opens the panel from the Transporter Pad's own `[ frame ]` link.
  Writes `frame_panel_*.png`. Regenerate `frame_save.json` with
  `npx tsx tools/verify/genFrameSave.ts` first.

- `genBrainSave.ts` + `checkBrainArchive.mjs` + `checkBrainDebrief.mjs` —
  12 Sep 2026, the Emotional Brain (`claude/Bloom_Wars_Emotional_Brain_
  Build_Plan_v1_12Sep2026.md`). `genBrainSave.ts` runs the REAL Debrief
  write-back (`engine/debriefCatalyst.ts`) twice against a fresh Warden
  save, a win with a downing and a loss with Bosk permanently lost, so the
  save carries real memories, drift and moved Stress/Morale, never
  hand-written ones. `checkBrainArchive.mjs` opens the Archive on that save
  and asserts the pilot dossier's "Carries" block (three loudest memories
  as dated record lines, the loss flagged), that a struck pilot and the MC
  get none, then screenshots `brainArchive_anand.png` /
  `brainArchive_lask.png`. `checkBrainDebrief.mjs` starts a REAL Battle on
  Mission 1, places a few combat worries on the live Mission the exact
  shape `mission.ts`'s `pushCombatWorry` writes, sets the outcome, uses
  Battle's own hand-off into Debrief, asserts the "WHAT THEY TOOK FROM IT"
  block and that RETURN TO BASE's save carries the new memories, Morale and
  drift; screenshots `brainDebrief_win.png`. Both filter Phaser's
  asset-decode noise when `public/` is absent from a mirror. The bot-side
  view is `npm run sim:brain` (`src/sim/runBrainSim.ts`); its 10-seed
  printout for the build is `brainSim_10seeds_12Sep2026.txt` (+ `.json`).

- `genCapsuleSave.ts` + `checkEjectionCapsules.mjs` — 15 Sep 2026, ejection
  capsules and prisoners (`claude/Bloom_Wars_Build_Log_Addendum_Ejection
  Capsules_15Sep2026.md`). `genCapsuleSave.ts` writes a fresh Warden save
  (`capsuleSave.json`). `checkEjectionCapsules.mjs` starts a REAL Battle on
  Mission 6 "House Colors" (the first Warden mission with human-crewed
  hostiles), downs Iyari and one trooper through the real attack path, then
  by REAL mouse clicks: selects Lask (Munti) and recovers Iyari's capsule,
  selects Bosk (Tank) and takes the trooper prisoner. Asserts the lime and
  salmon highlight sets, the HUD's capsule line and legend, the action cost,
  that a Tank can capture but never recover, the outcome overlay's
  "recovered / prisoner" line, then drives the Debrief PRISONERS panel
  through RECRUIT → the Character Creator → CONFIRM → RETURN TO BASE and
  checks the save gained exactly one G-tier pilot of the trooper's class and
  that the RECRUIT tooltip does not linger. Uses the `headless_shell`
  binary (found by directory scan, not a hardcoded build number). Writes
  `capsules_*.png`. Needs `public/audio/` staged to stay quiet, same as the
  Brain checks.
- `checkDebriefFooter.mjs` — 15 Sep 2026, Debrief footer bleed-through fix
  (`Debrief.ts`: `DEBRIEF_FOOTER_DEPTH`, `DEBRIEF_FOOTER_BAND`). Reuses
  `capsuleSave.json` (run `genCapsuleSave.ts` first), wins Mission 6 with a
  prisoner so the Debrief page is long, then wheels to the very bottom and
  asserts: the page really scrolled, the footer layer draws above every
  shop layer, its backdrop is fully opaque, the lowest shop nav button
  still sits above the footer band at max scroll, and no console errors.
  (Footer depth 5 staying under the Discharge/Frame modals at 10/11 is by
  construction in `Debrief.ts`, not asserted here.)
  Writes `debriefFooter_top.png` and `debriefFooter_bottom.png`.
