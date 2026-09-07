// engine/facilityHouseAmaranth.ts — House Amaranth's hub, the Greathouse,
// as a FacilityProfile. 6 Sep 2026, House Amaranth Hub build step 3
// (claude/Bloom_Wars_House_Amaranth_Hub_Build_Plan_v1.md), on the locked
// 4 Sep design (Bloom_Wars_House_Amaranth_Hub_Facility_Plan_v1.md) and
// Maxime's approval calls of 6 Sep 2026: "The Greathouse", flavour room
// names as drawn in the mockup, three Cultivar Works (one per lance), and
// the default answers to the mockup's Q3/Q5/Q6/Q7 (Reliquary on 2SS; the
// Cellars and Records kept as decor-only rooms; Verinis as Brigadier with
// the Seal-holder's empty chair behind his desk; the yard — rc — ss1 — ss2
// floor chain with stairs at the corridor ends).
//
// The geometry is hubLayoutHouseAmaranth.ts's. This file is the building's
// NAMES, WIRING and PEOPLE: what each room is called and what it says when
// empty, which floor it's on, where the stairs go, where the six buildable
// bays stand, the landmark points, Verinis, Marrow, the three Longhouse
// regulars. Everything mechanical is shared with Warden through the room
// ids (a Barracks IS `berths`), which is the whole point of the profile
// design — see engine/facility.ts.
//
// What this profile deliberately does NOT carry yet (Build Plan §2 step 4,
// "content, the honest minimum" — Maxime's to write, flagged in the
// build-log addendum):
// - Verinis's own lines. Until they exist he speaks Arangement's CO lines
//   through the shared pickCo* pools — wrong in voice, not broken.
// - Hand-placed Mek seeds / per-Mek catalyst picks (mekSeeds is empty,
//   mekCatalysts is empty): every Mek is placed by Hub.ts's generic loop in
//   its own lance's Cultivar Works and takes catalystForPilot's fallback.
//   Warden's five-plus-ten picks were a content pass; the estate's should be
//   too.
// - A rank field for Marrow. The header reads her static record
//   ("Col. Ysolde Marrow") — see mc.headerLabel.

import type { FacilityProfile } from "./facility";
import {
  GH_BAY_MARKERS,
  GH_BENCH_POINT,
  GH_CO_POINT,
  GH_CREW_RECORDS_POINT,
  GH_GAME_TABLE_POINT,
  GH_MEK_SPOTS,
  GH_MUSTER_POINT,
  GH_PLAYER_SPAWN,
  GH_PLINTH_POINT,
  GH_ROSTER_CONSOLE_POINT,
  GH_SEATS,
  GH_STAIRS,
  GH_STANDINGS_POINT,
} from "./hubLayoutHouseAmaranth";
import { createHouseAmaranthCampaignState } from "./campaignState";
import { HOUSE_AMARANTH_MISSIONS_BY_ID } from "../data/campaignHouseAmaranth";
import { nextHouseAmaranthMission } from "../data/missionBriefing";
import { HOUSE_AMARANTH_NPC_BOND_SEED, HOUSE_AMARANTH_REGULARS } from "../data/npcSeedHouseAmaranth";

// Marrow has no rank field (Build Plan §3, flagged; campaignState.ts's own
// createHouseAmaranthCampaignState note says rourkeRank stays "2nd_lt"
// forever on this side and is never Marrow's). So the header reads her live
// record's displayName as-is — "Col. Ysolde Marrow" — which is honest today
// and becomes wrong the day a promotion schedule exists. Written as a
// function of state, same shape as Warden's, so that day is a one-line
// change here and nowhere else.
function marrowHeaderLabel(state: { pilots: Record<string, { pilot: { displayName: string } }> }): string {
  return state.pilots["pilot_marrow"]?.pilot.displayName ?? "Col. Ysolde Marrow";
}

