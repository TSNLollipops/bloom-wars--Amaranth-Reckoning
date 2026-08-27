import { describe, it, expect } from "vitest";
import { clampToEllipse } from "../hubGeometry";

// The egg hull, 27 Aug 2026 — Hub.ts's grotto-deck floor uses this to keep
// player/NPC movement inside a real ellipse instead of a rectangle. Tests
// live here (not a Hub.ts test) because hubGeometry.ts is the one piece of
// this pass that doesn't need Phaser to exercise directly — see its own
// header.
describe("clampToEllipse — the grotto deck's real oval floor, 27 Aug 2026", () => {
  const cx = 435;
  const cy = 333;
  const rx = 395;
  const ry = 233;
  const inset = 16; // NPC_R in Hub.ts

  it("leaves a point already inside the (inset) ellipse untouched", () => {
    const result = clampToEllipse(cx, cy, cx, cy, rx, ry, inset);
    expect(result).toEqual({ x: cx, y: cy });
  });

  it("leaves a point well inside the ellipse untouched, off-center", () => {
    const point = { x: cx + 50, y: cy - 40 };
    const result = clampToEllipse(point.x, point.y, cx, cy, rx, ry, inset);
    expect(result).toEqual(point);
  });

  it("pulls a point outside the ellipse back onto its boundary along the x axis", () => {
    const result = clampToEllipse(cx + 10_000, cy, cx, cy, rx, ry, inset);
    expect(result.y).toBeCloseTo(cy, 6);
    expect(result.x).toBeCloseTo(cx + (rx - inset), 6);
  });

  it("pulls a point outside the ellipse back onto its boundary along the y axis", () => {
    const result = clampToEllipse(cx, cy - 10_000, cx, cy, rx, ry, inset);
    expect(result.x).toBeCloseTo(cx, 6);
    expect(result.y).toBeCloseTo(cy - (ry - inset), 6);
  });

  it("pulls a diagonally-outside point back onto the ellipse boundary, not just the bounding rect", () => {
    // A point outside the ellipse but still inside its bounding rectangle —
    // exactly the case that made a naive same-size ellipse swap unsafe for
    // Hub.ts's already-tiled Upper/Lower rooms (a rect corner is always
    // outside its inscribed ellipse). Confirms the fix is real: the
    // returned point sits ON the ellipse, not merely inside the rectangle.
    const erx = rx - inset;
    const ery = ry - inset;
    const point = { x: cx + erx, y: cy + ery }; // rect corner of the inset ellipse's own bounding box
    const before = ((point.x - cx) / erx) ** 2 + ((point.y - cy) / ery) ** 2;
    expect(before).toBeGreaterThan(1); // confirms the corner really is outside

    const result = clampToEllipse(point.x, point.y, cx, cy, rx, ry, inset);
    const after = ((result.x - cx) / erx) ** 2 + ((result.y - cy) / ery) ** 2;
    expect(after).toBeCloseTo(1, 6);
  });

  it("keeps every one of Hub.ts's real grotto door coordinates inside the ellipse (regression guard)", () => {
    // Hub.ts's DOORS array places the grotto's two stair triggers/landings
    // at these four fixed points. If GROTTO_ELLIPSE ever shrinks enough to
    // swallow one of these, a stair becomes unreachable — this test is the
    // tripwire for that, independent of ever running the actual scene.
    const grottoPoints = [
      { x: 480, y: 470 }, // recroom-to-grotto landing
      { x: 480, y: 530 }, // grotto-to-recroom trigger
      { x: 480, y: 130 }, // grotto-to-workshop trigger
      { x: 480, y: 300 }, // workshop-to-grotto landing
    ];
    for (const p of grottoPoints) {
      const result = clampToEllipse(p.x, p.y, cx, cy, rx, ry, 0);
      expect(result).toEqual(p); // unchanged means it was already inside
    }
  });

  it("treats a negative or zero radius input as a 1px floor rather than dividing by zero", () => {
    // inset >= rx (or ry) would make erx/ery <= 0 without the Math.max(1, ...)
    // floor — this confirms that floor holds and the function still returns
    // finite numbers instead of NaN/Infinity.
    const result = clampToEllipse(10_000, 10_000, 0, 0, 5, 5, 10);
    expect(Number.isFinite(result.x)).toBe(true);
    expect(Number.isFinite(result.y)).toBe(true);
  });
});
