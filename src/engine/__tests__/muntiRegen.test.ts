// Munti passive regen house rule (data/combatTables.ts MUNTI_REGEN_RADIUS /
// MUNTI_REGEN_PER_TURN, Maxime, 22 Aug 2026): every living Munti passively
// heals itself and same-side allies within radius 2 for a flat amount each
// turn, on top of — not instead of — their existing active Repair ability.
// Same "flag it, keep it isolated to one tick function" treatment as the
// Tank shield and Meeps dodge house rules.
import { describe, it, expect } from "vitest";
import { Mission } from "../mission";
import { MISSION_1A } from "../../data/campaign";
import { MUNTI_REGEN_RADIUS, MUNTI_REGEN_PER_TURN } from "../../data/combatTables";

describe("Mission — Munti passive regen tick", () => {
  // Same rationale as shield.test.ts: mission 1a is eliminate_all, so
  // fully clearing the hostile side instantly wins the mission and skips
  // environmentStep. Keep one hostile alive but stripped of the ability to
  // move or attack, and re-neutralize after each turn to catch mission
  // 1a's scripted turn-4 ambush before it can act.
  function neutralizeHostiles(mission: Mission) {
    const hostiles = mission.units.filter((u) => u.side === "hostile" && !u.downed);
    const [keep, ...rest] = hostiles;
    for (const u of rest) u.downed = true;
    if (keep) {
      keep.moveRange = 0;
      keep.attackRange = [99, 99];
      keep.pos = { x: 0, y: 0 };
    }
  }

  it("heals a damaged ally within radius, capped at maxHp", () => {
    const mission = new Mission(MISSION_1A);
    neutralizeHostiles(mission);
    const munti = mission.units.find((u) => u.pilotId === "pilot_barasj")!;
    const ally = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    munti.pos = { x: 5, y: 5 };
    ally.pos = { x: 6, y: 5 }; // distance 1, within radius 2
    ally.currentHp = ally.maxHp - 3; // less than the regen amount — should cap, not overheal

    mission.endPlayerTurn();
    expect(ally.currentHp).toBe(ally.maxHp);
  });

  it("heals for the flat amount when the deficit is larger than one tick", () => {
    const mission = new Mission(MISSION_1A);
    neutralizeHostiles(mission);
    const munti = mission.units.find((u) => u.pilotId === "pilot_barasj")!;
    const ally = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    munti.pos = { x: 5, y: 5 };
    ally.pos = { x: 7, y: 5 }; // distance 2 — right at the radius edge
    const hpBefore = ally.maxHp - 50;
    ally.currentHp = hpBefore;

    mission.endPlayerTurn();
    expect(ally.currentHp).toBe(hpBefore + MUNTI_REGEN_PER_TURN);
  });

  it("does not heal an ally outside the radius", () => {
    const mission = new Mission(MISSION_1A);
    neutralizeHostiles(mission);
    const munti = mission.units.find((u) => u.pilotId === "pilot_barasj")!;
    const ally = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    munti.pos = { x: 5, y: 5 };
    ally.pos = { x: 5 + MUNTI_REGEN_RADIUS + 1, y: 5 }; // one tile past the radius
    const hpBefore = ally.maxHp - 20;
    ally.currentHp = hpBefore;

    mission.endPlayerTurn();
    expect(ally.currentHp).toBe(hpBefore);
  });

  it("heals the Munti itself too, not just allies", () => {
    const mission = new Mission(MISSION_1A);
    neutralizeHostiles(mission);
    const munti = mission.units.find((u) => u.pilotId === "pilot_barasj")!;
    munti.pos = { x: 5, y: 5 };
    const hpBefore = munti.maxHp - 20;
    munti.currentHp = hpBefore;

    mission.endPlayerTurn();
    expect(munti.currentHp).toBe(hpBefore + MUNTI_REGEN_PER_TURN);
  });

  it("stacks with — doesn't replace — the active Repair ability in the same turn", () => {
    const mission = new Mission(MISSION_1A);
    neutralizeHostiles(mission);
    const munti = mission.units.find((u) => u.pilotId === "pilot_barasj")!;
    const ally = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    munti.pos = { x: 5, y: 5 };
    ally.pos = { x: 6, y: 5 };
    ally.currentHp = ally.maxHp - 60;

    const repairResult = mission.repairUnit(munti.instanceId, ally.instanceId);
    expect(repairResult).not.toBeNull();
    const afterRepair = ally.currentHp;

    mission.endPlayerTurn();
    expect(ally.currentHp).toBe(Math.min(ally.maxHp, afterRepair + MUNTI_REGEN_PER_TURN));
  });

  it("does not touch a full-HP ally", () => {
    const mission = new Mission(MISSION_1A);
    neutralizeHostiles(mission);
    const munti = mission.units.find((u) => u.pilotId === "pilot_barasj")!;
    const ally = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    munti.pos = { x: 5, y: 5 };
    ally.pos = { x: 6, y: 5 };
    expect(ally.currentHp).toBe(ally.maxHp);

    mission.endPlayerTurn();
    expect(ally.currentHp).toBe(ally.maxHp);
  });
});
