// Combat forecast (1 Sep 2026 — feature-gap report A1). The one property
// these tests exist to pin: a forecast is never allowed to disagree with
// the attack that follows it, except by a dodge roll. So every case runs
// forecastAttack(), then the real attack() with Math.random pinned to
// "no dodge", and asserts the numbers match the engine's own outcome —
// the forecast doesn't get its own formula to drift.
//
// House test style (see missileStrike.test.ts): real Mission objects built
// from a real mission def, direct unit mutation to isolate one scenario.
import { describe, it, expect, vi, afterEach } from "vitest";
import { Mission } from "../mission";
import { AMARANTH_MISSION_1 } from "../../data/campaignAmaranth";
import { createHostileMechUnit, createBloomUnit, type BattleUnit } from "../units";
import { MEEPS_DODGE_CHANCE, FIRE_SUPPORT_DAMAGE, AMBUSH_DECLOAK_DAMAGE_MULTIPLIER } from "../../data/combatTables";

const PARK: Record<string, { x: number; y: number }> = {
  pilot_rourke: { x: 0, y: 0 },
  pilot_bosk: { x: 1, y: 0 },
  pilot_iyari: { x: 2, y: 0 },
  pilot_anand: { x: 3, y: 0 },
  pilot_lask: { x: 4, y: 0 },
};

function quietMission(): Mission {
  const mission = new Mission(AMARANTH_MISSION_1);
  for (const u of mission.units) {
    if (u.side === "hostile") u.downed = true;
    else u.pos = { ...PARK[u.pilotId!] };
  }
  return mission;
}

function pilot(mission: Mission, pilotId: string, pos?: { x: number; y: number }): BattleUnit {
  const u = mission.units.find((x) => x.pilotId === pilotId)!;
  if (pos) u.pos = { ...pos };
  return u;
}

afterEach(() => vi.restoreAllMocks());

describe("Mission.forecastAttack", () => {
  it("returns null off-range, same-side, downed, or for a Bloom attacker", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 5, y: 6 });
    const bosk = pilot(mission, "pilot_bosk", { x: 6, y: 6 });
    const hostile = createHostileMechUnit("hostile_mech_01", { x: 12, y: 6 });
    mission.units.push(hostile);
    expect(mission.forecastAttack(rourke.instanceId, hostile.instanceId)).toBeNull(); // out of range
    expect(mission.forecastAttack(rourke.instanceId, bosk.instanceId)).toBeNull(); // same side
    hostile.pos = { x: 6, y: 7 };
    hostile.downed = true;
    expect(mission.forecastAttack(rourke.instanceId, hostile.instanceId)).toBeNull();
    hostile.downed = false;
    expect(mission.forecastAttack(hostile.instanceId, rourke.instanceId)).not.toBeNull(); // a hostile mech is fine — side-agnostic
    const bloom = createBloomUnit("bloom_crawlmass", { x: 5, y: 7 });
    mission.units.push(bloom);
    expect(mission.forecastAttack(bloom.instanceId, rourke.instanceId)).toBeNull();
  });

  it("mech vs mech: forecast damage, HP-after and counter match the real attack with dodges pinned off", () => {
    const mission = quietMission();
    const bosk = pilot(mission, "pilot_bosk", { x: 5, y: 6 }); // Tank — no dodge either direction
    const hostile = createHostileMechUnit("hostile_mech_01", { x: 6, y: 6 });
    mission.units.push(hostile);
    const f = mission.forecastAttack(bosk.instanceId, hostile.instanceId)!;
    expect(f).not.toBeNull();
    expect(f.damage).toBeGreaterThan(0);
    expect(f.dodgeChance).toBe(0);
    vi.spyOn(Math, "random").mockReturnValue(0.99); // never under MEEPS_DODGE_CHANCE
    const hpBefore = hostile.currentHp;
    const shieldBefore = hostile.shield ?? 0;
    const out = mission.attack(bosk.instanceId, hostile.instanceId)!;
    expect(out.damage).toBe(f.damage);
    expect(out.countered).toBe(f.countered);
    expect(out.counterDamage ?? 0).toBe(f.counterDamage);
    expect(hostile.currentHp).toBe(f.defenderHpAfter);
    expect(hostile.downed).toBe(f.defenderDowned);
    expect(bosk.currentHp).toBe(f.attackerHpAfter);
    expect(f.shieldAbsorbed).toBe(Math.min(shieldBefore, f.damage));
    void hpBefore;
  });

  it("reports the Meeps dodge chance on the hit it applies to, and none against a Tank source", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 5, y: 6 }); // Meeps
    const bosk = pilot(mission, "pilot_bosk", { x: 5, y: 8 }); // Tank
    const meepsHostile = createHostileMechUnit("hostile_mech_02", { x: 6, y: 6 });
    expect(meepsHostile.path).toBe("meeps");
    mission.units.push(meepsHostile);
    const fromRourke = mission.forecastAttack(rourke.instanceId, meepsHostile.instanceId)!;
    expect(fromRourke.dodgeChance).toBe(MEEPS_DODGE_CHANCE); // Meeps defender vs non-Tank source
    expect(fromRourke.countered).toBe(true);
    expect(fromRourke.counterDodgeChance).toBe(MEEPS_DODGE_CHANCE); // Rourke is Meeps, counter comes from a Meeps
    meepsHostile.pos = { x: 5, y: 7 };
    const fromBosk = mission.forecastAttack(bosk.instanceId, meepsHostile.instanceId)!;
    expect(fromBosk.dodgeChance).toBe(0); // Tank source — House rule #1b, no dodge
  });

  it("vs Bloom: shelled targets never die to one hit, collapsed ones die at Vitality, and it matches the real hit", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 5, y: 6 });
    const bloom = createBloomUnit("bloom_crawlmass", { x: 6, y: 6 });
    mission.units.push(bloom);
    const shelled = mission.forecastAttack(rourke.instanceId, bloom.instanceId)!;
    expect(shelled.defenderDowned).toBe(false);
    expect(shelled.countered).toBe(false);
    expect(shelled.dodgeChance).toBe(0);
    const out = mission.attack(rourke.instanceId, bloom.instanceId)!;
    expect(out.damage).toBe(shelled.damage);
    expect(bloom.currentHp).toBe(shelled.defenderHpAfter);

    // Force Collapse with a sliver of vitality left — the forecast must call the kill.
    bloom.endurance = 0;
    bloom.collapsed = true;
    bloom.vitality = 1;
    bloom.currentHp = 1;
    rourke.actionsRemaining = 2;
    const collapsed = mission.forecastAttack(rourke.instanceId, bloom.instanceId)!;
    expect(collapsed.defenderDowned).toBe(true);
    expect(collapsed.defenderHpAfter).toBe(0);
  });

  it("applies the ambush decloak multiplier exactly like the real strike does", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 5, y: 6 });
    const bloom = createBloomUnit("bloom_crawlmass", { x: 6, y: 6 });
    mission.units.push(bloom);
    const plain = mission.forecastAttack(rourke.instanceId, bloom.instanceId)!;
    rourke.concealed = true;
    rourke.stealthTurnsRemaining = 2;
    const cloaked = mission.forecastAttack(rourke.instanceId, bloom.instanceId)!;
    expect(cloaked.decloakStrike).toBe(true);
    expect(cloaked.damage).toBe(plain.damage * AMBUSH_DECLOAK_DAMAGE_MULTIPLIER);
    const out = mission.attack(rourke.instanceId, bloom.instanceId)!;
    expect(out.damage).toBe(cloaked.damage);
  });
});

