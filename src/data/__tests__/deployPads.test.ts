import { describe, it, expect } from "vitest";
import { WARDEN_MISSION_CHAIN } from "../allCampaigns";
import { deployPadCount, clampDeployCapToPads } from "../deployPads";

// Mirrors scenes/TransporterPad.ts's deployCapForMission for Warden ids
// (5 / 10 / 15 for missions 1-12 / 13-24 / 25-36). Duplicated rather than
// imported because that function lives in a Phaser scene file.
function wardenActCap(missionId: string): number {
  const n = Number(missionId.match(/^mission_amaranth_(\d+)$/)![1]);
  if (n <= 12) return 5;
  if (n <= 24) return 10;
  return 15;
}

describe("deploy pads (26 Sep 2026 playtest fix: no stacked pilots)", () => {
  it("every Warden mission's map has at least its Act's deploy cap in pads", () => {
    const short = WARDEN_MISSION_CHAIN.map((m) => ({ id: m.id, pads: deployPadCount(m.id), cap: wardenActCap(m.id) })).filter(
      (r) => r.pads === null || r.pads < r.cap,
    );
    expect(short).toEqual([]);
  });

  it("clamps a cap down to the map's pad count, and never up", () => {
    const pads = deployPadCount("mission_amaranth_17");
    expect(pads).toBe(10);
    expect(clampDeployCapToPads(15, "mission_amaranth_17")).toBe(10);
    expect(clampDeployCapToPads(5, "mission_amaranth_17")).toBe(5);
  });

  it("leaves the cap alone for an unknown mission", () => {
    expect(deployPadCount("mission_does_not_exist")).toBeNull();
    expect(clampDeployCapToPads(10, "mission_does_not_exist")).toBe(10);
  });

  it("clamps House Amaranth missions whose maps are still short on pads", () => {
    // House Amaranth ships later; its maps weren't touched on 26 Sep.
    // Until they are, the clamp is what keeps pilots off each other there.
    const pads = deployPadCount("mission_house_amaranth_23");
    expect(pads).not.toBeNull();
    expect(pads!).toBeLessThan(15);
    expect(clampDeployCapToPads(15, "mission_house_amaranth_23")).toBe(pads);
  });
});
