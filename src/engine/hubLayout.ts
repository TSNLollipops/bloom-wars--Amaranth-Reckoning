// The Antfarm's floor plan — 3 Sep 2026. Maxime: "lets give it corridor
// and walls now. delimiting the rooms and placing them aestetically
// pleasing way... make me a good looking and practical spaceship interior.
// the ant can roam and everything."
//
// This is the whole ship as DATA: per deck, its outer floor, every room's
// interior, every wall segment, every doorway, every piece of furniture
// that blocks a body, and every purely-visual detail. Hub.ts reads it to
// draw the decks and to clamp movement; engine/hubNav.ts reads it to build
// the navigation grid NPCs path through. Nothing in here imports Phaser,
// for the same reason hubGeometry.ts doesn't: Hub.ts can't be unit-tested
// (it imports "phaser" at module scope, which throws outside a browser),
// so every number that could strand an NPC behind a wall lives here where
// hubLayout.test.ts can actually walk it.
//
// Conventions, so the numbers below read without a diagram:
// - World coordinates, top-down. Top of a deck = bow (front of the ship).
// - Every deck has a "spine" corridor across its middle; rooms hang off
//   it forward (above) and aft (below). Stairs sit at the corridor ends.
// - A room is authored as its OUTER box; walls are WALL_T-thick bands
//   centred on the box's edges, so adjacent rooms share one wall. The
//   room's walkable interior is the box inset by WALL_T / 2.
// - Doorways are gaps cut out of a wall band, `w` wide, centred on `at`.
// - Furniture that blocks a body is a Solid (rect or circle) in
//   `solids`; the drawing of it is a separate Decor entry, so the
//   collision shape can stay simpler than the picture.
//
// This is a hand-authored, FIXED plan. The design docs
// (Bloom_Wars_Antfarm_Grid_v1.md §3d/§3e) still want a player-placed
// "build your ship" system eventually; nothing here forecloses that — a
// placement system would emit exactly this data structure instead of a
// human typing it — but that system is still paper, and this is the
// current shipped layout.

export type DeckId = "lower" | "grotto" | "upper" | "sparRoom";

export type RoomId =
  | "recroom"
  | "hangarDeck"
  | "berths"
  | "berthsB"
  | "berthsC"
  | "heads"
  | "engineering"
  | "lowerHall"
  | "grotto"
  | "workshop"
  | "workshopB"
  | "workshopC"
  | "vault"
  | "cic"
  | "forwardBays"
  | "upperHall"
  | "sparRoom";

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Ellipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export type Solid = { kind: "rect"; rect: Rect } | { kind: "circle"; x: number; y: number; r: number };

export type WallSide = "top" | "bottom" | "left" | "right";

export interface DoorGap {
  side: WallSide;
  at: number; // centre coordinate along the wall (x for top/bottom, y for left/right)
  w: number;
}

export interface Doorway {
  // The gap itself, as a rect covering the wall band it was cut from —
  // what the renderer draws a threshold + frame around.
  rect: Rect;
  side: WallSide;
}

export type Decor =
  | { kind: "rect"; x: number; y: number; w: number; h: number; fill: number; alpha?: number; stroke?: number; strokeAlpha?: number }
  | { kind: "circle"; x: number; y: number; r: number; fill: number; alpha?: number; stroke?: number; strokeAlpha?: number }
  | { kind: "ellipse"; x: number; y: number; rx: number; ry: number; fill: number; alpha?: number; stroke?: number; strokeAlpha?: number }
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number; color: number; width?: number; alpha?: number }
  | { kind: "label"; x: number; y: number; text: string; size?: number; color?: string; alpha?: number }
  | { kind: "stripes"; x: number; y: number; w: number; h: number; color: number; alpha?: number }
  | { kind: "dashrect"; x: number; y: number; w: number; h: number; color: number; alpha?: number };

export interface DeckLayout {
  id: DeckId;
  title: string;
  bounds: Rect; // outer floor / camera box
  ellipse?: Ellipse; // the grotto's real floor shape; movement clamps to this, not the box
  rooms: Partial<Record<RoomId, Rect>>; // walkable interiors
  walls: Rect[];
  doorways: Doorway[];
  solids: Solid[]; // furniture that blocks a body
  decor: Decor[];
  roomTint: Partial<Record<RoomId, number>>;
}

export const WALL_T = 14;

// Palette for the interior. Kept next to the geometry rather than in
// Hub.ts so a room's accent colour and its furniture agree without a
// round-trip through the scene file.
export const C = {
  floor: 0x151a1f,
  corridor: 0x1b2127,
  plating: 0x222a32,
  wall: 0x3b4551,
  wallLight: 0x5a6674,
  wallDark: 0x242b33,
  door: 0x2a3440,
  doorFrame: 0x8fd0ff,
  metal: 0x2f3a46,
  metalLight: 0x46535f,
  screen: 0x3aa0c8,
  amber: 0xd8a04a,
  hazard: 0xc9962f,
  bunk: 0x2a3442,
  pillow: 0x56687c,
  wood: 0x4a3b2c,
  woodLight: 0x6b5640,
  water: 0x1e3f52,
  waterLight: 0x2f6a84,
  soil: 0x2b2118,
  leaf: 0x3f8f4a,
  leafDark: 0x27602f,
  porcelain: 0x8f9aa6,
  mat: 0x3a2a2a,
  rope: 0xb8b0a0,
  label: "#6b7d8a",
  labelBright: "#8a97a6",
} as const;

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function inset(r: Rect, by: number): Rect {
  return { left: r.left + by, top: r.top + by, right: r.right - by, bottom: r.bottom - by };
}

function rectOf(x: number, y: number, w: number, h: number): Rect {
  return { left: x, top: y, right: x + w, bottom: y + h };
}

// One wall band (WALL_T thick, centred on a box edge) split around its
// doorways. Returns the solid segments and the gap rects.
function wallBand(side: WallSide, box: Rect, doors: DoorGap[]): { walls: Rect[]; doorways: Doorway[] } {
  const h = WALL_T / 2;
  const horizontal = side === "top" || side === "bottom";
  const fixed = side === "top" ? box.top : side === "bottom" ? box.bottom : side === "left" ? box.left : box.right;
  const from = horizontal ? box.left - h : box.top - h;
  const to = horizontal ? box.right + h : box.bottom + h;
  const gaps = doors
    .filter((d) => d.side === side)
    .map((d) => ({ a: d.at - d.w / 2, b: d.at + d.w / 2 }))
    .sort((p, q) => p.a - q.a);
  const walls: Rect[] = [];
  const doorways: Doorway[] = [];
  let cursor = from;
  const seg = (a: number, b: number): Rect => (horizontal ? { left: a, top: fixed - h, right: b, bottom: fixed + h } : { left: fixed - h, top: a, right: fixed + h, bottom: b });
  for (const g of gaps) {
    if (g.a > cursor) walls.push(seg(cursor, g.a));
    doorways.push({ rect: seg(g.a, g.b), side });
    cursor = g.b;
  }
  if (cursor < to) walls.push(seg(cursor, to));
  return { walls, doorways };
}

