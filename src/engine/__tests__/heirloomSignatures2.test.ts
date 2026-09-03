// Vault Phase 2, slice 2 (3 Sep 2026) — the next 3 Heirloom SIGNATURE
// abilities wired into combat: ledger_entry, oath_oathkeeper,
// deadfall_strike. See data/heirlooms.ts's own "VAULT PHASE 2, SLICE 2"
// header and claude/Bloom_Wars_Build_Log_Addendum_VaultPhase2Slice2_03Sep2026.md
// for the full account. Sibling file to heirloomVaultAbilities.test.ts (slice
// 1's five abilities) — kept separate rather than appended so neither file
// grows unwieldy; same house test style throughout (see that file's own
// header for the quietMission()/pilot()/mover()/grant() convention this one
// reuses verbatim).
//
// One honestly-reported design call worth flagging up front, not just in
// the ability's own doc comment: deadfall_strike's "reveal" clause has no
// general "make more visible than normal" mechanic to hook — this codebase's
// only hidden-player-unit concepts are concealed/stealthTurnsRemaining
// (Meeps abil_ambush / Munti abil_screen). The reveal tests below pin the
// closest honest equivalent (rank 1 mirrors resolveAttack's own unconditional
// decloak-on-fire; rank 5 deliberately skips it), not a "broadcast to every
// hostile AI" system — decideHostileAction's own targeting is untouched by
// this ability either way, which is exactly what these tests assert.
import { describe, it, expect, vi } from "vitest";
import { Mission } from "../mission";
import { AMARANTH_MISSION_1 } from "../../data/campaignAmaranth";
import { createHostileMechUnit, createBloomUnit, type BattleUnit } from "../units";
import {
  MAX_ACTIONS_PER_TURN,
  LEDGER_ENTRY_DAMAGE_PER_STACK,
  LEDGER_ENTRY_STACK_CAP,
  LEDGER_ENTRY_RANK5_STACK_CAP,
  LEDGER_ENTRY_MOVE_BONUS_AMOUNT,
  OATHKEEPER_HP_FLOOR,
  OATHKEEPER_DURATION_TURNS,
  OATHKEEPER_RANK5_DURATION_TURNS,
  OATHKEEPER_RANK5_DEFERRED_MULTIPLIER,
  OATHKEEPER_COOLDOWN_TURNS,
  DEADFALL_STRIKE_DAMAGE_MULTIPLIER,
  DEADFALL_STRIKE_COOLDOWN_TURNS,
} from "../../data/combatTables";
import { resolveMechAttack, ledgerEntryMultiplier, applyMechDamage } from "../combat";
import { makeUniformMap, testUnit } from "./testHelpers";

// Mirrors heirloomVaultAbilities.test.ts's own quietMission()/pilot()/
// mover()/grant()/logsMatching() exactly — see that file's header for why:
// every wave-spawned hostile downed, the real roster parked in the far
// corner, one blind/immobile keeper so eliminate_all doesn't resolve into a
// win from under a test's feet.
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

