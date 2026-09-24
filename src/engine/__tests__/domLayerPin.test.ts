// Demo verification pass, 24 Sep 2026 — see src/engine/domLayerPin.ts.
import { describe, expect, it } from "vitest";
import { layerOffsetFor, pinDomLayerToCanvas } from "../domLayerPin";

describe("layerOffsetFor", () => {
  it("is zero when the layer already sits on the canvas (the 1074x640 case)", () => {
    expect(layerOffsetFor({ left: 0, top: 0 }, { left: 0, top: 0 })).toEqual({ left: 0, top: 0 });
  });

  it("undoes the flex-centring offset measured on a 1920x1080 window", () => {
    // Measured on the built demo: canvas at (154.5, 60), and with left/top 0
    // the layer's corner lands at (423.5, 220), flex-centred at 1074x640.
    expect(layerOffsetFor({ left: 154.5, top: 60 }, { left: 423.5, top: 220 })).toEqual({ left: -269, top: -160 });
  });
});

describe("pinDomLayerToCanvas", () => {
  it("does nothing when either element is missing", () => {
    expect(() => pinDomLayerToCanvas(null, null)).not.toThrow();
    expect(() => pinDomLayerToCanvas(undefined, undefined)).not.toThrow();
  });

  it("sets left/top so the layer's corner lands on the canvas's corner", () => {
    const style: Record<string, string> = {};
    // Fake layer: with left/top 0 its corner is at (423.5, 220); moving it
    // shifts its rect by the same amount, like a real positioned element.
    const layer = {
      style,
      getBoundingClientRect: () => ({ left: 423.5 + parseFloat(style.left || "0"), top: 220 + parseFloat(style.top || "0") }),
    } as unknown as HTMLElement;
    const canvas = { getBoundingClientRect: () => ({ left: 154.5, top: 60 }) } as unknown as HTMLElement;
    pinDomLayerToCanvas(layer, canvas);
    expect(style.left).toBe("-269px");
    expect(style.top).toBe("-160px");
    expect(layer.getBoundingClientRect()).toEqual({ left: 154.5, top: 60 });
  });
});
