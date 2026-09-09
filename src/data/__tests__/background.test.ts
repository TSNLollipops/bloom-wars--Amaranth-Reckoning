// src/data/__tests__/background.test.ts
// The Catalyst Gauntlet, 9 Sep 2026 — reviving Bloom_Wars_Catalyst_Gauntlet_
// v2_ThirdLance_Verinis_Recruits.md §5. Two jobs, both asked for directly by
// that document's own §5 item 2 ("Tests: every locked cell in §3 pinned;
// every one of the 49 + 11 authored backgrounds re-derives to its recorded
// catalyst (the audit, as a test, forever)"):
//
//   1. Pin every one of the 48 Academy x Birthplace Texture -> Pressure
//      cells from Catalyst_Gauntlet_v2 §3, so a future edit to
//      PRESSURE_TABLE can't silently drift from what that document locked.
//   2. Re-derive every already-authored named pilot/Mek background from
//      NPC_Catalyst_Formula_Closing_And_Roster_Assignments_v1.md §4 and
//      Catalyst_Gauntlet_v2 §4 back to its recorded catalyst, independently
//      of npcSeed.ts's own BACKGROUND_CATALYST_ASSIGNMENTS map — this is a
//      real cross-check of PRESSURE_TABLE, PLANET12_BY_ZONE_PRESSURE, and
//      CATALYST_BY_CELL all at once, not a copy of the assignments map.
//
// Brig. Verinis Amaranth (Catalyst_Gauntlet_v2 §4.3) is deliberately left
// out of the roster list below: his background is still an open call as of
// 8 Sep 2026 ("Open, pending his answer"), not a locked fact to pin. 59
// entries below (49 from the 1 Sep pass + 10 from the Third Lance pass —
// 5 pilots + 5 Meks, Verinis excluded), not 49 + 11.
import { describe, it, expect } from "vitest";
import { catalystForPilot } from "../npcSeed";
import {
  PRESSURE_TABLE,
  ZONE_BY_SECTOR,
  PLANET12_BY_ZONE_PRESSURE,
  CATALYST_BY_CELL,
  SECTOR_PLANETS,
  deriveCatalyst,
  rollBackground,
} from "../background";
import type { PilotBackground } from "../types";

describe("PRESSURE_TABLE — Catalyst_Gauntlet_v2 §3, pinned cell by cell", () => {
  it("matches the locked 48-cell table exactly", () => {
    expect(PRESSURE_TABLE).toEqual({
      "Tallowmere Fitting Yards": {
        "Dockside": "Tested",
        "Terrace Farmstead": "Sheltered",
        "Arcology Stack": "Tested",
        "Garrison Quarter": "Forged",
        "Drift Colony": "Forged",
        "Company Housing": "Sheltered",
        "Preserve-Adjacent": "Tested",
        "Academy Ward": "Sheltered",
      },
      "Cutbank Muster School": {
        "Dockside": "Tested",
        "Terrace Farmstead": "Tested",
        "Arcology Stack": "Tested",
        "Garrison Quarter": "Forged",
        "Drift Colony": "Tested",
        "Company Housing": "Sheltered",
        "Preserve-Adjacent": "Forged",
        "Academy Ward": "Sheltered",
      },
      "Glasswater Conservatory of Arms": {
        "Dockside": "Tested",
        "Terrace Farmstead": "Forged",
        "Arcology Stack": "Tested",
        "Garrison Quarter": "Tested",
        "Drift Colony": "Tested",
        "Company Housing": "Sheltered",
        "Preserve-Adjacent": "Forged",
        "Academy Ward": "Forged",
      },
      "The Cistgate Ledgerworks": {
        "Dockside": "Tested",
        "Terrace Farmstead": "Forged",
        "Arcology Stack": "Tested",
        "Garrison Quarter": "Forged",
        "Drift Colony": "Forged",
        "Company Housing": "Sheltered",
        "Preserve-Adjacent": "Forged",
        "Academy Ward": "Sheltered",
      },
      "The Greywatch Muster": {
        "Dockside": "Tested",
        "Terrace Farmstead": "Tested",
        "Arcology Stack": "Tested",
        "Garrison Quarter": "Tested",
        "Drift Colony": "Tested",
        "Company Housing": "Sheltered",
        "Preserve-Adjacent": "Tested",
        "Academy Ward": "Sheltered",
      },
      "Line-trained": {
        "Dockside": "Tested",
        "Terrace Farmstead": "Tested",
        "Arcology Stack": "Tested",
        "Garrison Quarter": "Forged",
        "Drift Colony": "Tested",
        "Company Housing": "Tested",
        "Preserve-Adjacent": "Forged",
        "Academy Ward": "Sheltered",
      },
    });
  });

  it("rarity check matches Catalyst_Gauntlet_v2 §3's own count: 11 Sheltered, 24 Tested, 13 Forged", () => {
    const counts = { Sheltered: 0, Tested: 0, Forged: 0 };
    for (const row of Object.values(PRESSURE_TABLE)) {
      for (const pressure of Object.values(row)) counts[pressure] += 1;
    }
    expect(counts).toEqual({ Sheltered: 11, Tested: 24, Forged: 13 });
  });
});

