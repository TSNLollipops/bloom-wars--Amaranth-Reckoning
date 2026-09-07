// engine/facility.test.ts — 6 Sep 2026, House Amaranth Hub build. Checks
// both facility profiles against the layouts they claim to describe, so a
// room renamed in one file and not the other, a stair with no way back, or
// a landmark authored onto a piece of furniture fails here rather than in
// a playtest. Hub.ts itself can't be unit-tested (it imports Phaser at
// module scope) — this is the closest the suite can get to "does the
// profile fit the building."
import { describe, expect, it } from "vitest";
import { buildFacilityTables, type FacilityProfile } from "../facility";
import { WARDEN_FACILITY } from "../facilityWarden";
import { HOUSE_AMARANTH_FACILITY } from "../facilityHouseAmaranth";
import { DECK_LAYOUTS, resolveAgainstSolids, roomAt, type DeckId, type RoomId } from "../hubLayout";
import { isWalkable } from "../hubNav";
import { baseSceneKeyFor, createHouseAmaranthCampaignState, createWardenCampaignState } from "../campaignState";

const NPC_R = 16;
const PLAYER_R = 15;

const PROFILES: FacilityProfile[] = [WARDEN_FACILITY, HOUSE_AMARANTH_FACILITY];

function standsFree(deck: DeckId, p: { x: number; y: number }, r: number): boolean {
  if (!isWalkable(deck, p.x, p.y, r)) return false;
  const fixed = resolveAgainstSolids(deck, p.x, p.y, r);
  return Math.abs(fixed.x - p.x) < 1e-3 && Math.abs(fixed.y - p.y) < 1e-3;
}

