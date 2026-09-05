// src/engine/recRoomRecord.ts
// Rec Room Standings & NPC Learning, slice 2 — the record store.
//
// This reverses a decision that was filed as "someday" on 26 Aug 2026
// (Bloom_Wars_Walkable_Hub_Build_Plan_v1.md §15/§16). Maxime's own ask was
// "id love it if our npc csn get experience and learn to play those game
// good as time goes on," and it was closed for exactly one stated reason:
// "gets better over time" only means something once it survives a reload,
// and pilot persistence did not exist yet. It does now — bonds,
// relationships, Favorability, Stress, Morale, the calendar clock, house
// standing and Heirloom flags all persist — so the reason is gone and this
// is a correction pass on that entry, not a new idea.
//
// Pure, no Phaser, no scenes/ import — same discipline as pegBoard.ts /
// darts.ts / holdem.ts, so it is unit-testable without a browser and
// usable straight from the headless sim harness.

import type { Catalyst } from "../data/ambientLines";
import type { Path } from "../data/types";
import { REC_GAME_IDS, aptitudeFor, type RecGameId } from "../data/recRoomAptitude";

export type { RecGameId } from "../data/recRoomAptitude";

export interface GameRecord {
  played: number; // sessions completed — this, and only this, is what drives skill
  wins: number;
  draws: number;
  losses: number;
  best?: number; // best single result; per-game meaning, a keepsake, drives nothing
  lastPlayedDay?: number; // calendar day, so the panel can say "nothing since Day 41"
}

export interface RecRoomState {
  records: Record<string, Partial<Record<RecGameId, GameRecord>>>;
}

// Rourke sits in the same map as the crew, per Maxime's own call: "you sit
// on the same board as the crew, ranked inline, and beating you moves
// their record like any other session." A reserved id rather than a
// separate field, so every ranking, sorting and tie-breaking rule is
// written exactly once and cannot drift between "the player's row" and
// "everyone else's row."
export const PLAYER_RECORD_ID = "player_rourke";

// ---- Skill is DERIVED, never stored -----------------------------------
//
//   skill(played) = aptitude x (1 - e^(-played / LEARNING_TAU))
//
// A saturating exponential, the standard shape of a real practice curve.
// At TAU = 25: 63% of ceiling by 25 sessions, 86% by 50, 95% by 75. A real
// early climb, a long plateau, no runaway.
//
// The reason this is a function and not a field is worth stating plainly,
// because it is the more general habit: STORE WHAT HAPPENED, DERIVE WHAT
// IT MEANS. `played` is a fact — a session was finished. Skill is an
// interpretation of that fact. Keeping only the fact means there is no
// second copy to drift, no way for a bug to corrupt someone's skill, and
// no save migration needed if this curve is ever retuned — an old save
// just reads differently on its next load.
export const LEARNING_TAU = 25;

export function skillFromPlayed(aptitude: number, played: number): number {
  if (played <= 0) return 0;
  return aptitude * (1 - Math.exp(-played / LEARNING_TAU));
}

/** A pilot's live skill at one game, 0..100. */
export function skillFor(
  state: RecRoomState,
  pilotId: string,
  catalyst: Catalyst,
  gameId: RecGameId,
  path?: Path,
): number {
  const played = state.records[pilotId]?.[gameId]?.played ?? 0;
  return skillFromPlayed(aptitudeFor(pilotId, catalyst, gameId, path), played);
}

// ---- Standing ---------------------------------------------------------
//
// points = wins x 3 + draws x 1. No Elo. A player can read this off the
// board and know immediately what would move it, which an Elo rating does
// not give you.
export const WIN_POINTS = 3;
export const DRAW_POINTS = 1;

export function standingPoints(rec: GameRecord | undefined): number {
  if (!rec) return 0;
  return rec.wins * WIN_POINTS + rec.draws * DRAW_POINTS;
}

export function winRate(rec: GameRecord | undefined): number {
  if (!rec || rec.played <= 0) return 0;
  return rec.wins / rec.played;
}

