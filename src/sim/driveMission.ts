// src/sim/driveMission.ts
// The ONE headless mission driver (Player AI Difficulty Tiers Plan §3.2,
// 1 Sep 2026). run.ts and runBatch.ts used to each carry a hand-copied
// per-unit dispatch loop ("kept in sync by eye, not by import" — its own
// comment); every new verb had to land twice or one silently drifted.
// Both now call this. It also returns the same MissionSummary record
// (engine/missionSummary.ts) a human's Debrief writes, tagged source:
// "bot", so bot and human rows sit in one table.
//
// Per-unit action loop (25 Aug 2026 rules, unchanged): a unit is re-asked
// while it still has actions left AND its last decision was "repeatable"
// — a repair, or an action that costs 1 and continues the turn (clear
// bloom, rescue, screen, sensor sweep). Attack, overwatch, ambush,
// interdict, taunt, fire support, missile, and (5 Sep 2026) maser lance
// all end the unit's turn themselves. subGuard caps this at 4 sub-decisions
// as a backstop.
// Field Doctor (1 Sep 2026): a Munti at 0 actions whose free Repair is
// off cooldown still gets asked — the same reachability gap the Battle.ts
// UI had, closed on the bot side here.
import { Mission, type MissionOutcome } from "../engine/mission";
import type { CampaignMission } from "../data/types";
import type { DeployRosterEntry } from "../engine/mission";
import type { ReservedBayId } from "../engine/campaignState";
import { summarizeMission, type MissionSummary } from "../engine/missionSummary";
import { decidePlayerAiAction, resetPlayerAiLog, createPlayerAiMemory, MODERATE, type PlayerAiProfile, type PlayerAiMemory } from "./playerAi";
import { hardTurnOrder } from "./playerAi/hard";
import { needsFrontLineProtection } from "./playerAi/combat";
import { mulberry32 } from "./rng";

export interface DriveOptions {
  profile?: PlayerAiProfile;
  /** Integer seed → mulberry32 for both the Mission's dodge rolls and the bot's own memory.rng. Unseeded (Math.random) when omitted. */
  seed?: number;
  deployRoster?: DeployRosterEntry[];
  builtBays?: ReservedBayId[];
  /** Turn-loop cap — the old harness's `guard < 500`. */
  maxLoops?: number;
  /** Reset the module-level playerAiLog before the run (default true). */
  resetLog?: boolean;
  tag?: string;
}

export interface DriveResult {
  mission: Mission;
  outcome: MissionOutcome | "ongoing_timeout";
  loops: number;
  summary: MissionSummary;
  memory: PlayerAiMemory;
}

