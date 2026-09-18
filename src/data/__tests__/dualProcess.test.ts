// src/data/__tests__/dualProcess.test.ts
// Reaction Engine, dual-process threshold rule (17 Sep 2026). The rule's
// whole job is to bend an echo lean by what a pilot carries, so these lock
// the three properties the design note is actually asking for: a rookie is
// unchanged, the curve dips before it climbs, and nobody ever goes silent.
import { describe, it, expect } from "vitest";
import {
  DUAL_PROCESS_PROFILE,
  HABITUATION_FLOOR,
  HAB_SCALE,
  MASSED_MULTIPLIER,
  SENSITIZATION_CAP,
  SPACED_MULTIPLIER,
  historyAdjustedLean,
  historyGain,
  historyGains,
  spacingMultiplier,
} from "../dualProcess";
import { ECHO_BASE_LEAN } from "../echoLean";
import type { Catalyst, Echo } from "../ambientLines";

const CATALYSTS: Catalyst[] = ["wolf", "dog", "cat", "crow", "raven", "bear", "fox", "rabbit", "shark"];
const ECHOES: Echo[] = ["love", "fear", "anger", "sadness"];

describe("DUAL_PROCESS_PROFILE", () => {
  it("has a row per catalyst with a reachable threshold and a real dampening depth", () => {
    for (const c of CATALYSTS) {
      const p = DUAL_PROCESS_PROFILE[c];
      expect(p.threshold).toBeGreaterThan(0);
      expect(p.habDepth).toBeGreaterThan(0);
      expect(p.habDepth).toBeLessThan(1);
    }
  });

  it("derives from fear and sadness, not from the anger+love sum that is the same number twice", () => {
    // Every ECHO_BASE_LEAN row sums to 1, so anger+love === 1 - (fear+sadness).
    // The guard: two animals with equal anger+love must still be allowed to
    // differ, and Bear vs Crow (both 0.65/0.35 on the old statistic... and
    // deliberately different on fear) is the case that proves it.
    const highFear = DUAL_PROCESS_PROFILE.rabbit.threshold;
    const lowFear = DUAL_PROCESS_PROFILE.shark.threshold;
    expect(highFear).toBeLessThan(lowFear);
    // Bear answers with sadness more than anyone; it should wear down furthest.
    for (const c of CATALYSTS) {
      if (c === "bear") continue;
      expect(DUAL_PROCESS_PROFILE.bear.habDepth).toBeGreaterThanOrEqual(DUAL_PROCESS_PROFILE[c].habDepth);
    }
  });
});

