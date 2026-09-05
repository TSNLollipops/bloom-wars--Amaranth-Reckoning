// Riot Drum (Weapon Branch Point System, data/weaponBranches.ts, 4 Sep
// 2026) — Tank's 2nd branch: "melee, independent chances to knock back and
// to pin on hit." Stays on the archetype's own plain stats/attackRange; on
// a landed, non-lethal hit against a Bloom, rolls RIOT_DRUM_KNOCKBACK_CHANCE
// and RIOT_DRUM_PIN_CHANCE independently through the mech on-hit effects
// engine (engine/turnManager.ts's applyMechOnHitEffect — mechOnHitEffects.
// test.ts covers that file's own pure functions in isolation, including
// both new fxIds). "Pin" is implemented as the "stun" StatusEffect kind
// outright (see data/weaponBranches.ts's own header comment for the
// reasoning), so its skip-turn behavior below is exactly shockClaws.test.ts's
// own Mission.runHostileTurn coverage, worded generically off isStunned()
// rather than "is pinned" — a known, deliberately accepted cosmetic gap.
//
// House test style (see shockClaws.test.ts / bloomOnHitEffects.test.ts):
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

// Mirrors shockClaws.test.ts's own neutralizeDefaultRoster/clearTerrain —
// duplicated rather than imported, matching this test suite's established
// per-file convention.
function neutralizeDefaultRoster(mission: Mission) {
  for (const u of mission.units) u.downed = true;
}

function clearTerrain(mission: Mission, coords: { x: number; y: number }[]) {
  for (const { x, y } of coords) mission.map.tiles[y][x] = "plain";
}

function equipRiotDrum(unit: BattleUnit): void {
  unit.weaponBranchId = "tank_riot_drum";
}

