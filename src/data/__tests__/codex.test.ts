// Codex data — unit tests. Codex Rebuild & Live Briefing Plan v1, Part A.
// Pure module, no engine/Phaser imports — same purity rule as
// missionBriefing.test.ts (see that file's own header).
import { describe, it, expect } from "vitest";
import {
  PERSONNEL,
  personnelStatusText,
  BESTIARY,
  isBestiaryEntryUnlocked,
  WORLD,
  latestUnlockedWorldRevision,
  SYSTEMS,
  RANKS,
  GLOSSARY,
} from "../codex";
import { wardenMissionIndex, WARDEN_MISSION_ORDER } from "../missionBriefing";

describe("PERSONNEL", () => {
  it("has exactly the six documented entries, no duplicate ids", () => {
    const ids = PERSONNEL.map((p) => p.id);
    expect(ids).toEqual(["pilot_rourke", "pilot_bosk", "pilot_iyari", "pilot_anand", "pilot_lask", "co"]);
    expect(new Set(ids).size).toBe(6);
  });

  it("every named pilot has exactly one paired mek; the CO has none but has his own catalyst line", () => {
    for (const p of PERSONNEL) {
      if (p.id === "co") {
        expect(p.mek).toBeUndefined();
        expect(p.catalystLine).toBeTruthy();
      } else {
        expect(p.mek).toBeDefined();
        expect(p.catalystLine).toBeUndefined();
      }
    }
  });
});

describe("personnelStatusText", () => {
  const rourke = PERSONNEL.find((p) => p.id === "pilot_rourke")!;
  const co = PERSONNEL.find((p) => p.id === "co")!;
  const bosk = PERSONNEL.find((p) => p.id === "pilot_bosk")!;

  it("Rourke always reads 'still in the field', regardless of what live status says", () => {
    expect(personnelStatusText(rourke, { kind: "active" })).toMatch(/still in the field/i);
    expect(personnelStatusText(rourke, undefined)).toMatch(/still in the field/i);
    // Even a defensive (shouldn't-happen) permanently_lost live status never
    // leaks through for her — commander_down never resolves to a normal
    // loss, per campaignState's own short-circuit, but this entry's own
    // text is hardcoded regardless, exactly per the doc's own "one extra
    // layer of care" note.
    expect(personnelStatusText(rourke, { kind: "permanently_lost", missionId: "mission_amaranth_5", turn: 3 })).toMatch(/still in the field/i);
  });

  it("the CO always reads as Hub-side command staff, no mission-outcome branch", () => {
    expect(personnelStatusText(co, undefined)).toMatch(/Hub-side command staff/);
  });

  it("an ordinary roster pilot with no live entry, or an active one, reads 'active, serving'", () => {
    expect(personnelStatusText(bosk, undefined)).toBe("Active, serving with Warden Company.");
    expect(personnelStatusText(bosk, { kind: "active" })).toBe("Active, serving with Warden Company.");
  });

  it("a reassigned pilot reads the honest reassignment line", () => {
    expect(personnelStatusText(bosk, { kind: "reassigned" })).toMatch(/reassigned off the ship/);
  });

  it("a permanently lost pilot names the real mission and turn", () => {
    const midMission = WARDEN_MISSION_ORDER[11]; // Mission 12
    const text = personnelStatusText(bosk, { kind: "permanently_lost", missionId: midMission.id, turn: 7 });
    expect(text).toContain(midMission.displayName);
    expect(text).toContain("turn 7");
  });

  it("falls back to the raw mission id if the lost mission isn't in the Warden order (defensive)", () => {
    const text = personnelStatusText(bosk, { kind: "permanently_lost", missionId: "not_a_real_mission", turn: 2 });
    expect(text).toContain("not_a_real_mission");
  });
});

describe("BESTIARY", () => {
  it("has the nine documented entries in encounter order, no duplicate ids", () => {
    const ids = BESTIARY.map((b) => b.id);
    expect(ids).toEqual([
      "bloom_crawlmass",
      "bloom_splitfang",
      "bloom_undertow",
      "bloom_sporethrower",
      "bloom_choir",
      "bloom_gallcyst",
      "bloom_sirenmaw",
      "bloom_wellroot",
      "bloom_unnamed",
    ]);
    expect(new Set(ids).size).toBe(9);
  });

  it("every gate mission id is real and the gates are in non-decreasing mission order", () => {
    const indices = BESTIARY.map((b) => wardenMissionIndex(b.gateMissionId));
    expect(indices.every((i) => i !== -1)).toBe(true);
    for (let i = 1; i < indices.length; i++) expect(indices[i]).toBeGreaterThan(indices[i - 1]);
  });
});

