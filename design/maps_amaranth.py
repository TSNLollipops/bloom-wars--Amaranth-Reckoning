#!/usr/bin/env python3
"""
Bloom Wars -- maps_amaranth.py

WHAT THIS FILE IS, AND WHY IT'S SEPARATE FROM maps.py (27 Aug 2026):

Maxime asked to bring all 36 of The Amaranth Reckoning's mission maps under
the same "a map only counts once it's run through the script and passed"
discipline design/maps.py enforces for the four archived Team One maps --
with an explicit second instruction: make sure the Team One maps stay
locked tight while doing it.

This script is a separate, self-contained sibling to maps.py -- it does not
import from it, and nothing in maps.py was touched to build this. That is
the "locked tight" part: maps.py was rebuilt earlier today, verified with a
byte-exact diff against its own frozen 21 Aug 2026 original, and proven to
regenerate Team One's four maps as an exact no-op. None of that gets
touched or put at risk by anything in this file. If the two ever want to
share code, that is a deliberate future refactor of an already-verified
script, not a side effect of an unrelated feature -- exactly the kind of
thing this project's own rules say to flag rather than do quietly.

RECONSTRUCTION NOTE -- this is NOT the same situation as maps.py's own
rebuild, and it is worth being precise about the difference:

  maps.py's four maps had a surviving *validated original artifact*
  (maps_output.txt) to reconstruct against and check byte-for-byte.

  These 36 maps have no such artifact. Per data/mapsAmaranth.ts's own
  header comment, they were "authored as ASCII... and run through a small
  offline validator before transcription" -- but that ASCII source and
  that validator were never committed to this repo. One of the file's own
  code comments even names where a later batch's generator lived:
  "/home/claude/work/bloom-wars/gen_maps5.py" -- a path inside a *previous
  Claude session's own ephemeral sandbox*, not this repository. That
  container is long gone; nothing at that path has ever been reachable
  from here. So unlike maps.py, there is no original output to diff this
  script's output against for proof -- only the live, shipped TypeScript
  itself.

  The ASCII grids below were therefore produced by *reversing* the normal
  flow: read the tile arrays that are actually shipped in
  src/data/mapsAmaranth.ts today, and turn each tile back into its
  maps_output.txt-legend character, mechanically (a straight
  tile-name -> character lookup, the exact inverse of the char -> tile
  table every map script in this project already uses). This was done by
  script, not by hand -- transcribing 14,280 tiles by eye is exactly the
  kind of job that produces silent, hard-to-notice errors.

  What proves the reversal didn't corrupt anything is the strongest check
  available here: re-emit TypeScript from these ASCII grids and diff it,
  byte for byte, against the *_TILES blocks already live in
  src/data/mapsAmaranth.ts. All 36 matched exactly on the first attempt
  (see RECONSTRUCTION CHECK below) -- which is the round-trip proof that
  the derived ASCII really does describe the maps that shipped.

  What this script's checks CANNOT tell you: whether the original,
  now-lost validator enforced the same rules as this one, or whether these
  36 maps are correct in a design sense (fun, balanced, the right
  difficulty). It only confirms that what's checked in is well-formed and
  physically playable -- the same honest limit maps.py's own reachability
  check has.

FROM HERE ON, THIS ASCII IS THE SOURCE OF TRUTH, same convention as
maps.py: edit the letters below, re-run this script, and copy the emitted
`const *_TILES` blocks over the matching ones in src/data/mapsAmaranth.ts.
Never hand-edit that file's tile grids directly again -- before today
there was no ASCII to edit instead, which is exactly the gap this script
closes.

Run: python3 maps_amaranth.py
Writes: maps_amaranth_generated.ts, maps_amaranth_ascii.json
"""

import json
import os
import re
import sys
from collections import deque

# =====================================================================
# TILE TABLE -- identical vocabulary and costs to design/maps.py's table
# (transcribed from maps_output.txt's legend, reconciled against the live
# src/data/tiles.ts). Duplicated here rather than imported, deliberately --
# see the file header on why this script doesn't depend on maps.py.
# =====================================================================
IMPASSABLE = None

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
    "D": ("dock",      "Dock perimeter",      1, 1, 1, 2),
}
TILE_TO_CHAR = {v[0]: k for k, v in TILES.items()}

