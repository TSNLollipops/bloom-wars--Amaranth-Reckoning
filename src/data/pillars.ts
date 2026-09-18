// src/data/pillars.ts
// Reaction Engine Slice 1 — the three pillars as real numbers (17 Sep 2026,
// Bloom_Wars_Reaction_Engine_Integration_Plan_v1_14Sep2026.md §1).
//
// Time, Volume and Matter have been design language since the formula was
// written. Everything that reads them was still applying its tunables at
// full strength always: losing a stranger moved a pilot exactly as far as
// losing the partner they came up with, and a memory from forty days ago
// weighed the same as this morning's. This file turns the three into 0..1
// numbers; engine/pillars.ts resolves a real situation into them.
//
// Data-layer rule (Build Brief §5.2): pure tables and arithmetic, no engine
// import, no state. Which ring or rung a given pilot is on is an engine
// question; what that ring is worth is this file's.
//
//   Time   — 1.0 for something happening now, decaying for a remembered one
//            (the same curve data/memories.ts already decays salience by, so
//            a memory's Time weight and its salience never disagree).
//   Volume — how close to the pilot it lands: concentric rings, self out to
//            the world.
//   Matter — the agency rung: could they act, and did it fall to them? A
//            struck pilot watching from off-roster is rung 0.
//
// EVERY NUMBER HERE IS A PLACEHOLDER, in this project's usual sense: reasoned
// from the design doc's own ladders, never run through a sim. The one real
// judgment call is COMBINE, below.
import { MEMORY_DECAY_PER_DAY } from "./memories";

/** How close the event lands to the pilot. Integration Plan §1.1's own ring list. */
export type VolumeRing = "self" | "bonded" | "lance" | "company" | "stranger" | "world";

export const VOLUME_RING_WEIGHT: Record<VolumeRing, number> = {
  self: 1,
  bonded: 0.8,
  lance: 0.5,
  company: 0.3,
  stranger: 0.15,
  world: 0.05,
};

/**
 * The agency ladder (design doc §2.2), rung 0 to 4: 0 = no say in it at all
 * (struck, off-roster, watching), 4 = it was theirs to decide and they
 * decided it. Matter is the formula's own stand-in for controllability, the
 * thing Maier & Seligman's work says decides whether a repeated hard event
 * hardens someone or wears them down.
 */
export const MATTER_RUNG_WEIGHT: readonly number[] = [0, 0.25, 0.6, 0.85, 1];

/** Something happening right now, not remembered. */
export const TIME_LIVE = 1;

/**
 * A remembered event's Time weight: the same per-day decay
 * data/memories.ts uses for salience, so the two never drift apart. Floored
 * well above zero on purpose — see PILLAR_FLOOR.
 */
export function timeWeightForAge(daysAgo: number): number {
  const age = Math.max(0, daysAgo);
  return Math.max(PILLAR_FLOOR, Math.min(1, Math.pow(MEMORY_DECAY_PER_DAY, age)));
}

/**
 * Nothing a pilot registers at all is ever worth *nothing*. A reaction
 * scaled to zero is a pilot who didn't react, and Gate 0 already owns that
 * decision — by the time these weights are read, the pilot has registered
 * the event. This floor is what keeps the two from fighting.
 */
export const PILLAR_FLOOR = 0.25;

/**
 * How the three combine — the one place this file departs from the
 * Integration Plan, deliberately and flagged rather than done quietly.
 *
 * The plan says "the product of the three weights". Multiplying three
 * numbers that are each below 1 collapses an ordinary case hard: a bonded
 * squadmate (0.8) going down in a fight the pilot was in (Matter 0.85) today
 * (Time 1.0) lands at 0.68, and a lance-mate at 0.43. Every tunable in
 * engine/debriefCatalyst.ts was tuned against a world where that multiplier
 * was 1.0, so the product would quietly halve the whole Emotional Brain and
 * force a retune of numbers Maxime has already signed off on.
 *
 * The mean keeps the ordering the product gives — self/now/mine at the top,
 * stranger/old/watched at the bottom — without rescaling everything at once.
 * That leaves the pillars doing what they were designed to do (Volume and
 * Matter decide how hard it lands) while the existing constants keep
 * meaning what they meant.
 *
 * Maxime's call to reverse if he wants the sharper version: switch this to
 * "product" and retune SOURCE_TAKE/LOSS_TAKE/OUTCOME_TAKE together.
 */
export type PillarCombine = "mean" | "product";
export const PILLAR_COMBINE: PillarCombine = "mean";

export interface PillarReading {
  time: number;
  volume: number;
  matter: number;
}

/** The single 0..1 multiplier a reaction's strength gets scaled by. */
export function pillarWeight(reading: PillarReading, combine: PillarCombine = PILLAR_COMBINE): number {
  const t = clamp01(reading.time);
  const v = clamp01(reading.volume);
  const m = clamp01(reading.matter);
  const raw = combine === "product" ? t * v * m : (t + v + m) / 3;
  return Math.max(PILLAR_FLOOR, Math.min(1, raw));
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
