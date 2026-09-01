# Build Log Addendum — House Amaranth: Mission 23, "The Root Answers Back" (1 Sep 2026)

## What shipped

`hold_zone`, `turnLimit: 12, holdUntilTurn: 8`. New map (`map_house_amaranth_the_root_answers_back`, 22×11, reuses Mission 19's proven central-hold-block/ridge-flank shape rather than a walled room), new `CampaignMission` (`mission_house_amaranth_23`).

First House Amaranth mission to feature the Wellroot itself (`bloom_wellroot` — the same colossal sessile boss Warden fights outright in their own Mission 21, "Cut the Root"): placed as a fixed hazard at (13,4), two tiles east of the hold block, inside its acid attack range but not required to be killed — `hold_zone`'s own win condition never demanded that, which is the point. "Not an escape, a negotiation" reads as pressure to survive, not a fight to win outright.

Reinforcement archetype: `bloom_choir` (fresh — every other archetype from 17-22 had a recent primary turn), whose `weaponType: "sonic"` doubles as a small thematic fit ("in the only language it has").

## Sim-tuning

```
Wellroot (fixed) + 8 Choir   → 95%
Wellroot (fixed) + 12 Choir  → 10%, 8%, 7% (100/150/150 runs, 32/400 pooled = 8%)
```

Shipped at 12 Choir. Losses are almost entirely `COMMANDER_DOWN` (87-135 of ~150 per batch) rather than a hold-zone failure — consistent with this campaign's own already-tracked, accepted commander-focus-fire pattern (not something this pass fixes; flagging the number, not re-opening the issue).

## Verification

```
npm run typecheck    → clean
npm run lint          → clean (scratch generated-map file deleted first)
npm test -- --run     → 58 files, 1192/1192 passing, zero regressions
```

`npm run build` deferred to the end-of-batch full verification pass rather than run per-mission, to keep pace through the rest of Act III — will run before anything's committed.

## What's still not built

Act III, Missions 24-36. Hub wiring pass. Missions 1-11 enemy-variety reform. Maxime's own n=500 retune pass.
