// src/sim/seededRandom.ts
// The determinism fence for headless harnesses, 22 Sep 2026.
// claude/Bloom_Wars_Build_Log_Addendum_SimDeterminism_22Sep2026.md.
//
// Why this exists. The game is SUPPOSED to be random in places: a new
// recruit's gender, name, background and chassis, who wins a hand of
// poker in the Rec Room, which ambient line a pilot says. Those call
// Math.random on purpose, and the live game should keep doing so. The
// engine's convention is that anything a test needs to pin down takes an
// injectable `rng` (Mission's options.rng, runGriefCatalyst's rng,
// simulateDay's rng), but not every chain forwards it all the way down.
// A 22 Sep trace of `sim:brain` found 40 distinct call chains still
// reaching the real Math.random mid-campaign, in three families:
//   - recruit generation (checkMuntiGuarantee -> generatePilot -> gender,
//     name, both backgrounds, Mek name, chassis suffix). The chassis roll
//     changes the recruit's archetype, so it changes COMBAT from the next
//     mission on. This was the divergence the build logs kept tripping on.
//   - the Hub's abstracted minigames (simulateDay -> poker/darts/pegs):
//     thousands of shuffles and throws; simulateDay takes an rng but the
//     minigame engines never receive it.
//   - Hub talk (ambient line picks, gate 0 reactions, catalyst reactions).
//
// Rather than hand-thread an rng through ten files (and have the next new
// Math.random call silently reopen the hole), a harness runs each campaign
// inside this fence: Math.random is swapped for a seeded mulberry32 stream
// for exactly the duration of `fn`, then put back, even if `fn` throws.
// Every default-parameter `rng = Math.random` and every direct
// Math.random() call inside the fence draws from the seeded stream, so the
// same seed replays the same campaign byte for byte.
//
// Harness-only. Nothing under src/engine, src/data or src/scenes imports
// this; the live game never runs inside a fence.
import { mulberry32 } from "./rng";

/**
 * Runs `fn` with Math.random replaced by mulberry32(seed), restoring the
 * original afterwards. Synchronous only: an async `fn` would release the
 * fence at its first await while its own continuation still expected it.
 */
export function withSeededMathRandom<T>(seed: number, fn: () => T): T {
  const original = Math.random;
  Math.random = mulberry32(seed);
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}
