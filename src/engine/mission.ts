// src/engine/mission.ts
// The turn manager / mission orchestrator (Build Brief steps 5, 8, 9's
// consumer). Owns turn order, the environment step, mission-event wiring,
// win/loss evaluation, and is the single surface both src/sim and the
// Phaser Battle scene call into — so the rules only exist once.
import type { CampaignMission, Coord, MapDefinition, MekArchetype, PilotRecord, TileType } from "../data/types";
import { ALL_MAPS as MAPS } from "../data/mapRegistry";
import { createPlayerUnit, createHostileMechUnit, createBloomUnit, type BattleUnit } from "./units";
import { MEK_TRACK_EFFECTS } from "../data/meks";
import { findPilot, findMek } from "../data/pilotRegistry";
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
import { evaluatePermadeathCheck } from "./campaignState";

export type MissionOutcome = "ongoing" | "win" | "loss";
export type MissionPhase = "player" | "hostile" | "environment";

/**
 * Transporter-pad squad-selection pass (22 Aug 2026, scenes/TransporterPad.ts
 * + engine/campaignState.ts's recruit system): one resolved deploy-roster
 * entry — a pilotId plus the actual PilotRecord/MekArchetype to build the
 * BattleUnit from. Mission's optional constructor param below (deployRoster)
 * is the "real interface change" the deploy-cap task called for: without
 * it, Mission can only ever deploy `mission.playerPilotIds` resolved through
 * the static, build-time data/pilotRegistry.ts — which has no way to
 * resolve a generated recruit (engine/campaignState.ts's generatePilot) at
 * all, and silently ignores any campaign-persistent tier/mek-secondary
 * purchase on a named pilot too. Passing a caller-resolved roster (the
 * transporter pad's own CampaignState read, threaded through
 * scenes/Battle.ts) fixes both at once.
 */
export interface DeployRosterEntry {
  pilotId: string;
  pilot: PilotRecord;
  mek?: MekArchetype;
}

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

// Campaign economy pass (22 Aug 2026, engine/campaignEconomy.ts):
// per-pilot performance tracking, added to Mission itself since nothing
// tracked anything per-unit before this pass — only mission-wide outcome
// (win/loss) existed. Keyed by pilotId, which for a player unit is always
// identical to its instanceId (units.ts createPlayerUnit's own comment:
// "pilots keep their stable roster id on the board"), so no separate
// instanceId->pilotId resolution is needed.
export interface UnitPerformance {
  damageDealt: number; // raw HP/Endurance-and-Vitality chipped off — kept for UI/telemetry only, NOT a scoring input (see ASSIST_MIN_FRACTION's comment below)
  kills: number; // finishing blows credited — see recordPerformance() below for exactly what counts
  assistCredit: number; // fractional kill-equivalents from assists this mission, summed across events — see recordContribution()/resolveKill()/repairUnit() below
  wasDowned: boolean; // true the instant this pilot is ever downed, latched for the rest of the mission
}

