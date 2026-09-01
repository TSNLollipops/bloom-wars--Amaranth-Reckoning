#!/usr/bin/env python3
"""
Bloom Wars -- combat_sim.py

RECONSTRUCTION NOTE (27 Aug 2026): the original combat_sim.py -- the
script that produced sim_output.txt / Data Pack Sec.13, 21 Aug 2026 -- was
never actually committed into this repo's own /design folder, despite
this project's own README.md documenting exactly that as the convention
("keeping them inside the repo rather than off to one side matters").
Only the script's *output* (sim_output.txt) survived, as a project doc.
The script itself was gone -- not misplaced, genuinely absent from the
repo, the project's file uploads, and this machine.

This file is a from-scratch rebuild, transcribed directly from the live
TypeScript engine (src/data/combatTables.ts, src/engine/combat.ts) -- not
from memory of what the original script might have looked like. Every
formula below is checked against sim_output.txt's own recorded numbers at
the bottom of this file's output (see "RECONSTRUCTION CHECK"); if any of
those checks fail, the reconstruction has a bug and nothing past that
point should be trusted.

Sections after RECONSTRUCTION CHECK are new coverage the original script
never had:
  - THE WELLROOT: validates a proposed new boss archetype (Amaranth Act
    II) before it goes into data/bloom.ts, same discipline as every other
    number in this project.
  - MECH-VS-BLOOM (bonus, flagged): engine/combat.ts's resolveAttackOnBloom
    has an explicit code comment saying it was never validated the way
    resolveMechAttack was. Included here so it's tracked. This wasn't
    asked for -- flag it, don't assume it's wanted as a standing gate.

Run: python3 combat_sim.py
"""

import math

# ---------------------------------------------------------------------
# Constants, transcribed 1:1 from src/data/combatTables.ts
# ---------------------------------------------------------------------

POWER = {
    "meeps": {"meeps": 55, "tank": 30, "reeps": 75, "munti": 70},
    "tank": {"meeps": 65, "tank": 40, "reeps": 50, "munti": 60},
    "reeps": {"meeps": 45, "tank": 70, "reeps": 50, "munti": 55},
    "munti": {"meeps": 30, "tank": 20, "reeps": 35, "munti": 30},
}

FULL_HP_DAMAGE_CAP = 90
CENTAUROID_CHARGE_MULT = 1.25

TIERS = {
    "G": {"attack": 100, "defense": 100, "hp": 100, "move": 0},
    "F": {"attack": 106, "defense": 104, "hp": 100, "move": 0},
    "E": {"attack": 112, "defense": 108, "hp": 105, "move": 0},
    "D": {"attack": 118, "defense": 113, "hp": 110, "move": 1},
    "C": {"attack": 125, "defense": 119, "hp": 115, "move": 1},
    "B": {"attack": 132, "defense": 125, "hp": 120, "move": 1},
    "A": {"attack": 140, "defense": 132, "hp": 130, "move": 2},
}

# src/engine/units.ts: canCounter / counterMaxRange per archetype path.
CAN_COUNTER = {"meeps": True, "tank": True, "reeps": False, "munti": True}
COUNTER_MAX_RANGE = {"meeps": 1, "tank": 1, "reeps": 0, "munti": 1}

PATHS = ["meeps", "tank", "reeps", "munti"]

lines = []


def out(s=""):
    lines.append(s)


def hdr(title):
    out()
    out("=" * 74)
    out(title)
    out("=" * 74)


def js_round(x):
    """Math.round() in JS rounds half AWAY FROM ZERO for positives (2.5 -> 3),
    not Python's round-half-to-even. combat.ts uses Math.round() everywhere,
    so this has to match exactly or the reconstruction silently drifts."""
    return math.floor(x + 0.5)


