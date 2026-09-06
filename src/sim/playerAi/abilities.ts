// src/sim/playerAi/abilities.ts
// Ability trigger rules for the Player AI tiers (claude/Bloom_Wars_Player_
// AI_Difficulty_Tiers_Plan_v1.md §4.1, 1 Sep 2026). Before this pass the
// bot never called Ambush, Interdict, Sensor Sweep, Overwatch, Taunt, Fire
// Support or Missiles — every one a real, shipped, tested engine verb
// (engine/mission.ts's canX()/verb pairs, the same ones scenes/Battle.ts's
// action bar calls). The old header's reasoning was sound at the time ("a
// wrong heuristic for a charge-limited ability is worse than an honest
// zero") and it's why each rule here is deliberately the OBVIOUS trigger
// — the situation a competent human would recognise on sight — gated by
// the profile so a tier can switch any of them off. Under-use is the safe
// failure everywhere: a charge held is a charge a real player would also
// have held.
//
// Everything here is a pure read over board state (plus the per-run
// PlayerAiMemory for cooldowns); the driver (sim/driveMission.ts) calls
// the real verb, which re-validates its own canX() — so a rule that fires
// when the engine says no just costs one wasted sub-decision, never an
// illegal move.
import type { Coord, MapDefinition } from "../../data/types";
import type { BattleUnit } from "../../engine/units";
import { chebyshevDistance, chassisToMovementKind, reachableTiles, reconstructPath, tileAt } from "../../engine/grid";
import { occupiedSet, intelligenceOf } from "../../engine/ai";
import { TILES } from "../../data/tiles";
import {
  SENSOR_SWEEP_RANGE_BONUS,
  SENSOR_SWEEP_CHARGES_PER_MISSION,
  SCREEN_RADIUS,
  FIRE_SUPPORT_RADIUS,
  MISSILE_SPLASH_RADIUS,
  MISSILE_CHARGES_PER_MISSION,
  MASER_LANCE_CHARGES_PER_MISSION,
} from "../../data/combatTables";
import { repairRangeFor } from "../../engine/frameSystems";
import type { PlayerAiProfile } from "./profile";
import type { PlayerAiMemory, PlayerAiMissionContext } from "./types";
import { needsFrontLineProtection, isLethalHit } from "./combat";
import { incomingAt, type ThreatMap } from "../../engine/threat";

/** Can `e` end a move on a tile from which it can hit `pos` next turn? The cheap reach proxy the whole file shares (ignores terrain/blocking, like combat.ts's threatCount). */
export function canReachToAttack(e: BattleUnit, pos: Coord): boolean {
  return chebyshevDistance(e.pos, pos) <= e.moveRange + e.attackRange[1];
}

export function threatsOn(pos: Coord, enemies: BattleUnit[]): number {
  return enemies.filter((e) => canReachToAttack(e, pos)).length;
}

function livingVips(unit: BattleUnit, allUnits: BattleUnit[]): BattleUnit[] {
  return allUnits.filter((u) => !u.downed && u.side === unit.side && needsFrontLineProtection(u));
}

export function repairRangeOf(unit: BattleUnit): number {
  // Frame Systems Layer (6 Sep 2026): delegates to the live engine's own
  // rule (engine/frameSystems.ts's repairRangeFor — branches plus both
  // Munti refits) so the bot and repairUnit can't disagree.
  return repairRangeFor(unit);
}

// ---- Sensor Sweep ------------------------------------------------------

export function sweepRadiusOf(unit: BattleUnit): number {
  return unit.vision + SENSOR_SWEEP_RANGE_BONUS;
}

/**
 * Sweep when a hostile the squad can't currently see is inside sweep
 * reach — burrowed, concealed, or simply past vision but inside the
 * sweep's +2 — and this unit hasn't swept within the profile's cooldown.
 * `allEnemies` is the real full list (the bot's own knowledge is fog-
 * honest; the trigger is allowed to know a sweep WOULD find something,
 * the same way a human sweeps because the map "feels" empty — a modest
 * cheat, but it only decides whether to spend a charge, never what to
 * shoot).
 */
export function shouldSensorSweep(unit: BattleUnit, allEnemies: BattleUnit[], visibleIds: Set<string>, turn: number, memory: PlayerAiMemory, profile: PlayerAiProfile): boolean {
  if (!profile.useAbilities.abil_sensor_sweep) return false;
  if (!unit.abilities.includes("abil_sensor_sweep") || unit.actionsRemaining <= 0) return false;
  if ((unit.sensorSweepUsesRemaining ?? SENSOR_SWEEP_CHARGES_PER_MISSION) <= 0) return false;
  const last = memory.lastSweepTurn.get(unit.instanceId);
  if (last !== undefined && turn - last < profile.sweepCooldownTurns) return false;
  const radius = sweepRadiusOf(unit);
  return allEnemies.some((e) => !visibleIds.has(e.instanceId) && chebyshevDistance(unit.pos, e.pos) <= radius);
}

