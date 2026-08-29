// Campaign-persistence pass (engine/campaignState.ts, Build Brief step 11 /
// the campaign doc's "Recruit-phase mechanic," 22 Aug 2026): the live
// Munti-gated permadeath check ("if there a muntie there is restock. no
// munties no restock." — Maxime), the pilot_rourke exemption ("the only
// character that is safe is the mc."), the deploy gate ("cant go into
// mission without a munties"), and the two recruit tracks (automatic
// emergency Munti replacement, discretionary paid recruiting). See that
// file's own header for the full design-doc citations.
import { describe, it, expect } from "vitest";
import {
  createCampaignState,
  createWardenCampaignState,
  evaluatePermadeathCheck,
  applyPermadeathCheck,
  canLaunchMission,
  checkMuntiGuarantee,
  recruitDiscretionary,
  saveCampaignState,
  loadCampaignState,
  clearCampaignState,
  evaluateMissionTimeout,
  applyMissionTimeout,
  MISSION_REAL_TIME_LIMIT_MS,
  DISCRETIONARY_RECRUIT_COST,
  ensureHubSocialState,
  ensureNpcSocialState,
  integrateSecondLance,
  integrateThirdLance,
  deriveRourkeRank,
  rankDisplayTitle,
  MANUAL_SAVE_SLOT_COUNT,
  manualSaveSlotKey,
  saveManualSlot,
  listManualSlots,
  loadManualSlot,
  clearManualSlot,
  type CampaignStorage,
} from "../campaignState";
import { testUnit } from "./testHelpers";
import { WARDEN_PILOTS, WARDEN_MEKS, SECOND_LANCE_PILOTS, THIRD_LANCE_PILOTS } from "../../data/campaignAmaranth";

describe("createCampaignState / createWardenCampaignState", () => {
  it("seeds every pilot as active, at the record's own tier, and copies rather than aliases the static rows", () => {
    const state = createWardenCampaignState();
    expect(Object.keys(state.pilots)).toHaveLength(WARDEN_PILOTS.length);
    for (const p of WARDEN_PILOTS) {
      expect(state.pilots[p.id].status).toBe("active");
      expect(state.pilots[p.id].pilot.tier).toBe(p.tier);
    }

    // Mutating the campaign's copy must never mutate the static roster —
    // the whole point of the "own copy, not a resolved reference" design
    // decision documented in campaignState.ts's header.
    state.pilots["pilot_lask"].pilot.tier = "A";
    const staticLask = WARDEN_PILOTS.find((p) => p.id === "pilot_lask")!;
    expect(staticLask.tier).toBe("G");
  });

  it("seeds mek spare parts as independent mutable copies too", () => {
    const state = createWardenCampaignState();
    expect(Object.keys(state.meks)).toHaveLength(Object.keys(WARDEN_MEKS).length);
    state.meks["mek_lask"].spareParts = 99;
    expect(WARDEN_MEKS["mek_lask"].spareParts).toBe(0);
  });

  it("defaults points to 0, accepts a starting balance", () => {
    expect(createWardenCampaignState().points).toBe(0);
    expect(createWardenCampaignState(500).points).toBe(500);
  });
});

describe("evaluatePermadeathCheck — rule 1, the live Munti-presence check", () => {
  it("a living Munti elsewhere on the same side means a standard restock (not permanent)", () => {
    const downed = testUnit("meeps", { x: 0, y: 0 });
    downed.pilotId = "pilot_nagori"; // Team One roster — not exempt
    downed.downed = true;
    const munti = testUnit("munti", { x: 1, y: 0 });
    munti.pilotId = "pilot_barasj";

    const result = evaluatePermadeathCheck(downed, [downed, munti]);
    expect(result.permanent).toBe(false);
    expect(result.reason).toMatch(/living Munti/);
  });

  it("no living Munti anywhere on the side means a permanent loss", () => {
    const downed = testUnit("meeps", { x: 0, y: 0 });
    downed.pilotId = "pilot_nagori";
    downed.downed = true;
    const otherAlive = testUnit("tank", { x: 1, y: 0 });
    otherAlive.pilotId = "pilot_thyns";

    const result = evaluatePermadeathCheck(downed, [downed, otherAlive]);
    expect(result.permanent).toBe(true);
    expect(result.reason).toMatch(/no living Munti/);
  });

  it("a Munti that is already downed elsewhere on the side does not count as a living safety net", () => {
    const downed = testUnit("meeps", { x: 0, y: 0 });
    downed.pilotId = "pilot_nagori";
    downed.downed = true;
    const downedMunti = testUnit("munti", { x: 1, y: 0 });
    downedMunti.pilotId = "pilot_barasj";
    downedMunti.downed = true;

    const result = evaluatePermadeathCheck(downed, [downed, downedMunti]);
    expect(result.permanent).toBe(true);
  });

  it("the sole-Munti-going-down case: a Munti cannot save itself — evaluating its own downing must not count itself as the living Munti it's checking for", () => {
    const soleMunti = testUnit("munti", { x: 0, y: 0 });
    soleMunti.pilotId = "pilot_barasj";
    soleMunti.downed = true; // already flipped true before handleDowned runs, matching the real call order

    const result = evaluatePermadeathCheck(soleMunti, [soleMunti]);
    expect(result.permanent).toBe(true);
    expect(result.reason).toMatch(/no living Munti/);
  });

  it("a second, still-living Munti DOES save a Munti that just went down", () => {
    const downedMunti = testUnit("munti", { x: 0, y: 0 });
    downedMunti.pilotId = "pilot_barasj";
    downedMunti.downed = true;
    const backupMunti = testUnit("munti", { x: 1, y: 0 });
    backupMunti.pilotId = "pilot_lask";

    const result = evaluatePermadeathCheck(downedMunti, [downedMunti, backupMunti]);
    expect(result.permanent).toBe(false);
  });

  it("Rourke's exemption overrides everything, including zero living Munti anywhere", () => {
    const rourke = testUnit("meeps", { x: 0, y: 0 });
    rourke.pilotId = "pilot_rourke";
    rourke.downed = true;

    const result = evaluatePermadeathCheck(rourke, [rourke]);
    expect(result.permanent).toBe(false);
    expect(result.reason).toMatch(/exempt/);
  });

  it("Rourke's exemption applies even when a living Munti is also present — same outcome, different reason path", () => {
    const rourke = testUnit("meeps", { x: 0, y: 0 });
    rourke.pilotId = "pilot_rourke";
    rourke.downed = true;
    const munti = testUnit("munti", { x: 1, y: 0 });
    munti.pilotId = "pilot_lask";

    const result = evaluatePermadeathCheck(rourke, [rourke, munti]);
    expect(result.permanent).toBe(false);
    expect(result.reason).toMatch(/exempt/);
  });

  it("a hostile-side or pilotless unit is a no-op (not campaign-tracked) rather than a crash", () => {
    const hostile = testUnit("tank", { x: 0, y: 0 });
    hostile.side = "hostile";
    hostile.pilotId = undefined;
    hostile.downed = true;
    expect(evaluatePermadeathCheck(hostile, [hostile]).permanent).toBe(false);
  });
});

