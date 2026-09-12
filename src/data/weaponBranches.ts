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
// SUPPORT branches (this file's munti_rapid_response/munti_field_doctor/
// munti_combat_medic) are new.
//
// Aegis Ward — added 1 Sep 2026, CUT 12 Sep 2026. Scaled the passive aura's
// radius only, for whichever Munti had it equipped. Maxime caught it live:
// "aegis ward does the same thing as combat medic, we can remove it from
// the game" — checked against how both actually shipped, and it was worse
// than an overlap. Combat Medic (5 Sep) reuses the exact same radius
// formula (MUNTI_REGEN_RADIUS + 1) AND triples the heal on top, so Aegis
// Ward was a strict subset of Combat Medic with nothing of its own — no
// build order made it the better pick. Full account:
// claude/claude_Bloom_Wars_Placeholder_Session_TODO.md, 12 Sep 2026.
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
//
// Riot Drum added 4 Sep 2026 — Tank's 2nd branch (Bloom_Wars_Mek_Workshop_
// And_Weapon_Progression_v1.md: "melee plus a knockback/pin effect on
// hit, echoing Interdict's own flavor"). Two real decisions got made
// before this was buildable, both Maxime's own call, not guessed:
//
// 1. What "pin" actually means. abil_interdict's own triggerInterdiction()
//    (engine/mission.ts) already uses the word "pin" in this codebase to
//    mean "zero the target's actionsRemaining for the turn" — mechanically
//    IDENTICAL to what the "stun" StatusEffect kind already does. Rather
//    than invent a second, different mechanic for the same word, Riot
//    Drum's pin reuses the "stun" StatusEffect kind outright (fx_riot_drum_pin
//    below) — same isStunned()/runHostileTurn skip, same tickStatusEffects
//    decay, zero new engine surface. The one honest cost of that reuse:
//    runHostileTurn's own skip-turn log line ("X is stunned and skips its
//    turn") is worded generically off isStunned(), not off which fxId
//    caused it — so a Riot Drum pin proc reads as "stunned" in that one
//    log line next turn, even though the HIT-LANDING line below (mission.ts)
//    correctly says "is pinned!" the turn it actually happens. Not fixed
//    here — would mean carrying a source label through StatusEffect for a
//    text-only difference — flagged instead as a known, deliberately
//    accepted cosmetic gap.
// 2. Whether knockback and pin roll independently or as one either/or
//    proc. This file's array shape for WEAPON_BRANCH_ON_HIT_EFFECT (widened
//    from a single {fxId,chance} to a list, below) rolls each entry on its
//    own — so a single landed hit can knock back, pin, both, or neither,
//    same "each effect is its own placeholder chance" convention already
//    governing every other number in this file. Not run through
//    combat_sim.py; RIOT_DRUM_KNOCKBACK_CHANCE/RIOT_DRUM_PIN_CHANCE below
//    are deliberately each set lower than Shock Claws' single 25% (since a
//    hit here can proc up to two effects, not one), a judgment call worth
//    a real playtest pass, not a locked number.
//
// Maser Lance added 5 Sep 2026 — Tank's 3rd branch (Bloom_Wars_Mek_Workshop_
// And_Weapon_Progression_v1.md's Tier-3 slot). Same "SOFT pass, granted
// ability" precedent Missiles (reeps_missiles) already set, and a genuine
// three-question design fork, resolved by Maxime via AskUserQuestion rather
// than guessed (see data/abilities.ts's own abil_maser_lance header for the
// full write-up of all three):
//   1. Architecture: a separate granted ability (own action-bar button, own
//      per-mission charge budget, ends the turn) — same shape as Missiles,
//      not a modifier on the Tank's ordinary attack.
//   2. Shape: a REAL expanding cone (1/3/5 tiles wide at forward-steps
//      1/2/3), not a simpler frontal rectangle.
//   3. Friendly fire: yes, no side filter — same family as Missiles.
// MASER_LANCE_GRANT_ABILITY mirrors MISSILE_GRANT_ABILITY exactly (below);
// this file owns none of the cone geometry or charge-count numbers
// themselves (MASER_LANCE_CONE_RANGE/MASER_LANCE_CHARGES_PER_MISSION both
// live in data/combatTables.ts, same file Missiles' own two numbers do) —
// this branch's only job is granting the ability to whichever Tank equips
// it, same division of labor reeps_missiles already established.
//
// One purchase-order question worth flagging explicitly rather than
// silently assuming: this system's cost/tier gate (WEAPON_BRANCH_COSTS/
// WEAPON_BRANCH_TIER_GATE just below) is keyed by PURCHASE ORDER —
// how many branches a pilot already owns — NOT by which specific branch,
// and scenes/shop/ShopPanel.ts's drawWeaponBranchesRow already renders
// every unowned branch in WEAPON_BRANCHES_BY_PATH[path] as its own BUY
// button, all priced/gated identically off owned.length. That means a
// fresh Tank pilot COULD buy Maser Lance as their very first branch,
// skipping Grinder Claw/Riot Drum entirely — checked directly against the
// live purchaseWeaponBranch/ShopPanel code rather than assumed, and this is
// NOT a Maser-Lance-specific gap: Meeps' Shock Claws and Tank's own Riot
// Drum are already buyable first too, ahead of each path's "earlier" branch
// in WEAPON_BRANCHES_BY_PATH's own array order. That's this system's actual
// designed shape per its own source doc (§3/§9: "cost and tier-gate depend
// on purchase order... not on which specific branch") — not a bug this
// branch introduces, so no special-case override was added here to force
// Maser Lance behind Grinder Claw/Riot Drum. Worth knowing, not worth
// fixing alone: if "no skipping the starter branch" ever becomes a real
// design goal, it needs a system-wide purchase-order lock touching every
// path's branches at once, not a one-branch patch.
//
// Suppression Autocannon added 5 Sep 2026 — Reeps' 3rd and, per the source
// doc's own table (Weapon_Branch_Expansion_Plan_v1.md §2), LAST branch:
// Reeps was already named at exactly 3 (Missiles, Rail Lance, Suppression
// Autocannon) with no 4th concept ever proposed, unlike Meeps/Tank's own
// "one slot short of symmetry" gap that got flagged and later filled — so
// this branch completes Reeps' own track rather than opening a new slot.
// "Attack-debuff on hit" per that doc's own line, built as this file's
// SECOND consumer of the debuff_attack kind (the FIRST being data/bloom.ts's
// own BLOOM_ON_HIT_EFFECTS — Sirenmaw/the Choir already inflict this exact
// effect on players; this branch is a mech inflicting the identical thing
// back). Two design calls, both Claude's own judgment (attribution rule per
// Foundation.md — flagged as such, not run through combat_sim.py):
//   1. Reuse fx_debuff_attack's own numbers outright (-20% ATK, 2 turns —
//      SUPPRESSION_AUTOCANNON_DEBUFF_MAGNITUDE/_DURATION_TURNS below) rather
//      than inventing a tuned sibling the way fx_choir_dissonance did. A
//      player weapon branch granting a WEAKER or STRONGER debuff than the
//      one Bloom already inflict has no design rationale behind it — "same
//      effect, turned around" is the honest read of what this branch is.
//      Same reasoning for the radius: no new constant, this branch reuses
//      turnManager.ts's own DEBUFF_ATTACK_RADIUS (2) exactly, the same way
//      applyBloomOnHitEffect's own debuff_attack branch already does — the
//      "friendlies within N tiles" rule isn't a Bloom-specific rule, it's the
//      debuff's own rule, and mission.ts's mech-attacks-Bloom branch already
//      has the Bloom-side same-side roster (`sameSideAsDefender`) on hand to
//      reuse for it (see engine/mission.ts's own call site).
//   2. SUPPRESSION_AUTOCANNON_DEBUFF_CHANCE sits at 35% — above Shock
//      Claws' single 25% despite both being one-effect-per-hit branches
//      (unlike Riot Drum's two independent lower-chance rolls). The
//      difference is what's being gated: Shock Claws/Riot Drum's pin both
//      deny an entire turn, which is why they're kept rare; a -20%/2-turn
//      attack debuff is reversible and comparatively mild (it doesn't stop
//      a Bloom from acting at all), so it can land more often without
//      reading as oppressive the way a high-chance full stun would. A
//      judgment call, not a sim result — worth a real playtest pass like
//      every other placeholder number in this file.
//
// This is also this file's first branch to widen applyMechOnHitEffect
// itself rather than just adding a table entry: that function's signature
// grew a `defenderSameSide` param (engine/turnManager.ts) so its new
// "debuff_attack" branch can reach the defender's own same-side allies
// within radius, mirroring applyBloomOnHitEffect's debuff_attack branch —
// see that file's own header for the full account.
//
// Combat Medic added 5 Sep 2026 — Munti's 4th branch, the one this file's
// own header used to flag as waiting on "further design work (a positive/
// heal-tick effect kind nothing has built yet)". That framing turned out to
// be Claude's own assumption, not Maxime's design — put to him directly
// (AskUserQuestion: a new granted heal-over-time ability vs. upgrading
// Repair itself vs. something else), and his answer was simpler than
// either option offered: "triple passive regen. to those within 3 tile of
// themself." No new StatusEffect kind, no new ability, no new UI — this is
// the SAME tickMuntiRegen() aura Munti already has (engine/mission.ts),
// just a bigger number and a wider radius for whichever Munti has this
// branch equipped, same per-Munti-not-squad-wide shape Rapid Response's
// own repair-range bonus already established for its own stat. Combat
// Medic is the one branch that scales BOTH the aura's amount and its
// radius at once, which is what makes it the flagship 4th branch rather
// than a second cheap economy-only tweak.
//
// COMBAT_MEDIC_REGEN_RADIUS is derived as MUNTI_REGEN_RADIUS + 1 (= 3
// today) rather than a hardcoded 3, my own judgment call (Foundation's
// attribution rule) rather than a literal reading of "3 tile": Maxime's
// wording gives the right CURRENT value either way, but deriving it keeps
// this branch meaningfully wider than the base radius if that base is ever
// raised later, the same "+1, not fixed" convention Rapid Response's own
// repair-range constant already uses below.
// COMBAT_MEDIC_REGEN_MULTIPLIER (3) is Maxime's own literal number, kept as
// a named multiplier rather than a flat HP value so it stays visibly
// "triple," not just some other number that happens to equal 24 today.
//
// engine/mission.ts's tickMuntiRegen() previously read as a flat boolean
// "is any qualifying Munti in range" check, since every Munti healed for
// the same MUNTI_REGEN_PER_TURN regardless of which one was in range —
// that no longer holds once Combat Medic heals for a different amount than
// the plain aura, so the tick now takes the BEST (highest) applicable
// amount across every same-side Munti in range of a given unit, not the
// first one found and not a sum — multiple Muntis still "don't stack" per
// this system's existing rule, extended to mean "the strongest aura wins"
// now that auras can differ in strength, not just reach.
import type { Path } from "./types";
import { MUNTI_REGEN_RADIUS, MUNTI_REGEN_PER_TURN } from "./combatTables";

