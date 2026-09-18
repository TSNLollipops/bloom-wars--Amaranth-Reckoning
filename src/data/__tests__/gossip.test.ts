// src/data/__tests__/gossip.test.ts — Gossip, 17 Sep 2026. The bank ships
// empty (Maxime's lines); these pin the mechanism around it.
import { describe, it, expect } from "vitest";
import { gossipBandFor, gossipBankReady, gossipBandReady, gossipRung, pickGossipLine, GOSSIP_LINES, GOSSIP_SLOT_WORDS, type GossipBand } from "../gossip";
import { RIVAL_THRESHOLD, CLIQUE_THRESHOLD } from "../npcBonds";
import { detectVerbRequest, extractNamedTarget } from "../chatIntent";
import { VERBS } from "../verbs";

describe("gossipBandFor", () => {
  it("uses the sim's own rival/clique thresholds at the outer edges", () => {
    expect(gossipBandFor(RIVAL_THRESHOLD)).toBe("rival");
    expect(gossipBandFor(RIVAL_THRESHOLD - 50)).toBe("rival");
    expect(gossipBandFor(CLIQUE_THRESHOLD)).toBe("close");
    expect(gossipBandFor(99)).toBe("close");
  });
  it("cool / neutral / warm in between", () => {
    expect(gossipBandFor(RIVAL_THRESHOLD + 1)).toBe("cool");
    expect(gossipBandFor(-6)).toBe("cool");
    expect(gossipBandFor(-5)).toBe("neutral");
    expect(gossipBandFor(0)).toBe("neutral");
    expect(gossipBandFor(5)).toBe("neutral");
    expect(gossipBandFor(6)).toBe("warm");
    expect(gossipBandFor(CLIQUE_THRESHOLD - 1)).toBe("warm");
  });
});

describe("the bank gate", () => {
  it("neutral, rival, cool and warm are written (rival with its three words); only close is left; the verb is still gated off", () => {
    expect(gossipBandReady("neutral")).toBe(true);
    expect(gossipBandReady("rival")).toBe(true);
    expect(gossipBandReady("cool")).toBe(true);
    expect(gossipBandReady("warm")).toBe(true);
    expect(GOSSIP_SLOT_WORDS.rival).toHaveLength(3);
    expect(gossipBandReady("close")).toBe(false);
    expect(gossipBankReady()).toBe(false);
  });
  it("Maxime's rival line with his real words, at each depth", () => {
    expect(pickGossipLine("rival", "wolf", "M.Sgt. Halvard Bosk", "male", -25, () => 0)).toBe("Him? Why you asking? They are a problem to me.");
    expect(pickGossipLine("rival", "wolf", "M.Sgt. Halvard Bosk", "male", -50, () => 0)).toBe("Him? Why you asking? They are an annoying co-worker to me.");
    expect(pickGossipLine("rival", "wolf", "Cpl. Priya Anand", "female", -80, () => 0)).toBe("Her? Why you asking? They are nothing to me.");
  });
  it("Maxime's cool line, flat across depth, pronoun-correct", () => {
    expect(pickGossipLine("cool", "wolf", "Cpl. Priya Anand", "female", -10, () => 0)).toBe("Her and me just doesn't mesh well.");
    expect(pickGossipLine("cool", "wolf", "M.Sgt. Halvard Bosk", "male", -18, () => 0)).toBe("Him and me just doesn't mesh well.");
    expect(pickGossipLine("cool", "wolf", "Tess", undefined, -6, () => 0)).toBe("Them and me just doesn't mesh well.");
  });
  it("Maxime's warm line, {PRONOUN_IS} correct for he's/she's/they're", () => {
    expect(pickGossipLine("warm", "wolf", "M.Sgt. Halvard Bosk", "male", 10, () => 0)).toBe("Oh.. him. Yeah he's cool.");
    expect(pickGossipLine("warm", "wolf", "Cpl. Priya Anand", "female", 18, () => 0)).toBe("Oh.. her. Yeah she's cool.");
    expect(pickGossipLine("warm", "wolf", "Tess", undefined, 6, () => 0)).toBe("Oh.. them. Yeah they're cool.");
  });
  it("a {WORD} line needs all three slot words before its band counts", () => {
    const bank: Record<GossipBand, string[]> = { rival: ["x {WORD}"], cool: ["c"], neutral: ["n"], warm: ["w"], close: ["k"] };
    const words: Record<GossipBand, string[]> = { rival: ["a", "b"], cool: [], neutral: [], warm: [], close: [] };
    expect(gossipBankReady(bank, words)).toBe(false);
    words.rival.push("c");
    expect(gossipBankReady(bank, words)).toBe(true);
  });
  it("opens the moment every band has one line, not before", () => {
    const partial: Record<GossipBand, string[]> = { rival: ["r"], cool: ["c"], neutral: ["n"], warm: ["w"], close: [] };
    expect(gossipBankReady(partial)).toBe(false);
    partial.close.push("x");
    expect(gossipBankReady(partial)).toBe(true);
  });
});

