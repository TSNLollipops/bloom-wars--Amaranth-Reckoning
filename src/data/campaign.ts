// src/data/campaign.ts
// The four-mission vertical slice, transcribed from Data Pack §11 (briefings
// §11.1, mission table §11.2, Mission 1a's collapse event §11.3 verbatim,
// Mission 3's boss adds + extraction failure §11.4).
//
// ev_extraction_failure.action.unitIds was a deliberate placeholder in the
// Data Pack ("the one field you have to fill in yourself"). Filled per
// Canon Pass v1 §C: Trav is the sole survivor; Thyns, Barasj, Nagori and
// Tourignie are lost. Per Canon Pass §C.3 (Maxime, 21 Aug 2026): points
// invested in a lost pilot are NOT carried forward — see engine/campaign
// state handling, which simply drops the PilotRecord (and its tier) along
// with the roster entry. No special-case debrief refund logic.
//
// STATUS NOTE (Canon Pass §J): this slice is being built first as an
// engine/mechanics test pass, not as final campaign content. The real
// campaign missions will be authored separately once the engine is proven.
import type { CampaignMission } from "./types";

export const MISSION_1A: CampaignMission = {
  id: "mission_1a",
  displayName: "1a — The City Sweep",
  mapId: "map_city_sweep_01",
  briefing:
    "Sector's been quiet four days. Command wants it walked. Standard sweep pattern, five up. Anything that moves and isn't us, you put it down.",
  objective: "eliminate_all",
  objectiveParams: { turnLimit: 12 },
  playerPilotIds: ["pilot_thyns", "pilot_barasj", "pilot_nagori", "pilot_tourignie", "pilot_trav"],
  enemyWaves: [
    { archetypeId: "bloom_crawlmass", count: 5, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "bloom_crawlmass", count: 5, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "bloom_splitfang", count: 3, atTurn: 1, spawnAt: "enemy_deploy" },
  ],
  events: [
    {
      id: "ev_collapse_turn",
      trigger: { type: "turn_start", turn: 4 },
      action: {
        type: "spawn",
        archetypeIds: ["hostile_mech_01", "hostile_mech_02", "hostile_mech_03", "hostile_mech_04"],
        at: [
          { x: 9, y: 7 },
          { x: 10, y: 7 },
          { x: 9, y: 8 },
          { x: 11, y: 8 },
        ],
      },
      once: true,
      guardGroup: "collapse",
    },
    {
      id: "ev_collapse_zone",
      trigger: {
        type: "zone_entered",
        zone: [
          { x: 8, y: 7 }, { x: 9, y: 7 }, { x: 10, y: 7 }, { x: 11, y: 7 },
          { x: 8, y: 8 }, { x: 9, y: 8 }, { x: 10, y: 8 }, { x: 11, y: 8 },
        ],
      },
      action: {
        type: "spawn",
        archetypeIds: ["hostile_mech_01", "hostile_mech_02", "hostile_mech_03", "hostile_mech_04"],
        at: [
          { x: 9, y: 7 },
          { x: 10, y: 7 },
          { x: 9, y: 8 },
          { x: 11, y: 8 },
        ],
      },
      once: true,
      guardGroup: "collapse",
    },
  ],
  rewardPoints: 120,
  heirloomCharge: "locked",
};

export const MISSION_1B: CampaignMission = {
  id: "mission_1b",
  displayName: "1b — The Bunker",
  mapId: "map_bunker_01",
  briefing: "Hold the site until the survey team clears out. Six turns. Nothing complicated.",
  objective: "hold_zone",
  objectiveParams: { turnLimit: 10, holdUntilTurn: 6 },
  playerPilotIds: ["pilot_thyns", "pilot_barasj", "pilot_nagori", "pilot_tourignie", "pilot_trav"],
  enemyWaves: [
    { archetypeId: "bloom_crawlmass", count: 4, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "bloom_crawlmass", count: 4, atTurn: 2, spawnAt: "enemy_deploy" },
    { archetypeId: "bloom_splitfang", count: 2, atTurn: 3, spawnAt: "enemy_deploy" },
    { archetypeId: "bloom_splitfang", count: 2, atTurn: 4, spawnAt: "enemy_deploy" },
    { archetypeId: "bloom_gallcyst", count: 1, atTurn: 4, spawnAt: [{ x: 17, y: 11 }] },
  ],
  events: [],
  rewardPoints: 140,
  heirloomCharge: "locked",
};

export const MISSION_2: CampaignMission = {
  id: "mission_2",
  displayName: "2 — The Real Fight",
  mapId: "map_attrition_01",
  briefing: "Heavier concentration than the scans showed. Nothing to be clever about — go through it.",
  objective: "eliminate_all",
  objectiveParams: { turnLimit: 14 },
  playerPilotIds: ["pilot_thyns", "pilot_barasj", "pilot_nagori", "pilot_tourignie", "pilot_trav"],
  enemyWaves: [
    { archetypeId: "bloom_crawlmass", count: 8, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "bloom_splitfang", count: 5, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "bloom_sporethrower", count: 2, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "bloom_sirenmaw", count: 2, atTurn: 1, spawnAt: "enemy_deploy" },
  ],
  events: [],
  rewardPoints: 160,
  heirloomCharge: "visible_capped",
};

export const MISSION_3: CampaignMission = {
  id: "mission_3",
  displayName: "3 — The Sessile Tomb",
  mapId: "map_sessile_tomb",
  briefing: "Deep structure, sessile growth, no movement on any sweep we've run. Survey wants a look inside. In, confirm, out.",
  objective: "extract_unit",
  objectiveParams: { turnLimit: 16, extractUnitId: "pilot_trav" },
  playerPilotIds: ["pilot_thyns", "pilot_barasj", "pilot_nagori", "pilot_tourignie", "pilot_trav"],
  enemyWaves: [
    { archetypeId: "bloom_heartwood", count: 1, atTurn: 1, spawnAt: [{ x: 9, y: 5 }] },
    { archetypeId: "bloom_undertow", count: 4, atTurn: 1, spawnAt: [{ x: 7, y: 3 }, { x: 12, y: 3 }, { x: 7, y: 7 }, { x: 12, y: 7 }], burrowed: true },
    { archetypeId: "bloom_gallcyst", count: 2, atTurn: 1, spawnAt: [{ x: 5, y: 5 }, { x: 14, y: 5 }] },
  ],
  events: [
    {
      id: "ev_heartwood_adds",
      trigger: { type: "turn_start", turn: 3, repeatEvery: 2 },
      action: {
        type: "spawn",
        archetypeIds: ["bloom_undertow", "bloom_undertow"],
        at: [
          { x: 7, y: 10 },
          { x: 12, y: 10 },
        ],
      },
      once: false,
    },
    {
      id: "ev_extraction_failure",
      trigger: { type: "objective_complete" },
      action: {
        type: "remove_from_roster",
        unitIds: ["pilot_thyns", "pilot_barasj", "pilot_nagori", "pilot_tourignie"],
      },
      once: true,
    },
  ],
  rewardPoints: 200,
  heirloomCharge: "available",
};

export const CAMPAIGN: CampaignMission[] = [MISSION_1A, MISSION_1B, MISSION_2, MISSION_3];

export const MISSIONS_BY_ID: Record<string, CampaignMission> = Object.fromEntries(
  CAMPAIGN.map((m) => [m.id, m])
);
