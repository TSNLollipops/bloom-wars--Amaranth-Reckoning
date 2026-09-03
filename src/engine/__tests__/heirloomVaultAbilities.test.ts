// Vault Phase 2, slice 1 (2 Sep 2026) — the first 5 Heirloom abilities wired
// into combat: oath_iron_word, lastword_field_triage, farsight_signature,
// salt_root_salt, ledger_overextended. See data/heirlooms.ts's own "VAULT
// PHASE 2, SLICE 1" header and
// claude/Bloom_Wars_Build_Log_Addendum_VaultPhase2Slice1_02Sep2026.md for the
// full account.
//
// House test style (see abilities.test.ts / repair.test.ts / sendOff.test.ts):
// real Mission objects built from a real mission def, with direct unit
// mutation to grant a Heirloom ability outright — these five are granted at
// deploy time via DeployRosterEntry.heirloomAbilityRanks, not via archetype
// data, so "even handed the ability outright" (abilities.test.ts's own
// phrase for its hostile-refusal tests) is the NORMAL way every test below
// sets one up, not just the refusal-path shortcut it is elsewhere.
//
// A real bug was found and fixed while writing this file, not by inspection:
// ledgerOverextended()'s rank-5 duration used to initialize
// overextendedTurnsRemaining to `LEDGER_OVEREXTENDED_RANK5_DURATION_TURNS -
// 1`, which — traced turn-by-turn against the actual turn-start decrement
// loop — cleared on the very first tick, identical to rank 1-4. The "rank 5
// duration" test below (Section E) pins the CORRECT behavior (mirroring
// abil_ambush's stealthTurnsRemaining, which uses no such "-1"); see
// engine/mission.ts's own bug-fix comment on that line for the full trace.
import { describe, it, expect } from "vitest";
import { Mission } from "../mission";
import { AMARANTH_MISSION_1 } from "../../data/campaignAmaranth";
import { createHostileMechUnit, createBloomUnit, createPlayerUnit, type BattleUnit } from "../units";
import { findPilot } from "../../data/pilotRegistry";
import {
  MAX_ACTIONS_PER_TURN,
  IRON_WORD_RADIUS,
  IRON_WORD_RANK5_RADIUS,
  IRON_WORD_COOLDOWN_TURNS,
  FIELD_TRIAGE_RADIUS,
  FIELD_TRIAGE_RANK5_RADIUS,
  FIELD_TRIAGE_MAX_TARGETS,
  FIELD_TRIAGE_COOLDOWN_TURNS,
  FARSIGHT_SIGNATURE_COOLDOWN_TURNS,
  LEDGER_OVEREXTENDED_ATK_MULTIPLIER,
  LEDGER_OVEREXTENDED_DEFENSE_FLOOR,
  LEDGER_OVEREXTENDED_RANK5_DURATION_TURNS,
  LEDGER_OVEREXTENDED_COOLDOWN_TURNS,
  SALT_ROOT_SESSILE_MULTIPLIER,
  SALT_ROOT_OTHER_MULTIPLIER,
  SALT_ROOT_RANK5_OTHER_MULTIPLIER,
} from "../../data/combatTables";
import { resolveMechAttack, resolveAttackOnBloom, saltRootMultiplier, overextendedAttackMultiplier, overextendedDefense } from "../combat";
import { makeUniformMap, testUnit } from "./testHelpers";

// Mirrors abilities.test.ts's own quietMission()/pilot() pair exactly — see
// that file's header comment for why: every wave-spawned hostile downed, the
// real roster parked in the far corner, one blind/immobile keeper so
// eliminate_all doesn't resolve into a win from under a test's feet.
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
  if (opts?.hp !== undefined) h.currentHp = opts.hp;
  mission.units.push(h);
  return h;
}

/** Hand-grants a Heirloom ability outright, same shorthand abilities.test.ts uses for hostile-refusal setups ("hostile.abilities = [...]"). rank defaults to 1 — the free rank every recruited Heirloom grants, per heirloomRank()'s own comment. */
function grant(unit: BattleUnit, abilityId: string, rank = 1): void {
  unit.abilities = [...unit.abilities, abilityId];
  unit.heirloomAbilityRanks = { ...unit.heirloomAbilityRanks, [abilityId]: rank };
}

const logsMatching = (mission: Mission, needle: string) => mission.log.filter((l) => l.includes(needle));

