# Build Log Addendum — Enemy Roam Fallback Shipped ON + "Enemy Ignore Rescue," 30 Aug 2026

Follow-up to `Bloom_Wars_Build_Log_Addendum_EnemyRoamFallback_ShippedOff_30Aug2026.md` — read that one first for the full background (what the roam fallback is, why the campaign sweep flagged it, the two specific failure modes it found).

## Maxime's call

Shown the findings directly (six missions collapsing near-0%, five via commander focus-fire, one via a broken extraction mission), his answer: *"for the commadner death, thats fine. for the rescue, make it so enemy ignore rescue. like the save the civilian mission in xcom."*

So: the commander-focus-fire concentration on `eliminate_all` missions is accepted as intended extra pressure — not a bug to re-tune away, a real design call. The `extract_unit` failure was a different thing (it broke a mission's own premise, not just its odds) and got an actual fix.

## What shipped

**`ENABLE_ENEMY_ROAM_FALLBACK` flipped back to `true`.** Same mechanism as before, now live: a reflexive/pack-tier hostile with nothing visible and no `defendZone` walks toward the player's own `deployZones.player` instead of holding forever.

**New: `BattleUnit.isExtractionTarget`** (`units.ts`). Set once, in `Mission`'s constructor (`tagExtractionTarget()`, right after `deployPlayerUnits()`), on whichever unit's `instanceId` matches `objectiveParams.extractUnitId` — the single-named-pilot `extract_unit` shape (missions 5, 10, 11, 17, 23, 26). Deliberately does **not** touch Mission 31's `civilianSpawns` shape (`isCivilian`) — that mission's own design is explicitly "real stakes, the hostile AI targets them like anyone else" (Maxime's own earlier call), a different thing from a mission-critical stranded pilot.

`engine/ai.ts` gained `isTargetableBy(unit, target)` — `!target.isExtractionTarget` — and both places a reflexive/pack-tier hostile ever builds a target list now filter through it: `visibleEnemiesOf` (feeds `reflexiveDecision` and `mechReflexiveDecision`) and `sharedPackTarget` (feeds `packDecision`). A hostile literally cannot select the extraction target as something to attack or path toward — not a vision trick, an outright exclusion, matching XCOM's own civilian rule Maxime named directly. She's still fully visible and interactable to the player, still exactly as fragile to anything the player does; only what a hostile is willing to shoot at changed. `emergentDecision` (boss tier) wasn't touched — none of the six single-target extract_unit missions have a boss on their enemyWaves, confirmed by reading the data rather than assuming.

5 new tests in `ai.test.ts` (reflexive tier ignores an adjacent extraction target with nothing else visible; still attacks a normal unit even with her also in range; roams past her toward deployZones.player rather than holding; pack tier's `sharedPackTarget` also skips her, even when she'd otherwise win "lowest HP×DEF"; a packmate's real target still wins). `abilities.test.ts`'s FOG test flipped back to expecting the roam movement (flag is live again). typecheck/lint clean, **1157/1157 tests passing.**

## Verification

`npx tsx src/sim/run.ts mission_amaranth_26` (verbose, single mission): Okafor now survives to the extraction tile — `"Sgt. Wren Okafor — 'Ledger' reaches the extraction tile." / RESULT: WIN on turn 19`. No hostile in the log ever attacks her.

Full campaign sweep, n=25, before/after this specific fix (roam fallback was already ON for both):

| Mission | Roam ON, no rescue-ignore | Roam ON + ignore rescue | Original (pre-AI-work) baseline |
|---|---|---|---|
| `mission_amaranth_5` | 8% | 4% | 32% |
| `mission_amaranth_10` | 0% | 0% | 24% |
| `mission_amaranth_11` | 100% | 100% | 100% |
| `mission_amaranth_17` | 100% | 100% | 88% |
| `mission_amaranth_23` | 80% | 92% | 76% |
| `mission_amaranth_26` | **0%** (pure LOSS, the bug) | **92%** | 100% |
| `mission_amaranth_31` | 60% | 52% | 64% |

Mission 26 is the headline result — the fix does exactly what it was built to do. Missions 11/17/23 were already healthy or improved slightly. Mission 31 (civilianSpawns, deliberately untouched) sits a bit below its original baseline, in line with the general commander-focus-fire pressure increase Maxime already accepted.

**Missions 5 and 10 are worth flagging honestly, not glossing over:** both are already-tracked, pre-existing weak spots (see the Consolidated Build Plan's "Not started" section — Mission 5's turn-limit/map-tightness question, Mission 10's undiagnosed low baseline, both flagged before today's AI work even started) and both dropped further under the added roam pressure (5: 32%→4%; 10: 24%→0%). Not a new bug — the same accepted commander-focus-fire mechanism Maxime signed off on — but it means those two missions' own dedicated re-tune, whenever it happens, now has more ground to cover than it did this morning.

Full 40-mission aggregate with both changes live: **573/1000 (57%)**, down from the original untouched 706/1000 (71%) baseline — expected and by design: Maxime explicitly accepted the harder eliminate_all missions as intended, and this aggregate blends that accepted difficulty increase with the extraction fix's own gains. Not a number to chase back toward 71% on its own; the individual missions that are now near-0% (`mission_amaranth_3, 6, 8, 10, 12, 13, 18, 24`, mostly `eliminate_all`, all `COMMANDER_DOWN`) are the actual, accepted shape of "the AI reacts now" campaign-wide, not a regression to fix.

## What's actually next

Not this pass. The honest state of the campaign right now: the AI is meaningfully more dangerous everywhere (the thing Maxime asked for), the one mission that broke outright is fixed, and a real number of `eliminate_all` missions are now much harder than they were this morning — several hard enough that they'd need their own look before calling the whole campaign "done" again, the same way Tier 6's spawn-variety batches each got their own per-mission check rather than one blanket pass. That re-tuning work is real and not small; flagging it here rather than starting it unprompted, since Maxime's own "that's fine" was about accepting the mechanism, not necessarily a green light to spend a full session re-tuning a dozen missions around it without checking in on scope first.
