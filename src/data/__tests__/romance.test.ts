// src/data/__tests__/romance.test.ts
// Phase 3, piece two. resolveAskOut is a pure decision table — every branch
// is exact and deterministic, so these are direct assertions, no
// statistical checks needed (unlike reactionGate.test.ts).
import { describe, it, expect } from "vitest";
import {
  resolveAskOut,
  isRomanceableSpecies,
  ROMANCE_MIN_FAVORABILITY,
  ROMANCE_ACCEPT_FAVORABILITY_DELTA,
  ROMANCE_REJECT_FAVORABILITY_DELTA,
} from "../romance";

describe("resolveAskOut — decision order and outcomes", () => {
  it("alreadyInRelationship wins over everything else, even a low favorability or non-romanceable flag", () => {
    expect(resolveAskOut({ favorability: -50, romanceable: false, alreadyInRelationship: true })).toEqual({
      result: "alreadyTogether",
      favorabilityDelta: 0,
    });
  });

  it("romanceable: false (the Hiopi/Carabil case) caps at close-friend regardless of favorability", () => {
    expect(resolveAskOut({ favorability: 999, romanceable: false, alreadyInRelationship: false })).toEqual({
      result: "closeFriendOnly",
      favorabilityDelta: 0,
    });
    expect(resolveAskOut({ favorability: -999, romanceable: false, alreadyInRelationship: false })).toEqual({
      result: "closeFriendOnly",
      favorabilityDelta: 0,
    });
  });

  it("accepts at and above the Favorability threshold", () => {
    expect(resolveAskOut({ favorability: ROMANCE_MIN_FAVORABILITY, romanceable: true, alreadyInRelationship: false })).toEqual({
      result: "accepted",
      favorabilityDelta: ROMANCE_ACCEPT_FAVORABILITY_DELTA,
    });
    expect(resolveAskOut({ favorability: ROMANCE_MIN_FAVORABILITY + 40, romanceable: true, alreadyInRelationship: false }).result).toBe(
      "accepted"
    );
  });

  it("rejects just below the threshold, and at very low favorability", () => {
    expect(resolveAskOut({ favorability: ROMANCE_MIN_FAVORABILITY - 1, romanceable: true, alreadyInRelationship: false })).toEqual({
      result: "rejected",
      favorabilityDelta: ROMANCE_REJECT_FAVORABILITY_DELTA,
    });
    expect(resolveAskOut({ favorability: -20, romanceable: true, alreadyInRelationship: false }).result).toBe("rejected");
  });

  it("accept delta is positive and reject delta is negative — sanity check on the placeholder numbers themselves", () => {
    expect(ROMANCE_ACCEPT_FAVORABILITY_DELTA).toBeGreaterThan(0);
    expect(ROMANCE_REJECT_FAVORABILITY_DELTA).toBeLessThan(0);
  });
});

// 26 Aug 2026 — added the same day a real instance of exactly this bug was
// caught and fixed: Hub.ts had hand-set romanceable: true for Iyari despite
// her being Hiopi (arch_meeps_centauroid) in the real roster data. These
// pin the actual species-gate function so a future regression fails a test
// instead of silently shipping.
describe("isRomanceableSpecies — the real species gate behind romanceable", () => {
  it("caps hiopi — the one species currently in the Species union that's excluded", () => {
    expect(isRomanceableSpecies("hiopi")).toBe(false);
  });

  it("leaves human and osnius open — human/Osnian romance is exactly what Ask Out already allows", () => {
    expect(isRomanceableSpecies("human")).toBe(true);
    expect(isRomanceableSpecies("osnius")).toBe(true);
  });
});
