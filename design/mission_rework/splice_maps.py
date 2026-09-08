#!/usr/bin/env python3
"""Regenerate both map generators and splice ONLY the changed const *_TILES blocks
into src/data/mapsAmaranth.ts / mapsHouseAmaranth.ts (the README's rule).
Mission rework pass, 8 Sep 2026. Run from anywhere: python3 design/mission_rework/splice_maps.py
Exits 1 if either generator reports INVALID — do not pipe it through tail."""
import re, subprocess, sys, os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
D = os.path.join(ROOT, "design")

def run(script):
    r = subprocess.run([sys.executable, script], cwd=D, capture_output=True, text=True)
    out = r.stdout
    if "INVALID" in out or r.returncode != 0:
        print(out[-3000:]); print(r.stderr[-2000:]); sys.exit(1)
    return out

def blocks(ts):
    return {m.group(1): m.group(0) for m in re.finditer(r"const (\w+_TILES): TileType\[\]\[\] = \[\n(?:.*\n)*?\];\n", ts)}

def splice(generated, live_path):
    gen = blocks(open(generated).read())
    live = open(live_path).read()
    lb = blocks(live)
    changed = []
    for name, block in gen.items():
        if name not in lb:
            print(f"  NEW block {name} not in live file -- add makeMap() by hand"); continue
        if lb[name] != block:
            live = live.replace(lb[name], block); changed.append(name)
    open(live_path, "w").write(live)
    return changed

out = run("maps_amaranth.py")
print(out.split("\n")[-8:-1][0] if "valid" in out else out[-500:])
ch = splice(os.path.join(D, "maps_amaranth_generated.ts"), os.path.join(ROOT, "src/data/mapsAmaranth.ts"))
print("Warden blocks updated:", ch or "none")
out = run("maps_house_amaranth.py")
ch = splice(os.path.join(D, "maps_house_amaranth_generated.ts"), os.path.join(ROOT, "src/data/mapsHouseAmaranth.ts"))
print("House Amaranth blocks updated:", ch or "none")
