// The Antfarm's floor plan — 3 Sep 2026. Maxime: "lets give it corridor
// and walls now. delimiting the rooms and placing them aestetically
// pleasing way... make me a good looking and practical spaceship interior.
// the ant can roam and everything."
//
// This is Warden Company's whole ship as DATA: per deck, its outer floor,
// every room's interior, every wall segment, every doorway, every piece of
// furniture that blocks a body, and every purely-visual detail. Hub.ts
// reads it to draw the decks and to clamp movement; engine/hubNav.ts reads
// it to build the navigation grid NPCs path through. Nothing in here
// imports Phaser, for the same reason hubGeometry.ts doesn't: Hub.ts can't
// be unit-tested (it imports "phaser" at module scope, which throws
// outside a browser), so every number that could strand an NPC behind a
// wall lives here where hubLayout.test.ts can actually walk it.
//
// 6 Sep 2026, House Amaranth Hub build (step 1 of
// claude/Bloom_Wars_House_Amaranth_Hub_Build_Plan_v1.md) — split in two.
// The TOOLS (types, palette, the room assembler, every furniture piece,
// the collision math) moved to hubLayoutKit.ts so a second facility could
// be built from the same bricks; what stays here is Warden's own four
// decks, Warden's landmark points, and DECK_LAYOUTS — the one registry of
// EVERY deck in the game, both facilities', which is what lets hubNav.ts
// and the collision wrappers below stay ignorant of whose deck they're
// looking at. Every name Hub.ts / hubNav.ts / hubLayout.test.ts imported
// from here before the split still resolves here (the `export *` below).
//
// This is a hand-authored, FIXED plan. The design docs
// (Bloom_Wars_Antfarm_Grid_v1.md §3d/§3e) still want a player-placed
// "build your ship" system eventually; nothing here forecloses that — a
// placement system would emit exactly this data structure instead of a
// human typing it — but that system is still paper, and this is the
// current shipped layout.

export * from "./hubLayoutKit";
import {
  type DeckId,
  type DeckLayout,
  type Decor,
  type Ellipse,
  type Piece,
  type Rect,
  type RoomId,
  type RoomSpec,
  C,
  CRADLE_PITCH,
  DECK_BOX,
  SPINE_BOTTOM,
  SPINE_TOP,
  WALL_T,
  assembleRooms,
  bench,
  boothTable,
  bunk,
  chair,
  circleHitsLayout,
  collect,
  consolePiece as console,
  displayCase,
  drum,
  galleyCounter,
  heavyBag,
  lockerRow,
  mechCradle,
  mekCradle,
  pipeRun,
  planter,
  rectOf,
  resolveAgainstLayout,
  ringPost,
  roomAtIn,
  roundTable,
  shower,
  sink,
  stall,
  tacticalTable,
  toolChest,
  vending,
  workbench,
} from "./hubLayoutKit";
import { HOUSE_AMARANTH_DECKS } from "./hubLayoutHouseAmaranth";

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
    corridor: "lowerHall",
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
    corridor: "upperHall",
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
// B2, 5 Sep 2026 — the crew-records console, a second walk-up point in the
// same Hangar Deck room as the ROSTER & GEAR console above. Separate point
// rather than a second meaning for one E press: that console owns the
// Campaign Shop (gear, tiers, recruiting) per Maxime's 30 Aug call, and the
// roster/stats panel is a different screen about different things. 220px
// clear of it — comfortably more than twice HANGAR_SHOP_RADIUS (60), so a
// player can never be "at" both at once and get the wrong E action, the
// same clearance rule the Workshop bench documents against its own stair.
export const CREW_RECORDS_POINT = { x: 1070, y: 600 };
export const WORKSHOP_BENCH_POINT = { x: 150, y: 600 };
export const VAULT_PLINTH_POINT = { x: 310, y: 250 };
// The CIC's tactical table, centre of the 150x76 slab tacticalTable(805, 268)
// draws. The table is a solid, so the player stands beside it and reads it —
// the same shape as the Vault plinth, one room over.
export const CIC_TABLE_POINT = { x: 880, y: 306 };
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

// Every deck in the game, both facilities', keyed by its globally-unique
// DeckId (see hubLayoutKit.ts's DeckId comment). Warden's four are built
// right here; the Greathouse's four come from hubLayoutHouseAmaranth.ts,
// which imports only the kit — never this file — so there is no cycle.
// One table on purpose: hubNav.ts's grid cache, the wrappers below and
// hubLayout.test.ts's every-deck sweeps all index this and need no idea
// which building a deck belongs to.
export const WARDEN_DECKS: Record<"lower" | "grotto" | "upper" | "sparRoom", DeckLayout> = {
  lower: buildLower(),
  grotto: buildGrotto(),
  upper: buildUpper(),
  sparRoom: buildSpar(),
};

export const DECK_LAYOUTS: Record<DeckId, DeckLayout> = {
  ...WARDEN_DECKS,
  ...HOUSE_AMARANTH_DECKS,
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
// The math itself lives in hubLayoutKit.ts (resolveAgainstLayout etc.);
// these are the by-DeckId wrappers every existing caller imports.
// ---------------------------------------------------------------------------

export function resolveAgainstSolids(deck: DeckId, x: number, y: number, r: number): { x: number; y: number } {
  return resolveAgainstLayout(DECK_LAYOUTS[deck], x, y, r);
}

export function circleHitsSolid(deck: DeckId, x: number, y: number, r: number): boolean {
  return circleHitsLayout(DECK_LAYOUTS[deck], x, y, r);
}

// Which room a point is in. Doorways and wall bands sit in no room's
// interior, so a point there resolves to the NEAREST room by edge
// distance rather than to an arbitrary fallback.
export function roomAt(deck: DeckId, x: number, y: number): RoomId {
  return roomAtIn(DECK_LAYOUTS[deck], x, y);
}
