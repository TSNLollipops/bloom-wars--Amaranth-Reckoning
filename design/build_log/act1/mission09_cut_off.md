# Mission 9 — Cut Off

**Objective:** survive_n_turns (10) — the objective type's debut, built specifically for this mission. **Map:** encircled outpost, sump-sealed south, 22×14. **Enemy:** 10 Crawlmass + 2 fixed Gallcyst. **Bonus:** rescue_pilot (a Downed Signals Officer — fits "comms sabotage strands the lance").

Deliberately the smallest possible engine addition: reuses `objectiveParams.turnLimit` directly as the survive-until count, same pattern `hold_zone`'s own `holdUntilTurn` default already established. `checkWinLoss` gets exactly one new branch (reach the turn count, win) — squad wipe is already checked unconditionally above every objective branch, so no separate loss condition was needed. `Battle.ts`'s HUD needed zero changes (its objective line was already generic).

The Player AI engine needed no new branch for this objective either — with nothing to hold/extract/clear, a unit just falls through to ordinary combat/retreat/regroup logic, which is exactly right for "stay alive."

**Result:** 8/8 win, every run, resolving exactly at the turn-10 line — real combat happens every run, this squad handles it comfortably.

Full narrative: archive, "missions 9-12 — Act I finished, a new objective type (Survive N Turns)."
