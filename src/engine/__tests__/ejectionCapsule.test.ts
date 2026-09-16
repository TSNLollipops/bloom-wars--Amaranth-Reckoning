// src/engine/__tests__/ejectionCapsule.test.ts
// Ejection capsules (15 Sep 2026). Maxime: "lets make all death leave a
// capsule player have to click with munties to save." Rules pinned here are
// the ones he picked in the two popups that day — see EjectionCapsule's own
// header in engine/mission.ts.
//
// Roster reference (MISSION_1A): pilot_thyns (Tank), pilot_barasj (the only
// Munti), pilot_nagori (Meeps), pilot_tourignie (Reeps). AMARANTH_MISSION_1
// carries Rourke, the commander.
import { describe, it, expect, vi, afterEach } from "vitest";
import { Mission } from "../mission";
import { createHostileMechUnit, createBloomUnit, type BattleUnit } from "../units";
import { MISSION_1A } from "../../data/campaign";
import { AMARANTH_MISSION_1 } from "../../data/campaignAmaranth";
import { MAX_ACTIONS_PER_TURN } from "../../data/combatTables";
import { decidePlayerAiAction, resetPlayerAiLog, playerAiLog } from "../../sim/playerAi";
import { createWardenCampaignState, ransomPrisoner, recruitPrisoner, PRISONER_RANSOM_POINTS } from "../campaignState";

afterEach(() => vi.restoreAllMocks());

/** A board with nothing hostile on it except one inert keeper far away, so nothing ends early and nothing wanders in. */
function quietMission(def = MISSION_1A): Mission {
  const mission = new Mission(def);
  for (const u of mission.units) if (u.side === "hostile") u.downed = true;
  const keeper = createHostileMechUnit("hostile_mech_01", { x: 0, y: 0 });
  keeper.vision = 0;
  keeper.moveRange = 0;
  keeper.attackRange = [99, 99];
  mission.units.push(keeper);
  return mission;
}

function pilot(mission: Mission, pilotId: string): BattleUnit {
  return mission.units.find((u) => u.pilotId === pilotId)!;
}

/** Downs `target` through the real attack path (so handleDowned runs), from a throwaway hostile placed next to it. */
function killPlayer(mission: Mission, target: BattleUnit): void {
  const hitter = createHostileMechUnit("hostile_mech_01", { x: target.pos.x + 1, y: target.pos.y });
  hitter.attackPower = 9999;
  mission.units.push(hitter);
  target.currentHp = 1;
  vi.spyOn(Math, "random").mockReturnValue(0.99); // no dodge
  const out = mission.attack(hitter.instanceId, target.instanceId);
  vi.restoreAllMocks();
  expect(out?.defenderDowned).toBe(true);
  hitter.downed = true; // off the board again, no capsule (it never went through handleDowned)
}

/** Downs `hostile` through the real attack path, from `shooter`. */
function killHostile(mission: Mission, shooter: BattleUnit, hostile: BattleUnit): void {
  shooter.pos = { x: hostile.pos.x - 1, y: hostile.pos.y };
  shooter.actionsRemaining = MAX_ACTIONS_PER_TURN;
  hostile.currentHp = 1;
  vi.spyOn(Math, "random").mockReturnValue(0.99);
  const out = mission.attack(shooter.instanceId, hostile.instanceId);
  vi.restoreAllMocks();
  expect(out?.defenderDowned).toBe(true);
  shooter.actionsRemaining = MAX_ACTIONS_PER_TURN;
}

function winNow(mission: Mission): void {
  for (const u of mission.units) if (u.side === "hostile") u.downed = true;
  mission.endPlayerTurn();
  expect(mission.outcome).toBe("win");
}

function loseNow(mission: Mission): void {
  for (const u of mission.units) if (u.side === "player") u.downed = true;
  mission.endPlayerTurn();
  expect(mission.outcome).toBe("loss");
}