describe("applyPermadeathCheck — wiring the check into a CampaignState", () => {
  it("flips a permanently-lost pilot's status and leaves a restocked pilot untouched", () => {
    const state = createWardenCampaignState();
    const downed = testUnit("reeps", { x: 0, y: 0 });
    downed.pilotId = "pilot_anand"; // Warden roster, not exempt
    downed.downed = true;
    // No living Munti in sameSideUnits at all.
    const result = applyPermadeathCheck(state, downed, [downed]);
    expect(result.permanent).toBe(true);
    expect(state.pilots["pilot_anand"].status).toBe("permanently_lost");

    // A second downing, this time with the Munti present, must restock —
    // confirms the check is re-evaluated fresh, not latched from the
    // first call.
    const downed2 = testUnit("tank", { x: 0, y: 0 });
    downed2.pilotId = "pilot_bosk";
    downed2.downed = true;
    const munti = testUnit("munti", { x: 1, y: 0 });
    munti.pilotId = "pilot_lask";
    applyPermadeathCheck(state, downed2, [downed2, munti]);
    expect(state.pilots["pilot_bosk"].status).toBe("active");
  });
});

describe("canLaunchMission — rule 5, the deploy gate", () => {
  it("allows launch when an active Munti is among the deploying ids", () => {
    const state = createWardenCampaignState();
    const result = canLaunchMission(WARDEN_PILOTS.map((p) => p.id), state);
    expect(result.ok).toBe(true);
  });

  it("refuses launch when no Munti is in the deploying squad", () => {
    const state = createWardenCampaignState();
    const nonMuntiIds = WARDEN_PILOTS.filter((p) => p.id !== "pilot_lask").map((p) => p.id);
    const result = canLaunchMission(nonMuntiIds, state);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Munti/);
  });

  it("refuses launch when the only Munti in the squad is permanently lost", () => {
    const state = createWardenCampaignState();
    state.pilots["pilot_lask"].status = "permanently_lost";
    const result = canLaunchMission(WARDEN_PILOTS.map((p) => p.id), state);
    expect(result.ok).toBe(false);
  });

  it("an unknown/undeployed pilot id in the list is simply ignored, not a crash", () => {
    const state = createWardenCampaignState();
    const result = canLaunchMission(["pilot_lask", "not_a_real_pilot"], state);
    expect(result.ok).toBe(true);
  });
});

describe("checkMuntiGuarantee — rule 6, the unconditional emergency replacement", () => {
  it("is a no-op when the campaign still has a living Munti", () => {
    const state = createWardenCampaignState();
    const before = Object.keys(state.pilots).length;
    const result = checkMuntiGuarantee(state);
    expect(result.recruited).toBe(false);
    expect(result.pilot).toBeUndefined();
    expect(Object.keys(state.pilots)).toHaveLength(before);
  });

  it("generates a free Munti-class pilot the instant living Munti count hits zero, and it is always valid", () => {
    const state = createWardenCampaignState();
    state.pilots["pilot_lask"].status = "permanently_lost"; // the only Munti in the Warden roster
    const pointsBefore = state.points;

    const result = checkMuntiGuarantee(state);
    expect(result.recruited).toBe(true);
    expect(result.pilot).toBeDefined();
    expect(result.pilot!.archetypeId).toBe("arch_munti_bipedal");
    expect(result.pilot!.tier).toBe("G"); // fresh, no carried-over tier investment
    expect(state.points).toBe(pointsBefore); // unconditional — costs nothing

    const entry = state.pilots[result.pilot!.id];
    expect(entry).toBeDefined();
    expect(entry.status).toBe("active");
    // A fresh, default mek exists too — not a reused/lost pilot's mek.
    expect(state.meks[result.pilot!.mekId]).toBeDefined();
    expect(state.meks[result.pilot!.mekId].spareParts).toBe(0);

    // And it un-blocks the deploy gate immediately.
    expect(canLaunchMission([result.pilot!.id], state).ok).toBe(true);
  });

  it("never fails — calling it repeatedly with zero Muntis each time keeps producing valid, uniquely-identified recruits", () => {
    const state = createCampaignState([], {}, 0); // an empty roster — always zero Muntis
    const first = checkMuntiGuarantee(state);
    const second = checkMuntiGuarantee(state); // still zero active Muntis? No — first call added one.
    expect(first.recruited).toBe(true);
    // The first recruit is now the campaign's living Munti, so the second
    // call should be a no-op, proving the check re-reads live state each
    // time rather than caching a stale "zero Muntis" verdict.
    expect(second.recruited).toBe(false);
    expect(first.pilot!.id).not.toBe(second.pilot?.id);
  });
});

