// Mission 31's multi-civilian extraction (Maxime, 25 Aug 2026, on the
// escort AI's shape: "go ham. 3, the game is meant to feel alive") —
// covers engine/units.ts's createCivilianUnit, engine/mission.ts's
// spawnConvoyCivilians (constructor)/checkExtraction/runCivilianStep/
// moveCivilian/checkWinLoss's civilian threshold branch and playerAlive
// exclusion, and engine/ai.ts's moveAwayFrom/decideCivilianAction.
//
// House test style: real Mission objects built from the real mission def
// (AMARANTH_MISSION_31, the only mission with civilianSpawns), with direct
// unit mutation to isolate one scenario on an otherwise quiet board — same
// pattern as overwatch.test.ts/rescuePilot.test.ts.
import { describe, it, expect } from "vitest";
import { Mission } from "../mission";
import { createCivilianUnit } from "../units";
import { decideCivilianAction, moveAwayFrom } from "../ai";
import { AMARANTH_MISSION_31 } from "../../data/campaignAmaranth";
import { MISSION_1A } from "../../data/campaign";
import type { BattleUnit } from "../units";

/**
 * AMARANTH_MISSION_31 with every hostile downed and every player pilot
 * parked far off-board — isolates whatever the test sets up next (civilian
 * movement, extraction, threshold math) from the mission's own real enemy
 * waves and 12-pilot squad. Mirrors overwatch.test.ts's quietMission().
 */
function quietConvoyMission(): Mission {
  const mission = new Mission(AMARANTH_MISSION_31);
  for (const u of mission.units) {
    if (u.side === "hostile") u.downed = true;
    else if (!u.isCivilian) u.pos = { x: 0, y: 0 };
  }
  return mission;
}

describe("createCivilianUnit", () => {
  it("is a side:player, unarmed, permanently-out-of-actions unit — the npcIncapacitated trick, not a new side", () => {
    const civ = createCivilianUnit({ x: 5, y: 5 }, "Test Civilian");
    expect(civ.side).toBe("player");
    expect(civ.isCivilian).toBe(true);
    expect(civ.actionsRemaining).toBe(0);
    expect(civ.attackRange).toEqual([0, 0]);
    expect(civ.effectiveAttack).toBe(0);
    expect(civ.canCounter).toBe(false);
    expect(civ.downed).toBe(false);
  });
});

describe("spawnConvoyCivilians (Mission constructor)", () => {
  it("spawns one isCivilian unit per civilianSpawns entry, at the configured coords and names, for a mission that has them", () => {
    const mission = new Mission(AMARANTH_MISSION_31);
    const civilians = mission.units.filter((u) => u.isCivilian);
    const spawns = AMARANTH_MISSION_31.civilianSpawns!;
    expect(civilians).toHaveLength(spawns.length);
    for (const spawn of spawns) {
      const match = civilians.find((c) => c.displayName === spawn.displayName);
      expect(match).toBeDefined();
      expect(match!.pos).toEqual(spawn.at);
      expect(match!.actionsRemaining).toBe(0);
    }
  });

  it("is a no-op — no civilian units at all — for a mission with no civilianSpawns", () => {
    const mission = new Mission(MISSION_1A);
    expect(mission.units.some((u) => u.isCivilian)).toBe(false);
  });
});

describe("Mission.checkExtraction — civilian branch (via endPlayerTurn)", () => {
  it("banks a civilian the instant it's standing on an exit tile, logs it, and does not touch the others", () => {
    const mission = quietConvoyMission();
    const [civA, civB] = mission.units.filter((u) => u.isCivilian);
    const exit = mission.map.exitTiles![0];
    civA.pos = exit;
    civB.pos = { x: exit.x + 10, y: exit.y }; // nowhere near an exit

    mission.endPlayerTurn();
    expect(mission.log).toContain(`${civA.displayName} reaches the extraction tile.`);
    expect(mission.log).not.toContain(`${civB.displayName} reaches the extraction tile.`);
  });

  it("never double-banks the same civilian across multiple turns sitting on the exit", () => {
    const mission = quietConvoyMission();
    const civ = mission.units.filter((u) => u.isCivilian)[0];
    civ.pos = mission.map.exitTiles![0];

    mission.endPlayerTurn();
    const firstCount = mission.log.filter((l) => l === `${civ.displayName} reaches the extraction tile.`).length;
    expect(firstCount).toBe(1);

    // Still sitting on the exit tile next turn — must not log (or bank) again.
    if (mission.outcome === "ongoing") {
      mission.endPlayerTurn();
      const secondCount = mission.log.filter((l) => l === `${civ.displayName} reaches the extraction tile.`).length;
      expect(secondCount).toBe(1);
    }
  });
});

