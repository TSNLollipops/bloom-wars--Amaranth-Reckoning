// The Greathouse — House Amaranth's hub floor plan, 6 Sep 2026. Built from
// the approved mockup (artifact "The Greathouse Floor Plans", v1) per
// claude/Bloom_Wars_House_Amaranth_Hub_Build_Plan_v1.md, step 2, on top of
// the locked 4 Sep design (Bloom_Wars_House_Amaranth_Hub_Facility_Plan_v1.md):
// same tech as Warden's Antfarm, a different building. Maxime's approval
// calls, 6 Sep 2026 (AskUserQuestion): estate name "The Greathouse";
// flavour room names as drawn; three Cultivar Works, one per lance; the
// architecture call ("your call, this is a dev answer") went to one Hub
// scene reading a facility profile — see engine/facility.ts.
//
// Four floors, top to bottom of the building:
//   YARD — a separate outbuilding (the sparring ground). SPAR_BOX reused.
//   RC   — rez-de-chaussée, the ground floor: barracks, washhouse, boiler
//          room forward; the Longhouse and the Motor Court aft, either side
//          of the Gallery (the spine corridor).
//   1SS  — first basement, "the Undercroft": the Cellars forward, three
//          Cultivar Works aft.
//   2SS  — second basement, "the Deep Floor": Reliquary, War Room, Signal
//          Cellar forward; the Control Room (Verinis's post) and Records
//          aft. One stair only — the secure floor is a dead end by design.
// Floor chain: yard — rc — ss1 — ss2 (facilityHouseAmaranth.ts's deckOrder).
//
// Every coordinate that a Hub.ts system keys off — the muster pad, the
// roster console, the game table, the bench, the plinth, the CO's spot, the
// player spawn, the Mek cradles, the BAY markers, every door width and
// position, the spine at 420–516 — is IDENTICAL to Warden's on purpose (the
// Build Plan's §0 argument): it's why hubLayout.test.ts's reachability,
// no-trap-gaps and walkable-landmark sweeps pass here on day one instead of
// being re-tuned. Where this file differs from hubLayout.ts is furniture
// and register: stone, wood, a hearth, casks and a well instead of plating,
// galley, vending and a water station. Anything that BLOCKS a body still
// obeys the "flush to a wall or a clear 38px+ from it" rule that file's
// test enforces — several of the mockup's decorative placements were nudged
// a few pixels here for exactly that reason (each one is commented).
//
// Imports only from hubLayoutKit.ts — never from hubLayout.ts, which
// imports THIS file to register the decks. That one-way arrow is what
// keeps the two facilities from becoming a cycle (or a copy).

import {
  type DeckLayout,
  type Decor,
  type Piece,
  type Rect,
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
  collect,
  consolePiece,
  displayCase,
  drum,
  heavyBag,
  lockerRow,
  mechCradle,
  mekCradle,
  pipeRun,
  planter,
  rectOf,
  ringPost,
  shower,
  sink,
  stall,
  tacticalTable,
  toolChest,
  workbench,
} from "./hubLayoutKit";

// ---------------------------------------------------------------------------
// Estate-only furniture. Same Piece contract as the kit's: the picture and
// the collision shape together, so a cask placed once is placed once.
// ---------------------------------------------------------------------------

// A few colours the ship never needed. Kept local rather than widening the
// kit palette: nothing on the Antfarm is stone or hearth-lit.
const E = {
  stone: 0x3a3f47,
  hearth: 0x4a2a1e,
  ember: 0xe07a3a,
  amaranth: 0x8a2d4b,
} as const;

function cask(x: number, y: number): Piece {
  return {
    decor: [
      { kind: "circle", x, y, r: 13, fill: C.wood, stroke: C.woodLight, strokeAlpha: 0.8 },
      { kind: "circle", x, y, r: 6, fill: C.woodLight, alpha: 0.5 },
    ],
    solids: [{ kind: "circle", x, y, r: 13 }],
  };
}

function crate(x: number, y: number, s = 40): Piece {
  return {
    decor: [
      { kind: "rect", x, y, w: s, h: s, fill: C.wood, stroke: C.woodLight, strokeAlpha: 0.7 },
      { kind: "line", x1: x + 4, y1: y + 4, x2: x + s - 4, y2: y + s - 4, color: C.woodLight, alpha: 0.4 },
    ],
    solids: [{ kind: "rect", rect: rectOf(x, y, s, s) }],
  };
}

function pillar(x: number, y: number): Piece {
  return {
    decor: [
      { kind: "circle", x, y, r: 16, fill: E.stone, stroke: C.wallLight, strokeAlpha: 0.8 },
      { kind: "circle", x, y, r: 9, fill: C.wallDark, alpha: 0.9 },
    ],
    solids: [{ kind: "circle", x, y, r: 16 }],
  };
}

