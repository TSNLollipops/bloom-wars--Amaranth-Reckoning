# Build Log Addendum — House Amaranth: Mission 3, "Second Harvest" (31 Aug 2026)

Maxime: *"lets keep building."* Continuing straight on from Mission 2, same session, same batch order (plan doc §8 step 3, Act I content).

## What shipped

Mission 3, "Second Harvest" — Act I's first extraction, `extract_unit`. New map (`map_house_amaranth_second_harvest`, 22×13), new `CampaignMission` (`mission_house_amaranth_3`), wired the same additive way as Missions 1-2 — added to `HOUSE_AMARANTH_ACT1`, which every downstream registry already spreads from automatically. No new registry wiring needed.

**The map reuses Warden Mission 5's ("Foraging Party") proven open-field/two-obstacle-cluster/deploy-west-exit-east shape** — the same reasoning as Mission 2's borrowed geometry: an open extraction field with two blocking clusters and three spawn seams is a real, already-proven "get someone across open ground under pressure" layout, not reinvented from zero. Every tile identity is freshly authored for House Amaranth (border ridge/scrub → `bloom_mat`, the two rubble/structure obstacle clusters → `bloom_mat`, read here as thick, uncut crop rows rather than rubble/habblock).

**Extraction target: Orin ("Quill"), the Fieldwright.** Matches this project's own established pattern — Warden's own extract_unit targets on the Fieldwright track (Lask, Vashti) are the "boots on the ground, hands-on" pilots, and Orin's callsign itself (a survey team's own record-keeper) fits "cut off while mapping a heavier-than-predicted drift" directly.

## Actually sim-tested, and this one's a genuinely tighter mission

Started from Warden Mission 5's own original opening composition (`bloom_crawlmass` 6, `bloom_splitfang` 2, `turnLimit` 14) as a first guess for a comparably-sized open-field extraction, then ran it:

```
npx tsx src/sim/run.ts mission_house_amaranth_3        → clean WIN, turn 12 of 14
npx tsx src/sim/runBatch.ts 150 mission_house_amaranth_3 → WIN=136/150 (91%), LOSS=3, COMMANDER_DOWN=11
```

**Named honestly: this is NOT a Mission-1/2-style cakewalk.** 91% at n=150 is a real, stable number (confirmed against a second n=60 run before the larger batch, same range both times), and worth being precise about the failure shape: 11 of the 14 non-wins are `COMMANDER_DOWN` — Marrow herself going down in the open field, not a straight loss (only 3). Tried a light tune (Crawlmass 6→5) first rather than assuming the original numbers were right; it didn't move the needle (88% at n=60, same range, noise not signal), so the original Warden-precedent numbers were kept rather than chasing a false read. This matches a real, already-flagged pattern in this project's own data (`campaignAmaranth.ts`'s own Mission 11/17/26 comments): extract_unit's single-named-target loss condition punishes any added pressure far harder than eliminate_all's margin implies — and here it's specifically punishing the *escort*, not the extraction target, since Marrow (Tank, slower, no exemption from mission-level commander-down) is the one who keeps getting caught in the open rather than Orin herself. Left as-is: a real, mildly-risky Act I mission is a legitimate design choice this early (first extraction, first time losing the commander is even possible), not a bug — flagging it plainly rather than either quietly softening it or shipping it unexamined.

## Verification

```
npm run typecheck   → clean
npm run lint         → clean (disposable Python-script scratch output deleted first, same non-issue as both prior passes)
npm test -- --run    → 57 files, 1186/1186 passing, zero regressions
```

## What's still not built

Missions 4-36. The Hub. The Bramble. Mission-select wiring. Same standing boundary as every prior House Amaranth pass.
