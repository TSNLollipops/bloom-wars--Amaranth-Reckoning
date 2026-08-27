// src/engine/pegBoard.ts
// Rec Room minigame #3 of 3 (Poker/Fletchers still need their own design
// pass before they can be built — see claude/Bloom_Wars_Walkable_Hub_Build_Plan_v1.md's
// "still not built" line). The peg board's own ruleset was locked 25 Aug
// 2026 (Maxime shared the actual rules) and confirmed safe to build
// against — see claude/Bloom_Wars_Antfarm_Carrier_Hub_v1.md's 25 Aug update:
// "nothing about the ruleset itself is book-specific." That confirmation
// deliberately excludes the source material's own flavor text (a name for
// the opening move's sound, an unexplained "feels wrong" note) — flagged
// there as reaching for Qiraki's own rune-tech material rather than being
// original to this game. NONE of that flavor is used here. This module
// only implements the plain mechanics: a 3x3 dot grid, one line per turn
// continuing from your own last line's end, no crossing, Reach/Shield/
// Knot. Naming-lock discipline: this file, and everything that calls it,
// says "the peg board" only, never any other name.
//
// 26 Aug 2026, Maxime: "Inter for all 3" (interactive, not simulated) —
// picked over a cheaper simulated-outcome build once the cost difference
// was laid out. This is the pure logic half of that: board state, legal
// moves, Reach/Shield/Knot detection, win conditions. Zero Phaser/UI
// dependency on purpose, so it's fully unit-testable on its own — the
// interactive click-based board (Hub.ts) is a separate, thin layer on top
// that only ever calls legalMovesForTurn()/applyMove().
//
// A few mechanical details below aren't spelled out in the confirmed-safe
// summary word-for-word (e.g. exactly how a "still-open dot" locks, or
// that the Shield move has to be exempt from the normal continuation
// rule) — those are filled in here as ordinary, necessary game-design
// completions of the stated ruleset, not sourced from anywhere else.
// Where a choice was genuinely open (which two dots the locked opening
// connects; same-color-only Knots so the "most Knots" tiebreak has
// something to count per side; ending the game the instant a side has no
// legal move rather than a skip-turn rule), it was made fresh for this
// build, not copied from the book-side material.

export type PegSide = "a" | "b";

export interface PegLine {
  a: number; // dot id
  b: number; // dot id
  side: PegSide;
  exempt?: boolean; // true only for a Shield line — see applyMove
}

export interface PendingReach {
  side: PegSide; // who formed the Reach — the defender is the OTHER side
  a: number; // outer end of the bend
  b: number; // the corner dot
  c: number; // outer end of the bend — closing line is a<->c
}

export type PegStatus = "playing" | { winner: PegSide } | { winner: "draw" };

export interface PegGameState {
  lines: PegLine[];
  pathEnd: Record<PegSide, number | null>;
  lastRealLine: Record<PegSide, { a: number; b: number } | null>;
  locked: Set<number>;
  knotCount: Record<PegSide, number>;
  turn: PegSide;
  pendingReach: PendingReach | null;
  status: PegStatus;
  log: string[];
}

export interface PegMove {
  from: number;
  to: number;
}

// 3x3 grid, ids 0-8, row-major. Only used for geometry (crossing/collinear
// tests) — Hub.ts's UI layer maps these to its own pixel positions.
const COORD: { col: number; row: number }[] = [
  { col: 0, row: 0 }, { col: 1, row: 0 }, { col: 2, row: 0 },
  { col: 0, row: 1 }, { col: 1, row: 1 }, { col: 2, row: 1 },
  { col: 0, row: 2 }, { col: 1, row: 2 }, { col: 2, row: 2 },
];

// The 8 pairs whose straight line passes exactly through a third dot (the
// 3 rows, 3 columns, 2 diagonals). Banned as a single direct trace — a
// real peg would sit exactly on that line. This is what guarantees a
// two-line "bend" always has a genuine corner: you can never draw the
// straight 3-dot span in one move to begin with.
const KEY = (x: number, y: number) => (x < y ? `${x}-${y}` : `${y}-${x}`);
const BANNED_PAIRS = new Set(
  [[0, 2], [3, 5], [6, 8], [0, 6], [1, 7], [2, 8], [0, 8], [2, 6]].map(([x, y]) => KEY(x, y))
);

// Nobody chooses this — it's fixed, always the same two dots, always side
// "a". An arbitrary, original pick for this build (top-left to
// top-middle): short, plain, not the book's diagonal.
const LOCKED_OPENING: PegMove = { from: 0, to: 1 };

function orient(px: number, py: number, qx: number, qy: number, rx: number, ry: number): number {
  return (qx - px) * (ry - py) - (qy - py) * (rx - px);
}

