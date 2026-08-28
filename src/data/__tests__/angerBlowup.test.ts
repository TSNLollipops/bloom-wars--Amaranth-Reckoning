// Anger Blowup — unit tests, 28 Aug 2026 (Groups 3-5 batch rebuild).
// Pure module, no engine imports (src/data/** purity rule, Build Brief
// §5.2).
import { describe, it, expect, vi } from "vitest";
import {
  isAngerBlowupEligible,
  applyAngerBlowupStressRelief,
  pickAngerBlowupExchange,
  ANGER_BLOWUP_EXCHANGES,
  ANGER_BLOWUP_BOND_DELTA,
  ANGER_BLOWUP_STRESS_RELIEF,
  ANGER_BLOWUP_CHANCE,
} from "../angerBlowup";
import { RIVAL_THRESHOLD } from "../npcBonds";
import { STRESS_PANIC_THRESHOLD } from "../ambientLines";

describe("isAngerBlowupEligible", () => {
  it("is false for a friendly bond even with both sides at max stress", () => {
    expect(isAngerBlowupEligible(40, 100, 100)).toBe(false);
  });

  it("is false for a neutral bond (0) even with both sides stressed", () => {
    expect(isAngerBlowupEligible(0, 100, 100)).toBe(false);
  });

  it("is false when the bond is bad enough but neither side is stressed", () => {
    expect(isAngerBlowupEligible(RIVAL_THRESHOLD, 0, 0)).toBe(false);
  });

  it("is true right at RIVAL_THRESHOLD with stressA at the panic threshold — both boundaries inclusive", () => {
    expect(isAngerBlowupEligible(RIVAL_THRESHOLD, STRESS_PANIC_THRESHOLD, 0)).toBe(true);
  });

  it("is false one point short of RIVAL_THRESHOLD (a bond that isn't quite a rivalry yet)", () => {
    expect(isAngerBlowupEligible(RIVAL_THRESHOLD + 1, STRESS_PANIC_THRESHOLD, STRESS_PANIC_THRESHOLD)).toBe(false);
  });

  it("is false one point short of STRESS_PANIC_THRESHOLD on both sides", () => {
    expect(isAngerBlowupEligible(RIVAL_THRESHOLD, STRESS_PANIC_THRESHOLD - 1, STRESS_PANIC_THRESHOLD - 1)).toBe(false);
  });

  it("trips on stressA alone when stressB is calm", () => {
    expect(isAngerBlowupEligible(RIVAL_THRESHOLD - 10, STRESS_PANIC_THRESHOLD, 0)).toBe(true);
  });

  it("trips on stressB alone when stressA is calm — either side is enough, not both", () => {
    expect(isAngerBlowupEligible(RIVAL_THRESHOLD - 10, 0, STRESS_PANIC_THRESHOLD)).toBe(true);
  });

  it("a bond far below the threshold is still just eligible, not 'more' eligible — this is a boolean gate, not a scaled one", () => {
    expect(isAngerBlowupEligible(-100, STRESS_PANIC_THRESHOLD, 0)).toBe(true);
  });

  it("the real seeded Anand/Iyari rivalry (bond -25) trips on Anand's own seeded Stress (78) with a calm Iyari (40) — npcSeed.ts's NPC_BOND_SEED and NPC_SEED, not synthetic numbers", () => {
    expect(isAngerBlowupEligible(-25, 78, 40)).toBe(true);
  });

  it("the same real Anand/Iyari rivalry also trips with the pair's stress arguments swapped — order-independent on which side is 'A'", () => {
    expect(isAngerBlowupEligible(-25, 40, 78)).toBe(true);
  });
});

describe("applyAngerBlowupStressRelief", () => {
  it("subtracts ANGER_BLOWUP_STRESS_RELIEF from stress", () => {
    expect(applyAngerBlowupStressRelief(80)).toBe(80 - ANGER_BLOWUP_STRESS_RELIEF);
  });

  it("floors at 0 rather than going negative", () => {
    expect(applyAngerBlowupStressRelief(10)).toBe(0);
  });

  it("floors at 0 exactly at the boundary", () => {
    expect(applyAngerBlowupStressRelief(ANGER_BLOWUP_STRESS_RELIEF)).toBe(0);
  });

  it("stress already at 0 stays at 0", () => {
    expect(applyAngerBlowupStressRelief(0)).toBe(0);
  });
});

describe("pickAngerBlowupExchange", () => {
  it("always returns an exchange from the real bank", () => {
    for (let i = 0; i < 30; i++) {
      expect(ANGER_BLOWUP_EXCHANGES).toContain(pickAngerBlowupExchange());
    }
  });

  it("picks from more than one exchange across enough draws", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) seen.add(pickAngerBlowupExchange().lineA);
    expect(seen.size).toBeGreaterThan(1);
  });

  it("with Math.random pinned to 0, always returns the bank's first entry", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(pickAngerBlowupExchange()).toBe(ANGER_BLOWUP_EXCHANGES[0]);
    vi.restoreAllMocks();
  });

  it("the bank has real content on both sides of every exchange, not an empty placeholder", () => {
    expect(ANGER_BLOWUP_EXCHANGES.length).toBeGreaterThanOrEqual(5);
    for (const ex of ANGER_BLOWUP_EXCHANGES) {
      expect(ex.lineA.length).toBeGreaterThan(0);
      expect(ex.lineB.length).toBeGreaterThan(0);
    }
  });
});

describe("constants", () => {
  it("ANGER_BLOWUP_BOND_DELTA makes an already-bad bond worse, not better", () => {
    expect(ANGER_BLOWUP_BOND_DELTA).toBeLessThan(0);
  });

  it("ANGER_BLOWUP_CHANCE is a real probability, not 0 or 1", () => {
    expect(ANGER_BLOWUP_CHANCE).toBeGreaterThan(0);
    expect(ANGER_BLOWUP_CHANCE).toBeLessThan(1);
  });
});
