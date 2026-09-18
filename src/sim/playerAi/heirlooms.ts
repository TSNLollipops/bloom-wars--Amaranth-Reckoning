// src/sim/playerAi/heirlooms.ts
// Heirloom and Signature verbs for the test bot (17 Sep 2026, Player Bot
// Reuse Plan §1b/§1c). Before this, a pilot carrying an Heirloom into a
// batch run fought as if it weren't there, so any mission built around one
// was measured wrong, both ways: "unwinnable" when the verb would win it,
// or "fine" when the verb made it cheesable.
//
// Every rule below asks the engine's own gate first (context.canX, the
// Mission method of the same name) instead of re-deriving cooldowns,
// charges, lines or the Requiem meter here. Rules come in the plan's risk
// order:
//   1. One action, the turn continues, a bad call costs a turn at most:
//      Field Triage, Farsight, Overextended, Oathkeeper, Sure Footing,
//      Firebreak, Draft, Borrowed Authority.
//   2. Whole-turn commitments: Iron Word, Deadfall Strike, Cinder Line,
//      Cutting Room Charge, Requiem Severance. Each has a "don't do this if
//      it gets me killed" check; on Hard that check is the threat map.
//   3. Heavy, with a real cost beyond the turn: The Last Word (a permanent
//      max-HP cut for the wielder, campaign-wide) and Last Rites.
//
// Deliberately skipped: Ledgerhall Static. It jams one of a hostile's
// abilities, and hostiles don't use abilities (engine/mission.ts's own
// comment on ledgerHallStatic says so plainly), so the jam changes nothing
// today and the bot would only be burning an action. Worth a rule the day
// enemies get abilities (Player Bot Reuse Plan §6, E-full).
//
// Passive Heirloom abilities (ledger_entry, salt_root_salt,
// seal_inherited_weight, cutting_room_momentum) need no decision at all.
// Nine more kit abilities are designed in data/heirlooms.ts but not wired
// into the engine yet (a player can't use them either); there is nothing
// here for them to call.
import type { Coord, MapDefinition } from "../../data/types";
import type { BattleUnit } from "../../engine/units";
import { estimateDamage, intelligenceOf } from "../../engine/ai";
import { chebyshevDistance } from "../../engine/grid";
import { BLOOM } from "../../data/bloom";
import { SEVERANCE } from "../../data/abilities";
import { IRON_WORD_RADIUS, LEDGER_OVEREXTENDED_ATK_MULTIPLIER } from "../../data/combatTables";
import type { PlayerAiProfile } from "./profile";
import type { PlayerAiDecision, PlayerAiMemory, PlayerAiMissionContext } from "./types";
import { canReachToAttack, tauntSurvivable, threatsOn } from "./abilities";
import { findLethalTargetFrom, isLethalHit, needsFrontLineProtection } from "./combat";
import { allocatedIncomingAt, dangerThreshold, threatMapFor } from "./hard";

export interface HeirloomChoice {
  decision: PlayerAiDecision;
  /** Human-readable reason for the decision log. */
  note: string;
}

export interface HeirloomInputs {
  map: MapDefinition;
  unit: BattleUnit;
  allUnits: BattleUnit[];
  turn: number;
  context: PlayerAiMissionContext;
  profile: PlayerAiProfile;
  memory: PlayerAiMemory;
  /** Enemies this unit's side can see (what it may target). */
  enemies: BattleUnit[];
  /** Every living enemy, seen or not. */
  allEnemies: BattleUnit[];
  hpFraction: number;
  frontLineProtected: boolean;
}

const coordKey = (c: Coord): string => `${c.x},${c.y}`;

/** A boss counts as this many ordinary targets when scoring a line. */
const BOSS_WEIGHT = 3;
/** Requiem hits the wielder's own tile too: never fire it without this much HP left over. */
const REQUIEM_SELF_MARGIN = 10;

function isBoss(u: BattleUnit): boolean {
  return u.kind === "bloom" && intelligenceOf(u) === "emergent";
}

function hasKnockback(u: BattleUnit): boolean {
  return u.kind === "bloom" && (BLOOM[u.archetypeId]?.onHit ?? "").includes("knockback");
}

/**
 * How much damage this unit should expect on `tile` during the enemy's
 * next phase. Hard reads the threat map (the same allocation its own
 * retreat logic uses); everyone else sums what each enemy that can reach
 * the tile would deal, which overcounts on purpose.
 */
