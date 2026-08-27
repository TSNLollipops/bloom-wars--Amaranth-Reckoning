// src/data/__tests__/reactionGate.test.ts
// Phase 3, piece one. Same statistical-check spirit as darts.test.ts's
// "run repeatedly" cases and holdem.test.ts's "many random deals" checks —
// gate0Reacts is deliberately probabilistic in its middle range, so these
// tests pin the exact chance function directly (deterministic) and confirm
// the coin-flip wrapper lands in the right neighborhood over many trials
// rather than asserting an exact count.
import { describe, it, expect } from "vitest";
import { gate0ReactionChance, gate0Reacts, GATE0_BASE_CHANCE, GATE0_DRUNK_BONUS, GATE0_PANIC_PENALTY, GATE0_WORRY_BONUS } from "../reactionGate";
import { STRESS_PANIC_THRESHOLD, type AmbientPilotState } from "../ambientLines";

function pilot(overrides: Partial<AmbientPilotState> = {}): AmbientPilotState {
  // stage defaults to "blooded" — see ambientLines.test.ts's own helper for
  // why. gate0Reacts never reads LINE_BANK/stage at all, but the field is
  // still required on the type.
  return { catalyst: "raven", stage: "blooded", stress: 30, morale: 70, drunk: false, ...overrides };
}

describe("gate0ReactionChance — exact values, no randomness", () => {
  it("returns the base chance for an ordinary, non-drunk, non-panicking pilot", () => {
    expect(gate0ReactionChance(pilot())).toBeCloseTo(GATE0_BASE_CHANCE);
  });

  it("adds the drunk bonus for a drunk pilot", () => {
    expect(gate0ReactionChance(pilot({ drunk: true }))).toBeCloseTo(GATE0_BASE_CHANCE + GATE0_DRUNK_BONUS);
  });

  it("subtracts the panic penalty at and above the Stress panic threshold", () => {
    expect(gate0ReactionChance(pilot({ stress: STRESS_PANIC_THRESHOLD }))).toBeCloseTo(GATE0_BASE_CHANCE - GATE0_PANIC_PENALTY);
    expect(gate0ReactionChance(pilot({ stress: STRESS_PANIC_THRESHOLD + 20 }))).toBeCloseTo(GATE0_BASE_CHANCE - GATE0_PANIC_PENALTY);
  });

  it("does not apply the panic penalty just below the threshold", () => {
    expect(gate0ReactionChance(pilot({ stress: STRESS_PANIC_THRESHOLD - 1 }))).toBeCloseTo(GATE0_BASE_CHANCE);
  });

  it("both drunk bonus and panic penalty can apply together, clamped to 0..1", () => {
    const chance = gate0ReactionChance(pilot({ drunk: true, stress: STRESS_PANIC_THRESHOLD }));
    expect(chance).toBeCloseTo(GATE0_BASE_CHANCE + GATE0_DRUNK_BONUS - GATE0_PANIC_PENALTY);
    expect(chance).toBeGreaterThanOrEqual(0);
    expect(chance).toBeLessThanOrEqual(1);
  });

  it("adds the worry bonus for a worried pilot — worry, Hub polish 26 Aug 2026", () => {
    expect(gate0ReactionChance(pilot({ worried: true }))).toBeCloseTo(GATE0_BASE_CHANCE + GATE0_WORRY_BONUS);
  });

  it("worried is a bonus (adds), the opposite direction from panic (subtracts), even though both read as fear", () => {
    const worried = gate0ReactionChance(pilot({ worried: true }));
    const panicking = gate0ReactionChance(pilot({ stress: STRESS_PANIC_THRESHOLD }));
    expect(worried).toBeGreaterThan(GATE0_BASE_CHANCE);
    expect(panicking).toBeLessThan(GATE0_BASE_CHANCE);
  });

  it("panic penalty still dominates when a pilot is both worried and panicking — stacked, not overridden", () => {
    const chance = gate0ReactionChance(pilot({ worried: true, stress: STRESS_PANIC_THRESHOLD }));
    expect(chance).toBeCloseTo(GATE0_BASE_CHANCE + GATE0_WORRY_BONUS - GATE0_PANIC_PENALTY);
    expect(chance).toBeLessThan(GATE0_BASE_CHANCE);
  });

  it("worried pilot who's not otherwise ordinary is not the same as an ordinary pilot", () => {
    expect(gate0ReactionChance(pilot({ worried: false }))).toBeCloseTo(GATE0_BASE_CHANCE);
  });
});

describe("gate0Reacts — statistical behavior over many trials", () => {
  it("an ordinary pilot reacts roughly GATE0_BASE_CHANCE of the time, not always and not never", () => {
    const trials = 2000;
    let reacted = 0;
    for (let i = 0; i < trials; i++) if (gate0Reacts(pilot())) reacted++;
    const rate = reacted / trials;
    expect(rate).toBeGreaterThan(GATE0_BASE_CHANCE - 0.08);
    expect(rate).toBeLessThan(GATE0_BASE_CHANCE + 0.08);
  });

  it("a panicking pilot reacts less often than an ordinary one, over many trials", () => {
    const trials = 2000;
    let ordinary = 0;
    let panicking = 0;
    for (let i = 0; i < trials; i++) {
      if (gate0Reacts(pilot())) ordinary++;
      if (gate0Reacts(pilot({ stress: 95 }))) panicking++;
    }
    expect(panicking).toBeLessThan(ordinary);
  });

  it("a drunk pilot reacts more often than an ordinary one, over many trials", () => {
    const trials = 2000;
    let ordinary = 0;
    let drunk = 0;
    for (let i = 0; i < trials; i++) {
      if (gate0Reacts(pilot())) ordinary++;
      if (gate0Reacts(pilot({ drunk: true }))) drunk++;
    }
    expect(drunk).toBeGreaterThan(ordinary);
  });

  it("a worried pilot reacts more often than an ordinary one, over many trials — worry, Hub polish 26 Aug 2026", () => {
    const trials = 2000;
    let ordinary = 0;
    let worried = 0;
    for (let i = 0; i < trials; i++) {
      if (gate0Reacts(pilot())) ordinary++;
      if (gate0Reacts(pilot({ worried: true }))) worried++;
    }
    expect(worried).toBeGreaterThan(ordinary);
  });

  it("never returns anything but a boolean", () => {
    for (let i = 0; i < 50; i++) expect(typeof gate0Reacts(pilot())).toBe("boolean");
  });
});
