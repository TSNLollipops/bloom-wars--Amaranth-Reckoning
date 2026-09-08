#!/usr/bin/env python3
"""Apply mission rework specs to the campaign TS files.

Mission rework pass, 8 Sep 2026 (claude/Bloom_Wars_Build_Log_Addendum_MissionRework_08Sep2026.md).
Run from anywhere:  python3 design/mission_rework/apply_mission_rework.py [CONST ...]
The specs file next to this script is the source of truth for every mission's
enemyWaves, spawn events, bonusObjective and objectiveParams overrides; the two
campaign TS files are the generated side (same relationship as design/maps_*.py
vs src/data/maps*.ts). Edit the spec, re-run this, never hand-edit the waves.

Spec format (mission_rework_specs.py):
  REWORK = {
    "AMARANTH_MISSION_1": {
      "file": "src/data/campaignAmaranth.ts",
      "note": "one-paragraph design intent (goes into a comment above enemyWaves)",
      "waves": [ {"a": "bloom_crawlmass", "n": 12, "t": 1, "at": "E"},
                 {"a": "bloom_splitfang", "n": 3, "t": 3, "at": [(17,4),(17,6)], "burrowed": True} ],
      "events": [ {"id": "ev_x", "turn": 4, "repeat": 2, "spawn": ["bloom_undertow"], "at": [(3,2)], "burrowed": True},
                  {"id": "ev_y", "zone": [(3,2),(4,2)], "spawn": [...], "at": [...]} ],
      "bonus": {"kind": "clear_bloom_patch", "tiles": [(x,y),...], "points": 40}
            | {"kind": "rescue_pilot", "at": (x,y), "name": "...", "points": 40}
            | None (remove) | "keep" (leave as is),
      "params": {"turnLimit": 10}   # optional partial override of objectiveParams
    }
  }
Existing non-spawn events (dialogue/reveal/remove_from_roster) are preserved.
Existing spawn events are dropped and replaced by the spec's.
Idempotent: re-running with the same spec produces the same file.
"""
import re, sys, os, importlib.util
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
spec_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mission_rework_specs.py")
spec = importlib.util.spec_from_file_location("rework_specs", spec_path)
mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
REWORK = mod.REWORK
only = sys.argv[1:]  # optional subset of const names

MARK = "// REWORK 8 Sep 2026 (mission rework pass"

def find_obj(s, const):
    i = s.find(f"export const {const}: CampaignMission = {{")
    if i < 0: raise SystemExit(f"const {const} not found")
    j = s.find("\n};", i)
    return i, j + 3

def find_field(body, field):
    """Return (start, end) of `field: <value>,` inside body at top level of the object; None if absent."""
    m = re.search(rf"\n  {field}:", body)
    if not m: return None
    start = m.start() + 1
    k = m.end()
    # skip whitespace
    while body[k] in " \t\n": k += 1
    if body[k] in "[{":
        openc, closec = body[k], "]" if body[k] == "[" else "}"
        depth = 0; p = k
        in_str = None
        while p < len(body):
            c = body[p]
            if in_str:
                if c == "\\": p += 2; continue
                if c == in_str: in_str = None
            elif c in "\"'`": in_str = c
            elif body.startswith("//", p):
                p = body.index("\n", p); continue
            elif c == openc: depth += 1
            elif c == closec:
                depth -= 1
                if depth == 0: p += 1; break
            p += 1
        # consume trailing comma
        if body[p] == ",": p += 1
        return start, p
    else:
        p = body.index(",\n", k) + 1
        return start, p

def coord(c): return f"{{ x: {c[0]}, y: {c[1]} }}"
def coords(cs): return "[" + ", ".join(coord(c) for c in cs) + "]"

def emit_waves(waves, note):
    lines = ["  " + MARK + ") — " + note.replace("\n", "\n  // ")]
    lines.append("  enemyWaves: [")
    for w in waves:
        at = '"enemy_deploy"' if w.get("at", "E") == "E" else coords(w["at"])
        extra = ""
        if w.get("burrowed"): extra += ", burrowed: true"
        if w.get("mirror"): extra += ", mirrorPlayerSquad: true"
        if w.get("mirrorScale") is not None: extra += f", mirrorScale: {w['mirrorScale']}"
        if w.get("tier"): extra += f', tier: "{w["tier"]}"'
        lines.append(f'    {{ archetypeId: "{w["a"]}", count: {w["n"]}, atTurn: {w["t"]}, spawnAt: {at}{extra} }},')
    lines.append("  ],")
    return "\n".join(lines) + "\n"

