// Frame Systems Layer, Tier 1 (6 Sep 2026) — the engine side of
// data/frameSystems.ts: the second mount, the Draw budget, the purchase and
// equip verbs, the additive stat term in createPlayerUnit, and every
// system/refit effect that reaches the combat resolver, the mover, the
// visibility check, and the environment tick.
//
// House test style, two flavours side by side (see scattershotPistols.test.ts
// / muntiRegen.test.ts): synthetic testUnit()s on a uniform map for the pure
// resolver checks, and real Mission objects (MISSION_1A, hostiles
// neutralised) for anything that needs a turn to actually pass. Every
// combat check below asserts the no-op baseline right next to the effect,
// because "1 when absent" is the property that keeps sim_output.txt
// byte-identical — the effect tests and the no-op tests are the same test.
import { describe, it, expect } from "vitest";
import { Mission } from "../mission";
import { MISSION_1A } from "../../data/campaign";
import { createPlayerUnit, createBloomUnit, type BattleUnit } from "../units";
import { findPilot, findMek } from "../../data/pilotRegistry";
import { resolveMechAttack, resolveAttackOnBloom, overshieldBonus, tankShieldEligible } from "../combat";
import { isVisibleTo } from "../ai";
import { makeUniformMap, testUnit } from "./testHelpers";
import { moveCost, reachableTiles } from "../grid";
import { createWardenCampaignState, recordHostileKills, hostileKillCount, type CampaignState } from "../campaignState";
import {
  equipWeaponBranch,
  unequipWeaponBranch,
  purchaseFrameSystem,
  equipFrameSystem,
  unequipFrameSystem,
  purchaseFrameRefit,
  frameSystemAvailability,
  campaignCanSupplyArchetype,
} from "../campaignEconomy";
import {
  equippedWeaponBranchesOf,
  setEquippedWeaponBranches,
  mountsFor,
  drawCapacityFor,
  equippedFrameSystemsWithinDraw,
  frameDrawUsed,
  frameStatBonus,
  mergedAttackRange,
  movementKindOf,
  movementKindForUnit,
  repairRangeFor,
  regenAurasFor,
  unitHasBranch,
  unitBranches,
  defenseIgnoreFraction,
} from "../frameSystems";
import {
  FRAME_SYSTEMS,
  FRAME_SYSTEM_IDS,
  FRAME_REFIT_COST,
  FRAME_TIER_CAPACITY,
  SPALL_LINER_COUNTER_DAMAGE_MULT,
  FOCUSING_OPTICS_ATK_BONUS,
  SHREDDER_ROUNDS_DEF_IGNORE_PCT,
  OVERPRESSURE_REGULATOR_FIRST_ATTACK_MULT,
  BLOOMWALKERS_MAT_MOVE_COST,
  SEISMIC_TAP_DETECT_RADIUS,
  SALVE_DRONE_REGEN_PER_TURN,
  WELLROOT_FILAMENT_MAT_REGEN,
  frameSystemPointCost,
  SALVAGE_NON_RUNEMASTER_DRAW_SURCHARGE,
} from "../../data/frameSystems";
import { IMPACT_LANCE_ATK_BONUS, SCATTERSHOT_PISTOLS_ATTACK_RANGE, RAIL_LANCE_DEF_IGNORE_PCT, DEFAULT_REPAIR_RANGE, RAPID_RESPONSE_REPAIR_RANGE, MASER_LANCE_GRANT_ABILITY } from "../../data/weaponBranches";
import { TILES } from "../../data/tiles";
import { MUNTI_REGEN_PER_TURN, TIERS, CENTAUROID_CHARGE_MULT } from "../../data/combatTables";
import type { PilotRecord } from "../../data/types";

// ---- fixtures ----------------------------------------------------------------

/** A fresh Warden save with `pilotId` bumped to `tier` and handed `points` — the campaign-side fixture every economy test below starts from. */
function stateWith(pilotId: string, tier: PilotRecord["tier"], points: number): CampaignState {
  const state = createWardenCampaignState();
  state.pilots[pilotId].pilot.tier = tier;
  state.pilots[pilotId].personalPoints = points;
  return state;
}

/** Same neutralisation as muntiRegen.test.ts — keep one harmless hostile so eliminate_all can't end the mission before environmentStep runs. */
function quiet(): Mission {
  const mission = new Mission(MISSION_1A);
  const hostiles = mission.units.filter((u) => u.side === "hostile" && !u.downed);
  const [keep, ...rest] = hostiles;
  for (const u of rest) u.downed = true;
  if (keep) {
    keep.moveRange = 0;
    keep.attackRange = [99, 99];
    keep.pos = { x: 0, y: 0 };
  }
  for (const u of mission.units) if (u.side === "player") u.pos = { x: 17, y: 11 }; // park the squad in a corner, off any hazard tile
  return mission;
}

/** Mission 1a's scripted turn-4 ambush spawns fresh hostiles — re-neutralise before every turn that has to pass quietly (same trick muntiRegen.test.ts uses). */
function endQuietTurn(mission: Mission): void {
  const hostiles = mission.units.filter((u) => u.side === "hostile" && !u.downed);
  const [keep, ...rest] = hostiles;
  for (const u of rest) u.downed = true;
  if (keep) {
    keep.moveRange = 0;
    keep.attackRange = [99, 99];
    keep.pos = { x: 0, y: 0 };
  }
  mission.endPlayerTurn();
}

/** A hostile that can soak any number of test attacks without the mission ending on eliminate_all. */
function punchingBag(mission: Mission, pos: { x: number; y: number }): BattleUnit {
  const target = mission.units.find((u) => u.side === "hostile" && !u.downed)!;
  target.pos = { ...pos };
  target.maxHp = 100000;
  target.currentHp = 100000;
  if (target.endurance !== undefined) {
    target.endurance = 100000;
    target.maxEndurance = 100000;
    target.vitality = 100000;
  }
  return target;
}

/** Flatten a rectangle of the mission's own (deep-copied) map to open road so a movement test isn't hostage to the real map's walls. */
function flatten(mission: Mission, x0: number, y0: number, x1: number, y1: number): void {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) mission.map.tiles[y][x] = "road";
}

