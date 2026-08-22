// Shared fixtures for the combat validation suite. Synthetic units/maps —
// deliberately NOT the real archetypes/maps, so these tests isolate the
// resolver formula itself against Data Pack §13 / sim_output.txt, the way
// combat_sim.py's reference implementation does.
import type { MapDefinition, Path, TileType } from "../../data/types";
import type { BattleUnit } from "../units";
import { MAX_ACTIONS_PER_TURN } from "../../data/combatTables";

export function makeUniformMap(tile: TileType, width = 6, height = 6): MapDefinition {
  return {
    id: "test_map",
    name: "Test Map",
    width,
    height,
    tiles: Array.from({ length: height }, () => Array.from({ length: width }, () => tile)),
    deployZones: { player: [], enemy: [] },
  };
}

let idCounter = 0;

export function testUnit(
  path: Path,
  pos = { x: 0, y: 0 },
  opts?: { tierAttack?: number; tierDefense?: number; hp?: number; maxHp?: number }
): BattleUnit {
  idCounter += 1;
  const canCounter = path !== "reeps";
  return {
    instanceId: `test_${path}_${idCounter}`,
    side: "player",
    kind: "pilot",
    archetypeId: `arch_${path}_bipedal`,
    displayName: `Test ${path}`,
    pos,
    path,
    currentHp: opts?.hp ?? opts?.maxHp ?? 100,
    maxHp: opts?.maxHp ?? 100,
    effectiveAttack: opts?.tierAttack ?? 100,
    effectiveDefense: opts?.tierDefense ?? 100,
    moveRange: 4,
    attackRange: [1, 1],
    vision: 4,
    canCounter,
    counterMaxRange: canCounter ? 1 : 0,
    abilities: [],
    downed: false,
    actionsRemaining: MAX_ACTIONS_PER_TURN,
    chargedThisMove: false,
    statusEffects: [],
    usedEvacThisMission: false,
    spriteKey: "test",
  };
}
