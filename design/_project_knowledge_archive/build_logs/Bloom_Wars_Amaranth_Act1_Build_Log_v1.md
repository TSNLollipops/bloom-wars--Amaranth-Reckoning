Bloom Wars — Amaranth Act I Build Log (v1)

*22 Aug 2026. What got built, into the actual `bloom-wars` repo (not just design docs), for Maxime's request: "a working build for amaranth mission 1-4, with the UI and everything," to playtest before art goes in.*

## What this is

Missions 1-4 of Act I ("The Fallow Line") of *The Amaranth Reckoning* —
the independent, non-canon 36-mission campaign concept in
`claude/Bloom_Wars_Independent_Campaign_The_Amaranth_Reckoning.md` — built
on top of the existing engine (the same one that runs the Team One
4-mission vertical slice) and reachable in-game from the mission-select
screen. Same placeholder-geometry rendering as the rest of the repo; no
sprites yet, on purpose, per Maxime's own plan ("see if that works, then
add sprites and art then retest").

Per that design doc's own §3 scope note, Act I needs **no new engine
systems** — every mission here uses objective types the engine already
had (`eliminate_all`, `hold_zone`) and Bloom archetypes already in
`data/bloom.ts` (Crawlmass, Splitfang, Undertow). That's what kept this a
data-and-wiring pass rather than a rules-design pass.

## Missions built

| # | Name | Objective | Map | Enemy |
| --- | --- | --- | --- | --- |
| 1 | Muster | eliminate_all (turn 8 = bonus target, not a fail line — see below) | open border-post ground, 14×9 | 6 Crawlmass |
| 2 | Wire and Mud | hold_zone (hold from turn 6, limit 10) | listening post with a single-tile doorway, 16×10 | 6 Splitfang (staggered) |
| 3 | The Low Ground | eliminate_all (turn 12 = bonus target) | heavy bloom-mat terrain, 18×11 | 8 Crawlmass + 2 Splitfang |
| 4 | Tunnel Rats | eliminate_all (turn 12 = bonus target) | rubble-walled ruin, 18×11 | 3 burrowed Undertow + 4 Crawlmass |

*(This table is the original, as-built version — several numbers below have since moved; see the addenda for current values. Kept as-is rather than edited in place, same as always.)*

Mission 2's map is the one worth calling out: the hold room's west wall is
solid on every row except one — the doorway ("Bosk in the doorway" from
the design doc). The east wall never opens, so hostiles spawning east have
to walk all the way around the building to reach that same single gap.
Verified in a screenshot (Playwright, headless) that it renders and is
reachable from both sides.

## Warden Company roster (`WARDEN_PILOTS` / `WARDEN_MEKS`, new file `data/campaignAmaranth.ts`)

