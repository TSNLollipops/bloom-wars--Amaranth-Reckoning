// src/engine/holdem.ts
// Rec Room minigame — Texas Hold'em, 26 Aug 2026. Maxime confirmed the
// Poker slot (§11's own "still not built" line) is specifically Hold'em,
// wants it built on the generic card-table shape (cardTable/deck.ts,
// handEval.ts, bettingEngine.ts) so more card games are cheaper to add
// later, and wants a real AI opponent — not a simulated-outcome result.
// This file is Hold'em's own rules on top of that generic substrate: blinds,
// hole/community cards, street order, and the AI's actual decision-making.
// Nothing generic lives here twice — deck shuffling, hand ranking, and
// fold/check/call/raise legality are the other three files' job.
//
// Scope, stated the same way every other piece of this project states it:
// heads-up only (MC vs. one NPC — the Rec Room seats 2-3 pilots, but only
// one opponent plays a hand at a time), a fixed cash-game-style stack and
// blinds (no escalating tournament structure — a rec-room sitting, not a
// tournament), and a session plays hands back-to-back until one side is
// felted. No bet-sizing slider: the human is offered a minimum legal raise
// and an all-in, not a continuous amount — same "keep the first pass
// simple, real content can extend it later" discipline as the peg board's
// own fixed rule set.
import { createDeck, shuffle, type Card } from "./cardTable/deck";
import { evaluateBestHand, compareHandResults, categoryStrengthIndex, type HandResult } from "./cardTable/handEval";
import { startBettingRound, applyBettingAction, legalActions, type BettingState, type BettingAction, type LegalActions, type TableSeat } from "./cardTable/bettingEngine";

export const STARTING_STACK = 500;
export const SMALL_BLIND = 10;
export const BIG_BLIND = 20;

export type Street = "preflop" | "flop" | "turn" | "river";
const STREET_ORDER: Street[] = ["preflop", "flop", "turn", "river"];

export type SeatId = "human" | "ai";

export interface HoldemPlayerState {
  id: SeatId;
  stack: number;
  holeCards: Card[]; // empty until startHand deals in
}

export interface HandOutcome {
  winner: "human" | "ai" | "split";
  wonByFold: boolean;
  potWon: number;
  humanHand: HandResult | null; // null when the hand ended by fold — nobody's cards get shown
  aiHand: HandResult | null;
}

export interface HoldemGameState {
  deck: Card[];
  community: Card[];
  players: [HoldemPlayerState, HoldemPlayerState]; // fixed seats: 0 = human, 1 = ai
  dealerIndex: 0 | 1; // heads-up: the dealer/button also posts the small blind and acts first preflop, last every street after
  betting: BettingState;
  street: Street;
  potCarried: number; // chips already swept in from completed streets this hand
  handNumber: number;
  status: "playing" | "handOver";
  lastResult: HandOutcome | null;
  bustedPlayer: SeatId | null; // set once a player hits 0 chips — the session-ending condition
}

function postForcedBet(seat: TableSeat, amount: number) {
  const posted = Math.min(amount, seat.stack);
  seat.stack -= posted;
  seat.betThisRound += posted;
  if (seat.stack === 0) seat.allIn = true;
}

function syncStacksFromBetting(state: HoldemGameState) {
  state.players[0] = { ...state.players[0], stack: state.betting.seats[0].stack };
  state.players[1] = { ...state.players[1], stack: state.betting.seats[1].stack };
}

function startHand(state: HoldemGameState) {
  state.deck = shuffle(createDeck());
  state.community = [];
  state.potCarried = 0;
  state.street = "preflop";
  state.status = "playing";
  state.lastResult = null;

  state.players[0] = { ...state.players[0], holeCards: [state.deck.pop()!, state.deck.pop()!] };
  state.players[1] = { ...state.players[1], holeCards: [state.deck.pop()!, state.deck.pop()!] };

  const sbIndex = state.dealerIndex; // heads-up: the button IS the small blind
  const bbIndex = (1 - state.dealerIndex) as 0 | 1;

  const seats: TableSeat[] = [
    { id: "human", stack: state.players[0].stack, betThisRound: 0, folded: false, allIn: false },
    { id: "ai", stack: state.players[1].stack, betThisRound: 0, folded: false, allIn: false },
  ];
  postForcedBet(seats[sbIndex], SMALL_BLIND);
  postForcedBet(seats[bbIndex], BIG_BLIND);

  state.betting = startBettingRound(seats, sbIndex, BIG_BLIND, BIG_BLIND);
  syncStacksFromBetting(state);
}

export function createHoldemGame(): HoldemGameState {
  const state: HoldemGameState = {
    deck: [],
    community: [],
    players: [
      { id: "human", stack: STARTING_STACK, holeCards: [] },
      { id: "ai", stack: STARTING_STACK, holeCards: [] },
    ],
    dealerIndex: Math.random() < 0.5 ? 0 : 1,
    betting: startBettingRound([], 0, 0, 0), // throwaway placeholder — startHand below fully replaces it
    street: "preflop",
    potCarried: 0,
    handNumber: 1,
    status: "playing",
    lastResult: null,
    bustedPlayer: null,
  };
  startHand(state);
  return state;
}

