// src/sim/run.ts
// Headless mission harness — Build Brief step 9. Runs a full mission with
// both sides on AI, no renderer, printing a turn log. `npm run sim -- mission_1a`
//
// Player side now autoplays with testPlayerAi.ts instead of the real
// hostile-AI tiers (Maxime, 22 Aug 2026). Reusing decideHostileAction for
// both sides stopped working once engine/ai.ts's reflexive/pack tiers got
// vision-gated — a fully blind reflexive bot just stands at deploy forever
// on maps where the first wave starts outside anyone's vision (Mission 1a).
// testPlayerAi.ts is a small heuristic "decent test dummy" built to keep
// this harness actually reaching a result — see that file's header for
// what it does and deliberately doesn't do.
//
// Pass --ai-log (optionally --ai-log=path.json) to also dump every
// decision the test player AI made this run as JSON — useful for eyeballing
// *why* a run went the way it did, and per Maxime, a starting point if any
// of this gets reused for multiplayer-map bot opponents later.
import { MISSIONS_BY_ID } from "../data/campaign";
import { Mission } from "../engine/mission";
import { decideTestPlayerAction, resetTestAiLog, testAiLog, type TestAiReason } from "./testPlayerAi";
import { writeFileSync } from "node:fs";

const missionId = process.argv[2] ?? "mission_1a";
const aiLogArg = process.argv.find((a) => a === "--ai-log" || a.startsWith("--ai-log="));
const aiLogPath = aiLogArg ? (aiLogArg.includes("=") ? aiLogArg.split("=")[1] : `${missionId}_ai_log.json`) : null;

const mission = MISSIONS_BY_ID[missionId];
if (!mission) {
  console.error(`Unknown mission id: ${missionId}. Known: ${Object.keys(MISSIONS_BY_ID).join(", ")}`);
  process.exit(1);
}

resetTestAiLog();

const m = new Mission(mission);
console.log(`=== ${mission.displayName} ===`);
console.log(mission.briefing);
console.log("");

let guard = 0;
while (m.outcome === "ongoing" && guard < 500) {
  guard += 1;
  // Player side: heuristic test-AI stand-in (see file header). Hostile
  // side: the real, now vision-gated, tiered AI from engine/ai.ts —
  // unchanged, this is exactly what actually plays in the game.
  for (const unit of m.livingUnits().filter((u) => u.side === "player")) {
    if (unit.downed || unit.actionsRemaining <= 0) continue;
    const decision = decideTestPlayerAction(m.map, unit, m.units, m.turn);
    if (decision.path && decision.path.length > 1) {
      m.moveUnit(unit.instanceId, decision.path[decision.path.length - 1]);
    }
    if (decision.attackTargetId) m.attack(unit.instanceId, decision.attackTargetId);
    if (m.outcome !== "ongoing") break;
  }
  if (m.outcome !== "ongoing") break;
  // endPlayerTurn() advances turn/phase and runs the hostile side's turn
  // internally (decideHostileAction, engine/ai.ts, now vision-gated) —
  // this loop only ever needed to drive the player side.
  m.endPlayerTurn();
}

for (const line of m.log) console.log(line);
console.log("");
console.log(`RESULT: ${m.outcome.toUpperCase()} on turn ${m.turn} (guard iterations: ${guard})`);
if (m.removedFromRoster.length) {
  console.log(`Removed from roster: ${m.removedFromRoster.join(", ")}`);
}

// Compact summary of what the test player AI actually did, always printed —
// a quick read on whether units mostly fought, mostly chased, or mostly ran.
const counts: Record<TestAiReason, number> = {
  kill: 0,
  focus_weak: 0,
  advance_into_range: 0,
  seek_fight: 0,
  retreat_low_hp: 0,
  hold_cornered: 0,
  hold_no_target: 0,
};
for (const entry of testAiLog) counts[entry.reason] += 1;
console.log("");
console.log(`Player AI decisions (${testAiLog.length} total): ${Object.entries(counts)
  .filter(([, n]) => n > 0)
  .map(([reason, n]) => `${reason}=${n}`)
  .join(", ")}`);

if (aiLogPath) {
  writeFileSync(aiLogPath, JSON.stringify(testAiLog, null, 2));
  console.log(`Full AI decision log written to ${aiLogPath}`);
}
