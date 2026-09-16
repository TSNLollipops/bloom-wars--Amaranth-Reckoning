// src/engine/__tests__/combatWorry.test.ts
// Worries System, build order step 3, 10 Sep 2026 — engine-side wiring
// tests: does Mission actually push the right classified entry, from the
// right real hook point, onto the right pilot's own combatWorries list?
// classifyCombatWorry() itself (the pure mapping) is covered separately in
// data/__tests__/combatWorry.test.ts. House test style: real Mission
// objects built from the real mission def, direct unit mutation to
// isolate one scenario — same convention repair.test.ts/dodge.test.ts/
// overwatch.test.ts already use.
//
// Roster reference (MISSION_1A, confirmed against those same three files):
// pilot_thyns (Tank), pilot_barasj (Munti, Fieldwright), pilot_nagori
// (Meeps), pilot_tourignie (Reeps).
import { describe, it, expect, vi, afterEach } from "vitest";
import { Mission } from "../mission";
import { createHostileMechUnit, type BattleUnit } from "../units";
import { MISSION_1A } from "../../data/campaign";
import { MAX_ACTIONS_PER_TURN } from "../../data/combatTables";

describe("Mission.combatWorries — starting state", () => {
  it("is an empty object on a freshly constructed Mission", () => {
    const mission = new Mission(MISSION_1A);
    expect(mission.combatWorries).toEqual({});
  });
});

describe("Mission — combat_kill (resolveKill, via attack())", () => {
  afterEach(() => vi.restoreAllMocks());

  it("landing a kill on a hostile pushes combat_kill/shark, context battle, onto the finisher's own list", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99); // Tank never dodges anyway — kept high just so nothing else in the resolver rolls low by accident
    const mission = new Mission(MISSION_1A);
    const attacker = mission.units.find((u) => u.pilotId === "pilot_thyns")!;
    const defender = createHostileMechUnit("hostile_mech_01", { x: 6, y: 5 });
    defender.currentHp = 1; // guarantees the hit downs it, same pattern overwatch.test.ts's own mover(..., {hp:1}) uses
    mission.units.push(defender);
    attacker.pos = { x: 5, y: 5 };

    const outcome = mission.attack(attacker.instanceId, defender.instanceId);
    expect(outcome!.defenderDowned).toBe(true);

    const entries = mission.combatWorries["pilot_thyns"];
    expect(entries).toBeDefined();
    const kill = entries!.find((w) => w.source === "combat_kill");
    expect(kill).toBeDefined();
    expect(kill!.catalyst).toBe("shark");
    expect(kill!.context).toBe("battle");
  });

  it("a hostile finishing a kill (no pilotId) never adds an entry to combatWorries — only player pilots worry", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const mission = new Mission(MISSION_1A);
    const hostile = createHostileMechUnit("hostile_mech_01", { x: 5, y: 5 });
    mission.units.push(hostile);
    const target = mission.units.find((u) => u.pilotId === "pilot_thyns")!; // Tank — no dodge to worry about
    target.pos = { x: 6, y: 5 };
    target.currentHp = 1;

    mission.attack(hostile.instanceId, target.instanceId);
    expect(mission.combatWorries[hostile.instanceId]).toBeUndefined();
  });

  it("a second kill by the same pilot refreshes the one combat_kill entry rather than duplicating it (upsertWorry's own insert-or-refresh)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const mission = new Mission(MISSION_1A);
    const attacker = mission.units.find((u) => u.pilotId === "pilot_thyns")!;
    attacker.pos = { x: 5, y: 5 };
    const targets: BattleUnit[] = [];
    for (let i = 0; i < 2; i++) {
      // attack() always zeroes actionsRemaining (the two-action house rule —
      // any attack ends the unit's turn outright), so a second attack call
      // in the same test needs its own fresh budget, same as a new turn
      // would grant. Real Mission.endPlayerTurn()/startPlayerTurn() would
      // do this refresh too; refreshing it directly keeps this test about
      // the worry-push behavior, not turn-cycling machinery.
      attacker.actionsRemaining = MAX_ACTIONS_PER_TURN;
      const d = createHostileMechUnit("hostile_mech_01", { x: 6, y: 5 });
      d.currentHp = 1;
      mission.units.push(d);
      targets.push(d);
      const outcome = mission.attack(attacker.instanceId, d.instanceId);
      expect(outcome!.defenderDowned).toBe(true);
    }
    const kills = mission.combatWorries["pilot_thyns"]!.filter((w) => w.source === "combat_kill");
    expect(kills).toHaveLength(1);
  });
});