function unit(mission: Mission, pilotId: string, pos?: { x: number; y: number }): BattleUnit {
  const u = mission.units.find((x) => x.pilotId === pilotId)!;
  if (pos) u.pos = { ...pos };
  return u;
}

// ---- campaign-record reads ------------------------------------------------------

describe("equippedWeaponBranchesOf — the one read path", () => {
  const base = findPilot("pilot_iyari")!;
  it("reads a pre-6-Sep save's single field as a one-element list", () => {
    expect(equippedWeaponBranchesOf({ ...base, equippedWeaponBranch: "meeps_impact_lance" })).toEqual(["meeps_impact_lance"]);
  });
  it("prefers the list when present, dedupes, and drops ids that aren't real branches", () => {
    expect(
      equippedWeaponBranchesOf({ ...base, equippedWeaponBranch: "meeps_impact_lance", equippedWeaponBranches: ["meeps_shock_claws", "meeps_shock_claws", "not_a_branch"] })
    ).toEqual(["meeps_shock_claws"]);
  });
  it("reads neither field as the plain default weapon", () => {
    expect(equippedWeaponBranchesOf({ ...base })).toEqual([]);
  });
  it("setEquippedWeaponBranches mirrors mount 1 into the legacy field", () => {
    const p: PilotRecord = { ...base };
    setEquippedWeaponBranches(p, ["meeps_shock_claws", "meeps_impact_lance"]);
    expect(p.equippedWeaponBranches).toEqual(["meeps_shock_claws", "meeps_impact_lance"]);
    expect(p.equippedWeaponBranch).toBe("meeps_shock_claws");
    setEquippedWeaponBranches(p, []);
    expect(p.equippedWeaponBranch).toBeUndefined();
  });
});

describe("second mount — equipWeaponBranch / unequipWeaponBranch", () => {
  function ownAll(state: CampaignState, pilotId: string) {
    state.pilots[pilotId].pilot.ownedWeaponBranches = ["meeps_impact_lance", "meeps_scattershot_pistols", "meeps_shock_claws"];
  }

  it("below tier C a frame has one mount and a new branch REPLACES it (the pre-6-Sep one-click swap)", () => {
    const state = stateWith("pilot_iyari", "D", 0);
    ownAll(state, "pilot_iyari");
    expect(mountsFor(state.pilots.pilot_iyari.pilot)).toBe(1);
    expect(equipWeaponBranch(state, "pilot_iyari", "meeps_impact_lance").ok).toBe(true);
    const r = equipWeaponBranch(state, "pilot_iyari", "meeps_shock_claws");
    expect(r.ok).toBe(true);
    expect(r.equippedAll).toEqual(["meeps_shock_claws"]);
    expect(r.equipped).toBe("meeps_shock_claws");
    expect(state.pilots.pilot_iyari.pilot.equippedWeaponBranch).toBe("meeps_shock_claws");
  });

  it("from tier C two branches fit; a third is refused with a reason rather than guessing which to drop", () => {
    const state = stateWith("pilot_iyari", "C", 0);
    ownAll(state, "pilot_iyari");
    expect(mountsFor(state.pilots.pilot_iyari.pilot)).toBe(2);
    expect(equipWeaponBranch(state, "pilot_iyari", "meeps_impact_lance").ok).toBe(true);
    expect(equipWeaponBranch(state, "pilot_iyari", "meeps_scattershot_pistols").equippedAll).toEqual(["meeps_impact_lance", "meeps_scattershot_pistols"]);
    const third = equipWeaponBranch(state, "pilot_iyari", "meeps_shock_claws");
    expect(third.ok).toBe(false);
    expect(third.reason).toMatch(/mounts are full/);
    expect(equippedWeaponBranchesOf(state.pilots.pilot_iyari.pilot)).toEqual(["meeps_impact_lance", "meeps_scattershot_pistols"]);
  });

  it("unequipping one mount keeps the other and moves it up to mount 1; equipping an already-equipped branch is a no-op", () => {
    const state = stateWith("pilot_iyari", "C", 0);
    ownAll(state, "pilot_iyari");
    equipWeaponBranch(state, "pilot_iyari", "meeps_impact_lance");
    equipWeaponBranch(state, "pilot_iyari", "meeps_scattershot_pistols");
    expect(equipWeaponBranch(state, "pilot_iyari", "meeps_impact_lance").equippedAll).toEqual(["meeps_impact_lance", "meeps_scattershot_pistols"]);
    const r = unequipWeaponBranch(state, "pilot_iyari", "meeps_impact_lance");
    expect(r.equippedAll).toEqual(["meeps_scattershot_pistols"]);
    expect(state.pilots.pilot_iyari.pilot.equippedWeaponBranch).toBe("meeps_scattershot_pistols");
    expect(equipWeaponBranch(state, "pilot_iyari", null).equippedAll).toEqual([]);
  });

  it("still refuses a branch the pilot doesn't own", () => {
    const state = stateWith("pilot_iyari", "C", 0);
    expect(equipWeaponBranch(state, "pilot_iyari", "meeps_shock_claws").ok).toBe(false);
  });
});

describe("createPlayerUnit — two branches live at once", () => {
  it("stacks Impact Lance's ATK with Scattershot's range window, grants from every mount, and keeps weaponBranchId as mount 1", () => {
    const base = findPilot("pilot_iyari")!;
    const two: PilotRecord = { ...base, tier: "C", equippedWeaponBranches: ["meeps_impact_lance", "meeps_scattershot_pistols"] };
    const u = createPlayerUnit("pilot_iyari", { x: 0, y: 0 }, { pilot: two });
    const one = createPlayerUnit("pilot_iyari", { x: 0, y: 0 }, { pilot: { ...base, tier: "C" } });
    expect(u.effectiveAttack).toBe(one.effectiveAttack + IMPACT_LANCE_ATK_BONUS);
    expect(u.attackRange).toEqual([SCATTERSHOT_PISTOLS_ATTACK_RANGE[0], SCATTERSHOT_PISTOLS_ATTACK_RANGE[1]]);
    expect(u.weaponBranchId).toBe("meeps_impact_lance");
    expect(u.weaponBranchIds).toEqual(["meeps_impact_lance", "meeps_scattershot_pistols"]);
    expect(unitHasBranch(u, "meeps_scattershot_pistols")).toBe(true);
    expect(unitBranches(one)).toEqual([]);
  });

  it("a Tank with Grinder Claw AND Maser Lance gets the Maser Lance ability on top of the archetype's own", () => {
    const base = findPilot("pilot_bosk")!;
    const u = createPlayerUnit("pilot_bosk", { x: 0, y: 0 }, { pilot: { ...base, tier: "C", equippedWeaponBranches: ["tank_grinder_claw", "tank_maser_lance"] } });
    expect(u.abilities).toContain(MASER_LANCE_GRANT_ABILITY);
    expect(u.abilities).toContain("abil_overshield");
    expect(unitHasBranch(u, "tank_grinder_claw")).toBe(true);
  });

  it("a synthetic unit with only the legacy single field still answers unitHasBranch", () => {
    const u = testUnit("munti");
    u.weaponBranchId = "munti_rapid_response";
    expect(unitHasBranch(u, "munti_rapid_response")).toBe(true);
    expect(repairRangeFor(u)).toBe(RAPID_RESPONSE_REPAIR_RANGE);
  });
});

