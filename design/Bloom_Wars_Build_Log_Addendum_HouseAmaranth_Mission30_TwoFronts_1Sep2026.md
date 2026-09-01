# Build Log Addendum — House Amaranth: Mission 30, "Two Fronts" (1 Sep 2026)

## What shipped

`eliminate_all`, `turnLimit: 16` (display-only, house rule #5). New map (`map_house_amaranth_two_fronts`, 24×11), new `CampaignMission` (`mission_house_amaranth_30`). First mission fielding a Bloom archetype (`bloom_bramble`) and a human-military archetype (`LOYALIST_HOSTILE_MECHS`) on the same map at the same time — the "two-front pressure the act has been building toward," per the plan doc.

## Map: the squad caught literally between two fronts

Deploy sits dead center of a 24×11 field rather than on an edge — the squad isn't approaching a fight, it's standing in the one strip of ground between two of them. Bramble spawn seams and bloom_mat patches on the west edge, `LOYALIST_HOSTILE_MECHS` spawn seams and rubble patches on the east edge. Same discipline this file's own Mission 25/26/29 comments already established: the pitch language ("two fronts") is the literal map geometry, not just flavor text layered on top of a generic field.

## Sim-tuning: a sharp cliff, same shape as Missions 22/26/27/29, this time on a mixed-archetype total

```
13 total (3 Bramble/4 loyalist turn 1, 2 Bramble/4 loyalist turn 5)  → 89%
26 total (6 Bramble/8 loyalist turn 1, 4 Bramble/8 loyalist turn 5)  → 0%
19 total (4 Bramble/6 loyalist turn 1, 3 Bramble/6 loyalist turn 5)  → 1%
14 total (3 Bramble/4 loyalist turn 1, 3 Bramble/4 loyalist turn 5)  → 84%
17 total (4 Bramble/5 loyalist turn 1, 3 Bramble/5 loyalist turn 5)  → 5%  (5/100)
16 total (3 Bramble/5 loyalist turn 1, 3 Bramble/5 loyalist turn 5)  → 3%  (4/150)
17 total, re-confirmed                                                → 4%  (6/150; 11/250 pooled)
```

Same non-monotonic-cliff pattern this campaign keeps finding at almost every new composition (Missions 22, 26, 27, 29 all hit one) — 13 and 14 both sit near 85-90%, 16 and 17 both sit at 3-5%, with nothing usably in between across the totals actually tried. Not chased further given the established pattern; landed on 17 total.

Worth flagging honestly: 17 total's win rate (4-5%) sits below the roughly 7-13% band most of this act's other missions have landed in. Left as-is rather than nudged back up — "the two-front pressure the act has been building toward" reads as a deliberate hardest-fight-yet beat, and the sample isn't a hard wall (4-5% is a real, nonzero, sampled win rate across 250 pooled runs).

## Verification

```
npm run typecheck    → clean
npm run lint          → clean (scratch generated-map file deleted first)
npm test -- --run     → 58 files, 1192/1192 passing, zero regressions
```

## What's still not built

Act III, Missions 31-36. Hub wiring pass. Missions 1-11 enemy-variety reform. Maxime's own n=500 retune pass.
