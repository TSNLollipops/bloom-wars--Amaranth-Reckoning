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
import type { Coord, MapDefinition, Path } from "../../data/types";
import type { BattleUnit } from "../../engine/units";
import { chebyshevDistance, chassisToMovementKind, reachableTiles, reconstructPath, coordKey, distanceField, tileAt } from "../../engine/grid";
import { estimateDamage, occupiedSet, moveToward, isVisibleTo, intelligenceOf } from "../../engine/ai";
import { TILES } from "../../data/tiles";
import { BLOOM_CLEAR_RADIUS, POWER } from "../../data/combatTables";
import { findPilot } from "../../data/pilotRegistry";

/** Below this HP fraction, prefer disengaging over pressing a fight that isn't a guaranteed kill. */
export const RETREAT_HP_FRACTION = 0.3;

// ---- Commander protection (28 Aug 2026, test-only) ----
// Found via a 5-archetype batch validation of the Bloom on-hit-effects
// engine: Missions 8 and 12 batch-tested at a flat 0% win rate, in EVERY
// condition tried, on/off — not a regression from that pass, a
// pre-existing gap in this file. Root cause, confirmed against verbose
// single runs, not guessed: nothing in this decision tree ever treated
// Rourke (the commander — engine/mission.ts's handleDowned() ends the
// mission attempt outright the instant she's downed, no restock, no
// permadeath roll, unlike literally every other unit on the field) as
// needing more caution than an ordinary pilot. She got exposed two ways —
// scouting ahead alone on her own higher Meeps move range (see
// reachableIntoRangePreferringSafety's own cohesion gap, flagged where
// it's used in index.ts's advance_into_range branch), and sitting in
// melee absorbing repeated focus fire because her own retreat threshold
// was identical to every other unit's, with nothing about her actually
// being irreplaceable reflected in the number. Both fixes below are
// test-only tuning — this file is never imported by mission.ts/Battle.ts,
// so nothing here touches shipped game balance, per build_log/README.md's
// "Player AI test harness has no Commander-protection logic" entry.
/** True for the one unit whose downing ends the mission attempt outright rather than triggering an ordinary permadeath check. Same data-driven flag (data/types.ts's PilotRecord.exemptFromPermadeath) engine/mission.ts's handleDowned() itself reads — not a hardcoded pilot id — so this stays correct if that flag ever moves off pilot_rourke. */
export function isCommanderUnit(unit: BattleUnit): boolean {
  return Boolean(findPilot(unit.pilotId)?.exemptFromPermadeath);
}

/** The commander's own retreat/regroup threshold — well above RETREAT_HP_FRACTION on purpose. Every other unit can afford to press a fight down to 30% hp because losing them costs a restock (or, worst case, one permadeath roll); losing HER costs the whole mission attempt. Not sim-tuned to a precise number — a deliberately generous, safe-side guess, same spirit as this file's other placeholder constants (MAX_LEAD_FROM_ALLIES's own "tuned around" comment below), worth revisiting once there's a batch of missions to tune it against specifically. */
export const COMMANDER_RETREAT_HP_FRACTION = 0.5;

// ---- Extended to the Munti, same day, same investigation ----
// Re-tracing Mission 8 with the commander protection above in place, she
// survived meaningfully longer (turn 4 -> turn 8 in the traced run) but
// still went down — the actual mission-ending event in that trace was
// this squad's one Munti (its only source of repair) dying around turn 3,
// after which nobody on the field could be healed again for the rest of
// the mission and the whole squad, Rourke included, ground down to the
// swarm's chip damage regardless of how carefully anyone was positioned.
// Losing the field Munti isn't recoverable mid-mission either (it's what
// turns every OTHER unit's own downing into a permanent loss —
// engine/campaignState.ts's live permadeath rule), so the same "this unit
// dying ends more than just itself" reasoning that justified protecting
// the commander applies here too. Same fix, same two call sites, just a
// wider gate.
/** True for either irreplaceable-in-practice unit a mission can lose that costs far more than the unit itself: the commander (isCommanderUnit, above) or the squad's Munti — the one class the live permadeath rule keys off of entirely. */
export function needsFrontLineProtection(unit: BattleUnit): boolean {
  return isCommanderUnit(unit) || unit.path === "munti";
}

