import { describe, it, expect } from "vitest";
import { rangeLabel } from "../rangeLabel";

describe("rangeLabel", () => {
  it("melee reads as adjacent only", () => {
    expect(rangeLabel([1, 1])).toBe("range 1 (adjacent only)");
  });
  it("ranged with a minimum of 2 says it can't hit adjacent", () => {
    expect(rangeLabel([2, 4])).toBe("range 2-4 (can't hit adjacent)");
  });
  it("1-N reach has no dead zone", () => {
    expect(rangeLabel([1, 3])).toBe("range 1-3 tiles");
  });
  it("larger minimums say how far away the target must be", () => {
    expect(rangeLabel([3, 6])).toBe("range 3-6 (needs 3+ tiles away)");
  });
  it("zero reach can't attack", () => {
    expect(rangeLabel([0, 0])).toBe("can't attack");
  });
});
