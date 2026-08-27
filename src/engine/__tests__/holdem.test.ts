// src/engine/__tests__/holdem.test.ts
// First coverage for the Hold'em engine, 26 Aug 2026 — see holdem.ts's own
// header for scope. Real deals use shuffle()'s Math.random() (deck.ts's own
// "no seeded RNG" call), so hand/showdown-outcome tests hand-construct the
// exact state they need rather than mock global randomness — same
// "hand-construct the exact state a test needs" approach pegBoard.test.ts
// already uses for its Knot/jam cases.
import { describe, it, expect } from "vitest";
import type { Card, Suit } from "../cardTable/deck";
import { createHoldemGame, applyHoldemAction, startNextHand, legalActionsFor, potTotal, pickAiAction, STARTING_STACK, SMALL_BLIND, BIG_BLIND, type HoldemGameState } from "../holdem";

function c(rank: Card["rank"], suit: Suit): Card {
  return { rank, suit };
}

// deck.pop() takes from the array's end, and community draws pop 3 (flop)
// then 1 (turn) then 1 (river) — reversing the desired 5 cards before
// stashing them as the whole remaining deck means they come out in the
// order given here, though evaluateBestHand doesn't care about street
// origin, only the final 5-card set, so the order itself is arbitrary.
function forceHoleAndCommunity(state: HoldemGameState, humanHole: Card[], aiHole: Card[], community: Card[]) {
  state.players[0] = { ...state.players[0], holeCards: humanHole };
  state.players[1] = { ...state.players[1], holeCards: aiHole };
  state.deck = community.slice().reverse();
}

function playToShowdownWithChecksAndCalls(state: HoldemGameState) {
  let guard = 0;
  while (state.status === "playing") {
    guard++;
    if (guard > 50) throw new Error("hand never resolved — infinite loop in test");
    const seatIndex = state.betting.actingIndex as 0 | 1;
    const legal = legalActionsFor(state, seatIndex);
    applyHoldemAction(state, seatIndex, legal.check ? { type: "check" } : { type: "call" });
  }
}

describe("createHoldemGame", () => {
  it("deals 2 hole cards to each player and posts blinds correctly for whichever seat is the dealer", () => {
    const state = createHoldemGame();
    expect(state.players[0].holeCards).toHaveLength(2);
    expect(state.players[1].holeCards).toHaveLength(2);
    const sb = state.dealerIndex;
    const bb = (1 - state.dealerIndex) as 0 | 1;
    expect(state.betting.seats[sb].betThisRound).toBe(SMALL_BLIND);
    expect(state.betting.seats[bb].betThisRound).toBe(BIG_BLIND);
    expect(state.players[0].stack + state.betting.seats[0].betThisRound).toBe(STARTING_STACK);
    expect(state.players[1].stack + state.betting.seats[1].betThisRound).toBe(STARTING_STACK);
    expect(state.street).toBe("preflop");
    expect(state.status).toBe("playing");
  });

  it("deals no duplicate cards between the two hole-card hands", () => {
    const state = createHoldemGame();
    const all = [...state.players[0].holeCards, ...state.players[1].holeCards];
    const keys = all.map((card) => `${card.rank}${card.suit}`);
    expect(new Set(keys).size).toBe(4);
  });
});

describe("applyHoldemAction — folding ends the hand immediately without a showdown", () => {
  it("awards the full pot to whoever didn't fold, and never reveals either hand", () => {
    const state = createHoldemGame();
    const folder = state.betting.actingIndex as 0 | 1;
    const winner = (1 - folder) as 0 | 1;
    const stackBefore = state.players[winner].stack;
    const potBefore = potTotal(state);

    applyHoldemAction(state, folder, { type: "fold" });

    expect(state.status).toBe("handOver");
    expect(state.lastResult?.wonByFold).toBe(true);
    expect(state.lastResult?.humanHand).toBeNull();
    expect(state.lastResult?.aiHand).toBeNull();
    expect(state.players[winner].stack).toBe(stackBefore + potBefore);
  });
});

