// src/engine/cardTable/__tests__/bettingEngine.test.ts
// First coverage for the generic betting-round engine, 26 Aug 2026. Tests
// the 2-seat (heads-up) case throughout, since that's the only shape
// holdem.ts actually exercises today — see bettingEngine.ts's own header
// for the scope note on multi-way side pots.
import { describe, it, expect } from "vitest";
import { startBettingRound, applyBettingAction, legalActions, type TableSeat } from "../bettingEngine";

function seat(id: string, stack: number, betThisRound = 0): TableSeat {
  return { id, stack, betThisRound, folded: false, allIn: false };
}

describe("startBettingRound", () => {
  it("orders toAct starting from firstToAct, and picks that seat to act first", () => {
    const state = startBettingRound([seat("a", 100), seat("b", 100)], 1, 0, 20);
    expect(state.toAct).toEqual([1, 0]);
    expect(state.actingIndex).toBe(1);
    expect(state.roundOver).toBe(false);
  });

  it("the big-blind option: even after the small blind calls to match, the big blind still owes a real decision", () => {
    // Blinds posted unevenly (sb=10, bb=20, currentBet=20) — that's the
    // real preflop shape, not two already-equal bets constructed by hand.
    let state = startBettingRound([seat("sb", 100, 10), seat("bb", 100, 20)], 0, 20, 20);
    expect(state.toAct).toEqual([0, 1]);
    state = applyBettingAction(state, 0, { type: "call" }); // sb calls up to 20, matching bb
    expect(state.toAct).toEqual([1]); // bb hasn't acted yet — still owed a real decision (check or raise)
    expect(state.roundOver).toBe(false);
  });

  it("does NOT end the round just because the opponent is already all-in — the other seat still owes a real response", () => {
    const allIn: TableSeat = { id: "b", stack: 0, betThisRound: 100, folded: false, allIn: true };
    const state = startBettingRound([seat("a", 50), allIn], 0, 100, 20);
    expect(state.roundOver).toBe(false); // seat a still has to fold or call the all-in
    expect(state.toAct).toEqual([0]);
  });
});

describe("legalActions", () => {
  it("offers check when already matched, call+raise when behind, and never both check and call", () => {
    const matched = startBettingRound([seat("a", 100, 20), seat("b", 100, 20)], 0, 20, 20);
    const legalMatched = legalActions(matched, 0);
    expect(legalMatched.check).toBe(true);
    expect(legalMatched.call).toBeNull();

    const behind = startBettingRound([seat("a", 100, 0), seat("b", 100, 20)], 0, 20, 20);
    const legalBehind = legalActions(behind, 0);
    expect(legalBehind.check).toBe(false);
    expect(legalBehind.call).toEqual({ amount: 20 });
    expect(legalBehind.raise).toEqual({ minTo: 40, maxTo: 100 });
  });

  it("a short stack's call is capped at their remaining stack (an all-in call for less)", () => {
    const state = startBettingRound([seat("a", 15, 0), seat("b", 100, 20)], 0, 20, 20);
    expect(legalActions(state, 0).call).toEqual({ amount: 15 });
  });

  it("does not offer raise when the seat has nothing beyond a call", () => {
    const state = startBettingRound([seat("a", 20, 0), seat("b", 100, 20)], 0, 20, 20);
    expect(legalActions(state, 0).raise).toBeNull();
  });

  it("does not offer raise when every opponent is already all-in (nobody left to respond)", () => {
    const oppAllIn: TableSeat = { id: "b", stack: 0, betThisRound: 100, folded: false, allIn: true };
    const state = startBettingRound([seat("a", 200, 100), oppAllIn], 0, 100, 20);
    expect(legalActions(state, 0).raise).toBeNull();
    expect(legalActions(state, 0).check).toBe(true); // already matched the all-in amount
  });
});

describe("applyBettingAction — turn order and round completion", () => {
  it("throws if it isn't the acting seat's turn", () => {
    const state = startBettingRound([seat("a", 100), seat("b", 100)], 0, 0, 20);
    expect(() => applyBettingAction(state, 1, { type: "check" })).toThrow();
  });

  it("a check-check round closes with roundOver true", () => {
    let state = startBettingRound([seat("a", 100), seat("b", 100)], 0, 0, 20);
    state = applyBettingAction(state, 0, { type: "check" });
    expect(state.roundOver).toBe(false);
    state = applyBettingAction(state, 1, { type: "check" });
    expect(state.roundOver).toBe(true);
  });

  it("a bet reopens the action for the other seat, and their call closes the round", () => {
    let state = startBettingRound([seat("a", 100), seat("b", 100)], 0, 0, 20);
    state = applyBettingAction(state, 0, { type: "raise", to: 20 });
    expect(state.roundOver).toBe(false);
    expect(state.actingIndex).toBe(1);
    expect(state.currentBet).toBe(20);
    state = applyBettingAction(state, 1, { type: "call" });
    expect(state.roundOver).toBe(true);
    expect(state.seats[1].stack).toBe(80);
  });

  it("a re-raise reopens the action for the original bettor again", () => {
    let state = startBettingRound([seat("a", 200), seat("b", 200)], 0, 0, 20);
    state = applyBettingAction(state, 0, { type: "raise", to: 20 });
    state = applyBettingAction(state, 1, { type: "raise", to: 60 });
    expect(state.roundOver).toBe(false);
    expect(state.actingIndex).toBe(0);
    expect(state.currentBet).toBe(60);
    expect(state.minRaise).toBe(40); // the size of the last raise (60-20)
  });

  it("a fold ends the round immediately regardless of whose turn is next", () => {
    let state = startBettingRound([seat("a", 100), seat("b", 100)], 0, 0, 20);
    state = applyBettingAction(state, 0, { type: "raise", to: 20 });
    state = applyBettingAction(state, 1, { type: "fold" });
    expect(state.roundOver).toBe(true);
    expect(state.seats[1].folded).toBe(true);
  });

  it("rejects an under-minimum raise that isn't also an all-in", () => {
    const state = startBettingRound([seat("a", 200), seat("b", 200)], 0, 0, 20);
    expect(() => applyBettingAction(state, 0, { type: "raise", to: 10 })).toThrow();
  });

  it("allows a short all-in raise below the minimum, and it does not reopen action for a seat that already acted", () => {
    let state = startBettingRound([seat("a", 200, 0), seat("b", 25, 0)], 1, 0, 20);
    // b acts first here (all-in for 25, less than a min-raise of 20 over a
    // 0 currentBet would require... construct a real short-raise scenario:
    // currentBet is already 20 (as if a already bet), b can only go to 25.
    state = { ...state, currentBet: 20, minRaise: 20, seats: [{ ...state.seats[0], betThisRound: 20 }, state.seats[1]], toAct: [1], actingIndex: 1, roundOver: false };
    const legal = legalActions(state, 1);
    expect(legal.raise).toEqual({ minTo: 25, maxTo: 25 }); // capped by stack, below the textbook 40 minimum
    const next = applyBettingAction(state, 1, { type: "raise", to: 25 });
    expect(next.seats[1].allIn).toBe(true);
    expect(next.currentBet).toBe(25); // still raises the bar to match...
    expect(next.roundOver).toBe(true); // ...but does NOT reopen action for seat 0, who already acted this round
  });

  it("marks a seat all-in once their stack hits zero, whether by call or raise", () => {
    let state = startBettingRound([seat("a", 20, 0), seat("b", 100, 20)], 0, 20, 20);
    state = applyBettingAction(state, 0, { type: "call" });
    expect(state.seats[0].allIn).toBe(true);
    expect(state.seats[0].stack).toBe(0);
  });
});
