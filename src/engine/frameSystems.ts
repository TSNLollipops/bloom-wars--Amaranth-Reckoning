// src/engine/frameSystems.ts
// Frame Systems Layer, Tier 1 (6 Sep 2026) — the engine-side read path for
// everything data/frameSystems.ts defines. ONE module, on purpose: every
// "does this unit carry X" question the engine asks about a mount, a
// system, or a refit comes through here, so the second mount (two weapon
// branches live at once) and the Draw budget have exactly one definition
// each instead of a `=== "some_id"` check re-derived in six files.
//
// Read data/frameSystems.ts's header first for what the layer is and which
// doc items were reinterpreted or left unbuilt. This file only says how the
// numbers there reach a BattleUnit.
//
// Two rules every function below follows, stated once:
//   1. NO-OP WHEN ABSENT. A unit with no systems, no refit, and one (or no)
//      weapon branch gets exactly the pre-Frame-Systems number from every
//      helper here — multiplier 1, bonus 0, base radius, base kind. That is
//      what keeps sim_output.txt's combat cases byte-identical and every
//      existing test green without touching them (engine/combat.ts's own
//      "must reproduce sim_output.txt exactly" rule).
//   2. THE UNIT IS THE SOURCE OF TRUTH IN A MISSION. createPlayerUnit
//      (engine/units.ts) bakes the campaign record's equipped branches/
//      systems/refit onto the BattleUnit once at deploy — "doesn't change
//      mid-mission," same as tier/mek/branch always were — and everything
//      here reads the unit, never the campaign state, so a mid-mission read
//      can't see a shop purchase the deploy didn't.
import type { BattleUnit } from "./units";
import type { MekArchetype, PilotRecord } from "../data/types";
import type { MovementKind } from "./grid";
import { chassisToMovementKind } from "./grid";
import {
  FRAME_SYSTEMS,
  FRAME_REFITS,
  isFrameSystemId,
  isFrameRefitId,
  frameCapacityFor,
  frameSystemDrawFor,
  type FrameSystemId,
  type FrameRefitId,
  type FrameRefitDef,
  type FrameStatDelta,
  SPALL_LINER_COUNTER_DAMAGE_MULT,
  LOW_PROFILE_GAIT_STAR_BONUS,
  LOW_PROFILE_GAIT_COVER_MIN_STARS,
  SEISMIC_TAP_DETECT_RADIUS,
  FOCUSING_OPTICS_ATK_BONUS,
  SHREDDER_ROUNDS_DEF_IGNORE_PCT,
  OVERPRESSURE_REGULATOR_FIRST_ATTACK_MULT,
  FIELD_REPAIR_KIT_OUTPUT_MULT,
  SALVE_DRONE_REGEN_PER_TURN,
  SALVE_DRONE_RADIUS,
  WELLROOT_FILAMENT_MAT_REGEN,
  BASTION_OVERSHIELD_RADIUS_BONUS,
  RAM_FRAME_CHARGE_MIN_TILES,
  STABILIZER_STRUTS_MOVE_ALLOWANCE,
} from "../data/frameSystems";
import {
  WEAPON_BRANCHES,
  RAIL_LANCE_DEF_IGNORE_PCT,
  DEFAULT_REPAIR_RANGE,
  RAPID_RESPONSE_REPAIR_RANGE,
  AEGIS_WARD_REGEN_RADIUS,
  COMBAT_MEDIC_REGEN_RADIUS,
  COMBAT_MEDIC_REGEN_MULTIPLIER,
  type WeaponBranchId,
} from "../data/weaponBranches";
import { MUNTI_REGEN_RADIUS, MUNTI_REGEN_PER_TURN } from "../data/combatTables";
import { BLOOM } from "../data/bloom";

// ---- Campaign-record reads (PilotRecord) ------------------------------------

/**
 * The one read path for "which weapon branches does this pilot have
 * equipped." Handles every save shape this field has ever had:
 *   - a record with `equippedWeaponBranches` (written by this pass onward)
 *     reads the list as-is;
 *   - a record with only the OLD single `equippedWeaponBranch` (every save
 *     before 6 Sep 2026) reads as a one-element list — zero migration, the
 *     same "absent means the pre-pass meaning" convention every optional
 *     field on PilotRecord already follows;
 *   - neither means the plain default weapon.
 * Filters out any id that isn't a real branch (a data rename could leave
 * one behind in a save) rather than letting it reach createPlayerUnit.
 */