export type WeaponBranchId =
  | "meeps_impact_lance"
  | "meeps_scattershot_pistols"
  | "meeps_shock_claws"
  | "tank_grinder_claw"
  | "tank_riot_drum"
  | "tank_maser_lance"
  | "reeps_missiles"
  | "reeps_rail_lance"
  | "reeps_suppression_autocannon"
  | "munti_rapid_response"
  | "munti_field_doctor"
  | "munti_combat_medic";

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

/** Tank — Riot Drum's knockback chance, 4 Sep 2026. See this file's header comment (Riot Drum section) for why this and RIOT_DRUM_PIN_CHANCE are each lower than Shock Claws' single 25% — a hit here can independently proc knockback, pin, both, or neither. Placeholder — not run through combat_sim.py, one line to retune. */
export const RIOT_DRUM_KNOCKBACK_CHANCE = 0.3;

/** Tank — Riot Drum's knockback distance, in tiles. Matches fx_knockback_1's own magnitude (data/bloom.ts, the Heartwood/Unnamed's push) for consistency — one tile is this engine's one existing knockback "unit," not a new distance invented just for this branch. */
export const RIOT_DRUM_KNOCKBACK_MAGNITUDE = 1;

/** Tank — Riot Drum's pin chance, 4 Sep 2026. See RIOT_DRUM_KNOCKBACK_CHANCE's own comment for why this is lower than Shock Claws' 25%. Placeholder — not run through combat_sim.py, one line to retune. */
export const RIOT_DRUM_PIN_CHANCE = 0.15;