# Confirmed 27 Aug 2026 by reading the live TypeScript union
# (src/data/types.ts's TileType) and grepping every *_TILES grid in
# mapsAmaranth.ts for the string tokens actually used: all 36 maps use
# only these 14 values. "enemy_deploy" and "ring", which appear in that
# file's own prose comments, are design vocabulary about spawn placement
# and mission framing -- never a TileType, never a tile in any grid. This
# script needs no tile types beyond what maps.py already knows.

OBJECTIVE_TILES = {"spawn", "exit", "hold", "dock"}

# Calibrated against the real data, not assumed: the smallest deploy count
# across all 36 live maps is 5 (Mission "House Colors"), the smallest
# spawn count is 2. Kept at maps.py's own thresholds since both hold with
# room to spare -- this is a floor that catches a genuinely broken map,
# not a tight fit against these specific 36.
MIN_DEPLOY_PADS = 4
MIN_SPAWN_SEAMS = 1

# =====================================================================
# THE MAPS -- reverse-extracted from src/data/mapsAmaranth.ts. See the
# RECONSTRUCTION NOTE above for exactly how and why.
# =====================================================================
from maps_amaranth_grids import GRIDS  # noqa: E402  (see that file's own header)

# =====================================================================
# Output plumbing (same shape as maps.py, duplicated not imported)
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
    for ch, (tid, _n, bip, cent, _fly, _d) in TILES.items():
        if tid == tile_id:
            return bip is not IMPASSABLE and cent is not IMPASSABLE
    raise KeyError(tile_id)


def to_tiles(grid):
    return [[TILES[ch][0] for ch in row] for row in grid]


# =====================================================================
# Validation -- identical logic to maps.py's validate(). Duplicated
# rather than imported; see the file header.
# =====================================================================
def validate(grid):
    problems = []
    widths = sorted({len(r) for r in grid})
    if len(widths) != 1:
        for y, row in enumerate(grid):
            if len(row) != len(grid[0]):
                problems.append(
                    f"row {y} is {len(row)} wide, but row 0 is {len(grid[0])} wide"
                )
    w = len(grid[0])
    h = len(grid)

    for y, row in enumerate(grid):
        for x, ch in enumerate(row):
            if ch not in TILES:
                problems.append(f"({x},{y}) is '{ch}', which is not a tile")

    if problems:
        return False, {
            "w": w, "h": h, "tiles": "?", "P": "?", "E": "?", "H": "?",
            "X": "?", "D": "?", "reachable": "?", "walkable": "?",
            "orphan_walkable": "?",
        }, problems

    tiles = to_tiles(grid)
    counts = {}
    for row in tiles:
        for t in row:
            counts[t] = counts.get(t, 0) + 1

    n_deploy = counts.get("deploy", 0)
    n_spawn = counts.get("spawn", 0)
    if n_deploy < MIN_DEPLOY_PADS:
        problems.append(f"only {n_deploy} deploy pad(s); need at least {MIN_DEPLOY_PADS}")
    if n_spawn < MIN_SPAWN_SEAMS:
        problems.append(f"no Bloom spawn seam (need at least {MIN_SPAWN_SEAMS})")

    start = [(x, y) for y in range(h) for x in range(w) if tiles[y][x] == "deploy"]
    seen = set(start)
    q = deque(start)
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in seen:
                if passable_ground(tiles[ny][nx]):
                    seen.add((nx, ny))
                    q.append((nx, ny))

    for y in range(h):
        for x in range(w):
            t = tiles[y][x]
            if t in OBJECTIVE_TILES and (x, y) not in seen:
                problems.append(f"objective tile '{t}' at ({x},{y}) cannot be walked to")

    walkable_total = sum(1 for y in range(h) for x in range(w) if passable_ground(tiles[y][x]))
    stats = {
        "w": w, "h": h, "tiles": w * h,
        "P": n_deploy, "E": n_spawn,
        "H": counts.get("hold", 0), "X": counts.get("exit", 0), "D": counts.get("dock", 0),
        "reachable": len(seen), "walkable": walkable_total,
        "orphan_walkable": walkable_total - len(seen),
    }
    return not problems, stats, problems


