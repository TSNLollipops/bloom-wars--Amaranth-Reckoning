// src/engine/__tests__/saveRobustness.test.ts
// Ship audit, 16 Sep 2026 (Bloom_Wars_Ship_Audit_16Sep2026.md §1.2, §4):
// the save layer's new guarantees — a storage that throws never escapes
// saveCampaignState, export/import round-trips and refuses garbage without
// touching the live key, the social log is capped at save time, and an
// old blob picks up schemaVersion on load. All against injected storage,
// same as campaignState.test.ts.
import { describe, expect, it } from "vitest";
import {
  createWardenCampaignState,
  saveCampaignState,
  loadCampaignState,
  exportCampaignJson,
  importCampaignJson,
  looksLikeCampaignState,
  ensureHubSocialState,
  SOCIAL_LOG_CAP,
  CAMPAIGN_SCHEMA_VERSION,
  type CampaignStorage,
} from "../campaignState";

function memoryStorage(): CampaignStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

describe("save robustness", () => {
  it("returns false, and does not throw, when the storage refuses the write (quota)", () => {
    const throwing: CampaignStorage = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("QuotaExceededError", "QuotaExceededError");
      },
      removeItem: () => {},
    };
    const state = createWardenCampaignState();
    expect(() => saveCampaignState(state, throwing)).not.toThrow();
    expect(saveCampaignState(state, throwing)).toBe(false);
  });

  it("returns true on a normal write", () => {
    const s = memoryStorage();
    expect(saveCampaignState(createWardenCampaignState(), s)).toBe(true);
    expect(s.map.size).toBe(1);
  });

  it("stamps schemaVersion on a fresh state and backfills it on an old blob", () => {
    const s = memoryStorage();
    const state = createWardenCampaignState();
    expect(state.schemaVersion).toBe(CAMPAIGN_SCHEMA_VERSION);
    const old = { ...state } as Record<string, unknown>;
    delete old.schemaVersion;
    s.setItem("bloomwars_campaign_state_v1", JSON.stringify(old));
    expect(loadCampaignState(s)?.schemaVersion).toBe(CAMPAIGN_SCHEMA_VERSION);
  });

  it("caps every pilot's social log at SOCIAL_LOG_CAP when saving, keeping the newest entries", () => {
    const s = memoryStorage();
    const state = createWardenCampaignState();
    const pilotId = Object.keys(state.pilots)[0];
    const social = ensureHubSocialState(state, pilotId, { favorability: 0, stress: 10, morale: 50 });
    for (let i = 0; i < SOCIAL_LOG_CAP + 40; i++) social.socialLog.push({ verb: "praise", line: `line ${i}`, at: i });
    expect(saveCampaignState(state, s)).toBe(true);
    // Trimmed in place (the Hub holds this same array), and on disk.
    expect(social.socialLog.length).toBe(SOCIAL_LOG_CAP);
    expect(social.socialLog[0].line).toBe("line 40");
    const stored = JSON.parse(s.map.get("bloomwars_campaign_state_v1")!) as ReturnType<typeof createWardenCampaignState>;
    expect(stored.pilots[pilotId].social?.socialLog.length).toBe(SOCIAL_LOG_CAP);
  });
});

describe("export / import", () => {
  it("exports null with no save, and the stored JSON verbatim with one", () => {
    const s = memoryStorage();
    expect(exportCampaignJson(s)).toBeNull();
    const state = createWardenCampaignState();
    state.companyName = "Round Trip Co";
    saveCampaignState(state, s);
    expect(exportCampaignJson(s)).toBe(s.map.get("bloomwars_campaign_state_v1"));
  });

  it("round-trips: an export imported elsewhere becomes that browser's live save", () => {
    const a = memoryStorage();
    const b = memoryStorage();
    const state = createWardenCampaignState();
    state.companyName = "Round Trip Co";
    saveCampaignState(state, a);
    const text = exportCampaignJson(a)!;
    const result = importCampaignJson(text, b);
    expect(result.ok).toBe(true);
    expect(loadCampaignState(b)?.companyName).toBe("Round Trip Co");
  });

  it("refuses garbage and non-save JSON, leaving the live key untouched", () => {
    const s = memoryStorage();
    const keep = createWardenCampaignState();
    keep.companyName = "Keep Me";
    saveCampaignState(keep, s);
    const before = s.map.get("bloomwars_campaign_state_v1");

    const r1 = importCampaignJson("not a save", s);
    expect(r1.ok).toBe(false);
    const r2 = importCampaignJson(JSON.stringify({ version: "0.9.0", records: [] }), s);
    expect(r2.ok).toBe(false);
    const r3 = importCampaignJson("", s);
    expect(r3.ok).toBe(false);

    expect(s.map.get("bloomwars_campaign_state_v1")).toBe(before);
    expect(loadCampaignState(s)?.companyName).toBe("Keep Me");
  });

  it("looksLikeCampaignState is a structural check, not a schema validator", () => {
    expect(looksLikeCampaignState(null)).toBe(false);
    expect(looksLikeCampaignState("x")).toBe(false);
    expect(looksLikeCampaignState({ points: 1 })).toBe(false);
    expect(looksLikeCampaignState(createWardenCampaignState())).toBe(true);
  });
});