// ---- Draw budget + systems economy -------------------------------------------

describe("Draw budget — equipFrameSystem / equippedFrameSystemsWithinDraw", () => {
  function own(state: CampaignState, pilotId: string, ids: string[]) {
    state.pilots[pilotId].pilot.ownedFrameSystems = ids;
  }

  it("fills up to the tier's Draw and refuses the system that wouldn't fit, with the numbers in the reason", () => {
    const state = stateWith("pilot_bosk", "G", 0); // Draw 2
    own(state, "pilot_bosk", ["frame_spall_liner", "sensor_signal_booster", "frame_reinforced_plating"]);
    expect(drawCapacityFor(state.pilots.pilot_bosk.pilot)).toBe(FRAME_TIER_CAPACITY.G.draw);
    expect(equipFrameSystem(state, "pilot_bosk", "frame_spall_liner").ok).toBe(true); // 1
    expect(equipFrameSystem(state, "pilot_bosk", "sensor_signal_booster").ok).toBe(true); // 2
    const over = equipFrameSystem(state, "pilot_bosk", "frame_reinforced_plating"); // +2 = 4 > 2
    expect(over.ok).toBe(false);
    expect(over.reason).toMatch(/needs 2 Draw/);
    expect(over.drawUsed).toBe(2);
    expect(over.drawCapacity).toBe(2);
    expect(unequipFrameSystem(state, "pilot_bosk", "sensor_signal_booster").equipped).toEqual(["frame_spall_liner"]);
    expect(equipFrameSystem(state, "pilot_bosk", "frame_reinforced_plating").ok).toBe(false); // still 1 + 2 = 3 > 2
  });

  it("refuses a system the pilot doesn't own and no-ops on one already equipped", () => {
    const state = stateWith("pilot_bosk", "A", 0);
    expect(equipFrameSystem(state, "pilot_bosk", "drive_sprint_cell").ok).toBe(false);
    own(state, "pilot_bosk", ["drive_sprint_cell"]);
    expect(equipFrameSystem(state, "pilot_bosk", "drive_sprint_cell").ok).toBe(true);
    expect(equipFrameSystem(state, "pilot_bosk", "drive_sprint_cell").equipped).toEqual(["drive_sprint_cell"]);
  });

  it("charges a salvage system the +1 Draw surcharge on a non-Runemaster loadout, and not on a Runemaster one", () => {
    // Bosk's mek is armorer; Rourke's is runemaster (data/campaignAmaranth.ts)
    const state = stateWith("pilot_bosk", "G", 0);
    state.pilots.pilot_rourke.pilot.tier = "G";
    own(state, "pilot_bosk", ["salvage_wellroot_filament"]);
    own(state, "pilot_rourke", ["salvage_wellroot_filament"]);
    const draw = FRAME_SYSTEMS.salvage_wellroot_filament.draw; // 2
    // Bosk: 2 + 1 surcharge = 3 > G's 2 -> refused
    const bosk = equipFrameSystem(state, "pilot_bosk", "salvage_wellroot_filament");
    expect(bosk.ok).toBe(false);
    expect(bosk.reason).toMatch(new RegExp(`needs ${draw + SALVAGE_NON_RUNEMASTER_DRAW_SURCHARGE} Draw`));
    // Rourke: 2 fits G's 2 exactly
    const rourke = equipFrameSystem(state, "pilot_rourke", "salvage_wellroot_filament");
    expect(rourke.ok).toBe(true);
    expect(rourke.drawUsed).toBe(draw);
  });

  it("re-bounds the installed list at deploy so a smaller budget benches systems in equip order rather than overfilling", () => {
    const state = stateWith("pilot_bosk", "A", 0); // Draw 10
    own(state, "pilot_bosk", ["ordnance_overpressure_regulator", "frame_reinforced_plating", "drive_sprint_cell"]);
    for (const id of ["ordnance_overpressure_regulator", "frame_reinforced_plating", "drive_sprint_cell"] as const) {
      expect(equipFrameSystem(state, "pilot_bosk", id).ok).toBe(true);
    }
    const p = state.pilots.pilot_bosk.pilot;
    const mek = state.meks[p.mekId];
    expect(frameDrawUsed(p, mek)).toBe(7);
    // Simulate a retune that shrank the budget: the pilot is somehow at D (Draw 5).
    p.tier = "D";
    expect(equippedFrameSystemsWithinDraw(p, mek)).toEqual(["ordnance_overpressure_regulator", "frame_reinforced_plating"]); // 3 + 2 = 5; the 2-Draw Sprint Cell is benched
    const u = createPlayerUnit("pilot_bosk", { x: 0, y: 0 }, { pilot: p, mek });
    expect(u.frameSystemIds).toEqual(["ordnance_overpressure_regulator", "frame_reinforced_plating"]);
  });
});

