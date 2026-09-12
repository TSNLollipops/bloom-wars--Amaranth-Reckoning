// src/engine/__tests__/debriefCatalyst.test.ts
// Emotional Brain Phase 2, 12 Sep 2026 — the Debrief write-back
// (engine/debriefCatalyst.ts) and the ledger writer it goes through
// (engine/memoryLedger.ts). Seeded rng throughout (mulberry32), no
// Math.random pinning: every outcome here replays from its seed.
//
// WARDEN_PILOTS (data/campaignAmaranth.ts): pilot_rourke (the MC),
// pilot_bosk, pilot_iyari, pilot_anand, pilot_lask (the Munti). Facility
// regular seeds: Bosk 30/75, Anand 78/60, Iyari 40/68 (data/npcSeed.ts);
// Lask and every recruit start on the generic 10/70.
import { describe, it, expect } from "vitest";
import { createWardenCampaignState, ensureNpcSocialState } from "../campaignState";
import { pairKey } from "../../data/npcBonds";
import { NPC_BOND_SEED } from "../../data/npcSeed";
import { mulberry32 } from "../../sim/rng";
import type { WorryEntry } from "../../data/worries";
import { runGriefCatalyst, ECHO_BOND_LEAN } from "../griefCatalyst";
import {
  runDebriefCatalyst,
  debriefTakeLine,
  MISSION_STRESS_CLAMP,
  MISSION_MORALE_CLAMP,
  PAIR_SCALE_ORDINARY,
  type DebriefCatalystInput,
} from "../debriefCatalyst";
import { recordMemory, socialSeedFor, socialStateFor, settleDrift, GENERIC_SOCIAL_SEED } from "../memoryLedger";
import { ECHO_DRIFT_PER_MEMORY, ECHO_DRIFT_RELAX_PER_DAY } from "../../data/echoLean";
import { MEMORY_BIRTH_WEIGHT } from "../../data/memories";

const SQUAD = ["pilot_rourke", "pilot_bosk", "pilot_iyari", "pilot_anand", "pilot_lask"];

function worry(source: WorryEntry["source"], intensity: number): WorryEntry {
  return { source, catalyst: "wolf", intensity, context: "battle", bornAt: 0, expiresAt: 10_000_000 };
}

function input(overrides: Partial<DebriefCatalystInput> = {}): DebriefCatalystInput {
  return {
    missionId: "mission_amaranth_1",
    outcome: "win",
    deployedPilotIds: SQUAD,
    combatWorries: {},
    permanentlyLostPilotIds: [],
    ...overrides,
  };
}

const OPTS = { now: 1_000_000, today: 10 };

describe("socialSeedFor / socialStateFor — the same seed the Hub would use", () => {
  it("a facility regular gets their authored seed, a recruit gets the generic triple", () => {
    const state = createWardenCampaignState();
    expect(socialSeedFor(state, "pilot_bosk")).toEqual({ favorability: 35, stress: 30, morale: 75 });
    expect(socialSeedFor(state, "pilot_lask")).toEqual(GENERIC_SOCIAL_SEED);
    expect(socialStateFor(state, "pilot_anand").stress).toBe(78);
  });

  it("grief on a fresh save no longer seeds a survivor at Morale 0", () => {
    const state = createWardenCampaignState();
    runGriefCatalyst(state, SQUAD, "pilot_lask", mulberry32(1));
    expect(state.pilots["pilot_bosk"].social?.morale).toBe(75);
    expect(state.pilots["pilot_anand"].social?.stress).toBe(78);
  });
});

