// src/engine/ai.ts
// Build Brief step 7 / GDD §5.3. Three tiers, each a strategy selected by
// intelligence (or, for hostile mechs, the "reflexive-equivalent" behaviour
// Data Pack §9 specifies: nearest target, best damage, no coordination) —
// not a branch inside one function.
import type { Coord, MapDefinition } from "../data/types";
import type { BattleUnit } from "./units";
import { BLOOM, SPLITFANG_PACK_RADIUS } from "../data/bloom";
import { chebyshevDistance, chassisToMovementKind, reachableTiles, reconstructPath, coordKey, isStraightLineCharge } from "./grid";
import { resolveMechAttack, resolveAttackOnBloom, bloomDamage } from "./combat";

export interface AiDecision {
  path?: Coord[]; // full path incl. start; last element is the move destination
  attackTargetId?: string;
}

export type IntelligenceTier = "reflexive" | "pack" | "emergent";

export function intelligenceOf(unit: BattleUnit): IntelligenceTier {
  if (unit.kind !== "bloom") return "reflexive"; // hostile mechs: reflexive-equivalent, Data Pack §9
  return BLOOM[unit.archetypeId]?.intelligence ?? "reflexive";
}

function livingTargets(units: BattleUnit[], side: BattleUnit["side"]): BattleUnit[] {
  return units.filter((u) => u.side === side && !u.downed);
}

/** The opposing side — this module is symmetric (Build Brief calls it "the AI", but the same reflexive/pack/emergent logic drives the headless sim's player-side autoplay too). */
function enemySideOf(unit: BattleUnit): BattleUnit["side"] {
  return unit.side === "player" ? "hostile" : "player";
}

function occupiedSet(units: BattleUnit[], exclude: string): Set<string> {
  const s = new Set<string>();
  for (const u of units) if (!u.downed && u.instanceId !== exclude) s.add(coordKey(u.pos));
  return s;
}

/** Estimate prospective damage this unit would deal to `target` from `attackFrom`, for target-picking only — does not mutate state. */
function estimateDamage(map: MapDefinition, unit: BattleUnit, target: BattleUnit, allUnits: BattleUnit[]): number {
  const sameSide = allUnits.filter((u) => u.side === unit.side);
  const targetSameSide = allUnits.filter((u) => u.side === target.side);
  if (unit.kind === "bloom") {
    return bloomDamage(unit, target, map, targetSameSide, false);
  }
  if (target.kind === "bloom") {
    return resolveAttackOnBloom(map, unit, target, targetSameSide, false).damage;
  }
  return resolveMechAttack(map, unit, target, targetSameSide, sameSide, false).damage;
}

function bestAttackTargetInRange(map: MapDefinition, unit: BattleUnit, from: Coord, targets: BattleUnit[], allUnits: BattleUnit[]): BattleUnit | undefined {
  const [minR, maxR] = unit.attackRange;
  const inRange = targets.filter((t) => {
    const d = chebyshevDistance(from, t.pos);
    return d >= minR && d <= maxR;
  });
  if (!inRange.length) return undefined;
  // "attack whichever in-range target takes the most damage" — reflexive rule, GDD §5.3.
  let best = inRange[0];
  let bestDmg = -1;
  for (const t of inRange) {
    const savedPos = unit.pos;
    unit.pos = from; // estimate from the candidate destination
    const dmg = estimateDamage(map, unit, t, allUnits);
    unit.pos = savedPos;
    if (dmg > bestDmg) {
      bestDmg = dmg;
      best = t;
    }
  }
  return best;
}

function moveToward(map: MapDefinition, unit: BattleUnit, target: Coord, allUnits: BattleUnit[]): Coord[] {
  const kind = chassisToMovementKind(unit.chassis ?? "bipedal", unit.kind === "bloom" ? false : false);
  const flying = unit.kind === "bloom" && BLOOM[unit.archetypeId]?.movementType === "flight_membrane";
  const movementKind = flying ? "flying" : kind;
  const reachable = reachableTiles(map, unit.pos, unit.moveRange, movementKind, occupiedSet(allUnits, unit.instanceId));
  let bestTile: Coord = unit.pos;
  let bestDist = chebyshevDistance(unit.pos, target);
  for (const key of reachable.keys()) {
    const [x, y] = key.split(",").map(Number);
    const d = chebyshevDistance({ x, y }, target);
    if (d < bestDist) {
      bestDist = d;
      bestTile = { x, y };
    }
  }
  return reconstructPath(reachable, bestTile);
}

