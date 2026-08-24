// Mission 5's rescue-and-recruit bonus objective (Maxime, 23 Aug 2026:
// "mission 5 is rescue the downed pilot. or grab whats left of the fallen
// unit to bring back home" -> "i think rescuing a down npc would be cool,
// giving us a free new pilot. random chassis" -> asked whether class rolls
// too, "Chassis and class, both random." -> asked where a rescued pilot
// lands, "The bench"). Covers engine/units.ts's createRescuableNpcUnit,
// engine/mission.ts's getRescuableFrom/canRescue/rescueUnit/
// checkRescueExtraction/handleDowned rescue-failure branch, the
// carryingRescueId attack guard, checkWinLoss's npcIncapacitated exclusion
// from playerAlive, and engine/campaignState.ts's generateRandomRescuedPilot.
import { describe, it, expect, vi, afterEach } from "vitest";
import { Mission } from "../mission";
import { createRescuableNpcUnit } from "../units";
import { AMARANTH_MISSION_5, AMARANTH_MISSION_3 } from "../../data/campaignAmaranth";
import { MISSION_1A } from "../../data/campaign";
import { createWardenCampaignState, generateRandomRescuedPilot } from "../campaignState";
import { MAX_ACTIONS_PER_TURN } from "../../data/combatTables";

describe("spawnRescuableNpc (Mission constructor)", () => {
  it("spawns the NPC at the mission's configured coord with rescueOutcome pending, for a mission with a bonusObjective", () => {
    const mission = new Mission(AMARANTH_MISSION_5);
    expect(mission.rescueOutcome).toBe("pending");
    const npc = mission.units.find((u) => u.npcIncapacitated);
    expect(npc).toBeDefined();
    // Narrowed from the generalized BonusObjective union (24 Aug 2026) —
    // AMARANTH_MISSION_5's own bonusObjective is a rescue_pilot, but the
    // exported CampaignMission type no longer says so without this check.
    const bonus = AMARANTH_MISSION_5.bonusObjective!;
    if (bonus.kind !== "rescue_pilot") throw new Error("expected AMARANTH_MISSION_5's bonusObjective to be rescue_pilot");
    expect(npc!.pos).toEqual(bonus.npcSpawnAt);
    expect(npc!.displayName).toBe(bonus.npcDisplayName);
    expect(npc!.side).toBe("player");
  });

  it("is a no-op — no NPC, rescueOutcome stays 'none' — for a mission with no bonusObjective", () => {
    const mission = new Mission(AMARANTH_MISSION_3);
    expect(mission.rescueOutcome).toBe("none");
    expect(mission.units.some((u) => u.npcIncapacitated)).toBe(false);
  });
});

describe("Mission.getRescuableFrom / canRescue / rescueUnit", () => {
  it("only offers the NPC to an adjacent player unit that is free to act and not already carrying", () => {
    const mission = new Mission(AMARANTH_MISSION_5);
    const npc = mission.units.find((u) => u.npcIncapacitated)!;
    const rourke = mission.units.find((u) => u.pilotId === "pilot_rourke")!;
    rourke.pos = { x: npc.pos.x + 5, y: npc.pos.y }; // far away
    expect(mission.getRescuableFrom(rourke.instanceId, rourke.pos)).toEqual([]);
    expect(mission.canRescue(rourke.instanceId, npc.instanceId)).toBe(false);

    rourke.pos = { x: npc.pos.x - 1, y: npc.pos.y }; // adjacent
    expect(mission.getRescuableFrom(rourke.instanceId, rourke.pos).map((u) => u.instanceId)).toEqual([npc.instanceId]);
    expect(mission.canRescue(rourke.instanceId, npc.instanceId)).toBe(true);
  });

  it("rescueUnit removes the NPC from the board, marks the rescuer as carrying, costs 1 action, and does not end the turn", () => {
    const mission = new Mission(AMARANTH_MISSION_5);
    const npc = mission.units.find((u) => u.npcIncapacitated)!;
    const rourke = mission.units.find((u) => u.pilotId === "pilot_rourke")!;
    rourke.pos = { x: npc.pos.x - 1, y: npc.pos.y };

    const result = mission.rescueUnit(rourke.instanceId, npc.instanceId);
    expect(result).toEqual({ rescuerId: rourke.instanceId, npcId: npc.instanceId });
    expect(rourke.carryingRescueId).toBe(npc.instanceId);
    expect(mission.units.find((u) => u.instanceId === npc.instanceId)).toBeUndefined();
    expect(rourke.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN - 1);
  });

  it("refuses a non-adjacent rescue, a unit already carrying, a downed candidate, and an out-of-actions candidate", () => {
    const mission = new Mission(AMARANTH_MISSION_5);
    const npc = mission.units.find((u) => u.npcIncapacitated)!;
    const rourke = mission.units.find((u) => u.pilotId === "pilot_rourke")!;
    const bosk = mission.units.find((u) => u.pilotId === "pilot_bosk")!;

    rourke.pos = { x: npc.pos.x + 5, y: npc.pos.y };
    expect(mission.rescueUnit(rourke.instanceId, npc.instanceId)).toBeNull();

    rourke.pos = { x: npc.pos.x - 1, y: npc.pos.y };
    rourke.downed = true;
    expect(mission.canRescue(rourke.instanceId, npc.instanceId)).toBe(false);
    rourke.downed = false;

    rourke.actionsRemaining = 0;
    expect(mission.canRescue(rourke.instanceId, npc.instanceId)).toBe(false);
    rourke.actionsRemaining = MAX_ACTIONS_PER_TURN;

    // Bosk rescues instead, then Rourke (now adjacent to nothing rescuable) is refused too.
    bosk.pos = { x: npc.pos.x, y: npc.pos.y - 1 };
    mission.rescueUnit(bosk.instanceId, npc.instanceId);
    expect(mission.getRescuableFrom(bosk.instanceId, bosk.pos)).toEqual([]); // already carrying
  });
});

