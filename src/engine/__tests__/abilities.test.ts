// Ability depth per path (Maxime, 23 Aug 2026 — "we really need to make our
// mission last at least 30min. otherwise its a sad game. (my xcom mission
// lasted hours.)"), system 3 of 3, after fog of war (f2e04e4) and overwatch
// (47ab304). Every unit had exactly one verb before this pass, so a turn was
// never a decision; each path gets a second one here:
//
//   Meeps  abil_ambush        go unseen, hold a melee shot
//   Tank   abil_interdict     pin what finishes a move alongside you
//   Reeps  abil_sensor_sweep  paint contacts through the fog (implemented
//                             this pass — it had a Data Pack definition and
//                             no code, and nothing to do before there was a
//                             fog of war to cut)
//   Munti  abil_screen        conceal the huddle, once per mission
//
// The fog-of-war and overwatch interactions are the load-bearing part of the
// design brief, so they get the most coverage: Ambush is built ON the
// overwatch trigger, Interdict hangs off the same hostile-movement choke
// point and is gated by the same vision check, and Sensor Sweep exists
// specifically to defeat that gate.
//
// House test style (see overwatch.test.ts / repair.test.ts / twoAction.test.ts):
// real Mission objects built from a real mission def, with direct unit
// mutation to isolate one scenario on an otherwise quiet board.
import { describe, it, expect } from "vitest";
import { Mission } from "../mission";
import { AMARANTH_MISSION_1 } from "../../data/campaignAmaranth";
import { createHostileMechUnit, createBloomUnit, type BattleUnit } from "../units";
import { chebyshevDistance } from "../grid";
import { unitsVisibleToSide, decideHostileAction } from "../ai";
import {
  MAX_ACTIONS_PER_TURN,
  SENSOR_SWEEP_RANGE_BONUS,
  SENSOR_SWEEP_COOLDOWN_TURNS,
  INTERDICT_RADIUS,
  SCREEN_RADIUS,
} from "../../data/combatTables";

// The Amaranth roster is used rather than Team One's because it carries
// exactly one pilot per new ability — Rourke (Meeps/abil_ambush), Bosk
// (Tank/abil_interdict), Anand (Reeps-vibrissal/abil_sensor_sweep) and Lask
// (Munti/abil_screen) — so every test below runs against a real pilot with a
// real, data-assigned kit rather than a hand-granted one.
const PARK: Record<string, { x: number; y: number }> = {
  pilot_rourke: { x: 0, y: 0 },
  pilot_bosk: { x: 1, y: 0 },
  pilot_iyari: { x: 2, y: 0 },
  pilot_anand: { x: 3, y: 0 },
  pilot_lask: { x: 4, y: 0 },
};

/**
 * A Mission with an otherwise empty board: every wave-spawned hostile
 * downed, the real roster parked in the far top-left corner, and one blind,
 * immobile "keeper" hostile in the opposite corner so eliminate_all doesn't
 * resolve into a win the instant a test kills the unit it cares about.
 * Mirrors overwatch.test.ts's helper of the same name.
 */
function quietMission(): Mission {
  const mission = new Mission(AMARANTH_MISSION_1);
  for (const u of mission.units) {
    if (u.side === "hostile") u.downed = true;
    else u.pos = { ...PARK[u.pilotId!] };
  }
  const keeper = createHostileMechUnit("hostile_mech_01", { x: 19, y: 11 });
  keeper.vision = 0; // sees nothing, so decideHostileAction returns {} — never moves, never shoots
  keeper.moveRange = 0;
  mission.units.push(keeper);
  return mission;
}

function pilot(mission: Mission, pilotId: string, pos?: { x: number; y: number }): BattleUnit {
  const u = mission.units.find((x) => x.pilotId === pilotId)!;
  if (pos) u.pos = { ...pos };
  return u;
}

/** A hostile mech with fully-specified movement/sight, so the tile it ends on is predictable. Mirrors overwatch.test.ts's `mover`. */
function mover(
  mission: Mission,
  pos: { x: number; y: number },
  opts?: { moveRange?: number; vision?: number; hp?: number; attackRange?: [number, number]; canCounter?: boolean }
): BattleUnit {
  const h = createHostileMechUnit("hostile_mech_01", { ...pos });
  h.moveRange = opts?.moveRange ?? 1;
  h.vision = opts?.vision ?? 6;
  h.attackRange = opts?.attackRange ?? [1, 1];
  if (opts?.hp !== undefined) h.currentHp = opts.hp;
  // Off only where a test asserts on the PLAYER unit's HP: an ambusher that
  // fires its own held shot from melee gets countered, and that counter
  // would otherwise be indistinguishable from "the hostile targeted me."
  if (opts?.canCounter !== undefined) h.canCounter = opts.canCounter;
  mission.units.push(h);
  return h;
}

const logsMatching = (mission: Mission, needle: string) => mission.log.filter((l) => l.includes(needle));

// =====================================================================
// abil_sensor_sweep — Reeps (vibrissal chassis)
// =====================================================================

