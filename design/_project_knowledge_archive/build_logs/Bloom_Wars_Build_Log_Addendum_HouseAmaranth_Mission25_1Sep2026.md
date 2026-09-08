# Build Log Addendum — House Amaranth: Mission 25, "Going Dark" (1 Sep 2026)

## What shipped

`survive_n_turns`, `turnLimit: 14`. New map (`map_house_amaranth_going_dark`, 20×11 — deploy dead center, spawn seams on all four sides rather than the usual one or two flanks: the geometry itself is the pitch, no relief column, no safe retreat direction). New `CampaignMission` (`mission_house_amaranth_25`), three staggered waves (turn 1/5/9) rather than one burst, matching "the front holds alone" as sustained attrition.

## Sim-tuning

```
8 Crawlmass + 4+4 Splitfang   (16 total)  → 100%
16 Crawlmass + 8+8 Splitfang  (32 total)  → 60%
24 Crawlmass + 12+12 Splitfang (48 total) → 17%
28 Crawlmass + 12+12 Splitfang (52 total) → 5%, 3%, 5% (three 150-run batches, 19/450 pooled ≈ 4.2%)
```

A smoother, monotonic climb this time (no cliff, no non-monotonic surprise) — likely because `survive_n_turns` gives no single point of failure the way `extract_unit`/`protect_asset` do, so more enemies translates more directly into more pressure rather than flipping a chokepoint. Shipped at 52 total across three waves.

## Verification

```
npm run typecheck    → clean
npm run lint          → clean (scratch generated-map file deleted first)
npm test -- --run     → 58 files, 1192/1192 passing, zero regressions
```

## What's still not built

Act III, Missions 26-36. Mission 26 is next — "The Bramble," which needs a real new archetype and a `combat_sim.py` pass before it counts, not just a mission build. Hub wiring pass. Missions 1-11 enemy-variety reform. Maxime's own n=500 retune pass.
