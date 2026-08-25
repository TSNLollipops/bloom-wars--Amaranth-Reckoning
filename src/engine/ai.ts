// src/engine/ai.ts
// Build Brief step 7 / GDD §5.3. Three tiers, each a strategy selected by
// intelligence (or, for hostile mechs, the "reflexive-equivalent" behaviour
// Data Pack §9 specifies: nearest target, best damage, no coordination —
// plus Munti priority within their own vision, 25 Aug 2026, see
// mechReflexiveDecision below) — not a branch inside one function.
import type { Coord, MapDefinition } from "../data/types";
import type { BattleUnit } from "./units";
import { BLOOM, SPLITFANG_PACK_RADIUS } from "../data/bloom";
import { chebyshevDistance, chassisToMovementKind, reachableTiles, reconstructPath, coordKey, isStraightLineCharge, distanceField } from "./grid";
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

// livingTargets/occupiedSet/estimateDamage/bestAttackTargetInRange/moveToward/
// reachableWithinRangeTile are exported (in addition to being used inside
// this file) so src/sim/playerAi/ (25 Aug 2026 restructure of the former
// src/sim/testPlayerAi.ts) — a testing-only stand-in for a human player,
// NOT part of decideHostileAction's tier logic — can reuse the same damage
// math and pathfinding instead of forking it. Nothing here changes for the
// real hostile AI; this is purely making the building blocks reusable.
export function livingTargets(units: BattleUnit[], side: BattleUnit["side"]): BattleUnit[] {
  return units.filter((u) => u.side === side && !u.downed);
}

/** The opposing side — this module is symmetric (Build Brief calls it "the AI", but the same reflexive/pack/emergent logic drives the headless sim's player-side autoplay too). */
function enemySideOf(unit: BattleUnit): BattleUnit["side"] {
  return unit.side === "player" ? "hostile" : "player";
}

/**
 * Vision gate (Maxime, 22 Aug 2026 — "all enemy seem to know where I am at
 * all times"). Every unit already carries a computed `vision` stat
 * (data/bloom.ts, data/units.ts, mek vision bonuses) but nothing read it —
 * reflexive/pack targeting picked from every living enemy on the board
 * regardless of distance. This is the fix: a target only counts if it's
 * within the observer's own vision range (Chebyshev, same metric as
 * attackRange elsewhere in this file), and a still-burrowed Undertow never
 * counts at all — Data Pack §8.1 calls it "not drawn/targetable" outright.
 *
 * Emergent tier (Heartwood, boss-only) is deliberately left un-gated — GDD
 * §5.3 calls it "board-level heuristics," which reads as intentionally
 * omniscient for a boss, distinct from reflexive's "nearest VISIBLE target."
 *
 * Exported (Maxime, 22 Aug 2026 — the Mission 3 sim stalemate fix) so
 * sim/playerAi/ (25 Aug 2026 restructure of the former sim/testPlayerAi.ts)
 * can ask the same question decideHostileAction itself asks — "can any
 * hostile actually see me right now" — instead of a geometric reachability
 * proxy that doesn't know about vision at all. See that module's own
 * retreat-gate comment for why this specific question is the one that
 * matters.
 *
 * ---- ABILITY-DEPTH PASS (23 Aug 2026) ----
 * Two of the four new abilities (data/abilities.ts) are the two halves of
 * this predicate, so both land here rather than anywhere else:
 *
 * `concealed` (Meeps abil_ambush, Munti abil_screen) is the player side of
 * the same coin `burrowed` already was — one line, same shape, same effect:
 * the hostile AI's reflexive and pack tiers, which both filter through this
 * function, simply cannot see a concealed unit, so they will not target it,
 * path to it, or count it. It is checked BEFORE the reveal bypass below on
 * purpose: concealment is only ever set on PLAYER units and reveal only
 * ever on hostile ones (Mission.sensorSweep refuses to paint its own side),
 * so the two can't actually meet — but if a future ability ever does set
 * both, "I am hidden" should not be undone by a sensor sweep the hidden
 * unit's own side ran.
 *
 * `currentTurn` is the abil_sensor_sweep half, and is OPTIONAL on purpose.
 * Omit it (every existing caller, unchanged) and this behaves exactly as it
 * did before the pass. Pass it, and a target whose `revealedUntilTurn` has
 * not yet expired counts as visible regardless of distance AND regardless
 * of burrow — which is precisely what a sweep buys. Only the PLAYER-facing
 * paths pass it: unitsVisibleToSide (the fog renderer and attack targeting
 * in scenes/Battle.ts) and Mission's own overwatch/interdiction triggers.
 * visibleEnemiesOf and sharedPackTarget below deliberately do not, because
 * a sweep is the player's intelligence, not a broadcast — nothing should be
 * able to make a player unit visible to the Bloom by revealing it.
 *
 * Still not covered: burrow-surfacing on adjacency, and the Runemaster
 * track's own `burrowDetection: true` (data/meks.ts), which remains a data
 * field nothing reads.
 */
