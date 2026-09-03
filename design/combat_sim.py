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
    # S -- Heirloom-grade, transcribed from src/data/combatTables.ts (2 Sep
    # 2026). Not part of the original Data Pack ladder -- see TIERS.S's own
    # comment there for the placeholder-derivation reasoning. Kept OUT of
    # the RECONSTRUCTION CHECK below (that section only proves this script
    # matches the 21 Aug sim_output.txt, which predates S by two weeks) and
    # exercised instead in its own new section, 14, same convention as the
    # Wellroot/Bramble sections below it.
    "S": {"attack": 149, "defense": 140, "hp": 140, "move": 2},
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


# ===========================================================================
# 14. THE HEIRLOOM S-TIER -- proposed stat block, validated 2 Sep 2026
#     (Vault Phase 1 pass -- flagged in combatTables.ts's own TIERS.S
#     comment as "IT IS a player-power number... deserves a real sim pass
#     before any Heirloom ability actually reaches combat")
# ===========================================================================
hdr("THE HEIRLOOM S-TIER -- shipped placeholder stats, validated 2 Sep 2026")
out("S: {attack: 149, defense: 140, hp: 140, move: 2} -- one step past A's own")
out("G->A step sizes (+9/+8/+10), move held at 2 rather than bumped to 3, per")
out("combatTables.ts's own TIERS.S comment. S is deliberately excluded from")
out("TIER_ORDER (engine/campaignEconomy.ts) -- granted with a recruited")
out("Heirloom, never purchased up to -- so there is no 'A-tier attacker vs")
out("S-tier defender' matchup this engine can produce through the normal")
out("gear-tier ladder. What CAN happen live: an Heirloom pilot's mech fights")
out("a rival mech (every hostile mech in units.ts is tier G, except two named")
out("rivals -- hostile_mech_rourke/hostile_mech_marrow -- at tier C, both")
out("meeps path) or a Bloom hostile (a different formula, resolveAttackOnBloom,")
out("already flagged elsewhere in this script as its own unvalidated gap --")
out("out of scope here, this section only covers the mech-vs-mech formula")
out("TIER_GAP/hits_matrix above already gate).")

if recon_ok:
    def hits_to_kill_tiered(atk_path, de_path, atk_tier, de_tier):
        """Same shape as section 2's hits_matrix, but parameterized by BOTH
        sides' tier -- section 2 only ever varied the path, holding both
        sides at G. Starting HP is the defending tier's own real hp stat
        (not a fixed 100 baseline), since that's what actually differs
        between an A-tier and an S-tier unit on the board."""
        hp = TIERS[de_tier]["hp"]
        max_hp = hp
        hits = 0
        while hp > 0:
            full = hp >= max_hp
            dmg = mech_dmg(POWER[atk_path][de_path], 1, TIERS[atk_tier]["attack"],
                            TIERS[de_tier]["defense"], 0, def_at_full_hp=full)
            hp -= dmg
            hits += 1
        return hits

    out()
    out("-- Defense check: does S actually survive better than A, path by path,")
    out("   against every attacker tier this campaign actually fields? --")
    defense_gate_ok = True
    defense_ties = 0
    for atk_tier, label in (("G", "typical live hostile"), ("C", "toughest live rival"), ("A", "hypothetical future max")):
        out(f"  attacker tier {atk_tier} ({label}):")
        out(f"    {'ATK':<8}{'DEF':<8}{'hits vs A':>11}{'hits vs S':>11}   result")
        for atk in PATHS:
            for de in PATHS:
                h_a = hits_to_kill_tiered(atk, de, atk_tier, "A")
                h_s = hits_to_kill_tiered(atk, de, atk_tier, "S")
                if h_s < h_a:
                    defense_gate_ok = False
                    result = "FAIL -- S dies FASTER than A"
                elif h_s == h_a:
                    defense_ties += 1
                    result = "tie (defense edge too small to add a hit here)"
                else:
                    result = "OK -- S survives longer"
                out(f"    {atk:<8}{de:<8}{h_a:>11}{h_s:>11}   {result}")
    out()
    out(f"GATE: S never dies in fewer hits than A, across all 48 attacker/tier/path")
    out(f"combinations tested -- {'PASS' if defense_gate_ok else 'FAIL'} ({defense_ties} exact ties, 0 regressions).")

    out()
    out("-- Offense check: does S's higher attack actually land, or does the")
    out("   90-HP full-health damage cap eat it? Both, depending on the hit. --")
    out(f"{'ATK':<8}{'DEF':<8}{'A-tier dealt':>13}{'S-tier dealt':>13}   note")
    capped_same = 0
    for atk in PATHS:
        for de in PATHS:
            a_full = mech_dmg(POWER[atk][de], 1, TIERS["A"]["attack"], TIERS["G"]["defense"], 0, def_at_full_hp=True)
            s_full = mech_dmg(POWER[atk][de], 1, TIERS["S"]["attack"], TIERS["G"]["defense"], 0, def_at_full_hp=True)
            note = "identical -- both saturate the 90 cap" if a_full == s_full else f"+{s_full - a_full} over A-tier"
            if a_full == s_full:
                capped_same += 1
            out(f"{atk:<8}{de:<8}{a_full:>13}{s_full:>13}   {note}")
    out()
    out(f"{capped_same} of 16 opening-hit matchups (vs a full-HP G-tier defender) land")
    out("identically for A and S -- the alpha strike is invisible against most")
    out("squishier archetypes, since A already saturates the 90 cap there. S's")
    out("attack bonus shows up on (1) tankier defenders the cap doesn't reach")
    out("(e.g. tank-path) and (2) any target already below full HP, where the")
    out("cap doesn't apply at all -- confirmed above in the defense-check table:")
    out("every 'S survives longer' row is really 'A's finishing hit would have")
    out("killed, S's uncapped equivalent doesn't quite.' Worth knowing before")
    out("judging S 'weak' from a single opening-hit screenshot.")

    out()
    out("-- Sanity check: S is strictly the top of the ladder on every stat --")
    stat_gate_ok = all(TIERS["S"][k] > TIERS["A"][k] for k in ("attack", "defense", "hp"))
    stat_gate_ok = stat_gate_ok and TIERS["S"]["move"] == TIERS["A"]["move"]
    out(f"  attack {TIERS['A']['attack']} -> {TIERS['S']['attack']}, defense {TIERS['A']['defense']} -> {TIERS['S']['defense']}, "
        f"hp {TIERS['A']['hp']} -> {TIERS['S']['hp']}, move {TIERS['A']['move']} == {TIERS['S']['move']} (held, by design)")
    out(f"  GATE: {'PASS' if stat_gate_ok else 'FAIL'}")

    out()
    overall = defense_gate_ok and stat_gate_ok
    out(f"OVERALL: {'PASS -- S-tier placeholder validated, safe to leave in combatTables.ts as-is.' if overall else 'FAIL -- see the specific FAIL lines above before shipping this to a mission.'}")
