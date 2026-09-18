// src/data/gossip.ts
// Gossip, 17 Sep 2026 — verb plan §6 #1, Maxime's go from school ("build
// Gossip's code, I'll write the 5 lines").
//
// "what do you think of Bosk?" The first verb that lets the player SEE the
// bond graph. npcSocial.bonds (data/npcBonds.ts, pairKey-keyed) has driven
// roaming, cliques, blowups and every NPC-vs-NPC encounter since 26 Aug,
// and until today the only way to read it was to watch who walked toward
// whom. Gossip is a read, not a delta: the target says how they feel about
// the named crewmate, nothing moves, and repeating it is harmless.
//
// THE BANK BELOW SHIPS EMPTY ON PURPOSE. The lines are Maxime's (verb plan
// §11, decision 2). Until every band has at least one line, the verb is
// gated off in Hub.ts (gossipBankReady() below) and typing it gets an
// honest "not open yet" — same pattern the unbuilt-verb list uses. The
// moment his five lines are in, it goes live with no other change.
//
// PROCESS NOTE, 17 Sep 2026 (for any placeholder session picking this up):
// Maxime does NOT write the raw {TOKEN} syntax himself — he said the token
// names were "mean to write with" (confusing to hold in your head while
// writing dialogue, fair complaint). He gives the line in plain English
// with a natural placeholder word ("her", "his name", a blank for a mood
// word), and whoever's building tokenizes it for him. Don't ask him to
// type `{PRONOUN_OBJ}` etc. — read what he wrote, pick the token, tell him
// what you picked and why (see the cool-band comment below for the
// pattern), don't silently guess past an actual ambiguity.
//
// FOR THE LINE THREAD, so the mechanic and the writing agree:
//   - One array per band. A band needs at least one line to count as
//     written; more lines rotate at random. Five lines total is the floor.
//   - `{NAME}` in a line is replaced with the subject's name the way the
//     rest of the ship says it (rank, given name, surname: "M.Sgt. Halvard
//     Bosk" — the same split("—")[0] every encounter summary uses), and
//     `{SURNAME}` with just the last word of that ("Bosk"), which is how
//     the crew actually talk. E.g. "{SURNAME}? Wouldn't trust {SURNAME} to
//     hold a door." → "Bosk? Wouldn't trust Bosk to hold a door."
//   - Pronoun tokens, 17 Sep 2026 (Maxime's ask, via a placeholder chat),
//     resolved off the SUBJECT's gender through data/gender.ts's own five
//     functions (the ones Verinis's grief line uses — real names checked
//     against the file, not guessed):
//       {PRONOUN}       he / she         subjectPronoun
//       {PRONOUN_OBJ}   him / her        objectPronoun
//       {PRONOUN_POSS}  his / her        possessiveDeterminer ("her Mek")
//       {PRONOUN_POSS_ABS} his / hers    possessivePronoun ("that frame is hers")
//       {PRONOUN_REFL}  himself / herself reflexivePronoun
//       {PRONOUN_IS}    he's / she's     (they're, no-gender — see below)
//     A subject with no gender on record (a Mek — gender for Meks is still
//     an open call) gets they / them / their / theirs / themselves / they're
//     rather than a coin flip. E.g. "Don't mind {PRONOUN_OBJ}." → "Don't
//     mind him." {PRONOUN_IS} exists separately from {PRONOUN} because
//     "{PRONOUN}'s cool" would render "they's cool" for a no-gender subject
//     — not a word. Use it whenever a line needs "X's" as a contraction of
//     "X is", not the possessive.
//   - `{WORD}` — a slot word picked by HOW DEEP the bond is inside its
//     band (Maxime, 17 Sep: "a slot for mood based [on] B's familiarity
//     with C" → his pick: bond depth only). Three rungs per band
//     (gossipRung), three words per band in GOSSIP_SLOT_WORDS, his to
//     write. A band whose lines use {WORD} doesn't count as ready until
//     its three words are in. E.g. rival, bond -25 / -50 / -80 → word 0 /
//     1 / 2.
//   - `{GAME}` — 17 Sep 2026, Maxime's ask: a warm line where B says "I
//     like to play {GAME} with him," naming a Rec Room game the TARGET
//     (B, the one talking) and the SUBJECT have actually played together.
//     Real history, not a rung: engine/recRoomRecord.ts's new
//     `pairFavoriteGame()` (a small addition made for this — the old
//     per-pilot records knew a pilot played darts 12 times, never who
//     with) is what Hub.ts reads and hands in as `game` to
//     pickGossipLine() below, already turned into its display name
//     ("Fletchers", not "fletchers"). This file never imports engine/**
//     (see the house rule), so gossip.ts has no idea what a Rec Room game
//     even is — it just fills a blank it's handed, or drops the line
//     entirely if it wasn't handed one (below). A band can mix a {GAME}
//     line with a plain one; {GAME} lines never count against band
//     readiness (unlike {WORD}) — there's nothing to author, only
//     something to wire.
//   - The first letter of a rendered line is capitalized, so a line can
//     open with a token: "{PRONOUN_OBJ}? Why you asking?" → "Him? Why you
//     asking?"
//   - Bands, from the bond number the sim already keeps (same thresholds
//     as npcBonds.ts's RIVAL_THRESHOLD / CLIQUE_THRESHOLD, so "rival" here
//     is exactly what makes two ants drift apart on the deck):
//       rival    bond <= -20   they'd rather not share a room
//       cool     -20 < bond < -5
//       neutral   -5 <= bond <= 5   no particular read
//       warm      5 < bond < 20
//       close    bond >= 20    the pair the roaming code walks toward
//   - Catalyst-neutral first (GOSSIP_LINES). A per-catalyst override slot
//     exists (GOSSIP_LINES_BY_CATALYST) for a second pass; a filled
//     catalyst+band beats the neutral bank for that catalyst only.
//   - Archive prose rules do NOT apply here (this is speech, not record
//     text): contractions, dashes, whatever the voice wants.
import type { Catalyst } from "./ambientLines";
import { CLIQUE_THRESHOLD, RIVAL_THRESHOLD } from "./npcBonds";
import { subjectPronoun, objectPronoun, possessiveDeterminer, possessivePronoun, reflexivePronoun, type Gender } from "./gender";