describe("a player frame collapsing", () => {
  it("leaves a capsule on its tile and decides nothing yet", () => {
    const mission = quietMission();
    const nagori = pilot(mission, "pilot_nagori");
    nagori.pos = { x: 6, y: 5 };
    killPlayer(mission, nagori);

    const field = mission.fieldCapsules();
    expect(field).toHaveLength(1);
    expect(field[0]).toMatchObject({ side: "player", pilotId: "pilot_nagori", pos: { x: 6, y: 5 }, status: "field" });
    expect(mission.permanentLosses).toHaveLength(0);
  });

  it("the commander going down still ends the attempt with no capsule and nothing resolved", () => {
    const mission = quietMission(AMARANTH_MISSION_1);
    const rourke = pilot(mission, "pilot_rourke");
    killPlayer(mission, rourke);
    expect(mission.outcome).toBe("commander_down");
    expect(mission.capsules).toHaveLength(0);
    expect(mission.permanentLosses).toHaveLength(0);
  });
});

describe("recovering a friendly capsule", () => {
  function setup() {
    const mission = quietMission();
    const nagori = pilot(mission, "pilot_nagori");
    const barasj = pilot(mission, "pilot_barasj");
    const thyns = pilot(mission, "pilot_thyns");
    nagori.pos = { x: 6, y: 5 };
    killPlayer(mission, nagori);
    const capsule = mission.fieldCapsules()[0];
    return { mission, barasj, thyns, capsule };
  }

  it("takes a Munti next to it: 1 action, turn continues", () => {
    const { mission, barasj, capsule } = setup();
    barasj.pos = { x: 7, y: 6 }; // diagonal counts
    barasj.actionsRemaining = MAX_ACTIONS_PER_TURN;
    expect(mission.getRecoverableCapsules(barasj.instanceId).map((c) => c.id)).toEqual([capsule.id]);
    expect(mission.recoverCapsule(barasj.instanceId, capsule.id)).toBe(true);
    expect(barasj.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN - 1);
    expect(capsule.status).toBe("recovered");
    expect(mission.fieldCapsules()).toHaveLength(0);
  });

  it("works from the capsule's own tile too", () => {
    const { mission, barasj, capsule } = setup();
    barasj.pos = { ...capsule.pos };
    expect(mission.canRecoverCapsule(barasj.instanceId, capsule.id)).toBe(true);
  });

  it("refuses anyone who isn't a Munti", () => {
    const { mission, thyns, capsule } = setup();
    thyns.pos = { x: 7, y: 5 };
    expect(mission.canRecoverCapsule(thyns.instanceId, capsule.id)).toBe(false);
    expect(mission.recoverCapsule(thyns.instanceId, capsule.id)).toBe(false);
    expect(capsule.status).toBe("field");
  });

  it("refuses a Munti two tiles away, or one with no action left", () => {
    const { mission, barasj, capsule } = setup();
    barasj.pos = { x: 8, y: 5 };
    expect(mission.canRecoverCapsule(barasj.instanceId, capsule.id)).toBe(false);
    barasj.pos = { x: 7, y: 5 };
    barasj.actionsRemaining = 0;
    expect(mission.canRecoverCapsule(barasj.instanceId, capsule.id)).toBe(false);
  });
});

