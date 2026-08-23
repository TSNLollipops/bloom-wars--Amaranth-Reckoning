// src/engine/units.ts
// Runtime unit instances + effective-stat calculation (Data Pack §5.1's
// worked example, order of application: base -> tier -> mek).
import type { Coord, MekArchetype, Path, PilotRecord, Tier } from "../data/types";
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
  // Gear-tier pass (sprites/decor, 23 Aug 2026): the raw Tier letter, kept
  // alongside the already-tier-adjusted effective* stats instead of being
  // discarded once TIERS[tier] has been baked into them. Only pilots and
  // hostile mechs carry one — createBloomUnit never sets this, since "gear
  // tier" isn't a Bloom concept and scenes/Battle.ts's pip renderer treats
  // a missing tier as "draw nothing" rather than guessing G.
  tier?: Tier;

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
  // Overwatch / reaction fire house rule (Maxime, 23 Aug 2026) — set only
  // by engine/mission.ts's enterOverwatch(), which refuses any non-player
  // unit, so this is never true on a hostile: hostile-side overwatch is
  // deliberately out of scope this pass. Cleared either by firing the held
  // shot or by the owner's next turn starting. See that file's overwatch
  // block for the full rule set, and for what else is excluded and why.
  overwatch?: boolean;

  // ---- ability-depth pass (Maxime, 23 Aug 2026), system 3 of 3 after fog
  // of war (f2e04e4) and overwatch (47ab304). Every one of these is written
  // ONLY by an engine/mission.ts verb — see that file's ability block for
  // the rules, and data/abilities.ts for the design reasoning. All optional
  // so the synthetic BattleUnit literal in
  // engine/__tests__/testHelpers.ts stays valid unchanged; the three
  // factories below still initialise abilityCooldowns explicitly.

  /**
   * Meeps abil_ambush / Munti abil_screen. This unit is not visible to the
   * opposing side at all — engine/ai.ts's isVisibleTo returns false for it
   * in exactly the same one-line way it already does for a burrowed Bloom,
   * so the hostile AI's reflexive and pack tiers cannot target it, path to
   * it, or count it as a threat. Broken the instant this unit attacks
   * (resolveAttack), and otherwise cleared at the start of its own next
   * turn, in the same loop `overwatch` clears in.
   */
  concealed?: boolean;
  /**
   * Tank abil_interdict. This unit is holding ground: any hostile that
   * FINISHES a move within INTERDICT_RADIUS of it, and that it can see,
   * loses its remaining actions. Cleared at the start of its own next turn.
   */
  braced?: boolean;
  /**
   * abilityId -> the earliest turn number that ability may be used again.
   * Absent, or a value <= the current turn, means ready. Only
   * abil_sensor_sweep uses this today; it's a map rather than a named field
   * so the next cooldown'd ability doesn't need another BattleUnit field.
   */
  abilityCooldowns?: Record<string, number>;
  /** Munti abil_screen, once per mission — deliberately mirrors usedEvacThisMission's shape rather than folding into abilityCooldowns, because "spent for good" is a different fact from "not ready yet." */
  usedScreenThisMission?: boolean;

  chargedThisMove: boolean;
  statusEffects: StatusEffect[];
  usedEvacThisMission: boolean;
  spriteKey: string;
}

function mekStatBonus(mek: MekArchetype | undefined): { attack: number; defense: number; hp: number; vision: number } {
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

/**
 * `overrides`, added for the transporter-pad squad-selection pass (22 Aug
 * 2026): when given, `overrides.pilot`/`overrides.mek` are used instead of
 * resolving through data/pilotRegistry.ts's static findPilot()/findMek().
 * This is what lets a caller (engine/mission.ts's DeployRosterEntry path)
 * deploy either a CampaignState's live, campaign-persistent pilot/mek copy
 * (tier upgrades, mek secondaries) or a generated recruit's own record —
 * neither of which the static, build-time pilotRegistry can ever resolve
 * by id (see engine/campaignState.ts's own header: "engine/units.ts's
 * createPlayerUnit() still resolves pilots through... findPilot(), which
 * has no way to see a CampaignState's generated recruits" — this closes
 * that gap). Omitting `overrides` keeps the old, registry-only behavior
 * exactly as it was, so every existing call site (tests, npm run sim, and
 * Mission's own no-override fallback) is unaffected.
 */
export function createPlayerUnit(pilotId: string, pos: Coord, overrides?: { pilot?: PilotRecord; mek?: MekArchetype }): BattleUnit {
  const pilot = overrides?.pilot ?? findPilot(pilotId);
  if (!pilot) throw new Error(`Unknown pilot id: ${pilotId}`);
  const archetype = UNIT_ARCHETYPES[pilot.archetypeId];
  if (!archetype) throw new Error(`Unknown archetype id: ${pilot.archetypeId}`);
  const tier = TIERS[pilot.tier];
  const mek = overrides?.mek ?? findMek(pilot.mekId);
  const mekBonus = mekStatBonus(mek);

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
    tier: pilot.tier,
    shield: 0,
    maxShield: 0,
    tookDamageThisCycle: false,
    downed: false,
    actionsRemaining: MAX_ACTIONS_PER_TURN,
    chargedThisMove: false,
    statusEffects: [],
    abilityCooldowns: {},
    usedEvacThisMission: false,
    usedScreenThisMission: false,
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
    tier: mech.tier,
    shield: 0,
    maxShield: 0,
    tookDamageThisCycle: false,
    downed: false,
    actionsRemaining: MAX_ACTIONS_PER_TURN,
    chargedThisMove: false,
    statusEffects: [],
    abilityCooldowns: {},
    usedEvacThisMission: false,
    usedScreenThisMission: false,
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
    abilityCooldowns: {},
    usedEvacThisMission: false,
    usedScreenThisMission: false,
    spriteKey: arch.spriteKey,
  };
}
