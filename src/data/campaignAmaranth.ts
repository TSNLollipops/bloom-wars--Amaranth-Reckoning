// src/data/campaignAmaranth.ts
// "The Amaranth Reckoning" — Act I: The Fallow Line, all 12 missions (of the
// full 36-mission campaign concept — see
// claude/Bloom_Wars_Independent_Campaign_The_Amaranth_Reckoning.md /
// design/Bloom_Wars_The_Amaranth_Reckoning.docx §Appendix C: "Build Act 1
// first as its own small vertical slice"). Independent, non-canon, parallel
// continuity to the Team One slice in data/campaign.ts — different roster,
// different maps, same engine.
//
// Missions 9-12 (25 Aug 2026, Maxime: "lets do mission 9-36, do them in
// batch of 4... map can be as big as nessessary... try to weave in the two
// extra objective we added in, rescue and bloom patch") complete Act I.
// §3's "Act I: no new systems" held for 1-8 but not for all twelve — Cut Off
// is the one real ask the design doc itself named ("one new objective type
// (Survive N Turns, already flagged cheap in Build Brief §6)"); see
// data/types.ts's CampaignMission.objective comment and
// engine/mission.ts's checkWinLoss for what actually got built for it, which
// turned out to be genuinely small (reuse turnLimit itself as the
// survive-until count, no new field). The two bonus-objective kinds
// (rescue_pilot, clear_bloom_patch) needed no new engine work at all —
// they're the exact same generic verbs Missions 3/5 already exercise,
// applied here because the fiction happens to fit: Cut Off's isolation
// suits a stranded signals officer, and House Amaranth's own ward-crop
// terraces (design doc §5) suit a small encroaching patch left untended.
// Missions 10 and 11 carry no bonus objective — one of each kind across a
// four-mission batch reads as "these exist and recur," not "every mission
// needs one," and the finale (12) stays focused on its own stakes.
//
// §6a's permadeath correction is why Mission 12's briefing/events below
// never name a specific pilot for "whoever covers the gate" — the doc's own
// words: "every named death written into the mission list... is now a
// *plan*, not a *guarantee*... Whoever writes each mission's actual text
// needs to handle 'whichever pilot is left in that role.'" No scripted
// forced-loss event was added here for that reason; Mission 12 is a real,
// winnable (and losable) hold_zone mission, the hardest one in the act on
// its own numbers — whatever happens to whichever pilot happens live,
// through the existing permadeath check, same as any other mission.
//
// Warden Company doesn't have that name yet at this point in the story —
// it's still just Rourke's five-mech lance holding a stretch of the Fallow
// Line alongside a House Amaranth detachment (§Act I flavour text). Kept
// the same roster array name regardless, since "Warden Company" is what
// this file will keep being called even after the in-fiction renaming in
// Act II — see the design doc's own note that the unit keeps a name it
// technically hasn't earned yet, on purpose, on both sides of that line.
import type { CampaignMission, MekArchetype, Path, PilotRecord } from "./types";

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

// ---- Second Lance (§10, Act II, 25 Aug 2026): "Warden Company forms
// around Rourke's survivors and a second lance." Five more named pilots,
// joining the campaign roster via engine/campaignState.ts's
// integrateSecondLance() the moment Mission 12 (Act I's own finale) is
// won — see that function's own comment for why that specific beat, not a
// mid-Act-II reward, is where "integrating the second lance" actually
// happens. This is also what gives Mission 13 onward a real 10-pilot
// roster to pick a squad from — see scenes/TransporterPad.ts's
// deployCapForMission for the other half of composition choice.
//
// A deliberately different path spread from Warden Company's own
// (2 Meeps/1 Tank/1 Reeps/1 Munti) rather than a mirror of it — the whole
// point of a composition choice is that the two lances aren't
// interchangeable. Combined 10-pilot roster ends up 3 Meeps/2 Tank/
// 3 Reeps/2 Munti — a second Munti in particular means a squad can, for
// the first time, choose to bring two healers or none at all, rather than
// Warden Company's own one-Munti-or-nothing shape.
export const SECOND_LANCE_PILOTS: PilotRecord[] = [
  {
    id: "pilot_okafor",
    displayName: "Sgt. Wren Okafor — “Ledger”",
    archetypeId: "arch_tank_bipedal",
    mekId: "mek_okafor",
    tier: "G",
  },
  {
    id: "pilot_solheim",
    displayName: "Cpl. Nadia Solheim — “Static”",
    archetypeId: "arch_reeps_bipedal",
    mekId: "mek_solheim",
    tier: "G",
  },
  {
    id: "pilot_tarrant",
    displayName: "Pvt. Yusuf Tarrant — “Kestrel”",
    archetypeId: "arch_meeps_centauroid", // Hiopi, same chassis family as Iyari
    mekId: "mek_tarrant",
    tier: "G",
  },
  {
    id: "pilot_vashti",
    displayName: "Spec. Elin Vashti — “Driftwood”",
    archetypeId: "arch_munti_vibrissal", // Osnius/vibrissal — the roster's second Munti
    mekId: "mek_vashti",
    tier: "G",
  },
  {
    id: "pilot_reyes",
    displayName: "Cpl. Damon Reyes — “Hardpan”",
    archetypeId: "arch_reeps_centauroid",
    mekId: "mek_reyes",
    tier: "G",
  },
];

// Track assignments, same build-time-call discipline as WARDEN_MEKS above:
// Okafor (veteran, holds the line) gets Armorer, mirroring Bosk's own
// track. Solheim and Reyes (both Reeps, the lance's ranged pair) split
// between Runemaster (Solheim — vision, matches a sharpshooter's own
// instinct) and Fabricator (Reyes — spare-parts redeploy, a scavenger's
// track, not yet used anywhere in either roster). Tarrant (young, fast)
// gets Armorer like Iyari. Vashti (the second Munti) gets Fieldwright,
// same as every Munti in either roster so far.
export const SECOND_LANCE_MEKS: Record<string, MekArchetype> = {
  mek_okafor: { id: "mek_okafor", displayName: "Okafor's Mek", primary: "armorer", secondary: null, spareParts: 0 },
  mek_solheim: { id: "mek_solheim", displayName: "Solheim's Mek", primary: "runemaster", secondary: null, spareParts: 0 },
  mek_tarrant: { id: "mek_tarrant", displayName: "Tarrant's Mek", primary: "armorer", secondary: null, spareParts: 0 },
  mek_vashti: { id: "mek_vashti", displayName: "Vashti's Mek", primary: "fieldwright", secondary: null, spareParts: 0 },
  mek_reyes: { id: "mek_reyes", displayName: "Reyes's Mek", primary: "fabricator", secondary: null, spareParts: 0 },
};

export const SECOND_LANCE_ROSTER_IDS = SECOND_LANCE_PILOTS.map((p) => p.id);

// ---- Third Lance (§10, Act III, 25 Aug 2026 — correction made same day
// as the rest of batch 5). Maxime's actual original plan, clarified in
// chat after batch 5 shipped: "my original plan was to allow player to
// field 1 lance act 1, then 2 lance, act 2 tthen 3 act 3. to go with the
// rank incrase of MC and the difficulty spike" — then, asked when the
// third lance should join and whether to retune missions 25-28 for it:
// "just add the ne wlance on promotion. fine tune mission for it. both
// part[s]." "On promotion" = the same beat Second Lance uses: Mission 24
// is Act II's own finale AND the mission where Rourke is promoted to
// Major (Independent Campaign doc, Mission 24's own line: "Rourke
// promoted to Major"), so this integrates on that win, exactly one
// integration function and one Debrief call site earlier than Second
// Lance's own Mission-12 pattern, mirrored line for line below.
//
// This also corrects a real doc/plan mismatch, not just adds content:
// the Independent Campaign doc's own §10 squad-scaling table currently
// says Act III is "~20 (4 lances)" — that was never Maxime's actual plan.
// 5 pilots/lance × 3 lances = 15, matching his 1/2/3 framing exactly
// against what's already built (Act I = 5, Act II = 10). §10 needs
// updating to match this, not the other way around — flagged here and
// in this batch's build-log addendum.
//
// A third distinct path spread, same "lances aren't interchangeable"
// principle as Second Lance's own header comment: 2 Tank/1 Meeps/1 Reeps/
// 1 Munti here (vs. Warden's 2 Meeps/1 Tank/1 Reeps/1 Munti and Second
// Lance's 1 Meeps/1 Tank/2 Reeps/1 Munti) — leans toward frontline
// survivability, which fits "difficulty spike" as a design reason, not
// just a flavor one. Combined 15-pilot roster ends up a clean 4 Meeps/
// 4 Tank/4 Reeps/3 Munti. Also completes a small deliberate detail: Munti
// now has one pilot on each of the three chassis families (Lask/bipedal,
// Vashti/vibrissal, Yeun/centauroid below) — not required by anything,
// just a tidy coincidence worth having noticed rather than broken by
// picking a fourth chassis at random.
export const THIRD_LANCE_PILOTS: PilotRecord[] = [
  {
    id: "pilot_kova",
    displayName: "Sgt. Mireille Kova — “Bastion”",
    archetypeId: "arch_tank_vibrissal",
    mekId: "mek_kova",
    tier: "G",
  },
  {
    id: "pilot_ness",
    displayName: "Cpl. Aurelio Ness — “Rampart”",
    archetypeId: "arch_tank_centauroid",
    mekId: "mek_ness",
    tier: "G",
  },
  {
    id: "pilot_onwuka",
    displayName: "Pvt. Sable Onwuka — “Whiplash”",
    archetypeId: "arch_meeps_vibrissal",
    mekId: "mek_onwuka",
    tier: "G",
  },
  {
    id: "pilot_delgado",
    displayName: "Spec. Rasha Delgado — “Longshot”",
    archetypeId: "arch_reeps_bipedal",
    mekId: "mek_delgado",
    tier: "G",
  },
  {
    id: "pilot_yeun",
    displayName: "Cpl. Faro Yeun — “Splint”",
    archetypeId: "arch_munti_centauroid",
    mekId: "mek_yeun",
    tier: "G",
  },
];

// Track assignments: both Tanks get Armorer, continuing a clean rule that
// now holds across all three lances (Bosk, Okafor, Kova, Ness — every
// Tank pilot in this campaign is Armorer). Onwuka (Meeps) gets Armorer
// too, same as Iyari/Tarrant — Rourke stays the one Runemaster exception
// among Meeps, unchanged. Yeun (Munti) gets Fieldwright, same clean rule
// as Lask/Vashti — every Munti in this campaign is Fieldwright. Delgado
// (Reeps) gets Quartermaster — the one MekTrack neither prior lance has
// used yet (fabricator/armorer/runemaster/fieldwright all already appear
// above), same "introduce the next unused track" beat Second Lance's own
// Reyes/Fabricator pairing already set as precedent.
export const THIRD_LANCE_MEKS: Record<string, MekArchetype> = {
  mek_kova: { id: "mek_kova", displayName: "Kova's Mek", primary: "armorer", secondary: null, spareParts: 0 },
  mek_ness: { id: "mek_ness", displayName: "Ness's Mek", primary: "armorer", secondary: null, spareParts: 0 },
  mek_onwuka: { id: "mek_onwuka", displayName: "Onwuka's Mek", primary: "armorer", secondary: null, spareParts: 0 },
  mek_delgado: { id: "mek_delgado", displayName: "Delgado's Mek", primary: "quartermaster", secondary: null, spareParts: 0 },
  mek_yeun: { id: "mek_yeun", displayName: "Yeun's Mek", primary: "fieldwright", secondary: null, spareParts: 0 },
};

export const THIRD_LANCE_ROSTER_IDS = THIRD_LANCE_PILOTS.map((p) => p.id);

// Act II's own static playerPilotIds default (25 Aug 2026) — read only by
// `npm run sim`/tests/any direct `new Mission(missionDef)` call with no
// deployRoster (see engine/mission.ts's deployPlayerUnits comment); a real
// playthrough always goes through scenes/TransporterPad.ts's picker
// instead, which reads the campaign's actual live roster, not this. Picked
// as a genuine 8-of-10 composition (2 bench: Tarrant, Reyes) rather than
// "all five Wardens plus three Second Lance alphabetically" specifically so
// the sim exercises the same choice a player faces — including the
// two-Munti case the roster doc flags (Lask + Vashti both deployed). Kept
// IDENTICAL across all four Act II missions built this pass so a stress-test
// run compares mission-to-mission on a fixed squad rather than a moving
// one; a real campaign obviously won't stay this static once losses and
// picker choices start diverging it.
const ACT2_DEFAULT_SQUAD = [
  "pilot_rourke", "pilot_bosk", "pilot_iyari", "pilot_anand", "pilot_lask",
  "pilot_okafor", "pilot_solheim", "pilot_vashti",
];

// Act III's own static playerPilotIds default (25 Aug 2026, same-day
// correction) — same role as ACT2_DEFAULT_SQUAD above (sim/test only,
// never read by a real playthrough), now a genuine 12-of-15 composition
// against ACT3_DEPLOY_CAP (scenes/TransporterPad.ts) rather than
// ACT2_DEFAULT_SQUAD's 8-of-10. Bench: Tarrant and Reyes again (Second
// Lance's own perpetual reserve pair, unchanged since Act II) plus Ness
// (Third Lance's second Tank) — chosen so this squad deploys three
// Munti at once (Lask + Vashti + Yeun), a genuine new edge case past Act
// II's own "two Munti" coverage, on top of the size increase itself.
const ACT3_DEFAULT_SQUAD = [
  "pilot_rourke", "pilot_bosk", "pilot_iyari", "pilot_anand", "pilot_lask",
  "pilot_okafor", "pilot_solheim", "pilot_vashti",
  "pilot_kova", "pilot_onwuka", "pilot_delgado", "pilot_yeun",
];

