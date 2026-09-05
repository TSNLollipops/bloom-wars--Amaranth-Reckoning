// One-off, cloud-sandbox-only helper (3 Sep 2026) for verifying the Rec
// Room standings board. NOT part of the shipped game.
//
// Builds on genSave.ts's midgame roster, then plays a few hundred real
// sessions through the actual record store so the board has something
// honest on it, and kills one pilot on a known day so the "a dead pilot
// keeps their row" behaviour is exercised for real rather than asserted
// about an empty table.
import { createWardenCampaignState, integrateSecondLance, integrateThirdLance, ensureNpcSocialState, ensureRecRoomState, applyMissionLosses } from "../../src/engine/campaignState";
import { recordSession, PLAYER_RECORD_ID, skillFor } from "../../src/engine/recRoomRecord";
import { REC_GAME_IDS } from "../../src/data/recRoomAptitude";
import { catalystForPilot } from "../../src/data/npcSeed";
import { UNIT_ARCHETYPES } from "../../src/data/units";
import { resolvePegBoardEncounter, resolvePokerEncounter, resolveFletchersEncounter } from "../../src/engine/socialSim";
import type { Stage } from "../../src/data/ambientLines";
import { writeFileSync } from "fs";

const state = createWardenCampaignState(500);
integrateSecondLance(state);
integrateThirdLance(state);
state.npcSocial = ensureNpcSocialState(state);
state.calendarDay = 118;
const recRoom = ensureRecRoomState(state);

const crew = Object.entries(state.pilots).map(([pilotId, entry]) => ({
  pilotId,
  displayName: entry.pilot.displayName.split("—")[0].trim(),
  catalyst: catalystForPilot(pilotId),
  path: UNIT_ARCHETYPES[entry.pilot.archetypeId]?.path,
}));

const sim = (id: string, name: string, catalyst: ReturnType<typeof catalystForPilot>) => ({ pilotId: id, displayName: name, catalyst, stage: "blooded" as Stage });

// Real sessions through the real resolvers, at each side's real derived skill.
for (let i = 0; i < 400; i += 1) {
  const a = crew[Math.floor(Math.random() * crew.length)];
  let b = crew[Math.floor(Math.random() * crew.length)];
  while (b.pilotId === a.pilotId) b = crew[Math.floor(Math.random() * crew.length)];
  const gameId = REC_GAME_IDS[Math.floor(Math.random() * REC_GAME_IDS.length)];
  const input = {
    pilotA: sim(a.pilotId, a.displayName, a.catalyst),
    pilotB: sim(b.pilotId, b.displayName, b.catalyst),
    bond: 0,
    aCommitted: false,
    bCommitted: false,
    skillA: { [gameId]: skillFor(recRoom, a.pilotId, a.catalyst, gameId, a.path) },
    skillB: { [gameId]: skillFor(recRoom, b.pilotId, b.catalyst, gameId, b.path) },
    rng: Math.random,
  };
  const r = gameId === "pegBoard" ? resolvePegBoardEncounter(input) : gameId === "poker" ? resolvePokerEncounter(input) : resolveFletchersEncounter(input);
  if (!r.winner) continue;
  recordSession(recRoom, {
    gameId,
    a: a.pilotId,
    b: b.pilotId,
    winner: r.winner === "draw" ? "draw" : r.winner === "a" ? a.pilotId : b.pilotId,
    bestA: r.detail?.scoreA,
    bestB: r.detail?.scoreB,
    day: 1 + Math.floor(Math.random() * 110),
  });
}

// The player's own sessions, so the YOU row is real and ranked inline.
for (let i = 0; i < 40; i += 1) {
  const b = crew[Math.floor(Math.random() * crew.length)];
  const gameId = REC_GAME_IDS[Math.floor(Math.random() * REC_GAME_IDS.length)];
  recordSession(recRoom, {
    gameId,
    a: PLAYER_RECORD_ID,
    b: b.pilotId,
    winner: Math.random() < 0.55 ? PLAYER_RECORD_ID : b.pilotId,
    bestA: gameId === "fletchers" ? 120 + Math.floor(Math.random() * 120) : undefined,
    day: 100 + Math.floor(Math.random() * 18),
  });
}

// One real loss, on a real day, so the greyed row and its "lost Day N" are
// exercised through the actual permadeath path rather than hand-written.
const victim = crew.find((c) => c.pilotId !== "pilot_rourke" && (recRoom.records[c.pilotId]?.fletchers?.played ?? 0) > 0) ?? crew[1];
state.calendarDay = 94;
applyMissionLosses(state, [{ pilotId: victim.pilotId, turn: 6, turnsWithoutMunti: 2, muntisDeployed: 1, wasLastMunti: false }], "amaranth_20", "loss");
state.calendarDay = 118;

writeFileSync(new URL("./standings_save.json", import.meta.url), JSON.stringify(state));
console.log("pilots:", Object.keys(state.pilots).length, "| records:", Object.keys(recRoom.records).length, "| lost:", victim.displayName, "on day", state.pilots[victim.pilotId].lostContext?.lostOnDay);