function properlyIntersects(p1: number, p2: number, p3: number, p4: number): boolean {
  const P1 = COORD[p1], P2 = COORD[p2], P3 = COORD[p3], P4 = COORD[p4];
  const o1 = orient(P1.col, P1.row, P2.col, P2.row, P3.col, P3.row);
  const o2 = orient(P1.col, P1.row, P2.col, P2.row, P4.col, P4.row);
  const o3 = orient(P3.col, P3.row, P4.col, P4.row, P1.col, P1.row);
  const o4 = orient(P3.col, P3.row, P4.col, P4.row, P2.col, P2.row);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

function isCollinear(a: number, b: number, c: number): boolean {
  const A = COORD[a], B = COORD[b], C = COORD[c];
  const cross = (B.col - A.col) * (C.row - A.row) - (B.row - A.row) * (C.col - A.col);
  return cross === 0;
}

function edgeExists(state: PegGameState, x: number, y: number): boolean {
  const k = KEY(x, y);
  return state.lines.some((l) => KEY(l.a, l.b) === k);
}

function crossesAnything(state: PegGameState, from: number, to: number): boolean {
  for (const l of state.lines) {
    if (l.a === from || l.a === to || l.b === from || l.b === to) continue; // shared endpoint — touching, not crossing
    if (properlyIntersects(from, to, l.a, l.b)) return true;
  }
  return false;
}

function sideLineCount(state: PegGameState, dot: number, side: PegSide): number {
  let n = 0;
  for (const l of state.lines) if (l.side === side && (l.a === dot || l.b === dot)) n++;
  return n;
}

function other(side: PegSide): PegSide {
  return side === "a" ? "b" : "a";
}

// A candidate (from, to) is geometrically legal on its own terms —
// doesn't yet check whose turn it is or continuity, callers combine this
// with that context.
function isGeometricallyLegal(state: PegGameState, from: number, to: number): boolean {
  if (from === to) return false;
  if (state.locked.has(from) || state.locked.has(to)) return false;
  if (BANNED_PAIRS.has(KEY(from, to))) return false;
  if (edgeExists(state, from, to)) return false;
  if (crossesAnything(state, from, to)) return false;
  return true;
}

export function createPegGame(): PegGameState {
  const state: PegGameState = {
    lines: [],
    pathEnd: { a: null, b: null },
    lastRealLine: { a: null, b: null },
    locked: new Set(),
    knotCount: { a: 0, b: 0 },
    turn: "a",
    pendingReach: null,
    status: "playing",
    log: [],
  };
  // Side "a"'s opening isn't a real choice — applied directly, not routed
  // through applyMove (which is for genuine decisions only).
  state.lines.push({ a: LOCKED_OPENING.from, b: LOCKED_OPENING.to, side: "a" });
  state.pathEnd.a = LOCKED_OPENING.to;
  state.lastRealLine.a = { a: LOCKED_OPENING.from, b: LOCKED_OPENING.to };
  state.turn = "b";
  state.log.push(`a opens: ${LOCKED_OPENING.from}-${LOCKED_OPENING.to} (locked)`);
  return state;
}

// The only legal moves for whoever's turn it is right now. Empty means
// the mover is stuck — see resolveEndConditions, called from applyMove.
export function legalMovesForTurn(state: PegGameState): PegMove[] {
  if (state.status !== "playing") return [];
  const side = state.turn;

  // Shield window: a Reach is pending against this side. The only legal
  // response is the one line that closes the triangle — exempt from the
  // normal "must continue from your own last dot" rule, since otherwise
  // a defender could rarely ever answer a Reach at all. Both directions
  // offered; either draws the same closing line.
  if (state.pendingReach && state.pendingReach.side !== side) {
    const { a, c } = state.pendingReach;
    if (isGeometricallyLegal(state, a, c)) return [{ from: a, to: c }, { from: c, to: a }];
    return [];
  }

  const end = state.pathEnd[side];
  if (end !== null) {
    const moves: PegMove[] = [];
    for (let to = 0; to < 9; to++) {
      if (isGeometricallyLegal(state, end, to)) moves.push({ from: end, to });
    }
    return moves;
  }

  // Side "b"'s free opening — no continuation constraint yet, any legal
  // directed pair of dots.
  const moves: PegMove[] = [];
  for (let from = 0; from < 9; from++) {
    for (let to = 0; to < 9; to++) {
      if (from === to) continue;
      if (isGeometricallyLegal(state, from, to)) moves.push({ from, to });
    }
  }
  return moves;
}

function applyKnotChecks(state: PegGameState, dotIds: number[], side: PegSide) {
  for (const dot of dotIds) {
    if (state.locked.has(dot)) continue;
    if (sideLineCount(state, dot, side) >= 3) {
      state.locked.add(dot);
      state.knotCount[side]++;
      state.log.push(`Knot at ${dot} (${side})`);
    }
  }
}

// Ends the game via the knot tiebreak — used both when the side to move
// is simply stuck (no legal move, no Reach pending) and, distinctly, in
// resolveEndConditions when a Reach stands because the defender had no
// legal Shield.
function settleByKnots(state: PegGameState) {
  if (state.knotCount.a > state.knotCount.b) state.status = { winner: "a" };
  else if (state.knotCount.b > state.knotCount.a) state.status = { winner: "b" };
  else state.status = { winner: "draw" };
  state.log.push(`Board jammed — knots a:${state.knotCount.a} b:${state.knotCount.b} — ${JSON.stringify(state.status)}`);
}

function resolveEndConditions(state: PegGameState) {
  if (state.status !== "playing") return;
  const moves = legalMovesForTurn(state);
  if (moves.length > 0) return;

  if (state.pendingReach && state.pendingReach.side !== state.turn) {
    // The side to move is the defender and has no legal Shield: the Reach stands.
    state.status = { winner: state.pendingReach.side };
    state.log.push(`No legal Shield for ${state.turn} — Reach stands, ${state.pendingReach.side} wins`);
    return;
  }
  settleByKnots(state);
}

// Applies one real decision (never the locked opening — see createPegGame
// — and never called by the engine itself, only by whatever is driving
// the game: the interactive UI for a human turn, or the AI for the NPC's).
export function applyMove(state: PegGameState, move: PegMove): PegGameState {
  const legal = legalMovesForTurn(state);
  const found = legal.some((m) => m.from === move.from && m.to === move.to);
  if (!found) throw new Error(`Illegal peg board move: ${move.from}-${move.to}`);

  const side = state.turn;
  const isShield = state.pendingReach !== null && state.pendingReach.side !== side;

  state.lines.push({ a: move.from, b: move.to, side, exempt: isShield || undefined });

  if (isShield) {
    state.pendingReach = null;
    state.log.push(`${side} Shields: ${move.from}-${move.to}`);
  } else {
    state.pathEnd[side] = move.to;

    const prev = state.lastRealLine[side];
    if (prev) {
      // prev.b === move.from is guaranteed by continuity (or by this being
      // side b's very first move, in which case prev is null and this
      // whole branch is skipped — no Reach is possible off a single line).
      const bend = !isCollinear(prev.a, prev.b, move.to);
      const closingDrawn = edgeExists(state, prev.a, move.to);
      if (bend && !closingDrawn) {
        state.pendingReach = { side, a: prev.a, b: prev.b, c: move.to };
        state.log.push(`${side} forms a Reach: ${prev.a}-${prev.b}-${move.to}`);
      }
    }
    state.lastRealLine[side] = { a: move.from, b: move.to };
  }

  applyKnotChecks(state, [move.from, move.to], side);

  state.turn = other(side);
  resolveEndConditions(state);
  return state;
}

function cloneState(state: PegGameState): PegGameState {
  return {
    lines: state.lines.map((l) => ({ ...l })),
    pathEnd: { ...state.pathEnd },
    lastRealLine: { a: state.lastRealLine.a ? { ...state.lastRealLine.a } : null, b: state.lastRealLine.b ? { ...state.lastRealLine.b } : null },
    locked: new Set(state.locked),
    knotCount: { ...state.knotCount },
    turn: state.turn,
    pendingReach: state.pendingReach ? { ...state.pendingReach } : null,
    status: state.status === "playing" ? "playing" : { ...state.status },
    log: [], // simulation-only clones don't need to carry log forward
  };
}

// Simple, greedy AI — not a lookahead solver, just enough to make the NPC
// opponent play like it's actually trying: take a winning Reach if one's
// on offer, otherwise prefer building a Knot, otherwise prefer a move
// that doesn't hand the human an immediate Reach next turn, otherwise
// whatever's left. Good enough for a Rec Room minigame, not meant to be
// unbeatable.
export function pickAiMove(state: PegGameState, aiSide: PegSide): PegMove | null {
  const moves = legalMovesForTurn(state);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  // Shield window — no real choice, just take it.
  if (state.pendingReach && state.pendingReach.side !== state.turn) return moves[0];

  const scored = moves.map((m) => {
    const after = applyMove(cloneState(state), m);
    let score = 0;
    if (after.pendingReach && after.pendingReach.side === aiSide) score += 100;
    if (after.knotCount[aiSide] > state.knotCount[aiSide]) score += 20;
    // Light defensive check: does this leave the opponent an immediate,
    // unanswerable Reach on their very next move? Only checked one move
    // deep — see file header, this AI is deliberately not a full solver.
    if (after.status === "playing" && after.turn !== aiSide) {
      const opponentReplies = legalMovesForTurn(after);
      for (const reply of opponentReplies) {
        const afterReply = applyMove(cloneState(after), reply);
        if (afterReply.pendingReach && afterReply.pendingReach.side !== aiSide) {
          const shieldMoves = legalMovesForTurn(afterReply);
          if (shieldMoves.length === 0) {
            score -= 50; // walks into a Reach we can't Shield
            break;
          }
        }
      }
    }
    score += Math.random() * 2; // tie-break jitter so the AI isn't perfectly deterministic
    return { m, score };
  });

  scored.sort((x, y) => y.score - x.score);
  return scored[0].m;
}
