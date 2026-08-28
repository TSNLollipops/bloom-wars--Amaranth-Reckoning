// src/data/chatIntent.ts
// Build Plan §9, piece #3, 26 Aug 2026 — "open chat window text... cmon guys
// to the bay" (Maxime's own original phrasing for the whole muster-and-
// launch idea, §9's header quote). This is the interpretation layer that
// makes a real typed text box possible: it turns whatever the player typed
// into one of the HubMessage kinds Hub.ts's propagation system already
// understands, or into nothing (null) if it can't tell what was meant.
//
// Deliberately rule-based, not a language model — a real design
// conversation, not a shortcut. Maxime's own words: "a menu is rigid, I
// want flexibility" (ruled out a picklist), then "I ultimately want the
// chat bot to be able to react to typed chat" (the real target — a live
// model reading free text), then, once the cost was actually laid out —
// a live API needs a backend this project has never had, plus a running
// per-message bill; a model small enough to run in-browser is still a
// multi-MB-to-GB download, competes with the game loop for the player's
// own CPU/GPU, and needs a fallback anyway since WebGPU isn't universal —
// "lets build with longevity in mind." Longevity here means this file's
// only contract is interpretPlayerChat(text) -> HubMessage | null. Nothing
// else in Hub.ts knows or cares whether the answer came from keyword-
// matching (today) or a real model (someday) — swapping the implementation
// later never has to touch the propagation/UI code that calls it.
//
// Scope of THIS pass, kept narrow same as pieces #1/#2: recognizes muster
// calls and the four existing Echo emotions (love/fear/anger/sadness,
// ambientLines.ts) via keyword buckets. Does NOT attempt rumor — a rumor
// needs an asker/rejector pair, which free text doesn't reliably supply
// without a real Ask Out system to anchor it to (still Phase 3, per the
// Build Plan doc) — rumor stays reachable only via the R debug key for now.
// Unrecognized text returns null; Hub.ts's caller decides what a "didn't
// catch that" moment looks like, this file only classifies.
import type { Echo, HubMessage } from "./ambientLines";
import type { VerbId } from "./verbs";

// Keyword buckets, not exhaustive by design — real coverage grows with
// actual playtesting, not by guessing every synonym up front. Order below
// matters: muster is checked first, since "let's move" style phrasing can
// otherwise read as fear/anger. Ties within the emotion buckets are broken
// by whichever bucket has the most keyword hits in the message; a genuine
// tie keeps the fixed EMOTION_ORDER below.
const MUSTER_KEYWORDS = [
  "muster",
  "bay",
  "assemble",
  "move out",
  "moving out",
  "let's go",
  "lets go",
  "heading out",
  "suit up",
  "rally",
  "launch",
  "mission",
];

const EMOTION_KEYWORDS: Record<Echo, string[]> = {
  anger: ["angry", "mad", "furious", "stupid", "idiot", "shut up", "hate", "damn", "pissed", "screw this"],
  fear: ["scared", "afraid", "worried", "worry", "danger", "careful", "nervous", "risky", "watch out"],
  sadness: ["sad", "sorry", "miss", "lost", "grief", "mourn", "cry", "rough day", "hurts"],
  love: ["thanks", "thank you", "good job", "proud", "love", "appreciate", "well done", "nice work"],
};

// Fixed tie-break order when two emotion buckets score equal on the same
// message — arbitrary but stable, so the same input always resolves the
// same way rather than depending on object key iteration order.
const EMOTION_ORDER: Echo[] = ["anger", "fear", "sadness", "love"];

// Escapes regex metacharacters in a keyword so it can be dropped into a
// RegExp literally — matters here because a couple of keywords contain
// characters that mean something to a regex engine (the apostrophe in
// "let's go" is harmless, but this guards against any future keyword that
// isn't, e.g. one with a period or parenthesis).
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Word-boundary matching, not plain substring search — found the hard way
// while writing this file's tests: "mad" (an ANGER_KEYWORDS entry) matched
// inside "made," "cry" (SADNESS_KEYWORDS) matched inside "cryptic," and
// "mission" (MUSTER_KEYWORDS) matched inside "submission"/"commission."
// \b anchors only the start/end of the whole keyword, so multi-word phrases
// like "shut up" or "rough day" still match fine across their internal space.
function countHits(text: string, keywords: string[]): number {
  let hits = 0;
  for (const kw of keywords) {
    const pattern = new RegExp(`\\b${escapeRegExp(kw)}\\b`);
    if (pattern.test(text)) hits++;
  }
  return hits;
}

