// src/data/__tests__/dualProcess.test.ts
// Reaction Engine, dual-process threshold rule (17 Sep 2026). The rule's
// whole job is to bend an echo lean by what a pilot carries, so these lock
// the properties the design actually asks for: a rookie is unchanged, the
// curve dips before it climbs, it moves gradually, and nobody ever goes
// silent.
//
// Rewritten 22 Sep 2026 for two changes that landed the same evening:
//   - PER-ECHO profiles (Maxime: "each a weight of their own. Not paired"):
//     DUAL_PROCESS_PROFILE is animal x echo, 36 cells, each read off that
//     echo's own weight. claude/Bloom_Wars_Build_Log_Addendum_PerEchoDualProcess_22Sep2026.md.
//   - TWO CLOCKS (Maxime: "Two clocks, build now"): habituation reads the
//     ledger (recent), sensitization reads the echo bank (career).
//     claude/Bloom_Wars_Build_Log_Addendum_TwoClocks_22Sep2026.md.
// The per-echo build shipped without this file being updated, which broke
// tsc and therefore `npm run build`; this rewrite is also that fix.
import { describe, it, expect } from "vitest";
import {
  DUAL_PROCESS_PROFILE,
  HABITUATION_FLOOR,
  HAB_SCALE,
  MASSED_MULTIPLIER,
  MAX_BANK_STEP,
  SENSITIZATION_BANK_SCALE,
  SENSITIZATION_BANK_STEEPNESS,
  SENSITIZATION_CAP,
  SENSITIZATION_STEEPNESS,
  SPACED_MULTIPLIER,
  historyAdjustedLean,
  historyGain,
  historyGains,
  spacingMultiplier,
} from "../dualProcess";
import { ECHO_BASE_LEAN, bankRate } from "../echoLean";
import type { Catalyst, Echo } from "../ambientLines";

const CATALYSTS: Catalyst[] = ["wolf", "dog", "cat", "crow", "raven", "bear", "fox", "rabbit", "shark"];
const ECHOES: Echo[] = ["love", "fear", "anger", "sadness"];
const CELLS: [Catalyst, Echo][] = CATALYSTS.flatMap((c) => ECHOES.map((e): [Catalyst, Echo] => [c, e]));
/** Where a cell's sensitization is centred, in bank units. */
const bankThreshold = (c: Catalyst, e: Echo) => DUAL_PROCESS_PROFILE[c][e].threshold * SENSITIZATION_BANK_SCALE;

describe("DUAL_PROCESS_PROFILE — per echo", () => {
  it("has a profile for every animal and every echo, with a positive threshold and a real dampening depth", () => {
    for (const [c, e] of CELLS) {
      const p = DUAL_PROCESS_PROFILE[c][e];
      expect(p.threshold).toBeGreaterThan(0);
      expect(p.habDepth).toBeGreaterThan(0);
      expect(p.habDepth).toBeLessThan(1);
    }
  });

  it("reads each echo's profile off that echo's own weight alone — never a sum across echoes", () => {
    // Dog, Cat and Bear share a fear weight (.20) and differ everywhere else;
    // Wolf and Dog share an anger weight (.15). Equal weight, equal profile.
    expect(ECHO_BASE_LEAN.dog.fear).toBe(ECHO_BASE_LEAN.bear.fear);
    expect(DUAL_PROCESS_PROFILE.dog.fear).toEqual(DUAL_PROCESS_PROFILE.cat.fear);
    expect(DUAL_PROCESS_PROFILE.dog.fear).toEqual(DUAL_PROCESS_PROFILE.bear.fear);
    expect(ECHO_BASE_LEAN.wolf.anger).toBe(ECHO_BASE_LEAN.dog.anger);
    expect(DUAL_PROCESS_PROFILE.wolf.anger).toEqual(DUAL_PROCESS_PROFILE.dog.anger);
  });

  it("puts the psychology on the echo: at equal weight, fear kindles first and sadness wears down deepest", () => {
    // Raven is the even row (.25 everywhere), so only the echo differs.
    const r = DUAL_PROCESS_PROFILE.raven;
    expect(r.fear.threshold).toBeLessThan(r.anger.threshold);
    expect(r.anger.threshold).toBeLessThan(r.sadness.threshold);
    expect(r.sadness.threshold).toBeLessThan(r.love.threshold);
    expect(r.sadness.habDepth).toBeGreaterThan(r.love.habDepth);
    expect(r.love.habDepth).toBeGreaterThan(r.anger.habDepth);
    expect(r.anger.habDepth).toBeGreaterThan(r.fear.habDepth);
  });

  it("a heavier weight amplifies that echo's own nature", () => {
    // Fear kindles: more fear, earlier tip.
    expect(DUAL_PROCESS_PROFILE.rabbit.fear.threshold).toBeLessThan(DUAL_PROCESS_PROFILE.shark.fear.threshold);
    // Anger kindles too: Shark's is the heaviest anger in the table.
    expect(DUAL_PROCESS_PROFILE.shark.anger.threshold).toBeLessThan(DUAL_PROCESS_PROFILE.rabbit.anger.threshold);
    // Sadness withdraws: more sadness, deeper wear.
    expect(DUAL_PROCESS_PROFILE.bear.sadness.habDepth).toBeGreaterThan(DUAL_PROCESS_PROFILE.wolf.sadness.habDepth);
  });
});

