// src/data/__tests__/echoLean.test.ts
// Emotional Brain Phase 3, 12 Sep 2026 — echo lean and drift
// (data/echoLean.ts) plus the weighted idle pick it feeds
// (data/ambientLines.ts pickWeightedEcho / pickSoloEcho's new bottom rung).
import { describe, it, expect } from "vitest";
import {
  ECHO_BASE_LEAN,
  ECHO_DRIFT_CAP,
  ECHO_DRIFT_PER_MEMORY,
  ECHO_DRIFT_RELAX_PER_DAY,
  ECHO_BANK_RETURN_RATIO,
  ECHO_BANK_INFLUENCE,
  ECHO_BANK_SATURATION,
  ECHO_BANK_PURGE_PER_DAY,
  effectiveEchoLean,
  emptyDrift,
  nudgeDrift,
  relaxDrift,
  dominantEcho,
  bankEcho,
  bankRate,
  bankTotal,
  bankLean,
  purgeBank,
  dominantBankedEcho,
} from "../echoLean";
import { pickSoloEcho, pickWeightedEcho, type AmbientPilotState, type Catalyst, type Echo } from "../ambientLines";
import { mulberry32 } from "../../sim/rng";

const CATALYSTS: Catalyst[] = ["wolf", "dog", "cat", "crow", "raven", "bear", "fox", "rabbit", "shark"];
const ECHOES: Echo[] = ["love", "fear", "anger", "sadness"];

describe("ECHO_BASE_LEAN", () => {
  it("has a row per catalyst that sums to 1 with no negative weight", () => {
    for (const c of CATALYSTS) {
      const row = ECHO_BASE_LEAN[c];
      const sum = ECHOES.reduce((s, e) => s + row[e], 0);
      expect(sum).toBeCloseTo(1, 5);
      for (const e of ECHOES) expect(row[e]).toBeGreaterThanOrEqual(0);
    }
  });

  it("pins the three character reads the build plan names", () => {
    expect(dominantEcho(ECHO_BASE_LEAN.shark)).toBe("anger");
    expect(ECHO_BASE_LEAN.rabbit.anger).toBeLessThan(0.1);
    expect(dominantEcho(ECHO_BASE_LEAN.bear)).toBe("sadness");
  });
});

describe("drift — nudge, cap, relax", () => {
  it("nudgeDrift adds weight × ECHO_DRIFT_PER_MEMORY to one echo and returns a new object", () => {
    const d0 = emptyDrift();
    const d1 = nudgeDrift(d0, "sadness", 1.0);
    expect(d1.sadness).toBeCloseTo(ECHO_DRIFT_PER_MEMORY);
    expect(d1.love).toBe(0);
    expect(d0.sadness).toBe(0);
  });

  it("treats undefined as empty, clamps weight into 0..1, ignores NaN", () => {
    expect(nudgeDrift(undefined, "fear", 0.5).fear).toBeCloseTo(0.5 * ECHO_DRIFT_PER_MEMORY);
    expect(nudgeDrift(undefined, "fear", 7).fear).toBeCloseTo(ECHO_DRIFT_PER_MEMORY);
    expect(nudgeDrift(undefined, "fear", Number.NaN).fear).toBe(0);
    expect(nudgeDrift(undefined, "fear", -3).fear).toBe(0);
  });

  it("never exceeds the cap however many memories land on one echo", () => {
    let d = emptyDrift();
    for (let i = 0; i < 50; i++) d = nudgeDrift(d, "anger", 1.0);
    expect(d.anger).toBe(ECHO_DRIFT_CAP);
  });

  it("relaxDrift decays every echo geometrically per day, and is a copy on zero days", () => {
    const d = { love: 0.4, fear: 0.2, anger: 0.1, sadness: 0.3 };
    const same = relaxDrift(d, 0);
    expect(same).toEqual(d);
    expect(same).not.toBe(d);
    const later = relaxDrift(d, 10);
    const k = Math.pow(ECHO_DRIFT_RELAX_PER_DAY, 10);
    for (const e of ECHOES) expect(later[e]).toBeCloseTo(d[e] * k);
    expect(relaxDrift(d, -5)).toEqual(d);
    expect(relaxDrift(undefined, 3)).toEqual(emptyDrift());
  });

  it("a nudge halves in roughly two weeks", () => {
    const d = nudgeDrift(undefined, "sadness", 1.0);
    const later = relaxDrift(d, 14);
    expect(later.sadness / d.sadness).toBeGreaterThan(0.4);
    expect(later.sadness / d.sadness).toBeLessThan(0.6);
  });
});

