# Bloom Wars — design tooling

Three small Python scripts used to check the numbers and maps in the design documents and the shipped game data, plus what they produced. Nothing here is part of the game. They are the reason the Data Pack can say "validated" instead of "I think this is about right."

If you have never run a Python script before, the section at the bottom covers it. You do not need to for the two Team One scripts — their outputs are already included as text files. `maps_amaranth.py` is new and doesn't have a saved output file checked in yet; run it to see what it prints.

**27 Aug 2026 — this file itself, and both of the two original scripts it describes, had gone missing from the actual repo.** Only their console outputs (`sim_output.txt`, `maps_output.txt`) had survived, as saved project documents rather than checked-in files. All three are rebuilt now: `combat_sim.py` and `maps.py` from scratch against their surviving output, and this README from the copy of it that was still saved as a project document. `maps.py` also gained a new sibling script the same day, `maps_amaranth.py`, covering the 36 live Amaranth campaign maps — see its own section below.

---

## What each file is

| File | What it is |
|---|---|
| `combat_sim.py` | The combat math, written out as runnable code. Prints every damage number, checks the class triangle actually closes, and fails loudly if anything one-shots a full-health unit. |
| `maps.py` | The four archived Team One maps, drawn as ASCII art. Checks they are rectangular, that every tile character is a real tile, that there are enough deploy pads, and that a unit can actually walk from a deploy pad to every objective. Then writes out the TypeScript. |
| `maps_amaranth.py` | The same checks, for all 36 of the live Amaranth Reckoning campaign's maps. A separate, self-contained script rather than an extension of `maps.py` — see its own section below for why. |
| `sim_output.txt` | What `combat_sim.py` printed. This is Data Pack §13. |
| `maps_output.txt` | What `maps.py` printed — the validation table plus the maps drawn out. |
| `maps_output_reference_21Aug2026.txt` | The frozen original `maps_output.txt`, from before the 27 Aug rebuild. `maps.py` diffs its own output against this file byte-for-byte every time it runs — the strongest check it has. Keep this file exactly as it is; it is a reference, not something to regenerate. |
| `maps_generated.ts` | The four Team One maps as TypeScript, ready to drop into `src/data/maps.ts`. Produced by `maps.py`. Not committed to the repo — regenerate on demand — since a checked-in copy would just be a second place for the maps to drift out of sync with `maps.ts`. |
| `maps_amaranth_grids.py` | The 36 Amaranth maps' ASCII, kept in its own file because it's too much data to sit comfortably at the top of `maps_amaranth.py` itself. Edit these strings, then re-run `maps_amaranth.py`. |

---

## Why these exist

**`combat_sim.py` is the reference implementation.** When the combat resolver is written in TypeScript, its output has to match this script's output exactly. If they disagree, the TypeScript is wrong. Build Brief §4.1 asks for every number in `sim_output.txt` to be turned into a test — that is what makes the game's balance checkable by a machine instead of by you playing the same mission forty times.

It also encodes rules that are easy to break by accident. The one worth knowing about: a Reeps firing from three tiles away never gets counterattacked, and that single condition is the whole reason Reeps beats Tank. The script tests it explicitly, because it is the kind of line a tidy-up refactor deletes without anything else failing.

**`maps.py` and `maps_amaranth.py` are where the maps live.** The ASCII grids near the top of each file are the real source of truth — editing a map means editing those letters, then re-running the matching script. Each regenerates its own TypeScript and re-checks everything. This is much better than hand-editing hundreds of tile entries in a TypeScript array, which is how map bugs happen.

---

## Editing the maps

The grids near the top of `maps.py` (and, for the Amaranth campaign, in `maps_amaranth_grids.py`) look like this:

```
CITY_SWEEP = [
    ",,,..##..%%..^^^^^",
    ",,,..##..%%...^^^^",
    ...
]
```

One character per tile. The legend:

```
.  plain / ferrocrete      %  rubble           P  deploy pad
=  road                    #  structure        E  enemy spawn seam
,  open scrub              ~  Bloom mat        H  hold zone
^  ridge (elevated)        B  blockhouse wall  X  extraction tile
w  water / sump            D  dock perimeter (Mission 22 "Ash on the Water")
```

Change any character, re-run the matching script, and it tells you if you broke something — a row that is the wrong length, a tile you cannot reach, an objective walled off from the deploy zone. That last check is the useful one: it is very easy to draw a map that looks fine and has an unreachable corner.

---

## Changing the balance

Everything tunable in `combat_sim.py` is at the top of the file:

- `P` — the damage matrix. `P["meeps"]["reeps"] = 75` means a Meeps attacking a Reeps deals 75.
- `TIERS` — the gear ladder, G through A.
- `FULL_HP_CAP` — currently 90. The most a single attack can deal to a unit at full health.
- `CAN_COUNTER` / `COUNTER_MAX_RANGE` — who counterattacks, and from how far.

