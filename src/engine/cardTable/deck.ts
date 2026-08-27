// src/engine/cardTable/deck.ts
// Generic card-table substrate, piece 1 of 3 (deck.ts / handEval.ts /
// bettingEngine.ts), 26 Aug 2026. Built as a shared foundation rather than
// folded straight into holdem.ts, per Maxime's explicit call ("generic
// card-table shape now") once he confirmed he wants to grow the Rec Room's
// card game list past just Hold'em over time. A standard 52-card deck and a
// comparable poker-hand ranking aren't Hold'em-specific — any future
// draw/stud/community-card poker variant needs the same two things. The
// betting-round engine (bettingEngine.ts) is generic for the same reason:
// stacks/pot/turn-order/fold-check-call-raise doesn't care what game is
// being bet on. What's NOT generalized here: anything Hold'em-specific
// (blinds, streets, hole/community card split, the AI) — that's
// src/engine/holdem.ts's own job, built on these three files rather than
// folding its rules in here. Same "don't build past what's actually
// needed" discipline as everywhere else in this project — this is the
// substrate Hold'em needs today, not a speculative do-everything toolkit.

export type Suit = "spades" | "hearts" | "diamonds" | "clubs";
// 2-10 as themselves; Ace is stored high (14) since that's correct for the
// vast majority of hand comparisons. The one case where an Ace also plays
// low — the "wheel" straight, A-2-3-4-5 — is handled as a special case in
// handEval.ts's own straight detection, not by ever giving one card two
// different rank values.
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  rank: Rank;
  suit: Suit;
}

const SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"];
const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

// Fisher-Yates, Math.random() — same non-determinism discipline pegBoard.ts's
// AI jitter already uses in this project. Nothing about a card game needs
// replay-determinism, and a seeded shuffle would be one more thing to get
// subtly wrong for no real benefit here.
export function shuffle(deck: Card[]): Card[] {
  const result = deck.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const RANK_LABEL: Record<Rank, string> = {
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "J",
  12: "Q",
  13: "K",
  14: "A",
};
const SUIT_LABEL: Record<Suit, string> = { spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣" };
const SUIT_IS_RED: Record<Suit, boolean> = { spades: false, clubs: false, hearts: true, diamonds: true };

export function cardLabel(card: Card): string {
  return `${RANK_LABEL[card.rank]}${SUIT_LABEL[card.suit]}`;
}

export function cardIsRed(card: Card): boolean {
  return SUIT_IS_RED[card.suit];
}
