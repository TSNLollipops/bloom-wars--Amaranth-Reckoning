// src/engine/mission.ts
// The turn manager / mission orchestrator (Build Brief steps 5, 8, 9's
// consumer). Owns turn order, the environment step, mission-event wiring,
// win/loss evaluation, and is the single surface both src/sim and the
// Phaser Battle scene call into — so the rules only exist once.
import type {
  CampaignMission,
  Coord,
  MapDefinition,
  MekArchetype,
  PilotRecord,
  RescuePilotBonusObjective,
  TileType,
} from "../data/types";
import { ALL_MAPS as MAPS } from "../data/mapRegistry";
import { createPlayerUnit, createHostileMechUnit, createBloomUnit, createRescuableNpcUnit, type BattleUnit } from "./units";
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
  neighbors4,
  inBounds,
} from "./grid";
import { resolveMechAttack, resolveAttackOnBloom, bloomDamage, applyMechDamage, applyBloomDamage, tankShieldEligible } from "./combat";
import {
  MEEPS_DODGE_CHANCE,
  TANK_SHIELD_CAPACITY,
  TANK_SHIELD_REGEN_PER_TURN,
  MUNTI_REGEN_RADIUS,
  MUNTI_REGEN_PER_TURN,
  MAX_ACTIONS_PER_TURN,
  SENSOR_SWEEP_RANGE_BONUS,
  SENSOR_SWEEP_CHARGES_PER_MISSION,
  INTERDICT_RADIUS,
  SCREEN_RADIUS,
  BLOOM_CLEAR_RADIUS,
  BLOOM_REGROWTH_FIRST_TURN,
  BLOOM_REGROWTH_INTERVAL_TURNS,
  BLOOM_REGROWTH_TILES_PER_TICK,
} from "../data/combatTables";
import { TILES } from "../data/tiles";
import { BLOOM } from "../data/bloom";
import { decideHostileAction, isVisibleTo } from "./ai";
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

/**
 * Meeps house rule roll — true MEEPS_DODGE_CHANCE of the time, false for
 * every non-Meeps path (or undefined path, e.g. Bloom). `source` is whoever
 * is dealing THIS specific hit (the attacker for a primary hit, the
 * counter-attacker for a counter-hit) — a Tank source always wins the roll
 * outright (data/combatTables.ts, House rule #1b, 23 Aug 2026): Meeps
 * cannot dodge a hit that came from a Tank, whichever direction it's
 * flying. A Bloom source (attacker.path undefined) is unaffected, same as
 * before this rule existed.
 */
function rollMeepsDodge(unit: BattleUnit, source: BattleUnit): boolean {
  return unit.path === "meeps" && source.path !== "tank" && Math.random() < MEEPS_DODGE_CHANCE;
}

export interface RepairOutcome {
  healerId: string;
  targetId: string;
  amount: number;
}

/** abil_sensor_sweep result — see Mission.sensorSweep(). `revealedIds` is instanceIds, and can legitimately be empty (a sweep that finds nothing still costs the action and still spends a charge). */
export interface SensorSweepOutcome {
  sweeperId: string;
  radius: number;
  revealedIds: string[];
  revealedUntilTurn: number;
}

/** abil_screen result — see Mission.screenAllies(). `concealedIds` always includes the Munti itself. */
export interface ScreenOutcome {
  muntiId: string;
  concealedIds: string[];
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
  // Mission 5's rescue-and-recruit bonus objective (23 Aug 2026) — see
  // BattleUnit.npcIncapacitated's own comment for the full design. "none"
  // for every mission without a rescue_pilot bonusObjective (the
  // overwhelming majority); set to "pending" the instant the rescuable NPC
  // spawns, then resolved to "succeeded" (checkRescueExtraction) or
  // "failed" (handleDowned, if either the NPC or whoever ends up carrying
  // them goes down first). Deliberately NEVER read by checkWinLoss — a
  // bonus objective, by definition, cannot fail the mission itself;
  // scenes/Debrief.ts is the one place this gets acted on
  // (generateRandomRescuedPilot, engine/campaignEconomy.ts's
  // computeBonusObjectivePoints).
  rescueOutcome: "none" | "pending" | "succeeded" | "failed" = "none";
  // Generalized bonus-objective pass (24 Aug 2026) — clear_bloom_patch's
  // own outcome tracker, companion to rescueOutcome above. "none" for every
  // mission without a clear_bloom_patch bonusObjective; "pending" the
  // instant one is armed (armClearBloomPatch, below); "succeeded" once
  // every tile in the bonusObjective's own patchTiles reads as something
  // other than bloom_mat (checkClearBloomPatchComplete). No "failed"
  // state — see ClearBloomPatchBonusObjective's own comment in
  // data/types.ts for why this kind has no failure condition to detect.
  clearBloomPatchOutcome: "none" | "pending" | "succeeded" = "none";

  constructor(mission: CampaignMission, deployRoster?: DeployRosterEntry[]) {
    this.mission = mission;
    const map = MAPS[mission.mapId];
    if (!map) throw new Error(`Unknown map id: ${mission.mapId}`);
    // Clone the tile grid rather than keeping map's own reference. MAPS[id]
    // (data/mapRegistry.ts) is one singleton object, shared by every Mission
    // ever built from this mapId — every test, every npm run sim call, every
    // real playthrough. Nothing mutated map.tiles before this pass (Mission
    // 3's clear_bloom objective, tickBloomRegrowth below, is the first thing
    // in this codebase that ever writes to a tile after a mission starts),
    // so sharing the reference was latent, not actually wrong, up to now —
    // from here on, skipping this clone would mean a Munti clearing bloom
    // mat in one Low Ground playthrough permanently rewrites the map for
    // every Low Ground mission after it, in the same process. deployZones/
    // exitTiles/holdZone are never mutated anywhere in this file, so they
    // stay shared references — only `tiles` needs its own copy per Mission.
    this.map = { ...map, tiles: map.tiles.map((row) => [...row]) };
    this.deployRoster = deployRoster;
    this.deployedPilotIds = deployRoster ? deployRoster.map((e) => e.pilotId) : [...mission.playerPilotIds];
    this.deployPlayerUnits();
    this.armBonusObjective();
    // Turn 1 goes through the exact same path every later turn does
    // (endPlayerTurn -> runTurnStartEvents), which already spawns that
    // turn's waves itself. This used to ALSO call spawnWavesForTurn(1)
    // explicitly right here, which meant every turn-1 wave in the game
    // spawned twice — verified 23 Aug 2026 against the mission defs
    // themselves: Amaranth I.1 put 12 hostiles on the board for a def
    // that says 6, I.3 put 20 for a def that says 10, and Team One's
    // Mission 1a put 26 for a def that says 13. Exactly double, every
    // mission, both campaigns. Removing the redundant call also makes
    // turn 1 order-consistent with every other turn: events fire first,
    // then that turn's waves spawn.
    this.runTurnStartEvents();
  }

