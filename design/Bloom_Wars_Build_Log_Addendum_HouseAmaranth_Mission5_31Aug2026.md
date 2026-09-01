# Build Log Addendum — House Amaranth: Mission 5, "The Seal Arrives" (31 Aug 2026)

Maxime: *"lets keep building"* (continuing straight on from Mission 4), under the new 30% balance floor set mid-pass (see Mission 4's own addendum).

## What shipped

Mission 5, "The Seal Arrives" — a House officer holding Halcyon's seal visits for a muster; Marrow has to make it look easy. `hold_zone`, new map (`map_house_amaranth_the_seal_arrives`, 20×12), new `CampaignMission` (`mission_house_amaranth_5`), wired the same additive way as every prior mission.

**Deliberate shape variety, not the same doorway room again.** Reuses Warden Mission 7's ("Sporewatch Ridge") proven ridge-walled dais — an open-on-all-four-sides raised plateau, not the single-doorway walled room this campaign's own Mission 2 already used. Fits the beat directly: a formal muster ground reviewed from a raised dais, not a bunker. Border scrub retextured to `bloom_mat`; the ridge itself kept as ridge rather than swapped, since a muster dais reading as elevated ground is the point, not incidental.

## Sim-tested, clean

Enemy composition started from Mission 2's own tested numbers (`bloom_splitfang` 3+3) as the nearest same-objective precedent, `holdUntilTurn` trimmed slightly (5 vs. Mission 2's 6) to match this map's smaller 12-tile hold zone against Mission 2's 20:

```
npx tsx src/sim/run.ts mission_house_amaranth_5        → clean WIN, turn 5 of 9
npx tsx src/sim/runBatch.ts 60 mission_house_amaranth_5 → WIN=60/60 (100%), LOSS=0, COMMANDER_DOWN=0
```

Clean 100% — no tuning needed, left as-is at first.

## Re-tuned same session: Maxime checked the log, then asked for more pressure

Maxime's own follow-up: *"check mission 5. is it easy because bloom dont see them? or is there genuinely too few bloom."* Read the actual turn-by-turn log rather than guessing from the numbers alone: by turn 2, Vondra had already closed to the ridge wall and was landing hits — the Splitfang engaged immediately, no perception or pathing failure. The real cause: 6 total Splitfang (3+3, 70 HP each = 420 HP pool) against five pilots each hitting for 40-50 damage clears the whole wave in about three rounds of real combat — a genuine firepower mismatch, not a bug. Reported that plainly.

His call once confirmed: *"add 1 more splitfang per wave. i want the player to feel it."* Changed 3+3 → **4+4**, re-tested:

```
npx tsx src/sim/run.ts mission_house_amaranth_5        → WIN, turn 5 of 9 — but this time Vondra
                                                            actually went down mid-fight (standard
                                                            restock, a living Munti on the field)
npx tsx src/sim/runBatch.ts 60 mission_house_amaranth_5 → WIN=54/60 (90%), LOSS=6, COMMANDER_DOWN=0
```

90% at n=60, real losses appearing (6, none of them commander-down) — the mission now has actual teeth without threatening Marrow specifically. Shipped at 4+4.

## Verification

```
npm run typecheck   → clean
npm run lint         → clean (disposable Python-script scratch output deleted first, same non-issue as every prior pass)
npm test -- --run    → 57 files, 1186/1186 passing, zero regressions
```

## What's still not built

Missions 6-36. The Hub. The Bramble. Mission-select wiring. Same standing boundary as every prior House Amaranth pass. Note: Mission 6 ("House Colors") is next in the plan doc's own table and explicitly mirrors Warden's own Mission 6 — the same incident, read from House Amaranth's side — worth reading that mission's own text before authoring it, not just its map.