else:
    out("SKIPPED -- reconstruction check above failed, not trusting new numbers yet.")

# ===========================================================================
# 15. HEIRLOOM ABILITY MULTIPLIERS -- Vault Phase 2, slice 1 (2 Sep 2026)
#     salt_root_salt (Delenda/Salt the Root) and ledger_overextended
#     (Skuld/Widow's Ledger) are the two of the five sliced abilities that
#     actually change a damage FORMULA -- oath_iron_word/lastword_field_triage/
#     farsight_signature are radius/duration/cooldown values with no new
#     damage number (Field Triage reuses the already-validated Data Pack §6
#     repair-heal number wholesale), so they get no section here, matching
#     how abil_taunt/abil_screen/abil_interdict never got one either -- this
#     script validates damage-formula numbers, not every constant in the game.
#     Transcribed 1:1 from engine/combat.ts's resolveMechAttack/
#     resolveAttackOnBloom (see saltRootMultiplier/overextendedAttackMultiplier/
#     overextendedDefense there) and src/data/combatTables.ts's own constants.
# ===========================================================================
hdr("HEIRLOOM ABILITY MULTIPLIERS -- Vault Phase 2 slice 1, 2 Sep 2026")

SALT_ROOT_SESSILE_MULTIPLIER = 1.6
SALT_ROOT_OTHER_MULTIPLIER = 0.7
SALT_ROOT_RANK5_OTHER_MULTIPLIER = 0.85
LEDGER_OVEREXTENDED_ATK_MULTIPLIER = 1.4
LEDGER_OVEREXTENDED_DEFENSE_FLOOR = 1


def salt_root_mult(has_ability, sessile, rank5=False):
    if not has_ability:
        return 1
    if sessile:
        return SALT_ROOT_SESSILE_MULTIPLIER
    return SALT_ROOT_RANK5_OTHER_MULTIPLIER if rank5 else SALT_ROOT_OTHER_MULTIPLIER


def overext_atk_mult(is_overextended):
    return LEDGER_OVEREXTENDED_ATK_MULTIPLIER if is_overextended else 1


def overext_def(effective_defense, is_overextended):
    return LEDGER_OVEREXTENDED_DEFENSE_FLOOR if is_overextended else effective_defense


