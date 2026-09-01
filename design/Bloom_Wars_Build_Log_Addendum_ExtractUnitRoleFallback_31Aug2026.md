# Build Log Addendum — extract_unit Role Fallback (31 Aug 2026)

Maxime, after Mission 19 shipped: *"you shouldnt make a single nsmed chsracter the most important part of a mission. use a role. un case the player doesnt bring those npc with him or they die. dont forget other than the mc. no one is safe from perma death."* Followed by: *"if you did something similar in another mission. better fix it too."*

## A real bug, not just design taste

`objective: "extract_unit"` missions name a specific pilot in `objectiveParams.extractUnitId` (e.g. `pilot_orin`, `pilot_anand`). Checked `engine/mission.ts` directly: `tagExtractionTarget()` (constructor) tags that pilot's `BattleUnit.isExtractionTarget`, and `checkExtraction()`/`checkWinLoss()` both did `this.unitById(id)` straight off the literal configured id.

`unitById` matches on `instanceId`, and player units keep their pilot id as their `instanceId` — so this only ever worked when the named pilot was actually deployed. Two real ways they might not be: a genuine Transporter-pad squad-selection pass already exists in the engine (`Mission`'s `deployRoster` constructor arg — the player can bring a smaller or different subset than a mission's full `playerPilotIds`), and every pilot in both campaigns *except the exemptFromPermadeath commander* can be permanently lost to an earlier mission's own permadeath check. Neither case is hypothetical — this campaign's own build log this session documented real permanent losses in sim batches (Marrin, Bray, Solano, Meir, and others going down for good across Missions 17-19's own tuning runs).

If the named pilot wasn't on the board, `unitById(id)` returned `undefined`. `checkExtraction`'s own `if (!unit) return;` guard meant `extractedUnitId` could never be set — the mission's only path to a win was permanently closed. The only way out was the `turnLimit` loss branch, every single run, regardless of skill: a mathematically unwinnable mission with no error, no message, nothing — the player would just always lose it and have no way to know why. Same bug shape Battle.ts's own HUD line had already once (30 Aug 2026: *"I couldnt find out which unit need extraction so I failed the mission"*), just one level deeper — this time the extraction itself, not only its display, was broken.

## Scope: every extract_unit mission in both campaigns, one engine fix

Searched the whole objective system for this exact pattern before fixing anything — `extractUnitId` is the *only* field anywhere in `CampaignMission.objectiveParams` or `MissionEvent` triggers that hardcodes a specific pilot as mechanically load-bearing. (`bonusObjective`'s `rescue_pilot` shape takes any deployed pilot as rescuer — `canRescue(rescuerId, npcId)` isn't gated to one id. No mission anywhere uses a `unit_downed` trigger keyed to a named pilot for anything objective-relevant — Warden's own campaign file has a comment recording that this was considered and deliberately not built, for exactly this fragility reason.) So this is a single, contained bug class, and fixing it at the engine level fixes every mission that has it at once, with zero mission-data edits:

- House Amaranth (this campaign): Missions 3, 5, 7, 11, 14, 17 — all `pilot_orin`.
- Warden Company (`campaignAmaranth.ts`): `pilot_anand` (×2), `pilot_iyari`, `pilot_lask`, `pilot_solheim`, `pilot_okafor`.
- Team One (`campaign.ts`): `pilot_trav`.

## The fix

`tagExtractionTarget()`: if the configured pilot isn't on the board, the role transfers to the first living player unit in deploy order (deterministic, not random — a given squad's fallback target is always the same pilot from run to run) instead of leaving the mission unwinnable. If the named pilot **is** deployed, nothing changes — they're still the target, and losing them mid-mission is still a real loss, same stakes as before. This is deliberately Maxime's own framing: a role that transfers when the specific person isn't there, not a mission that silently breaks.

Added `resolvedExtractUnitId` (private field) / `resolvedExtractionTargetId` (public getter, same pattern as the existing `extractedCivilianCount` getter) as the one place this gets resolved. Every downstream reader now goes through it or the `isExtractionTarget` flag instead of re-deriving from the literal configured id — the exact same class of bug could otherwise resurface in the UI even with the engine fixed:

- `engine/mission.ts`: `checkExtraction()`, `checkWinLoss()`'s extract_unit branch.
- `sim/playerAi/index.ts`: both extract-unit branches (the low-hp retreat override and the "beeline for the exit" branch) now read `unit.isExtractionTarget` instead of comparing `unit.instanceId` to the literal id — otherwise the Player AI itself would never have known to send the fallback pilot toward the exit at all.
- `scenes/Battle.ts`: the on-board green ring (`drawUnit`) and the HUD "Extract:" line. The HUD one had its own real bug baked in: reading the literal id, an undeployed named pilot resolved to `target === undefined`, which the existing ternary read as `"extracted — clear"` — misleadingly showing the objective as already complete from turn 1, when nothing had happened and the real win condition could never fire.

## Verified, not just typechecked

Wrote a scratch harness (deleted after use) copying `sim/run.ts`'s own per-unit action loop, with a `deployRoster` built from Mission 17's own squad minus `pilot_orin` — simulating "didn't bring her" directly rather than trusting the fix by inspection:

```
Before conceptually possible to test (the bug): resolvedExtractUnitId didn't exist; checkExtraction's guard meant
extraction could never complete — this was true by inspection, not something that needed a batch run to confirm.

After the fix, same exclusion, mission's own turnLimit (12): WIN=0/30, LOSS=30 — a real, legible loss (turn
limit reached), not a hang or a silent "OTHER" outcome. resolvedExtractionTargetId correctly resolved to
pilot_marrow (first in deploy order) every run.

Same exclusion, turnLimit forced to 40 (isolating "is extraction mechanically possible for the fallback
target" from "is 12 turns enough for a 9-pilot squad, a separate and legitimate difficulty question"):
WIN=20/30 (67%) — genuinely winnable, the fallback target reaching the exit and banking the extraction
exactly like the named pilot would have.

Full squad including pilot_orin, unchanged: re-ran the standard n=150 batch — 75% (113/150), matching the
73-75% already documented in Mission 17's own build log, byte-for-byte the same as before this fix. The
common case (named pilot present) is provably untouched.
```

Also added `src/engine/__tests__/extractUnitFallback.test.ts` — 6 real regression tests against `HOUSE_AMARANTH_MISSION_17` covering both the unchanged path (named pilot present: tags correctly, wins on reaching an exit, still loses if downed) and the fixed path (named pilot absent: falls back to exactly one other deployed unit, is genuinely winnable, still a real loss if the fallback target itself goes down) — so this can't silently regress again.

## Verification

```
npm run typecheck   → clean
npm run lint         → clean (disposable Python-script scratch output deleted first)
npm test -- --run    → 58 files, 1192/1192 passing (6 new), zero regressions
```

## What this doesn't change

Dialogue and briefing text that names a specific pilot (Orin's "found the root structure" lines, Anand's "made contact" framing, etc.) is unaffected — that's flavor, not objective-critical, and stays exactly as written even when the fallback pilot is who's actually doing the mechanical extracting. A real narrative mismatch is possible in that edge case (briefing says "get Orin out," HUD says "Extract: Sgt. Kessler") but is a much smaller, cosmetic gap next to a mission that couldn't be won at all — flagged here rather than silently left unmentioned, not fixed this pass.
