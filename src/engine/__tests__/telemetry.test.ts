// Telemetry pass (1 Sep 2026, claude/Bloom_Wars_Player_Telemetry_Plan_v1.md)
// — the engine counters, the MissionSummary record, and the local stats
// store. Same house style as the rest of this suite: a real Mission from a
// real mission def, quiet board, direct mutation; the store gets a fake
// in-memory CampaignStorage so nothing touches a real localStorage.
import { describe, it, expect, vi, afterEach } from "vitest";
import { Mission } from "../mission";
import { AMARANTH_MISSION_1 } from "../../data/campaignAmaranth";
import { createBloomUnit, createHostileMechUnit, type BattleUnit } from "../units";
import { summarizeMission, summaryMvp } from "../missionSummary";
import {
  appendMissionSummary,
  listMissionSummaries,
  countAttempts,
  clearStats,
  getInstallId,
  exportStatsJson,
  pilotServiceRecords,
  memorial,
  STATS_MAX_RECORDS,
} from "../statsStore";
import { createWardenCampaignState, loadCampaignState, saveCampaignState, type CampaignStorage } from "../campaignState";
import { recordHumanMissionSummary, activeRosterSize } from "../telemetry";

const PARK: Record<string, { x: number; y: number }> = {
  pilot_rourke: { x: 0, y: 0 },
  pilot_bosk: { x: 1, y: 0 },
  pilot_iyari: { x: 2, y: 0 },
  pilot_anand: { x: 3, y: 0 },
  pilot_lask: { x: 4, y: 0 },
};

function quietMission(): Mission {
  const mission = new Mission(AMARANTH_MISSION_1);
  for (const u of mission.units) {
    if (u.side === "hostile") u.downed = true;
    else u.pos = { ...PARK[u.pilotId!] };
  }
  return mission;
}

function pilot(mission: Mission, pilotId: string, pos?: { x: number; y: number }): BattleUnit {
  const u = mission.units.find((x) => x.pilotId === pilotId)!;
  if (pos) u.pos = { ...pos };
  return u;
}

function fakeStorage(): CampaignStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

afterEach(() => vi.restoreAllMocks());

describe("engine counters (damageTaken, abilitiesUsed, hostileKills)", () => {
  it("credits damage taken on the defender and on a countered attacker, and tallies abilities and hostile kills", () => {
    const mission = quietMission();
    vi.spyOn(Math, "random").mockReturnValue(0.99); // no dodges
    const bosk = pilot(mission, "pilot_bosk", { x: 5, y: 6 });
    const hostile = createHostileMechUnit("hostile_mech_02", { x: 6, y: 6 }); // Meeps hostile — counters
    mission.units.push(hostile);
    const out = mission.attack(bosk.instanceId, hostile.instanceId)!;
    expect(out.countered).toBe(true);
    expect(mission.unitPerformance["pilot_bosk"].damageTaken).toBe(out.counterDamage);
    expect(mission.unitPerformance["pilot_bosk"].damageDealt).toBe(out.damage);

    // A Bloom hitting Rourke credits her damageTaken.
    const rourke = pilot(mission, "pilot_rourke", { x: 10, y: 6 });
    const bloom = createBloomUnit("bloom_crawlmass", { x: 11, y: 6 });
    mission.units.push(bloom);
    const hit = (mission as unknown as { resolveAttack: (a: string, d: string) => { damage: number } }).resolveAttack(bloom.instanceId, rourke.instanceId);
    expect(hit.damage).toBeGreaterThan(0);
    expect(mission.unitPerformance["pilot_rourke"].damageTaken).toBe(hit.damage);

    // Abilities: overwatch + repair.
    const lask = pilot(mission, "pilot_lask", { x: 9, y: 6 });
    rourke.currentHp = 30;
    expect(mission.repairUnit(lask.instanceId, rourke.instanceId)).not.toBeNull();
    expect(mission.enterOverwatch(rourke.instanceId)).toBe(true);
    expect(mission.unitPerformance["pilot_lask"].abilitiesUsed["abil_repair"]).toBe(1);
    expect(mission.unitPerformance["pilot_rourke"].abilitiesUsed["overwatch"]).toBe(1);

    // Hostile kills by archetype: collapse the bloom and finish it.
    bloom.endurance = 0;
    bloom.collapsed = true;
    bloom.vitality = 1;
    bloom.currentHp = 1;
    const iyari = pilot(mission, "pilot_iyari", { x: 12, y: 6 });
    iyari.actionsRemaining = 2;
    mission.attack(iyari.instanceId, bloom.instanceId);
    expect(bloom.downed).toBe(true);
    expect(mission.hostileKills["bloom_crawlmass"]).toBe(1);
  });
});

