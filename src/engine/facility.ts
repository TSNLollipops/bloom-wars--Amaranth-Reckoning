// engine/facility.ts — what makes one hub building different from another,
// as DATA. 6 Sep 2026, House Amaranth Hub build, step 1 of
// claude/Bloom_Wars_House_Amaranth_Hub_Build_Plan_v1.md (§1, "Option B —
// one Hub, two facilities"). Maxime's call on the architecture question was
// "your call, this is a dev answer"; this is that answer.
//
// Before this file, scenes/Hub.ts reached for Warden's numbers directly —
// `import { CO_POINT, MUSTER_POINT, ... } from "../engine/hubLayout"`, a
// module-level ROOM_DECK table with "lower"/"grotto"/"upper" written into
// it, WARDEN_PILOTS.find(...) for the player's own record, a hand-built CO
// named Arangement of Content. Plain-language version: the recipe said "use
// the oven in MY kitchen." A FacilityProfile is the kitchen, handed to the
// scene when it's constructed (main.ts: `new Hub(WARDEN_FACILITY)`,
// `new Hub(HOUSE_AMARANTH_FACILITY)`), so the same 10,000-line recipe runs
// in either building. Warden's profile (facilityWarden.ts) is exactly the
// constants Hub.ts used to hold, moved; House Amaranth's
// (facilityHouseAmaranth.ts) is new.
//
// Two layers on purpose:
// - FacilityProfile is plain, author-friendly data: partial tables keyed by
//   the rooms/decks THIS building actually has, points, the CO, the MC,
//   the seeds. Nothing derived, nothing that needs the layouts loaded.
// - FacilityTables (buildFacilityTables) is what Hub.ts actually reads:
//   TOTAL accessors (`roomDeck(room)` returns a DeckId or throws, never
//   `undefined`) so the ~200 call sites that used to index a
//   `Record<RoomId, DeckId>` keep their types, plus the arrays that used to
//   be module-level constants (roamableRooms, doors, reservedBays). Built
//   once per scene instance in Hub's constructor.
//
// Phaser-free, so a test can build both profiles and check them against
// the layouts (facility.test.ts): every room the profile names exists on
// the deck it claims, every landmark stands on free floor, every stair has
// a partner going back.

import type { DeckId, RoomId, Rect } from "./hubLayoutKit";
import { DECK_LAYOUTS } from "./hubLayout";
import type { CampaignState, LanceId, ReservedBayId } from "./campaignState";
import type { Catalyst, Stage } from "../data/ambientLines";
import type { CampaignMission, Species } from "../data/types";

export interface Point {
  x: number;
  y: number;
}

// A press-E portal between decks — structurally a door whose toRoom sits on
// a different deck (Hub.ts's own framing, since the 27 Aug 2026 Antfarm
// Grid pass made every same-deck room one open floor). Lived in Hub.ts as
// a scene-local type until the facility split; same shape, same fields.
export interface DoorDef {
  id: string;
  room: RoomId; // which room this door's trigger point sits in
  x: number;
  y: number;
  toRoom: RoomId;
  toX: number; // where the player lands in toRoom
  toY: number;
  label: string; // shown in the interact prompt and on the door's own marker
}

// A reserved-bay marker: a buildable slot the CO can be asked to build out
// (Hub.ts's handleBuildRequest). Visual-only until built. Same six ids in
// both facilities (ReservedBayId is campaign-wide state); only WHERE they
// stand differs.
export interface ReservedBayDef {
  id: ReservedBayId;
  deck: DeckId;
  label: string;
  x: number;
  y: number;
}

// A hand-authored regular: seated at the game table on load, with a
// starting favorability/stress/morale a fresh save is seeded from. Same
// shape as data/npcSeed.ts's NPC_SEED rows (minus `drunk`, which Hub.ts
// derives from drunkUntil and never read off the seed).
export interface RegularSeed {
  pilotId: string;
  catalyst: Catalyst;
  favorability: number;
  stress: number;
  morale: number;
}

// A hand-placed Mek: which cradle (by room + index into that room's
// mekSpots) and which catalyst. Every other active pilot's Mek is placed
// by Hub.ts's generic loop in their own lance's workshop.
export interface MekSeed {
  mekId: string;
  pilotId: string;
  catalyst: Catalyst;
  room: RoomId;
  spot: number;
}

export interface FacilityCo {
  displayName: string;
  color: number;
  species: Species;
  catalyst: Catalyst;
  stage: Stage;
  room: RoomId;
  socialSeed: { favorability: number; stress: number; morale: number };
}

export interface FacilityMc {
  // The player's own pilot id — excluded from the walkable NPC cast,
  // owner of the header rank line, the standings YOU row, the rumor
  // "asker" name.
  pilotId: string;
  // Short name for the standings board and anywhere the crew refer to the
  // player by surname ("Rourke", "Marrow").
  shortName: string;
  // The top-left header line. Warden's builds it live from
  // CampaignState.rourkeRank; House Amaranth's is static until Marrow has a
  // rank field of her own (Build Plan §3, flagged).
  headerLabel(state: CampaignState): string;
}