/** Tank — Riot Drum's pin duration, in turns. "Pin" is implemented as the "stun" StatusEffect kind outright (see this file's header comment) — same 1-turn floor SHOCK_CLAWS_STUN_DURATION_TURNS uses, for the same "brief" reasoning, kept as its own named constant rather than reusing that one so the two branches' numbers can diverge later without one accidentally dragging the other along. */
export const RIOT_DRUM_PIN_DURATION_TURNS = 1;

/** Reeps — Suppression Autocannon's on-hit debuff chance, 5 Sep 2026. See this file's header comment (Suppression Autocannon section) for why this sits above Shock Claws' single 25% despite both being one-effect-per-hit rolls: a -20%/2-turn attack debuff is reversible and non-swingy compared to a full turn-denial effect (stun/pin), so it can afford to land more often. Placeholder — not run through combat_sim.py, one line to retune. */
export const SUPPRESSION_AUTOCANNON_DEBUFF_CHANCE = 0.35;

/** Reeps — Suppression Autocannon's debuff magnitude, 5 Sep 2026. Matches fx_debuff_attack's own -20% (data/bloom.ts) exactly, deliberately — this branch grants mechs the SAME effect Sirenmaw/the Choir already inflict on players, not a tuned-up or tuned-down sibling (contrast fx_choir_dissonance, which IS a tuned sibling of fx_debuff_attack). */
export const SUPPRESSION_AUTOCANNON_DEBUFF_MAGNITUDE = 0.2;