// bonusAbilityUnlocks are per-mission-deploy, not a persistent campaign
// flag (engine/mission.ts's applyBonusAbilityUnlocks reads only
// `this.mission.bonusAbilityUnlocks`) — every mission after an unlock has
// to keep repeating it or the unit simply doesn't have the ability that
// mission, same pattern Act I already established for abil_taunt (Missions
// 9-12 above). Broken out as shared constants here so four missions'
// worth of repetition can't drift out of sync with each other by a typo.
const TAUNT_UNLOCK: { path: Path; abilityId: string }[] = [{ path: "meeps", abilityId: "abil_taunt" }];
// abil_fire_support (Mission 14 "Steel Rain," see data/abilities.ts's own
// design comment) granted to all four paths at once, not just one — unlike
// Taunt, which is Meeps-flavoured specifically, fire support is Providence's
// own capability, called in by whichever unit is looking at the target,
// regardless of what they pilot.
const FIRE_SUPPORT_UNLOCKS: { path: Path; abilityId: string }[] = [
  { path: "meeps", abilityId: "abil_fire_support" },
  { path: "tank", abilityId: "abil_fire_support" },
  { path: "reeps", abilityId: "abil_fire_support" },
  { path: "munti", abilityId: "abil_fire_support" },
];
const ACT2_UNLOCKS_FROM_14: { path: Path; abilityId: string }[] = [...TAUNT_UNLOCK, ...FIRE_SUPPORT_UNLOCKS];

export const AMARANTH_MISSION_1: CampaignMission = {
  id: "mission_amaranth_1",
  displayName: "Amaranth I.1 — Muster",
  mapId: "map_amaranth_muster",
  briefing:
    "First light on the Fallow Line. Nothing's moved in four days but paperwork. Command wants a muster sweep to shake the cobwebs out before anyone gets comfortable. Five up, Lieutenant. Anything Bloom, you put it down.",
  objective: "eliminate_all",
  objectiveParams: { turnLimit: 8 },
  playerPilotIds: WARDEN_ROSTER_IDS,
  // Doubled 6 -> 12 (Maxime, 23 Aug 2026: "twice as many enemy" — echoing
  // his own Mission 6 playtest note that a doubled spawn "really felt like
  // I was fighting a good enemy"). turnLimit and map untouched — Muster
  // stays the open tutorial ground it was, just with more to clear in it.
  enemyWaves: [{ archetypeId: "bloom_crawlmass", count: 12, atTurn: 1, spawnAt: "enemy_deploy" }],
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
  // turnLimit 10 -> 12, Splitfang doubled 3+3 -> 6+6 (Maxime, 23 Aug 2026:
  // "should end at turn 12 and have twice as many enemy"). holdUntilTurn
  // stays 6, so the squad now holds through six spare turns after the zone
  // locks instead of four.
  //
  // The doubled count first shipped as a partial change (turnLimit only)
  // because 6+6 broke the door-plug regression test outright — a full
  // squad wipe where the original 3+3 was a clean win. Root-caused it
  // properly rather than guessing at wave pacing: NOT bloom_splitfang's
  // pack targeting (that was a red herring from an early theory), but a
  // real engine bug in engine/mission.ts's findFreeAdjacent(), the
  // function that places an overflow spawn when a wave lists more units
  // than there are collision-free tiles at its origin. It searched by raw
  // Chebyshev ring distance with no wall check, so once a 9th-or-later
  // Splitfang needed overflow placement near this map's spawn tiles —
  // which sit right against the hold room's sealed east wall — it found a
  // HOLD-ZONE TILE one wall-thickness away in coordinates and spawned a
  // Splitfang directly inside the sealed room, no doorway required. Fixed
  // by rewriting findFreeAdjacent as a walls-aware BFS (can't cross a wall
  // to shortcut, same as a real unit's own move budget can't) — see that
  // function's own comment in engine/mission.ts for the full story. With
  // the bug gone, 6+6 (and 9, and everything in between, all re-tested)
  // wins the door-plug regression cleanly at turn 6 again, and a version
  // that fights back instead of turtling (src/sim) also wins at turn 6,
  // costing the Munti (Lask) as a permanent loss along the way — a real
  // cost, not a broken run.
  objectiveParams: { turnLimit: 12, holdUntilTurn: 6 },
  playerPilotIds: WARDEN_ROSTER_IDS,
  enemyWaves: [
    { archetypeId: "bloom_splitfang", count: 6, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "bloom_splitfang", count: 6, atTurn: 3, spawnAt: "enemy_deploy" },
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
    "Bloom mat came up through the low terraces overnight — a supply detail was caught crossing at first light. Command wants the ground burned clean. It's spreading while you stand here; don't let it get ahead of you.",
  // objective swapped eliminate_all -> clear_bloom (Maxime, 23 Aug 2026:
  // "I'm thinking of making clean the bloom patch the objective of mission
  // 3" — upgrading the earlier "cleaning job for munties" idea, itself
  // still unbuilt at the time, straight to the mission's actual win
  // condition rather than a side mechanic layered under eliminate_all). Win
  // now reads "no bloom_mat tile left anywhere on the board" (see
  // engine/mission.ts's checkWinLoss clear_bloom branch); briefing rewritten
  // to match — the old text ("burned clean and the detail's fate
  // confirmed") described an elimination sweep through mat terrain, this
  // one describes actually clearing it.
  //
  // Enemy waves are UNCHANGED — 8 Crawlmass + 2 Splitfang still spawn and
  // still fight for real; they just aren't the win condition any more.
  // That's deliberate: Lask (Warden Company's one Munti, the only pilot
  // carrying abil_clear_bloom) has to clear the patch while the rest of the
  // squad keeps the Bloom off her, which is a materially different tactical
  // problem than "kill everything" even with the identical hostile roster.
  objective: "clear_bloom",
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
      // data/mapsAmaranth.ts's enlargement-pass header), and moved again
      // (row +2 only — same columns) for the second enlargement 24x15 ->
      // 30x19 (Maxime, same day: "make the map bigger" for this mission
      // specifically). The interior seams are the "SS" pair at row 9 of
      // that grid now, the third is the east seam on the same row — the
      // approach distance from deploy is still measured at exactly 9 move
      // points, unchanged by either pass; see that file's header.
      archetypeId: "bloom_undertow",
      count: 3,
      atTurn: 1,
      spawnAt: [
        { x: 8, y: 9 },
        { x: 9, y: 9 },
        { x: 23, y: 9 },
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
  // Rescue-and-recruit bonus objective (Maxime, 23 Aug 2026: "mission 5 is
  // rescue the downed pilot... giving us a free new pilot. random chassis"
  // — then, asked whether class rolls too: "Chassis and class, both
  // random."). Deliberately layered ON TOP of the extract_unit(Anand)
  // objective above, not a replacement for it — this mission's own
  // briefing already sets up exactly this beat ("Salvage detail hit a
  // wrecked supply cache... and stopped answering the hourly check-in"),
  // so the missing detail's own survivor is who's found here. Success or
  // failure never touches this.outcome (see engine/mission.ts's
  // rescueOutcome) — Anand reaching the treeline is still the entire real
  // mission; this is strictly a bonus.
  //
  // npcSpawnAt — moved from {x:13, y:6} to {x:6, y:6}, 25 Aug 2026. Real
  // playtesting (Maxime: "couldnt save the downed pilot. he got completely
  // shredded fast") led to a stat-toughening fix the same day (see
  // engine/units.ts's createRescuableNpcUnit) — but a live run after that
  // fix STILL lost the NPC turn 1, and checking the actual map/deploy data
  // rather than trusting the earlier diagnosis found why: FORAGING_PARTY's
  // deploy zone sits at column 0; the old spawn point was column 13 — 13
  // tiles away, farther than any unit's moveRange (Munti 5, fastest unit
  // Meeps 6) can close in a single turn. No player unit could ever reach
  // adjacency before at least one full, completely undefended hostile
  // phase hit it — the real dominant cause, bigger than the stat bug the
  // first fix addressed. Column 6 is ~6 tiles from deploy (reachable by a
  // fast unit turn 1, safely reachable by turn 2 for the rest of the
  // squad) and ~10 tiles from the nearest Bloom spawn seam (14,3)/(16,6)/
  // (15,9), versus the old spot's 3-tile distance to (16,6). Both fixes
  // stay in — the toughened stats still matter for whatever exposure is
  // left once a unit arrives, they just aren't doing the whole job alone
  // anymore. Fiction adjusted to match: reads as the survivor found
  // already partway back along the egress route rather than sitting
  // untouched at the depot itself, which the briefing's own "get everyone
  // back through the gap" line already supports without contradiction —
  // no longer "a plain tile immediately east of the wrecked depot," now
  // partway down that same route home.
  //
  // bonusPoints (generalized bonus-objective pass, 24 Aug 2026 — Maxime,
  // asked whether points should replace or add to the free-recruit
  // reward above: "Points on top of the recruit"). Placeholder balance
  // number, Maxime's own judgment call, unspecified in the design docs,
  // flagged exactly like campaignState.ts's DISCRETIONARY_RECRUIT_COST.
  // Company-pool scale, not personal: sits close to SPARE_PART_COST (40,
  // engine/campaignEconomy.ts) — enough to feel like a real bonus without
  // approaching this mission's own rewardPoints (170) for actually
  // winning it. Pending a real tuning pass once there's actual play data.
  bonusObjective: { kind: "rescue_pilot", npcSpawnAt: { x: 6, y: 6 }, npcDisplayName: "Downed Pilot", bonusPoints: 40 },
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
    "Command's never heard anything like what came over the listening post's feed last night — dozens of voices, all one voice. Whatever it is, it's coordinated, and it's coming down the open ground north of the Line. Don't get spread out. If it really is a swarm, the ones who scatter thinnest are the ones it converges on first.",
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
  // abil_taunt (25 Aug 2026, Maxime: "only give them the ability for this
  // mission onward") — the last line of the briefing above foreshadows
  // the swarm, XCOM-alert style, without spelling out the counter; the
  // action bar just quietly has a new option from here on. See
  // CampaignMission.bonusAbilityUnlocks (data/types.ts) for the mechanism
  // and its own note on why "onward" isn't solved campaign-wide yet.
  bonusAbilityUnlocks: [{ path: "meeps", abilityId: "abil_taunt" }],
};

export const AMARANTH_MISSION_9: CampaignMission = {
  id: "mission_amaranth_9",
  displayName: "Amaranth I.9 — Cut Off",
  mapId: "map_amaranth_cut_off",
  briefing:
    "Comms went dark at 0300 — no storm, no jamming signature, just silence where the relay used to be. Command doesn't know where you are and right now you don't know what's coming. Hold what you're standing on until somebody on the other end fixes whatever broke. Nobody's coming until then.",
  // Survive N Turns (new objective type, this pass — see data/types.ts's
  // CampaignMission.objective comment). turnLimit doubles as the
  // survive-until count directly; kept modest (10) for the type's first
  // outing, matching Build Brief §6's own "cheapest ask" framing rather
  // than opening with the act's hardest number.
  objective: "survive_n_turns",
  objectiveParams: { turnLimit: 10 },
  playerPilotIds: WARDEN_ROSTER_IDS,
  enemyWaves: [
    { archetypeId: "bloom_crawlmass", count: 10, atTurn: 1, spawnAt: "enemy_deploy" },
    // Gallcyst (data/bloom.ts: move 0) — the map's own two fixed seams
    // ((8,4) and (13,9) in CUT_OFF_TILES) so the sessile turrets land
    // exactly where they're dug in, not wherever "enemy_deploy" happens to
    // scatter them. First Gallcyst contact in the act — introduced here
    // rather than at the finale so Mission 12 isn't the first time the
    // squad sees a stationary acid threat as well as everything else new
    // that mission brings.
    { archetypeId: "bloom_gallcyst", count: 2, atTurn: 1, spawnAt: [{ x: 8, y: 4 }, { x: 13, y: 9 }] },
  ],
  events: [
    {
      id: "ev_cut_off_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Anand: “No traffic on any band. Not jammed — just nothing transmitting. That's not weather.”" },
      once: true,
    },
  ],
  rewardPoints: 220,
  heirloomCharge: "locked",
  // rescue_pilot bonus (weave-in pass, see file header) — a stranded
  // signals officer, found trying to raise anyone at all on a dead relay.
  // Ties directly into the mission's own premise rather than being a bonus
  // that happens to be bolted on. npcSpawnAt kept close to deploy (4 tiles,
  // reachable turn 1 by every unit including the Munti) — Mission 5's own
  // post-playtest fix (this file's own comment on AMARANTH_MISSION_5)
  // already established why a distant spawn gets an NPC killed before
  // anyone can reach them.
  bonusObjective: { kind: "rescue_pilot", npcSpawnAt: { x: 7, y: 8 }, npcDisplayName: "Downed Signals Officer", bonusPoints: 45 },
  bonusAbilityUnlocks: [{ path: "meeps", abilityId: "abil_taunt" }],
};

export const AMARANTH_MISSION_10: CampaignMission = {
  id: "mission_amaranth_10",
  displayName: "Amaranth I.10 — The Amaranth Betrayal",
  mapId: "map_amaranth_the_amaranth_betrayal",
  briefing:
    "House Amaranth held the east face of this line beside you for six weeks. This morning their positions are empty — no orders, no word, gear left where it sat. Foxfire's forward of the gap they left open. Get her out before whatever they were actually watching for gets there first.",
  objective: "extract_unit",
  objectiveParams: { turnLimit: 14, extractUnitId: "pilot_iyari" },
  playerPilotIds: WARDEN_ROSTER_IDS,
  enemyWaves: [
    { archetypeId: "bloom_crawlmass", count: 6, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "bloom_splitfang", count: 4, atTurn: 1, spawnAt: "enemy_deploy" },
  ],
  events: [
    {
      id: "ev_amaranth_betrayal_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Bosk: “Whole company's worth of gear, sitting in the dirt. They didn't evacuate this position. They ran from it.”" },
      once: true,
    },
  ],
  rewardPoints: 230,
  heirloomCharge: "locked",
  // clear_bloom_patch bonus (weave-in pass, see file header) — a small
  // patch already taking root in House Amaranth's own abandoned terraces,
  // the same ward-crop ground the design doc's §5 backstory is built on.
  // patchTiles matches THE_AMARANTH_BETRAYAL_TILES's bloom_mat rect exactly
  // (data/mapsAmaranth.ts) — off the direct deploy->exit line, a real
  // detour rather than sitting on the critical path.
  bonusObjective: {
    kind: "clear_bloom_patch",
    patchTiles: [
      { x: 13, y: 9 }, { x: 14, y: 9 }, { x: 15, y: 9 }, { x: 16, y: 9 },
      { x: 13, y: 10 }, { x: 14, y: 10 }, { x: 15, y: 10 }, { x: 16, y: 10 },
    ],
    bonusPoints: 45,
  },
  bonusAbilityUnlocks: [{ path: "meeps", abilityId: "abil_taunt" }],
};

