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
// mission. The cooldown is what makes it a decision rather than a habit:
// at 2, there is always one blind turn between sweeps.
export const SENSOR_SWEEP_RANGE_BONUS = 2;
export const SENSOR_SWEEP_COOLDOWN_TURNS = 2;

// abil_interdict (Tank). How far the braced Tank's kill-box reaches, in
// Chebyshev tiles — 1 means "the eight tiles it is standing next to."
// Anything larger starts pinning hostiles that never actually came into
// contact with it, which is a different (and much stronger) ability.
export const INTERDICT_RADIUS = 1;

// abil_screen (Munti). How far the concealment reaches from the Munti, in
// Chebyshev tiles. Also 1, and for the opposite reason: the squad has to
// bunch up inside a Bloom swarm's best target shape to get covered at all.
export const SCREEN_RADIUS = 1;