export function equippedWeaponBranchesOf(pilot: PilotRecord): WeaponBranchId[] {
  const raw = pilot.equippedWeaponBranches ?? (pilot.equippedWeaponBranch ? [pilot.equippedWeaponBranch] : []);
  const out: WeaponBranchId[] = [];
  for (const id of raw) {
    if (id in WEAPON_BRANCHES && !out.includes(id as WeaponBranchId)) out.push(id as WeaponBranchId);
  }
  return out;
}

/**
 * The one WRITE path for equipped branches — writes the list AND mirrors
 * mount 1 into the legacy single field, so the two can never disagree.
 * engine/campaignEconomy.ts's equip/unequip verbs are the only callers.
 */
export function setEquippedWeaponBranches(pilot: PilotRecord, ids: readonly WeaponBranchId[]): void {
  pilot.equippedWeaponBranches = [...ids];
  pilot.equippedWeaponBranch = ids[0];
}

/** How many weapon branches this pilot's frame can carry at once — 1 below tier C, 2 from C (data/frameSystems.ts FRAME_TIER_CAPACITY). */
export function mountsFor(pilot: PilotRecord): number {
  return frameCapacityFor(pilot.tier).mounts;
}

/** This pilot's total Draw budget at their current tier. */
export function drawCapacityFor(pilot: PilotRecord): number {
  return frameCapacityFor(pilot.tier).draw;
}

/** Owned system ids, filtered to real catalog entries. */
export function ownedFrameSystemsOf(pilot: PilotRecord): FrameSystemId[] {
  return (pilot.ownedFrameSystems ?? []).filter(isFrameSystemId);
}

/**
 * The systems that will actually be live next mission: the equipped list,
 * in equip order, truncated at the first entry that would push cumulative
 * Draw past the frame's budget. equipFrameSystem enforces the budget at
 * equip time, so in normal play this never truncates anything; it exists
 * so a later retune of a Draw number or a tier's capacity can only ever
 * bench a system, never field a frame over budget. Duplicates and ids that
 * aren't owned or aren't real are dropped.
 */
export function equippedFrameSystemsWithinDraw(pilot: PilotRecord, mek: MekArchetype | undefined): FrameSystemId[] {
  const cap = drawCapacityFor(pilot);
  const owned = new Set(ownedFrameSystemsOf(pilot));
  const out: FrameSystemId[] = [];
  let used = 0;
  for (const id of pilot.equippedFrameSystems ?? []) {
    if (!isFrameSystemId(id) || !owned.has(id) || out.includes(id)) continue;
    const draw = frameSystemDrawFor(FRAME_SYSTEMS[id], mek);
    if (used + draw > cap) break;
    used += draw;
    out.push(id);
  }
  return out;
}

/** Draw currently spent by the systems equippedFrameSystemsWithinDraw would field. */
export function frameDrawUsed(pilot: PilotRecord, mek: MekArchetype | undefined): number {
  return equippedFrameSystemsWithinDraw(pilot, mek).reduce((sum, id) => sum + frameSystemDrawFor(FRAME_SYSTEMS[id], mek), 0);
}

/** The pilot's refit, if they've bought one and it's a real catalog entry. */
export function frameRefitOf(pilot: PilotRecord): FrameRefitDef | undefined {
  return pilot.frameRefit && isFrameRefitId(pilot.frameRefit) ? FRAME_REFITS[pilot.frameRefit] : undefined;
}

/**
 * The additive stat term — Data Pack §5.1's order of application gains
 * exactly this on each of its five lines (base -> tier -> mek -> branch ->
 * systems+refit). Systems and the refit are summed together here because
 * they're both pure deltas with no ordering dependency between them.
 * Every field is 0 for a pilot with nothing installed.
 */
export function frameStatBonus(systemIds: readonly FrameSystemId[], refitId: FrameRefitId | undefined): Required<FrameStatDelta> {
  const out = { attack: 0, defense: 0, hp: 0, vision: 0, move: 0 };
  const add = (d: FrameStatDelta | undefined) => {
    if (!d) return;
    out.attack += d.attack ?? 0;
    out.defense += d.defense ?? 0;
    out.hp += d.hp ?? 0;
    out.vision += d.vision ?? 0;
    out.move += d.move ?? 0;
  };
  for (const id of systemIds) add(FRAME_SYSTEMS[id]?.stats);
  if (refitId) add(FRAME_REFITS[refitId]?.stats);
  return out;
}

