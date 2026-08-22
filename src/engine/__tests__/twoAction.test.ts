// Two-action-per-turn house rule (data/combatTables.ts MAX_ACTIONS_PER_TURN,
// Maxime, 22 Aug 2026): replaces the old movedThisTurn/actedThisTurn
// booleans with a single actionsRemaining counter on every unit. Move and
// Repair each cost 1 action and do NOT end the turn; Attack always consumes
// every remaining action and ends the turn, regardless of which slot it's
// used in. Verified against XCOM 2's real Medikit rule (xcom.fandom.com)
// before building this. These tests exercise the general engine-wide
// mechanic; repair.test.ts covers the Munti-medic "heal two different
// allies" scenario specifically, since that's the concrete case Maxime
// asked for ("id build munties like medics in xcom").
import { describe, it, expect } from "vitest";
import { Mission } from "../mission";
import { MISSION_1A } from "../../data/campaign";
import { MAX_ACTIONS_PER_TURN } from "../../data/combatTables";

describe("Two-action-per-turn house rule", () => {
  it("a unit can move twice in one turn, consuming both actions", () => {
    const mission = new Mission(MISSION_1A);
    const unit = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    unit.pos = { x: 5, y: 5 };
    expect(unit.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN);

    expect(mission.moveUnit(unit.instanceId, { x: 6, y: 5 })).toBe(true);
    expect(unit.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN - 1);
    expect(unit.pos).toEqual({ x: 6, y: 5 });

    // Still has an action left — can move again.
    expect(mission.getReachableTiles(unit.instanceId).length).toBeGreaterThan(0);
    expect(mission.moveUnit(unit.instanceId, { x: 7, y: 5 })).toBe(true);
    expect(unit.actionsRemaining).toBe(0);
    expect(unit.pos).toEqual({ x: 7, y: 5 });

    // Out of actions now.
    expect(mission.getReachableTiles(unit.instanceId)).toEqual([]);
    expect(mission.moveUnit(unit.instanceId, { x: 8, y: 5 })).toBe(false);
  });

  it("a healer can move adjacent to a wounded ally, then Repair — Move first doesn't cost the Repair its action", () => {
    const mission = new Mission(MISSION_1A);
    const healer = mission.units.find((u) => u.pilotId === "pilot_barasj")!;
    const ally = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    healer.pos = { x: 5, y: 5 };
    ally.pos = { x: 7, y: 5 }; // two tiles off — not adjacent yet
    ally.currentHp -= 20;

    // Not adjacent yet — Repair isn't offered.
    expect(mission.getRepairableFrom(healer.instanceId, healer.pos)).toEqual([]);

    expect(mission.moveUnit(healer.instanceId, { x: 6, y: 5 })).toBe(true);
    expect(healer.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN - 1);

    // Now adjacent, and still has an action to spend on Repair.
    const repairable = mission.getRepairableFrom(healer.instanceId, healer.pos);
    expect(repairable.map((u) => u.instanceId)).toEqual([ally.instanceId]);

    const result = mission.repairUnit(healer.instanceId, ally.instanceId);
    expect(result).not.toBeNull();
    expect(healer.actionsRemaining).toBe(0);
  });

  it("Attack immediately consumes every remaining action and ends the turn, even as the very first action", () => {
    const mission = new Mission(MISSION_1A);
    const attacker = mission.units.find((u) => u.pilotId === "pilot_thyns")!;
    const enemy = mission.units.find((u) => u.side === "hostile")!;
    attacker.pos = { x: 5, y: 5 };
    enemy.pos = { x: 6, y: 5 };
    expect(attacker.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN);

    const result = mission.attack(attacker.instanceId, enemy.instanceId);
    expect(result).not.toBeNull();
    expect(attacker.actionsRemaining).toBe(0);

    // No actions left for anything else this turn.
    expect(mission.moveUnit(attacker.instanceId, { x: 5, y: 6 })).toBe(false);
    expect(mission.getReachableTiles(attacker.instanceId)).toEqual([]);
    expect(mission.attack(attacker.instanceId, enemy.instanceId)).toBeNull();
  });

  it("Attack after one Move still zeroes actionsRemaining outright, not just -1", () => {
    const mission = new Mission(MISSION_1A);
    const attacker = mission.units.find((u) => u.pilotId === "pilot_thyns")!;
    const enemy = mission.units.find((u) => u.side === "hostile")!;
    attacker.pos = { x: 5, y: 5 };
    enemy.pos = { x: 7, y: 5 };

    expect(mission.moveUnit(attacker.instanceId, { x: 6, y: 5 })).toBe(true);
    expect(attacker.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN - 1);

    const result = mission.attack(attacker.instanceId, enemy.instanceId);
    expect(result).not.toBeNull();
    expect(attacker.actionsRemaining).toBe(0); // not MAX_ACTIONS_PER_TURN - 2
  });

  it("actionsRemaining resets to MAX_ACTIONS_PER_TURN at the start of the next player turn", () => {
    const mission = new Mission(MISSION_1A);
    const hostiles = mission.units.filter((u) => u.side === "hostile" && !u.downed);
    const [keep, ...rest] = hostiles;
    for (const u of rest) u.downed = true;
    if (keep) {
      keep.moveRange = 0;
      keep.attackRange = [99, 99];
      keep.pos = { x: 0, y: 0 };
    }
    const unit = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    unit.pos = { x: 5, y: 5 };
    mission.moveUnit(unit.instanceId, { x: 6, y: 5 });
    expect(unit.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN - 1);

    mission.endPlayerTurn();
    expect(unit.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN);
  });
});
