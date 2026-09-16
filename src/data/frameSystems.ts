// src/data/frameSystems.ts
// The Frame Systems Layer, Tier 1 (claude/Bloom_Wars_Frame_Systems_Layer_v1.md
// §3/§4/§5/§7/§8/§10, built 6 Sep 2026 on Maxime's go-ahead: "keep building
// tier 1" — with the second mount included, his call when the mount was
// flagged as the one Tier 1 piece that ISN'T "data only"). The doc's own
// scope line for this tier, verbatim: "Draw budget and per-tier capacity;
// the second mount at C; all [the] pure-number systems in §5; all eight
// frame refits; the additive systemBonuses() term in the §5.1 order of
// application; the equip screen."
//
// Maxime's own framing of the whole layer, restated so the shape below is
// legible: "weapon and progression doesnt cover enough system of a mech to
// incrase to g-a rank. lets go ham and incrase the number of system, like in
// Lancer. dont crib it, just inspire ourself from it." The doc's §0 diagnosis
// is that G→A moved four stats and never changed what a mech could DO; this
// file is what makes each tier step also grant CAPACITY (mounts, Draw) that
// the player fills with real choices.
//
// WHAT THIS FILE OWNS: every number and every id for the layer — tier
// capacity, the system catalog, the refit table, the salvage gates, the
// personal-point prices. What it deliberately does NOT own: any engine
// behavior. Same split as data/weaponBranches.ts: a system's EFFECT is read
// at the exact point it applies (engine/frameSystems.ts is the one place the
// per-unit lookups live; engine/units.ts, engine/combat.ts, engine/mission.ts
// and engine/ai.ts each read it there), this file only says what the numbers
// are. `stats` is the exception, on purpose — a pure additive stat delta IS
// data, and engine/units.ts's createPlayerUnit sums it as one more term in
// Data Pack §5.1's own order of application (base -> tier -> mek -> branch
// -> systems -> refit).
//
// HOW THE DOC'S CATALOG WAS READ, and two honest discrepancies in the doc
// itself (verified against its actual current text, not memory):
//   - §5's own summary line says "24 systems... of which 13 are pure
//     numbers." The bulleted list under it actually holds 32 systems, 18 of
//     them bold (bold = "pure numbers, ships with zero new engine work," by
//     the doc's own key). This file builds from the LIST, not the summary
//     line — the list is the content, the line is a count that drifted.
//   - Three of those 18 bold systems describe mechanics this engine does
//     not have (the doc's own header caveat — it was checked "against the
//     project docs... not against live code"):
//       * Field Repair Kit — "one extra Repair charge per mission." Repair
//         has no charges and no per-mission cap (engine/mission.ts's
//         repairUnit: unlimited uses, flat 1 action — the same finding
//         Field Doctor hit on 1 Sep 2026). BUILT anyway, as the closest real
//         lever: +25% Repair output. Flagged, one line to change.
//       * Stabilizer Struts — "Fieldwright's stationary repair also works
//         if you moved 1 tile." At Tier 1's first pass there was no
//         stationary-repair rule at all: data/meks.ts's
//         MEK_TRACK_EFFECTS.fieldwright.stationaryHeal was a data field
//         nothing in the engine read, despite GDD §6.2 / Data Pack §5
//         documenting it as shipped. Left out that morning; BUILT the same
//         evening on Maxime's call, once the heal itself was wired
//         (engine/mission.ts's tickStationaryRepair). See
//         STABILIZER_STRUTS_MOVE_ALLOWANCE.
//       * Crash Foam Lining — "restock at 75% HP instead of 50% when a
//         Fabricator part redeploys you." The Fabricator mid-mission
//         redeploy was never built, and on 6 Sep 2026 Maxime ruled it never
//         will be — "its the beacon job to give in battle restock." Spare
//         parts now feed Beacon Control instead (engine/mission.ts's
//         useBeaconControl), which already restores to full, so this
//         system's premise is gone. CUT from the catalog, not reinterpreted.
//     So this file ships 17 systems (16 at Tier 1's first pass, +Struts).
//   - The doc's Heartwood Graft was named after bloom_heartwood, which never
//     spawns in EITHER shipped campaign (0 waves in data/campaignAmaranth.ts,
//     0 in data/campaignHouseAmaranth.ts — it survives only in the archived
//     Team One slice, data/campaign.ts), so as written it could never be
//     unlocked. RE-SOURCED to Gallcyst (salvage_gallcyst_graft) on Maxime's
//     call, same day — same +20 HP / -1 move trade, a donor that actually
//     appears. engine/campaignEconomy.ts still hides any salvage system
//     whose source archetype the current campaign can never supply, rather
//     than showing a lock the player can never open; today nothing shipped
//     trips it, but the doc's other salvage entries (Choir Membrane,
//     Sirenmaw Resonator, Undertow Spines, Sporethrower Glands) will land
//     on that rule when Tier 2 builds them. Note the doc's own §7 list
//     (Wellroot/Choir/Undertow/Sirenmaw/Sporethrower) never included
//     Heartwood either — §5f and §7 disagreed with each other.
//
// EVERY NAME HERE IS A PLACEHOLDER, per the doc's own §14 item 9 ("every
// system/refit/core name in here... placeholders throughout, as always").
// "Draw" as the budget word is Claude's standing recommendation, never put
// to a formal decision — see the same item. EVERY POINT COST is a
// placeholder too, per §14 item 10, now with `npm run sim:economy` to test
// candidates against; the harness (src/sim/frameSystemsEconomyParams.ts)
// imports the real constants from THIS file so the two can't drift.
import type { MekArchetype, Path, Tier } from "./types";

