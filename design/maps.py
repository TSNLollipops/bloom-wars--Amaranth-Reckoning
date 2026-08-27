#!/usr/bin/env python3
"""
Bloom Wars -- maps.py

RECONSTRUCTION NOTE (27 Aug 2026): the original maps.py -- the script that
produced maps_output.txt and maps_generated.ts on 21 Aug 2026 -- was never
actually committed into this repo's own /design folder, despite this
project's README.md documenting exactly that as the convention. Same story
as combat_sim.py, which was rebuilt earlier the same day. Only the script's
two *outputs* survived, as project docs. The script itself was gone.

This file is a from-scratch rebuild. The ASCII grids below were transcribed
by hand from maps_output.txt's own RENDERED MAPS section, then cross-checked
against src/data/maps.ts's tile grids -- a second, independent artifact of
the original script (maps.ts's own header says its grids came verbatim from
maps_generated.ts). Both agreed, character for character, on all four maps.
That is why the grids below can be trusted as the real source of truth and
not just a plausible-looking transcription.

Everything the script computes is then re-checked against maps_output.txt's
own recorded numbers in the RECONSTRUCTION CHECK section at the bottom of
the output. If any of those checks fail, this rebuild has a bug and nothing
it prints should be believed.

WHAT THIS SCRIPT IS FOR (plain language, per project convention):
The ASCII grids near the top are the maps. One letter = one tile. Editing a
map means editing those letters and re-running this script -- never editing
the TypeScript by hand. The script re-checks that the map is still a legal,
playable map (right shape, real tiles, enough deploy pads, nothing walled
off) and then rewrites the TypeScript for you.

Run: python3 maps.py
Writes: maps_generated.ts, maps_ascii.json  (nothing else, no network)
"""

import json
import os
import sys
from collections import deque

# =====================================================================
# THE MAPS -- this is the source of truth. Edit the letters, re-run.
# =====================================================================
# Legend (see TILES below for the full table):
#   .  plain / ferrocrete      %  rubble           P  deploy pad
#   =  road                    #  structure        E  enemy spawn seam
#   ,  open scrub              ~  Bloom mat        H  hold zone
#   ^  ridge (elevated)        B  blockhouse wall  X  extraction tile
#   w  water / sump            D  dock perimeter

CITY_SWEEP = [
    ",,,..##..%%..^^^^^",
    ",,,..##..%%...^^^^",
    ",,....##....~~..^^",
    "..==============..",
    "P.==##....%%==..~~",
    "PP==##....%%==.~~~",
    "P.==........==..~~",
    "PP==##..%%%%==..~E",
    "P.==##..%%%%==...E",
    "..==============..",
    ",,....##....~~~..,",
    ",,,...##...~~~~..E",
]

BUNKER = [
    "^^^^....%%%%....^^",
    "^^^.....%%%.....^^",
    "..................",
    "P.%%..BBB.BB..%%..",
    "P.%%..BHHHHB..%%..",
    "PP....BHHHHB....~E",
    "PP....BHHHHB....~E",
    "..%%..BBB.BB..%%..",
    "..%%....==....%%..",
    "..................",
    "~~~~..%%%%%%..~~~~",
    "E~~~..%%%%%%..~~~E",
]

ATTRITION = [
    ",,,,......====......",
    ",,,,......====......",
    "..%%%%....====....%%",
    "..%%%%....====....%%",
    "PP........====......",
    "PP..##....====....##",
    "PP..##....====....##",
    "..........====......",
    "..~~~~....====....~~",
    "..~~~~....====....~~",
    "^^^~~~........~~~^^^",
    "^^^~~E........E~~^^^",
]

SESSILE_TOMB = [
    "^^^^^^~~~~~~~~^^^^^^",
    "^^^^^~~~~~~~~~~^^^^^",
    "^^^..~~~~~~~~~~..^^^",
    "PP...~~%%%%%%~~...XX",
    "PP...~~%#EE#%~~...XX",
    "PP..~~~%#EE#%~~~..XX",
    "....~~~%#EE#%~~~....",
    "..~~~~~%%%%%%~~~~~..",
    "..~~~~~~~~~~~~~~~~..",
    "^^..~~~~~~~~~~~~..^^",
    "^^^..~~E~~~~E~~..^^^",
    "^^^^^..~~~~~~..^^^^^",
]

