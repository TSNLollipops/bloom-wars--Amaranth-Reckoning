// Live mission briefing data — unit tests. Codex Rebuild & Live Briefing
// Plan v1, Part B. Pure module, no engine/Phaser imports (same purity rule
// every other src/data/** test already follows — see hotTopics.test.ts's
// own header) — nextWardenMission takes a plain { missionId } shape rather
// than a real CampaignState, so these tests build that shape by hand
// instead of importing engine/campaignState.ts.
import { describe, it, expect } from "vitest";
import {
  nextWardenMission,
  describeObjective,
  passiveScan,
  WARDEN_MISSION_ORDER,
  wardenMissionIndex,
  highestWardenMissionIndexReached,
} from "../missionBriefing";
import type { CampaignMission } from "../types";

function makeMission(overrides: Partial<CampaignMission> = {}): CampaignMission {
  return {
    id: "test_mission",
    displayName: "Test Mission",
    mapId: "test_map",
    briefing: "A test mission, for testing purposes.",
    objective: "eliminate_all",
    objectiveParams: { turnLimit: 10 },
    playerPilotIds: [],
    enemyWaves: [],
    events: [],
    rewardPoints: 100,
    heirloomCharge: "locked",
    ...overrides,
  };
}

describe("nextWardenMission", () => {
  it("returns Mission 1 when there's no echo yet (a brand-new campaign)", () => {
    const result = nextWardenMission(undefined);
    expect(result).toBe(WARDEN_MISSION_ORDER[0]);
  });

  it("returns the mission right after the one named in the echo", () => {
    const midIndex = 5;
    const echo = { missionId: WARDEN_MISSION_ORDER[midIndex].id };
    const result = nextWardenMission(echo);
    expect(result).toBe(WARDEN_MISSION_ORDER[midIndex + 1]);
  });

  it("returns null once the echo names the final mission — campaign complete", () => {
    const last = WARDEN_MISSION_ORDER[WARDEN_MISSION_ORDER.length - 1];
    const result = nextWardenMission({ missionId: last.id });
    expect(result).toBeNull();
  });

  it("falls back to Mission 1 for an unrecognized mission id rather than guessing", () => {
    const result = nextWardenMission({ missionId: "not_a_real_mission_id" });
    expect(result).toBe(WARDEN_MISSION_ORDER[0]);
  });

  it("every mission in the order is reachable by walking next-mission forward from the start", () => {
    // A cheap end-to-end sanity check on the whole 36-mission concatenation:
    // walking nextWardenMission from "no echo" all the way to null should
    // visit every mission in WARDEN_MISSION_ORDER exactly once, in order —
    // catches an accidental duplicate id or an out-of-order concatenation
    // that a single-mission spot-check above wouldn't.
    const visited: string[] = [];
    let echo: { missionId: string } | undefined = undefined;
    for (let guard = 0; guard < WARDEN_MISSION_ORDER.length + 1; guard++) {
      const mission = nextWardenMission(echo);
      if (!mission) break;
      visited.push(mission.id);
      echo = { missionId: mission.id };
    }
    expect(visited).toEqual(WARDEN_MISSION_ORDER.map((m) => m.id));
  });
});

