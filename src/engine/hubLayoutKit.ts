// engine/hubLayoutKit.ts — the facility-agnostic half of what used to be
// all of hubLayout.ts (6 Sep 2026, House Amaranth Hub build, step 1 of the
// build plan — claude/Bloom_Wars_House_Amaranth_Hub_Build_Plan_v1.md §1).
//
// Everything in here is a TOOL for describing a floor plan, and knows
// nothing about whose floor plan it is: the DeckLayout data shape, the
// palette, the room/wall/door assembler, every furniture piece, and the
// circle-vs-walls collision math. hubLayout.ts (Warden's Antfarm) and
// hubLayoutHouseAmaranth.ts (the Greathouse) both import from here and
// never from each other — that one-way arrow is what keeps a second
// facility from turning into a copy of the first. Plain-language version:
// this file is the box of LEGO bricks; the two layout files are the two
// models built from it.
//
// Still Phaser-free, for the same reason the original was (see
// hubLayout.ts's header): hubLayout.test.ts walks every number in here
// under plain Node.
//
// Conventions, so the numbers read without a diagram:
// - World coordinates, top-down. Top of a deck = bow / front / north.
// - A room is authored as its OUTER box; walls are WALL_T-thick bands
//   centred on the box's edges, so adjacent rooms share one wall. The
//   room's walkable interior is the box inset by WALL_T / 2.
// - Doorways are gaps cut out of a wall band, `w` wide, centred on `at`.
// - Furniture that blocks a body is a Solid (rect or circle) in
//   `solids`; the drawing of it is a separate Decor entry, so the
//   collision shape can stay simpler than the picture.

// Deck ids are GLOBALLY unique across facilities on purpose: DECK_LAYOUTS
// (hubLayout.ts) holds both facilities' decks in one table, so the
// pathfinder (hubNav.ts) and the collision wrappers below need no idea
// which building a deck belongs to. Warden's four first, the Greathouse's
// four after ("rc" = rez-de-chaussée / ground floor, "ss1"/"ss2" = first
// and second sous-sol / basement, "yard" = the sparring outbuilding).
export type DeckId = "lower" | "grotto" | "upper" | "sparRoom" | "rc" | "ss1" | "ss2" | "yard";

// Room ids are SHARED between facilities wherever the room does the same
// mechanical job (a Barracks IS `berths`; the Motor Court IS
// `hangarDeck`), so sleep-restore, berthRoomFor, the muster pad and the
// roster panel's lance biasing all work in either building without a
// rename. Only rooms with no Warden counterpart get new ids.
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
  | "sparRoom"
  // The Greathouse (House Amaranth) — rooms with no Antfarm equivalent.
  | "cellars"
  | "controlRoom"
  | "records"
  | "ss1Hall"
  | "ss2Hall";

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
  ellipse?: Ellipse; // an oval deck's real floor shape (Warden's grotto); movement clamps to this, not the box
  rooms: Partial<Record<RoomId, Rect>>; // walkable interiors
  walls: Rect[];
  doorways: Doorway[];
  solids: Solid[]; // furniture that blocks a body
  decor: Decor[];
  roomTint: Partial<Record<RoomId, number>>;
  // The spine corridor on a walled deck, if it has one — the room a body
  // walks THROUGH between the others. Hub.ts draws the dashed guide line
  // down it and skips its name plate; the profile keeps it out of the
  // roaming pool. Was a hardcoded `deck === "lower" ? "lowerHall" :
  // "upperHall"` in Hub.ts before facilities existed.
  corridor?: RoomId;
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

export function inset(r: Rect, by: number): Rect {
  return { left: r.left + by, top: r.top + by, right: r.right - by, bottom: r.bottom - by };
}

export function rectOf(x: number, y: number, w: number, h: number): Rect {
  return { left: x, top: y, right: x + w, bottom: y + h };
}

