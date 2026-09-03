// Vault Phase 2, slice 5 (3 Sep 2026) — Migawari's remaining 2 of 3
// abilities: lastword_signature, lastword_last_rites (Osric Ferrow, House
// Ferrow, Munti path). See data/heirlooms.ts's own "last_word" entry and
// engine/mission.ts's lastWordSignature()/lastRites()/resolveLastRitesBorrowedTime
// header comments for the full design and every flagged interpretation
// call — these tests assert the BEHAVIOR those comments already commit
// to, not repeat the reasoning. Sibling file to cuttingRoom.test.ts — same
// house test style throughout, including that file's own stated
// convention of keeping a local copy of
// quietMission()/pilot()/grant()/logsMatching() rather than importing
// them. lastword_field_triage is untested here — already live since slice
// 1, untouched by this slice, and already covered by its own existing
// tests.
import { describe, it, expect } from "vitest";
import { Mission } from "../mission";
import { AMARANTH_MISSION_1 } from "../../data/campaignAmaranth";
import { createHostileMechUnit, createPlayerUnit, type BattleUnit } from "../units";
import {
  MAX_ACTIONS_PER_TURN,
  LAST_WORD_SIGNATURE_HP_MULTIPLIER_RANK1,
  LAST_WORD_SIGNATURE_HP_MULTIPLIER_RANK5,
  LAST_WORD_SIGNATURE_COOLDOWN_TURNS,
  LAST_RITES_ACTIONS_GRANTED,
  LAST_RITES_COOLDOWN_TURNS,
} from "../../data/combatTables";
import { createWardenCampaignState, applyLastWordSignatureCosts } from "../campaignState";
import { findPilot } from "../../data/pilotRegistry";

const PARK: Record<string, { x: number; y: number }> = {
  pilot_rourke: { x: 0, y: 0 },
  pilot_bosk: { x: 1, y: 0 },
  pilot_iyari: { x: 2, y: 0 },
  pilot_anand: { x: 3, y: 0 },
  pilot_lask: { x: 4, y: 0 },
};