// Named-but-unbuilt verb requests — 26 Aug 2026, Maxime, after piece #3
// shipped with only muster/emotion: "the chat command can be anything
// those I said where obvious thing to try. exemple, 'lets play poker'
// 'lets play peg' 'lets drink' 'lets spar'." Deliberately kept OUT of
// interpretPlayerChat/HubMessage rather than added as new HubMessage
// kinds: Poker and the peg game are real, named Phase 2 Rec Room
// features (Build Plan §5) with no minigame built yet, and "spar" isn't
// a designed verb anywhere in this project yet, just a name Maxime tried.
// Recognizing the phrase costs nothing; the reason it doesn't become a
// real HubMessage is that there is nothing for propagate()/broadcastMessage
// to DO with it yet. So this is a separate, narrower function: it tells
// Hub.ts "the player asked for something real that isn't open yet,"
// distinct from CHAT_FALLBACK_LINES' "no idea what you meant" — a
// recognized-but-inert command should read as "not built," not as
// confusion, per the tradeoff Maxime signed off on (his "your call",
// choosing the honest-placeholder option over holding entirely or
// building Phase 2 for real as a side effect of a chat question).
// Same word-boundary matching as countHits, for the same reason (a naive
// substring check on "spar" would false-positive inside "sparse" or
// "disparage"). Order is fixed and arbitrary, same purpose as
// EMOTION_ORDER — stable resolution if a message somehow hits two buckets.
//
// "drink" GRADUATED out of this list, 26 Aug 2026, once the verb
// framework (data/verbs.ts) made Share a Drink real — see
// detectVerbRequest below. "peg" GRADUATED the same way, same day, once
// the peg board (src/engine/pegBoard.ts) shipped as a real, interactive
// minigame — Maxime: "Inter for all 3" (interactive, not simulated),
// starting with the peg board since it was the only one of the three
// with a locked ruleset. "poker" GRADUATED the same way again, same day,
// once Texas Hold'em (src/engine/holdem.ts) shipped — Maxime confirmed
// the variant ("pker is the texas version") and asked for a real AI
// opponent, not a simulated result. "fletchers" GRADUATED the same way
// again, same day, once darts (src/engine/darts.ts) shipped — Maxime's
// "fletcher is like persona 5 royal" resolved to a real skill-based
// aim/power throw, living inside the Rec Room as its own zone rather than
// a new room. "spar" stays, since nothing has designed it at all yet, not
// even a reference.
const UNBUILT_VERB_LINES: { verb: string; keywords: string[]; line: string }[] = [
  { verb: "spar", keywords: ["spar", "sparring"], line: "No sparring ring here — not a thing yet." },
];

// Real verb requests — 26 Aug 2026, the verb framework's first consumer.
// Checked BEFORE detectUnbuiltVerbLine (Hub.ts's submitChat), so "drink"
// resolves to an actual Share a Drink call instead of either the
// generic fallback or (now-removed) unbuilt-placeholder line. Deliberately
// separate from detectUnbuiltVerbLine rather than one shared table with a
// built/unbuilt flag: this one returns a VerbId Hub.ts can actually act
// on, that one returns display text — different enough contracts that
// merging them would just mean every call site re-branching on which
// case it got back. Same word-boundary matching as everything else in
// this file, same reasoning each time (a naive substring check would
// false-positive "drink" fragments the way "mad"/"cry"/"mission" already
// did before countHits was fixed).
// askOut, 26 Aug 2026 — Phase 3, piece two. Whole-phrase keywords rather
// than a name-in-the-middle pattern ("ask X out") — countHits matches a
// literal phrase, so "ask her out"/"ask him out" are listed directly
// instead of trying to parse a name out of the sentence, same "not
// exhaustive by design, grows from playtesting" philosophy as every other
// bucket in this file.
const VERB_REQUEST_KEYWORDS: Partial<Record<VerbId, string[]>> = {
  shareADrink: ["drink", "drinking", "booze"],
  pegBoard: ["peg", "pegs"],
  poker: ["poker"],
  fletchers: ["fletcher", "fletchers", "dart", "darts"],
  askOut: ["ask out", "ask her out", "ask him out", "ask them out", "date me", "go on a date", "date you"],
};

