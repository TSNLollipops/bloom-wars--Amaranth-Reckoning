// Commander down (25 Aug 2026) — Independent Campaign doc §6a, Maxime's own
// words: "the mc only has plot armor becasuse if she dies the missions
// failed and its back to mission briefing." Covers the actual fix: the live
// engine used to treat the exempt pilot's (pilot_rourke's) own downing as a
// silent, unconditional "standard restock" via evaluatePermadeathCheck's
// exemptFromPermadeath branch, with the mission continuing as normal — see
// that branch's own updated comment in engine/campaignState.ts. Now
// Mission.handleDowned() (engine/mission.ts) checks the same
// PilotRecord.exemptFromPermadeath flag itself, BEFORE ever calling
// evaluatePermadeathCheck, and short-circuits to a third, distinct
// MissionOutcome — "commander_down" — instead.
import { describe, it, expect } from "vitest";
import { Mission } from "../mission";
import { AMARANTH_MISSION_1 } from "../../data/campaignAmaranth";
import { createWardenCampaignState, applyCommanderDownAttempt } from "../campaignState";
import { MAX_ACTIONS_PER_TURN } from "../../data/combatTables";

// Shared setup: a lone hostile placed adjacent to the target unit, buffed to
// a guaranteed-kill attackPower and given a full action, and the target's
// own HP dropped to 1 — same "guarantee the hit downs it regardless of
// formula margin" shape rescuePilot.test.ts already established for forcing
// a real downing through the public attack() path rather than poking
// unit.downed directly (which skips handleDowned's own side effects
// entirely).
function riggedHostileAttack(mission: Mission, targetId: string) {
  const target = mission.units.find((u) => u.instanceId === targetId)!;
  const hostile = mission.units.find((u) => u.side === "hostile" && u.archetypeId === "bloom_crawlmass")!;
  hostile.pos = { x: target.pos.x + 1, y: target.pos.y };
  hostile.attackPower = 9999;
  hostile.actionsRemaining = MAX_ACTIONS_PER_TURN;
  target.currentHp = 1;
  return mission.attack(hostile.instanceId, targetId);
}

describe("Mission.handleDowned — commander down", () => {
  it("Rourke reaching 0 HP ends the mission attempt as commander_down, not a loss or a standard restock", () => {
    const mission = new Mission(AMARANTH_MISSION_1);
    const rourke = mission.units.find((u) => u.pilotId === "pilot_rourke")!;

    const outcome = riggedHostileAttack(mission, rourke.instanceId);

    expect(outcome).not.toBeNull();
    expect(rourke.downed).toBe(true);
    expect(mission.outcome).toBe("commander_down");
    expect(mission.commanderDownPilotId).toBe("pilot_rourke");
    // Never redirected onto someone else, never waved off, and — the doc's
    // own emphasis — never even reaches the permadeath check: no entry in
    // permanentLosses for her.
    expect(mission.permanentLosses).toEqual([]);
    expect(mission.log).toContain("2nd Lt. Dessa Rourke — “Lark” is down — command down. Mission attempt ends; back to briefing.");
  });

  it("fires even with a full squad still standing — this is not the ordinary all-player-units-downed loss check", () => {
    const mission = new Mission(AMARANTH_MISSION_1);
    const rourke = mission.units.find((u) => u.pilotId === "pilot_rourke")!;
    const others = mission.units.filter((u) => u.side === "player" && u.pilotId !== "pilot_rourke");
    expect(others.length).toBeGreaterThan(0); // control: the rest of the squad is genuinely still up

    riggedHostileAttack(mission, rourke.instanceId);

    expect(mission.outcome).toBe("commander_down");
    for (const u of others) expect(u.downed).toBe(false);
  });

  it("once set, commander_down is not overwritten by a later checkWinLoss pass (endPlayerTurn)", () => {
    const mission = new Mission(AMARANTH_MISSION_1);
    const rourke = mission.units.find((u) => u.pilotId === "pilot_rourke")!;
    riggedHostileAttack(mission, rourke.instanceId);
    expect(mission.outcome).toBe("commander_down");

    // endPlayerTurn's own first line is checkWinLoss(), which short-circuits
    // true the instant outcome !== "ongoing" — this asserts that guard
    // actually holds for the new outcome value, not just "win"/"loss".
    mission.endPlayerTurn();
    expect(mission.outcome).toBe("commander_down");
  });

  it("a non-exempt pilot going down under identical conditions is unaffected — still runs the real permadeath check", () => {
    const mission = new Mission(AMARANTH_MISSION_1);
    const bosk = mission.units.find((u) => u.pilotId === "pilot_bosk")!;

    riggedHostileAttack(mission, bosk.instanceId);

    expect(bosk.downed).toBe(true);
    expect(mission.outcome).toBe("ongoing"); // no commander_down short-circuit for a non-exempt pilot
    expect(mission.commanderDownPilotId).toBeUndefined();
    // Warden Company deploys with Lask (a living Munti) on Mission 1, so
    // this specific downing should resolve as a standard restock, not a
    // permanent loss — same shape evaluatePermadeathCheck's own "living
    // Munti elsewhere" test already covers in isolation; this just confirms
    // Mission.handleDowned() still reaches that check for anyone who isn't
    // flagged exempt.
    expect(mission.permanentLosses).toEqual([]);
  });
});

describe("applyCommanderDownAttempt", () => {
  it("clears activeMissionAttempt unconditionally, same shape as applyMissionTimeout's own clear", () => {
    const state = createWardenCampaignState();
    state.activeMissionAttempt = { missionId: "mission_amaranth_1", startedAt: 12345 };

    applyCommanderDownAttempt(state);

    expect(state.activeMissionAttempt).toBeUndefined();
  });

  it("touches nothing else — no roster, no points, no personalPoints", () => {
    const state = createWardenCampaignState(250);
    state.pilots["pilot_rourke"].personalPoints = 40;
    state.activeMissionAttempt = { missionId: "mission_amaranth_1", startedAt: 1 };

    applyCommanderDownAttempt(state);

    expect(state.points).toBe(250);
    expect(state.pilots["pilot_rourke"].status).toBe("active");
    expect(state.pilots["pilot_rourke"].personalPoints).toBe(40);
  });

  it("is a safe no-op when there was no active attempt", () => {
    const state = createWardenCampaignState();
    expect(state.activeMissionAttempt).toBeUndefined();
    expect(() => applyCommanderDownAttempt(state)).not.toThrow();
    expect(state.activeMissionAttempt).toBeUndefined();
  });
});
