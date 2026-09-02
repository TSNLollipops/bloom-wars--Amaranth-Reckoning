// Forward Battery — the orphaned module, redesigned and resolved 2 Sep 2026.
//
// Maxime picked option (b) of three offered: the module widens the Fire
// Support blast from a 3x3 to a 5x5 rather than adding charges or cutting
// the Weapons Bay's own bonus-charge cooldown. Its original spec ("reduce
// cooldown by 25%") was unbuildable — Fire Support has no cooldown, it's a
// flat per-mission charge pool — and its own delivery doc had killed it
// pending exactly this conversation.
//
// The two things worth pinning here, because both are easy to get subtly
// wrong and neither would show up as a crash:
//
//  1. BASELINE UNCHANGED without the module. Same guarantee
//     weaponsBayFireSupport.test.ts makes for its own bay, for the same
//     reason: a module that silently alters the ability for players who
//     never bought it is a balance change disguised as a feature.
//  2. FORECAST AGREES WITH REALITY. Battle.ts's hover forecast and the
//     real resolver read the blast radius from two different call sites,
//     and the Build Brief's step 10 names preview-vs-actual desync as "the
//     classic desync" to assert against. Both now go through one getter,
//     and this proves it.
import { describe, it, expect } from "vitest";
import { Mission } from "../mission";
import { AMARANTH_MISSIONS_BY_ID } from "../../data/campaignAmaranth";
import { createHostileMechUnit } from "../units";
import { createWardenCampaignState } from "../campaignState";
import { purchaseCarrierModule } from "../campaignEconomy";
import { FORWARD_BATTERY_FIRE_SUPPORT_RADIUS } from "../../data/carrierModules";
import { FIRE_SUPPORT_RADIUS } from "../../data/combatTables";

const AMARANTH_MISSION_14 = AMARANTH_MISSIONS_BY_ID["mission_amaranth_14"];

/**
 * Mission 14 is where abil_fire_support is actually granted. Same quieting
 * approach as weaponsBayFireSupport.test.ts: down every scripted hostile
 * and park the players out of the way, so the only things in a blast are
 * the ones this test puts there.
 */
function quietMission14(builtModules: ("forwardBattery" | "fabricationBay" | "combatMedic" | "vitalSigns")[] = []): Mission {
  const mission = new Mission(AMARANTH_MISSION_14, undefined, [], { builtModules });
  let i = 0;
  for (const u of mission.units) {
    if (u.side === "hostile") u.downed = true;
    else u.pos = { x: i++, y: 0 };
  }
  return mission;
}

/**
 * Drop a live, inert hostile at `pos` so it can only ever be a blast
 * target. `hostile_mech_01` is a real archetype id from data/units.ts's
 * ALL_HOSTILE_MECHS (createHostileMechUnit throws on anything else — it
 * takes an ARCHETYPE id, not a free-form instance name); each call still
 * gets its own distinct instanceId from the factory, which is what these
 * assertions actually compare on.
 */
function target(mission: Mission, _label: string, pos: { x: number; y: number }) {
  const h = createHostileMechUnit("hostile_mech_01", pos);
  h.vision = 0;
  h.moveRange = 0;
  mission.units.push(h);
  return h;
}

