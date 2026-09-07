// Beacon Control + Restock Room (claude/Bloom_Wars_Beacon_Restock_Economy_v1.md,
// built 4 Sep 2026) — the mission-mechanic half (Mission.beaconHolderId/
// canPlaceBeacon/getBeaconTargetsFrom/useBeaconControl in engine/mission.ts)
// plus the campaign-economy half (purchaseBeaconCrate/purchaseBeaconCharge/
// applyBeaconStockConsumption/applyBeaconReviveCosts in
// engine/campaignEconomy.ts). Same house test style as lastWord.test.ts and
// weaponsBayFireSupport.test.ts — a real Mission built from a real mission
// def (AMARANTH_MISSION_1, same as lastWord.test.ts, so pilot_lask's
// path:"munti" archetype is available for the Munti-waiver tests), direct
// unit mutation to isolate one scenario on an otherwise quiet board, and a
// local (deliberately not imported/shared, per that file's own stated
// convention) copy of quietMission()/pilot()/downAlly()/logsMatching().
import { describe, it, expect } from "vitest";
import { Mission, type MissionOptions } from "../mission";
import { AMARANTH_MISSION_1 } from "../../data/campaignAmaranth";
import { HOUSE_AMARANTH_MISSION_1 } from "../../data/campaignHouseAmaranth";
import { createHostileMechUnit, type BattleUnit } from "../units";
import { MAX_ACTIONS_PER_TURN, BEACON_MAX_PER_MISSION } from "../../data/combatTables";
import type { ReservedBayId } from "../campaignState";
import {
  purchaseBeaconCrate,
  purchaseBeaconCharge,
  applyBeaconStockConsumption,
  applyBeaconReviveCosts,
  computeMissionCompletionBonus,
  BEACON_CRATE_COST,
  BEACON_CRATE_COST_DISCOUNTED,
  BEACON_CHARGE_COST,
  BEACON_CHARGE_COST_DISCOUNTED,
  BEACON_REVIVE_PAYOUT_PERCENT,
} from "../campaignEconomy";
import { createWardenCampaignState, BEACON_STARTING_CRATES, BEACON_STARTING_CHARGES } from "../campaignState";

const PARK: Record<string, { x: number; y: number }> = {
  pilot_rourke: { x: 8, y: 5 },
  pilot_bosk: { x: 1, y: 0 },
  pilot_iyari: { x: 2, y: 0 },
  pilot_anand: { x: 3, y: 0 },
  pilot_lask: { x: 4, y: 0 },
};

// All three bays this mechanic needs — most tests want every gate open so
// they isolate one thing at a time; the gating tests below build with a
// subset instead.
const ALL_BEACON_BAYS: ReservedBayId[] = ["beaconControl", "restockRoom", "generator"];

/**
 * Mirrors lastWord.test.ts's own quietMission() (same "one live inert
 * keeper hostile so checkWinLoss never fires early" shape), extended with
 * the parameters this mechanic actually needs: builtBays (weaponsBayFireSupport.test.ts's
 * own precedent for parameterizing bays), stock (MissionOptions.beaconCratesRemaining/
 * beaconChargesRemaining), and rourkeRank (MissionOptions.rourkeRank, 6 Sep
 * 2026 — beaconHolderId's new gate). Defaults rourkeRank to "maj" rather
 * than mirroring the real "2nd_lt" campaign-start default: every describe
 * block below except beaconHolderId's own is testing bay/stock/range/cost
 * gating, not the rank gate itself, and needs Rourke eligible to do that —
 * the rank-gate's own tests override this explicitly.
 */
