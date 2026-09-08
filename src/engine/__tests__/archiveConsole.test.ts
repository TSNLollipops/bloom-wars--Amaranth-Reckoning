import { describe, it, expect } from "vitest";
import { WARDEN_FACILITY } from "../facilityWarden";
import { HOUSE_AMARANTH_FACILITY } from "../facilityHouseAmaranth";
import { buildFacilityTables } from "../facility";

const PROFILES = [
  { name: "Warden", p: WARDEN_FACILITY, room: "cic" },
  { name: "House Amaranth", p: HOUSE_AMARANTH_FACILITY, room: "records" },
];

describe("the archive console", () => {
  for (const { name, p, room } of PROFILES) {
    it(`${name} puts it in ${room}`, () => {
      expect(p.archiveRoom).toBe(room);
      expect(p.points.archiveTable).toBeDefined();
    });

    it(`${name} stands it inside that room's own walls`, () => {
      const t = buildFacilityTables(p);
      const zone = t.roomZone(p.archiveRoom);
      const pt = p.points.archiveTable;
      expect(pt.x).toBeGreaterThan(zone.left);
      expect(pt.x).toBeLessThan(zone.right);
      expect(pt.y).toBeGreaterThan(zone.top);
      expect(pt.y).toBeLessThan(zone.bottom);
    });

    // Every walk-up console in this Hub uses a 60px radius. Two of them
    // within 120px of each other would both answer true at once and the E
    // key would silently pick whichever branch is listed first.
    it(`${name} keeps it clear of every other walk-up console`, () => {
      const pts = p.points;
      const others = [pts.hangarShop, pts.crewRecords, pts.workshopBench, pts.vaultPlinth, pts.recroomBoard, pts.muster];
      for (const o of others) {
        const d = Math.hypot(o.x - pts.archiveTable.x, o.y - pts.archiveTable.y);
        expect(d).toBeGreaterThan(120);
      }
    });
  }

  it("does not put both buildings' consoles in the same room", () => {
    expect(WARDEN_FACILITY.archiveRoom).not.toBe(HOUSE_AMARANTH_FACILITY.archiveRoom);
  });
});
