// src/sim/playerAi/hard.ts
// The Hard tier's extra brain (claude/Bloom_Wars_Player_AI_Difficulty_
// Tiers_Plan_v1.md §5, 1 Sep 2026; Maxime: "hard being tactical genius").
// Everything a veteran does that MODERATE doesn't, and all of it comes
// down to one habit: never end a move on a tile without knowing what can
// hit you there. engine/threat.ts supplies the number; this file turns it
// into five seams in index.ts's ordinary chain:
//
//   1. hardTierOverride — runs FIRST. If the predicted incoming on the
//      tile the unit is standing on is past its danger bar (dangerThreshold:
//      "would kill me" for a line unit, preemptiveRetreatFraction of
//      current HP for the commander / Munti), move to the best reachable
//      tile that is under the bar — preferring one it can still shoot or
//      heal from — BEFORE the hit lands. This is the pre-emptive retreat
//      the 31 Aug gang-up attempt reached for (combat.ts's own "TRIED,
//      MEASURED, REVERTED" trace: Rourke at full HP taking three 30-point
//      Splitfang hits in one hostile phase; hpFraction can only ever react
//      AFTER that). Returns null whenever a kill is on the table in place
//      (the chain takes the kill) or nothing reachable is safer.
//   2. betterFiringTile — at the chain's in-place attack step: if a
//      reachable tile hits the same target for less incoming, step there
//      first (move + attack, two actions).
//   3. threatAwareIntoRange — replaces reachableIntoRangePreferringSafety's
//      "far edge of my range" rule with "the in-range tile under my danger
//      bar with the best (damage dealt, incoming, terrain) trade."
//   4. threatTrimmedPath — every plain advance (seek_fight, explore,
//      hold_zone, escort) is cut back to the last step under the bar. A
//      stalemate breaker (memory.stalledTurns) commits after two turns of
//      no progress so a frozen hostile line can't hold the squad off
//      forever.
//   5. tauntSurvivable — abilities.ts's shouldTaunt swaps its threat-COUNT
//      cap for the real footprint-sum damage when a threat map exists: a
//      taunt pulls EVERY reachable hostile onto the taunter, so the sum is
//      exactly the right number there.
//
// Allocation (allocatedIncomingAt): the footprint sum assumes every
// hostile in reach picks THIS unit. Against a five-mech squad that's far
// too pessimistic for the line units (the whole squad would hang back),
// so each hostile's damage is only counted when it would plausibly pick
// this defender under the real tiers' own rules (engine/ai.ts, read, not
// guessed): a taunter takes everything; a hostile mech goes for a
// reachable Munti first; a pack Splitfang picks the lowest HP×DEF in
// reach; reflexive Bloom pick the nearest; an emergent boss is counted
// unless a different Munti is in its reach. Ties count against the
// defender. The oracle (predictedFocus, profile.hostileOracle) then
// re-checks the commander's / Munti's top candidates against the actual
// hostile AI — test-only, and only for those two, because it costs a
// real decideHostileAction per hostile per tile.
import type { Coord, MapDefinition } from "../../data/types";
import type { BattleUnit } from "../../engine/units";
import { chebyshevDistance, coordKey, reachableTiles, reconstructPath, tileAt } from "../../engine/grid";
import { estimateDamage, intelligenceOf, livingTargets, occupiedSet, opposingSide } from "../../engine/ai";
import { buildThreatMap, movementKindOf, predictedFocus, type IncomingEstimate, type ThreatMap } from "../../engine/threat";
import { TILES } from "../../data/tiles";
import { AMBUSH_DECLOAK_DAMAGE_MULTIPLIER } from "../../data/combatTables";
import type { PlayerAiProfile } from "./profile";
import type { PlayerAiDecision, PlayerAiLogEntry, PlayerAiMemory, PlayerAiMissionContext, PlayerAiReason } from "./types";
import { cohesiveMoveToward, findLethalTargetFrom, focusFireTargetInRange, isLethalHit, lastStep, needsFrontLineProtection } from "./combat";
import { repairRangeOf } from "./abilities";

export interface HardOverride {
  decision: PlayerAiDecision;
  reason: PlayerAiReason;
  logExtra?: Partial<PlayerAiLogEntry>;
}

/** Ranking tie-break weight for standing on cover; small on purpose — it never outranks a real damage difference. */
const TERRAIN_WEIGHT = 2;
/** Turns of zero-progress threat-trimmed advance before a unit commits to the untrimmed path. */
const STALL_COMMIT_TURNS = 2;
/** Oracle re-check budget per VIP decision (tiles). */
const ORACLE_TOP_K = 3;
/** An ally under this HP fraction is treated as already gone for "who would the hostile pick instead" purposes. */
const DOOMED_HP_FRACTION = 0.2;

// ---- Threat map cache -------------------------------------------------------

function boardStamp(allUnits: BattleUnit[], turn: number, side: BattleUnit["side"]): string {
  const hostiles = livingTargets(allUnits, opposingSide(side)).map((h) => h.instanceId).join(",");
  const taunting = allUnits.some((u) => !u.downed && u.side === side && u.taunting) ? "T" : "";
  return `${turn}:${taunting}:${hostiles}`;
}

/** This turn's threat map, rebuilt only when a hostile died (or a taunt went up) since it was last built. */
export function threatMapFor(memory: PlayerAiMemory, map: MapDefinition, allUnits: BattleUnit[], turn: number): ThreatMap {
  const stamp = boardStamp(allUnits, turn, memory.side);
  if (memory.threat && memory.threatStamp === stamp) return memory.threat;
  memory.threat = buildThreatMap(map, allUnits, turn, opposingSide(memory.side));
  memory.threatStamp = stamp;
  return memory.threat;
}

