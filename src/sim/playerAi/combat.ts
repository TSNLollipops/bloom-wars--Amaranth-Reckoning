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
import { chebyshevDistance, chassisToMovementKind, reachableTiles, reconstructPath, coordKey, distanceField, tileAt } from "../../engine/grid";
import { estimateDamage, occupiedSet, moveToward, isVisibleTo } from "../../engine/ai";
import { TILES } from "../../data/tiles";

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

// ---- Terrain / cover (25 Aug 2026, Maxime: "teach the ai to traverse
// terrain, use cover") ----
//
// data/tiles.ts's defenceStars is real, already-live combat data —
// engine/combat.ts's terrainStars()/1-0.1*(terrainStars+overshieldBonus)
// already gives every attack a real 10%-per-star damage reduction to
// whoever's standing on the defender's tile (ridge is 4 stars, structure
// 3, rubble 2, open scrub/road 0) — the AI just never once asked "which of
// my reachable tiles is actually defensible" when choosing where to end a
// move. That's the whole gap: the combat math already rewards good
// ground, only the positioning logic was blind to it. bloom_mat's
// turnStartDamage (5, ticking every turn a unit lingers there) is the
// other half — a tile can look cheap to reach and still be a bad place to
// stop and fight from.
//
// Deliberately a SCORING NUDGE, not a hard filter: folded into the
// existing distance/cost scores in retreatPath, reachableIntoRangePreferringSafety
// and regroupPath below at a small fixed weight, so it breaks ties between
// similarly-good tiles toward the defensible one without ever overriding a
// genuinely better tactical position (a ranged unit's kiting distance, or a
// retreat that's actually farther from every threat, still wins outright —
// cover is the tiebreaker, not the point).
//
// Weight correction (25 Aug 2026, same day — caught by the 64-run stress
// test, not eyeballed): the first cut of this used *3 (retreatPath) and
// *15 (reachableIntoRangePreferringSafety). Sounds small; wasn't. Both
// functions score reachable tiles against a *100-or-*10-per-tile distance/
// cost term specifically so that term dominates — but terrainQuality's own
// spread is a full 7 points (defenceStars 0-4, or -3 for a damage tile), so
// *15 could swing a tile's score by up to 105 — comparable to or bigger
// than the 100-per-tile-of-cost term it was supposed to be a tiebreaker
// UNDER. In practice that meant reachableIntoRangePreferringSafety would
// happily pick a farther, higher-cost "defensible" tile over the tile that
// actually kept the squad together, and different units in the same squad
// would each independently drift toward whichever bit of cover was nearest
// to THEM — quietly undoing the squad-cohesion fix from earlier the same
// day, just through positioning instead of through seek_fight (which the
// cohesion cap already covers). Confirmed against the actual failure mode:
// a healer (Lask) dropped to 10% hp by turn 5 of a mission that used to be
// a comfortable win, with the squad scattered onto separate tiles instead
// of holding a line. Weights are now *1 (retreatPath, regroupPath) and *3
// (reachableIntoRangePreferringSafety, which already has its own *100
// dominant term) — genuinely small enough to only ever break a near-tie,
// matching what the comment above always claimed this was.

/** Rough "is this tile worth ending a turn on" score: defenceStars (0-4) minus a real penalty for standing on damaging terrain (bloom_mat's turnStartDamage). Not a probability or a damage number — just a comparable score for ranking reachable tiles against each other. */
function terrainQuality(map: MapDefinition, pos: Coord): number {
  const def = TILES[tileAt(map, pos)];
  let score = def.defenceStars;
  if (def.turnStartDamage) score -= 3; // meaningfully discourage lingering on a damage tile, but don't forbid it outright — sometimes it's still the only reachable option
  return score;
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
    const score = nearestDist * 10 - threatCount(pos, enemies) + terrainQuality(map, pos);
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
    const score = (preferMaxRange ? d * 100 - entry.cost : -entry.cost * 100 - d) + terrainQuality(map, pos) * 3;
    if (score > bestScore) {
      bestScore = score;
      bestTile = pos;
    }
  }
  return bestTile ? reconstructPath(reachable, bestTile) : null;
}