export const HOUSE_AMARANTH_FACILITY: FacilityProfile = {
  sceneKey: "HubHouseAmaranth",
  displayName: "THE GREATHOUSE",
  levelWord: "FLOOR",
  companyName: "House Amaranth",
  backButtonLabel: "BACK TO THE CAMPAIGN SHOP",

  // Yard — RC — 1SS — 2SS. A path, like Warden's, so Hub.ts's nextHopDoor
  // walks it unchanged. Written deepest-first to match Warden's
  // upper-first convention (the order only has to be a line).
  deckOrder: ["ss2", "ss1", "rc", "yard"],

  // Flavour names as drawn (approved 6 Sep 2026). Cultivar Works and the
  // Reliquary are Maxime's own from the Mission Plan; the rest arrived with
  // the mockup. Upper-case to match Warden's title-bar register.
  roomTitles: {
    berths: "BARRACKS — 1ST LANCE",
    berthsB: "BARRACKS — 2ND LANCE",
    berthsC: "BARRACKS — 3RD LANCE",
    heads: "THE WASHHOUSE",
    engineering: "THE BOILER ROOM",
    recroom: "THE LONGHOUSE",
    hangarDeck: "THE MOTOR COURT",
    lowerHall: "THE GALLERY",
    cellars: "THE CELLARS",
    workshop: "CULTIVAR WORKS — 1ST LANCE",
    workshopB: "CULTIVAR WORKS — 2ND LANCE",
    workshopC: "CULTIVAR WORKS — 3RD LANCE",
    ss1Hall: "UNDERCROFT PASSAGE",
    vault: "THE RELIQUARY",
    cic: "THE WAR ROOM",
    forwardBays: "THE SIGNAL CELLAR",
    controlRoom: "THE CONTROL ROOM",
    records: "RECORDS",
    ss2Hall: "DEEP PASSAGE",
    sparRoom: "THE YARD",
  },

  // Same "not built yet, not broken" register as Warden's notes. The two
  // rooms with no mechanic (Q5: the Cellars, Records) get one each on
  // purpose — Warden's own rule for an empty room. The bench still runs the
  // carrier-module system under an estate name ("estate works") — the
  // panel's own strings are still Warden's ("CARRIER UPGRADE MODULES"),
  // flagged in the Build Plan as a cosmetic string pass that can wait.
  roomNotes: {
    hangarDeck: "Console for roster, gear and recruiting. The BAY pad at the terrace gate is where the lances muster to deploy.",
    workshop: "Walk to the bench and press E for estate works. Gear and tiers are at the Motor Court console.",
    workshopB: "Second Lance's own works. Empty until they come up from the terraces.",
    workshopC: "Third Lance's own works. Empty until they come up from the terraces.",
    vault: "Walk to the plinth and press E for house offers, holdings, and standing.",
    berths: "The battlegroup's bunks. Recruitment, romance, one-on-one scenes — not wired in yet.",
    berthsB: "Second Lance's bunks. Empty until they come up from the terraces.",
    berthsC: "Third Lance's bunks. Empty until they come up from the terraces.",
    heads: "Stalls, basins, baths. Nothing to do here but the obvious.",
    engineering: "Generator, Fabricator, Restock — ask the Brigadier to build one.",
    forwardBays: "Sensor Array, Weapons Bay, Beacon Control — ask the Brigadier to build one.",
    cic: "Fire-support config, Energy allocation — not wired in yet.",
    cellars: "Stores, casks, the salvage cage. Nothing to do down here yet.",
    // No note for the Control Room — the same call Warden's grotto made on
    // 27 Aug 2026: the CO standing there IS the content, and a centred note
    // drew straight through his name tag (checkHubHouseAmaranth's capture).
    records: "The House's paper. Nothing to read here yet.",
    sparRoom: "Where the lances work things out with their fists, once there's a real reason to. Nothing wired in yet.",
  },

  roomDeck: {
    berths: "rc",
    berthsB: "rc",
    berthsC: "rc",
    heads: "rc",
    engineering: "rc",
    recroom: "rc",
    hangarDeck: "rc",
    lowerHall: "rc",
    cellars: "ss1",
    workshop: "ss1",
    workshopB: "ss1",
    workshopC: "ss1",
    ss1Hall: "ss1",
    vault: "ss2",
    cic: "ss2",
    forwardBays: "ss2",
    controlRoom: "ss2",
    records: "ss2",
    ss2Hall: "ss2",
    sparRoom: "yard",
  },

  // Every room but the three passages (the Gallery, the Undercroft Passage,
  // the Deep Passage) — same "you walk THROUGH a corridor" rule as Warden's.
  roamableRooms: ["recroom", "hangarDeck", "berths", "berthsB", "berthsC", "heads", "engineering", "cellars", "workshop", "workshopB", "workshopC", "vault", "cic", "forwardBays", "controlRoom", "records", "sparRoom"],

  lanceBerths: { a: "berths", b: "berthsB", c: "berthsC" },
  lanceWorkshops: { a: "workshop", b: "workshopB", c: "workshopC" },
  mekSpots: GH_MEK_SPOTS,

  // Six stairs, three pairs, at the corridor ends where Warden's are. The
  // Deep Floor's single stair is the design (the secure floor is a dead
  // end); the Yard's gate is at the east end of the Gallery.
  doors: [
    { id: "gallery-to-undercroft", room: "lowerHall", x: GH_STAIRS.rcToSs1.x, y: GH_STAIRS.rcToSs1.y, toRoom: "ss1Hall", toX: GH_STAIRS.ss1ToRc.landing.x, toY: GH_STAIRS.ss1ToRc.landing.y, label: "THE UNDERCROFT" },
    { id: "undercroft-to-gallery", room: "ss1Hall", x: GH_STAIRS.ss1ToRc.x, y: GH_STAIRS.ss1ToRc.y, toRoom: "lowerHall", toX: GH_STAIRS.rcToSs1.landing.x, toY: GH_STAIRS.rcToSs1.landing.y, label: "THE GALLERY" },
    { id: "undercroft-to-deep", room: "ss1Hall", x: GH_STAIRS.ss1ToSs2.x, y: GH_STAIRS.ss1ToSs2.y, toRoom: "ss2Hall", toX: GH_STAIRS.ss2ToSs1.landing.x, toY: GH_STAIRS.ss2ToSs1.landing.y, label: "THE DEEP FLOOR" },
    { id: "deep-to-undercroft", room: "ss2Hall", x: GH_STAIRS.ss2ToSs1.x, y: GH_STAIRS.ss2ToSs1.y, toRoom: "ss1Hall", toX: GH_STAIRS.ss1ToSs2.landing.x, toY: GH_STAIRS.ss1ToSs2.landing.y, label: "THE UNDERCROFT" },
    { id: "gallery-to-yard", room: "lowerHall", x: GH_STAIRS.rcToYard.x, y: GH_STAIRS.rcToYard.y, toRoom: "sparRoom", toX: GH_STAIRS.yardToRc.landing.x, toY: GH_STAIRS.yardToRc.landing.y, label: "THE YARD" },
    { id: "yard-to-gallery", room: "sparRoom", x: GH_STAIRS.yardToRc.x, y: GH_STAIRS.yardToRc.y, toRoom: "lowerHall", toX: GH_STAIRS.rcToYard.landing.x, toY: GH_STAIRS.rcToYard.landing.y, label: "THE GALLERY" },
  ],

  // The same six ReservedBayIds Warden has (they're campaign-wide state and
  // the build economy keys off them), standing in the same two rooms by id:
  // Generator / Fabricator / Restock in the Boiler Room, Sensor / Weapons /
  // Beacon in the Signal Cellar.
  reservedBays: [
    { id: "sensorArray", deck: "ss2", label: "SENSOR\nARRAY\n(reserved)", x: GH_BAY_MARKERS.ss2.x, y: GH_BAY_MARKERS.ss2.ys[0] },
    { id: "weaponsBay", deck: "ss2", label: "WEAPONS\nBAY\n(reserved)", x: GH_BAY_MARKERS.ss2.x, y: GH_BAY_MARKERS.ss2.ys[1] },
    { id: "beaconControl", deck: "ss2", label: "BEACON\nCONTROL\n(reserved)", x: GH_BAY_MARKERS.ss2.x, y: GH_BAY_MARKERS.ss2.ys[2] },
    { id: "generator", deck: "rc", label: "GENERATOR\n(reserved)", x: GH_BAY_MARKERS.rc.x, y: GH_BAY_MARKERS.rc.ys[0] },
    { id: "fabricator", deck: "rc", label: "FABRICATOR\n(reserved)", x: GH_BAY_MARKERS.rc.x, y: GH_BAY_MARKERS.rc.ys[1] },
    { id: "restockRoom", deck: "rc", label: "RESTOCK\nROOM\n(reserved)", x: GH_BAY_MARKERS.rc.x, y: GH_BAY_MARKERS.rc.ys[2] },
  ],

  points: {
    muster: GH_MUSTER_POINT,
    hangarShop: GH_ROSTER_CONSOLE_POINT,
    crewRecords: GH_CREW_RECORDS_POINT,
    recroomTable: GH_GAME_TABLE_POINT,
    recroomBoard: GH_STANDINGS_POINT,
    recroomSeats: GH_SEATS,
    workshopBench: GH_BENCH_POINT,
    vaultPlinth: GH_PLINTH_POINT,
    co: GH_CO_POINT,
    playerSpawn: GH_PLAYER_SPAWN,
  },
  spawnRoom: "recroom",

  // Brigadier Verinis Amaranth — locked 4 Sep 2026 (Facility Plan §5):
  // human, House Amaranth by blood, the field commander with full authority
  // over the facility and none over Marrow once she's in the field ("an
  // asshole, plain and simple"). Brigadier is the doc's proposed rank, taken
  // as the default on approval (Q6). Human, so isRomanceableSpecies() reads
  // him as open — the doc checked this on purpose; Arangement's Carabil
  // caps him, Verinis isn't capped.
  // Colour: amaranth-rose, the House's own — not Arangement's brass, not a
  // PATH_COLORS pick (he's no more a deployable pilot than Arangement is).
  // Catalyst: shark — PLACEHOLDER, mine, flagged. catalystProfile.ts reads
  // shark as ambition/drive/relentless, and CATALYST_CLASH_PAIRS puts it
  // against wolf (Meir) and rabbit (Orin): a CO whose read grates on two of
  // the five is what "asshole, plain and simple" sounds like in the one
  // dial the ambient system has. Stage "command", same as Arangement — he
  // isn't on the tier-promotion track either. The social seed copies
  // Arangement's placeholder triple.
  co: {
    displayName: "Brig. Verinis Amaranth",
    color: 0xb04a6a,
    species: "human",
    catalyst: "shark",
    stage: "command",
    room: "controlRoom",
    socialSeed: { favorability: 0, stress: 20, morale: 70 },
  },

  mc: {
    pilotId: "pilot_marrow",
    shortName: "Marrow",
    headerLabel: marrowHeaderLabel,
  },

  regulars: HOUSE_AMARANTH_REGULARS,
  bondSeed: HOUSE_AMARANTH_NPC_BOND_SEED,
  mekSeeds: [],
  mekCatalysts: {},

  missionsById: HOUSE_AMARANTH_MISSIONS_BY_ID,
  nextMission: nextHouseAmaranthMission,
  createCampaignState: () => createHouseAmaranthCampaignState(),
};
