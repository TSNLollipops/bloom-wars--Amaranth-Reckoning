# Build Log Addendum — House Amaranth: Mission 9, "Loyalist Eyes" (31 Aug 2026)

Maxime: *"your free to go."* Continuing the batch under the same standing intent as Missions 6-8.

## What shipped

Mission 9, "Loyalist Eyes" — a sector-governor auditor tours the program; Marrow has to hold a clean, boring battle for an audience hoping for a mess. New map (`map_house_amaranth_loyalist_eyes`, 18×13), new `CampaignMission` (`mission_house_amaranth_9`).

**No Warden mirror named for this one, and a genuinely different hold_zone shape from this campaign's own two prior ones.** Not Long Contract's single doorway (Mission 2), not Seal Arrives' open-on-all-four-sides dais (Mission 5) — a walled audit courtyard with TWO gates, north and south. The real tactical shift: attention has to split between two chokepoints instead of concentrating on one. Deploy sits inside the courtyard itself rather than approaching it, matching the fiction — the squad's already standing post for the tour when the drift shows up.

## Sim-tested, and the map shape itself moved the number, not just the enemy count

Started from Mission 5's own final shipped composition (Splitfang 4+4) as the natural same-objective, same-squad precedent — but tried its earlier, gentler first-pass number (3+3) first, on the theory that a comparably-sized hold should transfer roughly as-is:

```
npx tsx src/sim/run.ts mission_house_amaranth_9        → clean WIN turn 6 of 10, real engagement, one unit downed
npx tsx src/sim/runBatch.ts 150 mission_house_amaranth_9 → WIN=150/150 (100%)
```

100% — the two-gate design actually dilutes pressure per gate at a given total enemy count (`enemy_deploy` round-robins across all four spawn seams, two per gate, so the same headcount that concentrated at Long Contract's one door now splits across two), so the "safer" precedent number turned out too safe here, not transferable as assumed.

**Bumped straight to Mission 5's own actual final number, 4+4, rather than a smaller increment**, since the map shape itself — not the enemy count — was the real source of the slack:

```
npx tsx src/sim/runBatch.ts 150 mission_house_amaranth_9 → WIN=107/150 (71%), LOSS=38, COMMANDER_DOWN=5, TIMEOUT=0
```

71% — checked against four sample verbose runs rather than assumed. The dominant failure is exactly the design's own intent: "hostiles hold the zone" firing because a Splitfang slipped through the unwatched gate while the squad's attention sat on the other one. Not a degenerate or unrelated failure mode — the map is doing what it was built to do. Comfortably clear of the 30% floor. Shipped at 4+4.

## Verification

```
npm run typecheck   → clean
npm run lint         → clean (disposable Python-script scratch output deleted first, same non-issue as every prior pass)
npm test -- --run    → 57 files, 1186/1186 passing, zero regressions
```

## What's still not built

Missions 10-36. The Hub. The Bramble. Mission-select wiring. Same standing boundary as every prior House Amaranth pass.