describe("ZONE_BY_SECTOR / PLANET12_BY_ZONE_PRESSURE / CATALYST_BY_CELL — locked, 1 Sep + 7 Sep 2026", () => {
  it("matches Background Zones §2/§6 and Catalyst_Gauntlet_v2 §2 (the Amaranth Reach)", () => {
    expect(ZONE_BY_SECTOR).toEqual({
      "Cordage Belt": "Mid-Rim",
      "Long Marches": "Frontier",
      "Glasswater Reach": "Core",
      "The Understrand": "Mid-Rim",
      "Emberfall Drift": "Frontier",
      "Amaranth Reach": "Frontier",
    });
  });

  it("matches the NPC Catalyst Formula §2 bijection — nine cells, nine catalysts, none repeated", () => {
    expect(PLANET12_BY_ZONE_PRESSURE).toEqual({
      "Core": { "Sheltered": "Earth", "Tested": "Uranus", "Forged": "Neptune" },
      "Mid-Rim": { "Sheltered": "Saturn", "Tested": "Mars", "Forged": "Jupiter" },
      "Frontier": { "Sheltered": "Mercury", "Tested": "Venus", "Forged": "Spider" },
    });
    expect(CATALYST_BY_CELL).toEqual({
      "Earth": "dog",
      "Uranus": "raven",
      "Neptune": "rabbit",
      "Saturn": "wolf",
      "Mars": "shark",
      "Jupiter": "bear",
      "Mercury": "fox",
      "Venus": "crow",
      "Spider": "cat",
    });
    expect(new Set(Object.values(CATALYST_BY_CELL)).size).toBe(9); // no catalyst reused
  });
});

