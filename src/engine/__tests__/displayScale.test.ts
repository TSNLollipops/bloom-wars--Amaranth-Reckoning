import { describe, expect, it } from "vitest";
import {
  applyDisplayScale,
  capFor,
  DEFAULT_DISPLAY_SCALE,
  DISPLAY_SCALE_OPTIONS,
  GAME_HEIGHT,
  GAME_WIDTH,
  getDisplayScaleOption,
  getStoredDisplayScaleId,
  setStoredDisplayScaleId,
} from "../displayScale";

describe("displayScale", () => {
  describe("getDisplayScaleOption", () => {
    it("returns the matching option for a known id", () => {
      expect(getDisplayScaleOption("125").id).toBe("125");
      expect(getDisplayScaleOption("fill").id).toBe("fill");
    });

    it("falls back to the default option for an unknown, null, or undefined id", () => {
      expect(getDisplayScaleOption("not-a-real-option").id).toBe(DEFAULT_DISPLAY_SCALE);
      expect(getDisplayScaleOption(null).id).toBe(DEFAULT_DISPLAY_SCALE);
      expect(getDisplayScaleOption(undefined).id).toBe(DEFAULT_DISPLAY_SCALE);
    });

    it("every listed option is reachable by its own id", () => {
      for (const option of DISPLAY_SCALE_OPTIONS) {
        expect(getDisplayScaleOption(option.id).id).toBe(option.id);
      }
    });
  });

  describe("capFor", () => {
    it("scales the base 1074x640 canvas by the option's multiplier", () => {
      expect(capFor(getDisplayScaleOption("100"))).toEqual({ maxWidthPx: GAME_WIDTH, maxHeightPx: GAME_HEIGHT });
      expect(capFor(getDisplayScaleOption("150"))).toEqual({ maxWidthPx: Math.round(GAME_WIDTH * 1.5), maxHeightPx: Math.round(GAME_HEIGHT * 1.5) });
    });

    it("125% and 175% round to whole CSS pixels", () => {
      const cap125 = capFor(getDisplayScaleOption("125"));
      const cap175 = capFor(getDisplayScaleOption("175"));
      expect(Number.isInteger(cap125.maxWidthPx)).toBe(true);
      expect(Number.isInteger(cap125.maxHeightPx)).toBe(true);
      expect(Number.isInteger(cap175.maxWidthPx)).toBe(true);
      expect(Number.isInteger(cap175.maxHeightPx)).toBe(true);
    });

    it("every capped option keeps the base canvas's own aspect ratio", () => {
      const baseAspect = GAME_WIDTH / GAME_HEIGHT;
      for (const option of DISPLAY_SCALE_OPTIONS) {
        const cap = capFor(option);
        if (cap.maxWidthPx === null || cap.maxHeightPx === null) continue; // "fill" — no cap, nothing to check
        expect(cap.maxWidthPx / cap.maxHeightPx).toBeCloseTo(baseAspect, 2);
      }
    });

    it("\"fill\" has no cap at all — the old, uncapped FIT behavior", () => {
      expect(capFor(getDisplayScaleOption("fill"))).toEqual({ maxWidthPx: null, maxHeightPx: null });
    });

    it("caps grow monotonically from 100% to 175%", () => {
      const widths = ["100", "125", "150", "175"].map((id) => capFor(getDisplayScaleOption(id)).maxWidthPx!);
      for (let i = 1; i < widths.length; i++) {
        expect(widths[i]).toBeGreaterThan(widths[i - 1]);
      }
    });
  });

  // vitest's default environment here is plain Node (no jsdom configured —
  // see vite.config.ts) — the same reason hubGeometry.ts's own module has no
  // Phaser import. `document`/`localStorage` are genuinely undefined in this
  // test run, so these three checks are a real regression test for the
  // module's DOM guards, not a formality: a missing `typeof === "undefined"`
  // check here would throw and fail the whole suite immediately.
  describe("DOM-guarded calls are safe with no document/localStorage present", () => {
    it("getStoredDisplayScaleId falls back to the default without a real localStorage", () => {
      expect(getStoredDisplayScaleId()).toBe(DEFAULT_DISPLAY_SCALE);
    });

    it("setStoredDisplayScaleId does not throw without a real localStorage", () => {
      expect(() => setStoredDisplayScaleId("175")).not.toThrow();
    });

    it("applyDisplayScale does not throw without a real document", () => {
      expect(() => applyDisplayScale("fill")).not.toThrow();
    });
  });
});