export function emptyRecord(): GameRecord {
  return { played: 0, wins: 0, draws: 0, losses: 0 };
}

/**
 * Sum a pilot's record across all three games — what the "All" tab ranks
 * on. Summing the component records rather than keeping a fourth stored
 * total is the same store-the-fact rule as skill above: a running total
 * is a second copy of something already known, and second copies drift.
 */
export function combinedRecord(byGame: Partial<Record<RecGameId, GameRecord>> | undefined): GameRecord {
  const total = emptyRecord();
  if (!byGame) return total;
  for (const rec of Object.values(byGame)) {
    if (!rec) continue;
    total.played += rec.played;
    total.wins += rec.wins;
    total.draws += rec.draws;
    total.losses += rec.losses;
    if (rec.lastPlayedDay !== undefined) {
      total.lastPlayedDay = Math.max(total.lastPlayedDay ?? 0, rec.lastPlayedDay);
    }
  }
  // `best` is deliberately left undefined on a combined record. The three
  // games score on completely different scales (peg board has no score at
  // all, darts tops out at 450, poker is chips won) so a single "best"
  // across them would be a number that means nothing.
  return total;
}

// ---- Recording a session ----------------------------------------------

export interface SessionEntry {
  gameId: RecGameId;
  a: string; // pilotId, or PLAYER_RECORD_ID
  b: string;
  winner: string | "draw"; // one of a / b, or the literal "draw"
  bestA?: number;
  bestB?: number;
  day?: number;
}

function ensureRecord(state: RecRoomState, pilotId: string, gameId: RecGameId): GameRecord {
  let byGame = state.records[pilotId];
  if (!byGame) {
    byGame = {};
    state.records[pilotId] = byGame;
  }
  let rec = byGame[gameId];
  if (!rec) {
    rec = emptyRecord();
    byGame[gameId] = rec;
  }
  return rec;
}

function applySide(state: RecRoomState, pilotId: string, entry: SessionEntry, best: number | undefined): void {
  const rec = ensureRecord(state, pilotId, entry.gameId);
  rec.played += 1;
  if (entry.winner === "draw") rec.draws += 1;
  else if (entry.winner === pilotId) rec.wins += 1;
  else rec.losses += 1;
  if (best !== undefined && (rec.best === undefined || best > rec.best)) rec.best = best;
  if (entry.day !== undefined) rec.lastPlayedDay = entry.day;
}

/**
 * One function, three callers: the player's own finished sessions in
 * Hub.ts, the ambient NPC-vs-NPC encounters in socialSim.ts, and the
 * headless tuning harness. Both sides of a session always get a row —
 * there is no such thing as a game only one person played.
 *
 * Self-play (a === b) is refused rather than double-counted. It should
 * never happen, but a pair-picking bug upstream that silently gave one
 * pilot 200 sessions against themselves would be very hard to notice from
 * the board alone.
 */
export function recordSession(state: RecRoomState, entry: SessionEntry): void {
  if (entry.a === entry.b) return;
  applySide(state, entry.a, entry, entry.bestA);
  applySide(state, entry.b, entry, entry.bestB);
}

// ---- The board ---------------------------------------------------------
//
// Ranking lives here, not in the panel, for the same reason hubGeometry.ts
// exists: every scene file in this repo imports Phaser at module scope,
// and that import throws outside a real browser. Anything worth a unit
// test has to sit outside scenes/. Sorting rules are exactly the kind of
// thing that looks obviously right and is quietly wrong, so they belong on
// this side of that line.

export type StandingsTab = RecGameId | "all";

/** Everything the board needs about one candidate, gathered by the caller. */
export interface StandingsEntrant {
  pilotId: string;
  displayName: string;
  catalyst: Catalyst;
  path?: Path;
  lost?: boolean;
  lostOnDay?: number;
  isPlayer?: boolean;
}

export interface StandingsRow {
  rank: number;
  pilotId: string;
  displayName: string;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  best?: number;
  skill: number;
  lost: boolean;
  lostOnDay?: number;
  isPlayer: boolean;
}