/** Reeps — Suppression Autocannon's debuff duration, in turns, 5 Sep 2026. Matches fx_debuff_attack's own 2 turns (data/bloom.ts), same "same effect, not a tuned sibling" reasoning as the magnitude above. */
export const SUPPRESSION_AUTOCANNON_DEBUFF_DURATION_TURNS = 2;

/**
 * Mech-side on-hit effects (engine/turnManager.ts's applyMechOnHitEffect) —
 * this system's analogue of data/bloom.ts's BLOOM_ON_HIT_EFFECTS, same
 * shape (a table of fxId -> {kind, magnitude, duration}, dispatched on
 * `kind`). `magnitude` is unused for "stun" (there's no "how much" the way
 * acid_dot/debuff_attack have one) but kept on the shared shape so this
 * table's entries stay structurally identical to BLOOM_ON_HIT_EFFECTS'.
 * Widened 4 Sep 2026 (Riot Drum) to also allow a "knockback"-kind entry,
 * dispatched by applyMechOnHitEffect exactly like applyBloomOnHitEffect's
 * own knockback branch (same knockbackDestination()/isKnockbackImmune()
 * reuse, not a second implementation). Widened again 5 Sep 2026 (Suppression
 * Autocannon) for a "debuff_attack"-kind entry, same reuse discipline —
 * applyMechOnHitEffect's own debuff_attack branch mirrors
 * applyBloomOnHitEffect's exactly (same DEBUFF_ATTACK_RADIUS, same
 * same-side-allies-within-radius rule), just fed the Bloom-side roster
 * instead of the mech-side one.
 */
