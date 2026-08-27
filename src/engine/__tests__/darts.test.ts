// src/engine/__tests__/darts.test.ts
// Fletchers' engine tests, 26 Aug 2026 — same rigor as pegBoard.test.ts and
// holdem.test.ts before it. Exact-threshold cases exploit HAND_JITTER's own
// bound (±0.05) against the zone thresholds (bullseye at 0.92, outer at
// 0.2): an aim of exactly 1 can never jitter below 0.95, comfortably above
// 0.92, so it's a guaranteed bullseye; an aim of exactly 0 can never
// jitter above 0.05, comfortably below 0.2, so it's a guaranteed miss.
// That's what makes deterministic assertions possible on a function that's
// deliberately non-deterministic in the middle of its range — same spirit
// as holdem.test.ts's "never returns an illegal action across many random
// deals" style statistical checks for the parts that can't be pinned exactly.
import { describe, it, expect } from "vitest";
import {
  createDartsGame,
  throwDart,
  zoneForAccuracy,
  scoreForZone,
  zoneLabel,
  pickAiThrowValue,
  DART_ZONE_THRESHOLDS,
  DARTS_TOTAL_ROUNDS,
  DARTS_PER_ROUND,
  type DartsGameState,
} from "../darts";

describe("createDartsGame — initial state", () => {
  it("starts on round 1, human's turn, zero darts thrown, zero totals, playing", () => {
    const game = createDartsGame();
    expect(game.round).toBe(1);
    expect(game.totalRounds).toBe(DARTS_TOTAL_ROUNDS);
    expect(game.dartsPerRound).toBe(DARTS_PER_ROUND);
    expect(game.turn).toBe("human");
    expect(game.dartsThrownThisTurn).toBe(0);
    expect(game.throws).toEqual({ human: [], ai: [] });
    expect(game.totals).toEqual({ human: 0, ai: 0 });
    expect(game.status).toBe("playing");
    expect(game.winner).toBeNull();
  });
});

describe("zoneForAccuracy / scoreForZone — exact threshold boundaries", () => {
  it("bullseye at and above its threshold, inner just below it", () => {
    expect(zoneForAccuracy(DART_ZONE_THRESHOLDS.bullseye)).toBe("bullseye");
    expect(zoneForAccuracy(1)).toBe("bullseye");
    expect(zoneForAccuracy(DART_ZONE_THRESHOLDS.bullseye - 0.001)).toBe("inner");
  });

  it("inner at and above its threshold, mid just below it", () => {
    expect(zoneForAccuracy(DART_ZONE_THRESHOLDS.inner)).toBe("inner");
    expect(zoneForAccuracy(DART_ZONE_THRESHOLDS.inner - 0.001)).toBe("mid");
  });

  it("mid at and above its threshold, outer just below it", () => {
    expect(zoneForAccuracy(DART_ZONE_THRESHOLDS.mid)).toBe("mid");
    expect(zoneForAccuracy(DART_ZONE_THRESHOLDS.mid - 0.001)).toBe("outer");
  });

  it("outer at and above its threshold, miss just below it and at zero", () => {
    expect(zoneForAccuracy(DART_ZONE_THRESHOLDS.outer)).toBe("outer");
    expect(zoneForAccuracy(DART_ZONE_THRESHOLDS.outer - 0.001)).toBe("miss");
    expect(zoneForAccuracy(0)).toBe("miss");
  });

  it("scoreForZone: 50/30/20/10/0 for bullseye/inner/mid/outer/miss", () => {
    expect(scoreForZone("bullseye")).toBe(50);
    expect(scoreForZone("inner")).toBe(30);
    expect(scoreForZone("mid")).toBe(20);
    expect(scoreForZone("outer")).toBe(10);
    expect(scoreForZone("miss")).toBe(0);
  });

  it("zoneLabel gives a real display string for every zone", () => {
    expect(zoneLabel("bullseye")).toBe("Bullseye");
    expect(zoneLabel("inner")).toBe("Inner ring");
    expect(zoneLabel("mid")).toBe("Mid ring");
    expect(zoneLabel("outer")).toBe("Outer ring");
    expect(zoneLabel("miss")).toBe("Miss");
  });
});

describe("throwDart — hand-jitter can never cross a zone at the extremes", () => {
  it("aim = 1 always lands bullseye (score 50), run repeatedly", () => {
    for (let i = 0; i < 50; i++) {
      const { result } = throwDart(createDartsGame(), 1);
      expect(result.zone).toBe("bullseye");
      expect(result.score).toBe(50);
      expect(result.accuracy).toBeGreaterThanOrEqual(DART_ZONE_THRESHOLDS.bullseye);
    }
  });

  it("aim = 0 always misses (score 0), run repeatedly", () => {
    for (let i = 0; i < 50; i++) {
      const { result } = throwDart(createDartsGame(), 0);
      expect(result.zone).toBe("miss");
      expect(result.score).toBe(0);
      expect(result.accuracy).toBeLessThan(DART_ZONE_THRESHOLDS.outer);
    }
  });

  it("clamps an out-of-range aim into 0..1 rather than throwing", () => {
    const { result: high } = throwDart(createDartsGame(), 1.5);
    expect(high.aim).toBe(1);
    const { result: low } = throwDart(createDartsGame(), -0.5);
    expect(low.aim).toBe(0);
  });
});

