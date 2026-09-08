#!/usr/bin/env python3
"""Build the rating table (markdown) from the batch outputs in ratings/ (one sim:batch line per mission per file).
Mission rework pass, 8 Sep 2026. Run from anywhere: python3 design/mission_rework/rating_table.py"""
import re, os, glob, sys, json, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))

def parse(path):
    out = {}
    for f in ([path] if os.path.isfile(path) else glob.glob(os.path.join(path, "*.txt"))):
        for line in open(f):
            m = re.match(r"(mission_\S+)\s+(\w+)\s+WIN=\s*(\d+)/(\d+) \(\s*(\d+)%\)\s+LOSS=\s*(\d+)\s+CMD_DOWN=\s*(\d+)\s+TIMEOUT=\s*(\d+)\s+turns/win=\s*(\S+)\s+downed/run=(\S+)\s+lost/run=(\S+)\s+loss:kill=\s*(\S+?)%? turn=\s*(\S+?)%?(?:\s+bonus=\s*(\S+)%)?\s+squad=\[(.*)\]", line)
            if not m: continue
            mid, tier, w, n, pct, loss, cmd, to, tw, downed, lost, lk, lt, bonus, squad = m.groups()
            out[(mid, tier)] = dict(win=int(w), n=int(n), pct=int(pct), loss=int(loss), cmd=int(cmd), to=int(to), tw=tw, downed=float(downed), lost=float(lost), lk=lk, lt=lt, bonus=bonus, squad=squad)
    return out

hard = parse(os.path.join(HERE, "ratings", "hard_n50_seed5000_progression.txt"))
mod = parse(os.path.join(HERE, "ratings", "moderate_n25_seed7000_progression.txt"))
easy = parse(os.path.join(HERE, "ratings", "easy_n25_seed8000_progression.txt"))

# mission meta from TS via a tiny tsx script
meta = json.loads(subprocess.check_output(["npx", "tsx", "-e", """
import { ALL_MISSIONS_BY_ID } from "./src/data/allCampaigns";
const o: any = {};
for (const [id, m] of Object.entries(ALL_MISSIONS_BY_ID) as any) o[id] = { name: m.displayName, obj: m.objective, params: m.objectiveParams, bonus: m.bonusObjective?.kind ?? "" };
console.log(JSON.stringify(o));
"""], cwd=ROOT, text=True))

FLAGS = json.load(open(os.path.join(HERE, "rating_notes.json")))

def band(p):
    if p <= 10: return "Brutal"
    if p <= 30: return "Hard"
    if p <= 50: return "Firm"
    if p <= 80: return "Standard"
    return "Soft"

def short(name):
    return re.sub(r"^(Amaranth|House Amaranth) [IVX]+\.\d+ — ", "", name)

OBJ = {"eliminate_all": "brawl", "hold_zone": "hold", "extract_unit": "extract", "clear_bloom": "clear", "survive_n_turns": "survive", "contested_landing": "landing", "protect_asset": "protect"}
rows = []
for camp, prefix, label in [("W", "mission_amaranth_", "Warden"), ("HA", "mission_house_amaranth_", "House Amaranth")]:
    rows.append(f"\n### {label}\n")
    rows.append("| # | Mission | Type | Hard win | downed/run | lost/run | loss at kill% | Moderate | Easy | Band | Notes |")
    rows.append("|---|---|---|---|---|---|---|---|---|---|---|")
    for i in range(1, 37):
        mid = f"{prefix}{i}"
        h = hard.get((mid, "hard")); mo = mod.get((mid, "moderate")); ea = easy.get((mid, "easy"))
        m = meta[mid]
        typ = OBJ.get(m["obj"], m["obj"])
        tl = m["params"].get("turnLimit"); hu = m["params"].get("holdUntilTurn")
        typ2 = typ + (f" {hu}-{tl}" if hu else (f" TL{tl}" if typ in ("extract", "survive", "protect", "landing") and tl else ""))
        if m["bonus"]: typ2 += " +bonus"
        hw = f"{h['pct']}% ({h['win']}/{h['n']})" if h else "—"
        rows.append(f"| {camp}{i} | {short(m['name'])} | {typ2} | {hw} | {h['downed'] if h else '—'} | {h['lost'] if h else '—'} | {h['lk'] if h else '—'}% | {str(mo['pct'])+'%' if mo else '—'} | {str(ea['pct'])+'%' if ea else '—'} | {band(h['pct']) if h else '—'} | {FLAGS.get(mid, '')} |")
print("\n".join(rows))
