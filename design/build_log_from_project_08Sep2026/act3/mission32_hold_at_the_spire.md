# Mission 32 — Hold at the Spire

**Objective:** protect_asset (second mission to use the type, after Ash on the Water). **Map:** split into two flank deploy blocks (mirrors Mission 22's own "two causeways" tension), center north dock edge left open by default.

**The real bug this mission surfaced, affecting the whole engine, not just here.** First draft went 20/20 win with the ship never taking a single point of damage across 40 runs. Two numbers-only tuning attempts both failed completely (one dropped win rate to 15% with STILL zero ship damage; one added a dedicated "undefended" spawn lane and still got zero ship-damage ticks). Maxime's own read cut through it: "they arent intelligent, they are just overruning the zone, so if they cant get to the ship, make theyr number go up" — the squad successfully walling the dock was never the bug; a mindless swarm has no reason to route around a line it can't see past.

**Actual root cause, found by grepping a full log for any unit from the "undefended" wave ever taking a step:** zero hits, any turn, any run. `reflexiveDecision`'s "nothing visible, hold position" rule — correct everywhere else — meant a Bloom that never got within vision range of a player unit just froze at spawn forever. No amount of "more of them" fixes a unit that never moves.

**The real fix** (asked and confirmed with Maxime as a real design decision, since it's a shared engine change): `reflexiveDecision` and `packDecision` both now fall back to walking toward the nearest `defendZone` tile when nothing's visible, on maps that have one only. See `engine_systems/ability_depth_and_targeting_ai.md`.

**Retuned after the fix** — this mission's own pressure curve changed completely (a Bloom that kills its target now re-engages instead of going idle). Landed on 11/5/4/6/3, removing the now-unneeded dedicated undefended-lane wave entirely.

**Result:** 20/40 (50%), real ship damage in ~27% of runs (up from ~5% pre-fix), including 2 outright ship-destroyed losses in that sample.

Full narrative: archive, "batch 6, 25 Aug 2026: missions 29-32" (original, superseded numbers) and "Batch 6 follow-up... the real Mission 32 fix" (the actual fix and final numbers).