describe("effectiveEchoLean + pickWeightedEcho", () => {
  it("with no drift, the effective lean is the base row", () => {
    expect(effectiveEchoLean("wolf")).toEqual(ECHO_BASE_LEAN.wolf);
  });

  it("drift bends the row toward its echo and can flip the dominant one", () => {
    let d = emptyDrift();
    for (let i = 0; i < 4; i++) d = nudgeDrift(d, "sadness", 1.0);
    expect(dominantEcho(effectiveEchoLean("shark", d))).toBe("sadness");
  });

  it("pickWeightedEcho follows the weights over many seeded draws", () => {
    const rng = mulberry32(42);
    const counts: Record<Echo, number> = { love: 0, fear: 0, anger: 0, sadness: 0 };
    for (let i = 0; i < 4000; i++) counts[pickWeightedEcho(ECHO_BASE_LEAN.shark, rng)]++;
    expect(counts.anger).toBeGreaterThan(counts.love);
    expect(counts.anger).toBeGreaterThan(counts.sadness);
    expect(counts.fear).toBeLessThan(counts.love);
    expect(counts.anger / 4000).toBeGreaterThan(0.42);
    expect(counts.anger / 4000).toBeLessThan(0.58);
  });

  it("an all-zero vector falls back to a uniform pick instead of dividing by zero", () => {
    const rng = mulberry32(7);
    const seen = new Set<Echo>();
    for (let i = 0; i < 200; i++) seen.add(pickWeightedEcho(emptyDrift(), rng));
    expect(seen.size).toBe(4);
  });

  it("a single positive weight always wins", () => {
    for (let i = 0; i < 20; i++) expect(pickWeightedEcho({ love: 0, fear: 0, anger: 0, sadness: 0.01 }, Math.random)).toBe("sadness");
  });
});

describe("pickSoloEcho's bottom rung", () => {
  const calm = (extra: Partial<AmbientPilotState> = {}): AmbientPilotState => ({
    catalyst: "shark",
    stage: "green",
    stress: 10,
    morale: 80,
    drunk: false,
    ...extra,
  });

  it("with no echoLean it is the uniform idle pick it always was", () => {
    const rng = mulberry32(3);
    const reasons = new Set<string>();
    const seen = new Set<Echo>();
    for (let i = 0; i < 200; i++) {
      const pick = pickSoloEcho(calm(), rng);
      reasons.add(pick.reason);
      seen.add(pick.echo);
    }
    expect(reasons).toEqual(new Set(["idle"]));
    expect(seen.size).toBe(4);
  });

  it("with echoLean it draws from the lean and reports reason 'lean'", () => {
    const rng = mulberry32(3);
    const counts: Record<Echo, number> = { love: 0, fear: 0, anger: 0, sadness: 0 };
    for (let i = 0; i < 2000; i++) {
      const pick = pickSoloEcho(calm({ echoLean: ECHO_BASE_LEAN.shark }), rng);
      expect(pick.reason).toBe("lean");
      counts[pick.echo]++;
    }
    expect(counts.anger).toBeGreaterThan(counts.fear * 3);
  });

  it("the acute overrides still win over the lean", () => {
    expect(pickSoloEcho(calm({ stress: 90, echoLean: ECHO_BASE_LEAN.shark }), Math.random).echo).toBe("fear");
    expect(pickSoloEcho(calm({ morale: 10, echoLean: ECHO_BASE_LEAN.shark }), Math.random).echo).toBe("sadness");
  });

  it("is reproducible from a seed", () => {
    const a = Array.from({ length: 30 }, () => pickSoloEcho(calm({ echoLean: ECHO_BASE_LEAN.fox }), mulberry32(99)).echo);
    const b = Array.from({ length: 30 }, () => pickSoloEcho(calm({ echoLean: ECHO_BASE_LEAN.fox }), mulberry32(99)).echo);
    expect(a).toEqual(b);
  });
});

// ---- The bank, 22 Sep 2026 --------------------------------------------------

