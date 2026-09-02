// src/data/weaponBranches.ts
// Weapon Branch Point System (claude/Bloom_Wars_Weapon_Branch_Point_System_v1.md,
// decided 27 Aug 2026) — the fourth purchasable category GDD §6.4 needs
// updating for. Built 27 Aug 2026, first pass: NUMBERS-ONLY branches per
// Maxime's own scoping call ("your call. but anything we start we gotta
// finish today") — one flagship branch per class, each a real stat/
// targeting change with zero new status-effect infrastructure (no stun,
// no knockback, no DoT, no attack-debuff — those wait for a dedicated
// status-effect pass, same Tier-3 split the design doc itself calls out).
//
// That status-effect pass exists now (engine/turnManager.ts, 27 Aug 2026)
// — BattleUnit.statusEffects, acid_dot/debuff_attack ticking, and the
// knockback resolver are all real, generic infrastructure, not Bloom-
// specific. No weapon branch here uses any of it yet; this note is just
// the pointer for whenever a future Tier-3 branch wants stun/knockback/
// DoT/attack-debuff on the player side — the plumbing to reuse is already
// built, not a new system to design from scratch.
//
// Shape, per the doc's own §3/§9: cost and tier-gate depend on PURCHASE
// ORDER (1st/2nd/3rd/4th branch a pilot ever buys), not on which specific
// branch — so WEAPON_BRANCH_COSTS/WEAPON_BRANCH_TIER_GATE are indexed by
// "how many branches this pilot already owns," looked up the same way
// regardless of path. Personal pool, permanent once bought, one equipped
// at a time (Option B, decided in the source doc) — engine/campaignState.ts's
// PilotRecord carries `ownedWeaponBranches`/`equippedWeaponBranch`.
//
// Every default weapon (Twinblades/Slam Cannon/Marksman Rifle/Reclaimer
// Beam) needs NO entry here — it's just "no branch equipped," the
// pilot's plain archetype stats, unchanged. Reclaimer Beam specifically
// is Munti's baseline weapon per the Mek Workshop doc's own §3 ("same
// tech as Repair, aimed at a hostile instead") — Munti's `POWER["munti"]`
// row already exists and already lets a Munti attack normally, so there
// is nothing to build for the default weapon itself; only Munti's
// SUPPORT branches (this file's munti_rapid_response/munti_aegis_ward)
// are new.
//
// Aegis Ward added 1 Sep 2026 — claude/Bloom_Wars_Weapon_Branch_Expansion_
// Plan_v1.md's own "cheap — numbers/economy only" bucket, task-list item
// #3. Munti already has the passive AoE regen aura (engine/mission.ts's
// tickMuntiRegen, MUNTI_REGEN_RADIUS in data/combatTables.ts); this branch
// just scales that existing radius for whichever Munti has it equipped,
// same shape as Rapid Response scaling repair range — zero new engine
// surface, exactly as the plan doc predicted for this one.
//
// Field Doctor added the same day, in a second pass — the plan doc's own
// framing ("cheaper Repair, or an extra Repair charge per mission") didn't
// survive contact with the live engine/mission.ts's repairUnit(): Repair
// has no cost and no per-mission charge cap to begin with (flat 1-of-2-
// actions, unlimited uses), so there was nothing to make cheaper and no
// existing charge budget to extend. Raised to Maxime directly; his call —
// "Free Repair every N turns," the option framed as the closer literal
// match to the plan's own "same shape as Weapons Bay's bonus Fire Support
// charge" comparison (that charge is itself cooldown-gated, not a flat
// one-off add-on). Built on `BattleUnit.abilityCooldowns` — real, typed,
// initialized on every unit since 28 Aug 2026, but per engine/cooldown.ts's
// own header comment, never actually written to by any ability until this
// one. See FIELD_DOCTOR_COOLDOWN_TURNS below and repairUnit()'s own
// comment in engine/mission.ts for the mechanism.
import type { Path } from "./types";
import { MUNTI_REGEN_RADIUS } from "./combatTables";

export type WeaponBranchId =
  | "meeps_impact_lance"
  | "tank_grinder_claw"
  | "reeps_missiles"
  | "reeps_rail_lance"
  | "munti_rapid_response"
  | "munti_aegis_ward"
  | "munti_field_doctor";

export interface WeaponBranchDef {
  id: WeaponBranchId;
  displayName: string;
  path: Path;
  description: string;
}

// Doc §3's own numbers, transcribed, still placeholders pending a real
// economy sim harness (flagged in both source docs — nothing here has
// been through combat_sim.py or an equivalent).
export const WEAPON_BRANCH_COSTS: readonly number[] = [150, 220, 300, 400];
export const WEAPON_BRANCH_TIER_GATE: readonly ("D" | "C" | "B" | "A")[] = ["D", "C", "B", "A"];

// ---- the five branches this pass actually builds ------------------------

/** Meeps — a single heavier committed strike, no dodge-adjacent bonus (the "trust the hit, not the footwork" alternative to Twinblades). */
export const IMPACT_LANCE_ATK_BONUS = 15;

/** Tank — melee plus self-heal on a successful hit. A fraction of damage DEALT, not received; only fires when the hit actually lands (a dodge or a miss heals nothing). */
export const GRINDER_CLAW_HEAL_PCT = 0.2;

/** Reeps — grants abil_missile (engine/mission.ts, built 26 Aug 2026, previously attached to zero archetypes — see claude/Bloom_Wars_Missile_Weapon_Live_Test_v1.md for the live-engine test this branch is built from). No new numbers here; the ability's own MISSILE_SPLASH_RADIUS/MISSILE_CHARGES_PER_MISSION (data/combatTables.ts) are unchanged. */
export const MISSILE_GRANT_ABILITY = "abil_missile";

