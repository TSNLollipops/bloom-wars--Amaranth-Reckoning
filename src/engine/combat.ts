// src/engine/combat.ts
// The combat resolver, transcribed from Data Pack §7.4 (mech/pilot vs
// mech/pilot) and §8.2/§8.3 (Bloom Endurance/Vitality Collapse). Every
// number here must reproduce sim_output.txt exactly — see src/sim/tests.
import type { MapDefinition } from "../data/types";
import {
  POWER,
  FULL_HP_DAMAGE_CAP,
  CENTAUROID_CHARGE_MULT,
  SALT_ROOT_SESSILE_MULTIPLIER,
  SALT_ROOT_OTHER_MULTIPLIER,
  SALT_ROOT_RANK5_OTHER_MULTIPLIER,
  LEDGER_OVEREXTENDED_ATK_MULTIPLIER,
  LEDGER_OVEREXTENDED_DEFENSE_FLOOR,
  LEDGER_ENTRY_DAMAGE_PER_STACK,
  LEDGER_ENTRY_STACK_CAP,
  LEDGER_ENTRY_RANK5_STACK_CAP,
  OATHKEEPER_HP_FLOOR,
} from "../data/combatTables";
import { RAIL_LANCE_DEF_IGNORE_PCT } from "../data/weaponBranches";
import { TILES } from "../data/tiles";
import { chebyshevDistance, tileAt } from "./grid";
import type { BattleUnit } from "./units";
import { UNDERTOW_SURFACE_DAMAGE_MULT, BLOOM } from "../data/bloom";
import { attackDebuffMultiplier, momentumAttackMultiplier } from "./turnManager";

/**
 * salt_root_salt (Delenda/Salt the Root, Vault Phase 2 slice 1) — passive,
 * no action cost, no cooldown (data/heirlooms.ts's own cooldownTurns: 0 for
 * this ability): x1.6 against sessile/hive-type Bloom, x0.7 against
 * everything else (x0.85 at rank 5). Applies whenever `attacker` carries
 * the ability, on EITHER side of an exchange — a primary attack or a
 * counter-swing, mech-vs-mech or mech-vs-Bloom — since this is a property
 * of how Delenda fights, not a Bloom-only or primary-attack-only rider.
 * `defenderArchetypeId` is only ever set for a Bloom-shape defender
 * (data/bloom.ts's own archetype id); a mech-shape defender has none, which
 * correctly falls through to the "everything else" penalty — a rival mech
 * is never sessile/hive-type. See SALT_ROOT_SESSILE_MULTIPLIER's own
 * comment in data/combatTables.ts for the "sessile" category call.
 */
export function saltRootMultiplier(attacker: BattleUnit, defenderArchetypeId: string | undefined): number {
  if (!attacker.abilities.includes("salt_root_salt")) return 1;
  const sessile = defenderArchetypeId !== undefined && BLOOM[defenderArchetypeId]?.movementType === "sessile";
  if (sessile) return SALT_ROOT_SESSILE_MULTIPLIER;
  const rank = attacker.heirloomAbilityRanks?.["salt_root_salt"] ?? 1;
  return rank >= 5 ? SALT_ROOT_RANK5_OTHER_MULTIPLIER : SALT_ROOT_OTHER_MULTIPLIER;
}

/** ledger_overextended (Skuld/Widow's Ledger, Vault Phase 2 slice 1) — the +40% ATK half of "trade defense for one turn," applied on either side of an exchange for the same reason saltRootMultiplier is. 1 (no change) when `unit.overextended` isn't set. See BattleUnit.overextended's own comment (engine/units.ts) for exactly when it clears. */
export function overextendedAttackMultiplier(unit: BattleUnit): number {
  return unit.overextended ? LEDGER_OVEREXTENDED_ATK_MULTIPLIER : 1;
}