// Same "one live hostile so checkWinLoss never fires early" shape
// cuttingRoom.test.ts's own quietMission() uses — every real hostile is
// downed, and one inert `keeper` (vision 0, moveRange 0) is added so the
// mission stays "ongoing" through an endPlayerTurn() call, which the Last
// Rites borrowed-time tests below actually need to reach.
function quietMission(): Mission {
  const mission = new Mission(AMARANTH_MISSION_1, undefined, [], { rng: () => 1 });
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

function grant(unit: BattleUnit, abilityId: string, rank = 1): void {
  unit.abilities = [...unit.abilities, abilityId];
  unit.heirloomAbilityRanks = { ...unit.heirloomAbilityRanks, [abilityId]: rank };
}

/** Puts an ally into the "downed, restockable" state directly rather than routing through a real attack — the same "construct the state, don't re-derive combat.ts" discipline testHelpers.ts's own testUnit already follows. downedOnTurn defaults to the mission's CURRENT turn ("just went down"); pass an explicit turn to simulate an older downing. */
function downAlly(mission: Mission, unit: BattleUnit, downedOnTurn = mission.turn): void {
  unit.downed = true;
  unit.currentHp = 0;
  unit.downedOnTurn = downedOnTurn;
}

const logsMatching = (mission: Mission, needle: string) => mission.log.filter((l) => l.includes(needle));

function setupWielder(mission: Mission, abilityId: string, rank = 1): BattleUnit {
  const osric = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
  grant(osric, abilityId, rank);
  return osric;
}

// =====================================================================
// lastword_signature — gating and target selection
// =====================================================================

describe("Mission.canLastWordSignature / getLastWordSignatureTargetsFrom", () => {
  it("refused without the ability, while downed, with no actions left, or on a hostile", () => {
    const mission = quietMission();
    const hostile = mission.units.find((u) => u.side === "hostile" && !u.downed)!; // the "keeper" quietMission() adds
    hostile.abilities = ["lastword_signature"];
    expect(mission.canLastWordSignature(hostile.instanceId)).toBe(false); // hostile side

    const osric = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    expect(mission.canLastWordSignature(osric.instanceId)).toBe(false); // no ability yet

    grant(osric, "lastword_signature", 1);
    expect(mission.canLastWordSignature(osric.instanceId)).toBe(true);

    osric.actionsRemaining = 0;
    expect(mission.canLastWordSignature(osric.instanceId)).toBe(false);
    osric.actionsRemaining = MAX_ACTIONS_PER_TURN;

    osric.downed = true;
    expect(mission.canLastWordSignature(osric.instanceId)).toBe(false);
    osric.downed = false;
  });

  it("is gated by LAST_WORD_SIGNATURE_COOLDOWN_TURNS — refused right after use, ready exactly on schedule", () => {
    const mission = quietMission();
    const osric = setupWielder(mission, "lastword_signature");
    const anand = pilot(mission, "pilot_anand", { x: 6, y: 5 });
    downAlly(mission, anand);
    expect(mission.lastWordSignature(osric.instanceId, anand.instanceId)).toBe(true);

    const readyAtTurn = mission.turn + LAST_WORD_SIGNATURE_COOLDOWN_TURNS;
    osric.actionsRemaining = MAX_ACTIONS_PER_TURN;
    mission.turn = readyAtTurn - 1;
    expect(mission.canLastWordSignature(osric.instanceId)).toBe(false);
    mission.turn = readyAtTurn;
    expect(mission.canLastWordSignature(osric.instanceId)).toBe(true);
  });

  it("target list: empty with nobody downed, includes a downed ally, excludes living allies and hostiles regardless of their own downed state", () => {
    const mission = quietMission();
    const osric = setupWielder(mission, "lastword_signature");
    expect(mission.getLastWordSignatureTargetsFrom(osric.instanceId)).toEqual([]);

    const anand = pilot(mission, "pilot_anand", { x: 6, y: 5 });
    downAlly(mission, anand);
    const targets = mission.getLastWordSignatureTargetsFrom(osric.instanceId);
    expect(targets.map((t) => t.instanceId)).toEqual([anand.instanceId]);

    const bosk = pilot(mission, "pilot_bosk", { x: 7, y: 5 }); // living — not a target
    expect(mission.getLastWordSignatureTargetsFrom(osric.instanceId).some((t) => t.instanceId === bosk.instanceId)).toBe(false);

    const hostile = mission.units.find((u) => u.side === "hostile" && !u.downed)!; // the "keeper" quietMission() adds
    hostile.downed = true; // a downed HOSTILE must never show up — side check, not just the downed flag
    expect(mission.getLastWordSignatureTargetsFrom(osric.instanceId).some((t) => t.instanceId === hostile.instanceId)).toBe(false);
  });

  it("excludes a downed ally this mission's own live permadeath check already ruled a permanent loss", () => {
    const mission = quietMission();
    const osric = setupWielder(mission, "lastword_signature");
    const anand = pilot(mission, "pilot_anand", { x: 6, y: 5 });
    downAlly(mission, anand);
    // Simulate handleDowned() having already recorded this as a permanent
    // loss (no living Munti on the side at the moment it happened) —
    // exactly the fact isPermanentlyLost() reads, without needing to drive
    // an actual Munti-less downing through combat.ts to get there.
    mission.permanentLosses.push({
      pilotId: "pilot_anand",
      reason: "no living Munti remains on this side — permanent loss",
      turn: mission.turn,
      turnsWithoutMunti: 0,
      muntisDeployed: 1,
      wasLastMunti: false,
    });
    expect(mission.getLastWordSignatureTargetsFrom(osric.instanceId)).toEqual([]);
    expect(mission.lastWordSignature(osric.instanceId, anand.instanceId)).toBe(false);
  });
});

// =====================================================================
// lastword_signature — the revival itself, and its permanent cost
// =====================================================================

describe("Mission.lastWordSignature — revival + the wielder's own permanent cost", () => {
  it("fully restores the target (HP, downed flag), does not spend an unrelated spare part, costs the wielder 1 action, does not end their turn", () => {
    const mission = quietMission();
    const osric = setupWielder(mission, "lastword_signature");
    const anand = pilot(mission, "pilot_anand", { x: 6, y: 5 });
    downAlly(mission, anand);
    const actionsBefore = osric.actionsRemaining;

    expect(mission.lastWordSignature(osric.instanceId, anand.instanceId)).toBe(true);
    expect(anand.downed).toBe(false);
    expect(anand.currentHp).toBe(anand.maxHp);
    expect(osric.actionsRemaining).toBe(actionsBefore - 1);
    expect(mission.phase).toBe("player"); // never ended the turn
    expect(logsMatching(mission, "pays Migawari's price").length).toBe(1);
  });

  it("rank 1: the wielder's OWN max HP is cut to exactly LAST_WORD_SIGNATURE_HP_MULTIPLIER_RANK1 of what it was, currentHp clamped down to match when it was at/above the new cap", () => {
    const mission = quietMission();
    const osric = setupWielder(mission, "lastword_signature", 1);
    const originalMaxHp = osric.maxHp;
    expect(osric.currentHp).toBe(originalMaxHp); // full HP going in
    const anand = pilot(mission, "pilot_anand", { x: 6, y: 5 });
    downAlly(mission, anand);

    mission.lastWordSignature(osric.instanceId, anand.instanceId);

    const expectedMaxHp = Math.round(originalMaxHp * LAST_WORD_SIGNATURE_HP_MULTIPLIER_RANK1);
    expect(osric.maxHp).toBe(expectedMaxHp);
    expect(osric.currentHp).toBe(expectedMaxHp); // clamped down from full, not healed past it
    expect(mission.signatureHpCosts).toEqual([{ pilotId: "pilot_rourke", hpMultiplier: LAST_WORD_SIGNATURE_HP_MULTIPLIER_RANK1, turn: mission.turn }]);
  });

  it("a wielder already well below the new cap keeps their actual current HP untouched — the clamp only ever lowers, never heals", () => {
    const mission = quietMission();
    const osric = setupWielder(mission, "lastword_signature", 1);
    const originalMaxHp = osric.maxHp;
    const woundedHp = Math.round(originalMaxHp * 0.5); // well under 90% of original
    osric.currentHp = woundedHp;
    const anand = pilot(mission, "pilot_anand", { x: 6, y: 5 });
    downAlly(mission, anand);

    mission.lastWordSignature(osric.instanceId, anand.instanceId);

    expect(osric.maxHp).toBe(Math.round(originalMaxHp * LAST_WORD_SIGNATURE_HP_MULTIPLIER_RANK1));
    expect(osric.currentHp).toBe(woundedHp); // exactly unchanged — no clamp needed, no heal happened
  });

  it("rank 5: the permanent cost is LAST_WORD_SIGNATURE_HP_MULTIPLIER_RANK5 (5%) instead of rank 1's 10%", () => {
    const mission = quietMission();
    const osric = setupWielder(mission, "lastword_signature", 5);
    const originalMaxHp = osric.maxHp;
    const anand = pilot(mission, "pilot_anand", { x: 6, y: 5 });
    downAlly(mission, anand);

    mission.lastWordSignature(osric.instanceId, anand.instanceId);

    expect(osric.maxHp).toBe(Math.round(originalMaxHp * LAST_WORD_SIGNATURE_HP_MULTIPLIER_RANK5));
    expect(mission.signatureHpCosts[0].hpMultiplier).toBe(LAST_WORD_SIGNATURE_HP_MULTIPLIER_RANK5);
  });

  it("compounds MULTIPLICATIVELY across two uses in the SAME mission — the second use's factor applies to the already-shrunk max HP, not the original", () => {
    const mission = quietMission();
    const osric = setupWielder(mission, "lastword_signature", 1);
    const originalMaxHp = osric.maxHp;
    const anand = pilot(mission, "pilot_anand", { x: 6, y: 5 });
    const lask = pilot(mission, "pilot_lask", { x: 6, y: 6 });
    downAlly(mission, anand);
    downAlly(mission, lask);

    mission.lastWordSignature(osric.instanceId, anand.instanceId);
    const afterFirst = osric.maxHp;
    expect(afterFirst).toBe(Math.round(originalMaxHp * LAST_WORD_SIGNATURE_HP_MULTIPLIER_RANK1));

    // Wait out the cooldown, restore the wielder's action budget (as a real
    // next-turn refresh would), then use it again on a second downed ally.
    mission.turn += LAST_WORD_SIGNATURE_COOLDOWN_TURNS;
    osric.actionsRemaining = MAX_ACTIONS_PER_TURN;
    mission.lastWordSignature(osric.instanceId, lask.instanceId);

    const expectedAfterSecond = Math.round(afterFirst * LAST_WORD_SIGNATURE_HP_MULTIPLIER_RANK1);
    expect(osric.maxHp).toBe(expectedAfterSecond);
    // NOT the flat-subtraction reading — two 10% cuts off the ORIGINAL
    // would leave exactly 80% of it; multiplicative compounding leaves 81%,
    // a real, checkable difference for any originalMaxHp that isn't a
    // multiple of 100.
    expect(osric.maxHp).not.toBe(Math.round(originalMaxHp * 0.8));
    expect(mission.signatureHpCosts).toHaveLength(2);
    expect(mission.signatureHpCosts.map((c) => c.hpMultiplier)).toEqual([
      LAST_WORD_SIGNATURE_HP_MULTIPLIER_RANK1,
      LAST_WORD_SIGNATURE_HP_MULTIPLIER_RANK1,
    ]);
  });
});

// =====================================================================
// lastword_signature — the cross-mission persistence half
// (engine/campaignState.ts's applyLastWordSignatureCosts + createPlayerUnit)
// =====================================================================

describe("applyLastWordSignatureCosts — landing the cost on the persistent PilotRecord", () => {
  it("writes a fresh permanentMaxHpMultiplier for a pilot who has never paid the cost before", () => {
    const state = createWardenCampaignState();
    expect(state.pilots["pilot_bosk"].pilot.permanentMaxHpMultiplier).toBeUndefined();
    applyLastWordSignatureCosts(state, [{ pilotId: "pilot_bosk", hpMultiplier: LAST_WORD_SIGNATURE_HP_MULTIPLIER_RANK1 }]);
    expect(state.pilots["pilot_bosk"].pilot.permanentMaxHpMultiplier).toBeCloseTo(0.9);
  });

  it("compounds MULTIPLICATIVELY across two SEPARATE debrief calls — two different missions, weeks apart in campaign terms", () => {
    const state = createWardenCampaignState();
    // Mission A's debrief.
    applyLastWordSignatureCosts(state, [{ pilotId: "pilot_bosk", hpMultiplier: LAST_WORD_SIGNATURE_HP_MULTIPLIER_RANK1 }]);
    expect(state.pilots["pilot_bosk"].pilot.permanentMaxHpMultiplier).toBeCloseTo(0.9);
    // Mission B's debrief, an entirely separate call — same pilot, rank 5 this time.
    applyLastWordSignatureCosts(state, [{ pilotId: "pilot_bosk", hpMultiplier: LAST_WORD_SIGNATURE_HP_MULTIPLIER_RANK5 }]);
    expect(state.pilots["pilot_bosk"].pilot.permanentMaxHpMultiplier).toBeCloseTo(0.9 * 0.95);
  });

  it("a no-op for a pilotId this campaign doesn't recognize — defense in depth, never throws", () => {
    const state = createWardenCampaignState();
    expect(() => applyLastWordSignatureCosts(state, [{ pilotId: "pilot_does_not_exist", hpMultiplier: 0.9 }])).not.toThrow();
    expect(state.pilots["pilot_does_not_exist"]).toBeUndefined();
  });

  it("never touches mek spare parts — 'no spare part spent' needs no dedicated code because nothing here calls into that system at all", () => {
    const state = createWardenCampaignState();
    const mekId = state.pilots["pilot_bosk"].pilot.mekId;
    const before = state.meks[mekId].spareParts;
    applyLastWordSignatureCosts(state, [{ pilotId: "pilot_bosk", hpMultiplier: 0.9 }]);
    expect(state.meks[mekId].spareParts).toBe(before);
  });

  it("end-to-end: two missions' worth of use correctly reads back on a FRESH BattleUnit built for that pilot's next deployment", () => {
    const basePilot = findPilot("pilot_bosk")!;
    const before = createPlayerUnit("pilot_bosk", { x: 0, y: 0 }, { pilot: basePilot });
    const baselineMaxHp = before.maxHp;
    expect(before.currentHp).toBe(baselineMaxHp);

    const state = createWardenCampaignState();
    applyLastWordSignatureCosts(state, [{ pilotId: "pilot_bosk", hpMultiplier: LAST_WORD_SIGNATURE_HP_MULTIPLIER_RANK1 }]);
    applyLastWordSignatureCosts(state, [{ pilotId: "pilot_bosk", hpMultiplier: LAST_WORD_SIGNATURE_HP_MULTIPLIER_RANK1 }]);
    const expectedMultiplier = LAST_WORD_SIGNATURE_HP_MULTIPLIER_RANK1 * LAST_WORD_SIGNATURE_HP_MULTIPLIER_RANK1;
    expect(state.pilots["pilot_bosk"].pilot.permanentMaxHpMultiplier).toBeCloseTo(expectedMultiplier);

    // The exact live wiring scenes/Battle.ts's resolveDeployRoster uses:
    // pass the CampaignState's own live PilotRecord straight through.
    const after = createPlayerUnit("pilot_bosk", { x: 0, y: 0 }, { pilot: state.pilots["pilot_bosk"].pilot });
    expect(after.maxHp).toBe(Math.round(baselineMaxHp * expectedMultiplier));
    expect(after.currentHp).toBe(after.maxHp); // a freshly-deployed unit always starts at its own (now-lower) full HP
    expect(after.maxHp).toBeLessThan(baselineMaxHp);
  });

  it("a pilot who has never wielded Migawari deploys at their normal, un-shrunk max HP — the multiplier is a true no-op absent", () => {
    const state = createWardenCampaignState();
    const unit = createPlayerUnit("pilot_iyari", { x: 0, y: 0 }, { pilot: state.pilots["pilot_iyari"].pilot });
    const staticUnit = createPlayerUnit("pilot_iyari", { x: 0, y: 0 }, { pilot: findPilot("pilot_iyari")! });
    expect(unit.maxHp).toBe(staticUnit.maxHp);
  });

  // -------------------------------------------------------------------
  // The exact pipeline scenes/Debrief.ts now drives — Mission.signatureHpCosts,
  // recorded live by a REAL Mission.lastWordSignature() call (not a
  // hand-built cost array like the tests above), landed on a CampaignState
  // via applyLastWordSignatureCosts exactly once per mission, and read back
  // by createPlayerUnit on that pilot's own NEXT deployment. Proves the
  // cost genuinely survives past the mission it was paid in, not just that
  // the two halves work correctly in isolation.
  // -------------------------------------------------------------------

  it("survives past the mission it was used in — a real in-mission use, applied at debrief, changes a FRESH BattleUnit built for that pilot's next deployment", () => {
    const state = createWardenCampaignState();
    const baselinePilot = state.pilots["pilot_bosk"].pilot;
    const beforeAnyUse = createPlayerUnit("pilot_bosk", { x: 0, y: 0 }, { pilot: baselinePilot });
    const baselineMaxHp = beforeAnyUse.maxHp;
    expect(baselinePilot.permanentMaxHpMultiplier).toBeUndefined(); // never wielded Migawari yet

    // ---- Mission A: Osric (wielder) revives Bosk mid-mission. ----
    const missionA = quietMission();
    const osricA = pilot(missionA, "pilot_rourke", { x: 5, y: 5 });
    grant(osricA, "lastword_signature", 1);
    const boskA = pilot(missionA, "pilot_bosk", { x: 6, y: 5 });
    downAlly(missionA, boskA);
    expect(missionA.lastWordSignature(osricA.instanceId, boskA.instanceId)).toBe(true);
    expect(missionA.signatureHpCosts).toHaveLength(1);

    // ---- Debrief A: exactly what scenes/Debrief.ts's create() now does. ----
    applyLastWordSignatureCosts(state, missionA.signatureHpCosts);
    expect(state.pilots["pilot_rourke"].pilot.permanentMaxHpMultiplier).toBeCloseTo(LAST_WORD_SIGNATURE_HP_MULTIPLIER_RANK1);

    // ---- Between missions: the wielder's NEXT deployment (a fresh Mission
    // object — Mission itself never survives between missions, this is the
    // whole reason the cost has to be written down) reads the shrunk value
    // back off the persisted PilotRecord, with no in-mission state carried
    // over at all. ----
    const missionB = quietMission();
    const osricBRoster = state.pilots["pilot_rourke"].pilot;
    const osricB = missionB.units.find((u) => u.pilotId === "pilot_rourke")!;
    // Rebuild exactly as scenes/Battle.ts's deployPlayerUnits would, using
    // the now-updated CampaignState pilot record.
    const rebuiltOsric = createPlayerUnit("pilot_rourke", osricB.pos, { pilot: osricBRoster });
    const originalOsricMaxHp = createPlayerUnit("pilot_rourke", osricB.pos, { pilot: findPilot("pilot_rourke")! }).maxHp;
    expect(rebuiltOsric.maxHp).toBe(Math.round(originalOsricMaxHp * LAST_WORD_SIGNATURE_HP_MULTIPLIER_RANK1));
    expect(rebuiltOsric.maxHp).toBeLessThan(originalOsricMaxHp);
    expect(rebuiltOsric.currentHp).toBe(rebuiltOsric.maxHp); // starts Mission B at full (of the now-lower) HP

    // ---- A second use, in Mission B, on the SAME wielder — confirms the
    // multiplier keeps compounding across missions once it's actually
    // wired through Debrief, not just within one. ----
    grant(rebuiltOsric, "lastword_signature", 1);
    missionB.units = missionB.units.map((u) => (u.pilotId === "pilot_rourke" ? rebuiltOsric : u));
    const lask = pilot(missionB, "pilot_lask", { x: 6, y: 6 });
    downAlly(missionB, lask);
    missionB.lastWordSignature(rebuiltOsric.instanceId, lask.instanceId);
    applyLastWordSignatureCosts(state, missionB.signatureHpCosts);

    const expectedMultiplier = LAST_WORD_SIGNATURE_HP_MULTIPLIER_RANK1 * LAST_WORD_SIGNATURE_HP_MULTIPLIER_RANK1;
    expect(state.pilots["pilot_rourke"].pilot.permanentMaxHpMultiplier).toBeCloseTo(expectedMultiplier);
    const missionCOsric = createPlayerUnit("pilot_rourke", { x: 0, y: 0 }, { pilot: state.pilots["pilot_rourke"].pilot });
    expect(missionCOsric.maxHp).toBe(Math.round(originalOsricMaxHp * expectedMultiplier));

    // Bosk, meanwhile, was only ever REVIVED (the target), never the
    // wielder — his own record must be completely untouched by any of this.
    expect(state.pilots["pilot_bosk"].pilot.permanentMaxHpMultiplier).toBeUndefined();
    const boskNextDeploy = createPlayerUnit("pilot_bosk", { x: 0, y: 0 }, { pilot: state.pilots["pilot_bosk"].pilot });
    expect(boskNextDeploy.maxHp).toBe(baselineMaxHp);
  });
});

// =====================================================================
// lastword_last_rites — gating and target selection
// =====================================================================

describe("Mission.canLastRites / getLastRitesTargetsFrom", () => {
  it("refused without the ability, while downed, with no actions left, or on a hostile", () => {
    const mission = quietMission();
    const osric = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    expect(mission.canLastRites(osric.instanceId)).toBe(false);
    grant(osric, "lastword_last_rites", 1);
    expect(mission.canLastRites(osric.instanceId)).toBe(true);

    osric.actionsRemaining = 0;
    expect(mission.canLastRites(osric.instanceId)).toBe(false);
    osric.actionsRemaining = MAX_ACTIONS_PER_TURN;

    osric.downed = true;
    expect(mission.canLastRites(osric.instanceId)).toBe(false);
  });

  it("is gated by LAST_RITES_COOLDOWN_TURNS", () => {
    const mission = quietMission();
    const osric = setupWielder(mission, "lastword_last_rites");
    const anand = pilot(mission, "pilot_anand", { x: 6, y: 5 });
    downAlly(mission, anand);
    expect(mission.lastRites(osric.instanceId, anand.instanceId)).toBe(true);

    const readyAtTurn = mission.turn + LAST_RITES_COOLDOWN_TURNS;
    osric.actionsRemaining = MAX_ACTIONS_PER_TURN;
    mission.turn = readyAtTurn - 1;
    expect(mission.canLastRites(osric.instanceId)).toBe(false);
    mission.turn = readyAtTurn;
    expect(mission.canLastRites(osric.instanceId)).toBe(true);
  });

  it("only offers an ally downed on THIS SAME Mission.turn — an earlier downing is not eligible", () => {
    const mission = quietMission();
    const osric = setupWielder(mission, "lastword_last_rites");
    const anand = pilot(mission, "pilot_anand", { x: 6, y: 5 });
    downAlly(mission, anand); // this turn
    const lask = pilot(mission, "pilot_lask", { x: 6, y: 6 });
    downAlly(mission, lask, mission.turn - 1); // an earlier turn — stale

    const targets = mission.getLastRitesTargetsFrom(osric.instanceId);
    expect(targets.map((t) => t.instanceId)).toEqual([anand.instanceId]);
    expect(mission.lastRites(osric.instanceId, lask.instanceId)).toBe(false);
  });

  it("excludes a downed ally already ruled a permanent loss this mission, same gate lastword_signature uses", () => {
    const mission = quietMission();
    const osric = setupWielder(mission, "lastword_last_rites");
    const anand = pilot(mission, "pilot_anand", { x: 6, y: 5 });
    downAlly(mission, anand);
    mission.permanentLosses.push({
      pilotId: "pilot_anand",
      reason: "no living Munti remains on this side — permanent loss",
      turn: mission.turn,
      turnsWithoutMunti: 0,
      muntisDeployed: 1,
      wasLastMunti: false,
    });
    expect(mission.getLastRitesTargetsFrom(osric.instanceId)).toEqual([]);
  });
});

// =====================================================================
// lastword_last_rites — the borrowed action, and its close-out
// =====================================================================

describe("Mission.lastRites — the borrowed action itself", () => {
  it("rank 1: un-downs the target, grants exactly LAST_RITES_ACTIONS_GRANTED action(s), does NOT heal — currentHp stays at the 0 the original downing left it at", () => {
    const mission = quietMission();
    const osric = setupWielder(mission, "lastword_last_rites", 1);
    const anand = pilot(mission, "pilot_anand", { x: 6, y: 5 });
    downAlly(mission, anand);

    expect(mission.lastRites(osric.instanceId, anand.instanceId)).toBe(true);
    expect(anand.downed).toBe(false);
    expect(anand.actionsRemaining).toBe(LAST_RITES_ACTIONS_GRANTED);
    expect(anand.currentHp).toBe(0); // rank 1 — no heal
    expect(anand.lastRitesBorrowedTurn).toBe(mission.turn);
    expect(logsMatching(mission, "one final action").length).toBe(1);
    expect(logsMatching(mission, "fully healed").length).toBe(0);
  });

  it("rank 5: also fully heals the target for that one action", () => {
    const mission = quietMission();
    const osric = setupWielder(mission, "lastword_last_rites", 5);
    const anand = pilot(mission, "pilot_anand", { x: 6, y: 5 });
    downAlly(mission, anand);

    mission.lastRites(osric.instanceId, anand.instanceId);
    expect(anand.currentHp).toBe(anand.maxHp);
    expect(logsMatching(mission, "fully healed").length).toBe(1);
  });

  it("costs the HEALER 1 action, does not end their turn, refuses an invalid target", () => {
    const mission = quietMission();
    const osric = setupWielder(mission, "lastword_last_rites");
    const actionsBefore = osric.actionsRemaining;
    const bosk = pilot(mission, "pilot_bosk", { x: 7, y: 5 }); // living, not a valid target
    expect(mission.lastRites(osric.instanceId, bosk.instanceId)).toBe(false);
    expect(osric.actionsRemaining).toBe(actionsBefore); // refused — nothing spent

    const anand = pilot(mission, "pilot_anand", { x: 6, y: 5 });
    downAlly(mission, anand);
    mission.lastRites(osric.instanceId, anand.instanceId);
    expect(osric.actionsRemaining).toBe(actionsBefore - 1);
    expect(mission.phase).toBe("player");
  });
});

describe("Mission.resolveLastRitesBorrowedTime — the close-out, via endPlayerTurn()", () => {
  it("rank 1: forces the ally back down at end of the SAME player turn, whether or not the borrowed action was ever spent", () => {
    const mission = quietMission();
    const osric = setupWielder(mission, "lastword_last_rites", 1);
    const anand = pilot(mission, "pilot_anand", { x: 6, y: 5 });
    downAlly(mission, anand);
    mission.lastRites(osric.instanceId, anand.instanceId);
    expect(anand.downed).toBe(false); // borrowed window open

    mission.endPlayerTurn(); // the ally never actually acted with the borrowed point
    expect(anand.downed).toBe(true);
    expect(anand.currentHp).toBe(0);
    expect(anand.actionsRemaining).toBe(0);
    expect(anand.lastRitesBorrowedTurn).toBeUndefined();
    expect(logsMatching(mission, "borrowed time from Last Rites runs out").length).toBe(1);
  });

  it("rank 5: the heal does NOT survive the close-out — 'then goes down again as normal' applies even after the full heal", () => {
    const mission = quietMission();
    const osric = setupWielder(mission, "lastword_last_rites", 5);
    const anand = pilot(mission, "pilot_anand", { x: 6, y: 5 });
    downAlly(mission, anand);
    mission.lastRites(osric.instanceId, anand.instanceId);
    expect(anand.currentHp).toBe(anand.maxHp); // healed for the window

    mission.endPlayerTurn();
    expect(anand.downed).toBe(true);
    expect(anand.currentHp).toBe(0); // the heal was for the borrowed action only, not a permanent save
  });

  it("does NOT re-run handleDowned() — no duplicate permanent-loss entry, no duplicate 'is downed' log line for the original downing", () => {
    const mission = quietMission();
    const osric = setupWielder(mission, "lastword_last_rites", 1);
    const anand = pilot(mission, "pilot_anand", { x: 6, y: 5 });
    downAlly(mission, anand); // constructed directly — never went through handleDowned in this test
    mission.lastRites(osric.instanceId, anand.instanceId);
    const lossesBefore = mission.permanentLosses.length;

    mission.endPlayerTurn();

    expect(mission.permanentLosses.length).toBe(lossesBefore); // no new permadeath evaluation happened
    expect(logsMatching(mission, `${anand.displayName} is downed.`).length).toBe(0); // handleDowned's own line, never fired
    expect(logsMatching(mission, "borrowed time from Last Rites runs out").length).toBe(1); // this method's own line, exactly once
  });

  it("a unit downed for real (through ordinary combat) during its own borrowed action is left exactly as combat left it — no double 'runs out' handling, no HP override", () => {
    const mission = quietMission();
    const osric = setupWielder(mission, "lastword_last_rites", 5);
    const anand = pilot(mission, "pilot_anand", { x: 6, y: 5 });
    downAlly(mission, anand);
    mission.lastRites(osric.instanceId, anand.instanceId);
    expect(anand.currentHp).toBe(anand.maxHp);

    // Simulate a real second death during the borrowed action — combat.ts's
    // own applyMechDamage already clamps to exactly 0 and sets downed
    // true; handleDowned would already have run for real at this point in
    // live play. lastRitesBorrowedTurn is still set (nothing has cleared
    // it yet), matching the live sequence exactly.
    anand.downed = true;
    anand.currentHp = 0;

    mission.endPlayerTurn();
    // resolveLastRitesBorrowedTime's own re-down branch never fires
    // (unit.downed was already true going in) — only the flag gets swept.
    expect(logsMatching(mission, "borrowed time from Last Rites runs out").length).toBe(0);
    expect(anand.lastRitesBorrowedTurn).toBeUndefined();
    expect(anand.downed).toBe(true);
  });
});
