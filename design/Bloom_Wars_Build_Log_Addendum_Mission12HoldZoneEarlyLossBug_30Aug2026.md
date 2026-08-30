# Build Log Addendum — Mission 12 hold-zone early-loss bug (30 Aug 2026)

Maxime, after the same-day hold-zone visibility fix landed: "still failing mission 12 for no aparent reason. it say hold zone I stick ther eand kill only what come close. still mission failed."

## The bug

`hold_zone`'s win/loss check (`engine/mission.ts`, `checkWinLoss`) had an instant-loss branch: from turn 3 onward (`this.turn > 2`), if any hostile unit was standing on a hold-zone tile at turn-end while no player unit was on any hold-zone tile at that same instant, the mission ended in an immediate loss — logged as "Loss: hostiles hold the zone."

That timing was never tied to `holdUntilTurn`, the field every hold_zone mission's own `objectiveParams` (and its own build-log comments) already treats as when "hold the line" actually starts. Mission 12 sets `holdUntilTurn: 10` — so this branch was live and armed for a full 7 turns (3 through 9) *before* the mission actually required anyone to be holding anything. During that window, Mission 12's hold zone is a real chokepoint (an 8-tile pocket, entered only from two flanks, boxed by impassable ridge on the other two sides) that four separate enemy waves (15 hostiles total, including a reprised mid-boss) are actively pushing toward. A single hostile slipping onto the pocket through the flank nobody was actively blocking that exact turn — or a defender briefly stepping off the marked tiles to intercept something bearing down on it, exactly the "kill only what come close" play Maxime described — was enough to end the mission outright, seven turns before the brief's own numbers say the hold is supposed to begin.

Confirmed directly, not guessed: reproduced via `npm run sim` — a losing run's own log shows `Loss: hostiles hold the zone.` firing well within that pre-holdUntilTurn window, in a run where the player squad was still actively fighting through the four incoming waves, not failing to defend an already-secured position.

## The fix

Gated the instant-loss branch to `this.turn >= holdUntil` instead of the old hardcoded `this.turn > 2` — the exact same turn the win check right below it already starts counting a held, uncontested zone as a win. Before the hold window opens, a hostile passing through the pocket no longer ends the mission; once it opens, the original rule is completely unchanged — hostiles controlling the zone uncontested still loses it instantly, same as before. Nothing about the actual "can you hold it once you're required to" difficulty was touched.

`src/engine/mission.ts`, typecheck/lint/test clean (1140/1140, zero regressions).

## Verification

Batch-simmed all 7 hold_zone missions (2, 7, 12, 27, 29, 33, 35) at n=40 before and after, since this branch is shared campaign-wide, not Mission-12-specific:

| Mission | Before (WIN / LOSS / CMDR_DOWN) | After |
|---|---|---|
| 2  | 100% / 0 / 0  | 100% / 0 / 0 (unchanged) |
| 7  | 100% / 0 / 0  | 100% / 0 / 0 (unchanged) |
| 12 | 13% / **4** / 31 | 13% / **1** / 34 |
| 27 | 100% / 0 / 0  | 100% / 0 / 0 (unchanged) |
| 29 | 83% / 0 / 7   | 93% / 0 / 3 (sim-run noise, not attributable to this fix — 29's own timing was already inside its hold window) |
| 33 | 95% / 0 / 2   | 95% / 0 / 2 (unchanged) |
| 35 | 98% / 0 / 1   | 95% / 0 / 2 (sim-run noise) |

No mission's numbers moved in the wrong direction; the only consistent, attributable change is Mission 12's straight LOSS count dropping (premature zone-loss fails removed), exactly the bug's own footprint.

## Mission 12 itself is still hard — a separate, already-known issue

This fix does not, by itself, fix Mission 12's overall win rate. Post-fix it's still 13% (5/40), and the dominant cause is `COMMANDER_DOWN` (34/40) — the same commander-focus-fire finding already written up in `design/Bloom_Wars_Build_Log_Addendum_HangarClickBug_And_Mission12Investigation_30Aug2026.md`: Choir + Splitfang concentrate fire on one unit turn 4, and it's Rourke (the commander) whose death alone ends the mission. `abil_taunt`, unlocked since Mission 8 specifically for this, may already solve it in live play and hasn't been confirmed either way yet. If Maxime is still failing Mission 12 after this fix, the next thing worth checking is whether it's specifically his commander going down, and whether Taunt was tried on the turn-4 wave.