function incomingOn(inputs: HeirloomInputs, tile: Coord): number {
  const { map, unit, allUnits, turn, profile, memory, allEnemies } = inputs;
  if (profile.threatMap) {
    return allocatedIncomingAt(threatMapFor(memory, map, allUnits, turn), map, unit, tile, allUnits, true, memory.pendingVips).total;
  }
  return allEnemies.filter((e) => canReachToAttack(e, tile)).reduce((sum, e) => sum + estimateDamage(map, e, unit, allUnits), 0);
}

/** Would ending the turn on `tile` get this unit killed (or, for a VIP on Hard, past its danger bar)? */
function unsafeToStay(inputs: HeirloomInputs, tile: Coord): boolean {
  const { unit, profile, frontLineProtected } = inputs;
  if (unit.oathkeeperActive) return false;
  const incoming = incomingOn(inputs, tile);
  if (profile.threatMap) return incoming >= dangerThreshold(unit, profile, frontLineProtected);
  return incoming >= unit.currentHp + (unit.shield ?? 0);
}

/** Enemies and friendlies standing on a set of tiles. Friendlies exclude the caster unless `countSelf`. */
function scoreTiles(tiles: Coord[], inputs: HeirloomInputs, countSelf: boolean): { hostiles: number; score: number; friendlies: number } {
  const keys = new Set(tiles.map(coordKey));
  const { unit, allUnits, enemies } = inputs;
  let hostiles = 0;
  let score = 0;
  for (const e of enemies) {
    if (!keys.has(coordKey(e.pos))) continue;
    hostiles += 1;
    score += isBoss(e) ? BOSS_WEIGHT : 1;
  }
  const friendlies = allUnits.filter((u) => !u.downed && u.side === unit.side && (countSelf || u.instanceId !== unit.instanceId) && keys.has(coordKey(u.pos))).length;
  return { hostiles, score, friendlies };
}

/** The best of a set of candidate clicks for a line-shaped verb, deduplicated by the line each click resolves to. */
function bestLine(
  candidates: Coord[],
  preview: (target: Coord) => Coord[] | null,
  inputs: HeirloomInputs,
  countSelf: boolean
): { tile: Coord; line: Coord[]; hostiles: number; score: number } | null {
  const seen = new Set<string>();
  let best: { tile: Coord; line: Coord[]; hostiles: number; score: number } | null = null;
  for (const c of candidates) {
    const line = preview(c);
    if (!line || !line.length) continue;
    const key = line.map(coordKey).join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    const s = scoreTiles(line, inputs, countSelf);
    if (s.friendlies > 0 || s.hostiles === 0) continue;
    if (!best || s.score > best.score) best = { tile: c, line, hostiles: s.hostiles, score: s.score };
  }
  return best;
}

// ---- The rules -----------------------------------------------------------------

function lastWord(inputs: HeirloomInputs): HeirloomChoice | null {
  const { unit, allUnits, context, allEnemies } = inputs;
  if (!context.canLastWordSignature?.(unit.instanceId) || !context.getLastWordSignatureTargetsFrom) return null;
  if (!allEnemies.length) return null; // the fight is over: the cost (permanent max HP) buys nothing
  const targets = context.getLastWordSignatureTargetsFrom(unit.instanceId);
  if (!targets.length) return null;
  const standing = allUnits.filter((u) => !u.downed && u.side === unit.side && !u.npcIncapacitated && !u.isCivilian).length;
  const squad = allUnits.filter((u) => u.side === unit.side && !!u.pilotId).length;
  // The wielder pays for this for the rest of the campaign, so the bot only
  // spends it when the mission is at risk: the squad is down to half, or the
  // one on the floor is a Munti (the squad's only way to heal).
  const pick = [...targets].sort((a, b) => Number(b.path === "munti") - Number(a.path === "munti") || b.maxHp - a.maxHp)[0];
  if (standing > Math.ceil(squad / 2) && pick.path !== "munti") return null;
  return { decision: { action: "last_word", abilityTargetId: pick.instanceId }, note: `The Last Word on ${pick.displayName} (${standing}/${squad} standing)` };
}

function lastRites(inputs: HeirloomInputs): HeirloomChoice | null {
  const { map, unit, allUnits, context, enemies } = inputs;
  if (!context.canLastRites?.(unit.instanceId) || !context.getLastRitesTargetsFrom) return null;
  // One borrowed action is only worth granting if it can finish something.
  for (const t of context.getLastRitesTargetsFrom(unit.instanceId)) {
    const kill = findLethalTargetFrom(map, t, t.pos, enemies, allUnits);
    if (kill) return { decision: { action: "last_rites", abilityTargetId: t.instanceId }, note: `Last Rites: ${t.displayName} can still finish ${kill.displayName}` };
  }
  return null;
}