describe("Mission.sensorSweep (abil_sensor_sweep — Reeps)", () => {
  it("paints every hostile inside vision+bonus, costs 1 action, and does NOT end the turn", () => {
    const mission = quietMission();
    const anand = pilot(mission, "pilot_anand", { x: 4, y: 6 });
    anand.vision = 3; // sweep radius therefore 3 + SENSOR_SWEEP_RANGE_BONUS
    const near = mover(mission, { x: 4 + anand.vision + SENSOR_SWEEP_RANGE_BONUS, y: 6 });
    const far = mover(mission, { x: 4 + anand.vision + SENSOR_SWEEP_RANGE_BONUS + 1, y: 6 });

    expect(mission.canSensorSweep(anand.instanceId)).toBe(true);
    const out = mission.sensorSweep(anand.instanceId);

    expect(out).not.toBeNull();
    expect(out!.radius).toBe(anand.vision + SENSOR_SWEEP_RANGE_BONUS);
    expect(out!.revealedIds).toContain(near.instanceId);
    expect(out!.revealedIds).not.toContain(far.instanceId);
    expect(near.revealedUntilTurn).toBe(mission.turn);
    expect(far.revealedUntilTurn).toBeUndefined();
    // 1 action, turn continues — the cooldown is the price, not the budget.
    expect(anand.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN - 1);
    expect(logsMatching(mission, "sweeps (radius 5) — 1 contact(s) painted.").length).toBe(1);
  });

  it("paints a still-burrowed hostile without surfacing it — that is the whole ability", () => {
    const mission = quietMission();
    const anand = pilot(mission, "pilot_anand", { x: 4, y: 6 });
    anand.vision = 3;
    const undertow = createBloomUnit("bloom_undertow", { x: 7, y: 6 }, { burrowed: true });
    mission.units.push(undertow);

    // Before the sweep it is invisible to the entire player side, exactly as
    // the fog-of-war pass and Data Pack §8.1 require.
    expect(unitsVisibleToSide("player", mission.units, mission.turn).has(undertow.instanceId)).toBe(false);

    mission.sensorSweep(anand.instanceId);

    expect(unitsVisibleToSide("player", mission.units, mission.turn).has(undertow.instanceId)).toBe(true);
    expect(mission.isRevealed(undertow.instanceId)).toBe(true);
    // Painted, not dug out: it is still burrowed, so it still gets its
    // surfacing damage bonus when it eventually attacks.
    expect(undertow.burrowed).toBe(true);
  });

  it("the paint expires — a swept contact is hidden again the turn after", () => {
    const mission = quietMission();
    const anand = pilot(mission, "pilot_anand", { x: 4, y: 6 });
    anand.vision = 3;
    const hidden = createBloomUnit("bloom_undertow", { x: 7, y: 6 }, { burrowed: true });
    hidden.moveRange = 0;
    hidden.vision = 0;
    mission.units.push(hidden);

    mission.sensorSweep(anand.instanceId);
    expect(mission.isRevealed(hidden.instanceId)).toBe(true);

    mission.endPlayerTurn(); // covers the whole hostile phase of turn 1, then turn 2 begins

    expect(mission.turn).toBe(2);
    expect(mission.isRevealed(hidden.instanceId)).toBe(false);
    expect(unitsVisibleToSide("player", mission.units, mission.turn).has(hidden.instanceId)).toBe(false);
  });

  it("enforces its cooldown: unusable this turn and the next, ready again on turn + SENSOR_SWEEP_COOLDOWN_TURNS", () => {
    const mission = quietMission();
    const anand = pilot(mission, "pilot_anand", { x: 4, y: 6 });
    anand.vision = 3;

    expect(mission.sensorSweep(anand.instanceId)).not.toBeNull();
    expect(mission.abilityCooldownRemaining(anand.instanceId, "abil_sensor_sweep")).toBe(SENSOR_SWEEP_COOLDOWN_TURNS);
    // Still has an action, still refused.
    expect(anand.actionsRemaining).toBeGreaterThan(0);
    expect(mission.canSensorSweep(anand.instanceId)).toBe(false);
    expect(mission.sensorSweep(anand.instanceId)).toBeNull();

    for (let t = 1; t < SENSOR_SWEEP_COOLDOWN_TURNS; t++) {
      mission.endPlayerTurn();
      expect(mission.canSensorSweep(anand.instanceId)).toBe(false);
    }
    mission.endPlayerTurn();
    expect(mission.turn).toBe(1 + SENSOR_SWEEP_COOLDOWN_TURNS);
    expect(mission.abilityCooldownRemaining(anand.instanceId, "abil_sensor_sweep")).toBe(0);
    expect(mission.canSensorSweep(anand.instanceId)).toBe(true);
  });

  it("refuses a unit without the ability, a spent unit, a downed unit, an unknown id, and any hostile", () => {
    const mission = quietMission();
    const anand = pilot(mission, "pilot_anand", { x: 4, y: 6 });
    const rourke = pilot(mission, "pilot_rourke", { x: 5, y: 6 }); // Meeps bipedal — no vibrissal array

    expect(rourke.abilities).not.toContain("abil_sensor_sweep");
    expect(mission.canSensorSweep(rourke.instanceId)).toBe(false);
    expect(mission.sensorSweep(rourke.instanceId)).toBeNull();

    expect(mission.sensorSweep("no_such_unit")).toBeNull();

    const hostile = mover(mission, { x: 12, y: 6 });
    hostile.abilities = ["abil_sensor_sweep"]; // even handed the ability outright
    expect(mission.canSensorSweep(hostile.instanceId)).toBe(false);
    expect(mission.sensorSweep(hostile.instanceId)).toBeNull();

    anand.actionsRemaining = 0;
    expect(mission.canSensorSweep(anand.instanceId)).toBe(false);
    anand.actionsRemaining = MAX_ACTIONS_PER_TURN;
    anand.downed = true;
    expect(mission.canSensorSweep(anand.instanceId)).toBe(false);
  });

  it("never paints its own side, and still costs the action when it finds nothing", () => {
    const mission = quietMission();
    const anand = pilot(mission, "pilot_anand", { x: 4, y: 6 });
    anand.vision = 3;
    const ally = pilot(mission, "pilot_lask", { x: 5, y: 6 });

    const out = mission.sensorSweep(anand.instanceId);

    expect(out!.revealedIds).toEqual([]);
    expect(ally.revealedUntilTurn).toBeUndefined();
    expect(anand.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN - 1);
    expect(mission.abilityCooldownRemaining(anand.instanceId, "abil_sensor_sweep")).toBe(SENSOR_SWEEP_COOLDOWN_TURNS);
    expect(logsMatching(mission, "no contacts.").length).toBe(1);
  });

  it("getSensorSweepAreaFrom returns the clipped footprint, and nothing once the ability is unusable", () => {
    const mission = quietMission();
    const anand = pilot(mission, "pilot_anand", { x: 0, y: 0 });
    anand.vision = 1; // radius 3, clipped hard by the top-left corner

    const area = mission.getSensorSweepAreaFrom(anand.instanceId, anand.pos);
    const r = anand.vision + SENSOR_SWEEP_RANGE_BONUS;
    expect(area.length).toBe((r + 1) * (r + 1)); // one quadrant of the square survives the clip
    expect(area.every((c) => c.x >= 0 && c.y >= 0 && c.x < mission.map.width && c.y < mission.map.height)).toBe(true);

    mission.sensorSweep(anand.instanceId);
    expect(mission.getSensorSweepAreaFrom(anand.instanceId, anand.pos)).toEqual([]);
  });

  it("FOG + OVERWATCH: an overwatcher CAN reaction-fire at a swept burrower it otherwise could not see", () => {
    // overwatch.test.ts asserts the un-swept version of this exact board:
    // "does NOT fire at a still-burrowed Bloom moving through range." This
    // is the same situation with a Sensor Sweep spent first, and it is the
    // clearest statement of what the ability is for.
    const mission = quietMission();
    const watcher = pilot(mission, "pilot_anand", { x: 8, y: 6 }); // Reeps: attackRange [2,4]
    watcher.vision = 3;
    const bloom = createBloomUnit("bloom_crawlmass", { x: 13, y: 6 }, { burrowed: true });
    bloom.moveRange = 2;
    bloom.vision = 8;
    mission.units.push(bloom);
    const enduranceBefore = bloom.endurance;

    mission.sensorSweep(watcher.instanceId); // 1 action — the held shot is still affordable
    expect(mission.isRevealed(bloom.instanceId)).toBe(true);
    expect(mission.enterOverwatch(watcher.instanceId)).toBe(true);

    mission.endPlayerTurn();

    expect(bloom.pos).not.toEqual({ x: 13, y: 6 });
    expect(chebyshevDistance(bloom.pos, watcher.pos)).toBeLessThanOrEqual(watcher.attackRange[1]);
    expect(bloom.burrowed).toBe(true); // it only moved — the sweep did not surface it
    expect(bloom.endurance).toBeLessThan(enduranceBefore!);
    expect(logsMatching(mission, "fires overwatch").length).toBe(1);
  });
});

