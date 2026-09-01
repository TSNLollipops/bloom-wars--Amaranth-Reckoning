# Build Log Addendum — House Amaranth: Mission 6, "House Colors" (31 Aug 2026)

Maxime: *"go for it."* Continuing the batch, under the 30% floor set at Mission 4.

## What shipped

Mission 6, "House Colors" — explicitly mirrors Warden's own Mission 6, per the plan doc's own §6 table: the same checkpoint dispute at Thane's Crossing, read from House Amaranth's side. `eliminate_all`, new map (`map_house_amaranth_house_colors`, 20×12), new `CampaignMission` (`mission_house_amaranth_6`).

**How the mirror actually works, mechanically.** Warden's own version has Rourke's squad fight House Amaranth's own line troopers (named hostile mechs) when the checkpoint is unexpectedly sealed — the engine's one PvP-flavored mission in that campaign. This side can't restage that literally (one hostile faction, no PvP against Warden's own pilots), so it tells the same incident's real cause instead: Marrow's own detachment, still holding the gate, still fighting for it, catches a Bloom incursion right as the withdrawal order arrives. The eliminate_all fight is the real gameplay; the bitter payoff — a bargain-mandated withdrawal Marrow was ordered into and hated, per the plan doc's own pitch — lands as a closing dialogue line on `objective_complete` (a trigger type that already existed in `types.ts`, first use in this campaign), not a different objective type.

**The map is the literal same location, deliberately not retextured** — caught and fixed a real transcription slip while building it: the validator script's own ASCII legend maps `~` to `bloom_mat`, not `scrub`, so a first pass at the border (typed as `~`, matching every other House Amaranth map's own border convention) silently retextured the checkpoint's scrub border to bloom_mat, contradicting the whole point of reusing this shape unretextured. Caught by diffing the generated output against what was intended, before it shipped — fixed the ASCII to use scrub's actual `,` character, regenerated, and the map now matches Warden's own House Colors tile-for-tile. Logged here rather than silently corrected, since it's exactly the kind of error the "transcribe verbatim from the generated file, never hand-edit" discipline exists to catch.

## Sim-tested

Enemy composition started from Mission 4's own numbers (10 Crawlmass, the nearest same-objective precedent):

```
npx tsx src/sim/run.ts mission_house_amaranth_6        → clean WIN, turn 12 of 10... — wait, see note below
npx tsx src/sim/runBatch.ts 60 mission_house_amaranth_6 → WIN=59/60 (98%), LOSS=0, COMMANDER_DOWN=1
```

(Note: `eliminate_all` doesn't time out on `turnLimit` per `mission.ts`'s own house rule #5 — already confirmed directly from engine code in Mission 4's own addendum — so turn 12 against a `turnLimit: 10` display value is expected, not a bug.)

98% at n=60 — noticeably easier than Mission 4's own 58% at the same enemy count, most likely the gate chokepoint concentrating enemies into a narrower approach than Good Neighbors' open field. Reported honestly, left as-is at first.

## Re-tuned same session: real variety requested, first attempt overshot, second landed

Maxime: *"add more enemy. maybe diff variety. how would u make the mission harder?"* The approach: not just a bigger pile of the same archetype, but a genuinely different tactical problem layered on top of the existing Crawlmass base — added `bloom_splitfang` (this campaign's own established "next tier up," already used in Missions 2/5) and, for real variety rather than just more melee to grind through at the gate, `bloom_sporethrower` — the one archetype in this roster with a ranged attack ([2,3] `attackRange`), pinned to explicit sightline coordinates near the gate's own spawn tiles rather than `spawnAt: "enemy_deploy"`, since its `moveRange: 2` is too short to reliably path off a random spawn tile without landing against the wall or inside a structure block.

**First guess (8 Crawlmass + 3 Splitfang + 2 Sporethrower) badly overshot — caught by sim, not shipped blind:**

```
npx tsx src/sim/runBatch.ts 60 mission_house_amaranth_6 → WIN=2/60 (3%), COMMANDER_DOWN=58
```

Two Sporethrower stacking 22-31 consistent ranged damage on top of Splitfang's own melee hits, both effectively unreachable behind the gate structure, proved far harder to interrupt than the raw numbers suggested — this campaign's second real lesson (after Mission 5's own firepower-mismatch finding) that a mission's actual difficulty can diverge sharply from what the enemy count alone implies. Cut to **6 Crawlmass + 2 Splitfang + 1 Sporethrower**:

```
npx tsx src/sim/runBatch.ts 60 mission_house_amaranth_6 → WIN=42/60 (70%), COMMANDER_DOWN=18
```

70% at n=60 — real teeth, three genuinely different threat shapes in the same fight (swarm, hard-hitting melee pack, ranged pressure), comfortably clear of the 30% floor. Shipped at this composition.

## Verification

```
npm run typecheck   → clean
npm run lint         → clean (disposable Python-script scratch output deleted first, same non-issue as every prior pass)
npm test -- --run    → 57 files, 1186/1186 passing, zero regressions
```

## What's still not built

Missions 7-36. The Hub. The Bramble. Mission-select wiring. Same standing boundary as every prior House Amaranth pass.
