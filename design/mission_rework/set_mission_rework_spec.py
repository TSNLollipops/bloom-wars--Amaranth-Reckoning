#!/usr/bin/env python3
"""Replace whole entries in mission_rework_specs.py from an override module.

  python3 design/mission_rework/set_mission_rework_spec.py my_overrides.py

The override module defines NEW = { "<CONST>": {...same shape as REWORK...}, ... }.
Each named entry's block in mission_rework_specs.py (from `  "<CONST>": {` to its closing
`  },`) is replaced by a pretty-printed version of the new dict. Entries not
present in rework_specs.py are appended before the closing `}` of REWORK.
"""
import sys, os, re, importlib.util
SPEC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mission_rework_specs.py")

def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    return mod

def fmt_wave(w):
    parts = [f'"a": "{w["a"]}"', f'"n": {w["n"]}', f'"t": {w["t"]}']
    at = w.get("at", "E")
    parts.append('"at": "E"' if at == "E" else '"at": [' + ", ".join(f"({x}, {y})" for x, y in at) + "]")
    for k in ("burrowed", "mirror"):
        if w.get(k): parts.append(f'"{k}": True')
    if w.get("mirrorScale") is not None: parts.append(f'"mirrorScale": {w["mirrorScale"]}')
    if w.get("tier"): parts.append(f'"tier": "{w["tier"]}"')
    return "      {" + ", ".join(parts) + "},"

def fmt_event(e):
    parts = [f'"id": "{e["id"]}"']
    if "zone" in e: parts.append('"zone": [' + ", ".join(f"({x}, {y})" for x, y in e["zone"]) + "]")
    else:
        parts.append(f'"turn": {e["turn"]}')
        if e.get("repeat"): parts.append(f'"repeat": {e["repeat"]}')
    parts.append('"spawn": [' + ", ".join(f'"{a}"' for a in e["spawn"]) + "]")
    parts.append('"at": [' + ", ".join(f"({x}, {y})" for x, y in e["at"]) + "]")
    if e.get("burrowed"): parts.append('"burrowed": True')
    if e.get("tier"): parts.append(f'"tier": "{e["tier"]}"')
    if e.get("guardGroup"): parts.append(f'"guardGroup": "{e["guardGroup"]}"')
    return "      {" + ", ".join(parts) + "},"

def fmt_bonus(b):
    if b is None: return "None"
    if b == "keep": return '"keep"'
    if b["kind"] == "clear_bloom_patch":
        return '{"kind": "clear_bloom_patch", "tiles": [' + ", ".join(f"({x}, {y})" for x, y in b["tiles"]) + f'], "points": {b["points"]}}}'
    return f'{{"kind": "rescue_pilot", "at": ({b["at"][0]}, {b["at"][1]}), "name": "{b["name"]}", "points": {b["points"]}}}'

def fmt_entry(const, r):
    filevar = "H" if "House" in r["file"] else "W"
    lines = [f'  "{const}": {{', f'    "file": {filevar},', f'    "note": {r["note"]!r},', '    "waves": [']
    lines += [fmt_wave(w) for w in r["waves"]]
    lines.append("    ],")
    evs = r.get("events", [])
    if evs:
        lines.append('    "events": [')
        lines += [fmt_event(e) for e in evs]
        lines.append("    ],")
    else:
        lines.append('    "events": [],')
    lines.append(f'    "bonus": {fmt_bonus(r.get("bonus", "keep"))},')
    if r.get("params"): lines.append(f'    "params": {r["params"]!r},')
    lines.append("  },")
    return "\n".join(lines) + "\n"

new = load(sys.argv[1], "overrides").NEW
s = open(SPEC).read()
for const, r in new.items():
    m = re.search(rf'^  "{re.escape(const)}": \{{\n', s, re.M)
    block = fmt_entry(const, r)
    if m:
        end = s.index("\n  },\n", m.start()) + len("\n  },\n")
        s = s[:m.start()] + block + s[end:]
        print("replaced", const)
    else:
        k = s.rindex("\n}")
        s = s[:k] + "\n" + block.rstrip("\n") + s[k:]
        print("appended", const)
open(SPEC, "w").write(s)
# sanity: reimport
load(SPEC, "rework_specs_check")
print("spec file reloads OK")