describe("Mission.repairUnit — combat_repair", () => {
  it("Barasj healing 38 HP (Fieldwright, repair.test.ts's own worked example) pushes combat_repair/dog scaled by the actual amount", () => {
    const mission = new Mission(MISSION_1A);
    const healer = mission.units.find((u) => u.pilotId === "pilot_barasj")!;
    const target = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    healer.pos = { x: 5, y: 5 };
    target.pos = { x: 6, y: 5 };
    target.currentHp = target.maxHp - 50;

    const result = mission.repairUnit(healer.instanceId, target.instanceId);
    expect(result!.amount).toBe(38);

    const entries = mission.combatWorries["pilot_barasj"];
    const repair = entries?.find((w) => w.source === "combat_repair");
    expect(repair).toBeDefined();
    expect(repair!.catalyst).toBe("dog");
    expect(repair!.context).toBe("battle");
    expect(repair!.intensity).toBeCloseTo(0.3 + 38 * 0.01);
  });

  it("a repair capped at the target's max HP (5 HP restored, not 38) scales intensity to the SMALLER real amount, not the nominal heal", () => {
    const mission = new Mission(MISSION_1A);
    const healer = mission.units.find((u) => u.pilotId === "pilot_barasj")!;
    const target = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    healer.pos = { x: 5, y: 5 };
    target.pos = { x: 6, y: 5 };
    target.currentHp = target.maxHp - 5;

    const result = mission.repairUnit(healer.instanceId, target.instanceId);
    expect(result!.amount).toBe(5);
    const repair = mission.combatWorries["pilot_barasj"]!.find((w) => w.source === "combat_repair");
    expect(repair!.intensity).toBeCloseTo(0.3 + 5 * 0.01);
  });

  it("a no-op repair (target already at max HP) pushes nothing", () => {
    const mission = new Mission(MISSION_1A);
    const healer = mission.units.find((u) => u.pilotId === "pilot_barasj")!;
    const target = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    healer.pos = { x: 5, y: 5 };
    target.pos = { x: 6, y: 5 };
    target.currentHp = target.maxHp; // nothing to heal

    const result = mission.repairUnit(healer.instanceId, target.instanceId);
    expect(result!.amount).toBe(0);
    expect(mission.combatWorries["pilot_barasj"]).toBeUndefined();
  });
});

/** Ends the mission as a win: every hostile off the board, then the end-of-turn check. */
function winNow(mission: Mission): void {
  for (const u of mission.units) if (u.side === "hostile") u.downed = true;
  mission.endPlayerTurn();
  expect(mission.outcome).toBe("win");
}

