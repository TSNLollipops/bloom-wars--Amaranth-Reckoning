// engine/battleLayout.ts — Workstream 2 of the Mission Chat / Player Notes /
// Battle HUD Relayout plan, 12 Sep 2026. The whole point of the split: the
// layout can be proven without a browser. The last test loops over EVERY
// real map in the game (data/mapRegistry.ts's ALL_MAPS — 72 at the time of
// writing) rather than a hand-picked worst case, per the plan's own §3c —
// the 4 Sep verification note checked this by hand once; this makes it an
// invariant.
import { describe, it, expect } from "vitest";
import {
  computeBattleLayout,
  rectsOverlap,
  MIN_TILE,
  MAX_TILE,
  COLUMN_W,
  GUTTER,
  BOARD_TOP,
  BOARD_BOTTOM,
  BOARD_LEFT_NO_COLUMN,
  type BattleLayoutInput,
} from "../battleLayout";
import { ALL_MAPS } from "../../data/mapRegistry";

const CANVAS = { canvasW: 1074, canvasH: 640 };
const open = (mapW: number, mapH: number, leftOpen = true, rightOpen = true): BattleLayoutInput => ({ ...CANVAS, mapW, mapH, leftOpen, rightOpen });

describe("computeBattleLayout — known sizes produce known rects", () => {
  it("both columns open: left at the gutter, right flush to the far gutter, board between them", () => {
    const L = computeBattleLayout(open(20, 12));
    expect(L.leftColumn).toEqual({ x: GUTTER, y: 0, w: COLUMN_W, h: 640 });
    expect(L.rightColumn).toEqual({ x: 1074 - GUTTER - COLUMN_W, y: 0, w: COLUMN_W, h: 640 });
    expect(L.mapViewport).toEqual({ x: 246, y: BOARD_TOP, w: 582, h: BOARD_BOTTOM - BOARD_TOP });
    expect(L.boardX).toBe(246);
    expect(L.boardY).toBe(60);
  });

  it("a 20x12 map (Muster's own size) gets 29px tiles with both columns open — essentially the shipped 35, not a quarter smaller", () => {
    expect(computeBattleLayout(open(20, 12)).tileSize).toBe(29);
  });

  it("collapsing the left column returns the board to the shipped origin (16, 60)", () => {
    const L = computeBattleLayout(open(20, 12, false, true));
    expect(L.leftColumn).toBeNull();
    expect(L.boardX).toBe(BOARD_LEFT_NO_COLUMN);
    expect(L.boardY).toBe(60);
    expect(L.mapViewport.w).toBe(1074 - GUTTER - COLUMN_W - GUTTER - BOARD_LEFT_NO_COLUMN);
  });

  it("collapsing the right column runs the board to the far edge's own 16px margin", () => {
    const L = computeBattleLayout(open(20, 12, true, false));
    expect(L.rightColumn).toBeNull();
    expect(L.mapViewport.x + L.mapViewport.w).toBe(1074 - BOARD_LEFT_NO_COLUMN);
  });

  it("both collapsed gives the full-board view: 1042px wide, and tile size back at (or above) its full-board value", () => {
    const both = computeBattleLayout(open(36, 14, false, false));
    expect(both.mapViewport.w).toBe(1074 - 2 * BOARD_LEFT_NO_COLUMN);
    expect(both.tileSize).toBe(28);
    const shipped = Math.max(16, Math.min(Math.floor(700 / 36), Math.floor(560 / 14))); // Battle.ts's own pre-relayout formula
    expect(both.tileSize).toBeGreaterThanOrEqual(shipped);
  });
});