/**
 * The attack-range window a unit actually gets, from every source that can
 * set one: the archetype's own, Scattershot Pistols' [1,2] (a branch), and
 * the two Reeps refits' windows. With two mounts and a refit there can be
 * up to three candidates; the rule is WIDEST WINDOW — lowest min, highest
 * max across every source. Concretely: a Meeps with Scattershot ([1,2])
 * keeps 1 as the minimum (the doc's own "never take away the option to
 * stand adjacent"), and a Reeps on a Battery Frame ([2,5]) whose archetype
 * is [2,4] gets [2,5]. Returns a fresh tuple every time — never the shared
 * archetype's own array (see weaponBranchAttackRange's own note in
 * engine/units.ts for why that matters).
 */
export function mergedAttackRange(base: readonly [number, number], overrides: readonly (readonly [number, number] | undefined)[]): [number, number] {
  let lo = base[0];
  let hi = base[1];
  for (const o of overrides) {
    if (!o) continue;
    lo = Math.min(lo, o[0]);
    hi = Math.max(hi, o[1]);
  }
  return [lo, hi];
}

/**
 * Seismic Tap's detection radius, or undefined when the systems list gives
 * no burrow detection at all. This is ONE of two sources — engine/units.ts's
 * createPlayerUnit takes the larger of this and a Runemaster-primary mek's
 * "anywhere inside the pilot's vision" (Data Pack §5), wired 6 Sep 2026 on
 * Maxime's call after Tier 1's first pass had left it unread and flagged.
 * That wiring is a real campaign-wide balance change — Rourke's own mek is
 * Runemaster-primary, and she's in every Warden mission with 6 vision — so
 * the design doc's "Seismic Tap is deliberately weaker" ordering now holds
 * for every pilot except one who has both, where the Runemaster's wins.
 */
export function burrowDetectRadiusFor(systemIds: readonly FrameSystemId[]): number | undefined {
  return systemIds.includes("sensor_seismic_tap") ? SEISMIC_TAP_DETECT_RADIUS : undefined;
}

// ---- BattleUnit reads --------------------------------------------------------

/** Every weapon branch live on this unit. Reads the list first, then the legacy single field (a synthetic test unit, or any unit built by a path that never set the list). */
export function unitBranches(unit: BattleUnit): WeaponBranchId[] {
  if (unit.weaponBranchIds && unit.weaponBranchIds.length) return unit.weaponBranchIds;
  return unit.weaponBranchId ? [unit.weaponBranchId] : [];
}

/** `unit.weaponBranchId === id`, generalised to two mounts. */
export function unitHasBranch(unit: BattleUnit, id: WeaponBranchId): boolean {
  return unitBranches(unit).includes(id);
}

export function unitHasSystem(unit: BattleUnit, id: FrameSystemId): boolean {
  return !!unit.frameSystemIds && unit.frameSystemIds.includes(id);
}

export function unitRefit(unit: BattleUnit): FrameRefitDef | undefined {
  return unit.frameRefitId ? FRAME_REFITS[unit.frameRefitId] : undefined;
}

/**
 * The MovementKind this unit's own frame moves by. Wraps grid.ts's
 * chassisToMovementKind with the two Drive/Frame systems that change it:
 *   - Redundant Actuators: "ignore chassis terrain penalties" — the frame
 *     pays BIPEDAL costs everywhere, whatever its chassis (a no-op on a
 *     bipedal or vibrissal frame, which already do; the whole purchase is
 *     the centauroid's).
 *   - Bloomwalkers: bloom_mat costs BLOOMWALKERS_MAT_MOVE_COST — expressed
 *     as the two `*_bloomwalker` MovementKind variants grid.ts's moveCost
 *     understands, so the flood fill's hot path gains one branch, not a
 *     per-unit callback.
 * Hostiles and Bloom never carry systems, so they get exactly the old kind.
 */
export function movementKindForUnit(unit: BattleUnit, flying: boolean): MovementKind {
  if (flying) return "flying";
  const base = unitHasSystem(unit, "frame_redundant_actuators") ? "bipedal" : chassisToMovementKind(unit.chassis ?? "bipedal", false);
  if (unitHasSystem(unit, "drive_bloomwalkers")) return base === "centauroid" ? "centauroid_bloomwalker" : "bipedal_bloomwalker";
  return base;
}

