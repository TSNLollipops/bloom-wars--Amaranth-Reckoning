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
// specific. As of 3 Sep 2026 it also runs the OTHER direction — see
// applyMechOnHitEffect (engine/turnManager.ts) and Shock Claws below, this
// file's first branch to actually reuse it. The note stands for whichever
// status-effect kind comes after stun (knockback/DoT/attack-debuff on the
// player side, or a second stun-granting branch/Heirloom): the plumbing to
// reuse is already built, not a new system to design from scratch.
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
//
// Scattershot Pistols added 3 Sep 2026 (Bloom_Wars_Mek_Workshop_And_Weapon_
// Progression_v1.md's own line for Meeps' second branch: "very short range
// (2, not Meeps' usual 1), small cleave to a second adjacent target...
// worth watching that it doesn't quietly become a mini-Reeps"). Meeps' base
// attackRange is [1,1] (data/units.ts) — melee-adjacent only, the whole
// point of the class being "has to get close." This branch is the first in
// the file to touch the attackRange TUPLE itself rather than a stat/
// targeting condition: SCATTERSHOT_PISTOLS_ATTACK_RANGE is [1,2], not
// [2,2] — the minimum stays 1 deliberately, so equipping this never takes
// away the option to stand adjacent, it only adds the option to stand one
// tile back. That's the "tiny nudge toward range without actually breaking
// Meeps has to get close" the source doc asks for; [2,2] (forcing the
// minimum out to 2, the way Reeps' [2,4] never lets them touch anything)
// would have been the mini-Reeps the doc explicitly says to watch for.
//
// The cleave: on a landed hit (not a dodge), a SECOND enemy unit adjacent
// to the PRIMARY TARGET — not adjacent to the Meeps — takes
// SCATTERSHOT_PISTOLS_CLEAVE_PCT of a freshly-computed hit against its own
// stats (its own defense/terrain, run through the same resolveMechAttack
// formula as any other hit, not a flat fraction of the primary's damage
// number). See engine/mission.ts's applyScattershotCleave() for the full
// mechanism and the specific calls this pass makes on dodge/counter/ambush
// interaction — none of that lives here, this file only owns the numbers.
// Both SCATTERSHOT_PISTOLS_ATTACK_RANGE and SCATTERSHOT_PISTOLS_CLEAVE_PCT
// are placeholders, same status as every other number in this file: not
// run through combat_sim.py or an equivalent, one line each to retune.
//
// Shock Claws added 3 Sep 2026, same day, third pass — Meeps' 3rd branch,
// and the FIRST branch in this file to actually use the status-effect
// infrastructure the note above has been pointing at since 27 Aug. Straight
// melee (does NOT touch attackRange — Meeps' plain [1,1] stays [1,1]; that
// tuple belongs to Scattershot Pistols above, this is a different lever).
// Spec: "chance to briefly stun on hit." Two placeholder numbers, both
// flagged the same way as every other number in this file (not run through
// combat_sim.py): SHOCK_CLAWS_STUN_CHANCE (25%, picked as a round "sometimes,
// not reliably" number — high enough to be worth building around, low
// enough that a Meeps carrying this can't be counted on to lock a target
// down turn after turn) and SHOCK_CLAWS_STUN_DURATION_TURNS (1 turn — the
// shortest duration this file's status-effect vocabulary supports; a
// longer stun on a chance-based melee proc reads as a much bigger power
// swing than "brief" in the spec's own wording implies).
//
// The mapping below (WEAPON_BRANCH_ON_HIT_EFFECT) is the data half of the
// mech->Bloom on-hit effects engine (engine/turnManager.ts's
// applyMechOnHitEffect, added alongside this branch) — the reverse
// direction of data/bloom.ts's own BLOOM_ON_HIT_EFFECTS/onHit pairing.
// engine/mission.ts's mech-attacks-Bloom resolution reads this table by the
// ATTACKER's own weaponBranchId (not a branch === "meeps_shock_claws"
// special case buried in that file) to decide whether a landed hit rolls
// for an effect at all, and MECH_ON_HIT_EFFECTS (keyed by fxId, same shape
// as BLOOM_ON_HIT_EFFECTS) to decide what that effect actually does. A
// future branch or Heirloom ability that wants an on-hit effect adds one
// entry to each of these two tables — no new engine surface required, the
// same "plumbing already built" promise the note above made for the Bloom
// side now holds for this side too.
import type { Path } from "./types";
import { MUNTI_REGEN_RADIUS } from "./combatTables";

export type WeaponBranchId =
  | "meeps_impact_lance"
  | "meeps_scattershot_pistols"
  | "meeps_shock_claws"
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

/** Meeps — Scattershot Pistols, 3 Sep 2026. Overrides the archetype's own [1,1] attackRange (data/units.ts) — min stays 1 on purpose (see header comment: this is a range NUDGE, not a Reeps-style stand-off weapon). Applied in engine/units.ts's createPlayerUnit() the same "baked in at creation" way branchAttackBonus already is. */
export const SCATTERSHOT_PISTOLS_ATTACK_RANGE: readonly [number, number] = [1, 2];

