// Bloom on-hit effects engine (engine/turnManager.ts, 27 Aug 2026) — Data
// Pack §8.1's acid DoT / attack debuff / knockback, wired for real for the
// first time. See that file's own header for the full "why now, why this
// shape" account. These tests exercise the four exported pure functions in
// isolation (BattleUnit fixtures via testHelpers, no Mission needed) —
// mission.ts's own wiring (resolveAttack's bloom-vs-mech branch,
// environmentStep's tick) is covered separately in combat.test.ts and
// mission-level tests.
import { describe, it, expect } from "vitest";
import {
  applyBloomOnHitEffect,
  attackDebuffMultiplier,
  tickStatusEffects,
  knockbackDestination,
  DEBUFF_ATTACK_RADIUS,
} from "../turnManager";
import { makeUniformMap, testUnit } from "./testHelpers";

describe("applyBloomOnHitEffect", () => {
  it("fx_acid_dot applies a status effect to the defender and reports the tile to convert", () => {
    const attacker = testUnit("meeps", { x: 5, y: 5 });
    const defender = testUnit("tank", { x: 6, y: 5 });
    const result = applyBloomOnHitEffect("fx_acid_dot", attacker, defender, [defender], makeUniformMap("plain"), new Set());
    expect(defender.statusEffects).toEqual([{ kind: "acid_dot", magnitude: 8, turnsRemaining: 2 }]);
    expect(result.tileConvertedAt).toEqual({ x: 6, y: 5 });
  });

  it("fx_debuff_attack hits the defender and same-side allies within DEBUFF_ATTACK_RADIUS, Chebyshev", () => {
    const attacker = testUnit("meeps", { x: 0, y: 0 });
    const defender = testUnit("tank", { x: 5, y: 5 });
    const nearAlly = testUnit("meeps", { x: 5 + DEBUFF_ATTACK_RADIUS, y: 5 }); // exactly at the radius — should be hit
    const farAlly = testUnit("meeps", { x: 5 + DEBUFF_ATTACK_RADIUS + 1, y: 5 }); // one tile past — should not
    const enemyBystander = testUnit("meeps", { x: 5 + DEBUFF_ATTACK_RADIUS, y: 5 });
    enemyBystander.side = "hostile"; // not on defender's side — same-side list wouldn't include it anyway, belt-and-braces

    const sameSide = [defender, nearAlly, farAlly];
    applyBloomOnHitEffect("fx_debuff_attack", attacker, defender, sameSide, makeUniformMap("plain"), new Set());

    expect(defender.statusEffects).toEqual([{ kind: "debuff_attack", magnitude: 0.2, turnsRemaining: 2 }]);
    expect(nearAlly.statusEffects).toEqual([{ kind: "debuff_attack", magnitude: 0.2, turnsRemaining: 2 }]);
    expect(farAlly.statusEffects).toEqual([]);
  });

  it("fx_debuff_attack skips a downed same-side unit in range", () => {
    const attacker = testUnit("meeps", { x: 0, y: 0 });
    const defender = testUnit("tank", { x: 5, y: 5 });
    const downedAlly = testUnit("meeps", { x: 6, y: 5 });
    downedAlly.downed = true;
    applyBloomOnHitEffect("fx_debuff_attack", attacker, defender, [defender, downedAlly], makeUniformMap("plain"), new Set());
    expect(downedAlly.statusEffects).toEqual([]);
  });

  it("fx_choir_dissonance uses its own tuned magnitude/duration, same kind", () => {
    const attacker = testUnit("meeps", { x: 0, y: 0 });
    const defender = testUnit("tank", { x: 5, y: 5 });
    applyBloomOnHitEffect("fx_choir_dissonance", attacker, defender, [defender], makeUniformMap("plain"), new Set());
    expect(defender.statusEffects).toEqual([{ kind: "debuff_attack", magnitude: 0.3, turnsRemaining: 3 }]);
  });

  it("fx_knockback_1 moves the defender one tile directly away from the attacker", () => {
    const attacker = testUnit("meeps", { x: 5, y: 5 });
    const defender = testUnit("tank", { x: 6, y: 5 });
    applyBloomOnHitEffect("fx_knockback_1", attacker, defender, [defender], makeUniformMap("plain", 10, 10), new Set());
    expect(defender.pos).toEqual({ x: 7, y: 5 });
  });

  it("fx_none (Undertow) is a no-op", () => {
    const attacker = testUnit("meeps", { x: 0, y: 0 });
    const defender = testUnit("tank", { x: 6, y: 5 });
    const before = { ...defender.pos };
    const result = applyBloomOnHitEffect("fx_none", attacker, defender, [defender], makeUniformMap("plain"), new Set());
    expect(defender.statusEffects).toEqual([]);
    expect(defender.pos).toEqual(before);
    expect(result).toEqual({});
  });

  it("no-ops on an undefined fxId, an unrecognized fxId, or a downed defender", () => {
    const attacker = testUnit("meeps", { x: 0, y: 0 });
    const map = makeUniformMap("plain");

    const d1 = testUnit("tank", { x: 6, y: 5 });
    applyBloomOnHitEffect(undefined, attacker, d1, [d1], map, new Set());
    expect(d1.statusEffects).toEqual([]);

    const d2 = testUnit("tank", { x: 6, y: 5 });
    applyBloomOnHitEffect("fx_does_not_exist", attacker, d2, [d2], map, new Set());
    expect(d2.statusEffects).toEqual([]);

    const d3 = testUnit("tank", { x: 6, y: 5 });
    d3.downed = true;
    applyBloomOnHitEffect("fx_acid_dot", attacker, d3, [d3], map, new Set());
    expect(d3.statusEffects).toEqual([]);
  });

  it("a second acid_dot hit refreshes to the longer duration rather than stacking a second entry", () => {
    const attacker = testUnit("meeps", { x: 5, y: 5 });
    const defender = testUnit("tank", { x: 6, y: 5 });
    applyBloomOnHitEffect("fx_acid_dot", attacker, defender, [defender], makeUniformMap("plain"), new Set());
    defender.statusEffects[0].turnsRemaining = 1; // simulate one tick having already passed
    applyBloomOnHitEffect("fx_acid_dot", attacker, defender, [defender], makeUniformMap("plain"), new Set());
    expect(defender.statusEffects).toHaveLength(1);
    expect(defender.statusEffects[0]).toEqual({ kind: "acid_dot", magnitude: 8, turnsRemaining: 2 });
  });
});

