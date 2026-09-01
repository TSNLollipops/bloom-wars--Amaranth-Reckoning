// src/data/campaignHouseAmaranth.ts
// House Amaranth's own campaign -- Bloom_Wars_House_Amaranth_Full_
// Campaign_Plan_v1.md, the real 36-mission plan (31 Aug 2026). Independent
// of data/campaignAmaranth.ts (Warden Company) the same way that file is
// independent of data/campaign.ts (Team One) -- different roster,
// different maps, same engine, sharing the war's timeline rather than
// its own data.
//
// STATUS (updated 31 Aug 2026, same day as the scaffolding pass -- this
// line drifted stale at "ONE real mission" for the whole Act I/II build,
// worth actually correcting each time rather than only at milestones):
// 21 of 36 missions built -- Act I (1-12) and Act II (13-20) complete,
// Act III begun with Mission 21 ("After the Line"). Missions 22-36 are
// NOT stubbed here; inventing placeholder mission data for them would
// just be fabricated content with extra steps. See the plan doc's own §9
// for exactly what's still open before more of this can be written for
// real (room-set naming, the steward's identity, save architecture,
// act/campaign titles -- the supporting cast itself is closed, see the
// roster below and design/
// Bloom_Wars_House_Amaranth_Personalized_Line_Plan_v1.md for the
// catalyst/bond picks that came with it).
//
// Deliberately NOT wired into CAMPAIGNS (data/allCampaigns.ts) -- that
// array is what actually puts a campaign tab in front of a player on the
// mission-select screen, and that's a later step (plan doc §8, step 9),
// not this pass's. IS wired into ALL_MISSIONS_BY_ID / ALL_MAPS /
// pilotRegistry's PILOT_INDEX+MEK_INDEX, the same "resolvable by id, not
// offered in the picker" precedent data/allCampaigns.ts's own header
// already documents for the archived Team One campaign -- that's what
// lets `npm run sim -- mission_house_amaranth_1` actually run tonight.
import type { CampaignMission, MekArchetype, PilotRecord } from "./types";

// ---- Roster ----------------------------------------------------------
// The full five-pilot lance, closed 31 Aug 2026 (Maxime confirmed the
// four-name draft, then: "his starting cast is 2 hiopi meeps a human
// reeps and a osnian munties" -- the composition that fixed each new
// pilot's species/chassis below). Marrow's Tank path means this roster's
// class spread differs from Warden's own five from the start (Rourke's
// squad is deliberately varied around a Meeps lead; here the lead IS the
// odd one out, Tank against four pilots split Meeps/Meeps/Reeps/Munti) --
// not a gap, just a different-shaped unit by design.
export const HOUSE_AMARANTH_PILOTS: PilotRecord[] = [
  {
    id: "pilot_marrow",
    displayName: "Col. Ysolde Marrow",
    // Tank -- resolved 31 Aug 2026 via AskUserQuestion ("as proposed").
    // arch_tank_bipedal, not centauroid/vibrissal: no chassis/species was
    // ever specified for her, and bipedal/human is Warden Company's own
    // default read for an unspecified pilot (Rourke, Anand's squadmates
    // etc. all default there absent a stated reason otherwise) -- see
    // campaignAmaranth.ts's own WARDEN_PILOTS for the precedent.
    archetypeId: "arch_tank_bipedal",
    mekId: "mek_marrow",
    tier: "G",
    // Protagonist, exempt from permadeath -- direct analogy to Rourke
    // (campaignAmaranth.ts's own WARDEN_PILOTS comment: "the only
    // character that is safe is the mc"). Confirmed 31 Aug 2026: Maxime
    // described Marrow as this campaign's own 1:1 mirror to Rourke.
    exemptFromPermadeath: true,
  },
  {
    id: "pilot_vondra",
    displayName: "Sgt. Petra Vondra — “Ironrow”",
    // Hiopi/centauroid, per Maxime's "2 hiopi meeps" -- same chassis/
    // species pairing as Iyari/Tarrant in campaignAmaranth.ts.
    archetypeId: "arch_meeps_centauroid",
    mekId: "mek_vondra",
    tier: "G",
  },
  {
    id: "pilot_meir",
    displayName: "Cpl. Jonas Meir — “Sparrow”",
    archetypeId: "arch_meeps_centauroid", // Hiopi/centauroid, the second of the two
    mekId: "mek_meir",
    tier: "G",
  },
  {
    id: "pilot_bray",
    displayName: "S.Sgt. Callum Bray — “Deadfall”",
    archetypeId: "arch_reeps_bipedal", // human, per "a human reeps"
    mekId: "mek_bray",
    tier: "G",
  },
  {
    id: "pilot_orin",
    displayName: "Cpl. Nessa Orin — “Quill”",
    archetypeId: "arch_munti_vibrissal", // Osnian/vibrissal, per "a osnian munties" -- same pairing as Anand/Vashti
    mekId: "mek_orin",
    tier: "G",
  },
];

// Track assignments, same build-time-call discipline campaignAmaranth.ts's
// own WARDEN_MEKS/SECOND_LANCE_MEKS comments use: Marrow gets Armorer,
// mirroring Bosk's own Tank-path track ("the mentor, holds the line").
// Vondra (the actual squad lead in practice, "runs the room") gets
// Runemaster, same vision-track read Rourke's own lead-Meeps pick already
// carries. Meir (young, aggressive-by-conviction) gets Armorer, same as
// Iyari's own young/aggressive Meeps precedent. Bray (the marksman) gets
// Runemaster, matching Solheim's own "a sharpshooter's own instinct"
// reasoning for the same track. Orin (the Munti) gets Fieldwright, same
// track every single Munti in either existing roster carries (Lask,
// Vashti) -- no exception invented here either.
export const HOUSE_AMARANTH_MEKS: Record<string, MekArchetype> = {
  mek_marrow: { id: "mek_marrow", displayName: "Marrow's Mek", primary: "armorer", secondary: null, spareParts: 0 },
  mek_vondra: { id: "mek_vondra", displayName: "Vondra's Mek", primary: "runemaster", secondary: null, spareParts: 0 },
  mek_meir: { id: "mek_meir", displayName: "Meir's Mek", primary: "armorer", secondary: null, spareParts: 0 },
  mek_bray: { id: "mek_bray", displayName: "Bray's Mek", primary: "runemaster", secondary: null, spareParts: 0 },
  mek_orin: { id: "mek_orin", displayName: "Orin's Mek", primary: "fieldwright", secondary: null, spareParts: 0 },
};

export const HOUSE_AMARANTH_ROSTER_IDS = HOUSE_AMARANTH_PILOTS.map((p) => p.id);

// ---- Second Lance (Act II opening) --------------------------------------
// Maxime, 31 Aug 2026, mid-Mission-16-build: "are act 2 mission setup for
// 10 mech. 2 lance... look at warden side." Checked directly -- they
// weren't. campaignAmaranth.ts's own precedent (SECOND_LANCE_PILOTS/
// SECOND_LANCE_MEKS + ACT2_DEFAULT_SQUAD, WARDEN_ROSTER_IDS ++
// SECOND_LANCE_ROSTER_IDS, all 10 deployed from Act II's own first
// mission on) is the pattern this mirrors -- five newly-named pilots
// (renamed here with a HOUSE_AMARANTH_ prefix, since this file's plain
// SECOND_LANCE_* would otherwise collide with campaignAmaranth.ts's own
// exports of the same name the moment both land in
// data/pilotRegistry.ts), same "hand-authored, not randomly generated"
// discipline as Warden's own (the random-recruit path,
// generateRandomRescuedPilot, is a SEPARATE mechanic layered on top via
// rescue_pilot bonus objectives, not how a scripted lance itself gets
// named). A deliberately different path spread from the first lance
// (Tank1/Meeps2/Reeps1/Munti1), same "the two lances aren't
// interchangeable" reasoning Warden's own SECOND_LANCE_PILOTS
// comment gives: this lance runs Tank1/Meeps1/Reeps2/Munti1, so the
// combined 10-pilot roster lands Tank2/Meeps3/Reeps3/Munti2 -- a second
// Munti, same as Warden's own combined roster, meaning a squad can for
// the first time choose two healers or none. Chassis/species picked for
// contrast against the first lance's own pairings (Marrow/Bray human-
// bipedal, Vondra/Meir hiopi-centauroid, Orin osnius-vibrissal) rather
// than repeating them outright. All five names checked against every
// existing displayName in data/*.ts before picking, no collisions.
//
// NOT yet wired into engine/campaignState.ts -- unlike Warden Company,
// House Amaranth's own campaign has no CampaignState/save integration at
// all yet (confirmed via direct grep: campaignState.ts never references
// this file). That's this file's own STATUS comment's "later step, plan
// doc §8 step 9" -- the actual `integrateSecondLance`-style function,
// the rescue_pilot recruit mechanic, and the Hub/mission-select wiring
// all land together in that pass, not piecemeal here. What DOES land now:
// the pilot/mek data itself (same "resolvable by id, not yet offered in
// a picker" precedent this file's own header already sets for the whole
// campaign) and HOUSE_AMARANTH_ACT2_DEFAULT_SQUAD below, which Missions
// 13-16 are retuned onto in this same pass -- mirroring
// campaignAmaranth.ts's own ACT2_DEFAULT_SQUAD, which every Warden Act II
// mission deploys in full from its own first mission on, not partway in.
export const HOUSE_AMARANTH_SECOND_LANCE_PILOTS: PilotRecord[] = [
  {
    id: "pilot_kessler",
    displayName: "Sgt. Rutger Kessler — “Tallgrass”",
    archetypeId: "arch_tank_bipedal",
    mekId: "mek_kessler",
    tier: "G",
  },
  {
    id: "pilot_vantana",
    displayName: "Cpl. Imara Vantana — “Windbreak”",
    archetypeId: "arch_meeps_vibrissal", // Osnius/vibrissal -- contrast with Vondra/Meir's hiopi-centauroid
    mekId: "mek_vantana",
    tier: "G",
  },
  {
    id: "pilot_reyken",
    displayName: "Spec. Toma Reyken — “Longshadow”",
    archetypeId: "arch_reeps_centauroid", // Hiopi/centauroid
    mekId: "mek_reyken",
    tier: "G",
  },
  {
    id: "pilot_solano",
    displayName: "Cpl. Adaeze Solano — “Backfurrow”",
    archetypeId: "arch_reeps_bipedal", // Human/bipedal, the lance's second Reeps
    mekId: "mek_solano",
    tier: "G",
  },
  {
    id: "pilot_marrin",
    displayName: "Sgt. Ondine Marrin — “Greenhand”",
    archetypeId: "arch_munti_centauroid", // Hiopi/centauroid -- contrast with Orin's osnius-vibrissal
    mekId: "mek_marrin",
    tier: "G",
  },
];

// Track assignments, same discipline as HOUSE_AMARANTH_MEKS above and
// campaignAmaranth.ts's own SECOND_LANCE_MEKS precedent: Kessler (Tank)
// gets Armorer, matching Marrow's own track. Vantana and Reyken (the
// lance's ranged-leaning pair, Meeps/Reeps) split Runemaster/Fabricator --
// Vantana takes Runemaster (matching Vondra's own lead-Meeps vision-track
// pick), Reyken takes Fabricator (a scavenger's track, matching Warden's
// own Reyes precedent, not yet used anywhere in this roster). Solano
// (the second Reeps) gets Runemaster too, matching Bray's own sharp-
// shooter's-instinct reasoning. Marrin (the second Munti) gets
// Fieldwright, same as every Munti in either roster so far.
export const HOUSE_AMARANTH_SECOND_LANCE_MEKS: Record<string, MekArchetype> = {
  mek_kessler: { id: "mek_kessler", displayName: "Kessler's Mek", primary: "armorer", secondary: null, spareParts: 0 },
  mek_vantana: { id: "mek_vantana", displayName: "Vantana's Mek", primary: "runemaster", secondary: null, spareParts: 0 },
  mek_reyken: { id: "mek_reyken", displayName: "Reyken's Mek", primary: "fabricator", secondary: null, spareParts: 0 },
  mek_solano: { id: "mek_solano", displayName: "Solano's Mek", primary: "runemaster", secondary: null, spareParts: 0 },
  mek_marrin: { id: "mek_marrin", displayName: "Marrin's Mek", primary: "fieldwright", secondary: null, spareParts: 0 },
};

export const HOUSE_AMARANTH_SECOND_LANCE_ROSTER_IDS = HOUSE_AMARANTH_SECOND_LANCE_PILOTS.map((p) => p.id);

// Act II's own static playerPilotIds default, same role and same
// discipline as campaignAmaranth.ts's own ACT2_DEFAULT_SQUAD: a full
// 10-pilot deploy from Act II's first mission on, no bench, read by
// `npm run sim`/tests/any direct `new Mission(missionDef)` call with no
// deployRoster -- a real playthrough (once this campaign is wired into
// scenes/TransporterPad.ts) reads the live roster instead, not this.
export const HOUSE_AMARANTH_ACT2_DEFAULT_SQUAD = [...HOUSE_AMARANTH_ROSTER_IDS, ...HOUSE_AMARANTH_SECOND_LANCE_ROSTER_IDS];

// ---- Missions ----------------------------------------------------------

// Mission 1, "First Harvest" (Act I -- Harvest Ground, plan doc §6). A
// Crawlmass drift wanders onto an ordinary ward-crop terrace's bloom_mat
// patch before anything else is wrong -- the same low-tier swarm and
// eliminate_all shape Warden's own Mission 1 ("Muster") opens on. Grew
// from a solo Marrow deployment (last night's scaffolding pass, when the
// squad didn't exist yet) to the real five-pilot lance the moment the
// supporting cast was named -- "establishes the command staff" now
// actually establishes all five, matching Muster's own role for Warden's
// five. Enemy count re-tuned and re-sim-tested for the new squad size
// below (last night's solo tuning -- 1 Crawlmass, 30/30 -- doesn't apply
// once four more pilots are in the fight).
export const HOUSE_AMARANTH_MISSION_1: CampaignMission = {
  id: "mission_house_amaranth_1",
  displayName: "House Amaranth I.1 — First Harvest",
  mapId: "map_house_amaranth_first_harvest",
  briefing:
    "Nothing that hasn't happened before. A Bloom drift wandered onto the north terrace overnight and settled into the crop the way they always do -- slow, stupid, easy, if you don't let it sit. Colonel wants her whole staff to know how a quiet morning runs, before there stops being any other kind.",
  objective: "eliminate_all",
  objectiveParams: { turnLimit: 8 },
  playerPilotIds: HOUSE_AMARANTH_ROSTER_IDS,
  enemyWaves: [{ archetypeId: "bloom_crawlmass", count: 11, atTurn: 1, spawnAt: "enemy_deploy" }],
  events: [],
  rewardPoints: 100,
  heirloomCharge: "locked",
};

// Mission 2, "The Long Contract" (Act I -- Harvest Ground, plan doc §6).
// The diversion relay itself, defended for the first time -- "the
// bargain's actual machinery, shown for the first time." Map reuses
// Warden Mission 2's own proven walled-relay-room/single-doorway
// geometry (mapsHouseAmaranth.ts's own comment on why that's not the
// same as reusing content). Enemy choice/wave shape started from Warden
// Mission 2's own ORIGINAL pre-tuning numbers (bloom_splitfang, 3+3,
// turnLimit 10/holdUntilTurn 6 -- before that mission's later doubling
// pass) as a reasonable first guess for a comparably-sized squad, then
// actually sim-tested rather than assumed to still fit a differently-
// shaped five (1 Tank/2 Meeps/1 Reeps/1 Munti here vs. Warden's 2 Meeps/
// 1 Tank/1 Reeps/1 Munti) — see the verification note in the build log
// addendum for the real batch numbers.
export const HOUSE_AMARANTH_MISSION_2: CampaignMission = {
  id: "mission_house_amaranth_2",
  displayName: "House Amaranth I.2 — The Long Contract",
  mapId: "map_house_amaranth_the_long_contract",
  briefing:
    "The relay room, cut straight into the old grain store -- this is the whole bargain, boiled down to conduit and casing. Command wants it held clean for the auditors coming through next week. There's exactly one door. Mind it.",
  objective: "hold_zone",
  objectiveParams: { turnLimit: 10, holdUntilTurn: 6 },
  playerPilotIds: HOUSE_AMARANTH_ROSTER_IDS,
  enemyWaves: [
    { archetypeId: "bloom_splitfang", count: 3, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "bloom_splitfang", count: 3, atTurn: 3, spawnAt: "enemy_deploy" },
  ],
  events: [],
  rewardPoints: 110,
  heirloomCharge: "locked",
};

// Mission 3, "Second Harvest" (Act I -- Harvest Ground, plan doc §6). A
// ward-crop survey team is cut off when a drift runs heavier than
// predicted -- House Amaranth's first extraction, same beat Warden's own
// Mission 5 ("Restock, Not Rescue") plays first for their side. Map reuses
// that mission's own proven open-field/deploy-west-exit-east shape
// (mapsHouseAmaranth.ts's own comment on why that's not the same as
// reusing content). Extraction target: Orin, the Fieldwright -- the
// survey team's own hands-on specialist, same track Warden's Lask/Vashti
// already carry as extract_unit targets in that campaign. turnLimit 14
// matches Warden Mission 5's own number for a comparably-sized open-field
// extraction before any sim-specific retuning; enemy wave started as a
// direct read of that mission's own opening composition (6 Crawlmass + 2
// Splitfang) and actually sim-tested below rather than assumed to transfer
// — see the verification note in the build log addendum for the real
// batch numbers.
export const HOUSE_AMARANTH_MISSION_3: CampaignMission = {
  id: "mission_house_amaranth_3",
  displayName: "House Amaranth I.3 — Second Harvest",
  mapId: "map_house_amaranth_second_harvest",
  briefing:
    "Survey team's two hours overdue and the last check-in wasn't good. The drift out past the south terrace ran heavier than anyone called it -- Orin's still out there with what she's mapped. Get to her before the field closes behind her.",
  objective: "extract_unit",
  objectiveParams: { turnLimit: 14, extractUnitId: "pilot_orin" },
  playerPilotIds: HOUSE_AMARANTH_ROSTER_IDS,
  enemyWaves: [
    { archetypeId: "bloom_crawlmass", count: 6, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "bloom_splitfang", count: 2, atTurn: 1, spawnAt: "enemy_deploy" },
  ],
  events: [],
  rewardPoints: 130,
  heirloomCharge: "locked",
};

