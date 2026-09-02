// src/engine/threat.ts
// Threat map — the Hard tier's "read the board before you step" tool
// (claude/Bloom_Wars_Player_AI_Difficulty_Tiers_Plan_v1.md §5.1, 1 Sep
// 2026). Pure TypeScript, no Phaser, no Mission — a read over a unit list
// and a map, the same building-block shape engine/ai.ts's helpers have.
//
// What it answers: "if my unit ENDS its turn on tile T, how much damage
// can the hostiles put on it during their phase?" — the number a veteran
// XCOM player has in their head before every move, and the one number
// the pre-tiers bot never computed (it counted "how many enemies are
// within moveRange+attackRange of this tile", a straight-line proxy that
// ignores walls, water, and the fact that a Splitfang does 30 while a
// Crawlmass does 8).
//
// Two layers, cheapest first:
//
//   1. FOOTPRINT (buildThreatMap): for every living hostile, the set of
//      tiles it could attack next turn — every tile inside its attack
//      range measured from every tile it can actually reach with its real
//      movement kind (flying Bloom fly; everything else walks the same
//      reachableTiles flood fill Mission.moveHostile uses, blocked by the
//      units standing on the board right now). A taunt-rooted hostile
//      (engine/ai.ts "ROOT/LOCK") can't move, so its footprint is its
//      in-place range only. Built once per player turn — the hostiles
//      don't move during the player's phase — and cached by the caller.
//
//   2. INCOMING (incomingAt): for a given defender on a given tile, the
//      sum of estimateDamage over every hostile whose footprint covers
//      it, with the defender's real defence on that tile's terrain. This
//      is an UPPER bound — it assumes every hostile that can reach the
//      tile chooses this defender — which is exactly the pessimism a
//      careful player uses for the commander. The oracle (predictedFocus)
//      below is the sharper answer for the handful of tiles that matter.
//
//   3. ORACLE (predictedFocus, profile.hostileOracle, test-only — see the
//      profile's own comment): clone the board, stand the defender on the
//      candidate tile, and ask decideHostileAction — the real enemy AI —
//      what each hostile would do, in the same order Mission.runHostileTurn
//      asks them, moving each clone as it decides so later hostiles see the
//      earlier ones' new positions. Sums the estimated damage of the
//      attacks that actually pick this defender, deducting each hit from
//      its clone so a squadmate who drops mid-phase re-routes the hostiles
//      behind it. Not a simulation of the whole phase (no dodge, no
//      overwatch fire, no wave spawns) — a one-ply lookahead, deliberately
//      cheap enough to run on a few tiles per commander decision.
//
// None of this touches the hostile AI itself; decideHostileAction is only
// ever called on clones.
import type { Coord, MapDefinition } from "../data/types";
import type { BattleUnit } from "./units";
import { BLOOM } from "../data/bloom";
import { chebyshevDistance, chassisToMovementKind, coordKey, reachableTiles, type MovementKind } from "./grid";
import { decideHostileAction, estimateDamage, livingTargets, occupiedSet } from "./ai";

export interface HostileFootprint {
  hostile: BattleUnit;
  /** coordKeys this hostile could stand on at the end of its move (its current tile included). */
  standable: Set<string>;
  /** coordKeys this hostile could attack next turn from some standable tile. */
  attackable: Set<string>;
}

export interface ThreatMap {
  turn: number;
  footprints: HostileFootprint[];
}

export interface IncomingEstimate {
  /** Summed estimated damage from every hostile whose footprint covers the tile. */
  total: number;
  /** How many hostiles could hit the tile at all. */
  attackers: number;
  /** The single largest contributor — a one-boss board reads differently from a three-Splitfang one. */
  worstSingle: number;
}

/** The same movement-kind rule engine/ai.ts's moveToward / reachableWithinRangeTile apply, exported so the footprint and the real mover can't disagree. */
export function movementKindOf(unit: BattleUnit): MovementKind {
  const flying = unit.kind === "bloom" && BLOOM[unit.archetypeId]?.movementType === "flight_membrane";
  return flying ? "flying" : chassisToMovementKind(unit.chassis ?? "bipedal", false);
}

function tilesInRangeOf(map: MapDefinition, from: Coord, range: [number, number], into: Set<string>): void {
  const [minR, maxR] = range;
  for (let y = Math.max(0, from.y - maxR); y <= Math.min(map.height - 1, from.y + maxR); y++) {
    for (let x = Math.max(0, from.x - maxR); x <= Math.min(map.width - 1, from.x + maxR); x++) {
      const d = chebyshevDistance(from, { x, y });
      if (d >= minR && d <= maxR) into.add(`${x},${y}`);
    }
  }
}

/**
 * Every living hostile's next-turn reach. `allUnits` is the board as it
 * stands; the occupied set blocks passage through units (not targeting),
 * exactly as reachableTiles does for a real move. Player units that will
 * move later this turn are still counted where they stand — a small
 * pessimism (a tile a friend is about to vacate looks blocked) that the
 * caller accepts for a once-per-turn build.
 */
