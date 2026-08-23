// Overwatch / reaction fire (Maxime, 23 Aug 2026 — "we really need to make
// our mission last at least 30min. otherwise its a sad game. (my xcom
// mission lasted hours.)"), system 2 of 3, after fog of war (commit
// f2e04e4). A player unit can spend its remaining actions holding fire; any
// hostile that MOVES within its range AND its sight during the hostile
// phase eats one free shot, resolved through the exact same attack path a
// normal shot uses. The fog-of-war interaction is the load-bearing part —
// an overwatcher shoots at what it can see, not at every tile inside a
// radius — so it gets the most coverage here.
//
// House test style: real Mission objects built from the real mission def,
// with direct unit mutation to isolate one scenario on an otherwise quiet
// board (see twoAction.test.ts / repair.test.ts).
import { describe, it, expect } from "vitest";
import { Mission } from "../mission";
import { MISSION_1A } from "../../data/campaign";
import { createHostileMechUnit, createBloomUnit, type BattleUnit } from "../units";
import { chebyshevDistance } from "../grid";
import { MAX_ACTIONS_PER_TURN } from "../../data/combatTables";

// Every scenario runs along row y=6 of map_city_sweep_01, x 2..15: the one
// straight corridor on that map with no rubble in it, so a mover's cost-1
// steps land where the comments say they do, and with no tile that deals
// turn-start damage (bloom_mat) or heals (deploy pads) underneath an HP
// assertion. The real roster is parked in the far top-left corner, well
// outside every vision stat used below, so nothing but the scenario moves.
const PARK: Record<string, { x: number; y: number }> = {
  pilot_thyns: { x: 0, y: 0 },
  pilot_barasj: { x: 1, y: 0 },
  pilot_nagori: { x: 2, y: 0 },
  pilot_tourignie: { x: 3, y: 0 },
  pilot_trav: { x: 4, y: 0 },
};

/**
 * A Mission with an otherwise empty board: every wave-spawned hostile
 * downed, the real roster parked far out of everyone's vision, and one
 * blind, immobile "keeper" hostile left alive so eliminate_all doesn't
 * resolve into a win the instant a test kills the unit it cares about.
 */
function quietMission(): Mission {
  const mission = new Mission(MISSION_1A);
  for (const u of mission.units) {
    if (u.side === "hostile") u.downed = true;
    else u.pos = { ...PARK[u.pilotId!] };
  }
  const keeper = createHostileMechUnit("hostile_mech_01", { x: 17, y: 11 });
  keeper.vision = 0; // sees nothing, so decideHostileAction returns {} — never moves, never shoots
  keeper.moveRange = 0;
  mission.units.push(keeper);
  return mission;
}

/** The overwatcher used throughout: Yren Tourignie, Reeps — never counters, never dodges (Meeps-only house rule), so nothing here depends on a random roll. */
function overwatcher(mission: Mission, pos = { x: 8, y: 6 }): BattleUnit {
  const u = mission.units.find((x) => x.pilotId === "pilot_tourignie")!;
  u.pos = { ...pos };
  return u;
}

/** A hostile that will walk toward whatever it can see, with fully-specified movement so the tile it ends on is predictable. */
function mover(mission: Mission, pos: { x: number; y: number }, opts?: { moveRange?: number; vision?: number; hp?: number }): BattleUnit {
  const h = createHostileMechUnit("hostile_mech_01", { ...pos });
  h.moveRange = opts?.moveRange ?? 2;
  h.vision = opts?.vision ?? 6;
  h.attackRange = [1, 1];
  if (opts?.hp !== undefined) h.currentHp = opts.hp;
  mission.units.push(h);
  return h;
}

function overwatchShots(mission: Mission): string[] {
  return mission.log.filter((l) => l.includes("fires overwatch"));
}

