// src/engine/units.ts
// Runtime unit instances + effective-stat calculation (Data Pack §5.1's
// worked example, order of application: base -> tier -> mek).
import type { Coord, MekArchetype, Path, PilotRecord, Tier } from "../data/types";
import { UNIT_ARCHETYPES, ALL_HOSTILE_MECHS } from "../data/units";
import { MEK_TRACK_EFFECTS } from "../data/meks";
import { findPilot, findMek } from "../data/pilotRegistry";
import { BLOOM } from "../data/bloom";
import { TIERS, MAX_ACTIONS_PER_TURN, SENSOR_SWEEP_CHARGES_PER_MISSION, MISSILE_CHARGES_PER_MISSION } from "../data/combatTables";
import { IMPACT_LANCE_ATK_BONUS, MISSILE_GRANT_ABILITY, SCATTERSHOT_PISTOLS_ATTACK_RANGE, type WeaponBranchId } from "../data/weaponBranches";
import { SEND_OFF_DEFENSE_BONUS } from "../data/socialActions";

export type BattleUnitKind = "pilot" | "mech" | "bloom";
export type Side = "player" | "hostile";

/**
 * seal_borrowed_authority (Simulacrum/The Stolen Seal, Vault Phase 2 slice
 * 6, 3 Sep 2026) — every on-hit-effect KIND this engine has, across BOTH
 * tables: data/bloom.ts's BLOOM_ON_HIT_EFFECTS (acid_dot, debuff_attack,
 * knockback — "none" excluded, it isn't a real effect to copy) and
 * data/weaponBranches.ts's MECH_ON_HIT_EFFECTS (stun). Deliberately its own
 * union rather than reusing StatusEffect['kind'] below: that one excludes
 * "knockback" on purpose (knockback is instant repositioning, not a ticking
 * status with a magnitude/turnsRemaining the way acid_dot/debuff_attack/
 * stun are — see StatusEffect's own comment), but Simulacrum's ability can
 * copy knockback too, so it needs the broader four-kind set.
 */
export type OnHitEffectKind = "acid_dot" | "debuff_attack" | "knockback" | "stun";

export interface StatusEffect {
  // "stun" added 3 Sep 2026 alongside the mech->Bloom on-hit effects engine
  // (engine/turnManager.ts's applyMechOnHitEffect) — Shock Claws' own
  // effect, magnitude unused (there's no "how much" for a stun the way
  // acid_dot/debuff_attack have one; kept on the shared shape rather than
  // making it optional so every StatusEffect literal stays uniform).
  kind: "acid_dot" | "debuff_attack" | "stun";
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
  // Send-Off tactical payoff (2 Sep 2026) — true only for the one pilot who
  // was sent off in the Hub right before this mission launched (baked in at
  // createPlayerUnit, consumed for the rest of the mission the same
  // "doesn't change mid-mission" way weaponBranchId is). See data/
  // socialActions.ts's SEND_OFF_DEFENSE_BONUS for the number this actually
  // grants and scenes/Battle.ts's resolveDeployRoster for where the flag on
  // CampaignState gets consumed. Undefined/false for every other unit.
  sentOff?: boolean;
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

  // ---- Vault Phase 2, slice 1 (2 Sep 2026) — see data/heirlooms.ts's own
  // "VAULT PHASE 2, SLICE 1" header note and claude/Bloom_Wars_Build_Log_
  // Addendum_VaultPhase2Slice1_02Sep2026.md for the full account.

