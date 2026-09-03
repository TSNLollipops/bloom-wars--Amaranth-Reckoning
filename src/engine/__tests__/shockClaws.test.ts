// Shock Claws (Weapon Branch Point System, data/weaponBranches.ts, 3 Sep
// 2026) — Meeps' 3rd branch: "melee, chance to briefly stun on hit." Stays
// on the archetype's own plain [1,1] attackRange (that tuple is Scattershot
// Pistols' own lever, untouched here); on a landed, non-lethal hit, rolls
// SHOCK_CLAWS_STUN_CHANCE and, on success, applies a
// SHOCK_CLAWS_STUN_DURATION_TURNS stun to the defender through the mech
// on-hit effects engine (engine/turnManager.ts's applyMechOnHitEffect,
// mechOnHitEffects.test.ts covers that file's own pure functions in
// isolation). This file exercises the real wiring: Mission.resolveAttack's
// mech-attacks-Bloom branch (the roll + gate), Mission.runHostileTurn (the
// stunned unit actually skipping its turn), and
// purchaseWeaponBranch/equipWeaponBranch (buying and equipping it like any
// other branch).
//
// House test style (see bloomOnHitEffects.test.ts / scattershotPistols.test.ts):
// real Mission objects built from a real mission def, with direct unit
// mutation to isolate one scenario on an otherwise quiet board.
import { describe, it, expect } from "vitest";
import { Mission } from "../mission";
import { MISSION_1A } from "../../data/campaign";
import { createBloomUnit, type BattleUnit } from "../units";
import { testUnit } from "./testHelpers";
import { createWardenCampaignState } from "../campaignState";
import { purchaseWeaponBranch, equipWeaponBranch } from "../campaignEconomy";
import { WEAPON_BRANCH_COSTS, WEAPON_BRANCH_TIER_GATE } from "../../data/weaponBranches";

// Mirrors bloomOnHitEffects.test.ts's own neutralizeDefaultRoster/
// clearTerrain — duplicated rather than imported, matching this test
// suite's established per-file convention.
function neutralizeDefaultRoster(mission: Mission) {
  for (const u of mission.units) u.downed = true;
}

function clearTerrain(mission: Mission, coords: { x: number; y: number }[]) {
  for (const { x, y } of coords) mission.map.tiles[y][x] = "plain";
}

function equipShockClaws(unit: BattleUnit): void {
  unit.weaponBranchId = "meeps_shock_claws";
}

describe("Mission.attack — Shock Claws stun roll (engine/mission.ts)", () => {
  it("a landed, non-lethal hit with the stun roll forced to succeed stuns the defender", () => {
    const mission = new Mission(MISSION_1A, undefined, [], { rng: () => 0 }); // 0 < SHOCK_CLAWS_STUN_CHANCE — forces the roll to succeed
    neutralizeDefaultRoster(mission);
    clearTerrain(mission, [{ x: 5, y: 5 }, { x: 5, y: 6 }]);
    const attacker = testUnit("meeps", { x: 5, y: 5 });
    equipShockClaws(attacker);
    mission.units.push(attacker);
    const defender = createBloomUnit("bloom_gallcyst", { x: 5, y: 6 }); // endurance 140/vitality 20 — nowhere near lethal to one hit
    mission.units.push(defender);

    const outcome = mission.attack(attacker.instanceId, defender.instanceId);

    expect(outcome).not.toBeNull();
    expect(outcome!.damage).toBeGreaterThan(0);
    expect(outcome!.defenderDowned).toBe(false);
    expect(defender.statusEffects).toEqual([{ kind: "stun", magnitude: 0, turnsRemaining: 1 }]);
    expect(mission.log.some((l) => l === `${defender.displayName} is stunned!`)).toBe(true);
  });

  it("the same hit with the stun roll forced to fail does nothing extra", () => {
    const mission = new Mission(MISSION_1A, undefined, [], { rng: () => 0.99 }); // 0.99 >= SHOCK_CLAWS_STUN_CHANCE — forces the roll to fail
    neutralizeDefaultRoster(mission);
    clearTerrain(mission, [{ x: 5, y: 5 }, { x: 5, y: 6 }]);
    const attacker = testUnit("meeps", { x: 5, y: 5 });
    equipShockClaws(attacker);
    mission.units.push(attacker);
    const defender = createBloomUnit("bloom_gallcyst", { x: 5, y: 6 });
    mission.units.push(defender);

    const outcome = mission.attack(attacker.instanceId, defender.instanceId);

    expect(outcome).not.toBeNull();
    expect(outcome!.damage).toBeGreaterThan(0); // the plain hit still lands...
    expect(defender.statusEffects).toEqual([]); // ...it just doesn't stun
    expect(mission.log.some((l) => l.includes("is stunned"))).toBe(false);
  });

  it("a hit that downs the defender outright never applies a stun, even with the roll forced to succeed", () => {
    const mission = new Mission(MISSION_1A, undefined, [], { rng: () => 0 });
    neutralizeDefaultRoster(mission);
    clearTerrain(mission, [{ x: 5, y: 5 }, { x: 5, y: 6 }]);
    const attacker = testUnit("meeps", { x: 5, y: 5 });
    equipShockClaws(attacker);
    mission.units.push(attacker);
    const defender = createBloomUnit("bloom_gallcyst", { x: 5, y: 6 });
    // Force Collapse with a sliver of vitality left, same setup
    // forecast.test.ts uses for its own "collapsed ones die at Vitality"
    // case — any nonzero hit downs this outright.
    defender.endurance = 0;
    defender.collapsed = true;
    defender.vitality = 1;
    defender.currentHp = 1;
    mission.units.push(defender);

    const outcome = mission.attack(attacker.instanceId, defender.instanceId);

    expect(outcome).not.toBeNull();
    expect(outcome!.defenderDowned).toBe(true);
    expect(defender.statusEffects).toEqual([]); // downed outright — nothing left to stun
  });

  it("never rolls or fires without the branch equipped, even with the roll forced to succeed", () => {
    const mission = new Mission(MISSION_1A, undefined, [], { rng: () => 0 });
    neutralizeDefaultRoster(mission);
    clearTerrain(mission, [{ x: 5, y: 5 }, { x: 5, y: 6 }]);
    const attacker = testUnit("meeps", { x: 5, y: 5 }); // plain Twinblades — no branch equipped
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
    const attacker = testUnit("meeps", { x: 5, y: 5 });
    attacker.weaponBranchId = "meeps_scattershot_pistols"; // a real branch, just not this one
    mission.units.push(attacker);
    const defender = createBloomUnit("bloom_gallcyst", { x: 5, y: 6 });
    mission.units.push(defender);

    mission.attack(attacker.instanceId, defender.instanceId);

    expect(defender.statusEffects).toEqual([]);
  });
});

