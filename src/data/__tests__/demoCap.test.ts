// src/data/__tests__/demoCap.test.ts
// Exercises the pure decision logic behind the itch.io demo build's
// mission cap (Business Plan v1 §2b/§13, decision 1) with plain
// arguments — parseDemoCap and isMissionDemoLockedWithCap are the
// parameterized halves of demoCap.ts's two build-time constants
// (RAW_CAP/DEMO_MISSION_CAP), so none of this needs to stub
// import.meta.env to reach every branch.
import { describe, it, expect } from "vitest";
import { parseDemoCap, isMissionDemoLockedWithCap } from "../demoCap";
import type { CampaignMission } from "../types";

function mission(id: string): CampaignMission {
  // isMissionDemoLockedWithCap only ever reads .id off a chain entry.
  return { id } as CampaignMission;
}

const chain = [mission("m1"), mission("m2"), mission("m3")];

describe("parseDemoCap", () => {
  it("treats an unset or empty value as not a demo build", () => {
    expect(parseDemoCap(undefined)).toBeNull();
    expect(parseDemoCap("")).toBeNull();
  });

  it("rejects zero, negative, and non-numeric values rather than capping at 0", () => {
    expect(parseDemoCap("0")).toBeNull();
    expect(parseDemoCap("-5")).toBeNull();
    expect(parseDemoCap("abc")).toBeNull();
  });

  it("parses a real cap", () => {
    expect(parseDemoCap("12")).toBe(12);
  });
});

describe("isMissionDemoLockedWithCap", () => {
  it("never locks anything when cap is null — a normal, uncapped build", () => {
    expect(isMissionDemoLockedWithCap(null, "amaranth_act1", chain, "m1")).toBe(false);
    expect(isMissionDemoLockedWithCap(null, "house_amaranth_act1", chain, "m1")).toBe(false);
  });

  it("locks every House Amaranth mission outright, regardless of chain position", () => {
    expect(isMissionDemoLockedWithCap(12, "house_amaranth_act1", chain, "m1")).toBe(true);
    expect(isMissionDemoLockedWithCap(12, "house_amaranth_act3", chain, "m1")).toBe(true);
  });

  it("locks Warden missions past the cap, leaves missions at or under it playable", () => {
    expect(isMissionDemoLockedWithCap(2, "amaranth_act1", chain, "m1")).toBe(false);
    expect(isMissionDemoLockedWithCap(2, "amaranth_act1", chain, "m2")).toBe(false);
    expect(isMissionDemoLockedWithCap(2, "amaranth_act1", chain, "m3")).toBe(true);
  });

  it("applies across the Act I/II/III tab split, since the cap is a chain position, not a per-tab count", () => {
    expect(isMissionDemoLockedWithCap(2, "amaranth_act2", chain, "m1")).toBe(false);
    expect(isMissionDemoLockedWithCap(2, "amaranth_act3", chain, "m3")).toBe(true);
  });

  it("fails open on a mission id the chain doesn't recognize, rather than locking something it can't place", () => {
    expect(isMissionDemoLockedWithCap(2, "amaranth_act1", chain, "unknown_mission")).toBe(false);
  });
});
