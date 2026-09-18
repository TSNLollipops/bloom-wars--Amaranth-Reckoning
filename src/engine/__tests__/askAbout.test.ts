// src/engine/__tests__/askAbout.test.ts — Ask About, 17 Sep 2026.
import { describe, it, expect } from "vitest";
import { createWardenCampaignState } from "../campaignState";
import { askAbout, splitRecordSentences, recordSentencesFor, askAboutRevealedCount, ASK_ABOUT_FILE_PREFIX, ASK_ABOUT_EXHAUSTED_LINE, ASK_ABOUT_NO_FILE_LINE } from "../askAbout";
import type { SocialLogEntry } from "../../data/verbs";
import { detectVerbRequest } from "../../data/chatIntent";
import { VERB_DAY_COST } from "../calendarClock";
import { VERBS } from "../../data/verbs";

describe("splitRecordSentences", () => {
  it("splits record prose on sentence ends and keeps abbreviations-free text whole", () => {
    expect(splitRecordSentences(["This is the first sentence here. This one is the second sentence? A third sentence, longer still!"])).toEqual([
      "This is the first sentence here.",
      "This one is the second sentence?",
      "A third sentence, longer still!",
    ]);
    expect(splitRecordSentences(["Just one sentence with 3.5 in it."])).toEqual(["Just one sentence with 3.5 in it."]);
  });
  it("folds a short opening fragment into the sentence after it", () => {
    expect(splitRecordSentences(["Reeps. Osnian, the first of her kind the company ever fielded."])).toEqual([
      "Reeps. Osnian, the first of her kind the company ever fielded.",
    ]);
    expect(splitRecordSentences(["A.", "A second, separately written paragraph."])).toEqual(["A.", "A second, separately written paragraph."]);
  });
});

describe("askAbout — reads the pilot's own file one sentence at a time", () => {
  it("an authored Warden pilot has a real dossier body to read", () => {
    const state = createWardenCampaignState(1);
    const entry = state.pilots["pilot_anand"];
    expect(entry).toBeDefined();
    const sentences = recordSentencesFor(state, entry);
    expect(sentences.length).toBeGreaterThan(1);
    expect(sentences[0]).toMatch(/^Reeps\. Osnian/);
  });

  it("first ask reveals sentence 1 and pays out; the next asks continue in order; then it's exhausted", () => {
    const state = createWardenCampaignState(1);
    const entry = state.pilots["pilot_anand"];
    const log: SocialLogEntry[] = [];
    const sentences = recordSentencesFor(state, entry);

    const r1 = askAbout(state, entry, log);
    expect(r1.revealed).toBe(true);
    expect(r1.first).toBe(true);
    expect(r1.line).toBe(ASK_ABOUT_FILE_PREFIX + sentences[0]);
    log.push({ verb: "askAbout", line: r1.line, at: 1 });

    const r2 = askAbout(state, entry, log);
    expect(r2.revealed).toBe(true);
    expect(r2.first).toBe(false);
    expect(r2.line).toBe(ASK_ABOUT_FILE_PREFIX + sentences[1]);
    for (let i = 1; i < sentences.length; i++) log.push({ verb: "askAbout", line: "x", at: i + 1 });

    const done = askAbout(state, entry, log);
    expect(done.revealed).toBe(false);
    expect(done.line).toBe(ASK_ABOUT_EXHAUSTED_LINE);
    expect(askAboutRevealedCount(log)).toBe(sentences.length);
  });

  it("other verbs on the log don't advance the count", () => {
    const log: SocialLogEntry[] = [{ verb: "praise", line: "p", at: 1 }, { verb: "askAbout", line: "a", at: 2 }, { verb: "gift", line: "g", at: 3 }];
    expect(askAboutRevealedCount(log)).toBe(1);
  });

  it("no roster entry (the CO, a Mek) gets the no-file line and nothing to log", () => {
    const state = createWardenCampaignState(1);
    const r = askAbout(state, undefined, []);
    expect(r.revealed).toBe(false);
    expect(r.line).toBe(ASK_ABOUT_NO_FILE_LINE);
  });
});

describe("askAbout — wiring", () => {
  it("chat phrases route to the verb and don't collide with greeting/banter/muster", () => {
    expect(detectVerbRequest("where are you from?")).toBe("askAbout");
    expect(detectVerbRequest("tell me about yourself")).toBe("askAbout");
    expect(detectVerbRequest("what's your story")).toBe("askAbout");
    expect(detectVerbRequest("tell me a joke")).toBeNull(); // banter, not a verb
    expect(detectVerbRequest("how are you")).toBeNull(); // greeting
  });
  it("has a verb def and a calendar cost decided (the Record forces it)", () => {
    expect(VERBS.askAbout.label).toBe("Ask About");
    expect(VERB_DAY_COST.askAbout).toBe(0);
  });
});