// ---- §3: gear tier as a CAPACITY ladder, not just a stat ladder ----------
//
// Stats per tier are unchanged (data/combatTables.ts's TIERS is untouched by
// this whole layer, so nothing in the combat sim needs re-tuning). What each
// step ALSO grants is below — transcribed from the doc's §3 table, not
// invented. "S" (Heirloom-grade, never purchasable — see data/types.ts's
// Tier) isn't in the doc's table at all; it reads as A's row here, on the
// same "S sits above A" reasoning every other S-tier special case in this
// codebase uses. Claude's own call, flagged.

export interface FrameTierCapacity {
  /** Weapon branches this frame can carry into one mission at once. 1 until C, then 2. */
  mounts: 1 | 2;
  /** Total Draw budget for equipped systems. */
  draw: number;
}

export const FRAME_TIER_CAPACITY: Record<Tier, FrameTierCapacity> = {
  G: { mounts: 1, draw: 2 },
  F: { mounts: 1, draw: 3 },
  E: { mounts: 1, draw: 4 },
  D: { mounts: 1, draw: 5 },
  C: { mounts: 2, draw: 6 },
  B: { mounts: 2, draw: 8 },
  A: { mounts: 2, draw: 10 },
  S: { mounts: 2, draw: 10 },
};

export function frameCapacityFor(tier: Tier): FrameTierCapacity {
  return FRAME_TIER_CAPACITY[tier] ?? FRAME_TIER_CAPACITY.G;
}

// ---- Economy placeholders ------------------------------------------------

/**
 * PLACEHOLDER. Personal points per point of Draw for any system, Foundry or
 * salvage alike. Picked (6 Sep 2026, the economy sim harness pass) so a
 * 2-Draw system costs 120 — roughly a third of the cheapest weapon branch
 * (150) — since systems are meant to be smaller, more numerous purchases
 * than branches. Re-verified against the same-day earn-rate retune
 * (KILL_BONUS 18 / SURVIVAL_BONUS 26 / OBJECTIVE_BONUS 46): the harness's
 * "anchor" pilot fully maxes 100% of the time at this price, averaging
 * mission ~26. One line to retune; run `npm run sim:economy` after.
 */
export const FRAME_SYSTEM_POINTS_PER_DRAW = 60;

/** PLACEHOLDER. One-time personal-point cost of the A-tier Frame Refit. Set just under the top weapon-branch purchase (400) — both are end-game capstones bought once tier A is reached; the Refit reads as a hair cheaper so it doesn't feel like a tax on top of finishing a weapon track. Same harness-verified status as FRAME_SYSTEM_POINTS_PER_DRAW. */
export const FRAME_REFIT_COST = 350;

