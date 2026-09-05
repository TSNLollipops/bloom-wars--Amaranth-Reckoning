// src/data/combatTables.ts
// Data Pack §7.1 / §7.2 — the base power matrix and tier ladder. Pure data,
// tunable without touching engine logic (Build Brief §2.3, data-first).
import type { Path, Tier } from "./types";

export const POWER: Record<Path, Record<Path, number>> = {
  meeps: { meeps: 55, tank: 30, reeps: 75, munti: 70 },
  tank: { meeps: 65, tank: 40, reeps: 50, munti: 60 },
  reeps: { meeps: 45, tank: 70, reeps: 50, munti: 55 },
  munti: { meeps: 30, tank: 20, reeps: 35, munti: 30 },
};

export const FULL_HP_DAMAGE_CAP = 90;

export const TIERS: Record<Tier, { attack: number; defense: number; hp: number; move: number }> = {
  G: { attack: 100, defense: 100, hp: 100, move: 0 },
  F: { attack: 106, defense: 104, hp: 100, move: 0 },
  E: { attack: 112, defense: 108, hp: 105, move: 0 },
  D: { attack: 118, defense: 113, hp: 110, move: 1 },
  C: { attack: 125, defense: 119, hp: 115, move: 1 },
  B: { attack: 132, defense: 125, hp: 120, move: 1 },
  A: { attack: 140, defense: 132, hp: 130, move: 2 },
  // S — Heirloom-grade, 2 Sep 2026. Granted with an Heirloom, never
  // purchasable (see engine/campaignEconomy.ts's TIER_ORDER, which
  // deliberately excludes it).
  //
  // PLACEHOLDER NUMBERS, still — validated, not yet playtested. These
  // continue the ladder's own established step sizes rather than inventing
  // a jump — across G→A, attack grows ~6-8 per rung, defense ~4-7, hp in
  // occasional +5-10 steps — so A→S is +9/+8/+10, one step past A's own
  // increments and no more. Move deliberately stays at 2: another +1 would
  // put an Heirloom two full tiles ahead of every A-tier pilot, a bigger
  // battlefield change than a tier bump should carry by itself.
  //
  // VALIDATED 2 Sep 2026 — design/combat_sim.py's new §14 ("THE HEIRLOOM
  // S-TIER"). Confirmed via the mech-vs-mech formula (the only combat math
  // that harness covers — resolveAttackOnBloom, the mech-vs-Bloom side, is
  // its own separately-flagged unvalidated gap, untouched by this pass):
  // S never dies in fewer hits than A against any attacker tier this
  // campaign actually fields (G — the typical hostile, C — the toughest
  // named rival, and A itself as a hypothetical future case), across all
  // 48 combinations tested, and every stat sits strictly above A's. One
  // real finding worth remembering before this looks broken in play: 4 of
  // 16 opening-hit matchups against a full-HP G-tier defender land
  // identically for A and S, because A already saturates the 90-damage
  // full-HP cap there — S's attack edge only shows up on tankier targets
  // and on anything already below full HP. Still a placeholder in the
  // sense that nobody has fought with one yet; no longer a placeholder in
  // the sense of "might silently break combat" — that part is checked.
  S: { attack: 149, defense: 140, hp: 140, move: 2 },
};

// Gear-tier pass (sprites/decor, 23 Aug 2026): scenes/Battle.ts draws one
// gold pip per step a unit's gear tier sits above G, top-right corner of the
// sprite (GDD §12). Reuses TIERS' own key order rather than a second
// hardcoded ladder, so a future tier added to TIERS can't silently drift out
// of sync with the pip count. G itself draws zero pips — Battle.ts already
// guards on `pips > 0` — and a unit with no tier (Bloom; see
// engine/units.ts's BattleUnit.tier) never calls this at all.
const TIER_ORDER = Object.keys(TIERS) as Tier[];

export function tierPipCount(tier: Tier): number {
  const idx = TIER_ORDER.indexOf(tier);
  return idx < 0 ? 0 : idx;
}

export const CENTAUROID_CHARGE_MULT = 1.25;

// House rule, NOT in the Data Pack: Maxime's call (22 Aug 2026) after
// playtesting mission 1a — Meeps felt too fragile even with counter. Any
// hit Meeps would take has this chance to whiff entirely instead: as the
// primary target of a mech or Bloom attack, AND as the counter-damage a
// Meeps eats after attacking something that counters back. See
// engine/combat.ts's dodged/counterDodged params — the deterministic
// formula itself (validated against sim_output.txt) is untouched; dodge
// is applied as an explicit override at the call site in engine/mission.ts
// so the combat-resolver test suite stays 100% reproducible.
export const MEEPS_DODGE_CHANCE = 0.4;

// House rule #1b, NOT in the Data Pack: Maxime's call (23 Aug 2026), after
// mission-1/2/3 playtesting — Tank's whole GDD-locked job is to "punish
// anything that comes adjacent" (§4.1), and that promise rang hollow when a
// diving Meeps could dodge the counter 40% of the time, or a Tank's own
// attack against an adjacent Meeps whiffed the same way. Narrow, deliberate
// fix: Meeps cannot dodge a hit whose SOURCE is a Tank — not attacker path,
// not defender path, whichever unit is dealing that specific hit. Applies
// identically whether Tank is the original attacker or the one countering.
// Does not touch the class triangle itself (Reeps still fully outranges
// Tank, Tank still cannot reach a Reeps) — see engine/mission.ts's
// rollMeepsDodge() for the implementation, and
// claude/Bloom_Wars_Spitball_Ideas.md for the full discussion, including the
// ranged-Tank idea that was explicitly rejected alongside this fix.

