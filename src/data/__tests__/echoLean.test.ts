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
  effectiveEchoLean,
  emptyDrift,
  nudgeDrift,
  relaxDrift,
  dominantEcho,
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
