// NPC navigation for the Antfarm — 3 Sep 2026, built alongside
// hubLayout.ts. Until this pass every NPC walked a straight line to its
// target across an open deck; the moment hubLayout.ts put walls between
// rooms that stopped being enough (a Mek walking home from the Rec Room
// would stand nose-to-wall forever — the existing stuck-timeout sidestep
// only ever broke ties, it can't route around a wall).
//
// The model is the plainest one that works: each deck is rasterised once
// into a grid of CELL-px cells, a cell is blocked if a body of the given
// radius standing at its centre would touch a wall/solid or sit outside
// the floor, and A* (8-connected, no corner-cutting) finds a cell path
// that's then pulled taut with a line-of-sight pass so an NPC walks a
// few straight legs instead of a staircase of cell centres. Hub.ts asks
// for a path once when a target is set and follows the waypoints; it
// still uses its own per-step collision for other bodies.
//
// Phaser-free on purpose — see hubLayout.ts's header. hubNav.test.ts
// proves every room on every deck is reachable from its corridor, and
// every stair marker/landing is walkable, so a layout edit that seals a
// room off fails a unit test rather than a playtest.

import { DECK_LAYOUTS, circleHitsSolid, type DeckId } from "./hubLayout";

export const NAV_CELL = 20;

interface NavGrid {
  deck: DeckId;
  radius: number;
  cols: number;
  rows: number;
  originX: number;
  originY: number;
  blocked: Uint8Array;
}

const gridCache = new Map<string, NavGrid>();

function insideFloor(deck: DeckId, x: number, y: number, r: number): boolean {
  const layout = DECK_LAYOUTS[deck];
  const b = layout.bounds;
  if (x < b.left + r || x > b.right - r || y < b.top + r || y > b.bottom - r) return false;
  if (layout.ellipse) {
    const e = layout.ellipse;
    const erx = Math.max(1, e.rx - r);
    const ery = Math.max(1, e.ry - r);
    if (((x - e.cx) / erx) ** 2 + ((y - e.cy) / ery) ** 2 > 1) return false;
  }
  return true;
}

export function navGrid(deck: DeckId, radius: number): NavGrid {
  const key = `${deck}:${radius}`;
  const cached = gridCache.get(key);
  if (cached) return cached;
  const b = DECK_LAYOUTS[deck].bounds;
  const cols = Math.ceil((b.right - b.left) / NAV_CELL);
  const rows = Math.ceil((b.bottom - b.top) / NAV_CELL);
  const blocked = new Uint8Array(cols * rows);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const x = b.left + (cx + 0.5) * NAV_CELL;
      const y = b.top + (cy + 0.5) * NAV_CELL;
      if (!insideFloor(deck, x, y, radius) || circleHitsSolid(deck, x, y, radius)) blocked[cy * cols + cx] = 1;
    }
  }
  const grid: NavGrid = { deck, radius, cols, rows, originX: b.left, originY: b.top, blocked };
  gridCache.set(key, grid);
  return grid;
}

export function isWalkable(deck: DeckId, x: number, y: number, radius: number): boolean {
  return insideFloor(deck, x, y, radius) && !circleHitsSolid(deck, x, y, radius);
}

function cellOf(g: NavGrid, x: number, y: number): { cx: number; cy: number } {
  return {
    cx: Math.max(0, Math.min(g.cols - 1, Math.floor((x - g.originX) / NAV_CELL))),
    cy: Math.max(0, Math.min(g.rows - 1, Math.floor((y - g.originY) / NAV_CELL))),
  };
}

function centerOf(g: NavGrid, cx: number, cy: number): { x: number; y: number } {
  return { x: g.originX + (cx + 0.5) * NAV_CELL, y: g.originY + (cy + 0.5) * NAV_CELL };
}

function isBlocked(g: NavGrid, cx: number, cy: number): boolean {
  if (cx < 0 || cy < 0 || cx >= g.cols || cy >= g.rows) return true;
  return g.blocked[cy * g.cols + cx] === 1;
}

// Nearest unblocked cell to a (possibly blocked) cell, searched in
// expanding rings. A target that sits a hair inside a wall's clearance
// band (a door marker, a landing point pushed by resolveAgainstSolids)
// still needs a cell to aim at.
function nearestOpen(g: NavGrid, cx: number, cy: number, maxRing = 6): { cx: number; cy: number } | null {
  if (!isBlocked(g, cx, cy)) return { cx, cy };
  for (let ring = 1; ring <= maxRing; ring++) {
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        if (!isBlocked(g, cx + dx, cy + dy)) return { cx: cx + dx, cy: cy + dy };
      }
    }
  }
  return null;
}

