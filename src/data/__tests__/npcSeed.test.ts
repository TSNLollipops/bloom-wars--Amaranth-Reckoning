// src/data/__tests__/npcSeed.test.ts
// New, 31 Aug 2026 — catalystForPilot's House Amaranth extension had no
// direct test coverage anywhere (it's only exercised indirectly, via
// griefCatalyst.test.ts's own Warden-roster fixtures). Locks in the five
// hand-picked catalysts from design/
// Bloom_Wars_House_Amaranth_Personalized_Line_Plan_v1.md and confirms the
// deterministic hash fallback still holds for anyone not in either seed
// list.
import { describe, it, expect } from "vitest";
import { catalystForPilot } from "../npcSeed";

describe("catalystForPilot — House Amaranth", () => {
  it("resolves each named House Amaranth pilot to its hand-picked catalyst", () => {
    expect(catalystForPilot("pilot_marrow")).toBe("dog");
    expect(catalystForPilot("pilot_vondra")).toBe("raven");
    expect(catalystForPilot("pilot_meir")).toBe("wolf");
    expect(catalystForPilot("pilot_bray")).toBe("bear");
    expect(catalystForPilot("pilot_orin")).toBe("rabbit");
  });

  it("still falls back to a stable deterministic pick for an unseeded pilot", () => {
    const a = catalystForPilot("pilot_house_amaranth_lance_unnamed_1");
    const b = catalystForPilot("pilot_house_amaranth_lance_unnamed_1");
    expect(a).toBe(b); // same id -> same catalyst every time, no re-roll
  });
});
