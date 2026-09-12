// src/data/memories.ts
// Emotional Brain, Phase 1 — the Ledger (episodic memory), 12 Sep 2026.
// claude/Bloom_Wars_Emotional_Brain_Build_Plan_v1_12Sep2026.md §3a.
//
// What this is: a pilot's own record of things that happened to them or
// that they were there for. Not a stats tally (engine/statsStore.ts has
// that), not a verb log (HubPilotSocialState.socialLog has that), not a
// "what's on my mind right now" list (data/worries.ts, ephemeral). This
// is what a pilot CARRIES, persisted on HubPilotSocialState.memories
// (engine/campaignState.ts §11), so it survives a reload and is still
// there thirty missions later, only quieter.
//
// The one rule that makes this honest: ONE EVENT, MANY MEMORIES. A
// permanent loss on Mission 12 writes a `lost_squadmate` entry into every
// deployed survivor's own list, each with THEIR OWN echo (how they
// processed it: love / fear / anger / sadness). Anand's memory of Bosk's
// death and Lask's memory of it are two different objects. That is the
// Reaction Engine's "self vs. other" gate (NPC_Reaction_Engine_v1.md §3a)
// made literal: same catalyst, different output per pilot.
//
// Salience decays by IN-GAME DAY (engine/calendarClock.ts's currentDay),
// not real minutes. Maxime's own call, 12 Sep 2026 (build plan §7 Q1):
// worries and hot topics are "what's on my mind right now" and real time
// fits them; a memory is "what I carry" and the campaign's own clock is
// the honest unit. Never fully forgotten, only quiet (MEMORY_FLOOR).
//
// src/data/** purity rule (Build Brief §5.2): pure functions over plain
// arrays, no engine imports, no clock read of its own. Every function
// takes `today` from its caller and returns a NEW array rather than
// mutating, the same shape data/worries.ts already uses.
//
// Every number in this file is a placeholder in the same sense as every
// other social-layer constant (build plan §3a, §6): picked with reasoning,
// checked against `npm run sim:brain`, expected to move.
import type { Echo } from "./ambientLines";

export type MemoryKind =
  // Combat, written at Debrief (engine/debriefCatalyst.ts)
  | "saw_fall" // watched a squadmate go down (they were pulled out, or not)
  | "was_downed" // went down themselves
  | "was_pulled_out" // went down, and a living Munti meant it wasn't the end
  | "lost_squadmate" // a permanent loss they were deployed alongside
  | "got_the_kill" // landed kills this mission (one entry per mission, not per kill)
  | "held_the_line" // an overwatch reaction fired for someone else
  | "patched_someone" // repaired a squadmate
  | "mission_won"
  | "mission_lost"
  // Hub, written by scenes/Hub.ts at the real event
  | "blowup" // an Anger Blowup with a rival (data/angerBlowup.ts)
  | "breakdown" // a Breakdown, and how it resolved (data/breakdown.ts)
  | "was_insulted" // the player used Insult on them
  | "was_gifted" // the player used Gift on them
  | "asked_out"; // the player asked them out (accepted or not is in `echo`)

export interface MemoryEntry {
  kind: MemoryKind;
  /** Epoch ms, same clock as SocialLogEntry.at. For the Highlights reel's dated line. */
  at: number;
  /** In-game calendar day it happened (engine/calendarClock.ts currentDay). Drives decay. */
  day: number;
  /** Where it happened, when it happened on a mission. */
  missionId?: string;
  /** Who this memory is about, other than the pilot themselves (the one who fell, the Munti who could still reach them, the rival in a blowup). */
  about: string[];
  /** Who else was there: the deployed squad on a mission, the same room in the Hub. Recorded now, acted on later (build plan §8, the audience gate). */
  witnesses: string[];
  /** How THIS pilot processed it at the time. Two witnesses of one event can hold two different echoes. */
  echo: Echo;
  /** 0-1 salience at birth. See MEMORY_BIRTH_WEIGHT. */
  weight: number;
}

/** Fixed small stack, same reasoning as WORRIES_STACK_CAP: the weakest is evicted, never the oldest by default. */
export const MEMORY_CAP = 24;
/**
 * Salience multiplier per in-game day. 0.96^14 ≈ 0.56, 0.96^30 ≈ 0.29: a
 * two-week-old loss (weight 1.0) still outranks any fresh ordinary memory,
 * and a month-old one has faded to about the weight of a fresh kill. That
 * is the intended shape (an old grief and a new triumph weigh about the
 * same after a month), not an accident; the first draft of this constant
 * (0.92) had a month-old loss at 0.08 and the test caught it.
 */