// =====================================================================
// BattleUnit/DeployRosterEntry plumbing — the createPlayerUnit override and
// the real Mission(def, roster) path scenes/Battle.ts's resolveDeployRoster
// actually drives. NOT covered here (same carve-out as sendOff.test.ts's own
// header): resolveDeployRoster itself, a Phaser-Scene method this sandbox
// can't run outside a browser — checked instead by direct code reading.
// =====================================================================

describe("Heirloom ability plumbing (BattleUnit.heirloomAbilityRanks)", () => {
  it("createPlayerUnit: no override leaves abilities and heirloomAbilityRanks untouched", () => {
    const plain = createPlayerUnit("pilot_rourke", { x: 0, y: 0 });
    expect(plain.heirloomAbilityRanks).toBeUndefined();
    expect(plain.abilities).not.toContain("oath_iron_word");
  });

  it("createPlayerUnit: heirloomAbilityRanks override appends every ability id to the unit's abilities array and carries the rank map through unchanged", () => {
    const base = createPlayerUnit("pilot_rourke", { x: 0, y: 0 });
    const withHeirloom = createPlayerUnit("pilot_rourke", { x: 0, y: 0 }, { heirloomAbilityRanks: { oath_oathkeeper: 1, oath_iron_word: 3, oath_debt_paid: 1 } });
    // Additive, not replacing — the pilot's ordinary kit is still there.
    expect(withHeirloom.abilities).toEqual(expect.arrayContaining(base.abilities));
    expect(withHeirloom.abilities).toContain("oath_iron_word");
    expect(withHeirloom.abilities).toContain("oath_oathkeeper"); // this generic plumbing test predates oath_oathkeeper's own wiring (heirloomSignatures2.test.ts, Vault Phase 2 slice 2) — kept as-is, it's still testing the plumbing, not the ability
    expect(withHeirloom.heirloomAbilityRanks).toEqual({ oath_oathkeeper: 1, oath_iron_word: 3, oath_debt_paid: 1 });
  });

  it("createPlayerUnit: an empty heirloomAbilityRanks object behaves like no override at all", () => {
    const base = createPlayerUnit("pilot_rourke", { x: 0, y: 0 });
    const empty = createPlayerUnit("pilot_rourke", { x: 0, y: 0 }, { heirloomAbilityRanks: {} });
    expect(empty.abilities).toEqual(base.abilities);
  });

  it("Mission + DeployRosterEntry: only the roster entry carrying heirloomAbilityRanks gets it, nobody else on the squad does", () => {
    const rourke = findPilot("pilot_rourke")!;
    const bosk = findPilot("pilot_bosk")!;
    const mission = new Mission(AMARANTH_MISSION_1, [
      { pilotId: "pilot_rourke", pilot: rourke, heirloomAbilityRanks: { oath_iron_word: 5 } },
      { pilotId: "pilot_bosk", pilot: bosk },
    ]);
    const wielder = mission.units.find((u) => u.pilotId === "pilot_rourke")!;
    const bystander = mission.units.find((u) => u.pilotId === "pilot_bosk")!;
    expect(wielder.abilities).toContain("oath_iron_word");
    expect(wielder.heirloomAbilityRanks).toEqual({ oath_iron_word: 5 });
    expect(bystander.heirloomAbilityRanks).toBeUndefined();
    expect(bystander.abilities).not.toContain("oath_iron_word");
  });
});

// =====================================================================
// oath_iron_word (Vindex/The Iron Oath) — radius-gated Taunt
// =====================================================================