/** Doc §7's own decided number, not a placeholder: "a salvage system costs +1 Draw on any pilot whose mek is not a Runemaster." Draw-only — the point price is the same for everyone. Primary OR secondary Runemaster track waives it (the doc says "whose mek is not a Runemaster," which reads as either track). */
export const SALVAGE_NON_RUNEMASTER_DRAW_SURCHARGE = 1;

// ---- The system catalog (§5) ------------------------------------------------

export type FrameSystemFamily = "frame" | "drive" | "sensor" | "ordnance" | "support" | "salvage";

export const FRAME_SYSTEM_FAMILY_ORDER: readonly FrameSystemFamily[] = ["frame", "drive", "sensor", "ordnance", "support", "salvage"];

export const FRAME_SYSTEM_FAMILY_LABELS: Record<FrameSystemFamily, string> = {
  frame: "Frame",
  drive: "Drive",
  sensor: "Sensor",
  ordnance: "Ordnance",
  support: "Support",
  salvage: "Salvage",
};

export type FrameSystemId =
  // 5a. Frame — survivability
  | "frame_reinforced_plating"
  | "frame_spall_liner"
  | "frame_sealed_cockpit"
  | "frame_redundant_actuators"
  // 5b. Drive — mobility
  | "drive_sprint_cell"
  | "drive_low_profile_gait"
  | "drive_bloomwalkers"
  // 5c. Sensor and command
  | "sensor_signal_booster"
  | "sensor_seismic_tap"
  // 5d. Ordnance
  | "ordnance_focusing_optics"
  | "ordnance_shredder_rounds"
  | "ordnance_overpressure_regulator"
  // 5e. Support and logistics
  | "support_field_repair_kit"
  | "support_salve_drone"
  | "support_stabilizer_struts"
  // 5f. Salvage — the Bloom-derived line (§7)
  | "salvage_wellroot_filament"
  | "salvage_gallcyst_graft";

/** Pure additive stat deltas — Data Pack §5.1's order of application gains one more term per line. Every field optional; absent means 0. */
export interface FrameStatDelta {
  attack?: number;
  defense?: number;
  hp?: number;
  vision?: number;
  move?: number;
}

export interface FrameSystemDef {
  id: FrameSystemId;
  displayName: string;
  family: FrameSystemFamily;
  /** Draw cost (1-3), before the §7 salvage surcharge. */
  draw: 1 | 2 | 3;
  /** Player-facing, one line. */
  description: string;
  /** Pure additive stat deltas, summed into createPlayerUnit's effective stats. */
  stats?: FrameStatDelta;
  /**
   * §7's supply line. Present only on a salvage system: the Bloom archetype
   * whose kills unlock it, and how many. `kills` is per-system rather than
   * one flat threshold because the two shipping salvage sources are both
   * BOSSES (one spawn per campaign, `count: 1`) — a flat "15 kills" gate,
   * which is what the economy sim harness first assumed, would have been
   * unreachable for both. Cut off the boss you killed: one is enough.
   */
  salvage?: { archetypeId: string; kills: number };
}

// ---- Behaviour numbers, read by engine/frameSystems.ts at the point each applies ----
// All placeholders in the same sense every weapon-branch number is (not run
// through combat_sim.py), each one line to retune.

/** Spall Liner — multiplier on counterattack damage TAKEN (you attacked, they swung back). "50% less." */
export const SPALL_LINER_COUNTER_DAMAGE_MULT = 0.5;
/** Bloomwalkers — what a bloom_mat tile costs to enter, instead of tiles.ts's 2 for both ground chassis. */
export const BLOOMWALKERS_MAT_MOVE_COST = 1;
/** Low-Profile Gait — extra terrain defence stars, ONLY on real cover ("when you end your move on cover"). */
export const LOW_PROFILE_GAIT_STAR_BONUS = 1;
/**
 * What counts as "cover" for Low-Profile Gait: a tile with at least this
 * many defence stars. NOT "at least one" — data/tiles.ts gives open `plain`
 * ground 1 star already (road/scrub/spawn are the 0-star tiles), so "any
 * star" would have made a 1-Draw system fire on almost every tile in the
 * game. 2 is the first tier of actual cover (rubble/hold/dock), then
 * structure (3) and ridge (4). Found by this pass's own test, not assumed.
 */