export function buildThreatMap(map: MapDefinition, allUnits: BattleUnit[], turn: number): ThreatMap {
  const hostiles = livingTargets(allUnits, "hostile");
  const anyTaunting = allUnits.some((u) => !u.downed && u.side === "player" && u.taunting);
  const footprints: HostileFootprint[] = [];
  for (const h of hostiles) {
    const standable = new Set<string>();
    if (anyTaunting) {
      // Rooted by Taunt for the whole hostile phase — attacks in place or not at all.
      standable.add(coordKey(h.pos));
    } else {
      const reach = reachableTiles(map, h.pos, h.moveRange, movementKindOf(h), occupiedSet(allUnits, h.instanceId));
      for (const key of reach.keys()) standable.add(key);
    }
    const attackable = new Set<string>();
    for (const key of standable) {
      const [x, y] = key.split(",").map(Number);
      tilesInRangeOf(map, { x, y }, h.attackRange, attackable);
    }
    footprints.push({ hostile: h, standable, attackable });
  }
  return { turn, footprints };
}

/** Footprint-sum incoming damage for `defender` standing on `tile` (its defence read from that tile's terrain, as the real resolver would). */
export function incomingAt(threat: ThreatMap, map: MapDefinition, defender: BattleUnit, tile: Coord, allUnits: BattleUnit[]): IncomingEstimate {
  const key = coordKey(tile);
  let total = 0;
  let attackers = 0;
  let worstSingle = 0;
  const savedPos = defender.pos;
  defender.pos = tile; // estimate as if already standing there (same transient trick engine/ai.ts's bestAttackTargetInRange uses)
  try {
    for (const fp of threat.footprints) {
      if (!fp.attackable.has(key)) continue;
      const dmg = estimateDamage(map, fp.hostile, defender, allUnits);
      if (dmg <= 0) continue;
      total += dmg;
      attackers += 1;
      if (dmg > worstSingle) worstSingle = dmg;
    }
  } finally {
    defender.pos = savedPos;
  }
  return { total, attackers, worstSingle };
}

/** How many hostiles' footprints cover `tile` — the count-shaped question, for callers that only need "is anything able to reach here." */
export function attackersAt(threat: ThreatMap, tile: Coord): number {
  const key = coordKey(tile);
  let n = 0;
  for (const fp of threat.footprints) if (fp.attackable.has(key)) n += 1;
  return n;
}

function cloneUnit(u: BattleUnit): BattleUnit {
  // BattleUnit is plain data (no Maps, no functions) — a shallow copy plus
  // fresh pos/attackRange objects is enough for a one-ply lookahead that
  // only ever writes pos, currentHp and downed.
  return { ...u, pos: { ...u.pos }, attackRange: [u.attackRange[0], u.attackRange[1]] };
}

/**
 * One-ply oracle: what would the real hostile AI do if `defender` ended
 * its turn on `tile`, and how much of that lands on the defender? Returns
 * the summed estimated damage of the attacks that pick it. Clones the
 * board first; nothing on `allUnits` is touched. Mirrors
 * Mission.runHostileTurn's ordering (this.livingUnits() order, each
 * hostile moved before the next decides). HP is not deducted between
 * attacks and reaction fire is not modelled — that's the whole simplicity
 * budget of this function.
 */
export function predictedFocus(map: MapDefinition, defender: BattleUnit, tile: Coord, allUnits: BattleUnit[], assumeGone?: Set<string>): IncomingEstimate {
  const board = allUnits.map(cloneUnit);
  const me = board.find((u) => u.instanceId === defender.instanceId);
  if (!me) return { total: 0, attackers: 0, worstSingle: 0 };
  me.pos = { ...tile };
  me.concealed = false; // the question is "what if I stand here, visible"
  // `assumeGone`: squadmates the caller expects to move out of reach
  // before the phase (a VIP that hasn't decided yet). Marked downed on
  // the clone board: not a target, and — the part a cloak wouldn't do —
  // not a body blocking a tile either (House Amaranth 9 trace: the
  // commander standing on the one approach tile made the oracle read
  // "no path" for a Splitfang that walked straight in once she left).
  if (assumeGone) for (const u of board) if (u.instanceId !== me.instanceId && assumeGone.has(u.instanceId)) u.downed = true;
  let total = 0;
  let attackers = 0;
  let worstSingle = 0;
  const players = board.filter((u) => !u.downed && u.side === "player");
  for (const h of board) {
    if (h.downed || h.side !== "hostile") continue;
    // A hostile with nobody inside moveRange + attackRange can't attack
    // this phase; where it wanders is irrelevant to the answer, and its
    // roam pathing (distanceField) is the expensive part of a decision.
    const reach = h.moveRange + h.attackRange[1];
    if (!players.some((p) => chebyshevDistance(h.pos, p.pos) <= reach)) continue;
    const decision = decideHostileAction(map, h, board);
    if (decision.path && decision.path.length > 1) {
      const dest = decision.path[decision.path.length - 1];
      h.pos = { x: dest.x, y: dest.y };
    }
    if (!decision.attackTargetId) continue;
    const victim = board.find((u) => u.instanceId === decision.attackTargetId);
    if (!victim || victim.downed) continue;
    const dmg = estimateDamage(map, h, victim, board);
    if (dmg <= 0) continue;
    // Deduct on the clone (no dodge, no shield nuance) so a squadmate who
    // drops mid-phase re-routes the hostiles behind it, the way the real
    // phase does — first oracle cut missed exactly that (Mission 12, turn
    // 5: the Tank at 2 HP fell to the first Crawlmass and the Choir behind
    // it turned on the commander instead).
    victim.currentHp -= dmg;
    if (victim.currentHp <= 0) victim.downed = true;
    if (victim.instanceId !== me.instanceId) continue;
    total += dmg;
    attackers += 1;
    if (dmg > worstSingle) worstSingle = dmg;
  }
  return { total, attackers, worstSingle };
}