describe("purchaseFrameSystem / frameSystemAvailability", () => {
  it("buys a Foundry system for Draw x points-per-Draw, once, and refuses when short", () => {
    const def = FRAME_SYSTEMS.frame_reinforced_plating;
    const cost = frameSystemPointCost(def);
    const state = stateWith("pilot_bosk", "G", cost - 1);
    expect(purchaseFrameSystem(state, "pilot_bosk", def.id).ok).toBe(false);
    state.pilots.pilot_bosk.personalPoints = cost;
    const r = purchaseFrameSystem(state, "pilot_bosk", def.id);
    expect(r).toEqual({ ok: true, systemId: def.id, cost });
    expect(state.pilots.pilot_bosk.personalPoints).toBe(0);
    expect(state.pilots.pilot_bosk.pilot.ownedFrameSystems).toEqual([def.id]);
    const again = purchaseFrameSystem(state, "pilot_bosk", def.id);
    expect(again.ok).toBe(false);
    expect(again.reason).toMatch(/already owns/);
  });

  it("has no tier gate — a G-tier pilot can own a 3-Draw system they can't yet field", () => {
    const state = stateWith("pilot_bosk", "G", 9999);
    expect(purchaseFrameSystem(state, "pilot_bosk", "ordnance_overpressure_regulator").ok).toBe(true);
    expect(equipFrameSystem(state, "pilot_bosk", "ordnance_overpressure_regulator").ok).toBe(false); // 3 > 2
  });

  it("gates a salvage system on the company's kills of its source archetype, reads the count into the reason, and opens once the kill lands", () => {
    const state = stateWith("pilot_bosk", "A", 9999);
    const locked = purchaseFrameSystem(state, "pilot_bosk", "salvage_wellroot_filament");
    expect(locked.ok).toBe(false);
    expect(locked.reason).toMatch(/needs 1 The Wellroot kill \(have 0\)/);
    expect(frameSystemAvailability(state, "pilot_bosk", "salvage_wellroot_filament").salvageLocked).toEqual({
      archetypeId: "bloom_wellroot",
      archetypeName: "The Wellroot",
      needed: 1,
      have: 0,
    });
    recordHostileKills(state, { bloom_wellroot: 1, bloom_crawlmass: 4 });
    expect(hostileKillCount(state, "bloom_wellroot")).toBe(1);
    expect(frameSystemAvailability(state, "pilot_bosk", "salvage_wellroot_filament").salvageLocked).toBeUndefined();
    expect(purchaseFrameSystem(state, "pilot_bosk", "salvage_wellroot_filament").ok).toBe(true);
  });

  it("the hide rule: a salvage system whose source archetype never spawns in this campaign is hidden — nothing shipped trips it since Heartwood Graft became Gallcyst Graft (6 Sep 2026), so the rule is pinned through campaignCanSupplyArchetype", () => {
    const state = stateWith("pilot_bosk", "A", 9999);
    // The archetype the doc's original Heartwood Graft was sourced from never spawns in Warden Company; Gallcyst and Wellroot do.
    expect(campaignCanSupplyArchetype(state, "bloom_heartwood")).toBe(false);
    expect(campaignCanSupplyArchetype(state, "bloom_gallcyst")).toBe(true);
    expect(campaignCanSupplyArchetype(state, "bloom_wellroot")).toBe(true);
    for (const id of FRAME_SYSTEM_IDS) expect(frameSystemAvailability(state, "pilot_bosk", id).hidden).toBe(false);
    // And the re-sourced graft is a real, unlockable lock now, not a hidden one.
    expect(frameSystemAvailability(state, "pilot_bosk", "salvage_gallcyst_graft").salvageLocked).toEqual({
      archetypeId: "bloom_gallcyst",
      archetypeName: "Gallcyst",
      needed: 1,
      have: 0,
    });
  });

  it("recordHostileKills accumulates across debriefs, ignores zeros, and survives a save with no counter", () => {
    const state = createWardenCampaignState();
    expect(hostileKillCount(state, "bloom_wellroot")).toBe(0);
    recordHostileKills(state, { bloom_crawlmass: 2, bloom_splitfang: 0 });
    recordHostileKills(state, { bloom_crawlmass: 3 });
    expect(state.hostileKillsByArchetype).toEqual({ bloom_crawlmass: 5 });
  });
});

describe("purchaseFrameRefit", () => {
  it("needs tier A (S qualifies), the pilot's own path, enough points, and is permanent", () => {
    const state = stateWith("pilot_bosk", "B", FRAME_REFIT_COST);
    const early = purchaseFrameRefit(state, "pilot_bosk", "refit_tank_bastion");
    expect(early.ok).toBe(false);
    expect(early.reason).toMatch(/needs tier A/);
    state.pilots.pilot_bosk.pilot.tier = "A";
    expect(purchaseFrameRefit(state, "pilot_bosk", "refit_meeps_breacher_frame").ok).toBe(false); // wrong path
    state.pilots.pilot_bosk.personalPoints = FRAME_REFIT_COST - 1;
    expect(purchaseFrameRefit(state, "pilot_bosk", "refit_tank_bastion").ok).toBe(false);
    state.pilots.pilot_bosk.personalPoints = FRAME_REFIT_COST;
    expect(purchaseFrameRefit(state, "pilot_bosk", "refit_tank_bastion")).toEqual({ ok: true, refitId: "refit_tank_bastion", cost: FRAME_REFIT_COST });
    expect(state.pilots.pilot_bosk.pilot.frameRefit).toBe("refit_tank_bastion");
    state.pilots.pilot_bosk.personalPoints = FRAME_REFIT_COST;
    const second = purchaseFrameRefit(state, "pilot_bosk", "refit_tank_ram_frame");
    expect(second.ok).toBe(false);
    expect(second.reason).toMatch(/already refitted/);
    // S-tier qualifies
    const s = stateWith("pilot_bosk", "S", FRAME_REFIT_COST);
    expect(purchaseFrameRefit(s, "pilot_bosk", "refit_tank_ram_frame").ok).toBe(true);
  });
});

// ---- the stat term --------------------------------------------------------------

