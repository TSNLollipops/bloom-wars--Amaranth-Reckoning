# Act III — The Last Ring (Missions 25–36)

Built in three batches (25-28, then a same-day Third Lance/roster-scale follow-up, 29-32 plus a same-day AI-bug follow-up, 33-36). Closes the 36-mission campaign. Scope was briefly uncertain mid-build (batch 5's own addendum flagged not knowing whether Act III ran 4 or 12 missions) — Maxime confirmed 12, matching Act I/II's own scale, same session.

## Roster — the Third Lance integrates, and a doc correction

`THIRD_LANCE_PILOTS`/`THIRD_LANCE_MEKS` (Kova, Ness, Onwuka, Delgado, Yeun) merge in on Mission 24's win via `integrateThirdLance()`, completing the 4-path × 3-chassis archetype grid. `ACT3_DEPLOY_CAP = 12`. `ACT3_DEFAULT_SQUAD` fields 12 of the now-15 available pilots (benches Tarrant, Reyes, Ness). The Independent Campaign doc's own §6/§9/§10 had this wrong (said ~20 pilots/4 lances) — corrected in-doc to the real plan: 1 lance in Act I, 2 in Act II, 3 in Act III, tied to Rourke's rank progression. Missions 25/26/28 needed real retuning once the squad grew from 8 to 12 — see those mission files.

## Systems introduced this act

The Cradle (`bloom_cradle`) — the campaign's true final boss, largest Endurance in the game (560), debuts Mission 35. The multi-civilian escort/extraction system (Mission 31). The `protect_asset` defendZone-fallback AI fix (surfaced by Mission 32, also retroactively fixed Mission 22 — see `engine_systems/ability_depth_and_targeting_ai.md`). Walking animation (tween-based movement + input lock during a move) — a side pass, not mission-specific, but landed during this act's build window.

## Mission table

| # | Name | Objective | Enemy | Final sim result |
| --- | --- | --- | --- | --- |
| 25 | The Reckoning | eliminate_all | wide 5-spawn wave, Meridian's Oath debuts | 100% at 12-pilot squad (23 hostiles) |
| 26 | The Cradle Beneath | extract_unit (Okafor) | Undertow ambush | 12/15 (~80%) at 8-pilot squad (12-pilot jams) |
| 27 | Falling Back to Meridian | hold_zone | 3 trench-line waves | 15/15 after spawn-vision fix |
| 28 | Marrow's Reckoning | eliminate_all | Marrow's rival arc closes | 14/15 (~93%); 3rd wave added for 12-pilot squad |
| 29 | The Outer Ring Falls | hold_zone | 5-wave siege | 20/20 (100%), real attrition |
| 30 | Ashes of the Second Ring | eliminate_all | city fighting, 2 fixed Gallcyst | 26/30 (~87%) |
| 31 | The Last Convoy | extract_unit + multi-civilian | staggered ambush waves | 13/20 (65%) |
| 32 | Hold at the Spire | protect_asset (2nd debut) | major AI freeze bug found+fixed | 20/40 (50%) post-fix |
| 33 | The Innermost Ring | hold_zone | 5-wave siege | 16/20 (80%) |
| 34 | No Word from the Fleet | survive_n_turns | knife-edge tuning | 12/20 (60%) |
| 35 | The Last Ring | hold_zone | The Cradle debuts [hardest fight] | 11/20 (55%) |
| 36 | Until Relief | survive_n_turns [finale] | knife-edge tuning | 16/20 (80%) |

**The campaign is complete.** All 36 missions built, sim-tuned, tested, delivered as of Batch 7 (25 Aug 2026). Full per-mission detail: `mission25_the_reckoning.md` through `mission36_until_relief.md`.
