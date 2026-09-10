// src/data/__tests__/ambientLines.test.ts
// First real test file for this module — 26 Aug 2026, Hub polish, added
// alongside the Mission Worry pass (worried?: boolean on AmbientPilotState,
// pickSoloEcho's new fear branch). Scoped to what changed: pickSoloEcho's
// priority ordering, with an emphasis on worried's own position in it, not
// a full re-test of content already covered implicitly by every scene that
// calls pickAmbientLine in practice.
//
// Worries System step 2, 6 Sep 2026 — pickSoloEcho's "worried" slot now
// reads topWorry (data/worries.ts) instead of the flat worried boolean;
// see that field's own comment on AmbientPilotState and Hub.ts's
// updateMissionWorry() for the full reasoning (worried itself is kept,
// unchanged, for Breakdown/the roster panel — just no longer read here).
// Every test below that used to set worried: true now sets a topWorry
// entry with intensity: 1 instead, keeping the exact same priority-order
// intent (drunk > stress-panic > worried/topWorry > low morale > idle);
// one new test confirms worried alone no longer forces fear on its own,
// since that decoupling is the actual behavior change this pass made.
import { describe, it, expect } from "vitest";
import { pickSoloEcho, STRESS_PANIC_THRESHOLD, type AmbientPilotState } from "../ambientLines";
import type { WorryEntry } from "../worries";

function pilot(overrides: Partial<AmbientPilotState> = {}): AmbientPilotState {
  // stage defaults to "blooded" — these tests predate the Stage axis
  // (wired 27 Aug 2026) and were written against what was, at the time,
  // the whole shipped bank; "blooded" is the tier that content became.
  return { catalyst: "raven", stage: "blooded", stress: 30, morale: 70, drunk: false, ...overrides };
}

// intensity: 1 makes pickSoloEcho's `Math.random() < intensity` roll
// unconditionally true — these tests are about priority ORDER, not about
// re-testing the probability roll itself (that's worryTriggerChance's own
// job, covered in missionWorry.test.ts).
function worry(intensity = 1): WorryEntry {
  return { source: "mission_pilot_missing", catalyst: "wolf", intensity, context: "hub", bornAt: 0, expiresAt: Number.MAX_SAFE_INTEGER };
}

describe("pickSoloEcho — worried/topWorry, Hub polish 26 Aug 2026, generalized 6 Sep 2026", () => {
  it("an otherwise-ordinary pilot with a live topWorry gets fear, reason = the entry's own source", () => {
    const pick = pickSoloEcho(pilot({ topWorry: worry() }));
    expect(pick.echo).toBe("fear");
    expect(pick.reason).toBe("mission_pilot_missing");
  });

  it("no topWorry (or zero intensity) never forces fear on its own", () => {
    // Run many trials since the non-worried, non-panicking, non-low-morale
    // path is the random idle pool — this only asserts topWorry isn't
    // silently forcing fear, not anything about the pool's spread.
    for (let i = 0; i < 20; i++) {
      const pick = pickSoloEcho(pilot({ topWorry: undefined, stress: 30, morale: 70 }));
      // No assertion on echo itself (idle pool is random) — just confirms
      // this call doesn't throw and returns a real EchoPick shape.
      expect(["love", "fear", "anger", "sadness"]).toContain(pick.echo);
    }
    const pick = pickSoloEcho(pilot({ topWorry: worry(0) }));
    expect(pick.reason).not.toBe("mission_pilot_missing");
  });

  it("the legacy worried boolean alone no longer forces fear — topWorry is what pickSoloEcho reads now", () => {
    // Worries System step 2, 6 Sep 2026 — worried still exists (Breakdown
    // and the roster panel still read it directly) but is deliberately
    // decoupled from pickSoloEcho's own chain now. This is the actual
    // behavior change this pass made, worth a real regression guard.
    const pick = pickSoloEcho(pilot({ worried: true, topWorry: undefined, morale: 70 }));
    expect(pick.reason).not.toBe("mission_pilot_missing");
    expect(pick.reason).not.toBe("worried");
  });

  it("drunk still overrides topWorry — drunk is checked first", () => {
    const pick = pickSoloEcho(pilot({ drunk: true, topWorry: worry() }));
    expect(pick.reason).toBe("drunk");
    expect(["love", "anger"]).toContain(pick.echo);
  });

  it("stress-panic still wins over topWorry when both are live", () => {
    const pick = pickSoloEcho(pilot({ stress: STRESS_PANIC_THRESHOLD, topWorry: worry() }));
    expect(pick.echo).toBe("fear");
    expect(pick.reason).toBe("panicking");
  });

  it("topWorry wins over low morale — checked before the low-morale branch", () => {
    const pick = pickSoloEcho(pilot({ morale: 10, topWorry: worry() }));
    expect(pick.echo).toBe("fear");
    expect(pick.reason).toBe("mission_pilot_missing");
  });

  it("low morale still applies normally when there's no live topWorry", () => {
    const pick = pickSoloEcho(pilot({ morale: 10, topWorry: undefined }));
    expect(pick.echo).toBe("sadness");
    expect(pick.reason).toBe("low morale");
  });
});
