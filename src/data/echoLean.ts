// src/data/echoLean.ts
// Emotional Brain, Phase 3 — echo lean and per-pilot drift, 12 Sep 2026.
// claude/Bloom_Wars_Emotional_Brain_Build_Plan_v1_12Sep2026.md §3c.
//
// This is b⁴ from the Reaction Engine formula ((A+B)+(a+b⁴(c))=D+E,
// NPC_Reaction_Engine_v1.md §1): the archetype run through the four echoes
// love / fear / anger / sadness, in that locked order. Before this file,
// the archetype (catalyst) only ever chose WHICH LINE BANK a pilot spoke
// from; whether they leaned toward fear or anger was a flat four-way coin
// flip at the bottom of data/ambientLines.ts's pickSoloEcho. A Shark and a
// Rabbit reacted to the same event with the same dice. Now they don't.
//
// Two layers, added together:
//   1. ECHO_BASE_LEAN, one row per catalyst: fixed, the archetype's
//      temperament. Placeholder values reasoned from the catalyst
//      connotations (NPC_Reaction_Engine_v1.md §2: Wolf=teamwork,
//      Dog=loyalty, Cat=selfishness, Crow=indulgence, Raven=instruction,
//      Bear=isolation, Fox=trickery, Rabbit=nurturing, Shark=ambition),
//      same standing as every other catalyst mapping in this project
//      (Mission Worry's "wolf", combatWorry.ts's seven picks): Maxime's
//      to override, one row each, no downstream consequence to chase.
//   2. A per-pilot DRIFT vector, persisted on HubPilotSocialState.echoDrift
//      (engine/campaignState.ts §11), all zero at first. Every memory the
//      pilot writes (data/memories.ts) nudges its own echo's drift up a
//      little; drift relaxes toward zero as in-game days pass. A pilot who
//      has processed three losses as sadness now leans sadness in ordinary
//      idle chatter, and slowly stops leaning that way if life gets
//      quieter. This is the cheap, felt "they changed" mechanism, distinct
//      from any population-level tuning.
//
// The acute overrides in pickSoloEcho (drunk, panicking, a live worry, low
// morale) keep priority over all of this. The lean only replaces the coin
// flip at the bottom of that chain, and it is invisible to the content
// banks (still keyed catalyst × echo × stage), so no lines change.
//
// src/data/** purity rule (Build Brief §5.2): pure functions, no engine
// imports, no clock read of its own.
import type { Catalyst, Echo } from "./ambientLines";

export type EchoWeights = Record<Echo, number>;

/**
 * One row per catalyst, four independent weights each.
 *
 * As authored, every row happens to sum to 1.0 — but as of 22 Sep 2026 that is
 * an accident of how the rows were written, NOT a constraint anything relies
 * on. Maxime: "The 4 thing love anger sadness and fear are each a weight of
 * their own. Not paired." [SOURCE] Nothing downstream may take a sum of two
 * echoes and treat it as independent of the other two; that is what produced
 * the paired-parameter bug in data/dualProcess.ts. Read each echo on its own.
 *
 * Order inside each row is the formula's own: love, fear, anger, sadness.
 */
export const ECHO_BASE_LEAN: Record<Catalyst, EchoWeights> = {
  wolf: { love: 0.4, fear: 0.3, anger: 0.15, sadness: 0.15 }, // teamwork: warm, and afraid FOR the others
  dog: { love: 0.45, fear: 0.2, anger: 0.15, sadness: 0.2 }, // loyalty: warm first, grieves what it loses
  cat: { love: 0.2, fear: 0.2, anger: 0.4, sadness: 0.2 }, // selfishness: irritation is the default reading
  crow: { love: 0.4, fear: 0.15, anger: 0.25, sadness: 0.2 }, // indulgence: pleasure-seeking, quick to snap when denied
  raven: { love: 0.25, fear: 0.25, anger: 0.25, sadness: 0.25 }, // instruction: measured, the even row on purpose
  bear: { love: 0.15, fear: 0.2, anger: 0.3, sadness: 0.35 }, // isolation: withdraws into sadness, growls when pushed
  fox: { love: 0.3, fear: 0.3, anger: 0.25, sadness: 0.15 }, // trickery: reads the room, rarely mopes
  rabbit: { love: 0.4, fear: 0.35, anger: 0.05, sadness: 0.2 }, // nurturing: warm and easily frightened, almost never angry
  shark: { love: 0.2, fear: 0.1, anger: 0.5, sadness: 0.2 }, // ambition: anger is fuel, fear is for other people
};

