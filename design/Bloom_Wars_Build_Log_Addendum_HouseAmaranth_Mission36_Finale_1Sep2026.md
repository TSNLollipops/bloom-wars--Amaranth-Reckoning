# Build Log Addendum — House Amaranth: Mission 36, "The Stalling Season Ends" (1 Sep 2026)

## Campaign complete — all 36 House Amaranth missions built

This is the last mission. `survive_n_turns`, `turnLimit: 18`, campaign finale — same objective shape Warden's own finale uses. New map (`map_house_amaranth_the_stalling_season_ends`, 26×13, this campaign's largest), new `CampaignMission` (`mission_house_amaranth_36`).

## What shipped

Deploy dead center with no relief column and no safe direction — the same discipline Missions 25 and 34 already proved out for `survive_n_turns`, one more notch bigger (eight spawn points ringing every approach). The Wellroot makes one last appearance alongside Bramble waves — a deliberate closing callback to Mission 23 (where it first appeared) and Mission 35 (its last appearance), not a new threat invented for the finale. `ev_stalling_season_ends_closure` fires on `objective_complete` and carries the plan doc's own epilogue framing directly: "it works here, it won't work galaxy-wide, gets abandoned someday, but not on this campaign's own last page."

## Sim-tuning: the Wellroot pairing lesson from Mission 35 held here too

```
1 Wellroot + 32 Bramble (4/wave x4 turn 1, 6 turn 5, 6 turn 9)  → 0%
1 Wellroot + 16 Bramble (2/wave x4 turn 1, 4 turn 5, 4 turn 9)  → 3%
1 Wellroot + 14 Bramble (2/wave x4 turn 1, 3 turn 5, 3 turn 9)  → 22%
1 Wellroot + 15 Bramble (2/wave x4 turn 1, 4 turn 5, 3 turn 9)  → 20/150 (13%)
same composition, re-confirmed                                    → 11/100 (11%); 31/250 pooled ≈ 12.4%
```

First attempt (32 Bramble, roughly what a naive "biggest map yet, biggest fight yet" instinct would reach for) went straight to 0% — the Wellroot pairing lesson from Mission 35 (it doesn't substitute for headcount, but it does compound WITH whatever headcount is present) meant the honest starting point was much closer to Mission 35's own 20-Bramble composition than to Mission 34's Wellroot-free 30. Landed at 15 Bramble + 1 Wellroot — notably lower than Mission 35's 20, despite this map having eight spawn clusters against Mission 35's three. Worth recording: more approach vectors compounded with the Wellroot's pressure here rather than diluting it the way extra spawn points have sometimes made other missions in this campaign easier, not harder.

## Verification

```
npm run typecheck    → clean
npm run lint          → clean (scratch generated-map file deleted first)
npm test -- --run     → 58 files, 1192/1192 passing, zero regressions
```

## What's left campaign-wide

All 36 House Amaranth missions are now built, mapped, sim-tuned to the ≤15% ceiling, and verified. Still outstanding, per the plan doc's own step list: the Hub v1 build (estate room set, roster seated in it, Talk/ambient-line wiring, Shop/Weapon Branch economy, the seneschal NPC), a full validation pass across all 36 maps plus a `combat_sim.py` pass on the Bramble specifically (already done individually as each mission built, worth one more consolidated run), mission-select/Hub-entry wiring, and Maxime's own n=500 retune pass. Missions 1-11's enemy-variety reform (flagged separately, pre-dating this batch) is also still open. Nothing has been committed to the device this entire batch, per Maxime's own instruction — everything above is local to the sandbox, staged for his review before anything ships.