describe("bankEcho / bankTotal — the return line, unbounded on write", () => {
  it("starts from nothing and feeds the named echo by weight × ratio", () => {
    const b = bankEcho(undefined, "sadness", 1.0);
    expect(b.sadness).toBeCloseTo(ECHO_BANK_RETURN_RATIO);
    expect(b.love).toBe(0);
    expect(b.fear).toBe(0);
    expect(b.anger).toBe(0);
    expect(bankTotal(b)).toBeCloseTo(ECHO_BANK_RETURN_RATIO);
  });

  it("accumulates without a cap, unlike drift", () => {
    let b = emptyDrift();
    for (let i = 0; i < 50; i++) b = bankEcho(b, "anger", 1.0);
    expect(b.anger).toBeCloseTo(50 * ECHO_BANK_RETURN_RATIO);
    expect(b.anger).toBeGreaterThan(ECHO_DRIFT_CAP);
  });

  it("clamps the incoming weight to 0..1 and ignores garbage", () => {
    expect(bankEcho(undefined, "love", 7).love).toBeCloseTo(ECHO_BANK_RETURN_RATIO);
    expect(bankEcho(undefined, "love", -3).love).toBe(0);
    expect(bankEcho(undefined, "love", Number.NaN).love).toBe(0);
  });

  it("is pure", () => {
    const a = emptyDrift();
    const b = bankEcho(a, "fear", 0.5);
    expect(a.fear).toBe(0);
    expect(b.fear).toBeGreaterThan(0);
  });
});

describe("bankLean — the read of B, bounded and saturating", () => {
  it("is exactly zero for an empty or undefined bank, so a rookie is unchanged", () => {
    for (const e of ECHOES) {
      expect(bankLean(undefined)[e]).toBe(0);
      expect(bankLean(emptyDrift())[e]).toBe(0);
    }
  });

  it("returns the bank's composition, not its magnitude", () => {
    const thin = bankLean({ love: 0, fear: 0, anger: 0, sadness: ECHO_BANK_SATURATION });
    const thick = bankLean({ love: 0, fear: 0, anger: 0, sadness: ECHO_BANK_SATURATION * 20 });
    expect(thin.sadness).toBeCloseTo(thick.sadness);
    expect(thin.sadness).toBeCloseTo(ECHO_BANK_INFLUENCE);
  });

  it("never sums to more than ECHO_BANK_INFLUENCE across the four echoes", () => {
    const b = { love: 3, fear: 7, anger: 1, sadness: 12 };
    const l = bankLean(b);
    const sum = ECHOES.reduce((s, e) => s + l[e], 0);
    expect(sum).toBeCloseTo(ECHO_BANK_INFLUENCE, 6);
  });

  it("ramps linearly with total until saturation, then holds", () => {
    const half = bankLean({ love: 0, fear: 0, anger: ECHO_BANK_SATURATION / 2, sadness: 0 });
    expect(half.anger).toBeCloseTo(ECHO_BANK_INFLUENCE / 2);
    const one = bankLean({ love: 0, fear: 0, anger: ECHO_BANK_SATURATION, sadness: 0 });
    expect(one.anger).toBeCloseTo(ECHO_BANK_INFLUENCE);
    const over = bankLean({ love: 0, fear: 0, anger: ECHO_BANK_SATURATION * 3, sadness: 0 });
    expect(over.anger).toBeCloseTo(ECHO_BANK_INFLUENCE);
  });

  it("a mixed bank splits the influence in proportion", () => {
    const l = bankLean({ love: 1, fear: 1, anger: 1, sadness: 1 });
    for (const e of ECHOES) expect(l[e]).toBeCloseTo(ECHO_BANK_INFLUENCE / 4);
  });

  it("dilution: new contrary experience shifts the shape, it does not pile on", () => {
    let b = emptyDrift();
    for (let i = 0; i < 6; i++) b = bankEcho(b, "sadness", 1.0);
    const before = bankLean(b);
    for (let i = 0; i < 6; i++) b = bankEcho(b, "love", 1.0);
    const after = bankLean(b);
    expect(after.sadness).toBeLessThan(before.sadness);
    expect(after.love).toBeCloseTo(after.sadness);
    const sumAfter = ECHOES.reduce((s, e) => s + after[e], 0);
    expect(sumAfter).toBeCloseTo(ECHO_BANK_INFLUENCE, 6);
  });
});

describe("purgeBank — the explicit knob, built at neutral", () => {
  it("ECHO_BANK_PURGE_PER_DAY is 1.0 and purgeBank is the identity at any age", () => {
    expect(ECHO_BANK_PURGE_PER_DAY).toBe(1.0);
    const b = { love: 1, fear: 2, anger: 3, sadness: 4 };
    for (const days of [0, 1, 30, 365, 10_000]) {
      const p = purgeBank(b, days);
      for (const e of ECHOES) expect(p[e]).toBe(b[e]);
    }
  });

  it("returns a copy, never the same object", () => {
    const b = { love: 1, fear: 0, anger: 0, sadness: 0 };
    expect(purgeBank(b, 5)).not.toBe(b);
    expect(purgeBank(undefined, 5)).toEqual(emptyDrift());
  });
});

