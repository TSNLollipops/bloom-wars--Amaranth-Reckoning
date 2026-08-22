// src/engine/units.ts
// Runtime unit instances + effective-stat calculation (Data Pack §5.1's
// worked example, order of application: base -> tier -> mek).
import type { Coord, Path } from "../data/types";
import { UNIT_ARCHETYPES, HOSTILE_MECHS } from "../data/units";
import { MEK_TRACK_EFFECTS } from "../data/meks";
import { findPilot, findMek } from "../data/pilotRegistry";
import { BLOOM } from "../data/bloom";
import { TIERS, MAX_ACTIONS_PER_TURN } from "../data/combatTables";

export type BattleUnitKind = "pilot" | "mech" | "bloom";
export type Side = "player" | "hostile";

export interface StatusEffect {
  kind: "acid_dot" | "debuff_attack";
  turnsRemaining: number;
  magnitude: number;
}

export interface BattleUnit {
  instanceId: string;
  side: Side;
  kind: BattleUnitKind;
  archetypeId: string; // UnitArchetype id (pilot/mech) or BloomArchetype id
  pilotId?: string; // pilot only — links back to the campaign roster
  displayName: string;
  pos: Coord;

  // mech-shape (pilot | mech)
  path?: Path;
  currentHp: number;
  maxHp: number;
  effectiveAttack: number;
  effectiveDefense: number;
  moveRange: number;
  attackRange: [number, number];
  vision: number;
  canCounter: boolean;
  counterMaxRange: number;
  abilities: string[];
  chassis?: "bipedal" | "centauroid" | "bipedal_vibrissal";

  // bloom-shape
  endurance?: number;
  maxEndurance?: number;
  vitality?: number;
  collapsed?: boolean;
  attackPower?: number;
  burrowed?: boolean;
  revealedUntilTurn?: number;

  // Tank shield house rule (data/combatTables.ts TANK_SHIELD_CAPACITY) —
  // mech-shape units only; left undefined/0 on Bloom-shape units.
  shield?: number;
  maxShield?: number;
  tookDamageThisCycle?: boolean;

  // shared turn state
  downed: boolean;
  // Two-action-per-turn house rule (data/combatTables.ts
  // MAX_ACTIONS_PER_TURN, Maxime, 22 Aug 2026), replacing the old
  // movedThisTurn/actedThisTurn booleans. Move and Repair cost 1 and don't
  // end the turn; Attack zeroes this out entirely regardless of value.
  actionsRemaining: number;
  chargedThisMove: boolean;
  statusEffects: StatusEffect[];
  usedEvacThisMission: boolean;
  spriteKey: string;
}

function mekStatBonus(mekId: string): { attack: number; defense: number; hp: number; vision: number } {
  const mek = findMek(mekId);
  if (!mek) return { attack: 0, defense: 0, hp: 0, vision: 0 };
  const out = { attack: 0, defense: 0, hp: 0, vision: 0 };
  const apply = (track: string, isPrimary: boolean) => {
    const eff = (MEK_TRACK_EFFECTS as unknown as Record<string, { primary?: Record<string, number | boolean>; secondary?: Record<string, number | boolean> }>)[track];
    if (!eff) return;
    const slice = isPrimary ? eff.primary : eff.secondary;
    if (!slice) return;
    out.attack += Number(slice.attack ?? 0);
    out.defense += Number(slice.defense ?? 0);
    out.hp += Number(slice.hp ?? 0);
    out.vision += Number(slice.vision ?? 0);
  };
  apply(mek.primary, true);
  if (mek.secondary) apply(mek.secondary, false);
  return out;
}

let instanceCounter = 0;
function nextInstanceId(prefix: string): string {
  instanceCounter += 1;
  return `${prefix}_${instanceCounter}`;
}

