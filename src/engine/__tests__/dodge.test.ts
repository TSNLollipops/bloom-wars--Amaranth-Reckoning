// Meeps house rule (data/combatTables.ts MEEPS_DODGE_CHANCE, Maxime,
// 22 Aug 2026, after mission 1a playtesting): 40% dodge on any hit Meeps
// could take — as the primary target of a mech or Bloom attack, AND as
// the counter-damage a Meeps eats after attacking something that counters
// back. The resolver formulas themselves stay untouched and deterministic
// (dodged/counterDodged default to false), so every sim_output.txt case in
// combat.test.ts is unaffected — the actual dice roll only happens at the
// Mission.attack() call site in engine/mission.ts.
import { describe, it, expect, vi, afterEach } from "vitest";
import { resolveMechAttack, bloomDamage } from "../combat";
import { Mission } from "../mission";
import { createHostileMechUnit, createBloomUnit } from "../units";
import { MISSION_1A } from "../../data/campaign";
import { testUnit, makeUniformMap } from "./testHelpers";

describe("resolveMechAttack — dodge params", () => {
  it("defenderDodged=true zeroes the primary hit but leaves the counter untouched", () => {
    const map = makeUniformMap("plain");
    const attacker = testUnit("tank", { x: 0, y: 0 });
    const defender = testUnit("meeps", { x: 1, y: 0 });
    const r = resolveMechAttack(map, attacker, defender, [defender], [attacker], false, true, false);
    expect(r.damage).toBe(0);
    expect(r.dodged).toBe(true);
    expect(r.defenderHpAfter).toBe(defender.currentHp); // untouched — the whole hit whiffed
    expect(r.countered).toBe(true); // defender survived (trivially) and attacker is in counter range
    expect(r.counterDamage).toBeGreaterThan(0);
  });

  it("attackerDodgedCounter=true zeroes only the counter-hit, not the primary damage", () => {
    const map = makeUniformMap("plain");
    const attacker = testUnit("meeps", { x: 0, y: 0 });
    const defender = testUnit("tank", { x: 1, y: 0 });
    const r = resolveMechAttack(map, attacker, defender, [defender], [attacker], false, false, true);
    expect(r.damage).toBeGreaterThan(0);
    expect(r.dodged).toBe(false);
    expect(r.countered).toBe(true);
    expect(r.counterDamage).toBe(0);
    expect(r.counterDodged).toBe(true);
    expect(r.attackerHpAfter).toBe(attacker.currentHp); // untouched
  });

  it("omitting the dodge args reproduces the plain deterministic formula exactly", () => {
    const map = makeUniformMap("plain");
    const attacker = testUnit("tank", { x: 0, y: 0 });
    const defender = testUnit("meeps", { x: 1, y: 0 });
    const withDefaults = resolveMechAttack(map, attacker, defender, [defender], [attacker], false);
    const withExplicitFalse = resolveMechAttack(map, attacker, defender, [defender], [attacker], false, false, false);
    expect(withDefaults).toEqual(withExplicitFalse);
    expect(withDefaults.dodged).toBe(false);
  });
});

describe("bloomDamage — dodge param", () => {
  it("defenderDodged=true returns 0 damage", () => {
    const map = makeUniformMap("plain");
    const attacker = createBloomUnit("bloom_crawlmass", { x: 0, y: 0 });
    const defender = testUnit("meeps", { x: 1, y: 0 });
    const dmgNormal = bloomDamage(attacker, defender, map, [defender], false, false);
    const dmgDodged = bloomDamage(attacker, defender, map, [defender], false, true);
    expect(dmgNormal).toBeGreaterThan(0);
    expect(dmgDodged).toBe(0);
  });
});

describe("Mission.attack — dodge wiring end-to-end", () => {
  afterEach(() => vi.restoreAllMocks());

  it("a forced low Math.random() roll makes a Meeps defender dodge a mech attack and skips damage entirely", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.01); // well under MEEPS_DODGE_CHANCE (0.4)
    const mission = new Mission(MISSION_1A);
    const attacker = createHostileMechUnit("hostile_mech_01", { x: 5, y: 5 });
    mission.units.push(attacker);
    const meeps = mission.units.find((u) => u.pilotId === "pilot_nagori")!; // Meeps/bipedal
    meeps.pos = { x: 6, y: 5 };
    const hpBefore = meeps.currentHp;

    const outcome = mission.attack(attacker.instanceId, meeps.instanceId);
    expect(outcome!.defenderDodged).toBe(true);
    expect(outcome!.damage).toBe(0);
    expect(meeps.currentHp).toBe(hpBefore);
    expect(mission.log.at(-1)).toContain("DODGED (Meeps)");
  });

  it("a forced high Math.random() roll never dodges", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99); // well over MEEPS_DODGE_CHANCE
    const mission = new Mission(MISSION_1A);
    const attacker = createHostileMechUnit("hostile_mech_01", { x: 5, y: 5 });
    mission.units.push(attacker);
    const meeps = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    meeps.pos = { x: 6, y: 5 };

    const outcome = mission.attack(attacker.instanceId, meeps.instanceId);
    expect(outcome!.defenderDodged).toBe(false);
    expect(outcome!.damage).toBeGreaterThan(0);
  });

  it("dodge also applies when Bloom attacks a Meeps defender", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.01);
    const mission = new Mission(MISSION_1A);
    const bloomAttacker = mission.units.find((u) => u.side === "hostile" && u.kind === "bloom")!;
    const meeps = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    bloomAttacker.pos = { x: 5, y: 5 };
    meeps.pos = { x: 6, y: 5 };
    const hpBefore = meeps.currentHp;

    const outcome = mission.attack(bloomAttacker.instanceId, meeps.instanceId);
    expect(outcome!.defenderDodged).toBe(true);
    expect(outcome!.damage).toBe(0);
    expect(meeps.currentHp).toBe(hpBefore);
  });

  it("non-Meeps units never dodge, even with a forced low roll", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.01);
    const mission = new Mission(MISSION_1A);
    const attacker = createHostileMechUnit("hostile_mech_01", { x: 5, y: 5 });
    mission.units.push(attacker);
    const tank = mission.units.find((u) => u.pilotId === "pilot_thyns")!; // Tank, not Meeps
    tank.pos = { x: 6, y: 5 };

    const outcome = mission.attack(attacker.instanceId, tank.instanceId);
    expect(outcome!.defenderDodged).toBe(false);
    expect(outcome!.damage).toBeGreaterThan(0);
  });
});