describe("checkWinLoss — civilian extract_unit threshold", () => {
  it("wins the instant enough civilians are banked, independent of the rest of the roster's fate", () => {
    const mission = quietConvoyMission();
    const threshold = AMARANTH_MISSION_31.objectiveParams.extractThreshold!;
    const civilians = mission.units.filter((u) => u.isCivilian);
    const exit = mission.map.exitTiles![0];
    for (let i = 0; i < threshold; i++) civilians[i].pos = exit;

    mission.endPlayerTurn();
    expect(mission.outcome).toBe("win");
  });

  it("loses once the threshold becomes mathematically unreachable — more civilians downed than the slack allows", () => {
    const mission = quietConvoyMission();
    const civilians = mission.units.filter((u) => u.isCivilian);
    const threshold = AMARANTH_MISSION_31.objectiveParams.extractThreshold!;
    // Down enough civilians that even every remaining survivor making it
    // out still falls short of threshold.
    const toDown = civilians.length - threshold + 1;
    for (let i = 0; i < toDown; i++) civilians[i].downed = true;

    mission.endPlayerTurn();
    expect(mission.outcome).toBe("loss");
    expect(mission.log.at(-1)).toMatch(/too few of the convoy can still reach extraction/);
  });

  it("a downed civilian short of that threshold does not end the mission by itself — extraction is still mathematically possible", () => {
    const mission = quietConvoyMission();
    const civilians = mission.units.filter((u) => u.isCivilian);
    civilians[0].downed = true; // one loss, well within slack for this mission's own threshold/total gap

    mission.endPlayerTurn();
    expect(mission.outcome).toBe("ongoing");
  });

  it("loses on turn limit once time runs out short of the threshold", () => {
    const mission = quietConvoyMission();
    const turnLimit = AMARANTH_MISSION_31.objectiveParams.turnLimit;
    mission.turn = turnLimit + 1;

    mission.endPlayerTurn();
    expect(mission.outcome).toBe("loss");
    expect(mission.log.at(-1)).toBe("Loss: turn limit reached before enough of the convoy got out.");
  });
});

describe("checkWinLoss — playerAlive exclusion for civilians", () => {
  it("a wiped real squad reads as a loss even with living, unextracted civilians still on the board", () => {
    const mission = quietConvoyMission();
    for (const u of mission.units) {
      if (u.side === "player" && !u.isCivilian) u.downed = true;
    }
    expect(mission.units.some((u) => u.isCivilian && !u.downed)).toBe(true);

    mission.endPlayerTurn();
    expect(mission.outcome).toBe("loss");
    expect(mission.log.at(-1)).toBe("Loss: all player units downed.");
  });
});

describe("Mission.runCivilianStep / moveCivilian (via endPlayerTurn -> runHostileTurn)", () => {
  it("moves a civilian with no visible hostile toward the nearest exit tile, once per turn cycle", () => {
    const mission = quietConvoyMission();
    const civ = mission.units.filter((u) => u.isCivilian)[0];
    const before = { ...civ.pos };
    const exit = mission.map.exitTiles![0];
    const distBefore = Math.max(Math.abs(before.x - exit.x), Math.abs(before.y - exit.y));

    mission.endPlayerTurn();
    if (mission.outcome !== "ongoing") return; // this civilian may have already reached an exit and ended the mission
    const distAfter = Math.max(Math.abs(civ.pos.x - exit.x), Math.abs(civ.pos.y - exit.y));
    expect(civ.pos).not.toEqual(before);
    expect(distAfter).toBeLessThan(distBefore);
  });

  it("does not trigger a nearby player unit's held overwatch — moveHostile's reaction systems are deliberately not shared", () => {
    const mission = quietConvoyMission();
    const civ = mission.units.filter((u) => u.isCivilian)[0];
    const exit = mission.map.exitTiles![0];
    civ.pos = { x: exit.x + 2, y: exit.y }; // one short move from the exit, straight line

    const watcher = mission.units.find((u) => u.side === "player" && !u.isCivilian)!;
    watcher.pos = { x: exit.x + 1, y: exit.y }; // directly on the civilian's own path to the exit
    watcher.actionsRemaining = 1;
    const armed = mission.enterOverwatch(watcher.instanceId);
    expect(armed).toBe(true);

    mission.endPlayerTurn();
    // endPlayerTurn runs the whole hostile phase through to the start of
    // the next player turn, which always clears overwatch as ordinary
    // bookkeeping (see mission.ts's own comment: "expires the moment its
    // owner's next turn begins," fired or not) — so overwatch being false
    // afterward proves nothing either way. What matters: no reaction shot
    // ever fired, and the civilian passing through took no damage from it.
    expect(mission.log.some((l) => l.includes("fires overwatch"))).toBe(false);
    expect(civ.downed).toBe(false);
  });
});

describe("engine/ai.ts — moveAwayFrom / decideCivilianAction", () => {
  it("moveAwayFrom never picks a reachable tile less safe than staying put", () => {
    const mission = quietConvoyMission();
    const civ = mission.units.filter((u) => u.isCivilian)[0];
    civ.pos = { x: 10, y: 5 };
    const threat = { ...civ, side: "hostile", pos: { x: 9, y: 5 } } as BattleUnit;

    const path = moveAwayFrom(mission.map, civ, [threat], mission.units, mission.map.exitTiles ?? []);
    const dest = path.length ? path[path.length - 1] : civ.pos;
    const distBefore = Math.max(Math.abs(civ.pos.x - threat.pos.x), Math.abs(civ.pos.y - threat.pos.y));
    const distAfter = Math.max(Math.abs(dest.x - threat.pos.x), Math.abs(dest.y - threat.pos.y));
    expect(distAfter).toBeGreaterThanOrEqual(distBefore);
  });

  it("decideCivilianAction heads for the nearest exit tile when no hostile is visible", () => {
    const mission = quietConvoyMission();
    const civ = mission.units.filter((u) => u.isCivilian)[0];
    const decision = decideCivilianAction(mission.map, civ, mission.units);
    expect(decision.path).toBeDefined();
    expect(decision.path!.length).toBeGreaterThan(1);
  });
});