function shelf(x: number, y: number, w: number): Piece {
  return {
    decor: [
      { kind: "rect", x, y, w, h: 24, fill: C.wood, stroke: C.woodLight, strokeAlpha: 0.7 },
      { kind: "line", x1: x + 6, y1: y + 12, x2: x + w - 6, y2: y + 12, color: C.woodLight, alpha: 0.35 },
    ],
    solids: [{ kind: "rect", rect: rectOf(x, y, w, 24) }],
  };
}

function hearth(x: number, y: number): Piece {
  return {
    decor: [
      { kind: "rect", x, y, w: 140, h: 34, fill: E.hearth, stroke: C.woodLight, strokeAlpha: 0.6 },
      { kind: "circle", x: x + 70, y: y + 19, r: 9, fill: E.ember, alpha: 0.85 },
      { kind: "circle", x: x + 70, y: y + 19, r: 4, fill: C.amber, alpha: 0.9 },
      { kind: "label", x: x + 70, y: y + 50, text: "HEARTH", size: 8 },
    ],
    solids: [{ kind: "rect", rect: rectOf(x, y, 140, 34) }],
  };
}

function longTable(x: number, y: number, w: number): Piece {
  return {
    decor: [
      { kind: "rect", x, y, w, h: 10, fill: C.woodLight, alpha: 0.7 },
      { kind: "rect", x, y: y + 12, w, h: 40, fill: C.wood, stroke: C.woodLight, strokeAlpha: 0.8 },
      { kind: "rect", x, y: y + 54, w, h: 10, fill: C.woodLight, alpha: 0.7 },
      { kind: "label", x: x + w / 2, y: y + 32, text: "THE LONG TABLE", size: 8, color: C.labelBright },
    ],
    solids: [{ kind: "rect", rect: rectOf(x, y, w, 64) }],
  };
}

function gameTable(x: number, y: number): Piece {
  // Same 46px round as Warden's Rec Room table — RECROOM_TABLE_RADIUS in
  // Hub.ts and the seats ring both assume it.
  return {
    decor: [
      { kind: "circle", x, y, r: 46, fill: C.wood, stroke: C.woodLight, strokeAlpha: 0.8 },
      { kind: "circle", x, y, r: 30, fill: C.woodLight, alpha: 0.35 },
    ],
    solids: [{ kind: "circle", x, y, r: 46 }],
  };
}

function boiler(x: number, y: number): Piece {
  return {
    decor: [
      { kind: "rect", x, y, w: 60, h: 70, fill: C.metal, stroke: C.metalLight, strokeAlpha: 0.6 },
      { kind: "circle", x: x + 30, y: y + 22, r: 10, fill: E.ember, alpha: 0.6 },
      { kind: "line", x1: x + 8, y1: y + 44, x2: x + 52, y2: y + 44, color: C.metalLight, alpha: 0.5 },
      { kind: "line", x1: x + 8, y1: y + 56, x2: x + 52, y2: y + 56, color: C.metalLight, alpha: 0.5 },
      { kind: "label", x: x + 30, y: y - 10, text: "BOILER", size: 8 },
    ],
    solids: [{ kind: "rect", rect: rectOf(x, y, 60, 70) }],
  };
}

function well(x: number, y: number): Piece {
  return {
    decor: [
      { kind: "circle", x, y, r: 16, fill: E.stone, stroke: C.wallLight, strokeAlpha: 0.8 },
      { kind: "circle", x, y, r: 9, fill: C.water, alpha: 0.9 },
      { kind: "circle", x: x - 3, y: y - 3, r: 3, fill: C.waterLight, alpha: 0.6 },
      { kind: "label", x, y: y + 30, text: "WELL", size: 7 },
    ],
    solids: [{ kind: "circle", x, y, r: 16 }],
  };
}

function commandDesk(x: number, y: number): Piece {
  return {
    decor: [
      { kind: "rect", x, y, w: 400, h: 40, fill: C.metal, stroke: C.metalLight, strokeAlpha: 0.7 },
      { kind: "rect", x: x + 10, y: y + 8, w: 380, h: 24, fill: C.screen, alpha: 0.18 },
      { kind: "label", x: x + 200, y: y - 10, text: "COMMAND DESK", size: 8 },
    ],
    solids: [{ kind: "rect", rect: rectOf(x, y, 400, 40) }],
  };
}

// The Seal-holder's chair — Q6, approved by default 6 Sep 2026. A prop,
// not an NPC (Build Plan §4). Drawn as a high-backed seat behind the desk;
// its solid runs from the desk's aft edge to the wall so the slot between
// them isn't a body-trap (see the no-trap-gaps test).
function sealChair(x: number, y: number, toWallY: number): Piece {
  return {
    decor: [
      { kind: "rect", x, y: y + 5, w: 40, h: 36, fill: C.wood, stroke: C.amber, strokeAlpha: 0.8 },
      { kind: "rect", x: x + 6, y: y + 9, w: 28, h: 10, fill: E.amaranth, alpha: 0.7 },
      // Beside the chair, not above it — above is the command desk.
      { kind: "label", x: x + 104, y: y + 22, text: "THE SEAL'S CHAIR — EMPTY", size: 7, color: "#b0566f" },
    ],
    solids: [{ kind: "rect", rect: { left: x, top: y, right: x + 40, bottom: toWallY } }],
  };
}

