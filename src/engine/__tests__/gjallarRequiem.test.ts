// Vault Phase 2, slice 7 (3 Sep 2026) — requiem_severance (Gjallar / the
// Requiem system). The LAST of this build-out's eight abilities. See
// data/heirlooms.ts's own `requiem` entry and engine/mission.ts's "Vault
// Phase 2, slice 7" section header for the full spec (Data Pack §11.5's
// SEVERANCE constant + GDD §8's mechanics table, both pulled live rather
// than from memory) and its own FLAGGED ASSUMPTION #1/#2. Sibling file to
// cinderLine.test.ts/heirloomSignatures2.test.ts — same house test style
// throughout: this file reuses that convention's quietMission()/pilot()/
// mover()/grant()/logsMatching() verbatim rather than importing it, per
// this session's own "each Vault-slice test file keeps its own local copy"
// precedent.
//
// One honestly-reported design call worth flagging up front, not just at
// its own definition site: FULL_HP_DAMAGE_CAP is 90 and SEVERANCE.damage is
// a fixed 80 — for a MECH-shape target specifically, "ignores the full-HP
// damage cap" can never actually change an observed outcome under today's
// numbers (the cap only ever reduces a raw hit above it, and 80 never
// reaches 90). The genuinely load-bearing bypass is on the BLOOM side,
// where the equivalent wall is Endurance, not a raw-damage cap — see the
// "ignores the full-HP damage cap" describe block below for a test that
// says so explicitly, and the "Collapse-checks Bloom directly" block for
// the comparison that actually demonstrates the bypass changing an outcome.
import { describe, it, expect } from "vitest";
import { Mission } from "../mission";
import { AMARANTH_MISSION_1 } from "../../data/campaignAmaranth";
import { createHostileMechUnit, createBloomUnit, type BattleUnit } from "../units";
import { applyBloomDamage } from "../combat";
import { SEVERANCE } from "../../data/abilities";
import { FULL_HP_DAMAGE_CAP, OATHKEEPER_HP_FLOOR, MAX_ACTIONS_PER_TURN } from "../../data/combatTables";

const PARK: Record<string, { x: number; y: number }> = {
  pilot_rourke: { x: 0, y: 0 },
  pilot_bosk: { x: 1, y: 0 },
  pilot_iyari: { x: 2, y: 0 },
  pilot_anand: { x: 3, y: 0 },
  pilot_lask: { x: 4, y: 0 },
};

function quietMission(): Mission {
  // rng pinned to never satisfy `rng() < MEEPS_DODGE_CHANCE` (0.4) — this
  // file drives several real mission.attack() calls (chargeToFull, and the
  // "damage taken" charge test) that a Meeps-path unit on either end of
  // could otherwise dodge ~40% of the time (MEEPS_DODGE_CHANCE,
  // data/combatTables.ts), which is a real flake source cinderLine.test.ts
  // never had to account for (its own tests never call mission.attack()).
  const mission = new Mission(AMARANTH_MISSION_1, undefined, undefined, { rng: () => 1 });
  for (const u of mission.units) {
    if (u.side === "hostile") u.downed = true;
    else u.pos = { ...PARK[u.pilotId!] };
  }
  const keeper = createHostileMechUnit("hostile_mech_01", { x: 19, y: 11 });
  keeper.vision = 0;
  keeper.moveRange = 0;
  mission.units.push(keeper);
  return mission;
}

function pilot(mission: Mission, pilotId: string, pos?: { x: number; y: number }): BattleUnit {
  const u = mission.units.find((x) => x.pilotId === pilotId)!;
  if (pos) u.pos = { ...pos };
  return u;
}

function mover(mission: Mission, pos: { x: number; y: number }, opts?: { hp?: number }): BattleUnit {
  const h = createHostileMechUnit("hostile_mech_02", { ...pos });
  h.moveRange = 0;
  h.vision = 0;
  if (opts?.hp !== undefined) {
    h.currentHp = opts.hp;
    h.maxHp = opts.hp;
  }
  mission.units.push(h);
  return h;
}