/**
 * ledger_overextended's "0 DEF" half. A literal 0 would divide by zero in
 * the `100 / defense` term below (Infinity/NaN damage, not "very bad
 * defense") — floored at LEDGER_OVEREXTENDED_DEFENSE_FLOOR instead, the
 * smallest value that keeps the formula finite while still reading as "as
 * good as no defense at all." Read at every point `defender.effectiveDefense`
 * would otherwise be used, in place of the raw field.
 */
export function overextendedDefense(unit: BattleUnit): number {
  return unit.overextended ? LEDGER_OVEREXTENDED_DEFENSE_FLOOR : unit.effectiveDefense;
}

/**
 * ledger_entry (Skuld/Widow's Ledger, Vault Phase 2 slice 2) — "+8% damage
 * per kill this mission, stacking, for the rest of the mission." 1 (no-op)
 * for a unit without the ability, same shape saltRootMultiplier/
 * overextendedAttackMultiplier already establish.
 *
 * `killsThisMission` is a plain number the CALLER supplies rather than a
 * second, unit-local counter this function reads off `unit` itself — the
 * one true count already lives on Mission.unitPerformance[pilotId].kills
 * (recordPerformance/resolveKill's own bookkeeping), and every call site
 * that could plausibly want this multiplier is a Mission method with that
 * table in scope (see engine/mission.ts's killsThisMissionFor). Keeping the
 * count OFF BattleUnit avoids a second place a kill tally could drift out of
 * sync with the one campaignEconomy.ts and the Debrief screen already trust.
 *
 * STACK CAP: see LEDGER_ENTRY_STACK_CAP's own comment in
 * data/combatTables.ts for why this is a placeholder rather than the
 * literally-unbounded stacking rank1's prose reads as.
 */
export function ledgerEntryMultiplier(unit: BattleUnit, killsThisMission: number): number {
  if (!unit.abilities.includes("ledger_entry")) return 1;
  const rank = unit.heirloomAbilityRanks?.["ledger_entry"] ?? 1;
  const cap = rank >= 5 ? LEDGER_ENTRY_RANK5_STACK_CAP : LEDGER_ENTRY_STACK_CAP;
  const stacks = Math.min(Math.max(0, killsThisMission), cap);
  return 1 + LEDGER_ENTRY_DAMAGE_PER_STACK * stacks;
}

export interface AttackResult {
  damage: number;
  defenderHpAfter: number;
  defenderDowned: boolean;
  countered: boolean;
  counterDamage?: number;
  attackerHpAfter?: number;
  attackerDowned?: boolean;
  dodged?: boolean; // defender dodged the primary hit (Meeps house rule)
  counterDodged?: boolean; // attacker dodged the counter-hit (Meeps house rule)
}

/** +1 defence star per adjacent, non-downed, same-side Tank (abil_overshield). Does not stack. */
export function overshieldBonus(defender: BattleUnit, sameSideUnits: BattleUnit[]): number {
  const hasAdjacentTank = sameSideUnits.some(
    (u) =>
      u.instanceId !== defender.instanceId &&
      !u.downed &&
      u.path === "tank" &&
      u.abilities.includes("abil_overshield") &&
      chebyshevDistance(u.pos, defender.pos) <= 1
  );
  return hasAdjacentTank ? 1 : 0;
}

function terrainStars(map: MapDefinition, unit: BattleUnit): number {
  return TILES[tileAt(map, unit.pos)].defenceStars;
}

/**
 * Tank shield house rule (data/combatTables.ts) — true if `unit` currently
 * benefits from a same-side Tank's shield aura: either it IS an eligible
 * (non-downed, abil_overshield) Tank, or it's adjacent to one. Deliberately
 * mirrors overshieldBonus()'s adjacency check but, unlike that one, the
 * Tank itself is included — it shields itself too, not just its neighbors.
 */