export function detectVerbRequest(raw: string): VerbId | null {
  const text = raw.trim().toLowerCase();
  if (!text) return null;
  for (const [verbId, keywords] of Object.entries(VERB_REQUEST_KEYWORDS) as [VerbId, string[]][]) {
    if (countHits(text, keywords) > 0) return verbId;
  }
  return null;
}

// Checked by Hub.ts before interpretPlayerChat, so a recognized-but-inert
// command doesn't fall into the generic "didn't catch that" shrug. Returns
// null for anything that doesn't match one of the named-but-unbuilt verbs
// above — everything else (muster, the four emotions, true gibberish)
// still goes through interpretPlayerChat/CHAT_FALLBACK_LINES exactly as
// before this existed.
export function detectUnbuiltVerbLine(raw: string): string | null {
  const text = raw.trim().toLowerCase();
  if (!text) return null;
  for (const entry of UNBUILT_VERB_LINES) {
    if (countHits(text, entry.keywords) > 0) return entry.line;
  }
  return null;
}

// History request — Hub polish, 26 Aug 2026. Not a VerbId: viewing your
// own socialLog with an NPC has no Requirements/Cost/Outcome (§3's verb
// shape) — it's a pure read, nothing about the world changes — so this
// stays its own boolean check rather than being folded into
// detectVerbRequest/VERB_REQUEST_KEYWORDS, same reasoning
// detectUnbuiltVerbLine already used to justify staying separate from
// that table. "log" is the one keyword here worth a second look for the
// same false-positive class this file has caught twice before (mad/made,
// cry/cryptic, mission/submission): \b-anchored countHits does NOT match
// "log" inside "catalog" or "blog" (no word boundary immediately before
// "log" in either), so it's safe to keep as a single bare word.
const HISTORY_KEYWORDS = ["history", "log", "recap", "catch up"];

export function detectHistoryRequest(raw: string): boolean {
  const text = raw.trim().toLowerCase();
  if (!text) return false;
  return countHits(text, HISTORY_KEYWORDS) > 0;
}

// Highlights request — Social Sim Roadmap #11, 27 Aug 2026. Same shape and
// same reasoning as detectHistoryRequest immediately above: a pure read
// (nothing about the world changes), so it's its own boolean check rather
// than a VerbId. Deliberately a DIFFERENT keyword set from History's,
// checked separately in Hub.ts, rather than folding "highlights" into
// HISTORY_KEYWORDS — History shows the raw recent log, Highlights shows a
// curated "first of each kind" summary plus current status; conflating the
// two words would make it impossible for the player to ever ask for one
// specifically. False-positive check against this file's own established
// gotcha classes (mad/made, cry/cryptic, mission/submission, log/catalog):
// "highlights," "milestones," "memory," and "memories" are all safe as
// bare \b-anchored words — none of them are substrings-with-no-boundary
// inside a shorter keyword already in use elsewhere in this file (in
// particular, "miss" from SADNESS_KEYWORDS does not match inside
// "memories" — \bmiss\b requires "miss" itself as the bounded token, and
// "memories" contains no such substring at all).
const HIGHLIGHTS_KEYWORDS = ["highlights", "highlight", "milestones", "milestone", "memory", "memories"];

export function detectHighlightsRequest(raw: string): boolean {
  const text = raw.trim().toLowerCase();
  if (!text) return false;
  return countHits(text, HIGHLIGHTS_KEYWORDS) > 0;
}