// One wall band (WALL_T thick, centred on a box edge) split around its
// doorways. Returns the solid segments and the gap rects.
export function wallBand(side: WallSide, box: Rect, doors: DoorGap[]): { walls: Rect[]; doorways: Doorway[] } {
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

export interface RoomSpec {
  id: RoomId;
  box: Rect;
  doors: DoorGap[];
  tint?: number;
}

export function assembleRooms(specs: RoomSpec[]): { rooms: Partial<Record<RoomId, Rect>>; walls: Rect[]; doorways: Doorway[]; roomTint: Partial<Record<RoomId, number>> } {
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
export function subtractRect(a: Rect, b: Rect): Rect[] {
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

export interface Piece {
  decor: Decor[];
  solids: Solid[];
}

export function bunk(x: number, y: number, horizontal = true): Piece {
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

export function lockerRow(x: number, y: number, count: number, vertical = false): Piece {
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

export function console(x: number, y: number, w = 56, h = 22): Piece {
  return {
    decor: [
      { kind: "rect", x, y, w, h, fill: C.metal, stroke: C.metalLight, strokeAlpha: 0.5 },
      { kind: "rect", x: x + 4, y: y + 4, w: w - 8, h: h - 10, fill: C.screen, alpha: 0.55 },
      { kind: "line", x1: x + 8, y1: y + h - 4, x2: x + w - 8, y2: y + h - 4, color: C.amber, alpha: 0.5 },
    ],
    solids: [{ kind: "rect", rect: rectOf(x, y, w, h) }],
  };
}

export function chair(x: number, y: number): Piece {
  return { decor: [{ kind: "circle", x, y, r: 7, fill: C.metalLight, alpha: 0.7 }], solids: [] };
}

export function roundTable(x: number, y: number, r: number): Piece {
  return {
    decor: [
      { kind: "circle", x, y, r, fill: C.wood, stroke: C.woodLight, strokeAlpha: 0.8 },
      { kind: "circle", x, y, r: r * 0.55, fill: C.woodLight, alpha: 0.25 },
    ],
    solids: [{ kind: "circle", x, y, r }],
  };
}

export function boothTable(x: number, y: number): Piece {
  return {
    decor: [
      { kind: "rect", x, y, w: 40, h: 70, fill: C.wood, stroke: C.woodLight, strokeAlpha: 0.7 },
      { kind: "rect", x: x - 12, y: y + 4, w: 8, h: 62, fill: C.metal },
      { kind: "rect", x: x + 44, y: y + 4, w: 8, h: 62, fill: C.metal },
    ],
    solids: [{ kind: "rect", rect: rectOf(x - 12, y, 64, 70) }],
  };
}

export function galleyCounter(x: number, y: number, w: number): Piece {
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

export function vending(x: number, y: number): Piece {
  return {
    decor: [
      { kind: "rect", x, y, w: 30, h: 46, fill: C.metal, stroke: C.metalLight, strokeAlpha: 0.6 },
      { kind: "rect", x: x + 5, y: y + 5, w: 20, h: 26, fill: C.screen, alpha: 0.35 },
      { kind: "rect", x: x + 8, y: y + 36, w: 14, h: 5, fill: C.wallDark },
    ],
    solids: [{ kind: "rect", rect: rectOf(x, y, 30, 46) }],
  };
}

export function mekCradle(x: number, y: number): Piece {
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

export function workbench(x: number, y: number, w = 90, h = 28): Piece {
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

export function toolChest(x: number, y: number): Piece {
  return {
    decor: [
      { kind: "rect", x, y, w: 26, h: 40, fill: C.metal, stroke: C.metalLight, strokeAlpha: 0.5 },
      { kind: "line", x1: x + 3, y1: y + 13, x2: x + 23, y2: y + 13, color: C.metalLight, alpha: 0.5 },
      { kind: "line", x1: x + 3, y1: y + 26, x2: x + 23, y2: y + 26, color: C.metalLight, alpha: 0.5 },
    ],
    solids: [{ kind: "rect", rect: rectOf(x, y, 26, 40) }],
  };
}

export function stall(x: number, y: number): Piece {
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

export function sink(x: number, y: number): Piece {
  return {
    decor: [
      { kind: "rect", x, y, w: 26, h: 22, fill: C.metal, stroke: C.metalLight, strokeAlpha: 0.5 },
      { kind: "circle", x: x + 13, y: y + 11, r: 6, fill: C.porcelain, alpha: 0.9 },
      { kind: "circle", x: x + 13, y: y + 11, r: 2, fill: C.water },
    ],
    solids: [{ kind: "rect", rect: rectOf(x, y, 26, 22) }],
  };
}

export function shower(x: number, y: number): Piece {
  return {
    decor: [
      { kind: "dashrect", x, y, w: 46, h: 46, color: C.metalLight, alpha: 0.6 },
      { kind: "circle", x: x + 23, y: y + 23, r: 4, fill: C.wallDark, stroke: C.metalLight, strokeAlpha: 0.7 },
      { kind: "circle", x: x + 8, y: y + 8, r: 3, fill: C.waterLight, alpha: 0.6 },
    ],
    solids: [],
  };
}

export function mechCradle(x: number, y: number): Piece {
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

export function drum(x: number, y: number): Piece {
  return {
    decor: [
      { kind: "circle", x, y, r: 13, fill: C.metal, stroke: C.metalLight, strokeAlpha: 0.6 },
      { kind: "circle", x, y, r: 6, fill: C.hazard, alpha: 0.5 },
    ],
    solids: [{ kind: "circle", x, y, r: 13 }],
  };
}

export function planter(x: number, y: number, r = 26): Piece {
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

export function bench(x: number, y: number, w: number, h: number): Piece {
  return {
    decor: [
      { kind: "rect", x, y, w, h, fill: C.wood, stroke: C.woodLight, strokeAlpha: 0.7 },
      { kind: "line", x1: x + 4, y1: y + h / 2, x2: x + w - 4, y2: y + h / 2, color: C.woodLight, alpha: 0.4 },
    ],
    solids: [{ kind: "rect", rect: rectOf(x, y, w, h) }],
  };
}

export function ringPost(x: number, y: number): Piece {
  return { decor: [{ kind: "circle", x, y, r: 6, fill: C.metalLight, stroke: C.rope, strokeAlpha: 0.8 }], solids: [{ kind: "circle", x, y, r: 6 }] };
}

export function heavyBag(x: number, y: number): Piece {
  return {
    decor: [
      { kind: "circle", x, y, r: 14, fill: C.mat, stroke: C.woodLight, strokeAlpha: 0.7 },
      { kind: "line", x1: x, y1: y - 14, x2: x, y2: y - 30, color: C.metalLight, alpha: 0.6 },
    ],
    solids: [{ kind: "circle", x, y, r: 14 }],
  };
}

export function pipeRun(x1: number, y1: number, x2: number, y2: number): Piece {
  return {
    decor: [
      { kind: "line", x1, y1, x2, y2, color: C.metal, width: 6, alpha: 1 },
      { kind: "line", x1, y1, x2, y2, color: C.metalLight, width: 2, alpha: 0.5 },
    ],
    solids: [],
  };
}

export function displayCase(x: number, y: number): Piece {
  return {
    decor: [
      { kind: "rect", x, y, w: 70, h: 30, fill: C.wallDark, stroke: C.doorFrame, strokeAlpha: 0.35 },
      { kind: "rect", x: x + 6, y: y + 6, w: 58, h: 18, fill: 0x2a2440, alpha: 0.8 },
      { kind: "circle", x: x + 35, y: y + 15, r: 5, fill: C.amber, alpha: 0.7 },
    ],
    solids: [{ kind: "rect", rect: rectOf(x, y, 70, 30) }],
  };
}

export function tacticalTable(x: number, y: number): Piece {
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

export function collect(pieces: Piece[]): Piece {
  return { decor: pieces.flatMap((p) => p.decor), solids: pieces.flatMap((p) => p.solids) };
}
// ---------------------------------------------------------------------------
// Shared shape of every rectangular deck: spine corridor across the middle.
// Both facilities use the same box and the same spine on purpose — see the
// House Amaranth Hub Build Plan §0: keeping these identical is what lets
// every walk-up radius, stair landing and reachability test carry over to
// the Greathouse without re-tuning.
// ---------------------------------------------------------------------------

export const DECK_BOX: Rect = { left: 60, top: 100, right: 1560, bottom: 1060 };
// Workshop mek cradles: 56 wide, five across a 486px interior, first and
// last flush to the walls -> (486 - 5*56) / 4 between each.
export const CRADLE_PITCH = 56 + (486 - 5 * 56) / 4;
export const SPINE_TOP = 420;
export const SPINE_BOTTOM = 516;

// ---------------------------------------------------------------------------
// Collision — a circle of radius r against ONE layout's walls + solids.
// These take the DeckLayout itself; hubLayout.ts wraps them with the
// DECK_LAYOUTS lookup under the names Hub.ts/hubNav.ts already import
// (resolveAgainstSolids / circleHitsSolid / roomAt).
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

export function resolveAgainstLayout(layout: DeckLayout, x: number, y: number, r: number): { x: number; y: number } {
  let px = x;
  let py = y;
  // A few passes so a corner (two walls at once) settles instead of
  // ping-ponging. This only converges if no two solids leave a slot
  // narrower than a body between them — hubLayout.test.ts enforces that
  // rule on every plan ("no trap gaps"), which is why the pass count can
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

export function circleHitsLayout(layout: DeckLayout, x: number, y: number, r: number): boolean {
  for (const w of layout.walls) if (pushOutOfRect(x, y, r, w)) return true;
  for (const s of layout.solids) {
    if (s.kind === "rect" ? pushOutOfRect(x, y, r, s.rect) : pushOutOfCircle(x, y, r, s)) return true;
  }
  return false;
}

// Which room a point is in. Doorways and wall bands sit in no room's
// interior, so a point there resolves to the NEAREST room by edge
// distance rather than to an arbitrary fallback.
export function roomAtIn(layout: DeckLayout, x: number, y: number): RoomId {
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

// `console` shadows the global inside any module that imports it by that
// name — the Antfarm file already lived with that; new layouts should
// import this alias instead.
export { console as consolePiece };
