# Build Log Addendum — House Amaranth: Mission 33, "The Innermost Terrace" (1 Sep 2026)

## What shipped

`hold_zone`, `turnLimit: 20`, `holdUntilTurn: 16`. New map (`map_house_amaranth_the_innermost_terrace`, 26×13, this act's largest hold_zone map yet), new `CampaignMission` (`mission_house_amaranth_33`). Five `bloom_bramble` waves converging from five separate spawn clusters — "final perimeter around House Amaranth's own seat of power."

## Map: the campaign's own proven shape, reused on purpose again

Warden's own mirrored mission ("The Innermost Ring") build log gives the exact reasoning worth reusing verbatim: on the campaign's last hold_zone missions, reuse the proven shape rather than risk new geometry, and let wave count and staggered approach corridors carry the "innermost ring/terrace" feeling instead of a first-time room layout. Followed that here — this campaign's own central-hold-block-plus-ridge-flank shape (Missions 19/23/29), scaled to five spawn clusters (north, south, east-near-top, east-near-bottom, east-far) instead of four. Bramble-only: Mission 30 already proved the two-threat convergence beat, and Mission 35 is where Bramble and the Wellroot converge next, so this one stays single-threat.

## Sim-tuning: applying a lesson instead of relearning it

Mission 29 found that the gap between the first two waves is a far sharper lever than total headcount — a single extra turn there was worth more than several fewer hostiles overall. Applied that up front here: wave 1 and wave 2 are given a 2-turn gap from the very first draft, rather than the 1-turn gap Mission 29 had to discover the hard way was too tight.

```
4 Bramble/wave x5, turns 1/3/5/7/9   → 15/100 (15%)
same composition, re-confirmed        → 17/150 (11%); 32/250 pooled ≈ 12.8%
```

Landed in range on the first real composition tried — same pattern as Mission 31 (applying an already-learned lesson proactively rather than rediscovering it mid-tuning). Shipped without further adjustment.

## Verification

```
npm run typecheck    → clean
npm run lint          → clean (scratch generated-map file deleted first)
npm test -- --run     → 58 files, 1192/1192 passing, zero regressions
```

## What's still not built

Act III, Missions 34-36 (the finale). Hub wiring pass. Missions 1-11 enemy-variety reform. Maxime's own n=500 retune pass.
