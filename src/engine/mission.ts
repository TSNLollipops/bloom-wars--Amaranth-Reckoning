// src/engine/mission.ts
// The turn manager / mission orchestrator (Build Brief steps 5, 8, 9's
// consumer). Owns turn order, the environment step, mission-event wiring,
// win/loss evaluation, and is the single surface both src/sim and the
// Phaser Battle scene call into — so the rules only exist once.
import type {
  CampaignMission,
  Coord,
  EnemyWave,
  MapDefinition,
  MekArchetype,
  PilotRecord,
  RescuePilotBonusObjective,
  TileType,
} from "../data/types";
import type { Rank } from "./campaignState";
import { ALL_MAPS as MAPS } from "../data/mapRegistry";
import { createPlayerUnit, createHostileMechUnit, createBloomUnit, createRescuableNpcUnit, createCivilianUnit, type BattleUnit, type OnHitEffectKind, type Side } from "./units";
import { findPilot } from "../data/pilotRegistry";
import {
  reachableTiles,
  reconstructPath,
  coordKey,
  coordsEqual,
  chebyshevDistance,
  tileAt,
  isStraightLineCharge,
  neighbors4,
  inBounds,
  isPassable,
  type MovementKind,
} from "./grid";
import {
  movementKindOf,
  unitHasBranch,
  repairRangeFor,
  repairOutputMultiplier,
  regenAurasFor,
  matRegenFor,
  immuneToMatAcid,
  ramFrameCharges,
  cannotAttackAfterMoving,
  stationaryRepairMoveAllowance,
  unitBranches,
} from "./frameSystems";
import { resolveMechAttack, resolveAttackOnBloom, bloomDamage, applyMechDamage, applyBloomDamage, applyRequiemBloomDamage, tankShieldEligible } from "./combat";
// requiem_severance (Gjallar, Vault Phase 2 slice 7, 3 Sep 2026) — Data Pack
// §11.5's own locked numbers (damage, shape, charge rate), reused rather
// than re-declared as new placeholder constants. See this file's own
// "Vault Phase 2, slice 7" section for the full design.
import { SEVERANCE } from "../data/abilities";
import {
  MEEPS_DODGE_CHANCE,
  TANK_SHIELD_CAPACITY,
  TANK_SHIELD_REGEN_PER_TURN,
  MAX_ACTIONS_PER_TURN,
  SENSOR_SWEEP_RANGE_BONUS,
  SENSOR_SWEEP_CHARGES_PER_MISSION,
  INTERDICT_RADIUS,
  SCREEN_RADIUS,
  AMBUSH_STEALTH_DURATION,
  AMBUSH_DECLOAK_DAMAGE_MULTIPLIER,
  BLOOM_CLEAR_RADIUS,
  BLOOM_REGROWTH_FIRST_TURN,
  BLOOM_REGROWTH_INTERVAL_TURNS,
  BLOOM_REGROWTH_TILES_PER_TICK,
  FIRE_SUPPORT_CHARGES_PER_MISSION,
  FIRE_SUPPORT_RADIUS,
  FIRE_SUPPORT_DAMAGE,
  WEAPONS_BAY_FIRE_SUPPORT_COOLDOWN_TURNS,
  MISSILE_SPLASH_RADIUS,
  MISSILE_CHARGES_PER_MISSION,
  MASER_LANCE_CONE_RANGE,
  MASER_LANCE_CHARGES_PER_MISSION,
  PROTECT_ASSET_DEFAULT_MAX_HP,
  PROTECT_ASSET_TICK_DAMAGE,
  IRON_WORD_RADIUS,
  IRON_WORD_RANK5_RADIUS,
  IRON_WORD_COOLDOWN_TURNS,
  FIELD_TRIAGE_RADIUS,
  FIELD_TRIAGE_RANK5_RADIUS,
  FIELD_TRIAGE_MAX_TARGETS,
  FIELD_TRIAGE_COOLDOWN_TURNS,
  FARSIGHT_SIGNATURE_COOLDOWN_TURNS,
  LEDGER_OVEREXTENDED_RANK5_DURATION_TURNS,
  LEDGER_OVEREXTENDED_COOLDOWN_TURNS,
  LEDGER_ENTRY_MOVE_BONUS_THRESHOLD,
  LEDGER_ENTRY_MOVE_BONUS_AMOUNT,
  OATHKEEPER_DURATION_TURNS,
  OATHKEEPER_RANK5_DURATION_TURNS,
  OATHKEEPER_RANK5_DEFERRED_MULTIPLIER,
  OATHKEEPER_COOLDOWN_TURNS,
  DEADFALL_STRIKE_DAMAGE_MULTIPLIER,
  DEADFALL_STRIKE_COOLDOWN_TURNS,
  CINDER_LINE_MAX_TILES,
  CINDER_LINE_DAMAGE_PER_TURN,
  CINDER_LINE_DURATION_TURNS,
  CINDER_LINE_RANK5_DURATION_TURNS,
  CINDER_LINE_SIGNATURE_COOLDOWN_TURNS,
  CINDER_FIREBREAK_COOLDOWN_TURNS,
  CINDER_DRAFT_DURATION_TURNS,
  CINDER_DRAFT_RANK5_DURATION_TURNS,
  CINDER_DRAFT_COOLDOWN_TURNS,
  CUTTING_ROOM_CHARGE_MAX_LINE_TILES,
  CUTTING_ROOM_CHARGE_FALLOFF_MULTIPLIER,
  CUTTING_ROOM_CHARGE_COOLDOWN_TURNS,
  CUTTING_ROOM_MOMENTUM_MOVE_BONUS,
  CUTTING_ROOM_SURE_FOOTING_DURATION_TURNS,
  CUTTING_ROOM_SURE_FOOTING_RANK5_DURATION_TURNS,
  CUTTING_ROOM_SURE_FOOTING_COOLDOWN_TURNS,
  LAST_WORD_SIGNATURE_HP_MULTIPLIER_RANK1,
  LAST_WORD_SIGNATURE_HP_MULTIPLIER_RANK5,
  LAST_WORD_SIGNATURE_COOLDOWN_TURNS,
  LAST_RITES_ACTIONS_GRANTED,
  LAST_RITES_COOLDOWN_TURNS,
  SEAL_BORROWED_AUTHORITY_COOLDOWN_TURNS,
  SEAL_LEDGERHALL_STATIC_COOLDOWN_TURNS,
  SEAL_LEDGERHALL_STATIC_JAM_DURATION_TURNS,
  SEAL_LEDGERHALL_STATIC_ABILITY_PRIORITY,
  SEAL_INHERITED_WEIGHT_DEF_BONUS_MIN_RANK1,
  SEAL_INHERITED_WEIGHT_DEF_BONUS_MAX_RANK1,
  SEAL_INHERITED_WEIGHT_DEF_BONUS_MIN_RANK5,
  SEAL_INHERITED_WEIGHT_DEF_BONUS_MAX_RANK5,
  BEACON_MAX_PER_MISSION,
} from "../data/combatTables";
import { TILES } from "../data/tiles";
// Forward Battery, 2 Sep 2026 — the one carrier module the engine reads.
import { FORWARD_BATTERY_FIRE_SUPPORT_RADIUS, type CarrierModuleId } from "../data/carrierModules";
import { BLOOM, BLOOM_ON_HIT_EFFECTS } from "../data/bloom";
import { applyBloomOnHitEffect, applyCopiedOnHitEffect, applyMechOnHitEffect, isStunned, tickStatusEffects } from "./turnManager";
import {
  GRINDER_CLAW_HEAL_PCT,
  FIELD_DOCTOR_COOLDOWN_TURNS,
  SCATTERSHOT_PISTOLS_CLEAVE_PCT,
  WEAPON_BRANCH_ON_HIT_EFFECT,
} from "../data/weaponBranches";
import { decideHostileAction, decideCivilianAction, isVisibleTo, unitsVisibleToSide } from "./ai";
import {
  createEventRuntimeState,
  evaluateTurnStart,
  evaluateZoneEntered,
  evaluateUnitDowned,
  evaluateObjectiveComplete,
  type EventRuntimeState,
} from "./events";
import { evaluatePermadeathCheck, type ReservedBayId } from "./campaignState";
import { isCooldownReady, startCooldown, cooldownTurnsRemaining } from "./cooldown";

// "commander_down" (25 Aug 2026 — see Mission.handleDowned() below for
// where this actually gets set) is its own distinct outcome, not a flavor
// of "loss": Independent Campaign doc §6a, Maxime's own words, "the mc
// only has plot armor becasuse if she dies the missions failed and its
// back to mission briefing." A normal loss still runs the permadeath
// check, still (potentially) costs pilots, still reaches Debrief for
// scoring. commander_down does none of that — see the field/method
// comments below for exactly what it skips and why.
export type MissionOutcome = "ongoing" | "win" | "loss" | "commander_down";
export type MissionPhase = "player" | "hostile" | "environment";

/**
 * Transporter-pad squad-selection pass (22 Aug 2026, scenes/TransporterPad.ts
 * + engine/campaignState.ts's recruit system): one resolved deploy-roster
 * entry — a pilotId plus the actual PilotRecord/MekArchetype to build the
 * BattleUnit from. Mission's optional constructor param below (deployRoster)
 * is the "real interface change" the deploy-cap task called for: without
 * it, Mission can only ever deploy `mission.playerPilotIds` resolved through
 * the static, build-time data/pilotRegistry.ts — which has no way to
 * resolve a generated recruit (engine/campaignState.ts's generatePilot) at
 * all, and silently ignores any campaign-persistent tier/mek-secondary
 * purchase on a named pilot too. Passing a caller-resolved roster (the
 * transporter pad's own CampaignState read, threaded through
 * scenes/Battle.ts) fixes both at once.
 */
export interface DeployRosterEntry {
  pilotId: string;
  pilot: PilotRecord;
  mek?: MekArchetype;
  // Send-Off tactical payoff (2 Sep 2026) — set by scenes/Battle.ts's
  // resolveDeployRoster when this entry is the pilot CampaignState.
  // preMissionSendOff names. Passed straight through to
  // createPlayerUnit's overrides; see engine/units.ts's BattleUnit.sentOff
  // and data/socialActions.ts's SEND_OFF_DEFENSE_BONUS.
  sendOffBonus?: boolean;
  // Vault Phase 2, slice 1 (2 Sep 2026) — set by scenes/Battle.ts's
  // resolveDeployRoster when this entry's pilot is holding the CampaignState's
  // currently-fielded Heirloom (engine/heirlooms.ts's heirloomForPilot /
  // fieldedHeirloom), to ability id -> current rank for every ability in
  // that Heirloom's kit (engine/heirlooms.ts's abilityRank). Passed straight
  // through to createPlayerUnit's overrides; see engine/units.ts's
  // BattleUnit.heirloomAbilityRanks. Deliberately NOT a HeirloomId or a
  // reference into CampaignState — same flat-resolved-fact shape as
  // sendOffBonus, so mission.ts and units.ts never need to import
  // data/heirlooms.ts at all.
  heirloomAbilityRanks?: Record<string, number>;
}

/**
 * A permanent loss, plus the four facts about HOW the company was standing
 * when it happened.
 *
 * Why these four and not a taxonomy of deaths: there is only one way to die
 * in this game. evaluatePermadeathCheck (engine/campaignState.ts) has
 * exactly one branch that returns `permanent` — "no living Munti remains on
 * this side." Every other downing is a restock. So "how did they die" is
 * always the same answer and carries no information; what actually varies,
 * and what an outside party could reasonably hold the company to account
 * for, is the arrangement the company had in place at that moment. All four
 * are read off state this object already holds at the instant of the
 * downing.
 *
 * Recorded here rather than derived later because the mission that knows
 * them is torn down at Debrief. This project's standing rule is derive,
 * never store (see isReturnedHome in engine/heirlooms.ts, and Mek
 * retirement in campaignState.ts) — the rule holds when the source of truth
 * outlives the question. Here the event being recorded is the thing that
 * destroys its own source, so it has to be written down once, at the one
 * moment anyone can still see it.
 */
export interface PermanentLossRecord {
  pilotId: string;
  reason: string;
  /** Mission turn they went down on. */
  turn: number;
  /**
   * Turns between this side losing its last living Munti and this pilot
   * going down. 0 means the same turn — nobody was ever left to reach them.
   * Higher means the company kept fighting with no lifeline on the board
   * and this pilot was still out there when it caught up with them.
   */
  turnsWithoutMunti: number;
  /**
   * Munti-path pilots this squad launched with. canLaunchMission
   * (campaignState.ts) enforces a floor of 1, so 1 is a legal squad and
   * also the thinnest bet the game allows.
   */
  muntisDeployed: number;
  /** This pilot WAS the Munti — the one who was supposed to bring everyone home. */
  wasLastMunti: boolean;
}

/**
 * lastword_signature (Migawari/The Last Word) — one entry per use, recorded
 * live at the instant the wielder pays the ability's own permanent cost.
 * Mirrors PermanentLossRecord's own reasoning exactly: the Mission object
 * that knows this event is torn down at Debrief, so it has to be written
 * down once, here, at the only moment anyone can still see it.
 * engine/campaignState.ts's applyLastWordSignatureCosts is where this
 * actually lands on the persistent PilotRecord.
 */
export interface LastWordSignatureCostRecord {
  pilotId: string;
  /**
   * Multiplicative factor applied to the wielder's own permanent max-HP
   * multiplier — LAST_WORD_SIGNATURE_HP_MULTIPLIER_RANK1 (0.9) or
   * LAST_WORD_SIGNATURE_HP_MULTIPLIER_RANK5 (0.95). See that constant's own
   * comment in data/combatTables.ts for why multiplicative, not additive.
   */
  hpMultiplier: number;
  /** Mission turn the use happened on — recorded for the same "when did this happen" completeness PermanentLossRecord.turn already gives, not currently read by anything. */
  turn: number;
}

export interface AttackOutcome {
  attackerId: string;
  defenderId: string;
  damage: number;
  countered: boolean;
  counterDamage?: number;
  defenderDowned: boolean;
  attackerDowned?: boolean;
  defenderDodged?: boolean; // Meeps house rule — see data/combatTables.ts MEEPS_DODGE_CHANCE
  counterDodged?: boolean;
  // Runemaster initiative (6 Sep 2026) — the defender's counter landed
  // BEFORE the attacker's own hit; see engine/combat.ts's initiative block.
  defenderStruckFirst?: boolean;
}

/**
 * What forecastAttack() reports before a shot is committed — see that
 * method. Damage numbers are the no-dodge case; the dodge odds are
 * reported alongside so the UI can say "34 dmg (40% dodge)" rather than
 * an expected-value blur nobody can act on.
 */
export interface AttackForecast {
  attackerId: string;
  defenderId: string;
  damage: number;
  dodgeChance: number;
  shieldAbsorbed: number;
  defenderHpAfter: number;
  defenderDowned: boolean;
  countered: boolean;
  counterDamage: number;
  counterDodgeChance: number;
  attackerHpAfter: number;
  decloakStrike: boolean;
  charged: boolean;
  // Runemaster initiative (6 Sep 2026) — the defender would counter BEFORE
  // this hit lands; `damage` is then the post-counter swing (0 if the
  // counter would down the attacker outright). The HUD says so.
  defenderStruckFirst?: boolean;
}

/** One unit caught in a forecast splash — see forecastSplash(). */
export interface SplashForecastEntry {
  unitId: string;
  displayName: string;
  side: BattleUnit["side"];
  damage: number;
  downed: boolean;
}

/**
 * Meeps house rule roll — true MEEPS_DODGE_CHANCE of the time, false for
 * every non-Meeps path (or undefined path, e.g. Bloom). `source` is whoever
 * is dealing THIS specific hit (the attacker for a primary hit, the
 * counter-attacker for a counter-hit) — a Tank source always wins the roll
 * outright (data/combatTables.ts, House rule #1b, 23 Aug 2026): Meeps
 * cannot dodge a hit that came from a Tank, whichever direction it's
 * flying. A Bloom source (attacker.path undefined) is unaffected, same as
 * before this rule existed.
 */
function rollMeepsDodge(unit: BattleUnit, source: BattleUnit, rng: () => number = Math.random): boolean {
  return unit.path === "meeps" && source.path !== "tank" && rng() < MEEPS_DODGE_CHANCE;
}

/** Everything a Mission can be handed beyond its data — see the constructor. */
export interface MissionOptions {
  /**
   * Seeded random source (Player AI Difficulty Tiers Plan §3.3, 1 Sep 2026).
   * The Meeps dodge roll is the ONLY randomness in a battle (grep-confirmed:
   * the on-hit-effects engine, Bloom regrowth, spawn placement and the
   * hostile AI are all deterministic), so injecting this one source makes a
   * whole run replayable from a seed — the headless harness passes
   * mulberry32(seed). Default is a late-bound Math.random (not a captured
   * reference, so a test's vi.spyOn(Math, "random") still takes effect).
   */
  rng?: () => number;
  /**
   * Carrier Upgrade Modules the company has installed (2 Sep 2026,
   * data/carrierModules.ts). Deliberately here rather than as a fifth
   * positional constructor argument next to builtBays: `options` already
   * exists as the extension point, and threading a fifth positional
   * through every existing `new Mission(...)` call site would touch far
   * more code than this one feature earns. Defaults to none installed.
   */
  builtModules?: CarrierModuleId[];
  /**
   * seal_borrowed_authority (Simulacrum/The Stolen Seal, Vault Phase 2
   * slice 6, 3 Sep 2026) — the campaign's own CampaignState.foughtOnHitEffectKinds
   * (engine/campaignState.ts), snapshotted here for the mission's lifetime,
   * same "campaign state doesn't change under an in-progress mission" rule
   * builtBays/builtModules above already follow. Deliberately does NOT
   * include anything fought DURING this same mission — see
   * sealBorrowedAuthority()'s own header for why that's read as the correct
   * boundary, not an oversight. Defaults to none fought, so every existing
   * call site (tests, npm run sim, anywhere that doesn't yet pass this)
   * behaves exactly as before this field existed — sealBorrowedAuthority
   * simply refuses cleanly with nothing to draw from.
   */
  foughtOnHitEffectKinds?: OnHitEffectKind[];
  /**
   * Beacon Control's crate/charge stockpile (claude/Bloom_Wars_Beacon_Restock_Economy_v1.md,
   * built 4 Sep 2026), read from CampaignState.beaconCrates/beaconCharges at
   * construction — same "snapshot for the mission's lifetime" treatment
   * builtModules/foughtOnHitEffectKinds above already get. Defaults to 0/0,
   * deliberately NOT a nonzero placeholder: an existing call site that
   * doesn't pass these (tests, npm run sim, anywhere not yet updated) gets a
   * mission where Beacon Control is correctly unusable for lack of stock,
   * rather than a silently-granted budget nobody paid for — the opposite
   * failure mode from fireSupportChargesRemaining's always-nonzero default,
   * which is fine there because that charge pool was never gated behind a
   * purchased, campaign-persistent stockpile the way this one is.
   */
  beaconCratesRemaining?: number;
  beaconChargesRemaining?: number;
  /**
   * Rourke's own campaign rank (CampaignState.rourkeRank), snapshotted here
   * for Beacon Control's holder gate — see beaconHolderId()'s own header for
   * the 6 Sep 2026 rule it replaced. Defaults to "2nd_lt", which is NOT a
   * "no data" placeholder the way beaconCratesRemaining/beaconChargesRemaining
   * default to 0 — it's the real rank every new campaign actually starts at
   * (createWardenCampaignState's own default), so a call site that doesn't
   * pass this gets the honest answer: Beacon Control correctly locked out
   * until she's promoted, not a silently-granted ability nobody's earned yet.
   */
  rourkeRank?: Rank;
}

export interface RepairOutcome {
  healerId: string;
  targetId: string;
  amount: number;
}

/** abil_sensor_sweep result — see Mission.sensorSweep(). `revealedIds` is instanceIds, and can legitimately be empty (a sweep that finds nothing still costs the action and still spends a charge). */
export interface SensorSweepOutcome {
  sweeperId: string;
  radius: number;
  revealedIds: string[];
  revealedUntilTurn: number;
}

/** abil_screen result — see Mission.screenAllies(). `concealedIds` always includes the Munti itself. */
export interface ScreenOutcome {
  muntiId: string;
  concealedIds: string[];
}

// Campaign economy pass (22 Aug 2026, engine/campaignEconomy.ts):
// per-pilot performance tracking, added to Mission itself since nothing
// tracked anything per-unit before this pass — only mission-wide outcome
// (win/loss) existed. Keyed by pilotId, which for a player unit is always
// identical to its instanceId (units.ts createPlayerUnit's own comment:
// "pilots keep their stable roster id on the board"), so no separate
// instanceId->pilotId resolution is needed.
export interface UnitPerformance {
  damageDealt: number; // raw HP/Endurance-and-Vitality chipped off — kept for UI/telemetry only, NOT a scoring input (see ASSIST_MIN_FRACTION's comment below)
  kills: number; // finishing blows credited — see recordPerformance() below for exactly what counts
  assistCredit: number; // fractional kill-equivalents from assists this mission, summed across events — see recordContribution()/resolveKill()/repairUnit() below
  wasDowned: boolean; // true the instant this pilot is ever downed, latched for the rest of the mission
  // Telemetry pass (1 Sep 2026, claude/Bloom_Wars_Player_Telemetry_Plan_v1.md
  // §3) — two counters the end-of-mission record needs that nothing scored
  // before: damage this pilot TOOK (every hit, counter, splash, tile and
  // DoT tick that reduced their HP or shield), and a tally of each ability
  // they used, keyed by ability id ("abil_repair": 3). Neither feeds the
  // points formula; both are UI/telemetry only, same as damageDealt.
  damageTaken: number;
  abilitiesUsed: Record<string, number>;
}

// Point-formula correction (Maxime, 22 Aug 2026, reading
// Qiraki_Weapons_And_Progression.md's "Scoring system, LOCKED" section for
// the first time against the economy pass above): the canonical rule is
// "an individual's score inside a mission is kills plus assists combined.
// An assist is worth a fraction of a full kill, roughly 10% to 50%
// depending on the actual weight of the action, not a flat half-credit."
// No damage-dealt term exists anywhere in that locked rule — for ANY
// target, not just Bloom — which lines up with Maxime's own note that
// Bloom targets don't have a conventional damage-depletable life pool in
// the books' fiction (they die via discrete destruction of their physical
// form, not gradual damage accumulation), so a "chip away HP for points"
// mechanic never corresponded to anything the source material actually
// does. engine/campaignEconomy.ts's old DAMAGE_POINTS_DIVISOR term is
// removed this pass; damageDealt itself stays on UnitPerformance (useful
// for a future "biggest hit" UI stat) but is never read by the points
// formula again.
//
// The exact mapping from "weight of the action" to a fraction inside the
// 10%-50% band isn't specified in the doc, so the two rules below are
// Maxime's own judgment call, flagged the same way DAMAGE_POINTS_DIVISOR
// used to be:
//   - A COMBAT assist (you damaged a hostile that someone else landed the
//     finishing blow on) scales linearly across the band by your share of
//     the total damage the whole squad dealt to that specific victim —
//     tap it once before someone else does the real work, ~10%; do most
//     of the softening and hand the kill to a teammate, closer to 50%.
//     See resolveKill() below.
//   - A REPAIR assist (the doc's own example: "healing/repair actions
//     count as assists," named as its own flat category rather than tied
//     to a contribution share) is a flat mid-band fraction per successful
//     repair action, not scaled by heal amount — the doc ties "weight of
//     the action" to combat contribution specifically, not to how many HP
//     a given repair restored. See repairUnit() below.
// A Munti's disintegrator weapon (the doc: "their disintegrator weapon...
// earns kill-adjacent credit on purge missions") needs no special-case
// code at all — it's just their attack, already routed through the same
// attack()/recordPerformance() path as every other weapon, so it already
// earns kills/combat-assists exactly like anyone else's hits do.
export const ASSIST_MIN_FRACTION = 0.1;
export const ASSIST_MAX_FRACTION = 0.5;
export const REPAIR_ASSIST_FRACTION = 0.25;

/** Stalled-eliminate_all nudge (27 Aug 2026) — full turn cycles with zero resolved attacks before the one-time flavor line fires. See `turnsWithoutContact`'s own comment for the full reasoning; 10 is deliberately well short of the Playtest Review's own 26-turn stuck case, and comfortably past a normal turn's worth of repositioning. */
export const STALL_NUDGE_TURN_THRESHOLD = 10;

// Data Pack §6's abil_repair: 30 HP base, x1.25 if the Munti's own mek has
// Fieldwright as primary (x1 if secondary or absent — see MEK_TRACK_EFFECTS).
// Read off the unit (engine/units.ts bakes it at deploy from the LIVE mek
// copy) since 6 Sep 2026 — before that this looked the mek up in the static
// pilotRegistry, which never sees a secondary bought mid-campaign. Only
// player pilots carry the field; hostile mechs never get a bonus.
const REPAIR_BASE_HEAL = 30;
function repairHealAmount(healer: BattleUnit): number {
  let mult = healer.repairOutputMult ?? 1;
  // Field Repair Kit (Frame Systems Layer, 6 Sep 2026 — reinterpreted, see
  // data/frameSystems.ts's header): a further multiplier on the output,
  // read off the healer BattleUnit itself rather than the registry above.
  mult *= repairOutputMultiplier(healer);
  return Math.round(REPAIR_BASE_HEAL * mult);
}

/**
 * cinder_line_signature's own hazard state (Vault Phase 2, slice 3, 3 Sep
 * 2026) — a player-PLACED, per-line-instance burning hazard, tracked on
 * Mission rather than reused/collapsed into data/tiles.ts's `bloom_mat`
 * TileType. Deliberately NOT bloom_mat, on purpose, for two real reasons:
 * (1) bloom_mat is a static per-TileType definition (one flat
 * turnStartDamage, no duration clock, no owner) — Surtr's line needs a
 * duration that counts down and expires, and an ownerId so Firebreak/Draft
 * can find "the wielder's OWN active Surtr line" specifically, neither of
 * which the TileType model has anywhere to live; (2) collapsing the two
 * would make a Surtr line indistinguishable from real Bloom hazard ground —
 * clearBloom()/checkClearBloomPatchComplete()'s own bloom_mat sweep would
 * then treat the wielder's own tactical tool as something to be cleared,
 * and a clear_bloom mission's win condition could resolve (or fail to)
 * depending on whether a player happened to torch a line nearby. Kept as
 * its own array of instances instead, ticked once per environmentStep()
 * cycle (tickSurtrLines(), below) — the exact "once per full round" cadence
 * bloom_mat's own turnStartDamage already established (see
 * engine/turnManager.ts's tickStatusEffects comment) — so the two hazards
 * read identically to a player standing on either one (flat, unmitigated
 * damage, no defense/cover interaction) without sharing any state.
 */
export interface SurtrLine {
  /** The wielder's BattleUnit.instanceId at the moment this line was placed. cinder_line_signature's cooldown (5 turns) is longer than even its rank-5 duration (4 turns), so a single wielder can never have two lines active at once — canFirebreak/canDraft below both rely on that invariant ("the wielder's OWN active line," singular in the ability's own prose) rather than asking the player to disambiguate among several. */
  ownerId: string;
  /** Captured at creation rather than re-derived live via unitById(ownerId).side — the environment tick (tickSurtrLines) needs "which side is friendly to this line" to stay correct even in the edge case the owner is later removed from `units` (permadeath cleanup, if that's ever added) while the line it placed is still burning out its own clock. */
  ownerSide: Side;
  /** Up to CINDER_LINE_MAX_TILES coordinates, in cast order from the tile nearest the wielder outward — see getCinderLineAreaFrom/cinderLineSignature below for how a click resolves into this list. */
  tiles: Coord[];
  /** Environment-step ticks left, including the one about to fire — decremented AFTER this tick's damage is applied (tickSurtrLines), so a line cast with turnsRemaining=3 deals exactly 3 ticks of damage before it's removed, matching "burning for 3 turns" read as three tile-damage events, not two. */
  turnsRemaining: number;
  /** CINDER_LINE_DAMAGE_PER_TURN, copied in at creation (rank 5 doesn't change it, but every other ranked value on this record is captured the same way — a snapshot at cast time, immune to a mid-mission rank purchase that can't happen anyway since ranks are bought between missions). */
  damagePerTurn: number;
  /** cinder_draft's own clock. 0 means no immunity window is currently open — a friendly unit standing on this line takes full damage, same as a hostile does. While > 0, a unit whose `side` matches `ownerSide` is skipped by tickSurtrLines' damage loop entirely; every other unit on the tile (any hostile, always) is unaffected by this field regardless of its value — Draft only ever excuses the wielder's OWN side, never the enemy's, matching "Allies moving through a friendly Surtr line take no burn damage." */
  friendlyImmuneTurnsRemaining: number;
}

// The 8 directions a "chosen line" can run — MECHANIC PLACEHOLDER, flagged
// here rather than presented as spec: nothing in data/heirlooms.ts or the
// plan doc actually defines how a player picks "a chosen line of up to 5
// tiles," because no line-targeting UI has ever been built in this codebase
// (Requiem/Gjallar, the one other "line attack" this file's own header
// mentions, is itself unbuilt — see this file's header comment above and
// data/heirlooms.ts's `requiem` entry). getFireSupportAreaFrom/
// getMissileAreaFrom (this file, above) are this codebase's only existing
// multi-tile-target precedents, and both are "click one tile, area resolves
// around/at it" — neither is a line shape. Chosen fallback, honestly a
// judgment call and not a transcription: a straight line, 8-directional
// (cardinal AND diagonal — Chebyshev distance, matching how attackRange/
// vision/fireSupport already measure range on this grid, per grid.ts's own
// "distance-for-range checks use Chebyshev" comment; NOT 4-directional the
// way actual movement/knockback are, since those are about physically
// stepping across tiles and this is about where a blast radius reaches),
// starting from the tile ADJACENT to the wielder (not the wielder's own
// tile — a length-0 "line" would be meaningless, and starting one step out
// reads closer to "a line of fire FROM the wielder" than "the wielder is
// always standing in their own blast"). One click sets both direction and
// length at once: clicking the Nth tile out in a given direction ignites
// every tile from 1..N in that direction, the same "one click, engine
// resolves the whole affected set" shape fireSupport/missile already use,
// just with a path instead of a radius.
const CINDER_LINE_DIRECTIONS: Coord[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
];

// The 4 directions cutting_room_charge (Zanretsu) can run — CARDINAL ONLY,
// deliberately NOT CINDER_LINE_DIRECTIONS' 8-directional set just above,
// even though Cinder Line's own line-targeting is this engine's closest
// existing "pick a direction, click the endpoint" precedent and the task
// that produced this pass specifically suggested reusing it. Flagged as a
// real, reasoned divergence, not an oversight:
//
// Cinder Line places a static hazard on tiles — fire doesn't care whether
// the grid's movement model is 4- or 8-directional, so an 8-way blast shape
// is a free, harmless design choice. cutting_room_charge actually MOVES the
// wielder's mech across the board ("move through and strike"), and this
// engine's real movement system is 4-directional only — grid.ts's own
// CARDINAL comment says so explicitly ("the grid is a tactics grid, not a
// hex/8-dir board"), and isStraightLineCharge (grid.ts), the ALREADY-BUILT
// centauroid straight-line charge this exact pilot's chassis already
// triggers on an ordinary Move, enforces the identical constraint in its
// own dx/dy check ("diagonals aren't a straight cardinal line here").
// Zanretsu's charge is thematically that same centauroid charge, turned
// into a strike-everything action instead of a move-then-attack one — so it
// inherits that mechanic's own cardinal-only shape rather than borrowing
// Cinder Line's blast-shape one. A unit physically cannot walk a diagonal
// "straight line" on this grid; letting the charge pretend otherwise would
// be the one ability in the game whose movement rule doesn't match how
// movement actually works everywhere else.
const CUTTING_ROOM_CHARGE_DIRECTIONS: Coord[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export class Mission {
  readonly mission: CampaignMission;
  readonly map: MapDefinition;
  // Transporter-pad squad-selection pass: who actually deployed this
  // mission. Equal to `mission.playerPilotIds` whenever the constructor's
  // optional `deployRoster` arg is omitted (every existing call site —
  // tests, npm run sim, and scenes/Battle.ts's own no-selection fallback),
  // so nothing downstream that already reads this shape breaks. Once a
  // real DeployRosterEntry[] is passed in, this is the player's real,
  // possibly-smaller-or-reordered selection instead. engine/campaignEconomy.ts
  // reads THIS field, not mission.playerPilotIds directly, for computing
  // personal earnings / the Rourke CO bonus — see that file's own notes.
  readonly deployedPilotIds: string[];
  private readonly deployRoster?: DeployRosterEntry[];
  units: BattleUnit[] = [];
  turn = 1;
  phase: MissionPhase = "player";
  outcome: MissionOutcome = "ongoing";
  // Set together with `outcome` the instant it flips to "commander_down"
  // (Mission.handleDowned() below) — which pilot triggered it, so a scene
  // reading this after the fact (scenes/Battle.ts's own overlay) can name
  // them without hardcoding an id. Looked up the same data-driven way
  // evaluatePermadeathCheck itself resolves the exempt pilot
  // (PilotRecord.exemptFromPermadeath, data/types.ts) rather than assuming
  // it's always pilot_rourke — stays correct if that flag ever moves.
  commanderDownPilotId?: string;
  removedFromRoster: string[] = [];
  // Campaign-persistence pass (engine/campaignState.ts): pilotIds the live
  // Munti-presence permadeath check ruled un-restockable at the moment
  // they went down this mission — "if there a muntie there is restock. no
  // munties no restock," checked fresh at each downing, not a one-way
  // flag. Mirrors removedFromRoster's shape deliberately: both are
  // per-mission signals a future debrief screen reads and applies to the
  // persistent CampaignState (applyPermadeathCheck / the pilot's status
  // field) after the mission ends — this array only records *which*
  // pilots and *why*; it does not itself touch any campaign save data,
  // since Mission has no CampaignState reference and isn't meant to.
  permanentLosses: PermanentLossRecord[] = [];
  /**
   * lastword_signature (Migawari/The Last Word) — one entry per use, live
   * this mission. Same "Mission records, Debrief applies" split as
   * permanentLosses right above; see LastWordSignatureCostRecord's own
   * comment and engine/campaignState.ts's applyLastWordSignatureCosts.
   */
  signatureHpCosts: LastWordSignatureCostRecord[] = [];
  /**
   * Munti-path pilots on the player side at deploy. Latched once in the
   * constructor rather than counted later, because "how thin did you launch"
   * is a fact about the decision the player made at the briefing screen, not
   * about who happened to still be standing when it went wrong.
   */
  muntisDeployed = 0;
  /**
   * The turn the player side lost its last living Munti, latched the first
   * time it becomes true and never overwritten. Undefined while a Munti is
   * still up. A Fabricator redeploy putting one back on the board (not
   * built) would not clear this: the question it answers is "how long has
   * this squad been operating without a lifeline," and the first time that
   * became true is the honest answer to it.
   */
  muntiCollapseTurn?: number;
  // Campaign economy pass — see UnitPerformance's own comment above.
  // Seeded with a zeroed entry for every deployed pilot in
  // deployPlayerUnits() below, so a pilot who does nothing all mission
  // (never attacks, never gets touched) still resolves cleanly to a
  // present, zeroed record rather than an undefined lookup for whoever
  // reads this after the mission ends (engine/campaignEconomy.ts's
  // computeMissionEarnings).
  unitPerformance: Record<string, UnitPerformance> = {};
  /** Telemetry (1 Sep 2026): hostiles downed this mission, by archetype id — "bloom_crawlmass": 4. Written only in resolveKill(). */
  hostileKills: Record<string, number> = {};
  // Per-victim damage contribution this mission — victim BattleUnit
  // instanceId -> (pilotId -> total damage that pilot dealt to it so far).
  // Written by recordContribution(), read and cleared by resolveKill() the
  // moment that victim actually goes down; a victim who's damaged but
  // survives to mission end just keeps an unresolved bucket here, which is
  // correct — no kill happened, so nobody's owed a kill OR an assist for
  // it. See ASSIST_MIN_FRACTION's comment above for why this exists.
  private victimContributions: Record<string, Record<string, number>> = {};
  log: string[] = [];
  // Stalled-eliminate_all nudge (27 Aug 2026, Campaign Playtest Review —
  // "I ran one mission passively for 26 turns with nothing happening...
  // eliminate_all apparently has no proactive 'hunt the player' behavior
  // once contact breaks and no turn-limit fail state either... it means a
  // stalled eliminate_all mission can go on forever with the game giving
  // you no signal that you're stuck. Might be worth a soft nudge at some
  // point, even just flavor text."). Deliberately NOT a fail state or a
  // turn limit — house rule #5 (README) is unchanged, eliminate_all still
  // has no proactive hunt and no clock. This only tracks how many full
  // turn cycles have passed since the last resolveAttack() call (reset
  // there — the one choke point every attack in the game already funnels
  // through, player or hostile, normal or reaction shot) and pushes a
  // single one-time flavor line to the log once it crosses a threshold,
  // purely so a player who's genuinely stuck (not just playing slow) gets
  // told, rather than sitting in silence wondering if the game is broken.
  private turnsWithoutContact = 0;
  private stallNudgeShown = false;
  private eventState: EventRuntimeState = createEventRuntimeState();
  private extractedUnitId: string | null = null;
  // Single point of truth for WHO the extract_unit target actually is once
  // the mission starts, set once by tagExtractionTarget() and read by
  // checkExtraction/checkWinLoss below — never re-derive this from
  // mission.objectiveParams.extractUnitId directly after construction (see
  // tagExtractionTarget's own comment for why the literal configured id
  // can silently stop matching anyone on the board).
  private resolvedExtractUnitId: string | null = null;
  // Mission 31 "The Last Convoy" (25 Aug 2026) — companion to extractedUnitId
  // above, for the multi-civilian shape (data/types.ts's civilianSpawns/
  // extractThreshold). Empty on every mission without civilianSpawns; the
  // two extraction trackers are never both in play on the same mission — see
  // checkExtraction/checkWinLoss below for which one a given mission uses.
  private extractedCivilianIds: Set<string> = new Set();
  // Mission 5's rescue-and-recruit bonus objective (23 Aug 2026) — see
  // BattleUnit.npcIncapacitated's own comment for the full design. "none"
  // for every mission without a rescue_pilot bonusObjective (the
  // overwhelming majority); set to "pending" the instant the rescuable NPC
  // spawns, then resolved to "succeeded" (checkRescueExtraction) or
  // "failed" (handleDowned, if either the NPC or whoever ends up carrying
  // them goes down first). Deliberately NEVER read by checkWinLoss — a
  // bonus objective, by definition, cannot fail the mission itself;
  // scenes/Debrief.ts is the one place this gets acted on
  // (generateRandomRescuedPilot, engine/campaignEconomy.ts's
  // computeBonusObjectivePoints).
  rescueOutcome: "none" | "pending" | "succeeded" | "failed" = "none";
  // Generalized bonus-objective pass (24 Aug 2026) — clear_bloom_patch's
  // own outcome tracker, companion to rescueOutcome above. "none" for every
  // mission without a clear_bloom_patch bonusObjective; "pending" the
  // instant one is armed (armClearBloomPatch, below); "succeeded" once
  // every tile in the bonusObjective's own patchTiles reads as something
  // other than bloom_mat (checkClearBloomPatchComplete). No "failed"
  // state — see ClearBloomPatchBonusObjective's own comment in
  // data/types.ts for why this kind has no failure condition to detect.
  clearBloomPatchOutcome: "none" | "pending" | "succeeded" = "none";
  // abil_fire_support's shared squad-wide charge pool (25 Aug 2026, Mission
  // 14 "Steel Rain" — see data/abilities.ts's own comment for the full
  // design). Unlike usedScreenThisMission/sensorSweepUsesRemaining, which
  // live on the individual BattleUnit, this lives on Mission itself — one
  // ship, one shared budget, spent by whichever unit calls it in first.
  // Initialized to FIRE_SUPPORT_CHARGES_PER_MISSION for every mission
  // (harmless on a mission whose deployed units never carry
  // abil_fire_support at all — canFireSupport's own ability check means
  // this counter simply never gets read on Missions 1-13).
  fireSupportChargesRemaining: number = FIRE_SUPPORT_CHARGES_PER_MISSION;
  /**
   * cinder_line_signature's placed hazards (Vault Phase 2, slice 3, 3 Sep
   * 2026) — see the SurtrLine interface's own header comment just above
   * this class for why this is its own tracked list rather than reusing
   * bloom_mat. Empty on every mission whose deployed units never carry
   * cinder_line_signature at all, same harmless-when-unused shape
   * fireSupportChargesRemaining right above already has for Missions
   * 1-13's non-Heirloom units. Ticked once per environmentStep() cycle
   * (tickSurtrLines) and mutated by cinderLineSignature()/firebreak()/
   * draft() below — nothing else in this file writes to it.
   */
  private activeSurtrLines: SurtrLine[] = [];
  /**
   * requiem_severance (Gjallar, Vault Phase 2 slice 7, 3 Sep 2026) — the
   * "shared 0-100 charge meter" data/heirlooms.ts's own `requiem` entry
   * documents (that entry's `cooldownTurns: 0` is explicitly NOT "no
   * cooldown" the way it means for every other passive ability in this
   * file — see its own inline comment: "the existing shared 0-100 charge
   * meter, not a turn cooldown"). Company-wide, not per-unit — exactly one
   * of these per Mission, mutated by accrueRequiemCharge() (see that
   * method's own comment for why resolveAttack() is the one correct choke
   * point to call it from) and reset to 0 by requiemSeverance() itself on a
   * successful fire.
   *
   * Starts at 0 every mission, not persisted across the mission boundary:
   * GDD §8.3's own campaign-gating table only ever describes the meter
   * filling WITHIN a single mission ("fills to roughly 60% by mission end"
   * at Mission 2), and Mission itself is reconstructed fresh every mission
   * with no existing mechanism to carry state like this across that
   * boundary (contrast lastword_signature's own permanentMaxHpMultiplier,
   * deliberately written onto CampaignPilotEntry for exactly the opposite
   * reason) — so resetting to 0 at construction is the correct default,
   * not an oversight.
   */
  private requiemCharge = 0;
  // Weapons Bay's bonus Fire Support charge (28 Aug 2026, Antfarm
  // buildable-bay pass) — see WEAPONS_BAY_FIRE_SUPPORT_COOLDOWN_TURNS's own
  // comment in data/combatTables.ts for the design. A readyAtTurn value for
  // engine/cooldown.ts's isCooldownReady/startCooldown, NOT a second charge
  // counter — 0 (the default) reads as "ready," same "never started reads
  // ready" convention as everywhere else that file's used. Only ever
  // consulted when weaponsBuiltBay is true; harmless dead weight on every
  // mission/save without the bay built, same as fireSupportChargesRemaining
  // is harmless on Missions 1-13's units that lack abil_fire_support at all.
  fireSupportBonusReadyTurn: number = 0;
  // Beacon Control (claude/Bloom_Wars_Beacon_Restock_Economy_v1.md, built 4
  // Sep 2026) — mirrors fireSupportChargesRemaining's own "shared, not
  // per-unit" shape directly above: one company-wide placement budget for
  // the whole mission, spent by whoever currently holds the ability
  // (beaconHolderId() below, computed live every call rather than cached —
  // see that method's own comment for why). Separate from the crate/charge
  // stockpile right below, which gates each use a second way.
  beaconsRemaining: number = BEACON_MAX_PER_MISSION;
  // Crate/charge stockpile, snapshotted at construction from
  // MissionOptions.beaconCratesRemaining/beaconChargesRemaining — see that
  // field's own comment for why the default is 0/0, not a nonzero guess.
  beaconCratesRemaining: number = 0;
  beaconChargesRemaining: number = 0;
  // Rourke's own rank, snapshotted from MissionOptions.rourkeRank — see that
  // field's own comment for the default. Read only by beaconHolderId() below.
  private readonly rourkeRank: Rank;
  // How many beacon revives actually landed this mission — read at Debrief
  // (engine/campaignEconomy.ts's applyBeaconReviveCosts) to charge the
  // mission's own point-payout percentage per use. Kept separately from
  // beaconsRemaining counting down so a future difficulty hook that changes
  // the starting placement budget still reports an honest "how many did we
  // actually spend," not a number derived from the (possibly different) cap.
  beaconRevivesUsed: number = 0;
  // Fabricator spare parts burned by Beacon Control this mission, keyed by
  // mek id (6 Sep 2026 — Maxime: "its the beacon job to give in battle
  // restock," so a Fabricator mek's parts are its pilot's own Beacon crate
  // rather than the GDD's never-built self-redeploy). Mission can't write
  // CampaignState, so this is handed to engine/campaignEconomy.ts's
  // applySparePartsConsumption at Debrief — same shape as
  // signatureHpCosts and the crate/charge write-back right above.
  sparePartsSpent: Record<string, number> = {};
  // Which Antfarm bays are built on the campaign save this mission was
  // launched from (engine/campaignState.ts's CampaignState.builtBays) —
  // passed in once at construction, not re-read live, same "snapshot for
  // the mission's lifetime" treatment `mission`/`deployRoster` already get.
  // Defaults to none built, so every existing call site (tests, npm run
  // sim, anywhere that doesn't yet pass a third constructor arg) behaves
  // exactly as it did before this field existed.
  private builtBays: ReservedBayId[] = [];
  // Carrier Upgrade Modules (2 Sep 2026, data/carrierModules.ts) — same
  // snapshot-at-construction treatment as builtBays directly above, and
  // same "defaults to none, so every existing call site is unchanged"
  // guarantee. Only Forward Battery reads this today (see
  // fireSupportRadius below); the other three modules never reach the
  // engine at all.
  private builtModules: CarrierModuleId[] = [];
  // seal_borrowed_authority (Vault Phase 2 slice 6) — same snapshot-at-
  // construction treatment as builtBays/builtModules right above. See
  // MissionOptions.foughtOnHitEffectKinds' own comment.
  private foughtOnHitEffectKinds: OnHitEffectKind[] = [];
  // Protect Asset (Mission 22, 25 Aug 2026) — see data/types.ts's
  // CampaignMission.objective comment for the full design. Field-default
  // here is just a safe placeholder; the real per-mission value is set in
  // the constructor body below from objectiveParams.assetMaxHp (or
  // PROTECT_ASSET_DEFAULT_MAX_HP if the mission doesn't override it), since
  // that needs `mission` to already be assigned. Harmless on every mission
  // that isn't protect_asset — nothing reads either field otherwise.
  assetMaxHp: number = PROTECT_ASSET_DEFAULT_MAX_HP;
  assetHp: number = PROTECT_ASSET_DEFAULT_MAX_HP;
  // Found while building House Amaranth Mission 22 (31 Aug/1 Sep 2026,
  // second protect_asset mission ever authored): the asset's own display
  // name was hardcoded to "the Providence" in both this file's log lines
  // AND scenes/Battle.ts's live HUD line -- harmless while Warden's own
  // "Ash on the Water" (Mission 22) was the only protect_asset mission that
  // existed, since it happens to BE the Providence, but a real bug the
  // moment a second protect_asset mission defends something else (House
  // Amaranth's diversion relay has never heard of Warden Company's ship).
  // Fixed generically rather than special-cased: assetName defaults to
  // "Providence" so Warden's Mission 22 needs zero data changes to keep
  // behaving exactly as before, and any mission can override it via
  // objectiveParams.assetName (data/types.ts).
  assetName: string = "Providence";

  /** The battle's random source — see MissionOptions.rng. Private; every roll in this class goes through it. */
  private readonly rng: () => number;

  constructor(mission: CampaignMission, deployRoster?: DeployRosterEntry[], builtBays: ReservedBayId[] = [], options: MissionOptions = {}) {
    this.rng = options.rng ?? (() => Math.random());
    this.mission = mission;
    this.builtBays = builtBays;
    this.builtModules = options.builtModules ?? [];
    this.foughtOnHitEffectKinds = options.foughtOnHitEffectKinds ?? [];
    this.beaconCratesRemaining = options.beaconCratesRemaining ?? 0;
    this.beaconChargesRemaining = options.beaconChargesRemaining ?? 0;
    this.rourkeRank = options.rourkeRank ?? "2nd_lt";
    if (mission.objective === "protect_asset") {
      this.assetMaxHp = mission.objectiveParams.assetMaxHp ?? PROTECT_ASSET_DEFAULT_MAX_HP;
      this.assetHp = this.assetMaxHp;
      this.assetName = mission.objectiveParams.assetName ?? "Providence";
    }
    const map = MAPS[mission.mapId];
    if (!map) throw new Error(`Unknown map id: ${mission.mapId}`);
    // Clone the tile grid rather than keeping map's own reference. MAPS[id]
    // (data/mapRegistry.ts) is one singleton object, shared by every Mission
    // ever built from this mapId — every test, every npm run sim call, every
    // real playthrough. Nothing mutated map.tiles before this pass (Mission
    // 3's clear_bloom objective, tickBloomRegrowth below, is the first thing
    // in this codebase that ever writes to a tile after a mission starts),
    // so sharing the reference was latent, not actually wrong, up to now —
    // from here on, skipping this clone would mean a Munti clearing bloom
    // mat in one Low Ground playthrough permanently rewrites the map for
    // every Low Ground mission after it, in the same process. deployZones/
    // exitTiles/holdZone are never mutated anywhere in this file, so they
    // stay shared references — only `tiles` needs its own copy per Mission.
    this.map = { ...map, tiles: map.tiles.map((row) => [...row]) };
    this.deployRoster = deployRoster;
    this.deployedPilotIds = deployRoster ? deployRoster.map((e) => e.pilotId) : [...mission.playerPilotIds];
    this.deployPlayerUnits();
    // seal_inherited_weight (Simulacrum/The Stolen Seal, Vault Phase 2
    // slice 6) — a mission-start-only passive roll, so it happens exactly
    // once, right here, for every deployed unit that carries the ability.
    // See rollInheritedWeight()'s own header for the full design.
    this.rollInheritedWeight();
    // Counted off the real board, not off deployRoster, so a mission built
    // straight from mission.playerPilotIds (every test, every sim run) gets
    // the same answer a real deploy does.
    this.muntisDeployed = this.units.filter((u) => u.side === "player" && u.path === "munti").length;
    this.tagExtractionTarget();
    this.armBonusObjective();
    this.spawnConvoyCivilians();
    // Turn 1 goes through the exact same path every later turn does
    // (endPlayerTurn -> runTurnStartEvents), which already spawns that
    // turn's waves itself. This used to ALSO call spawnWavesForTurn(1)
    // explicitly right here, which meant every turn-1 wave in the game
    // spawned twice — verified 23 Aug 2026 against the mission defs
    // themselves: Amaranth I.1 put 12 hostiles on the board for a def
    // that says 6, I.3 put 20 for a def that says 10, and Team One's
    // Mission 1a put 26 for a def that says 13. Exactly double, every
    // mission, both campaigns. Removing the redundant call also makes
    // turn 1 order-consistent with every other turn: events fire first,
    // then that turn's waves spawn.
    this.runTurnStartEvents();
  }

  /**
   * Bonus-objective setup, generalized 24 Aug 2026 (see BonusObjective's
   * own comment in data/types.ts) — dispatches by `kind` to whichever arm
   * method actually does the work, or is a no-op for every mission without
   * a bonusObjective at all. A mission carries at most one bonusObjective,
   * so at most one of spawnRescuableNpc/armClearBloomPatch ever runs, and
   * only one of rescueOutcome/clearBloomPatchOutcome ever leaves "none."
   */
  private armBonusObjective(): void {
    const bonus = this.mission.bonusObjective;
    if (!bonus) return;
    if (bonus.kind === "rescue_pilot") this.spawnRescuableNpc(bonus);
    else this.armClearBloomPatch();
  }

  /** Mission 5's rescue-and-recruit bonus objective: places the one rescuable NPC on the board and arms rescueOutcome. */
  private spawnRescuableNpc(bonus: RescuePilotBonusObjective): void {
    this.units.push(createRescuableNpcUnit(bonus.npcSpawnAt, bonus.npcDisplayName));
    this.rescueOutcome = "pending";
  }

  /**
   * Generalized 24 Aug 2026: arms clearBloomPatchOutcome. No board setup
   * needed, unlike spawnRescuableNpc — a clear_bloom_patch bonusObjective's
   * `patchTiles` names tiles that are already bloom_mat on the map as
   * authored; abil_clear_bloom (this file's own canClearBloom/
   * getClearableBloomFrom/clearBloom, further down) is the verb that
   * clears them, completely unchanged by this pass. Takes no argument —
   * checkClearBloomPatchComplete (below) re-reads mission.bonusObjective
   * itself when it actually needs the patch's tile list.
   */
  private armClearBloomPatch(): void {
    this.clearBloomPatchOutcome = "pending";
  }

  /**
   * Mission 31 "The Last Convoy" (25 Aug 2026) — separate from
   * armBonusObjective on purpose: civilianSpawns is core to the mission's
   * actual objective (extract_unit), not a bonus layered on top the way
   * rescue_pilot/clear_bloom_patch are, so it doesn't belong in that
   * kind-dispatch at all. No-op (empty loop) for every mission without
   * civilianSpawns — the entire rest of this file's civilian-handling code
   * (checkExtraction, checkWinLoss's extract_unit branch, runCivilianStep)
   * is equally inert whenever this.units simply has no isCivilian unit on
   * it, so nothing here needs its own extra guard beyond the array being
   * empty.
   */
  private spawnConvoyCivilians(): void {
    for (const spawn of this.mission.civilianSpawns ?? []) {
      this.units.push(createCivilianUnit(spawn.at, spawn.displayName));
    }
  }

  private deployPlayerUnits(): void {
    const pads = this.map.deployZones.player;
    if (this.deployRoster) {
      // Real selection path (scenes/TransporterPad.ts via scenes/Battle.ts):
      // build every unit from the caller-resolved PilotRecord/MekArchetype
      // directly, not by re-resolving `entry.pilotId` through the static
      // pilotRegistry — see createPlayerUnit's own `overrides` doc comment
      // (engine/units.ts) for why that distinction matters for a generated
      // recruit.
      this.deployRoster.forEach((entry, i) => {
        const pos = pads[i % pads.length];
        const unit = createPlayerUnit(entry.pilotId, pos, {
          pilot: entry.pilot,
          mek: entry.mek,
          sendOffBonus: entry.sendOffBonus,
          heirloomAbilityRanks: entry.heirloomAbilityRanks,
        });
        this.applyBonusAbilityUnlocks(unit);
        this.units.push(unit);
        this.unitPerformance[entry.pilotId] = { damageDealt: 0, kills: 0, assistCredit: 0, wasDowned: false, damageTaken: 0, abilitiesUsed: {} };
      });
      return;
    }
    // Old, no-selection path — unchanged: every test, npm run sim, and any
    // future direct `new Mission(missionDef)` call still resolves purely
    // through the static, build-time roster/registry.
    this.mission.playerPilotIds.forEach((pilotId, i) => {
      const pos = pads[i % pads.length];
      const unit = createPlayerUnit(pilotId, pos);
      this.applyBonusAbilityUnlocks(unit);
      this.units.push(unit);
      this.unitPerformance[pilotId] = { damageDealt: 0, kills: 0, assistCredit: 0, wasDowned: false, damageTaken: 0, abilitiesUsed: {} };
    });
  }

  /**
   * CampaignMission.bonusAbilityUnlocks (data/types.ts) — a mission-gated
   * ability grant, layered on top of the unit's normal per-archetype kit
   * rather than baked into UNIT_ARCHETYPES, so it never touches the
   * static data every other mission also reads. Builds a NEW abilities
   * array; `archetype.abilities` (what createPlayerUnit copied the
   * reference from) is shared, static data and must never be mutated in
   * place.
   */
  private applyBonusAbilityUnlocks(unit: BattleUnit): void {
    const unlocks = this.mission.bonusAbilityUnlocks;
    if (!unlocks || !unit.path) return;
    const grants = unlocks.filter((u) => u.path === unit.path && !unit.abilities.includes(u.abilityId));
    if (!grants.length) return;
    unit.abilities = [...unit.abilities, ...grants.map((g) => g.abilityId)];
  }

  /**
   * "Mirror deployment" resolution (30 Aug 2026 — see EnemyWave.
   * mirrorPlayerSquad's own comment in data/types.ts for the full design).
   * Every mirrorPlayerSquad wave among `wavesThisTurn` shares its `count`
   * as a WEIGHT; this splits `deployedPilotIds.length` across them
   * proportionally, largest-remainder rounding so the total always comes
   * out to exactly that number, never off by a rounding error regardless
   * of how the weights divide. Returns a count per wave (by array index,
   * not by wave identity — two mirror waves can carry identical
   * archetype/atTurn/spawnAt and still need different resolved counts,
   * which a Map keyed on the wave object would collapse if two entries
   * were ever the same object reference, though they never are today
   * since each is its own object literal in mission data).
   *
   * mirrorScale, added same day — see EnemyWave.mirrorScale's own comment
   * (data/types.ts) for why: a literal 1:1 target === deployedPilotIds.length
   * turned out to be a real, sim-confirmed cliff on Mission 20 (100% ->
   * 1%), not just a "more enemies, somewhat harder" gradient. Read off the
   * first mirror wave that specifies one (mixed scales within one mirror
   * group would be ambiguous — which wave's number wins? — so this isn't
   * supported; every mirror wave in a group is expected to either omit it
   * or agree), defaulting to 1 (today's exact prior behavior) when none
   * do.
   */
  private resolveMirrorCounts(wavesThisTurn: EnemyWave[]): number[] {
    const scale = wavesThisTurn.find((w) => w.mirrorPlayerSquad && w.mirrorScale !== undefined)?.mirrorScale ?? 1;
    const target = Math.round(this.deployedPilotIds.length * scale);
    const totalWeight = wavesThisTurn.reduce((sum, w) => sum + (w.mirrorPlayerSquad ? w.count : 0), 0);
    if (totalWeight <= 0 || target <= 0) return wavesThisTurn.map(() => 0);
    const raw = wavesThisTurn.map((w) => (w.mirrorPlayerSquad ? (w.count / totalWeight) * target : 0));
    const floors = raw.map(Math.floor);
    const remainder = target - floors.reduce((sum, f) => sum + f, 0);
    const byFracDesc = raw
      .map((r, i) => ({ i, frac: r - floors[i] }))
      .filter((_, i) => wavesThisTurn[i].mirrorPlayerSquad)
      .sort((a, b) => b.frac - a.frac);
    const resolved = [...floors];
    for (let k = 0; k < remainder && k < byFracDesc.length; k++) resolved[byFracDesc[k].i] += 1;
    return resolved;
  }

  private spawnWavesForTurn(turn: number): void {
    const wavesThisTurn = this.mission.enemyWaves.filter((w) => w.atTurn === turn);
    const mirrorCounts = wavesThisTurn.some((w) => w.mirrorPlayerSquad) ? this.resolveMirrorCounts(wavesThisTurn) : null;
    wavesThisTurn.forEach((wave, waveIndex) => {
      const count = wave.mirrorPlayerSquad ? mirrorCounts![waveIndex] : wave.count;
      const spots = wave.spawnAt === "enemy_deploy" ? this.map.deployZones.enemy : wave.spawnAt;
      for (let i = 0; i < count; i++) {
        const pos = spots.length ? spots[i % spots.length] : this.map.deployZones.enemy[0] ?? { x: 0, y: 0 };
        const freePos = this.findFreeAdjacent(pos);
        if (wave.archetypeId.startsWith("hostile_mech_")) {
          this.units.push(createHostileMechUnit(wave.archetypeId, freePos, wave.tier));
        } else {
          this.units.push(createBloomUnit(wave.archetypeId, freePos, { burrowed: !!wave.burrowed }));
        }
      }
    });
  }

  /**
   * Walk outward from `origin` (4-directional, walls-aware — same stepping
   * rule as everything else on this grid, see grid.ts's own note on why
   * movement is cardinal rather than Chebyshev) to find an unoccupied,
   * passable-ground tile — spawn waves can list far fewer coords than
   * units, so overflow beyond the first unit at a seam lands here.
   *
   * Was a blind Chebyshev-ring search (checked raw coordinate distance
   * only, never whether a wall stood in between) until a real bug it
   * caused surfaced during Mission 2's Splitfang-count tuning (Maxime,
   * 23 Aug 2026): with a 9th unit needing overflow placement near Wire and
   * Mud's spawn tiles — which sit right up against the hold room's sealed
   * east wall — the old ring search found (10,3), a hold-zone tile one
   * wall-thickness away in raw coordinates, and placed a Splitfang there
   * outright. That unit never walked through the doorway; it spawned
   * inside the sealed room, no path required, which is exactly the kind
   * of thing the room's single-doorway design (this file's own
   * checkWinLoss hold_zone branch, mapsAmaranth.ts's "keeps its ONE
   * doorway") is supposed to make impossible. A BFS restricted to actually
   * walkable terrain can't cross a wall to shortcut there, the same way a
   * real unit's own move budget can't.
   *
   * Unit occupancy does NOT block the walk itself — only terrain does —
   * so this still finds a tile behind a crowd of units instead of
   * refusing early; occupancy is checked only on the candidate tile
   * before returning it.
   */
  private findFreeAdjacent(origin: Coord): Coord {
    const occupied = new Set(this.units.filter((u) => !u.downed).map((u) => coordKey(u.pos)));
    if (!occupied.has(coordKey(origin)) && TILES[tileAt(this.map, origin)].passableGround) return origin;
    const seen = new Set([coordKey(origin)]);
    const queue: Coord[] = [origin];
    while (queue.length) {
      const c = queue.shift()!;
      for (const d of [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
      ]) {
        const n = { x: c.x + d.x, y: c.y + d.y };
        if (n.x < 0 || n.y < 0 || n.x >= this.map.width || n.y >= this.map.height) continue;
        const key = coordKey(n);
        if (seen.has(key)) continue;
        if (!TILES[tileAt(this.map, n)].passableGround) continue;
        seen.add(key);
        if (!occupied.has(key)) return n;
        queue.push(n);
      }
    }
    return origin;
  }

  private runTurnStartEvents(): void {
    const fired = evaluateTurnStart(this.mission.events, this.turn, this.eventState);
    for (const ev of fired) this.applyEventAction(ev.action);
    this.spawnWavesForTurn(this.turn);
  }

  private applyEventAction(action: import("../data/types").MissionEvent["action"]): void {
    if (action.type === "spawn") {
      action.archetypeIds.forEach((archId, i) => {
        const pos = this.findFreeAdjacent(action.at[i] ?? action.at[0]);
        if (archId.startsWith("hostile_mech_")) {
          this.units.push(createHostileMechUnit(archId, pos, action.tier));
          this.log.push(`Event: ${archId} deploys at (${pos.x},${pos.y})`);
        } else {
          // burrowed (Mission 21 "Cut the Root," 25 Aug 2026) — see
          // data/types.ts's spawn action comment. Passed straight through
          // to createBloomUnit exactly like EnemyWave's own burrowed field
          // already does (spawnWavesForTurn, above); defaults to false so
          // every event authored before this pass keeps its exact
          // unburrowed behavior.
          this.units.push(createBloomUnit(archId, pos, { burrowed: !!action.burrowed }));
          this.log.push(
            `Event: ${archId} ${action.burrowed ? "surfaces burrowed" : "spawns"} at (${pos.x},${pos.y})`
          );
        }
      });
    } else if (action.type === "remove_from_roster") {
      for (const id of action.unitIds) {
        const u = this.units.find((x) => x.instanceId === id);
        if (u) u.downed = true;
        this.removedFromRoster.push(id);
      }
      this.log.push(`Event: extraction failure — removed from roster: ${action.unitIds.join(", ")}`);
    } else if (action.type === "dialogue") {
      this.log.push(`(dialogue) ${action.text}`);
    } else if (action.type === "reveal") {
      // No fog-of-war UI yet in this pass — no-op beyond the log.
      this.log.push(`Event: reveal at ${action.at.map((c) => `(${c.x},${c.y})`).join(" ")}`);
    }
  }

  // ---- queries -----------------------------------------------------

  livingUnits(): BattleUnit[] {
    return this.units.filter((u) => !u.downed);
  }

  unitById(id: string): BattleUnit | undefined {
    return this.units.find((u) => u.instanceId === id);
  }

  /** Read-only snapshot of Gjallar/Requiem's own charge meter (0 to SEVERANCE.maxCharge), for scenes/Battle.ts's HUD meter and hover tip. See requiemCharge's own field comment for what this tracks. */
  getRequiemCharge(): number {
    return this.requiemCharge;
  }

  /** Read-only snapshot of every currently-burning Surtr line, for scenes/Battle.ts's board overlay and hover tip — see the SurtrLine interface's own comment for what this tracks and why it isn't map.tiles. */
  getActiveSurtrLines(): readonly SurtrLine[] {
    return this.activeSurtrLines;
  }

  // Battle.ts's own extract_unit HUD line (30 Aug 2026, Maxime: "I couldnt
  // find out which unit need extraction so I failed the mission") needs a
  // live "how many of the convoy are actually banked so far" number for the
  // Last Convoy shape, same as extractedUnitId already gets read straight
  // off checkWinLoss's own logic for the single-target shape — this is just
  // that same count made public instead of re-deriving it from the board.
  get extractedCivilianCount(): number {
    return this.extractedCivilianIds.size;
  }

  // Single-target extract_unit's own public counterpart to
  // extractedCivilianCount above — Battle.ts's HUD line and on-board green
  // ring (drawUnit) both need to know WHO the real target is, which per
  // tagExtractionTarget's own comment is not always the literal id in
  // mission.objectiveParams.extractUnitId (the named pilot may never have
  // been deployed, in which case the role already transferred to whoever
  // actually showed up). Null until tagExtractionTarget runs (constructor,
  // right after deployPlayerUnits) or on any mission that isn't a
  // single-target extract_unit at all.
  get resolvedExtractionTargetId(): string | null {
    return this.resolvedExtractUnitId;
  }

  private movementKindFor(unit: BattleUnit): MovementKind {
    // Frame Systems Layer (6 Sep 2026) — one rule for every mover in the
    // codebase, including the two Drive/Frame systems that change a frame's
    // costs (Bloomwalkers, Redundant Actuators). See engine/frameSystems.ts.
    return movementKindOf(unit);
  }

  private occupiedSet(excludeId: string): Set<string> {
    const s = new Set<string>();
    for (const u of this.units) if (!u.downed && u.instanceId !== excludeId) s.add(coordKey(u.pos));
    return s;
  }

  getReachableTiles(unitId: string): Coord[] {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed || unit.actionsRemaining <= 0) return [];
    const reachable = reachableTiles(this.map, unit.pos, unit.moveRange, this.movementKindFor(unit), this.occupiedSet(unitId));
    return [...reachable.keys()].map((k) => {
      const [x, y] = k.split(",").map(Number);
      return { x, y };
    });
  }

  getAttackableFrom(unitId: string, from: Coord): BattleUnit[] {
    const unit = this.unitById(unitId);
    if (!unit) return [];
    const [minR, maxR] = unit.attackRange;
    return this.livingUnits().filter((t) => {
      if (t.side === unit.side) return false;
      const d = chebyshevDistance(from, t.pos);
      return d >= minR && d <= maxR;
    });
  }

  /**
   * Adjacent friendly units this unit could usefully Repair right now
   * (abil_repair, once per turn, instead of attacking). Excludes anyone
   * already at full HP — the ability doesn't forbid targeting them, but
   * there's never a real reason to, and letting the UI offer them just
   * means a stray click burns Derek's whole turn for 0 HP healed. Filtered
   * here rather than in repairUnit() itself, so the engine action stays
   * technically permissive (e.g. for a future AI healer) while the click
   * target list only ever shows targets worth clicking.
   *
   * No more once-per-turn cap (Maxime, 22 Aug 2026, two-action house rule)
   * — a healer with actions to spare can Repair a second (different) ally
   * the same turn, same as an XCOM Specialist's Medikit.
   */
  getRepairableFrom(unitId: string, from: Coord): BattleUnit[] {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed) return [];
    // Field Doctor (Weapon Branch Point System, data/weaponBranches.ts,
    // 1 Sep 2026) — a Munti out of actions can still Repair if their
    // once-per-FIELD_DOCTOR_COOLDOWN_TURNS free bonus is off cooldown.
    // Mirrors repairUnit()'s own gate exactly, same discipline as the
    // range-aware fix below it.
    if (unit.actionsRemaining <= 0 && !this.fieldDoctorBonusReady(unit)) return [];
    if (!unit.abilities.includes("abil_repair")) return [];
    // Range-aware and branch-aware, 28 Aug 2026 — this UI-highlight source
    // used to hardcode adjacent-only (distance === 1) regardless of
    // DEFAULT_REPAIR_RANGE/RAPID_RESPONSE_REPAIR_RANGE above, the real bug
    // Munti's base range fix (1->3) exposed: the highlight and the actual
    // repairUnit() action it drives (this function's own comment, and
    // repairUnit's below) fell out of sync. Now mirrors repairUnit()'s own
    // per-healer-branch range exactly, rather than re-deriving it a second
    // way.
    // Rapid Response, plus (6 Sep 2026) the two Munti refits — one shared
    // rule in engine/frameSystems.ts's repairRangeFor, so this and
    // repairUnit's own check can't drift apart.
    const repairRange = repairRangeFor(unit);
    return this.livingUnits().filter(
      (t) =>
        t.side === unit.side &&
        t.instanceId !== unit.instanceId &&
        t.currentHp < t.maxHp &&
        chebyshevDistance(from, t.pos) <= repairRange
    );
  }

  // ---- Mission 5's rescue-and-recruit bonus objective (23 Aug 2026) ------
  //
  // No ability gate — every player unit can attempt a rescue, the same way
  // every player unit can Move; this isn't a class verb like Repair. Mirrors
  // getRepairableFrom/canRescue/rescueUnit's own three-part shape (a
  // getX() the UI highlights from, a canX() predicate, a verb that
  // re-checks it) exactly, one adjacency requirement, one action, does not
  // end the turn — so a unit can reposition to the NPC and rescue them, or
  // rescue then start walking them out, in the same turn.

  /** The one rescuable NPC, if this unit is adjacent to it and free to act — empty otherwise. UI highlight source, same contract as getRepairableFrom. */
  getRescuableFrom(unitId: string, from: Coord): BattleUnit[] {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed || unit.actionsRemaining <= 0) return [];
    if (unit.side !== "player" || unit.carryingRescueId) return [];
    return this.livingUnits().filter((t) => t.npcIncapacitated && chebyshevDistance(from, t.pos) === 1);
  }

  canRescue(rescuerId: string, npcId: string): boolean {
    const rescuer = this.unitById(rescuerId);
    const npc = this.unitById(npcId);
    if (!rescuer || !npc || rescuer.downed || rescuer.actionsRemaining <= 0) return false;
    if (rescuer.side !== "player" || rescuer.carryingRescueId) return false;
    if (!npc.npcIncapacitated || npc.downed) return false;
    return chebyshevDistance(rescuer.pos, npc.pos) === 1;
  }

  /**
   * Pull the NPC up and start carrying them: the NPC unit is removed from
   * the board outright (there is nothing further to render or target once
   * they're "in tow" — see BattleUnit.npcIncapacitated's own comment) and
   * the rescuer is marked carryingRescueId, which engine/mission.ts's
   * attack() checks and refuses for as long as it's set. Getting them the
   * rest of the way to an exit tile is checkRescueExtraction()'s job,
   * called every player turn end alongside checkExtraction().
   */
  rescueUnit(rescuerId: string, npcId: string): { rescuerId: string; npcId: string } | null {
    if (!this.canRescue(rescuerId, npcId)) return null;
    const rescuer = this.unitById(rescuerId)!;
    const npc = this.unitById(npcId)!;
    rescuer.actionsRemaining -= 1;
    this.noteAbilityUse(rescuer, "rescue");
    rescuer.carryingRescueId = npc.instanceId;
    this.units = this.units.filter((u) => u.instanceId !== npc.instanceId);
    this.log.push(`${rescuer.displayName} gets ${npc.displayName} up and starts carrying them toward the exit.`);
    return { rescuerId, npcId };
  }

  /**
   * Extraction check for the rescue bonus objective — call every player
   * turn end, mirrors checkExtraction()'s own shape but never touches
   * this.outcome (a bonus objective cannot fail the mission). Clears the
   * carrier's own carryingRescueId on success — attack()'s guard checks
   * that flag, so a carrier who successfully drops the rescue off goes
   * back to being a normal combatant for whatever's left of the mission,
   * rather than being permanently locked out of attacking.
   */
  private checkRescueExtraction(): void {
    if (this.rescueOutcome !== "pending") return;
    const carrier = this.units.find((u) => u.carryingRescueId);
    if (!carrier) return;
    const exits = this.map.exitTiles ?? [];
    if (exits.some((c) => coordsEqual(c, carrier.pos))) {
      this.rescueOutcome = "succeeded";
      carrier.carryingRescueId = undefined;
      this.log.push(`${carrier.displayName} gets the rescued pilot clear — they're headed home.`);
    }
  }

  /**
   * Completion check for the clear_bloom_patch bonus objective — call
   * every player turn end, mirrors checkRescueExtraction's own shape
   * (never touches this.outcome; a bonus objective cannot end the
   * mission). Succeeds the instant every tile in the bonusObjective's own
   * patchTiles reads as something other than bloom_mat — this doesn't
   * care WHO or WHAT cleared them (abil_clear_bloom is the only verb that
   * currently does, but the check itself is agnostic, the same way
   * hasBloomMat() below is). No "failed" branch: an unmet patch at
   * mission end is simply still "pending" — see
   * ClearBloomPatchBonusObjective's own comment in data/types.ts for why
   * this kind has no failure condition to detect.
   */
  private checkClearBloomPatchComplete(): void {
    if (this.clearBloomPatchOutcome !== "pending") return;
    const bonus = this.mission.bonusObjective;
    if (!bonus || bonus.kind !== "clear_bloom_patch") return;
    const allClear = bonus.patchTiles.every((c) => this.map.tiles[c.y][c.x] !== "bloom_mat");
    if (allClear) {
      this.clearBloomPatchOutcome = "succeeded";
      this.log.push("Bonus objective complete — the patch is clear.");
    }
  }

  /**
   * abil_sensor_sweep's footprint from `from`: every in-bounds tile the
   * sweep would cover. Mirrors getRepairableFrom/getAttackableFrom's shape
   * (returns empty for a unit that can't sweep right now, so the UI never
   * has to know a rule), except that a sweep's "targets" are tiles rather
   * than units — the whole point of it is finding units you can't see yet,
   * so a list of the hostiles it WOULD reveal would be exactly the
   * information the player isn't supposed to have before spending the
   * action.
   */
  getSensorSweepAreaFrom(unitId: string, from: Coord): Coord[] {
    if (!this.canSensorSweep(unitId)) return [];
    const unit = this.unitById(unitId)!;
    const r = this.sensorSweepRadius(unit);
    const tiles: Coord[] = [];
    for (let y = Math.max(0, from.y - r); y <= Math.min(this.map.height - 1, from.y + r); y++) {
      for (let x = Math.max(0, from.x - r); x <= Math.min(this.map.width - 1, from.x + r); x++) {
        tiles.push({ x, y });
      }
    }
    return tiles;
  }

  /** abil_interdict's kill-box from `from` — the in-bounds tiles a braced Tank would pin a hostile for finishing a move on. Empty if it can't brace right now. */
  getInterdictedTilesFrom(unitId: string, from: Coord): Coord[] {
    if (!this.canInterdict(unitId)) return [];
    const tiles: Coord[] = [];
    for (let y = Math.max(0, from.y - INTERDICT_RADIUS); y <= Math.min(this.map.height - 1, from.y + INTERDICT_RADIUS); y++) {
      for (let x = Math.max(0, from.x - INTERDICT_RADIUS); x <= Math.min(this.map.width - 1, from.x + INTERDICT_RADIUS); x++) {
        if (x === from.x && y === from.y) continue; // the Tank's own tile isn't part of the ring
        tiles.push({ x, y });
      }
    }
    return tiles;
  }

  /**
   * The ring a unit that is ALREADY braced is currently covering — the
   * board tell for abil_interdict, as opposed to getInterdictedTilesFrom's
   * before-you-commit preview. Two methods rather than one because they
   * answer opposite questions ("what would this cover" vs "what is this
   * covering"), and because a braced unit fails canInterdict by definition.
   * Empty for anything not braced, so scenes/Battle.ts never has to know
   * that rule either.
   */
  interdictedTiles(unitId: string): Coord[] {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed || !unit.braced) return [];
    const tiles: Coord[] = [];
    for (let y = Math.max(0, unit.pos.y - INTERDICT_RADIUS); y <= Math.min(this.map.height - 1, unit.pos.y + INTERDICT_RADIUS); y++) {
      for (let x = Math.max(0, unit.pos.x - INTERDICT_RADIUS); x <= Math.min(this.map.width - 1, unit.pos.x + INTERDICT_RADIUS); x++) {
        if (x === unit.pos.x && y === unit.pos.y) continue;
        tiles.push({ x, y });
      }
    }
    return tiles;
  }

  /** Is this unit currently painted by an unexpired abil_sensor_sweep? The expiry rule lives here, not in the renderer that draws the tell. */
  isRevealed(unitId: string): boolean {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed) return false;
    return unit.revealedUntilTurn !== undefined && unit.revealedUntilTurn >= this.turn;
  }

  /**
   * Who abil_screen would actually cover from `from` — the Munti itself
   * plus every living same-side unit within SCREEN_RADIUS. Includes the
   * Munti deliberately: it conceals itself too, and a UI highlight that
   * omitted it would misreport the rule. Empty if it can't screen right now
   * (no ability, out of actions, or already spent this mission).
   */
  getScreenableFrom(unitId: string, from: Coord): BattleUnit[] {
    if (!this.canScreen(unitId)) return [];
    const unit = this.unitById(unitId)!;
    return this.livingUnits().filter((t) => t.side === unit.side && chebyshevDistance(from, t.pos) <= SCREEN_RADIUS);
  }

  // ---- actions -------------------------------------------------------

  /**
   * Read-only path lookup, added for Battle.ts's walk animation (25 Aug
   * 2026 — "the walk thing should be a feature like xcom pause when the
   * unit move, allowing you to have moment when the board is in flux" —
   * Maxime). Mirrors moveUnit's own reachability/path computation exactly
   * but mutates nothing: no action spent, no position change, no events
   * fired. Battle.ts calls this BEFORE calling moveUnit so it can animate
   * the unit stepping tile-by-tile toward the same destination moveUnit is
   * about to commit instantly — the two calls see identical board state
   * because nothing happens in between them. Kept as its own method rather
   * than having moveUnit return the path directly: moveUnit's `boolean`
   * return is asserted against with `.toBe(true)`/`.toBe(false)` across
   * several existing test files, and changing that shape would touch all
   * of them for a rendering-only need.
   */
  getMovePath(unitId: string, destination: Coord): Coord[] | null {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed || unit.npcIncapacitated || unit.actionsRemaining <= 0) return null;
    const reachable = reachableTiles(this.map, unit.pos, unit.moveRange, this.movementKindFor(unit), this.occupiedSet(unitId));
    const key = coordKey(destination);
    if (!reachable.has(key)) return null;
    return reconstructPath(reachable, destination);
  }

  moveUnit(unitId: string, destination: Coord): boolean {
    const unit = this.unitById(unitId);
    // npcIncapacitated (Mission 5's rescue-and-recruit pass): defense in
    // depth, not load-bearing — moveRange 0 already means reachableTiles
    // below can never return anything but this unit's own tile, but an
    // explicit refusal here matches the guard shape every other
    // downed/inactive-unit check in this file already uses.
    if (!unit || unit.downed || unit.npcIncapacitated || unit.actionsRemaining <= 0) return false;
    const reachable = reachableTiles(this.map, unit.pos, unit.moveRange, this.movementKindFor(unit), this.occupiedSet(unitId));
    const key = coordKey(destination);
    if (!reachable.has(key)) return false;

    const path = reconstructPath(reachable, destination);
    // Ram Frame (Frame Systems Layer refit, 6 Sep 2026) — the centauroid
    // Charge rule "available to a bipedal Tank," per the design doc: a 2+
    // tile move of any shape sets the same flag the centauroid's own
    // straight-line rule does, so both ride CENTAUROID_CHARGE_MULT in
    // engine/combat.ts. `path` includes the start tile, hence length - 1.
    unit.chargedThisMove =
      (unit.chassis === "centauroid" && isStraightLineCharge(this.map, path, "centauroid")) || ramFrameCharges(unit, path.length - 1);
    // Battery Frame (same pass) and, since the same day's second pass, the
    // Fieldwright stationary heal / Stabilizer Struts — see
    // BattleUnit.tilesMovedThisTurn's own comment. Accumulates across a
    // turn's moves: two 1-tile moves read 2, which Struts (allowance 1)
    // correctly treats as "moved."
    unit.tilesMovedThisTurn = (unit.tilesMovedThisTurn ?? 0) + (path.length - 1);
    unit.pos = destination;
    // Move costs 1 action and does not end the turn (two-action house rule,
    // Maxime, 22 Aug 2026) — a unit can move again, or still act, if it has
    // an action left.
    unit.actionsRemaining -= 1;
    this.log.push(`${unit.displayName} moves to (${destination.x},${destination.y})`);

    for (const step of path.slice(1)) {
      const fired = evaluateZoneEntered(this.mission.events, step, this.turn, this.eventState);
      for (const ev of fired) this.applyEventAction(ev.action);
    }
    return true;
  }

  /**
   * The normal, action-costing Attack verb — the only entry point a player
   * click or an AI decision ever uses. Everything after the action-economy
   * check lives in resolveAttack() below, which the overwatch reaction shot
   * (triggerOverwatch) also calls: a reaction shot is the same attack, just
   * paid for in advance by entering overwatch rather than by an action
   * available right now.
   */
  attack(attackerId: string, defenderId: string): AttackOutcome | null {
    const attacker = this.unitById(attackerId);
    // carryingRescueId (Mission 5's rescue-and-recruit pass, 23 Aug 2026):
    // whoever is hauling the rescued NPC cannot attack until they've either
    // reached an exit tile (checkRescueExtraction clears the flag the
    // instant that happens — see that method) or gone down trying.
    // Escorting is the trade; a unit that could still fight while carrying
    // would get both halves of it for free.
    if (!attacker || attacker.actionsRemaining <= 0 || attacker.carryingRescueId) return null;
    // Battery Frame (Frame Systems Layer refit, 6 Sep 2026) — "cannot move
    // and attack the same turn." Refused here, at the action-economy gate,
    // so an overwatch reaction shot (resolveAttack via triggerOverwatch,
    // which never passes through this verb) is deliberately NOT blocked: a
    // held shot is fired from where the unit already stood.
    if (cannotAttackAfterMoving(attacker)) return null;
    const outcome = this.resolveAttack(attackerId, defenderId);
    // Overpressure Regulator (same pass) — the x1.4 rides this unit's FIRST
    // basic attack of the mission; mark it spent once that attack has
    // actually resolved, hit or dodge, so a refused attack (null) doesn't
    // burn it. Reaction shots don't spend it either, for the same reason as
    // the Battery Frame gate above: the system reads "your first attack."
    if (outcome) attacker.overpressureSpent = true;
    return outcome;
  }

  /**
   * Combat forecast (1 Sep 2026 — feature-gap report A1, the Build Brief's
   * own step-10 "combat forecast popup" that was never built). The numbers
   * a player sees BEFORE committing an attack: what this hit would deal,
   * whether it downs the target, what comes back as a counter, and the
   * Meeps dodge odds on each direction. Read-only — it runs the exact same
   * resolver functions resolveAttack() below runs (resolveMechAttack /
   * resolveAttackOnBloom, both pure), with the two dodge rolls held at
   * "no dodge" and the chance reported separately, so the forecast can
   * never disagree with the hit that follows it except by a dodge. Same
   * guards as resolveAttack (living, opposite sides, in range) and the
   * same ambush-decloak / charge multipliers, applied the same way.
   * Deliberately does NOT check actionsRemaining: the UI wants to show a
   * forecast for a unit the moment it's selected, and "can you actually
   * fire" is attack()'s question, not this one's.
   */
  forecastAttack(attackerId: string, defenderId: string): AttackForecast | null {
    const attacker = this.unitById(attackerId);
    const defender = this.unitById(defenderId);
    if (!attacker || !defender || attacker.downed || defender.downed) return null;
    if (attacker.side === defender.side) return null;
    if (attacker.kind === "bloom") return null; // player-side forecasts only — a Bloom is never the selected unit
    const d = chebyshevDistance(attacker.pos, defender.pos);
    if (d < attacker.attackRange[0] || d > attacker.attackRange[1]) return null;

    const sameSideAsAttacker = this.units.filter((u) => u.side === attacker.side);
    const sameSideAsDefender = this.units.filter((u) => u.side === defender.side);
    const decloakStrike = !!attacker.concealed && attacker.stealthTurnsRemaining !== undefined && attacker.stealthTurnsRemaining > 0;
    const mult = decloakStrike ? AMBUSH_DECLOAK_DAMAGE_MULTIPLIER : 1;
    // Mirror rollMeepsDodge's condition exactly (minus the roll itself).
    const dodgeChanceFor = (unit: BattleUnit, source: BattleUnit) => (unit.path === "meeps" && source.path !== "tank" ? MEEPS_DODGE_CHANCE : 0);

    if (defender.kind !== "bloom") {
      const r = resolveMechAttack(this.map, attacker, defender, sameSideAsDefender, sameSideAsAttacker, attacker.chargedThisMove, false, false, {
        attackerKillsThisMission: this.killsThisMissionFor(attacker),
        defenderKillsThisMission: this.killsThisMissionFor(defender),
      });
      const damage = r.damage * mult;
      const shieldAbsorbed = Math.min(defender.shield ?? 0, damage);
      const defenderHpAfter = Math.max(0, defender.currentHp - (damage - shieldAbsorbed));
      const counterDamage = r.countered && r.counterDamage !== undefined ? r.counterDamage : 0;
      const attackerShield = Math.min(attacker.shield ?? 0, counterDamage);
      const attackerHpAfter = Math.max(0, attacker.currentHp - (counterDamage - attackerShield));
      return {
        attackerId,
        defenderId,
        damage,
        dodgeChance: dodgeChanceFor(defender, attacker),
        shieldAbsorbed,
        defenderHpAfter,
        defenderDowned: defenderHpAfter <= 0,
        countered: r.countered,
        counterDamage,
        counterDodgeChance: r.countered ? dodgeChanceFor(attacker, defender) : 0,
        attackerHpAfter,
        decloakStrike,
        charged: attacker.chargedThisMove,
        defenderStruckFirst: r.defenderStruckFirst,
      };
    }

    // Bloom defender — Data Pack §8.3's two-pool Collapse rule, mirrored
    // from combat.ts's applyBloomDamage without mutating anything:
    // Endurance soaks first and overflow does NOT carry, so a shelled
    // creature can never die to one hit; once collapsed, a hit of at least
    // Vitality kills outright, a smaller one chips.
    const r = resolveAttackOnBloom(this.map, attacker, defender, sameSideAsDefender, attacker.chargedThisMove, {
      attackerKillsThisMission: this.killsThisMissionFor(attacker),
    });
    const damage = r.damage * mult;
    const endurance = defender.endurance ?? 0;
    const vitality = defender.vitality ?? 0;
    let defenderHpAfter: number;
    let defenderDowned = false;
    if (endurance > 0) {
      defenderHpAfter = Math.max(0, endurance - damage) + vitality;
    } else if (damage >= vitality) {
      defenderHpAfter = 0;
      defenderDowned = true;
    } else {
      defenderHpAfter = vitality - damage;
    }
    return {
      attackerId,
      defenderId,
      damage,
      dodgeChance: 0,
      shieldAbsorbed: 0,
      defenderHpAfter,
      defenderDowned,
      countered: false,
      counterDamage: 0,
      counterDodgeChance: 0,
      attackerHpAfter: attacker.currentHp,
      decloakStrike,
      charged: attacker.chargedThisMove,
    };
  }

  /**
   * Splash forecast for the two tile-targeted strikes (Fire Support and
   * Missiles), same read-only discipline as forecastAttack: who's inside
   * the blast centred on `target`, and what each would take. Fire Support
   * is a flat FIRE_SUPPORT_DAMAGE to hostiles only (see fireSupport());
   * a Missile runs the per-victim combat formula on EVERY living unit but
   * the caster, friendlies included, with no dodge (see missileStrike()).
   * Returns an empty list for a tile the strike couldn't legally target,
   * so the UI can call it on any hovered tile without pre-checking.
   */
  forecastSplash(unitId: string, target: Coord, kind: "fire_support" | "missile"): SplashForecastEntry[] {
    const attacker = this.unitById(unitId);
    if (!attacker || attacker.downed) return [];
    const inArea = (kind === "fire_support" ? this.getFireSupportAreaFrom(unitId, attacker.pos) : this.getMissileAreaFrom(unitId, attacker.pos)).some(
      (c) => c.x === target.x && c.y === target.y
    );
    if (!inArea) return [];
    const radius = kind === "fire_support" ? this.fireSupportRadius : MISSILE_SPLASH_RADIUS;
    const sameSideAsAttacker = this.units.filter((u) => u.side === attacker.side);
    const out: SplashForecastEntry[] = [];
    for (const victim of this.livingUnits()) {
      if (victim.instanceId === attacker.instanceId) continue;
      if (chebyshevDistance(victim.pos, target) > radius) continue;
      if (kind === "fire_support" && victim.side !== "hostile") continue;
      const sameSideAsVictim = this.units.filter((u) => u.side === victim.side);
      let damage: number;
      if (kind === "fire_support") damage = FIRE_SUPPORT_DAMAGE;
      else if (victim.kind !== "bloom")
        damage = resolveMechAttack(this.map, attacker, victim, sameSideAsVictim, sameSideAsAttacker, attacker.chargedThisMove, false, false, {
          attackerKillsThisMission: this.killsThisMissionFor(attacker),
        }).damage;
      else
        damage = resolveAttackOnBloom(this.map, attacker, victim, sameSideAsVictim, attacker.chargedThisMove, {
          attackerKillsThisMission: this.killsThisMissionFor(attacker),
        }).damage;
      let downed: boolean;
      if (victim.kind !== "bloom") {
        const absorbed = Math.min(victim.shield ?? 0, damage);
        downed = victim.currentHp - (damage - absorbed) <= 0;
      } else {
        downed = (victim.endurance ?? 0) <= 0 && damage >= (victim.vitality ?? 0);
      }
      out.push({ unitId: victim.instanceId, displayName: victim.displayName, side: victim.side, damage, downed });
    }
    return out;
  }

  /**
   * Every rule an attack has, minus the "do you have an action right now"
   * question: range, side, terrain/overshield/dodge/Collapse math,
   * performance + contribution bookkeeping, the log line, and downing.
   * Deliberately one body rather than two, so an overwatch reaction shot
   * cannot drift from a normal shot — same POWER table, same full-HP cap,
   * same counters, same recordPerformance() call, therefore the same
   * campaign points (engine/campaignEconomy.ts scores kills + fractional
   * assists straight off unitPerformance/victimContributions, both written
   * only here).
   *
   * `opts.reaction` changes exactly one thing: the wording of the log line.
   */
  private resolveAttack(attackerId: string, defenderId: string, opts?: { reaction?: boolean }): AttackOutcome | null {
    const attacker = this.unitById(attackerId);
    const defender = this.unitById(defenderId);
    if (!attacker || !defender || attacker.downed || defender.downed) return null;
    if (attacker.side === defender.side) return null;
    const d = chebyshevDistance(attacker.pos, defender.pos);
    if (d < attacker.attackRange[0] || d > attacker.attackRange[1]) return null;

    // Past every guard above — this is a real, resolving attack. Reset the
    // stall-nudge counter (see its own comment by the field declaration).
    // Every attack in the game funnels through this one method, so this is
    // the only reset site that can't drift from any individual verb.
    this.turnsWithoutContact = 0;

    const sameSideAsAttacker = this.units.filter((u) => u.side === attacker.side);
    const sameSideAsDefender = this.units.filter((u) => u.side === defender.side);

    // Ambush stealth cloak redesign (30 Aug 2026) — read BEFORE any damage
    // resolves: this is the specific attack that breaks an active cloak
    // (attacker.concealed still true, attacker.stealthTurnsRemaining still
    // counting down), which is the decloak strike the redesign's 2x bonus
    // is for. Gated on stealthTurnsRemaining specifically, not just
    // `concealed`, so an abil_screen-concealed unit's attack — same
    // `concealed` flag, no stealthTurnsRemaining — never gets it; only
    // ambush's own cloak does. Computed once, applied in whichever of the
    // two player-attacker branches below actually fires (the third, Bloom
    // attacking a mech, can never have an ambush-cloaked attacker).
    const ambushDecloakStrike =
      !!attacker.concealed && attacker.stealthTurnsRemaining !== undefined && attacker.stealthTurnsRemaining > 0;

    let outcome: AttackOutcome;
    if (attacker.kind !== "bloom" && defender.kind !== "bloom") {
      const defenderDodged = rollMeepsDodge(defender, attacker, this.rng);
      const attackerDodgedCounter = rollMeepsDodge(attacker, defender, this.rng);
      const r = resolveMechAttack(
        this.map,
        attacker,
        defender,
        sameSideAsDefender,
        sameSideAsAttacker,
        attacker.chargedThisMove,
        defenderDodged,
        attackerDodgedCounter,
        // ledger_entry (Vault Phase 2, slice 2) — 0 kills is a no-op for
        // every attacker/defender without the ability, same "harmless
        // default" every other opts field here follows.
        { attackerKillsThisMission: this.killsThisMissionFor(attacker), defenderKillsThisMission: this.killsThisMissionFor(defender) }
      );
      const dealt = ambushDecloakStrike ? r.damage * AMBUSH_DECLOAK_DAMAGE_MULTIPLIER : r.damage;
      applyMechDamage(defender, dealt);
      if (r.countered && r.counterDamage !== undefined) applyMechDamage(attacker, r.counterDamage);
      this.applyGrinderClawHeal(attacker, dealt);
      // Scattershot Pistols cleave — only reachable from this branch (mech
      // attacking mech-shape defender), see applyScattershotCleave()'s own
      // comment for the full mechanism. r.dodged is the PRIMARY defender's
      // dodge roll; a dodged primary hit never cleaves (nothing landed to
      // cleave off of).
      // `|| attacker.downed` (6 Sep 2026): a Runemaster defender's
      // pre-emptive counter can down the attacker before their own hit
      // is thrown — and a hit that was never thrown doesn't cleave either.
      this.applyScattershotCleave(attacker, defender, r.dodged === true || attacker.downed, ambushDecloakStrike, sameSideAsAttacker);
      outcome = {
        attackerId,
        defenderId,
        damage: dealt,
        countered: r.countered,
        counterDamage: r.counterDamage,
        defenderDowned: defender.downed,
        attackerDowned: attacker.downed,
        defenderDodged: r.dodged,
        counterDodged: r.counterDodged,
        defenderStruckFirst: r.defenderStruckFirst,
      };
    } else if (attacker.kind !== "bloom" && defender.kind === "bloom") {
      const r = resolveAttackOnBloom(this.map, attacker, defender, sameSideAsDefender, attacker.chargedThisMove, {
        attackerKillsThisMission: this.killsThisMissionFor(attacker),
      });
      const dealt = ambushDecloakStrike ? r.damage * AMBUSH_DECLOAK_DAMAGE_MULTIPLIER : r.damage;
      applyBloomDamage(defender, dealt);
      this.applyGrinderClawHeal(attacker, dealt);
      outcome = { attackerId, defenderId, damage: dealt, countered: false, defenderDowned: defender.downed };

      // Mech on-hit effects (engine/turnManager.ts's applyMechOnHitEffect,
      // 3 Sep 2026, widened 4 Sep 2026 for Riot Drum's knockback) — the
      // reverse direction of the Bloom on-hit effects engine below: a
      // mech's own equipped weapon branch applying an effect to the Bloom
      // it just hit. resolveAttackOnBloom has no dodge concept at all
      // (Bloom don't dodge — that's a Meeps house rule for mech-vs-mech
      // only), so the only guard needed here is "did the hit actually leave
      // a defender standing to affect," mirroring applyBloomOnHitEffect's
      // own no-op-on-a-downed-defender guard rather than duplicating it —
      // outcome.defenderDowned already reflects applyBloomDamage's result
      // by this line.
      //
      // WEAPON_BRANCH_ON_HIT_EFFECT is a LIST per branch (widened 4 Sep
      // 2026 — Riot Drum is the first branch with more than one entry), so
      // this loops and rolls each entry independently: Shock Claws' own
      // single-entry list behaves exactly as before (one roll, same
      // chance), Riot Drum's two-entry list can proc knockback, pin, both,
      // or neither off the same hit. `occupied` is only actually read by a
      // "knockback"-kind fx (Riot Drum) — computed unconditionally here
      // anyway, same "cheap enough not to special-case" call as the
      // identical computation a few lines below for Borrowed Authority.
      // `sameSideAsDefender` (Suppression Autocannon, 5 Sep 2026) is only
      // actually read by a "debuff_attack"-kind fx — already computed at
      // the top of this method for resolveAttackOnBloom's own call, reused
      // here rather than recomputed.
      if (!outcome.defenderDowned) {
        // Second mount (6 Sep 2026): every live branch's on-hit list, in mount
        // order — each entry still rolls independently, exactly as Riot Drum's
        // own two-entry list already did, so a Tank carrying Riot Drum AND
        // (say) a future second on-hit branch rolls all of them.
        const branchFx = unitBranches(attacker).flatMap((id) => WEAPON_BRANCH_ON_HIT_EFFECT[id] ?? []);
        if (branchFx.length) {
          const occupied = new Set(
            this.units.filter((u) => !u.downed && u.instanceId !== defender.instanceId).map((u) => coordKey(u.pos))
          );
          for (const fx of branchFx) {
            if (this.rng() >= fx.chance) continue;
            applyMechOnHitEffect(fx.fxId, attacker, defender, sameSideAsDefender, this.map, occupied);
            // Log wording is per-fxId, same as Scattershot Pistols' own
            // cleave log line a few methods below (branch-specific text,
            // not a generic template) — the LOOKUP and APPLICATION above
            // this line are the genuinely generic parts; a future fxId
            // adds its own line here alongside these, not a replacement.
            if (fx.fxId === "fx_riot_drum_knockback") this.log.push(`${defender.displayName} is knocked back!`);
            else if (fx.fxId === "fx_riot_drum_pin") this.log.push(`${defender.displayName} is pinned!`);
            else if (fx.fxId === "fx_suppression_autocannon_debuff") this.log.push(`${defender.displayName}'s attack is suppressed!`);
            else this.log.push(`${defender.displayName} is stunned!`);
          }
        }
      }

      // seal_borrowed_authority (Simulacrum/The Stolen Seal, Vault Phase 2
      // slice 6, 3 Sep 2026) — consumes a primed copy on THIS SAME "mech
      // attacks a Bloom" branch, the one the task's own brief calls out as
      // the reachable path (see BattleUnit.borrowedAuthorityFxKind's own
      // comment for why the scope is narrowed to this branch specifically).
      // Cleared regardless of whether the defender survived to receive it
      // (the wielder's "next attack" was spent either way) — but the effect
      // itself only actually applies via applyCopiedOnHitEffect while
      // !outcome.defenderDowned, same guard the branchFx block right above
      // already uses, since a downed defender has nothing left to affect.
      if (attacker.borrowedAuthorityFxKind) {
        const copiedKind = attacker.borrowedAuthorityFxKind;
        attacker.borrowedAuthorityFxKind = undefined;
        if (!outcome.defenderDowned) {
          const occupied = new Set(
            this.units.filter((u) => !u.downed && u.instanceId !== defender.instanceId).map((u) => coordKey(u.pos))
          );
          applyCopiedOnHitEffect(copiedKind, attacker, defender, sameSideAsDefender, this.map, occupied);
          this.log.push(`${attacker.displayName}'s Borrowed Authority copies a ${copiedKind} effect onto ${defender.displayName}.`);
        }
      }
    } else {
      // Bloom attacking a mech-shape defender.
      const surfaced = !!attacker.burrowed; // a burrowed unit that is attacking has just surfaced this turn
      if (attacker.burrowed) attacker.burrowed = false;
      const defenderDodged = rollMeepsDodge(defender, attacker, this.rng);
      const dmg = bloomDamage(attacker, defender, this.map, sameSideAsDefender, surfaced, defenderDodged);
      applyMechDamage(defender, dmg);
      outcome = { attackerId, defenderId, damage: dmg, countered: false, defenderDowned: defender.downed, defenderDodged };

      // Bloom on-hit effects engine (engine/turnManager.ts, 27 Aug 2026) —
      // data/bloom.ts's own BLOOM_ON_HIT_EFFECTS, wired for real for the
      // first time. Only reachable from this branch: onHit is a property
      // of Bloom archetypes, and this is the only place a Bloom is ever the
      // attacker against a mech-shape (player or hostile-mech) defender.
      // Skipped on a dodge (defenderDodged already zeroed dmg to 0 in
      // bloomDamage — a hit that never landed shouldn't DoT/debuff/knock
      // back the target either) and applyBloomOnHitEffect's own guard
      // no-ops if the hit downed the defender outright.
      if (!defenderDodged) {
        const fxId = BLOOM[attacker.archetypeId]?.onHit;
        if (fxId) {
          const occupied = new Set(
            this.units.filter((u) => !u.downed && u.instanceId !== defender.instanceId).map((u) => coordKey(u.pos))
          );
          const fxResult = applyBloomOnHitEffect(fxId, attacker, defender, sameSideAsDefender, this.map, occupied);
          if (fxResult.tileConvertedAt) {
            const { x, y } = fxResult.tileConvertedAt;
            this.map.tiles[y][x] = "bloom_mat";
          }
        }
      }
    }

    this.recordPerformance(attacker, defender, outcome);
    // Gjallar/Requiem's charge meter (Vault Phase 2, slice 7, 3 Sep 2026) —
    // see accrueRequiemCharge's own comment (this file's "Vault Phase 2,
    // slice 7" section) for why THIS is the one correct choke point: every
    // ordinary attack in the game funnels through resolveAttack (see this
    // method's own turnsWithoutContact-reset comment above), and `outcome`
    // already carries the uniform shape recordPerformance just consumed on
    // the line above — same reasoning, same call site.
    this.accrueRequiemCharge(attacker, defender, outcome);

    // Attack always consumes every remaining action and ends the unit's
    // turn, regardless of which action slot it's used in (two-action house
    // rule, Maxime, 22 Aug 2026 — matches XCOM 2: you can heal then heal,
    // but never heal then shoot then heal again). A reaction shot's attacker
    // is already at 0 (enterOverwatch zeroed it), so this is a no-op there.
    attacker.actionsRemaining = 0;
    // Firing gives your position away (ability-depth pass, 23 Aug 2026):
    // any concealment from abil_ambush or abil_screen ends the instant this
    // unit attacks, and it ends HERE rather than in attack() so a Meeps'
    // own ambush shot resolved through this same body breaks it too. Stealth
    // cloak redesign (30 Aug 2026): stealthTurnsRemaining is cleared in the
    // same breath — the decloak bonus above already read it for THIS
    // attack, so there is nothing left for it to track once concealed is
    // gone. A screen-concealed unit never had it set, so this is a no-op
    // for that case, same as it always was.
    attacker.concealed = false;
    attacker.stealthTurnsRemaining = undefined;
    let msg = opts?.reaction
      ? `${attacker.displayName} fires overwatch on ${defender.displayName}`
      : `${attacker.displayName} attacks ${defender.displayName}`;
    // Stealth cloak redesign (30 Aug 2026) — call out the decloak strike by
    // name in the log, same spirit as the DODGED/countered tags below: this
    // is the one attack in the game that just quietly hit twice as hard, and
    // the log should say why rather than leave a player to infer it from an
    // oddly large number.
    if (ambushDecloakStrike) msg += " — DECLOAK STRIKE";
    // Runemaster initiative (6 Sep 2026): when the defender struck first,
    // say so and put the counter BEFORE the hit in the text too, so the log
    // reads in the order things actually happened — including the case
    // where the pre-emptive counter downed the attacker and no hit landed.
    if (outcome.defenderStruckFirst) {
      msg += outcome.counterDodged ? " — the defender strikes first (initiative), DODGED (Meeps)" : ` — the defender strikes first (initiative) for ${outcome.counterDamage}`;
      if (outcome.attackerDowned) msg += "; the attack never lands";
      else msg += outcome.defenderDodged ? ", then the hit is DODGED (Meeps)" : `, then hits for ${outcome.damage}`;
      this.log.push(msg);
    } else {
      msg += outcome.defenderDodged ? " — DODGED (Meeps)" : ` for ${outcome.damage}`;
      if (outcome.countered) {
        msg += outcome.counterDodged ? ", counter DODGED (Meeps)" : ` (countered for ${outcome.counterDamage})`;
      }
      this.log.push(msg);
    }

    if (outcome.defenderDowned) this.handleDowned(defender);
    if (outcome.attackerDowned) this.handleDowned(attacker);

    return outcome;
  }

  /**
   * Campaign economy pass — bookkeeping only, no effect on combat math or
   * outcomes: reads the already-computed AttackOutcome and credits
   * damage/kills to whichever pilot's mek actually dealt each portion of
   * it. Called once per attack() resolution, after `outcome` is built and
   * before the two damage-application calls above have any further
   * consequence, so it works identically across all three attack
   * branches (mech-vs-mech, mech-vs-bloom, bloom-vs-mech) without needing
   * branch-specific logic — every branch already funnels into the same
   * AttackOutcome shape.
   *
   * Two credited categories, deliberately not just one:
   *   - `attacker`'s primary hit (outcome.damage / outcome.defenderDowned).
   *   - `defender`'s own counter-hit back (outcome.counterDamage /
   *     outcome.attackerDowned), when the defender is the one who
   *     survived and countered. Judgment call, not spelled out in the
   *     brief's formula: a counter is the defender's OWN mek acting, not
   *     the attacker's, so it's credited to the defender, separately from
   *     the primary hit — excluding counter damage entirely would
   *     arbitrarily punish counter-built pilots (Tanks especially) for
   *     doing exactly what their kit is for. A "kill" via counter (the
   *     defender's counter-hit is what actually downs the original
   *     hostile attacker) counts the same as a kill via a direct attack.
   *
   * Only ever credits player pilots (creditDamage/creditKill no-op on an
   * undefined pilotId) — hostile mechs and Bloom have none, so this never
   * needs a side check of its own; the pilotId lookup already does it.
   *
   * Contribution tracking (recordContribution/resolveKill, added alongside
   * assistCredit — see ASSIST_MIN_FRACTION's comment above) is gated on
   * `defender.side === "hostile"` / `attacker.side === "hostile"`,
   * mirroring creditKill's own existing gate exactly: a "victim" only
   * needs a contribution bucket at all if it's possible for it to resolve
   * into a kill, and only a hostile can ever be killed here.
   */
  private recordPerformance(attacker: BattleUnit, defender: BattleUnit, outcome: AttackOutcome): void {
    this.creditDamage(attacker.pilotId, outcome.damage);
    this.creditDamageTaken(defender.pilotId, outcome.damage);
    if (outcome.countered && outcome.counterDamage) this.creditDamageTaken(attacker.pilotId, outcome.counterDamage);
    if (defender.side === "hostile") {
      this.recordContribution(defender.instanceId, attacker.pilotId, outcome.damage);
      if (outcome.defenderDowned) this.resolveKill(defender.instanceId, attacker.pilotId);
    }

    if (outcome.countered && outcome.counterDamage) {
      this.creditDamage(defender.pilotId, outcome.counterDamage);
      if (attacker.side === "hostile") {
        this.recordContribution(attacker.instanceId, defender.pilotId, outcome.counterDamage);
        if (outcome.attackerDowned) this.resolveKill(attacker.instanceId, defender.pilotId);
      }
    }
  }

  private creditDamage(pilotId: string | undefined, amount: number): void {
    if (!pilotId || amount <= 0) return;
    const perf = this.unitPerformance[pilotId];
    if (perf) perf.damageDealt += amount;
  }

  private creditKill(pilotId: string | undefined): void {
    if (!pilotId) return;
    const perf = this.unitPerformance[pilotId];
    if (perf) perf.kills += 1;
  }

  /** Telemetry (1 Sep 2026) — see UnitPerformance.damageTaken. Silent for non-pilots (hostiles, NPCs, civilians). */
  private creditDamageTaken(pilotId: string | undefined, amount: number): void {
    if (!pilotId || amount <= 0) return;
    const perf = this.unitPerformance[pilotId];
    if (perf) perf.damageTaken += amount;
  }

  /** Telemetry (1 Sep 2026) — see UnitPerformance.abilitiesUsed. Called once per successful ability verb, at the verb's own commit point. */
  private noteAbilityUse(unit: BattleUnit, abilityId: string): void {
    if (!unit.pilotId) return;
    const perf = this.unitPerformance[unit.pilotId];
    if (!perf) return;
    perf.abilitiesUsed[abilityId] = (perf.abilitiesUsed[abilityId] ?? 0) + 1;
  }

  private creditAssist(pilotId: string | undefined, fraction: number): void {
    if (!pilotId) return;
    const perf = this.unitPerformance[pilotId];
    if (perf) perf.assistCredit += fraction;
  }

  /** Tallies `pilotId`'s running damage contribution against one specific victim, keyed by that victim's instanceId — see `victimContributions`'s own field comment. */
  private recordContribution(victimInstanceId: string, pilotId: string | undefined, amount: number): void {
    if (!pilotId || amount <= 0) return;
    const bucket = (this.victimContributions[victimInstanceId] ??= {});
    bucket[pilotId] = (bucket[pilotId] ?? 0) + amount;
  }

  /**
   * A victim just went down. `finisherPilotId` gets the kill (unchanged
   * behavior). Everyone else who's in that victim's contribution bucket —
   * i.e. damaged it at some earlier point this mission without being the
   * one who finished it — gets a combat assist, weighted by their share of
   * the total damage the whole squad dealt to it (ASSIST_MIN_FRACTION's
   * comment above has the exact rule). The bucket is deleted once
   * resolved: this victim is done, nothing more can ever be credited
   * against it.
   */
  private resolveKill(victimInstanceId: string, finisherPilotId: string | undefined): void {
    this.creditKill(finisherPilotId);
    // ledger_entry (Skuld/Widow's Ledger) rank 5's one-time move-range bonus
    // — "the bonus also applies to move range past 3 stacks." Fires the
    // instant this wielder's own kill count (creditKill just incremented it
    // above) first exceeds LEDGER_ENTRY_MOVE_BONUS_THRESHOLD, guarded by
    // ledgerEntryMoveBonusApplied so a later kill never re-adds it — see
    // that constant's own comment in data/combatTables.ts for why this is a
    // one-time grant, not per-stack scaling.
    if (finisherPilotId) {
      const finisher = this.units.find((u) => u.pilotId === finisherPilotId);
      if (
        finisher &&
        finisher.abilities.includes("ledger_entry") &&
        this.heirloomRank(finisher, "ledger_entry") >= 5 &&
        !finisher.ledgerEntryMoveBonusApplied &&
        (this.unitPerformance[finisherPilotId]?.kills ?? 0) > LEDGER_ENTRY_MOVE_BONUS_THRESHOLD
      ) {
        finisher.moveRange += LEDGER_ENTRY_MOVE_BONUS_AMOUNT;
        finisher.ledgerEntryMoveBonusApplied = true;
        this.log.push(`${finisher.displayName}'s ledger turns to move — +${LEDGER_ENTRY_MOVE_BONUS_AMOUNT} move range for the rest of the mission.`);
      }
    }
    const victim = this.unitById(victimInstanceId);
    if (victim && victim.side === "hostile") this.hostileKills[victim.archetypeId] = (this.hostileKills[victim.archetypeId] ?? 0) + 1;
    const bucket = this.victimContributions[victimInstanceId];
    if (bucket) {
      const total = Object.values(bucket).reduce((sum, v) => sum + v, 0);
      if (total > 0) {
        for (const [pilotId, amount] of Object.entries(bucket)) {
          if (pilotId === finisherPilotId) continue; // the finisher already got the kill — no double-dipping an assist on their own kill
          const share = Math.min(1, amount / total);
          const fraction = ASSIST_MIN_FRACTION + (ASSIST_MAX_FRACTION - ASSIST_MIN_FRACTION) * share;
          this.creditAssist(pilotId, fraction);
        }
      }
      delete this.victimContributions[victimInstanceId];
    }
  }

  /**
   * Field Doctor (Weapon Branch Point System, data/weaponBranches.ts,
   * 1 Sep 2026) — true when `unit` has the branch equipped AND its once-
   * per-FIELD_DOCTOR_COOLDOWN_TURNS bonus is off cooldown. Reuses the
   * generic per-unit `BattleUnit.abilityCooldowns` map (engine/cooldown.ts)
   * under the real "abil_repair" ability id, rather than a synthetic key —
   * per that map's own header comment, the first ability to actually write
   * to it since it was scaffolded 28 Aug 2026. Shared by getRepairableFrom
   * (the UI highlight source) and repairUnit (the verb) so the two can't
   * fall out of sync the way DEFAULT_REPAIR_RANGE's own history already
   * warns against.
   */
  private fieldDoctorBonusReady(unit: BattleUnit): boolean {
    return unitHasBranch(unit, "munti_field_doctor") && isCooldownReady(this.cooldownReadyTurn(unit, "abil_repair"), this.turn);
  }

  /**
   * Public wrapper around fieldDoctorBonusReady, by unit id — exposed for
   * the UI. scenes/Battle.ts gates both unit-selection paths (Tab-cycle and
   * click-select) on `actionsRemaining > 0`; without this, a Munti who's
   * already spent both actions this turn would be unselectable the moment
   * Field Doctor is the only reason left to interact with them, making the
   * whole branch unreachable through real play even though
   * repairUnit()/getRepairableFrom() already support it correctly. Both
   * selection guards below now read this alongside their existing
   * actionsRemaining check.
   */
  fieldDoctorReady(unitId: string): boolean {
    const unit = this.unitById(unitId);
    if (!unit) return false;
    return this.fieldDoctorBonusReady(unit);
  }

  /**
   * Repair, instead of attacking: restore HP to one adjacent friendly unit.
   * Costs 1 action and does not end the turn (two-action house rule,
   * Maxime, 22 Aug 2026) — a healer with two actions free can Repair twice
   * in the same turn, on two different allies, same as an XCOM Specialist's
   * Medikit. No separate once-per-turn cap any more; actionsRemaining is
   * the only limit — EXCEPT for Field Doctor (1 Sep 2026, see
   * fieldDoctorBonusReady above): a Munti with that branch equipped and
   * its bonus off cooldown can still Repair with zero actions left, once,
   * for free, then the bonus goes on cooldown for FIELD_DOCTOR_COOLDOWN_TURNS.
   * Baseline actions are always spent first — the free bonus only ever
   * fires once actionsRemaining is already 0, same "baseline pool spent
   * first" shape as the Weapons Bay's own bonus Fire Support charge
   * (fireSupport() below).
   */
  repairUnit(healerId: string, targetId: string): RepairOutcome | null {
    const healer = this.unitById(healerId);
    const target = this.unitById(targetId);
    if (!healer || !target || healer.downed || target.downed) return null;
    const usingFieldDoctorBonus = healer.actionsRemaining <= 0 && this.fieldDoctorBonusReady(healer);
    if (healer.actionsRemaining <= 0 && !usingFieldDoctorBonus) return null;
    if (!healer.abilities.includes("abil_repair")) return null;
    if (healer.side !== target.side || healer.instanceId === target.instanceId) return null;
    // Rapid Response (Weapon Branch Point System, data/weaponBranches.ts,
    // 27 Aug 2026) — extends Repair's range from adjacent-only to 2 tiles
    // for a Munti who's bought and equipped this branch. Everyone else
    // keeps the original DEFAULT_REPAIR_RANGE (1) hardcoded rule above.
    const repairRange = repairRangeFor(healer);
    if (chebyshevDistance(healer.pos, target.pos) > repairRange) return null;

    const healAmount = repairHealAmount(healer);
    const amount = Math.max(0, Math.min(healAmount, target.maxHp - target.currentHp));
    target.currentHp += amount;
    if (usingFieldDoctorBonus) {
      healer.abilityCooldowns = healer.abilityCooldowns ?? {};
      healer.abilityCooldowns["abil_repair"] = startCooldown(this.turn, FIELD_DOCTOR_COOLDOWN_TURNS);
    } else {
      healer.actionsRemaining -= 1;
    }
    this.noteAbilityUse(healer, "abil_repair");
    // Campaign economy pass, point-formula correction (22 Aug 2026):
    // Qiraki_Weapons_And_Progression.md's locked scoring rule names
    // "healing/repair actions" as an assist in their own right — see
    // REPAIR_ASSIST_FRACTION's comment above UnitPerformance. Only a
    // repair that actually restored HP counts (amount > 0), same
    // "did-it-actually-do-anything" guard creditDamage already uses.
    if (amount > 0) this.creditAssist(healer.pilotId, REPAIR_ASSIST_FRACTION);
    this.log.push(
      `${healer.displayName} repairs ${target.displayName} for ${amount} HP${
        usingFieldDoctorBonus ? ` (Field Doctor — free, ready again in ${FIELD_DOCTOR_COOLDOWN_TURNS} turns)` : ""
      }`
    );
    return { healerId, targetId, amount };
  }

  /**
   * Grinder Claw (Weapon Branch Point System, data/weaponBranches.ts,
   * 27 Aug 2026) — a Tank who's bought and equipped this branch heals a
   * fraction of the damage they just DEALT, not received, and only when
   * the hit actually lands (damageDealt > 0 — a dodge or a miss heals
   * nothing). Called from resolveAttack() right after the damage is
   * applied, for both the mech-vs-mech and mech-vs-Bloom branches.
   */
  private applyGrinderClawHeal(attacker: BattleUnit, damageDealt: number): void {
    if (!unitHasBranch(attacker, "tank_grinder_claw") || damageDealt <= 0) return;
    const healAmount = Math.round(damageDealt * GRINDER_CLAW_HEAL_PCT);
    if (healAmount <= 0) return;
    const before = attacker.currentHp;
    attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + healAmount);
    const actual = attacker.currentHp - before;
    if (actual > 0) this.log.push(`${attacker.displayName}'s Grinder Claw heals ${actual} HP`);
  }

  /**
   * Scattershot Pistols (Weapon Branch Point System, data/weaponBranches.ts,
   * 3 Sep 2026) — a Meeps who's bought and equipped this branch cleaves a
   * landed primary hit onto a second enemy unit, IF one happens to be
   * adjacent to the PRIMARY TARGET (Chebyshev <= 1) — not adjacent to the
   * attacker. Called from resolveAttack()'s mech-vs-mech branch only, right
   * after the primary hit is applied; `primaryDodged` gates the whole thing
   * (a dodged primary hit lands on nobody, so there is nothing to cleave
   * off of) and this is the only guard against firing on a miss.
   *
   * Second-target selection is a plain `.find()` over livingUnits() —
   * first match in engine unit order (spawn/deploy order), NOT "closest"
   * or "lowest HP." With min range 1, a real two-or-more-adjacent-enemies
   * case is possible; no documented tie-break exists for it yet, worth a
   * real rule once a playtest actually produces one, cheap to change here
   * in one place if so.
   *
   * Scope calls made here, each worth being explicit about rather than
   * quietly picked:
   *   - The second target must be mech-shape (kind !== "bloom"). Bloom
   *     defenders run a different formula with no defense stat
   *     (resolveAttackOnBloom) and no shield/downed shape symmetry with
   *     applyMechDamage — folding that in was real scope, not a one-line
   *     add, so it's deferred rather than guessed at. A Bloom standing
   *     next to a mech target is simply never cleaved onto by this pass.
   *   - The cleave hit runs resolveMechAttack fresh against the SECOND
   *     target's own stats (its own defense/terrain), the same way every
   *     other multi-victim effect in this file (missileStrike) computes
   *     per-victim damage rather than splitting the primary's own number —
   *     then SCATTERSHOT_PISTOLS_CLEAVE_PCT is applied on top of that
   *     result, and the ambush-decloak multiplier (same flag as the
   *     primary hit, since this is the same attack event breaking the same
   *     cloak) is applied before the cleave fraction, matching the order
   *     `dealt` uses for the primary hit just above this call.
   *   - The second target's OWN Meeps-dodge chance is rolled and honored
   *     (rollMeepsDodge, same as any other hit) — deliberately NOT the
   *     "splash can't be dodged" treatment missileStrike uses for its
   *     explosion (see that method's own comment for why an explosion
   *     covering the whole blast tile isn't dodge-eligible the way an
   *     aimed shot is). A pistol cleaving onto a second target is still an
   *     aimed shot, just a secondary one — closer in kind to the primary
   *     hit it rides on than to a blast radius.
   *   - The cleave hit does NOT draw a counterattack, even if the second
   *     target could otherwise counter at this range. Same spirit as
   *     RAIL_LANCE_DEF_IGNORE_PCT's own "not applied to the counter" call
   *     (combat.ts) — this is a small bonus effect riding on the real
   *     attack, not a second full exchange, and letting it draw a counter
   *     would make equipping this branch strictly worse in melee than not
   *     having it whenever a second enemy happens to be adjacent to your
   *     target. resolveMechAttack is still called with defenderDodged as
   *     the only non-default arg (attackerDodgedCounter left false) purely
   *     because the counter branch's own result fields are simply never
   *     read below, not because a counter roll happens and is suppressed.
   *   - Credited through the same recordPerformance() every other hit in
   *     this file uses, so a cleave kill counts for campaign-economy
   *     scoring exactly like a direct one, and handleDowned() runs if it
   *     downs the second target — mirroring missileStrike's own per-victim
   *     bookkeeping (this.recordPerformance + this.handleDowned) rather
   *     than inventing a separate path.
   */
  private applyScattershotCleave(
    attacker: BattleUnit,
    primaryTarget: BattleUnit,
    primaryDodged: boolean,
    ambushDecloakStrike: boolean,
    sameSideAsAttacker: BattleUnit[]
  ): void {
    if (!unitHasBranch(attacker, "meeps_scattershot_pistols") || primaryDodged) return;
    const secondTarget = this.livingUnits().find(
      (u) =>
        u.instanceId !== primaryTarget.instanceId &&
        u.instanceId !== attacker.instanceId &&
        u.side === primaryTarget.side &&
        u.kind !== "bloom" &&
        chebyshevDistance(u.pos, primaryTarget.pos) <= 1
    );
    if (!secondTarget) return; // no second enemy adjacent to the primary target — the hit just lands on the one target, no crash, no wasted effect

    const sameSideAsSecondTarget = this.units.filter((u) => u.side === secondTarget.side);
    const secondDodged = rollMeepsDodge(secondTarget, attacker, this.rng);
    const r = resolveMechAttack(this.map, attacker, secondTarget, sameSideAsSecondTarget, sameSideAsAttacker, attacker.chargedThisMove, secondDodged, false, {
      attackerKillsThisMission: this.killsThisMissionFor(attacker),
    });
    let cleaveDmg = ambushDecloakStrike ? r.damage * AMBUSH_DECLOAK_DAMAGE_MULTIPLIER : r.damage;
    cleaveDmg = Math.round(cleaveDmg * SCATTERSHOT_PISTOLS_CLEAVE_PCT);
    if (cleaveDmg <= 0) return; // dodged, or rounded to nothing against a well-defended second target — no phantom damage, no log line

    applyMechDamage(secondTarget, cleaveDmg);
    this.recordPerformance(attacker, secondTarget, {
      attackerId: attacker.instanceId,
      defenderId: secondTarget.instanceId,
      damage: cleaveDmg,
      countered: false,
      defenderDowned: secondTarget.downed,
    });
    this.log.push(`${attacker.displayName}'s Scattershot Pistols cleave onto ${secondTarget.displayName} for ${cleaveDmg}`);
    if (secondTarget.downed) this.handleDowned(secondTarget);
  }

  // ---- overwatch -----------------------------------------------------
  //
  // Overwatch / reaction fire (Maxime, 23 Aug 2026 — "we really need to make
  // our mission last at least 30min... my xcom mission lasted hours"), the
  // second of the three agreed systems, after fog of war (commit f2e04e4).
  // The point isn't extra damage: it's that ending a turn holding position
  // becomes a real option, so the loop stops being "walk forward, click
  // attack" and starts being "creep, set up, wait." It's built directly on
  // top of the fog of war — you hold overwatch precisely because you can't
  // see what's out there, and the trigger below is vision-gated with the
  // same isVisibleTo() the hostile AI and the fog renderer both use.
  //
  // DELIBERATELY OUT OF SCOPE this pass (flagged, not silently skipped):
  //   - Hostile-side overwatch. `overwatch` is only ever set by
  //     enterOverwatch(), which refuses any non-player unit. Nothing in the
  //     Bloom's own behaviour spec has a hold-fire concept to hang it on:
  //     GDD §5.3's reflexive tier is "move toward the nearest visible
  //     target... no retreat, no focus fire, no self-preservation," and pack
  //     only adds shared targeting. The one phrase that comes close, "hold
  //     reserves until the player commits," is listed under emergent — boss
  //     encounters only, explicitly "do not generalise it," and not built.
  //     So arming the Bloom with overwatch is a design question for Maxime,
  //     not an implementation gap. The trigger loop below is written
  //     side-agnostically enough that flipping it on later is a one-line
  //     change to enterOverwatch's guard.
  //   - Triggering on anything other than hostile MOVEMENT. A hostile
  //     attacking, or using an ability, from where it already stands does
  //     not draw reaction fire. Movement-only is what makes overwatch a
  //     positional threat rather than a flat retaliation aura.
  //   - Multiple reaction shots per overwatch. Firing clears the flag —
  //     it's an ambush, not a turret. (Several DIFFERENT overwatchers can
  //     each fire once at the same mover; that's the intended crossfire.)
  //   - Any accuracy or damage penalty on the reaction shot. XCOM applies
  //     an aim penalty to reaction fire; this pass resolves reaction shots
  //     at full normal strength through the identical resolveAttack() path.
  //     That's a tuning knob Maxime may well want later — the number is
  //     his call, not one to invent here, and the single place it would go
  //     is resolveAttack's `opts`.

  /**
   * Can this unit enter overwatch right now? The UI (scenes/Battle.ts)
   * greys its button off this — the scene owns no rules, so the predicate
   * lives here next to the verb that enforces it.
   */
  canEnterOverwatch(unitId: string): boolean {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed) return false;
    if (unit.side !== "player") return false; // player-only this pass — see the block comment above
    if (unit.overwatch) return false;
    return unit.actionsRemaining > 0;
  }

  /**
   * Enter overwatch instead of acting: hold fire this turn, and take one
   * free shot at the first hostile that moves into range and sight during
   * the hostile phase (triggerOverwatch below).
   *
   * Costs the unit's ENTIRE remaining action budget and ends its turn, the
   * same way attack() does (two-action house rule) rather than the 1-action
   * Move/Repair way — overwatching with an action still in hand would let a
   * unit shoot, then set overwatch, and get two shots per round out of a
   * two-action budget.
   */
  enterOverwatch(unitId: string): boolean {
    if (!this.canEnterOverwatch(unitId)) return false;
    const unit = this.unitById(unitId)!;
    unit.overwatch = true;
    unit.actionsRemaining = 0;
    this.noteAbilityUse(unit, "overwatch");
    this.log.push(`${unit.displayName} holds overwatch.`);
    return true;
  }

  /**
   * A hostile just finished a move. Every player unit currently holding
   * overwatch that can both reach it (its own attackRange) and actually see
   * it (isVisibleTo — the fog-of-war-aware half, and the whole reason this
   * pairs with commit f2e04e4: an overwatcher cannot reaction-fire at
   * something nobody on the board can see, exactly as it cannot normally
   * attack it) fires one shot, in board order.
   *
   * Called from exactly one place — moveHostile(), the single choke point
   * every hostile move goes through — so there is no way to add a hostile
   * movement path later that silently skips reaction fire.
   */
  private triggerOverwatch(mover: BattleUnit): void {
    if (mover.side !== "hostile" || mover.downed) return;
    for (const watcher of this.units) {
      if (mover.downed) return; // an earlier overwatcher already killed it — nothing left to shoot at
      if (!watcher.overwatch || watcher.downed || watcher.side === mover.side) continue;
      const d = chebyshevDistance(watcher.pos, mover.pos);
      if (d < watcher.attackRange[0] || d > watcher.attackRange[1]) continue;
      // Vision-gated exactly as before, now with the clock threaded in
      // (ability-depth pass, 23 Aug 2026) so an abil_sensor_sweep paint
      // counts: a burrower an overwatcher could not otherwise see IS a
      // legal reaction target for as long as it stays painted, and stops
      // being one the moment the paint expires.
      if (!isVisibleTo(watcher, mover, this.turn)) continue;
      // Clear BEFORE resolving, not after: resolveAttack can re-enter this
      // object (handleDowned -> unit_downed events -> spawns), and a shot
      // already in flight must never be able to fire a second time.
      watcher.overwatch = false;
      this.resolveAttack(watcher.instanceId, mover.instanceId, { reaction: true });
    }
  }

  // ---- ability depth: one new verb per path ---------------------------
  //
  // System 3 of the three agreed "make a mission last 30+ minutes" passes
  // (Maxime, 23 Aug 2026), after fog of war (f2e04e4) and overwatch
  // (47ab304). The problem this solves is stated in data/abilities.ts's
  // header: every unit had exactly one verb, so a turn was never a
  // decision. Four new verbs live below, one per path, each written so
  // that using it means NOT shooting:
  //
  //   sensorSweep(id)  Reeps/vibrissal  1 action, turn continues, 2 charges/mission
  //   ambush(id)       Meeps            whole budget, ends turn, unlimited
  //   interdict(id)    Tank             whole budget, ends turn, unlimited
  //   screenAllies(id) Munti            1 action, turn continues, once per mission
  //
  // Every one of them follows enterOverwatch's shape exactly: a canX()
  // predicate the UI greys its button off (scenes/Battle.ts owns no rules
  // and must never re-derive one), then a verb that re-asks the predicate,
  // mutates, logs, and returns something the caller can check. None of them
  // touches engine/combat.ts — no new damage formula exists anywhere in
  // this pass. Between them they reveal, conceal, and take actions away,
  // which is the whole vocabulary.
  //
  // PLAYER-ONLY, every one, exactly like enterOverwatch and for the same
  // reason: these are the four PATHS' abilities and the Bloom don't have
  // paths (data/bloom.ts has no `path` field at all). Hostile mechs DO
  // resolve through arch_<path>_bipedal and therefore now carry
  // abil_ambush/abil_interdict in their `abilities` array as a side effect
  // of the archetype assignment — the `side !== "player"` guard in each
  // predicate below is what makes that inert, and engine/ai.ts's tiers were
  // deliberately not taught to call any of these.
  //
  // DELIBERATELY OUT OF SCOPE, flagged rather than silently skipped:
  //   - Any AI use of these verbs, per the above.
  //   - Concealment breaking on anything other than attacking. Moving,
  //     being healed, and standing in acid do not reveal you; only firing
  //     does. Simple, and it is what makes Screen-then-reposition work.
  //   - Interdiction being consumed by a pin (see abil_interdict's comment).
  //   - abil_cockpit_evac, which remains defined-and-unimplemented. It is
  //     a reactive interception of a downing, not a turn-economy verb, so
  //     it is a different piece of work from this pass and is not started
  //     here.

  /** abil_sensor_sweep's reach for this unit: its own vision, plus the flat overshoot in data/combatTables.ts. */
  private sensorSweepRadius(unit: BattleUnit): number {
    return unit.vision + SENSOR_SWEEP_RANGE_BONUS;
  }

  /** The turn number `abilityId` becomes usable again on this unit (0 = never used / ready). */
  private cooldownReadyTurn(unit: BattleUnit, abilityId: string): number {
    return unit.abilityCooldowns?.[abilityId] ?? 0;
  }

  /** Turns still to wait before `abilityId` is usable on this unit — 0 when it's ready now. Exposed for the HUD. */
  abilityCooldownRemaining(unitId: string, abilityId: string): number {
    const unit = this.unitById(unitId);
    if (!unit) return 0;
    return cooldownTurnsRemaining(this.cooldownReadyTurn(unit, abilityId), this.turn);
  }

  /** Charges of abil_sensor_sweep this unit has left this mission. Exposed for the HUD. Undefined reads as a full, unspent budget — see sensorSweepUsesRemaining's own comment in engine/units.ts. */
  sensorSweepChargesRemaining(unitId: string): number {
    const unit = this.unitById(unitId);
    if (!unit) return 0;
    return unit.sensorSweepUsesRemaining ?? SENSOR_SWEEP_CHARGES_PER_MISSION;
  }

  canSensorSweep(unitId: string): boolean {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed) return false;
    if (unit.side !== "player") return false;
    if (!unit.abilities.includes("abil_sensor_sweep")) return false;
    if (this.sensorSweepChargesRemaining(unitId) <= 0) return false;
    return unit.actionsRemaining > 0;
  }

  /**
   * Run the sensor array: paint every living hostile inside
   * sensorSweepRadius() so the whole player side can see it until the end
   * of the following hostile phase, burrowed ones included.
   *
   * `revealedUntilTurn = this.turn` is the literal reading of Data Pack
   * §6's "until the end of the following enemy turn": a sweep is spent on
   * the player phase of turn N, and the enemy turn that follows it is the
   * hostile phase of that same turn N (Mission.turn only increments after
   * the hostile phase resolves — see runHostileTurn). So the paint covers
   * the rest of this player turn and the whole hostile phase, and is stale
   * on turn N+1.
   *
   * Limited to SENSOR_SWEEP_CHARGES_PER_MISSION uses per mission (2, as of
   * 23 Aug 2026 — Maxime: "I see double scan as two charge each mission,
   * every mission"), not a turn-based cooldown — a budget to spend across
   * the whole mission rather than a rate you wait out between uses. This
   * thins the fog, it does not delete it.
   *
   * Revealing is NOT surfacing. `burrowed` is left alone, so an Undertow
   * painted here still counts as burrowed for its own surfacing damage
   * multiplier when it eventually attacks (resolveAttack's bloom branch) —
   * the sweep tells you where it is, it doesn't drag it out of the ground.
   *
   * Costs 1 action and does not end the turn — the charge is the real
   * price. Never paints its own side (see isVisibleTo's note on why that
   * matters).
   */
  sensorSweep(unitId: string): SensorSweepOutcome | null {
    if (!this.canSensorSweep(unitId)) return null;
    const unit = this.unitById(unitId)!;
    const radius = this.sensorSweepRadius(unit);
    const revealedIds: string[] = [];
    for (const target of this.livingUnits()) {
      if (target.side === unit.side) continue;
      if (chebyshevDistance(unit.pos, target.pos) > radius) continue;
      target.revealedUntilTurn = this.turn;
      revealedIds.push(target.instanceId);
    }
    unit.actionsRemaining -= 1;
    this.noteAbilityUse(unit, "abil_sensor_sweep");
    const chargesLeft = this.sensorSweepChargesRemaining(unitId) - 1;
    unit.sensorSweepUsesRemaining = chargesLeft;
    this.log.push(
      revealedIds.length
        ? `${unit.displayName} sweeps (radius ${radius}) — ${revealedIds.length} contact(s) painted. (${chargesLeft} charge(s) left)`
        : `${unit.displayName} sweeps (radius ${radius}) — no contacts. (${chargesLeft} charge(s) left)`
    );
    return { sweeperId: unitId, radius, revealedIds, revealedUntilTurn: this.turn };
  }

  canAmbush(unitId: string): boolean {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed) return false;
    if (unit.side !== "player") return false;
    if (!unit.abilities.includes("abil_ambush")) return false;
    if (unit.overwatch || unit.concealed) return false;
    // Can't slip away from something standing on top of you. This is the
    // line that stops Ambush being a strictly-better Overwatch — see
    // abil_ambush's comment in data/abilities.ts. Uses raw adjacency rather
    // than isVisibleTo on purpose: a burrowed Undertow you cannot see is
    // still a thing you are in contact with.
    const inContact = this.livingUnits().some((u) => u.side !== unit.side && chebyshevDistance(u.pos, unit.pos) <= 1);
    if (inContact) return false;
    return unit.actionsRemaining > 0;
  }

  /**
   * Vanish into a real, multi-turn stealth cloak (redesign, 30 Aug 2026 —
   * see data/abilities.ts's abil_ambush entry and combatTables.ts's
   * AMBUSH_STEALTH_DURATION/AMBUSH_DECLOAK_DAMAGE_MULTIPLIER for the full
   * design). Sets `concealed` the same as the original version did, but NOT
   * `overwatch` — this is no longer a held shot waiting for
   * triggerOverwatch to fire it, it's a posture this unit stays under for
   * AMBUSH_STEALTH_DURATION of its own rounds (stealthTurnsRemaining, ticked
   * down in the end-of-hostile-phase loop instead of being cleared by it).
   * While that clock is running, this unit's own future turns are entirely
   * normal — move(), attack(), whatever else it could always do — just
   * unseen. Attacking ends the cloak early and doubles that one attack's
   * damage (resolveAttack); running out the clock untouched ends it with no
   * bonus.
   *
   * Activating still costs the unit's entire remaining action budget and
   * ends its turn, unchanged from the original version and the same
   * Attack/Overwatch cost every other posture in this file pays — the cloak
   * itself doesn't start paying off until the unit's next turn.
   */
  ambush(unitId: string): boolean {
    if (!this.canAmbush(unitId)) return false;
    const unit = this.unitById(unitId)!;
    unit.concealed = true;
    unit.stealthTurnsRemaining = AMBUSH_STEALTH_DURATION;
    unit.actionsRemaining = 0;
    this.noteAbilityUse(unit, "abil_ambush");
    this.log.push(`${unit.displayName} vanishes — cloaked for ${AMBUSH_STEALTH_DURATION} turns.`);
    return true;
  }

  canTaunt(unitId: string): boolean {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed) return false;
    if (unit.side !== "player") return false;
    if (!unit.abilities.includes("abil_taunt")) return false;
    return unit.actionsRemaining > 0;
  }

  /**
   * Draw every eye. The redirect itself lives in engine/ai.ts — each of
   * the four targeting functions checks `taunting` before its own normal
   * pick — this method only sets the posture.
   *
   * NO-CHARGE REDESIGN, 30 Aug 2026 (Maxime: "make taunt like ambush... no
   * charge, just plain use") — same as `ambush` just above, this is a
   * reusable posture, not a spendable resource. No per-mission gate, no
   * cooldown; the only rationing is the full-turn cost below.
   *
   * Costs the unit's entire remaining action budget and ends its turn,
   * same tier as Ambush/Interdict/Overwatch: this is a full commitment,
   * not a cheap add-on to an attack. See abil_taunt's own comment in
   * data/abilities.ts for why it carries no defensive bonus to go with
   * the redirect.
   */
  taunt(unitId: string): boolean {
    if (!this.canTaunt(unitId)) return false;
    const unit = this.unitById(unitId)!;
    unit.taunting = true;
    unit.actionsRemaining = 0;
    this.noteAbilityUse(unit, "abil_taunt");
    this.log.push(`${unit.displayName} draws every eye — taunting.`);
    return true;
  }

  canInterdict(unitId: string): boolean {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed) return false;
    if (unit.side !== "player") return false;
    if (!unit.abilities.includes("abil_interdict")) return false;
    if (unit.braced) return false;
    return unit.actionsRemaining > 0;
  }

  /**
   * Plant and cover the ground around you until your next turn. The pin
   * itself is triggerInterdiction() below; this is just the posture.
   *
   * Costs the unit's entire remaining action budget and ends its turn —
   * a 3-move Tank that could still swing after bracing would be picking
   * up board control for free.
   */
  interdict(unitId: string): boolean {
    if (!this.canInterdict(unitId)) return false;
    const unit = this.unitById(unitId)!;
    unit.braced = true;
    unit.actionsRemaining = 0;
    this.noteAbilityUse(unit, "abil_interdict");
    this.log.push(`${unit.displayName} braces — interdicting the ground around it.`);
    return true;
  }

  /**
   * A hostile just finished a move (moveHostile, the same single choke
   * point overwatch fires from). If any braced, non-downed player unit is
   * within INTERDICT_RADIUS of where it stopped AND can actually see it,
   * the mover loses every remaining action — so runHostileTurn's
   * move-then-attack pair resolves as move-then-nothing, since attack()
   * refuses an attacker at zero actions.
   *
   * Resolved AFTER triggerOverwatch on purpose: a mover killed by reaction
   * fire on the way in is simply dead, and pinning a corpse would put a
   * meaningless line in the log. Vision-gated with the same
   * isVisibleTo(_, _, turn) overwatch uses, which is what makes a Sensor
   * Sweep worth something to a Tank: an unpainted burrower walks through an
   * interdiction untouched, a painted one does not.
   *
   * Unlike an overwatch shot, bracing is NOT consumed here — one Tank pins
   * everything that steps into its ring that phase. Deliberate; see
   * abil_interdict's comment in data/abilities.ts for the reasoning and for
   * where to turn it down.
   */
  private triggerInterdiction(mover: BattleUnit): void {
    if (mover.side !== "hostile" || mover.downed) return;
    if (mover.actionsRemaining <= 0) return;
    for (const anchor of this.units) {
      if (!anchor.braced || anchor.downed || anchor.side === mover.side) continue;
      if (chebyshevDistance(anchor.pos, mover.pos) > INTERDICT_RADIUS) continue;
      if (!isVisibleTo(anchor, mover, this.turn)) continue;
      mover.actionsRemaining = 0;
      this.log.push(`${anchor.displayName} interdicts ${mover.displayName} — pinned, no attack.`);
      return; // one pin is total; a second anchor has nothing left to take
    }
  }

  canScreen(unitId: string): boolean {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed) return false;
    if (unit.side !== "player") return false;
    if (!unit.abilities.includes("abil_screen")) return false;
    if (unit.usedScreenThisMission) return false;
    return unit.actionsRemaining > 0;
  }

  /**
   * Put the screen up: conceal this Munti and every living same-side unit
   * within SCREEN_RADIUS until their own next turns begin. Same
   * `concealed` flag abil_ambush sets, so it is the same single line in
   * engine/ai.ts's isVisibleTo doing the work — the Bloom simply have no
   * target and hold position for a phase.
   *
   * Costs 1 action and does NOT end the turn (screen-then-Repair is the
   * point of a support turn), but is ONCE PER MISSION per Munti, mirroring
   * abil_cockpit_evac's usedEvacThisMission: an effect that takes the
   * hostile side's turn away entirely should be spent, not rationed.
   *
   * Deliberately does NOT clear anyone's overwatch: a covered unit still
   * has its held shot, and firing it is what breaks that unit's own cover.
   */
  screenAllies(unitId: string): ScreenOutcome | null {
    if (!this.canScreen(unitId)) return null;
    const unit = this.unitById(unitId)!;
    const covered = this.livingUnits().filter((t) => t.side === unit.side && chebyshevDistance(unit.pos, t.pos) <= SCREEN_RADIUS);
    for (const u of covered) u.concealed = true;
    unit.actionsRemaining -= 1;
    unit.usedScreenThisMission = true;
    this.noteAbilityUse(unit, "abil_screen");
    this.log.push(`${unit.displayName} puts up a screen — ${covered.length} unit(s) concealed.`);
    return { muntiId: unitId, concealedIds: covered.map((u) => u.instanceId) };
  }

  // ---- abil_fire_support (25 Aug 2026, Mission 14 "Steel Rain") — see
  // data/abilities.ts's own comment for the full design. Same canX()/verb
  // shape as Screen just above, but the resource lives on Mission itself
  // (fireSupportChargesRemaining, shared squad-wide) rather than on the
  // calling unit, and the target is a tile, not another unit — closer in
  // shape to Clear Bloom's radius effect below than to Screen's own
  // "centered on the caster" reach.
  //
  // Weapons Bay (28 Aug 2026) adds a second, additive resource on top of
  // this without touching it: once fireSupportChargesRemaining hits 0, a
  // squad with the bay built can still call in ONE more strike as long as
  // fireSupportBonusReadyTurn's cooldown (WEAPONS_BAY_FIRE_SUPPORT_COOLDOWN_
  // TURNS, data/combatTables.ts) has elapsed. Baseline charges are always
  // spent first — the bonus is a fallback, not an alternative — so a save
  // without the bay built takes the exact same canFireSupport/fireSupport
  // path it always has.

  /** True if this campaign save has the Weapons Bay built (engine/campaignState.ts's ReservedBayId) — gates the bonus Fire Support charge below. */

  // Beacon Control (claude/Bloom_Wars_Beacon_Restock_Economy_v1.md §6) —
  // both Beacon Control and Restock Room require the Generator built first,
  // same dependency shape Forward Battery already has on Weapons Bay
  // (engine/campaignEconomy.ts's purchaseCarrierModule). Three separate
  // getters rather than one combined check so canPlaceBeacon's own gate
  // list stays readable about WHICH bay is missing, and so a future caller
  // that only cares about one of the three (the Hub build-request flow,
  // which needs generatorBuilt alone to refuse constructing either bay
  // early) doesn't have to reimplement the lookup.
  private get beaconControlBuilt(): boolean {
    return this.builtBays.includes("beaconControl");
  }
  private get restockRoomBuilt(): boolean {
    return this.builtBays.includes("restockRoom");
  }
  private get generatorBuilt(): boolean {
    return this.builtBays.includes("generator");
  }

  /**
   * Long-Range Sensor Array (Bloom_Wars_Antfarm_Carrier_Hub_v1.md §11.2,
   * locked 23 Aug 2026; wired 7 Sep 2026 — Maxime: "better fix those two
   * buildable room"). Public rather than private, unlike the three getters
   * above, because the sim bot's PlayerAiMissionContext (sim/playerAi/
   * types.ts) reads it structurally off the live Mission the same way it
   * reads fireSupportBonusChargeReady — a fog-honest bot on a campaign
   * that built the array should see what the player sees.
   */
  get sensorArrayBuilt(): boolean {
    return this.builtBays.includes("sensorArray");
  }

  /**
   * The one fog-of-war query for the player side — every living hostile
   * the whole player roster can currently see (engine/ai.ts's
   * unitsVisibleToSide, the same isVisibleTo the hostile AI uses), PLUS,
   * once the Sensor Array is built, every standing hostile on the board.
   * Burrowed and concealed units stay hidden either way; that rule lives
   * in ai.ts, not here. scenes/Battle.ts's own visibleHostileIds and the
   * three any-range Heirloom target pools in this file (Ichigeki's two
   * Deadfall methods, Simulacrum's Ledgerhall Static) all route through
   * this so the bay applies everywhere at once — before
   * 7 Sep 2026 each of those four call sites asked ai.ts directly, which is
   * exactly why a built Sensor Array did nothing: nothing ever told the
   * fog the bay existed.
   */
  playerVisibleHostileIds(): Set<string> {
    return unitsVisibleToSide("player", this.units, this.turn, { sensorArray: this.sensorArrayBuilt });
  }

  /**
   * True if a living, non-downed Munti is on the player side right now —
   * the same live check muntiCollapseTurn's own tracking uses elsewhere in
   * this file, factored out here since Beacon Control needs to ask this
   * question independently of that latch (a Munti can come back into
   * relevance for THIS check even after muntiCollapseTurn has already
   * fired once, since that field never un-latches — see its own comment).
   * Used by useBeaconControl() below to decide whether this use's Restock
   * Room charge is waived.
   */
  private livingMuntiPresent(): boolean {
    return this.units.some((u) => u.side === "player" && u.path === "munti" && !u.downed);
  }

  /**
   * Beacon Control's ability holder. Warden Company: Rourke, once she's
   * reached Captain or higher. House Amaranth: Marrow, unconditionally —
   * see that campaign's own paragraph below for why no rank check is
   * needed there.
   *
   * CHANGED 6 Sep 2026. The original 4 Sep rule was "whichever deployed
   * pilot currently holds the highest chassis/gear grade," Maxime's own
   * framing at the time (source doc §2) — deliberately NOT hardcoded to
   * Rourke, so the same lookup could generalize to Gladiator mode's own
   * champions later. In practice it meant Beacon Control followed whoever
   * had the best gear that mission, which is how it ended up on Osric
   * Ferrow's kit (the heaviest loadout in the game) and pushed his action
   * bar past 6 verbs. Maxime's correction, live in chat: "beacon is rourke
   * only as the major. or the one rank before who can deploy it" —
   * confirmed as Rourke specifically, gated by her own rank
   * (CampaignState.rourkeRank), not a second character. She's locked out
   * at 2nd Lieutenant and eligible from Captain on ("the one rank before"
   * Major) through Major itself.
   *
   * The old rule's Gladiator-mode reasoning doesn't stop being true — it's
   * just not what Warden Company gets today. Gladiator mode will need its
   * own equivalent "who's on top" lookup for whichever champion isn't
   * Rourke, built when that mode actually exists, not preserved here as
   * unused generality.
   *
   * Hardcodes the "pilot_rourke" id directly rather than a PilotRecord flag
   * — contrast exemptFromPermadeath (data/types.ts), which exists so THAT
   * check isn't a hardcoded id, but is scoped by its own comment to the
   * permadeath check alone; reusing it here would tie two unrelated rules
   * to one flag for no reason. The bare literal matches how every other
   * file that needs her (Hub.ts, campaignState.ts, heirlooms.ts) already
   * refers to her — there's no shared constant for it on purpose:
   * campaignEconomy.ts's own ROURKE_PILOT_ID can't be imported here without
   * a circular dependency, since campaignEconomy.ts already imports Mission
   * from this file.
   *
   * House Amaranth's own commander equivalent — 6 Sep 2026, same
   * conversation as the Rourke change above. Maxime, checking the
   * cross-campaign gap this rule originally left open: "house amaranth is
   * also the mc the player play who get the beacon gated the same way.
   * exept. they can use it since mission 1. since marrow is [Colonel] at
   * the start." Correcting one detail in that question for the record:
   * pilot_marrow's own displayName (data/campaignHouseAmaranth.ts) is
   * "Col. Ysolde Marrow" — Colonel, not Corporal ("Cpl." is a real,
   * distinct title in that same roster, pilot_meir's). Doesn't change his
   * conclusion — Colonel already sits above Captain on this project's own
   * rank ladder (Bloom_Wars_Rank_And_Command_v1.md, and House Amaranth's
   * own ladder in Bloom_Wars_House_Amaranth_Hub_Facility_Plan_v1.md, which
   * runs Brigadier > Colonel > everything under it) — so gated "the same
   * way" as Rourke's Captain-or-higher rule, Marrow clears the bar from
   * the campaign's first mission and every mission after, same as he said.
   *
   * Built as an unconditional check rather than a second rank field: unlike
   * rourkeRank, Marrow has no promotion schedule anywhere in this codebase
   * — "Col. Ysolde Marrow" is fixed, authored flavor from Mission 1 on, per
   * her own PilotRecord comment ("this campaign's own 1:1 mirror to
   * Rourke") and campaignState.ts's own repeated note that no
   * Marrow-equivalent rank field has ever been designed. A rank field with
   * exactly one value forever is a field that isn't doing anything — this
   * reads as what it actually is, "always eligible while she's up," rather
   * than manufacturing a Rank-typed field just to hold one constant.
   *
   * IMPORTANT, told to Maxime directly rather than left to surface itself
   * later: this branch is correct but currently unreachable in an actual
   * played House Amaranth campaign. canPlaceBeacon() below still requires
   * builtBays to include beaconControl + restockRoom + generator, and the
   * only code anywhere that can ever add to builtBays is Hub.ts's bay-
   * building UI (Antfarm) — Warden's own hub. House Amaranth's base scene
   * (scenes/Hangar.ts) is a 136-line placeholder with no bay-building
   * capability at all, and Maxime's own build log already lists a real
   * House Amaranth hub as explicitly deferred ("I'll do the hub some other
   * day"). So today, Marrow can never actually place a beacon in a played
   * campaign — not because of this rank check, but because there's no in-
   * game way to ever build the three bays it also requires. Covered by
   * engine-level tests (beaconControl.test.ts's own Marrow describe block)
   * that construct a Mission directly and pass builtBays in by hand, the
   * same way a real House Amaranth hub eventually would.
   *
   * Recomputed on every call rather than cached, same as before: a downed
   * Rourke or Marrow loses the role until revived or the mission ends.
   */
  beaconHolderId(): string | null {
    const marrow = this.units.find((u) => u.side === "player" && !u.downed && u.pilotId === "pilot_marrow");
    if (marrow) return marrow.instanceId;

    if (this.rourkeRank === "2nd_lt") return null;
    const rourke = this.units.find((u) => u.side === "player" && !u.downed && u.pilotId === "pilot_rourke");
    return rourke?.instanceId ?? null;
  }

  /**
   * Beacon Control's own range rule (source doc §2: "wherever the
   * ability-holder can currently see, and within their own movement range
   * that turn"). SIMPLIFICATION, flagged rather than hidden: the source doc
   * frames this as placing a beacon TILE that then pulls back whoever it
   * reaches; this build collapses that into a single click on the downed
   * ally directly, same shape as lastword_signature/lastword_last_rites
   * above, rather than adding a separate "choose a tile" step — the
   * revived pilot gets back up where they fell, matching every other
   * revive-shaped ability already in this file. The RANGE the doc describes
   * survives as the actual gate on which downed ally can be targeted at
   * all: within the holder's fog-of-war-aware vision (isVisibleTo) AND
   * within one tile of somewhere the holder could physically move this
   * turn (reachableTiles, same primitive getReachableTiles already uses) —
   * not unlimited range the way lastword_signature is, which is the whole
   * point of this being a beacon carried into position rather than a
   * signature fired from wherever you're standing.
   */
  private beaconTargetInRange(holder: BattleUnit, target: BattleUnit): boolean {
    if (!isVisibleTo(holder, target, this.turn)) return false;
    if (chebyshevDistance(holder.pos, target.pos) <= 1) return true;
    const reachable = reachableTiles(this.map, holder.pos, holder.moveRange, this.movementKindFor(holder), this.occupiedSet(holder.instanceId));
    for (const key of reachable.keys()) {
      const [x, y] = key.split(",").map(Number);
      if (chebyshevDistance({ x, y }, target.pos) <= 1) return true;
    }
    return false;
  }

  /**
   * Every gate on whether `unitId` can place a beacon right now: must
   * actually be the current holder (beaconHolderId(), live), both bays plus
   * the Generator built (§6), a placement left this mission, a crate left
   * (always consumed per use, no Munti exception — source doc §3), and
   * either a charge left OR a living Munti present to waive it (§3/§4 — see
   * useBeaconControl's own comment for exactly how the waiver is applied).
   */
  canPlaceBeacon(unitId: string): boolean {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed) return false;
    if (unit.side !== "player") return false;
    if (unitId !== this.beaconHolderId()) return false;
    if (!this.beaconControlBuilt || !this.restockRoomBuilt || !this.generatorBuilt) return false;
    if (this.beaconsRemaining <= 0) return false;
    // The crate gate, widened 6 Sep 2026 for Fabricator spare parts: with
    // no company crate left, the beacon can still fire if SOME restockable
    // downed ally on this side carries their own (beaconCrateSourceFor).
    // Range isn't checked here — that's getBeaconTargetsFrom's job — so
    // the button can light up for a part-carrying casualty who then turns
    // out to be out of reach, same "usable, then no targets" shape every
    // other targeted ability in this file already has.
    if (this.beaconCratesRemaining <= 0 && !this.restockableDowned(unit.side).some((u) => this.beaconCrateSourceFor(u) === "spare_part")) return false;
    if (this.beaconChargesRemaining <= 0 && !this.livingMuntiPresent()) return false;
    return unit.actionsRemaining > 0;
  }

  /** Every downed, not-permanently-lost pilot on `side` — the pool both canPlaceBeacon and getBeaconTargetsFrom draw from. */
  private restockableDowned(side: BattleUnit["side"]): BattleUnit[] {
    return this.units.filter((u) => u.side === side && u.downed && !!u.pilotId && !this.isPermanentlyLost(u.pilotId!));
  }

  /**
   * What a beacon revive of `target` would burn for its crate: the target's
   * own Fabricator spare part when they have one, else a company crate from
   * the Restock Room stock, else nothing — and "nothing" means this target
   * can't be revived right now. The part is tried FIRST, deliberately: the
   * whole point of the Fabricator track after 6 Sep 2026 ("its the beacon
   * job to give in battle restock" — Maxime) is that its pilot brings their
   * own crate, which keeps the company's crates for pilots who don't.
   */
  private beaconCrateSourceFor(target: BattleUnit): "spare_part" | "crate" | undefined {
    if ((target.fabricatorPartsRemaining ?? 0) > 0) return "spare_part";
    if (this.beaconCratesRemaining > 0) return "crate";
    return undefined;
  }

  /**
   * Every downed ally `unitId` could revive right now — restockable
   * casualties only (isPermanentlyLost, same gate getLastWordSignatureTargetsFrom
   * uses above) within beaconTargetInRange of the holder, who have a crate
   * source (their own spare part or a company crate). Empty whenever
   * canPlaceBeacon is false, same "ask the engine, never guess" contract
   * every other getXTargetsFrom method in this file follows.
   */
  getBeaconTargetsFrom(unitId: string): BattleUnit[] {
    if (!this.canPlaceBeacon(unitId)) return [];
    const holder = this.unitById(unitId)!;
    return this.restockableDowned(holder.side).filter((u) => this.beaconCrateSourceFor(u) !== undefined && this.beaconTargetInRange(holder, u));
  }

  /**
   * Places a beacon and revives `targetId` — full restock (currentHp maxed,
   * downed cleared), same "fully restores" reading lastWordSignature above
   * already established, no permanent stat cost unlike Migawari's own price
   * (this is a purchased/logistics cost, not a personal one — source doc
   * §3 lists three costs and none of them touch the holder's own stats).
   *
   * Consumes, in order: one placement (beaconsRemaining), one crate
   * (beaconCratesRemaining, unconditionally), and one charge
   * (beaconChargesRemaining) UNLESS a living Munti is present on the field
   * at this exact moment, in which case the charge is fully waived.
   * READING, flagged: source doc §3/§4 say a charge's "point-cost is
   * reduced" with a Munti present but never say by how much or against
   * what — full waiver (0 charges instead of 1) is the reading taken here,
   * the cleanest way to make "reduced" concrete against a discrete,
   * integer stockpile rather than inventing fractional charges. Cheap to
   * change to a partial discount later if that reading turns out wrong.
   * The mission-payout percentage (the third cost, charged at Debrief —
   * see engine/campaignEconomy.ts's applyBeaconReviveCosts) and the crate
   * are NOT Munti-discounted — the doc's own wording ties the discount to
   * "a charge's cost" specifically, not the other two.
   *
   * Costs the holder 1 action, does not end their turn — same tier as
   * Field Triage/lastWordSignature/lastRites above.
   */
  useBeaconControl(unitId: string, targetId: string): boolean {
    if (!this.canPlaceBeacon(unitId)) return false;
    const holder = this.unitById(unitId)!;
    const target = this.getBeaconTargetsFrom(unitId).find((t) => t.instanceId === targetId);
    if (!target) return false;

    // Resolved BEFORE the revive flips `downed`, since getBeaconTargetsFrom
    // already guaranteed a source exists for this target.
    const crateSource = this.beaconCrateSourceFor(target)!;

    target.currentHp = target.maxHp;
    target.downed = false;

    this.beaconsRemaining -= 1;
    // Fabricator spare parts (6 Sep 2026) — see beaconCrateSourceFor. The
    // part is the TARGET's (it's their mek's), spent off the unit and
    // tallied by mek id for Debrief; a company crate is the fallback.
    if (crateSource === "spare_part") {
      target.fabricatorPartsRemaining = (target.fabricatorPartsRemaining ?? 1) - 1;
      const mekId = target.mekId ?? target.pilotId!;
      this.sparePartsSpent[mekId] = (this.sparePartsSpent[mekId] ?? 0) + 1;
    } else {
      this.beaconCratesRemaining -= 1;
    }
    const muntiPresent = this.livingMuntiPresent();
    if (!muntiPresent) {
      this.beaconChargesRemaining -= 1;
    }
    this.beaconRevivesUsed += 1;

    holder.actionsRemaining -= 1;
    this.noteAbilityUse(holder, "beacon_control");
    const crateNote =
      crateSource === "spare_part" ? `, ${target.displayName}'s own Fabricator spare part covers the crate (${target.fabricatorPartsRemaining} part(s) left)` : "";
    this.log.push(
      muntiPresent
        ? `${holder.displayName} drops a beacon for ${target.displayName} — full restock, a Munti on the field waives the Restock Room charge${crateNote} (${this.beaconsRemaining} beacon(s) left).`
        : `${holder.displayName} drops a beacon for ${target.displayName} — full restock${crateNote} (${this.beaconsRemaining} beacon(s) left, ${this.beaconChargesRemaining} charge(s) left).`
    );
    return true;
  }

  /**
   * Fire Support's blast radius for THIS mission (Chebyshev, so radius 1 is
   * a 3x3 box and radius 2 a 5x5).
   *
   * Forward Battery (2 Sep 2026) is the only thing that moves it. Read
   * through a getter rather than captured into a field at construction so
   * there's exactly one place the rule lives — both the real resolver
   * (fireSupport) and the hover forecast (forecastSplash) go through it,
   * which is what keeps the preview honest. That preview-vs-reality
   * agreement is the specific desync the Build Brief's step 10 warns about
   * by name, and forecast.test.ts already pins it.
   */
  private get fireSupportRadius(): number {
    return this.builtModules.includes("forwardBattery") ? FORWARD_BATTERY_FIRE_SUPPORT_RADIUS : FIRE_SUPPORT_RADIUS;
  }

  private get weaponsBayBuilt(): boolean {
    return this.builtBays.includes("weaponsBay");
  }

  /** True if the Weapons Bay's bonus charge is currently available — built, baseline charges already spent, and its cooldown has elapsed. Exposed for the HUD alongside fireSupportChargesRemaining. */
  fireSupportBonusChargeReady(): boolean {
    return this.weaponsBayBuilt && isCooldownReady(this.fireSupportBonusReadyTurn, this.turn);
  }

  canFireSupport(unitId: string): boolean {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed) return false;
    if (unit.side !== "player") return false;
    if (!unit.abilities.includes("abil_fire_support")) return false;
    if (this.fireSupportChargesRemaining <= 0 && !this.fireSupportBonusChargeReady()) return false;
    return unit.actionsRemaining > 0;
  }

  /**
   * Every in-bounds tile a fire support call-in could target from `from` —
   * fireSupport()'s own vision-range check, enumerated as a click target
   * set rather than asked one tile at a time. Mirrors
   * getSensorSweepAreaFrom's exact shape (a square box, `unit.vision` tiles
   * in every direction, clipped to the board) — Chebyshev distance <= r is
   * precisely that square, so the same loop answers both questions. Unlike
   * every other getXFrom preview in this file, this ISN'T "what a
   * self-targeted button would immediately do" — scenes/Battle.ts uses this
   * one to arm a genuine two-click flow (press FIRE, then click a tile in
   * the returned set), since a strike's target is an arbitrary tile, not a
   * unit or the caster's own position.
   */
  getFireSupportAreaFrom(unitId: string, from: Coord): Coord[] {
    if (!this.canFireSupport(unitId)) return [];
    const unit = this.unitById(unitId)!;
    const r = unit.vision;
    const tiles: Coord[] = [];
    for (let y = Math.max(0, from.y - r); y <= Math.min(this.map.height - 1, from.y + r); y++) {
      for (let x = Math.max(0, from.x - r); x <= Math.min(this.map.width - 1, from.x + r); x++) {
        tiles.push({ x, y });
      }
    }
    return tiles;
  }

  /**
   * Call in a strike on `target`: every living hostile within
   * fireSupportRadius (Chebyshev) of that tile takes FIRE_SUPPORT_DAMAGE
   * flat — no defense/cover mitigation, no retaliation, applied directly
   * rather than through resolveMechAttack/resolveAttackOnBloom (this is an
   * off-board strike, not a mech's own weapon). `target` must be within the
   * calling unit's own vision (reusing the same Chebyshev vision-range math
   * fog of war already uses elsewhere in this file, rather than inventing a
   * separate line-of-sight check for one ability) — you can only radio in
   * coordinates you can actually see.
   *
   * Costs this unit's entire remaining action budget and ends the turn
   * (same tier as Ambush/Interdict/Taunt), and spends one of the squad's
   * shared FIRE_SUPPORT_CHARGES_PER_MISSION charges regardless of how many
   * hostiles the strike actually hits (including zero — calling in a
   * strike on an empty tile still burns the charge; a real player reading
   * the board wrong pays for it, same as a wasted Overwatch).
   */
  fireSupport(unitId: string, target: Coord): { hitIds: string[]; killedIds: string[] } | null {
    if (!this.canFireSupport(unitId)) return null;
    const unit = this.unitById(unitId)!;
    if (chebyshevDistance(unit.pos, target) > unit.vision) return null;

    const hit = this.livingUnits().filter((u) => u.side === "hostile" && chebyshevDistance(u.pos, target) <= this.fireSupportRadius);
    const killedIds: string[] = [];
    for (const victim of hit) {
      if (victim.kind === "bloom") applyBloomDamage(victim, FIRE_SUPPORT_DAMAGE);
      else applyMechDamage(victim, FIRE_SUPPORT_DAMAGE);
      this.recordContribution(victim.instanceId, unit.pilotId, FIRE_SUPPORT_DAMAGE);
      if (victim.downed) {
        killedIds.push(victim.instanceId);
        this.resolveKill(victim.instanceId, unit.pilotId);
      }
    }
    // Baseline pool spent first; the Weapons Bay's bonus charge only ever
    // covers a call-in once that pool is actually empty (canFireSupport
    // above already guarantees at least one of the two is available here).
    let usedBonusCharge = false;
    if (this.fireSupportChargesRemaining > 0) {
      this.fireSupportChargesRemaining -= 1;
    } else {
      usedBonusCharge = true;
      this.fireSupportBonusReadyTurn = startCooldown(this.turn, WEAPONS_BAY_FIRE_SUPPORT_COOLDOWN_TURNS);
    }
    unit.actionsRemaining = 0;
    this.noteAbilityUse(unit, "abil_fire_support");
    this.log.push(
      usedBonusCharge
        ? `${unit.displayName} calls in fire support on (${target.x},${target.y}) via the Weapons Bay's reserve line — ${hit.length} hit, ${killedIds.length} downed (bonus charge on cooldown for ${WEAPONS_BAY_FIRE_SUPPORT_COOLDOWN_TURNS} turn(s)).`
        : `${unit.displayName} calls in fire support on (${target.x},${target.y}) — ${hit.length} hit, ${killedIds.length} downed (${this.fireSupportChargesRemaining} charge(s) left).`
    );
    for (const victim of hit) if (victim.downed) this.handleDowned(victim);
    return { hitIds: hit.map((u) => u.instanceId), killedIds };
  }

  // ---- abil_missile (26 Aug 2026, SOFT pass) — see data/abilities.ts's
  // own comment for the full design context. Same canX()/getX()/verb shape
  // as fireSupport just above (target a tile, not a unit), but the
  // resource is per-unit (mirrors sensorSweepUsesRemaining, NOT
  // fireSupportChargesRemaining) and the damage runs through the ordinary
  // per-target combat formula instead of a flat off-board number — this is
  // a Reeps' own weapon, not a called-in strike.

  /** Charges of abil_missile this unit has left this mission. Exposed for the HUD. Undefined reads as a full, unspent budget — see missileUsesRemaining's own comment in engine/units.ts. */
  missileChargesRemaining(unitId: string): number {
    const unit = this.unitById(unitId);
    if (!unit) return 0;
    return unit.missileUsesRemaining ?? MISSILE_CHARGES_PER_MISSION;
  }

  canMissileStrike(unitId: string): boolean {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed) return false;
    if (unit.side !== "player") return false;
    if (!unit.abilities.includes("abil_missile")) return false;
    if (this.missileChargesRemaining(unitId) <= 0) return false;
    return unit.actionsRemaining > 0;
  }

  /**
   * Every in-bounds tile this unit could target a missile at, from its
   * current position — its own attackRange (this is the unit's own
   * weapon, not an off-board asset the way Fire Support is, so it uses the
   * same range a normal attack would), enumerated as a click target set
   * the same way getFireSupportAreaFrom is. No vision/LOS check here,
   * matching attack()/resolveAttack's own shape — fog-of-war targeting
   * restrictions live in scenes/Battle.ts's rendering layer, same as for a
   * normal attack, not in this engine-level enumeration.
   */
  getMissileAreaFrom(unitId: string, from: Coord): Coord[] {
    if (!this.canMissileStrike(unitId)) return [];
    const unit = this.unitById(unitId)!;
    const [minR, maxR] = unit.attackRange;
    const tiles: Coord[] = [];
    for (let y = Math.max(0, from.y - maxR); y <= Math.min(this.map.height - 1, from.y + maxR); y++) {
      for (let x = Math.max(0, from.x - maxR); x <= Math.min(this.map.width - 1, from.x + maxR); x++) {
        const d = chebyshevDistance(from, { x, y });
        if (d >= minR && d <= maxR) tiles.push({ x, y });
      }
    }
    return tiles;
  }

  /**
   * Fire a missile at `target`: every living unit within
   * MISSILE_SPLASH_RADIUS (Chebyshev) of that tile takes damage through
   * the ordinary per-target combat formula — resolveMechAttack for a
   * mech-shape target, resolveAttackOnBloom for a Bloom-shape one, exactly
   * the branches resolveAttack() uses for a normal attack, just run once
   * per unit caught in the blast instead of once against a single chosen
   * defender. Deliberately NOT filtered by side (see abilities.ts's own
   * comment) — this is the one attack in the game that can hit its own
   * caster's side. The caster itself is excluded even if it would
   * otherwise be in radius of its own shot; friendly fire means allies
   * near the target, not the launcher blowing itself up.
   *
   * The one exception to "not filtered by side": a splash victim's
   * COUNTER, if it would land on the caster and the victim is on the
   * caster's own side, is suppressed (26 Aug 2026, Maxime: "the counter
   * shouldnt be ff able") — see the friendlyCounter check inline, below.
   * The primary hit still lands on a friendly victim same as ever; it just
   * doesn't shoot back at whoever cast it.
   *
   * Each hit reuses recordPerformance() (built from a synthetic
   * AttackOutcome per target) so campaign-economy crediting — damage,
   * kills, assists — works identically to a normal attack, with no
   * separate bookkeeping path to drift out of sync. One consequence worth
   * being explicit about, not a bug: resolveMechAttack scales damage by
   * attacker.currentHp / attacker.maxHp, so if an early target's counter
   * downs the caster mid-loop, every target resolved after it takes zero —
   * the formula already handles "the launcher got destroyed mid-volley"
   * without any extra guard here.
   *
   * Costs this unit's entire remaining action budget and ends the turn,
   * and spends one of THIS unit's own MISSILE_CHARGES_PER_MISSION charges
   * (contrast fireSupportChargesRemaining, one shared squad-wide pool) —
   * regardless of how many units the blast actually hits, including zero,
   * same "a wasted call still costs you" rule fireSupport already has.
   */
  missileStrike(unitId: string, target: Coord): { hitIds: string[]; killedIds: string[] } | null {
    if (!this.canMissileStrike(unitId)) return null;
    const attacker = this.unitById(unitId)!;
    const d = chebyshevDistance(attacker.pos, target);
    if (d < attacker.attackRange[0] || d > attacker.attackRange[1]) return null;

    const hit = this.livingUnits().filter(
      (u) => u.instanceId !== attacker.instanceId && chebyshevDistance(u.pos, target) <= MISSILE_SPLASH_RADIUS
    );
    const killedIds: string[] = [];

    for (const victim of hit) {
      const sameSideAsVictim = this.units.filter((u) => u.side === victim.side);
      const sameSideAsAttacker = this.units.filter((u) => u.side === attacker.side);
      let outcome: AttackOutcome;

      if (victim.kind !== "bloom") {
        // Correction (26 Aug 2026, Maxime): "splash shouldn't be dodgable."
        // MEEPS_DODGE_CHANCE models a Meeps reading an aimed shot and
        // stepping out of its path — that doesn't hold for an explosion
        // already covering the whole blast tile, so victimDodged is
        // deliberately hardcoded false here, NOT rolled the way a normal
        // attack (resolveAttack, just above) rolls it. The counter-dodge
        // stays a real roll: a surviving victim's counter-shot back at the
        // attacker is its own aimed, single-target hit, not part of the
        // splash, so the attacker can still juke it same as any other
        // counter.
        const victimDodged = false;
        const attackerDodgedCounter = rollMeepsDodge(attacker, victim, this.rng);
        const r = resolveMechAttack(
          this.map,
          attacker,
          victim,
          sameSideAsVictim,
          sameSideAsAttacker,
          attacker.chargedThisMove,
          victimDodged,
          attackerDodgedCounter,
          { attackerKillsThisMission: this.killsThisMissionFor(attacker), defenderKillsThisMission: this.killsThisMissionFor(victim) }
        );
        applyMechDamage(victim, r.damage);
        // Correction (26 Aug 2026, Maxime): "the counter shouldnt be ff
        // able." resolveMechAttack computes r.countered purely off
        // canCounter + counterMaxRange, with no idea a splash victim might
        // be on the CASTER'S OWN side — it can't, that's a mission.ts-level
        // fact. A friendly unit caught in your own blast still visibly
        // takes the primary splash damage (that part's the whole point of
        // "no friendly fire unless the dude has missile"), it just doesn't
        // shoot back at the person who cast it. Gated here, at the
        // application layer, same shape as the dodge fix just above —
        // combat.ts's own formula stays untouched and still returns the
        // "would a normal 1-v-1 attack have drawn a counter here" answer,
        // this call site just declines to apply it when the answer would
        // mean an ally countering their own caster.
        const friendlyCounter = r.countered && victim.side === attacker.side;
        if (r.countered && r.counterDamage !== undefined && !friendlyCounter) {
          applyMechDamage(attacker, r.counterDamage);
        }
        outcome = {
          attackerId: unitId,
          defenderId: victim.instanceId,
          damage: r.damage,
          countered: r.countered && !friendlyCounter,
          counterDamage: friendlyCounter ? undefined : r.counterDamage,
          defenderDowned: victim.downed,
          attackerDowned: attacker.downed,
          defenderDodged: r.dodged,
          counterDodged: friendlyCounter ? undefined : r.counterDodged,
        };
      } else {
        const r = resolveAttackOnBloom(this.map, attacker, victim, sameSideAsVictim, attacker.chargedThisMove, {
          attackerKillsThisMission: this.killsThisMissionFor(attacker),
        });
        applyBloomDamage(victim, r.damage);
        outcome = { attackerId: unitId, defenderId: victim.instanceId, damage: r.damage, countered: false, defenderDowned: victim.downed };
      }

      this.recordPerformance(attacker, victim, outcome);
      if (outcome.defenderDowned) killedIds.push(victim.instanceId);
    }

    const chargesLeft = this.missileChargesRemaining(unitId) - 1;
    attacker.missileUsesRemaining = chargesLeft;
    this.noteAbilityUse(attacker, "abil_missile");
    attacker.actionsRemaining = 0;
    // Firing gives your position away, same as any other attack (see
    // resolveAttack's identical line) — a missile launch is not stealthy.
    attacker.concealed = false;
    this.log.push(
      `${attacker.displayName} fires a missile at (${target.x},${target.y}) — ${hit.length} hit, ${killedIds.length} downed (${chargesLeft} charge(s) left).`
    );

    for (const victim of hit) if (victim.downed) this.handleDowned(victim);
    if (attacker.downed) this.handleDowned(attacker);
    return { hitIds: hit.map((u) => u.instanceId), killedIds };
  }

  // ---- abil_maser_lance (5 Sep 2026, SOFT pass) — Tank's own weapon-branch
  // granted ability, see data/abilities.ts's own comment for the full design
  // context (three real forks, all resolved via AskUserQuestion, not
  // guessed). Same canX()/getX()/verb shape as abil_missile just above —
  // this is a granted weapon, same per-unit charge budget, same "damage runs
  // through the ordinary per-target combat formula" contract — but the
  // TARGETING shape is new: a chosen direction (one of
  // CINDER_LINE_DIRECTIONS' own 8, reused again — requiem_severance/
  // cinder_line_signature already established this grid's one direction-
  // picking convention, not a second one invented here) and a WIDENING CONE
  // down it, not a radius around a clicked tile the way Missiles/Fire
  // Support both are.

  /** Charges of abil_maser_lance this unit has left this mission. Exposed for the HUD. Undefined reads as a full, unspent budget — see maserLanceUsesRemaining's own comment in engine/units.ts. */
  maserLanceChargesRemaining(unitId: string): number {
    const unit = this.unitById(unitId);
    if (!unit) return 0;
    return unit.maserLanceUsesRemaining ?? MASER_LANCE_CHARGES_PER_MISSION;
  }

  canMaserLanceStrike(unitId: string): boolean {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed) return false;
    if (unit.side !== "player") return false;
    if (!unit.abilities.includes("abil_maser_lance")) return false;
    if (this.maserLanceChargesRemaining(unitId) <= 0) return false;
    return unit.actionsRemaining > 0;
  }

  /**
   * Every tile in `from`'s own cone footprint fired in direction `dir`,
   * MASER_LANCE_CONE_RANGE forward steps deep, origin tile EXCLUDED (this is
   * a shot fired FROM the Tank, not a blast the Tank stands inside — see
   * abil_severance's own opposite convention for the contrasting case, and
   * CINDER_LINE_DIRECTIONS' own header for why Cinder Line's line similarly
   * starts one step out rather than on the wielder's own tile).
   *
   * The widening-cone formula, not a special case per direction: at forward
   * step `d` (1..MASER_LANCE_CONE_RANGE), the cone is `2*d - 1` tiles wide —
   * 1 tile at d=1, 3 at d=2, 5 at d=3 — centred on the step-`d` tile straight
   * out along `dir`, spreading along `perp` (`dir` rotated 90 degrees: `{x:
   * -dir.y, y: dir.x}`). Using `dir`'s own perpendicular rather than a
   * literal dx/dy table is what makes one formula cover all 8 directions,
   * diagonals included, without a separate branch for each — for a cardinal
   * `dir` this reads as an ordinary forward-widening wedge; for a diagonal
   * `dir` the same math produces a wedge that widens across the
   * perpendicular diagonal instead, the natural equivalent shape on a square
   * grid. Each individual (step, lateral) tile is bounds-checked on its own
   * rather than the whole direction being cut off at the first
   * out-of-bounds step, the same "a short/clipped shape near an edge rather
   * than an error" judgment call getRequiemDirectionTargets/
   * getCinderLineAreaFrom already make for their own edge cases — a cone
   * near a corner can have a partial row on one side and a full row on the
   * other, not a hard cutoff at whichever came first.
   */
  private maserLanceConeTiles(from: Coord, dir: Coord): Coord[] {
    const perp = { x: -dir.y, y: dir.x };
    const tiles: Coord[] = [];
    for (let step = 1; step <= MASER_LANCE_CONE_RANGE; step++) {
      const half = step - 1;
      for (let lateral = -half; lateral <= half; lateral++) {
        const c = { x: from.x + dir.x * step + perp.x * lateral, y: from.y + dir.y * step + perp.y * lateral };
        if (inBounds(this.map, c)) tiles.push(c);
      }
    }
    return tiles;
  }

  /**
   * Every in-bounds tile along one of the 8 legal directions from `unitId`'s
   * own position, out to the board edge — identical contract to
   * getRequiemDirectionTargets just below in this file (this only NAMES
   * which direction a click selects; previewMaserLanceCone/maserLanceStrike
   * both re-derive the direction from whatever tile was actually clicked and
   * independently resolve the real, fixed-depth cone via
   * maserLanceConeTiles). scenes/Battle.ts highlights this set as the
   * clickable one while armed.
   */
  getMaserLanceDirectionTargets(unitId: string): Coord[] {
    if (!this.canMaserLanceStrike(unitId)) return [];
    const unit = this.unitById(unitId)!;
    const tiles: Coord[] = [];
    for (const dir of CINDER_LINE_DIRECTIONS) {
      let step = 1;
      while (true) {
        const c = { x: unit.pos.x + dir.x * step, y: unit.pos.y + dir.y * step };
        if (!inBounds(this.map, c)) break;
        tiles.push(c);
        step += 1;
      }
    }
    return tiles;
  }

  /** UI preview for an armed Maser Lance: the actual cone footprint a click on `target` would fire, or null if that click doesn't name a legal direction or the ability isn't currently usable at all — same "ask the engine, never guess" contract previewRequiemSeverance/previewCinderLineFrom already follow. Reuses requiemDirectionTo's own cardinal/diagonal check (below in this file) rather than a second copy — that check has nothing Requiem-specific in it despite the name, it's this grid's one "is `target` a legal direction from `from`" test. */
  previewMaserLanceCone(unitId: string, target: Coord): Coord[] | null {
    if (!this.canMaserLanceStrike(unitId)) return null;
    const unit = this.unitById(unitId)!;
    const dir = this.requiemDirectionTo(unit.pos, target);
    if (!dir) return null;
    return this.maserLanceConeTiles(unit.pos, dir);
  }

  /**
   * Read-only damage forecast for an armed Maser Lance, same purpose as
   * forecastSplash just above but shaped around a resolved TILE SET
   * (previewMaserLanceCone) rather than a radius from a clicked tile — the
   * cone's clickable direction-set (getMaserLanceDirectionTargets) and its
   * actual hit footprint are deliberately NOT the same shape (mirrors
   * getRequiemDirectionTargets/requiemLineTiles' own split for the identical
   * reason), so this can't reuse forecastSplash's own radius-membership
   * check. Per-victim damage math (mech vs Bloom branches, no dodge) is
   * copied from forecastSplash's own missile branch rather than factored out
   * into a shared helper — small enough, and about to diverge further if a
   * Bloom-shape defender-specific rule ever lands on only one of the two
   * granted-ability strikes.
   */
  forecastMaserLance(unitId: string, target: Coord): SplashForecastEntry[] {
    const attacker = this.unitById(unitId);
    if (!attacker || attacker.downed) return [];
    const preview = this.previewMaserLanceCone(unitId, target);
    if (!preview) return [];
    const tileSet = new Set(preview.map((c) => coordKey(c)));
    const sameSideAsAttacker = this.units.filter((u) => u.side === attacker.side);
    const out: SplashForecastEntry[] = [];
    for (const victim of this.livingUnits()) {
      if (victim.instanceId === attacker.instanceId) continue;
      if (!tileSet.has(coordKey(victim.pos))) continue;
      const sameSideAsVictim = this.units.filter((u) => u.side === victim.side);
      let damage: number;
      if (victim.kind !== "bloom")
        damage = resolveMechAttack(this.map, attacker, victim, sameSideAsVictim, sameSideAsAttacker, attacker.chargedThisMove, false, false, {
          attackerKillsThisMission: this.killsThisMissionFor(attacker),
        }).damage;
      else
        damage = resolveAttackOnBloom(this.map, attacker, victim, sameSideAsVictim, attacker.chargedThisMove, {
          attackerKillsThisMission: this.killsThisMissionFor(attacker),
        }).damage;
      let downed: boolean;
      if (victim.kind !== "bloom") {
        const absorbed = Math.min(victim.shield ?? 0, damage);
        downed = victim.currentHp - (damage - absorbed) <= 0;
      } else {
        downed = (victim.endurance ?? 0) <= 0 && damage >= (victim.vitality ?? 0);
      }
      out.push({ unitId: victim.instanceId, displayName: victim.displayName, side: victim.side, damage, downed });
    }
    return out;
  }

  /**
   * Fire a Maser Lance toward `target`: resolves the legal direction from
   * `target` the same way previewMaserLanceCone does, then hits every living
   * unit in that direction's actual cone footprint (maserLanceConeTiles)
   * through the ordinary per-target combat formula — identical per-victim
   * resolution to missileStrike just above (mech vs Bloom branch, splash NOT
   * dodgable, friendly counters suppressed, recordPerformance for economy
   * crediting), copied rather than factored into a shared helper for the
   * same reason forecastMaserLance's own comment gives: small, and likely to
   * diverge further once either strike gets its own tuning pass.
   *
   * Costs this unit's entire remaining action budget and ends the turn, and
   * spends one of THIS unit's own MASER_LANCE_CHARGES_PER_MISSION charges —
   * regardless of how many units the cone actually hits, including zero,
   * same "a wasted call still costs you" rule missileStrike/fireSupport
   * already have.
   */
  maserLanceStrike(unitId: string, target: Coord): { hitIds: string[]; killedIds: string[] } | null {
    if (!this.canMaserLanceStrike(unitId)) return null;
    const attacker = this.unitById(unitId)!;
    const dir = this.requiemDirectionTo(attacker.pos, target);
    if (!dir) return null;
    const coneTiles = this.maserLanceConeTiles(attacker.pos, dir);
    const tileSet = new Set(coneTiles.map((c) => coordKey(c)));

    const hit = this.livingUnits().filter((u) => u.instanceId !== attacker.instanceId && tileSet.has(coordKey(u.pos)));
    const killedIds: string[] = [];

    for (const victim of hit) {
      const sameSideAsVictim = this.units.filter((u) => u.side === victim.side);
      const sameSideAsAttacker = this.units.filter((u) => u.side === attacker.side);
      let outcome: AttackOutcome;

      if (victim.kind !== "bloom") {
        // Same "splash shouldn't be dodgable" correction missileStrike's own
        // comment explains in full — a cone already covering the whole
        // blast footprint isn't a single aimed shot a Meeps steps out of.
        const victimDodged = false;
        const attackerDodgedCounter = rollMeepsDodge(attacker, victim, this.rng);
        const r = resolveMechAttack(
          this.map,
          attacker,
          victim,
          sameSideAsVictim,
          sameSideAsAttacker,
          attacker.chargedThisMove,
          victimDodged,
          attackerDodgedCounter,
          { attackerKillsThisMission: this.killsThisMissionFor(attacker), defenderKillsThisMission: this.killsThisMissionFor(victim) }
        );
        applyMechDamage(victim, r.damage);
        // Same friendly-counter suppression missileStrike's own comment
        // explains in full: a friendly caught in the cone still visibly
        // takes the primary damage, it just doesn't shoot back at whoever
        // fired it.
        const friendlyCounter = r.countered && victim.side === attacker.side;
        if (r.countered && r.counterDamage !== undefined && !friendlyCounter) {
          applyMechDamage(attacker, r.counterDamage);
        }
        outcome = {
          attackerId: unitId,
          defenderId: victim.instanceId,
          damage: r.damage,
          countered: r.countered && !friendlyCounter,
          counterDamage: friendlyCounter ? undefined : r.counterDamage,
          defenderDowned: victim.downed,
          attackerDowned: attacker.downed,
          defenderDodged: r.dodged,
          counterDodged: friendlyCounter ? undefined : r.counterDodged,
        };
      } else {
        const r = resolveAttackOnBloom(this.map, attacker, victim, sameSideAsVictim, attacker.chargedThisMove, {
          attackerKillsThisMission: this.killsThisMissionFor(attacker),
        });
        applyBloomDamage(victim, r.damage);
        outcome = { attackerId: unitId, defenderId: victim.instanceId, damage: r.damage, countered: false, defenderDowned: victim.downed };
      }

      this.recordPerformance(attacker, victim, outcome);
      if (outcome.defenderDowned) killedIds.push(victim.instanceId);
    }

    const chargesLeft = this.maserLanceChargesRemaining(unitId) - 1;
    attacker.maserLanceUsesRemaining = chargesLeft;
    this.noteAbilityUse(attacker, "abil_maser_lance");
    attacker.actionsRemaining = 0;
    // Firing gives your position away, same as any other attack (see
    // resolveAttack's identical line) — a Maser Lance shot is not stealthy.
    attacker.concealed = false;
    this.log.push(
      `${attacker.displayName} fires Maser Lance toward (${target.x},${target.y}) — ${hit.length} hit, ${killedIds.length} downed (${chargesLeft} charge(s) left).`
    );

    for (const victim of hit) if (victim.downed) this.handleDowned(victim);
    if (attacker.downed) this.handleDowned(attacker);
    return { hitIds: hit.map((u) => u.instanceId), killedIds };
  }

  // ---- abil_clear_bloom (Mission 3's "clean the bloom patch" pass, 23 Aug
  // 2026) — see data/abilities.ts's own comment for the full design. Same
  // canX()/getX()/verb shape as every other ability-depth verb above, but a
  // RADIUS effect on tiles rather than a target-picking one, so it belongs
  // in the contextual action bar (scenes/Battle.ts) next to Screen and
  // Sweep, not among the click-a-unit verbs Repair/Rescue are.

  /** Every bloom_mat tile within BLOOM_CLEAR_RADIUS of `from`, Chebyshev — shared by canClearBloom's "is there anything to do" check and clearBloom's own mutation, and exposed via getClearableBloomFrom for the UI preview highlight. */
  private clearableBloomTiles(from: Coord): Coord[] {
    const tiles: Coord[] = [];
    for (let y = Math.max(0, from.y - BLOOM_CLEAR_RADIUS); y <= Math.min(this.map.height - 1, from.y + BLOOM_CLEAR_RADIUS); y++) {
      for (let x = Math.max(0, from.x - BLOOM_CLEAR_RADIUS); x <= Math.min(this.map.width - 1, from.x + BLOOM_CLEAR_RADIUS); x++) {
        if (this.map.tiles[y][x] === "bloom_mat") tiles.push({ x, y });
      }
    }
    return tiles;
  }

  canClearBloom(unitId: string): boolean {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed) return false;
    if (unit.side !== "player") return false;
    if (!unit.abilities.includes("abil_clear_bloom")) return false;
    if (unit.actionsRemaining <= 0) return false;
    // Same "usable only when it would actually do something" rule
    // getRepairableFrom already applies to Repair — greyed rather than a
    // wasted click that clears nothing.
    return this.clearableBloomTiles(unit.pos).length > 0;
  }

  /** UI preview highlight — every tile clearBloom would flip from here, or empty if canClearBloom is false. Mirrors getSensorSweepAreaFrom/getInterdictedTilesFrom's own "ask the engine, never guess" contract. */
  getClearableBloomFrom(unitId: string, from: Coord): Coord[] {
    if (!this.canClearBloom(unitId)) return [];
    return this.clearableBloomTiles(from);
  }

  /**
   * Convert every bloom_mat tile within BLOOM_CLEAR_RADIUS back to plain
   * ground. Costs 1 action, does not end the turn (data/abilities.ts's own
   * comment has the full reasoning) — no per-mission limit or cooldown,
   * unlike Screen or Sweep: this is the mission's actual job, meant to be
   * repeated until hasBloomMat() reads false.
   */
  clearBloom(unitId: string): { unitId: string; tilesCleared: number } | null {
    if (!this.canClearBloom(unitId)) return null;
    const unit = this.unitById(unitId)!;
    const tiles = this.clearableBloomTiles(unit.pos);
    for (const c of tiles) this.map.tiles[c.y][c.x] = "plain";
    unit.actionsRemaining -= 1;
    this.noteAbilityUse(unit, "abil_clear_bloom");
    this.log.push(`${unit.displayName} clears ${tiles.length} bloom mat tile(s).`);
    return { unitId, tilesCleared: tiles.length };
  }

  // ---- Vault Phase 2, slice 1 (2 Sep 2026) — the first 5 Heirloom
  // abilities wired into combat. See data/heirlooms.ts's own "VAULT PHASE
  // 2, SLICE 1" header and claude/Bloom_Wars_Build_Log_Addendum_
  // VaultPhase2Slice1_02Sep2026.md for the full account of what shipped and
  // the interpretation calls made turning prose rank text into real
  // numbers. Each ability follows the exact canX()/verb() shape every
  // ability above it does; salt_root_salt has neither, because it's
  // passive (see engine/combat.ts's saltRootMultiplier instead).

  /** This unit's current rank (1-5) in one of its wielded Heirloom's abilities. Defaults to 1 — the free rank every recruited Heirloom grants — for a unit that doesn't carry the ability at all; harmless, since every call site here already gates on `unit.abilities.includes(abilityId)` first. */
  private heirloomRank(unit: BattleUnit, abilityId: string): number {
    return unit.heirloomAbilityRanks?.[abilityId] ?? 1;
  }

  canIronWord(unitId: string): boolean {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed) return false;
    if (unit.side !== "player") return false;
    if (!unit.abilities.includes("oath_iron_word")) return false;
    if (!isCooldownReady(this.cooldownReadyTurn(unit, "oath_iron_word"), this.turn)) return false;
    return unit.actionsRemaining > 0;
  }

  /**
   * oath_iron_word (Vindex/The Iron Oath) — an Heirloom-tier abil_taunt:
   * the identical `taunting` + root/lock mechanism abil_taunt already
   * grants (see engine/ai.ts's own header comment for the full redirect
   * rule), but RADIUS-gated rather than "whichever hostiles already have
   * eyes on it." Sets `tauntRadius` alongside `taunting`; engine/ai.ts's
   * four taunting-check sites read both together, and plain abil_taunt
   * never sets tauntRadius, so this is purely additive — zero behavior
   * change for every existing Taunt user.
   *
   * Costs the unit's entire remaining action budget and ends its turn,
   * same tier as abil_taunt itself — Vindex is "the widest, slowest
   * silhouette in the game," and this is still meant to be a full
   * commitment. Gated by IRON_WORD_COOLDOWN_TURNS rather than abil_taunt's
   * no-charge/reusable shape: Iron Word is the wielder's own ranked-up
   * ability, not the baseline verb every Meeps with abil_taunt gets free.
   */
  ironWord(unitId: string): boolean {
    if (!this.canIronWord(unitId)) return false;
    const unit = this.unitById(unitId)!;
    const radius = this.heirloomRank(unit, "oath_iron_word") >= 5 ? IRON_WORD_RANK5_RADIUS : IRON_WORD_RADIUS;
    unit.taunting = true;
    unit.tauntRadius = radius;
    unit.actionsRemaining = 0;
    unit.abilityCooldowns = unit.abilityCooldowns ?? {};
    unit.abilityCooldowns["oath_iron_word"] = startCooldown(this.turn, IRON_WORD_COOLDOWN_TURNS);
    this.noteAbilityUse(unit, "oath_iron_word");
    this.log.push(`${unit.displayName} plants the Iron Word — every hostile within ${radius} must answer it.`);
    return true;
  }

  canFieldTriage(unitId: string): boolean {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed) return false;
    if (unit.side !== "player") return false;
    if (!unit.abilities.includes("lastword_field_triage")) return false;
    if (!isCooldownReady(this.cooldownReadyTurn(unit, "lastword_field_triage"), this.turn)) return false;
    return unit.actionsRemaining > 0;
  }

  /** Every living, not-full-HP ally within lastword_field_triage's current radius of `from`, nearest first — the pool fieldTriage() heals from, capped at FIELD_TRIAGE_MAX_TARGETS, and exposed for the UI preview the same way getScreenableFrom/getClearableBloomFrom already are. */
  getFieldTriageTargetsFrom(unitId: string, from: Coord): BattleUnit[] {
    if (!this.canFieldTriage(unitId)) return [];
    const unit = this.unitById(unitId)!;
    const radius = this.heirloomRank(unit, "lastword_field_triage") >= 5 ? FIELD_TRIAGE_RANK5_RADIUS : FIELD_TRIAGE_RADIUS;
    return this.livingUnits()
      .filter((t) => t.side === unit.side && t.currentHp < t.maxHp && chebyshevDistance(from, t.pos) <= radius)
      .sort((a, b) => chebyshevDistance(from, a.pos) - chebyshevDistance(from, b.pos))
      .slice(0, FIELD_TRIAGE_MAX_TARGETS);
  }

  /**
   * lastword_field_triage (Migawari/The Last Word) — Repair, widened: heals
   * up to FIELD_TRIAGE_MAX_TARGETS nearest wounded allies within radius in
   * one use, via the exact same repairHealAmount() ordinary Repair uses —
   * this is Migawari's own frame doing triage, not a second healing
   * formula. Self-centered radius effect with no manual target picker,
   * mirroring abil_screen/abil_clear_bloom's shape rather than building a
   * new multi-select UI — see FIELD_TRIAGE_MAX_TARGETS's own comment in
   * data/combatTables.ts for that call, flagged rather than hidden.
   *
   * Costs 1 action, does NOT end the turn — same tier as ordinary Repair
   * and Screen. Gated by FIELD_TRIAGE_COOLDOWN_TURNS.
   */
  fieldTriage(unitId: string): RepairOutcome[] | null {
    if (!this.canFieldTriage(unitId)) return null;
    const healer = this.unitById(unitId)!;
    const targets = this.getFieldTriageTargetsFrom(unitId, healer.pos);
    const results: RepairOutcome[] = [];
    for (const target of targets) {
      const healAmount = repairHealAmount(healer);
      const amount = Math.max(0, Math.min(healAmount, target.maxHp - target.currentHp));
      target.currentHp += amount;
      if (amount > 0) this.creditAssist(healer.pilotId, REPAIR_ASSIST_FRACTION);
      results.push({ healerId: unitId, targetId: target.instanceId, amount });
    }
    healer.actionsRemaining -= 1;
    healer.abilityCooldowns = healer.abilityCooldowns ?? {};
    healer.abilityCooldowns["lastword_field_triage"] = startCooldown(this.turn, FIELD_TRIAGE_COOLDOWN_TURNS);
    this.noteAbilityUse(healer, "lastword_field_triage");
    this.log.push(
      results.length
        ? `${healer.displayName} runs field triage — ${results.map((r) => `${r.amount} HP`).join(", ")}.`
        : `${healer.displayName} runs field triage — nobody in range needed it.`
    );
    return results;
  }

  canFarsightSignature(unitId: string): boolean {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed) return false;
    if (unit.side !== "player") return false;
    if (!unit.abilities.includes("farsight_signature")) return false;
    if (!isCooldownReady(this.cooldownReadyTurn(unit, "farsight_signature"), this.turn)) return false;
    return unit.actionsRemaining > 0;
  }

  /**
   * farsight_signature (Panoptes/Farsight's Reckoning) — Sensor Sweep,
   * unbounded: paints EVERY living hostile on the map, burrowed included,
   * via the identical `revealedUntilTurn` mechanism abil_sensor_sweep
   * already uses (see sensorSweep()'s own comment for the exact "until the
   * end of the following enemy turn" semantics) — just with no radius
   * filter at all. This is Panoptes' actual signature move, not a side
   * ability.
   *
   * DURATION AT RANK 5: `revealedUntilTurn = this.turn` (rank 1-4) expires
   * the instant Mission.turn next increments — one hostile phase, same as
   * a plain sweep. Rank 5's "duration 2 turns" is read as surviving one
   * MORE increment: `revealedUntilTurn = this.turn + 1` stays
   * `>= currentTurn` through two hostile phases instead of one (see
   * engine/ai.ts's isVisibleTo, `target.revealedUntilTurn >= currentTurn`).
   *
   * Costs 1 action, does NOT end the turn — same tier as Sensor Sweep.
   * Gated by FARSIGHT_SIGNATURE_COOLDOWN_TURNS rather than a per-mission
   * charge budget, since that's the shape data/heirlooms.ts specifies for
   * this kit (cooldownTurns: 5), not a spend-and-it's-gone resource.
   */
  farsightSignature(unitId: string): SensorSweepOutcome | null {
    if (!this.canFarsightSignature(unitId)) return null;
    const unit = this.unitById(unitId)!;
    const revealThrough = this.turn + (this.heirloomRank(unit, "farsight_signature") >= 5 ? 1 : 0);
    const revealedIds: string[] = [];
    for (const target of this.livingUnits()) {
      if (target.side === unit.side) continue;
      target.revealedUntilTurn = revealThrough;
      revealedIds.push(target.instanceId);
    }
    unit.actionsRemaining -= 1;
    unit.abilityCooldowns = unit.abilityCooldowns ?? {};
    unit.abilityCooldowns["farsight_signature"] = startCooldown(this.turn, FARSIGHT_SIGNATURE_COOLDOWN_TURNS);
    this.noteAbilityUse(unit, "farsight_signature");
    this.log.push(
      revealedIds.length
        ? `${unit.displayName} calls Panoptes' watch — ${revealedIds.length} contact(s) painted across the whole field.`
        : `${unit.displayName} calls Panoptes' watch — no contacts anywhere on the field.`
    );
    return { sweeperId: unitId, radius: Infinity, revealedIds, revealedUntilTurn: revealThrough };
  }

  canLedgerOverextended(unitId: string): boolean {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed) return false;
    if (unit.side !== "player") return false;
    if (!unit.abilities.includes("ledger_overextended")) return false;
    if (unit.overextended) return false;
    if (!isCooldownReady(this.cooldownReadyTurn(unit, "ledger_overextended"), this.turn)) return false;
    return unit.actionsRemaining > 0;
  }

  /**
   * ledger_overextended (Skuld/Widow's Ledger) — "Trade defense for one
   * turn: 0 DEF, +40% ATK." A posture, same family as `taunting`/`braced`/
   * `concealed`: sets `unit.overextended`, read live by engine/combat.ts's
   * overextendedAttackMultiplier/overextendedDefense at the point each stat
   * is actually used, and cleared in the exact same start-of-own-next-turn
   * loop those three already share — so "one turn" means "survives the
   * intervening hostile phase, clears when your own next turn begins,"
   * same as Interdict's `braced`. The exposure through that hostile phase
   * IS the trade, not an oversight.
   *
   * Costs 1 action, does NOT end the turn — unlike Ambush/Interdict/Taunt's
   * whole-turn posture cost, this is meant to be armed and then spent
   * attacking in the same turn (a -DEF/+ATK trade with no follow-up attack
   * that turn is close to pointless), same tier as Repair/Screen/Sensor
   * Sweep. Gated by LEDGER_OVEREXTENDED_COOLDOWN_TURNS.
   */
  ledgerOverextended(unitId: string): boolean {
    if (!this.canLedgerOverextended(unitId)) return false;
    const unit = this.unitById(unitId)!;
    unit.overextended = true;
    // Rank 5 extends the trade one extra turn — see BattleUnit.
    // overextendedTurnsRemaining's own comment for why this mirrors
    // stealthTurnsRemaining's shape rather than a second boolean. Left
    // undefined at rank 1-4, same as an ordinary Ambush user who never
    // sets stealthTurnsRemaining at all.
    //
    // BUG FIX, 2 Sep 2026 (Vault Phase 2, slice 1 test pass): this used to
    // read `LEDGER_OVEREXTENDED_RANK5_DURATION_TURNS - 1`, reasoning "the
    // casting turn already counts as turn 1, so only 1 more decrement is
    // needed." That reasoning doesn't match how the turn-start loop actually
    // ticks this down — ambush()'s stealthTurnsRemaining, the pattern this
    // is deliberately mirroring, sets the FULL duration with no "-1" (see
    // its own assignment a few hundred lines up), and a side-by-side trace
    // of the turn-start loop confirms why: starting at N-1 clears on the
    // very FIRST decrement, at the wielder's very next turn, identical to
    // rank 1-4 — the rank-5 upgrade was a no-op. Starting at the full
    // LEDGER_OVEREXTENDED_RANK5_DURATION_TURNS survives that first decrement
    // (still > 0 after it) and only clears on the second, which is what
    // "duration extended to 2 turns" actually requires. Caught by writing
    // heirloomVaultAbilities.test.ts's rank-5 duration test against this
    // code, not by inspection — it read correct until traced turn-by-turn.
    if (this.heirloomRank(unit, "ledger_overextended") >= 5) {
      unit.overextendedTurnsRemaining = LEDGER_OVEREXTENDED_RANK5_DURATION_TURNS;
    }
    unit.actionsRemaining -= 1;
    unit.abilityCooldowns = unit.abilityCooldowns ?? {};
    unit.abilityCooldowns["ledger_overextended"] = startCooldown(this.turn, LEDGER_OVEREXTENDED_COOLDOWN_TURNS);
    this.noteAbilityUse(unit, "ledger_overextended");
    this.log.push(`${unit.displayName} overextends — defenseless, and hitting harder for it.`);
    return true;
  }

  // ---- Vault Phase 2, slice 2 (3 Sep 2026) — the three Heirloom SIGNATURE
  // abilities wired into combat this pass: ledger_entry, oath_oathkeeper,
  // deadfall_strike. See data/heirlooms.ts's own "VAULT PHASE 2, SLICE 2"
  // header and claude/Bloom_Wars_Build_Log_Addendum_VaultPhase2Slice2_
  // 03Sep2026.md for the interpretation calls made turning prose rank text
  // into real numbers. Same canX()/verb() shape slice 1 established above;
  // ledger_entry has neither, same reason salt_root_salt doesn't — it's
  // passive (see engine/combat.ts's ledgerEntryMultiplier instead).

  /**
   * ledger_entry's own kill count for `unit` this mission — read straight
   * off Mission.unitPerformance rather than a second, unit-local counter
   * (see engine/combat.ts's ledgerEntryMultiplier for why that's the one
   * true source). 0 for a unit with no pilotId (hostiles, Bloom — neither
   * can ever carry ledger_entry anyway) or no performance bucket.
   */
  private killsThisMissionFor(unit: BattleUnit): number {
    return unit.pilotId ? (this.unitPerformance[unit.pilotId]?.kills ?? 0) : 0;
  }

  canOathkeeper(unitId: string): boolean {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed) return false;
    if (unit.side !== "player") return false;
    if (!unit.abilities.includes("oath_oathkeeper")) return false;
    if (unit.oathkeeperActive) return false; // cannot be re-armed while already active — same "no re-entry" guard canLedgerOverextended uses
    if (!isCooldownReady(this.cooldownReadyTurn(unit, "oath_oathkeeper"), this.turn)) return false;
    return unit.actionsRemaining > 0;
  }

  /**
   * oath_oathkeeper (Vindex/The Iron Oath) — "Cannot be reduced below 1 HP
   * for N turns. All spared damage lands the instant it ends." A self-only
   * posture, same tier as ledger_overextended: costs 1 action, does NOT end
   * the turn — Vindex is meant to be able to arm this and still act (Iron
   * Word, or simply moving into position) the same turn, not spend its
   * entire budget the way ironWord()'s taunt does.
   *
   * Sets `oathkeeperActive` + the rank-appropriate `oathkeeperTurnsLeft`
   * (OATHKEEPER_DURATION_TURNS at rank 1-4, OATHKEEPER_RANK5_DURATION_TURNS
   * at rank 5) and zeroes any leftover `oathkeeperDeferredDamage` from a
   * previous use — the interception itself lives in engine/combat.ts's
   * applyMechDamage, which reads `oathkeeperActive` live; the window's
   * expiry and the deferred damage actually landing happen in the
   * start-of-own-next-turn loop below (runHostileTurn), mirroring exactly
   * where overextendedTurnsRemaining's own clock ticks.
   */
  oathkeeper(unitId: string): boolean {
    if (!this.canOathkeeper(unitId)) return false;
    const unit = this.unitById(unitId)!;
    unit.oathkeeperActive = true;
    unit.oathkeeperTurnsLeft = this.heirloomRank(unit, "oath_oathkeeper") >= 5 ? OATHKEEPER_RANK5_DURATION_TURNS : OATHKEEPER_DURATION_TURNS;
    unit.oathkeeperDeferredDamage = 0;
    unit.actionsRemaining -= 1;
    unit.abilityCooldowns = unit.abilityCooldowns ?? {};
    unit.abilityCooldowns["oath_oathkeeper"] = startCooldown(this.turn, OATHKEEPER_COOLDOWN_TURNS);
    this.noteAbilityUse(unit, "oath_oathkeeper");
    this.log.push(`${unit.displayName} swears the Iron Oath — cannot fall for ${unit.oathkeeperTurnsLeft} turn(s).`);
    return true;
  }

  canDeadfallStrike(unitId: string): boolean {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed) return false;
    if (unit.side !== "player") return false;
    if (!unit.abilities.includes("deadfall_strike")) return false;
    if (!isCooldownReady(this.cooldownReadyTurn(unit, "deadfall_strike"), this.turn)) return false;
    return unit.actionsRemaining > 0;
  }

  /**
   * Every living hostile currently visible to the whole player side — the
   * pool deadfall_strike can target, "any range" rather than the wielder's
   * own attackRange/vision. Mirrors scenes/Battle.ts's own fog-of-war query
   * (engine/ai.ts's unitsVisibleToSide, the same check that gates what's
   * drawn/clickable on the board at all) rather than inventing a second
   * visibility rule — a target this ability could reach but the player
   * can't otherwise see wouldn't be selectable in the UI anyway. Empty
   * whenever canDeadfallStrike is false, same "ask the engine, never guess"
   * contract every other getXTargetsFrom/getXFrom method here follows.
   */
  getDeadfallStrikeTargetsFrom(unitId: string): BattleUnit[] {
    if (!this.canDeadfallStrike(unitId)) return [];
    const visibleIds = this.playerVisibleHostileIds();
    return this.livingUnits().filter((u) => u.side === "hostile" && visibleIds.has(u.instanceId));
  }

  /**
   * deadfall_strike (Ichigeki/Deadfall) — "An unavoidable, uncounterable
   * strike at x2 damage, any range." Deliberately does NOT call
   * resolveAttack: that private method's very first line is the
   * attackRange gate this ability exists to bypass, so this runs the same
   * two damage resolvers (resolveMechAttack/resolveAttackOnBloom) directly,
   * with resolveMechAttack's new `noCounter` opt doing the "uncounterable"
   * half and simply never rolling a dodge doing the "unavoidable" half (no
   * dodge roll happens here at all — defenderDodged is left at resolveMechAttack's
   * own default false). Damage is the SAME base computation a normal hit
   * from this unit would produce, then doubled by
   * DEADFALL_STRIKE_DAMAGE_MULTIPLIER — so it still respects the target's
   * own defense stat, terrain, salt_root_salt/ledger_entry multipliers,
   * etc.; only the range/dodge/counter bypass is special.
   *
   * recordPerformance is called explicitly (the normal attack path's own
   * damage-credit/kill-credit bookkeeping) — a kill through this ability
   * counts toward the wielder's own mission kills the same as any other
   * kill, which matters for real: ledger_entry's own stacking reads exactly
   * that count.
   *
   * REVEAL, honestly reported rather than faked: this codebase's only
   * "hidden player unit" concepts are `concealed`/`stealthTurnsRemaining`
   * (Meeps abil_ambush / Munti abil_screen) — there is no general "more
   * visible than normal" state for a unit that wasn't already cloaked, so
   * for a wielder who ISN'T concealed at the moment of the strike, this
   * ability's own "reveals the wielder's position" clause has nothing to
   * do — the wielder was already fully visible, same as before the shot.
   * For a wielder who IS concealed: a normal Attack (resolveAttack) already
   * breaks concealment unconditionally the instant it fires ("firing gives
   * your position away"), so rank 1's "reveal... for the rest of the turn"
   * is implemented as that identical unconditional break, done here since
   * this method doesn't route through resolveAttack. Rank 5's "the reveal
   * is delayed one full turn instead of immediate" is implemented as
   * deliberately NOT breaking it here — unlike every other attack in the
   * game, this one specific shot leaves an active ambush cloak's own
   * stealthTurnsRemaining clock running, so it survives exactly one more
   * hostile phase than firing normally would before expiring through the
   * ordinary turn-start loop. Flagged plainly: this is the closest honest
   * equivalent this codebase's actual mechanics support, not a full
   * "broadcast to every hostile AI" system — decideHostileAction's own
   * targeting is unchanged by this ability either way.
   */
  deadfallStrike(unitId: string, targetId: string): AttackOutcome | null {
    if (!this.canDeadfallStrike(unitId)) return null;
    const attacker = this.unitById(unitId)!;
    const defender = this.unitById(targetId);
    // Refuses anything that isn't a live hostile — written as "not hostile"
    // rather than "=== attacker.side" so this can never accidentally target
    // a downed or non-hostile unit even if attacker.side were ever
    // something other than "player" (canDeadfallStrike already guarantees
    // it is, but this stays correct on its own terms either way).
    if (!defender || defender.downed || defender.side !== "hostile") return null;
    const visibleIds = this.playerVisibleHostileIds();
    if (!visibleIds.has(defender.instanceId)) return null;

    const sameSideAsAttacker = this.units.filter((u) => u.side === attacker.side);
    const sameSideAsDefender = this.units.filter((u) => u.side === defender.side);

    let baseDamage: number;
    if (defender.kind !== "bloom") {
      const r = resolveMechAttack(this.map, attacker, defender, sameSideAsDefender, sameSideAsAttacker, false, false, false, {
        attackerKillsThisMission: this.killsThisMissionFor(attacker),
        noCounter: true,
      });
      baseDamage = r.damage;
    } else {
      const r = resolveAttackOnBloom(this.map, attacker, defender, sameSideAsDefender, false, {
        attackerKillsThisMission: this.killsThisMissionFor(attacker),
      });
      baseDamage = r.damage;
    }
    const dealt = Math.round(baseDamage * DEADFALL_STRIKE_DAMAGE_MULTIPLIER);
    if (defender.kind !== "bloom") applyMechDamage(defender, dealt);
    else applyBloomDamage(defender, dealt);

    const outcome: AttackOutcome = {
      attackerId: unitId,
      defenderId: targetId,
      damage: dealt,
      countered: false,
      defenderDowned: defender.downed,
      attackerDowned: false,
    };
    this.recordPerformance(attacker, defender, outcome);

    attacker.actionsRemaining = 0;
    const rank5 = this.heirloomRank(attacker, "deadfall_strike") >= 5;
    if (!rank5) {
      // Rank 1 — see this method's own header comment for the full reveal
      // reasoning. Mirrors resolveAttack's identical unconditional clear; a
      // no-op if the wielder wasn't concealed to begin with.
      attacker.concealed = false;
      attacker.stealthTurnsRemaining = undefined;
    }
    // Rank 5 — deliberately no clear here at all (see header comment).
    attacker.abilityCooldowns = attacker.abilityCooldowns ?? {};
    attacker.abilityCooldowns["deadfall_strike"] = startCooldown(this.turn, DEADFALL_STRIKE_COOLDOWN_TURNS);
    this.noteAbilityUse(attacker, "deadfall_strike");
    this.log.push(`${attacker.displayName} lands Ichigeki on ${defender.displayName} for ${dealt} — unavoidable, uncounterable.`);
    if (defender.downed) this.handleDowned(defender);
    return outcome;
  }

  // ---- Vault Phase 2, slice 3 (3 Sep 2026) — Surtr's full 3-ability kit:
  // cinder_line_signature, cinder_firebreak, cinder_draft. See data/
  // heirlooms.ts's own "VAULT PHASE 2, SLICE 3" header and the SurtrLine
  // interface's own comment (above this class) for the hazard-tracking
  // design. Same canX()/getX()/verb() shape every ability above follows.

  canCinderLineSignature(unitId: string): boolean {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed) return false;
    if (unit.side !== "player") return false;
    if (!unit.abilities.includes("cinder_line_signature")) return false;
    if (!isCooldownReady(this.cooldownReadyTurn(unit, "cinder_line_signature"), this.turn)) return false;
    return unit.actionsRemaining > 0;
  }

  /**
   * Every tile a cinder_line_signature cast could END at — one entry per
   * (direction, step) pair, CINDER_LINE_DIRECTIONS x 1..CINDER_LINE_MAX_TILES,
   * clipped at the board edge. This is a CLICK TARGET SET, same contract as
   * getFireSupportAreaFrom/getMissileAreaFrom above: clicking any one of
   * these tiles doesn't just ignite that single tile, it ignites the whole
   * straight run from the wielder's adjacent tile out to the clicked one —
   * see cinderLineSignature()'s own comment for why, and
   * previewCinderLineFrom() below for how scenes/Battle.ts can show the
   * player which tiles that actually is before they commit to the click.
   */
  getCinderLineAreaFrom(unitId: string, from: Coord): Coord[] {
    if (!this.canCinderLineSignature(unitId)) return [];
    const tiles: Coord[] = [];
    for (const dir of CINDER_LINE_DIRECTIONS) {
      for (let step = 1; step <= CINDER_LINE_MAX_TILES; step++) {
        const c = { x: from.x + dir.x * step, y: from.y + dir.y * step };
        if (!inBounds(this.map, c)) break;
        tiles.push(c);
      }
    }
    return tiles;
  }

  /**
   * The actual tile run a click on `target` would ignite: `unit.pos`'s
   * adjacent tile in `target`'s direction, out to `target` itself inclusive
   * — null if `target` isn't a legal line endpoint (not a straight
   * cardinal/diagonal run from the wielder, or beyond CINDER_LINE_MAX_TILES).
   * Pure/read-only, shared by cinderLineSignature() (which calls this then
   * commits the result) and previewCinderLineFrom() (which just returns it
   * for a UI preview) — one true definition of "what does this click do."
   */
  private cinderLineTilesTo(from: Coord, target: Coord): Coord[] | null {
    const ddx = target.x - from.x;
    const ddy = target.y - from.y;
    if (ddx === 0 && ddy === 0) return null;
    const isCardinal = ddx === 0 || ddy === 0;
    const isDiagonal = Math.abs(ddx) === Math.abs(ddy);
    if (!isCardinal && !isDiagonal) return null;
    const steps = Math.max(Math.abs(ddx), Math.abs(ddy));
    if (steps > CINDER_LINE_MAX_TILES) return null;
    const dirX = Math.sign(ddx);
    const dirY = Math.sign(ddy);
    const tiles: Coord[] = [];
    for (let s = 1; s <= steps; s++) {
      const c = { x: from.x + dirX * s, y: from.y + dirY * s };
      if (!inBounds(this.map, c)) return null;
      tiles.push(c);
    }
    return tiles;
  }

  /** UI preview for an armed cinder_line_signature: the tiles a click on `target` would actually ignite, or null if that click wouldn't be a legal line. Returns null outright (rather than guessing) if the ability isn't currently usable at all, same "ask the engine, never guess" contract getDeadfallStrikeTargetsFrom already follows. */
  previewCinderLineFrom(unitId: string, target: Coord): Coord[] | null {
    if (!this.canCinderLineSignature(unitId)) return null;
    const unit = this.unitById(unitId)!;
    return this.cinderLineTilesTo(unit.pos, target);
  }

  /**
   * cinder_line_signature (Surtr) — "Sets a chosen line of up to 5 tiles
   * burning for 3 turns — 15 damage/turn to anything standing on it,
   * hostile or friendly, no exception on the tiles themselves." Creates one
   * new SurtrLine (see that interface's own comment for the full design)
   * from the wielder's adjacent tile out to `target`, at
   * CINDER_LINE_DAMAGE_PER_TURN/turn for CINDER_LINE_DURATION_TURNS
   * (CINDER_LINE_RANK5_DURATION_TURNS at rank 5 — "damage unchanged" per the
   * rank5 text, so only the duration constant changes).
   *
   * Costs the unit's entire remaining action budget and ends its turn —
   * same tier as fireSupport()/deadfallStrike() above, both this file's
   * other "commit a whole turn to a battlefield-shaping strike" abilities.
   * The rank text doesn't state an action cost explicitly (none of this
   * kit's three abilities' prose does — same gap ironWord/fireSupport's own
   * rank text has), so this is a judgment call, not spec: flagged here
   * rather than silently decided, on the reasoning that placing a
   * multi-turn area hazard is a bigger commitment than Firebreak/Draft's
   * own one-action management tools below, which do NOT end the turn.
   */
  cinderLineSignature(unitId: string, target: Coord): boolean {
    if (!this.canCinderLineSignature(unitId)) return false;
    const unit = this.unitById(unitId)!;
    const tiles = this.cinderLineTilesTo(unit.pos, target);
    if (!tiles) return false;
    const rank5 = this.heirloomRank(unit, "cinder_line_signature") >= 5;
    const duration = rank5 ? CINDER_LINE_RANK5_DURATION_TURNS : CINDER_LINE_DURATION_TURNS;
    this.activeSurtrLines.push({
      ownerId: unit.instanceId,
      ownerSide: unit.side,
      tiles,
      turnsRemaining: duration,
      damagePerTurn: CINDER_LINE_DAMAGE_PER_TURN,
      friendlyImmuneTurnsRemaining: 0,
    });
    unit.actionsRemaining = 0;
    unit.abilityCooldowns = unit.abilityCooldowns ?? {};
    unit.abilityCooldowns["cinder_line_signature"] = startCooldown(this.turn, CINDER_LINE_SIGNATURE_COOLDOWN_TURNS);
    this.noteAbilityUse(unit, "cinder_line_signature");
    this.log.push(`${unit.displayName} sets a ${tiles.length}-tile line burning for ${duration} turn(s).`);
    return true;
  }

  canFirebreak(unitId: string): boolean {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed) return false;
    if (unit.side !== "player") return false;
    if (!unit.abilities.includes("cinder_firebreak")) return false;
    if (!isCooldownReady(this.cooldownReadyTurn(unit, "cinder_firebreak"), this.turn)) return false;
    // "One of the wielder's own active Surtr lines" — nothing to extinguish
    // without one. cinder_line_signature's cooldown (5) outlasting even its
    // own rank-5 duration (4) means a wielder can only ever have at most one
    // line active (see SurtrLine.ownerId's own comment), so `find` here
    // never has more than one candidate to pick between in practice.
    if (!this.activeSurtrLines.some((l) => l.ownerId === unitId)) return false;
    return unit.actionsRemaining > 0;
  }

  /**
   * cinder_firebreak (Firebreak) — "Instantly extinguish one of the
   * wielder's own active Surtr lines." Rank 5 adds: "Extinguishing also
   * deals the line's remaining total damage to every hostile currently
   * standing on it, all at once." Costs 1 action, does NOT end the turn —
   * same tier as oathkeeper()/ledgerOverextended() above, a quick reactive
   * management tool rather than a battlefield-shaping commitment (see
   * cinderLineSignature()'s own comment for why THAT one is priced
   * differently); a wielder who lights a line and immediately regrets it
   * can still act again this turn to walk it back, once cooldown allows.
   *
   * "The line's remaining total damage" is a placeholder READING of rank
   * 5's prose, not a number pulled from spec: taken here as
   * damagePerTurn * turnsRemaining at the moment of extinguishing — i.e.
   * exactly the damage every hostile still standing on the line would have
   * taken over its full remaining lifetime if it had been left to burn out
   * naturally, front-loaded into one instant burst instead. Applied once
   * per hostile currently on the line's tiles (not per-tile — a hostile
   * that somehow occupies two tiles of the same line, impossible today
   * since units are single-tile, would only take it once either way), flat
   * and unmitigated, mirroring tickSurtrLines' own damage application
   * exactly. Credited via recordContribution/resolveKill (this file's own
   * off-board-strike pattern, e.g. fireSupport() above) rather than left
   * uncredited the way the ordinary per-turn tick is: unlike that ambient
   * tick, THIS damage is the direct result of the wielder choosing to
   * detonate it right now, which reads as an attributable action the same
   * way a called-in strike is.
   */
  firebreak(unitId: string): boolean {
    if (!this.canFirebreak(unitId)) return false;
    const unit = this.unitById(unitId)!;
    const idx = this.activeSurtrLines.findIndex((l) => l.ownerId === unitId);
    const line = this.activeSurtrLines[idx];
    const rank5 = this.heirloomRank(unit, "cinder_firebreak") >= 5;
    let hitCount = 0;
    if (rank5) {
      const remainingTotal = line.damagePerTurn * line.turnsRemaining;
      const tileSet = new Set(line.tiles.map(coordKey));
      const caughtHostiles = this.livingUnits().filter((u) => u.side !== unit.side && tileSet.has(coordKey(u.pos)));
      for (const victim of caughtHostiles) {
        if (victim.kind === "bloom") applyBloomDamage(victim, remainingTotal);
        else applyMechDamage(victim, remainingTotal);
        this.recordContribution(victim.instanceId, unit.pilotId, remainingTotal);
        if (victim.downed) this.resolveKill(victim.instanceId, unit.pilotId);
        hitCount += 1;
      }
      for (const victim of caughtHostiles) if (victim.downed) this.handleDowned(victim);
    }
    this.activeSurtrLines.splice(idx, 1);
    unit.actionsRemaining -= 1;
    unit.abilityCooldowns = unit.abilityCooldowns ?? {};
    unit.abilityCooldowns["cinder_firebreak"] = startCooldown(this.turn, CINDER_FIREBREAK_COOLDOWN_TURNS);
    this.noteAbilityUse(unit, "cinder_firebreak");
    this.log.push(
      rank5 && hitCount > 0
        ? `${unit.displayName} snuffs the line — ${hitCount} hostile(s) caught in the burst.`
        : `${unit.displayName} snuffs the line out.`
    );
    return true;
  }

  canDraft(unitId: string): boolean {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed) return false;
    if (unit.side !== "player") return false;
    if (!unit.abilities.includes("cinder_draft")) return false;
    if (!isCooldownReady(this.cooldownReadyTurn(unit, "cinder_draft"), this.turn)) return false;
    // Same "nothing to do without an active line" gate as canFirebreak —
    // "allies moving through a friendly Surtr line" has nothing to grant
    // immunity FROM if the wielder has no line burning right now.
    if (!this.activeSurtrLines.some((l) => l.ownerId === unitId)) return false;
    return unit.actionsRemaining > 0;
  }

  /**
   * cinder_draft (Draft) — "Allies moving through a friendly Surtr line
   * take no burn damage for 1 turn." Rank 5: "Duration 2 turns." Opens the
   * immunity window (SurtrLine.friendlyImmuneTurnsRemaining) on every
   * currently-active line this wielder owns — in practice at most one, per
   * SurtrLine.ownerId's own comment. Costs 1 action, does NOT end the turn —
   * same tier as Firebreak just above, for the identical reasoning.
   */
  draft(unitId: string): boolean {
    if (!this.canDraft(unitId)) return false;
    const unit = this.unitById(unitId)!;
    const rank5 = this.heirloomRank(unit, "cinder_draft") >= 5;
    const duration = rank5 ? CINDER_DRAFT_RANK5_DURATION_TURNS : CINDER_DRAFT_DURATION_TURNS;
    for (const line of this.activeSurtrLines) {
      if (line.ownerId === unitId) line.friendlyImmuneTurnsRemaining = duration;
    }
    unit.actionsRemaining -= 1;
    unit.abilityCooldowns = unit.abilityCooldowns ?? {};
    unit.abilityCooldowns["cinder_draft"] = startCooldown(this.turn, CINDER_DRAFT_COOLDOWN_TURNS);
    this.noteAbilityUse(unit, "cinder_draft");
    this.log.push(`${unit.displayName} calls Draft — allies pass the line clean for ${duration} turn(s).`);
    return true;
  }

  /**
   * The clear_bloom objective's own countervailing pressure (data/combatTables.ts's
   * BLOOM_REGROWTH_* constants have the full pacing rationale). Fires on
   * turn BLOOM_REGROWTH_FIRST_TURN and every BLOOM_REGROWTH_INTERVAL_TURNS
   * after it, converting up to BLOOM_REGROWTH_TILES_PER_TICK clean tiles
   * adjacent to existing bloom_mat back into bloom_mat.
   *
   * Deliberately DETERMINISTIC, not a percentage roll: scans the board in a
   * fixed row-major order, and for each bloom_mat tile it finds, spreads
   * into the FIRST cardinal-adjacent plain/scrub neighbour (fixed
   * right/down/left/up order, from grid.ts's own neighbors4) — the same
   * "no Math.random on anything a regression test needs to pin down"
   * discipline the rest of this file's deterministic formulas follow (see
   * rollMeepsDodge for the one place this file DOES roll, and why that one
   * is fine to be random: it isn't a board-state mutation a test needs to
   * reproduce exactly).
   *
   * No-op for every mission that isn't clear_bloom — a mission with
   * bloom_mat as pure terrain flavour (none currently ship, but nothing
   * stops one) never has this tick running against it.
   */
  private tickBloomRegrowth(): void {
    if (this.mission.objective !== "clear_bloom") return;
    if (this.turn < BLOOM_REGROWTH_FIRST_TURN) return;
    if ((this.turn - BLOOM_REGROWTH_FIRST_TURN) % BLOOM_REGROWTH_INTERVAL_TURNS !== 0) return;
    let spread = 0;
    for (let y = 0; y < this.map.height && spread < BLOOM_REGROWTH_TILES_PER_TICK; y++) {
      for (let x = 0; x < this.map.width && spread < BLOOM_REGROWTH_TILES_PER_TICK; x++) {
        if (this.map.tiles[y][x] !== "bloom_mat") continue;
        for (const n of neighbors4({ x, y })) {
          if (!inBounds(this.map, n)) continue;
          const t = this.map.tiles[n.y][n.x];
          if (t === "plain" || t === "scrub") {
            this.map.tiles[n.y][n.x] = "bloom_mat";
            spread += 1;
            break;
          }
        }
      }
    }
    if (spread > 0) this.log.push(`Bloom mat spreads — ${spread} tile(s) reclaimed.`);
  }

  /**
   * The single choke point for hostile movement — runHostileTurn() moves
   * hostiles by calling this and nothing else. Reaction fire hooks in here
   * rather than at the AI call site so that "a hostile moved" and "the
   * overwatchers get their shot" cannot come apart: any future hostile
   * movement (a reposition ability, a fear/rout behaviour, a second AI pass)
   * routes through this method and is covered for free.
   */
  private moveHostile(unit: BattleUnit, path: Coord[]): void {
    const dest = path[path.length - 1];
    unit.chargedThisMove = unit.chassis === "centauroid" && isStraightLineCharge(this.map, path, "centauroid");
    unit.pos = dest;
    unit.actionsRemaining = Math.max(0, unit.actionsRemaining - 1);
    for (const step of path.slice(1)) {
      const fired = evaluateZoneEntered(this.mission.events, step, this.turn, this.eventState);
      for (const ev of fired) this.applyEventAction(ev.action);
    }
    // Reaction fire resolves as part of the move, before control returns to
    // the caller — see runHostileTurn's ordering comment. Interdiction
    // (abil_interdict) hangs off this same choke point and resolves second,
    // so a mover already killed by a reaction shot is never also pinned.
    this.triggerOverwatch(unit);
    this.triggerInterdiction(unit);
  }

  private handleDowned(unit: BattleUnit): void {
    this.log.push(`${unit.displayName} is downed.`);
    // Vault Phase 2, slice 5 (3 Sep 2026) — lastword_last_rites' own "this
    // turn" gate reads this. Latched here unconditionally (every side, not
    // just player) since handleDowned is the one place ANY unit's `downed`
    // flag is processed after combat.ts already set it true — see this
    // method's own call sites. Harmless on a hostile/Bloom; nothing reads
    // it there.
    unit.downedOnTurn = this.turn;

    // Commander down (25 Aug 2026) — checked FIRST, before anything else in
    // this method, on purpose. Independent Campaign doc §6a: Rourke going
    // to 0 HP "doesn't get redirected onto someone else and it doesn't get
    // waved off — it ends the mission attempt outright and sends the
    // player back to the briefing screen to try again, with nothing about
    // that attempt ever resolving, including the permadeath check itself."
    // That "nothing" is read literally: this returns before the
    // rescue-failure check right below (if she happened to be carrying a
    // rescued NPC, that attempt is voided too, not scored a failure),
    // before survivalBonus/wasDowned tracking, before evaluatePermadeathCheck
    // ever runs, and before unit_downed scripted events fire. Same
    // data-driven PilotRecord.exemptFromPermadeath flag
    // evaluatePermadeathCheck itself reads (data/types.ts) — not a
    // hardcoded pilot id — so this stays correct if that flag ever moves to
    // a different pilot; see that function's own comment in
    // campaignState.ts for how its exempt branch now relates to this one.
    if (unit.side === "player" && unit.pilotId) {
      const commander = findPilot(unit.pilotId);
      if (commander?.exemptFromPermadeath) {
        this.outcome = "commander_down";
        this.commanderDownPilotId = unit.pilotId;
        this.log.push(`${commander.displayName} is down — command down. Mission attempt ends; back to briefing.`);
        return;
      }
    }

    // Mission 5's rescue-and-recruit bonus objective (23 Aug 2026): a
    // rescue can fail two ways — the NPC themselves is killed before ever
    // being reached (unit.npcIncapacitated), or whoever picked them up goes
    // down while still carrying them (unit.carryingRescueId). Either one
    // ends the attempt; there's no "someone else picks up the body" second
    // chance this pass. Checked against rescueOutcome === "pending" so a
    // downing after the rescue already succeeded (carryingRescueId already
    // cleared by checkRescueExtraction) or on a mission with no rescue at
    // all (rescueOutcome stays "none") is correctly a no-op here.
    if (this.rescueOutcome === "pending" && (unit.npcIncapacitated || unit.carryingRescueId)) {
      this.rescueOutcome = "failed";
      this.log.push("The rescue attempt fails.");
    }

    // Rule 1 (engine/campaignState.ts): evaluated live, right here, at the
    // exact moment of downing — not deferred to mission end, because the
    // set of "living Munti on this side" can change turn to turn within
    // the same mission (a Fabricator redeploy could put one back on the
    // board; a Munti downed later removes one). Only player-side pilots
    // are campaign-tracked; hostile mechs/Bloom are no-ops inside the
    // check itself, but skipped here too so this never runs on every
    // Bloom kill for nothing.
    // Latch the turn this side stopped having a lifeline on the board.
    // Deliberately OUTSIDE the pilotId guard below and checked before the
    // permadeath call: by the time handleDowned runs, engine/combat.ts has
    // already set unit.downed, so this filter correctly excludes the unit
    // currently going down — meaning a Munti's own downing is the moment
    // that latches this, and a Munti who is also the last one gets
    // turnsWithoutMunti 0, which is right. A squad that never had a Munti
    // at all (possible in a directly-constructed test Mission, never in
    // live play — canLaunchMission blocks it) latches on its first loss,
    // which reads as "there was never one," also right.
    if (unit.side === "player" && this.muntiCollapseTurn === undefined) {
      const livingMuntis = this.units.filter((u) => u.side === "player" && u.path === "munti" && !u.downed);
      if (livingMuntis.length === 0) this.muntiCollapseTurn = this.turn;
    }

    if (unit.side === "player" && unit.pilotId) {
      // Campaign economy pass: survivalBonus tracking. This method is the
      // one place a player unit's `.downed` flag ever flips true (see
      // this method's own call sites), so it's also the single correct
      // place to latch "was this pilot ever downed this mission" —
      // latched, not reset, even though a future Fabricator mid-mission
      // redeploy (not built) could put the unit back on the board:
      // survivalBonus means "never downed," not "never downed and still
      // down."
      const perf = this.unitPerformance[unit.pilotId];
      if (perf) perf.wasDowned = true;

      const sameSide = this.units.filter((u) => u.side === unit.side);
      const check = evaluatePermadeathCheck(unit, sameSide);
      this.log.push(`Permadeath check — ${unit.displayName}: ${check.reason}`);
      if (check.permanent) {
        // The four "how was the company standing" facts, captured at the
        // only moment they are still knowable — see PermanentLossRecord's
        // own comment above for why these are stored rather than derived.
        // mission.outcome is deliberately NOT among them: it isn't decided
        // yet at a mid-mission downing, and Debrief already has it when it
        // applies this record (see scenes/Debrief.ts step 1b).
        this.permanentLosses.push({
          pilotId: unit.pilotId,
          reason: check.reason,
          turn: this.turn,
          turnsWithoutMunti: this.turn - (this.muntiCollapseTurn ?? this.turn),
          muntisDeployed: this.muntisDeployed,
          wasLastMunti: unit.path === "munti",
        });
      }
    }

    const fired = evaluateUnitDowned(this.mission.events, unit.instanceId, this.turn, this.eventState);
    for (const ev of fired) this.applyEventAction(ev.action);
  }

  /**
   * "Enemy ignore rescue" (30 Aug 2026 — see BattleUnit.isExtractionTarget's
   * own comment in units.ts for the full request/design). Called once from
   * the constructor, right after deployPlayerUnits, so it's set before a
   * single hostile turn ever runs. Single-named-pilot extract_unit missions
   * only (objectiveParams.extractUnitId) — Mission 31's civilianSpawns
   * shape deliberately does NOT get this, per Maxime's own earlier "real
   * stakes, the hostile AI targets them like anyone else" call on that
   * mission, so this bails out early exactly where checkExtraction's own
   * civilianSpawns branch does.
   *
   * Fallback pass, 31 Aug 2026 (Maxime: "you shouldnt make a single nsmed
   * chsracter the most important part of a mission. use a role. un case
   * the player doesnt bring those npc with him or they die. dont forget
   * other than the mc. no one is safe from perma death"). A real bug, not
   * just design taste: the named pilot in objectiveParams.extractUnitId
   * (e.g. pilot_orin, pilot_anand) can genuinely not be on the board —
   * left home by a real Transporter-pad squad selection, or permanently
   * lost to an earlier mission's own permadeath check (every pilot except
   * the exemptFromPermadeath commander can die for good; nothing in
   * mission data enforces that a named extraction target is even in the
   * eligible roster). Before this fix, `this.unitById(id)` came back
   * undefined in that case and the mission was mathematically unwinnable
   * — checkExtraction's own `if (!unit) return;` guard meant
   * extractedUnitId could never be set, so the ONLY way out was the
   * turnLimit loss branch, every single run, regardless of skill.
   *
   * Fixed at the role level, matching Maxime's own framing: if the named
   * pilot is actually deployed, nothing changes — they're still the
   * target, and still losing them mid-mission (unit.downed) is still a
   * real loss, same stakes as before. Only when nobody with that id is on
   * the board at all does the role transfer — to the first living player
   * unit in deploy order (deterministic, not random, so a given squad's
   * fallback target is always the same pilot from run to run). Every
   * downstream read (checkExtraction, checkWinLoss, Battle.ts's HUD line
   * and on-board green ring) goes through resolvedExtractUnitId /
   * unit.isExtractionTarget now, never the literal configured id again —
   * see those call sites' own comments.
   */
  private tagExtractionTarget(): void {
    if (this.mission.objective !== "extract_unit" || this.mission.civilianSpawns?.length) return;
    const id = this.mission.objectiveParams.extractUnitId;
    if (!id) return;
    const unit = this.unitById(id) ?? this.units.find((u) => u.side === "player" && !u.downed);
    if (unit) {
      unit.isExtractionTarget = true;
      this.resolvedExtractUnitId = unit.instanceId;
      // Readiness Plan §3.6, 1 Sep 2026 — the HUD's own "Extract: <name>"
      // line (Battle.ts drawHud) already reads resolvedExtractUnitId, so it
      // was never wrong. What WAS still wrong: every affected mission's
      // hand-authored briefing/dialogue text names the originally-configured
      // pilot regardless of who the role actually fell to, so a player who
      // left that pilot home (or lost them earlier to permadeath) got a
      // visible, unexplained mismatch between the briefing's name and the
      // HUD's. Rather than rewrite briefing prose across every affected
      // mission (House Amaranth 3/5/7/11/14/17, Warden's own
      // Anand/Iyari/Lask/Solheim/Okafor missions) — real authorial voice
      // work, not an engineering fix — this logs one plain, factual
      // acknowledgment the moment the fallback actually fires, so the
      // mismatch reads as an intentional in-fiction reassignment instead of
      // a bug. findPilot() is safe here specifically because every
      // extractUnitId target is a hand-authored named pilot, never a
      // runtime-generated recruit (see pilotRegistry.ts's own header on
      // that distinction) — the lookup can't silently miss the way a
      // recruit's would.
      if (unit.instanceId !== id) {
        const originalName = findPilot(id)?.displayName ?? id;
        this.log.push(`${originalName} wasn't in the field this run — the extraction falls to ${unit.displayName} instead.`);
      }
    }
  }

  /** Extraction objective: call when the extract-unit reaches an exit tile. */
  private checkExtraction(): void {
    if (this.mission.objective !== "extract_unit") return;
    const exits = this.map.exitTiles ?? [];
    // The Last Convoy shape (Mission 31, 25 Aug 2026) — every living,
    // not-yet-banked civilian gets checked independently; reaching an exit
    // banks that one civilian without touching whether the others still
    // can. See checkWinLoss below for the threshold this feeds.
    if (this.mission.civilianSpawns?.length) {
      for (const unit of this.livingUnits()) {
        if (!unit.isCivilian || this.extractedCivilianIds.has(unit.instanceId)) continue;
        if (exits.some((c) => coordsEqual(c, unit.pos))) {
          this.extractedCivilianIds.add(unit.instanceId);
          this.log.push(`${unit.displayName} reaches the extraction tile.`);
        }
      }
      return;
    }
    // Reads resolvedExtractUnitId (set once by tagExtractionTarget, see its
    // own comment) rather than re-deriving from the literal configured
    // objectiveParams.extractUnitId — that id can point at a pilot who was
    // never deployed this run, in which case the role already transferred
    // to whoever's actually on the board.
    const id = this.resolvedExtractUnitId;
    if (!id) return;
    const unit = this.unitById(id);
    if (!unit || unit.downed || this.extractedUnitId) return;
    if (exits.some((c) => coordsEqual(c, unit.pos))) {
      this.extractedUnitId = id;
      this.log.push(`${unit.displayName} reaches the extraction tile.`);
    }
  }

  /**
   * Mission 31's escort AI (25 Aug 2026) — moves every living civilian once
   * per full turn cycle. Called from runHostileTurn(), right after the
   * hostile units resolve and before the environment step, so civilians
   * react to whatever just happened that turn (same beat the environment
   * tick already runs on) rather than moving during the player's own turn,
   * which would read as things happening without player input mid-turn.
   */
  private runCivilianStep(): void {
    if (!this.mission.civilianSpawns?.length) return;
    for (const unit of this.livingUnits()) {
      if (!unit.isCivilian) continue;
      const decision = decideCivilianAction(this.map, unit, this.units);
      if (decision.path && decision.path.length > 1) this.moveCivilian(unit, decision.path);
    }
  }

  /**
   * A civilian's own movement choke point — deliberately NOT moveHostile.
   * That method also triggers overwatch/interdiction, both hostile-movement
   * reaction systems (a player's held overwatch is meant to fire on an
   * approaching hostile, not on a friendly civilian passing through the
   * same tiles) — see overwatch's own "refuses any non-player unit" note in
   * engine/units.ts. This is the same core operation (commit the position,
   * fire zone_entered events for the tiles walked through) with neither.
   */
  private moveCivilian(unit: BattleUnit, path: Coord[]): void {
    const dest = path[path.length - 1];
    unit.pos = dest;
    for (const step of path.slice(1)) {
      const fired = evaluateZoneEntered(this.mission.events, step, this.turn, this.eventState);
      for (const ev of fired) this.applyEventAction(ev.action);
    }
  }

  endPlayerTurn(): void {
    if (this.phase !== "player" || this.outcome !== "ongoing") return;
    this.checkExtraction();
    this.checkRescueExtraction();
    this.checkClearBloomPatchComplete();
    if (this.checkWinLoss()) return;
    // lastword_last_rites (Vault Phase 2, slice 5) — deliberately AFTER
    // every objective/win-loss check above, not before: a unit currently
    // acting on Last Rites' own borrowed action is, for this one moment,
    // genuinely alive and fighting, and any extraction/rescue/bonus
    // objective/win condition their action just completed should get to
    // count before this closes the window back out — "one final time...
    // before resolving" reads most generously as "before THIS turn's own
    // resolution," not "before anything they do can matter." See that
    // method's own comment for the rest of the reasoning, including why a
    // win/loss that ends the mission on this exact call skips this step
    // entirely (harmless — Debrief never reads live BattleUnit.downed).
    this.resolveLastRitesBorrowedTime();
    this.phase = "hostile";
    this.log.push(`--- Turn ${this.turn}: hostile phase ---`);
    this.runHostileTurn();
  }

  /** Runs the full AI turn for every hostile unit, then the environment step, then advances to the next player turn. */
  runHostileTurn(): void {
    for (const unit of this.units) {
      if (unit.downed || unit.side !== "hostile") continue;
      unit.actionsRemaining = MAX_ACTIONS_PER_TURN;
      unit.chargedThisMove = false;
      unit.tilesMovedThisTurn = 0;
    }

    for (const unit of this.livingUnits().filter((u) => u.side === "hostile")) {
      if (unit.downed) continue; // may have died mid-loop
      // Shock Claws' stun (engine/turnManager.ts's isStunned, 3 Sep 2026) —
      // a stunned unit skips its next action-taking opportunity entirely:
      // no movement decision, no attack, for exactly this one hostile
      // phase. Checked in the same place and the same way as the `downed`
      // guard right above (a per-unit skip inside this loop, not a
      // pre-filter on the list itself) so a unit that's ALSO stunned still
      // gets its actionsRemaining/chargedThisMove reset from the loop just
      // above this one — it's skipping its turn, not being removed from
      // the roster. The stun itself ages down and expires through the
      // ordinary tickStatusEffects() pass in environmentStep() later this
      // same hostile phase, same as every other status effect — there is
      // no separate stun-clearing step here.
      if (isStunned(unit)) {
        this.log.push(`${unit.displayName} is stunned and skips its turn.`);
        continue;
      }
      const decision = decideHostileAction(this.map, unit, this.units);
      if (decision.path && decision.path.length > 1) {
        this.moveHostile(unit, decision.path);
      }
      // Move-then-attack ordering, and the load-bearing half of overwatch
      // (see the overwatch block above): moveHostile() resolves every
      // triggered reaction shot BEFORE returning, so by this line a hostile
      // that was killed walking into an ambush is already `downed` and its
      // own attack never happens. That's the whole payoff of holding a
      // firing line — otherwise a mover would still get its hit in from
      // beyond the grave and overwatch would be pure damage rather than
      // prevention. attack() would refuse a downed attacker anyway; the
      // explicit check is here so the ordering is a stated rule rather than
      // an accident of another method's guard.
      if (decision.attackTargetId && !unit.downed) {
        this.attack(unit.instanceId, decision.attackTargetId);
      }
      if (this.outcome !== "ongoing") return;
    }

    this.runCivilianStep();
    this.checkExtraction();
    if (this.checkWinLoss()) return;

    this.environmentStep();
    if (this.checkWinLoss()) return;

    this.turn += 1;
    this.phase = "player";
    for (const unit of this.units) {
      if (unit.downed) continue;
      unit.actionsRemaining = MAX_ACTIONS_PER_TURN;
      unit.chargedThisMove = false;
      // Battery Frame / Fieldwright stationary heal — same fact as
      // actionsRemaining refreshing, kept in the same loop for the same
      // reason overwatch is. Note the ORDER against environmentStep() above:
      // that step (and tickStationaryRepair inside it) still sees the
      // player side's counts from the turn that just ended, which is
      // exactly the "did not move" the GDD's turn-start heal asks about.
      unit.tilesMovedThisTurn = 0;
      // Overwatch survives the whole hostile phase — that IS the mechanic —
      // and expires the moment its owner's next turn begins. Cleared in the
      // same loop that refreshes actionsRemaining, deliberately: the two are
      // the same fact ("this unit's turn has started, its held shot is
      // spent or wasted"), and splitting them is how they'd drift apart.
      unit.overwatch = false;
      // Ability-depth pass (23 Aug 2026) — the same fact, for the same
      // reason, for the two postures added alongside it: abil_ambush's and
      // abil_screen's concealment, and abil_interdict's brace, each last
      // exactly one full hostile phase and expire when their owner's next
      // turn begins. Cleared here rather than in four places so they cannot
      // drift apart from each other or from `overwatch`.
      //
      // `revealedUntilTurn` (abil_sensor_sweep) is deliberately NOT cleared
      // here: it's a deadline compared against Mission.turn, not a flag, so
      // a stale value is already inert everywhere it's read and zeroing it
      // would just be a second place the expiry rule lives.
      //
      // Stealth cloak redesign (30 Aug 2026) — abil_screen's concealment is
      // still exactly one hostile phase and still falls straight into the
      // unconditional clear below, untouched. abil_ambush's is now a
      // multi-round cloak (stealthTurnsRemaining, engine/units.ts): while it
      // is still counting down, `concealed` survives this loop instead of
      // being blanket-cleared — that survival IS the redesign. A unit with
      // no stealthTurnsRemaining set (screen-only, or no concealment at all)
      // takes the original path with no behavior change.
      if (unit.stealthTurnsRemaining !== undefined && unit.stealthTurnsRemaining > 0) {
        unit.stealthTurnsRemaining -= 1;
        if (unit.stealthTurnsRemaining <= 0) {
          unit.concealed = false;
          unit.stealthTurnsRemaining = undefined;
        }
      } else {
        unit.concealed = false;
      }
      unit.braced = false;
      // abil_taunt (25 Aug 2026) — same fact, same reason, same loop: the
      // redirect lasts exactly one hostile phase and expires when this
      // unit's own next turn begins.
      unit.taunting = false;
      // oath_iron_word (Vault Phase 2, slice 1, 2 Sep 2026) — cleared
      // unconditionally alongside `taunting` itself, so the radius gate can
      // never outlive (or expire before) the posture it gates. A plain
      // abil_taunt user never sets this, so this line is a no-op for them.
      unit.tauntRadius = undefined;
      // ledger_overextended (Vault Phase 2, slice 1, 2 Sep 2026) — same
      // stealthTurnsRemaining-shaped extension abil_ambush's cloak clock
      // uses just above: rank 1-4 clears unconditionally here, rank 5's
      // extra turn survives one more pass through this loop first.
      if (unit.overextendedTurnsRemaining !== undefined && unit.overextendedTurnsRemaining > 0) {
        unit.overextendedTurnsRemaining -= 1;
        if (unit.overextendedTurnsRemaining <= 0) {
          unit.overextended = false;
          unit.overextendedTurnsRemaining = undefined;
        }
      } else {
        unit.overextended = false;
      }
      // oath_oathkeeper (Vault Phase 2, slice 2, 3 Sep 2026) — same
      // decrement shape as overextendedTurnsRemaining just above: the
      // window survives exactly oathkeeperTurnsLeft passes through this
      // loop before closing. "All spared damage lands the instant it ends"
      // — the instant the countdown reaches 0, `oathkeeperActive` is
      // cleared FIRST, then the banked deferred pool (halved at rank 5) is
      // applied through the ordinary applyMechDamage() with the posture
      // already off, so a landing hit that empties it downs the unit
      // through the real handleDowned() path exactly like any other hit
      // that reaches 0 — no separate "deferred death" branch.
      if (unit.oathkeeperActive && unit.oathkeeperTurnsLeft !== undefined) {
        unit.oathkeeperTurnsLeft -= 1;
        if (unit.oathkeeperTurnsLeft <= 0) {
          unit.oathkeeperActive = false;
          unit.oathkeeperTurnsLeft = undefined;
          const deferred = unit.oathkeeperDeferredDamage ?? 0;
          unit.oathkeeperDeferredDamage = 0;
          if (deferred > 0) {
            const rank5 = this.heirloomRank(unit, "oath_oathkeeper") >= 5;
            const landing = rank5 ? Math.round(deferred * OATHKEEPER_RANK5_DEFERRED_MULTIPLIER) : deferred;
            if (landing > 0) {
              applyMechDamage(unit, landing);
              this.log.push(`${unit.displayName}'s Iron Oath ends — ${landing} deferred damage lands.`);
              if (unit.downed) this.handleDowned(unit);
            }
          }
        }
      }
      // cutting_room_momentum (Zanretsu, Vault Phase 2 slice 4, 3 Sep 2026)
      // — "+2 move on the turn immediately following any Zanretsu use."
      // This IS "the turn immediately following": this loop runs exactly
      // once per round, right as a player unit's own next turn begins,
      // same choke point overextended/oathkeeperActive/etc. already use
      // above. Two steps, in order: first, revert whatever bonus a
      // PREVIOUS Momentum window granted — it was scoped to exactly the
      // round that just ended (one pass through this loop, same "survives
      // through the intervening hostile phase, clears when your own next
      // turn begins" reading `overextended` itself uses), so it comes off
      // here before anything new is considered. Then, if
      // cuttingRoomCharge() left a fresh grant pending, apply it for the
      // round now starting and clear the pending flag. See
      // BattleUnit.momentumMoveBonusActive's own comment for why the move
      // half is a direct, exactly-reverted stat add while the ATK half
      // (momentumAtkBoostActive, read by combat.ts's
      // momentumAttackMultiplier) is a plain live-read boolean instead.
      if (unit.momentumMoveBonusActive) {
        unit.moveRange -= unit.momentumMoveBonusActive;
        unit.momentumMoveBonusActive = undefined;
      }
      unit.momentumAtkBoostActive = false;
      if (unit.momentumPending) {
        unit.momentumPending = false;
        unit.moveRange += CUTTING_ROOM_MOMENTUM_MOVE_BONUS;
        unit.momentumMoveBonusActive = CUTTING_ROOM_MOMENTUM_MOVE_BONUS;
        if (this.heirloomRank(unit, "cutting_room_momentum") >= 5) {
          unit.momentumAtkBoostActive = true;
        }
        this.log.push(`${unit.displayName} carries Momentum into this turn — +${CUTTING_ROOM_MOMENTUM_MOVE_BONUS} move.`);
      }
      // cutting_room_sure_footing (Zanretsu, Vault Phase 2 slice 4) — same
      // TurnsRemaining-shaped decrement as overextendedTurnsRemaining/
      // oathkeeperTurnsLeft above: the window survives exactly
      // sureFootingTurnsLeft passes through this loop before closing.
      if (unit.sureFootingTurnsLeft !== undefined && unit.sureFootingTurnsLeft > 0) {
        unit.sureFootingTurnsLeft -= 1;
        if (unit.sureFootingTurnsLeft <= 0) {
          unit.sureFootingActive = false;
          unit.sureFootingTurnsLeft = undefined;
        }
      } else {
        unit.sureFootingActive = false;
      }
      // seal_ledgerhall_static (Simulacrum/The Stolen Seal, Vault Phase 2
      // slice 6) — same TurnsRemaining-shaped decrement as
      // sureFootingTurnsLeft just above. This loop already runs over EVERY
      // unit, both sides (no side filter anywhere in this loop), which
      // matters here specifically: Ledgerhall Static jams a HOSTILE, unlike
      // every other timed status this loop clears, which are all
      // player-side postures.
      if (unit.jammedAbilityTurnsRemaining !== undefined && unit.jammedAbilityTurnsRemaining > 0) {
        unit.jammedAbilityTurnsRemaining -= 1;
        if (unit.jammedAbilityTurnsRemaining <= 0) {
          unit.jammedAbilityId = undefined;
          unit.jammedAbilityTurnsRemaining = undefined;
        }
      }
    }
    this.log.push(`--- Turn ${this.turn}: player phase ---`);
    // Stalled-eliminate_all nudge — see turnsWithoutContact's own comment.
    // Only tracked for eliminate_all (the objective the Playtest Review
    // actually hit this on — no proactive hunt, no turn limit, so it's the
    // one shape that can genuinely go quiet forever); every other
    // objective already has its own clock or convergence behavior.
    if (this.mission.objective === "eliminate_all") {
      this.turnsWithoutContact += 1;
      if (this.turnsWithoutContact === STALL_NUDGE_TURN_THRESHOLD && !this.stallNudgeShown) {
        this.stallNudgeShown = true;
        this.log.push("Command: no contact reported in some time — sweep wider, the Bloom doesn't always come to you.");
      }
    }
    this.runTurnStartEvents();
    this.checkWinLoss();
  }

  private environmentStep(): void {
    this.tickShieldRegen();
    this.tickMuntiRegen();
    this.tickStationaryRepair();
    for (const unit of this.livingUnits()) {
      const tile: TileType = tileAt(this.map, unit.pos);
      const def = TILES[tile];
      // Sealed Cockpit (Frame Systems Layer, 6 Sep 2026) — "immune to
      // bloom-mat acid." Skips the tile's own turnStartDamage outright for
      // a mech carrying it; a Bloom never carries systems, so the Bloom
      // branch is untouched. The only tile with turnStartDamage today IS
      // bloom_mat, so this reads as the system's own description without
      // a tile-id check that would silently exempt some future hazard too.
      if (def.turnStartDamage && !(unit.kind !== "bloom" && immuneToMatAcid(unit))) {
        if (unit.kind === "bloom") applyBloomDamage(unit, def.turnStartDamage);
        else {
          applyMechDamage(unit, def.turnStartDamage);
          this.creditDamageTaken(unit.pilotId, def.turnStartDamage);
        }
        if (unit.downed) this.handleDowned(unit);
      }
      if (def.turnStartRepair && !unit.downed && unit.kind !== "bloom") {
        unit.currentHp = Math.min(unit.maxHp, unit.currentHp + def.turnStartRepair);
      }
      // Wellroot Filament (salvage, same pass) — regen while standing on
      // bloom mat, applied AFTER the acid above so the net on an acid tile
      // is the +3 data/frameSystems.ts describes (or the full +8 alongside
      // Sealed Cockpit). Ordinary "capped at maxHp" regen, no side effects.
      if (tile === "bloom_mat" && !unit.downed && unit.kind !== "bloom") {
        const regen = matRegenFor(unit);
        if (regen > 0) unit.currentHp = Math.min(unit.maxHp, unit.currentHp + regen);
      }
      // Bloom on-hit effects engine (engine/turnManager.ts, 27 Aug 2026) —
      // acid_dot's per-turn tick, same once-per-cycle cadence as the tile
      // turnStartDamage right above it. tickStatusEffects() always runs
      // (it also ages/expires debuff_attack, which has no HP cost but
      // still needs its duration ticked down every cycle, even on a unit
      // already downed this iteration — some missions allow a downed unit
      // to be revived/rescued, and a stale effect should still expire on
      // schedule rather than outlive it). The damage it returns is only
      // APPLIED if the unit wasn't already downed by the tile-damage block
      // above: handleDowned() is a one-time, non-idempotent side effect
      // (commander-down check, rescue-fail check, permadeath roll, log
      // line) and must never fire twice for the same downing event.
      const dotDamage = tickStatusEffects(unit);
      if (dotDamage && !unit.downed) {
        if (unit.kind === "bloom") applyBloomDamage(unit, dotDamage);
        else {
          applyMechDamage(unit, dotDamage);
          this.creditDamageTaken(unit.pilotId, dotDamage);
        }
        if (unit.downed) this.handleDowned(unit);
      }
    }
    // Runs after the per-unit tile-damage loop above, deliberately: this
    // turn's turnStartDamage already resolved against the board as it stood
    // when the turn started, so a tile tickBloomRegrowth converts to
    // bloom_mat here doesn't retroactively burn anyone standing on it —
    // that starts next turn.
    this.tickBloomRegrowth();
    this.tickAssetDamage();
    // cinder_line_signature (Vault Phase 2, slice 3, 3 Sep 2026) — same
    // once-per-cycle position as the two calls right above: independent of
    // both (Surtr lines are never bloom_mat, never asset-defend zones), so
    // ordering against them doesn't matter; kept last only because it's the
    // newest of the three.
    this.tickSurtrLines();
  }

  /**
   * One environment-step tick for every currently-active Surtr line: every
   * living unit standing on one of its tiles right now takes
   * `damagePerTurn` — hostile OR friendly, no exception on the tiles
   * themselves (data/heirlooms.ts's own hard rule, §1d, explicitly carves
   * this kit out) — UNLESS that unit's side matches the line's own
   * ownerSide AND the line's cinder_draft window is currently open
   * (friendlyImmuneTurnsRemaining > 0), the one carve-out Draft exists to
   * grant. Flat damage, no defense/cover mitigation and no shield
   * interaction check — mirrors bloom_mat's own TileDef.turnStartDamage
   * application right above in this same method exactly (applyMechDamage/
   * applyBloomDamage + creditDamageTaken + handleDowned, nothing routed
   * through resolveMechAttack/resolveAttackOnBloom), since this IS the same
   * kind of hazard, just tracked separately — see the SurtrLine interface's
   * own header comment for why. Deliberately does NOT call
   * recordContribution/resolveKill for a unit this kills: environmental
   * hazard damage isn't attributed to the wielder's own kill count any more
   * than walking into bloom_mat is attributed to whoever converted that
   * tile — ledger_entry's own stacking (killsThisMissionFor) would be a
   * strange thing for a hazard tile to feed just because Surtr happens to
   * also carry ledger_entry-style abilities on some other Heirloom.
   *
   * Damage is applied for every unit on every active line FIRST, then every
   * line's own clocks (turnsRemaining, friendlyImmuneTurnsRemaining) are
   * decremented in a second pass — so a line entering its LAST tick still
   * deals that tick's damage before being dropped (turnsRemaining=3 at cast
   * means exactly 3 damage events, not 2), matching how bloom_mat's own
   * turnStartDamage/tickBloomRegrowth split is already ordered by comment
   * right above this method.
   */
  private tickSurtrLines(): void {
    if (this.activeSurtrLines.length === 0) return;
    for (const line of this.activeSurtrLines) {
      const tileSet = new Set(line.tiles.map(coordKey));
      for (const unit of this.livingUnits()) {
        if (!tileSet.has(coordKey(unit.pos))) continue;
        const friendlyToLine = unit.side === line.ownerSide;
        if (friendlyToLine && line.friendlyImmuneTurnsRemaining > 0) continue;
        if (unit.kind === "bloom") applyBloomDamage(unit, line.damagePerTurn);
        else {
          applyMechDamage(unit, line.damagePerTurn);
          this.creditDamageTaken(unit.pilotId, line.damagePerTurn);
        }
        if (unit.downed) this.handleDowned(unit);
      }
    }
    for (const line of this.activeSurtrLines) {
      line.turnsRemaining -= 1;
      if (line.friendlyImmuneTurnsRemaining > 0) line.friendlyImmuneTurnsRemaining -= 1;
    }
    const stillBurning = this.activeSurtrLines.filter((l) => l.turnsRemaining > 0);
    if (stillBurning.length !== this.activeSurtrLines.length) {
      this.log.push("A Surtr line burns itself out.");
    }
    this.activeSurtrLines = stillBurning;
  }

  // ---- Vault Phase 2, slice 4 (3 Sep 2026) — Zanretsu's full 3-ability
  // kit: cutting_room_charge, cutting_room_momentum, cutting_room_sure_footing
  // (Vann Rethwick, House Rethwick, centauroid chassis, Meeps path). See
  // data/heirlooms.ts's own "cutting_room" entry, CUTTING_ROOM_CHARGE_DIRECTIONS'
  // own header comment above (why cardinal-only, not Cinder Line's 8-way
  // set), and data/combatTables.ts's own "Vault Phase 2, slice 4" header for
  // which numbers are explicit vs. placeholder. Same canX()/getX()/verb()
  // shape every ability above follows.

  canCuttingRoomCharge(unitId: string): boolean {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed) return false;
    if (unit.side !== "player") return false;
    if (!unit.abilities.includes("cutting_room_charge")) return false;
    if (!isCooldownReady(this.cooldownReadyTurn(unit, "cutting_room_charge"), this.turn)) return false;
    return unit.actionsRemaining > 0;
  }

  /**
   * Every tile a cutting_room_charge cast could END at — one entry per
   * (direction, step) pair, CUTTING_ROOM_CHARGE_DIRECTIONS x
   * 1..CUTTING_ROOM_CHARGE_MAX_LINE_TILES, clipped at the board edge OR at
   * the first impassable tile in that direction, whichever comes first.
   * That passability break is the one real difference from
   * getCinderLineAreaFrom's identical-looking loop: Cinder Line places a
   * hazard (nothing stops fire from igniting a tile behind a wall), this
   * ability physically MOVES the wielder through the tiles it selects, so a
   * genuinely impassable tile (a wall, water this chassis can't cross) has
   * to actually block the line — "ignoring terrain cost" waives the COST of
   * crossing difficult ground, not whether the ground can be crossed at
   * all. Same CLICK TARGET SET contract as getCinderLineAreaFrom otherwise:
   * clicking any one of these tiles resolves the whole run from the
   * wielder's adjacent tile out to the clicked one, not just that one tile
   * — see previewCuttingRoomChargeFrom below for the UI preview of exactly
   * which tiles that is.
   */
  getCuttingRoomChargeAreaFrom(unitId: string, from: Coord): Coord[] {
    if (!this.canCuttingRoomCharge(unitId)) return [];
    const unit = this.unitById(unitId)!;
    const kind = this.movementKindFor(unit);
    const tiles: Coord[] = [];
    for (const dir of CUTTING_ROOM_CHARGE_DIRECTIONS) {
      for (let step = 1; step <= CUTTING_ROOM_CHARGE_MAX_LINE_TILES; step++) {
        const c = { x: from.x + dir.x * step, y: from.y + dir.y * step };
        if (!inBounds(this.map, c)) break;
        if (!isPassable(this.map, c, kind)) break;
        tiles.push(c);
      }
    }
    return tiles;
  }

  /**
   * The actual tile run a click on `target` would charge through: `unit.pos`'s
   * adjacent tile in `target`'s direction, out to `target` itself inclusive
   * — null if `target` isn't a legal line endpoint (not a straight CARDINAL
   * run — see CUTTING_ROOM_CHARGE_DIRECTIONS' own header comment for why
   * this is cardinal-only where cinderLineTilesTo allows diagonals — beyond
   * CUTTING_ROOM_CHARGE_MAX_LINE_TILES, or crossing a tile impassable to
   * this unit's own movement kind). Deliberately does NOT check tile
   * OCCUPANCY the way a normal move's reachableTiles does — striking
   * through a tile an enemy is standing on is the entire point of this
   * ability, not something to route around. Pure/read-only, shared by
   * cuttingRoomCharge() (which calls this then commits the result) and
   * previewCuttingRoomChargeFrom() (which just returns it for a UI
   * preview) — mirrors cinderLineTilesTo's identical split.
   */
  private cuttingRoomChargeLineTo(unit: BattleUnit, target: Coord): Coord[] | null {
    const from = unit.pos;
    const ddx = target.x - from.x;
    const ddy = target.y - from.y;
    if (ddx === 0 && ddy === 0) return null;
    if (ddx !== 0 && ddy !== 0) return null; // cardinal only — see CUTTING_ROOM_CHARGE_DIRECTIONS' header
    const steps = Math.max(Math.abs(ddx), Math.abs(ddy));
    if (steps > CUTTING_ROOM_CHARGE_MAX_LINE_TILES) return null;
    const dirX = Math.sign(ddx);
    const dirY = Math.sign(ddy);
    const kind = this.movementKindFor(unit);
    const tiles: Coord[] = [];
    for (let s = 1; s <= steps; s++) {
      const c = { x: from.x + dirX * s, y: from.y + dirY * s };
      if (!inBounds(this.map, c)) return null;
      if (!isPassable(this.map, c, kind)) return null;
      tiles.push(c);
    }
    return tiles;
  }

  /** UI preview for an armed cutting_room_charge: the tiles a click on `target` would actually charge through, or null if that click wouldn't be a legal line. Returns null outright if the ability isn't currently usable at all, same "ask the engine, never guess" contract previewCinderLineFrom already follows. */
  previewCuttingRoomChargeFrom(unitId: string, target: Coord): Coord[] | null {
    if (!this.canCuttingRoomCharge(unitId)) return null;
    const unit = this.unitById(unitId)!;
    return this.cuttingRoomChargeLineTo(unit, target);
  }

  /**
   * Shared by cuttingRoomCharge()'s two "where does the wielder end up"
   * cases (hit at least one enemy vs. hit none) — see that method's own
   * header comment for the two readings this implements. Scans `tiles`
   * BACKWARD from index `upTo - 1` down to 0, returning the first tile NOT
   * currently occupied by any other living unit; falls all the way back to
   * `unit.pos` itself (no movement at all) if every candidate is occupied.
   *
   * That fallback is a genuinely rare edge case with no spec to point to —
   * it needs the entire approach to the last enemy hit (or, in the
   * zero-hit case, the whole chosen line) packed solid with other un-downed
   * units — but it IS reachable (a second enemy standing exactly one tile
   * short of the last one hit, or a friendly unit parked on the line), so
   * it gets a real, deliberate answer rather than an unhandled crash or a
   * silent double-occupy: not moving at all is the one option guaranteed
   * never to put two units on the same tile.
   */
  private cuttingRoomChargeLandingTile(unit: BattleUnit, tiles: Coord[], upTo: number): Coord {
    const occupied = this.occupiedSet(unit.instanceId);
    for (let i = upTo - 1; i >= 0; i--) {
      if (!occupied.has(coordKey(tiles[i]))) return tiles[i];
    }
    return unit.pos;
  }

  /**
   * cutting_room_charge (Zanretsu/The Cutting Room) — "Move through and
   * strike every enemy in a straight line, ignoring terrain cost, ending
   * adjacent to the last one hit. Full commitment — cannot be called off
   * partway through. Damage falls off against the 3rd+ target hit." Rank 5:
   * "Damage no longer drops off against the 3rd+ target in the line."
   *
   * This is the one genuinely new resolution shape in this file: no
   * existing ability both MOVES the wielder AND strikes multiple targets in
   * one action. Every individual piece reuses existing machinery on
   * purpose (per-victim damage through resolveMechAttack/
   * resolveAttackOnBloom — the exact formula a normal hit uses, same as
   * missileStrike's own per-victim loop above; recordPerformance for
   * kill/assist/damage credit; evaluateZoneEntered for the tiles actually
   * walked, the same bookkeeping moveUnit()'s own tail fires) — what's new
   * is only the LOOP that ties them together, not the underlying math.
   *
   * Design calls this method's own prose leaves genuinely open, each
   * decided and flagged here rather than guessed silently:
   *
   * WHICH TILES COUNT AS "IN THE LINE": the simplest, most literal reading
   * of "strike every enemy in a straight line" — every living hostile unit
   * whose OWN tile is one of the line's tiles (cuttingRoomChargeLineTo's
   * result, wielder's adjacent tile outward to the clicked endpoint
   * inclusive), in near-to-far order. NOT "adjacent to the line" — the
   * prose says "in" it, and the wielder is meant to be physically crossing
   * these exact tiles, not sweeping a radius around them the way Fire
   * Support/Missile do.
   *
   * DODGE AND COUNTER: rolled and honored normally, per victim (rollMeepsDodge
   * both directions, exactly resolveAttack()'s own primary-hit shape) —
   * deliberately NOT deadfall_strike's "unavoidable, uncounterable" bypass,
   * since cutting_room_charge's own prose never claims either of those
   * properties the way Ichigeki's explicitly does. A real consequence
   * worth being explicit about, mirroring missileStrike's own documented
   * one: resolveMechAttack scales damage by attacker.currentHp/maxHp, so a
   * counter that downs the wielder mid-charge makes every target resolved
   * after it take zero — the formula already handles "the charger got
   * cut down mid-run" without any extra guard here, same as missileStrike.
   * Charging into a line of enemies carrying real return-fire risk reads as
   * the right in-fiction consequence for "full commitment," not a bug to
   * paper over.
   *
   * THE CENTAUROID CHARGE MULTIPLIER (CENTAUROID_CHARGE_MULT,
   * combat.ts/turnManager.ts's own `charged` param) is deliberately NOT
   * applied here, even though this pilot's own chassis is centauroid and
   * this ability is thematically that exact mechanic. Passing `charged:
   * true` into every resolveMechAttack call would silently stack an
   * un-costed bonus on top of numbers this ability's own rank text already
   * fully describes — a player reading "damage falls off against the 3rd+
   * target" has no way to know a second, unrelated multiplier is also in
   * play. Kept out for predictability; trivial to add back in one place if
   * that's ever the wrong call.
   *
   * ENDING POSITION: "ending adjacent to the last one hit" — the tile in
   * the line immediately BEFORE (one step closer to the wielder's own
   * start than) the last enemy actually hit, found via
   * cuttingRoomChargeLandingTile's backward-occupancy scan (so a unit
   * standing exactly there doesn't get silently double-occupied). If the
   * very first tile out from the wielder is where the last (only) enemy
   * hit stands, that "one step before" tile IS the wielder's own starting
   * tile — the wielder simply doesn't move, which is the correct reading
   * of "adjacent to" a target one tile away to begin with.
   *
   * ZERO ENEMIES HIT: no spec exists for this ("full commitment... cannot
   * be called off partway through" implies the player commits before
   * knowing the outcome, the same reasoning cinder_line_signature's own
   * header comment already establishes for a placed-but-wasted line) — read
   * here as "the charge still happens as a MOVE," landing as far up the
   * chosen line as the wielder can legally stand: cuttingRoomChargeLandingTile
   * scanning backward from the line's own far end. This still ignores
   * terrain cost/moveRange (the whole line, up to
   * CUTTING_ROOM_CHARGE_MAX_LINE_TILES, was already validated as passable
   * by cuttingRoomChargeLineTo) — a whiffed charge still ends with the
   * wielder somewhere useful, not stranded at its own starting tile for no
   * reason, matching "moves the full line length, or as far as the line's
   * own tiles allow" per this pass's own brief.
   *
   * MAX LINE LENGTH IS NOT unit.moveRange: this is a fixed constant
   * (CUTTING_ROOM_CHARGE_MAX_LINE_TILES, data/combatTables.ts), completely
   * independent of the wielder's own current move stat — see that
   * constant's own comment for why coupling it to moveRange would create
   * an unwanted feedback loop with cutting_room_momentum's own +2 move
   * grant (each Momentum-boosted round making the NEXT charge reach
   * farther, compounding in a way neither ability's own prose describes).
   *
   * Costs the unit's entire remaining action budget and ends the turn
   * ("full commitment — cannot be called off partway through" reads as
   * this session's own established "high-impact single-use ability ends
   * the turn" convention, same tier as cinder_line_signature/deadfall_strike
   * above). Always triggers cutting_room_momentum on resolution — see
   * BattleUnit.momentumPending's own comment — regardless of how many
   * enemies were actually hit, including zero: "any Zanretsu use" per that
   * ability's own prose, no hit-count qualifier.
   */
  cuttingRoomCharge(unitId: string, target: Coord): boolean {
    if (!this.canCuttingRoomCharge(unitId)) return false;
    const unit = this.unitById(unitId)!;
    const tiles = this.cuttingRoomChargeLineTo(unit, target);
    if (!tiles) return false;

    const rank5 = this.heirloomRank(unit, "cutting_room_charge") >= 5;
    const sameSideAsAttacker = this.units.filter((u) => u.side === unit.side);

    const hits: { index: number; victim: BattleUnit }[] = [];
    tiles.forEach((c, index) => {
      const victim = this.livingUnits().find((u) => u.side !== unit.side && coordsEqual(u.pos, c));
      if (victim) hits.push({ index, victim });
    });

    const killedIds: string[] = [];
    hits.forEach(({ victim }, hitOrder) => {
      const sameSideAsVictim = this.units.filter((u) => u.side === victim.side);
      const falloff = !rank5 && hitOrder >= 2 ? CUTTING_ROOM_CHARGE_FALLOFF_MULTIPLIER : 1;
      let outcome: AttackOutcome;
      if (victim.kind !== "bloom") {
        const victimDodged = rollMeepsDodge(victim, unit, this.rng);
        const attackerDodgedCounter = rollMeepsDodge(unit, victim, this.rng);
        const r = resolveMechAttack(this.map, unit, victim, sameSideAsVictim, sameSideAsAttacker, false, victimDodged, attackerDodgedCounter, {
          attackerKillsThisMission: this.killsThisMissionFor(unit),
          defenderKillsThisMission: this.killsThisMissionFor(victim),
        });
        const dealt = Math.round(r.damage * falloff);
        applyMechDamage(victim, dealt);
        if (r.countered && r.counterDamage !== undefined) applyMechDamage(unit, r.counterDamage);
        outcome = {
          attackerId: unit.instanceId,
          defenderId: victim.instanceId,
          damage: dealt,
          countered: r.countered,
          counterDamage: r.counterDamage,
          defenderDowned: victim.downed,
          attackerDowned: unit.downed,
          defenderDodged: r.dodged,
          counterDodged: r.counterDodged,
        };
      } else {
        const r = resolveAttackOnBloom(this.map, unit, victim, sameSideAsVictim, false, {
          attackerKillsThisMission: this.killsThisMissionFor(unit),
        });
        const dealt = Math.round(r.damage * falloff);
        applyBloomDamage(victim, dealt);
        outcome = { attackerId: unit.instanceId, defenderId: victim.instanceId, damage: dealt, countered: false, defenderDowned: victim.downed };
      }
      this.recordPerformance(unit, victim, outcome);
      if (outcome.defenderDowned) killedIds.push(victim.instanceId);
    });

    const landingUpTo = hits.length > 0 ? hits[hits.length - 1].index : tiles.length;
    const landingTile = this.cuttingRoomChargeLandingTile(unit, tiles, landingUpTo);
    const landingIndex = tiles.findIndex((c) => coordsEqual(c, landingTile));
    const walkedPath = landingIndex >= 0 ? tiles.slice(0, landingIndex + 1) : [];
    unit.pos = landingTile;
    // Same tail moveUnit() itself fires for every tile actually stepped
    // through — zone_entered events, the one piece of "normal movement
    // bookkeeping" this ability can't skip even though it skips terrain
    // COST. Not a call into moveUnit() itself: that method's own
    // reachableTiles/budget semantics don't fit an ability that ignores
    // both moveRange and terrain cost, so this replicates its event-firing
    // tail directly rather than fighting its pathfinding to reuse it.
    for (const step of walkedPath) {
      const fired = evaluateZoneEntered(this.mission.events, step, this.turn, this.eventState);
      for (const ev of fired) this.applyEventAction(ev.action);
    }

    for (const { victim } of hits) if (victim.downed) this.handleDowned(victim);
    if (unit.downed) this.handleDowned(unit);

    unit.actionsRemaining = 0;
    unit.concealed = false; // firing/striking gives your position away, same as any other attack in this file
    unit.abilityCooldowns = unit.abilityCooldowns ?? {};
    unit.abilityCooldowns["cutting_room_charge"] = startCooldown(this.turn, CUTTING_ROOM_CHARGE_COOLDOWN_TURNS);
    unit.momentumPending = true; // cutting_room_momentum — always triggers, hit or whiff, see this method's own header
    this.noteAbilityUse(unit, "cutting_room_charge");
    this.log.push(
      hits.length > 0
        ? `${unit.displayName} charges the line — ${hits.length} hit, ${killedIds.length} downed.`
        : `${unit.displayName} charges the line — nothing there to hit.`
    );
    return true;
  }

  canCuttingRoomSureFooting(unitId: string): boolean {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed) return false;
    if (unit.side !== "player") return false;
    if (!unit.abilities.includes("cutting_room_sure_footing")) return false;
    if (!isCooldownReady(this.cooldownReadyTurn(unit, "cutting_room_sure_footing"), this.turn)) return false;
    return unit.actionsRemaining > 0;
  }

  /**
   * cutting_room_sure_footing (Sure Footing) — "Immune to knockback and
   * forced movement for 1 turn." Rank 5: "Duration 2 turns." Self-triggered
   * defensive window, same shape as oathkeeper()/draft() above: costs 1
   * action, does NOT end the turn (a quick posture, not a battlefield-
   * shaping commitment the way cuttingRoomCharge() above is priced).
   * BattleUnit.sureFootingActive is read live by
   * engine/turnManager.ts's isKnockbackImmune; sureFootingTurnsLeft ages
   * down in the same start-of-own-next-turn reset loop every other timed
   * posture in this file already uses (see that loop's own comment for
   * this ability's block).
   */
  cuttingRoomSureFooting(unitId: string): boolean {
    if (!this.canCuttingRoomSureFooting(unitId)) return false;
    const unit = this.unitById(unitId)!;
    const rank5 = this.heirloomRank(unit, "cutting_room_sure_footing") >= 5;
    const duration = rank5 ? CUTTING_ROOM_SURE_FOOTING_RANK5_DURATION_TURNS : CUTTING_ROOM_SURE_FOOTING_DURATION_TURNS;
    unit.sureFootingActive = true;
    unit.sureFootingTurnsLeft = duration;
    unit.actionsRemaining -= 1;
    unit.abilityCooldowns = unit.abilityCooldowns ?? {};
    unit.abilityCooldowns["cutting_room_sure_footing"] = startCooldown(this.turn, CUTTING_ROOM_SURE_FOOTING_COOLDOWN_TURNS);
    this.noteAbilityUse(unit, "cutting_room_sure_footing");
    this.log.push(`${unit.displayName} plants Sure Footing — immune to knockback for ${duration} turn(s).`);
    return true;
  }

  // ---- Vault Phase 2, slice 5 (3 Sep 2026) — Migawari's remaining 2 of 3
  // abilities: lastword_signature, lastword_last_rites (Osric Ferrow, House
  // Ferrow, Munti path). See data/heirlooms.ts's own "last_word" entry for
  // the full rank1/rank5 prose. lastword_field_triage (already live since
  // slice 1) is untouched — see fieldTriage()/getFieldTriageTargetsFrom
  // above.

  /**
   * Shared by getLastWordSignatureTargetsFrom and getLastRitesTargetsFrom:
   * a downed pilot this SAME mission's own live permadeath check
   * (evaluatePermadeathCheck, run inside handleDowned at the instant of
   * THEIR OWN downing) already ruled un-restockable. Both of Migawari's
   * revival-shaped abilities need this same "restockable casualty, not a
   * corpse" gate — their own prose both say so explicitly ("not yet lost to
   * permadeath" on Last Rites; the signature's own silence on it is read as
   * the same rule, since reviving a pilot this campaign has already written
   * off as permanently gone would contradict what "permanent" means
   * everywhere else in this file).
   */
  private isPermanentlyLost(pilotId: string): boolean {
    return this.permanentLosses.some((l) => l.pilotId === pilotId);
  }

  canLastWordSignature(unitId: string): boolean {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed) return false;
    if (unit.side !== "player") return false;
    if (!unit.abilities.includes("lastword_signature")) return false;
    if (!isCooldownReady(this.cooldownReadyTurn(unit, "lastword_signature"), this.turn)) return false;
    return unit.actionsRemaining > 0;
  }

  /**
   * Every currently-downed ally lastword_signature could revive. No radius
   * filter — the prose states "one downed ally mid-mission" with no range
   * clause at all, same "any range" reading deadfall_strike's own
   * getDeadfallStrikeTargetsFrom (above) already established for a
   * signature ability whose text gives no stated reach. Restricted to
   * `!this.isPermanentlyLost(...)` — see that method's own comment — so
   * this never offers a pilot the campaign has already written off. Empty
   * whenever canLastWordSignature is false, same "ask the engine, never
   * guess" contract every other getXTargetsFrom method in this file
   * follows.
   */
  getLastWordSignatureTargetsFrom(unitId: string): BattleUnit[] {
    if (!this.canLastWordSignature(unitId)) return [];
    const unit = this.unitById(unitId)!;
    return this.units.filter((u) => u.side === unit.side && u.downed && !!u.pilotId && !this.isPermanentlyLost(u.pilotId!));
  }

  /**
   * lastword_signature (Migawari/The Last Word) — "Fully restores one
   * downed ally mid-mission, no spare part spent. The wielder's own max HP
   * is permanently reduced 10% for the rest of the campaign, each use."
   * Rank 5: "The permanent cost drops to 5% per use — never removed
   * entirely, only softened."
   *
   * THE RETROACTIVE-APPLICATION CALL, made deliberately and read carefully
   * before touching this method: the wielder's own max HP shrinks THIS
   * INSTANT, not deferred to their next deployment. "Permanently reduced...
   * for the rest of the campaign" is read as starting the moment the cost
   * is paid, and the remainder of THIS mission is part of "the rest of the
   * campaign" the same as every future one — there's no textual support
   * for a grace period where the cost is real but hasn't applied yet.
   * `wielder.currentHp` is clamped down to the new, smaller `maxHp` if it
   * would otherwise exceed it (a wielder at or near full health when they
   * pay this cost cannot walk away with currentHp > maxHp, which nothing
   * else in this file's damage/heal paths ever has to guard against) — but
   * is never healed or otherwise changed beyond that clamp; a wielder
   * already below the new cap keeps whatever HP they actually have, dented
   * exactly as much as before.
   *
   * "Fully restores" is read as matching what a normal restock leaves a
   * unit with — currentHp === maxHp, downed === false — since going down
   * never touches anything else about a unit's stats/position, there is
   * nothing else to reset. "No spare part spent" needs no code of its own:
   * this method never calls anything that touches MekArchetype.spareParts
   * (that only happens in campaignEconomy.ts's purchaseSpareParts, an
   * unrelated shop flow), so simply not doing that IS the whole
   * implementation of that clause.
   *
   * The SAME hpMultiplier is also recorded into this.signatureHpCosts for
   * engine/campaignState.ts's applyLastWordSignatureCosts to land
   * permanently on the wielder's own PilotRecord at Debrief — see that
   * function's own comment, and LastWordSignatureCostRecord's, for why
   * Mission can't write CampaignState directly and has to hand this off.
   *
   * Costs 1 action, does not end the turn — same tier as Field Triage
   * (fieldTriage() above), the closest existing precedent for a support
   * ability rather than an attack.
   */
  lastWordSignature(unitId: string, targetId: string): boolean {
    if (!this.canLastWordSignature(unitId)) return false;
    const wielder = this.unitById(unitId)!;
    const target = this.getLastWordSignatureTargetsFrom(unitId).find((t) => t.instanceId === targetId);
    if (!target) return false;

    target.currentHp = target.maxHp;
    target.downed = false;

    const rank5 = this.heirloomRank(wielder, "lastword_signature") >= 5;
    const hpMultiplier = rank5 ? LAST_WORD_SIGNATURE_HP_MULTIPLIER_RANK5 : LAST_WORD_SIGNATURE_HP_MULTIPLIER_RANK1;
    wielder.maxHp = Math.round(wielder.maxHp * hpMultiplier);
    wielder.currentHp = Math.min(wielder.currentHp, wielder.maxHp);
    if (wielder.pilotId) {
      this.signatureHpCosts.push({ pilotId: wielder.pilotId, hpMultiplier, turn: this.turn });
    }

    wielder.actionsRemaining -= 1;
    wielder.abilityCooldowns = wielder.abilityCooldowns ?? {};
    wielder.abilityCooldowns["lastword_signature"] = startCooldown(this.turn, LAST_WORD_SIGNATURE_COOLDOWN_TURNS);
    this.noteAbilityUse(wielder, "lastword_signature");
    this.log.push(
      `${wielder.displayName} pays Migawari's price for ${target.displayName} — fully restored, ${wielder.displayName}'s own max HP permanently reduced to ${wielder.maxHp}.`
    );
    return true;
  }

  canLastRites(unitId: string): boolean {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed) return false;
    if (unit.side !== "player") return false;
    if (!unit.abilities.includes("lastword_last_rites")) return false;
    if (!isCooldownReady(this.cooldownReadyTurn(unit, "lastword_last_rites"), this.turn)) return false;
    return unit.actionsRemaining > 0;
  }

  /**
   * Every ally who went down THIS SAME TURN — BattleUnit.downedOnTurn ===
   * this.turn, latched once by handleDowned() at the instant of downing
   * (see that field's own comment in engine/units.ts) — and hasn't already
   * been ruled a permanent loss (isPermanentlyLost, same gate
   * getLastWordSignatureTargetsFrom uses above; lastword_last_rites' own
   * prose states this clause explicitly: "not yet lost to permadeath").
   *
   * "This turn" is deliberately Mission.turn, not phase. The one realistic
   * way a player-side unit goes down WHILE the player still has the
   * initiative to react (as opposed to during the hostile phase, when no
   * player ability can be cast at all) is hostile OVERWATCH fire reacting
   * to that unit's OWN move (triggerOverwatch, called from inside
   * movePlayerUnit's own choke point) — Mission.turn does not advance
   * until the hostile phase later hands back to the player
   * (endPlayerTurn -> runHostileTurn -> `this.turn += 1`), so this stays
   * true for the rest of that same player phase, which is exactly the
   * window "before resolving" is read to mean. A downing during the
   * hostile phase itself is never reachable here at all — no player
   * ability can fire outside the player phase, so there is no case where
   * this needs to reach "backward" across a phase boundary.
   */
  getLastRitesTargetsFrom(unitId: string): BattleUnit[] {
    if (!this.canLastRites(unitId)) return [];
    const unit = this.unitById(unitId)!;
    return this.units.filter(
      (u) => u.side === unit.side && u.downed && u.downedOnTurn === this.turn && !!u.pilotId && !this.isPermanentlyLost(u.pilotId!)
    );
  }

  /**
   * lastword_last_rites (Migawari/The Last Word) — "A downed ally (not yet
   * lost to permadeath) can act one final time this turn before resolving."
   * Rank 5: "The ally also gets a full heal for that one action, then goes
   * down again as normal."
   *
   * MECHANIC READING, flagged: the target is un-downed immediately and
   * granted LAST_RITES_ACTIONS_GRANTED action(s) — 1, not this game's
   * normal 2-action budget, see that constant's own comment in
   * data/combatTables.ts. Rank 1 does NOT heal them — they act at whatever
   * currentHp their downing left them (0, since applyMechDamage/
   * applyBloomDamage always clamp a downing hit to exactly 0 — a genuine
   * "one last gasp" while critically wounded, matching rank1's prose
   * exactly, which says nothing about healing). Rank 5 heals to full
   * BEFORE that action so it can actually be spent at full effectiveness,
   * per its own explicit "gets a full heal for that one action" clause.
   *
   * `lastRitesBorrowedTurn` is stamped with the CURRENT turn so
   * resolveLastRitesBorrowedTime() (called once, from endPlayerTurn(), see
   * that method's own comment for exactly where in the turn-end sequence
   * and why) can force this unit back down when this same player turn
   * closes out — UNCONDITIONALLY, whether or not the borrowed action was
   * ever spent, and regardless of what HP they're sitting on by then. This
   * is read as applying at BOTH ranks, not just rank 5: a borrowed action
   * was never a rescue at either rank, only rank 5 changes what happens
   * DURING it — rank 5's own explicit "then goes down again as normal" is
   * read as spelling out a rule that was already implicit at rank 1, not
   * introducing a NEW rule exclusive to rank 5 (the alternative reading —
   * rank 1 permanently saves the pilot and only rank 5 sends them back
   * down — would make rank 1 strictly a partial permadeath-cheat with no
   * stated permanent-cost analogue anywhere in this kit, which nothing in
   * the prose supports and which this Heirloom's OTHER ability already has
   * the honest, costed version of).
   *
   * Costs the HEALER 1 action, does not end their turn — same tier as
   * Field Triage/lastWordSignature above.
   */
  lastRites(unitId: string, targetId: string): boolean {
    if (!this.canLastRites(unitId)) return false;
    const healer = this.unitById(unitId)!;
    const target = this.getLastRitesTargetsFrom(unitId).find((t) => t.instanceId === targetId);
    if (!target) return false;

    const rank5 = this.heirloomRank(healer, "lastword_last_rites") >= 5;
    target.downed = false;
    target.actionsRemaining = LAST_RITES_ACTIONS_GRANTED;
    target.lastRitesBorrowedTurn = this.turn;
    if (rank5) target.currentHp = target.maxHp;

    healer.actionsRemaining -= 1;
    healer.abilityCooldowns = healer.abilityCooldowns ?? {};
    healer.abilityCooldowns["lastword_last_rites"] = startCooldown(this.turn, LAST_RITES_COOLDOWN_TURNS);
    this.noteAbilityUse(healer, "lastword_last_rites");
    this.log.push(
      rank5
        ? `${healer.displayName} performs Last Rites on ${target.displayName} — one final action, fully healed for it.`
        : `${healer.displayName} performs Last Rites on ${target.displayName} — one final action.`
    );
    return true;
  }

  /**
   * lastword_last_rites' own "before resolving" close-out — called once,
   * from endPlayerTurn(), after every objective/win-loss check that same
   * method already runs (see its own call-site comment for why AFTER, not
   * before). Walks every unit currently on borrowed time FROM THIS TURN
   * and forces it back down, unconditionally, if it's still alive and
   * un-downed — matching rank5's explicit "then goes down again as normal"
   * (read as applying at rank 1 too, see lastRites()'s own header comment).
   *
   * Deliberately does NOT call handleDowned(): the original downing
   * already ran the full permadeath check and recorded whatever it needed
   * to record (this.permanentLosses, survivalBonus tracking, the
   * commander-down/rescue-failure branches) at the moment it actually
   * happened. Re-running any of that here would be a second casualty for
   * one downing, which is wrong on its face. This is only a bookkeeping
   * flag reset — currentHp forced back to 0 regardless of any rank5 heal
   * or damage taken during the borrowed action, since "goes down again as
   * normal" reads as a full return to the pre-Last-Rites state, not a
   * partial one.
   *
   * `lastRitesBorrowedTurn` is cleared on every unit that has one
   * regardless of the `downed` check above — a unit that was ALSO killed
   * again for real during its borrowed action (ordinary combat damage,
   * handleDowned already ran for that) still needs the stale flag cleared
   * so it doesn't linger into a future turn number this same field could
   * coincidentally re-match against.
   */
  private resolveLastRitesBorrowedTime(): void {
    for (const unit of this.units) {
      if (unit.lastRitesBorrowedTurn === undefined) continue;
      if (unit.lastRitesBorrowedTurn === this.turn && !unit.downed) {
        unit.downed = true;
        unit.currentHp = 0;
        unit.actionsRemaining = 0;
        this.log.push(`${unit.displayName}'s borrowed time from Last Rites runs out — down again.`);
      }
      unit.lastRitesBorrowedTurn = undefined;
    }
  }

  // ---- Vault Phase 2, slice 6 (3 Sep 2026) — Simulacrum's full 3-ability
  // kit (stolen_seal/The Stolen Seal). ABERRATION track, no aristocrat
  // pilot — see data/heirlooms.ts's own header comment for what that
  // distinction means, and this pass's own build-log addendum for the full
  // account of how "which pilot ends up holding it" is a genuine
  // pre-existing gap in this codebase (nothing anywhere calls
  // engine/heirlooms.ts's acquireAberration for "stolen_seal" specifically —
  // checked, not assumed — outside of test loops over both aberration ids
  // generically). Every ability below only cares whether the FIELDED unit's
  // own `abilities` array includes its id, the same gate every other live
  // Heirloom ability already uses; how that array gets populated is
  // entirely out of this pass's scope.

  /** Uniform integer draw in [min, max] inclusive, via this Mission's own seeded rng — matches the codebase's existing "everything random goes through this.rng, never Math.random() directly" rule (see MissionOptions.rng's own comment) so a batch-sim run stays reproducible. No existing precedent in this file for a ranged integer roll (only rollMeepsDodge's threshold check existed before this pass), so this is a new small helper rather than an inline computation repeated at each of Simulacrum's three call sites below. */
  private rollIntInRange(min: number, max: number): number {
    return min + Math.floor(this.rng() * (max - min + 1));
  }

  /**
   * seal_inherited_weight (Simulacrum/The Stolen Seal) — "At mission start,
   * roll a random DEF bonus (0 to +15) for the whole mission." Rank5: "The
   * roll's floor narrows to +8 to +15 — still random, never bad." Passive,
   * cooldownTurns 0 in the data — this is not a player-cast verb at all, it
   * fires automatically, exactly once, from the constructor (see the call
   * site right after deployPlayerUnits()) for every currently-deployed
   * player unit carrying the ability. A wielder who isn't fielded this
   * mission simply has no BattleUnit for this loop to find, which is
   * correct — nothing to roll for.
   *
   * The bonus is added directly onto `effectiveDefense`, not tracked as a
   * separate live-read flag: unlike `oathkeeperActive`/`overextended`/etc.,
   * combat.ts already reads `defender.effectiveDefense` at every damage
   * calculation with no other "is there a bonus" branch needed, and nothing
   * anywhere else in this file ever reassigns effectiveDefense after unit
   * creation (grep-confirmed — the only other writers are the test-only
   * synthetic literals in sim/playerAi/__tests__/combat.test.ts), so a
   * direct, permanent-for-the-mission add is both the simplest and the most
   * honest representation of "for the whole mission." The exact roll is
   * also stashed on `inheritedWeightDefBonus` — see that field's own
   * comment for why, purely informational, never itself read by combat
   * code.
   */
  private rollInheritedWeight(): void {
    for (const unit of this.units) {
      if (unit.side !== "player" || unit.downed) continue;
      if (!unit.abilities.includes("seal_inherited_weight")) continue;
      const rank5 = this.heirloomRank(unit, "seal_inherited_weight") >= 5;
      const bonus = rank5
        ? this.rollIntInRange(SEAL_INHERITED_WEIGHT_DEF_BONUS_MIN_RANK5, SEAL_INHERITED_WEIGHT_DEF_BONUS_MAX_RANK5)
        : this.rollIntInRange(SEAL_INHERITED_WEIGHT_DEF_BONUS_MIN_RANK1, SEAL_INHERITED_WEIGHT_DEF_BONUS_MAX_RANK1);
      unit.effectiveDefense += bonus;
      unit.inheritedWeightDefBonus = bonus;
      this.log.push(`${unit.displayName} carries Inherited Weight — +${bonus} DEF for the mission.`);
    }
  }

  /**
   * seal_borrowed_authority (Simulacrum/The Stolen Seal) — every distinct
   * on-hit-effect KIND any hostile unit that was ever on THIS mission's own
   * board carries, win or lose, kill or no kill (the task's own bar:
   * "appearing in the mission and being in the same battle counts," not
   * "was actually killed"). Read from `this.units` rather than tracked
   * incrementally as combat happens: nothing in this file ever splices a
   * downed hostile out of `this.units` (grep-confirmed — the one `.filter`
   * on this array anywhere in this class removes a RESCUED player-side NPC,
   * engine/mission.ts's rescueUnit(), not a downed hostile), so by the time
   * Debrief calls this at mission end, every hostile that ever spawned this
   * mission — the initial deploy AND every later wave — is still present,
   * with `downed` correctly reflecting whether it survived. This method
   * doesn't filter on `downed` at all, on purpose.
   *
   * HOUSE AMARANTH FINDING, checked against the actual data rather than
   * assumed or taken from an older plan: House Amaranth hostile mechs
   * (hostile_mech_amaranth_01 through _05, hostile_mech_amaranth_conscript_01
   * through _04 — data/units.ts) DO appear as hostiles inside Warden
   * Company's own campaign (data/campaignAmaranth.ts references them 39
   * times) — genuinely reachable in the exact same campaign run a fielded
   * Simulacrum would ever be used in, not a separate, unreachable roster.
   * BUT `onHit` is a field ONLY data/bloom.ts's Bloom archetypes carry
   * (grep-confirmed: zero hits for "onHit" anywhere in data/units.ts) — a
   * hostile mech, House Amaranth or otherwise, has no on-hit-effect data of
   * any kind in this engine today. So rather than special-case "Bloom
   * counts, mechs don't" with a comment and a skip, this scans every
   * hostile UNIFORMLY by kind and only ever finds something for kind ===
   * "bloom" — mech-shape hostiles correctly and automatically contribute
   * nothing, without this method needing to hardcode that fact about them.
   * The moment a future pass ever gives a hostile mech archetype its own
   * onHit field, this starts picking it up for free, no changes needed
   * here.
   */
  getFoughtOnHitEffectKindsThisMission(): OnHitEffectKind[] {
    const kinds = new Set<OnHitEffectKind>();
    for (const u of this.units) {
      if (u.side !== "hostile" || u.kind !== "bloom") continue;
      const fxId = BLOOM[u.archetypeId]?.onHit;
      if (!fxId) continue;
      const fx = BLOOM_ON_HIT_EFFECTS[fxId];
      if (!fx || fx.kind === "none") continue;
      kinds.add(fx.kind);
    }
    return Array.from(kinds);
  }

  canSealBorrowedAuthority(unitId: string): boolean {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed) return false;
    if (unit.side !== "player") return false;
    if (!unit.abilities.includes("seal_borrowed_authority")) return false;
    if (!isCooldownReady(this.cooldownReadyTurn(unit, "seal_borrowed_authority"), this.turn)) return false;
    return unit.actionsRemaining > 0;
  }

  /**
   * seal_borrowed_authority (Simulacrum/The Stolen Seal) — "Next attack
   * copies a random on-hit effect drawn from any Bloom archetype or House
   * Amaranth unit fought this campaign." Rank5: "Reroll the draw once per
   * use before committing."
   *
   * THE DRAW POOL, flagged: `this.foughtOnHitEffectKinds` (the campaign's
   * own persisted set, snapshotted at construction — see
   * MissionOptions.foughtOnHitEffectKinds' own comment) is read here, NOT
   * `getFoughtOnHitEffectKindsThisMission()`'s live, THIS-mission answer.
   * Deliberate: "fought this campaign" is read as a retrospective memory
   * bank the spoof draws on — it has to have learned an access pattern from
   * something it fought BEFORE this exact instant, not from the enemy
   * standing in front of it that it hasn't finished fighting yet. The real
   * edge case this creates: a fresh campaign's very first mission with a
   * freshly-fielded Simulacrum has an EMPTY pool (nothing fought in any
   * PRIOR mission), so this refuses cleanly below even with hostiles
   * actively on the board — read as correct, not a bug, given that
   * reading. This mission's own encounters are unioned into the persisted
   * set only at Debrief, for every FUTURE mission's draw.
   *
   * Returns `{ok:false, reason}` rather than a plain boolean on failure —
   * this codebase's existing {ok, reason} convention for a verb whose
   * refusal needs to reach the player as a sentence, not just a greyed-out
   * button (see engine/heirlooms.ts's HeirloomRecruitResult/
   * resolveAristocratPath, and engine/campaignState.ts's LaunchCheckResult)
   * — chosen here, unlike this file's usual plain-boolean canX()/verb()
   * pairs, because this ability's own OUTCOME (which kind got drawn) is
   * something a caller/UI genuinely needs back, not just a yes/no.
   *
   * REROLL SEMANTICS (rank5), flagged as the most genuinely arguable call
   * in this whole kit: "reroll the draw once per use before committing"
   * could mean either (a) draw twice, show the player both, let them pick
   * which one to commit, or (b) draw, then unconditionally draw again and
   * commit the second result, discarding the first. This codebase has NO
   * existing precedent anywhere for a "preview a random result, then let
   * the player accept or reroll it" interactive flow — every ability here
   * is a single canX()/verb() call, no multi-step commit dance — so
   * building (a) for real would mean inventing a wholly new UI interaction
   * pattern for one ability rank, out of proportion with the rest of this
   * pass. (b) is implemented instead: at rank5 this.rng() is consumed
   * TWICE (a real second draw, not a cosmetic one) and only the second
   * result is kept. Worth being honest about what this DOESN'T buy: since
   * both draws come from the same uniform distribution over the same pool,
   * an unconditional reroll is statistically identical to a single draw —
   * this is a faithful literal implementation of "roll again, discard the
   * first," not a mechanic that improves the average outcome the way a
   * genuine player-choice reroll would. Testable and honest either way:
   * rank1 consumes the rng stream once, rank5 consumes it twice.
   */
  sealBorrowedAuthority(unitId: string): { ok: boolean; reason?: string; kind?: OnHitEffectKind } {
    if (!this.canSealBorrowedAuthority(unitId)) return { ok: false, reason: "Simulacrum cannot use Borrowed Authority right now." };
    if (this.foughtOnHitEffectKinds.length === 0) {
      return { ok: false, reason: "Simulacrum hasn't encountered anything to copy yet this campaign." };
    }
    const unit = this.unitById(unitId)!;
    const rank5 = this.heirloomRank(unit, "seal_borrowed_authority") >= 5;
    let kind = this.foughtOnHitEffectKinds[Math.floor(this.rng() * this.foughtOnHitEffectKinds.length)];
    if (rank5) {
      // Second, independent draw — see this method's own header for why
      // this reads as "reroll" rather than a cosmetic re-roll.
      kind = this.foughtOnHitEffectKinds[Math.floor(this.rng() * this.foughtOnHitEffectKinds.length)];
    }
    unit.borrowedAuthorityFxKind = kind;
    unit.actionsRemaining -= 1;
    unit.abilityCooldowns = unit.abilityCooldowns ?? {};
    unit.abilityCooldowns["seal_borrowed_authority"] = startCooldown(this.turn, SEAL_BORROWED_AUTHORITY_COOLDOWN_TURNS);
    this.noteAbilityUse(unit, "seal_borrowed_authority");
    this.log.push(`${unit.displayName} spoofs Borrowed Authority — next attack copies a ${kind} effect.`);
    return { ok: true, kind };
  }

  canLedgerhallStatic(unitId: string): boolean {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed) return false;
    if (unit.side !== "player") return false;
    if (!unit.abilities.includes("seal_ledgerhall_static")) return false;
    if (!isCooldownReady(this.cooldownReadyTurn(unit, "seal_ledgerhall_static"), this.turn)) return false;
    return unit.actionsRemaining > 0;
  }

  /**
   * Every living hostile currently visible to the whole player side that
   * actually HAS at least one ability to jam — `unit.abilities.length > 0`.
   * That restriction matters in practice: createBloomUnit always sets
   * `abilities: []` (grep-confirmed — no Bloom archetype ever carries a
   * discrete "ability" the way a pilot does), so this naturally scopes
   * Ledgerhall Static's legal targets down to hostile MECHS only (House
   * Amaranth troopers/conscripts and any other human hostile), the only
   * shape with a real, non-empty `abilities` array to draw from — same
   * "any range" visibility rule deadfall_strike's own
   * getDeadfallStrikeTargetsFrom already established (unitsVisibleToSide,
   * not the wielder's own attackRange/vision). Empty whenever
   * canLedgerhallStatic is false, same "ask the engine, never guess"
   * contract every other getXTargetsFrom method in this file follows.
   */
  getLedgerhallStaticTargetsFrom(unitId: string): BattleUnit[] {
    if (!this.canLedgerhallStatic(unitId)) return [];
    const visibleIds = this.playerVisibleHostileIds();
    return this.livingUnits().filter((u) => u.side === "hostile" && u.abilities.length > 0 && visibleIds.has(u.instanceId));
  }

  /**
   * seal_ledgerhall_static (Ledgerhall Static) — "Jams one random enemy
   * ability for 2 turns." Rank5: "Jams the target's strongest available
   * ability specifically — the spoof has finally learned enough to be
   * selective." Rank1 picks a uniformly random entry from the target's own
   * `abilities` array; rank5 picks by SEAL_LEDGERHALL_STATIC_ABILITY_PRIORITY
   * (data/combatTables.ts — see that table's own comment for the full
   * reasoning behind the ordering, and its honest limits).
   *
   * HONEST LIMITATION, stated plainly rather than glossed over — read this
   * before assuming the jam "does" anything to a hostile's behavior:
   * engine/ai.ts's decideHostileAction has NO per-ability dispatch at all
   * (grep-confirmed: zero references to `.abilities` anywhere in that
   * file). A hostile mech's own `abilities` array only exists because
   * createHostileMechUnit shares the exact same UNIT_ARCHETYPES record a
   * player pilot of that path uses (engine/units.ts) — every canX() gate in
   * THIS file that would otherwise read one of those ability ids
   * (abil_overshield, abil_interdict, abil_charge, abil_ambush,
   * abil_sensor_sweep, abil_repair, abil_cockpit_evac, abil_screen,
   * abil_clear_bloom) unconditionally refuses for `unit.side !== "player"`
   * before ever checking `unit.abilities.includes(...)`, and
   * decideHostileAction's own decision tree (reflexive/pack/emergent tiers)
   * never reads unit.abilities to choose between options — hostiles only
   * ever move-then-basic-attack. So a hostile mech's ability list is, today,
   * 100% inert leftover data regardless of this ability. What THIS method
   * does is real and tested: it records exactly which ability id is jammed
   * and for how long (BattleUnit.jammedAbilityId/jammedAbilityTurnsRemaining,
   * decremented by the same start-of-own-next-turn reset loop every other
   * timed status in this file uses). What it can't honestly claim: that the
   * jam changes anything about how that hostile actually plays, because
   * there is no ability-choice AI on the hostile side to prevent from
   * choosing it in the first place. isAbilityJammed() below exists so the
   * day decideHostileAction grows real ability dispatch, wiring the gate in
   * is a one-line addition there, not a redesign here.
   */
  ledgerhallStatic(unitId: string, targetId: string): boolean {
    if (!this.canLedgerhallStatic(unitId)) return false;
    const unit = this.unitById(unitId)!;
    const target = this.getLedgerhallStaticTargetsFrom(unitId).find((t) => t.instanceId === targetId);
    if (!target) return false;

    const rank5 = this.heirloomRank(unit, "seal_ledgerhall_static") >= 5;
    const jammed = rank5
      ? [...target.abilities].sort(
          (a, b) => (SEAL_LEDGERHALL_STATIC_ABILITY_PRIORITY[b] ?? 0) - (SEAL_LEDGERHALL_STATIC_ABILITY_PRIORITY[a] ?? 0)
        )[0]
      : target.abilities[Math.floor(this.rng() * target.abilities.length)];

    target.jammedAbilityId = jammed;
    target.jammedAbilityTurnsRemaining = SEAL_LEDGERHALL_STATIC_JAM_DURATION_TURNS;
    unit.actionsRemaining -= 1;
    unit.abilityCooldowns = unit.abilityCooldowns ?? {};
    unit.abilityCooldowns["seal_ledgerhall_static"] = startCooldown(this.turn, SEAL_LEDGERHALL_STATIC_COOLDOWN_TURNS);
    this.noteAbilityUse(unit, "seal_ledgerhall_static");
    this.log.push(`${unit.displayName} jams ${target.displayName}'s ${jammed} for ${SEAL_LEDGERHALL_STATIC_JAM_DURATION_TURNS} turn(s).`);
    return true;
  }

  /** Whether `unit` currently has `abilityId` jammed by Ledgerhall Static — see that method's own header comment for the honest limit on what this presently changes about hostile behavior. Exists for tests and for a future decideHostileAction to consult. */
  isAbilityJammed(unit: BattleUnit, abilityId: string): boolean {
    return unit.jammedAbilityId === abilityId && (unit.jammedAbilityTurnsRemaining ?? 0) > 0;
  }

  // ---- Vault Phase 2, slice 7 (3 Sep 2026) — requiem_severance (Gjallar /
  // the Requiem system). The LAST of this build-out's eight abilities, and
  // per data/heirlooms.ts's own header comment "the worst candidate to
  // build first... the one fixed point in the pool" — built last, on
  // purpose, now that every other kit's canX()/getX()/verb() shape is
  // already established to copy.
  //
  // Spec, pulled live from the actual current files rather than memory or
  // an older plan (this project's own standing rule): data/abilities.ts's
  // own SEVERANCE constant (Data Pack §11.5, "not a stat block tuning
  // knob; softening it is explicitly against the design") plus GDD §8's own
  // mechanics table, both found via a live project doc search this pass —
  //   - Shape: a line 8 tiles long, 1 tile wide, from the origin OUTWARD,
  //     origin tile INCLUDED (SEVERANCE.shape / GDD §8.2 "the origin unit
  //     is included").
  //   - Damage: 80, FIXED — "not modified by ATK, DEF, tier, mek, or
  //     terrain defence" (SEVERANCE.damage/ignoresTerrain). This is why
  //     requiemSeverance() below never calls resolveMechAttack/
  //     resolveAttackOnBloom at all: those functions ARE the stat formula
  //     this ability is defined by NOT using. "Ignores the full-HP damage
  //     cap" (SEVERANCE.ignoresFullHpCap) falls out of that for free —
  //     there's no `Math.min(dmg, FULL_HP_DAMAGE_CAP)` call anywhere below
  //     to bypass, because there's no capped-formula call in the first
  //     place. WORTH FLAGGING HONESTLY: FULL_HP_DAMAGE_CAP is 90
  //     (data/combatTables.ts) and SEVERANCE.damage is 80 — for a mech-
  //     shape target specifically, the cap could never have bound against
  //     this fixed damage anyway (the cap only ever REDUCES a raw hit above
  //     it; 80 is already below 90), so "ignores the cap" is mechanically
  //     inert for mech targets under today's numbers. It's the Bloom side
  //     (below) where bypassing the equivalent wall — Endurance — is the
  //     part that actually changes an outcome. Not a bug, not silently
  //     smoothed over: see this file's own gjallarRequiem.test.ts for a
  //     test that says so explicitly, and this pass's own final report for
  //     the same finding surfaced to Maxime.
  //   - Versus Bloom: bypasses Endurance entirely, Collapse-checks Vitality
  //     DIRECTLY (SEVERANCE.vsBloom === "collapse_check") — see
  //     applyRequiemBloomDamage's own comment in engine/combat.ts for the
  //     exact mechanic, mirrored off applyBloomDamage's own already-
  //     collapsed branch. THIS is where the bypass is genuinely load-
  //     bearing: a Bloom at full Endurance that a normal attack could never
  //     touch Vitality on in one hit (Data Pack §8.3's own "overflow does
  //     NOT carry into Vitality" rule) dies outright to Requiem if its
  //     Vitality is 80 or less, regardless of Endurance.
  //   - Hits friend and foe alike, unconditionally, no exception — see
  //     requiemSeverance()'s own comment for why its hit-list is built with
  //     NO side filter at all, the one deliberate absence this whole
  //     section exists to be. data/heirlooms.ts's own hard rule: "No
  //     Heirloom ability besides the Requiem system's own signature
  //     line-attack may... hit friendlies unconditionally."
  //   - Charge: +1 per 10 HP dealt by the player side, +1 per 10 HP taken by
  //     the player side, max 100 (SEVERANCE.chargePerTenHpDealt/
  //     chargePerTenHpTaken/maxCharge) — see accrueRequiemCharge below.
  //     Resets to 0 on a successful fire, not a turn-based cooldown (see
  //     requiemCharge's own field comment, above this class).
  //
  // FLAGGED ASSUMPTION #1, read before assuming the UI/action-economy shape
  // below is spec rather than a judgment call: GDD Data Pack §11.5 says
  // "Player chooses an origin — any own unit — and one of eight
  // directions," which literally reads as decoupled from who's ACTING —
  // pick any deployed unit's tile as the beam's origin, independent of
  // whose turn action gets spent. This codebase has no precedent anywhere
  // for a two-unit-selection ability flow (every arm-then-click ability
  // here — Cinder Line, Missile, Fire Support, Deadfall — spends the
  // SELECTED unit's own action and uses that SAME unit's own position as
  // the effect's origin), and building a novel "pick unit A, then
  // separately pick unit B's tile as the origin" flow for the one ability
  // in the whole kit that's explicitly NOT meant to set any new precedent
  // (data/heirlooms.ts's "Deliberately ONE ability, not three" is about
  // ability COUNT, not UI shape) is real, risky scope expansion for one
  // line of GDD prose. Read instead, and implemented below: "any own unit"
  // describes the ordinary select-your-acting-unit choice every ability in
  // this game already offers, with that SAME selected unit's own tile as
  // the origin — Gjallar fires from wherever its wielder is standing, same
  // as Cinder Line fires from wherever Surtr is standing. canRequiemSeverance
  // is gated on `unit.abilities.includes("requiem_severance")` for exactly
  // this reason — same uniform gate every other ability's canX() in this
  // file uses — rather than letting any arbitrary player unit stand in as
  // origin. The alternate, literal reading (a true two-step origin-then-
  // direction flow, origin decoupled from the acting unit) is real and
  // defensible from the text — flagged here for Maxime, not silently
  // decided, since it changes both this section's shape and
  // scenes/Battle.ts's targeting flow if he wants it built the other way.
  //
  // FLAGGED ASSUMPTION #2, smaller: neither the Data Pack nor GDD §8 says
  // whether Oathkeeper's HP floor or an active Tank shield should still
  // apply to a Requiem hit. requiemSeverance() below routes mech-shape
  // damage through the ordinary applyMechDamage() choke point (same as
  // every other damage source in the game — see oath_oathkeeper's own doc
  // comment on that function: "no call site needs its own awareness" of
  // it), so YES, both still apply here: an Oathkeeper-active ally caught in
  // the beam is floored rather than deleted, and a shielded unit absorbs
  // part of the 80 first. Defensible as the safer, most-consistent-with-
  // existing-architecture default, but it is a choice, not spec — flagged.

  canRequiemSeverance(unitId: string): boolean {
    const unit = this.unitById(unitId);
    if (!unit || unit.downed) return false;
    if (unit.side !== "player") return false;
    if (!unit.abilities.includes("requiem_severance")) return false;
    if (this.requiemCharge < SEVERANCE.maxCharge) return false;
    return unit.actionsRemaining > 0;
  }

  /**
   * The direction from `from` to `target`, as a unit vector — one of
   * CINDER_LINE_DIRECTIONS' own 8 offsets, reused as-is rather than
   * declared a second time under a new name: Requiem's own 8-directional
   * shape (GDD §8.2's "one of eight directions") is genuinely the same set
   * Cinder Line already established as this engine's line-direction
   * convention, not a coincidental match worth a duplicate literal array.
   * Returns null if `target` isn't a legal cardinal/diagonal direction from
   * `from` at all (mirrors cinderLineTilesTo's own isCardinal/isDiagonal
   * check) — unlike Cinder Line, there's no MAX_TILES-style distance cap to
   * also check here, since Requiem's line length is fixed
   * (SEVERANCE.shape.length), never chosen by how far the click landed.
   */
  private requiemDirectionTo(from: Coord, target: Coord): Coord | null {
    const ddx = target.x - from.x;
    const ddy = target.y - from.y;
    if (ddx === 0 && ddy === 0) return null;
    const isCardinal = ddx === 0 || ddy === 0;
    const isDiagonal = Math.abs(ddx) === Math.abs(ddy);
    if (!isCardinal && !isDiagonal) return null;
    return { x: Math.sign(ddx), y: Math.sign(ddy) };
  }

  /**
   * The fixed SEVERANCE.shape.length tiles a Requiem fired in `dir` from
   * `origin` actually hits, origin tile INCLUDED as tile 0 (GDD §8.2's own
   * "the origin unit is included" — the wielder is inside its own blast,
   * on purpose, see requiemSeverance's own comment). Clipped at the board
   * edge exactly like getCinderLineAreaFrom/cinderLineTilesTo (`break` on
   * the first out-of-bounds step) — SEVERANCE.shape doesn't say what
   * happens off-map, so a short line near an edge rather than an error is
   * the same judgment call Cinder Line already made for the identical gap.
   */
  private requiemLineTiles(origin: Coord, dir: Coord): Coord[] {
    const tiles: Coord[] = [];
    for (let step = 0; step < SEVERANCE.shape.length; step++) {
      const c = { x: origin.x + dir.x * step, y: origin.y + dir.y * step };
      if (!inBounds(this.map, c)) break;
      tiles.push(c);
    }
    return tiles;
  }

  /**
   * Every in-bounds tile along one of the 8 legal directions from `unitId`'s
   * own position, out to the board edge — same "click target set" contract
   * as getCinderLineAreaFrom (every (direction, step) pair, clipped at the
   * map boundary), deliberately NOT capped at SEVERANCE.shape.length the
   * way requiemLineTiles' own actual hit-list is: this set only names which
   * DIRECTION a click selects, not how far the beam reaches (that's fixed),
   * so a click anywhere along a legal ray — even past tile 8, even past the
   * board's own far edge from a short line's perspective — correctly picks
   * the same direction a click on the nearest tile would. scenes/Battle.ts
   * highlights these as the clickable set; requiemSeverance/
   * previewRequiemSeverance both re-derive the direction from whatever tile
   * was actually clicked and independently cap the actual hit-list at
   * SEVERANCE.shape.length via requiemLineTiles.
   */
  getRequiemDirectionTargets(unitId: string): Coord[] {
    if (!this.canRequiemSeverance(unitId)) return [];
    const unit = this.unitById(unitId)!;
    const tiles: Coord[] = [];
    for (const dir of CINDER_LINE_DIRECTIONS) {
      let step = 1;
      while (true) {
        const c = { x: unit.pos.x + dir.x * step, y: unit.pos.y + dir.y * step };
        if (!inBounds(this.map, c)) break;
        tiles.push(c);
        step += 1;
      }
    }
    return tiles;
  }

  /** UI preview for an armed Requiem: the fixed-length tile run a click on `target` would actually hit, or null if that click doesn't name a legal direction. Returns null outright if the ability isn't currently usable at all, same "ask the engine, never guess" contract previewCinderLineFrom already follows. */
  previewRequiemSeverance(unitId: string, target: Coord): Coord[] | null {
    if (!this.canRequiemSeverance(unitId)) return null;
    const unit = this.unitById(unitId)!;
    const dir = this.requiemDirectionTo(unit.pos, target);
    if (!dir) return null;
    return this.requiemLineTiles(unit.pos, dir);
  }

  /**
   * requiem_severance (Gjallar) — Data Pack §11.5 / GDD §8.2, transcribed
   * exactly, not softened: fixed SEVERANCE.damage to every living unit on
   * the line, EITHER side, the wielder's own tile included, no exception.
   * Deliberately the only verb in this entire file that builds its hit-list
   * with NO `u.side` filter and no "exclude the caster" filter (contrast
   * missileStrike's own explicit `u.instanceId !== attacker.instanceId`
   * exclusion, and every side-aware filter elsewhere in this class) — see
   * this section's own header comment for the hard rule this is the one
   * sanctioned exception to.
   *
   * Bypasses resolveMechAttack/resolveAttackOnBloom entirely for mech-shape
   * targets — fixed damage, "not modified by ATK, DEF, tier, mek, or
   * terrain defence" leaves nothing for that formula to compute — and
   * routes straight to applyMechDamage, the same single choke point
   * Oathkeeper's own HP floor and Tank shield absorption already use for
   * every OTHER damage source in the game (see this section's own
   * FLAGGED ASSUMPTION #2 above for why that's a choice, not spec).
   *
   * Bloom-shape targets go through applyRequiemBloomDamage instead
   * (engine/combat.ts) — the Collapse-check-Vitality-directly mechanic, see
   * that function's own comment.
   *
   * No dodge, no counter: Meeps dodge (rollMeepsDodge) and the counter
   * check are both properties of resolveMechAttack's own formula call in
   * resolveAttack() — a call this method never makes — so both are
   * naturally absent here, consistent with GDD §8.1's "no ally carve-out,
   * ever... no confirmation that lets you re-aim for free," read as
   * extending to "no dodge, no counter" too: an unconditional beam isn't an
   * aimed shot a Meeps steps out of, or a melee exchange a Tank swings back
   * into.
   *
   * Also, by construction, never triggers Bloom on-hit effects, weapon-
   * branch on-hit effects (Shock Claws' stun), or seal_borrowed_authority's
   * copy — every one of those is wired inside resolveAttack()'s own three
   * branches, none of which this method calls. A known, honest gap, not an
   * oversight: flagged in this pass's own final report, and pinned by a
   * dedicated test in gjallarRequiem.test.ts.
   *
   * Resets requiemCharge to 0 (GDD §8.2's own "cooldown: meter resets to
   * zero") and spends the acting unit's entire action budget, same tier as
   * every other "battlefield-shaping strike" verb in this file.
   */
  requiemSeverance(unitId: string, target: Coord): { hitIds: string[]; killedIds: string[] } | null {
    if (!this.canRequiemSeverance(unitId)) return null;
    const unit = this.unitById(unitId)!;
    const dir = this.requiemDirectionTo(unit.pos, target);
    if (!dir) return null;
    const tiles = this.requiemLineTiles(unit.pos, dir);
    if (tiles.length === 0) return null;

    const tileSet = new Set(tiles.map((c) => coordKey(c)));
    // No side filter, no "exclude the caster" filter — see this method's
    // own header comment. livingUnits() is this file's existing "not
    // downed" filter, reused rather than a fresh `!u.downed` check.
    const hit = this.livingUnits().filter((u) => tileSet.has(coordKey(u.pos)));
    const killedIds: string[] = [];

    for (const victim of hit) {
      if (victim.kind === "bloom") {
        applyRequiemBloomDamage(victim, SEVERANCE.damage);
      } else {
        applyMechDamage(victim, SEVERANCE.damage);
      }
      const outcome: AttackOutcome = {
        attackerId: unitId,
        defenderId: victim.instanceId,
        damage: SEVERANCE.damage,
        countered: false,
        defenderDowned: victim.downed,
      };
      // Campaign-economy crediting, same call every other multi-target
      // strike (missileStrike, fireSupport) already makes — see
      // recordPerformance's own comment for why attacker === victim (the
      // wielder caught in its own line, GDD §8.2's "origin unit included")
      // is a safe, harmless call: it credits that SAME pilotId with both
      // damageDealt and damageTaken for the hit, which is exactly correct
      // for a unit that shot itself.
      this.recordPerformance(unit, victim, outcome);
      if (victim.downed) killedIds.push(victim.instanceId);
    }

    this.requiemCharge = 0;
    unit.actionsRemaining = 0;
    unit.concealed = false; // firing gives your position away, same as any other attack — resolveAttack's identical line
    this.log.push(`${unit.displayName} fires Gjallar — Requiem, an ${tiles.length}-tile line, ${hit.length} hit, ${killedIds.length} downed.`);
    for (const victim of hit) if (victim.downed) this.handleDowned(victim);
    return { hitIds: hit.map((u) => u.instanceId), killedIds };
  }

  /**
   * Gjallar/Requiem's charge meter — "+1 per 10 HP of damage dealt, +1 per
   * 10 HP taken," read as: the PLAYER side's own combat activity, on
   * either end of an exchange, charges the meter (SEVERANCE.
   * chargePerTenHpDealt/chargePerTenHpTaken, both 1 today). Called once
   * from resolveAttack(), right alongside recordPerformance — see that call
   * site's own comment for why resolveAttack is the one correct choke
   * point (every ordinary attack in the game funnels through it).
   *
   * SCOPED, FLAGGED: only ordinary attacks (resolveAttack's own primary hit
   * and counter-hit) feed this meter — DoT ticks (bloom_mat, acid_dot,
   * Surtr's own burning lines), Fire Support, and Missile splash damage do
   * NOT, even though some of those can also involve the player side dealing
   * or taking damage. Data Pack §11.5 doesn't specify whether passive/AoE
   * damage sources should count, and wiring this file's other ~15
   * applyMechDamage/applyBloomDamage call sites into a second bookkeeping
   * pass is real, separate scope for a rate that's explicitly "not run
   * through any sim" regardless (see HEIRLOOM_ABILITY_RANK_COST's own
   * comment in data/heirlooms.ts for that project-wide caveat) — flagged
   * here rather than silently narrowed, since a wider reading is
   * defensible and cheap to extend later (this is the one method that
   * would need new call sites; nothing else in this design changes).
   *
   * `outcome.damage`/`outcome.counterDamage` are read AFTER whatever the
   * resolver formula already computed (terrain, cap, dodge all already
   * baked in by the time `outcome` exists) but BEFORE Oathkeeper/shield
   * mitigation, which happens downstream at applyMechDamage() — so a hit
   * that later gets floored by an active Oathkeeper window still charges
   * the meter based on the RESOLVED damage, not what actually landed on
   * `currentHp`. Consistent with reading "damage dealt/taken" as the
   * attack's own resolved size, not net of a target's separate defensive
   * tech — no different from how ledger_entry's kill-stacking already reads
   * off raw outcome damage elsewhere in this file.
   */
  private accrueRequiemCharge(attacker: BattleUnit, defender: BattleUnit, outcome: AttackOutcome): void {
    const points = (dmg: number, perTen: number) => Math.floor(dmg / 10) * perTen;
    if (outcome.damage > 0) {
      if (attacker.side === "player") {
        this.requiemCharge = Math.min(SEVERANCE.maxCharge, this.requiemCharge + points(outcome.damage, SEVERANCE.chargePerTenHpDealt));
      }
      if (defender.side === "player") {
        this.requiemCharge = Math.min(SEVERANCE.maxCharge, this.requiemCharge + points(outcome.damage, SEVERANCE.chargePerTenHpTaken));
      }
    }
    if (outcome.countered && outcome.counterDamage) {
      // The counter is the DEFENDER's own mek striking back — same
      // dealt/taken split recordPerformance's own header comment already
      // argues for crediting counters to the defender, mirrored here.
      if (defender.side === "player") {
        this.requiemCharge = Math.min(SEVERANCE.maxCharge, this.requiemCharge + points(outcome.counterDamage, SEVERANCE.chargePerTenHpDealt));
      }
      if (attacker.side === "player") {
        this.requiemCharge = Math.min(SEVERANCE.maxCharge, this.requiemCharge + points(outcome.counterDamage, SEVERANCE.chargePerTenHpTaken));
      }
    }
  }

  /**
   * Protect Asset (Mission 22, 25 Aug 2026) — see data/types.ts's
   * CampaignMission.objective comment for the full design. Once per turn
   * (same call site as tickBloomRegrowth, right after it — order between
   * the two never matters, no mission is both clear_bloom and
   * protect_asset), counts every living hostile currently standing on a
   * MapDefinition.defendZone tile and applies PROTECT_ASSET_TICK_DAMAGE per
   * hostile found there. Deliberately position-based, not
   * attack-based — a hostile that reaches the perimeter costs the ship HP
   * just by being there, so kiting one away from the zone (even without
   * killing it) is real, valid play, the same way it already is for
   * hold_zone's own zone check.
   *
   * No-op for every mission that isn't protect_asset, same guard shape as
   * tickBloomRegrowth right above it.
   */
  private tickAssetDamage(): void {
    if (this.mission.objective !== "protect_asset") return;
    const zone = this.map.defendZone ?? [];
    if (!zone.length) return;
    const zoneKeys = new Set(zone.map(coordKey));
    const hostilesInZone = this.units.filter(
      (u) => u.side === "hostile" && !u.downed && zoneKeys.has(coordKey(u.pos))
    ).length;
    if (!hostilesInZone) return;
    const damage = hostilesInZone * PROTECT_ASSET_TICK_DAMAGE;
    this.assetHp = Math.max(0, this.assetHp - damage);
    this.log.push(
      `The ${this.assetName} takes ${damage} damage — ${hostilesInZone} hostile(s) reached the perimeter (${this.assetHp}/${this.assetMaxHp} HP remaining).`
    );
  }

  /**
   * Tank shield house rule (data/combatTables.ts) — once per turn, for
   * every living mech-shape unit: recompute whether it's currently in an
   * eligible Tank's radius (self included), and if it took no damage since
   * the last tick, regen its shield by TANK_SHIELD_REGEN_PER_TURN, capped
   * at TANK_SHIELD_CAPACITY. Stepping outside the radius drops shield and
   * maxShield to 0 immediately — it's borrowed from the Tank's presence,
   * not banked. Bloom-shape units are skipped; they're never on the
   * player's side and never path==="tank" either.
   */
  private tickShieldRegen(): void {
    for (const unit of this.livingUnits()) {
      if (unit.kind === "bloom") continue;
      const sameSide = this.units.filter((u) => u.side === unit.side);
      const eligible = tankShieldEligible(unit, sameSide);
      if (!eligible) {
        unit.shield = 0;
        unit.maxShield = 0;
      } else {
        unit.maxShield = TANK_SHIELD_CAPACITY;
        if (!unit.tookDamageThisCycle) {
          unit.shield = Math.min(unit.maxShield, (unit.shield ?? 0) + TANK_SHIELD_REGEN_PER_TURN);
        }
      }
      unit.tookDamageThisCycle = false;
    }
  }

  /**
   * Munti passive regen house rule (data/combatTables.ts) — once per turn,
   * every living non-Bloom unit within MUNTI_REGEN_RADIUS of a same-side,
   * non-downed Munti (itself included) heals MUNTI_REGEN_PER_TURN, capped
   * at maxHp. Doesn't consume any unit's action — it's a passive aura, on
   * top of whatever the Munti's active Repair does that turn.
   *
   * Aegis Ward (Weapon Branch Point System, data/weaponBranches.ts,
   * 1 Sep 2026) — a Munti who's bought and equipped this branch projects
   * the aura at AEGIS_WARD_REGEN_RADIUS instead of the plain
   * MUNTI_REGEN_RADIUS. Per-Munti, not squad-wide: same convention as
   * Rapid Response's per-healer repair range above — a squad with more
   * than one Munti only gets the wider radius from whichever one actually
   * has the branch equipped, the other(s) still project the base radius.
   *
   * Combat Medic (Munti's 4th branch, 5 Sep 2026, Maxime's own design —
   * "triple passive regen. to those within 3 tile of themself") — a Munti
   * with this branch equipped projects the aura at COMBAT_MEDIC_REGEN_RADIUS
   * AND heals for MUNTI_REGEN_PER_TURN * COMBAT_MEDIC_REGEN_MULTIPLIER
   * instead of the plain amount, same per-Munti-equipped shape as Aegis
   * Ward. Because the healing amount can now differ by which Munti is in
   * range (it used to be flat regardless), "multiple Muntis in range don't
   * stack" is implemented as "the unit heals for the BEST (highest)
   * applicable amount among every same-side Munti in range," not a sum and
   * not just the first one found — a squad with both a plain Munti and a
   * Combat Medic in range gets Combat Medic's number, not both added
   * together, and not whichever happened to be checked first.
   */
  private tickMuntiRegen(): void {
    // Frame Systems Layer (6 Sep 2026): the per-Munti radius/amount rule
    // above now lives in engine/frameSystems.ts's regenAurasFor, which also
    // returns a Salve Drone's aura for ANY path carrying that system — so
    // the source list is "every living unit projecting at least one aura,"
    // not "every Munti." The best-single-source-in-range rule is unchanged;
    // a Salve Drone standing inside a Munti's aura adds nothing on top.
    const sourcesBySide = new Map<string, { unit: BattleUnit; auras: { radius: number; amount: number }[] }[]>();
    for (const u of this.livingUnits()) {
      const auras = regenAurasFor(u);
      if (!auras.length) continue;
      const list = sourcesBySide.get(u.side) ?? [];
      list.push({ unit: u, auras });
      sourcesBySide.set(u.side, list);
    }
    if (!sourcesBySide.size) return;

    for (const unit of this.livingUnits()) {
      if (unit.kind === "bloom" || unit.currentHp >= unit.maxHp) continue;
      const sources = sourcesBySide.get(unit.side);
      if (!sources) continue;
      let bestHeal = 0;
      for (const src of sources) {
        const dist = chebyshevDistance(src.unit.pos, unit.pos);
        for (const aura of src.auras) {
          if (dist > aura.radius) continue;
          if (aura.amount > bestHeal) bestHeal = aura.amount;
        }
      }
      if (bestHeal > 0) unit.currentHp = Math.min(unit.maxHp, unit.currentHp + bestHeal);
    }
  }

  /**
   * Fieldwright mek track — GDD §6.2 / Data Pack §5: "+15 HP at turn start
   * if the pilot did not move, on any tile" (+8 as a secondary). Wired 6 Sep
   * 2026, the day it was found that data/meks.ts had carried
   * `stationaryHeal` unread since it was written — Lask, Warden's own
   * starting Munti, has a Fieldwright-primary mek and had never once been
   * healed by it.
   *
   * Runs inside environmentStep (the hostile phase's tail), BEFORE the
   * turn-start loop in runHostileTurn zeroes tilesMovedThisTurn — so for a
   * player unit the count is still the one from the turn that just ended,
   * which is precisely the "did not move" the rule asks about. Same slot
   * and same silent, capped-at-maxHp shape as tickMuntiRegen directly
   * above; the two stack (a stationary Fieldwright Munti standing in its
   * own aura is healed by both), since nothing in either doc says otherwise
   * and the Munti regen's own "best single AURA source" rule is about
   * auras, not about every heal in the game.
   *
   * Stabilizer Struts (data/frameSystems.ts, same day) widens "did not
   * move" to "moved at most 1 tile" via stationaryRepairMoveAllowance — 0
   * for everyone else, so the GDD's strict rule is the default.
   */
  private tickStationaryRepair(): void {
    for (const unit of this.livingUnits()) {
      const heal = unit.stationaryHeal;
      if (!heal || unit.currentHp >= unit.maxHp) continue;
      if ((unit.tilesMovedThisTurn ?? 0) > stationaryRepairMoveAllowance(unit)) continue;
      unit.currentHp = Math.min(unit.maxHp, unit.currentHp + heal);
    }
  }

  private checkWinLoss(): boolean {
    if (this.outcome !== "ongoing") return true;
    const turnLimit = this.mission.objectiveParams.turnLimit;
    // !u.npcIncapacitated (Mission 5's rescue-and-recruit bonus objective,
    // 23 Aug 2026): the rescuable NPC is side "player" so the hostile AI
    // targets it like anyone else (real stakes on the rescue — see
    // BattleUnit.npcIncapacitated's own comment), but it is not one of the
    // deploying squad and must never count toward "is anyone still up" —
    // a real squad wiped to zero has to read as a loss even if the NPC is
    // still standing on the board, untouched, waiting to be rescued.
    // !u.isCivilian (Mission 31, 25 Aug 2026): same shape as the
    // npcIncapacitated exclusion right above it, and the same reason — a
    // civilian is side "player" so the hostile AI treats it as a real
    // target, but it is not part of the deploying squad. A wiped real squad
    // has to read as a loss even if every civilian is still standing on the
    // board waiting to be reached.
    const playerAlive = this.units.filter((u) => u.side === "player" && !u.downed && !u.npcIncapacitated && !u.isCivilian);
    const hostileAlive = this.units.filter((u) => u.side === "hostile" && !u.downed);

    if (!playerAlive.length) {
      this.outcome = "loss";
      this.log.push("Loss: all player units downed.");
      return true;
    }

    if (this.mission.objective === "eliminate_all") {
      // House rule #5, NOT in the Data Pack: Maxime's call (22 Aug 2026),
      // after failing Amaranth Mission 1 on the clock while playing
      // carefully — "remove the clock on missions, give player more
      // freedom, xcom doesn't have clocks all the time." eliminate_all no
      // longer fails on turn count; the only way to lose is losing every
      // unit (checked above). objectiveParams.turnLimit is kept on every
      // eliminate_all mission and still shown in the HUD (scenes/Battle.ts)
      // as a target, not a deadline — the Amaranth design doc's points-
      // economy appendix ties a future "finished under X turns" bonus to
      // this same number (Appendix B), so the field stays meaningful even
      // though it no longer ends the mission. hold_zone and extract_unit
      // are deliberately NOT touched here: turns are part of what those
      // objectives *mean* ("hold until turn N", "get out before turn N"),
      // not an arbitrary pressure valve layered on top the way it was for
      // eliminate_all — the same distinction XCOM itself draws between its
      // untimed and timed mission types.
      if (!hostileAlive.length) return this.finishWin();
    } else if (this.mission.objective === "hold_zone") {
      const hold = this.map.holdZone ?? [];
      const holdKeys = new Set(hold.map(coordKey));
      const playerOnHold = playerAlive.some((u) => holdKeys.has(coordKey(u.pos)));
      const hostileOnHold = hostileAlive.some((u) => holdKeys.has(coordKey(u.pos)));
      const holdUntil = this.mission.objectiveParams.holdUntilTurn ?? turnLimit;
      // Fix, 30 Aug 2026 (Maxime: "still failing mission 12 for no aparent
      // reason. it say hold zone I stick ther eand kill only what come
      // close. still mission failed"). Root cause, confirmed via sim log
      // ("Loss: hostiles hold the zone." firing as early as turn 3-11 on
      // Mission 12, which doesn't require anyone to actually hold the zone
      // until turn 10): this branch used to fire from turn 3 on
      // (`this.turn > 2`), completely independent of holdUntilTurn — a
      // number every hold_zone mission's own objectiveParams (and its own
      // build-log comments) already treats as when "hold the line" actually
      // starts. Before that turn, this is a staging fight, not a defense —
      // a single hostile passing through the zone chokepoint while nobody's
      // squad has reached it yet, or has to briefly disengage from the tile
      // to kill something bearing down on it, ended the mission instantly,
      // with the "you needed to already be holding this 7 turns before the
      // brief says so" nowhere communicated to the player. Gated to
      // `this.turn >= holdUntil` instead — same turn holding first starts
      // counting toward a win (see the win check right below) — so a hostile
      // merely passing through before the hold window opens no longer ends
      // the mission; once the window opens, the original "hostiles control
      // it uncontested = you lost the line" rule is unchanged.
      if (this.turn >= holdUntil && hostileOnHold && !playerOnHold) {
        this.outcome = "loss";
        this.log.push("Loss: hostiles hold the zone.");
        return true;
      }
      if (this.turn >= holdUntil && playerOnHold && !hostileOnHold) return this.finishWin();
      if (this.turn > turnLimit) {
        this.outcome = "loss";
        this.log.push("Loss: turn limit reached without holding the zone.");
        return true;
      }
    } else if (this.mission.objective === "extract_unit") {
      // The Last Convoy shape (Mission 31, 25 Aug 2026) — "not everyone
      // gets out" as real design intent, not a guaranteed specific (same
      // flag data/types.ts's extractThreshold comment and Mission 12's own
      // §6a note both carry). Win the instant enough civilians are banked;
      // lose only once the threshold becomes mathematically unreachable —
      // a downed civilian costs the mission nothing by itself, unlike the
      // single-target shape below, where losing the one target IS the loss.
      if (this.mission.civilianSpawns?.length) {
        const total = this.mission.civilianSpawns.length;
        const threshold = this.mission.objectiveParams.extractThreshold ?? total;
        const extracted = this.extractedCivilianIds.size;
        if (extracted >= threshold) return this.finishWin();
        const stillAlive = this.livingUnits().filter((u) => u.isCivilian && !this.extractedCivilianIds.has(u.instanceId)).length;
        const stillPossible = extracted + stillAlive;
        if (stillPossible < threshold) {
          this.outcome = "loss";
          this.log.push(`Loss: too few of the convoy can still reach extraction (${extracted}/${threshold} needed, ${stillPossible} still possible).`);
          return true;
        }
        if (this.turn > turnLimit) {
          this.outcome = "loss";
          this.log.push("Loss: turn limit reached before enough of the convoy got out.");
          return true;
        }
        return false;
      }
      // resolvedExtractUnitId, not the literal configured extractUnitId —
      // see tagExtractionTarget's own comment on why the two can differ.
      const id = this.resolvedExtractUnitId;
      const unit = id ? this.unitById(id) : undefined;
      if (unit?.downed) {
        this.outcome = "loss";
        this.log.push("Loss: the unit to extract was downed.");
        return true;
      }
      if (this.extractedUnitId) return this.finishWin();
      if (this.turn > turnLimit) {
        this.outcome = "loss";
        this.log.push("Loss: turn limit reached before extraction.");
        return true;
      }
    } else if (this.mission.objective === "clear_bloom") {
      // Mission 3's "clean the bloom patch" pass (Maxime, 23 Aug 2026:
      // "making clean the bloom patch the objective of mission 3"). Win the
      // instant no bloom_mat tile remains anywhere on the board. House rule
      // #5's shape, extended to a third objective type: turnLimit stays a
      // bonus-scoring target (Amaranth Appendix B), never a fail line — see
      // data/combatTables.ts's own comment on why a hard clock isn't needed
      // here either. tickBloomRegrowth (environmentStep, below) is the
      // actual countervailing pressure: stall near the edge picking off
      // Crawlmass and the patch grows back on its own clock, so waiting was
      // never a free win even without a turn cap.
      if (!this.hasBloomMat()) return this.finishWin();
    } else if (this.mission.objective === "survive_n_turns") {
      // Survive N Turns (Mission 9 "Cut Off," 25 Aug 2026) — see
      // data/types.ts's CampaignMission.objective comment for the full
      // reasoning. Squad wipe already returned above (`!playerAlive.length`)
      // before this branch is ever reached, so reaching the turn count at
      // all means winning it — no separate loss-on-timeout branch the way
      // hold_zone/extract_unit have, because there is no other way to lose
      // this objective than the wipe already checked for every objective.
      if (this.turn >= turnLimit) return this.finishWin();
    } else if (this.mission.objective === "contested_landing") {
      // Contested Landing (Mission 15 "Landfall," 25 Aug 2026) — see
      // data/types.ts's CampaignMission.objective comment for the design
      // conversation. Byte-for-byte the same win check as eliminate_all,
      // deliberately: the "opposed drop" identity lives entirely in the
      // mission's own map/wave design (hostiles already at the deploy
      // zone at turn 1), not in a different win condition, and house rule
      // #5's no-turn-limit-fail treatment applies here too — a chaotic
      // opening several turns long is the whole point, not something a
      // clock should be able to cut short.
      if (!hostileAlive.length) return this.finishWin();
    } else if (this.mission.objective === "protect_asset") {
      // Protect Asset (Mission 22 "Ash on the Water," 25 Aug 2026) — see
      // data/types.ts's CampaignMission.objective comment for the full
      // design, and tickAssetDamage (environmentStep) for where assetHp
      // actually moves. This branch only ever READS assetHp — same split
      // as clear_bloom/tickBloomRegrowth (the tick mutates board/asset
      // state once per turn, checkWinLoss reads the result on every call).
      // House rule #5 shape again: reaching turnLimit is a WIN as long as
      // the ship is still standing, never a timeout loss on its own — the
      // real, and only, loss condition is assetHp hitting 0.
      if (this.assetHp <= 0) {
        this.outcome = "loss";
        this.log.push(`Loss: the ${this.assetName} has taken critical damage.`);
        return true;
      }
      if (!hostileAlive.length) return this.finishWin();
      if (this.turn > turnLimit) return this.finishWin();
    }
    return false;
  }

  /** True if any bloom_mat tile remains anywhere on the board — the clear_bloom objective's own win check, and tickBloomRegrowth's early-exit when the patch is already gone. */
  private hasBloomMat(): boolean {
    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        if (this.map.tiles[y][x] === "bloom_mat") return true;
      }
    }
    return false;
  }

  private finishWin(): boolean {
    // Fire objective_complete events (Mission 3's scripted extraction
    // failure) BEFORE finalizing — the mission is still mechanically won;
    // the wipe is a scripted consequence layered on top, per GDD §10.4.
    const fired = evaluateObjectiveComplete(this.mission.events, this.turn, this.eventState);
    for (const ev of fired) this.applyEventAction(ev.action);
    this.outcome = "win";
    this.log.push("Win: objective complete.");
    return true;
  }
}