// ---- Regroup-toward-safety (25 Aug 2026, same terrain/cover pass — found
// during stress-testing, not asked for directly) ----
//
// index.ts's regroup_low_hp branch used to hand this straight to
// engine/ai.ts's plain moveToward(unit, ally.pos) — "just walk toward your
// nearest living ally," no awareness of whether doing so walked back into
// a hostile's sensor range. That's fine in isolation, but retreat_low_hp
// (just above) only fires while the unit is currently spotted, and stops
// firing the instant it isn't — so a unit that had just broken contact by
// retreating would, the very next turn, get pulled by plain moveToward
// straight back toward its ally's position, which is usually near the
// fight, re-entering someone's vision and re-arming retreat_low_hp for the
// turn after that. Confirmed against an actual captured log (Foxfire,
// Mission 1): retreat_low_hp and regroup_low_hp alternated for 6+ turns
// straight, round-tripping between the same two tiles while a Crawlmass
// kept taking free shots — never the 500-turn ONGOING deadlock (each hop
// was "genuine progress" by the old length>1 check, just progress in
// opposite directions), so the earlier 64-run stress pass didn't catch it;
// it only shows up as depressed win rate and inflated turn counts, which is
// what actually surfaced it here.
//
// Fix: score reachable tiles the same way retreatPath does (closing the
// gap to the ally is the dominant term — this is still fundamentally "get
// back to the squad"), but penalize any candidate tile a hostile would
// actually see the unit standing on (isVisibleTo, simulated the same way
// findLethalTargetFrom simulates a candidate position above). Terrain is a
// light last tiebreak, same weight class as retreatPath's. If every
// reachable tile that makes progress toward the ally is exposed, this
// still picks the least-bad one rather than refusing to move — a real
// player boxed in with no covered approach has to commit too — but that's
// now the genuine last resort, not the routine case.
//
// Exposure penalty correction (25 Aug 2026, same day, caught the same way
// the terrain weights above were — a stress-test batch, not eyeballing):
// the first cut used -100, hard enough to always beat allyDist's own
// *10-per-tile term regardless of how much detour that cost. That traded
// one bug for a quieter one — instead of round-tripping, a low-hp unit
// would take the longest way round to stay permanently unseen, one
// cautious tile at a time, "genuine progress" (bestAllyDist < currentAllyDist)
// technically satisfied every single turn so it never fell into the null
// fallback, but a mission that used to resolve in ~20-30 turns started
// occasionally stretching past 400. Confirmed by isolating this one change
// against the others in this file (terrain weight, focusFireTargetInRange's
// damage filter) across n=20 batches: only reverting this exposure penalty
// brought turn counts back down, the other two didn't move it. -20 still
// reliably wins a close call (worth giving up ~2 tiles of ally-progress to
// not walk back into a hostile's sensor range) without being able to
// outweigh a real, direct route home.
export function regroupPath(map: MapDefinition, unit: BattleUnit, ally: BattleUnit, enemies: BattleUnit[], allUnits: BattleUnit[], turn: number): Coord[] | null {
  const movementKind = chassisToMovementKind(unit.chassis ?? "bipedal", false);
  const reachable = reachableTiles(map, unit.pos, unit.moveRange, movementKind, occupiedSet(allUnits, unit.instanceId));
  const currentAllyDist = chebyshevDistance(unit.pos, ally.pos);
  const savedPos = unit.pos;
  let bestTile: Coord | null = null;
  let bestScore = -Infinity;
  for (const key of reachable.keys()) {
    const [x, y] = key.split(",").map(Number);
    const pos = { x, y };
    unit.pos = pos; // simulate standing here for the visibility check
    const exposed = enemies.some((e) => isVisibleTo(e, unit, turn));
    unit.pos = savedPos;
    const allyDist = chebyshevDistance(pos, ally.pos);
    const score = -allyDist * 10 - (exposed ? 20 : 0) + terrainQuality(map, pos);
    if (score > bestScore) {
      bestScore = score;
      bestTile = pos;
    }
  }
  if (!bestTile) return null;
  const bestAllyDist = chebyshevDistance(bestTile, ally.pos);
  if (bestAllyDist >= currentAllyDist) return null; // no genuine progress toward the squad
  return reconstructPath(reachable, bestTile);
}

