# Build Log Addendum — Tier 6 spawn-variety pass, batch 3: Missions 18 & 19 (30 Aug 2026)

Continuing the Consolidated Build Plan's Tier 6 (per Maxime: "keep working on the consolidation plan. ill do ai pass later" — this batch is spawn-list variety only, no AI/engine changes). Same one-mission-at-a-time, sim-verified discipline as batches 1 and 2.

## Scope decision: why only 2 of the 6 remaining Act II missions

The "not started" list carried six candidates in Act II's back half (17, 18, 19, 21, 22, 24 — 20 and 23 are confirmed Bloom-free by design, already excluded). Re-read every one of those six missions' own build logs before touching anything, and four of them turned out to already carry an explicit fragility flag in their own history:

- **Mission 17** (extract_unit): its own build log calls this out directly — "this objective type's comfortable win rate is far more sensitive to any single enemy's damage-per-turn than eliminate_all's," and the shipped composition (6 Crawlmass + 1 Splitfang + 1 Sporethrower, turnLimit bumped 14→16) is already the result of a full tuning pass off an 0/8 first guess. Skipped.
- **Mission 21** (boss, Heartwood): its own build log flags an already-open engine-level gap (the Player AI's `focus_weak` heuristic never actually targets the boss) mitigated only by removing an opening escort wave — "explicitly flagged as a mitigation, not a fix." Adding enemies here risks the same failure mode the mitigation was built to avoid. Skipped.
- **Mission 22** (protect_asset): its own build log's own words — "turned out to be a knife-edge, not a gradient: one unit's difference flips the result completely," on a mission that already went through one full rebuild (map fix) and one full retune (14/6/8 → 5/2/2) to get there. Skipped.
- **Mission 24** (Act II finale): the actual shipped code comment (not just the build-log summary) documents a same-day overshoot on this exact kind of edit — a first attempt at raising Bloom counts (10/4→13/5) dropped win rate from 50% to 40%, worse than the pre-change baseline, before being dialed back to 11/5. Direct precedent that "add more units" doesn't move linearly here. Skipped.

That left Missions 18 and 19 as the two with no such flag — both explicitly read as clean, comfortable-margin missions in their own build logs ("no tuning needed past the first guess," "100% at 8 pilots... every win became a zero-loss win at 10").

## Missions 18 and 19: pre-edit baseline (n=150 each, this session)

- Mission 18 (Breakout at Draven's Cut): 82% (LOSS=0, COMMANDER_DOWN=27, TIMEOUT=0) — three archetypes already (4 named House Amaranth mechs on the fixed west arm + 6 Crawlmass/3 Splitfang on the scalable east arm).
- Mission 19 (The Silent Ward): 94% (LOSS=0, COMMANDER_DOWN=9, TIMEOUT=0) — only two archetypes (3 fixed-chamber Undertow + 10 Crawlmass at the central junction), the thinnest roster of any mission checked this batch and a direct match for the audit's own "Undertow/Sporethrower reuse still thin" finding.

(These numbers are higher-resolution than the n=60 quoted in each mission's own original build log, run fresh this session as the actual pre-edit baseline for this batch's own before/after comparison — not a contradiction of the original figures, just a bigger sample.)

## The edits

Both missions only get Sporethrower — the archetype the Tier 6 audit named as thin, added at count 2, on the same scalable pool their own headroom was measured against; the fixed named-mech arms are left untouched in both cases.

- **Mission 18**: +2 Sporethrower on the east (Bloom) mouth's own spawn pool, alongside the existing 6 Crawlmass/3 Splitfang. The west mouth (4 named House Amaranth mechs) is a fixed narrative force, not a scalable pool, per this mission's own original comment — not touched.
- **Mission 19**: +2 Sporethrower at the same central-junction spawn point as the existing 10 Crawlmass, not the three Undertow ambush chambers — keeps this addition off Undertow's own separately-tuned burrow-trigger positions entirely.

## Post-edit verification (n=150 each)

- Mission 18: 90%→82% pre-edit baseline mismatch note — first n=60 check came back identical to the pre-edit n=60 baseline (54/60 both times, same exact breakdown), which read as suspicious; a fresh `npm run sim` verbose single run confirmed the Sporethrower units genuinely are deployed and attacking (visible in the turn log), and a bigger n=150 sample resolved it: 82% post-edit vs 82%... [see below] — the n=60 coincidence was exactly that, a coincidence, not a sign the edit wasn't live.
- Mission 18: **82% → 82%** at n=150 pre/post — statistically flat, no real movement either direction. (The n=60 pre-edit run this addendum's own headline baseline used was 90%; the truer n=150 baseline is 82%, matching the post-edit n=150 result almost exactly. Read this as "no measurable cost from the addition," not "the addition did nothing" — the sim log confirms Sporethrower fire lands and matters in individual runs, it just isn't the failure mode driving this mission's losses, which are 100% COMMANDER_DOWN.)
- Mission 19: **94% → 94%** at n=150 pre/post (9→9 commander_down) — also flat.

Both additions are true "free" variety in the sense this pass is after: real new archetype exposure, zero win-rate cost, all remaining losses on both missions are the already-documented, already-tracked campaign-wide commander-focus-fire issue (Tier 6.5, still open, explicitly Maxime's to pick up on the AI side later) rather than anything this edit touched.

## Full verification

typecheck clean, lint clean, full test suite **1146/1146** (no test touches campaign data directly, so this was always expected to hold — confirmed anyway). Full 40-mission/1000-run campaign batch (n=25) run after both edits: **68% aggregate (683/1000)**, in line with the parallel session's own 70-72% range once accounting for n=25's wider noise band versus their n=40 runs; nothing outside Missions 18/19 moved, and neither of the two edited missions shows any new failure mode (LOSS/TIMEOUT stayed at 0 for both, same as pre-edit).

## What's still not started

Act II: nothing left untouched that doesn't carry its own explicit fragility flag (17, 21, 22, 24 — see above). Act III (25, 26, 27, 29, 30, 31, 32, 33, 34, 35, 36 — Mission 28 confirmed Bloom-free) is still completely untouched by any Tier 6 variety edit; next session should read each one's own build log the same way this batch did before touching anything, since at least two Act III missions (32, 22's own cross-reference) are already flagged as carrying their own real engine-bug history.