export const LOW_PROFILE_GAIT_COVER_MIN_STARS = 2;
/** Seismic Tap — detects burrowed units within this many tiles. Deliberately smaller than the Runemaster mek track's "anywhere in vision" (doc §5c: "the poor man's version, so a system can't make the mek track... redundant"). */
export const SEISMIC_TAP_DETECT_RADIUS = 3;
/** Focusing Optics — flat ATK bonus when the target sits at exactly the attacker's maximum attack range. */
export const FOCUSING_OPTICS_ATK_BONUS = 8;
/** Shredder Rounds — fraction of the target's effective defense ignored on the primary hit. Stacks ADDITIVELY with Rail Lance's own vs-Tank ignore (a Reeps carrying both ignores 50% of a Tank's DEF) — the doc's own framing is "sharpens Reeps-beats-Tank," so additive is the reading taken; flagged as a number worth a sim pass. Bloom carry no defense field at all, so this does nothing against a Bloom target — the same pre-existing gap Rail Lance already has. */
export const SHREDDER_ROUNDS_DEF_IGNORE_PCT = 0.25;
/** Overpressure Regulator — multiplier on this unit's FIRST basic attack of the mission (the Attack verb only — not Missiles/Maser Lance/an Heirloom ability, which are their own actions with their own numbers). Spent the moment that first attack resolves, hit or dodge. */
export const OVERPRESSURE_REGULATOR_FIRST_ATTACK_MULT = 1.4;
/** Field Repair Kit — REINTERPRETED (see file header): multiplier on the holder's Repair output, since Repair has no per-mission charges to add one to. */
export const FIELD_REPAIR_KIT_OUTPUT_MULT = 1.25;
/** Salve Drone — HP per turn its passive aura heals, and its radius. Enters engine/mission.ts's tickMuntiRegen as one more aura SOURCE under the existing "best single source in range wins, no stacking" rule — a unit standing next to a Salve Drone AND inside a Munti's aura heals for the Munti's number (8), not 8+3. Any path can carry it. Deliberately narrower than the Munti's own MUNTI_REGEN_RADIUS (data/combatTables.ts) — the Munti stays the better healer on both numbers, by design. */
export const SALVE_DRONE_REGEN_PER_TURN = 3;
export const SALVE_DRONE_RADIUS = 1;
/** Wellroot Filament — HP regenerated at the start of each cycle while standing on bloom_mat. Applied AFTER the tile's own turnStartDamage (5), so the net on an acid tile is +3 — "turns the map's own hazard into your ground." With Sealed Cockpit too, the full +8. */
export const WELLROOT_FILAMENT_MAT_REGEN = 8;
/**
 * Stabilizer Struts (built 6 Sep 2026, second pass, once the Fieldwright
 * stationary heal it depends on was finally wired — see engine/mission.ts's
 * tickStationaryRepair) — how many tiles the holder may have moved this turn
 * and STILL count as stationary for that heal. The doc says "if you moved 1
 * tile"; 0 is the base rule, this is the allowance. Only matters on a pilot
 * whose mek has a Fieldwright track; on anyone else it's a 1-Draw no-op, and
 * the shop doesn't hide it — "you bought a system your mek can't use" is a
 * real, legible mistake, same as buying Shredder Rounds for a Munti.
 */
export const STABILIZER_STRUTS_MOVE_ALLOWANCE = 1;

