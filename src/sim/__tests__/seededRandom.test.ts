// Coverage for sim/seededRandom.ts, the determinism fence sim:brain runs
// each campaign inside (22 Sep 2026, claude/Bloom_Wars_Build_Log_Addendum_
// SimDeterminism_22Sep2026.md). The last test is the actual leak that
// made the harness non-deterministic: a generated recruit drawn with the
// engine's default `rng = Math.random`.
import { describe, it, expect } from "vitest";
import { withSeededMathRandom } from "../seededRandom";
import { createWardenCampaignState, checkMuntiGuarantee } from "../../engine/campaignState";

const draw = (n: number): number[] => Array.from({ length: n }, () => Math.random());

describe("withSeededMathRandom — the harness determinism fence", () => {
  it("gives the same Math.random sequence for the same seed", () => {
    const a = withSeededMathRandom(42, () => draw(20));
    const b = withSeededMathRandom(42, () => draw(20));
    expect(a).toEqual(b);
  });

  it("gives a different sequence for a different seed", () => {
    const a = withSeededMathRandom(42, () => draw(20));
    const b = withSeededMathRandom(43, () => draw(20));
    expect(a).not.toEqual(b);
  });

  it("returns whatever the fenced function returns", () => {
    expect(withSeededMathRandom(1, () => "done")).toBe("done");
  });

  it("puts the real Math.random back afterwards", () => {
    const original = Math.random;
    withSeededMathRandom(7, () => draw(3));
    expect(Math.random).toBe(original);
  });

  it("puts the real Math.random back even when the fenced function throws", () => {
    const original = Math.random;
    expect(() =>
      withSeededMathRandom(7, () => {
        throw new Error("mid-campaign crash");
      }),
    ).toThrow("mid-campaign crash");
    expect(Math.random).toBe(original);
  });

  it("pins a generated recruit (gender, name, backgrounds, chassis, Mek name) that the engine draws with its default Math.random", () => {
    const recruit = () =>
      withSeededMathRandom(1234, () => {
        const state = createWardenCampaignState();
        state.pilots["pilot_lask"].status = "permanently_lost"; // the Warden roster's only Munti
        const result = checkMuntiGuarantee(state);
        const pilot = result.pilot!;
        return { pilot, mek: state.meks[pilot.mekId] };
      });
    const first = recruit();
    const second = recruit();
    expect(first.pilot).toBeDefined();
    expect(second).toEqual(first);
  });
});
