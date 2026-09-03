// Mech on-hit effects engine (engine/turnManager.ts's applyMechOnHitEffect
// and isStunned, 3 Sep 2026) — the mech->Bloom mirror of the Bloom on-hit
// effects engine turnManager.test.ts already covers, built alongside Shock
// Claws (data/weaponBranches.ts) as genuinely reusable infrastructure, not
// a one-off hack for that one branch. See applyMechOnHitEffect's own
// header comment in turnManager.ts for the full "why this shape" account.
//
// These tests exercise the two exported pure functions in isolation
// (BattleUnit fixtures via testHelpers, no Mission needed), the same split
// turnManager.test.ts already uses for the Bloom-side functions —
// mission.ts's own wiring (resolveAttack's mech-attacks-Bloom branch,
// runHostileTurn's stun skip, both gated on the equipped weapon branch) is
// covered separately in shockClaws.test.ts.
import { describe, it, expect } from "vitest";
import { applyMechOnHitEffect, isStunned, tickStatusEffects } from "../turnManager";
import { testUnit } from "./testHelpers";

describe("applyMechOnHitEffect", () => {
  it("fx_shock_claws_stun applies a stun status effect to the defender", () => {
    const attacker = testUnit("meeps", { x: 5, y: 5 });
    const defender = testUnit("tank", { x: 6, y: 5 });
    const result = applyMechOnHitEffect("fx_shock_claws_stun", attacker, defender);
    expect(defender.statusEffects).toEqual([{ kind: "stun", magnitude: 0, turnsRemaining: 1 }]);
    expect(result).toEqual({}); // no tile to convert — that's acid_dot's own OnHitApplyResult field, unused here
  });

  it("no-ops on an undefined fxId, an unrecognized fxId, or a downed defender", () => {
    const attacker = testUnit("meeps", { x: 0, y: 0 });

    const d1 = testUnit("tank", { x: 6, y: 5 });
    applyMechOnHitEffect(undefined, attacker, d1);
    expect(d1.statusEffects).toEqual([]);

    const d2 = testUnit("tank", { x: 6, y: 5 });
    applyMechOnHitEffect("fx_does_not_exist", attacker, d2);
    expect(d2.statusEffects).toEqual([]);

    const d3 = testUnit("tank", { x: 6, y: 5 });
    d3.downed = true;
    applyMechOnHitEffect("fx_shock_claws_stun", attacker, d3);
    expect(d3.statusEffects).toEqual([]);
  });

  it("a second stun hit refreshes to the longer duration rather than stacking a second entry — same no-stack rule applyStatusEffect already enforces for acid_dot/debuff_attack", () => {
    const attacker = testUnit("meeps", { x: 0, y: 0 });
    const defender = testUnit("tank", { x: 6, y: 5 });
    applyMechOnHitEffect("fx_shock_claws_stun", attacker, defender);
    defender.statusEffects[0].turnsRemaining = 0; // simulate this turn's tick having already run
    applyMechOnHitEffect("fx_shock_claws_stun", attacker, defender);
    expect(defender.statusEffects).toHaveLength(1);
    expect(defender.statusEffects[0]).toEqual({ kind: "stun", magnitude: 0, turnsRemaining: 1 }); // refreshed, not a second entry
  });
});

describe("isStunned", () => {
  it("is false with no active stun", () => {
    const unit = testUnit("meeps", { x: 0, y: 0 });
    expect(isStunned(unit)).toBe(false);
  });

  it("is true while a stun is live (turnsRemaining > 0)", () => {
    const unit = testUnit("meeps", { x: 0, y: 0 });
    unit.statusEffects.push({ kind: "stun", magnitude: 0, turnsRemaining: 1 });
    expect(isStunned(unit)).toBe(true);
  });

  it("ignores an expired stun (turnsRemaining <= 0) — same just-expired guard attackDebuffMultiplier uses", () => {
    const unit = testUnit("meeps", { x: 0, y: 0 });
    unit.statusEffects.push({ kind: "stun", magnitude: 0, turnsRemaining: 0 });
    expect(isStunned(unit)).toBe(false);
  });

  it("ignores a non-stun status effect", () => {
    const unit = testUnit("meeps", { x: 0, y: 0 });
    unit.statusEffects.push({ kind: "acid_dot", magnitude: 8, turnsRemaining: 2 });
    expect(isStunned(unit)).toBe(false);
  });
});

describe("tickStatusEffects — stun ages down and expires through the same shared tick every other status effect uses", () => {
  it("contributes no DoT damage and expires after its 1-turn duration", () => {
    const unit = testUnit("meeps", { x: 0, y: 0 });
    unit.statusEffects.push({ kind: "stun", magnitude: 0, turnsRemaining: 1 });
    expect(tickStatusEffects(unit)).toBe(0);
    expect(unit.statusEffects).toEqual([]); // there is no separate stun-clearing path — this IS how it clears
  });
});
