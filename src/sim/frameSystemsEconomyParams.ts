// src/sim/frameSystemsEconomyParams.ts
//
// Hypothesis inputs for the Frame Systems Layer economy sim
// (runFrameSystemsEconomySim.ts) — NOT shipped game data, and nothing here
// is wired into the live game. Everything below is either:
//
//   (a) transcribed straight from
//       claude/Bloom_Wars_Frame_Systems_Layer_v1.md §3/§7/§8/§9 — the tier
//       capacity table and the salvage Draw surcharge are both real,
//       already-decided doc content, not invented here; or
//   (b) a genuine PLACEHOLDER, invented for this harness only, because the
//       design doc explicitly has no real number yet. §12, verbatim: "every
//       Draw number, every cost, and every tier capacity in this doc is a
//       guess with a shape, not a tuned value." That's the whole reason
//       this harness exists — to stop guessing blind before Tier 1 gets
//       built, per the 27 Aug 2026 decision ("the economy sim harness gets
//       built first, before Tier 1").
//
// If/when Tier 1 actually gets built, its real constants belong in a real
// data file (e.g. src/data/frameSystems.ts) — this file is scratch for
// tuning those numbers against a plausible campaign before a single line
// of shop UI exists, the same relationship design/combat_sim.py has to
// Data Pack numbers before they're locked in. Every placeholder constant
// is named with that word so nobody mistakes a guess for a decided number
// later, matching this project's own "label placeholders in the code
// itself" rule (Foundation.md, Working rules).
//
// Decisions folded in from the 6 Sep 2026 Frame Systems Layer chat pass
// (see the dated build-log addendum for the full record):
//   - Core system is GRANTED FREE at B tier — costs nothing, so it needs
//     no line in this file at all.
//   - The A-tier Refit is the sole capstone purchase; Meeps/Tank are NOT
//     forced into a 4th weapon branch to match Munti's new 4th. Confirmed
//     against data/weaponBranches.ts's live WEAPON_BRANCHES_BY_PATH:
//     meeps/tank/reeps carry exactly 3 branches each, munti carries 4 —
//     this harness reads that array directly rather than assuming a count.
//   - Tier 1 and salvage ship TOGETHER, not staggered — this file prices
//     both from day one rather than modeling a later salvage unlock wave.
//   - An Heirloom holder (Bosk today) still climbs the ordinary ladder,
//     but Requiem takes their core slot. Since the core is free either
//     way, this has zero effect on the PERSONAL-POINTS economy this
//     harness models — noted here so it's clear the omission is
//     deliberate, not an oversight.
import type { Tier } from "../data/types";
import {
  FRAME_TIER_CAPACITY as SHIPPED_FRAME_TIER_CAPACITY,
  FRAME_SYSTEM_POINTS_PER_DRAW,
  FRAME_REFIT_COST,
  SALVAGE_NON_RUNEMASTER_DRAW_SURCHARGE as SHIPPED_SALVAGE_SURCHARGE,
  FRAME_SYSTEMS,
} from "../data/frameSystems";

// ---- Tier 1 shipped, 6 Sep 2026 — the real numbers now live in
// data/frameSystems.ts and this file RE-EXPORTS them rather than carrying
// its own copies, the same "the harness can never quietly drift from the
// shipped economy the way a hand-copied number could" discipline
// runFrameSystemsEconomySim.ts already applies to KILL_BONUS/TIER_UPGRADE_
// COST/WEAPON_BRANCH_COSTS. The PLACEHOLDER_* names below are kept so the
// harness reads unchanged; each is now an alias of the shipped constant,
// and the honest status of every one of them ("a guess with a shape") is
// documented once, on the data file, not twice.

export interface FrameTierCapacity {
  mounts: 1 | 2;
  draw: number;
}

/** data/frameSystems.ts's own table, minus the S row the harness never simulates (nothing here climbs to S). */
export const FRAME_TIER_CAPACITY: Record<Exclude<Tier, "S">, FrameTierCapacity> = {
  G: SHIPPED_FRAME_TIER_CAPACITY.G,
  F: SHIPPED_FRAME_TIER_CAPACITY.F,
  E: SHIPPED_FRAME_TIER_CAPACITY.E,
  D: SHIPPED_FRAME_TIER_CAPACITY.D,
  C: SHIPPED_FRAME_TIER_CAPACITY.C,
  B: SHIPPED_FRAME_TIER_CAPACITY.B,
  A: SHIPPED_FRAME_TIER_CAPACITY.A,
};

export const SALVAGE_NON_RUNEMASTER_DRAW_SURCHARGE = SHIPPED_SALVAGE_SURCHARGE;