function quietMission(
  builtBays: ReservedBayId[] = ALL_BEACON_BAYS,
  stock?: Pick<MissionOptions, "beaconCratesRemaining" | "beaconChargesRemaining">,
  rourkeRank: MissionOptions["rourkeRank"] = "maj"
): Mission {
  const mission = new Mission(AMARANTH_MISSION_1, undefined, builtBays, {
    rng: () => 1,
    beaconCratesRemaining: stock?.beaconCratesRemaining ?? 3,
    beaconChargesRemaining: stock?.beaconChargesRemaining ?? 3,
    rourkeRank,
  });
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

function downAlly(mission: Mission, unit: BattleUnit, downedOnTurn = mission.turn): void {
  unit.downed = true;
  unit.currentHp = 0;
  unit.downedOnTurn = downedOnTurn;
}

const logsMatching = (mission: Mission, needle: string) => mission.log.filter((l) => l.includes(needle));

/**
 * House Amaranth counterpart to quietMission() above — same "one live
 * inert keeper hostile" shape, built off HOUSE_AMARANTH_MISSION_1 instead
 * (extractUnitFallback.test.ts's own precedent for constructing a real
 * House Amaranth Mission directly). Deliberately doesn't reposition player
 * units the way quietMission()'s PARK table does — nothing here checks
 * player positions, only who holds the ability and whether the mechanic's
 * gates pass.
 */
function quietHouseAmaranthMission(
  builtBays: ReservedBayId[] = ALL_BEACON_BAYS,
  stock?: Pick<MissionOptions, "beaconCratesRemaining" | "beaconChargesRemaining">
): Mission {
  const mission = new Mission(HOUSE_AMARANTH_MISSION_1, undefined, builtBays, {
    rng: () => 1,
    beaconCratesRemaining: stock?.beaconCratesRemaining ?? 3,
    beaconChargesRemaining: stock?.beaconChargesRemaining ?? 3,
  });
  for (const u of mission.units) if (u.side === "hostile") u.downed = true;
  // hostile_mech_01 is a generic registered mech (data/units.ts), not
  // Warden-specific — same id quietMission() above uses for its own keeper.
  const keeper = createHostileMechUnit("hostile_mech_01", { x: 19, y: 11 });
  keeper.vision = 0;
  keeper.moveRange = 0;
  mission.units.push(keeper);
  return mission;
}

// =====================================================================
// beaconHolderId — Rourke only, Captain or higher (changed 6 Sep 2026 from
// the original "whichever deployed pilot holds the highest gear tier" rule
// — see the method's own header in engine/mission.ts for why)
// =====================================================================

describe("Mission.beaconHolderId", () => {
  it("is Rourke once she's Captain or higher, regardless of anyone's gear tier", () => {
    const mission = quietMission(ALL_BEACON_BAYS, undefined, "capt");
    // Give every non-Rourke pilot the best possible tier — under the old
    // rule this would hand the ability to one of them; under the new rule
    // gear never enters the decision at all.
    pilot(mission, "pilot_bosk").tier = "S";
    pilot(mission, "pilot_iyari").tier = "A";
    pilot(mission, "pilot_anand").tier = "A";
    expect(mission.beaconHolderId()).toBe(pilot(mission, "pilot_rourke").instanceId);
  });

  it("is Rourke at Major too — Captain and Major are both eligible", () => {
    const mission = quietMission(ALL_BEACON_BAYS, undefined, "maj");
    expect(mission.beaconHolderId()).toBe(pilot(mission, "pilot_rourke").instanceId);
  });

  it("is null at 2nd Lieutenant, even with Rourke deployed and alive — locked out until she's promoted", () => {
    const mission = quietMission(ALL_BEACON_BAYS, undefined, "2nd_lt");
    expect(mission.beaconHolderId()).toBeNull();
  });

  it("is null while Rourke is downed, even at Major — nobody else steps in", () => {
    const mission = quietMission(ALL_BEACON_BAYS, undefined, "maj");
    downAlly(mission, pilot(mission, "pilot_rourke"));
    expect(mission.beaconHolderId()).toBeNull();
  });

  it("ignores hostiles entirely, even one named to collide (nonsensically) with her pilotId", () => {
    const mission = quietMission(ALL_BEACON_BAYS, undefined, "maj");
    const hostile = mission.units.find((u) => u.side === "hostile" && !u.downed)!;
    hostile.tier = "S";
    expect(mission.beaconHolderId()).not.toBe(hostile.instanceId);
  });

  it("is null when every player unit is downed — nobody left to hold it", () => {
    const mission = quietMission(ALL_BEACON_BAYS, undefined, "maj");
    for (const u of mission.units) if (u.side === "player") downAlly(mission, u);
    expect(mission.beaconHolderId()).toBeNull();
  });
});

// =====================================================================
// beaconHolderId — House Amaranth (Marrow), added 6 Sep 2026 same
// conversation as the Rourke rank gate above. Unlike Rourke, Marrow needs
// no rank check at all — see engine/mission.ts's own header on why she's
// unconditional. Also documents, rather than hides, that this is currently
// unreachable in an actual played House Amaranth campaign (no hub exists
// yet to build the three bays canPlaceBeacon still requires there) — these
// tests exercise the engine layer directly, the same way a real House
// Amaranth hub eventually would.
// =====================================================================

describe("Mission.beaconHolderId — House Amaranth (Marrow)", () => {
  it("is Marrow from Mission 1 on, no rank gate needed", () => {
    const mission = quietHouseAmaranthMission();
    const marrow = mission.units.find((u) => u.pilotId === "pilot_marrow")!;
    expect(mission.beaconHolderId()).toBe(marrow.instanceId);
  });

  it("stays Marrow even at rourkeRank's real campaign-wide default (2nd_lt) — that field means nothing on this side", () => {
    const mission = new Mission(HOUSE_AMARANTH_MISSION_1, undefined, ALL_BEACON_BAYS, {
      rng: () => 1,
      beaconCratesRemaining: 3,
      beaconChargesRemaining: 3,
      rourkeRank: "2nd_lt",
    });
    for (const u of mission.units) if (u.side === "hostile") u.downed = true;
    const marrow = mission.units.find((u) => u.pilotId === "pilot_marrow")!;
    expect(mission.beaconHolderId()).toBe(marrow.instanceId);
  });

  it("is null while Marrow is downed — nobody else steps in for her either", () => {
    const mission = quietHouseAmaranthMission();
    const marrow = mission.units.find((u) => u.pilotId === "pilot_marrow")!;
    downAlly(mission, marrow);
    expect(mission.beaconHolderId()).toBeNull();
  });

  it("canPlaceBeacon works for Marrow once the three bays exist, same gates as Rourke's side", () => {
    const mission = quietHouseAmaranthMission();
    const holderId = mission.beaconHolderId()!;
    expect(mission.canPlaceBeacon(holderId)).toBe(true);
  });
});

// =====================================================================
// canPlaceBeacon — every gate
// =====================================================================

describe("Mission.canPlaceBeacon", () => {
  it("true for the holder with every bay built, stock available, and actions remaining", () => {
    const mission = quietMission();
    const holder = mission.units.find((u) => u.instanceId === mission.beaconHolderId())!;
    expect(mission.canPlaceBeacon(holder.instanceId)).toBe(true);
  });

  it("false for anyone who is NOT the current holder", () => {
    const mission = quietMission();
    const bosk = pilot(mission, "pilot_bosk"); // never the holder now — only Rourke can be
    expect(mission.beaconHolderId()).not.toBe(bosk.instanceId);
    expect(mission.canPlaceBeacon(bosk.instanceId)).toBe(false);
  });

  it("false for a hostile even if (nonsensically) passed as the holder id", () => {
    const mission = quietMission();
    const hostile = mission.units.find((u) => u.side === "hostile" && !u.downed)!;
    expect(mission.canPlaceBeacon(hostile.instanceId)).toBe(false);
  });

  it("false while the holder is downed", () => {
    const mission = quietMission();
    const holderId = mission.beaconHolderId()!;
    const holder = mission.units.find((u) => u.instanceId === holderId)!;
    downAlly(mission, holder);
    expect(mission.canPlaceBeacon(holderId)).toBe(false);
  });

  it("false with no actions remaining", () => {
    const mission = quietMission();
    const holder = mission.units.find((u) => u.instanceId === mission.beaconHolderId())!;
    holder.actionsRemaining = 0;
    expect(mission.canPlaceBeacon(holder.instanceId)).toBe(false);
  });

  it.each([
    ["beaconControl", ["restockRoom", "generator"] as ReservedBayId[]],
    ["restockRoom", ["beaconControl", "generator"] as ReservedBayId[]],
    ["generator", ["beaconControl", "restockRoom"] as ReservedBayId[]],
  ])("false when %s alone is missing — all three bays are required", (_missing, builtBays) => {
    const mission = quietMission(builtBays);
    const holder = mission.units.find((u) => u.instanceId === mission.beaconHolderId())!;
    expect(mission.canPlaceBeacon(holder.instanceId)).toBe(false);
  });

  it("false with none of the three bays built at all", () => {
    const mission = quietMission([]);
    const holder = mission.units.find((u) => u.instanceId === mission.beaconHolderId())!;
    expect(mission.canPlaceBeacon(holder.instanceId)).toBe(false);
  });

  it("false once beaconsRemaining (the per-mission cap of 3) hits 0, even with crates/charges to spare", () => {
    const mission = quietMission();
    const holder = mission.units.find((u) => u.instanceId === mission.beaconHolderId())!;
    mission.beaconsRemaining = 0;
    expect(mission.canPlaceBeacon(holder.instanceId)).toBe(false);
  });

  it("false with 0 crates, regardless of charges or beaconsRemaining", () => {
    const mission = quietMission(ALL_BEACON_BAYS, { beaconCratesRemaining: 0, beaconChargesRemaining: 5 });
    const holder = mission.units.find((u) => u.instanceId === mission.beaconHolderId())!;
    expect(mission.canPlaceBeacon(holder.instanceId)).toBe(false);
  });

  it("false with 0 charges and no living Munti on the field", () => {
    const mission = quietMission(ALL_BEACON_BAYS, { beaconCratesRemaining: 5, beaconChargesRemaining: 0 });
    downAlly(mission, pilot(mission, "pilot_lask")); // the squad's only Munti, taken off the field
    const holder = mission.units.find((u) => u.instanceId === mission.beaconHolderId())!;
    expect(mission.canPlaceBeacon(holder.instanceId)).toBe(false);
  });

  it("true with 0 charges as long as a living Munti IS on the field — the discount, not a hard requirement", () => {
    const mission = quietMission(ALL_BEACON_BAYS, { beaconCratesRemaining: 5, beaconChargesRemaining: 0 });
    // pilot_lask (arch_munti_bipedal) is alive by default in quietMission().
    const holder = mission.units.find((u) => u.instanceId === mission.beaconHolderId())!;
    expect(mission.canPlaceBeacon(holder.instanceId)).toBe(true);
  });
});

// =====================================================================
// getBeaconTargetsFrom — downed-ally filtering + the vision+movement range rule
// =====================================================================

describe("Mission.getBeaconTargetsFrom", () => {
  it("empty whenever canPlaceBeacon is false — 'ask the engine, never guess', same contract every other ability follows", () => {
    const mission = quietMission([]); // no bays built -> canPlaceBeacon false
    const holder = mission.units.find((u) => u.instanceId === mission.beaconHolderId())!;
    expect(mission.getBeaconTargetsFrom(holder.instanceId)).toEqual([]);
  });

  it("empty with nobody downed, includes a downed ally adjacent to the holder", () => {
    const mission = quietMission();
    const holder = pilot(mission, "pilot_rourke", { x: 8, y: 5 });
    expect(mission.getBeaconTargetsFrom(holder.instanceId)).toEqual([]);

    const bosk = pilot(mission, "pilot_bosk", { x: 8, y: 6 }); // adjacent, distance 1
    downAlly(mission, bosk);
    const targets = mission.getBeaconTargetsFrom(holder.instanceId);
    expect(targets.map((t) => t.instanceId)).toEqual([bosk.instanceId]);
  });

  it("excludes a living ally and any hostile, downed or not", () => {
    const mission = quietMission();
    const holder = pilot(mission, "pilot_rourke", { x: 8, y: 5 });
    const bosk = pilot(mission, "pilot_bosk", { x: 8, y: 6 }); // living — not a target
    const hostile = mission.units.find((u) => u.side === "hostile" && !u.downed)!;
    hostile.pos = { x: 8, y: 6 };
    hostile.downed = true; // a downed HOSTILE must never show up — side check, not just the downed flag
    const targets = mission.getBeaconTargetsFrom(holder.instanceId);
    expect(targets.some((t) => t.instanceId === bosk.instanceId)).toBe(false);
    expect(targets.some((t) => t.instanceId === hostile.instanceId)).toBe(false);
  });

  it("excludes a downed ally this mission's own live permadeath check already ruled a permanent loss", () => {
    const mission = quietMission();
    const holder = pilot(mission, "pilot_rourke", { x: 8, y: 5 });
    const bosk = pilot(mission, "pilot_bosk", { x: 8, y: 6 });
    downAlly(mission, bosk);
    mission.permanentLosses.push({
      pilotId: "pilot_bosk",
      reason: "no living Munti remains on this side — permanent loss",
      turn: mission.turn,
      turnsWithoutMunti: 0,
      muntisDeployed: 1,
      wasLastMunti: false,
    });
    expect(mission.getBeaconTargetsFrom(holder.instanceId)).toEqual([]);
  });

  it("range rule: a downed ally within vision AND within movement+adjacency of the holder is a valid target (not just literal adjacency)", () => {
    const mission = quietMission();
    // Rourke's own base vision/moveRange (arch_meeps_bipedal) are 4/6, but
    // her mek (Runemaster, WARDEN_MEKS) adds a vision bonus baked in at
    // unit-creation — her actual deployed vision/moveRange here are 6/6,
    // confirmed by inspecting a real constructed unit rather than assumed
    // from the archetype table alone.
    const holder = pilot(mission, "pilot_rourke", { x: 8, y: 4 }); // vision 6, moveRange 6
    // Row y=4 is clear "plain"/"road" the whole way from x=8 to past x=15 —
    // deliberately NOT row y=5, which has a "structure" pair at x=10-11 that
    // would block movement and confound what this test is isolating.
    const anand = pilot(mission, "pilot_anand", { x: 12, y: 4 }); // distance 4 — well within vision, reachable via 3 tiles of movement
    downAlly(mission, anand);
    const targets = mission.getBeaconTargetsFrom(holder.instanceId);
    expect(targets.map((t) => t.instanceId)).toEqual([anand.instanceId]);
  });

  it("range rule: a downed ally just past the holder's vision is excluded even though movement alone could still reach it", () => {
    const mission = quietMission();
    const holder = pilot(mission, "pilot_rourke", { x: 8, y: 4 }); // vision 6, moveRange 6 (see comment above)
    // distance 7 (one past vision 6): still reachable via movement alone —
    // an adjacent tile (e.g. x=14) is only 6 steps from the holder, exactly
    // at moveRange — so this isolates the vision gate specifically, proving
    // beaconTargetInRange checks vision, not just movement+adjacency.
    const anand = pilot(mission, "pilot_anand", { x: 15, y: 4 });
    downAlly(mission, anand);
    expect(mission.getBeaconTargetsFrom(holder.instanceId)).toEqual([]);
  });
});

// =====================================================================
// useBeaconControl — the revive itself, and its crate/charge/Munti costs
// =====================================================================

describe("Mission.useBeaconControl", () => {
  it("fully restores the target, decrements beaconsRemaining and beaconCratesRemaining, decrements beaconChargesRemaining (no Munti on the field), increments beaconRevivesUsed, costs the holder 1 action, does not end their turn", () => {
    const mission = quietMission(ALL_BEACON_BAYS, { beaconCratesRemaining: 3, beaconChargesRemaining: 3 });
    downAlly(mission, pilot(mission, "pilot_lask")); // the only Munti — off the field for this test
    const holder = pilot(mission, "pilot_rourke", { x: 8, y: 5 });
    const bosk = pilot(mission, "pilot_bosk", { x: 8, y: 6 });
    downAlly(mission, bosk);
    const actionsBefore = holder.actionsRemaining;

    expect(mission.useBeaconControl(holder.instanceId, bosk.instanceId)).toBe(true);
    expect(bosk.downed).toBe(false);
    expect(bosk.currentHp).toBe(bosk.maxHp);
    expect(mission.beaconsRemaining).toBe(BEACON_MAX_PER_MISSION - 1);
    expect(mission.beaconCratesRemaining).toBe(2);
    expect(mission.beaconChargesRemaining).toBe(2); // spent — no living Munti
    expect(mission.beaconRevivesUsed).toBe(1);
    expect(holder.actionsRemaining).toBe(actionsBefore - 1);
    expect(mission.phase).toBe("player"); // never ends the turn
    expect(logsMatching(mission, "drops a beacon").length).toBe(1);
    expect(logsMatching(mission, "waives the Restock Room charge").length).toBe(0);
  });

  it("with a living Munti on the field, the charge is fully waived — crate is still spent either way", () => {
    const mission = quietMission(ALL_BEACON_BAYS, { beaconCratesRemaining: 3, beaconChargesRemaining: 3 });
    // pilot_lask (the Munti) stays alive and deployed for this one.
    const holder = pilot(mission, "pilot_rourke", { x: 8, y: 5 });
    const bosk = pilot(mission, "pilot_bosk", { x: 8, y: 6 });
    downAlly(mission, bosk);

    expect(mission.useBeaconControl(holder.instanceId, bosk.instanceId)).toBe(true);
    expect(mission.beaconCratesRemaining).toBe(2); // still spent
    expect(mission.beaconChargesRemaining).toBe(3); // untouched — waived
    expect(logsMatching(mission, "waives the Restock Room charge").length).toBe(1);
  });

  it("refuses and changes nothing for a target not on the (range-filtered) target list", () => {
    const mission = quietMission();
    const holder = pilot(mission, "pilot_rourke", { x: 8, y: 5 });
    const bosk = pilot(mission, "pilot_bosk", { x: 8, y: 6 }); // alive — not a valid target
    const actionsBefore = holder.actionsRemaining;
    const cratesBefore = mission.beaconCratesRemaining;

    expect(mission.useBeaconControl(holder.instanceId, bosk.instanceId)).toBe(false);
    expect(holder.actionsRemaining).toBe(actionsBefore);
    expect(mission.beaconCratesRemaining).toBe(cratesBefore);
    expect(mission.beaconRevivesUsed).toBe(0);
  });

  it("caps at BEACON_MAX_PER_MISSION uses per mission even with crates/charges to spare", () => {
    const mission = quietMission(ALL_BEACON_BAYS, { beaconCratesRemaining: 10, beaconChargesRemaining: 10 });
    const holder = pilot(mission, "pilot_rourke", { x: 8, y: 5 });
    const targets = ["pilot_bosk", "pilot_iyari", "pilot_anand", "pilot_lask"];
    expect(targets.length).toBeGreaterThan(BEACON_MAX_PER_MISSION);

    let used = 0;
    for (const pid of targets) {
      const t = pilot(mission, pid, { x: 8, y: 6 });
      downAlly(mission, t);
      holder.actionsRemaining = MAX_ACTIONS_PER_TURN;
      const ok = mission.useBeaconControl(holder.instanceId, t.instanceId);
      if (ok) used += 1;
    }
    expect(used).toBe(BEACON_MAX_PER_MISSION);
    expect(mission.beaconsRemaining).toBe(0);
    expect(mission.beaconRevivesUsed).toBe(BEACON_MAX_PER_MISSION);
    expect(mission.canPlaceBeacon(holder.instanceId)).toBe(false);
  });
});

// =====================================================================
// campaignEconomy.ts — the shop purchases, Debrief stock write-back, and
// the payout-percentage revive tax
// =====================================================================

describe("purchaseBeaconCrate / purchaseBeaconCharge", () => {
  it("deducts the full price and adds one to the stockpile without a Fabricator built", () => {
    const state = createWardenCampaignState(200);
    const result = purchaseBeaconCrate(state);
    expect(result.ok).toBe(true);
    expect(result.cost).toBe(BEACON_CRATE_COST);
    expect(state.points).toBe(200 - BEACON_CRATE_COST);
    expect(state.beaconCrates).toBe(BEACON_STARTING_CRATES + 1);
  });

  it("purchaseBeaconCharge charges the full (non-discounted) price without a Fabricator built", () => {
    const state = createWardenCampaignState(200);
    const result = purchaseBeaconCharge(state);
    expect(result.ok).toBe(true);
    expect(result.cost).toBe(BEACON_CHARGE_COST);
    expect(state.points).toBe(200 - BEACON_CHARGE_COST);
    expect(state.beaconCharges).toBe(BEACON_STARTING_CHARGES + 1);
  });

  it("charges the discounted price for both crate and charge once the Fabricator bay is built", () => {
    const state = createWardenCampaignState(200);
    state.builtBays = ["fabricator"];
    const crateResult = purchaseBeaconCrate(state);
    expect(crateResult.ok).toBe(true);
    expect(crateResult.cost).toBe(BEACON_CRATE_COST_DISCOUNTED);
    const chargeResult = purchaseBeaconCharge(state);
    expect(chargeResult.ok).toBe(true);
    expect(chargeResult.cost).toBe(BEACON_CHARGE_COST_DISCOUNTED);
    expect(state.points).toBe(200 - BEACON_CRATE_COST_DISCOUNTED - BEACON_CHARGE_COST_DISCOUNTED);
  });

  it("refuses cleanly, changing nothing, when the company can't afford it", () => {
    const state = createWardenCampaignState(10); // less than BEACON_CRATE_COST
    const before = state.beaconCrates;
    const result = purchaseBeaconCrate(state);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not enough company points/);
    expect(state.points).toBe(10);
    expect(state.beaconCrates).toBe(before);
  });

  it("accumulates across repeated purchases rather than overwriting", () => {
    const state = createWardenCampaignState(1000);
    const startingCrates = state.beaconCrates ?? 0;
    purchaseBeaconCrate(state);
    purchaseBeaconCrate(state);
    expect(state.beaconCrates).toBe(startingCrates + 2);
  });
});