describe("the verdict, when the mission ends", () => {
  it("WIN with a Munti still standing: an unclicked capsule is picked up after the fight", () => {
    const mission = quietMission();
    const nagori = pilot(mission, "pilot_nagori");
    killPlayer(mission, nagori);
    winNow(mission);
    expect(mission.permanentLosses).toHaveLength(0);
    expect(mission.capsules[0].status).toBe("recovered");
  });

  it("WIN with no Munti standing: an unclicked capsule is a permanent loss", () => {
    const mission = quietMission();
    const nagori = pilot(mission, "pilot_nagori");
    const barasj = pilot(mission, "pilot_barasj");
    nagori.pos = { x: 6, y: 5 };
    barasj.pos = { x: 10, y: 5 };
    killPlayer(mission, nagori);
    killPlayer(mission, barasj);
    winNow(mission);
    const lost = mission.permanentLosses.map((l) => l.pilotId).sort();
    expect(lost).toEqual(["pilot_barasj", "pilot_nagori"]);
  });

  it("the click is insurance: recovered, then the Munti dies, then a win — still safe", () => {
    const mission = quietMission();
    const nagori = pilot(mission, "pilot_nagori");
    const barasj = pilot(mission, "pilot_barasj");
    nagori.pos = { x: 6, y: 5 };
    killPlayer(mission, nagori);
    barasj.pos = { x: 7, y: 5 };
    expect(mission.recoverCapsule(barasj.instanceId, mission.fieldCapsules()[0].id)).toBe(true);
    killPlayer(mission, barasj);
    winNow(mission);
    expect(mission.permanentLosses.map((l) => l.pilotId)).toEqual(["pilot_barasj"]);
  });

  it("LOSS: only capsules a Munti actually recovered come home", () => {
    const mission = quietMission();
    const nagori = pilot(mission, "pilot_nagori");
    const thyns = pilot(mission, "pilot_thyns");
    const barasj = pilot(mission, "pilot_barasj");
    nagori.pos = { x: 6, y: 5 };
    thyns.pos = { x: 6, y: 9 };
    killPlayer(mission, nagori);
    killPlayer(mission, thyns);
    barasj.pos = { x: 7, y: 5 };
    mission.recoverCapsule(barasj.instanceId, mission.fieldCapsules().find((c) => c.pilotId === "pilot_nagori")!.id);
    loseNow(mission);
    expect(mission.permanentLosses.map((l) => l.pilotId)).toEqual(["pilot_thyns"]);
    expect(mission.permanentLosses[0].reason).toMatch(/lost/);
  });

  it("a revived frame's capsule stops mattering, and a second collapse leaves exactly one live capsule", () => {
    const mission = quietMission();
    const nagori = pilot(mission, "pilot_nagori");
    killPlayer(mission, nagori);
    expect(mission.fieldCapsules()).toHaveLength(1);

    nagori.downed = false; // what a beacon revive does to the frame
    nagori.currentHp = nagori.maxHp;
    expect(mission.fieldCapsules()).toHaveLength(0);

    killPlayer(mission, nagori);
    expect(mission.fieldCapsules()).toHaveLength(1);
    expect(mission.capsules.filter((c) => c.status === "void")).toHaveLength(1);
  });

  it("nothing can be clicked once the mission is over", () => {
    const mission = quietMission();
    const nagori = pilot(mission, "pilot_nagori");
    const barasj = pilot(mission, "pilot_barasj");
    nagori.pos = { x: 6, y: 5 };
    barasj.pos = { x: 10, y: 5 };
    killPlayer(mission, nagori);
    killPlayer(mission, barasj);
    const capsuleId = mission.fieldCapsules()[0].id;
    winNow(mission);
    const thyns = pilot(mission, "pilot_thyns");
    thyns.pos = { x: 7, y: 5 };
    expect(mission.canRecoverCapsule(thyns.instanceId, capsuleId)).toBe(false);
  });
});

describe("enemy capsules and prisoners", () => {
  it("a hostile mech ejects; anyone next to it can take the pilot; a win hands the prisoner to Debrief", () => {
    const mission = quietMission();
    const thyns = pilot(mission, "pilot_thyns");
    const trooper = createHostileMechUnit("hostile_mech_02", { x: 9, y: 9 });
    mission.units.push(trooper);
    killHostile(mission, thyns, trooper);

    const capsule = mission.fieldCapsules().find((c) => c.side === "hostile")!;
    expect(capsule).toMatchObject({ hostileMechId: "hostile_mech_02", pos: { x: 9, y: 9 }, path: trooper.path });
    expect(mission.recoverCapsule(thyns.instanceId, capsule.id)).toBe(true); // a Tank can do it
    expect(mission.capturedPrisoners()).toEqual([]); // not until the mission is won
    winNow(mission);
    expect(mission.capturedPrisoners()).toEqual([
      expect.objectContaining({ capsuleId: capsule.id, path: trooper.path, archetypeId: trooper.archetypeId, hostileMechId: "hostile_mech_02" }),
    ]);
  });

  it("an enemy capsule nobody grabbed is not a prisoner, and a loss loses the ones who were", () => {
    const mission = quietMission();
    const thyns = pilot(mission, "pilot_thyns");
    const a = createHostileMechUnit("hostile_mech_02", { x: 9, y: 9 });
    const b = createHostileMechUnit("hostile_mech_03", { x: 12, y: 9 });
    mission.units.push(a, b);
    killHostile(mission, thyns, a);
    mission.recoverCapsule(thyns.instanceId, mission.fieldCapsules()[0].id);
    killHostile(mission, thyns, b);
    loseNow(mission);
    expect(mission.capturedPrisoners()).toEqual([]);
  });

  it("the rival's own side pulls her out: no capsule", () => {
    const mission = quietMission();
    const thyns = pilot(mission, "pilot_thyns");
    const marrow = createHostileMechUnit("hostile_mech_marrow", { x: 9, y: 9 });
    mission.units.push(marrow);
    killHostile(mission, thyns, marrow);
    expect(mission.capsules).toHaveLength(0);
    expect(mission.log.some((l) => l.includes("pulls the capsule out"))).toBe(true);
  });

  it("Bloom never leave one", () => {
    const mission = quietMission();
    const thyns = pilot(mission, "pilot_thyns");
    const crawler = createBloomUnit("bloom_crawlmass", { x: 9, y: 9 });
    crawler.endurance = 0; // Bloom take damage as Endurance then Vitality, not currentHp
    crawler.vitality = 1;
    mission.units.push(crawler);
    killHostile(mission, thyns, crawler);
    expect(mission.capsules).toHaveLength(0);
  });
});