  /**
   * Which Heirloom ability ids this unit's wielder currently has unlocked,
   * and at what rank (1-5). Resolved ONCE at deploy time from the wielding
   * pilot's CampaignState.heirlooms.abilityRanks (engine/heirlooms.ts's
   * abilityRank) — same "baked in at creation, doesn't change mid-mission"
   * treatment as tier/mek/weaponBranchId above, and for the identical
   * reason: ability ranks are bought with personal points between missions,
   * never mid-battle, so there is nothing to re-read live. The ability ids
   * themselves are ALSO pushed onto `abilities` at the same deploy step
   * (engine/units.ts's createPlayerUnit) so every existing
   * `unit.abilities.includes(...)` check keeps working unmodified; this map
   * exists only to answer "at what rank," which `abilities` alone can't.
   * Undefined/empty for every unit not currently wielding a fielded
   * Heirloom — hostile mechs, Bloom, and every ordinary pilot included.
   */
  heirloomAbilityRanks?: Record<string, number>;
  /**
   * oath_iron_word (Vindex/The Iron Oath). Set by Mission.ironWord() the
   * same turn abil_taunt's own `taunting` is set, alongside it — Iron Word
   * IS a taunt, just a radius-gated one rather than the vision-gated-only
   * shape abil_taunt grants. engine/ai.ts's four taunting-check sites read
   * this alongside `taunting` and additionally require the hostile to be
   * within `tauntRadius` of this unit at decision time. Undefined means
   * "no radius limit" — the plain abil_taunt case, completely unchanged —
   * so this field is purely additive and every existing Taunt user (who
   * never sets it) sees zero behavior change. Cleared in the exact same
   * start-of-own-next-turn loop that clears `taunting` itself, so the two
   * can never drift out of sync.
   */
  tauntRadius?: number;
  /**
   * ledger_overextended (Skuld/Widow's Ledger). "Trade defense for one
   * turn: 0 DEF, +40% ATK." Set by Mission.ledgerOverextended(), read by
   * engine/combat.ts's overextendedAttackMultiplier/overextendedDefense to
   * apply both halves of the trade at the point each stat is actually used
   * in the damage formula — mirrors how `taunting`/`braced`/`concealed` are
   * simple booleans read live by the code that cares, not stats mutated in
   * place. Cleared in the same start-of-own-next-turn loop as those three:
   * "one turn" here means "survives through the intervening hostile phase,
   * clears when your own next turn begins," identical to how Interdict's
   * `braced` already reads, and the real risk (0 DEF through a whole
   * hostile phase) is the point of the trade, not an oversight.
   */
  overextended?: boolean;
  /**
   * ledger_overextended's clock at rank 5, mirroring stealthTurnsRemaining's
   * exact shape (engine/units.ts, above): undefined/0 means "the plain
   * 1-turn version" — `overextended` clears unconditionally in the
   * start-of-own-turn loop, same as every rank 1-4 use. Set to
   * LEDGER_OVEREXTENDED_RANK5_DURATION_TURNS - 1 (the extra turn beyond the
   * baseline) only when the ability is cast at rank 5, and counted down in
   * that same loop; `overextended` survives until this hits 0.
   */
  overextendedTurnsRemaining?: number;

  // ---- Vault Phase 2, slice 2 (3 Sep 2026) — see data/heirlooms.ts's own
  // "VAULT PHASE 2, SLICE 2" header note and claude/Bloom_Wars_Build_Log_
  // Addendum_VaultPhase2Slice2_03Sep2026.md for the full account.

  /**
   * ledger_entry (Skuld/Widow's Ledger) rank 5's one-time move-range bonus
   * ("the bonus also applies to move range past 3 stacks"). Guards
   * engine/mission.ts's resolveKill from adding LEDGER_ENTRY_MOVE_BONUS_AMOUNT
   * to `moveRange` more than once per mission — kills only ever increase, so
   * without this guard every kill past the threshold would silently re-add
   * the bonus. Undefined/false for every unit, cleared to true the instant
   * the bonus is granted; never reset mid-mission.
   */
  ledgerEntryMoveBonusApplied?: boolean;
  /**
   * oath_oathkeeper (Vindex/The Iron Oath). True for exactly
   * OATHKEEPER_DURATION_TURNS (rank 1-4) or OATHKEEPER_RANK5_DURATION_TURNS
   * (rank 5) hostile phases after Mission.oathkeeper() is used — while true,
   * engine/combat.ts's applyMechDamage floors this unit's currentHp at
   * OATHKEEPER_HP_FLOOR instead of letting it reach 0, banking the
   * difference in oathkeeperDeferredDamage below rather than discarding it.
   * Mirrors `overextended`'s own live-read-by-combat.ts shape.
   */
  oathkeeperActive?: boolean;
  /**
   * oathkeeper's own duration clock, mirroring overextendedTurnsRemaining's
   * exact shape (set at cast time, decremented once per hostile-phase-end in
   * the same start-of-own-next-turn loop that clock uses) rather than a
   * second, differently-shaped timer. Undefined once the window has closed.
   */
  oathkeeperTurnsLeft?: number;
  /**
   * Running total of damage applyMechDamage has spared this unit while
   * oathkeeperActive was true — "all spared damage lands the instant it
   * ends." Landed (rank 5: halved) and reset to 0 the moment
   * oathkeeperTurnsLeft reaches 0, via a second, ordinary applyMechDamage
   * call made with oathkeeperActive already cleared, so a landing hit that
   * would down this unit goes through the exact same handleDowned path any
   * other downing does — no separate "deferred-death" code path.
   */
  oathkeeperDeferredDamage?: number;

