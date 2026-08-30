// src/engine/ai.ts
// Build Brief step 7 / GDD §5.3. Three tiers, each a strategy selected by
// intelligence (or, for hostile mechs, the "reflexive-equivalent" behaviour
// Data Pack §9 specifies: nearest target, best damage, no coordination —
// plus Munti priority within their own vision, 25 Aug 2026, see
// mechReflexiveDecision below) — not a branch inside one function.
//
// abil_taunt (Meeps, 25 Aug 2026, mission 8 onward — see
// CampaignMission.bonusAbilityUnlocks): a `taunting` player unit outranks
// every tier's own pick, including Munti priority. One check at the top
// of each of reflexiveDecision / sharedPackTarget / mechReflexiveDecision
// / emergentDecision — not a fifth tier, and not a new targeting system.
//
// ROOT/LOCK addition, 30 Aug 2026 — Maxime, on Taunt's no-charge/PvP-ready
// redesign: "taunt should also lock the target in place so they dont run
// away." Every hostile a targeting tier redirects onto the taunting unit
// (identified the same way each tier already identifies its own redirect
// — the chosen target/priority carrying `.taunting === true`) is fully
// rooted for that decision: if it can already attack the taunting unit
// from where it stands, it does; if not, it does NOTHING this turn rather
// than moving to close distance, chase a different target, or fall back
// to Munti-priority/reflexive behaviour. No existing hostile in the live
// campaign ever tries to disengage or kite (there is no flee/retreat
// behaviour anywhere in this file), so this is a no-op against everything
// shipped today — it exists for the PvP case Maxime named directly, where
// an opposing human pilot's unit otherwise could simply walk away from a
// taunt with no cost. Lasts exactly as long as `taunting` itself (cleared
// at the taunter's own next turn — engine/mission.ts), since every
// targeting tier recomputes its pick fresh each hostile decision.
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
  // Ambush stealth cloak redesign (30 Aug 2026) — a sweep's paint now beats
  // BOTH invisibility flags, not just burrow. Before this pass a concealed
  // unit was unconditionally invisible regardless of revealedUntilTurn, so
  // abil_sensor_sweep had no way to touch abil_ambush or abil_screen at all
  // — dead against the one threat Maxime asked it to counter ("give sweep a
  // pvp use"). Checked first, same as it already was relative to burrowed
  // below, for the identical reason: revealing is what a sweep is for.
  if (currentTurn !== undefined && target.revealedUntilTurn !== undefined && target.revealedUntilTurn >= currentTurn) return true;
  if (target.concealed) return false;
  if (target.burrowed) return false;
  return chebyshevDistance(observer.pos, target.pos) <= observer.vision;
}

// "Enemy ignore rescue" (30 Aug 2026 — full request/design in
// BattleUnit.isExtractionTarget's own comment, units.ts). A hostile never
// considers the single-named extraction target a valid target at all —
// not a vision trick, an outright exclusion, same as XCOM's own civilians.
// Checked in both places a reflexive/pack-tier hostile ever builds a
// target list: visibleEnemiesOf below and sharedPackTarget further down.
function isTargetableBy(_unit: BattleUnit, target: BattleUnit): boolean {
  return !target.isExtractionTarget;
}

