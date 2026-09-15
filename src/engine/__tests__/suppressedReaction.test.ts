// src/engine/__tests__/suppressedReaction.test.ts
// Gate 4's write side, 14 Sep 2026.
//
// Scope, stated so the gap is visible rather than implied: these cover the two
// pure helpers. applySuppression itself needs a real CampaignState (it goes
// through memoryLedger's recordMemory on purpose — see that file's header for
// why a pure version was wrong), so it is owed an integration test alongside
// the Hub wiring rather than a unit test here.
//
// The intensity curve is the case worth having. data/ambientLines.ts's
// pickSoloEcho rolls `rng() < topWorry.intensity` and returns fear ahead of the
// pilot's own echo lean, so a worry that sits too high for too long does not
// read as a worried pilot, it reads as a pilot who lost their personality. The
// ceiling and the falloff are the two things keeping that from happening, and
// both are pinned below.
import { describe, it, expect } from "vitest";
import {
  suppressionWorryIntensity,
  deferralCanFire,
  SUPPRESSION_WORRY_PEAK,
  SUPPRESSION_WORRY_WINDOW_MS,
} from "../suppressedReaction";
import type { WorryEntry } from "../../data/worries";

const BORN = 1_000_000;

function worry(overrides: Partial<WorryEntry> = {}): WorryEntry {
  return {
    source: "hub_suppressed_anger",
    catalyst: "raven",
    intensity: SUPPRESSION_WORRY_PEAK,
    context: "hub",
    bornAt: BORN,
    expiresAt: BORN + SUPPRESSION_WORRY_WINDOW_MS,
    ...overrides,
  };
}

describe("suppressionWorryIntensity — the falloff", () => {
  it("is at peak the instant it is born", () => {
    expect(suppressionWorryIntensity(worry(), BORN)).toBeCloseTo(SUPPRESSION_WORRY_PEAK);
  });

  it("is at half peak halfway through the window", () => {
    const halfway = BORN + SUPPRESSION_WORRY_WINDOW_MS / 2;
    expect(suppressionWorryIntensity(worry(), halfway)).toBeCloseTo(SUPPRESSION_WORRY_PEAK / 2);
  });

  it("reaches actual zero at expiry, not a long thin tail", () => {
    // Linear rather than exponential specifically so it gets out of the
    // WORRIES_STACK_CAP way instead of lingering at 0.02 forever.
    expect(suppressionWorryIntensity(worry(), BORN + SUPPRESSION_WORRY_WINDOW_MS)).toBe(0);
  });

  it("stays at zero past expiry rather than going negative", () => {
    expect(suppressionWorryIntensity(worry(), BORN + SUPPRESSION_WORRY_WINDOW_MS * 3)).toBe(0);
  });

  it("clamps to peak for a clock that reads before the birth time", () => {
    expect(suppressionWorryIntensity(worry(), BORN - 5000)).toBeCloseTo(SUPPRESSION_WORRY_PEAK);
  });

  it("never exceeds the peak, at any point in the window", () => {
    for (let t = BORN; t <= BORN + SUPPRESSION_WORRY_WINDOW_MS; t += SUPPRESSION_WORRY_WINDOW_MS / 20) {
      expect(suppressionWorryIntensity(worry(), t)).toBeLessThanOrEqual(SUPPRESSION_WORRY_PEAK);
    }
  });

  it("returns zero rather than dividing by zero on a degenerate window", () => {
    expect(suppressionWorryIntensity(worry({ expiresAt: BORN }), BORN)).toBe(0);
  });

  it("decreases monotonically across the window", () => {
    let previous = Infinity;
    for (let t = BORN; t <= BORN + SUPPRESSION_WORRY_WINDOW_MS; t += 30_000) {
      const current = suppressionWorryIntensity(worry(), t);
      expect(current).toBeLessThanOrEqual(previous);
      previous = current;
    }
  });
});

describe("SUPPRESSION_WORRY_PEAK stays out of pickSoloEcho's way", () => {
  it("is well under 1.0, so a held reaction colours a pilot's lines instead of replacing them", () => {
    // Not a style assertion. At 1.0 the `rng() < intensity` roll in
    // pickSoloEcho can never fail, so every line the pilot speaks is a fear
    // line until the worry expires.
    expect(SUPPRESSION_WORRY_PEAK).toBeGreaterThan(0);
    expect(SUPPRESSION_WORRY_PEAK).toBeLessThan(0.6);
  });
});

describe("deferralCanFire — the table's own 'alone or with exactly one bonded pilot'", () => {
  it("fires in an empty room", () => {
    expect(deferralCanFire([], [])).toBe(true);
  });

  it("fires with exactly one pilot present, if that pilot is bonded", () => {
    expect(deferralCanFire(["anand"], ["anand"])).toBe(true);
  });

  it("does NOT fire with exactly one pilot present who is a stranger", () => {
    // Both halves of the condition matter: one stranger in the room is not
    // privacy, and this is the half a looser reading would drop.
    expect(deferralCanFire(["anand"], ["bosk"])).toBe(false);
  });

  it("does not fire with two pilots present, bonded or not", () => {
    expect(deferralCanFire(["anand", "bosk"], ["anand", "bosk"])).toBe(false);
  });

  it("does not fire in a crowd", () => {
    expect(deferralCanFire(["a", "b", "c", "d"], ["a", "b", "c", "d"])).toBe(false);
  });
});