for (const profile of PROFILES) {
  describe(`facility ${profile.sceneKey} — rooms and decks`, () => {
    const f = buildFacilityTables(profile);

    it("builds without throwing (every room's interior exists on its deck)", () => {
      expect(f.rooms.length).toBeGreaterThan(0);
    });

    it("every deck in deckOrder is a real layout, and every room on those decks is in the profile", () => {
      for (const deck of profile.deckOrder) {
        const layout = DECK_LAYOUTS[deck];
        expect(layout, `deck ${deck}`).toBeDefined();
        for (const room of Object.keys(layout.rooms) as RoomId[]) {
          expect(profile.roomDeck[room], `${deck}/${room} has no roomDeck entry`).toBe(deck);
          expect(profile.roomTitles[room], `${deck}/${room} has no title`).toBeTruthy();
        }
      }
    });

    it("every profile room sits on a deck in deckOrder", () => {
      for (const room of f.rooms) expect(profile.deckOrder).toContain(f.roomDeck(room));
    });

    it("roamable rooms are real rooms and never a corridor", () => {
      for (const room of profile.roamableRooms) {
        const deck = f.roomDeck(room);
        expect(DECK_LAYOUTS[deck].corridor, `${room} is ${deck}'s corridor`).not.toBe(room);
      }
      // ...and every non-corridor room IS roamable, so no room is silently
      // unreachable by the roster.
      for (const room of f.rooms) {
        if (DECK_LAYOUTS[f.roomDeck(room)].corridor === room) continue;
        expect(profile.roamableRooms, `${room} is not roamable`).toContain(room);
      }
    });

    it("every room with no mechanic still has a note, so an empty room reads as unbuilt, not broken", () => {
      for (const room of f.rooms) {
        const corridor = DECK_LAYOUTS[f.roomDeck(room)].corridor === room;
        if (corridor || room === profile.spawnRoom || room === profile.co.room) continue;
        expect(f.roomNote(room), `${room} has no room note`).toBeTruthy();
      }
    });

    it("lance berths and workshops name real rooms", () => {
      for (const room of [...Object.values(profile.lanceBerths), ...Object.values(profile.lanceWorkshops)]) {
        expect(f.rooms).toContain(room);
      }
      expect(f.berthRoomFor("a")).toBe(profile.lanceBerths.a);
      expect(f.workshopRoomFor("d")).toBe(profile.lanceWorkshops.a); // 4th lance falls back to 1st Lance's room
    });

    it("the deck title comes from the layout itself", () => {
      for (const deck of profile.deckOrder) expect(f.deckTitle(deck)).toBe(DECK_LAYOUTS[deck].title);
    });
  });

  describe(`facility ${profile.sceneKey} — stairs`, () => {
    const f = buildFacilityTables(profile);

    it("every door hops exactly one step along deckOrder", () => {
      for (const d of profile.doors) {
        const from = profile.deckOrder.indexOf(f.roomDeck(d.room));
        const to = profile.deckOrder.indexOf(f.roomDeck(d.toRoom));
        expect(from, d.id).toBeGreaterThanOrEqual(0);
        expect(to, d.id).toBeGreaterThanOrEqual(0);
        expect(Math.abs(from - to), `${d.id} skips a deck`).toBe(1);
      }
    });

    it("every door has a partner going back", () => {
      for (const d of profile.doors) {
        const back = profile.doors.find((o) => f.roomDeck(o.room) === f.roomDeck(d.toRoom) && f.roomDeck(o.toRoom) === f.roomDeck(d.room));
        expect(back, `${d.id} has no return stair`).toBeDefined();
      }
    });

    it("every adjacent pair of decks is joined by a door", () => {
      for (let i = 0; i + 1 < profile.deckOrder.length; i++) {
        const a = profile.deckOrder[i];
        const b = profile.deckOrder[i + 1];
        expect(profile.doors.some((d) => f.roomDeck(d.room) === a && f.roomDeck(d.toRoom) === b), `${a} -> ${b}`).toBe(true);
      }
    });

    it("every marker sits in the room it claims and every marker/landing is walkable", () => {
      for (const d of profile.doors) {
        const deck = f.roomDeck(d.room);
        expect(roomAt(deck, d.x, d.y), `${d.id} marker room`).toBe(d.room);
        expect(standsFree(deck, { x: d.x, y: d.y }, PLAYER_R), `${d.id} marker`).toBe(true);
        const toDeck = f.roomDeck(d.toRoom);
        expect(roomAt(toDeck, d.toX, d.toY), `${d.id} landing room`).toBe(d.toRoom);
        expect(standsFree(toDeck, { x: d.toX, y: d.toY }, NPC_R), `${d.id} landing`).toBe(true);
      }
    });
  });

  describe(`facility ${profile.sceneKey} — landmarks stand on free floor, in the right room`, () => {
    const f = buildFacilityTables(profile);
    const p = profile.points;
    const cases: { name: string; room: RoomId; pt: { x: number; y: number }; r: number }[] = [
      { name: "muster", room: "hangarDeck", pt: p.muster, r: NPC_R },
      { name: "roster console", room: "hangarDeck", pt: p.hangarShop, r: PLAYER_R },
      { name: "crew records", room: "hangarDeck", pt: p.crewRecords, r: PLAYER_R },
      { name: "standings board", room: profile.spawnRoom, pt: p.recroomBoard, r: PLAYER_R },
      { name: "workshop bench", room: profile.lanceWorkshops.a ?? "workshop", pt: p.workshopBench, r: PLAYER_R },
      { name: "vault plinth", room: "vault", pt: p.vaultPlinth, r: PLAYER_R },
      { name: "CO", room: profile.co.room, pt: p.co, r: NPC_R },
      { name: "player spawn", room: profile.spawnRoom, pt: p.playerSpawn, r: PLAYER_R },
      ...p.recroomSeats.map((s, i) => ({ name: `seat ${i}`, room: profile.spawnRoom, pt: s, r: NPC_R })),
    ];
    for (const c of cases) {
      it(`${c.name} at (${c.pt.x},${c.pt.y}) is free floor in ${c.room}`, () => {
        const deck = f.roomDeck(c.room);
        expect(roomAt(deck, c.pt.x, c.pt.y)).toBe(c.room);
        expect(standsFree(deck, c.pt, c.r)).toBe(true);
      });
    }

    it("the game table is a real solid in the spawn room (bodies gather around it, not on it)", () => {
      const deck = f.roomDeck(profile.spawnRoom);
      expect(roomAt(deck, p.recroomTable.x, p.recroomTable.y)).toBe(profile.spawnRoom);
      expect(isWalkable(deck, p.recroomTable.x, p.recroomTable.y, NPC_R)).toBe(false);
    });

    it("every lance workshop has five Mek cradles, each free floor inside that workshop", () => {
      for (const room of Object.values(profile.lanceWorkshops)) {
        const spots = f.mekSpots(room);
        expect(spots.length, room).toBe(5);
        for (const s of spots) {
          expect(roomAt(f.roomDeck(room), s.x, s.y)).toBe(room);
          expect(standsFree(f.roomDeck(room), s, NPC_R)).toBe(true);
        }
      }
    });

    it("all six reserved bays stand on free floor on a deck of this facility", () => {
      const ids = profile.reservedBays.map((b) => b.id).sort();
      expect(ids).toEqual(["beaconControl", "fabricator", "generator", "restockRoom", "sensorArray", "weaponsBay"]);
      for (const b of profile.reservedBays) {
        expect(profile.deckOrder).toContain(b.deck);
        expect(standsFree(b.deck, b, PLAYER_R), b.id).toBe(true);
      }
    });
  });

  describe(`facility ${profile.sceneKey} — people`, () => {
    const f = buildFacilityTables(profile);
    const state = profile.createCampaignState();

    it("the MC is a pilot of this campaign and the save routes to this scene", () => {
      expect(state.pilots[profile.mc.pilotId], profile.mc.pilotId).toBeDefined();
      expect(baseSceneKeyFor(state)).toBe(profile.sceneKey);
      expect(profile.mc.headerLabel(state)).toBeTruthy();
    });

    it("every seated regular is a pilot of this campaign, with a seat to sit in", () => {
      expect(profile.regulars.length).toBeLessThanOrEqual(profile.points.recroomSeats.length);
      for (const r of profile.regulars) {
        expect(state.pilots[r.pilotId], r.pilotId).toBeDefined();
        expect(r.pilotId).not.toBe(profile.mc.pilotId);
      }
    });

    it("every hand-placed Mek names a real pilot and a real cradle", () => {
      for (const m of profile.mekSeeds) {
        expect(state.pilots[m.pilotId], m.pilotId).toBeDefined();
        expect(state.meks[m.mekId], m.mekId).toBeDefined();
        expect(f.mekSpots(m.room)[m.spot], `${m.mekId} cradle ${m.spot} in ${m.room}`).toBeDefined();
      }
      const spots = profile.mekSeeds.map((m) => `${m.room}:${m.spot}`);
      expect(new Set(spots).size, "two Meks share a cradle").toBe(spots.length);
    });

    it("the CO stands in a room of this facility", () => {
      expect(f.rooms).toContain(profile.co.room);
    });

    it("nextMission starts at this campaign's first mission and every mission id resolves", () => {
      const first = profile.nextMission(undefined);
      expect(first).not.toBeNull();
      expect(profile.missionsById[first!.id]).toBe(first);
    });
  });
}