// ---- Guard Taunt (30 Aug 2026, Player AI hardening pass) ----
// The 28 Aug commander-protection work above (COMMANDER_RETREAT_HP_FRACTION,
// commanderSafePathPrefix) only ever changed HOW the protected unit moves
// and retreats HERSELF — nothing on the squad's side actively pulled fire
// OFF her. Root cause, confirmed against a full 40-mission/1000-run
// re-baseline (design/Bloom_Wars_PlayerAI_Hardening_And_Alicialisation_Roadmap_v1.md
// Tier A): commander_down, not a plain squad-wipe loss, is the dominant
// failure mode campaign-wide (e.g. mission_amaranth_8: 25/25 runs ended in
// commander_down; mission_amaranth_3/5/12/21/28 all sit well below their
// neighbors on the same signal) — a passive "she retreats a little sooner"
// rule isn't enough against a pack/emergent target that can still corner
// and burst her down over a couple of turns even while she's playing safe.
// abil_taunt (data/abilities.ts) is the actual shipped answer: while
// active, EVERY hostile targeting tier picks the taunting unit first —
// ahead of the mech "kill the Munti" priority, ahead of a pack's own
// lowest-HP*DEF pick (engine/ai.ts's own `taunting`-check) — but the
// engine (player_ai_engine.md's own "Known, un-fixed limitations" list)
// never once called it. This is that call, scoped as narrowly as Screen's
// own first heuristic: only a non-protected Meeps with an action left,
// only when a protected ally is actually exposed right now.
//
// NO-CHARGE REDESIGN, 30 Aug 2026 (Maxime: "make taunt like ambush... no
// charge, just plain use") — the real abil_taunt (data/abilities.ts,
// engine/mission.ts's canTaunt/taunt) is now a reusable posture, same
// shape as Ambush: no per-mission gate, only the full-turn cost. That
// removes the exact failure mode this heuristic hit the first time it was
// tried (see index.ts's guard_taunt branch below): a visibility-only
// trigger burning the mission's ONE charge too early. There's no charge
// to burn anymore, so the same trigger is worth retrying — see index.ts
// for the retested numbers.
/** True when `unit` is a legal, sensible candidate to Taunt protecting a front-line ally: has the ability, has an action left, and isn't itself the ally that needs protecting — a taunting commander or Munti would be pulling every hostile eye onto exactly the unit this exists to keep safe. */
export function canGuardTaunt(unit: BattleUnit): boolean {
  return (
    unit.side === "player" &&
    !unit.downed &&
    unit.actionsRemaining > 0 &&
    unit.abilities.includes("abil_taunt") &&
    !needsFrontLineProtection(unit)
  );
}

/**
 * HP-gate on top of visibility (30 Aug 2026, second Guard Taunt attempt —
 * see this file's own "Guard Taunt" header above). The first version of
 * this function was visibility-only ("worth the most BEFORE a hit
 * lands"), reasoned the same way — but retested against the now-reusable
 * Taunt, that turned out to be a different failure mode than the
 * charge-scarcity one: taunting on FIRST sight, every single time an
 * enemy is visible, means the taunting unit (no defensive bonus — see
 * data/abilities.ts) can end up eating repeated free hits across many
 * turns in a row against a mission with a lot of hostiles (confirmed
 * against mission_amaranth_21, the one live emergent-tier boss mission,
 * which spawns reinforcements over time — see the build log addendum for
 * the actual numbers). Gating on the protected ally ALREADY being hurt,
 * not merely seen, cuts how often this fires at all — reserved for a real
 * emerging crisis, not spent on every routine sighting.
 */
export const GUARD_TAUNT_ALLY_HP_THRESHOLD = 0.6;

/**
 * Finds a living, front-line-protected ally (commander or Munti —
 * needsFrontLineProtection) currently visible to at least one living
 * enemy AND already below GUARD_TAUNT_ALLY_HP_THRESHOLD — the moment
 * Taunt is worth its whole-turn cost. Returns the single most-exposed such
 * ally (most enemies currently seeing her) so that with more than one
 * candidate on the field, Taunt goes to whichever situation is actually
 * worse.
 */
export function frontLineAllyToProtect(allUnits: BattleUnit[], enemies: BattleUnit[], turn: number): BattleUnit | undefined {
  const exposed = allUnits
    .filter((u) => !u.downed && needsFrontLineProtection(u) && u.maxHp > 0 && u.currentHp / u.maxHp < GUARD_TAUNT_ALLY_HP_THRESHOLD)
    .map((u) => ({ u, seenBy: enemies.filter((e) => isVisibleTo(e, u, turn)).length }))
    .filter((x) => x.seenBy > 0);
  if (!exposed.length) return undefined;
  return exposed.reduce((best, x) => (x.seenBy > best.seenBy ? x : best)).u;
}

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