export const AMARANTH_MISSION_11: CampaignMission = {
  id: "mission_amaranth_11",
  displayName: "Amaranth I.11 — The Long Walk Back",
  mapId: "map_amaranth_the_long_walk_back",
  briefing:
    "The line's not holding and command knows it — the order's already down to fall back to the second position. Patch is still forward. The ground between here and home is ground the Line already lost once. Walking it a second time isn't going to be quiet, and nobody's promised it stays empty behind you either.",
  objective: "extract_unit",
  // turnLimit 18 — the biggest number in the act so far, matched to the
  // map's own length (data/mapsAmaranth.ts's THE_LONG_WALK_BACK_TILES, the
  // batch's one deliberately large grid): deploy to exit is roughly 30 move
  // points in a straight line before the bridge bottleneck even factors in.
  objectiveParams: { turnLimit: 18, extractUnitId: "pilot_lask" },
  playerPilotIds: WARDEN_ROSTER_IDS,
  enemyWaves: [
    // Blocking the route home — Splitfang at the map's Zone B seams.
    { archetypeId: "bloom_splitfang", count: 2, atTurn: 1, spawnAt: [{ x: 21, y: 2 }, { x: 21, y: 10 }] },
    // Guarding the one bridge — Crawlmass planted right at its approaches,
    // not "enemy_deploy" (which would just as happily strand them in the
    // surrounding sump they can't cross either).
    { archetypeId: "bloom_crawlmass", count: 2, atTurn: 1, spawnAt: [{ x: 11, y: 5 }, { x: 15, y: 7 }] },
    // The pursuit — lands turn 3, exactly where deploy just was. Nothing
    // chases the squad mechanically; a wave arriving a few turns later at
    // the tile they started on reads as pursuit without needing to be one.
    { archetypeId: "bloom_crawlmass", count: 3, atTurn: 3, spawnAt: [{ x: 28, y: 3 }, { x: 28, y: 9 }] },
  ],
  events: [
    {
      id: "ev_long_walk_back_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Rourke: “Everyone who held this ground before us already left it. Eyes open the whole way.”" },
      once: true,
    },
  ],
  rewardPoints: 250,
  heirloomCharge: "locked",
  bonusAbilityUnlocks: [{ path: "meeps", abilityId: "abil_taunt" }],
};

export const AMARANTH_MISSION_12: CampaignMission = {
  id: "mission_amaranth_12",
  displayName: "Amaranth I.12 — The Fallow Line",
  mapId: "map_amaranth_the_fallow_line",
  briefing:
    "Thistledown Watch — same ground the lance mustered on, dug in properly now, trench and rubble where there used to be open field. Whatever's coming is coming from every side but the one you walked in from. Hold the line as long as the line can be held.",
  // Act finale, hold_zone. Deliberately NOT a scripted forced loss — see
  // this file's own header on §6a's permadeath correction. holdUntilTurn
  // 10 is the longest hold in the act (Missions 2 and 7 both asked for 6);
  // the biggest single encounter in the act (15 hostiles across 4 waves,
  // two of them new-to-the-act) is what makes that number hard, not a
  // scripted outcome layered on top of it.
  objective: "hold_zone",
  objectiveParams: { turnLimit: 16, holdUntilTurn: 10 },
  playerPilotIds: WARDEN_ROSTER_IDS,
  enemyWaves: [
    { archetypeId: "bloom_crawlmass", count: 6, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "bloom_splitfang", count: 4, atTurn: 1, spawnAt: "enemy_deploy" },
    // The Choir returns partway through — the act's mid-boss (Mission 8),
    // reprised once the position's already under real pressure rather than
    // at the open.
    { archetypeId: "bloom_choir", count: 3, atTurn: 4, spawnAt: "enemy_deploy" },
    // Sirenmaw — first contact in the act, held back for the finale's own
    // last push rather than introduced earlier and spent. Flying (ignores
    // terrain cost), so the trenchworks that slow everything else don't
    // slow this.
    { archetypeId: "bloom_sirenmaw", count: 2, atTurn: 6, spawnAt: "enemy_deploy" },
  ],
  events: [
    {
      id: "ev_the_fallow_line_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Rourke: “Same ground we mustered on. Didn't think we'd be digging in on it again this soon.”" },
      once: true,
    },
  ],
  rewardPoints: 280,
  heirloomCharge: "locked",
  bonusAbilityUnlocks: [{ path: "meeps", abilityId: "abil_taunt" }],
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
  AMARANTH_MISSION_9,
  AMARANTH_MISSION_10,
  AMARANTH_MISSION_11,
  AMARANTH_MISSION_12,
];

// ---- ACT II — TWO FIRES (25 Aug 2026, batch 2 / missions 13-16, Maxime:
// "add the next 4 now") ----
// "WW2-style mobile combined-arms war. Warden Company forms around Rourke's
// survivors and a second lance. Ship fire support arrives. The enemy is now
// unmistakably two enemies." (Independent Campaign doc, Act II header).
// Every heirloomCharge below stays "locked", same as every Act I mission —
// NOT because the Heirloom doesn't narratively unlock at Mission 12 (the
// design doc says it does), but because engine/campaignEconomy.ts's own
// noSeveranceBonus is scored off `heirloomCharge === "available"` as a
// STAND-IN for "was Severance actually used" (see that function's own note
// 3), and Severance itself still isn't built as a usable ability anywhere
// in engine/combat.ts. Shipping "available" here would silently hand every
// Act II mission a free +25 points with no matching mechanic behind it —
// a real economy bug, not a narrative choice — so this stays "locked" until
// Severance itself gets built, independent of the fiction's own timeline.
export const AMARANTH_MISSION_13: CampaignMission = {
  id: "mission_amaranth_13",
  displayName: "Amaranth II.13 — New Colors, Old Wounds",
  mapId: "map_amaranth_new_colors",
  briefing:
    "The second lance transfers in this morning — five more mechs, five more names, none of them yours yet. Command wants a live-fire shakedown before anyone calls this one company. Simple ground, simple objective: clear it, together, and find out who you actually are now.",
  objective: "eliminate_all",
  // Act II opener, deliberately un-clever — same "prove everyone can fight
  // together" read Mission 1's own Muster had for the original five (see
  // this map's own header comment in data/mapsAmaranth.ts). Enemy count
  // scaled for an 8-pilot squad rather than linearly off Mission 1's 12 —
  // tuned against the actual sim, not just arithmetic (see the build log
  // addendum for this batch's real numbers).
  objectiveParams: { turnLimit: 12 },
  playerPilotIds: ACT2_DEFAULT_SQUAD,
  enemyWaves: [
    { archetypeId: "bloom_crawlmass", count: 12, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "bloom_splitfang", count: 3, atTurn: 1, spawnAt: "enemy_deploy" },
  ],
  events: [
    {
      id: "ev_new_colors_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Rourke: “Whatever patch you're wearing, wear it after this one's clear. Everybody fights the same fight today.”" },
      once: true,
    },
  ],
  rewardPoints: 290,
  heirloomCharge: "locked",
  bonusAbilityUnlocks: TAUNT_UNLOCK,
};

export const AMARANTH_MISSION_14: CampaignMission = {
  id: "mission_amaranth_14",
  displayName: "Amaranth II.14 — Steel Rain",
  mapId: "map_amaranth_steel_rain",
  briefing:
    "Providence is finally close enough to the line to put ordnance where you point it — First Providence call-ins, live as of this morning. The ground ahead is already cratered from whoever hit it before you got here. Push through, and use what's overhead. It doesn't have unlimited patience, and neither does the schedule.",
  // First Providence call-in (Independent Campaign doc §14) — see
  // data/abilities.ts's abil_fire_support and data/combatTables.ts's
  // FIRE_SUPPORT_* constants for the full "minimal standalone ability, not
  // the CIC/Energy hub economy" design conversation (Maxime, asked
  // directly: confirmed minimal-standalone over the full hub). Manual-only,
  // same precedent as abil_taunt — sim/playerAi never calls it (see
  // sim/playerAi/types.ts's own PlayerAiDecision.action comment), so this
  // mission's own stress-test numbers below are a real measure of whether
  // it's beatable WITHOUT fire support, which is the correct bar: a bonus
  // tool for a human player, not a crutch the bot needs to pass.
  objectiveParams: { turnLimit: 14 },
  objective: "eliminate_all",
  playerPilotIds: ACT2_DEFAULT_SQUAD,
  enemyWaves: [
    { archetypeId: "bloom_crawlmass", count: 8, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "bloom_splitfang", count: 3, atTurn: 1, spawnAt: "enemy_deploy" },
    // Two fixed Gallcyst seams, held out of "enemy_deploy" resolution same
    // as Cut Off's own pair (Mission 9) — a sessile turret has to land
    // exactly where the map's dug-in position actually is, not wherever
    // "enemy_deploy" happens to scatter it. Coordinates match
    // STEEL_RAIN_TILES' own central ridge gap in data/mapsAmaranth.ts.
    { archetypeId: "bloom_gallcyst", count: 2, atTurn: 1, spawnAt: [{ x: 12, y: 7 }, { x: 15, y: 8 }] },
  ],
  events: [
    {
      id: "ev_steel_rain_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Providence Actual: “Warden Company, Providence. You've got eyes on the ground and we've got the guns — call it and we'll put it there.”" },
      once: true,
    },
  ],
  rewardPoints: 300,
  heirloomCharge: "locked",
  bonusAbilityUnlocks: ACT2_UNLOCKS_FROM_14,
};

export const AMARANTH_MISSION_15: CampaignMission = {
  id: "mission_amaranth_15",
  displayName: "Amaranth II.15 — Landfall",
  mapId: "map_amaranth_landfall",
  briefing:
    "There's no beachhead to secure — there's just the beach, and whoever's already dug in above it. The ramp drops the second the craft stops moving. No recon window, no softening barrage, no turn to get your bearings. You are under fire before your boots are down.",
  // Contested Landing (new objective type, this pass — see
  // data/types.ts's CampaignMission.objective comment for the full "deploy
  // under fire" design conversation, confirmed directly with Maxime over
  // AskUserQuestion: hostiles already positioned at/near the deploy zone at
  // turn 1, no grace period, mechanically eliminate_all-shaped). The design
  // lives entirely in LANDFALL_TILES' own layout (data/mapsAmaranth.ts) —
  // spawn tiles 4 tiles from the deploy column, well inside a first-turn
  // hostile-phase move+attack for most of what's waiting there — not in any
  // new win-condition code; checkWinLoss's contested_landing branch
  // (engine/mission.ts) is byte-for-byte eliminate_all's own check.
  objective: "contested_landing",
  objectiveParams: { turnLimit: 14 },
  playerPilotIds: ACT2_DEFAULT_SQUAD,
  enemyWaves: [
    { archetypeId: "bloom_crawlmass", count: 10, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "bloom_splitfang", count: 6, atTurn: 1, spawnAt: "enemy_deploy" },
    // A second landing wave, turn 3 — reinforcements arriving behind the
    // squad's own beachhead rather than a scripted "pursuit," same device
    // The Long Walk Back used for its own turn-3 wave (Mission 11).
    { archetypeId: "bloom_crawlmass", count: 4, atTurn: 3, spawnAt: "enemy_deploy" },
  ],
  events: [
    {
      id: "ev_landfall_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Okafor: “Ramp's down! Move, move — nobody's dying on the sand!”" },
      once: true,
    },
  ],
  rewardPoints: 310,
  heirloomCharge: "locked",
  bonusAbilityUnlocks: ACT2_UNLOCKS_FROM_14,
};

export const AMARANTH_MISSION_16: CampaignMission = {
  id: "mission_amaranth_16",
  displayName: "Amaranth II.16 — Collaborators",
  mapId: "map_amaranth_collaborators",
  briefing:
    "This depot's House Amaranth colors, House Amaranth crews — and every one of them shooting back. Command's briefing calls them collaborators. The intelligence read underneath that word is uglier: most of this garrison didn't volunteer for either side of this. Clear the depot. What you do with whoever's left standing is still your call to make.",
  objective: "eliminate_all",
  // House Amaranth conscripts (data/units.ts's AMARANTH_CONSCRIPT_MECHS,
  // deliberately named apart from Mission 6's "Line Trooper" veterans — see
  // that constant's own comment) — the campaign doc's own flagged
  // "moral-complexity bonus objective" for this mission (Independent
  // Campaign doc Act II list; claude/Bloom_Wars_Spitball_Ideas.md ties it
  // to the recurring House Amaranth thread). bonusObjective below reuses
  // the existing rescue_pilot shape — same mechanics as Missions 5 and 9's
  // rescue (an incapacitated unit, picked up, carried to an exit tile),
  // reframed in fiction as a conscript trying to get out from under this
  // rather than a friendly pilot. Zero new engine code either way; the
  // shape already generalizes. Flagging this reuse explicitly rather than
  // presenting it as obviously-the-only-option — a different mission could
  // reasonably want a bespoke "captive" mechanic instead (a surrender
  // prompt, a dialogue choice), which this pass does not build.
  objectiveParams: { turnLimit: 12 },
  playerPilotIds: ACT2_DEFAULT_SQUAD,
  enemyWaves: [
    { archetypeId: "hostile_mech_amaranth_conscript_01", count: 2, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "hostile_mech_amaranth_conscript_02", count: 1, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "hostile_mech_amaranth_conscript_03", count: 1, atTurn: 1, spawnAt: "enemy_deploy" },
    { archetypeId: "hostile_mech_amaranth_conscript_04", count: 1, atTurn: 1, spawnAt: "enemy_deploy" },
  ],
  events: [
    {
      id: "ev_collaborators_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Anand: “Reading their formation — that's not veteran spacing. Command briefed us on collaborators. I'm not sure that's what's actually down there.”" },
      once: true,
    },
  ],
  rewardPoints: 320,
  heirloomCharge: "locked",
  // npcSpawnAt kept close to deploy (5 tiles), same fix as Mission 5's own
  // post-playtest lesson (this file's own comment on AMARANTH_MISSION_5) —
  // a distant spawn gets the NPC killed before anyone can reach them.
  bonusObjective: { kind: "rescue_pilot", npcSpawnAt: { x: 5, y: 6 }, npcDisplayName: "Amaranth Conscript, Surrendering", bonusPoints: 45 },
  bonusAbilityUnlocks: ACT2_UNLOCKS_FROM_14,
};