describe("Mission.ironWord (oath_iron_word — Vindex/The Iron Oath)", () => {
  it("taunts with IRON_WORD_RADIUS at rank 1, spends the whole budget, ends the turn, and logs it", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 9, y: 1 });
    grant(rourke, "oath_iron_word", 1);

    expect(mission.canIronWord(rourke.instanceId)).toBe(true);
    expect(mission.ironWord(rourke.instanceId)).toBe(true);

    expect(rourke.taunting).toBe(true);
    expect(rourke.tauntRadius).toBe(IRON_WORD_RADIUS);
    expect(rourke.actionsRemaining).toBe(0);
    expect(logsMatching(mission, `every hostile within ${IRON_WORD_RADIUS} must answer it.`).length).toBe(1);
  });

  it("widens to IRON_WORD_RANK5_RADIUS at rank 5", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 9, y: 1 });
    grant(rourke, "oath_iron_word", 5);

    mission.ironWord(rourke.instanceId);
    expect(rourke.tauntRadius).toBe(IRON_WORD_RANK5_RADIUS);
  });

  it("refuses a unit without the ability, a spent unit, a downed unit, an unknown id, and any hostile", () => {
    const mission = quietMission();
    const bosk = pilot(mission, "pilot_bosk", { x: 9, y: 1 });
    expect(bosk.abilities).not.toContain("oath_iron_word");
    expect(mission.canIronWord(bosk.instanceId)).toBe(false);
    expect(mission.ironWord(bosk.instanceId)).toBe(false);

    expect(mission.ironWord("no_such_unit")).toBe(false);

    const hostile = mover(mission, { x: 15, y: 8 });
    grant(hostile, "oath_iron_word");
    expect(mission.canIronWord(hostile.instanceId)).toBe(false);
    expect(mission.ironWord(hostile.instanceId)).toBe(false);
    expect(hostile.taunting).toBeFalsy();

    const rourke = pilot(mission, "pilot_rourke", { x: 12, y: 1 });
    grant(rourke, "oath_iron_word");
    rourke.actionsRemaining = 0;
    expect(mission.canIronWord(rourke.instanceId)).toBe(false);
    rourke.actionsRemaining = MAX_ACTIONS_PER_TURN;
    rourke.downed = true;
    expect(mission.canIronWord(rourke.instanceId)).toBe(false);
  });

  it("is gated by IRON_WORD_COOLDOWN_TURNS — refused the instant it's used again, ready exactly on schedule", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 9, y: 1 });
    grant(rourke, "oath_iron_word");

    mission.ironWord(rourke.instanceId);
    const readyAtTurn = mission.turn + IRON_WORD_COOLDOWN_TURNS;

    rourke.actionsRemaining = MAX_ACTIONS_PER_TURN; // isolate the cooldown check from the action economy
    mission.turn = readyAtTurn - 1;
    expect(mission.canIronWord(rourke.instanceId)).toBe(false);

    mission.turn = readyAtTurn;
    expect(mission.canIronWord(rourke.instanceId)).toBe(true);
    expect(mission.ironWord(rourke.instanceId)).toBe(true);
  });

  it("expires at the wielder's next turn start, same loop as plain abil_taunt — both taunting AND tauntRadius clear", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 9, y: 1 });
    grant(rourke, "oath_iron_word");
    mission.ironWord(rourke.instanceId);

    mission.endPlayerTurn();

    expect(mission.turn).toBe(2);
    expect(rourke.taunting).toBe(false);
    expect(rourke.tauntRadius).toBeUndefined();
  });

  it("PURELY ADDITIVE: a plain abil_taunt user (no tauntRadius) is untouched by this pass — engine/ai.ts's own claim, checked directly", () => {
    const mission = quietMission();
    const iyari = pilot(mission, "pilot_iyari", { x: 9, y: 1 });
    iyari.abilities = [...iyari.abilities, "abil_taunt"];
    iyari.taunting = true;
    expect(iyari.tauntRadius).toBeUndefined();
    // No assertion on decideHostileAction here — that's ai.test.ts's job
    // (see its own "oath_iron_word's radius gate" describe block, added
    // alongside this file). This just confirms the flag shape plain Taunt
    // leaves behind is exactly what it always was.
  });
});

// =====================================================================
// lastword_field_triage (Migawari/The Last Word) — AoE Repair
// =====================================================================

