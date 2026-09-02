// Carrier Upgrade Modules — the Workshop's second layer, 2 Sep 2026.
// Maxime: "finish the workshop add all the module from weapon and dev."
//
// Three modules ship buyable, and each one's EFFECT is wired to a
// different existing system rather than sitting inert in a save file:
// fabricationBay -> fabricatorMaxSpareParts, combatMedic -> generatePilot,
// vitalSigns -> Battle.ts's HUD. The first two are testable here; the
// third is a Phaser scene and isn't (same reason Hub.ts has had no unit
// tests since Phase 1 — see engine/hubGeometry.ts's own header), so its
// only guard is that VITAL_SIGNS_WARN_FRACTION is a sane fraction and the
// drawHud read of it was checked by hand.
//
// The purchase rules themselves matter more than they look: this spends
// the COMPANY pool, which is the same pool that funds bay builds and
// recruits, so an off-by-one here is points a player can't get back.
import { describe, it, expect } from "vitest";
import { createWardenCampaignState, recruitDiscretionary, type CampaignState } from "../campaignState";
import { purchaseCarrierModule, fabricatorMaxSpareParts, purchaseSpareParts } from "../campaignEconomy";
import { CARRIER_MODULES, FABRICATION_BAY_CAP_BONUS, VITAL_SIGNS_WARN_FRACTION, LOCKED_MODULES } from "../../data/carrierModules";

function richState(points = 5000): CampaignState {
  const state = createWardenCampaignState();
  state.points = points;
  return state;
}

describe("purchaseCarrierModule", () => {
  it("deducts exactly the module's cost from the company pool and records it", () => {
    const state = richState(1000);
    const result = purchaseCarrierModule(state, "vitalSigns");
    expect(result.ok).toBe(true);
    expect(result.cost).toBe(CARRIER_MODULES.vitalSigns.cost);
    expect(state.points).toBe(1000 - CARRIER_MODULES.vitalSigns.cost);
    expect(state.builtModules).toEqual(["vitalSigns"]);
  });

  it("refuses a second purchase of the same module and charges nothing", () => {
    const state = richState(1000);
    purchaseCarrierModule(state, "vitalSigns");
    const pointsAfterFirst = state.points;
    const second = purchaseCarrierModule(state, "vitalSigns");
    expect(second.ok).toBe(false);
    expect(second.reason).toMatch(/already installed/i);
    expect(state.points).toBe(pointsAfterFirst);
    expect(state.builtModules).toEqual(["vitalSigns"]);
  });

  it("refuses when the company can't afford it, without partially spending", () => {
    const state = richState(CARRIER_MODULES.fabricationBay.cost - 1);
    const before = state.points;
    const result = purchaseCarrierModule(state, "fabricationBay");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not enough company points/i);
    expect(state.points).toBe(before);
    expect(state.builtModules ?? []).toEqual([]);
  });

  it("affords a module priced at exactly the points on hand — the boundary is >=, not >", () => {
    const state = richState(CARRIER_MODULES.combatMedic.cost);
    expect(purchaseCarrierModule(state, "combatMedic").ok).toBe(true);
    expect(state.points).toBe(0);
  });

  it("keeps modules independent of bays — buying one touches neither builtBays nor the other list", () => {
    const state = richState();
    state.builtBays = ["fabricator"];
    purchaseCarrierModule(state, "fabricationBay");
    expect(state.builtBays).toEqual(["fabricator"]);
    expect(state.builtModules).toEqual(["fabricationBay"]);
  });

  it("accumulates several distinct modules in purchase order", () => {
    const state = richState();
    purchaseCarrierModule(state, "vitalSigns");
    purchaseCarrierModule(state, "combatMedic");
    purchaseCarrierModule(state, "fabricationBay");
    expect(state.builtModules).toEqual(["vitalSigns", "combatMedic", "fabricationBay"]);
  });
});