export function tankShieldEligible(unit: BattleUnit, sameSideUnits: BattleUnit[]): boolean {
  if (unit.downed) return false;
  const isEligibleTank = (u: BattleUnit) => u.path === "tank" && !u.downed && u.abilities.includes("abil_overshield");
  if (isEligibleTank(unit)) return true;
  return sameSideUnits.some(
    (u) => u.instanceId !== unit.instanceId && isEligibleTank(u) && chebyshevDistance(u.pos, unit.pos) <= 1
  );
}

/**
 * Mech-shape (pilot or hostile mech) attacking a mech-shape defender.
 * Data Pack §7.4 pseudocode, transcribed 1:1 including the two
 * load-bearing comments about counterMaxRange vs attackRange and the
 * counter using the identical capped formula.
 */
export function resolveMechAttack(
  map: MapDefinition,
  attacker: BattleUnit,
  defender: BattleUnit,
  defenderSameSide: BattleUnit[],
  attackerSameSide: BattleUnit[],
  charged: boolean,
  defenderDodged = false,
  attackerDodgedCounter = false,
  // Vault Phase 2, slice 2 (3 Sep 2026) — bundled into one opts object
  // rather than two more positional params, both purely additive (every
  // pre-existing call site, sim_output.txt's included, omits this and gets
  // byte-identical behavior):
  //   - attackerKillsThisMission/defenderKillsThisMission feed
  //     ledgerEntryMultiplier for whichever side carries ledger_entry —
  //     engine/mission.ts's killsThisMissionFor is the one place that reads
  //     Mission.unitPerformance to produce these, so this file never needs
  //     its own copy of that count.
  //   - noCounter is deadfall_strike's own "uncounterable" clause — skips
  //     the whole counterattack block below outright rather than a
  //     dodge-shaped bypass, since deadfall_strike isn't dodged either, it's
  //     a different property (no counter chance to roll at all, not a 0%
  //     roll of one that could exist).
  opts?: { attackerKillsThisMission?: number; defenderKillsThisMission?: number; noCounter?: boolean }
): AttackResult {
  if (!attacker.path || !defender.path) {
    throw new Error("resolveMechAttack requires mech-shape units (with a Path)");
  }
  const terrain = terrainStars(map, defender) + overshieldBonus(defender, defenderSameSide);
  let dmg = POWER[attacker.path][defender.path];
  dmg *= attacker.currentHp / attacker.maxHp;
  dmg *= attacker.effectiveAttack / 100;
  // Bloom on-hit effects engine (engine/turnManager.ts, 27 Aug 2026) —
  // fx_debuff_attack/fx_choir_dissonance (Sirenmaw/Choir). 1 when no such
  // effect is active, so this is a no-op for every attacker without one —
  // every pre-existing sim_output.txt test case stays byte-identical.
  dmg *= attackDebuffMultiplier(attacker);
  // Vault Phase 2, slice 1 (2 Sep 2026) — both 1 (no-op) for every attacker
  // that doesn't carry the ability/posture, same "1 when inactive" shape
  // attackDebuffMultiplier already establishes just above, so every
  // pre-existing sim_output.txt test case stays byte-identical.
  dmg *= saltRootMultiplier(attacker, undefined); // undefined: a mech-shape defender is never "sessile/hive-type"
  dmg *= overextendedAttackMultiplier(attacker);
  // Vault Phase 2, slice 2 (3 Sep 2026) — ledger_entry, same "1 when
  // inactive/no kills yet" no-op shape as every multiplier above it.
  dmg *= ledgerEntryMultiplier(attacker, opts?.attackerKillsThisMission ?? 0);
  // Vault Phase 2, slice 4 (3 Sep 2026) — cutting_room_momentum's rank-5
  // +10% ATK window, same no-op-when-inactive shape as every multiplier
  // above it.
  dmg *= momentumAttackMultiplier(attacker);
  // Rail Lance (Weapon Branch Point System, data/weaponBranches.ts) —
  // armor-piercing, ONLY on the primary attacker->defender hit, ONLY
  // against a Tank-path defender: sharpens Reeps-beats-Tank rather than a
  // flat damage buff that would blur every matchup equally. Deliberately
  // not applied to the counter-damage calculation below — Rail Lance is
  // Reeps' own weapon; a Tank countering a Reeps doesn't fire it back.
  const railLanceDefenseIgnore =
    attacker.weaponBranchId === "reeps_rail_lance" && defender.path === "tank" ? RAIL_LANCE_DEF_IGNORE_PCT : 0;
  dmg *= 100 / (overextendedDefense(defender) * (1 - railLanceDefenseIgnore));
  dmg *= 1 - 0.1 * terrain;
  if (charged) dmg *= CENTAUROID_CHARGE_MULT;
  dmg = Math.round(dmg);
  if (defender.currentHp >= defender.maxHp) dmg = Math.min(dmg, FULL_HP_DAMAGE_CAP);
  // Meeps house rule (MEEPS_DODGE_CHANCE, data/combatTables.ts) — the roll
  // itself happens at the engine/mission.ts call site, not here, so this
  // formula stays the exact Data Pack §7.4 pseudocode when defenderDodged
  // is left at its default false (every existing sim_output.txt test case
  // calls this function without the new trailing args).
  if (defenderDodged) dmg = 0;

  const defenderHpAfter = Math.max(0, defender.currentHp - dmg);
  const defenderDowned = defenderHpAfter <= 0;

  const result: AttackResult = { damage: dmg, defenderHpAfter, defenderDowned, countered: false, dodged: defenderDodged };

  // Counterattack — three load-bearing conditions:
  //   1. the defender survived the hit
  //   2. the defender can counter at all
  //   3. the attacker is within counterMaxRange -- NOT attackRange.
  // Condition 3 is why a Reeps firing from range 3 is never countered, and
  // why a Munti with a 2-tile attack still only counters at 1. deadfall_strike's
  // own opts.noCounter (Vault Phase 2, slice 2) is a fourth, explicit gate —
  // "uncounterable" regardless of what the three conditions above would say.
  if (!opts?.noCounter && !defenderDowned && defender.canCounter && chebyshevDistance(defender.pos, attacker.pos) <= defender.counterMaxRange) {
    // The counter runs the IDENTICAL formula, cap included — the
    // attacker is usually at full HP when countered, so exempting the
    // counter from the cap would quietly make counterattacks the second
    // thing in the game that can delete a full-HP unit. Severance is
    // meant to be the only one.
    const counterTerrain = terrainStars(map, attacker) + overshieldBonus(attacker, attackerSameSide);
    let counterDmg = POWER[defender.path][attacker.path];
    counterDmg *= defenderHpAfter / defender.maxHp;
    counterDmg *= defender.effectiveAttack / 100;
    counterDmg *= attackDebuffMultiplier(defender); // same on-hit debuff, applied to the defender's own counter-swing
    // Vault Phase 2, slice 1 (2 Sep 2026) — same two effects as the primary
    // hit above, applied to whichever side is doing the striking here: the
    // defender is the one counter-swinging, so their own salt_root_salt/
    // overextended reads; the attacker is the one being hit by it, so
    // their own "0 DEF" floor reads, not the defender's.
    counterDmg *= saltRootMultiplier(defender, undefined);
    counterDmg *= overextendedAttackMultiplier(defender);
    // Vault Phase 2, slice 2 (3 Sep 2026) — the defender is the one
    // counter-swinging here, so THEIR OWN kill count/ledger_entry reads,
    // not the attacker's — same "whichever side is doing the striking"
    // split saltRootMultiplier/overextendedAttackMultiplier already use two
    // lines up.
    counterDmg *= ledgerEntryMultiplier(defender, opts?.defenderKillsThisMission ?? 0);
    // Vault Phase 2, slice 4 (3 Sep 2026) — same split as saltRootMultiplier/
    // overextendedAttackMultiplier/ledgerEntryMultiplier just above: the
    // DEFENDER is the one counter-swinging here, so their own Momentum
    // window (if any) reads.
    counterDmg *= momentumAttackMultiplier(defender);
    counterDmg *= 100 / overextendedDefense(attacker);
    counterDmg *= 1 - 0.1 * counterTerrain;
    counterDmg = Math.round(counterDmg);
    if (attacker.currentHp >= attacker.maxHp) counterDmg = Math.min(counterDmg, FULL_HP_DAMAGE_CAP);
    // Meeps dodging the counter-hit they take as the ORIGINAL attacker —
    // same house rule, independent roll from the defender's own dodge above.
    if (attackerDodgedCounter) counterDmg = 0;

    const attackerHpAfter = Math.max(0, attacker.currentHp - counterDmg);
    result.countered = true;
    result.counterDamage = counterDmg;
    result.attackerHpAfter = attackerHpAfter;
    result.attackerDowned = attackerHpAfter <= 0;
    result.counterDodged = attackerDodgedCounter;
  }

  return result;
}