function readingTable(x: number, y: number): Piece {
  return {
    decor: [
      { kind: "rect", x, y, w: 120, h: 60, fill: C.wood, stroke: C.woodLight, strokeAlpha: 0.7 },
      { kind: "label", x: x + 60, y: y + 90, text: "READING TABLE", size: 8 },
    ],
    solids: [{ kind: "rect", rect: rectOf(x, y, 120, 60) }],
  };
}

function wallMap(x: number, y: number): Piece {
  return {
    decor: [
      { kind: "rect", x, y, w: 18, h: 300, fill: C.wallDark, stroke: C.amber, strokeAlpha: 0.4 },
      { kind: "rect", x: x + 3, y: y + 6, w: 12, h: 288, fill: C.leafDark, alpha: 0.35 },
      { kind: "label", x: x + 42, y: y + 150, text: "MAP", size: 8 },
    ],
    solids: [{ kind: "rect", rect: rectOf(x, y, 18, 300) }],
  };
}

function bayMarkerDecor(x: number, ys: number[]): Piece {
  // The reserved-bay squares and their labels are drawn by Hub.ts from the
  // profile's reservedBays (same as Warden's). This is only faint floor
  // paint under them, so an empty bay reads as "a bay" and not a bare
  // patch of floor. No text: Hub.ts's own label sits right there.
  const decor: Decor[] = ys.map((y) => ({ kind: "dashrect", x: x - 30, y: y - 30, w: 60, h: 60, color: C.amber, alpha: 0.2 }));
  return { decor, solids: [] };
}

// ---------------------------------------------------------------------------
// Landmarks — every one at Warden's coordinate (see the header). Exported
// under estate names so facilityHouseAmaranth.ts reads them from here, not
// from hubLayout.ts.
// ---------------------------------------------------------------------------

export const GH_GAME_TABLE_POINT = { x: 300, y: 800 };
export const GH_STANDINGS_POINT = { x: 180, y: 1010 };
export const GH_MUSTER_POINT = { x: 1200, y: 930 };
export const GH_ROSTER_CONSOLE_POINT = { x: 850, y: 600 };
export const GH_CREW_RECORDS_POINT = { x: 1070, y: 600 };
export const GH_BENCH_POINT = { x: 150, y: 600 };
export const GH_PLINTH_POINT = { x: 310, y: 250 };
// The Records room's archive console, 7 Sep 2026 — the House's counterpart
// to the CIC's tactical table. NOT new furniture: this is the centre of the
// readingTable(1250, 760) that has stood in Records since the floor-plan
// pass, which that room's own spec comment has been calling "the future home
// of a records terminal" ever since. The table was already there. It just had
// nothing to open.
export const GH_ARCHIVE_TABLE_POINT = { x: 1310, y: 790 };
export const GH_CO_POINT = { x: 560, y: 760 };
export const GH_PLAYER_SPAWN = { x: 480, y: 760 };
export const GH_SEATS = [210, 330, 90].map((deg) => {
  const a = (deg * Math.PI) / 180;
  return { x: GH_GAME_TABLE_POINT.x + Math.cos(a) * 70, y: GH_GAME_TABLE_POINT.y + Math.sin(a) * 70 };
});
export const GH_MEK_SPOTS: Record<"workshop" | "workshopB" | "workshopC", { x: number; y: number }[]> = {
  workshop: [0, 1, 2, 3, 4].map((i) => ({ x: 60 + WALL_T / 2 + i * CRADLE_PITCH + 28, y: 930 })),
  workshopB: [0, 1, 2, 3, 4].map((i) => ({ x: 560 + WALL_T / 2 + i * CRADLE_PITCH + 28, y: 930 })),
  workshopC: [0, 1, 2, 3, 4].map((i) => ({ x: 1060 + WALL_T / 2 + i * CRADLE_PITCH + 28, y: 930 })),
};
// Boiler Room (rc) and Signal Cellar (ss2) — same x/ys as Warden's
// Engineering / Forward Bays, so the six ReservedBayIds keep their rooms.
export const GH_BAY_MARKERS = {
  rc: { x: 1440, ys: [172, 262, 352] },
  ss2: { x: 1380, ys: [172, 262, 352] },
};
// Stair markers and their far-side landings — Warden's corridor-end
// positions (x 130 west, x 1490 east), so DECK_ORDER's generic step-walk
// and every landing clearance carry over.
export const GH_STAIRS = {
  rcToSs1: { x: 130, y: 468, landing: { x: 200, y: 468 } },
  rcToYard: { x: 1490, y: 468, landing: { x: 1420, y: 468 } },
  ss1ToRc: { x: 130, y: 468, landing: { x: 200, y: 468 } },
  ss1ToSs2: { x: 1490, y: 468, landing: { x: 1420, y: 468 } },
  ss2ToSs1: { x: 1490, y: 468, landing: { x: 1420, y: 468 } },
  yardToRc: { x: 400, y: 440, landing: { x: 470, y: 440 } },
};