function grant(unit: BattleUnit, abilityId: string, rank = 1): void {
  unit.abilities = [...unit.abilities, abilityId];
  unit.heirloomAbilityRanks = { ...unit.heirloomAbilityRanks, [abilityId]: rank };
}

/**
 * Fills the shared Requiem charge meter to SEVERANCE.maxCharge via one real,
 * resolved attack against a fresh, adjacent, disposable target (its own
 * throwaway mover(), never one of the fixed PARK pilots or the far-off
 * "keeper" hostile — attackRange is melee-only [1,1] on every archetype
 * this file uses, and the keeper sits at (19,11) specifically so it's
 * unreachable/harmless, which also makes it unreachable for THIS purpose).
 * Not at full HP, so FULL_HP_DAMAGE_CAP never binds and the raw hit can be
 * made arbitrarily large. The meter is company-wide engine state with no
 * public setter, so every test that needs it full drives it through the
 * real accrual path (mission.attack), never a direct field write.
 */
function chargeToFull(mission: Mission, attackerId: string): void {
  const attacker = mission.unitById(attackerId)!;
  // A fresh, adjacent, disposable target — never one of the fixed PARK
  // pilots or the far-off "keeper" hostile (attackRange is melee-only
  // [1,1] on every archetype this file uses, and the keeper sits at
  // (19,11) specifically so it's unreachable/harmless, which also makes it
  // unreachable for THIS purpose).
  const throwaway = mover(mission, { x: attacker.pos.x + 1, y: attacker.pos.y }, { hp: 999999 });
  throwaway.currentHp = throwaway.maxHp - 1; // not full HP — the cap never applies, so the raw hit stays huge
  throwaway.canCounter = false; // this hit only exists to prime the meter — a counter-swing back at attacker would leave it at some HP a LATER test's own "before" baseline can't predict
  attacker.effectiveAttack = 100000;
  mission.attack(attackerId, throwaway.instanceId);
  attacker.actionsRemaining = MAX_ACTIONS_PER_TURN; // undo the action spend so the caller's own setup isn't constrained by this bookkeeping hit
  // Spent its purpose — marked downed and out of livingUnits() so it can
  // never accidentally sit inside a LATER test's own requiemSeverance line
  // (this same tile is often reused by that test's real setup).
  throwaway.downed = true;
}

const logsMatching = (mission: Mission, needle: string) => mission.log.filter((l) => l.includes(needle));

// =====================================================================
// Geometry — the fixed 8-tile line, origin included
// =====================================================================