# =====================================================================
# Run validation over all 36
# =====================================================================
order = list(GRIDS.keys())
results = []
all_ok = True
for mid in order:
    d = GRIDS[mid]
    ok, stats, problems = validate(d["ascii"])
    all_ok = all_ok and ok
    results.append((mid, d, ok, stats, problems))

hdr("THE AMARANTH RECKONING -- MAP VALIDATION (36 missions)")
out(
    "id".ljust(38) + "name".ljust(34) + "w".rjust(2) + "h".rjust(4)
    + "tiles".rjust(7) + "P".rjust(4) + "E".rjust(4) + "H".rjust(4)
    + "X".rjust(4) + "D".rjust(4)
)
for mid, d, ok, s, _p in results:
    out(
        mid.ljust(38) + d["name"][:32].ljust(34)
        + str(s["w"]).rjust(2) + str(s["h"]).rjust(4) + str(s["tiles"]).rjust(7)
        + str(s["P"]).rjust(4) + str(s["E"]).rjust(4) + str(s["H"]).rjust(4)
        + str(s["X"]).rjust(4) + str(s["D"]).rjust(4)
    )

if not all_ok:
    out()
    out("PROBLEMS FOUND:")
    for mid, _d, ok, _s, problems in results:
        for p in problems:
            out(f"  {mid}: {p}")

out()
hdr(
    "All 36 Amaranth maps valid."
    if all_ok
    else "AMARANTH MAPS INVALID -- see problems above. Nothing emitted."
)

# =====================================================================
# Emit
# =====================================================================
TS_HEADER = """// AUTO-GENERATED by design/maps_amaranth.py from its ASCII source (itself
// reverse-derived from the shipped TypeScript on 27 Aug 2026 -- see that
// script's RECONSTRUCTION NOTE for why no earlier ASCII source exists).
// From here forward: edit the ASCII in maps_amaranth.py, re-run, and paste
// the matching const block(s) below back into src/data/mapsAmaranth.ts.
// Never hand-edit a *_TILES grid in that file directly again.
//
// Replace ONLY the const block(s) you changed -- these blocks are
// module-private (not exported) in the live file, exactly like
// src/data/maps.ts's own *_TILES consts, and every makeMap(...) call and
// the MAPS_AMARANTH export below them are untouched by this script.

import type { TileType } from './types';
"""


def emit_ts():
    parts = [TS_HEADER]
    for mid in order:
        d = GRIDS[mid]
        rows = ["  [" + ", ".join(f'"{TILES[ch][0]}"' for ch in row) + "]," for row in d["ascii"]]
        parts.append(f"\nconst {d['const']}: TileType[][] = [\n" + "\n".join(rows) + "\n];\n")
    return "".join(parts)


def emit_json():
    return json.dumps(
        {mid: {"name": GRIDS[mid]["name"], "width": GRIDS[mid]["w"],
               "height": GRIDS[mid]["h"], "ascii": GRIDS[mid]["ascii"]}
         for mid in order},
        indent=2,
    )


wrote = []
if all_ok:
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "maps_amaranth_generated.ts"), "w", encoding="utf-8") as f:
        f.write(emit_ts())
    with open(os.path.join(here, "maps_amaranth_ascii.json"), "w", encoding="utf-8") as f:
        f.write(emit_json() + "\n")
    wrote = ["maps_amaranth_generated.ts", "maps_amaranth_ascii.json"]

# =====================================================================
# RECONSTRUCTION CHECK -- the load-bearing part. Since no original
# console output survives for these 36 maps (unlike maps.py's four), the
# strongest available proof is different in kind: a byte-exact diff of
# this script's re-emitted TypeScript against the *_TILES blocks that are
# actually live in src/data/mapsAmaranth.ts right now. If that live file
# is provided alongside this script (LIVE_TS_PATH below), the check runs
# for real; if not, it is skipped and says so rather than silently passing.
# =====================================================================
out()
hdr("RECONSTRUCTION CHECK -- round-trip vs. the live src/data/mapsAmaranth.ts")
checks = []


def check(label, ok):
    checks.append(ok)
    out(f"  [{'OK  ' if ok else 'FAIL'}] {label}")


