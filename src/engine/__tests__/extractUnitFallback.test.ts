// extract_unit role-fallback (31 Aug 2026 — Maxime: "you shouldnt make a
// single nsmed chsracter the most important part of a mission. use a role.
// un case the player doesnt bring those npc with him or they die. dont
// forget other than the mc. no one is safe from perma death").
//
// Before this pass, a single-named-pilot extract_unit mission
// (objectiveParams.extractUnitId) was mathematically unwinnable if that
// pilot was never deployed this run — left home by a real Transporter-pad
// squad selection, or permanently lost to an earlier mission's own
// permadeath check. checkExtraction's own `if (!unit) return;` guard meant
// extractedUnitId could never be set, so the only way out was the
// turnLimit loss branch, every single run, regardless of skill — see
// engine/mission.ts's tagExtractionTarget for the full root-cause writeup.
//
// House test style: real Mission objects built from a real mission def
// (HOUSE_AMARANTH_MISSION_17, extractUnitId: "pilot_orin"), same pattern
// as civilianExtraction.test.ts/overwatch.test.ts.
import { describe, it, expect } from "vitest";
import { Mission, type DeployRosterEntry } from "../mission";
import { HOUSE_AMARANTH_MISSION_17 } from "../../data/campaignHouseAmaranth";
import { findPilot, findMek } from "../../data/pilotRegistry";

/** HOUSE_AMARANTH_MISSION_17 with every hostile downed and every player unit
 * parked off-board — isolates whatever the test sets up next from the
 * mission's own real enemy waves. Mirrors civilianExtraction.test.ts's
 * quietConvoyMission(). */
function quietMission(deployRoster?: DeployRosterEntry[]): Mission {
  const mission = new Mission(HOUSE_AMARANTH_MISSION_17, deployRoster);
  for (const u of mission.units) {
    if (u.side === "hostile") u.downed = true;
    else u.pos = { x: 0, y: 0 };
  }
  return mission;
}

/** The mission's own default squad, minus whichever pilotId is passed —
 * simulates "the player just didn't bring pilot_orin" (equivalently: she
 * was permanently lost to an earlier mission's permadeath). */
function rosterExcluding(excludeId: string): DeployRosterEntry[] {
  return HOUSE_AMARANTH_MISSION_17.playerPilotIds
    .filter((id) => id !== excludeId)
    .map((id) => {
      const pilot = findPilot(id)!;
      return { pilotId: id, pilot, mek: findMek(pilot.mekId) };
    });
}

describe("Mission.tagExtractionTarget — named pilot actually deployed (unchanged behavior)", () => {
  it("tags exactly the configured extractUnitId when that pilot is on the board", () => {
    const mission = quietMission();
    expect(mission.resolvedExtractionTargetId).toBe("pilot_orin");
    const orin = mission.unitById("pilot_orin")!;
    expect(orin.isExtractionTarget).toBe(true);
  });

  it("still wins the instant the configured pilot reaches an exit tile", () => {
    const mission = quietMission();
    const orin = mission.unitById("pilot_orin")!;
    orin.pos = mission.map.exitTiles![0];
    mission.endPlayerTurn();
    expect(mission.outcome).toBe("win");
  });

  it("still loses immediately if the configured pilot is downed — real stakes are unchanged", () => {
    const mission = quietMission();
    const orin = mission.unitById("pilot_orin")!;
    orin.downed = true;
    mission.endPlayerTurn();
    expect(mission.outcome).toBe("loss");
    expect(mission.log).toContain("Loss: the unit to extract was downed.");
  });
});

describe("Mission.tagExtractionTarget — named pilot never deployed (the actual bug fix)", () => {
  it("falls back to a different, actually-deployed player unit instead of resolving to nobody", () => {
    const mission = quietMission(rosterExcluding("pilot_orin"));
    expect(mission.unitById("pilot_orin")).toBeUndefined();
    expect(mission.resolvedExtractionTargetId).not.toBeNull();
    expect(mission.resolvedExtractionTargetId).not.toBe("pilot_orin");
    const target = mission.unitById(mission.resolvedExtractionTargetId!);
    expect(target).toBeDefined();
    expect(target!.isExtractionTarget).toBe(true);
    // Exactly one unit carries the flag — the role transferred, it didn't duplicate.
    expect(mission.units.filter((u) => u.isExtractionTarget)).toHaveLength(1);
  });

  it("is genuinely winnable via the fallback target reaching an exit tile — the mission is no longer structurally impossible", () => {
    const mission = quietMission(rosterExcluding("pilot_orin"));
    const target = mission.unitById(mission.resolvedExtractionTargetId!)!;
    target.pos = mission.map.exitTiles![0];
    mission.endPlayerTurn();
    expect(mission.outcome).toBe("win");
  });

  it("is a real loss (not a silent no-op) if the fallback target itself goes down", () => {
    const mission = quietMission(rosterExcluding("pilot_orin"));
    const target = mission.unitById(mission.resolvedExtractionTargetId!)!;
    target.downed = true;
    mission.endPlayerTurn();
    expect(mission.outcome).toBe("loss");
    expect(mission.log).toContain("Loss: the unit to extract was downed.");
  });
});