describe("isBestiaryEntryUnlocked", () => {
  const crawlmass = BESTIARY[0]; // gates on mission_amaranth_1, index 0
  const wellroot = BESTIARY.find((b) => b.id === "bloom_wellroot")!; // mission_amaranth_21

  it("stays locked before its gate mission has been resolved", () => {
    expect(isBestiaryEntryUnlocked(crawlmass, -1)).toBe(false); // brand-new save
    expect(isBestiaryEntryUnlocked(wellroot, 5)).toBe(false); // only 6 missions in
  });

  it("unlocks the instant its gate mission's own index is reached", () => {
    expect(isBestiaryEntryUnlocked(crawlmass, 0)).toBe(true);
    expect(isBestiaryEntryUnlocked(wellroot, wardenMissionIndex("mission_amaranth_21"))).toBe(true);
  });

  it("stays unlocked for any later save state, not just the exact gate index", () => {
    expect(isBestiaryEntryUnlocked(crawlmass, 35)).toBe(true);
  });
});

describe("WORLD", () => {
  it("has the four documented entries, no duplicate ids", () => {
    const ids = WORLD.map((w) => w.id);
    expect(ids).toEqual(["world_coalition", "world_amaranth_reach", "world_house_amaranth", "world_meridian"]);
    expect(new Set(ids).size).toBe(4);
  });

  it("only House Amaranth's entry has a gated first revision; the other three start ungated", () => {
    for (const entry of WORLD) {
      const firstGated = entry.revisions[0].unlockedAfterMissionId !== undefined;
      expect(firstGated).toBe(entry.id === "world_house_amaranth");
    }
  });
});

describe("latestUnlockedWorldRevision", () => {
  const coalition = WORLD.find((w) => w.id === "world_coalition")!;
  const houseAmaranth = WORLD.find((w) => w.id === "world_house_amaranth")!;

  it("a brand-new save (-1) still sees the ungated first revision", () => {
    const rev = latestUnlockedWorldRevision(coalition, -1);
    expect(rev).toBe(coalition.revisions[0]);
  });

  it("returns null for an entry whose very first revision is gated and not yet met", () => {
    expect(latestUnlockedWorldRevision(houseAmaranth, wardenMissionIndex("mission_amaranth_5"))).toBeNull();
  });

  it("walks forward to the latest revision this save's progress actually reached", () => {
    // Coalition: rev0 ungated, rev1 after Mission 20, rev2 after Mission 36.
    expect(latestUnlockedWorldRevision(coalition, wardenMissionIndex("mission_amaranth_10"))).toBe(coalition.revisions[0]);
    expect(latestUnlockedWorldRevision(coalition, wardenMissionIndex("mission_amaranth_20"))).toBe(coalition.revisions[1]);
    expect(latestUnlockedWorldRevision(coalition, wardenMissionIndex("mission_amaranth_36"))).toBe(coalition.revisions[2]);
  });

  it("House Amaranth's revision 3 requires Mission 17, not just Mission 6", () => {
    expect(latestUnlockedWorldRevision(houseAmaranth, wardenMissionIndex("mission_amaranth_6"))).toBe(houseAmaranth.revisions[0]);
    expect(latestUnlockedWorldRevision(houseAmaranth, wardenMissionIndex("mission_amaranth_16"))).toBe(houseAmaranth.revisions[1]);
    expect(latestUnlockedWorldRevision(houseAmaranth, wardenMissionIndex("mission_amaranth_17"))).toBe(houseAmaranth.revisions[2]);
  });
});

describe("SYSTEMS / RANKS / GLOSSARY — always browsable, no gating", () => {
  it("SYSTEMS has the six documented entries", () => {
    expect(SYSTEMS.map((s) => s.id)).toEqual([
      "system_class_triangle",
      "system_chassis",
      "system_mek",
      "system_gear",
      "system_collapse",
      "system_heirloom",
    ]);
  });

  it("RANKS has the two documented entries", () => {
    expect(RANKS.map((r) => r.id)).toEqual(["rank_personal", "rank_command"]);
  });

  it("GLOSSARY has the fourteen documented terms, no duplicates", () => {
    expect(GLOSSARY.length).toBe(14);
    expect(new Set(GLOSSARY.map((g) => g.term)).size).toBe(14);
  });

  it("none of these three carry any gate field at all", () => {
    for (const s of SYSTEMS) expect("gateMissionId" in s || "unlockedAfterMissionId" in s).toBe(false);
    for (const r of RANKS) expect("gateMissionId" in r || "unlockedAfterMissionId" in r).toBe(false);
  });
});