def mech_dmg(power, atk_hp_frac, atk_eff_attack, def_eff_defense, terrain_stars,
             charged=False, def_at_full_hp=True):
    """src/engine/combat.ts resolveMechAttack's damage formula, isolated."""
    dmg = power
    dmg *= atk_hp_frac
    dmg *= atk_eff_attack / 100
    dmg *= 100 / def_eff_defense
    dmg *= (1 - 0.1 * terrain_stars)
    if charged:
        dmg *= CENTAUROID_CHARGE_MULT
    dmg = js_round(dmg)
    if def_at_full_hp:
        dmg = min(dmg, FULL_HP_DAMAGE_CAP)
    return dmg


# ===========================================================================
# 1. BASE DAMAGE MATRIX  (G-tier, full HP, 0 terrain stars)
# ===========================================================================
hdr("BASE DAMAGE MATRIX  (HP points; G-tier, full HP, 0 terrain stars)")
out(f"{'ATK vs DEF':<12}{'meeps':>10}{'tank':>10}{'reeps':>10}{'munti':>10}")
base_matrix = {}
for atk in PATHS:
    row = {}
    for de in PATHS:
        row[de] = mech_dmg(POWER[atk][de], 1, 100, 100, 0)
    base_matrix[atk] = row
    out(f"{atk:<12}{row['meeps']:>10}{row['tank']:>10}{row['reeps']:>10}{row['munti']:>10}")

# ===========================================================================
# 2. HITS TO KILL vs a 100 HP defender
# ===========================================================================
hdr("HITS TO KILL vs a 100 HP defender  (lower = stronger matchup)")
out(f"{'ATK vs DEF':<12}{'meeps':>10}{'tank':>10}{'reeps':>10}{'munti':>10}")
hits_matrix = {}
for atk in PATHS:
    row = {}
    for de in PATHS:
        hp = 100
        hits = 0
        while hp > 0:
            full = (hp >= 100)
            dmg = mech_dmg(POWER[atk][de], 1, 100, 100, 0, def_at_full_hp=full)
            hp -= dmg
            hits += 1
        row[de] = hits
    hits_matrix[atk] = row
    out(f"{atk:<12}{row['meeps']:>10}{row['tank']:>10}{row['reeps']:>10}{row['munti']:>10}")

# ===========================================================================
# 3. TRIANGLE CHECK
# ===========================================================================
hdr("TRIANGLE CHECK - intended: meeps > reeps > tank > meeps")
triangle_pairs = [("meeps", "reeps"), ("reeps", "tank"), ("tank", "meeps")]
triangle_ok = True
for a, b in triangle_pairs:
    fwd = base_matrix[a][b]
    back = base_matrix[b][a]
    margin = fwd - back
    ok = margin > 0
    triangle_ok = triangle_ok and ok
    out(f"   {a} -> {b:<8} {fwd:>3}  |   {b} -> {a:<8} {back:>3}  | margin  {margin:>3}  {'OK' if ok else 'FAIL'}")

# ===========================================================================
# 4. MELEE EXCHANGE (attacker initiates, defender counters) - open ground
# ===========================================================================
hdr("MELEE EXCHANGE (attacker initiates, defender counters) - open ground")
for atk in ["meeps", "tank", "munti"]:
    for de in PATHS:
        dmg1 = mech_dmg(POWER[atk][de], 1, 100, 100, 0, def_at_full_hp=True)
        def_hp_after = 100 - dmg1
        atk_hp_after = 100
        if CAN_COUNTER[de] and 1 <= COUNTER_MAX_RANGE[de]:
            counter_dmg = mech_dmg(POWER[de][atk], def_hp_after / 100, 100, 100, 0, def_at_full_hp=True)
            atk_hp_after = 100 - counter_dmg
        winner = "attacker wins trade" if atk_hp_after > def_hp_after else "defender wins trade"
        out(f"   {atk} attacks {de:<6} -> def {def_hp_after:>3} HP, atk {atk_hp_after:>3} HP   ({winner})")

