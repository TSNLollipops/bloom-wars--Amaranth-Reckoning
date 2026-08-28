// src/engine/__tests__/griefCatalyst.test.ts
// Grief Catalyst — live port, 28 Aug 2026. See griefCatalyst.ts's own file
// header for the design and claude_Bloom_Wars_Grief_Catalyst_Port_Spec_v1.pdf
// for the source spec.
//
// Math.random is pinned per-test (same convention as hotTopics.test.ts /
// relationshipStage.test.ts) rather than left real: every mourner's echo
// picked by pickSoloEcho() needs to be a KNOWN value for the bond-shift math
// to be checkable, and most of the tests below force the echo via stress/
// morale thresholds instead (deterministic, no random involved) — the mock
// only matters for the drunk branch's love/anger coin-flip and for
// pickAmbientLine's own line-bank index, which these tests don't otherwise
// care about.
import { describe, it, expect, vi } from "vitest";
import { createWardenCampaignState, ensureHubSocialState, ensureNpcSocialState } from "../campaignState";
import { pairKey } from "../../data/npcBonds";
import { runGriefCatalyst, ECHO_BOND_LEAN, ECHO_BOND_SCALE } from "../griefCatalyst";
import { catalystForPilot, NPC_SEED } from "../../data/npcSeed";

// WARDEN_PILOTS (data/campaignAmaranth.ts): pilot_rourke, pilot_bosk,
// pilot_iyari, pilot_anand, pilot_lask — the Act I roster createWardenCampaignState()
// seeds into state.pilots, every entry starting status: "active".

describe("runGriefCatalyst — mourner population", () => {
  it("mourners are the whole deployed squad minus the lost pilot — not narrowed to just bonded pilots (Maxime's own widening of the spec's literal wording)", () => {
    const state = createWardenCampaignState();
    const deployed = ["pilot_rourke", "pilot_bosk", "pilot_iyari", "pilot_anand", "pilot_lask"];
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    const result = runGriefCatalyst(state, deployed, "pilot_lask");
    vi.restoreAllMocks();
    expect(result.mourners.map((m) => m.pilotId).sort()).toEqual(["pilot_anand", "pilot_bosk", "pilot_iyari", "pilot_rourke"].sort());
    expect(result.lostPilotId).toBe("pilot_lask");
  });

  it("the lost pilot never appears as their own mourner, even if their status hadn't been flipped yet (defensive)", () => {
    const state = createWardenCampaignState();
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    const result = runGriefCatalyst(state, ["pilot_bosk", "pilot_anand"], "pilot_bosk");
    vi.restoreAllMocks();
    expect(result.mourners.map((m) => m.pilotId)).toEqual(["pilot_anand"]);
  });

  it("multiple losses in one mission: the second loss's mourner list excludes the first loss's pilot too, matching Debrief.ts's own call order (status flipped for ALL losses before either grief round runs)", () => {
    const state = createWardenCampaignState();
    state.pilots["pilot_bosk"].status = "permanently_lost";
    state.pilots["pilot_iyari"].status = "permanently_lost";
    const deployed = ["pilot_rourke", "pilot_bosk", "pilot_iyari", "pilot_anand", "pilot_lask"];
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    const first = runGriefCatalyst(state, deployed, "pilot_bosk");
    const second = runGriefCatalyst(state, deployed, "pilot_iyari");
    vi.restoreAllMocks();
    const expected = ["pilot_anand", "pilot_lask", "pilot_rourke"].sort();
    expect(first.mourners.map((m) => m.pilotId).sort()).toEqual(expected);
    expect(second.mourners.map((m) => m.pilotId).sort()).toEqual(expected);
    for (const r of [first, second]) {
      const ids = r.mourners.map((m) => m.pilotId);
      expect(ids).not.toContain("pilot_bosk");
      expect(ids).not.toContain("pilot_iyari");
    }
  });

  it("a deployed id with no CampaignPilotEntry at all is skipped, not a crash (defensive, same fail-open instinct as ensureHubSocialState)", () => {
    const state = createWardenCampaignState();
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    const result = runGriefCatalyst(state, ["pilot_bosk", "pilot_ghost_not_real"], "pilot_bosk");
    vi.restoreAllMocks();
    expect(result.mourners.map((m) => m.pilotId)).toEqual([]);
  });

  it("each mourner line carries a real displayName and a non-empty line string", () => {
    const state = createWardenCampaignState();
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    const result = runGriefCatalyst(state, ["pilot_bosk"], "pilot_lask");
    vi.restoreAllMocks();
    expect(result.mourners).toHaveLength(1);
    expect(result.mourners[0].pilotId).toBe("pilot_bosk");
    expect(result.mourners[0].displayName).toBe(state.pilots["pilot_bosk"].pilot.displayName);
    expect(result.mourners[0].line.length).toBeGreaterThan(0);
    expect(["love", "fear", "anger", "sadness"]).toContain(result.mourners[0].echo);
  });
});