export function startNextHand(state: HoldemGameState): HoldemGameState {
  if (state.status !== "handOver") throw new Error("The current hand isn't over yet");
  if (state.bustedPlayer) throw new Error("The session is over — someone is out of chips");
  state.dealerIndex = (1 - state.dealerIndex) as 0 | 1; // button alternates every hand, same as real heads-up play
  state.handNumber += 1;
  startHand(state);
  return state;
}

function checkBust(state: HoldemGameState) {
  if (state.players[0].stack <= 0) state.bustedPlayer = "human";
  else if (state.players[1].stack <= 0) state.bustedPlayer = "ai";
}

function resolveByFold(state: HoldemGameState) {
  const winnerIndex = state.betting.seats.findIndex((s) => !s.folded);
  const winnerId: SeatId = winnerIndex === 0 ? "human" : "ai";
  state.players[winnerIndex] = { ...state.players[winnerIndex], stack: state.players[winnerIndex].stack + state.potCarried };
  state.lastResult = { winner: winnerId, wonByFold: true, potWon: state.potCarried, humanHand: null, aiHand: null };
  state.potCarried = 0;
  state.status = "handOver";
  checkBust(state);
}

function resolveShowdown(state: HoldemGameState) {
  const humanHand = evaluateBestHand([...state.players[0].holeCards, ...state.community]);
  const aiHand = evaluateBestHand([...state.players[1].holeCards, ...state.community]);
  const cmp = compareHandResults(humanHand, aiHand);
  const winner: "human" | "ai" | "split" = cmp > 0 ? "human" : cmp < 0 ? "ai" : "split";

  if (winner === "split") {
    const half = Math.floor(state.potCarried / 2);
    // The odd chip on an uneven split goes to the non-dealer seat — an
    // arbitrary but fixed rule, same "pick something and record it" spirit
    // as every other placeholder-stage number in this project.
    const nonDealer = (1 - state.dealerIndex) as 0 | 1;
    const dealer = state.dealerIndex;
    state.players[nonDealer] = { ...state.players[nonDealer], stack: state.players[nonDealer].stack + (state.potCarried - half) };
    state.players[dealer] = { ...state.players[dealer], stack: state.players[dealer].stack + half };
  } else {
    const idx = winner === "human" ? 0 : 1;
    state.players[idx] = { ...state.players[idx], stack: state.players[idx].stack + state.potCarried };
  }
  state.lastResult = { winner, wonByFold: false, potWon: state.potCarried, humanHand, aiHand };
  state.potCarried = 0;
  state.status = "handOver";
  checkBust(state);
}

// Called once a betting round reports roundOver. Sweeps the street's chips
// into the carried pot, then either resolves the hand (a fold, or showdown
// after the river) or deals the next street. When one side is already
// all-in with nobody left who could still bet, there's no betting round to
// run — this recurses straight through the remaining streets to showdown,
// exactly like a real table "running it out" for an all-in.
function sweepPotAndAdvanceStreet(state: HoldemGameState) {
  const contributed = state.betting.seats.reduce((sum, s) => sum + s.betThisRound, 0);
  state.potCarried += contributed;

  const active = state.betting.seats.filter((s) => !s.folded);
  if (active.length <= 1) {
    resolveByFold(state);
    return;
  }
  if (state.street === "river") {
    resolveShowdown(state);
    return;
  }

  const nextIdx = STREET_ORDER.indexOf(state.street) + 1;
  state.street = STREET_ORDER[nextIdx];
  const dealCount = state.street === "flop" ? 3 : 1;
  for (let i = 0; i < dealCount; i++) state.community.push(state.deck.pop()!);

  const resetSeats: TableSeat[] = state.betting.seats.map((s) => ({ ...s, betThisRound: 0 }));
  const bothCanAct = resetSeats.every((s) => !s.folded && !s.allIn);
  if (!bothCanAct) {
    // Nobody left who could bet this street either — no betting round to
    // start; deal straight through to the next one.
    state.betting = { seats: resetSeats, currentBet: 0, minRaise: BIG_BLIND, actingIndex: 0, toAct: [], roundOver: true };
    syncStacksFromBetting(state);
    sweepPotAndAdvanceStreet(state);
    return;
  }
  const firstToAct = (1 - state.dealerIndex) as 0 | 1; // non-dealer acts first on every postflop street, dealer acts last
  state.betting = startBettingRound(resetSeats, firstToAct, 0, BIG_BLIND);
  syncStacksFromBetting(state);
}