/** Alias of data/frameSystems.ts's FRAME_SYSTEM_POINTS_PER_DRAW — see that constant's own comment. */
export const PLACEHOLDER_POINTS_PER_DRAW = FRAME_SYSTEM_POINTS_PER_DRAW;

/** Alias of data/frameSystems.ts's FRAME_REFIT_COST — see that constant's own comment. */
export const PLACEHOLDER_REFIT_COST = FRAME_REFIT_COST;

/**
 * PLACEHOLDER. Kills of a given Bloom archetype needed before that
 * archetype's salvage system becomes purchasable (§7: "Wellroot Filament
 * needs Wellroot kills," etc.). The doc says the counter should start
 * recording silently from day one but never proposes a threshold. 15 is
 * picked so a company that's meeting an archetype regularly (a few kills a
 * mission, across however many missions actually feature it) unlocks that
 * archetype's system somewhere in the first third of the campaign — not
 * immediately, and not never.
 */
export const PLACEHOLDER_SALVAGE_KILL_THRESHOLD = 15;
// ^ SUPERSEDED for the shipped data, kept for the harness's simplified
// aggregate model only: data/frameSystems.ts gates each salvage system on
// its OWN archetype and count (both shipping salvage sources are bosses
// that spawn once per campaign, so their real gate is 1 kill, not 15 —
// a flat 15 would have made both unreachable; see that file's header).
// This harness doesn't model per-archetype spawn lists, so it keeps its
// one aggregate counter against this one threshold as a stand-in for "the
// commoner salvage sources the doc names but Tier 1 didn't ship." Worth a
// real rework when the non-boss salvage systems (Tier 2/3) are built.
export const SHIPPED_SALVAGE_GATES = Object.values(FRAME_SYSTEMS)
  .filter((d) => d.salvage)
  .map((d) => ({ systemId: d.id, archetypeId: d.salvage!.archetypeId, kills: d.salvage!.kills }));

/**
 * PLACEHOLDER distribution for a bought system's Draw cost, sampled per
 * purchase. §5's own catalog of 13 pure-number systems runs roughly 7 at 1
 * Draw, 4 at 2, 2 at 3 — this mirrors that shape rather than assuming a
 * flat number, since a policy that only ever buys 1-Draw systems would
 * understate how fast Draw budget actually fills in play.
 */
export const SYSTEM_DRAW_COST_WEIGHTS: readonly { draw: 1 | 2 | 3; weight: number }[] = [
  { draw: 1, weight: 7 },
  { draw: 2, weight: 4 },
  { draw: 3, weight: 2 },
];

/**
 * PLACEHOLDER. Fraction of a company's roster whose mek's primary or
 * secondary track is Runemaster — needed to decide who pays the §7
 * salvage Draw surcharge. No canon number exists; five tracks exist
 * (fabricator/armorer/runemaster/fieldwright/quartermaster — data/types.ts
 * MekTrack) so an even split alone would put this near 20-40% depending on
 * how many meks carry a secondary at all. Picked at the low end of that
 * band since Runemaster has had no particular reason to be popular before
 * salvage gives it one.
 */
export const PLACEHOLDER_RUNEMASTER_FRACTION = 0.25;

/**
 * PLACEHOLDER weighted sample of how many salvage-eligible kills a
 * deployed pilot racks up in a single mission, toward whichever archetype
 * that mission happens to feature. Not every mission features a
 * salvage-eligible Bloom archetype (Wellroot/Choir/Undertow/Sirenmaw/
 * Sporethrower are threats introduced across the campaign, not present
 * from Mission 1) — this harness approximates that with
 * SALVAGE_MISSION_COVERAGE below rather than tracking real per-mission
 * spawn lists, which is real mission content this harness intentionally
 * doesn't model (see file header).
 */
export const SALVAGE_KILLS_PER_COVERED_MISSION: readonly { kills: 0 | 1 | 2 | 3; weight: number }[] = [
  { kills: 0, weight: 3 },
  { kills: 1, weight: 5 },
  { kills: 2, weight: 3 },
  { kills: 3, weight: 1 },
];

/** PLACEHOLDER. Fraction of the 36 missions assumed to feature a salvage-eligible archetype at all, for whichever specific archetype a given pilot happens to be racking up kills against. Roughly one in three, since the doc names five salvage-eligible archetypes (Wellroot/Choir/Undertow/Sirenmaw/Sporethrower) as a subset of the full Bestiary, not the whole enemy roster. */
export const SALVAGE_MISSION_COVERAGE = 0.35;
