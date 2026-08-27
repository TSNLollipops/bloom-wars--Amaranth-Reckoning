// src/engine/cardTable/bettingEngine.ts
// Generic card-table substrate, piece 3 of 3 — see deck.ts's own header.
// A seat-based fold/check/call/raise engine with no idea what game is being
// bet on: it just tracks stacks and whose turn it is, and knows exactly
// when a betting round is actually over. Hold'em-specific rules (blinds,
// streets, who's dealer) live in holdem.ts, which calls startBettingRound
// once per street and applyBettingAction once per decision.
//
// Exercised today only in the 2-seat (heads-up) case — the Rec Room only
// ever seats the MC against one NPC — but the seat list and turn-order
// logic below aren't hardcoded to 2, so a future 3+ player table game
// wouldn't need this file rewritten, just proven against a case this
// project hasn't built yet.
//
// Simplification, stated plainly rather than silently assumed: true casino
// multi-way side-pot splitting (when 3+ players are unevenly all-in) isn't
// implemented — only the 2-seat all-in-for-less case is handled (see
// applyBettingAction's own comment), since that's the only case Hold'em.ts
// can actually produce right now.

export interface TableSeat {
  id: string;
  stack: number;
  betThisRound: number; // chips this seat has committed on the CURRENT street only
  folded: boolean;
  allIn: boolean;
}

export interface BettingState {
  seats: TableSeat[];
  currentBet: number; // the betThisRound level everyone still in the hand needs to match
  minRaise: number; // smallest legal full-raise increment this round
  actingIndex: number; // which seat acts next (meaningless once roundOver)
  toAct: number[]; // seat indices (rotation order) still owed a decision before this round can close
  roundOver: boolean;
}

export type BettingAction = { type: "fold" } | { type: "check" } | { type: "call" } | { type: "raise"; to: number };

export interface LegalActions {
  fold: boolean;
  check: boolean;
  call: { amount: number } | null; // chips this seat would add; capped by stack (an all-in call can be "for less")
  raise: { minTo: number; maxTo: number } | null; // total betThisRound after raising; null when the seat has nothing left beyond a call
}

function activeSeatIndices(state: BettingState): number[] {
  return state.seats.map((_, i) => i).filter((i) => !state.seats[i].folded);
}

function seatCanAct(state: BettingState, i: number): boolean {
  const seat = state.seats[i];
  return !!seat && !seat.folded && !seat.allIn;
}

// Called once at the start of every betting round (a new street, or the
// very first street with blinds already posted into betThisRound by the
// caller). toAct is built in rotation order starting at firstToAct, so
// toAct[0] is always correctly whoever should act first among seats that
// actually can. Any seat still in the hand owes a decision here — even one
// whose betThisRound already matches currentBet (the Hold'em "big blind
// option" case), since forced/passive money on the table isn't the same as
// having chosen to be there.
export function startBettingRound(seats: TableSeat[], firstToAct: number, currentBet: number, minRaise: number): BettingState {
  const state: BettingState = {
    seats: seats.map((s) => ({ ...s })),
    currentBet,
    minRaise,
    actingIndex: firstToAct,
    toAct: [],
    roundOver: false,
  };
  const n = state.seats.length;
  for (let k = 0; k < n; k++) {
    const idx = (firstToAct + k) % n;
    if (seatCanAct(state, idx)) state.toAct.push(idx);
  }
  const active = activeSeatIndices(state);
  if (active.length <= 1 || state.toAct.length === 0) {
    state.roundOver = true;
  } else {
    state.actingIndex = state.toAct[0];
  }
  return state;
}

export function legalActions(state: BettingState, seatIndex: number): LegalActions {
  const none: LegalActions = { fold: false, check: false, call: null, raise: null };
  if (state.roundOver) return none;
  const seat = state.seats[seatIndex];
  if (!seat || seat.folded || seat.allIn) return none;

  const toCall = Math.max(0, state.currentBet - seat.betThisRound);
  const check = toCall === 0;
  const call = !check && seat.stack > 0 ? { amount: Math.min(toCall, seat.stack) } : null;

  const maxTo = seat.betThisRound + seat.stack; // a full shove
  const minTo = Math.min(state.currentBet + state.minRaise, maxTo);
  // Raising is only offered when the seat has chips beyond what a call
  // would cost (otherwise "raising" is just an ordinary all-in call,
  // already covered by `call`) AND at least one opponent could still
  // respond to it. Without that second guard, raising into an opponent
  // who's already all-in and can't act again would let the raiser stuff
  // uncalled chips into the pot this engine has no "return the uncalled
  // portion" step for — simplest fix is not to offer the action at all.
  const anyOpponentCanRespond = state.seats.some((s, i) => i !== seatIndex && !s.folded && !s.allIn);
  const raise = seat.stack > toCall && anyOpponentCanRespond ? { minTo, maxTo } : null;

  return { fold: true, check, call, raise };
}