/** How much one memory of birth-weight 1.0 pushes its own echo's drift. */
export const ECHO_DRIFT_PER_MEMORY = 0.15;
/** Drift multiplier per in-game day (relaxation toward zero). 0.95^14 ≈ 0.49, so a nudge halves in two weeks. */
export const ECHO_DRIFT_RELAX_PER_DAY = 0.95;
/** Drift never exceeds this per echo, so a base row can bend but never be erased. */
export const ECHO_DRIFT_CAP = 0.6;

// ---- The bank: the third layer, 22 Sep 2026 ---------------------------------
//
// claude/Bloom_Wars_Echo_Bank_Plan_v1_22Sep2026.md, from THE_FORMULA_Master_
// Reference_v1 §11. Drift above is the two-week clock: it relaxes to zero and
// every pilot converges back to their archetype row. Nothing accumulated.
// The bank is what accumulates. Every memory written feeds its echo's slot,
// and the slot never decays on its own. Read as a SHAPE (normalised), scaled
// by a bounded influence that ramps with how much is banked, so a rookie's
// empty bank contributes exactly zero and a veteran's forty losses don't make
// them "more" than a rookie, only differently proportioned. The purge the
// sludge model calls for is implicit in the normalisation: new experience
// dilutes old in proportion. That is constant-MLSS operation.
//
// In the formula: E splits, part returns into B. B(n+1) = B(n) + Er(n).
// This file is Er and the read of B; engine/memoryLedger.ts is the wiring.

/** Fraction of a memory's weight that banks into its echo. 1.0 = all of it. Only matters relative to the purge. */
export const ECHO_BANK_RETURN_RATIO = 1.0;
/** How far a fully saturated bank can bend the lean, summed across the four echoes. Comparable to a strong drift. */
export const ECHO_BANK_INFLUENCE = 0.3;
/** Banked total at which influence reaches full strength. About three or four heavy memories. Below it, influence ramps linearly. */
export const ECHO_BANK_SATURATION = 3.0;
/**
 * Bank multiplier per in-game day. 1.0 = no bleed at all, the bank is
 * permanent. Exists as a knob for a decade-scale fade if one is ever wanted;
 * built at neutral and tested as the identity. Normalisation already does
 * the dilution, so this is a second, explicit purge, not the only one.
 */
export const ECHO_BANK_PURGE_PER_DAY = 1.0;

export function emptyDrift(): EchoWeights {
  return { love: 0, fear: 0, anger: 0, sadness: 0 };
}

/**
 * The lean weight that counts as a neutral 1.0x establishment rate — the even
 * row (Raven, 0.25 across the board), which banks everything at exactly 1.0.
 *
 * Replaces a bare "* 4" (22 Sep 2026). Numerically identical across all 36
 * cells, verified: the old factor only worked because every row happens to sum
 * to 1.0, and this states the assumption as a constant instead of hiding it in
 * an arithmetic coincidence. If the rows are ever re-authored off sum-to-1 —
 * a loud animal, a flat one — this keeps working and the "* 4" would not.
 */
export const ECHO_WEIGHT_REFERENCE = 0.25;

/**
 * How fast a given animal banks a given echo — the establishment rate
 * (22 Sep 2026, Maxime's call: "who you are does" decide what sticks).
 *
 * It is the animal's own base lean row, divided by ECHO_WEIGHT_REFERENCE, so
 * the even row banks everything at exactly 1.0. A Shark banks anger at
 * 2.0× and fear at 0.4×; a Rabbit banks fear at 1.4× and anger at 0.2×; a Raven, the even
 * row, banks everything at exactly 1.0 and is unchanged by this. Nature
 * filters experience: the same loss processed as sadness sticks to a Bear
 * (0.35 → 1.4×) more than twice as hard as to a Fox (0.15 → 0.6×).
 *
 * The sludge model's own argument for this: an organism that metabolises a
 * substrate well also grows fast on it — yield and growth rate are coupled,
 * not two independent facts. Measured before it was chosen: across twelve
 * 36-mission campaigns this cuts by about a third the share of named pilots who
 * end up as something other than their archetype (64% → 42%) without
 * stopping it. Experience still wins two times in five.
 *
 * A consequence worth knowing: a strongly-natured animal that keeps meeting
 * its own echo banks faster overall, so it reaches saturation and the
 * dossier's "Has become" line sooner. Bounded on read regardless.
 *
 * Undefined catalyst → 1.0. Callers that don't know who they are writing
 * for get the old neutral behaviour rather than an error.
 */
export function bankRate(catalyst: Catalyst | undefined, echo: Echo): number {
  if (!catalyst) return 1;
  return ECHO_BASE_LEAN[catalyst][echo] / ECHO_WEIGHT_REFERENCE;
}