// One entry per already-authored named pilot/Mek — NPC_Catalyst_Formula_
// Closing_And_Roster_Assignments_v1.md §4.1-§4.6 (49) and
// Catalyst_Gauntlet_v2_ThirdLance_Verinis_Recruits.md §4.1-§4.2 (10).
const ROSTER: [string, PilotBackground, string][] = [
  // --- NPC Catalyst Formula §4.1 — Warden Company, fresh (11) ---
  ["pilot_lask", { sector: "Cordage Belt", planet: "Skeinreach", texture: "Terrace Farmstead", academy: "Tallowmere Fitting Yards" }, "wolf"],
  ["pilot_okafor", { sector: "The Understrand", planet: "Cistgate", texture: "Garrison Quarter", academy: "The Cistgate Ledgerworks" }, "bear"],
  ["pilot_solheim", { sector: "The Understrand", planet: "Loomvale", texture: "Dockside", academy: "The Cistgate Ledgerworks" }, "shark"],
  ["pilot_tarrant", { sector: "Long Marches", planet: "Harrow's Table", texture: "Academy Ward", academy: "Cutbank Muster School" }, "fox"],
  ["pilot_vashti", { sector: "Emberfall Drift", planet: "Greywatch", texture: "Drift Colony", academy: "The Greywatch Muster" }, "crow"],
  ["pilot_reyes", { sector: "Long Marches", planet: "Cutbank", texture: "Garrison Quarter", academy: "Line-trained" }, "cat"],
  ["pilot_kova", { sector: "The Understrand", planet: "Loomvale", texture: "Preserve-Adjacent", academy: "The Cistgate Ledgerworks" }, "bear"],
  ["pilot_ness", { sector: "Cordage Belt", planet: "Tallowmere", texture: "Company Housing", academy: "Tallowmere Fitting Yards" }, "wolf"],
  ["pilot_onwuka", { sector: "Cordage Belt", planet: "Tallowmere", texture: "Preserve-Adjacent", academy: "Tallowmere Fitting Yards" }, "shark"],
  ["pilot_delgado", { sector: "Glasswater Reach", planet: "Pale Cistern", texture: "Dockside", academy: "Glasswater Conservatory of Arms" }, "raven"],
  ["pilot_yeun", { sector: "Glasswater Reach", planet: "Glasswater", texture: "Academy Ward", academy: "Glasswater Conservatory of Arms" }, "rabbit"],

  // --- NPC Catalyst Formula §4.2 — House Amaranth, fresh (5) ---
  ["pilot_kessler", { sector: "Cordage Belt", planet: "Tallowmere", texture: "Terrace Farmstead", academy: "Tallowmere Fitting Yards" }, "wolf"],
  ["pilot_vantana", { sector: "Glasswater Reach", planet: "Glasswater", texture: "Dockside", academy: "The Cistgate Ledgerworks" }, "raven"],
  ["pilot_reyken", { sector: "Emberfall Drift", planet: "Emberfall", texture: "Preserve-Adjacent", academy: "Line-trained" }, "cat"],
  ["pilot_solano", { sector: "Cordage Belt", planet: "Skeinreach", texture: "Garrison Quarter", academy: "Tallowmere Fitting Yards" }, "bear"],
  ["pilot_marrin", { sector: "Long Marches", planet: "Harrow's Table", texture: "Terrace Farmstead", academy: "Cutbank Muster School" }, "crow"],

  // --- NPC Catalyst Formula §4.3 — the CO (1) ---
  ["the CO", { sector: "The Understrand", planet: "Loomvale", texture: "Academy Ward", academy: "The Cistgate Ledgerworks" }, "wolf"],

  // --- NPC Catalyst Formula §4.4 — reverse-fit pilots (7) ---
  ["pilot_bosk", { sector: "Glasswater Reach", planet: "Glasswater", texture: "Garrison Quarter", academy: "Glasswater Conservatory of Arms" }, "raven"],
  ["pilot_anand", { sector: "Cordage Belt", planet: "Skeinreach", texture: "Company Housing", academy: "Tallowmere Fitting Yards" }, "wolf"],
  ["pilot_iyari", { sector: "Emberfall Drift", planet: "Emberfall", texture: "Preserve-Adjacent", academy: "The Greywatch Muster" }, "crow"],
  ["pilot_vondra", { sector: "Glasswater Reach", planet: "Pale Cistern", texture: "Drift Colony", academy: "Glasswater Conservatory of Arms" }, "raven"],
  ["pilot_meir", { sector: "The Understrand", planet: "Cistgate", texture: "Academy Ward", academy: "The Cistgate Ledgerworks" }, "wolf"],
  ["pilot_bray", { sector: "Cordage Belt", planet: "Tallowmere", texture: "Drift Colony", academy: "Tallowmere Fitting Yards" }, "bear"],
  ["pilot_orin", { sector: "Glasswater Reach", planet: "Glasswater", texture: "Preserve-Adjacent", academy: "Glasswater Conservatory of Arms" }, "rabbit"],

  // --- NPC Catalyst Formula §4.5 — Warden Meks, reverse-fit (15) ---
  ["mek_rourke", { sector: "Glasswater Reach", planet: "Glasswater", texture: "Dockside", academy: "Glasswater Conservatory of Arms" }, "raven"],
  ["mek_bosk", { sector: "Cordage Belt", planet: "Tallowmere", texture: "Garrison Quarter", academy: "Tallowmere Fitting Yards" }, "bear"],
  ["mek_iyari", { sector: "Long Marches", planet: "Harrow's Table", texture: "Company Housing", academy: "Glasswater Conservatory of Arms" }, "fox"],
  ["mek_anand", { sector: "Glasswater Reach", planet: "Glasswater", texture: "Company Housing", academy: "Glasswater Conservatory of Arms" }, "dog"],
  ["mek_lask", { sector: "Glasswater Reach", planet: "Pale Cistern", texture: "Drift Colony", academy: "The Cistgate Ledgerworks" }, "rabbit"],
  ["mek_okafor", { sector: "The Understrand", planet: "Cistgate", texture: "Preserve-Adjacent", academy: "The Cistgate Ledgerworks" }, "bear"],
  ["mek_solheim", { sector: "Glasswater Reach", planet: "Pale Cistern", texture: "Company Housing", academy: "The Cistgate Ledgerworks" }, "dog"],
  ["mek_tarrant", { sector: "Long Marches", planet: "Cutbank", texture: "Terrace Farmstead", academy: "Cutbank Muster School" }, "crow"],
  ["mek_vashti", { sector: "Glasswater Reach", planet: "Pale Cistern", texture: "Terrace Farmstead", academy: "The Cistgate Ledgerworks" }, "rabbit"],
  ["mek_reyes", { sector: "Emberfall Drift", planet: "Emberfall", texture: "Garrison Quarter", academy: "Line-trained" }, "cat"],
  ["mek_kova", { sector: "Cordage Belt", planet: "Skeinreach", texture: "Academy Ward", academy: "Tallowmere Fitting Yards" }, "wolf"],
  ["mek_ness", { sector: "The Understrand", planet: "Loomvale", texture: "Preserve-Adjacent", academy: "Line-trained" }, "bear"],
  ["mek_onwuka", { sector: "Emberfall Drift", planet: "Greywatch", texture: "Terrace Farmstead", academy: "The Greywatch Muster" }, "crow"],
  ["mek_delgado", { sector: "Emberfall Drift", planet: "Greywatch", texture: "Academy Ward", academy: "The Greywatch Muster" }, "fox"],
  ["mek_yeun", { sector: "Glasswater Reach", planet: "Glasswater", texture: "Terrace Farmstead", academy: "Glasswater Conservatory of Arms" }, "rabbit"],

  // --- NPC Catalyst Formula §4.6 — House Amaranth Meks, fresh (10) ---
  ["mek_marrow", { sector: "Cordage Belt", planet: "Tallowmere", texture: "Dockside", academy: "Tallowmere Fitting Yards" }, "shark"],
  ["mek_vondra", { sector: "Long Marches", planet: "Harrow's Table", texture: "Company Housing", academy: "Cutbank Muster School" }, "fox"],
  ["mek_meir", { sector: "Emberfall Drift", planet: "Greywatch", texture: "Garrison Quarter", academy: "The Greywatch Muster" }, "crow"],
  ["mek_bray", { sector: "Glasswater Reach", planet: "Glasswater", texture: "Company Housing", academy: "The Cistgate Ledgerworks" }, "dog"],
  ["mek_orin", { sector: "The Understrand", planet: "Cistgate", texture: "Company Housing", academy: "The Cistgate Ledgerworks" }, "wolf"],
  ["mek_kessler", { sector: "Long Marches", planet: "Cutbank", texture: "Academy Ward", academy: "Cutbank Muster School" }, "fox"],
  ["mek_vantana", { sector: "Cordage Belt", planet: "Skeinreach", texture: "Drift Colony", academy: "Tallowmere Fitting Yards" }, "bear"],
  ["mek_reyken", { sector: "Glasswater Reach", planet: "Pale Cistern", texture: "Preserve-Adjacent", academy: "Glasswater Conservatory of Arms" }, "rabbit"],
  ["mek_solano", { sector: "Long Marches", planet: "Harrow's Table", texture: "Garrison Quarter", academy: "Line-trained" }, "cat"],
  ["mek_marrin", { sector: "Glasswater Reach", planet: "Pale Cistern", texture: "Company Housing", academy: "Glasswater Conservatory of Arms" }, "dog"],

  // --- Catalyst_Gauntlet_v2 §4.1 — House Amaranth Third Lance, fresh (5) ---
  ["pilot_thorne", { sector: "Amaranth Reach", planet: "Aerius", texture: "Terrace Farmstead", academy: "Line-trained" }, "crow"],
  ["pilot_amsel", { sector: "Amaranth Reach", planet: "Aerius", texture: "Company Housing", academy: "Line-trained" }, "crow"],
  ["pilot_kastan", { sector: "The Understrand", planet: "Cistgate", texture: "Arcology Stack", academy: "Line-trained" }, "shark"],
  ["pilot_osei", { sector: "Emberfall Drift", planet: "Greywatch", texture: "Academy Ward", academy: "Line-trained" }, "fox"],
  ["pilot_dunmore", { sector: "The Understrand", planet: "Loomvale", texture: "Company Housing", academy: "Line-trained" }, "shark"],

  // --- Catalyst_Gauntlet_v2 §4.2 — Third Lance Meks, fresh (5) ---
  ["mek_thorne", { sector: "Cordage Belt", planet: "Tallowmere", texture: "Academy Ward", academy: "Tallowmere Fitting Yards" }, "wolf"],
  ["mek_amsel", { sector: "Glasswater Reach", planet: "Pale Cistern", texture: "Terrace Farmstead", academy: "Glasswater Conservatory of Arms" }, "rabbit"],
  ["mek_kastan", { sector: "Glasswater Reach", planet: "Pale Cistern", texture: "Garrison Quarter", academy: "Glasswater Conservatory of Arms" }, "raven"],
  ["mek_osei", { sector: "The Understrand", planet: "Cistgate", texture: "Arcology Stack", academy: "The Cistgate Ledgerworks" }, "shark"],
  ["mek_dunmore", { sector: "Emberfall Drift", planet: "Emberfall", texture: "Terrace Farmstead", academy: "The Greywatch Muster" }, "crow"],
];

