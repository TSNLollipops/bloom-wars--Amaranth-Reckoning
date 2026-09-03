// Scattershot Pistols (Weapon Branch Point System, data/weaponBranches.ts,
// 3 Sep 2026) — Meeps' 2nd branch: attackRange extends to
// SCATTERSHOT_PISTOLS_ATTACK_RANGE ([1,2], not the archetype's own [1,1]),
// and a landed primary hit cleaves onto a second enemy adjacent to the
// PRIMARY TARGET (not the attacker) for SCATTERSHOT_PISTOLS_CLEAVE_PCT of a
// freshly-computed hit against that second target's own stats. See
// engine/mission.ts's applyScattershotCleave() for the full mechanism this
// file exercises, and engine/units.ts's weaponBranchAttackRange() for the
// attackRange override checked below.
//
// House test style (see missileStrike.test.ts / dodge.test.ts): real
// Mission objects built from a real mission def, with direct unit mutation
// to isolate one scenario on an otherwise quiet board. Cross-checked
// against resolveMechAttack — the same pure function
// applyScattershotCleave() itself calls — as the expected-value oracle,
// the same way combat.test.ts's own "Reeps from range" block avoids
// hand-transcribing the POWER-table arithmetic.
import { describe, it, expect } from "vitest";
import { Mission, type AttackOutcome } from "../mission";
import { AMARANTH_MISSION_1 } from "../../data/campaignAmaranth";
import { createHostileMechUnit, createPlayerUnit, type BattleUnit } from "../units";
import { findPilot } from "../../data/pilotRegistry";
import { resolveMechAttack } from "../combat";
import { SCATTERSHOT_PISTOLS_CLEAVE_PCT, SCATTERSHOT_PISTOLS_ATTACK_RANGE } from "../../data/weaponBranches";

// Mirrors missileStrike.test.ts's own PARK/quietMission/pilot — see that
// file's comment for why each exists. Duplicated rather than imported,
// matching this test suite's established per-file convention.
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

// pilot_iyari (arch_meeps_centauroid, WARDEN_PILOTS) is this file's stand-in
// Scattershot Meeps throughout — Meeps-path, not the exempt-from-permadeath
// commander (pilot_rourke), so handleDowned's commander_down branch never
// complicates a downing assertion below.
function equipScattershot(unit: BattleUnit): void {
  unit.weaponBranchId = "meeps_scattershot_pistols";
  // createPlayerUnit() is what really computes this from weaponBranchId
  // (see the dedicated describe block below) — set directly here too, same
  // "mutate the already-built BattleUnit" convention support.test.ts uses
  // for munti_rapid_response, since quietMission()'s units were already
  // built before this test ever touches them.
  unit.attackRange = [SCATTERSHOT_PISTOLS_ATTACK_RANGE[0], SCATTERSHOT_PISTOLS_ATTACK_RANGE[1]];
}

describe("createPlayerUnit — Scattershot Pistols attackRange override (engine/units.ts)", () => {
  it("extends attackRange to SCATTERSHOT_PISTOLS_ATTACK_RANGE when equipped", () => {
    const base = findPilot("pilot_iyari")!;
    const equipped = { ...base, equippedWeaponBranch: "meeps_scattershot_pistols" };
    const unit = createPlayerUnit("pilot_iyari", { x: 0, y: 0 }, { pilot: equipped });
    expect(unit.attackRange).toEqual([SCATTERSHOT_PISTOLS_ATTACK_RANGE[0], SCATTERSHOT_PISTOLS_ATTACK_RANGE[1]]);
  });

  it("leaves attackRange at the archetype's own [1,1] with no branch, or a different branch, equipped", () => {
    const base = findPilot("pilot_iyari")!;
    const noBranch = createPlayerUnit("pilot_iyari", { x: 0, y: 0 }, { pilot: base });
    expect(noBranch.attackRange).toEqual([1, 1]);

    const otherBranch = { ...base, equippedWeaponBranch: "meeps_impact_lance" };
    const impactLance = createPlayerUnit("pilot_iyari", { x: 0, y: 0 }, { pilot: otherBranch });
    expect(impactLance.attackRange).toEqual([1, 1]);
  });

  it("does not alias the shared archetype's own attackRange tuple", () => {
    const base = findPilot("pilot_iyari")!;
    const equipped = { ...base, equippedWeaponBranch: "meeps_scattershot_pistols" };
    const unit = createPlayerUnit("pilot_iyari", { x: 0, y: 0 }, { pilot: equipped });
    unit.attackRange[1] = 99; // mutate the tuple this unit got handed back
    const fresh = createPlayerUnit("pilot_iyari", { x: 0, y: 0 }, { pilot: base });
    expect(fresh.attackRange).toEqual([1, 1]); // a later, unrelated unit is unaffected
  });
});