describe("recruitDiscretionary — rule 6, the paid, fallible recruit track", () => {
  it("succeeds and deducts points when the campaign can afford it, producing a pilot of the requested class", () => {
    const state = createWardenCampaignState(DISCRETIONARY_RECRUIT_COST);
    const result = recruitDiscretionary(state, "tank");
    expect(result.ok).toBe(true);
    expect(result.pilot!.archetypeId).toBe("arch_tank_bipedal");
    expect(result.pilot!.tier).toBe("G");
    expect(state.points).toBe(0);
    expect(state.pilots[result.pilot!.id].status).toBe("active");
  });

  it("fails with a clear reason and changes nothing when the campaign cannot afford it", () => {
    const state = createWardenCampaignState(DISCRETIONARY_RECRUIT_COST - 1);
    const rosterSizeBefore = Object.keys(state.pilots).length;
    const result = recruitDiscretionary(state, "munti");
    expect(result.ok).toBe(false);
    expect(result.pilot).toBeUndefined();
    expect(result.reason).toMatch(/not enough points/);
    expect(state.points).toBe(DISCRETIONARY_RECRUIT_COST - 1); // untouched
    expect(Object.keys(state.pilots)).toHaveLength(rosterSizeBefore); // untouched
  });

  it("can recruit a second Munti proactively, before the roster ever hits zero", () => {
    const state = createWardenCampaignState(DISCRETIONARY_RECRUIT_COST);
    const result = recruitDiscretionary(state, "munti");
    expect(result.ok).toBe(true);
    expect(result.pilot!.archetypeId).toBe("arch_munti_bipedal");
    // The original Munti (Lask) is still there too — two now.
    const muntiCount = Object.values(state.pilots).filter(
      (e) => e.status === "active" && e.pilot.archetypeId === "arch_munti_bipedal"
    ).length;
    expect(muntiCount).toBe(2);
  });

  it("generated pilots from repeated calls always get unique ids and callsigns", () => {
    const state = createWardenCampaignState(DISCRETIONARY_RECRUIT_COST * 3);
    const a = recruitDiscretionary(state, "reeps").pilot!;
    const b = recruitDiscretionary(state, "reeps").pilot!;
    const c = recruitDiscretionary(state, "reeps").pilot!;
    const ids = [a.id, b.id, c.id];
    const names = [a.displayName, b.displayName, c.displayName];
    expect(new Set(ids).size).toBe(3);
    expect(new Set(names).size).toBe(3);
  });
});

describe("save / load / clear — basic localStorage-shaped persistence", () => {
  function memoryStorage(): CampaignStorage {
    const backing = new Map<string, string>();
    return {
      getItem: (k) => backing.get(k) ?? null,
      setItem: (k, v) => void backing.set(k, v),
      removeItem: (k) => void backing.delete(k),
    };
  }

  it("round-trips a campaign state exactly", () => {
    const storage = memoryStorage();
    const state = createWardenCampaignState(250);
    state.pilots["pilot_lask"].pilot.tier = "D";
    saveCampaignState(state, storage);

    const loaded = loadCampaignState(storage);
    expect(loaded).not.toBeNull();
    expect(loaded!.points).toBe(250);
    expect(loaded!.pilots["pilot_lask"].pilot.tier).toBe("D");
  });

  it("returns null when there is nothing saved yet", () => {
    expect(loadCampaignState(memoryStorage())).toBeNull();
  });

  it("returns null rather than throwing on a corrupt stored value", () => {
    const storage = memoryStorage();
    storage.setItem("bloomwars_campaign_state_v1", "{not valid json");
    expect(loadCampaignState(storage)).toBeNull();
  });

  it("clearCampaignState removes a saved entry", () => {
    const storage = memoryStorage();
    saveCampaignState(createWardenCampaignState(), storage);
    clearCampaignState(storage);
    expect(loadCampaignState(storage)).toBeNull();
  });

  it("save/load are safe no-ops when no storage is available at all (headless sim / plain Node)", () => {
    // No injected storage, and this test file runs under vitest's default
    // Node environment, where the `localStorage` global doesn't exist —
    // exactly the npm run sim / npm test situation these functions must
    // not crash under.
    expect(() => saveCampaignState(createWardenCampaignState())).not.toThrow();
    expect(loadCampaignState()).toBeNull();
    expect(() => clearCampaignState()).not.toThrow();
  });

  // Main Menu / Save / Ironman UI Plan v1 §6, 28 Aug 2026 — the key-override
  // param that lets a manual save slot reuse this same save/load/clear
  // machinery instead of needing its own.
  it("save/load/clear all default to the live key, unaffected by the new optional key param", () => {
    const storage = memoryStorage();
    const state = createWardenCampaignState(99);
    saveCampaignState(state, storage); // no key passed — same as every existing autosave call site
    expect(loadCampaignState(storage)!.points).toBe(99);
    clearCampaignState(storage);
    expect(loadCampaignState(storage)).toBeNull();
  });

  it("a manual slot key is a fully independent save, alongside the live one", () => {
    const storage = memoryStorage();
    const live = createWardenCampaignState(10);
    const slotState = createWardenCampaignState(500);
    saveCampaignState(live, storage);
    saveCampaignState(slotState, storage, manualSaveSlotKey(0));

    expect(loadCampaignState(storage)!.points).toBe(10);
    expect(loadCampaignState(storage, manualSaveSlotKey(0))!.points).toBe(500);

    clearCampaignState(storage, manualSaveSlotKey(0));
    expect(loadCampaignState(storage, manualSaveSlotKey(0))).toBeNull();
    expect(loadCampaignState(storage)!.points).toBe(10); // clearing a slot never touches the live key
  });

  it("manualSaveSlotKey produces MANUAL_SAVE_SLOT_COUNT distinct keys", () => {
    const keys = new Set<string>();
    for (let i = 0; i < MANUAL_SAVE_SLOT_COUNT; i++) keys.add(manualSaveSlotKey(i));
    expect(keys.size).toBe(MANUAL_SAVE_SLOT_COUNT);
  });
});

