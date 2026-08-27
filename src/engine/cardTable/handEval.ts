// src/engine/cardTable/handEval.ts
// Generic card-table substrate, piece 2 of 3 — see deck.ts's own header for
// why this lives here rather than inside holdem.ts. Standard poker hand
// ranking, reusable by any future community-card or draw poker variant:
// given 5-7 cards, finds the best possible 5-card hand and a value other
// hands can be compared against. Nothing here is Bloom Wars house rules —
// this is textbook poker hand ranking, not an invented system.
import type { Card } from "./deck";

export type HandCategory = "highCard" | "pair" | "twoPair" | "trips" | "straight" | "flush" | "fullHouse" | "quads" | "straightFlush";

// Index doubles as this category's comparison strength (0 = weakest) — used
// both by compareHandResults and by holdem.ts's AI hand-strength estimate.
const CATEGORY_ORDER: HandCategory[] = ["highCard", "pair", "twoPair", "trips", "straight", "flush", "fullHouse", "quads", "straightFlush"];

export function categoryStrengthIndex(category: HandCategory): number {
  return CATEGORY_ORDER.indexOf(category);
}

export interface HandResult {
  category: HandCategory;
  // Descending-priority tiebreak values — e.g. a pair of kings with a
  // queen/9/4 kicker is [13, 12, 9, 4]. Compared left-to-right after
  // category; the first difference decides it, same as real poker.
  ranks: number[];
  cards: Card[]; // the specific 5 cards that make this hand, for display
}

function sortDesc(values: number[]): number[] {
  return values.slice().sort((a, b) => b - a);
}

// Evaluates exactly 5 cards. The ace-low straight ("the wheel," A-2-3-4-5)
// is the one place a straight's rank isn't simply its highest card — it
// scores as 5-high, below every other straight, exactly like real poker
// (an Ace playing low here doesn't retroactively make it a 14-high anything).
function evaluate5(cards: Card[]): HandResult {
  const ranks = sortDesc(cards.map((c) => c.rank));
  const isFlush = cards.every((c) => c.suit === cards[0].suit);

  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  // Sorted by count desc, then rank desc — so groups[0] is always "the
  // biggest, then highest-ranked group" (e.g. trips before a higher pair).
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  const uniqueDesc = [...new Set(ranks)];
  let straightHigh: number | null = null;
  if (uniqueDesc.length === 5) {
    if (uniqueDesc[0] - uniqueDesc[4] === 4) straightHigh = uniqueDesc[0];
    else if (uniqueDesc.join(",") === "14,5,4,3,2") straightHigh = 5; // the wheel
  }

  if (straightHigh !== null && isFlush) return { category: "straightFlush", ranks: [straightHigh], cards };
  if (groups[0][1] === 4) return { category: "quads", ranks: [groups[0][0], groups[1][0]], cards };
  if (groups[0][1] === 3 && groups[1][1] === 2) return { category: "fullHouse", ranks: [groups[0][0], groups[1][0]], cards };
  if (isFlush) return { category: "flush", ranks, cards };
  if (straightHigh !== null) return { category: "straight", ranks: [straightHigh], cards };
  if (groups[0][1] === 3) return { category: "trips", ranks: [groups[0][0], ...groups.slice(1).map((g) => g[0])], cards };
  if (groups[0][1] === 2 && groups[1][1] === 2) {
    const pairs = [groups[0][0], groups[1][0]].sort((a, b) => b - a);
    return { category: "twoPair", ranks: [...pairs, groups[2][0]], cards };
  }
  if (groups[0][1] === 2) return { category: "pair", ranks: [groups[0][0], ...groups.slice(1).map((g) => g[0])], cards };
  return { category: "highCard", ranks, cards };
}

// Positive: a beats b. Negative: b beats a. Zero: a genuine tie (same
// category, identical tiebreak ranks all the way down).
export function compareHandResults(a: HandResult, b: HandResult): number {
  const catDiff = categoryStrengthIndex(a.category) - categoryStrengthIndex(b.category);
  if (catDiff !== 0) return catDiff;
  const len = Math.max(a.ranks.length, b.ranks.length);
  for (let i = 0; i < len; i++) {
    const diff = (a.ranks[i] ?? 0) - (b.ranks[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// k=5 combinations out of up to 7 cards (holdem: 2 hole + 5 community) —
// C(7,5) = 21, cheap enough to brute-force rather than hand-roll a smarter
// direct 7-card evaluator. C(5,5) = 1 for the exactly-5 case (5-card draw,
// if that ever gets built).
function combinations5(cards: Card[]): Card[][] {
  const n = cards.length;
  const result: Card[][] = [];
  const combo: Card[] = [];
  function pick(start: number) {
    if (combo.length === 5) {
      result.push(combo.slice());
      return;
    }
    for (let i = start; i < n; i++) {
      combo.push(cards[i]);
      pick(i + 1);
      combo.pop();
    }
  }
  pick(0);
  return result;
}

export function evaluateBestHand(cards: Card[]): HandResult {
  if (cards.length < 5) throw new Error(`evaluateBestHand needs at least 5 cards, got ${cards.length}`);
  if (cards.length === 5) return evaluate5(cards);
  let best: HandResult | null = null;
  for (const combo of combinations5(cards)) {
    const result = evaluate5(combo);
    if (!best || compareHandResults(result, best) > 0) best = result;
  }
  return best!;
}

const HAND_CATEGORY_LABEL: Record<HandCategory, string> = {
  highCard: "High Card",
  pair: "Pair",
  twoPair: "Two Pair",
  trips: "Three of a Kind",
  straight: "Straight",
  flush: "Flush",
  fullHouse: "Full House",
  quads: "Four of a Kind",
  straightFlush: "Straight Flush",
};

// A Royal Flush is just the best possible Straight Flush (ace-high) — real
// poker doesn't rank it as a separate category, so this is display-only
// flavor on top of the same comparison logic, not a distinct HandCategory.
export function describeHand(result: HandResult): string {
  if (result.category === "straightFlush" && result.ranks[0] === 14) return "Royal Flush";
  return HAND_CATEGORY_LABEL[result.category];
}