// =====================================================================
// abil_ambush — Meeps
// =====================================================================

describe("Mission.ambush (abil_ambush — Meeps)", () => {
  it("conceals, arms the held shot, spends the whole budget, and logs it", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 9, y: 1 });
    expect(rourke.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN);

    expect(mission.canAmbush(rourke.instanceId)).toBe(true);
    expect(mission.ambush(rourke.instanceId)).toBe(true);

    expect(rourke.concealed).toBe(true);
    expect(rourke.overwatch).toBe(true); // reuses the overwatch trigger verbatim — no second code path
    expect(rourke.actionsRemaining).toBe(0);
    expect(logsMatching(mission, "goes to ground — concealed, holding a shot.").length).toBe(1);
  });

  it("costs the whole budget even with one action already spent — no move-shoot-vanish", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 9, y: 1 });
    expect(mission.moveUnit(rourke.instanceId, { x: 9, y: 2 })).toBe(true);
    expect(rourke.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN - 1);

    expect(mission.ambush(rourke.instanceId)).toBe(true);
    expect(rourke.actionsRemaining).toBe(0);
  });

  it("REFUSES with a hostile already adjacent — the line that keeps it from strictly beating Overwatch", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 9, y: 2 });
    const adjacent = mover(mission, { x: 10, y: 2 });

    expect(chebyshevDistance(rourke.pos, adjacent.pos)).toBe(1);
    expect(mission.canAmbush(rourke.instanceId)).toBe(false);
    expect(mission.ambush(rourke.instanceId)).toBe(false);
    expect(rourke.concealed).toBeFalsy();
    // Overwatch, the general-purpose version, still works in contact.
    expect(mission.canEnterOverwatch(rourke.instanceId)).toBe(true);

    // ...and a BURROWED hostile in contact blocks it too: the check is raw
    // adjacency, not visibility. You are in contact with it whether or not
    // you can see it.
    adjacent.downed = true;
    const buried = createBloomUnit("bloom_undertow", { x: 8, y: 2 }, { burrowed: true });
    mission.units.push(buried);
    expect(mission.canAmbush(rourke.instanceId)).toBe(false);
  });

  it("refuses a unit without the ability, a spent unit, a downed unit, a repeat, and any hostile", () => {
    const mission = quietMission();
    const bosk = pilot(mission, "pilot_bosk", { x: 9, y: 4 }); // Tank — no abil_ambush
    expect(bosk.abilities).not.toContain("abil_ambush");
    expect(mission.canAmbush(bosk.instanceId)).toBe(false);
    expect(mission.ambush(bosk.instanceId)).toBe(false);

    expect(mission.ambush("no_such_unit")).toBe(false);

    const hostile = mover(mission, { x: 15, y: 8 });
    hostile.abilities = ["abil_ambush"];
    expect(mission.canAmbush(hostile.instanceId)).toBe(false);
    expect(mission.ambush(hostile.instanceId)).toBe(false);
    expect(hostile.concealed).toBeFalsy();

    const rourke = pilot(mission, "pilot_rourke", { x: 9, y: 1 });
    expect(mission.ambush(rourke.instanceId)).toBe(true);
    expect(mission.canAmbush(rourke.instanceId)).toBe(false); // already concealed AND out of actions
    expect(mission.ambush(rourke.instanceId)).toBe(false);

    const iyari = pilot(mission, "pilot_iyari", { x: 12, y: 1 });
    iyari.downed = true;
    expect(mission.canAmbush(iyari.instanceId)).toBe(false);
  });

  it("FOG: the hostile AI cannot see a concealed unit — it walks alongside instead of attacking it", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 9, y: 1 });
    const bait = pilot(mission, "pilot_iyari", { x: 7, y: 2 });
    const hostile = mover(mission, { x: 11, y: 2 }, { moveRange: 1, vision: 6, canCounter: false });
    expect(chebyshevDistance(hostile.pos, rourke.pos)).toBe(2); // out of contact, so Ambush is legal

    mission.ambush(rourke.instanceId);
    mission.endPlayerTurn();

    // It closed on the bait it CAN see, ending directly alongside a Meeps it
    // never registered, and never attacked Rourke.
    expect(hostile.pos).toEqual({ x: 10, y: 2 });
    expect(chebyshevDistance(hostile.pos, rourke.pos)).toBe(1);
    expect(rourke.currentHp).toBe(rourke.maxHp); // it never chose him as a target at all
    expect(logsMatching(mission, `attacks ${rourke.displayName}`).length).toBe(0);
    expect(bait.currentHp).toBe(bait.maxHp); // never got in range of the bait either
    // ...and it walked into the held shot on the way, which is the payoff.
    expect(logsMatching(mission, `${rourke.displayName} fires overwatch`).length).toBe(1);
  });

  it("CONTROL for the test above: unconcealed, the same hostile ends on the same tile and attacks", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 9, y: 1 });
    pilot(mission, "pilot_iyari", { x: 7, y: 2 });
    const hostile = mover(mission, { x: 11, y: 2 }, { moveRange: 1, vision: 6, canCounter: false });

    mission.endPlayerTurn(); // no ambush this time

    expect(hostile.pos).toEqual({ x: 10, y: 2 }); // identical move, opposite outcome
    // The log line, not the HP: Rourke is a Meeps, so MEEPS_DODGE_CHANCE can
    // legitimately turn this hit into a 0. What matters is that the hostile
    // CHOSE him — which is exactly what concealment prevents above.
    expect(logsMatching(mission, `attacks ${rourke.displayName}`).length).toBe(1);
  });

  it("OVERWATCH: the held shot fires on the hostile that walks alongside, and firing breaks concealment", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 9, y: 1 });
    pilot(mission, "pilot_iyari", { x: 7, y: 2 });
    const hostile = mover(mission, { x: 11, y: 2 }, { moveRange: 1, vision: 6 });

    mission.ambush(rourke.instanceId);
    mission.endPlayerTurn();

    expect(hostile.currentHp).toBeLessThan(hostile.maxHp);
    expect(logsMatching(mission, `${rourke.displayName} fires overwatch`).length).toBe(1);
    expect(rourke.concealed).toBe(false); // gave the position away by shooting
    expect(rourke.overwatch).toBe(false); // one shot per held shot, same as Overwatch
  });

  it("both flags expire at the ambusher's next turn start, in the same place actions refresh", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 9, y: 1 });
    mission.ambush(rourke.instanceId);
    expect(rourke.concealed).toBe(true);

    mission.endPlayerTurn(); // nothing on the board can trigger it — the keeper is blind

    expect(mission.turn).toBe(2);
    expect(rourke.concealed).toBe(false);
    expect(rourke.overwatch).toBe(false);
    expect(rourke.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN);
    expect(logsMatching(mission, "fires overwatch").length).toBe(0);
  });
});

