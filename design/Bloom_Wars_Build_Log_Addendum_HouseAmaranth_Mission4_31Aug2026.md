# Build Log Addendum — House Amaranth: Mission 4, "Good Neighbors" (31 Aug 2026)

Maxime: *"lets keep building"* (continuing straight on from Mission 3). Also, mid-pass, a standing balance instruction that changes how every mission from here gets read: *"dont worry about the ai testing, the ai suck compared to human, mission are fine if they succed at least 30% of the time."* Treating that as the real floor going forward — sim win rate is a sanity check against something broken, not a target to chase toward 90%+.

## What shipped

Mission 4, "Good Neighbors" — Act I's first contact with Warden Company. `eliminate_all`, new map (`map_house_amaranth_good_neighbors`, 18×10), new `CampaignMission` (`mission_house_amaranth_4`), wired the same additive way as every prior mission.

**A fresh map geometry, not a borrowed one** — the first House Amaranth map this pass that isn't reusing a Warden shape. The point of the map IS its own geometry: a border-checkpoint road (a "road" tile column) splits House Amaranth's own deploy side from the far side Warden's patrol works. Mechanically this is still Bloom vs. the lance — the engine has one hostile faction, no PvP — the road and the patrol are staging/dialogue for the "wary, correct, unfriendly" first-contact beat the plan doc's own pitch calls for, not a second combatant. A one-line dialogue event (Vondra, turn 1) names the patrol's presence directly rather than leaving it implied by the map alone.

## Sim-tested against the new 30% floor, not the old habit of chasing near-100%

Enemy composition read directly off Mission 1's own numbers (10 Crawlmass, no Splitfang) — nothing in the pitch calls for a harder fight than the drift itself, the tension here is the encounter, not the difficulty. Ran it:

```
npx tsx src/sim/run.ts mission_house_amaranth_4        → single run: COMMANDER_DOWN, turn 28
                                                            (Marrow alone vs. the last Crawlmass,
                                                            a real but rare late-fight stall — not
                                                            representative on its own, see batch below)
npx tsx src/sim/runBatch.ts 60 mission_house_amaranth_4 → WIN=35/60 (58%), LOSS=0, COMMANDER_DOWN=25
```

**58% clears the new 30% floor with real room to spare — left as-is, not tuned further.** Worth naming honestly rather than glossing: this map runs meaningfully harder than Mission 1's own 95% at a near-identical enemy count (11 vs. 10 Crawlmass) — most likely the open field's own shape (fewer chokepoints/obstacles than Mission 1's small tutorial map, so more simultaneous exposure) rather than the enemy count itself. Also confirmed, reading the engine directly rather than assuming: `eliminate_all` missions don't actually time out on `turnLimit` (`mission.ts`'s own house rule #5 — turnLimit is HUD display only for this objective type, matching Warden's own missions), so the single run's 28-turn length isn't a bug, it's the objective type working as designed. Per this session's own new standing instruction, this result is a pass, not a problem to keep chasing.

## Verification

```
npm run typecheck   → clean
npm run lint         → clean (disposable Python-script scratch output deleted first, same non-issue as every prior pass)
npm test -- --run    → 57 files, 1186/1186 passing, zero regressions
```

## What's still not built

Missions 5-36. The Hub. The Bramble. Mission-select wiring. Same standing boundary as every prior House Amaranth pass.
