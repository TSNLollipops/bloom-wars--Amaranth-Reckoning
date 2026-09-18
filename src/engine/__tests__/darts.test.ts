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

// 17 Sep 2026 — every throw lands at a real point on the board, not just a
// ring. The angle is rolled once and stored on the throw (see DartThrow's
// own comment) so the Hub can redraw without moving anything.
describe("DartThrow.angle — a landed dart has a stable place on the board", () => {
  it("every throw carries an angle in 0..2π", () => {
    let game = createDartsGame();
    while (game.status === "playing") {
      const { state, result } = throwDart(game, 0.5);
      game = state;
      expect(result.angle).toBeGreaterThanOrEqual(0);
      expect(result.angle).toBeLessThan(Math.PI * 2);
    }
    const all = [...game.throws.human, ...game.throws.ai];
    expect(all).toHaveLength(DARTS_TOTAL_ROUNDS * DARTS_PER_ROUND * 2);
    for (const t of all) expect(typeof t.angle).toBe("number");
  });

  it("nine darts do not all share one angle — the 'same point' look is gone", () => {
    let game = createDartsGame();
    while (game.status === "playing") game = throwDart(game, 0.62).state;
    const angles = new Set(game.throws.ai.map((t) => t.angle.toFixed(3)));
    expect(angles.size).toBeGreaterThan(1);
  });

  it("the stored angle on an earlier throw is untouched by later throws", () => {
    let game = createDartsGame();
    const first = throwDart(game, 0.8);
    game = first.state;
    const firstAngle = first.result.angle;
    while (game.status === "playing") game = throwDart(game, 0.3).state;
    expect(game.throws.human[0].angle).toBe(firstAngle);
  });
});

// 17 Sep 2026 — the player's opponent now plays at their real learned
// skill, floored (data/recRoomAptitude.ts's OPPONENT_SKILL_FLOOR). The
// darts floor was chosen to match today's flat opponent's MEAN. Its spread
// is deliberately wider (the 3 Sep retune keeps spread wide at every skill
// so "a good thrower is better, not immune to a bad round"), so a floored
// opponent averages what today's did with more swing either way.
describe("OPPONENT_SKILL_FLOOR.fletchers — matches the old flat opponent's mean", () => {
  it("floored skill maps to at least the default mean", async () => {
    const { OPPONENT_SKILL_FLOOR } = await import("../../data/recRoomAptitude");
    const { dartsSkillFor, DEFAULT_DARTS_SKILL } = await import("../darts");
    const floored = dartsSkillFor(OPPONENT_SKILL_FLOOR.fletchers);
    expect(floored.mean).toBeGreaterThanOrEqual(DEFAULT_DARTS_SKILL.mean - 0.005);
    expect(floored.spread).toBeGreaterThan(0);
    expect(floored.spread).toBeLessThan(0.44); // strictly tighter than a skill-0 thrower
  });

  it("a skill above the floor is never pulled down by it", async () => {
    const { OPPONENT_SKILL_FLOOR } = await import("../../data/recRoomAptitude");
    expect(Math.max(90, OPPONENT_SKILL_FLOOR.fletchers)).toBe(90);
    expect(Math.max(10, OPPONENT_SKILL_FLOOR.fletchers)).toBe(OPPONENT_SKILL_FLOOR.fletchers);
  });
});
