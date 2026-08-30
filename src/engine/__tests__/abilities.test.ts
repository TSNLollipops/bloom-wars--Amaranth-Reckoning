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
//
// STEALTH CLOAK REDESIGN (30 Aug 2026) — abil_ambush's own describe block
// below was rewritten for this pass. Maxime, asked directly what "real
// stealth" meant for the ability: "stealth cloak 3 turn, can move whilestealth.
// can attack while stealth. does 2x dmg after exiting stealth. its to give
// sweep a pvp use too and make ambush something usefull in game." The
// original version below — built on Overwatch's reactive held-shot trigger,
// one shot out of one turn of concealment — is gone; see engine/mission.ts's
// ambush()/resolveAttack() and data/abilities.ts's abil_ambush entry for the
// full new mechanic. The sensor-sweep block right above also gained one new
// test for the isVisibleTo change this redesign required (revealedUntilTurn
// now beats concealed, not just burrowed) — that is the literal "give sweep
// a pvp use" half of the request.
import { describe, it, expect } from "vitest";
import { Mission } from "../mission";
import { AMARANTH_MISSION_1, AMARANTH_MISSION_8 } from "../../data/campaignAmaranth";
import { createHostileMechUnit, createBloomUnit, type BattleUnit } from "../units";
import { chebyshevDistance } from "../grid";
import { unitsVisibleToSide, decideHostileAction, isVisibleTo } from "../ai";
import {
  MAX_ACTIONS_PER_TURN,
  SENSOR_SWEEP_RANGE_BONUS,
  SENSOR_SWEEP_CHARGES_PER_MISSION,
  INTERDICT_RADIUS,
  SCREEN_RADIUS,
  AMBUSH_STEALTH_DURATION,
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
    // 1 action, turn continues — the charge count is the price, not the action budget.
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

  it("is a per-mission budget, not a cooldown: usable back-to-back the same turn, spent for good after SENSOR_SWEEP_CHARGES_PER_MISSION uses, and time does not refill it", () => {
    const mission = quietMission();
    const anand = pilot(mission, "pilot_anand", { x: 4, y: 6 });
    anand.vision = 3;

    expect(SENSOR_SWEEP_CHARGES_PER_MISSION).toBe(2); // pins the actual request ("two charge each mission") to the test
    expect(mission.sensorSweepChargesRemaining(anand.instanceId)).toBe(SENSOR_SWEEP_CHARGES_PER_MISSION);

    // First charge: usable immediately, no cooldown gate — nothing stops a
    // second sweep the very same turn if a charge remains.
    expect(mission.sensorSweep(anand.instanceId)).not.toBeNull();
    expect(mission.sensorSweepChargesRemaining(anand.instanceId)).toBe(1);
    expect(mission.canSensorSweep(anand.instanceId)).toBe(true);

    // Second (last) charge, spent the same turn.
    expect(mission.sensorSweep(anand.instanceId)).not.toBeNull();
    expect(mission.sensorSweepChargesRemaining(anand.instanceId)).toBe(0);
    // Restore a full action budget and confirm it's the charge count, not
    // the action economy, doing the refusing.
    anand.actionsRemaining = MAX_ACTIONS_PER_TURN;
    expect(mission.canSensorSweep(anand.instanceId)).toBe(false);
    expect(mission.sensorSweep(anand.instanceId)).toBeNull();

    // Unlike a cooldown, turns passing do not bring a charge back.
    for (let t = 0; t < 5; t++) mission.endPlayerTurn();
    expect(mission.canSensorSweep(anand.instanceId)).toBe(false);
    expect(mission.sensorSweepChargesRemaining(anand.instanceId)).toBe(0);
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
    expect(mission.sensorSweepChargesRemaining(anand.instanceId)).toBe(SENSOR_SWEEP_CHARGES_PER_MISSION - 1);
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

    // Spend every charge (not just one — a charge budget survives a single use).
    for (let i = 0; i < SENSOR_SWEEP_CHARGES_PER_MISSION; i++) {
      anand.actionsRemaining = MAX_ACTIONS_PER_TURN; // isolate the charge check from the action economy
      mission.sensorSweep(anand.instanceId);
    }
    expect(mission.sensorSweepChargesRemaining(anand.instanceId)).toBe(0);
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

  it("PVP-READINESS: a swept unit is visible through concealment, not just through burrow (stealth cloak redesign, 30 Aug 2026)", () => {
    // Before this pass, isVisibleTo checked `concealed` BEFORE
    // revealedUntilTurn, so a painted abil_ambush/abil_screen unit stayed
    // invisible no matter what — sensorSweep()'s own revealedUntilTurn write
    // only ever mattered against burrow. That is the literal gap Maxime's
    // "give sweep a pvp use" line was about: with Ambush now a 3-round
    // cloak worth actually hunting, Sweep needs to be able to find it.
    // canSensorSweep is player-only today (no hostile-side use exists yet —
    // see its own comment in engine/mission.ts), so this drives isVisibleTo
    // directly rather than through mission.sensorSweep(), which is the same
    // primitive both a real sweep and a future PvP mode would ultimately
    // read.
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 9, y: 1 });
    const observer = mover(mission, { x: 9, y: 4 });

    mission.ambush(rourke.instanceId);
    expect(isVisibleTo(observer, rourke, mission.turn)).toBe(false); // cloaked, unpainted: still hidden

    rourke.revealedUntilTurn = mission.turn;
    expect(isVisibleTo(observer, rourke, mission.turn)).toBe(true); // painted: found despite the cloak
    expect(rourke.concealed).toBe(true); // revealing is not surfacing — same rule burrow already had

    rourke.revealedUntilTurn = undefined;
    expect(isVisibleTo(observer, rourke, mission.turn)).toBe(false); // unpainted again: the cloak holds
  });
});