describe("applyBeaconStockConsumption", () => {
  it("writes the mission's ending crate/charge counts back onto the persistent CampaignState", () => {
    const state = createWardenCampaignState();
    state.beaconCrates = 5;
    state.beaconCharges = 5;
    const mission = quietMission(ALL_BEACON_BAYS, { beaconCratesRemaining: 5, beaconChargesRemaining: 5 });
    downAlly(mission, pilot(mission, "pilot_lask")); // no Munti, so the charge actually gets spent
    const holder = pilot(mission, "pilot_rourke", { x: 8, y: 5 });
    const bosk = pilot(mission, "pilot_bosk", { x: 8, y: 6 });
    downAlly(mission, bosk);
    mission.useBeaconControl(holder.instanceId, bosk.instanceId);

    applyBeaconStockConsumption(state, mission);
    expect(state.beaconCrates).toBe(4);
    expect(state.beaconCharges).toBe(4);
  });

  it("is a safe no-op (just rewrites the same starting numbers) on a mission that never touched Beacon Control", () => {
    const state = createWardenCampaignState();
    state.beaconCrates = 2;
    state.beaconCharges = 2;
    const mission = quietMission(ALL_BEACON_BAYS, { beaconCratesRemaining: 2, beaconChargesRemaining: 2 });
    applyBeaconStockConsumption(state, mission);
    expect(state.beaconCrates).toBe(2);
    expect(state.beaconCharges).toBe(2);
  });
});