// Mission 4, "Good Neighbors" (Act I -- Harvest Ground, plan doc §6). First
// contact with Warden Company patrols on the shared border -- wary,
// correct, unfriendly. A fresh map, not a borrowed one (mapsHouseAmaranth.ts's
// own comment on why) -- its whole point is the border-checkpoint road the
// lance fights alongside, not across. Still Bloom vs. the lance mechanically
// (the engine has one hostile faction); the Warden patrol is dialogue color,
// not a second combatant. Enemy composition read directly off Mission 1's
// own numbers (Crawlmass, no Splitfang yet) since nothing in the plan doc's
// pitch calls for a harder fight here -- the tension is the encounter itself,
// not the difficulty -- then sim-tested per house rule, not assumed.
export const HOUSE_AMARANTH_MISSION_4: CampaignMission = {
  id: "mission_house_amaranth_4",
  displayName: "House Amaranth I.4 — Good Neighbors",
  mapId: "map_house_amaranth_good_neighbors",
  briefing:
    "Same drift, same terrace, except this one's crawled right up to the checkpoint road -- and Warden Company's own patrol is standing the other side of it, watching. Clear it clean. Whatever they report back, let it be that House Amaranth handles its own ground.",
  objective: "eliminate_all",
  objectiveParams: { turnLimit: 10 },
  playerPilotIds: HOUSE_AMARANTH_ROSTER_IDS,
  enemyWaves: [{ archetypeId: "bloom_crawlmass", count: 10, atTurn: 1, spawnAt: "enemy_deploy" }],
  events: [
    {
      id: "ev_good_neighbors_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Vondra: “Warden Company's watching from the road. Not moving to help. Not moving to stop us either.”" },
      once: true,
    },
  ],
  rewardPoints: 120,
  heirloomCharge: "locked",
};

// Mission 5, "The Seal Arrives" (Act I -- Harvest Ground, plan doc §6). A
// House officer holding Halcyon's seal visits for a muster; Marrow has to
// make it look easy. Map reuses Warden Mission 7's ("Sporewatch Ridge")
// proven ridge-dais hold_zone shape (mapsHouseAmaranth.ts's own comment on
// why that's not the same as reusing content) -- deliberate shape variety
// from this campaign's own Mission 2. Enemy composition started from
// Mission 2's own tested numbers (bloom_splitfang 3+3) as the nearest
// same-objective precedent, turnLimit/holdUntilTurn matched to the map's
// own larger hold zone (12 hold tiles vs. Mission 2's own 20 -- a smaller
// interior, so a slightly shorter hold), then sim-tested per house rule.
//
// Re-tuned 31 Aug 2026, same day: first-pass 3+3 sim-verified honestly
// (100/100 clean win), then Maxime checked the actual battle log rather
// than trusting the number alone, confirmed it was real engagement (the
// squad closing distance and fighting at the ridge wall by turn 2, not a
// perception/pathing bug) and not a vision/AI-blindness issue -- just too
// few Splitfang for a 5-pilot squad's own per-hit damage to survive
// contact with. His own call once that was confirmed: "add 1 more
// splitfang per wave. i want the player to feel it." 3+3 -> 4+4 below; see
// this session's own build log addendum for the re-batch numbers.
export const HOUSE_AMARANTH_MISSION_5: CampaignMission = {
  id: "mission_house_amaranth_5",
  displayName: "House Amaranth I.5 — The Seal Arrives",
  mapId: "map_house_amaranth_the_seal_arrives",
  briefing:
    "Halcyon's own seal-holder is touring the terraces, and touring means watching. Nothing about today can look like the program straining. Hold the muster ground clean through the review -- whatever's actually circling it stays outside the dais, full stop.",
  objective: "hold_zone",
  objectiveParams: { turnLimit: 9, holdUntilTurn: 5 },
  playerPilotIds: HOUSE_AMARANTH_ROSTER_IDS,
  enemyWaves: [
    { archetypeId: "bloom_splitfang", count: 4, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "bloom_splitfang", count: 4, atTurn: 3, spawnAt: "enemy_deploy" },
  ],
  events: [
    {
      id: "ev_the_seal_arrives_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Marrow: “Whatever she reports back to Halcyon, let it be that we run a clean program. Hold the dais.”" },
      once: true,
    },
  ],
  rewardPoints: 125,
  heirloomCharge: "locked",
};

// Mission 6, "House Colors" (Act I -- Harvest Ground, plan doc §6).
// Explicitly mirrors Warden's own Mission 6 -- the SAME checkpoint dispute
// at Thane's Crossing, read from House Amaranth's own side. Warden's
// version has Rourke's squad fight House Amaranth's own line troopers
// (hostile_mech_amaranth_01-04) when the gate is unexpectedly sealed; this
// version can't restage that literally -- the engine has one hostile
// faction, no PvP against Warden's own pilots -- so it tells the SAME
// incident's real cause: Marrow's detachment, still holding the gate,
// still fighting for it, catches a Bloom incursion right as the order to
// abandon the position for good arrives. The eliminate_all fight is real
// (that's what the squad is actually doing this mission); the bitter part
// -- the bargain-mandated withdrawal Marrow was ordered into and hated --
// lands as a closing dialogue beat once the field's already clear, not a
// different objective type. Map is the literal same location as Warden's
// own (mapsHouseAmaranth.ts's own comment on why it's deliberately NOT
// retextured this time); Warden's later Mission 10 ("The Amaranth
// Betrayal") already shows this same gate standing open, abandoned --
// this mission is the day before that, still held. Enemy composition
// started from Mission 4's own numbers (10 Crawlmass, the nearest
// same-objective precedent) then sim-tested per house rule.
//
// Re-tuned 31 Aug 2026, same day: 98% at n=60 (only Mission 4's own map
// shape made 10 Crawlmass alone feel like a real fight -- this map's gate
// chokepoint funnels and concentrates them for easy elimination instead).
// Maxime: "add more enemy. maybe diff variety. how would u make the
// mission harder?" Real variety, not just a bigger single-archetype pile:
// kept a Crawlmass base (the low-tier swarm establishing the fight is
// still the right opener), added Splitfang (harder-hitting melee pack,
// already this campaign's own "next tier up" per Missions 2/5) AND
// Sporethrower (ranged, [2,3] attackRange -- the one archetype in this
// roster that changes the actual tactical problem rather than just adding
// more melee to grind through at the gate). Sporethrower spawnAt pinned to
// explicit coords rather than "enemy_deploy" -- its own moveRange 2 is too
// short to reliably path off a spawn tile that lands it against the wall
// or inside a structure block, the same reasoning campaignAmaranth.ts's
// own Wire and Mud comment gives for pinning ranged units to real sightline
// tiles rather than trusting a random spawn-tile pick.
//
// First-guess numbers (8 Crawlmass + 3 Splitfang + 2 Sporethrower)
// overshot badly, sim-checked rather than assumed: 3% at n=60, 58/60
// COMMANDER_DOWN -- two Sporethrower stacking consistent 22-31 ranged
// damage on top of Splitfang's own melee hits proved far harder to
// interrupt than a first read of the numbers suggested (both pinned
// behind the gate structure, out of easy reach). Cut to 6 Crawlmass + 2
// Splitfang + 1 Sporethrower: 70% at n=60, COMMANDER_DOWN=18 -- real
// teeth, still comfortably clear of the 30% floor. Left the failed first
// attempt in this comment rather than only reporting the number that
// worked, same discipline every re-tune this session has followed.
export const HOUSE_AMARANTH_MISSION_6: CampaignMission = {
  id: "mission_house_amaranth_6",
  displayName: "House Amaranth I.6 — House Colors",
  mapId: "map_house_amaranth_house_colors",
  briefing:
    "Thane's Crossing, same as every morning since before the bargain had a name. What's coming up through the drainage past the gate isn't the hard part. The order waiting on the other side of clearing it is: hold nothing, hand it over, walk away clean. Clear the gate first. Worry about the rest after.",
  objective: "eliminate_all",
  objectiveParams: { turnLimit: 10 },
  playerPilotIds: HOUSE_AMARANTH_ROSTER_IDS,
  enemyWaves: [
    { archetypeId: "bloom_crawlmass", count: 6, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "bloom_splitfang", count: 2, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "bloom_sporethrower", count: 1, atTurn: 1, spawnAt: [{ x: 15, y: 4 }] },
  ],
  events: [
    {
      id: "ev_house_colors_withdrawal_order",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Marrow: “Clear the gate. Whatever comes after, we clear it clean first.”" },
      once: true,
    },
    // The bitter payoff -- the field's clear, and the order arrives anyway.
    // This is what the plan doc's own pitch is actually about: a bargain-
    // mandated withdrawal Marrow was ordered into and hated. Warden's own
    // Mission 10 shows this same gate standing open, abandoned, some time
    // after this moment.
    {
      id: "ev_house_colors_order_lands",
      trigger: { type: "objective_complete" },
      action: { type: "dialogue", text: "Marrow: “Command's confirmed. Stand down, pull the detachment, hand the crossing over — full withdrawal, effective tonight. We just cleared it for nothing.”" },
      once: true,
    },
  ],
  rewardPoints: 130,
  heirloomCharge: "locked",
};

// Mission 7, "Deeper Terraces" (Act I -- Harvest Ground, plan doc §6).
// Expanding the ward-crop program onto a new tier; a research team needs
// pulling out when the drift there runs hot. No Warden mirror named for
// this one in the plan doc's own table, so a fresh geometry rather than a
// borrowed shape (mapsHouseAmaranth.ts's own comment on the map's own
// two-tier design). Extraction target: Orin again, the Fieldwright --
// same track precedent as Mission 3; Warden's own campaign reuses a
// single Fieldwright (pilot_anand) as its extract_unit target more than
// once too (campaignAmaranth.ts, missions at turnLimit 14 and 17), so
// this isn't inventing a new convention. turnLimit 16, longer than
// Mission 3's 14 -- this map is a real climb (a two-row ridge band at
// real movement cost), not just a longer walk.
//
// Enemy composition, tuned across three sim-checked passes rather than
// shipped on a first guess -- Maxime's own read on Mission 6 ("that's the
// kinda mission I want") taken as standing intent, not a one-off, so this
// one was pushed past its own first-guess result rather than left there:
// (1) 6 Crawlmass + 2 Splitfang + 1 Sporethrower (Mission 3's own base
// plus one ranged unit, the direct fiction reason the drift "runs hot" on
// this specific tier) -- 99% at n=150, a real cakewalk, clears the floor
// but reads nothing like "hot." (2) Bumped Splitfang 2->3, kept 1
// Sporethrower -- catastrophic overshoot, 7% at n=150, COMMANDER_DOWN=124:
// a single extra Splitfang was enough to let 2 Crawlmass + 3 Splitfang +
// Sporethrower alpha-strike Marrow for 128+ damage in one hostile phase
// while the squad was still clustered near deploy, before she could even
// reach the ridge. (3) Reverted Splitfang to 2 (the tested-safe number)
// and added a second Sporethrower up on the new tier instead, pinned near
// the exit cluster's far side -- landed at 45% (150 runs), LOSS=83,
// COMMANDER_DOWN=0. Worth naming what that 45% actually is: not commander
// deaths, a genuine turn-limit squeeze -- two stationary ranged units
// guarding the exit cluster cost real turns to close on and clear, and a
// meaningful fraction of runs miss the turnLimit doing it. A fair kind of
// hard (a clock, not a coin-flip alpha strike), comfortably clear of the
// 30% floor. Shipped at this composition.
export const HOUSE_AMARANTH_MISSION_7: CampaignMission = {
  id: "mission_house_amaranth_7",
  displayName: "House Amaranth I.7 — Deeper Terraces",
  mapId: "map_house_amaranth_deeper_terraces",
  briefing:
    "The new tier was supposed to be the easy part -- survey it, seed it, come back down. Orin's team went up three hours ago and the drift readings up there have gone from warm to hot faster than anyone predicted. Get up the ridge, get her out. The terrace can wait for calm weather.",
  objective: "extract_unit",
  objectiveParams: { turnLimit: 12, extractUnitId: "pilot_orin" },
  playerPilotIds: HOUSE_AMARANTH_ROSTER_IDS,
  enemyWaves: [
    { archetypeId: "bloom_crawlmass", count: 6, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "bloom_splitfang", count: 2, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "bloom_sporethrower", count: 2, atTurn: 1, spawnAt: [{ x: 9, y: 1 }, { x: 16, y: 1 }] },
  ],
  events: [
    {
      id: "ev_deeper_terraces_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Bray: “Ridge first, then the flat. Whatever's up there, it's had three hours to get comfortable.”" },
      once: true,
    },
  ],
  rewardPoints: 135,
  heirloomCharge: "locked",
};

// Mission 8, "The Quiet Growth" (Act I -- Harvest Ground, plan doc §6).
// First sign the diverted Bloom isn't staying where it's put -- a night
// watch that shouldn't need this much watching. House Amaranth's own first
// survive_n_turns mission, matching Warden's own Mission 9 ("Cut Off")
// "cheapest ask" precedent for this objective type's first outing:
// turnLimit 10, no hold room, deploy central. Enemy spawnAt pinned to the
// map's own four close-in seams (N/S/E/W, mapsHouseAmaranth.ts's own
// comment on why) rather than "enemy_deploy" -- applying, not
// rediscovering, the lesson campaignAmaranth.ts's own Mission 34/35
// comments already record: this engine's AI never moves without a visible
// target, and survive_n_turns has no hold zone to eventually walk the
// squad into, so the pressure has to already be in range from turn 1.
//
// Enemy composition, tuned across three sim-checked passes -- Maxime's own
// "that's the kinda mission I want, keep going" taken as standing intent
// again here, not just for eliminate_all/extract_unit: (1) 10 Crawlmass at
// turn 1 only, matching Cut Off's own opening exactly -- 100% at n=150, a
// flat cakewalk. (2) Added a 4-Crawlmass turn-5 reinforcement wave at the
// same four seams (the "it keeps coming" beat) -- barely moved the needle,
// 99% at n=150: more low-tier Crawlmass just isn't real pressure against a
// five-pilot squad by turn 5. (3) Swapped the reinforcement wave to 4
// Splitfang instead of more Crawlmass -- a real tier jump fits "isn't
// staying where it's put" better than volume anyway. Landed at **67%
// (100/150)**, COMMANDER_DOWN=50, LOSS=0, TIMEOUT=0 -- checked against
// sample verbose runs rather than assumed: a legible failure (3 Splitfang
// alpha-striking Marrow for 96 in one hostile phase at the reinforcement
// spawn, same "watch for a concentrated ranged/pack strike on the
// commander" shape Missions 6/7 already taught), not a degenerate loss
// type. Comfortably clear of the 30% floor. Shipped at 10 Crawlmass (turn
// 1) + 4 Splitfang (turn 5).
export const HOUSE_AMARANTH_MISSION_8: CampaignMission = {
  id: "mission_house_amaranth_8",
  displayName: "House Amaranth I.8 — The Quiet Growth",
  mapId: "map_house_amaranth_the_quiet_growth",
  briefing:
    "Nothing on the board says trouble. Routine post, routine watch, the same rotation Marrow's own staff has run a dozen quiet nights running. Except the readings are creeping in from every direction at once tonight, not just the one the program's built to expect. Hold the post. Find out why it's not staying where it's put.",
  objective: "survive_n_turns",
  objectiveParams: { turnLimit: 10 },
  playerPilotIds: HOUSE_AMARANTH_ROSTER_IDS,
  enemyWaves: [
    {
      archetypeId: "bloom_crawlmass",
      count: 10,
      atTurn: 1,
      spawnAt: [
        { x: 7, y: 1 },
        { x: 8, y: 1 },
        { x: 1, y: 4 },
        { x: 2, y: 4 },
        { x: 13, y: 4 },
        { x: 14, y: 4 },
        { x: 7, y: 9 },
        { x: 8, y: 9 },
      ],
    },
    {
      archetypeId: "bloom_splitfang",
      count: 4,
      atTurn: 5,
      spawnAt: [
        { x: 7, y: 1 },
        { x: 1, y: 4 },
        { x: 14, y: 4 },
        { x: 8, y: 9 },
      ],
    },
  ],
  events: [
    {
      id: "ev_the_quiet_growth_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Meir: “That's not one drift, Colonel. That's four. All at once, all sides.”" },
      once: true,
    },
  ],
  rewardPoints: 130,
  heirloomCharge: "locked",
};

// Mission 9, "Loyalist Eyes" (Act I -- Harvest Ground, plan doc §6). A
// sector-governor auditor tours the program; Marrow has to hold a clean,
// boring battle for an audience hoping for a mess. No Warden mirror named
// for this one -- a fresh geometry, and a genuinely different hold_zone
// shape from this campaign's own two prior ones (mapsHouseAmaranth.ts's
// own comment on the map's own two-gate courtyard design). turnLimit 10/
// holdUntilTurn 6, matching Mission 2's own numbers for the same 20-tile-
// ish scale hold. Enemy composition started from Mission 5's own final
// shipped numbers (Splitfang 3+3 was that mission's own FIRST, safer
// pass, before the 4+4 re-tune) as a first guess for a comparably-sized
// hold, then sim-tested per house rule rather than assumed to transfer to
// a genuinely different (two-chokepoint) map shape.
//
// First pass (Splitfang 3+3) came back 100% at n=150 -- the two-gate
// split dilutes pressure per gate versus a single doorway at the same
// total count, so the "safer" precedent number wasn't actually safe here,
// it was too safe. Bumped straight to Mission 5's own final 4+4 (its
// re-tuned number, not its own first pass) rather than a smaller
// increment, since the map shape itself was already the source of the
// slack: **71% (107/150)**, LOSS=38, COMMANDER_DOWN=5, TIMEOUT=0. Checked
// against sample verbose runs: the dominant failure is exactly the
// design's own intent -- "hostiles hold the zone" firing because a
// Splitfang slipped through the unwatched gate while the squad's
// attention sat on the other one, not a degenerate or unrelated failure
// mode. Comfortably clear of the 30% floor. Shipped at 4+4.
export const HOUSE_AMARANTH_MISSION_9: CampaignMission = {
  id: "mission_house_amaranth_9",
  displayName: "House Amaranth I.9 — Loyalist Eyes",
  mapId: "map_house_amaranth_loyalist_eyes",
  briefing:
    "The governor's auditor didn't come to watch a program succeed. She came with a report already half-written, hoping the terraces hand her the other half. Nothing gets past either gate. Nothing looks difficult. Whatever's actually happening out there stays entirely off her page.",
  objective: "hold_zone",
  objectiveParams: { turnLimit: 10, holdUntilTurn: 6 },
  playerPilotIds: HOUSE_AMARANTH_ROSTER_IDS,
  enemyWaves: [
    { archetypeId: "bloom_splitfang", count: 4, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "bloom_splitfang", count: 4, atTurn: 3, spawnAt: "enemy_deploy" },
  ],
  events: [
    {
      id: "ev_loyalist_eyes_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Marrow: “She's not here to see us win. Give her nothing to write home about.”" },
      once: true,
    },
  ],
  rewardPoints: 130,
  heirloomCharge: "locked",
};