export interface BloomAttackResult {
  damage: number;
  defenderHpAfter: number;
  defenderDowned: boolean;
}

/** Data Pack §8.2 — a Bloom creature attacking a mech-shape defender. */
export function bloomDamage(
  attacker: BattleUnit,
  defender: BattleUnit,
  map: MapDefinition,
  defenderSameSide: BattleUnit[],
  surfacedThisTurn: boolean,
  defenderDodged = false
): number {
  if (attacker.endurance === undefined || attacker.maxEndurance === undefined || attacker.attackPower === undefined) {
    throw new Error("bloomDamage requires a Bloom-shape attacker");
  }
  let dmg = attacker.attackPower;
  // A creature with its shell intact hits softer as the shell breaks. A
  // creature in Collapse hits at FULL power — it is dying, not weakening.
  if (attacker.endurance > 0) {
    dmg *= attacker.endurance / attacker.maxEndurance;
  }
  dmg *= 100 / defender.effectiveDefense;
  dmg *= 1 - 0.1 * (terrainStars(map, defender) + overshieldBonus(defender, defenderSameSide));
  if (surfacedThisTurn) dmg *= UNDERTOW_SURFACE_DAMAGE_MULT;
  dmg = Math.round(dmg);
  if (defender.currentHp >= defender.maxHp) dmg = Math.min(dmg, FULL_HP_DAMAGE_CAP);
  // Meeps house rule (MEEPS_DODGE_CHANCE) — see resolveMechAttack's comment.
  if (defenderDodged) dmg = 0;
  return dmg;
}