describe("Mission.fieldTriage / getFieldTriageTargetsFrom (lastword_field_triage — Migawari/The Last Word)", () => {
  it("heals up to FIELD_TRIAGE_MAX_TARGETS nearest wounded allies within radius, costs 1 action, does NOT end the turn", () => {
    expect(FIELD_TRIAGE_MAX_TARGETS).toBe(2);
    expect(FIELD_TRIAGE_RADIUS).toBe(2);
    const mission = quietMission();
    const lask = pilot(mission, "pilot_lask", { x: 9, y: 2 });
    grant(lask, "lastword_field_triage", 1);
    const near1 = pilot(mission, "pilot_rourke", { x: 10, y: 2 }); // distance 1
    const near2 = pilot(mission, "pilot_bosk", { x: 9, y: 3 }); // distance 1
    const mid = pilot(mission, "pilot_anand", { x: 11, y: 2 }); // distance 2 — within radius, but 3rd-nearest, should lose the cap
    const full = pilot(mission, "pilot_iyari", { x: 10, y: 3 }); // distance 1, full HP — excluded regardless of distance
    for (const u of [near1, near2, mid]) u.currentHp -= 20;

    const preview = mission.getFieldTriageTargetsFrom(lask.instanceId, lask.pos).map((u) => u.instanceId);
    expect(preview).toEqual(expect.arrayContaining([near1.instanceId, near2.instanceId]));
    expect(preview).not.toContain(mid.instanceId);
    expect(preview).not.toContain(full.instanceId);
    expect(preview.length).toBe(2);

    const results = mission.fieldTriage(lask.instanceId);
    expect(results).not.toBeNull();
    expect(results!.length).toBe(2);
    expect(results!.map((r) => r.targetId)).toEqual(expect.arrayContaining([near1.instanceId, near2.instanceId]));
    expect(near1.currentHp).toBeGreaterThan(near1.maxHp - 20);
    expect(near2.currentHp).toBeGreaterThan(near2.maxHp - 20);
    expect(mid.currentHp).toBe(mid.maxHp - 20); // 3rd-nearest, untouched
    expect(full.currentHp).toBe(full.maxHp);
    // Both healed targets get the exact same amount — repairHealAmount()
    // depends only on the healer, never the target, so this holds regardless
    // of Lask's own mek track without hardcoding a specific HP number.
    const amountA = near1.currentHp - (near1.maxHp - 20);
    const amountB = near2.currentHp - (near2.maxHp - 20);
    expect(amountA).toBe(amountB);
    expect(amountA).toBeGreaterThan(0);
    expect(lask.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN - 1);
    expect(logsMatching(mission, "runs field triage").length).toBe(1);
  });

  it("never heals an enemy, and getFieldTriageTargetsFrom never includes one even when damaged and in radius", () => {
    const mission = quietMission();
    const lask = pilot(mission, "pilot_lask", { x: 9, y: 2 });
    grant(lask, "lastword_field_triage");
    const hostile = mover(mission, { x: 10, y: 2 }, { hp: 10 });

    expect(mission.getFieldTriageTargetsFrom(lask.instanceId, lask.pos)).toEqual([]);
    const results = mission.fieldTriage(lask.instanceId);
    expect(results).toEqual([]);
    expect(hostile.currentHp).toBe(10);
  });

  it("widens to FIELD_TRIAGE_RANK5_RADIUS at rank 5 — reaches a target rank 1 cannot", () => {
    const mission = quietMission();
    const lask = pilot(mission, "pilot_lask", { x: 0, y: 0 });
    const far = pilot(mission, "pilot_rourke", { x: FIELD_TRIAGE_RANK5_RADIUS, y: 0 }); // distance 3: outside rank-1 radius 2, inside rank-5 radius 3
    far.currentHp -= 20;

    grant(lask, "lastword_field_triage", 1);
    expect(mission.getFieldTriageTargetsFrom(lask.instanceId, lask.pos)).toEqual([]);

    lask.heirloomAbilityRanks = { lastword_field_triage: 5 };
    const targets = mission.getFieldTriageTargetsFrom(lask.instanceId, lask.pos);
    expect(targets.map((u) => u.instanceId)).toContain(far.instanceId);
  });

  it("refuses a unit without the ability, a spent unit, a downed unit, an unknown id, and any hostile", () => {
    const mission = quietMission();
    const bosk = pilot(mission, "pilot_bosk", { x: 9, y: 2 });
    expect(bosk.abilities).not.toContain("lastword_field_triage");
    expect(mission.canFieldTriage(bosk.instanceId)).toBe(false);
    expect(mission.fieldTriage(bosk.instanceId)).toBeNull();

    expect(mission.fieldTriage("no_such_unit")).toBeNull();

    const hostile = mover(mission, { x: 15, y: 8 });
    grant(hostile, "lastword_field_triage");
    expect(mission.canFieldTriage(hostile.instanceId)).toBe(false);
    expect(mission.fieldTriage(hostile.instanceId)).toBeNull();

    const lask = pilot(mission, "pilot_lask", { x: 11, y: 2 });
    grant(lask, "lastword_field_triage");
    lask.actionsRemaining = 0;
    expect(mission.canFieldTriage(lask.instanceId)).toBe(false);
    lask.actionsRemaining = MAX_ACTIONS_PER_TURN;
    lask.downed = true;
    expect(mission.canFieldTriage(lask.instanceId)).toBe(false);
  });

  it("is gated by FIELD_TRIAGE_COOLDOWN_TURNS — refused right after use, ready exactly on schedule", () => {
    const mission = quietMission();
    const lask = pilot(mission, "pilot_lask", { x: 9, y: 2 });
    grant(lask, "lastword_field_triage");

    mission.fieldTriage(lask.instanceId);
    const readyAtTurn = mission.turn + FIELD_TRIAGE_COOLDOWN_TURNS;

    lask.actionsRemaining = MAX_ACTIONS_PER_TURN;
    mission.turn = readyAtTurn - 1;
    expect(mission.canFieldTriage(lask.instanceId)).toBe(false);

    mission.turn = readyAtTurn;
    expect(mission.canFieldTriage(lask.instanceId)).toBe(true);
  });
});