export interface FacilityPoints {
  muster: Point;
  hangarShop: Point;
  crewRecords: Point;
  recroomTable: Point;
  recroomBoard: Point;
  recroomSeats: Point[];
  workshopBench: Point;
  vaultPlinth: Point;
  co: Point;
  playerSpawn: Point;
}

export interface FacilityProfile {
  // Phaser scene key. "Hub" is Warden's, unchanged, so every existing
  // scene.start("Hub") and verify script keeps working.
  sceneKey: string;
  // "THE ANTFARM" / "THE GREATHOUSE" — the title bar's left half.
  displayName: string;
  // "DECK" / "FLOOR" — the word before the deck title in the HUD.
  levelWord: string;
  // The company these pilots belong to, for the Vault's own copy.
  companyName: string;
  // The footer button back to the Campaign Shop scene.
  backButtonLabel: string;

  // The deck graph is a PATH, not a tree (Hub.ts's nextHopDoor walks it
  // one step at a time). Listed end to end.
  deckOrder: DeckId[];
  roomTitles: Partial<Record<RoomId, string>>;
  roomNotes: Partial<Record<RoomId, string>>;
  roomDeck: Partial<Record<RoomId, DeckId>>;
  // Rooms an idle NPC may pick as a destination, or spawn in — the
  // corridors are excluded by the profile author, not by name-matching.
  roamableRooms: RoomId[];
  lanceBerths: Partial<Record<LanceId, RoomId>>;
  lanceWorkshops: Partial<Record<LanceId, RoomId>>;
  mekSpots: Partial<Record<RoomId, Point[]>>;
  doors: DoorDef[];
  reservedBays: ReservedBayDef[];
  points: FacilityPoints;
  // The room the player first stands in on a fresh load.
  spawnRoom: RoomId;

  co: FacilityCo;
  mc: FacilityMc;
  regulars: RegularSeed[];
  bondSeed: Record<string, number>;
  mekSeeds: MekSeed[];
  mekCatalysts: Record<string, Catalyst>;

  missionsById: Record<string, CampaignMission>;
  nextMission(lastMissionEcho: { missionId: string } | undefined): CampaignMission | null;
  createCampaignState(): CampaignState;
}

export interface FacilityTables {
  readonly profile: FacilityProfile;
  readonly rooms: RoomId[];
  readonly roamableRooms: RoomId[];
  readonly deckOrder: DeckId[];
  readonly doors: DoorDef[];
  readonly reservedBays: ReservedBayDef[];
  readonly points: FacilityPoints;
  roomDeck(room: RoomId): DeckId;
  roomTitle(room: RoomId): string;
  roomNote(room: RoomId): string | undefined;
  // Every room's walkable interior, straight off the floor plan — what
  // Hub.ts's spawn picks, roam picks and room-note positions index.
  roomZone(room: RoomId): Rect;
  deckTitle(deck: DeckId): string;
  mekSpots(room: RoomId): Point[];
  berthRoomFor(lance: LanceId): RoomId;
  workshopRoomFor(lance: LanceId): RoomId;
}

export function buildFacilityTables(profile: FacilityProfile): FacilityTables {
  const rooms = Object.keys(profile.roomDeck) as RoomId[];
  const roomDeck = (room: RoomId): DeckId => {
    const deck = profile.roomDeck[room];
    if (!deck) throw new Error(`${profile.sceneKey}: room ${room} is not part of this facility`);
    return deck;
  };
  const zones: Partial<Record<RoomId, Rect>> = {};
  for (const room of rooms) {
    const rect = DECK_LAYOUTS[roomDeck(room)].rooms[room];
    if (!rect) throw new Error(`${profile.sceneKey}: hubLayout has no interior for room ${room} on deck ${roomDeck(room)}`);
    zones[room] = rect;
  }
  // The 1st-lance fallback rather than inventing rooms that don't exist:
  // LanceId carries five ids because Gladiator will need them, but neither
  // facility is built with more than three berth rooms / workshops, so a
  // 4th lance would "bunk with 1st Lance", not crash (Hub.ts's own note).
  const firstBerth = profile.lanceBerths.a ?? "berths";
  const firstWorkshop = profile.lanceWorkshops.a ?? "workshop";
  return {
    profile,
    rooms,
    roamableRooms: profile.roamableRooms,
    deckOrder: profile.deckOrder,
    doors: profile.doors,
    reservedBays: profile.reservedBays,
    points: profile.points,
    roomDeck,
    roomTitle: (room) => profile.roomTitles[room] ?? room,
    roomNote: (room) => profile.roomNotes[room],
    roomZone: (room) => {
      const z = zones[room];
      if (!z) throw new Error(`${profile.sceneKey}: no zone for room ${room}`);
      return z;
    },
    // One source: the layout's own title, not a second table to keep in
    // step with it.
    deckTitle: (deck) => DECK_LAYOUTS[deck].title,
    mekSpots: (room) => profile.mekSpots[room] ?? [],
    berthRoomFor: (lance) => profile.lanceBerths[lance] ?? firstBerth,
    workshopRoomFor: (lance) => profile.lanceWorkshops[lance] ?? firstWorkshop,
  };
}