export function applyBettingAction(state: BettingState, seatIndex: number, action: BettingAction): BettingState {
  if (state.roundOver) throw new Error("This betting round is already over");
  if (seatIndex !== state.actingIndex) throw new Error(`It isn't seat ${seatIndex}'s turn to act`);
  const legal = legalActions(state, seatIndex);

  const next: BettingState = {
    ...state,
    seats: state.seats.map((s) => ({ ...s })),
    toAct: [...state.toAct],
  };
  const seat = next.seats[seatIndex];
  let isFullRaise = false;

  if (action.type === "fold") {
    if (!legal.fold) throw new Error("Fold isn't legal here");
    seat.folded = true;
  } else if (action.type === "check") {
    if (!legal.check) throw new Error("Check isn't legal — a bet is outstanding");
  } else if (action.type === "call") {
    if (!legal.call) throw new Error("Call isn't legal here");
    seat.stack -= legal.call.amount;
    seat.betThisRound += legal.call.amount;
    if (seat.stack === 0) seat.allIn = true;
  } else if (action.type === "raise") {
    if (!legal.raise) throw new Error("Raise isn't legal here");
    const { to } = action;
    // An under-minraise "to" is only legal when it's also this seat's
    // entire stack (an all-in for less than a full raise) — real poker's
    // rule that a short all-in doesn't reopen the action the way a full
    // raise does is enforced below via isFullRaise, not by rejecting the
    // action outright.
    if (to < legal.raise.minTo && to !== legal.raise.maxTo) {
      throw new Error(`Raise to ${to} is below the minimum ${legal.raise.minTo} and isn't an all-in for the full stack`);
    }
    if (to > legal.raise.maxTo) throw new Error(`Raise to ${to} exceeds this seat's stack`);
    const add = to - seat.betThisRound;
    seat.stack -= add;
    seat.betThisRound = to;
    if (seat.stack === 0) seat.allIn = true;
    // Deliberately NOT compared against legal.raise.minTo — that value is
    // clamped down to maxTo when a short stack can't reach the textbook
    // minimum (so a genuine short all-in is still offered as a legal
    // action at all). Whether this specific raise reopens the action for
    // players who already acted has to be judged against the real,
    // unclamped textbook minimum, or a short all-in would wrongly count as
    // a full raise just because it happened to equal its own (clamped)
    // minTo. Caught by this file's own test suite, not by inspection.
    const textbookMinTo = state.currentBet + state.minRaise;
    isFullRaise = to >= textbookMinTo;
  }

  next.toAct = next.toAct.filter((i) => i !== seatIndex);

  if (isFullRaise) {
    next.minRaise = Math.max(state.minRaise, seat.betThisRound - state.currentBet);
    next.currentBet = seat.betThisRound;
    // A full raise reopens the action for everyone else still able to act
    // — rebuild toAct in rotation order starting right after this seat,
    // same ordering discipline as startBettingRound.
    const n = next.seats.length;
    const fresh: number[] = [];
    for (let k = 1; k < n; k++) {
      const idx = (seatIndex + k) % n;
      if (seatCanAct(next, idx)) fresh.push(idx);
    }
    next.toAct = fresh;
  } else if (action.type === "raise" && seat.betThisRound > state.currentBet) {
    // An all-in for less than a full raise: it DOES still raise the bar
    // seats must match (or fold to), it just doesn't reopen action for
    // anyone who already acted this round.
    next.currentBet = seat.betThisRound;
  }

  const active = activeSeatIndices(next);
  next.roundOver = active.length <= 1 || next.toAct.length === 0;
  if (!next.roundOver) next.actingIndex = next.toAct[0];

  return next;
}
