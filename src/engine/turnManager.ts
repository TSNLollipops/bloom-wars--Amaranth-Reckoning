// src/engine/turnManager.ts
// On-hit effects engine — Data Pack §8.1's acid DoT / attack debuff /
// knockback, wired for real the first time, 27 Aug 2026. Extended to the
// reverse direction (a mech's own weapon branch applying an effect to a
// Bloom it just hit) plus a new "stun" effect kind, 3 Sep 2026, alongside
// Shock Claws (data/weaponBranches.ts).
//
// This file is the thing data/bloom.ts's own BLOOM_ON_HIT_EFFECTS comment
// has been pointing at since the Wellroot pass ("DoT/debuff ticking lives
// in engine/turnManager.ts") without it actually existing. Until the 27 Aug
// pass, every Bloom archetype's `onHit` field (Gallcyst's acid, Sirenmaw/
// Choir's attack debuff, Heartwood/the Unnamed's knockback, and the
// Wellroot's own acid, added 27 Aug 2026 specifically without a working DoT
// to lean on) was pure flavor data — see that file's own header for the
// Wellroot pass's full account of finding this gap the hard way (an 80%
// win rate against a documented ~35% target, because the acid DoT it was
// counting on to make up for a lower attackPower was never actually
// landing).
//
// 27 Aug 2026 scope, deliberately narrow: this wired the three effect KINDS
// the Data Pack already specifies (acid_dot, debuff_attack, knockback) for
// the SIX Bloom archetypes that already carry a real onHit field. It did
// not add stun or extend this system to any player weapon branch —
// weaponBranches.ts's own header already said those "wait for a dedicated
// status-effect pass"; that pass was this file, but only exercised on the
// Bloom side so far, with a note that "the infrastructure... is generic
// enough that a future status effect on a player weapon can reuse it
// without another rewrite."
//
// 3 Sep 2026: that reuse actually happened. applyMechOnHitEffect (below) is
// the mech->Bloom mirror of applyBloomOnHitEffect — same BattleUnit.
// statusEffects, same applyStatusEffect/tickStatusEffects underneath, only
// a new fxId table (data/weaponBranches.ts's MECH_ON_HIT_EFFECTS, the
// mech-side equivalent of BLOOM_ON_HIT_EFFECTS) and a new "stun" StatusEffect
// kind (engine/units.ts) needed adding — no rewrite of anything that already
// existed. Shock Claws (Meeps' 3rd branch) is the one consumer so far;
// isStunned (below) and its one caller, engine/mission.ts's runHostileTurn,
// are the piece that makes a stunned unit's own turn actually do nothing.
//
// 4 Sep 2026: applyMechOnHitEffect widened again for Riot Drum (Tank's 2nd
// branch) — a "knockback" branch added alongside "stun," reusing
// knockbackDestination()/isKnockbackImmune() exactly as applyBloomOnHitEffect
// already does rather than a second implementation. That reuse is why the
// signature grew a `map`/`occupied` pair it didn't need while only "stun"
// existed — same two params applyBloomOnHitEffect has always taken, for the
// same reason (knockback needs somewhere to check bounds/passability/
// collision against). "Pin" (Riot Drum's other effect) is NOT a new kind —
// see data/weaponBranches.ts's own header comment for why it deliberately
// reuses "stun" outright.
import type { Coord, MapDefinition } from "../data/types";
import { TILES } from "../data/tiles";
import { inBounds, tileAt, chebyshevDistance, coordKey } from "./grid";
import type { BattleUnit, OnHitEffectKind, StatusEffect } from "./units";
import { BLOOM_ON_HIT_EFFECTS } from "../data/bloom";
import { MECH_ON_HIT_EFFECTS } from "../data/weaponBranches";
import { CUTTING_ROOM_MOMENTUM_ATK_BONUS_PCT } from "../data/combatTables";

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
    // cutting_room_sure_footing (Zanretsu, Vault Phase 2 slice 4, 3 Sep
    // 2026) — "Immune to knockback and forced movement." knockback is the
    // ONLY forced-movement mechanic this engine has today (grepped: no
    // other push/pull/displace effect exists anywhere in src/engine or
    // src/data), so gating this one branch covers the ability's full
    // prose, not a partial implementation of it.
    if (isKnockbackImmune(defender)) return {};
    const dest = knockbackDestination(map, attacker.pos, defender.pos, fx.magnitude, occupied);
    if (dest) defender.pos = dest;
    return {};
  }

  return {};
}