// ---- Focus fire (25 Aug 2026, Maxime: "teach the ai to... focus fire") --
//
// engine/ai.ts's bestAttackTargetInRange answers "which in-range target
// does THIS attacker hit hardest" — the reflexive rule, GDD §5.3, and
// correct for the real hostile AI it's shared with. It's the wrong
// question for a coordinated squad: two different units can have two
// different "hits hardest" answers (different weapons, different
// type-effectiveness against different targets) and end up splitting fire
// across two half-dead enemies instead of finishing one — which is worse
// for the squad even when each individual shot was locally optimal.
// focusFireTargetInRange instead answers "which in-range target is the
// squad's shared priority" using weakestTarget's own intrinsic
// (attacker-independent) effective-HP measure — the same measure already
// used to pick a target to chase in the first place — so every unit
// asking this question in the same turn converges on the same answer.
//
// Damageable-only filter (25 Aug 2026, found the same stress-testing pass
// as regroupPath above, same root cause class): weakestTarget's own
// measure is intrinsic to the TARGET (currentHp * effectiveDefense) and
// has no idea whether THIS attacker can actually hurt it — unlike
// engine/ai.ts's bestAttackTargetInRange, which is attacker-relative and
// so naturally never "chooses" a target it does zero damage to as long as
// literally any other option exists. engine/combat.ts's terrain/overshield
// reduction, and resolveAttackOnBloom's own attacker-currentHp scaling
// (a badly wounded mech hits softer), can both legitimately floor a real
// hit at 0 — and a squad's "weakest" target by raw stats can absolutely be
// one this specific attacker can't touch. Confirmed against a captured
// 500-turn ONGOING sim run (Mission 1): Farsight, critically wounded and
// unspotted (so the retreat gate above never opened), kept finding SOME
// Crawlmass "in range" every single turn and re-attacking it for 0 damage
// 489 times straight — the mission never resolved because nothing ever
// actually happened. Filtering to targets this attacker can genuinely
// damage (falling through to undefined, not to the full list, when none
// qualify) is what lets index.ts's low-hp regroup fallback actually get a
// turn instead of being permanently pre-empted by a useless "successful"
// attack.
/** Among `targets` actually in this unit's attack range from `from` AND that this attacker can deal real damage to, the squad's shared priority target (weakestTarget's own intrinsic measure) — or undefined if nothing qualifies (including "everything in range is undamageable from here," deliberately not falling back to a 0-damage attack — see header above). */
export function focusFireTargetInRange(map: MapDefinition, unit: BattleUnit, from: Coord, targets: BattleUnit[], allUnits: BattleUnit[]): BattleUnit | undefined {
  const [minR, maxR] = unit.attackRange;
  const inRange = targets.filter((t) => {
    const d = chebyshevDistance(from, t.pos);
    return d >= minR && d <= maxR;
  });
  if (!inRange.length) return undefined;
  const savedPos = unit.pos;
  unit.pos = from; // estimate as if already standing at the candidate tile, same trick as findLethalTargetFrom above
  const damageable = inRange.filter((t) => estimateDamage(map, unit, t, allUnits) > 0);
  unit.pos = savedPos;
  return damageable.length ? weakestTarget(damageable) : undefined;
}

