# Build Log Addendum — House Amaranth: Mission 12, "Harvest's End" (31 Aug 2026)

Maxime: *"look fine. have fun. dont just add splitfang. add some undertow or flyers too. they too can appearn mission 6-12."* Act I's finale, built to that direction directly rather than repeating the reflexive "bump Splitfang" lever every prior mission in this batch reached for.

## What shipped

**Act I is now complete — 12 of 12 missions.** Mission 12, "Harvest's End" — a diversion relay fails under real load for the first time; Marrow holds the line long enough for a fix, at real cost to her own staff, and is confirmed in permanent command whether or not the seal-holder ever blesses it. `hold_zone`, new map (`map_house_amaranth_harvests_end`, 20×13), new `CampaignMission` (`mission_house_amaranth_12`).

**The map has no true walls anywhere — deliberately, and unlike either of this campaign's two other `hold_zone` maps.** Mission 5's own shape puts the hold behind a ridge chokepoint; Mission 9 splits pressure across two blockhouse gates. This one is an open compound: the relay itself sits center as the hold zone, two habblock/structure clusters flank it (passable but costly, not impassable — nothing here actually seals off an approach), and four ground spawn seams spread across the whole top band instead of funneling through one or two points. That openness is the literal mechanical reading of "the thing that's supposed to hold here doesn't."

**Composition leans on the two archetypes Maxime named, not another Splitfang bump:**

- **Undertow** (`bloom_undertow`, burrowed, ×1.5 damage on the turn it surfaces) — 2, pinned directly against the relay's flanking clusters. The ground-breach reading: whatever's coming through the relay is already close by the time anyone sees it.
- **Sirenmaw** (`bloom_sirenmaw`, flying, ignores terrain, cannot be blocked) — 2, pinned at the map's far corners, arriving as a turn-5 reinforcement wave once the ground fight is already underway. This is the base Data Pack flyer, not Mission 10's elite Choir-boss variant of the same lineage — a deliberately smaller escalation than the mid-boss encounter, matching "reinforcement" rather than "second boss." Also the same flyer role Warden's own Act I finale (their own Mission 12) established as this campaign's precedent for what an Act I closer's air threat looks like.
- 6 Crawlmass at turn 1 (`enemy_deploy`) round out the ground pressure, same base every mission this pass has used.

## Sim-tested — landed on the first pass

```
npx tsx src/sim/run.ts mission_house_amaranth_12        → COMMANDER_DOWN, turn 4 (verbose sample)
npx tsx src/sim/runBatch.ts 150 mission_house_amaranth_12 → WIN=77/150 (51%), LOSS=0, COMMANDER_DOWN=73, TIMEOUT=0
```

No retune needed — 51% on the first composition tried. Worth being straight about what that number actually is rather than just reporting it: **LOSS=0** is genuinely notable — nobody loses this fight by simply failing to hold the zone once engaged. Every non-win is `COMMANDER_DOWN`, at 48.7% — a higher share than any prior mission this pass (Mission 8's 33%, Mission 10's 23%). Checked against the verbose sample: both Undertow surface adjacent to different units in the same opening exchange and land their surprise multiplier, Crawlmass chip damage keeps landing on whoever's already hurt, and with no walls anywhere on this map to break line of sight or block approach, Marrow herself is reachable from more angles at once than on any prior hold_zone map. That's not a different failure type from the "concentrated fire catches the commander" shape every mission since Mission 6 has already taught — it's the same shape, just with a genuinely higher rate because the map's own design (no walls, by choice) removes the thing that usually blunts it. It's also, read straight, the mechanical expression of the pitch's own "at real cost to her own staff" line, not an accident worth apologizing for. Comfortably clear of the 30% floor.

## Verification

```
npm run typecheck   → clean
npm run lint         → clean (disposable Python-script scratch output deleted first, same non-issue as every prior pass)
npm test -- --run    → 57 files, 1186/1186 passing, zero regressions
```

## Act I status

**Complete — 12 of 12 missions built, sim-tested, and shipped.** Missions 13 onward (Act II, "The Bargain Holds") are next, per the plan doc's own §6 table, whenever Maxime says to keep going.