// ---- ACT II — TWO FIRES continued (25 Aug 2026, batch 3 / missions 17-20,
// Maxime: "thing seem clean. lets do the next 4.") ----
// Maps built via /home/claude/scratch/gen_maps2.py, same coordinate-based
// generator/validator discipline as batch 2 — see that script's own header
// and data/mapsAmaranth.ts's batch-3 comment block. Bloom archetype reuse
// corrected this batch: the batch-2 addendum promised Undertow and
// Sporethrower back in rotation "starting with batch 2" and then didn't
// actually do it (batch 2 only used Crawlmass/Splitfang/Gallcyst).
// Sporethrower returns in Mission 17 (first since Mission 7), Undertow
// returns in Mission 19 (first since Mission 4's Tunnel Rats).
export const AMARANTH_MISSION_17: CampaignMission = {
  id: "mission_amaranth_17",
  displayName: "Amaranth II.17 — The Wellroot Uncovered",
  mapId: "map_amaranth_wellroot",
  briefing:
    "Solheim's sensor sweep found something under the terraces that isn't on any survey — a root structure, too regular to be natural, running deeper than anyone's bothered to look before. She's already down there mapping it. Get her out with what she's got before whatever's guarding it decides the interest isn't mutual.",
  objective: "extract_unit",
  // Solheim (Reeps, Runemaster track — vision/sensor work already her own
  // established specialty per SECOND_LANCE_MEKS' own comment) is the
  // natural pick for "the one who found it and has to carry it out,"
  // rather than reusing Anand/Iyari a third time. turnLimit 14 -> 16 after
  // an initial sim batch: WELLROOT_TILES' own 28-wide deploy-to-exit
  // distance (~24 tiles, moveRange 4 Reeps, through occupied ground rather
  // than a straight line) was costing several timeout losses at 14 even
  // when Solheim herself survived — see this mission's build-log tuning
  // note.
  objectiveParams: { turnLimit: 16, extractUnitId: "pilot_solheim" },
  playerPilotIds: ACT2_DEFAULT_SQUAD,
  enemyWaves: [
    // Ground-floor pair at the near terrace mouth.
    { archetypeId: "bloom_crawlmass", count: 6, atTurn: 1, spawnAt: [{ x: 20, y: 2 }] },
    { archetypeId: "bloom_splitfang", count: 1, atTurn: 1, spawnAt: [{ x: 20, y: 12 }] },
    // Sporethrower back in rotation, held to the ridge perches
    // WELLROOT_TILES actually gives it (data/mapsAmaranth.ts) rather than
    // "enemy_deploy" scattering a ranged unit onto open floor it has no
    // business standing on. Started at 3, cut to 1 (see this mission's
    // build-log tuning note) — extract_unit's own zero-tolerance loss
    // condition (Solheim downed = instant loss, not a wipe check) means a
    // squishy Reeps' own escort is the real bottleneck, not overall enemy
    // HP, and ranged chip damage from a second mouth was compounding on
    // top of the Splitfang burst that was already doing the real work of
    // downing her.
    { archetypeId: "bloom_sporethrower", count: 1, atTurn: 1, spawnAt: [{ x: 23, y: 4 }] },
  ],
  events: [
    {
      id: "ev_wellroot_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Solheim: “Static to Warden Actual — whatever this is, it's not growth pattern, it's architecture. I want ten more minutes and I want to be wrong about that.”" },
      once: true,
    },
  ],
  rewardPoints: 330,
  heirloomCharge: "locked",
  // patchTiles = mat17 from gen_maps2.py's stdout — the rooted bloom_mat
  // knot sitting mid-terrace, independent of the extraction itself (see
  // ClearBloomPatchBonusObjective's own comment in data/types.ts: no
  // "failed" state, just incomplete if the mission ends first).
  bonusObjective: {
    kind: "clear_bloom_patch",
    patchTiles: [
      { x: 12, y: 6 }, { x: 13, y: 6 }, { x: 14, y: 6 },
      { x: 12, y: 7 }, { x: 13, y: 7 }, { x: 14, y: 7 },
      { x: 13, y: 8 },
    ],
    bonusPoints: 45,
  },
  bonusAbilityUnlocks: ACT2_UNLOCKS_FROM_14,
};

export const AMARANTH_MISSION_18: CampaignMission = {
  id: "mission_amaranth_18",
  displayName: "Amaranth II.18 — Breakout at Draven's Cut",
  mapId: "map_amaranth_dravens_cut",
  briefing:
    "The cut's the only through-ground for a mile either direction, and it looks like both House Amaranth and whatever's been shadowing them worked that out at the same time you did. West mouth and east mouth, closing at once. There's no clever way through the middle of that — just who you brought, and how you use them.",
  objective: "eliminate_all",
  // A real two-front pincer, not a figure of speech — DRAVENS_CUT_TILES
  // (data/mapsAmaranth.ts) gives House Amaranth Line Troopers the west
  // mouth and a Bloom wave the east mouth as two DISTINCT spawn pools.
  // Both waves below use explicit spawnAt: Coord[] rather than
  // "enemy_deploy" on purpose: deriveZones() (engine/maps.ts) flattens
  // every "spawn"-tagged tile on a map into one combined
  // deployZones.enemy array, so "enemy_deploy" here would round-robin
  // across BOTH mouths at once and collapse the pincer into one mixed
  // wave from a random side — the same gotcha Mission 14's fixed Gallcyst
  // pair and Mission 4's fixed Undertow points already work around, just
  // for a spatial reason here instead of a sessile/burrower one.
  objectiveParams: { turnLimit: 12 },
  playerPilotIds: ACT2_DEFAULT_SQUAD,
  enemyWaves: [
    { archetypeId: "hostile_mech_amaranth_01", count: 1, atTurn: 1, spawnAt: [{ x: 2, y: 5 }, { x: 2, y: 6 }, { x: 2, y: 7 }, { x: 2, y: 8 }] },
    { archetypeId: "hostile_mech_amaranth_02", count: 1, atTurn: 1, spawnAt: [{ x: 2, y: 5 }, { x: 2, y: 6 }, { x: 2, y: 7 }, { x: 2, y: 8 }] },
    { archetypeId: "hostile_mech_amaranth_03", count: 1, atTurn: 1, spawnAt: [{ x: 2, y: 5 }, { x: 2, y: 6 }, { x: 2, y: 7 }, { x: 2, y: 8 }] },
    { archetypeId: "hostile_mech_amaranth_04", count: 1, atTurn: 1, spawnAt: [{ x: 2, y: 5 }, { x: 2, y: 6 }, { x: 2, y: 7 }, { x: 2, y: 8 }] },
    { archetypeId: "bloom_crawlmass", count: 6, atTurn: 1, spawnAt: [{ x: 29, y: 5 }, { x: 29, y: 6 }, { x: 29, y: 7 }, { x: 29, y: 8 }] },
    { archetypeId: "bloom_splitfang", count: 3, atTurn: 1, spawnAt: [{ x: 29, y: 5 }, { x: 29, y: 6 }, { x: 29, y: 7 }, { x: 29, y: 8 }] },
  ],
  events: [
    {
      id: "ev_dravens_cut_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Rourke: “Contact both mouths — this isn't a fight you win by picking a side of the map and camping it. Split smart, or don't split at all.”" },
      once: true,
    },
  ],
  rewardPoints: 340,
  heirloomCharge: "locked",
  bonusAbilityUnlocks: ACT2_UNLOCKS_FROM_14,
};

export const AMARANTH_MISSION_19: CampaignMission = {
  id: "mission_amaranth_19",
  displayName: "Amaranth II.19 — The Silent Ward",
  mapId: "map_amaranth_silent_ward",
  briefing:
    "Undercity, same as Tunnel Rats but bigger and worse lit — separate chambers, narrow rubble seams between them, no sightline further than the next doorway. Command's calling it the Silent Ward because nothing's called in from inside it in three days. Find out why, one room at a time.",
  objective: "eliminate_all",
  objectiveParams: { turnLimit: 14 },
  playerPilotIds: ACT2_DEFAULT_SQUAD,
  enemyWaves: [
    // Undertow back in rotation — first since Mission 4's Tunnel Rats,
    // same template exactly: fixed coords + burrowed: true, never
    // "enemy_deploy" for a burrower (see AMARANTH_MISSION_4's own
    // comment). One per far chamber (B, C, D on SILENT_WARD_TILES).
    {
      archetypeId: "bloom_undertow",
      count: 3,
      atTurn: 1,
      spawnAt: [{ x: 5, y: 11 }, { x: 20, y: 4 }, { x: 20, y: 11 }],
      burrowed: true,
    },
    // Crawlmass holding the central junction chamber everything else
    // funnels through.
    { archetypeId: "bloom_crawlmass", count: 5, atTurn: 1, spawnAt: [{ x: 12, y: 7 }] },
  ],
  events: [
    {
      id: "ev_silent_ward_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Anand: “No transmissions, no bodies, no signs of a fight at the entrance. Whatever went quiet in here, it went quiet fast.”" },
      once: true,
    },
  ],
  rewardPoints: 350,
  heirloomCharge: "locked",
  bonusAbilityUnlocks: ACT2_UNLOCKS_FROM_14,
};

export const AMARANTH_MISSION_20: CampaignMission = {
  id: "mission_amaranth_20",
  displayName: "Amaranth II.20 — Marrow's Line",
  mapId: "map_amaranth_marrows_line",
  briefing:
    "Same ridge line she was watching you from back at Thane's Crossing, except this time she's not staying back. Col. Ysolde Marrow's dug a real position into the middle of this ground and she's not moving off it. Command's not calling this one a checkpoint dispute anymore.",
  objective: "eliminate_all",
  // Marrow's actual first engagement — Mission 6's own "first distant
  // sighting" event explicitly deferred this ("Marrow doesn't actually
  // engage until Mission 20"), so this mission is that promise being paid
  // off. hostile_mech_marrow (data/units.ts's AMARANTH_RIVAL_MECHS) is a
  // data-only tougher rival — tier "C" off the same TIERS ladder every
  // player pilot uses, no bespoke AI. Her §7 "mirror-match, disengages
  // when losing" framing is fiction/plan, not an engine guarantee, same
  // precedent as §6a's Bosk-death handling — see that constant's own
  // comment for the full reasoning and the explicit scope flag (a real
  // predictive disengage mechanic would be new, unbuilt engine work).
  // No Bloom wave this mission on purpose — this is Marrow's fight alone,
  // with an escort, not a three-way brawl that dilutes the beat.
  objectiveParams: { turnLimit: 12 },
  playerPilotIds: ACT2_DEFAULT_SQUAD,
  enemyWaves: [
    // hostile_mech_marrow's own spawnAt ({x:23,y:7}) already matches this
    // coordinate — listed explicitly anyway so this wave reads the same
    // as every other fixed-position entry in this file.
    { archetypeId: "hostile_mech_marrow", count: 1, atTurn: 1, spawnAt: [{ x: 23, y: 7 }] },
    // Line Trooper escort, flanking, same four archetypes as Mission 6
    // and Mission 18 rather than a fresh set — this is the same force,
    // not a new faction.
    { archetypeId: "hostile_mech_amaranth_01", count: 1, atTurn: 1, spawnAt: [{ x: 23, y: 4 }] },
    { archetypeId: "hostile_mech_amaranth_02", count: 1, atTurn: 1, spawnAt: [{ x: 23, y: 4 }] },
    { archetypeId: "hostile_mech_amaranth_03", count: 1, atTurn: 1, spawnAt: [{ x: 23, y: 10 }] },
    { archetypeId: "hostile_mech_amaranth_04", count: 1, atTurn: 1, spawnAt: [{ x: 23, y: 10 }] },
  ],
  events: [
    {
      id: "ev_marrows_line_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Marrow: “You've been easy to track and hard to explain, Warden Company. Let's fix the second part.”" },
      once: true,
    },
  ],
  rewardPoints: 360,
  heirloomCharge: "locked",
  bonusAbilityUnlocks: ACT2_UNLOCKS_FROM_14,
};

// ---- ACT II — TWO FIRES continued (25 Aug 2026, batch 4 / missions 21-24,
// Maxime: "alright cool do next pass") — completes Act II at 24/24.
// Maps built via /home/claude/work/bloom-wars/gen_maps4.py, same discipline
// as every prior batch; all four validated clean first pass (see this
// batch's build-log addendum).
//
// Cut the Root is this batch's real content: bloom_heartwood (data/bloom.ts)
// has been fully defined — endurance 400, sessile, Munti-prioritising via
// engine/ai.ts's emergentDecision() — since before Act I shipped, and never
// used anywhere. Its own documented special rule ("every 2 turns from turn
// 3, spawns 2 Undertow burrowed at the map's spawn seams") is built here as
// pure mission data through the existing generic MissionEvent system, once
// one small real gap was closed: the "spawn" event action never threaded a
// burrowed flag through to createBloomUnit (every existing spawn event was
// flavor/reveal, never a burrower) — see data/types.ts's MissionEvent
// action comment and engine/mission.ts's applyEventAction for the fix. Not
// treated as a scope-flag conversation: a small extension to a generic
// capability, not a new system.
//
// Ash on the Water is the one genuine new system this batch: protect_asset
// (data/types.ts's CampaignMission.objective, MapDefinition.defendZone,
// engine/mission.ts's tickAssetDamage/checkWinLoss). Walked through
// AskUserQuestion before building — "Zone-tick damage" was the recommended
// and chosen shape: the Providence's dock perimeter (ASH_ON_THE_WATER_TILES'
// own "dock"-tagged tiles) ticks PROTECT_ASSET_TICK_DAMAGE (25, see
// data/combatTables.ts) off assetHp per hostile that ends its turn inside
// it, once per turn. Reaching turnLimit is a WIN as long as assetHp > 0 —
// the only loss condition is assetHp hitting 0, never a timeout.
export const AMARANTH_MISSION_21: CampaignMission = {
  id: "mission_amaranth_21",
  displayName: "Amaranth II.21 — Cut the Root",
  mapId: "map_amaranth_cut_the_root",
  briefing:
    "Whatever's rooted under the terraces isn't spreading anymore — it's settled. Anand's reading one enormous signature dead center of a walled chamber, not moving, not hiding. It doesn't have to. Cut the root, or it keeps feeding everything Wellroot's been growing since Mission 17.",
  objective: "eliminate_all",
  objectiveParams: { turnLimit: 16 },
  playerPilotIds: ACT2_DEFAULT_SQUAD,
  enemyWaves: [
    // The Heartwood itself — single spawn tile, dead center of the walled
    // root chamber CUT_THE_ROOT_TILES builds for it. moveRange 0 per
    // data/bloom.ts, so it never leaves this tile; the fight comes to it.
    { archetypeId: "bloom_heartwood", count: 1, atTurn: 1, spawnAt: [{ x: 22, y: 7 }] },
    // No opening escort — see this mission's build-log tuning note for why.
    // First sim pass (6 Crawlmass, open-field coords) produced a 0% win
    // rate that had nothing to do with the escort's own numbers: the squad
    // spent turns 1-4 mopping up Crawlmass, reached the chamber around
    // turn 5 right as reinforcement pressure was already building, and
    // then — this is the real finding — never landed a single attack on
    // the Heartwood in the entire 15-turn loss. The player AI's
    // focus_weak heuristic always prefers the freshly-spawned, low-HP
    // Undertow over a 400-Endurance stationary target, and with a fresh
    // pair arriving every 2 turns forever, that preference never lets up.
    // Cutting the escort entirely buys the squad two genuinely clean turns
    // (1-2) against the Heartwood before turn 3's first reinforcement
    // wave — the only real lever available without touching either the
    // archetype's own documented stats or the player AI's targeting logic,
    // both out of scope for a mission-design pass. No opening wave entry
    // at all now (a count: 0 wave was tried first and dropped — better to
    // just not author a wave that spawns nothing).
  ],
  events: [
    {
      id: "ev_cut_the_root_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Anand: “That's not a wave pattern, that's a heartbeat. Whatever's down there, it's been there a while.”" },
      once: true,
    },
    // bloom_heartwood's own documented special rule, data/bloom.ts: "Every
    // 2 turns from turn 3, spawns 2 Undertow burrowed at the map's spawn
    // seams." The two fixed seam tiles flanking the root chamber
    // (CUT_THE_ROOT_TILES' own (20,5)/(24,9) spawn tiles) are exactly that
    // — never touched by enemy_deploy resolution, only ever by this event.
    {
      id: "ev_heartwood_reinforcements",
      trigger: { type: "turn_start", turn: 3, repeatEvery: 2 },
      action: {
        type: "spawn",
        archetypeIds: ["bloom_undertow", "bloom_undertow"],
        at: [{ x: 20, y: 5 }, { x: 24, y: 9 }],
        burrowed: true,
      },
      once: false,
    },
  ],
  rewardPoints: 380,
  heirloomCharge: "locked",
  bonusAbilityUnlocks: ACT2_UNLOCKS_FROM_14,
};