describe("frameStatBonus + createPlayerUnit — the additive term", () => {
  it("sums systems and the refit into every stat line, and reads 0 with nothing installed", () => {
    expect(frameStatBonus([], undefined)).toEqual({ attack: 0, defense: 0, hp: 0, vision: 0, move: 0 });
    expect(frameStatBonus(["frame_reinforced_plating", "drive_sprint_cell", "sensor_signal_booster", "salvage_gallcyst_graft"], "refit_meeps_breacher_frame")).toEqual({
      attack: 12,
      defense: 6,
      hp: 20,
      vision: 1,
      move: -1 + 1 - 1 - 1,
    });
  });

  it("lands on the BattleUnit after tier and mek, exactly one term per line", () => {
    const base = findPilot("pilot_bosk")!;
    const mek = findMek(base.mekId);
    const plain = createPlayerUnit("pilot_bosk", { x: 0, y: 0 }, { pilot: { ...base, tier: "A" }, mek });
    const kitted: PilotRecord = {
      ...base,
      tier: "A",
      ownedFrameSystems: ["frame_reinforced_plating", "sensor_signal_booster", "salvage_gallcyst_graft"],
      equippedFrameSystems: ["frame_reinforced_plating", "sensor_signal_booster", "salvage_gallcyst_graft"],
      frameRefit: "refit_tank_bastion",
    };
    const u = createPlayerUnit("pilot_bosk", { x: 0, y: 0 }, { pilot: kitted, mek });
    expect(u.effectiveDefense).toBe(plain.effectiveDefense + 6);
    expect(u.maxHp).toBe(plain.maxHp + 20);
    expect(u.vision).toBe(plain.vision + 1);
    expect(u.moveRange).toBe(plain.moveRange - 1 - 1 - 1); // plating, graft, bastion
    expect(u.frameSystemIds).toEqual(["frame_reinforced_plating", "sensor_signal_booster", "salvage_gallcyst_graft"]); // 2 + 1 + 4 (salvage surcharge, armorer mek) = 7 <= A's 10
    expect(u.frameRefitId).toBe("refit_tank_bastion");
    expect(TIERS.A.move).toBe(2); // sanity on the fixture: A-tier Tank has 3 + 2 = 5 move before the three -1s
    expect(plain.moveRange).toBe(5);
  });

  it("floors move at 1 rather than stranding a pilot on the pad", () => {
    const base = findPilot("pilot_bosk")!; // Tank, 3 base move, G tier +0
    const u = createPlayerUnit("pilot_bosk", { x: 0, y: 0 }, {
      pilot: {
        ...base,
        tier: "A",
        ownedFrameSystems: ["frame_reinforced_plating", "salvage_gallcyst_graft", "frame_spall_liner"],
        equippedFrameSystems: ["frame_reinforced_plating", "salvage_gallcyst_graft", "frame_spall_liner"],
        frameRefit: "refit_tank_bastion",
      },
      mek: findMek(base.mekId),
    });
    // A: 3 + 2 = 5, then -1 -1 -1 = 2; not floored here — assert the arithmetic, then force the floor
    expect(u.moveRange).toBe(2);
    const floored = createPlayerUnit("pilot_bosk", { x: 0, y: 0 }, {
      pilot: { ...base, tier: "G", ownedFrameSystems: ["frame_reinforced_plating"], equippedFrameSystems: ["frame_reinforced_plating"] },
    });
    expect(floored.moveRange).toBe(2); // G: 3 - 1 = 2, fine
    const bottom = createPlayerUnit("pilot_bosk", { x: 0, y: 0 }, {
      pilot: { ...base, tier: "F", ownedFrameSystems: ["frame_reinforced_plating", "salvage_gallcyst_graft"], equippedFrameSystems: ["frame_reinforced_plating", "salvage_gallcyst_graft"] },
      mek: { id: "m", displayName: "m", primary: "runemaster", secondary: null, spareParts: 0 }, // runemaster so the graft costs 3, plating 2 -> 5 > F's 3, graft benched
    });
    expect(bottom.frameSystemIds).toEqual(["frame_reinforced_plating"]);
    expect(bottom.moveRange).toBe(2);
  });

  it("a refit's attack window replaces the archetype's, and a branch's window merges on top by widest", () => {
    expect(mergedAttackRange([2, 4], [])).toEqual([2, 4]);
    expect(mergedAttackRange([2, 3], [undefined])).toEqual([2, 3]);
    expect(mergedAttackRange([1, 1], [[1, 2]])).toEqual([1, 2]);
    const anand = findPilot("pilot_anand")!; // Reeps
    const battery = createPlayerUnit("pilot_anand", { x: 0, y: 0 }, { pilot: { ...anand, tier: "A", frameRefit: "refit_reeps_battery_frame" } });
    expect(battery.attackRange).toEqual([2, 5]);
    const skirmish = createPlayerUnit("pilot_anand", { x: 0, y: 0 }, { pilot: { ...anand, tier: "A", frameRefit: "refit_reeps_skirmish_battery", equippedWeaponBranches: ["reeps_missiles"] } });
    expect(skirmish.attackRange).toEqual([2, 3]); // Missiles sets no window of its own, so it can't re-widen the refit's
    expect(skirmish.moveRange).toBe(createPlayerUnit("pilot_anand", { x: 0, y: 0 }, { pilot: { ...anand, tier: "A" } }).moveRange + 1);
  });
});

// ---- combat hooks -----------------------------------------------------------------

