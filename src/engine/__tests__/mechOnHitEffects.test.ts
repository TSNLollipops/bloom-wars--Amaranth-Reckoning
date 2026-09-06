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
// covered separately in shockClaws.test.ts / riotDrum.test.ts /
// suppressionAutocannon.test.ts.
//
// applyMechOnHitEffect's signature grew a `defenderSameSide` param 5 Sep
// 2026 alongside Suppression Autocannon's "debuff_attack" branch (see
// turnManager.ts's own header) — every pre-existing call below is updated
// to pass one (`[defender]` is enough for the stun/knockback cases, which
// never read it) rather than left on a stale signature.
import { describe, it, expect } from "vitest";
import { applyMechOnHitEffect, isStunned, tickStatusEffects, DEBUFF_ATTACK_RADIUS } from "../turnManager";
import { makeUniformMap, testUnit } from "./testHelpers";

describe("applyMechOnHitEffect", () => {
  it("fx_shock_claws_stun applies a stun status effect to the defender", () => {
    const attacker = testUnit("meeps", { x: 5, y: 5 });
    const defender = testUnit("tank", { x: 6, y: 5 });
    const result = applyMechOnHitEffect("fx_shock_claws_stun", attacker, defender, [defender], makeUniformMap("plain"), new Set());
    expect(defender.statusEffects).toEqual([{ kind: "stun", magnitude: 0, turnsRemaining: 1 }]);
    expect(result).toEqual({}); // no tile to convert — that's acid_dot's own OnHitApplyResult field, unused here
  });

  it("no-ops on an undefined fxId, an unrecognized fxId, or a downed defender", () => {
    const attacker = testUnit("meeps", { x: 0, y: 0 });
    const map = makeUniformMap("plain");

    const d1 = testUnit("tank", { x: 6, y: 5 });
    applyMechOnHitEffect(undefined, attacker, d1, [d1], map, new Set());
    expect(d1.statusEffects).toEqual([]);

    const d2 = testUnit("tank", { x: 6, y: 5 });
    applyMechOnHitEffect("fx_does_not_exist", attacker, d2, [d2], map, new Set());
    expect(d2.statusEffects).toEqual([]);

    const d3 = testUnit("tank", { x: 6, y: 5 });
    d3.downed = true;
    applyMechOnHitEffect("fx_shock_claws_stun", attacker, d3, [d3], map, new Set());
    expect(d3.statusEffects).toEqual([]);
  });

  it("a second stun hit refreshes to the longer duration rather than stacking a second entry — same no-stack rule applyStatusEffect already enforces for acid_dot/debuff_attack", () => {
    const attacker = testUnit("meeps", { x: 0, y: 0 });
    const defender = testUnit("tank", { x: 6, y: 5 });
    const map = makeUniformMap("plain");
    applyMechOnHitEffect("fx_shock_claws_stun", attacker, defender, [defender], map, new Set());
    defender.statusEffects[0].turnsRemaining = 0; // simulate this turn's tick having already run
    applyMechOnHitEffect("fx_shock_claws_stun", attacker, defender, [defender], map, new Set());
    expect(defender.statusEffects).toHaveLength(1);
    expect(defender.statusEffects[0]).toEqual({ kind: "stun", magnitude: 0, turnsRemaining: 1 }); // refreshed, not a second entry
  });

  // fx_riot_drum_knockback / fx_riot_drum_pin (4 Sep 2026) — Riot Drum,
  // Tank's 2nd branch. Pin is "stun" under the hood (see
  // data/weaponBranches.ts's own header comment for why), so its own
  // coverage is already exercised by the fx_shock_claws_stun cases above
  // (same kind, same applyStatusEffect path) — fx_riot_drum_pin gets one
  // dedicated test below just to confirm ITS OWN duration constant
  // (RIOT_DRUM_PIN_DURATION_TURNS) is what actually lands, not Shock
  // Claws' unrelated one. Knockback gets full coverage, mirroring
  // turnManager.test.ts's own fx_knockback_1 cases exactly (same
  // mechanism, reused, not reimplemented).
  it("fx_riot_drum_knockback moves the defender one tile directly away from the attacker", () => {
    const attacker = testUnit("tank", { x: 5, y: 5 });
    const defender = testUnit("meeps", { x: 6, y: 5 });
    applyMechOnHitEffect("fx_riot_drum_knockback", attacker, defender, [defender], makeUniformMap("plain", 10, 10), new Set());
    expect(defender.pos).toEqual({ x: 7, y: 5 });
  });

  it("fx_riot_drum_knockback is blocked entirely by cutting_room_sure_footing immunity — same isKnockbackImmune() gate applyBloomOnHitEffect's own knockback branch uses", () => {
    const attacker = testUnit("tank", { x: 5, y: 5 });
    const defender = testUnit("meeps", { x: 6, y: 5 });
    defender.sureFootingActive = true;
    const before = { ...defender.pos };
    applyMechOnHitEffect("fx_riot_drum_knockback", attacker, defender, [defender], makeUniformMap("plain", 10, 10), new Set());
    expect(defender.pos).toEqual(before);
  });

  it("fx_riot_drum_knockback returns null-safe no movement when the destination is off-map, non-passable, or occupied — same knockbackDestination() contract, reused not reimplemented", () => {
    const attacker = testUnit("tank", { x: 1, y: 5 });
    const defender = testUnit("meeps", { x: 0, y: 5 }); // already at the west edge — one more step west is off-map
    applyMechOnHitEffect("fx_riot_drum_knockback", attacker, defender, [defender], makeUniformMap("plain", 10, 10), new Set());
    expect(defender.pos).toEqual({ x: 0, y: 5 }); // unmoved
  });

  it("fx_riot_drum_pin applies a stun status effect using RIOT_DRUM_PIN_DURATION_TURNS, not Shock Claws' own duration", () => {
    const attacker = testUnit("tank", { x: 5, y: 5 });
    const defender = testUnit("meeps", { x: 6, y: 5 });
    applyMechOnHitEffect("fx_riot_drum_pin", attacker, defender, [defender], makeUniformMap("plain"), new Set());
    expect(defender.statusEffects).toEqual([{ kind: "stun", magnitude: 0, turnsRemaining: 1 }]);
    expect(isStunned(defender)).toBe(true); // confirms pin really is the same mechanism stun already is, per the design decision
  });

  // fx_suppression_autocannon_debuff (5 Sep 2026) — Suppression Autocannon,
  // Reeps' 3rd branch. Same debuff_attack shape turnManager.test.ts already
  // covers for the Bloom-side fx_debuff_attack (same radius constant, same
  // same-side-allies rule, same magnitude/duration) — these cases mirror
  // that file's own fx_debuff_attack tests, on the mech->Bloom side.
  it("fx_suppression_autocannon_debuff hits the defender and same-side allies within DEBUFF_ATTACK_RADIUS, Chebyshev", () => {
    const attacker = testUnit("reeps", { x: 0, y: 0 });
    const defender = testUnit("tank", { x: 5, y: 5 });
    const nearAlly = testUnit("tank", { x: 5 + DEBUFF_ATTACK_RADIUS, y: 5 }); // exactly at the radius — should be hit
    const farAlly = testUnit("tank", { x: 5 + DEBUFF_ATTACK_RADIUS + 1, y: 5 }); // one tile past — should not

    const sameSide = [defender, nearAlly, farAlly];
    applyMechOnHitEffect("fx_suppression_autocannon_debuff", attacker, defender, sameSide, makeUniformMap("plain"), new Set());

    expect(defender.statusEffects).toEqual([{ kind: "debuff_attack", magnitude: 0.2, turnsRemaining: 2 }]);
    expect(nearAlly.statusEffects).toEqual([{ kind: "debuff_attack", magnitude: 0.2, turnsRemaining: 2 }]);
    expect(farAlly.statusEffects).toEqual([]);
  });

  it("fx_suppression_autocannon_debuff skips a downed same-side unit in range", () => {
    const attacker = testUnit("reeps", { x: 0, y: 0 });
    const defender = testUnit("tank", { x: 5, y: 5 });
    const downedAlly = testUnit("tank", { x: 6, y: 5 });
    downedAlly.downed = true;
    applyMechOnHitEffect(
      "fx_suppression_autocannon_debuff",
      attacker,
      defender,
      [defender, downedAlly],
      makeUniformMap("plain"),
      new Set()
    );
    expect(downedAlly.statusEffects).toEqual([]);
  });

  it("a second fx_suppression_autocannon_debuff hit refreshes to the longer duration rather than stacking a second entry — same no-stack rule as every other debuff_attack source", () => {
    const attacker = testUnit("reeps", { x: 0, y: 0 });
    const defender = testUnit("tank", { x: 5, y: 5 });
    const map = makeUniformMap("plain");
    applyMechOnHitEffect("fx_suppression_autocannon_debuff", attacker, defender, [defender], map, new Set());
    defender.statusEffects[0].turnsRemaining = 1; // simulate one tick having already passed
    applyMechOnHitEffect("fx_suppression_autocannon_debuff", attacker, defender, [defender], map, new Set());
    expect(defender.statusEffects).toHaveLength(1);
    expect(defender.statusEffects[0]).toEqual({ kind: "debuff_attack", magnitude: 0.2, turnsRemaining: 2 });
  });

  it("fx_suppression_autocannon_debuff never applies to a downed defender, even though the guard runs before the radius check", () => {
    const attacker = testUnit("reeps", { x: 0, y: 0 });
    const defender = testUnit("tank", { x: 5, y: 5 });
    defender.downed = true;
    applyMechOnHitEffect("fx_suppression_autocannon_debuff", attacker, defender, [defender], makeUniformMap("plain"), new Set());
    expect(defender.statusEffects).toEqual([]);
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