describe("Mission.forecastSplash", () => {
  it("fire support: flat damage, hostiles only, empty off-area", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 5, y: 6 });
    rourke.abilities = [...rourke.abilities, "abil_fire_support"];
    const bosk = pilot(mission, "pilot_bosk", { x: 7, y: 6 });
    const hostile = createHostileMechUnit("hostile_mech_01", { x: 8, y: 6 });
    const bloom = createBloomUnit("bloom_crawlmass", { x: 8, y: 7 });
    mission.units.push(hostile, bloom);
    const entries = mission.forecastSplash(rourke.instanceId, { x: 8, y: 6 }, "fire_support");
    expect(entries.map((e) => e.unitId).sort()).toEqual([hostile.instanceId, bloom.instanceId].sort());
    expect(entries.every((e) => e.damage === FIRE_SUPPORT_DAMAGE)).toBe(true);
    expect(entries.some((e) => e.unitId === bosk.instanceId)).toBe(false); // friendlies are never in a fire-support blast
    expect(mission.forecastSplash(rourke.instanceId, { x: 30, y: 30 }, "fire_support")).toEqual([]);
  });

  it("missile: friendlies ARE in the blast, per-victim damage matches the real strike", () => {
    const mission = quietMission();
    const anand = pilot(mission, "pilot_anand", { x: 4, y: 6 }); // Reeps, attackRange [2,4]
    anand.abilities = [...anand.abilities, "abil_missile"];
    const bosk = pilot(mission, "pilot_bosk", { x: 7, y: 6 });
    const hostile = createHostileMechUnit("hostile_mech_01", { x: 8, y: 7 });
    mission.units.push(hostile);
    const target = { x: 8, y: 6 };
    const entries = mission.forecastSplash(anand.instanceId, target, "missile");
    const byId = Object.fromEntries(entries.map((e) => [e.unitId, e]));
    expect(byId[bosk.instanceId]).toBeDefined();
    expect(byId[bosk.instanceId].side).toBe("player");
    expect(byId[hostile.instanceId]).toBeDefined();
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const boskBefore = bosk.currentHp + (bosk.shield ?? 0);
    const hostileBefore = hostile.currentHp + (hostile.shield ?? 0);
    mission.missileStrike(anand.instanceId, target);
    expect(boskBefore - (bosk.currentHp + (bosk.shield ?? 0))).toBe(byId[bosk.instanceId].damage);
    expect(hostileBefore - (hostile.currentHp + (hostile.shield ?? 0))).toBe(byId[hostile.instanceId].damage);
  });
});