// Straight-line clearance between two points, sampled every few px
// against the same grid the path was found on.
function lineClear(g: NavGrid, ax: number, ay: number, bx: number, by: number): boolean {
  const d = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(1, Math.ceil(d / (NAV_CELL / 3)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const c = cellOf(g, ax + (bx - ax) * t, ay + (by - ay) * t);
    if (isBlocked(g, c.cx, c.cy)) return false;
  }
  return true;
}

// Binary min-heap on f-score — small grids, but a 30-NPC roster re-paths
// often enough that a linear open-list scan would show up.
class Heap {
  private items: { i: number; f: number }[] = [];
  get size() {
    return this.items.length;
  }
  push(i: number, f: number) {
    const a = this.items;
    a.push({ i, f });
    let k = a.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (a[p].f <= a[k].f) break;
      [a[p], a[k]] = [a[k], a[p]];
      k = p;
    }
  }
  pop(): number {
    const a = this.items;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === k) break;
        [a[m], a[k]] = [a[k], a[m]];
        k = m;
      }
    }
    return top.i;
  }
}

// Waypoints from (fromX, fromY) to (toX, toY) for a body of `radius`,
// EXCLUDING the start and INCLUDING the final target. An empty array means
// "walk straight there" (already in line of sight). null means no route
// exists on this deck's grid — the caller should treat that like the old
// straight-line behaviour and let the stuck timeout handle it.
export function findPath(deck: DeckId, fromX: number, fromY: number, toX: number, toY: number, radius: number): { x: number; y: number }[] | null {
  const g = navGrid(deck, radius);
  const s0 = cellOf(g, fromX, fromY);
  const t0 = cellOf(g, toX, toY);
  const s = nearestOpen(g, s0.cx, s0.cy);
  const t = nearestOpen(g, t0.cx, t0.cy);
  if (!s || !t) return null;
  if (lineClear(g, fromX, fromY, toX, toY)) return [];

  const idx = (cx: number, cy: number) => cy * g.cols + cx;
  const n = g.cols * g.rows;
  const gScore = new Float64Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const start = idx(s.cx, s.cy);
  const goal = idx(t.cx, t.cy);
  const h = (i: number) => {
    const cx = i % g.cols;
    const cy = (i - cx) / g.cols;
    const dx = Math.abs(cx - t.cx);
    const dy = Math.abs(cy - t.cy);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  gScore[start] = 0;
  const open = new Heap();
  open.push(start, h(start));
  let found = false;
  while (open.size > 0) {
    const cur = open.pop();
    if (cur === goal) {
      found = true;
      break;
    }
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % g.cols;
    const cy = (cur - cx) / g.cols;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (isBlocked(g, nx, ny)) continue;
        // No squeezing diagonally between two blocked orthogonal neighbours.
        if (dx !== 0 && dy !== 0 && (isBlocked(g, cx + dx, cy) || isBlocked(g, cx, cy + dy))) continue;
        const ni = idx(nx, ny);
        if (closed[ni]) continue;
        const tentative = gScore[cur] + (dx !== 0 && dy !== 0 ? Math.SQRT2 : 1);
        if (tentative < gScore[ni]) {
          gScore[ni] = tentative;
          came[ni] = cur;
          open.push(ni, tentative + h(ni));
        }
      }
    }
  }
  if (!found) return null;

  const cells: number[] = [];
  for (let i = goal; i !== -1; i = came[i]) cells.push(i);
  cells.reverse();
  const pts = cells.map((i) => {
    const cx = i % g.cols;
    return centerOf(g, cx, (i - cx) / g.cols);
  });
  pts[0] = { x: fromX, y: fromY };
  pts[pts.length - 1] = { x: toX, y: toY };

  // String-pull: from each anchor, keep the farthest later point still in
  // line of sight, drop everything between.
  const out: { x: number; y: number }[] = [];
  let anchor = 0;
  while (anchor < pts.length - 1) {
    let far = anchor + 1;
    for (let j = pts.length - 1; j > anchor + 1; j--) {
      if (lineClear(g, pts[anchor].x, pts[anchor].y, pts[j].x, pts[j].y)) {
        far = j;
        break;
      }
    }
    out.push(pts[far]);
    anchor = far;
  }
  return out;
}

// Test/debug helper — the reachable set from a point, as cell count.
export function reachableCellCount(deck: DeckId, x: number, y: number, radius: number): number {
  const g = navGrid(deck, radius);
  const s0 = cellOf(g, x, y);
  const s = nearestOpen(g, s0.cx, s0.cy);
  if (!s) return 0;
  const seen = new Uint8Array(g.cols * g.rows);
  const stack = [s.cy * g.cols + s.cx];
  seen[stack[0]] = 1;
  let count = 0;
  while (stack.length) {
    const cur = stack.pop()!;
    count++;
    const cx = cur % g.cols;
    const cy = (cur - cx) / g.cols;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (isBlocked(g, nx, ny)) continue;
      const ni = ny * g.cols + nx;
      if (seen[ni]) continue;
      seen[ni] = 1;
      stack.push(ni);
    }
  }
  return count;
}
