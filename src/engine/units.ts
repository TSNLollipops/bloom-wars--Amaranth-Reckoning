// src/engine/units.ts
// Runtime unit instances + effective-stat calculation (Data Pack §5.1's
// worked example, order of application: base -> tier -> mek).
import type { Coord, MekArchetype, Path, PilotRecord, Tier } from "../data/types";
import { UNIT_ARCHETYPES, ALL_HOSTILE_MECHS } from "../data/units";
import { MEK_TRACK_EFFECTS } from "../data/meks";
import { findPilot, findMek } from "../data/pilotRegistry";
import { BLOOM } from "../data/bloom";
import { TIERS, MAX_ACTIONS_PER_TURN, SENSOR_SWEEP_CHARGES_PER_MISSION, MISSILE_CHARGES_PER_MISSION } from "../data/combatTables";
import { IMPACT_LANCE_ATK_BONUS, MISSILE_GRANT_ABILITY, type WeaponBranchId } from "../data/weaponBranches";

export type BattleUnitKind = "pilot" | "mech" | "bloom";
export type Side = "player" | "hostile";

export interface StatusEffect {
  kind: "acid_dot" | "debuff_attack";
  turnsRemaining: number;
  magnitude: number;
}

export interface BattleUnit {
  instanceId: string;
  side: Side;
  kind: BattleUnitKind;
  archetypeId: string; // UnitArchetype id (pilot/mech) or BloomArchetype id
  pilotId?: string; // pilot only — links back to the campaign roster
  displayName: string;
  pos: Coord;

  // mech-shape (pilot | mech)
  path?: Path;
  currentHp: number;
  maxHp: number;
  effectiveAttack: number;
  effectiveDefense: number;
  moveRange: number;
  attackRange: [number, number];
  vision: number;
  canCounter: boolean;
  counterMaxRange: number;
  abilities: string[];
  chassis?: "bipedal" | "centauroid" | "bipedal_vibrissal";
  // Weapon Branch Point System (27 Aug 2026, data/weaponBranches.ts) — the
  // branch this unit was created with (baked in at createPlayerUnit, same
  // "doesn't change mid-mission" treatment as tier/mek below), read
  // straight off at the point each branch's effect applies: engine/
  // combat.ts's resolveMechAttack (Rail Lance) and engine/mission.ts's
  // resolveAttack/repairUnit (Grinder Claw, Rapid Response). Undefined for
  // every unit that isn't a pilot with a branch equipped — hostile mechs,
  // Bloom, rescued NPCs, civilians, and any pilot who hasn't bought/
  // equipped a branch all read as "plain default weapon."
  weaponBranchId?: WeaponBranchId;
  // Gear-tier pass (sprites/decor, 23 Aug 2026): the raw Tier letter, kept
  // alongside the already-tier-adjusted effective* stats instead of being
  // discarded once TIERS[tier] has been baked into them. Only pilots and
  // hostile mechs carry one — createBloomUnit never sets this, since "gear
  // tier" isn't a Bloom concept and scenes/Battle.ts's pip renderer treats
  // a missing tier as "draw nothing" rather than guessing G.
  tier?: Tier;

  // bloom-shape
  endurance?: number;
  maxEndurance?: number;
  vitality?: number;
  collapsed?: boolean;
  attackPower?: number;
  burrowed?: boolean;
  revealedUntilTurn?: number;

  // Tank shield house rule (data/combatTables.ts TANK_SHIELD_CAPACITY) —
  // mech-shape units only; left undefined/0 on Bloom-shape units.
  shield?: number;
  maxShield?: number;
  tookDamageThisCycle?: boolean;

  // shared turn state
  downed: boolean;
  // Two-action-per-turn house rule (data/combatTables.ts
  // MAX_ACTIONS_PER_TURN, Maxime, 22 Aug 2026), replacing the old
  // movedThisTurn/actedThisTurn booleans. Move and Repair cost 1 and don't
  // end the turn; Attack zeroes this out entirely regardless of value.
  actionsRemaining: number;
  // Overwatch / reaction fire house rule (Maxime, 23 Aug 2026) — set only
  // by engine/mission.ts's enterOverwatch(), which refuses any non-player
  // unit, so this is never true on a hostile: hostile-side overwatch is
  // deliberately out of scope this pass. Cleared either by firing the held
  // shot or by the owner's next turn starting. See that file's overwatch
  // block for the full rule set, and for what else is excluded and why.
  overwatch?: boolean;