interface RoomSpec {
  id: RoomId;
  box: Rect;
  doors: DoorGap[];
  tint?: number;
}

function assembleRooms(specs: RoomSpec[]): { rooms: Partial<Record<RoomId, Rect>>; walls: Rect[]; doorways: Doorway[]; roomTint: Partial<Record<RoomId, number>> } {
  const rooms: Partial<Record<RoomId, Rect>> = {};
  const roomTint: Partial<Record<RoomId, number>> = {};
  const wallMap = new Map<string, Rect>();
  const doorways: Doorway[] = [];
  const doorwayKeys = new Set<string>();
  for (const s of specs) {
    rooms[s.id] = inset(s.box, WALL_T / 2);
    if (s.tint !== undefined) roomTint[s.id] = s.tint;
    for (const side of ["top", "bottom", "left", "right"] as WallSide[]) {
      const band = wallBand(side, s.box, s.doors);
      for (const w of band.walls) wallMap.set(`${w.left},${w.top},${w.right},${w.bottom}`, w);
      for (const d of band.doorways) {
        const k = `${d.rect.left},${d.rect.top},${d.rect.right},${d.rect.bottom}`;
        if (doorwayKeys.has(k)) continue;
        doorwayKeys.add(k);
        doorways.push(d);
      }
    }
  }
  // A doorway cut in one room's wall must also be cut from the neighbour's
  // copy of that same wall: adjacent rooms author the shared band twice,
  // and only one of them lists the door. Subtract every doorway from every
  // wall segment that overlaps it.
  const walls: Rect[] = [];
  for (const w of wallMap.values()) {
    let pieces: Rect[] = [w];
    for (const d of doorways) {
      const next: Rect[] = [];
      for (const p of pieces) next.push(...subtractRect(p, d.rect));
      pieces = next;
    }
    walls.push(...pieces);
  }
  return { rooms, walls, doorways, roomTint };
}

// Axis-aligned rect subtraction, only along the wall's own long axis
// (a doorway is always the full thickness of the band it's cut from).
function subtractRect(a: Rect, b: Rect): Rect[] {
  const overlapX = a.left < b.right && b.left < a.right;
  const overlapY = a.top < b.bottom && b.top < a.bottom;
  if (!overlapX || !overlapY) return [a];
  const out: Rect[] = [];
  const horizontal = a.right - a.left >= a.bottom - a.top;
  if (horizontal) {
    if (a.left < b.left) out.push({ ...a, right: b.left });
    if (b.right < a.right) out.push({ ...a, left: b.right });
  } else {
    if (a.top < b.top) out.push({ ...a, bottom: b.top });
    if (b.bottom < a.bottom) out.push({ ...a, top: b.bottom });
  }
  return out;
}

// --- furniture helpers: each returns decor and (optionally) the solid that
// blocks bodies. Keeping the picture and the collision shape together per
// piece means adding a bunk somewhere is one call, not two lists to sync.

interface Piece {
  decor: Decor[];
  solids: Solid[];
}

function bunk(x: number, y: number, horizontal = true): Piece {
  const w = horizontal ? 64 : 30;
  const h = horizontal ? 30 : 64;
  const pw = horizontal ? 14 : w - 6;
  const ph = horizontal ? h - 6 : 14;
  return {
    decor: [
      { kind: "rect", x, y, w, h, fill: C.bunk, stroke: C.metalLight, strokeAlpha: 0.6 },
      { kind: "rect", x: x + 3, y: y + 3, w: pw, h: ph, fill: C.pillow, alpha: 0.9 },
      { kind: "line", x1: horizontal ? x + 22 : x + 3, y1: horizontal ? y + 3 : y + 22, x2: horizontal ? x + w - 3 : x + w - 3, y2: horizontal ? y + 3 : y + 22, color: C.metalLight, alpha: 0.35 },
    ],
    solids: [{ kind: "rect", rect: rectOf(x, y, w, h) }],
  };
}

function lockerRow(x: number, y: number, count: number, vertical = false): Piece {
  const decor: Decor[] = [];
  const size = 24;
  for (let i = 0; i < count; i++) {
    const lx = vertical ? x : x + i * size;
    const ly = vertical ? y + i * size : y;
    decor.push({ kind: "rect", x: lx, y: ly, w: vertical ? 20 : size, h: vertical ? size : 20, fill: C.metal, stroke: C.metalLight, strokeAlpha: 0.5 });
    decor.push({ kind: "line", x1: lx + (vertical ? 4 : size / 2), y1: ly + (vertical ? size / 2 : 4), x2: lx + (vertical ? 12 : size / 2), y2: ly + (vertical ? size / 2 : 12), color: C.metalLight, alpha: 0.6 });
  }
  const w = vertical ? 20 : count * size;
  const h = vertical ? count * size : 20;
  return { decor, solids: [{ kind: "rect", rect: rectOf(x, y, w, h) }] };
}

function console(x: number, y: number, w = 56, h = 22): Piece {
  return {
    decor: [
      { kind: "rect", x, y, w, h, fill: C.metal, stroke: C.metalLight, strokeAlpha: 0.5 },
      { kind: "rect", x: x + 4, y: y + 4, w: w - 8, h: h - 10, fill: C.screen, alpha: 0.55 },
      { kind: "line", x1: x + 8, y1: y + h - 4, x2: x + w - 8, y2: y + h - 4, color: C.amber, alpha: 0.5 },
    ],
    solids: [{ kind: "rect", rect: rectOf(x, y, w, h) }],
  };
}

function chair(x: number, y: number): Piece {
  return { decor: [{ kind: "circle", x, y, r: 7, fill: C.metalLight, alpha: 0.7 }], solids: [] };
}

function roundTable(x: number, y: number, r: number): Piece {
  return {
    decor: [
      { kind: "circle", x, y, r, fill: C.wood, stroke: C.woodLight, strokeAlpha: 0.8 },
      { kind: "circle", x, y, r: r * 0.55, fill: C.woodLight, alpha: 0.25 },
    ],
    solids: [{ kind: "circle", x, y, r }],
  };
}

function boothTable(x: number, y: number): Piece {
  return {
    decor: [
      { kind: "rect", x, y, w: 40, h: 70, fill: C.wood, stroke: C.woodLight, strokeAlpha: 0.7 },
      { kind: "rect", x: x - 12, y: y + 4, w: 8, h: 62, fill: C.metal },
      { kind: "rect", x: x + 44, y: y + 4, w: 8, h: 62, fill: C.metal },
    ],
    solids: [{ kind: "rect", rect: rectOf(x - 12, y, 64, 70) }],
  };
}

function galleyCounter(x: number, y: number, w: number): Piece {
  const decor: Decor[] = [
    { kind: "rect", x, y, w, h: 34, fill: C.metal, stroke: C.metalLight, strokeAlpha: 0.6 },
    { kind: "line", x1: x + 6, y1: y + 6, x2: x + w - 6, y2: y + 6, color: C.metalLight, alpha: 0.5 },
    { kind: "label", x: x + w / 2, y: y + 20, text: "GALLEY", size: 9 },
  ];
  // burners
  for (let i = 0; i < 4; i++) decor.push({ kind: "circle", x: x + 30 + i * 22, y: y + 22, r: 6, fill: C.wallDark, stroke: C.metalLight, strokeAlpha: 0.7 });
  // serving hatch
  decor.push({ kind: "rect", x: x + w - 90, y: y + 10, w: 70, h: 14, fill: C.amber, alpha: 0.25, stroke: C.amber, strokeAlpha: 0.5 });
  return { decor, solids: [{ kind: "rect", rect: rectOf(x, y, w, 34) }] };
}