// Riot Drum's two effects roll independently, in array order (knockback
// then pin — WEAPON_BRANCH_ON_HIT_EFFECT.tank_riot_drum in data/
// weaponBranches.ts), one this.rng() call each. A constant rng (as
// shockClaws.test.ts uses throughout, since it only ever has one roll to
// force) can only force both to the same outcome here — this returns a
// fixed sequence instead, one value per call, holding the last value for
// any call past the end of the list, so the two rolls can be forced
// independently of each other.
function seqRng(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe("Mission.attack — Riot Drum's knockback/pin rolls (engine/mission.ts)", () => {
  it("a landed, non-lethal hit with both rolls forced to succeed knocks back AND pins the defender", () => {
    const mission = new Mission(MISSION_1A, undefined, [], { rng: () => 0 }); // 0 < both chances — forces both rolls to succeed
    neutralizeDefaultRoster(mission);
    clearTerrain(mission, [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 5, y: 7 }]);
    const attacker = testUnit("tank", { x: 5, y: 5 });
    equipRiotDrum(attacker);
    mission.units.push(attacker);
    const defender = createBloomUnit("bloom_gallcyst", { x: 5, y: 6 }); // endurance 140/vitality 20 — nowhere near lethal to one hit
    mission.units.push(defender);

    const outcome = mission.attack(attacker.instanceId, defender.instanceId);

    expect(outcome).not.toBeNull();
    expect(outcome!.damage).toBeGreaterThan(0);
    expect(outcome!.defenderDowned).toBe(false);
    expect(defender.pos).toEqual({ x: 5, y: 7 }); // knocked back one tile away from the attacker
    expect(defender.statusEffects).toEqual([{ kind: "stun", magnitude: 0, turnsRemaining: 1 }]); // pinned
    expect(mission.log.some((l) => l === `${defender.displayName} is knocked back!`)).toBe(true);
    expect(mission.log.some((l) => l === `${defender.displayName} is pinned!`)).toBe(true);
  });

  it("the same hit with both rolls forced to fail does nothing extra", () => {
    const mission = new Mission(MISSION_1A, undefined, [], { rng: () => 0.99 }); // >= both chances — forces both rolls to fail
    neutralizeDefaultRoster(mission);
    clearTerrain(mission, [{ x: 5, y: 5 }, { x: 5, y: 6 }]);
    const attacker = testUnit("tank", { x: 5, y: 5 });
    equipRiotDrum(attacker);
    mission.units.push(attacker);
    const defender = createBloomUnit("bloom_gallcyst", { x: 5, y: 6 });
    mission.units.push(defender);

    const outcome = mission.attack(attacker.instanceId, defender.instanceId);

    expect(outcome).not.toBeNull();
    expect(outcome!.damage).toBeGreaterThan(0); // the plain hit still lands...
    expect(defender.pos).toEqual({ x: 5, y: 6 }); // ...it just doesn't move...
    expect(defender.statusEffects).toEqual([]); // ...or pin
    expect(mission.log.some((l) => l.includes("knocked back"))).toBe(false);
    expect(mission.log.some((l) => l.includes("is pinned"))).toBe(false);
  });

  it("knockback and pin roll independently — knockback can succeed without pin", () => {
    const mission = new Mission(MISSION_1A, undefined, [], { rng: seqRng([0, 0.99]) }); // knockback succeeds, pin fails
    neutralizeDefaultRoster(mission);
    clearTerrain(mission, [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 5, y: 7 }]);
    const attacker = testUnit("tank", { x: 5, y: 5 });
    equipRiotDrum(attacker);
    mission.units.push(attacker);
    const defender = createBloomUnit("bloom_gallcyst", { x: 5, y: 6 });
    mission.units.push(defender);

    mission.attack(attacker.instanceId, defender.instanceId);

    expect(defender.pos).toEqual({ x: 5, y: 7 });
    expect(defender.statusEffects).toEqual([]);
  });

  it("knockback and pin roll independently — pin can succeed without knockback", () => {
    const mission = new Mission(MISSION_1A, undefined, [], { rng: seqRng([0.99, 0]) }); // knockback fails, pin succeeds
    neutralizeDefaultRoster(mission);
    clearTerrain(mission, [{ x: 5, y: 5 }, { x: 5, y: 6 }]);
    const attacker = testUnit("tank", { x: 5, y: 5 });
    equipRiotDrum(attacker);
    mission.units.push(attacker);
    const defender = createBloomUnit("bloom_gallcyst", { x: 5, y: 6 });
    mission.units.push(defender);

    mission.attack(attacker.instanceId, defender.instanceId);

    expect(defender.pos).toEqual({ x: 5, y: 6 });
    expect(defender.statusEffects).toEqual([{ kind: "stun", magnitude: 0, turnsRemaining: 1 }]);
  });

  it("a hit that downs the defender outright never applies knockback or pin, even with both rolls forced to succeed", () => {
    const mission = new Mission(MISSION_1A, undefined, [], { rng: () => 0 });
    neutralizeDefaultRoster(mission);
    clearTerrain(mission, [{ x: 5, y: 5 }, { x: 5, y: 6 }]);
    const attacker = testUnit("tank", { x: 5, y: 5 });
    equipRiotDrum(attacker);
    mission.units.push(attacker);
    const defender = createBloomUnit("bloom_gallcyst", { x: 5, y: 6 });
    // Force Collapse with a sliver of vitality left, same setup
    // shockClaws.test.ts's own equivalent case uses — any nonzero hit downs
    // this outright.
    defender.endurance = 0;
    defender.collapsed = true;
    defender.vitality = 1;
    defender.currentHp = 1;
    mission.units.push(defender);

    const outcome = mission.attack(attacker.instanceId, defender.instanceId);

    expect(outcome).not.toBeNull();
    expect(outcome!.defenderDowned).toBe(true);
    expect(defender.pos).toEqual({ x: 5, y: 6 }); // downed outright — nothing left to knock back
    expect(defender.statusEffects).toEqual([]); // or pin
  });

  it("never rolls or fires without the branch equipped, even with both rolls forced to succeed", () => {
    const mission = new Mission(MISSION_1A, undefined, [], { rng: () => 0 });
    neutralizeDefaultRoster(mission);
    clearTerrain(mission, [{ x: 5, y: 5 }, { x: 5, y: 6 }]);
    const attacker = testUnit("tank", { x: 5, y: 5 }); // plain Slam Cannon — no branch equipped
    mission.units.push(attacker);
    const defender = createBloomUnit("bloom_gallcyst", { x: 5, y: 6 });
    mission.units.push(defender);

    const outcome = mission.attack(attacker.instanceId, defender.instanceId);

    expect(outcome).not.toBeNull();
    expect(outcome!.damage).toBeGreaterThan(0);
    expect(defender.pos).toEqual({ x: 5, y: 6 });
    expect(defender.statusEffects).toEqual([]);
  });

  it("never fires for a DIFFERENT equipped branch, even with both rolls forced to succeed", () => {
    const mission = new Mission(MISSION_1A, undefined, [], { rng: () => 0 });
    neutralizeDefaultRoster(mission);
    clearTerrain(mission, [{ x: 5, y: 5 }, { x: 5, y: 6 }]);
    const attacker = testUnit("tank", { x: 5, y: 5 });
    attacker.weaponBranchId = "tank_grinder_claw"; // a real Tank branch, just not this one
    mission.units.push(attacker);
    const defender = createBloomUnit("bloom_gallcyst", { x: 5, y: 6 });
    mission.units.push(defender);

    mission.attack(attacker.instanceId, defender.instanceId);

    expect(defender.pos).toEqual({ x: 5, y: 6 });
    expect(defender.statusEffects).toEqual([]);
  });
});