// Mission real-time clock (25 Aug 2026 — Maxime: "force a failed mission
// if you take more than 12hour to do the mission... 12hour real time btw.
// from the computer or web clock"). `now` is always passed in explicitly
// below rather than read via Date.now() — these tests assert the exact
// 12-hour boundary, which would otherwise mean actually waiting 12 hours.
describe("evaluateMissionTimeout / applyMissionTimeout — the 12-hour real-time clock", () => {
  it("no active attempt at all reads as not timed out", () => {
    const state = createWardenCampaignState();
    expect(evaluateMissionTimeout(state, Date.now()).timedOut).toBe(false);
  });

  it("well under 12 hours is not timed out", () => {
    const state = createWardenCampaignState();
    const startedAt = 1_000_000;
    state.activeMissionAttempt = { missionId: "mission_amaranth_5", startedAt };
    const result = evaluateMissionTimeout(state, startedAt + 6 * 60 * 60 * 1000); // 6h later
    expect(result.timedOut).toBe(false);
  });

  it("exactly 12 hours elapsed counts as timed out, not one tick short", () => {
    const state = createWardenCampaignState();
    const startedAt = 1_000_000;
    state.activeMissionAttempt = { missionId: "mission_amaranth_5", startedAt };
    const result = evaluateMissionTimeout(state, startedAt + MISSION_REAL_TIME_LIMIT_MS);
    expect(result.timedOut).toBe(true);
    expect(result.missionId).toBe("mission_amaranth_5");
    expect(result.elapsedMs).toBe(MISSION_REAL_TIME_LIMIT_MS);
  });

  it("well past 12 hours is timed out, and evaluate never mutates state", () => {
    const state = createWardenCampaignState();
    const startedAt = 1_000_000;
    state.activeMissionAttempt = { missionId: "mission_amaranth_9", startedAt };
    const result = evaluateMissionTimeout(state, startedAt + 20 * 60 * 60 * 1000); // 20h later
    expect(result.timedOut).toBe(true);
    // Pure check — the attempt is still sitting there until apply runs.
    expect(state.activeMissionAttempt).toEqual({ missionId: "mission_amaranth_9", startedAt });
  });

  it("applyMissionTimeout clears the attempt when timed out, and leaves the rest of the roster untouched — Maxime's own call: 'forcefully recalled to ship for a dressing down by the co,' not a real loss", () => {
    const state = createWardenCampaignState(150);
    const rourkeBefore = { ...state.pilots["pilot_rourke"] };
    const startedAt = 1_000_000;
    state.activeMissionAttempt = { missionId: "mission_amaranth_12", startedAt };

    const result = applyMissionTimeout(state, startedAt + MISSION_REAL_TIME_LIMIT_MS + 1);

    expect(result.timedOut).toBe(true);
    expect(state.activeMissionAttempt).toBeUndefined();
    // No permadeath roll, no earnings change, no status flip — a timeout
    // costs nothing mechanical, only the wasted real-world time.
    expect(state.points).toBe(150);
    expect(state.pilots["pilot_rourke"]).toEqual(rourkeBefore);
  });

  it("applyMissionTimeout is a safe no-op when the attempt hasn't actually timed out yet", () => {
    const state = createWardenCampaignState();
    const startedAt = 1_000_000;
    state.activeMissionAttempt = { missionId: "mission_amaranth_3", startedAt };

    const result = applyMissionTimeout(state, startedAt + 60 * 60 * 1000); // 1h later
    expect(result.timedOut).toBe(false);
    expect(state.activeMissionAttempt).toEqual({ missionId: "mission_amaranth_3", startedAt });
  });

  it("round-trips activeMissionAttempt through save/load exactly, same as every other field", () => {
    function memoryStorage(): CampaignStorage {
      const backing = new Map<string, string>();
      return {
        getItem: (k) => backing.get(k) ?? null,
        setItem: (k, v) => void backing.set(k, v),
        removeItem: (k) => void backing.delete(k),
      };
    }
    const storage = memoryStorage();
    const state = createWardenCampaignState();
    state.activeMissionAttempt = { missionId: "mission_amaranth_20", startedAt: 42 };
    saveCampaignState(state, storage);

    const loaded = loadCampaignState(storage);
    expect(loaded!.activeMissionAttempt).toEqual({ missionId: "mission_amaranth_20", startedAt: 42 });
  });

  it("a save from before this pass existed (no activeMissionAttempt field at all) loads and evaluates as not timed out, not a crash", () => {
    function memoryStorage(): CampaignStorage {
      const backing = new Map<string, string>();
      return {
        getItem: (k) => backing.get(k) ?? null,
        setItem: (k, v) => void backing.set(k, v),
        removeItem: (k) => void backing.delete(k),
      };
    }
    const storage = memoryStorage();
    const state = createWardenCampaignState();
    // Simulates an old save: serialize, then strip the field a pre-this-pass
    // save would never have had, rather than relying on TypeScript to stop
    // us from constructing an invalid object directly.
    const raw = JSON.parse(JSON.stringify(state));
    delete raw.activeMissionAttempt;
    storage.setItem("bloomwars_campaign_state_v1", JSON.stringify(raw));

    const loaded = loadCampaignState(storage);
    expect(loaded).not.toBeNull();
    expect(evaluateMissionTimeout(loaded!, Date.now()).timedOut).toBe(false);
  });
});

