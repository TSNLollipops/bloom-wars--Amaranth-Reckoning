// src/data/__tests__/npcBonds.test.ts
// Phase 3, piece three.
import { describe, it, expect } from "vitest";
import { pairKey, findClosestBond, findWorstRival, pointNear, pointAwayFrom } from "../npcBonds";

describe("pairKey", () => {
  it("is order-independent — the same pair keys the same regardless of argument order", () => {
    expect(pairKey("a", "b")).toBe(pairKey("b", "a"));
  });

  it("produces distinct keys for distinct pairs", () => {
    expect(pairKey("a", "b")).not.toBe(pairKey("a", "c"));
  });
});

describe("findClosestBond / findWorstRival", () => {
  const bonds: Record<string, number> = {
    [pairKey("bosk", "anand")]: 40,
    [pairKey("bosk", "iyari")]: 5,
    [pairKey("anand", "iyari")]: -25,
  };

  it("finds the highest-value bond among the given others", () => {
    expect(findClosestBond("bosk", ["anand", "iyari"], bonds)).toEqual({ otherId: "anand", value: 40 });
    expect(findClosestBond("anand", ["bosk", "iyari"], bonds)).toEqual({ otherId: "bosk", value: 40 });
  });

  it("finds the lowest-value bond among the given others", () => {
    expect(findWorstRival("anand", ["bosk", "iyari"], bonds)).toEqual({ otherId: "iyari", value: -25 });
    expect(findWorstRival("iyari", ["bosk", "anand"], bonds)).toEqual({ otherId: "anand", value: -25 });
  });

  it("excludes the pilot's own id from the candidate pool even if passed in by mistake", () => {
    expect(findClosestBond("bosk", ["bosk", "anand", "iyari"], bonds)).toEqual({ otherId: "anand", value: 40 });
  });

  it("returns null when there's nobody else to have a bond with", () => {
    expect(findClosestBond("bosk", [], bonds)).toBeNull();
    expect(findWorstRival("bosk", [], bonds)).toBeNull();
  });

  it("treats an unset pair as a neutral 0, not a crash or a missing-value error", () => {
    expect(findClosestBond("bosk", ["stranger"], bonds)).toEqual({ otherId: "stranger", value: 0 });
  });
});

describe("pointNear", () => {
  it("returns a point exactly `distance` away from the target", () => {
    const target = { x: 100, y: 100 };
    const p = pointNear(target, 50, () => 0); // rng=0 -> angle 0 -> straight along +x
    expect(p.x).toBeCloseTo(150);
    expect(p.y).toBeCloseTo(100);
    expect(Math.hypot(p.x - target.x, p.y - target.y)).toBeCloseTo(50);
  });

  it("varies with the injected rng, covering the full circle", () => {
    const target = { x: 0, y: 0 };
    const half = pointNear(target, 10, () => 0.5); // angle = pi
    expect(half.x).toBeCloseTo(-10);
    expect(half.y).toBeCloseTo(0, 5);
  });
});

describe("pointAwayFrom", () => {
  it("moves further along the existing self-to-avoid direction", () => {
    const self = { x: 10, y: 0 };
    const avoid = { x: 0, y: 0 };
    const p = pointAwayFrom(self, avoid, 5);
    expect(p.x).toBeCloseTo(15);
    expect(p.y).toBeCloseTo(0);
  });

  it("does not throw or produce NaN when self and avoid are the same point", () => {
    const p = pointAwayFrom({ x: 5, y: 5 }, { x: 5, y: 5 }, 10);
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
  });
});