export const FRAME_SYSTEMS: Record<FrameSystemId, FrameSystemDef> = {
  // ---- 5a. Frame — survivability (any path) ----
  frame_reinforced_plating: {
    id: "frame_reinforced_plating",
    displayName: "Reinforced Plating",
    family: "frame",
    draw: 2,
    description: "+6 DEF, -1 move.",
    stats: { defense: 6, move: -1 },
  },
  frame_spall_liner: {
    id: "frame_spall_liner",
    displayName: "Spall Liner",
    family: "frame",
    draw: 1,
    description: `Take ${Math.round((1 - SPALL_LINER_COUNTER_DAMAGE_MULT) * 100)}% less counterattack damage.`,
  },
  frame_sealed_cockpit: {
    id: "frame_sealed_cockpit",
    displayName: "Sealed Cockpit",
    family: "frame",
    draw: 1,
    description: "Immune to bloom-mat acid. Changes which tiles a map actually denies you.",
  },
  frame_redundant_actuators: {
    id: "frame_redundant_actuators",
    displayName: "Redundant Actuators",
    family: "frame",
    draw: 2,
    description: "Ignore chassis terrain penalties — a centauroid pays bipedal movement costs everywhere.",
  },

  // ---- 5b. Drive — mobility ----
  drive_sprint_cell: {
    id: "drive_sprint_cell",
    displayName: "Sprint Cell",
    family: "drive",
    draw: 2,
    description: "+1 move.",
    stats: { move: 1 },
  },
  drive_low_profile_gait: {
    id: "drive_low_profile_gait",
    displayName: "Low-Profile Gait",
    family: "drive",
    draw: 1,
    description: `+${LOW_PROFILE_GAIT_STAR_BONUS} terrain defence star whenever you're standing on real cover (rubble or better).`,
  },
  drive_bloomwalkers: {
    id: "drive_bloomwalkers",
    displayName: "Bloomwalkers",
    family: "drive",
    draw: 1,
    description: `Bloom mat costs ${BLOOMWALKERS_MAT_MOVE_COST} move instead of 2.`,
  },

  // ---- 5c. Sensor and command ----
  sensor_signal_booster: {
    id: "sensor_signal_booster",
    displayName: "Signal Booster",
    family: "sensor",
    draw: 1,
    description: "+1 vision.",
    stats: { vision: 1 },
  },
  sensor_seismic_tap: {
    id: "sensor_seismic_tap",
    displayName: "Seismic Tap",
    family: "sensor",
    draw: 2,
    description: `Detects burrowed units within ${SEISMIC_TAP_DETECT_RADIUS} tiles.`,
  },

  // ---- 5d. Ordnance ----
  ordnance_focusing_optics: {
    id: "ordnance_focusing_optics",
    displayName: "Focusing Optics",
    family: "ordnance",
    draw: 2,
    description: `+${FOCUSING_OPTICS_ATK_BONUS} ATK against a target at your maximum range.`,
  },
  ordnance_shredder_rounds: {
    id: "ordnance_shredder_rounds",
    displayName: "Shredder Rounds",
    family: "ordnance",
    draw: 2,
    description: `Ignore ${Math.round(SHREDDER_ROUNDS_DEF_IGNORE_PCT * 100)}% of a mech target's DEF.`,
  },
  ordnance_overpressure_regulator: {
    id: "ordnance_overpressure_regulator",
    displayName: "Overpressure Regulator",
    family: "ordnance",
    draw: 3,
    description: `Your first attack each mission deals x${OVERPRESSURE_REGULATOR_FIRST_ATTACK_MULT}. An alpha-strike build, not a passive.`,
  },

  // ---- 5e. Support and logistics ----
  support_field_repair_kit: {
    id: "support_field_repair_kit",
    displayName: "Field Repair Kit",
    family: "support",
    draw: 1,
    description: `Repair heals ${Math.round((FIELD_REPAIR_KIT_OUTPUT_MULT - 1) * 100)}% more.`,
  },
  support_salve_drone: {
    id: "support_salve_drone",
    displayName: "Salve Drone",
    family: "support",
    draw: 2,
    description: `Passive regen aura: +${SALVE_DRONE_REGEN_PER_TURN} HP/turn to allies within ${SALVE_DRONE_RADIUS} tile. Doesn't stack with a Munti's aura — the stronger one applies.`,
  },
  support_stabilizer_struts: {
    id: "support_stabilizer_struts",
    displayName: "Stabilizer Struts",
    family: "support",
    draw: 1,
    description: `A Fieldwright Mek's stationary repair still fires if you moved ${STABILIZER_STRUTS_MOVE_ALLOWANCE} tile. Nothing without a Fieldwright track.`,
  },

  // ---- 5f. Salvage — the Bloom-derived line (§7) ----
  salvage_wellroot_filament: {
    id: "salvage_wellroot_filament",
    displayName: "Wellroot Filament",
    family: "salvage",
    draw: 2,
    description: `Regenerate ${WELLROOT_FILAMENT_MAT_REGEN} HP/turn while standing on bloom mat. The map's own hazard becomes your ground.`,
    salvage: { archetypeId: "bloom_wellroot", kills: 1 },
  },
  // Re-sourced 6 Sep 2026 (second pass) from the doc's Heartwood Graft, on
  // Maxime's call: bloom_heartwood never spawns in either shipped campaign,
  // so the system as written could never be unlocked. Gallcyst is the
  // rarest Bloom that DOES spawn in both and isn't already claimed by one of
  // the doc's unbuilt salvage systems (Choir/Sirenmaw/Undertow/Sporethrower).
  // Same stat trade as the doc's entry, different donor.
  salvage_gallcyst_graft: {
    id: "salvage_gallcyst_graft",
    displayName: "Gallcyst Graft",
    family: "salvage",
    draw: 3,
    description: "+20 max HP, -1 move. A slab of cyst wall bonded over the frame's seams — more to carry, more to chew through.",
    stats: { hp: 20, move: -1 },
    salvage: { archetypeId: "bloom_gallcyst", kills: 1 },
  },
};