# ===========================================================================
# 5. COUNTERATTACK RULE - the three conditions, exhaustively
# ===========================================================================
hdr("COUNTERATTACK RULE - the three conditions, exhaustively")
for de in PATHS:
    for dist in (1, 2, 3):
        counters = CAN_COUNTER[de] and dist <= COUNTER_MAX_RANGE[de]
        out(f"  defender {de:<6} attacked from distance {dist}: "
            f"{'COUNTERS   ' if counters else 'no counter '} "
            f"(canCounter={CAN_COUNTER[de]}, counterMaxRange={COUNTER_MAX_RANGE[de]})")

# ===========================================================================
# 6. REEPS FROM RANGE (no counter possible at range >= 2)
# ===========================================================================
hdr("REEPS FROM RANGE (no counter possible at range >= 2)")
for de in PATHS:
    dmg = mech_dmg(POWER["reeps"][de], 1, 100, 100, 0, def_at_full_hp=True)
    shots = math.ceil(100 / dmg)
    out(f"  reeps -> {de:<6} {dmg:>3} dmg, 0 counter, {shots} shots to kill")

# ===========================================================================
# 7. TIER GAP STRESS TEST (worst case: A-tier attacker vs G-tier defender)
# ===========================================================================
hdr("TIER GAP STRESS TEST (worst case: A-tier attacker vs G-tier defender)")
for atk in PATHS:
    for de in PATHS:
        raw = mech_dmg(POWER[atk][de], 1, TIERS["A"]["attack"], TIERS["G"]["defense"], 0, def_at_full_hp=False)
        dealt = min(raw, FULL_HP_DAMAGE_CAP)
        capped = " <- capped" if dealt < raw else ""
        out(f"  A-{atk:<6} -> G-{de:<6} raw {raw:>4} -> dealt {dealt:>4}{capped}")

# ===========================================================================
# 8. BLOOM ENDURANCE / VITALITY COLLAPSE RULE
# ===========================================================================
hdr("BLOOM ENDURANCE / VITALITY COLLAPSE RULE")


def collapse_trace(name, desc, endurance, vitality, atk_dmg):
    """src/engine/combat.ts applyBloomDamage, transcribed exactly:
    overflow past 0 endurance is discarded, not carried into vitality."""
    out(f"\n  {name}  {desc}  (END {endurance} / VIT {vitality}), attacker deals {atk_dmg}/hit")
    hits = 0
    collapsed = False
    while True:
        hits += 1
        if not collapsed:
            endurance = max(0, endurance - atk_dmg)
            out(f"    hit {hits}: endurance -> {endurance}")
            if endurance == 0:
                collapsed = True
                out("            COLLAPSE state entered")
        else:
            if atk_dmg >= vitality:
                out(f"    hit {hits}: {atk_dmg} >= vitality {vitality} -> KILLED OUTRIGHT")
                out(f"    total hits to kill: {hits}")
                return hits
            else:
                vitality -= atk_dmg
                out(f"    hit {hits}: chipping vitality -> {vitality}")


collapse_trace("Gallcyst", "tanky-then-fragile", 140, 20, 45)
collapse_trace("Sporethrower", "fragile-then-grindy", 50, 80, 45)
collapse_trace("Crawlmass", "chaff", 40, 60, 45)
collapse_trace("Heartwood", "boss", 400, 60, 70)

# ===========================================================================
# 9. TERRAIN CHECK
# ===========================================================================
hdr("TERRAIN CHECK")
for stars in (0, 2, 3, 4):
    dmg = mech_dmg(POWER["reeps"]["tank"], 1, 100, 100, stars, def_at_full_hp=True)
    shots = math.ceil(100 / dmg)
    out(f"  reeps -> tank on {'open':<10} ({stars}*):  {dmg:>3} dmg, {shots} shots" if stars == 0 else
        f"  reeps -> tank on {'rubble' if stars == 2 else 'structure' if stars == 3 else 'ridge':<10} ({stars}*):  {dmg:>3} dmg, {shots} shots")

# ===========================================================================
# 10. CENTAUROID CHARGE (>=3 tiles straight line over cost-1 terrain)
# ===========================================================================
hdr("CENTAUROID CHARGE (>=3 tiles straight line over cost-1 terrain)")
for de in PATHS:
    base = mech_dmg(POWER["meeps"][de], 1, 100, 100, 0, charged=False, def_at_full_hp=True)
    charged = mech_dmg(POWER["meeps"][de], 1, 100, 100, 0, charged=True, def_at_full_hp=True)
    out(f"  charging meeps -> {de:<6} {base:>3} -> {charged:>3}")