describe("combat resolver hooks", () => {
  const map = makeUniformMap("plain");

  it("Spall Liner halves the counter the attacker takes, and only the counter", () => {
    const attacker = testUnit("meeps", { x: 0, y: 0 });
    const defender = testUnit("tank", { x: 1, y: 0 });
    const plain = resolveMechAttack(map, attacker, defender, [defender], [attacker], false);
    attacker.frameSystemIds = ["frame_spall_liner"];
    const lined = resolveMechAttack(map, attacker, defender, [defender], [attacker], false);
    expect(plain.countered).toBe(true);
    expect(lined.damage).toBe(plain.damage);
    expect(Math.abs(lined.counterDamage! - plain.counterDamage! * SPALL_LINER_COUNTER_DAMAGE_MULT)).toBeLessThanOrEqual(1); // within rounding of the already-rounded baseline
  });

  it("Low-Profile Gait adds a defence star on real cover (rubble) and nothing on plain ground, which already carries 1 star in tiles.ts", () => {
    const rubble = makeUniformMap("rubble");
    const road = makeUniformMap("road");
    expect(TILES.rubble.defenceStars).toBe(2);
    expect(TILES.plain.defenceStars).toBe(1); // open ground already has a star — the reason the system's cover threshold is 2, not "any"
    expect(TILES.road.defenceStars).toBe(0);
    const attacker = testUnit("tank", { x: 0, y: 0 });
    const defender = testUnit("meeps", { x: 1, y: 0 });
    const onRubble = resolveMechAttack(rubble, attacker, defender, [defender], [attacker], false).damage;
    const onPlain = resolveMechAttack(map, attacker, defender, [defender], [attacker], false).damage;
    const onRoad = resolveMechAttack(road, attacker, defender, [defender], [attacker], false).damage;
    defender.frameSystemIds = ["drive_low_profile_gait"];
    expect(resolveMechAttack(map, attacker, defender, [defender], [attacker], false).damage).toBe(onPlain);
    expect(resolveMechAttack(road, attacker, defender, [defender], [attacker], false).damage).toBe(onRoad);
    const gaitRubble = resolveMechAttack(rubble, attacker, defender, [defender], [attacker], false).damage;
    expect(gaitRubble).toBeLessThan(onRubble);
    // one more star: the damage moves by (1 - 0.1*3)/(1 - 0.1*2), within rounding of the already-rounded baseline
    const expected = (onRubble / (1 - 0.1 * 2)) * (1 - 0.1 * 3);
    expect(Math.abs(gaitRubble - expected)).toBeLessThanOrEqual(1);
  });

  it("Focusing Optics adds ATK only at exactly the attacker's maximum range", () => {
    const reeps = testUnit("reeps", { x: 0, y: 0 });
    reeps.attackRange = [2, 4];
    const far = testUnit("tank", { x: 4, y: 0 });
    const near = testUnit("tank", { x: 3, y: 0 });
    const farPlain = resolveMechAttack(map, reeps, far, [far], [reeps], false).damage;
    const nearPlain = resolveMechAttack(map, reeps, near, [near], [reeps], false).damage;
    reeps.frameSystemIds = ["ordnance_focusing_optics"];
    const farOptics = resolveMechAttack(map, reeps, far, [far], [reeps], false).damage;
    const nearOptics = resolveMechAttack(map, reeps, near, [near], [reeps], false).damage;
    expect(nearOptics).toBe(nearPlain);
    expect(farOptics).toBe(Math.round((farPlain * (reeps.effectiveAttack + FOCUSING_OPTICS_ATK_BONUS)) / reeps.effectiveAttack));
    // and against a Bloom target too
    const bloom = createBloomUnit("bloom_crawlmass", { x: 4, y: 0 });
    reeps.frameSystemIds = [];
    const bPlain = resolveAttackOnBloom(map, reeps, bloom, [bloom], false).damage;
    reeps.frameSystemIds = ["ordnance_focusing_optics"];
    expect(resolveAttackOnBloom(map, reeps, bloom, [bloom], false).damage).toBeGreaterThan(bPlain);
  });

  it("Shredder Rounds ignores a quarter of a mech target's DEF and stacks additively with Rail Lance against a Tank", () => {
    const reeps = testUnit("reeps", { x: 0, y: 0 });
    reeps.attackRange = [2, 4];
    const tank = testUnit("tank", { x: 3, y: 0 });
    const meeps = testUnit("meeps", { x: 3, y: 0 });
    expect(defenseIgnoreFraction(reeps, tank)).toBe(0);
    reeps.frameSystemIds = ["ordnance_shredder_rounds"];
    expect(defenseIgnoreFraction(reeps, tank)).toBe(SHREDDER_ROUNDS_DEF_IGNORE_PCT);
    expect(defenseIgnoreFraction(reeps, meeps)).toBe(SHREDDER_ROUNDS_DEF_IGNORE_PCT);
    reeps.weaponBranchIds = ["reeps_rail_lance"];
    expect(defenseIgnoreFraction(reeps, tank)).toBeCloseTo(SHREDDER_ROUNDS_DEF_IGNORE_PCT + RAIL_LANCE_DEF_IGNORE_PCT);
    expect(defenseIgnoreFraction(reeps, meeps)).toBe(SHREDDER_ROUNDS_DEF_IGNORE_PCT);
    // and the damage moves accordingly
    reeps.weaponBranchIds = [];
    reeps.frameSystemIds = [];
    const plain = resolveMechAttack(map, reeps, meeps, [meeps], [reeps], false).damage;
    reeps.frameSystemIds = ["ordnance_shredder_rounds"];
    const shredded = resolveMechAttack(map, reeps, meeps, [meeps], [reeps], false).damage;
    expect(Math.abs(shredded - plain / (1 - SHREDDER_ROUNDS_DEF_IGNORE_PCT))).toBeLessThanOrEqual(1); // within rounding of the already-rounded baseline
  });

  it("Overpressure Regulator multiplies the first attack and is spent by the Attack verb, not by the resolver", () => {
    const attacker = testUnit("meeps", { x: 0, y: 0 });
    const defender = testUnit("meeps", { x: 1, y: 0 });
    defender.canCounter = false;
    const plain = resolveMechAttack(map, attacker, defender, [defender], [attacker], false).damage;
    attacker.frameSystemIds = ["ordnance_overpressure_regulator"];
    const first = resolveMechAttack(map, attacker, defender, [defender], [attacker], false).damage;
    expect(Math.abs(first - plain * OVERPRESSURE_REGULATOR_FIRST_ATTACK_MULT)).toBeLessThanOrEqual(1); // within rounding of the already-rounded baseline
    // the pure resolver never spends it — only Mission.attack does
    expect(attacker.overpressureSpent).toBeUndefined();
    expect(resolveMechAttack(map, attacker, defender, [defender], [attacker], false).damage).toBe(first);
    attacker.overpressureSpent = true;
    expect(resolveMechAttack(map, attacker, defender, [defender], [attacker], false).damage).toBe(plain);
  });

  it("Bastion widens a Tank's overshield to radius 2 for both the star bonus and shield eligibility", () => {
    const tank = testUnit("tank", { x: 0, y: 0 });
    const ally = testUnit("meeps", { x: 2, y: 0 });
    tank.abilities = ["abil_overshield"];
    expect(overshieldBonus(ally, [tank, ally])).toBe(0);
    expect(tankShieldEligible(ally, [tank, ally])).toBe(false);
    tank.frameRefitId = "refit_tank_bastion";
    expect(overshieldBonus(ally, [tank, ally])).toBe(1);
    expect(tankShieldEligible(ally, [tank, ally])).toBe(true);
    ally.pos = { x: 3, y: 0 };
    expect(overshieldBonus(ally, [tank, ally])).toBe(0);
  });
});

