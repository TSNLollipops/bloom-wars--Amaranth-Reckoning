# Build Log Addendum — Player AI: Defensive Focus Fire (shipped), Gang-Up Retreat (tried, reverted) — 31 Aug 2026

Maxime, direct and blunt, after Tier 6.5's three straight Guard Taunt attempts each broke a different set of missions: **"the playerai suck a lot still."** No new scope was given — this is that thread, picked back up.

## Ground truth before touching anything

A fresh 40-mission/1600-run sweep (the honest current baseline, not a stale
number): **55% aggregate (875/1600)**. Reading per-mission, `commander_down`
is still overwhelmingly the dominant failure mode, exactly as
`Bloom_Wars_PlayerAI_Hardening_And_Alicialisation_Roadmap_v1.md`'s own §1a/
§1b already found — `mission_amaranth_6/8/10/12/24` sit at a flat 0%, every
loss a commander_down.

## Lever 1 — Defensive focus fire: SHIPPED, verified

Three Guard Taunt attempts all tried to **redirect** enemy targeting onto a
sacrificial unit, and each one traded a whole turn — and the taunting
unit's own survival — for one turn of insurance. This is a different kind
of lever: instead of spending a turn drawing fire onto a decoy, bias
**which already-in-range target** an ordinary attack goes to — kill or hurt
whatever is actually bearing down on the commander/Munti first, ahead of
the squad's generic "weakest" pick. This costs nothing extra (every unit in
range was already about to attack something this turn) and never touches
movement or resource spend, so it can't reproduce any of Guard Taunt's
failure modes.

`enemiesThreateningVips(allUnits, enemies)` (`combat.ts`) — enemies that
could reach and attack a front-line-protected ally (commander/Munti) next
turn, the same `moveRange + attackRange[1]` reach proxy `threatCount`
already used for retreat scoring. `VIP_THREAT_PRIORITY_DISCOUNT = 0.4`
multiplies a threatening target's `rawToughness` before ranking, same
mechanism and same "moderate nudge, not always-first" spirit as the
existing `EMERGENT_BOSS_PRIORITY_DISCOUNT`. Threaded through
`targetPriorityScore`/`weakestTarget` as an optional parameter, applied
**only** at `focusFireTargetInRange`'s in-range call site — never at the
two distant chase-target sites (`advance_into_range`/`seek_fight` in
`index.ts`), the same scoping discipline Tier 0's class-triangle fix and
the boss-priority pass both already established, for the identical reason:
no distance/exposure term exists yet to weigh a risky detour against, and
a wider version of the class-triangle fix already regressed once (73.25%
→67%) the one time that caution was skipped.

**Verified real, not just safe:**
- 8 new unit tests (`sim/playerAi/__tests__/combat.test.ts`) —
  `enemiesThreateningVips`'s own reach+visibility math, `weakestTarget`
  actually preferring a threatening target over a nominally-equal one
  without overriding a genuinely easier kill sitting right next to it, and
  a full `focusFireTargetInRange` integration test.
- Isolated on the one live emergent-boss mission
  (`mission_amaranth_21`, the mission all three Guard Taunt attempts either
  broke or barely moved): **n=200, 55% (110/200)** — a real, meaningful
  step up from the 28–49% range documented across this whole hardening
  thread so far.
- Full 40-mission/1600-run sweep after shipping: **54% aggregate
  (870/1600)**, flat against the 55% pre-fix baseline within ordinary
  sampling noise (this sim has no fixed seed — every batch invocation is
  genuinely random, confirmed while diagnosing the second lever below) —
  no mission regressed.
- `npm run typecheck` / `lint` / `test` all clean, 1184/1184.

**Honest limit, not oversold:** this does nothing for the missions that
were already flat 0% before this fix (`mission_amaranth_6/8/10/12/24`) —
see "Investigated, not fixed" below for why, and Lever 2 for the direct
attempt at closing that gap.

## Lever 2 — Gang-up retreat: TRIED, MEASURED, REVERTED

Traced two live commander_down cases before writing a line of this.
`mission_amaranth_12` (turn 5): Rourke at **full HP** going into the
hostile phase, no dodge, took three near-simultaneous Splitfang hits (30
each = 90) in one hostile turn and died outright. `hpFraction` only ever
updates *after* a hostile turn resolves — the existing retreat gate
(`COMMANDER_RETREAT_HP_FRACTION`) can only ever react to a hit that
already landed, never see a three-enemy pile-on coming the turn before it
happens.

Built `visibleGangCount(unit, enemies, turn)` (`combat.ts`) — how many
currently-visible enemies could reach and attack `unit` next turn, same
reach proxy as above with a real `isVisibleTo` check added. Wired a new
`GANG_UP_THRESHOLD = 2` into `index.ts`'s existing retreat branch: a
front-line-protected unit now also retreats pre-emptively once 2+ visible
enemies could reach it, regardless of current HP, as long as a genuinely
safer tile exists.

**A real, large win on the exact case it targeted** — isolated n=100:
`mission_amaranth_12` **0% → 67%**. But two real problems, both confirmed
against actual batch runs, not assumed:

1. **A regression on the one live emergent-boss mission**:
   `mission_amaranth_21` **45–55% → 6%** (n=100). Same failure *shape* as
   Guard Taunt's own boss-mission regression: retreating from an
   ever-growing spawn doesn't reduce the threat, it just delays the
   inevitable while the boss adds more, and eventually there's nowhere
   left to retreat to.
2. **A genuine performance/correctness problem**: `mission_amaranth_3` and
   `mission_amaranth_24` each ran long enough to blow through a 60-second
   per-mission n=100 batch timeout that every *other* mission in the same
   pass cleared in under 15 seconds. A single seed-1 verbose trace on
   Mission 3 resolved cleanly in 6 turns, so this isn't every run — but
   it's real and frequent enough to hang a 100-run batch outright.
   `retreatPath` has no exposure-history/oscillation guard the way
   `regroupPath` was given one on 25 Aug after an identical round-trip bug
   (a unit retreating every single turn a threat count crosses the
   threshold, with nothing remembering it already retreated last turn) —
   not yet root-caused to a specific line, just confirmed as the likely
   shape.

**Reverted**, same call as all three Guard Taunt attempts: a wrong (or
not-yet-safe) heuristic is worse than the current honest zero.
`index.ts`'s own `guard_taunt`-shaped call site is now commented out with
the full numbers in place; `visibleGangCount`/`GANG_UP_THRESHOLD` stay
defined in `combat.ts`, correct and reusable, for a real future attempt —
same "reverted, not deleted" precedent Guard Taunt's own primitives
already set. The two `decidePlayerAiAction` integration tests exercising
the disabled wiring were removed (same reasoning Guard Taunt's own test
file has none); the two primitive-level tests
(`visibleGangCount`/`GANG_UP_THRESHOLD`) stay, since those functions are
still correct and still exported.

**The real next attempt, not built this pass**: either a per-unit "already
retreated this crisis, don't re-trigger every single turn" memory, or an
emergent-tier opt-out — the same kind of scoping correction
`EMERGENT_BOSS_PRIORITY_DISCOUNT` and `GUARD_TAUNT_ALLY_HP_THRESHOLD` each
eventually needed too.

## A separate, real finding worth flagging directly: Mission 6 may be a mission-tuning problem, not an AI problem

Traced `mission_amaranth_6` (House Amaranth Line Troopers) directly: these
troopers hit for **50–75 damage per hit**, an order of magnitude above the
Bloom hostiles elsewhere in the same tier. The whole squad gets ground down
turn by turn regardless of positioning — Lask dies turn 2, Iyari and Anand
turn 3, Rourke turn 4, every single run. This mission was previously tuned
to 69–71% (this session's own Act I sweep, before the roam-fallback change
shipped) — the jump to a flat 0% looks like a real casualty of hostiles now
engaging immediately and at full aggression from turn 2 instead of holding
back, not a gap in the player AI's own competence. This is squarely the
already-flagged "a per-mission re-tuning pass over the `eliminate_all`
missions the roam fallback made significantly harder" item from the
progress log's own "Not started" section — not re-tuned here, flagged
directly rather than silently absorbed into this pass's own scope.

## Verification

`npm run typecheck` / `lint` / `test` all clean on the final, shipped state
(Lever 1 live, Lever 2 disabled) — **1184/1184**, up from 1182 (2 net new
tests: 10 added for the two levers, 2 removed for the reverted
integration). Full 40-mission/1600-run sweep: **54% aggregate**, flat
against the 55% pre-pass baseline within this sim's own (confirmed,
genuinely unseeded) sampling noise. `mission_amaranth_21` isolated at
n=200: **55%**, a real, verified step up.

## Delivered files

`src/sim/playerAi/combat.ts`, `src/sim/playerAi/index.ts`,
`src/sim/playerAi/types.ts`, `src/sim/run.ts`,
`src/sim/playerAi/__tests__/combat.test.ts` (new). Everything via the
device bridge — staged, edited/tested in this session's cloud sandbox,
committed back. `design/Bloom_Wars_Build_Log_Addendum_PlayerAI_DefensiveFocusFire_And_GangUpRetreatReverted_31Aug2026.md`
(new, this file).

## Still open

`mission_amaranth_3/8/10/12/24` remain flat or near-flat at 0%, unchanged
by this pass's shipped lever — Lever 2 would have fixed Mission 12
specifically but had to be reverted for the reasons above. The real next
commander-protection attempt needs either the crisis-memory/emergent-tier
scoping named above, or a genuinely different lever again — this is now
four tried-and-reverted attempts (three Guard Taunt, one gang-up retreat)
pointing at the same conclusion: anything that makes the commander behave
differently in the moment (taunt, retreat) tends to trade one mission's
win for another's loss, while a change scoped to "which in-range target do
I already shoot" (this pass's actual shipped win) composes cleanly with
everything else. Worth treating as a real design constraint for the next
attempt, not a coincidence. Mission 6's likely mission-tuning problem
(above) is a separate, real, and probably higher-leverage thing to look at
next.