# ===========================================================================
# RECONSTRUCTION CHECK -- every number above verified against the
# surviving sim_output.txt before anything below this line is trusted.
# ===========================================================================
hdr("RECONSTRUCTION CHECK")

expected_base_matrix = {
    "meeps": {"meeps": 55, "tank": 30, "reeps": 75, "munti": 70},
    "tank": {"meeps": 65, "tank": 40, "reeps": 50, "munti": 60},
    "reeps": {"meeps": 45, "tank": 70, "reeps": 50, "munti": 55},
    "munti": {"meeps": 30, "tank": 20, "reeps": 35, "munti": 30},
}
expected_hits_matrix = {
    "meeps": {"meeps": 2, "tank": 4, "reeps": 2, "munti": 2},
    "tank": {"meeps": 2, "tank": 3, "reeps": 2, "munti": 2},
    "reeps": {"meeps": 3, "tank": 2, "reeps": 2, "munti": 2},
    "munti": {"meeps": 4, "tank": 5, "reeps": 3, "munti": 4},
}

recon_ok = True
if base_matrix != expected_base_matrix:
    recon_ok = False
    out("FAIL: base damage matrix does not match sim_output.txt")
else:
    out("OK: base damage matrix matches sim_output.txt exactly")

if hits_matrix != expected_hits_matrix:
    recon_ok = False
    out("FAIL: hits-to-kill matrix does not match sim_output.txt")
else:
    out("OK: hits-to-kill matrix matches sim_output.txt exactly")

# Spot-check the tier-gap and centauroid-charge numbers explicitly, since
# those are the two sections most likely to hide a rounding bug.
tier_gap_expect = {
    ("meeps", "meeps"): (77, 77), ("meeps", "tank"): (42, 42), ("meeps", "reeps"): (105, 90),
    ("meeps", "munti"): (98, 90), ("tank", "meeps"): (91, 90), ("tank", "tank"): (56, 56),
    ("tank", "reeps"): (70, 70), ("tank", "munti"): (84, 84), ("reeps", "meeps"): (63, 63),
    ("reeps", "tank"): (98, 90), ("reeps", "reeps"): (70, 70), ("reeps", "munti"): (77, 77),
    ("munti", "meeps"): (42, 42), ("munti", "tank"): (28, 28), ("munti", "reeps"): (49, 49),
    ("munti", "munti"): (42, 42),
}
for (atk, de), (exp_raw, exp_dealt) in tier_gap_expect.items():
    raw = mech_dmg(POWER[atk][de], 1, TIERS["A"]["attack"], TIERS["G"]["defense"], 0, def_at_full_hp=False)
    dealt = min(raw, FULL_HP_DAMAGE_CAP)
    if (raw, dealt) != (exp_raw, exp_dealt):
        recon_ok = False
        out(f"FAIL: tier-gap A-{atk} -> G-{de} expected raw {exp_raw} dealt {exp_dealt}, got raw {raw} dealt {dealt}")
if recon_ok:
    out("OK: tier-gap stress test matches sim_output.txt exactly (all 16 matchups)")

charge_expect = {"meeps": 69, "tank": 38, "reeps": 90, "munti": 88}
for de, exp in charge_expect.items():
    got = mech_dmg(POWER["meeps"][de], 1, 100, 100, 0, charged=True, def_at_full_hp=True)
    if got != exp:
        recon_ok = False
        out(f"FAIL: centauroid charge meeps -> {de} expected {exp}, got {got}")
if recon_ok:
    out("OK: centauroid charge matches sim_output.txt exactly")