export type GossipBand = "rival" | "cool" | "neutral" | "warm" | "close";

export const GOSSIP_BANDS: readonly GossipBand[] = ["rival", "cool", "neutral", "warm", "close"];

/** The inner edges of the neutral band. The outer edges are npcBonds.ts's own thresholds. Placeholder, like every number. */
export const GOSSIP_NEUTRAL_HALF_WIDTH = 5;

export function gossipBandFor(bond: number): GossipBand {
  if (bond <= RIVAL_THRESHOLD) return "rival";
  if (bond >= CLIQUE_THRESHOLD) return "close";
  if (bond < -GOSSIP_NEUTRAL_HALF_WIDTH) return "cool";
  if (bond > GOSSIP_NEUTRAL_HALF_WIDTH) return "warm";
  return "neutral";
}

/**
 * How deep inside its band a bond sits: 0 (just over the edge), 1, 2 (as
 * far as it goes). Rung widths are placeholders like every number here.
 * Bonds seed around -25..40 and move by a few points per event, so rung 2
 * is a rivalry or a closeness that took a whole campaign to earn.
 */
export function gossipRung(band: GossipBand, bond: number): 0 | 1 | 2 {
  const depth = Math.abs(bond);
  switch (band) {
    case "rival":
    case "close":
      return depth >= 70 ? 2 : depth >= 40 ? 1 : 0; // band starts at 20
    case "cool":
    case "warm":
      return depth >= 15 ? 2 : depth >= 10 ? 1 : 0; // band spans 5..20
    case "neutral":
      return depth >= 4 ? 2 : depth >= 2 ? 1 : 0; // band spans -5..5
  }
}

// ---- THE BANK. MAXIME'S. Lines transcribed verbatim from his chats. ------
export const GOSSIP_LINES: Record<GossipBand, string[]> = {
  // 17 Sep 2026. His text had the slot as "...": rendered here without the
  // surrounding quote marks, so it reads "They are nothing to me" rather
  // than 'They are "nothing" to me' — his call to put them back.
  rival: ['{PRONOUN_OBJ}? Why you asking? They are {WORD} to me.'],
  // 17 Sep 2026. His line, plain English: "Her and me just doesn't mesh
  // well." No blank, one line for the whole band — flat by his choice, not
  // a placeholder. {PRONOUN_OBJ} because he wrote the colloquial "her"/
  // "him" form, not "she"/"he".
  cool: ["{PRONOUN_OBJ} and me just doesn't mesh well."],
  // 17 Sep 2026, locked in a placeholder chat.
  neutral: ["Well... {SURNAME}'s not a problem for me. Don't mind {PRONOUN_OBJ}."],
  // 17 Sep 2026. His line, plain English: "Oh.. him. Yeah hes cool." Missing
  // apostrophe on "hes" fixed to "he's" (typo, not a voice choice — every
  // other line he's written contracts correctly). {PRONOUN_IS} exists
  // because "{PRONOUN}'s cool" breaks for a no-gender subject ("they's" is
  // not a word) — it's "he's"/"she's"/"they're", not just {PRONOUN} + "'s".
  warm: ["Oh.. {PRONOUN_OBJ}. Yeah {PRONOUN_IS} cool."],
  close: [],
};

