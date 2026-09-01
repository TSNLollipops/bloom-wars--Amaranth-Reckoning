// "Mirror deployment" (30 Aug 2026 — Maxime, Mission 20: "could do with a
// full mirror deployement on the enemy side instead of a preplanned spawn.
// they were less numerous than I"). See EnemyWave.mirrorPlayerSquad's own
// comment (data/types.ts) and Mission.resolveMirrorCounts's own comment
// (engine/mission.ts) for the full design: a mirrorPlayerSquad wave's
// `count` becomes a WEIGHT, shared only with other mirrorPlayerSquad waves
// at the same atTurn, and the actual spawn counts are however many mechs
// the player deployed (Mission.deployedPilotIds.length), split
// proportionally with largest-remainder rounding so the total always comes
// out exact.
//
// House style: real Mission objects built from a real mission def
// (AMARANTH_MISSION_20, spread with a synthetic enemyWaves/playerPilotIds
// override) rather than a from-scratch fixture — same pattern as
// civilianExtraction.test.ts's quietConvoyMission(). playerPilotIds is
// sliced from AMARANTH_MISSION_20's own real array so every id resolves
// through the real pilot registry without this file needing to know any
// pilot id itself.
import { describe, it, expect } from "vitest";
import { Mission } from "../mission";
import { AMARANTH_MISSION_20 } from "../../data/campaignAmaranth";
import type { CampaignMission, EnemyWave } from "../../data/types";

function missionWith(pilotCount: number, enemyWaves: EnemyWave[]): CampaignMission {
  return {
    ...AMARANTH_MISSION_20,
    playerPilotIds: AMARANTH_MISSION_20.playerPilotIds.slice(0, pilotCount),
    enemyWaves,
  };
}

// Counts by the WAVE's own archetypeId (e.g. "hostile_mech_amaranth_01"),
// not BattleUnit.archetypeId — createHostileMechUnit resolves every hostile
// mech to one of the shared class archetypes ("arch_tank_bipedal" etc, Data
// Pack §9's "all four use the standard bipedal archetypes"), so the wave's
// own id only survives on the unit as instanceId's prefix
// (engine/units.ts's nextInstanceId(hostileMechId)).
function hostileCountsByWaveId(mission: Mission, waveIds: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const u of mission.units) {
    if (u.side !== "hostile") continue;
    const match = waveIds.find((id) => u.instanceId.startsWith(`${id}_`));
    if (match) counts[match] = (counts[match] ?? 0) + 1;
  }
  return counts;
}

describe("EnemyWave.mirrorPlayerSquad — spawn count resolution", () => {
  it("two equal-weight mirror waves split an even squad size evenly", () => {
    const def = missionWith(10, [
      { archetypeId: "hostile_mech_amaranth_01", count: 1, atTurn: 1, spawnAt: "enemy_deploy", mirrorPlayerSquad: true },
      { archetypeId: "hostile_mech_amaranth_04", count: 1, atTurn: 1, spawnAt: "enemy_deploy", mirrorPlayerSquad: true },
    ]);
    const mission = new Mission(def);
    const counts = hostileCountsByWaveId(mission, ["hostile_mech_amaranth_01", "hostile_mech_amaranth_04"]);
    expect(counts["hostile_mech_amaranth_01"]).toBe(5);
    expect(counts["hostile_mech_amaranth_04"]).toBe(5);
  });

  it("uneven weights split proportionally, not evenly", () => {
    const def = missionWith(8, [
      { archetypeId: "hostile_mech_amaranth_01", count: 3, atTurn: 1, spawnAt: "enemy_deploy", mirrorPlayerSquad: true },
      { archetypeId: "hostile_mech_amaranth_04", count: 1, atTurn: 1, spawnAt: "enemy_deploy", mirrorPlayerSquad: true },
    ]);
    const mission = new Mission(def);
    const counts = hostileCountsByWaveId(mission, ["hostile_mech_amaranth_01", "hostile_mech_amaranth_04"]);
    expect(counts["hostile_mech_amaranth_01"]).toBe(6); // 3/4 of 8
    expect(counts["hostile_mech_amaranth_04"]).toBe(2); // 1/4 of 8
  });

  it("largest-remainder rounding keeps the total exact even when the split isn't even", () => {
    const def = missionWith(5, [
      { archetypeId: "hostile_mech_amaranth_01", count: 1, atTurn: 1, spawnAt: "enemy_deploy", mirrorPlayerSquad: true },
      { archetypeId: "hostile_mech_amaranth_02", count: 1, atTurn: 1, spawnAt: "enemy_deploy", mirrorPlayerSquad: true },
      { archetypeId: "hostile_mech_amaranth_03", count: 1, atTurn: 1, spawnAt: "enemy_deploy", mirrorPlayerSquad: true },
    ]);
    const mission = new Mission(def);
    const counts = hostileCountsByWaveId(mission, ["hostile_mech_amaranth_01", "hostile_mech_amaranth_02", "hostile_mech_amaranth_03"]);
    const total = (counts["hostile_mech_amaranth_01"] ?? 0) + (counts["hostile_mech_amaranth_02"] ?? 0) + (counts["hostile_mech_amaranth_03"] ?? 0);
    expect(total).toBe(5); // never off by a rounding error — 5/3 floors to 1 each (3 total), the 2 leftover go to two of the three waves
  });

  it("a non-mirrored wave at the same turn keeps its own literal count untouched", () => {
    const def = missionWith(10, [
      { archetypeId: "hostile_mech_marrow", count: 1, atTurn: 1, spawnAt: [{ x: 23, y: 7 }] }, // fixed boss anchor, no mirrorPlayerSquad
      { archetypeId: "hostile_mech_amaranth_01", count: 1, atTurn: 1, spawnAt: "enemy_deploy", mirrorPlayerSquad: true },
    ]);
    const mission = new Mission(def);
    const counts = hostileCountsByWaveId(mission, ["hostile_mech_marrow", "hostile_mech_amaranth_01"]);
    expect(counts["hostile_mech_marrow"]).toBe(1); // untouched by the squad-size math
    expect(counts["hostile_mech_amaranth_01"]).toBe(10); // sole mirror wave gets the whole squad size
  });

  it("mirror waves at a different atTurn resolve independently, each against the same deployedPilotIds.length", () => {
    const def = missionWith(6, [
      { archetypeId: "hostile_mech_amaranth_01", count: 1, atTurn: 1, spawnAt: "enemy_deploy", mirrorPlayerSquad: true },
      { archetypeId: "hostile_mech_amaranth_02", count: 1, atTurn: 3, spawnAt: "enemy_deploy", mirrorPlayerSquad: true },
    ]);
    const mission = new Mission(def);
    const ids = ["hostile_mech_amaranth_01", "hostile_mech_amaranth_02"];
    expect(hostileCountsByWaveId(mission, ids)["hostile_mech_amaranth_01"]).toBe(6);
    expect(hostileCountsByWaveId(mission, ids)["hostile_mech_amaranth_02"]).toBeUndefined(); // hasn't spawned yet — atTurn 3
    mission.endPlayerTurn();
    mission.endPlayerTurn();
    expect(hostileCountsByWaveId(mission, ids)["hostile_mech_amaranth_02"]).toBe(6); // same squad size, resolved fresh at its own turn
  });

  it("a single mirror wave alone gets the full squad size, no weight math needed", () => {
    const def = missionWith(3, [{ archetypeId: "hostile_mech_amaranth_01", count: 1, atTurn: 1, spawnAt: "enemy_deploy", mirrorPlayerSquad: true }]);
    const mission = new Mission(def);
    expect(hostileCountsByWaveId(mission, ["hostile_mech_amaranth_01"])["hostile_mech_amaranth_01"]).toBe(3);
  });
});