// ---- movement -------------------------------------------------------------------------

describe("movement kinds — Bloomwalkers and Redundant Actuators", () => {
  it("Bloomwalkers make bloom_mat cost 1 and nothing else", () => {
    const mat = makeUniformMap("bloom_mat");
    const rubble = makeUniformMap("rubble");
    const meeps = testUnit("meeps");
    meeps.chassis = "bipedal";
    expect(movementKindOf(meeps)).toBe("bipedal");
    meeps.frameSystemIds = ["drive_bloomwalkers"];
    expect(movementKindOf(meeps)).toBe("bipedal_bloomwalker");
    expect(moveCost(mat, { x: 1, y: 1 }, "bipedal")).toBe(2);
    expect(moveCost(mat, { x: 1, y: 1 }, "bipedal_bloomwalker")).toBe(BLOOMWALKERS_MAT_MOVE_COST);
    expect(moveCost(rubble, { x: 1, y: 1 }, "bipedal_bloomwalker")).toBe(TILES.rubble.moveCost.bipedal);
    expect(moveCost(rubble, { x: 1, y: 1 }, "centauroid_bloomwalker")).toBe(TILES.rubble.moveCost.centauroid);
    // and the flood fill reaches further for it
    const plain = reachableTiles(mat, { x: 0, y: 0 }, 4, "bipedal", new Set()).size;
    const walker = reachableTiles(mat, { x: 0, y: 0 }, 4, "bipedal_bloomwalker", new Set()).size;
    expect(walker).toBeGreaterThan(plain);
  });

  it("Redundant Actuators make a centauroid pay bipedal costs; a no-op on a bipedal frame", () => {
    const cent = testUnit("meeps");
    cent.chassis = "centauroid";
    expect(movementKindOf(cent)).toBe("centauroid");
    cent.frameSystemIds = ["frame_redundant_actuators"];
    expect(movementKindOf(cent)).toBe("bipedal");
    cent.frameSystemIds = ["frame_redundant_actuators", "drive_bloomwalkers"];
    expect(movementKindOf(cent)).toBe("bipedal_bloomwalker");
    const biped = testUnit("meeps");
    biped.chassis = "bipedal";
    biped.frameSystemIds = ["frame_redundant_actuators"];
    expect(movementKindOf(biped)).toBe("bipedal");
    expect(movementKindForUnit(biped, true)).toBe("flying");
  });
});

// ---- repair / regen -------------------------------------------------------------

describe("repair range and regen auras", () => {
  it("repairRangeFor: base, Rapid Response, Aid Station on top, Vanguard Medic overriding everything", () => {
    const m = testUnit("munti");
    expect(repairRangeFor(m)).toBe(DEFAULT_REPAIR_RANGE);
    m.weaponBranchIds = ["munti_rapid_response"];
    expect(repairRangeFor(m)).toBe(RAPID_RESPONSE_REPAIR_RANGE);
    m.frameRefitId = "refit_munti_aid_station";
    expect(repairRangeFor(m)).toBe(RAPID_RESPONSE_REPAIR_RANGE + 2);
    m.frameRefitId = "refit_munti_vanguard_medic";
    expect(repairRangeFor(m)).toBe(1);
  });

  it("regenAurasFor: a Munti's own aura, a Salve Drone on any path, both on one Munti", () => {
    const tank = testUnit("tank");
    expect(regenAurasFor(tank)).toEqual([]);
    tank.frameSystemIds = ["support_salve_drone"];
    expect(regenAurasFor(tank)).toEqual([{ radius: 1, amount: SALVE_DRONE_REGEN_PER_TURN }]);
    const munti = testUnit("munti");
    munti.frameSystemIds = ["support_salve_drone"];
    munti.weaponBranchIds = ["munti_combat_medic"];
    const auras = regenAurasFor(munti);
    expect(auras.length).toBe(2);
    expect(auras[0].amount).toBe(MUNTI_REGEN_PER_TURN * 3);
  });
});

// ---- Mission-level: the turn has to actually pass -------------------------------------

