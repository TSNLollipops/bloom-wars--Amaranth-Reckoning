# Build Log Addendum — Tier 6 spawn-variety pass, batch 4: Act III audit + Mission 30 (30 Aug 2026)

Continuing the Consolidated Build Plan's Tier 6, per Maxime: "keep working on the consolidation plan. ill do ai pass later" — spawn-list variety only, no AI/engine changes, same discipline as batches 1-3.

## Why this batch only touches one mission

Read all 11 remaining Act III missions' own build logs (25, 26, 27, 29, 30, 31, 32, 33, 34, 35, 36 — Mission 28 confirmed Bloom-free by design, already excluded) before touching anything. Act III reads very differently from Act I/II: it's the campaign's finale content, and nearly every mission in it already carries its own explicit fragility documentation in its own words, not inferred:

- **Mission 25**: "a real cliff in the data... not a gradient" (100% at 23 enemies, ~73% at 25, undershoots at 21) — already at its own locked, deliberately-not-chased-further ceiling.
- **Mission 26**: an isolation-kill bug already fought once (4→2 Undertow), then a squad-size jam bug found at 12-pilot scale with its own honest "this doesn't remove the underlying risk" admission — actively fragile on two separate axes.
- **Mission 27, 29, 33**: hold_zone missions built around a specific vision-gated-AI spawn bug (units that spawn out of anyone's sensor range never move at all) — already fixed once per mission with hand-verified, comment-documented spawn coordinates. All three already carry 3-4 archetypes each (Crawlmass/Splitfang/Sporethrower, confirmed directly in `campaignAmaranth.ts`), so they're not actually thin the way the audit's headline finding assumed — and any further edit to their `enemyWaves` risks the exact spawn-position mistake their own build logs already document once each.
- **Mission 31**: extract_unit + a brand-new multi-civilian system, already at only 65% by design ("not everyone gets out" as genuine risk), enemy counts already explicitly "thinned... because the civilians' fragile stats made the original composition close to a guaranteed loss regardless of AI behavior."
- **Mission 32**: the mission whose own bug fix changed engine-wide AI behavior (`reflexiveDecision`/`packDecision` defendZone fallback), currently 50% with real ship-destroyed losses in the sample — no spare margin.
- **Mission 34, 36**: both explicitly flag their own "steep sensitivity" — Mission 34's own words, and Mission 36's build log calls out a 39% total-count swing flipping a certain-loss into a certain-win outright.
- **Mission 35**: the final boss fight, deliberately the hardest in the campaign by design (55%, "real permanent losses even on wins") — no case for adding more.

That's 10 of 11 with a real, specific, already-written reason not to touch them this pass. **Mission 30** was the one exception — its own build log's only note is "matching Mission 26's own precedent for appropriately dangerous," no cliff, no knife-edge, no bug history tied to its spawn positions.

## Mission 30 (Ashes of the Second Ring): the edit

Pre-edit baseline, fresh this session (n=150): **81% (122/150)**, LOSS=0, COMMANDER_DOWN=28, TIMEOUT=0 — real margin, no other failure mode.

Added 2 `bloom_undertow` (the audit's own "thin" archetype), burrowed/fixed per the standard template used everywhere else in this file. Placement checked directly against `ASHES_OF_THE_SECOND_RING_TILES` (not guessed): (7,6) and (7,8), both confirmed "plain" (open, walkable) tiles just east of the squad's own deploy zone (x=1-4, y=6-9), on the path toward the mission's two Gallcyst strongpoints — reads as an ambush left in the rubble, matching the briefing's own "clear it out, one street at a time." Burrowed placement was a deliberate choice: an ambusher doesn't need to path anywhere to be a threat, so it sidesteps the exact vision-gated-movement bug that Missions 27/29/33 (above) all had to work around.

## Post-edit verification

n=150: **88% (132/150)**, LOSS=0, COMMANDER_DOWN=18, TIMEOUT=0 — win rate went *up*, not down (81%→88%), and commander_down losses actually dropped (28→18). Worth being honest about, since it's the opposite of every other edit in this pass: read as plausible rather than a red flag — an early, guaranteed-contact ambush right off deploy likely draws some of the squad's opening attention and damage away from whatever would otherwise line up a clean shot on the commander a few turns later, rather than adding net pressure. No new failure mode appeared (LOSS and TIMEOUT both still 0), so there's no sign this is masking a bug the way Mission 27's "100% clean, zero combat" result once was — a verbose single run confirms the Undertow do genuinely surface and attack.

Full verification: typecheck clean, lint clean, full test suite **1146/1146**. Full 40-mission/1000-run campaign batch (n=25) after shipping: **72% aggregate (719/1000)**, in line with prior runs this same session (68-72% band, matches the parallel session's own 70-72%); Mission 30 itself at 92% (n=25), nothing else moved.

## What's still not started

All 10 other Act III missions listed above, each for the specific reason given — none of them should be touched without the same one-at-a-time, read-the-build-log-first, sim-verify discipline this whole pass has used, and several of them (26, 32) would need a real design conversation with Maxime first given how close to the engine or how deliberately tight their own tuning already is. With this batch, every mission in the 40-mission campaign has now been through at least one deliberate Tier 6 audit pass (either edited, or explicitly considered and left alone with a documented reason) — Tier 6's own "spawn-list variety" scope, as distinct from the AI-behavior thread Maxime's reserving for himself, is functionally complete.