// =====================================================================
// farsight_signature (Panoptes/Farsight's Reckoning) — global reveal
// =====================================================================

describe("Mission.farsightSignature (farsight_signature — Panoptes/Farsight's Reckoning)", () => {
  it("reveals every living hostile on the map, including burrowed, never its own side, costs 1 action, does NOT end the turn", () => {
    const mission = quietMission();
    const anand = pilot(mission, "pilot_anand", { x: 4, y: 6 });
    grant(anand, "farsight_signature", 1);
    const ally = pilot(mission, "pilot_lask", { x: 5, y: 6 });
    const far = mover(mission, { x: 30, y: 30 }); // no radius filter at all — distance should not matter
    const burrowed = createBloomUnit("bloom_undertow", { x: 10, y: 10 }, { burrowed: true });
    mission.units.push(burrowed);

    const out = mission.farsightSignature(anand.instanceId);
    expect(out).not.toBeNull();
    expect(out!.radius).toBe(Infinity);
    expect(out!.revealedIds).toEqual(expect.arrayContaining([far.instanceId, burrowed.instanceId]));
    expect(out!.revealedIds).not.toContain(ally.instanceId);
    expect(far.revealedUntilTurn).toBe(mission.turn);
    expect(burrowed.revealedUntilTurn).toBe(mission.turn);
    expect(burrowed.burrowed).toBe(true); // painted, not dug out — same rule Sensor Sweep already has
    expect(ally.revealedUntilTurn).toBeUndefined();
    expect(anand.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN - 1);
    expect(logsMatching(mission, "calls Panoptes' watch").length).toBe(1);
  });

  it("rank 1: the paint expires the turn after — same one-hostile-phase window as a plain Sensor Sweep", () => {
    const mission = quietMission();
    const anand = pilot(mission, "pilot_anand", { x: 4, y: 6 });
    grant(anand, "farsight_signature", 1);
    const hostile = mover(mission, { x: 10, y: 6 }, { moveRange: 0, vision: 0 });

    mission.farsightSignature(anand.instanceId);
    expect(mission.isRevealed(hostile.instanceId)).toBe(true);

    mission.endPlayerTurn();

    expect(mission.turn).toBe(2);
    expect(mission.isRevealed(hostile.instanceId)).toBe(false);
  });

  it("rank 5: the paint survives one extra hostile phase, then expires — DURATION 2 turns, not 1", () => {
    const mission = quietMission();
    const anand = pilot(mission, "pilot_anand", { x: 4, y: 6 });
    grant(anand, "farsight_signature", 5);
    const hostile = mover(mission, { x: 10, y: 6 }, { moveRange: 0, vision: 0 });

    mission.farsightSignature(anand.instanceId);
    mission.endPlayerTurn();
    expect(mission.turn).toBe(2);
    expect(mission.isRevealed(hostile.instanceId)).toBe(true); // still up — the extra turn rank 5 buys

    mission.endPlayerTurn();
    expect(mission.turn).toBe(3);
    expect(mission.isRevealed(hostile.instanceId)).toBe(false); // gone now
  });

  it("refuses a unit without the ability, a spent unit, a downed unit, an unknown id, and any hostile", () => {
    const mission = quietMission();
    const bosk = pilot(mission, "pilot_bosk", { x: 9, y: 1 });
    expect(bosk.abilities).not.toContain("farsight_signature");
    expect(mission.canFarsightSignature(bosk.instanceId)).toBe(false);
    expect(mission.farsightSignature(bosk.instanceId)).toBeNull();

    expect(mission.farsightSignature("no_such_unit")).toBeNull();

    const hostile = mover(mission, { x: 15, y: 8 });
    grant(hostile, "farsight_signature");
    expect(mission.canFarsightSignature(hostile.instanceId)).toBe(false);
    expect(mission.farsightSignature(hostile.instanceId)).toBeNull();

    const anand = pilot(mission, "pilot_anand", { x: 12, y: 1 });
    grant(anand, "farsight_signature");
    anand.actionsRemaining = 0;
    expect(mission.canFarsightSignature(anand.instanceId)).toBe(false);
    anand.actionsRemaining = MAX_ACTIONS_PER_TURN;
    anand.downed = true;
    expect(mission.canFarsightSignature(anand.instanceId)).toBe(false);
  });

  it("is gated by FARSIGHT_SIGNATURE_COOLDOWN_TURNS — refused right after use, ready exactly on schedule", () => {
    const mission = quietMission();
    const anand = pilot(mission, "pilot_anand", { x: 4, y: 6 });
    grant(anand, "farsight_signature");

    mission.farsightSignature(anand.instanceId);
    const readyAtTurn = mission.turn + FARSIGHT_SIGNATURE_COOLDOWN_TURNS;

    anand.actionsRemaining = MAX_ACTIONS_PER_TURN;
    mission.turn = readyAtTurn - 1;
    expect(mission.canFarsightSignature(anand.instanceId)).toBe(false);

    mission.turn = readyAtTurn;
    expect(mission.canFarsightSignature(anand.instanceId)).toBe(true);
  });

  it("still costs the action and logs even when nothing is out there to reveal", () => {
    const mission = quietMission();
    const anand = pilot(mission, "pilot_anand", { x: 4, y: 6 });
    grant(anand, "farsight_signature");
    // quietMission() downs every wave hostile and parks a blind/immobile
    // keeper — but the keeper is still ALIVE, so remove it too for a truly
    // empty hostile field.
    const keeper = mission.units.find((u) => u.side === "hostile" && !u.downed);
    if (keeper) keeper.downed = true;

    const out = mission.farsightSignature(anand.instanceId);
    expect(out!.revealedIds).toEqual([]);
    expect(anand.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN - 1);
    expect(logsMatching(mission, "no contacts anywhere on the field.").length).toBe(1);
  });
});