// ---- Hard-tier helpers (hard.ts seam 5 and the Interdict fix) ------------------

/** A taunt drags every hostile that can reach the taunter onto it — so the plain footprint sum IS the incoming. Survivable when it leaves the taunter standing with a margin. */
export function tauntSurvivable(threat: ThreatMap, map: MapDefinition, unit: BattleUnit, allUnits: BattleUnit[]): boolean {
  const inc = incomingAt(threat, map, unit, unit.pos, allUnits);
  if (inc.attackers === 0) return false;
  const pool = unit.currentHp + (unit.shield ?? 0);
  return inc.total <= pool * 0.75 && !isLethalHit(unit, inc.total);
}

/** True when this unit is the player unit the hostile is closest to — the case a brace actually punishes (a Tank bracing while the enemy walks past it toward someone else just stood still for a turn). */
export function isNearestPlayerTo(unit: BattleUnit, hostile: BattleUnit, allUnits: BattleUnit[]): boolean {
  const myDist = chebyshevDistance(hostile.pos, unit.pos);
  return !allUnits.some((u) => !u.downed && u.side === unit.side && u.instanceId !== unit.instanceId && !u.isExtractionTarget && chebyshevDistance(hostile.pos, u.pos) < myDist);
}

// ---- Interdict / Overwatch (the "nothing to shoot, they're coming" pair) ----

export function shouldInterdict(unit: BattleUnit, enemies: BattleUnit[], allUnits: BattleUnit[], profile: PlayerAiProfile): boolean {
  if (!profile.useAbilities.abil_interdict) return false;
  if (!unit.abilities.includes("abil_interdict") || unit.actionsRemaining <= 0 || unit.braced) return false;
  // A hostile that can end its move adjacent to this Tank next turn is
  // exactly what the brace punishes — provided the Tank is the player unit
  // it is closest to. First cut (1 Sep 2026, verbose Mission 1 run) had
  // the Tank bracing every turn while the Bloom walked past it toward the
  // rest of the squad six tiles on: a brace against something heading
  // elsewhere is a turn spent standing still.
  return enemies.some((e) => chebyshevDistance(e.pos, unit.pos) <= e.moveRange + 1 && isNearestPlayerTo(unit, e, allUnits));
}

export function shouldOverwatch(unit: BattleUnit, enemies: BattleUnit[], profile: PlayerAiProfile): boolean {
  if (!profile.useAbilities.overwatch) return false;
  if (unit.actionsRemaining <= 0 || unit.overwatch || unit.carryingRescueId) return false;
  const [minR, maxR] = unit.attackRange;
  // Someone can end a move inside my range next turn, and nobody is in
  // range right now (else the caller would have attacked first).
  return enemies.some((e) => {
    const d = chebyshevDistance(e.pos, unit.pos);
    return d > maxR && d - e.moveRange <= maxR && d - e.moveRange >= Math.min(minR, 1);
  });
}

// ---- Ambush --------------------------------------------------------------

/**
 * Cloak when unseen, healthy, nothing to shoot this turn, and there's an
 * enemy close enough to reach with a decloak strike next turn — and no
 * hurt ally nearby who needs this Meeps' damage right now.
 */
export function shouldAmbush(unit: BattleUnit, enemies: BattleUnit[], allUnits: BattleUnit[], spotted: boolean, hpFraction: number, profile: PlayerAiProfile): boolean {
  if (!profile.useAbilities.abil_ambush) return false;
  if (!unit.abilities.includes("abil_ambush") || unit.actionsRemaining <= 0 || unit.concealed || unit.overwatch) return false;
  if (spotted || hpFraction < profile.retreatHpFraction) return false;
  if (enemies.some((e) => chebyshevDistance(e.pos, unit.pos) <= 1)) return false; // engine refuses in contact
  const strikeReach = unit.moveRange + unit.attackRange[1] + 2;
  if (!enemies.some((e) => chebyshevDistance(e.pos, unit.pos) <= strikeReach)) return false;
  const hurtAllyNear = allUnits.some(
    (u) => !u.downed && u.side === unit.side && u.instanceId !== unit.instanceId && u.maxHp > 0 && u.currentHp / u.maxHp < 0.4 && chebyshevDistance(u.pos, unit.pos) <= 3
  );
  return !hurtAllyNear;
}

