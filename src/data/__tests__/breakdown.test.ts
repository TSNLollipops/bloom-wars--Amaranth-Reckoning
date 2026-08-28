// Breakdown — unit tests, 28 Aug 2026 (Groups 3-5 batch rebuild, second
// pass — see breakdown.ts's own header for why this exists). Pure
// module, no engine imports (src/data/** purity rule, Build Brief §5.2).
import { describe, it, expect, vi } from "vitest";
import {
  isBreakdownEligible,
  applyBreakdownStressRelief,
  pickBreakdownOnsetLine,
  pickBreakdownResolutionLine,
  BREAKDOWN_ONSET_LINES,
  BREAKDOWN_RESOLUTION_LINES,
  BREAKDOWN_CHANCE,
  BREAKDOWN_STRESS_RELIEF,
  BREAKDOWN_FAVORABILITY_GAIN,
  BREAKDOWN_SLEEP_TIMEOUT_MS,
} from "../breakdown";
import { STRESS_PANIC_THRESHOLD } from "../ambientLines";

describe("isBreakdownEligible", () => {
  it("mirrors ambientLines.ts's own STRESS_PANIC_THRESHOLD exactly — the same panic cutoff Anger Blowup reads, not a second invented number", () => {
    expect(isBreakdownEligible(STRESS_PANIC_THRESHOLD, true)).toBe(true);
  });

  it("is true right at the Stress threshold when worried is also true — boundary inclusive", () => {
    expect(isBreakdownEligible(STRESS_PANIC_THRESHOLD, true)).toBe(true);
  });

  it("is true for Stress well above the threshold, worried true", () => {
    expect(isBreakdownEligible(100, true)).toBe(true);
  });

  it("is false one point below the Stress threshold, even worried", () => {
    expect(isBreakdownEligible(STRESS_PANIC_THRESHOLD - 1, true)).toBe(false);
  });

  it("is false for healthy Stress, even worried", () => {
    expect(isBreakdownEligible(20, true)).toBe(false);
  });

  it("is false at panic Stress when NOT worried — Stress alone isn't enough, that's Anger Blowup's own gate", () => {
    expect(isBreakdownEligible(100, false)).toBe(false);
  });

  it("is false when neither condition holds", () => {
    expect(isBreakdownEligible(20, false)).toBe(false);
  });
});

describe("applyBreakdownStressRelief", () => {
  it("subtracts BREAKDOWN_STRESS_RELIEF", () => {
    expect(applyBreakdownStressRelief(80)).toBe(80 - BREAKDOWN_STRESS_RELIEF);
  });

  it("clamps at the 0 floor rather than going negative", () => {
    expect(applyBreakdownStressRelief(10)).toBe(0);
  });

  it("clamps exactly at 0 when Stress equals the relief amount", () => {
    expect(applyBreakdownStressRelief(BREAKDOWN_STRESS_RELIEF)).toBe(0);
  });

  it("matches angerBlowup.ts's own relief magnitude — same weight event, same-shaped payoff", async () => {
    const { ANGER_BLOWUP_STRESS_RELIEF } = await import("../angerBlowup");
    expect(BREAKDOWN_STRESS_RELIEF).toBe(ANGER_BLOWUP_STRESS_RELIEF);
  });
});

describe("pickBreakdownOnsetLine", () => {
  it("always returns a line from the real bank", () => {
    for (let i = 0; i < 30; i++) {
      expect(BREAKDOWN_ONSET_LINES).toContain(pickBreakdownOnsetLine());
    }
  });

  it("with Math.random pinned to 0, always returns the bank's first entry", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(pickBreakdownOnsetLine()).toBe(BREAKDOWN_ONSET_LINES[0]);
    vi.restoreAllMocks();
  });

  it("the bank has real content, not an empty placeholder", () => {
    expect(BREAKDOWN_ONSET_LINES.length).toBeGreaterThanOrEqual(5);
    for (const line of BREAKDOWN_ONSET_LINES) expect(line.length).toBeGreaterThan(0);
  });
});

describe("pickBreakdownResolutionLine", () => {
  it("spar flavor always returns a line from BREAKDOWN_RESOLUTION_LINES.spar", () => {
    for (let i = 0; i < 20; i++) {
      expect(BREAKDOWN_RESOLUTION_LINES.spar).toContain(pickBreakdownResolutionLine("spar"));
    }
  });

  it("intimacy flavor always returns a line from BREAKDOWN_RESOLUTION_LINES.intimacy", () => {
    for (let i = 0; i < 20; i++) {
      expect(BREAKDOWN_RESOLUTION_LINES.intimacy).toContain(pickBreakdownResolutionLine("intimacy"));
    }
  });

  it("sleep flavor always returns a line from BREAKDOWN_RESOLUTION_LINES.sleep", () => {
    for (let i = 0; i < 20; i++) {
      expect(BREAKDOWN_RESOLUTION_LINES.sleep).toContain(pickBreakdownResolutionLine("sleep"));
    }
  });

  it("the three flavor banks are genuinely distinct content, not one bank reused three times", () => {
    const sparSet = new Set(BREAKDOWN_RESOLUTION_LINES.spar);
    const intimacySet = new Set(BREAKDOWN_RESOLUTION_LINES.intimacy);
    const sleepSet = new Set(BREAKDOWN_RESOLUTION_LINES.sleep);
    for (const line of sparSet) expect(intimacySet.has(line)).toBe(false);
    for (const line of sparSet) expect(sleepSet.has(line)).toBe(false);
    for (const line of intimacySet) expect(sleepSet.has(line)).toBe(false);
  });

  it("every flavor bank has real content — five lines each, not the first pass's three", () => {
    for (const flavor of ["spar", "intimacy", "sleep"] as const) {
      expect(BREAKDOWN_RESOLUTION_LINES[flavor].length).toBeGreaterThanOrEqual(5);
    }
  });
});

describe("constants", () => {
  it("BREAKDOWN_CHANCE is a real probability, not 0 or 1", () => {
    expect(BREAKDOWN_CHANCE).toBeGreaterThan(0);
    expect(BREAKDOWN_CHANCE).toBeLessThan(1);
  });

  it("BREAKDOWN_CHANCE equals angerBlowup.ts's own ANGER_BLOWUP_CHANCE — same probabilistic-gate shape, not a lower 'rarer event' number", async () => {
    const { ANGER_BLOWUP_CHANCE } = await import("../angerBlowup");
    expect(BREAKDOWN_CHANCE).toBe(ANGER_BLOWUP_CHANCE);
  });

  it("BREAKDOWN_FAVORABILITY_GAIN is a real, small, positive nudge", () => {
    expect(BREAKDOWN_FAVORABILITY_GAIN).toBeGreaterThan(0);
    expect(BREAKDOWN_FAVORABILITY_GAIN).toBeLessThan(BREAKDOWN_STRESS_RELIEF);
  });

  it("BREAKDOWN_SLEEP_TIMEOUT_MS is a positive, real duration — 8 real minutes", () => {
    expect(BREAKDOWN_SLEEP_TIMEOUT_MS).toBe(8 * 60 * 1000);
  });
});
