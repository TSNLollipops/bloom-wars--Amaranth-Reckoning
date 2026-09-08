# Build Log Addendum — House Amaranth: Mission 26, "The Bramble" (1 Sep 2026)

## The Bramble — new archetype, validated before it counted

Plan doc §4/§10 already resolved the lineage call: Splitfang-descended (checked against real code — Splitfang is `movementType: "swarm"`, `moveRange: 5`, `swarmSize: [3,5]`, the actual mechanical shape "fast, aggressive, spreading uncontrolled" describes; Gallcyst's sessile-turret shape doesn't fit regardless of narrative feel). Added a new `design/combat_sim.py` section ("13. THE BRAMBLE") before touching `data/bloom.ts`, per this project's own house rule that a new archetype only counts once combat_sim.py has run on it.

Escalated from Splitfang the same ~40% way this project already escalates a "scarier version of X" (Choir over Sirenmaw, the Unnamed over Heartwood's own endurance):

```
Splitfang (parent):  END 70 / VIT 70, moveRange 5, attackPower 38, swarmSize [3,5]
The Bramble:          END 98 / VIT 80, moveRange 6, attackPower 54, swarmSize [4,6]
```

VIT nudged only +14% (deliberately smaller than the +40% END jump) — same reasoning as the Wellroot's own VIT 60→70 nudge: stays Collapse-then-vitality-chip vulnerable rather than getting uniformly tankier, so Severance-style play still matters against it. `combat_sim.py`'s own escalation gate confirms it: 5 hits to kill vs. Splitfang's 4, at the project's standard 45-damage test attack. Reconstruction check passed clean (no FAIL lines) before trusting the new section.

## Mission

`eliminate_all`, `turnLimit: 16` (display-only, house rule #5). New map (`map_house_amaranth_the_bramble`, 22×11) — bloom_mat patches scattered across the WHOLE field rather than one clump, "spreading uncontrolled" as literal map geometry rather than just flavor text (same discipline Mission 25's spawn-from-all-sides used for "holds alone"). New `CampaignMission` (`mission_house_amaranth_26`).

## Sim-tuning

```
10 Bramble  → 77%
16 Bramble  → 3%
13 Bramble  → 7%, 8%, 5% (100/150/150 runs, 27/400 pooled ≈ 6.75%)
```

Another sharp cliff between 12 (53%) and 13 (7-8%) — consistent with this campaign's established non-monotonic pattern, this time on a brand-new archetype's very first outing rather than a familiar one. Shipped at 13.

## Verification

```
npm run typecheck    → clean
npm run lint          → clean (scratch generated-map file deleted first)
npm test -- --run     → 58 files, 1192/1192 passing, zero regressions
```

## What's still not built

Act III, Missions 27-36. The Bramble reappears at Missions 27, 30, 32, 33, 35 per the plan's own table — worth checking each of those stays consistent with these shipped stats rather than drifting mission to mission. Hub wiring pass. Missions 1-11 enemy-variety reform. Maxime's own n=500 retune pass.