// ---- Class-triangle-aware target priority (30 Aug 2026, Consolidated
// Build Plan Tier 0 — "the bot has no class-triangle awareness when
// targeting... give the bot real class-triangle-aware target selection
// (Tank beats Meeps, Meeps beats Reeps, Reeps beats Tank) at minimum") ----
//
// Root cause, confirmed against this file rather than guessed: weakestTarget
// (below) ranked purely on currentHp * effectiveDefense, an intrinsic
// property of the TARGET alone — zero notion of who's actually fighting it.
// The real per-attack damage math (engine/combat.ts's resolveMechAttack)
// already runs every hit through data/combatTables.ts's POWER[attacker.path]
// [defender.path] matrix, which IS the class triangle (Tank beats Meeps 65,
// Meeps beats Reeps 75, Reeps beats Tank 70 — the exact matchups this plan
// item names), but nothing in target SELECTION ever read that matrix. A
// squad would converge on whichever enemy looked toughest by raw stats even
// when every unit in range did far more damage to a different target sitting
// right next to it.
//
// livingSameSideMechs / squadAveragePowerAgainst below fix that by reusing
// POWER directly (Reuse over rebuild — no new balance number, no fresh
// sign-off needed) rather than inventing a parallel effectiveness table.
/** Every living, mech-shaped (has a Path) unit on `unit`'s own side, `unit` itself included — the "squad" squadAveragePowerAgainst averages over. Exported so index.ts's direct weakestTarget(enemies) call sites (advance_into_range, seek_fight) can pass the same squad-shared allies list focusFireTargetInRange already does below, rather than only the in-range-attack path getting the triangle fix. */
export function livingSameSideMechs(unit: BattleUnit, allUnits: BattleUnit[]): BattleUnit[] {
  return allUnits.filter((u) => !u.downed && u.side === unit.side && u.path);
}

/**
 * How hard `allies` collectively hit a target of `defenderPath`, averaged
 * across every non-Munti fighter (Munti's own POWER row is flat and low —
 * 20-35 against everything — support class, not part of the triangle;
 * including it would mute the real signal for every squad that still has
 * its medic alive). Falls back to 1 (neutral — every target then scores
 * identically to the old unweighted formula) when nothing but Munti is
 * left standing, so a medic-only remnant doesn't divide by a meaningless
 * number.
 */
function squadAveragePowerAgainst(defenderPath: Path, allies: BattleUnit[]): number {
  const fighters = allies.filter((a): a is BattleUnit & { path: Path } => Boolean(a.path) && a.path !== "munti");
  if (!fighters.length) return 1;
  return fighters.reduce((sum, a) => sum + POWER[a.path][defenderPath], 0) / fighters.length;
}

// ---- Boss/priority-target awareness (30 Aug 2026, Player AI hardening
// pass) ---- player_ai_engine.md's own "Known, un-fixed limitations" list:
// "focus_weak has no notion of 'this is the boss'... surfaced hard on
// Mission 21 (Heartwood) — the bot always deprioritizes a tough,
// low-priority-by-the-formula boss in favor of cheap reinforcement
// kills," and explicitly "not touched by the 30 Aug class-triangle fix —
// Bloom carry no path, so targetPriorityScore falls straight through to
// the old unweighted formula for every Bloom target, Heartwood included."
// A boss like Heartwood/the Wellroot (data/bloom.ts's own
// `intelligence: "emergent"` — already the game's real, data-driven
// boss-tier marker, reused rather than inventing a second one) spawns
// more hostiles the longer it survives (bloom.ts's own comment on
// Heartwood: "every 2 turns from turn 3, spawns 2..."), so the flat
// rawToughness formula punishing it for having huge Endurance is exactly
// backwards for a target like this — ignoring it doesn't just delay the
// fight, it makes the fight worse. Scoped the same cautious way Tier 0
// scoped class-triangle weighting: an opt-in flag, off by default, only
// ever passed true at focusFireTargetInRange's in-range call site below —
// NOT at index.ts's two distant chase-target weakestTarget(enemies) calls
// (advance_into_range, seek_fight), for the identical reason Tier 0's own
// addendum already gives for those two: no distance/exposure term exists
// there yet, and Heartwood's own [1,4] attack range plus whatever's
// screening it makes "beeline toward the boss from across the map" a real
// risk this file isn't ready to weigh, the same class of mistake that
// produced the 73.25%->67% regression the first time a chase-target
// weighting change went untested at scale.
/** Multiplies an emergent-tier boss's rawToughness score before ranking (lower score = higher priority for weakestTarget's min-reduce) — NOT tuned to a precise number, a deliberately moderate nudge (same spirit as this file's other placeholder constants) that stops a boss reading as effectively infinite-priority-last without making it always-first over a genuinely easier kill sitting right next to it. */
export const EMERGENT_BOSS_PRIORITY_DISCOUNT = 0.5;

