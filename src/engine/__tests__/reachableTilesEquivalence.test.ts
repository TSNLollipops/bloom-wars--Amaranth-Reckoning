// reachableTiles was rewritten for speed on 1 Sep 2026 (tiers pass — it was
// half of every headless sim's CPU time) with the explicit promise that
// NOTHING observable changes: same costs, same cameFrom, same Map insertion
// order, because callers tie-break by iteration order and read path shape
// (isStraightLineCharge). This test keeps the original algorithm verbatim
// as the reference and compares the two on every campaign map from every
// passable start tile with a scattering of blockers, for each movement
// kind and several budgets. If someone "improves" the flood fill again,
// this is what tells them whether a mission's numbers will move.
import { describe, it, expect } from "vitest";
import type { Coord, MapDefinition } from "../../data/types";
import { reachableTiles, coordKey, isPassable, moveCost, type MovementKind } from "../grid";
import { ALL_MISSIONS_BY_ID } from "../../data/allCampaigns";
import { Mission } from "../mission";

const CARDINAL: Coord[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

/** The pre-1-Sep implementation, byte-for-byte in behaviour. */
function referenceReachableTiles(map: MapDefinition, start: Coord, budget: number, kind: MovementKind, occupied: Set<string>): Map<string, { cost: number; cameFrom: Coord | null }> {
  const best = new Map<string, { cost: number; cameFrom: Coord | null }>();
  best.set(coordKey(start), { cost: 0, cameFrom: null });
  let improved = true;
  while (improved) {
    improved = false;
    for (const [key, entry] of best) {
      const [x, y] = key.split(",").map(Number);
      for (const d of CARDINAL) {
        const next = { x: x + d.x, y: y + d.y };
        if (!isPassable(map, next, kind)) continue;
        const nextKey = coordKey(next);
        if (occupied.has(nextKey) && nextKey !== coordKey(start)) continue;
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

function sameMap(a: Map<string, { cost: number; cameFrom: Coord | null }>, b: Map<string, { cost: number; cameFrom: Coord | null }>): boolean {
  if (a.size !== b.size) return false;
  const ka = [...a.keys()];
  const kb = [...b.keys()];
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] !== kb[i]) return false; // insertion order is part of the contract
    const ea = a.get(ka[i])!;
    const eb = b.get(kb[i])!;
    if (ea.cost !== eb.cost) return false;
    if ((ea.cameFrom === null) !== (eb.cameFrom === null)) return false;
    if (ea.cameFrom && eb.cameFrom && (ea.cameFrom.x !== eb.cameFrom.x || ea.cameFrom.y !== eb.cameFrom.y)) return false;
  }
  return true;
}

// Deterministic blocker scatter so the test is reproducible.
function blockers(map: MapDefinition, seed: number): Set<string> {
  const s = new Set<string>();
  let x = seed;
  for (let i = 0; i < 6; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    s.add(`${x % map.width},${(x >> 8) % map.height}`);
  }
  return s;
}

describe("reachableTiles rewrite ≡ original algorithm", () => {
  const maps = new Map<string, MapDefinition>();
  for (const def of Object.values(ALL_MISSIONS_BY_ID)) {
    const m = new Mission(def);
    maps.set(m.map.id, m.map);
  }

  it("covers every campaign map", () => {
    expect(maps.size).toBeGreaterThan(10);
  });

  for (const [id, map] of maps) {
    // The reference is the slow original; a fifth of the start tiles and
    // two budgets keep the whole file to a few seconds while still walking
    // every map's terrain from many angles.
    it(`${id}: identical costs, predecessors and iteration order across starts, kinds and budgets`, () => {
      const kinds: MovementKind[] = ["bipedal", "centauroid", "flying"];
      let checked = 0;
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          if ((x * 7 + y * 3) % 5 !== 0) continue;
          const start = { x, y };
          for (const kind of kinds) {
            if (!isPassable(map, start, kind)) continue;
            for (const budget of [3, Infinity]) {
              const occ = blockers(map, x * 31 + y * 7 + budget);
              const a = reachableTiles(map, start, budget, kind, occ);
              const b = referenceReachableTiles(map, start, budget, kind, occ);
              if (!sameMap(a, b)) {
                throw new Error(`${id}: mismatch at start ${x},${y} kind ${kind} budget ${budget}`);
              }
              checked += 1;
            }
          }
        }
      }
      expect(checked).toBeGreaterThan(0);
    }, 60000);
  }
});
