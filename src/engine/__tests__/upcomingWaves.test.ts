// Reinforcement warning (30 Sep 2026, WePlaytestGames playtest: the tester was
// "surprised by 22 enemies"). Mission.upcomingWaves() tells Battle which tiles
// hostiles land on next turn. These tests pin the two promises it makes:
// it matches what actually spawns, and it never flags a burrowed wave.
// Same real-def pattern as mirrorDeployment.test.ts.
import { describe, it, expect } from "vitest";
import { Mission } from "../mission";
import { AMARANTH_MISSION_20 } from "../../data/campaignAmaranth";
import type { CampaignMission, EnemyWave } from "../../data/types";

function missionWith(enemyWaves: EnemyWave[]): CampaignMission {
  return { ...AMARANTH_MISSION_20, playerPilotIds: AMARANTH_MISSION_20.playerPilotIds.slice(0, 4), enemyWaves };
}

const hostiles = (m: Mission) => m.livingUnits().filter((u) => u.side === "hostile").length;

describe("Mission.upcomingWaves — reinforcement warning", () => {
  it("is empty when nothing is scheduled for next turn", () => {
    const m = new Mission(missionWith([{ archetypeId: "bloom_crawlmass", count: 2, atTurn: 1, spawnAt: "enemy_deploy" }]));
    expect(m.upcomingWaves()).toEqual({ tiles: [], count: 0 });
  });

  it("reports next turn's wave, and the count matches what actually spawns", () => {
    const def = missionWith([
      { archetypeId: "bloom_crawlmass", count: 1, atTurn: 1, spawnAt: "enemy_deploy" },
      { archetypeId: "bloom_crawlmass", count: 3, atTurn: 2, spawnAt: "enemy_deploy" },
    ]);
    const m = new Mission(def);
    const up = m.upcomingWaves();
    expect(up.count).toBe(3);
    expect(up.tiles.length).toBeGreaterThan(0);
    expect(up.tiles.length).toBeLessThanOrEqual(3);
    const before = hostiles(m);
    m.endPlayerTurn();
    expect(m.turn).toBe(2);
    expect(hostiles(m)).toBe(before + 3);
  });

  it("uses a wave's own landing tiles, deduplicated", () => {
    const at = [{ x: 1, y: 1 }, { x: 2, y: 1 }];
    const m = new Mission(missionWith([
      { archetypeId: "bloom_crawlmass", count: 5, atTurn: 2, spawnAt: at },
      { archetypeId: "bloom_crawlmass", count: 1, atTurn: 2, spawnAt: [{ x: 1, y: 1 }] },
    ]));
    const up = m.upcomingWaves();
    expect(up.count).toBe(6);
    expect(up.tiles).toEqual(at);
  });

  it("never flags a burrowed wave", () => {
    const m = new Mission(missionWith([{ archetypeId: "bloom_crawlmass", count: 2, atTurn: 2, spawnAt: "enemy_deploy", burrowed: true }]));
    expect(m.upcomingWaves()).toEqual({ tiles: [], count: 0 });
  });
});
