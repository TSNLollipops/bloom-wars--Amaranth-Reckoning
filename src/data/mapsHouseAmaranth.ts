// src/data/mapsHouseAmaranth.ts
// House Amaranth's own campaign maps (Bloom_Wars_House_Amaranth_Full_
// Campaign_Plan_v1.md, §2/§8 -- scaffolding pass, 31 Aug 2026). A third
// sibling to data/maps.ts (Team One) and data/mapsAmaranth.ts (Warden
// Company) -- same makeMap()/deriveZones() pipeline (imported from
// data/maps.ts, per that file's own "exactly one place a coordinate can
// be wrong" comment), same discipline: every grid here is transcribed
// verbatim from design/maps_house_amaranth.py's own generated output,
// never hand-edited.
//
// STATUS: 21 real maps (Act I + Act II complete, Act III begun with
// Mission 21), not thirty-six yet -- see maps_house_amaranth.py's own
// GRIDS dict for how to add the next one. (This line had drifted stale at
// "six real maps" for several missions' worth of build passes before this
// one bothered to correct it -- worth actually updating each time, not
// just at milestones.)
import type { MapDefinition, TileType } from "./types";
import { makeMap } from "./maps";

// AUTO-GENERATED grid, transcribed verbatim from design/
// maps_house_amaranth_generated.ts (design/maps_house_amaranth.py's own
// output, 31 Aug 2026 run). Never hand-edit this grid directly -- edit
// the ASCII source in that script and regenerate.
const FIRST_HARVEST_TILES: TileType[][] = [
  ["spawn", "spawn", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
  ["plain", "plain", "bloom_mat", "bloom_mat", "bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
  ["plain", "plain", "bloom_mat", "bloom_mat", "bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
  ["plain", "plain", "plain", "plain", "deploy", "deploy", "deploy", "deploy", "deploy", "plain", "plain", "plain", "plain", "plain"],
];

export const map_house_amaranth_first_harvest = makeMap(
  "map_house_amaranth_first_harvest",
  "First Harvest",
  14,
  9,
  FIRST_HARVEST_TILES
);

// AUTO-GENERATED grid, same discipline as above. Structurally the same
// proven walled-room/single-doorway/spawn-past-the-wall shape as Warden's
// own "Wire and Mud" (mapsAmaranth.ts, Mission 2 -- also a hold_zone
// relay-room mission), border retextured scrub/ridge -> bloom_mat for
// House Amaranth's ward-crop-terrace fiction. See maps_house_amaranth.py's
// own GRIDS comment for why reusing a validated shape here isn't the same
// thing as reusing content.
const THE_LONG_CONTRACT_TILES: TileType[][] = [
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
  ["bloom_mat", "bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat"],
  ["bloom_mat", "bloom_mat", "plain", "plain", "plain", "plain", "wall", "wall", "wall", "wall", "wall", "wall", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat"],
  ["deploy", "plain", "plain", "plain", "plain", "plain", "wall", "hold", "hold", "hold", "hold", "wall", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat"],
  ["deploy", "deploy", "plain", "plain", "plain", "plain", "wall", "hold", "hold", "hold", "hold", "wall", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat"],
  ["deploy", "plain", "plain", "plain", "plain", "plain", "plain", "hold", "hold", "hold", "hold", "wall", "spawn", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat"],
  ["deploy", "deploy", "plain", "plain", "plain", "plain", "wall", "hold", "hold", "hold", "hold", "wall", "spawn", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat"],
  ["deploy", "plain", "plain", "plain", "plain", "plain", "wall", "hold", "hold", "hold", "hold", "wall", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat"],
  ["bloom_mat", "bloom_mat", "plain", "plain", "plain", "plain", "wall", "wall", "wall", "wall", "wall", "wall", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat"],
  ["bloom_mat", "bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat"],
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
];

export const map_house_amaranth_the_long_contract = makeMap(
  "map_house_amaranth_the_long_contract",
  "The Long Contract",
  22,
  11,
  THE_LONG_CONTRACT_TILES
);

// AUTO-GENERATED grid, same discipline as above. Structurally the same
// proven open-field/two-obstacle-cluster/deploy-west-exit-east shape as
// Warden's own "Foraging Party" (mapsAmaranth.ts, Mission 5 -- also that
// campaign's first extract_unit mission), border retextured ridge/scrub
// -> bloom_mat and the rubble/structure obstacle clusters -> bloom_mat
// (thick, uncut crop rows) for House Amaranth's ward-crop-terrace fiction.
// Same "borrow a validated shape for a genuinely analogous beat, not the
// content" discipline maps_house_amaranth.py's own GRIDS comment explains
// for Mission 2 above.
const SECOND_HARVEST_TILES: TileType[][] = [
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
  ["bloom_mat", "bloom_mat", "bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "spawn", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["deploy", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "exit"],
  ["deploy", "deploy", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "exit", "exit"],
  ["deploy", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat", "plain", "plain", "plain", "spawn", "plain", "plain", "plain", "plain", "exit"],
  ["deploy", "deploy", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "exit", "exit"],
  ["deploy", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "exit"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "spawn", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "bloom_mat", "bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat", "bloom_mat"],
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
];

export const map_house_amaranth_second_harvest = makeMap(
  "map_house_amaranth_second_harvest",
  "Second Harvest",
  22,
  13,
  SECOND_HARVEST_TILES
);

// AUTO-GENERATED grid, same discipline as above. A fresh geometry, not a
// borrowed one -- see maps_house_amaranth.py's own GRIDS comment: the
// point of the map is the border-checkpoint road ("=" column) splitting
// House Amaranth's own deploy side from Warden's own patrol ground. The
// fight is still Bloom vs. the lance (one hostile faction, no PvP) --
// the road is fiction/staging for the "wary, correct, unfriendly" first
// contact, not a mechanical barrier.
const GOOD_NEIGHBORS_TILES: TileType[][] = [
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "spawn", "plain", "plain", "plain", "plain", "road", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "road", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "deploy", "deploy", "plain", "plain", "plain", "plain", "plain", "plain", "road", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "deploy", "deploy", "plain", "plain", "plain", "plain", "plain", "plain", "road", "plain", "plain", "plain", "spawn", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "deploy", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "road", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "road", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "road", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "spawn", "plain", "plain", "plain", "plain", "road", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
];

export const map_house_amaranth_good_neighbors = makeMap(
  "map_house_amaranth_good_neighbors",
  "Good Neighbors",
  18,
  10,
  GOOD_NEIGHBORS_TILES
);

// AUTO-GENERATED grid, same discipline as above. Structurally the same
// proven ridge-walled-dais/no-doorway shape as Warden's own "Sporewatch
// Ridge" (mapsAmaranth.ts, Mission 7 -- also a hold_zone), deliberate
// shape variety from this campaign's own Mission 2 (open on all four
// sides, no single doorway). Border scrub -> bloom_mat; ridge kept as
// ridge -- a formal muster dais should read as raised ground, same tile
// family the original already uses it for, not swapped away.
const THE_SEAL_ARRIVES_TILES: TileType[][] = [
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "deploy", "deploy", "deploy", "deploy", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "deploy", "deploy", "deploy", "deploy", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "ridge", "ridge", "ridge", "ridge", "ridge", "ridge", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "ridge", "hold", "hold", "hold", "hold", "ridge", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "ridge", "hold", "hold", "hold", "hold", "ridge", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "ridge", "hold", "hold", "hold", "hold", "ridge", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "ridge", "ridge", "ridge", "ridge", "ridge", "ridge", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "spawn", "spawn", "spawn", "spawn", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
];

export const map_house_amaranth_the_seal_arrives = makeMap(
  "map_house_amaranth_the_seal_arrives",
  "The Seal Arrives",
  20,
  12,
  THE_SEAL_ARRIVES_TILES
);

// AUTO-GENERATED grid, same discipline as above. UNLIKE every other borrowed
// shape in this file, deliberately NOT retextured -- this is meant to read
// as the literal same location as Warden's own "House Colors" (mapsAmaranth.ts,
// Mission 6 -- the SAME checkpoint, the SAME incident, House Amaranth's own
// side of it), so the gate wall and flanking guard structures are kept
// intact rather than swapped to House Amaranth's ward-crop palette. Warden's
// own Mission 10 ("The Amaranth Betrayal") already shows this exact place
// AFTER the withdrawal -- gate wide open, nobody holding it. This mission is
// the withdrawal itself, still held, still fought for.
const HOUSE_COLORS_TILES: TileType[][] = [
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "wall", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "scrub"],
  ["scrub", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "wall", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "scrub"],
  ["scrub", "plain", "plain", "plain", "plain", "plain", "plain", "structure", "structure", "wall", "plain", "structure", "structure", "plain", "plain", "plain", "plain", "plain", "plain", "scrub"],
  ["deploy", "plain", "plain", "plain", "plain", "plain", "plain", "structure", "structure", "wall", "plain", "structure", "structure", "plain", "plain", "spawn", "plain", "plain", "plain", "scrub"],
  ["deploy", "deploy", "road", "road", "road", "road", "road", "road", "road", "road", "road", "road", "road", "road", "road", "road", "road", "spawn", "road", "road"],
  ["deploy", "road", "road", "road", "road", "road", "road", "road", "road", "road", "road", "road", "road", "road", "road", "road", "road", "spawn", "road", "road"],
  ["deploy", "plain", "plain", "plain", "plain", "plain", "plain", "structure", "structure", "wall", "plain", "structure", "structure", "plain", "plain", "spawn", "plain", "plain", "plain", "scrub"],
  ["scrub", "plain", "plain", "plain", "plain", "plain", "plain", "structure", "structure", "wall", "plain", "structure", "structure", "plain", "plain", "plain", "plain", "plain", "plain", "scrub"],
  ["scrub", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "wall", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "scrub"],
  ["scrub", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "wall", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
];
// (This grid was already identical to the generator's own output above --
// the earlier hand-typed version and the AUTO-GENERATED one matched, once
// the script's own ASCII source was corrected to use scrub's actual ","
// character rather than "~" (bloom_mat) for this mission's border. Left
// this note rather than silently pretending the mismatch never happened.)

export const map_house_amaranth_house_colors = makeMap(
  "map_house_amaranth_house_colors",
  "House Colors",
  20,
  12,
  HOUSE_COLORS_TILES
);

// AUTO-GENERATED grid, same discipline as above. No Warden mirror named for
// this mission in the plan doc's own §6 table -- a fresh geometry, not a
// borrowed one: the map's own point is a literal two-tier terrace, not just
// a fiction label over a reused shape. Deploy sits on the established lower
// tier (south); a two-row ridge band splits it from the new upper tier
// (north) the program is only just opening -- ridge tiles are passable, not
// a wall (same elevated-terrain movement-cost tax every other ridge use in
// this file already carries), so the climb is real friction, not a hard
// gate. The new tier is where the drift actually runs hot: two spawn seams
// and the research team's own extraction cluster (4 exit tiles) sit up
// there; two more spawn seams sit at the ridge's own base, under the two
// plain gap-columns left in the ridge band as the readable "ramp" points --
// Bloom that's already crept partway down before the squad even reaches the
// climb, pressure on the approach itself, not just at the top.
const DEEPER_TERRACES_TILES: TileType[][] = [
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "spawn", "plain", "plain", "plain", "plain", "plain", "exit", "exit", "plain", "plain", "plain", "plain", "plain", "spawn", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "exit", "exit", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "ridge", "ridge", "ridge", "plain", "ridge", "ridge", "ridge", "ridge", "ridge", "ridge", "ridge", "ridge", "ridge", "plain", "ridge", "ridge", "ridge", "ridge", "bloom_mat"],
  ["bloom_mat", "ridge", "ridge", "ridge", "plain", "ridge", "ridge", "ridge", "ridge", "ridge", "ridge", "ridge", "ridge", "ridge", "plain", "ridge", "ridge", "ridge", "ridge", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "spawn", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "spawn", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "deploy", "deploy", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "deploy", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "deploy", "deploy", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
];

export const map_house_amaranth_deeper_terraces = makeMap(
  "map_house_amaranth_deeper_terraces",
  "Deeper Terraces",
  20,
  13,
  DEEPER_TERRACES_TILES
);

// AUTO-GENERATED grid, same discipline as above. House Amaranth's own first
// survive_n_turns mission -- a tight, compact watch-post layout, deploy
// dead center, four spawn seams (N/S/E/W) close on every side so the squad
// reads as genuinely surrounded from turn 1. Deliberately applies the real
// lesson campaignAmaranth.ts's own Mission 34/35 comments record having to
// learn the hard way: this engine's AI never moves without a visible
// target, and survive_n_turns has no hold zone to eventually draw the
// squad into, so the pressure has to already be in range from the start --
// built in here rather than discovered by a bad sim run.
const THE_QUIET_GROWTH_TILES: TileType[][] = [
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "spawn", "spawn", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "spawn", "spawn", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "spawn", "spawn", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "deploy", "deploy", "deploy", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "deploy", "deploy", "deploy", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "spawn", "spawn", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
];

export const map_house_amaranth_the_quiet_growth = makeMap(
  "map_house_amaranth_the_quiet_growth",
  "The Quiet Growth",
  16,
  11,
  THE_QUIET_GROWTH_TILES
);

// AUTO-GENERATED grid, same discipline as above. No Warden mirror named for
// this one; a fresh geometry, and a genuinely different hold shape from
// this campaign's own two prior hold_zone maps -- not Long Contract's
// single doorway, not Seal Arrives' open-on-all-sides dais, but a walled
// audit courtyard with TWO gates (north/south). A real tactical shift:
// attention has to split between two chokepoints, not concentrate on one.
// Deploy sits inside the courtyard itself, not approaching it -- the
// squad's already standing post for the tour when the drift shows up.
const LOYALIST_EYES_TILES: TileType[][] = [
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "spawn", "spawn", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "wall", "wall", "wall", "wall", "wall", "wall", "wall", "plain", "plain", "wall", "wall", "wall", "wall", "wall", "wall", "wall", "bloom_mat"],
  ["bloom_mat", "wall", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "wall", "bloom_mat"],
  ["bloom_mat", "wall", "deploy", "deploy", "plain", "plain", "plain", "hold", "hold", "hold", "hold", "plain", "plain", "plain", "plain", "plain", "wall", "bloom_mat"],
  ["bloom_mat", "wall", "deploy", "deploy", "plain", "plain", "plain", "hold", "hold", "hold", "hold", "plain", "plain", "plain", "plain", "plain", "wall", "bloom_mat"],
  ["bloom_mat", "wall", "deploy", "plain", "plain", "plain", "plain", "hold", "hold", "hold", "hold", "plain", "plain", "plain", "plain", "plain", "wall", "bloom_mat"],
  ["bloom_mat", "wall", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "wall", "bloom_mat"],
  ["bloom_mat", "wall", "wall", "wall", "wall", "wall", "wall", "wall", "plain", "plain", "wall", "wall", "wall", "wall", "wall", "wall", "wall", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "spawn", "spawn", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
];

export const map_house_amaranth_loyalist_eyes = makeMap(
  "map_house_amaranth_loyalist_eyes",
  "Loyalist Eyes",
  18,
  13,
  LOYALIST_EYES_TILES
);

// AUTO-GENERATED grid, same discipline as above. Mirrors Warden's own
// Mission 8 mid-boss ("The Choir Sings") -- deliberately reuses that map's
// own proven open-field/ridge-corner shape (mapsAmaranth.ts's own
// THE_CHOIR_SINGS_TILES), border retextured ridge/scrub -> bloom_mat, same
// discipline every other borrowed House Amaranth shape uses. The interior
// bloom_mat crop clusters were already the right tile identity for this
// campaign's own fiction, so they carry over untouched.
const THE_CHOIR_HEARD_FROM_AFAR_TILES: TileType[][] = [
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "spawn", "bloom_mat"],
  ["deploy", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "spawn", "spawn", "plain", "plain", "bloom_mat"],
  ["deploy", "deploy", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "spawn", "spawn", "plain", "plain", "bloom_mat"],
  ["deploy", "deploy", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "spawn", "spawn", "plain", "plain", "bloom_mat"],
  ["deploy", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "spawn", "bloom_mat"],
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
];

export const map_house_amaranth_the_choir_heard_from_afar = makeMap(
  "map_house_amaranth_the_choir_heard_from_afar",
  "The Choir, Heard From Afar",
  22,
  13,
  THE_CHOIR_HEARD_FROM_AFAR_TILES
);

// AUTO-GENERATED grid, same discipline as above. No Warden mirror named for
// this one; a genuinely different extract_unit shape from this campaign's
// own two prior extractions (Second Harvest's open field, Deeper Terraces'
// two-tier ridge climb): a cluttered "growth zone" maze, three separate
// bloom_mat crop-cluster bands (two rows tall each, same precedent Second
// Harvest's own obstacle clusters already set) breaking sightlines across
// the whole width. Two of the four spawn seams sit tucked directly against
// the clusters rather than out in the open -- something can be right next
// to you in this terrain and stay hidden, the actual mechanical reading of
// "the growth zone swallowed her."
const WHAT_THE_TERRACES_COST_TILES: TileType[][] = [
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "spawn", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "spawn", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "bloom_mat", "bloom_mat", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "bloom_mat", "bloom_mat", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["deploy", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "exit", "bloom_mat"],
  ["deploy", "deploy", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "exit", "exit", "bloom_mat"],
  ["deploy", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "exit", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "bloom_mat", "bloom_mat", "plain", "spawn", "plain", "plain", "bloom_mat", "bloom_mat", "plain", "spawn", "plain", "plain", "bloom_mat", "bloom_mat", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "bloom_mat", "bloom_mat", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
];

export const map_house_amaranth_what_the_terraces_cost = makeMap(
  "map_house_amaranth_what_the_terraces_cost",
  "What the Terraces Cost",
  20,
  12,
  WHAT_THE_TERRACES_COST_TILES
);

// AUTO-GENERATED grid, same discipline as above. Mission 12, "Harvest's
// End" (Act I finale). No true walls anywhere on this map -- every other
// hold_zone map so far used a hard chokepoint (Mission 5's ridge behind
// open ground, Mission 9's two blockhouse gates); this one deliberately
// has none, the actual mechanical reading of "the thing that's supposed to
// hold here doesn't." The relay itself sits center as the hold zone (3x4
// H block, same footprint convention as Mission 5's own HHHH x3). Two
// habblock/structure clusters (passable but costly, not impassable) flank
// it and break sightlines without sealing anything off -- deliberately
// nothing to hide behind that also blocks a path, matching "fails under
// real load" rather than "a wall holds." Four spawn seams spread across
// the top band feed the ground wave; the burrowed-ambush and flyer-
// reinforcement waves are pinned coordinates instead (campaignHouseAmaranth.ts's
// own comment on the composition).
const HARVESTS_END_TILES: TileType[][] = [
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "spawn", "plain", "plain", "plain", "plain", "spawn", "plain", "plain", "spawn", "plain", "plain", "plain", "plain", "spawn", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "structure", "structure", "structure", "structure", "plain", "plain", "plain", "plain", "plain", "plain", "structure", "structure", "structure", "structure", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "structure", "structure", "structure", "structure", "plain", "plain", "plain", "plain", "plain", "plain", "structure", "structure", "structure", "structure", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "hold", "hold", "hold", "hold", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "hold", "hold", "hold", "hold", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "hold", "hold", "hold", "hold", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "deploy", "deploy", "deploy", "deploy", "plain", "plain", "plain", "plain", "deploy", "deploy", "deploy", "deploy", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
];

export const map_house_amaranth_harvests_end = makeMap(
  "map_house_amaranth_harvests_end",
  "Harvest's End",
  20,
  13,
  HARVESTS_END_TILES
);

// AUTO-GENERATED grid, same discipline as above. Mission 13, "New
// Terraces, New Faces" (Act II -- The Bargain Holds). First House Amaranth
// map built around a genuinely different enemy-composition shape rather
// than the Crawlmass+Splitfang base most of Act I reached for -- Maxime,
// 31 Aug 2026: "vary between the different enemy unit ... we got 6-7
// enemy unit. so lets vary tjing up." A single 3x6 structure block center-
// map is the new terraces' own freshly-installed point-defense -- fixed
// Gallcyst turrets pinned inside it, Sporethrower support pinned just
// outside (campaignHouseAmaranth.ts's own comment on the composition).
// Gallcyst (data/bloom.ts, sessile, moveRange 0) hadn't appeared anywhere
// in this campaign's first 12 missions before this one -- confirmed by
// grepping every enemyWaves block already shipped, not assumed.
const NEW_TERRACES_NEW_FACES_TILES: TileType[][] = [
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "spawn", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "spawn", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "structure", "structure", "structure", "structure", "structure", "structure", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "structure", "structure", "structure", "structure", "structure", "structure", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "structure", "structure", "structure", "structure", "structure", "structure", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "deploy", "deploy", "deploy", "deploy", "plain", "plain", "plain", "plain", "deploy", "deploy", "deploy", "deploy", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
];

export const map_house_amaranth_new_terraces_new_faces = makeMap(
  "map_house_amaranth_new_terraces_new_faces",
  "New Terraces, New Faces",
  20,
  12,
  NEW_TERRACES_NEW_FACES_TILES
);

// AUTO-GENERATED grid, same discipline as above. Mission 14, "The
// Governor's Patience" (Act II). A checkpoint corridor -- rubble cover
// clusters flank a clear center lane running deploy(west) to exit(east),
// a real choice between the guarded flanks and the exposed middle.
// Undertow pinned at the flank clusters (campaignHouseAmaranth.ts's own
// comment on the composition) -- this campaign's first time using
// Undertow as the PRIMARY threat rather than a small secondary addition.
const THE_GOVERNORS_PATIENCE_TILES: TileType[][] = [
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["deploy", "plain", "plain", "rubble", "rubble", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "rubble", "rubble", "plain", "plain", "exit"],
  ["deploy", "deploy", "plain", "plain", "rubble", "rubble", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "rubble", "rubble", "plain", "plain", "exit", "exit"],
  ["deploy", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "exit"],
  ["deploy", "deploy", "plain", "plain", "rubble", "rubble", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "rubble", "rubble", "plain", "plain", "exit", "exit"],
  ["deploy", "plain", "plain", "rubble", "rubble", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "rubble", "rubble", "plain", "plain", "exit"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "spawn", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "spawn", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
];

export const map_house_amaranth_the_governors_patience = makeMap(
  "map_house_amaranth_the_governors_patience",
  "The Governor's Patience",
  22,
  11,
  THE_GOVERNORS_PATIENCE_TILES
);

// AUTO-GENERATED grid, same discipline as above. Mission 15, "Rootbound"
// (Act II). The hold sits center in open ground with four bloom_mat
// overgrowth clusters at the map's four corners -- the encroachment the
// pitch describes made literal in terrain. Sporethrower pinned inside each
// cluster (campaignHouseAmaranth.ts's own comment on the composition) --
// this campaign's first time using Sporethrower as the PRIMARY threat
// rather than a small secondary addition.
const ROOTBOUND_TILES: TileType[][] = [
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "spawn", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "spawn", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "hold", "hold", "hold", "hold", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "hold", "hold", "hold", "hold", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "hold", "hold", "hold", "hold", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "deploy", "deploy", "deploy", "deploy", "plain", "plain", "plain", "plain", "deploy", "deploy", "deploy", "deploy", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
];

export const map_house_amaranth_rootbound = makeMap(
  "map_house_amaranth_rootbound",
  "Rootbound",
  20,
  14,
  ROOTBOUND_TILES
);

// AUTO-GENERATED grid, same discipline as above. Mission 16, "The Long
// Ledger" (Act II) -- a rival House tries to poach the diversion contract
// by force. First House Amaranth mission fielding hostile mechs at all
// rather than Bloom (campaignHouseAmaranth.ts's own comment on the
// composition). A supply depot straddling a single east-west road, two
// warehouse rows flanking it north and south, deploy centered on the road
// defending the depot itself, spawn seams at both far ends -- a two-
// pronged pincer down the one avenue in, a fresh shape from this
// campaign's now-repeated center-block-plus-corner-spawns pattern.
const THE_LONG_LEDGER_TILES: TileType[][] = [
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "structure", "structure", "structure", "structure", "plain", "plain", "plain", "plain", "structure", "structure", "structure", "structure", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "structure", "structure", "structure", "structure", "plain", "plain", "plain", "plain", "structure", "structure", "structure", "structure", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "spawn", "plain", "road", "road", "road", "road", "road", "road", "road", "road", "road", "road", "road", "road", "road", "road", "road", "road", "plain", "spawn", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "structure", "structure", "structure", "structure", "plain", "plain", "plain", "plain", "structure", "structure", "structure", "structure", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "structure", "structure", "structure", "structure", "plain", "plain", "plain", "plain", "structure", "structure", "structure", "structure", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "deploy", "deploy", "deploy", "deploy", "deploy", "deploy", "deploy", "deploy", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
];

export const map_house_amaranth_the_long_ledger = makeMap(
  "map_house_amaranth_the_long_ledger",
  "The Long Ledger",
  22,
  11,
  THE_LONG_LEDGER_TILES
);

// AUTO-GENERATED grid, same discipline as above. Mission 17, "What Grows
// Beneath" (Act II) -- mirrors Warden's own Mission 17, other side: House
// Amaranth's own survey team finds what Warden will later call the
// Wellroot, and reports -- against Marrow's instinct -- that it's still
// within tolerance. A dig-site trench, not a reuse of Warden's own
// WELLROOT_TILES shape: ridge rims top/bottom with periodic ramp gaps,
// deploy west / exit east across four rows each, spawn seams on both
// ridge shoulders plus one dead-center in the trench floor -- the thing
// being surveyed sits directly in the squad's own path out.
const WHAT_GROWS_BENEATH_TILES: TileType[][] = [
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
  ["bloom_mat", "ridge", "ridge", "ridge", "plain", "ridge", "ridge", "ridge", "ridge", "ridge", "ridge", "plain", "ridge", "ridge", "ridge", "ridge", "ridge", "ridge", "plain", "ridge", "ridge", "ridge", "ridge", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "spawn", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "spawn", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "deploy", "deploy", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "exit", "exit", "bloom_mat"],
  ["bloom_mat", "deploy", "deploy", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "exit", "exit", "bloom_mat"],
  ["bloom_mat", "deploy", "deploy", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "spawn", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "exit", "exit", "bloom_mat"],
  ["bloom_mat", "deploy", "deploy", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "exit", "exit", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "spawn", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "spawn", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "ridge", "ridge", "ridge", "plain", "ridge", "ridge", "ridge", "ridge", "ridge", "ridge", "plain", "ridge", "ridge", "ridge", "ridge", "ridge", "ridge", "plain", "ridge", "ridge", "ridge", "ridge", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
];

export const map_house_amaranth_what_grows_beneath = makeMap(
  "map_house_amaranth_what_grows_beneath",
  "What Grows Beneath",
  24,
  11,
  WHAT_GROWS_BENEATH_TILES
);

// AUTO-GENERATED grid, same discipline as above. Mission 18, "Cultivator's
// Gambit" (Act II) -- `contested_landing`, the same objective type
// Warden's own Mission 15 "Landfall" introduced (mapsAmaranth.ts's own
// LANDFALL_TILES comment: spawn seams close enough to the deploy zone to
// sit well inside a first-turn hostile-phase move+attack, no grace
// period). Landfall itself is a beachhead -- one direction of approach.
// This is a genuinely different shape of the same idea: the containment
// array (and the escorting lance) drops dead center of the hot ground,
// deploy block ringed by spawn seams on all four sides, none more than a
// few tiles from the block's own edge -- a landing surrounded, not a
// landing under fire from one direction. Ten deploy pads match the
// 10-pilot Act II squad exactly, no wraparound needed -- a first for this
// campaign. Rubble and wrecked-structure fragments scattered through the
// open ground read as "still-hot" -- recent fighting already happened
// here.
const CULTIVATORS_GAMBIT_TILES: TileType[][] = [
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "rubble", "rubble", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "structure", "structure", "plain", "plain", "plain", "spawn", "spawn", "plain", "plain", "plain", "plain", "plain", "rubble", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "rubble", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "rubble", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "deploy", "deploy", "deploy", "deploy", "deploy", "plain", "plain", "plain", "spawn", "spawn", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "spawn", "spawn", "plain", "plain", "plain", "deploy", "deploy", "deploy", "deploy", "deploy", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "rubble", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "rubble", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "rubble", "plain", "plain", "plain", "spawn", "spawn", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "rubble", "plain", "plain", "plain", "rubble", "plain", "plain", "structure", "structure", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "rubble", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "rubble", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
];

export const map_house_amaranth_cultivators_gambit = makeMap(
  "map_house_amaranth_cultivators_gambit",
  "Cultivator's Gambit",
  22,
  11,
  CULTIVATORS_GAMBIT_TILES
);

// AUTO-GENERATED grid, same discipline as above. Mission 19, "The Weight
// of the Seal" (Act II) -- Halcyon Amaranth's own first in-person
// appearance anywhere in this campaign, watching a real fight break out
// at an actual forward overlook rather than a rehearsed review (Mission
// 5's seal-holder proxy and Mission 9's hostile auditor were both
// controlled/managed situations; this one isn't). A compact 3x4 hold
// block flanked by ridge north and south, deploy hugging the west edge.
// Gallcyst (sessile) dug in on the hold block's own WEST flank, between
// deploy and the zone -- moved here after a first-pass sim found an
// east-flank placement permanently out of its own attackRange 3 (the
// squad always clusters on the hold tile nearest deploy, since hold_zone
// only requires ONE tile occupied; see campaignHouseAmaranth.ts's own
// comment for the traced first-pass result). Splitfang seams north and
// south of the overlook for fast harassment converging from above and
// below rather than head-on.
const THE_WEIGHT_OF_THE_SEAL_TILES: TileType[][] = [
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "spawn", "spawn", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "ridge", "ridge", "ridge", "ridge", "ridge", "ridge", "plain", "plain", "plain", "rubble", "plain", "bloom_mat"],
  ["bloom_mat", "deploy", "deploy", "plain", "plain", "plain", "plain", "rubble", "plain", "spawn", "plain", "hold", "hold", "hold", "hold", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "deploy", "deploy", "plain", "plain", "plain", "plain", "plain", "plain", "spawn", "plain", "hold", "hold", "hold", "hold", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "deploy", "deploy", "plain", "plain", "plain", "plain", "plain", "plain", "spawn", "plain", "hold", "hold", "hold", "hold", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "deploy", "deploy", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "ridge", "ridge", "ridge", "ridge", "ridge", "ridge", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "rubble", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "rubble", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "rubble", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "spawn", "spawn", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "bloom_mat"],
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
];

export const map_house_amaranth_the_weight_of_the_seal = makeMap(
  "map_house_amaranth_the_weight_of_the_seal",
  "The Weight of the Seal",
  22,
  11,
  THE_WEIGHT_OF_THE_SEAL_TILES
);

// AUTO-GENERATED grid, same discipline as above. Mission 20, "Marrow's
// Line" (Act II close) -- the shared convergence Warden Company fights as
// eliminate_all in mapsAmaranth.ts's own MARROWS_LINE_TILES, played from
// House Amaranth's side per the campaign plan's Section 5: a separate
// map/mission entry rather than a reuse of Warden's data, since deploy
// zones, composition and the objective differ by side even though the
// battlefield and beat are conceptually the same. House Amaranth (led by
// pilot_marrow) deploys west (12 pads); the exit sits far east, a full
// traversal away rather than adjacent to deploy -- a first draft of this
// map put the exit right next to deploy and the sim never engaged the
// enemy at all (100% win regardless of enemy count, since Marrow could
// just walk out). The Warden Company mirror force
// (WARDEN_HOSTILE_MECHS/WARDEN_RIVAL_MECHS in units.ts) spawns as a
// north/south flanking pincer partway down the lane plus a center blocker
// two-thirds of the way to the exit -- Rourke herself, "closing a line"
// per the briefing, positioned to actually contest the extraction route
// rather than sit behind it. Objective is extract_unit, not
// eliminate_all -- a disciplined disengagement rather than a rout. Broken
// ridge/rubble bands north and south of an open middle lane channel the
// fight into the same lane the exit sits on rather than letting it be
// skirted.
const HOUSE_AMARANTH_MARROWS_LINE_TILES: TileType[][] = [
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
  ["bloom_mat", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "scrub", "scrub", "scrub", "ridge", "ridge", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "bloom_mat"],
  ["bloom_mat", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "scrub", "spawn", "scrub", "ridge", "ridge", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "bloom_mat"],
  ["bloom_mat", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "scrub", "scrub", "scrub", "ridge", "ridge", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "bloom_mat"],
  ["bloom_mat", "scrub", "deploy", "deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "exit", "exit", "scrub", "scrub", "bloom_mat"],
  ["bloom_mat", "scrub", "deploy", "deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "scrub", "scrub", "scrub", "exit", "exit", "scrub", "scrub", "bloom_mat"],
  ["bloom_mat", "scrub", "deploy", "deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "exit", "exit", "scrub", "scrub", "bloom_mat"],
  ["bloom_mat", "scrub", "deploy", "deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "exit", "exit", "scrub", "scrub", "bloom_mat"],
  ["bloom_mat", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "scrub", "scrub", "scrub", "ridge", "ridge", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "bloom_mat"],
  ["bloom_mat", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "scrub", "spawn", "scrub", "ridge", "ridge", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "bloom_mat"],
  ["bloom_mat", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "scrub", "scrub", "scrub", "ridge", "ridge", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "bloom_mat"],
  ["bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat", "bloom_mat"],
];

export const map_house_amaranth_marrows_line = makeMap(
  "map_house_amaranth_marrows_line",
  "Marrow's Line",
  24,
  12,
  HOUSE_AMARANTH_MARROWS_LINE_TILES
);

// AUTO-GENERATED grid, same discipline as above. Act III opener -- the
// SAME disputed ground Marrow's Line (Mission 20) was fought over, scrub/
// rubble, not this campaign's usual bloom_mat ward-crop-terrace fiction --
// once both militaries pull back from a line, the Bloom moves into the
// wreckage they left behind. The center rubble block (cols 9-12) IS that
// wreckage; the spawn seams tucked at its west/east edges are an Undertow
// burrow point, same "pinned at the flank clusters" precedent Missions
// 12/14 already established.
const AFTER_THE_LINE_TILES: TileType[][] = [
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "spawn", "scrub"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "rubble", "rubble", "rubble", "rubble", "spawn", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "rubble", "rubble", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "rubble", "rubble", "rubble", "rubble", "spawn", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "spawn", "scrub"],
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
];

export const map_house_amaranth_after_the_line = makeMap(
  "map_house_amaranth_after_the_line",
  "After the Line",
  20,
  11,
  AFTER_THE_LINE_TILES
);

const AUDIT_UNDER_FIRE_TILES: TileType[][] = [
  ["wall", "wall", "wall", "wall", "wall", "wall", "wall", "wall", "wall", "wall", "wall", "wall", "wall", "wall", "wall", "wall", "wall", "wall", "wall", "wall"],
  ["wall", "sump", "sump", "sump", "sump", "sump", "sump", "sump", "sump", "sump", "sump", "sump", "sump", "sump", "deploy", "deploy", "plain", "plain", "plain", "wall"],
  ["wall", "plain", "spawn", "plain", "plain", "plain", "plain", "spawn", "plain", "plain", "plain", "plain", "spawn", "plain", "deploy", "deploy", "dock", "dock", "dock", "wall"],
  ["wall", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "deploy", "deploy", "dock", "dock", "dock", "wall"],
  ["wall", "sump", "sump", "sump", "sump", "sump", "sump", "sump", "sump", "sump", "sump", "sump", "sump", "sump", "deploy", "deploy", "dock", "dock", "dock", "wall"],
  ["wall", "sump", "sump", "sump", "sump", "sump", "sump", "sump", "sump", "sump", "sump", "sump", "sump", "sump", "deploy", "deploy", "dock", "dock", "dock", "wall"],
  ["wall", "sump", "sump", "sump", "sump", "sump", "sump", "sump", "sump", "sump", "sump", "sump", "sump", "sump", "deploy", "deploy", "dock", "dock", "dock", "wall"],
  ["wall", "plain", "spawn", "plain", "plain", "plain", "plain", "spawn", "plain", "plain", "plain", "plain", "spawn", "plain", "deploy", "deploy", "dock", "dock", "dock", "wall"],
  ["wall", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "deploy", "deploy", "dock", "dock", "dock", "wall"],
  ["wall", "sump", "sump", "sump", "sump", "sump", "sump", "sump", "sump", "sump", "sump", "sump", "sump", "sump", "deploy", "deploy", "plain", "plain", "plain", "wall"],
  ["wall", "wall", "wall", "wall", "wall", "wall", "wall", "wall", "wall", "wall", "wall", "wall", "wall", "wall", "wall", "wall", "wall", "wall", "wall", "wall"],
];

export const map_house_amaranth_audit_under_fire = makeMap(
  "map_house_amaranth_audit_under_fire",
  "Audit Under Fire",
  20,
  11,
  AUDIT_UNDER_FIRE_TILES
);

const THE_ROOT_ANSWERS_BACK_TILES: TileType[][] = [
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "spawn", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "ridge", "ridge", "ridge", "ridge", "scrub", "scrub", "scrub", "scrub", "scrub", "rubble", "scrub", "scrub", "scrub", "scrub"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "scrub", "hold", "hold", "hold", "hold", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "hold", "hold", "hold", "hold", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "scrub", "hold", "hold", "hold", "hold", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "ridge", "ridge", "ridge", "ridge", "scrub", "scrub", "scrub", "scrub", "scrub", "rubble", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "spawn", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
];

export const map_house_amaranth_the_root_answers_back = makeMap(
  "map_house_amaranth_the_root_answers_back",
  "The Root Answers Back",
  22,
  11,
  THE_ROOT_ANSWERS_BACK_TILES
);

const SEIZURE_ORDER_TILES: TileType[][] = [
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "spawn", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "exit", "exit"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "exit", "exit"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "exit", "exit"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "exit", "exit"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "spawn", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
];

export const map_house_amaranth_seizure_order = makeMap(
  "map_house_amaranth_seizure_order",
  "Seizure Order",
  22,
  11,
  SEIZURE_ORDER_TILES
);

const GOING_DARK_TILES: TileType[][] = [
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "spawn", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "ridge", "ridge", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "ridge", "ridge", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["spawn", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["spawn", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "spawn", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
];

export const map_house_amaranth_going_dark = makeMap(
  "map_house_amaranth_going_dark",
  "Going Dark",
  20,
  11,
  GOING_DARK_TILES
);

const THE_BRAMBLE_TILES: TileType[][] = [
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
  ["scrub", "scrub", "scrub", "scrub", "bloom_mat", "bloom_mat", "bloom_mat", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "spawn", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "bloom_mat", "bloom_mat", "bloom_mat", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "bloom_mat", "bloom_mat", "bloom_mat", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "bloom_mat", "bloom_mat", "bloom_mat", "scrub", "scrub", "scrub", "scrub"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "bloom_mat", "bloom_mat", "bloom_mat", "scrub", "scrub", "scrub", "scrub"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "bloom_mat", "bloom_mat", "bloom_mat", "scrub", "scrub", "scrub", "scrub"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "bloom_mat", "bloom_mat", "bloom_mat", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "bloom_mat", "bloom_mat", "bloom_mat", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "bloom_mat", "bloom_mat", "bloom_mat", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "bloom_mat", "bloom_mat", "bloom_mat", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "spawn", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
];

export const map_house_amaranth_the_bramble = makeMap(
  "map_house_amaranth_the_bramble",
  "The Bramble",
  22,
  11,
  THE_BRAMBLE_TILES
);

const SALVAGE_THE_SEASON_TILES: TileType[][] = [
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "spawn", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "bloom_mat", "bloom_mat", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "exit", "exit", "exit", "exit"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "exit", "exit", "exit", "exit"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "bloom_mat", "bloom_mat", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "exit", "exit", "exit", "exit"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "exit", "exit", "exit", "exit"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "spawn", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
];

export const map_house_amaranth_salvage_the_season = makeMap(
  "map_house_amaranth_salvage_the_season",
  "Salvage the Season",
  24,
  11,
  SALVAGE_THE_SEASON_TILES
);

const MARROWS_CHOICE_TILES: TileType[][] = [
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "scrub", "scrub", "ridge", "ridge", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "spawn"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "scrub", "spawn", "scrub", "ridge", "ridge", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "scrub", "scrub", "ridge", "ridge", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["deploy", "deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["deploy", "deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["deploy", "deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["deploy", "deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "scrub", "scrub", "ridge", "ridge", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "scrub", "spawn", "scrub", "ridge", "ridge", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "scrub", "scrub", "ridge", "ridge", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "spawn"],
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
];

export const map_house_amaranth_marrows_choice = makeMap(
  "map_house_amaranth_marrows_choice",
  "Marrow's Choice",
  26,
  12,
  MARROWS_CHOICE_TILES
);

const THE_GOVERNORS_ANSWER_TILES: TileType[][] = [
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "spawn", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "ridge", "ridge", "ridge", "ridge", "scrub", "scrub", "scrub", "scrub", "scrub", "rubble", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "scrub", "hold", "hold", "hold", "hold", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "spawn"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "hold", "hold", "hold", "hold", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "scrub", "hold", "hold", "hold", "hold", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "spawn"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "ridge", "ridge", "ridge", "ridge", "scrub", "scrub", "scrub", "scrub", "scrub", "rubble", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "spawn", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
];

export const map_house_amaranth_the_governors_answer = makeMap(
  "map_house_amaranth_the_governors_answer",
  "The Governor's Answer",
  24,
  11,
  THE_GOVERNORS_ANSWER_TILES
);

const TWO_FRONTS_TILES: TileType[][] = [
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
  ["scrub", "scrub", "bloom_mat", "bloom_mat", "bloom_mat", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "rubble", "scrub", "scrub"],
  ["spawn", "spawn", "bloom_mat", "bloom_mat", "bloom_mat", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "rubble", "spawn", "spawn"],
  ["scrub", "scrub", "bloom_mat", "bloom_mat", "bloom_mat", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "rubble", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "deploy", "deploy", "deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "deploy", "deploy", "deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "deploy", "deploy", "deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "bloom_mat", "bloom_mat", "bloom_mat", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "rubble", "scrub", "scrub"],
  ["spawn", "spawn", "bloom_mat", "bloom_mat", "bloom_mat", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "rubble", "spawn", "spawn"],
  ["scrub", "scrub", "bloom_mat", "bloom_mat", "bloom_mat", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "rubble", "scrub", "scrub"],
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
];

export const map_house_amaranth_two_fronts = makeMap(
  "map_house_amaranth_two_fronts",
  "Two Fronts",
  24,
  11,
  TWO_FRONTS_TILES
);

const WHAT_THE_PROGRAM_COSTS_TILES: TileType[][] = [
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "spawn", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "bloom_mat", "bloom_mat", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "exit", "exit", "exit", "exit"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "scrub", "scrub", "scrub", "scrub", "bloom_mat", "bloom_mat", "scrub", "scrub", "scrub", "scrub", "scrub", "exit", "exit", "exit", "exit"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "bloom_mat", "bloom_mat", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "exit", "exit", "exit", "exit"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "exit", "exit", "exit", "exit"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "spawn", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
];

export const map_house_amaranth_what_the_program_costs = makeMap(
  "map_house_amaranth_what_the_program_costs",
  "What the Program Costs",
  26,
  11,
  WHAT_THE_PROGRAM_COSTS_TILES
);

const HOLD_THE_ROOT_TILES: TileType[][] = [
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "spawn", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "bloom_mat", "bloom_mat", "scrub", "scrub", "scrub", "scrub", "bloom_mat", "bloom_mat", "scrub", "scrub", "bloom_mat", "bloom_mat", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "bloom_mat", "bloom_mat", "scrub", "scrub", "scrub", "scrub", "bloom_mat", "bloom_mat", "scrub", "scrub", "bloom_mat", "bloom_mat", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "dock", "dock", "dock", "dock", "scrub", "scrub", "bloom_mat", "bloom_mat", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "dock", "dock", "dock", "dock", "scrub", "scrub", "bloom_mat", "bloom_mat", "scrub", "scrub", "scrub", "scrub", "spawn", "scrub"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "dock", "dock", "dock", "dock", "scrub", "scrub", "bloom_mat", "bloom_mat", "scrub", "scrub", "scrub", "scrub", "spawn", "scrub"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "dock", "dock", "dock", "dock", "scrub", "scrub", "bloom_mat", "bloom_mat", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "bloom_mat", "bloom_mat", "scrub", "scrub", "scrub", "scrub", "bloom_mat", "bloom_mat", "scrub", "scrub", "bloom_mat", "bloom_mat", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "bloom_mat", "bloom_mat", "scrub", "scrub", "scrub", "scrub", "bloom_mat", "bloom_mat", "scrub", "scrub", "bloom_mat", "bloom_mat", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "spawn", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
];

export const map_house_amaranth_hold_the_root = makeMap(
  "map_house_amaranth_hold_the_root",
  "Hold the Root",
  24,
  13,
  HOLD_THE_ROOT_TILES
);

const THE_INNERMOST_TERRACE_TILES: TileType[][] = [
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "spawn", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "ridge", "ridge", "ridge", "ridge", "ridge", "ridge", "scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "ridge", "ridge", "ridge", "ridge", "ridge", "ridge", "scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "hold", "hold", "hold", "hold", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "hold", "hold", "hold", "hold", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "scrub"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "hold", "hold", "hold", "hold", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "scrub"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "hold", "hold", "hold", "hold", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "ridge", "ridge", "ridge", "ridge", "ridge", "ridge", "scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "ridge", "ridge", "spawn", "spawn", "ridge", "ridge", "scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "scrub", "scrub", "scrub", "scrub"],
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
];

export const map_house_amaranth_the_innermost_terrace = makeMap(
  "map_house_amaranth_the_innermost_terrace",
  "The Innermost Terrace",
  26,
  13,
  THE_INNERMOST_TERRACE_TILES
);

const NO_WORD_FROM_THE_SEAL_TILES: TileType[][] = [
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "spawn", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "spawn", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "ridge", "ridge", "ridge", "ridge", "ridge", "ridge", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "ridge", "ridge", "ridge", "ridge", "ridge", "ridge", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "scrub", "scrub", "scrub", "scrub", "deploy", "deploy", "deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "spawn", "scrub", "scrub", "rubble", "rubble", "scrub", "scrub", "scrub", "scrub", "deploy", "deploy", "deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "scrub", "scrub", "spawn", "scrub"],
  ["scrub", "spawn", "scrub", "scrub", "rubble", "rubble", "scrub", "scrub", "scrub", "scrub", "deploy", "deploy", "deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "scrub", "scrub", "spawn", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "scrub", "scrub", "scrub", "scrub", "deploy", "deploy", "deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "ridge", "ridge", "ridge", "ridge", "ridge", "ridge", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "spawn", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "ridge", "ridge", "ridge", "ridge", "ridge", "ridge", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "spawn", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
];

export const map_house_amaranth_no_word_from_the_seal = makeMap(
  "map_house_amaranth_no_word_from_the_seal",
  "No Word From the Seal",
  24,
  13,
  NO_WORD_FROM_THE_SEAL_TILES
);

const THE_ROOT_TURNS_TILES: TileType[][] = [
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "spawn", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "bloom_mat", "bloom_mat", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "ridge", "ridge", "ridge", "ridge", "ridge", "ridge", "scrub", "scrub", "scrub", "bloom_mat", "bloom_mat", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "ridge", "ridge", "ridge", "ridge", "ridge", "ridge", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "hold", "hold", "hold", "hold", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "hold", "hold", "hold", "hold", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "scrub"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "hold", "hold", "hold", "hold", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "scrub"],
  ["deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "hold", "hold", "hold", "hold", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "ridge", "ridge", "ridge", "ridge", "ridge", "ridge", "scrub", "scrub", "scrub", "bloom_mat", "bloom_mat", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "ridge", "ridge", "ridge", "ridge", "ridge", "ridge", "scrub", "scrub", "scrub", "bloom_mat", "bloom_mat", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "spawn", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
];

export const map_house_amaranth_the_root_turns = makeMap(
  "map_house_amaranth_the_root_turns",
  "The Root Turns",
  24,
  13,
  THE_ROOT_TURNS_TILES
);

const STALLING_SEASON_ENDS_TILES: TileType[][] = [
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "spawn", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "spawn", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "ridge", "ridge", "ridge", "ridge", "ridge", "ridge", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "ridge", "ridge", "ridge", "ridge", "ridge", "ridge", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "scrub", "scrub", "scrub", "scrub", "scrub", "deploy", "deploy", "deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "spawn", "scrub", "scrub", "rubble", "rubble", "scrub", "scrub", "scrub", "scrub", "scrub", "deploy", "deploy", "deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "scrub", "scrub", "spawn", "scrub"],
  ["scrub", "spawn", "scrub", "scrub", "rubble", "rubble", "scrub", "scrub", "scrub", "scrub", "scrub", "deploy", "deploy", "deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "scrub", "scrub", "spawn", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "scrub", "scrub", "scrub", "scrub", "scrub", "deploy", "deploy", "deploy", "deploy", "scrub", "scrub", "scrub", "scrub", "scrub", "rubble", "rubble", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "ridge", "ridge", "ridge", "ridge", "ridge", "ridge", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["scrub", "scrub", "spawn", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "ridge", "ridge", "ridge", "ridge", "ridge", "ridge", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "scrub", "scrub"],
  ["scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "spawn", "spawn", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub", "scrub"],
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"],
];

export const map_house_amaranth_the_stalling_season_ends = makeMap(
  "map_house_amaranth_the_stalling_season_ends",
  "The Stalling Season Ends",
  26,
  13,
  STALLING_SEASON_ENDS_TILES
);

export const MAPS_HOUSE_AMARANTH: Record<string, MapDefinition> = {
  map_house_amaranth_first_harvest,
  map_house_amaranth_the_long_contract,
  map_house_amaranth_second_harvest,
  map_house_amaranth_good_neighbors,
  map_house_amaranth_the_seal_arrives,
  map_house_amaranth_house_colors,
  map_house_amaranth_deeper_terraces,
  map_house_amaranth_the_quiet_growth,
  map_house_amaranth_loyalist_eyes,
  map_house_amaranth_the_choir_heard_from_afar,
  map_house_amaranth_what_the_terraces_cost,
  map_house_amaranth_harvests_end,
  map_house_amaranth_new_terraces_new_faces,
  map_house_amaranth_the_governors_patience,
  map_house_amaranth_rootbound,
  map_house_amaranth_the_long_ledger,
  map_house_amaranth_what_grows_beneath,
  map_house_amaranth_cultivators_gambit,
  map_house_amaranth_the_weight_of_the_seal,
  map_house_amaranth_marrows_line,
  map_house_amaranth_after_the_line,
  map_house_amaranth_audit_under_fire,
  map_house_amaranth_the_root_answers_back,
  map_house_amaranth_seizure_order,
  map_house_amaranth_going_dark,
  map_house_amaranth_the_bramble,
  map_house_amaranth_salvage_the_season,
  map_house_amaranth_marrows_choice,
  map_house_amaranth_the_governors_answer,
  map_house_amaranth_two_fronts,
  map_house_amaranth_what_the_program_costs,
  map_house_amaranth_hold_the_root,
  map_house_amaranth_the_innermost_terrace,
  map_house_amaranth_no_word_from_the_seal,
  map_house_amaranth_the_root_turns,
  map_house_amaranth_the_stalling_season_ends,
};