describe("computeBattleLayout — invariants at every column state", () => {
  const states: [boolean, boolean][] = [
    [true, true],
    [true, false],
    [false, true],
    [false, false],
  ];
  const sizes: [number, number][] = [
    [1, 1],
    [10, 10],
    [20, 12],
    [30, 19],
    [36, 14],
    [50, 30],
  ];

  it("the map viewport never overflows the canvas, and the drawn board never overflows the viewport when it fits", () => {
    for (const [l, r] of states) {
      for (const [w, h] of sizes) {
        const L = computeBattleLayout(open(w, h, l, r));
        expect(L.mapViewport.x).toBeGreaterThanOrEqual(0);
        expect(L.mapViewport.y).toBeGreaterThanOrEqual(0);
        expect(L.mapViewport.x + L.mapViewport.w).toBeLessThanOrEqual(1074);
        expect(L.mapViewport.y + L.mapViewport.h).toBeLessThanOrEqual(640);
        if (!L.mapScrolls) {
          expect(L.boardX + w * L.tileSize).toBeLessThanOrEqual(L.mapViewport.x + L.mapViewport.w);
          expect(L.boardY + h * L.tileSize).toBeLessThanOrEqual(L.mapViewport.y + L.mapViewport.h);
        }
      }
    }
  });

  it("column rects never overlap the map viewport or each other", () => {
    for (const [l, r] of states) {
      const L = computeBattleLayout(open(20, 12, l, r));
      if (L.leftColumn) expect(rectsOverlap(L.leftColumn, L.mapViewport)).toBe(false);
      if (L.rightColumn) expect(rectsOverlap(L.rightColumn, L.mapViewport)).toBe(false);
      if (L.leftColumn && L.rightColumn) expect(rectsOverlap(L.leftColumn, L.rightColumn)).toBe(false);
    }
  });

  it("tile size is always inside [MIN_TILE, MAX_TILE], and mapScrolls is true exactly when the clamp binds at MIN_TILE", () => {
    for (const [l, r] of states) {
      for (const [w, h] of sizes) {
        const L = computeBattleLayout(open(w, h, l, r));
        expect(L.tileSize).toBeGreaterThanOrEqual(MIN_TILE);
        expect(L.tileSize).toBeLessThanOrEqual(MAX_TILE);
        const raw = Math.min(Math.floor(L.mapViewport.w / w), Math.floor(L.mapViewport.h / h));
        expect(L.mapScrolls).toBe(raw < MIN_TILE);
      }
    }
    // A 1x1 map hits the cap rather than a 560px tile.
    expect(computeBattleLayout(open(1, 1)).tileSize).toBe(MAX_TILE);
    // A 50-wide map genuinely can't fit at 16px in 582px — that's the one case mapScrolls exists for.
    expect(computeBattleLayout(open(50, 30)).mapScrolls).toBe(true);
  });

  it("closing a column never shrinks the tile size, and reopening it restores the exact previous layout", () => {
    for (const [w, h] of sizes) {
      const bothOpen = computeBattleLayout(open(w, h, true, true));
      const leftClosed = computeBattleLayout(open(w, h, false, true));
      const bothClosed = computeBattleLayout(open(w, h, false, false));
      expect(leftClosed.tileSize).toBeGreaterThanOrEqual(bothOpen.tileSize);
      expect(bothClosed.tileSize).toBeGreaterThanOrEqual(leftClosed.tileSize);
      expect(computeBattleLayout(open(w, h, true, true))).toEqual(bothOpen);
    }
  });
});

describe("computeBattleLayout — every real map in the game", () => {
  const maps = Object.values(ALL_MAPS);

  it("the registry is the full live set (a sanity check that the loop below isn't running over an empty object)", () => {
    expect(maps.length).toBeGreaterThanOrEqual(72);
  });

  it("mapScrolls is false for every real map at the default open-column layout — fact 1b made load-bearing", () => {
    for (const m of maps) {
      const L = computeBattleLayout(open(m.width, m.height));
      expect(L.mapScrolls, `${m.id} (${m.width}x${m.height}) would need to scroll`).toBe(false);
      expect(L.boardX + m.width * L.tileSize, `${m.id} overflows the viewport`).toBeLessThanOrEqual(L.mapViewport.x + L.mapViewport.w);
    }
  });

  it("mapScrolls stays false for every real map at every column state (collapsing only ever adds room)", () => {
    for (const m of maps) {
      for (const l of [true, false]) {
        for (const r of [true, false]) {
          expect(computeBattleLayout(open(m.width, m.height, l, r)).mapScrolls, m.id).toBe(false);
        }
      }
    }
  });

  it("the two dimension extremes named in the plan really are the extremes, and their open-column tile sizes are what the header says", () => {
    const maxW = Math.max(...maps.map((m) => m.width));
    const maxH = Math.max(...maps.map((m) => m.height));
    expect(maxW).toBe(36);
    expect(maxH).toBe(19);
    expect(computeBattleLayout(open(36, 14)).tileSize).toBe(16);
    expect(computeBattleLayout(open(30, 19)).tileSize).toBe(19);
  });
});