# id, display name, TypeScript const name, grid.
# The TS const names match what src/data/maps.ts already calls them, so the
# emitted file drops straight in without renaming anything.
MAPS = [
    ("map_city_sweep_01", "The City Sweep",   "CITY_SWEEP_TILES",   CITY_SWEEP),
    ("map_bunker_01",     "The Bunker",       "BUNKER_TILES",       BUNKER),
    ("map_attrition_01",  "The Real Fight",   "ATTRITION_TILES",    ATTRITION),
    ("map_sessile_tomb",  "The Sessile Tomb", "SESSILE_TOMB_TILES", SESSILE_TOMB),
]

# =====================================================================
# TILE TABLE -- transcribed 1:1 from maps_output.txt's own legend, then
# reconciled against the live src/data/tiles.ts. Two deliberate deltas
# are recorded in NOTES at the bottom of this file's output rather than
# silently smoothed over.
# =====================================================================
IMPASSABLE = None  # printed as "-"; means ground units cannot enter at all

# char: (tile id, display name, bipedal, centauroid, flying, defence stars)
TILES = {
    ".": ("plain",     "Plain / ferrocrete",  1, 1, 1, 1),
    "=": ("road",      "Road / rail spine",   1, 1, 1, 0),
    ",": ("scrub",     "Open scrub",          1, 1, 1, 0),
    "%": ("rubble",    "Rubble",              2, 3, 1, 2),
    "#": ("structure", "Structure / habblock", 1, 2, 1, 3),
    "~": ("bloom_mat", "Bloom mat",           2, 2, 1, 1),
    "^": ("ridge",     "Ridge / elevated",    2, 3, 1, 4),
    "w": ("sump",      "Water / sump",        IMPASSABLE, IMPASSABLE, 1, 0),
    "P": ("deploy",    "Deploy pad (player)", 1, 1, 1, 1),
    "E": ("spawn",     "Bloom spawn seam",    1, 1, 1, 0),
    "X": ("exit",      "Extraction tile",     1, 1, 1, 1),
    "H": ("hold",      "Hold-zone tile",      1, 1, 1, 2),
    "B": ("wall",      "Blockhouse wall",     IMPASSABLE, IMPASSABLE, 99, 0),
    # Added 25 Aug 2026 for Mission 22 "Ash on the Water" (Protect Asset).
    # Present in src/data/tiles.ts; no Team One map uses it, so it never
    # appeared in the original maps_output.txt legend. Listed here so a
    # future map that uses it validates instead of being rejected as an
    # unknown character.
    "D": ("dock",      "Dock perimeter",      1, 1, 1, 2),
}

# Tiles that are objectives -- something on the map a squad has to be able
# to physically reach on foot, or the map is broken.
OBJECTIVE_TILES = {"spawn", "exit", "hold", "dock"}

# Gates. The original's exact deploy threshold isn't recorded anywhere in
# its surviving output, so this is a reconstruction assumption, stated out
# loud rather than hidden: a map needs room to land a full squad.
MIN_DEPLOY_PADS = 4
MIN_SPAWN_SEAMS = 1

# =====================================================================
# Output plumbing
# =====================================================================
lines = []


def out(s=""):
    lines.append(s)


def hdr(title):
    out("=" * 78)
    out(title)
    out("=" * 78)


def cost_str(c):
    return "-" if c is IMPASSABLE else str(c)


def passable_ground(tile_id):
    """True if a ground unit (either chassis) can enter this tile at all.

    Bipedal and centauroid are blocked by exactly the same tiles -- wall and
    sump -- so one passability set covers both. If that ever stops being
    true, this function is the single place to split it.
    """
    for ch, (tid, _n, bip, cent, _fly, _d) in TILES.items():
        if tid == tile_id:
            return bip is not IMPASSABLE and cent is not IMPASSABLE
    raise KeyError(tile_id)


def to_tiles(grid):
    return [[TILES[ch][0] for ch in row] for row in grid]