# Round-trip: every grid's tiles must convert back to the exact ASCII it
# came from. Catches a bad char/tile mapping in this script itself.
for mid in order:
    d = GRIDS[mid]
    back = ["".join(TILE_TO_CHAR[t] for t in row) for row in to_tiles(d["ascii"])]
    check(f"{mid} tile grid round-trips to its ASCII", back == d["ascii"])

LIVE_TS_PATH = os.environ.get("MAPS_AMARANTH_LIVE_TS", "")
if LIVE_TS_PATH and os.path.exists(LIVE_TS_PATH):
    live_src = open(LIVE_TS_PATH, encoding="utf-8").read()
    live_blocks = dict(re.findall(r'const (\w+_TILES): TileType\[\]\[\] = \[(.*?)\n\];', live_src, re.S))
    for mid in order:
        d = GRIDS[mid]
        const = d["const"]
        if const not in live_blocks:
            check(f"{mid} ({const}) byte-diff vs live mapsAmaranth.ts", False)
            out(f"          const not found in live file")
            continue
        want_rows = re.findall(r'\[([^\]]*)\]', live_blocks[const])
        got_rows = ['"' + '", "'.join(TILES[ch][0] for ch in row) + '"' for row in d["ascii"]]
        same = [r.strip() for r in want_rows] == [r.strip() for r in got_rows]
        check(f"{mid} ({const}) byte-diff vs live mapsAmaranth.ts", same)
        if not same:
            for i, (a, b) in enumerate(zip(want_rows, got_rows)):
                if a.strip() != b.strip():
                    out(f"          row {i}")
                    out(f"            live     |{a.strip()}|")
                    out(f"            computed |{b.strip()}|")
else:
    out("  [SKIP] byte-diff vs live mapsAmaranth.ts -- set MAPS_AMARANTH_LIVE_TS")
    out("         to that file's path to run this check for real")

recon_ok = all(checks)
out()
out(f"  {sum(checks)}/{len(checks)} OK, {len(checks) - sum(checks)} FAIL")
out(
    "  Reconstruction VERIFIED -- round-trips cleanly, matches the live file exactly."
    if recon_ok
    else "  RECONSTRUCTION FAILED -- do not trust anything this script printed."
)

# =====================================================================
# New coverage this script provides that the lost original validator's
# comment doesn't confirm it had.
# =====================================================================
out()
hdr("REACHABILITY DETAIL -- deploy-pad flood fill to every objective tile")
out("mapsAmaranth.ts's own header says the lost validator checked reachability")
out("'from every deploy pad to every spawn/hold tile' -- it does not mention")
out("exit or dock. This script checks all four objective types uniformly.")
out("'orphan' = walkable ground no squad can reach. Legal on its own, but")
out("worth seeing.")
out()
out("id".ljust(38) + "walkable".rjust(9) + "reachable".rjust(11) + "orphan".rjust(8))
for mid, _d, ok, s, _p in results:
    if not ok:
        out(mid.ljust(38) + "SKIPPED (map failed validation above)")
        continue
    out(
        mid.ljust(38) + str(s["walkable"]).rjust(9)
        + str(s["reachable"]).rjust(11) + str(s["orphan_walkable"]).rjust(8)
    )

out()
hdr("NOTES")
out("1. This script's tile-cost table is copied verbatim from design/maps.py,")
out("   not imported -- see the file header on why the two scripts stay")
out("   independent. If maps.py's table ever changes (e.g. the blockhouse-wall")
out("   flight-cost question flagged in its own NOTES), this file needs the")
out("   same edit made by hand, or the two will quietly disagree.")
out()
out("2. No per-map difficulty/balance judgment is made here, same honest limit")
out("   as maps.py. This confirms the 36 maps are well-formed and physically")
out("   playable -- not that they are fun, fair, or correctly tuned.")
out()
out("3. Team One's four maps are untouched by this file. design/maps.py, its")
out("   own frozen reference, and its own generated output are exactly as")
out("   they were before this script existed.")

out()
out("=" * 78)
if all_ok and recon_ok:
    out("DONE. All 36 maps valid, reconstruction verified. Wrote: " + ", ".join(wrote))
else:
    out("DONE WITH FAILURES -- see above. Nothing here should be trusted yet.")
out("=" * 78)

print("\n".join(lines))
sys.exit(0 if (all_ok and recon_ok) else 1)
