// Hot topics — first-slice unit tests, 27 Aug 2026. Pure module, no engine
// imports (src/data/** purity rule, Build Brief §5.2), so these test the
// three exported functions directly with hand-built HotTopic objects —
// same shape highlights.test.ts already established for this file's
// sibling. Catalyst-flavored-content tests added the same day (later
// pass, roadmap #1's own stretch goal) — same convention stage.test.ts's
// own "pickStagePromotionLine — graduation-reveal content" describe block
// already established for the sibling catalyst-specific banks.
import { describe, it, expect, vi } from "vitest";
import { pruneExpiredHotTopics, pickHotTopicForSpeaker, renderHotTopicLine, HOT_TOPIC_TTL_MS, type HotTopic } from "../hotTopics";
import { LINE_BANK, type Catalyst } from "../ambientLines";

const ALL_CATALYSTS = Object.keys(LINE_BANK) as Catalyst[];

function makeTopic(overrides: Partial<HotTopic> = {}): HotTopic {
  return {
    kind: "promoted",
    aboutPilotId: "pilot_bosk",
    aboutName: "Bosk",
    at: 1000,
    mentionedBy: [],
    ...overrides,
  };
}

describe("pruneExpiredHotTopics", () => {
  it("keeps a topic still inside the TTL window", () => {
    const topic = makeTopic({ at: 1000 });
    const result = pruneExpiredHotTopics([topic], 1000 + HOT_TOPIC_TTL_MS - 1);
    expect(result).toEqual([topic]);
  });

  it("drops a topic once it's aged past the TTL", () => {
    const topic = makeTopic({ at: 1000 });
    const result = pruneExpiredHotTopics([topic], 1000 + HOT_TOPIC_TTL_MS + 1);
    expect(result).toEqual([]);
  });

  it("treats exactly-at-TTL as expired — the check is strict less-than, not less-or-equal", () => {
    const topic = makeTopic({ at: 1000 });
    const result = pruneExpiredHotTopics([topic], 1000 + HOT_TOPIC_TTL_MS);
    expect(result).toEqual([]);
  });

  it("filters a mixed list, keeping only what's still fresh", () => {
    const now = 10 * HOT_TOPIC_TTL_MS;
    const fresh = makeTopic({ aboutPilotId: "pilot_anand", at: now - 1000 });
    const stale = makeTopic({ aboutPilotId: "pilot_iyari", at: now - HOT_TOPIC_TTL_MS - 1000 });
    const result = pruneExpiredHotTopics([fresh, stale], now);
    expect(result).toEqual([fresh]);
  });

  it("does not mutate the input array", () => {
    const topics = [makeTopic({ at: 0 })];
    pruneExpiredHotTopics(topics, 999_999);
    expect(topics.length).toBe(1); // original array untouched, only the returned filter result drops it
  });
});

describe("pickHotTopicForSpeaker", () => {
  it("returns undefined when there are no topics at all", () => {
    expect(pickHotTopicForSpeaker([], "pilot_anand")).toBeUndefined();
  });

  it("returns a topic about someone else", () => {
    const topic = makeTopic({ aboutPilotId: "pilot_bosk" });
    expect(pickHotTopicForSpeaker([topic], "pilot_anand")).toBe(topic);
  });

  it("excludes a topic that's about the speaker themselves — no reflecting your own news back at you", () => {
    const topic = makeTopic({ aboutPilotId: "pilot_anand" });
    expect(pickHotTopicForSpeaker([topic], "pilot_anand")).toBeUndefined();
  });

  it("excludes a topic this exact speaker has already mentioned once", () => {
    const topic = makeTopic({ aboutPilotId: "pilot_bosk", mentionedBy: ["pilot_anand"] });
    expect(pickHotTopicForSpeaker([topic], "pilot_anand")).toBeUndefined();
  });

  it("a topic already mentioned by ONE speaker is still fair game for a different speaker", () => {
    const topic = makeTopic({ aboutPilotId: "pilot_bosk", mentionedBy: ["pilot_anand"] });
    expect(pickHotTopicForSpeaker([topic], "pilot_iyari")).toBe(topic);
  });

  it("returns the first eligible topic when several qualify", () => {
    const first = makeTopic({ aboutPilotId: "pilot_bosk", at: 1 });
    const second = makeTopic({ aboutPilotId: "pilot_iyari", at: 2 });
    expect(pickHotTopicForSpeaker([first, second], "pilot_anand")).toBe(first);
  });

  it("skips an ineligible topic and returns the next eligible one", () => {
    const aboutSelf = makeTopic({ aboutPilotId: "pilot_anand", at: 1 });
    const eligible = makeTopic({ aboutPilotId: "pilot_bosk", at: 2 });
    expect(pickHotTopicForSpeaker([aboutSelf, eligible], "pilot_anand")).toBe(eligible);
  });
});

