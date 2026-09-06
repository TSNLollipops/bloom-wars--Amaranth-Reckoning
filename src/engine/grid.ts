// src/engine/grid.ts
// Coordinate system, tile lookup, per-chassis movement cost, reachable-tile
// flood fill, and pathfinding. Pure TypeScript — no Phaser (Build Brief §2.2).
import type { Coord, MapDefinition, Chassis, TileType } from "../data/types";
import { TILES } from "../data/tiles";
import { BLOOMWALKERS_MAT_MOVE_COST } from "../data/frameSystems";

export function coordKey(c: Coord): string {
  return `${c.x},${c.y}`;
}

export function coordsEqual(a: Coord, b: Coord): boolean {
  return a.x === b.x && a.y === b.y;
}

export function chebyshevDistance(a: Coord, b: Coord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

// Movement uses 4-directional (Manhattan-adjacent) stepping — the grid is
// a tactics grid, not a hex/8-dir board. Distance-for-range checks
// (attack range, counter range, vision) use Chebyshev per the Data Pack.
const CARDINAL: Coord[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export function inBounds(map: MapDefinition, c: Coord): boolean {
  return c.x >= 0 && c.y >= 0 && c.x < map.width && c.y < map.height;
}

export function tileAt(map: MapDefinition, c: Coord): TileType {
  return map.tiles[c.y][c.x];
}

// The two `*_bloomwalker` variants were added 6 Sep 2026 for the Frame
// Systems Layer's Bloomwalkers system ("bloom mat costs 1 move instead of
// 2"). A kind rather than a per-unit callback threaded through the ~18
// reachableTiles/moveCost call sites, so the flood fill's hot path (half of
// every sim's CPU time — see reachableTiles' own comment) gains one branch
// in moveCost and nothing else. engine/frameSystems.ts's movementKindForUnit
// is the only thing that ever produces them; every hostile and Bloom still
// gets one of the original three.
export type MovementKind = "bipedal" | "centauroid" | "flying" | "bipedal_bloomwalker" | "centauroid_bloomwalker";

/** The tiles.ts cost column a kind reads — the bloomwalker variants read their base chassis's column everywhere but bloom_mat. */
function baseMovementKind(kind: MovementKind): "bipedal" | "centauroid" | "flying" {
  if (kind === "bipedal_bloomwalker") return "bipedal";
  if (kind === "centauroid_bloomwalker") return "centauroid";
  return kind;
}

export function chassisToMovementKind(chassis: Chassis, flying: boolean): MovementKind {
  if (flying) return "flying";
  return chassis === "centauroid" ? "centauroid" : "bipedal";
}

export function moveCost(map: MapDefinition, c: Coord, kind: MovementKind): number {
  const tile = TILES[tileAt(map, c)];
  if (tile.id === "bloom_mat" && (kind === "bipedal_bloomwalker" || kind === "centauroid_bloomwalker")) return BLOOMWALKERS_MAT_MOVE_COST;
  return tile.moveCost[baseMovementKind(kind)];
}

export function isPassable(map: MapDefinition, c: Coord, kind: MovementKind): boolean {
  if (!inBounds(map, c)) return false;
  const tile = TILES[tileAt(map, c)];
  if (kind === "flying") return Number.isFinite(tile.moveCost.flying);
  return tile.passableGround && Number.isFinite(moveCost(map, c, kind));
}

/**
 * Flood fill: every tile reachable within `budget` movement points, given a
 * set of occupied tiles (other units block passage but not targeting).
 * Returns a map of coordKey -> { cost, cameFrom } for path reconstruction.
 *
 * Same algorithm and same results as the original (1 Sep 2026 tiers pass,
 * profiling the Hard bot's hostile oracle: this one function was half of
 * every sim's CPU time): a Bellman-style relaxation that rescans every
 * discovered tile, in discovery order, until nothing improves. The rewrite
 * keeps that exact order — the returned Map is built in discovery order,
 * and cameFrom is overwritten only on a strictly cheaper cost — because
 * callers tie-break by iterating the Map (moveToward's strict `<`,
 * reachableWithinRangeTile's strict `<`) and isStraightLineCharge reads
 * the reconstructed path's shape; a "better" Dijkstra with different tie
 * behaviour would silently change which tile a unit picks and whether a
 * charge triggers. What changed is only the bookkeeping: typed arrays
 * indexed by tile instead of parsing "x,y" strings on every visit.
 */
export function reachableTiles(
  map: MapDefinition,
  start: Coord,
  budget: number,
  kind: MovementKind,
  occupied: Set<string>
): Map<string, { cost: number; cameFrom: Coord | null }> {
  const W = map.width;
  const H = map.height;
  const size = W * H;
  const cost = new Float64Array(size).fill(Infinity);
  const from = new Int32Array(size).fill(-1);
  const order: number[] = [];
  const startI = start.y * W + start.x;
  const startKey = coordKey(start);
  cost[startI] = 0;
  order.push(startI);

  // Simple Dijkstra/Bellman-ish relaxation — the board is tiny (<=20x12),
  // so a priority queue is not worth the complexity (and would change
  // tie-breaks, see above). `order` grows while it is being scanned,
  // exactly as the original's Map iteration visited entries appended
  // mid-iteration.
  let improved = true;
  while (improved) {
    improved = false;
    for (let k = 0; k < order.length; k++) {
      const i = order[k];
      const x = i % W;
      const y = (i - x) / W;
      const base = cost[i];
      for (const d of CARDINAL) {
        const nx = x + d.x;
        const ny = y + d.y;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const next = { x: nx, y: ny };
        if (!isPassable(map, next, kind)) continue;
        const nextKey = `${nx},${ny}`;
        if (occupied.has(nextKey) && nextKey !== startKey) continue; // can't pass through units
        const c = base + moveCost(map, next, kind);
        if (c > budget) continue;
        const ni = ny * W + nx;
        const existing = cost[ni];
        if (existing === Infinity) {
          order.push(ni);
          cost[ni] = c;
          from[ni] = i;
          improved = true;
        } else if (c < existing) {
          cost[ni] = c;
          from[ni] = i;
          improved = true;
        }
      }
    }
  }

  const best = new Map<string, { cost: number; cameFrom: Coord | null }>();
  for (const i of order) {
    const x = i % W;
    const y = (i - x) / W;
    const f = from[i];
    best.set(`${x},${y}`, { cost: cost[i], cameFrom: f < 0 ? null : { x: f % W, y: (f - (f % W)) / W } });
  }
  return best;
}

/**
 * True path-cost from `origin` to every tile it can reach, walls-aware but
 * NOT bounded by a single turn's movement budget and NOT blocked by where
 * units currently stand (a "distance field" — the AI-movement analogue of
 * a roguelike Dijkstra map). Used by moveToward() below so multi-turn
 * routing around an obstacle can be compared against what's reachable
 * *this* turn, instead of only straight-line Chebyshev distance to the
 * goal, which has no notion of "the wall in between."
 */
export function distanceField(map: MapDefinition, origin: Coord, kind: MovementKind): Map<string, number> {
  const flood = reachableTiles(map, origin, Infinity, kind, new Set());
  const out = new Map<string, number>();
  for (const [key, entry] of flood) out.set(key, entry.cost);
  return out;
}

export function reconstructPath(
  reachable: Map<string, { cost: number; cameFrom: Coord | null }>,
  target: Coord
): Coord[] {
  const path: Coord[] = [];
  let cur: Coord | null = target;
  while (cur) {
    path.unshift(cur);
    const entry = reachable.get(coordKey(cur));
    cur = entry ? entry.cameFrom : null;
  }
  return path;
}

/**
 * Whether the final leg of `path` is an unbroken straight line of at least
 * `minTiles` tiles, each of cost-1 terrain for `kind` — the centauroid
 * charge precondition (GDD §4.3 / Data Pack §7.4).
 */
export function isStraightLineCharge(map: MapDefinition, path: Coord[], kind: MovementKind, minTiles = 3): boolean {
  if (path.length < minTiles + 1) return false;
  const tail = path.slice(-(minTiles + 1));
  const dx = Math.sign(tail[1].x - tail[0].x);
  const dy = Math.sign(tail[1].y - tail[0].y);
  if (dx !== 0 && dy !== 0) return false; // diagonals aren't a straight cardinal line here
  for (let i = 0; i < tail.length - 1; i++) {
    const a = tail[i];
    const b = tail[i + 1];
    if (Math.sign(b.x - a.x) !== dx || Math.sign(b.y - a.y) !== dy) return false;
    if (moveCost(map, b, kind) !== 1) return false;
  }
  return true;
}

export function neighbors4(c: Coord): Coord[] {
  return CARDINAL.map((d) => ({ x: c.x + d.x, y: c.y + d.y }));
}
