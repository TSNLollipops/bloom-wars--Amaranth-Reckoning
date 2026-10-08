// src/engine/hubAutoWalk.ts
//
// Click-to-walk for the player in the Hub (7 Oct 2026; customer playtest
// 25 Sep: "walking there with WASD every time will get old by Mission 10").
// Right-click a spot on the deck and the player walks there around the
// walls. This file is the route and the stepping, nothing else: it reuses
// hubNav.findPath, the same A* the crew have walked on since 3 Sep, so the
// player can only ever be sent where an NPC could already go.
//
// Phaser-free, like hubNav.ts and hubLayout.ts, so it is unit-tested in
// plain Node. Hub.ts owns the input, the marker, the stairs and every
// reason to cancel (a movement key, a left click, a panel opening, being
// stuck); see Hub.handleMovement.

import { findPath, isWalkable, NAV_CELL } from "./hubNav";
import type { DeckId } from "./hubLayout";

export interface WalkPoint {
  x: number;
  y: number;
}

/** How close the player has to get to an intermediate waypoint before aiming at the next one. Same figure the crew use (Hub.ts NAV_WAYPOINT_REACH). */
export const AUTO_WALK_WAYPOINT_REACH = 12;
/** How close counts as "arrived" at the final point. */
export const AUTO_WALK_ARRIVE = 2;
/** How far (px) a click on a wall, a table or just off the floor is allowed to snap to the nearest standable spot. Further than this and the click does nothing. */
export const AUTO_WALK_SNAP_PX = NAV_CELL * 5;

/** The nearest spot a body of `radius` can stand on, within AUTO_WALK_SNAP_PX of (x, y). Null if there is none. */
export function nearestStandable(deck: DeckId, x: number, y: number, radius: number): WalkPoint | null {
  if (isWalkable(deck, x, y, radius)) return { x, y };
  const step = NAV_CELL / 2;
  const rings = Math.ceil(AUTO_WALK_SNAP_PX / step);
  let best: WalkPoint | null = null;
  let bestD = Infinity;
  for (let ring = 1; ring <= rings && !best; ring++) {
    for (let iy = -ring; iy <= ring; iy++) {
      for (let ix = -ring; ix <= ring; ix++) {
        if (Math.max(Math.abs(ix), Math.abs(iy)) !== ring) continue;
        const px = x + ix * step;
        const py = y + iy * step;
        const d = Math.hypot(px - x, py - y);
        if (d > AUTO_WALK_SNAP_PX || d >= bestD) continue;
        if (isWalkable(deck, px, py, radius)) {
          best = { x: px, y: py };
          bestD = d;
        }
      }
    }
  }
  return best;
}

/**
 * The waypoints to walk from (fromX, fromY) to the clicked point on `deck`,
 * ending on a spot the body can actually stand on. Never empty when it is
 * not null: a straight, unobstructed walk comes back as the one final
 * point. Null means the click has no standable spot near it or no route
 * exists, and the caller should do nothing.
 */
export function planAutoWalk(deck: DeckId, fromX: number, fromY: number, toX: number, toY: number, radius: number): WalkPoint[] | null {
  const target = nearestStandable(deck, toX, toY, radius);
  if (!target) return null;
  const path = findPath(deck, fromX, fromY, target.x, target.y, radius);
  if (path === null) return null;
  return path.length > 0 ? path : [target];
}

/**
 * One frame of walking. Drops waypoints already reached from the FRONT of
 * `path` (it mutates the array, the way Hub.ts's NPC follower does), then
 * returns how far to move this frame toward the next one, never further
 * than `maxStep` and never past the final point. `done` is true once the
 * final point is reached; the step is then zero.
 */
export function stepAutoWalk(path: WalkPoint[], x: number, y: number, maxStep: number): { stepX: number; stepY: number; done: boolean } {
  while (path.length > 1 && Math.hypot(path[0].x - x, path[0].y - y) <= AUTO_WALK_WAYPOINT_REACH) path.shift();
  if (path.length === 0) return { stepX: 0, stepY: 0, done: true };
  const aim = path[0];
  const dx = aim.x - x;
  const dy = aim.y - y;
  const dist = Math.hypot(dx, dy);
  if (path.length === 1 && dist <= AUTO_WALK_ARRIVE) return { stepX: 0, stepY: 0, done: true };
  const move = Math.min(dist, maxStep);
  return { stepX: (dx / dist) * move, stepY: (dy / dist) * move, done: false };
}