describe("Mission.enterOverwatch", () => {
  it("consumes every remaining action, sets the flag, and logs it", () => {
    const mission = quietMission();
    const unit = overwatcher(mission);
    expect(unit.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN);

    expect(mission.canEnterOverwatch(unit.instanceId)).toBe(true);
    expect(mission.enterOverwatch(unit.instanceId)).toBe(true);
    expect(unit.overwatch).toBe(true);
    expect(unit.actionsRemaining).toBe(0);
    expect(mission.log.some((l) => l.includes("Yren Tourignie holds overwatch"))).toBe(true);
  });

  it("costs the whole budget even with only one action left — no shoot-then-overwatch double dip", () => {
    const mission = quietMission();
    const unit = overwatcher(mission);
    expect(mission.moveUnit(unit.instanceId, { x: 9, y: 6 })).toBe(true);
    expect(unit.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN - 1);

    expect(mission.enterOverwatch(unit.instanceId)).toBe(true);
    expect(unit.actionsRemaining).toBe(0);
  });

  it("refuses a unit with no actions left", () => {
    const mission = quietMission();
    const unit = overwatcher(mission);
    unit.actionsRemaining = 0;

    expect(mission.canEnterOverwatch(unit.instanceId)).toBe(false);
    expect(mission.enterOverwatch(unit.instanceId)).toBe(false);
    expect(unit.overwatch).toBeFalsy();
  });

  it("refuses a second entry while already in overwatch", () => {
    const mission = quietMission();
    const unit = overwatcher(mission);
    expect(mission.enterOverwatch(unit.instanceId)).toBe(true);

    expect(mission.canEnterOverwatch(unit.instanceId)).toBe(false);
    expect(mission.enterOverwatch(unit.instanceId)).toBe(false);
    expect(unit.overwatch).toBe(true);
    expect(overwatchShots(mission).length).toBe(0);
  });

  it("refuses a downed unit, an unknown id, and (this pass) any hostile", () => {
    const mission = quietMission();
    const unit = overwatcher(mission);
    unit.downed = true;
    expect(mission.enterOverwatch(unit.instanceId)).toBe(false);

    expect(mission.enterOverwatch("no_such_unit")).toBe(false);

    // Hostile-side overwatch is deliberately out of scope — see the
    // overwatch block comment in engine/mission.ts.
    const hostile = mover(mission, { x: 12, y: 6 });
    expect(mission.canEnterOverwatch(hostile.instanceId)).toBe(false);
    expect(mission.enterOverwatch(hostile.instanceId)).toBe(false);
    expect(hostile.overwatch).toBeFalsy();
  });
});