describe("applyBeaconReviveCosts", () => {
  it("is 0 when no beacon was used this mission, even on a win", () => {
    const mission = quietMission();
    mission.outcome = "win";
    const state = createWardenCampaignState(500);
    const cost = applyBeaconReviveCosts(state, mission);
    expect(cost).toBe(0);
    expect(state.points).toBe(500);
  });

  it("is 0 on a loss, even with revives used — computeMissionCompletionBonus is entirely win-gated, so there's no payout to tax", () => {
    const mission = quietMission();
    mission.beaconRevivesUsed = 2;
    mission.outcome = "loss";
    const state = createWardenCampaignState(500);
    const cost = applyBeaconReviveCosts(state, mission);
    expect(cost).toBe(0);
    expect(state.points).toBe(500);
  });

  it("deducts BEACON_REVIVE_PAYOUT_PERCENT of the completion bonus PER revive used, rounded", () => {
    const mission = quietMission(); // AMARANTH_MISSION_1: rewardPoints 100, turnLimit 8
    mission.outcome = "win";
    mission.turn = 3; // 5 turns under the limit
    mission.beaconRevivesUsed = 1;
    const state = createWardenCampaignState(1000);

    const payout = computeMissionCompletionBonus(mission).total;
    const expectedCost = Math.round(payout * BEACON_REVIVE_PAYOUT_PERCENT);
    const cost = applyBeaconReviveCosts(state, mission);
    expect(cost).toBe(expectedCost);
    expect(state.points).toBe(1000 - expectedCost);
  });

  it("scales linearly with the number of revives used in the same mission", () => {
    const mission = quietMission();
    mission.outcome = "win";
    mission.turn = 3;
    mission.beaconRevivesUsed = 3;
    const state = createWardenCampaignState(1000);

    const payout = computeMissionCompletionBonus(mission).total;
    const expectedCost = Math.round(payout * BEACON_REVIVE_PAYOUT_PERCENT * 3);
    expect(applyBeaconReviveCosts(state, mission)).toBe(expectedCost);
  });

  it("clamps at 0 rather than pushing state.points negative", () => {
    const mission = quietMission();
    mission.outcome = "win";
    mission.turn = 3;
    mission.beaconRevivesUsed = 3;
    const state = createWardenCampaignState(1); // nowhere near enough to cover the tax
    applyBeaconReviveCosts(state, mission);
    expect(state.points).toBe(0);
  });
});
