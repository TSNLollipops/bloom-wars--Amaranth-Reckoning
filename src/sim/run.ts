// src/sim/run.ts
// Headless mission harness — Build Brief step 9. Runs a full mission with
// both sides on AI, no renderer, printing a turn log. `npm run sim -- mission_1a`
import { MISSIONS_BY_ID } from "../data/campaign";
import { Mission } from "../engine/mission";
import { decideHostileAction } from "../engine/ai";

const missionId = process.argv[2] ?? "mission_1a";
const mission = MISSIONS_BY_ID[missionId];
if (!mission) {
  console.error(`Unknown mission id: ${missionId}. Known: ${Object.keys(MISSIONS_BY_ID).join(", ")}`);
  process.exit(1);
}

const m = new Mission(mission);
console.log(`=== ${mission.displayName} ===`);
console.log(mission.briefing);
console.log("");

let guard = 0;
while (m.outcome === "ongoing" && guard < 500) {
  guard += 1;
  // Autoplay the player side with the same reflexive/pack/emergent
  // machinery the hostile AI uses (ai.ts is symmetric) — good enough to
  // prove the engine runs a mission to completion without a human.
  for (const unit of m.livingUnits().filter((u) => u.side === "player")) {
    if (unit.downed || unit.actionsRemaining <= 0) continue;
    const decision = decideHostileAction(m.map, unit, m.units);
    if (decision.path && decision.path.length > 1) {
      m.moveUnit(unit.instanceId, decision.path[decision.path.length - 1]);
    }
    if (decision.attackTargetId) m.attack(unit.instanceId, decision.attackTargetId);
    if (m.outcome !== "ongoing") break;
  }
  if (m.outcome !== "ongoing") break;
  m.endPlayerTurn();
}

for (const line of m.log) console.log(line);
console.log("");
console.log(`RESULT: ${m.outcome.toUpperCase()} on turn ${m.turn} (guard iterations: ${guard})`);
if (m.removedFromRoster.length) {
  console.log(`Removed from roster: ${m.removedFromRoster.join(", ")}`);
}