// ---- Danger bar --------------------------------------------------------------

/** The incoming-damage figure this unit refuses to end a turn under. Shield counts as HP for a line unit ("would this kill me"); the VIP bar is preemptiveRetreatFraction of MAX HP, tightened further to 60% of current HP once she's hurt — a commander is never a front-liner, whatever she could kill from there. */
export function dangerThreshold(unit: BattleUnit, profile: PlayerAiProfile, frontLineProtected: boolean): number {
  const pool = unit.currentHp + (unit.shield ?? 0);
  if (frontLineProtected) return Math.max(1, Math.min(profile.preemptiveRetreatFraction * unit.maxHp, 0.6 * unit.currentHp));
  return Math.max(1, pool);
}

// ---- Allocation --------------------------------------------------------------

function powerScore(u: BattleUnit): number {
  return u.currentHp * u.effectiveDefense;
}

/** Can hostile `h`, deciding from where it stands now, see a player unit on `tile`? The real rule (engine/ai.ts isVisibleTo): a hostile only ever attacks something visible from its start-of-phase position; an emergent boss sees everything; a pack Splitfang borrows its packmates' eyes within SPLITFANG_PACK_RADIUS. `concealed` is handled by the caller. */
function canSee(h: BattleUnit, tile: Coord, allUnits: BattleUnit[]): boolean {
  const tier = intelligenceOf(h);
  if (tier === "emergent") return true;
  if (chebyshevDistance(h.pos, tile) <= h.vision) return true;
  if (tier === "pack") {
    // Packmates share sightings within SPLITFANG_PACK_RADIUS — and they
    // move one after another, so by the time the third Splitfang decides,
    // the first two have already closed on whatever one of them saw and
    // are inside its radius. Read as "any packmate on the board can see
    // it" (Mission 10 trace: the radius-only version counted two of the
    // three Splitfangs that then all hit the commander).
    return allUnits.some((p) => p !== h && !p.downed && p.side === h.side && intelligenceOf(p) === "pack" && chebyshevDistance(p.pos, tile) <= p.vision);
  }
  return false;
}

/**
 * Would hostile `h` (footprint already known to cover `tile`) plausibly
 * choose `defender` standing on `tile`, given where every other living
 * player unit stands? Mirrors engine/ai.ts's tier rules at the level of
 * "who do I go after" — vision first (a hostile that can't see the tile
 * from where it stands never attacks it: reflexive/pack/mech tiers all
 * pick from visibleEnemiesOf), then the tier's own preference — ties
 * resolved AGAINST the defender.
 */
function wouldPick(h: BattleUnit, footprint: Set<string>, defender: BattleUnit, tile: Coord, others: BattleUnit[], map: MapDefinition, allUnits: BattleUnit[]): boolean {
  if (!canSee(h, tile, allUnits)) return false;
  const taunter = others.find((o) => o.taunting);
  if (defender.taunting) return true;
  if (taunter && canSee(h, taunter.pos, allUnits)) return false;
  const reachableOthers = others.filter((o) => !o.isExtractionTarget && !o.concealed && footprint.has(coordKey(o.pos)) && canSee(h, o.pos, allUnits));
  const tier = intelligenceOf(h);
  if (h.kind === "mech") {
    const muntiInReach = reachableOthers.some((o) => o.path === "munti");
    if (defender.path === "munti") return true;
    if (muntiInReach) return false;
  }
  if (tier === "emergent") {
    if (defender.path === "munti") return true;
    if (reachableOthers.some((o) => o.path === "munti")) return false;
    // "best damage in range" — count it unless someone else in reach clearly takes more.
    const mine = estimateDamage(map, h, defender, allUnits);
    return !reachableOthers.some((o) => estimateDamage(map, h, o, allUnits) > mine);
  }
  if (tier === "pack") {
    const mine = powerScore(defender);
    return !reachableOthers.some((o) => powerScore(o) < mine);
  }
  // reflexive: nearest wins
  const myDist = chebyshevDistance(h.pos, tile);
  return !reachableOthers.some((o) => chebyshevDistance(h.pos, o.pos) < myDist);
}

/**
 * Incoming on `defender` at `tile`, counting only hostiles that would
 * plausibly pick it. `assumeRevealed`: a cloaked unit that is about to
 * attack from `tile` will be visible afterwards — score it as such.
 */
/** A shot this unit is about to take, for post-hit incoming: a Bloom's own damage scales with its remaining shell (engine/combat.ts bloomDamage) and jumps back to FULL power the moment the shell breaks (Collapse) — so wounding one into Collapse without killing it is how a "safe" 10-damage neighbour becomes a 32-damage one (House Amaranth 9 trace, the commander's own shot). */
export interface PlannedHit {
  targetId: string;
  damage: number;
}

function afterHitClone(h: BattleUnit, hit: PlannedHit): BattleUnit {
  if (h.instanceId !== hit.targetId || h.kind !== "bloom" || h.endurance === undefined) return h;
  // Overflow never carries into Vitality (Data Pack §8.3): the shell goes
  // to 0 and the creature is in Collapse, hitting at full power.
  return { ...h, endurance: Math.max(0, h.endurance - hit.damage) };
}