  // ---- ability-depth pass (Maxime, 23 Aug 2026), system 3 of 3 after fog
  // of war (f2e04e4) and overwatch (47ab304). Every one of these is written
  // ONLY by an engine/mission.ts verb — see that file's ability block for
  // the rules, and data/abilities.ts for the design reasoning. All optional
  // so the synthetic BattleUnit literal in
  // engine/__tests__/testHelpers.ts stays valid unchanged; the three
  // factories below still initialise abilityCooldowns explicitly.

  /**
   * Meeps abil_ambush / Munti abil_screen. This unit is not visible to the
   * opposing side at all — engine/ai.ts's isVisibleTo returns false for it
   * in exactly the same one-line way it already does for a burrowed Bloom,
   * so the hostile AI's reflexive and pack tiers cannot target it, path to
   * it, or count it as a threat. Broken the instant this unit attacks
   * (resolveAttack). abil_screen's concealment is still cleared unconditionally
   * at the start of the covered unit's own next turn, same loop `overwatch`
   * clears in. abil_ambush's concealment is the one exception to that clear —
   * see stealthTurnsRemaining directly below.
   */
  concealed?: boolean;
  /**
   * Meeps abil_ambush's cloak clock (stealth cloak redesign, 30 Aug 2026 —
   * Maxime: "stealth cloak 3 turn, can move whilestealth. can attack while
   * stealth. does 2x dmg after exiting stealth. its to give sweep a pvp use
   * too and make ambush something usefull in game"). Set to
   * AMBUSH_STEALTH_DURATION (data/combatTables.ts) by Mission.ambush() and
   * decremented once per round in the same end-of-hostile-phase loop that
   * used to unconditionally clear `concealed` for every posture — while this
   * is > 0, `concealed` survives that loop instead of being blanket-cleared,
   * which is what turns Ambush from a single reactive held-shot into a real
   * multi-turn cloak: the unit moves and attacks completely normally on its
   * own turns, fully hidden, until the clock runs out or it attacks (either
   * one clears both this and `concealed` together — see resolveAttack).
   * Undefined for every unit that has never ambushed, and for abil_screen's
   * concealment, which is NOT this field and keeps its original one-round
   * shape untouched. Read by resolveAttack to award the decloak damage
   * bonus (AMBUSH_DECLOAK_DAMAGE_MULTIPLIER) on the specific attack that
   * breaks an active cloak, and NOT for a screen-concealed unit's attack,
   * which has no such bonus.
   */
  stealthTurnsRemaining?: number;
  /**
   * Tank abil_interdict. This unit is holding ground: any hostile that
   * FINISHES a move within INTERDICT_RADIUS of it, and that it can see,
   * loses its remaining actions. Cleared at the start of its own next turn.
   */
  braced?: boolean;
  /**
   * Meeps abil_taunt (25 Aug 2026). Every hostile targeting function that
   * is choosing among multiple already-visible targets picks this unit
   * first — see engine/ai.ts's taunting-check at the top of
   * reflexiveDecision/sharedPackTarget/mechReflexiveDecision/
   * emergentDecision. Does not grant visibility on its own; a hostile that
   * cannot see this unit is unaffected. Also roots every hostile it
   * redirects (30 Aug 2026 addition — see ai.ts's own "ROOT/LOCK addition"
   * header): a redirected hostile attacks in place or does nothing, never
   * moves. Cleared at the start of this unit's own next turn, same loop as
   * concealed/braced. No-charge/reusable as of 30 Aug 2026 (data/abilities.ts,
   * engine/mission.ts's canTaunt/taunt) — this flag's own shape and reset
   * loop are unchanged by that redesign, only what gates setting it.
   */
  taunting?: boolean;
  /**
   * abilityId -> the earliest turn number that ability may be used again.
   * Absent, or a value <= the current turn, means ready. Nothing uses this
   * today — abil_sensor_sweep was the one cooldown'd ability and moved to
   * a per-mission charge count instead (23 Aug 2026, see
   * sensorSweepUsesRemaining below) — but it's a map rather than a named
   * field, kept as infrastructure for the next ability that wants a
   * turn-based cooldown rather than a mission-spend budget.
   */
  abilityCooldowns?: Record<string, number>;
  /** Munti abil_screen, once per mission — deliberately mirrors usedEvacThisMission's shape rather than folding into abilityCooldowns, because "spent for good" is a different fact from "not ready yet." */
  usedScreenThisMission?: boolean;
  /**
   * Reeps abil_sensor_sweep, SENSOR_SWEEP_CHARGES_PER_MISSION uses per
   * mission (data/combatTables.ts) — a spendable budget, not a cooldown,
   * per Maxime's own framing ("two charge each mission, every mission").
   * Undefined reads as a full, unspent budget (see canSensorSweep /
   * sensorSweep in engine/mission.ts), so every factory below still sets it
   * explicitly for the same reason they set abilityCooldowns/
   * usedScreenThisMission — a Bloom or hostile mech can never use it, but
   * the field stays uniform across every BattleUnit regardless of side.
   */
  sensorSweepUsesRemaining?: number;
  /**
   * Reeps abil_missile (26 Aug 2026, SOFT pass — see data/abilities.ts's
   * own comment). MISSILE_CHARGES_PER_MISSION uses per mission
   * (data/combatTables.ts), same per-unit-budget shape as
   * sensorSweepUsesRemaining directly above — NOT squad-shared the way
   * fireSupportChargesRemaining (engine/mission.ts, lives on Mission
   * itself) is. Undefined reads as a full, unspent budget, same
   * convention as every other charge field here. Named UsesRemaining, not
   * ChargesRemaining, for the same reason sensorSweepUsesRemaining is —
   * Mission's own accessor method is missileChargesRemaining(unitId); the
   * field and the method deliberately don't share a name.
   */
  missileUsesRemaining?: number;