function vending(x: number, y: number): Piece {
  return {
    decor: [
      { kind: "rect", x, y, w: 30, h: 46, fill: C.metal, stroke: C.metalLight, strokeAlpha: 0.6 },
      { kind: "rect", x: x + 5, y: y + 5, w: 20, h: 26, fill: C.screen, alpha: 0.35 },
      { kind: "rect", x: x + 8, y: y + 36, w: 14, h: 5, fill: C.wallDark },
    ],
    solids: [{ kind: "rect", rect: rectOf(x, y, 30, 46) }],
  };
}

function mekCradle(x: number, y: number): Piece {
  // An open-fronted maintenance cradle: three walls of a box, hazard
  // ticks at the corners, an amber service light. The Mek stands in front.
  const w = 56;
  const h = 70;
  return {
    decor: [
      { kind: "rect", x, y, w, h, fill: C.wallDark, alpha: 0.9 },
      { kind: "rect", x, y, w, h: 6, fill: C.metal },
      { kind: "rect", x, y, w: 6, h, fill: C.metal },
      { kind: "rect", x: x + w - 6, y, w: 6, h, fill: C.metal },
      { kind: "line", x1: x + 10, y1: y + 14, x2: x + w - 10, y2: y + 14, color: C.metalLight, alpha: 0.6 },
      { kind: "line", x1: x + 10, y1: y + 26, x2: x + w - 10, y2: y + 26, color: C.metalLight, alpha: 0.4 },
      { kind: "circle", x: x + w / 2, y: y + 44, r: 9, fill: C.wall, stroke: C.amber, strokeAlpha: 0.7 },
      { kind: "circle", x: x + w / 2, y: y + 44, r: 3, fill: C.amber, alpha: 0.9 },
    ],
    solids: [{ kind: "rect", rect: rectOf(x, y, w, h) }],
  };
}

function workbench(x: number, y: number, w = 90, h = 28): Piece {
  return {
    decor: [
      { kind: "rect", x, y, w, h, fill: C.metal, stroke: C.metalLight, strokeAlpha: 0.6 },
      { kind: "rect", x: x + 6, y: y + 6, w: 18, h: 10, fill: C.amber, alpha: 0.5 },
      { kind: "rect", x: x + 30, y: y + 8, w: 24, h: 6, fill: C.metalLight, alpha: 0.6 },
      { kind: "circle", x: x + w - 14, y: y + h / 2, r: 5, fill: C.screen, alpha: 0.6 },
    ],
    solids: [{ kind: "rect", rect: rectOf(x, y, w, h) }],
  };
}

function toolChest(x: number, y: number): Piece {
  return {
    decor: [
      { kind: "rect", x, y, w: 26, h: 40, fill: C.metal, stroke: C.metalLight, strokeAlpha: 0.5 },
      { kind: "line", x1: x + 3, y1: y + 13, x2: x + 23, y2: y + 13, color: C.metalLight, alpha: 0.5 },
      { kind: "line", x1: x + 3, y1: y + 26, x2: x + 23, y2: y + 26, color: C.metalLight, alpha: 0.5 },
    ],
    solids: [{ kind: "rect", rect: rectOf(x, y, 26, 40) }],
  };
}

function stall(x: number, y: number): Piece {
  return {
    decor: [
      { kind: "rect", x, y, w: 40, h: 50, fill: C.floor, stroke: C.metalLight, strokeAlpha: 0.6 },
      { kind: "line", x1: x + 40, y1: y + 12, x2: x + 40, y2: y + 40, color: C.doorFrame, alpha: 0.4, width: 2 },
      { kind: "circle", x: x + 18, y: y + 20, r: 8, fill: C.porcelain, alpha: 0.85 },
      { kind: "rect", x: x + 11, y: y + 26, w: 14, h: 9, fill: C.porcelain, alpha: 0.7 },
    ],
    solids: [{ kind: "rect", rect: rectOf(x, y, 40, 50) }],
  };
}

function sink(x: number, y: number): Piece {
  return {
    decor: [
      { kind: "rect", x, y, w: 26, h: 22, fill: C.metal, stroke: C.metalLight, strokeAlpha: 0.5 },
      { kind: "circle", x: x + 13, y: y + 11, r: 6, fill: C.porcelain, alpha: 0.9 },
      { kind: "circle", x: x + 13, y: y + 11, r: 2, fill: C.water },
    ],
    solids: [{ kind: "rect", rect: rectOf(x, y, 26, 22) }],
  };
}

function shower(x: number, y: number): Piece {
  return {
    decor: [
      { kind: "dashrect", x, y, w: 46, h: 46, color: C.metalLight, alpha: 0.6 },
      { kind: "circle", x: x + 23, y: y + 23, r: 4, fill: C.wallDark, stroke: C.metalLight, strokeAlpha: 0.7 },
      { kind: "circle", x: x + 8, y: y + 8, r: 3, fill: C.waterLight, alpha: 0.6 },
    ],
    solids: [],
  };
}

function mechCradle(x: number, y: number): Piece {
  // The hangar's big cradles are for the MACHINES (mechs), not the Meks —
  // twice a mek cradle's size, hazard-striped apron in front.
  const w = 84;
  const h = 112;
  return {
    decor: [
      { kind: "rect", x, y, w, h, fill: C.wallDark, alpha: 0.9, stroke: C.metalLight, strokeAlpha: 0.5 },
      { kind: "line", x1: x + 8, y1: y + 8, x2: x + w - 8, y2: y + h - 8, color: C.metalLight, alpha: 0.25 },
      { kind: "line", x1: x + w - 8, y1: y + 8, x2: x + 8, y2: y + h - 8, color: C.metalLight, alpha: 0.25 },
      { kind: "rect", x: x + 6, y: y + 6, w: 10, h: 10, fill: C.amber, alpha: 0.6 },
      { kind: "rect", x: x + w - 16, y: y + 6, w: 10, h: 10, fill: C.amber, alpha: 0.6 },
      { kind: "rect", x: x + 6, y: y + h - 16, w: 10, h: 10, fill: C.amber, alpha: 0.6 },
      { kind: "rect", x: x + w - 16, y: y + h - 16, w: 10, h: 10, fill: C.amber, alpha: 0.6 },
      { kind: "rect", x: x + w / 2 - 18, y: y + h / 2 - 26, w: 36, h: 52, fill: C.metal, alpha: 0.8 },
    ],
    solids: [{ kind: "rect", rect: rectOf(x, y, w, h) }],
  };
}