export const MECH_ON_HIT_EFFECTS: Record<
  string,
  | { kind: "stun"; magnitude: number; duration: number }
  | { kind: "knockback"; magnitude: number; duration: number }
  | { kind: "debuff_attack"; magnitude: number; duration: number }
> = {
  fx_shock_claws_stun: { kind: "stun", magnitude: 0, duration: SHOCK_CLAWS_STUN_DURATION_TURNS },
  fx_riot_drum_knockback: { kind: "knockback", magnitude: RIOT_DRUM_KNOCKBACK_MAGNITUDE, duration: 0 },
  fx_riot_drum_pin: { kind: "stun", magnitude: 0, duration: RIOT_DRUM_PIN_DURATION_TURNS },
  fx_suppression_autocannon_debuff: {
    kind: "debuff_attack",
    magnitude: SUPPRESSION_AUTOCANNON_DEBUFF_MAGNITUDE,
    duration: SUPPRESSION_AUTOCANNON_DEBUFF_DURATION_TURNS,
  },
};

/**
 * Which weapon branch grants which mech-side on-hit effect(s), and at what
 * chance each fires independently on a landed hit — the piece
 * BLOOM_ON_HIT_EFFECTS doesn't need an equivalent of, since a Bloom
 * archetype's onHit is baked into the archetype itself (data/bloom.ts)
 * rather than depending on anything the player equips. Read by
 * engine/mission.ts's mech-attacks-Bloom resolution, keyed by the
 * ATTACKER's own weaponBranchId — not present in this record at all for
 * every branch that doesn't grant an on-hit effect (the common case;
 * Partial, not Record, deliberately, so a branch with nothing to add here
 * needs no entry rather than an explicit `undefined`).
 *
 * Widened 4 Sep 2026 from a single {fxId,chance} to a LIST of them, purely
 * for Riot Drum (the first branch that grants more than one on-hit effect)
 * — engine/mission.ts's call site rolls every entry in a branch's list
 * independently, so Shock Claws' own single-entry list behaves exactly as
 * before (still one roll, same chance, same fxId).
 */
export const WEAPON_BRANCH_ON_HIT_EFFECT: Partial<Record<WeaponBranchId, { fxId: string; chance: number }[]>> = {
  meeps_shock_claws: [{ fxId: "fx_shock_claws_stun", chance: SHOCK_CLAWS_STUN_CHANCE }],
  tank_riot_drum: [
    { fxId: "fx_riot_drum_knockback", chance: RIOT_DRUM_KNOCKBACK_CHANCE },
    { fxId: "fx_riot_drum_pin", chance: RIOT_DRUM_PIN_CHANCE },
  ],
  reeps_suppression_autocannon: [
    { fxId: "fx_suppression_autocannon_debuff", chance: SUPPRESSION_AUTOCANNON_DEBUFF_CHANCE },
  ],
};

/** Tank — melee plus self-heal on a successful hit. A fraction of damage DEALT, not received; only fires when the hit actually lands (a dodge or a miss heals nothing). */
export const GRINDER_CLAW_HEAL_PCT = 0.2;

/** Reeps — grants abil_missile (engine/mission.ts, built 26 Aug 2026, previously attached to zero archetypes — see claude/Bloom_Wars_Missile_Weapon_Live_Test_v1.md for the live-engine test this branch is built from). No new numbers here; the ability's own MISSILE_SPLASH_RADIUS/MISSILE_CHARGES_PER_MISSION (data/combatTables.ts) are unchanged. */
export const MISSILE_GRANT_ABILITY = "abil_missile";

/** Tank — grants abil_maser_lance (engine/mission.ts, built 5 Sep 2026), same "no new numbers here" shape as MISSILE_GRANT_ABILITY above — the ability's own MASER_LANCE_CONE_RANGE/MASER_LANCE_CHARGES_PER_MISSION (data/combatTables.ts) are unchanged by which Tank equips it. */
export const MASER_LANCE_GRANT_ABILITY = "abil_maser_lance";

