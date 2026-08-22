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
  DISCRETIONARY_RECRUIT_COST,
  type CampaignStorage,
} from "../campaignState";
import { testUnit } from "./testHelpers";
import { WARDEN_PILOTS, WARDEN_MEKS } from "../../data/campaignAmaranth";

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
});
