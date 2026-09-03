import { describe, expect, it } from "vitest";
import {
  DECK_LAYOUTS,
  STAIRS,
  MEK_SPOTS,
  RECROOM_SEATS,
  MUSTER_POINT,
  HANGAR_SHOP_POINT,
  WORKSHOP_BENCH_POINT,
  VAULT_PLINTH_POINT,
  CO_POINT,
  BAY_MARKERS,
  WALL_T,
  resolveAgainstSolids,
  roomAt,
  roomCenter,
  type DeckId,
  type RoomId,
} from "../hubLayout";
import { findPath, isWalkable, reachableCellCount } from "../hubNav";

const NPC_R = 16;
const PLAYER_R = 15;
const DECKS = Object.keys(DECK_LAYOUTS) as DeckId[];

// A corridor-facing point just inside each room's door, for reachability.
function roomsOf(deck: DeckId): RoomId[] {
  return Object.keys(DECK_LAYOUTS[deck].rooms) as RoomId[];
}

describe("hubLayout — geometry sanity", () => {
  it("every room interior sits inside its deck's bounds", () => {
    for (const deck of DECKS) {
      const b = DECK_LAYOUTS[deck].bounds;
      for (const id of roomsOf(deck)) {
        const r = DECK_LAYOUTS[deck].rooms[id]!;
        expect(r.left, `${deck}/${id}`).toBeGreaterThanOrEqual(b.left);
        expect(r.top, `${deck}/${id}`).toBeGreaterThanOrEqual(b.top);
        expect(r.right, `${deck}/${id}`).toBeLessThanOrEqual(b.right);
        expect(r.bottom, `${deck}/${id}`).toBeLessThanOrEqual(b.bottom);
        expect(r.right - r.left).toBeGreaterThan(4 * NPC_R);
        expect(r.bottom - r.top).toBeGreaterThan(4 * NPC_R);
      }
    }
  });

  it("room interiors on a deck never overlap", () => {
    for (const deck of DECKS) {
      const ids = roomsOf(deck);
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const a = DECK_LAYOUTS[deck].rooms[ids[i]]!;
          const b = DECK_LAYOUTS[deck].rooms[ids[j]]!;
          const overlap = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
          expect(overlap, `${deck}: ${ids[i]} overlaps ${ids[j]}`).toBe(false);
        }
      }
    }
  });

  it("every wall band is exactly WALL_T thick on one axis", () => {
    for (const deck of DECKS) {
      for (const w of DECK_LAYOUTS[deck].walls) {
        const thick = Math.min(w.right - w.left, w.bottom - w.top);
        expect(thick).toBe(WALL_T);
      }
    }
  });

  it("every doorway is wide enough for two bodies to pass", () => {
    for (const deck of DECKS) {
      for (const d of DECK_LAYOUTS[deck].doorways) {
        const span = d.side === "top" || d.side === "bottom" ? d.rect.right - d.rect.left : d.rect.bottom - d.rect.top;
        expect(span, `${deck} doorway`).toBeGreaterThanOrEqual(4 * NPC_R + 8);
      }
    }
  });

  it("roomAt resolves a doorway to a real room, never throws", () => {
    for (const deck of DECKS) {
      for (const d of DECK_LAYOUTS[deck].doorways) {
        const x = (d.rect.left + d.rect.right) / 2;
        const y = (d.rect.top + d.rect.bottom) / 2;
        expect(roomsOf(deck)).toContain(roomAt(deck, x, y));
      }
    }
  });
});