/** Reeps — armor-piercing. Ignores a fraction of the DEFENDER's effective defense, but ONLY against a Tank-path defender (data/types.ts Path) — sharpens Reeps-beats-Tank rather than a flat damage buff that would blur the triangle. */
export const RAIL_LANCE_DEF_IGNORE_PCT = 0.25;

/** Base Repair range, every Munti, 28 Aug 2026 — raised from the original 1 tile (adjacent only) to 3, per Maxime's "give more range to munty heal" -> "Base range, everyone (1->3)" call. engine/mission.ts's getRepairableFrom() and sim/playerAi/support.ts's own repair-target search both used to hardcode the old adjacent-only distance regardless of this constant — that was the real bug, fixed alongside this change so both actually read it. */
export const DEFAULT_REPAIR_RANGE = 3;
/** Munti Support Branch — one further tile beyond the base range above, not a fixed absolute number, so raising the base later keeps this branch meaningfully better rather than converging with it. */
export const RAPID_RESPONSE_REPAIR_RANGE = DEFAULT_REPAIR_RANGE + 1;

/** Munti Support Branch — Field Doctor, 1 Sep 2026, Maxime's own pick ("Free Repair every N turns"). Same value as WEAPONS_BAY_FIRE_SUPPORT_COOLDOWN_TURNS (data/combatTables.ts) — deliberately matching the plan doc's own "same shape as Weapons Bay's bonus Fire Support charge" comparison exactly rather than picking an unrelated number. Placeholder, not run through combat_sim.py or an equivalent — same status as every other weapon-branch number in this file, worth a real playtest pass once there's a Munti actually carrying it in a run. */
export const FIELD_DOCTOR_COOLDOWN_TURNS = 3;

/** Munti's flagship support branch, Combat Medic, 5 Sep 2026 — Maxime's own design, given directly rather than guessed: "triple passive regen. to those within 3 tile of themself." Derived as MUNTI_REGEN_RADIUS + 1 (see this file's header comment for why derived rather than a hardcoded 3) — lands on 3 today, the same "+1, not fixed" convention Rapid Response's own repair-range constant uses above. */
export const COMBAT_MEDIC_REGEN_RADIUS = MUNTI_REGEN_RADIUS + 1;
/** Munti's Combat Medic — the healing-amount multiplier, Maxime's own literal "triple." Kept as a named multiplier (applied to MUNTI_REGEN_PER_TURN at the tickMuntiRegen() call site, engine/mission.ts) rather than a flat HP constant, so retuning the base regen amount later automatically keeps this branch at "3x," not stuck at whatever flat number 3x used to equal. Placeholder in the sense every weapon-branch number in this file is (not run through combat_sim.py), though the multiplier ITSELF is Maxime's own settled call, not a guess needing a playtest pass the way the exact numbers on Riot Drum/Maser Lance/Suppression Autocannon do. */
export const COMBAT_MEDIC_REGEN_MULTIPLIER = 3;

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
  tank_riot_drum: {
    id: "tank_riot_drum",
    displayName: "Riot Drum",
    path: "tank",
    description: `Melee. A landed hit independently rolls a ${Math.round(RIOT_DRUM_KNOCKBACK_CHANCE * 100)}% chance to knock the target back ${RIOT_DRUM_KNOCKBACK_MAGNITUDE} tile and a ${Math.round(RIOT_DRUM_PIN_CHANCE * 100)}% chance to pin it in place for ${RIOT_DRUM_PIN_DURATION_TURNS} turn.`,
  },
  tank_maser_lance: {
    id: "tank_maser_lance",
    displayName: "Maser Lance",
    path: "tank",
    description: "Fires a widening cone in one of 8 directions, friendly-fire capable, 2 charges/mission. Ends your turn.",
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
  reeps_suppression_autocannon: {
    id: "reeps_suppression_autocannon",
    displayName: "Suppression Autocannon",
    path: "reeps",
    description: `A landed hit has a ${Math.round(SUPPRESSION_AUTOCANNON_DEBUFF_CHANCE * 100)}% chance to suppress the target and nearby Bloom for ${SUPPRESSION_AUTOCANNON_DEBUFF_DURATION_TURNS} turns (-${Math.round(SUPPRESSION_AUTOCANNON_DEBUFF_MAGNITUDE * 100)}% ATK).`,
  },
  munti_rapid_response: {
    id: "munti_rapid_response",
    displayName: "Rapid Response",
    path: "munti",
    description: `Repair range extends to ${RAPID_RESPONSE_REPAIR_RANGE} tiles (was ${DEFAULT_REPAIR_RANGE}).`,
  },
  munti_field_doctor: {
    id: "munti_field_doctor",
    displayName: "Field Doctor",
    path: "munti",
    description: `Repair is free (costs 0 actions) once every ${FIELD_DOCTOR_COOLDOWN_TURNS} turns.`,
  },
  munti_combat_medic: {
    id: "munti_combat_medic",
    displayName: "Combat Medic",
    path: "munti",
    description: `Passive regen aura heals ${COMBAT_MEDIC_REGEN_MULTIPLIER}x as much (${MUNTI_REGEN_PER_TURN * COMBAT_MEDIC_REGEN_MULTIPLIER} HP/turn) within ${COMBAT_MEDIC_REGEN_RADIUS} tiles (was ${MUNTI_REGEN_RADIUS}).`,
  },
};

