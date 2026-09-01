// Regression coverage for the Off-Duty Needs Counter's pure logic
// (needsCounter.ts) — see that file's own header for the spec this was
// built from (Bloom_Wars_Needs_Counter_Spec_v1, 28 Aug 2026). Hub.ts's own
// wiring (the real-minute tick loop, room-presence checks, roaming/
// ambient-line call sites) isn't unit-testable the way this file's plain
// functions are — same split every other Hub-adjacent data/ file in this
// project keeps (toxicPairs.ts, missionWorry.ts, reactionGate.ts, etc.),
// verified instead by tsc/eslint/build plus manual/Playwright checks on
// the scene itself.
import { describe, it, expect } from "vitest";
import {
  clampNeed,
  tickNeed,
  needsStressMoraleDelta,
  worstNeed,
  NEED_ROOM,
  NEEDS_FLAVOR_BANK,
  NEEDS_LOW_THRESHOLD,
  NEEDS_DECAY_PER_MIN,
  NEEDS_RESTORE_PER_MIN,
  NEEDS_STRESS_MORALE_TICK_CAP,
  type NeedKind,
} from "../needsCounter";

describe("clampNeed", () => {
  it("holds to [0, 100] in both directions", () => {
    expect(clampNeed(150)).toBe(100);
    expect(clampNeed(-20)).toBe(0);
    expect(clampNeed(47)).toBe(47);
  });
});

describe("tickNeed", () => {
  it("decays by NEEDS_DECAY_PER_MIN when not in the restore room", () => {
    expect(tickNeed(50, false)).toBe(50 - NEEDS_DECAY_PER_MIN);
  });

  it("nets a restore bonus on top of decay when in the restore room (additive, not a decay override)", () => {
    expect(tickNeed(50, true)).toBe(50 - NEEDS_DECAY_PER_MIN + NEEDS_RESTORE_PER_MIN);
  });

  it("clamps at the floor and ceiling either way", () => {
    expect(tickNeed(0, false)).toBe(0);
    expect(tickNeed(99, true)).toBe(100);
  });
});

describe("needsStressMoraleDelta", () => {
  it("is a no-op when every meter is at or above the threshold", () => {
    expect(needsStressMoraleDelta(100, 50, NEEDS_LOW_THRESHOLD)).toEqual({ stressDelta: 0, moraleDelta: 0 });
  });

  it("ticks +1 Stress / -1 Morale per low meter", () => {
    expect(needsStressMoraleDelta(10, 100, 100)).toEqual({ stressDelta: 1, moraleDelta: -1 });
    expect(needsStressMoraleDelta(10, 10, 100)).toEqual({ stressDelta: 2, moraleDelta: -2 });
  });

  it("all three low lands exactly at the documented cap (-3 Stress-relief... +3 Morale-loss ceiling), not beyond it", () => {
    expect(needsStressMoraleDelta(0, 0, 0)).toEqual({ stressDelta: 3, moraleDelta: -3 });
    expect(needsStressMoraleDelta(0, 0, 0).stressDelta).toBeLessThanOrEqual(NEEDS_STRESS_MORALE_TICK_CAP);
  });

  it("a meter exactly AT the threshold does not count as low (strictly below only)", () => {
    expect(needsStressMoraleDelta(NEEDS_LOW_THRESHOLD, 100, 100)).toEqual({ stressDelta: 0, moraleDelta: 0 });
    expect(needsStressMoraleDelta(NEEDS_LOW_THRESHOLD - 1, 100, 100)).toEqual({ stressDelta: 1, moraleDelta: -1 });
  });
});

describe("worstNeed", () => {
  it("returns undefined when nothing is below threshold", () => {
    expect(worstNeed(100, 100, 100)).toBeUndefined();
    expect(worstNeed(NEEDS_LOW_THRESHOLD, NEEDS_LOW_THRESHOLD, NEEDS_LOW_THRESHOLD)).toBeUndefined();
  });

  it("picks the single meter that's low", () => {
    expect(worstNeed(10, 100, 100)).toBe("hunger");
    expect(worstNeed(100, 10, 100)).toBe("thirst");
    expect(worstNeed(100, 100, 10)).toBe("sleep");
  });

  it("picks whichever low meter is furthest below the threshold", () => {
    expect(worstNeed(25, 5, 100)).toBe("thirst");
    expect(worstNeed(5, 25, 100)).toBe("hunger");
  });

  it("every NeedKind round-trips through NEED_ROOM to a real room", () => {
    const kinds: NeedKind[] = ["hunger", "thirst", "sleep", "boredom"];
    for (const k of kinds) expect(["berths", "recroom", "sparRoom"]).toContain(NEED_ROOM[k]);
    expect(NEED_ROOM.sleep).toBe("berths");
    expect(NEED_ROOM.hunger).toBe("recroom");
    expect(NEED_ROOM.thirst).toBe("recroom");
    expect(NEED_ROOM.boredom).toBe("sparRoom");
  });
});

describe("worstNeed — boredom (30 Aug 2026, Maxime: \"boredom should trigger spar\")", () => {
  it("omitted boredom (the Mek homeRoom / pickNeedsFlavorLine call shape) behaves exactly as the original 3-argument function — never a candidate", () => {
    expect(worstNeed(100, 100, 100)).toBeUndefined();
    expect(worstNeed(10, 100, 100)).toBe("hunger");
  });

  it("a low boredom alongside three fine meters is picked, same as any other low meter", () => {
    expect(worstNeed(100, 100, 100, 10)).toBe("boredom");
  });

  it("boredom competes on magnitude with the other three, not picked just because it's passed", () => {
    expect(worstNeed(5, 100, 100, 50)).toBe("hunger"); // hunger lower than boredom
    expect(worstNeed(50, 100, 100, 5)).toBe("boredom"); // boredom lower than hunger
  });

  it("boredom at/above threshold is not a candidate, same strict-below rule as the other three", () => {
    expect(worstNeed(100, 100, 100, NEEDS_LOW_THRESHOLD)).toBeUndefined();
  });
});

describe("NEEDS_FLAVOR_BANK", () => {
  it("has exactly two lines per need, and a valid echo tag", () => {
    // boredom (30 Aug 2026) deliberately uses "anger", not fear/sadness like
    // the original three — see its own entry's comment (needsCounter.ts):
    // restless/pent-up energy, not the low-energy register the other three
    // read as.
    const kinds: NeedKind[] = ["hunger", "thirst", "sleep", "boredom"];
    for (const k of kinds) {
      const entry = NEEDS_FLAVOR_BANK[k];
      expect(entry.lines).toHaveLength(2);
      expect(["fear", "sadness", "anger"]).toContain(entry.echo);
      for (const line of entry.lines) {
        expect(line.length).toBeGreaterThan(0);
      }
    }
    expect(NEEDS_FLAVOR_BANK.boredom.echo).toBe("anger");
  });
});