function drum(x: number, y: number): Piece {
  return {
    decor: [
      { kind: "circle", x, y, r: 13, fill: C.metal, stroke: C.metalLight, strokeAlpha: 0.6 },
      { kind: "circle", x, y, r: 6, fill: C.hazard, alpha: 0.5 },
    ],
    solids: [{ kind: "circle", x, y, r: 13 }],
  };
}

function planter(x: number, y: number, r = 26): Piece {
  return {
    decor: [
      { kind: "circle", x, y, r, fill: C.soil, stroke: C.metalLight, strokeAlpha: 0.5 },
      { kind: "circle", x: x - r * 0.3, y: y - r * 0.2, r: r * 0.45, fill: C.leaf, alpha: 0.85 },
      { kind: "circle", x: x + r * 0.35, y: y + r * 0.1, r: r * 0.4, fill: C.leafDark, alpha: 0.9 },
      { kind: "circle", x: x + r * 0.05, y: y + r * 0.4, r: r * 0.3, fill: C.leaf, alpha: 0.7 },
    ],
    solids: [{ kind: "circle", x, y, r }],
  };
}

function bench(x: number, y: number, w: number, h: number): Piece {
  return {
    decor: [
      { kind: "rect", x, y, w, h, fill: C.wood, stroke: C.woodLight, strokeAlpha: 0.7 },
      { kind: "line", x1: x + 4, y1: y + h / 2, x2: x + w - 4, y2: y + h / 2, color: C.woodLight, alpha: 0.4 },
    ],
    solids: [{ kind: "rect", rect: rectOf(x, y, w, h) }],
  };
}

function ringPost(x: number, y: number): Piece {
  return { decor: [{ kind: "circle", x, y, r: 6, fill: C.metalLight, stroke: C.rope, strokeAlpha: 0.8 }], solids: [{ kind: "circle", x, y, r: 6 }] };
}

function heavyBag(x: number, y: number): Piece {
  return {
    decor: [
      { kind: "circle", x, y, r: 14, fill: C.mat, stroke: C.woodLight, strokeAlpha: 0.7 },
      { kind: "line", x1: x, y1: y - 14, x2: x, y2: y - 30, color: C.metalLight, alpha: 0.6 },
    ],
    solids: [{ kind: "circle", x, y, r: 14 }],
  };
}

function pipeRun(x1: number, y1: number, x2: number, y2: number): Piece {
  return {
    decor: [
      { kind: "line", x1, y1, x2, y2, color: C.metal, width: 6, alpha: 1 },
      { kind: "line", x1, y1, x2, y2, color: C.metalLight, width: 2, alpha: 0.5 },
    ],
    solids: [],
  };
}

function displayCase(x: number, y: number): Piece {
  return {
    decor: [
      { kind: "rect", x, y, w: 70, h: 30, fill: C.wallDark, stroke: C.doorFrame, strokeAlpha: 0.35 },
      { kind: "rect", x: x + 6, y: y + 6, w: 58, h: 18, fill: 0x2a2440, alpha: 0.8 },
      { kind: "circle", x: x + 35, y: y + 15, r: 5, fill: C.amber, alpha: 0.7 },
    ],
    solids: [{ kind: "rect", rect: rectOf(x, y, 70, 30) }],
  };
}

function tacticalTable(x: number, y: number): Piece {
  const w = 150;
  const h = 76;
  const decor: Decor[] = [
    { kind: "rect", x, y, w, h, fill: C.metal, stroke: C.metalLight, strokeAlpha: 0.6 },
    { kind: "rect", x: x + 6, y: y + 6, w: w - 12, h: h - 12, fill: C.screen, alpha: 0.3 },
  ];
  for (let gx = x + 6; gx <= x + w - 6; gx += 18) decor.push({ kind: "line", x1: gx, y1: y + 6, x2: gx, y2: y + h - 6, color: C.screen, alpha: 0.35 });
  for (let gy = y + 6; gy <= y + h - 6; gy += 18) decor.push({ kind: "line", x1: x + 6, y1: gy, x2: x + w - 6, y2: gy, color: C.screen, alpha: 0.35 });
  decor.push({ kind: "circle", x: x + 60, y: y + 30, r: 4, fill: C.amber, alpha: 0.9 });
  decor.push({ kind: "circle", x: x + 96, y: y + 46, r: 4, fill: C.doorFrame, alpha: 0.9 });
  return { decor, solids: [{ kind: "rect", rect: rectOf(x, y, w, h) }] };
}

function collect(pieces: Piece[]): Piece {
  return { decor: pieces.flatMap((p) => p.decor), solids: pieces.flatMap((p) => p.solids) };
}

// ---------------------------------------------------------------------------
// Shared shape of every rectangular deck: spine corridor across the middle.
// ---------------------------------------------------------------------------

export const DECK_BOX: Rect = { left: 60, top: 100, right: 1560, bottom: 1060 };
// Workshop mek cradles: 56 wide, five across a 486px interior, first and
// last flush to the walls -> (486 - 5*56) / 4 between each.
const CRADLE_PITCH = 56 + (486 - 5 * 56) / 4;
export const SPINE_TOP = 420;
export const SPINE_BOTTOM = 516;

// ---------------------------------------------------------------------------
// LOWER DECK — the crew deck.
// ---------------------------------------------------------------------------