def emit_event(e):
    if "zone" in e:
        trig = f'{{ type: "zone_entered", zone: {coords(e["zone"])} }}'
    else:
        rep = f', repeatEvery: {e["repeat"]}' if e.get("repeat") else ""
        trig = f'{{ type: "turn_start", turn: {e["turn"]}{rep} }}'
    ids = ", ".join(f'"{a}"' for a in e["spawn"])
    burrow = (", burrowed: true" if e.get("burrowed") else "") + (f', tier: "{e["tier"]}"' if e.get("tier") else "")
    once = "false" if e.get("repeat") else "true"
    gg = f', guardGroup: "{e["guardGroup"]}"' if e.get("guardGroup") else ""
    return (f'    {{\n      id: "{e["id"]}",\n      trigger: {trig},\n'
            f'      action: {{ type: "spawn", archetypeIds: [{ids}], at: {coords(e["at"])}{burrow} }},\n'
            f'      once: {once}{gg},\n    }},')

def split_events(events_src):
    """Return list of top-level event object source strings inside `events: [ ... ],`."""
    k = events_src.index("[") + 1
    end = events_src.rindex("]")
    inner = events_src[k:end]
    items = []; depth = 0; cur = []; in_str = None; p = 0
    while p < len(inner):
        c = inner[p]
        if in_str:
            cur.append(c)
            if c == "\\": cur.append(inner[p+1]); p += 2; continue
            if c == in_str: in_str = None
        elif inner.startswith("//", p):
            e = inner.index("\n", p); cur.append(inner[p:e + 1]); p = e + 1; continue
        elif c in "\"'`": in_str = c; cur.append(c)
        elif c == "{":
            depth += 1; cur.append(c)
        elif c == "}":
            depth -= 1; cur.append(c)
            if depth == 0:
                items.append("".join(cur).strip("\n")); cur = []
        elif depth > 0 or c in " \t\n": cur.append(c)
        p += 1
    return items

def emit_bonus(b):
    if b["kind"] == "clear_bloom_patch":
        return f'  bonusObjective: {{ kind: "clear_bloom_patch", patchTiles: {coords(b["tiles"])}, bonusPoints: {b["points"]} }},\n'
    return f'  bonusObjective: {{ kind: "rescue_pilot", npcSpawnAt: {coord(b["at"])}, npcDisplayName: "{b["name"]}", bonusPoints: {b["points"]} }},\n'

changed_files = {}
for const, r in REWORK.items():
    if only and const not in only: continue
    path = os.path.join(ROOT, r["file"])
    s = changed_files.get(path) or open(path).read()
    i, j = find_obj(s, const)
    body = s[i:j]
    # waves (+ strip any prior REWORK marker comment line)
    body = re.sub(r"  " + re.escape(MARK) + r"[^\n]*\n(?:  //[^\n]*\n)*", "", body)
    ws = find_field(body, "enemyWaves")
    body = body[:ws[0]] + emit_waves(r["waves"], r.get("note", "")) + body[ws[1]:].lstrip("\n")
    # events
    es = find_field(body, "events")
    kept = [it for it in split_events(body[es[0]:es[1]]) if '"spawn"' not in it.split("action")[1][:60] if "action" in it] if es else []
    new = [emit_event(e) for e in r.get("events", [])]
    all_items = [("    " + it.lstrip() if not it.startswith("    ") else it).rstrip().rstrip(",") + "," for it in kept if it.strip()] + new
    ev_src = "  events: [\n" + "\n".join(all_items) + "\n  ],\n" if all_items else "  events: [],\n"
    body = body[:es[0]] + ev_src + body[es[1]:].lstrip("\n")
    # bonus
    b = r.get("bonus", "keep")
    if b != "keep":
        bs = find_field(body, "bonusObjective")
        if bs: body = body[:bs[0]] + body[bs[1]:].lstrip("\n")
        if b:
            rp = find_field(body, "rewardPoints")
            body = body[:rp[0]] + emit_bonus(b) + body[rp[0]:]
    # params
    if r.get("params"):
        ps = find_field(body, "objectiveParams")
        cur = body[ps[0]:ps[1]]
        for k, v in r["params"].items():
            vv = f'"{v}"' if isinstance(v, str) else str(v)
            if re.search(rf"\b{k}:", cur): cur = re.sub(rf"\b{k}: (?:\"[^\"]*\"|[^,}}\s]+)", f"{k}: {vv}", cur)
            else: cur = cur.replace("}", f", {k}: {vv} }}", 1).replace("{ ,", "{")
        cur = re.sub(r"\s*\}(,?)\s*$", r" }\1", cur).replace('" ,', '",')
        body = body[:ps[0]] + cur + body[ps[1]:]
    s = s[:i] + body + s[j:]
    changed_files[path] = s
for path, s in changed_files.items():
    open(path, "w").write(s)
    print("patched", os.path.relpath(path, ROOT))