describe("describeObjective", () => {
  it("eliminate_all — no turn limit framing", () => {
    const m = makeMission({ objective: "eliminate_all", objectiveParams: { turnLimit: 12 } });
    expect(describeObjective(m)).toMatch(/Eliminate every hostile/);
    expect(describeObjective(m)).not.toMatch(/turn 12/);
  });

  it("hold_zone — uses holdUntilTurn when set", () => {
    const m = makeMission({ objective: "hold_zone", objectiveParams: { turnLimit: 10, holdUntilTurn: 6 } });
    const line = describeObjective(m);
    expect(line).toContain("turn 6");
    expect(line).toContain("turn 10");
  });

  it("hold_zone — falls back to turnLimit when holdUntilTurn is unset", () => {
    const m = makeMission({ objective: "hold_zone", objectiveParams: { turnLimit: 8 } });
    const line = describeObjective(m);
    // Both mentions collapse onto the same turn number.
    expect(line.match(/turn 8/g)?.length).toBe(2);
  });

  it("extract_unit — named-unit phrasing when extractThreshold is unset", () => {
    const m = makeMission({ objective: "extract_unit", objectiveParams: { turnLimit: 10, extractUnitId: "npc_1" } });
    expect(describeObjective(m)).toMatch(/Get the named unit/);
  });

  it("extract_unit — civilian-threshold phrasing when extractThreshold is set", () => {
    const m = makeMission({ objective: "extract_unit", objectiveParams: { turnLimit: 10, extractThreshold: 3 } });
    const line = describeObjective(m);
    expect(line).toContain("at least 3");
    expect(line).toMatch(/civilians/);
  });

  it("clear_bloom — no turn limit framing", () => {
    const m = makeMission({ objective: "clear_bloom", objectiveParams: { turnLimit: 10 } });
    expect(describeObjective(m)).toMatch(/Clear every bloom mat tile/);
  });

  it("survive_n_turns — names the survive-until turn", () => {
    const m = makeMission({ objective: "survive_n_turns", objectiveParams: { turnLimit: 9 } });
    expect(describeObjective(m)).toContain("turn 9");
  });

  it("contested_landing — no grace period framing", () => {
    const m = makeMission({ objective: "contested_landing", objectiveParams: { turnLimit: 10 } });
    expect(describeObjective(m)).toMatch(/no grace period/);
  });

  it("protect_asset — uses assetName when set, defaults to Providence otherwise", () => {
    const named = makeMission({ objective: "protect_asset", objectiveParams: { turnLimit: 10, assetName: "The Cistern" } });
    expect(describeObjective(named)).toContain("The Cistern");

    const defaulted = makeMission({ objective: "protect_asset", objectiveParams: { turnLimit: 10 } });
    expect(describeObjective(defaulted)).toContain("Providence");
  });
});