export function createPlayerUnit(pilotId: string, pos: Coord): BattleUnit {
  const pilot = findPilot(pilotId);
  if (!pilot) throw new Error(`Unknown pilot id: ${pilotId}`);
  const archetype = UNIT_ARCHETYPES[pilot.archetypeId];
  if (!archetype) throw new Error(`Unknown archetype id: ${pilot.archetypeId}`);
  const tier = TIERS[pilot.tier];
  const mekBonus = mekStatBonus(pilot.mekId);

  const effectiveAttack = archetype.baseAttack + (tier.attack - 100) + mekBonus.attack;
  const effectiveDefense = archetype.baseDefense + (tier.defense - 100) + mekBonus.defense;
  const maxHp = archetype.baseHp + (tier.hp - 100) + mekBonus.hp;
  const vision = archetype.vision + mekBonus.vision;
  const moveRange = archetype.moveRange + tier.move;

  return {
    instanceId: pilot.id, // pilots keep their stable roster id on the board
    side: "player",
    kind: "pilot",
    archetypeId: archetype.id,
    pilotId: pilot.id,
    displayName: pilot.displayName,
    pos,
    path: archetype.path,
    currentHp: maxHp,
    maxHp,
    effectiveAttack,
    effectiveDefense,
    moveRange,
    attackRange: archetype.attackRange,
    vision,
    canCounter: archetype.canCounter,
    counterMaxRange: archetype.counterMaxRange,
    abilities: archetype.abilities,
    chassis: archetype.chassis,
    shield: 0,
    maxShield: 0,
    tookDamageThisCycle: false,
    downed: false,
    actionsRemaining: MAX_ACTIONS_PER_TURN,
    chargedThisMove: false,
    statusEffects: [],
    usedEvacThisMission: false,
    spriteKey: archetype.spriteKey,
  };
}

export function createHostileMechUnit(hostileMechId: string, pos: Coord): BattleUnit {
  const mech = HOSTILE_MECHS[hostileMechId];
  if (!mech) throw new Error(`Unknown hostile mech id: ${hostileMechId}`);
  // "All four use the standard bipedal archetypes" — Data Pack §9.
  const archetypeId = `arch_${mech.path}_bipedal`;
  const archetype = UNIT_ARCHETYPES[archetypeId];
  const tier = TIERS[mech.tier];

  const effectiveAttack = archetype.baseAttack + (tier.attack - 100);
  const effectiveDefense = archetype.baseDefense + (tier.defense - 100);
  const maxHp = archetype.baseHp + (tier.hp - 100);

  return {
    instanceId: nextInstanceId(hostileMechId),
    side: "hostile",
    kind: "mech",
    archetypeId,
    displayName: mech.displayName, // "Unmarked Mech" — GDD §10.1 quiet-critique discipline
    pos,
    path: archetype.path,
    currentHp: maxHp,
    maxHp,
    effectiveAttack,
    effectiveDefense,
    moveRange: archetype.moveRange + tier.move,
    attackRange: archetype.attackRange,
    vision: archetype.vision,
    canCounter: archetype.canCounter,
    counterMaxRange: archetype.counterMaxRange,
    abilities: archetype.abilities,
    chassis: archetype.chassis,
    shield: 0,
    maxShield: 0,
    tookDamageThisCycle: false,
    downed: false,
    actionsRemaining: MAX_ACTIONS_PER_TURN,
    chargedThisMove: false,
    statusEffects: [],
    usedEvacThisMission: false,
    spriteKey: archetype.spriteKey,
  };
}

export function createBloomUnit(bloomArchetypeId: string, pos: Coord, opts?: { burrowed?: boolean }): BattleUnit {
  const arch = BLOOM[bloomArchetypeId];
  if (!arch) throw new Error(`Unknown Bloom archetype id: ${bloomArchetypeId}`);
  return {
    instanceId: nextInstanceId(bloomArchetypeId),
    side: "hostile",
    kind: "bloom",
    archetypeId: arch.id,
    displayName: arch.displayName,
    pos,
    currentHp: arch.endurance + arch.vitality,
    maxHp: arch.endurance + arch.vitality,
    effectiveAttack: 0,
    effectiveDefense: 100,
    moveRange: arch.moveRange,
    attackRange: arch.attackRange,
    vision: arch.vision,
    canCounter: false,
    counterMaxRange: 0,
    abilities: [],
    endurance: arch.endurance,
    maxEndurance: arch.endurance,
    vitality: arch.vitality,
    collapsed: arch.endurance === 0,
    attackPower: arch.attackPower,
    burrowed: !!opts?.burrowed,
    downed: false,
    actionsRemaining: MAX_ACTIONS_PER_TURN,
    chargedThisMove: false,
    statusEffects: [],
    usedEvacThisMission: false,
    spriteKey: arch.spriteKey,
  };
}