describe("recordMemory + settleDrift", () => {
  it("writes the memory, stamps day and mission, strips the pilot from their own witnesses, and nudges drift", () => {
    const state = createWardenCampaignState();
    const entry = recordMemory(state, "pilot_bosk", { kind: "was_downed", echo: "fear", witnesses: SQUAD, missionId: "m1", ...OPTS });
    const social = state.pilots["pilot_bosk"].social!;
    expect(social.memories).toHaveLength(1);
    expect(entry.day).toBe(10);
    expect(entry.at).toBe(1_000_000);
    expect(entry.missionId).toBe("m1");
    expect(entry.witnesses).not.toContain("pilot_bosk");
    expect(entry.weight).toBe(MEMORY_BIRTH_WEIGHT.was_downed);
    expect(social.echoDrift?.fear).toBeCloseTo(MEMORY_BIRTH_WEIGHT.was_downed * ECHO_DRIFT_PER_MEMORY);
    expect(social.echoDriftDay).toBe(10);
  });

  it("relaxes drift by the in-game days elapsed before nudging again", () => {
    const state = createWardenCampaignState();
    recordMemory(state, "pilot_bosk", { kind: "lost_squadmate", echo: "sadness", now: 1, today: 10 });
    const social = state.pilots["pilot_bosk"].social!;
    const first = social.echoDrift!.sadness;
    const relaxed = settleDrift(social, 20);
    expect(relaxed.sadness).toBeCloseTo(first * Math.pow(ECHO_DRIFT_RELAX_PER_DAY, 10));
    expect(social.echoDriftDay).toBe(20);
    expect(settleDrift(social, 20).sadness).toBeCloseTo(relaxed.sadness); // idempotent within a day
  });
});

describe("runDebriefCatalyst — who is touched", () => {
  it("skips the player character and the permanently lost, and only touches deployed pilots", () => {
    const state = createWardenCampaignState();
    state.pilots["pilot_lask"].status = "permanently_lost";
    const result = runDebriefCatalyst(state, input({ outcome: "loss", permanentlyLostPilotIds: ["pilot_lask"], deployedPilotIds: ["pilot_rourke", "pilot_bosk", "pilot_lask"] }), { ...OPTS, rng: mulberry32(1) });
    expect(result.pilots.map((p) => p.pilotId)).toEqual(["pilot_bosk"]);
    expect(state.pilots["pilot_rourke"].social).toBeUndefined();
    expect(state.pilots["pilot_iyari"].social).toBeUndefined();
    expect(result.hadLoss).toBe(true);
  });

  it("a mission with nobody but the MC deployed is a no-op", () => {
    const state = createWardenCampaignState();
    const result = runDebriefCatalyst(state, input({ deployedPilotIds: ["pilot_rourke"] }), { ...OPTS, rng: mulberry32(1) });
    expect(result.pilots).toEqual([]);
    expect(result.bondShifts).toEqual([]);
  });
});

describe("runDebriefCatalyst — Stress/Morale movement", () => {
  it("a clean win eases Stress and lifts Morale for everyone deployed", () => {
    const state = createWardenCampaignState();
    const result = runDebriefCatalyst(state, input(), { ...OPTS, rng: mulberry32(2) });
    for (const p of result.pilots) {
      expect(p.stressDelta).toBeLessThanOrEqual(0);
      expect(p.moraleDelta).toBeGreaterThan(0);
    }
    expect(state.pilots["pilot_bosk"].social!.stress).toBeLessThan(30);
    expect(state.pilots["pilot_bosk"].social!.morale).toBeGreaterThan(75);
  });

  it("a loss with a permanent loss lands hard on the survivors, clamped per mission", () => {
    const state = createWardenCampaignState();
    state.pilots["pilot_lask"].status = "permanently_lost";
    const grief = [runGriefCatalyst(state, SQUAD, "pilot_lask", mulberry32(3))];
    const result = runDebriefCatalyst(
      state,
      input({ outcome: "loss", permanentlyLostPilotIds: ["pilot_lask"], griefResults: grief, combatWorries: { pilot_bosk: [worry("combat_downed", 0.8), worry("combat_permadeath_recoverable", 0.55)] } }),
      { ...OPTS, rng: mulberry32(3) },
    );
    const bosk = result.pilots.find((p) => p.pilotId === "pilot_bosk")!;
    expect(bosk.stressDelta).toBe(MISSION_STRESS_CLAMP);
    expect(bosk.moraleDelta).toBe(-MISSION_MORALE_CLAMP);
    expect(state.pilots["pilot_bosk"].social!.stress).toBe(30 + MISSION_STRESS_CLAMP);
    expect(state.pilots["pilot_bosk"].social!.morale).toBe(75 - MISSION_MORALE_CLAMP);
  });

  it("never leaves the 0..100 range", () => {
    const state = createWardenCampaignState();
    state.pilots["pilot_anand"].social = { favorability: 0, stress: 95, morale: 5, inRelationship: false, socialLog: [] };
    state.pilots["pilot_lask"].status = "permanently_lost";
    const result = runDebriefCatalyst(state, input({ outcome: "loss", permanentlyLostPilotIds: ["pilot_lask"], combatWorries: { pilot_anand: [worry("combat_downed", 0.8)] } }), { ...OPTS, rng: mulberry32(4) });
    const anand = result.pilots.find((p) => p.pilotId === "pilot_anand")!;
    expect(anand.stressAfter).toBe(100);
    expect(anand.moraleAfter).toBe(0);
  });

  it("the echo colours the take: a fearful pilot's downing costs more Stress than a warm one's", () => {
    // Anand starts at Stress 78, over the panic line, so pickSoloEcho forces
    // fear for him regardless of seed. Bosk at 30 rolls from his lean.
    const fearful = createWardenCampaignState();
    fearful.pilots["pilot_bosk"].social = { favorability: 0, stress: 80, morale: 75, inRelationship: false, socialLog: [] };
    const warm = createWardenCampaignState();
    warm.pilots["pilot_bosk"].social = { favorability: 0, stress: 10, morale: 75, inRelationship: false, socialLog: [] };
    // Find a seed where the calm Bosk takes it warmly.
    let warmResult;
    for (let seed = 1; seed < 200; seed++) {
      const trial = createWardenCampaignState();
      trial.pilots["pilot_bosk"].social = { favorability: 0, stress: 10, morale: 75, inRelationship: false, socialLog: [] };
      const r = runDebriefCatalyst(trial, input({ outcome: "loss", deployedPilotIds: ["pilot_rourke", "pilot_bosk"], combatWorries: { pilot_bosk: [worry("combat_downed", 0.8)] } }), { ...OPTS, rng: mulberry32(seed) });
      if (r.pilots[0].echo === "love") { warmResult = r; break; }
    }
    const fearResult = runDebriefCatalyst(fearful, input({ outcome: "loss", deployedPilotIds: ["pilot_rourke", "pilot_bosk"], combatWorries: { pilot_bosk: [worry("combat_downed", 0.8)] } }), { ...OPTS, rng: mulberry32(1) });
    expect(fearResult.pilots[0].echo).toBe("fear");
    expect(warmResult).toBeDefined();
    expect(fearResult.pilots[0].stressDelta).toBeGreaterThan(warmResult!.pilots[0].stressDelta);
  });
});