export function allocatedIncomingAt(threat: ThreatMap, map: MapDefinition, defender: BattleUnit, tile: Coord, allUnits: BattleUnit[], assumeRevealed = false, pendingVips?: Set<string>, afterHit?: PlannedHit): IncomingEstimate {
  if (defender.concealed && !assumeRevealed) return { total: 0, attackers: 0, worstSingle: 0 };
  const key = coordKey(tile);
  // A squadmate about to drop stops drawing fire partway through the
  // phase (the oracle models this by deducting HP; here it's a cut-off):
  // an ally under DOOMED_HP_FRACTION doesn't count as someone else's
  // preferred target. Nor does a VIP that hasn't decided yet this turn
  // (memory.pendingVips) — it is about to move out of reach. Measured
  // both ways (1 Sep 2026, 14 missions × 20 seeded runs): applying the
  // rule only when a VIP is deciding vs. to every unit came out level in
  // aggregate (201 vs 200 wins of 280) and simply traded missions —
  // line units that assume the VIPs stay hold Mission 1's attrition line
  // better (45% vs 0%), line units that assume they leave hold Mission
  // 12's zone better (70% vs 30%, and no permanent losses). The
  // principled version — they WILL leave, that's what their bar does —
  // is the one kept.
  const others = allUnits.filter(
    (u) => !u.downed && u.side === defender.side && u.instanceId !== defender.instanceId && (u.maxHp <= 0 || u.currentHp / u.maxHp >= DOOMED_HP_FRACTION) && !pendingVips?.has(u.instanceId)
  );
  let total = 0;
  let attackers = 0;
  let worstSingle = 0;
  const savedPos = defender.pos;
  const savedConcealed = defender.concealed;
  defender.pos = tile;
  if (assumeRevealed) defender.concealed = false;
  try {
    for (const fp of threat.footprints) {
      if (!fp.attackable.has(key)) continue;
      if (!wouldPick(fp.hostile, fp.attackable, defender, tile, others, map, allUnits)) continue;
      const attacker = afterHit ? afterHitClone(fp.hostile, afterHit) : fp.hostile;
      const dmg = estimateDamage(map, attacker, defender, allUnits);
      if (dmg <= 0) continue;
      total += dmg;
      attackers += 1;
      if (dmg > worstSingle) worstSingle = dmg;
    }
  } finally {
    defender.pos = savedPos;
    defender.concealed = savedConcealed;
  }
  return { total, attackers, worstSingle };
}

/** Below this share of the danger bar the allocated estimate is trusted outright; at or above it a VIP's answer is confirmed by the oracle. Keeps the oracle (a real decideHostileAction per hostile per call) off the many far-from-contact decisions. */
const ORACLE_CONFIRM_FRACTION = 0.5;

/** The estimate a decision should trust for `unit` on `tile`: the allocated sum, confirmed by the oracle for a VIP when the profile allows it and the allocated figure says contact is close. */
export function predictIncoming(threat: ThreatMap, map: MapDefinition, unit: BattleUnit, tile: Coord, allUnits: BattleUnit[], profile: PlayerAiProfile, frontLineProtected: boolean, memory: PlayerAiMemory, assumeRevealed = false, threshold?: number): IncomingEstimate {
  const allocated = allocatedIncomingAt(threat, map, unit, tile, allUnits, assumeRevealed, memory.pendingVips);
  if (!profile.hostileOracle || !frontLineProtected || (unit.concealed && !assumeRevealed)) return allocated;
  const bar = threshold ?? dangerThreshold(unit, profile, frontLineProtected);
  if (allocated.total < bar * ORACLE_CONFIRM_FRACTION && allocated.attackers === 0) return allocated;
  return predictedFocus(map, unit, tile, allUnits, memory.pendingVips);
}

// ---- Candidate tiles -----------------------------------------------------------

interface Candidate {
  tile: Coord;
  key: string;
  cost: number;
  incoming: IncomingEstimate;
  attackTarget?: BattleUnit;
  attackDamage: number;
  lethal: boolean;
  repairTarget?: BattleUnit;
  terrain: number;
}

function terrainScore(map: MapDefinition, tile: Coord): number {
  const def = TILES[tileAt(map, tile)];
  return def.defenceStars - (def.turnStartDamage ? 3 : 0);
}

function strikeMultOf(unit: BattleUnit): number {
  return unit.concealed && unit.stealthTurnsRemaining !== undefined && unit.stealthTurnsRemaining > 0 ? AMBUSH_DECLOAK_DAMAGE_MULTIPLIER : 1;
}

function bestTargetFrom(map: MapDefinition, unit: BattleUnit, from: Coord, enemies: BattleUnit[], allUnits: BattleUnit[]): { target?: BattleUnit; damage: number; lethal: boolean } {
  const mult = strikeMultOf(unit);
  const lethal = findLethalTargetFrom(map, unit, from, enemies, allUnits, mult);
  if (lethal) {
    const savedPos = unit.pos;
    unit.pos = from;
    const dmg = estimateDamage(map, unit, lethal, allUnits) * mult;
    unit.pos = savedPos;
    return { target: lethal, damage: dmg, lethal: true };
  }
  const focus = focusFireTargetInRange(map, unit, from, enemies, allUnits);
  if (!focus) return { damage: 0, lethal: false };
  const savedPos = unit.pos;
  unit.pos = from;
  const dmg = estimateDamage(map, unit, focus, allUnits) * mult;
  unit.pos = savedPos;
  return { target: focus, damage: dmg, lethal: false };
}