describe("Overwatch reaction fire", () => {
  it("fires at a hostile that moves into range and sight during the hostile phase", () => {
    const mission = quietMission();
    const watcher = overwatcher(mission); // Reeps: attackRange [2,4], vision 7
    const hostile = mover(mission, { x: 13, y: 6 }); // moveRange 2 -> ends 3 tiles off: in range, in sight
    mission.enterOverwatch(watcher.instanceId);

    mission.endPlayerTurn();

    expect(chebyshevDistance(hostile.pos, watcher.pos)).toBe(3);
    expect(hostile.currentHp).toBeLessThan(hostile.maxHp);
    expect(overwatchShots(mission).length).toBe(1);
    expect(overwatchShots(mission)[0]).toContain("Yren Tourignie fires overwatch on Unmarked Mech");
  });

  it("does NOT fire at a hostile that moves in range but outside the overwatcher's vision (fog of war)", () => {
    // The whole point of pairing overwatch with commit f2e04e4: an
    // overwatcher covers what it can SEE, not a bare radius. Same board and
    // same hostile move as the test above — only the watcher's vision stat
    // changes, so a failure here can only be the vision gate.
    const mission = quietMission();
    const watcher = overwatcher(mission);
    watcher.vision = 1; // the hostile lands 3 tiles away: inside attackRange [2,4], well outside sight
    const hostile = mover(mission, { x: 13, y: 6 });
    mission.enterOverwatch(watcher.instanceId);

    mission.endPlayerTurn();

    // It really did move, and landed squarely inside attackRange — the
    // vision gate is the only thing that stopped the shot.
    expect(hostile.pos).not.toEqual({ x: 13, y: 6 });
    expect(chebyshevDistance(hostile.pos, watcher.pos)).toBe(3);
    expect(hostile.currentHp).toBe(hostile.maxHp);
    expect(overwatchShots(mission).length).toBe(0);
  });

  it("does NOT fire at a still-burrowed Bloom moving through range — isVisibleTo treats burrowed as unseen", () => {
    // The other half of the same gate: a burrowed unit is "not drawn/
    // targetable" (Data Pack §8.1) no matter how close it gets, and
    // isVisibleTo is what encodes that. An overwatcher must not shoot
    // something the player cannot even see on the board.
    const mission = quietMission();
    const watcher = overwatcher(mission); // vision 7, range [2,4]
    const bloom = createBloomUnit("bloom_crawlmass", { x: 13, y: 6 }, { burrowed: true });
    bloom.moveRange = 2;
    bloom.vision = 8;
    mission.units.push(bloom);
    mission.enterOverwatch(watcher.instanceId);

    const enduranceBefore = bloom.endurance;
    mission.endPlayerTurn();

    expect(bloom.pos).not.toEqual({ x: 13, y: 6 });
    expect(chebyshevDistance(bloom.pos, watcher.pos)).toBeLessThanOrEqual(watcher.attackRange[1]);
    expect(bloom.burrowed).toBe(true); // never surfaced — it only moved
    expect(bloom.endurance).toBe(enduranceBefore);
    expect(bloom.currentHp).toBe(bloom.maxHp);
    expect(overwatchShots(mission).length).toBe(0);
  });

  it("does NOT fire at a hostile that moves while staying outside attackRange", () => {
    const mission = quietMission();
    const watcher = overwatcher(mission); // range [2,4], vision 7 — the mover stays visible the whole time
    const hostile = mover(mission, { x: 14, y: 6 }, { moveRange: 1 }); // ends 5 tiles off: seen, but out of reach
    mission.enterOverwatch(watcher.instanceId);

    mission.endPlayerTurn();

    expect(hostile.pos).not.toEqual({ x: 14, y: 6 });
    expect(chebyshevDistance(hostile.pos, watcher.pos)).toBeGreaterThan(watcher.attackRange[1]);
    expect(chebyshevDistance(hostile.pos, watcher.pos)).toBeLessThanOrEqual(watcher.vision); // seen, just unreachable
    expect(hostile.currentHp).toBe(hostile.maxHp);
    expect(overwatchShots(mission).length).toBe(0);
  });

  it("does NOT fire at a hostile that moves inside the Reeps minimum range", () => {
    // attackRange is a band, not a radius: a Reeps holding overwatch at
    // [2,4] cannot shoot something that walks into its face.
    const mission = quietMission();
    const watcher = overwatcher(mission);
    const hostile = mover(mission, { x: 11, y: 6 }, { moveRange: 3 }); // closes to melee (distance 1) to attack
    mission.enterOverwatch(watcher.instanceId);

    mission.endPlayerTurn();

    expect(chebyshevDistance(hostile.pos, watcher.pos)).toBe(1); // inside the dead zone, and plainly visible
    expect(hostile.currentHp).toBe(hostile.maxHp);
    expect(overwatchShots(mission).length).toBe(0);
  });

  it("fires once per overwatch — a second hostile moving in the same phase is not shot by the same unit", () => {
    // Both movers finish inside the same [2,4] band and the same sight
    // radius; the only thing separating them is that the first one already
    // spent the held shot.
    const mission = quietMission();
    const watcher = overwatcher(mission);
    const first = mover(mission, { x: 13, y: 6 });
    const second = mover(mission, { x: 14, y: 6 });
    mission.enterOverwatch(watcher.instanceId);

    mission.endPlayerTurn();

    expect(chebyshevDistance(second.pos, watcher.pos)).toBeLessThanOrEqual(watcher.attackRange[1]);
    expect(chebyshevDistance(second.pos, watcher.pos)).toBeGreaterThanOrEqual(watcher.attackRange[0]);
    expect(overwatchShots(mission).length).toBe(1);
    expect(first.currentHp).toBeLessThan(first.maxHp);
    expect(second.currentHp).toBe(second.maxHp);
  });

  it("never fires from a downed overwatcher", () => {
    const mission = quietMission();
    const watcher = overwatcher(mission);
    mission.enterOverwatch(watcher.instanceId);
    watcher.downed = true;

    // Something still alive for the hostile to walk toward, so the move
    // itself definitely happens.
    const bait = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    bait.pos = { x: 2, y: 6 };
    const hostile = mover(mission, { x: 13, y: 6 }, { vision: 20 });

    mission.endPlayerTurn();

    // The mover ends inside what would have been a perfectly good firing
    // solution, had the overwatcher been alive to take it.
    expect(hostile.pos).not.toEqual({ x: 13, y: 6 });
    expect(chebyshevDistance(hostile.pos, watcher.pos)).toBeLessThanOrEqual(watcher.attackRange[1]);
    expect(chebyshevDistance(hostile.pos, watcher.pos)).toBeGreaterThanOrEqual(watcher.attackRange[0]);
    expect(hostile.currentHp).toBe(hostile.maxHp);
    expect(overwatchShots(mission).length).toBe(0);
  });
});