export const AMARANTH_MISSION_22: CampaignMission = {
  id: "mission_amaranth_22",
  displayName: "Amaranth II.22 — Ash on the Water",
  mapId: "map_amaranth_ash_on_the_water",
  briefing:
    "Providence is holding station off the pier, and the Bloom's noticed. Nothing about this hull is armored for what's coming across the water at it. Two causeways, one dock, and Providence's own patience for how long it can sit still and take it.",
  // Protect Asset debut — see this file's own batch-4 header comment above
  // for the full design conversation. assetMaxHp left at
  // PROTECT_ASSET_DEFAULT_MAX_HP (300, data/combatTables.ts) rather than
  // overridden here; nothing about this mission's own pacing needed a
  // bespoke number once the causeway chokepoints did their job in
  // playtesting (see build-log tuning note).
  objective: "protect_asset",
  objectiveParams: { turnLimit: 14 },
  playerPilotIds: ACT2_DEFAULT_SQUAD,
  // Far-shore spawns only — ASH_ON_THE_WATER_TILES' own two causeways
  // (rows 3-4 and 9-10) are the only passable route from there to the
  // dock, so every hostile here has to commit to a lane, not
  // "enemy_deploy" scattering them onto water they can't cross. Fixed
  // coordinates (2,3)/(2,10) match that map's v2 far-shore spawn tiles —
  // see this file's own build-log tuning note on why v1's spawns (which
  // sat on the dock's own landmass, not across the water at all) had to
  // be corrected before this mission was winnable even once.
  // Counts bumped once (14/6/8, up from an initial 8/4/4) after the v2
  // geometry fix produced a clean 4/4 shutout with zero damage ever
  // reaching the Providence — the causeway chokepoint held perfectly every
  // time, which is a real result but not much of a "rehearsal for Act 3's
  // capital-ship stakes" if the asset is never actually at risk. Re-tested
  // after the bump; see this mission's build-log tuning note for the
  // numbers.
  enemyWaves: [
    { archetypeId: "bloom_crawlmass", count: 14, atTurn: 1, spawnAt: [{ x: 2, y: 3 }, { x: 2, y: 10 }] },
    { archetypeId: "bloom_splitfang", count: 6, atTurn: 1, spawnAt: [{ x: 2, y: 3 }, { x: 2, y: 10 }] },
    { archetypeId: "bloom_crawlmass", count: 8, atTurn: 5, spawnAt: [{ x: 2, y: 3 }, { x: 2, y: 10 }] },
  ],
  events: [
    {
      id: "ev_ash_on_the_water_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Providence Actual: “We can't maneuver off this station without losing the causeways for you. Keep them off the hull, Warden — we'll hold as long as we can.”" },
      once: true,
    },
  ],
  rewardPoints: 390,
  heirloomCharge: "locked",
  bonusAbilityUnlocks: ACT2_UNLOCKS_FROM_14,
};

export const AMARANTH_MISSION_23: CampaignMission = {
  id: "mission_amaranth_23",
  displayName: "Amaranth II.23 — The Amaranth Accord",
  mapId: "map_amaranth_the_amaranth_accord",
  briefing:
    "Anand made contact with a House Amaranth records officer three days ago, off the books. The officer wants out, and wants Command to see what she's carrying first. If what she's saying is true, Wellroot was never an accident Halcyon Amaranth failed to contain — it's a bargain she made on purpose, thirty years running. Get Anand to the exit with the drive before House Amaranth realizes what's walking out the door.",
  objective: "extract_unit",
  // extractUnitId has to resolve to a unit actually in play — checkExtraction
  // (engine/mission.ts) only ever looks up an id already in this.units, and
  // the only path that puts a brand-new NPC on the board is the separate
  // rescue_pilot bonusObjective (spawnRescuableNpc), which is mechanically
  // its own thing — a carried, incapacitated unit, not an extract_unit
  // target. So the records officer stays off-board, narrative only (same
  // "flavor, not a spawned unit" discipline this batch already uses for
  // Marrow's exit in Mission 24), and the actual extraction target is
  // Anand — the pilot who made contact and is carrying the evidence out —
  // following the exact precedent Mission 17 already set (Solheim: "the one
  // who found it and has to carry it out"), not a new mechanic.
  //
  // turnLimit 14 -> 17 after an initial sim batch: roughly half the runs
  // timed out at 14 with Anand still alive and moving toward the exit, not
  // downed — the same "extraction distance vs. turn budget" gap Mission
  // 17's own tuning note already hit once (turnLimit 14 -> 16 there for
  // the same reason). See this mission's build-log tuning note.
  objectiveParams: { turnLimit: 17, extractUnitId: "pilot_anand" },
  playerPilotIds: ACT2_DEFAULT_SQUAD,
  enemyWaves: [
    { archetypeId: "hostile_mech_amaranth_01", count: 1, atTurn: 1, spawnAt: [{ x: 18, y: 2 }] },
    { archetypeId: "hostile_mech_amaranth_02", count: 1, atTurn: 1, spawnAt: [{ x: 18, y: 2 }] },
    { archetypeId: "hostile_mech_amaranth_03", count: 1, atTurn: 1, spawnAt: [{ x: 18, y: 10 }] },
    { archetypeId: "hostile_mech_amaranth_04", count: 1, atTurn: 1, spawnAt: [{ x: 18, y: 10 }] },
  ],
  events: [
    {
      id: "ev_the_amaranth_accord_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Records Officer: “I have thirty years of correspondence and I am not dying in this scrub for it. Whatever you're going to do, do it fast.”" },
      once: true,
    },
  ],
  rewardPoints: 400,
  heirloomCharge: "locked",
  bonusAbilityUnlocks: ACT2_UNLOCKS_FROM_14,
};

export const AMARANTH_MISSION_24: CampaignMission = {
  id: "mission_amaranth_24",
  displayName: "Amaranth II.24 — Two Fires",
  mapId: "map_amaranth_two_fires",
  briefing:
    "The Accord's out, and House Amaranth's done pretending. Bloom from the treeline, House Amaranth's own regulars from the depot, closing on your position from opposite ends of the same field at the same time. Two fires, one company. Command isn't offering a clean way to fight just one of them.",
  objective: "eliminate_all",
  // Act II's finale — Draven's Cut's own two-front shape (Mission 18) at
  // finale scale: both fronts live from turn 1, not staggered, on a bigger
  // map. Same explicit-spawnAt-per-front discipline as Draven's Cut for the
  // same reason (enemy_deploy would collapse the pincer into one mixed
  // pool). Marrow referenced narratively only in the briefing/events below,
  // NOT as a spawned unit — the doc's own line is "Marrow escapes," and
  // §7's actual rival-closure beat is Mission 28, two acts from now; a
  // scripted disengage-and-flee mechanic here would be new, unbuilt engine
  // work for one mission's flavor, the same kind of scope call Mission 20's
  // own comment already flagged for her "mirror-match" framing.
  objectiveParams: { turnLimit: 16 },
  playerPilotIds: ACT2_DEFAULT_SQUAD,
  enemyWaves: [
    { archetypeId: "bloom_crawlmass", count: 10, atTurn: 1, spawnAt: [{ x: 6, y: 1 }, { x: 12, y: 1 }, { x: 18, y: 1 }, { x: 24, y: 1 }] },
    { archetypeId: "bloom_splitfang", count: 4, atTurn: 1, spawnAt: [{ x: 6, y: 1 }, { x: 12, y: 1 }, { x: 18, y: 1 }, { x: 24, y: 1 }] },
    { archetypeId: "hostile_mech_amaranth_01", count: 1, atTurn: 1, spawnAt: [{ x: 6, y: 16 }, { x: 12, y: 16 }, { x: 18, y: 16 }, { x: 24, y: 16 }] },
    { archetypeId: "hostile_mech_amaranth_02", count: 1, atTurn: 1, spawnAt: [{ x: 6, y: 16 }, { x: 12, y: 16 }, { x: 18, y: 16 }, { x: 24, y: 16 }] },
    { archetypeId: "hostile_mech_amaranth_03", count: 1, atTurn: 1, spawnAt: [{ x: 6, y: 16 }, { x: 12, y: 16 }, { x: 18, y: 16 }, { x: 24, y: 16 }] },
    { archetypeId: "hostile_mech_amaranth_04", count: 1, atTurn: 1, spawnAt: [{ x: 6, y: 16 }, { x: 12, y: 16 }, { x: 18, y: 16 }, { x: 24, y: 16 }] },
  ],
  events: [
    {
      id: "ev_two_fires_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Rourke: “Both fronts, same as the cut — split smart or don't split at all. This is the one Command's calling the act.”" },
      once: true,
    },
    {
      id: "ev_two_fires_marrow_escape",
      trigger: { type: "turn_start", turn: 12 },
      action: { type: "dialogue", text: "Anand: “Marrow's signature just pulled off the field entirely. She's not running this fight anymore — somebody else is.”" },
      once: true,
    },
  ],
  rewardPoints: 420,
  heirloomCharge: "locked",
  bonusAbilityUnlocks: ACT2_UNLOCKS_FROM_14,
};

export const AMARANTH_ACT2: CampaignMission[] = [
  AMARANTH_MISSION_13,
  AMARANTH_MISSION_14,
  AMARANTH_MISSION_15,
  AMARANTH_MISSION_16,
  AMARANTH_MISSION_17,
  AMARANTH_MISSION_18,
  AMARANTH_MISSION_19,
  AMARANTH_MISSION_20,
  AMARANTH_MISSION_21,
  AMARANTH_MISSION_22,
  AMARANTH_MISSION_23,
  AMARANTH_MISSION_24,
];