// Point-formula correction (Maxime, 22 Aug 2026, reading
// Qiraki_Weapons_And_Progression.md's "Scoring system, LOCKED" section for
// the first time against the economy pass above): the canonical rule is
// "an individual's score inside a mission is kills plus assists combined.
// An assist is worth a fraction of a full kill, roughly 10% to 50%
// depending on the actual weight of the action, not a flat half-credit."
// No damage-dealt term exists anywhere in that locked rule — for ANY
// target, not just Bloom — which lines up with Maxime's own note that
// Bloom targets don't have a conventional damage-depletable life pool in
// the books' fiction (they die via discrete destruction of their physical
// form, not gradual damage accumulation), so a "chip away HP for points"
// mechanic never corresponded to anything the source material actually
// does. engine/campaignEconomy.ts's old DAMAGE_POINTS_DIVISOR term is
// removed this pass; damageDealt itself stays on UnitPerformance (useful
// for a future "biggest hit" UI stat) but is never read by the points
// formula again.
//
// The exact mapping from "weight of the action" to a fraction inside the
// 10%-50% band isn't specified in the doc, so the two rules below are
// Maxime's own judgment call, flagged the same way DAMAGE_POINTS_DIVISOR
// used to be:
//   - A COMBAT assist (you damaged a hostile that someone else landed the
//     finishing blow on) scales linearly across the band by your share of
//     the total damage the whole squad dealt to that specific victim —
//     tap it once before someone else does the real work, ~10%; do most
//     of the softening and hand the kill to a teammate, closer to 50%.
//     See resolveKill() below.
//   - A REPAIR assist (the doc's own example: "healing/repair actions
//     count as assists," named as its own flat category rather than tied
//     to a contribution share) is a flat mid-band fraction per successful
//     repair action, not scaled by heal amount — the doc ties "weight of
//     the action" to combat contribution specifically, not to how many HP
//     a given repair restored. See repairUnit() below.
// A Munti's disintegrator weapon (the doc: "their disintegrator weapon...
// earns kill-adjacent credit on purge missions") needs no special-case
// code at all — it's just their attack, already routed through the same
// attack()/recordPerformance() path as every other weapon, so it already
// earns kills/combat-assists exactly like anyone else's hits do.
export const ASSIST_MIN_FRACTION = 0.1;
export const ASSIST_MAX_FRACTION = 0.5;
export const REPAIR_ASSIST_FRACTION = 0.25;

// Data Pack §6's abil_repair: 30 HP base, x1.25 if the Munti's own mek has
// Fieldwright as primary (x1 if secondary or absent — see MEK_TRACK_EFFECTS).
// Only player pilots carry a pilotId/mekId; hostile mechs never get a bonus.
const REPAIR_BASE_HEAL = 30;
function repairHealAmount(healer: BattleUnit): number {
  if (!healer.pilotId) return REPAIR_BASE_HEAL;
  const pilot = findPilot(healer.pilotId);
  const mek = pilot ? findMek(pilot.mekId) : undefined;
  let mult = 1;
  if (mek?.primary === "fieldwright") mult = MEK_TRACK_EFFECTS.fieldwright.primary.muntiHealOutputMult;
  else if (mek?.secondary === "fieldwright") mult = MEK_TRACK_EFFECTS.fieldwright.secondary.muntiHealOutputMult;
  return Math.round(REPAIR_BASE_HEAL * mult);
}

export class Mission {
  readonly mission: CampaignMission;
  readonly map: MapDefinition;
  // Transporter-pad squad-selection pass: who actually deployed this
  // mission. Equal to `mission.playerPilotIds` whenever the constructor's
  // optional `deployRoster` arg is omitted (every existing call site —
  // tests, npm run sim, and scenes/Battle.ts's own no-selection fallback),
  // so nothing downstream that already reads this shape breaks. Once a
  // real DeployRosterEntry[] is passed in, this is the player's real,
  // possibly-smaller-or-reordered selection instead. engine/campaignEconomy.ts
  // reads THIS field, not mission.playerPilotIds directly, for computing
  // personal earnings / the Rourke CO bonus — see that file's own notes.
  readonly deployedPilotIds: string[];
  private readonly deployRoster?: DeployRosterEntry[];
  units: BattleUnit[] = [];
  turn = 1;
  phase: MissionPhase = "player";
  outcome: MissionOutcome = "ongoing";
  removedFromRoster: string[] = [];
  // Campaign-persistence pass (engine/campaignState.ts): pilotIds the live
  // Munti-presence permadeath check ruled un-restockable at the moment
  // they went down this mission — "if there a muntie there is restock. no
  // munties no restock," checked fresh at each downing, not a one-way
  // flag. Mirrors removedFromRoster's shape deliberately: both are
  // per-mission signals a future debrief screen reads and applies to the
  // persistent CampaignState (applyPermadeathCheck / the pilot's status
  // field) after the mission ends — this array only records *which*
  // pilots and *why*; it does not itself touch any campaign save data,
  // since Mission has no CampaignState reference and isn't meant to.
  permanentLosses: { pilotId: string; reason: string }[] = [];
  // Campaign economy pass — see UnitPerformance's own comment above.
  // Seeded with a zeroed entry for every deployed pilot in
  // deployPlayerUnits() below, so a pilot who does nothing all mission
  // (never attacks, never gets touched) still resolves cleanly to a
  // present, zeroed record rather than an undefined lookup for whoever
  // reads this after the mission ends (engine/campaignEconomy.ts's
  // computeMissionEarnings).
  unitPerformance: Record<string, UnitPerformance> = {};
  // Per-victim damage contribution this mission — victim BattleUnit
  // instanceId -> (pilotId -> total damage that pilot dealt to it so far).
  // Written by recordContribution(), read and cleared by resolveKill() the
  // moment that victim actually goes down; a victim who's damaged but
  // survives to mission end just keeps an unresolved bucket here, which is
  // correct — no kill happened, so nobody's owed a kill OR an assist for
  // it. See ASSIST_MIN_FRACTION's comment above for why this exists.
  private victimContributions: Record<string, Record<string, number>> = {};
  log: string[] = [];
  private eventState: EventRuntimeState = createEventRuntimeState();
  private extractedUnitId: string | null = null;