describe("Mission.handleDowned — combat_downed and the permadeath-check split", () => {
  afterEach(() => vi.restoreAllMocks());

  it("downing a non-Munti pilot while a Munti is still alive pushes combat_downed/rabbit AND combat_permadeath_recoverable/fox", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99); // pilot_nagori is Meeps — keep the dodge roll from interfering
    const mission = new Mission(MISSION_1A);
    const victim = mission.units.find((u) => u.pilotId === "pilot_nagori")!; // Meeps, not Munti
    const munti = mission.units.find((u) => u.pilotId === "pilot_barasj")!; // stays alive this whole test
    expect(munti.downed).toBe(false);
    victim.currentHp = 1;
    const attacker = createHostileMechUnit("hostile_mech_01", { x: 5, y: 5 });
    mission.units.push(attacker);
    victim.pos = { x: 6, y: 5 };

    const outcome = mission.attack(attacker.instanceId, victim.instanceId);
    expect(outcome!.defenderDowned).toBe(true);

    const entries = mission.combatWorries["pilot_nagori"]!;
    const downed = entries.find((w) => w.source === "combat_downed");
    expect(downed).toBeDefined();
    expect(downed!.catalyst).toBe("rabbit");
    expect(downed!.context).toBe("battle");

    // Ejection capsules (15 Sep 2026): the verdict waits for the end of the
    // mission now. Mid-fight there is a capsule on the board and no verdict.
    expect(entries.find((w) => w.source === "combat_permadeath_recoverable")).toBeUndefined();
    expect(mission.fieldCapsules().some((c) => c.pilotId === "pilot_nagori")).toBe(true);

    winNow(mission); // the Munti is still standing, so the capsule is picked up after the fight
    const after = mission.combatWorries["pilot_nagori"]!;
    const recoverable = after.find((w) => w.source === "combat_permadeath_recoverable");
    expect(recoverable).toBeDefined();
    expect(recoverable!.catalyst).toBe("fox");
    expect(after.find((w) => w.source === "combat_permadeath_lost")).toBeUndefined();
  });

  it("downing the last living Munti pushes combat_downed/rabbit AND combat_permadeath_lost/raven — the heavier verdict", () => {
    const mission = new Mission(MISSION_1A);
    const munti = mission.units.find((u) => u.pilotId === "pilot_barasj")!; // the only Munti in this roster
    munti.currentHp = 1;
    const attacker = createHostileMechUnit("hostile_mech_01", { x: 5, y: 5 });
    mission.units.push(attacker);
    munti.pos = { x: 6, y: 5 };

    const outcome = mission.attack(attacker.instanceId, munti.instanceId);
    expect(outcome!.defenderDowned).toBe(true);

    const entries = mission.combatWorries["pilot_barasj"]!;
    expect(entries.find((w) => w.source === "combat_downed")).toBeDefined();

    expect(entries.find((w) => w.source === "combat_permadeath_lost")).toBeUndefined(); // not decided mid-fight any more

    winNow(mission); // nobody left who can recover the only Munti's own capsule
    const after = mission.combatWorries["pilot_barasj"]!;
    const lost = after.find((w) => w.source === "combat_permadeath_lost");
    expect(lost).toBeDefined();
    expect(lost!.catalyst).toBe("raven");
    expect(after.find((w) => w.source === "combat_permadeath_recoverable")).toBeUndefined();
  });

  it("a hostile going down (no pilotId, no campaign roster) never touches combatWorries", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const mission = new Mission(MISSION_1A);
    const attacker = mission.units.find((u) => u.pilotId === "pilot_thyns")!;
    const hostile = createHostileMechUnit("hostile_mech_01", { x: 6, y: 5 });
    hostile.currentHp = 1;
    mission.units.push(hostile);
    attacker.pos = { x: 5, y: 5 };

    mission.attack(attacker.instanceId, hostile.instanceId);
    expect(mission.combatWorries[hostile.instanceId]).toBeUndefined();
  });
});