// House rule #2, NOT in the Data Pack: Maxime's call (22 Aug 2026) — Tank's
// Overshield aura now also grants a real, absorb-before-HP shield pool to
// itself and adjacent allies, rendered as its own blue bar (see
// scenes/Battle.ts). It regenerates a flat amount each turn, but only for a
// unit that took zero damage (shield or HP) since the last tick — get hit
// and the shield stops recharging until you get a clean turn. Step out of
// an eligible Tank's radius and the shield (current AND max) drops to 0
// immediately — it's borrowed from the Tank's presence, not a personal
// stat. See engine/combat.ts's tankShieldEligible/applyMechDamage and
// engine/mission.ts's tickShieldRegen (called once per turn from
// environmentStep, same place deploy-pad repair already lives).
export const TANK_SHIELD_CAPACITY = 20;
export const TANK_SHIELD_REGEN_PER_TURN = 8;

// House rule #3, NOT in the Data Pack: Maxime's call (22 Aug 2026) — every
// living Munti passively radiates a small HP regen to itself and same-side
// allies within a radius, on top of (not instead of) their existing active
// Repair ability. Flat amount, doesn't scale with Fieldwright the way
// Repair's active heal does (kept simple for this first pass — easy to tie
// the two together later if that turns out to feel better). Multiple
// Muntis in range don't stack; presence of at least one is enough. See
// engine/mission.ts's tickMuntiRegen (environmentStep, same place the Tank
// shield tick and deploy-pad repair already live).
export const MUNTI_REGEN_RADIUS = 2;
export const MUNTI_REGEN_PER_TURN = 8;

// House rule #4, NOT in the Data Pack: Maxime's call (22 Aug 2026) — every
// unit gets MAX_ACTIONS_PER_TURN action points instead of the old
// one-move-plus-one-act model. Verified against XCOM 2's real rule (Medikit
// wiki, xcom.fandom.com): Move and Repair each cost 1 action and do NOT end
// the turn — a unit can move twice, repair twice (heal two different
// allies — the whole point, since Maxime wants Munti played "like medics in
// xcom"), or move-then-repair in either order. Attack always consumes ALL
// remaining actions and ends the turn, regardless of which action slot it's
// used in — matching XCOM 2 exactly (a Specialist can heal-then-heal, but
// never heal-then-shoot-then-heal-again). Replaces the old
// movedThisTurn/actedThisTurn booleans on BattleUnit with a single
// actionsRemaining counter (engine/units.ts), and — as a direct consequence
// — removes Repair's separate usedRepairThisTurn once-per-turn cap
// entirely: the action-point budget is now the only limit, so a Munti with
// both actions free really can patch up two allies in one turn. Flagged
// here since that removal wasn't literally asked for, only implied by the
// XCOM-medic framing — worth confirming it feels right in play.
export const MAX_ACTIONS_PER_TURN = 2;

// House rule #6, NOT in the Data Pack: the ability-depth pass (Maxime, 23
// Aug 2026 — "we really need to make our mission last at least 30min"),
// system 3 of 3 after fog of war and overwatch. One new verb per path; the
// rules are in data/abilities.ts and engine/mission.ts, only the numbers
// are here. All four are first-pass values chosen against the class
// identities (GDD §8.2's triangle: Meeps dive, Reeps chip from range, Tank
// holds ground, Munti keeps people alive) and every one of them is cheap to
// retune — none of them feeds engine/combat.ts, because none of these
// abilities deals damage.

// abil_sensor_sweep (Reeps / any vibrissal chassis). Sweep radius is the
// sweeping unit's own vision PLUS this, so the ping reaches a little past
// what the squad can already see — see that ability's own comment for why
// straight vision radius would have made it worth an action on exactly one
// mission.
//
// Was a 2-turn cooldown (unlimited uses over a long mission, just gated
// between them) until Maxime asked for "two scans" on Anand specifically
// and, asked to clarify, confirmed: "I see double scan as two charge each
// mission, every mission. yes." (23 Aug 2026) — every mission, every
// vibrissal pilot, not a Mission-4-only bump. That is a different shape of
// limit than a cooldown (a resource to spend, not a rate to wait out), so
// it replaces the cooldown rather than stacking with it — see
// engine/mission.ts's canSensorSweep/sensorSweep and
// engine/units.ts's sensorSweepUsesRemaining.
export const SENSOR_SWEEP_RANGE_BONUS = 2;
export const SENSOR_SWEEP_CHARGES_PER_MISSION = 2;

// abil_interdict (Tank). How far the braced Tank's kill-box reaches, in
// Chebyshev tiles — 1 means "the eight tiles it is standing next to."
// Anything larger starts pinning hostiles that never actually came into
// contact with it, which is a different (and much stronger) ability.
export const INTERDICT_RADIUS = 1;

// abil_screen (Munti). How far the concealment reaches from the Munti, in
// Chebyshev tiles. Also 1, and for the opposite reason: the squad has to
// bunch up inside a Bloom swarm's best target shape to get covered at all.
export const SCREEN_RADIUS = 1;

// abil_ambush stealth cloak redesign (30 Aug 2026, Maxime: "stealth cloak 3
// turn, can move whilestealth. can attack while stealth. does 2x dmg after
// exiting stealth. its to give sweep a pvp use too and make ambush something
// usefull in game"). Replaces the original one-shot "go to ground, hold a
// shot" version of the ability — see abil_ambush's own comment in
// data/abilities.ts for the full before/after and engine/mission.ts's
// ambush()/resolveAttack() for where these are actually spent.
//
// How many of this unit's own rounds the cloak survives once activated,
// counted the same way every other posture's "until your next turn" already
// is (engine/units.ts's stealthTurnsRemaining, decremented in the
// end-of-hostile-phase loop) — three full rounds of free movement and
// attacks while hidden, not three activations.
export const AMBUSH_STEALTH_DURATION = 3;
// The specific attack that breaks an active ambush cloak — the first one
// made while stealthTurnsRemaining is still > 0 — deals this multiple of its
// normal damage. Screen's concealment is unaffected; this bonus is read off
// stealthTurnsRemaining specifically, which only abil_ambush ever sets.
export const AMBUSH_DECLOAK_DAMAGE_MULTIPLIER = 2;

