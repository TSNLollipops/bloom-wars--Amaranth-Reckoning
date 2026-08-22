// src/data/maps.ts
// The four validated maps. Tile grids transcribed verbatim from the
// project's maps_generated.ts (produced by maps.py from the ASCII source
// in Data Pack §10 and checked by maps_output.txt: rectangular, known
// tile vocabulary, deploy-pad count, and on-foot reachability from every
// deploy pad to every objective tile).
//
// deployZones / exitTiles / holdZone are derived from the tile grid itself
// (deploy -> player, spawn -> enemy, exit/hold -> objective tiles) rather
// than hand-transcribed a second time, so there is exactly one place a
// coordinate can be wrong.
import type { MapDefinition, TileType, Coord } from "./types";

export function deriveZones(tiles: TileType[][]) {
  const player: Coord[] = [];
  const enemy: Coord[] = [];
  const exitTiles: Coord[] = [];
  const holdZone: Coord[] = [];
  for (let y = 0; y < tiles.length; y++) {
    for (let x = 0; x < tiles[y].length; x++) {
      const t = tiles[y][x];
      if (t === "deploy") player.push({ x, y });
      else if (t === "spawn") enemy.push({ x, y });
      else if (t === "exit") exitTiles.push({ x, y });
      else if (t === "hold") holdZone.push({ x, y });
    }
  }
  return { player, enemy, exitTiles, holdZone };
}

// Exported so a second maps file (data/mapsAmaranth.ts) doesn't fork this
// logic — "exactly one place a coordinate can be wrong" applies just as
// much across files as within one.
export function makeMap(id: string, name: string, width: number, height: number, tiles: TileType[][]): MapDefinition {
  const zones = deriveZones(tiles);
  return {
    id,
    name,
    width,
    height,
    tiles,
    deployZones: { player: zones.player, enemy: zones.enemy },
    exitTiles: zones.exitTiles.length ? zones.exitTiles : undefined,
    holdZone: zones.holdZone.length ? zones.holdZone : undefined,
  };
}