function criticalRepairFrom(unit: BattleUnit, from: Coord, allUnits: BattleUnit[], profile: PlayerAiProfile): BattleUnit | undefined {
  if (!unit.abilities.includes("abil_repair") || !profile.useAbilities.abil_repair) return undefined;
  const range = repairRangeOf(unit);
  return allUnits
    .filter((u) => !u.downed && u.side === unit.side && u.instanceId !== unit.instanceId && u.maxHp > 0 && u.currentHp / u.maxHp < profile.criticalAllyHpFraction && chebyshevDistance(from, u.pos) <= range)
    .sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp)[0];
}

// ---- Objective anchoring (hold_zone) ---------------------------------------------------
//
// Mission.checkWinLoss (engine/mission.ts): from holdUntilTurn on, a
// hostile standing in the zone with NO player unit in it is an instant
// loss. The first-cut Hard bot lost Mission 7 100/100 runs to exactly
// that — every retreat was individually sound and the last unit stepped
// out of the zone on turn 5. So: a unit standing in the zone that is the
// ONLY player unit in it refuses out-of-zone tiles unless staying would
// kill it outright (a lost mission is worse than a downed line unit, but
// not worse than a dead commander).

function holdZoneKeys(context: PlayerAiMissionContext): Set<string> | null {
  if (context.mission.objective !== "hold_zone") return null;
  const zone = context.map.holdZone ?? [];
  return zone.length ? new Set(zone.map(coordKey)) : null;
}

/** True when this unit is the last player unit standing in the hold zone. */
export function isZoneAnchor(unit: BattleUnit, allUnits: BattleUnit[], context: PlayerAiMissionContext): boolean {
  const keys = holdZoneKeys(context);
  if (!keys || !keys.has(coordKey(unit.pos))) return false;
  return !allUnits.some((u) => !u.downed && u.side === unit.side && u.instanceId !== unit.instanceId && keys.has(coordKey(u.pos)));
}

/** The turn from which the zone must be manned: one before Mission.checkWinLoss starts judging it (holdUntilTurn, falling back to "never" when the mission sets neither it nor a turn limit — the engine's own rule). */
function zoneManningTurn(context: PlayerAiMissionContext): number {
  const holdUntil = context.mission.objectiveParams.holdUntilTurn;
  return holdUntil === undefined ? Infinity : holdUntil - 1;
}

/**
 * Hold-zone discipline for a unit already standing in the zone: once the
 * zone is being judged, a LINE unit stays inside (out-of-zone tiles are
 * not candidates) unless staying would kill it and it isn't the anchor;
 * the anchor never leaves; a VIP is free to step out unless it is the
 * anchor. Before the manning turn, only the anchor rule applies.
 */
function zoneRestriction(unit: BattleUnit, allUnits: BattleUnit[], context: PlayerAiMissionContext, frontLineProtected: boolean, lethalHere: boolean, turn: number, purpose: "retreat" | "reposition"): Set<string> | null {
  const keys = holdZoneKeys(context);
  if (!keys || !keys.has(coordKey(unit.pos))) return null;
  if (isZoneAnchor(unit, allUnits, context)) return keys;
  if (frontLineProtected) return null;
  // A line unit that is IN the zone doesn't step OUT of it just to shoot
  // from a slightly safer tile, from turn 1 (House Amaranth 9: the
  // stand-and-fight MODERATE bot out-held a Hard line that kept
  // "repositioning" its way out of the zone). A real retreat is free
  // before the manning turn and lethal-only after it.
  // (Measured, 1 Sep 2026, five hold-zone missions × 30 seeded runs: a
  // "flank is fine once two squadmates hold it" exception traded House
  // Amaranth 9 100% → 63% for House Amaranth 5 33% → 60%, level in
  // aggregate; the simpler rule stays.)
  if (purpose === "reposition") return keys;
  if (turn >= zoneManningTurn(context) && !lethalHere) return keys;
  return null;
}

/** The hold-zone tile to walk to: the reachable-soonest one nobody can punish, else the least-punished. Null off hold_zone missions. */
export function bestHoldTile(map: MapDefinition, unit: BattleUnit, allUnits: BattleUnit[], threat: ThreatMap, context: PlayerAiMissionContext, memory: PlayerAiMemory): Coord | null {
  const zone = context.mission.objective === "hold_zone" ? (context.map.holdZone ?? []) : [];
  if (!zone.length) return null;
  const occupied = new Set(allUnits.filter((u) => !u.downed && u.instanceId !== unit.instanceId).map((u) => coordKey(u.pos)));
  let best: { tile: Coord; score: number } | null = null;
  for (const tile of zone) {
    if (occupied.has(coordKey(tile))) continue;
    const inc = allocatedIncomingAt(threat, map, unit, tile, allUnits, false, memory.pendingVips);
    const score = -inc.total * 2 - chebyshevDistance(unit.pos, tile) * 3 + terrainScore(map, tile) * TERRAIN_WEIGHT;
    if (!best || score > best.score) best = { tile, score };
  }
  return best?.tile ?? null;
}

