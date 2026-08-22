// src/engine/mission.ts
// The turn manager / mission orchestrator (Build Brief steps 5, 8, 9's
// consumer). Owns turn order, the environment step, mission-event wiring,
// win/loss evaluation, and is the single surface both src/sim and the
// Phaser Battle scene call into — so the rules only exist once.
import type { CampaignMission, Coord, MapDefinition, TileType } from "../data/types";
import { MAPS } from "../data/maps";
import { createPlayerUnit, createHostileMechUnit, createBloomUnit, type BattleUnit } from "./units";
import { PILOTS, MEKS, MEK_TRACK_EFFECTS } from "../data/meks";
import {
  reachableTiles,
  reconstructPath,
  chassisToMovementKind,
  coordKey,
  coordsEqual,
  chebyshevDistance,
  tileAt,
  isStraightLineCharge,
} from "./grid";
import { resolveMechAttack, resolveAttackOnBloom, bloomDamage, applyMechDamage, applyBloomDamage, tankShieldEligible } from "./combat";
import {
  MEEPS_DODGE_CHANCE,
  TANK_SHIELD_CAPACITY,
  TANK_SHIELD_REGEN_PER_TURN,
  MUNTI_REGEN_RADIUS,
  MUNTI_REGEN_PER_TURN,
  MAX_ACTIONS_PER_TURN,
} from "../data/combatTables";
import { TILES } from "../data/tiles";
import { BLOOM } from "../data/bloom";
import { decideHostileAction } from "./ai";
import {
  createEventRuntimeState,
  evaluateTurnStart,
  evaluateZoneEntered,
  evaluateUnitDowned,
  evaluateObjectiveComplete,
  type EventRuntimeState,
} from "./events";

export type MissionOutcome = "ongoing" | "win" | "loss";
export type MissionPhase = "player" | "hostile" | "environment";

export interface AttackOutcome {
  attackerId: string;
  defenderId: string;
  damage: number;
  countered: boolean;
  counterDamage?: number;
  defenderDowned: boolean;
  attackerDowned?: boolean;
  defenderDodged?: boolean; // Meeps house rule — see data/combatTables.ts MEEPS_DODGE_CHANCE
  counterDodged?: boolean;
}

/** Meeps house rule roll — true MEEPS_DODGE_CHANCE of the time, false for every non-Meeps path (or undefined path, e.g. Bloom). */
function rollMeepsDodge(unit: BattleUnit): boolean {
  return unit.path === "meeps" && Math.random() < MEEPS_DODGE_CHANCE;
}

export interface RepairOutcome {
  healerId: string;
  targetId: string;
  amount: number;
}

// Data Pack §6's abil_repair: 30 HP base, x1.25 if the Munti's own mek has
// Fieldwright as primary (x1 if secondary or absent — see MEK_TRACK_EFFECTS).
// Only player pilots carry a pilotId/mekId; hostile mechs never get a bonus.
const REPAIR_BASE_HEAL = 30;
function repairHealAmount(healer: BattleUnit): number {
  if (!healer.pilotId) return REPAIR_BASE_HEAL;
  const pilot = PILOTS.find((p) => p.id === healer.pilotId);
  const mek = pilot ? MEKS[pilot.mekId] : undefined;
  let mult = 1;
  if (mek?.primary === "fieldwright") mult = MEK_TRACK_EFFECTS.fieldwright.primary.muntiHealOutputMult;
  else if (mek?.secondary === "fieldwright") mult = MEK_TRACK_EFFECTS.fieldwright.secondary.muntiHealOutputMult;
  return Math.round(REPAIR_BASE_HEAL * mult);
}

export class Mission {
  readonly mission: CampaignMission;
  readonly map: MapDefinition;
  units: BattleUnit[] = [];
  turn = 1;
  phase: MissionPhase = "player";
  outcome: MissionOutcome = "ongoing";
  removedFromRoster: string[] = [];
  log: string[] = [];
  private eventState: EventRuntimeState = createEventRuntimeState();
  private extractedUnitId: string | null = null;