// Antfarm build economy, first slice, 27 Aug 2026 — Maxime: "the room
// should be built from asking the CO carabil... he ask what you wana
// build. player gotta ask. 'build me this' mek workshop." Same
// keyword-bucket philosophy as every other detect* function in this file,
// not a free-text parser — confirmed scope (AskUserQuestion, 27 Aug 2026):
// the CO recognizes requests for rooms already designed somewhere in the
// project's docs, matched by keyword/synonym, rather than accepting any
// string the player types. This function itself doesn't know or care who
// the player is talking to — same as every other detect* export here —
// that gate (must be standing with the CO specifically) lives in Hub.ts's
// submitChat, the one place that actually knows which NPC is nearby.
//
// Two outcomes, not one, because "recognized" and "buildable right now"
// are genuinely different things: BuildableBayId covers every reserved
// marker Hub.ts's egg-hull/expansion passes have actually placed on the
// deck — real physical space to build into. Originally just the first
// four (Sensor Array, Beacon Control, Generator, Restock Room, 27 Aug
// 2026); Weapons Bay and Fabricator joined this list 28 Aug 2026 once
// Hub.ts grew two more markers for them (see that file's own RESERVED_BAYS
// comment) — they are NOT still in KnownUnbuildableId below. That list now
// covers only things that genuinely have no space carved out anywhere yet:
// an already-live pre-built room that isn't something to "build" again
// (Rec Room), or a whole separate, still-100%-design system with no bay of
// its own at all (Mek Workshop — Bloom_Wars_Mek_Workshop_And_Weapon_
// Progression_v1.md, not being built this pass — see that doc's own status
// note). Distinguishing these lets the CO give an honest "not yet, here's
// why" instead of either silently ignoring the request or fabricating a
// room nobody designed.
export type BuildableBayId = "sensorArray" | "beaconControl" | "generator" | "restockRoom" | "weaponsBay" | "fabricator";
export type KnownUnbuildableId = "recRoom" | "mekWorkshop";
export type BuildRequest = { kind: "buildable"; id: BuildableBayId } | { kind: "unbuildable"; id: KnownUnbuildableId };

const BUILDABLE_BAY_KEYWORDS: Record<BuildableBayId, string[]> = {
  sensorArray: ["sensor array", "sensor", "long range sensor", "long-range sensor"],
  beaconControl: ["beacon", "beacon control", "resupply beacon"],
  generator: ["generator", "reactor"],
  restockRoom: ["restock room", "restock", "resupply room"],
  weaponsBay: ["weapons bay", "weapon bay"],
  fabricator: ["fabricator", "fabrication bay"],
};

// "workshop" alone deliberately resolves to Mek Workshop, not the
// already-live Workshop room — a player typing that word while talking to
// the CO is almost certainly asking about the still-unbuilt lance
// workshop this pass is surfacing honestly, not asking to build a room
// that's already standing on the upper deck.
const UNBUILDABLE_KEYWORDS: Record<KnownUnbuildableId, string[]> = {
  recRoom: ["rec room", "recroom", "mess hall", "mess deck"],
  mekWorkshop: ["mek workshop", "mech workshop", "workshop"],
};

// Buildable bays checked first — if a message somehow hits both buckets
// (none do today, checked by inspection: no keyword string above appears
// in more than one bucket) a real, actionable outcome should win over an
// honest "not yet," same precedence reasoning as everything else in this
// file (detectVerbRequest before detectUnbuiltVerbLine, etc.).
export function detectBuildRequest(raw: string): BuildRequest | null {
  const text = raw.trim().toLowerCase();
  if (!text) return null;
  for (const [id, keywords] of Object.entries(BUILDABLE_BAY_KEYWORDS) as [BuildableBayId, string[]][]) {
    if (countHits(text, keywords) > 0) return { kind: "buildable", id };
  }
  for (const [id, keywords] of Object.entries(UNBUILDABLE_KEYWORDS) as [KnownUnbuildableId, string[]][]) {
    if (countHits(text, keywords) > 0) return { kind: "unbuildable", id };
  }
  return null;
}

export function interpretPlayerChat(raw: string): HubMessage | null {
  const text = raw.trim().toLowerCase();
  if (!text) return null;

  if (countHits(text, MUSTER_KEYWORDS) > 0) return { kind: "muster" };

  let bestEcho: Echo | null = null;
  let bestScore = 0;
  for (const echo of EMOTION_ORDER) {
    const score = countHits(text, EMOTION_KEYWORDS[echo]);
    if (score > bestScore) {
      bestScore = score;
      bestEcho = echo;
    }
  }
  if (bestEcho) return { kind: "emotion", echo: bestEcho };

  return null;
}

// Shown when interpretPlayerChat returns null — a shrug, not a real
// HubMessage, so it does NOT get handed to propagate(): nobody relays "I
// didn't understand that" down the ship. Catalyst-neutral on purpose,
// same reasoning as MUSTER_LINES being one shared bank rather than nine —
// confusion isn't a personality beat worth writing per-catalyst for.
export const CHAT_FALLBACK_LINES = ["Didn't catch that.", "...come again?", "Not sure what you mean.", "Come again?"];
