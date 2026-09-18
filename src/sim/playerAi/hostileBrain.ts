// src/sim/playerAi/hostileBrain.ts
// The Player AI driving the HOSTILE side (17 Sep 2026, Player Bot Reuse
// Plan §2b — "E-lite"). Plugs into engine/mission.ts through
// MissionOptions.hostileBrain (engine/ai.ts's HostileBrain type), so the
// engine never imports anything from sim/.
//
// What it is: the same decidePlayerAiAction the headless harness uses for
// the player's squad, pointed at the other side. What it is NOT: a
// symmetric rules engine. The engine only lets the player's side use
// abilities (27 player-only checks in mission.ts), so a bot-driven hostile
// moves and attacks and nothing else. That's why the profile below has
// every ability switched off — asking for one the engine would refuse
// would just waste the unit's turn. Making enemies use abilities is E-full
// (§6 of the plan), not this.
//
// It also plays no objective. The mission's objective is the player's
// ("hold this zone", "extract this pilot"); handing that to the enemy side
// would have it try to hold the player's zone. The enemy side sees a plain
// eliminate_all board. Objective play for hostiles is the Smarter Squad AI
// plan's Track B.
//
// Two more differences from the player-side driver (sim/driveMission.ts):
//   - No oracle. The oracle asks decideHostileAction what the enemy would
//     do; for this side the enemy is the player, which that function
//     doesn't model (engine/threat.ts predictedFocus).
//   - No role-ordered turn. Mission.runHostileTurn walks hostiles in
//     roster order and asks each once; this brain can't reorder them. It
//     does reset its per-turn squad memory when the turn number changes.
import type { MapDefinition } from "../../data/types";
import type { AiDecision, HostileBrain } from "../../engine/ai";
import type { BattleUnit } from "../../engine/units";
import { decidePlayerAiAction } from "./index";
import { needsFrontLineProtection } from "./combat";
import { profileForTier, type PlayerAiProfile } from "./profile";
import { createPlayerAiMemory, type PlayerAiMissionContext, type PlayerAiTier } from "./types";

export interface BotHostileBrainOptions {
  /** Which Player AI tier plays the hostile side. Default "moderate". */
  tier?: PlayerAiTier;
  /** Random source for the bot's own choices (Easy's mistakes). Pass the mission's seeded rng to keep a run replayable. */
  rng?: () => number;
  /** Which hostiles the bot takes over. Default: mechs only — the Bloom keep their own reflexive/pack/emergent brains. */
  controls?: (unit: BattleUnit) => boolean;
}

/** A hostile is a mech (not a Bloom creature, not a civilian, not a rescuable NPC). */
export function isHostileMech(unit: BattleUnit): boolean {
  return unit.side === "hostile" && unit.kind !== "bloom" && !unit.isCivilian && !unit.npcIncapacitated;
}

/** The profile a bot-driven hostile plays with: the chosen tier, no abilities (the engine refuses them for this side), no oracle. */
export function hostileSideProfile(tier: PlayerAiTier = "moderate"): PlayerAiProfile {
  const base = profileForTier(tier);
  return { ...base, useAbilities: {}, hostileOracle: false };
}

/** The board as the enemy side reads it: a plain fight, none of the player's objective tiles. */
const NEUTRAL_CONTEXT: PlayerAiMissionContext = {
  mission: { objective: "eliminate_all", objectiveParams: {} },
  map: {},
};

export function createBotHostileBrain(options: BotHostileBrainOptions = {}): HostileBrain {
  const profile = hostileSideProfile(options.tier ?? "moderate");
  const memory = createPlayerAiMemory(options.rng ?? Math.random, "hostile");
  const controls = options.controls ?? isHostileMech;
  let memoryTurn = -1;

  return (map: MapDefinition, unit: BattleUnit, allUnits: BattleUnit[], turn: number): AiDecision | undefined => {
    if (!controls(unit)) return undefined;
    if (turn !== memoryTurn) {
      // A new hostile phase: forget last phase's planned tiles, and mark
      // this side's VIPs (a hostile Munti, say) as not-yet-decided, the way
      // driveMission does for the player's squad.
      memoryTurn = turn;
      memory.plannedPositions.clear();
      memory.pendingVips = new Set(allUnits.filter((u) => !u.downed && controls(u) && needsFrontLineProtection(u)).map((u) => u.instanceId));
    }
    memory.pendingVips.delete(unit.instanceId);
    const decision = decidePlayerAiAction(map, unit, allUnits, turn, NEUTRAL_CONTEXT, profile, memory);
    if (decision.path && decision.path.length > 1) memory.plannedPositions.set(unit.instanceId, decision.path[decision.path.length - 1]);
    // Only a move and an attack can be applied to a hostile. Anything else
    // the bot asks for (it shouldn't, with abilities off) reads as a hold.
    return { path: decision.path, attackTargetId: decision.attackTargetId };
  };
}