  // ---- Mission 5 rescue-and-recruit pass (Maxime, 23 Aug 2026: "mission 5
  // is rescue the downed pilot... giving us a free new pilot") — see
  // createRescuableNpcUnit below and engine/mission.ts's canRescue/
  // rescueUnit/rescueOutcome, and campaignState.ts's generateRandomRescuedPilot.

  /**
   * True only on the one synthetic unit createRescuableNpcUnit produces.
   * `side: "player"` so the hostile AI targets it exactly like any other
   * player unit (that's the point — real stakes on the rescue) and so
   * player-side fog-of-war code doesn't have to special-case it, but it is
   * NOT one of the deploying squad: checkWinLoss's playerAlive filter
   * explicitly excludes it (a wiped real squad with the NPC still standing
   * must still read as a loss), it is never selectable in scenes/Battle.ts,
   * and engine/mission.ts's moveUnit/attack refuse it as an actor the same
   * way they refuse a downed unit. Cleared implicitly the instant the unit
   * is rescued — rescueUnit() removes it from `Mission.units` outright
   * rather than flipping a flag, since a picked-up NPC has nothing further
   * to render or be attacked as on the board; see BattleUnit.carryingRescueId
   * below for what tracks it after that point.
   */
  npcIncapacitated?: boolean;
  /**
   * Set on the RESCUER, not the NPC, the instant rescueUnit() succeeds —
   * the rescued unit's own instanceId, kept only so a debrief/summary could
   * look it up if it ever needed to. While set: this unit cannot Attack
   * (engine/mission.ts's attack() refuses it) — carrying someone out is the
   * whole reason to be vulnerable right now, the same trade every other
   * ability-depth verb makes, just enforced as a standing state instead of
   * a one-turn cost. Cleared only by checkRescueExtraction() succeeding
   * (reaching an exit tile) or the carrier itself going down (handleDowned
   * marks the rescue failed at that point; the flag itself is left in place
   * on the now-downed unit since nothing reads it again after that).
   */
  carryingRescueId?: string;