describe("pickGossipLine", () => {
  const bank: Record<GossipBand, string[]> = { rival: ["{NAME}? No."], cool: ["Eh."], neutral: ["{NAME} is fine, I guess. {NAME}."], warm: ["Good one, {NAME}."], close: ["A", "B"] };
  it("substitutes every {NAME} and {SURNAME}", () => {
    expect(pickGossipLine("neutral", "wolf", "Bosk", "male", 0, () => 0, bank, {})).toBe("Bosk is fine, I guess. Bosk.");
    expect(pickGossipLine("rival", "wolf", "Bosk", "male", 0, () => 0, bank, {})).toBe("Bosk? No.");
    const b2: Record<GossipBand, string[]> = { ...bank, warm: ["{SURNAME}. {NAME}."] };
    expect(pickGossipLine("warm", "wolf", "M.Sgt. Halvard Bosk", "male", 0, () => 0, b2, {})).toBe("Bosk. M.Sgt. Halvard Bosk.");
  });
  it("rotates with the rng and prefers a filled catalyst override", () => {
    expect(pickGossipLine("close", "wolf", "B", "male", 0, () => 0.99, bank, {})).toBe("B");
    expect(pickGossipLine("close", "fox", "B", "male", 0, () => 0, bank, { fox: { close: ["fox-only {NAME}"] } })).toBe("Fox-only B");
    expect(pickGossipLine("close", "wolf", "B", "male", 0, () => 0, bank, { fox: { close: ["fox-only"] } })).toBe("A");
  });
});

describe("gossip — wiring", () => {
  it("chat phrases route to the verb; the named crewmate is found separately", () => {
    expect(detectVerbRequest("what do you think of Bosk?")).toBe("gossip");
    expect(detectVerbRequest("how do you feel about Iyari")).toBe("gossip");
    expect(detectVerbRequest("what's your read on anand")).toBe("gossip");
    const roster = [{ pilotId: "pilot_bosk", displayName: "M.Sgt. Halvard Bosk — \"Ironwood\"" }, { pilotId: "pilot_anand", displayName: "Cpl. Priya Anand — \"Farsight\"" }];
    expect(extractNamedTarget("what do you think of bosk?", roster)).toBe("pilot_bosk");
  });
  it("ordinary questions don't become gossip", () => {
    expect(detectVerbRequest("what about the mission")).toBeNull();
    expect(detectVerbRequest("what do you think?")).toBeNull();
  });
  it("has a verb def", () => {
    expect(VERBS.gossip.label).toBe("Gossip");
  });
});


// 17 Sep 2026 — pronoun tokens off the subject's gender (gender.ts's five
// functions, checked by name against the file), plus Maxime's locked
// neutral line through the real bank.
describe("pronoun tokens", () => {
  it("{PRONOUN_IS} is a real contraction, not {PRONOUN} + 's (which breaks for no-gender)", () => {
    const b: Record<GossipBand, string[]> = { rival: ["{PRONOUN_IS} not wrong."], cool: [], neutral: [], warm: [], close: [] };
    expect(pickGossipLine("rival", "wolf", "Bosk", "male", 0, () => 0, b, {})).toBe("He's not wrong.");
    expect(pickGossipLine("rival", "wolf", "Anand", "female", 0, () => 0, b, {})).toBe("She's not wrong.");
    expect(pickGossipLine("rival", "wolf", "Tess", undefined, 0, () => 0, b, {})).toBe("They're not wrong.");
  });
  const bank: Record<GossipBand, string[]> = {
    rival: ["{PRONOUN} keeps {PRONOUN_POSS} distance. That frame is {PRONOUN_POSS_ABS}. Ask {PRONOUN_OBJ} {PRONOUN_REFL}."],
    cool: [], neutral: [], warm: [], close: [],
  };
  it("male / female / no record", () => {
    expect(pickGossipLine("rival", "wolf", "Bosk", "male", 0, () => 0, bank, {})).toBe("He keeps his distance. That frame is his. Ask him himself.");
    expect(pickGossipLine("rival", "wolf", "Anand", "female", 0, () => 0, bank, {})).toBe("She keeps her distance. That frame is hers. Ask her herself.");
    expect(pickGossipLine("rival", "wolf", "Tess", undefined, 0, () => 0, bank, {})).toBe("They keeps their distance. That frame is theirs. Ask them themselves.");
  });
  it("the first letter of a rendered line is always capitalized (a line may open with a token)", () => {
    const b: Record<GossipBand, string[]> = { rival: ["{PRONOUN_OBJ}? no."], cool: [], neutral: [], warm: [], close: [] };
    expect(pickGossipLine("rival", "wolf", "Bosk", "male", -25, () => 0, b, {})).toBe("Him? no.");
  });
  it("Maxime's neutral line resolves for Bosk and for a female subject", () => {
    expect(pickGossipLine("neutral", "wolf", "M.Sgt. Halvard Bosk", "male", 0, () => 0)).toBe("Well... Bosk's not a problem for me. Don't mind him.");
    expect(pickGossipLine("neutral", "wolf", "Cpl. Priya Anand", "female", 0, () => 0)).toBe("Well... Anand's not a problem for me. Don't mind her.");
  });
});


