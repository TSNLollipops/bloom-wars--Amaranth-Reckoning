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

  it("A, the top tier, draws one pip per step above G", () => {
    expect(tierPipCount("A")).toBe(Object.keys(TIERS).length - 1);
  });
});
