// src/sim/rng.ts
// mulberry32 — a tiny, fast, seedable PRNG (Player AI Difficulty Tiers Plan
// §3.3, 1 Sep 2026). The same generator the throwaway Mission 36 harness
// used on 28 Aug (build_log/act3/mission36_until_relief.md), now in the
// repo. Handed to Mission (options.rng) and to the Player AI's memory so
// a run — dodge rolls and Easy's deliberate mistakes alike — replays
// identically from one integer. Not cryptographic; not meant to be.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
