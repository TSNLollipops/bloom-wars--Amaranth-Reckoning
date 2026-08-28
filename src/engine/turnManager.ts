// src/engine/turnManager.ts
// Bloom on-hit effects engine — Data Pack §8.1's acid DoT / attack debuff /
// knockback, wired for real the first time, 27 Aug 2026.
//
// This file is the thing data/bloom.ts's own BLOOM_ON_HIT_EFFECTS comment
// has been pointing at since the Wellroot pass ("DoT/debuff ticking lives
// in engine/turnManager.ts") without it actually existing. Until this pass,
// every Bloom archetype's `onHit` field (Gallcyst's acid, Sirenmaw/Choir's
// attack debuff, Heartwood/the Unnamed's knockback, and the Wellroot's own
// acid, added 27 Aug 2026 specifically without a working DoT to lean on)
// was pure flavor data — see that file's own header for the Wellroot
// pass's full account of finding this gap the hard way (an 80% win rate
// against a documented ~35% target, because the acid DoT it was counting
// on to make up for a lower attackPower was never actually landing).
//
// Scope, deliberately narrow: this wires the three effect KINDS the Data
// Pack already specifies (acid_dot, debuff_attack, knockback) for the SIX
// Bloom archetypes that already carry a real onHit field. It does not add
// stun (Shock Claws, still-unbuilt per the Mek Workshop/Weapon Progression
// doc's own §5 flag) or extend this system to any player weapon branch —
// weaponBranches.ts's own header already says those "wait for a dedicated
// status-effect pass"; this IS that pass, but only exercised on the Bloom
// side so far. The infrastructure (BattleUnit.statusEffects, the apply/
// tick/multiplier functions below) is generic enough that a future status
// effect on a player weapon can reuse it without another rewrite.
import type { Coord, MapDefinition } from "../data/types";
import { TILES } from "../data/tiles";
import { inBounds, tileAt, chebyshevDistance, coordKey } from "./grid";
import type { BattleUnit, StatusEffect } from "./units";
import { BLOOM_ON_HIT_EFFECTS } from "../data/bloom";

/** fx_debuff_attack / fx_choir_dissonance (Data Pack §8.1) — "target + friendlies within 2 tiles," Chebyshev per every other range check in this engine. */
export const DEBUFF_ATTACK_RADIUS = 2;

export interface OnHitApplyResult {
  /** Set only for acid_dot — the tile under the (still-standing) defender that the CALLER should convert to bloom_mat. Not mutated here: this file stays BattleUnit-only, matching combat.ts's own split between unit math and map mutation, which engine/mission.ts already owns (tickBloomRegrowth, clearBloom). */
  tileConvertedAt?: Coord;
}

/**
 * Applies `fxId`'s effect (data/bloom.ts's BLOOM_ON_HIT_EFFECTS) from
 * `attacker` having just landed a hit on `defender`. No-op if the defender
 * didn't survive the hit (a downed unit has nothing left to debuff, DoT, or
 * knock back), if `fxId` is undefined/unrecognized, or if it resolves to
 * "none" (fx_none, Undertow's own onHit — flavor only, by design).
 *
 * `defenderSameSide` should be the full same-side roster (mission.ts's own
 * `sameSideAsDefender`, already computed at the resolveAttack call site) —
 * this function filters it itself (excludes the defender, excludes downed
 * units, applies the radius check) rather than asking the caller to
 * pre-filter, so the debuff's "does it reach a friendly" rule lives in
 * exactly one place.
 *
 * `occupied` is the knockback destination's collision set: every OTHER
 * living unit's tile (the defender's own current tile should NOT be in it —
 * it's about to move off that tile, not colliding with itself).
 */
export function applyBloomOnHitEffect(
  fxId: string | undefined,
  attacker: BattleUnit,
  defender: BattleUnit,
  defenderSameSide: BattleUnit[],
  map: MapDefinition,
  occupied: Set<string>
): OnHitApplyResult {
  if (!fxId || defender.downed) return {};
  const fx = BLOOM_ON_HIT_EFFECTS[fxId];
  if (!fx || fx.kind === "none") return {};

  if (fx.kind === "acid_dot") {
    applyStatusEffect(defender, { kind: "acid_dot", magnitude: fx.magnitude, turnsRemaining: fx.duration });
    return { tileConvertedAt: { ...defender.pos } };
  }

  if (fx.kind === "debuff_attack") {
    const targets = defenderSameSide.filter(
      (u) =>
        !u.downed &&
        (u.instanceId === defender.instanceId || chebyshevDistance(u.pos, defender.pos) <= DEBUFF_ATTACK_RADIUS)
    );
    for (const u of targets) {
      applyStatusEffect(u, { kind: "debuff_attack", magnitude: fx.magnitude, turnsRemaining: fx.duration });
    }
    return {};
  }

  if (fx.kind === "knockback") {
    const dest = knockbackDestination(map, attacker.pos, defender.pos, fx.magnitude, occupied);
    if (dest) defender.pos = dest;
    return {};
  }

  return {};
}

