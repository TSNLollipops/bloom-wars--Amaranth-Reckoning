// src/data/__tests__/ambientLines.test.ts
// First real test file for this module — 26 Aug 2026, Hub polish, added
// alongside the Mission Worry pass (worried?: boolean on AmbientPilotState,
// pickSoloEcho's new fear branch). Scoped to what changed: pickSoloEcho's
// priority ordering, with an emphasis on worried's own position in it, not
// a full re-test of content already covered implicitly by every scene that
// calls pickAmbientLine in practice.
import { describe, it, expect } from "vitest";
import { pickSoloEcho, STRESS_PANIC_THRESHOLD, type AmbientPilotState } from "../ambientLines";

function pilot(overrides: Partial<AmbientPilotState> = {}): AmbientPilotState {
  // stage defaults to "blooded" — these tests predate the Stage axis
  // (wired 27 Aug 2026) and were written against what was, at the time,
  // the whole shipped bank; "blooded" is the tier that content became.
  return { catalyst: "raven", stage: "blooded", stress: 30, morale: 70, drunk: false, ...overrides };
}

describe("pickSoloEcho — worried, Hub polish 26 Aug 2026", () => {
  it("an otherwise-ordinary worried pilot gets fear, reason worried", () => {
    const pick = pickSoloEcho(pilot({ worried: true }));
    expect(pick.echo).toBe("fear");
    expect(pick.reason).toBe("worried");
  });

  it("worried: false (or omitted) never forces fear on its own", () => {
    // Run many trials since the non-worried, non-panicking, non-low-morale
    // path is the random idle pool — this only asserts worried isn't
    // silently defaulting to true, not anything about the pool's spread.
    for (let i = 0; i < 20; i++) {
      const pick = pickSoloEcho(pilot({ worried: false, stress: 30, morale: 70 }));
      // No assertion on echo itself (idle pool is random) — just confirms
      // this call doesn't throw and returns a real EchoPick shape.
      expect(["love", "fear", "anger", "sadness"]).toContain(pick.echo);
    }
    const pick = pickSoloEcho(pilot());
    expect(pick.reason).not.toBe("worried");
  });

  it("drunk still overrides worried — drunk is checked first", () => {
    const pick = pickSoloEcho(pilot({ drunk: true, worried: true }));
    expect(pick.reason).toBe("drunk");
    expect(["love", "anger"]).toContain(pick.echo);
  });

  it("stress-panic still wins over worried when both are true", () => {
    const pick = pickSoloEcho(pilot({ stress: STRESS_PANIC_THRESHOLD, worried: true }));
    expect(pick.echo).toBe("fear");
    expect(pick.reason).toBe("panicking");
  });

  it("worried wins over low morale — checked before the low-morale branch", () => {
    const pick = pickSoloEcho(pilot({ morale: 10, worried: true }));
    expect(pick.echo).toBe("fear");
    expect(pick.reason).toBe("worried");
  });

  it("low morale still applies normally when not worried", () => {
    const pick = pickSoloEcho(pilot({ morale: 10, worried: false }));
    expect(pick.echo).toBe("sadness");
    expect(pick.reason).toBe("low morale");
  });
});
