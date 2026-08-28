// src/data/__tests__/highlights.test.ts
// Highlights reel (Social Sim Roadmap #11), 27 Aug 2026 — see
// highlights.ts's own header for the full "what's honestly derivable"
// reasoning this file's test cases are built to lock in.
import { describe, it, expect } from "vitest";
import { buildFirstMilestones, buildStagePromotionMilestones } from "../highlights";
import { VERBS } from "../verbs";
import type { SocialLogEntry } from "../verbs";

describe("buildFirstMilestones", () => {
  it("returns an empty array for an undefined log", () => {
    expect(buildFirstMilestones(undefined)).toEqual([]);
  });

  it("returns an empty array for an empty log", () => {
    expect(buildFirstMilestones([])).toEqual([]);
  });

  it("builds one milestone for a single logged verb", () => {
    const log: SocialLogEntry[] = [{ verb: "shareADrink", line: "Shared a drink.", at: 1000 }];
    const result = buildFirstMilestones(log);
    expect(result).toEqual([{ verb: "shareADrink", label: "First Share a Drink", line: "Shared a drink.", at: 1000 }]);
  });

  it("uses VERBS[verb].label verbatim for every verb, not a hand-written string", () => {
    const log: SocialLogEntry[] = [
      { verb: "pegBoard", line: "Played the peg board.", at: 1000 },
      { verb: "poker", line: "Played poker.", at: 2000 },
      { verb: "fletchers", line: "Threw darts.", at: 3000 },
      { verb: "askOut", line: "Asked her out.", at: 4000 },
    ];
    const result = buildFirstMilestones(log);
    for (const milestone of result) {
      expect(milestone.label).toBe(`First ${VERBS[milestone.verb].label}`);
    }
  });

  it("keeps only the EARLIEST occurrence when a verb repeats", () => {
    const log: SocialLogEntry[] = [
      { verb: "shareADrink", line: "First drink.", at: 1000 },
      { verb: "shareADrink", line: "Second drink.", at: 5000 },
      { verb: "shareADrink", line: "Third drink.", at: 9000 },
    ];
    const result = buildFirstMilestones(log);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ verb: "shareADrink", label: "First Share a Drink", line: "First drink.", at: 1000 });
  });

  it("trusts push-order (first array entry wins), rather than re-sorting by timestamp", () => {
    // socialLog is append-ordered in real gameplay (every push happens at
    // Date.now(), later than everything already in the array), so
    // "first-seen in the array" and "earliest at" always agree in practice.
    // This test documents that the function relies on that invariant
    // instead of independently re-sorting the source log — worth stating
    // explicitly, since a hand-built out-of-order log (like this one) will
    // NOT self-correct.
    const log: SocialLogEntry[] = [
      { verb: "poker", line: "Later poker.", at: 9000 },
      { verb: "poker", line: "Actually-earlier poker.", at: 500 },
    ];
    const result = buildFirstMilestones(log);
    expect(result[0].line).toBe("Later poker.");
    expect(result[0].at).toBe(9000);
  });

  it("returns one milestone per distinct verb present, sorted chronologically", () => {
    const log: SocialLogEntry[] = [
      { verb: "askOut", line: "Asked her out.", at: 4000 },
      { verb: "shareADrink", line: "Shared a drink.", at: 1000 },
      { verb: "poker", line: "Played poker.", at: 2500 },
    ];
    const result = buildFirstMilestones(log);
    expect(result.map((m) => m.verb)).toEqual(["shareADrink", "poker", "askOut"]);
    expect(result.map((m) => m.at)).toEqual([1000, 2500, 4000]);
  });

  it("handles a verb that in principle could appear (e.g. talk) the same as any other, even though real gameplay never logs it", () => {
    // highlights.ts is deliberately generic over VerbId — it doesn't special-
    // case which verbs are "real" milestones. The reason "First Talk" never
    // actually shows up in play is that Hub.ts's speak() path never pushes a
    // socialLog entry for it, not that this function filters it out. Proven
    // here so a future change to Hub.ts's logging behavior doesn't need a
    // matching change to this file to "start working."
    const log: SocialLogEntry[] = [{ verb: "talk", line: "Talked.", at: 1000 }];
    const result = buildFirstMilestones(log);
    expect(result).toEqual([{ verb: "talk", label: "First Talk", line: "Talked.", at: 1000 }]);
  });

  it("does not mutate the input log array", () => {
    const log: SocialLogEntry[] = [
      { verb: "askOut", line: "Asked her out.", at: 4000 },
      { verb: "shareADrink", line: "Shared a drink.", at: 1000 },
    ];
    const snapshot = JSON.parse(JSON.stringify(log));
    buildFirstMilestones(log);
    expect(log).toEqual(snapshot);
  });
});

// Stage-promotion milestones — 28 Aug 2026, closing the honest gap this
// file's own header originally flagged ("no timestamp exists for when a
// Stage transition actually happened"). See highlights.ts's own header
// correction note and engine/campaignEconomy.ts's purchaseTierUpgrade for
// where the real timestamp this reads now actually gets written.
describe("buildStagePromotionMilestones", () => {
  it("returns an empty array for undefined input — every pilot who hasn't lived through a real promotion yet, honestly, not a fabricated one", () => {
    expect(buildStagePromotionMilestones(undefined)).toEqual([]);
  });

  it("returns an empty array for an empty object", () => {
    expect(buildStagePromotionMilestones({})).toEqual([]);
  });

  it("builds one milestone for a blooded-only record", () => {
    expect(buildStagePromotionMilestones({ blooded: 1000 })).toEqual([{ stage: "blooded", label: "Reached Blooded", at: 1000 }]);
  });

  it("builds one milestone for a command-only record", () => {
    expect(buildStagePromotionMilestones({ command: 2000 })).toEqual([{ stage: "command", label: "Reached Command", at: 2000 }]);
  });

  it("builds both milestones, sorted chronologically, when both are on record", () => {
    const result = buildStagePromotionMilestones({ blooded: 1000, command: 5000 });
    expect(result).toEqual([
      { stage: "blooded", label: "Reached Blooded", at: 1000 },
      { stage: "command", label: "Reached Command", at: 5000 },
    ]);
  });

  it("sorts by actual timestamp, not insertion order — a hand-built out-of-order record still comes back chronological", () => {
    // Can't happen from a real save (command can never be recorded before
    // blooded — tiers only move up), but the function itself doesn't
    // assume that invariant, it sorts for real.
    const result = buildStagePromotionMilestones({ command: 100, blooded: 9000 });
    expect(result.map((m) => m.stage)).toEqual(["command", "blooded"]);
  });

  it("a timestamp of 0 still counts as recorded — falsy is not the same as absent", () => {
    expect(buildStagePromotionMilestones({ blooded: 0 })).toEqual([{ stage: "blooded", label: "Reached Blooded", at: 0 }]);
  });
});