/**
 * "Does not stack; longest duration wins" — data/bloom.ts's own rule for
 * fx_debuff_attack, extended here to acid_dot too. That extension is a
 * judgment call, not spec: the Data Pack only states the no-stack rule for
 * the debuff, and is silent on what happens if an already-acid-DoT'd unit
 * gets hit by a second acid attack before the first wears off. Left
 * uncapped, that case would let repeated hits compound into an
 * ever-growing per-turn DoT tick — a real risk with attackRange-3
 * archetypes (Gallcyst, the Wellroot) that can plausibly land back-to-back
 * hits on the same target — so this refreshes an existing effect of the
 * same kind to whichever duration is longer rather than adding a second,
 * independently-ticking entry. Flagged here rather than silently decided,
 * since it's a real behavioral choice with no source to point at.
 */
function applyStatusEffect(unit: BattleUnit, effect: StatusEffect): void {
  const existing = unit.statusEffects.find((e) => e.kind === effect.kind);
  if (!existing) {
    unit.statusEffects.push({ ...effect });
    return;
  }
  existing.magnitude = effect.magnitude;
  existing.turnsRemaining = Math.max(existing.turnsRemaining, effect.turnsRemaining);
}

/**
 * The multiplier engine/combat.ts applies to an attacker's effectiveAttack
 * — 1 minus the magnitude of any active fx_debuff_attack/fx_choir_dissonance
 * effect on `unit`, or 1 (no change) if none is active. Reads
 * `turnsRemaining > 0` rather than just "does an entry exist" so a caller
 * that hasn't run this mission's own environmentStep tick yet in the same
 * frame (there's exactly one such caller today — none, but defensive
 * either way) can't read a just-expired effect as still live.
 */
export function attackDebuffMultiplier(unit: BattleUnit): number {
  const effect = unit.statusEffects.find((e) => e.kind === "debuff_attack" && e.turnsRemaining > 0);
  return effect ? 1 - effect.magnitude : 1;
}

/**
 * One environment-step tick (engine/mission.ts's environmentStep, the same
 * once-per-full-cycle cadence bloom_mat's own turnStartDamage already
 * uses) for every status effect currently on `unit`: sums this tick's
 * acid_dot damage (the caller applies it via applyMechDamage/
 * applyBloomDamage and handles downing — kept out of this function so it
 * stays a pure BattleUnit->number read, not a mutator with side effects a
 * test would need a whole Mission to exercise), then ages every effect by
 * one turn and drops whichever expired. Safe to call on a unit with no
 * active effects (returns 0, mutates nothing).
 */
export function tickStatusEffects(unit: BattleUnit): number {
  let dotDamage = 0;
  for (const effect of unit.statusEffects) {
    if (effect.kind === "acid_dot") dotDamage += effect.magnitude;
  }
  for (const effect of unit.statusEffects) effect.turnsRemaining -= 1;
  unit.statusEffects = unit.statusEffects.filter((e) => e.turnsRemaining > 0);
  return dotDamage;
}

/**
 * fx_knockback_1 (Heartwood / the Unnamed) — pushes `defenderPos`
 * `magnitude` tiles directly away from `attackerPos`. Movement on this
 * grid is 4-directional (grid.ts's own CARDINAL comment: "the grid is a
 * tactics grid, not a hex/8-dir board"), even though attack range itself
 * is Chebyshev — so a diagonal hit (both archetypes have attackRange up to
 * [1,4]/[1,5], easily diagonal) has no diagonal step to push along.
 * Resolved onto whichever single axis has the larger displacement; an
 * exact tie (a perfectly diagonal hit, |dx| === |dy|) resolves toward the
 * x-axis — arbitrary, but consistent and cheap to change if it ever reads
 * wrong in play.
 *
 * Returns null (no movement at all) rather than a best-effort partial push
 * if the full-magnitude destination is off the map, non-ground-passable
 * terrain, or already occupied by another unit — there's no spec for a
 * partial knockback or for displacing into/through another unit, so "can't
 * complete cleanly -> doesn't happen" is the safest reading, not a guess
 * that could put two units on the same tile or push someone off the board.
 */
export function knockbackDestination(
  map: MapDefinition,
  attackerPos: Coord,
  defenderPos: Coord,
  magnitude: number,
  occupied: Set<string>
): Coord | null {
  const dx = defenderPos.x - attackerPos.x;
  const dy = defenderPos.y - attackerPos.y;
  if (dx === 0 && dy === 0) return null; // can't knock away from your own tile
  const stepX = Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) : 0;
  const stepY = stepX === 0 ? Math.sign(dy) : 0;
  const dest = { x: defenderPos.x + stepX * magnitude, y: defenderPos.y + stepY * magnitude };
  if (!inBounds(map, dest)) return null;
  if (!TILES[tileAt(map, dest)].passableGround) return null;
  if (occupied.has(coordKey(dest))) return null;
  return dest;
}