  /**
   * Bonus-objective setup, generalized 24 Aug 2026 (see BonusObjective's
   * own comment in data/types.ts) — dispatches by `kind` to whichever arm
   * method actually does the work, or is a no-op for every mission without
   * a bonusObjective at all. A mission carries at most one bonusObjective,
   * so at most one of spawnRescuableNpc/armClearBloomPatch ever runs, and
   * only one of rescueOutcome/clearBloomPatchOutcome ever leaves "none."
   */
  private armBonusObjective(): void {
    const bonus = this.mission.bonusObjective;
    if (!bonus) return;
    if (bonus.kind === "rescue_pilot") this.spawnRescuableNpc(bonus);
    else this.armClearBloomPatch();
  }

  /** Mission 5's rescue-and-recruit bonus objective: places the one rescuable NPC on the board and arms rescueOutcome. */
  private spawnRescuableNpc(bonus: RescuePilotBonusObjective): void {
    this.units.push(createRescuableNpcUnit(bonus.npcSpawnAt, bonus.npcDisplayName));
    this.rescueOutcome = "pending";
  }

  /**
   * Generalized 24 Aug 2026: arms clearBloomPatchOutcome. No board setup
   * needed, unlike spawnRescuableNpc — a clear_bloom_patch bonusObjective's
   * `patchTiles` names tiles that are already bloom_mat on the map as
   * authored; abil_clear_bloom (this file's own canClearBloom/
   * getClearableBloomFrom/clearBloom, further down) is the verb that
   * clears them, completely unchanged by this pass. Takes no argument —
   * checkClearBloomPatchComplete (below) re-reads mission.bonusObjective
   * itself when it actually needs the patch's tile list.
   */
  private armClearBloomPatch(): void {
    this.clearBloomPatchOutcome = "pending";
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
        const unit = createPlayerUnit(entry.pilotId, pos, { pilot: entry.pilot, mek: entry.mek });
        this.applyBonusAbilityUnlocks(unit);
        this.units.push(unit);
        this.unitPerformance[entry.pilotId] = { damageDealt: 0, kills: 0, assistCredit: 0, wasDowned: false };
      });
      return;
    }
    // Old, no-selection path — unchanged: every test, npm run sim, and any
    // future direct `new Mission(missionDef)` call still resolves purely
    // through the static, build-time roster/registry.
    this.mission.playerPilotIds.forEach((pilotId, i) => {
      const pos = pads[i % pads.length];
      const unit = createPlayerUnit(pilotId, pos);
      this.applyBonusAbilityUnlocks(unit);
      this.units.push(unit);
      this.unitPerformance[pilotId] = { damageDealt: 0, kills: 0, assistCredit: 0, wasDowned: false };
    });
  }

  /**
   * CampaignMission.bonusAbilityUnlocks (data/types.ts) — a mission-gated
   * ability grant, layered on top of the unit's normal per-archetype kit
   * rather than baked into UNIT_ARCHETYPES, so it never touches the
   * static data every other mission also reads. Builds a NEW abilities
   * array; `archetype.abilities` (what createPlayerUnit copied the
   * reference from) is shared, static data and must never be mutated in
   * place.
   */
  private applyBonusAbilityUnlocks(unit: BattleUnit): void {
    const unlocks = this.mission.bonusAbilityUnlocks;
    if (!unlocks || !unit.path) return;
    const grants = unlocks.filter((u) => u.path === unit.path && !unit.abilities.includes(u.abilityId));
    if (!grants.length) return;
    unit.abilities = [...unit.abilities, ...grants.map((g) => g.abilityId)];
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

  /**
   * Walk outward from `origin` (4-directional, walls-aware — same stepping
   * rule as everything else on this grid, see grid.ts's own note on why
   * movement is cardinal rather than Chebyshev) to find an unoccupied,
   * passable-ground tile — spawn waves can list far fewer coords than
   * units, so overflow beyond the first unit at a seam lands here.
   *
   * Was a blind Chebyshev-ring search (checked raw coordinate distance
   * only, never whether a wall stood in between) until a real bug it
   * caused surfaced during Mission 2's Splitfang-count tuning (Maxime,
   * 23 Aug 2026): with a 9th unit needing overflow placement near Wire and
   * Mud's spawn tiles — which sit right up against the hold room's sealed
   * east wall — the old ring search found (10,3), a hold-zone tile one
   * wall-thickness away in raw coordinates, and placed a Splitfang there
   * outright. That unit never walked through the doorway; it spawned
   * inside the sealed room, no path required, which is exactly the kind
   * of thing the room's single-doorway design (this file's own
   * checkWinLoss hold_zone branch, mapsAmaranth.ts's "keeps its ONE
   * doorway") is supposed to make impossible. A BFS restricted to actually
   * walkable terrain can't cross a wall to shortcut there, the same way a
   * real unit's own move budget can't.
   *
   * Unit occupancy does NOT block the walk itself — only terrain does —
   * so this still finds a tile behind a crowd of units instead of
   * refusing early; occupancy is checked only on the candidate tile
   * before returning it.
   */
  private findFreeAdjacent(origin: Coord): Coord {
    const occupied = new Set(this.units.filter((u) => !u.downed).map((u) => coordKey(u.pos)));
    if (!occupied.has(coordKey(origin)) && TILES[tileAt(this.map, origin)].passableGround) return origin;
    const seen = new Set([coordKey(origin)]);
    const queue: Coord[] = [origin];
    while (queue.length) {
      const c = queue.shift()!;
      for (const d of [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
      ]) {
        const n = { x: c.x + d.x, y: c.y + d.y };
        if (n.x < 0 || n.y < 0 || n.x >= this.map.width || n.y >= this.map.height) continue;
        const key = coordKey(n);
        if (seen.has(key)) continue;
        if (!TILES[tileAt(this.map, n)].passableGround) continue;
        seen.add(key);
        if (!occupied.has(key)) return n;
        queue.push(n);
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

  // ---- Mission 5's rescue-and-recruit bonus objective (23 Aug 2026) ------
  //
  // No ability gate — every player unit can attempt a rescue, the same way
  // every player unit can Move; this isn't a class verb like Repair. Mirrors
  // getRepairableFrom/canRescue/rescueUnit's own three-part shape (a
  // getX() the UI highlights from, a canX() predicate, a verb that
  // re-checks it) exactly, one adjacency requirement, one action, does not
  // end the turn — so a unit can reposition to the NPC and rescue them, or
  // rescue then start walking them out, in the same turn.

  /** The one rescuable NPC, if this unit is adjacent to it and free to act — empty otherwise. UI highlight source, same contract as getRepairableFrom. */
  getRescuableFrom(unitId: string, from: Coord): BattleUnit[] {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed || unit.actionsRemaining <= 0) return [];
    if (unit.side !== "player" || unit.carryingRescueId) return [];
    return this.livingUnits().filter((t) => t.npcIncapacitated && chebyshevDistance(from, t.pos) === 1);
  }

  canRescue(rescuerId: string, npcId: string): boolean {
    const rescuer = this.unitById(rescuerId);
    const npc = this.unitById(npcId);
    if (!rescuer || !npc || rescuer.downed || rescuer.actionsRemaining <= 0) return false;
    if (rescuer.side !== "player" || rescuer.carryingRescueId) return false;
    if (!npc.npcIncapacitated || npc.downed) return false;
    return chebyshevDistance(rescuer.pos, npc.pos) === 1;
  }

  /**
   * Pull the NPC up and start carrying them: the NPC unit is removed from
   * the board outright (there is nothing further to render or target once
   * they're "in tow" — see BattleUnit.npcIncapacitated's own comment) and
   * the rescuer is marked carryingRescueId, which engine/mission.ts's
   * attack() checks and refuses for as long as it's set. Getting them the
   * rest of the way to an exit tile is checkRescueExtraction()'s job,
   * called every player turn end alongside checkExtraction().
   */
  rescueUnit(rescuerId: string, npcId: string): { rescuerId: string; npcId: string } | null {
    if (!this.canRescue(rescuerId, npcId)) return null;
    const rescuer = this.unitById(rescuerId)!;
    const npc = this.unitById(npcId)!;
    rescuer.actionsRemaining -= 1;
    rescuer.carryingRescueId = npc.instanceId;
    this.units = this.units.filter((u) => u.instanceId !== npc.instanceId);
    this.log.push(`${rescuer.displayName} gets ${npc.displayName} up and starts carrying them toward the exit.`);
    return { rescuerId, npcId };
  }

  /**
   * Extraction check for the rescue bonus objective — call every player
   * turn end, mirrors checkExtraction()'s own shape but never touches
   * this.outcome (a bonus objective cannot fail the mission). Clears the
   * carrier's own carryingRescueId on success — attack()'s guard checks
   * that flag, so a carrier who successfully drops the rescue off goes
   * back to being a normal combatant for whatever's left of the mission,
   * rather than being permanently locked out of attacking.
   */
  private checkRescueExtraction(): void {
    if (this.rescueOutcome !== "pending") return;
    const carrier = this.units.find((u) => u.carryingRescueId);
    if (!carrier) return;
    const exits = this.map.exitTiles ?? [];
    if (exits.some((c) => coordsEqual(c, carrier.pos))) {
      this.rescueOutcome = "succeeded";
      carrier.carryingRescueId = undefined;
      this.log.push(`${carrier.displayName} gets the rescued pilot clear — they're headed home.`);
    }
  }

  /**
   * Completion check for the clear_bloom_patch bonus objective — call
   * every player turn end, mirrors checkRescueExtraction's own shape
   * (never touches this.outcome; a bonus objective cannot end the
   * mission). Succeeds the instant every tile in the bonusObjective's own
   * patchTiles reads as something other than bloom_mat — this doesn't
   * care WHO or WHAT cleared them (abil_clear_bloom is the only verb that
   * currently does, but the check itself is agnostic, the same way
   * hasBloomMat() below is). No "failed" branch: an unmet patch at
   * mission end is simply still "pending" — see
   * ClearBloomPatchBonusObjective's own comment in data/types.ts for why
   * this kind has no failure condition to detect.
   */
  private checkClearBloomPatchComplete(): void {
    if (this.clearBloomPatchOutcome !== "pending") return;
    const bonus = this.mission.bonusObjective;
    if (!bonus || bonus.kind !== "clear_bloom_patch") return;
    const allClear = bonus.patchTiles.every((c) => this.map.tiles[c.y][c.x] !== "bloom_mat");
    if (allClear) {
      this.clearBloomPatchOutcome = "succeeded";
      this.log.push("Bonus objective complete — the patch is clear.");
    }
  }

  /**
   * abil_sensor_sweep's footprint from `from`: every in-bounds tile the
   * sweep would cover. Mirrors getRepairableFrom/getAttackableFrom's shape
   * (returns empty for a unit that can't sweep right now, so the UI never
   * has to know a rule), except that a sweep's "targets" are tiles rather
   * than units — the whole point of it is finding units you can't see yet,
   * so a list of the hostiles it WOULD reveal would be exactly the
   * information the player isn't supposed to have before spending the
   * action.
   */
  getSensorSweepAreaFrom(unitId: string, from: Coord): Coord[] {
    if (!this.canSensorSweep(unitId)) return [];
    const unit = this.unitById(unitId)!;
    const r = this.sensorSweepRadius(unit);
    const tiles: Coord[] = [];
    for (let y = Math.max(0, from.y - r); y <= Math.min(this.map.height - 1, from.y + r); y++) {
      for (let x = Math.max(0, from.x - r); x <= Math.min(this.map.width - 1, from.x + r); x++) {
        tiles.push({ x, y });
      }
    }
    return tiles;
  }

  /** abil_interdict's kill-box from `from` — the in-bounds tiles a braced Tank would pin a hostile for finishing a move on. Empty if it can't brace right now. */
  getInterdictedTilesFrom(unitId: string, from: Coord): Coord[] {
    if (!this.canInterdict(unitId)) return [];
    const tiles: Coord[] = [];
    for (let y = Math.max(0, from.y - INTERDICT_RADIUS); y <= Math.min(this.map.height - 1, from.y + INTERDICT_RADIUS); y++) {
      for (let x = Math.max(0, from.x - INTERDICT_RADIUS); x <= Math.min(this.map.width - 1, from.x + INTERDICT_RADIUS); x++) {
        if (x === from.x && y === from.y) continue; // the Tank's own tile isn't part of the ring
        tiles.push({ x, y });
      }
    }
    return tiles;
  }

  /**
   * The ring a unit that is ALREADY braced is currently covering — the
   * board tell for abil_interdict, as opposed to getInterdictedTilesFrom's
   * before-you-commit preview. Two methods rather than one because they
   * answer opposite questions ("what would this cover" vs "what is this
   * covering"), and because a braced unit fails canInterdict by definition.
   * Empty for anything not braced, so scenes/Battle.ts never has to know
   * that rule either.
   */
  interdictedTiles(unitId: string): Coord[] {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed || !unit.braced) return [];
    const tiles: Coord[] = [];
    for (let y = Math.max(0, unit.pos.y - INTERDICT_RADIUS); y <= Math.min(this.map.height - 1, unit.pos.y + INTERDICT_RADIUS); y++) {
      for (let x = Math.max(0, unit.pos.x - INTERDICT_RADIUS); x <= Math.min(this.map.width - 1, unit.pos.x + INTERDICT_RADIUS); x++) {
        if (x === unit.pos.x && y === unit.pos.y) continue;
        tiles.push({ x, y });
      }
    }
    return tiles;
  }

  /** Is this unit currently painted by an unexpired abil_sensor_sweep? The expiry rule lives here, not in the renderer that draws the tell. */
  isRevealed(unitId: string): boolean {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed) return false;
    return unit.revealedUntilTurn !== undefined && unit.revealedUntilTurn >= this.turn;
  }

  /**
   * Who abil_screen would actually cover from `from` — the Munti itself
   * plus every living same-side unit within SCREEN_RADIUS. Includes the
   * Munti deliberately: it conceals itself too, and a UI highlight that
   * omitted it would misreport the rule. Empty if it can't screen right now
   * (no ability, out of actions, or already spent this mission).
   */
  getScreenableFrom(unitId: string, from: Coord): BattleUnit[] {
    if (!this.canScreen(unitId)) return [];
    const unit = this.unitById(unitId)!;
    return this.livingUnits().filter((t) => t.side === unit.side && chebyshevDistance(from, t.pos) <= SCREEN_RADIUS);
  }

  // ---- actions -------------------------------------------------------

  moveUnit(unitId: string, destination: Coord): boolean {
    const unit = this.unitById(unitId);
    // npcIncapacitated (Mission 5's rescue-and-recruit pass): defense in
    // depth, not load-bearing — moveRange 0 already means reachableTiles
    // below can never return anything but this unit's own tile, but an
    // explicit refusal here matches the guard shape every other
    // downed/inactive-unit check in this file already uses.
    if (!unit || unit.downed || unit.npcIncapacitated || unit.actionsRemaining <= 0) return false;
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

  /**
   * The normal, action-costing Attack verb — the only entry point a player
   * click or an AI decision ever uses. Everything after the action-economy
   * check lives in resolveAttack() below, which the overwatch reaction shot
   * (triggerOverwatch) also calls: a reaction shot is the same attack, just
   * paid for in advance by entering overwatch rather than by an action
   * available right now.
   */
  attack(attackerId: string, defenderId: string): AttackOutcome | null {
    const attacker = this.unitById(attackerId);
    // carryingRescueId (Mission 5's rescue-and-recruit pass, 23 Aug 2026):
    // whoever is hauling the rescued NPC cannot attack until they've either
    // reached an exit tile (checkRescueExtraction clears the flag the
    // instant that happens — see that method) or gone down trying.
    // Escorting is the trade; a unit that could still fight while carrying
    // would get both halves of it for free.
    if (!attacker || attacker.actionsRemaining <= 0 || attacker.carryingRescueId) return null;
    return this.resolveAttack(attackerId, defenderId);
  }

  /**
   * Every rule an attack has, minus the "do you have an action right now"
   * question: range, side, terrain/overshield/dodge/Collapse math,
   * performance + contribution bookkeeping, the log line, and downing.
   * Deliberately one body rather than two, so an overwatch reaction shot
   * cannot drift from a normal shot — same POWER table, same full-HP cap,
   * same counters, same recordPerformance() call, therefore the same
   * campaign points (engine/campaignEconomy.ts scores kills + fractional
   * assists straight off unitPerformance/victimContributions, both written
   * only here).
   *
   * `opts.reaction` changes exactly one thing: the wording of the log line.
   */
  private resolveAttack(attackerId: string, defenderId: string, opts?: { reaction?: boolean }): AttackOutcome | null {
    const attacker = this.unitById(attackerId);
    const defender = this.unitById(defenderId);
    if (!attacker || !defender || attacker.downed || defender.downed) return null;
    if (attacker.side === defender.side) return null;
    const d = chebyshevDistance(attacker.pos, defender.pos);
    if (d < attacker.attackRange[0] || d > attacker.attackRange[1]) return null;

    const sameSideAsAttacker = this.units.filter((u) => u.side === attacker.side);
    const sameSideAsDefender = this.units.filter((u) => u.side === defender.side);

    let outcome: AttackOutcome;
    if (attacker.kind !== "bloom" && defender.kind !== "bloom") {
      const defenderDodged = rollMeepsDodge(defender, attacker);
      const attackerDodgedCounter = rollMeepsDodge(attacker, defender);
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
      const defenderDodged = rollMeepsDodge(defender, attacker);
      const dmg = bloomDamage(attacker, defender, this.map, sameSideAsDefender, surfaced, defenderDodged);
      applyMechDamage(defender, dmg);
      outcome = { attackerId, defenderId, damage: dmg, countered: false, defenderDowned: defender.downed, defenderDodged };
    }

    this.recordPerformance(attacker, defender, outcome);

    // Attack always consumes every remaining action and ends the unit's
    // turn, regardless of which action slot it's used in (two-action house
    // rule, Maxime, 22 Aug 2026 — matches XCOM 2: you can heal then heal,
    // but never heal then shoot then heal again). A reaction shot's attacker
    // is already at 0 (enterOverwatch zeroed it), so this is a no-op there.
    attacker.actionsRemaining = 0;
    // Firing gives your position away (ability-depth pass, 23 Aug 2026):
    // any concealment from abil_ambush or abil_screen ends the instant this
    // unit attacks, and it ends HERE rather than in attack() so a Meeps'
    // own ambush shot — a reaction, resolved through this same body —
    // breaks it too. That is the intended shape of the ability: you get one
    // shot out of concealment, not a permanent invisible turret.
    attacker.concealed = false;
    let msg = opts?.reaction
      ? `${attacker.displayName} fires overwatch on ${defender.displayName}`
      : `${attacker.displayName} attacks ${defender.displayName}`;
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

  // ---- overwatch -----------------------------------------------------
  //
  // Overwatch / reaction fire (Maxime, 23 Aug 2026 — "we really need to make
  // our mission last at least 30min... my xcom mission lasted hours"), the
  // second of the three agreed systems, after fog of war (commit f2e04e4).
  // The point isn't extra damage: it's that ending a turn holding position
  // becomes a real option, so the loop stops being "walk forward, click
  // attack" and starts being "creep, set up, wait." It's built directly on
  // top of the fog of war — you hold overwatch precisely because you can't
  // see what's out there, and the trigger below is vision-gated with the
  // same isVisibleTo() the hostile AI and the fog renderer both use.
  //
  // DELIBERATELY OUT OF SCOPE this pass (flagged, not silently skipped):
  //   - Hostile-side overwatch. `overwatch` is only ever set by
  //     enterOverwatch(), which refuses any non-player unit. Nothing in the
  //     Bloom's own behaviour spec has a hold-fire concept to hang it on:
  //     GDD §5.3's reflexive tier is "move toward the nearest visible
  //     target... no retreat, no focus fire, no self-preservation," and pack
  //     only adds shared targeting. The one phrase that comes close, "hold
  //     reserves until the player commits," is listed under emergent — boss
  //     encounters only, explicitly "do not generalise it," and not built.
  //     So arming the Bloom with overwatch is a design question for Maxime,
  //     not an implementation gap. The trigger loop below is written
  //     side-agnostically enough that flipping it on later is a one-line
  //     change to enterOverwatch's guard.
  //   - Triggering on anything other than hostile MOVEMENT. A hostile
  //     attacking, or using an ability, from where it already stands does
  //     not draw reaction fire. Movement-only is what makes overwatch a
  //     positional threat rather than a flat retaliation aura.
  //   - Multiple reaction shots per overwatch. Firing clears the flag —
  //     it's an ambush, not a turret. (Several DIFFERENT overwatchers can
  //     each fire once at the same mover; that's the intended crossfire.)
  //   - Any accuracy or damage penalty on the reaction shot. XCOM applies
  //     an aim penalty to reaction fire; this pass resolves reaction shots
  //     at full normal strength through the identical resolveAttack() path.
  //     That's a tuning knob Maxime may well want later — the number is
  //     his call, not one to invent here, and the single place it would go
  //     is resolveAttack's `opts`.

  /**
   * Can this unit enter overwatch right now? The UI (scenes/Battle.ts)
   * greys its button off this — the scene owns no rules, so the predicate
   * lives here next to the verb that enforces it.
   */
  canEnterOverwatch(unitId: string): boolean {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed) return false;
    if (unit.side !== "player") return false; // player-only this pass — see the block comment above
    if (unit.overwatch) return false;
    return unit.actionsRemaining > 0;
  }

  /**
   * Enter overwatch instead of acting: hold fire this turn, and take one
   * free shot at the first hostile that moves into range and sight during
   * the hostile phase (triggerOverwatch below).
   *
   * Costs the unit's ENTIRE remaining action budget and ends its turn, the
   * same way attack() does (two-action house rule) rather than the 1-action
   * Move/Repair way — overwatching with an action still in hand would let a
   * unit shoot, then set overwatch, and get two shots per round out of a
   * two-action budget.
   */
  enterOverwatch(unitId: string): boolean {
    if (!this.canEnterOverwatch(unitId)) return false;
    const unit = this.unitById(unitId)!;
    unit.overwatch = true;
    unit.actionsRemaining = 0;
    this.log.push(`${unit.displayName} holds overwatch.`);
    return true;
  }

  /**
   * A hostile just finished a move. Every player unit currently holding
   * overwatch that can both reach it (its own attackRange) and actually see
   * it (isVisibleTo — the fog-of-war-aware half, and the whole reason this
   * pairs with commit f2e04e4: an overwatcher cannot reaction-fire at
   * something nobody on the board can see, exactly as it cannot normally
   * attack it) fires one shot, in board order.
   *
   * Called from exactly one place — moveHostile(), the single choke point
   * every hostile move goes through — so there is no way to add a hostile
   * movement path later that silently skips reaction fire.
   */
  private triggerOverwatch(mover: BattleUnit): void {
    if (mover.side !== "hostile" || mover.downed) return;
    for (const watcher of this.units) {
      if (mover.downed) return; // an earlier overwatcher already killed it — nothing left to shoot at
      if (!watcher.overwatch || watcher.downed || watcher.side === mover.side) continue;
      const d = chebyshevDistance(watcher.pos, mover.pos);
      if (d < watcher.attackRange[0] || d > watcher.attackRange[1]) continue;
      // Vision-gated exactly as before, now with the clock threaded in
      // (ability-depth pass, 23 Aug 2026) so an abil_sensor_sweep paint
      // counts: a burrower an overwatcher could not otherwise see IS a
      // legal reaction target for as long as it stays painted, and stops
      // being one the moment the paint expires.
      if (!isVisibleTo(watcher, mover, this.turn)) continue;
      // Clear BEFORE resolving, not after: resolveAttack can re-enter this
      // object (handleDowned -> unit_downed events -> spawns), and a shot
      // already in flight must never be able to fire a second time.
      watcher.overwatch = false;
      this.resolveAttack(watcher.instanceId, mover.instanceId, { reaction: true });
    }
  }

  // ---- ability depth: one new verb per path ---------------------------
  //
  // System 3 of the three agreed "make a mission last 30+ minutes" passes
  // (Maxime, 23 Aug 2026), after fog of war (f2e04e4) and overwatch
  // (47ab304). The problem this solves is stated in data/abilities.ts's
  // header: every unit had exactly one verb, so a turn was never a
  // decision. Four new verbs live below, one per path, each written so
  // that using it means NOT shooting:
  //
  //   sensorSweep(id)  Reeps/vibrissal  1 action, turn continues, 2 charges/mission
  //   ambush(id)       Meeps            whole budget, ends turn, unlimited
  //   interdict(id)    Tank             whole budget, ends turn, unlimited
  //   screenAllies(id) Munti            1 action, turn continues, once per mission
  //
  // Every one of them follows enterOverwatch's shape exactly: a canX()
  // predicate the UI greys its button off (scenes/Battle.ts owns no rules
  // and must never re-derive one), then a verb that re-asks the predicate,
  // mutates, logs, and returns something the caller can check. None of them
  // touches engine/combat.ts — no new damage formula exists anywhere in
  // this pass. Between them they reveal, conceal, and take actions away,
  // which is the whole vocabulary.
  //
  // PLAYER-ONLY, every one, exactly like enterOverwatch and for the same
  // reason: these are the four PATHS' abilities and the Bloom don't have
  // paths (data/bloom.ts has no `path` field at all). Hostile mechs DO
  // resolve through arch_<path>_bipedal and therefore now carry
  // abil_ambush/abil_interdict in their `abilities` array as a side effect
  // of the archetype assignment — the `side !== "player"` guard in each
  // predicate below is what makes that inert, and engine/ai.ts's tiers were
  // deliberately not taught to call any of these.
  //
  // DELIBERATELY OUT OF SCOPE, flagged rather than silently skipped:
  //   - Any AI use of these verbs, per the above.
  //   - Concealment breaking on anything other than attacking. Moving,
  //     being healed, and standing in acid do not reveal you; only firing
  //     does. Simple, and it is what makes Screen-then-reposition work.
  //   - Interdiction being consumed by a pin (see abil_interdict's comment).
  //   - abil_cockpit_evac, which remains defined-and-unimplemented. It is
  //     a reactive interception of a downing, not a turn-economy verb, so
  //     it is a different piece of work from this pass and is not started
  //     here.

  /** abil_sensor_sweep's reach for this unit: its own vision, plus the flat overshoot in data/combatTables.ts. */
  private sensorSweepRadius(unit: BattleUnit): number {
    return unit.vision + SENSOR_SWEEP_RANGE_BONUS;
  }

  /** The turn number `abilityId` becomes usable again on this unit (0 = never used / ready). */
  private cooldownReadyTurn(unit: BattleUnit, abilityId: string): number {
    return unit.abilityCooldowns?.[abilityId] ?? 0;
  }

  /** Turns still to wait before `abilityId` is usable on this unit — 0 when it's ready now. Exposed for the HUD. */
  abilityCooldownRemaining(unitId: string, abilityId: string): number {
    const unit = this.unitById(unitId);
    if (!unit) return 0;
    return Math.max(0, this.cooldownReadyTurn(unit, abilityId) - this.turn);
  }

  /** Charges of abil_sensor_sweep this unit has left this mission. Exposed for the HUD. Undefined reads as a full, unspent budget — see sensorSweepUsesRemaining's own comment in engine/units.ts. */
  sensorSweepChargesRemaining(unitId: string): number {
    const unit = this.unitById(unitId);
    if (!unit) return 0;
    return unit.sensorSweepUsesRemaining ?? SENSOR_SWEEP_CHARGES_PER_MISSION;
  }

  canSensorSweep(unitId: string): boolean {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed) return false;
    if (unit.side !== "player") return false;
    if (!unit.abilities.includes("abil_sensor_sweep")) return false;
    if (this.sensorSweepChargesRemaining(unitId) <= 0) return false;
    return unit.actionsRemaining > 0;
  }

  /**
   * Run the sensor array: paint every living hostile inside
   * sensorSweepRadius() so the whole player side can see it until the end
   * of the following hostile phase, burrowed ones included.
   *
   * `revealedUntilTurn = this.turn` is the literal reading of Data Pack
   * §6's "until the end of the following enemy turn": a sweep is spent on
   * the player phase of turn N, and the enemy turn that follows it is the
   * hostile phase of that same turn N (Mission.turn only increments after
   * the hostile phase resolves — see runHostileTurn). So the paint covers
   * the rest of this player turn and the whole hostile phase, and is stale
   * on turn N+1.
   *
   * Limited to SENSOR_SWEEP_CHARGES_PER_MISSION uses per mission (2, as of
   * 23 Aug 2026 — Maxime: "I see double scan as two charge each mission,
   * every mission"), not a turn-based cooldown — a budget to spend across
   * the whole mission rather than a rate you wait out between uses. This
   * thins the fog, it does not delete it.
   *
   * Revealing is NOT surfacing. `burrowed` is left alone, so an Undertow
   * painted here still counts as burrowed for its own surfacing damage
   * multiplier when it eventually attacks (resolveAttack's bloom branch) —
   * the sweep tells you where it is, it doesn't drag it out of the ground.
   *
   * Costs 1 action and does not end the turn — the charge is the real
   * price. Never paints its own side (see isVisibleTo's note on why that
   * matters).
   */
  sensorSweep(unitId: string): SensorSweepOutcome | null {
    if (!this.canSensorSweep(unitId)) return null;
    const unit = this.unitById(unitId)!;
    const radius = this.sensorSweepRadius(unit);
    const revealedIds: string[] = [];
    for (const target of this.livingUnits()) {
      if (target.side === unit.side) continue;
      if (chebyshevDistance(unit.pos, target.pos) > radius) continue;
      target.revealedUntilTurn = this.turn;
      revealedIds.push(target.instanceId);
    }
    unit.actionsRemaining -= 1;
    const chargesLeft = this.sensorSweepChargesRemaining(unitId) - 1;
    unit.sensorSweepUsesRemaining = chargesLeft;
    this.log.push(
      revealedIds.length
        ? `${unit.displayName} sweeps (radius ${radius}) — ${revealedIds.length} contact(s) painted. (${chargesLeft} charge(s) left)`
        : `${unit.displayName} sweeps (radius ${radius}) — no contacts. (${chargesLeft} charge(s) left)`
    );
    return { sweeperId: unitId, radius, revealedIds, revealedUntilTurn: this.turn };
  }

  canAmbush(unitId: string): boolean {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed) return false;
    if (unit.side !== "player") return false;
    if (!unit.abilities.includes("abil_ambush")) return false;
    if (unit.overwatch || unit.concealed) return false;
    // Can't slip away from something standing on top of you. This is the
    // line that stops Ambush being a strictly-better Overwatch — see
    // abil_ambush's comment in data/abilities.ts. Uses raw adjacency rather
    // than isVisibleTo on purpose: a burrowed Undertow you cannot see is
    // still a thing you are in contact with.
    const inContact = this.livingUnits().some((u) => u.side !== unit.side && chebyshevDistance(u.pos, unit.pos) <= 1);
    if (inContact) return false;
    return unit.actionsRemaining > 0;
  }

  /**
   * Go to ground: concealment plus a held shot. Sets `overwatch` as well as
   * `concealed`, so the reaction fire runs through triggerOverwatch above
   * with no second code path at all — an ambush shot IS an overwatch shot,
   * fired by someone the mover never saw. Firing breaks the concealment
   * (resolveAttack), which is the whole trade.
   *
   * Costs the unit's entire remaining action budget and ends its turn, the
   * Attack/Overwatch way rather than the Move/Repair way, for exactly the
   * reason enterOverwatch does it: shoot-then-vanish would be both halves.
   */
  ambush(unitId: string): boolean {
    if (!this.canAmbush(unitId)) return false;
    const unit = this.unitById(unitId)!;
    unit.concealed = true;
    unit.overwatch = true;
    unit.actionsRemaining = 0;
    this.log.push(`${unit.displayName} goes to ground — concealed, holding a shot.`);
    return true;
  }

  canTaunt(unitId: string): boolean {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed) return false;
    if (unit.side !== "player") return false;
    if (!unit.abilities.includes("abil_taunt")) return false;
    if (unit.usedTauntThisMission) return false;
    return unit.actionsRemaining > 0;
  }

  /**
   * Draw every eye. The redirect itself lives in engine/ai.ts — each of
   * the four targeting functions checks `taunting` before its own normal
   * pick — this method only sets the posture and spends the mission's one
   * use of it.
   *
   * Costs the unit's entire remaining action budget and ends its turn,
   * same tier as Ambush/Interdict/Overwatch: this is a full commitment,
   * not a cheap add-on to an attack. See abil_taunt's own comment in
   * data/abilities.ts for why it carries no defensive bonus to go with
   * the redirect.
   */
  taunt(unitId: string): boolean {
    if (!this.canTaunt(unitId)) return false;
    const unit = this.unitById(unitId)!;
    unit.taunting = true;
    unit.usedTauntThisMission = true;
    unit.actionsRemaining = 0;
    this.log.push(`${unit.displayName} draws every eye — taunting.`);
    return true;
  }

  canInterdict(unitId: string): boolean {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed) return false;
    if (unit.side !== "player") return false;
    if (!unit.abilities.includes("abil_interdict")) return false;
    if (unit.braced) return false;
    return unit.actionsRemaining > 0;
  }

  /**
   * Plant and cover the ground around you until your next turn. The pin
   * itself is triggerInterdiction() below; this is just the posture.
   *
   * Costs the unit's entire remaining action budget and ends its turn —
   * a 3-move Tank that could still swing after bracing would be picking
   * up board control for free.
   */
  interdict(unitId: string): boolean {
    if (!this.canInterdict(unitId)) return false;
    const unit = this.unitById(unitId)!;
    unit.braced = true;
    unit.actionsRemaining = 0;
    this.log.push(`${unit.displayName} braces — interdicting the ground around it.`);
    return true;
  }

  /**
   * A hostile just finished a move (moveHostile, the same single choke
   * point overwatch fires from). If any braced, non-downed player unit is
   * within INTERDICT_RADIUS of where it stopped AND can actually see it,
   * the mover loses every remaining action — so runHostileTurn's
   * move-then-attack pair resolves as move-then-nothing, since attack()
   * refuses an attacker at zero actions.
   *
   * Resolved AFTER triggerOverwatch on purpose: a mover killed by reaction
   * fire on the way in is simply dead, and pinning a corpse would put a
   * meaningless line in the log. Vision-gated with the same
   * isVisibleTo(_, _, turn) overwatch uses, which is what makes a Sensor
   * Sweep worth something to a Tank: an unpainted burrower walks through an
   * interdiction untouched, a painted one does not.
   *
   * Unlike an overwatch shot, bracing is NOT consumed here — one Tank pins
   * everything that steps into its ring that phase. Deliberate; see
   * abil_interdict's comment in data/abilities.ts for the reasoning and for
   * where to turn it down.
   */
  private triggerInterdiction(mover: BattleUnit): void {
    if (mover.side !== "hostile" || mover.downed) return;
    if (mover.actionsRemaining <= 0) return;
    for (const anchor of this.units) {
      if (!anchor.braced || anchor.downed || anchor.side === mover.side) continue;
      if (chebyshevDistance(anchor.pos, mover.pos) > INTERDICT_RADIUS) continue;
      if (!isVisibleTo(anchor, mover, this.turn)) continue;
      mover.actionsRemaining = 0;
      this.log.push(`${anchor.displayName} interdicts ${mover.displayName} — pinned, no attack.`);
      return; // one pin is total; a second anchor has nothing left to take
    }
  }

  canScreen(unitId: string): boolean {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed) return false;
    if (unit.side !== "player") return false;
    if (!unit.abilities.includes("abil_screen")) return false;
    if (unit.usedScreenThisMission) return false;
    return unit.actionsRemaining > 0;
  }

  /**
   * Put the screen up: conceal this Munti and every living same-side unit
   * within SCREEN_RADIUS until their own next turns begin. Same
   * `concealed` flag abil_ambush sets, so it is the same single line in
   * engine/ai.ts's isVisibleTo doing the work — the Bloom simply have no
   * target and hold position for a phase.
   *
   * Costs 1 action and does NOT end the turn (screen-then-Repair is the
   * point of a support turn), but is ONCE PER MISSION per Munti, mirroring
   * abil_cockpit_evac's usedEvacThisMission: an effect that takes the
   * hostile side's turn away entirely should be spent, not rationed.
   *
   * Deliberately does NOT clear anyone's overwatch: a covered unit still
   * has its held shot, and firing it is what breaks that unit's own cover.
   */
  screenAllies(unitId: string): ScreenOutcome | null {
    if (!this.canScreen(unitId)) return null;
    const unit = this.unitById(unitId)!;
    const covered = this.livingUnits().filter((t) => t.side === unit.side && chebyshevDistance(unit.pos, t.pos) <= SCREEN_RADIUS);
    for (const u of covered) u.concealed = true;
    unit.actionsRemaining -= 1;
    unit.usedScreenThisMission = true;
    this.log.push(`${unit.displayName} puts up a screen — ${covered.length} unit(s) concealed.`);
    return { muntiId: unitId, concealedIds: covered.map((u) => u.instanceId) };
  }

  // ---- abil_clear_bloom (Mission 3's "clean the bloom patch" pass, 23 Aug
  // 2026) — see data/abilities.ts's own comment for the full design. Same
  // canX()/getX()/verb shape as every other ability-depth verb above, but a
  // RADIUS effect on tiles rather than a target-picking one, so it belongs
  // in the contextual action bar (scenes/Battle.ts) next to Screen and
  // Sweep, not among the click-a-unit verbs Repair/Rescue are.

  /** Every bloom_mat tile within BLOOM_CLEAR_RADIUS of `from`, Chebyshev — shared by canClearBloom's "is there anything to do" check and clearBloom's own mutation, and exposed via getClearableBloomFrom for the UI preview highlight. */
  private clearableBloomTiles(from: Coord): Coord[] {
    const tiles: Coord[] = [];
    for (let y = Math.max(0, from.y - BLOOM_CLEAR_RADIUS); y <= Math.min(this.map.height - 1, from.y + BLOOM_CLEAR_RADIUS); y++) {
      for (let x = Math.max(0, from.x - BLOOM_CLEAR_RADIUS); x <= Math.min(this.map.width - 1, from.x + BLOOM_CLEAR_RADIUS); x++) {
        if (this.map.tiles[y][x] === "bloom_mat") tiles.push({ x, y });
      }
    }
    return tiles;
  }

  canClearBloom(unitId: string): boolean {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed) return false;
    if (unit.side !== "player") return false;
    if (!unit.abilities.includes("abil_clear_bloom")) return false;
    if (unit.actionsRemaining <= 0) return false;
    // Same "usable only when it would actually do something" rule
    // getRepairableFrom already applies to Repair — greyed rather than a
    // wasted click that clears nothing.
    return this.clearableBloomTiles(unit.pos).length > 0;
  }

  /** UI preview highlight — every tile clearBloom would flip from here, or empty if canClearBloom is false. Mirrors getSensorSweepAreaFrom/getInterdictedTilesFrom's own "ask the engine, never guess" contract. */
  getClearableBloomFrom(unitId: string, from: Coord): Coord[] {
    if (!this.canClearBloom(unitId)) return [];
    return this.clearableBloomTiles(from);
  }

  /**
   * Convert every bloom_mat tile within BLOOM_CLEAR_RADIUS back to plain
   * ground. Costs 1 action, does not end the turn (data/abilities.ts's own
   * comment has the full reasoning) — no per-mission limit or cooldown,
   * unlike Screen or Sweep: this is the mission's actual job, meant to be
   * repeated until hasBloomMat() reads false.
   */
  clearBloom(unitId: string): { unitId: string; tilesCleared: number } | null {
    if (!this.canClearBloom(unitId)) return null;
    const unit = this.unitById(unitId)!;
    const tiles = this.clearableBloomTiles(unit.pos);
    for (const c of tiles) this.map.tiles[c.y][c.x] = "plain";
    unit.actionsRemaining -= 1;
    this.log.push(`${unit.displayName} clears ${tiles.length} bloom mat tile(s).`);
    return { unitId, tilesCleared: tiles.length };
  }

  /**
   * The clear_bloom objective's own countervailing pressure (data/combatTables.ts's
   * BLOOM_REGROWTH_* constants have the full pacing rationale). Fires on
   * turn BLOOM_REGROWTH_FIRST_TURN and every BLOOM_REGROWTH_INTERVAL_TURNS
   * after it, converting up to BLOOM_REGROWTH_TILES_PER_TICK clean tiles
   * adjacent to existing bloom_mat back into bloom_mat.
   *
   * Deliberately DETERMINISTIC, not a percentage roll: scans the board in a
   * fixed row-major order, and for each bloom_mat tile it finds, spreads
   * into the FIRST cardinal-adjacent plain/scrub neighbour (fixed
   * right/down/left/up order, from grid.ts's own neighbors4) — the same
   * "no Math.random on anything a regression test needs to pin down"
   * discipline the rest of this file's deterministic formulas follow (see
   * rollMeepsDodge for the one place this file DOES roll, and why that one
   * is fine to be random: it isn't a board-state mutation a test needs to
   * reproduce exactly).
   *
   * No-op for every mission that isn't clear_bloom — a mission with
   * bloom_mat as pure terrain flavour (none currently ship, but nothing
   * stops one) never has this tick running against it.
   */
  private tickBloomRegrowth(): void {
    if (this.mission.objective !== "clear_bloom") return;
    if (this.turn < BLOOM_REGROWTH_FIRST_TURN) return;
    if ((this.turn - BLOOM_REGROWTH_FIRST_TURN) % BLOOM_REGROWTH_INTERVAL_TURNS !== 0) return;
    let spread = 0;
    for (let y = 0; y < this.map.height && spread < BLOOM_REGROWTH_TILES_PER_TICK; y++) {
      for (let x = 0; x < this.map.width && spread < BLOOM_REGROWTH_TILES_PER_TICK; x++) {
        if (this.map.tiles[y][x] !== "bloom_mat") continue;
        for (const n of neighbors4({ x, y })) {
          if (!inBounds(this.map, n)) continue;
          const t = this.map.tiles[n.y][n.x];
          if (t === "plain" || t === "scrub") {
            this.map.tiles[n.y][n.x] = "bloom_mat";
            spread += 1;
            break;
          }
        }
      }
    }
    if (spread > 0) this.log.push(`Bloom mat spreads — ${spread} tile(s) reclaimed.`);
  }

  /**
   * The single choke point for hostile movement — runHostileTurn() moves
   * hostiles by calling this and nothing else. Reaction fire hooks in here
   * rather than at the AI call site so that "a hostile moved" and "the
   * overwatchers get their shot" cannot come apart: any future hostile
   * movement (a reposition ability, a fear/rout behaviour, a second AI pass)
   * routes through this method and is covered for free.
   */
  private moveHostile(unit: BattleUnit, path: Coord[]): void {
    const dest = path[path.length - 1];
    unit.chargedThisMove = unit.chassis === "centauroid" && isStraightLineCharge(this.map, path, "centauroid");
    unit.pos = dest;
    unit.actionsRemaining = Math.max(0, unit.actionsRemaining - 1);
    for (const step of path.slice(1)) {
      const fired = evaluateZoneEntered(this.mission.events, step, this.turn, this.eventState);
      for (const ev of fired) this.applyEventAction(ev.action);
    }
    // Reaction fire resolves as part of the move, before control returns to
    // the caller — see runHostileTurn's ordering comment. Interdiction
    // (abil_interdict) hangs off this same choke point and resolves second,
    // so a mover already killed by a reaction shot is never also pinned.
    this.triggerOverwatch(unit);
    this.triggerInterdiction(unit);
  }

  private handleDowned(unit: BattleUnit): void {
    this.log.push(`${unit.displayName} is downed.`);

    // Mission 5's rescue-and-recruit bonus objective (23 Aug 2026): a
    // rescue can fail two ways — the NPC themselves is killed before ever
    // being reached (unit.npcIncapacitated), or whoever picked them up goes
    // down while still carrying them (unit.carryingRescueId). Either one
    // ends the attempt; there's no "someone else picks up the body" second
    // chance this pass. Checked against rescueOutcome === "pending" so a
    // downing after the rescue already succeeded (carryingRescueId already
    // cleared by checkRescueExtraction) or on a mission with no rescue at
    // all (rescueOutcome stays "none") is correctly a no-op here.
    if (this.rescueOutcome === "pending" && (unit.npcIncapacitated || unit.carryingRescueId)) {
      this.rescueOutcome = "failed";
      this.log.push("The rescue attempt fails.");
    }

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
    this.checkRescueExtraction();
    this.checkClearBloomPatchComplete();
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
        this.moveHostile(unit, decision.path);
      }
      // Move-then-attack ordering, and the load-bearing half of overwatch
      // (see the overwatch block above): moveHostile() resolves every
      // triggered reaction shot BEFORE returning, so by this line a hostile
      // that was killed walking into an ambush is already `downed` and its
      // own attack never happens. That's the whole payoff of holding a
      // firing line — otherwise a mover would still get its hit in from
      // beyond the grave and overwatch would be pure damage rather than
      // prevention. attack() would refuse a downed attacker anyway; the
      // explicit check is here so the ordering is a stated rule rather than
      // an accident of another method's guard.
      if (decision.attackTargetId && !unit.downed) {
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
      // Overwatch survives the whole hostile phase — that IS the mechanic —
      // and expires the moment its owner's next turn begins. Cleared in the
      // same loop that refreshes actionsRemaining, deliberately: the two are
      // the same fact ("this unit's turn has started, its held shot is
      // spent or wasted"), and splitting them is how they'd drift apart.
      unit.overwatch = false;
      // Ability-depth pass (23 Aug 2026) — the same fact, for the same
      // reason, for the two postures added alongside it: abil_ambush's and
      // abil_screen's concealment, and abil_interdict's brace, each last
      // exactly one full hostile phase and expire when their owner's next
      // turn begins. Cleared here rather than in four places so they cannot
      // drift apart from each other or from `overwatch`.
      //
      // `revealedUntilTurn` (abil_sensor_sweep) is deliberately NOT cleared
      // here: it's a deadline compared against Mission.turn, not a flag, so
      // a stale value is already inert everywhere it's read and zeroing it
      // would just be a second place the expiry rule lives.
      unit.concealed = false;
      unit.braced = false;
      // abil_taunt (25 Aug 2026) — same fact, same reason, same loop: the
      // redirect lasts exactly one hostile phase and expires when this
      // unit's own next turn begins.
      unit.taunting = false;
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
    // Runs after the per-unit tile-damage loop above, deliberately: this
    // turn's turnStartDamage already resolved against the board as it stood
    // when the turn started, so a tile tickBloomRegrowth converts to
    // bloom_mat here doesn't retroactively burn anyone standing on it —
    // that starts next turn.
    this.tickBloomRegrowth();
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
    // !u.npcIncapacitated (Mission 5's rescue-and-recruit bonus objective,
    // 23 Aug 2026): the rescuable NPC is side "player" so the hostile AI
    // targets it like anyone else (real stakes on the rescue — see
    // BattleUnit.npcIncapacitated's own comment), but it is not one of the
    // deploying squad and must never count toward "is anyone still up" —
    // a real squad wiped to zero has to read as a loss even if the NPC is
    // still standing on the board, untouched, waiting to be rescued.
    const playerAlive = this.units.filter((u) => u.side === "player" && !u.downed && !u.npcIncapacitated);
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
    } else if (this.mission.objective === "clear_bloom") {
      // Mission 3's "clean the bloom patch" pass (Maxime, 23 Aug 2026:
      // "making clean the bloom patch the objective of mission 3"). Win the
      // instant no bloom_mat tile remains anywhere on the board. House rule
      // #5's shape, extended to a third objective type: turnLimit stays a
      // bonus-scoring target (Amaranth Appendix B), never a fail line — see
      // data/combatTables.ts's own comment on why a hard clock isn't needed
      // here either. tickBloomRegrowth (environmentStep, below) is the
      // actual countervailing pressure: stall near the edge picking off
      // Crawlmass and the patch grows back on its own clock, so waiting was
      // never a free win even without a turn cap.
      if (!this.hasBloomMat()) return this.finishWin();
    }
    return false;
  }

  /** True if any bloom_mat tile remains anywhere on the board — the clear_bloom objective's own win check, and tickBloomRegrowth's early-exit when the patch is already gone. */
  private hasBloomMat(): boolean {
    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        if (this.map.tiles[y][x] === "bloom_mat") return true;
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