/**
 * Applies `fxId`'s effect (data/weaponBranches.ts's MECH_ON_HIT_EFFECTS)
 * from `attacker`'s equipped weapon branch having just landed a hit on
 * `defender` — the mech-side mirror of applyBloomOnHitEffect above, same
 * "generic, not a one-off hack for one branch" shape the header comment at
 * the top of this file promised when it was Bloom-only. Nothing in this
 * function assumes `defender` is specifically a Bloom-shape unit — it reads
 * and writes BattleUnit.statusEffects the same way applyBloomOnHitEffect
 * does, so a future effect that lands on a mech-shape defender (a hostile
 * mech, say) would work here unchanged. No-op if the defender didn't
 * survive the hit (nothing left to stun/knock back) or if `fxId` is
 * undefined/unrecognized, mirroring applyBloomOnHitEffect's own guards
 * exactly.
 *
 * Deliberately does NOT roll any chance of its own — "does this hit even
 * try to apply an effect" is the CALLER's decision (engine/mission.ts reads
 * data/weaponBranches.ts's WEAPON_BRANCH_ON_HIT_EFFECT entries and rolls
 * each one before ever calling this), the same division of labor
 * applyBloomOnHitEffect already has with its own caller (mission.ts decides
 * whether the hit landed at all; this file only applies the effect once
 * told to).
 *
 * `map`/`occupied` added 4 Sep 2026 alongside the "knockback" branch below
 * (Riot Drum) — unused for "stun," same as applyBloomOnHitEffect's own
 * acid_dot/debuff_attack branches ignore them, kept on the shared signature
 * rather than making knockback the odd one out. `attacker` was already kept
 * in the original signature "for whichever future mech-side effect does
 * need it" — knockback is that effect, using attacker.pos exactly the way
 * applyBloomOnHitEffect's own knockback branch does.
 */
export function applyMechOnHitEffect(
  fxId: string | undefined,
  attacker: BattleUnit,
  defender: BattleUnit,
  map: MapDefinition,
  occupied: Set<string>
): OnHitApplyResult {
  if (!fxId || defender.downed) return {};
  const fx = MECH_ON_HIT_EFFECTS[fxId];
  if (!fx) return {};

  if (fx.kind === "stun") {
    applyStatusEffect(defender, { kind: "stun", magnitude: fx.magnitude, turnsRemaining: fx.duration });
    return {};
  }

  if (fx.kind === "knockback") {
    // Same cutting_room_sure_footing immunity gate as applyBloomOnHitEffect's
    // own knockback branch — one shared isKnockbackImmune() check, not a
    // second copy of the rule.
    if (isKnockbackImmune(defender)) return {};
    const dest = knockbackDestination(map, attacker.pos, defender.pos, fx.magnitude, occupied);
    if (dest) defender.pos = dest;
    return {};
  }

  return {};
}

/**
 * seal_borrowed_authority (Simulacrum/The Stolen Seal, Vault Phase 2 slice
 * 6, 3 Sep 2026) — "Next attack copies a random on-hit effect drawn from
 * any Bloom archetype... fought this campaign." Once engine/mission.ts has
 * decided WHICH kind was drawn (that's its job — the draw depends on
 * campaign-persistent state this file has no business knowing about), this
 * is the "actually apply it" half: a thin dispatcher over the two appliers
 * directly above, reusing them exactly as-is rather than re-implementing
 * any effect's logic a third time.
 *
 * Three of the four kinds (acid_dot, debuff_attack, knockback) only exist
 * today as BLOOM_ON_HIT_EFFECTS entries — routed through
 * applyBloomOnHitEffect, same call shape a Bloom's own onHit already uses
 * when IT lands a hit. The fourth (stun) only exists in MECH_ON_HIT_EFFECTS
 * — routed through applyMechOnHitEffect, same call shape Shock Claws
 * already uses. Both appliers already no-op correctly on a downed defender,
 * so this function adds no guard of its own beyond picking the right one.
 *
 * WHICH SPECIFIC fxId represents a given kind, when a table has more than
 * one entry of that kind, is a judgment call: fx_debuff_attack (-20%/2
 * turns) is picked over fx_choir_dissonance (-30%/3 turns, The Choir's own
 * tuned-up sibling) — the copy should read as a generic instance of the
 * KIND, not as strong as the single toughest source that ever carried it.
 * Same reasoning for fx_knockback_1 (there's only one knockback entry
 * today, so no real choice, but the principle would apply if a second ever
 * gets added) and fx_shock_claws_stun (currently the only stun entry).
 */
