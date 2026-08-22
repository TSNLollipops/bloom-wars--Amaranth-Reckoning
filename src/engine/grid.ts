// src/engine/grid.ts
// Coordinate system, tile lookup, per-chassis movement cost, reachable-tile
// flood fill, and pathfinding. Pure TypeScript — no Phaser (Build Brief §2.2).
import type { Coord, MapDefinition, Chassis, TileType } from "../data/types";
import { TILES } from "../data/tiles";

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

export type MovementKind = "bipedal" | "centauroid" | "flying";

export function chassisToMovementKind(chassis: Chassis, flying: boolean): MovementKind {
  if (flying) return "flying";
  return chassis === "centauroid" ? "centauroid" : "bipedal";
}

export function moveCost(map: MapDefinition, c: Coord, kind: MovementKind): number {
  const tile = TILES[tileAt(map, c)];
  return tile.moveCost[kind];
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
 */
export function reachableTiles(
  map: MapDefinition,
  start: Coord,
  budget: number,
  kind: MovementKind,
  occupied: Set<string>
): Map<string, { cost: number; cameFrom: Coord | null }> {
  const best = new Map<string, { cost: number; cameFrom: Coord | null }>();
  best.set(coordKey(start), { cost: 0, cameFrom: null });

  // Simple Dijkstra/Bellman-ish relaxation — the board is tiny (<=20x12),
  // so a priority queue is not worth the complexity.
  let improved = true;
  while (improved) {
    improved = false;
    for (const [key, entry] of best) {
      const [x, y] = key.split(",").map(Number);
      for (const d of CARDINAL) {
        const next = { x: x + d.x, y: y + d.y };
        if (!isPassable(map, next, kind)) continue;
        const nextKey = coordKey(next);
        if (occupied.has(nextKey) && nextKey !== coordKey(start)) continue; // can't pass through units
        const cost = entry.cost + moveCost(map, next, kind);
        if (cost > budget) continue;
        const existing = best.get(nextKey);
        if (!existing || cost < existing.cost) {
          best.set(nextKey, { cost, cameFrom: { x, y } });
          improved = true;
        }
      }
    }
  }
  return best;
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
