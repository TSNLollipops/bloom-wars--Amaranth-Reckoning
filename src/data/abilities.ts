// src/data/abilities.ts
// Data Pack §6. Six for the slice. Everything referenced by an archetype
// exists here; nothing here is referenced by nothing.
//
// ---- ABILITY-DEPTH PASS (Maxime, 23 Aug 2026) ----
// System 3 of the three agreed "make a mission last 30+ minutes" passes,
// after fog of war (f2e04e4) and overwatch (47ab304). The diagnosis was
// that every unit had exactly ONE verb — attack, plus Repair on a Munti —
// so a turn was never a decision and a mission resolved in minutes. Each
// path gets one more verb here, and each one is written to cost something
// a player actually wants: three of the four spend the unit's entire
// remaining action budget and end its turn the way Attack and Overwatch
// already do, so using one is always "not shooting this turn."
//
// All four hang off the two systems that just landed rather than sitting
// beside them — abilities that ignore fog and overwatch waste the pairing:
//   abil_sensor_sweep  reveals what the fog is hiding (and was already
//                      defined here and already assigned; it did nothing
//                      before there was a fog of war to cut through)
//   abil_ambush        is the player-side mirror of the fog — the Meeps
//                      becomes the thing that can't be seen — and reuses
//                      overwatch's own held-shot trigger verbatim
//   abil_interdict     hangs off the identical hostile-movement choke
//                      point overwatch fires from, and is vision-gated
//                      with the same isVisibleTo
//   abil_screen        applies that same concealment to the squad
//
// Cost/limit model for each is stated in its own comment below and enforced
// in engine/mission.ts. Tuning constants live in data/combatTables.ts with
// the rest of the house rules.
import type { AbilityDef } from "./types";

