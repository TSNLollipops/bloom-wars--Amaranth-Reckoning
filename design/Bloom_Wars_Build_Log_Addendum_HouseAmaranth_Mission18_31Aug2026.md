# Build Log Addendum — House Amaranth: Mission 18, "Cultivator's Gambit" (31 Aug 2026)

Maxime, continuing off Mission 17: *"u can keep going."*

## What shipped

Mission 18, "Cultivator's Gambit" — plan doc §6's own pitch: "Deploying a new containment array directly onto contested, still-hot ground." `contested_landing`, new map (`map_house_amaranth_cultivators_gambit`, 22×11), new `CampaignMission` (`mission_house_amaranth_18`).

**`contested_landing` isn't new to the engine** — Warden's own Mission 15 "Landfall" introduced it. Checked `engine/mission.ts` directly: the objective's win check is byte-for-byte `eliminate_all`'s own (`if (!hostileAlive.length) return this.finishWin();`), and per house rule #5 there's no timeout-loss branch at all — `objectiveParams.turnLimit` is present for parity with the type but doesn't gate win/loss here. The entire "opposed drop, no grace period" identity lives in the map/wave design: spawn seams close enough to the deploy zone to sit well inside a first-turn hostile-phase move+attack.

**A genuinely different shape from Landfall's own beachhead.** Landfall is one direction of approach — deploy hugging one edge, spawns ahead of it. This map drops the containment array (and the escorting 10-pilot lance) dead center of the hot ground instead, with spawn seams on all four compass points, none more than 2-4 tiles from the deploy block's own edge — a landing surrounded, not a landing under fire from one direction. Ten deploy pads (rows 4-5, cols 8-12) match the 10-pilot squad exactly for the first time this campaign — no wraparound needed. Rubble and wrecked-structure fragments scattered through the open ground read as "still-hot": recent fighting already happened here.

**Sirenmaw as the primary threat for the first time anywhere in this campaign.** Every archetype used as an Act II opener so far: Gallcyst/Sporethrower (13), Undertow (14, 15), hostile mechs (16), Splitfang (17). Sirenmaw (`data/bloom.ts`: flight_membrane, pack intelligence, moveRange 6, attackRange 1-2, `onHit: fx_debuff_attack`) had appeared exactly once before, as a turn-5 reinforcement wave in Act I's own Mission 12 finale — never an opener. A real fit both ways: fictionally, something already airborne over ground that's still smoking closes on a landing craft before it's even fully down; mechanically, a flier already has the reach to converge on all four spawn seams on turn 1 regardless of what's directly underneath it, which is the actual point of a "landing surrounded" map rather than a funneled one. Crawlmass fills the same turn from the same seams as ground pressure once attention is split skyward.

## Sim-tested — a steep, real cliff found and backed well away from

```
8 Sirenmaw + 6 Crawlmass  → 100% (150/150), LOSS=0, COMMANDER_DOWN=0 — too easy
12 Sirenmaw + 10 Crawlmass → 0% (0/150), LOSS=0, COMMANDER_DOWN=150 — a hard deterministic wall
```

Bisected: **10 Sirenmaw + 8 Crawlmass → 55% (83/150) and 61% (92/150) across two independent batches**, LOSS=0 both times, COMMANDER_DOWN-only. Stable, and sitting well clear of both the 100% floor above and the 0% wall two steps up — not a number that happens to land safely right next to a cliff.

Traced a losing run directly: both Munti support pilots (Marrin, Solano) go down early to the encircling Sirenmaw flock, and once sustain runs out, the surviving Sirenmaw — still airborne, still able to reach her from any direction on this map — corner Marrow specifically and stack four attacks of ~21 damage across two hostile phases. A legible story that matches the map's own design intent: get isolated on a battlefield with no single "safe side" and the commander is the one who pays for it. Shipped at 10 Sirenmaw + 8 Crawlmass, `turnLimit: 14` (present for objective-type parity, not load-bearing for win/loss per the objective's own rule).

## Verification

```
npm run typecheck   → clean
npm run lint         → clean (disposable Python-script scratch output deleted first)
npm test -- --run    → 57 files, 1186/1186 passing, zero regressions
```

## What's still not built

Act II, Missions 19-20 (both deploying `HOUSE_AMARANTH_ACT2_DEFAULT_SQUAD` from the start, no retune needed). Act III, Missions 21-36. The full campaign-state/Hub wiring pass. The Missions 1-11 enemy-variety reform plan, still awaiting Maxime's go-ahead.
