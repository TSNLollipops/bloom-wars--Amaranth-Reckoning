// Suppression Autocannon (Weapon Branch Point System, data/weaponBranches.ts,
// 5 Sep 2026) — Reeps' 3rd and, per the source doc's own table, LAST branch:
// "attack-debuff on hit." On a landed, non-lethal hit, rolls
// SUPPRESSION_AUTOCANNON_DEBUFF_CHANCE and, on success, applies
// fx_suppression_autocannon_debuff (debuff_attack, -20% ATK / 2 turns) to
// the defending Bloom AND any same-side Bloom within DEBUFF_ATTACK_RADIUS,
// through the mech on-hit effects engine (engine/turnManager.ts's
// applyMechOnHitEffect, mechOnHitEffects.test.ts covers that file's own
// pure functions in isolation, including the radius spread). This file
// exercises the real wiring: Mission.resolveAttack's mech-attacks-Bloom
// branch (the roll + gate + radius spread through real Mission state), and
// purchaseWeaponBranch/equipWeaponBranch (buying and equipping it like any
// other branch).
//
// It also covers the reverse-direction fix this branch's own wiring turned
// up (engine/combat.ts's bloomDamage(), 5 Sep 2026): a debuffed Bloom's own
// subsequent attack is now actually weaker, closing a gap that made
// debuff_attack a pure status-effect no-op whenever it landed on a Bloom
// (this branch, and the pre-existing but never-actually-effective Borrowed
// Authority "copy debuff_attack onto a Bloom" case — see combat.ts's own
// comment at that line for the full account).
//
// House test style (see bloomOnHitEffects.test.ts / shockClaws.test.ts):
// real Mission objects built from a real mission def, with direct unit
// mutation to isolate one scenario on an otherwise quiet board.
import { describe, it, expect } from "vitest";
import { Mission } from "../mission";
import { MISSION_1A } from "../../data/campaign";
import { bloomDamage } from "../combat";
import { createBloomUnit, type BattleUnit } from "../units";
import { testUnit, makeUniformMap } from "./testHelpers";
import { createWardenCampaignState } from "../campaignState";
import { purchaseWeaponBranch, equipWeaponBranch } from "../campaignEconomy";
import { WEAPON_BRANCH_COSTS, WEAPON_BRANCH_TIER_GATE } from "../../data/weaponBranches";

// Mirrors bloomOnHitEffects.test.ts's / shockClaws.test.ts's own
// neutralizeDefaultRoster/clearTerrain — duplicated rather than imported,
// matching this test suite's established per-file convention.
function neutralizeDefaultRoster(mission: Mission) {
  for (const u of mission.units) u.downed = true;
}

function clearTerrain(mission: Mission, coords: { x: number; y: number }[]) {
  for (const { x, y } of coords) mission.map.tiles[y][x] = "plain";
}

function equipSuppressionAutocannon(unit: BattleUnit): void {
  unit.weaponBranchId = "reeps_suppression_autocannon";
}