describe("EnemyWave.mirrorScale — 30 Aug 2026, Mission 20's real sim regression", () => {
  it("omitted mirrorScale behaves exactly as before this field existed — target === deployedPilotIds.length", () => {
    const def = missionWith(10, [{ archetypeId: "hostile_mech_amaranth_01", count: 1, atTurn: 1, spawnAt: "enemy_deploy", mirrorPlayerSquad: true }]);
    const mission = new Mission(def);
    expect(hostileCountsByWaveId(mission, ["hostile_mech_amaranth_01"])["hostile_mech_amaranth_01"]).toBe(10);
  });

  it("a fractional mirrorScale multiplies the target before the largest-remainder split", () => {
    const def = missionWith(10, [{ archetypeId: "hostile_mech_amaranth_01", count: 1, atTurn: 1, spawnAt: "enemy_deploy", mirrorPlayerSquad: true, mirrorScale: 0.6 }]);
    const mission = new Mission(def);
    // round(10 * 0.6) = 6
    expect(hostileCountsByWaveId(mission, ["hostile_mech_amaranth_01"])["hostile_mech_amaranth_01"]).toBe(6);
  });

  it("mirrorScale still splits proportionally across multiple mirror waves, total unaffected by which wave carries the field", () => {
    const def = missionWith(10, [
      { archetypeId: "hostile_mech_amaranth_01", count: 1, atTurn: 1, spawnAt: "enemy_deploy", mirrorPlayerSquad: true, mirrorScale: 0.5 },
      { archetypeId: "hostile_mech_amaranth_04", count: 1, atTurn: 1, spawnAt: "enemy_deploy", mirrorPlayerSquad: true },
    ]);
    const mission = new Mission(def);
    const counts = hostileCountsByWaveId(mission, ["hostile_mech_amaranth_01", "hostile_mech_amaranth_04"]);
    // round(10 * 0.5) = 5, split evenly across the two equal-weight waves
    expect((counts["hostile_mech_amaranth_01"] ?? 0) + (counts["hostile_mech_amaranth_04"] ?? 0)).toBe(5);
  });

  it("rounds to the nearest integer, not floor/ceil, when the scaled target isn't whole", () => {
    const def = missionWith(9, [{ archetypeId: "hostile_mech_amaranth_01", count: 1, atTurn: 1, spawnAt: "enemy_deploy", mirrorPlayerSquad: true, mirrorScale: 0.6 }]);
    const mission = new Mission(def);
    // 9 * 0.6 = 5.4 -> rounds to 5
    expect(hostileCountsByWaveId(mission, ["hostile_mech_amaranth_01"])["hostile_mech_amaranth_01"]).toBe(5);
  });
});