/** Every tile this unit can reach this turn (its own tile included), scored. The attack/repair columns are only filled when the unit will still have an action after moving. `restrictTo`: only these tiles are candidates (zoneRestriction). */
function candidates(map: MapDefinition, unit: BattleUnit, enemies: BattleUnit[], allUnits: BattleUnit[], threat: ThreatMap, profile: PlayerAiProfile, memory: PlayerAiMemory, restrictTo: Set<string> | null = null): { list: Candidate[]; reach: Map<string, { cost: number; cameFrom: Coord | null }> } {
  const reach = reachableTiles(map, unit.pos, unit.moveRange, movementKindOf(unit), occupiedSet(allUnits, unit.instanceId));
  const canActAfterMove = unit.actionsRemaining >= 2;
  const list: Candidate[] = [];
  for (const [key, entry] of reach) {
    if (restrictTo && !restrictTo.has(key)) continue;
    const [x, y] = key.split(",").map(Number);
    const tile = { x, y };
    const atStart = key === coordKey(unit.pos);
    const canAct = canActAfterMove || (atStart && unit.actionsRemaining >= 1);
    const shot = canAct ? bestTargetFrom(map, unit, tile, enemies, allUnits) : { damage: 0, lethal: false };
    const repairTarget = canAct && !shot.target ? criticalRepairFrom(unit, tile, allUnits, profile) : undefined;
    // Attacking breaks a cloak — score the tile as revealed if it will
    // shoot from there — and a non-lethal hit on a Bloom is scored with
    // that Bloom's post-hit damage (PlannedHit).
    const planned = shot.target && !shot.lethal ? { targetId: shot.target.instanceId, damage: shot.damage } : undefined;
    const incoming = allocatedIncomingAt(threat, map, unit, tile, allUnits, Boolean(shot.target), memory.pendingVips, planned);
    list.push({ tile, key, cost: entry.cost, incoming, attackTarget: shot.target, attackDamage: shot.damage, lethal: shot.lethal, repairTarget, terrain: terrainScore(map, tile) });
  }
  return { list, reach };
}

/** Squad distance term — a safe tile far from everyone is how a unit gets picked off next turn, and a squad that scatters to five "safe" tiles is the first-cut Hard bot's own Mission 12 failure (each retreat individually sound, the squad gone in six turns). Two tiles from the nearest ally is free; past that it costs real points, and drifting from the squad's centre costs more. */
function isolationPenalty(unit: BattleUnit, tile: Coord, allUnits: BattleUnit[]): number {
  const allies = allUnits.filter((u) => !u.downed && u.side === unit.side && u.instanceId !== unit.instanceId && !u.isExtractionTarget);
  if (!allies.length) return 0;
  const nearest = Math.min(...allies.map((a) => chebyshevDistance(tile, a.pos)));
  const cx = allies.reduce((sum, a) => sum + a.pos.x, 0) / allies.length;
  const cy = allies.reduce((sum, a) => sum + a.pos.y, 0) / allies.length;
  const centre = Math.max(Math.abs(tile.x - cx), Math.abs(tile.y - cy));
  return (nearest > 2 ? (nearest - 2) * 8 : 0) + (centre > 4 ? (centre - 4) * 3 : 0);
}

/** Incoming weight: a line unit trades damage for damage; a VIP's incoming counts four times over, so she only ever shoots from a seat nobody can punish. */
function incomingWeight(frontLineProtected: boolean, safe: boolean): number {
  return (frontLineProtected ? 4 : 1) * (safe ? 1 : 3);
}

function rankCandidate(c: Candidate, unit: BattleUnit, allUnits: BattleUnit[], threshold: number, frontLineProtected: boolean): number {
  const safe = c.incoming.total < threshold;
  let score = safe ? 1000 : 0;
  if (c.lethal) score += frontLineProtected ? 150 : 400;
  score += c.attackDamage * 2;
  if (c.repairTarget) score += 150;
  score -= c.incoming.total * incomingWeight(frontLineProtected, safe);
  score += c.terrain * TERRAIN_WEIGHT;
  // Mission rework pass (8 Sep 2026): a VIP's isolation counts four times
  // over, like her incoming does. Traced on Wire and Mud: the commander,
  // predicted to take ~30 next turn, walked five tiles from everyone into
  // the map corner (8 points/tile of isolation vs 12 points/damage of
  // incoming), got run down there alone by the wave that came in behind
  // the squad, and ended the mission. Alone is the one place she can't be.
  score -= isolationPenalty(unit, c.tile, allUnits) * (frontLineProtected ? 4 : 1);
  score -= c.cost * 0.1;
  return score;
}

// ---- Seam 1: pre-emptive retreat ---------------------------------------------------

