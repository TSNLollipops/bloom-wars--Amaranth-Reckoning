# Build Log Addendum — House Amaranth: Mission 8, "The Quiet Growth" (31 Aug 2026)

Maxime: *"good work. u can go."* Continuing the batch under the same standing intent as Missions 6-7.

## What shipped

Mission 8, "The Quiet Growth" — House Amaranth's own first `survive_n_turns` mission. First sign the diverted Bloom isn't staying where it's put: a night watch that shouldn't need this much watching. New map (`map_house_amaranth_the_quiet_growth`, 16×11), new `CampaignMission` (`mission_house_amaranth_8`).

**Built directly against a lesson this campaign already had on record, not rediscovered the hard way.** `campaignAmaranth.ts`'s own Mission 34/35 comments (Warden Company's Act III `survive_n_turns` missions) flag a real engine property: the AI never moves without a visible target, and `survive_n_turns` has no hold zone to eventually walk the squad into — so if enemies spawn too far from deploy, turns pass with no engagement at all and the mission reads as "waiting," not "surrounded." Built the map around that from the start: a tight, compact watch-post layout, deploy dead center, four spawn seams (N/S/E/W) close on every side. Matched Warden's own Mission 9 ("Cut Off") "cheapest ask" precedent for this objective type's first outing: `turnLimit: 10`.

## Sim-tested across three passes

**(1) 10 Crawlmass at turn 1 only, matching Cut Off's own opening exactly:**

```
npx tsx src/sim/run.ts mission_house_amaranth_8        → clean WIN, turn 10 of 10, real multi-directional engagement from turn 1
npx tsx src/sim/runBatch.ts 150 mission_house_amaranth_8 → WIN=150/150 (100%), LOSS=0, COMMANDER_DOWN=0
```

100% — flat cakewalk. Per the standing intent from Missions 6/7, pushed further rather than left here.

**(2) Added a 4-Crawlmass turn-5 reinforcement wave at the same four seams** (the "it keeps coming" beat, rather than just a bigger turn-1 pile):

```
npx tsx src/sim/runBatch.ts 150 mission_house_amaranth_8 → WIN=149/150 (99%), COMMANDER_DOWN=1
```

Barely moved the needle — more low-tier Crawlmass by turn 5 just isn't real pressure against a five-pilot squad that's already cleared most of the opener.

**(3) Swapped the reinforcement wave to 4 Splitfang instead of more Crawlmass** — a real tier jump fits "isn't staying where it's put" better than volume anyway, same reasoning Missions 6/7 already used for their own variety additions:

```
npx tsx src/sim/runBatch.ts 150 mission_house_amaranth_8 → WIN=100/150 (67%), LOSS=0, COMMANDER_DOWN=50, TIMEOUT=0
```

67% — checked against three sample verbose runs rather than assumed. The failure mode is legible: 3 Splitfang alpha-striking Marrow for ~96 damage in one hostile phase right as the reinforcement wave lands, the same "concentrated pack/ranged strike catches the commander" shape Missions 6 and 7 already taught, not a degenerate loss type. No LOSS or TIMEOUT cases at all — every failure is a clean commander-down. Comfortably clear of the 30% floor. Shipped at 10 Crawlmass (turn 1) + 4 Splitfang (turn 5).

## Verification

```
npm run typecheck   → clean
npm run lint         → clean (disposable Python-script scratch output deleted first, same non-issue as every prior pass)
npm test -- --run    → 57 files, 1186/1186 passing, zero regressions
```

## What's still not built

Missions 9-36. The Hub. The Bramble. Mission-select wiring. Same standing boundary as every prior House Amaranth pass.