export function isVisibleTo(observer: BattleUnit, target: BattleUnit, currentTurn?: number): boolean {
  if (target.concealed) return false;
  if (currentTurn !== undefined && target.revealedUntilTurn !== undefined && target.revealedUntilTurn >= currentTurn) return true;
  if (target.burrowed) return false;
  return chebyshevDistance(observer.pos, target.pos) <= observer.vision;
}

function visibleEnemiesOf(unit: BattleUnit, allUnits: BattleUnit[]): BattleUnit[] {
  return livingTargets(allUnits, enemySideOf(unit)).filter((t) => isVisibleTo(unit, t));
}

/**
 * Fog of war for rendering (Maxime, 22 Aug 2026 — "missions resolve in
 * minutes, XCOM missions take hours"). The hostile AI above was already
 * vision-gated (isVisibleTo, reflexiveDecision/packDecision) but nothing on
 * the player-facing side ever asked the same question — scenes/Battle.ts
 * drew and targeted every hostile on the board regardless of whether any
 * player unit could actually see it. This is the party-wide query that
 * fixes that: the union of isVisibleTo(observer, target) across every
 * living observer of `side` and every living target of the opposing side —
 * deliberately side-agnostic (this file is symmetric throughout), even
 * though the only caller today is the player's rendering layer.
 *
 * Not a replacement for anything decideHostileAction's own tiers use —
 * visibleEnemiesOf/sharedPackTarget/isVisibleTo above are untouched. This
 * is new, additive, and answers a different question ("what can this whole
 * side see, in aggregate") than any single unit's own targeting ever
 * needed to.
 *
 * `currentTurn` (ability-depth pass, 23 Aug 2026) is threaded straight
 * through to isVisibleTo and is optional for the same reason it is there:
 * omitted, this is byte-for-byte the old behaviour. Supplied, a hostile
 * painted by an unexpired abil_sensor_sweep counts as seen by the whole
 * side — which is what makes a swept, still-burrowed Undertow drawable and
 * clickable in scenes/Battle.ts, and shootable by an overwatcher.
 */
export function unitsVisibleToSide(side: BattleUnit["side"], allUnits: BattleUnit[], currentTurn?: number): Set<string> {
  const observers = livingTargets(allUnits, side);
  const opposingSide: BattleUnit["side"] = side === "player" ? "hostile" : "player";
  const targets = livingTargets(allUnits, opposingSide);
  const visible = new Set<string>();
  for (const target of targets) {
    if (observers.some((observer) => isVisibleTo(observer, target, currentTurn))) {
      visible.add(target.instanceId);
    }
  }
  return visible;
}

/** Same-side, pack-tier units close enough to share what they've spotted (GDD §5.3's pack-coordination radius, reused as a vision-sharing radius). */
function packAllies(unit: BattleUnit, allUnits: BattleUnit[]): BattleUnit[] {
  return allUnits.filter(
    (u) => u !== unit && u.side === unit.side && !u.downed && intelligenceOf(u) === "pack" && chebyshevDistance(u.pos, unit.pos) <= SPLITFANG_PACK_RADIUS
  );
}

export function occupiedSet(units: BattleUnit[], exclude: string): Set<string> {
  const s = new Set<string>();
  for (const u of units) if (!u.downed && u.instanceId !== exclude) s.add(coordKey(u.pos));
  return s;
}