describe("summarizeMission", () => {
  it("builds one row per deployed pilot with the counters, outcome, turns and tags", () => {
    const mission = quietMission();
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const rourke = pilot(mission, "pilot_rourke", { x: 5, y: 6 });
    const bloom = createBloomUnit("bloom_crawlmass", { x: 6, y: 6 });
    mission.units.push(bloom);
    mission.attack(rourke.instanceId, bloom.instanceId);
    mission.permanentLosses.push({ pilotId: "pilot_lask", reason: "test", turn: 1, turnsWithoutMunti: 0, muntisDeployed: 1, wasLastMunti: false });
    const s = summarizeMission(mission, { source: "bot", botTier: "hard", seed: 7, attemptNumber: 2, now: () => new Date("2026-09-01T00:00:00Z") });
    expect(s.v).toBe(1);
    expect(s.source).toBe("bot");
    expect(s.botTier).toBe("hard");
    expect(s.seed).toBe(7);
    expect(s.attemptNumber).toBe(2);
    expect(s.missionId).toBe("mission_amaranth_1");
    expect(s.outcome).toBe("loss"); // ongoing → loss by default
    expect(s.squad.map((p) => p.pilotId)).toEqual(mission.deployedPilotIds);
    const r = s.squad.find((p) => p.pilotId === "pilot_rourke")!;
    expect(r.damageDealt).toBeGreaterThan(0);
    expect(r.path).toBe("meeps");
    expect(s.squad.find((p) => p.pilotId === "pilot_lask")!.permanentlyLost).toBe(true);
    expect(s.finishedAt).toBe("2026-09-01T00:00:00.000Z");
    expect(summaryMvp(s)!.pilotId).toBe("pilot_rourke");
    expect(summarizeMission(mission, { source: "human", outcome: "recalled" }).outcome).toBe("recalled");
  });
});

