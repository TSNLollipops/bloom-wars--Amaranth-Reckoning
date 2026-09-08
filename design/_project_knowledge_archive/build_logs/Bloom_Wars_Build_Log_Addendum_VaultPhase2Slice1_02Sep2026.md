---
title: Build Log Addendum — Vault Phase 2, Slice 1 (Heirloom Abilities Go Live)
date: 2 Sep 2026
status: shipped, committed to device
---

# What this addendum covers

The Vault Build Plan flagged it plainly: "the Heirloom abilities do nothing in combat." The S-tier validation pass that landed earlier today fixed the *stats* side of that (chassis numbers are now real, validated data) but explicitly punted on the ~30 kit abilities themselves. This pass is the next step: wiring the first 5 of those abilities — the "starter slice" Maxime picked — into actual gameplay, end to end. Engine logic, UI buttons, targeting highlights, tests, and `combat_sim.py` validation for the two that touch damage math.

The 5 abilities: `oath_iron_word` (Iron Word), `lastword_field_triage` (Field Triage), `farsight_signature` (Panoptes), `salt_root_salt` (Salt the Root), `ledger_overextended` (Widow's Ledger).

The other ~25+ Heirloom abilities, including Requiem/SEVERANCE, are still completely unwired. That's unchanged and intentional — out of scope for this slice.

# What shipped

**Engine (`src/engine/mission.ts`, `src/engine/combat.ts`, `src/engine/ai.ts`, `src/engine/units.ts`)**

- `Mission.ironWord()` / `canIronWord()` — a radius-gated taunt. Unlike plain `abil_taunt`, Iron Word sets `tauntRadius` so the AI only roots enemies onto the taunter if they're within that radius (rank 1 vs rank 5 radius differs). Wired into 4 sites in `ai.ts`'s targeting logic.
- `Mission.fieldTriage()` / `canFieldTriage()` / `getFieldTriageTargetsFrom()` — heals up to N nearby damaged, non-full-HP allies in one press. No manual target picker (see "Interpretation calls" below).
- `Mission.farsightSignature()` / `canFarsightSignature()` — global vision reveal (including burrowed units) for a set number of turns, rank 5 lasting longer.
- `Mission.ledgerOverextended()` / `canLedgerOverextended()` — a self-debuff/buff posture: +40% attack, but defense floored at 1 for its duration. Rank 5 extends the duration to 2 turns.
- `saltRootMultiplier()`, `overextendedAttackMultiplier()`, `overextendedDefense()` — new pure functions in `combat.ts`, wired into `resolveMechAttack()`/`resolveAttackOnBloom()`.
- Turn-start posture clearing in `endPlayerTurn()` extended to also decrement/clear `overextendedTurnsRemaining`.
- `resolveDeployRoster()` now grants a fielded Heirloom's *entire* ability list (not just the 5 built ones) onto the pilot's `heirloomAbilityRanks` at deploy time. This is deliberately forward-compatible — unbuilt abilities land in the data but no UI code checks for them yet, so nothing leaks. Confirmed by grep: every `unit.abilities.includes(...)` site in the codebase is a specific whitelist check.

**UI (`src/scenes/Battle.ts`)**

- 4 new action-bar buttons wired into `availableActions()`. Iron Word ends the turn (it's a taunt call, same as plain Taunt); Triage, Panoptes, and Overextend don't — they're the kind of ability you'd want to pop and then still act with the unit.
- A new highlight set (`fieldTriageTargets`) for previewing who Triage will heal, following the same pattern as the game's other targeting previews — wired into all 4 places a highlight set needs to be touched (clear, recompute, the two "arm targeting" blank-outs, and the render loop).
- A dev-time console warning if a unit's action bar ever exceeds the 6-slot cap, so a repeat of the old silent-drop bug (a Munti unit once had a button silently vanish because the bar filled up) gets caught immediately instead of discovered by accident.

# A bug we found and fixed

While writing the test for Ledger Overextended's rank-5 behavior ("duration extended to 2 turns"), the test failed. Traced it to the duration seed: the code was setting `overextendedTurnsRemaining = LEDGER_OVEREXTENDED_RANK5_DURATION_TURNS - 1`. That `- 1` is wrong given how the turn-start clearing loop decrements — it made rank 5's "2 turns" claim a complete no-op, clearing on the very first turn-start exactly like rank 1-4. Compared against `ambush()`'s working stealth-duration code, which seeds the *full* duration value with no offset, and that's the correct pattern. Fixed by removing the `- 1`.

This is worth flagging on its own, separate from the feature description: it's the kind of bug that ships silently and just quietly under-delivers a promised effect forever, because nothing crashes and nothing looks obviously wrong in a quick playtest — the ability still "works," it just doesn't get the extra turn it advertises. It only surfaced because the test was written to actually simulate two full turn cycles and check the value at each step, not just check that the ability could be activated. That's the case for writing tests that assert on behavior over time, not just on "did calling the function not throw."

# Interpretation calls (flagging per project convention — these weren't spelled out in the Data Pack, so here's the judgment call made and why)

- **Rank scaling is flat-then-jump-at-5**, not a smooth per-rank curve. Ranks 1-4 all behave identically; rank 5 alone changes the number (wider radius, longer duration, softer penalty). This matches how the ability text itself reads (only rank 1 and rank 5 values are ever given), but if the intent was a smooth ramp across ranks 2-4, that's not what's built.
- **"Sessile" for Salt the Root includes Heartwood-type stationary Bloom**, not just the most obvious hive/root targets. If there's a narrower or wider definition intended, this is a one-line change but worth confirming.
- **Field Triage is a single press-button heal-nearby-allies, not a manual target picker.** Simpler to use, simpler to build, but it means the player can't choose to skip a nearby ally in favor of reach — it always takes the N nearest damaged allies. Flagging because a manual picker is a real alternative design, not just an implementation detail.
- **Widow's Ledger's defense floor is a hard floor of 1**, not a percentage reduction. This was in the ability text as written, but see the balance flag below — it interacts with an existing rule in a way that's worth a second look.

# Test coverage

- New file: `src/engine/__tests__/heirloomVaultAbilities.test.ts` — 35 tests covering the deploy-time plumbing, all 4 engine methods (activation, refusal conditions, cooldowns, rank differences, the rank-5 bug-fix pin test), and both new combat multiplier functions at the unit level and via full `resolveMechAttack`/`resolveAttackOnBloom` integration.
- Extended `src/engine/__tests__/ai.test.ts` — 4 new tests for Iron Word's radius gate (in-range adjacent, in-range-but-not-adjacent is rooted not redirected, out-of-range falls through normally, plain-taunt regression check).
- Full suite: **1591/1591 passing**, zero regressions. `tsc --noEmit` clean.

# combat_sim.py — Section 15, and a near-miss worth documenting

Two of the five abilities change an actual damage formula (Salt the Root's multiplier, Widow's Ledger's attack/defense multipliers), so per house convention those two get `combat_sim.py` coverage; the other three are radius/duration/cooldown constants with no new formula, same as `abil_taunt`/`abil_screen` never getting a section.

While preparing to add this as Section 14, the device copy of `combat_sim.py` and `combatTables.ts` turned out to have already been modified — another session's Vault Phase 1 S-tier work had landed a `TIERS["S"]` stat block and its own Section 14 ("THE HEIRLOOM S-TIER") on the device after this session's files were originally staged. Caught this via a pre-commit drift check (comparing device file sizes/mtimes against the staged baseline for every file about to be touched) before committing anything — not by luck, by process. Re-staged the current device versions of both files, merged content rather than overwriting (appended the new `combatTables.ts` constants after the existing S-tier block; renumbered this addition to **Section 15** and inserted it before the other session's Section 14 and the script's final footer), and re-ran everything clean afterward.

No work was lost. But it's the second time this kind of collision has come up as a real risk in this project, not a hypothetical — worth keeping the habit of checking device state before every commit, especially now that Maxime has more than one Claude session touching this repo in the same day.

`python3 design/combat_sim.py` result: exit 0, zero FAIL lines, `RECONSTRUCTION VERIFIED`, both Section 14 (S-tier) and Section 15 (this addendum) gates PASS.

Worked numbers, G-tier meeps vs. G-tier tank, open ground, for reference:

- Salt the Root: 30 baseline → 48 dmg vs. sessile (x1.6) → 21 dmg vs. non-sessile rank 1 (x0.7) → 26 dmg vs. non-sessile rank 5 (x0.85, softened but still a penalty).
- Widow's Ledger: 30 → 42 dmg when the attacker is overextended (+40% ATK). On the defense side: 30 dmg normally → **3000 dmg** taken when the defender is overextended and already below full HP. See the flag below — that number is not a typo.

# Flagged, not decided: uncapped overextended-defender damage

This is the one I actually want your call on, not just a note.

The game has an existing rule: `FULL_HP_DAMAGE_CAP` (90) only applies while the defender is at full HP. Once a unit has taken any damage at all, that cap stops applying — normally this barely matters, because defense values are high enough that damage numbers stay reasonable anyway. But Widow's Ledger floors the overextended unit's defense at 1. Combine an already-damaged defender with an overextended defense floor of 1, and the damage formula's defense term basically disappears — the sim shows a 3000-damage hit from what's normally a 30-damage attack. That's not a rounding effect, that's the cap doing nothing and the defense term collapsing at the same time.

Is that the intended risk/reward for Widow's Ledger — "go overextended and a stray late hit can genuinely delete you" — or is the defense floor supposed to still respect the full-HP damage cap regardless of current HP? Both are defensible designs, but right now it's built as the former by default, purely because that's what the ability text and the defense-floor mechanic literally do when combined with the existing cap rule, not because anyone decided it on purpose. I'd rather ask than quietly pick one.

# Still open / not touched this pass

- The other ~25+ Heirloom abilities (Requiem/SEVERANCE included) are still unwired — same state as before this slice, just now with a working pattern (data entry + Mission method + Battle.ts button + highlight set + combat_sim.py only if it's a new formula) to repeat for the next batch.
- The "each Heirloom pilot's own mek gets its own Vault bay" UI idea (synker = pilot, mek = the machine, mirroring the per-Lance Workshop bay concept) is logged as a deferred Hub/Vault follow-up. Not started.
- The uncapped-damage question above.

# Verification summary

- `tsc --noEmit`: clean
- `npx vitest run`: 1591/1591 passing (71 files), zero regressions
- `python3 design/combat_sim.py`: exit 0, all gates PASS including new Section 15
- 10 files committed to device (8 modified, 2 new), zero commit rejections, `expectedMtimeMs` guards used on all pre-existing files after a fresh drift check