// ---- Screen ---------------------------------------------------------------

/** General screen trigger (the narrow clear-bloom one in index.ts stays): two-plus units under the umbrella, and two-plus enemies able to reach any of them next turn. */
export function shouldScreen(unit: BattleUnit, enemies: BattleUnit[], allUnits: BattleUnit[], profile: PlayerAiProfile): boolean {
  if (!profile.useAbilities.abil_screen) return false;
  if (!unit.abilities.includes("abil_screen") || unit.usedScreenThisMission || unit.actionsRemaining <= 0) return false;
  const covered = allUnits.filter((u) => !u.downed && u.side === unit.side && chebyshevDistance(u.pos, unit.pos) <= SCREEN_RADIUS);
  if (covered.length < 2) return false;
  const threatened = enemies.filter((e) => covered.some((c) => canReachToAttack(e, c.pos))).length;
  return threatened >= 2;
}

// ---- Taunt ------------------------------------------------------------------

/**
 * The trigger three previous attempts lacked (build log, 30 Aug 2026):
 * reason about the TAUNTER's own survival odds. Taunt only when a VIP is
 * genuinely reachable next turn, the taunter itself has few enough threats
 * on it, decent HP, and (unless it's on cover) fewer threats still; never
 * against an emergent-tier boss in reach (the ever-spawning fight the
 * earlier attempts died to); never two turns running.
 */
export function shouldTaunt(map: MapDefinition, unit: BattleUnit, enemies: BattleUnit[], allUnits: BattleUnit[], turn: number, hpFraction: number, memory: PlayerAiMemory, profile: PlayerAiProfile, threat?: ThreatMap): boolean {
  if (!profile.useAbilities.abil_taunt) return false;
  if (!unit.abilities.includes("abil_taunt") || unit.actionsRemaining <= 0 || unit.taunting) return false;
  if (needsFrontLineProtection(unit)) return false;
  if (hpFraction < profile.tauntMinHpFraction) return false;
  const last = memory.lastTauntTurn.get(unit.instanceId);
  if (last !== undefined && turn - last < 2) return false;
  const vips = livingVips(unit, allUnits);
  if (!vips.length) return false;
  const vipThreatened = enemies.some((e) => vips.some((v) => canReachToAttack(e, v.pos)));
  if (!vipThreatened) return false;
  const reachMe = enemies.filter((e) => canReachToAttack(e, unit.pos));
  if (reachMe.some((e) => intelligenceOf(e) === "emergent")) return false;
  // Hard (hard.ts seam 5): the real footprint-sum damage decides, not a
  // head count — a taunt pulls everything in reach onto the taunter.
  if (threat) return tauntSurvivable(threat, map, unit, allUnits);
  const stars = TILES[tileAt(map, unit.pos)].defenceStars;
  const cap = stars >= 1 ? profile.tauntMaxThreats : Math.max(1, profile.tauntMaxThreats - 1);
  return reachMe.length > 0 && reachMe.length <= cap;
}

// ---- Fire Support / Missile (tile-targeted strikes) ----------------------------

export interface StrikeChoice {
  tile: Coord;
  hostiles: number;
  score: number;
}

function strikeScoreAt(tile: Coord, radius: number, enemies: BattleUnit[], allUnits: BattleUnit[], caster: BattleUnit, forbidFriendly: boolean): StrikeChoice | null {
  let hostiles = 0;
  let score = 0;
  const vips = livingVips(caster, allUnits);
  for (const e of enemies) {
    if (chebyshevDistance(e.pos, tile) > radius) continue;
    hostiles += 1;
    score += 1;
    if (intelligenceOf(e) === "emergent") score += 2; // a boss is worth a charge on its own
    if (vips.some((v) => canReachToAttack(e, v.pos))) score += 0.5;
  }
  if (hostiles === 0) return null;
  if (forbidFriendly) {
    const friendlyInside = allUnits.some((u) => !u.downed && u.side === caster.side && u.instanceId !== caster.instanceId && chebyshevDistance(u.pos, tile) <= radius);
    if (friendlyInside) return null;
  }
  return { tile, hostiles, score };
}

