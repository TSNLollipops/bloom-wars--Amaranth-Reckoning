// src/sim/playerAi/combat.ts
// Targeting, threat-estimation and positioning helpers for the Player AI
// engine — ported unchanged in effect from the old sim/testPlayerAi.ts
// (25 Aug 2026 restructure; see index.ts's header for why this became its
// own directory). Deliberately reuses engine/ai.ts's own damage math and
// pathfinding (livingTargets/occupiedSet/estimateDamage/
// bestAttackTargetInRange/moveToward/isVisibleTo) rather than forking it —
// the same anti-duplication call this project has made before
// (pilotRegistry.ts, ALL_HOSTILE_MECHS, scenes/shop/ShopPanel.ts): one
// place computes "how much damage would this attack do," and both the real
// hostile AI and this engine read it.
import type { Coord, MapDefinition } from "../../data/types";
import type { BattleUnit } from "../../engine/units";
import { chebyshevDistance, chassisToMovementKind, reachableTiles, reconstructPath } from "../../engine/grid";
import { estimateDamage, occupiedSet } from "../../engine/ai";

/** Below this HP fraction, prefer disengaging over pressing a fight that isn't a guaranteed kill. */
export const RETREAT_HP_FRACTION = 0.3;

export function lastStep(path: Coord[]): Coord {
  return path[path.length - 1];
}

/**
 * Data Pack §8.3: while a Bloom's Endurance is above zero, damage only
 * reduces Endurance and the overflow is discarded — Vitality (the actual
 * kill threshold) is untouched and `downed` never gets set, regardless of
 * how large the hit is. Only once collapsed (Endurance === 0) does damage
 * reach Vitality and a hit >= remaining Vitality actually kill it. A naive
 * "estimatedDamage >= currentHp" check would wrongly call a big hit on a
 * full-Endurance Bloom a kill; this is the corrected version.
 */
export function isLethalHit(target: BattleUnit, dmg: number): boolean {
  if (target.kind === "bloom") {
    if (!target.collapsed) return false;
    return dmg >= (target.vitality ?? 0);
  }
  return dmg >= target.currentHp;
}

export function weakestTarget(targets: BattleUnit[]): BattleUnit {
  return targets.reduce((best, t) => (t.currentHp * t.effectiveDefense < best.currentHp * best.effectiveDefense ? t : best));
}

export function findLethalTargetFrom(map: MapDefinition, unit: BattleUnit, from: Coord, targets: BattleUnit[], allUnits: BattleUnit[]): BattleUnit | undefined {
  const [minR, maxR] = unit.attackRange;
  const inRange = targets.filter((t) => {
    const d = chebyshevDistance(from, t.pos);
    return d >= minR && d <= maxR;
  });
  const savedPos = unit.pos;
  unit.pos = from; // estimate as if already standing at the candidate tile
  const lethal = inRange.find((t) => isLethalHit(t, estimateDamage(map, unit, t, allUnits)));
  unit.pos = savedPos;
  return lethal;
}

/** How many enemies could plausibly reach and attack this tile next turn — a cheap proxy (ignores terrain/blocking), used only as a tie-break. */
function threatCount(pos: Coord, enemies: BattleUnit[]): number {
  return enemies.filter((e) => chebyshevDistance(e.pos, pos) <= e.moveRange + e.attackRange[1]).length;
}

export function retreatPath(map: MapDefinition, unit: BattleUnit, enemies: BattleUnit[], allUnits: BattleUnit[]): Coord[] | null {
  const movementKind = chassisToMovementKind(unit.chassis ?? "bipedal", false);
  const reachable = reachableTiles(map, unit.pos, unit.moveRange, movementKind, occupiedSet(allUnits, unit.instanceId));
  const currentNearest = Math.min(...enemies.map((e) => chebyshevDistance(unit.pos, e.pos)));
  let bestTile: Coord | null = null;
  let bestScore = -Infinity;
  for (const key of reachable.keys()) {
    const [x, y] = key.split(",").map(Number);
    const pos = { x, y };
    const nearestDist = Math.min(...enemies.map((e) => chebyshevDistance(pos, e.pos)));
    const score = nearestDist * 10 - threatCount(pos, enemies);
    if (score > bestScore) {
      bestScore = score;
      bestTile = pos;
    }
  }
  if (!bestTile) return null;
  const bestNearest = Math.min(...enemies.map((e) => chebyshevDistance(bestTile as Coord, e.pos)));
  if (bestNearest <= currentNearest) return null; // nothing actually safer to reach
  return reconstructPath(reachable, bestTile);
}

/** Like engine/ai.ts's reachableWithinRangeTile, but ranged units (attackRange[0] >= 2) prefer the FAR edge of their range instead of the cheapest tile — kiting instead of walking into melee distance for no reason. */
export function reachableIntoRangePreferringSafety(map: MapDefinition, unit: BattleUnit, targetPos: Coord, allUnits: BattleUnit[]): Coord[] | null {
  const movementKind = chassisToMovementKind(unit.chassis ?? "bipedal", false);
  const reachable = reachableTiles(map, unit.pos, unit.moveRange, movementKind, occupiedSet(allUnits, unit.instanceId));
  const [minR, maxR] = unit.attackRange;
  const preferMaxRange = minR >= 2;
  let bestTile: Coord | null = null;
  let bestScore = -Infinity;
  for (const [key, entry] of reachable) {
    const [x, y] = key.split(",").map(Number);
    const pos = { x, y };
    const d = chebyshevDistance(pos, targetPos);
    if (d < minR || d > maxR) continue;
    const score = preferMaxRange ? d * 100 - entry.cost : -entry.cost * 100 - d;
    if (score > bestScore) {
      bestScore = score;
      bestTile = pos;
    }
  }
  return bestTile ? reconstructPath(reachable, bestTile) : null;
}