// Mission 10, "The Choir, Heard From Afar" (Act I -- Harvest Ground, plan
// doc §6). Mirrors Warden's own Mission 8 mid-boss ("The Choir Sings") --
// the same coordinated Bloom pack (data/bloom.ts's own bloom_choir: pack
// intelligence, sonic/flight_membrane, first Bloom encounter built with
// real coordination rather than incidentally), met differently. House
// Amaranth doctrine handles it by redirection, not annihilation -- only
// the stragglers that wouldn't be steered actually get fought here, which
// is why the composition below is deliberately smaller than Warden's own
// 4 Choir + 4 Crawlmass, not a straight copy: the bulk of the swarm passes
// at a distance, off camera, successfully redirected. Map reuses The
// Choir Sings' own proven shape (mapsHouseAmaranth.ts's own comment on
// why). Same beat, same mechanical answer Warden's own campaign reaches
// for here: unlocks abil_taunt for the Meeps path (Vondra, Meir) from this
// mission onward, matching Warden's own precedent exactly rather than
// inventing a different unlock trigger for an equivalent narrative moment.
//
// Sim-tested, landed on the first real pass -- no retune needed this time.
// npx tsx src/sim/runBatch.ts 150 -> WIN=115/150 (77%), COMMANDER_DOWN=35,
// LOSS=0, TIMEOUT=0. Checked against sample verbose runs: the failure is
// legible and repeatable -- 2 Choir hits stacking on Marrow in one hostile
// phase (~52 damage, close to its own 2x32 max), the same "concentrated
// pack fire catches the commander" shape every prior mission this pass
// has taught, not a new or degenerate failure type. Already comfortably
// in this session's own established "real teeth" range (Missions 6/7/8/9
// all landed 45-77% after tuning); shipped at 2 Choir + 3 Crawlmass
// without pushing further.
export const HOUSE_AMARANTH_MISSION_10: CampaignMission = {
  id: "mission_house_amaranth_10",
  displayName: "House Amaranth I.10 — The Choir, Heard From Afar",
  mapId: "map_house_amaranth_the_choir_heard_from_afar",
  briefing:
    "Whatever passed the terraces last night wasn't drift-noise. Dozens of signals moving as one, and doctrine held: nobody engaged the whole of it. What's left on the ground this morning is the handful that didn't take the redirect — small, but they didn't come this close by accident. Clear what stayed. Let the rest keep going wherever it's actually headed.",
  objective: "eliminate_all",
  objectiveParams: { turnLimit: 14 },
  playerPilotIds: HOUSE_AMARANTH_ROSTER_IDS,
  enemyWaves: [
    { archetypeId: "bloom_choir", count: 2, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "bloom_crawlmass", count: 3, atTurn: 1, spawnAt: "enemy_deploy" },
  ],
  events: [
    {
      id: "ev_the_choir_heard_from_afar_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Bray: “That's not one voice, that's a choir. Whatever's left down there is what didn't listen.”" },
      once: true,
    },
  ],
  rewardPoints: 150,
  heirloomCharge: "locked",
  bonusAbilityUnlocks: [{ path: "meeps", abilityId: "abil_taunt" }],
};

// Mission 11, "What the Terraces Cost" (Act I -- Harvest Ground, plan doc
// §6). A ward-crop technician goes missing inside the growth zone -- the
// bargain's first quiet, unlogged casualty. No Warden mirror named for
// this one; a genuinely different extract_unit shape from this campaign's
// own two prior extractions (mapsHouseAmaranth.ts's own comment on the
// map's own cluttered "growth zone" maze). Extraction target: Orin again
// -- her third time as the extract_unit target this campaign, matching
// Warden's own precedent of reusing a single Fieldwright (Anand) more
// than once, and the Fieldwright track's own "survey/ground specialist"
// framing fits a missing "technician" better than any other pilot on the
// roster. turnLimit 15, between Second Harvest's 14 (open field) and
// Deeper Terraces' 16 (a real climb) -- this map's footprint is smaller
// than Deeper Terraces but its sightline-breaking clusters cost real
// routing time, closer to that than to a flat open field.
//
// Enemy composition, tuned across three sim-checked passes: (1) 6
// Crawlmass + 2 Splitfang (Second Harvest's own base) -> 99% at n=150, a
// cakewalk that reads nothing like "the bargain's first quiet, unlogged
// casualty." (2) Added 2 Sporethrower pinned into the two spawn seams
// tucked against the map's own clusters (the "hidden in the growth"
// threat this map was built for) -> catastrophic overshoot, 14% at n=150,
// COMMANDER_DOWN=80 -- same "two Sporethrower is one too many" lesson
// Mission 6 and Mission 7 both already taught, confirmed a third time
// rather than assumed away. (3) Cut to a single Sporethrower -> landed at
// **72% (108/150)**, LOSS=28, COMMANDER_DOWN=14, TIMEOUT=0. Checked
// against sample verbose runs: the dominant failure is a genuine turn-
// limit squeeze -- clearing the maze's hidden Sporethrower plus the
// Splitfang/Crawlmass pack costs real routing time through the clusters,
// not a degenerate loss type, and it's the map's own premise doing the
// work (the growth genuinely slows the squad down). Shipped at 6
// Crawlmass + 2 Splitfang + 1 Sporethrower.
export const HOUSE_AMARANTH_MISSION_11: CampaignMission = {
  id: "mission_house_amaranth_11",
  displayName: "House Amaranth I.11 — What the Terraces Cost",
  mapId: "map_house_amaranth_what_the_terraces_cost",
  briefing:
    "Orin's overdue check-in from the new growth zone, and this time it isn't the drift that's the problem — it's that nobody can say where she actually is inside it. The crop's grown in thick enough to lose a mech in, let alone a person. Find her before the count of what this bargain's actually cost stops staying quiet.",
  objective: "extract_unit",
  objectiveParams: { turnLimit: 15, extractUnitId: "pilot_orin" },
  playerPilotIds: HOUSE_AMARANTH_ROSTER_IDS,
  enemyWaves: [
    { archetypeId: "bloom_crawlmass", count: 6, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "bloom_splitfang", count: 2, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "bloom_sporethrower", count: 1, atTurn: 1, spawnAt: [{ x: 6, y: 9 }] },
  ],
  events: [
    {
      id: "ev_what_the_terraces_cost_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Meir: “She checked in three hours ago. Since then, nothing — and this crop's tall enough to hide whatever got to her.”" },
      once: true,
    },
  ],
  rewardPoints: 140,
  heirloomCharge: "locked",
};

// Mission 12, "Harvest's End" (Act I -- Harvest Ground, act finale, plan
// doc §6). A diversion relay fails under real load for the first time;
// Marrow holds the line long enough for a fix, at real cost to her own
// staff -- and is confirmed in permanent command, seal-holder's blessing
// or not. hold_zone, the campaign's third (Mission 2, 9), and deliberately
// the least protected of the three -- mapsHouseAmaranth.ts's own comment
// on why this map has no true walls anywhere, unlike Mission 5's ridge
// chokepoint or Mission 9's two blockhouse gates.
//
// Composition, per Maxime's own direction (31 Aug 2026, after Mission 11
// shipped): "have fun. dont just add splitfang. add some undertow or
// flyers too. they too can appear on mission 6-12." Rather than reaching
// for another Splitfang bump (this pass's own reflexive lever every
// mission so far), the finale leans on the two archetypes named directly:
// Undertow (data/bloom.ts, burrowed, x1.5 surfacing damage) pinned right
// against the relay's own flanking structure clusters -- the ground
// breach reading, "the thing holding this together gives out from
// underneath" -- and Sirenmaw (data/bloom.ts's own Data Pack base flyer,
// distinct from Mission 10's elite Choir-boss variant of the same
// lineage) pinned at the map's far corners as a turn-5 reinforcement wave,
// arriving mid-hold once the relay's failure is already underway -- the
// escalation the pitch's "real cost" line calls for, and the same flyer
// role Warden's own Act I finale (Mission 12, "4 waves, Crawlmass->
// Sirenmaw") already established as this campaign's own precedent for
// what an Act I closer's air threat looks like.
//
// Sim-tested: 6 Crawlmass (turn 1) + 2 Undertow burrowed (turn 1, pinned
// at the cluster flanks) + 2 Sirenmaw (turn 5, pinned far corners),
// turnLimit 12 / holdUntilTurn 7 -- landed at **51% (77/150)**, LOSS=0,
// COMMANDER_DOWN=73, TIMEOUT=0 on the first composition tried, no retune
// needed. Checked against a verbose single run: the dominant failure is
// exactly what a walls-free hold zone should produce -- both Undertow
// surface adjacent and land their x1.5 surprise hit on different units in
// the same opening exchange, Crawlmass chip damage keeps landing on
// whoever's already hurt, and with nothing on this map to break line of
// sight or block approach (mapsHouseAmaranth.ts's own comment on why),
// Marrow specifically is reachable from more angles at once than any
// prior hold_zone map allowed. LOSS=0 is notable on its own -- nobody
// loses this fight by simply failing to hold the zone once engaged, every
// non-win is the commander going down first, a higher share than any
// prior mission this pass (Mission 8's 33%, Mission 10's 23%) but not a
// different failure TYPE, and it's the same shape the pitch's own "at
// real cost to her own staff" line is describing rather than a design
// accident. Comfortably clear of the 30% floor. Shipped at this
// composition -- Act I's finale reads as genuinely mixed-threat (ground
// ambush + air reinforcement) rather than "the hardest eliminate_all math
// yet," which is the actual point of varying the lever Maxime asked for
// instead of just raising Splitfang counts again.
export const HOUSE_AMARANTH_MISSION_12: CampaignMission = {
  id: "mission_house_amaranth_12",
  displayName: "House Amaranth I.12 — Harvest's End",
  mapId: "map_house_amaranth_harvests_end",
  briefing:
    "The relay's held every load Marrow's staff has thrown at it since the bargain started — until this morning. Something's coming through it now that doesn't belong, and the fix crew needs time nobody up here has to spare. Hold the relay. However long it actually takes.",
  objective: "hold_zone",
  objectiveParams: { turnLimit: 12, holdUntilTurn: 7 },
  playerPilotIds: HOUSE_AMARANTH_ROSTER_IDS,
  enemyWaves: [
    { archetypeId: "bloom_crawlmass", count: 6, atTurn: 1, spawnAt: "enemy_deploy" },
    {
      archetypeId: "bloom_undertow",
      count: 2,
      atTurn: 1,
      spawnAt: [
        { x: 6, y: 5 },
        { x: 13, y: 5 },
      ],
      burrowed: true,
    },
    {
      archetypeId: "bloom_sirenmaw",
      count: 2,
      atTurn: 5,
      spawnAt: [
        { x: 2, y: 1 },
        { x: 17, y: 1 },
      ],
    },
  ],
  events: [
    {
      id: "ev_harvests_end_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Marrow: “Whatever's coming through that relay, it doesn't get past this line. Hold it — I don't care what it costs to hold.”" },
      once: true,
    },
    {
      id: "ev_harvests_end_flyers_inbound",
      trigger: { type: "turn_start", turn: 5 },
      action: { type: "dialogue", text: "Bray: “Contacts, airborne, coming in fast — that relay's not just leaking on the ground anymore.”" },
      once: true,
    },
    {
      id: "ev_harvests_end_command_confirmed",
      trigger: { type: "objective_complete" },
      action: { type: "dialogue", text: "Marrow: “Relay's stable. Get the fix crew credit for it — every bit of it.” Command's word arrives before the field even clears: House Amaranth's own seal-holder or not, the line held on Marrow's order, and permanent command is hers now in fact, not just in title." },
      once: true,
    },
  ],
  rewardPoints: 160,
  heirloomCharge: "locked",
};

export const HOUSE_AMARANTH_ACT1: CampaignMission[] = [
  HOUSE_AMARANTH_MISSION_1,
  HOUSE_AMARANTH_MISSION_2,
  HOUSE_AMARANTH_MISSION_3,
  HOUSE_AMARANTH_MISSION_4,
  HOUSE_AMARANTH_MISSION_5,
  HOUSE_AMARANTH_MISSION_6,
  HOUSE_AMARANTH_MISSION_7,
  HOUSE_AMARANTH_MISSION_8,
  HOUSE_AMARANTH_MISSION_9,
  HOUSE_AMARANTH_MISSION_10,
  HOUSE_AMARANTH_MISSION_11,
  HOUSE_AMARANTH_MISSION_12,
];

// Mission 13, "New Terraces, New Faces" (Act II -- The Bargain Holds, plan
// doc §6). Integrating a second lance as the program expands past what one
// company can hold. First mission of Act II, and the first House Amaranth
// mission built around a genuinely different enemy-composition SHAPE
// rather than the Crawlmass+Splitfang base most of Act I reached for --
// Maxime, 31 Aug 2026, right after Mission 12 shipped: "when you adjust
// difficulties. vary between the different enemy unit. that wsy the
// mission feel different. we got 6-7 enemy unit. so lets vary tjing up.
// adding crawlmass to a primary sporetrower or whatever. be creative."
//
// Gallcyst (data/bloom.ts -- sessile, moveRange 0, endurance 140,
// attackRange [1,3], fx_acid_dot) hadn't appeared anywhere in this
// campaign's first 12 missions -- confirmed by grepping every enemyWaves
// block already shipped before writing this one, not assumed. Made the
// PRIMARY threat here rather than a filler unit, matching the map's own
// premise (mapsHouseAmaranth.ts's own comment): the new terraces come with
// their own freshly-installed point-defense, planted and waiting, not a
// drift that wandered in. Sporethrower is the secondary, pinned just
// outside the same structure block covering it -- a fixed emplacement
// with ranged overwatch is a different tactical problem from every prior
// Act I mission's melee-swarm-plus-one-sniper shape: nothing here chases
// the squad, the squad has to go take the position. Crawlmass stays
// filler (enemy_deploy, the campaign's own consistent base), kept small
// so it doesn't just repeat Act I's own already-established swarm feel
// on top of the new shape.
//
// Sim-tested across five passes -- a real, non-obvious tuning curve, not
// the usual one-or-two-step overshoot-and-correct this pass's other
// missions found. eliminate_all doesn't actually time out (house rule --
// turnLimit is HUD-display-only for this objective type, same as every
// prior mission), and nothing in the base composition (2 fixed Gallcyst +
// 2 pinned Sporethrower, neither able to move) chases the squad -- so the
// real lever turned out to be Crawlmass count, the one mobile piece able
// to force engagement, not turnLimit at all.
//
// (1) 3 Crawlmass -- **100% (150/150)**, COMMANDER_DOWN=0. A clean
// approach-and-clear grind with zero real risk: the squad can poke the
// fixed emplacements from outside their range and retreat-heal at will
// with nothing able to punish stalling. (2) Jumped straight to 8 Crawlmass
// -- overshot hard the other way, **17% (26/150)**, COMMANDER_DOWN=124:
// enough mobile bodies to force real engagement time inside the Gallcyst/
// Sporethrower crossfire zone. (3) Tried 6 as the expected midpoint --
// **1% (2/150)**, COMMANDER_DOWN~99%, WORSE than 8, not better -- a
// genuinely non-monotonic result, checked twice rather than assumed a
// fluke. Verbose trace shows why: at 6, Orin (the roster's one Munti)
// reliably gets caught forward-healing right as the crossfire's chip
// damage stacks on her specifically, and losing the only healer early
// snowballs into commander_down later almost every run -- at 8 the extra
// Crawlmass die too fast to player counter-fire to reliably land that same
// early hit on her, so the higher count is actually SAFER. (4) 4 Crawlmass
// -- 90% (135/150), COMMANDER_DOWN=15, still too easy. (5) 5 Crawlmass --
// **65-67% across two independent n=150 batches** (101/150 and 98/150),
// LOSS=0, COMMANDER_DOWN=42-44 (~28-29%), TIMEOUT=5-10 (~3-7%, the sim's
// own runaway-loop guard catching the occasional very long grind against
// Gallcyst's 140 endurance -- expected for this shape, not a bug).
// Checked against verbose single runs: multiple wins cost real units along
// the way (two pilots downed in one sampled win, still recovered from),
// and the failure mode stays the same commander-focus-fire shape every
// mission this pass has already taught, just delivered by a stationary
// crossfire instead of a mobile alpha strike -- a genuinely different feel
// from every archetype-varied mission so far, and the actual point of
// varying the lever. Comfortably clear of the 30% floor. Originally
// shipped at 5 Crawlmass + 2 Gallcyst + 2 Sporethrower (for the 5-pilot
// squad).
//
// RETUNED 31 Aug 2026, same day -- Maxime: "are act 2 mission setup for
// 10 mech. 2 lance... look at warden side." They weren't; see
// HOUSE_AMARANTH_ACT2_DEFAULT_SQUAD's own comment above for the full
// second-lance addition. Doubling the squad to 10 pilots trivialized the
// numbers above outright: re-sim at the original composition came back
// **100% (150/150)**, and doubling Crawlmass alone to 10 changed nothing
// (still 100%) -- confirming this mission's own house-rule finding above
// (Crawlmass is the mobile-engagement lever, not raw threat) generalizes:
// weak trash simply can't threaten a 10-pilot squad regardless of count,
// it dies to opening-turn focus fire before it can mass. Doubled the
// FIXED emplacements instead (2 more Gallcyst, 2 more Sporethrower
// coordinates within the same structure block/flanks) and trimmed
// Crawlmass back to a moderate 6: **90% (135/150), COMMANDER_DOWN=15**,
// confirmed stable across two independent n=150 batches. Not as tight as
// the original 5-pilot tuning, but a real fight and a deliberately gentle
// one for Act II's own "first contact for the new pilots" framing.
// Shipped at 4 Gallcyst + 4 Sporethrower + 6 Crawlmass.
export const HOUSE_AMARANTH_MISSION_13: CampaignMission = {
  id: "mission_house_amaranth_13",
  displayName: "House Amaranth II.13 — New Terraces, New Faces",
  mapId: "map_house_amaranth_new_terraces_new_faces",
  briefing:
    "The second lance arrives with the new ground already half-built around them — scaffolding, access roads, and point-defense nobody's actually fired outside a test cycle. First contact for the new pilots, and it's not a drift. It's whatever the terrace's own defenses think is worth shooting at.",
  objective: "eliminate_all",
  objectiveParams: { turnLimit: 12 },
  playerPilotIds: HOUSE_AMARANTH_ACT2_DEFAULT_SQUAD,
  enemyWaves: [
    {
      archetypeId: "bloom_gallcyst",
      count: 4,
      atTurn: 1,
      spawnAt: [
        { x: 8, y: 4 },
        { x: 11, y: 4 },
        { x: 8, y: 3 },
        { x: 11, y: 3 },
      ],
    },
    {
      archetypeId: "bloom_sporethrower",
      count: 4,
      atTurn: 1,
      spawnAt: [
        { x: 6, y: 4 },
        { x: 13, y: 4 },
        { x: 6, y: 5 },
        { x: 13, y: 5 },
      ],
    },
    { archetypeId: "bloom_crawlmass", count: 6, atTurn: 1, spawnAt: "enemy_deploy" },
  ],
  events: [
    {
      id: "ev_new_terraces_new_faces_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Marrow: “New faces, new ground — and the terrace's own defenses don't know yours from a threat yet. Clear it careful.”" },
      once: true,
    },
  ],
  rewardPoints: 135,
  heirloomCharge: "locked",
};

