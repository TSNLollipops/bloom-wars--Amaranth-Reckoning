// Toxic Pairs — unit tests, 28 Aug 2026 (Groups 3-5 batch rebuild, second
// pass — corrected against the real scaling formula recorded in
// claude/Bloom_Wars_Master_Index.md's Group 4 account:
// toxicPairStressTick(bond) is 0 above RIVAL_THRESHOLD, otherwise
// round(2 + (RIVAL_THRESHOLD - bond) * 0.15) — the first rebuild pass
// used a flat 2 instead). Pure module, no engine imports (src/data/**
// purity rule, Build Brief §5.2).
import { describe, it, expect } from "vitest";
import { toxicPairStressTick, applyToxicPairStressTick } from "../toxicPairs";
import { RIVAL_THRESHOLD } from "../npcBonds";

describe("toxicPairStressTick", () => {
  it("is 0 for a friendly bond", () => {
    expect(toxicPairStressTick(40)).toBe(0);
  });

  it("is 0 for a neutral bond (0)", () => {
    expect(toxicPairStressTick(0)).toBe(0);
  });

  it("is 0 one point above RIVAL_THRESHOLD — not quite a rivalry yet", () => {
    expect(toxicPairStressTick(RIVAL_THRESHOLD + 1)).toBe(0);
  });

  it("is 2 exactly at RIVAL_THRESHOLD — boundary inclusive, floor of the scale", () => {
    expect(toxicPairStressTick(RIVAL_THRESHOLD)).toBe(2);
  });

  it("the real seeded Anand/Iyari rivalry (bond -25) generates round(2 + 5*0.15) = 3 — npcSeed.ts's NPC_BOND_SEED, not a synthetic number", () => {
    expect(toxicPairStressTick(-25)).toBe(3);
  });

  it("scales up for a deeply toxic bond (-100) to round(2 + 80*0.15) = 14 — not a flat rate regardless of how bad the bond is", () => {
    expect(toxicPairStressTick(-100)).toBe(14);
  });

  it("a moderately toxic bond (-50) lands at round(2 + 30*0.15) = round(6.5) = 7 (banker's/half-up per Math.round)", () => {
    expect(toxicPairStressTick(-50)).toBe(Math.round(2 + 30 * 0.15));
  });

  it("strictly increases as the bond gets worse — worse bond, worse bite", () => {
    const t1 = toxicPairStressTick(RIVAL_THRESHOLD);
    const t2 = toxicPairStressTick(-50);
    const t3 = toxicPairStressTick(-100);
    expect(t2).toBeGreaterThan(t1);
    expect(t3).toBeGreaterThan(t2);
  });
});

describe("applyToxicPairStressTick", () => {
  it("adds the scaled tick for a toxic pair", () => {
    expect(applyToxicPairStressTick(50, RIVAL_THRESHOLD)).toBe(50 + toxicPairStressTick(RIVAL_THRESHOLD));
  });

  it("leaves stress unchanged for a non-toxic pair", () => {
    expect(applyToxicPairStressTick(50, 0)).toBe(50);
  });

  it("clamps at the 100 ceiling rather than overflowing", () => {
    expect(applyToxicPairStressTick(99, -100)).toBe(100);
  });

  it("stress already at 100 stays at 100 for a toxic pair", () => {
    expect(applyToxicPairStressTick(100, RIVAL_THRESHOLD)).toBe(100);
  });

  it("never goes negative — floor 0, same as every other Stress/Morale number", () => {
    expect(applyToxicPairStressTick(0, 0)).toBe(0);
  });
});