describe("hubLayout — landmarks stand on free floor", () => {
  const landmarks: { deck: DeckId; x: number; y: number; r: number; name: string }[] = [
    { deck: "lower", ...MUSTER_POINT, r: NPC_R, name: "muster" },
    { deck: "lower", ...HANGAR_SHOP_POINT, r: PLAYER_R, name: "hangar terminal" },
    { deck: "upper", ...WORKSHOP_BENCH_POINT, r: PLAYER_R, name: "workshop bench" },
    { deck: "upper", ...VAULT_PLINTH_POINT, r: PLAYER_R, name: "vault plinth" },
    { deck: "grotto", ...CO_POINT, r: NPC_R, name: "CO" },
    ...RECROOM_SEATS.map((s, i) => ({ deck: "lower" as DeckId, ...s, r: NPC_R, name: `seat ${i}` })),
    ...(Object.keys(MEK_SPOTS) as (keyof typeof MEK_SPOTS)[]).flatMap((room) => MEK_SPOTS[room].map((s, i) => ({ deck: "upper" as DeckId, ...s, r: NPC_R, name: `${room} mek ${i}` }))),
    ...BAY_MARKERS.lower.ys.map((y) => ({ deck: "lower" as DeckId, x: BAY_MARKERS.lower.x, y, r: PLAYER_R, name: "lower bay marker" })),
    ...BAY_MARKERS.upper.ys.map((y) => ({ deck: "upper" as DeckId, x: BAY_MARKERS.upper.x, y, r: PLAYER_R, name: "upper bay marker" })),
  ];
  for (const l of landmarks) {
    it(`${l.name} on ${l.deck} at (${l.x},${l.y}) is walkable`, () => {
      expect(isWalkable(l.deck, l.x, l.y, l.r)).toBe(true);
      const fixed = resolveAgainstSolids(l.deck, l.x, l.y, l.r);
      expect(fixed.x).toBeCloseTo(l.x, 3);
      expect(fixed.y).toBeCloseTo(l.y, 3);
    });
  }

  it("the three Rec Room seats are in the Rec Room and the Mek spots in their workshop", () => {
    for (const s of RECROOM_SEATS) expect(roomAt("lower", s.x, s.y)).toBe("recroom");
    for (const room of Object.keys(MEK_SPOTS) as (keyof typeof MEK_SPOTS)[]) {
      for (const s of MEK_SPOTS[room]) expect(roomAt("upper", s.x, s.y)).toBe(room);
    }
    expect(roomAt("lower", MUSTER_POINT.x, MUSTER_POINT.y)).toBe("hangarDeck");
    expect(roomAt("lower", HANGAR_SHOP_POINT.x, HANGAR_SHOP_POINT.y)).toBe("hangarDeck");
    expect(roomAt("upper", WORKSHOP_BENCH_POINT.x, WORKSHOP_BENCH_POINT.y)).toBe("workshop");
    expect(roomAt("upper", VAULT_PLINTH_POINT.x, VAULT_PLINTH_POINT.y)).toBe("vault");
  });
});

describe("hubLayout — stairs", () => {
  const stairDecks: Record<keyof typeof STAIRS, DeckId> = {
    lowerToGrotto: "lower",
    lowerToSpar: "lower",
    grottoToLower: "grotto",
    grottoToUpper: "grotto",
    upperToGrotto: "upper",
    sparToLower: "spar" as DeckId,
  };
  stairDecks.sparToLower = "sparRoom";
  for (const key of Object.keys(STAIRS) as (keyof typeof STAIRS)[]) {
    const s = STAIRS[key];
    const deck = stairDecks[key];
    it(`${key}: marker and landing are walkable on ${deck}`, () => {
      expect(isWalkable(deck, s.x, s.y, PLAYER_R)).toBe(true);
      expect(isWalkable(deck, s.landing.x, s.landing.y, PLAYER_R)).toBe(true);
      expect(isWalkable(deck, s.landing.x, s.landing.y, NPC_R)).toBe(true);
    });
  }
  it("stairs hosted in a corridor resolve to that corridor room", () => {
    expect(roomAt("lower", STAIRS.lowerToGrotto.x, STAIRS.lowerToGrotto.y)).toBe("lowerHall");
    expect(roomAt("lower", STAIRS.lowerToSpar.x, STAIRS.lowerToSpar.y)).toBe("lowerHall");
    expect(roomAt("upper", STAIRS.upperToGrotto.x, STAIRS.upperToGrotto.y)).toBe("upperHall");
  });
});

describe("hubNav — every room is reachable from every other room on its deck", () => {
  for (const deck of DECKS) {
    const ids = roomsOf(deck);
    for (const a of ids) {
      for (const b of ids) {
        if (a === b) continue;
        it(`${deck}: ${a} -> ${b}`, () => {
          const from = roomCenter(a, deck);
          const to = roomCenter(b, deck);
          // Centres can sit on furniture; push them off first the way a
          // real spawn does.
          const f = resolveAgainstSolids(deck, from.x, from.y, NPC_R);
          const t = resolveAgainstSolids(deck, to.x, to.y, NPC_R);
          const path = findPath(deck, f.x, f.y, t.x, t.y, NPC_R);
          expect(path, `no route ${a} -> ${b}`).not.toBeNull();
        });
      }
    }
  }

  it("paths between rooms on a walled deck actually pass through a doorway", () => {
    const from = resolveAgainstSolids("lower", ...Object.values(roomCenter("berths", "lower")) as [number, number], NPC_R);
    const to = resolveAgainstSolids("lower", ...Object.values(roomCenter("hangarDeck", "lower")) as [number, number], NPC_R);
    const path = findPath("lower", from.x, from.y, to.x, to.y, NPC_R)!;
    expect(path.length).toBeGreaterThan(1);
    // Every waypoint stands on free floor.
    for (const p of path) expect(isWalkable("lower", p.x, p.y, NPC_R)).toBe(true);
    // Some waypoint lies in the corridor.
    expect(path.some((p) => roomAt("lower", p.x, p.y) === "lowerHall")).toBe(true);
  });

  it("no room on any deck is an island (one connected component of floor)", () => {
    for (const deck of DECKS) {
      const ids = roomsOf(deck);
      const c0 = resolveAgainstSolids(deck, ...Object.values(roomCenter(ids[0], deck)) as [number, number], NPC_R);
      const total = reachableCellCount(deck, c0.x, c0.y, NPC_R);
      for (const id of ids) {
        const c = resolveAgainstSolids(deck, ...Object.values(roomCenter(id, deck)) as [number, number], NPC_R);
        expect(reachableCellCount(deck, c.x, c.y, NPC_R), `${deck}/${id}`).toBe(total);
      }
    }
  });

  it("a straight shot with nothing in the way returns an empty path", () => {
    const path = findPath("sparRoom", 400, 200, 500, 200, NPC_R);
    expect(path).toEqual([]);
  });
});

