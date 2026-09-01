# Build Log Addendum — House Amaranth: Mission 28, "Marrow's Choice" (1 Sep 2026)

## What shipped

`eliminate_all`, `turnLimit: 15` (display-only, house rule #5). New map (`map_house_amaranth_marrows_choice`, 26×12), new `CampaignMission` (`mission_house_amaranth_28`). Rematch against `hostile_mech_rourke` + `WARDEN_HOSTILE_MECHS`, the exact antagonists from Mission 20 ("Marrow's Line") — the other half of the mirror Warden's own Mission 28 ("Marrow's Reckoning," `campaignAmaranth.ts`) closes against `hostile_mech_marrow`.

## Map: a bigger dueling ground, deliberately missing one thing

Same core shape as Mission 20 (rubble/ridge alcove clusters flanking a central corridor, deploy block on the west edge, no Bloom on the map on purpose — a pure House-Amaranth-vs-Warden-Company engagement), widened 24×12 → 26×12, with two added far-east corner spawn seams for a later reinforcement wave. The one deliberate omission: no exit tiles anywhere. Mission 20 had a two-wide exit column (a real retreat option, matching that mission's extract_unit objective). Removing it here is the map itself stating the beat — "the last moment either of them could still have walked away clean" closes with this mission, replaced by a committed `eliminate_all`.

## Sim-tuning: the steepest correction yet, and a real lesson about wave-splitting

First attempt reused Mission 20's exact 10-hostile composition (2 Rourke + 2 each Warden 01-04) as a single turn-1 burst — 0%, COMMANDER_DOWN 150/150. A verbose run showed why: Rourke alone hit for 88 twice in one turn against an isolated target, and two 9-10-strong clusters landing only 9-11 tiles from deploy converge on the squad by turn 2, before it has any real chance to spread out or regroup. Mission 20 could get away with spawns that close because it was extract_unit — the squad's actual job there was to run, not stand and fight.

Walked it back from zero rather than guessing at a mid-point:

```
1 Rourke alone                                              → 100%
1 Rourke + 1 each Warden 01-04 (5, single burst)             → 100%
1 Rourke + 2 each Warden 01-04 (9, single burst)             → 10%
```

Then tested whether the same 9-total composition could be wave-split (turn 1 + turn 5) to match Warden's own Mission 28 build-log lesson ("two more troopers held back... rather than everyone landing on turn 1") without changing the win rate:

```
1 Rourke + 1 each Warden 01-04 turn 1 (5), + 1 each
  Warden 01-04 turn 5 (4) — same 9 total, wave-split          → 98%
```

Splitting a fixed total across two waves is not a cosmetic reframing here — it's a much bigger lever than the total count itself, because it lets the squad consolidate and heal in the gap between waves. Real finding, not just a tuning number, worth remembering the next time a "single burst vs. staged waves" choice comes up for a mission that isn't already narratively locked to one shape.

Landed on 1 Rourke + 2 each Warden 01-04 at turn 1 (9, keeping the single-burst weight that actually does the work) plus 1 each Warden 01/03 at turn 5 from the map's new far-corner seams (2 more, 11 total) — the reinforcement wave reads as Warden Company closing the door on any opening the squad found, without being what decides the fight:

```
1 Rourke + 2 each Warden 01-04 turn 1 (9), + 1 each
  Warden 01/03 turn 5 (2) — 11 total                          → 10/100, 17/200, 27/300 pooled ≈ 9%
```

Shipped at that composition.

## Verification

```
npm run typecheck    → clean
npm run lint          → clean (scratch generated-map file deleted first)
npm test -- --run     → 58 files, 1192/1192 passing, zero regressions
```

## What's still not built

Act III, Missions 29-36. Hub wiring pass. Missions 1-11 enemy-variety reform. Maxime's own n=500 retune pass.
