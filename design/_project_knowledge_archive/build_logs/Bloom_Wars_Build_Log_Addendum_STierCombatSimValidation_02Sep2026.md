# Bloom Wars — Build Log Addendum: S-Tier Combat Sim Validation — 2 Sep 2026

Picked off the open item `combatTables.ts`'s own `TIERS.S` comment had been flagging since the Forward Battery/Heirloom foundation pass earlier the same day: *"Not run through combat_sim.py... this IS a player-power number in a way the economy placeholders elsewhere aren't, so it deserves a real sim pass before any Heirloom ability actually reaches combat."* With Vault Phase 1 now minting real S-tier aristocrat pilots onto the roster, this stopped being a someday item — it's live data.

## What this covers, and what it deliberately doesn't

`combat_sim.py` gates the **mech-vs-mech** formula (`resolveMechAttack` — the POWER matrix, tiers, the class triangle, counterattacks) — that's the only combat math this harness has ever validated, for any tier. It does **not** cover mech-vs-Bloom (`resolveAttackOnBloom`), which the script's own §12 already flags as a separate, still-unvalidated gap, untouched by this pass. Since Heirloom pilots fight Bloom hostiles in the overwhelming majority of missions, this validation answers "is S safe in the ladder" and "is S safe against a rival mech," not "is S balanced against the actual game." That second question needs a real mission playtest once an Heirloom's abilities are wired into combat (still unbuilt, per the Heirloom foundation addendum) — flagged, not solved here.

## New: `combat_sim.py` §14, "THE HEIRLOOM S-TIER"

Same convention as the Wellroot/Bramble sections before it — a proposed number gets its own dedicated, self-checking section rather than a bare assertion.

**Defense check.** For every attack-path × defend-path combination (16), against three attacker tiers — G (the typical live hostile: every hostile mech in `units.ts` except two named rivals), C (the toughest currently-fielded named rival, `hostile_mech_rourke`/`hostile_mech_marrow`), and A (a hypothetical future max, since no A-tier hostile exists yet) — checked whether an S-tier defender ever dies in *fewer* hits than an A-tier defender would. **Zero regressions across all 48 combinations.** 28 land as exact ties (the defense gap, ~6%, is too small to push some matchups over a whole extra hit) and the rest show S surviving strictly longer.

**Offense check.** Compared S-tier and A-tier attacker damage output against a full-HP G-tier defender. **A real, non-obvious finding, surfaced rather than smoothed over: 4 of the 16 opening-hit matchups land identically for A and S**, because A-tier already saturates the `FULL_HP_DAMAGE_CAP` (90) on those matchups — S's attack bonus is invisible on an alpha strike against most squishier archetypes. It shows up in exactly two places: against tankier defenders the cap doesn't reach (tank-path), and against anything already below full HP, where the cap doesn't apply at all. Worth knowing before a first Heirloom mission reads as "didn't feel any stronger" — the opening hit genuinely isn't where the tier difference lives.

**Sanity check.** S sits strictly above A on attack (140→149), defense (132→140), and hp (130→140); move is held equal (2→2) by design, per the original placeholder-derivation comment.

**Overall: PASS.** The `RECONSTRUCTION CHECK` section (the load-bearing proof this script's formulas still match the original 21 Aug `sim_output.txt`) also re-ran clean — S was added as a new dict entry, not a change to any existing tier, so this was never at risk, but it's checked, not assumed.

## `combatTables.ts` updated

`TIERS.S`'s own comment rewritten to record what's now validated versus what's still open: the stat block is safe to leave as-is — it can't silently break the mech-vs-mech ladder — but it's still a placeholder in the sense that nobody has actually fought with one in a mission yet. No numeric values changed; this pass validated the existing placeholder rather than retuning it.

## Verification

`python3 combat_sim.py` — exit 0, zero `FAIL` lines anywhere in the output (including the new section), `RECONSTRUCTION VERIFIED`. No TypeScript, engine, or test-suite changes — this is a design-tooling and doc-comment pass only, so `tsc`/`eslint`/`vitest` weren't re-run (nothing they cover changed).

**Committed** to the device repo with a fresh mtime-drift check immediately beforehand (both files matched exactly what was last read, zero concurrent-session interference) and a fresh post-commit directory listing confirming genuinely new sizes and mtimes on both files, not a tool-reported success taken on faith: `design/combat_sim.py` (21,780 → 28,395 bytes) and `src/data/combatTables.ts` (18,617 → 19,357 bytes).

## Still open

- **The real gap this doesn't close:** mech-vs-Bloom combat (`resolveAttackOnBloom`) has never been validated by any sim, for any tier — S-tier included. That's where an Heirloom pilot will actually spend most of its time. Worth a look once there's a real formula-level reason to (right now nothing about it is tier-specific enough to gate on its own).
- **Heirloom abilities still don't fire in combat** (Vault Phase 2, per the Heirloom foundation addendum) — this pass validates the chassis stats an Heirloom pilot stands on, not the ~30 kit abilities that are the actual point of recruiting one.
- **No real mission has been fought with an S-tier pilot yet.** This is a formula-level safety check, not a balance verdict — the honest next signal is Maxime actually fielding one.
