// src/data/tiles.ts
// Transcribed from Data Pack §7.3 / GDD §4.6 / maps_output.txt legend.
import type { TileDef, TileType } from "./types";

export const TILES: Record<TileType, TileDef> = {
  plain: {
    id: "plain",
    displayName: "Plain / ferrocrete",
    moveCost: { bipedal: 1, centauroid: 1, flying: 1 },
    defenceStars: 1,
    passableGround: true,
  },
  road: {
    id: "road",
    displayName: "Road / rail spine",
    moveCost: { bipedal: 1, centauroid: 1, flying: 1 },
    defenceStars: 0,
    passableGround: true,
  },
  scrub: {
    id: "scrub",
    displayName: "Open scrub",
    moveCost: { bipedal: 1, centauroid: 1, flying: 1 },
    defenceStars: 0,
    passableGround: true,
  },
  rubble: {
    id: "rubble",
    displayName: "Rubble",
    moveCost: { bipedal: 2, centauroid: 3, flying: 1 },
    defenceStars: 2,
    passableGround: true,
  },
  structure: {
    id: "structure",
    displayName: "Structure / habblock",
    moveCost: { bipedal: 1, centauroid: 2, flying: 1 },
    defenceStars: 3,
    passableGround: true,
  },
  bloom_mat: {
    id: "bloom_mat",
    displayName: "Bloom mat",
    moveCost: { bipedal: 2, centauroid: 2, flying: 1 },
    defenceStars: 1,
    turnStartDamage: 5,
    passableGround: true,
  },
  ridge: {
    id: "ridge",
    displayName: "Ridge / elevated",
    moveCost: { bipedal: 2, centauroid: 3, flying: 1 },
    defenceStars: 4,
    reepsRangeBonus: 1,
    passableGround: true,
  },
  sump: {
    id: "sump",
    displayName: "Water / sump",
    moveCost: { bipedal: Infinity, centauroid: Infinity, flying: 1 },
    defenceStars: 0,
    passableGround: false,
  },
  deploy: {
    id: "deploy",
    displayName: "Deploy pad",
    moveCost: { bipedal: 1, centauroid: 1, flying: 1 },
    defenceStars: 1,
    turnStartRepair: 20,
    passableGround: true,
  },
  spawn: {
    id: "spawn",
    displayName: "Bloom spawn seam",
    moveCost: { bipedal: 1, centauroid: 1, flying: 1 },
    defenceStars: 0,
    passableGround: true,
  },
  exit: {
    id: "exit",
    displayName: "Extraction tile",
    moveCost: { bipedal: 1, centauroid: 1, flying: 1 },
    defenceStars: 1,
    passableGround: true,
  },
  hold: {
    id: "hold",
    displayName: "Hold-zone tile",
    moveCost: { bipedal: 1, centauroid: 1, flying: 1 },
    defenceStars: 2,
    passableGround: true,
  },
  // Protect Asset (Mission 22 "Ash on the Water," 25 Aug 2026) — the
  // Providence's own defended perimeter, MapDefinition.defendZone's tile
  // source, derived by maps.ts's deriveZones exactly like hold/exit/deploy/
  // spawn already are. A hostile standing here at turn-end is what
  // Mission.tickAssetDamage actually counts, not an attack against
  // anything — passable, ordinary cover value, nothing about the tile
  // itself is special beyond marking the zone.
  dock: {
    id: "dock",
    displayName: "Dock perimeter",
    moveCost: { bipedal: 1, centauroid: 1, flying: 1 },
    defenceStars: 2,
    passableGround: true,
  },
  wall: {
    id: "wall",
    displayName: "Blockhouse wall",
    // Impassable to everything, flyers included. Distinct from `structure`,
    // which is passable but slow. GDD §4.6 / Data Pack §7.3.
    moveCost: { bipedal: Infinity, centauroid: Infinity, flying: Infinity },
    defenceStars: 0,
    passableGround: false,
  },
};