function mover(mission: Mission, pos: { x: number; y: number }, opts?: { moveRange?: number; vision?: number; hp?: number }): BattleUnit {
  const h = createHostileMechUnit("hostile_mech_01", { ...pos });
  h.moveRange = opts?.moveRange ?? 1;
  h.vision = opts?.vision ?? 6;
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

const logsMatching = (mission: Mission, needle: string) => mission.log.filter((l) => l.includes(needle));

// =====================================================================
// ledger_entry (Skuld/Widow's Ledger) — pure-function multiplier
// =====================================================================

describe("engine/combat.ts — ledgerEntryMultiplier (ledger_entry — Skuld/Widow's Ledger)", () => {
  it("is 1 (no-op) for a unit without the ability, regardless of kill count", () => {
    const u = testUnit("meeps", { x: 0, y: 0 });
    expect(ledgerEntryMultiplier(u, 5)).toBe(1);
  });

  it("stacks +LEDGER_ENTRY_DAMAGE_PER_STACK per kill, clamped at LEDGER_ENTRY_STACK_CAP at rank 1-4", () => {
    const u = testUnit("meeps", { x: 0, y: 0 });
    u.abilities = ["ledger_entry"];
    expect(ledgerEntryMultiplier(u, 0)).toBe(1);
    expect(ledgerEntryMultiplier(u, 1)).toBeCloseTo(1 + LEDGER_ENTRY_DAMAGE_PER_STACK, 10);
    expect(ledgerEntryMultiplier(u, LEDGER_ENTRY_STACK_CAP)).toBeCloseTo(1 + LEDGER_ENTRY_DAMAGE_PER_STACK * LEDGER_ENTRY_STACK_CAP, 10);
    // Past the cap: clamps, does not keep climbing.
    expect(ledgerEntryMultiplier(u, LEDGER_ENTRY_STACK_CAP + 10)).toBeCloseTo(1 + LEDGER_ENTRY_DAMAGE_PER_STACK * LEDGER_ENTRY_STACK_CAP, 10);
  });

  it("rank 5 raises the cap to LEDGER_ENTRY_RANK5_STACK_CAP", () => {
    const u = testUnit("meeps", { x: 0, y: 0 });
    u.abilities = ["ledger_entry"];
    u.heirloomAbilityRanks = { ledger_entry: 5 };
    expect(ledgerEntryMultiplier(u, LEDGER_ENTRY_RANK5_STACK_CAP)).toBeCloseTo(1 + LEDGER_ENTRY_DAMAGE_PER_STACK * LEDGER_ENTRY_RANK5_STACK_CAP, 10);
    expect(ledgerEntryMultiplier(u, LEDGER_ENTRY_RANK5_STACK_CAP + 5)).toBeCloseTo(1 + LEDGER_ENTRY_DAMAGE_PER_STACK * LEDGER_ENTRY_RANK5_STACK_CAP, 10);
    expect(LEDGER_ENTRY_RANK5_STACK_CAP).toBeGreaterThan(LEDGER_ENTRY_STACK_CAP);
  });

  it("clamps a negative kill count to 0 stacks rather than going negative", () => {
    const u = testUnit("meeps", { x: 0, y: 0 });
    u.abilities = ["ledger_entry"];
    expect(ledgerEntryMultiplier(u, -3)).toBe(1);
  });

  it("INTEGRATION: resolveMechAttack deals more with kills banked than with none, same matchup otherwise", () => {
    const map = makeUniformMap("road");
    const defender = testUnit("tank", { x: 1, y: 0 });
    const plain = testUnit("meeps", { x: 0, y: 0 });
    plain.abilities = ["ledger_entry"];
    const withKills = testUnit("meeps", { x: 0, y: 0 });
    withKills.abilities = ["ledger_entry"];

    const dmgPlain = resolveMechAttack(map, plain, defender, [defender], [plain], false, false, false, { attackerKillsThisMission: 0 }).damage;
    const dmgBoosted = resolveMechAttack(map, withKills, defender, [defender], [withKills], false, false, false, {
      attackerKillsThisMission: 3,
    }).damage;
    expect(dmgBoosted).toBeGreaterThan(dmgPlain);
  });

  it("INTEGRATION: a counter-swing reads the DEFENDER's own kill count, not the attacker's", () => {
    const map = makeUniformMap("road");
    const attacker = testUnit("tank", { x: 0, y: 0 }); // tank can't counter itself, but its swing IS counterable
    const counterer = testUnit("meeps", { x: 1, y: 0 }); // meeps canCounter=true per testUnit, counterMaxRange 1
    counterer.abilities = ["ledger_entry"];

    const rPlain = resolveMechAttack(map, attacker, counterer, [counterer], [attacker], false, false, false, { defenderKillsThisMission: 0 });
    const rBoosted = resolveMechAttack(map, attacker, counterer, [counterer], [attacker], false, false, false, { defenderKillsThisMission: 3 });
    expect(rPlain.countered).toBe(true);
    expect(rBoosted.countered).toBe(true);
    expect(rBoosted.counterDamage!).toBeGreaterThan(rPlain.counterDamage!);
  });
});

// =====================================================================
// ledger_entry — Mission-level wiring: real unitPerformance.kills driving
// the multiplier, and the rank-5 move-range bonus.
// =====================================================================

describe("Mission: ledger_entry reads real unitPerformance.kills, not a separate counter", () => {
  it("kills scored via mission.attack() increase a later attack's damage against the SAME matchup", () => {
    const mission = quietMission();
    const wielder = pilot(mission, "pilot_bosk", { x: 5, y: 5 });
    grant(wielder, "ledger_entry", 1);

    const target = mover(mission, { x: 6, y: 5 }, { hp: 999999 });
    target.canCounter = false; // isolate the wielder's own outgoing damage from any counter-driven HP loss between hits

    const before = mission.attack(wielder.instanceId, target.instanceId)!;
    expect(before.damage).toBeGreaterThan(0);
    wielder.actionsRemaining = MAX_ACTIONS_PER_TURN; // isolate from the action economy — same idiom heirloomVaultAbilities.test.ts uses throughout

    // Bank 3 kills against throwaway 1-HP targets, all adjacent to the wielder.
    for (const spot of [
      { x: 4, y: 5 },
      { x: 5, y: 4 },
      { x: 5, y: 6 },
    ]) {
      const weak = mover(mission, spot, { hp: 1 });
      const outcome = mission.attack(wielder.instanceId, weak.instanceId)!;
      expect(outcome.defenderDowned).toBe(true);
      wielder.actionsRemaining = MAX_ACTIONS_PER_TURN;
    }
    expect(mission.unitPerformance["pilot_bosk"].kills).toBe(3);

    // Same target, reset to full HP so FULL_HP_DAMAGE_CAP is the same
    // variable it was on the "before" hit — only the kill count differs.
    target.currentHp = target.maxHp;
    const after = mission.attack(wielder.instanceId, target.instanceId)!;
    expect(after.damage).toBeGreaterThan(before.damage);
  });

  it("rank 1-4: no move-range bonus regardless of kill count", () => {
    const mission = quietMission();
    const wielder = pilot(mission, "pilot_bosk", { x: 5, y: 5 });
    grant(wielder, "ledger_entry", 1);
    const baseMoveRange = wielder.moveRange;

    for (const spot of [
      { x: 4, y: 5 },
      { x: 5, y: 4 },
      { x: 5, y: 6 },
      { x: 6, y: 5 },
    ]) {
      const weak = mover(mission, spot, { hp: 1 });
      mission.attack(wielder.instanceId, weak.instanceId);
      wielder.actionsRemaining = MAX_ACTIONS_PER_TURN;
    }
    expect(mission.unitPerformance["pilot_bosk"].kills).toBe(4);
    expect(wielder.moveRange).toBe(baseMoveRange);
  });

  it("rank 5: the move-range bonus fires exactly once, the instant kills cross the threshold, and never again on a later kill", () => {
    const mission = quietMission();
    const wielder = pilot(mission, "pilot_bosk", { x: 5, y: 5 });
    grant(wielder, "ledger_entry", 5);
    const baseMoveRange = wielder.moveRange;

    const spots = [
      { x: 4, y: 5 },
      { x: 5, y: 4 },
      { x: 5, y: 6 },
      { x: 6, y: 5 },
      { x: 4, y: 4 },
    ];
    for (let i = 0; i < spots.length; i++) {
      const weak = mover(mission, spots[i], { hp: 1 });
      mission.attack(wielder.instanceId, weak.instanceId);
      wielder.actionsRemaining = MAX_ACTIONS_PER_TURN;
      if (i < 3) {
        expect(wielder.moveRange).toBe(baseMoveRange); // kills 1-3: at/under the threshold — no bonus yet
      } else {
        expect(wielder.moveRange).toBe(baseMoveRange + LEDGER_ENTRY_MOVE_BONUS_AMOUNT); // kill 4 and kill 5 alike — applied once, never stacks
      }
    }
    expect(wielder.ledgerEntryMoveBonusApplied).toBe(true);
    expect(logsMatching(mission, "ledger turns to move").length).toBe(1);
  });
});

// =====================================================================
// oath_oathkeeper (Vindex/The Iron Oath) — activation, refusals, cooldown
// =====================================================================

describe("Mission.oathkeeper (oath_oathkeeper — Vindex/The Iron Oath)", () => {
  it("activation: sets the posture and rank-1 duration, costs 1 action, does NOT end the turn, and logs it", () => {
    const mission = quietMission();
    const bosk = pilot(mission, "pilot_bosk", { x: 9, y: 1 });
    grant(bosk, "oath_oathkeeper", 1);

    expect(mission.canOathkeeper(bosk.instanceId)).toBe(true);
    expect(mission.oathkeeper(bosk.instanceId)).toBe(true);

    expect(bosk.oathkeeperActive).toBe(true);
    expect(bosk.oathkeeperTurnsLeft).toBe(OATHKEEPER_DURATION_TURNS);
    expect(bosk.oathkeeperDeferredDamage).toBe(0);
    expect(bosk.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN - 1);
    expect(logsMatching(mission, "swears the Iron Oath").length).toBe(1);
  });

  it("rank 5: duration is OATHKEEPER_RANK5_DURATION_TURNS instead, and it's strictly longer than the rank 1-4 duration", () => {
    const mission = quietMission();
    const bosk = pilot(mission, "pilot_bosk", { x: 9, y: 1 });
    grant(bosk, "oath_oathkeeper", 5);
    mission.oathkeeper(bosk.instanceId);
    expect(bosk.oathkeeperTurnsLeft).toBe(OATHKEEPER_RANK5_DURATION_TURNS);
    expect(OATHKEEPER_RANK5_DURATION_TURNS).toBeGreaterThan(OATHKEEPER_DURATION_TURNS);
  });

  it("cannot be re-armed while already active", () => {
    const mission = quietMission();
    const bosk = pilot(mission, "pilot_bosk", { x: 9, y: 1 });
    grant(bosk, "oath_oathkeeper");
    mission.oathkeeper(bosk.instanceId);
    bosk.actionsRemaining = MAX_ACTIONS_PER_TURN; // isolate from the action economy
    expect(mission.canOathkeeper(bosk.instanceId)).toBe(false);
  });

  it("refuses a unit without the ability, an unknown id, a downed unit, a spent unit, and any hostile", () => {
    const mission = quietMission();
    const iyari = pilot(mission, "pilot_iyari", { x: 9, y: 1 });
    expect(iyari.abilities).not.toContain("oath_oathkeeper");
    expect(mission.canOathkeeper(iyari.instanceId)).toBe(false);
    expect(mission.oathkeeper(iyari.instanceId)).toBe(false);

    expect(mission.oathkeeper("no_such_unit")).toBe(false);

    const hostile = mover(mission, { x: 15, y: 8 });
    grant(hostile, "oath_oathkeeper");
    expect(mission.canOathkeeper(hostile.instanceId)).toBe(false);
    expect(mission.oathkeeper(hostile.instanceId)).toBe(false);

    const bosk = pilot(mission, "pilot_bosk", { x: 12, y: 1 });
    grant(bosk, "oath_oathkeeper");
    bosk.actionsRemaining = 0;
    expect(mission.canOathkeeper(bosk.instanceId)).toBe(false);
    bosk.actionsRemaining = MAX_ACTIONS_PER_TURN;
    bosk.downed = true;
    expect(mission.canOathkeeper(bosk.instanceId)).toBe(false);
  });

  it("is gated by OATHKEEPER_COOLDOWN_TURNS — refused right after use, ready exactly on schedule", () => {
    const mission = quietMission();
    const bosk = pilot(mission, "pilot_bosk", { x: 9, y: 1 });
    grant(bosk, "oath_oathkeeper");
    mission.oathkeeper(bosk.instanceId);
    const readyAtTurn = mission.turn + OATHKEEPER_COOLDOWN_TURNS;

    bosk.oathkeeperActive = false; // isolate the cooldown check from the re-entry guard
    bosk.actionsRemaining = MAX_ACTIONS_PER_TURN;
    mission.turn = readyAtTurn - 1;
    expect(mission.canOathkeeper(bosk.instanceId)).toBe(false);
    mission.turn = readyAtTurn;
    expect(mission.canOathkeeper(bosk.instanceId)).toBe(true);
  });
});

// =====================================================================
// engine/combat.ts — applyMechDamage's Oathkeeper HP floor (pure function)
// =====================================================================

describe("engine/combat.ts — applyMechDamage (oath_oathkeeper's HP floor)", () => {
  it("floors currentHp at OATHKEEPER_HP_FLOOR instead of downing the unit, and banks the spared portion", () => {
    const u = testUnit("tank", { x: 0, y: 0 }, { hp: 10, maxHp: 10 });
    u.oathkeeperActive = true;
    applyMechDamage(u, 15);
    expect(u.currentHp).toBe(OATHKEEPER_HP_FLOOR);
    expect(u.oathkeeperDeferredDamage).toBe(15 - (10 - OATHKEEPER_HP_FLOOR)); // spared = dmg - actual HP loss
    expect(u.downed).toBe(false);
  });

  it("accumulates deferred damage across multiple hits while active", () => {
    const u = testUnit("tank", { x: 0, y: 0 }, { hp: 10, maxHp: 10 });
    u.oathkeeperActive = true;
    applyMechDamage(u, 15); // hp -> floor, 6 spared
    applyMechDamage(u, 20); // already at the floor — the entire 20 is spared
    expect(u.currentHp).toBe(OATHKEEPER_HP_FLOOR);
    expect(u.oathkeeperDeferredDamage).toBe(6 + 20);
    expect(u.downed).toBe(false);
  });

  it("a hit that doesn't reach the floor deals its damage normally and defers nothing", () => {
    const u = testUnit("tank", { x: 0, y: 0 }, { hp: 10, maxHp: 10 });
    u.oathkeeperActive = true;
    applyMechDamage(u, 3);
    expect(u.currentHp).toBe(7);
    expect(u.oathkeeperDeferredDamage ?? 0).toBe(0);
  });

  it("shield absorption still happens BEFORE the floor check", () => {
    const u = testUnit("tank", { x: 0, y: 0 }, { hp: 10, maxHp: 10 });
    u.oathkeeperActive = true;
    u.shield = 5;
    applyMechDamage(u, 8); // 5 absorbed by shield, 3 reaches HP — never touches the floor
    expect(u.shield).toBe(0);
    expect(u.currentHp).toBe(7);
    expect(u.oathkeeperDeferredDamage ?? 0).toBe(0);
  });

  it("inactive (no oathkeeperActive): behaves like a plain hit, can down the unit normally", () => {
    const u = testUnit("tank", { x: 0, y: 0 }, { hp: 5, maxHp: 10 });
    applyMechDamage(u, 15);
    expect(u.currentHp).toBe(0);
    expect(u.downed).toBe(true);
  });
});

// =====================================================================
// Mission: oath_oathkeeper duration expiry and deferred-damage landing —
// the "all spared damage lands the instant it ends" clause.
// =====================================================================

describe("Mission: oath_oathkeeper duration expiry and deferred-damage landing", () => {
  // pilot_iyari (Meeps/centauroid), not pilot_bosk, for these three: bosk is
  // Tank-path, and Tank shield regen (TANK_SHIELD_CAPACITY house rule,
  // engine/mission.ts's own environmentStep) legitimately refills between
  // endPlayerTurn() calls and would absorb the deferred landing hit outright
  // — a REAL interaction (a Tank wielder's own shield can eat its own Iron
  // Oath bill), just not what these tests are isolating. Found by tracing a
  // failing "landed damage" assertion down to a nonzero unit.shield at the
  // landing call, not by inspection.
  it("rank 1: the posture survives OATHKEEPER_DURATION_TURNS hostile phases, then clears; deferred damage that doesn't reach 0 lands normally", () => {
    const mission = quietMission();
    const iyari = pilot(mission, "pilot_iyari", { x: 9, y: 1 });
    grant(iyari, "oath_oathkeeper", 1);
    mission.oathkeeper(iyari.instanceId);
    iyari.maxHp = 100;
    iyari.currentHp = 10;
    applyMechDamage(iyari, 15); // floors at OATHKEEPER_HP_FLOOR(1), banks 6 deferred
    expect(iyari.currentHp).toBe(OATHKEEPER_HP_FLOOR);
    expect(iyari.oathkeeperDeferredDamage).toBe(6);

    // Simulates the wielder recovering HP mid-window (a Munti field triage,
    // say) — orthogonal to what THIS test isolates, which is only whether a
    // landing hit that doesn't reach 0 downs correctly. The "still at the
    // floor when it lands" case is covered separately below.
    iyari.currentHp = 50;

    // OATHKEEPER_DURATION_TURNS(2) hostile phases of exposure before it
    // clears — same "N calls for an N-turn duration" shape as
    // ledger_overextended's own rank-5 duration test.
    for (let i = 0; i < OATHKEEPER_DURATION_TURNS - 1; i++) {
      mission.endPlayerTurn();
      expect(iyari.oathkeeperActive).toBe(true); // still active before the final tick
    }
    mission.endPlayerTurn();
    expect(mission.turn).toBe(OATHKEEPER_DURATION_TURNS + 1);
    expect(iyari.oathkeeperActive).toBe(false);
    expect(iyari.oathkeeperTurnsLeft).toBeUndefined();
    expect(iyari.oathkeeperDeferredDamage).toBe(0);
    expect(iyari.currentHp).toBe(50 - 6);
    expect(iyari.downed).toBe(false);
    expect(logsMatching(mission, "Iron Oath ends").length).toBe(1);
  });

  it("rank 1: deferred damage that lands while the wielder is still at the floor downs them through the real handleDowned path", () => {
    const mission = quietMission();
    const iyari = pilot(mission, "pilot_iyari", { x: 9, y: 1 });
    grant(iyari, "oath_oathkeeper", 1);
    mission.oathkeeper(iyari.instanceId);
    iyari.currentHp = 10;
    applyMechDamage(iyari, 15); // floors at 1, banks 6
    expect(iyari.currentHp).toBe(OATHKEEPER_HP_FLOOR);

    for (let i = 0; i < OATHKEEPER_DURATION_TURNS; i++) mission.endPlayerTurn();
    expect(mission.turn).toBe(OATHKEEPER_DURATION_TURNS + 1);
    expect(iyari.currentHp).toBe(0);
    expect(iyari.downed).toBe(true);
    expect(logsMatching(mission, `${iyari.displayName} is downed.`).length).toBe(1); // handleDowned's own log line — proves the REAL path ran
    expect(mission.outcome).not.toBe("commander_down"); // iyari isn't the exempt pilot — an ordinary downing, not a mission-ending one
  });

  it("rank 5: the deferred pool is halved (OATHKEEPER_RANK5_DEFERRED_MULTIPLIER) when it lands, instead of full", () => {
    const mission = quietMission();
    const iyari = pilot(mission, "pilot_iyari", { x: 9, y: 1 });
    grant(iyari, "oath_oathkeeper", 5);
    mission.oathkeeper(iyari.instanceId);
    expect(iyari.oathkeeperTurnsLeft).toBe(OATHKEEPER_RANK5_DURATION_TURNS);
    iyari.maxHp = 100;
    iyari.currentHp = 10;
    applyMechDamage(iyari, 15); // floors at 1, banks 6
    iyari.currentHp = 50; // same mid-window-recovery isolation as the rank-1 "doesn't down" case above

    for (let i = 0; i < OATHKEEPER_RANK5_DURATION_TURNS; i++) mission.endPlayerTurn();

    expect(iyari.oathkeeperActive).toBe(false);
    const halved = Math.round(6 * OATHKEEPER_RANK5_DEFERRED_MULTIPLIER);
    expect(iyari.currentHp).toBe(50 - halved);
    expect(halved).toBeLessThan(6); // pins that the halving actually did something, not a no-op
  });
});

// =====================================================================
// deadfall_strike (Ichigeki/Deadfall) — any range, unavoidable, uncounterable
// =====================================================================

describe("Mission.deadfallStrike (deadfall_strike — Ichigeki/Deadfall)", () => {
  it("deals exactly DEADFALL_STRIKE_DAMAGE_MULTIPLIER times the base resolver's computed damage for the identical matchup", () => {
    const mission = quietMission();
    const wielder = pilot(mission, "pilot_bosk", { x: 5, y: 5 });
    grant(wielder, "deadfall_strike", 1);
    const target = mover(mission, { x: 5, y: 7 }, { hp: 999999 });

    const sameSideAsDefender = mission.units.filter((u) => u.side === target.side);
    const sameSideAsAttacker = mission.units.filter((u) => u.side === wielder.side);
    const base = resolveMechAttack(mission.map, wielder, target, sameSideAsDefender, sameSideAsAttacker, false, false, false, {
      attackerKillsThisMission: 0,
      noCounter: true,
    }).damage;
    const expected = Math.round(base * DEADFALL_STRIKE_DAMAGE_MULTIPLIER);

    const outcome = mission.deadfallStrike(wielder.instanceId, target.instanceId);
    expect(outcome).not.toBeNull();
    expect(outcome!.damage).toBe(expected);
    expect(outcome!.damage).toBeGreaterThan(base); // the doubling is real, not a no-op on this matchup
  });

  it("any-range bypass: succeeds against a target far outside the wielder's own attackRange, as long as the player side can see it — mission.attack() refuses the same matchup by range alone", () => {
    const mission = quietMission();
    const wielder = pilot(mission, "pilot_bosk", { x: 0, y: 0 }); // tank path, attackRange [1,1]
    grant(wielder, "deadfall_strike", 1);
    // A separate player unit sitting near the target grants side-wide
    // visibility (unitsVisibleToSide, engine/ai.ts) — deadfall_strike's own
    // visibility gate is on the SIDE, not the wielder's own vision/range.
    pilot(mission, "pilot_iyari", { x: 9, y: 9 });
    const target = mover(mission, { x: 10, y: 9 }, { hp: 999 });

    expect(mission.attack(wielder.instanceId, target.instanceId)).toBeNull(); // sanity: an ordinary attack at this range is refused outright

    expect(mission.canDeadfallStrike(wielder.instanceId)).toBe(true);
    expect(mission.getDeadfallStrikeTargetsFrom(wielder.instanceId).map((u) => u.instanceId)).toContain(target.instanceId);
    const outcome = mission.deadfallStrike(wielder.instanceId, target.instanceId);
    expect(outcome).not.toBeNull();
    expect(outcome!.damage).toBeGreaterThan(0);
    expect(outcome!.defenderId).toBe(target.instanceId);
  });

  it("is uncounterable even against an adjacent target with canCounter=true — a normal attack at the same position WOULD be countered", () => {
    const mission = quietMission();
    const wielder = pilot(mission, "pilot_bosk", { x: 5, y: 5 }); // tank path, attackRange [1,1] — adjacent is a legal normal-attack range too
    const target = mover(mission, { x: 6, y: 5 }, { hp: 999 }); // hostile_mech_01, tank path, canCounter=true, counterMaxRange 1
    expect(target.canCounter).toBe(true);

    const sameSideAsDefender = mission.units.filter((u) => u.side === target.side);
    const sameSideAsAttacker = mission.units.filter((u) => u.side === wielder.side);
    const normalResult = resolveMechAttack(mission.map, wielder, target, sameSideAsDefender, sameSideAsAttacker, false);
    expect(normalResult.countered).toBe(true); // sanity: this matchup DOES draw a counter through the ordinary resolver

    grant(wielder, "deadfall_strike", 1);
    const outcome = mission.deadfallStrike(wielder.instanceId, target.instanceId);
    expect(outcome).not.toBeNull();
    expect(outcome!.countered).toBe(false);
  });

  it("is unavoidable — a forced low Math.random() roll that WOULD dodge a normal attack from a non-Tank source does not dodge here", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.01); // well under MEEPS_DODGE_CHANCE — see dodge.test.ts's own convention
    try {
      const mission = quietMission();
      const wielder = pilot(mission, "pilot_iyari", { x: 5, y: 5 }); // Meeps-path (non-Tank source) — required, or rollMeepsDodge's own Tank-source carve-out would already make this a non-test
      grant(wielder, "deadfall_strike", 1);
      const meepsHostile = createHostileMechUnit("hostile_mech_02", { x: 6, y: 5 }); // Meeps-path hostile, Data Pack §9 — see dodge.test.ts
      meepsHostile.currentHp = 999;
      meepsHostile.maxHp = 999;
      mission.units.push(meepsHostile);

      // Sanity: the SAME forced roll dodges an ordinary attack between this exact pair.
      const sanity = mission.attack(wielder.instanceId, meepsHostile.instanceId);
      expect(sanity!.defenderDodged).toBe(true);
      expect(sanity!.damage).toBe(0);
      wielder.actionsRemaining = MAX_ACTIONS_PER_TURN; // isolate from the action economy — deadfall_strike needs its own action
      meepsHostile.currentHp = meepsHostile.maxHp; // undo the sanity check's (whiffed) call before the real one

      const outcome = mission.deadfallStrike(wielder.instanceId, meepsHostile.instanceId);
      expect(outcome).not.toBeNull();
      expect(outcome!.damage).toBeGreaterThan(0); // did NOT dodge, same forced roll and all
      expect(outcome!.defenderDowned).toBe(false); // survives at 999 hp
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("credits the kill correctly through the real recordPerformance path when it finishes a target", () => {
    const mission = quietMission();
    const wielder = pilot(mission, "pilot_bosk", { x: 5, y: 5 });
    grant(wielder, "deadfall_strike", 1);
    const target = mover(mission, { x: 6, y: 5 }, { hp: 1 });

    const outcome = mission.deadfallStrike(wielder.instanceId, target.instanceId);
    expect(outcome!.defenderDowned).toBe(true);
    expect(target.downed).toBe(true);
    expect(mission.unitPerformance["pilot_bosk"].kills).toBe(1);
    expect(mission.unitPerformance["pilot_bosk"].damageDealt).toBeGreaterThan(0);
  });

  it("works against a Bloom-shape defender too, through resolveAttackOnBloom / applyBloomDamage", () => {
    const mission = quietMission();
    const wielder = pilot(mission, "pilot_bosk", { x: 5, y: 5 });
    grant(wielder, "deadfall_strike", 1);
    const bloom = createBloomUnit("bloom_crawlmass", { x: 6, y: 5 });
    mission.units.push(bloom);
    const hpBefore = bloom.currentHp;

    const outcome = mission.deadfallStrike(wielder.instanceId, bloom.instanceId);
    expect(outcome).not.toBeNull();
    expect(outcome!.damage).toBeGreaterThan(0);
    expect(bloom.currentHp).toBeLessThan(hpBefore);
  });
});

describe("Mission.deadfallStrike — reveal mechanic (rank 1 vs rank 5)", () => {
  it("no-op when the wielder wasn't concealed to begin with", () => {
    const mission = quietMission();
    const wielder = pilot(mission, "pilot_bosk", { x: 5, y: 5 });
    grant(wielder, "deadfall_strike", 1);
    const target = mover(mission, { x: 6, y: 5 }, { hp: 999 });

    expect(wielder.concealed).toBeFalsy();
    mission.deadfallStrike(wielder.instanceId, target.instanceId);
    expect(wielder.concealed).toBeFalsy();
    expect(wielder.stealthTurnsRemaining).toBeUndefined();
  });

  it("rank 1: clears an ACTIVE ambush cloak the instant the strike lands, same as an ordinary attack", () => {
    const mission = quietMission();
    const wielder = pilot(mission, "pilot_bosk", { x: 5, y: 5 });
    grant(wielder, "deadfall_strike", 1);
    wielder.concealed = true;
    wielder.stealthTurnsRemaining = 3;
    const target = mover(mission, { x: 6, y: 5 }, { hp: 999 });

    mission.deadfallStrike(wielder.instanceId, target.instanceId);
    expect(wielder.concealed).toBe(false);
    expect(wielder.stealthTurnsRemaining).toBeUndefined();
  });

  it("rank 5: deliberately does NOT clear the cloak — an active ambush survives the strike, unlike rank 1", () => {
    const mission = quietMission();
    const wielder = pilot(mission, "pilot_bosk", { x: 5, y: 5 });
    grant(wielder, "deadfall_strike", 5);
    wielder.concealed = true;
    wielder.stealthTurnsRemaining = 3;
    const target = mover(mission, { x: 6, y: 5 }, { hp: 999 });

    mission.deadfallStrike(wielder.instanceId, target.instanceId);
    expect(wielder.concealed).toBe(true);
    expect(wielder.stealthTurnsRemaining).toBe(3); // untouched by this strike — clears through the ordinary stealth countdown instead
  });
});

describe("Mission.canDeadfallStrike / deadfallStrike — refusals and cooldown", () => {
  it("refuses a unit without the ability, an unknown id, a downed unit, a spent unit, and any hostile wielder", () => {
    const mission = quietMission();
    const iyari = pilot(mission, "pilot_iyari", { x: 5, y: 5 });
    expect(iyari.abilities).not.toContain("deadfall_strike");
    expect(mission.canDeadfallStrike(iyari.instanceId)).toBe(false);

    expect(mission.deadfallStrike("no_such_unit", "also_missing")).toBeNull();

    const hostileWielder = mover(mission, { x: 15, y: 8 });
    grant(hostileWielder, "deadfall_strike");
    expect(mission.canDeadfallStrike(hostileWielder.instanceId)).toBe(false);

    const bosk = pilot(mission, "pilot_bosk", { x: 5, y: 5 });
    grant(bosk, "deadfall_strike");
    bosk.actionsRemaining = 0;
    expect(mission.canDeadfallStrike(bosk.instanceId)).toBe(false);
    bosk.actionsRemaining = MAX_ACTIONS_PER_TURN;
    bosk.downed = true;
    expect(mission.canDeadfallStrike(bosk.instanceId)).toBe(false);
  });

  it("refuses a target that isn't visible to the player side, and reports an empty target list", () => {
    const mission = quietMission();
    const wielder = pilot(mission, "pilot_bosk", { x: 0, y: 0 });
    grant(wielder, "deadfall_strike", 1);
    const hiddenHostile = mover(mission, { x: 18, y: 10 }, { hp: 999 }); // far from every parked player unit

    expect(mission.getDeadfallStrikeTargetsFrom(wielder.instanceId)).toEqual([]);
    expect(mission.deadfallStrike(wielder.instanceId, hiddenHostile.instanceId)).toBeNull();
  });

  it("refuses a downed target and a non-hostile target id", () => {
    const mission = quietMission();
    const wielder = pilot(mission, "pilot_bosk", { x: 5, y: 5 });
    grant(wielder, "deadfall_strike", 1);
    const target = mover(mission, { x: 6, y: 5 }, { hp: 999 });
    target.downed = true;
    expect(mission.deadfallStrike(wielder.instanceId, target.instanceId)).toBeNull();

    const ally = pilot(mission, "pilot_iyari", { x: 6, y: 6 });
    expect(mission.deadfallStrike(wielder.instanceId, ally.instanceId)).toBeNull();
  });

  it("is gated by DEADFALL_STRIKE_COOLDOWN_TURNS — refused right after use, ready exactly on schedule", () => {
    const mission = quietMission();
    const wielder = pilot(mission, "pilot_bosk", { x: 5, y: 5 });
    grant(wielder, "deadfall_strike", 1);
    const target = mover(mission, { x: 6, y: 5 }, { hp: 999 });
    mission.deadfallStrike(wielder.instanceId, target.instanceId);
    const readyAtTurn = mission.turn + DEADFALL_STRIKE_COOLDOWN_TURNS;

    wielder.actionsRemaining = MAX_ACTIONS_PER_TURN;
    mission.turn = readyAtTurn - 1;
    expect(mission.canDeadfallStrike(wielder.instanceId)).toBe(false);
    mission.turn = readyAtTurn;
    expect(mission.canDeadfallStrike(wielder.instanceId)).toBe(true);
  });
});