  /**
   * Mission 31 "The Last Convoy" (25 Aug 2026) — see createCivilianUnit
   * below and data/types.ts's CampaignMission.civilianSpawns for the full
   * design. side:"player" (a real, hostile-attackable target — that's the
   * point) but excluded from three places npcIncapacitated already had to
   * be excluded from, for the same underlying reason ("on the board, at
   * risk, but not part of the deploying squad"): checkWinLoss's playerAlive
   * tally (a wiped real squad with civilians still standing is still a
   * loss), scenes/Battle.ts's click-to-select guard (never player-
   * controlled), and — via actionsRemaining being permanently 0, the exact
   * trick createRescuableNpcUnit already uses — the headless sim's
   * player-autoplay loop (sim/run.ts skips any unit with actionsRemaining
   * <= 0 before it ever asks decidePlayerAiAction for a move). A civilian
   * moves only through engine/mission.ts's runCivilianStep(), once per full
   * turn cycle, driven by engine/ai.ts's decideCivilianAction — never
   * through the normal action-economy system, which is why actionsRemaining
   * never needs to be anything but 0.
   */
  isCivilian?: boolean;

  /**
   * Single-named-pilot extract_unit missions only (5, 10, 11, 17, 23, 26 —
   * objectiveParams.extractUnitId, NOT Mission 31's civilianSpawns, which
   * uses isCivilian above and deliberately stays "real stakes, the hostile
   * AI targets them like anyone else" per Maxime's own call on that
   * mission). Set once, in Mission's constructor (tagExtractionTarget), on
   * whichever player unit's instanceId matches extractUnitId.
   *
   * 30 Aug 2026 — Maxime, after the enemy-roam fallback's campaign sweep
   * found mission_amaranth_26's stranded extraction target (Okafor,
   * deliberately immobile by mission design) dying to a roaming Undertow
   * before the player could reach her: "for the rescue, make it so enemy
   * ignore rescue. like the save the civilian mission in XCOM." This flag
   * is that ignore switch — engine/ai.ts's visibleEnemiesOf and
   * sharedPackTarget both filter it out before a reflexive or pack-tier
   * hostile ever considers a target, so she can never be selected to
   * attack or chase, full stop, the same way XCOM's own civilians simply
   * aren't valid enemy targets. Not a vision/concealment trick (she's
   * still visible to the player, still on the fog map, still exactly as
   * fragile to anything the PLAYER does) — this only ever changes what a
   * hostile is willing to shoot at.
   */
  isExtractionTarget?: boolean;

  chargedThisMove: boolean;
  statusEffects: StatusEffect[];
  usedEvacThisMission: boolean;
  spriteKey: string;
}

function mekStatBonus(mek: MekArchetype | undefined): { attack: number; defense: number; hp: number; vision: number } {
  if (!mek) return { attack: 0, defense: 0, hp: 0, vision: 0 };
  const out = { attack: 0, defense: 0, hp: 0, vision: 0 };
  const apply = (track: string, isPrimary: boolean) => {
    const eff = (MEK_TRACK_EFFECTS as unknown as Record<string, { primary?: Record<string, number | boolean>; secondary?: Record<string, number | boolean> }>)[track];
    if (!eff) return;
    const slice = isPrimary ? eff.primary : eff.secondary;
    if (!slice) return;
    out.attack += Number(slice.attack ?? 0);
    out.defense += Number(slice.defense ?? 0);
    out.hp += Number(slice.hp ?? 0);
    out.vision += Number(slice.vision ?? 0);
  };
  apply(mek.primary, true);
  if (mek.secondary) apply(mek.secondary, false);
  return out;
}

let instanceCounter = 0;
function nextInstanceId(prefix: string): string {
  instanceCounter += 1;
  return `${prefix}_${instanceCounter}`;
}

/**
 * Weapon Branch Point System — additive stat term, Data Pack §5.1's own
 * order of application (base -> tier -> mek), just one more term added on
 * the end (base -> tier -> mek -> branch). Only Impact Lance touches a raw
 * stat this pass; Grinder Claw/Missiles/Rail Lance/Rapid Response are all
 * behavioral (heal-on-hit, an ability grant, a conditional defense-ignore,
 * a repair-range change) and are read straight off `weaponBranchId` at the
 * point they apply, in engine/mission.ts and engine/combat.ts — they do
 * NOT modify effectiveAttack/effectiveDefense here, so this function stays
 * a plain number, not a bonus object, unlike mekStatBonus above.
 */