// 17 Sep 2026 — the {WORD} slot by bond depth, and Maxime's rival line.
describe("gossipRung and {WORD}", () => {
  it("three rungs per band by depth", () => {
    expect(gossipRung("rival", -25)).toBe(0);
    expect(gossipRung("rival", -50)).toBe(1);
    expect(gossipRung("rival", -80)).toBe(2);
    expect(gossipRung("close", 25)).toBe(0);
    expect(gossipRung("close", 90)).toBe(2);
    expect(gossipRung("cool", -6)).toBe(0);
    expect(gossipRung("cool", -17)).toBe(2);
    expect(gossipRung("neutral", 0)).toBe(0);
    expect(gossipRung("neutral", -5)).toBe(2);
  });
  it("Maxime's rival line renders with a test word table, capitalized, pronoun-correct", () => {
    const words: Record<GossipBand, string[]> = { rival: ["a problem", "trouble", "nothing"], cool: [], neutral: [], warm: [], close: [] };
    expect(pickGossipLine("rival", "wolf", "M.Sgt. Halvard Bosk", "male", -25, () => 0, GOSSIP_LINES, {}, words)).toBe("Him? Why you asking? They are a problem to me.");
    expect(pickGossipLine("rival", "wolf", "Cpl. Priya Anand", "female", -80, () => 0, GOSSIP_LINES, {}, words)).toBe("Her? Why you asking? They are nothing to me.");
  });
});

// 17 Sep 2026 — {GAME}, Maxime's ask: "I like to play [game] with him,
// depending on history." Hub.ts hands in a real, already-display-cased
// game name off the pair's actual shared Rec Room history
// (recRoomRecord.ts's pairFavoriteGame) — gossip.ts itself has no idea
// what a Rec Room game is, it just fills the blank it's handed, or drops
// the line if it wasn't handed one.
describe("{GAME} — real pair history, not a rung", () => {
  const bank: Record<GossipBand, string[]> = {
    rival: [], cool: [], neutral: [], close: [],
    warm: ["Oh.. {PRONOUN_OBJ}. Yeah {PRONOUN_IS} cool.", "I like to play {GAME} with {PRONOUN_OBJ}."],
  };
  it("fills the blank when history is handed in", () => {
    expect(pickGossipLine("warm", "wolf", "Bosk", "male", 10, () => 0.99, bank, {}, GOSSIP_SLOT_WORDS, "Fletchers")).toBe("I like to play Fletchers with him.");
  });
  it("never draws the {GAME} line when no history was handed in, whatever the roll — always the plain line instead", () => {
    for (let i = 0; i < 20; i += 1) {
      const roll = i / 20;
      expect(pickGossipLine("warm", "wolf", "Bosk", "male", 10, () => roll, bank, {})).toBe("Oh.. him. Yeah he's cool.");
    }
  });
  it("a band written as {GAME}-only still renders something if history is missing, rather than throwing", () => {
    const gameOnly: Record<GossipBand, string[]> = { rival: [], cool: [], neutral: [], warm: ["I like to play {GAME} with {PRONOUN_OBJ}."], close: [] };
    // Nothing else in the band to fall back to, so it renders the literal
    // line with the blank empty — a content gap to notice in testing
    // (a warm band that's ONLY a {GAME} line), never a crash in the wild.
    expect(pickGossipLine("warm", "wolf", "Bosk", "male", 10, () => 0, gameOnly, {})).toBe("I like to play  with him.");
  });
});