  constructor(mission: CampaignMission) {
    this.mission = mission;
    const map = MAPS[mission.mapId];
    if (!map) throw new Error(`Unknown map id: ${mission.mapId}`);
    this.map = map;
    this.deployPlayerUnits();
    this.spawnWavesForTurn(1);
    this.runTurnStartEvents();
  }

  private deployPlayerUnits(): void {
    const pads = this.map.deployZones.player;
    this.mission.playerPilotIds.forEach((pilotId, i) => {
      const pos = pads[i % pads.length];
      this.units.push(createPlayerUnit(pilotId, pos));
    });
  }

  private spawnWavesForTurn(turn: number): void {
    for (const wave of this.mission.enemyWaves) {
      if (wave.atTurn !== turn) continue;
      const spots = wave.spawnAt === "enemy_deploy" ? this.map.deployZones.enemy : wave.spawnAt;
      for (let i = 0; i < wave.count; i++) {
        const pos = spots.length ? spots[i % spots.length] : this.map.deployZones.enemy[0] ?? { x: 0, y: 0 };
        const freePos = this.findFreeAdjacent(pos);
        if (wave.archetypeId.startsWith("hostile_mech_")) {
          this.units.push(createHostileMechUnit(wave.archetypeId, freePos));
        } else {
          this.units.push(createBloomUnit(wave.archetypeId, freePos, { burrowed: !!wave.burrowed }));
        }
      }
    }
  }