describe("Mission.requiemSeverance — line geometry", () => {
  it("cardinal fire: exactly SEVERANCE.shape.length tiles, starting at and including the origin's own tile", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(rourke, "requiem_severance");
    chargeToFull(mission, rourke.instanceId);

    const preview = mission.previewRequiemSeverance(rourke.instanceId, { x: 8, y: 5 });
    expect(preview).toEqual([
      { x: 5, y: 5 },
      { x: 6, y: 5 },
      { x: 7, y: 5 },
      { x: 8, y: 5 },
      { x: 9, y: 5 },
      { x: 10, y: 5 },
      { x: 11, y: 5 },
      { x: 12, y: 5 },
    ]);
    expect(preview!.length).toBe(SEVERANCE.shape.length);
  });

  it("diagonal fire works identically to cardinal", () => {
    const mission = quietMission(); // map_amaranth_muster is 20 wide x 12 tall (y: 0..11)
    const rourke = pilot(mission, "pilot_rourke", { x: 10, y: 8 });
    grant(rourke, "requiem_severance");
    chargeToFull(mission, rourke.instanceId);

    const preview = mission.previewRequiemSeverance(rourke.instanceId, { x: 8, y: 6 });
    expect(preview).toEqual([
      { x: 10, y: 8 },
      { x: 9, y: 7 },
      { x: 8, y: 6 },
      { x: 7, y: 5 },
      { x: 6, y: 4 },
      { x: 5, y: 3 },
      { x: 4, y: 2 },
      { x: 3, y: 1 },
    ]);
  });

  it("clips at the board edge rather than erroring — a short line near an edge, not a crash", () => {
    const mission = quietMission(); // map_amaranth_muster is 20 wide (x: 0..19)
    const rourke = pilot(mission, "pilot_rourke", { x: 18, y: 5 });
    grant(rourke, "requiem_severance");
    chargeToFull(mission, rourke.instanceId);

    const preview = mission.previewRequiemSeverance(rourke.instanceId, { x: 19, y: 5 });
    expect(preview).toEqual([
      { x: 18, y: 5 },
      { x: 19, y: 5 },
    ]);
  });

  it("rejects a click that isn't a legal cardinal/diagonal direction from the origin", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(rourke, "requiem_severance");
    chargeToFull(mission, rourke.instanceId);

    expect(mission.previewRequiemSeverance(rourke.instanceId, { x: 8, y: 6 })).toBeNull();
    expect(mission.requiemSeverance(rourke.instanceId, { x: 8, y: 6 })).toBeNull();
  });

  it("getRequiemDirectionTargets enumerates all 8 directions out to the board edge, not just the fixed hit-length", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 18, y: 5 });
    grant(rourke, "requiem_severance");
    chargeToFull(mission, rourke.instanceId);

    const targets = mission.getRequiemDirectionTargets(rourke.instanceId);
    // +x direction only reaches x=19 (board edge) — one tile, not 8, since
    // the direction set is clipped at the map boundary, not at
    // SEVERANCE.shape.length.
    expect(targets.some((c) => c.x === 19 && c.y === 5)).toBe(true);
    expect(targets.some((c) => c.x === 20)).toBe(false);
    // -x direction has plenty of room and should list several tiles.
    expect(targets.filter((c) => c.y === 5 && c.x < 18).length).toBeGreaterThan(1);
  });
});

// =====================================================================
// "Ignores the full-HP damage cap" — mech-shape targets
// =====================================================================

describe("Mission.requiemSeverance — ignores the full-HP damage cap (mech targets)", () => {
  it("deals exactly the fixed SEVERANCE.damage to a full-HP defender, unmodified by DEF or terrain — where an ordinary attack in the identical spot would deal far less", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(rourke, "requiem_severance");
    chargeToFull(mission, rourke.instanceId);

    const target = mover(mission, { x: 6, y: 5 });
    target.effectiveDefense = 100000; // an ordinary attack here would round to ~0 damage via the 100/defense term
    target.currentHp = target.maxHp; // full HP — this is exactly the case FULL_HP_DAMAGE_CAP exists to gate

    const result = mission.requiemSeverance(rourke.instanceId, { x: 8, y: 5 })!;
    expect(result.hitIds).toContain(target.instanceId);
    expect(target.currentHp).toBe(target.maxHp - SEVERANCE.damage);

    // Honest finding, not silently omitted: under today's numbers
    // (SEVERANCE.damage 80 < FULL_HP_DAMAGE_CAP 90), the cap-bypass is
    // mechanically inert for a mech target — a raw 80 was never going to be
    // capped in the first place. What actually changed the outcome above is
    // "fixed, unmodified by DEF/terrain," not "ignores the cap" specifically.
    expect(SEVERANCE.damage).toBeLessThan(FULL_HP_DAMAGE_CAP);
  });

  it("no dodge, no counter — Requiem never calls the resolver formula those two house rules live inside", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(rourke, "requiem_severance");
    chargeToFull(mission, rourke.instanceId);

    const target = mover(mission, { x: 6, y: 5 });
    target.canCounter = true;
    target.counterMaxRange = 5; // would trivially counter a normal attack from here

    const before = rourke.currentHp;
    mission.requiemSeverance(rourke.instanceId, { x: 8, y: 5 });
    expect(rourke.currentHp).toBe(before - SEVERANCE.damage); // self-hit only (origin included), no counter damage on top
  });
});

