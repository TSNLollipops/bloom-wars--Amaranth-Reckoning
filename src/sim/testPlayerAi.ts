// src/sim/testPlayerAi.ts
// A test-only stand-in for a human player, used by src/sim/run.ts to
// autoplay the player side. This is NOT part of the real hostile-AI tiers
// in engine/ai.ts and is never imported by mission.ts or Battle.ts — it
// exists purely so mission-balance numbers from the sim harness mean
// something closer to "how a careful human would do" instead of "how long
// a reflexive bot stalls."
//
// Background (Maxime, 22 Aug 2026): engine/ai.ts's reflexive/pack tiers
// were just made vision-gated (see the comment on isVisibleTo there) so
// hostile units stop knowing the player's position from across the map.
// That's correct for real hostile AI, but it means the OLD trick of
// autoplaying the player side with that same code (decideHostileAction)
// now stalls on missions where the player deploy zone and the first enemy
// wave start outside everyone's vision (Mission 1a specifically — 17 tiles
// apart, nobody ever spots anybody, sim just times out). A human wouldn't
// stall like that; they'd advance. This module is the fix: a small,
// heuristic "decent test dummy" that
//   1. has full-map awareness (deliberately NOT vision-gated — it's a QA
//      stand-in, not a fairness-matched opponent, so it's allowed to know
//      where the fight is and go find it),
//   2. focus-fires the weakest reachable target instead of just the
//      nearest one,
//   3. knows a Bloom with endurance remaining literally cannot be killed
//      in one hit no matter the damage (Data Pack §8.3's Collapse rule —
//      overflow damage does not carry from Endurance into Vitality), so it
//      doesn't misjudge "kill" opportunities against Bloom the way a naive
//      currentHp check would,
//   4. keeps ranged units (attackRange[0] >= 2 — Reeps, currently) at the
//      far edge of their range instead of walking into melee distance for
//      no reason,
//   5. retreats instead of pressing a fight at low HP when it has no kill
//      available and somewhere safer to go.
//
// Explicitly NOT attempted here (would be real scope, not "for testing"
// scope): repair/support usage (the AiDecision shape has no repair verb —
// same limitation decideHostileAction already has), ability/Heirloom
// usage, terrain-aware threat beyond a flat move+range radius, or any
// multi-turn planning (Bloom-collapse sequencing, baiting, focus-fire
// coordination across units within one turn).
//
// Every decision is logged to `testAiLog` — Maxime asked for this so the
// heuristics here (or the log format) can be pulled on later for
// multiplayer-map bot opponents, not just mission-balance testing. Call
// `resetTestAiLog()` before a run; read `testAiLog` after.
import type { Coord, MapDefinition } from "../data/types";
import type { BattleUnit } from "../engine/units";
import { chebyshevDistance, chassisToMovementKind, reachableTiles, reconstructPath } from "../engine/grid";
import {
  type AiDecision,
  livingTargets,
  occupiedSet,
  estimateDamage,
  bestAttackTargetInRange,
  moveToward,
} from "../engine/ai";

/** Below this HP fraction, prefer disengaging over pressing a fight that isn't a guaranteed kill. */
const RETREAT_HP_FRACTION = 0.3;

export type TestAiReason =
  | "kill" // a reachable target dies to this attack this turn
  | "focus_weak" // attacked the weakest in-range target (no kill available)
  | "advance_into_range" // moved to close distance, attacking on arrival if possible
  | "seek_fight" // nothing in range yet, closing distance on the weakest target
  | "retreat_low_hp" // below RETREAT_HP_FRACTION with no kill available — fell back
  | "hold_cornered" // wanted to retreat but nowhere safer was reachable — fought anyway
  | "hold_no_target"; // no living enemies at all

export interface TestAiLogEntry {
  turn: number;
  unitId: string;
  displayName: string;
  hpFraction: number;
  reason: TestAiReason;
  targetId?: string;
  targetName?: string;
  destination?: Coord;
  note?: string;
}

export const testAiLog: TestAiLogEntry[] = [];

export function resetTestAiLog(): void {
  testAiLog.length = 0;
}

function log(entry: TestAiLogEntry): void {
  testAiLog.push(entry);
}

