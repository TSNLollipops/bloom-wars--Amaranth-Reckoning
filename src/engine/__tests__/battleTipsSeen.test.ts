import { describe, it, expect } from "vitest";
import { createWardenCampaignState, saveCampaignState, loadCampaignState, battleTipsSeenOf, markBattleTipSeen, markBattleTipSeenOn, resetBattleTipsSeen } from "../campaignState";

function memStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

describe("battle tips are remembered per campaign", () => {
  it("a new campaign has seen nothing", () => {
    expect(battleTipsSeenOf(createWardenCampaignState()).size).toBe(0);
    expect(battleTipsSeenOf(null).size).toBe(0);
  });
  it("marking is idempotent", () => {
    const s = createWardenCampaignState();
    markBattleTipSeenOn(s, "range");
    markBattleTipSeenOn(s, "range");
    expect(s.battleTipsSeen).toEqual(["range"]);
  });
  it("persists through the save, and a fresh campaign starts clean", () => {
    const st = memStorage();
    saveCampaignState(createWardenCampaignState(), st);
    markBattleTipSeen("actions", st);
    expect(battleTipsSeenOf(loadCampaignState(st)).has("actions")).toBe(true);
    saveCampaignState(createWardenCampaignState(), st);
    expect(battleTipsSeenOf(loadCampaignState(st)).size).toBe(0);
  });
  it("reset clears the current campaign's list", () => {
    const st = memStorage();
    saveCampaignState(createWardenCampaignState(), st);
    markBattleTipSeen("actions", st);
    resetBattleTipsSeen(st);
    expect(battleTipsSeenOf(loadCampaignState(st)).size).toBe(0);
  });
});