describe("Mission.attack — carryingRescueId guard", () => {
  it("a unit carrying the rescue cannot attack, even a hostile at point-blank range", () => {
    const mission = new Mission(AMARANTH_MISSION_5);
    const npc = mission.units.find((u) => u.npcIncapacitated)!;
    const rourke = mission.units.find((u) => u.pilotId === "pilot_rourke")!;
    rourke.pos = { x: npc.pos.x - 1, y: npc.pos.y };
    mission.rescueUnit(rourke.instanceId, npc.instanceId);

    const hostile = mission.units.find((u) => u.side === "hostile" && u.archetypeId === "bloom_crawlmass")!;
    hostile.pos = { x: rourke.pos.x + 1, y: rourke.pos.y };
    expect(mission.attack(rourke.instanceId, hostile.instanceId)).toBeNull();
  });
});

describe("Mission.checkRescueExtraction (via endPlayerTurn)", () => {
  it("succeeds the instant the carrier reaches an exit tile, clearing carryingRescueId so they can act normally again", () => {
    const mission = new Mission(AMARANTH_MISSION_5);
    const npc = mission.units.find((u) => u.npcIncapacitated)!;
    const rourke = mission.units.find((u) => u.pilotId === "pilot_rourke")!;
    rourke.pos = { x: npc.pos.x - 1, y: npc.pos.y };
    mission.rescueUnit(rourke.instanceId, npc.instanceId);

    const exit = mission.map.exitTiles![0];
    rourke.pos = exit;
    mission.endPlayerTurn(); // checkRescueExtraction runs before the hostile phase
    expect(mission.rescueOutcome).toBe("succeeded");
    expect(rourke.carryingRescueId).toBeUndefined();
  });

  it("stays 'pending' while the carrier has not yet reached an exit tile", () => {
    const mission = new Mission(AMARANTH_MISSION_5);
    const npc = mission.units.find((u) => u.npcIncapacitated)!;
    const rourke = mission.units.find((u) => u.pilotId === "pilot_rourke")!;
    rourke.pos = { x: npc.pos.x - 1, y: npc.pos.y };
    mission.rescueUnit(rourke.instanceId, npc.instanceId);
    for (const u of mission.units) if (u.side === "hostile") u.downed = true; // isolate — don't let combat resolve this turn
    mission.endPlayerTurn();
    expect(mission.rescueOutcome).toBe("pending");
  });
});