// House rule #7, NOT in the Data Pack: Mission 3's "clean the bloom patch"
// pass (Maxime, 23 Aug 2026 — see data/types.ts's CampaignMission.objective
// "clear_bloom" and abil_clear_bloom in data/abilities.ts). Two constants,
// two opposing forces: a Munti can burn an action to push the patch back,
// and the patch pushes back on its own on a clock, so standing at the edge
// picking off Crawlmass forever was never a way to win by default.
//
// abil_clear_bloom's own radius, Chebyshev, same convention as
// INTERDICT_RADIUS/SCREEN_RADIUS above — 1 means "this Munti's own tile
// plus the eight around it." At radius 1 a single clear can flip up to 9
// tiles at once, which is intentionally generous: The Low Ground's mat belt
// (data/mapsAmaranth.ts) is large and Warden Company has exactly one Munti
// (Lask) to work it, so the ability needs real reach or clearing the whole
// belt solo is never realistic in one mission.
export const BLOOM_CLEAR_RADIUS = 1;

// abil_fire_support (25 Aug 2026, batch 2 / Mission 14 "Steel Rain" —
// "First Providence call-ins"). Minimal standalone version per Maxime's
// call when this was flagged: a real, usable ability now, not gated behind
// the Antfarm Carrier Hub's own CIC/Energy economy (`claude/
// Bloom_Wars_Antfarm_Carrier_Hub_v1.md` §2/§5), which is still 100% paper —
// nothing there exists to hang a dependency on yet. Same shape as Screen/
// Sensor Sweep (a resource to spend, not a rate to wait out), but the
// resource itself is shared squad-wide rather than per-unit — there is
// only one ship, so `Mission.fireSupportChargesRemaining` (engine/
// mission.ts) is one shared counter any eligible unit can spend from,
// unlike usedScreenThisMission/sensorSweepUsesRemaining which live on the
// individual unit. See engine/mission.ts's canFireSupport/fireSupport for
// the actual verb.
export const FIRE_SUPPORT_CHARGES_PER_MISSION = 2;
// Chebyshev radius of the strike, centered on the called-in tile — same
// "3x3 area" convention as SCREEN_RADIUS/BLOOM_CLEAR_RADIUS above.
export const FIRE_SUPPORT_RADIUS = 1;
// Flat damage to every living hostile in the strike radius, applied
// directly rather than through the normal attack-resolution formula
// (bloomDamage's 100/effectiveDefense scaling, engine/combat.ts) — this is
// an off-board strike, not a mech's own weapon, so it isn't subject to a
// mech's attack stat or a Bloom's defense stat either. Tuned to land
// meaningfully above Crawlmass's 40 endurance (an outright kill) while
// still leaving tougher single targets (Choir's 110, Gallcyst's 140)
// standing — a real dent, not a delete button, on the harder half of the
// current roster. A first-pass placeholder number, same as every other
// unweighted balance constant in this file — not run through combat_sim.py
// or any equivalent, since none of the ability-depth constants before it
// were either (Screen/Taunt/Interdict all shipped the same way).
export const FIRE_SUPPORT_DAMAGE = 60;

// Weapons Bay (28 Aug 2026, Antfarm buildable-bay pass) — see
// `claude/Bloom_Wars_Antfarm_Carrier_Hub_v1.md` §11.2 for the room itself.
// Deliberately does NOT touch FIRE_SUPPORT_CHARGES_PER_MISSION or how it's
// spent — 22 missions (14 through 36) are already tuned against that flat
// 2-charge pool, and this is additive, not a replacement. Building the
// Weapons Bay instead grants ONE bonus Fire Support charge per mission that
// recharges on a real turn-based cooldown (engine/cooldown.ts) once the
// squad's baseline charges are exhausted — the shared "one ship, one
// budget" call-in still exists underneath; the bay just gives that ship a
// second gun to bring back online mid-mission instead of just a bigger
// one-shot pool. Reuses engine/cooldown.ts rather than inventing a bespoke
// counter here specifically because Maxime wants Heirloom to share the same
// primitive later ("heirloom will use same system," 28 Aug 2026) — see
// engine/mission.ts's own fireSupportBonusReadyTurn field for the wiring.
// First-pass placeholder, not run through combat_sim.py — same status as
// FIRE_SUPPORT_DAMAGE above; needs real playtesting once the Weapons Bay is
// actually reachable in a run before this is a tuned number.
export const WEAPONS_BAY_FIRE_SUPPORT_COOLDOWN_TURNS = 3;

// abil_missile (26 Aug 2026) — SOFT pass, see data/abilities.ts's own
// comment for the full design context (a chat conversation about giving
// Reeps' ranged attacks "the impression of distance," which turned into a
// real weapon-path idea: "it's a weapon path. like alternative g-a rank
// weapon upgrade"). Deliberately NOT wired to any real gear-tier fork or
// unlock economy yet — "we gonna build the upgrade path later" — these are
// just the two numbers the mechanic itself needs to run.
//
// Chebyshev radius of the blast, centered on the targeted tile — same
// "3x3 area" convention as INTERDICT_RADIUS/SCREEN_RADIUS/
// BLOOM_CLEAR_RADIUS/FIRE_SUPPORT_RADIUS above. Unlike those, this one
// does NOT filter by side — every living unit in radius takes damage,
// friend or foe (see abil_missile's own comment for why).
export const MISSILE_SPLASH_RADIUS = 1;
// Per-unit budget, not squad-shared (contrast FIRE_SUPPORT_CHARGES_PER_MISSION,
// which is one shared pool for the whole ship) — this is each Reeps' own
// ordnance. First-pass number, same "not run through combat_sim.py yet"
// status as every other ability-depth constant in this file — Maxime's own
// framing ("play around with it") means this is expected to move once
// there's real play data on how much a friendly-fire-capable AOE is worth
// per mission.
export const MISSILE_CHARGES_PER_MISSION = 2;

