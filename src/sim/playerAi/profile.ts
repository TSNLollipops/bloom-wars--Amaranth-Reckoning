// src/sim/playerAi/profile.ts
// The Player AI's "settings sheet" — claude/Bloom_Wars_Player_AI_Difficulty_
// Tiers_Plan_v1.md §3.1 (1 Sep 2026). Every knob index.ts/combat.ts/
// support.ts used to read as a module-level constant now comes from one of
// these objects, and every heuristic a tier can switch off is a boolean
// here. Three presets: EASY (a first-time player), MODERATE (a competent
// one — this is the old bot's discipline plus the abilities it never used),
// HARD (a veteran who reads enemy reach before every move — see hard.ts).
// LEGACY is MODERATE with honestVision off and no abilities: byte-for-byte
// the bot as it stood before this pass, kept so every batch number the
// project recorded before 1 Sep 2026 can still be reproduced for
// comparison (`npm run sim:batch -- 20 --tier=legacy`).
//
// Anchoring, Maxime's own words (1 Sep 2026): "xcom is the benchmark.
// mission should feel as hard as xcom missions" and "I want the mission to
// be hard and player have loss in them. Especially at hard." The tiers
// exist to stand in for real players at three skill levels so mission
// difficulty can be read as a (easy%, moderate%, hard%) fingerprint —
// see the plan's §6 and sim/runBatch.ts.
import type { PlayerAiTier } from "./types";

export interface PlayerAiProfile {
  tier: PlayerAiTier;
  /** Below this HP fraction, an ordinary unit prefers disengaging over a non-lethal fight. */
  retreatHpFraction: number;
  /** The commander's / Munti's own, higher retreat bar (only read when protectVips is on). */
  commanderRetreatHpFraction: number;
  /** An ally in repair range under this fraction interrupts anything but a guaranteed kill. */
  criticalAllyHpFraction: number;
  /** An ally in repair range under this fraction is worth a routine top-up over chip damage. */
  routineAllyHpFraction: number;
  /** Squad-shared weakest-target focus fire (off = each unit shoots the nearest thing it can hurt). */
  focusFire: boolean;
  /** Front-line cap + raised retreat bar for the commander and the Munti. */
  protectVips: boolean;
  /** cohesiveMoveToward's leash (off = every unit sprints toward its own target). */
  squadCohesion: boolean;
  /** A Munti with nobody to heal in range will walk to a hurt ally when it can do so safely. */
  repairPathing: boolean;
  /**
   * Only target hostiles the player side can actually SEE (the same
   * unitsVisibleToSide check scenes/Battle.ts uses to draw them). The
   * pre-1-Sep bot had full board awareness — it could and did attack
   * burrowed/concealed units no human could target — which is the one
   * "cheat" every tier gives up so the numbers mean something. Off only in
   * LEGACY.
   */
  honestVision: boolean;
  /** Hard only: remember where a hostile was last seen and treat it as a threat until it's seen elsewhere. */
  rememberLastSeen: boolean;
  /** Which abilities this tier will use at all (missing = never). */
  useAbilities: Partial<Record<PlayerAiAbility, boolean>>;
  /** Hard only: score positions against a real threat map (engine/threat.ts) instead of the reach-count proxy. */
  threatMap: boolean;
  /** Hard only, test-only: ask engine/ai.ts's decideHostileAction what the enemy would actually do against a candidate board. Off for any PvP use. */
  hostileOracle: boolean;
  /** Hard only: the commander / Munti never END a turn on a tile where the predicted incoming reaches this fraction of MAX HP (tightened to 60% of current HP once hurt — hard.ts dangerThreshold); line units use "would this kill me." */
  preemptiveRetreatFraction: number;
  /** Easy only: chance per decision that the bot takes its second-best option instead of its best. Needs the seeded rng. */
  mistakeChance: number;
  /** Sensor Sweep: minimum turns between sweeps by the same unit (charges are precious). */
  sweepCooldownTurns: number;
  /** Taunt: the taunter refuses if this many or more enemies could reach it next turn. */
  tauntMaxThreats: number;
  /** Taunt: minimum HP fraction the taunter itself must have. */
  tauntMinHpFraction: number;
  /** Fire Support / Missile: minimum hostiles inside the blast to spend a charge (a boss counts as this many on its own). */
  strikeMinTargets: number;
}

