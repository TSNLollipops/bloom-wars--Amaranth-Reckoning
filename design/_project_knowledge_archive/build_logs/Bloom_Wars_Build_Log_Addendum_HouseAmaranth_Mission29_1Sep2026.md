# Build Log Addendum — House Amaranth: Mission 29, "The Governor's Answer" (1 Sep 2026)

## What shipped

`hold_zone`, `turnLimit: 16`, `holdUntilTurn: 12`. New map (`map_house_amaranth_the_governors_answer`, 24×11), new `CampaignMission` (`mission_house_amaranth_29`). First mission fielding `LOYALIST_HOSTILE_MECHS` as the actual hold_zone threat rather than the extract_unit escort role they debuted in at Mission 24 — a real siege, five waves converging from four separate map directions.

## The "scripted strategic cost" tag, resolved the same way Warden's own Mission 29 resolved it

Plan doc pitch: "sector command's seizure force actually lands; House Amaranth loses a whole outer terrace holding them off." Warden's own Mission 29 ("The Outer Ring Falls") build log already answered the obvious question about a tag like this — not a new forced-loss mechanic, a real winnable-and-losable `hold_zone` whose narrative cost lands as a dialogue beat regardless of the tactical result. Reused that exact technique here: `ev_governors_answer_closure` fires on `objective_complete` (same trigger type Mission 28's own closure event used) and states plainly that the terrace is lost in-fiction even though the player just won the fight — "ground's ours for now, won't be by morning."

## Map: a proven shape, reused on purpose

Reused Mission 23's own central-hold-block-plus-ridge-flank geometry rather than risking new geometry on a mission that's explicitly about a defense being overrun — Warden's own Mission 33 build log states this exact reasoning out loud ("same proven shape... rather than risking a first-time... room"), so it's an established practice in this codebase, not a shortcut. Widened 22×11 → 24×11 with two new east-edge spawn seams alongside the original west/north/south ones — a siege converging from four directions instead of two, "seizure force actually lands" as literal map geometry.

## Sim-tuning: wave spacing, not headcount, was the real lever

```
4/wave x5, turns 1/3/5/7/9  (20 total, spread)   → 74%
5/wave x5, turns 1/3/5/7/9  (25 total, spread)   → 0%
4/wave x5, turns 1/3/5/7/9  (20 total, spread)   → 45% (re-tested at the midpoint)
4/wave x5, turns 1/2/3/4/5  (20 total, tight)    → 3%  (same 20 total, just compressed from a
                                                          9-turn spread to a 5-turn one)
4/4/4/4/4, turns 1/3/4/5/6 (20 total, only the
  wave-1→wave-2 gap widened by one turn)          → 96% (every other wave stayed back-to-back;
                                                          flipping just that first gap flipped
                                                          the whole outcome)
4/4/4/3/3, turns 1/2/3/4/5  (18 total, tight)     → 10% (15/150, re-confirmed 15/150 — stable)
```

The real finding: the gap between the FIRST two waves is a far sharper lever than total headcount or how the rest of the waves are spaced. A single extra turn of breathing room between wave 1 and wave 2 was worth more than 5 fewer hostiles overall. Worth remembering for Mission 30 ("Two Fronts") and Mission 33 (another multi-wave hold_zone) — check the wave-1→wave-2 gap first before reaching for headcount changes if either of those needs correcting.

Shipped at 4/4/4/3/3 across turns 1/2/3/4/5 (18 total).

## Verification

```
npm run typecheck    → clean
npm run lint          → clean (scratch generated-map file deleted first)
npm test -- --run     → 58 files, 1192/1192 passing, zero regressions
```

## What's still not built

Act III, Missions 30-36. Hub wiring pass. Missions 1-11 enemy-variety reform. Maxime's own n=500 retune pass.