export function driveMission(missionDef: CampaignMission, options: DriveOptions = {}): DriveResult {
  const profile = options.profile ?? MODERATE;
  const rng = options.seed !== undefined ? mulberry32(options.seed) : Math.random;
  if (options.resetLog !== false) resetPlayerAiLog();
  const m = new Mission(missionDef, options.deployRoster, options.builtBays ?? [], { rng });
  const memory = createPlayerAiMemory(rng);
  const maxLoops = options.maxLoops ?? 500;

  const boardSignature = (): string =>
    m
      .livingUnits()
      .map((u) => `${u.instanceId}@${u.pos.x},${u.pos.y}:${u.currentHp}`)
      .join("|");
  const SQUAD_STALL_LIMIT = 2;
  // A stall is a board state seen again within the last few rounds — an
  // unchanged board (nobody moved) or a cycle (retreat, cloak, wait,
  // advance, retreat… the lone-commander loop that ran Mission 1 to the
  // 500-loop cap).
  const STALL_WINDOW = 8;
  const recentSignatures: string[] = [boardSignature()];
  let loops = 0;
  while (m.outcome === "ongoing" && loops < maxLoops) {
    loops += 1;
    memory.plannedPositions.clear();
    // Squad stall breaker: a board that hasn't changed for two full rounds
    // (nobody moved, nothing took damage — a hostile line that can't see
    // the squad, a squad holding overwatch waiting for it) gets one turn
    // with caution and hold-in-place postures suspended. Any tier can
    // stall this way; Hard's danger bars made it common enough to find
    // (Mission 1, 5/20 runs at the 500-loop cap).
    // Stays on until the board actually changes (the counter resets on a
    // fresh signature, not on the commit itself): a one-turn commit can
    // land exactly on the wrong phase of a two-turn cycle and change
    // nothing (mission_1a: the survivor's commit move ended on the same
    // tile his cautious move did).
    memory.commitThisTurn = memory.squadStallTurns >= SQUAD_STALL_LIMIT;
    // Mission rework pass (8 Sep 2026): a hold_zone past its hold turn with
    // hostiles still standing in the zone is a stall by definition — the
    // mission cannot end until they're cleared, and Hard's danger bars had
    // the squad shooting from the safe half of the ring at full-HP
    // sporethrowers on the other half until the turn limit (The Outer
    // Ring Falls, 0/30 with nobody down). Commit, the same way the stall
    // breaker above does.
    if (missionDef.objective === "hold_zone" && !memory.commitThisTurn) {
      const holdUntil = missionDef.objectiveParams.holdUntilTurn ?? missionDef.objectiveParams.turnLimit ?? 99;
      const hold = m.map.holdZone ?? [];
      if (m.turn >= holdUntil && hold.length) {
        const hostileInZone = m.livingUnits().some((u) => u.side === "hostile" && hold.some((c) => c.x === u.pos.x && c.y === u.pos.y));
        if (hostileInZone) memory.commitThisTurn = true;
      }
    }
    // Hard moves in role order (Tanks first, commander last) so the
    // commander's threat read sees the finished front line — hard.ts.
    const playerUnits = m.livingUnits().filter((u) => u.side === "player");
    const ordered = profile.threatMap ? hardTurnOrder(playerUnits) : playerUnits;
    memory.pendingVips = new Set(ordered.filter((u) => needsFrontLineProtection(u)).map((u) => u.instanceId));
    for (const unit of ordered) {
      memory.pendingVips.delete(unit.instanceId);
      if (unit.downed) continue;
      if (unit.actionsRemaining <= 0 && !m.fieldDoctorReady(unit.instanceId)) continue;
      let subGuard = 0;
      while ((unit.actionsRemaining > 0 || m.fieldDoctorReady(unit.instanceId)) && subGuard < 4) {
        subGuard += 1;
        const decision = decidePlayerAiAction(m.map, unit, m.units, m.turn, m, profile, memory);
        if (decision.path && decision.path.length > 1) {
          m.moveUnit(unit.instanceId, decision.path[decision.path.length - 1]);
          memory.plannedPositions.set(unit.instanceId, { ...unit.pos });
        }
        const repeatable = Boolean(decision.repairTargetId) || decision.action === "clear_bloom" || decision.action === "rescue" || decision.action === "recover_capsule" || decision.action === "screen" || decision.action === "sensor_sweep";
        if (decision.repairTargetId) m.repairUnit(unit.instanceId, decision.repairTargetId);
        if (decision.attackTargetId) m.attack(unit.instanceId, decision.attackTargetId);
        switch (decision.action) {
          case "clear_bloom":
            m.clearBloom(unit.instanceId);
            break;
          case "rescue": {
            // Exactly one rescuable NPC ever exists on a mission at a time
            // (BonusObjective's own comment) — no need to name which.
            const npc = m.units.find((u) => u.npcIncapacitated);
            if (npc) m.rescueUnit(unit.instanceId, npc.instanceId);
            break;
          }
          case "recover_capsule":
            if (decision.capsuleId) m.recoverCapsule(unit.instanceId, decision.capsuleId);
            break;
          case "screen":
            m.screenAllies(unit.instanceId);
            break;
          case "taunt":
            m.taunt(unit.instanceId);
            break;
          case "sensor_sweep":
            m.sensorSweep(unit.instanceId);
            break;
          case "interdict":
            m.interdict(unit.instanceId);
            break;
          case "overwatch":
            m.enterOverwatch(unit.instanceId);
            break;
          case "ambush":
            m.ambush(unit.instanceId);
            break;
          case "fire_support":
            if (decision.targetTile) m.fireSupport(unit.instanceId, decision.targetTile);
            break;
          case "missile":
            if (decision.targetTile) m.missileStrike(unit.instanceId, decision.targetTile);
            break;
          case "maser_lance":
            if (decision.targetTile) m.maserLanceStrike(unit.instanceId, decision.targetTile);
            break;
          default:
            break;
        }
        if (m.outcome !== "ongoing" || unit.downed) break;
        if (!repeatable) break;
        // A repeatable verb that the engine refused (canX said no) would
        // otherwise spin the sub-loop to its cap doing nothing; the
        // decision function's own gates make that rare, and subGuard
        // bounds it regardless.
      }
      if (m.outcome !== "ongoing") break;
    }
    if (m.outcome !== "ongoing") break;
    m.endPlayerTurn();
    const signature = boardSignature();
    memory.squadStallTurns = recentSignatures.includes(signature) ? memory.squadStallTurns + 1 : 0;
    recentSignatures.push(signature);
    if (recentSignatures.length > STALL_WINDOW) recentSignatures.shift();
  }

  const outcome: DriveResult["outcome"] = m.outcome === "ongoing" ? "ongoing_timeout" : m.outcome;
  const summary = summarizeMission(m, {
    source: "bot",
    botTier: profile.tier === "legacy" ? undefined : profile.tier,
    seed: options.seed,
    tag: options.tag ?? (profile.tier === "legacy" ? "legacy" : undefined),
    outcome: m.outcome === "ongoing" ? "loss" : undefined,
  });
  return { mission: m, outcome, loops, summary, memory };
}
