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

export const AMARANTH_ACT2: CampaignMission[] = [
  AMARANTH_MISSION_13,
  AMARANTH_MISSION_14,
  AMARANTH_MISSION_15,
  AMARANTH_MISSION_16,
  AMARANTH_MISSION_17,
  AMARANTH_MISSION_18,
  AMARANTH_MISSION_19,
  AMARANTH_MISSION_20,
];

export const AMARANTH_MISSIONS_BY_ID: Record<string, CampaignMission> = Object.fromEntries(
  [...AMARANTH_ACT1, ...AMARANTH_ACT2].map((m) => [m.id, m])
);