describe("Mission.runHostileTurn — a stunned Bloom skips its turn (engine/mission.ts, engine/turnManager.ts's isStunned)", () => {
  it("a stunned defender neither attacks nor moves through its own hostile phase, and the stun expires after exactly one skipped turn", () => {
    const mission = new Mission(MISSION_1A, undefined, [], { rng: () => 0 }); // forces the stun roll to succeed
    neutralizeDefaultRoster(mission);
    clearTerrain(mission, [{ x: 5, y: 5 }, { x: 5, y: 6 }]);
    const attacker = testUnit("meeps", { x: 5, y: 5 }, { hp: 200, maxHp: 200 });
    equipShockClaws(attacker);
    mission.units.push(attacker);
    // Gallcyst: moveRange 0, attackRange [1,3] — adjacent to `attacker` and
    // well within range to counter-attack on its own hostile-phase turn if
    // it isn't actually stunned. A stationary archetype is deliberate here:
    // it isolates the assertion to "did it attack," with no move-range
    // ambiguity to also account for.
    const defender = createBloomUnit("bloom_gallcyst", { x: 5, y: 6 });
    mission.units.push(defender);

    mission.attack(attacker.instanceId, defender.instanceId);
    expect(defender.statusEffects).toEqual([{ kind: "stun", magnitude: 0, turnsRemaining: 1 }]);

    mission.endPlayerTurn(); // runs the full hostile phase, including environmentStep's tick

    expect(mission.log.some((l) => l === `${defender.displayName} is stunned and skips its turn.`)).toBe(true);
    expect(attacker.currentHp).toBe(200); // Gallcyst never got to swing back
    expect(defender.statusEffects).toEqual([]); // 1-turn stun expired via the ordinary tickStatusEffects() pass, no separate clearing path
  });
});

describe("purchaseWeaponBranch / equipWeaponBranch — Shock Claws (Meeps' 3rd branch)", () => {
  it("gates a Meeps pilot's 3rd branch (Shock Claws) at WEAPON_BRANCH_TIER_GATE[2] (B), priced at WEAPON_BRANCH_COSTS[2], then equips like any other owned branch", () => {
    const state = createWardenCampaignState();
    state.pilots["pilot_rourke"].pilot.tier = WEAPON_BRANCH_TIER_GATE[2]; // "B" — enough for the 3rd, not gate-blocked
    state.pilots["pilot_rourke"].personalPoints = WEAPON_BRANCH_COSTS[0] + WEAPON_BRANCH_COSTS[1] + WEAPON_BRANCH_COSTS[2];
    const first = purchaseWeaponBranch(state, "pilot_rourke", "meeps_impact_lance");
    expect(first.ok).toBe(true);
    const second = purchaseWeaponBranch(state, "pilot_rourke", "meeps_scattershot_pistols");
    expect(second.ok).toBe(true);
    const third = purchaseWeaponBranch(state, "pilot_rourke", "meeps_shock_claws");
    expect(third.ok).toBe(true);
    expect(third.cost).toBe(WEAPON_BRANCH_COSTS[2]);
    expect(state.pilots["pilot_rourke"].personalPoints).toBe(0);
    expect(state.pilots["pilot_rourke"].pilot.ownedWeaponBranches).toEqual([
      "meeps_impact_lance",
      "meeps_scattershot_pistols",
      "meeps_shock_claws",
    ]);

    const equip = equipWeaponBranch(state, "pilot_rourke", "meeps_shock_claws");
    expect(equip.ok).toBe(true);
    expect(state.pilots["pilot_rourke"].pilot.equippedWeaponBranch).toBe("meeps_shock_claws");
  });

  it("refuses Shock Claws below tier B even with unlimited points", () => {
    const state = createWardenCampaignState();
    state.pilots["pilot_rourke"].pilot.tier = "A"; // one rung below B (D < C < B < A order — see WEAPON_BRANCH_TIER_GATE)
    state.pilots["pilot_rourke"].personalPoints = 100000;
    purchaseWeaponBranch(state, "pilot_rourke", "meeps_impact_lance");
    purchaseWeaponBranch(state, "pilot_rourke", "meeps_scattershot_pistols");
    state.pilots["pilot_rourke"].pilot.tier = "C"; // below the 3rd branch's own B gate
    const third = purchaseWeaponBranch(state, "pilot_rourke", "meeps_shock_claws");
    expect(third.ok).toBe(false);
    expect(third.reason).toMatch(/needs gear tier B/);
  });
});
