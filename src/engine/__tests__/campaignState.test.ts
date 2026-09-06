// Campaign-persistence pass (engine/campaignState.ts, Build Brief step 11 /
// the campaign doc's "Recruit-phase mechanic," 22 Aug 2026): the live
// Munti-gated permadeath check ("if there a muntie there is restock. no
// munties no restock." — Maxime), the pilot_rourke exemption ("the only
// character that is safe is the mc."), the deploy gate ("cant go into
// mission without a munties"), and the two recruit tracks (automatic
// emergency Munti replacement, discretionary paid recruiting). See that
// file's own header for the full design-doc citations.
import { UNIT_ARCHETYPES } from "../../data/units";
import { describe, it, expect } from "vitest";
import {
  createCampaignState,
  createWardenCampaignState,
  evaluatePermadeathCheck,
  applyPermadeathCheck,
  canLaunchMission,
  checkMuntiGuarantee,
  recruitDiscretionary,
  dischargePilot,
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
  createHouseAmaranthCampaignState,
  companyNameOf,
  DEFAULT_WARDEN_COMPANY_NAME,
  DEFAULT_HOUSE_AMARANTH_COMPANY_NAME,
  lanceOfPilot,
  lanceOfPilotIn,
  lanceOfMek,
  lanceOfMekIn,
  lanceRoster,
  lanceFieldability,
  assignPilotToLance,
  MAX_LANCE_SIZE,
  type LanceId,
  type CampaignState,
  swapPilotLances,
  LANCE_IDS,
  lanceCount,
  activeLanceIds,
  MAX_LANCES,
  lanceDisplayName,
  integrateHouseAmaranthSecondLance,
  recruitIntoLance,
  recruitCandidates,
  awardCallsign,
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

describe("dischargePilot — Pilot Discharge & Roster Pressure, 5 Sep 2026", () => {
  it("discharges an active pilot: status flips, personal points are forfeit, no Munti replacement fires when another Munti is still active", () => {
    const state = createWardenCampaignState();
    state.pilots["pilot_bosk"].personalPoints = 240;
    const result = dischargePilot(state, "pilot_bosk");
    expect(result.ok).toBe(true);
    expect(result.muntiReplacement).toBeUndefined();
    expect(state.pilots["pilot_bosk"].status).toBe("discharged");
    expect(state.pilots["pilot_bosk"].personalPoints).toBe(0);
    // Bosk's tier and mek record are untouched in storage — "forfeit" here
    // means unreachable (no longer active), not deleted, exactly mirroring
    // applyPermadeathCheck's own comment on a permanently-lost pilot.
    expect(state.pilots["pilot_bosk"].pilot.tier).toBe("G");
  });

  it("fails on a pilot id the campaign has never heard of, changing nothing", () => {
    const state = createWardenCampaignState();
    const result = dischargePilot(state, "pilot_does_not_exist");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/no such pilot/);
  });

  it("fails on a pilot who isn't on the active roster anymore (already discharged, or lost)", () => {
    const state = createWardenCampaignState();
    state.pilots["pilot_iyari"].status = "permanently_lost";
    const lostResult = dischargePilot(state, "pilot_iyari");
    expect(lostResult.ok).toBe(false);
    expect(lostResult.reason).toMatch(/not on the active roster/);

    const first = dischargePilot(state, "pilot_anand");
    expect(first.ok).toBe(true);
    const second = dischargePilot(state, "pilot_anand"); // already discharged now
    expect(second.ok).toBe(false);
    expect(second.reason).toMatch(/not on the active roster/);
  });

  it("refuses to discharge the commander (PilotRecord.exemptFromPermadeath), leaving her active and untouched", () => {
    const state = createWardenCampaignState();
    const result = dischargePilot(state, "pilot_rourke");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/commander/);
    expect(state.pilots["pilot_rourke"].status).toBe("active");
  });

  it("discharging the roster's last active Munti immediately mints a free replacement — the Munti-safety fix this function exists for", () => {
    const state = createWardenCampaignState();
    // pilot_lask is the only Munti in the Warden roster (same fact
    // checkMuntiGuarantee's own tests rely on above).
    expect(
      Object.values(state.pilots).filter((e) => e.status === "active" && UNIT_ARCHETYPES[e.pilot.archetypeId]?.path === "munti")
    ).toHaveLength(1);
    const result = dischargePilot(state, "pilot_lask");
    expect(result.ok).toBe(true);
    expect(state.pilots["pilot_lask"].status).toBe("discharged");
    // A fresh Munti was minted in the same call — the roster never actually
    // touches zero active Muntis at any point a save could be read back in.
    expect(result.muntiReplacement).toBeDefined();
    expect(result.muntiReplacement!.archetypeId).toBe("arch_munti_bipedal");
    const activeMuntis = Object.values(state.pilots).filter(
      (e) => e.status === "active" && UNIT_ARCHETYPES[e.pilot.archetypeId]?.path === "munti"
    );
    expect(activeMuntis).toHaveLength(1);
    expect(activeMuntis[0].pilot.id).toBe(result.muntiReplacement!.id);
  });

  it("discharging a second, proactively-recruited Munti does NOT trigger a replacement while the original Munti is still active", () => {
    const state = createWardenCampaignState(DISCRETIONARY_RECRUIT_COST);
    const extra = recruitDiscretionary(state, "munti").pilot!;
    const result = dischargePilot(state, extra.id);
    expect(result.ok).toBe(true);
    expect(result.muntiReplacement).toBeUndefined();
    // pilot_lask, the original, is still there and still active.
    expect(state.pilots["pilot_lask"].status).toBe("active");
  });

  it("has no built-in limit — the same pilot type can be discharged repeatedly across separate recruits with no cooldown", () => {
    const state = createWardenCampaignState(DISCRETIONARY_RECRUIT_COST * 2);
    const a = recruitDiscretionary(state, "tank").pilot!;
    const b = recruitDiscretionary(state, "tank").pilot!;
    expect(dischargePilot(state, a.id).ok).toBe(true);
    expect(dischargePilot(state, b.id).ok).toBe(true);
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
  it("integrateSecondLance grants an EMPTY 2nd Lance and promotes rourkeRank to capt", () => {
    // 5 Sep 2026 — Act II used to hand over five finished pilots. It now
    // grants a lance for the player to recruit into, and those five join the
    // recruit pool instead. The promotion still fires: the rank comes from
    // commanding a second lance, not from who is standing in it.
    const state = createWardenCampaignState();
    const result = integrateSecondLance(state);
    expect(result.integrated).toBe(true);
    expect(lanceCount(state)).toBe(2);
    expect(lanceRoster(state, "b")).toHaveLength(0);
    expect(state.rourkeRank).toBe("capt");
    for (const p of SECOND_LANCE_PILOTS) expect(state.pilots[p.id]).toBeUndefined();
    expect(recruitCandidates(state).map((p) => p.id)).toEqual(expect.arrayContaining(SECOND_LANCE_PILOTS.map((p) => p.id)));
    expect(integrateSecondLance(state).integrated).toBe(false); // idempotent
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

  it("integrateThirdLance grants an EMPTY 3rd Lance and promotes rourkeRank to maj", () => {
    const state = createWardenCampaignState();
    integrateSecondLance(state);
    const result = integrateThirdLance(state);
    expect(result.integrated).toBe(true);
    expect(lanceCount(state)).toBe(3);
    expect(lanceRoster(state, "c")).toHaveLength(0);
    expect(state.rourkeRank).toBe("maj");
    for (const p of THIRD_LANCE_PILOTS) expect(state.pilots[p.id]).toBeUndefined();
    expect(integrateThirdLance(state).integrated).toBe(false);
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

// B6, "name your company" (First Game Dev Feature Gap Report §B6), 5 Sep
// 2026. The DOM text field itself is covered by tools/verify/
// checkCompanyName.mjs — a Phaser scene can't be unit-tested here (importing
// Phaser at module scope throws outside a browser), and a text input is
// exactly the kind of thing that passes every unit test while being
// impossible to actually type into. What IS testable is the engine half:
// the per-side defaults, the read path scenes use, and the backfill that
// decides what every pre-B6 save is called on its next load.
describe("B6 — company name: defaults, read path, and backfill", () => {
  function memoryStorage(): CampaignStorage {
    const backing = new Map<string, string>();
    return {
      getItem: (k) => backing.get(k) ?? null,
      setItem: (k, v) => void backing.set(k, v),
      removeItem: (k) => void backing.delete(k),
    };
  }

  it("gives each side its own default name at creation", () => {
    expect(createWardenCampaignState().companyName).toBe(DEFAULT_WARDEN_COMPANY_NAME);
    expect(createHouseAmaranthCampaignState().companyName).toBe(DEFAULT_HOUSE_AMARANTH_COMPANY_NAME);
  });

  it("companyNameOf returns whatever the player actually named them", () => {
    const state = createWardenCampaignState();
    state.companyName = "The Gravediggers";
    expect(companyNameOf(state)).toBe("The Gravediggers");
  });

  it("companyNameOf falls back per-side rather than rendering 'undefined'", () => {
    // A state that never went through loadCampaignState's backfill — e.g. a
    // fresh createCampaignState in a test, or a hand-built one.
    const warden = createWardenCampaignState();
    delete warden.companyName;
    expect(companyNameOf(warden)).toBe(DEFAULT_WARDEN_COMPANY_NAME);

    const house = createHouseAmaranthCampaignState();
    delete house.companyName;
    expect(companyNameOf(house)).toBe(DEFAULT_HOUSE_AMARANTH_COMPANY_NAME);
  });

  it("treats a whitespace-only name as no name at all", () => {
    const state = createWardenCampaignState();
    state.companyName = "   ";
    expect(companyNameOf(state)).toBe(DEFAULT_WARDEN_COMPANY_NAME);
  });

  it("backfills a pre-B6 Warden save to the name it was always shown under", () => {
    const storage = memoryStorage();
    const state = createWardenCampaignState();
    delete state.companyName; // exactly what every save written before 5 Sep 2026 looks like
    saveCampaignState(state, storage);

    const loaded = loadCampaignState(storage);
    expect(loaded!.companyName).toBe(DEFAULT_WARDEN_COMPANY_NAME);
  });

  it("backfills a pre-B6 House Amaranth save to ITS side's name, not Warden's", () => {
    // The bit worth guarding: side is decided by baseSceneKeyFor's own
    // pilot_rourke rule, so a House Amaranth save must not silently come
    // back calling itself Warden Company.
    const storage = memoryStorage();
    const state = createHouseAmaranthCampaignState();
    delete state.companyName;
    saveCampaignState(state, storage);

    const loaded = loadCampaignState(storage);
    expect(loaded!.companyName).toBe(DEFAULT_HOUSE_AMARANTH_COMPANY_NAME);
  });

  it("never overwrites a name the player did choose", () => {
    const storage = memoryStorage();
    const state = createWardenCampaignState();
    state.companyName = "Ninth Column";
    saveCampaignState(state, storage);

    expect(loadCampaignState(storage)!.companyName).toBe("Ninth Column");
  });

  it("round-trips a name through save and load unchanged", () => {
    const storage = memoryStorage();
    const state = createWardenCampaignState();
    state.companyName = "Rourke's Own";
    saveCampaignState(state, storage);
    expect(companyNameOf(loadCampaignState(storage)!)).toBe("Rourke's Own");
  });
});

// B2, assignable lances (5 Sep 2026). Maxime's own decisions, encoded here
// so a future change that breaks one of them fails loudly:
//   - lances are player-assignable, not derived from arrival batches
//   - hard cap of MAX_LANCE_SIZE per lance
//   - a Munti is a WARNING, never a save-block (the roster is exactly three
//     Muntis for three lances, so a hard rule would brick a lance the first
//     time one is killed — canLaunchMission already enforces it at deploy)
//   - a permanently lost pilot leaves the lance roster entirely; the Vault's
//     roll is where the dead are recorded
/** A campaign played to Act III with every lance recruited full — what a real save looks like now. */
function staffedCampaign(lances = 3): CampaignState {
  const state = createWardenCampaignState();
  if (lances >= 2) integrateSecondLance(state);
  if (lances >= 3) integrateThirdLance(state);
  for (const id of activeLanceIds(state).slice(1)) {
    while (lanceRoster(state, id).length < MAX_LANCE_SIZE) {
      const r = recruitIntoLance(state, id);
      if (!r.ok) throw new Error(r.reason);
    }
  }
  return state;
}

describe("B2 — assignable lances", () => {
  function muntiIdIn(state: CampaignState, lance: LanceId): string {
    const m = lanceRoster(state, lance).find((e) => UNIT_ARCHETYPES[e.pilot.archetypeId]?.path === "munti");
    if (!m) throw new Error(`no Munti in lance ${lance}`);
    return m.pilot.id;
  }

  it("defaults every pilot to the lance they arrived with", () => {
    const state = staffedCampaign();
    // Lance A's authored five still answer to their arrival batch. Recruits
    // carry an explicit assignment from the moment they're hired.
    for (const e of lanceRoster(state, "a")) expect(lanceOfPilotIn(state, e.pilot.id)).toBe(lanceOfPilot(e.pilot.id));
    expect(lanceRoster(state, "a")).toHaveLength(5);
    expect(lanceRoster(state, "b")).toHaveLength(5);
    expect(lanceRoster(state, "c")).toHaveLength(5);
  });

  it("moves a pilot into a lance that has an opening", () => {
    // Every lance ARRIVES full (5 pilots per act, cap 5), so in practice the
    // only thing that opens a slot is losing someone. That's the real
    // scenario a plain move happens in — everything else is a swap.
    const state = staffedCampaign(2);
    const casualty = lanceRoster(state, "b")[0].pilot.id;
    state.pilots[casualty].status = "permanently_lost";
    expect(lanceRoster(state, "b")).toHaveLength(4);

    const moved = lanceRoster(state, "a")[0].pilot.id;
    expect(assignPilotToLance(state, moved, "b")).toEqual({ ok: true });
    expect(lanceOfPilotIn(state, moved)).toBe("b");
    expect(lanceRoster(state, "b").map((e) => e.pilot.id)).toContain(moved);
    expect(lanceRoster(state, "a").map((e) => e.pilot.id)).not.toContain(moved);
  });

  it("refuses to overfill a lance, and says why", () => {
    const state = staffedCampaign(2);
    // Lance A is already at the cap of 5.
    expect(lanceRoster(state, "a")).toHaveLength(MAX_LANCE_SIZE);
    const fromB = lanceRoster(state, "b")[0].pilot.id;
    const result = assignPilotToLance(state, fromB, "a");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("full");
    // And the failed move changed nothing.
    expect(lanceOfPilotIn(state, fromB)).toBe("b");
  });

  it("assigning a pilot to the lance they're already in is a no-op success", () => {
    const state = createWardenCampaignState();
    const already = lanceRoster(state, "a")[0].pilot.id;
    expect(assignPilotToLance(state, already, "a")).toEqual({ ok: true });
    expect(lanceRoster(state, "a")).toHaveLength(5);
  });

  it("will not assign a pilot who is off the active roster", () => {
    const state = createWardenCampaignState();
    const id = lanceRoster(state, "a")[0].pilot.id;
    state.pilots[id].status = "permanently_lost";
    const result = assignPilotToLance(state, id, "b");
    expect(result.ok).toBe(false);
  });

  it("drops a permanently lost pilot from their lance — the roll owns the dead", () => {
    const state = createWardenCampaignState();
    const id = lanceRoster(state, "a")[0].pilot.id;
    expect(lanceRoster(state, "a")).toHaveLength(5);
    state.pilots[id].status = "permanently_lost";
    expect(lanceRoster(state, "a")).toHaveLength(4);
    expect(lanceRoster(state, "a").map((e) => e.pilot.id)).not.toContain(id);
  });

  it("a Munti-less lance is a warning, NOT a refusal to save it", () => {
    const state = staffedCampaign(2);
    // Trade Lance A's only Munti away for a non-Munti from B. A swap, not a
    // move, because both lances are full — which is the normal state.
    const aMunti = muntiIdIn(state, "a");
    const bNonMunti = lanceRoster(state, "b").find((e) => UNIT_ARCHETYPES[e.pilot.archetypeId]?.path !== "munti")!.pilot.id;
    // ALLOWED — this is the whole point of the warning-not-block call.
    expect(swapPilotLances(state, aMunti, bNonMunti)).toEqual({ ok: true });

    const a = lanceFieldability(state, "a");
    expect(a.fieldable).toBe(false);
    expect(a.warning).toContain("Munti");
    // B now has two Muntis and is fine.
    expect(lanceFieldability(state, "b").fieldable).toBe(true);
  });

  it("an empty lance reports as unfieldable rather than throwing", () => {
    const state = createWardenCampaignState();
    const empty = lanceFieldability(state, "c"); // never granted in Act I, so empty
    expect(empty.fieldable).toBe(false);
    expect(empty.warning).toContain("empty");
  });

  it("lanceFieldability agrees with canLaunchMission about what can launch", () => {
    // The roster screen and the deploy gate must never disagree, since the
    // gate is what actually enforces it.
    const state = createWardenCampaignState();
    const roster = lanceRoster(state, "a");
    const ids = roster.map((e) => e.pilot.id);
    expect(lanceFieldability(state, "a").fieldable).toBe(true);
    expect(canLaunchMission(ids, state).ok).toBe(true);

    // Strip the Munti out of the deploying squad and both must refuse.
    const withoutMunti = roster.filter((e) => UNIT_ARCHETYPES[e.pilot.archetypeId]?.path !== "munti").map((e) => e.pilot.id);
    expect(canLaunchMission(withoutMunti, state).ok).toBe(false);
  });

  it("survives a save/load round-trip, and an old save keeps arrival behavior", () => {
    const storage = memoryStorageForLances();
    const state = staffedCampaign(2);
    const moved = lanceRoster(state, "a")[0].pilot.id;
    const partner = lanceRoster(state, "b")[0].pilot.id;
    swapPilotLances(state, moved, partner);
    saveCampaignState(state, storage);

    const loaded = loadCampaignState(storage)!;
    expect(lanceOfPilotIn(loaded, moved)).toBe("b");

    // A save written before this field existed has no `lance` anywhere and
    // must behave exactly as it always did.
    const legacy = createWardenCampaignState();
    integrateSecondLance(legacy);
    for (const e of Object.values(legacy.pilots)) delete e.lance;
    saveCampaignState(legacy, storage);
    const legacyLoaded = loadCampaignState(storage)!;
    for (const e of Object.values(legacyLoaded.pilots)) {
      expect(lanceOfPilotIn(legacyLoaded, e.pilot.id)).toBe(lanceOfPilot(e.pilot.id));
    }
  });

  it("a Mek follows its pilot to the new lance's workshop", () => {
    const state = staffedCampaign(2);
    const entry = lanceRoster(state, "a")[0];
    const partner = lanceRoster(state, "b")[0];
    const mekId = entry.pilot.mekId;
    expect(lanceOfMekIn(state, mekId)).toBe("a");
    swapPilotLances(state, entry.pilot.id, partner.pilot.id);
    expect(lanceOfMekIn(state, mekId)).toBe("b");
    // The static answer is unchanged — arrival is still arrival.
    expect(lanceOfMek(mekId)).toBe("a");
  });

  it("an unknown mek id falls back to the static answer rather than guessing", () => {
    const state = createWardenCampaignState();
    expect(lanceOfMekIn(state, "mek_does_not_exist")).toBe(lanceOfMek("mek_does_not_exist"));
  });
});

function memoryStorageForLances(): CampaignStorage {
  const backing = new Map<string, string>();
  return {
    getItem: (k) => backing.get(k) ?? null,
    setItem: (k, v) => void backing.set(k, v),
    removeItem: (k) => void backing.delete(k),
  };
}

// swapPilotLances — the operation that keeps a FULL roster editable. Found
// necessary by live verification, 5 Sep 2026: 15 pilots across 3 lances
// capped at 5 means every lance sits at 5/5 from Act III on, so under a hard
// cap no assignPilotToLance call can ever succeed again in either direction.
describe("B2 — swapping lances (the full-roster deadlock)", () => {
  function fullRoster(): CampaignState {
    return staffedCampaign();
  }

  it("demonstrates the deadlock a plain move hits at full roster", () => {
    const state = fullRoster();
    const active = activeLanceIds(state);
    for (const id of active) expect(lanceRoster(state, id)).toHaveLength(MAX_LANCE_SIZE);
    // Every lance the carrier HAS is full, so every possible move is refused.
    // This is the bug swapPilotLances exists to answer, asserted so nobody
    // "simplifies" the swap away later without hitting it again.
    for (const from of active) {
      for (const to of active) {
        if (from === to) continue;
        const pilotId = lanceRoster(state, from)[0].pilot.id;
        expect(assignPilotToLance(state, pilotId, to).ok).toBe(false);
      }
    }
  });

  it("trades two pilots' lances even when both lances are full", () => {
    const state = fullRoster();
    const a = lanceRoster(state, "a")[0].pilot.id;
    const b = lanceRoster(state, "b")[0].pilot.id;
    expect(swapPilotLances(state, a, b)).toEqual({ ok: true });
    expect(lanceOfPilotIn(state, a)).toBe("b");
    expect(lanceOfPilotIn(state, b)).toBe("a");
    // And no lance changed size — that's why a swap is cap-exempt.
    for (const id of activeLanceIds(state)) expect(lanceRoster(state, id)).toHaveLength(MAX_LANCE_SIZE);
  });

  it("swapping two pilots already in the same lance is a harmless no-op", () => {
    const state = fullRoster();
    const [a, b] = lanceRoster(state, "a");
    expect(swapPilotLances(state, a.pilot.id, b.pilot.id)).toEqual({ ok: true });
    expect(lanceOfPilotIn(state, a.pilot.id)).toBe("a");
    expect(lanceOfPilotIn(state, b.pilot.id)).toBe("a");
  });

  it("refuses to trade a pilot who is off the active roster", () => {
    const state = fullRoster();
    const a = lanceRoster(state, "a")[0].pilot.id;
    const b = lanceRoster(state, "b")[0].pilot.id;
    state.pilots[b].status = "permanently_lost";
    expect(swapPilotLances(state, a, b).ok).toBe(false);
    expect(lanceOfPilotIn(state, a)).toBe("a");
  });

  it("a swap survives save and load", () => {
    const storage = memoryStorageForLances();
    const state = fullRoster();
    const a = lanceRoster(state, "a")[0].pilot.id;
    const b = lanceRoster(state, "c")[0].pilot.id;
    swapPilotLances(state, a, b);
    saveCampaignState(state, storage);
    const loaded = loadCampaignState(storage)!;
    expect(lanceOfPilotIn(loaded, a)).toBe("c");
    expect(lanceOfPilotIn(loaded, b)).toBe("a");
  });

  it("a swap moves both pilots' Meks to each other's workshops", () => {
    const state = fullRoster();
    const a = lanceRoster(state, "a")[0];
    const b = lanceRoster(state, "b")[0];
    swapPilotLances(state, a.pilot.id, b.pilot.id);
    expect(lanceOfMekIn(state, a.pilot.mekId)).toBe("b");
    expect(lanceOfMekIn(state, b.pilot.mekId)).toBe("a");
  });
});

// Lance COUNT, as distinct from lance SIZE — both happen to be 5, which is
// exactly why they're worth testing apart. Maxime, 5 Sep 2026: "maximum
// number of lance total is 5 because i want to plan ahead for gladiator.
// current number of lance in the carrier per act is 1. so it only grow at 3."
describe("B2 — how many lances a carrier has", () => {
  it("the id space carries five, for Gladiator", () => {
    expect(LANCE_IDS).toHaveLength(MAX_LANCES);
    expect(MAX_LANCES).toBe(5);
    expect(LANCE_IDS).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("but a Warden carrier grows one lance per act, stopping at three", () => {
    const state = createWardenCampaignState();
    expect(lanceCount(state)).toBe(1);
    expect(activeLanceIds(state)).toEqual(["a"]);

    integrateSecondLance(state);
    expect(lanceCount(state)).toBe(2);
    expect(activeLanceIds(state)).toEqual(["a", "b"]);

    integrateThirdLance(state);
    expect(lanceCount(state)).toBe(3);
    expect(activeLanceIds(state)).toEqual(["a", "b", "c"]);
  });

  it("refuses to assign into a lance the carrier doesn't have yet", () => {
    const state = createWardenCampaignState(); // Act I: one lance only
    const pilotId = lanceRoster(state, "a")[0].pilot.id;
    for (const missing of ["b", "c", "d", "e"] as LanceId[]) {
      const result = assignPilotToLance(state, pilotId, missing);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toContain("doesn't exist yet");
    }
    expect(lanceOfPilotIn(state, pilotId)).toBe("a");
  });

  it("keeps a lance once granted, even if every pilot is moved out of it", () => {
    // Emptying 3rd Lance must not delete the slot — the count comes from
    // arrival batches, not current occupancy.
    const state = createWardenCampaignState();
    integrateSecondLance(state);
    integrateThirdLance(state);
    for (const e of lanceRoster(state, "c")) swapPilotLances(state, e.pilot.id, lanceRoster(state, "a")[0].pilot.id);
    expect(lanceCount(state)).toBe(3);
    expect(activeLanceIds(state)).toContain("c");
  });

  it("keeps a lance whose pilots were all permanently lost", () => {
    const state = createWardenCampaignState();
    integrateSecondLance(state);
    for (const e of lanceRoster(state, "b")) state.pilots[e.pilot.id].status = "permanently_lost";
    expect(lanceRoster(state, "b")).toHaveLength(0);
    expect(lanceCount(state)).toBe(2); // the slot survives the casualties
  });

  it("House Amaranth tops out at two lances, having no third", () => {
    const state = createHouseAmaranthCampaignState();
    expect(lanceCount(state)).toBe(1);
    integrateHouseAmaranthSecondLance(state);
    expect(lanceCount(state)).toBe(2);
    expect(activeLanceIds(state)).toEqual(["a", "b"]);
  });

  it("names all five, including the two this campaign never reaches", () => {
    expect(LANCE_IDS.map(lanceDisplayName)).toEqual(["1st Lance", "2nd Lance", "3rd Lance", "4th Lance", "5th Lance"]);
  });
});

// Recruiting your own lance (5 Sep 2026, Maxime: "player should recruit
// their lance teamate not have a team be creste for them").
/** A campaign whose ten authored candidates are all spoken for, so the next recruit is a generated one. */
function drainedPoolCampaign(): CampaignState {
  const state = createWardenCampaignState();
  integrateSecondLance(state);
  integrateThirdLance(state);
  for (let i = 0; i < MAX_LANCE_SIZE; i++) recruitIntoLance(state, "b");
  for (let i = 0; i < MAX_LANCE_SIZE; i++) recruitIntoLance(state, "c");
  // Open one slot back up in 2nd Lance for the generated hire.
  const casualty = lanceRoster(state, "b")[0].pilot.id;
  state.pilots[casualty].status = "permanently_lost";
  return state;
}

describe("B2 — recruiting into a lance", () => {
  it("the ten authored 2nd/3rd Lance pilots become the recruit pool", () => {
    const state = createWardenCampaignState();
    integrateSecondLance(state);
    integrateThirdLance(state);
    const pool = recruitCandidates(state).map((p) => p.id);
    expect(pool).toHaveLength(10);
    for (const p of [...SECOND_LANCE_PILOTS, ...THIRD_LANCE_PILOTS]) expect(pool).toContain(p.id);
  });

  it("recruiting a named candidate puts that exact person in that lance", () => {
    const state = createWardenCampaignState();
    integrateSecondLance(state);
    const result = recruitIntoLance(state, "b", "pilot_solheim");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.pilot.id).toBe("pilot_solheim");
    expect(lanceOfPilotIn(state, "pilot_solheim")).toBe("b");
    expect(state.meks["mek_solheim"]).toBeDefined(); // their authored Mek came with them
    // And they're no longer on offer.
    expect(recruitCandidates(state).map((p) => p.id)).not.toContain("pilot_solheim");
  });

  it("a campaign where you never recruited Solheim simply doesn't have her", () => {
    const state = createWardenCampaignState();
    integrateSecondLance(state);
    recruitIntoLance(state, "b", "pilot_okafor");
    expect(state.pilots["pilot_solheim"]).toBeUndefined();
    expect(lanceRoster(state, "b")).toHaveLength(1);
  });

  it("refuses to recruit into a lance that doesn't exist yet, or one that's full", () => {
    const state = createWardenCampaignState(); // Act I, one lance
    expect(recruitIntoLance(state, "b").ok).toBe(false);
    integrateSecondLance(state);
    for (let i = 0; i < MAX_LANCE_SIZE; i++) expect(recruitIntoLance(state, "b").ok).toBe(true);
    const overfull = recruitIntoLance(state, "b");
    expect(overfull.ok).toBe(false);
    if (!overfull.ok) expect(overfull.reason).toContain("full");
  });

  it("generates a real rank-and-name pilot once the authored pool runs dry", () => {
    const state = createWardenCampaignState();
    integrateSecondLance(state);
    integrateThirdLance(state);
    // Drain all ten authored candidates across the two lances.
    for (let i = 0; i < MAX_LANCE_SIZE; i++) recruitIntoLance(state, "b");
    for (let i = 0; i < MAX_LANCE_SIZE; i++) recruitIntoLance(state, "c");
    expect(recruitCandidates(state)).toHaveLength(0);

    // Open a slot and recruit past the pool.
    const casualty = lanceRoster(state, "c")[0].pilot.id;
    state.pilots[casualty].status = "permanently_lost";
    const generated = recruitIntoLance(state, "c");
    expect(generated.ok).toBe(true);
    if (generated.ok) {
      // A real person, not 'Recruit "Sprocket"'.
      expect(generated.pilot.displayName).not.toContain("Recruit");
      expect(generated.pilot.displayName.split(" ").length).toBeGreaterThanOrEqual(3); // rank + first + last
      expect(generated.pilot.callsign).toBeUndefined(); // earned, not issued
    }
  });

  it("a GENERATED recruit earns a callsign, and it shows up in their name", () => {
    // Only generated recruits start unnamed. The ten authored candidates are
    // written characters and arrive with the callsigns they were written
    // with — awardCallsign deliberately refuses to rename them.
    const state = drainedPoolCampaign();
    const r = recruitIntoLance(state, "b");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const before = state.pilots[r.pilot.id].pilot.displayName;
    expect(state.pilots[r.pilot.id].pilot.callsign).toBeUndefined();

    const awarded = awardCallsign(state, r.pilot.id, "Tinder");
    expect(awarded).toBe("Tinder");
    const after = state.pilots[r.pilot.id].pilot.displayName;
    expect(after).toContain("Tinder");
    expect(after.startsWith(before)).toBe(true); // their name is kept, the callsign is added to it
    expect(state.pilots[r.pilot.id].pilot.callsign).toBe("Tinder");
  });

  it("never re-names someone who already has a callsign, authored cast included", () => {
    const state = createWardenCampaignState();
    const rourkeBefore = state.pilots["pilot_rourke"].pilot.displayName;
    expect(awardCallsign(state, "pilot_rourke", "Nope")).toBeNull();
    expect(state.pilots["pilot_rourke"].pilot.displayName).toBe(rourkeBefore);

    const generated = drainedPoolCampaign();
    const r = recruitIntoLance(generated, "b");
    if (!r.ok) return;
    awardCallsign(generated, r.pilot.id, "First");
    expect(awardCallsign(generated, r.pilot.id, "Second")).toBeNull(); // one callsign, once
    expect(generated.pilots[r.pilot.id].pilot.displayName).toContain("First");
    expect(generated.pilots[r.pilot.id].pilot.displayName).not.toContain("Second");
  });

  it("an in-progress pre-5-Sep save keeps its lances AND everyone already in them", () => {
    // The regression that matters most: a player mid-Act-III must not lose
    // their squad or their rank to this change.
    const storage = memoryStorageForLances();
    const legacy = createWardenCampaignState();
    for (const p of [...SECOND_LANCE_PILOTS, ...THIRD_LANCE_PILOTS]) {
      legacy.pilots[p.id] = { pilot: { ...p }, status: "active", personalPoints: 0 };
    }
    delete legacy.lancesGranted; // exactly what a save from before today looks like
    legacy.rourkeRank = "maj";
    saveCampaignState(legacy, storage);

    const loaded = loadCampaignState(storage)!;
    expect(lanceCount(loaded)).toBe(3);
    expect(loaded.rourkeRank).toBe("maj"); // not demoted by the backfill
    expect(lanceRoster(loaded, "b")).toHaveLength(5);
    expect(lanceRoster(loaded, "c")).toHaveLength(5);
  });
});