const CITY_SWEEP_TILES: TileType[][] = [
  ["scrub", "scrub", "scrub", "plain", "plain", "structure", "structure", "plain", "plain", "rubble", "rubble", "plain", "plain", "ridge", "ridge", "ridge", "ridge", "ridge"],
  ["scrub", "scrub", "scrub", "plain", "plain", "structure", "structure", "plain", "plain", "rubble", "rubble", "plain", "plain", "plain", "ridge", "ridge", "ridge", "ridge"],
  ["scrub", "scrub", "plain", "plain", "plain", "plain", "structure", "structure", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat", "plain", "plain", "ridge", "ridge"],
  ["plain", "plain", "road", "road", "road", "road", "road", "road", "road", "road", "road", "road", "road", "road", "road", "road", "plain", "plain"],
  ["deploy", "plain", "road", "road", "structure", "structure", "plain", "plain", "plain", "plain", "rubble", "rubble", "road", "road", "plain", "plain", "bloom_mat", "bloom_mat"],
  ["deploy", "deploy", "road", "road", "structure", "structure", "plain", "plain", "plain", "plain", "rubble", "rubble", "road", "road", "plain", "bloom_mat", "bloom_mat", "bloom_mat"],
  ["deploy", "plain", "road", "road", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "road", "road", "plain", "plain", "bloom_mat", "bloom_mat"],
  ["deploy", "deploy", "road", "road", "structure", "structure", "plain", "plain", "rubble", "rubble", "rubble", "rubble", "road", "road", "plain", "plain", "bloom_mat", "spawn"],
  ["deploy", "plain", "road", "road", "structure", "structure", "plain", "plain", "rubble", "rubble", "rubble", "rubble", "road", "road", "plain", "plain", "plain", "spawn"],
  ["plain", "plain", "road", "road", "road", "road", "road", "road", "road", "road", "road", "road", "road", "road", "road", "road", "plain", "plain"],
  ["scrub", "scrub", "plain", "plain", "plain", "plain", "structure", "structure", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat", "bloom_mat", "plain", "plain", "scrub"],
  ["scrub", "scrub", "scrub", "plain", "plain", "plain", "structure", "structure", "plain", "plain", "plain", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "plain", "plain", "spawn"],
];

const BUNKER_TILES: TileType[][] = [
  ["ridge", "ridge", "ridge", "ridge", "plain", "plain", "plain", "plain", "rubble", "rubble", "rubble", "rubble", "plain", "plain", "plain", "plain", "ridge", "ridge"],
  ["ridge", "ridge", "ridge", "plain", "plain", "plain", "plain", "plain", "rubble", "rubble", "rubble", "plain", "plain", "plain", "plain", "plain", "ridge", "ridge"],
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
  ["deploy", "plain", "rubble", "rubble", "plain", "plain", "wall", "wall", "wall", "plain", "wall", "wall", "plain", "plain", "rubble", "rubble", "plain", "plain"],
  ["deploy", "plain", "rubble", "rubble", "plain", "plain", "wall", "hold", "hold", "hold", "hold", "wall", "plain", "plain", "rubble", "rubble", "plain", "plain"],
  ["deploy", "deploy", "plain", "plain", "plain", "plain", "wall", "hold", "hold", "hold", "hold", "wall", "plain", "plain", "plain", "plain", "bloom_mat", "spawn"],
  ["deploy", "deploy", "plain", "plain", "plain", "plain", "wall", "hold", "hold", "hold", "hold", "wall", "plain", "plain", "plain", "plain", "bloom_mat", "spawn"],
  ["plain", "plain", "rubble", "rubble", "plain", "plain", "wall", "wall", "wall", "plain", "wall", "wall", "plain", "plain", "rubble", "rubble", "plain", "plain"],
  ["plain", "plain", "rubble", "rubble", "plain", "plain", "plain", "plain", "road", "road", "plain", "plain", "plain", "plain", "rubble", "rubble", "plain", "plain"],
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "plain", "plain", "rubble", "rubble", "rubble", "rubble", "rubble", "rubble", "plain", "plain", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
  ["spawn", "bloom_mat", "bloom_mat", "bloom_mat", "plain", "plain", "rubble", "rubble", "rubble", "rubble", "rubble", "rubble", "plain", "plain", "bloom_mat", "bloom_mat", "bloom_mat", "spawn"],
];

const ATTRITION_TILES: TileType[][] = [
  ["scrub", "scrub", "scrub", "scrub", "plain", "plain", "plain", "plain", "plain", "plain", "road", "road", "road", "road", "plain", "plain", "plain", "plain", "plain", "plain"],
  ["scrub", "scrub", "scrub", "scrub", "plain", "plain", "plain", "plain", "plain", "plain", "road", "road", "road", "road", "plain", "plain", "plain", "plain", "plain", "plain"],
  ["plain", "plain", "rubble", "rubble", "rubble", "rubble", "plain", "plain", "plain", "plain", "road", "road", "road", "road", "plain", "plain", "plain", "plain", "rubble", "rubble"],
  ["plain", "plain", "rubble", "rubble", "rubble", "rubble", "plain", "plain", "plain", "plain", "road", "road", "road", "road", "plain", "plain", "plain", "plain", "rubble", "rubble"],
  ["deploy", "deploy", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "road", "road", "road", "road", "plain", "plain", "plain", "plain", "plain", "plain"],
  ["deploy", "deploy", "plain", "plain", "structure", "structure", "plain", "plain", "plain", "plain", "road", "road", "road", "road", "plain", "plain", "plain", "plain", "structure", "structure"],
  ["deploy", "deploy", "plain", "plain", "structure", "structure", "plain", "plain", "plain", "plain", "road", "road", "road", "road", "plain", "plain", "plain", "plain", "structure", "structure"],
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "road", "road", "road", "road", "plain", "plain", "plain", "plain", "plain", "plain"],
  ["plain", "plain", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "plain", "plain", "plain", "plain", "road", "road", "road", "road", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat"],
  ["plain", "plain", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "plain", "plain", "plain", "plain", "road", "road", "road", "road", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat"],
  ["ridge", "ridge", "ridge", "bloom_mat", "bloom_mat", "bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat", "bloom_mat", "ridge", "ridge", "ridge"],
  ["ridge", "ridge", "ridge", "bloom_mat", "bloom_mat", "spawn", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "spawn", "bloom_mat", "bloom_mat", "ridge", "ridge", "ridge"],
];

const SESSILE_TOMB_TILES: TileType[][] = [
  ["ridge", "ridge", "ridge", "ridge", "ridge", "ridge", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "ridge", "ridge", "ridge", "ridge", "ridge", "ridge"],
  ["ridge", "ridge", "ridge", "ridge", "ridge", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "ridge", "ridge", "ridge", "ridge", "ridge"],
  ["ridge", "ridge", "ridge", "plain", "plain", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "plain", "plain", "ridge", "ridge", "ridge"],
  ["deploy", "deploy", "plain", "plain", "plain", "bloom_mat", "bloom_mat", "rubble", "rubble", "rubble", "rubble", "rubble", "rubble", "bloom_mat", "bloom_mat", "plain", "plain", "plain", "exit", "exit"],
  ["deploy", "deploy", "plain", "plain", "plain", "bloom_mat", "bloom_mat", "rubble", "structure", "spawn", "spawn", "structure", "rubble", "bloom_mat", "bloom_mat", "plain", "plain", "plain", "exit", "exit"],
  ["deploy", "deploy", "plain", "plain", "bloom_mat", "bloom_mat", "bloom_mat", "rubble", "structure", "spawn", "spawn", "structure", "rubble", "bloom_mat", "bloom_mat", "bloom_mat", "plain", "plain", "exit", "exit"],
  ["plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat", "bloom_mat", "rubble", "structure", "spawn", "spawn", "structure", "rubble", "bloom_mat", "bloom_mat", "bloom_mat", "plain", "plain", "plain", "plain"],
  ["plain", "plain", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "rubble", "rubble", "rubble", "rubble", "rubble", "rubble", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "plain", "plain"],
  ["plain", "plain", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "plain", "plain"],
  ["ridge", "ridge", "plain", "plain", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "plain", "plain", "ridge", "ridge"],
  ["ridge", "ridge", "ridge", "plain", "plain", "bloom_mat", "bloom_mat", "spawn", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "spawn", "bloom_mat", "bloom_mat", "plain", "plain", "ridge", "ridge", "ridge"],
  ["ridge", "ridge", "ridge", "ridge", "ridge", "plain", "plain", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "plain", "plain", "ridge", "ridge", "ridge", "ridge", "ridge"],
];

export const map_city_sweep_01 = makeMap("map_city_sweep_01", "The City Sweep", 18, 12, CITY_SWEEP_TILES);
export const map_bunker_01 = makeMap("map_bunker_01", "The Bunker", 18, 12, BUNKER_TILES);
export const map_attrition_01 = makeMap("map_attrition_01", "The Real Fight", 20, 12, ATTRITION_TILES);
export const map_sessile_tomb = makeMap("map_sessile_tomb", "The Sessile Tomb", 20, 12, SESSILE_TOMB_TILES);

export const MAPS: Record<string, MapDefinition> = {
  map_city_sweep_01,
  map_bunker_01,
  map_attrition_01,
  map_sessile_tomb,
};
