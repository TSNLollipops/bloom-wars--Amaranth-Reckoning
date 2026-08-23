// src/data/campaignAmaranth.ts
// "The Amaranth Reckoning" — Act I: The Fallow Line, missions 1-8 (of the
// act's 12; the full 36-mission campaign concept is design-only for now —
// see claude/Bloom_Wars_Independent_Campaign_The_Amaranth_Reckoning.md /
// design/Bloom_Wars_The_Amaranth_Reckoning.docx §Appendix C: "Build Act 1
// first as its own small vertical slice"). Independent, non-canon, parallel
// continuity to the Team One slice in data/campaign.ts — different roster,
// different maps, same engine, same objective types (§3: "Act I: no new
// systems" — missions 5-8 stayed true to that: extract_unit/eliminate_all/
// hold_zone all already existed, so this stayed a content pass, same as
// 1-4). Missions 9-12 (Cut Off's new Survive N Turns objective type, the
// Amaranth Betrayal, the Long Walk Back, and the act finale where Bosk's
// scripted death is only a plan under §6a's permadeath rule) aren't built
// yet.
//
// Warden Company doesn't have that name yet at this point in the story —
// it's still just Rourke's five-mech lance holding a stretch of the Fallow
// Line alongside a House Amaranth detachment (§Act I flavour text). Kept
// the same roster array name regardless, since "Warden Company" is what
// this file will keep being called even after the in-fiction renaming in
// Act II — see the design doc's own note that the unit keeps a name it
// technically hasn't earned yet, on purpose, on both sides of that line.
import type { CampaignMission, MekArchetype, PilotRecord } from "./types";

// ---- Roster (§6): five pilots, all tier G, no Heirloom charge until the
// scripted unlock at Mission 12 (§9, §10 squad-scaling table) — every
// mission in this file ships heirloomCharge: "locked" accordingly.
export const WARDEN_PILOTS: PilotRecord[] = [
  {
    id: "pilot_rourke",
    displayName: "2nd Lt. Dessa Rourke — “Lark”",
    archetypeId: "arch_meeps_bipedal",
    mekId: "mek_rourke",
    tier: "G",
    // "No plot armor except Rourke" — Maxime, asked directly whether the
    // live Munti-presence permadeath check (engine/campaignState.ts)
    // applies to every named pilot including Bosk's scripted Act 1 finale:
    // "for bosk and the scripted death. yeah." Then, naming the one
    // exception: "the only character that is safe is the mc." Rourke is
    // the protagonist; every other pilot, named or generated, plays for
    // keeps. See claude/Bloom_Wars_Spitball_Ideas.md.
    exemptFromPermadeath: true,
  },
  {
    id: "pilot_bosk",
    displayName: "M.Sgt. Halvard Bosk — “Anvil”",
    archetypeId: "arch_tank_bipedal",
    mekId: "mek_bosk",
    tier: "G",
  },
  {
    id: "pilot_iyari",
    displayName: "Pvt. Tegan Iyari — “Foxfire”",
    archetypeId: "arch_meeps_centauroid", // Hiopi/centauroid, per §6
    mekId: "mek_iyari",
    tier: "G",
  },
  {
    id: "pilot_anand",
    displayName: "Cpl. Priya Anand — “Farsight”",
    archetypeId: "arch_reeps_vibrissal", // Osnian/vibrissal, per §6 — the
    // squad's first vibrissal pilot in this codebase (Team One's roster
    // has none); carries abil_sensor_sweep from the archetype automatically.
    mekId: "mek_anand",
    tier: "G",
  },
  {
    id: "pilot_lask",
    displayName: "Spec. Corin Lask — “Patch”",
    archetypeId: "arch_munti_bipedal",
    mekId: "mek_lask",
    tier: "G",
  },
];

// Track assignments are a build-time call (§6 doesn't specify meks), chosen
// to read consistently with the roster's own description: Bosk (the
// mentor, holds the line) and Iyari (young, aggressive melee) get Armorer's
// flat stat bump; Rourke (the lead, "quick") and Anand ("the squad's eyes")
// both get Runemaster's vision bonus — Team One's own roster already
// doubles up on Runemaster the same way (Nagori and Tourignie), so this
// isn't a new pattern; Lask (the fragile centre everyone organizes around)
// gets Fieldwright, exactly like Team One's Munti (Barasj).
export const WARDEN_MEKS: Record<string, MekArchetype> = {
  mek_rourke: { id: "mek_rourke", displayName: "Rourke's Mek", primary: "runemaster", secondary: null, spareParts: 0 },
  mek_bosk: { id: "mek_bosk", displayName: "Bosk's Mek", primary: "armorer", secondary: null, spareParts: 0 },
  mek_iyari: { id: "mek_iyari", displayName: "Iyari's Mek", primary: "armorer", secondary: null, spareParts: 0 },
  mek_anand: { id: "mek_anand", displayName: "Anand's Mek", primary: "runemaster", secondary: null, spareParts: 0 },
  mek_lask: { id: "mek_lask", displayName: "Lask's Mek", primary: "fieldwright", secondary: null, spareParts: 0 },
};

