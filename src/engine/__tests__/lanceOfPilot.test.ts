// Carrier Scale-Up Plan v1 Phase 2 (per-lance Mek Workshops), 3 Sep 2026.
//
// lanceOfPilot/lanceOfMek decide which Workshop room a Mek lives in, and a
// wrong answer there is exactly the kind of bug that looks fine in a
// screenshot — every Mek is standing in A workshop, just not the right one.
// These assert against the real static rosters rather than fixtures, on
// purpose: the whole point of the function is that it stays correct as
// those lists change, and a fixture would only ever test the copy.
import { describe, it, expect } from "vitest";
import { lanceOfPilot, lanceOfMek } from "../campaignState";
import { WARDEN_PILOTS, SECOND_LANCE_PILOTS, THIRD_LANCE_PILOTS } from "../../data/campaignAmaranth";
import { HOUSE_AMARANTH_PILOTS, HOUSE_AMARANTH_SECOND_LANCE_PILOTS } from "../../data/campaignHouseAmaranth";

describe("lanceOfPilot", () => {
  it("files every Warden Company pilot under lance A", () => {
    for (const p of WARDEN_PILOTS) {
      expect(lanceOfPilot(p.id), p.id).toBe("a");
    }
  });

  it("files every Second Lance pilot under lance B", () => {
    for (const p of SECOND_LANCE_PILOTS) {
      expect(lanceOfPilot(p.id), p.id).toBe("b");
    }
  });

  it("files every Third Lance pilot under lance C", () => {
    for (const p of THIRD_LANCE_PILOTS) {
      expect(lanceOfPilot(p.id), p.id).toBe("c");
    }
  });

  // House Amaranth is the campaign with only two lances — its starting
  // company is A, its own second lance is B, and nothing there is ever C.
  it("files House Amaranth's starting company under lance A and its second lance under B", () => {
    for (const p of HOUSE_AMARANTH_PILOTS) {
      expect(lanceOfPilot(p.id), p.id).toBe("a");
    }
    for (const p of HOUSE_AMARANTH_SECOND_LANCE_PILOTS) {
      expect(lanceOfPilot(p.id), p.id).toBe("b");
    }
  });

  it("files an unknown pilot (a shop recruit) under lance A rather than throwing", () => {
    expect(lanceOfPilot("pilot_recruit_not_in_any_static_list")).toBe("a");
    expect(lanceOfPilot("")).toBe("a");
  });

  // The rosters must not overlap, or the first-match-wins ordering above
  // would be quietly deciding something a human never decided.
  it("never assigns one pilot id to two different lances", () => {
    const seen = new Map<string, string>();
    const all = [
      ...WARDEN_PILOTS.map((p) => [p.id, "warden"] as const),
      ...SECOND_LANCE_PILOTS.map((p) => [p.id, "second"] as const),
      ...THIRD_LANCE_PILOTS.map((p) => [p.id, "third"] as const),
      ...HOUSE_AMARANTH_PILOTS.map((p) => [p.id, "ha"] as const),
      ...HOUSE_AMARANTH_SECOND_LANCE_PILOTS.map((p) => [p.id, "ha2"] as const),
    ];
    for (const [id, list] of all) {
      expect(seen.has(id), `${id} appears in both ${seen.get(id)} and ${list}`).toBe(false);
      seen.set(id, list);
    }
  });
});

describe("lanceOfMek", () => {
  it("agrees with lanceOfPilot for every pilot's own mek, in both campaigns", () => {
    const rosters = [WARDEN_PILOTS, SECOND_LANCE_PILOTS, THIRD_LANCE_PILOTS, HOUSE_AMARANTH_PILOTS, HOUSE_AMARANTH_SECOND_LANCE_PILOTS];
    for (const roster of rosters) {
      for (const p of roster) {
        expect(lanceOfMek(p.mekId), `${p.mekId} (pilot ${p.id})`).toBe(lanceOfPilot(p.id));
      }
    }
  });

  it("files an unknown mek id under lance A rather than throwing", () => {
    expect(lanceOfMek("mek_recruit_not_in_any_static_list")).toBe("a");
  });
});
