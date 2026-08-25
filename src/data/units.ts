// src/data/units.ts
// Transcribed from Data Pack §3 (12 player archetypes) and §9 (4 hostile
// mechs). All values are G tier; tier modifiers (units.ts consumers via
// engine/combat.ts + TIERS in combat.ts) are applied at runtime, never
// baked into these rows.
//
// Ability-depth pass (23 Aug 2026, data/abilities.ts's own header): each
// path picks up exactly one new verb, added to the `abilities` array of
// every archetype on that path and nowhere else, so the new options track
// the class triangle instead of blurring it —
//   meeps -> abil_ambush     (go unseen, hold a melee shot)
//   tank  -> abil_interdict  (pin what walks into your ring)
//   munti -> abil_screen     (conceal the huddle, once per mission)
// abil_sensor_sweep is the fourth, and is NOT added anywhere: it was
// already on all three vibrissal archetypes and stays a chassis ability
// rather than a path one, exactly as it was written. It is the Reeps' new
// verb in practice — Cpl. Anand (arch_reeps_vibrissal) is the only pilot
// in either campaign roster who carries it — it just isn't the Reeps' by
// data. This pass implements it; it had a definition and no code before.
//
// Mission-3 "clean the bloom patch" pass (23 Aug 2026, data/abilities.ts's
// own abil_clear_bloom comment): Munti breaks the "exactly one new verb per
// path" framing above and picks up a second — abil_clear_bloom, on all
// three Munti archetypes. Deliberate, not a drift: the ability is tied to
// one specific mission's objective rather than the class-triangle-wide
// turn-economy verbs above, so it didn't belong in that first list, but
// it's still a Munti-path ability by the same "matches the archetype's job"
// logic that put abil_repair/abil_cockpit_evac there originally.
import type { UnitArchetype, HostileMechArchetype } from "./types";