function reachableWithinRangeTile(map: MapDefinition, unit: BattleUnit, target: Coord, allUnits: BattleUnit[]): Coord[] | null {
  const flying = unit.kind === "bloom" && BLOOM[unit.archetypeId]?.movementType === "flight_membrane";
  const movementKind = flying ? "flying" : chassisToMovementKind(unit.chassis ?? "bipedal", false);
  const reachable = reachableTiles(map, unit.pos, unit.moveRange, movementKind, occupiedSet(allUnits, unit.instanceId));
  const [minR, maxR] = unit.attackRange;
  let bestTile: Coord | null = null;
  let bestCost = Infinity;
  for (const [key, entry] of reachable) {
    const [x, y] = key.split(",").map(Number);
    const d = chebyshevDistance({ x, y }, target);
    if (d >= minR && d <= maxR && entry.cost < bestCost) {
      bestCost = entry.cost;
      bestTile = { x, y };
    }
  }
  return bestTile ? reconstructPath(reachable, bestTile) : null;
}

function reflexiveDecision(map: MapDefinition, unit: BattleUnit, allUnits: BattleUnit[]): AiDecision {
  const targets = livingTargets(allUnits, enemySideOf(unit));
  if (!targets.length) return {};
  targets.sort((a, b) => chebyshevDistance(unit.pos, a.pos) - chebyshevDistance(unit.pos, b.pos));
  const nearest = targets[0];

  const inPlaceTarget = bestAttackTargetInRange(map, unit, unit.pos, targets, allUnits);
  if (inPlaceTarget) return { attackTargetId: inPlaceTarget.instanceId };

  const pathIntoRange = reachableWithinRangeTile(map, unit, nearest.pos, allUnits);
  if (pathIntoRange) {
    const dest = pathIntoRange[pathIntoRange.length - 1];
    const target = bestAttackTargetInRange(map, unit, dest, targets, allUnits);
    return { path: pathIntoRange, attackTargetId: target?.instanceId };
  }

  const path = moveToward(map, unit, nearest.pos, allUnits);
  return { path };
}

function sharedPackTarget(_map: MapDefinition, unit: BattleUnit, allUnits: BattleUnit[]): BattleUnit | undefined {
  const targets = livingTargets(allUnits, enemySideOf(unit));
  if (!targets.length) return undefined;
  // "lowest (HP x DEF) wins" — GDD §5.3.
  return targets.reduce((best, t) => (t.currentHp * t.effectiveDefense < best.currentHp * best.effectiveDefense ? t : best));
}

function packDecision(map: MapDefinition, unit: BattleUnit, allUnits: BattleUnit[]): AiDecision {
  const target = sharedPackTarget(map, unit, allUnits);
  if (!target) return {};

  const targets = [target];
  const inPlaceTarget = bestAttackTargetInRange(map, unit, unit.pos, targets, allUnits);
  if (inPlaceTarget) return { attackTargetId: inPlaceTarget.instanceId };

  const pathIntoRange = reachableWithinRangeTile(map, unit, target.pos, allUnits);
  if (pathIntoRange) {
    return { path: pathIntoRange, attackTargetId: target.instanceId };
  }
  return { path: moveToward(map, unit, target.pos, allUnits) };
}

function emergentDecision(map: MapDefinition, unit: BattleUnit, allUnits: BattleUnit[]): AiDecision {
  // Prioritise the Munti above all other targets (GDD §5.3 / Data Pack §8.1).
  const targets = livingTargets(allUnits, enemySideOf(unit));
  if (!targets.length) return {};
  const munti = targets.find((t) => t.path === "munti");

  const [minR, maxR] = unit.attackRange;
  if (munti) {
    const d = chebyshevDistance(unit.pos, munti.pos);
    if (d >= minR && d <= maxR) return { attackTargetId: munti.instanceId };
  }
  const inRange = bestAttackTargetInRange(map, unit, unit.pos, targets, allUnits);
  if (inRange) return { attackTargetId: inRange.instanceId };
  // The Heartwood (the only emergent unit in the slice) has moveRange 0 —
  // it never repositions. If nothing valid is in range, it passes.
  if (unit.moveRange === 0) return {};
  return { path: moveToward(map, unit, (munti ?? targets[0]).pos, allUnits) };
}

export function decideHostileAction(map: MapDefinition, unit: BattleUnit, allUnits: BattleUnit[]): AiDecision {
  const tier = intelligenceOf(unit);
  if (tier === "pack") {
    // Only coordinate if at least one same-side pack-tier ally is within
    // SPLITFANG_PACK_RADIUS — otherwise behave reflexively.
    const nearbyPack = allUnits.some(
      (u) => u !== unit && u.side === unit.side && !u.downed && intelligenceOf(u) === "pack" && chebyshevDistance(u.pos, unit.pos) <= SPLITFANG_PACK_RADIUS
    );
    return nearbyPack ? packDecision(map, unit, allUnits) : reflexiveDecision(map, unit, allUnits);
  }
  if (tier === "emergent") return emergentDecision(map, unit, allUnits);
  return reflexiveDecision(map, unit, allUnits);
}

export function checkChargeForPath(map: MapDefinition, unit: BattleUnit, path: Coord[]): boolean {
  if (unit.chassis !== "centauroid") return false;
  const kind = chassisToMovementKind(unit.chassis, false);
  return isStraightLineCharge(map, path, kind);
}
