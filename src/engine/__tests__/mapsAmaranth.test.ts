// Map-validation discipline for the four Amaranth grids, moved into the
// suite as part of the enlargement pass (Maxime, 23 Aug 2026 — "feel free to
// incrase map size"; see data/mapsAmaranth.ts's own header for the sizes and
// the reasoning).
//
// data/mapsAmaranth.ts promises three things about every grid in it —
// rectangular, known tile vocabulary only, and BFS-reachable from every
// deploy pad to every spawn/hold/exit tile — and until now that promise was
// kept by an offline script run once at authoring time, with the file's own
// header warning that hand-editing could silently break it. These are the
// same three checks, run on every `npm test` instead, so the next person to
// nudge a wall gets told immediately rather than shipping a sealed pocket.
//
// The last block is a different kind of check and the reason this file
// exists at all rather than just a linting script: Mission 2 is a hold_zone
// mission, and the headless harness (src/sim) plays it with an
// objective-BLIND bot (sim/testPlayerAi.ts's header lists objective play as
// explicitly out of scope) — it only ever "held" the room by coincidentally
// standing on a hold tile while shooting at something. That makes the sim
// useless as evidence that an enlarged Mission 2 is still winnable, so the
// evidence lives here instead: walk the squad through the doorway the way a
// player would, and check the mission actually resolves into a win on the
// turn it's supposed to.
import { describe, it, expect } from "vitest";
import { MAPS_AMARANTH } from "../../data/mapsAmaranth";
import { TILES } from "../../data/tiles";
import type { Coord, MapDefinition, TileType } from "../../data/types";
import { Mission } from "../mission";
import { AMARANTH_MISSION_2 } from "../../data/campaignAmaranth";
import { coordKey } from "../grid";

const KNOWN_TILES = new Set(Object.keys(TILES) as TileType[]);

/** Every tile 4-directionally reachable on foot from `from`, ignoring units and movement budget. */
function floodFrom(map: MapDefinition, from: Coord): Set<string> {
  const seen = new Set([coordKey(from)]);
  const queue: Coord[] = [from];
  while (queue.length) {
    const c = queue.shift()!;
    for (const d of [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ]) {
      const n = { x: c.x + d.x, y: c.y + d.y };
      if (n.x < 0 || n.y < 0 || n.x >= map.width || n.y >= map.height) continue;
      const key = coordKey(n);
      if (seen.has(key)) continue;
      if (!TILES[map.tiles[n.y][n.x]].passableGround) continue;
      seen.add(key);
      queue.push(n);
    }
  }
  return seen;
}

describe.each(Object.values(MAPS_AMARANTH))("$id", (map) => {
  it("is rectangular and matches its declared width/height", () => {
    expect(map.tiles.length).toBe(map.height);
    for (const row of map.tiles) expect(row.length).toBe(map.width);
  });

  it("uses only the known tile vocabulary", () => {
    for (const row of map.tiles) for (const tile of row) expect(KNOWN_TILES.has(tile)).toBe(true);
  });

  it("has deploy pads for a full five-pilot squad", () => {
    expect(map.deployZones.player.length).toBeGreaterThanOrEqual(5);
    expect(map.deployZones.enemy.length).toBeGreaterThanOrEqual(1);
  });

  it("has a walkable path from EVERY deploy pad to EVERY spawn, hold and exit tile", () => {
    const objectives: Coord[] = [...map.deployZones.enemy, ...(map.holdZone ?? []), ...(map.exitTiles ?? [])];
    for (const pad of map.deployZones.player) {
      const reachable = floodFrom(map, pad);
      const unreachable = objectives.filter((o) => !reachable.has(coordKey(o)));
      expect({ pad, unreachable }).toEqual({ pad, unreachable: [] });
    }
  });
});

/** Passable, non-hold tiles orthogonally adjacent to the hold zone — i.e. every way into the room. */
function doorwaysOf(map: MapDefinition): Coord[] {
  const holdKeys = new Set((map.holdZone ?? []).map(coordKey));
  const doors = new Map<string, Coord>();
  for (const h of map.holdZone ?? []) {
    for (const d of [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ]) {
      const n = { x: h.x + d.x, y: h.y + d.y };
      if (n.x < 0 || n.y < 0 || n.x >= map.width || n.y >= map.height) continue;
      if (holdKeys.has(coordKey(n))) continue;
      if (!TILES[map.tiles[n.y][n.x]].passableGround) continue;
      doors.set(coordKey(n), n);
    }
  }
  return [...doors.values()];
}

describe("Amaranth I.2 keeps its single doorway, and stays winnable", () => {
  it("the hold room still has EXACTLY ONE way in — the briefing's own promise", () => {
    // "There's exactly one way in or out of that room. Mind the doorway."
    // Derived from the grid rather than asserted as a coordinate, so this
    // still means something after the room is moved again.
    const map = MAPS_AMARANTH["map_amaranth_wire_and_mud"];
    expect(doorwaysOf(map)).toHaveLength(1);
  });

  it("stays small enough for five mechs to deny — the enlargement's real constraint", () => {
    // hold_zone wins on "a player is on the zone AND no hostile is"
    // (engine/mission.ts checkWinLoss). A room the squad cannot fill is a
    // room Splitfangs can stand in the far end of, which is how a first draft
    // of this enlargement made Mission 2 unwinnable even played perfectly.
    const map = MAPS_AMARANTH["map_amaranth_wire_and_mud"];
    expect(map.holdZone!.length).toBeLessThanOrEqual(20);
  });

  it("a squad that plugs the doorway and stands on the zone wins on the hold turn", () => {
    // Played the way the mission asks and the sim harness never does: the
    // Tank parks ON the doorway tile (units block movement, so that alone
    // seals the room), everyone else takes a hold tile. No attacking at all,
    // so this measures the map and the hold rule rather than damage rolls.
    const mission = new Mission(AMARANTH_MISSION_2);
    const hold = mission.map.holdZone!;
    const door = doorwaysOf(mission.map)[0];
    const holdKeys = new Set(hold.map(coordKey));
    const plugId = mission.livingUnits().find((u) => u.side === "player" && u.path === "tank")!.instanceId;

    let safety = 0;
    while (mission.outcome === "ongoing" && safety < 30) {
      safety += 1;
      for (const unit of mission.livingUnits().filter((u) => u.side === "player")) {
        const goal = unit.instanceId === plugId ? door : hold[0];
        while (unit.actionsRemaining > 0) {
          const occupied = new Set(mission.livingUnits().map((u) => coordKey(u.pos)));
          const reachable = mission.getReachableTiles(unit.instanceId).filter((c) => !occupied.has(coordKey(c)));
          if (!reachable.length) break;
          const settled = unit.instanceId === plugId ? coordKey(unit.pos) === coordKey(door) : holdKeys.has(coordKey(unit.pos));
          if (settled) break;
          const target = reachable.reduce((best, c) =>
            Math.abs(c.x - goal.x) + Math.abs(c.y - goal.y) < Math.abs(best.x - goal.x) + Math.abs(best.y - goal.y) ? c : best
          );
          if (coordKey(target) === coordKey(unit.pos)) break;
          if (!mission.moveUnit(unit.instanceId, target)) break;
        }
      }
      if (mission.outcome !== "ongoing") break;
      mission.endPlayerTurn();
    }

    expect(mission.outcome).toBe("win");
    expect(mission.turn).toBeLessThanOrEqual(AMARANTH_MISSION_2.objectiveParams.turnLimit);
    expect(mission.log).toContain("Win: objective complete.");
  });
});