  /** Spiral out from `origin` to find an unoccupied, passable-ground tile — spawn waves can list far fewer coords than units. */
  private findFreeAdjacent(origin: Coord): Coord {
    const occupied = new Set(this.units.filter((u) => !u.downed).map((u) => coordKey(u.pos)));
    if (!occupied.has(coordKey(origin))) return origin;
    for (let r = 1; r < Math.max(this.map.width, this.map.height); r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const c = { x: origin.x + dx, y: origin.y + dy };
          if (c.x < 0 || c.y < 0 || c.x >= this.map.width || c.y >= this.map.height) continue;
          if (!TILES[tileAt(this.map, c)].passableGround) continue;
          if (occupied.has(coordKey(c))) continue;
          return c;
        }
      }
    }
    return origin;
  }

  private runTurnStartEvents(): void {
    const fired = evaluateTurnStart(this.mission.events, this.turn, this.eventState);
    for (const ev of fired) this.applyEventAction(ev.action);
    this.spawnWavesForTurn(this.turn);
  }

  private applyEventAction(action: import("../data/types").MissionEvent["action"]): void {
    if (action.type === "spawn") {
      action.archetypeIds.forEach((archId, i) => {
        const pos = this.findFreeAdjacent(action.at[i] ?? action.at[0]);
        if (archId.startsWith("hostile_mech_")) {
          this.units.push(createHostileMechUnit(archId, pos));
          this.log.push(`Event: ${archId} deploys at (${pos.x},${pos.y})`);
        } else {
          this.units.push(createBloomUnit(archId, pos));
          this.log.push(`Event: ${archId} spawns at (${pos.x},${pos.y})`);
        }
      });
    } else if (action.type === "remove_from_roster") {
      for (const id of action.unitIds) {
        const u = this.units.find((x) => x.instanceId === id);
        if (u) u.downed = true;
        this.removedFromRoster.push(id);
      }
      this.log.push(`Event: extraction failure — removed from roster: ${action.unitIds.join(", ")}`);
    } else if (action.type === "dialogue") {
      this.log.push(`(dialogue) ${action.text}`);
    } else if (action.type === "reveal") {
      // No fog-of-war UI yet in this pass — no-op beyond the log.
      this.log.push(`Event: reveal at ${action.at.map((c) => `(${c.x},${c.y})`).join(" ")}`);
    }
  }

  // ---- queries -----------------------------------------------------

  livingUnits(): BattleUnit[] {
    return this.units.filter((u) => !u.downed);
  }

  unitById(id: string): BattleUnit | undefined {
    return this.units.find((u) => u.instanceId === id);
  }

  private movementKindFor(unit: BattleUnit): "bipedal" | "centauroid" | "flying" {
    if (unit.kind === "bloom" && BLOOM[unit.archetypeId]?.movementType === "flight_membrane") return "flying";
    return chassisToMovementKind(unit.chassis ?? "bipedal", false);
  }

  private occupiedSet(excludeId: string): Set<string> {
    const s = new Set<string>();
    for (const u of this.units) if (!u.downed && u.instanceId !== excludeId) s.add(coordKey(u.pos));
    return s;
  }

  getReachableTiles(unitId: string): Coord[] {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed || unit.actionsRemaining <= 0) return [];
    const reachable = reachableTiles(this.map, unit.pos, unit.moveRange, this.movementKindFor(unit), this.occupiedSet(unitId));
    return [...reachable.keys()].map((k) => {
      const [x, y] = k.split(",").map(Number);
      return { x, y };
    });
  }

  getAttackableFrom(unitId: string, from: Coord): BattleUnit[] {
    const unit = this.unitById(unitId);
    if (!unit) return [];
    const [minR, maxR] = unit.attackRange;
    return this.livingUnits().filter((t) => {
      if (t.side === unit.side) return false;
      const d = chebyshevDistance(from, t.pos);
      return d >= minR && d <= maxR;
    });
  }

  /**
   * Adjacent friendly units this unit could usefully Repair right now
   * (abil_repair, once per turn, instead of attacking). Excludes anyone
   * already at full HP — the ability doesn't forbid targeting them, but
   * there's never a real reason to, and letting the UI offer them just
   * means a stray click burns Derek's whole turn for 0 HP healed. Filtered
   * here rather than in repairUnit() itself, so the engine action stays
   * technically permissive (e.g. for a future AI healer) while the click
   * target list only ever shows targets worth clicking.
   *
   * No more once-per-turn cap (Maxime, 22 Aug 2026, two-action house rule)
   * — a healer with actions to spare can Repair a second (different) ally
   * the same turn, same as an XCOM Specialist's Medikit.
   */
  getRepairableFrom(unitId: string, from: Coord): BattleUnit[] {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed || unit.actionsRemaining <= 0) return [];
    if (!unit.abilities.includes("abil_repair")) return [];
    return this.livingUnits().filter(
      (t) =>
        t.side === unit.side &&
        t.instanceId !== unit.instanceId &&
        t.currentHp < t.maxHp &&
        chebyshevDistance(from, t.pos) === 1
    );
  }

  // ---- actions -------------------------------------------------------

  moveUnit(unitId: string, destination: Coord): boolean {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed || unit.actionsRemaining <= 0) return false;
    const reachable = reachableTiles(this.map, unit.pos, unit.moveRange, this.movementKindFor(unit), this.occupiedSet(unitId));
    const key = coordKey(destination);
    if (!reachable.has(key)) return false;

    const path = reconstructPath(reachable, destination);
    unit.chargedThisMove = unit.chassis === "centauroid" && isStraightLineCharge(this.map, path, "centauroid");
    unit.pos = destination;
    // Move costs 1 action and does not end the turn (two-action house rule,
    // Maxime, 22 Aug 2026) — a unit can move again, or still act, if it has
    // an action left.
    unit.actionsRemaining -= 1;
    this.log.push(`${unit.displayName} moves to (${destination.x},${destination.y})`);

    for (const step of path.slice(1)) {
      const fired = evaluateZoneEntered(this.mission.events, step, this.turn, this.eventState);
      for (const ev of fired) this.applyEventAction(ev.action);
    }
    return true;
  }

  attack(attackerId: string, defenderId: string): AttackOutcome | null {
    const attacker = this.unitById(attackerId);
    const defender = this.unitById(defenderId);
    if (!attacker || !defender || attacker.downed || defender.downed || attacker.actionsRemaining <= 0) return null;
    if (attacker.side === defender.side) return null;
    const d = chebyshevDistance(attacker.pos, defender.pos);
    if (d < attacker.attackRange[0] || d > attacker.attackRange[1]) return null;

    const sameSideAsAttacker = this.units.filter((u) => u.side === attacker.side);
    const sameSideAsDefender = this.units.filter((u) => u.side === defender.side);

    let outcome: AttackOutcome;
    if (attacker.kind !== "bloom" && defender.kind !== "bloom") {
      const defenderDodged = rollMeepsDodge(defender);
      const attackerDodgedCounter = rollMeepsDodge(attacker);
      const r = resolveMechAttack(
        this.map,
        attacker,
        defender,
        sameSideAsDefender,
        sameSideAsAttacker,
        attacker.chargedThisMove,
        defenderDodged,
        attackerDodgedCounter
      );
      applyMechDamage(defender, r.damage);
      if (r.countered && r.counterDamage !== undefined) applyMechDamage(attacker, r.counterDamage);
      outcome = {
        attackerId,
        defenderId,
        damage: r.damage,
        countered: r.countered,
        counterDamage: r.counterDamage,
        defenderDowned: defender.downed,
        attackerDowned: attacker.downed,
        defenderDodged: r.dodged,
        counterDodged: r.counterDodged,
      };
    } else if (attacker.kind !== "bloom" && defender.kind === "bloom") {
      const r = resolveAttackOnBloom(this.map, attacker, defender, sameSideAsDefender, attacker.chargedThisMove);
      applyBloomDamage(defender, r.damage);
      outcome = { attackerId, defenderId, damage: r.damage, countered: false, defenderDowned: defender.downed };
    } else {
      // Bloom attacking a mech-shape defender.
      const surfaced = !!attacker.burrowed; // a burrowed unit that is attacking has just surfaced this turn
      if (attacker.burrowed) attacker.burrowed = false;
      const defenderDodged = rollMeepsDodge(defender);
      const dmg = bloomDamage(attacker, defender, this.map, sameSideAsDefender, surfaced, defenderDodged);
      applyMechDamage(defender, dmg);
      outcome = { attackerId, defenderId, damage: dmg, countered: false, defenderDowned: defender.downed, defenderDodged };
    }

    // Attack always consumes every remaining action and ends the unit's
    // turn, regardless of which action slot it's used in (two-action house
    // rule, Maxime, 22 Aug 2026 — matches XCOM 2: you can heal then heal,
    // but never heal then shoot then heal again).
    attacker.actionsRemaining = 0;
    let msg = `${attacker.displayName} attacks ${defender.displayName}`;
    msg += outcome.defenderDodged ? " — DODGED (Meeps)" : ` for ${outcome.damage}`;
    if (outcome.countered) {
      msg += outcome.counterDodged ? ", counter DODGED (Meeps)" : ` (countered for ${outcome.counterDamage})`;
    }
    this.log.push(msg);

    if (outcome.defenderDowned) this.handleDowned(defender);
    if (outcome.attackerDowned) this.handleDowned(attacker);

    return outcome;
  }

  /**
   * Repair, instead of attacking: restore HP to one adjacent friendly unit.
   * Costs 1 action and does not end the turn (two-action house rule,
   * Maxime, 22 Aug 2026) — a healer with two actions free can Repair twice
   * in the same turn, on two different allies, same as an XCOM Specialist's
   * Medikit. No separate once-per-turn cap any more; actionsRemaining is
   * the only limit.
   */
  repairUnit(healerId: string, targetId: string): RepairOutcome | null {
    const healer = this.unitById(healerId);
    const target = this.unitById(targetId);
    if (!healer || !target || healer.downed || target.downed) return null;
    if (healer.actionsRemaining <= 0) return null;
    if (!healer.abilities.includes("abil_repair")) return null;
    if (healer.side !== target.side || healer.instanceId === target.instanceId) return null;
    if (chebyshevDistance(healer.pos, target.pos) !== 1) return null;

    const healAmount = repairHealAmount(healer);
    const amount = Math.max(0, Math.min(healAmount, target.maxHp - target.currentHp));
    target.currentHp += amount;
    healer.actionsRemaining -= 1;
    this.log.push(`${healer.displayName} repairs ${target.displayName} for ${amount} HP`);
    return { healerId, targetId, amount };
  }

  private handleDowned(unit: BattleUnit): void {
    this.log.push(`${unit.displayName} is downed.`);
    const fired = evaluateUnitDowned(this.mission.events, unit.instanceId, this.turn, this.eventState);
    for (const ev of fired) this.applyEventAction(ev.action);
  }

  /** Extraction objective: call when the extract-unit reaches an exit tile. */
  private checkExtraction(): void {
    if (this.mission.objective !== "extract_unit") return;
    const id = this.mission.objectiveParams.extractUnitId;
    if (!id) return;
    const unit = this.unitById(id);
    if (!unit || unit.downed || this.extractedUnitId) return;
    const exits = this.map.exitTiles ?? [];
    if (exits.some((c) => coordsEqual(c, unit.pos))) {
      this.extractedUnitId = id;
      this.log.push(`${unit.displayName} reaches the extraction tile.`);
    }
  }

  endPlayerTurn(): void {
    if (this.phase !== "player" || this.outcome !== "ongoing") return;
    this.checkExtraction();
    if (this.checkWinLoss()) return;
    this.phase = "hostile";
    this.log.push(`--- Turn ${this.turn}: hostile phase ---`);
    this.runHostileTurn();
  }

  /** Runs the full AI turn for every hostile unit, then the environment step, then advances to the next player turn. */
  runHostileTurn(): void {
    for (const unit of this.units) {
      if (unit.downed || unit.side !== "hostile") continue;
      unit.actionsRemaining = MAX_ACTIONS_PER_TURN;
      unit.chargedThisMove = false;
    }

    for (const unit of this.livingUnits().filter((u) => u.side === "hostile")) {
      if (unit.downed) continue; // may have died mid-loop
      const decision = decideHostileAction(this.map, unit, this.units);
      if (decision.path && decision.path.length > 1) {
        const dest = decision.path[decision.path.length - 1];
        unit.chargedThisMove = unit.chassis === "centauroid" && isStraightLineCharge(this.map, decision.path, "centauroid");
        unit.pos = dest;
        unit.actionsRemaining = Math.max(0, unit.actionsRemaining - 1);
        for (const step of decision.path.slice(1)) {
          const fired = evaluateZoneEntered(this.mission.events, step, this.turn, this.eventState);
          for (const ev of fired) this.applyEventAction(ev.action);
        }
      }
      if (decision.attackTargetId) {
        this.attack(unit.instanceId, decision.attackTargetId);
      }
      if (this.outcome !== "ongoing") return;
    }

    this.environmentStep();
    if (this.checkWinLoss()) return;

    this.turn += 1;
    this.phase = "player";
    for (const unit of this.units) {
      if (unit.downed) continue;
      unit.actionsRemaining = MAX_ACTIONS_PER_TURN;
      unit.chargedThisMove = false;
    }
    this.log.push(`--- Turn ${this.turn}: player phase ---`);
    this.runTurnStartEvents();
    this.checkWinLoss();
  }

  private environmentStep(): void {
    this.tickShieldRegen();
    this.tickMuntiRegen();
    for (const unit of this.livingUnits()) {
      const tile: TileType = tileAt(this.map, unit.pos);
      const def = TILES[tile];
      if (def.turnStartDamage) {
        if (unit.kind === "bloom") applyBloomDamage(unit, def.turnStartDamage);
        else applyMechDamage(unit, def.turnStartDamage);
        if (unit.downed) this.handleDowned(unit);
      }
      if (def.turnStartRepair && !unit.downed && unit.kind !== "bloom") {
        unit.currentHp = Math.min(unit.maxHp, unit.currentHp + def.turnStartRepair);
      }
    }
  }

  /**
   * Tank shield house rule (data/combatTables.ts) — once per turn, for
   * every living mech-shape unit: recompute whether it's currently in an
   * eligible Tank's radius (self included), and if it took no damage since
   * the last tick, regen its shield by TANK_SHIELD_REGEN_PER_TURN, capped
   * at TANK_SHIELD_CAPACITY. Stepping outside the radius drops shield and
   * maxShield to 0 immediately — it's borrowed from the Tank's presence,
   * not banked. Bloom-shape units are skipped; they're never on the
   * player's side and never path==="tank" either.
   */
  private tickShieldRegen(): void {
    for (const unit of this.livingUnits()) {
      if (unit.kind === "bloom") continue;
      const sameSide = this.units.filter((u) => u.side === unit.side);
      const eligible = tankShieldEligible(unit, sameSide);
      if (!eligible) {
        unit.shield = 0;
        unit.maxShield = 0;
      } else {
        unit.maxShield = TANK_SHIELD_CAPACITY;
        if (!unit.tookDamageThisCycle) {
          unit.shield = Math.min(unit.maxShield, (unit.shield ?? 0) + TANK_SHIELD_REGEN_PER_TURN);
        }
      }
      unit.tookDamageThisCycle = false;
    }
  }

  /**
   * Munti passive regen house rule (data/combatTables.ts) — once per turn,
   * every living non-Bloom unit within MUNTI_REGEN_RADIUS of a same-side,
   * non-downed Munti (itself included) heals MUNTI_REGEN_PER_TURN, capped
   * at maxHp. Doesn't consume any unit's action — it's a passive aura, on
   * top of whatever the Munti's active Repair does that turn. Multiple
   * Muntis in range don't stack.
   */
  private tickMuntiRegen(): void {
    const muntisBySide = new Map<string, BattleUnit[]>();
    for (const u of this.livingUnits()) {
      if (u.path !== "munti") continue;
      const list = muntisBySide.get(u.side) ?? [];
      list.push(u);
      muntisBySide.set(u.side, list);
    }
    if (!muntisBySide.size) return;

    for (const unit of this.livingUnits()) {
      if (unit.kind === "bloom" || unit.currentHp >= unit.maxHp) continue;
      const muntis = muntisBySide.get(unit.side);
      if (!muntis) continue;
      const inRange = muntis.some((m) => chebyshevDistance(m.pos, unit.pos) <= MUNTI_REGEN_RADIUS);
      if (inRange) unit.currentHp = Math.min(unit.maxHp, unit.currentHp + MUNTI_REGEN_PER_TURN);
    }
  }

  private checkWinLoss(): boolean {
    if (this.outcome !== "ongoing") return true;
    const turnLimit = this.mission.objectiveParams.turnLimit;
    const playerAlive = this.units.filter((u) => u.side === "player" && !u.downed);
    const hostileAlive = this.units.filter((u) => u.side === "hostile" && !u.downed);

    if (!playerAlive.length) {
      this.outcome = "loss";
      this.log.push("Loss: all player units downed.");
      return true;
    }

    if (this.mission.objective === "eliminate_all") {
      if (!hostileAlive.length) return this.finishWin();
      if (this.turn > turnLimit) {
        this.outcome = "loss";
        this.log.push("Loss: turn limit reached.");
        return true;
      }
    } else if (this.mission.objective === "hold_zone") {
      const hold = this.map.holdZone ?? [];
      const holdKeys = new Set(hold.map(coordKey));
      const playerOnHold = playerAlive.some((u) => holdKeys.has(coordKey(u.pos)));
      const hostileOnHold = hostileAlive.some((u) => holdKeys.has(coordKey(u.pos)));
      const holdUntil = this.mission.objectiveParams.holdUntilTurn ?? turnLimit;
      if (this.turn > 2 && hostileOnHold && !playerOnHold) {
        this.outcome = "loss";
        this.log.push("Loss: hostiles hold the zone.");
        return true;
      }
      if (this.turn >= holdUntil && playerOnHold && !hostileOnHold) return this.finishWin();
      if (this.turn > turnLimit) {
        this.outcome = "loss";
        this.log.push("Loss: turn limit reached without holding the zone.");
        return true;
      }
    } else if (this.mission.objective === "extract_unit") {
      const id = this.mission.objectiveParams.extractUnitId;
      const unit = id ? this.unitById(id) : undefined;
      if (unit?.downed) {
        this.outcome = "loss";
        this.log.push("Loss: the unit to extract was downed.");
        return true;
      }
      if (this.extractedUnitId) return this.finishWin();
      if (this.turn > turnLimit) {
        this.outcome = "loss";
        this.log.push("Loss: turn limit reached before extraction.");
        return true;
      }
    }
    return false;
  }

  private finishWin(): boolean {
    // Fire objective_complete events (Mission 3's scripted extraction
    // failure) BEFORE finalizing — the mission is still mechanically won;
    // the wipe is a scripted consequence layered on top, per GDD §10.4.
    const fired = evaluateObjectiveComplete(this.mission.events, this.turn, this.eventState);
    for (const ev of fired) this.applyEventAction(ev.action);
    this.outcome = "win";
    this.log.push("Win: objective complete.");
    return true;
  }
}