describe("ECHO_BOND_LEAN / ECHO_BOND_SCALE — verbatim from the spec, not to be retuned here", () => {
  it("matches the spec's literal values", () => {
    expect(ECHO_BOND_LEAN).toEqual({ love: 2, sadness: 1, fear: -1, anger: -2 });
    expect(ECHO_BOND_SCALE).toBe(4);
  });
});

describe("runGriefCatalyst — bond shifts", () => {
  it("lazy-init respected: with no npcSocial state at all, nothing shifts and no bond is invented from nothing", () => {
    const state = createWardenCampaignState();
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    const result = runGriefCatalyst(state, ["pilot_rourke", "pilot_lask"], "pilot_bosk");
    vi.restoreAllMocks();
    expect(result.bondShifts).toEqual([]);
    expect(state.npcSocial?.bonds[pairKey("pilot_lask", "pilot_rourke")]).toBeUndefined();
  });

  it("a pair with an existing bond — including an explicit own-property 0, distinct from absent — gets shifted", () => {
    const state = createWardenCampaignState();
    const social = ensureNpcSocialState(state, {});
    const key = pairKey("pilot_rourke", "pilot_lask");
    social.bonds[key] = 0;
    ensureHubSocialState(state, "pilot_rourke", { favorability: 0, stress: 95, morale: 70 }); // stress >= 70 -> fear, deterministic, no random needed
    ensureHubSocialState(state, "pilot_lask", { favorability: 0, stress: 10, morale: 10 }); // morale <= 25 -> sadness
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    const result = runGriefCatalyst(state, ["pilot_rourke", "pilot_lask"], "pilot_bosk");
    vi.restoreAllMocks();
    const expectedDelta = (ECHO_BOND_LEAN.fear + ECHO_BOND_LEAN.sadness) * ECHO_BOND_SCALE;
    expect(result.bondShifts).toHaveLength(1);
    expect(result.bondShifts[0]).toMatchObject({ pairKey: key, pilotIdA: "pilot_rourke", pilotIdB: "pilot_lask", delta: expectedDelta, newValue: 0 + expectedDelta });
    expect(social.bonds[key]).toBe(0 + expectedDelta); // the actual persisted store, not just the returned record
  });

  it("three mourners, only two of the three possible pairs pre-seeded: exactly those two shift, with correct per-pair math and pairKey", () => {
    const state = createWardenCampaignState();
    const social = ensureNpcSocialState(state, {});
    const boskAnand = pairKey("pilot_bosk", "pilot_anand");
    const anandIyari = pairKey("pilot_anand", "pilot_iyari");
    const boskIyari = pairKey("pilot_bosk", "pilot_iyari");
    social.bonds[boskAnand] = 10;
    social.bonds[anandIyari] = -5;
    // boskIyari deliberately left unseeded

    ensureHubSocialState(state, "pilot_bosk", { favorability: 0, stress: 95, morale: 70 }); // fear
    ensureHubSocialState(state, "pilot_anand", { favorability: 0, stress: 10, morale: 10 }); // sadness
    ensureHubSocialState(state, "pilot_iyari", { favorability: 0, stress: 10, morale: 70 }); // drunk -> anger, forced below
    state.pilots["pilot_iyari"].social!.drunkUntil = Date.now() + 100_000;

    vi.spyOn(Math, "random").mockReturnValue(0.9); // drunk branch: 0.9 >= 0.5 -> anger
    const result = runGriefCatalyst(state, ["pilot_bosk", "pilot_anand", "pilot_iyari"], "pilot_lask");
    vi.restoreAllMocks();

    expect(result.mourners.find((m) => m.pilotId === "pilot_bosk")?.echo).toBe("fear");
    expect(result.mourners.find((m) => m.pilotId === "pilot_anand")?.echo).toBe("sadness");
    expect(result.mourners.find((m) => m.pilotId === "pilot_iyari")?.echo).toBe("anger");

    expect(result.bondShifts).toHaveLength(2);
    const boskAnandShift = result.bondShifts.find((s) => s.pairKey === boskAnand)!;
    const anandIyariShift = result.bondShifts.find((s) => s.pairKey === anandIyari)!;
    expect(result.bondShifts.find((s) => s.pairKey === boskIyari)).toBeUndefined();

    const expectedBoskAnand = (ECHO_BOND_LEAN.fear + ECHO_BOND_LEAN.sadness) * ECHO_BOND_SCALE; // 0
    const expectedAnandIyari = (ECHO_BOND_LEAN.sadness + ECHO_BOND_LEAN.anger) * ECHO_BOND_SCALE; // -12
    expect(boskAnandShift.delta).toBe(expectedBoskAnand);
    expect(boskAnandShift.newValue).toBe(10 + expectedBoskAnand);
    expect(anandIyariShift.delta).toBe(expectedAnandIyari);
    expect(anandIyariShift.newValue).toBe(-5 + expectedAnandIyari);
    expect(social.bonds[boskAnand]).toBe(10 + expectedBoskAnand);
    expect(social.bonds[anandIyari]).toBe(-5 + expectedAnandIyari);
    expect(social.bonds[boskIyari]).toBeUndefined(); // still never invented
  });

  it("bond mutation is unclamped, same as every other bond mutation in the codebase — a large negative shift can push past -100", () => {
    const state = createWardenCampaignState();
    const social = ensureNpcSocialState(state, {});
    const key = pairKey("pilot_bosk", "pilot_anand");
    social.bonds[key] = -95;
    ensureHubSocialState(state, "pilot_bosk", { favorability: 0, stress: 95, morale: 70 }); // fear
    ensureHubSocialState(state, "pilot_anand", { favorability: 0, stress: 10, morale: 70 });
    state.pilots["pilot_anand"].social!.drunkUntil = Date.now() + 100_000;
    vi.spyOn(Math, "random").mockReturnValue(0.9); // anger
    const result = runGriefCatalyst(state, ["pilot_bosk", "pilot_anand"], "pilot_lask");
    vi.restoreAllMocks();
    const expectedDelta = (ECHO_BOND_LEAN.fear + ECHO_BOND_LEAN.anger) * ECHO_BOND_SCALE; // -12
    expect(result.bondShifts[0].newValue).toBe(-95 + expectedDelta); // -107, not clamped to -100
    expect(social.bonds[key]).toBe(-95 + expectedDelta);
  });
});