describe("applyHoldemAction — a full hand of checks/calls reaches showdown with the correct winner", () => {
  it("a made flush beats a made set at showdown", () => {
    const state = createHoldemGame();
    forceHoleAndCommunity(
      state,
      [c(2, "clubs"), c(7, "clubs")], // human makes a flush off the board's three clubs
      [c(9, "hearts"), c(9, "diamonds")], // ai pairs the board's 9 for trips — real hand, still loses
      [c(3, "clubs"), c(9, "clubs"), c(11, "clubs"), c(4, "spades"), c(6, "hearts")]
    );

    playToShowdownWithChecksAndCalls(state);

    expect(state.status).toBe("handOver");
    expect(state.lastResult?.wonByFold).toBe(false);
    expect(state.lastResult?.winner).toBe("human");
    expect(state.lastResult?.humanHand?.category).toBe("flush");
    expect(state.lastResult?.aiHand?.category).toBe("trips");
    expect(state.community).toHaveLength(5);
  });

  it("an identical best hand for both seats (the board itself is the nuts) is a genuine split pot", () => {
    const state = createHoldemGame();
    forceHoleAndCommunity(
      state,
      [c(2, "spades"), c(3, "hearts")], // irrelevant — the board's own straight is best for both
      [c(4, "diamonds"), c(5, "clubs")],
      [c(10, "spades"), c(11, "hearts"), c(12, "diamonds"), c(13, "clubs"), c(14, "spades")]
    );

    playToShowdownWithChecksAndCalls(state);

    expect(state.lastResult?.winner).toBe("split");
    const totalAwarded = state.players[0].stack + state.players[1].stack;
    expect(totalAwarded).toBe(STARTING_STACK * 2); // no chips created or destroyed
    expect(Math.abs(state.players[0].stack - state.players[1].stack)).toBeLessThanOrEqual(1);
  });
});

describe("startNextHand", () => {
  it("alternates the dealer and deals a fresh hand", () => {
    const state = createHoldemGame();
    const folder = state.betting.actingIndex as 0 | 1;
    applyHoldemAction(state, folder, { type: "fold" });
    const dealerBefore = state.dealerIndex;
    const handBefore = state.handNumber;

    startNextHand(state);

    expect(state.dealerIndex).toBe((1 - dealerBefore) as 0 | 1);
    expect(state.handNumber).toBe(handBefore + 1);
    expect(state.status).toBe("playing");
    expect(state.players[0].holeCards).toHaveLength(2);
    expect(state.players[1].holeCards).toHaveLength(2);
  });

  it("throws if called before the current hand is over", () => {
    const state = createHoldemGame();
    expect(() => startNextHand(state)).toThrow();
  });

  it("throws once a player has busted — the session is over, not just the hand", () => {
    const state = createHoldemGame();
    state.players[1] = { ...state.players[1], stack: 0 };
    state.bustedPlayer = "ai";
    state.status = "handOver";
    expect(() => startNextHand(state)).toThrow();
  });
});

describe("pickAiAction", () => {
  it("never returns an action outside what legalActionsFor actually offers, across many random deals", () => {
    let checked = 0;
    for (let i = 0; i < 40 && checked < 15; i++) {
      const state = createHoldemGame();
      if (state.betting.actingIndex !== 1) continue; // only exercising the AI seat's own decision
      checked++;
      const action = pickAiAction(state);
      const legal = legalActionsFor(state, 1);
      if (action.type === "fold") expect(legal.fold).toBe(true);
      if (action.type === "check") expect(legal.check).toBe(true);
      if (action.type === "call") expect(legal.call).not.toBeNull();
      if (action.type === "raise") {
        expect(legal.raise).not.toBeNull();
        expect(action.to).toBeGreaterThanOrEqual(legal.raise!.minTo);
        expect(action.to).toBeLessThanOrEqual(legal.raise!.maxTo);
      }
      expect(() => applyHoldemAction(state, 1, action)).not.toThrow();
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("folds a genuinely weak preflop hand facing a big bet far more often than a genuinely strong one", () => {
    const weakHole: [Card, Card] = [c(2, "clubs"), c(7, "diamonds")];
    const strongHole: [Card, Card] = [c(14, "spades"), c(14, "hearts")];
    let weakFolds = 0;
    let strongFolds = 0;
    const trials = 40;
    for (let i = 0; i < trials; i++) {
      const weakState = createHoldemGame();
      weakState.players[1] = { ...weakState.players[1], holeCards: weakHole };
      weakState.betting.seats[1].betThisRound = 0;
      weakState.betting.currentBet = 100;
      weakState.betting.actingIndex = 1;
      weakState.betting.toAct = [1];
      if (pickAiAction(weakState).type === "fold") weakFolds++;

      const strongState = createHoldemGame();
      strongState.players[1] = { ...strongState.players[1], holeCards: strongHole };
      strongState.betting.seats[1].betThisRound = 0;
      strongState.betting.currentBet = 100;
      strongState.betting.actingIndex = 1;
      strongState.betting.toAct = [1];
      if (pickAiAction(strongState).type === "fold") strongFolds++;
    }
    expect(weakFolds).toBeGreaterThan(strongFolds);
  });
});