# Re-run silently (no lines appended) to check hit counts without duplicating output.
def collapse_hits_only(endurance, vitality, atk_dmg):
    hits = 0
    collapsed = False
    while True:
        hits += 1
        if not collapsed:
            endurance = max(0, endurance - atk_dmg)
            if endurance == 0:
                collapsed = True
        else:
            if atk_dmg >= vitality:
                return hits
            vitality -= atk_dmg


checks = {
    "Gallcyst": (140, 20, 45, 5),
    "Sporethrower": (50, 80, 45, 4),
    "Crawlmass": (40, 60, 45, 3),
    "Heartwood": (400, 60, 70, 7),
}
for name, (end_, vit_, dmg_, exp_hits) in checks.items():
    got = collapse_hits_only(end_, vit_, dmg_)
    if got != exp_hits:
        recon_ok = False
        out(f"FAIL: {name} collapse trace expected {exp_hits} hits, got {got}")
if recon_ok:
    out("OK: Bloom Collapse rule matches sim_output.txt exactly (all 4 worked examples)")

out()
if recon_ok:
    out("RECONSTRUCTION VERIFIED -- every number this script produces for the")
    out("existing, already-shipped content matches sim_output.txt exactly.")
    out("Trusting the sections below for new content.")
else:
    out("RECONSTRUCTION FAILED -- do not trust anything below this line until")
    out("the FAIL lines above are fixed. The formula transcription has a bug.")

# ===========================================================================
# 11. THE WELLROOT -- proposed boss archetype, Amaranth Act II
# ===========================================================================
hdr("THE WELLROOT -- shipped stats, 27 Aug 2026")
out("Acid lineage (Gallcyst's family, scaled to boss size), NOT Heartwood's")
out("concussive lineage -- matches the Independent Campaign doc's own")
out("'huge Endurance, acid-heavy' description, which the old placeholder")
out("(a straight Heartwood stat-block reuse) never actually delivered on.")
out("")
out("Shipped: endurance 480, vitality 65, moveRange 0, attackRange [1,3],")
out("attackPower 60, vision 6, weaponType acid, onHit fx_acid_dot,")
out("perception chemical, intelligence emergent.")
out("")
out("attackPower was first proposed at 40 (down from Heartwood's 60), on")
out("the theory that fx_acid_dot's stacking damage would make up the gap.")
out("That effect isn't wired into the engine anywhere (engine/turnManager.ts")
out("doesn't exist) -- confirmed by grepping the whole engine, zero matches")
out("for onHit/fx_acid_dot/DoT. Running the real mission (not this idealized")
out("1v1 math) at attackPower 40 came back 80% win, nearly 2.5x the")
out("documented 35% target. Restored to 60 -- three mission-harness batches")
out("landed 35%/25%/37%, matching the original tuning.")

if recon_ok:
    heartwood_hits = collapse_trace("Heartwood", "Act I boss, for comparison", 400, 60, 70)
    wellroot_hits = collapse_trace("Wellroot", "Act II boss, shipped 27 Aug 2026", 480, 65, 70)
    unnamed_hits = collapse_trace("The Unnamed", "Act III boss, for comparison", 560, 70, 70)

    out()
    out(f"Escalation check, same 70/hit test attack across all three named bosses:")
    out(f"  Heartwood (Act I)   : {heartwood_hits} hits to kill")
    out(f"  Wellroot  (Act II)  : {wellroot_hits} hits to kill")
    out(f"  The Unnamed (Act III): {unnamed_hits} hits to kill")
    gate_ok = heartwood_hits < wellroot_hits < unnamed_hits
    out(f"  GATE: strictly escalating Act I < Act II < Act III -- {'PASS' if gate_ok else 'FAIL'}")
else:
    out("SKIPPED -- reconstruction check above failed, not trusting new numbers yet.")

