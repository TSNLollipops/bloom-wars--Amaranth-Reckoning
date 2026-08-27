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