function buildLower(): DeckLayout {
  const specs: RoomSpec[] = [
    { id: "berths", box: { left: 60, top: 100, right: 400, bottom: SPINE_TOP }, doors: [{ side: "bottom", at: 230, w: 84 }], tint: 0x171c26 },
    { id: "berthsB", box: { left: 400, top: 100, right: 740, bottom: SPINE_TOP }, doors: [{ side: "bottom", at: 570, w: 84 }], tint: 0x171c26 },
    { id: "berthsC", box: { left: 740, top: 100, right: 1080, bottom: SPINE_TOP }, doors: [{ side: "bottom", at: 910, w: 84 }], tint: 0x171c26 },
    { id: "heads", box: { left: 1080, top: 100, right: 1320, bottom: SPINE_TOP }, doors: [{ side: "bottom", at: 1200, w: 84 }], tint: 0x162022 },
    { id: "engineering", box: { left: 1320, top: 100, right: 1560, bottom: SPINE_TOP }, doors: [{ side: "bottom", at: 1440, w: 84 }], tint: 0x1c1a16 },
    { id: "recroom", box: { left: 60, top: SPINE_BOTTOM, right: 760, bottom: 1060 }, doors: [{ side: "top", at: 250, w: 84 }, { side: "top", at: 580, w: 84 }], tint: 0x1c1a17 },
    { id: "hangarDeck", box: { left: 760, top: SPINE_BOTTOM, right: 1560, bottom: 1060 }, doors: [{ side: "top", at: 960, w: 120 }, { side: "top", at: 1360, w: 120 }], tint: 0x191b16 },
  ];
  const a = assembleRooms(specs);
  a.rooms.lowerHall = { left: 60, top: SPINE_TOP, right: 1560, bottom: SPINE_BOTTOM };

  const pieces: Piece[] = [];
  // Berths ×3 — six bunks in two columns, lockers along the bow wall.
  for (const left of [60, 400, 740]) {
    // Furniture is flush to a wall or a clear 40px+ from it — never a
    // 10-30px slot a body can be pushed into and trapped (see the
    // "no trap gaps" test in hubLayout.test.ts).
    for (const row of [0, 1, 2]) {
      pieces.push(bunk(left + WALL_T / 2, 167 + row * 70));
      pieces.push(bunk(left + 340 - WALL_T / 2 - 64, 167 + row * 70));
    }
    pieces.push(lockerRow(left + 100, 107, 6));
  }
  // Heads — three stalls on the west wall, sinks on the east, showers aft.
  pieces.push(stall(1087, 107), stall(1087, 157), stall(1087, 207));
  pieces.push(sink(1287, 107), sink(1287, 129), sink(1287, 151));
  pieces.push({ decor: [{ kind: "line", x1: 1283, y1: 107, x2: 1283, y2: 173, color: C.screen, alpha: 0.35, width: 2 }], solids: [] });
  pieces.push(shower(1110, 340), shower(1176, 340), shower(1242, 340));
  pieces.push({ decor: [{ kind: "label", x: 1200, y: 322, text: "SHOWERS", size: 8 }], solids: [] });
  // Engineering — pipe runs down the east wall, a breaker panel.
  pieces.push(pipeRun(1540, 112, 1540, 408), pipeRun(1524, 112, 1524, 408));
  pieces.push(console(1327, 107, 60, 22));
  // Rec Room — galley along the bow wall, round table, booths, vending, dartboard.
  pieces.push(galleyCounter(400, 523, 353));
  pieces.push(roundTable(RECROOM_TABLE_POINT.x, RECROOM_TABLE_POINT.y, 46));
  pieces.push(boothTable(79, 600), boothTable(79, 720), boothTable(79, 900));
  pieces.push(vending(723, 1007), vending(693, 1007));
  // Lounge corner, aft-east: an L of couches around a low table, a wall
  // screen above it.
  pieces.push({
    decor: [
      { kind: "rect", x: 520, y: 700, w: 150, h: 26, fill: C.mat, stroke: C.woodLight, strokeAlpha: 0.6 },
      { kind: "rect", x: 644, y: 700, w: 26, h: 130, fill: C.mat, stroke: C.woodLight, strokeAlpha: 0.6 },
      { kind: "circle", x: 580, y: 790, r: 22, fill: C.wood, stroke: C.woodLight, strokeAlpha: 0.7 },
      { kind: "rect", x: 480, y: 620, w: 120, h: 16, fill: C.wallDark, stroke: C.screen, strokeAlpha: 0.5 },
      { kind: "rect", x: 484, y: 623, w: 112, h: 10, fill: C.screen, alpha: 0.3 },
      { kind: "label", x: 540, y: 648, text: "SCREEN", size: 8 },
    ],
    solids: [{ kind: "rect", rect: rectOf(520, 700, 150, 26) }, { kind: "rect", rect: rectOf(644, 700, 26, 130) }, { kind: "circle", x: 580, y: 790, r: 22 }],
  });
  pieces.push({
    decor: [
      { kind: "circle", x: 560, y: 1038, r: 14, fill: C.wallDark, stroke: C.rope, strokeAlpha: 0.8 },
      { kind: "circle", x: 560, y: 1038, r: 8, fill: C.amber, alpha: 0.6 },
      { kind: "circle", x: 560, y: 1038, r: 3, fill: C.rope, alpha: 0.9 },
      { kind: "label", x: 560, y: 1018, text: "DARTS", size: 8 },
      { kind: "rect", x: 460, y: 1025, w: 60, h: 28, fill: C.wood, stroke: C.woodLight, strokeAlpha: 0.7 },
      { kind: "label", x: 490, y: 1039, text: "PEGS", size: 8 },
      { kind: "rect", x: 300, y: 1025, w: 90, h: 28, fill: 0x1f3a2a, stroke: C.woodLight, strokeAlpha: 0.7 },
      { kind: "label", x: 345, y: 1039, text: "CARDS", size: 8 },
    ],
    solids: [{ kind: "rect", rect: rectOf(460, 1025, 60, 28) }, { kind: "rect", rect: rectOf(300, 1025, 90, 28) }],
  });
  // Hangar Deck — bay doors aft (hazard band), three mech cradles on the
  // east wall, fuel drums, the launch lane to the muster pad.
  pieces.push({
    decor: [
      { kind: "stripes", x: 900, y: 1036, w: 560, h: 18, color: C.hazard, alpha: 0.55 },
      { kind: "label", x: 1180, y: 1026, text: "BAY DOORS", size: 8 },
      { kind: "line", x1: MUSTER_POINT.x, y1: MUSTER_POINT.y + 30, x2: MUSTER_POINT.x, y2: 1030, color: C.hazard, alpha: 0.35, width: 2 },
    ],
    solids: [],
  });
  pieces.push(mechCradle(1469, 523), mechCradle(1469, 635), mechCradle(1469, 747));
  // Floor markings: a muster ring around the pad, a taxi lane from the
  // cradles to the bay doors. Paint, not furniture — nothing here blocks.
  pieces.push({
    decor: [
      { kind: "circle", x: MUSTER_POINT.x, y: MUSTER_POINT.y, r: 96, fill: C.hazard, alpha: 0.05, stroke: C.hazard, strokeAlpha: 0.3 },
      { kind: "dashrect", x: 1300, y: 545, w: 130, h: 470, color: C.hazard, alpha: 0.3 },
      { kind: "label", x: 1365, y: 535, text: "TAXI LANE", size: 8 },
      { kind: "line", x1: 1000, y1: 560, x2: 1000, y2: 1010, color: C.wallLight, alpha: 0.15 },
      { kind: "line", x1: 1100, y1: 560, x2: 1100, y2: 1010, color: C.wallLight, alpha: 0.15 },
      { kind: "label", x: 1050, y: 545, text: "STAGING", size: 8 },
    ],
    solids: [],
  });
  pieces.push(drum(780, 1040), drum(806, 1040), drum(780, 1014));
  pieces.push(toolChest(1370, 523), toolChest(1396, 523));

  const p = collect(pieces);
  return {
    id: "lower",
    title: "LOWER DECK",
    bounds: DECK_BOX,
    rooms: a.rooms,
    walls: a.walls,
    doorways: a.doorways,
    solids: p.solids,
    decor: p.decor,
    roomTint: { ...a.roomTint, lowerHall: C.corridor },
  };
}

// ---------------------------------------------------------------------------
// UPPER DECK — operations.
// ---------------------------------------------------------------------------

