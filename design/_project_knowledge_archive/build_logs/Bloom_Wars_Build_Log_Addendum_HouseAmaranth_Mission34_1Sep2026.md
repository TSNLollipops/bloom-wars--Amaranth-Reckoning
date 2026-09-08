# Build Log Addendum — House Amaranth: Mission 34, "No Word From the Seal" (1 Sep 2026)

## What shipped

`survive_n_turns`, `turnLimit: 16`. New map (`map_house_amaranth_no_word_from_the_seal`, 24×13), new `CampaignMission` (`mission_house_amaranth_34`). This campaign's second `survive_n_turns` mission — Mission 25 ("Going Dark") was the first.

## Map: Mission 25's idea, taken one step further

Deploy dead center, no relief column, no safe direction — same discipline Mission 25 established, escalated to eight spawn points (north, south, east, west, and all four corners) instead of Mission 25's four. "Darkest hour" reads as literal geometry: there's no direction left that isn't a threat.

## Sim-tuning: confirms the Mission 25 finding — this objective type tunes smoothly

```
16 total Bramble (2/wave x4 turn 1, 4 turn 5, 4 turn 9)   → 87%
24 total Bramble (3/wave x4 turn 1, 6 turn 5, 6 turn 9)   → 29%
30 total Bramble (4/wave x4 turn 1, 7 turn 5, 7 turn 9)   → 7/100 (7%)
30 total, re-confirmed                                     → 14/150 (9%); 21/250 pooled ≈ 8.4%
```

A clean, gradual descent (87% → 29% → 8%) across three tested totals — no knife-edge cliff between adjacent counts the way `eliminate_all` and `hold_zone` have repeatedly produced this act (Missions 22, 26, 27, 29, 30). Mission 25's own build note called this out as a pattern worth remembering, and it held again here: `survive_n_turns` has the simplest win condition (just outlast the clock), so there's no zero-tolerance failure state for a single bad turn to trip. Shipped at 30 total.

## Verification

```
npm run typecheck    → clean
npm run lint          → clean (scratch generated-map file deleted first)
npm test -- --run     → 58 files, 1192/1192 passing, zero regressions
```

## What's still not built

Act III, Missions 35-36 (the finale). Hub wiring pass. Missions 1-11 enemy-variety reform. Maxime's own n=500 retune pass.
