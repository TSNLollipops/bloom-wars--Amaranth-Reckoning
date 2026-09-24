// src/engine/domLayerPin.ts
//
// Demo verification pass, 24 Sep 2026. Every Phaser DOM element in the game
// (the Battle COMMS talk box, the Hub chat box, the company-name field, the
// Notes and copy-text panels, the character creator's name field) lives in
// one layer: the <div> Phaser makes for `dom: { createContainer: true }`.
// Phaser scales that layer with a CSS `transform: scale(...)` from its top-
// left corner and assumes the layer's top-left already sits on the canvas's
// top-left. In this project it doesn't. index.html centres the canvas with
// flexbox on #app (Screen Resolution Plan v1, 2 Sep 2026), and flexbox also
// centres the absolutely-positioned layer, but at its unscaled 1074x640 size.
// The scale then grows it out from that wrong corner.
//
// At exactly 1074x640 the two corners coincide and nothing shows, which is
// why it went unnoticed. At any other size every text box drifts right and
// down in proportion to the scale. Measured on the built demo before this
// fix: at a 1920x1080 window (canvas 1611x960, the 150% default) the Battle
// talk box opened at x=1688, y=1079, off the bottom-right edge of the
// screen, and the company-name field sat on top of the Ironman text.
//
// The fix pins the layer to wherever the canvas actually is, measured, not
// computed from CSS rules, so it stays right whatever centres the canvas.
// Phaser-free for the same reason displayScale.ts is: unit-testable in plain
// Node, DOM access guarded.

export interface RectLike {
  left: number;
  top: number;
}

/**
 * Where the layer's `left`/`top` have to be for its top-left corner to land
 * on the canvas's top-left, given where the layer sits with left/top = 0.
 * Pure. The layer's CSS transform-origin is its top-left, so scaling never
 * moves that corner and the answer doesn't depend on the scale.
 */
export function layerOffsetFor(canvas: RectLike, layerAtZero: RectLike): { left: number; top: number } {
  return { left: canvas.left - layerAtZero.left, top: canvas.top - layerAtZero.top };
}

/**
 * Moves Phaser's DOM-element layer onto the canvas. Safe to call any number
 * of times, and a no-op if either element is missing (no DOM layer
 * configured, or not in a browser).
 */
export function pinDomLayerToCanvas(layer: HTMLElement | null | undefined, canvas: HTMLElement | null | undefined): void {
  if (!layer || !canvas) return;
  layer.style.left = "0px";
  layer.style.top = "0px";
  const off = layerOffsetFor(canvas.getBoundingClientRect(), layer.getBoundingClientRect());
  layer.style.left = `${off.left}px`;
  layer.style.top = `${off.top}px`;
}
