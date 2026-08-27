// Friction surfacing — first-slice unit tests, 27 Aug 2026. Pure module,
// no engine imports (src/data/** purity rule, Build Brief §5.2).
import { describe, it, expect, vi } from "vitest";
import { FRICTION_LINES, pickFrictionLine } from "../friction";

describe("pickFrictionLine", () => {
  it("always returns a line from the real bank", () => {
    for (let i = 0; i < 30; i++) {
      expect(FRICTION_LINES).toContain(pickFrictionLine());
    }
  });

  it("picks from more than one line across enough draws", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) seen.add(pickFrictionLine());
    expect(seen.size).toBeGreaterThan(1);
  });

  it("with Math.random pinned to 0, always returns the bank's first entry", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(pickFrictionLine()).toBe(FRICTION_LINES[0]);
    vi.restoreAllMocks();
  });

  it("the bank has real content, not an empty placeholder", () => {
    expect(FRICTION_LINES.length).toBeGreaterThanOrEqual(3);
    for (const line of FRICTION_LINES) expect(line.length).toBeGreaterThan(0);
  });
});