// =====================================================================
// abil_interdict — Tank
// =====================================================================

describe("Mission.interdict (abil_interdict — Tank)", () => {
  it("braces, spends the whole budget, and logs it", () => {
    const mission = quietMission();
    const bosk = pilot(mission, "pilot_bosk", { x: 9, y: 1 });

    expect(mission.canInterdict(bosk.instanceId)).toBe(true);
    expect(mission.interdict(bosk.instanceId)).toBe(true);

    expect(bosk.braced).toBe(true);
    expect(bosk.actionsRemaining).toBe(0);
    expect(logsMatching(mission, "braces — interdicting the ground around it.").length).toBe(1);
  });

  it("refuses a unit without the ability, a spent unit, a downed unit, a repeat, and any hostile", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 9, y: 1 }); // Meeps — no abil_interdict
    expect(rourke.abilities).not.toContain("abil_interdict");
    expect(mission.canInterdict(rourke.instanceId)).toBe(false);
    expect(mission.interdict(rourke.instanceId)).toBe(false);

    expect(mission.interdict("no_such_unit")).toBe(false);

    const hostile = mover(mission, { x: 15, y: 8 });
    hostile.abilities = ["abil_interdict"];
    expect(mission.canInterdict(hostile.instanceId)).toBe(false);
    expect(mission.interdict(hostile.instanceId)).toBe(false);
    expect(hostile.braced).toBeFalsy();

    const bosk = pilot(mission, "pilot_bosk", { x: 12, y: 1 });
    expect(mission.interdict(bosk.instanceId)).toBe(true);
    expect(mission.canInterdict(bosk.instanceId)).toBe(false);
    expect(mission.interdict(bosk.instanceId)).toBe(false);

    bosk.braced = false;
    bosk.actionsRemaining = 0;
    expect(mission.canInterdict(bosk.instanceId)).toBe(false);
    bosk.actionsRemaining = MAX_ACTIONS_PER_TURN;
    bosk.downed = true;
    expect(mission.canInterdict(bosk.instanceId)).toBe(false);
  });

  it("pins a hostile that finishes a move alongside it — the hostile's attack never happens", () => {
    const mission = quietMission();
    const bosk = pilot(mission, "pilot_bosk", { x: 9, y: 1 });
    const hostile = mover(mission, { x: 11, y: 2 }, { moveRange: 1, vision: 6 });

    mission.interdict(bosk.instanceId);
    mission.endPlayerTurn();

    expect(hostile.pos).toEqual({ x: 10, y: 2 });
    expect(chebyshevDistance(bosk.pos, hostile.pos)).toBeLessThanOrEqual(INTERDICT_RADIUS);
    // NB: actionsRemaining is not asserted after the phase — runHostileTurn
    // refreshes every living unit's budget when the next player turn starts,
    // so the observable proof of the pin is the log pair below.
    expect(logsMatching(mission, `interdicts ${hostile.displayName} — pinned, no attack.`).length).toBe(1);
    expect(logsMatching(mission, `attacks ${bosk.displayName}`).length).toBe(0);
    expect(bosk.currentHp).toBe(bosk.maxHp);
  });

  it("CONTROL for the test above: unbraced, the same move-then-attack lands", () => {
    const mission = quietMission();
    const bosk = pilot(mission, "pilot_bosk", { x: 9, y: 1 });
    const hostile = mover(mission, { x: 11, y: 2 }, { moveRange: 1, vision: 6 });

    mission.endPlayerTurn(); // no brace this time

    expect(hostile.pos).toEqual({ x: 10, y: 2 });
    expect(logsMatching(mission, `attacks ${bosk.displayName}`).length).toBe(1);
    expect(bosk.currentHp).toBeLessThan(bosk.maxHp);
  });

  it("does NOT pin a hostile that stops outside the ring — a ranged attacker walks free", () => {
    const mission = quietMission();
    const bosk = pilot(mission, "pilot_bosk", { x: 9, y: 1 });
    const hostile = mover(mission, { x: 12, y: 2 }, { moveRange: 1, vision: 6, attackRange: [2, 2] });

    mission.interdict(bosk.instanceId);
    mission.endPlayerTurn();

    expect(chebyshevDistance(bosk.pos, hostile.pos)).toBeGreaterThan(INTERDICT_RADIUS);
    expect(logsMatching(mission, "interdicts").length).toBe(0);
    expect(logsMatching(mission, `attacks ${bosk.displayName}`).length).toBe(1);
  });

  it("FOG: does NOT pin a burrowed mover it cannot see — but DOES once a Sensor Sweep has painted it", () => {
    // The vision gate is the same isVisibleTo overwatch uses, which is what
    // makes Anand's array worth an action to a Tank as well as to a shooter.
    const unswept = quietMission();
    {
      const bosk = pilot(unswept, "pilot_bosk", { x: 9, y: 1 });
      const buried = createBloomUnit("bloom_crawlmass", { x: 11, y: 2 }, { burrowed: true });
      buried.moveRange = 1;
      buried.vision = 6;
      unswept.units.push(buried);
      unswept.interdict(bosk.instanceId);
      unswept.endPlayerTurn();

      expect(chebyshevDistance(bosk.pos, buried.pos)).toBeLessThanOrEqual(INTERDICT_RADIUS);
      expect(logsMatching(unswept, "interdicts").length).toBe(0);
      expect(logsMatching(unswept, `attacks ${bosk.displayName}`).length).toBe(1);
    }

    const swept = quietMission();
    {
      const bosk = pilot(swept, "pilot_bosk", { x: 9, y: 1 });
      const anand = pilot(swept, "pilot_anand", { x: 9, y: 5 });
      anand.vision = 3;
      const buried = createBloomUnit("bloom_crawlmass", { x: 11, y: 2 }, { burrowed: true });
      buried.moveRange = 1;
      buried.vision = 6;
      swept.units.push(buried);

      expect(swept.sensorSweep(anand.instanceId)!.revealedIds).toContain(buried.instanceId);
      swept.interdict(bosk.instanceId);
      swept.endPlayerTurn();

      expect(chebyshevDistance(bosk.pos, buried.pos)).toBeLessThanOrEqual(INTERDICT_RADIUS);
      expect(logsMatching(swept, `interdicts ${buried.displayName}`).length).toBe(1);
      expect(logsMatching(swept, `attacks ${bosk.displayName}`).length).toBe(0);
    }
  });

  it("is NOT consumed by a pin — one braced Tank stops every mover that steps into its ring that phase", () => {
    const mission = quietMission();
    const bosk = pilot(mission, "pilot_bosk", { x: 9, y: 1 });
    const first = mover(mission, { x: 11, y: 1 }, { moveRange: 1, vision: 6 });
    const second = mover(mission, { x: 11, y: 2 }, { moveRange: 1, vision: 6 });

    mission.interdict(bosk.instanceId);
    mission.endPlayerTurn();

    expect(logsMatching(mission, `interdicts ${first.displayName}`).length).toBeGreaterThanOrEqual(1);
    expect(logsMatching(mission, "interdicts").length).toBe(2);
    expect(second.pos).not.toEqual({ x: 11, y: 2 }); // it really did move into the ring
    expect(logsMatching(mission, `attacks ${bosk.displayName}`).length).toBe(0);
    expect(bosk.currentHp).toBe(bosk.maxHp);
  });

  it("OVERWATCH ORDERING: a mover killed by reaction fire on the way in is not also pinned", () => {
    const mission = quietMission();
    const bosk = pilot(mission, "pilot_bosk", { x: 9, y: 1 });
    const watcher = pilot(mission, "pilot_anand", { x: 9, y: 5 }); // Reeps, attackRange [2,4]
    const hostile = mover(mission, { x: 11, y: 2 }, { moveRange: 1, vision: 2, hp: 1 });

    mission.interdict(bosk.instanceId);
    mission.enterOverwatch(watcher.instanceId);
    mission.endPlayerTurn();

    expect(hostile.downed).toBe(true);
    expect(logsMatching(mission, "fires overwatch").length).toBe(1);
    expect(logsMatching(mission, "interdicts").length).toBe(0); // nothing left to pin
  });

  it("CONTROL for the ordering test: a mover that survives the reaction shot still gets pinned", () => {
    const mission = quietMission();
    const bosk = pilot(mission, "pilot_bosk", { x: 9, y: 1 });
    const watcher = pilot(mission, "pilot_anand", { x: 9, y: 5 });
    const hostile = mover(mission, { x: 11, y: 2 }, { moveRange: 1, vision: 2 }); // full HP

    mission.interdict(bosk.instanceId);
    mission.enterOverwatch(watcher.instanceId);
    mission.endPlayerTurn();

    expect(hostile.downed).toBe(false);
    expect(logsMatching(mission, "fires overwatch").length).toBe(1);
    expect(logsMatching(mission, "interdicts").length).toBe(1);
  });

  it("expires at the Tank's next turn start, and interdictedTiles/getInterdictedTilesFrom report the two states", () => {
    const mission = quietMission();
    const bosk = pilot(mission, "pilot_bosk", { x: 9, y: 1 });

    // Before: the preview is populated, the tell is not.
    expect(mission.getInterdictedTilesFrom(bosk.instanceId, bosk.pos).length).toBe(8);
    expect(mission.getInterdictedTilesFrom(bosk.instanceId, bosk.pos).some((c) => c.x === bosk.pos.x && c.y === bosk.pos.y)).toBe(false);
    expect(mission.interdictedTiles(bosk.instanceId)).toEqual([]);

    mission.interdict(bosk.instanceId);

    // After: the tell is populated, the preview is not.
    expect(mission.getInterdictedTilesFrom(bosk.instanceId, bosk.pos)).toEqual([]);
    expect(mission.interdictedTiles(bosk.instanceId).length).toBe(8);

    mission.endPlayerTurn();
    expect(mission.turn).toBe(2);
    expect(bosk.braced).toBe(false);
    expect(mission.interdictedTiles(bosk.instanceId)).toEqual([]);
  });
});