/** A new bank with `echo` fed by `weight × ECHO_BANK_RETURN_RATIO × bankRate(catalyst, echo)`. Unbounded on write; bounded on read. Pure. */
export function bankEcho(bank: EchoWeights | undefined, echo: Echo, weight: number, catalyst?: Catalyst): EchoWeights {
  const next = { ...(bank ?? emptyDrift()) };
  const w = Number.isFinite(weight) ? Math.max(0, Math.min(1, weight)) : 0;
  next[echo] = next[echo] + w * ECHO_BANK_RETURN_RATIO * bankRate(catalyst, echo);
  return next;
}

/** Sum of everything banked. Zero for a rookie. */
export function bankTotal(bank: EchoWeights | undefined): number {
  const b = bank ?? emptyDrift();
  return b.love + b.fear + b.anger + b.sadness;
}

/**
 * The bank's contribution to a lean: its composition, scaled by a bounded
 * influence that ramps with how much is banked. All zeroes for an empty
 * bank, by construction, so a pilot who has been through nothing reads
 * exactly as if this layer did not exist.
 */
export function bankLean(bank: EchoWeights | undefined): EchoWeights {
  const total = bankTotal(bank);
  if (total <= 0) return emptyDrift();
  const b = bank ?? emptyDrift();
  const strength = ECHO_BANK_INFLUENCE * Math.min(1, total / ECHO_BANK_SATURATION);
  return {
    love: (b.love / total) * strength,
    fear: (b.fear / total) * strength,
    anger: (b.anger / total) * strength,
    sadness: (b.sadness / total) * strength,
  };
}

/** A new bank bled by `days` in-game days at ECHO_BANK_PURGE_PER_DAY. At 1.0 this is a copy. Pure. */
export function purgeBank(bank: EchoWeights | undefined, days: number): EchoWeights {
  const base = bank ?? emptyDrift();
  const d = Number.isFinite(days) && days > 0 ? Math.floor(days) : 0;
  if (d === 0 || ECHO_BANK_PURGE_PER_DAY >= 1) return { ...base };
  const k = Math.pow(ECHO_BANK_PURGE_PER_DAY, d);
  return { love: base.love * k, fear: base.fear * k, anger: base.anger * k, sadness: base.sadness * k };
}

/**
 * The echo a pilot has banked most, or undefined if the bank is too thin to
 * say. "Too thin" is half of saturation: enough that the dossier line means
 * something, not so much that it never appears in a 36-mission campaign.
 */
export function dominantBankedEcho(bank: EchoWeights | undefined): Echo | undefined {
  if (bankTotal(bank) < ECHO_BANK_SATURATION / 2) return undefined;
  return dominantEcho(bank ?? emptyDrift());
}

/** A new drift vector with `echo` nudged up by `weight × ECHO_DRIFT_PER_MEMORY`, capped. Pure. */
export function nudgeDrift(drift: EchoWeights | undefined, echo: Echo, weight: number): EchoWeights {
  const next = { ...(drift ?? emptyDrift()) };
  const w = Number.isFinite(weight) ? Math.max(0, Math.min(1, weight)) : 0;
  next[echo] = Math.min(ECHO_DRIFT_CAP, next[echo] + w * ECHO_DRIFT_PER_MEMORY);
  return next;
}

/** A new drift vector relaxed toward zero by `days` in-game days. Zero or negative days is a no-op copy. Pure. */
export function relaxDrift(drift: EchoWeights | undefined, days: number): EchoWeights {
  const base = drift ?? emptyDrift();
  const d = Number.isFinite(days) && days > 0 ? Math.floor(days) : 0;
  if (d === 0) return { ...base };
  const k = Math.pow(ECHO_DRIFT_RELAX_PER_DAY, d);
  return { love: base.love * k, fear: base.fear * k, anger: base.anger * k, sadness: base.sadness * k };
}

/**
 * Base row for the catalyst plus the pilot's own drift plus the bank's
 * contribution. The vector pickWeightedEcho (data/ambientLines.ts) draws
 * from. `bank` is optional and additive (22 Sep 2026): every caller that
 * predates it gets the old two-layer lean unchanged.
 */
export function effectiveEchoLean(catalyst: Catalyst, drift?: EchoWeights, bank?: EchoWeights): EchoWeights {
  const base = ECHO_BASE_LEAN[catalyst];
  const d = drift ?? emptyDrift();
  const b = bankLean(bank);
  return {
    love: base.love + d.love + b.love,
    fear: base.fear + d.fear + b.fear,
    anger: base.anger + d.anger + b.anger,
    sadness: base.sadness + d.sadness + b.sadness,
  };
}

/** The single echo a pilot leans hardest toward right now. For dossier text and the harness printout. */
export function dominantEcho(weights: EchoWeights): Echo {
  const order: Echo[] = ["love", "fear", "anger", "sadness"];
  let best = order[0];
  for (const e of order) if (weights[e] > weights[best]) best = e;
  return best;
}