describe("Mission.attack — Suppression Autocannon debuff roll (engine/mission.ts)", () => {
  it("a landed, non-lethal hit with the debuff roll forced to succeed suppresses the defender", () => {
    const mission = new Mission(MISSION_1A, undefined, [], { rng: () => 0 }); // 0 < SUPPRESSION_AUTOCANNON_DEBUFF_CHANCE — forces the roll to succeed
    neutralizeDefaultRoster(mission);
    clearTerrain(mission, [{ x: 5, y: 5 }, { x: 5, y: 6 }]);
    const attacker = testUnit("reeps", { x: 5, y: 5 });
    equipSuppressionAutocannon(attacker);
    mission.units.push(attacker);
    const defender = createBloomUnit("bloom_gallcyst", { x: 5, y: 6 }); // endurance 140/vitality 20 — nowhere near lethal to one hit
    mission.units.push(defender);

    const outcome = mission.attack(attacker.instanceId, defender.instanceId);

    expect(outcome).not.toBeNull();
    expect(outcome!.damage).toBeGreaterThan(0);
    expect(outcome!.defenderDowned).toBe(false);
    expect(defender.statusEffects).toEqual([{ kind: "debuff_attack", magnitude: 0.2, turnsRemaining: 2 }]);
    expect(mission.log.some((l) => l === `${defender.displayName}'s attack is suppressed!`)).toBe(true);
  });

  it("the same hit with the debuff roll forced to fail does nothing extra", () => {
    const mission = new Mission(MISSION_1A, undefined, [], { rng: () => 0.99 }); // 0.99 >= SUPPRESSION_AUTOCANNON_DEBUFF_CHANCE — forces the roll to fail
    neutralizeDefaultRoster(mission);
    clearTerrain(mission, [{ x: 5, y: 5 }, { x: 5, y: 6 }]);
    const attacker = testUnit("reeps", { x: 5, y: 5 });
    equipSuppressionAutocannon(attacker);
    mission.units.push(attacker);
    const defender = createBloomUnit("bloom_gallcyst", { x: 5, y: 6 });
    mission.units.push(defender);

    const outcome = mission.attack(attacker.instanceId, defender.instanceId);

    expect(outcome).not.toBeNull();
    expect(outcome!.damage).toBeGreaterThan(0); // the plain hit still lands...
    expect(defender.statusEffects).toEqual([]); // ...it just doesn't suppress
    expect(mission.log.some((l) => l.includes("is suppressed"))).toBe(false);
  });

  it("a hit that downs the defender outright never applies a debuff, even with the roll forced to succeed", () => {
    const mission = new Mission(MISSION_1A, undefined, [], { rng: () => 0 });
    neutralizeDefaultRoster(mission);
    clearTerrain(mission, [{ x: 5, y: 5 }, { x: 5, y: 6 }]);
    const attacker = testUnit("reeps", { x: 5, y: 5 });
    equipSuppressionAutocannon(attacker);
    mission.units.push(attacker);
    const defender = createBloomUnit("bloom_gallcyst", { x: 5, y: 6 });
    // Force Collapse with a sliver of vitality left, same setup
    // shockClaws.test.ts uses for its own "collapsed ones die at Vitality" case.
    defender.endurance = 0;
    defender.collapsed = true;
    defender.vitality = 1;
    defender.currentHp = 1;
    mission.units.push(defender);

    const outcome = mission.attack(attacker.instanceId, defender.instanceId);

    expect(outcome).not.toBeNull();
    expect(outcome!.defenderDowned).toBe(true);
    expect(defender.statusEffects).toEqual([]); // downed outright — nothing left to suppress
  });

  it("never rolls or fires without the branch equipped, even with the roll forced to succeed", () => {
    const mission = new Mission(MISSION_1A, undefined, [], { rng: () => 0 });
    neutralizeDefaultRoster(mission);
    clearTerrain(mission, [{ x: 5, y: 5 }, { x: 5, y: 6 }]);
    const attacker = testUnit("reeps", { x: 5, y: 5 }); // plain Marksman Rifle — no branch equipped
    mission.units.push(attacker);
    const defender = createBloomUnit("bloom_gallcyst", { x: 5, y: 6 });
    mission.units.push(defender);

    const outcome = mission.attack(attacker.instanceId, defender.instanceId);

    expect(outcome).not.toBeNull();
    expect(outcome!.damage).toBeGreaterThan(0);
    expect(defender.statusEffects).toEqual([]);
  });

  it("never fires for a DIFFERENT equipped branch, even with the roll forced to succeed", () => {
    const mission = new Mission(MISSION_1A, undefined, [], { rng: () => 0 });
    neutralizeDefaultRoster(mission);
    clearTerrain(mission, [{ x: 5, y: 5 }, { x: 5, y: 6 }]);
    const attacker = testUnit("reeps", { x: 5, y: 5 });
    attacker.weaponBranchId = "reeps_rail_lance"; // a real branch, just not this one
    mission.units.push(attacker);
    const defender = createBloomUnit("bloom_gallcyst", { x: 5, y: 6 });
    mission.units.push(defender);

    mission.attack(attacker.instanceId, defender.instanceId);

    expect(defender.statusEffects).toEqual([]);
  });

  it("a successful roll suppresses the defender AND a same-side Bloom within DEBUFF_ATTACK_RADIUS, but not one just past it — the real Mission-level radius spread, not just the pure function", () => {
    const mission = new Mission(MISSION_1A, undefined, [], { rng: () => 0 });
    neutralizeDefaultRoster(mission);
    clearTerrain(mission, [{ x: 5, y: 5 }, { x: 5, y: 6 }]);
    const attacker = testUnit("reeps", { x: 5, y: 5 });
    equipSuppressionAutocannon(attacker);
    mission.units.push(attacker);
    const defender = createBloomUnit("bloom_gallcyst", { x: 5, y: 6 });
    mission.units.push(defender);
    const nearAlly = createBloomUnit("bloom_gallcyst", { x: 5, y: 8 }); // chebyshev 2 from (5,6) — exactly at DEBUFF_ATTACK_RADIUS
    mission.units.push(nearAlly);
    const farAlly = createBloomUnit("bloom_gallcyst", { x: 5, y: 9 }); // chebyshev 3 — one past it
    mission.units.push(farAlly);

    mission.attack(attacker.instanceId, defender.instanceId);

    expect(defender.statusEffects).toEqual([{ kind: "debuff_attack", magnitude: 0.2, turnsRemaining: 2 }]);
    expect(nearAlly.statusEffects).toEqual([{ kind: "debuff_attack", magnitude: 0.2, turnsRemaining: 2 }]);
    expect(farAlly.statusEffects).toEqual([]);
  });
});

