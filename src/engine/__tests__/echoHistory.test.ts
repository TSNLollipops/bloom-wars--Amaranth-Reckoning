// src/engine/__tests__/echoHistory.test.ts
// Reaction Engine, the read side of E (17 Sep 2026): the ledger that has
// been recording since 12 Sep finally gets read back into the echo lean
// Gate 3 picks from (engine/memoryLedger.ts echoHistoryWeight /
// historyAdjustedEchoLean, over data/dualProcess.ts).
import { describe, it, expect } from "vitest";
import { createWardenCampaignState } from "../campaignState";
import { echoHistoryWeight, historyAdjustedEchoLean, recordMemory, socialStateFor } from "../memoryLedger";
import { emptyDrift, effectiveEchoLean } from "../../data/echoLean";
import { MASSED_MULTIPLIER, SPACED_MULTIPLIER } from "../../data/dualProcess";
import { memorySalience } from "../../data/memories";
import type { Echo } from "../../data/ambientLines";

const ECHOES: Echo[] = ["love", "fear", "anger", "sadness"];

describe("echoHistoryWeight", () => {
  it("is all zeroes for a pilot who has been through nothing", () => {
    const s = createWardenCampaignState();
    const w = echoHistoryWeight(socialStateFor(s, "pilot_bosk"), 0);
    for (const e of ECHOES) expect(w[e]).toBe(0);
  });

  it("sums the same decayed salience the dossier reads, so the two never disagree", () => {
    const s = createWardenCampaignState();
    recordMemory(s, "pilot_bosk", { kind: "lost_squadmate", echo: "sadness", now: 0, today: 0 });
    const social = socialStateFor(s, "pilot_bosk");
    const expected = social.memories!.reduce((sum, m) => sum + memorySalience(m, 5), 0);
    expect(echoHistoryWeight(social, 5).sadness).toBeCloseTo(expected, 10);
  });

  it("files each memory under its own echo only", () => {
    const s = createWardenCampaignState();
    recordMemory(s, "pilot_bosk", { kind: "lost_squadmate", echo: "anger", now: 0, today: 0 });
    const w = echoHistoryWeight(socialStateFor(s, "pilot_bosk"), 0);
    expect(w.anger).toBeGreaterThan(0);
    expect(w.love).toBe(0);
    expect(w.fear).toBe(0);
    expect(w.sadness).toBe(0);
  });

  it("decays with time", () => {
    const s = createWardenCampaignState();
    recordMemory(s, "pilot_bosk", { kind: "lost_squadmate", echo: "fear", now: 0, today: 0 });
    const social = socialStateFor(s, "pilot_bosk");
    expect(echoHistoryWeight(social, 30).fear).toBeLessThan(echoHistoryWeight(social, 0).fear);
  });

  it("discounts a run crammed into one bad week and amplifies one spread over a season", () => {
    const massed = createWardenCampaignState();
    for (const day of [10, 11, 12]) {
      recordMemory(massed, "pilot_bosk", { kind: "saw_fall", echo: "fear", now: 0, today: day });
    }
    const spaced = createWardenCampaignState();
    for (const day of [0, 10, 20]) {
      recordMemory(spaced, "pilot_bosk", { kind: "saw_fall", echo: "fear", now: 0, today: day });
    }
    // Read both on a day where the raw salience sums are equal by construction
    // is not possible (different ages), so compare each against its own
    // unspaced sum instead.
    const massedSocial = socialStateFor(massed, "pilot_bosk");
    const spacedSocial = socialStateFor(spaced, "pilot_bosk");
    const rawMassed = massedSocial.memories!.reduce((s, m) => s + memorySalience(m, 30), 0);
    const rawSpaced = spacedSocial.memories!.reduce((s, m) => s + memorySalience(m, 30), 0);
    expect(echoHistoryWeight(massedSocial, 30).fear).toBeCloseTo(rawMassed * MASSED_MULTIPLIER, 10);
    expect(echoHistoryWeight(spacedSocial, 30).fear).toBeCloseTo(rawSpaced * SPACED_MULTIPLIER, 10);
  });
});

describe("historyAdjustedEchoLean", () => {
  it("is exactly the old lean for a pilot with an empty ledger — nothing regresses on day one", () => {
    const s = createWardenCampaignState();
    const social = socialStateFor(s, "pilot_bosk");
    const drift = emptyDrift();
    const before = effectiveEchoLean("wolf", drift);
    const after = historyAdjustedEchoLean("wolf", social, drift, 0);
    for (const e of ECHOES) expect(after[e]).toBeCloseTo(before[e], 10);
  });

  it("quiets the echo a pilot has been repeating, without touching the others", () => {
    const s = createWardenCampaignState();
    // A Shark tips at 4.8, so a couple of memories put it squarely in the
    // habituating half of the curve — the "wears down" case.
    recordMemory(s, "pilot_bosk", { kind: "saw_fall", echo: "sadness", now: 0, today: 0 });
    recordMemory(s, "pilot_bosk", { kind: "saw_fall", echo: "sadness", now: 0, today: 1 });
    const social = socialStateFor(s, "pilot_bosk");
    const drift = emptyDrift();
    const before = effectiveEchoLean("shark", drift);
    const after = historyAdjustedEchoLean("shark", social, drift, 1);
    expect(after.sadness).toBeLessThan(before.sadness);
    expect(after.love).toBeCloseTo(before.love, 10);
    expect(after.anger).toBeCloseTo(before.anger, 10);
  });

  it("winds up an early-tipping animal on the same ledger that wears down a late-tipping one", () => {
    const build = () => {
      const s = createWardenCampaignState();
      for (const day of [0, 7, 14, 21, 28]) {
        recordMemory(s, "pilot_bosk", { kind: "lost_squadmate", echo: "fear", now: 0, today: day });
      }
      return socialStateFor(s, "pilot_bosk");
    };
    const social = build();
    const drift = emptyDrift();
    const rabbit = historyAdjustedEchoLean("rabbit", social, drift, 28).fear / effectiveEchoLean("rabbit", drift).fear;
    const shark = historyAdjustedEchoLean("shark", social, drift, 28).fear / effectiveEchoLean("shark", drift).fear;
    expect(rabbit).toBeGreaterThan(shark);
  });

  it("never emits a negative weight", () => {
    const s = createWardenCampaignState();
    recordMemory(s, "pilot_bosk", { kind: "lost_squadmate", echo: "anger", now: 0, today: 0 });
    const out = historyAdjustedEchoLean("bear", socialStateFor(s, "pilot_bosk"), emptyDrift(), 0);
    for (const e of ECHOES) expect(out[e]).toBeGreaterThanOrEqual(0);
  });
});
