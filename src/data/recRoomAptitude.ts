// src/data/recRoomAptitude.ts
// Rec Room Standings & NPC Learning, slice 2 — the aptitude table.
//
// Aptitude is a pilot's CEILING at a game: how good they could ever get if
// they played it forever. It is not how good they are today; that is skill,
// and skill is derived from practice in engine/recRoomRecord.ts.
//
// Two things made this worth deriving rather than hand-authoring:
//
//   1. A hand-written table would need a new row every time a recruit is
//      generated, and generated recruits are unbounded. Deriving from
//      catalyst means every future recruit has a personality at the card
//      table on the day they walk aboard, with nobody having to write one.
//   2. It is deterministic. The same pilot has the same ceiling on every
//      load, in the batch harness, and in a unit test, without a single
//      byte of it living in the save file.
//
// Same discipline as the rest of src/data/**: pure, no Phaser, no scenes/
// import, no engine/ import. This file knows about catalysts and mech
// classes and nothing else.

import type { Catalyst } from "./ambientLines";
import type { Path } from "./types";

export type RecGameId = "pegBoard" | "poker" | "fletchers";

export const REC_GAME_IDS: RecGameId[] = ["pegBoard", "poker", "fletchers"];

// ---- The opponent floor, 17 Sep 2026 -----------------------------------
//
// Until today the crew member the PLAYER sat down against never used their
// own skill at all: Hub.ts played every opponent at each engine's flat
// default (darts mean 0.62; peg board best move every time; poker's
// shipped heuristic), while NPC-vs-NPC sessions and the standings board's
// "skill" column both used the real, learned number. The board could say
// "Bosk, skill 71" and Bosk would then throw exactly like a rookie against
// you.
//
// Maxime's call (verb plan §11, decision 1): the player's opponent uses the
// real learned skill, WITH A FLOOR so nobody is a pushover. The floor is
// per game because "today's level" was not one level: darts' default sits
// at about skill 59 on dartsSkillFor's curve; the peg board's default was
// the CEILING (bestMoveChance 1 == skill 100), so a floor "at today" there
// would have meant the skill column never shows in a peg game; poker's
// default lands around skill 80, above what most of the crew reach for a
// long while. His pick, from the three options put to him: darts exactly at
// today, peg and poker at a moderate opponent so a veteran visibly plays
// better than a rookie in all three games.
//
// Placeholders under the same rule as every other number in this file:
// retune with tester data, not before. Applied in Hub.ts as
// Math.max(skillFor(...), OPPONENT_SKILL_FLOOR[game]) before the engine's
// own xSkillFor() mapping; NPC-vs-NPC sessions and the standings board
// are untouched and still read the raw learned number.
export const OPPONENT_SKILL_FLOOR: Record<RecGameId, number> = {
  pegBoard: 50,
  poker: 50,
  fletchers: 59,
};

export const REC_GAME_LABELS: Record<RecGameId, string> = {
  pegBoard: "Peg Board",
  poker: "Poker",
  fletchers: "Fletchers",
};

// The character reads, per the plan doc's own first-pass table. Numbers
// are 0..100 and are FLAVOR, not tuned values — Maxime's to overrule, the
// same way every other placeholder number in this project is flagged. What
// each row is saying, in one line each:
//
//   shark   the card shark
//   raven   patient, calculating
//   crow    restless, quick hands, far too loose with chips
//   wolf    reliable, no standout
//   fox     bluffs
//   bear    grinds it out, no bluff in him
//   cat     good hands, loses interest
//   dog     sticks with it
//   rabbit  folds too much
//
// A spread of roughly 45 to 85 is deliberate. Nobody is hopeless and
// nobody is unbeatable: a ceiling of 45 still wins sessions off a 85 who
// has not put the practice in, which is the whole point of splitting
// skill from standing.
export const CATALYST_APTITUDE: Record<Catalyst, Record<RecGameId, number>> = {
  shark: { pegBoard: 62, poker: 88, fletchers: 60 },
  raven: { pegBoard: 85, poker: 72, fletchers: 46 },
  crow: { pegBoard: 48, poker: 44, fletchers: 86 },
  wolf: { pegBoard: 70, poker: 68, fletchers: 69 },
  fox: { pegBoard: 60, poker: 84, fletchers: 62 },
  bear: { pegBoard: 84, poker: 46, fletchers: 58 },
  cat: { pegBoard: 47, poker: 62, fletchers: 82 },
  dog: { pegBoard: 71, poker: 60, fletchers: 63 },
  rabbit: { pegBoard: 61, poker: 45, fletchers: 74 },
};

// A small nudge from what they fly, on the theory that the hands and the
// temperament that make someone a good Meeps pilot are the same ones that
// make them quick at a dartboard. Deliberately small — the plan doc flags
// this whole modifier as the first thing to cut if the system needs to be
// smaller, and at ±6 it genuinely is decoration on top of catalyst rather
// than a second axis competing with it.
//
// Munti gets a flat, even hand: a medic's steadiness reads as no
// particular edge and no particular weakness at any of the three.
export const ARCHETYPE_APTITUDE_NUDGE: Record<Path, Record<RecGameId, number>> = {
  meeps: { pegBoard: -3, poker: 0, fletchers: 6 },
  tank: { pegBoard: 6, poker: -3, fletchers: 0 },
  reeps: { pegBoard: 0, poker: 6, fletchers: -3 },
  munti: { pegBoard: 2, poker: 2, fletchers: 2 },
};

// Deterministic per-pilot jitter so two ravens aren't clones of each other.
// Same 32-bit string hash npcSeed.ts's own catalyst fallback uses — copied
// rather than imported specifically so this file stays a leaf with no
// dependency on the seed module, which imports campaign data.
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const APTITUDE_JITTER = 5; // ± this many points

export function aptitudeJitter(pilotId: string, gameId: RecGameId): number {
  const h = hashString(`${pilotId}:${gameId}`);
  // 0..(2*JITTER) then shifted down, so the range is symmetric and the
  // midpoint (no nudge at all) is a real, reachable value.
  return (h % (APTITUDE_JITTER * 2 + 1)) - APTITUDE_JITTER;
}

/**
 * A pilot's ceiling at one game, 1..100.
 *
 * `path` is optional because not every caller has the pilot's archetype to
 * hand (the standings panel does; a bare pilotId in a save's record map may
 * not, if that pilot has since left the roster). Leaving it out simply
 * drops the archetype nudge rather than failing — a dead pilot's ceiling
 * still resolves, which matters because their record stays on the board
 * forever and the board wants to say how good they were.
 */
export function aptitudeFor(pilotId: string, catalyst: Catalyst, gameId: RecGameId, path?: Path): number {
  const base = CATALYST_APTITUDE[catalyst][gameId];
  const nudge = path ? ARCHETYPE_APTITUDE_NUDGE[path][gameId] : 0;
  const raw = base + nudge + aptitudeJitter(pilotId, gameId);
  return Math.max(1, Math.min(100, raw));
}