// Mission 14, "The Governor's Patience" (Act II -- The Bargain Holds, plan
// doc §6). Political pressure sharpens; a loyalist liaison officer needs
// escorting out once he's seen too much. `extract_unit`, extractUnitId
// pilot_orin -- her FOURTH time as this campaign's extraction target,
// named directly rather than glossed over (same discipline every prior
// reuse got, Mission 11's own comment included). The liaison himself isn't
// a mechanical unit on this roster (data/types.ts's extractUnitId always
// resolves to a playerPilotId, and rescue_pilot's bonus-objective shape is
// for recruiting a NEW pilot, a different fit entirely) -- the fiction
// reads Orin's own exposure closing on and pulling him out as what the
// extract mechanic actually represents, the same reading Missions 3/7/11
// already established for a technician/survey-team/missing-person premise
// each didn't literally make Orin herself.
//
// Composition continues varying the lever per Maxime's own standing
// direction: Undertow (data/bloom.ts, burrowed) as the PRIMARY threat for
// the first time in this campaign, rather than the small 2-unit secondary
// role it had in Mission 12. Pinned at the checkpoint corridor's flank
// rubble clusters (mapsHouseAmaranth.ts's own comment on the map) -- the
// "political danger, hidden until it's already on you" reading fits this
// mission's own premise better than an open swarm would. No Splitfang, no
// Sporethrower, no Gallcyst this time -- deliberately a different pairing
// again (Undertow primary + Crawlmass filler) from every prior mission
// this variety pass has built. Kept the Undertow count conservative from
// the start given this campaign's own already-documented finding that
// extract_unit punishes added pressure harder than its surface numbers
// suggest (Mission 11's own comment, and Warden's own campaign-wide
// pattern data/bloom.ts's neighbor files record).
//
// Sim-tested: 3 Undertow burrowed (turn 1, pinned at both flank clusters)
// + 4 Crawlmass (turn 1, enemy_deploy), turnLimit 14 -- landed at **59%
// (89/150)**, LOSS=61, COMMANDER_DOWN=0, TIMEOUT=0 on the first
// composition tried, no retune needed. Worth naming what that breakdown
// actually is, not assumed from the win rate alone: COMMANDER_DOWN=0
// across all 150 runs is a genuinely different failure texture from every
// mission this variety pass has built so far -- extract_unit actually
// enforces its own turnLimit as a real fail condition (unlike
// eliminate_all's HUD-only version, house rule #5), so every non-win here
// is a straight "turn limit reached before extraction" clock-out, not a
// death. Checked against a verbose sample run: the squad fought through an
// Undertow ambush and cleared Crawlmass near deploy across the first few
// turns (real, felt damage -- Marrow alone took two separate ~50-60 point
// surprise hits), then spent the remaining turns marching the corridor's
// length with nothing left to fight -- a pure pacing squeeze, the cost of
// the early fight eating into the travel budget rather than any later
// combat risk. A fair and legible failure shape, and a genuinely different
// kind of pressure than the commander-focus-fire shape every other variety
// mission this pass has produced -- time pressure instead of death
// pressure. Comfortably clear of the 30% floor. Originally shipped at 3
// Undertow + 4 Crawlmass (for the 5-pilot squad).
//
// RETUNED 31 Aug 2026, same day, same second-lance addition as Mission
// 13's own retune note. Re-sim at the original composition against the
// 10-pilot squad came back **96% (144/150)**, LOSS=6 -- the extra pilots
// clear the ambush and close the corridor distance fast enough that the
// turn-limit squeeze this mission was built around barely bites anymore.
// First retune attempt (5 Undertow, one more flank ambush point) hit a
// genuine cliff, checked and confirmed, not assumed noise: **0% (0/150),
// COMMANDER_DOWN=150** -- the fifth burrowed Undertow's surfacing strike
// (1.5x on top of its own 55 base attack) reliably lands on top of
// whatever else is already hitting the squad that turn, a deterministic
// kill, not bad luck. Backed off to 4 Undertow (96% again, safely clear
// of the cliff but too easy) and moved the real difficulty lever back to
// Crawlmass -- consistent with this mission's own original finding that
// this shape's actual pressure is pacing, not death, so the fix was more
// clock, not more ambush. 10 Crawlmass alone (single turn-1 wave): 91%,
// still soft. Split into two waves (8 turn 1 + 5 turn 5) instead of one
// larger dump, so the pacing squeeze compounds over the whole corridor
// walk rather than front-loading: **72-74% across two independent n=150
// batches** (111/150 and 108/150), COMMANDER_DOWN now 5-14 (a new, real,
// small death risk layered on top of the pacing squeeze, not present in
// the original 5-pilot version) plus the same turn-limit LOSS texture as
// before. Traced a losing run directly: Orin one tile short of the exit
// when the clock runs out, same legible race-not-fight shape this
// mission was always built around. Comfortably clear of the 30% floor.
// Shipped at 4 Undertow + 8 Crawlmass (turn 1) + 5 Crawlmass (turn 5).
export const HOUSE_AMARANTH_MISSION_14: CampaignMission = {
  id: "mission_house_amaranth_14",
  displayName: "House Amaranth II.14 — The Governor's Patience",
  mapId: "map_house_amaranth_the_governors_patience",
  briefing:
    "The liaison's seen the ledgers he wasn't supposed to see, and word travels faster than any convoy. Get him through the checkpoint and out before whoever wants that ledger buried decides he goes with it. Quiet where you can. Fast where you can't.",
  objective: "extract_unit",
  objectiveParams: { turnLimit: 14, extractUnitId: "pilot_orin" },
  playerPilotIds: HOUSE_AMARANTH_ACT2_DEFAULT_SQUAD,
  enemyWaves: [
    {
      archetypeId: "bloom_undertow",
      count: 4,
      atTurn: 1,
      spawnAt: [
        { x: 4, y: 3 },
        { x: 17, y: 4 },
        { x: 4, y: 7 },
        { x: 17, y: 7 },
      ],
      burrowed: true,
    },
    { archetypeId: "bloom_crawlmass", count: 9, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "bloom_crawlmass", count: 5, atTurn: 5, spawnAt: "enemy_deploy" },
  ],
  events: [
    {
      id: "ev_the_governors_patience_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Meir: “He's not slowing down for anybody, Colonel. That's fine by me — this isn't a place I want to stand still either.”" },
      once: true,
    },
  ],
  rewardPoints: 140,
  heirloomCharge: "locked",
};

// Mission 15, "Rootbound" (Act II -- The Bargain Holds, plan doc §6).
// First real sign of what will become the Wellroot -- a diversion relay's
// target zone growing faster than it's told to. `hold_zone`, the
// campaign's fourth (Missions 2, 9, 12), and a different shape again: the
// hold sits in open ground, surrounded by four bloom_mat overgrowth
// clusters at the map's own four corners -- the encroachment the pitch
// describes made literal in terrain (mapsHouseAmaranth.ts's own comment).
//
// Composition: Sporethrower (data/bloom.ts, ranged [2,3], moveRange 2) as
// the PRIMARY threat for the first time in this campaign -- every prior
// use (Missions 6, 7, 11, and paired with Gallcyst in 13) was a 1-2 unit
// secondary addition, never the main threat on its own. One pinned inside
// each corner cluster, four separate ranged sightlines converging on one
// central hold zone -- a genuinely different tactical problem from every
// prior hold_zone map's melee-wave (2, 5, 9) or no-walls-crossfire (12)
// shape: nothing chases, but there's no single direction that's actually
// safe to approach or hold from. Crawlmass stays filler, enemy_deploy.
//
// Sim-tested: 4 Sporethrower (turn 1, pinned one per corner cluster) + 4
// Crawlmass (turn 1, enemy_deploy), turnLimit 10 / holdUntilTurn 6
// (Mission 9's own numbers, the nearest same-scale hold_zone precedent) --
// landed at **75-76% across two independent n=150 batches** (112/150 and
// 114/150), LOSS=36-38, COMMANDER_DOWN=0, TIMEOUT=0 on the first
// composition tried, no retune needed. COMMANDER_DOWN=0 is a genuinely
// different failure texture again (same shape Mission 14 found for
// extract_unit, now showing up for hold_zone too): Sporethrower's own
// no-counterattack rule and low moveRange keep it from ever mounting a
// real alpha strike, so nobody actually dies. Traced a losing run directly
// rather than assumed: "Loss: hostiles hold the zone" fires right at turn
// 6 (holdUntilTurn) -- a Crawlmass or Sporethrower occupying a hold tile
// at that exact moment while the squad's still finishing off a straggler
// elsewhere, exactly the map's own "no direction is actually safe" premise
// playing out mechanically. A fair, legible failure mode, not a
// degenerate one. Comfortably clear of the 30% floor. Originally shipped
// at 4 Sporethrower + 4 Crawlmass (for the 5-pilot squad).
//
// RETUNED 31 Aug 2026, same day, same second-lance addition as Missions
// 13/14's own retune notes. Re-sim at the original composition against
// the 10-pilot squad: **100% (150/150)**. Chased this one hard and found
// two genuine, deterministic cliffs before landing anything real -- both
// checked and confirmed, not assumed noise. (1) Doubling Sporethrower to
// 8 (one extra per corner) plus Crawlmass in the 9-13 range: a
// razor-sharp wall, 8 Crawlmass **100%**, 9 Crawlmass **0%
// (COMMANDER_DOWN=150)** -- verbose trace shows Marrow specifically,
// planted in the hold zone, catching simultaneous Sporethrower ranged
// fire plus enough adjacent Crawlmass bodies to stack lethal damage in
// one hostile phase, a guaranteed kill once that many bodies converge on
// her tile, not variance. (2) Tried splitting the same total Crawlmass
// across two waves instead of one lump (hoping to avoid the pile-up) --
// this neutralized the threat almost entirely instead (100% even at 15+
// total), the squad simply clears wave one clean before wave two ever
// lands. Backed off Sporethrower to its original 4 (one per corner,
// already known-safe) and added a genuinely new threat instead of more of
// the same one: 2 pairs of Undertow (data/bloom.ts, burrowed), pinned
// just outside the hold zone's own east/west flanks rather than the map's
// four corners -- close-range burst pressure aimed at whoever's actually
// holding the zone, not more ranged crossfire from a distance. **57-59%
// across two independent n=150 batches** (85/150 and 88/150), a real mix
// of LOSS (hostiles hold the zone) and COMMANDER_DOWN (24-41), not a
// cliff. Traced a losing run: two Undertow surface on Marrow in the same
// hostile phase (41+41) while Sporethrower and Crawlmass chip in on top --
// the same commander-focus-fire shape this campaign already accepts
// elsewhere, delivered by a new archetype pairing this map hadn't used
// before. Comfortably clear of the 30% floor. Shipped at 4 Sporethrower +
// 8 Crawlmass + 4 Undertow (all turn 1).
export const HOUSE_AMARANTH_MISSION_15: CampaignMission = {
  id: "mission_house_amaranth_15",
  displayName: "House Amaranth II.15 — Rootbound",
  mapId: "map_house_amaranth_rootbound",
  briefing:
    "The relay's target zone was supposed to hold steady at a fixed radius. It hasn't, for three days running, and whatever's rooting in at the corners now has line of sight on the whole thing. Hold the zone. Watch every direction — there isn't a safe one left.",
  objective: "hold_zone",
  objectiveParams: { turnLimit: 10, holdUntilTurn: 6 },
  playerPilotIds: HOUSE_AMARANTH_ACT2_DEFAULT_SQUAD,
  enemyWaves: [
    {
      archetypeId: "bloom_sporethrower",
      count: 4,
      atTurn: 1,
      spawnAt: [
        { x: 1, y: 2 },
        { x: 18, y: 2 },
        { x: 1, y: 9 },
        { x: 18, y: 9 },
      ],
    },
    { archetypeId: "bloom_crawlmass", count: 8, atTurn: 1, spawnAt: "enemy_deploy" },
    {
      archetypeId: "bloom_undertow",
      count: 4,
      atTurn: 1,
      spawnAt: [
        { x: 7, y: 6 },
        { x: 12, y: 6 },
        { x: 7, y: 5 },
        { x: 12, y: 5 },
      ],
      burrowed: true,
    },
  ],
  events: [
    {
      id: "ev_rootbound_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Bray: “It's rooted in on all four corners, Colonel. Whichever way we look, something's already looking back.”" },
      once: true,
    },
  ],
  rewardPoints: 135,
  heirloomCharge: "locked",
};

// Mission 16, "The Long Ledger" (Act II -- The Bargain Holds, plan doc
// §6). A rival House tries to poach the diversion contract by force -- the
// bargain has enemies who aren't the Bloom. First House Amaranth mission
// to field hostile mechs at all: every prior mission (including Mission
// 6's own "House Colors" mirror beat, which tells the same incident
// through a Bloom incursion + dialogue rather than PvP) fought Bloom
// exclusively. Enemy composition: data/units.ts's generic HOSTILE_MECHS
// (hostile_mech_01-04, "Unmarked Mech," tank/meeps/meeps/reeps, tier G) --
// confirmed via direct read, NOT AMARANTH_HOSTILE_MECHS (House Amaranth's
// own line troopers -- wrong faction to attack House Amaranth itself) and
// NOT AMARANTH_CONSCRIPT_MECHS (already committed to a different mission
// in a different campaign -- campaignAmaranth.ts's own mission_amaranth_16,
// "Collaborators," a Warden Company mission with its own numbering,
// confirmed distinct before reusing anything). "Unmarked" reads as
// deniable, which is exactly what a rival House poaching a bargain by
// force would actually field. Map: mapsHouseAmaranth.ts's own
// map_house_amaranth_the_long_ledger, a supply depot straddling a single
// east-west road with warehouse rows flanking it north and south, deploy
// centered on the road, two spawn seams at the road's far ends -- a
// two-pronged pincer down the one avenue in, a fresh shape from this
// campaign's now-repeated center-block-plus-corner-spawns pattern
// (Missions 12/13/15).
//
// Sim-tested, not assumed. First pass (the standard 4-unit detachment
// alone, matching Warden Mission 6's own precedent for this exact
// archetype family): `npx tsx src/sim/runBatch.ts 150` -> WIN=147/150
// (98%), COMMANDER_DOWN=3 -- too easy for Act II, the same "cakewalk"
// this campaign already accepts for Act I openers but not appropriate
// here. Added a turn-5 reinforcement wave (2 more mercs, same archetypes)
// rather than just inflating the opening wave, so the fight has a real
// second beat: `npx tsx src/sim/runBatch.ts 150` -> WIN=71/150 (47%),
// COMMANDER_DOWN=78, TIMEOUT=1; a second independent batch -> WIN=82/150
// (55%), COMMANDER_DOWN=68. Real spread between the two runs, but both
// comfortably clear of the 30% floor. Traced a losing run rather than
// assumed the cause: the turn-5 reinforcement lands while the squad is
// mid-mop-up on the first wave and spread out (Orin mid-repair rather
// than positioned), and the extra mechs' focus fire catches Orin (the
// roster's one Munti, so her death also strips the "standard restock"
// permadeath safety net) then Marrow herself in the same hostile phase --
// the same campaign-wide commander-focus-fire pattern already documented
// and accepted elsewhere in this project, not a new or degenerate failure
// mode. A fair, real fight -- this campaign's first against a human/mech
// opponent instead of the Bloom, and it plays differently (real counter-
// damage exchanges, no swarm-thinning attrition). Originally shipped at 4
// (turn 1) + 2 (turn 5), for the 5-pilot squad.
//
// RETUNED 31 Aug 2026, same day, same second-lance addition as Missions
// 13-15's own retune notes. Re-sim at the original composition against
// the 10-pilot squad: **100% (150/150)**. Doubled every merc count
// (2 each of hostile_mech_01-04 turn 1, 8 total; 2 each of 02/04 turn 5)
// as a first pass: **89% (133/150)**, COMMANDER_DOWN=17 -- better, still
// soft. Bumped the turn-5 reinforcement specifically (3 each of 02/04
// instead of 2, 6 total) rather than the turn-1 wave again, keeping the
// same "second beat, not a bigger first one" shape the original tuning
// note above already settled on: **57-59% across two independent n=150
// batches** (88/150 and 85/150), COMMANDER_DOWN=62-65. Traced a losing
// run: Marrin (the roster's one Munti on the field at the time) goes down
// early, stripping the restock safety net same as the original finding,
// and by turn 9 Marrow eats two mech hits in one hostile phase (7 + 58) --
// same mechanism as the 5-pilot version, just taking longer to arrive
// against the bigger squad. Comfortably clear of the 30% floor. Shipped
// at 2 each of hostile_mech_01/02/03/04 (turn 1, 8 total) + 3 each of
// hostile_mech_02/04 (turn 5, 6 total).
export const HOUSE_AMARANTH_MISSION_16: CampaignMission = {
  id: "mission_house_amaranth_16",
  displayName: "House Amaranth II.16 — The Long Ledger",
  mapId: "map_house_amaranth_the_long_ledger",
  briefing:
    "The contract was never as exclusive as House Amaranth likes to pretend. Someone else's House colors are missing from these mechs on purpose — a deniable push down the depot road to take the ledger by force, and put the blame on the Bloom if anyone asks. Hold the road. Nobody unmarked leaves with the books.",
  objective: "eliminate_all",
  objectiveParams: { turnLimit: 12 },
  playerPilotIds: HOUSE_AMARANTH_ACT2_DEFAULT_SQUAD,
  enemyWaves: [
    { archetypeId: "hostile_mech_01", count: 2, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "hostile_mech_02", count: 2, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "hostile_mech_03", count: 2, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "hostile_mech_04", count: 2, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "hostile_mech_02", count: 3, atTurn: 5, spawnAt: "enemy_deploy" },
    { archetypeId: "hostile_mech_04", count: 3, atTurn: 5, spawnAt: "enemy_deploy" },
  ],
  events: [
    {
      id: "ev_long_ledger_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Vondra: “No House colors on any of them, Colonel. Somebody wants this looking like an accident.”" },
      once: true,
    },
  ],
  rewardPoints: 140,
  heirloomCharge: "locked",
};