/**
 * oath_oathkeeper (Vindex/The Iron Oath, Vault Phase 2 slice 2) — "cannot be
 * reduced below 1 HP for N turns; all spared damage lands the instant it
 * ends." Every damage source that reaches a mech-shape unit funnels through
 * THIS function (mech-vs-mech, mech-vs-Bloom-defender never calls it — see
 * applyBloomDamage for that side — tile damage, acid_dot, missiles, fire
 * support, cleave), which makes it the one correct choke point for an
 * unconditional HP floor: no call site needs its own awareness of Oathkeeper.
 *
 * While `unit.oathkeeperActive` is true, damage that would take currentHp
 * below OATHKEEPER_HP_FLOOR is capped there instead, and the SPARED portion
 * (what currentHp would have lost past the floor) accumulates in
 * `oathkeeperDeferredDamage` rather than being discarded. `downed` is never
 * set while this branch is taken — the whole point. The deferred pool is
 * applied later, through this exact same function with `oathkeeperActive`
 * already cleared (see engine/mission.ts's turn-start loop), so a landing
 * hit that empties the bank can down the unit normally, same as any other
 * hit that reaches 0.
 */
export function applyMechDamage(unit: BattleUnit, dmg: number): void {
  if (dmg > 0) unit.tookDamageThisCycle = true; // Tank-shield house rule — blocks this unit's regen next tick
  let remaining = dmg;
  if (unit.shield && unit.shield > 0) {
    const absorbed = Math.min(unit.shield, remaining);
    unit.shield -= absorbed;
    remaining -= absorbed;
  }
  if (remaining <= 0) return;
  if (unit.oathkeeperActive) {
    const flooredHp = Math.max(OATHKEEPER_HP_FLOOR, unit.currentHp - remaining);
    const actualLoss = unit.currentHp - flooredHp;
    const spared = remaining - actualLoss;
    unit.currentHp = flooredHp;
    if (spared > 0) unit.oathkeeperDeferredDamage = (unit.oathkeeperDeferredDamage ?? 0) + spared;
    return; // never downs a unit under an active Oathkeeper window — by design
  }
  unit.currentHp = Math.max(0, unit.currentHp - remaining);
  if (unit.currentHp <= 0) unit.downed = true;
}

