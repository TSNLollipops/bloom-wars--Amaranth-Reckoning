// src/sim/playerAi/types.ts
// Shared types for the Player AI engine — see index.ts's own header for
// what this module is (and isn't) and why it's split into its own
// directory. Broken out so combat.ts/support.ts don't need to import from
// index.ts and risk a cycle.
import type { Coord } from "../../data/types";
import type { ThreatMap } from "../../engine/threat";

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
  action?: PlayerAiAction;
  /** For "fire_support" / "missile": the tile to strike. */
  targetTile?: Coord;
}

/**
 * Every verb the driver (sim/driveMission.ts) can dispatch. The first four
 * predate the tiers pass; the rest landed 1 Sep 2026 with the Player AI
 * Difficulty Tiers Plan §4 — each maps 1:1 onto an existing Mission verb
 * (ambush → Mission.ambush, and so on).
 */
export type PlayerAiAction =
  | "clear_bloom"
  | "rescue"
  | "screen"
  | "taunt"
  | "sensor_sweep"
  | "interdict"
  | "overwatch"
  | "ambush"
  | "fire_support"
  | "missile";

export type PlayerAiTier = "easy" | "moderate" | "hard" | "legacy";

/**
 * Per-run scratch memory (1 Sep 2026, tiers pass) — the one thing a pure
 * per-decision function can't carry: "did I already sweep two turns ago,"
 * "where did that Undertow burrow." Created once per mission by the
 * driver and handed to every decision; never persisted. `rng` is the
 * run's seeded random source (sim/rng.ts) so an Easy bot's deliberate
 * mistakes replay identically for the same seed.
 */
export interface PlayerAiMemory {
  rng: () => number;
  lastSweepTurn: Map<string, number>;
  lastTauntTurn: Map<string, number>;
  lastStrikeTurn: number;
  /** Hard only: last known position of a hostile that is not currently visible, keyed by instanceId. */
  lastSeen: Map<string, Coord>;
  /** Hard only: the squad planner's committed positions for allies that have already decided this turn. */
  plannedPositions: Map<string, Coord>;
  /** Hard only: this turn's threat map (engine/threat.ts), rebuilt when `threatStamp` no longer matches the board — see hard.ts's threatMapFor. */
  threat?: ThreatMap;
  threatStamp?: string;
  /** Hard only: consecutive turns a unit's threat-trimmed advance made no progress — after two, it commits (hard.ts's stalemate breaker). */
  stalledTurns: Map<string, number>;
  /** Hard only (driveMission.ts): VIPs (commander / Munti) that have NOT yet decided this turn. A unit deciding before them assumes they will get out of reach (they retreat past their bar), so their current tiles don't count as fire-drawing positions in its own estimate — the first-cut Hard bot's Munti died in Mission 12 to exactly that: the commander decided last, retreated, and every hostile she'd been "absorbing" in the Munti's estimate turned on the Munti. */
  pendingVips: Set<string>;
  /** Squad stall breaker (driveMission.ts): consecutive turns the board didn't change at all — nobody moved, nothing took damage. */
  squadStallTurns: number;
  /** Set by the driver for the turn after squadStallTurns reaches its limit: caution and hold-in-place postures (overwatch / interdict / ambush, Hard's bars) are suspended so the squad engages. Any tier can stall on a hostile line that doesn't see it. */
  commitThisTurn: boolean;
}

export function createPlayerAiMemory(rng: () => number = Math.random): PlayerAiMemory {
  return { rng, lastSweepTurn: new Map(), lastTauntTurn: new Map(), lastStrikeTurn: -99, lastSeen: new Map(), plannedPositions: new Map(), stalledTurns: new Map(), pendingVips: new Set(), squadStallTurns: 0, commitThisTurn: false };
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
    readonly objectiveParams: { extractUnitId?: string; holdUntilTurn?: number };
    readonly bonusObjective?: { kind: "rescue_pilot" } | { kind: "clear_bloom_patch" };
  };
  readonly map: { holdZone?: Coord[]; exitTiles?: Coord[] };
  /** Squad-shared Fire Support charges (tiers pass, 1 Sep 2026) — Mission's own public field; optional so hand-built test contexts still type-check. */
  readonly fireSupportChargesRemaining?: number;
  /** Mission.fireSupportBonusChargeReady — the Weapons Bay's reserve line. Optional for the same reason. */
  readonly fireSupportBonusChargeReady?: () => boolean;
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
  | "retreat_gang_up" // front-line-protected (commander/Munti), still above the HP threshold, but GANG_UP_THRESHOLD+ visible enemies could reach and attack next turn — fell back pre-emptively rather than waiting to actually get hit first, see combat.ts's own "Gang-up retreat" section
  | "hold_cornered" // wanted to retreat but nowhere safer was reachable — fought anyway
  | "hold_no_target" // no living enemies at all
  // ---- tiers pass, 1 Sep 2026 (Player AI Difficulty Tiers Plan §4/§5) ----
  | "sensor_sweep" // a hidden or unseen hostile is in sweep reach and no target is otherwise in anyone's range — painted it
  | "interdict" // Tank with nothing to shoot and a hostile able to close to adjacency next turn — braced
  | "overwatch" // nothing to shoot, a hostile can end its move inside my range next turn — held a reaction shot
  | "ambush" // Meeps, unseen, an enemy within striking distance next turn — cloaked for the 2x decloak strike
  | "fire_support" // a cluster (or a boss / a VIP threat) inside one 3x3 in vision — called it in
  | "missile" // same, with the Reeps' own splash, no friendly in the blast
  | "repair_move" // Munti walked into repair range of a hurt ally and healed (repairPathing)
  | "explore" // fog-honest and nothing visible — moved toward the nearest enemy spawn seam / deploy zone
  | "preempt_retreat" // Hard: predicted incoming on my tile was lethal-ish — moved before it landed
  | "mistake"; // Easy: took the second-best option on purpose (mistakeChance)

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
