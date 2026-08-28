// Build Plan §9, piece #3 — first automated coverage for chatIntent.ts.
// Written 26 Aug 2026 during a "harden what's already built" pass, since
// this module shipped with the typed-chat UI but no test file of its own
// (Hub.ts itself has no unit tests either — it's Phaser scene code — but
// this file is pure logic with zero Phaser dependency, which is exactly
// the kind of thing that should have tests before it's left unattended).
//
// While writing these cases, found a real bug in countHits(): it used
// plain text.includes(kw), which false-positives on keywords that are
// substrings of unrelated words — "mad" inside "made," "cry" inside
// "cryptic," "mission" inside "submission." Fixed countHits() to use
// \b-anchored word-boundary matching before writing this file, so the
// false-positive cases below are regression tests, not just coverage.
import { describe, it, expect } from "vitest";
import { interpretPlayerChat, detectUnbuiltVerbLine, detectVerbRequest, detectHistoryRequest, detectHighlightsRequest, detectBuildRequest } from "../chatIntent";

describe("interpretPlayerChat — muster recognition", () => {
  it("recognizes the literal word 'muster'", () => {
    expect(interpretPlayerChat("muster up")).toEqual({ kind: "muster" });
  });

  it("recognizes 'to the bay' phrasing (Maxime's own original example, Build Plan §9 header)", () => {
    expect(interpretPlayerChat("cmon guys to the bay")).toEqual({ kind: "muster" });
  });

  it("recognizes assorted muster-bucket keywords: assemble, rally, launch, suit up", () => {
    expect(interpretPlayerChat("assemble on the deck")).toEqual({ kind: "muster" });
    expect(interpretPlayerChat("rally now")).toEqual({ kind: "muster" });
    expect(interpretPlayerChat("time to launch")).toEqual({ kind: "muster" });
    expect(interpretPlayerChat("suit up everyone")).toEqual({ kind: "muster" });
  });

  it("recognizes the apostrophe and no-apostrophe spellings of 'let's go'", () => {
    expect(interpretPlayerChat("let's go team")).toEqual({ kind: "muster" });
    expect(interpretPlayerChat("lets go team")).toEqual({ kind: "muster" });
  });

  it("muster wins over an emotion-looking word when both are present, per the documented keyword order", () => {
    // "danger" is a fear keyword, but muster is checked first in
    // interpretPlayerChat regardless of hit count.
    expect(interpretPlayerChat("danger, everyone move out")).toEqual({ kind: "muster" });
  });
});

describe("interpretPlayerChat — emotion buckets", () => {
  it("recognizes anger", () => {
    expect(interpretPlayerChat("this is so stupid, I'm furious")).toEqual({ kind: "emotion", echo: "anger" });
  });

  it("recognizes fear", () => {
    expect(interpretPlayerChat("be careful out there, I'm worried")).toEqual({ kind: "emotion", echo: "fear" });
  });

  it("recognizes sadness", () => {
    expect(interpretPlayerChat("I miss them, it hurts")).toEqual({ kind: "emotion", echo: "sadness" });
  });

  it("recognizes love", () => {
    expect(interpretPlayerChat("thanks, good job out there")).toEqual({ kind: "emotion", echo: "love" });
  });

  it("matches multi-word keyword phrases across their internal space ('shut up', 'rough day')", () => {
    expect(interpretPlayerChat("shut up already")).toEqual({ kind: "emotion", echo: "anger" });
    expect(interpretPlayerChat("it's been a rough day")).toEqual({ kind: "emotion", echo: "sadness" });
  });
});

describe("interpretPlayerChat — emotion tie-break order", () => {
  // EMOTION_ORDER = ["anger", "fear", "sadness", "love"] — a genuine tie in
  // keyword-hit count resolves to whichever of these comes first.
  it("breaks a genuine anger/fear tie (one hit each) toward anger", () => {
    expect(interpretPlayerChat("mad and scared")).toEqual({ kind: "emotion", echo: "anger" });
  });

  it("breaks a genuine fear/sadness tie (one hit each) toward fear", () => {
    expect(interpretPlayerChat("worried and sad")).toEqual({ kind: "emotion", echo: "fear" });
  });

  it("breaks a genuine sadness/love tie (one hit each) toward sadness", () => {
    expect(interpretPlayerChat("sorry, thanks")).toEqual({ kind: "emotion", echo: "sadness" });
  });

  it("a higher hit count in a later-order bucket still wins over a single earlier-order hit", () => {
    // love scores 2 (thanks, proud), anger scores 1 (damn) — score beats order.
    expect(interpretPlayerChat("damn, thanks, so proud of you")).toEqual({ kind: "emotion", echo: "love" });
  });
});