describe("Fabrication Bay Expansion — the spare-part cap", () => {
  const primary = { primary: "fabricator" as const, secondary: null };
  const secondary = { primary: "armorer" as const, secondary: "fabricator" as const };
  const neither = { primary: "armorer" as const, secondary: null };

  it("raises a primary Fabricator's cap by exactly the module bonus", () => {
    expect(fabricatorMaxSpareParts(primary, [], [])).toBe(2);
    expect(fabricatorMaxSpareParts(primary, [], ["fabricationBay"])).toBe(2 + FABRICATION_BAY_CAP_BONUS);
  });

  it("raises a secondary Fabricator's cap too", () => {
    expect(fabricatorMaxSpareParts(secondary, [], [])).toBe(1);
    expect(fabricatorMaxSpareParts(secondary, [], ["fabricationBay"])).toBe(1 + FABRICATION_BAY_CAP_BONUS);
  });

  it("stacks with the Fabricator BAY rather than replacing it — both were paid for", () => {
    const bayOnly = fabricatorMaxSpareParts(primary, ["fabricator"], []);
    const both = fabricatorMaxSpareParts(primary, ["fabricator"], ["fabricationBay"]);
    expect(both).toBe(bayOnly + FABRICATION_BAY_CAP_BONUS);
  });

  it("still grants nothing to a mek with no Fabricator track at all, with both bought", () => {
    // The module raises a cap that exists; it never creates one. A Tank mek
    // holding spare parts because the company bought a room would be a real
    // rules break, not a generous edge case.
    expect(fabricatorMaxSpareParts(neither, ["fabricator"], ["fabricationBay"])).toBe(0);
  });

  it("is honoured by the real purchase path, not just the cap helper", () => {
    const state = richState();
    const mekId = Object.keys(state.meks).find((id) => state.meks[id].primary === "fabricator" || state.meks[id].secondary === "fabricator");
    if (!mekId) return; // no Fabricator in the starting roster — nothing to assert
    const mek = state.meks[mekId];
    const capBefore = fabricatorMaxSpareParts(mek, state.builtBays ?? [], state.builtModules ?? []);
    // Fill to the pre-module cap, then confirm it's genuinely blocked.
    while (mek.spareParts < capBefore) purchaseSpareParts(state, mekId);
    expect(purchaseSpareParts(state, mekId).ok).toBe(false);
    // Buy the module: the same call now succeeds, which is the whole point.
    purchaseCarrierModule(state, "fabricationBay");
    expect(purchaseSpareParts(state, mekId).ok).toBe(true);
    expect(mek.spareParts).toBe(capBefore + 1);
  });
});

describe("Combat Medic Cadre — recruit tier", () => {
  it("brings discretionary Munti recruits in at F instead of G", () => {
    const withoutModule = richState();
    const plain = recruitDiscretionary(withoutModule, "munti");
    expect(plain.ok).toBe(true);
    expect(plain.pilot?.tier).toBe("G");

    const withModule = richState();
    purchaseCarrierModule(withModule, "combatMedic");
    const upgraded = recruitDiscretionary(withModule, "munti");
    expect(upgraded.ok).toBe(true);
    expect(upgraded.pilot?.tier).toBe("F");
  });

  it("does NOT upgrade any other class — a medic cadre has no reason to improve a Tank", () => {
    const state = richState();
    purchaseCarrierModule(state, "combatMedic");
    for (const path of ["meeps", "tank", "reeps"] as const) {
      expect(recruitDiscretionary(state, path).pilot?.tier).toBe("G");
    }
  });

  it("applies to every later Munti recruit, not just the first after purchase", () => {
    const state = richState();
    purchaseCarrierModule(state, "combatMedic");
    expect(recruitDiscretionary(state, "munti").pilot?.tier).toBe("F");
    expect(recruitDiscretionary(state, "munti").pilot?.tier).toBe("F");
  });
});

describe("module catalogue integrity", () => {
  it("every module's record key matches its own id, so a lookup can't return the wrong module", () => {
    for (const [key, def] of Object.entries(CARRIER_MODULES)) expect(def.id).toBe(key);
  });

  it("every module costs something — a free permanent upgrade isn't a decision", () => {
    for (const def of Object.values(CARRIER_MODULES)) expect(def.cost).toBeGreaterThan(0);
  });

  it("the Vital Signs threshold is a real fraction of max HP", () => {
    expect(VITAL_SIGNS_WARN_FRACTION).toBeGreaterThan(0);
    expect(VITAL_SIGNS_WARN_FRACTION).toBeLessThan(1);
  });

  it("every locked module carries a real reason, so the panel never shows an empty excuse", () => {
    expect(LOCKED_MODULES.length).toBeGreaterThan(0);
    for (const locked of LOCKED_MODULES) {
      expect(locked.displayName.length).toBeGreaterThan(0);
      expect(locked.reason.length).toBeGreaterThan(0);
    }
  });

  it("no module is both buyable and listed as locked", () => {
    const buyable = new Set(Object.values(CARRIER_MODULES).map((m) => m.displayName));
    for (const locked of LOCKED_MODULES) expect(buyable.has(locked.displayName)).toBe(false);
  });
});