// Mission 17, "What Grows Beneath" (Act II -- The Bargain Holds, plan doc
// §6). Mirrors Warden's own Mission 17, other side: House Amaranth's own
// survey team finds what Warden will later call the Wellroot, and reports
// -- against Marrow's instinct -- that it's still within tolerance.
// `extract_unit`, extractUnitId pilot_orin -- her FIFTH time as this
// campaign's extraction target (Missions 3, 7, 11, 14), named directly
// per the same discipline every prior reuse got. Composition varies the
// lever again: Splitfang (data/bloom.ts, swarm/pack, moveRange 5) as the
// PRIMARY threat for the first time anywhere in Act II -- every Act II
// mission so far reached for Gallcyst/Sporethrower (13), Undertow (14,
// 15), or hostile mechs (16), and Splitfang hadn't appeared at all since
// Act I. A genuine fit for the fiction too: a fast, aggressive pack
// diving down the trench's own ramp gaps at a survey team that's already
// found something it shouldn't have, not a slow drift wandering in.
// Pinned at the ridge-shoulder spawn points (mapsHouseAmaranth.ts's own
// comment on the map); Crawlmass filler from the trench's own center
// spawn seam, the one point directly in the extraction party's path out.
//
// Sim-tested. First pass (4 Splitfang + 4 Crawlmass, turnLimit 16, the
// same allowance Warden's own Mission 17 needed for a comparable
// deploy-to-exit distance): **95% (143/150)**, LOSS=7, COMMANDER_DOWN=0
// -- too easy, and the 10-pilot squad clears the trench with turns to
// spare. Pushed Splitfang to 6 -- barely moved (95%). Pushed to 8 --
// **100%**, a real non-monotonic result matching Mission 13's own
// finding: enough bodies die to counter-fire fast enough that the extra
// count is actually safer, not harder. Backed Splitfang to 6 and doubled
// Crawlmass (4->8) instead -- still only 96%. The real lever turned out
// to be turnLimit, not enemy count, matching this mission's own Warden-
// side precedent (that mission's own tuning note: its 28-wide map needed
// MORE turns, not fewer, to stop timeout losses -- the inverse problem,
// but the same underlying fact that this shape's difficulty lives in the
// clock). Trimmed turnLimit 16->12: **73-75% across two independent
// n=150 batches** (113/150 and 109/150), LOSS-only both times,
// COMMANDER_DOWN=0 -- a genuinely different failure texture from every
// other Act II mission this pass has built, time pressure instead of
// death pressure, same identity this objective type already earned in
// its original 5-pilot version. Traced a losing run: Orin caught short of
// the exit tile when the clock runs out, same legible race shape.
// Comfortably clear of the 30% floor. Shipped at 6 Splitfang + 8
// Crawlmass, turnLimit 12.
export const HOUSE_AMARANTH_MISSION_17: CampaignMission = {
  id: "mission_house_amaranth_17",
  displayName: "House Amaranth II.17 — What Grows Beneath",
  mapId: "map_house_amaranth_what_grows_beneath",
  briefing:
    "Orin found the root structure before anyone told her to look for one — too regular to be natural, running deeper than the survey ever charted. She's already logging it. Get her out with the readings before whatever's guarding it decides the interest isn't mutual. Marrow's own read: it's not within tolerance. Command wants it logged that way anyway.",
  objective: "extract_unit",
  objectiveParams: { turnLimit: 12, extractUnitId: "pilot_orin" },
  playerPilotIds: HOUSE_AMARANTH_ACT2_DEFAULT_SQUAD,
  enemyWaves: [
    {
      archetypeId: "bloom_splitfang",
      count: 6,
      atTurn: 1,
      spawnAt: [
        { x: 5, y: 2 },
        { x: 18, y: 2 },
        { x: 5, y: 7 },
        { x: 18, y: 7 },
      ],
    },
    { archetypeId: "bloom_crawlmass", count: 8, atTurn: 1, spawnAt: [{ x: 11, y: 5 }] },
  ],
  events: [
    {
      id: "ev_what_grows_beneath_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Orin: “Colonel, this isn't drift growth. This is planted. Whatever's down here, it's been down here a while.”" },
      once: true,
    },
  ],
  rewardPoints: 145,
  heirloomCharge: "locked",
};

// Mission 18, "Cultivator's Gambit" (Act II -- The Bargain Holds, plan doc
// §6: "Deploying a new containment array directly onto contested, still-
// hot ground"). `contested_landing` -- new to House Amaranth's own
// campaign, though the objective type itself isn't new to the engine:
// Warden's own Mission 15 "Landfall" introduced it (checked directly,
// engine/mission.ts's contested_landing branch is byte-for-byte
// eliminate_all's own win check -- the "opposed drop" identity lives
// entirely in the map/wave design, not new engine code). Landfall itself
// is a beachhead, one direction of approach. Cultivator's Gambit is a
// different shape of the same idea, matching its own "gambit" framing:
// mapsHouseAmaranth.ts's own CULTIVATORS_GAMBIT_TILES drops the deploy
// block dead center of the hot ground with spawn seams on all four
// compass points, none more than a few tiles from the block's own edge --
// a landing surrounded, not a landing under fire from one direction. Ten
// deploy pads match the 10-pilot squad exactly, no wraparound.
//
// Sirenmaw (data/bloom.ts: flight_membrane, pack intelligence, moveRange
// 6, attackRange 1-2, onHit fx_debuff_attack) as the PRIMARY threat --
// first time anywhere in this campaign; its only prior appearance was
// Act I's own Mission 12 finale as a turn-5 reinforcement wave, never the
// opener. A genuine fit for both the fiction (something already airborne
// over ground that's still smoking closes on a landing craft before it's
// even fully down) and the map (a flier already has the reach to converge
// from all four spawn seams on turn 1 regardless of what's directly
// underneath it, which is the actual mechanical point of a landing
// surrounded rather than funneled). Crawlmass fills the same turn from
// the compass seams as ground pressure once the squad's attention is
// split skyward.
export const HOUSE_AMARANTH_MISSION_18: CampaignMission = {
  id: "mission_house_amaranth_18",
  displayName: "House Amaranth II.18 — Cultivator's Gambit",
  mapId: "map_house_amaranth_cultivators_gambit",
  briefing:
    "The array goes down here, on ground that was still contested an hour ago — Marrow's own order, over the objections of everyone who had to sign off on it. Whatever's still circling this patch hasn't gotten the message that the fight here is supposed to be over. Land it. Hold long enough for the array to root.",
  objective: "contested_landing",
  objectiveParams: { turnLimit: 14 },
  playerPilotIds: HOUSE_AMARANTH_ACT2_DEFAULT_SQUAD,
  enemyWaves: [
    {
      archetypeId: "bloom_sirenmaw",
      count: 10,
      atTurn: 1,
      spawnAt: [
        { x: 8, y: 2 },
        { x: 9, y: 2 },
        { x: 3, y: 5 },
        { x: 4, y: 5 },
        { x: 16, y: 4 },
        { x: 17, y: 4 },
        { x: 11, y: 7 },
        { x: 12, y: 7 },
      ],
    },
    {
      archetypeId: "bloom_crawlmass",
      count: 8,
      atTurn: 1,
      spawnAt: [
        { x: 8, y: 2 },
        { x: 9, y: 2 },
        { x: 3, y: 5 },
        { x: 4, y: 5 },
        { x: 16, y: 4 },
        { x: 17, y: 4 },
        { x: 11, y: 7 },
        { x: 12, y: 7 },
      ],
    },
  ],
  events: [
    {
      id: "ev_cultivators_gambit_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Marrow: “Down and hold. Nobody told the Bloom this ground's already spoken for — we're about to remind it.”" },
      once: true,
    },
  ],
  rewardPoints: 150,
  heirloomCharge: "locked",
};

// Mission 19, "The Weight of the Seal" (Act II -- The Bargain Holds, plan
// doc §6: "Halcyon Amaranth herself visits the front for the first time;
// Marrow holds a real fight while explaining, live, why the numbers still
// work"). `hold_zone`. Halcyon's first in-person appearance anywhere in
// this campaign -- Mission 5 "The Seal Arrives" was her seal-holder proxy
// on a controlled muster ground, Mission 9 "Loyalist Eyes" a hostile
// auditor on a managed tour. This is deliberately different: an actual
// forward overlook at the front line, a real fight breaking out around
// her rather than a rehearsed one staged for her benefit.
//
// Gallcyst (data/bloom.ts: sessile, moveRange 0, attackRange [1,3]) dug
// in on the hold block's own WEST flank, between deploy and the zone.
// Splitfang seams north and south for fast harassment converging on the
// hold block from above and below. A fresh pairing for this campaign's
// own hold_zone missions -- Gallcyst was paired with Sporethrower in
// Mission 13, never with Splitfang before.
//
// Sim-tested, and a real placement bug caught on the first pass -- not
// just a difficulty number. First attempt dug Gallcyst in past the hold
// block's own EAST edge (col 17 vs. the block's own cols 11-14): **100%
// (150/150)**, LOSS=0, COMMANDER_DOWN=0, even at 7 Gallcyst + 8 Splitfang.
// Traced a verbose run: Gallcyst never fired a single shot the entire
// mission. hold_zone only requires ONE hold tile occupied
// (engine/mission.ts's own win check), so the squad always claims the
// tile nearest deploy -- col 11, six tiles from a col-17 Gallcyst and
// outside its own attackRange 3 every single run. A stationary archetype
// makes its own placement a real correctness question, not just flavor --
// moved it to the block's WEST flank (col 9, two tiles from the near hold
// edge, inside range regardless of which tile gets claimed first).
//
// Re-tested at the original 7/8 counts with the corrected placement:
// **0% (0/150)**, LOSS=10, COMMANDER_DOWN=140 -- a second real cliff, now
// on the difficulty side rather than the placement side. Backed off hard
// to 3 Gallcyst + 4 Splitfang: **100%**. Bisected: 5 Gallcyst + 6
// Splitfang landed right on the floor itself (**31%, 46/150**) -- too
// close to risk given how steep every step of this curve has been.
// Backed off one more step to 4 Gallcyst + 6 Splitfang: **67% (100/150)**
// and **70% (105/150)** across two independent batches, a real mix of
// LOSS and COMMANDER_DOWN both times. Traced a losing run: the squad
// spends long enough clearing the west-flank Gallcyst and the Splitfang
// harassment that it never actually settles onto the hold block before
// turnLimit runs out -- "Loss: turn limit reached without holding the
// zone," a genuinely different failure texture from Mission 18's cornered
// commander (a pacing race caused by the approach fight itself, not a
// death spiral). Comfortably clear of the 30% floor and a full step away
// from the known 31% neighbor. Shipped at 4 Gallcyst + 6 Splitfang,
// Gallcyst on the west flank.
export const HOUSE_AMARANTH_MISSION_19: CampaignMission = {
  id: "mission_house_amaranth_19",
  displayName: "House Amaranth II.19 — The Weight of the Seal",
  mapId: "map_house_amaranth_the_weight_of_the_seal",
  briefing:
    "Halcyon Amaranth doesn't tour terraces. She's on the overlook anyway, and the numbers Marrow's been feeding her seal-holder for a year are about to get their first live audience. No rehearsal, no managed lane — whatever's actually out there today is what she sees. Hold the position. Explain the bargain while it's still holding.",
  objective: "hold_zone",
  objectiveParams: { turnLimit: 10, holdUntilTurn: 6 },
  playerPilotIds: HOUSE_AMARANTH_ACT2_DEFAULT_SQUAD,
  enemyWaves: [
    {
      archetypeId: "bloom_gallcyst",
      count: 4,
      atTurn: 1,
      spawnAt: [
        { x: 9, y: 3 },
        { x: 9, y: 4 },
        { x: 9, y: 5 },
      ],
    },
    {
      archetypeId: "bloom_splitfang",
      count: 6,
      atTurn: 1,
      spawnAt: [
        { x: 10, y: 1 },
        { x: 11, y: 1 },
        { x: 10, y: 9 },
        { x: 11, y: 9 },
      ],
    },
  ],
  events: [
    {
      id: "ev_the_weight_of_the_seal_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Halcyon Amaranth: “Show me the numbers working, Colonel. Not the report of them working.”" },
      once: true,
    },
  ],
  rewardPoints: 155,
  heirloomCharge: "locked",
};

// Mission 20, "Marrow's Line" (Act II close, plan doc §5: "the shared
// convergence, mechanically" -- the same battle Warden Company fights as
// AMARANTH_MISSION_20/eliminate_all in campaignAmaranth.ts, played from
// House Amaranth's own side per that section's explicit call: "House
// Amaranth's own version of the same battle needs a different win
// condition... proposed as Extract Unit, objective reframed as a
// disciplined disengagement rather than a rout." Separate map/mission
// entry, not a reuse of Warden's data (deploy zones, composition, and the
// objective itself all differ by side even though the battlefield and
// beat are conceptually the same) -- mapsHouseAmaranth.ts's own
// HOUSE_AMARANTH_MARROWS_LINE_TILES comment covers the geometry.
//
// extractUnitId: "pilot_marrow" -- the mission's whole point, and covered
// by her own exemptFromPermadeath flag (HOUSE_AMARANTH_PILOTS) if the
// extraction goes badly, same safety net Warden's own named leads carry.
// Two new hostile-mech archetypes needed for this fight (units.ts): no
// prior mission anywhere in this file has fought Warden Company as the
// enemy, every existing Warden pilot only ever appears on the player
// side. WARDEN_RIVAL_MECHS' own hostile_mech_rourke (2nd Lt. Dessa
// Rourke, meeps, tier C) is the boss threat; WARDEN_HOSTILE_MECHS' own
// 4-unit "Warden Company Trooper" escort (tank/meeps/meeps/reeps, tier G)
// mirrors AMARANTH_HOSTILE_MECHS' own generic-detachment shape.
//
// Balance target for this mission is the tightened rule (this session, 31
// Aug 2026): sim win rate at or under 15%, not the older "fine if ≥30%"
// floor every mission through Mission 19 shipped against -- a genuinely
// harder bar, deliberately not applied retroactively to Missions 1-19
// (a separate, dedicated n=500 retune pass across the whole campaign is
// planned later; this pass isn't chasing that precision either, just
// shipping under the new ceiling with normal sample sizes).
//
// Sim-tested, and a real map bug caught on the first pass, not just a
// difficulty number -- same shape of catch as Mission 19's Gallcyst
// placement. First draft put the exit tiles immediately adjacent to
// deploy (both hugging the same east edge, enemy spawns far west): 100%
// win at every enemy count tried, including 18 enemies against a 12-pilot
// squad, because Marrow could just walk out in 1-2 turns without ever
// meeting the enemy at all. Rebuilt the map (mapsHouseAmaranth.ts's own
// HOUSE_AMARANTH_MARROWS_LINE_TILES comment) with deploy west and the
// exit a full traversal away east, Warden Company spawning as a
// north/south pincer plus a center blocker (Rourke, "closing a line") two
// -thirds of the way down the lane -- the fight the mission's own fiction
// describes. At the base 1 Rourke + 4 troopers (1 per path) with the
// corrected geometry: 75% (75/100), a real engagement now, still far
// above target. Doubled the trooper escort to 2 per path (9 enemies):
// 18% (18/100), right at the edge. Added a second Rourke (10 enemies, 2
// Rourke + 2 per trooper path): 12% (18/150) and 9% (18/200) across two
// more independent batches -- comfortably under the 15% ceiling without
// being a rout in the other direction (54/450 wins pooled, ~12%, not a
// single lucky/unlucky batch). Shipped at 2 Rourke + 2 per trooper path,
// 10 enemies total. extract_unit's own zero-tolerance loss condition
// already punishes added pressure harder than its surface numbers suggest
// (Mission 17's own comment) -- exactly why 10 enemies against a 12-pilot
// squad lands this hard once the map actually makes them fight.
export const HOUSE_AMARANTH_MISSION_20: CampaignMission = {
  id: "mission_house_amaranth_20",
  displayName: "House Amaranth II.20 — Marrow's Line",
  mapId: "map_house_amaranth_marrows_line",
  briefing:
    "Warden Company found the line before command wanted them to. Rourke's already committed — this isn't a probe, it's a push. Marrow doesn't need to win this ground, she needs her people off it intact. Cover the withdrawal. Get her clear.",
  objective: "extract_unit",
  objectiveParams: { turnLimit: 13, extractUnitId: "pilot_marrow" },
  playerPilotIds: HOUSE_AMARANTH_ACT2_DEFAULT_SQUAD,
  enemyWaves: [
    { archetypeId: "hostile_mech_rourke", count: 2, atTurn: 1, spawnAt: [{ x: 15, y: 5 }] },
    { archetypeId: "hostile_mech_warden_01", count: 2, atTurn: 1, spawnAt: [{ x: 10, y: 2 }] },
    { archetypeId: "hostile_mech_warden_02", count: 2, atTurn: 1, spawnAt: [{ x: 10, y: 2 }] },
    { archetypeId: "hostile_mech_warden_03", count: 2, atTurn: 1, spawnAt: [{ x: 10, y: 9 }] },
    { archetypeId: "hostile_mech_warden_04", count: 2, atTurn: 1, spawnAt: [{ x: 10, y: 9 }] },
  ],
  events: [
    {
      id: "ev_marrows_line_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Marrow: “Warden Company's Rourke. Good instincts, bad timing — she's here to close a line I don't intend to hold. Fall back in order. Nobody plays hero on my ground today.”" },
      once: true,
    },
  ],
  rewardPoints: 165,
  heirloomCharge: "locked",
};

export const HOUSE_AMARANTH_ACT2: CampaignMission[] = [
  HOUSE_AMARANTH_MISSION_13,
  HOUSE_AMARANTH_MISSION_14,
  HOUSE_AMARANTH_MISSION_15,
  HOUSE_AMARANTH_MISSION_16,
  HOUSE_AMARANTH_MISSION_17,
  HOUSE_AMARANTH_MISSION_18,
  HOUSE_AMARANTH_MISSION_19,
  HOUSE_AMARANTH_MISSION_20,
];