/**
 * Data Pack §8.3 — Endurance depletes first; overflow does NOT carry into
 * Vitality. Once Endurance hits zero the creature enters Collapse: any
 * single hit of at least Vitality kills it outright, a smaller hit chips
 * Vitality down instead.
 */
export function applyBloomDamage(unit: BattleUnit, dmg: number): void {
  if (unit.endurance === undefined || unit.vitality === undefined) {
    throw new Error("applyBloomDamage requires a Bloom-shape unit");
  }
  if (unit.endurance > 0) {
    unit.endurance = Math.max(0, unit.endurance - dmg);
    if (unit.endurance === 0) unit.collapsed = true;
    unit.currentHp = unit.endurance + unit.vitality;
    return; // overflow does NOT carry into vitality
  }
  if (dmg >= unit.vitality) {
    unit.vitality = 0;
    unit.downed = true;
  } else {
    unit.vitality -= dmg;
  }
  unit.currentHp = unit.endurance + unit.vitality;
}

/**
 * requiem_severance (Gjallar) versus a Bloom-shape defender — Data Pack
 * §11.5's own `vsBloom: "collapse_check"` (data/abilities.ts's SEVERANCE
 * constant) / GDD §8.2: "Bypasses Endurance entirely and applies directly
 * as a Collapse check. A creature whose Vitality is 80 or less dies
 * outright regardless of how much Endurance it had."
 *
 * Deliberately NOT applyBloomDamage just above: that function always drains
 * Endurance FIRST while it's above 0 (Data Pack §8.3's own "Endurance
 * depletes first; overflow does NOT carry into Vitality" rule) and only
 * ever touches Vitality once Endurance has already hit exactly 0 on some
 * prior hit. Requiem's whole point against Bloom is skipping that wall
 * outright — this function IS applyBloomDamage's own "already collapsed"
 * branch (`if (dmg >= vitality) { vitality = 0; downed = true } else
 * { vitality -= dmg }`), copied rather than shared (a shared helper would
 * need its own "skip the endurance branch" flag threaded through the one
 * function every other damage source relies on staying exactly as simple as
 * it is), and run UNCONDITIONALLY regardless of the unit's current
 * `endurance` value — this function never reads or writes `endurance` at
 * all. A Bloom at full Endurance and one whose Endurance already sits at 0
 * take IDENTICAL Vitality damage from the same Requiem hit, which is the
 * entire mechanic: see engine/mission.ts's own Requiem section header for
 * the worked GDD flavor ("the designed answer to... the two creatures whose
 * entire defence is an Endurance wall").
 *
 * `collapsed` is set alongside `downed` on a kill even when `endurance` was
 * still positive at the moment of the hit — applyBloomDamage's own
 * still-has-Endurance branch never sets `collapsed` itself (only depleting
 * Endurance to exactly 0 does), so a Bloom killed by Requiem without its
 * shell ever cracking would otherwise read as downed-but-not-collapsed.
 * Every existing reader of `.collapsed` (scenes/Battle.ts's hover tip,
 * sim/playerAi/combat.ts's targeting heuristic — grep-confirmed, both only
 * ever consulted on a unit that's also checked against `.downed` first)
 * only matters on a still-live unit, so setting it true here alongside
 * `downed` can't misrepresent anything.
 */
