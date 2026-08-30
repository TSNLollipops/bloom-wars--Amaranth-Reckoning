// src/sim/runBatch.ts
// Batch balance harness — Tier 0 (Consolidated Build Plan, 30 Aug 2026):
// "once [the Player AI fix] lands, re-run npm run sim across all 36
// existing Warden Company missions... treat the whole campaign's sim
// baseline as provisional until it's re-run post-fix." `npm run sim`
// (run.ts) only ever runs one mission once — there was no existing way to
// get an actual win-RATE across many runs, which is what a provisional
// baseline needs (MEEPS_DODGE_CHANCE and the Bloom on-hit-effects engine
// both roll real randomness, so a single run is one sample, not a rate).
// This is that harness: the exact same per-unit action loop run.ts uses
// (kept in sync by eye, not by import, since run.ts also prints a live
// per-mission log this doesn't need), run N times per mission, tallied by
// outcome. `npm run sim:batch -- 20` runs all 40 missions 20x each;
// `npm run sim:batch -- 20 mission_amaranth_6 mission_amaranth_20` scopes
// it to specific ids.
//
// First real use, same day this was built: verifying the Tier 0
// class-triangle target-selection fix (src/sim/playerAi/combat.ts) — see
// that file's own header and
// design/Bloom_Wars_Build_Log_Addendum_Tier0PlayerAIClassTriangle_30Aug2026.md
// for the actual before/after numbers this harness produced, including the
// one that mattered: an early version of the fix looked fine per-mission at
// n=10 and was actually a real aggregate regression (73.25% -> 67% at
// n=400), only visible once this existed to run that many samples.
import { ALL_MISSIONS_BY_ID as MISSIONS_BY_ID } from "../data/allCampaigns";
import { Mission, type MissionOutcome } from "../engine/mission";
import { decidePlayerAiAction, resetPlayerAiLog } from "./playerAi";

const N = Number(process.argv[2] ?? 10);
const onlyIds = process.argv.slice(3);
const ids = onlyIds.length ? onlyIds : Object.keys(MISSIONS_BY_ID);

type BatchOutcome = MissionOutcome | "ongoing_timeout";

function runOnce(missionId: string): BatchOutcome {
  const mission = MISSIONS_BY_ID[missionId];
  resetPlayerAiLog();
  const m = new Mission(mission);
  let guard = 0;
  while (m.outcome === "ongoing" && guard < 500) {
    guard += 1;
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
        if (decision.action === "clear_bloom") m.clearBloom(unit.instanceId);
        if (decision.action === "rescue") {
          // Same "exactly one rescuable NPC at a time" assumption run.ts's
          // own dispatch makes — see that file's own comment.
          const npc = m.units.find((u) => u.npcIncapacitated);
          if (npc) m.rescueUnit(unit.instanceId, npc.instanceId);
        }
        if (decision.action === "screen") m.screenAllies(unit.instanceId);
        if (decision.action === "taunt") m.taunt(unit.instanceId);
        if (m.outcome !== "ongoing" || unit.downed) break;
        if (!repeatable) break;
      }
      if (m.outcome !== "ongoing") break;
    }
    if (m.outcome !== "ongoing") break;
    m.endPlayerTurn();
  }
  return m.outcome === "ongoing" ? "ongoing_timeout" : m.outcome;
}

let grandWins = 0;
let grandTotal = 0;
for (const id of ids) {
  if (!MISSIONS_BY_ID[id]) {
    console.error(`Unknown mission id: ${id}. Known: ${Object.keys(MISSIONS_BY_ID).join(", ")}`);
    continue;
  }
  const tally: Record<BatchOutcome, number> = { win: 0, loss: 0, commander_down: 0, ongoing: 0, ongoing_timeout: 0 };
  for (let i = 0; i < N; i++) tally[runOnce(id)] += 1;
  grandWins += tally.win;
  grandTotal += N;
  const winPct = Math.round((tally.win / N) * 100);
  console.log(
    `${id.padEnd(20)} WIN=${tally.win}/${N} (${winPct}%)  LOSS=${tally.loss}  COMMANDER_DOWN=${tally.commander_down}  TIMEOUT=${tally.ongoing_timeout}`
  );
}
if (ids.length > 1) {
  console.log("");
  console.log(`AGGREGATE: ${grandWins}/${grandTotal} (${Math.round((grandWins / grandTotal) * 100)}%) across ${ids.length} missions`);
}