/** The three {WORD} rungs per band (see gossipRung). Empty until Maxime writes them. */
export const GOSSIP_SLOT_WORDS: Record<GossipBand, string[]> = {
  // Maxime, 17 Sep 2026 — shallow → deep.
  rival: ["a problem", "an annoying co-worker", "nothing"],
  cool: [],
  neutral: [],
  warm: [],
  close: [],
};

/** The six pronoun forms for one subject; `undefined` gender → singular they. */
export function gossipPronouns(gender: Gender | undefined): { subject: string; object: string; possDet: string; possAbs: string; reflexive: string; isForm: string } {
  if (gender === undefined) return { subject: "they", object: "them", possDet: "their", possAbs: "theirs", reflexive: "themselves", isForm: "they're" };
  return {
    subject: subjectPronoun(gender),
    object: objectPronoun(gender),
    possDet: possessiveDeterminer(gender),
    possAbs: possessivePronoun(gender),
    reflexive: reflexivePronoun(gender),
    // "he's" / "she's" — not just {PRONOUN} + "'s", because that breaks for
    // the no-gender case above ("they's" isn't a word; "they're" is).
    isForm: gender === "male" ? "he's" : "she's",
  };
}

export const GOSSIP_LINES_BY_CATALYST: Partial<Record<Catalyst, Partial<Record<GossipBand, string[]>>>> = {};

/** A band is written when it has a line, and, if any of its lines use {WORD}, all three slot words. */
export function gossipBandReady(band: GossipBand, bank: Record<GossipBand, string[]> = GOSSIP_LINES, words: Record<GossipBand, string[]> = GOSSIP_SLOT_WORDS): boolean {
  const lines = bank[band] ?? [];
  if (lines.length === 0) return false;
  if (lines.some((l) => l.includes("{WORD}")) && (words[band]?.length ?? 0) < 3) return false;
  return true;
}

/** True once every band is written — the gate Hub.ts checks before the verb does anything. */
export function gossipBankReady(bank: Record<GossipBand, string[]> = GOSSIP_LINES, words: Record<GossipBand, string[]> = GOSSIP_SLOT_WORDS): boolean {
  return GOSSIP_BANDS.every((b) => gossipBandReady(b, bank, words));
}

/** UI copy for the gate, not a character line. */
export const GOSSIP_NOT_OPEN_LINE = "They keep their read on the crew to themselves — for now. Not open yet.";

/** UI copy when the line named nobody the target could have an opinion about. */
export const GOSSIP_WHO_LINE = "About who? Name someone aboard.";

export function pickGossipLine(
  band: GossipBand,
  catalyst: Catalyst,
  subjectName: string,
  subjectGender: Gender | undefined,
  bond: number,
  rng: () => number = Math.random,
  bank: Record<GossipBand, string[]> = GOSSIP_LINES,
  byCatalyst: typeof GOSSIP_LINES_BY_CATALYST = GOSSIP_LINES_BY_CATALYST,
  words: Record<GossipBand, string[]> = GOSSIP_SLOT_WORDS,
  // The shared-history game name (already display-cased, "Fletchers" not
  // "fletchers"), or undefined if this pair has never played together.
  // Trailing and optional so every existing call site (none of which know
  // about {GAME}) keeps working unchanged.
  game?: string,
): string {
  const override = byCatalyst[catalyst]?.[band];
  const pool = override && override.length > 0 ? override : bank[band];
  // A {GAME} line has nothing to fill in when there's no shared history —
  // it's dropped from the draw rather than rendered with a blank. If that
  // leaves nothing (a band written as {GAME}-only, with no history yet),
  // fall back to the full pool sooner than render a broken line.
  const eligible = game !== undefined ? pool : pool.filter((l) => !l.includes("{GAME}"));
  const lines = eligible.length > 0 ? eligible : pool;
  const raw = lines[Math.floor(rng() * lines.length)];
  const surname = subjectName.trim().split(/\s+/).pop() ?? subjectName;
  const p = gossipPronouns(subjectGender);
  const word = words[band]?.[gossipRung(band, bond)] ?? "";
  const out = raw
    .replace(/\{NAME\}/g, subjectName)
    .replace(/\{SURNAME\}/g, surname)
    .replace(/\{WORD\}/g, word)
    .replace(/\{GAME\}/g, game ?? "")
    .replace(/\{PRONOUN_POSS_ABS\}/g, p.possAbs)
    .replace(/\{PRONOUN_POSS\}/g, p.possDet)
    .replace(/\{PRONOUN_OBJ\}/g, p.object)
    .replace(/\{PRONOUN_REFL\}/g, p.reflexive)
    .replace(/\{PRONOUN_IS\}/g, p.isForm)
    .replace(/\{PRONOUN\}/g, p.subject);
  return out.charAt(0).toUpperCase() + out.slice(1);
}
