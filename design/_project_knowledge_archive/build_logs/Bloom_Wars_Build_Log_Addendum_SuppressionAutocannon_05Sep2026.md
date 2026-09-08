# Build Log Addendum — Suppression Autocannon (Reeps' 3rd and last branch), 5 September 2026

Maxime picked this via a direct question ("Next weapon branch") after "keep building." Of the two remaining unbuilt branches — Suppression Autocannon and Combat Medic — this one went first because it's the cheaper, more-ready build: it reuses the mech→Bloom on-hit-effects infrastructure Shock Claws and Riot Drum already proved out, rather than needing a brand-new positive heal-tick mechanism the way Combat Medic will.

**Reeps is now complete at 3 branches, not short one.** Checked against `Bloom_Wars_Weapon_Branch_Expansion_Plan_v1.md` §2 directly rather than assumed: Reeps was only ever specced with 3 branches total (Missiles, Rail Lance, Suppression Autocannon) — unlike Meeps/Tank, which each needed a 4th branch built later to reach symmetry with the others. This finishes Reeps' own track; it doesn't open a new slot.

## What shipped

Suppression Autocannon: a landed hit has a 35% chance to apply a -20% attack debuff, for 2 turns, to the defender **and every same-side ally within 2 tiles (Chebyshev)** — the same area-debuff shape Sirenmaw/the Choir already inflict on players via `fx_debuff_attack`, now available to a mech, aimed back the other way.

- `data/weaponBranches.ts`: new `WeaponBranchId` `"reeps_suppression_autocannon"`; `SUPPRESSION_AUTOCANNON_DEBUFF_CHANCE = 0.35`, `_MAGNITUDE = 0.2`, `_DURATION_TURNS = 2`; `MECH_ON_HIT_EFFECTS` widened to allow a `debuff_attack`-kind entry (`fx_suppression_autocannon_debuff`); added to `WEAPON_BRANCH_ON_HIT_EFFECT`, `WEAPON_BRANCHES`, and `WEAPON_BRANCHES_BY_PATH.reeps`.
- `engine/turnManager.ts`: `applyMechOnHitEffect` gained a `defenderSameSide: BattleUnit[]` parameter and a new `debuff_attack` branch — applies to the defender plus any living same-side unit within `DEBUFF_ATTACK_RADIUS` (2 tiles), refreshing rather than stacking a second entry on a repeat hit, same rule every other status effect in this engine already follows.
- `engine/mission.ts`: the mech-attacks-Bloom call site now passes the already-in-scope `sameSideAsDefender` roster through; added a dedicated log line ("X's attack is suppressed!") ahead of the generic stun fallback.

## Two design calls, both mine, flagged per Foundation's attribution rule — not run through `combat_sim.py`

1. **Reused `fx_debuff_attack`'s exact numbers (-20% ATK, 2 turns, radius 2) instead of inventing a tuned sibling.** A player weapon branch that debuffs weaker or stronger than the effect Bloom already inflict on you has no design rationale behind it that I could find — "the same thing, turned around" is the honest read of what this branch is. Contrast `fx_choir_dissonance`, which *is* a deliberately tuned sibling of `fx_debuff_attack` — that pattern didn't apply here.
2. **Set the proc chance at 35%, above Shock Claws' single 25%,** despite both being one-effect-per-hit branches (unlike Riot Drum's two independently-rolled lower-chance effects). My reasoning: Shock Claws/Riot Drum's stun and pin each deny an entire turn, which is why I kept those rare. A -20%/2-turn attack debuff is reversible and comparatively mild — it doesn't stop a Bloom from acting, just weakens what it does when it acts — so I judged it could land more often without reading as oppressive. This is a judgment call, not a sim result. Worth a real playtest pass, same as every other placeholder number in this system.

## The bug this build found: `bloomDamage()` never read the attack debuff at all

This is the part of tonight's work that matters more than the branch itself.

While writing this branch's damage-verification test, I checked whether debuffing a Bloom's attack actually does anything to its damage output. It didn't. `attackDebuffMultiplier(attacker)` — the function that turns a live `debuff_attack` status effect into a damage multiplier — was already being read by both mech-attacker damage paths (`resolveMechAttack`, `resolveAttackOnBloom`), but **never by `bloomDamage()`**, the third and last damage-resolution path, the one that runs when a Bloom attacks a mech. A debuffed Bloom's own attacks were doing full, un-debuffed damage regardless. Silent — no error, no test failure, just a multiplier that never got multiplied in.

