# Permadeath, the Munti Guarantee, and Commander Down

## Live permadeath (§6a)

`engine/campaignState.ts`'s `evaluatePermadeathCheck`/`applyPermadeathCheck` — a real, non-scripted roll on every downed player pilot (not the Team One vertical slice's old scripted Mission-3 wipe). `checkMuntiGuarantee` fires unconditionally on Debrief the instant the active Munti count hits zero, guaranteeing a free replacement so `canLaunchMission`'s "at least one Munti required" gate can never brick a save.

## Commander down (25 Aug 2026)

**The bug.** `evaluatePermadeathCheck`'s `PilotRecord.exemptFromPermadeath` branch (Rourke's own flag) has always existed, but all it ever did was return "not a permanent loss — standard restock." `Mission.handleDowned()` called it unconditionally and never branched further — so live play let Rourke reach 0 HP and just... restock, mission continuing normally. Directly contradicted the Independent Campaign doc's own §6a: "Rourke going to 0 HP... ends the mission attempt outright and sends the player back to the briefing screen to try again, with nothing about that attempt ever resolving, including the permadeath check itself."

**The fix.** `MissionOutcome` gained a third value, `"commander_down"`, distinct from `"win"`/`"loss"`. `Mission.handleDowned()` now checks `exemptFromPermadeath` itself, first thing — before the rescue-failure check, before `evaluatePermadeathCheck` is ever called — and short-circuits: sets `outcome = "commander_down"`, records `commanderDownPilotId` (data-driven, not hardcoded), logs, returns immediately. `applyCommanderDownAttempt(state)` (new, `campaignState.ts`) unconditionally clears `activeMissionAttempt` — same "costs nothing mechanical" shape as the mission-clock timeout (see `mission_clock.md`). `scenes/Battle.ts` draws a distinct "COMMAND DOWN" overlay (red title, same visual language as `Boot.ts`'s RECALLED notice) with a single "return to briefing" button that goes to `MapSelect` — **not** `Debrief`, so no earnings/permanent-loss/Munti-guarantee machinery ever runs for a voided attempt.

**Verified:** 7 new tests (`commanderDown.test.ts`) against a real `Mission` instance via a rigged guaranteed-kill attack (same technique as `rescuePilot.test.ts`) — confirms the short-circuit fires, isn't overwritten by a later `checkWinLoss` pass, doesn't affect other units, and that a non-exempt pilot (control: Bosk) still runs the real permadeath check. Full suite 536/536, clean typecheck/lint/build.

Full narrative: `claude/Bloom_Wars_Build_Log_Addendum_CommanderDown_25Aug2026.md` (archive).