// Section 11 (26 Aug 2026) — the Hub's persistent Favorability/Stress/
// Morale/relationship/social-log. Hub.ts's buildNpcs() and
// persistNpcSocial() are the real callers (a live Phaser scene, not
// unit-testable here); these pin the pure helper's own contract directly —
// seed-once, hand-back-the-same-object-after, fails open on a missing
// entry, and survives the same save/load round trip everything else in
// this file does.
describe("ensureHubSocialState — section 11, the Hub's persistent social state", () => {
  it("seeds from the given values the first time a pilot is ever asked for, and attaches the result to the CampaignPilotEntry", () => {
    const state = createWardenCampaignState();
    const social = ensureHubSocialState(state, "pilot_bosk", { favorability: 35, stress: 30, morale: 75 });
    expect(social).toEqual({ favorability: 35, stress: 30, morale: 75, inRelationship: false, socialLog: [] });
    expect(state.pilots["pilot_bosk"].social).toBe(social); // attached, not a detached copy
  });

  it("a second call for the same pilot returns the SAME object and ignores the seed — proves state isn't silently reset every time buildNpcs() runs", () => {
    const state = createWardenCampaignState();
    const first = ensureHubSocialState(state, "pilot_anand", { favorability: 10, stress: 78, morale: 60 });
    first.favorability = 62; // simulates Hub.ts having persisted a real mutation
    first.socialLog.push({ verb: "shareADrink", line: "cheers", at: 12345 });

    const second = ensureHubSocialState(state, "pilot_anand", { favorability: 10, stress: 78, morale: 60 });
    expect(second).toBe(first);
    expect(second.favorability).toBe(62); // NOT reset back to the seed's 10
    expect(second.socialLog).toHaveLength(1);
  });

  it("mutations round-trip through save/load exactly, same as every other field in CampaignState", () => {
    function memoryStorage(): CampaignStorage {
      const backing = new Map<string, string>();
      return {
        getItem: (k) => backing.get(k) ?? null,
        setItem: (k, v) => void backing.set(k, v),
        removeItem: (k) => void backing.delete(k),
      };
    }
    const storage = memoryStorage();
    const state = createWardenCampaignState();
    const social = ensureHubSocialState(state, "pilot_iyari", { favorability: -5, stress: 40, morale: 68 });
    social.favorability = 55;
    social.inRelationship = false; // Iyari is Hiopi — capped at close-friend, never actually true, but the field still round-trips
    social.socialLog.push({ verb: "pegBoard", line: "good game", at: 999 });
    saveCampaignState(state, storage);

    const loaded = loadCampaignState(storage);
    expect(loaded!.pilots["pilot_iyari"].social).toEqual({
      favorability: 55,
      stress: 40,
      morale: 68,
      inRelationship: false,
      socialLog: [{ verb: "pegBoard", line: "good game", at: 999 }],
    });
  });

  it("fails open for a pilotId with no CampaignPilotEntry at all — returns a fresh, usable object instead of throwing", () => {
    const state = createWardenCampaignState();
    const social = ensureHubSocialState(state, "pilot_does_not_exist", { favorability: 0, stress: 0, morale: 0 });
    expect(social).toEqual({ favorability: 0, stress: 0, morale: 0, inRelationship: false, socialLog: [] });
    expect(state.pilots["pilot_does_not_exist"]).toBeUndefined(); // nothing to hang it off of — correctly not persisted
  });

  it("a save from before this field existed (a CampaignPilotEntry with no social key) seeds fresh on first access, not a crash", () => {
    const state = createWardenCampaignState();
    // No ensureHubSocialState call yet — state.pilots["pilot_bosk"].social
    // is genuinely undefined here, matching a real pre-26-Aug-2026 save.
    expect(state.pilots["pilot_bosk"].social).toBeUndefined();

    const social = ensureHubSocialState(state, "pilot_bosk", { favorability: 35, stress: 30, morale: 75 });
    expect(social.favorability).toBe(35);
    expect(state.pilots["pilot_bosk"].social).toBeDefined();
  });

  // drunkUntil, 26 Aug 2026 — added the same day as the field itself
  // (Maxime: "drunk should last for a bit"). This is the field that makes
  // shareADrink's timer survive a reload instead of resetting to sober —
  // same round-trip contract as every other field above, pinned separately
  // since it's the newest and the one most likely to regress silently
  // (an optional field is easy to forget in a future refactor of this
  // object's shape).
  it("drunkUntil round-trips through save/load exactly", () => {
    function memoryStorage(): CampaignStorage {
      const backing = new Map<string, string>();
      return {
        getItem: (k) => backing.get(k) ?? null,
        setItem: (k, v) => void backing.set(k, v),
        removeItem: (k) => void backing.delete(k),
      };
    }
    const storage = memoryStorage();
    const state = createWardenCampaignState();
    const social = ensureHubSocialState(state, "pilot_bosk", { favorability: 20, stress: 15, morale: 80 });
    const until = Date.now() + 5 * 60 * 1000;
    social.drunkUntil = until;
    saveCampaignState(state, storage);

    const loaded = loadCampaignState(storage);
    expect(loaded!.pilots["pilot_bosk"].social).toEqual({
      favorability: 20,
      stress: 15,
      morale: 80,
      inRelationship: false,
      socialLog: [],
      drunkUntil: until,
    });
  });

  it("a save from before drunkUntil existed (social present, but no drunkUntil key) loads with it simply absent, not a crash or a false-drunk", () => {
    function memoryStorage(): CampaignStorage {
      const backing = new Map<string, string>();
      return {
        getItem: (k) => backing.get(k) ?? null,
        setItem: (k, v) => void backing.set(k, v),
        removeItem: (k) => void backing.delete(k),
      };
    }
    const storage = memoryStorage();
    const state = createWardenCampaignState();
    ensureHubSocialState(state, "pilot_bosk", { favorability: 20, stress: 15, morale: 80 });
    // Simulate an actual pre-drunkUntil save on disk: serialize, then strip
    // the key the way an older build's JSON simply wouldn't have had it —
    // same technique the mission-timeout test above uses for the same
    // reason (real old saves, not what a fresh seed happens to produce).
    saveCampaignState(state, storage);
    const raw = JSON.parse(storage.getItem("bloomwars_campaign_state_v1")!);
    delete raw.pilots["pilot_bosk"].social.drunkUntil;
    storage.setItem("bloomwars_campaign_state_v1", JSON.stringify(raw));

    const loaded = loadCampaignState(storage);
    expect(loaded!.pilots["pilot_bosk"].social!.drunkUntil).toBeUndefined();
  });
});