export const UNIT_ARCHETYPES: Record<string, UnitArchetype> = {
  arch_meeps_bipedal: {
    id: "arch_meeps_bipedal",
    displayName: "Meeps — Bipedal",
    path: "meeps",
    species: "human",
    chassis: "bipedal",
    baseHp: 105,
    moveRange: 6,
    attackRange: [1, 1],
    baseAttack: 100,
    baseDefense: 100,
    vision: 4,
    canCounter: true,
    counterMaxRange: 1,
    abilities: ["abil_ambush"],
    spriteKey: "shape_triangle_solid",
  },
  arch_meeps_centauroid: {
    id: "arch_meeps_centauroid",
    displayName: "Meeps — Centauroid",
    path: "meeps",
    species: "hiopi",
    chassis: "centauroid",
    baseHp: 100,
    moveRange: 6,
    attackRange: [1, 1],
    baseAttack: 100,
    baseDefense: 100,
    vision: 4,
    canCounter: true,
    counterMaxRange: 1,
    abilities: ["abil_charge", "abil_ambush"],
    spriteKey: "shape_triangle_double",
  },
  arch_meeps_vibrissal: {
    id: "arch_meeps_vibrissal",
    displayName: "Meeps — Vibrissal",
    path: "meeps",
    species: "osnius",
    chassis: "bipedal_vibrissal",
    baseHp: 100,
    moveRange: 6,
    attackRange: [1, 1],
    baseAttack: 100,
    baseDefense: 100,
    vision: 6,
    canCounter: true,
    counterMaxRange: 1,
    abilities: ["abil_sensor_sweep", "abil_ambush"],
    spriteKey: "shape_triangle_whisker",
  },

  arch_tank_bipedal: {
    id: "arch_tank_bipedal",
    displayName: "Tank — Bipedal",
    path: "tank",
    species: "human",
    chassis: "bipedal",
    baseHp: 105,
    moveRange: 3,
    attackRange: [1, 1],
    baseAttack: 100,
    baseDefense: 100,
    vision: 3,
    canCounter: true,
    counterMaxRange: 1,
    abilities: ["abil_overshield", "abil_interdict"],
    spriteKey: "shape_square_solid",
  },
  arch_tank_centauroid: {
    id: "arch_tank_centauroid",
    displayName: "Tank — Centauroid",
    path: "tank",
    species: "hiopi",
    chassis: "centauroid",
    baseHp: 100,
    moveRange: 3,
    attackRange: [1, 1],
    baseAttack: 100,
    baseDefense: 100,
    vision: 3,
    canCounter: true,
    counterMaxRange: 1,
    abilities: ["abil_overshield", "abil_charge", "abil_interdict"],
    spriteKey: "shape_square_double",
  },
  arch_tank_vibrissal: {
    id: "arch_tank_vibrissal",
    displayName: "Tank — Vibrissal",
    path: "tank",
    species: "osnius",
    chassis: "bipedal_vibrissal",
    baseHp: 100,
    moveRange: 3,
    attackRange: [1, 1],
    baseAttack: 100,
    baseDefense: 100,
    vision: 5,
    canCounter: true,
    counterMaxRange: 1,
    abilities: ["abil_overshield", "abil_sensor_sweep", "abil_interdict"],
    spriteKey: "shape_square_whisker",
  },

  arch_reeps_bipedal: {
    id: "arch_reeps_bipedal",
    displayName: "Reeps — Bipedal",
    path: "reeps",
    species: "human",
    chassis: "bipedal",
    baseHp: 105,
    moveRange: 4,
    attackRange: [2, 4],
    baseAttack: 100,
    baseDefense: 100,
    vision: 5,
    canCounter: false,
    counterMaxRange: 0,
    abilities: [],
    spriteKey: "shape_diamond_solid",
  },
  arch_reeps_centauroid: {
    id: "arch_reeps_centauroid",
    displayName: "Reeps — Centauroid",
    path: "reeps",
    species: "hiopi",
    chassis: "centauroid",
    baseHp: 100,
    moveRange: 4,
    attackRange: [2, 4],
    baseAttack: 100,
    baseDefense: 100,
    vision: 5,
    canCounter: false,
    counterMaxRange: 0,
    abilities: ["abil_charge"],
    spriteKey: "shape_diamond_double",
  },
  arch_reeps_vibrissal: {
    id: "arch_reeps_vibrissal",
    displayName: "Reeps — Vibrissal",
    path: "reeps",
    species: "osnius",
    chassis: "bipedal_vibrissal",
    baseHp: 100,
    moveRange: 4,
    attackRange: [2, 4],
    baseAttack: 100,
    baseDefense: 100,
    vision: 7,
    canCounter: false,
    counterMaxRange: 0,
    abilities: ["abil_sensor_sweep"],
    spriteKey: "shape_diamond_whisker",
  },

  arch_munti_bipedal: {
    id: "arch_munti_bipedal",
    displayName: "Munti — Bipedal",
    path: "munti",
    species: "human",
    chassis: "bipedal",
    baseHp: 105,
    moveRange: 5,
    attackRange: [1, 2],
    baseAttack: 100,
    baseDefense: 100,
    vision: 4,
    canCounter: true, // Y* — counters at range 1 only; see counterMaxRange, NOT attackRange
    counterMaxRange: 1,
    abilities: ["abil_repair", "abil_cockpit_evac", "abil_screen", "abil_clear_bloom"],
    spriteKey: "shape_circlebar_solid",
  },
  arch_munti_centauroid: {
    id: "arch_munti_centauroid",
    displayName: "Munti — Centauroid",
    path: "munti",
    species: "hiopi",
    chassis: "centauroid",
    baseHp: 100,
    moveRange: 5,
    attackRange: [1, 2],
    baseAttack: 100,
    baseDefense: 100,
    vision: 4,
    canCounter: true,
    counterMaxRange: 1,
    abilities: ["abil_repair", "abil_cockpit_evac", "abil_charge", "abil_screen", "abil_clear_bloom"],
    spriteKey: "shape_circlebar_double",
  },
  arch_munti_vibrissal: {
    id: "arch_munti_vibrissal",
    displayName: "Munti — Vibrissal",
    path: "munti",
    species: "osnius",
    chassis: "bipedal_vibrissal",
    baseHp: 100,
    moveRange: 5,
    attackRange: [1, 2],
    baseAttack: 100,
    baseDefense: 100,
    vision: 6,
    canCounter: true,
    counterMaxRange: 1,
    abilities: ["abil_repair", "abil_cockpit_evac", "abil_sensor_sweep", "abil_screen", "abil_clear_bloom"],
    spriteKey: "shape_circlebar_whisker",
  },
};

// Data Pack §9. GDD §10.1's "quiet-critique discipline": the game never
// explains who these are, anywhere — not in a briefing, a debrief, a unit
// name, a tooltip, or a log line. They are "Unmarked Mech" and that is all
// the text that exists. Do not add a comment here explaining why either —
// that reasoning lives in the design docs, not the codebase.
export const HOSTILE_MECHS: Record<string, HostileMechArchetype> = {
  hostile_mech_01: {
    id: "hostile_mech_01",
    displayName: "Unmarked Mech",
    path: "tank",
    tier: "G",
    spawnAt: { x: 9, y: 7 },
  },
  hostile_mech_02: {
    id: "hostile_mech_02",
    displayName: "Unmarked Mech",
    path: "meeps",
    tier: "G",
    spawnAt: { x: 10, y: 7 },
  },
  hostile_mech_03: {
    id: "hostile_mech_03",
    displayName: "Unmarked Mech",
    path: "meeps",
    tier: "G",
    spawnAt: { x: 9, y: 8 },
  },
  hostile_mech_04: {
    id: "hostile_mech_04",
    displayName: "Unmarked Mech",
    path: "reeps",
    tier: "G",
    spawnAt: { x: 11, y: 8 },
  },
};