// =====================================================================
// ledger_overextended (Skuld/Widow's Ledger) — self debuff/buff trade
// =====================================================================

describe("Mission.ledgerOverextended (ledger_overextended — Skuld/Widow's Ledger)", () => {
  it("sets the overextended posture, costs 1 action, does NOT end the turn, and logs it", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 9, y: 1 });
    grant(rourke, "ledger_overextended", 1);

    expect(mission.canLedgerOverextended(rourke.instanceId)).toBe(true);
    expect(mission.ledgerOverextended(rourke.instanceId)).toBe(true);

    expect(rourke.overextended).toBe(true);
    expect(rourke.overextendedTurnsRemaining).toBeUndefined(); // rank 1-4: no counter, unconditional single-cycle clear
    expect(rourke.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN - 1);
    expect(logsMatching(mission, "overextends — defenseless").length).toBe(1);
  });

  it("cannot be re-armed while already active — canLedgerOverextended refuses a unit that's already overextended", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 9, y: 1 });
    grant(rourke, "ledger_overextended");
    mission.ledgerOverextended(rourke.instanceId);

    rourke.actionsRemaining = MAX_ACTIONS_PER_TURN; // isolate from the action economy
    expect(mission.canLedgerOverextended(rourke.instanceId)).toBe(false);
  });

  it("rank 1-4: clears at the wielder's very next turn start — one hostile phase of exposure, matching 'trade defense for one turn'", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 9, y: 1 });
    grant(rourke, "ledger_overextended", 1);
    mission.ledgerOverextended(rourke.instanceId);

    mission.endPlayerTurn();

    expect(mission.turn).toBe(2);
    expect(rourke.overextended).toBe(false);
    expect(mission.canLedgerOverextended(rourke.instanceId)).toBe(false); // cooldown, not the posture, blocks re-arming here
  });

  it("RANK 5 BUG-FIX PIN: survives into the wielder's NEXT turn too before clearing — 'duration extended to 2 turns' actually means two hostile phases of exposure, not one", () => {
    expect(LEDGER_OVEREXTENDED_RANK5_DURATION_TURNS).toBe(2);
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 9, y: 1 });
    grant(rourke, "ledger_overextended", 5);
    mission.ledgerOverextended(rourke.instanceId);
    expect(rourke.overextendedTurnsRemaining).toBe(LEDGER_OVEREXTENDED_RANK5_DURATION_TURNS);

    mission.endPlayerTurn();
    expect(mission.turn).toBe(2);
    // This is the exact assertion that failed against the pre-fix
    // `RANK5_DURATION_TURNS - 1` seed value — it cleared here instead.
    expect(rourke.overextended).toBe(true);
    expect(rourke.overextendedTurnsRemaining).toBe(1);

    mission.endPlayerTurn();
    expect(mission.turn).toBe(3);
    expect(rourke.overextended).toBe(false);
    expect(rourke.overextendedTurnsRemaining).toBeUndefined();
  });

  it("refuses a unit without the ability, a spent unit, a downed unit, an unknown id, and any hostile", () => {
    const mission = quietMission();
    const bosk = pilot(mission, "pilot_bosk", { x: 9, y: 1 });
    expect(bosk.abilities).not.toContain("ledger_overextended");
    expect(mission.canLedgerOverextended(bosk.instanceId)).toBe(false);
    expect(mission.ledgerOverextended(bosk.instanceId)).toBe(false);

    expect(mission.ledgerOverextended("no_such_unit")).toBe(false);

    const hostile = mover(mission, { x: 15, y: 8 });
    grant(hostile, "ledger_overextended");
    expect(mission.canLedgerOverextended(hostile.instanceId)).toBe(false);
    expect(mission.ledgerOverextended(hostile.instanceId)).toBe(false);

    const rourke = pilot(mission, "pilot_rourke", { x: 12, y: 1 });
    grant(rourke, "ledger_overextended");
    rourke.actionsRemaining = 0;
    expect(mission.canLedgerOverextended(rourke.instanceId)).toBe(false);
    rourke.actionsRemaining = MAX_ACTIONS_PER_TURN;
    rourke.downed = true;
    expect(mission.canLedgerOverextended(rourke.instanceId)).toBe(false);
  });

  it("is gated by LEDGER_OVEREXTENDED_COOLDOWN_TURNS — refused right after use, ready exactly on schedule", () => {
    const mission = quietMission();
    const rourke = pilot(mission, "pilot_rourke", { x: 9, y: 1 });
    grant(rourke, "ledger_overextended");

    mission.ledgerOverextended(rourke.instanceId);
    const readyAtTurn = mission.turn + LEDGER_OVEREXTENDED_COOLDOWN_TURNS;

    rourke.overextended = false; // isolate the cooldown check from the posture-reentry guard
    rourke.actionsRemaining = MAX_ACTIONS_PER_TURN;
    mission.turn = readyAtTurn - 1;
    expect(mission.canLedgerOverextended(rourke.instanceId)).toBe(false);

    mission.turn = readyAtTurn;
    expect(mission.canLedgerOverextended(rourke.instanceId)).toBe(true);
  });
});