// ---------------------------------------------------------------------------
// RC — the ground floor.
// ---------------------------------------------------------------------------

function buildGroundFloor(): DeckLayout {
  const specs: RoomSpec[] = [
    { id: "berths", box: { left: 60, top: 100, right: 400, bottom: SPINE_TOP }, doors: [{ side: "bottom", at: 230, w: 84 }], tint: 0x171c26 },
    { id: "berthsB", box: { left: 400, top: 100, right: 740, bottom: SPINE_TOP }, doors: [{ side: "bottom", at: 570, w: 84 }], tint: 0x171c26 },
    { id: "berthsC", box: { left: 740, top: 100, right: 1080, bottom: SPINE_TOP }, doors: [{ side: "bottom", at: 910, w: 84 }], tint: 0x171c26 },
    { id: "heads", box: { left: 1080, top: 100, right: 1320, bottom: SPINE_TOP }, doors: [{ side: "bottom", at: 1200, w: 84 }], tint: 0x162022 },
    { id: "engineering", box: { left: 1320, top: 100, right: 1560, bottom: SPINE_TOP }, doors: [{ side: "bottom", at: 1440, w: 84 }], tint: 0x1c1a16 },
    { id: "recroom", box: { left: 60, top: SPINE_BOTTOM, right: 760, bottom: 1060 }, doors: [{ side: "top", at: 250, w: 84 }, { side: "top", at: 580, w: 84 }], tint: 0x1d1a16 },
    { id: "hangarDeck", box: { left: 760, top: SPINE_BOTTOM, right: 1560, bottom: 1060 }, doors: [{ side: "top", at: 960, w: 120 }, { side: "top", at: 1360, w: 120 }], tint: 0x1d211b },
  ];
  const a = assembleRooms(specs);
  a.rooms.lowerHall = { left: 60, top: SPINE_TOP, right: 1560, bottom: SPINE_BOTTOM };

  const pieces: Piece[] = [];
  // Barracks ×3 — six bunks in two columns, lockers along the north wall.
  // Identical to Warden's berths; a bunk is a bunk.
  for (const left of [60, 400, 740]) {
    for (const row of [0, 1, 2]) {
      pieces.push(bunk(left + WALL_T / 2, 167 + row * 70));
      pieces.push(bunk(left + 340 - WALL_T / 2 - 64, 167 + row * 70));
    }
    pieces.push(lockerRow(left + 100, 107, 6));
  }
  // The Washhouse — stalls west, basins east, baths south.
  pieces.push(stall(1087, 107), stall(1087, 157), stall(1087, 207));
  pieces.push(sink(1287, 107), sink(1287, 129), sink(1287, 151));
  pieces.push({ decor: [{ kind: "line", x1: 1283, y1: 107, x2: 1283, y2: 173, color: C.screen, alpha: 0.35, width: 2 }], solids: [] });
  pieces.push(shower(1110, 340), shower(1176, 340), shower(1242, 340));
  pieces.push({ decor: [{ kind: "label", x: 1200, y: 322, text: "BATHS", size: 8 }], solids: [] });
  // The Boiler Room — pipe runs down the east wall, a breaker panel, the
  // boiler itself flush to the west wall and the south wall (mockup had it
  // 13px off both — a trap slot; flushed here).
  pieces.push(pipeRun(1540, 112, 1540, 408), pipeRun(1524, 112, 1524, 408));
  pieces.push(consolePiece(1327, 107, 60, 22));
  pieces.push(boiler(1327, 343));
  pieces.push(bayMarkerDecor(GH_BAY_MARKERS.rc.x, GH_BAY_MARKERS.rc.ys));
  // The Longhouse — hearth on the north wall with planters flush either
  // side (mockup's 20px gaps were trap slots), the long table below it,
  // booths down the west wall, the game table, the settle corner, casks
  // and the games shelf on the south wall.
  pieces.push(hearth(330, 523));
  pieces.push(planter(310, 543, 20), planter(490, 543, 20));
  // y 602, not the mockup's 600: 37px under the planters' rims is a trap
  // slot, 39 is floor (hubLayout.test.ts's own MIN_SLOT).
  pieces.push(longTable(380, 602, 300));
  pieces.push(gameTable(GH_GAME_TABLE_POINT.x, GH_GAME_TABLE_POINT.y));
  pieces.push(boothTable(79, 600), boothTable(79, 720), boothTable(79, 900));
  pieces.push({
    // The settle: an L of benches around a low stool, a wall screen above.
    // Shifted 10px aft of Warden's lounge corner to clear the long table
    // (no-trap-gaps: 36px would have been a slot, 46 is floor).
    decor: [
      { kind: "rect", x: 520, y: 710, w: 150, h: 26, fill: C.mat, stroke: C.woodLight, strokeAlpha: 0.6 },
      { kind: "rect", x: 644, y: 710, w: 26, h: 130, fill: C.mat, stroke: C.woodLight, strokeAlpha: 0.6 },
      { kind: "circle", x: 580, y: 800, r: 22, fill: C.wood, stroke: C.woodLight, strokeAlpha: 0.7 },
      { kind: "label", x: 590, y: 860, text: "SETTLE", size: 8 },
    ],
    solids: [{ kind: "rect", rect: rectOf(520, 710, 150, 26) }, { kind: "rect", rect: rectOf(644, 710, 26, 130) }, { kind: "circle", x: 580, y: 800, r: 22 }],
  });
  pieces.push(cask(740, 1040), cask(714, 1040));
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
  // The Motor Court — an open courtyard: flagstone grid, the terrace gate
  // where Warden's bay doors were, three mech stands on the east wall, the
  // ramp lane, drums and tool chests. Planters flush to the west wall.
  const flags: Decor[] = [];
  for (let gx = 820; gx < 1560; gx += 60) flags.push({ kind: "line", x1: gx, y1: 523, x2: gx, y2: 1053, color: C.wallLight, alpha: 0.07 });
  for (let gy = 580; gy < 1053; gy += 60) flags.push({ kind: "line", x1: 767, y1: gy, x2: 1553, y2: gy, color: C.wallLight, alpha: 0.07 });
  pieces.push({ decor: flags, solids: [] });
  pieces.push({
    decor: [
      { kind: "stripes", x: 900, y: 1036, w: 560, h: 18, color: C.hazard, alpha: 0.55 },
      { kind: "label", x: 1180, y: 1026, text: "TERRACE GATE", size: 8 },
      { kind: "line", x1: GH_MUSTER_POINT.x, y1: GH_MUSTER_POINT.y + 30, x2: GH_MUSTER_POINT.x, y2: 1030, color: C.hazard, alpha: 0.35, width: 2 },
    ],
    solids: [],
  });
  pieces.push(mechCradle(1469, 523), mechCradle(1469, 635), mechCradle(1469, 747));
  pieces.push({
    decor: [
      { kind: "circle", x: GH_MUSTER_POINT.x, y: GH_MUSTER_POINT.y, r: 96, fill: C.hazard, alpha: 0.05, stroke: C.hazard, strokeAlpha: 0.3 },
      { kind: "dashrect", x: 1300, y: 545, w: 130, h: 470, color: C.hazard, alpha: 0.3 },
      { kind: "label", x: 1365, y: 535, text: "RAMP", size: 8 },
      { kind: "line", x1: 1000, y1: 560, x2: 1000, y2: 1010, color: C.wallLight, alpha: 0.15 },
      { kind: "line", x1: 1100, y1: 560, x2: 1100, y2: 1010, color: C.wallLight, alpha: 0.15 },
      { kind: "label", x: 1050, y: 545, text: "STAGING", size: 8 },
    ],
    solids: [],
  });
  pieces.push(drum(780, 1040), drum(806, 1040), drum(780, 1014));
  pieces.push(toolChest(1370, 523), toolChest(1396, 523));
  pieces.push(planter(785, 541, 18), planter(785, 577, 18));

  const p = collect(pieces);
  return {
    id: "rc",
    title: "GROUND FLOOR",
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
// 1SS — the Undercroft.
// ---------------------------------------------------------------------------

function buildUndercroft(): DeckLayout {
  const specs: RoomSpec[] = [
    // One long vaulted cellar across the whole forward half, three doors
    // onto the passage — decor-only (Q5, approved by default): a natural
    // future home for a Frame Systems / salvage walk-up, nothing built.
    { id: "cellars", box: { left: 60, top: 100, right: 1560, bottom: SPINE_TOP }, doors: [{ side: "bottom", at: 310, w: 84 }, { side: "bottom", at: 810, w: 84 }, { side: "bottom", at: 1310, w: 84 }], tint: 0x18171a },
    { id: "workshop", box: { left: 60, top: SPINE_BOTTOM, right: 560, bottom: 1060 }, doors: [{ side: "top", at: 310, w: 110 }], tint: 0x1a1916 },
    { id: "workshopB", box: { left: 560, top: SPINE_BOTTOM, right: 1060, bottom: 1060 }, doors: [{ side: "top", at: 810, w: 110 }], tint: 0x1a1916 },
    { id: "workshopC", box: { left: 1060, top: SPINE_BOTTOM, right: 1560, bottom: 1060 }, doors: [{ side: "top", at: 1310, w: 110 }], tint: 0x1a1916 },
  ];
  const a = assembleRooms(specs);
  a.rooms.ss1Hall = { left: 60, top: SPINE_TOP, right: 1560, bottom: SPINE_BOTTOM };

  const pieces: Piece[] = [];
  // The Cellars — a row of pillars, crates and lockers in the west end
  // (crates made contiguous: the mockup's 4px seams were trap slots), the
  // salvage cage outline mid-room, stores shelves flush to the east wall,
  // casks flush to the east wall, a pipe run along the south wall.
  for (const x of [310, 560, 810, 1060, 1310]) pieces.push(pillar(x, 260));
  pieces.push(crate(120, 107), crate(160, 107), crate(120, 147), crate(200, 107, 30));
  pieces.push(lockerRow(67, 200, 6, true));
  pieces.push({
    decor: [
      { kind: "dashrect", x: 700, y: 120, w: 220, h: 120, color: C.metalLight, alpha: 0.45 },
      { kind: "label", x: 810, y: 178, text: "SALVAGE CAGE", size: 8 },
    ],
    solids: [],
  });
  pieces.push(shelf(1403, 107, 150), shelf(1403, 131, 150), shelf(1403, 155, 150));
  pieces.push({ decor: [{ kind: "label", x: 1478, y: 196, text: "STORES", size: 8 }], solids: [] });
  pieces.push(cask(1540, 300), cask(1514, 300), cask(1540, 274));
  pieces.push(pipeRun(80, 380, 1540, 380));
  // Cultivar Works ×3 — Warden's workshop geometry to the pixel: five Mek
  // cradles along the south wall, hazard apron, tool chests on the west
  // wall, the hoist outline, the parts rack. Lance A's holds the bench.
  for (const left of [60, 560, 1060]) {
    for (let i = 0; i < 5; i++) pieces.push(mekCradle(left + WALL_T / 2 + i * CRADLE_PITCH, 983));
    pieces.push({ decor: [{ kind: "stripes", x: left + 30, y: 967, w: 440, h: 10, color: C.hazard, alpha: 0.35 }], solids: [] });
    pieces.push(toolChest(left + WALL_T / 2, 700), toolChest(left + WALL_T / 2, 740), toolChest(left + WALL_T / 2, 780));
    pieces.push(pipeRun(left + 480, 530, left + 480, 900));
    pieces.push({
      decor: [
        { kind: "dashrect", x: left + 180, y: 660, w: 140, h: 140, color: C.metalLight, alpha: 0.4 },
        { kind: "label", x: left + 250, y: 730, text: "HOIST", size: 8 },
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
    id: "ss1",
    title: "THE UNDERCROFT",
    bounds: DECK_BOX,
    rooms: a.rooms,
    walls: a.walls,
    doorways: a.doorways,
    solids: p.solids,
    decor: p.decor,
    roomTint: { ...a.roomTint, ss1Hall: C.corridor },
    corridor: "ss1Hall",
  };
}

// ---------------------------------------------------------------------------
// 2SS — the Deep Floor. The secure floor: one stair, a dead end by design.
// ---------------------------------------------------------------------------

function buildDeepFloor(): DeckLayout {
  const specs: RoomSpec[] = [
    { id: "vault", box: { left: 60, top: 100, right: 560, bottom: SPINE_TOP }, doors: [{ side: "bottom", at: 310, w: 84 }], tint: 0x1a1620 },
    { id: "cic", box: { left: 560, top: 100, right: 1200, bottom: SPINE_TOP }, doors: [{ side: "bottom", at: 880, w: 120 }], tint: 0x141a22 },
    { id: "forwardBays", box: { left: 1200, top: 100, right: 1560, bottom: SPINE_TOP }, doors: [{ side: "bottom", at: 1380, w: 84 }], tint: 0x1c1a16 },
    // The Control Room does the grotto's job (the CO's post) with the
    // opposite register: a command floor, not a garden. Two doors.
    { id: "controlRoom", box: { left: 60, top: SPINE_BOTTOM, right: 1060, bottom: 1060 }, doors: [{ side: "top", at: 310, w: 84 }, { side: "top", at: 810, w: 84 }], tint: 0x161b22 },
    // Records — the House's archive. Decor-only until 7 Sep 2026, when the
    // records terminal this comment promised became real: the reading table
    // below is the Archive console (GH_ARCHIVE_TABLE_POINT).
    { id: "records", box: { left: 1060, top: SPINE_BOTTOM, right: 1560, bottom: 1060 }, doors: [{ side: "top", at: 1310, w: 84 }], tint: 0x1a1a18 },
  ];
  const a = assembleRooms(specs);
  a.rooms.ss2Hall = { left: 60, top: SPINE_TOP, right: 1560, bottom: SPINE_BOTTOM };

  const pieces: Piece[] = [];
  // The Reliquary — Warden's Vault furniture: cases flanking the plinth, a
  // relic wall, the rug.
  pieces.push(displayCase(140, 176), displayCase(430, 176), displayCase(140, 383), displayCase(430, 383));
  pieces.push(lockerRow(67, 245, 7, true));
  pieces.push({
    decor: [
      { kind: "rect", x: 120, y: 107, w: 433, h: 18, fill: 0x2a2440, alpha: 0.7, stroke: C.doorFrame, strokeAlpha: 0.25 },
      { kind: "label", x: 336, y: 116, text: "AMARANTH RELICS", size: 8 },
      { kind: "ellipse", x: GH_PLINTH_POINT.x, y: GH_PLINTH_POINT.y + 6, rx: 110, ry: 70, fill: 0x2a2440, alpha: 0.35 },
    ],
    solids: [{ kind: "rect", rect: rectOf(120, 107, 433, 18) }],
  });
  // The War Room — Warden's CIC: main display, console row, tactical table.
  pieces.push({
    decor: [
      { kind: "rect", x: 680, y: 107, w: 400, h: 22, fill: C.wallDark, stroke: C.screen, strokeAlpha: 0.5 },
      { kind: "rect", x: 686, y: 111, w: 388, h: 14, fill: C.screen, alpha: 0.35 },
      { kind: "line", x1: 700, y1: 118, x2: 1060, y2: 118, color: C.screen, alpha: 0.6 },
      { kind: "label", x: 880, y: 140, text: "MAIN DISPLAY", size: 8 },
    ],
    solids: [{ kind: "rect", rect: rectOf(680, 107, 400, 22) }],
  });
  for (let i = 0; i < 6; i++) pieces.push(consolePiece(610 + i * 92, 190, 52, 22));
  for (let i = 0; i < 6; i++) pieces.push(chair(638 + i * 92, 226));
  pieces.push(tacticalTable(805, 268));
  pieces.push(chair(790, 360), chair(880, 360), chair(970, 360));
  pieces.push(consolePiece(1143, 240, 50, 22), consolePiece(1143, 262, 50, 22));
  // The Signal Cellar — Warden's Forward Bays: the mast conduit, a panel.
  pieces.push(pipeRun(1540, 112, 1540, 408));
  pieces.push(consolePiece(1207, 107, 60, 22));
  pieces.push(bayMarkerDecor(GH_BAY_MARKERS.ss2.x, GH_BAY_MARKERS.ss2.ys));
  // The Control Room — terrace feeds along the north wall, the wall map
  // flush west, a console stack flush east (mockup's 3px/18px gaps were
  // trap slots — flushed and made contiguous), the report line in front of
  // Verinis's spot, the command desk on the south wall, the Seal's chair
  // behind it.
  pieces.push({
    decor: [
      // Between the two doors (gaps 268–352 and 768–852), not across them
      // — the mockup drew one 700px screen the doorways would have opened
      // straight into.
      { kind: "rect", x: 380, y: 523, w: 360, h: 22, fill: C.wallDark, stroke: C.screen, strokeAlpha: 0.5 },
      { kind: "rect", x: 386, y: 527, w: 348, h: 14, fill: C.screen, alpha: 0.3 },
      { kind: "label", x: 560, y: 558, text: "TERRACE FEEDS", size: 8 },
    ],
    solids: [{ kind: "rect", rect: rectOf(380, 523, 360, 22) }],
  });
  pieces.push(wallMap(67, 600));
  pieces.push(consolePiece(1013, 600, 40, 22), consolePiece(1013, 622, 40, 22), consolePiece(1013, 644, 40, 22));
  const reportLine: Decor[] = [];
  for (let d = 460; d <= 660; d += 20) reportLine.push({ kind: "line", x1: d, y1: 700, x2: d + 10, y2: 700, color: C.amber, alpha: 0.5, width: 2 });
  reportLine.push({ kind: "label", x: 560, y: 688, text: "REPORT HERE", size: 7, color: "#d8a04a" });
  pieces.push({ decor: reportLine, solids: [] });
  pieces.push(commandDesk(360, 960));
  pieces.push(sealChair(540, 1000, 1053));
  // Records — filing walls east and west, a desk console, the reading table.
  pieces.push(lockerRow(1067, 600, 8, true), lockerRow(1533, 600, 8, true));
  pieces.push(consolePiece(1067, 523, 60, 22)); // flush to the west wall and clear of the door gap (1268–1352), where the mockup's x=1230 sat half in it
  pieces.push(readingTable(GH_ARCHIVE_TABLE_POINT.x - 60, GH_ARCHIVE_TABLE_POINT.y - 30));
  pieces.push(chair(1230, 790), chair(1390, 790));

  const p = collect(pieces);
  return {
    id: "ss2",
    title: "THE DEEP FLOOR",
    bounds: DECK_BOX,
    rooms: a.rooms,
    walls: a.walls,
    doorways: a.doorways,
    solids: p.solids,
    decor: p.decor,
    roomTint: { ...a.roomTint, ss2Hall: C.corridor },
    corridor: "ss2Hall",
  };
}

// ---------------------------------------------------------------------------
// THE YARD — the sparring ground, a separate outbuilding. SPAR_BOX reused.
// ---------------------------------------------------------------------------

export const YARD_BOX: Rect = { left: 330, top: 100, right: 1290, bottom: 760 };

function buildYard(): DeckLayout {
  const pieces: Piece[] = [];
  const cx = (YARD_BOX.left + YARD_BOX.right) / 2;
  const cy = 440;
  const half = 120;
  const ropes: Decor[] = [];
  for (const off of [0, 6, 12]) {
    ropes.push({ kind: "line", x1: cx - half, y1: cy - half + off, x2: cx + half, y2: cy - half + off, color: C.rope, alpha: 0.5 });
    ropes.push({ kind: "line", x1: cx - half, y1: cy + half - off, x2: cx + half, y2: cy + half - off, color: C.rope, alpha: 0.5 });
    ropes.push({ kind: "line", x1: cx - half + off, y1: cy - half, x2: cx - half + off, y2: cy + half, color: C.rope, alpha: 0.5 });
    ropes.push({ kind: "line", x1: cx + half - off, y1: cy - half, x2: cx + half - off, y2: cy + half, color: C.rope, alpha: 0.5 });
  }
  pieces.push({ decor: [{ kind: "rect", x: cx - half, y: cy - half, w: half * 2, h: half * 2, fill: C.mat, alpha: 0.9 }, ...ropes, { kind: "label", x: cx, y: cy, text: "RING", size: 9 }], solids: [] });
  pieces.push(ringPost(cx - half, cy - half), ringPost(cx + half, cy - half), ringPost(cx - half, cy + half), ringPost(cx + half, cy + half));
  pieces.push(bench(YARD_BOX.left, 300, 18, 120), bench(YARD_BOX.right - 18, 300, 18, 120));
  pieces.push(lockerRow(520, 100, 8), lockerRow(880, 100, 8));
  pieces.push(heavyBag(1180, 660), heavyBag(1120, 700));
  pieces.push({
    decor: [
      { kind: "dashrect", x: 420, y: 560, w: 180, h: 140, color: C.metalLight, alpha: 0.45 },
      { kind: "label", x: 510, y: 630, text: "MATS", size: 8 },
      { kind: "rect", x: 700, y: 730, w: 240, h: 30, fill: C.metal, stroke: C.metalLight, strokeAlpha: 0.5 },
      { kind: "label", x: 820, y: 745, text: "WEIGHT RACK", size: 8 },
      { kind: "rect", x: 1120, y: 100, w: 120, h: 40, fill: C.wallDark, stroke: C.amber, strokeAlpha: 0.5 },
      { kind: "label", x: 1180, y: 114, text: "SPAR RECORD", size: 8 },
      { kind: "label", x: 1180, y: 129, text: "0 — 0", size: 9, color: "#d8a04a" },
    ],
    solids: [{ kind: "rect", rect: rectOf(700, 730, 240, 30) }, { kind: "rect", rect: rectOf(1120, 100, 120, 40) }],
  });
  pieces.push(well(1272, 482)); // 46px below the east bench, not the mockup's 34 (a trap slot)
  // Planters: two nested in the south-west corner (touching, so no slot
  // between them), one by the record board (moved off it — the mockup had
  // them overlapping).
  pieces.push(planter(360, 700, 20), planter(400, 733, 20), planter(1265, 160, 18));
  const stones: Decor[] = [];
  for (let gx = 360; gx < 1290; gx += 90) stones.push({ kind: "line", x1: gx, y1: 100, x2: gx, y2: 760, color: C.wallLight, alpha: 0.05 });
  pieces.push({ decor: stones, solids: [] });

  const p = collect(pieces);
  return {
    id: "yard",
    title: "THE YARD",
    bounds: YARD_BOX,
    rooms: { sparRoom: YARD_BOX },
    walls: [],
    doorways: [],
    solids: p.solids,
    decor: p.decor,
    roomTint: { sparRoom: 0x1e1a13 },
  };
}

export const HOUSE_AMARANTH_DECKS: Record<"rc" | "ss1" | "ss2" | "yard", DeckLayout> = {
  rc: buildGroundFloor(),
  ss1: buildUndercroft(),
  ss2: buildDeepFloor(),
  yard: buildYard(),
};
