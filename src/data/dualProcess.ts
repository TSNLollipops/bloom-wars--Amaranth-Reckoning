// src/data/dualProcess.ts
// The Reaction Engine's read side of E (17 Sep 2026, handoff note
// "Reaction Engine — Dual-Process Threshold Rule", addendum to the
// Integration Plan §1).
//
// The problem it closes: Gate 3 rolled the same dice for a Shark on day one
// and a Shark on mission forty. The formula always had a slot for feedback
// (E, "how D changes the state the next pass reads back in"), and the ledger
// has been recording memories since 12 Sep — nothing read them back.
//
// The psychology, kept honest (Groves & Thompson 1970, dual-process theory):
// a repeated event drives habituation and sensitization at once, on two
// different timescales. Habituation is fast and saturating — the response
// quiets within the first few repeats and then stops quieting. Sensitization
// is slow and late — it needs enough accumulated weight to tip, and once it
// does it pushes the response back up past baseline. The observed response is
// the sum of the two, which is why the curve below dips before it climbs.
//
// This project already has the three factors that decide which one wins:
//
//   intensity        -> Volume  (data/pillars.ts — a stranger is not a partner)
//   controllability  -> Matter  (the agency rung; Maier & Seligman's own axis)
//   spacing          -> Time    (the gaps between the matching memories)
//
// So this is not a new system bolted on. It is the missing read of pillars
// that Slice 1 now computes, applied to the echo lean Gate 3 already picks
// from: b4(c) becomes b4H(c), the same pick parameterized by history.
//
// Three constraints, all load-bearing and all implemented below:
//   - a curve, never a step: nobody flips from stoic to broken on one more
//     ledger entry;
//   - dampening has a floor: a forty-mission veteran still answers, just
//     quieter. Full numbness reads as the pilot vanishing, which is not the
//     same thing as tragic restraint;
//   - a pilot with no history is UNCHANGED. gain(0) is exactly 1 by
//     construction, not approximately. Habituation is something repetition
//     does to you; a rookie has not habituated to anything yet. An earlier
//     draft of this file got that backwards and started every fresh pilot at
//     the numbness floor.
import type { Catalyst } from "./ambientLines";
import type { Echo } from "./ambientLines";
import { ECHO_BASE_LEAN } from "./echoLean";

/**
 * Per-animal tipping point and dampening depth.
 *
 * DERIVED, and derived from the right statistic — which took two tries.
 *
 * The obvious reading of ECHO_BASE_LEAN is "anger+love habituates,
 * fear+sadness sensitizes". That is worthless here: every row of
 * ECHO_BASE_LEAN sums to 1, so those two sums are the same number twice, and
 * across the nine animals it spans only 0.45..0.70. It also collapses animals
 * that should differ — Cat (anger .40) and Dog (love .45) land on one number,
 * as do Rabbit and Bear.
 *
 * The psychology names better statistics, and they turn out to be nearly
 * independent in this table (corr(fear, sadness) = -0.27 across the nine
 * rows), so they carry two real axes instead of one:
 *
 *   FEAR   decides WHEN it tips. Fear is the kindling echo — the one that
 *          builds on repetition instead of discharging. Low fear tips late or
 *          never (Shark, .10 -> threshold 4.8, effectively never inside a
 *          campaign); high fear tips early (Rabbit, .35 -> 1.8). That is the
 *          handoff note's own two worked examples, falling out rather than
 *          hand-picked.
 *   SADNESS decides HOW FAR it dampens first. Sadness is the withdrawal echo,
 *          the learned-helplessness endpoint where the response stops rather
 *          than redirects. Bear (.35) wears down furthest; Wolf and Fox (.15)
 *          barely quiet at all.
 *
 * Steepness is a single shared constant, deliberately. There is no third
 * independent statistic in this table to derive it from, and inventing one
 * from a number already in use would be the first draft's mistake again.
 *
 * Cat and Dog still land on the same profile, because their fear and sadness
 * rows are literally identical (.20/.20) — they differ in anger vs love. That
 * is correct and not a collapse: what they feel is Gate 3's question and
 * ECHO_BASE_LEAN already answers it. How repetition changes the volume is a
 * different axis, and two animals are allowed to wear down the same way.
 *
 * Seeds for a sim:brain run. Maxime's to override, one row at a time, the
 * same standing as every other tuning table in this project.
 */
export const THRESHOLD_BASE = 6;
export const THRESHOLD_PER_FEAR = 12;
export const HAB_DEPTH_BASE = 0.2;
export const HAB_DEPTH_PER_SADNESS = 1;
/** How fast habituation saturates, in ledger-weight units. Small: it bites in the first few repeats. */
export const HAB_SCALE = 2.5;
/** Shared turn sharpness at the threshold. See the note above on why this is not derived. */
export const SENSITIZATION_STEEPNESS = 1.2;
/** How far past baseline a fully sensitized pilot climbs. */
export const SENSITIZATION_RISE = 0.6;