describe("resolveAgainstSolids", () => {
  it("leaves a free point alone", () => {
    const p = resolveAgainstSolids("lower", 800, 468, NPC_R);
    expect(p).toEqual({ x: 800, y: 468 });
  });
  it("pushes a point out of a wall to the near side", () => {
    // Just above the berths/corridor wall band (y=420), touching it.
    const p = resolveAgainstSolids("lower", 300, 420 - WALL_T / 2 - 4, NPC_R);
    expect(p.y).toBeCloseTo(420 - WALL_T / 2 - NPC_R, 3);
    expect(p.x).toBe(300);
  });
  it("pushes a point out of the round table", () => {
    const p = resolveAgainstSolids("lower", 300 + 10, 800, NPC_R);
    const d = Math.hypot(p.x - 300, p.y - 800);
    expect(d).toBeCloseTo(46 + NPC_R, 3);
  });
});

describe("hubLayout — no trap gaps", () => {
  // Two solids (or a solid and a wall) must either touch or leave a slot a
  // body can actually stand in. A 10-30px slot is a trap: resolveAgainst
  // Solids pushes a body out of one straight into the other and never
  // converges. The live roam check caught exactly this on 3 Sep 2026
  // (bunks 15px off a wall), so it's a rule now.
  const MIN_SLOT = 2 * NPC_R + 6;
  const TOUCH = 2;
  for (const deck of DECKS) {
    it(`${deck}: every gap between blocking shapes is 0 or >= ${MIN_SLOT}px`, () => {
      const layout = DECK_LAYOUTS[deck];
      const boxes: { name: string; r: { left: number; top: number; right: number; bottom: number } }[] = [];
      layout.walls.forEach((w, i) => boxes.push({ name: `wall${i}`, r: w }));
      layout.solids.forEach((s, i) => {
        if (s.kind === "rect") boxes.push({ name: `solid${i}`, r: s.rect });
        else boxes.push({ name: `circle${i}`, r: { left: s.x - s.r, top: s.y - s.r, right: s.x + s.r, bottom: s.y + s.r } });
      });
      const bad: string[] = [];
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i].r;
          const b = boxes[j].r;
          const xOverlap = a.left < b.right && b.left < a.right;
          const yOverlap = a.top < b.bottom && b.top < a.bottom;
          // The slot between the two, and whether some third shape (a wall
          // between two rooms, a middle sink in a row) already fills it —
          // then it isn't a slot at all.
          const covered = (x: number, y: number) => boxes.some((o, k) => k !== i && k !== j && x > o.r.left && x < o.r.right && y > o.r.top && y < o.r.bottom);
          if (xOverlap && !yOverlap) {
            const gap = Math.max(a.top - b.bottom, b.top - a.bottom);
            const cx = (Math.max(a.left, b.left) + Math.min(a.right, b.right)) / 2;
            const cy = (Math.min(a.bottom, b.bottom) + Math.max(a.top, b.top)) / 2;
            if (gap > TOUCH && gap < MIN_SLOT && !covered(cx, cy)) bad.push(`${boxes[i].name}/${boxes[j].name} y-gap ${gap} at (${cx},${cy})`);
          } else if (yOverlap && !xOverlap) {
            const gap = Math.max(a.left - b.right, b.left - a.right);
            const cx = (Math.min(a.right, b.right) + Math.max(a.left, b.left)) / 2;
            const cy = (Math.max(a.top, b.top) + Math.min(a.bottom, b.bottom)) / 2;
            if (gap > TOUCH && gap < MIN_SLOT && !covered(cx, cy)) bad.push(`${boxes[i].name}/${boxes[j].name} x-gap ${gap} at (${cx},${cy})`);
          }
        }
      }
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
});