describe("Mission.attack — Scattershot Pistols range (engine/mission.ts)", () => {
  it("a range-2 attack that a plain Meeps could never make succeeds once the branch is equipped", () => {
    const mission = quietMission();
    const iyari = pilot(mission, "pilot_iyari", { x: 4, y: 6 });
    const target = createHostileMechUnit("hostile_mech_01", { x: 6, y: 6 }); // tank, distance 2
    mission.units.push(target);

    expect(mission.attack(iyari.instanceId, target.instanceId)).toBeNull(); // stock [1,1] range — out of reach

    equipScattershot(iyari);
    const outcome = mission.attack(iyari.instanceId, target.instanceId);
    expect(outcome).not.toBeNull();
    expect(outcome!.damage).toBeGreaterThan(0);
  });
});

describe("Mission.attack — Scattershot Pistols cleave (engine/mission.ts)", () => {
  it("a landed hit cleaves onto a second enemy adjacent to the PRIMARY TARGET, at SCATTERSHOT_PISTOLS_CLEAVE_PCT of a fresh hit against its own stats", () => {
    const mission = quietMission();
    const iyari = pilot(mission, "pilot_iyari", { x: 4, y: 6 });
    equipScattershot(iyari);
    // Primary target at range 2 (only reachable with the branch equipped) —
    // also keeps this attack out of the primary target's own counterMaxRange
    // (1), so iyari's HP stays exactly full through the cleave calculation
    // below, same as the pre-computed oracle assumes.
    const primaryTarget = createHostileMechUnit("hostile_mech_01", { x: 6, y: 6 }); // tank
    // Second target, adjacent to the PRIMARY TARGET (distance 1 from
    // primaryTarget), NOT adjacent to iyari herself (distance 2) — the
    // spec's own "adjacent to your target, not to you" distinction.
    const secondTarget = createHostileMechUnit("hostile_mech_04", { x: 7, y: 7 }); // reeps
    mission.units.push(primaryTarget, secondTarget);

    // Oracle: the exact same pure formula applyScattershotCleave() itself
    // calls, computed here BEFORE the real attack (resolveMechAttack
    // mutates nothing, so this doesn't disturb the state the real call
    // below sees).
    const expectedFreshHit = resolveMechAttack(
      mission.map,
      iyari,
      secondTarget,
      // Full same-side array, not just [secondTarget] — primaryTarget
      // (hostile_mech_01, Tank, abil_overshield) is itself adjacent to
      // secondTarget here and alive, so overshieldBonus (combat.ts) picks
      // it up exactly the way the real internal call's own
      // sameSideAsSecondTarget does; a bare [secondTarget] would silently
      // drop that +1 defence-star terrain bonus and desync the oracle.
      mission.units.filter((u) => u.side === secondTarget.side),
      mission.units.filter((u) => u.side === iyari.side),
      false,
      false,
      false
    );
    const expectedCleave = Math.round(expectedFreshHit.damage * SCATTERSHOT_PISTOLS_CLEAVE_PCT);
    expect(expectedCleave).toBeGreaterThan(0); // sanity — the scenario actually exercises the cleave

    const secondHpBefore = secondTarget.currentHp;
    const outcome = mission.attack(iyari.instanceId, primaryTarget.instanceId);

    expect(outcome).not.toBeNull();
    expect(outcome!.damage).toBeGreaterThan(0); // the primary hit itself still lands as normal
    expect(secondTarget.currentHp).toBe(secondHpBefore - expectedCleave);
    expect(mission.log.some((l) => l.includes("Scattershot Pistols cleave") && l.includes(String(expectedCleave)))).toBe(true);
  });

  it("does not draw a counterattack from the cleaved second target, even when it could otherwise counter", () => {
    const mission = quietMission();
    const iyari = pilot(mission, "pilot_iyari", { x: 4, y: 6 });
    equipScattershot(iyari);
    const iyariHpBefore = iyari.currentHp;
    // Primary target: Reeps, canCounter=false — the primary hit itself can
    // never counter, isolating this test to the cleave's own would-be
    // counter.
    const primaryTarget = createHostileMechUnit("hostile_mech_04", { x: 5, y: 6 }); // reeps, distance 1
    // Second target: Tank, canCounter=true, counterMaxRange 1 — adjacent to
    // BOTH the primary target (distance 1) and iyari herself (distance 1),
    // i.e. squarely within the range a normal single-target attack against
    // it would draw a counter from.
    const secondTarget = createHostileMechUnit("hostile_mech_01", { x: 5, y: 7 }); // tank
    mission.units.push(primaryTarget, secondTarget);
    const secondHpBefore = secondTarget.currentHp;

    const outcome = mission.attack(iyari.instanceId, primaryTarget.instanceId);

    expect(outcome).not.toBeNull();
    expect(secondTarget.currentHp).toBeLessThan(secondHpBefore); // the cleave still lands
    expect(iyari.currentHp).toBe(iyariHpBefore); // but nothing counters her for it
  });

  it("respects the second target's own Meeps-dodge chance", () => {
    const mission = new Mission(AMARANTH_MISSION_1, undefined, [], { rng: () => 0 }); // forces every dodge-eligible roll to succeed
    for (const u of mission.units) {
      if (u.side === "hostile") u.downed = true;
      else u.pos = { ...PARK[u.pilotId!] };
    }
    const iyari = pilot(mission, "pilot_iyari", { x: 4, y: 6 });
    equipScattershot(iyari);
    const primaryTarget = createHostileMechUnit("hostile_mech_04", { x: 5, y: 6 }); // reeps — never dodges (not Meeps-path)
    const secondTarget = createHostileMechUnit("hostile_mech_02", { x: 5, y: 7 }); // meeps — dodge-eligible, source (iyari) isn't a Tank
    mission.units.push(primaryTarget, secondTarget);
    const secondHpBefore = secondTarget.currentHp;

    const outcome = mission.attack(iyari.instanceId, primaryTarget.instanceId);

    expect(outcome).not.toBeNull();
    expect(outcome!.defenderDodged).toBe(false); // the primary hit (reeps) still lands — the forced roll is what we're isolating on the SECOND target
    expect(secondTarget.currentHp).toBe(secondHpBefore); // the cleave whiffed — no phantom damage
    expect(mission.log.some((l) => l.includes("Scattershot Pistols cleave"))).toBe(false); // and no log line for a hit that never landed
  });

  it("a dodged primary hit never cleaves, even with a valid second target adjacent", () => {
    const mission = new Mission(AMARANTH_MISSION_1, undefined, [], { rng: () => 0 }); // forces the primary target's dodge roll
    for (const u of mission.units) {
      if (u.side === "hostile") u.downed = true;
      else u.pos = { ...PARK[u.pilotId!] };
    }
    const iyari = pilot(mission, "pilot_iyari", { x: 4, y: 6 });
    equipScattershot(iyari);
    const primaryTarget = createHostileMechUnit("hostile_mech_02", { x: 5, y: 6 }); // meeps — dodge-eligible against a non-Tank attacker
    const secondTarget = createHostileMechUnit("hostile_mech_01", { x: 5, y: 7 }); // tank, adjacent to the primary target
    mission.units.push(primaryTarget, secondTarget);
    const secondHpBefore = secondTarget.currentHp;

    const outcome = mission.attack(iyari.instanceId, primaryTarget.instanceId);

    expect(outcome).not.toBeNull();
    expect(outcome!.defenderDodged).toBe(true);
    expect(outcome!.damage).toBe(0);
    expect(secondTarget.currentHp).toBe(secondHpBefore); // nothing to cleave off of — the primary hit itself never landed
    expect(mission.log.some((l) => l.includes("Scattershot Pistols cleave"))).toBe(false);
  });

  it("does nothing extra — no crash, no log line — when no second enemy is adjacent to the primary target", () => {
    const mission = quietMission();
    const iyari = pilot(mission, "pilot_iyari", { x: 4, y: 6 });
    equipScattershot(iyari);
    const primaryTarget = createHostileMechUnit("hostile_mech_01", { x: 6, y: 6 }); // alone — nothing else on the board but iyari and the parked squad
    mission.units.push(primaryTarget);
    const primaryHpBefore = primaryTarget.currentHp;

    let outcome: AttackOutcome | null = null;
    expect(() => {
      outcome = mission.attack(iyari.instanceId, primaryTarget.instanceId);
    }).not.toThrow();
    expect(outcome!).not.toBeNull();
    expect(primaryTarget.currentHp).toBeLessThan(primaryHpBefore); // the one hit that does exist still lands normally
    expect(mission.log.some((l) => l.includes("Scattershot Pistols cleave"))).toBe(false);
  });

  it("a second enemy on the attacker's OWN side, adjacent to the primary target, is never cleaved onto (the search is scoped to the target's own side)", () => {
    const mission = quietMission();
    const iyari = pilot(mission, "pilot_iyari", { x: 4, y: 6 });
    equipScattershot(iyari);
    const primaryTarget = createHostileMechUnit("hostile_mech_01", { x: 6, y: 6 });
    mission.units.push(primaryTarget);
    // A friendly unit standing where a hostile second target would be —
    // adjacent to the primary target, but on iyari's own side.
    const ally = pilot(mission, "pilot_bosk", { x: 6, y: 7 });
    const allyHpBefore = ally.currentHp;

    mission.attack(iyari.instanceId, primaryTarget.instanceId);

    expect(ally.currentHp).toBe(allyHpBefore); // never touched — cleave only ever reaches the primary target's own (hostile) side
  });

  it("never cleaves without the branch equipped, even with a second enemy adjacent to the primary target", () => {
    const mission = quietMission();
    const iyari = pilot(mission, "pilot_iyari", { x: 4, y: 6 });
    // Deliberately NOT calling equipScattershot — plain Twinblades, stock
    // [1,1] range, so both targets have to sit adjacent to iyari herself.
    const primaryTarget = createHostileMechUnit("hostile_mech_01", { x: 5, y: 6 }); // tank, distance 1
    const secondTarget = createHostileMechUnit("hostile_mech_04", { x: 5, y: 7 }); // reeps, adjacent to the primary target
    mission.units.push(primaryTarget, secondTarget);
    const secondHpBefore = secondTarget.currentHp;

    const outcome = mission.attack(iyari.instanceId, primaryTarget.instanceId);

    expect(outcome).not.toBeNull();
    expect(outcome!.damage).toBeGreaterThan(0); // the plain attack still lands
    expect(secondTarget.currentHp).toBe(secondHpBefore); // but nothing cleaves off of it
    expect(mission.log.some((l) => l.includes("Scattershot Pistols cleave"))).toBe(false);
  });

  it("credits a cleave kill through the same recordPerformance/handleDowned path a direct kill uses", () => {
    const mission = quietMission();
    const iyari = pilot(mission, "pilot_iyari", { x: 4, y: 6 });
    equipScattershot(iyari);
    const primaryTarget = createHostileMechUnit("hostile_mech_01", { x: 6, y: 6 });
    const secondTarget = createHostileMechUnit("hostile_mech_04", { x: 7, y: 7 });
    secondTarget.currentHp = 1; // one point of cleave damage downs it outright
    secondTarget.maxHp = 1;
    mission.units.push(primaryTarget, secondTarget);
    const perfBefore = mission.unitPerformance["pilot_iyari"].kills;
    const damageBefore = mission.unitPerformance["pilot_iyari"].damageDealt;

    mission.attack(iyari.instanceId, primaryTarget.instanceId);

    expect(secondTarget.downed).toBe(true);
    expect(mission.unitPerformance["pilot_iyari"].kills).toBe(perfBefore + 1);
    expect(mission.unitPerformance["pilot_iyari"].damageDealt).toBeGreaterThan(damageBefore);
    expect(mission.log.some((l) => l.includes(`${secondTarget.displayName} is downed`))).toBe(true);
  });
});