// ---- ACT III — THE LAST RING begins (25 Aug 2026, batch 5 / missions
// 25-28, Maxime: "next time a boss mission just force feed the ai for the
// test. ill build the overarching ai after this. keep adding missions").
// Maps built via the now-deleted gen_maps5.py, same discipline as every
// prior batch; all four validated clean first pass (see this batch's
// build-log addendum). No boss-tagged mission in this batch — 25-28 are
// eliminate_all/extract_unit/hold_zone/eliminate_all, nothing that needed
// the Player AI to be force-fed a target the way a real boss mission will.
// That instruction is logged here for whichever future mission actually is
// one (28 was a candidate — Marrow is a tougher rival unit, not a scripted
// boss fight — see this file's own comment on her below). Maxime confirmed
// (25 Aug 2026, chat) Act III runs the doc's full 25-36 — Mission 35, "The
// Last Ring" [final boss breaches], is the actual likely candidate for
// that instruction, not anything in this batch.
//
// Scope calls made without stopping to ask, on established precedent:
// - Roster stays ACT2_DEFAULT_SQUAD. The Independent Campaign doc's own
//   §10 squad-scaling table names a third lance for Act III (~20 pilots
//   across 4 lances), but its own footnote already flags that table as
//   "the pre-permadeath plan... not a guarantee," and building a new lance
//   (roster entries, a MEK/pilot pair each, integration wiring like
//   engine/campaignState.ts's integrateSecondLance) is real new-system
//   scope, not a data-only mission batch. Deferred, flagged here rather
//   than built silently.
// - deployCapForMission (scenes/TransporterPad.ts) still returns
//   ACT2_DEPLOY_CAP (8) for any mission above 12, Act III included, even
//   though the Independent Campaign doc's §3 lists "higher deploy cap" as
//   one of Act III's three asks. Left alone this batch: with no third lance
//   yet, the roster IS 8 pilots, so an ACT3_DEPLOY_CAP above 8 would be a
//   no-op today — nothing to deploy past what's already fielded. Worth
//   doing the turn a third lance actually exists, not before.
// - Meridian's Oath (Mission 25) is Fire Support (data/abilities.ts's
//   abil_fire_support, already unlocked squad-wide from Mission 14 via
//   ACT2_UNLOCKS_FROM_14) re-fluffed as continuity: Providence's own guns
//   (the ship from Mission 22, "Ash on the Water"), repositioned inland to
//   cover Meridian after that mission's causeway defense. Dialogue-only —
//   zero new ability data, zero new code. Flagging the continuity read as
//   a deliberate choice, not a lore fact locked in — easy to rename if it
//   doesn't fit whatever's actually written for Meridian/Providence
//   elsewhere.
// - Falling Back to Meridian (Mission 27) stays one real hold_zone (the
//   westmost line, closest to Meridian) dressed as three visually distinct
//   trench lines (FALLING_BACK_TO_MERIDIAN_TILES' own rubble/hold tiles) —
//   not a new multi-stage-hold objective type. A real "hold line 1, then
//   line 2, then line 3" mechanic would be new engine work; the fiction
//   sells the retreat, the mechanics don't need to model it.
// - Marrow's Reckoning (Mission 28) stays a normal eliminate_all against
//   hostile_mech_marrow (data/units.ts's AMARANTH_RIVAL_MECHS) and an
//   escort, same as Mission 20. Her §7 "closing turn... she finally chooses
//   who she actually serves" beat is delivered as an objective_complete
//   dialogue event below, AFTER the fight resolves, not a mid-fight
//   scripted side-switch — remove_from_roster (engine/mission.ts's
//   applyEventAction) was ruled out for this back in the batch-4 addendum:
//   it marks a unit downed and logs an extraction-failure line, built for
//   a player-pilot scenario, semantically wrong for a hostile "switches
//   allegiance" beat. A real scripted-defection mechanic (change side mid-
//   mission, keep the unit alive) would be new, unbuilt engine work for one
//   mission's story beat — same scope call already flagged for her Mission
//   20 and Mission 24 appearances. unit_downed events were also considered
//   and dropped for a concrete technical reason, not just a design
//   preference: engine/units.ts's nextInstanceId uses one counter shared
//   across every unit created in the mission (player deploys, then every
//   hostile wave, in order), so a hostile's exact runtime instanceId isn't
//   something mission data can predict or hand-author reliably — no
//   existing mission in this file tries to hook a unit_downed trigger to a
//   specific hostile's id, and this isn't the mission to start.
export const AMARANTH_MISSION_25: CampaignMission = {
  id: "mission_amaranth_25",
  displayName: "Amaranth III.25 — The Reckoning",
  mapId: "map_amaranth_the_reckoning",
  briefing:
    "Command's not calling this a skirmish. Sensor returns off Meridian's outskirts are reading wider and deeper than anything the surge has thrown at Warden Company yet — no single flank holds all of it alone. Providence has pulled off the water and dug her guns in short of the city. First time this war's had a ship at your back instead of just overhead.",
  objective: "eliminate_all",
  // Deliberately the widest single-turn frontage this campaign has ever
  // opened with — THE_RECKONING_TILES' own 34x16, 5-point spawn spread
  // (mapsAmaranth.ts) is built so a wave reads as a tide, not a queue, via
  // the spread rather than raw count. First draft (12/6/4, 22 total) went
  // 0/15 in sim — an 8-pilot squad simply cannot out-attrit that many
  // hostiles arriving on turn 1 with no stagger, regardless of frontage.
  // Cut to 6/3/2 (11 total, roughly half) — see this batch's build-log
  // tuning note for the corrected win rate.
  //
  // Retuned again same day: playerPilotIds moved from ACT2_DEFAULT_SQUAD
  // (8) to ACT3_DEFAULT_SQUAD (12) once Maxime clarified the Third Lance
  // integrates on Mission 24's win — meaning it's already live as of this
  // mission, not something Act III opens without. At 12 pilots, the 6/3/2
  // count went 15/15 in 12-13 turns against an 18-turn target — too easy.
  // Bumped to 10/5/3 (18 total) first — 35/35 wins, but a real tell: zero
  // pilots downed in ANY of those runs, not just zero losses. Eliminate_all
  // has no turn-limit fail (house rule #5), so a mission that always wins
  // AND never costs anyone isn't actually testing the squad — it's just
  // slow. Bumped again to 14/7/4 (25 total) — real attrition finally
  // showed up, but at ~73% (11/15) it swung a bit harder than intended
  // for an opener. 12/6/3 (21 total) swung back too far the other way —
  // 15/15 again, still zero pilots downed in any run. Locked at 13/6/4
  // (23 total): a real cliff sits somewhere between 23 and 25 — 23 still
  // goes 20/20 clean (just long, 17-20 turns against turnLimit 18), 25
  // drops to 73% with real losses. Not smoothed further by hand — that
  // step is a property of this AI/combat system at this squad size, not
  // something worth chasing to a single enemy's precision. 100% clean but
  // long reads fine for an Act III opener meant to establish scale, not
  // be the hardest fight in the act.
  objectiveParams: { turnLimit: 18 },
  playerPilotIds: ACT3_DEFAULT_SQUAD,
  enemyWaves: [
    { archetypeId: "bloom_crawlmass", count: 13, atTurn: 1, spawnAt: [{ x: 30, y: 4 }, { x: 30, y: 7 }, { x: 30, y: 10 }, { x: 28, y: 2 }, { x: 28, y: 13 }] },
    { archetypeId: "bloom_splitfang", count: 6, atTurn: 1, spawnAt: [{ x: 30, y: 4 }, { x: 30, y: 7 }, { x: 30, y: 10 }] },
    { archetypeId: "bloom_sporethrower", count: 4, atTurn: 1, spawnAt: [{ x: 28, y: 2 }, { x: 28, y: 13 }] },
  ],
  events: [
    {
      id: "ev_the_reckoning_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Anand: “That's not a wave, that's a coastline. Command, we are going to need everything you've got.”" },
      once: true,
    },
    {
      id: "ev_the_reckoning_meridians_oath",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Providence Actual: “Providence is dug in short of Meridian and we are not moving off this line. Call it, Warden — Meridian's Oath is live.”" },
      once: true,
    },
  ],
  rewardPoints: 440,
  heirloomCharge: "locked",
  bonusAbilityUnlocks: ACT2_UNLOCKS_FROM_14,
};

export const AMARANTH_MISSION_26: CampaignMission = {
  id: "mission_amaranth_26",
  displayName: "Amaranth III.26 — The Cradle Beneath",
  mapId: "map_amaranth_the_cradle_beneath",
  briefing:
    "Okafor's beacon went dark under the terraces two days after Mission 19's tunnels first opened up, and it just came back live — stationary, not moving, but live. Whatever's down there let her signal through on purpose or couldn't stop it. Either way, someone has to walk into the hive to walk her back out.",
  objective: "extract_unit",
  // Okafor (the Tank) is the deliberate extract target — a slower unit
  // makes the walk-out itself the tension, same "tactical variety in who
  // needs carrying" call this campaign already made for Solheim (Mission
  // 17) and Anand (Mission 23). turnLimit set generous up front (both of
  // those missions needed a mid-tuning bump once sim runs showed the
  // squad reaching the exit tile after the target was already downed or
  // the clock already out) rather than repeating that same discovery a
  // third time.
  objectiveParams: { turnLimit: 20, extractUnitId: "pilot_okafor" },
  // NOT ACT3_DEFAULT_SQUAD (12) — a real bug, caught by re-sim after the
  // Third Lance correction, not tuned around silently. Deploying the full
  // 12 here jammed: by turn 15 in the losing runs, EVERY unit (including
  // Okafor herself) stopped acting entirely — "hold_no_target" dominates
  // the decision tally — because THE_CRADLE_BENEATH_TILES' own main
  // corridor is only 3 tiles tall, and 12 units competing for the same
  // narrow lane toward one exit block gridlock each other (movement
  // treats other player units as occupied tiles, same as everywhere else
  // in this engine). This is the same "wall of idle allies" Player AI
  // limitation flagged back in the batch-4 addendum, just newly visible
  // at 12-unit scale — not a new bug, and per this batch's own standing
  // instruction, not something to fix in the AI here. The honest,
  // mission-design-only fix: a real player CAN still choose to deploy all
  // 12 into this mission and would hit the same jam — flagging that
  // explicitly rather than pretending this squad size is a hard cap.
  // Tried a 9-pilot squad first (down from 12) — went 0/15, WORSE than 12.
  // Real finding, not noise: THE_CRADLE_BENEATH_TILES' own exit block is
  // only 6 tiles (2 cols x 3 rows), and with enough escorts converging on
  // it, they fill every exit tile themselves before Okafor gets there —
  // in the losing logs she reaches (25,7), two tiles from the block, and
  // then simply stops for the rest of the mission because every exit tile
  // is already occupied by her own escort. This is the exact "occupied
  // exit tile" Player AI stall flagged and partially fixed in the batch-4
  // addendum (Mission 23's openExits filtering) — that fix isn't
  // complete for a multi-tile exit zone once escort count is high enough
  // to fill all of it, and per this batch's own standing instruction,
  // that's an AI fix, not a mission-design one, so not touched here.
  // Reverted to this mission's original, already-proven 8-pilot squad
  // instead of chasing a new number — a smaller team for tunnel work
  // reads fine tactically anyway, and this exact composition already
  // validated at ~87% before the Third Lance existed. Left un-set to
  // ACT3_DEFAULT_SQUAD on purpose; this mission's own default stays
  // smaller than the Act III cap.
  playerPilotIds: [
    "pilot_rourke", "pilot_bosk", "pilot_iyari", "pilot_anand", "pilot_lask",
    "pilot_okafor", "pilot_solheim", "pilot_vashti",
  ],
  // Explicit spawnAt at all four hive-chamber coordinates, never
  // "enemy_deploy" — this map's own spawn tiles are split across two
  // north chambers and two south chambers on purpose, and enemy_deploy
  // pools every spawn-tagged tile on the map into one flat array regardless
  // of which chamber it's in (deriveZones()'s own behavior, hit and worked
  // around in every batch since batch 2).
  // Undertow 4 -> 2 after sim: first draft went 9/15 (60%), and every loss
  // was the same shape — Okafor is the extract target AND the Tank, so the
  // Player AI's extract_to_exit heuristic pushes her toward the exit ahead
  // of her own escort (same "target outpaces protection" gap flagged for
  // this heuristic before), and a burrowed Undertow hits hard (single hits
  // of 40-70 in the losing logs) — two of them landing on an isolated
  // Okafor was enough to down her outright before the squad caught up. Not
  // a Player AI fix (out of scope this batch, same standing call as every
  // prior batch's AI limitations) — the mission-design lever is fewer
  // Undertow, which is what the "seams" spawn count was tuning in the
  // first place.
  //
  // TODO(Maxime, 25 Aug 2026, chat): this Undertow cut was a workaround
  // for the escort-AI gap above, not a real balance call — 4 was the
  // intended count for a properly-escorted extraction. Once the
  // overarching AI (Maxime's own build, per this batch's "ill build the
  // overarching ai after this") actually keeps the escort together, bring
  // this back up to 4 and re-sim rather than leaving it at 2 by default.
  enemyWaves: [
    { archetypeId: "bloom_undertow", count: 2, atTurn: 1, spawnAt: [{ x: 9, y: 3 }, { x: 9, y: 11 }], burrowed: true },
    { archetypeId: "bloom_crawlmass", count: 8, atTurn: 1, spawnAt: [{ x: 9, y: 3 }, { x: 19, y: 3 }, { x: 9, y: 11 }, { x: 19, y: 11 }] },
    { archetypeId: "bloom_crawlmass", count: 4, atTurn: 6, spawnAt: [{ x: 9, y: 3 }, { x: 19, y: 3 }, { x: 9, y: 11 }, { x: 19, y: 11 }] },
  ],
  events: [
    {
      id: "ev_the_cradle_beneath_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Okafor: “I'm not hurt, I'm just not going anywhere fast down here. Take your time getting to me — don't take your time getting me out.”" },
      once: true,
    },
  ],
  rewardPoints: 460,
  heirloomCharge: "locked",
  bonusAbilityUnlocks: ACT2_UNLOCKS_FROM_14,
};

export const AMARANTH_MISSION_27: CampaignMission = {
  id: "mission_amaranth_27",
  displayName: "Amaranth III.27 — Falling Back to Meridian",
  mapId: "map_amaranth_falling_back_to_meridian",
  briefing:
    "Two lines already fell getting the company this far back. This is the one Meridian itself is dug in behind, and it's the one Command's told Warden Company not to lose. Everything the surge has been building toward since The Reckoning is still coming — it's just further out this time.",
  objective: "hold_zone",
  // FALLING_BACK_TO_MERIDIAN_TILES' own comment (mapsAmaranth.ts) already
  // flags this as the scope call: three visually distinct trench lines
  // (outer/mid rubble, the real hold zone closest to deploy), one real
  // hold_zone at the westmost line — not a new multi-stage-hold objective.
  // turnLimit/holdUntilTurn reuse Mission 12's own already-battle-tested
  // pair (16/10) as the starting point, unchanged after tuning — the real
  // fix below was to spawn distance, not these numbers.
  //
  // spawnAt corrected off the map's own far-edge "spawn" tiles (x=33) after
  // first sim pass came back 15/15 WIN, every single one at exactly turn
  // 10 with ZERO combat logged at all. Real bug, not good tuning:
  // engine/ai.ts's reflexiveDecision is vision-gated (isVisibleTo, Chebyshev
  // <= observer.vision — Crawlmass vision 3, Splitfang 4, Sporethrower 5)
  // and explicitly holds position when nothing's in sensor range ("nothing
  // in sensor range — hold position rather than beeline the whole board").
  // hold_zone means the player squad never advances past the hold tiles
  // (x=6-9), so hostiles starting 24-27 tiles out at x=33 never once come
  // into anyone's vision and simply never move, turn after turn — this
  // only works for Mission 12's own hold_zone because that mission spawns
  // off "enemy_deploy" (map.deployZones.enemy), which sits close to the
  // hold room by construction. Fixed by moving the actual spawn
  // coordinates used here to x=13 (turn 1, just past the hold zone's own
  // edge — within vision almost immediately once the squad is dug in) and
  // x=17 (turn 5/7 reinforcements, the mid line's own trench, closing over
  // the following turns). The map's own "spawn" tile markers at x=33 are
  // left as-is — they still read fine as "where Command's sensors first
  // picked up the contact," not literally where a unit's instanceId is
  // created; only the mission-data coordinates below needed to move.
  objectiveParams: { turnLimit: 16, holdUntilTurn: 10 },
  playerPilotIds: ACT3_DEFAULT_SQUAD, // moved from ACT2_DEFAULT_SQUAD, same-day Third Lance correction — see Mission 25's own comment
  enemyWaves: [
    { archetypeId: "bloom_crawlmass", count: 10, atTurn: 1, spawnAt: [{ x: 13, y: 2 }, { x: 13, y: 6 }, { x: 13, y: 9 }, { x: 13, y: 11 }] },
    { archetypeId: "bloom_splitfang", count: 4, atTurn: 1, spawnAt: [{ x: 13, y: 2 }, { x: 13, y: 6 }, { x: 13, y: 9 }, { x: 13, y: 11 }] },
    { archetypeId: "bloom_sporethrower", count: 4, atTurn: 5, spawnAt: [{ x: 17, y: 2 }, { x: 17, y: 6 }, { x: 17, y: 9 }, { x: 17, y: 11 }] },
    { archetypeId: "bloom_crawlmass", count: 6, atTurn: 7, spawnAt: [{ x: 17, y: 2 }, { x: 17, y: 6 }, { x: 17, y: 9 }, { x: 17, y: 11 }] },
  ],
  events: [
    {
      id: "ev_falling_back_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Rourke: “This is Meridian's own line. We don't fall back from this one — there's nowhere behind it to fall back to.”" },
      once: true,
    },
    {
      id: "ev_falling_back_outer_line",
      trigger: { type: "turn_start", turn: 4 },
      action: { type: "dialogue", text: "Anand: “Outer line's gone quiet. That's not good news, that's just news.”" },
      once: true,
    },
    {
      id: "ev_falling_back_mid_line",
      trigger: { type: "turn_start", turn: 7 },
      action: { type: "dialogue", text: "Anand: “Mid line's down. Whatever's coming, it's coming to us now.”" },
      once: true,
    },
  ],
  rewardPoints: 480,
  heirloomCharge: "locked",
  bonusAbilityUnlocks: ACT2_UNLOCKS_FROM_14,
};

