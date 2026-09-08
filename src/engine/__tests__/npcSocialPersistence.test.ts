import { describe, it, expect } from "vitest";
import {
  type CampaignStorage,
  createWardenCampaignState,
  ensureHubSocialState,
  loadCampaignState,
  saveCampaignState,
} from "../campaignState";

const SEED = { favorability: 10, stress: 20, morale: 50 };

/** A plain in-memory Storage, the same shape every other save test uses. */
function memory(): CampaignStorage {
  const map: Record<string, string> = {};
  return {
    getItem: (k) => map[k] ?? null,
    setItem: (k, v) => { map[k] = v; },
    removeItem: (k) => { delete map[k]; },
  };
}

describe("social state for NPCs who are not on the roster", () => {
  // The bug this exists to stop coming back: the CO and every Mek have no
  // CampaignPilotEntry, so ensureHubSocialState used to hand out a fresh
  // orphan object each call. Hub.ts mutated it, saved, and the change was
  // gone on reload — no error, no warning, just a CO who never remembers.
  it("hands back the SAME object on a second call, not a new one", () => {
    const s = createWardenCampaignState(0);
    const a = ensureHubSocialState(s, "npc_co", SEED);
    a.favorability = 44;
    const b = ensureHubSocialState(s, "npc_co", SEED);
    expect(b).toBe(a);
    expect(b.favorability).toBe(44);
  });

  it("survives a save and a reload", () => {
    const store = memory();
    const s = createWardenCampaignState(0);
    const co = ensureHubSocialState(s, "npc_co", SEED);
    co.favorability = 61;
    co.inRelationship = true;
    co.socialLog.push({ verb: "share_a_drink", at: 1 } as never);
    saveCampaignState(s, store);

    const back = loadCampaignState(store);
    expect(back).not.toBeNull();
    const reloaded = ensureHubSocialState(back!, "npc_co", SEED);
    expect(reloaded.favorability).toBe(61);
    expect(reloaded.inRelationship).toBe(true);
    expect(reloaded.socialLog.length).toBe(1);
  });

  it("keeps each non-roster NPC separate", () => {
    const s = createWardenCampaignState(0);
    ensureHubSocialState(s, "npc_co", SEED).favorability = 70;
    ensureHubSocialState(s, "mek_rourke", SEED).favorability = 5;
    expect(ensureHubSocialState(s, "npc_co", SEED).favorability).toBe(70);
    expect(ensureHubSocialState(s, "mek_rourke", SEED).favorability).toBe(5);
  });

  it("still hangs a real pilot's state off their own roster entry", () => {
    const s = createWardenCampaignState(0);
    const social = ensureHubSocialState(s, "pilot_bosk", SEED);
    social.favorability = 33;
    expect(s.pilots["pilot_bosk"].social?.favorability).toBe(33);
    expect(s.npcSocialStates?.["pilot_bosk"]).toBeUndefined();
  });

  it("reads a save written before the side table existed", () => {
    const store = memory();
    const s = createWardenCampaignState(0);
    saveCampaignState(s, store);
    const back = loadCampaignState(store)!;
    expect(back.npcSocialStates).toBeUndefined();
    // ...and starts one the moment something asks.
    expect(ensureHubSocialState(back, "npc_co", SEED).favorability).toBe(SEED.favorability);
    expect(back.npcSocialStates?.["npc_co"]).toBeDefined();
  });
});