function lastStep(path: Coord[]): Coord {
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
function isLethalHit(target: BattleUnit, dmg: number): boolean {
  if (target.kind === "bloom") {
    if (!target.collapsed) return false;
    return dmg >= (target.vitality ?? 0);
  }
  return dmg >= target.currentHp;
}

function weakestTarget(targets: BattleUnit[]): BattleUnit {
  return targets.reduce((best, t) => (t.currentHp * t.effectiveDefense < best.currentHp * best.effectiveDefense ? t : best));
}

function findLethalTargetFrom(map: MapDefinition, unit: BattleUnit, from: Coord, targets: BattleUnit[], allUnits: BattleUnit[]): BattleUnit | undefined {
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

function retreatPath(map: MapDefinition, unit: BattleUnit, enemies: BattleUnit[], allUnits: BattleUnit[]): Coord[] | null {
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

/** Like engine/ai.ts's reachableWithinRangeTile, but ranged units (attackRange[0] >= 2) prefer the FAR edge of their range instead of the cheapest tile — kiting instead of walking into melee for no reason. */
function reachableIntoRangePreferringSafety(map: MapDefinition, unit: BattleUnit, targetPos: Coord, allUnits: BattleUnit[]): Coord[] | null {
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

export function decideTestPlayerAction(map: MapDefinition, unit: BattleUnit, allUnits: BattleUnit[], turn: number): AiDecision {
  const enemies = livingTargets(allUnits, "hostile"); // full awareness — see file header
  const hpFraction = unit.maxHp > 0 ? unit.currentHp / unit.maxHp : 1;

  if (!enemies.length) {
    log({ turn, unitId: unit.instanceId, displayName: unit.displayName, hpFraction, reason: "hold_no_target" });
    return {};
  }

  // Guaranteed kill in place beats everything, even at low HP.
  const killNow = findLethalTargetFrom(map, unit, unit.pos, enemies, allUnits);
  if (killNow) {
    log({
      turn,
      unitId: unit.instanceId,
      displayName: unit.displayName,
      hpFraction,
      reason: "kill",
      targetId: killNow.instanceId,
      targetName: killNow.displayName,
    });
    return { attackTargetId: killNow.instanceId };
  }

  // Low HP, no kill on the table this turn — fall back if there's somewhere safer.
  if (hpFraction < RETREAT_HP_FRACTION) {
    const path = retreatPath(map, unit, enemies, allUnits);
    if (path && path.length > 1) {
      log({
        turn,
        unitId: unit.instanceId,
        displayName: unit.displayName,
        hpFraction,
        reason: "retreat_low_hp",
        destination: lastStep(path),
        note: `${Math.round(hpFraction * 100)}% hp, no kill available`,
      });
      return { path };
    }
    log({
      turn,
      unitId: unit.instanceId,
      displayName: unit.displayName,
      hpFraction,
      reason: "hold_cornered",
      note: `${Math.round(hpFraction * 100)}% hp, nowhere safer reachable — fighting anyway`,
    });
    // fall through — no safe retreat, so fight from here same as normal
  }

  // No kill in place — attack the weakest reachable target instead (focus fire).
  const inPlace = bestAttackTargetInRange(map, unit, unit.pos, [weakestTarget(enemies), ...enemies], allUnits);
  if (inPlace) {
    log({
      turn,
      unitId: unit.instanceId,
      displayName: unit.displayName,
      hpFraction,
      reason: "focus_weak",
      targetId: inPlace.instanceId,
      targetName: inPlace.displayName,
    });
    return { attackTargetId: inPlace.instanceId };
  }

  // Nothing in range from here — close on the weakest target, preferring a safe (ranged-kiting-aware) tile.
  const goal = weakestTarget(enemies);
  const pathIntoRange = reachableIntoRangePreferringSafety(map, unit, goal.pos, allUnits);
  if (pathIntoRange) {
    const dest = lastStep(pathIntoRange);
    const atDest = findLethalTargetFrom(map, unit, dest, enemies, allUnits) ?? bestAttackTargetInRange(map, unit, dest, enemies, allUnits);
    log({
      turn,
      unitId: unit.instanceId,
      displayName: unit.displayName,
      hpFraction,
      reason: "advance_into_range",
      targetId: atDest?.instanceId,
      targetName: atDest?.displayName,
      destination: dest,
    });
    return { path: pathIntoRange, attackTargetId: atDest?.instanceId };
  }

  // Still too far — just close the distance.
  const path = moveToward(map, unit, goal.pos, allUnits);
  log({
    turn,
    unitId: unit.instanceId,
    displayName: unit.displayName,
    hpFraction,
    reason: "seek_fight",
    targetId: goal.instanceId,
    targetName: goal.displayName,
    destination: path.length > 1 ? lastStep(path) : undefined,
  });
  return { path };
}
