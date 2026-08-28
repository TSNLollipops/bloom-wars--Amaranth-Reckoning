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

  it("a healer can move into repair range of a wounded ally, then Repair — Move first doesn't cost the Repair its action", () => {
    // Repositioned 28 Aug 2026 (ally 2 tiles -> 4 tiles off): Munti's base
    // Repair range changed 1 -> DEFAULT_REPAIR_RANGE (3) the same day, so
    // the old "2 tiles off, not adjacent yet" premise stopped being true —
    // 2 tiles is inside the new range before the healer even moves. 4
    // tiles keeps this test's actual point (Repair isn't offered until
    // the move closes the distance) true at the new range.
    const mission = new Mission(MISSION_1A);
    const healer = mission.units.find((u) => u.pilotId === "pilot_barasj")!;
    const ally = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    healer.pos = { x: 5, y: 5 };
    ally.pos = { x: 9, y: 5 }; // four tiles off — outside DEFAULT_REPAIR_RANGE (3) until the move
    ally.currentHp -= 20;

    // Out of range — Repair isn't offered.
    expect(mission.getRepairableFrom(healer.instanceId, healer.pos)).toEqual([]);

    expect(mission.moveUnit(healer.instanceId, { x: 6, y: 5 })).toBe(true);
    expect(healer.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN - 1);

    // Now exactly at the range edge (distance 3), and still has an action to spend on Repair.
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

// getMovePath (25 Aug 2026): the read-only path lookup Battle.ts's walk
// animation calls before moveUnit, so it can animate the same route
// moveUnit is about to commit instantly. Mirrors moveUnit's own guards and
// reachability computation exactly, but must never mutate anything — these
// tests exist specifically to pin that down, not just that it returns a
// sensible path.
describe("getMovePath — read-only path lookup for the walk animation", () => {
  it("returns the real route from the unit's current tile to a reachable destination, without moving the unit or spending its action", () => {
    const mission = new Mission(MISSION_1A);
    const unit = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    unit.pos = { x: 5, y: 5 };
    const before = unit.actionsRemaining;

    const path = mission.getMovePath(unit.instanceId, { x: 7, y: 5 });
    expect(path).not.toBeNull();
    expect(path![0]).toEqual({ x: 5, y: 5 });
    expect(path![path!.length - 1]).toEqual({ x: 7, y: 5 });

    // Nothing committed — this is a lookup, not a move.
    expect(unit.pos).toEqual({ x: 5, y: 5 });
    expect(unit.actionsRemaining).toBe(before);
  });

  it("agrees with moveUnit on what's reachable — same destination, same final position when moveUnit actually runs afterward", () => {
    const mission = new Mission(MISSION_1A);
    const unit = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    unit.pos = { x: 5, y: 5 };
    const dest = { x: 6, y: 5 };

    const path = mission.getMovePath(unit.instanceId, dest);
    expect(path).not.toBeNull();

    expect(mission.moveUnit(unit.instanceId, dest)).toBe(true);
    expect(unit.pos).toEqual(dest);
    expect(unit.pos).toEqual(path![path!.length - 1]);
  });

  it("returns null for a tile outside the unit's reachable set, same as moveUnit refusing it", () => {
    const mission = new Mission(MISSION_1A);
    const unit = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    unit.pos = { x: 5, y: 5 };
    const farAway = { x: 5 + unit.moveRange * 5, y: 5 };

    expect(mission.getMovePath(unit.instanceId, farAway)).toBeNull();
    expect(mission.moveUnit(unit.instanceId, farAway)).toBe(false);
  });

  it("returns null once the unit is out of actions, same guard moveUnit itself uses", () => {
    const mission = new Mission(MISSION_1A);
    const unit = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    unit.pos = { x: 5, y: 5 };
    unit.actionsRemaining = 0;

    expect(mission.getMovePath(unit.instanceId, { x: 6, y: 5 })).toBeNull();
  });
});