export interface StandingsBoard {
  rows: StandingsRow[];
  /** Aboard, alive, and yet to play this one. The board says so rather than pretending they don't exist. */
  unplayed: string[];
  /** Highest live skill among the living — the line the points column cannot say. */
  bestAboard?: { displayName: string; skill: number; rank: number };
}

function skillOnTab(state: RecRoomState, e: StandingsEntrant, tab: StandingsTab): number {
  if (tab !== "all") return skillFor(state, e.pilotId, e.catalyst, tab, e.path);
  const each = REC_GAME_IDS.map((g) => skillFor(state, e.pilotId, e.catalyst, g, e.path));
  return each.reduce((a, b) => a + b, 0) / each.length;
}

/**
 * Rank one tab of the board.
 *
 * Order: points, then win rate, then FEWER games played (you earned the
 * same points in less), then name for a stable sort. No Elo — a player can
 * read this off the screen and know what would move it.
 *
 * Only entrants who have actually played appear. A board where eleven of
 * fourteen rows read 0-0-0 is noise, and the `unplayed` list carries that
 * fact honestly instead.
 */
export function buildStandings(state: RecRoomState, entrants: readonly StandingsEntrant[], tab: StandingsTab): StandingsBoard {
  const rows: StandingsRow[] = [];
  const unplayed: string[] = [];

  for (const e of entrants) {
    const byGame = state.records[e.pilotId];
    const rec = tab === "all" ? combinedRecord(byGame) : byGame?.[tab];
    if (!rec || rec.played === 0) {
      if (!e.lost) unplayed.push(e.displayName);
      continue;
    }
    rows.push({
      rank: 0,
      pilotId: e.pilotId,
      displayName: e.displayName,
      points: standingPoints(rec),
      played: rec.played,
      wins: rec.wins,
      draws: rec.draws,
      losses: rec.losses,
      best: rec.best,
      skill: skillOnTab(state, e, tab),
      lost: e.lost ?? false,
      lostOnDay: e.lostOnDay,
      isPlayer: e.isPlayer ?? false,
    });
  }

  rows.sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    const wx = x.played > 0 ? x.wins / x.played : 0;
    const wy = y.played > 0 ? y.wins / y.played : 0;
    if (wy !== wx) return wy - wx;
    if (x.played !== y.played) return x.played - y.played;
    return x.displayName.localeCompare(y.displayName);
  });
  rows.forEach((r, i) => {
    r.rank = i + 1;
  });

  // The line under the table, and the whole reason skill and standing are
  // two numbers instead of one: "Bosk is 4th, and nobody aboard plays
  // better than him" is a sentence a single Elo rating cannot produce.
  let bestAboard: StandingsBoard["bestAboard"];
  for (const r of rows) {
    if (r.lost) continue;
    if (!bestAboard || r.skill > bestAboard.skill) bestAboard = { displayName: r.displayName, skill: r.skill, rank: r.rank };
  }

  return { rows, unplayed, bestAboard };
}

/**
 * "3rd" / "21st" / "12th". Lives here rather than in the panel purely so
 * it sits on the testable side of the Phaser line — the panel file cannot
 * be imported outside a browser at all.
 */
export function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

// ---- THE ONE RULE THAT MAKES THE GRIEF BEAT WORK ----------------------
//
// NOTHING EVER DELETES FROM `records`. Not on a pilot's death, not on
// reassignment, not in any save-cleanup pass anyone writes later.
//
// This is stated this loudly because it looks exactly like a bug. Someone
// will eventually write a cleanup pass, see keys in this map pointing at
// pilots who are not on the roster, and reasonably conclude they are
// orphans. They are not orphans. A dead pilot's high score still sitting
// on the board, with the day they were lost beside it, IS the feature —
// it is the thing Maxime asked for by name back on 26 Aug 2026, and it is
// the whole reason this record survives the pilot.
//
// If you are here because you are writing that cleanup pass: the answer
// is no.