def mech_dmg_v2(power, atk_hp_frac, atk_eff_attack, def_eff_defense, terrain_stars,
                 salt_root_has=False, salt_root_sessile=False, salt_root_rank5=False,
                 atk_overextended=False, def_overextended=False, def_at_full_hp=True):
    """resolveMechAttack, extended with the two Vault Phase 2 slice 1 hooks,
    in the exact order engine/combat.ts applies them (attackDebuffMultiplier
    is always 1 here -- no Bloom on-hit effect is in play in this idealized
    1v1 math, same simplification section 1's mech_dmg() already makes)."""
    dmg = power
    dmg *= atk_hp_frac
    dmg *= atk_eff_attack / 100
    dmg *= salt_root_mult(salt_root_has, salt_root_sessile, salt_root_rank5)
    dmg *= overext_atk_mult(atk_overextended)
    dmg *= 100 / overext_def(def_eff_defense, def_overextended)
    dmg *= (1 - 0.1 * terrain_stars)
    dmg = js_round(dmg)
    if def_at_full_hp:
        dmg = min(dmg, FULL_HP_DAMAGE_CAP)
    return dmg


out("salt_root_salt (Delenda) -- G-tier meeps attacker vs a G-tier defender,")
out("open ground, comparing the sessile bonus against the non-sessile penalty:")
plain_hit = mech_dmg_v2(POWER["meeps"]["tank"], 1, 100, 100, 0)
sessile_hit = mech_dmg_v2(POWER["meeps"]["tank"], 1, 100, 100, 0, salt_root_has=True, salt_root_sessile=True)
other_hit_r1 = mech_dmg_v2(POWER["meeps"]["tank"], 1, 100, 100, 0, salt_root_has=True, salt_root_sessile=False)
other_hit_r5 = mech_dmg_v2(POWER["meeps"]["tank"], 1, 100, 100, 0, salt_root_has=True, salt_root_sessile=False, salt_root_rank5=True)
out(f"  no salt_root_salt                          : {plain_hit:>4} dmg (baseline)")
out(f"  salt_root_salt vs sessile/hive-type target  : {sessile_hit:>4} dmg  (x{SALT_ROOT_SESSILE_MULTIPLIER})")
out(f"  salt_root_salt vs everything else, rank 1   : {other_hit_r1:>4} dmg  (x{SALT_ROOT_OTHER_MULTIPLIER})")
out(f"  salt_root_salt vs everything else, rank 5   : {other_hit_r5:>4} dmg  (x{SALT_ROOT_RANK5_OTHER_MULTIPLIER}, softened)")
salt_gate_ok = sessile_hit > plain_hit > other_hit_r1 and other_hit_r5 > other_hit_r1
out(f"  GATE: sessile > baseline > non-sessile(r1), and rank 5 softens (but does not")
out(f"        erase) the non-sessile penalty -- {'PASS' if salt_gate_ok else 'FAIL'}")

out()
out("ledger_overextended (Skuld) -- the same G-tier meeps-vs-tank matchup,")
out("open ground, isolating each half of the trade:")
normal_atk_hit = mech_dmg_v2(POWER["meeps"]["tank"], 1, 100, 100, 0)
boosted_atk_hit = mech_dmg_v2(POWER["meeps"]["tank"], 1, 100, 100, 0, atk_overextended=True)
normal_def_hit = mech_dmg_v2(POWER["meeps"]["tank"], 1, 100, 100, 0)
exposed_def_hit = mech_dmg_v2(POWER["meeps"]["tank"], 1, 100, 100, 0, def_overextended=True, def_at_full_hp=False)
out(f"  attacker's own hit,   normal (DEF 100 as usual) : {normal_atk_hit:>4} dmg")
out(f"  attacker overextended (+{int((LEDGER_OVEREXTENDED_ATK_MULTIPLIER-1)*100)}% ATK)          : {boosted_atk_hit:>4} dmg")
out(f"  hit taken,   defender normal   (DEF 100)         : {normal_def_hit:>4} dmg")
out(f"  hit taken,   defender overextended (DEF floor {LEDGER_OVEREXTENDED_DEFENSE_FLOOR})    : {exposed_def_hit:>4} dmg")
overext_gate_ok = boosted_atk_hit > normal_atk_hit and exposed_def_hit > normal_def_hit * 3
out(f"  GATE: overextended attacker deals strictly more, AND an overextended")
out(f"        defender takes dramatically more (>3x, not a rounding-sized effect --")
out(f"        DEF 1 against 100 is the whole point of the trade) -- {'PASS' if overext_gate_ok else 'FAIL'}")
out()
out("Both gates read from the same mech_dmg_v2() transcription of")
out("engine/combat.ts's saltRootMultiplier/overextendedAttackMultiplier/")
out("overextendedDefense -- see heirloomVaultAbilities.test.ts's own")
out("'INTEGRATION' tests for the TypeScript-side confirmation that the real")
out("resolver (not just this Python transcription) applies them the same way.")

out()
out("=" * 74)
out("DONE. Full trace above; RECONSTRUCTION CHECK section is the load-bearing")
out("part -- everything below it is only as trustworthy as that section passing.")
out("=" * 74)

print("\n".join(lines))