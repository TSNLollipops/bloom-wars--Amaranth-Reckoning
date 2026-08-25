# House Rules (#1–#7)

The repo's own `README.md` carries the canonical numbered writeup; this file is the cross-reference for which mission/system each one touches.

1-4. Original vertical-slice rules (Meeps dodge chance, class-triangle bonuses, etc.) — predate the Amaranth campaign, still in force.
5. **`eliminate_all` has no turn-limit fail condition.** Maxime, 22 Aug: "remove the clock on missions, give player more freedom, xcom doesn't have clocks all the time." Scoped to `eliminate_all` only — `hold_zone`/`extract_unit`/`survive_n_turns` all keep real deadlines because the objective *is* the deadline. `objectiveParams.turnLimit` stays as a bonus-scoring target, not a fail line. Extended automatically to `clear_bloom` (Mission 3) and `protect_asset` (Mission 22) for the same reason.
6. (Tank-dodge tuning — see repo README for exact numbers; landed same day as the tierPipCount bug fix, Act I Mission 4 addendum.)
7. **`tickBloomRegrowth`** — Mission 3's (`clear_bloom`) countervailing pressure. Deterministic, not a roll: fires turn 4 and every 3 turns after, converts up to 2 clean tiles adjacent to existing `bloom_mat` back to `bloom_mat`, fixed scan order (pins exact tiles for regression testing). Exists so house rule #5's "no clock" doesn't turn Clear Bloom into a free win.

See `act1/mission01_muster.md` and `act1/mission03_the_low_ground.md` for the missions that actually drove #5 and #7.