describe("interpretPlayerChat — no match", () => {
  it("returns null for text with no recognizable keywords", () => {
    expect(interpretPlayerChat("what's the weather like today")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(interpretPlayerChat("")).toBeNull();
  });

  it("returns null for whitespace-only input", () => {
    expect(interpretPlayerChat("   \t  ")).toBeNull();
  });
});

describe("interpretPlayerChat — case insensitivity", () => {
  it("matches regardless of input casing", () => {
    expect(interpretPlayerChat("MUSTER UP")).toEqual({ kind: "muster" });
    expect(interpretPlayerChat("I Am So ANGRY")).toEqual({ kind: "emotion", echo: "anger" });
  });
});

describe("interpretPlayerChat — word-boundary false-positive regressions", () => {
  // These three are the exact cases found while writing this file, before
  // countHits() was switched from text.includes(kw) to \b-anchored regex
  // matching. Each of these used to wrongly fire because the keyword was a
  // plain substring of an unrelated word.
  it("'I made a mistake' does not trigger anger via 'mad' inside 'made'", () => {
    expect(interpretPlayerChat("I made a mistake")).toBeNull();
  });

  it("'that's cryptic' does not trigger sadness via 'cry' inside 'cryptic'", () => {
    expect(interpretPlayerChat("that's cryptic")).toBeNull();
  });

  it("'check the submission' does not trigger muster via 'mission' inside 'submission'", () => {
    expect(interpretPlayerChat("check the submission")).toBeNull();
  });

  it("'the commission approved it' does not trigger muster via 'mission' inside 'commission'", () => {
    expect(interpretPlayerChat("the commission approved it")).toBeNull();
  });

  it("the standalone word 'mission' still triggers muster correctly", () => {
    expect(interpretPlayerChat("gear up, mission time")).toEqual({ kind: "muster" });
  });

  it("the standalone word 'mad' still triggers anger correctly", () => {
    expect(interpretPlayerChat("I'm so mad right now")).toEqual({ kind: "emotion", echo: "anger" });
  });

  it("the standalone word 'cry' still triggers sadness correctly", () => {
    expect(interpretPlayerChat("don't cry")).toEqual({ kind: "emotion", echo: "sadness" });
  });
});

describe("detectUnbuiltVerbLine — named-but-unbuilt verb requests", () => {
  // 26 Aug 2026, Maxime: "the chat command can be anything those I said
  // where obvious thing to try. exemple, 'lets play poker' 'lets play peg'
  // 'lets drink' 'lets spar'." These aren't real HubMessage kinds (see the
  // function's own header) — just a distinct "not open yet" outcome,
  // separate from the generic CHAT_FALLBACK_LINES shrug.
  it("no longer treats a fletchers request as unbuilt either — graduated the same day, once darts shipped", () => {
    expect(detectUnbuiltVerbLine("let's play fletchers")).toBeNull();
    expect(detectUnbuiltVerbLine("is the fletcher open")).toBeNull();
  });

  it("no longer treats a drink request as unbuilt — it graduated to detectVerbRequest (below) once Share a Drink shipped for real", () => {
    expect(detectUnbuiltVerbLine("let's drink")).toBeNull();
    expect(detectUnbuiltVerbLine("I feel like drinking tonight")).toBeNull();
  });

  it("no longer treats a peg request as unbuilt either — it graduated the same way, 26 Aug 2026, once the peg board shipped as a real interactive minigame", () => {
    expect(detectUnbuiltVerbLine("let's play peg")).toBeNull();
    expect(detectUnbuiltVerbLine("where are the pegs")).toBeNull();
  });

  it("no longer treats a poker request as unbuilt either — graduated the same day, once Texas Hold'em shipped", () => {
    expect(detectUnbuiltVerbLine("let's play poker")).toBeNull();
  });

  it("recognizes a spar request, including the -ing form", () => {
    expect(detectUnbuiltVerbLine("let's spar")).toBeTruthy();
    expect(detectUnbuiltVerbLine("fancy some sparring")).toBeTruthy();
  });

  it("returns null for ordinary text, so it doesn't swallow unrelated messages", () => {
    expect(detectUnbuiltVerbLine("what's the weather like today")).toBeNull();
  });

  it("returns null for muster/emotion text, so it never shadows the real recognizer", () => {
    expect(detectUnbuiltVerbLine("muster up")).toBeNull();
    expect(detectUnbuiltVerbLine("I'm so angry")).toBeNull();
  });

  it("word-boundary matches 'spar' — does not false-positive inside 'sparse' or 'disparage'", () => {
    expect(detectUnbuiltVerbLine("that's a sparse map")).toBeNull();
    expect(detectUnbuiltVerbLine("don't disparage the effort")).toBeNull();
  });

  it("returns null for empty or whitespace-only input", () => {
    expect(detectUnbuiltVerbLine("")).toBeNull();
    expect(detectUnbuiltVerbLine("   ")).toBeNull();
  });
});

describe("detectVerbRequest — real, actionable verb framework requests", () => {
  // 26 Aug 2026, verb framework's first consumer (data/verbs.ts). "drink"
  // graduated out of detectUnbuiltVerbLine into here once Share a Drink
  // became a real, runnable verb — see that describe block's own updated
  // test above for the other half of this change.
  it("recognizes a drink request, including the -ing form and 'booze'", () => {
    expect(detectVerbRequest("let's drink")).toBe("shareADrink");
    expect(detectVerbRequest("I feel like drinking tonight")).toBe("shareADrink");
    expect(detectVerbRequest("got any booze")).toBe("shareADrink");
  });

  it("recognizes a peg board request, singular and plural — the peg board's second real verb, 26 Aug 2026", () => {
    expect(detectVerbRequest("let's play peg")).toBe("pegBoard");
    expect(detectVerbRequest("where are the pegs")).toBe("pegBoard");
  });

  it("recognizes a poker request — Texas Hold'em, the third real verb, 26 Aug 2026", () => {
    expect(detectVerbRequest("let's play poker")).toBe("poker");
    expect(detectVerbRequest("deal me in for poker")).toBe("poker");
  });

  it("recognizes a fletchers/darts request — the fourth real verb, 26 Aug 2026", () => {
    expect(detectVerbRequest("let's play fletchers")).toBe("fletchers");
    expect(detectVerbRequest("is the fletcher open")).toBe("fletchers");
    expect(detectVerbRequest("wanna throw some darts")).toBe("fletchers");
    expect(detectVerbRequest("dart")).toBe("fletchers");
  });

  it("recognizes an Ask Out request — the fifth real verb, Phase 3 piece two, 26 Aug 2026", () => {
    expect(detectVerbRequest("let's ask her out")).toBe("askOut");
    expect(detectVerbRequest("i want to ask him out")).toBe("askOut");
    expect(detectVerbRequest("date me")).toBe("askOut");
    expect(detectVerbRequest("go on a date with me")).toBe("askOut");
  });

  it("returns null for verbs that exist as names but have no real VerbDef yet (spar)", () => {
    expect(detectVerbRequest("let's spar")).toBeNull();
  });

  it("returns null for ordinary text and for muster/emotion text", () => {
    expect(detectVerbRequest("what's the weather like today")).toBeNull();
    expect(detectVerbRequest("muster up")).toBeNull();
    expect(detectVerbRequest("I'm so angry")).toBeNull();
  });

  it("returns null for empty or whitespace-only input", () => {
    expect(detectVerbRequest("")).toBeNull();
    expect(detectVerbRequest("   ")).toBeNull();
  });
});

describe("detectHistoryRequest — Hub polish, 26 Aug 2026", () => {
  it("recognizes every listed keyword", () => {
    expect(detectHistoryRequest("show me your history")).toBe(true);
    expect(detectHistoryRequest("what's in the log")).toBe(true);
    expect(detectHistoryRequest("give me a recap")).toBe(true);
    expect(detectHistoryRequest("let's catch up")).toBe(true);
  });

  it("does not false-positive on 'log' as a substring — same bug class this file already caught once (mad/made, cry/cryptic, mission/submission)", () => {
    expect(detectHistoryRequest("nice catalog of gear")).toBe(false);
    expect(detectHistoryRequest("check the blog post")).toBe(false);
  });

  it("returns false for ordinary text and for muster/emotion/verb-request text", () => {
    expect(detectHistoryRequest("what's the weather like today")).toBe(false);
    expect(detectHistoryRequest("muster up")).toBe(false);
    expect(detectHistoryRequest("let's play poker")).toBe(false);
  });

  it("returns false for empty or whitespace-only input", () => {
    expect(detectHistoryRequest("")).toBe(false);
    expect(detectHistoryRequest("   ")).toBe(false);
  });
});

describe("detectHighlightsRequest — Highlights reel, 27 Aug 2026", () => {
  it("recognizes every listed keyword", () => {
    expect(detectHighlightsRequest("show me the highlights")).toBe(true);
    expect(detectHighlightsRequest("what's my highlight with her")).toBe(true);
    expect(detectHighlightsRequest("any milestones so far")).toBe(true);
    expect(detectHighlightsRequest("hit a milestone yet?")).toBe(true);
    expect(detectHighlightsRequest("what's your memory of us")).toBe(true);
    expect(detectHighlightsRequest("tell me our memories")).toBe(true);
  });

  it("is a distinct request from detectHistoryRequest — the two keyword sets don't overlap", () => {
    expect(detectHighlightsRequest("show me your history")).toBe(false);
    expect(detectHistoryRequest("show me the highlights")).toBe(false);
  });

  it("returns false for ordinary text and for muster/emotion/verb-request text", () => {
    expect(detectHighlightsRequest("what's the weather like today")).toBe(false);
    expect(detectHighlightsRequest("muster up")).toBe(false);
    expect(detectHighlightsRequest("let's play poker")).toBe(false);
  });

  it("returns false for empty or whitespace-only input", () => {
    expect(detectHighlightsRequest("")).toBe(false);
    expect(detectHighlightsRequest("   ")).toBe(false);
  });
});

describe("detectBuildRequest — Antfarm build economy, first slice, 27 Aug 2026", () => {
  // 27 Aug 2026, Maxime: "he ask what you wana build. player gotta ask.
  // build me this'' mek workshop" — build requests go through the CO via
  // typed chat, matched against known bays (buildable now, or named but not
  // yet built) rather than accepting arbitrary free text. Room/proximity
  // gating (talking to the CO specifically) lives in Hub.ts's submitChat,
  // same as every other verb here — this function only classifies the text.
  it("recognizes each of the four original buildable reserved bays", () => {
    expect(detectBuildRequest("build me a sensor array")).toEqual({ kind: "buildable", id: "sensorArray" });
    expect(detectBuildRequest("can you build the beacon control")).toEqual({ kind: "buildable", id: "beaconControl" });
    expect(detectBuildRequest("build a generator")).toEqual({ kind: "buildable", id: "generator" });
    expect(detectBuildRequest("build me a restock room")).toEqual({ kind: "buildable", id: "restockRoom" });
  });

  it("recognizes shorthand and synonym phrasing for the buildable bays", () => {
    expect(detectBuildRequest("build a reactor")).toEqual({ kind: "buildable", id: "generator" });
    expect(detectBuildRequest("build the resupply beacon")).toEqual({ kind: "buildable", id: "beaconControl" });
    expect(detectBuildRequest("build restock")).toEqual({ kind: "buildable", id: "restockRoom" });
  });

  // 28 Aug 2026: Weapons Bay and Fabricator GRADUATED out of the
  // "named-but-unbuilt" bucket below into real buildable bays, once
  // Hub.ts grew two more markers for them and engine/mission.ts +
  // engine/campaignEconomy.ts wired in real effects. Mirrors this file's
  // own established "graduation" pattern (drink/peg/poker/fletchers, all
  // documented above in the VERB_REQUEST_KEYWORDS comment) — recognized
  // but inert becomes recognized and real, same function, different bucket.
  it("recognizes Weapons Bay and Fabricator as buildable now that they have real space + real effects", () => {
    expect(detectBuildRequest("can we get a fabricator built")).toEqual({ kind: "buildable", id: "fabricator" });
    expect(detectBuildRequest("build a weapons bay")).toEqual({ kind: "buildable", id: "weaponsBay" });
    expect(detectBuildRequest("build a weapon bay")).toEqual({ kind: "buildable", id: "weaponsBay" });
    expect(detectBuildRequest("build a fabrication bay")).toEqual({ kind: "buildable", id: "fabricator" });
  });

  it("recognizes named-but-unbuilt systems as a distinct, honest 'not yet' outcome (Maxime's own example)", () => {
    expect(detectBuildRequest("build me this, mek workshop")).toEqual({ kind: "unbuildable", id: "mekWorkshop" });
  });

  it("recognizes a request for the rec room as unbuildable — it's already standing, not a bay to build", () => {
    expect(detectBuildRequest("build a rec room")).toEqual({ kind: "unbuildable", id: "recRoom" });
  });

  it("returns null for ordinary text and for muster/emotion/verb-request text — doesn't swallow unrelated messages", () => {
    expect(detectBuildRequest("what's the weather like today")).toBeNull();
    expect(detectBuildRequest("muster up")).toBeNull();
    expect(detectBuildRequest("let's play poker")).toBeNull();
  });

  it("returns null for a request naming something not tracked anywhere in the design docs", () => {
    expect(detectBuildRequest("build me a swimming pool")).toBeNull();
  });

  it("returns null for empty or whitespace-only input", () => {
    expect(detectBuildRequest("")).toBeNull();
    expect(detectBuildRequest("   ")).toBeNull();
  });
});