Change a number, re-run, and the script re-checks all of it. At the bottom it either prints all gates passed or lists exactly what broke. The gates are: the triangle has to hold with a real margin, nothing may delete a full-health unit, no matchup may take more than five hits, and a Tank on a ridge still has to be killable.

That last part matters more than it sounds. Balance changes have knock-on effects three steps away, and this catches them in a second instead of in a playtest.

---

## Running them

You need Python 3. On Windows, install it from python.org and tick "Add Python to PATH" during setup.

Open a terminal in the `design/` folder and run:

```
python combat_sim.py
python maps.py
python maps_amaranth.py
```

On Mac or Linux it is `python3` instead of `python`.

To save the output to a file instead of watching it scroll past:

```
python combat_sim.py > sim_output.txt
python maps.py > maps_output.txt
python maps_amaranth.py > maps_amaranth_output.txt
```

`maps_amaranth.py` also checks its own output against the live `src/data/mapsAmaranth.ts` when you point it there — this is the check that proves a reverse-transcribed map still matches what's actually shipped:

```
MAPS_AMARANTH_LIVE_TS=../src/data/mapsAmaranth.ts python maps_amaranth.py
```

(On Windows PowerShell: `$env:MAPS_AMARANTH_LIVE_TS="../src/data/mapsAmaranth.ts"; python maps_amaranth.py`.)

None of the three scripts install anything, touch the internet, or change any file except the ones they write (`maps_generated.ts`/`maps_ascii.json` for `maps.py`; `maps_amaranth_generated.ts`/`maps_amaranth_ascii.json` for `maps_amaranth.py`). You can run them as often as you like.

---

## Where they go in the repo

```
/bloom-wars
  /design
      Bloom_Wars_GDD_v0.2.docx
      Bloom_Wars_Data_Pack_v0.1.docx
      Bloom_Wars_Build_Brief_v0.1.docx
      README.md                          <- this file
      combat_sim.py
      maps.py
      maps_amaranth.py
      maps_amaranth_grids.py
      sim_output.txt
      maps_output.txt
      maps_output_reference_21Aug2026.txt
  /src
    /data
      maps.ts                            <- maps_generated.ts's blocks are copied here
      mapsAmaranth.ts                    <- maps_amaranth_generated.ts's blocks are copied here
```

Keeping them inside the repo rather than off to one side matters: the design documents are meant to be readable from inside the repo, and a path inside it is one that's always reachable. (This is also, in the most literal sense possible, the lesson of the 27 Aug 2026 rebuild — three files described right here as living in this folder had quietly stopped actually being in it.)

---

## Applying the generated TypeScript — read this before copying anything over

**`src/data/maps.ts` and `src/data/mapsAmaranth.ts` are no longer plain copies of the generated files.** Both have grown their own hand-written helpers — `deriveZones()` and `makeMap()` in `maps.ts`, which derive `deployZones`/`exitTiles`/`holdZone`/`defendZone` from the tile grid, and which `mapsAmaranth.ts` also imports and reuses. Overwriting either file wholesale with its generated counterpart would delete those helpers.

**The correct rule: replace only the `const *_TILES` blocks that changed, and leave everything above and below them alone.** Both generated files print this same instruction in their own header, so it can't be missed even if this README drifts again.

---

## Why `maps_amaranth.py` is a separate script, not a bigger `maps.py`

Two real differences from the four Team One maps made a second, independent script the safer choice rather than extending `maps.py` to cover all 40:

1. **No original artifact survives to check against.** The four Team One maps had a frozen `maps_output.txt` from 21 Aug 2026 to reconstruct against byte-for-byte. The 36 Amaranth maps never had a saved output file — their own source comment says they were authored as ASCII and run through "a small offline validator" that was never committed to this repo, and one later batch's own generator script is named in a code comment as having lived in a previous Claude session's own temporary sandbox, not in this repository — gone for good. So their ASCII in `maps_amaranth_grids.py` was produced the opposite way round from normal: derived by reversing the tile data that's actually shipped in `mapsAmaranth.ts` today, then proven correct by re-emitting TypeScript and diffing it byte-for-byte against that live file. That is a fundamentally different kind of check than `maps.py` runs, and mixing the two into one script would have blurred which kind of proof backs which map.
2. **Keeping `maps.py` itself completely unmodified was the point.** It had just been rebuilt and verified the same day. Extending it to cover 36 more maps, nine times the content, is real surgery on a script that had just earned trust — the safer move was a sibling script that shares nothing but a copy of the same small tile-cost table, so nothing about the Team One maps' own validated state could be put at risk by unrelated Amaranth work.

`maps_amaranth.py` does not import from `maps.py`. If the two ever get properly unified, that should be a deliberate refactor of two already-working scripts, not a side effect of adding map coverage.