export const AMARANTH_MISSION_28: CampaignMission = {
  id: "mission_amaranth_28",
  displayName: "Amaranth III.28 — Marrow's Reckoning",
  mapId: "map_amaranth_marrows_reckoning",
  briefing:
    "Same ridge, same rival, bigger ground. Marrow's dug into the middle of this field the way she did at Thane's Crossing, at the line that bears her name, and at Two Fires before she pulled off that one without a shot fired at her back. Command's read is she's not disengaging again. Neither is Warden Company.",
  objective: "eliminate_all",
  // Bigger version of Mission 20's dueling ground, per MARROWS_RECKONING_
  // TILES' own comment — hostile_mech_marrow fixed at the map's own
  // central spawn, matching her own AMARANTH_RIVAL_MECHS spawnAt
  // ({x:23,y:7} there; this map's equivalent center is (24,7)), escort at
  // the two near points, two more troopers held back at the flank points
  // as a turn-5 reinforcement rather than everyone landing on turn 1 the
  // way Mission 20 did it — finale-scale escalation without just doubling
  // the opening wave. No Bloom on this map on purpose, matching Mission
  // 20's own precedent: this is a pure House Amaranth engagement, not a
  // three-way fight that dilutes the rival-closure beat.
  objectiveParams: { turnLimit: 14 },
  // Retuned same day: playerPilotIds moved to ACT3_DEFAULT_SQUAD (12, up
  // from 8) went 15/15 in 11-14 turns — too easy at the original 7-hostile
  // escort. Added a third wave (3 more troopers at turn 8, same reused
  // archetype ids as the rest of this file's House Amaranth Line Trooper
  // waves) for 10 hostiles total; see this batch's build-log addendum for
  // the retuned win rate.
  playerPilotIds: ACT3_DEFAULT_SQUAD, // moved from ACT2_DEFAULT_SQUAD, same-day Third Lance correction — see Mission 25's own comment
  enemyWaves: [
    { archetypeId: "hostile_mech_marrow", count: 1, atTurn: 1, spawnAt: [{ x: 24, y: 7 }] },
    { archetypeId: "hostile_mech_amaranth_01", count: 1, atTurn: 1, spawnAt: [{ x: 24, y: 4 }] },
    { archetypeId: "hostile_mech_amaranth_02", count: 1, atTurn: 1, spawnAt: [{ x: 24, y: 4 }] },
    { archetypeId: "hostile_mech_amaranth_03", count: 1, atTurn: 1, spawnAt: [{ x: 24, y: 10 }] },
    { archetypeId: "hostile_mech_amaranth_04", count: 1, atTurn: 1, spawnAt: [{ x: 24, y: 10 }] },
    { archetypeId: "hostile_mech_amaranth_02", count: 1, atTurn: 5, spawnAt: [{ x: 21, y: 2 }] },
    { archetypeId: "hostile_mech_amaranth_04", count: 1, atTurn: 5, spawnAt: [{ x: 21, y: 12 }] },
    { archetypeId: "hostile_mech_amaranth_01", count: 1, atTurn: 8, spawnAt: [{ x: 21, y: 2 }] },
    { archetypeId: "hostile_mech_amaranth_03", count: 1, atTurn: 8, spawnAt: [{ x: 21, y: 12 }] },
    { archetypeId: "hostile_mech_amaranth_02", count: 1, atTurn: 8, spawnAt: [{ x: 24, y: 7 }] },
  ],
  events: [
    {
      id: "ev_marrows_reckoning_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Marrow: “Halcyon Amaranth thinks this is her fight. It stopped being her fight a while ago — she just hasn't been told yet.”" },
      once: true,
    },
    // The §7 "closing turn... she finally chooses who she actually serves"
    // beat, delivered AFTER the fight resolves — see this file's batch-5
    // header comment for the full reasoning on why this stays
    // dialogue-only and why objective_complete over unit_downed. Fires
    // once eliminate_all's own win check (checkWinLoss) has already
    // returned true, so it never touches whether the fight itself was won.
    {
      id: "ev_marrows_reckoning_closure",
      trigger: { type: "objective_complete" },
      action: { type: "dialogue", text: "Anand: “Marrow's last transmission wasn't to House Amaranth. It was to us. She said she's done carrying water for Halcyon — and that this was the last time she'd do it with a gun in her hand.”" },
      once: true,
    },
  ],
  rewardPoints: 510,
  heirloomCharge: "locked",
  bonusAbilityUnlocks: ACT2_UNLOCKS_FROM_14,
};

// ---- Batch 6 (missions 29-32, 25 Aug 2026, Maxime: "work on next mission
// set now"). Maps built via a throwaway gen_maps6.py (same now-deleted-
// after-use discipline as gen_maps5.py), all four BFS-validated clean —
// see this batch's build-log addendum. House Amaranth's military is done
// as a threat as of Mission 28 (Marrow's own closure, above) — per the
// Independent Campaign doc, everything from here to the Act III finale
// (35, "The Last Ring") is Bloom-only, specifically the Cradle (first
// found at Mission 26, "the source, growing beneath Meridian... the
// campaign's true final boss"). Every enemyWave below is drawn from
// data/bloom.ts accordingly — no hostile_mech_* archetypes appear in this
// batch.
//
// Scope calls made without stopping to ask, on established precedent:
// - Mission 29's Independent Campaign doc tag, "[scripted strategic
//   loss]," does NOT mean a new forced-loss engine mechanic. Mission 12's
//   own header comment already resolved the identical question for its
//   "whoever covers the gate" tag: "No scripted forced-loss event was
//   added here... Mission 12 is a real, winnable (and losable) hold_zone
//   mission... whatever happens... happens live, through the existing
//   permadeath check, same as any other mission." Same call here: 29 is a
//   real, winnable hold_zone, the hardest one in this batch on its own
//   numbers. "The ring falls" is delivered as the strategic fact either
//   way — Command's own withdrawal order, not a verdict on this squad's
//   fight — via an objective_complete dialogue event on a win, same
//   dialogue-only technique already used for Mission 28's Marrow closure.
//   A true forced-loss mechanic (win the fight, still get a scripted
//   "loss" outcome) would be new, unbuilt engine work — flagging that this
//   was the fork, and this is the read taken, in case it's not the one
//   wanted.
// - Mission 30's briefing tag "Meridian's Oath damaged on-station" is
//   built as a real, zero-new-code mechanical fact, not just flavor text:
//   this mission's own CampaignMission simply omits bonusAbilityUnlocks
//   (unlike every other Act II/III mission in this file, which all carry
//   ACT2_UNLOCKS_FROM_14). engine/mission.ts's applyBonusAbilityUnlocks is
//   already per-mission, opt-in — an omission is a complete, working "Fire
//   Support is offline this fight," no new field or branch needed. Assumed
//   back online by Mission 31 (bonusAbilityUnlocks restored there and on
//   32) since nothing in the doc says the loss is permanent — flagging the
//   assumption rather than silently deciding it.
// - Mission 31's "[scripted partial loss]" tag is the one place this
//   batch's design already matches the doc's own framing without a scope
//   call: CampaignMission.civilianSpawns/objectiveParams.extractThreshold
//   (data/types.ts, engine/mission.ts) make "not everyone gets out" true
//   through real difficulty — extractThreshold set below the total
//   civilianSpawns count — the exact same "design intent, not a guaranteed
//   specific" reading data/types.ts's own extractThreshold comment already
//   names for this mission, mirroring §6a's permadeath rule. See the
//   engine-level design notes on civilianSpawns/isCivilian/decideCivilian-
//   Action added to types.ts/units.ts/ai.ts/mission.ts this same batch.
// - Mission 32's "grounded capital ship" is deliberately left unnamed in
//   dialogue below (called only "the transport," "the lift ship") — the
//   Independent Campaign doc itself never names it or confirms it's
//   Providence/Meridian's Oath (which is dug in stationary inland per
//   Mission 25, not a ship that lifts), so inventing a proper name here
//   would be locking in a lore fact that isn't actually decided. Easy to
//   name properly later once that's settled elsewhere.
export const AMARANTH_MISSION_29: CampaignMission = {
  id: "mission_amaranth_29",
  displayName: "Amaranth III.29 — The Outer Ring Falls",
  mapId: "map_amaranth_outer_ring_falls",
  briefing:
    "Command's already given the order — the outer ring falls back to the second line tonight, no argument. Warden Company's job isn't to hold this ground forever. It's to make sure everything behind this line has the time it needs before the order actually happens.",
  objective: "hold_zone",
  // Real, winnable hold_zone — see this batch's header comment for why
  // "[scripted strategic loss]" isn't a new forced-loss mechanic. Toughest
  // fight in this batch on its own numbers, matching "the hardest one in
  // the act" precedent Mission 12 set for the same kind of doc tag.
  // holdUntilTurn/turnLimit start from Mission 27's already-proven 10/16
  // pair; OUTER_RING_FALLS_TILES' own hold room (16 tiles, one 2-wide
  // doorway on its west side, mapsAmaranth.ts) is the same chokepoint
  // shape as every prior hold_zone mission in this file.
  //
  // spawnAt corrected off the map's own decorative far-edge "spawn" tiles
  // (x=27-28) after this exact bug showed up on first sim pass — Mission
  // 27's own build-log note already found the same failure mode once
  // (vision-gated reflexive/pack AI never advances if it never has anyone
  // in sensor range), and this map has a sharper version of it: the hold
  // room's own doorway (mapsAmaranth.ts's OUTER_RING_FALLS_TILES) opens
  // ONLY to the west, so anything spawned due east of the room can't even
  // path to the doorway without first going around via the open north or
  // south corridor — at x=27-28 that's 20+ tiles of travel nothing ever
  // starts because nothing's ever in vision to trigger it. First pass sim
  // went 15/15 in exactly 10 turns every time, Player AI log 100%
  // hold_zone, zero attacks — the real tell, not good tuning. Fixed by
  // moving spawnAt into the north/south corridors themselves (y=1 and
  // y=14, the only two approaches that actually reach the doorway),
  // staggered by x-distance from the door for a "first contact, then
  // reinforcements still closing" feel instead of three genuinely separate
  // approach vectors — a single-doorway room only ever has the one real
  // choke to defend, whichever corridor the pressure is currently coming
  // down. The map's own x=27-28 spawn tiles are left as-is, same "where
  // Command's sensors first picked up the contact" reading Mission 27's
  // own comment already established.
  objectiveParams: { turnLimit: 16, holdUntilTurn: 10 },
  playerPilotIds: ACT3_DEFAULT_SQUAD,
  enemyWaves: [
    { archetypeId: "bloom_crawlmass", count: 10, atTurn: 1, spawnAt: [{ x: 9, y: 1 }, { x: 13, y: 1 }, { x: 9, y: 14 }, { x: 13, y: 14 }] },
    { archetypeId: "bloom_splitfang", count: 5, atTurn: 1, spawnAt: [{ x: 9, y: 1 }, { x: 9, y: 14 }] },
    { archetypeId: "bloom_sporethrower", count: 4, atTurn: 5, spawnAt: [{ x: 16, y: 2 }, { x: 16, y: 13 }] },
    { archetypeId: "bloom_crawlmass", count: 6, atTurn: 8, spawnAt: [{ x: 16, y: 2 }, { x: 16, y: 13 }] },
  ],
  events: [
    {
      id: "ev_outer_ring_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Rourke: “Three directions, one door. We don't need to win this ground, Company — we need to still be standing on it when the order comes.”" },
      once: true,
    },
    {
      id: "ev_outer_ring_reinforcements",
      trigger: { type: "turn_start", turn: 5 },
      action: { type: "dialogue", text: "Anand: “That's not the first wave slowing down. That's the second one arriving.”" },
      once: true,
    },
    // The strategic-fact beat, delivered on a genuine tactical win, same
    // dialogue-only-after-the-fact technique as Mission 28's Marrow
    // closure — never touches whether the fight itself was won or lost.
    {
      id: "ev_outer_ring_withdrawal",
      trigger: { type: "objective_complete" },
      action: { type: "dialogue", text: "Command: “Warden Company, fall back to the second line. You bought us the night — the outer ring was never going to be the one we kept.”" },
      once: true,
    },
  ],
  rewardPoints: 540,
  heirloomCharge: "locked",
  bonusAbilityUnlocks: ACT2_UNLOCKS_FROM_14,
};

