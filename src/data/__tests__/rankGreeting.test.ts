// src/data/__tests__/rankGreeting.test.ts
// "Hello, Sir" rank-deference greeting, 27 Aug 2026 — Maxime's wishlist:
// "plugging in Hello, SIr from lower ranked to higher rank." Split into its
// own file rather than folded into stage.test.ts: this is Rourke's own rank
// axis (engine/campaignState.ts's rourkeRank), not a pilot's Stage — same
// detect/pick shape as detectStagePromotion/pickStagePromotionLine (see
// stage.test.ts), covered separately on purpose so a future reader isn't
// stuck untangling two different promotion axes out of one describe block.
import { describe, it, expect } from "vitest";
import { detectRankPromotion, pickRankGreetingLine, LINE_BANK } from "../ambientLines";

const ALL_CATALYSTS = Object.keys(LINE_BANK) as (keyof typeof LINE_BANK)[];

describe("detectRankPromotion — 'Hello, Sir' reveal gating, 27 Aug 2026", () => {
  it("returns undefined when lastAcknowledged is undefined — a backfill case, not a promotion", () => {
    const ranks: Array<"2nd_lt" | "capt" | "maj"> = ["2nd_lt", "capt", "maj"];
    for (const r of ranks) {
      expect(detectRankPromotion(undefined, r)).toBeUndefined();
    }
  });

  it("returns undefined when nothing changed, for all three ranks", () => {
    expect(detectRankPromotion("2nd_lt", "2nd_lt")).toBeUndefined();
    expect(detectRankPromotion("capt", "capt")).toBeUndefined();
    expect(detectRankPromotion("maj", "maj")).toBeUndefined();
  });

  it("reports a real 2nd_lt -> capt promotion", () => {
    expect(detectRankPromotion("2nd_lt", "capt")).toBe("capt");
  });

  it("reports a real capt -> maj promotion", () => {
    expect(detectRankPromotion("capt", "maj")).toBe("maj");
  });

  it("never reports a promotion INTO 2nd_lt — there's no demotion path in this campaign, but this stays defensive rather than surfacing a nonsensical one", () => {
    expect(detectRankPromotion("capt", "2nd_lt")).toBeUndefined();
    expect(detectRankPromotion("maj", "2nd_lt")).toBeUndefined();
  });
});

describe("pickRankGreetingLine — 'Hello, Sir' content, catalyst-specific as of 27 Aug 2026 (later pass)", () => {
  it("always returns real, non-empty content for every catalyst, both ranks, over many trials", () => {
    for (const catalyst of ALL_CATALYSTS) {
      for (const rank of ["capt", "maj"] as const) {
        for (let i = 0; i < 20; i++) {
          const line = pickRankGreetingLine(catalyst, rank);
          expect(typeof line).toBe("string");
          expect(line.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("for a given catalyst, 'capt' and 'maj' draw from disjoint pools", () => {
    for (const catalyst of ALL_CATALYSTS) {
      const captLines = new Set(Array.from({ length: 30 }, () => pickRankGreetingLine(catalyst, "capt")));
      const majLines = new Set(Array.from({ length: 30 }, () => pickRankGreetingLine(catalyst, "maj")));
      for (const line of captLines) expect(majLines.has(line)).toBe(false);
    }
  });

  it("different catalysts draw genuinely different content for the same rank — the catalyst-specific rewrite, not a shared pool with a parameter bolted on", () => {
    const wolfLines = new Set(Array.from({ length: 20 }, () => pickRankGreetingLine("wolf", "maj")));
    const crowLines = new Set(Array.from({ length: 20 }, () => pickRankGreetingLine("crow", "maj")));
    for (const line of wolfLines) expect(crowLines.has(line)).toBe(false);
  });

  it("never uses the literal word 'sir', for any catalyst or rank — Rourke is established female; content correction, not an oversight", () => {
    for (const catalyst of ALL_CATALYSTS) {
      for (const rank of ["capt", "maj"] as const) {
        for (let i = 0; i < 20; i++) {
          expect(pickRankGreetingLine(catalyst, rank).toLowerCase()).not.toMatch(/\bsir\b/);
        }
      }
    }
  });
});