export function applyCopiedOnHitEffect(
  kind: OnHitEffectKind,
  attacker: BattleUnit,
  defender: BattleUnit,
  defenderSameSide: BattleUnit[],
  map: MapDefinition,
  occupied: Set<string>
): OnHitApplyResult {
  if (kind === "stun") return applyMechOnHitEffect("fx_shock_claws_stun", attacker, defender, map, occupied);
  const fxId = kind === "acid_dot" ? "fx_acid_dot" : kind === "debuff_attack" ? "fx_debuff_attack" : "fx_knockback_1";
  return applyBloomOnHitEffect(fxId, attacker, defender, defenderSameSide, map, occupied);
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
 * Whether `unit` is currently stunned (fx_shock_claws_stun today, any
 * future mech-side stun-kind effect tomorrow) — reads `turnsRemaining > 0`
 * for the same just-expired-effect reason attackDebuffMultiplier does
 * right above. engine/mission.ts's runHostileTurn is this function's one
 * caller: a stunned unit skips its hostile-phase decision and attack
 * entirely for that one turn, the same way an already-`downed` unit is
 * skipped, and the stun's own turnsRemaining ages down and expires through
 * the ordinary tickStatusEffects() pass below like every other status
 * effect — there is no separate stun-specific decay path.
 */
export function isStunned(unit: BattleUnit): boolean {
  return unit.statusEffects.some((e) => e.kind === "stun" && e.turnsRemaining > 0);
}

/**
 * cutting_room_sure_footing (Zanretsu, Vault Phase 2 slice 4, 3 Sep 2026) —
 * whether `unit` currently has an active knockback/forced-movement
 * immunity window open (Mission.cuttingRoomSureFooting() sets it,
 * BattleUnit.sureFootingActive's own comment has the full clock shape).
 * Originally applyBloomOnHitEffect's own knockback branch was the one
 * caller; as of 4 Sep 2026 applyMechOnHitEffect's own "knockback" branch
 * (Riot Drum) calls this too — same one shared gate, not a second immunity
 * rule for the mech->Bloom direction.
 */
export function isKnockbackImmune(unit: BattleUnit): boolean {
  return !!unit.sureFootingActive;
}

/**
 * cutting_room_momentum (Zanretsu, Vault Phase 2 slice 4, 3 Sep 2026) —
 * rank 5's "+10% ATK that same turn" half. The +2 move half lives as a
 * direct, exactly-reverted BattleUnit.moveRange add instead (see
 * engine/mission.ts's per-round reset loop, right where overextended/
 * oathkeeperActive/etc. already get cleared) rather than a multiplier read
 * at every reachableTiles call site — moveRange has no existing "temporary
 * modifier" abstraction the way effectiveAttack does. The ATK half DOES
 * have one (attackDebuffMultiplier, right above), so it reuses that same
 * shape: a 1 (no-op) multiplier for every unit without an active window,
 * so every pre-existing test/sim case stays byte-identical.
 * `unit.momentumAtkBoostActive` is a plain boolean rather than a
 * statusEffects entry — a round-scoped grant tied to one specific
 * Heirloom's own bookkeeping (at most one window, on its own wielder, ever
 * active at a time), not a stackable/duration-ticking combat status the
 * shared StatusEffect array is built to model.
 */
export function momentumAttackMultiplier(unit: BattleUnit): number {
  return unit.momentumAtkBoostActive ? 1 + CUTTING_ROOM_MOMENTUM_ATK_BONUS_PCT : 1;
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