describe("attackDebuffMultiplier", () => {
  it("is 1 (no-op) with no active debuff", () => {
    const unit = testUnit("meeps", { x: 0, y: 0 });
    expect(attackDebuffMultiplier(unit)).toBe(1);
  });

  it("returns 1 - magnitude while the debuff is live", () => {
    const unit = testUnit("meeps", { x: 0, y: 0 });
    unit.statusEffects.push({ kind: "debuff_attack", magnitude: 0.2, turnsRemaining: 2 });
    expect(attackDebuffMultiplier(unit)).toBeCloseTo(0.8);
  });

  it("ignores an expired debuff (turnsRemaining <= 0)", () => {
    const unit = testUnit("meeps", { x: 0, y: 0 });
    unit.statusEffects.push({ kind: "debuff_attack", magnitude: 0.2, turnsRemaining: 0 });
    expect(attackDebuffMultiplier(unit)).toBe(1);
  });

  it("ignores an acid_dot entry — only debuff_attack affects the multiplier", () => {
    const unit = testUnit("meeps", { x: 0, y: 0 });
    unit.statusEffects.push({ kind: "acid_dot", magnitude: 8, turnsRemaining: 2 });
    expect(attackDebuffMultiplier(unit)).toBe(1);
  });
});

describe("tickStatusEffects", () => {
  it("returns 0 and mutates nothing for a unit with no active effects", () => {
    const unit = testUnit("meeps", { x: 0, y: 0 });
    expect(tickStatusEffects(unit)).toBe(0);
    expect(unit.statusEffects).toEqual([]);
  });

  it("sums acid_dot magnitude across every active acid_dot entry", () => {
    // Can't happen via applyBloomOnHitEffect's own no-stack rule, but
    // tickStatusEffects itself should still sum whatever's actually on the
    // array rather than assuming there's only ever one.
    const unit = testUnit("meeps", { x: 0, y: 0 });
    unit.statusEffects.push({ kind: "acid_dot", magnitude: 8, turnsRemaining: 2 }, { kind: "acid_dot", magnitude: 3, turnsRemaining: 1 });
    expect(tickStatusEffects(unit)).toBe(11);
  });

  it("ignores debuff_attack for damage purposes but still ages it", () => {
    const unit = testUnit("meeps", { x: 0, y: 0 });
    unit.statusEffects.push({ kind: "debuff_attack", magnitude: 0.2, turnsRemaining: 2 });
    expect(tickStatusEffects(unit)).toBe(0);
    expect(unit.statusEffects[0].turnsRemaining).toBe(1);
  });

  it("ages every effect by one turn and drops whichever expires", () => {
    const unit = testUnit("meeps", { x: 0, y: 0 });
    unit.statusEffects.push({ kind: "acid_dot", magnitude: 8, turnsRemaining: 1 }, { kind: "debuff_attack", magnitude: 0.2, turnsRemaining: 3 });
    tickStatusEffects(unit);
    expect(unit.statusEffects).toEqual([{ kind: "debuff_attack", magnitude: 0.2, turnsRemaining: 2 }]);
  });
});