function visibleEnemiesOf(unit: BattleUnit, allUnits: BattleUnit[]): BattleUnit[] {
  return livingTargets(allUnits, enemySideOf(unit)).filter((t) => isTargetableBy(unit, t) && isVisibleTo(unit, t));
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

/**
 * Maxime, 25 Aug 2026, on mission_amaranth_32's frozen center-lane wave:
 * "they arent intelligent, they are just overruning the zone... if they
 * cant get to the ship, make theyr number go up." Two rounds of pure
 * numbers/spawn-position tuning both failed to produce a single ship-
 * damage tick across 20 runs each — turned out numbers were never the
 * actual lever. reflexiveDecision's own "nothing in sensor range, hold
 * position" rule below meant a Crawlmass with no visible target just
 * froze at its spawn tile for the entire mission — confirmed by grepping
 * a full sim log for any Crawlmass ever stepping into the supposedly-
 * undefended lane and finding zero hits, at any turn. A protect_asset
 * map's defendZone is exactly what a mindless swarm should be overrunning
 * even with nobody in its face yet, so both mindless tiers (reflexive and
 * pack — Maxime's call when asked, not just reflexive) now fall back to
 * walking toward the nearest defendZone tile instead of holding, but ONLY
 * when the map actually has one. hold_zone/extract_unit/pursue maps have
 * no defendZone at all, so nothing changes there — this is a new fallback
 * for the "nothing visible" case, not a replacement for "chase what's in
 * front of you," which both tiers still do first.
 *
 * GENERALIZED, 30 Aug 2026 — Maxime, live playtest: "still mission are too
 * easy... I could split my team 8-2 and clean it all easy... we also need
 * to make our enemy roam so they have more chance of attacking the
 * player." Same root mechanism as the defendZone fix above, confirmed by
 * reading this file, not guessed: everything except a protect_asset map
 * had no fallback at all, so a squad routed outside every hostile's
 * vision left those hostiles frozen at spawn for the whole mission —
 * planned as a paper-only doc (Bloom_Wars_Enemy_Roaming_And_Mission_
 * Difficulty_Plan_v1.md) before Maxime gave the direct go-ahead to build
 * it ("lets work on the ai. so that mission amaranth arent crappy").
 * That plan's own §2 picked its recommended option (A: generalize the
 * existing fallback using something already on every map) over a bounded
 * random wander (B) or authored per-mission patrol waypoints (C) — cheap,
 * reuses the proven Mission 32 mechanism, no new per-map authoring. Every
 * MapDefinition already carries `deployZones.player` unconditionally
 * (data/types.ts), unlike the optional defendZone, so it's the one target
 * that exists on all 40 missions with zero new data.
 *
 * DEFAULT FLIPPED OFF, same day, after the campaign-wide sim sweep this
 * plan itself said was mandatory before shipping: full 40-mission batch at
 * n=25 went 71%→54% aggregate (706→541/1000), with several missions
 * collapsing to near-0% that weren't before (mission_amaranth_4, _6, _13,
 * _18, _24 all COMMANDER_DOWN; _26 a brand-new pure-LOSS mode). Read the
 * verbose logs for two of them (run.ts, mission_amaranth_4 and _26) rather
 * than guessing from the aggregate: this isn't generic "harder," it's
 * concentrated. On the eliminate_all missions, several hostiles that used
 * to sit frozen off-map now converge on the squad's own start position
 * from turn 1 and stack attacks on whoever's most exposed — which lands
 * disproportionately on the commander, the campaign's known soft spot
 * (Tier 6.5, commander focus-fire, still unsolved, three prior reverts —
 * this change compounds directly into that same unfixed weak point rather
 * than being independent of it). On mission_amaranth_26 (extract_unit) a
 * burrowed Undertow that used to stay put until spotted now beelines
 * toward the player's deploy zone unconditionally and reaches the
 * stranded extraction target — Okafor, deliberately immobile by mission
 * design — before the player can reach her, which is a different and
 * worse failure than "harder": it breaks the mission's own premise.
 * mission_amaranth_4 was also one of today's earlier Tier 6 spawn-variety
 * additions (batch 5), so some of its drop is two same-day changes
 * stacking on one mission without a re-check between them — a process
 * note for next time, not an excuse.
 *
 * The mechanism (Option A itself) is sound and the plan doc's own
 * risk section called this outcome by name — this isn't a bug in
 * idleRoamTarget, it's confirmation that shipping it needs the
 * mission-by-mission re-tuning pass the plan doc predicted, which hasn't
 * happened yet.
 *
 * FLIPPED BACK ON, same day, after reporting the findings above to
 * Maxime directly and getting his actual call rather than guessing:
 * "for the commadner death, thats fine. for the rescue, make it so enemy
 * ignore rescue. like the save the civilian mission in xcom." So: the
 * commander-focus-fire concentration on the eliminate_all missions is
 * accepted as intended extra pressure, not something to re-tune away —
 * and the extract_unit failure (the actual design break, not just a
 * harder fight) got its own real fix instead: BattleUnit.isExtractionTarget
 * (units.ts), set on the extraction target in Mission's constructor,
 * makes a hostile never consider that one unit a valid target at all
 * (engine/ai.ts's visibleEnemiesOf/sharedPackTarget, both filtered via
 * isTargetableBy just below) — she can still be walked past, roamed near,
 * whatever, but never attacked or chased. Re-verified with the full
 * campaign sweep after both changes landed together — see this file's own
 * build log addendum for the actual before/after numbers. `let`, not
 * `const`, stays regardless — the killswitch shape is still worth keeping
 * even on by default, and ai.test.ts's own describe block still uses the
 * test-only setter below to exercise the mechanism in isolation.
 */
export let ENABLE_ENEMY_ROAM_FALLBACK = true;

/** Test-only setter — TS treats a `let` export as read-only through a
 * namespace import from another module, so ai.test.ts's own describe
 * block (which exercises this mechanism regardless of the live default —
 * see the doc comment above) needs this to flip it and flip it back
 * rather than reaching into the binding directly. Not meant for anything
 * outside a test file. */
export function __setEnableEnemyRoamFallbackForTests(value: boolean): void {
  ENABLE_ENEMY_ROAM_FALLBACK = value;
}

function nearestZoneTile(unit: BattleUnit, zone: Coord[]): Coord {
  return zone.reduce((best, c) => (chebyshevDistance(unit.pos, c) < chebyshevDistance(unit.pos, best) ? c : best));
}

/** Where a mindless (reflexive/pack) unit with nothing visible should walk, if anywhere — defendZone first (the original, most literal "overrun this" case), then the player's own deploy zone as the generalized fallback, gated by ENABLE_ENEMY_ROAM_FALLBACK. Returns undefined only when neither applies (or the flag is off), meaning "hold position." */
function idleRoamTarget(map: MapDefinition): Coord[] | undefined {
  if (map.defendZone?.length) return map.defendZone;
  if (ENABLE_ENEMY_ROAM_FALLBACK && map.deployZones.player.length) return map.deployZones.player;
  return undefined;
}

function reflexiveDecision(map: MapDefinition, unit: BattleUnit, allUnits: BattleUnit[]): AiDecision {
  const targets = visibleEnemiesOf(unit, allUnits);
  if (!targets.length) {
    // See nearestZoneTile's own comment above.
    const roamZone = idleRoamTarget(map);
    if (roamZone) return { path: moveToward(map, unit, nearestZoneTile(unit, roamZone), allUnits) };
    return {}; // nothing in sensor range and nothing to overrun/roam toward — hold position
  }

  // abil_taunt (25 Aug 2026): a visible taunting unit wins the "who do I
  // go after" choice outright — same singleton-list trick
  // mechReflexiveDecision/emergentDecision use below for a priority Munti
  // target, so bestAttackTargetInRange has nothing else in scope to weigh
  // it against.
  const taunter = targets.find((t) => t.taunting);
  const pool = taunter ? [taunter] : targets;
  pool.sort((a, b) => chebyshevDistance(unit.pos, a.pos) - chebyshevDistance(unit.pos, b.pos));
  const nearest = pool[0];

  const inPlaceTarget = bestAttackTargetInRange(map, unit, unit.pos, pool, allUnits);
  if (inPlaceTarget) return { attackTargetId: inPlaceTarget.instanceId };

  // Rooted by Taunt (see this file's own header, "ROOT/LOCK addition") —
  // can't close distance on the taunting unit, and with pool=[taunter] it
  // has nothing else to consider attacking either. Stands still.
  if (taunter) return {};

  const pathIntoRange = reachableWithinRangeTile(map, unit, nearest.pos, allUnits);
  if (pathIntoRange) {
    const dest = pathIntoRange[pathIntoRange.length - 1];
    const target = bestAttackTargetInRange(map, unit, dest, pool, allUnits);
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
  const enemies = livingTargets(allUnits, enemySideOf(unit)).filter((t) => isTargetableBy(unit, t));
  const targets = enemies.filter((t) => spotters.some((s) => isVisibleTo(s, t)));
  if (!targets.length) return undefined;
  // abil_taunt (25 Aug 2026): overrides the pack's own "lowest HP x DEF"
  // pick below, the same way it overrides every other tier's pick.
  const taunter = targets.find((t) => t.taunting);
  if (taunter) return taunter;
  // "lowest (HP x DEF) wins" — GDD §5.3.
  return targets.reduce((best, t) => (t.currentHp * t.effectiveDefense < best.currentHp * best.effectiveDefense ? t : best));
}

function packDecision(map: MapDefinition, unit: BattleUnit, allUnits: BattleUnit[]): AiDecision {
  const target = sharedPackTarget(map, unit, allUnits);
  if (!target) {
    // Same idleRoamTarget fallback as reflexiveDecision above, for the same
    // reason — a pack with nothing spotted (by itself or any packmate)
    // shouldn't freeze in place either.
    const roamZone = idleRoamTarget(map);
    if (roamZone) return { path: moveToward(map, unit, nearestZoneTile(unit, roamZone), allUnits) };
    return {};
  }

  const targets = [target];
  const inPlaceTarget = bestAttackTargetInRange(map, unit, unit.pos, targets, allUnits);
  if (inPlaceTarget) return { attackTargetId: inPlaceTarget.instanceId };

  // Rooted by Taunt (see this file's own header) — sharedPackTarget only
  // ever returns a taunting unit when one exists (it wins outright, see
  // that function's own comment), so target.taunting === true here means
  // exactly "this pick came from taunt, not the pack's normal pick."
  if (target.taunting) return {};

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
  // abil_taunt (25 Aug 2026): outranks Munti-priority below, same as
  // mechReflexiveDecision. Deliberately inherits this tier's own
  // omniscience (no isVisibleTo gate, see the comment above this
  // function) rather than adding one of its own — a taunting unit isn't
  // newly hidden from a boss that already sees everything on the board.
  const taunter = targets.find((t) => t.taunting);
  const munti = targets.find((t) => t.path === "munti");
  const priority = taunter ?? munti;

  const [minR, maxR] = unit.attackRange;
  if (priority) {
    const d = chebyshevDistance(unit.pos, priority.pos);
    if (d >= minR && d <= maxR) return { attackTargetId: priority.instanceId };
  }
  const inRange = bestAttackTargetInRange(map, unit, unit.pos, targets, allUnits);
  if (inRange) return { attackTargetId: inRange.instanceId };
  // Rooted by Taunt (see this file's own header) — priority is only ever
  // the taunter when one exists (taunter ?? munti, taunter wins), so
  // priority?.taunting means the boss's whole priority pick this decision
  // came from taunt. Nothing in range and can't chase it (or anything
  // else) — stands still, same as the moveRange===0 case just below.
  if (priority?.taunting) return {};
  // The Heartwood (the only emergent unit in the slice) has moveRange 0 —
  // it never repositions. If nothing valid is in range, it passes.
  if (unit.moveRange === 0) return {};
  return { path: moveToward(map, unit, (priority ?? targets[0]).pos, allUnits) };
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

  // abil_taunt (25 Aug 2026) outranks the Munti-priority check right
  // below it — overriding "kill the munties 1st" when it matters is the
  // entire point of the ability. Same reach-check shape as the Munti
  // branch: only actually diverts if the taunting unit is reachable-into-
  // range THIS turn, else falls through exactly like Munti-priority does.
  const taunter = targets.find((t) => t.taunting);
  if (taunter) {
    const inPlace = bestAttackTargetInRange(map, unit, unit.pos, [taunter], allUnits);
    if (inPlace) return { attackTargetId: inPlace.instanceId };
    // Rooted by Taunt (see this file's own header) — unlike the old
    // behaviour, does NOT fall through to closing distance on the
    // taunter, Munti-priority, or plain reflexive targeting. Full lock:
    // stands still.
    return {};
  }

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

/**
 * Mission 31 "The Last Convoy" (25 Aug 2026) — the flee half of the
 * civilian escort AI. Symmetric counterpart to moveToward above: among
 * this turn's reachable tiles, pick the one that maximises the MINIMUM
 * Chebyshev distance to any threat in `threats` (not a true path-distance
 * field the way moveToward uses for approach — fleeing doesn't need to find
 * a chokepoint route the way "get to a target through a doorway" does;
 * straight-line distance is enough to read as "away" and is far cheaper to
 * compute fresh for a handful of civilians every turn). Falls back to
 * standing still (`unit.pos`) if nothing reachable beats the current tile,
 * same "hold position" fallback moveToward's own bestDist seed uses.
 */
// preferToward (25 Aug 2026, Mission 31 tuning — see this function's own
// call site in decideCivilianAction below): first version of this function
// scored reachable tiles ONLY on distance from threats, maximized. Mission
// 31's first sim pass came back LOSS 20/20 — the real cause, found in the
// turn log, wasn't the mission's difficulty: a fleeing civilian ran
// straight to (31,3), the map's own far corner, and got stranded there for
// the rest of the mission. Pure maximization always chases the single
// globally-safest tile even when that tile is a dead end, because nothing
// in the scoring cared which direction it was in.
//
// A tie-break toward preferToward (try this once, second attempt) wasn't
// enough — re-sim came back LOSS 20/20 again, still corner-running. The
// bug wasn't that ties were broken wrong; it's that the truly farthest-
// from-threats tile on an open 30-wide map is very rarely tied with
// anything, so the tie-break almost never fired. The actual fix: stop
// maximizing safety at all. A civilian now looks for any reachable tile
// AT LEAST AS SAFE as the one it's already standing on (threatScore >=
// current), and among those, picks whichever is closest to preferToward —
// "keep making progress home as long as this step doesn't make things
// worse," not "run to the single safest point on the map regardless of
// where that is." Only when truly cornered (every reachable tile is
// strictly less safe than standing still) does it fall back to pure
// maximum-safety, same panic-mode escape valve as before — see this
// function's own final branch.
export function moveAwayFrom(
  map: MapDefinition,
  unit: BattleUnit,
  threats: BattleUnit[],
  allUnits: BattleUnit[],
  preferToward: Coord[] = []
): Coord[] {
  const kind = chassisToMovementKind(unit.chassis ?? "bipedal", false);
  const reachable = reachableTiles(map, unit.pos, unit.moveRange, kind, occupiedSet(allUnits, unit.instanceId));
  const threatScoreOf = (c: Coord) => Math.min(...threats.map((t) => chebyshevDistance(c, t.pos)));
  const towardDistanceOf = (c: Coord) =>
    preferToward.length ? Math.min(...preferToward.map((p) => chebyshevDistance(c, p))) : 0;
  const currentThreatScore = threatScoreOf(unit.pos);

  // Primary pass: among tiles at least as safe as staying put, walk toward
  // preferToward (the exit) — ties broken by whichever is also safer.
  let bestTile: Coord | null = null;
  let bestTowardDistance = Infinity;
  let bestThreatScoreAmongSafe = -Infinity;
  for (const key of reachable.keys()) {
    const [x, y] = key.split(",").map(Number);
    const c = { x, y };
    const threatScore = threatScoreOf(c);
    if (threatScore < currentThreatScore) continue;
    const towardDistance = towardDistanceOf(c);
    if (
      towardDistance < bestTowardDistance ||
      (towardDistance === bestTowardDistance && threatScore > bestThreatScoreAmongSafe)
    ) {
      bestTowardDistance = towardDistance;
      bestThreatScoreAmongSafe = threatScore;
      bestTile = c;
    }
  }
  if (bestTile) return reconstructPath(reachable, bestTile);

  // Cornered — every reachable tile is strictly less safe than standing
  // still. Panic mode: take whatever's safest, direction be damned.
  let panicTile: Coord = unit.pos;
  let panicScore = currentThreatScore;
  for (const key of reachable.keys()) {
    const [x, y] = key.split(",").map(Number);
    const c = { x, y };
    const score = threatScoreOf(c);
    if (score > panicScore) {
      panicScore = score;
      panicTile = c;
    }
  }
  return reconstructPath(reachable, panicTile);
}

/**
 * Mission 31's escort AI (Maxime, 25 Aug 2026: "go ham... the game is meant
 * to feel alive") — a civilian never attacks (BattleUnit.isCivilian's own
 * comment, and attackRange [0,0] backs this up structurally), so this
 * always returns a path or nothing, never an attackTargetId. Two rules,
 * checked in order: flee any visible threat first, otherwise head for the
 * nearest exit tile. Deliberately simpler than any of the three hostile
 * tiers above — no coordination between civilians, no target prioritisation
 * — this is meant to read as one scared person's own instinct, not a
 * squad's.
 */
export function decideCivilianAction(map: MapDefinition, unit: BattleUnit, allUnits: BattleUnit[]): AiDecision {
  const threats = livingTargets(allUnits, "hostile").filter((t) => isVisibleTo(unit, t));
  if (threats.length) {
    const path = moveAwayFrom(map, unit, threats, allUnits, map.exitTiles ?? []);
    if (path.length > 1) return { path };
    // Boxed in with nowhere safer to go — fall through to heading for the
    // exit anyway rather than freezing; standing still against a visible
    // threat is never better than trying to close the distance to safety.
  }
  const exits = map.exitTiles ?? [];
  if (!exits.length) return {};
  let nearest = exits[0];
  let bestD = chebyshevDistance(unit.pos, nearest);
  for (const e of exits) {
    const d = chebyshevDistance(unit.pos, e);
    if (d < bestD) {
      bestD = d;
      nearest = e;
    }
  }
  const path = moveToward(map, unit, nearest, allUnits);
  return path.length > 1 ? { path } : {};
}

export function checkChargeForPath(map: MapDefinition, unit: BattleUnit, path: Coord[]): boolean {
  if (unit.chassis !== "centauroid") return false;
  const kind = chassisToMovementKind(unit.chassis, false);
  return isStraightLineCharge(map, path, kind);
}