// Maser Lance (Tank's 3rd weapon branch, data/weaponBranches.ts's
// tank_maser_lance, 5 Sep 2026) — this engine's SECOND granted-weapon-branch
// ability after Missiles just above, and its first non-radius shape. Three
// real design forks got resolved via AskUserQuestion before this was
// buildable, all Maxime's own call, not guessed (see weaponBranches.ts's own
// header comment for the full account):
//   1. A separate granted ability (own action-bar button, own per-mission
//      charge budget, ends the turn), not a modifier on the Tank's ordinary
//      attack — same architecture as Missiles, not a third thing.
//   2. A REAL expanding cone, not a simpler frontal rectangle — 1 tile wide
//      at forward-step 1, 3 wide at step 2, 5 wide at step 3 (width = 2*step
//      - 1), picked from one of 8 directions the same way
//      requiem_severance/cinder_line_signature already pick a direction on
//      this grid (engine/mission.ts's CINDER_LINE_DIRECTIONS, reused again).
//   3. Friendly-fire capable, no side filter — same "doesn't check sides"
//      family as Missiles/abil_severance, not excluded the way
//      abil_fire_support's hostile-only blast is.
//
// MASER_LANCE_CONE_RANGE is how many forward steps the cone reaches (the
// per-step width formula lives in engine/mission.ts's maserLanceConeTiles,
// not here — this constant is only the depth). Not run through
// combat_sim.py, same placeholder status as every other ability-depth
// constant in this file.
export const MASER_LANCE_CONE_RANGE = 3;
// Per-unit budget, same shape as MISSILE_CHARGES_PER_MISSION just above (this
// engine's only other granted-ability weapon branch) — not squad-shared.
// Placeholder, pending real playtesting once a Tank pilot can actually carry
// this into a run.
export const MASER_LANCE_CHARGES_PER_MISSION = 2;

// Regrowth pacing — first tick, then repeat interval, then how many NEW
// tiles convert per tick (engine/mission.ts's tickBloomRegrowth). Kept
// deliberately small and DETERMINISTIC (no Math.random — see that method's
// own comment for the exact scan-order rule) rather than a percentage
// chance per tile: a chance-based spread is much harder to reason about or
// write a stable regression test against, and the pressure this is meant to
// create is "don't dawdle," not "the patch might suddenly swallow the
// board." First-pass numbers, same as MEEPS_DODGE_CHANCE and the ability-
// depth pass's own constants — worth revisiting once there's real play data
// on whether one Munti can outpace this comfortably.
export const BLOOM_REGROWTH_FIRST_TURN = 4;
export const BLOOM_REGROWTH_INTERVAL_TURNS = 3;
export const BLOOM_REGROWTH_TILES_PER_TICK = 2;

// Protect Asset (Mission 22 "Ash on the Water," 25 Aug 2026) — see
// data/types.ts's CampaignMission.objective comment for the full design.
// Zone-tick, chosen via AskUserQuestion over an on-board defendable unit
// or a flat hostile-headcount tick. Default ship toughness: enough turns
// of "a couple hostiles got through" to be recoverable, not enough that a
// squad that's fully lost the perimeter can coast to the turn limit
// anyway — a first-pass placeholder, same status as every other
// unweighted balance constant in this file, subject to real npm run sim
// tuning per mission same as everything else in this batch.
export const PROTECT_ASSET_DEFAULT_MAX_HP = 300;
// Per hostile, per turn, that ends its turn anywhere inside
// MapDefinition.defendZone — deliberately NOT per hostile that attacks
// anything, so the pressure is "keep the perimeter clear," not "keep the
// ship's own HP topped up between hits." A tank-tough perimeter breach
// only ever wants ONE hostile through per turn to hurt (this number), not
// a whole swarm parked there to combo it.
export const PROTECT_ASSET_TICK_DAMAGE = 25;

// ---- Vault Phase 2, slice 1 (2 Sep 2026) — the first 5 Heirloom abilities
// wired into combat: oath_iron_word, lastword_field_triage,
// farsight_signature, salt_root_salt, ledger_overextended. See
// claude/Bloom_Wars_Build_Log_Addendum_VaultPhase2Slice1_02Sep2026.md.
//
// RANK SCALING, stated once here rather than on every constant below: each
// of these five abilities' entry in data/heirlooms.ts gives only a rank-1
// value and a rank-5 value in prose ("ranks 2-4 scale between the two" is
// the general framing, but none of these five actually have a numeric
// midpoint to scale toward — a radius of 2 has no sensible "2.5", a 1-turn
// duration has no sensible "1.5"). Read literally as a flat rank1 number that
// steps up ONE time, at rank 5 — ranks 2-4 are identical to rank 1. That's an
// interpretation call, not spec, flagged here rather than buried in engine
// code: every RANK5 constant below names what changes at max rank, and
// engine/mission.ts's own methods gate on `rank >= 5`, nothing in between.

/** oath_iron_word (Vindex/The Iron Oath) — Chebyshev radius at rank 1-4. Rank 5: IRON_WORD_RANK5_RADIUS. */
export const IRON_WORD_RADIUS = 2;
export const IRON_WORD_RANK5_RADIUS = 3;
/** Turns between uses (data/heirlooms.ts's own cooldownTurns for oath_iron_word, transcribed here since engine/mission.ts's cooldown helpers take a plain number, not a HeirloomAbility lookup). */
export const IRON_WORD_COOLDOWN_TURNS = 3;

