# Build Log Addendum — House Amaranth: Mission 17, "What Grows Beneath" (31 Aug 2026)

Maxime: *"u can keep going"* — continuing Act II on the 10-pilot squad, right after the Second Lance retune.

## What shipped

Mission 17, "What Grows Beneath" — mirrors Warden's own Mission 17, other side: House Amaranth's own survey team finds what Warden will later call the Wellroot, and reports — against Marrow's instinct — that it's still within tolerance. `extract_unit`, new map (`map_house_amaranth_what_grows_beneath`, 24×11), new `CampaignMission` (`mission_house_amaranth_17`).

**A dig-site trench, not a reuse of Warden's own map shape.** Ridge rims top and bottom with periodic ramp gaps down into the open trench floor, deploy west / exit east across four rows each (a wide multi-lane approach, not a single-file corridor), spawn seams on both ridge shoulders plus one dead-center in the trench floor itself — the thing being surveyed sits directly in the squad's own path out, not off to a side.

**Splitfang as the primary threat for the first time anywhere in Act II.** Every Act II mission so far reached for Gallcyst/Sporethrower (13), Undertow (14, 15), or hostile mechs (16) — Splitfang hadn't appeared at all since Act I. A real fit for the fiction too: a fast, aggressive pack diving down the trench's own ramp gaps at a survey team that's already found something it shouldn't have. Orin extracts for a fifth time (Missions 3, 7, 11, 14), named directly per this campaign's own discipline.

## Sim-tested — the real lever turned out to be the clock, not the enemy count

```
4 Splitfang + 4 Crawlmass, turnLimit 16 → 95% (143/150), LOSS=7, COMMANDER_DOWN=0
6 Splitfang → 95% (barely moved)
8 Splitfang → 100% (a real non-monotonic result — matches Mission 13's own finding, extra bodies die to counter-fire fast enough to be safer, not harder)
6 Splitfang + 8 Crawlmass → 96% (still soft)
```

Backed off the enemy-count lever entirely and trimmed `turnLimit` 16→12 instead, matching this mission's own Warden-side precedent that this shape's difficulty lives in the pacing budget, not raw threat:

```
npx tsx src/sim/runBatch.ts 150 mission_house_amaranth_17 → WIN=113/150 (75%), LOSS=37, COMMANDER_DOWN=0
npx tsx src/sim/runBatch.ts 150 mission_house_amaranth_17 → WIN=109/150 (73%), LOSS=41, COMMANDER_DOWN=0
```

Stable across two independent batches, LOSS-only both times (no commander deaths at all) — a genuinely different failure texture from every other Act II mission this pass has built: time pressure instead of death pressure, the same identity this objective type already earned in its original 5-pilot version. Traced a losing run: Orin caught short of the exit tile when the clock runs out, a clean legible race. Comfortably clear of the 30% floor. Shipped at 6 Splitfang + 8 Crawlmass, `turnLimit: 12`.

## Verification

```
npm run typecheck   → clean
npm run lint         → clean (disposable Python-script scratch output deleted first)
npm test -- --run    → 57 files, 1186/1186 passing, zero regressions
```

## What's still not built

Act II, Missions 18-20 (all deploying `HOUSE_AMARANTH_ACT2_DEFAULT_SQUAD` from the start now, no retune needed later). Act III, Missions 21-36. The full campaign-state/Hub wiring pass. The Missions 1-11 enemy-variety reform plan, still awaiting Maxime's go-ahead.