  constructor(mission: CampaignMission, deployRoster?: DeployRosterEntry[]) {
    this.mission = mission;
    const map = MAPS[mission.mapId];
    if (!map) throw new Error(`Unknown map id: ${mission.mapId}`);
    this.map = map;
    this.deployRoster = deployRoster;
    this.deployedPilotIds = deployRoster ? deployRoster.map((e) => e.pilotId) : [...mission.playerPilotIds];
    this.deployPlayerUnits();
    this.spawnWavesForTurn(1);
    this.runTurnStartEvents();
  }

  private deployPlayerUnits(): void {
    const pads = this.map.deployZones.player;
    if (this.deployRoster) {
      // Real selection path (scenes/TransporterPad.ts via scenes/Battle.ts):
      // build every unit from the caller-resolved PilotRecord/MekArchetype
      // directly, not by re-resolving `entry.pilotId` through the static
      // pilotRegistry — see createPlayerUnit's own `overrides` doc comment
      // (engine/units.ts) for why that distinction matters for a generated
      // recruit.
      this.deployRoster.forEach((entry, i) => {
        const pos = pads[i % pads.length];
        this.units.push(createPlayerUnit(entry.pilotId, pos, { pilot: entry.pilot, mek: entry.mek }));
        this.unitPerformance[entry.pilotId] = { damageDealt: 0, kills: 0, assistCredit: 0, wasDowned: false };
      });
      return;
    }
    // Old, no-selection path — unchanged: every test, npm run sim, and any
    // future direct `new Mission(missionDef)` call still resolves purely
    // through the static, build-time roster/registry.
    this.mission.playerPilotIds.forEach((pilotId, i) => {
      const pos = pads[i % pads.length];
      this.units.push(createPlayerUnit(pilotId, pos));
      this.unitPerformance[pilotId] = { damageDealt: 0, kills: 0, assistCredit: 0, wasDowned: false };
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

    this.recordPerformance(attacker, defender, outcome);

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
   * Campaign economy pass — bookkeeping only, no effect on combat math or
   * outcomes: reads the already-computed AttackOutcome and credits
   * damage/kills to whichever pilot's mek actually dealt each portion of
   * it. Called once per attack() resolution, after `outcome` is built and
   * before the two damage-application calls above have any further
   * consequence, so it works identically across all three attack
   * branches (mech-vs-mech, mech-vs-bloom, bloom-vs-mech) without needing
   * branch-specific logic — every branch already funnels into the same
   * AttackOutcome shape.
   *
   * Two credited categories, deliberately not just one:
   *   - `attacker`'s primary hit (outcome.damage / outcome.defenderDowned).
   *   - `defender`'s own counter-hit back (outcome.counterDamage /
   *     outcome.attackerDowned), when the defender is the one who
   *     survived and countered. Judgment call, not spelled out in the
   *     brief's formula: a counter is the defender's OWN mek acting, not
   *     the attacker's, so it's credited to the defender, separately from
   *     the primary hit — excluding counter damage entirely would
   *     arbitrarily punish counter-built pilots (Tanks especially) for
   *     doing exactly what their kit is for. A "kill" via counter (the
   *     defender's counter-hit is what actually downs the original
   *     hostile attacker) counts the same as a kill via a direct attack.
   *
   * Only ever credits player pilots (creditDamage/creditKill no-op on an
   * undefined pilotId) — hostile mechs and Bloom have none, so this never
   * needs a side check of its own; the pilotId lookup already does it.
   *
   * Contribution tracking (recordContribution/resolveKill, added alongside
   * assistCredit — see ASSIST_MIN_FRACTION's comment above) is gated on
   * `defender.side === "hostile"` / `attacker.side === "hostile"`,
   * mirroring creditKill's own existing gate exactly: a "victim" only
   * needs a contribution bucket at all if it's possible for it to resolve
   * into a kill, and only a hostile can ever be killed here.
   */
  private recordPerformance(attacker: BattleUnit, defender: BattleUnit, outcome: AttackOutcome): void {
    this.creditDamage(attacker.pilotId, outcome.damage);
    if (defender.side === "hostile") {
      this.recordContribution(defender.instanceId, attacker.pilotId, outcome.damage);
      if (outcome.defenderDowned) this.resolveKill(defender.instanceId, attacker.pilotId);
    }

    if (outcome.countered && outcome.counterDamage) {
      this.creditDamage(defender.pilotId, outcome.counterDamage);
      if (attacker.side === "hostile") {
        this.recordContribution(attacker.instanceId, defender.pilotId, outcome.counterDamage);
        if (outcome.attackerDowned) this.resolveKill(attacker.instanceId, defender.pilotId);
      }
    }
  }

  private creditDamage(pilotId: string | undefined, amount: number): void {
    if (!pilotId || amount <= 0) return;
    const perf = this.unitPerformance[pilotId];
    if (perf) perf.damageDealt += amount;
  }

  private creditKill(pilotId: string | undefined): void {
    if (!pilotId) return;
    const perf = this.unitPerformance[pilotId];
    if (perf) perf.kills += 1;
  }

  private creditAssist(pilotId: string | undefined, fraction: number): void {
    if (!pilotId) return;
    const perf = this.unitPerformance[pilotId];
    if (perf) perf.assistCredit += fraction;
  }

  /** Tallies `pilotId`'s running damage contribution against one specific victim, keyed by that victim's instanceId — see `victimContributions`'s own field comment. */
  private recordContribution(victimInstanceId: string, pilotId: string | undefined, amount: number): void {
    if (!pilotId || amount <= 0) return;
    const bucket = (this.victimContributions[victimInstanceId] ??= {});
    bucket[pilotId] = (bucket[pilotId] ?? 0) + amount;
  }

  /**
   * A victim just went down. `finisherPilotId` gets the kill (unchanged
   * behavior). Everyone else who's in that victim's contribution bucket —
   * i.e. damaged it at some earlier point this mission without being the
   * one who finished it — gets a combat assist, weighted by their share of
   * the total damage the whole squad dealt to it (ASSIST_MIN_FRACTION's
   * comment above has the exact rule). The bucket is deleted once
   * resolved: this victim is done, nothing more can ever be credited
   * against it.
   */
  private resolveKill(victimInstanceId: string, finisherPilotId: string | undefined): void {
    this.creditKill(finisherPilotId);
    const bucket = this.victimContributions[victimInstanceId];
    if (bucket) {
      const total = Object.values(bucket).reduce((sum, v) => sum + v, 0);
      if (total > 0) {
        for (const [pilotId, amount] of Object.entries(bucket)) {
          if (pilotId === finisherPilotId) continue; // the finisher already got the kill — no double-dipping an assist on their own kill
          const share = Math.min(1, amount / total);
          const fraction = ASSIST_MIN_FRACTION + (ASSIST_MAX_FRACTION - ASSIST_MIN_FRACTION) * share;
          this.creditAssist(pilotId, fraction);
        }
      }
      delete this.victimContributions[victimInstanceId];
    }
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
    // Campaign economy pass, point-formula correction (22 Aug 2026):
    // Qiraki_Weapons_And_Progression.md's locked scoring rule names
    // "healing/repair actions" as an assist in their own right — see
    // REPAIR_ASSIST_FRACTION's comment above UnitPerformance. Only a
    // repair that actually restored HP counts (amount > 0), same
    // "did-it-actually-do-anything" guard creditDamage already uses.
    if (amount > 0) this.creditAssist(healer.pilotId, REPAIR_ASSIST_FRACTION);
    this.log.push(`${healer.displayName} repairs ${target.displayName} for ${amount} HP`);
    return { healerId, targetId, amount };
  }

  private handleDowned(unit: BattleUnit): void {
    this.log.push(`${unit.displayName} is downed.`);

    // Rule 1 (engine/campaignState.ts): evaluated live, right here, at the
    // exact moment of downing — not deferred to mission end, because the
    // set of "living Munti on this side" can change turn to turn within
    // the same mission (a Fabricator redeploy could put one back on the
    // board; a Munti downed later removes one). Only player-side pilots
    // are campaign-tracked; hostile mechs/Bloom are no-ops inside the
    // check itself, but skipped here too so this never runs on every
    // Bloom kill for nothing.
    if (unit.side === "player" && unit.pilotId) {
      // Campaign economy pass: survivalBonus tracking. This method is the
      // one place a player unit's `.downed` flag ever flips true (see
      // this method's own call sites), so it's also the single correct
      // place to latch "was this pilot ever downed this mission" —
      // latched, not reset, even though a future Fabricator mid-mission
      // redeploy (not built) could put the unit back on the board:
      // survivalBonus means "never downed," not "never downed and still
      // down."
      const perf = this.unitPerformance[unit.pilotId];
      if (perf) perf.wasDowned = true;

      const sameSide = this.units.filter((u) => u.side === unit.side);
      const check = evaluatePermadeathCheck(unit, sameSide);
      this.log.push(`Permadeath check — ${unit.displayName}: ${check.reason}`);
      if (check.permanent) this.permanentLosses.push({ pilotId: unit.pilotId, reason: check.reason });
    }

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
      // House rule #5, NOT in the Data Pack: Maxime's call (22 Aug 2026),
      // after failing Amaranth Mission 1 on the clock while playing
      // carefully — "remove the clock on missions, give player more
      // freedom, xcom doesn't have clocks all the time." eliminate_all no
      // longer fails on turn count; the only way to lose is losing every
      // unit (checked above). objectiveParams.turnLimit is kept on every
      // eliminate_all mission and still shown in the HUD (scenes/Battle.ts)
      // as a target, not a deadline — the Amaranth design doc's points-
      // economy appendix ties a future "finished under X turns" bonus to
      // this same number (Appendix B), so the field stays meaningful even
      // though it no longer ends the mission. hold_zone and extract_unit
      // are deliberately NOT touched here: turns are part of what those
      // objectives *mean* ("hold until turn N", "get out before turn N"),
      // not an arbitrary pressure valve layered on top the way it was for
      // eliminate_all — the same distinction XCOM itself draws between its
      // untimed and timed mission types.
      if (!hostileAlive.length) return this.finishWin();
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