/**
 * weakestTarget's actual ranking score. Bloom targets (no `path` — GDD
 * §8.2, Bloom aren't in the class triangle) and any call with no living
 * non-Munti allies both fall straight through to the original, unweighted
 * currentHp * effectiveDefense — POWER has no Bloom row, and there is no
 * squad advantage to weigh when squadAveragePowerAgainst returns its
 * neutral 1. Otherwise: raw toughness divided by (squad average power /
 * 50, POWER's own rough neutral-matchup center) — a target the squad has a
 * real type advantage on now ranks as effectively softer, an
 * disadvantageous matchup ranks tougher, and an average one lands close to
 * its old unweighted score. The /50 normalization doesn't change the
 * ordering (every candidate in one call shares it) — it's there only so
 * logged/debugged scores stay in a familiar ballpark, not a tuned constant.
 * `prioritizeBosses` (default off — see this section's own header above
 * for why it's opt-in) applies EMERGENT_BOSS_PRIORITY_DISCOUNT to an
 * emergent-tier target's rawToughness before any of the above, so a boss
 * doesn't get buried under its own huge Endurance the way a plain
 * toughness formula otherwise would.
 */
function targetPriorityScore(t: BattleUnit, allies: BattleUnit[], prioritizeBosses = false): number {
  let rawToughness = t.currentHp * t.effectiveDefense;
  if (prioritizeBosses && intelligenceOf(t) === "emergent") rawToughness *= EMERGENT_BOSS_PRIORITY_DISCOUNT;
  if (!t.path) return rawToughness;
  const avgPower = squadAveragePowerAgainst(t.path, allies);
  if (avgPower <= 0) return rawToughness;
  return rawToughness / (avgPower / 50);
}

/**
 * The squad's shared priority target. `allies` — pass livingSameSideMechs
 * (or omit it) — is deliberately the SAME set regardless of which
 * individual unit's turn is asking, not attacker-relative: that's what
 * keeps this squad-shared rather than reintroducing the exact split-fire
 * bug the 25 Aug focus-fire fix closed (see this file's own header on
 * focusFireTargetInRange). Omitting `allies` (or calling with none living)
 * reproduces the pre-Tier-0 unweighted behavior exactly. `prioritizeBosses`
 * (default off) threads through to targetPriorityScore — see the
 * "Boss/priority-target awareness" section above for why this stays
 * opt-in and only ever true at focusFireTargetInRange's own call site.
 */