/** Reeps — armor-piercing. Ignores a fraction of the DEFENDER's effective defense, but ONLY against a Tank-path defender (data/types.ts Path) — sharpens Reeps-beats-Tank rather than a flat damage buff that would blur the triangle. */
export const RAIL_LANCE_DEF_IGNORE_PCT = 0.25;

/** Base Repair range, every Munti, 28 Aug 2026 — raised from the original 1 tile (adjacent only) to 3, per Maxime's "give more range to munty heal" -> "Base range, everyone (1->3)" call. engine/mission.ts's getRepairableFrom() and sim/playerAi/support.ts's own repair-target search both used to hardcode the old adjacent-only distance regardless of this constant — that was the real bug, fixed alongside this change so both actually read it. */
export const DEFAULT_REPAIR_RANGE = 3;
/** Munti Support Branch — one further tile beyond the base range above, not a fixed absolute number, so raising the base later keeps this branch meaningfully better rather than converging with it. */
export const RAPID_RESPONSE_REPAIR_RANGE = DEFAULT_REPAIR_RANGE + 1;

/** Munti Support Branch — Aegis Ward, 1 Sep 2026. One tile further than the baseline MUNTI_REGEN_RADIUS (data/combatTables.ts), same "+1, not a fixed absolute number" convention as RAPID_RESPONSE_REPAIR_RANGE above, for the same reason — if the baseline aura radius is ever raised later, this branch stays meaningfully better rather than converging with it. Applied per-Munti in engine/mission.ts's tickMuntiRegen(): only the Munti who actually owns and has equipped this branch projects the wider aura; a squad's other Muntis (if any) still use the plain MUNTI_REGEN_RADIUS. */
export const AEGIS_WARD_REGEN_RADIUS = MUNTI_REGEN_RADIUS + 1;

/** Munti Support Branch — Field Doctor, 1 Sep 2026, Maxime's own pick ("Free Repair every N turns"). Same value as WEAPONS_BAY_FIRE_SUPPORT_COOLDOWN_TURNS (data/combatTables.ts) — deliberately matching the plan doc's own "same shape as Weapons Bay's bonus Fire Support charge" comparison exactly rather than picking an unrelated number. Placeholder, not run through combat_sim.py or an equivalent — same status as every other weapon-branch number in this file, worth a real playtest pass once there's a Munti actually carrying it in a run. */
export const FIELD_DOCTOR_COOLDOWN_TURNS = 3;

export const WEAPON_BRANCHES: Record<WeaponBranchId, WeaponBranchDef> = {
  meeps_impact_lance: {
    id: "meeps_impact_lance",
    displayName: "Impact Lance",
    path: "meeps",
    description: `A single heavier strike (+${IMPACT_LANCE_ATK_BONUS} ATK). No dodge-adjacent bonus — the committed alternative to Twinblades.`,
  },
  tank_grinder_claw: {
    id: "tank_grinder_claw",
    displayName: "Grinder Claw",
    path: "tank",
    description: `Melee plus self-heal on hit (${Math.round(GRINDER_CLAW_HEAL_PCT * 100)}% of damage dealt).`,
  },
  reeps_missiles: {
    id: "reeps_missiles",
    displayName: "Missiles",
    path: "reeps",
    description: "Splash-damage ordnance, friendly-fire capable, 2 charges/mission. Ends your turn.",
  },
  reeps_rail_lance: {
    id: "reeps_rail_lance",
    displayName: "Rail Lance",
    path: "reeps",
    description: `Armor-piercing — ignores ${Math.round(RAIL_LANCE_DEF_IGNORE_PCT * 100)}% of a Tank-path target's defense.`,
  },
  munti_rapid_response: {
    id: "munti_rapid_response",
    displayName: "Rapid Response",
    path: "munti",
    description: `Repair range extends to ${RAPID_RESPONSE_REPAIR_RANGE} tiles (was ${DEFAULT_REPAIR_RANGE}).`,
  },
  munti_aegis_ward: {
    id: "munti_aegis_ward",
    displayName: "Aegis Ward",
    path: "munti",
    description: `Passive regen aura radius extends to ${AEGIS_WARD_REGEN_RADIUS} tiles (was ${MUNTI_REGEN_RADIUS}).`,
  },
  munti_field_doctor: {
    id: "munti_field_doctor",
    displayName: "Field Doctor",
    path: "munti",
    description: `Repair is free (costs 0 actions) once every ${FIELD_DOCTOR_COOLDOWN_TURNS} turns.`,
  },
};

/** Every branch currently buildable for a given class, in unlock order (index 0 = 1st branch a pilot of this path can buy). Shock Claws/Riot Drum/Maser Lance/Suppression Autocannon/Combat Medic all still wait on a status-effect pass (see the source doc's own §5/§10 Tier-3 split) and are not listed here so the shop never offers something the engine can't back yet. Reeps gets two (Missiles, then Rail Lance) since both are numbers-only and this exercises the real "collect more than one, swap for free" mechanic end to end; Munti now gets three for the same reason (Rapid Response, Aegis Ward, Field Doctor). */
export const WEAPON_BRANCHES_BY_PATH: Record<Path, WeaponBranchId[]> = {
  meeps: ["meeps_impact_lance"],
  tank: ["tank_grinder_claw"],
  reeps: ["reeps_missiles", "reeps_rail_lance"],
  munti: ["munti_rapid_response", "munti_aegis_ward", "munti_field_doctor"],
};