describe("bloomDamage — the reverse-direction fix this branch's wiring turned up (engine/combat.ts, 5 Sep 2026)", () => {
  it("a debuffed Bloom deals visibly less damage than the same Bloom undebuffed, all else equal", () => {
    // bloom_gallcyst: attackPower 30, fresh endurance 140/140 (ratio 1).
    // defender at 100 effectiveDefense (testUnit's own default), on a
    // "plain" tile (defenceStars: 1, data/tiles.ts) with no ally to grant
    // overshieldBonus (empty sameSide array) — terrain factor
    // 1 - 0.1*(1+0) = 0.9. Not at full HP, so FULL_HP_DAMAGE_CAP never
    // triggers and the numbers stay clean:
    //   plain:     round(30 * 1    * 1   * (100/100) * 0.9) = round(27)   = 27
    //   debuffed:  round(30 * 1    * 0.8 * (100/100) * 0.9) = round(21.6) = 22
    const map = makeUniformMap("plain", 10, 10); // default 6x6 is too small for y:6 below
    const defender = testUnit("tank", { x: 5, y: 6 }, { hp: 1, maxHp: 1000 });
    const plainAttacker = createBloomUnit("bloom_gallcyst", { x: 5, y: 5 });
    const debuffedAttacker = createBloomUnit("bloom_gallcyst", { x: 5, y: 5 });
    debuffedAttacker.statusEffects.push({ kind: "debuff_attack", magnitude: 0.2, turnsRemaining: 2 });

    const plainDmg = bloomDamage(plainAttacker, defender, map, [], false);
    const debuffedDmg = bloomDamage(debuffedAttacker, defender, map, [], false);

    expect(plainDmg).toBe(27);
    expect(debuffedDmg).toBe(22);
    expect(debuffedDmg).toBeLessThan(plainDmg);
  });

  it("an expired debuff (turnsRemaining <= 0) no longer reduces damage — same just-expired guard attackDebuffMultiplier uses everywhere else", () => {
    const map = makeUniformMap("plain", 10, 10); // default 6x6 is too small for y:6 below
    const defender = testUnit("tank", { x: 5, y: 6 }, { hp: 1, maxHp: 1000 });
    const attacker = createBloomUnit("bloom_gallcyst", { x: 5, y: 5 });
    attacker.statusEffects.push({ kind: "debuff_attack", magnitude: 0.2, turnsRemaining: 0 });

    expect(bloomDamage(attacker, defender, map, [], false)).toBe(27); // same as the undebuffed case above
  });
});

describe("purchaseWeaponBranch / equipWeaponBranch — Suppression Autocannon (Reeps' 3rd, last branch)", () => {
  it("gates a Reeps pilot's 3rd branch (Suppression Autocannon) at WEAPON_BRANCH_TIER_GATE[2] (B), priced at WEAPON_BRANCH_COSTS[2], then equips like any other owned branch", () => {
    const state = createWardenCampaignState();
    state.pilots["pilot_anand"].pilot.tier = WEAPON_BRANCH_TIER_GATE[2]; // "B" — enough for the 3rd, not gate-blocked
    state.pilots["pilot_anand"].personalPoints = WEAPON_BRANCH_COSTS[0] + WEAPON_BRANCH_COSTS[1] + WEAPON_BRANCH_COSTS[2];
    const first = purchaseWeaponBranch(state, "pilot_anand", "reeps_missiles");
    expect(first.ok).toBe(true);
    const second = purchaseWeaponBranch(state, "pilot_anand", "reeps_rail_lance");
    expect(second.ok).toBe(true);
    const third = purchaseWeaponBranch(state, "pilot_anand", "reeps_suppression_autocannon");
    expect(third.ok).toBe(true);
    expect(third.cost).toBe(WEAPON_BRANCH_COSTS[2]);
    expect(state.pilots["pilot_anand"].personalPoints).toBe(0);
    expect(state.pilots["pilot_anand"].pilot.ownedWeaponBranches).toEqual([
      "reeps_missiles",
      "reeps_rail_lance",
      "reeps_suppression_autocannon",
    ]);

    const equip = equipWeaponBranch(state, "pilot_anand", "reeps_suppression_autocannon");
    expect(equip.ok).toBe(true);
    expect(state.pilots["pilot_anand"].pilot.equippedWeaponBranch).toBe("reeps_suppression_autocannon");
  });

  it("refuses Suppression Autocannon below tier B even with unlimited points", () => {
    const state = createWardenCampaignState();
    state.pilots["pilot_anand"].pilot.tier = "A"; // one rung below B (D < C < B < A order — see WEAPON_BRANCH_TIER_GATE)
    state.pilots["pilot_anand"].personalPoints = 100000;
    purchaseWeaponBranch(state, "pilot_anand", "reeps_missiles");
    purchaseWeaponBranch(state, "pilot_anand", "reeps_rail_lance");
    state.pilots["pilot_anand"].pilot.tier = "C"; // below the 3rd branch's own B gate
    const third = purchaseWeaponBranch(state, "pilot_anand", "reeps_suppression_autocannon");
    expect(third.ok).toBe(false);
    expect(third.reason).toMatch(/needs gear tier B/);
  });
});
