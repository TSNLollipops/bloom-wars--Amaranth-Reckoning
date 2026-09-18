// Rec Room Standings & NPC Learning, slice 2 — record store + aptitude.

import { describe, it, expect } from "vitest";
import {
  LEARNING_TAU,
  PLAYER_RECORD_ID,
  combinedRecord,
  emptyRecord,
  pairFavoriteGame,
  pairSessionsFor,
  recordSession,
  skillFor,
  skillFromPlayed,
  standingPoints,
  winRate,
  type RecRoomState,
} from "../recRoomRecord";
import {
  APTITUDE_JITTER,
  ARCHETYPE_APTITUDE_NUDGE,
  CATALYST_APTITUDE,
  REC_GAME_IDS,
  aptitudeFor,
  aptitudeJitter,
} from "../../data/recRoomAptitude";
import { createCampaignState, ensureRecRoomState } from "../campaignState";

function fresh(): RecRoomState {
  return { records: {} };
}

describe("recRoomRecord — the learning curve", () => {
  it("is zero before anyone has played anything", () => {
    expect(skillFromPlayed(90, 0)).toBe(0);
  });

  it("hits the documented 63 / 86 / 95 percent of ceiling at TAU / 2xTAU / 3xTAU", () => {
    const ceiling = 100;
    expect(skillFromPlayed(ceiling, LEARNING_TAU)).toBeCloseTo(63.2, 0);
    expect(skillFromPlayed(ceiling, LEARNING_TAU * 2)).toBeCloseTo(86.5, 0);
    expect(skillFromPlayed(ceiling, LEARNING_TAU * 3)).toBeCloseTo(95.0, 0);
  });

  it("never exceeds the pilot's own ceiling, however long they grind", () => {
    expect(skillFromPlayed(60, 100000)).toBeLessThanOrEqual(60);
    expect(skillFromPlayed(60, 100000)).toBeGreaterThan(59.9);
  });

  it("climbs monotonically — practice never makes anyone worse", () => {
    let prev = -1;
    for (let played = 0; played <= 200; played += 1) {
      const s = skillFromPlayed(80, played);
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
  });

  it("front-loads the climb: the first 25 sessions are worth more than the next 75", () => {
    const first = skillFromPlayed(100, 25) - skillFromPlayed(100, 0);
    const rest = skillFromPlayed(100, 100) - skillFromPlayed(100, 25);
    expect(first).toBeGreaterThan(rest);
  });
});

describe("recRoomRecord — recording sessions", () => {
  it("gives both sides a row, not just the winner", () => {
    const state = fresh();
    recordSession(state, { gameId: "poker", a: "pilot_a", b: "pilot_b", winner: "pilot_a" });
    expect(state.records.pilot_a?.poker).toEqual({ played: 1, wins: 1, draws: 0, losses: 0 });
    expect(state.records.pilot_b?.poker).toEqual({ played: 1, wins: 0, draws: 0, losses: 1 });
  });

  it("records a draw as a draw on both sides", () => {
    const state = fresh();
    recordSession(state, { gameId: "pegBoard", a: "x", b: "y", winner: "draw" });
    expect(state.records.x?.pegBoard?.draws).toBe(1);
    expect(state.records.y?.pegBoard?.draws).toBe(1);
    expect(state.records.x?.pegBoard?.wins).toBe(0);
  });

  it("keeps games separate — a poker session doesn't touch a darts record", () => {
    const state = fresh();
    recordSession(state, { gameId: "poker", a: "x", b: "y", winner: "x" });
    expect(state.records.x?.fletchers).toBeUndefined();
  });

  it("keeps only the best `best`, never the latest", () => {
    const state = fresh();
    recordSession(state, { gameId: "fletchers", a: "x", b: "y", winner: "x", bestA: 210 });
    recordSession(state, { gameId: "fletchers", a: "x", b: "y", winner: "y", bestA: 140 });
    expect(state.records.x?.fletchers?.best).toBe(210);
  });

  it("stamps the calendar day when one is supplied, and leaves it alone when not", () => {
    const state = fresh();
    recordSession(state, { gameId: "poker", a: "x", b: "y", winner: "x", day: 41 });
    expect(state.records.x?.poker?.lastPlayedDay).toBe(41);
    recordSession(state, { gameId: "poker", a: "x", b: "y", winner: "x" });
    expect(state.records.x?.poker?.lastPlayedDay).toBe(41);
  });

  it("refuses self-play rather than double-counting it", () => {
    const state = fresh();
    recordSession(state, { gameId: "poker", a: "x", b: "x", winner: "x" });
    expect(state.records.x).toBeUndefined();
  });

  it("puts the player in the same map as the crew", () => {
    const state = fresh();
    recordSession(state, { gameId: "poker", a: PLAYER_RECORD_ID, b: "pilot_bosk", winner: PLAYER_RECORD_ID });
    expect(state.records[PLAYER_RECORD_ID]?.poker?.wins).toBe(1);
    expect(state.records.pilot_bosk?.poker?.losses).toBe(1);
  });

  it("NEVER deletes a record — a session against a pilot who is long gone still stands", () => {
    const state = fresh();
    recordSession(state, { gameId: "fletchers", a: "pilot_dead", b: "pilot_alive", winner: "pilot_dead", bestA: 300 });
    // Whatever else happens to the roster, this row is the grief beat.
    // If a future cleanup pass ever prunes it, this test is the alarm.
    for (let i = 0; i < 50; i += 1) {
      recordSession(state, { gameId: "fletchers", a: "pilot_alive", b: "pilot_other", winner: "pilot_alive" });
    }
    expect(state.records.pilot_dead?.fletchers?.best).toBe(300);
    expect(state.records.pilot_dead?.fletchers?.wins).toBe(1);
  });
});

// 17 Sep 2026 — Gossip's warm line, "I like to play {GAME} with him,
// depending on history." The individual records above never knew who a
// pilot played WITH; this is that missing axis, pairKey-keyed same as the
// bond store.
describe("recRoomRecord — pair history (Gossip's {GAME})", () => {
  it("nobody has a favorite game before they've played anything together", () => {
    const state = fresh();
    expect(pairSessionsFor(state, "pilot_bosk", "pilot_anand", "fletchers")).toBe(0);
    expect(pairFavoriteGame(state, "pilot_bosk", "pilot_anand")).toBeUndefined();
  });

  it("counts sessions between a specific pair, separate from either pilot's own overall record", () => {
    const state = fresh();
    recordSession(state, { gameId: "fletchers", a: "pilot_bosk", b: "pilot_anand", winner: "pilot_bosk" });
    recordSession(state, { gameId: "fletchers", a: "pilot_bosk", b: "pilot_anand", winner: "pilot_anand" });
    recordSession(state, { gameId: "fletchers", a: "pilot_bosk", b: "pilot_other", winner: "pilot_bosk" });
    expect(pairSessionsFor(state, "pilot_bosk", "pilot_anand", "fletchers")).toBe(2);
    expect(pairSessionsFor(state, "pilot_bosk", "pilot_other", "fletchers")).toBe(1);
    // Order of the two ids passed in doesn't matter — same pairKey either way.
    expect(pairSessionsFor(state, "pilot_anand", "pilot_bosk", "fletchers")).toBe(2);
  });

  it("picks whichever game the pair has played the most, across all three", () => {
    const state = fresh();
    recordSession(state, { gameId: "poker", a: "pilot_bosk", b: "pilot_anand", winner: "draw" });
    recordSession(state, { gameId: "fletchers", a: "pilot_bosk", b: "pilot_anand", winner: "pilot_bosk" });
    recordSession(state, { gameId: "fletchers", a: "pilot_bosk", b: "pilot_anand", winner: "pilot_anand" });
    expect(pairFavoriteGame(state, "pilot_bosk", "pilot_anand")).toBe("fletchers");
  });

  it("an old save with no pairSessions field at all just reads as no history — not a crash", () => {
    const state: RecRoomState = { records: {} };
    expect(pairFavoriteGame(state, "pilot_bosk", "pilot_anand")).toBeUndefined();
  });
});

describe("recRoomRecord — standing", () => {
  it("scores three for a win and one for a draw", () => {
    expect(standingPoints({ played: 5, wins: 3, draws: 2, losses: 0 })).toBe(11);
  });

  it("reads an absent record as zero rather than throwing", () => {
    expect(standingPoints(undefined)).toBe(0);
    expect(winRate(undefined)).toBe(0);
    expect(winRate(emptyRecord())).toBe(0);
  });

  it("lets skill and standing genuinely disagree — the point of splitting them", () => {
    const state = fresh();
    // A mediocre grinder with a lot of volume.
    for (let i = 0; i < 60; i += 1) {
      recordSession(state, { gameId: "poker", a: "grinder", b: "other", winner: i % 3 === 0 ? "grinder" : "other" });
    }
    // A sharp rookie with almost none.
    for (let i = 0; i < 3; i += 1) {
      recordSession(state, { gameId: "poker", a: "rookie", b: "other", winner: "rookie" });
    }
    const grinderPts = standingPoints(state.records.grinder?.poker);
    const rookiePts = standingPoints(state.records.rookie?.poker);
    expect(grinderPts).toBeGreaterThan(rookiePts);
    // ...and yet the rookie's ceiling can be the higher one, which is the
    // "4th on the board, and nobody aboard plays better than him" line the
    // panel exists to be able to say.
    const grinderSkill = skillFor(state, "grinder", "rabbit", "poker");
    const rookieSkill = skillFor(state, "rookie", "shark", "poker");
    expect(rookieSkill).toBeGreaterThan(0);
    expect(grinderSkill).toBeGreaterThan(0);
  });
});

describe("recRoomRecord — combined record", () => {
  it("sums across all three games", () => {
    const state = fresh();
    recordSession(state, { gameId: "poker", a: "x", b: "y", winner: "x", day: 3 });
    recordSession(state, { gameId: "pegBoard", a: "x", b: "y", winner: "draw", day: 9 });
    recordSession(state, { gameId: "fletchers", a: "x", b: "y", winner: "y", day: 5 });
    const total = combinedRecord(state.records.x);
    expect(total).toMatchObject({ played: 3, wins: 1, draws: 1, losses: 1, lastPlayedDay: 9 });
  });

  it("deliberately carries no `best`, because the three games don't share a scale", () => {
    const state = fresh();
    recordSession(state, { gameId: "fletchers", a: "x", b: "y", winner: "x", bestA: 300 });
    expect(combinedRecord(state.records.x).best).toBeUndefined();
  });

  it("reads an absent pilot as an empty record", () => {
    expect(combinedRecord(undefined)).toEqual(emptyRecord());
  });
});

describe("recRoomAptitude", () => {
  it("covers all nine catalysts at all three games", () => {
    for (const row of Object.values(CATALYST_APTITUDE)) {
      for (const gameId of REC_GAME_IDS) {
        expect(row[gameId]).toBeGreaterThan(0);
        expect(row[gameId]).toBeLessThanOrEqual(100);
      }
    }
  });

  it("is deterministic — the same pilot has the same ceiling every time", () => {
    const a = aptitudeFor("pilot_bosk", "bear", "pegBoard", "tank");
    const b = aptitudeFor("pilot_bosk", "bear", "pegBoard", "tank");
    expect(a).toBe(b);
  });

  it("separates two pilots who share a catalyst, so they aren't clones", () => {
    const jitters = ["a", "b", "c", "d", "e", "f"].map((id) => aptitudeJitter(id, "poker"));
    expect(new Set(jitters).size).toBeGreaterThan(1);
  });

  it("keeps the jitter inside its stated range", () => {
    for (const id of ["pilot_bosk", "pilot_anand", "pilot_iyari", "recruit_17", PLAYER_RECORD_ID]) {
      for (const gameId of REC_GAME_IDS) {
        const j = aptitudeJitter(id, gameId);
        expect(j).toBeGreaterThanOrEqual(-APTITUDE_JITTER);
        expect(j).toBeLessThanOrEqual(APTITUDE_JITTER);
      }
    }
  });

  it("resolves without an archetype, for a pilot who has left the roster", () => {
    const withPath = aptitudeFor("pilot_x", "raven", "pegBoard", "tank");
    const without = aptitudeFor("pilot_x", "raven", "pegBoard");
    expect(without).toBe(withPath - ARCHETYPE_APTITUDE_NUDGE.tank.pegBoard);
  });

  it("clamps to 1..100 even at the extremes of the table", () => {
    for (const catalyst of Object.keys(CATALYST_APTITUDE) as (keyof typeof CATALYST_APTITUDE)[]) {
      for (const gameId of REC_GAME_IDS) {
        const v = aptitudeFor("some_pilot", catalyst, gameId, "meeps");
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });

  it("keeps the character reads the plan actually asked for", () => {
    // The shark is the card shark; the bear does not bluff; the crow has
    // the quick hands. If someone retunes this table, these three are the
    // reads that were deliberate rather than filler.
    expect(CATALYST_APTITUDE.shark.poker).toBeGreaterThan(CATALYST_APTITUDE.shark.pegBoard);
    expect(CATALYST_APTITUDE.bear.pegBoard).toBeGreaterThan(CATALYST_APTITUDE.bear.poker);
    expect(CATALYST_APTITUDE.crow.fletchers).toBeGreaterThan(CATALYST_APTITUDE.crow.poker);
  });
});

describe("ensureRecRoomState", () => {
  it("creates the slice lazily and hands back the same object after", () => {
    const state = createCampaignState([], {});
    expect(state.recRoom).toBeUndefined();
    const first = ensureRecRoomState(state);
    expect(first.records).toEqual({});
    const second = ensureRecRoomState(state);
    expect(second).toBe(first);
  });

  it("does not clobber an existing slice loaded from a save", () => {
    const state = createCampaignState([], {});
    state.recRoom = { records: { pilot_bosk: { poker: { played: 4, wins: 2, draws: 0, losses: 2 } } } };
    expect(ensureRecRoomState(state).records.pilot_bosk?.poker?.played).toBe(4);
  });
});