describe("historyGain — two clocks", () => {
  it("is exactly 1 with an empty ledger and an empty bank, for all 36 cells — a rookie reads as they always did", () => {
    for (const [c, e] of CELLS) expect(historyGain(0, 0, DUAL_PROCESS_PROFILE[c][e])).toBeCloseTo(1, 10);
  });

  it("treats negative inputs as zero", () => {
    for (const [c, e] of CELLS) expect(historyGain(-5, -5, DUAL_PROCESS_PROFILE[c][e])).toBeCloseTo(1, 10);
  });

  it("habituation reads the ledger: a heavy recent ledger on an empty bank only ever quiets", () => {
    for (const [c, e] of CELLS) {
      const p = DUAL_PROCESS_PROFILE[c][e];
      for (const h of [0.5, 1, 2.5, 5, 12]) expect(historyGain(h, 0, p)).toBeLessThan(1);
    }
  });

  it("sensitization reads the bank: the same ledger climbs back past baseline once the career is heavy enough", () => {
    for (const [c, e] of CELLS) {
      const p = DUAL_PROCESS_PROFILE[c][e];
      const quiet = historyGain(HAB_SCALE, 0, p);
      const wound = historyGain(HAB_SCALE, bankThreshold(c, e) + 8, p);
      expect(wound).toBeGreaterThan(1);
      expect(wound).toBeGreaterThan(quiet);
    }
  });

  it("dips before it climbs, over a career: a steady ledger with a bank filling from empty", () => {
    for (const [c, e] of CELLS) {
      const p = DUAL_PROCESS_PROFILE[c][e];
      const T = bankThreshold(c, e);
      const path = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5].map((f) => historyGain(HAB_SCALE, f * T + (f === 1.5 ? 8 : 0), p));
      expect(path[0]).toBeLessThan(1);
      expect(path[path.length - 1]).toBeGreaterThan(1);
      for (let i = 1; i < path.length; i++) expect(path[i]).toBeGreaterThanOrEqual(path[i - 1]);
    }
  });

  it("a short hard spell with no career behind it never winds anyone up", () => {
    // Two weeks of the worst the ledger holds (p99 ~2.8, max seen ~4.6) on a
    // bank one bad month could fill. This is the one-clock rule's failure:
    // it wound pilots up on recency alone.
    for (const [c, e] of CELLS) {
      const p = DUAL_PROCESS_PROFILE[c][e];
      expect(historyGain(4.6, 3 * bankRate(c, e), p)).toBeLessThan(1);
    }
  });

  it("never leaves the floor/cap rails, however heavy the ledger or the bank", () => {
    for (const [c, e] of CELLS) {
      const p = DUAL_PROCESS_PROFILE[c][e];
      for (const h of [0, 0.1, 1, 3, 8, 24, 1000]) {
        for (const b of [0, 1, 10, 100, 10000]) {
          const g = historyGain(h, b, p);
          expect(g).toBeGreaterThanOrEqual(HABITUATION_FLOOR);
          expect(g).toBeLessThanOrEqual(SENSITIZATION_CAP);
        }
      }
    }
  });

  it("moves gradually — no single ledger entry or bank entry flips a pilot's register", () => {
    // The steepest legal step is one full-weight memory landing at the worst
    // possible point on the curve: +1.0 x the spacing bonus on the ledger,
    // +MAX_BANK_STEP on the bank. Same bound as the one-clock rule had.
    for (const [c, e] of CELLS) {
      const p = DUAL_PROCESS_PROFILE[c][e];
      const T = bankThreshold(c, e);
      for (let h = 0; h <= 12; h += 0.25) {
        expect(Math.abs(historyGain(h + SPACED_MULTIPLIER, 0, p) - historyGain(h, 0, p))).toBeLessThan(0.25);
      }
      for (let b = 0; b <= T + 20; b += 0.25) {
        expect(Math.abs(historyGain(1, b + MAX_BANK_STEP, p) - historyGain(1, b, p))).toBeLessThan(0.25);
      }
    }
  });

  it("derives the bank steepness so one memory moves the curve no further than it could on the ledger", () => {
    expect(MAX_BANK_STEP).toBeCloseTo(2, 10); // a Shark's anger: .50 / .25
    expect(SENSITIZATION_BANK_STEEPNESS * MAX_BANK_STEP).toBeCloseTo(SENSITIZATION_STEEPNESS * SPACED_MULTIPLIER, 10);
  });

  it("nature filters what winds a pilot up: the career it takes is the threshold over the animal's own bank rate", () => {
    // Full-weight memories needed to reach the tip, per cell.
    const toTip = (c: Catalyst, e: Echo) => bankThreshold(c, e) / bankRate(c, e);
    // A Shark's anger winds up within a handful of hard Debriefs; its fear
    // takes a career several times longer — "fear is for other people".
    expect(toTip("shark", "anger")).toBeLessThan(6);
    expect(toTip("shark", "fear")).toBeGreaterThan(5 * toTip("shark", "anger"));
    // Mirror image for the Rabbit: fear first, anger effectively never.
    expect(toTip("rabbit", "fear")).toBeLessThan(toTip("rabbit", "anger") / 5);
    // The same fear career winds a Rabbit up long before a Shark.
    expect(toTip("rabbit", "fear")).toBeLessThan(toTip("shark", "fear"));
  });

  it("an early-tipping echo is wound up while a late-tipping one is still quieting, on the same ledger and the same bank", () => {
    // Rabbit fear tips at 8.4 bank units, Shark fear at 14.4. Give both the
    // same ordinary ledger and a bank past one tip and well short of the
    // other (the bank curve is wide on purpose — see the steepness test —
    // so "short of" needs a margin, not a hair).
    const rabbit = historyGain(HAB_SCALE, 10, DUAL_PROCESS_PROFILE.rabbit.fear);
    const shark = historyGain(HAB_SCALE, 10, DUAL_PROCESS_PROFILE.shark.fear);
    expect(rabbit).toBeGreaterThan(1);
    expect(shark).toBeLessThan(1);
  });
});