/** Best Fire Support tile within the caster's vision, or null when nothing meets the profile's bar (or no charge, or one was already called this turn). */
export function chooseFireSupportTile(unit: BattleUnit, enemies: BattleUnit[], allUnits: BattleUnit[], context: PlayerAiMissionContext, turn: number, memory: PlayerAiMemory, profile: PlayerAiProfile, mapW: number, mapH: number): StrikeChoice | null {
  if (!profile.useAbilities.abil_fire_support) return null;
  if (!unit.abilities.includes("abil_fire_support") || unit.actionsRemaining <= 0) return null;
  const charges = context.fireSupportChargesRemaining ?? 0;
  const bonus = context.fireSupportBonusChargeReady?.() ?? false;
  if (charges <= 0 && !bonus) return null;
  if (memory.lastStrikeTurn === turn) return null; // squad-shared pool — one call per turn, max
  if (context.mission.objective === "survive_n_turns" && turn <= 1) return null; // save it for the wave
  let best: StrikeChoice | null = null;
  for (let y = Math.max(0, unit.pos.y - unit.vision); y <= Math.min(mapH - 1, unit.pos.y + unit.vision); y++) {
    for (let x = Math.max(0, unit.pos.x - unit.vision); x <= Math.min(mapW - 1, unit.pos.x + unit.vision); x++) {
      const c = strikeScoreAt({ x, y }, FIRE_SUPPORT_RADIUS, enemies, allUnits, unit, false);
      if (c && (!best || c.score > best.score)) best = c;
    }
  }
  return best && best.score >= profile.strikeMinTargets ? best : null;
}

/** Best Missile tile inside the unit's own attack range, no friendly inside the splash, or null. */
export function chooseMissileTile(unit: BattleUnit, enemies: BattleUnit[], allUnits: BattleUnit[], profile: PlayerAiProfile, mapW: number, mapH: number): StrikeChoice | null {
  if (!profile.useAbilities.abil_missile) return null;
  if (!unit.abilities.includes("abil_missile") || unit.actionsRemaining <= 0) return null;
  if ((unit.missileUsesRemaining ?? MISSILE_CHARGES_PER_MISSION) <= 0) return null;
  const [minR, maxR] = unit.attackRange;
  let best: StrikeChoice | null = null;
  for (let y = Math.max(0, unit.pos.y - maxR); y <= Math.min(mapH - 1, unit.pos.y + maxR); y++) {
    for (let x = Math.max(0, unit.pos.x - maxR); x <= Math.min(mapW - 1, unit.pos.x + maxR); x++) {
      const d = chebyshevDistance(unit.pos, { x, y });
      if (d < minR || d > maxR) continue;
      const c = strikeScoreAt({ x, y }, MISSILE_SPLASH_RADIUS, enemies, allUnits, unit, true);
      if (c && (!best || c.score > best.score)) best = c;
    }
  }
  return best && best.score >= profile.strikeMinTargets ? best : null;
}

// ---- Maser Lance (direction-picked widening cone, not a radius) -----------

/**
 * Score over an already-resolved tile SET (a cone footprint) rather than a
 * radius around one tile — strikeScoreAt's exact scoring rule (hostile count
 * plus the same emergent/VIP-threat bonuses, friendly-avoidance as a hard
 * "skip this option" the way Missile's own forbidFriendly does), just
 * against a shape strikeScoreAt can't express. Not merged into strikeScoreAt
 * itself: that function's whole signature is built around "a tile plus a
 * radius," and bending it to also accept a raw tile list would make the far
 * more common radius call sites read the caller had to think about a shape
 * they never actually have.
 */
function coneScoreOver(tiles: Coord[], enemies: BattleUnit[], allUnits: BattleUnit[], caster: BattleUnit, forbidFriendly: boolean): { hostiles: number; score: number } | null {
  const tileKeys = new Set(tiles.map((t) => `${t.x},${t.y}`));
  let hostiles = 0;
  let score = 0;
  const vips = livingVips(caster, allUnits);
  for (const e of enemies) {
    if (!tileKeys.has(`${e.pos.x},${e.pos.y}`)) continue;
    hostiles += 1;
    score += 1;
    if (intelligenceOf(e) === "emergent") score += 2; // a boss is worth a charge on its own
    if (vips.some((v) => canReachToAttack(e, v.pos))) score += 0.5;
  }
  if (hostiles === 0) return null;
  if (forbidFriendly) {
    const friendlyInside = allUnits.some((u) => !u.downed && u.side === caster.side && u.instanceId !== caster.instanceId && tileKeys.has(`${u.pos.x},${u.pos.y}`));
    if (friendlyInside) return null;
  }
  return { hostiles, score };
}

/**
 * Best Maser Lance direction, or null. Same "obvious trigger, gated by the
 * profile, safe to under-use" shape as chooseMissileTile just above — the
 * one real difference is HOW the candidate footprints are found. Missile
 * scores a radius around every tile in a bounding box it computes itself;
 * a cone can't be summarized that way (the widening-wedge formula lives in
 * engine/mission.ts's maserLanceConeTiles, private on purpose — see
 * PlayerAiMissionContext's own comment on why this file asks the engine
 * for the shape instead of re-deriving it). So this walks
 * context.getMaserLanceDirectionTargets' own candidate list instead of a
 * grid scan, and de-duplicates by the resolved cone itself (every tile
 * along one of the 8 rays previews the identical cone — only the direction
 * matters, never how far out the click landed) so the 8 real directions
 * get scored once each, not once per candidate tile.
 */
