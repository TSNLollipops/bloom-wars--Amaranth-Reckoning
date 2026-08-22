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
