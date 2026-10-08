import { describe, expect, it } from "vitest";
import { DECK_LAYOUTS, STAIRS, resolveAgainstSolids, roomCenter as roomCenterOf, type DeckId, type RoomId } from "../hubLayout";
import { isWalkable } from "../hubNav";
import { AUTO_WALK_ARRIVE, AUTO_WALK_SNAP_PX, nearestStandable, planAutoWalk, stepAutoWalk } from "../hubAutoWalk";

const PLAYER_R = 15;
const STEP = 190 / 60; // PLAYER_SPEED px/sec at 60 fps
const DECKS = Object.keys(DECK_LAYOUTS) as DeckId[];
const roomCenter = (deck: DeckId, room: RoomId) => roomCenterOf(room, deck);
const roomsOf = (deck: DeckId) => Object.keys(DECK_LAYOUTS[deck].rooms) as RoomId[];

/** Walk a planned route the way Hub.handleMovement does: one axis at a time, each clamped against the deck's solids. */
function walk(deck: DeckId, fromX: number, fromY: number, path: { x: number; y: number }[], maxFrames = 4000) {
  let x = fromX;
  let y = fromY;
  for (let f = 0; f < maxFrames; f++) {
    const s = stepAutoWalk(path, x, y, STEP);
    if (s.done) return { x, y, frames: f, arrived: true };
    const a = resolveAgainstSolids(deck, x + s.stepX, y, PLAYER_R);
    x = a.x;
    y = a.y;
    const b = resolveAgainstSolids(deck, x, y + s.stepY, PLAYER_R);
    x = b.x;
    y = b.y;
  }
  return { x, y, frames: maxFrames, arrived: false };
}

describe("hubAutoWalk", () => {
  it("walks the player from every room to every other room on the same deck, around the walls", () => {
    for (const deck of DECKS) {
      const rooms = roomsOf(deck);
      for (const from of rooms) {
        for (const to of rooms) {
          if (from === to) continue;
          const a = nearestStandable(deck, roomCenter(deck, from).x, roomCenter(deck, from).y, PLAYER_R)!;
          const target = roomCenter(deck, to);
          const path = planAutoWalk(deck, a.x, a.y, target.x, target.y, PLAYER_R);
          expect(path, `${deck}: ${from} -> ${to} has a route`).not.toBeNull();
          const end = path![path!.length - 1];
          expect(isWalkable(deck, end.x, end.y, PLAYER_R), `${deck}: ${from} -> ${to} ends on the floor`).toBe(true);
          const r = walk(deck, a.x, a.y, path!);
          expect(r.arrived, `${deck}: ${from} -> ${to} arrives`).toBe(true);
          expect(Math.hypot(r.x - end.x, r.y - end.y)).toBeLessThanOrEqual(AUTO_WALK_ARRIVE + 0.01);
        }
      }
    }
  });

  it("reaches every stair marker from its deck's first room", () => {
    for (const key of Object.keys(STAIRS) as (keyof typeof STAIRS)[]) {
      const stair = STAIRS[key];
      const deck = DECKS.find((d) => isWalkable(d, stair.x, stair.y, PLAYER_R) && planAutoWalk(d, stair.x, stair.y, stair.x, stair.y, PLAYER_R));
      expect(deck, `stair ${key} stands on some deck`).toBeDefined();
      const from = nearestStandable(deck!, roomCenter(deck!, roomsOf(deck!)[0]).x, roomCenter(deck!, roomsOf(deck!)[0]).y, PLAYER_R)!;
      const path = planAutoWalk(deck!, from.x, from.y, stair.x, stair.y, PLAYER_R);
      expect(path, `stair ${key} has a route`).not.toBeNull();
      expect(walk(deck!, from.x, from.y, path!).arrived, `stair ${key} is reached`).toBe(true);
    }
  });

  it("a straight unobstructed walk is one point, the target itself", () => {
    const deck = DECKS[0];
    const c = nearestStandable(deck, roomCenter(deck, roomsOf(deck)[0]).x, roomCenter(deck, roomsOf(deck)[0]).y, PLAYER_R)!;
    const near = nearestStandable(deck, c.x + 30, c.y, PLAYER_R)!;
    const path = planAutoWalk(deck, c.x, c.y, near.x, near.y, PLAYER_R);
    expect(path).not.toBeNull();
    expect(path![path!.length - 1]).toEqual(near);
  });

  it("a click just off the floor snaps to a standable spot; a click far off the deck does nothing", () => {
    for (const deck of DECKS) {
      const b = DECK_LAYOUTS[deck].bounds;
      const c = nearestStandable(deck, (b.left + b.right) / 2, (b.top + b.bottom) / 2, PLAYER_R);
      expect(c, `${deck} has a standable middle`).not.toBeNull();
      const far = planAutoWalk(deck, c!.x, c!.y, b.right + AUTO_WALK_SNAP_PX * 3, b.bottom + AUTO_WALK_SNAP_PX * 3, PLAYER_R);
      expect(far, `${deck}: far off the deck`).toBeNull();
    }
    // A point inside a wall between two rooms on the first deck: find one that is not walkable but has floor close by.
    const deck = DECKS[0];
    const b = DECK_LAYOUTS[deck].bounds;
    let wall: { x: number; y: number } | null = null;
    for (let y = b.top + 20; y < b.bottom && !wall; y += 10) for (let x = b.left + 20; x < b.right && !wall; x += 10) if (!isWalkable(deck, x, y, PLAYER_R) && isWalkable(deck, x + 30, y, PLAYER_R)) wall = { x, y };
    expect(wall).not.toBeNull();
    const snapped = nearestStandable(deck, wall!.x, wall!.y, PLAYER_R);
    expect(snapped).not.toBeNull();
    expect(isWalkable(deck, snapped!.x, snapped!.y, PLAYER_R)).toBe(true);
  });

  it("never steps further than maxStep and never overshoots the final point", () => {
    const path = [{ x: 100, y: 0 }];
    const s = stepAutoWalk(path, 0, 0, 3);
    expect(Math.hypot(s.stepX, s.stepY)).toBeCloseTo(3);
    const last = stepAutoWalk([{ x: 1.5, y: 0 }], 0, 0, 3);
    expect(last.done).toBe(true);
    const close = stepAutoWalk([{ x: 2.5, y: 0 }], 0, 0, 3);
    expect(close.stepX).toBeCloseTo(2.5);
    expect(stepAutoWalk([], 0, 0, 3).done).toBe(true);
  });
});
