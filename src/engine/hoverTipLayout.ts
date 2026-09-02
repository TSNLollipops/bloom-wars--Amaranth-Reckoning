// Cursor-following hover tip — placement math, 2 Sep 2026.
// Maxime: "add a small popup window next to the mouse giving you basic
// info on what you mouse over."
//
// Phaser-free on purpose, exactly like engine/hubGeometry.ts and for the
// same reason: every scene file in this repo imports "phaser" at module
// scope, which throws outside a real browser, so anything that lives in a
// scene can't be unit-tested at all. Tip placement is a pile of
// off-by-one-able edge cases (four corners, two flip axes, a box wider
// than the screen) — precisely the kind of thing this project's own
// standing rule says deserves a real test rather than a browser
// eyeball-check. The Phaser drawing half stays in scenes/ui/HoverTip.ts;
// this file is only ever asked "given a pointer and a box, where does the
// box go."

export interface TipBox {
  x: number;
  y: number;
}

export interface TipLayoutOptions {
  /** Gap between the pointer and the nearest edge of the tip. */
  offset?: number;
  /** Minimum gap between the tip and any screen edge. */
  margin?: number;
}

export const DEFAULT_TIP_OFFSET = 16;
export const DEFAULT_TIP_MARGIN = 6;

/**
 * Top-left corner for a tip of `tipW`×`tipH` shown next to a pointer at
 * (`pointerX`, `pointerY`) on a `screenW`×`screenH` canvas.
 *
 * Default placement is down-and-right of the cursor, which is what every
 * desktop tooltip does and therefore what a player's eye already expects.
 * Each axis flips to the opposite side independently when the preferred
 * side would run off the screen — flipping only the offending axis is why
 * a tip in the bottom-right corner ends up up-and-left rather than
 * jumping somewhere unrelated.
 *
 * The clamp after the flips is a real fallback, not belt-and-braces: a tip
 * taller than the space above AND below the cursor (a long inspect card
 * near the vertical middle of a short canvas) overflows whichever way it
 * flips, and clamping to the margin is the only sane answer left. A tip
 * larger than the screen itself pins to the top-left margin — the caller
 * is expected to have capped its own height before that happens, but this
 * never returns a negative coordinate regardless.
 */
export function layoutHoverTip(
  pointerX: number,
  pointerY: number,
  tipW: number,
  tipH: number,
  screenW: number,
  screenH: number,
  options: TipLayoutOptions = {},
): TipBox {
  const offset = options.offset ?? DEFAULT_TIP_OFFSET;
  const margin = options.margin ?? DEFAULT_TIP_MARGIN;

  // Preferred side: down-and-right.
  let x = pointerX + offset;
  let y = pointerY + offset;

  // Flip horizontally if the right edge would leave the canvas.
  if (x + tipW + margin > screenW) x = pointerX - offset - tipW;
  // Flip vertically if the bottom edge would leave the canvas.
  if (y + tipH + margin > screenH) y = pointerY - offset - tipH;

  // Clamp whatever's left. max() last so a box bigger than the canvas
  // pins to the top-left margin instead of going negative.
  x = Math.max(margin, Math.min(x, screenW - tipW - margin));
  y = Math.max(margin, Math.min(y, screenH - tipH - margin));

  return { x, y };
}

/**
 * Greedy word-wrap to `maxChars` per line.
 *
 * Phaser's own `wordWrap` would do this at draw time, but the tip has to
 * know its own width BEFORE it's drawn (measureTipBox below feeds
 * layoutHoverTip, which decides which side of the cursor the box goes on) —
 * a box that wraps after being measured would be positioned against the
 * wrong size. So the wrap happens here, in the same units the measurement
 * uses.
 *
 * A single word longer than `maxChars` is left over-long on its own line
 * rather than hyphenated mid-word: the tip's callers feed it pilot names
 * and room titles, where a hard break mid-name reads as a rendering bug.
 * That line then sets the box width, which is the honest outcome.
 */
export function wrapTipText(text: string, maxChars: number): string[] {
  if (maxChars <= 0) return [text];
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line === "") {
      line = word;
    } else if (line.length + 1 + word.length <= maxChars) {
      line += ` ${word}`;
    } else {
      out.push(line);
      line = word;
    }
  }
  if (line !== "") out.push(line);
  return out.length ? out : [""];
}

/**
 * Pixel size of a monospace tip box for `lines`, given a per-character
 * advance and a line height.
 *
 * Monospace is the only font this game uses (every `add.text` call in the
 * repo passes `fontFamily: "monospace"`), so width is just the longest
 * line — no font metrics, no measuring pass, no Phaser. `padding` is
 * applied on all four sides.
 */
export function measureTipBox(
  lines: string[],
  charW: number,
  lineH: number,
  padding: number,
): { w: number; h: number } {
  if (lines.length === 0) return { w: 0, h: 0 };
  const longest = lines.reduce((max, l) => Math.max(max, l.length), 0);
  return {
    w: longest * charW + padding * 2,
    h: lines.length * lineH + padding * 2,
  };
}