export function chooseMaserLanceDirection(unit: BattleUnit, enemies: BattleUnit[], allUnits: BattleUnit[], context: PlayerAiMissionContext, profile: PlayerAiProfile): StrikeChoice | null {
  if (!profile.useAbilities.abil_maser_lance) return null;
  if (!unit.abilities.includes("abil_maser_lance") || unit.actionsRemaining <= 0) return null;
  if ((unit.maserLanceUsesRemaining ?? MASER_LANCE_CHARGES_PER_MISSION) <= 0) return null;
  if (!context.getMaserLanceDirectionTargets || !context.previewMaserLanceCone) return null; // hand-built test contexts that never exercise this mechanism
  const candidates = context.getMaserLanceDirectionTargets(unit.instanceId);
  const seenCones = new Set<string>();
  let best: StrikeChoice | null = null;
  for (const candidate of candidates) {
    const cone = context.previewMaserLanceCone(unit.instanceId, candidate);
    if (!cone || !cone.length) continue;
    const key = cone.map((t) => `${t.x},${t.y}`).join("|");
    if (seenCones.has(key)) continue; // same direction as an earlier candidate — identical footprint, skip the re-score
    seenCones.add(key);
    const scored = coneScoreOver(cone, enemies, allUnits, unit, true);
    if (scored && (!best || scored.score > best.score)) best = { tile: candidate, hostiles: scored.hostiles, score: scored.score };
  }
  return best && best.score >= profile.strikeMinTargets ? best : null;
}

// ---- Repair pathing --------------------------------------------------------

/**
 * A Munti with nobody to heal in range walks into range of the worst
 * ally under the critical bar — onto a tile no known enemy can reach next
 * turn — and heals in the same turn (move + repair = two actions).
 * Returns the path plus the target, or null.
 */
export function repairMove(map: MapDefinition, unit: BattleUnit, allUnits: BattleUnit[], enemies: BattleUnit[], profile: PlayerAiProfile): { path: Coord[]; targetId: string } | null {
  if (!profile.repairPathing || !profile.useAbilities.abil_repair) return null;
  if (!unit.abilities.includes("abil_repair") || unit.actionsRemaining < 2) return null;
  const range = repairRangeOf(unit);
  const hurt = allUnits
    .filter((u) => !u.downed && u.side === unit.side && u.instanceId !== unit.instanceId && u.maxHp > 0 && u.currentHp / u.maxHp < profile.criticalAllyHpFraction)
    .sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp);
  if (!hurt.length) return null;
  const target = hurt[0];
  if (chebyshevDistance(unit.pos, target.pos) <= range) return null; // already in range — the ordinary repair branch handles it
  const movementKind = chassisToMovementKind(unit.chassis ?? "bipedal", false);
  const reachable = reachableTiles(map, unit.pos, unit.moveRange, movementKind, occupiedSet(allUnits, unit.instanceId));
  let bestKey: string | null = null;
  let bestScore = -Infinity;
  for (const [key, entry] of reachable) {
    const [x, y] = key.split(",").map(Number);
    const pos = { x, y };
    if (chebyshevDistance(pos, target.pos) > range) continue;
    const threats = threatsOn(pos, enemies);
    if (threats > 0) continue; // only a safe tile — a Munti walking into a pack is the thing the Munti rule punishes hardest
    const score = -entry.cost + TILES[tileAt(map, pos)].defenceStars;
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }
  if (!bestKey) return null;
  const [x, y] = bestKey.split(",").map(Number);
  const path = reconstructPath(reachable, { x, y });
  return path.length > 1 ? { path, targetId: target.instanceId } : null;
}

// ---- Exploration (fog-honest and nothing in sight) ---------------------------

/** Where to look when nothing is visible: the nearest enemy spawn seam or enemy deploy tile — where the Bloom comes from. Null when the map has neither. */
export function explorationTarget(map: MapDefinition, from: Coord): Coord | null {
  const candidates: Coord[] = [...(map.deployZones?.enemy ?? [])];
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (map.tiles[y][x] === "spawn") candidates.push({ x, y });
  if (!candidates.length) return null;
  return candidates.reduce((best, c) => (chebyshevDistance(from, c) < chebyshevDistance(from, best) ? c : best));
}
