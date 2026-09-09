// Enemy-phase playback's structured log (feature-gap report A4, 9 Sep
// 2026 — "im at school i cant try thing with my hand. can we do 2-3,"
// Maxime, picking this over Electron packaging). HostilePhaseEvent is a
// pure side channel: runHostileTurn() resolves the whole hostile phase
// exactly as before, and this array records what it did so scenes/Battle.ts
// can animate the replay afterward. These tests pin the engine half only —
// what gets pushed, in what order, and when it resets — not the Phaser-side
// playback, which this codebase's test suite doesn't reach (see the header
// note on src/engine vs scenes elsewhere in this project).
//
// House test style: real Mission objects built from the real mission def,
// with direct unit mutation to isolate one scenario on an otherwise quiet
// board (see overwatch.test.ts / twoAction.test.ts / repair.test.ts).
import { describe, it, expect } from "vitest";
import { Mission, type HostilePhaseEvent } from "../mission";
import { MISSION_1A } from "../../data/campaign";
import { createHostileMechUnit, type BattleUnit } from "../units";
import { chebyshevDistance } from "../grid";

const PARK: Record<string, { x: number; y: number }> = {
  pilot_thyns: { x: 0, y: 0 },
  pilot_barasj: { x: 1, y: 0 },
  pilot_nagori: { x: 2, y: 0 },
  pilot_tourignie: { x: 3, y: 0 },
  pilot_voss: { x: 4, y: 0 },
};

/** Same quiet-board fixture as overwatch.test.ts — see that file's own comment. */
function quietMission(): Mission {
  const mission = new Mission(MISSION_1A);
  for (const u of mission.units) {
    if (u.side === "hostile") u.downed = true;
    else u.pos = { ...PARK[u.pilotId!] };
  }
  const keeper = createHostileMechUnit("hostile_mech_01", { x: 17, y: 11 });
  keeper.vision = 0;
  keeper.moveRange = 0;
  mission.units.push(keeper);
  return mission;
}

function overwatcher(mission: Mission, pos = { x: 8, y: 6 }): BattleUnit {
  const u = mission.units.find((x) => x.pilotId === "pilot_tourignie")!;
  u.pos = { ...pos };
  return u;
}

function mover(mission: Mission, pos: { x: number; y: number }, opts?: { moveRange?: number; vision?: number; hp?: number }): BattleUnit {
  const h = createHostileMechUnit("hostile_mech_01", { ...pos });
  h.moveRange = opts?.moveRange ?? 2;
  h.vision = opts?.vision ?? 6;
  h.attackRange = [1, 1];
  if (opts?.hp !== undefined) h.currentHp = opts.hp;
  mission.units.push(h);
  return h;
}

function moveEvents(events: readonly HostilePhaseEvent[]): Extract<HostilePhaseEvent, { kind: "move" }>[] {
  return events.filter((e): e is Extract<HostilePhaseEvent, { kind: "move" }> => e.kind === "move");
}
function attackEvents(events: readonly HostilePhaseEvent[]): Extract<HostilePhaseEvent, { kind: "attack" }>[] {
  return events.filter((e): e is Extract<HostilePhaseEvent, { kind: "attack" }> => e.kind === "attack");
}