This isn't a bug this branch introduced. It's a pre-existing gap in `combat.ts` that happened to have zero observable consequences until now, because **nothing before tonight ever applied `debuff_attack` to a Bloom.** `fx_debuff_attack`/`fx_choir_dissonance` only ever go Bloom→mech. The one other place a Bloom could already receive this status is the already-shipped Simulacrum "Borrowed Authority" ability, which copies a debuff_attack effect onto a Bloom — and that effect has been a complete no-op on damage since the day it shipped. Checked directly: `simulacrum.test.ts`'s own Borrowed Authority coverage only asserts that the status effect gets applied, never that it changes the resulting damage number, so this gap was invisible to the existing suite too.

Fixed with one line in `bloomDamage()` — `dmg *= attackDebuffMultiplier(attacker);`, placed after the endurance-ratio scaling and before the defense multiplier, matching where the other two damage paths apply it — plus a comment explaining the gap and noting this is a deviation from Data Pack §8.2's literal formula (which never accounted for a debuffed Bloom either, since the mechanic to cause one on a Bloom didn't exist when that formula was written). Verified safe against every existing test: nothing in the suite asserts an exact `bloomDamage()` output while a Bloom carries an active debuff, so this fix couldn't have broken a locked-in expected number anywhere.

**Practical effect of the fix:** Suppression Autocannon's debuff now actually weakens the Bloom it lands on, as designed. And retroactively, Borrowed Authority's copied debuff now actually does something too — a real gameplay change to an already-shipped ability, worth knowing about if anyone's mental model of that ability's power level was set before tonight.

## Tests

- `engine/__tests__/mechOnHitEffects.test.ts` — all pre-existing `applyMechOnHitEffect` calls updated for the new parameter; 4 new tests for `fx_suppression_autocannon_debuff`: radius-edge hit/miss (ally exactly at radius 2 hit, one tile past it not), a downed ally skipped, no-stack-on-repeat-hit (refreshes duration, doesn't add a second entry), and downed-defender no-op.
- `engine/__tests__/suppressionAutocannon.test.ts` — new file, mission-level integration, mirroring `shockClaws.test.ts`'s structure: 10 tests across attack-roll gating, the `bloomDamage()` fix itself (hand-computed exact damage values with and without the debuff active — 27 vs. 22 — so this is checked against a real number, not just "damage went down"), and purchase/equip gating using `pilot_anand`, the Reeps pilot.
- One test-writing bug caught and fixed along the way: `makeUniformMap("plain")` defaults to a 6×6 grid; the `bloomDamage` tests originally placed a unit at `{x:5, y:6}`, off the bottom edge, which threw inside `tileAt`. Fixed by sizing the map to 10×10 explicitly.

## Verification gate

`tsc --noEmit`, `eslint .`, `lint-cast-collision.mjs`, `vitest run`, `vite build` — all clean. **94 test files, 2215 tests, all passing** (up from 92 files / 2196 tests before this build). Committed to the device: 6 files (`data/weaponBranches.ts`, `engine/turnManager.ts`, `engine/mission.ts`, `engine/combat.ts`, `engine/__tests__/mechOnHitEffects.test.ts`, and the new `engine/__tests__/suppressionAutocannon.test.ts`), with a fresh mtime check on all 5 pre-existing files immediately before committing — no drift, zero conflicts.

## Still open

- **`npm run lint` (specifically `lint-spoiler`) needs to run on Maxime's own machine before this ships.** It needs `BW_RESERVED_TERM` from a git-ignored `.env.local` that isn't in this sandbox. Every new string here stayed in game-native vocabulary, but that's care, not proof — and this pass adds one new filename (`suppressionAutocannon.test.ts`) that's never been checked against the naming lock.
- **Nobody has watched this fire in a real mission.** The proc roll, the AoE debuff hitting the right allies, the log line, and a Reeps pilot equipping it from the shop are all verified by code inspection and the test suite, not eyes on a live board.
- **Combat Medic (Munti) is now the one genuinely last unbuilt weapon branch.** It's a different shape of build than everything shipped so far — every branch to date has been an on-hit debuff/damage/control effect layered onto an attack; Combat Medic needs an actual positive heal-tick mechanism, which doesn't exist anywhere in this engine yet. Worth flagging before it's picked as "next" — it's not a reuse of tonight's infrastructure the way this branch was.