describe("throwDart — turn and round advancement", () => {
  it("stays on human's turn for darts 1 and 2 of a round, incrementing dartsThrownThisTurn", () => {
    let game = createDartsGame();
    game = throwDart(game, 1).state;
    expect(game.turn).toBe("human");
    expect(game.dartsThrownThisTurn).toBe(1);
    expect(game.round).toBe(1);
    game = throwDart(game, 1).state;
    expect(game.turn).toBe("human");
    expect(game.dartsThrownThisTurn).toBe(2);
  });

  it("hands the turn to the AI after the human's 3rd dart of the round, round unchanged", () => {
    let game = createDartsGame();
    for (let i = 0; i < DARTS_PER_ROUND; i++) game = throwDart(game, 1).state;
    expect(game.turn).toBe("ai");
    expect(game.dartsThrownThisTurn).toBe(0);
    expect(game.round).toBe(1);
    expect(game.throws.human.length).toBe(DARTS_PER_ROUND);
  });

  it("advances to round 2 and back to human's turn after the AI's 3rd dart of round 1", () => {
    let game = createDartsGame();
    for (let i = 0; i < DARTS_PER_ROUND; i++) game = throwDart(game, 1).state; // human's round 1
    for (let i = 0; i < DARTS_PER_ROUND; i++) game = throwDart(game, 1).state; // ai's round 1
    expect(game.round).toBe(2);
    expect(game.turn).toBe("human");
    expect(game.status).toBe("playing");
    expect(game.throws.ai.length).toBe(DARTS_PER_ROUND);
  });

  it("ends the session after all totalRounds complete for both sides", () => {
    let game = createDartsGame();
    while (game.status === "playing") {
      game = throwDart(game, 1).state;
    }
    expect(game.throws.human.length).toBe(DARTS_TOTAL_ROUNDS * DARTS_PER_ROUND);
    expect(game.throws.ai.length).toBe(DARTS_TOTAL_ROUNDS * DARTS_PER_ROUND);
    expect(game.status).toBe("over");
    expect(game.winner).not.toBeNull();
  });
});

describe("throwDart — winner determination", () => {
  function playFullSession(humanAim: number, aiAim: number): DartsGameState {
    let game: DartsGameState = createDartsGame();
    while (game.status === "playing") {
      game = throwDart(game, game.turn === "human" ? humanAim : aiAim).state;
    }
    return game;
  }

  it("human wins when every human dart is a guaranteed bullseye and every AI dart is a guaranteed miss", () => {
    const game = playFullSession(1, 0);
    expect(game.totals.human).toBe(DARTS_TOTAL_ROUNDS * DARTS_PER_ROUND * 50);
    expect(game.totals.ai).toBe(0);
    expect(game.winner).toBe("human");
  });

  it("the AI wins when the aims are reversed", () => {
    const game = playFullSession(0, 1);
    expect(game.totals.ai).toBe(DARTS_TOTAL_ROUNDS * DARTS_PER_ROUND * 50);
    expect(game.totals.human).toBe(0);
    expect(game.winner).toBe("ai");
  });

  it("draws when both sides hit guaranteed bullseyes on every dart — equal totals", () => {
    const game = playFullSession(1, 1);
    expect(game.totals.human).toBe(game.totals.ai);
    expect(game.winner).toBe("draw");
  });
});

describe("throwDart — misuse", () => {
  it("throws if called on a game that's already over", () => {
    const finished = (() => {
      let game = createDartsGame();
      while (game.status === "playing") game = throwDart(game, 1).state;
      return game;
    })();
    expect(() => throwDart(finished, 1)).toThrow();
  });
});

describe("pickAiThrowValue", () => {
  it("always returns a value in 0..1 across many calls", () => {
    for (let i = 0; i < 200; i++) {
      const aim = pickAiThrowValue();
      expect(aim).toBeGreaterThanOrEqual(0);
      expect(aim).toBeLessThanOrEqual(1);
    }
  });

  it("centers around a real skill level rather than always being 0 or 1 — some spread of zones over many throws", () => {
    const zones = new Set<string>();
    let game = createDartsGame();
    for (let i = 0; i < 60 && game.status === "playing"; i++) {
      const aim = pickAiThrowValue();
      const { state, result } = throwDart(game, aim);
      game = state;
      zones.add(result.zone);
    }
    // A fixed skill center with real spread should not produce only one
    // single zone across dozens of throws.
    expect(zones.size).toBeGreaterThan(1);
  });
});