/**
 * movementKindForUnit with the "is this a flying Bloom" half resolved the
 * one way every mover in this codebase already resolves it (a
 * flight_membrane archetype). This is THE movement-kind rule — engine/
 * mission.ts's own mover, engine/ai.ts's moveToward/reachableWithinRangeTile/
 * retreat, engine/threat.ts's footprint, and src/sim/playerAi all call it,
 * so a system that changes how a frame moves changes it everywhere at once
 * rather than in whichever caller remembered.
 */
export function movementKindOf(unit: BattleUnit): MovementKind {
  const flying = unit.kind === "bloom" && BLOOM[unit.archetypeId]?.movementType === "flight_membrane";
  return movementKindForUnit(unit, flying);
}

/** How far a Tank's overshield aura reaches — 1, or 2 on a Bastion refit. Read by engine/combat.ts's overshieldBonus/tankShieldEligible. */
export function overshieldRadius(tank: BattleUnit): number {
  return 1 + (tank.frameRefitId === "refit_tank_bastion" ? BASTION_OVERSHIELD_RADIUS_BONUS : 0);
}

/** Spall Liner — multiplier on the counterattack damage this unit TAKES after attacking. 1 without it. */
export function counterDamageTakenMultiplier(attacker: BattleUnit): number {
  return unitHasSystem(attacker, "frame_spall_liner") ? SPALL_LINER_COUNTER_DAMAGE_MULT : 1;
}

/** Low-Profile Gait — extra defence stars, only on real cover (LOW_PROFILE_GAIT_COVER_MIN_STARS — open `plain` ground already has 1 star in data/tiles.ts, and doesn't count). 0 without it, and 0 off cover even with it. */
export function terrainStarBonus(defender: BattleUnit, baseStars: number): number {
  return baseStars >= LOW_PROFILE_GAIT_COVER_MIN_STARS && unitHasSystem(defender, "drive_low_profile_gait") ? LOW_PROFILE_GAIT_STAR_BONUS : 0;
}

/** Focusing Optics — flat ATK when the target is at exactly this unit's maximum range. 0 otherwise. */
export function focusingOpticsAttackBonus(attacker: BattleUnit, distanceToTarget: number): number {
  return unitHasSystem(attacker, "ordnance_focusing_optics") && distanceToTarget === attacker.attackRange[1] ? FOCUSING_OPTICS_ATK_BONUS : 0;
}

/**
 * Fraction of the defender's effective defense the primary hit ignores —
 * Rail Lance (vs a Tank-path defender only) plus Shredder Rounds (any
 * mech-shape defender), additive. 0 for everyone else. Capped just under 1
 * so the `100 / (defense * (1 - x))` term can never divide by zero if a
 * future source pushes the sum that high.
 */
export function defenseIgnoreFraction(attacker: BattleUnit, defender: BattleUnit): number {
  let pct = 0;
  if (unitHasBranch(attacker, "reeps_rail_lance") && defender.path === "tank") pct += RAIL_LANCE_DEF_IGNORE_PCT;
  if (unitHasSystem(attacker, "ordnance_shredder_rounds")) pct += SHREDDER_ROUNDS_DEF_IGNORE_PCT;
  return Math.min(0.9, pct);
}

/** Overpressure Regulator — x1.4 on the first basic attack of the mission, 1 after it's spent (engine/mission.ts's attack verb marks `overpressureSpent`). */
export function firstAttackMultiplier(attacker: BattleUnit): number {
  return unitHasSystem(attacker, "ordnance_overpressure_regulator") && !attacker.overpressureSpent ? OVERPRESSURE_REGULATOR_FIRST_ATTACK_MULT : 1;
}

/** Field Repair Kit (reinterpreted, see data/frameSystems.ts) — multiplier on this healer's Repair output. */
export function repairOutputMultiplier(healer: BattleUnit): number {
  return unitHasSystem(healer, "support_field_repair_kit") ? FIELD_REPAIR_KIT_OUTPUT_MULT : 1;
}

/**
 * This healer's Repair reach, from every source that changes it, in this
 * order: the base (DEFAULT_REPAIR_RANGE), Rapid Response's own number if
 * that branch is live, then the refit — Vanguard Medic overrides to 1
 * outright, Aid Station adds on top of whatever the branch gave. Replaces
 * the four separate `=== "munti_rapid_response" ? ... : DEFAULT` reads
 * that used to live in engine/mission.ts and src/sim/playerAi.
 */