function weaponBranchAttackBonus(branchId: WeaponBranchId | undefined): number {
  if (branchId === "meeps_impact_lance") return IMPACT_LANCE_ATK_BONUS;
  return 0;
}

/** The ability id a branch grants on top of the archetype's own list, if any — currently only Missiles (abil_missile, see data/weaponBranches.ts's own header for why the engine side of that ability already existed and just needed a real owner). */
function weaponBranchGrantedAbility(branchId: WeaponBranchId | undefined): string | undefined {
  if (branchId === "reeps_missiles") return MISSILE_GRANT_ABILITY;
  return undefined;
}

/**
 * `overrides`, added for the transporter-pad squad-selection pass (22 Aug
 * 2026): when given, `overrides.pilot`/`overrides.mek` are used instead of
 * resolving through data/pilotRegistry.ts's static findPilot()/findMek().
 * This is what lets a caller (engine/mission.ts's DeployRosterEntry path)
 * deploy either a CampaignState's live, campaign-persistent pilot/mek copy
 * (tier upgrades, mek secondaries) or a generated recruit's own record —
 * neither of which the static, build-time pilotRegistry can ever resolve
 * by id (see engine/campaignState.ts's own header: "engine/units.ts's
 * createPlayerUnit() still resolves pilots through... findPilot(), which
 * has no way to see a CampaignState's generated recruits" — this closes
 * that gap). Omitting `overrides` keeps the old, registry-only behavior
 * exactly as it was, so every existing call site (tests, npm run sim, and
 * Mission's own no-override fallback) is unaffected.
 */
export function createPlayerUnit(pilotId: string, pos: Coord, overrides?: { pilot?: PilotRecord; mek?: MekArchetype }): BattleUnit {
  const pilot = overrides?.pilot ?? findPilot(pilotId);
  if (!pilot) throw new Error(`Unknown pilot id: ${pilotId}`);
  const archetype = UNIT_ARCHETYPES[pilot.archetypeId];
  if (!archetype) throw new Error(`Unknown archetype id: ${pilot.archetypeId}`);
  const tier = TIERS[pilot.tier];
  const mek = overrides?.mek ?? findMek(pilot.mekId);
  const mekBonus = mekStatBonus(mek);
  // Weapon Branch Point System — read straight off the campaign-persistent
  // PilotRecord field, same "baked in at creation, doesn't change
  // mid-mission" treatment as tier/mek above. Loosely typed as
  // WeaponBranchId | undefined via cast rather than tightening
  // PilotRecord.equippedWeaponBranch's own type — keeps data/types.ts free
  // of an import from data/weaponBranches.ts (which itself imports Path
  // from types.ts), avoiding a circular dependency for no real benefit.
  const weaponBranchId = pilot.equippedWeaponBranch as WeaponBranchId | undefined;
  const branchAttackBonus = weaponBranchAttackBonus(weaponBranchId);
  const grantedAbility = weaponBranchGrantedAbility(weaponBranchId);

  const effectiveAttack = archetype.baseAttack + (tier.attack - 100) + mekBonus.attack + branchAttackBonus;
  const effectiveDefense = archetype.baseDefense + (tier.defense - 100) + mekBonus.defense;
  const maxHp = archetype.baseHp + (tier.hp - 100) + mekBonus.hp;
  const vision = archetype.vision + mekBonus.vision;
  const moveRange = archetype.moveRange + tier.move;
  // Never mutate the shared archetype.abilities array — copy, then append
  // if this branch grants one (Missiles). Every other unit factory in this
  // file still assigns archetype.abilities directly since none of them
  // ever need to add to it.
  const abilities = grantedAbility ? [...archetype.abilities, grantedAbility] : archetype.abilities;

  return {
    instanceId: pilot.id, // pilots keep their stable roster id on the board
    side: "player",
    kind: "pilot",
    archetypeId: archetype.id,
    pilotId: pilot.id,
    displayName: pilot.displayName,
    pos,
    path: archetype.path,
    currentHp: maxHp,
    maxHp,
    effectiveAttack,
    effectiveDefense,
    moveRange,
    attackRange: archetype.attackRange,
    vision,
    canCounter: archetype.canCounter,
    counterMaxRange: archetype.counterMaxRange,
    abilities,
    chassis: archetype.chassis,
    weaponBranchId,
    tier: pilot.tier,
    shield: 0,
    maxShield: 0,
    tookDamageThisCycle: false,
    downed: false,
    actionsRemaining: MAX_ACTIONS_PER_TURN,
    chargedThisMove: false,
    statusEffects: [],
    abilityCooldowns: {},
    usedEvacThisMission: false,
    usedScreenThisMission: false,
    sensorSweepUsesRemaining: SENSOR_SWEEP_CHARGES_PER_MISSION,
    missileUsesRemaining: MISSILE_CHARGES_PER_MISSION,
    spriteKey: archetype.spriteKey,
  };
}