2nd Lt. Dessa Rourke "Lark" (Meeps/human), M.Sgt. Halvard Bosk "Anvil"
(Tank/human), Pvt. Tegan Iyari "Foxfire" (Meeps/Hiopi centauroid), Cpl.
Priya Anand "Farsight" (Reeps/Osnian vibrissal — the first vibrissal pilot
in this codebase; Team One's roster has none), Spec. Corin Lask "Patch"
(Munti/human). Mek track assignments were a build-time call (the design
doc doesn't specify them): Bosk/Iyari get Armorer, Rourke/Anand get
Runemaster (mirrors Team One already doubling up on Runemaster — Nagori
and Tourignie), Lask gets Fieldwright like Team One's own Munti (Barasj).
All tier G, `heirloomCharge: "locked"` on every mission — matches the
design doc's own squad-scaling table (Requiem stays locked until Mission
12, Bosk's death).

## Files

New:
- `src/data/mapsAmaranth.ts` — the 4 map tile grids
- `src/data/campaignAmaranth.ts` — Warden Company roster + the 4 mission definitions
- `src/data/pilotRegistry.ts` — `findPilot`/`findMek`, merging Team One + bench + Warden Company rosters
- `src/data/mapRegistry.ts` — merges Team One's `MAPS` with the new `MAPS_AMARANTH`
- `src/data/allCampaigns.ts` — the one place both campaigns are known about together; feeds the mission-select UI and Battle scene's mission lookup

Modified (small, additive):
- `src/data/maps.ts` — exported `makeMap`/`deriveZones` so the new maps file doesn't fork that logic
- `src/engine/units.ts`, `src/engine/mission.ts` — pilot/mek lookups now go through `pilotRegistry.ts` instead of hardcoding Team One's `PILOTS`/`MEKS` arrays; map lookup in `mission.ts` now goes through `mapRegistry.ts`. This was the one real gap: without it, a second roster's pilots would silently fail to resolve on the battlefield.
- `src/scenes/MapSelect.ts` — now shows a campaign tab switcher (Team One / Amaranth Act I) instead of a single flat list; defaults to the Amaranth tab
- `src/scenes/Battle.ts`, `src/sim/run.ts` — resolve missions through the combined registry instead of Team One's alone

## Verification performed

- `npm run typecheck` — clean
- `npm run lint` — clean (ESLint's restricted-import rules included — no engine file imports Phaser, etc.)
- `npm test` — all 140 existing tests still pass, no regressions
- `npm run build` — production bundle builds
- `npm run sim -- mission_amaranth_{1,2,3,4}` — all four run to completion with no crashes or hangs
- New map grids were authored as ASCII and run through a small offline validator (rectangular, known tile vocabulary, BFS-reachable from every deploy pad to every spawn/hold tile) before transcription — the same two checks the project's own `maps.py` does on the original four maps
- Headless Playwright pass: mission-select screen, Muster in progress (unit selection + move-range highlighting), and Wire and Mud's doorway room all render and respond to clicks correctly — screenshots sent to Maxime alongside the source files

## Known gaps / next steps

- Only Act I missions 1-4 of 12 are built (Missions 5-12 — the Choir mid-boss, the Fallow Line finale, Bosk's death — aren't started)
- Cpl. Anand's `abil_sensor_sweep` doesn't do anything mechanically yet — `revealedUntilTurn` on `BattleUnit` is still unused, a pre-existing gap flagged in the repo's own README (burrow-surfacing-on-adjacency and the vibrissal reveal were both already flagged "unimplemented" before this pass; Mission 4 plays exactly like Team One's Mission 3 already does with its burrowed Undertow — visible-but-faded, targetable at range)
- No art — placeholder geometric shapes throughout, per plan
- No debrief/points-shop wiring for this campaign (same as Team One's — Build Brief steps 11-12 were never built for either campaign)

## Addendum, same day: house rule #5 — eliminate_all has no turn-limit fail condition

Maxime failed Muster on the clock while playing carefully, and asked why
the turn limit exists at all, then decided: "remove the clock on
missions, give player more freedom, xcom doesn't have clocks all the
time." Landed on a scoped fix rather than a blanket one, since `hold_zone`
and `extract_unit` are only meaningful *because* of their turn structure
("hold until turn N," "get out before turn N") — removing turns there
would remove the objective, not just the pressure.

Implemented in `engine/mission.ts`'s `checkWinLoss`: `eliminate_all` no
longer fails when `this.turn > turnLimit`; the only loss condition left
for that objective type is every player unit going down.
`objectiveParams.turnLimit` stays on every eliminate_all mission (all
three Amaranth ones, plus Team One's `mission_1a`/`2`/`3`) rather than
being deleted, because the Amaranth design doc's own points-economy
appendix (Appendix B) ties a future "finished under X turns" bonus to
that same number — the field's still meaningful, just not a fail line
any more. `scenes/Battle.ts`'s HUD reflects that: eliminate_all missions
now read "Turn N (bonus if clear by turn M)" instead of "Turn N / M,"
so it doesn't look like a clock you can lose to.

Full house-rule writeup (matching the format of rules #1-4) is in the
repo's own `README.md`. Re-verified after the change: typecheck/lint/all
140 tests clean, `mission_amaranth_1` now reaches an actual WIN under the
headless test-AI (previously an automatic turn-limit loss at turn 9), and
Team One's `mission_1a` still loses but now from unit attrition rather
than the clock — confirms the fix applies uniformly across both
campaigns, as intended, without needing to touch either campaign's
mission data.

## Addendum, same day: Warden Company Field Manual

Maxime cleared Muster, is enjoying the build, and asked for a manual in
the folder to check while playing — specifically because the board's tile
patterns aren't intuitive yet without art. Built `HOW_TO_PLAY.html`, a
single self-contained dark-themed reference page (Big Shoulders Stencil
Text display face, JetBrains Mono for everything else — pulled straight
from the game's own ASCII/monospace feel), nine sections behind a sticky
anchor nav: Controls, Reading the Board, Terrain, Health/Shield/Collapse,
Class Triangle, Abilities & House Rules (all five, including #5 above),
Objectives, Warden Company roster, and per-mission briefings for I.1-I.4.

Every number in it was pulled from the live source rather than the design
docs — tile colors match `TILE_COLORS` in `Battle.ts` exactly, the Bloom
Endurance/Vitality/Collapse explanation was checked against
`engine/combat.ts`, and the Objectives section explicitly documents the
house-rule #5 split (eliminate_all shown with "No turn limit" in green;
hold_zone/extract_unit still marked "Real deadline") so the manual doesn't
contradict what the HUD now shows in-game.

Delivered to `bloom-wars/bloom-wars/HOW_TO_PLAY.html` (repo root, next to
`README.md`) via the device bridge, and verified with headless Playwright
screenshots section-by-section — all nine sections plus the footer render
clean, no console errors. Also published as a Claude Artifact
(https://claude.ai/code/artifact/e75597ed-2022-4d77-afe3-f3881a6afaea) so
Maxime has a browser-tab copy that doesn't depend on the local file.

## Addendum, same day: Mission 2 fix — hostiles weren't engaging at all

Maxime: "in mission 2 the bloom dont come at us. holding is easy." Two
separate bugs stacked on top of each other, both fixed:

**Bug 1 — spawn placed outside vision range entirely.** The engine
already has a vision gate on hostile targeting (`engine/ai.ts`'s
`isVisibleTo`, added earlier the same day per its own header comment,
fixing an unrelated complaint — "all enemy seem to know where I am at all
times"). Splitfang's vision is 4 tiles (Chebyshev). Wire and Mud's
original spawn tiles sat at map column 15, and the hold room's farthest
corner from there was a straight-line distance of 8 — nowhere close to
visible. A reflexive/pack-tier unit that can't see a single living target
returns an empty decision and does nothing at all, forever, since it never
gets a reason to re-evaluate. Fix: moved the two spawn tiles in
`data/mapsAmaranth.ts`'s `WIRE_AND_MUD_TILES` from column 15 to column 11
(both still "spawn"-tagged, still plain-cost terrain, still outside the
sealed east wall — the room's east side stays permanently walled, so
hostiles still have to detour around to the one doorway; only the
approach distance shrank). Worst-case distance from spawn to any hold
tile is now exactly 4, at the edge of Splitfang's own vision, so the pack
sees the player as soon as anyone commits to holding the zone.

**Bug 2 — found while checking bug 1's fix: hostiles could get
permanently stuck outside a chokepoint.** Once vision let hostiles
target the player, several of them still never moved. Root cause was in
`engine/ai.ts`'s `moveToward()`: when nothing is reachable-in-range this
turn, it picks whichever *this-turn-reachable* tile has the smallest
straight-line (Chebyshev) distance to the target — but the only route
into a single-doorway room requires walking further away in a straight
line first (around to the door) before distance can close. No
this-turn-reachable tile ever beat standing still under that heuristic,
so the unit froze at the outside wall permanently — this generalizes to
any chokepoint map, not just this one. Fix: added `distanceField()` to
`engine/grid.ts` (an unbounded, walls-aware Dijkstra flood fill from the
target — a standard "distance field" / roguelike Dijkstra-map technique),
and `moveToward()` now ranks this-turn's reachable tiles by that real
route-distance instead of straight-line distance. A tile that's a step
"backward" toward the door now correctly scores as closer than standing
still, because it actually is, route-wise.

Verified both fixes together and separately: typecheck/lint/all 140 tests
still clean. Direct position tracing (`m.units` per hostile phase) showed
Splitfangs now flanking north and south around the wall block and
reaching the doorway by turn 5. Broader regression pass across all 8
missions (both campaigns) comparing the old and new `moveToward` head to
head: Amaranth Mission 1 flips LOSS→WIN, Team One's own `mission_2`
(a similarly-shaped hold_zone map, untouched by me) also flips LOSS→WIN —
same latent bug, fixed as a side effect without touching its map data.
Every other mission's outcome was unchanged; nothing got worse. Bug 2's
fix is a general engine correctness fix, not a house rule — it isn't
added to README's house-rules section for that reason.

## Addendum, 23 Aug 2026: mission-length pass — fog of war, overwatch, ability depth, bigger maps

Maxime: "we really need to make our mission last at least 30min. otherwise
its a sad game. (my xcom mission lasted hours.)" Diagnosed what actually
drives XCOM's session length (uncertainty and reactive decisions per turn,
not turn count) against what this build didn't have yet, then had Maxime
prioritize the fix list directly: "Fog of war for the player, Overwatch /
reaction fire, Ability depth per path, 1-2-3 and we can do stage enemy
refil later... if nessessary, to pad missions. feel free to incrase map
size." Built as three sequential passes, each delegated to an agent with a
full brief and personally reviewed against its actual diff before being
considered done:

**1. Fog of war for the player** (`f2e04e4`). The hostile AI was already
vision-gated (`engine/ai.ts`'s `isVisibleTo`) but the player's own side of
the board wasn't — every hostile was drawn and targetable regardless of
whether any player unit could actually see it. New `unitsVisibleToSide`
(same `isVisibleTo`, aggregated across the living player roster) gates
`scenes/Battle.ts`'s rendering and targeting. Purely additive — the
hostile AI's own vision logic was never touched.

**2. Overwatch / reaction fire** (`47ab304`). Hold-fire verb: burns the
unit's whole remaining action budget (two-action house-rule "ending"
move, like Attack), and during the hostile phase, if a hostile finishes a
move within that unit's range and vision, it fires one free reaction shot
through the exact same damage-resolution path as a normal attack — so
campaign-economy scoring (kills + assists) needs no separate case for it.
`attack()` was split into a thin action-economy check plus a shared
`resolveAttack()` both normal attacks and reaction shots now flow through.

**3. Ability depth per path, plus bigger maps** (`615f4b4`). Every unit
had exactly one verb before this (Attack, plus Repair on a Munti), so a
turn was never a real decision. One new verb per path: Reeps get Sensor
Sweep (now actually implemented — see the "known gaps" note above; this
pass is what finally wired `revealedUntilTurn` up), Meeps get Ambush
(overwatch + drop out of hostile sight until their next turn), Tank gets
Interdict (zero the action budget of any hostile that finishes a move
adjacent to a braced Tank it can see), Munti gets Screen (extend
concealment to nearby allies, once per mission). Each is written to cost
something — three of four end the turn, same as Overwatch. The four
Amaranth maps were also enlarged (roughly +40-70% footprint each) to give
fog of war and the new verbs room to matter, re-validated with the same
BFS-reachability discipline as the original four.

Along the way, found and fixed a real, previously-unnoticed bug while
reviewing an agent's report rather than trusting its "pre-existing,
out-of-scope" framing at face value (`08351c6`): `Mission`'s constructor
was spawning every mission's turn-1 wave twice (once explicitly, once
again via `runTurnStartEvents()`, which already spawns the current
turn's waves itself) — doubling every mission's turn-1 hostile count in
both campaigns since that constructor was written. Fixed, with a
permanent regression test (`events.test.ts`) asserting board hostile
count matches the mission def's own stated turn-1 wave count.

Verified: typecheck/lint/all 296 tests clean (up from 140 — new suites for
fog of war, overwatch, abilities, and map validation). Flagged to Maxime
at delivery, twice, that mission length has NOT been validated against
real human play yet — the sim's own test AI uses none of the three new
systems (no overwatch, no abilities, no terrain awareness), so it can't
tell us whether missions actually run 30+ minutes now.

## Addendum, same day: overwatch/sweep/abilities vanishing from the 2nd mission onward

First real playtest feedback on the pass above. Maxime played Mission 1,
then: "mission 2 didnt have overwatch or sweep or the ability," then
"mission 3 didnt have ability eiter." Reproduced with a headless
Playwright replay of the exact sequence — mission 1, back to mission
select, mission 2, back, mission 3, all in one browser session with no
page reload, matching how anyone actually plays through several missions
in a row.

**Root cause**: `scenes/Battle.ts`'s `create()` runs again every time the
scene restarts (once per mission launched), and Phaser destroys every
GameObject the scene owns on the way out (confirmed against
`node_modules/phaser`'s own `Scenes.Systems#shutdown` →
`DisplayList#shutdown`, which calls `.destroy(true)` on the scene's whole
display list). Every other per-create() field is a plain reassignment
(`this.gfx`, `this.hudText`, ...), which is safe under that — the old
object is simply discarded and a fresh one takes its place. `actionSlots`
(the 2×2 contextual action-bar button pool) was the one field built by
*accumulation* instead: `create()` only ever `.push()`ed four new
entries onto it, so by the second mission, indices 0-3 held mission 1's
now-destroyed buttons while the real, live buttons for the current
mission sat at 4-7. `drawActionBar()` always writes to indices 0-3 —
so from the second mission on, every single `render()` call was calling
`.setText()`/`.setFillStyle()` on dead GameObjects, which throws inside
Phaser's own `Text#updateText` ("Cannot read properties of null (reading
'drawImage')" — caught live in the Playwright run, twice, once per repeat
mission launch). That uncaught exception aborted `render()` before it
reached `drawHud()` (called immediately after `drawActionBar()` in
`render()`'s body), which is also why the HUD panel's unit-info lines and
the log went blank alongside the action bar in Maxime's screenshots-worth
of missing UI — one root cause, not several, and not scoped to abilities
specifically (Overwatch, which is the same code path, was equally dead).

**Fix**: reset `this.actionSlots = []` at the top of `create()`'s
action-bar setup, so each scene start rebuilds exactly 4 valid slots
instead of accumulating stale ones. Applied the identical defensive reset
to `scenes/MapSelect.ts`'s `tabButtons` (same push-without-reset shape) —
currently dormant since `CAMPAIGNS.length` is 1 and the tab row never
renders, but it's the same landmine and would have resurfaced silently
the moment a second campaign is un-archived.

Verified: typecheck/lint/all 296 tests clean. Re-ran the same Playwright
sequence after the fix — mission 2 and mission 3 both now show OVERWATCH
and SWEEP labeled and clickable, the HUD panel's unit-info lines are
back, and there were zero page errors this time (down from 2).

Also on the table from this same playtest session, noted but *not yet
acted on* — Maxime wants to keep playing before any of it gets tuned:

- **Mission 1 felt a bit easy** — no specific cause identified yet,
  flagged as tunable later, possibly related to the next point.
- **Sensor Sweep's radius makes fog of war too easy to defeat.** Cpl.
  Anand (Reeps/vibrissal) has vision 7; the sweep bonus adds a flat +2
  (`SENSOR_SWEEP_RANGE_BONUS`, `data/combatTables.ts`), for a 9-tile
  Chebyshev radius. Muster is 20×12 — a radius-9 sweep from anywhere near
  the middle reveals essentially the whole map in one action, which reads
  as "turns fog of war off" rather than "an early-warning ping." Made
  worse by Mission 1 having zero Undertow in it (6 Crawlmass only, all
  surface-walking and visible normally in range), so Maxime never actually
  saw the ability do its designed job (revealing something otherwise
  invisible) — only ever saw it as a full-map reveal. Likely needs two
  knobs looked at together rather than one: the flat sweep bonus, and
  Farsight's own base vision of 7, which is already high for maps this
  size even without sweeping. Deliberately held for a batched tuning pass
  after Maxime reaches Mission 4 (Tunnel Rats), which has the actual
  burrowed Undertow the ability is meant to counter — better to see it do
  its real job once before retuning it, rather than fix it twice.

## Addendum, 23 Aug 2026 (cont'd): sequencing confirmed, plus a real difficulty data point

Maxime, continuing the same playtest thread: "tho the game kinda easy for
now. I want to have more of it built before I tackle the difficulty of the
bloom. when it was double the unit spawned it really felt like I was
fighting a good enemy." Two things worth recording, neither of them code
changes:

**1. Sequencing, confirmed rather than newly decided.** This matches the
holding pattern already set two paragraphs up for Sensor Sweep — no
difficulty/balance pass yet, more content gets built first, tuning comes
later. Same reasoning both times: better to see the real shape of the
problem (more missions, more of what the Bloom actually throws at the
player) before retuning anything, rather than tune against an
still-incomplete build and have to redo it.

**2. A real signal for whenever that pass happens.** Doubling enemy
spawn count is the thing Maxime specifically points to as having felt
like "fighting a good enemy" — a sharper, more specific data point than
"Mission 1 felt a bit easy" alone. Worth reading as: raw wave size may be
doing more of the difficulty work here than any single unit's stats or
an ability's range (the Sensor Sweep note above, for instance, is a
knob-tuning problem; this is closer to "the encounter itself was too
small"). Not enough on its own to commit to a rule (one data point, one
mission's worth of feeling), but worth weighting a future difficulty
pass toward wave size/count first, individual archetype stats second,
when that pass actually happens. Nothing built or changed here — recorded
so it isn't lost by the time Mission 4 (and the deferred Sensor Sweep fix
it's already waiting on) reopens the difficulty conversation for real.

## Addendum, 23 Aug 2026: black-screen crash fix, plus Mission 4 (Tunnel Rats) playtest

**Bug, unrelated to the difficulty conversation above.** Maxime hit a
black screen on launch, screenshotted the actual console error:
`Uncaught SyntaxError: The requested module '/src/data/combatTables.ts'
does not provide an export named 'tierPipCount' (at Battle.ts:18:10)`.
Root cause: at some point `scenes/Battle.ts` picked up a gear-tier pips
render block (GDD §12 — one gold pip per step a unit's tier sits above
G) and `engine/units.ts`'s `BattleUnit` picked up the `tier` field that
block reads, but the actual `tierPipCount()` function those two pieces
depend on was never written into `data/combatTables.ts` — a missing
named export throws at module load, before the app can start at all.
Not caused by the same-day Tank-dodge change (House rule #1b) — confirmed
independently, since that edit only touched `MEEPS_DODGE_CHANCE`'s
neighborhood and never touched this import chain.

Fixed by adding `tierPipCount()` (derives pip count from `TIERS`' own key
order, so it can't drift out of sync with the tier ladder if a tier is
ever added or removed) plus three regression tests. Verified:
typecheck/lint/all 302 tests clean (up from 299), production build,
`npm run sim` on two missions, and a headless Playwright load against the
actual dev server — zero console errors, mission-select renders.

**Mission 4 playtest, right after.** Maxime: "hehe its nice, simplistic
mission but it isnt complicated. right now tho, with good positioning my
team eat the bloom. tho I can tell you borrower are scarry and show up
nicely, I didnt scan for them I wanted to see how much they gonna do,
almost poped one of my meeps in a single hit." Two data points:

- **"My team eat the bloom with good positioning" — same easy-with-good-play
  pattern as the earlier addendum, now confirmed at Mission 4 too, not just
  Mission 1.** Still nothing to act on; holding pattern unchanged (more
  content first, tuning pass later, per Maxime's own call above).
- **Undertow's ambush hit, taken deliberately unscanned, worked exactly as
  designed and reads as intended.** Checked against `data/bloom.ts`:
  Undertow's base `attackPower` is 55, and Data Pack §8.1's own special
  rule gives it `UNDERTOW_SURFACE_DAMAGE_MULT` (1.5×) on the turn it
  surfaces — so the ambush hit Maxime took was ~82 damage against a
  Meeps' 100 HP, matching "almost popped one of my meeps in a single hit"
  almost exactly. This is also the mission's own fiction talking directly
  to the mechanics: Amaranth I.4's briefing text ("Cpl. Anand's sensor
  package should keep you off the surprise end of it") is telling the
  player to Sensor Sweep before an Undertow can get this hit off, and
  Maxime skipping the scan on purpose is exactly the "let the ability do
  its real job once" moment the Sensor Sweep tuning note two addenda up
  was waiting on. No new data on the *sweep-radius-too-generous* half of
  that note yet, since Maxime deliberately didn't sweep this run — still
  open for whenever he does.


## Addendum, 23 Aug 2026: missions 5-8 built

Maxime: "everything up to mission 4 look fine. you can work on the others.
lets do 5-8 next." Same content-and-wiring pattern as 1-4 — the design
doc's own §3 scope note ("Act I: no new systems") held for all four:
`extract_unit`/`eliminate_all`/`hold_zone` all already existed in the
engine, and pack-tier coordination (`engine/ai.ts`'s `packAllies()`) is
generic — keyed off `intelligence: "pack"`, not hardcoded to Splitfang —
so the new mid-boss archetype gets squad coordination for free.

| # | Name | Objective | Map | Enemy |
| --- | --- | --- | --- | --- |
| 5 | Foraging Party | extract_unit (extractUnitId: Anand) | wrecked supply depot, deploy west / exit east, 22×13 | 6 Crawlmass + 2 Splitfang |
| 6 | House Colors | eliminate_all | border checkpoint gate, 20×12 | 4 House Amaranth Line Troopers |
| 7 | Sporewatch Ridge | hold_zone (hold from turn 6, limit 12) | ridge knoll IS the hold zone, 20×12 | 3 Sporethrower (staggered) + 2 Crawlmass |
| 8 | The Choir Sings | eliminate_all [mid-boss] | open killing field, ridge fringes, 22×13 | 4 Choir (new archetype) + 4 Crawlmass |

**Two small additions, both data-only, no new engine code:**

- **`bloom_choir`** (`data/bloom.ts`) — the design doc's own Act I mid-boss
  (§8: "a Sirenmaw-descended pack fighting in coordination, pack-tier
  intelligence made audible"). Sonic/flight_membrane like Sirenmaw,
  `intelligence: "pack"` (load-bearing — this is what makes the existing
  pack-coordination AI apply automatically), tuned above Sirenmaw
  (END 80→110, VIT 70→85, attackPower 25→32) since this is the act's
  toughest fight to date. New on-hit effect `fx_choir_dissonance`
  (-30%/3 turns, vs. Sirenmaw's -20%/2) for the "several voices
  compounding" read.
- **`AMARANTH_HOSTILE_MECHS` + merged `ALL_HOSTILE_MECHS`** (`data/units.ts`,
  `engine/units.ts`) — House Colors needed hostile mechs the game actually
  names, the deliberate opposite of Mission 1a's "Unmarked Mech" quiet-
  critique discipline (Build Brief §2.4 / GDD §10.1 — that discipline is
  specifically about the site's-own-defenders reveal, not a blanket rule
  against ever naming a hostile mech). Added a second table rather than
  editing the original one — that block's own comment says not to add
  reasoning near it, so a same-file mix felt like exactly the kind of
  thing that could get confused later — plus a merged lookup
  (`ALL_HOSTILE_MECHS = {...HOSTILE_MECHS, ...AMARANTH_HOSTILE_MECHS}`)
  since `createHostileMechUnit` only ever resolved IDs from the original
  table. Same shape as the pilotRegistry.ts merge that Missions 1-4 needed
  for exactly the same reason (see that addendum above) — found it by
  checking, not by assuming a second table would just work.

**Real bug found and fixed along the way, not asked for:** eight
missions' worth of cards broke `scenes/MapSelect.ts`'s mission list, which
was never built to scroll — Mission 8's card rendered at y≈798 on a 640px
canvas, fully outside both the visible area and the interactive hit-test
region. Added mouse-wheel scroll on the list container, clamped to the
list's own content height, plus a geometry mask so scrolled-up cards clip
at the list's own top edge instead of drawing over the fixed header.
Confirmed via headless Playwright: scrolled to Mission 8, clicked it,
deployed the full roster, and the battle scene loaded live with zero
console errors.

Maps built with a small scratch Node tool (not committed — same throwaway
convention as `maps.py`'s own ASCII scripts) rather than hand-counted
ASCII strings: helper functions for rects/borders instead of counting
columns by eye, same BFS-reachability + tile-vocabulary validation as
`maps.py` performs, run before transcribing into `mapsAmaranth.ts`.

Verified: typecheck/lint clean, full test suite 318/318 (up from 302 —
the existing per-map validator suite in `mapsAmaranth.test.ts` picked up
all four new maps automatically, no new test-writing needed there),
production build, `npm run sim` on all four new missions, and the
Playwright pass above. Also updated `allCampaigns.ts`'s mission-select
subtitle text ("missions 1-4" → "missions 1-8"), which would otherwise
have quietly gone stale the same way the MapSelect scroll issue did.

**One thing worth flagging rather than quietly shipping:** the sim's
(admittedly weak, ability-blind) test AI lost Mission 8 badly — four
Choir units pack-focused Bosk for 27 damage each in a single hostile
turn, well over his 100 HP, full squad wipe by turn 8. That's the pack-
coordination mechanic doing exactly what it's supposed to (concentrate
fire once it senses a target), and "mid-boss" is meant to be a real step
up, so this isn't necessarily wrong — but it's a sharper spike than
anything before it in Act I, and worth knowing about before playing it
blind. Not rebalanced pre-emptively, consistent with the standing "more
content first, tuning pass later" call from two addenda up.

**Separately:** `claude_Bloom_Wars_Master_Index.md` still describes the
docs-only design phase from before any of this TypeScript build existed
(no mention of the Amaranth pivot, the live engine, or any of the ~15
test suites) — it's now several build passes further behind than this
log is. Didn't touch it this pass since a proper refresh is its own task,
not a side effect of building four missions; flagging so it doesn't read
as settled the next time someone opens it expecting current state.

## Addendum, 23 Aug 2026: Mission 8 accepted, spacebar end-turn, gear-tier confirmed, missions 1/2/4 tuning pass

Maxime endorsed the Mission 8 spike directly: "that might just be whats
need to teach player how unforgiving this game is, after all, its like
xcom, there some loss you gotta accept." No rebalancing done — matches
the "flag it, let him decide" call from the addendum above, and he
decided to keep it.

**Gear-tier question, verified against source rather than assumed.**
Maxime: "I just hope that when we upgrade a unit all its stats upgrade
including its hp. or if it isnt hp, then its its defensive ability."
Checked `data/combatTables.ts`'s `TIERS` table and `engine/units.ts`'s
stat-application code directly: attack, defense, and HP all scale up
together at every tier step (plus move from D upward). Answered with the
actual numbers; no code change needed, the system already did what he
hoped.

**Spacebar end-turn**, from an offhand aside during Mission 5 ("was doing
the mission 5 and I pressed spacebar like it would move the turn. lol").
Treated as a real, low-risk QoL gap rather than a throwaway joke — it's
XCOM's own convention, and free to add. Refactored the END TURN button's
click handler into a shared `doEndTurn` closure, bound `SPACE` to it with
`addCapture` (blocks the browser's own page-scroll-on-space) and an
`off()`-before-`on()` guard (the same GameObject/listener-accumulation
pattern that bit `actionSlots` and `tabButtons` earlier — see those
addenda), and relabeled the button "END TURN  [space]". Verified via
typecheck/lint/test/build and a live Playwright press-Space-advances-the-
turn confirmation.

**Missions 1, 2, 4 tuning pass**, from Maxime's punch list: "mission 1
twice as many enemy, mission 2 should end at turn 12 and have twice as
many enemy, ... mission 4 is pretty cool as is, perso, id just make the
map bigger and give two scans to anand sweeper." (Missions 3 and 5's
requests in that same message — a Munti bloom-clearing ability with a
periodic bloom-spread mechanic, and a scraps-for-points collectible tied
to saving a downed pilot — are new systems, not data tuning; those are
being flagged back to him separately rather than built blind, per the
project's own "flag scope growth before building" rule. Mission 6 is
explicitly still being drafted by him, untouched.)

- **Mission 1 (Muster): Crawlmass 6 → 12.** Clean data change, no map or
  invariant touched. `npm run sim` shows the built-in test AI losing this
  one now (isolates one pilot by charging ahead solo, gets focus-fired by
  whichever Crawlmass happen to be nearby) — but Crawlmass isn't a pack
  archetype, so that's the test AI's own positioning weakness surfacing
  under more numbers, not a designed concentration mechanic. Shipped as
  asked; worth knowing the sim struggled, not worth blocking on it.

- **Mission 2 (Wire and Mud): turnLimit 10 → 12 shipped. Enemy-count
  doubling NOT shipped.** Tried 6+6 Splitfang (same turns as the original
  3+3) and it breaks the mission outright: `mapsAmaranth.test.ts`'s own
  door-plug regression — which encodes the enlargement pass's explicit
  design goal, "stays small enough for FIVE MECHS TO DENY" — goes from a
  clean win to a full squad wipe by turn 10 (a chain Munti-permadeath, in
  fact), and a version that fights back (`npm run sim`) also loses, by
  turn 8, before the hold window even elapses. Root cause: Splitfang's
  pack AI (`engine/ai.ts`'s `packAllies()`) always concentrates a pack's
  fire on one target — doubling the pack doesn't spread damage across more
  targets, it stacks more of it onto whichever single pilot gets focused
  (one pilot took four simultaneous 27-damage hits in one hostile phase
  and went down outright). Tried spacing the same 12 across four waves of
  3 (turns 1/3/5/7) instead of two waves of 6 — fixed the fighting sim
  (clean win, turn 6) but the pure door-plug test still failed for
  reasons I didn't fully run down (the harness's own Munti pathing looked
  like it was going in circles, independent of the enemy count — possibly
  a pre-existing rough edge in that specific test's greedy movement logic
  that the added enemy pressure just exposed, not something I want to
  guess at further). Turned back the count change rather than ship a
  guess. turnLimit-only re-verified clean: same door test wins at turn 6,
  zero Splitfang attacks landed before then, exactly like the original.
  This needs Maxime's call, not mine — the door test enforces a decision
  he made on purpose when the room was sized, and doubling Splitfang
  changes what that decision means in practice.

- **Mission 4 (Tunnel Rats): map enlarged again, 24×15 → 30×19 (+58%
  area).** Same discipline as the first enlargement pass: two new solid-
  ridge border rows top and bottom, six new columns of open ground east
  of the ring past the third Undertow seam — the ring, its rubble, both
  gaps, and all three Undertow spawns are byte-for-byte the same tiles,
  just shifted +2 rows uniformly. Re-measured with the same Dijkstra
  method as the original pass: deploy → nearest seam is still exactly 9
  move points, unchanged. Undertow spawn coordinates in
  `campaignAmaranth.ts` moved to match (row +2 only). The "give Anand's
  Sensor Sweep two scans" half of the request is the one still open —
  there's no per-mission or per-pilot ability-override mechanism in the
  engine right now (`SENSOR_SWEEP_COOLDOWN_TURNS`/`SENSOR_SWEEP_RANGE_BONUS`
  are global constants), and "two scans" is itself ambiguous (a charge
  system vs. a shorter cooldown, mission-only vs. everywhere) — flagged
  back to Maxime rather than guessed at.

Full stack re-verified after all three changes: typecheck, lint, all 318
tests (including the map regression suite), production build, and
`npm run sim` for missions 1 and 4. Mission 2 shipped in its
partially-applied state specifically so the test suite stays green;
nothing was force-committed past a failing regression test.

## Addendum, 23 Aug 2026 (cont'd): Sensor Sweep charges, and the real Mission 2 fix

Two direct answers from Maxime to the open items above:

> "mission 2, would 8 or 9 enemy work"

> "mission 4 I see double scan as two charge each mission, every mission.
> yes. we can add undertow to other mission later, 1-12 are us setting
> all the varied unit once, act 2 will be two type of bad unit and act 3
> will have them all. exept the sessile one, those are there to act as
> ''dont go there or you die'' hazzard"

The second one is an unambiguous answer to the "cooldown vs. charges,
mission-only vs. everywhere" question flagged in the previous addendum:
a hard 2-per-mission budget, every mission, every vibrissal pilot — not
a Mission-4-only bump. Built that first, since there was nothing left to
guess at.

**Sensor Sweep: cooldown → per-mission charges.** Replaced
`SENSOR_SWEEP_COOLDOWN_TURNS = 2` (unlimited uses, gated by a 2-turn wait
between them) with `SENSOR_SWEEP_CHARGES_PER_MISSION = 2` (a hard budget,
no cooldown, usable back-to-back if charges remain, never refills mid-
mission) in `data/combatTables.ts`. Modeled on the existing
`usedScreenThisMission` once-per-mission pattern (Munti's Screen) but as
a spendable counter instead of a boolean: `engine/units.ts`'s
`BattleUnit` gained `sensorSweepUsesRemaining?: number` (undefined = full
budget), set on all three unit factories. `engine/mission.ts` got a new
`sensorSweepChargesRemaining(unitId)` accessor; `canSensorSweep` and
`sensorSweep()` were rewritten around it instead of the old cooldown
check, and the sweep's own log line now ends "(N charge(s) left)". UI
followed: the action bar button now reads `SWEEP ×N` instead of a
countdown, and the HUD panel says "Sensor Sweep: N charge(s) left this
mission" / "spent for this mission" instead of "N turn(s) to recharge".
`abilities.test.ts` was rewritten to prove it's a budget, not a clock:
two sweeps back-to-back in the same turn both succeed, a third is
refused even after manually restoring the unit's action points (isolating
the charge check from the ordinary action-economy check), and letting 5
turns pass does not hand back a charge.

**The real Mission 2 fix — not "8 or 9," the actual bug.** Rather than
guess at a compromise number, built a scratch debug harness and ran the
door-plug regression at 8 (4+4: passes), 9 (5+4: fails), and 9 spread as
3+3+3 (still fails) to find the actual boundary, then added position
logging to the failing runs. A Splitfang from the overflow wave was
spawning at `(10,3)` — a real hold-zone tile, inside the room the map's
whole design depends on staying sealed except through its one doorway.
That's not a balance problem, it's `findFreeAdjacent()` (the function
`mission.ts` calls whenever a wave lists more units than there are
collision-free tiles at its spawn origin) placing the overflow unit by
raw Chebyshev ring distance with no wall awareness at all. Wire and
Mud's spawn tiles sit right against the hold room's sealed east wall, so
once a wave overflowed, the search found a hold-zone tile that was close
in coordinates and spawned straight through the wall to reach it — no
doorway required, the exact opposite of what a wall is supposed to
guarantee. This is the actual explanation for the door-plug test failing
at 6+6 two addenda ago; the pack-AI concentration theory from that
addendum was a red herring — plausible, tested, and wrong.

Fixed by rewriting `findFreeAdjacent` as a walls-aware BFS (4-directional
stepping, checks each candidate tile's passability, only ever reaches a
tile by a route a real unit could actually walk) instead of a blind
distance search — the same constraint any unit's own movement is already
held to. Added a permanent regression test in `events.test.ts` asserting
no hostile ever ends up on a hold-zone tile at spawn time, across both of
Mission 2's waves, so this can't come back unnoticed.

With the real bug gone, **6+6 Splitfang — Maxime's original, literal
"twice as many enemy" request, not a scaled-back 8 or 9 — wins the
door-plug regression cleanly at turn 6 again**, and the version that
fights back (`npm run sim`) also wins at turn 6, costing the mission's
Munti (Lask) as a permanent loss along the way — a real cost from a real
fight, not a broken run. Mission 2 now ships in full: `turnLimit: 12`,
`holdUntilTurn: 6`, 6+6 Splitfang across turns 1 and 3.

**Recorded, not acted on:** Maxime's note on how Act 1-3 will introduce
Bloom archetypes — Act 1 (missions 1-12) sets each varied unit type one
at a time, Act 2 introduces two bad-unit types together, Act 3 has all of
them except the sessile/tomb type, which stays a "don't go there or you
die" hazard rather than an active combatant. No mission currently being
built needed this, so nothing changed — keeping it here so it's on hand
whenever Act 2 or 3 pacing comes up for real.

Verified: typecheck, lint, all 319 tests (up from 318 — the new
`findFreeAdjacent` regression), production build, and `npm run sim` for
missions 1 through 5. Missions 1, 3, and 5 still show the sim's own
test-AI losing under its existing positioning/objective-blindness
weaknesses (noted in earlier addenda) — confirmed via a `git stash`
before/after comparison that those losses predate this round of changes
and are not new breakage from the `findFreeAdjacent` fix.

**Still open, not addressed in this round:** Mission 3's cleaning-job
ability for Munti (clearing bloom mat in a radius, paired with a
periodic bloom-spread mechanic) and Mission 5's scraps-collection system
(tied to `rewardPoints` and a downed-pilot rescue) are both new systems
per the project's own scope-flagging rule, not tuning — still waiting on
Maxime's answer from two addenda up. Mission 6 remains untouched; he's
still drafting it.

## Addendum, 24 Aug 2026: Mission 3's clear_bloom objective and Mission 5's rescue-and-recruit bonus objective — both new systems built

Picks up exactly where the previous addendum left off. Maxime, unprompted:
"yeah, I'm thinking of making clean the bloom patch the objective of
mission 3. while mission 5 is rescue the downed pilot. or grab whats left
of the fallen unit to bring back home. and iif we got other mission with
similar layout we can make those objective bonus objective in toher
mission, this is me wishful thinking your call. i think this would be cool
to add in game, something else to do than just smash." Both halves are
exactly the two items flagged as new-systems-not-tuning at the end of the
previous addendum, now with real design answers behind them rather than a
placeholder.

Per the project's own scope-flagging rule, walked both open questions
through `AskUserQuestion` instead of guessing before writing any code.
Round one: whether Mission 5's "get something back from the field" should
be salvage-only or a full rescue-and-recruit — Maxime: "i think rescuing a
down npc would be cool, giving us a free new pilot. random chassis. but
walk me tru both" (a lean toward rescue while still wanting the full
walkthrough of the cheaper option too); and how to sequence the two
builds — "i dont want to forget so do both. plz," so Mission 3 and Mission
5 were built together, not staged behind a checkpoint. Round two, once the
rescue shape was picked: what gets rolled on a successful rescue —
"Chassis and class, both random" (the full wildcard, not the cheaper
chassis-only option that had been recommended); and where the new pilot
lands — "The bench," the recommended option. The generalized "any mission
can carry bonus objectives" idea from Maxime's own "your call" aside was
deliberately NOT built as a system this pass — no debrief-screen
infrastructure exists yet to show a bonus result generically, and there
was only one concrete case (`rescue_pilot`) to generalize from. Built
instead as a narrow `BonusObjective` union with exactly one member,
shaped so a second kind can be added later without a redesign, and said
so rather than quietly deciding it for him.

**Mission 3 (The Low Ground): `clear_bloom`.** New objective type,
replacing `eliminate_all` — win the instant no `bloom_mat` tile remains
anywhere on the board (`Mission.hasBloomMat()` /`checkWinLoss`'s new
branch). Enemy waves are untouched — 8 Crawlmass + 2 Splitfang still spawn
and still fight for real, they just aren't the win condition any more, so
Lask (Warden Company's one Munti) has to clear the patch while the rest of
the squad keeps the Bloom off her — a materially different tactical
problem from "kill everything" with the identical hostile roster. New
Munti-only ability `abil_clear_bloom` (`data/abilities.ts`): converts
every `bloom_mat` tile within a 1-tile Chebyshev radius back to plain
ground, costs 1 action, does not end the turn, and — unlike Screen or
Sweep — has no per-mission limit or cooldown at all, because this is the
mission's actual job and is meant to be used repeatedly. House rule #7
(`data/combatTables.ts`): `tickBloomRegrowth` is the objective's own
countervailing pressure — deterministic, not a percentage roll, it fires
on turn 4 and every 3 turns after (turn 7, 10, 13, ...), converting up to
2 clean tiles adjacent to existing bloom_mat back into bloom_mat each
time, in a fixed scan order so a regression test can pin the exact tiles
down. House rule #5 (no turn-limit fail line) extends to this third
objective type the same way it already covers `eliminate_all` —
`objectiveParams.turnLimit` stays as a bonus-scoring target, never a fail
condition; the regrowth tick is what keeps stalling from being a free win
instead of a hard clock. Briefing text rewritten to match ("Bloom mat came
up through the low terraces overnight... It's spreading while you stand
here; don't let it get ahead of you.").

**Mission 5 (Foraging Party): `rescue_pilot` bonus objective.** Layered on
top of the existing `extract_unit(Anand)` objective, not a replacement for
it — Anand reaching the treeline is still the entire real mission; this is
strictly a bonus that can never fail it. A downed NPC pilot spawns at
(13,6) — immediately east of the wrecked depot, between the depot and the
exit tiles, fitting the mission's own existing briefing about a missing
salvage detail. New factory `createRescuableNpcUnit`
(`engine/units.ts`): `path: "meeps"` deliberately, not a narrative claim
about who this pilot turns out to be (the class/chassis roll happens
later, independently, only if the rescue succeeds) but because
`resolveMechAttack` throws outright on a defender with no `path` — and
picking Meeps happens to also grant the Meeps dodge house rule, which
reads as a reasonable "hard to finish off" break for a downed pilot rather
than a design accident. Modest stats (50/50 HP, defense 70, vision 0,
can't move or act) — at real risk, not helpless, not a pushover either.
Rescue is a three-part shape mirroring Repair exactly
(`getRescuableFrom`/`canRescue`/`rescueUnit`, `engine/mission.ts`): any
adjacent player unit can pick the NPC up (not a class verb like Repair —
every unit can attempt it), which removes the NPC from the board and
marks the rescuer `carryingRescueId`. A carrying unit cannot attack until
either they reach an exit tile (`checkRescueExtraction`, called every
player turn end alongside the existing `checkExtraction`, which clears
the flag on success) or go down trying (`handleDowned`'s new branch, which
also catches the NPC being killed before ever being picked up) — escorting
is the trade, and a unit that could still fight while carrying would get
both halves of it for free. Neither failure path ever touches
`Mission.outcome`; `rescueOutcome` is tracked entirely separately and is
never read by `checkWinLoss`. On a successful rescue, `scenes/Debrief.ts`
calls the new `generateRandomRescuedPilot` (`engine/campaignState.ts`),
which rolls both class and chassis independently at equal odds — the only
recruit path in the game where neither axis is chosen by anything except
a coin flip — and adds the result to the campaign roster exactly the way
every other generated recruit is stored (active, unassigned — "the
bench"), reusing the existing `checkMuntiGuarantee`/`drawMuntiCallout`
reveal pattern on the Debrief screen rather than building a new one.

**Real bug found and fixed proactively, not discovered as a crash.**
Before writing any of the tile-mutation code above, checked how
`Mission`'s constructor gets its map and found `this.map = map;` was a
bare reference assignment to `MAPS[mission.mapId]` — one singleton object
shared by every `Mission` ever built from that mapId, in every test,
every `npm run sim` call, and every real playthrough. Nothing had ever
mutated `map.tiles` before this pass, so the shared reference was latent
rather than actually wrong — Clear Bloom is the first thing in this
codebase that writes to a tile after a mission starts, which would have
meant a Munti clearing bloom mat in one Low Ground playthrough
permanently rewriting the map for every Low Ground mission after it, in
the same process. Fixed by cloning the tile grid in the constructor
(`deployZones`/`exitTiles`/`holdZone` stay shared references, since
nothing mutates those) before writing a single line of the objective
logic that would have exposed it, and added a dedicated regression test
(below) rather than trusting it by inspection alone.

**A design goal that turned out free.** `engine/ai.ts`'s pack-targeting
(`sharedPackTarget`) picks whichever visible target has the lowest
HP × effective-defense product. The rescuable NPC's stats put it well
below any real pilot's, so once it's on the board, pack-tier Bloom
naturally prioritize attacking it over the actual squad — real stakes on
the rescue, entirely for free, no new AI code required. Confirmed this
happens in practice, not just in theory: an `npm run sim -- mission_amaranth_5`
run had a Crawlmass down the NPC before anyone reached it —
`Crawlmass attacks Downed Pilot for 28` twice, `Downed Pilot is downed.`,
`The rescue attempt fails.` — and the mission continued normally
afterward, extract-Anand objective untouched, exactly as designed.

**Verification.** `npm run typecheck`, `npm run lint`, `npm test`
(343/343, up from 319 — 24 new tests across two new files,
`clearBloom.test.ts` and `rescuePilot.test.ts`, covering: the map-clone
isolation fix directly, by building two `Mission`s from the same map def
and confirming a clear on one never touches the other or the raw registry
entry; `clearBloom`'s radius/action-cost/refusal rules; the `clear_bloom`
win check; `tickBloomRegrowth`'s exact pacing, turn by turn, against the
real house-rule constants; the full rescue lifecycle including both
failure paths and the `carryingRescueId` attack lock; the `checkWinLoss`
fix that excludes the rescuable NPC from "is anyone still alive" so a
wiped real squad reads as a loss even with the untouched NPC still
standing; and `generateRandomRescuedPilot`'s class/chassis roll, mocked
via the same `vi.spyOn(Math, "random")` convention `dodge.test.ts`
establishes), and `npm run build` all clean on the first pass after
implementation. `npm run sim` run against both missions as a smoke test
— but flagged honestly rather than presented as balance data: the sim's
own test-AI (`src/sim/testPlayerAi.ts`) is objective-blind in exactly the
way earlier addenda already noted for extraction and hold objectives —
it only ever moves and attacks, so it never calls Clear or attempts a
rescue, which means the sim cannot currently tell us whether either
mission is winnable or well-paced for a real human. What it DID confirm
directly: `tickBloomRegrowth` fires at exactly turns 4, 7, 10, and 13 with
zero drift (matches the dedicated pacing test above), Mission 3 with the
new objective is at minimum not crash-prone across a full 13-turn run,
and the AI-targets-the-NPC behavior above is real, not theoretical. Real
playable-balance for both missions is still unverified and will need
Maxime's own playtesting, same as flagged for the mission-length pass
several addenda up.

**Also attempted, not completed: a live in-browser visual pass** of the
new UI (Mission 3's `CLEAR` action-bar button and its gold tile preview;
Mission 5's rescue click-target highlight, the `RESCUE` interaction, the
`CARRYING` HUD line, the NPC's distinct dashed-outline pale rendering; the
Debrief screen's new green "RESCUE SUCCESSFUL" callout). Hit an
environment mismatch mid-attempt — the dev server startable from this
session's own shell was not reachable from the browser-automation tool
actually available in this session, on a different network path entirely
— and rather than screenshot a stale or disconnected build and call it
verified, stopped and flagged it here instead. Every prior UI-facing pass
in this log (the doorway room, the manual, the scroll fix, the spacebar
binding) got a real Playwright screenshot pass before being called done;
this is the first one that didn't, and it's an honest gap, not a skipped
step.

**Still open:** the generalized bonus-objective system (multiple bonus
objectives per mission, a generic debrief UI for showing bonus results)
remains explicitly unbuilt, per Maxime's own "your call" and the
single-concrete-case reasoning above. The visual UI pass above is
unfinished. Neither mission's real difficulty/pacing has been played by a
human yet.

## Addendum, 24 Aug 2026: the bonus-objective system generalized — clear_bloom_patch, points payout, generic Debrief reveal

Same day, next message. Maxime: "alright cool, keep the rescue pilot and
bloom patch thing around we are gonna use those as special objectif
player can complete during mission for extra point." This is the exact
generalization the previous addendum flagged as deliberately not built
yet ("no debrief-screen infrastructure exists yet to show a bonus result
generically, and there was only one concrete case to generalize from") —
both of those conditions no longer held once Mission 3 and Mission 5
shipped together, so this pass is that generalization, not a new design
direction.

Per the project's own scope-flagging rule, walked the open questions
through `AskUserQuestion` before writing anything. On timing/reuse:
"they are t hing introduce during those mission but can be reused later
for extra content, I plan to incrase map size and over all mission
leight and adding 2cd objective could make the world feel more alive. so
built the system to support adding those as 2cd objectif in later
mission. we mnight even add bloom cleaning t o mission 6-8 small patch of
it anyway" — build the reusable engine framework now; a Mission 6-8
placement is explicitly speculative ("we might"), not an instruction, so
none was added this pass. On the rescue reward: "Points on top of the
recruit (Recommended)" — the free-recruit reward stays, points are
additive on top of it, not a replacement.

**`BonusObjective` (`data/types.ts`): single-kind interface → discriminated
union.** `RescuePilotBonusObjective` (unchanged fields, plus new
`bonusPoints: number`) and `ClearBloomPatchBonusObjective` (new:
`patchTiles: Coord[]` plus `bonusPoints: number`). `CampaignMission.
bonusObjective` stays a single optional field, not an array — one bonus
per mission, of either kind — matching the narrow, un-generalized shape
already in place; only the *kind* axis generalized, not the *count* axis,
since nothing this pass asked for more than one bonus per mission.
Deliberately a plain union with concrete per-kind fields rather than a
generic/polymorphic payload, consistent with every other typed shape in
that file (`EnemyWave`, `MissionEvent`, `TileDef`).

**`clear_bloom_patch` reuses `abil_clear_bloom` as-is — zero new clearing
code.** The ability (`canClearBloom`/`getClearableBloomFrom`/`clearBloom`,
`engine/mission.ts`, built for Mission 3) already operates generically on
whatever `bloom_mat` tiles sit near the caster on the *current* mission's
map, regardless of that mission's own `objective` — Mission 3's
`clear_bloom` win condition was never special-cased into it. So the new
bonus kind needed only new completion-tracking, not a new verb:
`clearBloomPatchOutcome: "none" | "pending" | "succeeded"` (`engine/
mission.ts`, alongside the existing `rescueOutcome`), armed by a new
`armClearBloomPatch()` (constructor-time, mirrors `spawnRescuableNpc` but
needs no board setup — the tiles are already `bloom_mat` as authored) and
resolved by `checkClearBloomPatchComplete()` (called every player turn
end alongside `checkRescueExtraction`, mirrors its shape exactly): succeeds
the instant every tile in the objective's own `patchTiles` list reads as
something other than `bloom_mat`, and never touches `Mission.outcome`,
same guarantee `rescueOutcome` already carries. **No "failed" state, by
design** — unlike a rescue, which a hostile can actively deny by killing
the NPC or the carrier, nothing on the board can make an uncleared patch
fail; it's simply still "pending" if the mission ends before it's done.
The old single-kind `spawnRescuableNpc()`/constructor call site became a
dispatching `armBonusObjective()` that routes to whichever kind's own arm
method applies, or is a no-op for a mission with no `bonusObjective` at
all.

**Points payout: `computeBonusObjectivePoints`/`applyBonusObjectivePoints`
(`engine/campaignEconomy.ts`), a third, separate company-pool income
source.** Reads whichever outcome field actually resolved (`rescueOutcome`
for a `rescue_pilot` bonus, `clearBloomPatchOutcome` for a
`clear_bloom_patch` one) and pays that objective's own `bonusPoints` into
`state.points` — the company pool, not any one pilot's personal balance,
since a bonus objective is squad-level achievement rather than an
individual's combat performance metric. Deliberately **not** gated on
`mission.outcome === "win"`, unlike the existing completion-bonus formula
(`computeMissionCompletionBonus`) — a bonus objective is scored as its
own achievement independent of whether the mission's main objective was
won or lost, which is exactly how `rescueOutcome`'s existing Debrief
reveal already behaved before this pass (no outcome check anywhere near
it); this just prices what that condition already governed. Kept as its
own function rather than folded into the existing `applyCompanyEarnings`
— that function's own doc comment already scopes it to exactly two
sources (the completion formula, the Rourke CO bonus) with a shared
win-gating story a bonus objective doesn't share; `scenes/Debrief.ts`
calls both, once each, at the same point in its own mission-end sequence.

**Mission 5's bonus now carries `bonusPoints: 40`** (`data/
campaignAmaranth.ts`) — a placeholder balance number, flagged inline
exactly like `campaignState.ts`'s own `DISCRETIONARY_RECRUIT_COST`
convention: company-pool scale, sitting close to `SPARE_PART_COST` (40),
comfortably under this mission's own `rewardPoints` (170) for actually
winning it, pending a real tuning pass once there's play data. No
`clear_bloom_patch` bonus was added to any shipped mission (3, 6, 7, or
8) this pass — the framework supports it, but Maxime's own "we might"
framing on Missions 6-8 is speculative future content, not a placement
instruction, and inventing map coordinates or a patch size for missions
he hasn't drafted yet would be exactly the kind of unrequested design
decision this project's collaborative pattern leaves to him.

**`scenes/Debrief.ts`**: `drawRescueCallout` (rescue-only) became
`drawBonusObjectiveCallout` (both kinds) — same green/positive panel
shape as before, but now branches on the mission's `bonusObjective.kind`:
rescue keeps its own headline wording ("RESCUE SUCCESSFUL — Name
recovered, added to the bench") with the new `(+N pts)` appended;
clear_bloom_patch gets its own line ("BONUS OBJECTIVE COMPLETE — patch
cleared (+N pts)") since it has nothing else to report. The earnings
panel's "Company pool: +N pts" total and its small-print breakdown line
both now fold in `bonusObjectivePoints` alongside the existing completion-
bonus/CO-bonus breakdown, so a successful bonus is visible in the same
place the rest of the company pool's income already is, not just in the
callout banner.

**Verification.** `npm run typecheck`, `npm run lint`, `npm test`
(354/354, up from 343 — 11 new tests in a new `bonusObjective.test.ts`,
covering: `armBonusObjective` dispatch not cross-contaminating the two
outcome fields in either direction; `clear_bloom_patch`'s full lifecycle
built on a synthetic mission — spread from `AMARANTH_MISSION_3`'s own map/
roster but with `objective` overridden to `eliminate_all`, specifically to
prove the bonus framework doesn't depend on the mission's own win
condition — covering partial-clear-stays-pending, full-clear-succeeds-
without-touching-outcome, and never-fails-even-on-a-real-loss;
`computeBonusObjectivePoints`/`applyBonusObjectivePoints` for both kinds,
including the outcome-independence claim tested directly by forcing
`mission.outcome = "loss"` after a bonus already resolved "succeeded" and
confirming the points still pay out; and a direct check that Mission 5's
own `bonusObjective.bonusPoints` is positive and comfortably under its
`rewardPoints`), and `npm run build`, all clean on the first pass.
`npm run sim -- mission_amaranth_{3,5}` re-run as a crash smoke test after
the `armBonusObjective` refactor (same objective-blindness caveat as
always — the test AI never calls Clear or Rescue, so this confirms
nothing crashed, not that either mission is winnable or balanced).

**Not re-attempted this pass:** the live in-browser visual pass flagged
as an honest gap in the previous addendum. The environment mismatch that
caused it (this session's dev server not reachable from the browser-
automation tool actually available here) is an infrastructure condition
of this session, not something that changed between the two addenda, so
re-attempting it without new information would have just produced the
same failure again. Still open, now covering the new
`drawBonusObjectiveCallout` panel and the updated earnings-panel breakdown
line on top of everything already listed as unverified visually in the
previous addendum.

## Addendum, 24 Aug 2026: first real playtest of Mission 3 — tallied, not acted on

Maxime played The Low Ground for real: "mission 3 was fun, tho the bloom
are weak. we will really have to lean on it as a swarm entity with
various variety." Explicitly asked to just tally this one, not act on it
— logged here per that instruction, nothing touched in the repo.

Two separate observations worth keeping distinct for whenever a
difficulty pass does happen:

- **"The bloom are weak" — a first real data point on individual-unit
  strength, distinct from the wave-size signal already on record two
  addenda up.** Mission 3's roster is 8 Crawlmass + 2 Splitfang
  (`AMARANTH_MISSION_3`, unchanged since it shipped). Crawlmass
  (`data/bloom.ts`) sits at endurance 40 / vitality 60 / attackPower 22 —
  the entry-level archetype in the current roster of 8
  (`bloom_crawlmass`, `bloom_splitfang`, `bloom_undertow`,
  `bloom_sporethrower`, `bloom_gallcyst`, `bloom_sirenmaw`,
  `bloom_choir`, `bloom_heartwood`), and 8-of-10 hostiles on this specific
  mission being that entry-level archetype is very possibly why this
  particular playthrough read as weak rather than the roster as a whole.
  Distinct from the "double the wave size felt like fighting a good
  enemy" note recorded earlier: that one was about count, this one is
  about which archetype and how tough it is stat-for-stat — two different
  knobs, worth tuning with both in view rather than either alone.
- **"Swarm entity with various variety" — a direction, not a number.**
  Reads as wanting the Bloom's threat to come from breadth and
  composition (more archetypes in the mix, not just more of one) as much
  as from any single unit's stats — consistent with his own
  Act-1/2/3-archetype-introduction plan already on record ("Act 1 sets
  each varied unit type one at a time... Act 2 introduces two bad-unit
  types together, Act 3 has all of them"). Mission 3 is still an Act 1
  mission under that plan, so a single-archetype-heavy roster there isn't
  necessarily wrong for where the campaign currently is — but it's the
  specific thing that read as weak, so worth weighing directly against
  that plan whenever variety gets addressed for real, not just wave size
  or a flat stat bump.

Nothing built or changed. Holding pattern from the difficulty notes
several addenda up is unchanged too — more content first, tuning pass
later, this time explicitly at Maxime's own request rather than an
inferred sequencing call.

## Addendum, 24 Aug 2026 (cont'd): pathing self-assessment, and first mention of a selectable difficulty rank

Same playtest thread, two more messages right after the tally above:
"but really a pass to increase difficulty lvl should be done at some
point ahah. the only think it took a while was clearing the bloom and
that was because I cant path well for shit. XD" and "a difficulty rank
like easy to impossible would be cool." Still tally-mode — nothing built,
nothing changed.

- **Pathing self-assessment — a third, distinct data point, and it cuts
  against "the bloom are weak" rather than confirming it.** Maxime
  attributes Mission 3's slow part (clearing the patch) to his own
  movement/pathing execution, not to the Bloom being tough or numerous.
  Worth keeping separate from the two points above: if the time sink was
  "I moved Lask inefficiently around the patch," that's a session-length/
  UX signal (how legible tile-by-tile movement and the clear radius are
  to a new player), not a combat-difficulty signal, and buffing or
  varying the Bloom wouldn't touch it at all. Not treating this as a
  request to change pathing/UI either — he framed it as his own skill,
  self-deprecating tone ("XD"), not a complaint about the controls.
  Recorded so a future difficulty pass doesn't accidentally lump a
  UX/legibility gap in with an enemy-strength gap.

- **"A difficulty rank like easy to impossible" — first mention, concept
  only, no shape yet.** Reads as riffing off his own "a difficulty pass
  should be done at some point" aside, not a build request — no answer
  yet on the actual open questions a system like this would need (does
  rank scale wave size, individual stats, or both; is it chosen once at
  campaign start or per-mission; does it gate rewards/points; is Act
  1-3's own archetype-introduction plan still the base curve underneath
  every rank, or does rank override it). Per the project's own
  scope-flagging rule this would be a new system, not a tuning number —
  it would touch mission data, the AI/spawn tables, UI (a rank picker
  somewhere in mission-select), and the points economy all at once — so
  it's logged here as a first mention and flagged back to Maxime in chat,
  not started.

Holding pattern unchanged: more content first, tuning pass later, per
Maxime's own repeated call.

## Addendum, 25 Aug 2026: Mission 5's rescue was near-unwinnable — toughened the NPC, geometry fix held in reserve

Maxime, first real Mission 5 playtest: "couldnt save the downed pilot. he
got completely shredded fast." A real, verified diagnosis, not a vibe —
this one wasn't bad luck.

**Root cause, checked against the actual formulas.** Mission 5's wave
list round-robins across the map's three enemy spawn tiles
(`spawnWavesForTurn` in `engine/mission.ts`), and one of them, `(16,6)`,
sits only 3 tiles from the NPC's own spawn point `(13,6)` — inside both
Crawlmass's (vision 3) and Splitfang's (vision 4, moveRange 5) reach on
turn 1, with no wall/line-of-sight check in `isVisibleTo` to block it.
The round-robin assignment puts 2 Crawlmass and the mission's one
Splitfang at exactly that spawn point. Worse: damage in this engine
scales by `100 / defender.effectiveDefense` (`engine/combat.ts`'s
`bloomDamage`), not a flat subtraction — the NPC's original
`effectiveDefense: 70` wasn't "10% squishier than a pilot," it was a
1.43x damage-taken multiplier. A single un-dodged Splitfang hit alone
(38 attackPower × 1.43 ≈ 54) nearly one-shot a 50-HP target outright.
Confirmed empirically, not just on paper: an `npm run sim -- mission_amaranth_5`
trace showed the exact kill — `Crawlmass attacks Downed Pilot for 20`,
`DODGED`, `for 20`, `DODGED`, `Splitfang attacks Downed Pilot for 34`,
`Downed Pilot is downed` — all in the very first hostile phase, before
the player's own squad (deploying 13 tiles away, opposite side of the
map) could possibly reach him.

Walked the fix through `AskUserQuestion` rather than picking one
unilaterally — several independent, non-exclusive levers exist (move the
NPC/spawn geometry apart, stagger the nearby wave's arrival, toughen the
NPC, or change the pack AI's targeting priority globally, which would
affect every future mission with pack-tier Bloom, not just this one).
Maxime: "try 2 fist, then if that wont work, do 1" — toughen the NPC
first (Option 2), and hold the geometry/stagger fix (Option 1) in
reserve if that alone doesn't hold up in real play.

**Fix shipped: `createRescuableNpcUnit` (`engine/units.ts`) — `effectiveDefense: 70`
→ `100`, `currentHp`/`maxHp: 50` → `70`.** Bringing defense to the same
100 baseline every G-tier pilot has removes the 1.43x amplification
entirely rather than just softening it — a Splitfang hit now does 38, not
54. The HP bump (50→70) is real but modest: still clearly under a G-tier
pilot's ~100-105, so the NPC is still meant to be escorted, not ignored,
but a single hit from anything in Mission 5's roster no longer threatens
to delete him outright. Map geometry, wave timing, and AI targeting
priority were all deliberately left untouched this pass, per Maxime's own
sequencing — they're the fallback, not step one.

**Verification, and an honest read of what the sim run showed.**
typecheck/lint/`npm test` (354/354, no regressions — no test hardcoded the
NPC's old stat values), `npm run build`, all clean. Re-ran
`npm run sim -- mission_amaranth_5` as a smoke test with the same
objective-blindness caveat as every prior mention of this sim (the test
AI never attempts a rescue — it can't tell us whether a human can now
save him, only whether the numbers changed as intended and nothing
crashed). Worth reporting straight: in that particular run, the NPC still
died turn 1 — 3 of the wave's available attacks landed through the 40%
Meeps dodge (20+20+34 = 74 against the new 70 HP) in the worst case where
literally nobody tries to protect him. That's the AI-vs-AI floor, not a
claim that the fix didn't help — the same worst-case math against the old
stats wasn't a "sometimes" outcome, it was closer to a guarantee (a
single unblocked Splitfang swing alone used to be enough). What actually
changes this for a human is that Mission 5 no longer requires reaching
him before the very first hostile phase resolves; a real player who
prioritizes him early now has a real, if still tight, window. Whether
that window is wide enough is exactly what Maxime's own next playthrough
will tell us — if it isn't, Option 1 (move the NPC/spawn apart, or
stagger that spawn point's wave — same technique already used to fix
Mission 2's engagement bug) is the documented next step, not a new
decision to make from scratch.

Delivered: `src/engine/units.ts` only (the one file this pass touched),
via the device bridge to its usual repo path.

## Addendum, 25 Aug 2026: hostile-mech Munti priority, and Mission 5's real spawn-distance bug

Two separate pieces of work, one growing directly out of the karma-line/
archetype-scaling conversation, the other out of a live-play photo Maxime
sent mid-session.

**1. Hostile mechs now go for the Munti first.** Grew out of Maxime
extending "archetype" (the reaction-formula work — see
`claude/Bloom_Wars_NPC_Reaction_Engine_v1.md`) up to government/military/
House Amaranth/enemy-mech scale, then landing on the concrete case: "in a
mech to mech battle its kill the munties 1st, then you have the npc
sending you insult lol." Checked the actual AI code before touching
anything, per the project's own "verify against the file" discipline —
Munti-priority logic already existed, but only for Bloom's emergent tier
(`emergentDecision`, Heartwood-only, deliberately board-omniscient per
GDD §5.3's "boss gets board-level heuristics" framing). Every hostile
mech (`unit.kind === "mech"` — House Amaranth Line Troopers, the generic
Unmarked Mech from Mission 1a) was always reflexive tier by construction
(`intelligenceOf` returns `"reflexive"` unconditionally for anything
that isn't Bloom) and reflexive's own targeting has never known what a
Munti is — nearest-visible-target, then best-damage-in-range, full stop.

New `mechReflexiveDecision` (`engine/ai.ts`), vision-gated through the
same `visibleEnemiesOf` the rest of the reflexive/pack tiers already use
(unlike Heartwood's own omniscience — a hostile mech only prioritizes a
Munti it can actually see): attacks a visible Munti immediately if
already in range; if not in range but reachable this turn, moves in and
attacks it; otherwise falls all the way through to unmodified
`reflexiveDecision` rather than wasting the turn chasing a Munti it can't
reach. Routed in `decideHostileAction` with `if (unit.kind === "mech")
return mechReflexiveDecision(...)`, placed after the existing pack/
emergent checks — safe specifically because `intelligenceOf` already
guarantees every mech lands in the reflexive branch, so this can't
accidentally intercept a Bloom unit. Bloom's own reflexive tier is
untouched: instinct-only stays instinct-only, no exception, matching the
already-locked canon that Bloom archetypes have no dialogue/insult
capacity at all — only a human-piloted hostile (House Amaranth) can ever
be the "npc sending you insult" half of Maxime's own framing, and that
half isn't built yet (no barks/dialogue system exists), just kept
consistent with by not letting Bloom inherit targeting logic that implies
a mind making a choice.

Five new tests (`ai.test.ts`, `describe("decideHostileAction — hostile
mech Munti priority")`): in-range Munti preferred over a better-damage
non-Munti target; move-into-range-and-attack when the Munti is visible
but not yet in range; fallback to a reachable non-Munti target when the
visible Munti can't be closed on this turn; plain reflexive behavior
preserved when no Munti is present at all; and a Bloom regression guard
confirming the exact same battlefield (adjacent high-defense Munti,
adjacent ordinary-defense tank) still resolves to the ordinary
best-damage pick for `kind: "bloom"` — proving the new logic didn't leak
across the mech/Bloom line.

Verified: typecheck, lint, all 359 tests clean (up from 354), production
build, and `npm run sim -- mission_amaranth_6` (House Colors — the one
shipped mission that actually fields hostile mechs, 4 House Amaranth Line
Troopers) re-run as a live-behavior smoke test on top of the unit tests.
Delivered: `src/engine/ai.ts` and `src/engine/__tests__/ai.test.ts`, via
the device bridge.

**2. Mission 5's rescue was still losable at the map-geometry level —
found while trying to answer a different question.** Maxime sent a phone
photo of an in-progress Mission 5 run (Downed Pilot already dead, turn
1) and asked: "can you place the downed pilot at the place my muntie is
right now. i think we might need to move thr downed pilot to save his
ass." Checked first rather than assuming: this session has no live
connection to that actual running browser tab (`tabs_context_mcp`
reported no tab group; the device bridge is a filesystem connection to
the repo on disk, not a view into a page already open in his browser) —
the photo was a snapshot of his screen, not something reachable to edit
live, and moving a unit inside an already-in-progress run isn't a
lever this session has at all. Couldn't do the literal ask. What I could
do instead was check whether the game itself was still setting this
mission up to fail the same way, and it was — worse than the previous
fix (defense/HP toughening, see the addendum directly above this one)
had addressed.

**Root cause, checked against the actual map data, not memory of the
previous fix.** `AMARANTH_MISSION_5`'s `bonusObjective.npcSpawnAt` was
still `{x: 13, y: 6}` — 13 tiles from the deploy zone at column 0. No
unit in the game closes 13 tiles in one turn (Munti's own moveRange is
5; the fastest archetype, Meeps, is 6). That means the NPC was
guaranteed at least one entire hostile phase completely undefended before
any player unit could physically reach him, regardless of how tough he
is — the previous fix made him survive a hit better, it never touched
whether the squad could arrive in time to prevent one. This is the
bigger, more dominant cause of "he got completely shredded fast," and it
hadn't been checked before now — the earlier diagnosis (stat
amplification via `100/effectiveDefense`) was real and worth fixing, but
it wasn't the whole story, and I should say that plainly rather than
imply the earlier pass already covered it.

**Fix: `npcSpawnAt` moved from `{x: 13, y: 6}` to `{x: 6, y: 6}`**
(`data/campaignAmaranth.ts`). Column 6 is close enough to deploy for a
fast unit to reach in a single turn, and still sits roughly 10 tiles from
the nearest Bloom spawn seam — farther from hostile spawns than the old
3-tile gap that caused Mission 2's original engagement bug, so this isn't
trading one failure mode for another. Fiction adjusted to match: the
downed pilot reads as found partway back along the egress route rather
than deep in the wreckage, consistent with the briefing's own "get
everyone back through the gap" line. Both fixes — stats and geometry —
stay in together; the earlier toughening remains a real secondary
mitigation, not superseded.

**Verification.** typecheck, lint, all 359 tests clean, production build.
`npm run sim -- mission_amaranth_5` re-run fresh after the change: the
Downed Pilot is never mentioned in the combat log at all across the full
run — no hostile ever reaches or attacks him, a clean contrast against
the previous addendum's own trace showing him dead in the very first
hostile phase. Worth reporting straight, same as always: that sim run
still ends in an overall LOSS (turn-15 turn-limit, `pilot_lask`
permanently lost) — but that's the test AI's own well-documented
objective-blindness doing what it always does on this mission (it never
attempts a rescue or prioritizes Anand's extraction), not a sign the
geometry fix failed. What it confirms is narrower and real: the NPC
himself is no longer a guaranteed turn-1 casualty. Whether a human squad
can now actually reach and escort him in time is, same as every rescue-
objective mention before this one, something only Maxime's own next
attempt can tell us.

Delivered: `src/data/campaignAmaranth.ts`, via the device bridge.

## Addendum, 25 Aug 2026 (cont'd): TransporterPad softlock — a permanently lost pilot never left the deploy screen, and the free replacement was invisible

Maxime, casually: "also, I need a new munties, mine died and I got no
replacement XD." Then a screenshot that made it a real bug report, not a
vibe: the Transporter Pad for Amaranth I.4 (Tunnel Rats), all five
original Warden pads still showing full-brightness, Lask's card reading
completely normal — "Munti · Tier F · Lask's Mek," 0 pts — and, in red at
the bottom: "no active Munti-class pilot is in the deploying squad — at
least one is required to launch." BEAM DOWN greyed out. No sign of a
replacement pilot anywhere on the pad list.

**First, what's real and already working:** the emergency-replacement
system itself (`checkMuntiGuarantee`, `engine/campaignState.ts`) is not
new and not broken — it fires unconditionally on every Debrief screen the
instant the active Munti count hits zero, costs nothing, can't fail, and
was built specifically so the deploy gate (`canLaunchMission`, same file
— "cant go into mission without a munties," Maxime's own rule) could
never brick a save. It almost certainly already ran for Maxime and put a
free G-tier Munti recruit (something like `Recruit "Sprocket"`) onto his
campaign roster. The bug wasn't there — it was one screen later, in
whether that recruit could actually be *seen and deployed*.

**Root cause, found by reading `scenes/TransporterPad.ts` line by line
rather than guessing from the screenshot alone.** The scene has two
modes: a picker (when the active roster is bigger than Act I's 5-pilot
deploy cap) and a no-picker fast path (when it isn't). The picker path
was already correct — it builds its list from `activePilotIds`, the
campaign state's own live, status-filtered roster. The no-picker path —
the one that fires for literally every Act I mission today, since losing
one named pilot and gaining one recruit keeps the total at exactly 5,
never over the cap — did something different: `this.rosterIds =
this.missionDef.playerPilotIds`, the mission's hardcoded static list
(`WARDEN_ROSTER_IDS` in `data/campaignAmaranth.ts`, identical across all
eight shipped missions, and never anything but the original five named
pilots). That list has no concept of permadeath or recruiting — it can't,
it's build-time data. So the dead pilot's card kept rendering (the render
loop draws whatever pilot id it's handed and never checks
`CampaignPilotEntry.status` at all — that's *why* Lask's card looked
completely normal instead of greyed out or marked KIA), and the freshly
generated recruit — who does exist in the campaign state, just under a
different id the static list has never heard of — never appeared on
screen at all, let alone as something deployable. Meanwhile
`canLaunchMission` reads the real campaign state directly, correctly
sees Lask as `permanently_lost`, and correctly refuses to launch — so the
gate was working exactly as designed, while the screen showing it was
lying about who was actually in the squad. That mismatch is the whole
bug: right refusal, wrong (and unfixable-from-here) reason displayed.

Practical effect: this was a full soft-lock, not a cosmetic glitch. Every
Act I mission's static roster always includes whichever named pilot just
died, the picker never turns on to let a player route around it (since
losing-one/gaining-one never crosses the cap), and the deploy gate
correctly blocks every single mission in the game the instant a squad's
one Munti goes down — with nothing on screen showing why or how to fix
it. No amount of clicking pads would have gotten Maxime unstuck; the only
theoretical workaround (buying a second discretionary recruit to push the
active count over the cap and force picker mode on) isn't something a
player could reasonably be expected to find.

**Fix, `scenes/TransporterPad.ts`, one line plus the two comments that
had baked in the wrong assumption:** the no-picker branch now also reads
`this.rosterIds = activePilotIds` instead of the static
`missionDef.playerPilotIds`. Checked this doesn't change anything in the
untouched common case before shipping it: `activePilotIds` is built by
filtering `Object.entries(state.pilots)`, and `createWardenCampaignState`
seeds `state.pilots` by iterating `WARDEN_PILOTS` in order — the exact
same array `WARDEN_ROSTER_IDS` (and therefore every mission's
`playerPilotIds`) is derived from — so for a campaign that's never lost
anyone, the two lists are identical, same ids, same order. The only thing
that changes is the case that was actually broken: once the roster
diverges from the static five, this screen now reflects that instead of
pretending it didn't happen.

No vitest regression test added for this one — this repo has no DOM/
Phaser test environment (documented in earlier addenda), and this bug
lived entirely inside a Phaser Scene's own render/state logic with no
already-extracted pure function to hang a unit test off. Attempted a live
Playwright reproduction instead (seeded `localStorage` with a synthetic
campaign state matching Maxime's exact screenshot — Lask
`permanently_lost`, a generated Munti recruit active — then loaded
TransporterPad for Mission 4 to confirm Lask disappears and BEAM DOWN
clears): hit the same dev-server-unreachable-from-the-browser-tool
environment mismatch flagged twice already in this log, so that
verification is unavailable from this session, same as those two times.
Verified everything that could be: typecheck, lint, all 359 tests clean
(no test depended on the old static-list behavior), production build.
The real check is Maxime's own next launch attempt — if the fix is right,
the dead pilot's pad simply won't be there and the recruit's will.

Delivered: `src/scenes/TransporterPad.ts`, via the device bridge.

Unlike the two previous entries in this log, this one *did* get live
verification, not just toolchain-clean. Maxime granted this session
read-only screen access ("how do I get you to access my browser") and
navigated to the exact TransporterPad screen from his bug photo (Amaranth
I.4, Tunnel Rats). Confirmed on his actual running game: Lask's pad gone,
Recruit "Sprocket"'s pad present, BEAM DOWN live. Fix holds.

## Addendum, 25 Aug 2026: Campaign Shop, reachable from the mission menu
(the `ShopPanel` extraction + `scenes/Hangar.ts`)

Maxime: *"can you make me a litle box for the ui I would see in the
antfarm. so I can buy stuff and upgrade between mission."* Clarified via
two follow-up questions before building anything: he wants it reachable
**"from the mission menu"** (not gated behind finishing a mission, unlike
Debrief's existing shop), and **"actually working in the game"** — a real
scene wired to live `CampaignState`, not a mockup.

**What this maps onto:** re-read
`claude/Bloom_Wars_Antfarm_Carrier_Hub_v1.md` in full first, per this
project's own "check the master index / relevant docs before assuming
anything is settled" rule. That doc's §9/§12 already recommend building
close to exactly this, now rather than waiting for Act II: at Maxime's
current rank (2nd-Lt, missions 1-11), "Hangar Deck, Berths... already
functionally live per §6a's Tier 0, this just gives them a room and a
scene. Workshop's existing half (gear tier, spare parts, mek secondaries)
is also already live pre-hub (it's Debrief.ts today)." So this wasn't a
new system — it's a second, always-reachable entry point onto the exact
purchase/recruit engine that Debrief.ts already shipped and this log
already covered (22-24 Aug entries). No scope flag was needed for that
reason: nothing new was designed, only relocated and re-exposed.

**The one real engineering decision: extract before duplicating.**
Debrief.ts's ~270-line shop-drawing block (pilot tier upgrades, mek
secondaries, spare parts, discretionary recruit) could have been copy-
pasted into a second scene, but this project has hit that exact failure
before — `pilotRegistry.ts` and the `ALL_HOSTILE_MECHS` merge both exist
specifically because two copies of the same table drifted apart. Instead
it's now a shared class, `scenes/shop/ShopPanel.ts`: same entry-building,
same row-drawing, same purchase calls, same pagination, moved out
verbatim. Both `Debrief.ts` and the new `Hangar.ts` construct one against
whatever `CampaignState` and vertical viewport band they've got, and
whichever screen you're on, it's the same code drawing it — nothing to
keep in sync by hand. `ShopPanel` deliberately does *not* own "leaving"
(saving + navigating away) — Debrief's footer button reads "RETURN TO
BASE" and closes out a mission, Hangar's reads "BACK TO MISSION SELECT"
and doesn't — different enough, and cheap enough (~10 lines each), that
forcing a shared abstraction onto that difference wasn't worth it.

**`scenes/Hangar.ts` (new):** loads campaign state the same way Debrief
does (`loadCampaignState() ?? createWardenCampaignState()`), renders a
`ShopPanel`, draws its own header and a footer with a live company-points
readout and the exit button. Deliberately carries *none* of Debrief's
mission-specific logic — no `computeMissionEarnings`, no permanent-loss
application, no `checkMuntiGuarantee`, no bonus-objective reveal. Those
all need a just-finished `Mission` instance; Hangar doesn't have one and
isn't supposed to. A player can open it, spend points, close it, and
nothing about "what just happened in a mission" is touched.

**Wired into `MapSelect.ts`:** a fixed "CAMPAIGN SHOP" button, top-right
of the header, outside the scrollable mission list so it survives
scrolling and campaign-tab switching and stays reachable without playing
or finishing anything first — the actual ask.

**Naming — flagged, not decided.** The Antfarm doc's own §10 leaves open
whether Act I's meta-screen gets any visual identity/room-name branding
at all, or stays deliberately bare, and says so explicitly — that
question is still open as of this pass. Kept `Hangar.ts` unbranded and
purely functional (on-screen title just reads "CAMPAIGN SHOP"), same
discipline `TransporterPad.ts`'s own header already commits to for itself
("no Providence references, no crew banter, no narrative dressing").
"Hangar" is only this file's internal scene key — not a claim that the
Antfarm's actual Hangar Deck room fiction is live. Maxime's call whether
this gets a name/room treatment later; `claude/Bloom_Wars_Antfarm_Carrier_Hub_v1.md`
§10 is the doc to update if/when that's decided.

**Verification:** typecheck clean; lint clean; full test suite still
359/359 (no test touches scene code, so this pass couldn't have moved
that number either way); production build clean. One real bug caught and
fixed in this pass before any of that: `ShopPanel`'s first draft used
TypeScript's constructor-parameter-property shorthand (`constructor(
private scene: ..., private state: ..., ...)`), which this repo's
`tsconfig.json` forbids (`erasableSyntaxOnly: true` — the codebase's
existing convention, confirmed by grep, is to declare fields and assign
them in the constructor body instead). Caught by `npm run typecheck`
immediately, fixed the same way, re-verified clean. No live-Playwright
pass this time (same dev-server-unreachable-from-the-browser-tool
environment gap noted twice already in this log) — the layout reuses
Debrief's own already-shipped, already-verified vertical viewport budget
(`viewportBottom: 566`, footer at `604`) rather than inventing new
numbers, which is the most honest confidence available short of Maxime's
own screen.

Delivered: `src/scenes/shop/ShopPanel.ts` (new), `src/scenes/Hangar.ts`
(new), `src/scenes/Debrief.ts`, `src/scenes/MapSelect.ts`, `src/main.ts`
— all via the device bridge.

## Addendum, 25 Aug 2026: the Player AI engine — repair-capable, and its
own directory (`src/sim/playerAi/`)

Maxime, opening the ask: *"Lets make our test ai good enough to run
mission 9-36. because after this I'm gonna be having you build the rest of
the mission."* Investigated first rather than assuming scope: read
`claude/Bloom_Wars_Independent_Campaign_The_Amaranth_Reckoning.md` in full
for what 9-36 actually needs (three new objective types — Survive N
Turns, Contested Landing, Protect Asset; Act II's composition choice and
ship call-ins; Act III's capital-ship stakes; Requiem unlocking at Mission
12), and re-read the old `src/sim/testPlayerAi.ts`'s own header, which
already named its real gaps honestly: no repair/support usage, no ability
usage, no multi-turn planning.

Asked Maxime how far to take it rather than guessing. His answer: *"i want
it to be able to test the game like a player would. make it a separate
engine we can plug into our future games. its something we can reuse like
the characterisation formula."* Bigger than any of the three options
offered — closing every gap AND treating it as a real, portable system,
not a patched-in heuristic. Flagged the honest limit rather than silently
either overbuilding or underdelivering (see `src/sim/playerAi/index.ts`'s
own header for the full version): true engine-agnostic reuse would mean a
generic adapter layer with no Bloom Wars types in it at all, and there's
no second game yet to design that adapter against — building one now would
be guessing at an abstraction with nothing real to validate it. What
shipped instead is a clean, self-contained, well-documented module with
one real entry point, easy to lift wholesale into a future project later
(a translation exercise at that point, not a rewrite) — reusable in the
sense that's actually buildable today.

**What's new — `src/sim/playerAi/` replaces the old flat
`src/sim/testPlayerAi.ts`:**
- `types.ts` — the shared decision/log shapes.
- `combat.ts` — the existing kill/focus-fire/retreat/kiting logic, ported
  unchanged in effect. Still deliberately reuses engine/ai.ts's own damage
  math (estimateDamage, bestAttackTargetInRange, moveToward, isVisibleTo)
  rather than forking it — same anti-duplication call this project has
  made before (pilotRegistry.ts, ALL_HOSTILE_MECHS, yesterday's
  ShopPanel).
- `support.ts` (new) — repair decisions. Heal-in-place only (matches
  `engine/mission.ts`'s own `getRepairableFrom`, which is adjacency-only
  too — no new "path to the medic" problem invented). Two thresholds: a
  critically hurt adjacent ally (<40% HP) is worth healing even ahead of
  this unit's own retreat instinct; a routinely hurt one (<85%) is worth
  healing instead of chip-damaging a target that isn't dying to the hit
  anyway, once a kill and the critical case are both ruled out.
- `index.ts` — composes it all: kill > critical repair > retreat/hold >
  routine repair > focus fire > advance > seek fight.

**The other half — `src/sim/run.ts`'s per-unit action loop.** Repairing
without this would have been close to useless: the harness only ever
asked a unit for ONE decision per mission turn, so a Munti that spent its
first action healing would just lose its second action to nothing,
because nothing re-asked it what to do next. A unit now gets re-asked as
long as it still has actions AND its last decision was a repair — every
other decision shape either already ends the turn (attack) or is
deliberately left alone on purpose (re-deciding right after a pure move
risks a retreat-then-immediately-reverse-course oscillation, since the
unit's new position can flip the "am I still spotted" check that gates
retreat — see `index.ts`'s own retreat-gate comment). A 4-iteration guard
caps it as a backstop, not because 4 means anything.

**Explicitly NOT done this pass, and why (see `index.ts`'s header for the
full version, this is the short one):**
- Ambush / Interdict / Screen / Sensor Sweep. All four are real, shipped
  verbs (23 Aug ability-depth pass) this engine still never touches. Not
  added because a wrong heuristic for a charge-limited ability
  (Sensor Sweep, Screen — both capped per mission) is worse than never
  using it: burning a real player's resource at the wrong moment is a
  worse balance signal than an honest zero.
- The Heirloom (Requiem/Severance). Not deferred by choice — there's no
  engine hook to defer TO. `engine/mission.ts` has no `useSeverance()`-
  shaped method yet; `SEVERANCE` (data/abilities.ts) is still pure data.
  Doesn't block anything today since Requiem doesn't unlock until Mission
  12 anyway.
- Mission-objective awareness (hold a zone, protect an asset). The engine
  still only knows "where are the enemies," not what the mission's win
  condition actually is.

**Verification — this is the one where honest regression-testing actually
mattered, since this pass touches how every past mission gets sim-tested,
not just adds something new.** Typecheck, lint, all 359 tests, build: all
clean. Beyond that: checked out the pre-change `testPlayerAi.ts`/`run.ts`
from git history (commit `1da745e`) into throwaway scratch files and ran
both the old and new AI against all eight shipped missions
(`mission_amaranth_1` through `_8`) to compare, not just trusted that
"tests still pass" was enough (repair usage isn't covered by any existing
test — nothing regresses in vitest either way). Result: no mission
flipped WIN↔LOSS. Missions 2, 4, 5, 7 were essentially identical.
Mission 3 went from a 177-turn near-stall (`hold_no_target=152` — the sole
survivor wandering, unable to find anyone, the exact pathology the 22 Aug
retreat-gate fix was built to prevent) to a decisive 12-turn loss — a real
improvement, not a wash. Mission 6 went from a 12-turn win with 3
permanent losses to a 5-turn win with 1 — also a clear improvement.
Mission 1 ("Muster," the tutorial) is a LOSS under both the old and new
AI — confirmed this is NOT something this pass introduced, but it's worth
flagging on its own merits: a tutorial mission losing in sim, even against
an imperfect bot, is worth a look whenever balance passes resume for Act
I's front half. Not fixed here — that's a balance/design call, not an
engineering one, and outside what was asked today.

**Also shipped:** a one-field stub on `CampaignMission`
(`data/types.ts`) — `socialHook?: string`, free-form, nothing reads it
yet. Maxime, on 9-36: *"I want the combat side to be done, with the open
nodes for the social interaction that will be the best part of the game
imho"* — then, asked whether to build the real node system now or just
leave a slot, picked the slot: *"Stub an empty hook field now."* This is
purely a landing spot for whenever `claude/Bloom_Wars_NPC_Reaction_Engine_v1.md`
(confirmed formula, explicitly "zero code, not scheduled") or whatever it
feeds actually gets built — so future missions don't need a structural
rework to gain somewhere to name a social beat.

Delivered: `src/sim/playerAi/index.ts`, `combat.ts`, `support.ts`,
`types.ts` (all new), `src/sim/run.ts`, `src/data/types.ts`,
`src/engine/ai.ts`, `src/engine/__tests__/mapsAmaranth.test.ts` (comment
fix only) — via the device bridge. `src/sim/testPlayerAi.ts` is deleted
here; Maxime still needs to delete that same stale file on his own
machine by hand (the device bridge writes, it doesn't clean up files it
didn't touch).

## Addendum, 25 Aug 2026 (same day, cont'd): squad cohesion — "wierd
mission 1 is easy"

Maxime playtested the delivery above and called it immediately: *"wierd
mission 1 is easy."* He was right and the sim was wrong. Root-caused
against the actual turn log rather than guessed at (`npm run sim --
mission_amaranth_1`) — two real, pre-existing bugs in the Player AI
engine's positioning logic, neither introduced by the repair pass above
(confirmed: the pre-restructure AI, pulled from git history, lost Mission
1 the exact same way).

**Bug 1 — no squad cohesion.** Meeps move 6 tiles a turn, Tank moves 3,
Munti moves 4 (`data/units.ts`). `seek_fight` picked a path toward the
nearest/weakest enemy per unit with zero awareness of anyone else's
position, so by turn 3 the two Meeps had sprinted clear across the map
and started fighting alone while the rest of the squad was still three-
plus tiles back. Lask — the one unit who can heal — never once ended up
adjacent to a hurt ally the whole mission, because the squad was two
separate clusters from turn 2 on. The Bloom defeated it in detail, one
isolated unit at a time, instead of ever facing a formed line.

**Bug 2 — retreat/seek_fight oscillation.** Rourke's actual sim
coordinates from turn 7: `(12,2) → (6,2) → (12,2) → (6,2) → (12,2)` — the
same two tiles, five turns straight, doing nothing while her squad died
around her. At (12,2) something could see her, so low-HP retreat fired,
sending her to (6,2). From (6,2) nothing could see her, so the "no
threat, go find the fight" fallback walked her straight back to (12,2) —
where she got spotted again. Neither branch had any memory that the other
one had just run.

**First fix, `src/sim/playerAi/combat.ts` — `cohesiveMoveToward` +
`nearestLivingAlly`.** `seek_fight` (the pure-repositioning fallback, no
attack available) now caps how far a unit will voluntarily advance ahead
of its nearest living ally (`MAX_LEAD_FROM_ALLIES`, 5 tiles — tuned around
the Tank's own move range plus enough slack that a Meeps isn't leashed
tile-for-tile). Deliberately kept out of `engine/ai.ts` — GDD §5.3 spells
out the real hostile tiers as "no coordination" on purpose, and this file
has no business changing that; cohesion is a Player-AI-only concept.
Separately, `index.ts`'s final fallback now checks hpFraction directly: a
wounded, unspotted unit with nothing to kill or heal closes on its nearest
living ally instead of chasing the enemy alone (`regroup_low_hp`) — this
is what actually breaks the oscillation, not just the cohesion cap on its
own.

**Second fix, same session, found by NOT trusting one clean run.** First
verification pass looked great — Mission 1 flipped to a WIN. But combat
has real randomness (`engine/mission.ts`'s Meeps dodge roll,
`Math.random() < MEEPS_DODGE_CHANCE`, confirmed by grep before trusting
any single result), so single-run before/after comparisons aren't
conclusive on their own. Ran Mission 1 five times back to back before
calling it done: four of five never finished at all —
`RESULT: ONGOING on turn 501 (guard iterations: 500)`, the sim harness's
own 500-turn safety cap. The AI-decision breakdown on the captured run
named the bug outright: `regroup_low_hp=979` out of `1030` total
decisions — a unit already standing as close to its nearest ally as the
map allowed kept re-choosing "regroup toward ally" every single turn
forever, since nothing about "am I hurt / am I unspotted / is there a
living ally" ever changes on its own once regrouping can't make further
progress. Worse than the oscillation it replaced — that one at least
resolved eventually (badly). Fixed by gating the regroup branch on real
movement: only take it if the computed path is actually longer than 1
tile (genuine progress toward the squad); if regrouping can't help
anymore (already adjacent, or blocked), fall through to the same
cohesion-capped chase everyone else gets rather than standing still
forever. A real player boxed into a corner with nowhere left to fall back
to has to commit too — that's a live, resolving turn instead of a mission
that never ends.

**Verification, this time with the stress test built in from the start:**
typecheck, lint, 359/359 tests, build all clean at each step. Then 8 runs
each of all 8 shipped missions (64 runs total) specifically watching for
`ONGOING` — zero timeouts, across every mission, this time. Mission 1
landed at roughly 5-of-8 wins across that sample — genuinely contested
now rather than a systematic near-wipe, which reads right for a tutorial
mission against an imperfect heuristic bot rather than a real human.
Missions 2/4/7 stayed rock solid at 8-of-8 wins, unaffected. Missions
3/5/8 are consistent, clean losses across all 8 runs each, every one
resolving in the 8-16 turn range with no stalling — worth flagging on its
own merits (possibly genuine balance tuning still needed for those three,
now that the AI issue clouding the read is gone) but not touched here;
that's a design call, not today's engineering one.

**Also written this pass:** a short addendum to
`claude/Bloom_Wars_NPC_Reaction_Engine_v1.md` (§4a) capturing an
observation from the same conversation — Maxime asked whether there's a
way to bridge the Player AI engine and the future social/catalyst system.
Not designed or built (that doc's own gate is still closed), just recorded
so it isn't lost: the engine's own action log (kills, repairs, downings,
permadeath verdicts) already produces exactly the "what is this pilot
visibly doing right now" data the catalyst formula's **c** term needs,
which means combat won't need to be re-instrumented later to feed it.

Delivered: `src/sim/playerAi/index.ts`, `combat.ts`, `types.ts`,
`src/sim/run.ts` — via the device bridge.


## Addendum, 25 Aug 2026: terrain/cover, focus fire — and three real bugs the stress test caught, not just one

Maxime, continuing the same thread: *"can you teach the ai to traverse terrain, use cover, focus fire, bait?"* Three of four landed. This one took a lot longer to actually finish than the ask sounds like it should have — worth being straight about that rather than just presenting the clean end state, because the honest story is "built two real features, then spent most of the session chasing regressions those features' own stress-testing surfaced, some real and some turned out not to be."

**What shipped, mechanically:**
- **Terrain/cover** (`combat.ts`) — `data/tiles.ts`'s `defenceStars` was already real, live combat data (`engine/combat.ts`'s damage formula already gives every attack a genuine 10%-per-star reduction to whoever's standing on the defender's tile), but the positioning code never asked "which reachable tile is actually defensible." `terrainQuality()` now folds into `retreatPath` and `reachableIntoRangePreferringSafety` as a scoring nudge.
- **Focus fire** (`combat.ts`) — `focusFireTargetInRange` replaces `engine/ai.ts`'s `bestAttackTargetInRange` (attacker-relative "who do I hit hardest," correct for the real hostile AI it's shared with) with the squad's shared, attacker-independent priority target (`weakestTarget`'s own measure), so different units asking "who do I shoot" in the same turn converge on finishing the same enemy instead of splitting damage.
- **Bait** — not built. See the closing section below; this is the one part of the ask still open, and it needs Maxime's call before it's worth starting.

**Bug 1 — terrain weights were 5-10x too strong, quietly undoing the squad-cohesion fix from earlier the same day.** First cut used `terrainQuality * 3` (retreat) and `* 15` (advance-into-range) against dominant terms scaled `*10`/`*100` per tile. Sounded like a tiebreaker; wasn't — terrain's own 7-point spread could swing a tile's score by up to 105, comparable to or bigger than the distance/cost term it was supposed to sit under. In practice this meant different units in the same squad each independently drifted toward whichever bit of cover was nearest to THEM, scattering the formation the cohesion fix had just built. Caught via the 64-run stress discipline, not eyeballed: a healer (Lask) dropped to 10% hp by turn 5 of what used to be a comfortable win. Fixed by cutting the weights to `*1` (retreat) and `*3` (advance-into-range, which already has its own `*100` dominant term) — genuinely small enough to only ever break a near-tie, which is what the design comment always claimed this was.

**Bug 2 — retreat and regroup fighting each other, a real round-trip.** `retreat_low_hp` only fires while a unit is currently spotted; the moment it isn't, that gate closes. The old `regroup_low_hp` handed off to plain `moveToward(ally.pos)` with zero awareness of whether closing on the ally walked back into a hostile's sensor range — and the ally is usually near the fight. Result, confirmed against an actual captured log (Foxfire, Mission 1): retreat and regroup alternated for 6+ turns straight, round-tripping between the same two tiles while a Crawlmass took free shots. Fixed with a new `regroupPath` (`combat.ts`) that scores reachable tiles the same way `retreatPath` does but penalizes any tile a hostile would actually see the unit standing on — closing the gap with the squad is still the dominant term, staying unseen is a secondary one, not an absolute veto.

**Bug 3 — the real one, found only after the first two fixes still didn't bring win rates back: a critically wounded unit had no reason to ever stop fighting.** `focusFireTargetInRange`'s first cut had no floor on how little damage was worth attacking for — `weakestTarget`'s measure is intrinsic to the *target*, blind to whether *this* attacker can hurt it at all, and `engine/combat.ts`'s own damage formula against a Bloom scales an attacker's output by its OWN currentHp/maxHp fraction (a formula already flagged in that file as an unvalidated placeholder, not something new this pass). Two compounding failures: (a) a unit could get permanently stuck re-attacking a target for literally 0 damage — confirmed as an actual reproducible `ONGOING` (500-turn guard) sim run, Farsight locked onto one Crawlmass for 489 straight decisions; (b) even after filtering out true 0-damage attacks, a critically wounded unit (down to 4% hp) would still find SOME small positive-damage target nearly every turn and keep grinding — 273 of 340 decisions in one captured 290-turn run, never retreating because nothing was currently spotting it, never regrouping because the regroup check only fired after combat options were exhausted, and "some damage possible" was never exhausted. No real player pokes an enemy for 3 damage at 4% hp when nothing is chasing them; they fall back to the medic.

Fixed in two parts: `focusFireTargetInRange` now filters to targets this specific attacker can deal real (>0) damage to, falling through to "nothing worth attacking here" rather than the full list when none qualify — and `index.ts`'s `advance_into_range` branch no longer treats "moved nowhere, found nothing worth shooting" as a valid decision to return (that was silently pre-empting every lower-priority check, including regroup, forever). More importantly, the low-hp regroup check moved from the bottom of the priority chain to right after the retreat/cornered check — a critically wounded unit now tries to fall back to its squad's healer *before* considering any further offense, not after. Guaranteed kills are unaffected (that check is unconditional and sits above everything). This is the fix that actually mattered — the terrain-weight and round-trip fixes were real bugs and worth having fixed, but neither one, alone or together, explained the regression; moving self-preservation ahead of marginal offense is what did.

**Verification — the discipline held all the way through, including two false starts worth naming rather than hiding.** After each of the three fixes above, ran the full typecheck/lint/359-test/build gate (all clean every time) plus an 8-mission stress batch watching specifically for `ONGOING`. First pass after the weight fix alone: still bad (missions showing 1-2/12 wins on Mission 1, one fresh `ONGOING`). Rather than trust that read, ran a proper A/B — reconstructed the exact pre-this-pass (cohesion-only) baseline in scratch and ran it head-to-head against each change in isolation, at n=20-24 instead of n=8-12, because Mission 1 turned out to be noisier than the earlier "5-of-8" read suggested (true baseline across ~100 runs today landed closer to 30-35%, not 62% — the earlier 5-of-8 was a real result, just from the high end of a wide binomial spread, not a stable rate). That A/B is what isolated Bug 3 as the actual dominant cause, distinct from Bugs 1 and 2, both of which tested clean in isolation once their own fixes were in. Final state: two independent 8-mission×8-run sweeps (128 runs) plus everything run during isolation testing (250+ runs total today) — zero `ONGOING`, no more 200-500-turn outliers (worst case now 96 turns, and that run actually resolves as a clean WIN with real combat throughout, not a stall), and every mission's win rate is consistent with its own pre-this-pass baseline: 1 ≈ 30-40% (noisy but was already noisy), 2/4/7 ≈ 100%, 3/5/8 = 0% (pre-existing, not touched by anything in this pass — confirmed via the same A/B), 6 ≈ 40-60% (also noisy both before and after).

**Missions 3, 5, and 8's 0% win rate is not new and not fixed here.** Confirmed today, directly, via the baseline reconstruction: these three were already a clean sweep of losses under the cohesion-only AI, before any terrain/focus-fire code existed. That's consistent with what the previous addendum already flagged ("possibly genuine balance tuning still needed for those three... a design call, not today's engineering one") — today's pass just re-confirmed it under a stricter test rather than changing it either way. Not touched, on purpose — rebalancing three missions' enemy composition is a different kind of work than "teach the AI to use cover," and would be exactly the kind of scope growth this project's own rule says to flag before just doing.

**Bait — still not built, and here's the actual ask.** Everything above is a *reactive* heuristic: score the tiles/targets already visible this turn. Bait is a different shape of thing — deliberately exposing a unit and predicting how the hostile AI will respond to it, which means actually running `decideHostileAction` (`engine/ai.ts`) against hypothetical player positions before committing to one, not just scoring a position in isolation. It also has a real missing prerequisite: this engine has never once called `enterOverwatch()` — bait's whole point is usually "expose a unit while an ally is already braced to punish whatever takes it," and there's no overwatch-usage logic here to brace with yet. Given how much this session's other three features ended up costing to get right even with well-understood, reactive heuristics, I'd want predictive-simulation logic to get its own dedicated pass rather than being squeezed in alongside three other things — your call whether that's worth scoping now or later.

Delivered: `src/sim/playerAi/combat.ts`, `src/sim/playerAi/index.ts` — via the device bridge.


## Addendum, 25 Aug 2026 (cont'd): a correction, then Taunt — Meeps, mission 8 onward, the actual answer to "bait"

Two things in one entry: fixing a wrong claim from the addendum directly above, and the feature that grew out of it.

**Correction first, because it matters and I'd rather say so than let it sit.** The bait section above claimed "this engine has never once called `enterOverwatch()`." That's flatly wrong — checked while building something else and found it stated as fact, dated, in this very file: Overwatch shipped 23 Aug (the "mission-length pass" addendum), two days before I wrote that sentence. I conflated two different things, one real and one not: the hostile AI genuinely never reacts to a player unit already on Overwatch when deciding whether to approach (reflexive/pack tiers have no such awareness, and that part of the bait scoping was accurate) — with "Overwatch doesn't exist," which is false. Should have grepped before writing it instead of trusting memory of what this session had built. Doesn't change the actual bait recommendation — predictive simulation is still real, separate, bigger work — but the reasoning I gave for it was partly wrong, so correcting it here rather than leaving it standing uncorrected.

**Taunt.** Maxime, picking up the closing question from the addendum above: a single-turn, once-per-mission, player-triggered ability rather than the predictive-AI version of bait — proposed for Reeps first, but landed on Meeps instead: "the taunt would have been made specifically for meep to save the munties in case of emergency" — and specifically gated to Mission 8 (The Choir Sings) onward, "only give them the ability for this mission onward," with the mission's own briefing hinting at the swarm rather than the game announcing a new ability, "like xcom hostile scans." Also asked directly whether a WoW-style threat meter would be easier to build than hooking into each targeting function — a real question, answered honestly: no. A full threat system is a bigger, more general piece of architecture than this needs; a simple flag checked first by each targeting tier, the same trick the Munti-priority pass already used the same day, gets the identical guaranteed-redirect result for far less surface area. Worth revisiting only if a whole family of threat-manipulating abilities is ever on the table — not for one ability.

**What it does.** `abil_taunt` (`data/abilities.ts`): until the taunting unit's own next turn, every hostile targeting rule that's choosing among multiple already-visible targets picks it first — ahead of the mech/boss "kill the Munti first" priority added earlier today, ahead of a pack's shared lowest-HP×DEF pick, ahead of plain reflexive's nearest-target rule. It does not grant visibility on its own — a hostile that can't already see the taunting unit is unaffected, so this is a positioning tool (get seen on purpose) not a "shout across the map" one. No defensive bonus, on purpose: the risk is already asymmetric in the right direction — a downed Meeps just restocks next mission, a downed Munti has no equivalent mid-campaign safety net for a combat loss.

**Where it hooks in — `engine/ai.ts`, all four targeting functions, same technique as the Munti-priority pass earlier today: check the special case first, fall through to the tier's own normal pick if it doesn't apply.** `reflexiveDecision`, `sharedPackTarget` (pack tier — Splitfang, and Mission 8's own Choir), `mechReflexiveDecision`, and `emergentDecision` each get a one-line `taunting` check ahead of their existing logic; `mechReflexiveDecision`/`emergentDecision`'s checks sit ahead of the Munti-priority check specifically, since overriding that is the entire point. Singleton-list trick borrowed directly from the existing Munti-priority code (`bestAttackTargetInRange(map, unit, unit.pos, [taunter], allUnits)`) so nothing else in scope can outscore the forced target.

**The mission-gate mechanism — genuinely new, not a variant of anything that existed.** Every other ability is either baked into an archetype permanently or unlocked by gear tier (points spent). Taunt is neither — it's gated by campaign progress, and nothing currently tracks "which mission number is this" anywhere (`CampaignState` has no such field; `rourkeRank`'s own comment already flagged the identical gap for rank-up triggers). Rather than invent that tracking, or have `engine/mission.ts` reach into a specific named campaign's mission array (it deliberately never has — it only ever works from whatever `CampaignMission` it's handed, which is what let missions 1-8 stay portable across every test and `npm run sim` call), the grant lives on the mission data itself: `CampaignMission.bonusAbilityUnlocks` (`data/types.ts`), read by a new `Mission.applyBonusAbilityUnlocks` at deploy time, layering the named ability onto the named path's units on top of their normal archetype kit — never mutating the shared static archetype array. Mission 8 carries `[{path: "meeps", abilityId: "abil_taunt"}]`; missions 9-12 will need the same entry copied onto them once they're built, since "onward" isn't solved generically — flagged in the field's own comment as the moment to promote this into real campaign state, if it ever gets tedious enough to be worth it. Not before.

**Mission 8's briefing** already did most of the "XCOM-alert" work Maxime asked for — "dozens of voices, all one voice... coordinated... don't get spread out" was already there. Added one clause naming the actual word: "If it really is a swarm, the ones who scatter thinnest are the ones it converges on first." No popup, no "NEW ABILITY UNLOCKED" — the action bar just quietly has a new button from here on, per the UI convention every other ability-depth verb already follows (grey-not-hide).

**Verification.** typecheck, lint, all 371 tests clean (up from 359 — 12 new: mission-gating, once-per-mission, ends-turn, and refusal coverage in `abilities.test.ts`; taunt-overrides-every-tier coverage, including a visibility-gate check proving taunt doesn't bypass fog of war, in `ai.test.ts`), production build. Beyond the suite: ran a real forced scenario through the actual `Mission` class rather than trusting synthetic unit tests alone — parked Rourke and Lask both adjacent to a live Mission 8 spawn, taunted, then ran the hostile phase. All four Choir units (pack tier) converged on the taunting Rourke exactly as designed, leaving Lask (adjacent, would otherwise have been the pack's own lowest-HP×DEF pick) alone; the two nearby Crawlmass, which have no pack coordination and no taunt awareness relevant to them individually, went after Lask instead since she was their own nearest target regardless. Worth reporting straight: that specific point-blank, whole-pack scenario put all four Choir attacks on Rourke in one hostile phase and downed her outright (32 damage × 4 against 105 HP). Restock kicked in exactly as it should (confirmed in the log: "exempt from permadeath — always a standard restock"), so this is the real teeth of "no defensive bonus" showing up in practice, not a bug. A real player won't often stand a Meeps in the middle of a full four-unit pack's melee range on purpose, but it's possible, and worth knowing the actual ceiling on how bad a bad Taunt can go before playing it.

**Also confirmed, not fixed:** `npm run sim -- mission_amaranth_8` still loses every run, same as before this pass — expected and not a regression, because the sim's own player-side autoplay bot (`src/sim/playerAi/`) has no idea Taunt exists; it's a manual-play ability and nothing taught the bot to use it. Mission 8's bot-driven loss rate says nothing about whether Taunt actually helps a human — only your own next playthrough can answer that. Didn't extend the bot to use Taunt this pass without asking; happy to if it'd be useful for future balance-testing, but it's a real, separate piece of work (the bot would need its own "is my Munti-equivalent in danger" heuristic to decide when taunting is worth the one-time spend), not a byproduct of building the ability itself.

**One more thing worth flagging while in `data/abilities.ts`, unrelated to Taunt itself but real:** the Data Pack's own ability table (§6) still lists six abilities. The engine has ten now — `abil_ambush`, `abil_interdict`, `abil_screen`, `abil_clear_bloom`, and now `abil_taunt` are all real and shipped, none of them in that doc. This predates today; it's been drifting since the 23 Aug ability-depth pass. Not fixed here — updating a Data Pack docx is its own piece of work, not a side effect of adding one more ability to a table that was already six behind — but flagging per the project's own rule rather than letting it compound further unnoticed.

Delivered: `src/data/types.ts`, `src/data/abilities.ts`, `src/data/campaignAmaranth.ts`, `src/engine/units.ts`, `src/engine/mission.ts`, `src/engine/ai.ts`, `src/scenes/Battle.ts`, `src/engine/__tests__/abilities.test.ts`, `src/engine/__tests__/ai.test.ts` — via the device bridge.


## Addendum, 25 Aug 2026: the Player AI learns the mission's actual objective — hold_zone, extract_unit, clear_bloom, and the rescue bonus (Phase 1/2 of the ability/objective plan)

Maxime, closing out the planning conversation from the addendum before this one: "keep the plan in mind do what you recommend. then we gonna build the basic bones of mission 9-36 in batch of 4." "What you recommend" was the sequencing already laid out in `claude/Bloom_Wars_Player_AI_Ability_And_Objective_Plan_v1.md` — architecture change first, objective awareness second, ability usage staged and deferred after that. This entry is those first two phases, built. Ability usage (Ambush/Interdict/Screen/Sensor Sweep/Taunt) is still exactly where the plan left it: not started, Taunt specifically still recommended against automating.

**What changed, mechanically.** `decidePlayerAiAction` grew a 5th argument, `context: PlayerAiMissionContext` (new interface, `types.ts`) — a narrow, read-only slice shaped to match `engine/mission.ts`'s real `Mission` class exactly (`mission.mission.objective`, `mission.map.holdZone`), so `run.ts` just passes the live `Mission` instance straight in, no adapter object. `PlayerAiDecision` grew an `action?: "clear_bloom" | "rescue"` field alongside the existing `path`/`attackTargetId`/`repairTargetId`; `run.ts`'s per-unit loop grew a two-line dispatch calling the matching real `Mission` verb, and its "keep asking this unit for another sub-decision" condition now also fires after either of these two actions, not just a repair — both `clearBloom()` and `rescueUnit()` share repair's exact "costs 1 action, does not end the turn" contract.

**Turned out narrower than the plan itself sketched, and worth saying why.** The plan's own §1 imagined passing through `canScreen`/`canAmbush`/`canInterdict`/`canClearBloom`/`canRescue` etc. as Mission method calls. Checked before writing any of it: `canClearBloom`'s and `canRescue`'s OTHER gates (abilities/side/downed/actionsRemaining) are all already plain fields on `unit`, which the decision function already has — nothing about them needed a live Mission reference at all. So `hasClearableBloomNearby` (`combat.ts`) and `findAdjacentRescuableNpc`/`findRescuableNpcOnBoard` (`support.ts`) read `map`/`allUnits` directly, mirroring `engine/mission.ts`'s own private `clearableBloomTiles` scan and `createRescuableNpcUnit`'s `npcIncapacitated` flag respectively. The one thing that genuinely can't be inferred from board state alone is *which objective this mission actually has* — confirmed directly against `MISSION_1A` (`map_city_sweep_01`), which has `bloom_mat` tiles as plain damage terrain with no `clear_bloom` objective or bonus attached at all, so "a Munti stands near bloom_mat" can't by itself mean "clear it." That's the one thing `context` ended up carrying: `mission.objective`, `mission.objectiveParams.extractUnitId`, `mission.bonusObjective?.kind`, `map.holdZone`, `map.exitTiles`. Smaller surface, same result, less to keep in sync later.

**Five new decision branches**, each logged under its own new `PlayerAiReason` (`types.ts`):
- `carryingRescueId` set → beeline for the nearest exit tile, full stop. Combat is engine-refused while carrying (`attack()`'s own guard), so there's nothing else useful this decision could do — checked first, ahead of even "are there any enemies at all," since a carrier still has somewhere to be on a cleared board.
- Adjacent to an uncarried rescuable NPC → pick them up. Cheap enough (1 action, doesn't end the turn) to take on sight, second-highest priority.
- Munti, objective-gated (`objective === "clear_bloom"` OR `bonusObjective?.kind === "clear_bloom_patch"`), not in immediate danger (same `RETREAT_HP_FRACTION` bar the critical-repair check already uses) → clear bloom_mat in place instead of attacking. Sits between routine repair and focus-fire, "above focus_weak" per the plan's own table.
- The `extract_unit` objective's own named unit → path to the nearest exit tile instead of chasing a kill, once nothing higher already fired for it. Every other unit on the same mission is explicitly NOT escort-special-cased — the plan's own "escorts screen the extract target" idea was deliberately left unbuilt this pass; squad cohesion (`cohesiveMoveToward`'s existing `MAX_LEAD_FROM_ALLIES` cap) already pulls stragglers toward whichever ally is nearest, which in practice includes an extract target already heading for the door, and a bespoke escort heuristic on top of that felt like more machinery than a kid-level pass needs today.
- `objective === "hold_zone"` → every unit without a better action converges on the nearest zone tile instead of chasing the weakest enemy across the map. "Prefer not leaving it once there" needed no separate check — once a unit is standing on a hold tile, the nearest hold tile IS its own position, so the pathing call naturally returns a no-op.
- (lowest priority, bonus only) an uncarried rescuable NPC still exists somewhere on the board → head toward them, skipped entirely by the `extract_unit` target itself (the real objective outranks the bonus, never the other way).

**A real bug caught mid-build, not after.** First implementation kept the function's old `if (!enemies.length) return {}` early exit sitting ahead of all five new branches — meaning a hold_zone/extract_unit/clear_bloom/rescue mission with the board already cleared of hostiles would fall straight to `hold_no_target` and stop holding the zone, stop walking to the exit, stop clearing the patch. Caught immediately by the new tests, not by inspection — 7 of 12 failed on the first run, all with the same `hold_no_target` instead of the expected reason. Root cause was narrower than the blanket early-return suggested: only one line downstream, `weakestTarget(enemies)`, actually throws on an empty array; everything else (`findLethalTargetFrom`, `enemies.some(...)`, `focusFireTargetInRange`, `regroupPath`'s exposure check) is already safe with zero enemies. Fixed by removing the blanket return and instead gating just the two `weakestTarget`-dependent blocks (`advance_into_range`, and the final `seek_fight` fallback) behind `enemies.length > 0`, with `hold_no_target` now the true last resort at the very end of the function rather than an early gate. Re-verified: all 12 new tests pass, the 371 pre-existing tests are still 371-for-371.

**12 new tests**, `src/sim/playerAi/__tests__/objectiveAwareness.test.ts` (new file — the Player AI engine's first-ever dedicated test suite; it only had `npm run sim` smoke-testing before this), built against real `Mission` instances (`AMARANTH_MISSION_2/3/5`, `MISSION_1A`), not synthetic stand-ins: hold_zone convergence and "don't walk off it once there" (the second needed the whole squad nearby, not just one unit — cohesion's own `MAX_LEAD_FROM_ALLIES` cap correctly pulls an isolated unit back toward far-off allies even off a hold tile, which the first draft of that test didn't account for and caught on its own); extract_unit's named-target override, and confirmation a different squadmate on the same mission isn't overridden by it; clear_bloom firing on the real clear_bloom mission, NOT firing below the self-preservation HP bar, firing for a synthetic `clear_bloom_patch` bonus on an eliminate_all mission (mirrors `bonusObjective.test.ts`'s own fixture pattern), and NOT firing on `MISSION_1A`'s decorative bloom_mat (verified `pilot_barasj`'s archetype is really `arch_munti_bipedal` via `data/meks.ts` before writing that test, not assumed from a comment reference elsewhere); adjacent-pickup, not-yet-adjacent pursuit, already-carrying-ignores-live-enemies, and the extract target skipping the rescue-pursuit branch entirely.

**Real sim results, not just green tests — this is the part that actually answers the plan's own stated goal.** `npm run sim` against every Amaranth mission, n=8 each:

- **Mission 2 (hold_zone): 8/8 WIN, turn 6 every time.** Previously "held by coincidence" (per `mapsAmaranth.test.ts`'s own header, quoted in the plan doc) — the bot now actually holds on purpose.
- **Mission 7 (hold_zone): 8/8 WIN, turn 6 every time.** Same objective type, zero new AI work needed for it — exactly what the plan's §7 promised ("a fifth hold_zone mission needs zero new AI work").
- **Mission 5 (extract_unit + rescue_pilot bonus): 3/8 WIN.** This mission has never once been winnable by the bot before today — it didn't know extraction or rescue were things it could do. 3/8 isn't a strong number, but it's the first real number this mission has ever had.
- **Mission 3 (clear_bloom): 0/8 WIN, all losses in the 9-24 turn range.** The bot now genuinely attempts the objective (`clear_bloom=3` in a typical decision log, where it used to be zero, always) and still loses every time. Worth flagging directly rather than quietly reporting only the wins: this is either a real difficulty/balance question (the plan itself named this exact distinction — "whether a mission is winnable without using its intended tools versus whether it's winnable at all") or evidence that "kid-level" tactical play genuinely isn't sufficient for this specific mission, and I don't think it's mine to guess at which from one pass. Not rebalanced here, on purpose, matching this project's own scope-flagging rule and the standing "more content first, tuning later" holding pattern already on record for Missions 3/5/8.
- Missions 1, 4, 6, 8 (eliminate_all, untouched by anything in this pass) — unchanged win/loss character from before, as expected; none of the five new branches can fire on a mission with no matching objective or bonus.

**Verification.** typecheck, lint, all 383 tests clean (up from 371 — 12 new), production build. Real sim runs as above, n=8 per mission across all 8 shipped missions (64 runs), specifically re-checked for `ONGOING`/stall behavior given this pass touched the shared enemies-gating logic every mission's decision chain runs through — none found; one Mission 3 run went to turn 161 before resolving to a loss, re-ran 8 more times to confirm it was ordinary dodge-roll variance (range 9-17 turns) rather than a new stall pattern, which it was.

Delivered: `src/sim/playerAi/types.ts`, `combat.ts`, `support.ts`, `index.ts`, `src/sim/run.ts`, `src/sim/playerAi/__tests__/objectiveAwareness.test.ts` (new) — via the device bridge.


## Addendum, 25 Aug 2026: Screen gets a first, deliberately narrow heuristic — and an honest null result on Mission 3

Maxime, right as the objective-awareness pass above was being reported: "add screen too. its probably why mission 3 still fail sometimes." Worth writing up on its own because the answer turned out to be no, and it's worth showing the actual work that got to "no" rather than just asserting it.

**What Screen does, mechanically, and why it looked like a real candidate.** abil_screen (data/abilities.ts) was already fully engine-built before this pass — `Mission.canScreen`/`screenAllies` (engine/mission.ts), wired into `isVisibleTo` (engine/ai.ts) since the 23 Aug ability-depth pass. A Munti spends 1 action (does not end the turn — same contract as Repair and Clear Bloom) to conceal itself and every living ally within `SCREEN_RADIUS` (1 tile) until their own next turn. Once per mission per Munti. Every Munti archetype carries it (confirmed against data/units.ts: `abil_screen` is in all three Munti chassis' `abilities` arrays, same as `abil_clear_bloom`). Mission 3's own Munti, Lask, has both. On paper this is exactly the tool for "exposed Munti standing in a bloom patch getting focus-fired" — hold the charge, pop it the moment things get dangerous, buy a full hostile phase where the Bloom simply hold position with no target.

**What got built.** A new `use_screen` branch in `decidePlayerAiAction` (index.ts), inserted immediately ahead of the existing `clear_bloom` branch so the two chain in the same turn via run.ts's existing per-unit action loop (Screen costs 1 action and doesn't end the turn, so a Munti that screens still gets its second action to clear or fight). Deliberately the narrowest version, not a general "screen whenever it looks dangerous" judgment call — that's real Phase-4-sized work the plan doc always flagged as harder than Ambush/Interdict, and guessing at it risks burning the once-per-mission charge at the wrong moment, which the file's own header already names as worse than never using it. The gate: Munti, has `abil_screen`, hasn't used it yet, the mission's real objective or bonus is `clear_bloom`/`clear_bloom_patch`, `hasClearableBloomNearby` is true at this unit's current position, and — the key condition — `spotted`: at least one living hostile can *actually see this unit right now* (`isVisibleTo`, the same check the file's own retreat gate already uses one section up). Three new tests (`objectiveAwareness.test.ts`, 386 total now, up from 383): fires when spotted with the charge unspent; falls through cleanly to `clear_bloom` once the charge is already spent; doesn't fire when nothing can see the Munti (the existing "cleared board" clear_bloom tests already prove this implicitly — this one says so explicitly). Full gate clean: typecheck, lint, all 386 tests, production build.

**The honest result: it never fires in real play, and Mission 3 is unchanged at 0/10.** Ran the mission ten times post-change (`npm run sim -- mission_amaranth_3`, with `--ai-log` on two of them to inspect the full decision trace) — still 0 wins, and `use_screen` appears exactly zero times across all ten runs' combined ~460 decisions. Traced why directly against a full turn log rather than guessing: Lask clears whatever bloom_mat is reachable from wherever she already is, then — once that local patch is exhausted — her *next* sub-decision that same turn falls through past `clear_bloom` (nothing left to clear from here) into ordinary combat logic, which advances her toward the fight. She gets spotted and swarmed (2 Crawlmass + a Splitfang converging for 70-90+ damage in one hostile phase, repeatedly, turn after turn) only *after* that advance — by which point she's no longer standing in a `hasClearableBloomNearby` position, so the gate's two conditions (spotted, clearable-nearby) never actually coincide at the same decision point. The branch is built correctly — the three new tests prove the mechanism works exactly as designed under the conditions it asks for — those conditions just don't occur together anywhere in this mission's actual flow.

**What's actually killing the squad, traced from the same log.** Not an exposed-clearing moment specifically — straightforward attrition. Two Crawlmass and a Splitfang gang up on whichever player unit is currently reachable and visible, one squad member goes down roughly every turn or two starting turn 6, and every kill mid-mission strips a permadeath check with "no living Munti remains" the instant Lask (the only Munti and only healer) goes down first — after that the remaining three units have no repair at all, so downstream, mounting attrition until the whole squad is lost. This reads like a genuine numbers problem (this squad vs. this hostile mix, or this map's terrain funneling the fight into one bad chokepoint) rather than a missing-ability-usage problem. Not diagnosed further or rebalanced here — flagging it as the honest next question rather than guessing at a fix, same holding pattern already on record for Mission 3/5/8's other open balance questions.

**Where this leaves Screen.** Shipped as-is: correct, tested, and genuine insurance for any future clear_bloom mission where a hostile happens to already have eyes on the Munti mid-clear (or the current one, on a different terrain roll where the approach unfolds differently) — it just isn't what's deciding Mission 3's outcome today. Two honest paths forward, not picked here: (1) broaden the trigger to fire proactively — e.g., the first time a Munti is in a `clear_bloom`-relevant position at all, charge unspent, regardless of whether anything can see it yet, trading "only spend it when strictly needed" for "shield the whole clearing operation early" — which is closer to how a cautious human player would actually use a one-shot defensive cooldown before a fight starts, not after; or (2) treat Mission 3 as the balance question it's actually presenting and leave the AI as-is. Maxime's call.


## Addendum, 25 Aug 2026: missions 9-12 — Act I finished, a new objective type (Survive N Turns), and two real Player AI bugs found stress-testing it

Maxime, after the Screen/Mission-3 writeup above: "cool. lets do mission
9-36, do them in batch of 4. tell me your toughts and gimme a sitrep
before going next. as yoou build the mission, try to weave in the two
extra objective we added in, rescue and bloom patch. map can be as big as
nessessary." This is batch 1 of 7 (missions 9-12) — the independent
campaign doc's own §3 scope note flags exactly one new engine system for
Act I's back half: Survive N Turns, needed for Mission 9. Nothing else in
9-12 needed new mechanics — same "content and wiring" pattern as every
Act I batch before this one.

### The four missions

| # | Name | Objective | Map | Enemy | Bonus |
| --- | --- | --- | --- | --- | --- |
| 9 | Cut Off | survive_n_turns (10) | encircled outpost, sump-sealed south, 22×14 | 10 Crawlmass + 2 fixed Gallcyst | rescue_pilot |
| 10 | The Amaranth Betrayal | extract_unit (Iyari) | abandoned joint checkpoint, 24×13 | 6 Crawlmass + 4 Splitfang | clear_bloom_patch |
| 11 | The Long Walk Back | extract_unit (Lask) | fighting withdrawal, river crossing, 34×13 | 2+2+3 Crawlmass/Splitfang, staged | none |
| 12 | The Fallow Line | hold_zone (turn 10, limit 16) | Thistledown Watch redoubt, 26×14 | 6 Crawlmass + 4 Splitfang + 3 Choir + 2 Sirenmaw, staged | none |

**Survive N Turns (`data/types.ts`, `engine/mission.ts`).** Deliberately
the smallest possible addition rather than a new field: reuses
`objectiveParams.turnLimit` directly as the survive-until count, the same
way `hold_zone`'s own `holdUntilTurn` already defaults to `turnLimit` when
unset. `checkWinLoss` gets one new branch — reach the turn count, win;
squad wipe is already checked unconditionally above every objective
branch, so there's no separate loss condition to write, unlike
`hold_zone`/`extract_unit` which both have their own explicit timeout-loss
message. `scenes/Battle.ts`'s HUD needed zero changes — confirmed by
reading it directly rather than assuming: its turn-line rendering was
already generic (`Objective: ${m.mission.objective}`), so a fifth
objective string just displays correctly with no new branch. The Player
AI engine's mission-context type picked up the new objective literal
(structural typing requirement — a live Mission's real `.objective` value
needs it to keep satisfying that type) but no new decision branch: with
nothing to hold, extract, or clear, a `survive_n_turns` unit just falls
through to ordinary combat/retreat/regroup logic, which turns out to be
exactly right for "stay alive" — confirmed at 8/8 clean wins below.

**Bonus objectives, per your ask — one rescue, one bloom patch, not both
on every mission.** Mission 9 carries `rescue_pilot` (a Downed Signals
Officer at the outpost's edge — fits "comms sabotage strands the lance"
directly). Mission 10 carries `clear_bloom_patch` (a small mat patch
where House Amaranth's abandoned checkpoint sits — reads as the position
already starting to go feral once nobody's tending it, which fits "their
positions are empty" better than a rescue would have). 11 and 12 carry
neither — 11 is already a fighting withdrawal through three staged waves,
and 12 is the act finale; both felt like they had enough going on without
a bonus competing for attention, and neither mission's own fiction handed
me a natural "someone's stranded here" or "there's a patch nobody's
touched" moment the way 9 and 10 did. Happy to add one to either if you
want — just didn't want to force it where the story didn't ask for it.

**Mission 12 and §6a — deliberately no scripted death.** The independent
campaign doc's own §6a is explicit: "the only character that is safe is
the mc [Rourke]" — every other named beat, Bosk's Mission 12 death
included, is a *plan*, not a *guarantee*, contingent on that pilot still
being alive when the beat comes up. Live permadeath is already fully
engine-built (confirmed via Mission 3's own sim logs showing real
"Permadeath check... no living Munti remains — permanent loss" verdicts),
so scripting a forced death here would have been redundant at best and
would have overridden the doc's own rule at worst — if Bosk happens to be
dead by Mission 12 (already possible; nothing protects him before this),
a scripted death event would either double-kill a corpse or force a death
onto whoever's alive regardless of the doc's own contingency. Mission
12's briefing gestures at the stakes without naming who covers the gate
("Bosk in the doorway" energy, not committed to a name) and the mission
itself is just the hardest fight in the act (4 staged hostile waves,
described below) — if Bosk goes down here, it'll be because the fight
was genuinely that hard and he was actually there for it, not because a
script said so.

### Two real Player AI bugs, found stress-testing the new missions — one clean fix, one honest partial

Stress-testing 9-12 is what actually exercises `extract_unit` under
conditions the first extract mission (5) never fully covered — three
different maps' worth of geometry, none of them small. That surfaced a
real deadlock (Mission 11) and reopened a question about Mission 5 I
thought was closed. Both are Player AI engine bugs, not mission-data
bugs — nothing about missions 9-12's own definitions needed to change.

**Bug 1 — escort units freeze once combat ends, deadlocking the extract
target (Mission 11, 0/8 → fixed).** Mission 11 stress-tested at a uniform
0/8, every run an identical turn-19 timeout with the extract target
(Lask) stalled a few tiles short of the exit for the entire back half of
the mission. Traced with a full `--ai-log` dump rather than guessed at:
from turn ~13 on, Lask got `extract_to_exit` every turn with a null
destination (no-op — already as close as she could get), while all four
other units got `hold_no_target` every turn, for six-plus turns straight.
Root cause: `extract_to_exit` only ever moves the *named* target — every
other unit just falls through the normal combat chain, which is fine
as long as a fight is pulling them roughly the same direction, and
breaks the moment combat ends early. Once idle, those four units read as
"the squad" to `cohesiveMoveToward`'s own `MAX_LEAD_FROM_ALLIES` cap,
which then refuses to let Lask outpace them — a real, mechanical
deadlock, not a difficulty spike; the mission became unwinnable the
instant the board cleared before she reached the door.

Fixed with a new `escort_to_exit` branch (`sim/playerAi/index.ts`,
`PlayerAiReason` in `types.ts`): on an `extract_unit` mission, any unit
with truly nothing better to do converges on the exit too, same shape
`hold_zone` already uses for its own convergence. Placed as the very
last resort, after everything else in the chain — a unit with a real
job (fighting, healing, chasing a bonus rescue) still does that job
first; this only fires once there's genuinely nothing else, which is
exactly the gap that let escorts freeze in the first place.

**Bug 2 — a critically wounded extract target never resumes heading to
the exit, even once fully safe (Mission 5, unresolved before this pass —
now a real, partial fix).** While re-checking that the escort fix didn't
have side effects, Mission 5 (the *original* extract mission, previously
reported at 3/8) came back 0/8, twice — 0/16 total. Traced with a second
full `--ai-log` dump: Anand (Mission 5's own extract target) fell to 10%
HP by turn 11 — her squad's one Munti had already been lost — then spent
the rest of the turn limit locked in `retreat_low_hp`/`regroup_low_hp`,
never once falling back through to `extract_to_exit` again, even on
turns where nothing could see her at all. Root cause: both self-
preservation branches fire unconditionally once HP drops below the
retreat threshold, with no notion that this particular unit's actual
"safety" is the exit tile, not the squad — `regroup_low_hp` in
particular pulled her toward whichever ally was still moving, which on
this map (enemies spawn between the deploy zone and the exit) meant
repeatedly walking the wrong way, away from the door, for the rest of
the mission. A single Munti loss was permanently soft-locking the
objective, independent of anything actually chasing her at that moment.

Fixed narrowly, reusing this file's own existing "gate self-preservation
on `spotted`" reasoning (the same trick the Mission-3 retreat fix used
two addenda up): when nothing can currently see this unit, there's
nothing to actually flee *from*, so a critically wounded extract target
in that lull now spends the turn making real progress toward the exit
instead of wandering toward a squad that might have no healer left
either. Deliberately does NOT touch the spotted case — mid-firefight, a
10%-HP unit blindly beelining the exit through a live threat is a worse
call than falling back, so retreat/regroup still govern exactly as
before whenever something can actually see her.

**Honest result: this is a real fix, and it did NOT flip Mission 5.**
Re-tested at 0/16 again, post-fix — but not the same 0/16: loss types
diversified (mostly still turn-limit timeouts, but now also a couple of
outright wipes and one "extract target downed," where before it was a
uniform, monotonous timeout every single time). The AI now genuinely
tries to finish the objective during safe lulls instead of permanently
giving up on it, which is a correctness fix worth having on its own
merits — but Mission 5's actual structure (the enemy wave sits squarely
between the deploy zone and the exit, and the squad has exactly one
healer) means a bad early HP trajectory for the extract target is close
to unrecoverable for a heuristic bot regardless. This reads like the
same fork Screen's Mission-3 finding hit two addenda up: either a real
balance question (this mission may need a real player's better
positioning — protecting Anand *before* she drops critical, rather than
recovering after) or a sign this bot's "kid-level" tactical ceiling
genuinely isn't enough for this specific mission. Not diagnosed further
or rebalanced here, on purpose — flagging it rather than either quietly
reusing the old "3/8" number or declaring it fixed when it isn't.

**Mission 11's own number moved too, and it's worth being straight about
it.** The escort fix alone measured a clean 8/8 the first time (small
sample, no other change in flight). With the Mission 5 fix also in place,
a bigger re-test (26 runs total, spread across three batches while
chasing the Mission 5 investigation) came back at roughly 73% (19/26) —
still overwhelmingly a real fix (0/8 deadlock → clearly winnable most of
the time), but not the clean sweep first reported. Lask is Mission 11's
own extract target, and she's also the squad's only healer with nobody
to heal her — the same shape of unit the Mission 5 fix targets. Plausible
mechanism, not fully confirmed against a fresh trace given time spent:
occasionally, running for the exit the instant she's unspotted walks her
into a worse spot than a defensive regroup would have, where she then
gets caught. Reporting the real current number rather than the
optimistic first one.

### Real sim numbers, all 12 missions

- **9 (Cut Off): 8/8 WIN**, every run resolving exactly at the turn-10
  survive line. First real number for `survive_n_turns` — the objective
  works as designed and isn't a freebie (real combat happens every run),
  but this squad handles it comfortably.
- **10 (The Amaranth Betrayal): 3/3 WIN** (spot-check, not a full n=8 —
  time went to the two bugs above instead). No red flags.
- **11 (The Long Walk Back): ~73% (19/26)** — see above. Was unwinnable
  (0/8) before the escort fix.
- **12 (The Fallow Line): 4/8 WIN.** Act I's finale, and it plays like
  one — four staged waves, three losses were full wipes, one was
  "hostiles hold the zone" (a hostile back on the hold tile at the check
  moment — pre-existing loss condition, not new). A 50/50 finale against
  a kid-level bot doesn't strike me as wrong on its face, but it's the
  hardest number in the batch and worth knowing going in rather than
  finding out cold.
- **1-4, 6-8: smoke-tested clean** (one run each, no crashes, no
  unexpected shift) — the two new Player AI branches are both gated on
  `objective === "extract_unit"`, which none of these seven missions
  have, so they're structurally guaranteed to be no-ops here; this was
  a sanity check, not a full re-stress.
- **5 (Foraging Party): 0/16**, as above — the one open finding from
  this batch, not a regression from anything shipped today, a
  pre-existing gap this pass genuinely improved but didn't close.

### On reusing Bloom archetypes across the batch (your note, mid-session)

You asked, while I was mid-investigation: "add more bloom types as game
goes on. in each mission, reusing varies form that showed up before."
Checked what 9-12 actually did against that: mostly on track. Crawlmass
and Splitfang carry every mission in the batch as the recurring
bread-and-butter (matches "reusing varied forms that showed up before"
directly), with one new archetype introduced per mission where the map
called for it — Gallcyst at 9 (first-ever use; fixed-position "turrets"
fit an encircled, dug-in outpost), Sirenmaw at 12 (first-ever use;
flying reinforcement for the finale's fourth wave), Choir returning at 12
too (its second appearance since debuting at Mission 8). One real gap
against your note, though: Undertow (introduced Mission 4) and
Sporethrower (introduced Mission 7) haven't been reused since their own
debut mission — this batch leaned on Crawlmass/Splitfang as the "filler"
instead of pulling either of those back in, which is a miss against
"reusing varied forms," not a hit. Worth folding in deliberately for
batch 2 — Sporethrower would fit a ridge-heavy map (matches its own
introduction terrain), Undertow fits anything with a water/sump crossing,
which The Long Walk Back actually has (the river-crossing bottleneck)
and I didn't use it there. Also worth naming directly: there are only
seven Bloom archetypes total right now (Crawlmass, Splitfang, Undertow,
Sporethrower, Gallcyst, Sirenmaw, Choir), and this batch used all seven
somewhere across the twelve missions — so "add more bloom types as game
goes on" also means new archetypes eventually, not just reusing the
existing seven, likely at future escalation points (Act II's own
two-archetypes-at-once pattern per your own earlier note on this). Not
started — just flagging it's coming, and that I'll actively pull
Undertow/Sporethrower back into rotation starting with batch 2 rather
than defaulting to the two most recent types.

### Verification

`npm run typecheck`, `npm run lint`, `npm test` (402/402, up from 386 —
no new tests written this pass specifically, the increase is carried
over from the Screen addendum above), `npm run build` — all clean, run
fresh after both AI fixes. Real sim numbers above. Four new map grids
(`data/mapsAmaranth.ts`) authored as ASCII and BFS-validated with a
scratch tool mirroring `mapsAmaranth.test.ts`'s own three checks before
transcription — that test suite picked up all four automatically (its
`describe.each` runs off `MAPS_AMARANTH` directly), no new test-writing
needed there. Scratch validation scripts deleted before delivery, same
as every prior mapping pass.

Delivered: `src/data/types.ts`, `src/data/mapsAmaranth.ts`,
`src/data/campaignAmaranth.ts`, `src/data/mapRegistry.ts`,
`src/data/allCampaigns.ts`, `src/engine/mission.ts`,
`src/sim/playerAi/index.ts`, `src/sim/playerAi/types.ts`,
`src/sim/run.ts` — via the device bridge.

**Not started, flagged rather than assumed:** batch 2 (missions 13-16).
The independent campaign doc's own §3 scoping names two genuinely bigger
asks for Act I's opening into Act II — a squad composition choice and a
ship fire-support call-in, neither of which is a data-and-wiring pass
like anything in 9-12; both are new systems (new UI, new engine hooks)
per this project's own scope-flagging rule. Sitrep in chat covers this
directly rather than just starting batch 2 on the same momentum.

## Addendum, 25 Aug 2026: Mission 5 played for real — closes the open finding from the batch above

Maxime, right after reading the missions 9-12 sitrep: "saved mission 5,
saved the dude well easy enough." A real playthrough, both halves —
Anand extracted, the rescue bonus picked up — and "easy," not "barely."

Worth setting directly against the sim number reported an hour earlier:
the heuristic test bot went 0/16 on this exact mission, even after two
real Player AI fixes landed this same session. This is the actual answer
to the fork flagged in that sitrep — "either a real balance question, or
this bot's kid-level tactical ceiling genuinely isn't enough for this
specific mission." It's the second one. A human who actively protects the
extract target and prioritizes the rescue early clears this comfortably;
the bot's flat, reactive heuristics (no forward planning, no "keep Anand
screened" instinct, nothing until she's already critical) just aren't
that. Good to have a real data point instead of leaving it a coin flip —
Mission 5 needs no rebalancing off the back of the sim numbers. The two
Player AI fixes from the batch above (escort convergence, extract-target
survival override) stay in regardless — they're real correctness fixes
independent of this result, just not what was standing between the bot
and a win here.

Recorded as a data point on the sim-vs-real gap generally, too: this is
the second time this session a bot's 0% has coexisted with an easy human
clear (Mission 3's Screen finding was heading the same direction before
this one confirmed it outright) — worth remembering next time a mission's
sim number alone tempts a rebalance. The bot is honest about correctness
bugs (Mission 11's deadlock was real, confirmed, and needed a real fix)
but isn't a reliable difficulty oracle on its own.

Nothing built or changed this entry — a tally, same as every other
direct-playtest addendum in this log.


## Addendum, 25 Aug 2026: batch 2 built — missions 13-16 (Two Fires), Fire Support, the Act I/Act II split

Picks up directly from "alright cool. add the next 4 now." — batch 2 of the
9-36 sequence, and the first batch of Act II. The closing note on the
batch-1 sitrep flagged two genuinely new systems the independent campaign
doc's own §3 scoping calls out for Act II's opening: a squad composition
choice and a ship fire-support call-in, neither a data-and-wiring pass
like anything in 9-12. Both got a real `AskUserQuestion` pass before any
code — recorded directly in the source comments this time
(`data/campaignAmaranth.ts`'s own header above Mission 13, and Mission
14/15's own comments) rather than only here: fire support confirmed as a
minimal standalone ability rather than gated behind the Antfarm Carrier
Hub's still-100%-paper CIC/Energy economy; Contested Landing confirmed as
a "deploy under fire" shape — hostiles already positioned at/near the
deploy zone at turn 1, no grace period, mechanically `eliminate_all`-shaped
underneath.

### The four missions

| # | Name | Objective | Map | Enemy | Bonus |
| --- | --- | --- | --- | --- | --- |
| 13 | New Colors, Old Wounds | eliminate_all (turn 12) | open muster ground, 26x14 | 12 Crawlmass + 3 Splitfang | none |
| 14 | Steel Rain | eliminate_all (turn 14) | cratered ridge line, 28x16 | 8 Crawlmass + 3 Splitfang + 2 fixed Gallcyst | none |
| 15 | Landfall | contested_landing (turn 14) | beach assault, 24x14 | 10 Crawlmass + 6 Splitfang (t1) + 4 Crawlmass (t3) | none |
| 16 | Collaborators | eliminate_all (turn 12) | House Amaranth depot, 24x14 | 5 House Amaranth Conscripts (4 archetypes) | rescue_pilot (reused) |

Same discipline as every prior batch: maps built with the coordinate-helper
Python script (not hand-typed ASCII — see below), validated against the
same three checks `mapsAmaranth.test.ts` runs before transcription, and
missions tuned against real `npm run sim` sampling rather than shipped on
first-guess numbers.

**Squad composition choice — Act II's real answer.** Act I never had one:
five named pilots, a five-slot deploy cap, no actual decision at the
Transporter Pad. Act II's roster is eight (`ACT2_DEFAULT_SQUAD` — the
original five Wardens plus Okafor/Solheim/Vashti, the Second Lance trio),
and `ACT2_DEPLOY_CAP` stays at 8 — so today composition choice reads as
"deploy your whole expanded company," not yet a real subset-of-8-from-more
decision (that needs the roster to grow past 8 active pilots, which
hasn't happened). The mechanism itself is real and finished though:
`scenes/TransporterPad.ts`'s `deployCapForMission(missionId)` was already
scaffolded before this segment; this pass finished wiring it all the way
through — `toggle()`'s cap check and `redrawLaunchSection()`'s messaging
were still hardcoded to `ACT1_DEPLOY_CAP` (5) until now, which would have
silently blocked deploying more than 5 of Act II's own 8-pilot squad the
moment anyone tried.

### Fire Support — the first two-click ability in the game

**What it does, mechanically (`data/combatTables.ts`).** A shared,
squad-wide resource — `FIRE_SUPPORT_CHARGES_PER_MISSION = 2`, one counter
on the `Mission` itself (`fireSupportChargesRemaining`), not per-unit like
Screen or Sensor Sweep's own charge fields, because the fiction is one ship
overhead, not an ability any individual pilot personally has. Any unit
with `abil_fire_support` can spend from the same pool. A call-in does flat
`FIRE_SUPPORT_DAMAGE = 60` (bypasses the normal `bloomDamage`
attack/defense formula entirely — an off-board strike isn't a mech's own
weapon) to every living hostile within `FIRE_SUPPORT_RADIUS = 1` (a 3x3
Chebyshev box) of the called-in tile — an outright kill on a Crawlmass (40
endurance), a real dent and not a delete button on tougher single targets
(Choir 110, Gallcyst 140). Manual-only, same precedent as Taunt: nothing in
`sim/playerAi/` calls it, so this batch's own sim numbers below are a
real "beatable without fire support" measure, which is the right bar for
a human-only bonus tool, not a crutch the bot needs to pass.

**What was actually built this pass: the targeting UI, plus one new
engine query.** `canFireSupport`/`fireSupport`/`fireSupportChargesRemaining`
and the `contested_landing` win check were already built and confirmed
correct by direct read before this segment started — this pass's real
engine addition is `getFireSupportAreaFrom(unitId, from)`
(`engine/mission.ts`), which is a second, separate radius from the strike's
own 3x3 impact box: it returns every tile within the CALLING unit's own
vision stat, centered on the caster, i.e. how far away you're allowed to
point at something, not how big the resulting explosion is. Two different
numbers, easy to conflate, kept genuinely separate in the code.

The UI is the first ability in this game that isn't either "resolve
immediately on the caster" or "click an already-highlighted adjacent
unit" — it's arm-then-click-a-tile, and nothing in `scenes/Battle.ts` had
that shape yet. New state (`fireSupportTargeting`, `fireSupportRange`),
a new priority-ordered branch at the very top of `handleBoardClick`
(clicking in range resolves the strike and clears state; clicking outside
range cancels targeting and falls through to normal recompute), a sky-blue
(`0x38bdf8`) tile wash rendered over the caster's own vision range while
armed, and a HUD legend line naming the shared charge count. One real
clobbering bug caught before it ever reached a live test: Fire Support's
`ActionOption.endsTurn` is `false` (arming it shouldn't cost the turn), so
`refreshSelectionAfterAction()` calls `recomputeSelectionHighlights()`
right after `run()` returns — which immediately overwrote the empty
highlight arrays `run()` had just set, undoing the ability's own targeting
mode in the same frame it armed. Fixed with an early-return guard at the
top of `recomputeSelectionHighlights()`: `if (this.fireSupportTargeting)
return;`.

**A second, unrelated UI bug found by reading data instead of trusting a
comment.** The action bar's `ACTION_SLOTS` array was a 4-slot 2x2 grid,
and a stale in-code comment claimed the widest existing kit was three
abilities. Checked the vibrissal Munti's real `abilities` array
(`data/units.ts`) before assuming Fire Support would just fit: Repair,
Cockpit Evac, Sensor Sweep, Screen, Clear Bloom — already five, before
Fire Support makes six. The old grid would have silently truncated the
newest ability off the UI for exactly this chassis — which happens to be
Vashti's own chassis, sitting in this session's own `ACT2_DEFAULT_SQUAD`.
Fixed by expanding to a 6-slot 3x2 grid (narrower buttons, smaller label
font) rather than shipping an ability that would never render for the one
unit that has it.

**Live-verified, not just unit-tested — this ability has no existing test
coverage pattern to reuse (it's UI-driven, same category as the
TransporterPad softlock fix a few addenda up).** Ran a real Playwright
session against `npm run dev`: selected Vashti in Mission 14, confirmed
all 5 of her buttons render with no truncation in the new grid, clicked
FIRE, confirmed `fireSupportRange` populated with 84 legal tiles, clicked
an in-range tile, and confirmed the mission log recorded the resolved
strike with the charge count decrementing (2 -> 1) and both selection and
targeting state clearing cleanly. Screenshots taken at each step; no
stray highlight wash, no leftover targeting state, HUD panel and action
bar both rendering cleanly throughout.

### Two real bugs found and fixed, neither of them new-this-pass code

**`pilotRegistry.ts` never picked up the Second Lance.** First `npm run
sim -- mission_amaranth_13` attempt threw `Unknown pilot id:
pilot_okafor` outright. Root cause: `campaignState.ts`'s
`integrateSecondLance()` merges `SECOND_LANCE_PILOTS`/`SECOND_LANCE_MEKS`
into a live `CampaignState` correctly, but `data/pilotRegistry.ts` — the
STATIC merge point `findPilot`/`findMek` actually resolve through for any
no-deployRoster path, meaning every `npm run sim` call and every fresh
no-campaign-save launch — was never updated to include them. This is the
exact gap that constant's own header comment already names (the same
shape as the original Warden Company merge, and the `ALL_HOSTILE_MECHS`
merge before it) — hit again, for the same reason: a new roster added at
one merge point, not the other. Fixed by adding both arrays into
`PILOT_INDEX`/`MEK_INDEX` alongside the existing sources.

**Nothing new this batch touched Debrief.ts, campaignState.ts,
combatTables.ts, types.ts, abilities.ts, or sim/playerAi/types.ts as its
own work** — but delivering this batch's files to the repo on your
machine surfaced that several of those files were sitting out of sync
with what this session's own log already describes as delivered (sizes
didn't match between the working copy here and your machine's copy).
Rather than guess why, redelivered everything that differed alongside
this batch's real changes, so your copy is a clean, consistent snapshot
of the tested state rather than a partial one. Worth a quick sanity check
on your end that nothing looks unexpectedly different in those files —
flagging the sync gap honestly rather than asserting a cause I didn't
actually verify.

### Act I / Act II campaign split

`data/allCampaigns.ts`'s `CAMPAIGNS` array grew from one entry to two
(`amaranth_act1`, `amaranth_act2`), which activates `scenes/MapSelect.ts`'s
own tab switcher — dormant since the day it was built (`showTabs =
CAMPAIGNS.length > 1`), and named directly in the Missions 5-8 addendum as
the fix for 8-missions-worth-of-cards already needing scroll. 16 missions
in one flat list would have made that worse, not better; splitting by act
sidesteps it instead of scrolling further. Mission-select subtitle updated
to say "missions 13-16 of 24" so it doesn't go stale the way the old
single-campaign subtitle already had once before.

### The heirloomCharge trap — a real economy bug avoided, not a narrative call

Checked `engine/campaignEconomy.ts`'s `computeMissionCompletionBonus`
before setting anything on these four missions: `heirloomCharge:
"available"` is read as a stand-in for "Severance was used" and pays a
flat +25 `noSeveranceBonus` regardless of whether it actually was — because
Severance itself still isn't built as a usable ability anywhere in
`engine/combat.ts`. The independent campaign doc says the Heirloom
narratively unlocks at Mission 12 either way, so setting these to
"available" would have looked like the obviously-correct move and would
have silently handed every Act II mission a free +25 points with no
matching mechanic behind it. Kept all four at `"locked"`, same as every
prior mission — an engine-state decision, not a fiction one, and said so
directly in the source comment above Mission 13 so it doesn't get
"corrected" back to available by someone reading the narrative timeline
in isolation later.

### Sim balance — the real tuning story, not just final numbers

- **Mission 13: 12 Crawlmass + 3 Splitfang -> 14/14 across two batches
  (8/8, then 6/6 retest).** First attempt (14 Crawlmass + 6 Splitfang,
  scaled roughly linearly off Mission 1's own doubling) was a hard 0/8 —
  full wipes, not close losses. Cut back to the shipped numbers and it's
  clean.
- **Mission 14: 8 Crawlmass + 3 Splitfang + 2 fixed Gallcyst -> 14/14
  across two batches (8/8, then 6/6 retest).** First attempt (10 + 6 + 2)
  was 1/8. Same story — the fixed Gallcyst pair alone adds real
  chip-damage pressure across the whole fight, and the mobile wave sizes
  needed to come down to leave room for that.
- **Mission 15 (Landfall, contested_landing): ~93% across the sample.**
  Real losses in the sample, and some genuinely long grinds even among the
  wins — deliberately not pushed to a clean 100%. A "no grace period,
  hostiles already at your throat at turn 1" mission reading as
  survivable-but-real felt like the right shape for what the mission is
  actually asking the player to feel; smoothing it flatter would have
  undersold the premise. Flagging this as a design choice made this
  session, not asserting it's the right call — your call whether it should
  come down further.
- **Mission 16 (Collaborators): ~63% (10/16) across the sample, the
  swingiest number in the batch, and kept that way on purpose.** Started
  at 8 total conscripts (2 of each of the 4 archetypes) and it was 0/8;
  Mission 6's own precedent (4 total, 1 each) came back too easy at 8/8;
  6 total landed at a rough 1/8. Settled on 5 total (the shipped roster:
  2+1+1+1) at 5/10 then 5/6. Left it here rather than smoothing to match
  the rest of the batch's near-100% numbers — "these aren't Bloom, they
  fight like we do" is the mission's whole point (Anand's own opening
  line above), and a human-piloted enemy reading as meaningfully harder
  and less consistent than a swarm archetype felt like it was earning its
  own difficulty character rather than needing to match the batch's
  average. Flagging this explicitly too, same as Mission 15 — a real
  choice, not an oversight, open to your read on whether it should move.

### A real design call surfaced, not yet confirmed with you

**Mission 16's bonus objective reuses `rescue_pilot` as-is, reframed in
fiction as a surrendering conscript** — same mechanics as Missions 5 and 9
(incapacitated unit, picked up, carried to an exit tile), zero new engine
code. The campaign doc flags this mission's own bonus as a deliberate
"moral complexity" beat, and the reuse gets there for free — but it's a
reuse, not the only shape this could have taken (a dedicated surrender/
captive mechanic with a dialogue choice is a real alternative), and the
source comment above the mission says so directly rather than presenting
this as the obviously-correct pick. Your call whether the reused shape is
the right one for what this beat is supposed to land.

### An incidental finding, not from this batch, not fixed here

While sanity-checking nothing in this pass broke anything upstream, ran a
handful of `mission_amaranth_1` sims as a spot-check and got a
surprisingly low win rate (0/3, then 1/10). Traced one loss log directly
and confirmed it's a genuine squad wipe, not an engine bug or a stall —
and confirmed via diff that nothing in this batch touches Mission 1's data
or execution path at all, so this predates today. Most likely explanation
given the log's own history: an earlier balance pass (the 6->12 Crawlmass
doubling, validated against your own human play at the time) was never
re-checked against the bot's stress-test numbers the way this session's
own later missions have been. Not fixed here — that's a real, separate
scope decision for a mission three batches back, not a side effect of
building 13-16 — flagging it plainly rather than letting it sit
unmentioned.

### Verification

`npx tsc --noEmit`, `npx vitest run` (418/418, up from 402). No new test
file was written this pass — the +16 comes from `mapsAmaranth.test.ts`'s
own `describe.each` over `MAPS_AMARANTH` (67 tests, up from 51),
automatically picking up all four new maps the same way it did for every
prior map-adding batch, no new test-writing needed there. `npm run lint`,
`npm run build` — all clean, re-run fresh after this pass's own cleanup
(a temporary debug hook in `main.ts` and four scratch Playwright scripts
used to drive the live Fire Support verification were both removed before
this final gate). `npm run sim` sampling per mission as detailed above.

Delivered: `src/data/campaignAmaranth.ts`, `src/data/mapsAmaranth.ts`,
`src/data/allCampaigns.ts`, `src/data/units.ts`, `src/data/pilotRegistry.ts`,
`src/engine/mission.ts`, `src/scenes/Battle.ts`,
`src/scenes/TransporterPad.ts` (this batch's own changes), plus
`src/data/abilities.ts`, `src/data/combatTables.ts`, `src/data/types.ts`,
`src/engine/campaignState.ts`, `src/scenes/Debrief.ts`,
`src/sim/playerAi/types.ts`, `src/engine/__tests__/tierPipCount.test.ts`
(the sync-gap files above) — via the device bridge.

**Still open:** batches 3-7 (missions 17-36) remain queued. Missions 15
and 16's difficulty levels, and Mission 16's bonus-objective design
choice, are flagged above as real calls worth your read rather than
assumed settled.


## Addendum, 25 Aug 2026: batch 3 built — missions 17-20 (Two Fires cont'd), Marrow's debut, Sporethrower/Undertow finally back in rotation

Picks up from "thing seem clean. lets do the next 4." — batch 3 of the
9-36 sequence, closing out Act II's "Two Fires" arc (missions 13-24; 20 of
24 now built). No new engine systems this batch — the independent
campaign doc's own §3 scoping doesn't flag anything new for 17-20 the way
it did for composition choice/Fire Support (batch 2) or Survive N Turns
(batch 1), and that held: all four missions use objective types and Bloom/
hostile-mech archetypes that already existed. A data-and-wiring pass,
same discipline as every batch since 9-12.

### The four missions

| # | Name | Objective | Map | Enemy | Bonus |
| --- | --- | --- | --- | --- | --- |
| 17 | The Wellroot Uncovered | extract_unit (Solheim) | terraced ridge steps, 28x15 | 6 Crawlmass + 1 Splitfang + 1 Sporethrower | clear_bloom_patch |
| 18 | Breakout at Draven's Cut | eliminate_all (turn 12) | canyon corridor, 32x14 | 4 House Amaranth Line Troopers (west) + 6 Crawlmass + 3 Splitfang (east) | none |
| 19 | The Silent Ward | eliminate_all (turn 14) | undercity chambers, 26x16 | 3 burrowed Undertow + 5 Crawlmass | none |
| 20 | Marrow's Line | eliminate_all (turn 12) | dueling ground, broken trench line, 26x14 | Col. Ysolde Marrow (tier C, Meeps) + 4 House Amaranth Line Troopers | none |

Maps built with the same coordinate-based Python generator/validator as
batch 2 (`gen_maps2.py` — `blank()`/`rect()`/`pt()`/`pts()` helpers,
`flood()` BFS reachability, `validate()` checking rectangular shape, known
tile vocabulary, deploy pads >= 8, and every deploy pad reaching every
spawn/objective tile), never hand-typed ASCII. Worth noting directly:
all four maps validated clean on the FIRST run this time — no failed
attempts to report, unlike batch 2's initial ASCII-row-length misses.
`mapsAmaranth.test.ts`'s own `describe.each` over `MAPS_AMARANTH` picked
up all four automatically (83 tests, up from 67 — same "no new test-
writing needed" pattern as every prior map batch).

### Correcting a promise from the last addendum: Sporethrower and Undertow are actually back now

The batch-2 addendum said "I'll actively pull Undertow/Sporethrower back
into rotation starting with batch 2" — and then batch 2 shipped using
only Crawlmass/Splitfang/Gallcyst, exactly the two-most-recent-types
default pattern that same addendum said it would stop doing. Worth
naming plainly rather than quietly fixing it and moving on: that was a
promise made and not kept. This batch actually does it — Sporethrower
returns in Mission 17 (first reuse since Mission 7), Undertow returns in
Mission 19 (first reuse since Mission 4's Tunnel Rats), both using the
same archetype-appropriate placement discipline as their debut missions
(Sporethrower held to ridge perches, not scattered onto open floor;
Undertow using Mission 4's own exact template — fixed coords plus
`burrowed: true`, never `"enemy_deploy"` for a burrower).

### Marrow's debut — data-only, no new engine code, same discipline as every prior named archetype

Mission 6's own dialogue event (House Colors, "first distant sighting of
Marrow") explicitly deferred her actual engagement to Mission 20 — that
line was already sitting in the codebase from an earlier session, and
this batch is that promise being paid off, not a new invention.

`hostile_mech_marrow` (`data/units.ts`'s new `AMARANTH_RIVAL_MECHS`) is
built the same way every hostile mech in this game is: a plain
`HostileMechArchetype` entry, `path: "meeps"` (mirrors Rourke's own path,
for the campaign doc's §7 mirror-match framing), `tier: "C"` — a real jump
above every other hostile mech's flat "G" (confirmed via
`engine/units.ts`'s `createHostileMechUnit`: tier scaling applies to
hostile mechs off the exact same `TIERS` table player pilots use, so "C"
alone — 125/119/115/+1 move vs. G's 100/100/105/+0 — makes her
meaningfully tougher with zero new stat-tuning code). Room's deliberately
left to escalate her further for her Mission 28 return, whenever that's
built.

**Explicitly did NOT build the "she withdraws in good order when losing"
mechanic** the campaign doc's §7 gestures at for the mirror-match framing.
Same reasoning §6a already applies to Bosk's Mission 12 death and the
Mission 31 partial loss: the beat is a narrative plan, not an engine
guarantee. Mechanically Marrow is just a tougher standard hostile mech
running the existing `mechReflexiveDecision` Munti-priority AI — she goes
for Rourke or whichever Munti is visible, same as any other hostile mech,
and fights to the death like everything else in this game does today. A
real predictive "disengage when losing" mechanic — actually simulating
outcomes before committing to a retreat, the same shape of work the
bait feature (flagged, not built, two addenda back) would need — is new,
unbuilt engine scope, not a data change. Flagging it here rather than
quietly deciding it's out of scope: your call whether a real disengage
mechanic is worth its own dedicated pass someday, same open question as
bait.

### Mission 18's pincer — a real gotcha caught before it was ever written, not found by testing

`data/maps.ts`'s `deriveZones()` collects every `"spawn"`-tagged tile on a
map into one flat `deployZones.enemy` array, with no notion of which
"side" of the map a spawn tile sits on. Draven's Cut has spawn tiles at
both mouths of its canyon — House Amaranth Line Troopers meant to enter
from the west, a Bloom wave meant to enter from the east. Using
`"enemy_deploy"` for either wave would have round-robined it across BOTH
mouths combined, collapsing the intended two-front pincer into one mixed
wave entering from a random side — silently defeating the entire point of
the mission's own geometry. Caught this by reading `deriveZones()`
directly during design, before writing the mission definition, not by
running the map and noticing something looked wrong. Fixed the only way
this gotcha can be fixed — same technique Mission 14's fixed Gallcyst pair
and Mission 4's fixed Undertow points already established for their own,
different reasons (a sessile turret's exact position, a burrower's exact
seam): both of Mission 18's waves use explicit `spawnAt: Coord[]` arrays,
scoped to their own mouth's coordinates only.

Confirmed working in the actual sim log, not just by inspection —
"House Amaranth Line Trooper attacks..." and "...attacks Crawlmass..."
both appear throughout every run, including real counter-damage exchanges
on both sides, so the two waves are genuinely fighting from their own
separate mouths rather than one blended group.

### Sim balance — the real tuning story

- **Mission 18: 14/14 clean, real combat on both fronts.** No tuning
  needed past the first-guess numbers (4 Line Troopers west, 6 Crawlmass
  + 3 Splitfang east) — an eliminate_all mission with no turn-limit fail
  condition (house rule #5) has a lot of runway to grind out a win, and
  this squad has it.
- **Mission 19: 8/8 clean, but not a pushover along the way** — real
  squad losses happen mid-mission (a unit went down to Undertow's ambush
  burst in the run I traced in detail), the squad just always finishes
  the job before the clock or a wipe. First-guess numbers (3 burrowed
  Undertow + 5 Crawlmass at the central junction) held with no changes.
- **Mission 20: 14/14 clean, and genuinely dramatic when I traced a full
  log** — Marrow alone downed FIVE of the eight deployed pilots in one
  run before finally going down herself (88, 69, and 27-with-a-45-counter
  damage hits, several dodged and several not), and the mission still won
  because eliminate_all only requires someone left standing, not everyone.
  That's the "real rival, real teeth" read the mirror-match framing was
  going for, landing mechanically without any bespoke code — tier "C"
  alone is doing all of it.
- **Mission 17 (extract_unit): the one that actually needed real tuning,
  and the honest story is worth telling in full.** First guess (6
  Crawlmass + 3 Splitfang + 3 Sporethrower, turnLimit 14) was 0/8 — every
  single run lost, always at turn 5. Root cause, confirmed by reading the
  full log: `extract_unit`'s loss condition isn't a squad wipe, it's
  "the named extract target goes down, period" (same zero-tolerance shape
  Mission 5's own Anand run has always had) — and Solheim (Reeps, no
  dodge bonus) was walking into a Splitfang/Sporethrower crossfire that
  didn't need to kill the whole squad, just her.

  Cut Splitfang to 1 and Sporethrower to 1, bumped turnLimit 14 -> 16 (the
  map's own 28-wide deploy-to-exit distance was also costing timeout
  losses independent of the downed-unit risk) — better, but still ~55%
  across 17 runs, split between timeouts and Solheim getting burst down
  early. Isolated the actual dominant cause by testing Splitfang alone at
  1 charge with Crawlmass still at 5: 10/10 clean, no losses at all — the
  Splitfang pack's double-attack burst, not overall enemy count, was the
  real threat to a single soft extract target the whole time. That read
  as too safe on its own, so pushed Crawlmass back up (8, then 6) to find
  where real pressure returns without reintroducing the Splitfang-burst
  failure mode: 8 brought back a ~60% split of the same two loss types,
  6 landed at 12/12 clean with genuine turn-9-to-11 fights every run.
  Shipped at 6 Crawlmass + 1 Splitfang + 1 Sporethrower, turnLimit 16 —
  Sporethrower's own count also came down from the original 3 to 1 in the
  same pass, for the same reason as Splitfang: ranged chip damage
  compounds on a fragile single point of failure in a way it doesn't on a
  full squad.

  Worth being direct about what this tuning story says structurally, not
  just about this one mission: `extract_unit`'s all-or-nothing loss
  condition means "comfortable win rate" for this objective type is much
  more sensitive to any single enemy unit's damage-per-turn than
  `eliminate_all`'s is, where the same numbers landed at 14/14 clean on
  the first guess for Mission 18. Worth keeping in mind for any future
  extract_unit mission rather than re-learning it from scratch each time.

### Verification

`npx tsc --noEmit`, `npx vitest run` (434/434, up from 418 — the +16 is
entirely `mapsAmaranth.test.ts`'s own generic-invariant tests picking up
the 4 new maps automatically, same pattern as every prior map batch, no
new test file needed), `npm run lint`, `npm run build` — all clean.
`npm run sim` sampling per mission as detailed above (17: 30 total runs
across the tuning passes; 18/19/20: 8-14 runs each post-shipping).

### File delivery — this time, the byte-size check has a real blind spot worth naming

Before delivering, compared every `src/**/*.ts` file's local byte size
against a fresh recursive listing of your machine's copy (same discipline
the batch-2 addendum's sync-gap finding established) — this time it came
back clean except for the three files this batch actually changed
(`campaignAmaranth.ts`, `mapsAmaranth.ts`, `units.ts`), confirming no
carry-over gap from batch 2's redelivery. But `allCampaigns.ts`'s own
subtitle edit ("missions 13-16 of 24" -> "missions 13-20 of 24", "4 of Act
II's" -> "8 of Act II's") landed at the exact same byte count as before —
a same-length edit the size-comparison method can't see at all. Delivered
it anyway because I know I edited it, not because the check flagged it —
worth flagging that this verification method has a real blind spot
(same-length edits) that a future batch's delivery check should keep in
mind rather than trusting the byte-diff alone as a complete answer.

Delivered: `src/data/campaignAmaranth.ts`, `src/data/mapsAmaranth.ts`,
`src/data/units.ts`, `src/data/allCampaigns.ts` — via the device bridge,
verified against a fresh post-write device listing.

**Still open:** batches 4-7 (missions 21-36) remain queued. Missions 15
and 16's difficulty levels and Mission 16's bonus-objective design choice
(flagged in the batch-2 addendum) are still unconfirmed one-by-one, though
"thing seem clean" reasonably reads as no objections. Marrow's "disengage
when losing" mechanic and the bait feature are both flagged, unbuilt, and
in the same category of future scope.


## Addendum, 25 Aug 2026: batch 4 built — missions 21-24 (Two Fires finale), Act II complete at 24/24, Heartwood's boss debut, and two real bugs (a map that never made you cross the causeway, a Player AI pathing stall)

Picks up from "alright cool do next pass." — batch 4 of the 9-36 sequence,
and the last batch of Act II. This closes out "Two Fires" at 24/24 —
Act I (12) plus Act II (12) both fully built now, 24 of the campaign's
eventual 36 missions live. No new engine systems needed for three of the
four missions (the independent campaign doc's own §3 scoping doesn't flag
anything new here); Mission 22 is the one exception — Protect Asset,
the third of the three new objective types the doc called out back at the
missions 9-12 addendum, and the last one still unbuilt until this batch.

### The four missions

| # | Name | Objective | Map | Enemy |
| --- | --- | --- | --- | --- |
| 21 | Cut the Root | eliminate_all (turn 16) [boss] | dug-in root cluster, 26x15 | Bloom Heartwood (boss) + Undertow reinforcements from turn 3 |
| 22 | Ash on the Water | protect_asset (turn 14) | dock across open water, 28x14 | 14 Crawlmass + 6 Splitfang (t1) + 8 Crawlmass (t5) |
| 23 | The Amaranth Accord | extract_unit (Anand, turn 17) | records-office grounds, 26x13 | 4 House Amaranth Line Troopers |
| 24 | Two Fires | eliminate_all (turn 16) [two-front finale] | contested crossroads, 30x18 | Bloom (north) + House Amaranth (south), 4+4+4+4 |

Maps built with the same throwaway Python generator/BFS-validator
discipline as every batch since 13-16 — helper functions for
rects/borders/points, a flood-fill reachability check, tile-vocabulary
and deploy-pad-count checks, all four validated `OK` on the first run,
script deleted after transcription. One real addition to the validator
template this batch, worth keeping going forward: an explicit
border-integrity check (every edge tile of the grid is actually `"wall"`)
after a script bug in Mission 22's rebuild let an exit rect silently
overwrite a column of the border — see below. `mapsAmaranth.test.ts`'s
own `describe.each` over `MAPS_AMARANTH` picked up all four new maps
automatically (450 tests total, up from 434 — the +16 is entirely that
suite's generic per-map checks, no new test-writing needed).

### Mission 21 — the Heartwood boss debut, and the AI limitation that came with it

`bloom_heartwood` (already in `data/bloom.ts` from an earlier pass) is
this game's first sessile archetype — `moveRange: 0`, 400 endurance, and
its own board-omniscient `emergentDecision()` AI tier (GDD §5.3's "boss
gets board-level heuristics," same framing that already covers the
Munti-priority logic). Its documented special rule — spawns 2 Undertow,
burrowed, at the map's spawn seams, every 2 turns starting turn 3 — is a
`MissionEvent` with a `turn_start` trigger and `repeatEvery: 2`, no new
engine code needed; the event system already supported a repeating
trigger, this is just the first mission that actually uses one.

Caught the "enemy_deploy" spawn-resolution gotcha again before ever
running the sim — this map has the boss's own tile plus two reinforcement
seams, and `deriveZones()` flattens every spawn-tagged tile into one pool
with no notion of which cluster a tile belongs to (same issue as Missions
14 and 18, now also 21). Fixed with explicit `spawnAt: Coord[]` on both
the boss's own placement and the reinforcement event.

**The real finding: the squad's own Player AI never engages the boss at
all, and it's a genuine, not-fully-fixed heuristic gap.** First sim runs
lost every time with Heartwood sitting at full HP through the whole
15-19 turn loss. Traced it to `focusFireTargetInRange`'s `focus_weak`
heuristic, which picks by lowest HP × effective-defense — the
400-endurance stationary boss always loses that comparison to the
low-HP Undertow reinforcements spawning every two turns, so the squad
spends the entire mission mopping up disposable reinforcements and never
lands a real hit on the actual objective. This is an AI-heuristic
limitation, not a data bug, and I didn't rewrite `focusFireTargetInRange`
to special-case bosses this pass — that felt like it deserved its own
look rather than a one-off patch bolted onto a mission-specific problem.
Mitigated at the content level instead: removed the mission's opening
Crawlmass escort wave entirely, which buys the squad two genuinely clean
turns against Heartwood before the first reinforcement wave arrives at
turn 3. Re-tested at roughly 60-70% win rate across about 10 runs —
accepted as reasonable "first proper boss" difficulty, but I want to be
straight that this is a mitigation, not a fix: the underlying issue (the
AI will always deprioritize a tough, low-priority-by-the-formula boss in
favor of cheap kills) will resurface on any future boss-plus-reinforcement
mission unless `focus_weak` learns to weight "is this the actual
objective" somehow. Flagging it here as a real, open engine-level
question rather than letting it look quietly solved.

### Mission 22 — Protect Asset ships, and a real map-design bug (not a balance bug) cost two rebuild passes

**The objective type itself.** `protect_asset` is the third and last of
the three new objective types flagged back at the missions 9-12 sitrep.
Shape: `MapDefinition.defendZone` is derived the same way `holdZone` and
`exitTiles` already are — from `"dock"`-tagged tiles via `deriveZones()`/
`makeMap()`, no new map-authoring primitive needed. `Mission.
tickAssetDamage()` (called from `environmentStep()`, same place
`tickBloomRegrowth()` already hooks in) deducts a flat 25 HP per hostile
that ends its turn standing in the zone. `checkWinLoss()` gets a new
branch: lose only if the asset's HP hits 0; win either by clearing every
hostile, or — matching house rule #5's "eliminate_all has no turn-limit
fail condition" shape — by outlasting the turn limit with the asset still
standing. Walked the shape through `AskUserQuestion` before building
(damage-per-turn-in-zone vs. a single big hit on arrival, asset HP total,
whether the turn limit should be a fail line at all) rather than guessing
at the numbers.

**The real bug: the first map made the whole objective trivially
uncrossable, and it's a design bug, not a balance one.** V1's enemy spawn
tiles and the dock zone were on the same landmass — hostiles never had to
cross either of the map's two causeways to reach the objective at all,
so Providence (the asset) was dead by turn 8 in every run, 0/3. Rebuilt
the map (v2): squad now deploys directly at the dock's own western edge,
enemies spawn on the genuine far shore, water-separated, funneled through
one of two causeways to reach the dock — the map now actually enforces
the chokepoint fiction the mission's briefing describes. Re-tested clean:
4/4 wins with zero damage to Providence, ever — which flipped the problem
from "impossible" to "too easy." Bumped enemy counts (8/4/4 → 14/6/8,
the numbers in the table above); still 4/4 wins, still zero asset damage.
Accepted and documented honestly rather than force-tuned further — the
chokepoint just holds structurally once the geometry is right, and I
didn't want to keep inflating enemy counts chasing a "real" difficulty
number that this map's actual shape doesn't produce.

**Sub-error in the rebuild, caught by a new validator check.** The first
v2 script attempt let the exit/dock rect extend one column too far,
overwriting the border wall column — the same class of bug, caught this
time by the border-integrity check added to the validator template (see
above) rather than by a failed sim run. Fixed by bounding the rect
correctly; re-validated clean.

### Mission 23 — a design error caught before ever running the sim, then a real Player AI pathing bug found tuning it

**Caught before writing any sim code:** the first draft of this mission's
`extractUnitId` pointed at an invented NPC (a records officer who was
meant to be the extraction target) — but `extract_unit`'s `checkExtraction()`
only ever resolves ids already in `this.units` at deploy time, i.e. a
player pilot from `playerPilotIds`. There's no mechanism for the primary
extract target to be a freshly-spawned NPC; that's specifically what the
separate `rescue_pilot` bonus objective is for, and it's mechanically
distinct (a carried, incapacitated unit, not a self-walking extract
target). Fixed by rewriting the mission so the actual extraction target
is `pilot_anand` (a real, deployed squad pilot), matching Mission 17's
own precedent exactly, and rewrote the briefing so the records officer
stays a narrative-only contact rather than a unit on the board.

**The real find: a genuine, previously-unknown Player AI pathing bug —
occupied-exit-tile stalls — diagnosed and partially fixed.** Sim-tuning
this mission surfaced a squad that would freeze short of the exit and
lose to the turn limit, repeatedly. Traced it through full turn-by-turn
logs rather than guessed at: `nearestCoord(unit.pos, exits)` in
`src/sim/playerAi/index.ts` picks the single geometrically-nearest exit
tile with zero regard for whether another unit is already standing on
it — if an ally happened to occupy that one nearest tile, the extraction
target's own distance-improvement search had nowhere to make progress
and stalled indefinitely, which in turn froze the rest of the idle squad
too (nothing else had a directive once combat ended). Fixed the "single
tile occupied" half of this narrowly: both call sites that resolve an
exit destination now filter to open (unoccupied) exit tiles first,
falling back to the full list only if every exit is currently occupied —
a small, low-risk patch, verified against the full 450-test suite with
zero regressions.

**What's still open, and I want to be honest about the scope of the
fix.** The deeper issue — `cohesiveMoveToward`'s distance-field search is
terrain-only and purely greedy, with no real detour-seeking, so several
idle escort units standing shoulder-to-shoulder can still wall off every
tile near the greedy-optimal approach even with occupancy-aware target
selection — was diagnosed but deliberately NOT rewritten this pass;
that's real engine work, not a mission-tuning fix, and felt like it
deserved its own look rather than a rushed patch under batch-delivery
pressure. Mitigated instead at the content level: widened this mission's
own exit zone from a 3×5 block to a 5×7 block (harder for ~5 escort units
to fully wall off) and bumped `turnLimit` from 14 to 17. Final result:
roughly 86% (12/14) across final testing rounds, with the remaining
losses being legitimate "extract target downed" risk rather than stalls
— a real improvement, but the underlying "no real detour around a
multi-unit wall" limitation is still there and will resurface on a
tighter map. Flagging it the same way as Mission 21's boss-targeting
gap above: a genuine, open Player AI limitation, not something I'm
calling fixed.

### Mission 24 — the finale, no bugs, no surprises

Two-front `eliminate_all`: Bloom pressing from the north, House Amaranth
from the south, four explicit spawn coordinates on each side (the
`"enemy_deploy"` gotcha applies here too — two distinct fronts, so both
waves use explicit `spawnAt` arrays rather than the shared pool). One
flavor-only dialogue event at turn 12 ("Marrow's signature just pulled
off the field entirely") — Marrow is never actually spawned as a unit on
this mission; deliberately kept narrative-only rather than inventing a
new disengage mechanic to make that line mechanically true, same
reasoning as Mission 20's own "did not build the withdraws-when-losing
mechanic" note. Sim-tuned clean at 8/8 wins across two testing rounds,
with real permanent pilot losses in every single run — which reads right
for an act finale rather than a red flag; no rebalancing needed, no
bugs found.

### Act II complete

`allCampaigns.ts`'s Act II subtitle updated from "Act II in progress,
missions 13-20 of 24" to "Act II complete, missions 13-24 of 24," and its
own header comment updated to record the completion date. Act I (12) +
Act II (12) = 24 of the campaign's eventual 36 missions now built and
delivered.

### Verification

`npx tsc --noEmit`, `npx eslint src --max-warnings=0`, `npx vitest run`
(450/450, up from 434 — entirely `mapsAmaranth.test.ts`'s own per-map
suite picking up the four new maps automatically), `npm run build` — all
clean on the first attempt after the `allCampaigns.ts` subtitle edit.
Byte-size comparison against a fresh device listing confirmed exactly the
files this batch touched, no carry-over sync gap this time.

Delivered: `src/data/allCampaigns.ts`, `src/data/campaignAmaranth.ts`,
`src/data/mapsAmaranth.ts`, `src/sim/playerAi/index.ts` (this batch's own
changes), plus `src/data/combatTables.ts`, `src/data/maps.ts`,
`src/data/tiles.ts`, `src/data/types.ts`, `src/engine/mission.ts`,
`src/scenes/Battle.ts`, `src/sim/playerAi/types.ts` (redelivered to keep
your copy in sync, no functional changes this pass) — via the device
bridge, verified against a fresh post-write device listing.

**Still open, flagged plainly rather than left implicit:**
- Two real Player AI heuristic gaps, diagnosed but not fully fixed this
  pass: `focus_weak` has no notion of "this is the actual boss objective"
  vs. a cheap reinforcement (Mission 21), and `cohesiveMoveToward` can
  still be walled off by a cluster of idle allies even with the
  occupied-exit-tile fix in (Mission 23). Both were mitigated at the
  mission-content level rather than the engine level this pass — worth a
  dedicated Player AI pass at some point rather than another one-off
  mitigation next time either surfaces.
- Batches 5-7 (missions 25-36, Act III) remain queued.
- Your own "huge maps with a hidden allied squad to find mid-mission"
  idea from a couple passes back is still open and hasn't been designed
  yet — flagging it here so it doesn't quietly fall off the list now that
  Act II is done; worth a real back-and-forth on scope/shape before
  batch 5 starts, not a silent default either way.

## Addendum, 25 Aug 2026: batch 5 built — missions 25-28, Act III (The Last Ring) begun. Two real bugs caught by sim, not by inspection.

Maxime's go-ahead for this batch: "next time a boss mission just force feed the ai for the test. ill build the overarching ai after this. keep adding missions." No boss-tagged mission landed in 25-28 (28 was the candidate — Marrow's a tougher rival unit, not a scripted boss fight), so that instruction didn't get exercised this batch; logged here for whichever mission actually is one.

### The four missions

| # | Name | Objective | Result after tuning |
|---|------|-----------|---------------------|
| 25 | The Reckoning | eliminate_all | ~93% (14/15) |
| 26 | The Cradle Beneath | extract_unit (Okafor) | ~87% (13/15) |
| 27 | Falling Back to Meridian | hold_zone | 15/15, real contested combat |
| 28 | Marrow's Reckoning | eliminate_all | ~93% (14/15) |

Maps built via a now-deleted `gen_maps5.py`, same rect/border/BFS-reachability discipline as every prior batch, all four validated clean on first run. Coordinates cross-checked by hand against the actual emitted tile arrays before use, same as always.

### Mission 25 — The Reckoning: capital fire support debut, and a real overtuning bug

Widest single-turn frontage this campaign's opened with (34x16, 5 spawn points) — built deliberately so a big wave reads as a tide, not a queue. First draft: 12 Crawlmass + 6 Splitfang + 4 Sporethrower, 22 hostiles, all turn 1. Sim result: **0/15 wins**. An 8-pilot squad cannot out-attrit 22 hostiles arriving with zero stagger regardless of how wide the map is — that was just too much. Cut to 6/3/2 (11 total), re-ran: 14/15 (~93%). Locked at that.

Meridian's Oath — the in-fiction name for capital fire support this act — is Fire Support (`abil_fire_support`) re-fluffed, not rebuilt: it's already squad-wide unlocked from Mission 14 via `ACT2_UNLOCKS_FROM_14`, so this is a dialogue event only, zero new ability data. Ran with it as continuity: framed as Providence's own guns (the ship from Mission 22, Ash on the Water) repositioned inland to cover Meridian. That's my own creative call, not confirmed lore — easy to rename if it clashes with anything written elsewhere for Providence or Meridian.

### Mission 26 — The Cradle Beneath: Okafor extraction, and a real isolation bug

Okafor (the Tank) is the deliberate extract target — same "tactical variety in who needs carrying" call already made for Solheim (17) and Anand (23). First draft: 4 burrowed Undertow + 8 Crawlmass across the four hive-chamber spawn points. Sim result: **9/15 (60%)**, and every loss had the identical shape: "Loss: the unit to extract was downed," always around turn 11. Checked the actual losing logs rather than guessing — Okafor's own `extract_to_exit` heuristic was pushing her toward the exit ahead of her escort, and a burrowed Undertow ambush hits hard (single hits of 40-70 damage in the logs). Two of them landing on an isolated Okafor was enough to down her before the rest of the squad caught up.

Not a Player AI fix — same standing call as every prior batch's AI limitations, and directly in line with this batch's own instruction to not go fix AI mid-mission-build. The lever pulled was mission design: Undertow count 4 → 2 (one per side instead of one per chamber). Re-ran: 13/15 (~87%), and the two remaining losses are honest turn-limit timeouts, not the isolation bug — a much more forgivable failure mode that fits "the walk-out itself is the tension."

### Mission 27 — Falling Back to Meridian: the real bug, a mission that "won" by doing nothing

First draft: hold_zone, spawns at the map's far edge (x=33) closing on a hold zone at x=6-9 — roughly 24-27 tiles away, selling "three trench lines falling back toward Meridian" as flavor over one real hold_zone (that scope call itself stands, see below). Sim result: **15/15 WIN, every single run at exactly turn 10 (holdUntilTurn), with zero combat logged in any of them.**

That's not good tuning, it's a real bug, and I want to be straight about how it surfaced: I almost read three-for-three green as done. Pulled a full log before locking it in and found zero `attacks` or `is downed` lines anywhere. Root cause: `engine/ai.ts`'s `reflexiveDecision` is vision-gated (Chebyshev distance ≤ the unit's own `vision` stat — Crawlmass 3, Splitfang 4, Sporethrower 5) and explicitly holds position when nothing's in sensor range ("nothing in sensor range — hold position rather than beeline the whole board" — that's the engine's own comment, and it's correct, deliberate behavior, not a bug in the AI itself). A hold_zone mission means the player squad never advances past the hold tiles, so hostiles starting 24-27 tiles out never once entered anyone's vision and literally never moved, any turn, for the whole mission. Mission 12's own hold_zone (the only prior precedent) never hit this because it spawns off `"enemy_deploy"`, which sits close to the hold room by construction — my hand-picked far-edge coordinates for 27 broke that assumption.

Fix: moved the actual `spawnAt` coordinates to x=13 (turn 1 wave, close enough to the hold zone's edge to be seen almost immediately once the squad is dug in) and x=17 (turn 5/7 reinforcements, the mid line's own trench). Left the map's own "spawn" tile markers at x=33 alone — they still read fine as "where Command's sensors first picked up the contact," and moving them isn't required for anything the engine actually reads (`deriveZones()`'s pooling only applies to `"enemy_deploy"`, which this mission doesn't use). Re-ran: still 15/15, but now with real combat — 57 attack/downed lines in a sample run, four player pilots downed in one of them and it was still a win, which is exactly the shape a well-defended entrenched line should have. Locked in at 15/15 on purpose, not walked back further — a mission themed around "the line that holds" reading as more forgiving than 25/26/28 fits the fiction, and squad losses inside a "win" are real stakes even when the outcome isn't in doubt.

### Mission 28 — Marrow's Reckoning: her rival arc closes

Bigger version of Mission 20's dueling ground — `hostile_mech_marrow` fixed center spawn plus a 4-trooper escort turn 1, two more troopers turn 5 from the flanks (7 hostiles total, up from Mission 20's 5). Sim: 14/15 (~93%) on first pass, no retuning needed.

The §7 "closing turn... she finally chooses who she actually serves" beat is delivered via a new `objective_complete`-triggered dialogue event, firing right after the win, not mid-fight. Two things ruled out `unit_downed` for this, one design and one technical: `remove_from_roster` (considered and dropped back in the batch-4 addendum) is built for a player-pilot extraction-failure scenario and is semantically wrong for a hostile "switches allegiance" beat; and separately, `engine/units.ts`'s `nextInstanceId` uses one counter shared across every unit created in a mission — player deploys, then every hostile wave, in spawn order — so a hostile's exact runtime `instanceId` isn't something mission data can predict or hand-author reliably. No mission in this file has ever tried to hook a `unit_downed` trigger to a specific hostile's id, and this wasn't the mission to start. Stays a normal `eliminate_all`, no mechanical side-switch — confirmed the closure line actually fires in a real sim log before calling it done.

### Scope calls made without stopping to ask

- **Roster stays `ACT2_DEFAULT_SQUAD` (8 pilots).** The Independent Campaign doc's own §10 names a third lance for Act III (~20 pilots across 4 lances), but that same table's own footnote already flags it as "the pre-permadeath plan... not a guarantee." Building a real third lance is new-system scope (roster entries, MEK/pilot pairs, integration wiring like `campaignState.ts`'s `integrateSecondLance`), not something a data-only mission batch should do silently. Deferred, flagged here.
- **`deployCapForMission` untouched.** The doc's §3 lists "higher deploy cap" as one of Act III's three asks, but with no third lance yet, the roster IS 8 pilots — an `ACT3_DEPLOY_CAP` above 8 would be a no-op today, nothing to deploy past what's already fielded. Worth doing the moment a third lance actually exists, not before.
- **Falling Back to Meridian stays one real `hold_zone`**, dressed as three trench lines — not a new multi-stage-hold objective type.
- **Marrow's closure stays dialogue-only** — see Mission 28 above for the full reasoning.

### A scope question this batch surfaced, not resolved: how big is Act III?

Found while reading `data/types.ts`'s own `objective` field comment (written back in the protect_asset pass): it references "a second protect_asset mission (32, Act III)" from the Independent Campaign doc's Appendix A — meaning that appendix names at least one Act III mission past 28. I hadn't seen that when I scoped this batch to 25-28 off the doc's main Act III section (which reads as a 4-mission act: "three more asks," missions 25-28 named). So there's a real open question I don't have the answer to: does Act III actually run to something like 32+ (mirroring Act I/II's 12-mission scale), or is the main section's 4-mission list the real plan and Appendix A is an older/looser idea bank? `allCampaigns.ts`'s new Act III subtitle deliberately does NOT say "missions 25-28 of N" the way Act I/II's subtitles do, exactly because I don't know N yet. Worth a real answer before batch 6 starts, rather than me guessing which document is current.

### Verification

`npx tsc --noEmit` — clean. `npx eslint src --max-warnings=0` — clean. `npx vitest run` — **466/466 passed** (up from 450; `mapsAmaranth.test.ts` alone picked up to 115 tests, auto-covering the 4 new maps' structural checks). `npm run build` — succeeds.

### Delivered files

`src/data/mapsAmaranth.ts`, `src/data/campaignAmaranth.ts`, `src/data/allCampaigns.ts` — sent and committed to the connected folder, byte sizes confirmed synced (132993 / 90272 / 4299 bytes).

### Still open

- Both Player AI limitations from batch 4 (Heartwood's `focus_weak` cheap-target preference, the deeper "wall of idle allies" pathing gap) — untouched this batch, per Maxime's own note that the overarching AI is his to build next.
- The exploration idea ("huge maps with a hidden allied squad") from two batches back — still not designed, still not decided on flavor-vs-real-unit or reward-or-not. Didn't fold it into this batch since none of 25-28's own beats called for it naturally; still open for whenever Maxime wants to take it up.
- Act III's true scope (see above) — needs a real answer, not a guess, before batch 6.

## Addendum, 25 Aug 2026 (same day): Act III scope confirmed at 36, the Third Lance built, and missions 25-28 retuned against the bigger roster

Picks up directly from batch 5's own open scope question. Maxime: "total mission for the campaign run up to 36 yes" — confirms Act III runs the doc's full 25-36 (12 missions, matching Act I and Act II's own scale), not the 4-mission reading batch 5's addendum had defaulted to. The Appendix A "second protect_asset (32)" reference flagged in that addendum is consistent with this — a 12-mission act has room for it — but which specific mission numbers 29-36 cover which beats is still batch 6+'s job to work out, not resolved here.

**A mistake, owned rather than glossed over.** Maxime also asked, in the same exchange, whether Act III allows fielding up to 20 pilots. I answered off `ACT2_DEFAULT_SQUAD` (the sim harness's own hand-picked 8-of-10 test subset) without rechecking against the actual file, and told him the roster was still 8. Wrong — `campaignAmaranth.ts`'s own header comment on `SECOND_LANCE_PILOTS` already documents a real 10-pilot roster from Mission 13 onward (5 Warden + full Second Lance), confirmed by rereading the file directly. Caught and corrected in the same conversation, said so plainly. Exactly the kind of thing the project's own carried-over lesson from the book side says to verify against the current file rather than memory — didn't do that the first time, did it the second.

**The real correction underneath both: the Independent Campaign doc's own §6/§9/§10 had Act III's roster wrong.** Those sections said "~20 across four lances." Maxime: "oops. my original plan was to allow player to field 1 lance act 1, then 2 lance, act 2 tthen 3 act 3. to go with the rank incrase of MC and the difficulty spike." Three lances, fifteen pilots, tied to Rourke's own rank progression — not four/twenty. This was a design-doc-drift situation, not a build bug: the doc said one thing, Maxime's actual original intent was another, and per the project's own standing rule a chat decision that changes something already written in a design doc means the doc gets flagged and fixed, not left to quietly disagree with the code going forward.

Then the build authorization, in full: "just add the ne wlance on promotion. fine tune mission for it. both part[s]" — build the Third Lance (integrated at Rourke's promotion beat, Mission 24's win, mirroring the Second Lance's own Mission-12-win trigger) and retune missions 25-28 for the new roster. Both pieces below.

### The Third Lance

Five pilots, `THIRD_LANCE_PILOTS`/`THIRD_LANCE_MEKS` in `campaignAmaranth.ts`, built to complete the archetype grid (4 paths × 3 chassis) rather than duplicate what's already fielded: Sgt. Mireille Kova "Bastion" (Tank/vibrissal), Cpl. Aurelio Ness "Rampart" (Tank/centauroid), Pvt. Sable Onwuka "Whiplash" (Meeps/vibrissal), Spec. Rasha Delgado "Longshot" (Reeps/bipedal), Cpl. Faro Yeun "Splint" (Munti/centauroid). Mek tracks: Kova/Ness/Onwuka get Armorer, Yeun gets Fieldwright, and Delgado is the first pilot in the campaign assigned Quartermaster — a track that existed in `data/types.ts`'s `MekTrack` union since the start but had never actually been used by either Warden Company or the Second Lance.

Integration wiring mirrors the Second Lance pattern exactly, same shape, same files:
- `campaignState.ts` gained `integrateThirdLance(state)` — idempotent (checks whether Kova's already in the roster before adding anyone), free, can't fail, same as `integrateSecondLance`.
- `Debrief.ts` calls it on `mission_amaranth_24`'s win, run-once, with a new `drawThirdLanceCallout` panel ("THE THIRD LANCE HAS ARRIVED — 5 pilots added to the roster") mirroring the Second Lance's own callout.
- `pilotRegistry.ts`'s `PILOT_INDEX`/`MEK_INDEX` merged the new roster in — this is the registry that throws an explicit "Unknown pilot id" the moment anything references a pilot it doesn't know about, which is what would have caught a missed registration before any sim run silently produced garbage.
- `TransporterPad.ts` got `ACT3_DEPLOY_CAP = 12` (12 of the now-15 available pilots — matches the doc's own "typical deploy 8-12" range) and `deployCapForMission` now branches Act I/II/III correctly instead of falling through to Act II's cap past mission 24.

New `ACT3_DEFAULT_SQUAD`: the 5 Warden Company pilots, Okafor/Solheim/Vashti from the Second Lance, and Kova/Onwuka/Delgado/Yeun from the Third Lance — 12 of 15, benching Tarrant, Reyes, and Ness. Deliberately fields three Munti at once (Lask, Vashti, Yeun) rather than avoiding the overlap — a genuine new edge case past Act II's own "two Munti" coverage, worth having in the default squad on top of the size increase itself rather than only ever hitting it by player choice later.

### Doc correction — `Independent_Campaign.md`

Corrected §6 (roster growth line), §9 (the Heirloom-pool derivation, which did its own "4×5=20" math off the same wrong lance count), and §10 (the squad-scaling table's Act III row) using the doc's own established style — bracketed, dated correction notes layered onto the original text, nothing silently rewritten. One thing deliberately left open rather than resolved on my own: §9's 20-entry Heirloom table (Requiem through Meridian's Vow) was left completely untouched, with a flag that whether it should shrink to 15 entries (matching the corrected 3-lance roster) or stay a deliberately oversized 20-entry pool is Maxime's own creative call, not an arithmetic fix I should make for him. Also added a short "Roster note" ahead of the Act III mission list confirming the Third Lance is already part of the roster as of Mission 25, so a future read of the doc doesn't have to cross-reference the code to know that.

### Retuning missions 25-28 for a 12-pilot squad

Missions 25, 27, and 28 moved from `ACT2_DEFAULT_SQUAD` (8) to `ACT3_DEFAULT_SQUAD` (12) and needed real retuning, not just a roster swap — a bigger squad clears faster and absorbs more incoming damage, so the old hostile counts undersold the fight.

**Mission 25 (The Reckoning)** took four passes to land: 18 hostiles felt trivial against 12 pilots, 25 introduced a real win-rate cliff (100% at 23 total, down to ~73% with real losses at 25 — not a smooth gradient, a cliff), 21 undershot again. Locked at 23 (13 Crawlmass, 6 Splitfang, 4 Sporethrower): 100% wins, no losses, but long fights. Didn't keep chasing a smoother curve past that — a real cliff in the sim data isn't something worth sanding down to a single enemy's precision, and 100%-clean-but-long is an honest, acceptable place to land for a non-boss Act III mission.

**Mission 26 (The Cradle Beneath)** is the one real surprise this batch, and it took two rounds to get right. Deploying the full `ACT3_DEFAULT_SQUAD` (12) jammed outright: by turn 15 in the losing runs every unit, Okafor included, stopped acting entirely — the map's own main corridor is only 3 tiles tall, and 12 units competing for that one narrow lane gridlock each other (the engine treats other player units as occupied tiles like anything else). Same "wall of idle allies" Player AI limitation flagged back in batch 4, just newly visible at squad scale instead of map scale.

First instinct was to shrink to 9 rather than go back to the original 8 — and that made things *worse*, not better: 0/15. Root-caused via the actual logs, not guessed at: this is a *different* manifestation of the same underlying limitation — the mission's exit block is only 6 tiles (2×3), and with 9 escorts converging on it, they fill every exit tile themselves before Okafor can reach one; the losing logs show her stopped two tiles short, permanently, for the rest of the mission. Abandoning the "try some smaller number" approach entirely and reverting to the mission's exact original, already-proven 8-pilot squad (`rourke, bosk, iyari, anand, lask, okafor, solheim, vashti`) retested clean at 12/15 (~80%), close to its original ~87% baseline. Per the same standing instruction as every prior batch, the AI itself wasn't touched — this stays a mission-design lever, not an engine fix — and I want to be honest that this doesn't make the underlying risk disappear: a real player who deploys the full 12 on this specific mission can still hit the same jam, just via whichever of the two shapes above their exact composition triggers. The mitigation is "the default squad avoids it," not "the bug is gone."

**Mission 27 (Falling Back to Meridian)** needed no changes — it's untouched by the roster swap since it stayed on its own already-correct squad list.

**Mission 28 (Marrow's Reckoning)** got a third hostile wave (2 more mechs at turn 8, 10 total up from 7) to keep the finale-adjacent fight meaningful against the bigger roster; retested clean.

### Verification

`npx tsc --noEmit`, `npx eslint src --max-warnings=0`, `npx vitest run` — 466/466, unchanged count (this batch was roster data plus mission tuning, no new test surface). `npm run build` — clean.

### Delivered files

`src/data/campaignAmaranth.ts`, `src/data/pilotRegistry.ts`, `src/engine/campaignState.ts`, `src/scenes/Debrief.ts`, `src/scenes/TransporterPad.ts` — sent and committed to the connected folder.

### Still open

- Batch 6 (missions 29-32) is next, including two flagged new-mechanic needs from the doc that haven't been built or even scoped yet: Mission 29's "scripted strategic loss" and Mission 31's "multi-unit extract_unit" (the current `extract_unit` objective only ever resolves a single target id). Neither gets built silently — flagging both again here so batch 6 opens with them on the table, not as a surprise mid-batch.
- The §9 Heirloom-pool question (15 vs. a deliberately oversized 20) — Maxime's call, not resolved this pass.
- Both Player AI limitations from batch 4/21/23 (Heartwood's `focus_weak` cheap-target preference, the occupied-exit-tile / wall-of-idle-allies pathing gap — now confirmed to scale with squad size, not just map size) — still untouched, still his to take up when the overarching AI pass happens.
- The "huge maps with a hidden allied squad" exploration idea — still not designed.

## Addendum, 25 Aug 2026 (same day): units walk to their destination now, XCOM-style, instead of jumping

A side conversation off the Third Lance work, not a mission-batch item. Maxime, watching a unit move: "can you make the sprite walk foward instead of jumping to new position? itl help if we have the code for it when it come time to build the hub." Then, once I'd read the code rather than guessed at the design: "the walk thing should be a feature like xcom pause when the unit move. allowing you to have moment when the board is in flux."

**Why it jumped.** `Battle.ts` has no per-unit sprites — the whole board is one `Graphics` object cleared and redrawn from scratch every `render()` call, straight from live mission state (this file's own header comment: "what's drawn is only ever a reflection of that engine state"). `mission.ts`'s `moveUnit()` already computed a full tile-by-tile path internally, but only ever kept the destination — `unit.pos = destination`, path discarded — so there was never a "mid-move" state for any frame to draw.

**What got built.** `mission.ts` gained `getMovePath(unitId, destination)` — a read-only method mirroring `moveUnit`'s own reachability/path computation exactly, mutating nothing. `Battle.ts` calls it *before* `moveUnit` so it has the real route, then plays that route back visually through a new `animateWalk()`: a chain of Phaser tweens, one per tile (130ms each — a long move takes proportionally longer than a short one, not the same total time regardless of distance), driving a `animatingVisualPos` field that `drawUnit()` and the selected-unit highlight box both draw from instead of the unit's real `unit.pos` while that one unit is mid-step. `moveUnit()` itself is untouched and still commits instantly — the engine's own idea of where the unit is has always been correct and immediate; only the *drawing* of one unit lags on purpose, for the length of its own animation, which is why this doesn't violate the file's "drawn state reflects engine state" rule for anything else on the board.

**The actual feature, not just the animation.** Per Maxime's "pause... board is in flux" framing, `isAnimatingMove` locks input for the animation's duration — `handleBoardClick`, `doEndTurn` (both the button and the spacebar binding), and `runActionSlot` all bail out early on it, same shape as the existing `mission.outcome !== "ongoing"` guards. Verified this actually holds, not just assumed it from reading the code: built a temporary debug-logged Playwright script that fired an END TURN click and a board click 30-60ms after starting a 5-tile walk (path.length 6, ~740ms total) and confirmed both were rejected at the exact millisecond, with the walk continuing uninterrupted underneath — real timestamps, not a screenshot-timing guess (an earlier, cruder version of this same test read as a lock failure purely from screenshot-capture latency between clicks; re-ran without screenshots in the loop and the lock held every time). Debug logging was removed before shipping.

**Not a fix for the Hub.** Checked `Bloom_Wars_Antfarm_Carrier_Hub_v1.md` §13.1 before answering, rather than assuming the two are the same problem: the walkable hub is explicitly logged there as its own unscoped Tier 3 system — free-roam avatar movement and collision, "a second movement/rendering mode... not a coat of paint," not built or started. This pass doesn't touch that. What it *does* hand forward is the interpolate-a-drawn-position-over-time technique itself, now proven out once in this codebase, which the Hub's own movement system will need some version of whenever that gets scoped for real.

**New regression coverage**, `twoAction.test.ts` (same file that already exercises `moveUnit`'s own action-economy rules): `getMovePath` returns the real route without mutating anything, agrees with `moveUnit` on what's reachable, and returns `null` under the same two guards `moveUnit` itself uses (unreachable tile, no actions left).

Verified: `npx tsc --noEmit`, `npx eslint src --max-warnings=0`, `npx vitest run` — **470/470** (up from 466, the four new `getMovePath` tests), `npm run build`. Manually walked a real move through the dev server via headless Playwright and read the actual rendered frames — confirmed a genuine mid-step frame (unit visibly between tiles, selection box traveling with it, HUD/log already showing the post-move state since that half is instant by design) before it settles at the logged destination.

### Delivered files

`src/scenes/Battle.ts`, `src/engine/mission.ts`, `src/engine/__tests__/twoAction.test.ts` — sent and committed to the connected folder.

### Still open

- Fog of war currently reveals instantly at the destination's vision radius the moment `moveUnit()` commits, rather than progressively as the unit's drawn position advances — noticed during the Playwright verification pass, not something Maxime asked for, flagging rather than fixing silently. Animating the reveal itself would be a second, separate pass (fog currently isn't unit-scoped per-frame, it's recomputed board-wide each `render()` from live state).
- No art yet, so this animates a placeholder shape sliding across tiles rather than a walk cycle — expected, matches this project's own established "plumbing now, real art drops in later against the same field" sequencing (GDD §12.2), not a gap specific to this pass.

## Addendum, 25 Aug 2026 (same day): a 12-hour real-time mission clock — flagged as scope, then built

Maxime: "add a clock timer to how long you take to do missions. add that timer as something soldier keep track of(social part) force a failed mission if you take more than 12hour to do the mission. its lore acurate. 12hour real time btw. from the computer or web clock." A real system, not a tweak, so per the project's own standing rule this got flagged back rather than built blind — checked the actual repo first rather than guess: nothing before this pass persisted a mission attempt at all. `saveCampaignState` was only ever called from Debrief (mission end) and Hangar (the shop) — BEAM DOWN wrote nothing, so closing the tab mid-mission simply forgot the attempt existed, no trace anywhere.

That fact is what the whole design turns on, so it's what got put back to Maxime as the real fork: track the clock only while the tab happens to stay open (cheap, but doesn't match "started this morning, back tonight"), or persist it for real. His call: **persist it, "from the biginin of the save data."** Second question — should a timeout cost as much as a real defeat (permadeath rolls) or something lighter — his answer, in his own words: **"they are forcefully recalled to ship for a dressing down by the co."** Mechanically the soft option (no permadeath, no earnings — the mission never happened), narratively a real one (Command's patience spent, not nothing).

**What got built**, `engine/campaignState.ts`'s new "9. Mission real-time clock" section:

- `CampaignState.activeMissionAttempt?: { missionId, startedAt }` — one optional field, round-trips through the exact same `JSON.stringify`/localStorage blob every other campaign field already uses, no new storage mechanism.
- `MISSION_REAL_TIME_LIMIT_MS = 12h`, and `evaluateMissionTimeout`/`applyMissionTimeout` — the same pure-check/mutating-apply split `evaluatePermadeathCheck`/`applyPermadeathCheck` already established in this file. `applyMissionTimeout` only ever clears the attempt; it never touches pilots, points, or status — a timeout costs nothing mechanical, matching "dressing down," not "casualty."
- `TransporterPad.ts`'s BEAM DOWN button now stamps `activeMissionAttempt` and calls `saveCampaignState` immediately, before starting the Battle scene — the one write in this whole feature that couldn't wait for a later "return to base" click the way earnings usually do, since the clock has to already be on disk the instant the player might close the tab.
- `Debrief.ts` clears the attempt unconditionally the moment a mission actually resolves for real (win or loss) — reaching Debrief at all means the 12-hour window was never the reason anything happened.
- `Boot.ts` is the enforcement point: the one scene guaranteed to run on every game load, fresh tab or a tab reopened after being closed all day. Checks for a timed-out attempt before routing anywhere else; if found, applies it, saves, and shows a new full-screen recall notice (Command's own line, in the established terse/procedural briefing voice, addressed to Rourke — she's Warden Company's own CO per this file's existing Rank comment, so "Command" rather than inventing a new named superior felt like the safer, already-established voice) before continuing to MapSelect. The overwhelmingly common case (no attempt, or one still inside its window) falls straight through exactly as before this pass.
- `Battle.ts`'s HUD gained a permanent "Sortie clock: Xh Ym elapsed — Command recalls a lance past 12h" line, right under the turn counter — the actual "something soldier keep track of" half of the ask, so the 12-hour window is felt live during play rather than only discovered after the fact as a recall notice. Deliberately kept as a second, separate axis from the existing turn counter rather than folded into it: turn count is in-mission pressure with no fail line (house rule #5, README — "give player more freedom"), this is real-world time and genuinely does end the mission — conflating the two would have undersold both.

**Verified, not assumed.** Beyond the 8 new `campaignState.test.ts` cases (boundary-exact at precisely 12h, not one tick short; a timeout leaves points/pilot roster byte-for-byte untouched; round-trips through save/load; an old save with no `activeMissionAttempt` field at all loads and evaluates clean rather than crashing), ran the actual flow through a real dev server via headless Playwright: BEAM DOWN'd into Mission 1 for real, confirmed the HUD showed the sortie clock, then rewrote the saved attempt's timestamp to 13 hours in the past (simulating closing the tab and coming back the next day) and reloaded the page — Boot caught it, cleared it, and rendered the recall notice with the correct mission name resolved from the mission id. Clicked through to MapSelect and confirmed the mission was immediately relaunchable, no lingering state.

Verified: `npx tsc --noEmit`, `npx eslint src --max-warnings=0`, `npx vitest run` — **478/478** (up from 470), `npm run build`.

### Delivered files

`src/engine/campaignState.ts`, `src/scenes/TransporterPad.ts`, `src/scenes/Debrief.ts`, `src/scenes/Boot.ts`, `src/scenes/Battle.ts`, `src/engine/__tests__/campaignState.test.ts` — sent and committed to the connected folder.

### Still open

- The "social part" is only half built. The recall notice and the live HUD clock are the mechanical/diegetic-UI half; Maxime's original ask also named this as something the crew should notice and talk about. `claude/Bloom_Wars_Crew_Banter_Phrase_Bank_v1.md` already exists with per-pilot, stage-gated categories (Hangar / After Action / Off Duty / Under Pressure / Close Call) but has no "aware of the clock" category yet, and seeding one across every pilot's arc/voice is real writing work this pass didn't do unprompted — flagged rather than guessed at blind.
- Live, mid-session timeout (the tab genuinely staying open and active past 12 straight hours without ever reloading) isn't separately enforced — `render()` only fires on player input in this codebase, there's no per-frame update loop, and Boot.ts only runs once per page load. The realistic case (close the tab, come back later) is fully covered; a browser tab left open and idle for over half a day without ever being closed or reloaded is not. Noted, not built — narrow edge case, and adding a live in-scene timer tick would be the kind of "drive render() off update(time) every frame" structural change this codebase has deliberately avoided elsewhere (see the collapsed-Bloom pulsing-ring note in an earlier addendum).

## Batch 6, 25 Aug 2026 (same day): missions 29-32, and a new multi-civilian extraction system

Maxime: "work on next mission set now." This batch opened with two flagged new-mechanic needs already on the table from the prior batch's own "still open" note: Mission 29's "scripted strategic loss" and Mission 31's "multi-unit extract_unit" (the existing `extract_unit` objective only ever resolved a single target id). Both got resolved this batch, one by building real new engine surface, one by recognizing it didn't need any.

### The new system: multi-civilian escort/extraction

Mission 31 ("The Last Convoy") needed a way to extract several non-combat civilians at once, with "not everyone gets out" as real design intent rather than a guaranteed specific — the exact same shape §6a's permadeath rule already established for pilots. Walked through the design before building: a civilian can't be referenced by a predictable runtime `instanceId` the way a single `extractUnitId` target can, since `engine/units.ts`'s `nextInstanceId` is one counter shared across every unit the mission ever creates (the same reason Mission 28's own comment gives for never hooking a `unit_downed` trigger to a hostile's id).

**What got built**, all data-first, no new `Side` value:

- `data/types.ts`'s `CampaignMission.civilianSpawns?: { at: Coord; displayName: string }[]` and `objectiveParams.extractThreshold?: number` — spawn positions and names only, no ids. `extractThreshold` defaults to `civilianSpawns.length` (everyone has to make it) unless a mission author deliberately sets it lower.
- `engine/units.ts`'s `createCivilianUnit()` — modeled directly on the existing `npcIncapacitated` precedent (`createRescuableNpcUnit`): `side: "player"` (so hostile AI targets them as real threats, no fake immunity) with a new `BattleUnit.isCivilian` flag excluding them from three places `npcIncapacitated` already excludes its own unit from: `checkWinLoss`'s squad-wipe tally, `Battle.ts`'s click-to-select guard, and the headless sim's player-autoplay loop (via the same permanent `actionsRemaining: 0` trick).
- `engine/ai.ts`'s `decideCivilianAction()` — flee any visible hostile first, else path to the nearest exit. No coordination between civilians, no target prioritization: "one scared person's own instinct, not a squad's."
- `engine/mission.ts`'s `spawnConvoyCivilians()` (constructor), `checkExtraction`'s civilian branch (bank any living, not-yet-extracted civilian standing on an exit tile), `runCivilianStep()`/`moveCivilian()` (called from `runHostileTurn`, right after hostiles resolve — civilians react to what just happened that turn, never move mid-player-turn), and `checkWinLoss`'s civilian threshold branch (win once `extracted >= threshold`; lose once `extracted + stillAlive < threshold`, i.e. the threshold becomes mathematically unreachable; lose on turn limit otherwise).
- `moveCivilian()` deliberately does NOT reuse `moveHostile()` — that function also fires `triggerOverwatch`/`triggerInterdiction`, both hostile-movement-specific reaction systems that shouldn't fire on a friendly civilian passing through. Verified this holds with a dedicated test (below), not just assumed from reading the code.

### Two real bugs found in this system before it ever shipped, both fixed the same day

**`moveAwayFrom`'s flee logic had no sense of direction.** First Mission 31 sim pass came back LOSS 20/20 in every run, turn 3-7. Root-caused via the actual turn log, not guessed at: a fleeing civilian ran straight to the map's own far corner and got stranded there — `moveAwayFrom` maximized distance from threats with zero awareness of which direction was actually safe (i.e. toward the exit). A first attempt added a tie-break toward the exit tiles; re-sim came back LOSS 20/20 again, because the single farthest-from-threats tile on an open map is almost never tied with anything, so the tie-break almost never fired. The real fix: stop maximizing safety. A civilian now looks for any reachable tile *at least as safe* as the one it's already standing on, and among those, heads toward the exit — "keep making progress home as long as this step doesn't make things worse," not "sprint to the single safest point on the map." True panic mode (accept a less-safe tile) only kicks in when literally boxed in. See `engine/ai.ts`'s own comment on `moveAwayFrom`'s `preferToward` parameter for the full account.

**The map itself put the escort on the wrong side of the map.** Even after the AI fix, Mission 31 still went 0/20 — the squad deployed right next to the exit, with the convoy stranded all the way at the map's far end, so hostiles reached the unescorted civilians before the squad had covered a third of the distance. Not a tuning number, a real design bug: an escort mission needs the escort to start next to what it's escorting. Fixed at the map source (the throwaway `gen_maps6.py` generator, same now-deleted-after-use discipline as batch 5's `gen_maps5.py`) — deploy moved to sit right next to the civilian cluster, both retreating toward the exit together from turn 1.

### Per-mission notes

**Mission 29, "The Outer Ring Falls"** (hold_zone, scripted-strategic-loss doc tag). Resolved the doc tag the same way Mission 12's own header comment already resolved an identical question: a real, winnable (and losable) hold_zone, not a new forced-loss mechanic — "the ring falls" lands as Command's own withdrawal order on a genuine tactical win, via an `objective_complete` dialogue event, same dialogue-only technique as Mission 28's Marrow closure. First sim pass (spawning at the map's own decorative far-edge "spawn" tiles) went 15/15 in exactly turn 10 every time with zero combat — the hold room's doorway only opens west, and anything spawned due east of it never enters vision, exact same class of bug Mission 27's build log already found once. Fixed by moving the actual spawn coordinates into the two corridors that reach the doorway. Final: 20/20, real attrition (no permanent losses across the sample), matching this mission's own "100%-clean-but-costly reads fine for a fight that ends in an ordered withdrawal either way" framing.

**Mission 30, "Ashes of the Second Ring"** (eliminate_all, city fighting). Two `bloom_gallcyst` planted directly on the road/spine intersections as fixed strongpoints (sessile, 140 endurance) the squad has to commit to clearing, plus mobile crawlmass/splitfang/sporethrower pressure from the map's own 6 east-edge spawn tiles. "Meridian's Oath damaged on-station" (the doc's own briefing note) built as a real, zero-new-code mechanical fact rather than flavor text — this mission's own `CampaignMission` simply omits `bonusAbilityUnlocks` (Fire Support), unlike every other Act II/III mission in the file. 26/30 (~87%) across two combined sim passes, matching Mission 26's own precedent for "appropriately dangerous."

**Mission 31, "The Last Convoy"** (extract_unit, multi-civilian, "not everyone gets out"). See the two bugs above. After both fixes, the raw enemy composition was still too lethal for the civilians' own fragile stats (splitfang's 38 attackPower against a civilian's defense is close to a one-hit kill) — not fixed by touching civilian balance (a broader, cross-mission change, out of scope for tuning one mission), fixed by thinning and staggering the actual ambush waves instead. Landed at 13/20 (65%) — real variance, both loss conditions (extraction-below-threshold, turn-limit) firing across the sample, matching "not everyone gets out" as genuine risk rather than a guaranteed specific or a coin flip.

**Mission 32, "Hold at the Spire"** (protect_asset, second debut of the objective type after Ash on the Water). First draft went 20/20 win with the ship never taking a single point of damage across 40 sim runs — not a count problem: the deploy row spanned the dock's full width, so the squad's own default formation read as an unbroken wall, and the hostile AI has no notion of "beeline for the defendZone" — it just engages whichever player unit is nearest. Fixed at the map level by splitting deploy into two flank blocks, leaving the dock's own center north edge open by default, mirroring Ash on the Water's own "two causeways" tension. Counts roughly doubled to match. Landed at 11-14/20 (55-70% across two passes) with real squad-wipe stakes; the ship itself only actually took damage in a small minority of runs even after the fix, and this was flagged honestly as a known texture gap rather than chased further at the time. **Superseded same day — see "Batch 6 follow-up" below.** The gap wasn't the Player AI's positioning at all; it was a real engine bug (reflexive/pack Bloom freezing with nothing visible), and the actual fix produces the intended stakes reliably. This mission's own header comment in `campaignAmaranth.ts` has the corrected, current account — this paragraph is left as-is for the historical record of what was tried and believed at the time.

### New regression coverage

`engine/__tests__/civilianExtraction.test.ts` (14 tests) — `createCivilianUnit`'s shape, `spawnConvoyCivilians`'s constructor wiring (and its no-op for missions without `civilianSpawns`), `checkExtraction`'s banking/no-double-bank behavior, `checkWinLoss`'s full civilian threshold math (win, both loss conditions, a partial loss that doesn't end the mission by itself), the `playerAlive` exclusion (a wiped real squad still loses even with living civilians on the board), `runCivilianStep`/`moveCivilian`'s actual movement and its confirmed non-triggering of a nearby player unit's held overwatch, and `moveAwayFrom`/`decideCivilianAction` directly.

### Verification

`npx tsc --noEmit`, `npx eslint . --max-warnings=0`, `npx vitest run` — **508/508** (up from 494), `npm run build` — clean. All four new maps pass `mapsAmaranth.test.ts`'s generic per-map validation contract automatically, no per-mission test needed.

Final tuning numbers (20-run sim samples, `npm run sim -- <mission_id>`, per the project's own "a number or map only counts once it's run through the script and passed" rule):

- Mission 29: 20/20 (100%, real attrition, no permanent losses — by design, see above).
- Mission 30: 26/30 (~87%).
- Mission 31: 13/20 (65%).
- Mission 32: 11-14/20 (55-70% across two passes). **Superseded — see "Batch 6 follow-up" below for the corrected 11/5/4/6/3 tuning (20/40, 50%) that shipped.**

`gen_maps6.py` — deleted after full transcription and validation, same disposable-scratch-script discipline as `gen_maps5.py` before it.

### Delivered files

`src/data/types.ts`, `src/engine/units.ts`, `src/engine/ai.ts`, `src/engine/mission.ts`, `src/scenes/Battle.ts`, `src/data/mapsAmaranth.ts`, `src/data/campaignAmaranth.ts`, `src/engine/__tests__/civilianExtraction.test.ts` — sent and committed to the connected folder.

### Still open

- The two-project naming lock's own automated check (`tools/lint-spoiler.mjs`'s `BW_RESERVED_TERM`) isn't configured in this sandbox — expected (git-ignored `.env.local`), flagged by the tool itself, not new to this batch.
- Everything already open from prior batches (§9 Heirloom pool, both named Player AI limitations, the huge-maps-with-hidden-squad idea, fog-of-war's instant-reveal-on-commit, live mid-session timeout enforcement, the mission clock's "social part" banter seeding) is still open — untouched this batch.
- Act III's own remaining missions (33-36, through the doc's actual final boss at 35) are not built or scoped yet. **Superseded — see "Batch 7" below: all four built, the campaign is complete.**
- (Mission 32's ship-damage rarity, listed here originally, turned out to be a real engine bug rather than a texture gap — resolved same day, see "Batch 6 follow-up" below. New observation from that fix: protect_asset tuning is a knife-edge, not a gradient, once the AI actually behaves correctly — worth keeping in mind if a third protect_asset mission ever gets built.)

---

## Batch 6 follow-up, 25 Aug 2026 (same day): the real Mission 32 fix, and its fallout on Mission 22

Maxime's read on the Mission 32 report above: **"in mission 32 its fine. as long as the bloom can make it to the ships. they arent intelligent, they are just overruning the zone, so if they cant get to the ship, make theyr number go up."** The squad successfully walling off the dock was never the bug — a mindless swarm has no reason to route around a line it can't see past. The ask was specifically: overwhelm by numbers, not by making the Bloom smarter.

### Two numbers-only attempts, both dead ends

First attempt: scaled every existing flank wave ~60% (28/14/10/14/10/10, one wave added). Win rate dropped from 55% to 15% — but the ship still never took a single point of damage across 20 runs. Second attempt: reverted the flanks to their original counts and added a dedicated wave spawning at (12,1)/(13,1), directly above the map's own open center gap and further from either flank deploy block than from the dock itself — a lane nothing in the default formation was standing between it and the ship. Still 0/20 ship-damage ticks, and the win rate had dropped to 20%. Both attempts made the mission meaningfully harder for no benefit — a textbook "flag it rather than keep grinding" moment.

### Root cause: a Bloom with nothing visible just freezes, forever

Grepped a full sim log for any Crawlmass from the "undefended" center-lane wave ever taking a single step toward the dock. Zero hits, at any turn, in any run. The wave wasn't being intercepted — it wasn't moving at all. `engine/ai.ts`'s `reflexiveDecision` had a one-line rule: `if (!targets.length) return {};` — "nothing in sensor range (vision 3), hold position, don't beeline the whole board." A Crawlmass that never got within 3 tiles of a player unit sat frozen at its spawn tile for the entire mission. No amount of "more of them" fixes a unit that never takes a step. This also fully explains why neither prior tuning attempt worked — it was never a numbers or formation problem.

### The fix: walk toward the defend zone when nothing's visible

Brought this to Maxime as a real design decision rather than just patching it — it's a shared engine change (`engine/ai.ts`), not a data tweak, and it directly affects every protect_asset mission, not just this one. Asked whether to scope the fix to reflexive tier only, or extend it to pack tier too. **Maxime's call: both.** `reflexiveDecision` and `packDecision` now fall back to walking toward the nearest `MapDefinition.defendZone` tile when nothing is visible, instead of holding — but only on maps that actually have one, so hold_zone/extract_unit/pursue missions are completely unaffected. See `engine/ai.ts`'s own comment above `nearestZoneTile` for the full account.

### Fallout: Mission 32 needed retuning, and Mission 22 needed it far more urgently

The fix doesn't just let a formerly-frozen wave walk somewhere — it changes the whole mission's pressure curve, because a Bloom that kills its target and has nothing else visible no longer goes idle either; it heads for the dock and re-engages instead. Re-tested Mission 32 from scratch (no center-lane wave needed anymore — every wave can reach the dock on its own now): the old shipped counts (20/10/7/10/6) collapsed to 0/20 win; even the original pre-doubling draft (10/5/4/5/3) still ran hot (72% win). Landed on **11/5/4/6/3** — 20/40 win (50%, close to the original 55% baseline), real ship damage in ~27% of runs (up from ~5% before the fix), including 2 outright ship-destroyed losses in that 40-run sample. The old center-lane wave and its dedicated spawn points were removed entirely — no longer needed.

Mission 22 ("Ash on the Water," the *first* protect_asset mission, built two batches ago) turned out to be affected far more dramatically, and wasn't even touched by the two failed tuning attempts above — it just broke silently until checked. Its map geometry is far tighter than Mission 32's: deploy sits directly flush against the dock (one tile away on most rows), and once a Bloom with nothing visible reaches the dock zone, it just plants there — every turn it ends inside the zone still ticks `PROTECT_ASSET_TICK_DAMAGE` (25) regardless of whether it's fighting anyone, and nothing makes it leave. One or two orphaned campers is enough to burn through `assetMaxHp` (300) well inside the 14-turn limit. Both the old shipped counts (14/6/8) *and* the original pre-bump draft (8/4/4) went a clean **20/20 ship-destroyed loss** post-fix. Retuning here turned out to be a knife-edge, not a gradient — 4/2/2 held at 20/20 win (with damage on nearly every run, ship never actually dying); 6/3/3 flipped straight back to 20/20 loss, no middle ground found between those two single-unit steps. Landed on **5/2/2** — 35/40 win (87.5%), damage visible in nearly every run, ship-destroyed loss in ~13% — deliberately left easier than Mission 32's band since this is the first protect_asset mission in the campaign and an Act II squad, not Act III's stakes.

### New regression coverage

`engine/__tests__/ai.test.ts` gained a new `describe` block (5 tests) covering the defendZone fallback directly: reflexive tier walks toward it with nothing visible; reflexive tier still holds position on a map with no defendZone at all (every non-protect_asset mission's behavior is provably unchanged); a visible target still wins over the fallback (it's a fallback, not a new priority); pack tier does the same via `packDecision`; pack tier also still holds with no defendZone. One test-writing note: the grid's own movement is 4-directional with no diagonal shortcuts, so a moved-toward-target assertion has to measure Manhattan distance (dx+dy), not Chebyshev (max(dx,dy)) — a single move can spend its whole range closing one axis and look like a stall under the wrong metric even when real progress happened.

### Verification

`npx tsc --noEmit`, `npx eslint . --max-warnings=0`, `npx vitest run` — **513/513** (up from 508), `npm run build` — clean.

### Delivered files (this follow-up)

`src/engine/ai.ts`, `src/data/campaignAmaranth.ts`, `src/engine/__tests__/ai.test.ts` — sent and committed to the connected folder, superseding the batch-6 versions of the first two.

### Still open

- Protect_asset tuning is now confirmed knife-edge rather than gradient once the AI behaves correctly — a third protect_asset mission, if one ever gets built, should expect the same single-unit-step sensitivity and budget sim-testing time accordingly.
- Everything else already open from batch 6 above and prior batches is unchanged.

---

## Batch 7, 25 Aug 2026: Act III finale — Missions 33-36, campaign complete

The last four missions of the 36-mission campaign: "The Innermost Ring" (hold_zone, multi-wave), "No Word from the Fleet" (survive_n_turns), "The Last Ring" (hold_zone, The Cradle's debut), and "Until Relief" (survive_n_turns, campaign finale). Interleaved this batch with an urgent side-task: Maxime flagged that a different conversation working from this project believed only Missions 1-4 existed, traced to two stale project docs (`claude_Bloom_Wars_Master_Index.md`, unrefreshed since 21 Aug, and this doc's own sibling — the Independent Campaign doc's stale 22 Aug status note) — both rewritten and pushed before resuming mission work. Not a code problem, but worth noting here since it delayed this batch and is exactly the kind of process failure this log exists to catch.

### The Cradle archetype

Independent Campaign doc §8 already locked the design intent: a real new stat block (like Choir), not a Heartwood reuse (unlike the still-unaddressed Wellroot gap) — "the campaign's true final boss, largest Endurance wall in the campaign, built to make the Collapse rule do maximum horror work." Built as `bloom_cradle` in `data/bloom.ts`, same lineage as `bloom_heartwood` (concussive/sessile/seismic/emergent), every stat pushed past it: END 400→560 (+40%, matching Choir's own escalation ratio over Sirenmaw), VIT 60→70 (nudged up, not down — still low enough to stay Severance-vulnerable per the Collapse rule's own "hits hardest exactly when it looks weakest" shape, just survivable enough a single lucky hit doesn't feel cheap after a long siege), attackPower 60→75, attackRange [1,4]→[1,5], vision 8→9. Reuses the proven `fx_knockback_1` onHit rather than inventing a new effect with no empirical basis. Full derivation is in the archetype's own comment.

### Mission 35's interpretation call: hold_zone, not eliminate_all

The Independent Campaign doc tags Mission 35 "[final boss breaches]," not "[eliminate_all boss]" the way Mission 21 tagged the Heartwood fight — decided to take that literally rather than default to the established boss-fight pattern. hold_zone's own win check never reads `hostileAlive.length`, so The Cradle's survival or death never factors into winning either way; killing it is a completely reasonable way to play (560 Endurance is a lot to burn down while also holding a doorway) but never required. Documented as a deliberate reading in both the mission's own comment and this batch's header comment in `campaignAmaranth.ts`, not left implicit.

### Maps

`gen_maps7.py` (deleted after use, same disposable-scratch-script discipline as every prior batch) built and BFS-validated all four grids. Missions 33 and 35 both reuse the single-doorway walled-room shape Missions 27/29/32 already proved out, rather than risking a first-time two-doorway room on the campaign's last two hold_zone missions — "the ring" reads through wave count and staggered approach corridors instead. Missions 34 and 36 are open fields (no hold/defend zone) with deploy centered and spawn pressure from every direction, matching survive_n_turns' own shape.

**A real bug, not a tuning number, in Mission 35's first draft.** The Cradle's sealed pocket was first placed beside the room's east wall (~9 tiles from the doorway-adjacent tiles the squad naturally clusters around to plug the room). Sim-tested 20 runs: the Cradle spawned correctly every time, but never once logged an attack — hold_zone's own win check doesn't require covering every tile, so the squad simply never needed to stand anywhere near it. A boss that spawns but never fights. Fixed by moving the pocket to a single sealed tile directly under the room's own south wall, centered so its attackRange [1,5] covers every hold tile from that one position (worst case exactly 5, at the far corners) — however the squad spreads out to hold the zone, nobody is out of range anymore. Re-tested: The Cradle now lands real hits (56-68 damage a swing, close to a full-HP kill on most archetypes) every run.

### Mission builds and sim-tuning (`npm run sim -- <mission_id>`, 15-20 run samples per point)

- **Mission 33, "The Innermost Ring"** (hold_zone, holdUntilTurn 16 / turnLimit 22): first-draft counts (12/6/5/8/5, holdUntilTurn 12) went 20/20 win at exactly turn 12 every time — wave 5 (spawned turn 13) never got a chance to matter, holdUntilTurn ended the mission before it arrived. Pushed counts to 14/7/6/10/6 and holdUntilTurn to 16 so all five waves are live. **16/20 win (80%)** — real variance in the failure mode (2 losses from a hostile slipping onto the hold zone uncontested, 2 from the turn limit expiring first).
- **Mission 34, "No Word from the Fleet"** (survive_n_turns, turnLimit 14): first-draft counts (10/4/4/6/4, 28 total) went 20/20 win with zero player losses — real combat, no real risk, wrong for "darkest hour." Roughly doubling (16/8/8/10/8, 50 total) overcorrected hard to 0/20 win, full squad wipes by turn 8-12 — the same steep sensitivity Mission 32's own history already flagged, rediscovered rather than assumed away. A ~20% bump from the original (12/5/5/7/5, 35 total) landed at **12/20 win (60%)**, losses landing right at turns 12-13, one turn short of the turnLimit-14 finish line.
- **Mission 35, "The Last Ring"** (hold_zone, holdUntilTurn 16 / turnLimit 22, The Cradle debuts turn 6): after the Cradle-placement fix above, **11/20 win (55%)** — the campaign's hardest fight by design, real permanent losses even on wins.
- **Mission 36, "Until Relief"** (survive_n_turns, turnLimit 16, campaign finale): same knife-edge sensitivity as Mission 34, a third time this batch. First-draft "biggest yet" counts (14/6/6/10/8/2, 46 total) went 0/20 win, every run a full wipe by turn 9-15. Cutting to 10/4/4/7/6/2 (33 total) overcorrected to 20/20 win — a 39% swing in total count was enough to flip certain-loss to certain-win. A middle step (12/5/5/8/7/2, 39 total) landed at **16/20 win (80%)** — harder than a formality, but reads as the triumphant final stand rather than the hardest fight in the game, which stays Mission 35's own Cradle siege.

Confirmed all four numbers hold under a second, independent 15-run pass (73%/67%/40%/87% respectively) — within normal sampling variance for this sample size, no drift.

### Verification

`npx tsc --noEmit`, `npx eslint . --max-warnings=0`, `npx vitest run` — **529/529** (up from 513), `npm run build` — clean. `allCampaigns.ts`'s Act III subtitle updated from "missions 25-28 built, 12 planned" (stale since batch 5 — batches 6 and 7 both landed without it being touched, a smaller version of the same doc-drift problem this batch's side-task was about) to reflect the campaign's actual completion.

### Delivered files

`src/data/bloom.ts`, `src/data/mapsAmaranth.ts`, `src/data/campaignAmaranth.ts`, `src/data/allCampaigns.ts` — sent and committed to the connected folder.

### The campaign is complete

All 36 missions of The Amaranth Reckoning are built, sim-tuned, tested, and delivered. `src/data/campaignAmaranth.ts` is ground truth; this log is the batch-by-batch history; the Independent Campaign doc is the design intent behind it.

### Browser QA pass, same day

Maxime asked to have the actual app started so I could reach it myself and see the rendered game, not just sim output — then gave open-ended time to test. Started the Vite dev server in this session's own sandbox and drove it with the sandbox's own pre-installed Playwright/Chromium (this is a different browser on a different machine from Maxime's own Chrome — it's not something he could watch live, only screenshots and this write-up after the fact).

Loaded all four new missions into real Battle scenes (not just the mission-select cards) and played several turns of each by hand:

- **Mission 33 (The Innermost Ring):** map, single-doorway room, hold-zone tiles, and both wave-spawn clusters (north/south of the room) all render correctly. A permadeath "permanent loss" verdict fired on turn 7 when the squad's only Munti went down — correct per §6a.
- **Mission 34 (No Word from the Fleet):** open-field map and all-sides wave spawns render correctly. A do-nothing playthrough (script only clicked END TURN, never moved a unit) wiped by turn 5 against an ambush from every direction, which is the expected outcome for zero player input, not a balance signal — the sim's own real Player AI already found 60% win with actual play. Mission Failed screen and the debrief hand-off both work.
- **Mission 35 (The Last Ring):** confirmed the fix holds — "Event: bloom_cradle spawns at (18,12)" fires on schedule at turn 6, and the Cradle's marker renders at the correct sealed-pocket tile south of the hold room. Did not catch a live "Cradle attacks..." line on screen — the test script never moved a unit into the hold room, so nothing ever came within its range in this particular playthrough. That's a gap in this manual test's method, not in the mission: `Mission` is the same turn manager for both `src/sim` and this scene, so the 20/20 sim runs' own confirmed 56-68 damage Cradle hits apply here too. Didn't chase a hand-scripted multi-turn walk to force the shot on screen — diminishing returns against something already proven.
- **Mission 36 (Until Relief):** open-field map, spawn markers on all 4 edges and all 4 corners, and the epilogue dialogue event all render correctly. Same do-nothing-input wipe as Mission 34, same caveat.

Zero console or page errors across every run, every mission, every tab.

Also ran a regression check on content this batch didn't mean to touch, since the new consts and missions got spliced into files that already had 32 missions' worth of content in them: Act I and Act II tabs still render with their correct subtitles, and Mission III.32 ("Hold at the Spire," the mission immediately before the new batch in the same file) still opens and plays cleanly. No bleed-through from the edit.

Caught one real doc bug in the course of this: this log's own "Still open" list, below, had been calling the live permadeath system unbuilt for possibly its entire existence, contradicted directly by what turn 7 of Mission 33 just showed on screen. See the correction inline below rather than silently fixing it.

### Still open

- §9's Heirloom pool (19 of 20 unbuilt, only Requiem implemented) — flagged again, not touched, matching every prior batch's own note. Missions 33-36 didn't attempt it either.
- The Wellroot's own unaddressed gap (Mission 21, reuses `bloom_heartwood`'s stat block directly rather than a distinct archetype) — still unfixed, still just flagged.
- Command Fatigue / Stress-Morale (§6b) — still locked design intent, not built in the live engine.
- **Correction, same batch:** the line that used to sit here also listed the live permadeath system (§6a) as unbuilt design intent. That's wrong, and has been wrong since it was first written — permadeath (`evaluatePermadeathCheck`/`applyPermadeathCheck` in `engine/campaignState.ts`, wired into `Mission.handleDowned()`) has been live and engine-built since Mission 3 (batch 1), reconfirmed at Mission 12 (batch 3), and reconfirmed again just now: this batch's own browser QA pass (see "Browser QA pass" above) watched both branches fire for real in the live Phaser UI — "a living Munti is still on the field — standard restock" on Mission 35, and "no living Munti remains on this side — permanent loss" on Missions 33, 34, and 36. Caught by re-reading this list against the actual engine code rather than trusting what a prior pass wrote here — the same discipline Cross_Project_Writer_Note.md asks for, applied to this project's own build log instead of catching Maxime out on it.
- The mission clock's "social part" — `socialHook` fields exist on missions 8 onward but nothing reads them yet; the NPC Reaction Engine doc they'd feed is "zero code, not scheduled."
- Both named Player AI limitations (no Ambush/Interdict/Sensor Sweep usage, no general Screen heuristic) — unchanged.
- This batch's own doc-staleness incident is a process flag as much as a content one: two project docs (Master Index, Independent Campaign doc) went stale for days across six-plus batches of active work before an external report caught it. Worth checking doc currency as a standing item at the start of future batches, not just when something breaks.
