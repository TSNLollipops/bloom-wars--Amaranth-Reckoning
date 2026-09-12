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

/** Rows sum to 1.0. Order inside each row is the formula's own: love, fear, anger, sadness. */
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

export function emptyDrift(): EchoWeights {
  return { love: 0, fear: 0, anger: 0, sadness: 0 };
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

/** Base row for the catalyst plus the pilot's own drift. The vector pickWeightedEcho (data/ambientLines.ts) draws from. */
export function effectiveEchoLean(catalyst: Catalyst, drift?: EchoWeights): EchoWeights {
  const base = ECHO_BASE_LEAN[catalyst];
  const d = drift ?? emptyDrift();
  return {
    love: base.love + d.love,
    fear: base.fear + d.fear,
    anger: base.anger + d.anger,
    sadness: base.sadness + d.sadness,
  };
}

/** The single echo a pilot leans hardest toward right now. For dossier text and the harness printout. */
export function dominantEcho(weights: EchoWeights): Echo {
  const order: Echo[] = ["love", "fear", "anger", "sadness"];
  let best = order[0];
  for (const e of order) if (weights[e] > weights[best]) best = e;
  return best;
}
