// src/engine/darts.ts
// Fletchers — Rec Room minigame, 26 Aug 2026. Last of the three named
// Rec Room minigames to actually ship (peg board, then Poker, now this).
// Build Plan §13 left Fletchers with real direction but no locked ruleset:
// Maxime's own words, "fletcher is like persona 5 royal," resolved via an
// AskUserQuestion fork to "both the chill vibe and a real mini-game," then
// sharpened again the same day — "the fletcher game in the pool zone...
// the dart is a zone in the rec room" plus a separate, explicit "dart" —
// confirming the concrete mechanic (darts) and its home (a distinct zone
// inside the existing Rec Room, not a new walkable room of its own), with
// a second fork resolved the same way: a real skill-based aim/power throw,
// not a simplified click-to-resolve turn the way the peg board's clicks
// are. Real-world darts scoring (concentric rings, a bullseye worth the
// most) is public-domain content, same "real game, not book material"
// reasoning already on record for Poker being Texas Hold'em.
//
// Same division of labor as pegBoard.ts/holdem.ts: this file is the pure,
// Phaser-free rules engine — a throw's accuracy in, a scored result and
// updated session state out. Hub.ts owns turning that into pixels (the
// dartboard rings, the sweeping aim meter, the landed-dart markers) and
// clicks/timing (locking the meter). The meter's own animation — where a
// value continuously sweeps 0..1..0 and the player locks it near the
// player-favorable end — is a UI/timing concern that lives entirely in
// Hub.ts; this file only ever receives the already-locked accuracy value
// a throw was attempted at (0 = wildly off, 1 = dead-on) and turns that
// into a real, scored outcome, the same way the peg board's engine only
// ever receives an already-clicked destination dot.
//
// Session shape, picked fresh for this game since nothing was locked
// beyond "darts" and "skill-based": three rounds, three darts per round
// per side (the real-world convention of "a dart is thrown in threes"),
// human and AI alternating whole rounds. Higher total after all darts are
// thrown wins; equal totals draw. Not tuned against playtesting — same
// "not a locked number" caveat every other placeholder number in this
// scene already carries (Build Plan §4).

export type DartZone = "bullseye" | "inner" | "mid" | "outer" | "miss";
export type DartsPlayerId = "human" | "ai";

export interface DartThrow {
  aim: number; // the raw value the meter was locked at, 0..1, before hand-jitter
  accuracy: number; // aim + hand-jitter, clamped 0..1 — what actually decided the zone
  zone: DartZone;
  score: number;
}

export interface DartsGameState {
  round: number; // 1-based
  totalRounds: number;
  dartsPerRound: number;
  turn: DartsPlayerId; // whose throw is next
  dartsThrownThisTurn: number; // 0..dartsPerRound-1, resets whenever turn changes
  throws: Record<DartsPlayerId, DartThrow[]>;
  totals: Record<DartsPlayerId, number>;
  status: "playing" | "over";
  winner: DartsPlayerId | "draw" | null; // set only once status === "over"
}

export const DARTS_TOTAL_ROUNDS = 3;
export const DARTS_PER_ROUND = 3;

// Zone boundaries, expressed as minimum accuracy — exported so Hub.ts can
// derive the dartboard's ring radii and the aim meter's colored bands from
// these exact same numbers rather than duplicating them as magic
// constants that could quietly drift out of sync with real scoring.
export const DART_ZONE_THRESHOLDS: Record<Exclude<DartZone, "miss">, number> = {
  bullseye: 0.92,
  inner: 0.75,
  mid: 0.5,
  outer: 0.2,
};

// How far a throw's actual accuracy can drift from where the meter was
// locked — hands aren't perfectly steady even when the timing was dead
// on. Small enough that a genuinely well-timed lock (aim near 1) always
// still lands bullseye, and a badly-timed one (aim near 0) always still
// misses — see the exact-threshold tests in darts.test.ts — but real
// enough that a mid-board lock can land a zone either side of where it
// looked. Same "controlled randomness, not a pure script" shape as the
// peg board's AI tiebreak and Poker's own decision jitter.
const HAND_JITTER = 0.05;

// Not a full solver — a fixed skill center with real spread, same
// "greedy-ish with some randomness" philosophy as pickPegAiMove and
// pickPokerAiAction. Deliberately not perfect, so the player has a real
// target to beat rather than an unbeatable wall or a pushover.
const AI_SKILL_MEAN = 0.62;
const AI_SKILL_SPREAD = 0.28;

// ---- Skill parameterization (Rec Room Standings & NPC Learning, slice 1)
//
// The engine used to know exactly one thing about the thrower: nothing.
// pickAiThrowValue() took no arguments and read two module constants, so
// every AI throw in the game came from the same distribution forever.
// That is fine for one hardcoded opponent and useless the moment two
// NPCs of different ability sit down against each other.
//
// The fix is the same "policy" split pegBoard.ts already had by accident:
// the engine says what a throw at a given skill looks like, and something
// outside it decides whose skill that is. Skill here is exactly the two
// numbers the throw already depended on — a better thrower aims closer to
// the bullseye (higher mean) and is more consistent about it (tighter
// spread).
//
// DEFAULT_DARTS_SKILL is the old pair, byte for byte, so pickAiThrowValue()
// keeps its exact previous behaviour and every existing darts test stays
// green without a single edit. That equivalence is the whole safety net
// for touching a shipped, working file — if a test needed changing, the
// refactor changed behaviour, and that would be a bug in the refactor.
export interface DartsSkill {
  mean: number; // 0..1 — where this thrower's aim centers
  spread: number; // 0..1 — how far it wanders either side of that
}