/** lastword_field_triage (Migawari/The Last Word) — Chebyshev radius at rank 1-4. Rank 5: FIELD_TRIAGE_RANK5_RADIUS. */
export const FIELD_TRIAGE_RADIUS = 2;
export const FIELD_TRIAGE_RANK5_RADIUS = 3;
/**
 * Targets healed per use. The ability text says "two allies in radius 2" —
 * read here as a self-centered radius effect capped at this many targets
 * (nearest-neediest first: living allies below max HP, closest first),
 * mirroring abil_screen/abil_clear_bloom's existing no-target-picker,
 * press-the-button shape rather than building a new manual 2-target picker
 * UI. Flagged as a real simplification, not hidden: a manual picker is a
 * genuinely different (and heavier) UI pattern than anything else in this
 * ability bar, and this reuses what's already shipped and tested.
 */
export const FIELD_TRIAGE_MAX_TARGETS = 2;
export const FIELD_TRIAGE_COOLDOWN_TURNS = 3;

/** farsight_signature (Panoptes/Farsight's Reckoning) — reveal duration in turns at rank 1-4. Rank 5: FARSIGHT_SIGNATURE_RANK5_DURATION. Global (whole-map) reveal, so unlike abil_sensor_sweep there is no radius constant here. */
export const FARSIGHT_SIGNATURE_DURATION_TURNS = 1;
export const FARSIGHT_SIGNATURE_RANK5_DURATION_TURNS = 2;
export const FARSIGHT_SIGNATURE_COOLDOWN_TURNS = 5;

/**
 * salt_root_salt (Delenda/Salt the Root) — passive, no cooldown (matches
 * data/heirlooms.ts's own cooldownTurns: 0 for this ability, "never ready
 * or recharging, simply applies").
 *
 * DEFENDER CATEGORY, flagged: the ability text names "Gallcyst-family, the
 * Wellroot, the Unnamed" as sessile/hive-type. data/bloom.ts already tags
 * each Bloom archetype with `movementType`, and exactly those three carry
 * "sessile" — PLUS a fourth, the Heartwood (Act I's boss), which is also
 * movementType "sessile" but isn't named in the ability text. Read here as
 * `movementType === "sessile"`, which catches all four rather than
 * hardcoding the three named ids — the Heartwood not being named reads more
 * like an oversight (it's literally the same lineage the Unnamed grows from)
 * than a deliberate exclusion, but this is a real interpretation call, not
 * spec, worth Maxime's eyes.
 */
export const SALT_ROOT_SESSILE_MULTIPLIER = 1.6;
export const SALT_ROOT_OTHER_MULTIPLIER = 0.7;
export const SALT_ROOT_RANK5_OTHER_MULTIPLIER = 0.85;

/** ledger_overextended (Skuld/Widow's Ledger) — self buff duration in turns at rank 1-4. Rank 5: LEDGER_OVEREXTENDED_RANK5_DURATION_TURNS. */
export const LEDGER_OVEREXTENDED_ATK_MULTIPLIER = 1.4;
/**
 * "0 DEF" read literally would divide by zero in engine/combat.ts's damage
 * formula (`100 / defender.effectiveDefense`) — Infinity/NaN damage, not a
 * bigger number. Floored at the smallest defense value that keeps the
 * formula finite while still reading as "as good as no defense at all."
 * Flagged as an engineering interpretation of flavor text, not a design
 * number pulled from a doc.
 */
export const LEDGER_OVEREXTENDED_DEFENSE_FLOOR = 1;
export const LEDGER_OVEREXTENDED_DURATION_TURNS = 1;
export const LEDGER_OVEREXTENDED_RANK5_DURATION_TURNS = 2;
export const LEDGER_OVEREXTENDED_COOLDOWN_TURNS = 2;

// ---- Vault Phase 2, slice 2 (3 Sep 2026) — the three Heirloom SIGNATURE
// abilities wired into combat this pass: ledger_entry, oath_oathkeeper,
// deadfall_strike. See data/heirlooms.ts's own "VAULT PHASE 2, SLICE 2"
// header and claude/Bloom_Wars_Build_Log_Addendum_VaultPhase2Slice2_
// 03Sep2026.md for the full account. Same "rank1 gives a flat value, rank5
// steps it once, ranks 2-4 are identical to rank 1" reading slice 1's own
// header comment above states, applied again here for the same reason:
// none of these three ability texts give a numeric midpoint to scale toward.

/**
 * ledger_entry (Skuld/Widow's Ledger) — "+8% damage per kill this mission,
 * stacking, for the rest of the mission." The percentage itself doesn't
 * change at rank 5; what rank 5 changes is the stack CAP (raised) and adds
 * a one-time move-range bonus past a threshold — see the two constants
 * below.
 */
export const LEDGER_ENTRY_DAMAGE_PER_STACK = 0.08;
/**
 * PLACEHOLDER, flagged: rank1's own prose gives no explicit ceiling
 * ("stacks... for the rest of the mission," read literally, is unbounded).
 * Picked as a reasoned, not simulated, cap — +40% at rank1 is already a
 * serious spike from one weapon's own passive, and "stack cap raised" at
 * rank 5 needs headroom to mean something against this number.
 * combat_sim.py has not validated either cap.
 */
