# Build Log Addendum — House Amaranth: Mission 31, "What the Program Costs" (1 Sep 2026)

## What shipped

`extract_unit`, `turnLimit: 18`, `extractThreshold: 3` (of 6 civilians). New map (`map_house_amaranth_what_the_program_costs`, 26×11), new `CampaignMission` (`mission_house_amaranth_31`). Six `civilianSpawns` (ward-crop technicians), Bramble as the pursuing threat, one ambush spawn seam placed inside the evac corridor itself.

## Applying the Mission 27 lesson proactively instead of rediscovering it

Mission 27 found — the hard way, mid-tuning — that leaving `extractThreshold` unset for a multi-civilian extraction is nearly an instant-loss trap: the moment any one civilian dies, the remaining count falls below the still-required total and the mission fails outright. This mission is plan-doc-tagged "scripted partial loss, mirrors Warden's Mission 31" — the loss isn't a tuning accident to correct for, it's the point of the mission ("not everyone gets out"). So `extractThreshold` was set to 3 of 6 (half) from the very first draft, rather than starting unset and walking the same discovery process again.

## Map: Mission 27's shape, a worse breach

Reused Mission 27's proven deploy-west/exit-east evac-corridor shape, widened 24×11 → 26×11, with bloom_mat scattered across more of the field than Mission 27's single clean patch (a worse containment failure, not the same crisis replayed). One spawn seam sits inside the corridor itself rather than only at the map's north/south edges — the "staggered ambush" beat Warden's own Mission 31 build log names directly: the Bramble is already inside the evacuation route by the time the convoy starts moving, not purely chasing it from outside.

## Sim-tuning: landed in range on the first real try

```
3/3 Bramble turn 1 (north/south seams) + 2 Bramble turn 3 (inside-corridor
  ambush seam), extractThreshold 3/6                          → 8/100 (8%)
same composition, re-confirmed                                → 11/150 (7%); 19/250 pooled ≈ 7.6%
```

Shipped without further adjustment — the first composition tried landed inside the established band, plausibly because starting from the Mission 27 lesson already applied (rather than starting unset and discovering the trap again) put the starting point much closer to correct than usual for this act.

Worth noting the failure-mode split, since it's the right one for this objective type: outcomes are LOSS-dominated (92-139 out of every batch), not `COMMANDER_DOWN` — the squad itself usually survives the fight; the evacuation quota is what fails. Matches the pitch ("not everyone gets out," not "the squad gets wiped out").

## Verification

```
npm run typecheck    → clean
npm run lint          → clean (scratch generated-map file deleted first)
npm test -- --run     → 58 files, 1192/1192 passing, zero regressions
```

## What's still not built

Act III, Missions 32-36. Hub wiring pass. Missions 1-11 enemy-variety reform. Maxime's own n=500 retune pass.
