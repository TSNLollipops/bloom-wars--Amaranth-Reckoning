// src/engine/__tests__/pegBoard.test.ts
// Peg board engine tests — see src/engine/pegBoard.ts's own header for the
// naming-lock/scope discipline this module follows. Pure logic only, no
// Phaser — these tests never touch Hub.ts.
import { describe, it, expect } from "vitest";
import { createPegGame, legalMovesForTurn, applyMove, pickAiMove, type PegGameState } from "../pegBoard";

describe("createPegGame", () => {
  it("applies side a's locked opening automatically and hands the turn to b", () => {
    const state = createPegGame();
    expect(state.lines).toEqual([{ a: 0, b: 1, side: "a" }]);
    expect(state.pathEnd.a).toBe(1);
    expect(state.pathEnd.b).toBeNull();
    expect(state.turn).toBe("b");
    expect(state.status).toBe("playing");
  });
});

describe("legalMovesForTurn — geometry", () => {
  it("excludes the 8 pairs whose line passes through a third dot", () => {
    const state = createPegGame();
    const moves = legalMovesForTurn(state);
    const has = (from: number, to: number) => moves.some((m) => m.from === from && m.to === to);
    // 0-2 passes through 1 (a row); 0-8 and 2-6 pass through the center.
    expect(has(0, 2)).toBe(false);
    expect(has(2, 0)).toBe(false);
    expect(has(0, 8)).toBe(false);
    expect(has(2, 6)).toBe(false);
  });

  it("never re-offers an already-drawn edge, in either direction", () => {
    const state = createPegGame(); // 0-1 already drawn by the locked opening
    const moves = legalMovesForTurn(state);
    expect(moves.some((m) => (m.from === 0 && m.to === 1) || (m.from === 1 && m.to === 0))).toBe(false);
  });

  it("side b's opening is a free choice of any legal pair, not fixed to one dot", () => {
    const state = createPegGame();
    const moves = legalMovesForTurn(state);
    // A legal pair not touching dot 1 at all should be offered — proves
    // b isn't constrained to continue from a's dot.
    expect(moves.some((m) => m.from === 6 && m.to === 7)).toBe(true);
  });

  it("once a side has moved once, every later move must continue from their own last dot", () => {
    let state = createPegGame();
    state = applyMove(state, { from: 6, to: 7 }); // b's free opening
    const moves = legalMovesForTurn(state); // a's turn now
    expect(moves.every((m) => m.from === 1)).toBe(true);
    expect(moves.length).toBeGreaterThan(0);
  });
});

describe("applyMove — rejects illegal moves", () => {
  it("throws on a move not in legalMovesForTurn", () => {
    const state = createPegGame();
    expect(() => applyMove(state, { from: 0, to: 2 })).toThrow(/Illegal peg board move/);
  });
});

describe("Reach and Shield", () => {
  it("two collinear moves (a straight run across 3 dots) do NOT form a Reach", () => {
    let state = createPegGame(); // a: 0-1
    state = applyMove(state, { from: 6, to: 7 }); // b opens, irrelevant to this check
    state = applyMove(state, { from: 1, to: 2 }); // a continues straight: 0-1-2, no corner
    expect(state.pendingReach).toBeNull();
  });

  it("a genuine bend forms a Reach, and the opponent's only legal move becomes the Shield line", () => {
    let state = createPegGame(); // a: 0-1
    state = applyMove(state, { from: 6, to: 7 }); // b opens 6-7 — well clear of the diagonal a is about to threaten
    state = applyMove(state, { from: 1, to: 4 }); // a bends: 0-1-4
    expect(state.pendingReach).toEqual({ side: "a", a: 0, b: 1, c: 4 });
    expect(state.turn).toBe("b");
    const shieldMoves = legalMovesForTurn(state);
    expect(shieldMoves.length).toBeGreaterThan(0);
    expect(shieldMoves.every((m) => (m.from === 0 && m.to === 4) || (m.from === 4 && m.to === 0))).toBe(true);
  });

  it("a legal Shield clears the Reach and does not move the defender's own path end", () => {
    let state = createPegGame();
    state = applyMove(state, { from: 6, to: 7 }); // b's pathEnd -> 7, clear of the coming diagonal
    state = applyMove(state, { from: 1, to: 4 }); // a's Reach: 0-1-4
    expect(state.pendingReach).not.toBeNull();
    state = applyMove(state, { from: 0, to: 4 }); // b Shields
    expect(state.pendingReach).toBeNull();
    expect(state.pathEnd.b).toBe(7); // unmoved — the Shield is exempt from continuity
    expect(state.status).toBe("playing");
    expect(state.turn).toBe("a");
  });

  it("a Reach the defender cannot legally Shield stands — the Reach's owner wins immediately", () => {
    let state = createPegGame(); // a: 0-1
    state = applyMove(state, { from: 1, to: 3 }); // b opens 1-3 — this happens to sit exactly on the diagonal a's Shield would need
    state = applyMove(state, { from: 1, to: 4 }); // a bends 0-1-4; Shield would be 0-4, which now crosses 1-3
    expect(state.status).toEqual({ winner: "a" });
  });
});

