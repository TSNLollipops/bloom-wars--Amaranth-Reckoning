// src/engine/combat.ts
// The combat resolver, transcribed from Data Pack §7.4 (mech/pilot vs
// mech/pilot) and §8.2/§8.3 (Bloom Endurance/Vitality Collapse). Every
// number here must reproduce sim_output.txt exactly — see src/sim/tests.
import type { MapDefinition } from "../data/types";
import { POWER, FULL_HP_DAMAGE_CAP, CENTAUROID_CHARGE_MULT } from "../data/combatTables";
import { TILES } from "../data/tiles";
import { chebyshevDistance, tileAt } from "./grid";
import type { BattleUnit } from "./units";
import { UNDERTOW_SURFACE_DAMAGE_MULT } from "../data/bloom";

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
  attackerDodgedCounter = false
): AttackResult {
  if (!attacker.path || !defender.path) {
    throw new Error("resolveMechAttack requires mech-shape units (with a Path)");
  }
  const terrain = terrainStars(map, defender) + overshieldBonus(defender, defenderSameSide);
  let dmg = POWER[attacker.path][defender.path];
  dmg *= attacker.currentHp / attacker.maxHp;
  dmg *= attacker.effectiveAttack / 100;
  dmg *= 100 / defender.effectiveDefense;
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
  // why a Munti with a 2-tile attack still only counters at 1.
  if (!defenderDowned && defender.canCounter && chebyshevDistance(defender.pos, attacker.pos) <= defender.counterMaxRange) {
    // The counter runs the IDENTICAL formula, cap included — the
    // attacker is usually at full HP when countered, so exempting the
    // counter from the cap would quietly make counterattacks the second
    // thing in the game that can delete a full-HP unit. Severance is
    // meant to be the only one.
    const counterTerrain = terrainStars(map, attacker) + overshieldBonus(attacker, attackerSameSide);
    let counterDmg = POWER[defender.path][attacker.path];
    counterDmg *= defenderHpAfter / defender.maxHp;
    counterDmg *= defender.effectiveAttack / 100;
    counterDmg *= 100 / attacker.effectiveDefense;
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

export function applyMechDamage(unit: BattleUnit, dmg: number): void {
  if (dmg > 0) unit.tookDamageThisCycle = true; // Tank-shield house rule — blocks this unit's regen next tick
  let remaining = dmg;
  if (unit.shield && unit.shield > 0) {
    const absorbed = Math.min(unit.shield, remaining);
    unit.shield -= absorbed;
    remaining -= absorbed;
  }
  if (remaining > 0) {
    unit.currentHp = Math.max(0, unit.currentHp - remaining);
    if (unit.currentHp <= 0) unit.downed = true;
  }
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

/** Mek-modified attack path attacking a Bloom defender — mirrors resolveMechAttack's shape. */
export function resolveAttackOnBloom(
  map: MapDefinition,
  attacker: BattleUnit,
  defender: BattleUnit,
  defenderSameSide: BattleUnit[],
  charged: boolean
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
  dmg *= attacker.currentHp / attacker.maxHp;
  dmg *= 1 - 0.1 * terrain;
  if (charged) dmg *= CENTAUROID_CHARGE_MULT;
  dmg = Math.round(dmg);
  return { damage: dmg };
}