export function weakestTarget(targets: BattleUnit[], allies: BattleUnit[] = [], prioritizeBosses = false): BattleUnit {
  return targets.reduce((best, t) =>
    targetPriorityScore(t, allies, prioritizeBosses) < targetPriorityScore(best, allies, prioritizeBosses) ? t : best
  );
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
  // prioritizeBosses=true here only — see "Boss/priority-target awareness"
  // above the targetPriorityScore/weakestTarget definitions for why this
  // is the one call site it's safe to enable at. Honest result, not
  // oversold: isolated at n=1000 (aggregate 71% vs. 72% baseline) and
  // n=100 on mission_amaranth_21 specifically (26% vs. 28% baseline) —
  // both flat, no measurable win yet. That mission's real failure mode is
  // still overwhelmingly commander_down (72-74/100 either way), which
  // swamps whatever this nudge contributes — kept on because it's a
  // correct, zero-regression fix for a real documented gap
  // (player_ai_engine.md's own "focus_weak has no notion of 'this is the
  // boss'"), not because it's proven itself yet. Worth re-measuring once
  // commander-exposure protection (see index.ts's reverted Guard Taunt
  // section) actually gets solved and stops masking this signal.
  return damageable.length ? weakestTarget(damageable, livingSameSideMechs(unit, allUnits), true) : undefined;
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
 * Commander-protection helper (28 Aug 2026, test-only — see this file's own
 * "Commander protection" section above).
 *
 * First attempt at this (kept only in this comment as a record of what
 * didn't work, not in the code): a straight MAX_LEAD_FROM_ALLIES leash on
 * reachableIntoRangePreferringSafety, on the theory that she was sprinting
 * out ahead of her own escort. Traced against a live Mission 8 run and
 * found that theory wrong — the whole squad advances together turn to
 * turn (the leash was never actually violated), and the hostile AI's own
 * targeting is a plain damage-maximizer (`bestAttackTargetInRange`,
 * GDD §5.3, real shipped rule, not commander-specific): Rourke's Meeps
 * chassis is simply the softest target in range for every attacker, so a
 * swarm (bloom_choir's `swarmSize: [3, 4]`, `intelligence: "pack"`) that
 * closes to *anyone's* range converges on her specifically regardless of
 * exactly where she stands inside the formation. A same-distance-from-
 * allies leash can't fix that; the actual lever a real player has is
 * simpler — don't let her be the tip of the spear. Let tankier squadmates
 * make first contact and soak the pack's attention; she catches up once
 * the front line is already established.
 *
 * `commanderSafePathPrefix` enforces exactly that: given a candidate
 * path, it walks it tile by tile and returns the longest prefix that
 * never puts her closer to the nearest living enemy than her own
 * most-forward living ally currently is. This is graceful, not all-or-
 * nothing — she still advances as far as the front line allows, and the
 * cap loosens naturally as allies themselves push forward each turn — so
 * it can't permanently freeze her the way a hard leash violation would.
 * A lone survivor (no living ally left) falls through unchanged, same
 * "nothing left to stay behind" exception cohesiveMoveToward already
 * makes for the ordinary cohesion cap.
 */
export function commanderSafePathPrefix(path: Coord[], unit: BattleUnit, allUnits: BattleUnit[], enemies: BattleUnit[]): Coord[] {
  if (path.length <= 1 || !enemies.length) return path;
  const allies = allUnits.filter((u) => !u.downed && u.side === unit.side && u.instanceId !== unit.instanceId);
  if (!allies.length) return path;
  const nearestEnemyDist = (pos: Coord) => Math.min(...enemies.map((e) => chebyshevDistance(pos, e.pos)));
  const frontLine = Math.min(...allies.map((a) => nearestEnemyDist(a.pos)));
  let cut = 0;
  for (let i = 1; i < path.length; i++) {
    if (nearestEnemyDist(path[i]) < frontLine) break; // this step would put her ahead of the most-exposed ally — stop here
    cut = i;
  }
  return path.slice(0, cut + 1);
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

// ---- Objective awareness (25 Aug 2026, Phase 1/2 of
// claude/Bloom_Wars_Player_AI_Ability_And_Objective_Plan_v1.md — Maxime:
// "keep the plan in mind do what you recommend") ----

/** The closest of a list of candidate tiles to `from`, Chebyshev — shared by every objective-awareness branch in index.ts that needs "which one do I head toward" (a hold zone's own tiles, an exit tile for extract_unit/rescue_carry). Every call site already guards against an empty `coords`. */
export function nearestCoord(from: Coord, coords: Coord[]): Coord {
  return coords.reduce((best, c) => (chebyshevDistance(from, c) < chebyshevDistance(from, best) ? c : best));
}

/**
 * True if any bloom_mat tile is within BLOOM_CLEAR_RADIUS (Chebyshev) of
 * `pos` — mirrors engine/mission.ts's private clearableBloomTiles()/
 * canClearBloom() exactly (same bounding-box-then-filter shape), but reads
 * straight off `map` instead of going through a Mission reference. That's
 * deliberate, not a shortcut: canClearBloom's OTHER checks
 * (unit.abilities.includes("abil_clear_bloom"), side, downed,
 * actionsRemaining) are all already plain fields on the `unit` this
 * function's one caller (index.ts's clear_bloom branch) already has in
 * hand, so nothing here actually needed a live Mission instance — see
 * types.ts's PlayerAiMissionContext comment for the one thing that
 * genuinely does (which objective this mission has at all).
 */
export function hasClearableBloomNearby(map: MapDefinition, pos: Coord): boolean {
  for (let y = Math.max(0, pos.y - BLOOM_CLEAR_RADIUS); y <= Math.min(map.height - 1, pos.y + BLOOM_CLEAR_RADIUS); y++) {
    for (let x = Math.max(0, pos.x - BLOOM_CLEAR_RADIUS); x <= Math.min(map.width - 1, pos.x + BLOOM_CLEAR_RADIUS); x++) {
      if (map.tiles[y][x] === "bloom_mat") return true;
    }
  }
  return false;
}