export interface DualProcessProfile {
  /** Summed matching-echo ledger weight at which sensitization overtakes habituation. */
  threshold: number;
  /** How far the response quiets before that, 0..1. */
  habDepth: number;
}

function profileFor(catalyst: Catalyst): DualProcessProfile {
  const lean = ECHO_BASE_LEAN[catalyst];
  return {
    threshold: THRESHOLD_BASE - THRESHOLD_PER_FEAR * lean.fear,
    habDepth: HAB_DEPTH_BASE + HAB_DEPTH_PER_SADNESS * lean.sadness,
  };
}

/** The nine rows, built once from ECHO_BASE_LEAN. */
export const DUAL_PROCESS_PROFILE: Record<Catalyst, DualProcessProfile> = {
  wolf: profileFor("wolf"),
  dog: profileFor("dog"),
  cat: profileFor("cat"),
  crow: profileFor("crow"),
  raven: profileFor("raven"),
  bear: profileFor("bear"),
  fox: profileFor("fox"),
  rabbit: profileFor("rabbit"),
  shark: profileFor("shark"),
};

/**
 * How quiet a fully habituated pilot can get. Never 0 — see the header.
 * A safety rail rather than a target: at the seeds above the deepest animal
 * (Bear) bottoms out near 0.77, nowhere near this. It exists so a retune that
 * raises HAB_DEPTH_PER_SADNESS cannot silently delete a pilot.
 */
export const HABITUATION_FLOOR = 0.5;
/** The same rail on the other end. Also not reached at the current seeds. */
export const SENSITIZATION_CAP = 1.5;

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * The curve. `history` is the summed, decayed weight of this pilot's
 * memories that carry the same echo.
 *
 * Two terms, matching the two processes:
 *   - habituation, an exponential that saturates fast, pulling the gain down
 *     toward 1 - habDepth within the first few repeats;
 *   - sensitization, a sigmoid centred on the animal's own threshold, which
 *     contributes nothing until the ledger is heavy enough and then pushes
 *     back up past baseline.
 *
 * The sigmoid is offset by its own value at history 0, so gain(0) is exactly
 * 1.0 for every animal — a pilot who has never been through anything reads
 * precisely as they did before this file existed.
 */
export function historyGain(history: number, profile: DualProcessProfile): number {
  const h = Math.max(0, history);
  const habituation = profile.habDepth * (1 - Math.exp(-h / HAB_SCALE));
  const atZero = sigmoid(SENSITIZATION_STEEPNESS * -profile.threshold);
  const sensitization = SENSITIZATION_RISE * (sigmoid(SENSITIZATION_STEEPNESS * (h - profile.threshold)) - atZero);
  const gain = 1 - habituation + sensitization;
  return Math.max(HABITUATION_FLOOR, Math.min(SENSITIZATION_CAP, gain));
}

/** Every echo's gain for one pilot, given their summed history per echo. */
export function historyGains(catalyst: Catalyst, history: Partial<Record<Echo, number>>): Record<Echo, number> {
  const profile = DUAL_PROCESS_PROFILE[catalyst];
  return {
    love: historyGain(history.love ?? 0, profile),
    fear: historyGain(history.fear ?? 0, profile),
    anger: historyGain(history.anger ?? 0, profile),
    sadness: historyGain(history.sadness ?? 0, profile),
  };
}

/**
 * Spacing, the third dual-process factor. Kindling needs gaps: three deaths
 * inside one bad mission wear a pilot down (habituation), a death every few
 * missions that never quite lets them recover winds them up (sensitization).
 * Massed repeats are discounted, spaced ones amplified, both gently.
 *
 * `days` is the in-game day of each matching memory, any order.
 */
export const MASSED_WINDOW_DAYS = 2;
export const SPACED_GAP_DAYS = 6;
export const MASSED_MULTIPLIER = 0.8;
export const SPACED_MULTIPLIER = 1.25;

export function spacingMultiplier(days: readonly number[]): number {
  if (days.length < 2) return 1;
  const sorted = [...days].sort((a, b) => a - b);
  const span = sorted[sorted.length - 1] - sorted[0];
  if (span <= MASSED_WINDOW_DAYS) return MASSED_MULTIPLIER;
  const meanGap = span / (sorted.length - 1);
  if (meanGap >= SPACED_GAP_DAYS) return SPACED_MULTIPLIER;
  return 1;
}

/**
 * The lean Gate 3 actually picks from: the pilot's ordinary lean with each
 * echo scaled by its own gain. Shape and total are not normalized on
 * purpose — pickWeightedEcho reads these as relative weights, and rescaling
 * them back to a fixed sum would undo exactly the change this makes.
 */
export function historyAdjustedLean(lean: Record<Echo, number>, gains: Record<Echo, number>): Record<Echo, number> {
  return {
    love: Math.max(0, lean.love * gains.love),
    fear: Math.max(0, lean.fear * gains.fear),
    anger: Math.max(0, lean.anger * gains.anger),
    sadness: Math.max(0, lean.sadness * gains.sadness),
  };
}