export const MEMORY_DECAY_PER_DAY = 0.96;
/** Absolute floor. A loss is never forgotten, only quiet. */
export const MEMORY_FLOOR = 0.05;

/**
 * Birth weight per kind — how loud a memory starts. Losses and downings
 * dominate; kills and repairs are ordinary; the Hub verbs sit in between
 * because they are personal (the player did it to them, on purpose).
 */
export const MEMORY_BIRTH_WEIGHT: Record<MemoryKind, number> = {
  lost_squadmate: 1.0,
  was_pulled_out: 0.8,
  was_downed: 0.7,
  saw_fall: 0.5,
  breakdown: 0.6,
  blowup: 0.5,
  was_insulted: 0.5,
  asked_out: 0.45,
  was_gifted: 0.35,
  mission_lost: 0.35,
  held_the_line: 0.3,
  patched_someone: 0.3,
  got_the_kill: 0.3,
  mission_won: 0.2,
};

/** Current salience of one memory, given today's in-game day. */
export function memorySalience(entry: MemoryEntry, today: number): number {
  const age = Math.max(0, today - entry.day);
  const decayed = entry.weight * Math.pow(MEMORY_DECAY_PER_DAY, age);
  return Math.max(MEMORY_FLOOR, Math.min(1, decayed));
}

/**
 * Insert `entry`, evicting the least salient one if the list is over the
 * cap. Ties on salience evict the older one. Returns a new array; the
 * caller assigns it back (HubPilotSocialState.memories = addMemory(...)).
 */
export function addMemory(entries: readonly MemoryEntry[] | undefined, entry: MemoryEntry, today: number): MemoryEntry[] {
  const next = [...(entries ?? []), entry];
  if (next.length <= MEMORY_CAP) return next;
  let evict = 0;
  for (let i = 1; i < next.length; i++) {
    const a = memorySalience(next[i], today);
    const b = memorySalience(next[evict], today);
    if (a < b || (a === b && next[i].at < next[evict].at)) evict = i;
  }
  next.splice(evict, 1);
  return next;
}

/** The `n` loudest memories today, loudest first; ties go to the most recent. */
export function topMemories(entries: readonly MemoryEntry[] | undefined, today: number, n = 3): MemoryEntry[] {
  return [...(entries ?? [])]
    .sort((a, b) => memorySalience(b, today) - memorySalience(a, today) || b.at - a.at)
    .slice(0, Math.max(0, n));
}

/** Every memory that names `pilotId` in `about`, most recent first. */
export function memoriesAbout(entries: readonly MemoryEntry[] | undefined, pilotId: string): MemoryEntry[] {
  return (entries ?? []).filter((m) => m.about.includes(pilotId)).sort((a, b) => b.at - a.at);
}

/** How many memories of one kind a pilot carries — the ledger's own tally, for "third loss this campaign" reads. */
export function countMemories(entries: readonly MemoryEntry[] | undefined, kind: MemoryKind): number {
  return (entries ?? []).filter((m) => m.kind === kind).length;
}

/** Sum of current salience across every memory of one echo — how much of each feeling a pilot is carrying right now. */
export function echoLoad(entries: readonly MemoryEntry[] | undefined, today: number): Record<Echo, number> {
  const load: Record<Echo, number> = { love: 0, fear: 0, anger: 0, sadness: 0 };
  for (const m of entries ?? []) load[m.echo] += memorySalience(m, today);
  return load;
}

/**
 * The plain-language noun for a kind, for system-text surfaces (the
 * Archive dossier's "Carries" block, engine/archiveDossier.ts; the
 * Highlights reel, data/highlights.ts). Record lines, not character voice:
 * a dossier entry about the pilot, never the pilot speaking. Archive prose
 * rule applies (no em dashes, no semicolons).
 */
export const MEMORY_KIND_LABEL: Record<MemoryKind, string> = {
  saw_fall: "Watched a squadmate fall",
  was_downed: "Went down",
  was_pulled_out: "Went down and was restocked",
  lost_squadmate: "Lost a squadmate",
  got_the_kill: "Took the kill",
  held_the_line: "Held overwatch for the squad",
  patched_someone: "Patched a squadmate up",
  mission_won: "Came back from a win",
  mission_lost: "Came back from a loss",
  blowup: "Blew up at a rival",
  breakdown: "Broke down",
  // "their commander" rather than a rank or a name: the player is Rourke
  // (2nd Lt. to Maj.) on Warden and Marrow (Col.) on House Amaranth, and
  // this label has to read right for both.
  was_insulted: "Was insulted by their commander",
  was_gifted: "Was given a gift by their commander",
  asked_out: "Was asked out by their commander",
};