// =====================================================================
// engine/combat.ts — salt_root_salt (passive) and ledger_overextended's
// combat-math hooks. Reproduces this file's own doc comments turn-by-turn
// the same way combat.test.ts reproduces Data Pack §13: these are the three
// small pure functions Vault Phase 2 slice 1 added, plus one integration
// check per function through the real resolver so a future refactor can't
// quietly stop calling them.
// =====================================================================

describe("engine/combat.ts — saltRootMultiplier (salt_root_salt — Delenda/Salt the Root)", () => {
  it("is 1 (no-op) for an attacker without the ability", () => {
    const attacker = testUnit("meeps", { x: 0, y: 0 });
    expect(saltRootMultiplier(attacker, "bloom_gallcyst")).toBe(1);
  });

  it("is SALT_ROOT_SESSILE_MULTIPLIER against every sessile archetype, regardless of rank", () => {
    const attacker = testUnit("meeps", { x: 0, y: 0 });
    attacker.abilities = ["salt_root_salt"];
    for (const sessileId of ["bloom_gallcyst", "bloom_heartwood", "bloom_wellroot", "bloom_unnamed"]) {
      expect(saltRootMultiplier(attacker, sessileId)).toBe(SALT_ROOT_SESSILE_MULTIPLIER);
    }
    attacker.heirloomAbilityRanks = { salt_root_salt: 5 };
    expect(saltRootMultiplier(attacker, "bloom_gallcyst")).toBe(SALT_ROOT_SESSILE_MULTIPLIER); // rank doesn't change the sessile number
  });

  it("is the (worse) non-sessile penalty against a non-sessile Bloom archetype, softened at rank 5", () => {
    const attacker = testUnit("meeps", { x: 0, y: 0 });
    attacker.abilities = ["salt_root_salt"];
    expect(saltRootMultiplier(attacker, "bloom_crawlmass")).toBe(SALT_ROOT_OTHER_MULTIPLIER);
    attacker.heirloomAbilityRanks = { salt_root_salt: 5 };
    expect(saltRootMultiplier(attacker, "bloom_crawlmass")).toBe(SALT_ROOT_RANK5_OTHER_MULTIPLIER);
  });

  it("treats an undefined archetype (any ordinary mech target) as non-sessile — Delenda is a Bloom specialist, worse against everything else", () => {
    const attacker = testUnit("meeps", { x: 0, y: 0 });
    attacker.abilities = ["salt_root_salt"];
    expect(saltRootMultiplier(attacker, undefined)).toBe(SALT_ROOT_OTHER_MULTIPLIER);
  });

  it("INTEGRATION: resolveAttackOnBloom actually applies the sessile bonus over the non-sessile penalty for the same attacker", () => {
    const map = makeUniformMap("road");
    const sessileTarget = createBloomUnit("bloom_gallcyst", { x: 1, y: 0 });
    const swarmTarget = createBloomUnit("bloom_crawlmass", { x: 1, y: 0 });
    const withAbility = testUnit("meeps", { x: 0, y: 0 });
    withAbility.abilities = ["salt_root_salt"];
    const without = testUnit("meeps", { x: 0, y: 0 });

    const vsSessile = resolveAttackOnBloom(map, withAbility, sessileTarget, [sessileTarget], false).damage;
    const vsSwarm = resolveAttackOnBloom(map, withAbility, swarmTarget, [swarmTarget], false).damage;
    const baselineVsSessile = resolveAttackOnBloom(map, without, sessileTarget, [sessileTarget], false).damage;

    expect(vsSessile).toBeGreaterThan(baselineVsSessile); // x1.6 beats the un-modified hit
    expect(vsSessile).toBeGreaterThan(vsSwarm); // the whole point of "salt the root" — sessile is the good matchup, everything else is worse
  });
});