function buildUpper(): DeckLayout {
  const specs: RoomSpec[] = [
    { id: "vault", box: { left: 60, top: 100, right: 560, bottom: SPINE_TOP }, doors: [{ side: "bottom", at: 310, w: 84 }], tint: 0x1a1620 },
    { id: "cic", box: { left: 560, top: 100, right: 1200, bottom: SPINE_TOP }, doors: [{ side: "bottom", at: 880, w: 120 }], tint: 0x141a22 },
    { id: "forwardBays", box: { left: 1200, top: 100, right: 1560, bottom: SPINE_TOP }, doors: [{ side: "bottom", at: 1380, w: 84 }], tint: 0x1c1a16 },
    { id: "workshop", box: { left: 60, top: SPINE_BOTTOM, right: 560, bottom: 1060 }, doors: [{ side: "top", at: 310, w: 110 }], tint: 0x1a1916 },
    { id: "workshopB", box: { left: 560, top: SPINE_BOTTOM, right: 1060, bottom: 1060 }, doors: [{ side: "top", at: 810, w: 110 }], tint: 0x1a1916 },
    { id: "workshopC", box: { left: 1060, top: SPINE_BOTTOM, right: 1560, bottom: 1060 }, doors: [{ side: "top", at: 1310, w: 110 }], tint: 0x1a1916 },
  ];
  const a = assembleRooms(specs);
  a.rooms.upperHall = { left: 60, top: SPINE_TOP, right: 1560, bottom: SPINE_BOTTOM };

  const pieces: Piece[] = [];
  // Vault — display cases flanking the plinth, a safe-deposit wall.
  pieces.push(displayCase(140, 176), displayCase(430, 176), displayCase(140, 383), displayCase(430, 383));
  pieces.push(lockerRow(67, 245, 7, true));
  pieces.push({
    decor: [
      { kind: "rect", x: 120, y: 107, w: 433, h: 18, fill: 0x2a2440, alpha: 0.7, stroke: C.doorFrame, strokeAlpha: 0.25 },
      { kind: "label", x: 336, y: 116, text: "HOUSE HEIRLOOMS", size: 8 },
      // A rug under the plinth, and two more cases on the aft wall.
      { kind: "ellipse", x: VAULT_PLINTH_POINT.x, y: VAULT_PLINTH_POINT.y + 6, rx: 110, ry: 70, fill: 0x2a2440, alpha: 0.35 },
    ],
    solids: [{ kind: "rect", rect: rectOf(120, 107, 433, 18) }],
  });
  // CIC / Bridge — main display on the bow wall, console row, tactical table.
  pieces.push({
    decor: [
      { kind: "rect", x: 680, y: 107, w: 400, h: 22, fill: C.wallDark, stroke: C.screen, strokeAlpha: 0.5 },
      { kind: "rect", x: 686, y: 111, w: 388, h: 14, fill: C.screen, alpha: 0.35 },
      { kind: "line", x1: 700, y1: 118, x2: 1060, y2: 118, color: C.screen, alpha: 0.6 },
      { kind: "label", x: 880, y: 140, text: "MAIN DISPLAY", size: 8 },
    ],
    solids: [{ kind: "rect", rect: rectOf(680, 107, 400, 22) }],
  });
  for (let i = 0; i < 6; i++) pieces.push(console(610 + i * 92, 190, 52, 22));
  for (let i = 0; i < 6; i++) pieces.push(chair(638 + i * 92, 226));
  pieces.push(tacticalTable(805, 268));
  pieces.push(chair(790, 360), chair(880, 360), chair(970, 360));
  pieces.push(console(1143, 240, 50, 22), console(1143, 262, 50, 22));
  // Forward bays — sensor mast conduit down the east wall.
  pieces.push(pipeRun(1540, 112, 1540, 408));
  pieces.push(console(1207, 107, 60, 22));
  // Workshops ×3 — five mek cradles along the aft wall, hazard apron,
  // tool chests on the west wall. Lance A's also holds the bench.
  for (const left of [60, 560, 1060]) {
    // First and last cradle flush to the side walls, four equal slots
    // between (each a clear body-width+), per the no-trap-gaps rule.
    for (let i = 0; i < 5; i++) pieces.push(mekCradle(left + WALL_T / 2 + i * CRADLE_PITCH, 983));
    pieces.push({ decor: [{ kind: "stripes", x: left + 30, y: 967, w: 440, h: 10, color: C.hazard, alpha: 0.35 }], solids: [] });
    pieces.push(toolChest(left + WALL_T / 2, 700), toolChest(left + WALL_T / 2, 740), toolChest(left + WALL_T / 2, 780));
    pieces.push(pipeRun(left + 480, 530, left + 480, 900));
    pieces.push({
      decor: [
        { kind: "dashrect", x: left + 180, y: 660, w: 140, h: 140, color: C.metalLight, alpha: 0.4 },
        { kind: "label", x: left + 250, y: 730, text: "LIFT", size: 8 },
        { kind: "rect", x: left + 400, y: 600, w: 34, h: 34, fill: C.wood, stroke: C.woodLight, strokeAlpha: 0.6 },
        { kind: "rect", x: left + 404, y: 640, w: 30, h: 26, fill: C.wood, stroke: C.woodLight, strokeAlpha: 0.6 },
        { kind: "label", x: left + 418, y: 680, text: "PARTS", size: 8 },
      ],
      solids: [{ kind: "rect", rect: rectOf(left + 400, 600, 34, 66) }],
    });
  }
  pieces.push(workbench(60 + WALL_T / 2, SPINE_BOTTOM + WALL_T / 2));

  const p = collect(pieces);
  return {
    id: "upper",
    title: "UPPER DECK",
    bounds: DECK_BOX,
    rooms: a.rooms,
    walls: a.walls,
    doorways: a.doorways,
    solids: p.solids,
    decor: p.decor,
    roomTint: { ...a.roomTint, upperHall: C.corridor },
  };
}

// ---------------------------------------------------------------------------
// GROTTO — the CO's post, alone on the middle deck. Oval, two doors
// (settled 28 Aug 2026), now sized as a room rather than a void.
// ---------------------------------------------------------------------------

export const GROTTO_BOX: Rect = { left: 250, top: 100, right: 1370, bottom: 920 };
export const GROTTO_ELLIPSE: Ellipse = {
  cx: (GROTTO_BOX.left + GROTTO_BOX.right) / 2,
  cy: (GROTTO_BOX.top + GROTTO_BOX.bottom) / 2,
  rx: (GROTTO_BOX.right - GROTTO_BOX.left) / 2,
  ry: (GROTTO_BOX.bottom - GROTTO_BOX.top) / 2,
};
export const CO_POINT = { x: GROTTO_ELLIPSE.cx, y: GROTTO_ELLIPSE.cy - 80 };