// ---- Squad cohesion (25 Aug 2026, Maxime: "wierd mission 1 is easy") ----
//
// Root-caused against the actual sim log, not guessed at: Mission 1 (6
// Crawlmass vs. a 5-unit squad — should be trivial) was losing because the
// old seek_fight logic picked a path toward the nearest/weakest enemy per
// unit, with zero awareness of where anyone else on the squad was standing.
// Meeps move 6, Tank moves 3, Munti moves 4 (data/units.ts) — by turn 3 the
// two Meeps had already sprinted clear across the map and started fighting
// alone, three-plus tiles ahead of everyone else, and Lask (the one unit
// who can heal) never once ended up adjacent to a hurt ally the entire
// mission because the squad was two separate clusters from turn 2 onward.
// The Bloom then defeated the squad in detail — one isolated unit at a
// time — instead of ever facing a formed line. This is a Player-AI-only
// concept: the real hostile AI's reflexive/pack tiers are deliberately
// "no coordination" (GDD §5.3) and this file has no business changing
// that, so cohesion lives here, not in engine/ai.ts.

/** How far ahead of its nearest living ally a unit will voluntarily advance while just repositioning (no attack available this turn). Not a hard leash — an ally within this many tiles can plausibly close the rest of the gap in a turn or two. Tuned around the slowest class's own move range (Tank, 3) plus enough slack that a Meeps isn't stuck babysitting a Tank tile-for-tile. */
export const MAX_LEAD_FROM_ALLIES = 5;

export function nearestLivingAlly(unit: BattleUnit, allUnits: BattleUnit[]): BattleUnit | undefined {
  const allies = allUnits.filter((u) => !u.downed && u.side === unit.side && u.instanceId !== unit.instanceId);
  if (!allies.length) return undefined;
  return allies.reduce((best, a) => (chebyshevDistance(unit.pos, a.pos) < chebyshevDistance(unit.pos, best.pos) ? a : best));
}

/**
 * Like engine/ai.ts's moveToward, but capped by MAX_LEAD_FROM_ALLIES: a
 * unit that would end this move too far from its nearest living ally
 * either stops short of that, or — if it's ALREADY overextended past that
 * distance (an earlier turn's advance, or allies lost elsewhere leaving it
 * stranded) — heads back toward the group instead of continuing on toward
 * `target` at all. The lone-survivor case (no living ally left) falls
 * straight through to the uncapped moveToward: there's no group left to
 * keep pace with, so the old "just go find the fight" behaviour is still
 * correct there.
 */
export function cohesiveMoveToward(map: MapDefinition, unit: BattleUnit, target: Coord, allUnits: BattleUnit[]): Coord[] {
  const ally = nearestLivingAlly(unit, allUnits);
  if (!ally) return moveToward(map, unit, target, allUnits);

  if (chebyshevDistance(unit.pos, ally.pos) > MAX_LEAD_FROM_ALLIES) {
    // Already too far out — close on the squad this turn, not the enemy.
    return moveToward(map, unit, ally.pos, allUnits);
  }

  const movementKind = chassisToMovementKind(unit.chassis ?? "bipedal", false);
  const reachable = reachableTiles(map, unit.pos, unit.moveRange, movementKind, occupiedSet(allUnits, unit.instanceId));
  const field = distanceField(map, target, movementKind);
  let bestTile: Coord = unit.pos;
  let bestDist = field.get(coordKey(unit.pos)) ?? chebyshevDistance(unit.pos, target);
  for (const key of reachable.keys()) {
    const [x, y] = key.split(",").map(Number);
    const pos = { x, y };
    if (chebyshevDistance(pos, ally.pos) > MAX_LEAD_FROM_ALLIES) continue; // would overextend past the cap — not a candidate
    const d = field.get(key);
    if (d === undefined) continue;
    if (d < bestDist) {
      bestDist = d;
      bestTile = pos;
    }
  }
  return reconstructPath(reachable, bestTile);
}