// Section 12, 26 Aug 2026 — the background social-sim harness
// (engine/socialSim.ts). Same "seed once, hand back the same object after"
// contract as ensureHubSocialState above, except there's exactly one of
// these per CampaignState (a bond belongs to a PAIR, not one pilot), so
// there's no missing-CampaignPilotEntry fail-open case to cover the way
// section 11's own tests do.
describe("ensureNpcSocialState — section 12, persistent NPC-to-NPC bonds", () => {
  it("seeds bonds from the given seed the first time it's asked for, with an empty relationships list", () => {
    const state = createWardenCampaignState();
    const seed = { "pilot_anand::pilot_bosk": 40, "pilot_bosk::pilot_iyari": 5 };
    const social = ensureNpcSocialState(state, seed);
    expect(social).toEqual({ bonds: { "pilot_anand::pilot_bosk": 40, "pilot_bosk::pilot_iyari": 5 }, relationships: [] });
    expect(state.npcSocial).toBe(social); // attached to the CampaignState itself, not a detached copy
  });

  it("seeding copies the seed object rather than aliasing it — mutating the returned bonds never mutates the caller's original seed constant", () => {
    const state = createWardenCampaignState();
    const seed = { "pilot_anand::pilot_bosk": 40 };
    const social = ensureNpcSocialState(state, seed);
    social.bonds["pilot_anand::pilot_bosk"] = 99;
    expect(seed["pilot_anand::pilot_bosk"]).toBe(40); // the module-level NPC_BOND_SEED-style constant must stay untouched
  });

  it("a second call for the same CampaignState returns the SAME object and ignores the seed — proves a real run's bond movement isn't silently reset", () => {
    const state = createWardenCampaignState();
    const first = ensureNpcSocialState(state, { "pilot_anand::pilot_bosk": 40 });
    first.bonds["pilot_anand::pilot_bosk"] = 46;
    first.relationships.push("pilot_bosk::pilot_iyari");

    const second = ensureNpcSocialState(state, { "pilot_anand::pilot_bosk": 40 });
    expect(second).toBe(first);
    expect(second.bonds["pilot_anand::pilot_bosk"]).toBe(46); // NOT reset back to the seed's 40
    expect(second.relationships).toEqual(["pilot_bosk::pilot_iyari"]);
  });

  it("defaults to an empty seed when none is given — a fresh, empty bond store rather than a crash", () => {
    const state = createWardenCampaignState();
    const social = ensureNpcSocialState(state);
    expect(social).toEqual({ bonds: {}, relationships: [] });
  });

  it("bonds and relationships round-trip through save/load exactly", () => {
    function memoryStorage(): CampaignStorage {
      const backing = new Map<string, string>();
      return {
        getItem: (k) => backing.get(k) ?? null,
        setItem: (k, v) => void backing.set(k, v),
        removeItem: (k) => void backing.delete(k),
      };
    }
    const storage = memoryStorage();
    const state = createWardenCampaignState();
    const social = ensureNpcSocialState(state, { "pilot_anand::pilot_bosk": 40 });
    social.bonds["pilot_anand::pilot_bosk"] = 52;
    social.relationships.push("pilot_anand::pilot_bosk");
    saveCampaignState(state, storage);

    const loaded = loadCampaignState(storage);
    expect(loaded!.npcSocial).toEqual({
      bonds: { "pilot_anand::pilot_bosk": 52 },
      relationships: ["pilot_anand::pilot_bosk"],
    });
  });

  it("a save from before section 12 existed (no npcSocial key at all) loads with it simply absent, not a crash", () => {
    function memoryStorage(): CampaignStorage {
      const backing = new Map<string, string>();
      return {
        getItem: (k) => backing.get(k) ?? null,
        setItem: (k, v) => void backing.set(k, v),
        removeItem: (k) => void backing.delete(k),
      };
    }
    const storage = memoryStorage();
    const state = createWardenCampaignState(); // never touches ensureNpcSocialState — simulates a real pre-26-Aug-2026 save
    saveCampaignState(state, storage);

    const loaded = loadCampaignState(storage);
    expect(loaded!.npcSocial).toBeUndefined();
    // And confirms ensureNpcSocialState still seeds cleanly on top of that old save, same as section 11's own equivalent test.
    const social = ensureNpcSocialState(loaded!, { "pilot_anand::pilot_bosk": 40 });
    expect(social.bonds["pilot_anand::pilot_bosk"]).toBe(40);
  });
});