describe("Mission.attack — combat_dodge", () => {
  afterEach(() => vi.restoreAllMocks());

  it("a forced Meeps dodge (dodge.test.ts's own proven trick) pushes combat_dodge/cat for the defender who dodged", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.01); // well under MEEPS_DODGE_CHANCE (0.4)
    const mission = new Mission(MISSION_1A);
    const attacker = createHostileMechUnit("hostile_mech_03", { x: 5, y: 5 }); // Meeps-path source — see dodge.test.ts's own comment on why not hostile_mech_01
    mission.units.push(attacker);
    const meeps = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    meeps.pos = { x: 6, y: 5 };

    const outcome = mission.attack(attacker.instanceId, meeps.instanceId);
    expect(outcome!.defenderDodged).toBe(true);

    const dodge = mission.combatWorries["pilot_nagori"]?.find((w) => w.source === "combat_dodge");
    expect(dodge).toBeDefined();
    expect(dodge!.catalyst).toBe("cat");
    expect(dodge!.context).toBe("battle");
  });

  it("a forced high roll (no dodge) pushes nothing to combat_dodge", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const mission = new Mission(MISSION_1A);
    const attacker = createHostileMechUnit("hostile_mech_01", { x: 5, y: 5 });
    mission.units.push(attacker);
    const meeps = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    meeps.pos = { x: 6, y: 5 };

    const outcome = mission.attack(attacker.instanceId, meeps.instanceId);
    expect(outcome!.defenderDodged).toBe(false);
    expect(mission.combatWorries["pilot_nagori"]?.find((w) => w.source === "combat_dodge")).toBeUndefined();
  });
});

describe("Mission — combat_overwatch, an actual reaction shot firing mid hostile-phase", () => {
  // Same "quiet board" convention overwatch.test.ts already established:
  // every wave-spawned hostile downed, the real roster parked well outside
  // vision, one blind immobile keeper hostile so eliminate_all never
  // resolves into a win mid-scenario.
  const PARK: Record<string, { x: number; y: number }> = {
    pilot_thyns: { x: 0, y: 0 },
    pilot_barasj: { x: 1, y: 0 },
    pilot_nagori: { x: 2, y: 0 },
    pilot_tourignie: { x: 3, y: 0 },
    pilot_voss: { x: 4, y: 0 },
  };

  function quietMission(): Mission {
    const mission = new Mission(MISSION_1A);
    for (const u of mission.units) {
      if (u.side === "hostile") u.downed = true;
      else if (u.pilotId && PARK[u.pilotId]) u.pos = { ...PARK[u.pilotId] };
    }
    const keeper = createHostileMechUnit("hostile_mech_01", { x: 17, y: 11 });
    keeper.vision = 0;
    keeper.moveRange = 0;
    mission.units.push(keeper);
    return mission;
  }

  it("a hostile walking into a watcher's overwatch range pushes combat_overwatch/wolf for the watcher, not the mover", () => {
    const mission = quietMission();
    const watcher = mission.units.find((u) => u.pilotId === "pilot_tourignie")!; // Reeps — never counters, never dodges, same reason overwatch.test.ts picks them
    watcher.pos = { x: 8, y: 6 };
    mission.enterOverwatch(watcher.instanceId);

    // Same geometry overwatch.test.ts's own mover() helper defaults to
    // (moveRange 2, vision 6, starting 5 tiles out on the row-6 corridor):
    // it closes to 3 tiles, inside the Reeps' [2,4] band and its own
    // sight. A wider moveRange was tried first and failed — hostile_mech_01
    // is melee-only (attackRange [1,1]), so with room to spare it walks
    // all the way to adjacent range instead, landing inside the Reeps'
    // dead zone (<2) where overwatch deliberately never fires (see that
    // file's own "does NOT fire ... inside the Reeps minimum range" case).
    const mover = createHostileMechUnit("hostile_mech_01", { x: 13, y: 6 });
    mover.moveRange = 2;
    mover.vision = 6;
    mission.units.push(mover);

    mission.endPlayerTurn();
    expect(mission.log.some((l) => l.includes("fires overwatch"))).toBe(true);

    const entries = mission.combatWorries["pilot_tourignie"];
    expect(entries).toBeDefined();
    const overwatch = entries!.find((w) => w.source === "combat_overwatch");
    expect(overwatch).toBeDefined();
    expect(overwatch!.catalyst).toBe("wolf");
    expect(overwatch!.context).toBe("battle");
    // The mover triggered the shot but didn't fire one — no entry for them.
    expect(mission.combatWorries[mover.instanceId]).toBeUndefined();
  });
});