export function createHostileMechUnit(hostileMechId: string, pos: Coord): BattleUnit {
  const mech = ALL_HOSTILE_MECHS[hostileMechId];
  if (!mech) throw new Error(`Unknown hostile mech id: ${hostileMechId}`);
  // "All four use the standard bipedal archetypes" — Data Pack §9.
  const archetypeId = `arch_${mech.path}_bipedal`;
  const archetype = UNIT_ARCHETYPES[archetypeId];
  const tier = TIERS[mech.tier];

  const effectiveAttack = archetype.baseAttack + (tier.attack - 100);
  const effectiveDefense = archetype.baseDefense + (tier.defense - 100);
  const maxHp = archetype.baseHp + (tier.hp - 100);

  return {
    instanceId: nextInstanceId(hostileMechId),
    side: "hostile",
    kind: "mech",
    archetypeId,
    displayName: mech.displayName, // "Unmarked Mech" — GDD §10.1 quiet-critique discipline
    pos,
    path: archetype.path,
    currentHp: maxHp,
    maxHp,
    effectiveAttack,
    effectiveDefense,
    moveRange: archetype.moveRange + tier.move,
    attackRange: archetype.attackRange,
    vision: archetype.vision,
    canCounter: archetype.canCounter,
    counterMaxRange: archetype.counterMaxRange,
    abilities: archetype.abilities,
    chassis: archetype.chassis,
    tier: mech.tier,
    shield: 0,
    maxShield: 0,
    tookDamageThisCycle: false,
    downed: false,
    actionsRemaining: MAX_ACTIONS_PER_TURN,
    chargedThisMove: false,
    statusEffects: [],
    abilityCooldowns: {},
    usedEvacThisMission: false,
    usedScreenThisMission: false,
    sensorSweepUsesRemaining: SENSOR_SWEEP_CHARGES_PER_MISSION,
    missileUsesRemaining: MISSILE_CHARGES_PER_MISSION,
    spriteKey: archetype.spriteKey,
  };
}