// Section 8/8a, 27 Aug 2026 — rourkeRank's own wiring, found dead while
// building the "Hello, Sir" rank-greeting mechanic: initialized once in
// createWardenCampaignState, read every mission by campaignEconomy.ts's
// CO_BONUS_BY_RANK, but never previously written by integrateSecondLance/
// integrateThirdLance despite their own doc comments already citing
// Rourke's promotions as landing on exactly those two beats. No test file
// covered integrateSecondLance/integrateThirdLance's roster-integration
// behavior at all before this pass either — covered here alongside the
// rank fix rather than left untested.
describe("integrateSecondLance / integrateThirdLance — roster integration and Rourke's rank, 27 Aug 2026", () => {
  it("integrateSecondLance adds the five Second Lance pilots/meks and promotes rourkeRank to capt", () => {
    const state = createWardenCampaignState();
    expect(state.rourkeRank).toBe("2nd_lt");
    const result = integrateSecondLance(state);
    expect(result.integrated).toBe(true);
    expect(result.pilots).toBe(SECOND_LANCE_PILOTS);
    for (const p of SECOND_LANCE_PILOTS) expect(state.pilots[p.id]?.status).toBe("active");
    expect(state.rourkeRank).toBe("capt");
  });

  it("integrateSecondLance is idempotent — a second call adds nothing and reports integrated: false", () => {
    const state = createWardenCampaignState();
    integrateSecondLance(state);
    const rosterSize = Object.keys(state.pilots).length;
    const second = integrateSecondLance(state);
    expect(second.integrated).toBe(false);
    expect(second.pilots).toBeUndefined();
    expect(Object.keys(state.pilots)).toHaveLength(rosterSize);
    expect(state.rourkeRank).toBe("capt"); // unchanged, not reset
  });

  it("integrateThirdLance adds the five Third Lance pilots/meks and promotes rourkeRank to maj", () => {
    const state = createWardenCampaignState();
    integrateSecondLance(state); // realistic ordering — Third Lance's own trigger (Mission 24) always comes after Second Lance's (Mission 12)
    const result = integrateThirdLance(state);
    expect(result.integrated).toBe(true);
    expect(result.pilots).toBe(THIRD_LANCE_PILOTS);
    for (const p of THIRD_LANCE_PILOTS) expect(state.pilots[p.id]?.status).toBe("active");
    expect(state.rourkeRank).toBe("maj");
  });

  it("integrateThirdLance is idempotent — a second call adds nothing and reports integrated: false", () => {
    const state = createWardenCampaignState();
    integrateSecondLance(state);
    integrateThirdLance(state);
    const rosterSize = Object.keys(state.pilots).length;
    const second = integrateThirdLance(state);
    expect(second.integrated).toBe(false);
    expect(Object.keys(state.pilots)).toHaveLength(rosterSize);
    expect(state.rourkeRank).toBe("maj");
  });
});

describe("deriveRourkeRank — pure roster-derived rank, 27 Aug 2026", () => {
  it("a fresh campaign derives 2nd_lt", () => {
    expect(deriveRourkeRank(createWardenCampaignState())).toBe("2nd_lt");
  });

  it("a roster with Second Lance integrated (not Third) derives capt", () => {
    const state = createWardenCampaignState();
    integrateSecondLance(state);
    expect(deriveRourkeRank(state)).toBe("capt");
  });

  it("a roster with Third Lance integrated derives maj, even if rourkeRank itself was never touched", () => {
    const state = createWardenCampaignState();
    integrateSecondLance(state);
    integrateThirdLance(state);
    state.rourkeRank = "2nd_lt"; // simulate a pre-fix save where the roster advanced but the rank field never did
    expect(deriveRourkeRank(state)).toBe("maj");
  });
});

describe("loadCampaignState backfills a stale rourkeRank, 27 Aug 2026", () => {
  function memoryStorage(): CampaignStorage {
    const backing = new Map<string, string>();
    return {
      getItem: (k) => backing.get(k) ?? null,
      setItem: (k, v) => void backing.set(k, v),
      removeItem: (k) => void backing.delete(k),
    };
  }

  it("a save that already has Third Lance integrated but a stale 2nd_lt rourkeRank (a real pre-fix save) loads corrected to maj", () => {
    const storage = memoryStorage();
    const state = createWardenCampaignState();
    integrateSecondLance(state);
    integrateThirdLance(state);
    state.rourkeRank = "2nd_lt"; // simulate the exact bug: lances integrated, rank field never written
    saveCampaignState(state, storage);

    const loaded = loadCampaignState(storage);
    expect(loaded!.rourkeRank).toBe("maj");
  });

  it("a save that already has Second Lance integrated (not Third) but a stale 2nd_lt rourkeRank loads corrected to capt", () => {
    const storage = memoryStorage();
    const state = createWardenCampaignState();
    integrateSecondLance(state);
    state.rourkeRank = "2nd_lt";
    saveCampaignState(state, storage);

    const loaded = loadCampaignState(storage);
    expect(loaded!.rourkeRank).toBe("capt");
  });

  it("a fresh save with no lances integrated round-trips as 2nd_lt — no false-positive promotion", () => {
    const storage = memoryStorage();
    const state = createWardenCampaignState();
    saveCampaignState(state, storage);

    const loaded = loadCampaignState(storage);
    expect(loaded!.rourkeRank).toBe("2nd_lt");
  });

  it("a save already correctly at maj (post-fix, played entirely after this pass) round-trips unchanged", () => {
    const storage = memoryStorage();
    const state = createWardenCampaignState();
    integrateSecondLance(state);
    integrateThirdLance(state);
    saveCampaignState(state, storage);

    const loaded = loadCampaignState(storage);
    expect(loaded!.rourkeRank).toBe("maj");
  });
});