// Act III, "The Stalling Season" (plan doc §6) -- opens Mission 21.
// House Amaranth's own front from here on: after Mission 20's shared
// convergence, this campaign no longer mirrors Warden's Act 2/3 beats
// (plan doc §2, decision 2 -- "a genuinely separate front"). Still on
// HOUSE_AMARANTH_ACT2_DEFAULT_SQUAD -- no Third Lance integration exists
// for this roster yet (grep-confirmed against campaignAmaranth.ts's own
// integrateThirdLance() precedent before assuming otherwise), so the
// 10-pilot squad from Act II carries over unchanged until that's built.
//
// Mission 21, "After the Line" (plan doc §6: "Marrow returns from the
// duel changed -- not broken from the bargain, committed to it harder,
// for reasons the squad doesn't fully understand yet." eliminate_all).
// New map (mapsHouseAmaranth.ts's own AFTER_THE_LINE_TILES comment covers
// the geometry -- deliberately the same disputed scrub/rubble ground
// Mission 20 was fought over, not this campaign's usual bloom_mat
// terrace, read as literal continuity: the Bloom moves into the wreckage
// once both militaries pull back).
//
// New balance target, first Act III mission built under it: sim win rate
// at or under 15% (the new rule this session, set right after Mission 20
// shipped -- see the priority-queue-equivalent note in
// Consolidated_Build_Plan_Progress.md), not the old ≥30% floor.
//
// Enemy composition: bloom_undertow (burrowed, pinned at the wreckage's
// own west/east flank spawn seams -- an ambush hidden in the debris,
// matching "the squad doesn't fully understand yet") plus bloom_crawlmass
// as open-field swarm filler at the map's far east seams. Two threat
// shapes, not a third stacked on for its own sake -- this campaign's own
// established "two Sporethrower/two ranged units is one too many" lesson
// (Missions 6/7/11) argues against reaching for a third archetype here
// just because the map has eight spawn seams to fill.
//
// Sim-tuning journey, against the new ≤15% ceiling (npx tsx
// src/sim/runBatch.ts N mission_house_amaranth_21):
export const HOUSE_AMARANTH_MISSION_21: CampaignMission = {
  id: "mission_house_amaranth_21",
  displayName: "House Amaranth III.21 — After the Line",
  mapId: "map_house_amaranth_after_the_line",
  briefing:
    "The line held. Marrow came back from it quieter, not shaken — quieter the way a decision looks once it's actually been made. Whatever she saw out there past Rourke's own escort, she hasn't said. What she has said is that the terraces don't get to slip while she puts it into words. Clear the ground. The bargain doesn't pause for anyone's feelings, hers included.",
  objective: "eliminate_all",
  objectiveParams: { turnLimit: 16 },
  playerPilotIds: HOUSE_AMARANTH_ACT2_DEFAULT_SQUAD,
  enemyWaves: [
    {
      archetypeId: "bloom_undertow",
      count: 8,
      atTurn: 1,
      spawnAt: [
        { x: 8, y: 3 },
        { x: 13, y: 3 },
        { x: 8, y: 5 },
        { x: 13, y: 5 },
      ],
    },
    {
      archetypeId: "bloom_crawlmass",
      count: 16,
      atTurn: 1,
      spawnAt: [
        { x: 17, y: 2 },
        { x: 18, y: 2 },
        { x: 17, y: 8 },
        { x: 18, y: 8 },
      ],
    },
  ],
  events: [
    {
      id: "ev_after_the_line_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Marrow: “Whatever's out there tonight, it's not Warden Company. Just the Bloom, same as always. Let's keep it that simple.”" },
      once: true,
    },
  ],
  rewardPoints: 170,
  heirloomCharge: "locked",
};

// Mission 22, "Audit Under Fire" (Act III). Plan doc §6: "the loyalist
// audit turns hostile -- literally -- when a diversion relay comes under
// attack mid-inspection." First House Amaranth protect_asset mission --
// reuses the "dock" perimeter tile Warden's own Mission 22 introduced
// (engine/mission.ts's tickAssetDamage: PROTECT_ASSET_TICK_DAMAGE per
// hostile that ends its turn inside the zone, assetHp left at
// PROTECT_ASSET_DEFAULT_MAX_HP -- no bespoke override needed once the
// chokepoint geometry did the actual balancing). This relay is a
// SECONDARY one under inspection, not the original the whole program is
// built around (that's Mission 32, "Hold the Root," deliberately the
// heavier version of the same objective later in the act).
//
// Enemy Variety Reuse: Splitfang (17), Sirenmaw (18), Gallcyst (19), and
// Undertow (21) all had a recent primary-threat turn, so this one leans on
// Sporethrower instead -- a ranged, slow (moveRange 2, limbless) archetype
// that hasn't carried a mission on its own yet, a good mechanical fit for
// "hold a perimeter" pressure (it plinks the dock from range rather than
// needing to close), with Crawlmass as the usual swarm filler forcing the
// squad to split attention between the ranged threat and the rush.
//
// Sim-tuning journey, against the ≤15% ceiling (npx tsx
// src/sim/runBatch.ts N mission_house_amaranth_22):
export const HOUSE_AMARANTH_MISSION_22: CampaignMission = {
  id: "mission_house_amaranth_22",
  displayName: "House Amaranth III.22 — Audit Under Fire",
  mapId: "map_house_amaranth_audit_under_fire",
  briefing:
    "The governor's own auditor picked today of all days to walk the relay floor in person, clipboard and all, and the Bloom picked today to walk it too. Marrow's read is blunt: whoever gets there first decides what the audit actually finds. Hold the relay. Whatever's left standing is the only report that matters.",
  objective: "protect_asset",
  objectiveParams: { turnLimit: 14, assetName: "relay" },
  playerPilotIds: HOUSE_AMARANTH_ACT2_DEFAULT_SQUAD,
  enemyWaves: [
    {
      archetypeId: "bloom_sporethrower",
      count: 11,
      atTurn: 1,
      spawnAt: [
        { x: 2, y: 2 },
        { x: 7, y: 2 },
        { x: 12, y: 2 },
        { x: 2, y: 7 },
        { x: 7, y: 7 },
        { x: 12, y: 7 },
      ],
    },
    {
      archetypeId: "bloom_crawlmass",
      count: 20,
      atTurn: 1,
      spawnAt: [
        { x: 2, y: 2 },
        { x: 7, y: 2 },
        { x: 12, y: 2 },
        { x: 2, y: 7 },
        { x: 7, y: 7 },
        { x: 12, y: 7 },
      ],
    },
  ],
  events: [
    {
      id: "ev_audit_under_fire_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Marrow: \"The auditor's under the floor plating by now, if she's got any sense. Don't make a liar out of her paperwork. Hold the relay.\"" },
      once: true,
    },
  ],
  rewardPoints: 175,
  heirloomCharge: "locked",
};

// Mission 23, "The Root Answers Back" (Act III). Plan doc §6: "the Wellroot
// pushes back against containment for the first time -- not an escape, a
// negotiation, in the only language it has." First House Amaranth mission
// to feature the Wellroot itself (bloom_wellroot, data/bloom.ts -- the same
// colossal sessile boss Warden fights outright in their own Mission 21,
// "Cut the Root") -- placed as a fixed, unkillable-in-practice hazard
// (endurance 480) two tiles east of the hold block, in acid range of every
// hold tile, present as pressure rather than a kill target: hold_zone
// doesn't require eliminating it, which is the actual point -- this
// mission is about surviving what it's willing to do, not defeating it.
// Reinforcement archetype: bloom_choir -- fresh (Splitfang/Sirenmaw/
// Gallcyst/Undertow/Sporethrower all had a recent primary turn, 17-22), and
// its own weaponType is "sonic" -- the Choir's own attack IS a kind of
// language, which fits "in the only language it has" better than a generic
// swarm would.
//
// Sim-tuning journey, against the ≤15% ceiling (npx tsx
// src/sim/runBatch.ts N mission_house_amaranth_23):
export const HOUSE_AMARANTH_MISSION_23: CampaignMission = {
  id: "mission_house_amaranth_23",
  displayName: "House Amaranth III.23 — The Root Answers Back",
  mapId: "map_house_amaranth_the_root_answers_back",
  briefing:
    "The Wellroot's never done this before. It's not spreading, not retreating — it's answering. Every time the seal crew tightens the containment ring, something under the terrace pushes back at exactly that spot, like it's counting. Marrow's own read: it's not attacking. It's negotiating, in the only language it has. Hold the ring. Let it finish saying whatever this is.",
  objective: "hold_zone",
  objectiveParams: { turnLimit: 12, holdUntilTurn: 8 },
  playerPilotIds: HOUSE_AMARANTH_ACT2_DEFAULT_SQUAD,
  enemyWaves: [
    {
      archetypeId: "bloom_wellroot",
      count: 1,
      atTurn: 1,
      spawnAt: [{ x: 13, y: 4 }],
    },
    {
      archetypeId: "bloom_choir",
      count: 12,
      atTurn: 1,
      spawnAt: [
        { x: 9, y: 1 },
        { x: 10, y: 1 },
        { x: 7, y: 3 },
        { x: 7, y: 5 },
        { x: 9, y: 8 },
        { x: 10, y: 8 },
      ],
    },
  ],
  events: [
    {
      id: "ev_root_answers_back_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Marrow: \"Nobody fires on the root itself unless it moves first. It won't. Just hold the ring and let it finish.\"" },
      once: true,
    },
  ],
  rewardPoints: 180,
  heirloomCharge: "locked",
};

// Mission 24, "Seizure Order" (Act III). Plan doc §6: "sector command moves
// to seize the program by force, convinced it's a lie or a liability;
// Marrow has to get Halcyon out ahead of loyalist troops." extract_unit,
// but Halcyon Amaranth has never had a pilot record (she's a civilian
// governor, not a combat pilot) -- uses civilianSpawns/extractThreshold
// (the same mechanic Warden's own Mission 31 "The Last Convoy" introduced)
// with a single civilian instead of extractUnitId. extractThreshold left
// unset (defaults to civilianSpawns.length, i.e. 1 -- "everyone has to make
// it"), matching a single-VIP evacuation's real stakes. Halcyon spawns
// right next to deploy, same "the squad starts already escorting" placement
// The Last Convoy's own comment established, not racing to catch up to her.
//
// First fight against LOYALIST_HOSTILE_MECHS (data/units.ts) -- sector
// command's own regulars, a new human-military hostile faction distinct
// from Warden Company, introduced for this mission specifically.
//
// Sim-tuning journey, against the ≤15% ceiling (npx tsx
// src/sim/runBatch.ts N mission_house_amaranth_24):
export const HOUSE_AMARANTH_MISSION_24: CampaignMission = {
  id: "mission_house_amaranth_24",
  displayName: "House Amaranth III.24 — Seizure Order",
  mapId: "map_house_amaranth_seizure_order",
  briefing:
    "Sector command's stopped asking questions and started sending troops — Halcyon's own seal-holder called it a liability review. Marrow calls it what it is. Get her to the far tree line before sector command's own regulars close the gap. This isn't a negotiation anymore.",
  objective: "extract_unit",
  objectiveParams: { turnLimit: 14 },
  playerPilotIds: HOUSE_AMARANTH_ACT2_DEFAULT_SQUAD,
  civilianSpawns: [{ at: { x: 2, y: 5 }, displayName: "Halcyon Amaranth" }],
  enemyWaves: [
    { archetypeId: "hostile_mech_loyalist_01", count: 2, atTurn: 1, spawnAt: [{ x: 9, y: 1 }] },
    { archetypeId: "hostile_mech_loyalist_02", count: 2, atTurn: 1, spawnAt: [{ x: 10, y: 1 }] },
    { archetypeId: "hostile_mech_loyalist_03", count: 2, atTurn: 1, spawnAt: [{ x: 9, y: 8 }] },
    { archetypeId: "hostile_mech_loyalist_04", count: 2, atTurn: 1, spawnAt: [{ x: 10, y: 8 }] },
  ],
  events: [
    {
      id: "ev_seizure_order_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Marrow: \"Sector command wants a liability off the books. She's not a liability, she's the Governor. Move.\"" },
      once: true,
    },
  ],
  rewardPoints: 185,
  heirloomCharge: "locked",
};

// Mission 25, "Going Dark" (Act III). Plan doc §6: "cut off from sector
// command and from Warden's border entirely, the front holds alone for the
// first time." survive_n_turns. Map spawns from all four sides at once
// (data/mapsHouseAmaranth.ts's own comment on the map) -- three staggered
// waves rather than one burst, since "holds alone" reads as sustained
// attrition, not a single spike. Archetypes: Crawlmass (this campaign's
// standing swarm filler) plus Splitfang, fresh again after Mission 17's own
// turn eight missions back.
//
// Sim-tuning journey, against the ≤15% ceiling (npx tsx
// src/sim/runBatch.ts N mission_house_amaranth_25):
export const HOUSE_AMARANTH_MISSION_25: CampaignMission = {
  id: "mission_house_amaranth_25",
  displayName: "House Amaranth III.25 — Going Dark",
  mapId: "map_house_amaranth_going_dark",
  briefing:
    "The relay to sector command's gone quiet, and so has the line to Warden's own border post — not damaged, silenced, on purpose, by someone who wanted the terrace alone before tonight started. No reinforcement, no channel out, nothing but what's already standing here. Hold the ground. Nobody's coming.",
  objective: "survive_n_turns",
  objectiveParams: { turnLimit: 14 },
  playerPilotIds: HOUSE_AMARANTH_ACT2_DEFAULT_SQUAD,
  enemyWaves: [
    {
      archetypeId: "bloom_crawlmass",
      count: 28,
      atTurn: 1,
      spawnAt: [
        { x: 8, y: 1 },
        { x: 9, y: 1 },
        { x: 8, y: 9 },
        { x: 9, y: 9 },
      ],
    },
    {
      archetypeId: "bloom_splitfang",
      count: 12,
      atTurn: 5,
      spawnAt: [
        { x: 0, y: 4 },
        { x: 19, y: 4 },
      ],
    },
    {
      archetypeId: "bloom_splitfang",
      count: 12,
      atTurn: 9,
      spawnAt: [
        { x: 0, y: 6 },
        { x: 19, y: 6 },
      ],
    },
  ],
  events: [
    {
      id: "ev_going_dark_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Marrow: \"Nobody's coming. Not tonight. Whatever's out there, we're what's standing between it and the terrace, full stop.\"" },
      once: true,
    },
  ],
  rewardPoints: 190,
  heirloomCharge: "locked",
};

// Mission 26, "The Bramble" (Act III) -- the new signature threat's debut.
// Plan doc §6: "a strain of the diverted Bloom breaks true containment
// doctrine for the first time -- fast, aggressive, nothing like the tame
// drift the program is built around." eliminate_all. First mission to
// field bloom_bramble (data/bloom.ts) -- validated via combat_sim.py's own
// "13. THE BRAMBLE" section before this mission was built, per house rule.
//
// Sim-tuning journey, against the ≤15% ceiling (npx tsx
// src/sim/runBatch.ts N mission_house_amaranth_26):
export const HOUSE_AMARANTH_MISSION_26: CampaignMission = {
  id: "mission_house_amaranth_26",
  displayName: "House Amaranth III.26 — The Bramble",
  mapId: "map_house_amaranth_the_bramble",
  briefing:
    "Whatever's growing out there isn't the drift the program is built to manage. It's not tame, it's not slow, and it isn't stopping at the containment lines like every other patch on this terrace has for thirty years. Marrow's own read is blunt: this isn't a wilder version of the usual. It's something the bargain never accounted for. Clear it before it reaches the crop rows proper.",
  objective: "eliminate_all",
  objectiveParams: { turnLimit: 16 },
  playerPilotIds: HOUSE_AMARANTH_ACT2_DEFAULT_SQUAD,
  enemyWaves: [
    {
      archetypeId: "bloom_bramble",
      count: 13,
      atTurn: 1,
      spawnAt: [
        { x: 15, y: 1 },
        { x: 16, y: 1 },
        { x: 15, y: 9 },
        { x: 16, y: 9 },
      ],
    },
  ],
  events: [
    {
      id: "ev_the_bramble_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Marrow: \"That's not drift. Drift doesn't move like that. Whatever this is, it doesn't get a containment line — it gets cleared.\"" },
      once: true,
    },
  ],
  rewardPoints: 200,
  heirloomCharge: "locked",
};

// Mission 27, "Salvage the Season" (Act III). Plan doc §6: "pulling a
// whole terrace's ward-crop technicians out ahead of a Bramble breach."
// extract_unit, civilianSpawns (multi-unit, unlike Mission 24's single
// VIP) -- extractThreshold left unset (everyone has to make it; this
// mission isn't flagged "scripted partial loss" in the plan the way
// Mission 31 later is). Bramble (Mission 26) reappears as the pursuing
// threat.
//
// Sim-tuning journey, against the ≤15% ceiling (npx tsx
// src/sim/runBatch.ts N mission_house_amaranth_27):
export const HOUSE_AMARANTH_MISSION_27: CampaignMission = {
  id: "mission_house_amaranth_27",
  displayName: "House Amaranth III.27 — Salvage the Season",
  mapId: "map_house_amaranth_salvage_the_season",
  briefing:
    "The technicians who've kept the ward-crop rigs running all season are still at their stations, because nobody told them to stop, because until an hour ago nobody thought they'd need to. The Bramble's already through the north terrace. Get every one of them to the tree line before it's through this one too.",
  objective: "extract_unit",
  objectiveParams: { turnLimit: 16, extractThreshold: 4 },
  playerPilotIds: HOUSE_AMARANTH_ACT2_DEFAULT_SQUAD,
  civilianSpawns: [
    { at: { x: 2, y: 3 }, displayName: "Ward-Crop Technician — Rigs" },
    { at: { x: 2, y: 4 }, displayName: "Ward-Crop Technician — Seals" },
    { at: { x: 2, y: 5 }, displayName: "Ward-Crop Technician — Foreman" },
    { at: { x: 2, y: 6 }, displayName: "Ward-Crop Technician — Wardens" },
    { at: { x: 3, y: 4 }, displayName: "Ward-Crop Technician — Runner" },
  ],
  enemyWaves: [
    {
      archetypeId: "bloom_bramble",
      count: 4,
      atTurn: 3,
      spawnAt: [
        { x: 10, y: 1 },
        { x: 11, y: 1 },
        { x: 10, y: 8 },
        { x: 11, y: 8 },
      ],
    },
    {
      archetypeId: "bloom_bramble",
      count: 3,
      atTurn: 5,
      spawnAt: [
        { x: 10, y: 1 },
        { x: 10, y: 8 },
      ],
    },
  ],
  events: [
    {
      id: "ev_salvage_the_season_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Marrow: \"Nobody stays for the paperwork. Everyone to the tree line, now — the season's already over, we're just the only ones who know it yet.\"" },
      once: true,
    },
  ],
  rewardPoints: 195,
  heirloomCharge: "locked",
};

