// Worry with real texture — first-slice unit tests, 27 Aug 2026. Pure
// module, no engine imports (src/data/** purity rule, Build Brief §5.2).
import { describe, it, expect } from "vitest";
import {
  worryIntensity,
  worryClosenessMultiplier,
  worryTriggerChance,
  WORRY_RAMP_MS,
  WORRY_CLOSENESS_CEILING,
  WORRY_CLOSENESS_FLOOR,
} from "../missionWorry";

describe("worryIntensity", () => {
  it("is 0 right at onset (elapsed = 0)", () => {
    expect(worryIntensity(0)).toBe(0);
  });

  it("is 0 for a negative elapsed (hasn't reached onset yet)", () => {
    expect(worryIntensity(-5000)).toBe(0);
  });

  it("is 0.5 halfway through the ramp", () => {
    expect(worryIntensity(WORRY_RAMP_MS / 2)).toBeCloseTo(0.5);
  });

  it("is 1.0 exactly at the end of the ramp", () => {
    expect(worryIntensity(WORRY_RAMP_MS)).toBe(1);
  });

  it("caps at 1.0 well past the ramp — never exceeds full intensity", () => {
    expect(worryIntensity(WORRY_RAMP_MS * 10)).toBe(1);
  });

  it("increases monotonically as elapsed time increases", () => {
    const a = worryIntensity(WORRY_RAMP_MS * 0.2);
    const b = worryIntensity(WORRY_RAMP_MS * 0.6);
    expect(b).toBeGreaterThan(a);
  });
});

describe("worryClosenessMultiplier", () => {
  it("returns the floor for zero favorability, not zero itself", () => {
    expect(worryClosenessMultiplier(0)).toBeCloseTo(WORRY_CLOSENESS_FLOOR);
  });

  it("returns the floor for negative favorability — never goes below it", () => {
    expect(worryClosenessMultiplier(-50)).toBeCloseTo(WORRY_CLOSENESS_FLOOR);
  });

  it("returns 1.0 exactly at the ceiling", () => {
    expect(worryClosenessMultiplier(WORRY_CLOSENESS_CEILING)).toBeCloseTo(1);
  });

  it("caps at 1.0 well above the ceiling", () => {
    expect(worryClosenessMultiplier(WORRY_CLOSENESS_CEILING * 3)).toBeCloseTo(1);
  });

  it("a closer pilot (higher favorability) always gets a multiplier at least as high as a more distant one", () => {
    const distant = worryClosenessMultiplier(10);
    const close = worryClosenessMultiplier(60);
    expect(close).toBeGreaterThan(distant);
  });
});

describe("worryTriggerChance", () => {
  it("is 0 before onset regardless of how close the pilot is", () => {
    expect(worryTriggerChance(-1000, 999)).toBe(0);
  });

  it("is bounded in [0, 1] across a spread of realistic inputs", () => {
    const elapsedSamples = [-1000, 0, WORRY_RAMP_MS / 4, WORRY_RAMP_MS, WORRY_RAMP_MS * 5];
    const favSamples = [-50, 0, 10, 50, WORRY_CLOSENESS_CEILING, 200];
    for (const e of elapsedSamples) {
      for (const f of favSamples) {
        const chance = worryTriggerChance(e, f);
        expect(chance).toBeGreaterThanOrEqual(0);
        expect(chance).toBeLessThanOrEqual(1);
      }
    }
  });

  it("a close pilot (high favorability) has a higher chance than a distant one at the same elapsed time", () => {
    const distant = worryTriggerChance(WORRY_RAMP_MS / 2, 5);
    const close = worryTriggerChance(WORRY_RAMP_MS / 2, 70);
    expect(close).toBeGreaterThan(distant);
  });

  it("the same pilot's chance climbs as more time passes since onset — the actual 'ramp not snap' behavior", () => {
    const early = worryTriggerChance(WORRY_RAMP_MS * 0.1, 60);
    const late = worryTriggerChance(WORRY_RAMP_MS * 0.8, 60);
    expect(late).toBeGreaterThan(early);
  });

  it("reaches its maximum (intensity 1 × full multiplier) for a very close pilot well past the ramp", () => {
    const chance = worryTriggerChance(WORRY_RAMP_MS * 5, 999);
    expect(chance).toBeCloseTo(1);
  });
});