describe("knockbackDestination", () => {
  it("pushes straight along a cardinal hit", () => {
    const map = makeUniformMap("plain", 10, 10);
    const dest = knockbackDestination(map, { x: 5, y: 5 }, { x: 6, y: 5 }, 1, new Set());
    expect(dest).toEqual({ x: 7, y: 5 });
  });

  it("resolves a diagonal hit to the larger-displacement axis", () => {
    const map = makeUniformMap("plain", 10, 10);
    // attacker at (5,5), defender at (7,6): dx=2, dy=1 -> x-axis wins
    const dest = knockbackDestination(map, { x: 5, y: 5 }, { x: 7, y: 6 }, 1, new Set());
    expect(dest).toEqual({ x: 8, y: 6 });
  });

  it("an exact diagonal tie resolves toward the x-axis", () => {
    const map = makeUniformMap("plain", 10, 10);
    const dest = knockbackDestination(map, { x: 5, y: 5 }, { x: 6, y: 6 }, 1, new Set());
    expect(dest).toEqual({ x: 7, y: 6 });
  });

  it("returns null when attacker and defender share a tile", () => {
    const map = makeUniformMap("plain", 10, 10);
    expect(knockbackDestination(map, { x: 5, y: 5 }, { x: 5, y: 5 }, 1, new Set())).toBeNull();
  });

  it("returns null (no partial push) when the destination is off the map", () => {
    const map = makeUniformMap("plain", 10, 10);
    const dest = knockbackDestination(map, { x: 8, y: 5 }, { x: 9, y: 5 }, 1, new Set());
    expect(dest).toBeNull();
  });

  it("returns null when the destination tile isn't ground-passable", () => {
    const map = makeUniformMap("plain", 10, 10);
    map.tiles[5][7] = "wall";
    const dest = knockbackDestination(map, { x: 5, y: 5 }, { x: 6, y: 5 }, 1, new Set());
    expect(dest).toBeNull();
  });

  it("returns null when the destination is already occupied", () => {
    const map = makeUniformMap("plain", 10, 10);
    const occupied = new Set(["7,5"]);
    const dest = knockbackDestination(map, { x: 5, y: 5 }, { x: 6, y: 5 }, 1, occupied);
    expect(dest).toBeNull();
  });
});