export const LEDGER_ENTRY_STACK_CAP = 5;
/** Rank 5's raised cap — same placeholder status as the rank-1 cap above. */
export const LEDGER_ENTRY_RANK5_STACK_CAP = 10;
/**
 * Rank 5's "the bonus also applies to move range past 3 stacks" — read as a
 * ONE-TIME +LEDGER_ENTRY_MOVE_BONUS_AMOUNT move-range grant the instant this
 * wielder's own kill count first exceeds this threshold, not a per-stack or
 * per-turn scaling: the prose gives no formula for how big or how often a
 * move bonus should reapply, and letting it re-add on every kill past 3
 * would compound in a way nothing else in this file does. PLACEHOLDER,
 * flagged — see engine/mission.ts's resolveKill for where this actually
 * fires, exactly once per mission per wielder (BattleUnit.
 * ledgerEntryMoveBonusApplied guards the re-fire).
 */
export const LEDGER_ENTRY_MOVE_BONUS_THRESHOLD = 3;
export const LEDGER_ENTRY_MOVE_BONUS_AMOUNT = 1;

/**
 * oath_oathkeeper (Vindex/The Iron Oath) — "Cannot be reduced below 1 HP for
 * N turns. All spared damage lands the instant it ends." Self-triggered,
 * cooldown-gated (data/heirlooms.ts's own cooldownTurns: 5).
 */
export const OATHKEEPER_HP_FLOOR = 1;
/** Duration in turns at rank 1-4. Rank 5: OATHKEEPER_RANK5_DURATION_TURNS. Same "survives N hostile phases" shape LEDGER_OVEREXTENDED_RANK5_DURATION_TURNS already established — see engine/mission.ts's turn-start loop for the decrement. */
export const OATHKEEPER_DURATION_TURNS = 2;
export const OATHKEEPER_RANK5_DURATION_TURNS = 3;
/** Rank 5's "the deferred damage is halved on landing instead of full." */
export const OATHKEEPER_RANK5_DEFERRED_MULTIPLIER = 0.5;
export const OATHKEEPER_COOLDOWN_TURNS = 5;

/**
 * deadfall_strike (Ichigeki/Deadfall) — "An unavoidable, uncounterable
 * strike at x2 damage, any range." Applied to the SAME base-damage
 * computation a normal hit already uses (engine/combat.ts's
 * resolveMechAttack/resolveAttackOnBloom), then doubled — see
 * engine/mission.ts's deadfallStrike() for the range/dodge/counter bypass.
 */
export const DEADFALL_STRIKE_DAMAGE_MULTIPLIER = 2;
export const DEADFALL_STRIKE_COOLDOWN_TURNS = 5;

// ---- Vault Phase 2, slice 3 (3 Sep 2026) — Surtr's full 3-ability kit:
// cinder_line_signature, cinder_firebreak, cinder_draft. See data/
// heirlooms.ts's own "VAULT PHASE 2, SLICE 3" header and this file's own
// engine/mission.ts SurtrLine block for the mechanic these constants feed.
// Every number below IS explicit in cinder_line's own rank1/rank5 prose or
// its cooldownTurns field (data/heirlooms.ts) — nothing here is a numeric
// placeholder the way LEDGER_ENTRY_STACK_CAP above is. The placeholder
// judgment calls this kit actually makes are all MECHANIC shape, not
// numbers, and are flagged as comments on the engine code that makes them
// (line direction/length selection, whether each ability ends the turn,
// what "remaining total damage" means for Firebreak's rank-5 burst) rather
// than here.

/** "A chosen line of up to 5 tiles" — the max tile count a single signature cast can ignite, and (see engine/mission.ts's getCinderLineAreaFrom) the max reach in any of the 8 directions the click-to-target fallback offers. */
export const CINDER_LINE_MAX_TILES = 5;
/** "15 damage/turn to anything standing on it, hostile or friendly" — unchanged at rank 5 (the rank5 text says so explicitly: "damage unchanged"). Flat, no defense mitigation — mirrors bloom_mat's own TileDef.turnStartDamage (data/tiles.ts), the existing hazard-tile precedent this kit is built alongside rather than on top of. */
export const CINDER_LINE_DAMAGE_PER_TURN = 15;
/** Duration in turns at rank 1-4. Rank 5: CINDER_LINE_RANK5_DURATION_TURNS. Same "N environment-step ticks, then gone" shape LEDGER_OVEREXTENDED_DURATION_TURNS/OATHKEEPER_DURATION_TURNS already establish for a wielder-side duration clock, applied here to a placed hazard instead of a unit posture. */
export const CINDER_LINE_DURATION_TURNS = 3;
export const CINDER_LINE_RANK5_DURATION_TURNS = 4;
/** data/heirlooms.ts cinder_line_signature.cooldownTurns. */
export const CINDER_LINE_SIGNATURE_COOLDOWN_TURNS = 5;

/** data/heirlooms.ts cinder_firebreak.cooldownTurns — "Instantly extinguish one of the wielder's own active Surtr lines," rank 5 adds a one-time AoE burst (see engine/mission.ts's firebreak() for what "the line's remaining total damage" is computed as — a placeholder READING of that phrase, not a number, flagged there). */
export const CINDER_FIREBREAK_COOLDOWN_TURNS = 1;

/** cinder_draft — "Allies moving through a friendly Surtr line take no burn damage for 1 turn." Rank 5: CINDER_DRAFT_RANK5_DURATION_TURNS. Same duration-clock shape as CINDER_LINE_DURATION_TURNS above, applied to the line's own friendly-immunity window instead of its burn window. */
export const CINDER_DRAFT_DURATION_TURNS = 1;
export const CINDER_DRAFT_RANK5_DURATION_TURNS = 2;
/** data/heirlooms.ts cinder_draft.cooldownTurns. */
export const CINDER_DRAFT_COOLDOWN_TURNS = 3;