// =====================================================================
// "Collapse-checks Bloom directly" — the load-bearing bypass
// =====================================================================

describe("Mission.requiemSeverance — versus Bloom, bypasses Endurance and Collapse-checks Vitality directly", () => {
  it("kills a Bloom outright in one hit when Vitality <= SEVERANCE.damage, regardless of full Endurance — and an ordinary hit of the SAME magnitude could never do this", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(rourke, "requiem_severance");
    chargeToFull(mission, rourke.instanceId);

    // bloom_gallcyst: Endurance 140, Vitality 20 (data/bloom.ts) — the exact
    // "Endurance wall" archetype GDD §8.2's own flavor text names Requiem as
    // the designed answer to.
    const gallcyst = createBloomUnit("bloom_gallcyst", { x: 7, y: 5 });
    mission.units.push(gallcyst);
    expect(gallcyst.endurance).toBe(140);
    expect(gallcyst.vitality).toBe(20);

    // Comparative control, same file, same magnitude hit, via the ORDINARY
    // damage path — proves the bypass is what makes the difference, not a
    // coincidence of the numbers chosen.
    const controlGallcyst = createBloomUnit("bloom_gallcyst", { x: 100, y: 100 }); // off the beam's line, never hit by requiemSeverance below
    applyBloomDamage(controlGallcyst, SEVERANCE.damage);
    expect(controlGallcyst.downed).toBe(false); // Endurance depleted by 80 -> 60, Vitality untouched — very much alive
    expect(controlGallcyst.endurance).toBe(60);
    expect(controlGallcyst.vitality).toBe(20);

    const result = mission.requiemSeverance(rourke.instanceId, { x: 9, y: 5 })!;
    expect(result.killedIds).toContain(gallcyst.instanceId);
    expect(gallcyst.downed).toBe(true);
    expect(gallcyst.collapsed).toBe(true);
    expect(gallcyst.vitality).toBe(0);
    expect(gallcyst.endurance).toBe(140); // untouched — bypassed entirely, exactly as SEVERANCE.vsBloom "collapse_check" specifies
  });

  it("a Bloom whose Vitality exceeds SEVERANCE.damage survives, Vitality reduced directly, Endurance still untouched", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(rourke, "requiem_severance");
    chargeToFull(mission, rourke.instanceId);

    // bloom_choir: Endurance 110, Vitality 85 (data/bloom.ts) — Vitality > 80.
    const choir = createBloomUnit("bloom_choir", { x: 7, y: 5 });
    mission.units.push(choir);
    expect(choir.vitality).toBe(85);

    mission.requiemSeverance(rourke.instanceId, { x: 9, y: 5 });
    expect(choir.downed).toBe(false);
    expect(choir.vitality).toBe(5); // 85 - 80
    expect(choir.endurance).toBe(110); // untouched
    expect(choir.currentHp).toBe(115); // endurance + vitality
  });
});

// =====================================================================
// Hits friend and foe alike, unconditionally — the core "no ally
// carve-out" property, proven against a PLAYER unit specifically.
// =====================================================================