/**
 * Mission 5's rescue-and-recruit bonus objective (BattleUnit.npcIncapacitated's
 * own comment has the full rules). Not resolved through data/pilotRegistry.ts
 * or UNIT_ARCHETYPES — this unit has no PilotRecord and no mek; it exists
 * only as board state until rescued, at which point it is deleted outright
 * (engine/mission.ts's rescueUnit()) and a REAL PilotRecord is minted
 * separately, after the mission ends, by campaignState.ts's
 * generateRandomRescuedPilot.
 *
 * Stat choices — "at real risk, not helpless":
 *   - `path: "meeps"` is NOT a narrative claim about who this pilot turns
 *     out to be (generateRandomRescuedPilot rolls that fresh, independently,
 *     once the rescue succeeds) — it exists purely so this unit resolves
 *     through the same combat formulas as everyone else. resolveMechAttack
 *     (engine/combat.ts) throws outright on a defender with no `path`, and
 *     giving it "meeps" happens to also grant MEEPS_DODGE_CHANCE's house
 *     rule, which reads as a reasonable "hard to finish off" break for a
 *     downed pilot rather than a design accident.
 *   - `effectiveDefense: 100` (25 Aug 2026, was 70 — see below) and
 *     `currentHp/maxHp: 70` (was 50), still clearly under a G-tier pilot's
 *     ~100-115 — exposed, not paper-thin, but no longer a coin-flip
 *     one-shot. A hostile that reaches them can still plausibly down them
 *     in two hits; it is not guaranteed in one.
 *   - `vision: 0` so this unit contributes nothing to the player side's fog
 *     of war (engine/ai.ts's unitsVisibleToSide sums every living player
 *     unit's vision as an observer) — an incapacitated pilot isn't feeding
 *     the squad intel.
 *   - `moveRange: 0`, `attackRange: [0, 0]`, `canCounter: false`,
 *     `abilities: []` — cannot move, attack, or counter even if some future
 *     code path ever tried; defense-in-depth alongside the explicit
 *     npcIncapacitated guards in engine/mission.ts.
 *
 * 25 Aug 2026 revision (Maxime, after a real Mission 5 playtest: "couldnt
 * save the downed pilot. he got completely shredded fast"): the original
 * `effectiveDefense: 70` ("ten points under baseline") undersold its own
 * bite. Damage in this engine scales by `100 / effectiveDefense`
 * (engine/combat.ts's `bloomDamage`), not a flat subtraction — 70 defense
 * is a 1.43x damage-TAKEN multiplier, not a 10% one. Combined with
 * Mission 5's own wave layout (one of the map's three enemy spawn tiles
 * sits 3 tiles from the NPC's spawn point, and the wave's round-robin
 * placement puts a Splitfang and two Crawlmass right there), a single
 * un-dodged Splitfang hit alone did ~54 damage against 50 max HP — a
 * near-certain turn-1 kill before the player's own squad, deploying on
 * the opposite side of a 22-wide map, could possibly intervene. Fixed by
 * bringing defense up to the real-pilot baseline (removes the damage
 * amplification entirely) and giving HP a real but modest bump — not by
 * touching the map, the wave, or the AI's targeting priority, which
 * remain live options if this alone doesn't hold up in play (Maxime:
 * "try 2 first, then if that wont work, do 1").
 */
export function createRescuableNpcUnit(pos: Coord, displayName: string): BattleUnit {
  return {
    instanceId: nextInstanceId("npc_rescue"),
    side: "player",
    kind: "pilot",
    archetypeId: "npc_rescuable", // not a real UnitArchetype id — never resolved through UNIT_ARCHETYPES; see this function's own header comment
    displayName,
    pos,
    path: "meeps",
    currentHp: 70,
    maxHp: 70,
    effectiveAttack: 0,
    effectiveDefense: 100,
    moveRange: 0,
    attackRange: [0, 0],
    vision: 0,
    canCounter: false,
    counterMaxRange: 0,
    abilities: [],
    chassis: "bipedal",
    shield: 0,
    maxShield: 0,
    tookDamageThisCycle: false,
    downed: false,
    npcIncapacitated: true,
    actionsRemaining: 0,
    chargedThisMove: false,
    statusEffects: [],
    abilityCooldowns: {},
    usedEvacThisMission: false,
    usedScreenThisMission: false,
    sensorSweepUsesRemaining: SENSOR_SWEEP_CHARGES_PER_MISSION,
    missileUsesRemaining: MISSILE_CHARGES_PER_MISSION,
    spriteKey: "shape_npc_downed",
  };
}

