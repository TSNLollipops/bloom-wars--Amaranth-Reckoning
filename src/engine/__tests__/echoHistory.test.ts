// src/engine/__tests__/echoHistory.test.ts
// Reaction Engine, the read side of E (17 Sep 2026): the ledger that has
// been recording since 12 Sep finally gets read back into the echo lean
// Gate 3 picks from (engine/memoryLedger.ts echoHistoryWeight /
// historyAdjustedEchoLean, over data/dualProcess.ts).
import { describe, it, expect } from "vitest";
import { createWardenCampaignState } from "../campaignState";
import { echoHistoryWeight, historyAdjustedEchoLean, recordMemory, socialStateFor, settleDrift, foodToMass } from "../memoryLedger";
import { emptyDrift, effectiveEchoLean, bankTotal, bankRate, ECHO_BANK_RETURN_RATIO, ECHO_BANK_SATURATION, ECHO_BANK_INFLUENCE } from "../../data/echoLean";
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
    // The pre-gain baseline includes the bank (22 Sep 2026): the gain is the
    // only thing historyAdjustedEchoLean adds on top of effectiveEchoLean,
    // so the comparison has to hand effectiveEchoLean the same bank.
    const before = effectiveEchoLean("shark", drift, social.echoBank);
    const after = historyAdjustedEchoLean("shark", social, drift, 1);
    expect(after.sadness).toBeLessThan(before.sadness);
    expect(after.love).toBeCloseTo(before.love, 10);
    expect(after.anger).toBeCloseTo(before.anger, 10);
  });

  // Two clocks, 22 Sep 2026 (data/dualProcess.ts header): habituation reads
  // the ledger, sensitization reads the bank. Until then this was one test,
  // "winds up an early-tipping animal on the same ledger" — five fear losses
  // across one month — and under the one-clock rule that month was enough to
  // wind a Rabbit up. It no longer is, by design: a month is not a career.
  // Both halves of that are pinned below, through the real ledger path.
  // Note the bank is filled by recordMemory at Bosk's own rate (Raven, 1.0
  // on every echo); the two animals are then read against that one pilot.
  const gainOf = (catalyst: "rabbit" | "shark", social: ReturnType<typeof socialStateFor>, today: number) => {
    const drift = emptyDrift();
    // Same baseline rule as above: the ratio isolates the gain only if the
    // denominator carries the bank too.
    return historyAdjustedEchoLean(catalyst, social, drift, today).fear / effectiveEchoLean(catalyst, drift, social.echoBank).fear;
  };

  it("a hard month quiets even an early-tipping animal — a month is not a career", () => {
    const s = createWardenCampaignState();
    for (const day of [0, 7, 14, 21, 28]) {
      recordMemory(s, "pilot_bosk", { kind: "lost_squadmate", echo: "fear", now: 0, today: day });
    }
    const social = socialStateFor(s, "pilot_bosk");
    expect(gainOf("rabbit", social, 28)).toBeLessThan(1);
    expect(gainOf("shark", social, 28)).toBeLessThan(1);
  });

  it("a career of the same losses winds up the early-tipping animal and leaves the late-tipping one still quieting", () => {
    const s = createWardenCampaignState();
    // Twelve weeks of it: a bank of 12 on fear, past a Rabbit's fear tip
    // (8.4) and short of a Shark's (14.4).
    for (let week = 0; week < 12; week++) {
      recordMemory(s, "pilot_bosk", { kind: "lost_squadmate", echo: "fear", now: 0, today: week * 7 });
    }
    const social = socialStateFor(s, "pilot_bosk");
    expect(social.echoBank!.fear).toBeCloseTo(12, 10);
    const rabbit = gainOf("rabbit", social, 77);
    const shark = gainOf("shark", social, 77);
    expect(rabbit).toBeGreaterThan(1);
    expect(shark).toBeLessThan(1);
    expect(rabbit).toBeGreaterThan(shark);
  });

  it("never emits a negative weight", () => {
    const s = createWardenCampaignState();
    recordMemory(s, "pilot_bosk", { kind: "lost_squadmate", echo: "anger", now: 0, today: 0 });
    const out = historyAdjustedEchoLean("bear", socialStateFor(s, "pilot_bosk"), emptyDrift(), 0);
    for (const e of ECHOES) expect(out[e]).toBeGreaterThanOrEqual(0);
  });
});

// ---- The bank through the ledger, 22 Sep 2026 -------------------------------