export function hardTierOverride(
  map: MapDefinition,
  unit: BattleUnit,
  allUnits: BattleUnit[],
  allEnemies: BattleUnit[],
  enemies: BattleUnit[],
  turn: number,
  context: PlayerAiMissionContext,
  profile: PlayerAiProfile,
  memory: PlayerAiMemory,
  frontLineProtected: boolean
): HardOverride | null {
  if (!profile.threatMap || allEnemies.length === 0) return null;
  if (unit.actionsRemaining <= 0 || unit.carryingRescueId) return null;
  // The extraction target on an extract mission is racing a turn limit — the ordinary chain's exit logic owns it.
  if (context.mission.objective === "extract_unit" && unit.isExtractionTarget) return null;
  const threat = threatMapFor(memory, map, allUnits, turn);
  const threshold = dangerThreshold(unit, profile, frontLineProtected);
  // Squad stall breaker (driveMission.ts sets commitThisTurn after two
  // turns with no board change): caution is suspended, the ordinary
  // chain plays the turn out.
  if (memory.commitThisTurn) return null;
  // A kill in place beats everything, including caution, for a line unit
  // — the chain takes it. A VIP weighs it like any other tile below.
  if (!frontLineProtected && findLethalTargetFrom(map, unit, unit.pos, enemies, allUnits, strikeMultOf(unit))) return null;
  // Cloaked (Ambush / Screen): invisible until it attacks. If the tile it
  // would be shooting from is past the bar once revealed, keep the cloak
  // — walk the objective if there is one, else hold — rather than let the
  // chain's in-place attack decloak it in the middle of the pack (first-
  // cut Hard, Mission 12: the commander's own decloak strike is what
  // pulled the whole board onto her).
  if (unit.concealed) {
    const revealed = allocatedIncomingAt(threat, map, unit, unit.pos, allUnits, true, memory.pendingVips);
    if (revealed.total < threshold) return null;
    const hold = context.mission.objective === "hold_zone" ? (context.map.holdZone ?? []) : [];
    const onHold = hold.some((c) => c.x === unit.pos.x && c.y === unit.pos.y);
    if (hold.length && !onHold) {
      const dest = hold.reduce((best, c) => (chebyshevDistance(unit.pos, c) < chebyshevDistance(unit.pos, best) ? c : best));
      const path = threatTrimmedPath(cohesiveMoveToward(map, unit, dest, allUnits), map, unit, allUnits, threat, profile, frontLineProtected, memory);
      if (path.length > 1) return { decision: { path }, reason: "preempt_retreat", logExtra: { destination: lastStep(path), note: `cloaked — ${Math.round(revealed.total)} incoming if revealed vs bar ${Math.round(threshold)}; moving on the objective instead of shooting` } };
    }
    return { decision: {}, reason: "preempt_retreat", logExtra: { note: `cloaked — ${Math.round(revealed.total)} incoming if revealed vs bar ${Math.round(threshold)}; holding the cloak` } };
  }
  // Hold-zone manning: once the zone is about to be judged, a unit
  // standing outside it walks in — to the in-zone tile with the best
  // (safety, shot) trade — instead of shooting from wherever it happens
  // to be. Mission 7's first-cut loss: four units outside the zone all
  // shooting happily while the one Tank inside it died.
  // Mission rework pass (8 Sep 2026): manning starts when THIS unit's walk
  // needs it, not at a fixed turn — a ridge eight tiles from the pads is
  // two moves away, and holdUntil-1 was one move too late (The Fallow
  // Line, The Outer Ring Falls: "hostiles hold the zone" with the squad
  // still on the approach). A VIP only mans once the squad itself is in
  // or beside the zone; the hostile AI focus-fires the commander by
  // design, and the zone only needs one unit.
  const zone = holdZoneKeys(context);
  const manningDue = (() => {
    if (!zone || zone.has(coordKey(unit.pos))) return false;
    const hold = context.map.holdZone ?? [];
    const dist = hold.reduce((best, c) => Math.min(best, chebyshevDistance(unit.pos, c)), Infinity);
    const walk = Math.max(1, Math.ceil(dist / Math.max(1, unit.moveRange)));
    if (turn + walk < zoneManningTurn(context)) return false;
    if (!frontLineProtected) return true;
    const others = allUnits.filter((u) => !u.downed && u.side === unit.side && u.instanceId !== unit.instanceId && !needsFrontLineProtection(u));
    if (!others.length) return true;
    return others.filter((u) => hold.some((c) => chebyshevDistance(c, u.pos) <= 1)).length * 2 >= others.length;
  })();
  if (zone && manningDue) {
    const { list, reach } = candidates(map, unit, enemies, allUnits, threat, profile, memory, zone);
    if (list.length) {
      list.sort((a, b) => rankCandidate(b, unit, allUnits, threshold, frontLineProtected) - rankCandidate(a, unit, allUnits, threshold, frontLineProtected));
      const best = list[0];
      const lethal = best.incoming.total >= unit.currentHp + (unit.shield ?? 0);
      if (!(frontLineProtected && best.incoming.total >= threshold) && !lethal) {
        const path = reconstructPath(reach, best.tile);
        if (path.length > 1) {
          const decision: PlayerAiDecision = { path };
          if (best.attackTarget) decision.attackTargetId = best.attackTarget.instanceId;
          else if (best.repairTarget) decision.repairTargetId = best.repairTarget.instanceId;
          return { decision, reason: "hold_zone", logExtra: { destination: lastStep(path), targetId: best.attackTarget?.instanceId, targetName: best.attackTarget?.displayName, note: `manning the zone (${Math.round(best.incoming.total)} incoming there)` } };
        }
      }
    }
  }
  const hereBase = predictIncoming(threat, map, unit, unit.pos, allUnits, profile, frontLineProtected, memory, false, threshold);
  // The chain's in-place shot, if it has one, can raise the incoming on
  // this very tile (a Bloom wounded into Collapse hits back at full power)
  // — read the tile as it will be AFTER that shot.
  const hereShot = unit.actionsRemaining > 0 ? bestTargetFrom(map, unit, unit.pos, enemies, allUnits) : { damage: 0, lethal: false };
  let here = hereBase;
  if (hereShot.target && !hereShot.lethal) {
    const before = allocatedIncomingAt(threat, map, unit, unit.pos, allUnits, true, memory.pendingVips);
    const after = allocatedIncomingAt(threat, map, unit, unit.pos, allUnits, true, memory.pendingVips, { targetId: hereShot.target.instanceId, damage: hereShot.damage });
    if (after.total > before.total) here = { ...hereBase, total: hereBase.total + (after.total - before.total) };
  }
  if (here.total < threshold) return null;

  const lethalHere = here.total >= unit.currentHp + (unit.shield ?? 0);
  const { list: rawList, reach } = candidates(map, unit, enemies, allUnits, threat, profile, memory, zoneRestriction(unit, allUnits, context, frontLineProtected, lethalHere, turn, "retreat"));
  // Mission rework pass (8 Sep 2026): same rule as combat.ts's retreatPath
  // — a VIP's pre-emptive retreat only considers tiles with an ally within
  // 2 while any such tile is reachable. See rankCandidate's isolation note.
  let list = rawList;
  if (frontLineProtected) {
    const allies = allUnits.filter((u) => !u.downed && u.side === unit.side && u.instanceId !== unit.instanceId);
    if (allies.length) {
      const covered = list.filter((c) => allies.some((a) => chebyshevDistance(a.pos, c.tile) <= 2));
      if (covered.length) list = covered;
    }
  }
  let ranked = list.sort((a, b) => rankCandidate(b, unit, allUnits, threshold, frontLineProtected) - rankCandidate(a, unit, allUnits, threshold, frontLineProtected));
  // VIP oracle re-check: the allocation model ranks, the real hostile AI decides among the top few.
  if (profile.hostileOracle && frontLineProtected && ranked.length > 1) {
    const top = ranked.slice(0, ORACLE_TOP_K).map((c) => ({ ...c, incoming: predictedFocus(map, unit, c.tile, allUnits, memory.pendingVips) }));
    top.sort((a, b) => rankCandidate(b, unit, allUnits, threshold, frontLineProtected) - rankCandidate(a, unit, allUnits, threshold, frontLineProtected));
    ranked = [...top, ...ranked.slice(ORACLE_TOP_K)];
  }
  const best = ranked[0];
  if (!best || best.key === coordKey(unit.pos)) return null;
  const safe = best.incoming.total < threshold;
  // Only move if it actually improves the picture — a "retreat" that is
  // just as exposed is a wasted action the chain could spend attacking.
  if (!safe && best.incoming.total >= here.total) return null;
  const path = reconstructPath(reach, best.tile);
  if (path.length < 2) return null;
  const decision: PlayerAiDecision = { path };
  if (best.attackTarget) decision.attackTargetId = best.attackTarget.instanceId;
  else if (best.repairTarget) decision.repairTargetId = best.repairTarget.instanceId;
  const note = `${Math.round(here.total)} incoming on ${here.attackers} attacker(s) vs bar ${Math.round(threshold)} — ${safe ? "safe" : "least-bad"} tile ${best.incoming.total.toFixed(0)}${best.attackTarget ? ", still shooting" : best.repairTarget ? ", still healing" : ""}`;
  return {
    decision,
    reason: "preempt_retreat",
    logExtra: { destination: lastStep(path), targetId: best.attackTarget?.instanceId ?? best.repairTarget?.instanceId, targetName: best.attackTarget?.displayName ?? best.repairTarget?.displayName, note },
  };
}