const WARDEN_ROSTER_IDS = WARDEN_PILOTS.map((p) => p.id);

export const AMARANTH_MISSION_1: CampaignMission = {
  id: "mission_amaranth_1",
  displayName: "Amaranth I.1 — Muster",
  mapId: "map_amaranth_muster",
  briefing:
    "First light on the Fallow Line. Nothing's moved in four days but paperwork. Command wants a muster sweep to shake the cobwebs out before anyone gets comfortable. Five up, Lieutenant. Anything Bloom, you put it down.",
  objective: "eliminate_all",
  objectiveParams: { turnLimit: 8 },
  playerPilotIds: WARDEN_ROSTER_IDS,
  enemyWaves: [{ archetypeId: "bloom_crawlmass", count: 6, atTurn: 1, spawnAt: "enemy_deploy" }],
  events: [],
  rewardPoints: 100,
  heirloomCharge: "locked",
};

export const AMARANTH_MISSION_2: CampaignMission = {
  id: "mission_amaranth_2",
  displayName: "Amaranth I.2 — Wire and Mud",
  mapId: "map_amaranth_wire_and_mud",
  briefing:
    "Forward listening post at grid Whiskey-Nine is calling in movement in the wire. Hold the post until the survey detail clears — six turns, then you're stood down. There's exactly one way in or out of that room. Mind the doorway.",
  objective: "hold_zone",
  objectiveParams: { turnLimit: 10, holdUntilTurn: 6 },
  playerPilotIds: WARDEN_ROSTER_IDS,
  enemyWaves: [
    { archetypeId: "bloom_splitfang", count: 3, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "bloom_splitfang", count: 3, atTurn: 3, spawnAt: "enemy_deploy" },
  ],
  events: [],
  rewardPoints: 130,
  heirloomCharge: "locked",
};

export const AMARANTH_MISSION_3: CampaignMission = {
  id: "mission_amaranth_3",
  displayName: "Amaranth I.3 — The Low Ground",
  mapId: "map_amaranth_the_low_ground",
  briefing:
    "Bloom mat came up through the low terraces overnight — a supply detail was caught crossing at first light. Command wants the ground burned clean and the detail's fate confirmed. Nothing to be clever about; go through it.",
  objective: "eliminate_all",
  objectiveParams: { turnLimit: 12 },
  playerPilotIds: WARDEN_ROSTER_IDS,
  enemyWaves: [
    { archetypeId: "bloom_crawlmass", count: 8, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "bloom_splitfang", count: 2, atTurn: 1, spawnAt: "enemy_deploy" },
  ],
  events: [
    {
      id: "ev_low_ground_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Anand: “Mat's still warm. Whatever did this hasn't gone far.”" },
      once: true,
    },
  ],
  rewardPoints: 150,
  heirloomCharge: "locked",
};

export const AMARANTH_MISSION_4: CampaignMission = {
  id: "mission_amaranth_4",
  displayName: "Amaranth I.4 — Tunnel Rats",
  mapId: "map_amaranth_tunnel_rats",
  briefing:
    "First burrower contact on the Line. Command's calling it Undertow — spined, blind, hunts by vibration. Cpl. Anand's sensor package should keep you off the surprise end of it. Clear the ruin.",
  objective: "eliminate_all",
  objectiveParams: { turnLimit: 12 },
  playerPilotIds: WARDEN_ROSTER_IDS,
  enemyWaves: [
    {
      // Explicit coords rather than "enemy_deploy", so the two Undertow
      // that start deep inside the ruin and the one outside it stay put
      // exactly where the grid draws its seams. Moved with the map when
      // Tunnel Rats was enlarged 18x11 -> 24x15 (23 Aug 2026,
      // data/mapsAmaranth.ts's enlargement-pass header): the interior
      // seams are the "SS" pair at row 7 of that grid, the third is the
      // east seam on the same row.
      archetypeId: "bloom_undertow",
      count: 3,
      atTurn: 1,
      spawnAt: [
        { x: 8, y: 7 },
        { x: 9, y: 7 },
        { x: 23, y: 7 },
      ],
      burrowed: true,
    },
    { archetypeId: "bloom_crawlmass", count: 4, atTurn: 1, spawnAt: "enemy_deploy" },
  ],
  events: [],
  rewardPoints: 160,
  heirloomCharge: "locked",
};

export const AMARANTH_MISSION_5: CampaignMission = {
  id: "mission_amaranth_5",
  displayName: "Amaranth I.5 — Foraging Party",
  mapId: "map_amaranth_foraging_party",
  briefing:
    "Salvage detail hit a wrecked supply cache past the wire and stopped answering the hourly check-in. Get out there, confirm what's left, and get everyone back through the gap before the Bloom that's already circling it closes the door. Anand's on point — she's the one who has to make it to the treeline.",
  objective: "extract_unit",
  // First extraction mission — the design doc's own note (Independent
  // Campaign §Act I, mission 5): "restock-not-death tested for real." The
  // extraction target (Anand) failing to reach the exit is a mission loss
  // outright, same as Team One's own mission_3 precedent — the real test
  // of the live Munti-gated permadeath rule (engine/campaignState.ts) is
  // on the other four, who can go down along the way without ending the
  // mission, but permanently lose the pilot if no Munti is alive to catch
  // them when it happens.
  objectiveParams: { turnLimit: 14, extractUnitId: "pilot_anand" },
  playerPilotIds: WARDEN_ROSTER_IDS,
  enemyWaves: [
    { archetypeId: "bloom_crawlmass", count: 6, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "bloom_splitfang", count: 2, atTurn: 1, spawnAt: "enemy_deploy" },
  ],
  events: [],
  rewardPoints: 170,
  heirloomCharge: "locked",
};