// ---- Vault Phase 2, slice 4 (3 Sep 2026) — Zanretsu's full 3-ability kit:
// cutting_room_charge, cutting_room_momentum, cutting_room_sure_footing.
// See data/heirlooms.ts's own "cutting_room" entry and engine/mission.ts's
// cuttingRoomCharge() for the full mechanic design — that method's own
// header comment is where every MECHANIC-shape judgment call (line
// direction, "which tiles count as the line," the zero-hit landing
// fallback) is flagged, the same split cinder_line's own header comment
// above establishes between "numbers live here" and "shape lives on the
// engine code." The two genuinely unvalidated NUMBERS this kit adds (max
// line length, 3rd+ falloff) are flagged individually below; every other
// constant here is explicit in cutting_room's own rank1/rank5 prose or its
// cooldownTurns field (data/heirlooms.ts).

/**
 * "A straight line" — max reach, in tiles, from the wielder's own adjacent
 * tile outward. PLACEHOLDER: cutting_room_charge's own prose gives no
 * number at all (unlike cinder_line_signature's explicit "up to 5 tiles").
 * Borrowed from CINDER_LINE_MAX_TILES as the closest existing "line
 * ability" precedent in this codebase, but kept as its OWN constant rather
 * than importing that one directly — a future tuning pass on Surtr's own
 * line length shouldn't silently retune Zanretsu's too. Deliberately NOT
 * derived from the wielder's own moveRange (see cuttingRoomCharge()'s own
 * header comment for why coupling it to moveRange would create an
 * unwanted feedback loop with cutting_room_momentum's own +2 move grant).
 * Not run through combat_sim.py.
 */
export const CUTTING_ROOM_CHARGE_MAX_LINE_TILES = 5;
/**
 * "Damage falls off against the 3rd+ target hit" — PLACEHOLDER reading:
 * a flat multiplier applied to every hit from the 3rd one on (not an
 * increasingly steep falloff per target past the 2nd), since the prose
 * gives no formula and a flat number is the simplest reading that still
 * respects "falls off" as written. Rank 5 removes this entirely (every
 * target takes full damage) per that rank's own prose. Not run through
 * combat_sim.py.
 */
export const CUTTING_ROOM_CHARGE_FALLOFF_MULTIPLIER = 0.5;
/** data/heirlooms.ts cutting_room_charge.cooldownTurns. */
export const CUTTING_ROOM_CHARGE_COOLDOWN_TURNS = 4;

/** "+2 move" — explicit in cutting_room_momentum's own rank1 prose. */
export const CUTTING_ROOM_MOMENTUM_MOVE_BONUS = 2;
/** "+10% ATK" — explicit in cutting_room_momentum's own rank5 prose. */
export const CUTTING_ROOM_MOMENTUM_ATK_BONUS_PCT = 0.1;

/** Duration in turns at rank 1-4 (explicit in cutting_room_sure_footing's own rank1 prose). Rank 5: CUTTING_ROOM_SURE_FOOTING_RANK5_DURATION_TURNS. Same "N hostile phases survived" shape OATHKEEPER_DURATION_TURNS/CINDER_DRAFT_DURATION_TURNS already establish. */
export const CUTTING_ROOM_SURE_FOOTING_DURATION_TURNS = 1;
/** Explicit in cutting_room_sure_footing's own rank5 prose ("Duration 2 turns"). */
export const CUTTING_ROOM_SURE_FOOTING_RANK5_DURATION_TURNS = 2;
/** data/heirlooms.ts cutting_room_sure_footing.cooldownTurns. */
export const CUTTING_ROOM_SURE_FOOTING_COOLDOWN_TURNS = 2;

// ---- Vault Phase 2, slice 5 (3 Sep 2026) — Migawari's remaining 2 of 3
// abilities: lastword_signature, lastword_last_rites (Osric Ferrow, House
// Ferrow, Munti path). lastword_field_triage is already live (slice 1, 2
// Sep 2026) and untouched by this slice. See data/heirlooms.ts's own
// "last_word" entry for the full rank1/rank5 prose, and engine/mission.ts's
// lastWordSignature()/lastRites() for the mechanic-shape judgment calls
// (both flagged there, not repeated here).

/**
 * lastword_signature (Migawari/The Last Word) — "Fully restores one downed
 * ally mid-mission, no spare part spent. The wielder's own max HP is
 * permanently reduced 10% for the rest of the campaign, each use." /
 * rank5: "The permanent cost drops to 5% per use — never removed entirely,
 * only softened."
 *
 * Both numbers ARE explicit in the prose (10%, 5%) — the one real judgment
 * call this pair makes is storing them as MULTIPLIERS (0.9, 0.95) that
 * compound MULTIPLICATIVELY use over use, rather than as flat percentages
 * subtracted from the pilot's original base. That choice is genuinely
 * load-bearing, not cosmetic: two rank-1 uses under this reading leave
 * 0.9 * 0.9 = 81% of the ORIGINAL max HP, not 100% - 10% - 10% = 80% under
 * a flat-subtraction reading — close for two uses, but the two readings
 * diverge hard with more of them, and only the multiplicative one has the
 * property that matters most for a "permanent, repeatable" cost: no number
 * of uses can ever drive max HP to 0 or below. A flat 10%-of-original
 * subtracted ten times reaches zero exactly, and an eleventh use would go
 * negative — a wielder who leans on Migawari hard would eventually be
 * unfieldable or the engine would need a floor clamp invented from
 * nowhere. Multiplicative compounding needs no such clamp; it asymptotes
 * toward zero and never reaches it. Standard game-design shape for a
 * repeatable permanent cost (armor durability loss, stacking debuffs) for
 * exactly this reason. Not run through combat_sim.py — this is a
 * permanent-cost/campaign-persistence mechanic, not a per-hit damage
 * number the sim evaluates.
 */