describe("historyGain", () => {
  it("is exactly 1 at zero history for every animal — a rookie reads as they always did", () => {
    for (const c of CATALYSTS) {
      expect(historyGain(0, DUAL_PROCESS_PROFILE[c])).toBeCloseTo(1, 10);
    }
  });

  it("treats negative history as zero", () => {
    for (const c of CATALYSTS) {
      expect(historyGain(-5, DUAL_PROCESS_PROFILE[c])).toBeCloseTo(1, 10);
    }
  });

  it("dips below 1 first (habituation saturates fast), then climbs back past it (sensitization tips late)", () => {
    for (const c of CATALYSTS) {
      const p = DUAL_PROCESS_PROFILE[c];
      // Sample the first saturation window; the minimum must be a real dip.
      const early = [0.5, 1, 1.5, 2, 2.5].map((h) => historyGain(h, p));
      expect(Math.min(...early)).toBeLessThan(1);
      // Far past the threshold, sensitization has overtaken it.
      expect(historyGain(p.threshold + 6, p)).toBeGreaterThan(Math.min(...early));
    }
  });

  it("never leaves the floor/cap rails, however heavy the ledger", () => {
    for (const c of CATALYSTS) {
      const p = DUAL_PROCESS_PROFILE[c];
      for (const h of [0, 0.1, 1, 3, 8, 24, 1000]) {
        const g = historyGain(h, p);
        expect(g).toBeGreaterThanOrEqual(HABITUATION_FLOOR);
        expect(g).toBeLessThanOrEqual(SENSITIZATION_CAP);
      }
    }
  });

  it("moves gradually — no single ledger entry flips a pilot's register", () => {
    // The steepest legal step is one full-weight memory (1.0) landing at the
    // worst possible point on the curve. It must stay well under a doubling.
    for (const c of CATALYSTS) {
      const p = DUAL_PROCESS_PROFILE[c];
      for (let h = 0; h <= 12; h += 0.25) {
        const step = Math.abs(historyGain(h + 1, p) - historyGain(h, p));
        expect(step).toBeLessThan(0.25);
      }
    }
  });

  it("an early-tipping animal recovers past baseline while a late-tipping one is still quieting", () => {
    // Rabbit (fear .35) tips at 1.8; Shark (fear .10) at 4.8. At a ledger
    // weight of 3 — a few missions in, the ordinary case — they should be on
    // opposite sides of baseline. This is the handoff note's own pair, and it
    // is the whole point of deriving the threshold from fear.
    const rabbit = historyGain(3, DUAL_PROCESS_PROFILE.rabbit);
    const shark = historyGain(3, DUAL_PROCESS_PROFILE.shark);
    expect(rabbit).toBeGreaterThan(1);
    expect(shark).toBeLessThan(1);
  });

  it("habituation still bites first on an animal that tips late", () => {
    // Shark cannot reach its threshold inside a realistic campaign, so its
    // curve should be habituation-only across the whole useful range.
    const p = DUAL_PROCESS_PROFILE.shark;
    expect(historyGain(HAB_SCALE, p)).toBeLessThan(1);
    expect(1 - historyGain(HAB_SCALE, p)).toBeGreaterThan(0.25 * p.habDepth);
  });

});

describe("historyGains", () => {
  it("scores each echo off its own history, not a shared total", () => {
    const g = historyGains("wolf", { sadness: 10 });
    expect(g.love).toBeCloseTo(1, 10);
    expect(g.fear).toBeCloseTo(1, 10);
    expect(g.anger).toBeCloseTo(1, 10);
    expect(g.sadness).not.toBeCloseTo(1, 3);
  });

  it("treats a missing echo as no history", () => {
    const g = historyGains("bear", {});
    for (const e of ECHOES) expect(g[e]).toBeCloseTo(1, 10);
  });
});

describe("spacingMultiplier", () => {
  it("is neutral for zero or one memory", () => {
    expect(spacingMultiplier([])).toBe(1);
    expect(spacingMultiplier([7])).toBe(1);
  });

  it("discounts a run crammed into one bad week", () => {
    expect(spacingMultiplier([10, 11, 12])).toBe(MASSED_MULTIPLIER);
    expect(spacingMultiplier([12, 10, 11])).toBe(MASSED_MULTIPLIER);
  });

  it("amplifies a run spread over a season", () => {
    expect(spacingMultiplier([0, 10, 20, 30])).toBe(SPACED_MULTIPLIER);
  });

  it("is neutral in between", () => {
    expect(spacingMultiplier([0, 3, 6, 9])).toBe(1);
  });
});

describe("historyAdjustedLean", () => {
  it("is the identity when nothing has happened yet", () => {
    for (const c of CATALYSTS) {
      const base = ECHO_BASE_LEAN[c];
      const out = historyAdjustedLean(base, historyGains(c, {}));
      for (const e of ECHOES) expect(out[e]).toBeCloseTo(base[e], 10);
    }
  });

  it("does not renormalize — relative weights are the point", () => {
    const base = ECHO_BASE_LEAN.rabbit;
    const out = historyAdjustedLean(base, historyGains("rabbit", { fear: 9 }));
    const sum = ECHOES.reduce((s, e) => s + out[e], 0);
    expect(sum).not.toBeCloseTo(1, 3);
    expect(out.fear / base.fear).toBeGreaterThan(out.love / base.love);
  });

  it("never emits a negative weight", () => {
    const out = historyAdjustedLean({ love: -1, fear: 0.5, anger: 0.2, sadness: 0.3 }, historyGains("cat", { fear: 4 }));
    for (const e of ECHOES) expect(out[e]).toBeGreaterThanOrEqual(0);
  });
});