describe("Mission.runHostileTurn — a pinned Bloom skips its turn, same mechanism as Shock Claws' stun (engine/mission.ts, engine/turnManager.ts's isStunned)", () => {
  it("a pinned defender neither attacks nor moves through its own hostile phase, and the pin expires after exactly one skipped turn", () => {
    const mission = new Mission(MISSION_1A, undefined, [], { rng: seqRng([0.99, 0]) }); // knockback fails, pin succeeds — isolates the assertion to pin alone
    neutralizeDefaultRoster(mission);
    clearTerrain(mission, [{ x: 5, y: 5 }, { x: 5, y: 6 }]);
    const attacker = testUnit("tank", { x: 5, y: 5 }, { hp: 200, maxHp: 200 });
    equipRiotDrum(attacker);
    mission.units.push(attacker);
    // Gallcyst: moveRange 0, attackRange [1,3] — adjacent to `attacker` and
    // well within range to counter-attack on its own hostile-phase turn if
    // it isn't actually pinned. A stationary archetype is deliberate here,
    // same reasoning shockClaws.test.ts's own equivalent case gives.
    const defender = createBloomUnit("bloom_gallcyst", { x: 5, y: 6 });
    mission.units.push(defender);

    mission.attack(attacker.instanceId, defender.instanceId);
    expect(defender.statusEffects).toEqual([{ kind: "stun", magnitude: 0, turnsRemaining: 1 }]);

    mission.endPlayerTurn(); // runs the full hostile phase, including environmentStep's tick

    // Worded generically off isStunned(), not off which fxId caused it —
    // see data/weaponBranches.ts's own header comment for why this reads
    // "is stunned," not "is pinned": a known, deliberately accepted
    // cosmetic gap of reusing the stun mechanism outright for pin.
    expect(mission.log.some((l) => l === `${defender.displayName} is stunned and skips its turn.`)).toBe(true);
    expect(attacker.currentHp).toBe(200); // Gallcyst never got to swing back
    expect(defender.statusEffects).toEqual([]); // 1-turn pin expired via the ordinary tickStatusEffects() pass, no separate clearing path
  });
});

describe("purchaseWeaponBranch / equipWeaponBranch — Riot Drum (Tank's 2nd branch)", () => {
  it("gates a Tank pilot's 2nd branch (Riot Drum) at WEAPON_BRANCH_TIER_GATE[1] (C), priced at WEAPON_BRANCH_COSTS[1], then equips like any other owned branch", () => {
    const state = createWardenCampaignState();
    state.pilots["pilot_bosk"].pilot.tier = WEAPON_BRANCH_TIER_GATE[1]; // "C" — enough for the 2nd, not gate-blocked
    state.pilots["pilot_bosk"].personalPoints = WEAPON_BRANCH_COSTS[0] + WEAPON_BRANCH_COSTS[1];
    const first = purchaseWeaponBranch(state, "pilot_bosk", "tank_grinder_claw");
    expect(first.ok).toBe(true);
    const second = purchaseWeaponBranch(state, "pilot_bosk", "tank_riot_drum");
    expect(second.ok).toBe(true);
    expect(second.cost).toBe(WEAPON_BRANCH_COSTS[1]);
    expect(state.pilots["pilot_bosk"].personalPoints).toBe(0);
    expect(state.pilots["pilot_bosk"].pilot.ownedWeaponBranches).toEqual(["tank_grinder_claw", "tank_riot_drum"]);

    const equip = equipWeaponBranch(state, "pilot_bosk", "tank_riot_drum");
    expect(equip.ok).toBe(true);
    expect(state.pilots["pilot_bosk"].pilot.equippedWeaponBranch).toBe("tank_riot_drum");
  });

  it("refuses Riot Drum below tier C even with unlimited points", () => {
    const state = createWardenCampaignState();
    state.pilots["pilot_bosk"].pilot.tier = "B"; // enough for the 1st branch (D-gated), not gate-blocked
    state.pilots["pilot_bosk"].personalPoints = 100000;
    purchaseWeaponBranch(state, "pilot_bosk", "tank_grinder_claw");
    state.pilots["pilot_bosk"].pilot.tier = "D"; // below the 2nd branch's own C gate
    const second = purchaseWeaponBranch(state, "pilot_bosk", "tank_riot_drum");
    expect(second.ok).toBe(false);
    expect(second.reason).toMatch(/needs gear tier C/);
  });
});