export const FRAME_SYSTEM_IDS: readonly FrameSystemId[] = Object.keys(FRAME_SYSTEMS) as FrameSystemId[];

export function isFrameSystemId(id: string): id is FrameSystemId {
  return Object.prototype.hasOwnProperty.call(FRAME_SYSTEMS, id);
}

/** Personal-point price of a system — the same per-Draw rate whatever its family (§7's surcharge is Draw-only). */
export function frameSystemPointCost(def: FrameSystemDef): number {
  return def.draw * FRAME_SYSTEM_POINTS_PER_DRAW;
}

/** True if either of the mek's tracks is Runemaster — the §7 salvage surcharge waiver. */
export function mekIsRunemaster(mek: MekArchetype | undefined): boolean {
  return !!mek && (mek.primary === "runemaster" || mek.secondary === "runemaster");
}

/** The Draw a system actually occupies on THIS pilot's frame — the catalog number, plus §7's surcharge for a salvage system on a non-Runemaster loadout. */
export function frameSystemDrawFor(def: FrameSystemDef, mek: MekArchetype | undefined): number {
  if (def.salvage && !mekIsRunemaster(mek)) return def.draw + SALVAGE_NON_RUNEMASTER_DRAW_SURCHARGE;
  return def.draw;
}

// ---- Frame Refits (§8) — the A-tier payoff ---------------------------------
//
// One permanent refit per pilot, chosen at A, bought once with personal
// points (FRAME_REFIT_COST). Decided 6 Sep 2026 (doc §14 item 2): the Refit
// stands alone as the A-tier capstone — Meeps/Tank are NOT forced into a
// symmetric 4th weapon branch.
//
// HARD RULE, the doc's own §8, restated at the data so nobody proposes past
// it: a refit can never touch the class triangle. Tank never gets reach.
// Reeps never gains a counterattack and never becomes counterattackable at
// range >= 2. Meeps never gets durable enough to trade with Tank. Every
// entry below bends a path's internal shape only.
//
// Two of the eight needed reinterpreting against the live engine, same
// class of finding as the three systems in the file header:
//   - Aid Station: doc says "repair range 3, -1 move." Base Repair range has
//     been 3 since 28 Aug 2026 (data/weaponBranches.ts's DEFAULT_REPAIR_RANGE,
//     raised from the 1 the doc was written against), so "3" is no upgrade
//     at all today. Built as +2 repair range on top of whatever the pilot's
//     branch gives (5 with plain Repair, 6 with Rapid Response), preserving
//     the doc's intent — "a wide-reaching but slow medic" — over its literal
//     number. Flagged.
//   - Vanguard Medic: doc says "+1 move, repair range 1." Taken literally —
//     range 1 was the ORIGINAL adjacent-only base, so on today's engine this
//     is a real trade: mobility for reach, a medic who has to be next to
//     you. That IS a coherent shape, so the literal number stands.
//   - Ram Frame: "x1.25 damage when you move 2+ tiles into the attack." The
//     doc calls this "deliberately the centauroid Charge rule available to a
//     bipedal Tank," so it is built as exactly that: it sets
//     BattleUnit.chargedThisMove (engine/mission.ts's moveUnit) after a
//     2+ tile move and rides data/combatTables.ts's own CENTAUROID_CHARGE_MULT
//     (1.25 today) — one rule, not a second copy of it. Unlike the centauroid
//     version, the move need not be a straight line: the doc's own text says
//     "move 2+ tiles," nothing about direction.
//   - Battery Frame: "range 2-5, cannot move and attack the same turn." The
//     engine tracks actions, not "moved this turn" (the two-action house
//     rule replaced movedThisTurn on 22 Aug 2026) — BattleUnit.movedThisTurn
//     is reintroduced for this one refit alone, set by moveUnit and cleared
//     with actionsRemaining. Note the sim bot (src/sim/playerAi) doesn't
//     know this rule and will plan a move-then-attack that the attack verb
//     then refuses — it only matters if a synthetic pilot is ever given
//     this refit, which nothing in the batch harness does today. Flagged.

