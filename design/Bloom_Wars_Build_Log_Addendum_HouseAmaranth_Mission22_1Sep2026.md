# Build Log Addendum — House Amaranth: Mission 22, "Audit Under Fire" (1 Sep 2026)

Maxime: *"keep building all mission of house amaranth, but dont update the computer until I sai so."* Building straight through Act III per the standing "work through the plan, ask only for genuine scope ambiguity" instruction; nothing committed to the device this pass, all local until Maxime says go.

## What shipped

Mission 22, "Audit Under Fire" — House Amaranth's first `protect_asset` mission (Warden's own Mission 22, "Ash on the Water," was the only one that existed before this). New map (`map_house_amaranth_audit_under_fire`, 20×11), new `CampaignMission` (`mission_house_amaranth_22`). Defends a secondary diversion relay under loyalist inspection — the original relay (the one the whole program is built around) is deliberately saved for Mission 32, "Hold the Root," later this act, as the heavier version of the same objective.

## A real engine bug found and fixed, not just a mission built

`engine/mission.ts`'s `tickAssetDamage` and loss-check log lines, and `scenes/Battle.ts`'s live HUD line, all hardcoded the defended asset's display name to "the Providence" — harmless while Warden's ship-defense mission was the only `protect_asset` mission that existed (it happens to actually be the Providence), a real bug the instant a second one defends something else. House Amaranth's relay has never heard of Warden Company's ship.

Fixed generically: added `objectiveParams.assetName?: string` (`data/types.ts`) and a `Mission.assetName` field (`engine/mission.ts`) defaulting to `"Providence"` — Warden's Mission 22 needed zero data changes to keep behaving exactly as before. House Amaranth's Mission 22 sets `assetName: "relay"` explicitly. Both the sim log text and the on-screen HUD line (`Providence: X/Y HP` → `${assetName}: X/Y HP`) now read correctly for either mission. No existing test asserted on the literal string "Providence," so this was a clean refactor, not a breaking one.

## Map — a real design lesson about protect_asset chokepoints, not just tuning

**v1** (open scrub field, two "lanes" that were cosmetic only — nothing actually impassable between them): sim-tuned as a hard 100%→0% cliff with zero usable middle ground, because there was no real chokepoint at all.

**v2** (adopted Warden's own Ash on the Water geometry outright — sump filling the field around two narrow causeway rows, one spawn tile at the far west end of each): the opposite failure. 12 Sporethrower + 24 Crawlmass (36 enemies, nearly 4x this campaign's largest count anywhere else) still won 49/50. A verbose single run showed why: with only one spawn point per causeway, every hostile queues single-file behind the one at the front, so the squad camping the dock/deploy boundary farms arrivals at ~1 per turn forever, regardless of how many are queued behind. Real finding: a single distant spawn point makes a causeway chokepoint nearly unbeatable at *any* enemy count, because the bottleneck controls arrival rate, not just angle.

**v3** (shipped): kept the sump-causeway shape (reflavored as flooded drainage channels around the relay pad, fitting this campaign's own irrigated-terrace fiction) but spread three spawn seams along each causeway's own length instead of one at the far end, so hostiles arrive from multiple points in the same turn rather than queuing. That restored real sensitivity to enemy count.

## Sim-tuning journey — a genuine knife-edge, confirmed non-monotonic in one spot

```
6 Sporethrower + 12 Crawlmass  (18 total)  → 100%
9 Sporethrower + 18 Crawlmass  (27 total)  → 100%
10 Sporethrower + 20 Crawlmass (30 total)  → 80%
10 Sporethrower + 21 Crawlmass (31 total)  → 53%
10 Sporethrower + 22 Crawlmass (32 total)  → 98%  (reproduced twice — not a fluke, a real non-monotonic spot)
11 Sporethrower + 21 Crawlmass (32 total)  → 0%
11 Sporethrower + 20 Crawlmass (31 total)  → 5%, 5%, 2% (three independent 150-run batches, 17/450 pooled ≈ 3.8%)
12 Sporethrower + 24 Crawlmass (36 total)  → 0%  (from the v2 geometry test, kept as the upper bound reference)
```

The 10+22 result sitting at 98% between two much harder neighbors (10+21 at 53%, 11+21 at 0%) is a genuine same-total non-monotonic result, not sampling noise — reproduced twice at n=150. Consistent with this campaign's already-documented pattern of non-monotonic difficulty cliffs (Missions 13/17/18/21), just sharper here because `protect_asset`'s zero-tolerance loss condition (asset HP hitting 0, no partial credit) makes it exactly as knife-edge as Ash on the Water's own tuning note already warned ("a knife-edge, not a gradient"). Shipped at 11 Sporethrower + 20 Crawlmass, 31 total — stable and comfortably under the ≤15% ceiling across three independent batches, not a single-batch pick.

## Verification

```
npm run typecheck    → clean
npm run lint          → clean (disposable Python-script scratch output deleted first, same
                         housekeeping step every prior mission flagged)
npm test -- --run     → 58 files, 1192/1192 passing, zero regressions (engine refactor included)
npm run build          → clean (tsc + vite build), only the pre-existing >500kB chunk-size warning
```

`tools/lint-spoiler.mjs` itself only no-ops in this sandbox — real check needs Maxime's own local `npm run lint`, same caveat as every prior mission.

## What's still not built

Act III, Missions 23-36 of House Amaranth. The full campaign-state/Hub wiring pass. The Missions 1-11 enemy-variety reform plan. Maxime's own planned n=500 whole-campaign retune pass, once every mission exists.