# =====================================================================
# Validation
# =====================================================================
def validate(map_id, name, grid):
    """Returns (ok, stats, problems). Never raises on a bad map -- a broken
    map should produce a readable complaint, not a stack trace."""
    problems = []

    # 1. Rectangular.
    widths = sorted({len(r) for r in grid})
    if len(widths) != 1:
        for y, row in enumerate(grid):
            if len(row) != len(grid[0]):
                problems.append(
                    f"row {y} is {len(row)} wide, but row 0 is {len(grid[0])} wide"
                )
    w = len(grid[0])
    h = len(grid)

    # 2. Every character is a real tile.
    for y, row in enumerate(grid):
        for x, ch in enumerate(row):
            if ch not in TILES:
                problems.append(f"({x},{y}) is '{ch}', which is not a tile")

    if problems:
        # Bail out before the tile-level checks -- a ragged or
        # unknown-character grid can't be meaningfully counted. Still return
        # a fully-populated stats dict, because the summary table prints
        # every map including the broken ones, and a validator that crashes
        # instead of complaining is worse than no validator at all. (This
        # exact crash was a real bug in this rebuild, caught 27 Aug 2026 by
        # deliberately feeding the script a broken map.)
        return (
            False,
            {
                "w": w,
                "h": h,
                "tiles": "?",
                "P": "?",
                "E": "?",
                "H": "?",
                "X": "?",
                "D": "?",
                "counts": {},
                "reachable": "?",
                "walkable": "?",
                "orphan_walkable": "?",
            },
            problems,
        )

    tiles = to_tiles(grid)
    counts = {}
    for row in tiles:
        for t in row:
            counts[t] = counts.get(t, 0) + 1

    n_deploy = counts.get("deploy", 0)
    n_spawn = counts.get("spawn", 0)

    # 3. Enough deploy pads, and somewhere for the Bloom to come from.
    if n_deploy < MIN_DEPLOY_PADS:
        problems.append(
            f"only {n_deploy} deploy pad(s); a squad needs at least {MIN_DEPLOY_PADS}"
        )
    if n_spawn < MIN_SPAWN_SEAMS:
        problems.append(f"no Bloom spawn seam (need at least {MIN_SPAWN_SEAMS})")

    # 4. Reachability -- the check that actually earns its keep. Flood-fill
    #    on foot from every deploy pad and confirm each objective tile can
    #    be walked to. It is very easy to draw a map that looks fine and
    #    has an objective sealed behind a wall.
    start = [(x, y) for y in range(h) for x in range(w) if tiles[y][x] == "deploy"]
    seen = set()
    q = deque(start)
    seen.update(start)
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in seen:
                if passable_ground(tiles[ny][nx]):
                    seen.add((nx, ny))
                    q.append((nx, ny))

    unreachable_objectives = []
    for y in range(h):
        for x in range(w):
            t = tiles[y][x]
            if t in OBJECTIVE_TILES and (x, y) not in seen:
                unreachable_objectives.append((x, y, t))
    for x, y, t in unreachable_objectives:
        problems.append(f"objective tile '{t}' at ({x},{y}) cannot be walked to")

    # Informational: walkable ground that no deploy pad can reach. Not a
    # failure -- a decorative pocket is legal -- but worth seeing.
    walkable_total = sum(
        1 for y in range(h) for x in range(w) if passable_ground(tiles[y][x])
    )
    stats = {
        "w": w,
        "h": h,
        "tiles": w * h,
        "P": n_deploy,
        "E": n_spawn,
        "H": counts.get("hold", 0),
        "X": counts.get("exit", 0),
        "D": counts.get("dock", 0),
        "counts": counts,
        "reachable": len(seen),
        "walkable": walkable_total,
        "orphan_walkable": walkable_total - len(seen),
    }
    return not problems, stats, problems


# =====================================================================
# Run validation
# =====================================================================
results = []
all_ok = True
for map_id, name, const, grid in MAPS:
    ok, stats, problems = validate(map_id, name, grid)
    all_ok = all_ok and ok
    results.append((map_id, name, const, grid, ok, stats, problems))