describe("Knot formation", () => {
  it("a dot's third same-side line locks it and credits that side's Knot count", () => {
    const state: PegGameState = {
      lines: [
        { a: 0, b: 1, side: "a" },
        { a: 1, b: 4, side: "a" },
        { a: 4, b: 2, side: "a" },
      ],
      pathEnd: { a: 2, b: null },
      lastRealLine: { a: { a: 4, b: 2 }, b: null },
      locked: new Set(),
      knotCount: { a: 0, b: 0 },
      turn: "a",
      pendingReach: null,
      status: "playing",
      log: [],
    };
    const after = applyMove(state, { from: 2, to: 1 }); // dot 1's third `a` line
    expect(after.locked.has(1)).toBe(true);
    expect(after.knotCount.a).toBe(1);
    // The triangle 4-2-1 was already closed by the pre-existing 1-4 edge,
    // so this move is a Knot, not also a fresh Reach.
    expect(after.pendingReach).toBeNull();
  });
});

describe("Board jam — most-Knots tiebreak", () => {
  function jammedSetup(knotCount: { a: number; b: number }): PegGameState {
    return {
      lines: [{ a: 0, b: 1, side: "a" }],
      pathEnd: { a: 1, b: 4 },
      lastRealLine: { a: { a: 0, b: 1 }, b: null },
      locked: new Set([0, 2, 3, 5, 6, 7, 8]), // only dots 1 and 4 still open
      knotCount,
      turn: "b",
      pendingReach: null,
      status: "playing",
      log: [],
    };
  }

  it("the side with more Knots wins once nobody has a legal move left", () => {
    const state = jammedSetup({ a: 2, b: 5 });
    const after = applyMove(state, { from: 4, to: 1 }); // b's last possible move — fills the board
    expect(after.status).toEqual({ winner: "b" });
  });

  it("equal Knots is a draw", () => {
    const state = jammedSetup({ a: 3, b: 3 });
    const after = applyMove(state, { from: 4, to: 1 });
    expect(after.status).toEqual({ winner: "draw" });
  });
});

describe("pickAiMove", () => {
  it("prefers a move that forms its own Reach when one's available", () => {
    const state: PegGameState = {
      lines: [
        { a: 0, b: 1, side: "a" },
        { a: 6, b: 7, side: "b" },
      ],
      pathEnd: { a: 1, b: 7 },
      lastRealLine: { a: { a: 0, b: 1 }, b: { a: 6, b: 7 } },
      locked: new Set(),
      knotCount: { a: 0, b: 0 },
      turn: "b",
      pendingReach: null,
      status: "playing",
      log: [],
    };
    const chosen = pickAiMove(state, "b");
    expect(chosen).not.toBeNull();
    const clone: PegGameState = JSON.parse(JSON.stringify(state));
    clone.locked = new Set(state.locked);
    const after = applyMove(clone, chosen!);
    expect(after.pendingReach?.side).toBe("b");
  });

  it("never returns an illegal move", () => {
    const state = createPegGame();
    const move = pickAiMove(state, "b");
    expect(move).not.toBeNull();
    expect(() => applyMove(state, move!)).not.toThrow();
  });
});