describe("Mission.requiemSeverance — hits friend and foe alike, no exception", () => {
  it("damages the ORIGIN's own unit (self-hit), a second ally further down the line, AND a hostile, all in one fire — no side filter anywhere", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(rourke, "requiem_severance");
    chargeToFull(mission, rourke.instanceId);

    const bosk = pilot(mission, "pilot_bosk", { x: 7, y: 5 }); // a SECOND player unit, standing in the line
    const enemy = mover(mission, { x: 9, y: 5 }); // a hostile, also in the line

    const rourkeHpBefore = rourke.currentHp;
    const boskHpBefore = bosk.currentHp;
    const enemyHpBefore = enemy.currentHp;

    const result = mission.requiemSeverance(rourke.instanceId, { x: 12, y: 5 })!;

    expect(result.hitIds).toContain(rourke.instanceId); // the wielder's own square — GDD §8.2's "the origin unit is included"
    expect(result.hitIds).toContain(bosk.instanceId); // an ALLY, unconditionally — this is the property under test
    expect(result.hitIds).toContain(enemy.instanceId);

    expect(rourke.currentHp).toBe(rourkeHpBefore - SEVERANCE.damage);
    expect(bosk.currentHp).toBe(boskHpBefore - SEVERANCE.damage);
    expect(enemy.currentHp).toBe(enemyHpBefore - SEVERANCE.damage);

    expect(logsMatching(mission, "fires Gjallar").length).toBe(1);
  });

  it("a player unit standing OUTSIDE the line is untouched — this proves the hit-list is the LINE, not merely 'no side filter applied to everyone on the board'", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(rourke, "requiem_severance");
    chargeToFull(mission, rourke.instanceId);
    const iyari = pilot(mission, "pilot_iyari", { x: 5, y: 9 }); // off the +x line rourke is about to fire

    const result = mission.requiemSeverance(rourke.instanceId, { x: 8, y: 5 })!;
    expect(result.hitIds).not.toContain(iyari.instanceId);
    expect(iyari.currentHp).toBe(iyari.maxHp);
  });
});

// =====================================================================
// Once-per-recharge gating — can't be spammed
// =====================================================================

describe("Mission.requiemSeverance — charge-meter gating (can't be spammed)", () => {
  it("canRequiemSeverance is false below SEVERANCE.maxCharge, even with a wielder present and an action free", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(rourke, "requiem_severance");
    expect(mission.getRequiemCharge()).toBe(0);
    expect(mission.canRequiemSeverance(rourke.instanceId)).toBe(false);
  });

  it("becomes true once the meter reaches SEVERANCE.maxCharge, and firing resets it to 0 — a second fire is refused until it recharges", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(rourke, "requiem_severance");
    chargeToFull(mission, rourke.instanceId);

    expect(mission.getRequiemCharge()).toBe(SEVERANCE.maxCharge);
    expect(mission.canRequiemSeverance(rourke.instanceId)).toBe(true);

    expect(mission.requiemSeverance(rourke.instanceId, { x: 8, y: 5 })).not.toBeNull();

    expect(mission.getRequiemCharge()).toBe(0);
    expect(mission.canRequiemSeverance(rourke.instanceId)).toBe(false); // can't be spammed — must recharge before firing again
    expect(mission.requiemSeverance(rourke.instanceId, { x: 8, y: 5 })).toBeNull(); // a second call while empty is a flat refusal, not a second (weaker) fire
  });

  it("the charge meter clamps at SEVERANCE.maxCharge rather than overflowing past it on one huge hit", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(rourke, "requiem_severance");
    chargeToFull(mission, rourke.instanceId); // this one hit alone is engineered to be far larger than 1000 raw damage
    expect(mission.getRequiemCharge()).toBe(SEVERANCE.maxCharge);
    expect(mission.getRequiemCharge()).not.toBeGreaterThan(SEVERANCE.maxCharge);
  });

  it("accrues charge from damage TAKEN by the player side too, not just damage dealt", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(rourke, "requiem_severance");
    const enemy = mover(mission, { x: 6, y: 5 });
    enemy.effectiveAttack = 100000;
    enemy.canCounter = false;
    rourke.currentHp = rourke.maxHp - 1; // not full HP, so the cap doesn't blunt the incoming hit
    expect(mission.getRequiemCharge()).toBe(0);
    mission.attack(enemy.instanceId, rourke.instanceId); // hostile attacks the player — "damage taken" side of the meter
    expect(mission.getRequiemCharge()).toBeGreaterThan(0);
  });

  it("canRequiemSeverance is false when nobody on the field carries requiem_severance, even at full charge", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    // No grant() call — Gjallar isn't fielded this mission.
    const enemy = mover(mission, { x: 6, y: 5 }, { hp: 100000 });
    rourke.effectiveAttack = 100000;
    enemy.currentHp = enemy.maxHp - 1;
    mission.attack(rourke.instanceId, enemy.instanceId);
    expect(mission.getRequiemCharge()).toBe(SEVERANCE.maxCharge);
    expect(mission.canRequiemSeverance(rourke.instanceId)).toBe(false);
  });

  it("canRequiemSeverance is false for a downed unit, a hostile unit, or a unit with no actions left, even at full charge", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(rourke, "requiem_severance");
    chargeToFull(mission, rourke.instanceId);

    const bosk = pilot(mission, "pilot_bosk", { x: 1, y: 0 });
    grant(bosk, "requiem_severance");
    bosk.downed = true;
    expect(mission.canRequiemSeverance(bosk.instanceId)).toBe(false);

    const keeper = mission.units.find((u) => u.instanceId.startsWith("hostile_mech_01"))!;
    keeper.downed = false; // undo quietMission's own blanket "downed:true" so this checks the real `unit.side !== "player"` gate, not just the downed one
    expect(mission.canRequiemSeverance(keeper.instanceId)).toBe(false);

    rourke.actionsRemaining = 0;
    expect(mission.canRequiemSeverance(rourke.instanceId)).toBe(false);
  });
});