hdr("MAP VALIDATION")
out(
    "id".ljust(20)
    + "name".ljust(21)
    + "w".rjust(2)
    + "h".rjust(4)
    + "tiles".rjust(7)
    + "P".rjust(4)
    + "E".rjust(4)
    + "H".rjust(4)
    + "X".rjust(4)
)
for map_id, name, _const, _grid, ok, s, _p in results:
    out(
        map_id.ljust(20)
        + name.ljust(21)
        + str(s["w"]).rjust(2)
        + str(s["h"]).rjust(4)
        + str(s["tiles"]).rjust(7)
        + str(s["P"]).rjust(4)
        + str(s["E"]).rjust(4)
        + str(s["H"]).rjust(4)
        + str(s["X"]).rjust(4)
    )

if not all_ok:
    out()
    out("PROBLEMS FOUND:")
    for map_id, _n, _c, _g, ok, _s, problems in results:
        for p in problems:
            out(f"  {map_id}: {p}")

out()
hdr("TILE LEGEND   (move cost: bipedal / centauroid / flight;  * = defence stars)")
out(
    "chr".ljust(5)
    + "id".ljust(12)
    + "name".ljust(25)
    + "bip".rjust(3)
    + "cent".rjust(6)
    + "fly".rjust(5)
    + "def*".rjust(6)
)
for ch, (tid, tname, bip, cent, fly, dstars) in TILES.items():
    out(
        ch.ljust(5)
        + tid.ljust(12)
        + tname.ljust(26)
        + cost_str(bip).rjust(2)
        + cost_str(cent).rjust(6)
        + cost_str(fly).rjust(5)
        + str(dstars).rjust(6)
    )

out()
hdr("RENDERED MAPS")
for map_id, name, _const, grid, _ok, s, _p in results:
    out()
    out(f"{map_id}  -  {name}   ({s['w']} x {s['h']})")
    out("     " + "".join(str(x % 10) for x in range(s["w"])))
    for y, row in enumerate(grid):
        out(f"{y:4d} {row}")

# =====================================================================
# Emit
# =====================================================================
TS_HEADER = """// AUTO-GENERATED by design/maps.py from its ASCII source. Do not hand-edit
// the grids -- edit the ASCII in maps.py and re-run the script.
//
// HOW TO APPLY THIS FILE (changed since the original 21 Aug 2026 version):
// src/data/maps.ts is no longer a plain copy of this file. It grew its own
// hand-written helpers -- deriveZones() and makeMap(), which derive
// deployZones/exitTiles/holdZone/defendZone from the tile grid, and which
// src/data/mapsAmaranth.ts imports. So do NOT overwrite maps.ts wholesale.
// Replace only the four `const *_TILES: TileType[][] = [...]` blocks in
// maps.ts with the four below, and leave everything above and below them
// alone. The const names here already match the ones maps.ts uses.

import type { TileType } from './types';
"""


def emit_ts():
    parts = [TS_HEADER]
    for _map_id, _name, const, grid, _ok, _s, _p in results:
        rows = []
        for row in to_tiles(grid):
            rows.append("  [" + ", ".join(f'"{t}"' for t in row) + "],")
        parts.append(
            f"\nconst {const}: TileType[][] = [\n" + "\n".join(rows) + "\n];\n"
        )
    return "".join(parts)


def emit_json():
    return json.dumps(
        {
            m: {
                "id": m,
                "name": n,
                "width": s["w"],
                "height": s["h"],
                "ascii": g,
            }
            for m, n, _c, g, _ok, s, _p in results
        },
        indent=2,
    )


wrote = []
if all_ok:
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "maps_generated.ts"), "w", encoding="utf-8") as f:
        f.write(emit_ts())
    with open(os.path.join(here, "maps_ascii.json"), "w", encoding="utf-8") as f:
        f.write(emit_json() + "\n")
    wrote = ["maps_generated.ts", "maps_ascii.json"]

out()
hdr(
    "All maps valid. Emitted maps_generated.ts and maps_ascii.json."
    if all_ok
    else "MAPS INVALID -- nothing emitted. Fix the problems listed above."
)

# Everything printed up to this point is the report the ORIGINAL maps.py
# produced. The sections after it are new coverage this rebuild adds. The
# split is recorded here so the byte-exact diff below knows where to stop.
LEGACY_END = len(lines)

