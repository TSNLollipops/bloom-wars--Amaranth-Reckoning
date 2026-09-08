# Build Log Addendum — Riot Drum shipped (4 Sep 2026)

*Companion to `Bloom_Wars_Requiem_Early_Equip_And_Tank_Module_Note_04Sep2026.md`, which confirmed Riot Drum and Maser Lance were both genuinely unbuilt and both wanted. Maxime said "go" to build both; this records Riot Drum, the first of the two. Maser Lance is deliberately not started — see the note at the end.*

## What shipped

**Riot Drum, Tank's 2nd weapon branch** (`data/weaponBranches.ts`). Melee, same as Grinder Claw — doesn't touch attackRange. On a landed, non-lethal hit against a Bloom, two effects roll independently (not either/or):

- **Knockback** — `RIOT_DRUM_KNOCKBACK_CHANCE` (30%) to push the defender 1 tile directly away from the attacker (`RIOT_DRUM_KNOCKBACK_MAGNITUDE`), reusing the exact `knockbackDestination()`/`isKnockbackImmune()` math the Bloom-side Heartwood/Unnamed knockback already uses — no new movement logic, just the mech-attacking-Bloom direction of it, which didn't exist before tonight.
- **Pin** — `RIOT_DRUM_PIN_CHANCE` (15%) to pin the defender for `RIOT_DRUM_PIN_DURATION_TURNS` (1 turn).

Both numbers are placeholders, not run through `combat_sim.py` — picked lower than Shock Claws' single 25% specifically because a hit here can proc two things off one roll pair, not one. One line each to retune once there's a real play session to judge them against.

Gated at `WEAPON_BRANCH_TIER_GATE[1]` (tier C) as Tank's 2nd purchase, costed at `WEAPON_BRANCH_COSTS[1]` (220 points) — same generic purchase-order system every other branch uses, no special-casing needed.

## The two real design questions, and how they got resolved

**1. What does "pin" actually mean?** This was flagged as genuinely undefined in `Bloom_Wars_Weapon_Branch_Expansion_Plan_v1.md`'s own open-questions section — "needs a real definition before it's buildable, not just 'knockback plus something.'" Checked the actual code rather than inventing an answer: `abil_interdict`'s own `triggerInterdiction()` (`engine/mission.ts`) already uses the word "pin" in this codebase, and it means "zero the target's actions for the turn" — mechanically identical to the existing "stun" StatusEffect. Put to you directly (AskUserQuestion); you picked reusing stun/Interdict's meaning over inventing a second, different mechanic for the same word. So Riot Drum's pin is implemented as the "stun" kind outright — same `isStunned()`/`runHostileTurn` skip, same `tickStatusEffects` decay, zero new engine surface for it.

**The one honest cost of that reuse, worth restating plainly:** `runHostileTurn`'s skip-turn log line ("X is stunned and skips its turn") is worded generically off `isStunned()`, not off which fxId caused it. So a Riot Drum pin proc reads as "stunned" in that one log line next turn, even though the hit-landing line (the turn it actually happens) correctly says "is pinned!" Not fixed — would mean carrying a source label through `StatusEffect` for a text-only difference on one log line. Flagged as a known, deliberately accepted cosmetic gap, not silently shipped.

**2. Do knockback and pin roll together or separately?** Not an open question anyone had asked yet — a real judgment call made in the course of building this, flagged here rather than silently decided. `WEAPON_BRANCH_ON_HIT_EFFECT` (the table mapping a branch to its on-hit effect and roll chance) was a single `{fxId, chance}` per branch before tonight, since every branch that used it (Shock Claws) only ever needed one. Riot Drum needed two. Widened it to a list per branch, each entry rolled independently — so a single landed hit can knock back, pin, both, or neither. Shock Claws' own single-entry list behaves exactly as before (same one roll, same chance, same fxId) — confirmed by the full existing test suite passing unchanged, not just by reading the diff.

## Where it lives

