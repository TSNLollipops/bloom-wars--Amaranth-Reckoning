# Build Log Addendum — House Amaranth: Mission 27, "Salvage the Season" (1 Sep 2026)

## What shipped

`extract_unit`, `turnLimit: 16`, `extractThreshold: 4`. New map (`map_house_amaranth_salvage_the_season`, 24×11), new `CampaignMission` (`mission_house_amaranth_27`). Five `civilianSpawns` (ward-crop technicians), Bramble (Mission 26) as the pursuing threat.

## A real mechanical finding: `extractThreshold` unset is nearly unwinnable against any real threat

First attempt left `extractThreshold` unset (defaults to `civilianSpawns.length`, 5 — "everyone has to make it," matching the pitch's own "pulling a whole terrace... out" framing, and the plan doc doesn't flag this mission "scripted partial loss" the way Mission 31 later is). Result: 0% at even 4 Bramble, verified via a verbose run — the moment ANY ONE civilian dies, the remaining count drops below the still-required total and the mission fails outright, instantly, regardless of how the rest of the fight goes ("too few of the convoy can still reach extraction (0/5 needed, 4 still possible)"). Against `bloom_bramble`'s attackPower 54 vs. a civilian's fragile stats (near one-hit-kill, already documented for Warden's own convoy mission), requiring literal 100% survival is effectively an instant-loss trap the instant contact happens at all.

Set `extractThreshold: 4` instead (up to one loss tolerated) — not narratively "scripted," just the same kind of tuning headroom Warden's own Mission 31 uses for a different reason. This is what made the mission tunable at all rather than a binary wall.

## Sim-tuning journey

```
extractThreshold unset (5), 4 Bramble atTurn 1   → 0%
extractThreshold 4, 4 Bramble atTurn 1           → 0%
extractThreshold 4, 4 Bramble atTurn 3           → 16%, 18%, 24%/15%/16% (noisy — civilian AI
                                                     randomness compounds with combat RNG more
                                                     than usual)
extractThreshold 3, 4 Bramble atTurn 3           → 87% (way too easy — a 2-loss tolerance is a
                                                     much lower bar than a 1-loss one, not a
                                                     small nudge)
extractThreshold 4, 4 Bramble atTurn 3 + 3 Bramble atTurn 5 → 12%, 12%, 14% (450 runs pooled,
                                                     57/450 ≈ 12.7%)
```

Splitting into two waves (turn 3 + turn 5) rather than one bigger burst is what actually closed the gap — sustained pressure across the evacuation, not a single bigger spike. Shipped at that composition.

## Verification

```
npm run typecheck    → clean
npm run lint          → clean (scratch generated-map file deleted first)
npm test -- --run     → 58 files, 1192/1192 passing, zero regressions
```

## What's still not built

Act III, Missions 28-36. Hub wiring pass. Missions 1-11 enemy-variety reform. Maxime's own n=500 retune pass.
