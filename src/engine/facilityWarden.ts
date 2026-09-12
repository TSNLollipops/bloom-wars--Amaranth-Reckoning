// engine/facilityWarden.ts — Warden Company's hub, the Providence, as a
// FacilityProfile. 6 Sep 2026, House Amaranth Hub build step 1. Renamed
// from "the Antfarm" 12 Sep 2026 (Maxime: "we gotta rename the hub from
// antfarm to the providence") — displayName below is the only line that
// actually reaches the player (Hub.ts's own header readout, `${profile.
// displayName} — ${roomTitle}`); every dated build-log comment elsewhere
// in this codebase that says "Antfarm Grid v0," "Antfarm build economy,"
// or cites Bloom_Wars_Antfarm_Carrier_Hub_v1.md by name is left exactly
// as it was on purpose — those are historical build-phase labels and doc
// citations from when that WAS the name, not live UI text, and rewriting
// them would misdate the project's own history for no player-facing gain.
//
// Nothing in this file is new. Every table, point, name and seed below is
// exactly what scenes/Hub.ts held as module-level constants until the
// facility split (ROOM_TITLES, ROOM_NOTES, ROOM_DECK, ROAMABLE_ROOMS,
// LANCE_BERTHS, LANCE_WORKSHOP, DOORS, DECK_ORDER, RESERVED_BAYS, the
// hand-built CO in buildNpcs(), mekSeeds and MEK_CATALYST_OVERRIDES, the
// header's Rourke line) — moved here with their history so Hub.ts could
// stop knowing whose building it was drawing. The Playwright harness
// (tools/verify) is the proof of "moved, not changed": the six Hub scripts
// that passed against the pre-split Hub must pass identically against this.
//
// Landmark coordinates still live in hubLayout.ts next to the geometry
// they're derived from; this file only points at them.

import type { FacilityProfile } from "./facility";
import {
  BAY_MARKERS,
  CIC_TABLE_POINT,
  CO_POINT,
  CREW_RECORDS_POINT,
  HANGAR_SHOP_POINT,
  MEK_SPOTS,
  MUSTER_POINT,
  PLAYER_SPAWN,
  RECROOM_BOARD_POINT,
  RECROOM_SEATS,
  RECROOM_TABLE_POINT,
  STAIRS,
  VAULT_PLINTH_POINT,
  WORKSHOP_BENCH_POINT,
} from "./hubLayout";
import { createWardenCampaignState, rankDisplayTitle } from "./campaignState";
import { AMARANTH_MISSIONS_BY_ID, WARDEN_PILOTS } from "../data/campaignAmaranth";
import { nextWardenMission } from "../data/missionBriefing";
import { NPC_BOND_SEED, NPC_SEED } from "../data/npcSeed";

// Rourke's own rank readout, 27 Aug 2026 (later pass) — Social Sim Roadmap
// #5's own follow-on note: now that CampaignState.rourkeRank is a real,
// live stat (§38's rourkeRank fix), it deserves the same "moment AND
// lasting evidence" treatment as a pilot's own Stage badge — the
// rank-deference greeting (§38) is the moment, this is the evidence.
// Deliberately NOT read off WARDEN_PILOTS' own displayName ("2nd Lt. Dessa
// Rourke — ...") — that string's rank prefix is static campaign-start data
// and never changes, exactly the trap buildPlayer()'s own header already
// warns about; this builds a fresh label from the live rank instead,
// keeping only the name/callsign half of the static string.
const ROURKE_STATIC_RANK_PREFIX = "2nd Lt. ";
function rourkeHeaderLabel(state: { rourkeRank: Parameters<typeof rankDisplayTitle>[0] }): string {
  const rourkeStatic = WARDEN_PILOTS.find((p) => p.id === "pilot_rourke");
  const rourkeNameAndCallsign =
    rourkeStatic && rourkeStatic.displayName.startsWith(ROURKE_STATIC_RANK_PREFIX)
      ? rourkeStatic.displayName.slice(ROURKE_STATIC_RANK_PREFIX.length)
      : (rourkeStatic?.displayName ?? "Rourke");
  return `${rankDisplayTitle(state.rourkeRank)} ${rourkeNameAndCallsign}`;
}