- `data/weaponBranches.ts` — `tank_riot_drum` added to `WeaponBranchId`, `WEAPON_BRANCHES`, `WEAPON_BRANCHES_BY_PATH.tank`. New constants (`RIOT_DRUM_KNOCKBACK_CHANCE/_MAGNITUDE`, `RIOT_DRUM_PIN_CHANCE/_DURATION_TURNS`). `MECH_ON_HIT_EFFECTS` widened to allow a `"knockback"`-kind entry alongside `"stun"`; two new fxId entries (`fx_riot_drum_knockback`, `fx_riot_drum_pin`). `WEAPON_BRANCH_ON_HIT_EFFECT` widened from `{fxId, chance}` to `{fxId, chance}[]` per branch.
- `engine/turnManager.ts` — `applyMechOnHitEffect` widened to take `map`/`occupied` (mirroring `applyBloomOnHitEffect`'s own signature) and gained a `"knockback"` branch, reusing `knockbackDestination()`/`isKnockbackImmune()` exactly. `applyCopiedOnHitEffect`'s (Simulacrum's "copy a random on-hit effect") internal call updated to pass the two new params through — no behavior change there, just following the signature.
- `engine/mission.ts` — the mech-attacks-Bloom on-hit resolution now loops over a branch's full effect list, rolling each independently, with a per-fxId log line (Shock Claws' own "is stunned!" line is untouched, still exact-matched by its existing test).
- `engine/__tests__/mechOnHitEffects.test.ts` — 4 new tests (knockback moves the defender, knockback immunity via `sureFootingActive`, knockback blocked at a map edge, pin uses its own duration constant, not Shock Claws').
- `engine/__tests__/riotDrum.test.ts` — new file, 10 tests, mirroring `shockClaws.test.ts`'s own structure exactly: both-succeed, both-fail, each firing independently of the other (a sequenced mock RNG, since a single constant value can only force both rolls to the same outcome), no-effect-on-a-downed-defender, no-effect-without-the-branch-equipped, no-effect-for-a-different-branch, the hostile-turn skip, and purchase/equip gating at the correct tier and cost.

## Verification

`npx tsc --noEmit` clean. `npx eslint src` clean. `npx vitest run`: **91 test files / 2136 tests, all passing** (up from the prior 90/2122 baseline — 14 new tests, no regressions). `npm run build`/`npm run sim` not re-run this pass — same sandbox gap as the prior addendum (`tools/` isn't staged into this session's sandbox), unrelated to this change, documented rather than silently assumed clean.

All 5 changed/added files committed to the real repo (`F:\The Bloom wars. Code project\bloom-wars\bloom-wars\`) with a fresh mtime-drift check immediately beforehand — zero conflicts.

## What this deliberately does not include

**Maser Lance is not started.** Confirmed via grep, not assumed: no cone-shaped targeting exists anywhere in this codebase today. Unlike Riot Drum (which slotted into an already-proven data-table system with two already-resolved design questions), Maser Lance needs real new engine surface — cone geometry, an architecture decision (a modified basic attack vs. a separate granted ability with its own targeting UI, à la Missiles), damage-per-tile behavior, and a real tier-floor override (the existing purchase-order gate doesn't automatically enforce a per-branch minimum tier, so "D-tier+" needs its own new check to be real rather than aspirational). Per the project's own standing rule about flagging scope growth before building it: this is a new-system-sized decision, not a "two more lines in an existing table" one, so it's laid out as options for you rather than built on a guess. See `Bloom_Wars_Now_And_Next.md`'s "Needs Maxime's call" #1.

No GDD/Data Pack doc update needed for Riot Drum specifically — checked directly against the actual pending-edit text in `Bloom_Wars_Docx_Pending_Edits_Status_28Aug2026.md` rather than assumed: both GDD §6.4 and Data Pack §12's still-outstanding edits are one generic "Weapon branch, one pilot" row describing the purchase structure, not a per-branch catalog entry, so they already cover Riot Drum along with every other branch bought the same way.