describe("Mission.hostilePhaseEvents", () => {
  it("starts empty and stays empty through a player turn with no hostile phase yet", () => {
    const mission = quietMission();
    expect(mission.hostilePhaseEvents).toEqual([]);
  });

  it("logs a move event for a hostile that walks, with the same path moveHostile actually committed", () => {
    const mission = quietMission();
    const hostile = mover(mission, { x: 13, y: 6 }, { vision: 20 });
    // Something on the far side of the corridor to walk toward — a parked
    // pilot has 0 vision to the hostile's own vision stat, but the hostile
    // still needs a reason to move; give it a bait in sight.
    const bait = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    bait.pos = { x: 2, y: 6 };

    mission.endPlayerTurn();

    const moves = moveEvents(mission.hostilePhaseEvents);
    expect(moves.length).toBe(1);
    expect(moves[0].unitId).toBe(hostile.instanceId);
    // path[0] is the start tile, path.at(-1) is where the engine actually
    // left it — same contract moveUnit's own path has (path.slice(1) is
    // what's walked).
    expect(moves[0].path[0]).toEqual({ x: 13, y: 6 });
    expect(moves[0].path.at(-1)).toEqual(hostile.pos);
    expect(moves[0].path.length).toBeGreaterThan(1);
  });

  it("logs a hostile's own attack as an attack event with the real AttackOutcome", () => {
    const mission = quietMission();
    const watcher = mission.units.find((u) => u.pilotId === "pilot_tourignie")!;
    watcher.pos = { x: 11, y: 6 }; // parked in the hostile's path, no overwatch set — a plain target
    const hostile = mover(mission, { x: 9, y: 6 }, { moveRange: 1 }); // closes to melee range 1

    mission.endPlayerTurn();

    expect(chebyshevDistance(hostile.pos, watcher.pos)).toBe(1);
    const attacks = attackEvents(mission.hostilePhaseEvents);
    expect(attacks.length).toBe(1);
    expect(attacks[0].attackerId).toBe(hostile.instanceId);
    expect(attacks[0].defenderId).toBe(watcher.instanceId);
    expect(attacks[0].outcome.attackerId).toBe(hostile.instanceId);
    expect(attacks[0].outcome.defenderId).toBe(watcher.instanceId);
    expect(attacks[0].outcome.damage).toBeGreaterThan(0);
  });

  it("logs an overwatch reaction shot as an attack event too, attacker on the PLAYER side, even though nobody called attack()", () => {
    // The whole reason resolveAttack() is the push site instead of
    // attack(): a reaction shot never goes through attack() at all (see
    // triggerOverwatch calling resolveAttack directly, mission.ts). If this
    // test only saw the hostile's own move logged, the push site would be
    // wrong.
    const mission = quietMission();
    const watcher = overwatcher(mission); // range [2,4], vision 7
    const hostile = mover(mission, { x: 13, y: 6 }); // lands 3 tiles off: in range, in sight
    mission.enterOverwatch(watcher.instanceId);

    mission.endPlayerTurn();

    const moves = moveEvents(mission.hostilePhaseEvents);
    const attacks = attackEvents(mission.hostilePhaseEvents);
    expect(moves.length).toBe(1);
    expect(attacks.length).toBe(1);
    expect(attacks[0].attackerId).toBe(watcher.instanceId);
    expect(attacks[0].defenderId).toBe(hostile.instanceId);

    // Chronological order: the move that triggered the reaction is logged
    // BEFORE the reaction itself — see moveHostile's own push-before-
    // triggerOverwatch ordering comment in mission.ts.
    const moveIndex = mission.hostilePhaseEvents.indexOf(moves[0]);
    const attackIndex = mission.hostilePhaseEvents.indexOf(attacks[0]);
    expect(moveIndex).toBeLessThan(attackIndex);
  });

  it("never logs interdiction (a pin, not a position/HP change) as an event", () => {
    const mission = quietMission();
    const anchor = mission.units.find((u) => u.pilotId === "pilot_thyns")!;
    anchor.pos = { x: 11, y: 6 };
    anchor.braced = true;
    mover(mission, { x: 13, y: 6 }, { moveRange: 2 }); // walks into the interdict radius

    mission.endPlayerTurn();

    expect(mission.log.some((l) => l.includes("interdicts"))).toBe(true);
    expect(mission.hostilePhaseEvents.length).toBe(moveEvents(mission.hostilePhaseEvents).length);
    // i.e. every event this phase is a move — the pin produced no attack event.
    expect(attackEvents(mission.hostilePhaseEvents).length).toBe(0);
  });

  it("resets at the start of every hostile phase — an earlier phase's events never leak into the next", () => {
    const mission = quietMission();
    const bait = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    bait.pos = { x: 2, y: 6 };
    mover(mission, { x: 13, y: 6 }, { vision: 20, moveRange: 1 }); // moves turn 1, stops short — still has reason to move turn 2

    mission.endPlayerTurn();
    const firstPhaseCount = mission.hostilePhaseEvents.length;
    expect(firstPhaseCount).toBeGreaterThan(0);

    mission.endPlayerTurn(); // turn 2's hostile phase

    // Not simply "still non-zero" (a second phase could coincidentally
    // match) — asserting the array was actually cleared and rebuilt: a
    // stale first-phase move event, if it leaked, would still carry the
    // FIRST phase's path, which started at (13,6). A fresh phase's own
    // move starts wherever the hostile ended up after phase one instead.
    const moves = moveEvents(mission.hostilePhaseEvents);
    expect(moves.length).toBeGreaterThan(0);
    expect(moves[0].path[0]).not.toEqual({ x: 13, y: 6 });
  });

  it("stays empty for a hostile phase where nothing moves or attacks — quiet turn, quiet log", () => {
    const mission = quietMission(); // the only living hostile is the blind, immobile keeper
    mission.endPlayerTurn();
    expect(mission.hostilePhaseEvents).toEqual([]);
  });
});