describe("runDebriefCatalyst — memories", () => {
  it("writes own events, saw_fall for a downed squadmate, and the outcome, with witnesses and mission stamped", () => {
    const state = createWardenCampaignState();
    const result = runDebriefCatalyst(
      state,
      input({ combatWorries: { pilot_bosk: [worry("combat_kill", 0.4), worry("combat_overwatch", 0.45)], pilot_iyari: [worry("combat_downed", 0.8), worry("combat_permadeath_recoverable", 0.55)] } }),
      { ...OPTS, rng: mulberry32(5) },
    );
    const bosk = state.pilots["pilot_bosk"].social!.memories!;
    const kinds = bosk.map((m) => m.kind).sort();
    expect(kinds).toEqual(["got_the_kill", "held_the_line", "mission_won", "saw_fall"].sort());
    const sawFall = bosk.find((m) => m.kind === "saw_fall")!;
    expect(sawFall.about).toEqual(["pilot_iyari"]);
    expect(sawFall.missionId).toBe("mission_amaranth_1");
    expect(sawFall.witnesses).toContain("pilot_anand");
    expect(sawFall.witnesses).not.toContain("pilot_bosk");
    expect(sawFall.witnesses).not.toContain("pilot_rourke");
    const iyari = state.pilots["pilot_iyari"].social!.memories!;
    const pulled = iyari.find((m) => m.kind === "was_pulled_out")!;
    expect(pulled.about).toEqual(["pilot_lask"]); // the living Munti who could still reach her
    expect(result.pilots.find((p) => p.pilotId === "pilot_iyari")!.memories.length).toBe(3);
  });

  it("a permanent loss writes lost_squadmate into every survivor with the echo they mourned with", () => {
    const state = createWardenCampaignState();
    state.pilots["pilot_lask"].status = "permanently_lost";
    const grief = [runGriefCatalyst(state, SQUAD, "pilot_lask", mulberry32(6))];
    runDebriefCatalyst(state, input({ outcome: "loss", permanentlyLostPilotIds: ["pilot_lask"], griefResults: grief }), { ...OPTS, rng: mulberry32(6) });
    for (const id of ["pilot_bosk", "pilot_iyari", "pilot_anand"]) {
      const mems = state.pilots[id].social!.memories!;
      const loss = mems.find((m) => m.kind === "lost_squadmate")!;
      expect(loss.about).toEqual(["pilot_lask"]);
      const mourner = grief[0].mourners.find((m) => m.pilotId === id)!;
      expect(loss.echo).toBe(mourner.echo);
      expect(loss.weight).toBe(1);
    }
    expect(state.pilots["pilot_lask"].social?.memories ?? []).toEqual([]);
  });

  it("the same event leaves different echoes on different witnesses (one event, many memories)", () => {
    const state = createWardenCampaignState();
    // Anand is over the panic line (fear, always); Bosk rolls from a raven's even lean.
    let sawDifference = false;
    for (let seed = 1; seed < 50 && !sawDifference; seed++) {
      const s = createWardenCampaignState();
      runDebriefCatalyst(s, input({ combatWorries: { pilot_iyari: [worry("combat_downed", 0.8)] } }), { ...OPTS, rng: mulberry32(seed) });
      const a = s.pilots["pilot_anand"].social!.memories!.find((m) => m.kind === "saw_fall")!;
      const b = s.pilots["pilot_bosk"].social!.memories!.find((m) => m.kind === "saw_fall")!;
      if (a.echo !== b.echo) sawDifference = true;
    }
    expect(sawDifference).toBe(true);
    void state;
  });
});