describe("passiveScan", () => {
  it("reports no signatures when a mission has no enemyWaves at all", () => {
    const m = makeMission({ enemyWaves: [] });
    expect(passiveScan(m)).toMatch(/no hostile signatures/);
  });

  it("singular phrasing for a lone boss-style wave (count 1)", () => {
    const m = makeMission({ enemyWaves: [{ archetypeId: "bloom_wellroot", count: 1, atTurn: 1, spawnAt: "enemy_deploy" }] });
    expect(passiveScan(m)).toBe("Scans show a single hostile signature: The Wellroot.");
  });

  it("uniform composition — all one archetype", () => {
    const m = makeMission({ enemyWaves: [{ archetypeId: "bloom_crawlmass", count: 6, atTurn: 1, spawnAt: "enemy_deploy" }] });
    expect(passiveScan(m)).toBe("Scans show roughly 6 hostiles, all Crawlmass.");
  });

  it("mixed composition — sums counts per archetype across multiple waves and joins with Oxford comma", () => {
    const m = makeMission({
      enemyWaves: [
        { archetypeId: "bloom_crawlmass", count: 8, atTurn: 1, spawnAt: "enemy_deploy" },
        { archetypeId: "bloom_splitfang", count: 2, atTurn: 1, spawnAt: "enemy_deploy" },
        { archetypeId: "bloom_crawlmass", count: 2, atTurn: 4, spawnAt: "enemy_deploy" }, // same archetype, later wave — should merge into the first
      ],
    });
    const line = passiveScan(m);
    expect(line).toBe("Scans show roughly 12 hostiles, mixed Crawlmass and Splitfang.");
  });

  it("three-or-more archetypes use a full Oxford-comma join", () => {
    const m = makeMission({
      enemyWaves: [
        { archetypeId: "bloom_crawlmass", count: 5, atTurn: 1, spawnAt: "enemy_deploy" },
        { archetypeId: "bloom_splitfang", count: 3, atTurn: 1, spawnAt: "enemy_deploy" },
        { archetypeId: "bloom_undertow", count: 2, atTurn: 1, spawnAt: "enemy_deploy" },
      ],
    });
    expect(passiveScan(m)).toBe("Scans show roughly 10 hostiles, mixed Crawlmass, Splitfang, and Undertow.");
  });

  it("never reads mission.events — scripted reinforcements/ambushes stay unspoiled", () => {
    const m = makeMission({
      enemyWaves: [{ archetypeId: "bloom_crawlmass", count: 4, atTurn: 1, spawnAt: "enemy_deploy" }],
      events: [
        {
          id: "ambush",
          trigger: { type: "turn_start", turn: 3 },
          action: { type: "spawn", archetypeIds: ["bloom_undertow"], at: [{ x: 0, y: 0 }] },
          once: true,
        },
      ],
    });
    expect(passiveScan(m)).toBe("Scans show roughly 4 hostiles, all Crawlmass.");
  });

  it("falls back to the raw archetype id if neither BLOOM nor ALL_HOSTILE_MECHS has an entry for it (defensive, shouldn't happen in real data)", () => {
    const m = makeMission({ enemyWaves: [{ archetypeId: "bloom_does_not_exist", count: 1, atTurn: 1, spawnAt: "enemy_deploy" }] });
    expect(passiveScan(m)).toBe("Scans show a single hostile signature: bloom_does_not_exist.");
  });

  it("resolves named hostile-mech archetypes too, not just Bloom creatures (Mission 6's House Amaranth line troopers)", () => {
    const m = makeMission({
      enemyWaves: [
        { archetypeId: "hostile_mech_amaranth_01", count: 1, atTurn: 1, spawnAt: "enemy_deploy" },
        { archetypeId: "hostile_mech_amaranth_02", count: 1, atTurn: 1, spawnAt: "enemy_deploy" },
        { archetypeId: "hostile_mech_amaranth_03", count: 1, atTurn: 1, spawnAt: "enemy_deploy" },
        { archetypeId: "hostile_mech_amaranth_04", count: 1, atTurn: 1, spawnAt: "enemy_deploy" },
        { archetypeId: "hostile_mech_amaranth_01", count: 1, atTurn: 7, spawnAt: "enemy_deploy" },
      ],
    });
    // All five waves are "House Amaranth Line Trooper" under different
    // archetype ids (four distinct pilots, one path each) — they merge into
    // one composition bucket by displayName's own count, same as any other
    // uniform-composition mission.
    expect(passiveScan(m)).toBe("Scans show roughly 5 hostiles, all House Amaranth Line Trooper.");
  });

  it("mixes Bloom and hostile-mech archetypes in the same scan", () => {
    const m = makeMission({
      enemyWaves: [
        { archetypeId: "bloom_crawlmass", count: 6, atTurn: 1, spawnAt: "enemy_deploy" },
        { archetypeId: "hostile_mech_amaranth_01", count: 1, atTurn: 1, spawnAt: "enemy_deploy" },
      ],
    });
    expect(passiveScan(m)).toBe("Scans show roughly 7 hostiles, mixed Crawlmass and House Amaranth Line Trooper.");
  });
});

describe("WARDEN_MISSION_ORDER", () => {
  it("has 36 missions, no duplicate ids", () => {
    expect(WARDEN_MISSION_ORDER.length).toBe(36);
    const ids = new Set(WARDEN_MISSION_ORDER.map((m) => m.id));
    expect(ids.size).toBe(36);
  });
});

describe("wardenMissionIndex", () => {
  it("finds the 0-based position of a real mission id", () => {
    expect(wardenMissionIndex(WARDEN_MISSION_ORDER[0].id)).toBe(0);
    expect(wardenMissionIndex(WARDEN_MISSION_ORDER[5].id)).toBe(5);
    expect(wardenMissionIndex(WARDEN_MISSION_ORDER[35].id)).toBe(35);
  });

  it("returns -1 for an id that isn't in the Warden order", () => {
    expect(wardenMissionIndex("not_a_real_mission_id")).toBe(-1);
  });
});

describe("highestWardenMissionIndexReached", () => {
  it("returns -1 when there's no echo yet (a brand-new campaign)", () => {
    expect(highestWardenMissionIndexReached(undefined)).toBe(-1);
  });

  it("returns the echoed mission's own index, whether it was a win or a loss", () => {
    const echoed = WARDEN_MISSION_ORDER[10].id;
    expect(highestWardenMissionIndexReached({ missionId: echoed })).toBe(10);
  });

  it("falls back to -1 for an unrecognized echoed id rather than guessing", () => {
    expect(highestWardenMissionIndexReached({ missionId: "not_a_real_mission_id" })).toBe(-1);
  });
});