// Amaranth Act I, Mission 6 ("House Colors") — the opposite of §10.1's
// discipline above, deliberately: this checkpoint dispute is the mission's
// whole point, so the game names exactly who these are rather than
// withholding it. Not Bloom, not ambiguous — a House Amaranth line
// detachment, first time Warden Company fights something other than the
// Bloom. `spawnAt` here is the same effectively-unused per-archetype
// default as the block above (real mission spawning always goes through
// the wave's own spawnAt/enemy_deploy resolution in engine/mission.ts) —
// kept only because HostileMechArchetype requires it.
export const AMARANTH_HOSTILE_MECHS: Record<string, HostileMechArchetype> = {
  hostile_mech_amaranth_01: {
    id: "hostile_mech_amaranth_01",
    displayName: "House Amaranth Line Trooper",
    path: "tank",
    tier: "G",
    spawnAt: { x: 15, y: 4 },
  },
  hostile_mech_amaranth_02: {
    id: "hostile_mech_amaranth_02",
    displayName: "House Amaranth Line Trooper",
    path: "meeps",
    tier: "G",
    spawnAt: { x: 15, y: 7 },
  },
  hostile_mech_amaranth_03: {
    id: "hostile_mech_amaranth_03",
    displayName: "House Amaranth Line Trooper",
    path: "meeps",
    tier: "G",
    spawnAt: { x: 17, y: 5 },
  },
  hostile_mech_amaranth_04: {
    id: "hostile_mech_amaranth_04",
    displayName: "House Amaranth Line Trooper",
    path: "reeps",
    tier: "G",
    spawnAt: { x: 17, y: 6 },
  },
};

// Amaranth Act II, Mission 16 ("Collaborators," 25 Aug 2026) — House
// Amaranth conscripts, not the Line Troopers above. Same "named on purpose"
// discipline as AMARANTH_HOSTILE_MECHS' own comment (the opposite of Team
// One's Unmarked Mechs), but a deliberately different displayName from
// "House Amaranth Line Trooper" — the campaign doc's own moral-complexity
// flag for this mission (Appendix, and claude/Bloom_Wars_Spitball_Ideas.md's
// note tying it to the recurring House Amaranth thread) reads differently
// if the game calls them by the same name as Mission 6's professional
// detachment. These are conscripts: forced levies, not volunteers — the
// fight is exactly as lethal, but who's on the other end of it isn't the
// same, and the name is the only lever this pass has to say so without
// writing a dialogue system. Tier kept at "G", matching every other hostile
// mech archetype in this file — no combat data exists yet for a
// conscript-vs-veteran stat split, and inventing one here would be a
// balance claim this pass has no evidence for. One per path, same 4-unit
// shape as Mission 6's own line detachment.
export const AMARANTH_CONSCRIPT_MECHS: Record<string, HostileMechArchetype> = {
  hostile_mech_amaranth_conscript_01: {
    id: "hostile_mech_amaranth_conscript_01",
    displayName: "House Amaranth Conscript",
    path: "tank",
    tier: "G",
    spawnAt: { x: 22, y: 3 },
  },
  hostile_mech_amaranth_conscript_02: {
    id: "hostile_mech_amaranth_conscript_02",
    displayName: "House Amaranth Conscript",
    path: "meeps",
    tier: "G",
    spawnAt: { x: 22, y: 6 },
  },
  hostile_mech_amaranth_conscript_03: {
    id: "hostile_mech_amaranth_conscript_03",
    displayName: "House Amaranth Conscript",
    path: "meeps",
    tier: "G",
    spawnAt: { x: 22, y: 7 },
  },
  hostile_mech_amaranth_conscript_04: {
    id: "hostile_mech_amaranth_conscript_04",
    displayName: "House Amaranth Conscript",
    path: "reeps",
    tier: "G",
    spawnAt: { x: 22, y: 10 },
  },
};

// Merged lookup table, same shape as pilotRegistry.ts's reason for
// existing: engine/units.ts's createHostileMechUnit needs to resolve IDs
// from both blocks above by id alone, and without this merge a second
// hostile-mech source would silently fail to resolve on the battlefield —
// exactly the pilot-lookup gap the Amaranth roster hit first (see
// campaignAmaranth.ts's own file header / the build log).
export const ALL_HOSTILE_MECHS: Record<string, HostileMechArchetype> = {
  ...HOSTILE_MECHS,
  ...AMARANTH_HOSTILE_MECHS,
  ...AMARANTH_CONSCRIPT_MECHS,
};