describe("historyGains", () => {
  it("scores each echo off its own ledger and bank, not a shared total", () => {
    const g = historyGains("wolf", { sadness: 10 }, { sadness: 1 });
    expect(g.love).toBeCloseTo(1, 10);
    expect(g.fear).toBeCloseTo(1, 10);
    expect(g.anger).toBeCloseTo(1, 10);
    expect(g.sadness).not.toBeCloseTo(1, 3);
  });

  it("treats a missing echo as no history on either clock", () => {
    const g = historyGains("bear", {}, {});
    for (const e of ECHOES) expect(g[e]).toBeCloseTo(1, 10);
  });

  it("reads each echo's own profile, not the animal's", () => {
    // Same ledger and bank on two of a Shark's echoes; the defining one
    // (anger) and the incidental one (fear) must not answer identically.
    const g = historyGains("shark", { anger: 2.5, fear: 2.5 }, { anger: 12, fear: 12 });
    expect(g.anger).not.toBeCloseTo(g.fear, 3);
    expect(g.anger).toBeGreaterThan(g.fear);
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
      const out = historyAdjustedLean(base, historyGains(c, {}, {}));
      for (const e of ECHOES) expect(out[e]).toBeCloseTo(base[e], 10);
    }
  });

  it("does not renormalize — relative weights are the point", () => {
    const base = ECHO_BASE_LEAN.rabbit;
    const out = historyAdjustedLean(base, historyGains("rabbit", { fear: 2.5 }, { fear: 20 }));
    const sum = ECHOES.reduce((s, e) => s + out[e], 0);
    expect(sum).not.toBeCloseTo(1, 3);
    expect(out.fear / base.fear).toBeGreaterThan(out.love / base.love);
  });

  it("never emits a negative weight", () => {
    const out = historyAdjustedLean({ love: -1, fear: 0.5, anger: 0.2, sadness: 0.3 }, historyGains("cat", { fear: 4 }, { fear: 4 }));
    for (const e of ECHOES) expect(out[e]).toBeGreaterThanOrEqual(0);
  });
});