describe("Forward Battery — Fire Support blast radius", () => {
  it("BASELINE UNCHANGED: without the module, a hostile 2 tiles out is untouched", () => {
    const mission = quietMission14();
    const rourke = mission.units.find((u) => u.pilotId === "pilot_rourke")!;
    rourke.pos = { x: 9, y: 6 };
    rourke.vision = 20;
    const near = target(mission, "near", { x: 11, y: 6 }); // 1 from centre
    const far = target(mission, "far", { x: 12, y: 6 }); // 2 from centre
    const before = far.currentHp;

    const result = mission.fireSupport(rourke.instanceId, { x: 10, y: 6 });
    expect(result).not.toBeNull();
    expect(result!.hitIds).toContain(near.instanceId);
    expect(result!.hitIds).not.toContain(far.instanceId);
    expect(far.currentHp).toBe(before);
  });

  it("with the module, that same hostile 2 tiles out IS caught in the blast", () => {
    const mission = quietMission14(["forwardBattery"]);
    const rourke = mission.units.find((u) => u.pilotId === "pilot_rourke")!;
    rourke.pos = { x: 9, y: 6 };
    rourke.vision = 20;
    const near = target(mission, "near", { x: 11, y: 6 }); // 1 from centre
    const far = target(mission, "far", { x: 12, y: 6 }); // 2 from centre
    const beforeFar = far.currentHp;

    const result = mission.fireSupport(rourke.instanceId, { x: 10, y: 6 });
    expect(result).not.toBeNull();
    expect(result!.hitIds).toContain(near.instanceId);
    expect(result!.hitIds).toContain(far.instanceId);
    expect(far.currentHp).toBeLessThan(beforeFar);
  });

  it("stops at the new radius — 3 tiles out is still safe even with the module", () => {
    // The module widens the blast; it doesn't remove the edge. Without this
    // an off-by-one in the getter would pass every other test here.
    const mission = quietMission14(["forwardBattery"]);
    const rourke = mission.units.find((u) => u.pilotId === "pilot_rourke")!;
    rourke.pos = { x: 9, y: 6 };
    rourke.vision = 20;
    const outside = target(mission, "outside", { x: 13, y: 6 }); // 3 from centre
    const before = outside.currentHp;
    const result = mission.fireSupport(rourke.instanceId, { x: 10, y: 6 });
    expect(result!.hitIds).not.toContain(outside.instanceId);
    expect(outside.currentHp).toBe(before);
  });

  it("widens diagonally too — the blast is a Chebyshev box, not a plus", () => {
    const mission = quietMission14(["forwardBattery"]);
    const rourke = mission.units.find((u) => u.pilotId === "pilot_rourke")!;
    rourke.pos = { x: 9, y: 6 };
    rourke.vision = 20;
    const corner = target(mission, "corner", { x: 12, y: 8 }); // (2,2) from centre
    const result = mission.fireSupport(rourke.instanceId, { x: 10, y: 6 });
    expect(result!.hitIds).toContain(corner.instanceId);
  });

  it("FORECAST AGREES WITH REALITY: the hover preview names exactly as many victims as the strike hits", () => {
    const mission = quietMission14(["forwardBattery"]);
    const rourke = mission.units.find((u) => u.pilotId === "pilot_rourke")!;
    rourke.pos = { x: 9, y: 6 };
    rourke.vision = 20;
    target(mission, "near", { x: 11, y: 6 });
    target(mission, "far", { x: 12, y: 6 });

    // Counted, not name-matched: every hostile spawned from the same
    // archetype shares a displayName ("Unmarked Mech"), so a
    // some(displayName === ...) check here would pass even if the forecast
    // listed the same unit twice and missed the other entirely.
    const forecast = mission.forecastSplash(rourke.instanceId, { x: 10, y: 6 }, "fire_support");
    expect(forecast.length).toBe(2);
    const actual = mission.fireSupport(rourke.instanceId, { x: 10, y: 6 })!;
    expect(actual.hitIds.length).toBe(forecast.length);
  });

  it("the forecast is ALSO narrow without the module — the preview tracks the module, not a hardcoded radius", () => {
    const mission = quietMission14();
    const rourke = mission.units.find((u) => u.pilotId === "pilot_rourke")!;
    rourke.pos = { x: 9, y: 6 };
    rourke.vision = 20;
    target(mission, "near", { x: 11, y: 6 }); // 1 from centre — always hit
    target(mission, "far", { x: 12, y: 6 }); // 2 from centre — module only
    const forecast = mission.forecastSplash(rourke.instanceId, { x: 10, y: 6 }, "fire_support");
    expect(forecast.length).toBe(1);
  });

  it("the widened radius is genuinely bigger than the baseline — guards against both being edited to match", () => {
    expect(FORWARD_BATTERY_FIRE_SUPPORT_RADIUS).toBeGreaterThan(FIRE_SUPPORT_RADIUS);
  });
});

describe("Forward Battery — the Weapons Bay prerequisite", () => {
  it("refuses the purchase outright when the Weapons Bay isn't built, and charges nothing", () => {
    const state = createWardenCampaignState();
    state.points = 5000;
    const before = state.points;
    const result = purchaseCarrierModule(state, "forwardBattery");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/weapons bay/i);
    expect(state.points).toBe(before);
    expect(state.builtModules ?? []).toEqual([]);
  });

  it("allows it once the Weapons Bay is built", () => {
    const state = createWardenCampaignState();
    state.points = 5000;
    state.builtBays = ["weaponsBay"];
    expect(purchaseCarrierModule(state, "forwardBattery").ok).toBe(true);
    expect(state.builtModules).toEqual(["forwardBattery"]);
  });

  it("the prerequisite is specific to Forward Battery — the other three never require a bay", () => {
    const state = createWardenCampaignState();
    state.points = 5000;
    for (const id of ["fabricationBay", "combatMedic", "vitalSigns"] as const) {
      expect(purchaseCarrierModule(state, id).ok).toBe(true);
    }
  });
});