describe("deriveCatalyst — re-derives all 59 already-authored backgrounds to their recorded catalyst", () => {
  it.each(ROSTER)("%s -> %s", (_name, background, expected) => {
    expect(deriveCatalyst(background)).toBe(expected);
  });

  it("covers all 59 entries (49 from the 1 Sep pass + 10 from the Third Lance pass)", () => {
    expect(ROSTER).toHaveLength(59);
  });

  // 9 Sep 2026 — the live lookup, not just the formula. Re-deriving the
  // table proved the doc was self-consistent while ten ids (the House
  // Third Lance and their Meks) were missing from npcSeed.ts's own map and
  // hashing to something else on every real save. This is the check that
  // would have caught it.
  // The CO is the one row that is not a pilot id: his catalyst is set on
  // the facility profile (engine/facilityWarden.ts), never looked up here.
  it.each(ROSTER.filter(([id]) => /^(pilot|mek)_/.test(id)))(
    "catalystForPilot(%s) reads the same catalyst the table records",
    (id, _background, expected) => {
      expect(catalystForPilot(id)).toBe(expected);
    },
  );
});

describe("rollBackground", () => {
  it("is internally consistent — the rolled planet always belongs to the rolled sector", () => {
    for (let i = 0; i < 200; i++) {
      const bg = rollBackground(Math.random);
      expect(SECTOR_PLANETS[bg.sector]).toContain(bg.planet);
    }
  });

  it("excludeSector genuinely excludes — a Mek's background never lands in its pilot's own sector", () => {
    for (let i = 0; i < 200; i++) {
      const bg = rollBackground(Math.random, { excludeSector: "Glasswater Reach" });
      expect(bg.sector).not.toBe("Glasswater Reach");
    }
  });

  it("is deterministic under a fixed rng — same sequence of rolls in, same background out", () => {
    const sequence = [0.1, 0.2, 0.3, 0.4];
    const makeRng = () => {
      let i = 0;
      return () => sequence[i++ % sequence.length];
    };
    const a = rollBackground(makeRng());
    const b = rollBackground(makeRng());
    expect(a).toEqual(b);
  });

  it("always produces a background deriveCatalyst can resolve without throwing", () => {
    for (let i = 0; i < 200; i++) {
      const bg = rollBackground(Math.random);
      expect(() => deriveCatalyst(bg)).not.toThrow();
    }
  });

  it("rolls every sector over enough trials — not silently stuck on one", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) seen.add(rollBackground(Math.random).sector);
    expect(seen.size).toBe(6);
  });
});
