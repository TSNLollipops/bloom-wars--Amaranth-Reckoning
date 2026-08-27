// src/engine/cardTable/__tests__/handEval.test.ts
// First coverage for the generic hand evaluator, 26 Aug 2026 — see
// deck.ts's own header for why this lives in cardTable/ rather than
// holdem.ts. Standard poker hand ranking, not a house rule, so these cases
// are checked against real poker hand ranking, not invented behavior.
import { describe, it, expect } from "vitest";
import type { Card, Suit } from "../deck";
import { evaluateBestHand, compareHandResults, describeHand } from "../handEval";

function c(rank: Card["rank"], suit: Suit): Card {
  return { rank, suit };
}

describe("evaluateBestHand — category detection on exactly 5 cards", () => {
  it("recognizes a royal flush and labels it distinctly from an ordinary straight flush", () => {
    const hand = evaluateBestHand([c(14, "spades"), c(13, "spades"), c(12, "spades"), c(11, "spades"), c(10, "spades")]);
    expect(hand.category).toBe("straightFlush");
    expect(describeHand(hand)).toBe("Royal Flush");
  });

  it("recognizes an ordinary straight flush", () => {
    const hand = evaluateBestHand([c(9, "hearts"), c(8, "hearts"), c(7, "hearts"), c(6, "hearts"), c(5, "hearts")]);
    expect(hand.category).toBe("straightFlush");
    expect(describeHand(hand)).toBe("Straight Flush");
  });

  it("recognizes four of a kind, with the kicker as the second rank", () => {
    const hand = evaluateBestHand([c(7, "spades"), c(7, "hearts"), c(7, "diamonds"), c(7, "clubs"), c(2, "spades")]);
    expect(hand.category).toBe("quads");
    expect(hand.ranks).toEqual([7, 2]);
  });

  it("recognizes a full house, trips rank first then the pair", () => {
    const hand = evaluateBestHand([c(4, "spades"), c(4, "hearts"), c(4, "diamonds"), c(9, "clubs"), c(9, "spades")]);
    expect(hand.category).toBe("fullHouse");
    expect(hand.ranks).toEqual([4, 9]);
  });

  it("recognizes a flush over a non-flush straight-ish hand", () => {
    const hand = evaluateBestHand([c(2, "clubs"), c(5, "clubs"), c(9, "clubs"), c(11, "clubs"), c(13, "clubs")]);
    expect(hand.category).toBe("flush");
  });

  it("recognizes a straight, including the ace-low wheel (A-2-3-4-5) as 5-high", () => {
    const straight = evaluateBestHand([c(10, "spades"), c(9, "hearts"), c(8, "diamonds"), c(7, "clubs"), c(6, "spades")]);
    expect(straight.category).toBe("straight");
    expect(straight.ranks).toEqual([10]);

    const wheel = evaluateBestHand([c(14, "spades"), c(2, "hearts"), c(3, "diamonds"), c(4, "clubs"), c(5, "spades")]);
    expect(wheel.category).toBe("straight");
    expect(wheel.ranks).toEqual([5]); // NOT 14 — an ace playing low doesn't make this a 14-high straight
  });

  it("a 6-high straight beats the wheel, since the wheel is only 5-high", () => {
    const six = evaluateBestHand([c(6, "spades"), c(5, "hearts"), c(4, "diamonds"), c(3, "clubs"), c(2, "spades")]);
    const wheel = evaluateBestHand([c(14, "clubs"), c(2, "diamonds"), c(3, "hearts"), c(4, "spades"), c(5, "clubs")]);
    expect(compareHandResults(six, wheel)).toBeGreaterThan(0);
  });

  it("recognizes trips, two pair, one pair, and high card correctly", () => {
    expect(evaluateBestHand([c(8, "spades"), c(8, "hearts"), c(8, "diamonds"), c(3, "clubs"), c(11, "spades")]).category).toBe("trips");
    expect(evaluateBestHand([c(8, "spades"), c(8, "hearts"), c(3, "diamonds"), c(3, "clubs"), c(11, "spades")]).category).toBe("twoPair");
    expect(evaluateBestHand([c(8, "spades"), c(8, "hearts"), c(3, "diamonds"), c(9, "clubs"), c(11, "spades")]).category).toBe("pair");
    expect(evaluateBestHand([c(2, "spades"), c(5, "hearts"), c(9, "diamonds"), c(11, "clubs"), c(13, "spades")]).category).toBe("highCard");
  });
});