export const ABILITIES: Record<string, AbilityDef> = {
  abil_overshield: {
    id: "abil_overshield",
    displayName: "Overshield",
    kind: "passive",
    // While this Tank is on the board and not downed, every adjacent
    // friendly unit gains +1 terrain defence star (10% damage reduction).
    // Does not stack with a second Tank. See engine/combat.ts overshieldBonus().
  },
  abil_repair: {
    id: "abil_repair",
    displayName: "Repair",
    kind: "active",
    // Instead of attacking, restore 30 HP to one adjacent friendly unit.
    // Once per turn. x1.25 if the Munti's mek has Fieldwright as primary.
  },
  abil_cockpit_evac: {
    id: "abil_cockpit_evac",
    displayName: "Cockpit Evac",
    kind: "active_reactive",
    // When an adjacent friendly unit would be reduced to 0 HP, the Munti
    // may instead pull it to an adjacent free tile at 1 HP. Once per
    // mission per Munti. Catches ordinary combat downings only — it must
    // never intercept a scripted remove_from_roster event (Data Pack §6,
    // the cockpit-evac/Mission-3-wipe box). The wipe is not a downing.
  },
  abil_charge: {
    id: "abil_charge",
    displayName: "Charge",
    kind: "passive",
    // Centauroid only. If the unit moved >=3 tiles in an unbroken
    // straight line over cost-1 terrain and attacks at the end of that
    // move, damage x1.25.
  },
  abil_sensor_sweep: {
    id: "abil_sensor_sweep",
    displayName: "Sensor Sweep",
    kind: "active",
    // Vibrissal chassis only — in the Amaranth roster that is Cpl. Anand,
    // the Reeps, whose whole job is seeing the fight before it arrives
    // ("Cpl. Anand's sensor package should keep you off the surprise end
    // of it" — Amaranth I.4's briefing, which until this pass described a
    // capability the game did not have).
    //
    // Run the array: every living hostile within (this unit's vision +
    // SENSOR_SWEEP_RANGE_BONUS) is painted for the whole player side and
    // stays painted until the end of the following enemy turn — through
    // walls, past everyone's sight range, and INCLUDING units that are
    // still burrowed and would otherwise be neither drawn nor targetable
    // (Data Pack §8.1). Painting does not surface a burrower; it only
    // makes it visible, so an Undertow that attacks out of a revealed
    // burrow still gets its surfacing damage bonus.
    //
    // Cost: 1 action, does NOT end the turn, SENSOR_SWEEP_CHARGES_PER_MISSION
    // uses per mission (2, as of 23 Aug 2026 — see combatTables.ts's own
    // comment for the exact request). Deliberately the cheapest of the four
    // new verbs and the only one that leaves the turn alive: the charge
    // count, not the action price, is what makes it a decision — two pings
    // for the whole mission means "spend one now, or hold it for Tunnel
    // Rats' Undertow" is the actual question, not "wait two turns and sweep
    // again for free." What the action DOES cost is the reposition: a
    // 4-move Reeps that sweeps this turn is shooting from where it already
    // stands or not at all.
    //
    // TWO DELIBERATE READINGS of the original Data Pack §6 line, flagged
    // rather than quietly assumed:
    //   1. It was written kind: "passive". A permanently-on aura would
    //      never need the "until the end of the following enemy turn"
    //      expiry the same line specifies, and BattleUnit.revealedUntilTurn
    //      — the field the Data Pack's own shape implies — is a deadline,
    //      not a flag. An activated sweep with a lingering paint is the
    //      only reading both halves of that sentence fit, so kind is
    //      "active" from this pass on.
    //   2. "within this unit's vision radius" is extended by
    //      SENSOR_SWEEP_RANGE_BONUS (data/combatTables.ts). Straight vision
    //      radius would make the ability worth an action only on Mission 4,
    //      since the party already shares sight (engine/ai.ts's
    //      unitsVisibleToSide is a union across the whole roster) — the
    //      small overshoot is what makes it an early-warning ping rather
    //      than a burrower-only tool. It is a tuning number, not canon.
  },
  abil_ambush: {
    id: "abil_ambush",
    displayName: "Ambush",
    kind: "active",
    // MEEPS. Go to ground: hold fire the way Overwatch does AND drop out
    // of the hostile side's sight entirely until this unit's next turn.
    // A concealed unit is invisible to engine/ai.ts's targeting exactly
    // the way a burrowed Bloom is invisible to the player's — reflexive
    // and pack hostiles will not path to it, will not shoot it, and will
    // walk straight past it. When one walks into melee range, the held
    // shot fires through the identical reaction-fire trigger Overwatch
    // uses, and firing gives the position away: concealment ends the
    // instant this unit attacks.
    //
    // The Meeps is the fragile 6-move diver whose problem has always been
    // that arriving means eating the entire hostile turn. This is the
    // answer that fits the path instead of blurring it — it does not make
    // the Meeps tougher, it makes it unfound.
    //
    // Cost: the unit's ENTIRE remaining action budget, ends its turn (the
    // Attack/Overwatch rule, not the 1-action Move/Repair rule) — a unit
    // that could shoot and then vanish would get both halves of the trade.
    // No per-mission or cooldown limit: it is a posture, and paying a
    // whole turn every time is already the price.
    //
    // REFUSED with a hostile already adjacent. You cannot slip away from
    // something standing on top of you, and this is the line that keeps
    // Ambush from being a strictly-better Overwatch for every Meeps in
    // every situation: in contact, Overwatch is the one that still works.
  },
  abil_interdict: {
    id: "abil_interdict",
    displayName: "Interdict",
    kind: "active",
    // TANK. Plant and cover the ground. Until this unit's next turn, any
    // hostile that FINISHES A MOVE within INTERDICT_RADIUS of it, and that
    // it can actually see, loses every remaining action — it walked into
    // the kill-box and gets no attack out of that activation.
    //
    // Hooked into engine/mission.ts's moveHostile(), the single choke point
    // every hostile move already funnels through for reaction fire, and
    // resolved AFTER overwatch so a hostile shot dead on the way in is
    // simply dead rather than dead and pinned. Vision-gated with the same
    // isVisibleTo overwatch uses: a Tank cannot pin what it cannot
    // perceive, so a burrowed Undertow walks through an interdiction
    // untouched unless a Sensor Sweep has painted it first.
    //
    // This is the Tank's stated job — occupying tiles, protecting the
    // backline — turned into a verb: the tile the Tank stands on stops
    // being merely defended and starts being expensive to approach. It
    // deals no damage and adds no damage math; it only takes actions away.
    //
    // Cost: the unit's ENTIRE remaining action budget, ends its turn. No
    // limit and NOT consumed by pinning — unlike Overwatch's one held
    // shot, a braced Tank pins everything that steps into its ring that
    // phase. That asymmetry is deliberate (a 3-move Tank that spent its
    // whole turn to stop exactly one Crawlmass would never be worth it)
    // and it is the obvious tuning knob if it proves too strong: hostiles
    // ALREADY adjacent when the Tank braces are untouched, and anything
    // with reach (a Sporethrower at 2-3) simply never enters the ring.
  },
  abil_screen: {
    id: "abil_screen",
    displayName: "Screen",
    kind: "active",
    // MUNTI. Put a screen up over the aid post: this unit and every
    // same-side unit within SCREEN_RADIUS drop out of the hostile side's
    // sight until their next turn — the same concealment abil_ambush
    // grants, applied to the huddle instead of to one diver, and broken
    // individually the moment a covered unit attacks.
    //
    // The Munti's job is keeping people alive and it is deliberately bad
    // at everything else; this is the version of that job that is not
    // healing. It restores nothing, damages nothing, and moves nobody. It
    // buys the squad one hostile phase in which the Bloom have no target
    // and hold position (engine/ai.ts reflexive/pack: "nothing in sensor
    // range — hold position") — the turn you need to pull a wounded pilot
    // out, or to reset a firing line that got walked over.
    //
    // Cost: 1 action, does NOT end the turn — Screen-then-Repair, or
    // Screen-then-fall-back, is the whole point of a support turn and the
    // two-action house rule exists to allow exactly that. ONCE PER MISSION
    // per Munti, mirroring abil_cockpit_evac's usedEvacThisMission
    // precedent, and for the same reason: an effect that removes the
    // hostile side's ability to act at all must not be a rhythm, it must
    // be the thing you spend and then no longer have.
    //
    // It costs the squad something to be usable at all: SCREEN_RADIUS is
    // 1, so everyone who wants covering has to be bunched around the
    // Munti — which is the position Bloom swarms punish hardest, and the
    // exact position the game otherwise spends its whole time teaching
    // you to avoid.
  },
  abil_clear_bloom: {
    id: "abil_clear_bloom",
    displayName: "Clear Bloom",
    kind: "active",
    // MUNTI. Mission 3's "clean the bloom patch" pass (Maxime, 23 Aug
    // 2026 — the mission's objective is now this, see data/types.ts's
    // CampaignMission.objective "clear_bloom"). Instead of attacking,
    // convert every bloom_mat tile within BLOOM_CLEAR_RADIUS
    // (data/combatTables.ts) — this unit's own tile included — back to
    // plain ground. Nothing about targeting a unit here; it's a radius
    // effect centered on the Munti, same shape as abil_screen.
    //
    // Cost: 1 action, does NOT end the turn — same reasoning as Repair and
    // Screen: a Munti with two actions free can reposition and clear, or
    // clear twice from one spot before the patch's own regrowth tick
    // (engine/mission.ts's tickBloomRegrowth) catches up. No per-mission
    // limit and no cooldown — unlike Screen or Sensor Sweep this isn't a
    // resource to ration, it's the mission's actual job, repeated until
    // the patch is gone.
    //
    // Standing inside bloom_mat to clear it still costs the mat's own
    // turnStartDamage (data/tiles.ts) every turn the Munti lingers there —
    // that chip damage was already the terrain's rule before this pass and
    // is not waived for the unit doing the clearing. Clearing the tile a
    // Munti currently stands on removes that cost starting next turn, not
    // retroactively.
  },
  abil_taunt: {
    id: "abil_taunt",
    displayName: "Taunt",
    kind: "active",
    // MEEPS. Mission-gated, not a chassis/path unlock like everything
    // else here — see CampaignMission.bonusAbilityUnlocks (data/types.ts)
    // for why, and data/campaignAmaranth.ts's mission 8 for where it's
    // actually granted. Every other Meeps chassis already carries
    // abil_ambush, whose whole job is "vanish so the Bloom cannot target
    // this unit." Taunt is the opposite half of that same idea, not a
    // second idea: the same fast diver choosing to become the loudest
    // thing on the field instead of the quietest one.
    //
    // Effect: until this unit's own next turn, every hostile-side
    // targeting rule that is currently deciding between multiple visible
    // targets picks this unit first, full stop — ahead of the mech/boss
    // "kill the Munti" priority check (Maxime, 25 Aug 2026), ahead of a
    // Splitfang/Choir pack's shared "lowest HP x DEF" pick, ahead of plain
    // reflexive's nearest-target rule. It does not make this unit visible
    // to anything that couldn't already see it — no shouting across the
    // map, no bypassing fog of war. It only wins the choice among
    // whichever hostiles already have eyes on it. See engine/ai.ts's
    // `taunting`-check at the top of each of the four targeting
    // functions.
    //
    // Deliberately carries NO defensive bonus — no brace, no damage
    // reduction. The trade is already asymmetric in the right direction
    // without one: a downed Meeps just restocks next mission at no real
    // cost, but a downed Munti (no emergency-replacement system for a
    // combat loss mid-campaign the way the permadeath/recruit-phase
    // system covers a permanent loss) eats a real setback. Softening the
    // risk on the Meeps side would blunt exactly the "real emergency,
    // real cost" gamble this was built to be.
    //
    // Cost: the unit's ENTIRE remaining action budget, ends its turn —
    // same tier as Ambush/Interdict/Overwatch, not the 1-action Screen/
    // Sweep tier. ONCE PER MISSION per Meeps (usedTauntThisMission),
    // mirroring abil_cockpit_evac and abil_screen: an effect that can
    // reliably pull a whole enemy phase off the Munti is spent, not
    // rationed.
  },
  abil_severance: {
    id: "abil_severance",
    displayName: "Severance",
    kind: "party",
    // The Heirloom. See engine/combat.ts SEVERANCE and Data Pack §11.5.
    // Not attached to any archetype — it belongs to the Party.
  },
  abil_fire_support: {
    id: "abil_fire_support",
    displayName: "Fire Support",
    kind: "active",
    // NOT attached to any archetype's own kit — this is an off-board asset
    // (Providence's own guns), not a mech's ability, so it doesn't belong
    // to a Path the way Ambush/Interdict/Screen/Taunt do. Granted to every
    // deployed unit via CampaignMission.bonusAbilityUnlocks the same
    // mission-gated mechanism Taunt uses (data/types.ts), starting Mission
    // 14 "Steel Rain" — "First Providence call-ins." See
    // data/campaignAmaranth.ts's own mission 14 entry for the actual grant
    // (all four paths, not one).
    //
    // Effect: call in a strike centered on any visible tile within this
    // unit's own attack range — every living hostile within
    // FIRE_SUPPORT_RADIUS (data/combatTables.ts) Chebyshev of that tile
    // takes FIRE_SUPPORT_DAMAGE flat, no defense/cover mitigation, no
    // retaliation (it's off-board, nothing to shoot back at). Costs this
    // unit's entire remaining action budget and ends the turn — same tier
    // as Ambush/Interdict/Taunt, not the 1-action Screen/Clear-Bloom tier;
    // calling in a strike and then still moving/shooting in the same turn
    // would be a strictly-better Attack, not a real tradeoff.
    //
    // Charges are shared squad-wide, not per-unit (Mission.
    // fireSupportChargesRemaining, engine/mission.ts) — there's one ship,
    // not one radio per pilot. FIRE_SUPPORT_CHARGES_PER_MISSION (2) is the
    // whole squad's budget for the mission, spent by whichever unit calls
    // it in first. See engine/mission.ts's canFireSupport/fireSupport.
  },
};

// Data Pack §11.5. The Heirloom's own mechanics — hits friend and foe
// alike, no exception, no falloff, no opt-out. This is not a stat block
// tuning knob; softening it is explicitly against the design.
export const SEVERANCE = {
  id: "abil_severance",
  shape: { kind: "line" as const, length: 8, width: 1 },
  damage: 80,
  ignoresTerrain: true,
  ignoresFullHpCap: true, // the only true value of this field in the game
  hitsFriendlies: true, // NOT configurable. Do not add a flag for it.
  vsBloom: "collapse_check" as const, // bypasses endurance entirely
  chargePerTenHpDealt: 1,
  chargePerTenHpTaken: 1,
  maxCharge: 100,
};