describe("the sim bot (sim/playerAi) and capsules", () => {
  it("a healthy Munti mid-fight keeps working; a hurt one pays for the insurance", () => {
    const mission = quietMission();
    const nagori = pilot(mission, "pilot_nagori");
    const barasj = pilot(mission, "pilot_barasj");
    nagori.pos = { x: 6, y: 5 };
    killPlayer(mission, nagori);
    barasj.pos = { x: 7, y: 5 };
    resetPlayerAiLog();
    // Healthy, squad intact, the keeper still up: a win would bring the capsule home anyway.
    expect(decidePlayerAiAction(mission.map, barasj, mission.units, mission.turn, mission).action).not.toBe("recover_capsule");

    barasj.currentHp = Math.floor(barasj.maxHp * 0.4);
    const decision = decidePlayerAiAction(mission.map, barasj, mission.units, mission.turn, mission);
    expect(decision).toMatchObject({ action: "recover_capsule", capsuleId: mission.fieldCapsules()[0].id });
    expect(playerAiLog.at(-1)?.reason).toBe("recover_capsule");
  });

  it("takes an enemy pilot only once nothing hostile is left standing", () => {
    const mission = quietMission();
    const thyns = pilot(mission, "pilot_thyns");
    const trooper = createHostileMechUnit("hostile_mech_02", { x: 9, y: 9 });
    mission.units.push(trooper);
    killHostile(mission, thyns, trooper);

    resetPlayerAiLog();
    const busy = decidePlayerAiAction(mission.map, thyns, mission.units, mission.turn, mission);
    expect(busy.action).not.toBe("recover_capsule"); // the keeper is still up

    for (const u of mission.units) if (u.side === "hostile") u.downed = true;
    const free = decidePlayerAiAction(mission.map, thyns, mission.units, mission.turn, mission);
    expect(free).toMatchObject({ action: "recover_capsule", capsuleId: mission.fieldCapsules()[0].id });
    expect(playerAiLog.at(-1)?.reason).toBe("capture_prisoner");
  });
});

describe("Debrief's prisoner choices (campaignState)", () => {
  it("RANSOM pays PRISONER_RANSOM_POINTS into the company pool", () => {
    const state = createWardenCampaignState(100);
    expect(ransomPrisoner(state)).toBe(PRISONER_RANSOM_POINTS);
    expect(PRISONER_RANSOM_POINTS).toBe(60);
    expect(state.points).toBe(160);
  });

  it("RECRUIT signs on a G-tier pilot of the same class and chassis, and costs nothing", () => {
    const state = createWardenCampaignState(100);
    const before = Object.keys(state.pilots).length;
    const pilot = recruitPrisoner(state, { path: "reeps", archetypeId: "arch_reeps_bipedal" });
    expect(Object.keys(state.pilots)).toHaveLength(before + 1);
    expect(pilot.archetypeId).toBe("arch_reeps_bipedal");
    expect(pilot.tier).toBe("G");
    expect(state.pilots[pilot.id].status).toBe("active");
    expect(state.points).toBe(100);
  });

  it("an unexpected archetype id falls back to a human frame rather than an unknown one", () => {
    const state = createWardenCampaignState(0);
    expect(recruitPrisoner(state, { path: "tank", archetypeId: "npc_something" }).archetypeId).toBe("arch_tank_bipedal");
  });
});
