// src/sim/playerAi/types.ts
// Shared types for the Player AI engine — see index.ts's own header for
// what this module is (and isn't) and why it's split into its own
// directory. Broken out so combat.ts/support.ts don't need to import from
// index.ts and risk a cycle.
import type { Coord } from "../../data/types";

export interface PlayerAiDecision {
  path?: Coord[]; // full path incl. start; last element is the move destination
  attackTargetId?: string;
  repairTargetId?: string; // must already be in repair range (branch-aware — DEFAULT_REPAIR_RANGE, or RAPID_RESPONSE_REPAIR_RANGE for Rapid Response) when returned — see support.ts
  /**
   * Objective-awareness pass (25 Aug 2026, Phase 1/2 of
   * claude/Bloom_Wars_Player_AI_Ability_And_Objective_Plan_v1.md — Maxime:
   * "keep the plan in mind do what you recommend"). Two verbs from that
   * pass — `clear_bloom` (Munti clears bloom_mat in place, same
   * heal-in-place contract as repairTargetId above — see combat.ts's
   * hasClearableBloomNearby) and `rescue` (pick up an adjacent, uncarried
   * rescuable NPC — engine/mission.ts's rescueUnit).
   *
   * `screen` added same day, Maxime: "add screen too. its probably why
   * mission 3 still fail sometimes" — the Munti puts up abil_screen
   * (engine/mission.ts's screenAllies) instead of attacking. Deliberately
   * the narrowest possible heuristic, not the general "screen whenever
   * useful" judgment call the plan's own Phase 4 sketched: index.ts's
   * use_screen branch only fires for a Munti in a clear_bloom firing line
   * that's actually been spotted, with the once-per-mission charge still
   * unspent — see that branch's own comment for the reasoning.
   *
   * run.ts's dispatch calls the matching real Mission verb for each of the
   * three; this module itself never mutates anything, same as every other
   * field here. The rest of the plan's original verb sketch
   * (ambush/interdict/sensor_sweep/taunt) is still Phase 3+, not built yet —
   * see that doc's own staging table.
   *
   * `taunt` added 30 Aug 2026 (Player AI hardening pass — see combat.ts's
   * "Guard Taunt" section): a non-protected Meeps with an unspent
   * abil_taunt charge draws hostile fire off an exposed commander/Munti.
   * Same "run.ts/runBatch.ts call the matching real Mission verb" contract
   * as the three above — dispatched to Mission.taunt(unitId).
   */
  action?: "clear_bloom" | "rescue" | "screen" | "taunt";
}

/**
 * Phase 1 architecture change — a narrow, read-only slice of
 * engine/mission.ts's real Mission class, shaped to match it exactly
 * (`mission.mission.objective`, `mission.map.holdZone`) so a live Mission
 * instance satisfies this structurally with no adapter object: run.ts just
 * passes `m` itself. Deliberately NOT importing Mission's own type here —
 * see index.ts's file header for why this module stays a translation
 * exercise rather than a hard dependency, and see the objective-awareness
 * section below for why this ended up narrower than the original plan
 * sketched: canClearBloom/canRescue-style ability gates turned out to be
 * checkable directly off `unit`/`map` without a Mission reference at all
 * (see combat.ts's hasClearableBloomNearby and support.ts's
 * findAdjacentRescuableNpc/findRescuableNpcOnBoard) — the one thing that
 * genuinely can't be inferred from board state alone is which objective
 * this mission actually has (bloom_mat appears as plain damage terrain on
 * at least one eliminate_all map, MISSION_1A, with no clear_bloom objective
 * attached at all), so that's the one thing this context actually carries.
 */
export interface PlayerAiMissionContext {
  // "survive_n_turns" added 25 Aug 2026 (Mission 9 "Cut Off," data/types.ts's
  // CampaignMission.objective) — no branch in index.ts reads it yet (that
  // objective has no dedicated Player AI heuristic, see this mission
  // context's own module header), but the literal has to be here or a live
  // Mission's real `.objective` value stops satisfying this type
  // structurally the moment that mission exists.
  //
  // "contested_landing" added 25 Aug 2026 (Mission 15 "Landfall") — same
  // situation as survive_n_turns: mechanically identical to eliminate_all
  // (see data/types.ts's own comment), so the existing eliminate_all-shaped
  // fallthrough (ordinary combat chain, no dedicated branch) is already the
  // right Player AI behavior for it. Literal added purely for structural
  // typing.
  readonly mission: {
    readonly objective: "eliminate_all" | "hold_zone" | "extract_unit" | "clear_bloom" | "survive_n_turns" | "contested_landing" | "protect_asset";
    readonly objectiveParams: { extractUnitId?: string };
    readonly bonusObjective?: { kind: "rescue_pilot" } | { kind: "clear_bloom_patch" };
  };
  readonly map: { holdZone?: Coord[]; exitTiles?: Coord[] };
}

export type PlayerAiReason =
  | "kill" // a reachable target dies to this attack this turn
  | "repair_critical_ally" // an ally in repair range is hurt badly enough to interrupt anything else, even this unit's own self-preservation
  | "repair_ally" // an ally in repair range is hurt enough to be worth healing instead of chip-damaging a target that isn't dying this turn anyway
  | "clear_bloom" // Munti-only, objective-gated: cleared bloom_mat in place instead of attacking — see index.ts's clear_bloom branch
  | "use_screen" // Munti-only, objective-gated, spotted, charge unspent: put up abil_screen instead of attacking — see index.ts's use_screen branch
  | "guard_taunt" // a non-protected Meeps with an unspent abil_taunt charge draws hostile fire off an exposed commander/Munti — see index.ts's guard_taunt branch and combat.ts's "Guard Taunt" section
  | "focus_weak" // attacked the weakest in-range target (no kill, no repair, available)
  | "advance_into_range" // moved to close distance, attacking on arrival if possible
  | "seek_rescue" // heading toward an uncarried rescuable NPC (bonus objective) — not yet adjacent
  | "rescue_pickup" // adjacent to an uncarried rescuable NPC — picked them up
  | "rescue_carry" // already carrying the rescued NPC — heading for the nearest exit tile, combat unavailable while carrying
  | "hold_zone" // objective is hold_zone — converging on (or holding) the nearest zone tile instead of chasing a kill
  | "extract_to_exit" // this unit IS the extract_unit objective's named target — heading for the nearest exit tile instead of chasing a kill
  | "escort_to_exit" // extract_unit mission, this unit is NOT the named target, nothing else to do — converging on the exit too, so it doesn't freeze and deadlock the target's own cohesion cap (see index.ts's own comment)
  | "seek_fight" // nothing in range yet, closing distance on the weakest target (cohesion-capped — see combat.ts's cohesiveMoveToward)
  | "regroup_low_hp" // low HP, unspotted, no kill/repair available — closing on the nearest living ally instead of chasing the enemy alone
  | "retreat_low_hp" // below RETREAT_HP_FRACTION with no kill available — fell back
  | "hold_cornered" // wanted to retreat but nowhere safer was reachable — fought anyway
  | "hold_no_target"; // no living enemies at all

export interface PlayerAiLogEntry {
  turn: number;
  unitId: string;
  displayName: string;
  hpFraction: number;
  reason: PlayerAiReason;
  targetId?: string;
  targetName?: string;
  destination?: Coord;
  note?: string;
}