/** Estimate prospective damage this unit would deal to `target` from `attackFrom`, for target-picking only — does not mutate state. */
export function estimateDamage(map: MapDefinition, unit: BattleUnit, target: BattleUnit, allUnits: BattleUnit[]): number {
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

export function bestAttackTargetInRange(map: MapDefinition, unit: BattleUnit, from: Coord, targets: BattleUnit[], allUnits: BattleUnit[]): BattleUnit | undefined {
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

export function moveToward(map: MapDefinition, unit: BattleUnit, target: Coord, allUnits: BattleUnit[]): Coord[] {
  const kind = chassisToMovementKind(unit.chassis ?? "bipedal", unit.kind === "bloom" ? false : false);
  const flying = unit.kind === "bloom" && BLOOM[unit.archetypeId]?.movementType === "flight_membrane";
  const movementKind = flying ? "flying" : kind;
  const reachable = reachableTiles(map, unit.pos, unit.moveRange, movementKind, occupiedSet(allUnits, unit.instanceId));

  // Rank this turn's reachable tiles by TRUE walls-aware path-distance to
  // the target, not straight-line Chebyshev distance (Maxime, 22 Aug 2026
  // — "in mission 2 the bloom dont come at us"). A single-doorway room
  // means the correct first step is often AWAY from the target in
  // straight-line terms (go around to the door); the old straight-line
  // tie-break never found a this-turn tile that beat standing still in
  // that case, so hostiles froze at the outside wall forever. The field
  // is computed from the target's side, so its value at each candidate
  // tile is that tile's real route-length home, chokepoints included.
  const field = distanceField(map, target, movementKind);
  let bestTile: Coord = unit.pos;
  let bestDist = field.get(coordKey(unit.pos)) ?? chebyshevDistance(unit.pos, target);
  for (const key of reachable.keys()) {
    const d = field.get(key);
    if (d === undefined) continue; // not reachable from the target's side at all (sealed pocket) — ignore
    if (d < bestDist) {
      bestDist = d;
      const [x, y] = key.split(",").map(Number);
      bestTile = { x, y };
    }
  }
  return reconstructPath(reachable, bestTile);
}

export function reachableWithinRangeTile(map: MapDefinition, unit: BattleUnit, target: Coord, allUnits: BattleUnit[]): Coord[] | null {
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
  const targets = visibleEnemiesOf(unit, allUnits);
  if (!targets.length) return {}; // nothing in sensor range — hold position rather than beeline the whole board
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
  // Pack coordination extends to spotting: a target counts if it's visible
  // to this unit OR to any packmate within SPLITFANG_PACK_RADIUS (called in
  // over the pack's shared awareness, not this unit's own eyes only).
  const spotters = [unit, ...packAllies(unit, allUnits)];
  const enemies = livingTargets(allUnits, enemySideOf(unit));
  const targets = enemies.filter((t) => spotters.some((s) => isVisibleTo(s, t)));
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
  //
  // Deliberately NOT vision-gated, and therefore deliberately not
  // concealment-gated either (ability-depth pass, 23 Aug 2026): this tier
  // reads every living enemy directly rather than going through
  // isVisibleTo, so a Heartwood sees through abil_ambush and abil_screen.
  // That is the same call the fog-of-war pass already made for this tier
  // and for the same stated reason — GDD §5.3 calls emergent "board-level
  // heuristics," i.e. intentionally omniscient, for a boss only. If that is
  // ever revisited, it is one filter on this line, not a new system.
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

/**
 * Hostile mechs only (House Amaranth, and any future human-piloted
 * hostile) — Maxime, 25 Aug 2026: "in a mech to mech battle its kill the
 * munties 1st." A human pilot reads the battlefield well enough to know
 * the medic is the priority kill, even without pack/emergent-tier
 * coordination — Data Pack §9 already calls hostile-mech behaviour
 * "reflexive-EQUIVALENT," not identical, which is exactly the gap this
 * fills.
 *
 * Deliberately still vision-gated (visibleEnemiesOf, same as plain
 * reflexiveDecision) — unlike emergentDecision's boss-only omniscience,
 * a mech pilot only prioritises a Munti it can actually see. And
 * deliberately does NOT touch Bloom's own reflexive tier: intelligenceOf
 * hard-codes every non-bloom unit to "reflexive," so decideHostileAction
 * below routes mechs here and leaves weak/reflexive-tier Bloom on the
 * original, dumber reflexiveDecision untouched — Bloom stays
 * instinct-only, no exception, matching the rest of this project's
 * established canon.
 *
 * Only actually diverts from plain reflexive behaviour when a kill (or a
 * move-then-kill) on the Munti is available THIS turn — if the Munti is
 * seen but not reachable into range, this falls straight through to
 * reflexiveDecision rather than wasting the turn chasing an unreachable
 * priority target while passing up a real one, the same trade-off
 * emergentDecision already makes for Heartwood.
 */
function mechReflexiveDecision(map: MapDefinition, unit: BattleUnit, allUnits: BattleUnit[]): AiDecision {
  const targets = visibleEnemiesOf(unit, allUnits);
  const munti = targets.find((t) => t.path === "munti");
  if (munti) {
    const inPlace = bestAttackTargetInRange(map, unit, unit.pos, [munti], allUnits);
    if (inPlace) return { attackTargetId: inPlace.instanceId };

    const pathToMunti = reachableWithinRangeTile(map, unit, munti.pos, allUnits);
    if (pathToMunti) return { path: pathToMunti, attackTargetId: munti.instanceId };
  }
  return reflexiveDecision(map, unit, allUnits);
}

export function decideHostileAction(map: MapDefinition, unit: BattleUnit, allUnits: BattleUnit[]): AiDecision {
  const tier = intelligenceOf(unit);
  if (tier === "pack") {
    // Only coordinate if at least one same-side pack-tier ally is within
    // SPLITFANG_PACK_RADIUS — otherwise behave reflexively.
    const nearbyPack = packAllies(unit, allUnits).length > 0;
    return nearbyPack ? packDecision(map, unit, allUnits) : reflexiveDecision(map, unit, allUnits);
  }
  if (tier === "emergent") return emergentDecision(map, unit, allUnits);
  // intelligenceOf hard-codes every non-bloom unit to "reflexive," so this
  // is the only branch point that can ever see a hostile mech — Munti
  // priority (mechReflexiveDecision, above) only applies here, never to
  // Bloom's own reflexive tier.
  if (unit.kind === "mech") return mechReflexiveDecision(map, unit, allUnits);
  return reflexiveDecision(map, unit, allUnits);
}

export function checkChargeForPath(map: MapDefinition, unit: BattleUnit, path: Coord[]): boolean {
  if (unit.chassis !== "centauroid") return false;
  const kind = chassisToMovementKind(unit.chassis, false);
  return isStraightLineCharge(map, path, kind);
}