describe("the two facilities", () => {
  it("have distinct scene keys, display names and MCs", () => {
    expect(WARDEN_FACILITY.sceneKey).not.toBe(HOUSE_AMARANTH_FACILITY.sceneKey);
    expect(WARDEN_FACILITY.displayName).not.toBe(HOUSE_AMARANTH_FACILITY.displayName);
    expect(WARDEN_FACILITY.mc.pilotId).not.toBe(HOUSE_AMARANTH_FACILITY.mc.pilotId);
  });

  it("share no decks, so DECK_LAYOUTS can hold both without a collision", () => {
    for (const d of WARDEN_FACILITY.deckOrder) expect(HOUSE_AMARANTH_FACILITY.deckOrder).not.toContain(d);
  });

  it("route each side's save to its own hub, and a save with neither MC to the Campaign Shop", () => {
    expect(baseSceneKeyFor(createWardenCampaignState())).toBe("Hub");
    expect(baseSceneKeyFor(createHouseAmaranthCampaignState())).toBe("HubHouseAmaranth");
    const orphan = createWardenCampaignState();
    delete orphan.pilots["pilot_rourke"];
    expect(baseSceneKeyFor(orphan)).toBe("Hangar");
  });

  it("Warden's header line is the live rank plus the static name/callsign, exactly as before the split", () => {
    const state = createWardenCampaignState();
    expect(WARDEN_FACILITY.mc.headerLabel(state)).toMatch(/^2nd Lt\. Dessa Rourke/);
    state.rourkeRank = "maj";
    expect(WARDEN_FACILITY.mc.headerLabel(state)).toMatch(/^Maj\. Dessa Rourke/);
  });
});