describe("Mission.handleDowned — rescue failure paths", () => {
  afterEach(() => vi.restoreAllMocks());

  it("the NPC downed before ever being rescued flips rescueOutcome to failed, without touching mission.outcome", () => {
    // The rescuable NPC is deliberately path:"meeps" (see
    // createRescuableNpcUnit's own comment) — it carries the Meeps dodge
    // house rule, so this hit needs Math.random() forced high or this test
    // would be flaky (MEEPS_DODGE_CHANCE is a real 40% per dodge.test.ts).
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const mission = new Mission(AMARANTH_MISSION_5);
    const npc = mission.units.find((u) => u.npcIncapacitated)!;
    const hostile = mission.units.find((u) => u.side === "hostile" && u.archetypeId === "bloom_crawlmass")!;
    hostile.pos = { x: npc.pos.x - 1, y: npc.pos.y };
    hostile.attackPower = 9999; // bloomDamage() reads attackPower, not effectiveAttack — see engine/combat.ts
    hostile.actionsRemaining = MAX_ACTIONS_PER_TURN;
    npc.currentHp = 1; // guarantee the hit downs it regardless of formula margin

    const outcome = mission.attack(hostile.instanceId, npc.instanceId);
    expect(outcome).not.toBeNull();
    expect(npc.downed).toBe(true);
    expect(mission.rescueOutcome).toBe("failed");
    expect(mission.log).toContain("The rescue attempt fails.");
    expect(mission.outcome).toBe("ongoing"); // a bonus objective failing never ends the mission
  });

  it("the carrier downed while still carrying also flips rescueOutcome to failed", () => {
    const mission = new Mission(AMARANTH_MISSION_5);
    const npc = mission.units.find((u) => u.npcIncapacitated)!;
    // Bosk (Tank), not Rourke (Meeps) — a Meeps carrier would introduce a
    // real MEEPS_DODGE_CHANCE roll on this hit (unmocked Math.random here),
    // making "guaranteed to down them" flaky. A Tank carries no dodge.
    const bosk = mission.units.find((u) => u.pilotId === "pilot_bosk")!;
    bosk.pos = { x: npc.pos.x - 1, y: npc.pos.y };
    mission.rescueUnit(bosk.instanceId, npc.instanceId);
    expect(mission.rescueOutcome).toBe("pending");

    const hostile = mission.units.find((u) => u.side === "hostile" && u.archetypeId === "bloom_crawlmass")!;
    hostile.pos = { x: bosk.pos.x + 1, y: bosk.pos.y };
    hostile.attackPower = 9999; // bloomDamage() reads attackPower, not effectiveAttack — see engine/combat.ts
    hostile.actionsRemaining = MAX_ACTIONS_PER_TURN;
    bosk.currentHp = 1;

    const outcome = mission.attack(hostile.instanceId, bosk.instanceId);
    expect(outcome).not.toBeNull();
    expect(bosk.downed).toBe(true);
    expect(mission.rescueOutcome).toBe("failed");
  });

  it("a downing after the rescue already succeeded does not re-flip rescueOutcome back to failed", () => {
    const mission = new Mission(AMARANTH_MISSION_5);
    const npc = mission.units.find((u) => u.npcIncapacitated)!;
    const rourke = mission.units.find((u) => u.pilotId === "pilot_rourke")!;
    rourke.pos = { x: npc.pos.x - 1, y: npc.pos.y };
    mission.rescueUnit(rourke.instanceId, npc.instanceId);
    rourke.pos = mission.map.exitTiles![0];
    for (const u of mission.units) if (u.side === "hostile") u.downed = true;
    mission.endPlayerTurn();
    expect(mission.rescueOutcome).toBe("succeeded");

    // Rourke is downed later by some other means (e.g. tile damage) — the
    // rescue is long since resolved and must not be touched by it.
    rourke.downed = true;
    expect(mission.rescueOutcome).toBe("succeeded");
  });
});

describe("checkWinLoss — npcIncapacitated exclusion from playerAlive", () => {
  it("a wiped real squad reads as a loss even with an untouched rescuable NPC still standing on the board", () => {
    const mission = new Mission(MISSION_1A);
    const npc = createRescuableNpcUnit({ x: 0, y: 0 }, "Stray NPC");
    mission.units.push(npc);
    for (const u of mission.units) {
      if (u.side === "player" && !u.npcIncapacitated) u.downed = true;
    }
    expect(npc.downed).toBe(false);

    mission.endPlayerTurn();
    expect(mission.outcome).toBe("loss");
    expect(mission.log.at(-1)).toBe("Loss: all player units downed.");
  });
});

describe("generateRandomRescuedPilot", () => {
  afterEach(() => vi.restoreAllMocks());

  it("rolls both class and chassis (Maxime: 'Chassis and class, both random') and lands the pilot on the bench, active, unassigned", () => {
    // ALL_RECRUITABLE_PATHS = [meeps, tank, reeps, munti] (len 4);
    // ALL_CHASSIS_SUFFIXES = [bipedal, centauroid, vibrissal] (len 3).
    // A high roll on both picks the last entry of each: munti / vibrissal.
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = createWardenCampaignState();
    const before = Object.keys(state.pilots).length;

    const pilot = generateRandomRescuedPilot(state);
    expect(pilot.archetypeId).toBe("arch_munti_vibrissal");
    expect(state.pilots[pilot.id]).toBeDefined();
    expect(state.pilots[pilot.id].status).toBe("active"); // "the bench" — active, nobody required to deploy them
    expect(Object.keys(state.pilots)).toHaveLength(before + 1);
    expect(state.meks[pilot.mekId]).toBeDefined();
  });

  it("a low roll on both picks the first entry of each: meeps / bipedal", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.01);
    const state = createWardenCampaignState();
    const pilot = generateRandomRescuedPilot(state);
    expect(pilot.archetypeId).toBe("arch_meeps_bipedal");
  });

  it("never reuses generatePilot's shared id counter in a way that collides with an existing recruit", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const state = createWardenCampaignState();
    const first = generateRandomRescuedPilot(state);
    const second = generateRandomRescuedPilot(state);
    expect(first.id).not.toBe(second.id);
  });
});
