# Build Log Addendum — House Amaranth: Mission 11, "What the Terraces Cost" (31 Aug 2026)

Maxime: *"so far its fine. keep going."* Continuing the batch under the same standing intent as Missions 6-10.

## What shipped

Mission 11, "What the Terraces Cost" — a ward-crop technician goes missing inside the growth zone, the bargain's first quiet, unlogged casualty. `extract_unit`, new map (`map_house_amaranth_what_the_terraces_cost`, 20×12), new `CampaignMission` (`mission_house_amaranth_11`).

**No Warden mirror named for this one, and a genuinely different extract_unit shape from this campaign's own two prior extractions.** Not Second Harvest's open field (Mission 3), not Deeper Terraces' two-tier ridge climb (Mission 7) — a cluttered "growth zone" maze, three separate bloom_mat crop-cluster bands (two rows tall each, same precedent Second Harvest's own obstacle clusters set) breaking sightlines across the whole width instead of two obstacles in an otherwise open field. Two of the four spawn seams sit tucked directly against the clusters rather than out in the open — something can be right next to the squad and stay hidden in this terrain, the actual mechanical reading of "the growth zone swallowed her."

**Extraction target: Orin again — her third time as this campaign's extract_unit target.** Worth naming rather than glossing: Warden's own campaign reuses a single Fieldwright (Anand) more than once too, and Orin's own Fieldwright/survey-specialist framing fits a missing "technician" better than any other pilot on the roster — not picked for lack of imagination, picked because it's the one role on this roster the fiction actually calls for.

## Sim-tested across three passes

**(1) 6 Crawlmass + 2 Splitfang, Second Harvest's own base:**

```
npx tsx src/sim/run.ts mission_house_amaranth_11        → clean WIN, turn 12 of 15
npx tsx src/sim/runBatch.ts 150 mission_house_amaranth_11 → WIN=148/150 (99%), LOSS=2, COMMANDER_DOWN=0
```

99% — a cakewalk that reads nothing like "the bargain's first quiet, unlogged casualty."

**(2) Added 2 Sporethrower pinned into the two spawn seams tucked against the clusters** — the "hidden in the growth" threat this map was built for:

```
npx tsx src/sim/runBatch.ts 150 mission_house_amaranth_11 → WIN=21/150 (14%), LOSS=49, COMMANDER_DOWN=80
```

Catastrophic overshoot, below the 30% floor. Same "two Sporethrower is one too many" lesson Mission 6 and Mission 7 both already taught, confirmed a third time rather than assumed away.

**(3) Cut to a single Sporethrower:**

```
npx tsx src/sim/runBatch.ts 150 mission_house_amaranth_11 → WIN=108/150 (72%), LOSS=28, COMMANDER_DOWN=14, TIMEOUT=0
```

72% — checked against three sample verbose runs rather than assumed. The dominant failure is a genuine turn-limit squeeze: clearing the maze's hidden Sporethrower plus the Splitfang/Crawlmass pack costs real routing time through the clusters, not a degenerate loss type — and it's the map's own premise doing the work, the growth genuinely slowing the squad down. Comfortably clear of the 30% floor. Shipped at 6 Crawlmass + 2 Splitfang + 1 Sporethrower.

## Verification

```
npm run typecheck   → clean
npm run lint         → clean (disposable Python-script scratch output deleted first, same non-issue as every prior pass)
npm test -- --run    → 57 files, 1186/1186 passing, zero regressions
```

## What's still not built

Mission 12 (Act I finale) onward. The Hub. The Bramble. Mission-select wiring. Same standing boundary as every prior House Amaranth pass.