// Mission 28, "Marrow's Choice" (Act III). Warden's own mirrored mission
// (campaignAmaranth.ts's AMARANTH_MISSION_28, "Marrow's Reckoning") closes
// their side of this rivalry against hostile_mech_marrow. This is the
// other half of the same beat: House Amaranth's own rematch against
// hostile_mech_rourke + WARDEN_HOSTILE_MECHS, the exact antagonists from
// Mission 20 ("Marrow's Line"), reused rather than reflavored, because
// this IS that fight again. Mission 20 was extract_unit -- Marrow
// disengaging, a retreat lane built into the map itself (the exit tiles).
// This map (mapsHouseAmaranth.ts's own MARROWS_CHOICE_TILES comment)
// deliberately has none. eliminate_all, framed as the point where the
// retreat option closes for good -- "the last moment either of them could
// still have walked away clean," per the plan doc's own phrasing for this
// beat.
//
// Wave structure mirrors Warden's own Mission 28 build-log lesson ("two
// more troopers held back... rather than everyone landing on turn 1"):
// turn 1 opens from the alcove clusters closer to deploy, a turn-5 wave
// adds reinforcements from the map's own far-east corner seams.
//
// Sim-tuning journey, against the ≤15% ceiling (npx tsx
// src/sim/runBatch.ts N mission_house_amaranth_28) -- this mission needed
// far more downward correction than any prior Act III mission, worth
// recording in full:
//
//   1 Rourke, 2 each Warden 01-04, turn 1 (10 total, single burst,
//     Mission 20's exact composition)                       -> 0% (COMMANDER_DOWN
//                                                                  150/150 -- Rourke alone
//                                                                  hits for 88 twice in one
//                                                                  turn against an isolated
//                                                                  target; two full
//                                                                  9-10-strong clusters only
//                                                                  9-11 tiles from deploy
//                                                                  converge by turn 2, before
//                                                                  the squad has any chance to
//                                                                  regroup)
//   1 Rourke alone                                           -> 100%
//   1 Rourke + 1 each Warden 01-04 (5 total, single burst)   -> 100%
//   1 Rourke + 2 each Warden 01-04 (9 total, single burst)   -> 10%
//   1 Rourke + 1 each Warden 01-04 turn 1 (5), + 1 each
//     Warden 01-04 turn 5 (4) -- same 9 total, wave-split     -> 98% (confirms
//                                                                  the real lesson: splitting
//                                                                  a given total into two
//                                                                  waves is not a cosmetic
//                                                                  change here -- it lets the
//                                                                  squad consolidate and heal
//                                                                  between waves, which is a
//                                                                  much bigger swing than
//                                                                  raising or lowering the
//                                                                  total by a couple of units)
//   1 Rourke + 2 each Warden 01-04 turn 1 (9), + 1 each
//     Warden 01/03 turn 5 (2) -- 11 total                     -> 9-10% (10/100, 17/200,
//                                                                  27/300 pooled ≈ 9%)
//
// Shipped at the last composition. The turn-1 wave alone already does
// almost all the work (COMMANDER_DOWN in the 89-182 range out of every
// batch happens well before turn 5), so the reinforcement wave reads as
// what it's meant to -- Warden Company closing the door on any opening the
// squad might have found -- without being what actually decides the
// fight.
export const HOUSE_AMARANTH_MISSION_28: CampaignMission = {
  id: "mission_house_amaranth_28",
  displayName: "House Amaranth III.28 — Marrow's Choice",
  mapId: "map_house_amaranth_marrows_choice",
  briefing:
    "Rourke came back for the line Marrow wouldn't hold last time — same rival, same ground, no lane out built into it this time. Marrow's read is short: last time was a withdrawal, not a surrender, and Warden Company mistook one for the other. Clear the field. There's no falling back off this one.",
  objective: "eliminate_all",
  objectiveParams: { turnLimit: 15 },
  playerPilotIds: HOUSE_AMARANTH_ACT2_DEFAULT_SQUAD,
  enemyWaves: [
    { archetypeId: "hostile_mech_rourke", count: 1, atTurn: 1, spawnAt: [{ x: 11, y: 2 }] },
    { archetypeId: "hostile_mech_warden_01", count: 2, atTurn: 1, spawnAt: [{ x: 11, y: 2 }] },
    { archetypeId: "hostile_mech_warden_02", count: 2, atTurn: 1, spawnAt: [{ x: 11, y: 2 }] },
    { archetypeId: "hostile_mech_warden_03", count: 2, atTurn: 1, spawnAt: [{ x: 11, y: 9 }] },
    { archetypeId: "hostile_mech_warden_04", count: 2, atTurn: 1, spawnAt: [{ x: 11, y: 9 }] },
    { archetypeId: "hostile_mech_warden_01", count: 1, atTurn: 5, spawnAt: [{ x: 24, y: 1 }, { x: 25, y: 1 }] },
    { archetypeId: "hostile_mech_warden_03", count: 1, atTurn: 5, spawnAt: [{ x: 24, y: 10 }, { x: 25, y: 10 }] },
  ],
  events: [
    {
      id: "ev_marrows_choice_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Marrow: \"Last time I gave you a lane out, Rourke. That offer doesn't come around twice — not from me, not today.\"" },
      once: true,
    },
  ],
  rewardPoints: 215,
  heirloomCharge: "locked",
};

// Mission 29, "The Governor's Answer" (Act III). Plan doc §6: "sector
// command's seizure force actually lands; House Amaranth loses a whole
// outer terrace holding them off." hold_zone, tagged "scripted strategic
// cost, mirrors Warden's Mission 29." Resolved the same way Warden's own
// Mission 29 ("The Outer Ring Falls") resolved an identical tag -- a real,
// winnable-and-losable hold_zone, not a forced-loss mechanic. The
// narrative cost lands as a dialogue beat regardless of the tactical
// result (ev_governors_answer_closure below, on objective_complete, same
// technique Mission 28's own closure event already used) -- House Amaranth
// still loses the terrace in-fiction even on a genuine tactical win,
// matching how Warden's own build log describes theirs ("the ring falls"
// as Command's own withdrawal order on a real win, not a scripted loss).
//
// First mission fielding LOYALIST_HOSTILE_MECHS as the hold_zone THREAT
// (not the extract_unit escort role they debuted in at Mission 24) -- "a
// whole outer terrace" reads as a real siege, five waves converging from
// four separate map directions (map's own THE_GOVERNORS_ANSWER_TILES
// comment covers the geometry), matching Warden's own Mission 29 build log
// ("5-wave siege").
//
// Sim-tuning journey, against the ≤15% ceiling (npx tsx
// src/sim/runBatch.ts N mission_house_amaranth_29) -- the real lever here
// turned out to be wave SPACING, not wave size, and by a wide margin:
//
//   4/wave x5, turns 1/3/5/7/9 (20 total, spread)         -> 74%
//   5/wave x5, turns 1/3/5/7/9 (25 total, spread)          -> 0%
//   4/wave x5, turns 1/3/5/7/9 (20 total, spread)          -> 45% (re-tested
//                                                              at the
//                                                              midpoint,
//                                                              confirmed
//                                                              too easy)
//   4/wave x5, turns 1/2/3/4/5 (20 total, tight)            -> 3% (compressing
//                                                              the same 20
//                                                              total from a
//                                                              9-turn spread
//                                                              to a 5-turn
//                                                              one swung it
//                                                              from 45% to
//                                                              3% -- no
//                                                              recovery
//                                                              window
//                                                              between
//                                                              waves matters
//                                                              far more
//                                                              than the
//                                                              total count)
//   4/4/4/4/4, turns 1/3/4/5/6 (20 total, only the
//     wave-1-to-wave-2 gap widened by a single turn)         -> 96% (confirms
//                                                              it's
//                                                              specifically
//                                                              that first
//                                                              gap: every
//                                                              other wave
//                                                              stayed
//                                                              back-to-back
//                                                              and the
//                                                              result still
//                                                              flipped from
//                                                              a near-total
//                                                              wipe to a
//                                                              near-auto-win)
//   4/4/4/3/3, turns 1/2/3/4/5 (18 total, tight)             -> 10% (15/150,
//                                                              re-confirmed
//                                                              15/150 --
//                                                              stable)
//
// Shipped at the last composition. Worth remembering for future multi-wave
// sieges: the gap between the FIRST two waves is a much sharper lever than
// total headcount or the spacing of every wave after it -- it decides
// whether the squad ever gets a turn to consolidate before the fight
// becomes simultaneous on two fronts.
export const HOUSE_AMARANTH_MISSION_29: CampaignMission = {
  id: "mission_house_amaranth_29",
  displayName: "House Amaranth III.29 — The Governor's Answer",
  mapId: "map_house_amaranth_the_governors_answer",
  briefing:
    "Sector command isn't sending an auditor this time. This is the seizure force itself, landing on four sides of the relay at once, and there's no version of this fight where the outer terrace is still standing when it's over. Marrow's only real order is to make them pay a genuine price for it. Hold the zone as long as the ground allows.",
  objective: "hold_zone",
  objectiveParams: { turnLimit: 16, holdUntilTurn: 12 },
  playerPilotIds: HOUSE_AMARANTH_ACT2_DEFAULT_SQUAD,
  enemyWaves: [
    { archetypeId: "hostile_mech_loyalist_01", count: 4, atTurn: 1, spawnAt: [{ x: 9, y: 1 }, { x: 10, y: 1 }] },
    { archetypeId: "hostile_mech_loyalist_02", count: 4, atTurn: 2, spawnAt: [{ x: 7, y: 3 }] },
    { archetypeId: "hostile_mech_loyalist_03", count: 4, atTurn: 3, spawnAt: [{ x: 22, y: 3 }, { x: 23, y: 3 }] },
    { archetypeId: "hostile_mech_loyalist_04", count: 3, atTurn: 4, spawnAt: [{ x: 7, y: 5 }] },
    { archetypeId: "hostile_mech_loyalist_02", count: 3, atTurn: 5, spawnAt: [{ x: 22, y: 5 }, { x: 23, y: 5 }] },
  ],
  events: [
    {
      id: "ev_governors_answer_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Marrow: \"Four sides, all at once — that's not a probe, that's a governor who's done asking. Hold what we can hold.\"" },
      once: true,
    },
    {
      id: "ev_governors_answer_closure",
      trigger: { type: "objective_complete" },
      action: { type: "dialogue", text: "Marrow: \"Ground's ours for now. Won't be by morning — command's already written this terrace off, whatever we just did to hold it. Pull what's salvageable and fall back to the inner line.\"" },
      once: true,
    },
  ],
  rewardPoints: 220,
  heirloomCharge: "locked",
};

// Mission 30, "Two Fronts" (Act III). Plan doc §6: "fighting the Bramble
// and loyalist regulars in the same battle for the first time -- the
// two-front pressure the act has been building toward." eliminate_all.
// Deploy sits dead center of the map (mapsHouseAmaranth.ts's own
// TWO_FRONTS_TILES comment covers the geometry) -- the squad literally
// caught between both fronts, Bramble pressing from the west spawn seams,
// LOYALIST_HOSTILE_MECHS from the east ones. First mission fielding both a
// Bloom archetype and a human-military archetype on the same map at the
// same time.
//
// Sim-tuning journey, against the ≤15% ceiling (npx tsx
// src/sim/runBatch.ts N mission_house_amaranth_30) -- another sharp
// same-shape cliff, this time between two mixed-archetype totals rather
// than a single-archetype count:
//
//   13 total (3 Bramble/4 loyalist turn 1, 2 Bramble/4 loyalist turn 5)  -> 89%
//   26 total (6 Bramble/8 loyalist turn 1, 4 Bramble/8 loyalist turn 5)  -> 0%
//   19 total (4 Bramble/6 loyalist turn 1, 3 Bramble/6 loyalist turn 5)  -> 1%
//   14 total (3 Bramble/4 loyalist turn 1, 3 Bramble/4 loyalist turn 5)  -> 84%
//   17 total (4 Bramble/5 loyalist turn 1, 3 Bramble/5 loyalist turn 5)  -> 5% (5/100)
//   16 total (3 Bramble/5 loyalist turn 1, 3 Bramble/5 loyalist turn 5)  -> 3% (4/150)
//   17 total, re-confirmed                                              -> 4% (6/150;
//                                                                             11/250 pooled)
//
// Shipped at 17 total. Landed lower than most of this act's other
// missions (the established band's been roughly 7-13%) -- left as-is
// rather than pushed back up toward that band, since "the two-front
// pressure the act has been building toward" reads honestly as this act's
// single hardest fight, and 4% is still a real, sampled-nonzero win rate,
// not a wall.
export const HOUSE_AMARANTH_MISSION_30: CampaignMission = {
  id: "mission_house_amaranth_30",
  displayName: "House Amaranth III.30 — Two Fronts",
  mapId: "map_house_amaranth_two_fronts",
  briefing:
    "Sector command's regulars from the east, the Bramble from the west, and the squad standing on the one strip of ground between them. Marrow's not pretending this is a clean fight — it's two problems that happened to arrive on the same afternoon. Hold the middle. Neither side gets it.",
  objective: "eliminate_all",
  objectiveParams: { turnLimit: 16 },
  playerPilotIds: HOUSE_AMARANTH_ACT2_DEFAULT_SQUAD,
  enemyWaves: [
    { archetypeId: "bloom_bramble", count: 4, atTurn: 1, spawnAt: [{ x: 0, y: 2 }, { x: 1, y: 2 }] },
    { archetypeId: "hostile_mech_loyalist_01", count: 2, atTurn: 1, spawnAt: [{ x: 22, y: 2 }, { x: 23, y: 2 }] },
    { archetypeId: "hostile_mech_loyalist_03", count: 3, atTurn: 1, spawnAt: [{ x: 22, y: 2 }, { x: 23, y: 2 }] },
    { archetypeId: "bloom_bramble", count: 3, atTurn: 5, spawnAt: [{ x: 0, y: 8 }, { x: 1, y: 8 }] },
    { archetypeId: "hostile_mech_loyalist_02", count: 2, atTurn: 5, spawnAt: [{ x: 22, y: 8 }, { x: 23, y: 8 }] },
    { archetypeId: "hostile_mech_loyalist_04", count: 3, atTurn: 5, spawnAt: [{ x: 22, y: 8 }, { x: 23, y: 8 }] },
  ],
  events: [
    {
      id: "ev_two_fronts_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Marrow: \"East and west both, same afternoon. Somebody upstairs has a sense of humor. Hold the middle — neither one gets it.\"" },
      once: true,
    },
  ],
  rewardPoints: 225,
  heirloomCharge: "locked",
};

// Mission 31, "What the Program Costs" (Act III). Plan doc §6: "evacuating
// House Amaranth's own civilian ward-crop workers ahead of the Bramble
// breach -- not everyone gets out." extract_unit, multi-civilian, tagged
// "scripted partial loss, mirrors Warden's Mission 31." UNLIKE Mission 27
// (extractThreshold discovered empirically mid-tuning, no narrative
// partial-loss flag on that one), this mission's extractThreshold is set
// deliberately low from the start -- 3 of 6, half -- applying the Mission
// 27 finding proactively instead of rediscovering it: leaving
// extractThreshold unset for a multi-civilian mission is nearly an
// instant-loss trap the moment any one civilian dies, and this mission's
// own pitch already says the loss is real and expected, not a stretch
// goal to avoid.
//
// Map (mapsHouseAmaranth.ts's own WHAT_THE_PROGRAM_COSTS_TILES comment)
// reuses Mission 27's proven deploy-west/exit-east corridor shape, widened
// and with bloom_mat scattered more broadly (a worse containment failure
// than Mission 27's), plus one spawn seam INSIDE the corridor itself --
// the "staggered ambush" beat Warden's own Mission 31 build log names
// directly.
//
// Sim-tuning journey, against the ≤15% ceiling (npx tsx
// src/sim/runBatch.ts N mission_house_amaranth_31) -- landed in range on
// the first real composition tried, unlike most of this act's other
// missions, plausibly because applying the Mission 27 extractThreshold
// lesson up front (rather than discovering it mid-tuning) meant the
// starting point was already close to correct:
//
//   3/3 Bramble turn 1 (north/south seams) + 2 Bramble turn 3
//     (inside-corridor ambush seam), extractThreshold 3/6              -> 8/100 (8%)
//   same composition, re-confirmed                                     -> 11/150 (7%);
//                                                                          19/250 pooled ≈ 7.6%
//
// Shipped at that composition without further adjustment. Worth noting
// the failure mode split: outcome is LOSS-dominated (92-139 out of each
// batch), not COMMANDER_DOWN -- the squad itself usually survives the
// fight, the evacuation quota is what fails. That's the correct shape for
// this objective type and matches the pitch ("not everyone gets out," not
// "the squad gets wiped out").
export const HOUSE_AMARANTH_MISSION_31: CampaignMission = {
  id: "mission_house_amaranth_31",
  displayName: "House Amaranth III.31 — What the Program Costs",
  mapId: "map_house_amaranth_what_the_program_costs",
  briefing:
    "Six technicians still on the terrace when the breach alarm went up, and the Bramble is already inside the evac corridor, not just behind it. Marrow's not going to pretend everyone walks away from this one — get as many to the tree line as the ground allows, and don't let the ones who don't make it be the ones closest to safety when it happens.",
  objective: "extract_unit",
  objectiveParams: { turnLimit: 18, extractThreshold: 3 },
  playerPilotIds: HOUSE_AMARANTH_ACT2_DEFAULT_SQUAD,
  civilianSpawns: [
    { at: { x: 3, y: 2 }, displayName: "Ward-Crop Technician — Rigs" },
    { at: { x: 3, y: 3 }, displayName: "Ward-Crop Technician — Seals" },
    { at: { x: 3, y: 4 }, displayName: "Ward-Crop Technician — Foreman" },
    { at: { x: 3, y: 5 }, displayName: "Ward-Crop Technician — Wardens" },
    { at: { x: 3, y: 6 }, displayName: "Ward-Crop Technician — Runner" },
    { at: { x: 3, y: 7 }, displayName: "Ward-Crop Technician — Junior Hand" },
  ],
  enemyWaves: [
    { archetypeId: "bloom_bramble", count: 3, atTurn: 1, spawnAt: [{ x: 12, y: 1 }, { x: 13, y: 1 }] },
    { archetypeId: "bloom_bramble", count: 3, atTurn: 1, spawnAt: [{ x: 12, y: 8 }, { x: 13, y: 8 }] },
    { archetypeId: "bloom_bramble", count: 2, atTurn: 3, spawnAt: [{ x: 10, y: 4 }] },
  ],
  events: [
    {
      id: "ev_what_the_program_costs_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Marrow: \"It's already in the corridor. Move them now — whoever's slow is the one we lose.\"" },
      once: true,
    },
  ],
  rewardPoints: 230,
  heirloomCharge: "locked",
};

// Mission 32, "Hold the Root" (Act III). Plan doc §6: "defending the
// original diversion relay -- the one the whole program was built around
// -- through the Bramble's worst push." protect_asset, this campaign's
// SECOND (Mission 22 was the first, a secondary relay under loyalist
// audit). The plan doc's own objectiveParams.assetMaxHp comment
// anticipated this mission wanting "a different ship-toughness feel than
// 22" -- assetMaxHp overridden up from the default 300
// (PROTECT_ASSET_DEFAULT_MAX_HP, data/combatTables.ts) to 400, since this
// relay is the one the whole program depends on, not a secondary structure
// under inspection. assetName set to "the Root," matching the mission's
// own title rather than reusing Mission 22's "relay."
//
// Map (mapsHouseAmaranth.ts's own HOLD_THE_ROOT_TILES comment) is
// deliberately a different feel from Mission 22's walled-blockhouse
// causeway -- open ground already half-overrun, bloom_mat scattered on
// every side of the dock rather than behind chokepoints, spawn seams on
// three of four sides for "worst push" as literal geometry.
//
// Sim-tuning journey, against the ≤15% ceiling (npx tsx
// src/sim/runBatch.ts N mission_house_amaranth_32) -- the higher
// assetMaxHp (400 vs. Mission 22's default 300) meant a noticeably bigger
// headcount was needed to bring this one down to the ceiling than a
// straight per-Bramble comparison to Mission 26/30 would suggest:
//
//   11 total (4/4 turn 1, 3 turn 5)   -> 67%
//   17 total (6/6 turn 1, 5 turn 5)   -> 8/100 (8%)
//   17 total, re-confirmed             -> 9/150 (6%); 17/250 pooled ≈ 6.8%
//
// Shipped at 17 total. Same as Mission 27/31's own failure-mode split --
// worth checking here too: COMMANDER_DOWN dominates (92-140 out of every
// batch), not a slow assetHp bleed-out, meaning the squad gets overrun
// defending the dock well before the Root itself would have run out of
// HP. The higher assetMaxHp is doing its intended job (this relay doesn't
// die to attrition the way Mission 22's could) -- the mission's real
// difficulty is holding position against Bramble numbers, not managing a
// ticking asset clock.
export const HOUSE_AMARANTH_MISSION_32: CampaignMission = {
  id: "mission_house_amaranth_32",
  displayName: "House Amaranth III.32 — Hold the Root",
  mapId: "map_house_amaranth_hold_the_root",
  briefing:
    "This is the relay everything else was built to protect — lose this one and the whole diversion program stops meaning anything, terraces included. The Bramble knows it too, or acts like it does. Hold the dock. Whatever's left standing after, the Root has to be part of it.",
  objective: "protect_asset",
  objectiveParams: { turnLimit: 16, assetMaxHp: 400, assetName: "the Root" },
  playerPilotIds: HOUSE_AMARANTH_ACT2_DEFAULT_SQUAD,
  enemyWaves: [
    { archetypeId: "bloom_bramble", count: 6, atTurn: 1, spawnAt: [{ x: 11, y: 1 }, { x: 12, y: 1 }] },
    { archetypeId: "bloom_bramble", count: 6, atTurn: 1, spawnAt: [{ x: 11, y: 11 }, { x: 12, y: 11 }] },
    { archetypeId: "bloom_bramble", count: 5, atTurn: 5, spawnAt: [{ x: 22, y: 6 }, { x: 22, y: 7 }] },
  ],
  events: [
    {
      id: "ev_hold_the_root_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Marrow: \"Everything downstream of this dock stops mattering if this dock goes. Hold it.\"" },
      once: true,
    },
  ],
  rewardPoints: 235,
  heirloomCharge: "locked",
};