# =====================================================================
# RECONSTRUCTION CHECK -- the load-bearing part of this rebuild.
#
# Every number below is the original maps_output.txt's own recorded value,
# hardcoded here and compared against what this script just computed. This
# is what makes the rebuild checkable instead of merely plausible.
# =====================================================================
ORIGINAL_TABLE = {
    # map id: (name, w, h, tiles, P, E, H, X)  -- from maps_output.txt
    "map_city_sweep_01": ("The City Sweep", 18, 12, 216, 7, 3, 0, 0),
    "map_bunker_01": ("The Bunker", 18, 12, 216, 6, 4, 12, 0),
    "map_attrition_01": ("The Real Fight", 20, 12, 240, 6, 2, 0, 0),
    "map_sessile_tomb": ("The Sessile Tomb", 20, 12, 240, 6, 8, 0, 6),
}

# The 13 legend rows the original printed, in the original's own order.
ORIGINAL_LEGEND = [
    (".", "plain", "Plain / ferrocrete", "1", "1", "1", 1),
    ("=", "road", "Road / rail spine", "1", "1", "1", 0),
    (",", "scrub", "Open scrub", "1", "1", "1", 0),
    ("%", "rubble", "Rubble", "2", "3", "1", 2),
    ("#", "structure", "Structure / habblock", "1", "2", "1", 3),
    ("~", "bloom_mat", "Bloom mat", "2", "2", "1", 1),
    ("^", "ridge", "Ridge / elevated", "2", "3", "1", 4),
    ("w", "sump", "Water / sump", "-", "-", "1", 0),
    ("P", "deploy", "Deploy pad (player)", "1", "1", "1", 1),
    ("E", "spawn", "Bloom spawn seam", "1", "1", "1", 0),
    ("X", "exit", "Extraction tile", "1", "1", "1", 1),
    ("H", "hold", "Hold-zone tile", "1", "1", "1", 2),
    ("B", "wall", "Blockhouse wall", "-", "-", "99", 0),
]

out()
hdr("RECONSTRUCTION CHECK -- fresh output vs. the original maps_output.txt")
checks = []


def check(label, got, want):
    ok = got == want
    checks.append(ok)
    out(f"  [{'OK  ' if ok else 'FAIL'}] {label}")
    if not ok:
        out(f"          computed: {got}")
        out(f"          original: {want}")


for map_id, name, _const, _grid, _ok, s, _p in results:
    want = ORIGINAL_TABLE[map_id]
    got = (name, s["w"], s["h"], s["tiles"], s["P"], s["E"], s["H"], s["X"])
    check(f"{map_id} table row", got, want)

legend_now = [
    (ch, tid, tname, cost_str(bip), cost_str(cent), cost_str(fly), dstars)
    for ch, (tid, tname, bip, cent, fly, dstars) in TILES.items()
    if tid != "dock"  # added after the original; see NOTES
]
check("tile legend (13 original rows, in order)", legend_now, ORIGINAL_LEGEND)

# Round-trip: the tile grids this script produces must turn back into the
# exact ASCII the original rendered. Catches a bad char/tile mapping.
tile_to_char = {v[0]: k for k, v in TILES.items()}
for map_id, _n, _c, grid, ok, _s, _p in results:
    if not ok:
        # A grid that failed validation can contain characters that aren't
        # tiles, so there is nothing to round-trip. It has already been
        # reported as broken above; don't mask that with a second failure.
        checks.append(False)
        out(f"  [SKIP] {map_id} tile grid round-trip -- map failed validation")
        continue
    back = ["".join(tile_to_char[t] for t in row) for row in to_tiles(grid)]
    check(f"{map_id} tile grid round-trips to its ASCII", back, list(grid))

