// src/engine/battleLayout.ts
//
// The Battle scene's layout, as pure math — Mission Chat, Player Notes and
// Battle HUD Relayout Plan v1, Workstream 2, 12 Sep 2026. Phaser-free on
// purpose, exactly like engine/hubGeometry.ts and engine/hoverTipLayout.ts
// and for the same reason: every scene file imports "phaser" at module
// scope, which throws outside a browser, so anything living in Battle.ts
// can't be unit-tested. This file is only ever asked "given the canvas,
// the map, and which side columns are open, where does everything go."
//
// The problem it solves. The canvas is a fixed 1074x640 logical space
// (src/main.ts) and Battle.ts placed every panel at hand-typed absolute
// coordinates. The layout is zero-sum: there is no "space available" for
// a chat column to fill — every pixel it gets comes out of the board or
// another panel, and a hand-edited relayout of a 230KB scene file produces
// collisions that only show up in a screenshot. So the rects live here,
// once, with a test suite that loops over every real map in the game
// (battleLayout.test.ts) rather than a hand-picked worst case.
//
// The arrangement, per the plan's §4a:
//
//   +----------------------------------------------------------------+
//   | left column     |          board viewport          | right col |
//   | (selected unit  |                                  | (comms:   |
//   |  OR briefing,   |                                  |  chat log |
//   |  mission log,   |                                  |  + input) |
//   |  action bar,    |                                  |           |
//   |  END TURN)      |                                  |           |
//   +----------------------------------------------------------------+
//
// Widths. The left column is 230px, not the plan's illustrative 160 —
// flagged as a deliberate deviation. Battle.ts's HUD/log text metrics
// (HUD_CHARS_PER_LINE=31 at 12px, LOG_CHARS_PER_LINE=38 at 10px) and its
// fitLines budgets are tuned to a 230px wrap, and the 3x2 action bar is
// 226px wide edge to edge. At 160px every one of those would need
// retuning, which is a redesign; at 230 the whole existing right-hand
// panel moves left as ONE rigid block (an x-translation, every y kept),
// which is the "straight relocation, not a redesign" the plan's own §4b
// asks for. The right column is 230px so it genuinely is a copy of the
// Hub's chat box (Hub.ts's DOCK_WIDTH is 236 with an 8px inset — same
// font sizes and line-fitting transfer rather than needing retuning).
//
// The cost is the board: 582px wide with both columns open, down from the
// shipped 700. Against the real formula that's 16px tiles on the widest
// map (36 tiles: Falling Back to Meridian) instead of 19, and 29px instead
// of 35 on a typical 20-wide map. `[` and `]` collapse either column and
// give it back — both closed is 1042px, wider than the game has ever had
// (28px on that same 36-wide map). The tests below prove MIN_TILE never
// binds for any real map at the default open-column layout, so nothing
// scrolls.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BattleLayoutInput {
  canvasW: number;
  canvasH: number;
  mapW: number; // in tiles
  mapH: number; // in tiles
  leftOpen: boolean;
  rightOpen: boolean;
}

export interface BattleLayoutResult {
  /** The left panel (unit info / briefing, mission log, action bar) — null when collapsed. */
  leftColumn: Rect | null;
  /** The right panel (comms) — null when collapsed. */
  rightColumn: Rect | null;
  /** The region the board may occupy; the board itself is boardW x boardH inside it, top-left aligned. */
  mapViewport: Rect;
  tileSize: number;
  /** Where the board's tile (0,0) is drawn. */
  boardX: number;
  boardY: number;
  /** True only if the board can't fit even at MIN_TILE — never true for a real map at any column state, see the tests. */
  mapScrolls: boolean;
}

/** The floor Battle.ts always used (a 16px tile is the smallest a unit silhouette still reads at). */
export const MIN_TILE = 16;
/** Battle.ts never capped tile size explicitly; its 560px-tall viewport over a 12-tall map gave 46. Kept as an explicit cap so a tiny map can't balloon. */
export const MAX_TILE = 48;

export const COLUMN_W = 230;
/** Gutter between the canvas edge and a column, and between a column and the board. */
export const GUTTER = 8;
/** The board's top edge — unchanged from the shipped Battle.ts (boardY = 60), which leaves the top strip for the back button. */
export const BOARD_TOP = 60;
/** The board's bottom edge — unchanged from the shipped 560px viewport (60 + 560 = 620), leaving 20px below for Mission 1's tutorial line. */
export const BOARD_BOTTOM = 620;
/** The shipped board's own left edge with no left column — kept so a collapsed left column returns the exact old origin. */
export const BOARD_LEFT_NO_COLUMN = 16;

export function computeBattleLayout(input: BattleLayoutInput): BattleLayoutResult {
  const { canvasW, canvasH, mapW, mapH, leftOpen, rightOpen } = input;
  const columnTop = 0;
  const columnH = canvasH;

  const leftColumn: Rect | null = leftOpen ? { x: GUTTER, y: columnTop, w: COLUMN_W, h: columnH } : null;
  const rightColumn: Rect | null = rightOpen ? { x: canvasW - GUTTER - COLUMN_W, y: columnTop, w: COLUMN_W, h: columnH } : null;

  const viewportLeft = leftColumn ? leftColumn.x + leftColumn.w + GUTTER : BOARD_LEFT_NO_COLUMN;
  const viewportRight = rightColumn ? rightColumn.x - GUTTER : canvasW - BOARD_LEFT_NO_COLUMN;
  const mapViewport: Rect = { x: viewportLeft, y: BOARD_TOP, w: viewportRight - viewportLeft, h: BOARD_BOTTOM - BOARD_TOP };

  const fit = Math.min(Math.floor(mapViewport.w / Math.max(1, mapW)), Math.floor(mapViewport.h / Math.max(1, mapH)));
  const tileSize = Math.max(MIN_TILE, Math.min(MAX_TILE, fit));
  const mapScrolls = fit < MIN_TILE;

  return {
    leftColumn,
    rightColumn,
    mapViewport,
    tileSize,
    boardX: mapViewport.x,
    boardY: mapViewport.y,
    mapScrolls,
  };
}

/** True if two rects overlap by any positive area (touching edges don't count). */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