  // ---- Vault Phase 2, slice 4 (3 Sep 2026) — Zanretsu's full 3-ability kit:
  // cutting_room_charge, cutting_room_momentum, cutting_room_sure_footing
  // (Vann Rethwick, House Rethwick, centauroid chassis, Meeps path). See
  // data/heirlooms.ts's own "cutting_room" entry and engine/mission.ts's
  // cuttingRoomCharge() for the full design.

  /**
   * cutting_room_momentum — set true the INSTANT cuttingRoomCharge()
   * resolves (any use, hit or whiff), consumed at the start of THIS
   * wielder's own next round (the same "start of own next turn" reset loop
   * that clears overextended/oathkeeperActive/etc.), which is when the
   * actual +2 move (rank 5: also +10% ATK) bonus is granted for that one
   * round. Two-step on purpose — "pending" vs. "active" — because the
   * ability's own prose is "on the turn immediately FOLLOWING any Zanretsu
   * use," not the same turn the charge itself happens on.
   */
  momentumPending?: boolean;
  /**
   * The flat move-range bonus a currently-active Momentum window added to
   * `moveRange`, so the reset loop can revert EXACTLY that amount next time
   * rather than guessing — mirrors resolveKill's own ledger_entry moveRange
   * grant (data/combatTables.ts's LEDGER_ENTRY_MOVE_BONUS_AMOUNT), except
   * that one is a permanent one-time add and this one has to come back off
   * a round later. Undefined/0 when no window is open.
   */
  momentumMoveBonusActive?: number;
  /**
   * Whether the CURRENT round's Momentum window also grants rank 5's +10%
   * ATK — read by engine/turnManager.ts's momentumAttackMultiplier at every
   * point combat.ts already reads an attack-multiplier flag (mirrors
   * `overextended`'s own live-read-by-combat.ts shape, not a mutated stat).
   * Unlike the move bonus, this needs no separate "amount granted" field to
   * revert: the reset loop just sets it back to false, and
   * momentumAttackMultiplier reads a plain 1 the instant that happens.
   */
  momentumAtkBoostActive?: boolean;

  /**
   * cutting_room_sure_footing — true while an active knockback/forced-
   * movement immunity window is open. Read by engine/turnManager.ts's
   * isKnockbackImmune, which applyBloomOnHitEffect's own knockback branch
   * checks before ever computing a push destination. Mirrors
   * `oathkeeperActive`'s exact shape (a live-read boolean, not a mutated
   * stat) — set by Mission.cuttingRoomSureFooting(), cleared by the same
   * start-of-own-next-turn reset loop as every other timed posture above.
   */
  sureFootingActive?: boolean;
  /**
   * Sure Footing's own duration clock, mirroring overextendedTurnsRemaining/
   * oathkeeperTurnsLeft's identical shape: set at cast time
   * (CUTTING_ROOM_SURE_FOOTING_DURATION_TURNS, or the rank-5 duration),
   * decremented once per pass through the reset loop, `sureFootingActive`
   * clears the instant this reaches 0.
   */
  sureFootingTurnsLeft?: number;

  // ---- Vault Phase 2, slice 5 (3 Sep 2026) — Migawari's remaining 2 of 3
  // abilities: lastword_signature, lastword_last_rites (Osric Ferrow, House
  // Ferrow, Munti path). See data/heirlooms.ts's own "last_word" entry and
  // engine/mission.ts's lastWordSignature()/lastRites() for the full
  // design.

  /**
   * The Mission.turn value at the instant this unit's `downed` flag was set
   * true, latched once by handleDowned() and never touched again by
   * anything else — lastword_last_rites' own "this turn" gate reads this
   * against the CURRENT Mission.turn to decide whether a downing is still
   * fresh enough to act on (see getLastRitesTargetsFrom's own comment for
   * why Mission.turn, not phase, is the right clock here). Undefined for
   * every unit that has never been downed at all.
   */
  downedOnTurn?: number;
  /**
   * lastword_last_rites — set to the CURRENT Mission.turn the instant a
   * downed ally is granted their one borrowed action, cleared by
   * resolveLastRitesBorrowedTime() at the end of that same player turn
   * (which also forces `downed` back to true if this unit is still alive
   * and un-downed at that point — see that method's own comment for the
   * full "goes down again as normal" close-out, including why it does NOT
   * re-run handleDowned). Undefined outside that one-turn window.
   */
  lastRitesBorrowedTurn?: number;

