// src/sim/playerAi/types.ts
// Shared types for the Player AI engine — see index.ts's own header for
// what this module is (and isn't) and why it's split into its own
// directory. Broken out so combat.ts/support.ts don't need to import from
// index.ts and risk a cycle.
import type { Coord } from "../../data/types";

export interface PlayerAiDecision {
  path?: Coord[]; // full path incl. start; last element is the move destination
  attackTargetId?: string;
  repairTargetId?: string; // must already be adjacent when returned — see support.ts
}

export type PlayerAiReason =
  | "kill" // a reachable target dies to this attack this turn
  | "repair_critical_ally" // an adjacent ally is hurt badly enough to interrupt anything else, even this unit's own self-preservation
  | "repair_ally" // an adjacent ally is hurt enough to be worth healing instead of chip-damaging a target that isn't dying this turn anyway
  | "focus_weak" // attacked the weakest in-range target (no kill, no repair, available)
  | "advance_into_range" // moved to close distance, attacking on arrival if possible
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