describe("dominantBankedEcho — what the dossier says a pilot has become", () => {
  it("says nothing until the bank is half saturated", () => {
    expect(dominantBankedEcho(undefined)).toBeUndefined();
    expect(dominantBankedEcho(emptyDrift())).toBeUndefined();
    expect(dominantBankedEcho({ love: 0, fear: 0, anger: 0, sadness: ECHO_BANK_SATURATION / 2 - 0.01 })).toBeUndefined();
  });

  it("names the loudest banked echo once it is", () => {
    expect(dominantBankedEcho({ love: 0, fear: 0, anger: 0, sadness: ECHO_BANK_SATURATION / 2 })).toBe("sadness");
    expect(dominantBankedEcho({ love: 5, fear: 1, anger: 2, sadness: 4 })).toBe("love");
  });
});

describe("effectiveEchoLean with a bank", () => {
  it("is unchanged when the bank is absent or empty — every pre-bank caller still gets the same vector", () => {
    for (const c of CATALYSTS) {
      const two = effectiveEchoLean(c, emptyDrift());
      const three = effectiveEchoLean(c, emptyDrift(), undefined);
      const threeEmpty = effectiveEchoLean(c, emptyDrift(), emptyDrift());
      for (const e of ECHOES) {
        expect(three[e]).toBe(two[e]);
        expect(threeEmpty[e]).toBe(two[e]);
      }
    }
  });

  it("adds the bank's lean on top of base and drift", () => {
    const bank = { love: 0, fear: 0, anger: 0, sadness: ECHO_BANK_SATURATION };
    const withBank = effectiveEchoLean("wolf", emptyDrift(), bank);
    const without = effectiveEchoLean("wolf", emptyDrift());
    expect(withBank.sadness).toBeCloseTo(without.sadness + ECHO_BANK_INFLUENCE);
    expect(withBank.love).toBeCloseTo(without.love);
  });

  it("can flip a Wolf's dominant echo from love to sadness — the whole point", () => {
    // Wolf base: love 0.4, sadness 0.15. A saturated sadness bank adds 0.3.
    expect(dominantEcho(effectiveEchoLean("wolf", emptyDrift()))).toBe("love");
    const bank = { love: 0, fear: 0, anger: 0, sadness: ECHO_BANK_SATURATION };
    expect(dominantEcho(effectiveEchoLean("wolf", emptyDrift(), bank))).toBe("sadness");
  });
});

describe("bankRate — nature filters what sticks (22 Sep 2026)", () => {
  it("is the animal's own lean row scaled to a mean of 1.0", () => {
    for (const c of CATALYSTS) {
      const mean = ECHOES.reduce((sum, e) => sum + bankRate(c, e), 0) / 4;
      expect(mean).toBeCloseTo(1, 6);
      for (const e of ECHOES) expect(bankRate(c, e)).toBeCloseTo(ECHO_BASE_LEAN[c][e] * 4, 10);
    }
  });

  it("a Shark banks anger fast and fear slow; a Rabbit the reverse", () => {
    expect(bankRate("shark", "anger")).toBeCloseTo(2.0);
    expect(bankRate("shark", "fear")).toBeCloseTo(0.4);
    expect(bankRate("rabbit", "anger")).toBeCloseTo(0.2);
    expect(bankRate("rabbit", "fear")).toBeCloseTo(1.4);
  });

  it("a Raven, the even row, is untouched by this — every rate is exactly 1.0", () => {
    for (const e of ECHOES) expect(bankRate("raven", e)).toBeCloseTo(1.0, 10);
  });

  it("an unknown catalyst falls back to neutral, never throws", () => {
    for (const e of ECHOES) expect(bankRate(undefined, e)).toBe(1);
  });

  it("bankEcho applies it: the same sadness sticks to a Bear more than twice as hard as to a Fox", () => {
    const bear = bankEcho(undefined, "sadness", 1.0, "bear");
    const fox = bankEcho(undefined, "sadness", 1.0, "fox");
    expect(bear.sadness / fox.sadness).toBeCloseTo(ECHO_BASE_LEAN.bear.sadness / ECHO_BASE_LEAN.fox.sadness);
    expect(bear.sadness / fox.sadness).toBeGreaterThan(2);
  });

  it("bankEcho without a catalyst is the neutral rate, so every earlier test of it still holds", () => {
    const a = bankEcho(undefined, "anger", 0.5);
    const b = bankEcho(undefined, "anger", 0.5, undefined);
    expect(a.anger).toBe(b.anger);
    expect(a.anger).toBeCloseTo(0.5 * ECHO_BANK_RETURN_RATIO);
  });
});