describe("runDebriefCatalyst — pair shifts", () => {
  it("an ordinary mission shifts every bonded pair of survivors by the grief formula at ×1", () => {
    const state = createWardenCampaignState();
    const npcSocial = ensureNpcSocialState(state, NPC_BOND_SEED);
    const key = pairKey("pilot_bosk", "pilot_anand");
    const before = npcSocial.bonds[key];
    const result = runDebriefCatalyst(state, input(), { ...OPTS, rng: mulberry32(7) });
    const shift = result.bondShifts.find((s) => s.pairKey === key)!;
    const bosk = result.pilots.find((p) => p.pilotId === "pilot_bosk")!;
    const anand = result.pilots.find((p) => p.pilotId === "pilot_anand")!;
    expect(shift.delta).toBe((ECHO_BOND_LEAN[bosk.echo] + ECHO_BOND_LEAN[anand.echo]) * PAIR_SCALE_ORDINARY);
    expect(npcSocial.bonds[key]).toBe(before + shift.delta);
  });

  it("no bond is invented between two pilots who never had one", () => {
    const state = createWardenCampaignState();
    const npcSocial = ensureNpcSocialState(state, NPC_BOND_SEED);
    const key = pairKey("pilot_bosk", "pilot_lask");
    expect(Object.prototype.hasOwnProperty.call(npcSocial.bonds, key)).toBe(false);
    runDebriefCatalyst(state, input(), { ...OPTS, rng: mulberry32(8) });
    expect(Object.prototype.hasOwnProperty.call(npcSocial.bonds, key)).toBe(false);
  });

  it("on a mission with a loss the ordinary shift is skipped (grief already ran at ×4)", () => {
    const state = createWardenCampaignState();
    state.pilots["pilot_lask"].status = "permanently_lost";
    const result = runDebriefCatalyst(state, input({ outcome: "loss", permanentlyLostPilotIds: ["pilot_lask"] }), { ...OPTS, rng: mulberry32(9) });
    expect(result.bondShifts).toEqual([]);
  });
});

describe("determinism and the Debrief line", () => {
  it("the same seed, state and input replay the same result", () => {
    const run = () => {
      const state = createWardenCampaignState();
      const r = runDebriefCatalyst(state, input({ combatWorries: { pilot_bosk: [worry("combat_kill", 0.4)], pilot_iyari: [worry("combat_downed", 0.8)] } }), { ...OPTS, rng: mulberry32(11) });
      return JSON.stringify([r, state.pilots["pilot_bosk"].social, state.npcSocial]);
    };
    expect(run()).toBe(run());
  });

  it("debriefTakeLine reads as one plain sentence with signed deltas", () => {
    const line = debriefTakeLine({ pilotId: "x", displayName: "Cpl. Priya Anand", echo: "fear", reason: "panicking", stressDelta: 12, moraleDelta: -6, stressAfter: 90, moraleAfter: 54, memories: [] });
    expect(line).toBe("Cpl. Priya Anand: took it shaken. Stress +12, Morale -6.");
    expect(line).not.toMatch(/[—;]/);
  });
});