function fieldTriage(inputs: HeirloomInputs): HeirloomChoice | null {
  const { unit, context, profile } = inputs;
  if (!context.canFieldTriage?.(unit.instanceId) || !context.getFieldTriageTargetsFrom) return null;
  const targets = context.getFieldTriageTargetsFrom(unit.instanceId, unit.pos);
  const hurt = targets.filter((t) => t.maxHp > 0 && t.currentHp / t.maxHp < profile.routineAllyHpFraction);
  const critical = hurt.some((t) => t.currentHp / t.maxHp < profile.criticalAllyHpFraction);
  // One patient is what ordinary Repair is for; Triage earns its cooldown on two.
  if (hurt.length < 2 && !(critical && hurt.length >= 1 && targets.length >= 2)) return null;
  return { decision: { action: "field_triage" }, note: `Field Triage on ${hurt.length} wounded` };
}

function farsight(inputs: HeirloomInputs): HeirloomChoice | null {
  const { unit, context, enemies, allEnemies } = inputs;
  if (!context.canFarsightSignature?.(unit.instanceId)) return null;
  const hidden = allEnemies.length - enemies.length;
  if (hidden <= 0) return null;
  if (enemies.length > 0 && hidden < 2) return null;
  return { decision: { action: "farsight" }, note: `Farsight: ${hidden} contact(s) out of sight` };
}

function requiem(inputs: HeirloomInputs): HeirloomChoice | null {
  const { unit, context, profile } = inputs;
  if (!context.canRequiemSeverance?.(unit.instanceId) || !context.getRequiemDirectionTargets || !context.previewRequiemSeverance) return null;
  // Severance hits the wielder's own tile. Never fire it into our own grave.
  if (!unit.oathkeeperActive && unit.currentHp + (unit.shield ?? 0) <= SEVERANCE.damage + REQUIEM_SELF_MARGIN) return null;
  // Called through `context`, never pulled off it: these are Mission methods and need their `this`.
  const best = bestLine(context.getRequiemDirectionTargets(unit.instanceId), (t) => context.previewRequiemSeverance?.(unit.instanceId, t) ?? null, inputs, false);
  if (!best || best.score < profile.strikeMinTargets) return null;
  return { decision: { action: "requiem", targetTile: best.tile }, note: `Requiem Severance: ${best.hostiles} on the line` };
}

function deadfall(inputs: HeirloomInputs): HeirloomChoice | null {
  const { map, unit, allUnits, context } = inputs;
  if (!context.canDeadfallStrike?.(unit.instanceId) || !context.getDeadfallStrikeTargetsFrom) return null;
  if (unsafeToStay(inputs, unit.pos)) return null; // it ends the turn where the unit stands
  const targets = context.getDeadfallStrikeTargetsFrom(unit.instanceId);
  let best: { t: BattleUnit; value: number } | null = null;
  for (const t of targets) {
    const lethal = isLethalHit(t, estimateDamage(map, unit, t, allUnits) * 2);
    // A kill anywhere on the map, or a boss hit that nothing can dodge or answer.
    const value = lethal ? t.maxHp + (isBoss(t) ? 1000 : 0) : isBoss(t) ? t.maxHp / 2 : 0;
    if (value > 0 && (!best || value > best.value)) best = { t, value };
  }
  if (!best) return null;
  return { decision: { action: "deadfall_strike", abilityTargetId: best.t.instanceId }, note: `Deadfall on ${best.t.displayName}` };
}

function cinderLine(inputs: HeirloomInputs): HeirloomChoice | null {
  const { unit, context, profile, allUnits } = inputs;
  if (!context.canCinderLineSignature?.(unit.instanceId) || !context.getCinderLineAreaFrom || !context.previewCinderLineFrom) return null;
  if (unsafeToStay(inputs, unit.pos)) return null;
  const best = bestLine(context.getCinderLineAreaFrom(unit.instanceId, unit.pos), (t) => context.previewCinderLineFrom?.(unit.instanceId, t) ?? null, inputs, true);
  if (!best || best.score < profile.strikeMinTargets) return null;
  // The line burns for three turns: keep it off the squad's doorstep too.
  const keys = best.line;
  const friendNextToIt = allUnits.some(
    (u) => !u.downed && u.side === unit.side && u.instanceId !== unit.instanceId && keys.some((k) => chebyshevDistance(k, u.pos) <= 1)
  );
  if (friendNextToIt) return null;
  return { decision: { action: "cinder_line", targetTile: best.tile }, note: `Cinder Line: ${best.hostiles} on the line` };
}