export const DEFAULT_DARTS_SKILL: DartsSkill = { mean: AI_SKILL_MEAN, spread: AI_SKILL_SPREAD };

// Maps a 0..100 skill number (recRoomRecord.ts's derived skill) onto the
// two throw parameters. Kept here rather than in the record store because
// what "skill" means for darts is a fact about darts, not about the
// record-keeping: it is this file that knows a thrower's ability shows up
// as aim center and consistency.
//
// The endpoints are deliberately not 0 and 1. A skill-0 thrower still
// lands the odd outer ring by luck, and a skill-100 thrower still misses
// bullseye sometimes — a dartboard with a guaranteed winner is not a game
// anybody would keep playing.
export function dartsSkillFor(skill: number): DartsSkill {
  const t = Math.max(0, Math.min(100, skill)) / 100;
  // Retuned 3 Sep 2026 against `npm run sim:recroom`. The first pass had
  // mean 0.35..0.85 with spread 0.34..0.14, and measured a skill-70
  // beating a skill-30 in 99.9% of sessions. That is not a game — the
  // underdog never has a night, and a standings board where the result
  // was decided before anyone threw is a table of aptitudes, not a
  // record.
  //
  // Nine darts averages hard, so the fix is a narrower mean gap and a
  // spread that stays wide even at the top: a good thrower is better, not
  // immune to a bad round.
  return { mean: 0.42 + t * 0.34, spread: 0.44 - t * 0.14 };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function zoneForAccuracy(accuracy: number): DartZone {
  if (accuracy >= DART_ZONE_THRESHOLDS.bullseye) return "bullseye";
  if (accuracy >= DART_ZONE_THRESHOLDS.inner) return "inner";
  if (accuracy >= DART_ZONE_THRESHOLDS.mid) return "mid";
  if (accuracy >= DART_ZONE_THRESHOLDS.outer) return "outer";
  return "miss";
}

export function scoreForZone(zone: DartZone): number {
  switch (zone) {
    case "bullseye":
      return 50;
    case "inner":
      return 30;
    case "mid":
      return 20;
    case "outer":
      return 10;
    case "miss":
      return 0;
  }
}

export function zoneLabel(zone: DartZone): string {
  switch (zone) {
    case "bullseye":
      return "Bullseye";
    case "inner":
      return "Inner ring";
    case "mid":
      return "Mid ring";
    case "outer":
      return "Outer ring";
    case "miss":
      return "Miss";
  }
}

export function createDartsGame(): DartsGameState {
  return {
    round: 1,
    totalRounds: DARTS_TOTAL_ROUNDS,
    dartsPerRound: DARTS_PER_ROUND,
    turn: "human",
    dartsThrownThisTurn: 0,
    throws: { human: [], ai: [] },
    totals: { human: 0, ai: 0 },
    status: "playing",
    winner: null,
  };
}

// The one state-mutating entry point — mirrors applyMove/applyHoldemAction's
// shape (pure, returns a new state) rather than mutating in place, same
// convention as the rest of this project's engine files.
export function throwDart(state: DartsGameState, aim: number): { state: DartsGameState; result: DartThrow } {
  if (state.status !== "playing") throw new Error("throwDart called on a game that's already over");

  const clampedAim = clamp01(aim);
  const jitter = (Math.random() * 2 - 1) * HAND_JITTER;
  const accuracy = clamp01(clampedAim + jitter);
  const zone = zoneForAccuracy(accuracy);
  const score = scoreForZone(zone);
  const result: DartThrow = { aim: clampedAim, accuracy, zone, score };

  const thrower = state.turn;
  const throws = { ...state.throws, [thrower]: [...state.throws[thrower], result] };
  const totals = { ...state.totals, [thrower]: state.totals[thrower] + score };
  const dartsThrown = state.dartsThrownThisTurn + 1;

  let turn = state.turn;
  let round = state.round;
  let dartsThrownThisTurn = dartsThrown;
  // Explicitly widened — the throw-if-not-playing guard above narrows
  // state.status to the literal "playing" at this point, which would
  // otherwise infer `status` as that same single-value literal type and
  // reject the "over" assignment below.
  let status: DartsGameState["status"] = state.status;
  let winner = state.winner;

  if (dartsThrown >= state.dartsPerRound) {
    dartsThrownThisTurn = 0;
    if (thrower === "human") {
      turn = "ai";
    } else if (round >= state.totalRounds) {
      status = "over";
      winner = totals.human > totals.ai ? "human" : totals.ai > totals.human ? "ai" : "draw";
    } else {
      round = round + 1;
      turn = "human";
    }
  }

  return { state: { ...state, throws, totals, turn, round, dartsThrownThisTurn, status, winner }, result };
}

// The AI never sees the live meter — it just picks an aim value the way a
// human's locked-in timing would, centered on a fixed skill level with
// real spread. Same throwDart path applies the same hand-jitter and
// scoring on top, so the AI isn't secretly exempt from the randomness a
// human throw carries. Takes no game-state input on purpose — the AI's
// skill is a flat distribution, not something that reads round/score
// context (unlike pickPegAiMove/pickPokerAiAction, which genuinely need
// the board/hand to decide anything) — no unused parameter kept around
// for a hook nothing uses yet.
export function pickAiThrowValue(): number {
  return pickThrowValue();
}

// The parameterized version pickAiThrowValue now delegates to. Called
// directly by NPC-vs-NPC sessions, which supply a real per-pilot skill.
export function pickThrowValue(skill: DartsSkill = DEFAULT_DARTS_SKILL): number {
  const jitter = (Math.random() * 2 - 1) * skill.spread;
  return clamp01(skill.mean + jitter);
}