describe("compareHandResults — category always beats kickers, kickers break ties within a category", () => {
  it("a weaker category never beats a stronger one regardless of kicker size", () => {
    const highCardAceHigh = evaluateBestHand([c(14, "spades"), c(11, "hearts"), c(9, "diamonds"), c(6, "clubs"), c(3, "spades")]);
    const lowPair = evaluateBestHand([c(2, "spades"), c(2, "hearts"), c(9, "diamonds"), c(6, "clubs"), c(3, "spades")]);
    expect(compareHandResults(lowPair, highCardAceHigh)).toBeGreaterThan(0);
  });

  it("within the same category, the higher pair wins", () => {
    const kings = evaluateBestHand([c(13, "spades"), c(13, "hearts"), c(4, "diamonds"), c(6, "clubs"), c(9, "spades")]);
    const twos = evaluateBestHand([c(2, "spades"), c(2, "hearts"), c(4, "diamonds"), c(6, "clubs"), c(9, "spades")]);
    expect(compareHandResults(kings, twos)).toBeGreaterThan(0);
  });

  it("an identical pair falls through to the kicker", () => {
    const betterKicker = evaluateBestHand([c(9, "spades"), c(9, "hearts"), c(13, "diamonds"), c(6, "clubs"), c(3, "spades")]);
    const worseKicker = evaluateBestHand([c(9, "clubs"), c(9, "diamonds"), c(11, "hearts"), c(6, "spades"), c(3, "hearts")]);
    expect(compareHandResults(betterKicker, worseKicker)).toBeGreaterThan(0);
  });

  it("a genuine tie (identical category and ranks) compares equal", () => {
    const a = evaluateBestHand([c(9, "spades"), c(9, "hearts"), c(13, "diamonds"), c(6, "clubs"), c(3, "spades")]);
    const b = evaluateBestHand([c(9, "clubs"), c(9, "diamonds"), c(13, "hearts"), c(6, "spades"), c(3, "hearts")]);
    expect(compareHandResults(a, b)).toBe(0);
  });
});

describe("evaluateBestHand — 7-card selection (2 hole + 5 community, Hold'em's real shape)", () => {
  it("picks the best 5 out of 7 rather than just the first five dealt", () => {
    // Hole: 7♠ 7♥ (a pair). Community: A♦ A♣ K♠ K♥ 2♠ — the actual best
    // hand ignores the pocket pair entirely in favor of the board's two pair
    // (aces and kings), which itself loses to nothing better available —
    // correct answer here is aces-and-kings two pair with the 7 kicker.
    const sevenCards = [c(7, "spades"), c(7, "hearts"), c(14, "diamonds"), c(14, "clubs"), c(13, "spades"), c(13, "hearts"), c(2, "spades")];
    const hand = evaluateBestHand(sevenCards);
    expect(hand.category).toBe("twoPair");
    expect(hand.ranks).toEqual([14, 13, 7]);
  });

  it("finds a flush that uses cards from both hole and community", () => {
    const sevenCards = [c(2, "clubs"), c(9, "clubs"), c(4, "hearts"), c(11, "clubs"), c(13, "clubs"), c(6, "diamonds"), c(7, "clubs")];
    const hand = evaluateBestHand(sevenCards);
    expect(hand.category).toBe("flush");
  });

  it("throws on fewer than 5 cards — a real caller error, not a silent wrong answer", () => {
    expect(() => evaluateBestHand([c(2, "spades"), c(3, "spades")])).toThrow();
  });
});