export const LAST_WORD_SIGNATURE_HP_MULTIPLIER_RANK1 = 0.9;
export const LAST_WORD_SIGNATURE_HP_MULTIPLIER_RANK5 = 0.95;
/** data/heirlooms.ts lastword_signature.cooldownTurns. */
export const LAST_WORD_SIGNATURE_COOLDOWN_TURNS = 6;

/**
 * lastword_last_rites (Migawari/The Last Word) — "A downed ally (not yet
 * lost to permadeath) can act one final time this turn before resolving."
 * / rank5: "The ally also gets a full heal for that one action, then goes
 * down again as normal."
 *
 * PLACEHOLDER, flagged: how many action points "act one final time" grants
 * is not itself a number the prose states. Read as exactly ONE action —
 * "one final time," singular, read literally — rather than this game's
 * normal MAX_ACTIONS_PER_TURN (2) full budget; the more conservative of
 * the two readings, and the one that keeps a revived corpse from
 * out-acting a unit that was never downed at all. Not run through
 * combat_sim.py, same reason as LAST_WORD_SIGNATURE_HP_MULTIPLIER_RANK1
 * above.
 */
export const LAST_RITES_ACTIONS_GRANTED = 1;
/** data/heirlooms.ts lastword_last_rites.cooldownTurns. */
export const LAST_RITES_COOLDOWN_TURNS = 5;

// ---- Vault Phase 2, slice 6 (3 Sep 2026) — Simulacrum/The Stolen Seal ----
// (stolen_seal, ABERRATION track — no aristocrat pilot; see data/heirlooms.ts's
// own header for what that distinction means). All three numbers below back
// engine/mission.ts's sealBorrowedAuthority()/ledgerhallStatic()/
// rollInheritedWeight(); none of this has been run through combat_sim.py or
// an equivalent — same "argued, not simulated" status as every other
// Heirloom placeholder number in this file.

/** data/heirlooms.ts seal_borrowed_authority.cooldownTurns. */
export const SEAL_BORROWED_AUTHORITY_COOLDOWN_TURNS = 5;

/** data/heirlooms.ts seal_ledgerhall_static.cooldownTurns. */
export const SEAL_LEDGERHALL_STATIC_COOLDOWN_TURNS = 4;
/**
 * "Jams one random enemy ability for 2 turns" (rank1). Rank5's own text
 * ("Jams the target's strongest available ability specifically") changes
 * WHICH ability gets picked, not how long the jam lasts — it doesn't
 * restate a duration at all, read as leaving rank1's stated 2 turns
 * unchanged rather than silently doubling it or some other invented number.
 */
export const SEAL_LEDGERHALL_STATIC_JAM_DURATION_TURNS = 2;

/**
 * seal_ledgerhall_static rank5 — "the target's strongest available ability
 * specifically." PLACEHOLDER, flagged as more speculative than most: this
 * engine has no real numeric "how strong is this ability" measurement
 * anywhere (grep-confirmed), so there is nothing principled to rank
 * against. This is an authored, arguable ordering over the ability ids that
 * actually appear in a hostile mech's own `abilities` array (UNIT_ARCHETYPES,
 * data/units.ts — Bloom-shape hostiles carry none at all, see
 * getLedgerhallStaticTargetsFrom's own comment) — defensive/battlefield-
 * control tools ranked above mobility/stealth, ranked above pure support —
 * picked for having SOME reasoned shape rather than none, not derived from
 * any measured combat weight. Doubly moot in practice today: see
 * BattleUnit.jammedAbilityId's own comment for why nothing in
 * engine/ai.ts's decideHostileAction currently reads a jam at all — this
 * table decides which ability id gets RECORDED as jammed, not which one a
 * hostile is actually prevented from using, since there is no per-ability
 * hostile AI to prevent anything from in the first place yet.
 */
export const SEAL_LEDGERHALL_STATIC_ABILITY_PRIORITY: Record<string, number> = {
  abil_overshield: 5,
  abil_interdict: 4,
  abil_charge: 3,
  abil_ambush: 3,
  abil_sensor_sweep: 2,
  abil_repair: 1,
  abil_cockpit_evac: 1,
  abil_screen: 1,
  abil_clear_bloom: 1,
};

/**
 * data/heirlooms.ts seal_inherited_weight — "At mission start, roll a
 * random DEF bonus (0 to +15) for the whole mission" (rank1); "The roll's
 * floor narrows to +8 to +15 — still random, never bad" (rank5). Both
 * numbers are explicit in the prose; the only judgment call is HOW the roll
 * is drawn (a uniform integer draw inclusive of both ends, same convention
 * as every other die-roll-shaped random number in this codebase), not what
 * the bounds are.
 */
export const SEAL_INHERITED_WEIGHT_DEF_BONUS_MIN_RANK1 = 0;
export const SEAL_INHERITED_WEIGHT_DEF_BONUS_MAX_RANK1 = 15;
export const SEAL_INHERITED_WEIGHT_DEF_BONUS_MIN_RANK5 = 8;
export const SEAL_INHERITED_WEIGHT_DEF_BONUS_MAX_RANK5 = 15;

// ---- Beacon Control (claude/Bloom_Wars_Beacon_Restock_Economy_v1.md,
// built 4 Sep 2026) — the mission-mechanic half of the feature. Point costs
// (crate/charge price, revive-payout percentage, starting stockpile) live
// in engine/campaignEconomy.ts and engine/campaignState.ts instead, next to
// every other economy number, same file-split this codebase already keeps
// everywhere else (combat/mission mechanics here, points economy there).

/**
 * §2: "up to 3 beacons per mission, each usable once." A per-mission cap
 * on PLACEMENTS, separate from the crate/charge stockpile that also gates
 * each use — a squad that somehow had unlimited crates and charges still
 * couldn't place a 4th beacon in one mission.
 */
export const BEACON_MAX_PER_MISSION = 3;