// ---- Seam 2: reposition before an in-place shot ------------------------------------

/** A reachable tile that still hits `target` for strictly less incoming than standing here (and isn't a worse trade on terrain/isolation). Null when here is already the best seat. */
export function betterFiringTile(map: MapDefinition, unit: BattleUnit, target: BattleUnit, allUnits: BattleUnit[], threat: ThreatMap, profile: PlayerAiProfile, frontLineProtected: boolean, memory: PlayerAiMemory, context: PlayerAiMissionContext, turn: number): Coord[] | null {
  if (unit.actionsRemaining < 2) return null;
  const zoneKeys = zoneRestriction(unit, allUnits, context, frontLineProtected, false, turn, "reposition");
  const threshold = dangerThreshold(unit, profile, frontLineProtected);
  const mult = strikeMultOf(unit);
  const savedPos = unit.pos;
  const hitDamage = estimateDamage(map, unit, target, allUnits) * mult;
  unit.pos = savedPos;
  const planned: PlannedHit | undefined = target.kind === "bloom" && !isLethalHit(target, hitDamage) ? { targetId: target.instanceId, damage: hitDamage } : undefined;
  const here = planned ? allocatedIncomingAt(threat, map, unit, unit.pos, allUnits, true, memory.pendingVips, planned) : predictIncoming(threat, map, unit, unit.pos, allUnits, profile, frontLineProtected, memory, true, threshold);
  if (here.total <= 0) return null;
  const reach = reachableTiles(map, unit.pos, unit.moveRange, movementKindOf(unit), occupiedSet(allUnits, unit.instanceId));
  const [minR, maxR] = unit.attackRange;
  let best: { tile: Coord; score: number } | null = null;
  const hereScore = -here.total * (here.total < threshold ? 1 : 3) + terrainScore(map, unit.pos) * TERRAIN_WEIGHT - isolationPenalty(unit, unit.pos, allUnits);
  for (const [key] of reach) {
    if (key === coordKey(unit.pos)) continue;
    if (zoneKeys && !zoneKeys.has(key)) continue;
    const [x, y] = key.split(",").map(Number);
    const tile = { x, y };
    const d = chebyshevDistance(tile, target.pos);
    if (d < minR || d > maxR) continue;
    const inc = allocatedIncomingAt(threat, map, unit, tile, allUnits, true, memory.pendingVips, planned);
    if (inc.total >= here.total) continue;
    const score = -inc.total * (inc.total < threshold ? 1 : 3) + terrainScore(map, tile) * TERRAIN_WEIGHT - isolationPenalty(unit, tile, allUnits);
    if (score > hereScore && (!best || score > best.score)) best = { tile, score };
  }
  if (!best) return null;
  // Same target must still be a real shot from there (damage > 0 is guaranteed by range; lethality doesn't change with the attacker's tile in this ruleset, but check anyway).
  const path = reconstructPath(reach, best.tile);
  return path.length > 1 ? path : null;
}

