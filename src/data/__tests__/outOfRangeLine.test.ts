import { describe, it, expect } from "vitest";
import { outOfRangeLine } from "../outOfRangeLine";

describe("outOfRangeLine (E8)", () => {
  const artillery = { attackRange: [2, 4] as [number, number], actionsRemaining: 2 };
  it("says too close under min range", () => {
    expect(outOfRangeLine(artillery, 1)).toBe("Too close to fire (range 2-4, target is 1 away).");
  });
  it("says out of range past max range", () => {
    expect(outOfRangeLine(artillery, 6)).toContain("Out of range (range 2-4");
  });
  it("collapses a single-value range", () => {
    expect(outOfRangeLine({ attackRange: [1, 1], actionsRemaining: 2 }, 3)).toContain("(range 1,");
  });
  it("in range but no actions", () => {
    expect(outOfRangeLine({ ...artillery, actionsRemaining: 0 }, 3)).toBe("No actions left this turn.");
  });
});