describe("renderHotTopicLine", () => {
  it("substitutes {ABOUT} for a promoted topic", () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // pin bank selection to index 0
    const line = renderHotTopicLine(makeTopic({ kind: "promoted", aboutName: "Bosk" }), "wolf");
    expect(line).toContain("Bosk");
    expect(line).not.toContain("{ABOUT}");
    vi.restoreAllMocks();
  });

  it("leaves no stray {WITH} token in a promoted line, which never uses one", () => {
    const line = renderHotTopicLine(makeTopic({ kind: "promoted", aboutName: "Bosk" }), "wolf");
    expect(line).not.toContain("{WITH}");
  });

  it("substitutes both {ABOUT} and {WITH} for a gotTogether topic", () => {
    const line = renderHotTopicLine(makeTopic({ kind: "gotTogether", aboutName: "Bosk", withName: "Anand" }), "wolf");
    expect(line).toContain("Bosk");
    expect(line).toContain("Anand");
    expect(line).not.toContain("{ABOUT}");
    expect(line).not.toContain("{WITH}");
  });

  it("substitutes withName even when it's the literal 'you' — the player-relationship case", () => {
    const line = renderHotTopicLine(makeTopic({ kind: "gotTogether", aboutName: "Bosk", withName: "you" }), "wolf");
    expect(line).toContain("Bosk");
    expect(line).toContain("you");
  });

  it("substitutes {ABOUT} for a muntiLost topic and leaves no stray {WITH} token, same as promoted — this kind never uses one either", () => {
    const line = renderHotTopicLine(makeTopic({ kind: "muntiLost", aboutName: "Corin" }), "rabbit");
    expect(line).toContain("Corin");
    expect(line).not.toContain("{ABOUT}");
    expect(line).not.toContain("{WITH}");
  });

  it("picks from every line in a given catalyst's bank across enough draws, not just index 0", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      seen.add(renderHotTopicLine(makeTopic({ kind: "gotTogether", aboutName: "Bosk", withName: "Anand" }), "wolf"));
    }
    // Two distinct templates per catalyst/kind bucket — 50 draws makes
    // seeing only one of them astronomically unlikely if selection is
    // genuinely random, without pinning Math.random and coupling this
    // test to the exact index-selection formula.
    expect(seen.size).toBeGreaterThan(1);
  });

  it("always returns real, non-empty content for every catalyst, all five kinds, over many trials", () => {
    for (const catalyst of ALL_CATALYSTS) {
      for (const kind of ["promoted", "gotTogether", "muntiLost", "missionWin", "missionLoss"] as const) {
        for (let i = 0; i < 10; i++) {
          const line = renderHotTopicLine(makeTopic({ kind, aboutName: "Bosk", withName: "Anand" }), catalyst);
          expect(typeof line).toBe("string");
          expect(line.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("missionWin/missionLoss never reference {ABOUT} or {WITH} — neither kind is 'about' any one pilot", () => {
    for (const catalyst of ALL_CATALYSTS) {
      for (const kind of ["missionWin", "missionLoss"] as const) {
        for (let i = 0; i < 15; i++) {
          const line = renderHotTopicLine(makeTopic({ kind, aboutName: "" }), catalyst);
          expect(line).not.toContain("{ABOUT}");
          expect(line).not.toContain("{WITH}");
        }
      }
    }
  });

  it("missionWin and missionLoss draw from disjoint pools for a given catalyst", () => {
    for (const catalyst of ALL_CATALYSTS) {
      const winLines = new Set(Array.from({ length: 30 }, () => renderHotTopicLine(makeTopic({ kind: "missionWin" }), catalyst)));
      const lossLines = new Set(Array.from({ length: 30 }, () => renderHotTopicLine(makeTopic({ kind: "missionLoss" }), catalyst)));
      for (const line of winLines) expect(lossLines.has(line)).toBe(false);
    }
  });

  it("different catalysts draw genuinely different missionLoss content too", () => {
    const bearLines = new Set(Array.from({ length: 20 }, () => renderHotTopicLine(makeTopic({ kind: "missionLoss" }), "bear")));
    const crowLines = new Set(Array.from({ length: 20 }, () => renderHotTopicLine(makeTopic({ kind: "missionLoss" }), "crow")));
    for (const line of bearLines) expect(crowLines.has(line)).toBe(false);
  });

  it("different catalysts draw genuinely different content for the same kind — the catalyst-specific rewrite, not a shared pool with a catalyst parameter bolted on", () => {
    const wolfLines = new Set(
      Array.from({ length: 20 }, () => renderHotTopicLine(makeTopic({ kind: "promoted", aboutName: "Bosk" }), "wolf"))
    );
    const sharkLines = new Set(
      Array.from({ length: 20 }, () => renderHotTopicLine(makeTopic({ kind: "promoted", aboutName: "Bosk" }), "shark"))
    );
    for (const line of wolfLines) expect(sharkLines.has(line)).toBe(false);
  });

  it("for a given catalyst, all five kinds draw from mutually disjoint pools", () => {
    for (const catalyst of ALL_CATALYSTS) {
      const pools: Record<string, Set<string>> = {
        promoted: new Set(Array.from({ length: 30 }, () => renderHotTopicLine(makeTopic({ kind: "promoted", aboutName: "Bosk" }), catalyst))),
        gotTogether: new Set(
          Array.from({ length: 30 }, () => renderHotTopicLine(makeTopic({ kind: "gotTogether", aboutName: "Bosk", withName: "Anand" }), catalyst))
        ),
        muntiLost: new Set(Array.from({ length: 30 }, () => renderHotTopicLine(makeTopic({ kind: "muntiLost", aboutName: "Bosk" }), catalyst))),
        missionWin: new Set(Array.from({ length: 30 }, () => renderHotTopicLine(makeTopic({ kind: "missionWin" }), catalyst))),
        missionLoss: new Set(Array.from({ length: 30 }, () => renderHotTopicLine(makeTopic({ kind: "missionLoss" }), catalyst))),
      };
      const kinds = Object.keys(pools);
      for (let i = 0; i < kinds.length; i++) {
        for (let j = i + 1; j < kinds.length; j++) {
          for (const line of pools[kinds[i]]) {
            expect(pools[kinds[j]].has(line)).toBe(false);
          }
        }
      }
    }
  });

  it("different catalysts draw genuinely different muntiLost content too, not a shared grief pool", () => {
    const bearLines = new Set(
      Array.from({ length: 20 }, () => renderHotTopicLine(makeTopic({ kind: "muntiLost", aboutName: "Corin" }), "bear"))
    );
    const crowLines = new Set(
      Array.from({ length: 20 }, () => renderHotTopicLine(makeTopic({ kind: "muntiLost", aboutName: "Corin" }), "crow"))
    );
    for (const line of bearLines) expect(crowLines.has(line)).toBe(false);
  });
});