export function applyRequiemBloomDamage(unit: BattleUnit, dmg: number): void {
  if (unit.endurance === undefined || unit.vitality === undefined) {
    throw new Error("applyRequiemBloomDamage requires a Bloom-shape unit");
  }
  if (dmg >= unit.vitality) {
    unit.vitality = 0;
    unit.downed = true;
    unit.collapsed = true;
  } else {
    unit.vitality -= dmg;
  }
  unit.currentHp = unit.endurance + unit.vitality;
}

/** Mek-modified attack path attacking a Bloom defender — mirrors resolveMechAttack's shape. */
export function resolveAttackOnBloom(
  map: MapDefinition,
  attacker: BattleUnit,
  defender: BattleUnit,
  defenderSameSide: BattleUnit[],
  charged: boolean,
  // Vault Phase 2, slice 2 (3 Sep 2026) — see resolveMechAttack's identical
  // opts param for the full reasoning. Bloom never counter in this
  // direction, so there is no defenderKillsThisMission/noCounter here.
  opts?: { attackerKillsThisMission?: number }
): { damage: number } {
  if (!attacker.path) throw new Error("resolveAttackOnBloom requires a mech-shape attacker");
  const terrain = terrainStars(map, defender) + overshieldBonus(defender, defenderSameSide);
  // DESIGN GAP, flagged rather than guessed quietly: Bloom aren't in the
  // class triangle (GDD §8.2), and neither the GDD nor the Data Pack
  // specifies the formula for a *player/mech* unit attacking a Bloom
  // creature — §8.2's bloomDamage() only covers the reverse direction
  // (Bloom attacking a mech), and the sim_output.txt Collapse worked
  // examples take "attacker deals 45/hit" as a given input rather than
  // deriving it. This is a first-pass placeholder pending Maxime's call:
  // half of effectiveAttack, scaled by the same HP-wounded and terrain
  // terms the mech resolver uses, with no defender-side stat since Bloom
  // carry no `defense` field. At G tier (effectiveAttack 100) this lands
  // ~50 damage on open ground at full health, in the neighborhood of the
  // 45/hit figure the Collapse examples use, but it is NOT validated by
  // sim_output.txt the way resolveMechAttack is. Cheap to change — it's
  // isolated to this one function.
  let dmg = attacker.effectiveAttack * 0.5;
  dmg *= attackDebuffMultiplier(attacker); // Bloom on-hit effects engine — see resolveMechAttack's identical comment
  // Vault Phase 2, slice 1 (2 Sep 2026) — same two effects as
  // resolveMechAttack, both 1 (no-op) for an attacker without them. Bloom
  // carry no `defense` field at all here, so overextendedDefense's "0 DEF"
  // half never applies to a Bloom defender — not new, that gap already
  // exists in this function regardless of who's attacking.
  dmg *= saltRootMultiplier(attacker, defender.archetypeId);
  dmg *= overextendedAttackMultiplier(attacker);
  // Vault Phase 2, slice 2 (3 Sep 2026) — ledger_entry, same no-op-when-
  // inactive shape as the two multipliers just above it.
  dmg *= ledgerEntryMultiplier(attacker, opts?.attackerKillsThisMission ?? 0);
  // Vault Phase 2, slice 4 (3 Sep 2026) — cutting_room_momentum, same no-op
  // shape.
  dmg *= momentumAttackMultiplier(attacker);
  dmg *= attacker.currentHp / attacker.maxHp;
  dmg *= 1 - 0.1 * terrain;
  if (charged) dmg *= CENTAUROID_CHARGE_MULT;
  dmg = Math.round(dmg);
  return { damage: dmg };
}
