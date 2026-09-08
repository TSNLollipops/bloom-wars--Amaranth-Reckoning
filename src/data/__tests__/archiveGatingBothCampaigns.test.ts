import { describe, it, expect } from "vitest";
import {
  HOUSE_AMARANTH_MISSION_ORDER,
  WARDEN_MISSION_ORDER,
  highestMissionIndexReached,
  highestWardenMissionIndexReached,
} from "../missionBriefing";
import { ARCHIVE_ENTRIES, gateValue, isEntryOnFacility, isEntryUnlocked } from "../archive";

describe("campaign progress, per campaign", () => {
  it("reads a Warden save", () => {
    const m = WARDEN_MISSION_ORDER[13];
    expect(highestMissionIndexReached("warden", { missionId: m.id })).toBe(13);
  });

  it("reads a House Amaranth save", () => {
    const m = HOUSE_AMARANTH_MISSION_ORDER[13];
    expect(highestMissionIndexReached("amaranth", { missionId: m.id })).toBe(13);
  });

  // The bug this file exists for. The Archive gates BOTH consoles, and the
  // Warden-only helper returns its unrecognized-id -1 for every House mission
  // id — which reads as "nothing resolved" and locks the House archive shut
  // for the whole campaign, silently.
  it("the Warden-only helper cannot see a House save at all", () => {
    const houseMission = HOUSE_AMARANTH_MISSION_ORDER[20];
    expect(highestWardenMissionIndexReached({ missionId: houseMission.id })).toBe(-1);
    expect(highestMissionIndexReached("amaranth", { missionId: houseMission.id })).toBe(20);
  });

  it("keeps the two campaigns' mission ids disjoint, which is why the above matters", () => {
    const warden = new Set(WARDEN_MISSION_ORDER.map((m) => m.id));
    const shared = HOUSE_AMARANTH_MISSION_ORDER.filter((m) => warden.has(m.id));
    expect(shared.map((m) => m.id)).toEqual([]);
  });

  it("returns -1 for no echo and for an id from neither campaign", () => {
    expect(highestMissionIndexReached("warden", undefined)).toBe(-1);
    expect(highestMissionIndexReached("amaranth", undefined)).toBe(-1);
    expect(highestMissionIndexReached("warden", { missionId: "mission_nonsense" })).toBe(-1);
  });
});

describe("the archive actually opens on both consoles", () => {
  for (const fac of ["warden", "amaranth"] as const) {
    const order = fac === "amaranth" ? HOUSE_AMARANTH_MISSION_ORDER : WARDEN_MISSION_ORDER;

    it(`${fac}: a finished campaign unlocks every entry on that console`, () => {
      const resolved = highestMissionIndexReached(fac, { missionId: order[order.length - 1].id }) + 1;
      const locked = ARCHIVE_ENTRIES.filter(
        (e) => isEntryOnFacility(e, fac) && !isEntryUnlocked(e, fac, resolved),
      );
      expect(locked.map((e) => e.id)).toEqual([]);
    });

    it(`${fac}: progress opens strictly more than a fresh save does`, () => {
      const open = (r: number) =>
        ARCHIVE_ENTRIES.filter((e) => isEntryOnFacility(e, fac) && isEntryUnlocked(e, fac, r)).length;
      const fresh = open(0);
      const midway = open(highestMissionIndexReached(fac, { missionId: order[17].id }) + 1);
      expect(midway).toBeGreaterThan(fresh);
      expect(fresh).toBeGreaterThan(0); // the ungated reference shelves are always there
    });

    it(`${fac}: every gate on this console is reachable inside its own campaign`, () => {
      const last = order.length;
      const unreachable = ARCHIVE_ENTRIES.filter((e) => {
        if (!isEntryOnFacility(e, fac)) return false;
        const gates = [gateValue(e.gate, fac), ...(e.revisions ?? []).map((r) => gateValue(r.after, fac))];
        return gates.some((g) => g !== null && g > last);
      });
      expect(unreachable.map((e) => e.id)).toEqual([]);
    });
  }
});