// =====================================================================
// abil_ambush — Meeps
// =====================================================================

describe("Mission.ambush (abil_ambush — Meeps)", () => {
  it("conceals, arms the multi-turn cloak, spends the whole budget, and logs it", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 9, y: 1 });
    expect(rourke.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN);

    expect(mission.canAmbush(rourke.instanceId)).toBe(true);
    expect(mission.ambush(rourke.instanceId)).toBe(true);

    expect(rourke.concealed).toBe(true);
    expect(rourke.stealthTurnsRemaining).toBe(AMBUSH_STEALTH_DURATION);
    // No longer a held shot — see the redesign's own comment in mission.ts.
    expect(rourke.overwatch).toBeFalsy();
    expect(rourke.actionsRemaining).toBe(0);
    expect(logsMatching(mission, `vanishes — cloaked for ${AMBUSH_STEALTH_DURATION} turns.`).length).toBe(1);
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

  it("FOG: the hostile AI cannot see a cloaked unit — it walks alongside, and the cloak stays silent", () => {
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
    // Redesign, 30 Aug 2026: the cloak is no longer a held shot. Walking
    // alongside it draws nothing at all — the original version of this test
    // pinned an overwatch shot firing right here; that code path is gone.
    expect(logsMatching(mission, "fires overwatch").length).toBe(0);
    // Still cloaked with two of its three rounds left — this is round 1 of
    // AMBUSH_STEALTH_DURATION, not an expiry.
    expect(rourke.concealed).toBe(true);
    expect(rourke.stealthTurnsRemaining).toBe(AMBUSH_STEALTH_DURATION - 1);
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

  it("STEALTH CLOAK: moves and attacks freely on a later turn while still concealed, and the decloak strike deals AMBUSH_DECLOAK_DAMAGE_MULTIPLIER damage", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 9, y: 1 });
    // Blind and immobile — it does nothing on its own hostile-phase turn
    // either way, so the test isolates "does a cloaked unit's OWN next turn
    // work normally" from "can the hostile AI see through the cloak,"
    // already covered by the FOG test above.
    const hostile = mover(mission, { x: 9, y: 4 }, { moveRange: 0, vision: 0, canCounter: false });

    mission.ambush(rourke.instanceId);
    mission.endPlayerTurn(); // hostile phase of round 1 — cloak survives it either way

    expect(mission.turn).toBe(2);
    expect(rourke.concealed).toBe(true);
    expect(rourke.stealthTurnsRemaining).toBe(AMBUSH_STEALTH_DURATION - 1);
    expect(rourke.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN); // a completely normal turn, just hidden

    // Move into range while still cloaked — nothing about movement touches
    // concealment at all; only attacking does.
    expect(mission.moveUnit(rourke.instanceId, { x: 9, y: 3 })).toBe(true);
    expect(rourke.concealed).toBe(true);
    expect(chebyshevDistance(rourke.pos, hostile.pos)).toBe(1);

    const before = hostile.currentHp;
    expect(mission.attack(rourke.instanceId, hostile.instanceId)).not.toBeNull();
    const dealt = before - hostile.currentHp;

    expect(dealt).toBeGreaterThan(0);
    expect(logsMatching(mission, "DECLOAK STRIKE").length).toBe(1);
    // Attacking is the trade: broke the cloak for good, this mission — no
    // re-ambushing off the same activation.
    expect(rourke.concealed).toBe(false);
    expect(rourke.stealthTurnsRemaining).toBeUndefined();
    expect(mission.canAmbush(rourke.instanceId)).toBe(false); // out of actions, not concealed-blocked
  });

  it("the cloak survives AMBUSH_STEALTH_DURATION full rounds untouched, then expires quietly with no bonus", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 9, y: 1 });
    mission.ambush(rourke.instanceId);
    expect(rourke.concealed).toBe(true);
    expect(rourke.stealthTurnsRemaining).toBe(AMBUSH_STEALTH_DURATION);

    for (let round = 1; round <= AMBUSH_STEALTH_DURATION; round++) {
      mission.endPlayerTurn(); // nothing on the board can trigger it — the keeper is blind
      expect(mission.turn).toBe(round + 1);
      expect(rourke.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN); // refreshes every round regardless
      if (round < AMBUSH_STEALTH_DURATION) {
        expect(rourke.concealed).toBe(true);
        expect(rourke.stealthTurnsRemaining).toBe(AMBUSH_STEALTH_DURATION - round);
      } else {
        expect(rourke.concealed).toBe(false);
        expect(rourke.stealthTurnsRemaining).toBeUndefined();
      }
    }
    expect(rourke.overwatch).toBeFalsy(); // never set by this ability anymore
    expect(logsMatching(mission, "fires overwatch").length).toBe(0);
    expect(logsMatching(mission, "DECLOAK STRIKE").length).toBe(0); // expired quietly — no attack ever happened
  });
});