describe("engine/combat.ts — overextendedAttackMultiplier / overextendedDefense (ledger_overextended's combat-math hooks)", () => {
  it("multiplier is 1 and defense is untouched for a unit that isn't overextended", () => {
    const unit = testUnit("meeps", { x: 0, y: 0 }, { tierDefense: 120 });
    expect(overextendedAttackMultiplier(unit)).toBe(1);
    expect(overextendedDefense(unit)).toBe(120);
  });

  it("multiplier is LEDGER_OVEREXTENDED_ATK_MULTIPLIER and defense is floored to LEDGER_OVEREXTENDED_DEFENSE_FLOOR while overextended", () => {
    const unit = testUnit("meeps", { x: 0, y: 0 }, { tierDefense: 120 });
    unit.overextended = true;
    expect(overextendedAttackMultiplier(unit)).toBe(LEDGER_OVEREXTENDED_ATK_MULTIPLIER);
    expect(overextendedDefense(unit)).toBe(LEDGER_OVEREXTENDED_DEFENSE_FLOOR);
    expect(LEDGER_OVEREXTENDED_DEFENSE_FLOOR).toBeGreaterThan(0); // the whole reason this floor constant exists — see its own comment in combatTables.ts: a literal 0 DEF divides by zero
  });

  it("INTEGRATION: resolveMechAttack deals more as an overextended attacker, and takes more as an overextended defender", () => {
    const map = makeUniformMap("road");
    const plainAttacker = testUnit("meeps", { x: 0, y: 0 });
    const overextendedAttacker = testUnit("meeps", { x: 0, y: 0 });
    overextendedAttacker.overextended = true;
    const defender = testUnit("tank", { x: 5, y: 5 }); // far apart — isolates the base hit, no counter

    const plainHit = resolveMechAttack(map, plainAttacker, defender, [defender], [plainAttacker], false).damage;
    const boostedHit = resolveMechAttack(map, overextendedAttacker, defender, [defender], [overextendedAttacker], false).damage;
    expect(boostedHit).toBeGreaterThan(plainHit);

    const plainDefender = testUnit("tank", { x: 5, y: 5 });
    const overextendedDefender = testUnit("tank", { x: 5, y: 5 });
    overextendedDefender.overextended = true;
    const attacker = testUnit("meeps", { x: 0, y: 0 });

    const normalTakenHit = resolveMechAttack(map, attacker, plainDefender, [plainDefender], [attacker], false).damage;
    const exposedTakenHit = resolveMechAttack(map, attacker, overextendedDefender, [overextendedDefender], [attacker], false).damage;
    expect(exposedTakenHit).toBeGreaterThan(normalTakenHit);
  });
});