function cuttingRoomCharge(inputs: HeirloomInputs): HeirloomChoice | null {
  const { unit, context, profile, hpFraction } = inputs;
  if (!context.canCuttingRoomCharge?.(unit.instanceId) || !context.getCuttingRoomChargeAreaFrom || !context.previewCuttingRoomChargeFrom) return null;
  const best = bestLine(context.getCuttingRoomChargeAreaFrom(unit.instanceId, unit.pos), (t) => context.previewCuttingRoomChargeFrom?.(unit.instanceId, t) ?? null, inputs, false);
  if (!best) return null;
  // Two or more in a row is what the charge is for. One is still worth it
  // when the charge kills it: the move ignores terrain, so it reaches a
  // kill an ordinary move-and-shoot can't.
  const single = best.hostiles === 1 ? inputs.enemies.find((e) => best.line.some((c) => c.x === e.pos.x && c.y === e.pos.y)) : undefined;
  const singleKill = single !== undefined && isLethalHit(single, estimateDamage(inputs.map, unit, single, inputs.allUnits));
  if (best.score < profile.strikeMinTargets && !singleKill) return null;
  // The charge ends next to the last enemy it hits: the tile just before it.
  const hitIdx = best.line.map((c, i) => (inputs.enemies.some((e) => e.pos.x === c.x && e.pos.y === c.y) ? i : -1)).filter((i) => i >= 0);
  const lastHit = hitIdx[hitIdx.length - 1];
  const end = lastHit > 0 ? best.line[lastHit - 1] : unit.pos;
  // Moderate's reach count is generous (straight-line, walls ignored), so it only vetoes a charge into a crowd.
  if (profile.threatMap ? unsafeToStay(inputs, end) : hpFraction < 0.4 || threatsOn(end, inputs.allEnemies) > 3) return null;
  return { decision: { action: "cutting_room_charge", targetTile: best.tile }, note: `Cutting Room: ${best.hostiles} in the line` };
}

function ironWordOrOath(inputs: HeirloomInputs): HeirloomChoice | null {
  const { map, unit, allUnits, turn, context, profile, memory, enemies, hpFraction } = inputs;
  if (!context.canIronWord?.(unit.instanceId)) return null;
  if (needsFrontLineProtection(unit)) return null; // the unit this exists to protect never plays bait
  const vips = allUnits.filter((u) => !u.downed && u.side === unit.side && u.instanceId !== unit.instanceId && needsFrontLineProtection(u));
  const pulled = enemies.filter((e) => chebyshevDistance(e.pos, unit.pos) <= IRON_WORD_RADIUS && vips.some((v) => canReachToAttack(e, v.pos)));
  if (!pulled.length) return null;
  const oathReady = !unit.oathkeeperActive && (context.canOathkeeper?.(unit.instanceId) ?? false);
  const survivable = unit.oathkeeperActive
    ? true
    : profile.threatMap
      ? tauntSurvivable(threatMapFor(memory, map, allUnits, turn), map, unit, allUnits)
      : threatsOn(unit.pos, enemies) <= profile.tauntMaxThreats && hpFraction >= profile.tauntMinHpFraction;
  if (!survivable) {
    // Arm the oath first (one action), then the Word on the next decision.
    if (oathReady && unit.actionsRemaining >= 2) return { decision: { action: "oathkeeper" }, note: "Oathkeeper first, so the Iron Word doesn't kill its speaker" };
    return null;
  }
  return { decision: { action: "iron_word" }, note: `Iron Word: pulling ${pulled.length} off the squad's VIPs` };
}

function oathkeeper(inputs: HeirloomInputs): HeirloomChoice | null {
  const { unit, context, allEnemies } = inputs;
  if (unit.oathkeeperActive || !context.canOathkeeper?.(unit.instanceId)) return null;
  if (!allEnemies.some((e) => canReachToAttack(e, unit.pos))) return null;
  if (incomingOn(inputs, unit.pos) < unit.currentHp + (unit.shield ?? 0)) return null;
  return { decision: { action: "oathkeeper" }, note: "Oathkeeper: the next phase would drop me" };
}

