// Frame Systems Layer, Tier 1 — catalog integrity (data/frameSystems.ts,
// 6 Sep 2026). Data-only checks: ids agree with keys, families/paths are
// real, Draw is 1-3, refits come in pairs per path, the salvage gates point
// at real Bloom archetypes, and the doc's own hard rules on refits hold at
// the data level (no refit gives Reeps a counter or a Tank reach).
import { describe, it, expect } from "vitest";
import {
  FRAME_SYSTEMS,
  FRAME_SYSTEM_IDS,
  FRAME_SYSTEM_FAMILY_ORDER,
  FRAME_REFITS,
  FRAME_REFITS_BY_PATH,
  FRAME_TIER_CAPACITY,
  frameCapacityFor,
  frameSystemPointCost,
  frameSystemDrawFor,
  mekIsRunemaster,
  FRAME_SYSTEM_POINTS_PER_DRAW,
  SALVAGE_NON_RUNEMASTER_DRAW_SURCHARGE,
  UNBUILT_DOC_SYSTEMS,
  isFrameSystemId,
  isFrameRefitId,
} from "../frameSystems";
import { BLOOM } from "../bloom";
import type { MekArchetype, Path } from "../types";

const PATHS: Path[] = ["meeps", "tank", "reeps", "munti"];

describe("FRAME_SYSTEMS catalog", () => {
  it("every entry's id matches its key, its family is real, and Draw is 1-3", () => {
    for (const [key, def] of Object.entries(FRAME_SYSTEMS)) {
      expect(def.id).toBe(key);
      expect(FRAME_SYSTEM_FAMILY_ORDER).toContain(def.family);
      expect([1, 2, 3]).toContain(def.draw);
      expect(def.displayName.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
    }
    expect(FRAME_SYSTEM_IDS.length).toBe(17);
  });

  it("ships 17 systems (Tier 1's 16, plus Stabilizer Struts once the Fieldwright heal was wired), the doc's Heartwood Graft re-sourced to Gallcyst, Crash Foam Lining cut, and an empty left-out list", () => {
    expect(FRAME_SYSTEM_IDS).toEqual(
      expect.arrayContaining([
        "frame_reinforced_plating",
        "frame_spall_liner",
        "frame_sealed_cockpit",
        "frame_redundant_actuators",
        "drive_sprint_cell",
        "drive_low_profile_gait",
        "drive_bloomwalkers",
        "sensor_signal_booster",
        "sensor_seismic_tap",
        "ordnance_focusing_optics",
        "ordnance_shredder_rounds",
        "ordnance_overpressure_regulator",
        "support_field_repair_kit",
        "support_salve_drone",
        "support_stabilizer_struts",
        "salvage_wellroot_filament",
        "salvage_gallcyst_graft",
      ])
    );
    expect(FRAME_SYSTEM_IDS).not.toContain("salvage_heartwood_graft");
    expect(FRAME_SYSTEMS.salvage_gallcyst_graft.salvage).toEqual({ archetypeId: "bloom_gallcyst", kills: 1 });
    expect(UNBUILT_DOC_SYSTEMS).toEqual([]);
  });

  it("every salvage system points at a real Bloom archetype with a positive kill gate, and nothing else carries a gate", () => {
    for (const def of Object.values(FRAME_SYSTEMS)) {
      if (def.family === "salvage") {
        expect(def.salvage).toBeDefined();
        expect(BLOOM[def.salvage!.archetypeId]).toBeDefined();
        expect(def.salvage!.kills).toBeGreaterThan(0);
      } else {
        expect(def.salvage).toBeUndefined();
      }
    }
  });

  it("prices every system at Draw x FRAME_SYSTEM_POINTS_PER_DRAW, salvage included", () => {
    for (const def of Object.values(FRAME_SYSTEMS)) {
      expect(frameSystemPointCost(def)).toBe(def.draw * FRAME_SYSTEM_POINTS_PER_DRAW);
    }
  });

  it("charges the §7 salvage Draw surcharge only on a non-Runemaster loadout, and only on a salvage system", () => {
    const rune: MekArchetype = { id: "m", displayName: "m", primary: "runemaster", secondary: null, spareParts: 0 };
    const runeSecondary: MekArchetype = { id: "m", displayName: "m", primary: "armorer", secondary: "runemaster", spareParts: 0 };
    const plain: MekArchetype = { id: "m", displayName: "m", primary: "armorer", secondary: null, spareParts: 0 };
    const salvage = FRAME_SYSTEMS.salvage_wellroot_filament;
    const foundry = FRAME_SYSTEMS.frame_spall_liner;
    expect(mekIsRunemaster(rune)).toBe(true);
    expect(mekIsRunemaster(runeSecondary)).toBe(true);
    expect(mekIsRunemaster(plain)).toBe(false);
    expect(mekIsRunemaster(undefined)).toBe(false);
    expect(frameSystemDrawFor(salvage, rune)).toBe(salvage.draw);
    expect(frameSystemDrawFor(salvage, runeSecondary)).toBe(salvage.draw);
    expect(frameSystemDrawFor(salvage, plain)).toBe(salvage.draw + SALVAGE_NON_RUNEMASTER_DRAW_SURCHARGE);
    expect(frameSystemDrawFor(salvage, undefined)).toBe(salvage.draw + SALVAGE_NON_RUNEMASTER_DRAW_SURCHARGE);
    expect(frameSystemDrawFor(foundry, plain)).toBe(foundry.draw);
  });

  it("type guards agree with the tables", () => {
    expect(isFrameSystemId("frame_spall_liner")).toBe(true);
    expect(isFrameSystemId("meeps_impact_lance")).toBe(false);
    expect(isFrameRefitId("refit_tank_bastion")).toBe(true);
    expect(isFrameRefitId("frame_spall_liner")).toBe(false);
  });
});

describe("FRAME_TIER_CAPACITY — the doc's §3 table", () => {
  it("grants 1 mount through D, 2 from C, and Draw 2/3/4/5/6/8/10, with S reading as A", () => {
    expect(FRAME_TIER_CAPACITY.G).toEqual({ mounts: 1, draw: 2 });
    expect(FRAME_TIER_CAPACITY.F).toEqual({ mounts: 1, draw: 3 });
    expect(FRAME_TIER_CAPACITY.E).toEqual({ mounts: 1, draw: 4 });
    expect(FRAME_TIER_CAPACITY.D).toEqual({ mounts: 1, draw: 5 });
    expect(FRAME_TIER_CAPACITY.C).toEqual({ mounts: 2, draw: 6 });
    expect(FRAME_TIER_CAPACITY.B).toEqual({ mounts: 2, draw: 8 });
    expect(FRAME_TIER_CAPACITY.A).toEqual({ mounts: 2, draw: 10 });
    expect(FRAME_TIER_CAPACITY.S).toEqual(FRAME_TIER_CAPACITY.A);
    expect(frameCapacityFor("C").mounts).toBe(2);
  });

  it("never shrinks up the ladder", () => {
    const order = ["G", "F", "E", "D", "C", "B", "A"] as const;
    for (let i = 1; i < order.length; i++) {
      expect(FRAME_TIER_CAPACITY[order[i]].draw).toBeGreaterThanOrEqual(FRAME_TIER_CAPACITY[order[i - 1]].draw);
      expect(FRAME_TIER_CAPACITY[order[i]].mounts).toBeGreaterThanOrEqual(FRAME_TIER_CAPACITY[order[i - 1]].mounts);
    }
  });
});

describe("FRAME_REFITS — the doc's §8 table", () => {
  it("has exactly two refits per path, each keyed by its own id and path", () => {
    for (const path of PATHS) {
      const ids = FRAME_REFITS_BY_PATH[path];
      expect(ids.length).toBe(2);
      for (const id of ids) {
        expect(FRAME_REFITS[id].id).toBe(id);
        expect(FRAME_REFITS[id].path).toBe(path);
      }
    }
    expect(Object.keys(FRAME_REFITS).length).toBe(8);
  });

  it("holds the doc's own hard rule at the data level: no refit touches the class triangle", () => {
    // A refit def can only ever carry stats / an attackRange / a repair-range
    // change — there is no field for canCounter or counterMaxRange, so a
    // Reeps can never gain a counter this way and a Tank can never gain reach.
    for (const def of Object.values(FRAME_REFITS)) {
      expect(Object.keys(def).every((k) => ["id", "displayName", "path", "description", "stats", "attackRange", "repairRangeDelta", "repairRangeOverride"].includes(k))).toBe(true);
      if (def.attackRange) expect(def.path).toBe("reeps"); // only the two Reeps refits set a window
    }
    expect(FRAME_REFITS.refit_reeps_battery_frame.attackRange).toEqual([2, 5]);
    expect(FRAME_REFITS.refit_reeps_skirmish_battery.attackRange).toEqual([2, 3]);
    expect(FRAME_REFITS.refit_meeps_skirmish_frame.stats).toEqual({ move: 2, hp: -15 });
    expect(FRAME_REFITS.refit_meeps_breacher_frame.stats).toEqual({ attack: 12, move: -1 });
  });
});