// =====================================================================
// abil_screen — Munti
// =====================================================================

describe("Mission.screenAllies (abil_screen — Munti)", () => {
  it("conceals itself plus everyone inside SCREEN_RADIUS, costs 1 action, and does NOT end the turn", () => {
    const mission = quietMission();
    const lask = pilot(mission, "pilot_lask", { x: 9, y: 2 });
    const close = pilot(mission, "pilot_rourke", { x: 10, y: 2 });
    const far = pilot(mission, "pilot_iyari", { x: 9 + SCREEN_RADIUS + 1, y: 4 });
    const hostile = mover(mission, { x: 9, y: 3 });

    expect(mission.canScreen(lask.instanceId)).toBe(true);
    const out = mission.screenAllies(lask.instanceId);

    expect(out).not.toBeNull();
    expect(out!.concealedIds).toEqual(expect.arrayContaining([lask.instanceId, close.instanceId]));
    expect(out!.concealedIds).not.toContain(far.instanceId);
    expect(out!.concealedIds).not.toContain(hostile.instanceId); // never covers the other side
    expect(lask.concealed).toBe(true);
    expect(close.concealed).toBe(true);
    expect(far.concealed).toBeFalsy();
    expect(hostile.concealed).toBeFalsy();
    // 1 action, turn continues — screen-then-Repair is the point.
    expect(lask.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN - 1);
    expect(logsMatching(mission, "puts up a screen — 2 unit(s) concealed.").length).toBe(1);
  });

  it("is ONCE PER MISSION — refused on the second use even with actions and turns to spare", () => {
    const mission = quietMission();
    const lask = pilot(mission, "pilot_lask", { x: 9, y: 2 });

    expect(mission.screenAllies(lask.instanceId)).not.toBeNull();
    expect(lask.usedScreenThisMission).toBe(true);
    expect(lask.actionsRemaining).toBeGreaterThan(0);
    expect(mission.canScreen(lask.instanceId)).toBe(false);
    expect(mission.screenAllies(lask.instanceId)).toBeNull();

    mission.endPlayerTurn();
    mission.endPlayerTurn();

    expect(mission.turn).toBe(3);
    expect(lask.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN);
    expect(mission.canScreen(lask.instanceId)).toBe(false); // spent, not cooling
    expect(mission.screenAllies(lask.instanceId)).toBeNull();
    expect(logsMatching(mission, "puts up a screen").length).toBe(1);
  });

  it("refuses a unit without the ability, a spent unit, a downed unit, an unknown id, and any hostile", () => {
    const mission = quietMission();
    const bosk = pilot(mission, "pilot_bosk", { x: 9, y: 2 }); // Tank — no abil_screen
    expect(bosk.abilities).not.toContain("abil_screen");
    expect(mission.canScreen(bosk.instanceId)).toBe(false);
    expect(mission.screenAllies(bosk.instanceId)).toBeNull();

    expect(mission.screenAllies("no_such_unit")).toBeNull();

    const hostile = mover(mission, { x: 15, y: 8 });
    hostile.abilities = ["abil_screen"];
    expect(mission.canScreen(hostile.instanceId)).toBe(false);
    expect(mission.screenAllies(hostile.instanceId)).toBeNull();

    const lask = pilot(mission, "pilot_lask", { x: 11, y: 2 });
    lask.actionsRemaining = 0;
    expect(mission.canScreen(lask.instanceId)).toBe(false);
    lask.actionsRemaining = MAX_ACTIONS_PER_TURN;
    lask.downed = true;
    expect(mission.canScreen(lask.instanceId)).toBe(false);
  });

  it("getScreenableFrom includes the Munti itself, and empties once the screen is spent", () => {
    const mission = quietMission();
    const lask = pilot(mission, "pilot_lask", { x: 9, y: 2 });
    const close = pilot(mission, "pilot_rourke", { x: 10, y: 2 });
    pilot(mission, "pilot_iyari", { x: 15, y: 8 });

    const ids = mission.getScreenableFrom(lask.instanceId, lask.pos).map((u) => u.instanceId);
    expect(ids).toEqual(expect.arrayContaining([lask.instanceId, close.instanceId]));
    expect(ids.length).toBe(2);

    mission.screenAllies(lask.instanceId);
    expect(mission.getScreenableFrom(lask.instanceId, lask.pos)).toEqual([]);
  });

  it("FOG: the covered squad has no attacker for a phase, and the paint lifts at their next turn", () => {
    const mission = quietMission();
    const lask = pilot(mission, "pilot_lask", { x: 9, y: 2 });
    const covered = pilot(mission, "pilot_rourke", { x: 10, y: 2 });
    const hostile = mover(mission, { x: 11, y: 2 }, { moveRange: 1, vision: 6 });

    mission.screenAllies(lask.instanceId);

    // The AI's own decision, asked directly: nothing visible, so nothing to do.
    expect(decideHostileAction(mission.map, hostile, mission.units)).toEqual({});

    mission.endPlayerTurn();

    expect(hostile.pos).toEqual({ x: 11, y: 2 }); // held position — reflexive tier, no target in sensor range
    expect(covered.currentHp).toBe(covered.maxHp);
    expect(lask.currentHp).toBe(lask.maxHp);
    expect(logsMatching(mission, "attacks").length).toBe(0);

    expect(mission.turn).toBe(2);
    expect(lask.concealed).toBe(false);
    expect(covered.concealed).toBe(false);
  });

  it("concealment breaks per unit: the one that shoots is exposed, the rest of the screen holds", () => {
    const mission = quietMission();
    const lask = pilot(mission, "pilot_lask", { x: 9, y: 2 });
    const shooter = pilot(mission, "pilot_rourke", { x: 10, y: 2 });
    const target = mover(mission, { x: 11, y: 2 }, { moveRange: 0, vision: 0 });

    mission.screenAllies(lask.instanceId);
    expect(shooter.concealed).toBe(true);

    expect(mission.attack(shooter.instanceId, target.instanceId)).not.toBeNull();

    expect(shooter.concealed).toBe(false);
    expect(lask.concealed).toBe(true);
  });
});