function overextend(inputs: HeirloomInputs): HeirloomChoice | null {
  const { map, unit, allUnits, context, enemies, allEnemies, profile, hpFraction } = inputs;
  if (unit.actionsRemaining < 2 || !context.canLedgerOverextended?.(unit.instanceId)) return null;
  const [minR, maxR] = unit.attackRange;
  const inRange = enemies.filter((e) => chebyshevDistance(unit.pos, e.pos) >= minR && chebyshevDistance(unit.pos, e.pos) <= maxR);
  if (!inRange.length) return null;
  // The trade is zero DEF until my next turn. Two cases are worth it:
  //   - the extra 40% turns a hit into a kill (chooseHeirloomAction never
  //     reaches here when an unboosted kill exists), or
  //   - I'm hitting anyway and nobody can punish me for it: no enemy other
  //     than the one I'm hitting can reach this tile, and I'm healthy.
  const boosted = findLethalTargetFrom(map, unit, unit.pos, inRange, allUnits, LEDGER_OVEREXTENDED_ATK_MULTIPLIER);
  const reachers = allEnemies.filter((e) => canReachToAttack(e, unit.pos));
  const target = boosted ?? inRange[0];
  const others = reachers.filter((e) => e !== target);
  if (profile.threatMap) {
    if (incomingOn(inputs, unit.pos) * 1.5 >= unit.currentHp) return null;
    if (!boosted && others.length > 0) return null;
  } else if (boosted ? others.length > 1 || hpFraction < 0.5 : others.length > 1 || hpFraction < 0.7) {
    return null;
  }
  return { decision: { action: "overextend" }, note: boosted ? `Overextended: +40% makes ${boosted.displayName} a kill` : `Overextended: nobody else can reach me` };
}

function borrowedAuthority(inputs: HeirloomInputs): HeirloomChoice | null {
  const { unit, context, enemies } = inputs;
  if (unit.actionsRemaining < 2 || unit.borrowedAuthorityFxKind || !context.canSealBorrowedAuthority?.(unit.instanceId)) return null;
  const [minR, maxR] = unit.attackRange;
  const bloomInRange = enemies.some((e) => e.kind === "bloom" && chebyshevDistance(unit.pos, e.pos) >= minR && chebyshevDistance(unit.pos, e.pos) <= maxR);
  if (!bloomInRange) return null;
  return { decision: { action: "borrowed_authority" }, note: "Borrowed Authority before the swing" };
}

function sureFooting(inputs: HeirloomInputs): HeirloomChoice | null {
  const { unit, context, allEnemies } = inputs;
  if (unit.sureFootingActive || !context.canCuttingRoomSureFooting?.(unit.instanceId)) return null;
  if (!allEnemies.some((e) => hasKnockback(e) && canReachToAttack(e, unit.pos))) return null;
  return { decision: { action: "sure_footing" }, note: "Sure Footing: a knockback hitter can reach me" };
}

function surtrManagement(inputs: HeirloomInputs): HeirloomChoice | null {
  const { unit, allUnits, context } = inputs;
  const lines = context.getActiveSurtrLines?.().filter((l) => l.ownerId === unit.instanceId) ?? [];
  if (!lines.length) return null;
  const friendlyOnLine = lines.some(
    (l) => l.friendlyImmuneTurnsRemaining <= 0 && allUnits.some((u) => !u.downed && u.side === unit.side && l.tiles.some((t) => t.x === u.pos.x && t.y === u.pos.y))
  );
  if (!friendlyOnLine) return null;
  if (context.canDraft?.(unit.instanceId)) return { decision: { action: "draft" }, note: "Draft: a squadmate is standing in my fire" };
  if (context.canFirebreak?.(unit.instanceId)) return { decision: { action: "firebreak" }, note: "Firebreak: a squadmate is standing in my fire" };
  return null;
}

/**
 * The one entry point index.ts calls. Returns the first rule that fires, in
 * priority order, or null. Every rule refuses on its own when the unit
 * doesn't carry that verb, so a squad with no Heirloom falls straight
 * through.
 */
export function chooseHeirloomAction(inputs: HeirloomInputs): HeirloomChoice | null {
  if (!inputs.profile.useAbilities.heirloom) return null;
  if (inputs.unit.actionsRemaining <= 0) return null;
  // Support first. Strikes only when there isn't a plain kill on the table:
  // a guaranteed kill for one action beats any whole-turn verb, and the
  // chain below this call takes it.
  const support = [lastWord, lastRites, fieldTriage, surtrManagement, farsight, oathkeeper];
  const strikes = [ironWordOrOath, requiem, deadfall, cinderLine, cuttingRoomCharge, overextend, borrowedAuthority, sureFooting];
  const { map, unit, allUnits, enemies } = inputs;
  const plainKill = findLethalTargetFrom(map, unit, unit.pos, enemies, allUnits);
  const rules = plainKill ? support : [...support, ...strikes];
  for (const rule of rules) {
    const choice = rule(inputs);
    if (choice) return choice;
  }
  return null;
}