describe("Overwatch reaction fire — consequences", () => {
  it("a reaction kill is credited through the normal performance path", () => {
    // Reaction shots go through resolveAttack(), the same body attack()
    // uses, so recordPerformance -> resolveKill -> creditKill runs
    // identically and engine/campaignEconomy.ts scores the kill like any
    // other. Asserting on unitPerformance directly is asserting on exactly
    // what that formula reads.
    const mission = quietMission();
    const watcher = overwatcher(mission);
    watcher.attackRange = [1, 4]; // cover the tile the hostile closes to
    const hostile = mover(mission, { x: 11, y: 6 }, { moveRange: 3, hp: 1 });
    mission.enterOverwatch(watcher.instanceId);

    expect(mission.unitPerformance["pilot_tourignie"].kills).toBe(0);
    mission.endPlayerTurn();

    expect(hostile.downed).toBe(true);
    expect(mission.unitPerformance["pilot_tourignie"].kills).toBe(1);
    expect(mission.unitPerformance["pilot_tourignie"].damageDealt).toBeGreaterThan(0);
    expect(mission.log.some((l) => l.includes("Unmarked Mech is downed."))).toBe(true);
  });

  it("a reaction kill cancels that hostile's own attack in the same activation", () => {
    // The hostile's decision was move-then-attack. It dies on the way in,
    // so the attack must never resolve — see runHostileTurn's ordering
    // comment in engine/mission.ts.
    const mission = quietMission();
    const watcher = overwatcher(mission);
    watcher.attackRange = [1, 4];
    const hostile = mover(mission, { x: 11, y: 6 }, { moveRange: 3, hp: 1 });
    mission.enterOverwatch(watcher.instanceId);

    mission.endPlayerTurn();

    expect(hostile.downed).toBe(true);
    expect(watcher.currentHp).toBe(watcher.maxHp);
    expect(mission.log.some((l) => l.includes("Unmarked Mech attacks Yren Tourignie"))).toBe(false);
  });

  it("a hostile that survives the reaction shot still gets its attack off", () => {
    // The control case for the test above: same activation, same ordering,
    // but the reaction doesn't kill — so nothing is cancelled.
    const mission = quietMission();
    const watcher = overwatcher(mission);
    watcher.attackRange = [1, 4];
    const hostile = mover(mission, { x: 11, y: 6 }, { moveRange: 3 }); // full HP — survives one Reeps shot
    mission.enterOverwatch(watcher.instanceId);

    mission.endPlayerTurn();

    expect(hostile.downed).toBe(false);
    expect(overwatchShots(mission).length).toBe(1);
    expect(mission.log.some((l) => l.includes("Unmarked Mech attacks Yren Tourignie"))).toBe(true);
    expect(watcher.currentHp).toBeLessThan(watcher.maxHp);
  });

  it("persists through the hostile phase and clears at the overwatcher's next turn start", () => {
    const mission = quietMission();
    const watcher = overwatcher(mission);
    mission.enterOverwatch(watcher.instanceId);
    expect(watcher.overwatch).toBe(true);

    mission.endPlayerTurn(); // nothing on the board can trigger it — only the keeper is alive, and it is blind

    expect(mission.turn).toBe(2);
    expect(watcher.overwatch).toBe(false);
    expect(watcher.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN); // cleared in the same place actions refresh
    expect(overwatchShots(mission).length).toBe(0);
  });
});
