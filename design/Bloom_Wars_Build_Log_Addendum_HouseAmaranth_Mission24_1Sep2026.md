# Build Log Addendum — House Amaranth: Mission 24, "Seizure Order" (1 Sep 2026)

## What shipped

`extract_unit`, `turnLimit: 14`. New map (`map_house_amaranth_seizure_order`, 22×11), new `CampaignMission` (`mission_house_amaranth_24`).

Extraction target is Halcyon Amaranth herself — but she's never had a pilot record (a civilian governor, not a combat pilot), so a combat stat block would misrepresent who she is. Used `civilianSpawns`/`extractThreshold` (the mechanic Warden's own Mission 31 "The Last Convoy" introduced) instead of `extractUnitId`: a single civilian spawn next to deploy, `extractThreshold` left unset (defaults to 1 — "everyone has to make it"), matching a single-VIP evacuation's real stakes.

New hostile faction: `LOYALIST_HOSTILE_MECHS` (`data/units.ts`) — sector command's own regulars, a human-military hostile distinct from Warden Company, needed because "loyalist" troops attacking directly is new here (the term existed since Mission 14/22 but always named a person to escort, never a combat force until this mission's own pitch makes it one). Same generic tank/meeps/meeps/reeps tier-G shape as `WARDEN_HOSTILE_MECHS`, no named rival — the mission doesn't call for a boss-tier officer. This block is also earmarked for reuse at Mission 30 ("Two Fronts"), per the plan doc's own "loyalist regulars" phrasing there.

## Sim-tuning

```
2+2+2+2 loyalist regulars (8 total), single pincer wave → 13%, 10%, 15% (100/150/150 runs, 51/400 pooled ≈ 12.75%)
```

Landed under the ceiling on the first composition tried — no bisection needed this time. Losses dominated by the civilian's own fragility (established already in Warden's Mission 31: civilians are near one-hit-kill against a real hit), not a stalled extraction or engine issue.

## Verification

```
npm run typecheck    → clean
npm run lint          → clean (scratch generated-map file deleted first)
npm test -- --run     → 58 files, 1192/1192 passing, zero regressions
```

## What's still not built

Act III, Missions 25-36. Hub wiring pass. Missions 1-11 enemy-variety reform. Maxime's own n=500 retune pass.