describe("catalystForPilot", () => {
  it("returns the exact NPC_SEED catalyst for every seeded named pilot", () => {
    for (const seed of NPC_SEED) {
      expect(catalystForPilot(seed.pilotId)).toBe(seed.catalyst);
    }
  });

  it("returns a valid, deterministic catalyst for an unseeded pilot (Rourke and Lask included — WARDEN_PILOTS but not in NPC_SEED)", () => {
    const ALL: string[] = ["wolf", "dog", "cat", "crow", "raven", "bear", "fox", "rabbit", "shark"];
    for (const id of ["pilot_rourke", "pilot_lask", "pilot_recruit_1"]) {
      const first = catalystForPilot(id);
      const second = catalystForPilot(id);
      expect(first).toBe(second); // same pilotId -> same catalyst every time, no re-roll on reload
      expect(ALL).toContain(first);
    }
  });

  it("different unseeded pilot ids don't all collapse onto the same catalyst", () => {
    const ids = ["pilot_rourke", "pilot_lask", "pilot_recruit_1", "pilot_recruit_2", "pilot_recruit_3", "pilot_recruit_4", "pilot_recruit_5"];
    const catalysts = new Set(ids.map((id) => catalystForPilot(id)));
    expect(catalysts.size).toBeGreaterThan(1);
  });
});