export type PlayerAiAbility =
  | "abil_repair"
  | "abil_clear_bloom"
  | "abil_screen"
  | "abil_sensor_sweep"
  | "abil_interdict"
  | "overwatch"
  | "abil_ambush"
  | "abil_taunt"
  | "abil_fire_support"
  | "abil_missile"
  | "rescue";

const ALL_ABILITIES: Record<PlayerAiAbility, boolean> = {
  abil_repair: true,
  abil_clear_bloom: true,
  abil_screen: true,
  abil_sensor_sweep: true,
  abil_interdict: true,
  overwatch: true,
  abil_ambush: true,
  abil_taunt: true,
  abil_fire_support: true,
  abil_missile: true,
  rescue: true,
};

/** The pre-1-Sep bot: full awareness, repair/clear/screen(narrow)/rescue only, nothing else. Numbers on record before this date were measured against exactly this. */
export const LEGACY: PlayerAiProfile = {
  tier: "legacy",
  retreatHpFraction: 0.3,
  commanderRetreatHpFraction: 0.5,
  criticalAllyHpFraction: 0.4,
  routineAllyHpFraction: 0.85,
  focusFire: true,
  protectVips: true,
  squadCohesion: true,
  repairPathing: false,
  honestVision: false,
  rememberLastSeen: false,
  useAbilities: { abil_repair: true, abil_clear_bloom: true, abil_screen: true, rescue: true },
  threatMap: false,
  hostileOracle: false,
  preemptiveRetreatFraction: 0.6,
  mistakeChance: 0,
  sweepCooldownTurns: 2,
  tauntMaxThreats: 2,
  tauntMinHpFraction: 0.7,
  strikeMinTargets: 2,
};

/** A competent player who has learned the systems: the LEGACY discipline, fog-honest, using every ability on its obvious trigger. */
export const MODERATE: PlayerAiProfile = {
  ...LEGACY,
  tier: "moderate",
  honestVision: true,
  repairPathing: true,
  useAbilities: { ...ALL_ABILITIES },
};

/** A first-time player: nearest thing, shoot it, retreat too late, no squad discipline, no abilities but the odd adjacent repair (and the objective button) — and a real chance of a plain mistake. */
export const EASY: PlayerAiProfile = {
  ...MODERATE,
  tier: "easy",
  retreatHpFraction: 0.15,
  commanderRetreatHpFraction: 0.15,
  criticalAllyHpFraction: 0.25,
  routineAllyHpFraction: 0.5,
  focusFire: false,
  protectVips: false,
  squadCohesion: false,
  repairPathing: false,
  // Repair, the rescue pickup, and Clear Bloom — the last because it IS
  // the objective on a clear_bloom mission, and a player who never presses
  // the objective button isn't a player, it's a stall.
  useAbilities: { abil_repair: true, rescue: true, abil_clear_bloom: true },
  mistakeChance: 0.2,
};

/** A veteran: MODERATE plus the threat map, last-seen memory, the hostile oracle (test-only), pre-emptive retreat, and the squad planner — see hard.ts / engine/threat.ts. */
export const HARD: PlayerAiProfile = {
  ...MODERATE,
  tier: "hard",
  rememberLastSeen: true,
  threatMap: true,
  hostileOracle: true,
  preemptiveRetreatFraction: 0.6,
  sweepCooldownTurns: 1,
  tauntMaxThreats: 3,
  tauntMinHpFraction: 0.6,
};

export const PROFILES: Record<PlayerAiTier, PlayerAiProfile> = { easy: EASY, moderate: MODERATE, hard: HARD, legacy: LEGACY };

export function profileForTier(tier: string | undefined): PlayerAiProfile {
  if (!tier) return MODERATE;
  const p = PROFILES[tier as PlayerAiTier];
  if (!p) throw new Error(`Unknown Player AI tier "${tier}" — expected one of ${Object.keys(PROFILES).join(", ")}`);
  return p;
}