export function repairRangeFor(healer: BattleUnit): number {
  let range = unitHasBranch(healer, "munti_rapid_response") ? RAPID_RESPONSE_REPAIR_RANGE : DEFAULT_REPAIR_RANGE;
  const refit = unitRefit(healer);
  if (refit?.repairRangeOverride !== undefined) return refit.repairRangeOverride;
  if (refit?.repairRangeDelta) range += refit.repairRangeDelta;
  return range;
}

export interface RegenAura {
  radius: number;
  amount: number;
}

/**
 * Every passive-regen aura this unit projects onto its own side — the
 * Munti's (radius/amount by which of Aegis Ward / Combat Medic is live,
 * exactly the rule tickMuntiRegen used to compute inline) plus a Salve
 * Drone's, on any path. Empty for a unit with neither. tickMuntiRegen
 * (engine/mission.ts) takes the BEST applicable aura across every source
 * in range — the existing no-stacking rule — so a Munti carrying a Salve
 * Drone simply has two auras, of which the Munti's own wins wherever both
 * reach.
 *
 * Two live Munti branches at once (Aegis Ward + Combat Medic on two mounts)
 * merge to the wider radius and the bigger amount — today both radii are
 * MUNTI_REGEN_RADIUS + 1, so that pair is just Combat Medic's numbers.
 */
export function regenAurasFor(unit: BattleUnit): RegenAura[] {
  const out: RegenAura[] = [];
  if (unit.path === "munti") {
    let radius = MUNTI_REGEN_RADIUS;
    let amount = MUNTI_REGEN_PER_TURN;
    if (unitHasBranch(unit, "munti_aegis_ward")) radius = Math.max(radius, AEGIS_WARD_REGEN_RADIUS);
    if (unitHasBranch(unit, "munti_combat_medic")) {
      radius = Math.max(radius, COMBAT_MEDIC_REGEN_RADIUS);
      amount = MUNTI_REGEN_PER_TURN * COMBAT_MEDIC_REGEN_MULTIPLIER;
    }
    out.push({ radius, amount });
  }
  if (unitHasSystem(unit, "support_salve_drone")) out.push({ radius: SALVE_DRONE_RADIUS, amount: SALVE_DRONE_REGEN_PER_TURN });
  return out;
}

/** Wellroot Filament — HP this unit regenerates each cycle while on bloom_mat. 0 without it. */
export function matRegenFor(unit: BattleUnit): number {
  return unitHasSystem(unit, "salvage_wellroot_filament") ? WELLROOT_FILAMENT_MAT_REGEN : 0;
}

/** Sealed Cockpit — true if bloom_mat's turnStartDamage skips this unit. */
export function immuneToMatAcid(unit: BattleUnit): boolean {
  return unitHasSystem(unit, "frame_sealed_cockpit");
}

/**
 * Ram Frame — whether a move of `tilesMoved` tiles counts as a charge for
 * this unit. engine/mission.ts's moveUnit ORs this with the centauroid's
 * own straight-line rule; both feed the same chargedThisMove flag and the
 * same CENTAUROID_CHARGE_MULT.
 */
export function ramFrameCharges(unit: BattleUnit, tilesMoved: number): boolean {
  return unit.frameRefitId === "refit_tank_ram_frame" && tilesMoved >= RAM_FRAME_CHARGE_MIN_TILES;
}

/** Battery Frame — true if this unit is refused an attack because it already moved this turn (any distance — `tilesMovedThisTurn` > 0). */
export function cannotAttackAfterMoving(unit: BattleUnit): boolean {
  return unit.frameRefitId === "refit_reeps_battery_frame" && (unit.tilesMovedThisTurn ?? 0) > 0;
}

/**
 * Stabilizer Struts — how many tiles this unit may have moved this turn and
 * still count as "did not move" for a Fieldwright mek's stationary repair
 * (engine/mission.ts's tickStationaryRepair). 0 without the system: the
 * GDD's own rule is strictly "when they did not move."
 */
export function stationaryRepairMoveAllowance(unit: BattleUnit): number {
  return unitHasSystem(unit, "support_stabilizer_struts") ? STABILIZER_STRUTS_MOVE_ALLOWANCE : 0;
}