describe("Mission — Salve Drone, Wellroot Filament, Sealed Cockpit, Ram Frame, Battery Frame, Overpressure spend", () => {
  it("Salve Drone heals an adjacent ally for 3, and a Munti's aura wins where both reach", () => {
    const mission = quiet();
    const tank = unit(mission, "pilot_thyns", { x: 5, y: 5 });
    const ally = unit(mission, "pilot_nagori", { x: 6, y: 5 });
    const munti = unit(mission, "pilot_barasj", { x: 15, y: 11 }); // far away
    tank.frameSystemIds = ["support_salve_drone"];
    ally.currentHp = ally.maxHp - 30;
    endQuietTurn(mission);
    expect(ally.currentHp).toBe(ally.maxHp - 30 + SALVE_DRONE_REGEN_PER_TURN);
    munti.pos = { x: 7, y: 5 }; // distance 1 to the ally: Munti's 8 beats the drone's 3, no stacking
    ally.currentHp = ally.maxHp - 30;
    endQuietTurn(mission);
    expect(ally.currentHp).toBe(ally.maxHp - 30 + MUNTI_REGEN_PER_TURN);
  });

  it("on bloom mat: acid bites for 5, Wellroot nets +3, Sealed Cockpit takes nothing, both together net the full +8", () => {
    const mission = quiet();
    const meeps = unit(mission, "pilot_nagori", { x: 8, y: 8 });
    mission.map.tiles[8][8] = "bloom_mat";
    const acid = TILES.bloom_mat.turnStartDamage!;
    const start = meeps.maxHp - 40;
    meeps.currentHp = start;
    endQuietTurn(mission);
    expect(meeps.currentHp).toBe(start - acid);
    meeps.currentHp = start;
    meeps.frameSystemIds = ["salvage_wellroot_filament"];
    endQuietTurn(mission);
    expect(meeps.currentHp).toBe(start - acid + WELLROOT_FILAMENT_MAT_REGEN);
    meeps.currentHp = start;
    meeps.frameSystemIds = ["frame_sealed_cockpit"];
    endQuietTurn(mission);
    expect(meeps.currentHp).toBe(start);
    meeps.currentHp = start;
    meeps.frameSystemIds = ["frame_sealed_cockpit", "salvage_wellroot_filament"];
    endQuietTurn(mission);
    expect(meeps.currentHp).toBe(start + WELLROOT_FILAMENT_MAT_REGEN);
  });

  it("Ram Frame: a bipedal Tank charges after a 2+ tile move, not after 1, and a plain Tank never does", () => {
    const mission = quiet();
    flatten(mission, 6, 7, 12, 10);
    const thyns = unit(mission, "pilot_thyns", { x: 8, y: 8 }); // arch_tank_centauroid in the Team One slice — force bipedal for this check
    thyns.chassis = "bipedal";
    thyns.moveRange = 3;
    expect(mission.moveUnit(thyns.instanceId, { x: 10, y: 8 })).toBe(true);
    expect(thyns.chargedThisMove).toBe(false);
    endQuietTurn(mission);
    thyns.frameRefitId = "refit_tank_ram_frame";
    thyns.pos = { x: 8, y: 8 };
    expect(mission.moveUnit(thyns.instanceId, { x: 9, y: 8 })).toBe(true);
    expect(thyns.chargedThisMove).toBe(false); // 1 tile
    endQuietTurn(mission);
    thyns.pos = { x: 8, y: 8 };
    expect(mission.moveUnit(thyns.instanceId, { x: 9, y: 9 })).toBe(true); // 2 tiles, an L — no straight-line requirement
    expect(thyns.chargedThisMove).toBe(true);
    expect(CENTAUROID_CHARGE_MULT).toBe(1.25); // the multiplier the flag rides
  });

  it("Battery Frame: a Reeps that moved this turn cannot attack, one that didn't can, and the next turn clears it", () => {
    const mission = quiet();
    flatten(mission, 6, 7, 12, 10);
    const reeps = unit(mission, "pilot_tourignie", { x: 8, y: 8 });
    const target = punchingBag(mission, { x: 11, y: 8 });
    reeps.frameRefitId = "refit_reeps_battery_frame";
    reeps.attackRange = [2, 5];
    expect(mission.attack(reeps.instanceId, target.instanceId)).not.toBeNull();
    endQuietTurn(mission); // MISSION_1A's own turn-2 event deploys a hostile mech at (12,8), right on this test's doorstep — endQuietTurn neutralises it
    reeps.pos = { x: 8, y: 8 };
    target.pos = { x: 11, y: 8 };
    target.moveRange = 0;
    expect(mission.moveUnit(reeps.instanceId, { x: 9, y: 8 })).toBe(true);
    expect(reeps.tilesMovedThisTurn).toBe(1);
    expect(mission.attack(reeps.instanceId, target.instanceId)).toBeNull();
    endQuietTurn(mission);
    expect(reeps.downed).toBe(false);
    expect(reeps.tilesMovedThisTurn).toBe(0);
    reeps.frameRefitId = undefined;
    reeps.pos = { x: 8, y: 8 };
    target.pos = { x: 11, y: 8 }; // endQuietTurn parks the kept hostile at (0,0) — bring the bag back into range
    expect(mission.moveUnit(reeps.instanceId, { x: 9, y: 8 })).toBe(true);
    expect(mission.attack(reeps.instanceId, target.instanceId)).not.toBeNull(); // no refit, move-then-attack is fine
  });

  it("the Attack verb spends Overpressure on the first resolved attack and not on a refused one", () => {
    const mission = quiet();
    const reeps = unit(mission, "pilot_tourignie", { x: 8, y: 8 });
    const target = punchingBag(mission, { x: 11, y: 8 });
    reeps.frameSystemIds = ["ordnance_overpressure_regulator"];
    reeps.attackRange = [2, 4];
    reeps.actionsRemaining = 0;
    expect(mission.attack(reeps.instanceId, target.instanceId)).toBeNull();
    expect(reeps.overpressureSpent).toBeUndefined();
    reeps.actionsRemaining = 2;
    expect(mission.attack(reeps.instanceId, target.instanceId)).not.toBeNull();
    expect(reeps.overpressureSpent).toBe(true);
  });
});

// ---- visibility -----------------------------------------------------------------------

describe("Seismic Tap — isVisibleTo", () => {
  it("detects a burrowed unit within 3 tiles, not at 4, never without the system, and never past vision", () => {
    const observer = testUnit("reeps", { x: 0, y: 0 });
    observer.vision = 5;
    const undertow = createBloomUnit("bloom_undertow", { x: 3, y: 0 }, { burrowed: true });
    expect(isVisibleTo(observer, undertow)).toBe(false);
    observer.detectsBurrowedRadius = SEISMIC_TAP_DETECT_RADIUS;
    expect(isVisibleTo(observer, undertow)).toBe(true);
    undertow.pos = { x: 4, y: 0 };
    expect(isVisibleTo(observer, undertow)).toBe(false);
    observer.vision = 2;
    undertow.pos = { x: 3, y: 0 };
    expect(isVisibleTo(observer, undertow)).toBe(false);
    // createPlayerUnit sets the radius from the installed list. Bosk, not
    // Anand: Anand's mek is Runemaster-primary, which (since 6 Sep 2026's
    // second pass) is its own detection source — see mekTracks.test.ts.
    const base = findPilot("pilot_bosk")!;
    const tapped = createPlayerUnit("pilot_bosk", { x: 0, y: 0 }, { pilot: { ...base, tier: "C", ownedFrameSystems: ["sensor_seismic_tap"], equippedFrameSystems: ["sensor_seismic_tap"] } });
    expect(tapped.detectsBurrowedRadius).toBe(SEISMIC_TAP_DETECT_RADIUS);
    expect(createPlayerUnit("pilot_bosk", { x: 0, y: 0 }, { pilot: base }).detectsBurrowedRadius).toBeUndefined();
  });
});