// Mission 33, "The Innermost Terrace" (Act III). Plan doc §6: "final
// perimeter around House Amaranth's own seat of power; tone shifts from
// managing a program to surviving one." hold_zone, tagged "multi-wave."
// Warden's own mirrored mission ("The Innermost Ring") build log states
// the reasoning directly: reuse the campaign's own proven hold_zone shape
// on the last hold_zone missions rather than risking new geometry, and let
// wave count and staggered approach corridors carry "the ring/terrace"
// feeling instead. Same call here -- this campaign's own proven
// central-hold-block-plus-ridge-flank shape (Missions 19/23/29), this
// act's largest hold_zone map yet, five spawn clusters instead of four.
// Bramble-only -- Mission 30 already proved the two-threat convergence
// beat, and Mission 35 is where Bramble + Wellroot converge next, so this
// one stays single-threat rather than reaching for a third combination.
//
// Applying the Mission 29 lesson proactively (the gap between the FIRST
// two waves is a far sharper lever than total headcount): wave 1 and wave
// 2 are given a 2-turn gap from the start, not the 1-turn gap Mission 29
// had to discover was too tight the hard way.
//
// Sim-tuning journey, against the ≤15% ceiling (npx tsx
// src/sim/runBatch.ts N mission_house_amaranth_33) -- landed in range on
// the first real composition, same as Mission 31: applying an already-
// learned lesson (here, the Mission 29 first-gap finding) up front instead
// of rediscovering it mid-tuning again:
//
//   4 Bramble/wave x5, turns 1/3/5/7/9   -> 15/100 (15%)
//   same composition, re-confirmed        -> 17/150 (11%); 32/250 pooled ≈ 12.8%
//
// Shipped at that composition without further adjustment.
export const HOUSE_AMARANTH_MISSION_33: CampaignMission = {
  id: "mission_house_amaranth_33",
  displayName: "House Amaranth III.33 — The Innermost Terrace",
  mapId: "map_house_amaranth_the_innermost_terrace",
  briefing:
    "Everything past this line is Halcyon's own house, not a terrace on a map. Five approaches, all of them Bramble, all of them converging on the one perimeter that's never had to hold before because nothing's ever gotten this close. Marrow's not talking about winning anymore. Just about still being here when it's done.",
  objective: "hold_zone",
  objectiveParams: { turnLimit: 20, holdUntilTurn: 16 },
  playerPilotIds: HOUSE_AMARANTH_ACT2_DEFAULT_SQUAD,
  enemyWaves: [
    { archetypeId: "bloom_bramble", count: 4, atTurn: 1, spawnAt: [{ x: 12, y: 1 }, { x: 13, y: 1 }] },
    { archetypeId: "bloom_bramble", count: 4, atTurn: 3, spawnAt: [{ x: 12, y: 11 }, { x: 13, y: 11 }] },
    { archetypeId: "bloom_bramble", count: 4, atTurn: 5, spawnAt: [{ x: 17, y: 4 }] },
    { archetypeId: "bloom_bramble", count: 4, atTurn: 7, spawnAt: [{ x: 17, y: 9 }] },
    { archetypeId: "bloom_bramble", count: 4, atTurn: 9, spawnAt: [{ x: 24, y: 6 }, { x: 24, y: 7 }] },
  ],
  events: [
    {
      id: "ev_the_innermost_terrace_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Marrow: \"Five approaches, all Bramble, all of them meaning it this time. Nothing gets past this line — not because we win, because we don't move.\"" },
      once: true,
    },
  ],
  rewardPoints: 240,
  heirloomCharge: "locked",
};

// Mission 34, "No Word From the Seal" (Act III). Plan doc §6: "Halcyon's
// gone silent -- no confirmation House Amaranth still has political cover
// at all." survive_n_turns, tagged "darkest hour, mirrors Warden's Mission
// 34." This campaign's second survive_n_turns mission (Mission 25, "Going
// Dark," was the first) -- same "deploy dead center, no relief column, no
// safe direction" discipline taken one step further: eight spawn points
// (map's own NO_WORD_FROM_THE_SEAL_TILES comment covers the geometry) --
// north, south, east, west, and all four corners -- instead of Mission
// 25's four. Per this file's own Mission 25 comment, survive_n_turns has
// tuned smoothly/monotonically every time in this campaign, unlike the
// zero-tolerance objective types -- worth checking whether that holds
// again here.
//
// Sim-tuning journey, against the ≤15% ceiling (npx tsx
// src/sim/runBatch.ts N mission_house_amaranth_34) -- confirmed the
// Mission 25 finding again: survive_n_turns tunes smoothly/monotonically
// here too, no knife-edge cliff between adjacent totals the way
// eliminate_all and hold_zone keep producing:
//
//   16 total Bramble (2/wave x4 turn 1, 4 turn 5, 4 turn 9)   -> 87%
//   24 total Bramble (3/wave x4 turn 1, 6 turn 5, 6 turn 9)   -> 29%
//   30 total Bramble (4/wave x4 turn 1, 7 turn 5, 7 turn 9)   -> 7/100 (7%)
//   30 total, re-confirmed                                     -> 14/150 (9%);
//                                                                  21/250 pooled ≈ 8.4%
//
// A clean, gradual descent (87% -> 29% -> 8%) across three totals, unlike
// the sharp same-total cliffs Missions 22/26/27/29/30 all hit. Shipped at
// 30 total.
export const HOUSE_AMARANTH_MISSION_34: CampaignMission = {
  id: "mission_house_amaranth_34",
  displayName: "House Amaranth III.34 — No Word From the Seal",
  mapId: "map_house_amaranth_no_word_from_the_seal",
  briefing:
    "Nothing from Halcyon in three days — not a seal-holder's silence, an absence. No confirmation the program still has cover, no confirmation it doesn't. Marrow's not waiting on an answer that might not come. Eight directions, all of them bad. Just be standing here when the silence breaks, whichever way it breaks.",
  objective: "survive_n_turns",
  objectiveParams: { turnLimit: 16 },
  playerPilotIds: HOUSE_AMARANTH_ACT2_DEFAULT_SQUAD,
  enemyWaves: [
    { archetypeId: "bloom_bramble", count: 4, atTurn: 1, spawnAt: [{ x: 11, y: 1 }, { x: 12, y: 1 }] },
    { archetypeId: "bloom_bramble", count: 4, atTurn: 1, spawnAt: [{ x: 11, y: 11 }, { x: 12, y: 11 }] },
    { archetypeId: "bloom_bramble", count: 4, atTurn: 1, spawnAt: [{ x: 1, y: 6 }, { x: 1, y: 7 }] },
    { archetypeId: "bloom_bramble", count: 4, atTurn: 1, spawnAt: [{ x: 22, y: 6 }, { x: 22, y: 7 }] },
    { archetypeId: "bloom_bramble", count: 7, atTurn: 5, spawnAt: [{ x: 2, y: 2 }, { x: 21, y: 2 }, { x: 2, y: 10 }, { x: 21, y: 10 }] },
    { archetypeId: "bloom_bramble", count: 7, atTurn: 9, spawnAt: [{ x: 11, y: 1 }, { x: 12, y: 1 }, { x: 11, y: 11 }, { x: 12, y: 11 }] },
  ],
  events: [
    {
      id: "ev_no_word_from_the_seal_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Marrow: \"Three days of nothing from the seal-holder. We don't get to wait for an answer. Hold the ground we're standing on.\"" },
      once: true,
    },
  ],
  rewardPoints: 245,
  heirloomCharge: "locked",
};

// Mission 35, "The Root Turns" (Act III). Plan doc §6: "the Bramble and
// the original Wellroot node move together for the first time -- the two
// threats becoming one." hold_zone, tagged "final threat breaches
// containment." The Wellroot is sessile (data/bloom.ts: moveRange 0,
// endurance 480, attackRange [1,3]) so "move together" reads as
// coordination rather than literal movement -- it anchors this fight from
// a fixed position, same placement logic Mission 23 introduced (two tiles
// east of the hold block's own edge, close enough to threaten every hold
// tile with its own acid), while Bramble waves converge around it. Reuses
// this campaign's own proven central-hold-block-plus-ridge-flank shape one
// more time (Missions 19/23/29/33), at Mission 33's own 24x13 scale. Same
// as Mission 23, hold_zone doesn't require killing the Wellroot -- it's
// the threatening fixed presence the squad holds position against, not a
// kill target.
//
// Sim-tuning journey, against the ≤15% ceiling (npx tsx
// src/sim/runBatch.ts N mission_house_amaranth_35) -- the Wellroot's own
// presence (endurance 480, attackRange [1,3], data/bloom.ts) turned out
// not to substitute for Bramble headcount the way a naive reading of "two
// threats becoming one" might suggest:
//
//   1 Wellroot (fixed) + 12 Bramble (4/wave x3, turns 1/3/5)   -> 100%
//   1 Wellroot (fixed) + 20 Bramble (7/7/6, turns 1/3/5)       -> 11/100 (11%)
//   same composition, re-confirmed                              -> 16/150 (11%);
//                                                                   27/250 pooled ≈ 10.8%
//
// The Wellroot alone (Mission 23's own precedent) was never meant to carry
// the fight -- it's a fixed threat the squad works around, not a
// headcount substitute -- so this mission still needed Mission 33's own
// full 20-Bramble weight on top of it. Shipped at that composition.
export const HOUSE_AMARANTH_MISSION_35: CampaignMission = {
  id: "mission_house_amaranth_35",
  displayName: "House Amaranth III.35 — The Root Turns",
  mapId: "map_house_amaranth_the_root_turns",
  briefing:
    "The Wellroot hasn't moved in thirty years. It's not moving now either — but the Bramble is moving AROUND it, in a pattern that isn't random, and Marrow's read on that is the only one that matters: whatever's been growing under this program long enough to know how to wait, it's done waiting. Hold the perimeter. Whatever it's coordinating, it doesn't get through.",
  objective: "hold_zone",
  objectiveParams: { turnLimit: 20, holdUntilTurn: 16 },
  playerPilotIds: HOUSE_AMARANTH_ACT2_DEFAULT_SQUAD,
  enemyWaves: [
    { archetypeId: "bloom_wellroot", count: 1, atTurn: 1, spawnAt: [{ x: 15, y: 6 }] },
    { archetypeId: "bloom_bramble", count: 7, atTurn: 1, spawnAt: [{ x: 11, y: 1 }, { x: 12, y: 1 }] },
    { archetypeId: "bloom_bramble", count: 7, atTurn: 3, spawnAt: [{ x: 11, y: 11 }, { x: 12, y: 11 }] },
    { archetypeId: "bloom_bramble", count: 6, atTurn: 5, spawnAt: [{ x: 22, y: 6 }, { x: 22, y: 7 }] },
  ],
  events: [
    {
      id: "ev_the_root_turns_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Marrow: \"It's not moving. It's directing. Thirty years of sitting still and it picked today to start telling the rest of them where to go.\"" },
      once: true,
    },
  ],
  rewardPoints: 250,
  heirloomCharge: "locked",
};

// Mission 36, "The Stalling Season Ends" (Act III finale, campaign
// finale). Plan doc §6: "hold until the containment doctrine actually
// closes the loop. The Bloom, at House Amaranth's own scale, genuinely
// pacified." survive_n_turns -> Victory, same objective shape Warden's own
// finale uses. Same "deploy dead center, no relief column, no safe
// direction" discipline Missions 25/34 already proved out, one more notch
// bigger (map's own STALLING_SEASON_ENDS_TILES comment covers the
// geometry). The Wellroot (bloom_wellroot, fixed, first used Mission 23,
// reprised Mission 35) makes one last appearance here too -- a deliberate
// closing callback, "the loop" the pitch names being the same containment
// fight this act has been building since Mission 23, not a new threat
// introduced for the finale's own sake.
//
// ev_stalling_season_ends_closure fires on objective_complete and carries
// the plan doc's own epilogue framing directly -- "it works here, it won't
// work galaxy-wide, gets abandoned someday, but not on this campaign's own
// last page" -- same technique this act's other closure events
// (Missions 28/29) already used for a beat that needs to land after the
// win check resolves, not before.
//
// Sim-tuning journey, against the ≤15% ceiling (npx tsx
// src/sim/runBatch.ts N mission_house_amaranth_36) -- confirms the Mission
// 35 finding again: pairing the Wellroot with a Bramble headcount that
// already worked WITHOUT it overshoots badly:
//
//   1 Wellroot (fixed) + 32 Bramble (4/wave x4 turn 1, 6 turn 5, 6 turn 9)  -> 0%
//   1 Wellroot (fixed) + 16 Bramble (2/wave x4 turn 1, 4 turn 5, 4 turn 9)  -> 3%
//   1 Wellroot (fixed) + 14 Bramble (2/wave x4 turn 1, 3 turn 5, 3 turn 9)  -> 22%
//   1 Wellroot (fixed) + 15 Bramble (2/wave x4 turn 1, 4 turn 5, 3 turn 9)  -> 20/150 (13%)
//   same composition, re-confirmed                                          -> 11/100 (11%);
//                                                                               31/250 pooled ≈ 12.4%
//
// Shipped at 15 Bramble + 1 Wellroot. Notably LOWER Bramble headcount than
// Mission 35 needed for a similar win rate (20 there vs. 15 here) despite
// this map having twice as many spawn clusters (eight vs. Mission 35's
// three) -- the extra approach vectors compound with the Wellroot's own
// pressure rather than diluting it the way more spawn points sometimes
// have elsewhere in this campaign.
export const HOUSE_AMARANTH_MISSION_36: CampaignMission = {
  id: "mission_house_amaranth_36",
  displayName: "House Amaranth III.36 — The Stalling Season Ends",
  mapId: "map_house_amaranth_the_stalling_season_ends",
  briefing:
    "Thirty years of managing a bargain nobody outside this terrace ever agreed to, and it comes down to one more line, held one more time. The Wellroot's still out there, still directing, still not moving. Everything else is moving all at once. Hold until the doctrine closes. That's the whole order — hold.",
  objective: "survive_n_turns",
  objectiveParams: { turnLimit: 18 },
  playerPilotIds: HOUSE_AMARANTH_ACT2_DEFAULT_SQUAD,
  enemyWaves: [
    { archetypeId: "bloom_wellroot", count: 1, atTurn: 1, spawnAt: [{ x: 17, y: 6 }] },
    { archetypeId: "bloom_bramble", count: 2, atTurn: 1, spawnAt: [{ x: 12, y: 1 }, { x: 13, y: 1 }] },
    { archetypeId: "bloom_bramble", count: 2, atTurn: 1, spawnAt: [{ x: 12, y: 11 }, { x: 13, y: 11 }] },
    { archetypeId: "bloom_bramble", count: 2, atTurn: 1, spawnAt: [{ x: 1, y: 6 }, { x: 1, y: 7 }] },
    { archetypeId: "bloom_bramble", count: 2, atTurn: 1, spawnAt: [{ x: 24, y: 6 }, { x: 24, y: 7 }] },
    { archetypeId: "bloom_bramble", count: 4, atTurn: 5, spawnAt: [{ x: 2, y: 2 }, { x: 23, y: 2 }, { x: 2, y: 10 }, { x: 23, y: 10 }] },
    { archetypeId: "bloom_bramble", count: 3, atTurn: 9, spawnAt: [{ x: 12, y: 1 }, { x: 13, y: 1 }, { x: 12, y: 11 }, { x: 13, y: 11 }] },
  ],
  events: [
    {
      id: "ev_stalling_season_ends_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Marrow: \"This is the whole bargain, right here, one more time. Hold this line and the doctrine closes. That's it. That's the order.\"" },
      once: true,
    },
    {
      id: "ev_stalling_season_ends_closure",
      trigger: { type: "objective_complete" },
      action: { type: "dialogue", text: "Marrow: \"The stalling season's over. Not because we won it — because we finally stopped needing to. It works here. Whether it ever works past this terrace isn't a today problem. Today, it holds.\"" },
      once: true,
    },
  ],
  rewardPoints: 260,
  heirloomCharge: "locked",
};

export const HOUSE_AMARANTH_ACT3: CampaignMission[] = [HOUSE_AMARANTH_MISSION_21, HOUSE_AMARANTH_MISSION_22, HOUSE_AMARANTH_MISSION_23, HOUSE_AMARANTH_MISSION_24, HOUSE_AMARANTH_MISSION_25, HOUSE_AMARANTH_MISSION_26, HOUSE_AMARANTH_MISSION_27, HOUSE_AMARANTH_MISSION_28, HOUSE_AMARANTH_MISSION_29, HOUSE_AMARANTH_MISSION_30, HOUSE_AMARANTH_MISSION_31, HOUSE_AMARANTH_MISSION_32, HOUSE_AMARANTH_MISSION_33, HOUSE_AMARANTH_MISSION_34, HOUSE_AMARANTH_MISSION_35, HOUSE_AMARANTH_MISSION_36];

export const HOUSE_AMARANTH_MISSIONS_BY_ID: Record<string, CampaignMission> = Object.fromEntries(
  [...HOUSE_AMARANTH_ACT1, ...HOUSE_AMARANTH_ACT2, ...HOUSE_AMARANTH_ACT3].map((m) => [m.id, m])
);