// =====================================================================
// The hostile AI, against units carrying the new abilities.
// =====================================================================

describe("Hostile AI against the new abilities", () => {
  it("is never taught to use them: hostile mechs carry the archetype abilities but every verb refuses them", () => {
    // Hostile mechs resolve through arch_<path>_bipedal, so a hostile Tank
    // really does have abil_interdict in its array now. The side guard in
    // each predicate is what makes that inert.
    const mission = quietMission();
    const hostileTank = mover(mission, { x: 14, y: 8 });
    expect(hostileTank.abilities).toContain("abil_interdict");
    expect(mission.canInterdict(hostileTank.instanceId)).toBe(false);
    expect(mission.canEnterOverwatch(hostileTank.instanceId)).toBe(false);
    expect(mission.canAmbush(hostileTank.instanceId)).toBe(false);
    expect(mission.canScreen(hostileTank.instanceId)).toBe(false);
    expect(mission.canSensorSweep(hostileTank.instanceId)).toBe(false);
  });

  it("survives a whole phase with every player unit concealed — no crash, no stall, decisions still returned", () => {
    const mission = quietMission();
    const lask = pilot(mission, "pilot_lask", { x: 9, y: 2 });
    for (const u of mission.units) if (u.side === "player") u.pos = { x: 9, y: 2 };
    // Put them on legal, distinct tiles around Lask so the screen covers all five.
    pilot(mission, "pilot_rourke", { x: 8, y: 2 });
    pilot(mission, "pilot_bosk", { x: 10, y: 2 });
    pilot(mission, "pilot_iyari", { x: 9, y: 1 });
    pilot(mission, "pilot_anand", { x: 9, y: 3 });
    const hunters = [mover(mission, { x: 12, y: 2 }, { moveRange: 2, vision: 9 }), mover(mission, { x: 13, y: 3 }, { moveRange: 2, vision: 9 })];

    const out = mission.screenAllies(lask.instanceId);
    expect(out!.concealedIds.length).toBe(5);

    expect(() => mission.endPlayerTurn()).not.toThrow();

    expect(mission.outcome).toBe("ongoing");
    expect(mission.turn).toBe(2);
    for (const h of hunters) expect(h.pos).toEqual(expect.objectContaining({ y: expect.any(Number) }));
    expect(logsMatching(mission, "attacks").length).toBe(0);
  });

  it("survives having its movement budget taken away mid-phase — later hostiles still act normally", () => {
    // Interdiction zeroes actionsRemaining inside moveHostile, i.e. halfway
    // through runHostileTurn's per-unit loop. The rest of the phase has to
    // carry on: this asserts a second, un-pinned hostile still gets its
    // attack off in the same phase the first one was pinned in.
    const mission = quietMission();
    const bosk = pilot(mission, "pilot_bosk", { x: 9, y: 1 });
    // A Reeps as the second bait, not a Meeps: MEEPS_DODGE_CHANCE would make
    // the damage assertion below a coin flip.
    const bait = pilot(mission, "pilot_anand", { x: 3, y: 8 });
    const pinned = mover(mission, { x: 11, y: 2 }, { moveRange: 1, vision: 6 });
    const free = mover(mission, { x: 4, y: 8 }, { moveRange: 1, vision: 6 });

    mission.interdict(bosk.instanceId);
    mission.endPlayerTurn();

    expect(logsMatching(mission, `interdicts ${pinned.displayName}`).length).toBe(1);
    expect(logsMatching(mission, `attacks ${bosk.displayName}`).length).toBe(0);
    // The un-pinned hostile, activated later in the same phase, is unaffected.
    expect(logsMatching(mission, `attacks ${bait.displayName}`).length).toBe(1);
    expect(bait.currentHp).toBeLessThan(bait.maxHp);
    expect(free.downed).toBe(false);
    expect(mission.outcome).toBe("ongoing");
  });
});