export function applyHoldemAction(state: HoldemGameState, seatIndex: 0 | 1, action: BettingAction): HoldemGameState {
  if (state.status !== "playing") throw new Error("This hand is already over — call startNextHand first");
  state.betting = applyBettingAction(state.betting, seatIndex, action);
  syncStacksFromBetting(state);
  if (state.betting.roundOver) sweepPotAndAdvanceStreet(state);
  return state;
}

export function legalActionsFor(state: HoldemGameState, seatIndex: 0 | 1): LegalActions {
  return legalActions(state.betting, seatIndex);
}

export function potTotal(state: HoldemGameState): number {
  return state.potCarried + state.betting.seats.reduce((sum, s) => sum + s.betThisRound, 0);
}

// ---- AI opponent — a real hand-strength/pot-odds heuristic, not a random
// or scripted result, per Maxime's own "Inter for all 3... real AI" call. A
// full solver is out of scope for a Rec Room minigame; this reasons the way
// a reasonable amateur player would: how good is my hand right now, and is
// the price being asked worth it, with enough controlled randomness (same
// "small jitter" spirit as pegBoard.ts's pickAiMove) that it doesn't play
// as a fully predictable script.

// Preflop, before any community cards exist, hand strength is estimated
// from the two hole cards alone: high-card value (weighted toward the
// better of the two), a real bonus for a pocket pair (bigger pair, bigger
// bonus), and small bonuses for being suited or connected — the same shape
// every simplified starting-hand chart uses, without importing a full
// 169-hand equity table for a Rec Room minigame.
function preflopStrength(hole: Card[]): number {
  const [a, b] = hole;
  const hi = Math.max(a.rank, b.rank);
  const lo = Math.min(a.rank, b.rank);
  const isPair = a.rank === b.rank;
  const suited = a.suit === b.suit;
  const gap = hi - lo;

  let score = ((hi - 2) / 12) * 0.5 + ((lo - 2) / 12) * 0.2;
  if (isPair) score += 0.3 + ((hi - 2) / 12) * 0.15;
  if (suited) score += 0.06;
  if (!isPair) {
    if (gap === 1) score += 0.05;
    else if (gap === 2) score += 0.02;
  }
  return Math.min(1, Math.max(0, score));
}

// Postflop, strength is read off the actual best-hand-so-far — cheap and
// good enough for a heuristic AI (it doesn't model drawing potential, e.g.
// a flush draw scores no higher than the high card it currently is), the
// same "real, not exhaustive" tradeoff pegBoard.ts's own AI makes.
function postflopStrength(hole: Card[], community: Card[]): number {
  const best = evaluateBestHand([...hole, ...community]);
  const categoryScore = categoryStrengthIndex(best.category) / 8;
  const kickerScore = ((best.ranks[0] ?? 2) - 2) / 12;
  return Math.min(1, categoryScore * 0.85 + kickerScore * 0.15);
}

function decideAction(strength: number, legal: LegalActions, potBeforeAction: number): BettingAction {
  // Random jitter so the AI doesn't play as a fully deterministic script —
  // occasionally calls slightly light, occasionally passes on a marginal
  // raise. Same "small random tiebreak keeps it from being fully
  // predictable" spirit as pegBoard.ts's own AI scorer.
  const noise = (Math.random() - 0.5) * 0.16;
  const effective = Math.min(1, Math.max(0, strength + noise));

  if (!legal.call && !legal.raise) return legal.check ? { type: "check" } : { type: "fold" };

  const toCall = legal.call?.amount ?? 0;
  const potOdds = toCall > 0 ? toCall / (potBeforeAction + toCall) : 0;

  if (effective < 0.28) {
    // A weak hand takes a free card but won't pay for one.
    if (toCall === 0) return legal.check ? { type: "check" } : { type: "fold" };
    return { type: "fold" };
  }

  if (effective < 0.55) {
    // A medium hand calls a reasonable price, folds to a bad one, and
    // occasionally raises as a semi-bluff rather than only ever calling.
    if (toCall === 0) {
      if (legal.raise && Math.random() < 0.2) return { type: "raise", to: legal.raise.minTo };
      return { type: "check" };
    }
    if (potOdds > 0.45 && effective < potOdds + 0.15) return { type: "fold" };
    return legal.call ? { type: "call" } : { type: "fold" };
  }

  // A strong hand bets or raises for value most of the time — sizing up
  // proportionally to how strong, not just always shoving.
  if (legal.raise && Math.random() < 0.75) {
    const span = legal.raise.maxTo - legal.raise.minTo;
    const to = Math.min(legal.raise.maxTo, legal.raise.minTo + Math.round(span * effective));
    return { type: "raise", to };
  }
  if (legal.call) return { type: "call" };
  if (legal.check) return { type: "check" };
  return { type: "fold" };
}

export function pickAiAction(state: HoldemGameState): BettingAction {
  const strength = state.community.length === 0 ? preflopStrength(state.players[1].holeCards) : postflopStrength(state.players[1].holeCards, state.community);
  const legal = legalActionsFor(state, 1);
  return decideAction(strength, legal, potTotal(state));
}
