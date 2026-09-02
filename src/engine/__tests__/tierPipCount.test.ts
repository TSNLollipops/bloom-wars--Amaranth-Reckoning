// Regression coverage for the 23 Aug 2026 black-screen bug: scenes/Battle.ts
// imported tierPipCount from data/combatTables.ts, but the function was
// never actually written there — a missing named export throws a
// SyntaxError at module load, before any test or the app itself can even
// start. Pure logic check here; the actual render call site is
// scenes/Battle.ts's gear-tier pips block (GDD §12).
import { describe, it, expect } from "vitest";
import { tierPipCount, TIERS } from "../../data/combatTables";

describe("tierPipCount", () => {
  it("G (the baseline tier) draws zero pips", () => {
    expect(tierPipCount("G")).toBe(0);
  });

  it("each tier above G adds exactly one pip, in TIERS' own order", () => {
    const order = Object.keys(TIERS);
    order.forEach((tier, idx) => {
      expect(tierPipCount(tier as keyof typeof TIERS)).toBe(idx);
    });
  });

  // Rewritten 2 Sep 2026, when S (Heirloom-grade) was added to TIERS. This
  // test used to read "A, the top tier, draws one pip per step above G"
  // and assert `length - 1` — both halves of which stopped being true the
  // moment a rung was added above A. It failed honestly rather than
  // silently, which is the whole reason it was worth having; the fix is to
  // restate what it was actually protecting (the top of the table, whatever
  // that is, gets the most pips) rather than to pin "A" harder.
  it("the top tier in TIERS draws one pip per step above G", () => {
    const order = Object.keys(TIERS);
    const top = order[order.length - 1] as keyof typeof TIERS;
    expect(top).toBe("S");
    expect(tierPipCount(top)).toBe(order.length - 1);
  });

  it("S draws more pips than A — the Heirloom rung is visibly above the buyable ceiling", () => {
    expect(tierPipCount("S")).toBe(tierPipCount("A") + 1);
  });
});