/** Meeps — Scattershot Pistols' cleave fraction, 3 Sep 2026. Fraction of a freshly-computed hit (own defense/terrain, same resolveMechAttack formula) dealt to a second enemy adjacent to the PRIMARY TARGET when the primary hit lands. Placeholder — not run through combat_sim.py, one line to retune. Picked at 50%, the same "half-strength secondary effect" order of magnitude as RAIL_LANCE_DEF_IGNORE_PCT/GRINDER_CLAW_HEAL_PCT below, deliberately not full damage: this is a small cleave nudge per the source doc, not Missiles' full-damage splash (which is its own dedicated action-costing ability, not a rider on every basic attack). */
export const SCATTERSHOT_PISTOLS_CLEAVE_PCT = 0.5;

/** Meeps — Shock Claws, 3 Sep 2026. Chance (0-1) that a landed hit rolls a stun onto the defender — see engine/mission.ts's mech-attacks-Bloom resolution for where this roll actually happens (this file only owns the number). Placeholder — not run through combat_sim.py, one line to retune. */
export const SHOCK_CLAWS_STUN_CHANCE = 0.25;

/** Meeps — Shock Claws' stun duration, in turns, same convention as every duration elsewhere in this system (BLOOM_ON_HIT_EFFECTS' own acid_dot/debuff_attack durations, data/bloom.ts). Placeholder, same status as SHOCK_CLAWS_STUN_CHANCE above — picked at the shortest duration this status-effect vocabulary supports, matching the spec's own "briefly." */
export const SHOCK_CLAWS_STUN_DURATION_TURNS = 1;

/**
 * Mech-side on-hit effects (engine/turnManager.ts's applyMechOnHitEffect) —
 * this system's analogue of data/bloom.ts's BLOOM_ON_HIT_EFFECTS, same
 * shape (a table of fxId -> {kind, magnitude, duration}, dispatched on
 * `kind`). `magnitude` is unused for "stun" (there's no "how much" the way
 * acid_dot/debuff_attack have one) but kept on the shared shape so this
 * table's entries stay structurally identical to BLOOM_ON_HIT_EFFECTS'
 * rather than inventing a second, effect-kind-specific shape for a table of
 * exactly one entry today.
 */
export const MECH_ON_HIT_EFFECTS: Record<string, { kind: "stun"; magnitude: number; duration: number }> = {
  fx_shock_claws_stun: { kind: "stun", magnitude: 0, duration: SHOCK_CLAWS_STUN_DURATION_TURNS },
};

/**
 * Which weapon branch grants which mech-side on-hit effect, and at what
 * chance to fire on a landed hit — the piece BLOOM_ON_HIT_EFFECTS doesn't
 * need an equivalent of, since a Bloom archetype's onHit is baked into the
 * archetype itself (data/bloom.ts) rather than depending on anything the
 * player equips. Read by engine/mission.ts's mech-attacks-Bloom resolution,
 * keyed by the ATTACKER's own weaponBranchId — not present in this record
 * at all for every branch that doesn't grant an on-hit effect (the common
 * case; Partial, not Record, deliberately, so a branch with nothing to add
 * here needs no entry rather than an explicit `undefined`).
 */
export const WEAPON_BRANCH_ON_HIT_EFFECT: Partial<Record<WeaponBranchId, { fxId: string; chance: number }>> = {
  meeps_shock_claws: { fxId: "fx_shock_claws_stun", chance: SHOCK_CLAWS_STUN_CHANCE },
};

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
  meeps_scattershot_pistols: {
    id: "meeps_scattershot_pistols",
    displayName: "Scattershot Pistols",
    path: "meeps",
    description: `Range extends to ${SCATTERSHOT_PISTOLS_ATTACK_RANGE[1]} (was 1). A landed hit also cleaves onto a second enemy adjacent to your target for ${Math.round(SCATTERSHOT_PISTOLS_CLEAVE_PCT * 100)}% damage.`,
  },
  meeps_shock_claws: {
    id: "meeps_shock_claws",
    displayName: "Shock Claws",
    path: "meeps",
    description: `Melee. A landed hit has a ${Math.round(SHOCK_CLAWS_STUN_CHANCE * 100)}% chance to stun the target for ${SHOCK_CLAWS_STUN_DURATION_TURNS} turn.`,
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

/** Every branch currently buildable for a given class, in unlock order (index 0 = 1st branch a pilot of this path can buy). Riot Drum/Maser Lance/Suppression Autocannon/Combat Medic still wait on further design work (see the source doc's own §5/§10 Tier-3 split) and are not listed here so the shop never offers something the engine can't back yet. Reeps gets two (Missiles, then Rail Lance) since both are numbers-only and this exercises the real "collect more than one, swap for free" mechanic end to end; Munti now gets three for the same reason (Rapid Response, Aegis Ward, Field Doctor). Meeps now gets three (Impact Lance, Scattershot Pistols, then Shock Claws, 3 Sep 2026) — Shock Claws is the first branch in the file to actually use the status-effect infrastructure (stun, via WEAPON_BRANCH_ON_HIT_EFFECT/MECH_ON_HIT_EFFECTS above and engine/turnManager.ts's applyMechOnHitEffect) rather than just a stat/targeting change. */
export const WEAPON_BRANCHES_BY_PATH: Record<Path, WeaponBranchId[]> = {
  meeps: ["meeps_impact_lance", "meeps_scattershot_pistols", "meeps_shock_claws"],
  tank: ["tank_grinder_claw"],
  reeps: ["reeps_missiles", "reeps_rail_lance"],
  munti: ["munti_rapid_response", "munti_aegis_ward", "munti_field_doctor"],
};
