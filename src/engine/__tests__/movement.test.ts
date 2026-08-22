// Build Brief step 3 / §4.1 "Movement costs" suite: the chassis layer must
// be real — centauroid reaches fewer tiles than bipedal on a rubble-heavy
// map, and nothing crosses a wall tile.
import { describe, it, expect } from "vitest";
import { reachableTiles, coordKey } from "../grid";
import { map_city_sweep_01, map_bunker_01 } from "../../data/maps";

describe("reachableTiles — chassis movement cost", () => {
  it("a bipedal unit with move 6 reaches more tiles than a centauroid with the same budget, on a rubble-heavy start", () => {
    const start = { x: 0, y: 6 }; // a deploy tile on map_city_sweep_01, near the rubble field
    const bipedal = reachableTiles(map_city_sweep_01, start, 6, "bipedal", new Set());
    const centauroid = reachableTiles(map_city_sweep_01, start, 6, "centauroid", new Set());
    expect(bipedal.size).toBeGreaterThan(centauroid.size);
  });

  it("rubble costs the centauroid chassis more than the bipedal chassis", () => {
    const start = { x: 8, y: 7 }; // adjacent to the rubble field at (9,7)
    const rubbleTile = { x: 9, y: 7 };
    const bipedal = reachableTiles(map_city_sweep_01, start, 2, "bipedal", new Set());
    const centauroid = reachableTiles(map_city_sweep_01, start, 2, "centauroid", new Set());
    expect(bipedal.has(coordKey(rubbleTile))).toBe(true); // cost 2, exactly the budget
    expect(centauroid.has(coordKey(rubbleTile))).toBe(false); // cost 3, over budget
  });

  it("nothing crosses a wall tile — the Bunker's blockhouse is a real barrier", () => {
    // The blockhouse interior (hold zone) is walled at column 6 and 11.
    // A unit starting outside cannot reach the hold zone in one hop even
    // with a huge budget, because the wall ring has exactly two doorways.
    const outsideStart = { x: 0, y: 4 };
    const reachable = reachableTiles(map_bunker_01, outsideStart, 30, "bipedal", new Set());
    // A wall tile itself must never appear as reachable.
    const wallTile = coordKey({ x: 6, y: 3 });
    expect(reachable.has(wallTile)).toBe(false);
    // The hold-zone tile at the doorway column (9) IS reachable — it can
    // only be reached by routing through the single-tile opening at
    // (9,3), proving the flood fill correctly routes around the wall
    // rather than being fully blocked by the blockhouse.
    expect(reachable.has(coordKey({ x: 9, y: 4 }))).toBe(true);
    // A hold tile reachable only via the interior (not itself adjacent to
    // the doorway) confirms movement continues past the doorway, not just
    // up to it.
    expect(reachable.has(coordKey({ x: 7, y: 5 }))).toBe(true);
  });
});