export type FrameRefitId =
  | "refit_meeps_skirmish_frame"
  | "refit_meeps_breacher_frame"
  | "refit_tank_bastion"
  | "refit_tank_ram_frame"
  | "refit_reeps_battery_frame"
  | "refit_reeps_skirmish_battery"
  | "refit_munti_aid_station"
  | "refit_munti_vanguard_medic";

export interface FrameRefitDef {
  id: FrameRefitId;
  displayName: string;
  path: Path;
  description: string;
  /** Pure additive stat deltas, same term as a system's. */
  stats?: FrameStatDelta;
  /** Replaces the archetype's attackRange outright (Reeps refits). Merged with Scattershot Pistols' own override by the same widest-window rule createPlayerUnit uses for two mounts. */
  attackRange?: readonly [number, number];
  /** Aid Station / Vanguard Medic — Repair range delta (Aid Station) or absolute override (Vanguard Medic). See engine/frameSystems.ts's repairRangeFor. */
  repairRangeDelta?: number;
  repairRangeOverride?: number;
}

/** Bastion — how much wider the Tank's overshield aura reaches (radius 1 -> 2). */
export const BASTION_OVERSHIELD_RADIUS_BONUS = 1;
/** Ram Frame — tiles a bipedal Tank must move this action to count as charging (the centauroid rule needs 3 in a straight line; the doc says "2+" and nothing about direction). */
export const RAM_FRAME_CHARGE_MIN_TILES = 2;
/** Battery Frame's range window (doc §8, transcribed). */
export const BATTERY_FRAME_ATTACK_RANGE: readonly [number, number] = [2, 5];
/** Skirmish Battery's range window (doc §8, transcribed). */
export const SKIRMISH_BATTERY_ATTACK_RANGE: readonly [number, number] = [2, 3];
/** Aid Station — REINTERPRETED (see the refit block comment): +2 Repair range over the pilot's branch-derived range. */
export const AID_STATION_REPAIR_RANGE_DELTA = 2;
/** Vanguard Medic — doc §8's literal "repair range 1," adjacent-only. */
export const VANGUARD_MEDIC_REPAIR_RANGE = 1;

