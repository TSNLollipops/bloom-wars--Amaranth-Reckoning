# Build Log Addendum — House Amaranth: Mission 14, "The Governor's Patience" (31 Aug 2026)

Maxime: *"yeah. go for it. plan a reform of nission 1-11 for the same thing. too."* Continuing Act II under the same standing enemy-variety direction; the Missions 1-11 reform plan follows in its own document.

## What shipped

Mission 14, "The Governor's Patience" — political pressure sharpens; a loyalist liaison officer needs escorting out once he's seen too much. `extract_unit`, new map (`map_house_amaranth_the_governors_patience`, 22×11), new `CampaignMission` (`mission_house_amaranth_14`).

**Extraction target: Orin, her fourth time** — named directly rather than glossed over, same discipline every prior reuse got. Worth being clear about the mechanics: the liaison himself isn't a controllable unit (`extractUnitId` always resolves to a roster pilot, and the game's `rescue_pilot` bonus-objective shape is for recruiting a *new* pilot, not this). The fiction reads Orin's own exposure closing on and pulling him out as what the mechanic represents — the same reading Missions 3, 7, and 11 already used for a survey team, a technician, and a missing person, none of whom were literally Orin either.

**A checkpoint corridor, a new extract_unit shape again.** Rubble cover clusters flank a clear center lane running deploy (west) to exit (east) — a real choice between the guarded flanks and the exposed middle, distinct from Second Harvest's open field, Deeper Terraces' ridge climb, or What the Terraces Cost's full maze.

**Composition: Undertow as primary for the first time.** Three Undertow, burrowed, pinned at the corridor's flank clusters — up from the small 2-unit secondary role it had in Mission 12. Four Crawlmass filler. No Splitfang, no Sporethrower, no Gallcyst — a different pairing again from every mission this variety pass has built.

## Sim-tested — landed on the first pass, with a genuinely different failure texture

```
npx tsx src/sim/runBatch.ts 150 mission_house_amaranth_14 → WIN=89/150 (59%), LOSS=61, COMMANDER_DOWN=0, TIMEOUT=0
```

Worth naming what that breakdown actually is rather than assuming from the win rate alone: **COMMANDER_DOWN=0 across all 150 runs.** `extract_unit` actually enforces its own turn limit as a real fail condition (unlike `eliminate_all`'s HUD-only version) — every non-win here is a clock-out, "turn limit reached before extraction," not a death. Checked against a verbose sample: the squad fights through a real Undertow ambush and clears Crawlmass near deploy in the first few turns (Marrow alone took two separate ~50-60 point surprise hits), then spends the rest of the turn budget marching the corridor's length with nothing left to fight. A pure pacing squeeze — the cost of the early fight eating the travel budget, not later combat risk. A genuinely different kind of pressure than the commander-focus-fire shape every other variety mission this pass has produced so far: time pressure instead of death pressure. Comfortably clear of the 30% floor. Shipped at 3 Undertow + 4 Crawlmass.

## Verification

```
npm run typecheck   → clean
npm run lint         → clean (disposable Python-script scratch output deleted first, same non-issue as every prior pass)
npm test -- --run    → 57 files, 1186/1186 passing, zero regressions
```

## What's still not built

Act II, Missions 15-20. Act III, Missions 21-36. The Hub, mission-select wiring. Same standing boundary as every prior House Amaranth pass. A separate document (`claude/Bloom_Wars_HouseAmaranth_Act1_EnemyVariety_Reform_Plan_v1.md`) proposes how the same enemy-variety principle could apply retroactively to Missions 1-11 — a plan only, per Maxime's own ask, not executed here.
