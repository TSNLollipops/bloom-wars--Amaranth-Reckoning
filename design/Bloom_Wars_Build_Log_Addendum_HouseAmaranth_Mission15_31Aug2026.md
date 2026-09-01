# Build Log Addendum — House Amaranth: Mission 15, "Rootbound" (31 Aug 2026)

Maxime: *"u can keep going"* — continuing Act II under the same standing enemy-variety direction.

## What shipped

Mission 15, "Rootbound" — first real sign of what will become the Wellroot: a diversion relay's target zone growing faster than it's told to. `hold_zone`, new map (`map_house_amaranth_rootbound`, 20×14), new `CampaignMission` (`mission_house_amaranth_15`).

**A hold zone with no safe direction, not another chokepoint or gate.** This campaign's fourth `hold_zone` map (after Missions 2, 9, 12), and a different shape again: the hold sits center in open ground, surrounded by four bloom_mat overgrowth clusters at the map's own four corners — the pitch's own "growing faster than it's told to" made literal in terrain rather than only narrated.

**Composition: Sporethrower as the primary threat for the first time.** Every prior use of Sporethrower in this campaign (Missions 6, 7, 11, and paired with Gallcyst in Mission 13) was a 1-2 unit secondary addition, never the main threat carrying a mission on its own. Here, one is pinned inside each corner cluster — four separate ranged sightlines converging on one central hold zone. Nothing chases, but there's no single approach or holding position that's actually out of every line of fire. Crawlmass stays filler.

## Sim-tested — landed on the first pass, another new failure texture

```
npx tsx src/sim/runBatch.ts 150 mission_house_amaranth_15 → WIN=112/150 (75%), LOSS=38, COMMANDER_DOWN=0, TIMEOUT=0
npx tsx src/sim/runBatch.ts 150 mission_house_amaranth_15 → WIN=114/150 (76%), LOSS=36, COMMANDER_DOWN=0, TIMEOUT=0
```

Two independent batches, stable at 75-76%. **COMMANDER_DOWN=0 again** — the same texture Mission 14 found for `extract_unit`, now showing up for `hold_zone` too: Sporethrower's own no-counterattack rule and short move range keep it from ever mounting a real alpha strike, so nobody dies in this fight. Traced a losing run directly rather than assumed from the aggregate: `"Loss: hostiles hold the zone"` fires right at turn 6 (`holdUntilTurn`) — a Crawlmass or Sporethrower sitting on a hold tile at that exact moment while the squad's still finishing off a straggler elsewhere. Exactly the map's own "no direction is actually safe" premise playing out mechanically, not a degenerate failure mode. Comfortably clear of the 30% floor. Shipped at 4 Sporethrower + 4 Crawlmass.

## Verification

```
npm run typecheck   → clean
npm run lint         → clean (disposable Python-script scratch output deleted first, same non-issue as every prior pass)
npm test -- --run    → 57 files, 1186/1186 passing, zero regressions
```

## What's still not built

Act II, Missions 16-20. Act III, Missions 21-36. The Hub, mission-select wiring. The Missions 1-11 enemy-variety reform plan (`claude/Bloom_Wars_HouseAmaranth_Act1_EnemyVariety_Reform_Plan_v1.md`) is written but not executed, awaiting Maxime's go-ahead on which missions to actually retune.