export const WARDEN_FACILITY: FacilityProfile = {
  sceneKey: "Hub",
  displayName: "THE PROVIDENCE",
  levelWord: "DECK",
  companyName: "Warden Company",
  // Renamed from "BACK TO HANGAR" (3 Sep 2026, Maxime's call) — this button
  // jumps to the separate Hangar SCENE (the "CAMPAIGN SHOP" screen), not
  // the Hub's own internal "Hangar Deck" ROOM, and the old label read as
  // if it meant the latter.
  backButtonLabel: "BACK TO THE CARRIER",

  // DECK_ORDER, 28 Aug 2026 — the three original decks were always a
  // straight line (lower — grotto — upper); sparRoom extends that same
  // line by one more hop off the lower end (lower — sparRoom), not a
  // branch off it, so the whole deck graph is still just a path, not a
  // tree — which is what lets Hub.ts's nextHopDoor walk it generically.
  deckOrder: ["upper", "grotto", "lower", "sparRoom"],

  // Build Plan §9, piece #4's own room ("transporter pad is its own room")
  // plus Antfarm §2/§11.3's five rooms + the grotto. sparRoom, 28 Aug 2026
  // — a 4th deck, single-room like the grotto. workshopB/workshopC —
  // Carrier Scale-Up Plan v1 Phase 2, 3 Sep 2026: one Mek workshop per
  // lance; `workshop` is Lance A's and keeps its id. berthsB/berthsC (one
  // berth per lance), heads, engineering, forwardBays and the two spine
  // corridors all arrived with the 3 Sep floor-plan pass.
  roomTitles: {
    recroom: "REC ROOM",
    hangarDeck: "HANGAR DECK",
    berths: "BERTHS — 1ST LANCE",
    berthsB: "BERTHS — 2ND LANCE",
    berthsC: "BERTHS — 3RD LANCE",
    heads: "HEADS",
    engineering: "ENGINEERING",
    lowerHall: "MAIN CORRIDOR",
    workshop: "THE WORKSHOP",
    workshopB: "2ND LANCE WORKSHOP",
    workshopC: "3RD LANCE WORKSHOP",
    vault: "THE VAULT",
    cic: "CIC / BRIDGE",
    forwardBays: "FORWARD BAYS",
    upperHall: "MAIN CORRIDOR",
    grotto: "THE GROTTO",
    sparRoom: "THE SPAR ROOM",
  },

  // Antfarm §2 (the five-room table) and §11.3 (the grotto) already give
  // every one of these a real mechanical job — none of it is built here.
  // An honest placeholder note per room, not a feature list, so an empty
  // room reads as "not built yet" rather than "broken." recroom has none —
  // it's the one room with real content already. grotto lost its own note
  // 27 Aug 2026 — buildNpcs() seats a real CO there now.
  roomNotes: {
    // Tier 4, 30 Aug 2026 — the roster/stats panel lives here now. 3 Sep
    // 2026: the launch BAY lives here too (MUSTER_POINT), not in the Rec Room.
    hangarDeck: "Terminal for roster, gear and recruiting. The BAY pad is where the crew musters to deploy.",
    // 2 Sep 2026 — the carrier modules live here for real
    // (WORKSHOP_BENCH_POINT / buildWorkshopOverlay). Gear and tier
    // purchases genuinely DO still live at the Hangar Deck console.
    workshop: "Walk to the bench and press E for carrier modules. Gear and tiers are at the Hangar Deck console.",
    // Carrier Scale-Up Plan v1 Phase 2, 3 Sep 2026. Deliberately honest
    // about the empty case rather than gating the rooms out of existence.
    // The carrier-module bench is NOT duplicated here (the Plan doc's own
    // decision 1).
    workshopB: "Second Lance's own maintenance bay. Empty until they come aboard.",
    workshopC: "Third Lance's own maintenance bay. Empty until they come aboard.",
    // 2 Sep 2026 (Vault Build Plan v1) — describes the one thing you
    // actually DO here at the plinth; dedications resolve on their own.
    vault: "Walk to the plinth and press E for house offers, holdings, and standing.",
    berths: "Warden Company's bunks. Recruitment, romance, one-on-one scenes — not wired in yet.",
    berthsB: "Second Lance's bunks. Empty until they come aboard.",
    berthsC: "Third Lance's bunks. Empty until they come aboard.",
    heads: "Stalls, sinks, showers. Nothing to do here but the obvious.",
    engineering: "Generator, Fabricator, Restock — ask the CO to build one.",
    forwardBays: "Sensor Array, Weapons Bay, Beacon Control — ask the CO to build one.",
    cic: "Fire-support config, Energy allocation — not wired in yet.",
    sparRoom: "Where crew work things out with their fists, once there's a real reason to. Nothing wired in yet.",
  },

  // Room-to-deck assignment — a hand-authored split, the one in
  // engine/hubLayout.ts: crew spaces (Rec Room, Hangar Deck, the three
  // lance berths, Heads, Engineering) on the lower deck; operations (the
  // three workshops, Vault, CIC, the forward bays) on the upper deck.
  // sparRoom, 28 Aug 2026 — same "deck named after its one room" pattern
  // the grotto already established.
  roomDeck: {
    recroom: "lower",
    hangarDeck: "lower",
    berths: "lower",
    berthsB: "lower",
    berthsC: "lower",
    heads: "lower",
    engineering: "lower",
    lowerHall: "lower",
    grotto: "grotto",
    workshop: "upper",
    workshopB: "upper",
    workshopC: "upper",
    vault: "upper",
    cic: "upper",
    forwardBays: "upper",
    upperHall: "upper",
    sparRoom: "sparRoom",
  },

  // Rooms an idle NPC may pick as a destination, or spawn in. Everything
  // except the two corridors — a hallway is somewhere you walk THROUGH
  // (the pathfinder routes people along it constantly), not somewhere the
  // roster should decide to stand around in, and "spawned in the corridor"
  // would read as a bug to anyone loading a save. Same order as roomTitles
  // (it used to be derived from that table's keys).
  roamableRooms: ["recroom", "hangarDeck", "berths", "berthsB", "berthsC", "heads", "engineering", "workshop", "workshopB", "workshopC", "vault", "cic", "forwardBays", "grotto", "sparRoom"],

  // One berth per lance, 3 Sep 2026 (Maxime: "individual lance berth"),
  // mirroring the per-lance workshops. Sleep restores in ANY berth room (a
  // forgiving rule), but a sleepy NPC is BIASED toward their own lance's
  // room. Only a/b/c have rooms: this carrier is physically built with
  // three berth rooms and three workshops; a 4th lance falls back to 1st
  // Lance's room (facility.ts's buildFacilityTables) rather than crashing.
  lanceBerths: { a: "berths", b: "berthsB", c: "berthsC" },
  // Carrier Scale-Up Plan v1 Phase 2, 3 Sep 2026 — which workshop a given
  // lance's Meks live in. The lance itself is decided by campaignState.ts's
  // own lanceOfMek; this is just the room mapping.
  lanceWorkshops: { a: "workshop", b: "workshopB", c: "workshopC" },
  mekSpots: MEK_SPOTS,

  // The only press-E portals within the scene: the stairs between decks
  // (Antfarm Grid v0, 27 Aug 2026 — rooms sharing a deck are one continuous
  // open floor). 3 Sep 2026, floor-plan pass — every stair is positioned by
  // hubLayout.ts's STAIRS table (marker + far-side landing), checked
  // walkable by hubLayout.test.ts, and hosted in the room whose interior
  // the marker actually sits in (isAtDoor filters by exact room): the two
  // rectangular decks host theirs in the spine corridor, the grotto and the
  // spar deck in their one room. tools/verify/checkHubDoorReachability
  // walks every entry here live.
  doors: [
    { id: "recroom-to-grotto", room: "lowerHall", x: STAIRS.lowerToGrotto.x, y: STAIRS.lowerToGrotto.y, toRoom: "grotto", toX: STAIRS.grottoToLower.landing.x, toY: STAIRS.grottoToLower.landing.y, label: "THE GROTTO" },
    { id: "grotto-to-recroom", room: "grotto", x: STAIRS.grottoToLower.x, y: STAIRS.grottoToLower.y, toRoom: "lowerHall", toX: STAIRS.lowerToGrotto.landing.x, toY: STAIRS.lowerToGrotto.landing.y, label: "LOWER DECK" },
    { id: "grotto-to-workshop", room: "grotto", x: STAIRS.grottoToUpper.x, y: STAIRS.grottoToUpper.y, toRoom: "upperHall", toX: STAIRS.upperToGrotto.landing.x, toY: STAIRS.upperToGrotto.landing.y, label: "UPPER DECK" },
    { id: "workshop-to-grotto", room: "upperHall", x: STAIRS.upperToGrotto.x, y: STAIRS.upperToGrotto.y, toRoom: "grotto", toX: STAIRS.grottoToUpper.landing.x, toY: STAIRS.grottoToUpper.landing.y, label: "THE GROTTO" },
    { id: "recroom-to-sparRoom", room: "lowerHall", x: STAIRS.lowerToSpar.x, y: STAIRS.lowerToSpar.y, toRoom: "sparRoom", toX: STAIRS.sparToLower.landing.x, toY: STAIRS.sparToLower.landing.y, label: "THE SPAR ROOM" },
    { id: "sparRoom-to-recroom", room: "sparRoom", x: STAIRS.sparToLower.x, y: STAIRS.sparToLower.y, toRoom: "lowerHall", toX: STAIRS.lowerToSpar.landing.x, toY: STAIRS.lowerToSpar.landing.y, label: "LOWER DECK" },
  ],

  // The two reserved bays per deck named in the hull proposal — Sensor
  // Array + Beacon Control on Upper, Generator + Restock Room on Lower
  // (Bloom_Wars_Antfarm_Carrier_Hub_v1.md §11.2's twelve-bay list), plus
  // weaponsBay/fabricator (28 Aug 2026). 3 Sep 2026, floor-plan pass — the
  // markers stand inside two real rooms, Engineering (lower deck) and the
  // Forward Bays (upper deck), at positions hubLayout.ts's BAY_MARKERS owns.
  // Sensor -> Weapons -> Beacon and Generator -> Fabricator -> Restock, top
  // to bottom.
  reservedBays: [
    { id: "sensorArray", deck: "upper", label: "SENSOR\nARRAY\n(reserved)", x: BAY_MARKERS.upper.x, y: BAY_MARKERS.upper.ys[0] },
    { id: "weaponsBay", deck: "upper", label: "WEAPONS\nBAY\n(reserved)", x: BAY_MARKERS.upper.x, y: BAY_MARKERS.upper.ys[1] },
    { id: "beaconControl", deck: "upper", label: "BEACON\nCONTROL\n(reserved)", x: BAY_MARKERS.upper.x, y: BAY_MARKERS.upper.ys[2] },
    { id: "generator", deck: "lower", label: "GENERATOR\n(reserved)", x: BAY_MARKERS.lower.x, y: BAY_MARKERS.lower.ys[0] },
    { id: "fabricator", deck: "lower", label: "FABRICATOR\n(reserved)", x: BAY_MARKERS.lower.x, y: BAY_MARKERS.lower.ys[1] },
    { id: "restockRoom", deck: "lower", label: "RESTOCK\nROOM\n(reserved)", x: BAY_MARKERS.lower.x, y: BAY_MARKERS.lower.ys[2] },
  ],

  points: {
    muster: MUSTER_POINT,
    hangarShop: HANGAR_SHOP_POINT,
    crewRecords: CREW_RECORDS_POINT,
    recroomTable: RECROOM_TABLE_POINT,
    recroomBoard: RECROOM_BOARD_POINT,
    recroomSeats: RECROOM_SEATS,
    workshopBench: WORKSHOP_BENCH_POINT,
    vaultPlinth: VAULT_PLINTH_POINT,
    archiveTable: CIC_TABLE_POINT,
    co: CO_POINT,
    playerSpawn: PLAYER_SPAWN,
  },
  archiveRoom: "cic",
  spawnRoom: "recroom",

  // The Carrier CO — Antfarm Grid v0 stress-test follow-up, 27 Aug 2026.
  // Name locked in Bloom_Wars_Antfarm_Carrier_Hub_v1.md §11.3, 23 Aug 2026:
  // Arangement of Content. Species confirmed Carabil — a
  // ROMANCE_CAPPED_SPECIES entry (data/romance.ts), so his non-romanceable
  // status comes from the same isRomanceableSpecies() check every other
  // NPC uses, not a hand-set boolean. Own colour, not a PATH_COLORS pick —
  // muted brass reads as rank/command. Catalyst wolf (was bear; flipped 1
  // Sep 2026 once the roster doc §4.3 resolved his background to
  // Mid-Rim/Sheltered — Saturn/Wolf). Stage "command" rather than
  // tier-derived — he isn't on the tier-promotion track.
  co: {
    displayName: "Arangement of Content",
    color: 0xb08d4f,
    species: "carabil",
    catalyst: "wolf",
    stage: "command",
    room: "grotto",
    socialSeed: { favorability: 0, stress: 20, morale: 70 },
  },

  mc: {
    pilotId: "pilot_rourke",
    shortName: "Rourke",
    headerLabel: rourkeHeaderLabel,
  },

  // The three hand-authored Rec Room regulars (Bosk, Anand, Iyari — a real,
  // deliberate content choice), seated at the table on load with their own
  // starting favorability/stress/morale. data/npcSeed.ts's NPC_SEED is
  // still the source of truth for these rows (the headless social sim and
  // catalystForPilot read it too); this only maps them into the profile.
  regulars: NPC_SEED.map((s) => ({ pilotId: s.pilotId, catalyst: s.catalyst, favorability: s.favorability, stress: s.stress, morale: s.morale })),
  bondSeed: NPC_BOND_SEED,

  // Meks as walkable Hub NPCs — Mek NPC Introduction Plan v1, 29 Aug 2026.
  // First slice: the 5 Act I Meks, each in front of their own cradle along
  // the workshop's aft wall (3 Sep 2026, hubLayout.ts's MEK_SPOTS), with a
  // hand-picked catalyst — placeholders, chosen for voice variety, same
  // "not a locked content decision" caveat NPC_SEED carries. Every other
  // active pilot's Mek is placed by Hub.ts's generic loop in their own
  // lance's workshop.
  mekSeeds: [
    { mekId: "mek_rourke", pilotId: "pilot_rourke", catalyst: "raven", room: "workshop", spot: 0 },
    { mekId: "mek_bosk", pilotId: "pilot_bosk", catalyst: "bear", room: "workshop", spot: 1 },
    { mekId: "mek_iyari", pilotId: "pilot_iyari", catalyst: "fox", room: "workshop", spot: 2 },
    { mekId: "mek_anand", pilotId: "pilot_anand", catalyst: "dog", room: "workshop", spot: 3 },
    { mekId: "mek_lask", pilotId: "pilot_lask", catalyst: "rabbit", room: "workshop", spot: 4 },
  ],
  // Mek scope decision follow-through, 1 Sep 2026 — hand-picked catalysts
  // for the other ten pilots' Meks, so they don't fall through to
  // catalystForPilot()'s deterministic hash. Picked for "ease of
  // familiarisation and friendliness between pilot and Mek" (Maxime),
  // re-checked against CATALYST_CLASH_PAIRS: mek_solheim was "shark"
  // against pilot_solheim's "rabbit" (a clash pair) — swapped to "dog".
  // Vashti/Yeun share Lask's "rabbit" (a healer-adjacent thread); Okafor's
  // echoes Bosk's "bear"; Tarrant's echoes Iyari's "crow".
  mekCatalysts: {
    mek_okafor: "bear",
    mek_solheim: "dog",
    mek_tarrant: "crow",
    mek_vashti: "rabbit",
    mek_reyes: "cat",
    mek_kova: "wolf",
    mek_ness: "bear",
    mek_onwuka: "crow",
    mek_delgado: "fox",
    mek_yeun: "rabbit",
  },

  missionsById: AMARANTH_MISSIONS_BY_ID,
  nextMission: nextWardenMission,
  createCampaignState: () => createWardenCampaignState(),
};