function buildGrotto(): DeckLayout {
  const e = GROTTO_ELLIPSE;
  const pieces: Piece[] = [];
  // Dais the CO stands on — a ring, not a block: bodies walk onto it.
  pieces.push({
    decor: [
      { kind: "circle", x: CO_POINT.x, y: CO_POINT.y, r: 76, fill: 0x1c2a22, stroke: C.leafDark, strokeAlpha: 0.7 },
      { kind: "circle", x: CO_POINT.x, y: CO_POINT.y, r: 52, fill: 0x21332a, stroke: C.amber, strokeAlpha: 0.3 },
    ],
    solids: [],
  });
  // Reflecting pool behind him, planters in a loose ring, moss patches.
  pieces.push({
    decor: [
      { kind: "ellipse", x: e.cx, y: e.cy - 260, rx: 170, ry: 58, fill: C.water, stroke: C.waterLight, strokeAlpha: 0.7 },
      { kind: "ellipse", x: e.cx - 40, y: e.cy - 268, rx: 60, ry: 16, fill: C.waterLight, alpha: 0.25 },
      { kind: "label", x: e.cx, y: e.cy - 260, text: "POOL", size: 8 },
    ],
    solids: [{ kind: "rect", rect: { left: e.cx - 170, top: e.cy - 318, right: e.cx + 170, bottom: e.cy - 202 } }],
  });
  for (const [dx, dy] of [
    [-300, -160],
    [300, -160],
    [-360, 120],
    [360, 120],
    [-160, 250],
    [160, 250],
  ]) {
    pieces.push(planter(e.cx + dx, e.cy + dy));
  }
  for (const [dx, dy, r] of [
    [-120, -60, 40],
    [140, 40, 34],
    [-40, 200, 28],
  ]) {
    pieces.push({ decor: [{ kind: "circle", x: e.cx + dx, y: e.cy + dy, r, fill: C.leafDark, alpha: 0.18 }], solids: [] });
  }
  pieces.push(bench(e.cx - 40, e.cy + 300, 80, 16));
  // A flagstone path from the west stair, round the dais, to the east
  // stair — paint only, the walking line the pathfinder will mostly use.
  const stones: Decor[] = [];
  for (let t = 0; t <= 1; t += 1 / 22) {
    const px = e.cx - e.rx * 0.7 + 70 + t * (e.rx * 1.4 - 140);
    const py = e.cy + 50 + Math.sin(t * Math.PI) * -10;
    stones.push({ kind: "ellipse", x: px, y: py + ((t * 22) % 2) * 6, rx: 16, ry: 9, fill: 0x2c3a30, alpha: 0.7, stroke: 0x3b4d40, strokeAlpha: 0.4 });
  }
  pieces.push({ decor: stones, solids: [] });

  const p = collect(pieces);
  return {
    id: "grotto",
    title: "GROTTO DECK",
    bounds: GROTTO_BOX,
    ellipse: e,
    rooms: { grotto: GROTTO_BOX },
    walls: [],
    doorways: [],
    solids: p.solids,
    decor: p.decor,
    roomTint: { grotto: 0x14201a },
  };
}

// ---------------------------------------------------------------------------
// SPAR DECK — a gym, not a hangar-sized void.
// ---------------------------------------------------------------------------

export const SPAR_BOX: Rect = { left: 330, top: 100, right: 1290, bottom: 760 };

function buildSpar(): DeckLayout {
  const pieces: Piece[] = [];
  const cx = (SPAR_BOX.left + SPAR_BOX.right) / 2;
  const cy = 440;
  const half = 120;
  // The ring: mat is walkable floor, only the four posts block.
  const ropes: Decor[] = [];
  for (const off of [0, 6, 12]) {
    ropes.push({ kind: "line", x1: cx - half, y1: cy - half + off, x2: cx + half, y2: cy - half + off, color: C.rope, alpha: 0.5 });
    ropes.push({ kind: "line", x1: cx - half, y1: cy + half - off, x2: cx + half, y2: cy + half - off, color: C.rope, alpha: 0.5 });
    ropes.push({ kind: "line", x1: cx - half + off, y1: cy - half, x2: cx - half + off, y2: cy + half, color: C.rope, alpha: 0.5 });
    ropes.push({ kind: "line", x1: cx + half - off, y1: cy - half, x2: cx + half - off, y2: cy + half, color: C.rope, alpha: 0.5 });
  }
  pieces.push({ decor: [{ kind: "rect", x: cx - half, y: cy - half, w: half * 2, h: half * 2, fill: C.mat, alpha: 0.9 }, ...ropes, { kind: "label", x: cx, y: cy, text: "RING", size: 9 }], solids: [] });
  pieces.push(ringPost(cx - half, cy - half), ringPost(cx + half, cy - half), ringPost(cx - half, cy + half), ringPost(cx + half, cy + half));
  pieces.push(bench(SPAR_BOX.left, 300, 18, 120), bench(SPAR_BOX.right - 18, 300, 18, 120));
  pieces.push(lockerRow(520, 100, 8), lockerRow(880, 100, 8));
  pieces.push(heavyBag(1180, 660), heavyBag(1120, 700));
  pieces.push({
    decor: [
      { kind: "dashrect", x: 420, y: 560, w: 180, h: 140, color: C.metalLight, alpha: 0.45 },
      { kind: "label", x: 510, y: 630, text: "MATS", size: 8 },
      { kind: "rect", x: 700, y: 730, w: 240, h: 30, fill: C.metal, stroke: C.metalLight, strokeAlpha: 0.5 },
      { kind: "label", x: 820, y: 745, text: "WEIGHT RACK", size: 8 },
      { kind: "rect", x: 1120, y: 100, w: 120, h: 40, fill: C.wallDark, stroke: C.amber, strokeAlpha: 0.5 },
      { kind: "label", x: 1180, y: 114, text: "STANDINGS", size: 8 },
      { kind: "label", x: 1180, y: 129, text: "0 — 0", size: 9, color: "#d8a04a" },
      { kind: "rect", x: 1272, y: 460, w: 18, h: 30, fill: C.water, stroke: C.waterLight, strokeAlpha: 0.7 },
      { kind: "label", x: 1258, y: 504, text: "H2O", size: 7 },
    ],
    solids: [{ kind: "rect", rect: rectOf(700, 730, 240, 30) }, { kind: "rect", rect: rectOf(1120, 100, 120, 40) }, { kind: "rect", rect: rectOf(1272, 460, 18, 30) }],
  });

  const p = collect(pieces);
  return {
    id: "sparRoom",
    title: "SPAR DECK",
    bounds: SPAR_BOX,
    rooms: { sparRoom: SPAR_BOX },
    walls: [],
    doorways: [],
    solids: p.solids,
    decor: p.decor,
    roomTint: { sparRoom: 0x1e1717 },
  };
}

// ---------------------------------------------------------------------------
// Landmarks that Hub.ts systems key off — derived from the rooms above so
// a room move carries its furniture with it.
// ---------------------------------------------------------------------------

export const RECROOM_TABLE_POINT = { x: 300, y: 800 };
// Rec Room Standings, 3 Sep 2026 — the board on the wall, in the games
// corner alongside CARDS / PEGS / DARTS rather than off on its own, since
// it is the record of exactly those three. Sits clear to the west of the
// CARDS table (x 300-390) with the booths well above it, so no body can be
// pinched between the two — the "no trap gaps" rule this file's own test
// enforces. A walk-up point like the Vault plinth and the Workshop bench,
// not a solid: the board is on the wall, you do not walk into it.
export const RECROOM_BOARD_POINT = { x: 180, y: 1010 };
export const MUSTER_POINT = { x: 1200, y: 930 };
export const HANGAR_SHOP_POINT = { x: 850, y: 600 };
export const WORKSHOP_BENCH_POINT = { x: 150, y: 600 };
export const VAULT_PLINTH_POINT = { x: 310, y: 250 };
// Where the player first stands on a fresh Hub load: the Rec Room's open
// floor, between the table and the galley, clear of every seat.
export const PLAYER_SPAWN = { x: 480, y: 760 };

