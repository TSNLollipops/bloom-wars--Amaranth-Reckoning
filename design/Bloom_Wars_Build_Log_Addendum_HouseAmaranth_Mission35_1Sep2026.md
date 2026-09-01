# Build Log Addendum — House Amaranth: Mission 35, "The Root Turns" (1 Sep 2026)

## What shipped

`hold_zone`, `turnLimit: 20`, `holdUntilTurn: 16`. New map (`map_house_amaranth_the_root_turns`, 24×13), new `CampaignMission` (`mission_house_amaranth_35`). First mission fielding both `bloom_bramble` and `bloom_wellroot` together — "the two threats becoming one."

## "Move together" reads as coordination, not literal movement

The Wellroot is sessile (`data/bloom.ts`: `moveRange: 0`) — Mission 23's own build already established this, and it can't have changed here. So the plan doc's "move together" was read as the Bramble now visibly coordinated by the Wellroot's presence rather than an uncontrolled swarm, not the Wellroot itself moving. Mechanically: the Wellroot anchors the fight from a fixed position, same placement logic Mission 23 introduced (two tiles east of the hold block's own edge, close enough to threaten every hold tile with its acid), while Bramble waves converge around it. Same as Mission 23, `hold_zone` doesn't require killing the Wellroot — it's the fixed presence the squad holds position against, not a target.

## Map: this act's proven hold_zone shape, one more time, at Mission 33's scale

Reused the central-hold-block-plus-ridge-flank shape (Missions 19/23/29/33) at 24×13, matching Mission 33's own scale for what's meant to read as an equally serious fight.

## Sim-tuning: the Wellroot doesn't substitute for headcount

```
1 Wellroot (fixed) + 12 Bramble (4/wave x3, turns 1/3/5)   → 100%
1 Wellroot (fixed) + 20 Bramble (7/7/6, turns 1/3/5)       → 11/100 (11%)
same composition, re-confirmed                              → 16/150 (11%); 27/250 pooled ≈ 10.8%
```

Worth stating plainly: a naive reading of "two threats becoming one" might suggest the Wellroot's own presence (480 endurance, `attackRange: [1,3]`) could stand in for some Bramble headcount. It didn't — 12 Bramble alongside the Wellroot was still a clean 100% win. The Wellroot was never built to carry a fight on its own (Mission 23's own precedent already established this: it's a fixed threat the squad works around, not a combat load-bearer), so this mission still needed the full weight of Mission 33's own 20-Bramble composition on top of it, not a reduced one. Shipped at that composition.

## Verification

```
npm run typecheck    → clean
npm run lint          → clean (scratch generated-map file deleted first)
npm test -- --run     → 58 files, 1192/1192 passing, zero regressions
```

## What's still not built

Act III, Mission 36 (the campaign finale). Hub wiring pass. Missions 1-11 enemy-variety reform. Maxime's own n=500 retune pass.
