# The Bloom Wars — engine test pass

A browser-playable grid tactics engine (TypeScript + Vite + Phaser 3),
built against the design package in the Claude project "The Bloom Wars"
(GDD v0.2, Data Pack v0.1, Build Brief v0.1, Canon Pass v1).

**Status, honestly:** this is an engine/mechanics proof, not the final
game. The four missions wired up (1a/1b/2/3) are the Data Pack's vertical
slice, used here to test whether movement, combat, terrain, the mission
event system, AI, and win/loss all actually work end to end — the real
campaign missions will be authored separately later (Canon Pass §J). See
"What's not built yet" below for the honest gap list.

## Running it

```
npm install
npm run dev        # http://localhost:5173 — pick a mission, play it
npm test           # 140 tests: the combat resolver validated against
                    # sim_output.txt exactly, plus movement + event +
                    # Repair-ability + Meeps-dodge + Tank-shield +
                    # Munti-regen + two-action-per-turn tests
npm run sim -- mission_1a   # headless: runs a mission with both sides on
                             # simple autoplay, prints the full turn log
npm run typecheck  # tsc --noEmit
npm run lint       # eslint + the spoiler lint (see design/README_reserved_term.md)
npm run build      # production bundle to dist/
```

## Playing it

Every unit gets **2 actions a turn** (house rule — see below). Pick a
mission from the mission-select screen. Click one of your units to see its
move range (green), what it can attack from its current tile (red), and —
for a Munti (Derek Barasj in the slice roster) with an action still free —
which adjacent ally it can Repair instead of attacking (cyan). The HUD
shows how many actions the selected unit has left. Click a green tile to
move, a red-highlighted enemy to attack, or a cyan-highlighted ally to heal
them 30 HP (38 for Barasj, whose mek has Fieldwright as primary — Data Pack
§5/§6). Move and Repair each cost 1 action and **don't** end the unit's
turn — it stays selected so you can move then Repair, Repair twice on two
different allies, or move twice. Attack always spends every action the
unit has left and ends its turn, no matter which action slot you use it in.
Click **End Turn** to resolve the hostile AI's turn, the environment step
(Bloom-mat acid, deploy-pad repair), and advance to the next turn. The
mission ends in a win/loss overlay per the objective type (eliminate all /
hold the zone / extract a unit).

## What's built (Build Brief v0.1's 12 steps)

