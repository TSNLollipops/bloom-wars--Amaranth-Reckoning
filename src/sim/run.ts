// src/sim/run.ts
// Headless mission harness — Build Brief step 9. Runs a full mission with
// both sides on AI, no renderer, printing a turn log. `npm run sim -- mission_1a`
//
// Player side now autoplays with the Player AI engine (src/sim/playerAi/)
// instead of the real hostile-AI tiers (Maxime, 22 Aug 2026). Reusing
// decideHostileAction for both sides stopped working once engine/ai.ts's
// reflexive/pack tiers got vision-gated — a fully blind reflexive bot just
// stands at deploy forever on maps where the first wave starts outside
// anyone's vision (Mission 1a). The Player AI engine is a heuristic "decent
// test dummy" built to keep this harness actually reaching a result — see
// that module's own header (src/sim/playerAi/index.ts) for what it does
// and deliberately doesn't do.
//
// Per-unit action loop (25 Aug 2026, part of the same pass that taught the
// engine to repair): a unit gets re-asked for a decision as long as it
// still has actions left AND its last decision was a repair. Every other
// decision shape (attack, retreat, seek_fight, hold) either already
// consumes every remaining action (attack) or is deliberately left as the
// unit's one thing for the turn (see playerAi/index.ts's retreat-gate
// comment for why re-deciding after a pure move risks undoing it) — repair
// is the one case where "heal, then still have an action left to fight or
// move" is both safe to re-evaluate and exactly what a real Munti would
// do. guard caps this at 4 sub-decisions per unit per turn as a backstop,
// not because 4 is a meaningful number.
//
// Extended 25 Aug 2026 (Phase 1 of the objective-awareness pass — see
// playerAi/index.ts's own header) to also re-ask after decision.action:
// clearBloom() and rescueUnit() share repairUnit's exact "costs 1 action,
// does not end the turn" contract (both functions' own doc comments say so
// explicitly), so a Munti that just cleared bloom_mat, or a unit that just
// picked up the rescue, should get the same shot at a follow-up move/attack
// a healer already gets.
//
// decidePlayerAiAction's new 5th argument, `m` itself, satisfies
// PlayerAiMissionContext structurally — Mission already exposes exactly the
// nested shape that type asks for (mission.objective, mission.map.holdZone,
// etc.), so no adapter object is built here; see that type's own comment
// in sim/playerAi/types.ts.
//
// Pass --ai-log (optionally --ai-log=path.json) to also dump every
// decision the test player AI made this run as JSON — useful for eyeballing
// *why* a run went the way it did, and per Maxime, a starting point if any
// of this gets reused for multiplayer-map bot opponents later.
import { ALL_MISSIONS_BY_ID as MISSIONS_BY_ID } from "../data/allCampaigns";
import { Mission } from "../engine/mission";
import { decidePlayerAiAction, resetPlayerAiLog, playerAiLog, type PlayerAiReason } from "./playerAi";
import { writeFileSync } from "node:fs";

const missionId = process.argv[2] ?? "mission_1a";
const aiLogArg = process.argv.find((a) => a === "--ai-log" || a.startsWith("--ai-log="));
const aiLogPath = aiLogArg ? (aiLogArg.includes("=") ? aiLogArg.split("=")[1] : `${missionId}_ai_log.json`) : null;

const mission = MISSIONS_BY_ID[missionId];
if (!mission) {
  console.error(`Unknown mission id: ${missionId}. Known: ${Object.keys(MISSIONS_BY_ID).join(", ")}`);
  process.exit(1);
}

resetPlayerAiLog();

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
    let subGuard = 0;
    while (unit.actionsRemaining > 0 && subGuard < 4) {
      subGuard += 1;
      const decision = decidePlayerAiAction(m.map, unit, m.units, m.turn, m);
      if (decision.path && decision.path.length > 1) {
        m.moveUnit(unit.instanceId, decision.path[decision.path.length - 1]);
      }
      const repeatable = Boolean(decision.repairTargetId) || Boolean(decision.action);
      if (decision.repairTargetId) m.repairUnit(unit.instanceId, decision.repairTargetId);
      if (decision.attackTargetId) m.attack(unit.instanceId, decision.attackTargetId);
      // action dispatch (25 Aug 2026, Phase 1) — the only two verbs
      // decidePlayerAiAction can return today; see playerAi/types.ts's own
      // comment on PlayerAiDecision.action for why more aren't here yet.
      if (decision.action === "clear_bloom") m.clearBloom(unit.instanceId);
      if (decision.action === "rescue") {
        // Exactly one rescuable NPC ever exists on a mission at a time
        // (BonusObjective's own comment: "a mission carries at most one
        // bonusObjective") — decidePlayerAiAction doesn't need to name
        // which one, this is the only candidate there ever is.
        const npc = m.units.find((u) => u.npcIncapacitated);
        if (npc) m.rescueUnit(unit.instanceId, npc.instanceId);
      }
      // Screen (25 Aug 2026, same pass as use_screen in playerAi/index.ts) —
      // screenAllies() re-validates canScreen itself, same belt-and-braces
      // pattern as clearBloom/rescueUnit above.
      if (decision.action === "screen") m.screenAllies(unit.instanceId);
      // Guard Taunt (30 Aug 2026, Player AI hardening pass) — taunt()
      // re-validates canTaunt itself, same belt-and-braces pattern as the
      // three verbs above; ends the unit's turn (actionsRemaining -> 0)
      // same as Ambush/Interdict, so the sub-decision loop's own
      // actionsRemaining check below naturally stops re-asking after this.
      if (decision.action === "taunt") m.taunt(unit.instanceId);
      if (m.outcome !== "ongoing" || unit.downed) break;
      if (!repeatable) break; // see the header comment above for why only these earn another sub-decision
    }
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
if (m.permanentLosses.length) {
  // Campaign-persistence pass (engine/campaignState.ts) — per-mission
  // signal only; nothing here actually touches a saved CampaignState. See
  // Mission.permanentLosses's own comment in engine/mission.ts.
  console.log(`Permanent losses (no living Munti at time of downing): ${m.permanentLosses.map((l) => l.pilotId).join(", ")}`);
}

// Compact summary of what the test player AI actually did, always printed —
// a quick read on whether units mostly fought, mostly chased, mostly ran,
// or (25 Aug 2026) mostly patched each other up.
const counts: Record<PlayerAiReason, number> = {
  kill: 0,
  repair_critical_ally: 0,
  repair_ally: 0,
  clear_bloom: 0,
  use_screen: 0,
  guard_taunt: 0,
  focus_weak: 0,
  advance_into_range: 0,
  seek_rescue: 0,
  rescue_pickup: 0,
  rescue_carry: 0,
  hold_zone: 0,
  extract_to_exit: 0,
  escort_to_exit: 0,
  seek_fight: 0,
  regroup_low_hp: 0,
  retreat_low_hp: 0,
  hold_cornered: 0,
  hold_no_target: 0,
};
for (const entry of playerAiLog) counts[entry.reason] += 1;
console.log("");
console.log(`Player AI decisions (${playerAiLog.length} total): ${Object.entries(counts)
  .filter(([, n]) => n > 0)
  .map(([reason, n]) => `${reason}=${n}`)
  .join(", ")}`);

if (aiLogPath) {
  writeFileSync(aiLogPath, JSON.stringify(playerAiLog, null, 2));
  console.log(`Full AI decision log written to ${aiLogPath}`);
}