  // ---- Vault Phase 2, slice 6 (3 Sep 2026) — Simulacrum's full 3-ability
  // kit (stolen_seal, ABERRATION track, no aristocrat pilot — see
  // data/heirlooms.ts's own header for what that distinction means). See
  // engine/mission.ts's sealBorrowedAuthority()/ledgerhallStatic()/
  // rollInheritedWeight() for the full design of each field below.

  /**
   * seal_borrowed_authority — set the instant the ability is cast, to
   * whichever OnHitEffectKind was drawn (see engine/mission.ts's
   * sealBorrowedAuthority() for the draw/reroll mechanics). Consumed by
   * this SAME unit's own next successful attack that lands on a Bloom-shape
   * defender (resolveAttack's mech-attacks-Bloom branch, the same branch
   * Shock Claws' own on-hit effect already fires from) — cleared the
   * instant that attack resolves, whether or not the defender survived to
   * receive the copied effect. No stated duration in rank1/rank5's own
   * prose (unlike Ledgerhall Static's explicit "2 turns"), so this is read
   * as persisting indefinitely until consumed, not expiring on a clock —
   * flagged as a judgment call in sealBorrowedAuthority()'s own header.
   * Undefined whenever no draw is currently primed.
   */
  borrowedAuthorityFxKind?: OnHitEffectKind;
  /**
   * seal_ledgerhall_static — the ability id (from the JAMMED unit's own
   * `abilities` array) this unit currently cannot use, and how many more
   * passes through the start-of-own-next-turn reset loop the jam survives
   * before clearing — same TurnsRemaining-shaped decrement as
   * sureFootingTurnsLeft above. HONEST LIMITATION, stated plainly rather
   * than glossed over (see ledgerhallStatic()'s own header comment for the
   * full account): engine/ai.ts's decideHostileAction has no per-ability
   * dispatch at all today — a hostile mech's own `abilities` array (a
   * leftover of sharing UnitArchetype records with player units) is never
   * read by the hostile decision code, grep-confirmed. This field is real,
   * set, and correctly expiring — but nothing in this engine currently
   * reads it to actually change what a jammed hostile does, because there
   * is no ability-choice AI to gate in the first place. isAbilityJammed()
   * exists for the day that changes.
   */
  jammedAbilityId?: string;
  jammedAbilityTurnsRemaining?: number;
  /**
   * seal_inherited_weight — rolled exactly once, at mission construction,
   * for whichever player unit is fielded holding this ability (see
   * Mission's own rollInheritedWeight()). Purely informational: the roll is
   * baked directly into this unit's own `effectiveDefense` the instant it's
   * rolled (nothing in engine/combat.ts needs a second "is there a bonus
   * active" branch — it already reads effectiveDefense at every damage
   * calculation), so this field is never itself read by any damage-
   * resolution code. Kept anyway so a test or a future HUD line can report
   * the exact roll without having to reverse-engineer it back out of
   * effectiveDefense against the unit's own base archetype numbers.
   * Undefined for every unit that doesn't carry seal_inherited_weight.
   */
  inheritedWeightDefBonus?: number;

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
   * whichever player unit's instanceId matches extractUnitId — OR, since
   * the 31 Aug 2026 role-fallback pass, on the first living player unit in
   * deploy order when the named pilot was never actually deployed this run
   * (left home, or permanently lost to an earlier mission's permadeath —
   * see tagExtractionTarget's own comment). This flag, not the literal
   * configured id, is now the single source of truth everywhere the real
   * extraction target matters — engine/mission.ts's own checks, Player AI
   * (sim/playerAi/index.ts), and Battle.ts's HUD line and green ring all
   * read it rather than re-deriving from objectiveParams.extractUnitId.
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

/**
 * Scattershot Pistols (Weapon Branch Point System, data/weaponBranches.ts,
 * 3 Sep 2026) — the first branch in this pass to touch the attackRange
 * TUPLE itself rather than a stat/targeting condition, so it gets its own
 * function rather than folding into weaponBranchAttackBonus's plain-number
 * return above. Returns `archetypeRange` unchanged for every other branch
 * (including no branch at all) — copied, not the same reference, so
 * nothing downstream can mutate the shared archetype's own tuple through a
 * unit's `attackRange` field the way archetype.attackRange was already
 * being handed out directly before this branch existed.
 */
function weaponBranchAttackRange(branchId: WeaponBranchId | undefined, archetypeRange: [number, number]): [number, number] {
  if (branchId === "meeps_scattershot_pistols") return [SCATTERSHOT_PISTOLS_ATTACK_RANGE[0], SCATTERSHOT_PISTOLS_ATTACK_RANGE[1]];
  return [archetypeRange[0], archetypeRange[1]];
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
export function createPlayerUnit(
  pilotId: string,
  pos: Coord,
  overrides?: {
    pilot?: PilotRecord;
    mek?: MekArchetype;
    sendOffBonus?: boolean;
    // Vault Phase 2, slice 1 (2 Sep 2026) — ability id -> rank (1-5) for
    // whichever Heirloom this pilot is fielding this mission, resolved by
    // the caller (scenes/Battle.ts's resolveDeployRoster) from
    // CampaignState the exact same way sendOffBonus is: a boolean/map
    // computed once from campaign state, not a live reference threaded
    // through. Absent/empty for every pilot not currently wielding a
    // fielded Heirloom. See BattleUnit.heirloomAbilityRanks's own comment.
    heirloomAbilityRanks?: Record<string, number>;
  }
): BattleUnit {
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
  // Send-Off tactical payoff (2 Sep 2026) — see the BattleUnit.sentOff field
  // comment above and data/socialActions.ts's SEND_OFF_DEFENSE_BONUS for the
  // full reasoning. `overrides?.sendOffBonus` is only ever true for the one
  // roster entry scenes/Battle.ts's resolveDeployRoster matched against
  // CampaignState.preMissionSendOff.
  const sentOff = overrides?.sendOffBonus === true;
  const sendOffDefenseBonus = sentOff ? SEND_OFF_DEFENSE_BONUS : 0;

  const effectiveAttack = archetype.baseAttack + (tier.attack - 100) + mekBonus.attack + branchAttackBonus;
  const effectiveDefense = archetype.baseDefense + (tier.defense - 100) + mekBonus.defense + sendOffDefenseBonus;
  // Vault Phase 2, slice 5 (3 Sep 2026) — lastword_signature's own
  // permanent cost (data/types.ts's PilotRecord.permanentMaxHpMultiplier,
  // see that field's own comment) lands here: every fresh BattleUnit this
  // pilot is ever built into, in any future mission, is built off their
  // CURRENT (possibly already-shrunk-by-Migawari) max HP, not the
  // tier/mek baseline alone. `?? 1` makes this a complete no-op for every
  // pilot who has never paid the cost — which is every pilot in the game
  // except a Migawari wielder who's actually used their signature.
  // Rounded for the same reason mekStatBonus/tier deltas above are already
  // whole numbers — HP is never fractional anywhere else in this file.
  const maxHp = Math.round((archetype.baseHp + (tier.hp - 100) + mekBonus.hp) * (pilot.permanentMaxHpMultiplier ?? 1));
  const vision = archetype.vision + mekBonus.vision;
  const moveRange = archetype.moveRange + tier.move;
  // Never mutate the shared archetype.abilities array — copy, then append
  // if this branch grants one (Missiles). Every other unit factory in this
  // file still assigns archetype.abilities directly since none of them
  // ever need to add to it.
  let abilities = grantedAbility ? [...archetype.abilities, grantedAbility] : archetype.abilities;
  // Vault Phase 2, slice 1 (2 Sep 2026) — same append-not-mutate treatment
  // as the weapon-branch-granted ability just above, for the exact same
  // reason: the Heirloom's kit ids get pushed onto this unit's own
  // `abilities` copy so every `unit.abilities.includes("oath_iron_word")`
  // style check works unmodified, with heirloomAbilityRanks (below) as the
  // only place "at what rank" lives.
  const heirloomAbilityRanks = overrides?.heirloomAbilityRanks;
  if (heirloomAbilityRanks && Object.keys(heirloomAbilityRanks).length > 0) {
    abilities = [...abilities, ...Object.keys(heirloomAbilityRanks)];
  }

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
    attackRange: weaponBranchAttackRange(weaponBranchId, archetype.attackRange),
    vision,
    canCounter: archetype.canCounter,
    counterMaxRange: archetype.counterMaxRange,
    abilities,
    chassis: archetype.chassis,
    weaponBranchId,
    sentOff,
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
    heirloomAbilityRanks,
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
