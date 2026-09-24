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
//
// TWO CLOCKS, 22 Sep 2026 (Maxime: "Two clocks, build now";
// claude/Bloom_Wars_Build_Log_Addendum_TwoClocks_22Sep2026.md). Until this
// date both processes read ONE number, the ledger history, which is a
// two-week window (salience decays 4% a day). That made "slow and late"
// impossible to express: whatever threshold fit inside two weeks was, by
// construction, neither slow nor late. It also inverted the per-echo
// design at a heavy ledger — the echo an animal barely has wound up
// hardest, because the climb is the same size for every echo and the
// low-weight ones have the least habituation to hold them down (Shark fear
// 1.39 vs Shark anger 1.23 at history 4).
//
// Now each process reads its own clock, which is what Groves & Thompson
// actually describe (habituation short-term, sensitization long-lasting):
//   habituation   reads `recent`, the decaying ledger (memoryLedger.ts's
//                 echoHistoryWeight) — what has been happening lately;
//   sensitization reads `banked`, the pilot's permanent echo bank
//                 (echoLean.ts, HubPilotSocialState.echoBank) — what their
//                 career has put into them.
// The bank fills at bankRate(), which is proportional to the animal's own
// weight on that echo, so a Shark banks anger at 2.0x and fear at 0.4x.
// That is what restores "a high weight amplifies that echo's own nature"
// at every depth, not just at the threshold: an echo the animal barely has
// takes a career several times longer to wind up. Same move as the ledger
// retention fix that morning (theta_c != tau): how loud something is now
// and how long it stays are two different clocks.
import type { Catalyst } from "./ambientLines";
import type { Echo } from "./ambientLines";
import { ECHO_BASE_LEAN, ECHO_BANK_RETURN_RATIO, bankRate } from "./echoLean";

/**
 * Per-animal, PER-ECHO tipping point and dampening depth.
 *
 * Rewritten 22 Sep 2026 on Maxime's call: "The 4 thing love anger sadness and
 * fear are each a weight of their own. Not paired." [SOURCE]
 *
 * What stood here before: ONE profile per animal, built from that animal's
 * fear and sadness, then handed to all four echoes. A Shark's anger (lean .50,
 * the thing that defines him) and a Shark's fear (lean .10, which he barely
 * has) wore out at the same rate and tipped at the same point. Four weights
 * went in, two numbers came out, and those two got reused four times.
 *
 * Two costs. In play, an animal's defining echo faded exactly as fast as its
 * incidental ones, which flattens pilots toward each other over a campaign.
 * In the derivation, squeezing two parameters out of four values that sum to 1
 * is precisely what invites complementary-pair degeneracy — the bug this
 * file's first draft hit. Reading each parameter off a SINGLE echo makes that
 * class of mistake structurally impossible, because no sum is ever taken.
 *
 * The shape now: the psychology lives on THE ECHO, not on the animal. Fear is
 * the kindling register and sadness the withdrawal register for everyone, not
 * only for Rabbits and Bears. Each echo carries two intrinsic constants; the
 * animal's weight on that echo says how loudly that nature speaks in them.
 * Nine profiles become thirty-six, each a function of its own echo's weight
 * and nothing else.
 *
 * Grounding. The ORDERING of the eight constants below comes from the
 * literature; the magnitudes are [BUILD] and are Maxime's to override.
 *   love     hedonic adaptation is among the best-replicated findings in
 *            affective science: positive states habituate hard. Love does not
 *            kindle on repetition. High withdrawal, low kindling.
 *   fear     fear kindling and incubation, and fear's resistance to
 *            extinction. Highest kindling, lowest withdrawal.
 *   anger    rumination sustains and amplifies anger rather than discharging
 *            it, but acute anger does discharge. Moderate on both.
 *   sadness  learned helplessness is the withdrawal endpoint. Highest
 *            withdrawal, low kindling.
 */
export const ECHO_KINDLING: Record<Echo, number> = { love: 0.2, fear: 1.0, anger: 0.65, sadness: 0.3 };
export const ECHO_WITHDRAWAL: Record<Echo, number> = { love: 0.85, fear: 0.25, anger: 0.45, sadness: 1.0 };
/**
 * The lean weight at which an echo's nature expresses fully. 0.50 is the
 * largest value anywhere in ECHO_BASE_LEAN (Shark's anger), so nothing clips
 * and the whole range 0.05..0.50 maps onto 0.10..1.00.
 *
 * Deliberately NOT the same number as echoLean.ts's ECHO_WEIGHT_REFERENCE.
 * They answer different questions: that one is a rate that should average 1.0
 * across a row, this one is a saturation point.
 */
export const ECHO_WEIGHT_FULL = 0.5;