// =====================================================================
// Interaction with existing on-hit-effect/stun/status systems
// =====================================================================

describe("Mission.requiemSeverance — interaction with existing status/on-hit systems", () => {
  it("respects an active Oathkeeper floor on a caught unit — floored, not deleted, excess deferred (routes through the same applyMechDamage choke point every other damage source uses)", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(rourke, "requiem_severance");
    chargeToFull(mission, rourke.instanceId);

    const bosk = pilot(mission, "pilot_bosk", { x: 7, y: 5 });
    bosk.oathkeeperActive = true;
    bosk.currentHp = 50;

    mission.requiemSeverance(rourke.instanceId, { x: 9, y: 5 });

    expect(bosk.downed).toBe(false); // never downs a unit under an active Oathkeeper window, by design
    expect(bosk.currentHp).toBe(OATHKEEPER_HP_FLOOR);
    // Floored at 50 -> 1 (49 actually lost), so the SPARED portion of the
    // fixed 80 is 80 - 49 = 31 — applyMechDamage's own arithmetic, not a
    // Requiem-specific calculation, which is exactly the point of this test.
    expect(bosk.oathkeeperDeferredDamage).toBe(SEVERANCE.damage - (50 - OATHKEEPER_HP_FLOOR));
  });

  it("an active shield absorbs part of the fixed damage first, same as any other hit", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(rourke, "requiem_severance");
    chargeToFull(mission, rourke.instanceId);

    const bosk = pilot(mission, "pilot_bosk", { x: 7, y: 5 });
    bosk.shield = 30;
    const hpBefore = bosk.currentHp;

    mission.requiemSeverance(rourke.instanceId, { x: 9, y: 5 });

    expect(bosk.shield).toBe(0);
    expect(bosk.currentHp).toBe(hpBefore - (SEVERANCE.damage - 30));
  });

  it("does NOT trigger a mech's weapon-branch on-hit effect (Shock Claws' stun) against a Bloom caught in the line — a known, honest gap: those effects are wired inside resolveAttack's own branches, which requiemSeverance never calls", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(rourke, "requiem_severance");
    rourke.weaponBranchId = "meeps_shock_claws"; // would normally have a chance to stun a Bloom it hits, via resolveAttack's own mech-on-hit-effect branch
    chargeToFull(mission, rourke.instanceId);

    const gallcyst = createBloomUnit("bloom_gallcyst", { x: 7, y: 5 });
    mission.units.push(gallcyst);

    mission.requiemSeverance(rourke.instanceId, { x: 9, y: 5 });

    expect(gallcyst.downed).toBe(true); // still dies outright (Vitality 20 <= 80)
    expect((gallcyst.statusEffects ?? []).some((e) => e.kind === "stun")).toBe(false); // but never went through the on-hit-effect path at all
  });
});