/** Every branch currently buildable for a given class, in unlock order (index 0 = 1st branch a pilot of this path can buy — see this file's own header comment for why that's a hint, not an enforced sequence: any listed branch is buyable at any purchase-order slot). Reeps gets three (Missiles, Rail Lance, then Suppression Autocannon, 5 Sep 2026) — its own full, final track per the source doc's own table, not one slot short the way Meeps/Tank briefly were. Meeps gets three (Impact Lance, Scattershot Pistols, then Shock Claws, 3 Sep 2026) — Shock Claws is the first branch in the file to actually use the status-effect infrastructure (stun, via WEAPON_BRANCH_ON_HIT_EFFECT/MECH_ON_HIT_EFFECTS above and engine/turnManager.ts's applyMechOnHitEffect) rather than just a stat/targeting change. Tank gets three (Grinder Claw, Riot Drum, then Maser Lance, 5 Sep 2026) — Riot Drum was the second branch to use that same status-effect infrastructure and the first to grant more than one on-hit effect off a single hit; Maser Lance is this file's second GRANTED-ABILITY branch after Missiles (MASER_LANCE_GRANT_ABILITY above), and its first non-radius, direction-picked shape. Suppression Autocannon (Reeps' 3rd, same day) is the third branch to use the status-effect infrastructure and the first to reuse the "debuff_attack" kind on the mech->Bloom side. Munti gets three (Rapid Response, Field Doctor, then Combat Medic) — briefly four with Aegis Ward wedged in second (1-5 Sep 2026), cut 12 Sep 2026 once Combat Medic made it a strict downgrade with nothing of its own (see this file's header comment for the full account). "4 per class" was never a hard rule to begin with (claude/Bloom_Wars_Weapon_Branch_Expansion_Plan_v1.md's own finding), so Munti landing back on 3 matches every other path. */
export const WEAPON_BRANCHES_BY_PATH: Record<Path, WeaponBranchId[]> = {
  meeps: ["meeps_impact_lance", "meeps_scattershot_pistols", "meeps_shock_claws"],
  tank: ["tank_grinder_claw", "tank_riot_drum", "tank_maser_lance"],
  reeps: ["reeps_missiles", "reeps_rail_lance", "reeps_suppression_autocannon"],
  munti: ["munti_rapid_response", "munti_field_doctor", "munti_combat_medic"],
};