export const AMARANTH_MISSION_6: CampaignMission = {
  id: "mission_amaranth_6",
  displayName: "Amaranth I.6 — House Colors",
  mapId: "map_amaranth_house_colors",
  briefing:
    "House Amaranth's detachment has held the Thane's Crossing checkpoint since before the Line existed. This morning they're not letting anyone through it, ours included, and nobody upstairs will say why. Command wants the crossing open. Try words first, Lieutenant — but be ready for the alternative.",
  objective: "eliminate_all",
  // First mission Warden Company fights something other than the Bloom —
  // House Amaranth's own line troopers, named on purpose (the opposite of
  // §10.1's "quiet-critique discipline" for Team One's Unmarked Mechs; see
  // data/units.ts's AMARANTH_HOSTILE_MECHS comment). Also the design doc's
  // "first distant sighting of Marrow" beat (§7) — kept as a dialogue
  // event rather than a spawned unit, since Marrow doesn't actually engage
  // until Mission 20.
  objectiveParams: { turnLimit: 10 },
  playerPilotIds: WARDEN_ROSTER_IDS,
  enemyWaves: [
    { archetypeId: "hostile_mech_amaranth_01", count: 1, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "hostile_mech_amaranth_02", count: 1, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "hostile_mech_amaranth_03", count: 1, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "hostile_mech_amaranth_04", count: 1, atTurn: 1, spawnAt: "enemy_deploy" },
  ],
  events: [
    {
      id: "ev_house_colors_marrow_sighting",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Anand: “Ridge line, far side, staying well back — not Bloom, not challenging us either. Somebody's watching this happen.”" },
      once: true,
    },
  ],
  rewardPoints: 150,
  heirloomCharge: "locked",
};

export const AMARANTH_MISSION_7: CampaignMission = {
  id: "mission_amaranth_7",
  displayName: "Amaranth I.7 — Sporewatch Ridge",
  mapId: "map_amaranth_sporewatch_ridge",
  briefing:
    "Sporethrower activity building on the ridge south of the Line — spotters are calling it a push, not a probe. Hold the high ground itself, not the approach to it. Command's already learned that lesson somewhere else; now it's ours to learn too.",
  objective: "hold_zone",
  objectiveParams: { turnLimit: 12, holdUntilTurn: 6 },
  playerPilotIds: WARDEN_ROSTER_IDS,
  enemyWaves: [
    { archetypeId: "bloom_sporethrower", count: 2, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "bloom_crawlmass", count: 2, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "bloom_sporethrower", count: 1, atTurn: 3, spawnAt: "enemy_deploy" },
  ],
  events: [],
  rewardPoints: 180,
  heirloomCharge: "locked",
};

export const AMARANTH_MISSION_8: CampaignMission = {
  id: "mission_amaranth_8",
  displayName: "Amaranth I.8 — The Choir Sings",
  mapId: "map_amaranth_the_choir_sings",
  briefing:
    "Command's never heard anything like what came over the listening post's feed last night — dozens of voices, all one voice. Whatever it is, it's coordinated, and it's coming down the open ground north of the Line. Don't get spread out.",
  objective: "eliminate_all",
  // Act I's mid-boss (Independent Campaign §8) — the first Bloom encounter
  // built with intelligence: "pack" specifically for its coordination,
  // rather than incidentally (Splitfang already had it; this mission is
  // built to make it matter). No new engine code — see data/bloom.ts's
  // bloom_choir comment.
  objectiveParams: { turnLimit: 14 },
  playerPilotIds: WARDEN_ROSTER_IDS,
  enemyWaves: [
    { archetypeId: "bloom_choir", count: 4, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "bloom_crawlmass", count: 4, atTurn: 1, spawnAt: "enemy_deploy" },
  ],
  events: [],
  rewardPoints: 210,
  heirloomCharge: "locked",
};

export const AMARANTH_ACT1: CampaignMission[] = [
  AMARANTH_MISSION_1,
  AMARANTH_MISSION_2,
  AMARANTH_MISSION_3,
  AMARANTH_MISSION_4,
  AMARANTH_MISSION_5,
  AMARANTH_MISSION_6,
  AMARANTH_MISSION_7,
  AMARANTH_MISSION_8,
];

export const AMARANTH_MISSIONS_BY_ID: Record<string, CampaignMission> = Object.fromEntries(
  AMARANTH_ACT1.map((m) => [m.id, m])
);