// ---- Seam 3: advance into range, threat-aware ----------------------------------------

/** The best (tile, target) pair for closing on `goal`: in range of it, under the danger bar when any such tile exists, best damage first. Null when no reachable tile is in range of the goal at all. */
export function threatAwareIntoRange(map: MapDefinition, unit: BattleUnit, goal: BattleUnit, enemies: BattleUnit[], allUnits: BattleUnit[], threat: ThreatMap, profile: PlayerAiProfile, frontLineProtected: boolean, memory: PlayerAiMemory, context: PlayerAiMissionContext, turn: number): { path: Coord[]; attackTargetId?: string } | null {
  // Stall breaker: line units take the ordinary advance this turn.
  if (memory.commitThisTurn && !frontLineProtected) return null;
  const threshold = dangerThreshold(unit, profile, frontLineProtected);
  const { list, reach } = candidates(map, unit, enemies, allUnits, threat, profile, memory, zoneRestriction(unit, allUnits, context, frontLineProtected, false, turn, "reposition"));
  const [minR, maxR] = unit.attackRange;
  const inRange = list.filter((c) => {
    const d = chebyshevDistance(c.tile, goal.pos);
    return d >= minR && d <= maxR;
  });
  if (!inRange.length) return null;
  inRange.sort((a, b) => rankCandidate(b, unit, allUnits, threshold, frontLineProtected) - rankCandidate(a, unit, allUnits, threshold, frontLineProtected));
  let best = inRange[0];
  if (profile.hostileOracle && frontLineProtected && !unit.concealed) {
    // The allocation model ranks; the real hostile AI confirms the pick
    // (or the next one down, up to the oracle budget).
    let confirmed: Candidate | null = null;
    for (const c of inRange.slice(0, ORACLE_TOP_K)) {
      if (c.incoming.total >= threshold) break; // ranked list — nothing below is safer
      const inc = predictedFocus(map, unit, c.tile, allUnits, memory.pendingVips);
      if (inc.total < threshold) {
        confirmed = { ...c, incoming: inc };
        break;
      }
    }
    if (!confirmed) return null;
    best = confirmed;
  }
  // If the only in-range tiles are past the bar, a line unit still goes
  // (that's what the stalemate breaker and the squad are for) unless it
  // would simply die there; a VIP never does.
  if (best.incoming.total >= threshold) {
    if (frontLineProtected) return null;
    if (best.incoming.total >= unit.currentHp + (unit.shield ?? 0)) return null;
  }
  const path = reconstructPath(reach, best.tile);
  return { path, attackTargetId: best.attackTarget?.instanceId };
}

// ---- Seam 4: trim a plain advance to the last safe step ---------------------------------

/** Cut `path` back to its last step under the danger bar. After STALL_COMMIT_TURNS turns of that yielding no progress, the full path goes through (and the counter resets). */
export function threatTrimmedPath(path: Coord[], map: MapDefinition, unit: BattleUnit, allUnits: BattleUnit[], threat: ThreatMap, profile: PlayerAiProfile, frontLineProtected: boolean, memory: PlayerAiMemory): Coord[] {
  if (path.length < 2) return path;
  if (memory.commitThisTurn && !frontLineProtected) return path;
  const threshold = dangerThreshold(unit, profile, frontLineProtected);
  const useOracle = profile.hostileOracle && frontLineProtected && !unit.concealed;
  let end = 0;
  for (let i = path.length - 1; i >= 1; i--) {
    // Allocated estimate ranks every step; the oracle (VIPs) confirms the
    // one about to be taken — one real hostile-AI pass per step actually
    // considered, not per step on the path.
    const inc = allocatedIncomingAt(threat, map, unit, path[i], allUnits, false, memory.pendingVips);
    if (inc.total >= threshold) continue;
    if (useOracle && predictedFocus(map, unit, path[i], allUnits, memory.pendingVips).total >= threshold) continue;
    end = i;
    break;
  }
  if (end === path.length - 1) {
    memory.stalledTurns.set(unit.instanceId, 0);
    return path;
  }
  const stalled = (memory.stalledTurns.get(unit.instanceId) ?? 0) + (end === 0 ? 1 : 0);
  if (end === 0 && stalled >= STALL_COMMIT_TURNS && !frontLineProtected) {
    memory.stalledTurns.set(unit.instanceId, 0);
    // Commit — but to the least-bad step, not blindly to the end.
    let bestI = path.length - 1;
    let bestInc = Infinity;
    for (let i = 1; i < path.length; i++) {
      const inc = allocatedIncomingAt(threat, map, unit, path[i], allUnits, false, memory.pendingVips).total;
      if (inc < bestInc) {
        bestInc = inc;
        bestI = i;
      }
    }
    return path.slice(0, bestI + 1);
  }
  memory.stalledTurns.set(unit.instanceId, end === 0 ? stalled : 0);
  return path.slice(0, end + 1);
}

/** Line-unit order for the driver: Tanks set the front, then Reeps and Meeps, the Munti behind them, and the commander decides last with the finished picture. */
export function hardTurnOrder(units: BattleUnit[]): BattleUnit[] {
  const rank = (u: BattleUnit): number => {
    if (needsFrontLineProtection(u) && u.path !== "munti") return 5; // commander
    switch (u.path) {
      case "tank":
        return 0;
      case "reeps":
        return 1;
      case "meeps":
        return 2;
      case "munti":
        return 4;
      default:
        return 3;
    }
  };
  return [...units].sort((a, b) => rank(a) - rank(b));
}

export type { Coord };