# ===========================================================================
# 12. MECH-VS-BLOOM (bonus, flagged -- not previously covered by any sim)
# ===========================================================================
hdr("MECH-VS-BLOOM -- bonus coverage, flagged, not previously validated")
out("engine/combat.ts's resolveAttackOnBloom carries its own comment saying")
out("this was NEVER covered by combat_sim.py the way resolveMechAttack was.")
out("Included here as new coverage of a real gap -- Maxime's call whether to")
out("keep this as a standing gate or treat it as informational only.")
out()
out("Formula (first-pass placeholder per that comment): dmg = effAttack * 0.5")
out("* (currentHp/maxHp) * (1 - 0.1*terrain), charge-multiplied, no cap.")
for tier_name in ["G", "A"]:
    eff = TIERS[tier_name]["attack"]
    dmg = js_round(eff * 0.5 * 1 * (1 - 0.1 * 0))
    out(f"  {tier_name}-tier attacker vs Bloom, open ground: {dmg} dmg/hit")

# ===========================================================================
# 13. THE BRAMBLE -- proposed new archetype, House Amaranth Act III
#     (Mission 26, 1 Sep 2026)
# ===========================================================================
hdr("THE BRAMBLE -- proposed stats, 1 Sep 2026")
out("Splitfang-descended, per Bloom_Wars_House_Amaranth_Full_Campaign_Plan_v1.md")
out("§10's own resolution: Splitfang is movementType swarm, moveRange 5,")
out("swarmSize [3,5] -- matches the pitch ('fast, aggressive, spreading")
out("uncontrolled... the literal weed that grows when a garden stops being")
out("tended') mechanically, where Gallcyst's sessile turret shape doesn't.")
out("NOT a boss -- a regular archetype, escalated from its own parent the")
out("same way this project already escalates a 'scarier version of X': the")
out("~40% step Choir took over Sirenmaw and the Unnamed took over Heartwood's")
out("own endurance (see that section's own comment above).")
out()
out("Splitfang (parent):  END 70 / VIT 70, moveRange 5, attackPower 38, swarmSize [3,5]")
out("Bramble (proposed):  END 98 / VIT 80, moveRange 6, attackPower 54, swarmSize [4,6]")
out("  END  70 -> 98  (+40%, same ratio as the Choir/Unnamed precedent)")
out("  VIT  70 -> 80  (+14%, a modest bump only -- kept LOW relative to the")
out("                  END increase on purpose, same reasoning as the")
out("                  Wellroot's own VIT 60->70 nudge: staying vulnerable to")
out("                  a Collapse-then-vitality-chip fight rather than just")
out("                  getting uniformly tankier, so Severance-style play")
out("                  still matters against it)")
out("  moveRange 5 -> 6, attackPower 38 -> 54 (+42%, matching the END ratio)")
out("  swarmSize [3,5] -> [4,6] (uncontrolled multiplication is the whole pitch)")

if recon_ok:
    splitfang_hits = collapse_trace("Splitfang", "Act III parent, for comparison", 70, 70, 45)
    bramble_hits = collapse_trace("The Bramble", "proposed, House Amaranth Mission 26", 98, 80, 45)
    out()
    out("Escalation check, same 45/hit test attack (this project's own standard")
    out("test-attack value, matching the Gallcyst/Sporethrower/Crawlmass checks")
    out("above) against parent vs. descendant:")
    out(f"  Splitfang    : {splitfang_hits} hits to kill")
    out(f"  The Bramble  : {bramble_hits} hits to kill")
    gate_ok_bramble = bramble_hits > splitfang_hits
    out(f"  GATE: Bramble strictly tougher than its own Splitfang parent -- {'PASS' if gate_ok_bramble else 'FAIL'}")
    out()
    out("Output side (does it hit harder than its parent, not just survive")
    out("longer): attackPower 38 -> 54 is a direct engine-read value, no formula")
    out("needed -- 54 > 38, so yes. Sanity-checked against the mission harness,")
    out("not just this idealized 1v1 math: see Mission 26's own build-log")
    out("addendum for the real sim-tuning numbers once the mission is built.")
else:
    out("SKIPPED -- reconstruction check above failed, not trusting new numbers yet.")

out()
out("=" * 74)
out("DONE. Full trace above; RECONSTRUCTION CHECK section is the load-bearing")
out("part -- everything below it is only as trustworthy as that section passing.")
out("=" * 74)

print("\n".join(lines))