| # | Step | Status |
| --- | --- | --- |
| 1 | Scaffold | Done — Vite+TS+Phaser3, the repo layout from GDD §2.1, ESLint's two restricted-import rules (verified: an engine file importing `phaser` fails lint), the spoiler lint wired into pretest/prebuild |
| 2 | Types and data | Done — all of Data Pack §2-§11 transcribed, with the Canon Pass v1 corrections applied (Thyns is Hiopi/centauroid, Mission 3's extraction-failure roster filled in, points-carry-forward resolved) |
| 3 | Grid and pathfinding | Done — flood fill + path reconstruction, per-chassis movement cost, centauroid straight-line charge detection |
| 4 | Combat resolver | Done and **validated**: 95 test cases reproduce every number in `sim_output.txt` exactly — damage matrix, counterattack conditions, tier-gap cap, terrain, charge |
| 4b | Repair (Munti active ability) | Done and tested — 30 HP to an adjacent ally instead of attacking, once per turn, x1.25 for a Fieldwright-primary mek (Barasj); wired into the Battle scene as a cyan click-target. 6 test cases (`repair.test.ts`) |
| 4c | Meeps dodge (house rule, not in the Data Pack) | Done and tested — see "House rules" below. 8 test cases (`dodge.test.ts`) |
| 4d | Tank shield (house rule, not in the Data Pack) | Done and tested — see "House rules" below. 12 test cases (`shield.test.ts`) |
| 4e | Munti passive regen (house rule, not in the Data Pack) | Done and tested — see "House rules" below. 6 test cases (`muntiRegen.test.ts`) |
| 4f | Two actions per turn (house rule, not in the Data Pack) | Done and tested — see "House rules" below. 5 test cases (`twoAction.test.ts`), plus updated `repair.test.ts` |
| 5 | Turn manager | Done — turn order, environment step (bloom-mat acid, deploy-pad repair), win/loss for all three objective types |
| 6 | Bloom health model | Done and validated — Endurance/Vitality Collapse rule, the no-overflow rule, all four worked examples (Gallcyst 5 hits, Sporethrower 4, Crawlmass 3, Heartwood 7) reproduce exactly |
| 7 | AI tiers | Done, simplified — reflexive, pack (shared-target, 3-tile radius), emergent (Munti-priority). The "avoid the Tank's overshield radius" and "hold reserves" parts of emergent are not implemented; the Heartwood still plays reasonably since it never moves |
| 8 | Mission events | Done and tested — turn_start (+repeatEvery), zone_entered, unit_downed, objective_complete, guardGroup mutual exclusion, Mission 1a's collapse ambush (both trigger paths) and Mission 3's extraction failure all work |
| 9 | Headless sim harness | Done — `npm run sim -- <mission_id>` runs any of the 4 missions with autoplay on both sides, never hangs (tested all 4) |
| 10 | Rendering and input | Done, rough — placeholder geometric shapes per GDD §12 (shape=path, colour=faction, outline weight=centauroid), move/attack highlighting, HP bars (two-segment for Bloom), a plain-text combat log. No combat forecast popup, no Collapse pulse animation yet |
| 11 | Meta layer | **Not built.** No debrief scoring, no points shop, no gear-tier purchase, no campaign persistence across missions (`localStorage`) |
| 12 | Heirloom + campaign wiring | **Not built.** Severance exists in `data/abilities.ts` and `engine/combat.ts` has the pieces (`ignoresFullHpCap`, `vsBloom: "collapse_check"`) but there's no targeting UI and no mission-to-mission sequencing yet |

## House rules added during playtesting (not in the Data Pack)

- **Meeps: 40% dodge on any hit they could take.** Added after Maxime
  played mission 1a and found Meeps too fragile even with counter (22 Aug
  2026). Applies whenever a Meeps is on the receiving end of damage: as
  the primary target of a mech or Bloom attack, and as the counter-damage
  a Meeps eats after attacking something that counters back — two
  independent 40% rolls per exchange, one per direction. A dodge zeroes
  that hit only; it never cancels the other side's action (a dodged
  primary hit still lets the Meeps counter normally; a dodged counter-hit
  doesn't undo the damage the Meeps itself just dealt). The chance lives
  in `data/combatTables.ts` (`MEEPS_DODGE_CHANCE`) as one tunable number.
  The Data Pack §7.4 formula itself is untouched and still fully
  deterministic — the dice roll happens only at the `Mission.attack()`
  call site in `engine/mission.ts`, passed into `resolveMechAttack` /
  `bloomDamage` as explicit `dodged`/`counterDodged` booleans that default
  to `false`, so every `sim_output.txt` case in `combat.test.ts` is
  unaffected. Not yet reflected back into the Data Pack docs themselves —
  ask Claude to do that if it should become canon for the real campaign
  too, rather than staying test-pass-only.
- **Tank: a real shield pool, shared with adjacent allies.** Also Maxime's
  call (22 Aug 2026), same playtest. Overshield now also grants an
  absorb-before-HP shield (20 points, `TANK_SHIELD_CAPACITY`) to the Tank
  itself and every adjacent ally — rendered as its own blue line above the
  HP bar in the Battle scene. Incoming damage drains shield before it
  touches real HP. It regens 8 points a turn (`TANK_SHIELD_REGEN_PER_TURN`)
  but only for a unit that took zero damage — shield or HP — since the
  last tick; get hit and it stops recharging until you get a clean turn.
  Step outside an eligible Tank's radius and shield/maxShield drop to 0
  immediately — it's borrowed from standing near the Tank, not a personal
  stat you keep. Explicitly meant to reward keeping fragile units (Meeps)
  clustered near the Tank. Implementation-wise this only changes *where
  damage lands* (`engine/combat.ts`'s `applyMechDamage`) — the Data Pack
  §7.4 damage-calculation formulas themselves are untouched, so
  `sim_output.txt` fidelity is unaffected. Also not yet in the Data Pack
  docs — same offer as above.
- **Munti: passive AoE regen, on top of Repair.** Also Maxime's call (22
  Aug 2026). Every living Munti passively heals itself and same-side allies
  within 2 tiles for 8 HP a turn — free, doesn't cost an action, stacks
  with whatever Repair does that same turn. Flat amount for now, doesn't
  scale with a Fieldwright mek the way Repair's active heal does (Repair
  stays the "big single-target burst," this is the "constant trickle
  nearby"). Multiple Muntis in range don't stack their regen. Not rendered
  with its own UI yet — it's silent in the Battle scene beyond the HP bar
  moving; only the combat log's per-attack dodge/shield lines got that
  treatment so far.
- **Every unit: 2 actions per turn, XCOM-style, replacing the old
  one-move-plus-one-act model.** Also Maxime's call (22 Aug 2026), same
  playtest — specifically requested as "id build munties like medics in
  xcom." Verified against XCOM 2's actual Medikit rule (xcom.fandom.com)
  rather than assumed from memory: Move and Repair each cost 1 action and
  do **not** end the turn, so a unit can move twice, Repair twice (on two
  different allies — the actual point, so Derek Barasj can patch up two
  wounded allies in one turn instead of one), or move then Repair in either
  order. Attack always consumes every action the unit has left and ends its
  turn immediately, regardless of which action slot it's used in — you can
  heal-then-heal, never heal-then-shoot-then-heal-again, exactly like an
  XCOM Specialist. This replaced the `movedThisTurn`/`actedThisTurn`
  booleans on every unit with one `actionsRemaining` counter
  (`MAX_ACTIONS_PER_TURN` in `data/combatTables.ts`), and — as a direct
  consequence, not something separately asked for — **removed Repair's old
  once-per-turn cap entirely**: the action-point budget is the only limit
  now. Flagging that removal explicitly since it was inferred from the
  "medics in xcom" framing rather than stated outright; worth confirming it
  feels right rather than too strong once Derek's double-healing a squad in
  practice. Considered and explicitly set aside for later: Sunrider: Mask
  of Arcadius's alternative — a single shared Energy pool that both
  movement and attacks draw from, letting a unit chain several cheap moves
  or one big attack — since Maxime asked "should we build on this or more
  like sunrider battlesystem" and XCOM's cleaner two-action shape won for
  the ground-combat layer specifically. Sunrider's model stays parked for
  a possible future company-scale/ship layer (see the project's
  `Bloom_Wars_Spitball_Ideas.md`), where a continuous energy budget suits a
  more freeform, less grid-locked kind of turn better.

## Known simplifications, flagged rather than hidden

- **Player-vs-Bloom damage formula is not in the source docs.** The Data
  Pack specifies Bloom-attacking-mech damage (§8.2) but never the reverse
  direction. `engine/combat.ts`'s `resolveAttackOnBloom` is a first-pass
  placeholder (half of effectiveAttack, same wounded/terrain terms) —
  functional, not validated by `sim_output.txt` the way the mech resolver
  is. Cheap to change; isolated to one function.
- **No counterattacks across the mech/Bloom boundary** in either
  direction, for the same reason — the spec only explicitly rules this
  out for Sporethrower. Simplified to "neither side counters" rather than
  guessed per-creature.
- **Some mek active abilities still aren't wired into play**: Cockpit Evac
  and Fabricator mid-mission redeploy exist in the data (`data/abilities.ts`,
  `data/meks.ts`) but the Battle scene has no UI for them yet. Repair now
  is (see above). Passive mek stat bonuses (Armorer, Runemaster
  vision/effect potency) ARE applied via `engine/units.ts`'s effective-stat
  calculation.
- **Deployment is automatic**, not an interactive placement step — pilots
  land on deploy pads in roster order. GDD §3 describes deployment as a
  player choice; that choice isn't built yet.
- **4 of 7 Bloom archetypes' `vision` values are invented**, not sourced
  (Data Pack only gave vision for Crawlmass, Undertow, Heartwood) — see
  `data/bloom.ts`'s file header.
- Player-side "autoplay" in the sim harness reuses the hostile AI's
  reflexive/pack/emergent logic — it's deliberately not smart, so every
  sim run currently ends in a loss. That's the autoplay being dumb, not
  the engine being broken; a human (or a better bot) should do
  meaningfully better, per Build Brief §4.2's own expectation.

## Design source

The GDD, Data Pack, Build Brief, and Canon Pass live in the Claude project
"The Bloom Wars," not duplicated into this repo (see
`design/README_reserved_term.md` for why). Ask Claude to pull a doc into
`design/` if you want a local copy.