// =====================================================================
// abil_taunt — Meeps, mission-gated (25 Aug 2026, Maxime: "only give them
// the ability for this mission onward" — mission 8, The Choir Sings)
// =====================================================================

/**
 * Mirrors quietMission() but built on Mission 8 instead of Mission 1 —
 * abil_taunt only exists on a Meeps from here on
 * (CampaignMission.bonusAbilityUnlocks, applied at deploy time by
 * Mission.applyBonusAbilityUnlocks), so a test that actually exercises
 * the ability needs a mission where there's something to grant.
 */
function quietMission8(): Mission {
  const mission = new Mission(AMARANTH_MISSION_8);
  for (const u of mission.units) {
    if (u.side === "hostile") u.downed = true;
    else u.pos = { ...PARK[u.pilotId!] };
  }
  const keeper = createHostileMechUnit("hostile_mech_01", { x: 19, y: 11 });
  keeper.vision = 0;
  keeper.moveRange = 0;
  mission.units.push(keeper);
  return mission;
}

describe("Mission.taunt (abil_taunt — Meeps, mission 8 onward)", () => {
  it("is NOT in a Meeps' kit before mission 8 — the mission gate actually gates", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 9, y: 1 });
    expect(rourke.abilities).not.toContain("abil_taunt");
    expect(mission.canTaunt(rourke.instanceId)).toBe(false);
    expect(mission.taunt(rourke.instanceId)).toBe(false);
  });

  it("IS in a Meeps' kit from mission 8 on, layered alongside the normal kit rather than replacing it", () => {
    const mission = quietMission8();
    const rourke = pilot(mission, "pilot_rourke", { x: 9, y: 1 });
    expect(rourke.abilities).toContain("abil_taunt");
    expect(rourke.abilities).toContain("abil_ambush"); // still has its ordinary Meeps kit too
  });

  it("does not mutate the shared, static archetype data — a Mission 1 build afterward still sees no abil_taunt", () => {
    quietMission8();
    const mission1 = quietMission();
    const rourke1 = pilot(mission1, "pilot_rourke", { x: 9, y: 1 });
    expect(rourke1.abilities).not.toContain("abil_taunt");
  });

  it("draws every eye, spends the whole budget, ends the turn, and logs it", () => {
    const mission = quietMission8();
    const rourke = pilot(mission, "pilot_rourke", { x: 9, y: 1 });

    expect(mission.canTaunt(rourke.instanceId)).toBe(true);
    expect(mission.taunt(rourke.instanceId)).toBe(true);

    expect(rourke.taunting).toBe(true);
    expect(rourke.actionsRemaining).toBe(0);
    expect(logsMatching(mission, "draws every eye — taunting.").length).toBe(1);
  });

  it("is REUSABLE — no per-mission charge, no cooldown, same shape as Ambush's own 30 Aug redesign (Maxime: \"make taunt like ambush... no charge, just plain use\")", () => {
    const mission = quietMission8();
    const rourke = pilot(mission, "pilot_rourke", { x: 9, y: 1 });

    expect(mission.taunt(rourke.instanceId)).toBe(true);
    // Out of actions, not blocked by any charge — the SAME turn's second
    // call fails only because taunt() already zeroed actionsRemaining.
    expect(mission.canTaunt(rourke.instanceId)).toBe(false);
    expect(mission.taunt(rourke.instanceId)).toBe(false);

    mission.endPlayerTurn();

    expect(mission.turn).toBe(2);
    // A fresh turn's action budget is back, and so is Taunt — nothing
    // rations it beyond the whole-turn cost each use already pays.
    expect(mission.canTaunt(rourke.instanceId)).toBe(true);
    expect(mission.taunt(rourke.instanceId)).toBe(true);
    expect(logsMatching(mission, "draws every eye").length).toBe(2);
  });

  it("refuses a unit without the ability, a unit out of actions, a downed unit, an unknown id, and any hostile", () => {
    const mission = quietMission8();
    const bosk = pilot(mission, "pilot_bosk", { x: 9, y: 1 }); // Tank — no abil_taunt, mission 8 or not
    expect(bosk.abilities).not.toContain("abil_taunt");
    expect(mission.canTaunt(bosk.instanceId)).toBe(false);
    expect(mission.taunt(bosk.instanceId)).toBe(false);

    expect(mission.taunt("no_such_unit")).toBe(false);

    const hostile = mover(mission, { x: 15, y: 8 });
    hostile.abilities = ["abil_taunt"];
    expect(mission.canTaunt(hostile.instanceId)).toBe(false);
    expect(mission.taunt(hostile.instanceId)).toBe(false);
    expect(hostile.taunting).toBeFalsy();

    const rourke = pilot(mission, "pilot_rourke", { x: 12, y: 1 });
    rourke.actionsRemaining = 0;
    expect(mission.canTaunt(rourke.instanceId)).toBe(false);
    rourke.actionsRemaining = MAX_ACTIONS_PER_TURN;
    rourke.downed = true;
    expect(mission.canTaunt(rourke.instanceId)).toBe(false);
  });

  it("expires at the taunter's next turn start, same loop as concealed/braced — and is immediately usable again, no charge to restock", () => {
    const mission = quietMission8();
    const rourke = pilot(mission, "pilot_rourke", { x: 9, y: 1 });
    mission.taunt(rourke.instanceId);
    expect(rourke.taunting).toBe(true);

    mission.endPlayerTurn(); // nothing on the board can act on it — the keeper is blind

    expect(mission.turn).toBe(2);
    expect(rourke.taunting).toBe(false);
    expect(rourke.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN);
    // Reusable posture, not a spent charge — ready again this same turn.
    expect(mission.canTaunt(rourke.instanceId)).toBe(true);
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

    // The AI's own decision, asked directly: nothing visible, so it can't
    // attack — but per the 30 Aug enemy-roam fallback (engine/ai.ts,
    // idleRoamTarget, ENABLE_ENEMY_ROAM_FALLBACK = true live as of the
    // same day, once Maxime's own call on the campaign sweep's findings
    // came back), a reflexive unit with nothing in sensor range now walks
    // toward the player's own deployZone rather than holding position
    // outright. Concealment still blocks targeting/attacking entirely
    // (isVisibleTo), just not this generalized movement fallback.
    expect(decideHostileAction(mission.map, hostile, mission.units)).toEqual({ path: [{ x: 11, y: 2 }, { x: 11, y: 3 }] });

    mission.endPlayerTurn();

    expect(hostile.pos).toEqual({ x: 11, y: 3 }); // roamed one tile toward the deploy zone — concealment still means no attacker
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
