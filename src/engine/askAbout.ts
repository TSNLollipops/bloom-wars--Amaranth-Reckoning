// src/engine/askAbout.ts
// Ask About, 17 Sep 2026 — verb plan §6 #2, Maxime's go from school.
//
// "where are you from", "tell me about yourself". The one new verb this
// project can add with ZERO new character lines, because the answer already
// exists: every authored pilot has an Archive dossier body (data/archive.ts,
// `pilot_*` entries) and every generated recruit has an intake line built
// from their real background (engine/archiveDossier.ts formatIntakeLine).
// Ask About hands the player that record one sentence at a time, in order,
// and remembers how far it got through the pilot's own socialLog — the
// same persisted record every other verb writes to — so it rotates instead
// of repeating and can't be farmed.
//
// What it deliberately is NOT: the pilot "speaking" their file. The dossier
// is written in the Archive's record register (third person, "Raised in
// Skeinreach's weave-mill housing..."), and rewriting it into a first-person
// voice would be writing lines, which are Maxime's. So the bubble is
// framed as the file being read, not the pilot talking — Hub.ts prefixes
// it with the FILE_PREFIX below. That framing is UI copy, not character
// voice. If he later wants each pilot to answer in their own words, that's
// a bank per pilot, and it slots in here as a preferred source over the
// dossier without changing the mechanic.
//
// Pure, no Phaser, no scenes/ import — same discipline as every engine
// module. Hub.ts owns the bubble, the Favorability write and persistence.
import type { CampaignPilotEntry, CampaignState } from "./campaignState";
import type { SocialLogEntry } from "../data/verbs";
import { buildArchiveDossier } from "./archiveDossier";

/** Shown in front of the sentence so it reads as a record excerpt, not speech. UI copy. */
export const ASK_ABOUT_FILE_PREFIX = "[from the file] ";

/** The first time you ask, they notice you asked. Once, not per sentence. Placeholder, same rule as every number in socialActions.ts. */
export const ASK_ABOUT_FAVORABILITY_DELTA = 1;

/** When there's nothing left on file. UI copy, not a character line — every pilot says the same thing. */
export const ASK_ABOUT_EXHAUSTED_LINE = "Nothing more on file. The Archive has the rest.";

/** For a CO, a Mek, or anyone without a roster entry. UI copy. */
export const ASK_ABOUT_NO_FILE_LINE = "No file to read from here. Try the Archive.";

export interface AskAboutResult {
  /** The sentence to show (already prefixed), or the exhausted/no-file line. */
  line: string;
  /** True when a sentence was actually revealed and should be logged. */
  revealed: boolean;
  /** True on the very first reveal for this pilot — the one that pays out. */
  first: boolean;
  /** How many sentences the file has in total, for a tooltip or a test. */
  total: number;
}

/**
 * Split record prose into sentences a bubble can hold. A dossier paragraph
 * is 60–100 words; a bubble wants one thought. Splits on sentence-ending
 * punctuation followed by a space and a capital letter or a quote, which is
 * what the Archive prose uses (no em dashes or semicolons by rule, so those
 * are not sentence breaks here). Never returns an empty list for non-empty
 * input.
 */
export function splitRecordSentences(paragraphs: readonly string[]): string[] {
  const out: string[] = [];
  for (const p of paragraphs) {
    const parts = p
      .split(/(?<=[.!?])\s+(?=["“(A-Z0-9])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    // A dossier often opens on a fragment ("Reeps." — the path, then the
    // real sentence). A one-word reveal reads as a glitch, so anything
    // under SHORT_FRAGMENT characters is folded into the sentence after it.
    const merged: string[] = [];
    for (const part of parts) {
      const prev = merged[merged.length - 1];
      if (prev !== undefined && prev.length < SHORT_FRAGMENT) merged[merged.length - 1] = `${prev} ${part}`;
      else merged.push(part);
    }
    out.push(...merged);
  }
  return out;
}

/** Sentences shorter than this are glued to the next one. */
const SHORT_FRAGMENT = 24;

/** Everything the file says about this pilot, in the order the Archive shows it. Empty when there's no entry and no intake line. */
export function recordSentencesFor(state: CampaignState, entry: CampaignPilotEntry): string[] {
  const dossier = buildArchiveDossier(state, entry);
  if (dossier.entry?.body && dossier.entry.body.length > 0) return splitRecordSentences(dossier.entry.body);
  if (dossier.entry?.revisions && dossier.entry.revisions.length > 0) {
    const latest = dossier.entry.revisions[dossier.entry.revisions.length - 1];
    return splitRecordSentences(latest.body);
  }
  if (dossier.intake) return [dossier.intake];
  return [];
}

/** How many sentences have already been read to the player, off the pilot's own log. */
export function askAboutRevealedCount(socialLog: readonly SocialLogEntry[] | undefined): number {
  if (!socialLog) return 0;
  let n = 0;
  for (const e of socialLog) if (e.verb === "askAbout") n += 1;
  return n;
}

/**
 * Resolve one Ask About. Pure: reads the state and the pilot's log, returns
 * what to show. The caller logs the entry (which is what advances the
 * count next time), applies the Favorability delta on `first`, and persists.
 */
export function askAbout(state: CampaignState, entry: CampaignPilotEntry | undefined, socialLog: readonly SocialLogEntry[] | undefined): AskAboutResult {
  if (!entry) return { line: ASK_ABOUT_NO_FILE_LINE, revealed: false, first: false, total: 0 };
  const sentences = recordSentencesFor(state, entry);
  const revealed = askAboutRevealedCount(socialLog);
  if (sentences.length === 0) return { line: ASK_ABOUT_NO_FILE_LINE, revealed: false, first: false, total: 0 };
  if (revealed >= sentences.length) return { line: ASK_ABOUT_EXHAUSTED_LINE, revealed: false, first: false, total: sentences.length };
  return { line: ASK_ABOUT_FILE_PREFIX + sentences[revealed], revealed: true, first: revealed === 0, total: sentences.length };
}