/**
 * Mission 31 "The Last Convoy" (25 Aug 2026) — civilian evacuation, full
 * escort AI (Maxime: "go ham. 3, the game is meant to feel alive," picked
 * over a version where the player walks each civilian to the exit
 * step-by-step). Not resolved through data/pilotRegistry.ts or
 * UNIT_ARCHETYPES, same reasoning as createRescuableNpcUnit right above:
 * this unit has no PilotRecord and no mek, it exists only as board state
 * for the length of this one mission.
 *
 * Stat choices, "at real risk, genuinely mobile":
 *   - `path: "meeps"`, same reason as createRescuableNpcUnit — resolveMechAttack
 *     throws on a defender with no `path`, and this happens to also grant
 *     MEEPS_DODGE_CHANCE, a reasonable "hard to finish off, not impossible"
 *     break for someone who isn't a trained pilot.
 *   - `effectiveDefense: 85` (below the 100 baseline every real pilot/mech
 *     starts from) — per createRescuableNpcUnit's own 25 Aug revision note,
 *     damage-taken scales as 100/effectiveDefense, so this is a real ~1.18x
 *     damage-taken multiplier, not a cosmetic ten points under par. A
 *     civilian is meant to be genuinely at risk — "not everyone gets out"
 *     has to be a live possibility, not a scripted certainty (see
 *     data/types.ts's objectiveParams.extractThreshold comment) — while
 *     still being survivable with real escort play, not a coin flip.
 *   - `currentHp/maxHp: 45` — noticeably under a G-tier pilot's ~100-115,
 *     same spirit as the defense choice above.
 *   - `moveRange: 4` — Reeps/Munti-class mobility (data/units.ts), not
 *     Tank-slow — a fleeing civilian needs real legs, this isn't a rescue
 *     that has to be carried.
 *   - `attackRange: [0, 0]`, `canCounter: false`, `abilities: []` — cannot
 *     attack or counter under any code path, defense-in-depth alongside
 *     engine/ai.ts's decideCivilianAction never producing an attackTargetId
 *     for one of these in the first place.
 *   - `vision: 3` — enough to notice a threat and flee it
 *     (decideCivilianAction's own isVisibleTo check), not omniscient.
 */
export function createCivilianUnit(pos: Coord, displayName: string): BattleUnit {
  return {
    instanceId: nextInstanceId("civilian"),
    side: "player",
    kind: "pilot",
    archetypeId: "npc_civilian", // not a real UnitArchetype id — never resolved through UNIT_ARCHETYPES
    displayName,
    pos,
    path: "meeps",
    currentHp: 45,
    maxHp: 45,
    effectiveAttack: 0,
    effectiveDefense: 85,
    moveRange: 4,
    attackRange: [0, 0],
    vision: 3,
    canCounter: false,
    counterMaxRange: 0,
    abilities: [],
    chassis: "bipedal",
    shield: 0,
    maxShield: 0,
    tookDamageThisCycle: false,
    downed: false,
    isCivilian: true,
    actionsRemaining: 0,
    chargedThisMove: false,
    statusEffects: [],
    abilityCooldowns: {},
    usedEvacThisMission: false,
    usedScreenThisMission: false,
    sensorSweepUsesRemaining: SENSOR_SWEEP_CHARGES_PER_MISSION,
    missileUsesRemaining: MISSILE_CHARGES_PER_MISSION,
    spriteKey: "shape_civilian",
  };
}

export function createBloomUnit(bloomArchetypeId: string, pos: Coord, opts?: { burrowed?: boolean }): BattleUnit {
  const arch = BLOOM[bloomArchetypeId];
  if (!arch) throw new Error(`Unknown Bloom archetype id: ${bloomArchetypeId}`);
  return {
    instanceId: nextInstanceId(bloomArchetypeId),
    side: "hostile",
    kind: "bloom",
    archetypeId: arch.id,
    displayName: arch.displayName,
    pos,
    currentHp: arch.endurance + arch.vitality,
    maxHp: arch.endurance + arch.vitality,
    effectiveAttack: 0,
    effectiveDefense: 100,
    moveRange: arch.moveRange,
    attackRange: arch.attackRange,
    vision: arch.vision,
    canCounter: false,
    counterMaxRange: 0,
    abilities: [],
    endurance: arch.endurance,
    maxEndurance: arch.endurance,
    vitality: arch.vitality,
    collapsed: arch.endurance === 0,
    attackPower: arch.attackPower,
    burrowed: !!opts?.burrowed,
    downed: false,
    actionsRemaining: MAX_ACTIONS_PER_TURN,
    chargedThisMove: false,
    statusEffects: [],
    abilityCooldowns: {},
    usedEvacThisMission: false,
    usedScreenThisMission: false,
    sensorSweepUsesRemaining: SENSOR_SWEEP_CHARGES_PER_MISSION,
    missileUsesRemaining: MISSILE_CHARGES_PER_MISSION,
    spriteKey: arch.spriteKey,
  };
}
