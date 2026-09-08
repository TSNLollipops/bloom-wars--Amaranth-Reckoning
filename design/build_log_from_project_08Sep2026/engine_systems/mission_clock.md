# The 12-Hour Mission Real-Time Clock

Maxime, 25 Aug: "add a clock timer to how long you take to do missions... force a failed mission if you take more than 12hour to do the mission. its lore acurate." Flagged as real new scope (per the project's own rule) before building — the key finding that shaped the design: nothing before this pass persisted a mission attempt at all, so a timer only enforced while the tab stays open wouldn't match "started this morning, back tonight." Maxime's call: persist it for real, from the beginning of save data. Cost model, also his call: no permadeath, no earnings — "forcefully recalled to ship for a dressing down by the CO." Soft mechanically, real narratively.

**Built**, `engine/campaignState.ts`'s own "9. Mission real-time clock" section:
- `CampaignState.activeMissionAttempt?: { missionId, startedAt }` — one optional field, same save blob.
- `MISSION_REAL_TIME_LIMIT_MS = 12h`, `evaluateMissionTimeout`/`applyMissionTimeout` — pure-check/mutating-apply split, mirrors `evaluatePermadeathCheck`/`applyPermadeathCheck`. Only ever clears the attempt — no roster/points/status touched.
- `scenes/TransporterPad.ts`'s BEAM DOWN stamps the attempt and saves immediately, before Battle starts — the one write that can't wait for a later "return to base" click.
- `scenes/Debrief.ts` clears the attempt unconditionally on any real resolution (win or loss).
- `scenes/Boot.ts` is the enforcement point — the one scene guaranteed to run on every fresh load. Applies a timeout if found, shows a full-screen recall notice ("Command" — Rourke's own CO, per Rank and Command), then continues to MapSelect.
- `scenes/Battle.ts`'s HUD carries a permanent "Sortie clock: Xh Ym elapsed" line — the live, in-mission half of "something soldiers keep track of," kept as a separate axis from the turn counter (turn count has no fail line per house rule #5; this one genuinely ends the mission).

**Verified** live via Playwright: BEAM DOWN'd for real, rewrote the saved timestamp to 13h in the past, reloaded — Boot caught it, cleared it, showed the correct mission name, and the mission was immediately relaunchable. 478/478 tests, clean gate.

**Still open:** the "social part" (crew banter aware of the clock — `Bloom_Wars_Crew_Banter_Phrase_Bank_v1.md` has no such category yet) is unbuilt. A tab left open and idle past 12h without ever reloading isn't separately enforced (no per-frame update loop in this codebase) — the realistic "closed the tab, came back later" case is fully covered.

Full narrative: archive, "Addendum, 25 Aug 2026: a 12-hour real-time mission clock."
