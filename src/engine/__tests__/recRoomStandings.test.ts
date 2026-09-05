// Rec Room Standings & NPC Learning, slice 4 — the ranking rules.
//
// The panel that draws this is a Phaser file and cannot be imported
// outside a browser, which is exactly why every decision about who is
// ahead of whom lives in recRoomRecord.ts instead. This is that half.

import { describe, it, expect } from "vitest";
import {
  buildStandings,
  ordinal,
  recordSession,
  type RecRoomState,
  type StandingsEntrant,
} from "../recRoomRecord";

const CREW: StandingsEntrant[] = [
  { pilotId: "player_rourke", displayName: "Rourke", catalyst: "wolf", isPlayer: true },
  { pilotId: "pilot_bosk", displayName: "Bosk", catalyst: "bear", path: "tank" },
  { pilotId: "pilot_iyari", displayName: "Iyari", catalyst: "crow", path: "meeps" },
  { pilotId: "pilot_anand", displayName: "Anand", catalyst: "raven", path: "reeps" },
];

describe("buildStandings", () => {
  it("says so plainly when nobody has played yet, rather than showing an empty grid", () => {
    const board = buildStandings({ records: {} }, CREW, "fletchers");
    expect(board.rows).toHaveLength(0);
    expect(board.unplayed).toHaveLength(CREW.length);
  });

  it("ranks by points first", () => {
    const state: RecRoomState = { records: {} };
    for (let i = 0; i < 5; i += 1) recordSession(state, { gameId: "fletchers", a: "pilot_bosk", b: "pilot_anand", winner: "pilot_bosk" });
    for (let i = 0; i < 2; i += 1) recordSession(state, { gameId: "fletchers", a: "pilot_iyari", b: "player_rourke", winner: "pilot_iyari" });
    const board = buildStandings(state, CREW, "fletchers");
    expect(board.rows[0].displayName).toBe("Bosk");
    expect(board.rows[0].points).toBe(15);
    expect(board.rows[0].rank).toBe(1);
  });

  it("breaks a points tie on win rate", () => {
    const state: RecRoomState = { records: {} };
    // Bosk: 3 wins from 3. Iyari: 3 wins from 9.
    for (let i = 0; i < 3; i += 1) recordSession(state, { gameId: "poker", a: "pilot_bosk", b: "pilot_anand", winner: "pilot_bosk" });
    for (let i = 0; i < 9; i += 1) {
      recordSession(state, { gameId: "poker", a: "pilot_iyari", b: "pilot_anand", winner: i < 3 ? "pilot_iyari" : "pilot_anand" });
    }
    const board = buildStandings(state, CREW, "poker");
    const names = board.rows.map((r) => r.displayName);
    expect(names.indexOf("Bosk")).toBeLessThan(names.indexOf("Iyari"));
  });

  it("breaks a points-and-rate tie in favour of fewer games played", () => {
    const state: RecRoomState = { records: {} };
    recordSession(state, { gameId: "pegBoard", a: "pilot_bosk", b: "pilot_anand", winner: "pilot_bosk" });
    recordSession(state, { gameId: "pegBoard", a: "pilot_iyari", b: "pilot_anand", winner: "pilot_iyari" });
    recordSession(state, { gameId: "pegBoard", a: "pilot_iyari", b: "player_rourke", winner: "draw" });
    // Bosk 1-0-0 = 3pts from 1. Iyari 1-1-0 = 4pts from 2. Iyari leads on points.
    const board = buildStandings(state, CREW, "pegBoard");
    expect(board.rows[0].displayName).toBe("Iyari");
  });

  it("is a stable sort on name when everything else ties", () => {
    const state: RecRoomState = { records: {} };
    recordSession(state, { gameId: "poker", a: "pilot_anand", b: "outsider", winner: "pilot_anand" });
    recordSession(state, { gameId: "poker", a: "pilot_bosk", b: "outsider", winner: "pilot_bosk" });
    const board = buildStandings(state, CREW, "poker");
    expect(board.rows.map((r) => r.displayName)).toEqual(["Anand", "Bosk"]);
  });

  it("keeps a lost pilot on the board, with the day they were lost", () => {
    const state: RecRoomState = { records: {} };
    recordSession(state, { gameId: "fletchers", a: "pilot_vashti", b: "pilot_bosk", winner: "pilot_vashti", bestA: 151, day: 94 });
    const withDead: StandingsEntrant[] = [
      ...CREW,
      { pilotId: "pilot_vashti", displayName: "Vashti", catalyst: "cat", lost: true, lostOnDay: 94 },
    ];
    const board = buildStandings(state, withDead, "fletchers");
    const vashti = board.rows.find((r) => r.displayName === "Vashti");
    expect(vashti).toBeDefined();
    expect(vashti!.lost).toBe(true);
    expect(vashti!.lostOnDay).toBe(94);
    expect(vashti!.best).toBe(151);
  });

  it("never counts a lost pilot among the crew who haven't played yet", () => {
    const board = buildStandings({ records: {} }, [{ pilotId: "gone", displayName: "Gone", catalyst: "fox", lost: true }], "poker");
    expect(board.unplayed).toEqual([]);
    expect(board.rows).toEqual([]);
  });

  it("ranks the player inline rather than as a special case", () => {
    const state: RecRoomState = { records: {} };
    for (let i = 0; i < 4; i += 1) recordSession(state, { gameId: "poker", a: "player_rourke", b: "pilot_bosk", winner: "player_rourke" });
    const board = buildStandings(state, CREW, "poker");
    expect(board.rows[0].isPlayer).toBe(true);
    expect(board.rows[0].rank).toBe(1);
    expect(board.rows[1].displayName).toBe("Bosk");
  });

  it("names the best player aboard, and that need not be whoever tops the board", () => {
    const state: RecRoomState = { records: {} };
    // Anand (raven, peg-board ceiling 85) grinds a lot of losses...
    for (let i = 0; i < 80; i += 1) {
      recordSession(state, { gameId: "pegBoard", a: "pilot_anand", b: "pilot_iyari", winner: i % 5 === 0 ? "pilot_anand" : "pilot_iyari" });
    }
    const board = buildStandings(state, CREW, "pegBoard");
    expect(board.bestAboard).toBeDefined();
    // Iyari tops the board on points; Anand has the higher live skill,
    // because a raven's peg-board ceiling is far above a crow's and he has
    // 80 sessions of practice behind it.
    expect(board.rows[0].displayName).toBe("Iyari");
    expect(board.bestAboard!.displayName).toBe("Anand");
    expect(board.bestAboard!.rank).toBeGreaterThan(1);
  });

  it("never nominates a dead pilot as the best player aboard", () => {
    const state: RecRoomState = { records: {} };
    for (let i = 0; i < 100; i += 1) recordSession(state, { gameId: "poker", a: "ghost", b: "pilot_bosk", winner: "ghost" });
    recordSession(state, { gameId: "poker", a: "pilot_bosk", b: "pilot_anand", winner: "pilot_bosk" });
    const roster: StandingsEntrant[] = [
      { pilotId: "ghost", displayName: "Ghost", catalyst: "shark", lost: true, lostOnDay: 12 },
      { pilotId: "pilot_bosk", displayName: "Bosk", catalyst: "bear", path: "tank" },
      { pilotId: "pilot_anand", displayName: "Anand", catalyst: "raven", path: "reeps" },
    ];
    const board = buildStandings(state, roster, "poker");
    expect(board.rows[0].displayName).toBe("Ghost");
    expect(board.bestAboard!.displayName).not.toBe("Ghost");
  });

  it("sums all three games on the All tab", () => {
    const state: RecRoomState = { records: {} };
    recordSession(state, { gameId: "poker", a: "pilot_bosk", b: "pilot_anand", winner: "pilot_bosk" });
    recordSession(state, { gameId: "pegBoard", a: "pilot_bosk", b: "pilot_anand", winner: "pilot_bosk" });
    recordSession(state, { gameId: "fletchers", a: "pilot_bosk", b: "pilot_anand", winner: "draw" });
    const board = buildStandings(state, CREW, "all");
    const bosk = board.rows.find((r) => r.displayName === "Bosk")!;
    expect(bosk.played).toBe(3);
    expect(bosk.points).toBe(7);
    expect(bosk.best).toBeUndefined(); // three different scales, no shared "best"
  });

  it("counts someone who has played a different game as still unplayed on this tab", () => {
    const state: RecRoomState = { records: {} };
    recordSession(state, { gameId: "poker", a: "pilot_bosk", b: "pilot_anand", winner: "pilot_bosk" });
    const board = buildStandings(state, CREW, "fletchers");
    expect(board.rows).toHaveLength(0);
    expect(board.unplayed).toContain("Bosk");
  });
});

describe("ordinal", () => {
  it("handles the ordinary cases", () => {
    expect([1, 2, 3, 4, 21, 22, 23].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "21st", "22nd", "23rd"]);
  });
  it("handles the teens, which are the ones that trip this up", () => {
    expect([11, 12, 13, 111, 112, 113].map(ordinal)).toEqual(["11th", "12th", "13th", "111th", "112th", "113th"]);
  });
});
