# Build Log Addendum — House Amaranth: Mission 32, "Hold the Root" (1 Sep 2026)

## What shipped

`protect_asset`, `turnLimit: 16`, `assetMaxHp: 400`, `assetName: "the Root"`. New map (`map_house_amaranth_hold_the_root`, 24×13), new `CampaignMission` (`mission_house_amaranth_32`). This campaign's second `protect_asset` mission — Mission 22 was the first, a secondary relay under loyalist audit; this one is the original diversion relay the whole program was built around.

## The assetMaxHp override the plan doc anticipated

`objectiveParams.assetMaxHp` (`data/types.ts`) has been overridable since Mission 22 shipped, and the plan doc's own comment on that field flagged Mission 32 specifically as likely wanting "a different ship-toughness feel than 22." Used that override for real here: 400 HP instead of the default 300 (`PROTECT_ASSET_DEFAULT_MAX_HP`, `data/combatTables.ts`) — this relay is the one the whole program depends on, not a structure under inspection. `assetName` set to "the Root," matching the mission's own title rather than reusing Mission 22's "relay."

## Map: open ground, already half-overrun

Deliberately a different feel from Mission 22's walled-blockhouse/flooded-causeway geometry. This relay sits in open scrub, bloom_mat scattered on every side of the dock rather than behind sump/wall chokepoints, spawn seams on three of four sides (deploy holds the west) — "worst push" as literal geometry, same discipline this file's other Act III missions already established.

## Sim-tuning: the higher assetMaxHp genuinely changed what "hard" means here

```
11 total Bramble (4/4 turn 1, 3 turn 5)   → 67%
17 total Bramble (6/6 turn 1, 5 turn 5)   → 8/100 (8%)
17 total, re-confirmed                     → 9/150 (6%); 17/250 pooled ≈ 6.8%
```

Needed a noticeably bigger headcount to reach the ceiling than a straight per-Bramble comparison to Mission 26 (13 Bramble alone, ~7%) or Mission 30 (17 mixed, ~4%) would suggest — the extra 100 assetMaxHp is real headroom, not just a number. Worth noting the failure-mode split, consistent with Missions 27/31's own finding that the dominant failure mode reveals what a mission is actually testing: `COMMANDER_DOWN` dominates here (92-140 out of every batch), not a slow assetHp bleed-out. The squad gets overrun defending the dock well before the Root itself would run out of HP from ticks alone — the higher `assetMaxHp` is doing its intended job (this relay doesn't die to attrition the way Mission 22's could), and the mission's real difficulty is holding position against Bramble numbers, not managing a ticking asset clock.

Shipped at 17 total.

## Verification

```
npm run typecheck    → clean
npm run lint          → clean (scratch generated-map file deleted first)
npm test -- --run     → 58 files, 1192/1192 passing, zero regressions
```

## What's still not built

Act III, Missions 33-36. Hub wiring pass. Missions 1-11 enemy-variety reform. Maxime's own n=500 retune pass.