/**
 * The band ends. Set 22 Sep 2026 from a measured run, not guessed — the
 * previous values were guessed and that is how Shark ended up with a
 * threshold nothing could ever reach.
 *
 * Instrumented engine/memoryLedger.ts echoHistoryWeight() across 12 seeds x 36
 * missions and collected every per-echo history value the gain function
 * actually sees. 840 evaluations:
 *
 *   67.6% are exactly 0 — that pilot carries no memory in that echo at all
 *   of the non-zero third: median 0.945, p90 2.318, max 3.983
 *   share that is zero, per echo: love 59.5%, fear 68.6%, anger 75.7%,
 *                                 sadness 66.7%  (anger history is scarcest)
 *
 * The old THRESHOLD_BASE of 6.0 put Shark at 4.8, which clears 0.00% of that
 * distribution: the dead parameter Master Reference §7.5 has had open since
 * 17 Sep. The band below spans 1.40..2.68 and fires between 0% and 6.2% per
 * cell, so sensitisation stays rare — it should be — without being impossible.
 *
 * Exactly one cell never fires: Rabbit's anger. That is the table working, not
 * a miss. Rabbit's anger lean is 0.05, "almost never angry", and anger history
 * is the scarcest of the four. A Rabbit who never kindles into anger is right.
 *
 * Two clocks, same day: that measurement was of the ONE-clock rule, where the
 * threshold was compared against ledger history. The threshold is now
 * compared against the BANK, scaled by SENSITIZATION_BANK_SCALE below, so the
 * per-cell firing rates above no longer describe the game; the band's shape
 * (which echo tips first, for whom) carries over unchanged. Also, the stock
 * sim:brain run those 840 evaluations came from loses its crew by Mission 11
 * and never recruits, so the distribution is effectively first-act only
 * (claude/Bloom_Wars_Shark_Threshold_Measurement_22Sep2026.md §3).
 */
export const THRESHOLD_BASE = 2.8;
export const THRESHOLD_SPAN = 2.0;
export const HAB_DEPTH_BASE = 0.1;
export const HAB_DEPTH_SPAN = 0.5;
/** How fast habituation saturates, in ledger-weight units. Small: it bites in the first few repeats. */
export const HAB_SCALE = 2.5;
/**
 * Shared turn sharpness at the threshold, per unit of LEDGER weight. Not
 * derived per echo: see ECHO_KINDLING above for what is. Since two clocks
 * (22 Sep 2026) the curve reads the bank, so what historyGain actually uses
 * is SENSITIZATION_BANK_STEEPNESS, derived from this one below.
 */
export const SENSITIZATION_STEEPNESS = 1.2;
/** How far past baseline a fully sensitized pilot climbs. */
export const SENSITIZATION_RISE = 0.6;
/**
 * Bank units per unit of profile threshold. Sensitization tips when the
 * pilot's banked weight on an echo reaches threshold x this.
 *
 * CALIBRATED, not derived, 22 Sep 2026, to the behaviour Maxime approved:
 * "Sharks who last wind up on anger; roughly half the Sharks who last,
 * around their fifth Debrief; short careers almost never." Measured on 12
 * all-Shark campaigns (sim:brain --crew=5, 535 Debrief reads, 259 careers),
 * reading each pilot's real ledger and bank at every Debrief:
 *
 *   scale 4   long careers 12/18 tip, short 23/241, around Debrief #3
 *   scale 5                9/18            8/241                  #4
 *   scale 6                8/18            2/241                  #4   <- this
 *   scale 7                7/18            1/241                  #6
 *   scale 8                4/18            0/241                  #7
 *
 * (That table is at SENSITIZATION_BANK_STEEPNESS below; at the ledger's 1.2
 * the same scale gave 8/18 and 2/241.) Every tip at every scale was on
 * anger — the lean table's own "anger is fuel, fear is for other people",
 * which nobody wrote in. Lower this to wind crews up sooner, raise it to make
 * it rarer. Maxime's to override.
 */
export const SENSITIZATION_BANK_SCALE = 6;

export interface DualProcessProfile {
  /**
   * Where sensitization overtakes habituation, in ledger-weight units (the
   * band above). Compared against the pilot's BANK on that echo, times
   * SENSITIZATION_BANK_SCALE — see historyGain.
   */
  threshold: number;
  /** How far the response quiets before that, 0..1. */
  habDepth: number;
}

/** One animal, one echo. Reads that echo's own weight and nothing else. */
function profileFor(catalyst: Catalyst, echo: Echo): DualProcessProfile {
  const w = Math.min(1, ECHO_BASE_LEAN[catalyst][echo] / ECHO_WEIGHT_FULL);
  return {
    threshold: THRESHOLD_BASE - THRESHOLD_SPAN * ECHO_KINDLING[echo] * w,
    habDepth: HAB_DEPTH_BASE + HAB_DEPTH_SPAN * ECHO_WITHDRAWAL[echo] * w,
  };
}

function gridFor(catalyst: Catalyst): Record<Echo, DualProcessProfile> {
  return {
    love: profileFor(catalyst, "love"),
    fear: profileFor(catalyst, "fear"),
    anger: profileFor(catalyst, "anger"),
    sadness: profileFor(catalyst, "sadness"),
  };
}

/** Nine animals x four echoes, built once from ECHO_BASE_LEAN. */
export const DUAL_PROCESS_PROFILE: Record<Catalyst, Record<Echo, DualProcessProfile>> = {
  wolf: gridFor("wolf"),
  dog: gridFor("dog"),
  cat: gridFor("cat"),
  crow: gridFor("crow"),
  raven: gridFor("raven"),
  bear: gridFor("bear"),
  fox: gridFor("fox"),
  rabbit: gridFor("rabbit"),
  shark: gridFor("shark"),
};