// Where each workshop's Meks stand — in front of their cradles, one per
// cradle, matching the mekCradle placement in buildUpper.
export const MEK_SPOTS: Record<"workshop" | "workshopB" | "workshopC", { x: number; y: number }[]> = {
  workshop: [0, 1, 2, 3, 4].map((i) => ({ x: 60 + WALL_T / 2 + i * CRADLE_PITCH + 28, y: 930 })),
  workshopB: [0, 1, 2, 3, 4].map((i) => ({ x: 560 + WALL_T / 2 + i * CRADLE_PITCH + 28, y: 930 })),
  workshopC: [0, 1, 2, 3, 4].map((i) => ({ x: 1060 + WALL_T / 2 + i * CRADLE_PITCH + 28, y: 930 })),
};

// The three hand-authored Rec Room regulars' seats, around the table.
export const RECROOM_SEATS = [210, 330, 90].map((deg) => {
  const a = (deg * Math.PI) / 180;
  return { x: RECROOM_TABLE_POINT.x + Math.cos(a) * 70, y: RECROOM_TABLE_POINT.y + Math.sin(a) * 70 };
});

// Reserved-bay marker positions, inside Engineering (lower) and the
// Forward Bays (upper).
export const BAY_MARKERS = {
  lower: { x: 1440, ys: [172, 262, 352] },
  upper: { x: 1380, ys: [172, 262, 352] },
};

// Stair markers and their far-side landings.
export const STAIRS = {
  lowerToGrotto: { x: 130, y: 468, landing: { x: 200, y: 468 } },
  lowerToSpar: { x: 1490, y: 468, landing: { x: 1420, y: 468 } },
  grottoToLower: { x: GROTTO_ELLIPSE.cx - GROTTO_ELLIPSE.rx * 0.7, y: GROTTO_ELLIPSE.cy + 50, landing: { x: GROTTO_ELLIPSE.cx - GROTTO_ELLIPSE.rx * 0.7 + 70, y: GROTTO_ELLIPSE.cy + 50 } },
  grottoToUpper: { x: GROTTO_ELLIPSE.cx + GROTTO_ELLIPSE.rx * 0.7, y: GROTTO_ELLIPSE.cy + 50, landing: { x: GROTTO_ELLIPSE.cx + GROTTO_ELLIPSE.rx * 0.7 - 70, y: GROTTO_ELLIPSE.cy + 50 } },
  upperToGrotto: { x: 130, y: 468, landing: { x: 200, y: 468 } },
  sparToLower: { x: 400, y: 440, landing: { x: 470, y: 440 } },
};

export const DECK_LAYOUTS: Record<DeckId, DeckLayout> = {
  lower: buildLower(),
  grotto: buildGrotto(),
  upper: buildUpper(),
  sparRoom: buildSpar(),
};

export function layoutOf(deck: DeckId): DeckLayout {
  return DECK_LAYOUTS[deck];
}

export function roomCenter(room: RoomId, deck: DeckId): { x: number; y: number } {
  const r = DECK_LAYOUTS[deck].rooms[room];
  if (!r) throw new Error(`room ${room} not on deck ${deck}`);
  return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 };
}

// ---------------------------------------------------------------------------
// Collision — a circle of radius r against the deck's walls + solids.
// Returns the circle pushed out to the nearest free spot (a no-op when it
// already isn't touching anything). Hub.ts calls this from
// clampToDeckFloor, which is the ONE place every movement, landing and
// spawn pick already flows through — so walls apply everywhere at once.
// ---------------------------------------------------------------------------

function pushOutOfRect(x: number, y: number, r: number, rect: Rect): { x: number; y: number } | null {
  const nx = Math.max(rect.left, Math.min(x, rect.right));
  const ny = Math.max(rect.top, Math.min(y, rect.bottom));
  const dx = x - nx;
  const dy = y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return null;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    const push = r - d;
    return { x: x + (dx / d) * push, y: y + (dy / d) * push };
  }
  // Centre is inside the rect: leave by the nearest edge.
  const toLeft = x - rect.left;
  const toRight = rect.right - x;
  const toTop = y - rect.top;
  const toBottom = rect.bottom - y;
  const m = Math.min(toLeft, toRight, toTop, toBottom);
  if (m === toLeft) return { x: rect.left - r, y };
  if (m === toRight) return { x: rect.right + r, y };
  if (m === toTop) return { x, y: rect.top - r };
  return { x, y: rect.bottom + r };
}

function pushOutOfCircle(x: number, y: number, r: number, c: { x: number; y: number; r: number }): { x: number; y: number } | null {
  const dx = x - c.x;
  const dy = y - c.y;
  const d2 = dx * dx + dy * dy;
  const min = r + c.r;
  if (d2 >= min * min) return null;
  if (d2 < 0.0001) return { x: c.x + min, y };
  const d = Math.sqrt(d2);
  return { x: c.x + (dx / d) * min, y: c.y + (dy / d) * min };
}

export function resolveAgainstSolids(deck: DeckId, x: number, y: number, r: number): { x: number; y: number } {
  const layout = DECK_LAYOUTS[deck];
  let px = x;
  let py = y;
  // A few passes so a corner (two walls at once) settles instead of
  // ping-ponging. This only converges if no two solids leave a slot
  // narrower than a body between them — hubLayout.test.ts enforces that
  // rule on the plan ("no trap gaps"), which is why the pass count can
  // stay small.
  for (let pass = 0; pass < 6; pass++) {
    let moved = false;
    for (const w of layout.walls) {
      const p = pushOutOfRect(px, py, r, w);
      if (p) {
        px = p.x;
        py = p.y;
        moved = true;
      }
    }
    for (const s of layout.solids) {
      const p = s.kind === "rect" ? pushOutOfRect(px, py, r, s.rect) : pushOutOfCircle(px, py, r, s);
      if (p) {
        px = p.x;
        py = p.y;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return { x: px, y: py };
}

export function circleHitsSolid(deck: DeckId, x: number, y: number, r: number): boolean {
  const layout = DECK_LAYOUTS[deck];
  for (const w of layout.walls) if (pushOutOfRect(x, y, r, w)) return true;
  for (const s of layout.solids) {
    if (s.kind === "rect" ? pushOutOfRect(x, y, r, s.rect) : pushOutOfCircle(x, y, r, s)) return true;
  }
  return false;
}

// Which room a point is in. Doorways and wall bands sit in no room's
// interior, so a point there resolves to the NEAREST room by edge
// distance rather than to an arbitrary fallback.
export function roomAt(deck: DeckId, x: number, y: number): RoomId {
  const layout = DECK_LAYOUTS[deck];
  let best: RoomId | undefined;
  let bestD = Infinity;
  for (const id of Object.keys(layout.rooms) as RoomId[]) {
    const r = layout.rooms[id]!;
    const dx = Math.max(r.left - x, 0, x - r.right);
    const dy = Math.max(r.top - y, 0, y - r.bottom);
    const d = dx * dx + dy * dy;
    if (d === 0) return id;
    if (d < bestD) {
      bestD = d;
      best = id;
    }
  }
  return best!;
}