export const AMARANTH_MISSION_30: CampaignMission = {
  id: "mission_amaranth_30",
  displayName: "Amaranth III.30 — Ashes of the Second Ring",
  mapId: "map_amaranth_ashes_of_the_second_ring",
  briefing:
    "The second line is city, not open ground — three roads in, rubble everywhere else, and Meridian's Oath gone dark somewhere behind Warden Company rather than out ahead of it. Whatever's dug into these blocks, it's not moving on its own. Someone has to go clear it out, one street at a time.",
  objective: "eliminate_all",
  // Two bloom_gallcyst planted directly on the two road/spine intersections
  // (12,4) and (12,10) as fixed strongpoints — sessile (moveRange 0, 140
  // endurance per data/bloom.ts), so placing them ON the actual travel
  // lanes rather than off in a side room is what makes them read as
  // roadblocks the squad has to commit to clearing, not turrets that never
  // factor into the fight. Everything else (crawlmass/splitfang/
  // sporethrower) enters mobile from the map's own 6 east-edge spawn tiles
  // across turns, closing in on the city grid from the far side.
  //
  // bonusAbilityUnlocks deliberately omitted below — see this batch's
  // header comment on "Meridian's Oath damaged on-station."
  objectiveParams: { turnLimit: 18 },
  playerPilotIds: ACT3_DEFAULT_SQUAD,
  enemyWaves: [
    { archetypeId: "bloom_gallcyst", count: 2, atTurn: 1, spawnAt: [{ x: 12, y: 4 }, { x: 12, y: 10 }] },
    { archetypeId: "bloom_crawlmass", count: 10, atTurn: 1, spawnAt: [{ x: 26, y: 2 }, { x: 25, y: 6 }, { x: 26, y: 6 }, { x: 25, y: 8 }, { x: 26, y: 8 }, { x: 26, y: 12 }] },
    { archetypeId: "bloom_splitfang", count: 5, atTurn: 4, spawnAt: [{ x: 25, y: 6 }, { x: 25, y: 8 }] },
    { archetypeId: "bloom_sporethrower", count: 4, atTurn: 7, spawnAt: [{ x: 26, y: 2 }, { x: 26, y: 12 }] },
  ],
  events: [
    {
      id: "ev_ashes_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Anand: “Meridian's Oath isn't answering. Whatever's out there found the guns before it found us.”" },
      once: true,
    },
    {
      id: "ev_ashes_strongpoint",
      trigger: { type: "turn_start", turn: 3 },
      action: { type: "dialogue", text: "Bosk: “Two of them aren't moving. That's not good news — that means they don't have to.”" },
      once: true,
    },
  ],
  rewardPoints: 560,
  heirloomCharge: "locked",
};

export const AMARANTH_MISSION_31: CampaignMission = {
  id: "mission_amaranth_31",
  displayName: "Amaranth III.31 — The Last Convoy",
  mapId: "map_amaranth_the_last_convoy",
  briefing:
    "Five of Meridian's own people are still out past the second ring, further out than the evacuation ever should have let them get. Warden Company's landing right on top of them — the fight now is getting all six of them back down a road the Bloom already has both ends of.",
  objective: "extract_unit",
  // Multi-civilian extraction debut — see the batch header comment above
  // and this same batch's engine-level design notes (data/types.ts's
  // civilianSpawns/extractThreshold comments, engine/mission.ts's
  // checkExtraction/checkWinLoss, engine/ai.ts's decideCivilianAction) for
  // the full mechanic. extractThreshold: 3 (of 5) is the actual "not
  // everyone gets out" number — chosen over the field's own default
  // (civilianSpawns.length, i.e. "everyone has to make it") specifically
  // so this mission's win condition matches its own doc tag by
  // construction, not just by bad luck.
  //
  // First map/mission draft deployed the squad next to the EXIT (x=4-8)
  // with the convoy stranded all the way out at x=26-29 — a real design
  // bug, not a tuning number: sim testing came back LOSS 15/15, the
  // convoy wiped by turn 3-7 every single time, before the squad had
  // covered a third of the distance separating them. An escort mission
  // needs the escort to start next to what it's escorting. Fixed at the
  // map level (mapsAmaranth.ts's own comment on THE_LAST_CONVOY_TILES) —
  // deploy moved next to the civilian cluster; both retreat west together
  // from turn 1. Retuned after that fix; see this batch's build-log
  // addendum for the corrected win rate.
  //
  // turnLimit set generous up front (20) rather than repeating the
  // Mission 17/23/26 "had to bump it after seeing the squad reach the exit
  // with time still on the clock" discovery a fourth time — the convoy
  // road is ~26 tiles end to end and civilians move at moveRange 4 while
  // fleeing/detouring around threats, not moving in a straight line every
  // turn.
  objectiveParams: { turnLimit: 20, extractThreshold: 3 },
  playerPilotIds: ACT3_DEFAULT_SQUAD,
  // BFS-verified reachable to the exit zone from the (relocated) deploy
  // block by gen_maps6.py (see mapsAmaranth.ts's own comment on THE_LAST_
  // CONVOY_TILES) — scattered right around deploy so the squad starts
  // already escorting, not racing to catch up.
  civilianSpawns: [
    { at: { x: 26, y: 3 }, displayName: "Convoy — Family, north lane" },
    { at: { x: 27, y: 6 }, displayName: "Convoy — Roadcrew foreman" },
    { at: { x: 26, y: 8 }, displayName: "Convoy — Family, south lane" },
    { at: { x: 24, y: 5 }, displayName: "Convoy — Elder, north lane" },
    { at: { x: 25, y: 7 }, displayName: "Convoy — Courier" },
  ],
  // Near seam (x=24, both banks) is first contact, right as the retreat
  // begins — it's the one closest to deploy/the convoy itself. Far seam
  // (x=14-15, both banks) is staged BETWEEN deploy and the exit, arriving
  // turn 7 to block the route home rather than chase from behind — matches
  // this mission's own "they weren't chasing the convoy, they were already
  // ahead of it" dialogue beat below.
  //
  // Waves thinned and re-staggered after sim testing: first draft opened
  // with 8 crawlmass + 4 splitfang simultaneously, all within 2-4 tiles of
  // the civilian cluster turn 1 — went 0/20, civilians dropping below
  // extractThreshold by turn 3-7 in every run. The real cause wasn't the
  // civilian AI (already fixed once this batch — see engine/ai.ts's own
  // comment on moveAwayFrom's preferToward) but raw lethality: splitfang's
  // 38 attackPower against a civilian's own fragile stats (createCivilianUnit,
  // engine/units.ts) is close to a one-hit kill, and 4 of them landing on
  // an unescorted cluster in the same turn is not survivable regardless of
  // how well the squad fights elsewhere on the map. Not fixed by touching
  // civilian stats (a broader, cross-mission balance change, out of scope
  // for tuning one mission) — fixed by thinning and staggering the actual
  // ambush instead. Cutting splitfang from turn 1 entirely first went the
  // other way — 20/20 win, always at turn 6, only 3 of the 5 civilians
  // ever making it into the tally before finishWin() ended the mission
  // early, real cost basically zero. Splitfang re-added in two smaller
  // pairs (turn 2, turn 4) rather than one turn-1 or turn-4 block landed
  // at 13/20 (65%) — both real loss conditions firing across the sample
  // (extraction-below-threshold and turn-limit-reached, not just one),
  // genuine variance in which civilians make it, matching this mission's
  // own doc tag ("not everyone gets out" as real risk, not a guaranteed
  // specific and not a coin flip either way).
  enemyWaves: [
    { archetypeId: "bloom_crawlmass", count: 6, atTurn: 1, spawnAt: [{ x: 24, y: 1 }, { x: 24, y: 11 }] },
    { archetypeId: "bloom_splitfang", count: 2, atTurn: 2, spawnAt: [{ x: 24, y: 1 }, { x: 24, y: 11 }] },
    { archetypeId: "bloom_splitfang", count: 2, atTurn: 4, spawnAt: [{ x: 24, y: 1 }, { x: 24, y: 11 }] },
    { archetypeId: "bloom_crawlmass", count: 6, atTurn: 7, spawnAt: [{ x: 14, y: 1 }, { x: 15, y: 1 }, { x: 14, y: 11 }, { x: 15, y: 11 }] },
    { archetypeId: "bloom_splitfang", count: 4, atTurn: 7, spawnAt: [{ x: 14, y: 1 }, { x: 15, y: 1 }, { x: 14, y: 11 }, { x: 15, y: 11 }] },
  ],
  events: [
    {
      id: "ev_last_convoy_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Rourke: “Five people, one road, both flanks already dirty. Nobody stops moving until they're behind us.”" },
      once: true,
    },
    {
      id: "ev_last_convoy_second_wave",
      trigger: { type: "turn_start", turn: 6 },
      action: { type: "dialogue", text: "Anand: “They weren't chasing the convoy. They were already ahead of it.”" },
      once: true,
    },
  ],
  rewardPoints: 580,
  heirloomCharge: "locked",
  bonusAbilityUnlocks: ACT2_UNLOCKS_FROM_14,
  // Social-hook stub debut (data/types.ts's own comment: "e.g.
  // 'marrow_distant_sighting' or 'bosk_last_words'") — this batch is the
  // first one authored since that field existed, and this mission's own
  // material (who made it out, who didn't, how the squad carries that) is
  // exactly the kind of beat it exists to flag for whatever social system
  // reads it later. Purely descriptive, not wired to anything yet.
  socialHook: "convoy_survivors_who_didnt_make_it",
};

export const AMARANTH_MISSION_32: CampaignMission = {
  id: "mission_amaranth_32",
  displayName: "Amaranth III.32 — Hold at the Spire",
  mapId: "map_amaranth_hold_at_the_spire",
  briefing:
    "The transport's grounded at the Spire with its engines already spinning up, and it needs the ground under it clear until it's not grounded anymore. Everything the Bloom has left in this sector is coming down off the ridge to make sure that doesn't happen.",
  objective: "protect_asset",
  // Second protect_asset debut, data/types.ts's own comment on
  // assetMaxHp already anticipated this. HOLD_AT_THE_SPIRE_TILES' own dock
  // zone is bigger than Ash on the Water's (42 tiles vs that map's
  // smaller perimeter) and this is later in the campaign, so assetMaxHp is
  // bumped above PROTECT_ASSET_DEFAULT_MAX_HP (300, data/combatTables.ts)
  // rather than left at the default — ship needs to survive a wider
  // perimeter under sustained pressure for the same number of turns, not
  // just a bigger number for its own sake.
  //
  // First-draft counts (12/6/4/6, turnLimit 16) went 20/20 win, always at
  // exactly turn 17, and the ship never once took damage across the whole
  // sample — tickAssetDamage never fired a single time. Not just a tuning
  // number: HOLD_AT_THE_SPIRE_TILES' own deploy row (16 tiles, full width
  // of the dock's north edge) sat directly between every north-spawned
  // hostile and the dock, so the squad's default formation read as an
  // unbroken wall. Fixed at the map level first (mapsAmaranth.ts's own
  // comment on HOLD_AT_THE_SPIRE_TILES) — deploy split into two flank
  // blocks, leaving the dock's own center north edge open by default, same
  // "two causeways" tension Ash on the Water's defendZone design already
  // used. Counts also roughly doubled (matching that mission's own +75%
  // fix), a fourth wave added, turnLimit extended to 22 for the longer
  // fight.
  //
  // Re-sim after both fixes: 11/20 win (55%), real squad-wipe risk on the
  // loss side, but the ship itself only actually took damage once across
  // the sample — the split-flank gap makes a breach POSSIBLE, not common,
  // because the Player AI's own reflex is to charge out and meet threats
  // in the open field well north of the dock (same "advance_into_range"/
  // "focus_weak" heuristics sim/playerAi/index.ts already documents),
  // which keeps most fighting far from the center gap regardless of
  // formation. Leaving this as a known texture gap rather than chasing it
  // further this batch — the mission is real, winnable, losable, and has
  // genuine stakes via squad attrition; "the ship visibly takes damage
  // under bad positioning" reads as a nice-to-have polish pass, not a
  // blocker, and forcing it further would mean tuning against how the
  // Player AI happens to behave rather than the mission itself. Worth a
  // second look if a real human player's own positioning turns out to
  // make this a non-issue in practice, or not.
  objectiveParams: { turnLimit: 22, assetMaxHp: 420 },
  playerPilotIds: ACT3_DEFAULT_SQUAD,
  enemyWaves: [
    { archetypeId: "bloom_crawlmass", count: 20, atTurn: 1, spawnAt: [{ x: 3, y: 1 }, { x: 9, y: 1 }, { x: 16, y: 1 }, { x: 22, y: 1 }] },
    { archetypeId: "bloom_splitfang", count: 10, atTurn: 1, spawnAt: [{ x: 3, y: 1 }, { x: 22, y: 1 }] },
    { archetypeId: "bloom_sporethrower", count: 7, atTurn: 6, spawnAt: [{ x: 9, y: 1 }, { x: 16, y: 1 }] },
    { archetypeId: "bloom_crawlmass", count: 10, atTurn: 10, spawnAt: [{ x: 9, y: 1 }, { x: 16, y: 1 }] },
    { archetypeId: "bloom_splitfang", count: 6, atTurn: 14, spawnAt: [{ x: 3, y: 1 }, { x: 22, y: 1 }] },
  ],
  events: [
    {
      id: "ev_hold_at_spire_opening",
      trigger: { type: "turn_start", turn: 1 },
      action: { type: "dialogue", text: "Rourke: “Engines are spinning. That means everyone up on that ridge just heard them too.”" },
      once: true,
    },
    {
      id: "ev_hold_at_spire_midpoint",
      trigger: { type: "turn_start", turn: 8 },
      action: { type: "dialogue", text: "Bosk: “Deck's still holding. Keep it that way a little longer.”" },
      once: true,
    },
  ],
  rewardPoints: 600,
  heirloomCharge: "locked",
  bonusAbilityUnlocks: ACT2_UNLOCKS_FROM_14,
};

export const AMARANTH_ACT3: CampaignMission[] = [
  AMARANTH_MISSION_25,
  AMARANTH_MISSION_26,
  AMARANTH_MISSION_27,
  AMARANTH_MISSION_28,
  AMARANTH_MISSION_29,
  AMARANTH_MISSION_30,
  AMARANTH_MISSION_31,
  AMARANTH_MISSION_32,
];

export const AMARANTH_MISSIONS_BY_ID: Record<string, CampaignMission> = Object.fromEntries(
  [...AMARANTH_ACT1, ...AMARANTH_ACT2, ...AMARANTH_ACT3].map((m) => [m.id, m])
);