export const FRAME_REFITS: Record<FrameRefitId, FrameRefitDef> = {
  refit_meeps_skirmish_frame: {
    id: "refit_meeps_skirmish_frame",
    displayName: "Skirmish Frame",
    path: "meeps",
    description: "+2 move, -15 max HP.",
    stats: { move: 2, hp: -15 },
  },
  refit_meeps_breacher_frame: {
    id: "refit_meeps_breacher_frame",
    displayName: "Breacher Frame",
    path: "meeps",
    description: "+12 ATK, -1 move.",
    stats: { attack: 12, move: -1 },
  },
  refit_tank_bastion: {
    id: "refit_tank_bastion",
    displayName: "Bastion",
    path: "tank",
    description: `Overshield covers +${BASTION_OVERSHIELD_RADIUS_BONUS} radius, -1 move.`,
    stats: { move: -1 },
  },
  refit_tank_ram_frame: {
    id: "refit_tank_ram_frame",
    displayName: "Ram Frame",
    path: "tank",
    description: `Move ${RAM_FRAME_CHARGE_MIN_TILES}+ tiles into an attack to charge (x1.25) — the centauroid rule, on any Tank.`,
  },
  refit_reeps_battery_frame: {
    id: "refit_reeps_battery_frame",
    displayName: "Battery Frame",
    path: "reeps",
    description: `Range ${BATTERY_FRAME_ATTACK_RANGE[0]}-${BATTERY_FRAME_ATTACK_RANGE[1]}. Cannot move and attack in the same turn.`,
    attackRange: BATTERY_FRAME_ATTACK_RANGE,
  },
  refit_reeps_skirmish_battery: {
    id: "refit_reeps_skirmish_battery",
    displayName: "Skirmish Battery",
    path: "reeps",
    description: `Range ${SKIRMISH_BATTERY_ATTACK_RANGE[0]}-${SKIRMISH_BATTERY_ATTACK_RANGE[1]}, +1 move.`,
    stats: { move: 1 },
    attackRange: SKIRMISH_BATTERY_ATTACK_RANGE,
  },
  refit_munti_aid_station: {
    id: "refit_munti_aid_station",
    displayName: "Aid Station",
    path: "munti",
    description: `Repair reaches ${AID_STATION_REPAIR_RANGE_DELTA} tiles further, -1 move.`,
    stats: { move: -1 },
    repairRangeDelta: AID_STATION_REPAIR_RANGE_DELTA,
  },
  refit_munti_vanguard_medic: {
    id: "refit_munti_vanguard_medic",
    displayName: "Vanguard Medic",
    path: "munti",
    description: `+1 move. Repair only reaches ${VANGUARD_MEDIC_REPAIR_RANGE} tile (adjacent).`,
    stats: { move: 1 },
    repairRangeOverride: VANGUARD_MEDIC_REPAIR_RANGE,
  },
};

export const FRAME_REFITS_BY_PATH: Record<Path, FrameRefitId[]> = {
  meeps: ["refit_meeps_skirmish_frame", "refit_meeps_breacher_frame"],
  tank: ["refit_tank_bastion", "refit_tank_ram_frame"],
  reeps: ["refit_reeps_battery_frame", "refit_reeps_skirmish_battery"],
  munti: ["refit_munti_aid_station", "refit_munti_vanguard_medic"],
};

export function isFrameRefitId(id: string): id is FrameRefitId {
  return Object.prototype.hasOwnProperty.call(FRAME_REFITS, id);
}

/** Refits are bought only at the top of the purchasable ladder. S (Heirloom-grade) sits above A and qualifies too. */
export const FRAME_REFIT_TIER_GATE: readonly Tier[] = ["A", "S"];

// ---- Doc systems deliberately NOT built --------------------------------
//
// Listed by name so a gap is a record, not an omission. Tier 1 (6 Sep 2026,
// first pass) left two here; the same day's second pass emptied it —
// Stabilizer Struts got built once the Fieldwright stationary heal it
// depends on was wired (engine/mission.ts's tickStationaryRepair), and
// Crash Foam Lining was CUT from the catalog on Maxime's call: its whole
// premise was the Fabricator mid-mission redeploy, and he ruled that
// "its the beacon job to give in battle restock" — Beacon Control already
// restores to full, so "75% instead of 50%" has nothing to modify. Kept as
// an (empty) export so the next pass that has to leave something out has
// the slot ready and the tests already reading it.
export const UNBUILT_DOC_SYSTEMS: readonly { name: string; reason: string }[] = [];
