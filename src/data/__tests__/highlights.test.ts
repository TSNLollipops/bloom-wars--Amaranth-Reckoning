// src/data/__tests__/highlights.test.ts
// Highlights reel (Social Sim Roadmap #11), 27 Aug 2026 — see
// highlights.ts's own header for the full "what's honestly derivable"
// reasoning this file's test cases are built to lock in.
import { describe, it, expect } from "vitest";
import { buildFirstMilestones } from "../highlights";
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