# The strongest check available: reproduce the original report byte for byte
# and diff it against the frozen 21 Aug 2026 artifact sitting beside this
# script. The structured checks above compare values; this one compares the
# literal text, so it also catches formatting drift they cannot see -- which
# is exactly how a one-character-wide column header slipped through on the
# first run of this rebuild.
REFERENCE = "maps_output_reference_21Aug2026.txt"
ref_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), REFERENCE)
if os.path.exists(ref_path):
    with open(ref_path, encoding="utf-8") as f:
        want_text = f.read().rstrip("\n")
    # The only intentional difference is the 'dock' legend row, added after
    # the original was produced. See NOTES.
    got_text = "\n".join(
        l for l in lines[:LEGACY_END] if not l.startswith("D    dock")
    ).rstrip("\n")
    same = got_text == want_text
    checks.append(same)
    out(f"  [{'OK  ' if same else 'FAIL'}] byte-exact diff vs {REFERENCE}")
    if not same:
        got_lines = got_text.split("\n")
        want_lines = want_text.split("\n")
        for i in range(max(len(got_lines), len(want_lines))):
            g = got_lines[i] if i < len(got_lines) else "<missing>"
            w = want_lines[i] if i < len(want_lines) else "<missing>"
            if g != w:
                out(f"          line {i + 1}")
                out(f"            computed |{g}|")
                out(f"            original |{w}|")
else:
    out(f"  [SKIP] byte-exact diff -- {REFERENCE} not found beside this script")
    out("         (that file is the frozen original output; keep it in design/)")

recon_ok = all(checks)
out()
out(f"  {sum(checks)}/{len(checks)} OK, {len(checks) - sum(checks)} FAIL")
out(
    "  Reconstruction VERIFIED against the original output."
    if recon_ok
    else "  RECONSTRUCTION FAILED -- do not trust anything this script printed."
)

# =====================================================================
# Extra coverage the original did not have, plus honest notes.
# =====================================================================
out()
hdr("REACHABILITY DETAIL -- extra coverage, not in the original output")
out("Flood-fill on foot from every deploy pad. 'orphan' = walkable ground no")
out("squad can actually get to. Legal (decorative pockets happen), but if a")
out("number here is large, the map probably has an accidental wall.")
out()
out("id".ljust(20) + "walkable".rjust(9) + "reachable".rjust(11) + "orphan".rjust(8))
for map_id, _n, _c, _g, _ok, s, _p in results:
    out(
        map_id.ljust(20)
        + str(s["walkable"]).rjust(9)
        + str(s["reachable"]).rjust(11)
        + str(s["orphan_walkable"]).rjust(8)
    )

out()
hdr("NOTES -- real differences found against the live engine, flagged not fixed")
out("1. Blockhouse wall, flight cost. The original legend prints 99 (passable")
out("   to flyers at an absurd cost). The live src/data/tiles.ts sets flying to")
out("   Infinity and carries an explicit comment -- 'Impassable to everything,")
out("   flyers included. GDD Sec.4.6 / Data Pack Sec.7.3'. Those disagree. This")
out("   script keeps 99 so its output still matches the original artifact it is")
out("   being checked against; the engine is almost certainly the correct one.")
out("   Maxime's call which is canon -- if the engine wins, change the 99 above")
out("   to IMPASSABLE and update the ORIGINAL_LEGEND row to match.")
out()
out("2. Deploy pad display name. Legend says 'Deploy pad (player)'; tiles.ts")
out("   says 'Deploy pad'. Cosmetic, no gameplay effect. Not changed.")
out()
out("3. The 'dock' tile (Mission 22 Protect Asset, 25 Aug 2026) exists in")
out("   tiles.ts but postdates the original script, so it is excluded from the")
out("   legend comparison above. It IS registered in this script's tile table,")
out("   so a future map using 'D' will validate rather than be rejected.")
out()
out("4. Tile effects this script does not model: bloom_mat's 5 turn-start")
out("   damage, deploy's 20 turn-start repair, ridge's +1 Reeps range. They")
out("   live in tiles.ts and matter in play, but none of them affect map")
out("   *validity*, which is all this script is for.")
out()
out("5. maps.py only covers the four archived Team One maps -- the same four")
out("   the original covered. The live Amaranth campaign's 36 maps live in")
out("   src/data/mapsAmaranth.ts and were generated by ad hoc per-batch")
out("   scripts, not by this one. Bringing them under this script would be a")
out("   real piece of work and a real scope decision, not a quiet extension.")

out()
out("=" * 78)
if all_ok and recon_ok:
    out("DONE. Maps valid, reconstruction verified. Wrote: " + ", ".join(wrote))
else:
    out("DONE WITH FAILURES -- see above. Nothing here should be trusted yet.")
out("=" * 78)

print("\n".join(lines))
sys.exit(0 if (all_ok and recon_ok) else 1)