describe("recordMemory banks into echoBank — the return line", () => {
  it("a fresh pilot has no bank field at all, and an untouched save stays untouched", () => {
    const s = createWardenCampaignState();
    const social = socialStateFor(s, "pilot_bosk");
    expect(social.echoBank).toBeUndefined();
    settleDrift(social, 10);
    expect(social.echoBank).toBeUndefined();
  });

  it("the first memory creates the bank and feeds its echo by weight × ratio × the animal's rate", () => {
    // Bosk is a Raven, the even row, so his rate is exactly 1.0 and the
    // arithmetic here is the plain weight × ratio.
    const s = createWardenCampaignState();
    recordMemory(s, "pilot_bosk", { kind: "lost_squadmate", echo: "sadness", now: 0, today: 0 });
    const social = socialStateFor(s, "pilot_bosk");
    expect(social.echoBank).toBeDefined();
    expect(social.echoBank!.sadness).toBeCloseTo(1.0 * ECHO_BANK_RETURN_RATIO * bankRate("raven", "sadness"));
    expect(social.echoBank!.sadness).toBeCloseTo(1.0 * ECHO_BANK_RETURN_RATIO);
    expect(social.echoBank!.love).toBe(0);
  });

  it("recordMemory looks the catalyst up itself, so a Hub writer that never passes one still gets the right rate", () => {
    // Anand is a Wolf (sadness 0.15 → rate 0.6). Same memory, no catalyst passed.
    const s = createWardenCampaignState();
    recordMemory(s, "pilot_anand", { kind: "lost_squadmate", echo: "sadness", now: 0, today: 0 });
    const social = socialStateFor(s, "pilot_anand");
    expect(social.echoBank!.sadness).toBeCloseTo(1.0 * ECHO_BANK_RETURN_RATIO * bankRate("wolf", "sadness"));
    expect(social.echoBank!.sadness).toBeCloseTo(0.6);
  });

  it("the same loss sticks differently to different animals — nature filters", () => {
    const s = createWardenCampaignState();
    recordMemory(s, "pilot_anand", { kind: "lost_squadmate", echo: "sadness", now: 0, today: 0 }); // Wolf, 0.6×
    recordMemory(s, "pilot_bosk", { kind: "lost_squadmate", echo: "sadness", now: 0, today: 0 }); // Raven, 1.0×
    const anand = socialStateFor(s, "pilot_anand").echoBank!.sadness;
    const bosk = socialStateFor(s, "pilot_bosk").echoBank!.sadness;
    expect(anand).toBeLessThan(bosk);
    expect(bosk / anand).toBeCloseTo(bankRate("raven", "sadness") / bankRate("wolf", "sadness"));
  });

  it("the bank does not relax with in-game days, unlike drift", () => {
    const s = createWardenCampaignState();
    recordMemory(s, "pilot_bosk", { kind: "lost_squadmate", echo: "sadness", now: 0, today: 0 });
    const social = socialStateFor(s, "pilot_bosk");
    const driftBefore = social.echoDrift!.sadness;
    const bankBefore = social.echoBank!.sadness;
    settleDrift(social, 200);
    expect(social.echoDrift!.sadness).toBeLessThan(driftBefore * 0.01);
    expect(social.echoBank!.sadness).toBe(bankBefore);
  });

  it("the bank survives a save round-trip as plain JSON", () => {
    const s = createWardenCampaignState();
    recordMemory(s, "pilot_bosk", { kind: "was_downed", echo: "fear", now: 0, today: 0 });
    const round = JSON.parse(JSON.stringify(s)) as typeof s;
    const social = socialStateFor(round, "pilot_bosk");
    expect(social.echoBank!.fear).toBeCloseTo(0.7 * ECHO_BANK_RETURN_RATIO);
  });

  it("historyAdjustedEchoLean reads the bank, so both game call sites get it without knowing", () => {
    const s = createWardenCampaignState();
    const social = socialStateFor(s, "pilot_bosk");
    const before = historyAdjustedEchoLean("raven", social, emptyDrift(), 0);
    // Bosk is a Raven: the even row, 0.25 each. Bank enough sadness to saturate.
    for (let i = 0; i < 4; i++) recordMemory(s, "pilot_bosk", { kind: "lost_squadmate", echo: "sadness", now: i, today: 0 });
    // Reset drift so we isolate the bank's contribution from the drift's.
    social.echoDrift = emptyDrift();
    const after = historyAdjustedEchoLean("raven", social, emptyDrift(), 0);
    // Dual-process gains will also move things (four losses in one day is a
    // massed run), so compare against the raw lean with and without the bank
    // rather than asserting an exact number.
    const rawWithout = effectiveEchoLean("raven", emptyDrift());
    const rawWith = effectiveEchoLean("raven", emptyDrift(), social.echoBank);
    expect(rawWith.sadness - rawWithout.sadness).toBeCloseTo(ECHO_BANK_INFLUENCE, 5);
    expect(after.sadness).toBeGreaterThan(before.sadness);
  });

  it("a Wolf who has processed enough losses as sadness now leans sadness — and keeps leaning it after a quiet season", () => {
    const s = createWardenCampaignState();
    // A Wolf banks sadness at 0.6×, so saturation takes more losses than the
    // neutral count — which is the point: it is harder to turn a Wolf sad.
    const n = Math.ceil(ECHO_BANK_SATURATION / (ECHO_BANK_RETURN_RATIO * bankRate("wolf", "sadness")));
    for (let i = 0; i < n; i++) recordMemory(s, "pilot_anand", { kind: "lost_squadmate", echo: "sadness", now: i, today: i * 10 });
    const social = socialStateFor(s, "pilot_anand");
    // A quiet season: 120 days, drift relaxes to nothing, ledger salience to the floor.
    const drift = settleDrift(social, n * 10 + 120);
    const lean = effectiveEchoLean("wolf", drift, social.echoBank);
    expect(lean.sadness).toBeGreaterThan(lean.love);
    expect(bankTotal(social.echoBank)).toBeGreaterThanOrEqual(ECHO_BANK_SATURATION);
  });
});

describe("foodToMass — the harness diagnostic", () => {
  it("is 0 for nothing over nothing, Infinity for something over nothing", () => {
    const s = createWardenCampaignState();
    const social = socialStateFor(s, "pilot_bosk");
    expect(foodToMass(social, 0)).toBe(0);
    social.memories = [{ kind: "got_the_kill", at: 0, day: 0, about: [], witnesses: [], echo: "anger", weight: 0.3 }];
    expect(foodToMass(social, 0)).toBe(Infinity);
  });

  it("is recent salience over banked total, and old memories fall out of the window", () => {
    const s = createWardenCampaignState();
    recordMemory(s, "pilot_bosk", { kind: "lost_squadmate", echo: "sadness", now: 0, today: 0 });
    const social = socialStateFor(s, "pilot_bosk");
    const fmNow = foodToMass(social, 0);
    expect(fmNow).toBeCloseTo(1.0 / bankTotal(social.echoBank));
    expect(foodToMass(social, 100)).toBe(0);
  });
});