/**
 * How quiet a fully habituated pilot can get. Never 0 — see the header.
 * A safety rail rather than a target: at the current constants the deepest
 * cell bottoms out well above it. It exists so a retune that raises
 * HAB_DEPTH_SPAN cannot silently delete a pilot.
 */
export const HABITUATION_FLOOR = 0.5;
/** The same rail on the other end. Also not reached at the current seeds. */
export const SENSITIZATION_CAP = 1.5;

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * The curve, on two clocks. For one echo:
 *   `recent` — the summed, decayed ledger weight of this pilot's memories
 *              carrying that echo (the last couple of weeks);
 *   `banked` — the pilot's permanent echo bank on that echo (their career).
 *
 * Two terms, matching the two processes:
 *   - habituation reads `recent`: an exponential that saturates fast,
 *     pulling the gain down toward 1 - habDepth within the first few
 *     repeats, and letting go again when things go quiet;
 *   - sensitization reads `banked`: a sigmoid centred on the profile's
 *     threshold x SENSITIZATION_BANK_SCALE, with SENSITIZATION_BANK_STEEPNESS
 *     as its sharpness (derived below), which contributes nothing until
 *     a career is heavy enough and then pushes back up past baseline — and,
 *     because the bank never decays, stays up.
 *
 * The sigmoid is offset by its own value at banked 0, so a pilot with an
 * empty ledger AND an empty bank reads exactly 1.0 — a rookie reads
 * precisely as they did before this file existed.
 */
export function historyGain(recent: number, banked: number, profile: DualProcessProfile): number {
  const h = Math.max(0, recent);
  const b = Math.max(0, banked);
  const bankThreshold = profile.threshold * SENSITIZATION_BANK_SCALE;
  const habituation = profile.habDepth * (1 - Math.exp(-h / HAB_SCALE));
  const atZero = sigmoid(SENSITIZATION_BANK_STEEPNESS * -bankThreshold);
  const sensitization = SENSITIZATION_RISE * (sigmoid(SENSITIZATION_BANK_STEEPNESS * (b - bankThreshold)) - atZero);
  const gain = 1 - habituation + sensitization;
  return Math.max(HABITUATION_FLOOR, Math.min(SENSITIZATION_CAP, gain));
}

/**
 * Every echo's gain for one pilot: `recent` is their ledger history per echo
 * (memoryLedger.ts's echoHistoryWeight), `banked` their echo bank. Both are
 * required on purpose — a caller that forgot the bank would silently switch
 * sensitization off.
 */
export function historyGains(
  catalyst: Catalyst,
  recent: Partial<Record<Echo, number>>,
  banked: Partial<Record<Echo, number>>,
): Record<Echo, number> {
  const grid = DUAL_PROCESS_PROFILE[catalyst];
  return {
    love: historyGain(recent.love ?? 0, banked.love ?? 0, grid.love),
    fear: historyGain(recent.fear ?? 0, banked.fear ?? 0, grid.fear),
    anger: historyGain(recent.anger ?? 0, banked.anger ?? 0, grid.anger),
    sadness: historyGain(recent.sadness ?? 0, banked.sadness ?? 0, grid.sadness),
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

/**
 * The most one full-weight memory can add to one pilot's bank on one echo:
 * the fastest establishment rate anywhere in the lean table (a Shark's
 * anger, 2.0), times the bank's return ratio.
 */
export const MAX_BANK_STEP =
  ECHO_BANK_RETURN_RATIO *
  Math.max(...(Object.keys(ECHO_BASE_LEAN) as Catalyst[]).flatMap((c) => (Object.keys(ECHO_BASE_LEAN[c]) as Echo[]).map((e) => bankRate(c, e))));

/**
 * Sensitization's turn sharpness on the bank. DERIVED, not tuned. The
 * header's first constraint is "a curve, never a step — nobody flips from
 * stoic to broken on one more ledger entry". On the ledger, one full-weight
 * memory moves history by at most 1.0 x SPACED_MULTIPLIER (1.25). On the
 * bank it can move by up to MAX_BANK_STEP (2.0). Reusing the ledger's
 * SENSITIZATION_STEEPNESS (1.2) on the bank would let one memory move the
 * curve 60% further along its own axis than it ever could before —
 * measured, 0.32 of gain in a single step. So it is scaled by exactly that
 * ratio:
 *   1.2 x 1.25 / 2.0 = 0.75
 * and one memory moves sensitization no further than it could under the
 * one-clock rule. Recomputes itself if the lean table, the spacing bonus or
 * the bank's return ratio is ever re-authored. (Declared down here, after
 * SPACED_MULTIPLIER, because it reads it at load; historyGain above reads
 * it at call time, which is after the whole module has loaded.)
 */
export const SENSITIZATION_BANK_STEEPNESS = (SENSITIZATION_STEEPNESS * SPACED_MULTIPLIER) / MAX_BANK_STEP;

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