describe("statsStore", () => {
  it("appends, lists, counts attempts, mints one install id, exports, and clears — all on the injected storage", () => {
    const store = fakeStorage();
    const mission = quietMission();
    expect(listMissionSummaries(store)).toEqual([]);
    const id1 = getInstallId(store);
    expect(id1).toBeTruthy();
    expect(getInstallId(store)).toBe(id1); // stable once minted
    const a = summarizeMission(mission, { source: "human", campaignId: "camp_A", attemptNumber: 1 });
    appendMissionSummary(a, store);
    appendMissionSummary({ ...a, attemptNumber: 2, outcome: "win" }, store);
    appendMissionSummary({ ...a, campaignId: "camp_B" }, store);
    expect(listMissionSummaries(store)).toHaveLength(3);
    expect(countAttempts("camp_A", "mission_amaranth_1", store)).toBe(2);
    expect(countAttempts("camp_B", "mission_amaranth_1", store)).toBe(1);
    expect(countAttempts(undefined, "mission_amaranth_1", store)).toBe(0);
    expect(exportStatsJson(store)).toContain('"records"');
    clearStats(store);
    expect(listMissionSummaries(store)).toEqual([]);
  });

  it("caps the store, dropping the oldest non-win first", () => {
    const store = fakeStorage();
    const mission = quietMission();
    const base = summarizeMission(mission, { source: "human", campaignId: "c" });
    for (let i = 0; i < STATS_MAX_RECORDS + 3; i++) {
      appendMissionSummary({ ...base, attemptNumber: i, outcome: i % 2 === 0 ? "win" : "loss" }, store);
    }
    const kept = listMissionSummaries(store);
    expect(kept).toHaveLength(STATS_MAX_RECORDS);
    expect(kept[0].attemptNumber).toBe(0); // the oldest WIN survived; the oldest losses went first
  });

  it("reads a corrupt blob as empty rather than throwing", () => {
    const store = fakeStorage();
    store.setItem("bloomwars_stats_v1", "{not json");
    expect(listMissionSummaries(store)).toEqual([]);
    expect(getInstallId(store)).toBeTruthy();
  });

  it("service records and memorial roll up across records for one campaign", () => {
    const store = fakeStorage();
    const mission = quietMission();
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const rourke = pilot(mission, "pilot_rourke", { x: 5, y: 6 });
    const bloom = createBloomUnit("bloom_crawlmass", { x: 6, y: 6 });
    mission.units.push(bloom);
    mission.attack(rourke.instanceId, bloom.instanceId);
    rourke.actionsRemaining = 2; // attack zeroes the budget; give it back so overwatch is legal
    expect(mission.enterOverwatch(rourke.instanceId)).toBe(true);
    mission.permanentLosses.push({ pilotId: "pilot_anand", reason: "test", turn: 1, turnsWithoutMunti: 0, muntisDeployed: 1, wasLastMunti: false });
    const s1 = summarizeMission(mission, { source: "human", campaignId: "c", outcome: "win", now: () => new Date("2026-09-01T01:00:00Z") });
    const s2 = { ...s1, outcome: "loss" as const, finishedAt: "2026-09-01T02:00:00.000Z" };
    appendMissionSummary(s1, store);
    appendMissionSummary(s2, store);
    appendMissionSummary({ ...s1, campaignId: "other" }, store);
    const recs = pilotServiceRecords("c", store);
    expect(recs["pilot_rourke"].missionsFlown).toBe(2);
    expect(recs["pilot_rourke"].wins).toBe(1);
    expect(recs["pilot_rourke"].damageDealt).toBeGreaterThan(0);
    expect(recs["pilot_rourke"].favoriteAbility).toBe("overwatch");
    const fallen = memorial("c", store);
    expect(fallen.map((r) => r.pilotId)).toEqual(["pilot_anand"]);
    expect(fallen[0].permanentlyLost!.missionId).toBe("mission_amaranth_1");
    expect(fallen[0].permanentlyLost!.finishedAt).toBe("2026-09-01T01:00:00.000Z"); // first record it fell in
  });
});

describe("recordHumanMissionSummary + campaignId backfill", () => {
  it("a fresh campaign carries a campaignId, an old save gets one on load, and roster size counts only active pilots", () => {
    const fresh = createWardenCampaignState();
    expect(fresh.campaignId).toBeTruthy();
    const store = fakeStorage();
    const old = { ...fresh };
    delete (old as { campaignId?: string }).campaignId;
    saveCampaignState(old, store);
    const loaded = loadCampaignState(store)!;
    expect(loaded.campaignId).toBeTruthy();
    expect(activeRosterSize(loaded)).toBe(Object.keys(loaded.pilots).length);
    loaded.pilots["pilot_lask"].status = "permanently_lost";
    expect(activeRosterSize(loaded)).toBe(Object.keys(loaded.pilots).length - 1);
  });

  it("returns a record and never throws, even with no storage at all", () => {
    const mission = quietMission();
    const state = createWardenCampaignState();
    const rec = recordHumanMissionSummary(mission, state, { outcome: "commander_down", pointsBefore: 10, pointsAfter: 10 });
    expect(rec).not.toBeNull();
    expect(rec!.outcome).toBe("commander_down");
    expect(rec!.campaignId).toBe(state.campaignId);
    expect(rec!.attemptNumber).toBe(1); // no storage under Node → no prior attempts counted
  });
});
