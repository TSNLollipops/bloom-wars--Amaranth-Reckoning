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
// SUPPORT branch (this file's munti_rapid_response) is new.
import type { Path } from "./types";

export type WeaponBranchId =
  | "meeps_impact_lance"
  | "tank_grinder_claw"
  | "reeps_missiles"
  | "reeps_rail_lance"
  | "munti_rapid_response";

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
};

/** Every branch currently buildable for a given class, in unlock order (index 0 = 1st branch a pilot of this path can buy). Deliberately short — this pass ships ONE branch per path; Shock Claws/Riot Drum/Maser Lance/Suppression Autocannon/Combat Medic/Aegis Ward/Field Doctor all wait on a status-effect pass (see the source doc's own §5/§10 Tier-3 split) and are not listed here so the shop never offers something the engine can't back yet. Reeps gets two (Missiles, then Rail Lance) since both are numbers-only and this exercises the real "collect more than one, swap for free" mechanic end to end. */
export const WEAPON_BRANCHES_BY_PATH: Record<Path, WeaponBranchId[]> = {
  meeps: ["meeps_impact_lance"],
  tank: ["tank_grinder_claw"],
  reeps: ["reeps_missiles", "reeps_rail_lance"],
  munti: ["munti_rapid_response"],
};
