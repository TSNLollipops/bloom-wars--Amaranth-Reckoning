// Cursor-following hover tip placement (2 Sep 2026). The reason this math
// lives outside the scene at all — see hoverTipLayout.ts's own header — is
// so these edge cases can be asserted rather than eyeballed in a browser.
// The canvas here is this game's real 960x600.
import { describe, it, expect } from "vitest";
import {
  layoutHoverTip,
  measureTipBox,
  wrapTipText,
  DEFAULT_TIP_OFFSET,
  DEFAULT_TIP_MARGIN,
} from "../hoverTipLayout";

const W = 960;
const H = 600;

describe("layoutHoverTip", () => {
  it("prefers down-and-right of the pointer when there's room", () => {
    const tip = layoutHoverTip(100, 100, 200, 80, W, H);
    expect(tip.x).toBe(100 + DEFAULT_TIP_OFFSET);
    expect(tip.y).toBe(100 + DEFAULT_TIP_OFFSET);
  });

  it("flips to the left of the pointer when the right edge would overflow", () => {
    const tip = layoutHoverTip(900, 100, 200, 80, W, H);
    expect(tip.x).toBe(900 - DEFAULT_TIP_OFFSET - 200);
    // Vertical axis had room, so it must NOT have flipped too.
    expect(tip.y).toBe(100 + DEFAULT_TIP_OFFSET);
  });

  it("flips above the pointer when the bottom edge would overflow", () => {
    const tip = layoutHoverTip(100, 570, 200, 80, W, H);
    expect(tip.y).toBe(570 - DEFAULT_TIP_OFFSET - 80);
    expect(tip.x).toBe(100 + DEFAULT_TIP_OFFSET);
  });

  it("flips both axes independently in the bottom-right corner", () => {
    const tip = layoutHoverTip(940, 590, 200, 80, W, H);
    expect(tip.x).toBe(940 - DEFAULT_TIP_OFFSET - 200);
    expect(tip.y).toBe(590 - DEFAULT_TIP_OFFSET - 80);
  });

  it("never places the tip outside the canvas margins, wherever the pointer is", () => {
    // Sweep the whole canvas including all four corners and both edges.
    for (let px = 0; px <= W; px += 20) {
      for (let py = 0; py <= H; py += 20) {
        const tip = layoutHoverTip(px, py, 220, 120, W, H);
        expect(tip.x).toBeGreaterThanOrEqual(DEFAULT_TIP_MARGIN);
        expect(tip.y).toBeGreaterThanOrEqual(DEFAULT_TIP_MARGIN);
        expect(tip.x + 220).toBeLessThanOrEqual(W - DEFAULT_TIP_MARGIN);
        expect(tip.y + 120).toBeLessThanOrEqual(H - DEFAULT_TIP_MARGIN);
      }
    }
  });

  it("pins to the top-left margin rather than going negative when the tip is bigger than the canvas", () => {
    const tip = layoutHoverTip(480, 300, W + 200, H + 200, W, H);
    expect(tip.x).toBe(DEFAULT_TIP_MARGIN);
    expect(tip.y).toBe(DEFAULT_TIP_MARGIN);
  });

  it("honours custom offset and margin", () => {
    const tip = layoutHoverTip(100, 100, 50, 50, W, H, { offset: 40, margin: 2 });
    expect(tip.x).toBe(140);
    expect(tip.y).toBe(140);
    const corner = layoutHoverTip(0, 0, 50, 50, W, H, { offset: 0, margin: 25 });
    expect(corner.x).toBe(25);
    expect(corner.y).toBe(25);
  });

  it("a tip too tall to fit either side of a mid-canvas pointer still lands inside the canvas", () => {
    // 560 tall on a 600 canvas: no room below (300+16+560 > 600) and none
    // above (300-16-560 < 0). The clamp is the only thing keeping this on
    // screen at all.
    const tip = layoutHoverTip(480, 300, 200, 560, W, H);
    expect(tip.y).toBeGreaterThanOrEqual(DEFAULT_TIP_MARGIN);
    expect(tip.y + 560).toBeLessThanOrEqual(H - DEFAULT_TIP_MARGIN);
  });
});

describe("wrapTipText", () => {
  it("never exceeds the width when every word fits", () => {
    const lines = wrapTipText("the quick brown fox jumps over the lazy dog", 12);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(12);
    expect(lines.join(" ")).toBe("the quick brown fox jumps over the lazy dog");
  });

  it("keeps a single over-long word intact rather than breaking mid-word", () => {
    const lines = wrapTipText("supercalifragilistic ok", 8);
    expect(lines[0]).toBe("supercalifragilistic");
    expect(lines[1]).toBe("ok");
  });

  it("collapses runs of whitespace and never emits a blank line", () => {
    const lines = wrapTipText("  a   b \n c  ", 40);
    expect(lines).toEqual(["a b c"]);
  });

  it("returns a single empty line for empty input rather than an empty array", () => {
    // measureTipBox treats [] as a zero box and the tip skips drawing —
    // an empty string should still render as one (blank) line, not vanish.
    expect(wrapTipText("", 20)).toEqual([""]);
  });

  it("degrades to the whole string when maxChars is nonsense", () => {
    expect(wrapTipText("a b c", 0)).toEqual(["a b c"]);
    expect(wrapTipText("a b c", -5)).toEqual(["a b c"]);
  });
});

describe("measureTipBox", () => {
  it("returns a zero box for no lines, so a caller can skip drawing entirely", () => {
    expect(measureTipBox([], 7, 14, 6)).toEqual({ w: 0, h: 0 });
  });

  it("sizes to the longest line, not the last or the first", () => {
    const box = measureTipBox(["ab", "abcdefgh", "abc"], 10, 20, 5);
    expect(box.w).toBe(8 * 10 + 5 * 2);
    expect(box.h).toBe(3 * 20 + 5 * 2);
  });

  it("measures a wrapped block at the wrap width, not the original string length", () => {
    const long = "Gear, loadout upgrades, carrier modules — still in the Campaign Shop.";
    const wrapped = wrapTipText(long, 30);
    const box = measureTipBox(wrapped, 7, 14, 5);
    expect(box.w).toBeLessThanOrEqual(30 * 7 + 5 * 2);
  });

  it("counts blank lines as real height, since they're spacers in the tip content", () => {
    const withBlank = measureTipBox(["aaa", "", "bbb"], 7, 14, 4);
    const without = measureTipBox(["aaa", "bbb"], 7, 14, 4);
    expect(withBlank.h).toBe(without.h + 14);
    expect(withBlank.w).toBe(without.w);
  });
});
