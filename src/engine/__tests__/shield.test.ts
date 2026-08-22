// Tank shield house rule (data/combatTables.ts TANK_SHIELD_CAPACITY /
// TANK_SHIELD_REGEN_PER_TURN, Maxime, 22 Aug 2026): Overshield now also
// grants a real absorb-before-HP shield pool to the Tank itself and
// adjacent allies. Regens a flat amount per turn if undamaged; drops to 0
// the instant a unit leaves an eligible Tank's radius. Not in the Data
// Pack — same "flag it as a house rule, keep the validated resolver
// formulas untouched" treatment as MEEPS_DODGE_CHANCE.
import { describe, it, expect } from "vitest";
import { Mission } from "../mission";
import { MISSION_1A } from "../../data/campaign";
import { TANK_SHIELD_CAPACITY, TANK_SHIELD_REGEN_PER_TURN } from "../../data/combatTables";
import { tankShieldEligible, applyMechDamage } from "../combat";
import { testUnit } from "./testHelpers";

describe("tankShieldEligible", () => {
  it("the Tank itself is eligible", () => {
    const tank = testUnit("tank", { x: 0, y: 0 });
    tank.abilities = ["abil_overshield"];
    expect(tankShieldEligible(tank, [tank])).toBe(true);
  });

  it("an adjacent same-side ally is eligible", () => {
    const tank = testUnit("tank", { x: 0, y: 0 });
    tank.abilities = ["abil_overshield"];
    const ally = testUnit("meeps", { x: 1, y: 0 });
    expect(tankShieldEligible(ally, [tank, ally])).toBe(true);
  });

  it("a unit two tiles away is not eligible", () => {
    const tank = testUnit("tank", { x: 0, y: 0 });
    tank.abilities = ["abil_overshield"];
    const far = testUnit("meeps", { x: 2, y: 0 });
    expect(tankShieldEligible(far, [tank, far])).toBe(false);
  });

  it("a downed Tank grants nothing, and a downed unit is never eligible", () => {
    const tank = testUnit("tank", { x: 0, y: 0 });
    tank.abilities = ["abil_overshield"];
    tank.downed = true;
    const ally = testUnit("meeps", { x: 1, y: 0 });
    expect(tankShieldEligible(ally, [tank, ally])).toBe(false);

    const liveTank = testUnit("tank", { x: 0, y: 0 });
    liveTank.abilities = ["abil_overshield"];
    const downedAlly = testUnit("meeps", { x: 1, y: 0 });
    downedAlly.downed = true;
    expect(tankShieldEligible(downedAlly, [liveTank, downedAlly])).toBe(false);
  });
});

describe("applyMechDamage — shield absorption", () => {
  it("shield absorbs damage before HP", () => {
    const unit = testUnit("meeps", { x: 0, y: 0 });
    unit.shield = 10;
    unit.maxShield = 10;
    applyMechDamage(unit, 6);
    expect(unit.shield).toBe(4);
    expect(unit.currentHp).toBe(unit.maxHp); // untouched
    expect(unit.tookDamageThisCycle).toBe(true);
  });

  it("overflow past a depleted shield hits HP", () => {
    const unit = testUnit("meeps", { x: 0, y: 0 });
    unit.shield = 10;
    unit.maxShield = 10;
    const hpBefore = unit.currentHp;
    applyMechDamage(unit, 15);
    expect(unit.shield).toBe(0);
    expect(unit.currentHp).toBe(hpBefore - 5);
  });

  it("zero damage (e.g. a Meeps dodge) does not flag tookDamageThisCycle", () => {
    const unit = testUnit("meeps", { x: 0, y: 0 });
    applyMechDamage(unit, 0);
    expect(unit.tookDamageThisCycle).toBeFalsy();
  });
});

describe("Mission — Tank shield regen tick", () => {
  // Mission 1a's objective is eliminate_all, so a fully-cleared hostile
  // side would instantly finish the mission via checkWinLoss and skip
  // straight past runHostileTurn/environmentStep. Keep exactly one hostile
  // alive but stripped of the ability to move or attack, so the turn cycle
  // runs normally through the real public endPlayerTurn() flow.
  // Idempotent — safe to call again after each endPlayerTurn() to catch
  // hostiles spawned mid-mission by scripted events (mission 1a's turn-4
  // collapse ambush) before they ever get a chance to act.
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

  it("an ally adjacent to Thyns gains maxShield and regens it when undamaged", () => {
    const mission = new Mission(MISSION_1A);
    neutralizeHostiles(mission);
    const tank = mission.units.find((u) => u.pilotId === "pilot_thyns")!;
    const ally = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    tank.pos = { x: 5, y: 5 };
    ally.pos = { x: 6, y: 5 };
    expect(ally.shield ?? 0).toBe(0);

    mission.endPlayerTurn();

    expect(ally.maxShield).toBe(TANK_SHIELD_CAPACITY);
    expect(ally.shield).toBe(TANK_SHIELD_REGEN_PER_TURN);
  });

  it("does not regen a unit that took damage during the cycle", () => {
    const mission = new Mission(MISSION_1A);
    neutralizeHostiles(mission);
    const tank = mission.units.find((u) => u.pilotId === "pilot_thyns")!;
    const ally = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    tank.pos = { x: 5, y: 5 };
    ally.pos = { x: 6, y: 5 };
    ally.shield = 12;
    ally.maxShield = TANK_SHIELD_CAPACITY;
    ally.tookDamageThisCycle = true; // simulate having been hit earlier this cycle

    mission.endPlayerTurn();
    expect(ally.shield).toBe(12); // unchanged — no regen this tick
  });

  it("shield and maxShield drop to 0 once the ally leaves the Tank's radius", () => {
    const mission = new Mission(MISSION_1A);
    neutralizeHostiles(mission);
    const tank = mission.units.find((u) => u.pilotId === "pilot_thyns")!;
    const ally = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    tank.pos = { x: 5, y: 5 };
    ally.pos = { x: 15, y: 5 }; // far away
    ally.shield = 10;
    ally.maxShield = TANK_SHIELD_CAPACITY;

    mission.endPlayerTurn();
    expect(ally.shield).toBe(0);
    expect(ally.maxShield).toBe(0);
  });

  it("Thyns shields himself too, regenerating the same way when undamaged", () => {
    const mission = new Mission(MISSION_1A);
    neutralizeHostiles(mission);
    const tank = mission.units.find((u) => u.pilotId === "pilot_thyns")!;
    tank.pos = { x: 5, y: 5 };

    mission.endPlayerTurn();
    expect(tank.maxShield).toBe(TANK_SHIELD_CAPACITY);
    expect(tank.shield).toBe(TANK_SHIELD_REGEN_PER_TURN);
  });

  it("shield caps at TANK_SHIELD_CAPACITY across repeated undamaged turns", () => {
    const mission = new Mission(MISSION_1A);
    neutralizeHostiles(mission);
    const tank = mission.units.find((u) => u.pilotId === "pilot_thyns")!;
    const ally = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    tank.pos = { x: 5, y: 5 };
    ally.pos = { x: 6, y: 5 };

    const turns = Math.ceil(TANK_SHIELD_CAPACITY / TANK_SHIELD_REGEN_PER_TURN) + 2;
    for (let i = 0; i < turns; i++) {
      if (mission.outcome !== "ongoing") break;
      mission.endPlayerTurn();
      neutralizeHostiles(mission); // catch mission 1a's turn-4 ambush before it can act
    }
    expect(ally.shield).toBe(TANK_SHIELD_CAPACITY);
  });
});