describe("loadCampaignState backfills a missing ironman field, 28 Aug 2026", () => {
  function memoryStorage(): CampaignStorage {
    const backing = new Map<string, string>();
    return {
      getItem: (k) => backing.get(k) ?? null,
      setItem: (k, v) => void backing.set(k, v),
      removeItem: (k) => void backing.delete(k),
    };
  }

  it("createCampaignState/createWardenCampaignState default to ironman: true", () => {
    expect(createWardenCampaignState().ironman).toBe(true);
  });

  it("a save from before the field existed (JSON with no ironman key at all) backfills to true, not false", () => {
    const storage = memoryStorage();
    const state = createWardenCampaignState();
    // simulate a genuinely pre-this-pass save: strip the field entirely,
    // the way JSON.stringify would if the field never existed on the
    // object in the first place — deleting it, not setting it to undefined,
    // since JSON.stringify drops undefined values too but this is the more
    // honest simulation of "this key was never written."
    const raw = JSON.parse(JSON.stringify(state));
    delete raw.ironman;
    storage.setItem("bloomwars_campaign_state_v1", JSON.stringify(raw));

    const loaded = loadCampaignState(storage);
    expect(loaded!.ironman).toBe(true);
  });

  it("a save with ironman explicitly false (a real non-Ironman campaign) round-trips unchanged", () => {
    const storage = memoryStorage();
    const state = createWardenCampaignState();
    state.ironman = false;
    saveCampaignState(state, storage);

    const loaded = loadCampaignState(storage);
    expect(loaded!.ironman).toBe(false);
  });
});

describe("manual save slots — saveManualSlot / listManualSlots / loadManualSlot / clearManualSlot, 28 Aug 2026", () => {
  function memoryStorage(): CampaignStorage {
    const backing = new Map<string, string>();
    return {
      getItem: (k) => backing.get(k) ?? null,
      setItem: (k, v) => void backing.set(k, v),
      removeItem: (k) => void backing.delete(k),
    };
  }

  it("listManualSlots starts as MANUAL_SAVE_SLOT_COUNT nulls on a fresh storage", () => {
    const slots = listManualSlots(memoryStorage());
    expect(slots.length).toBe(MANUAL_SAVE_SLOT_COUNT);
    expect(slots.every((s) => s === null)).toBe(true);
  });

  it("saveManualSlot writes both the state and its own metadata, independent of the live key", () => {
    const storage = memoryStorage();
    const live = createWardenCampaignState(20);
    saveCampaignState(live, storage);

    const state = createWardenCampaignState(300);
    state.rourkeRank = "capt";
    saveManualSlot(1, state, storage);

    const loadedSlot = loadManualSlot(1, storage);
    expect(loadedSlot!.points).toBe(300);
    expect(loadCampaignState(storage)!.points).toBe(20); // live key untouched

    const meta = listManualSlots(storage);
    expect(meta[1]).not.toBeNull();
    expect(meta[1]!.rourkeRank).toBe("capt");
    expect(meta[1]!.rosterSize).toBe(Object.keys(state.pilots).length); // all active on a fresh state
    expect(meta[0]).toBeNull();
    expect(meta[2]).toBeNull();
  });

  it("clearManualSlot removes both the state and its metadata for that slot only", () => {
    const storage = memoryStorage();
    saveManualSlot(0, createWardenCampaignState(100), storage);
    saveManualSlot(2, createWardenCampaignState(200), storage);

    clearManualSlot(0, storage);

    expect(loadManualSlot(0, storage)).toBeNull();
    expect(listManualSlots(storage)[0]).toBeNull();
    expect(loadManualSlot(2, storage)!.points).toBe(200); // untouched
    expect(listManualSlots(storage)[2]).not.toBeNull();
  });

  it("re-saving the same slot overwrites its state and metadata, not accumulates", () => {
    const storage = memoryStorage();
    saveManualSlot(0, createWardenCampaignState(1), storage);
    saveManualSlot(0, createWardenCampaignState(2), storage);

    expect(loadManualSlot(0, storage)!.points).toBe(2);
    expect(listManualSlots(storage).filter((s) => s !== null).length).toBe(1);
  });
});

// Roadmap #5, 27 Aug 2026 (later pass) — the visible Stage/rank cue.
describe("rankDisplayTitle — the Hub UI's own rank readout, 27 Aug 2026", () => {
  it("maps all three ranks to their real display titles", () => {
    expect(rankDisplayTitle("2nd_lt")).toBe("2nd Lt.");
    expect(rankDisplayTitle("capt")).toBe("Capt.");
    expect(rankDisplayTitle("maj")).toBe("Maj.");
  });
});
