# Build Log Addendum — Maser Lance Shipped (5 Sep 2026)

Tank's 3rd and last weapon branch, per `Bloom_Wars_Mek_Workshop_And_Weapon_Progression_v1.md`'s own Tier-3 slot: "a big, committed cone AoE... late-game payoff."

## What shipped

`abil_maser_lance` — a Tank-only granted ability, same architecture family as `abil_missile` (Reeps): its own action-bar button, its own per-unit charge budget (`MASER_LANCE_CHARGES_PER_MISSION` = 2, `data/combatTables.ts`), costs the unit's entire remaining action budget and ends the turn. Granted via `tank_maser_lance` (Tank's 3rd branch, `data/weaponBranches.ts`) the same way `reeps_missiles` grants `abil_missile` — `engine/units.ts`'s `weaponBranchGrantedAbility()`/`createPlayerUnit()`.

The shape itself is new to this engine: pick one of 8 directions (`CINDER_LINE_DIRECTIONS`, the same set `requiem_severance`/`cinder_line_signature` already use to pick a direction on this grid) and fire a widening cone down it — 1 tile at forward-step 1, 3 tiles at step 2, 5 tiles at step 3 (`MASER_LANCE_CONE_RANGE` = 3). The wielder's own tile is never part of the cone (the step count starts at 1, not 0) — a shot fired FROM the Tank, not a blast it stands inside.

The cone geometry (`engine/mission.ts`'s `maserLanceConeTiles`) is one formula for all 8 directions, cardinal and diagonal alike: at forward step `d`, the cone is `2d-1` tiles wide, laid out along the chosen direction's own perpendicular (`{x: -dir.y, y: dir.x}`) rather than a hand-written case per direction. For a cardinal direction that reads as an ordinary forward-widening wedge; for a diagonal direction the same math widens across the *other* diagonal, the natural equivalent shape on a square grid. Verified by hand before writing the tests (see below) and confirmed correct — every geometry test passed on the first run.

Damage runs through the ordinary per-target combat formula (`resolveMechAttack` / `resolveAttackOnBloom`), exactly like Missiles — this is the Tank's own weapon, scaled by its own stats, not a flat off-board number. Splash is **not** dodgable (same "an explosion already covering the whole blast tile" reasoning `missileStrike` already established), a surviving victim's own counter is still a real roll, and a friendly victim's counter back at its own caster is suppressed — all three behaviors copied from `missileStrike`, not re-derived, since the underlying reasoning is identical for both shapes.

## The three design questions — all resolved by Maxime, not guessed

Surfaced via a three-question `AskUserQuestion` round before any code was written, per the project's own "flag scope growth before building" rule (a cone-AoE granted ability is genuinely new engine surface, not a data-table entry the way Riot Drum was):

1. **Architecture.** A separate granted ability (own action-bar button, own per-mission charge budget, ends the turn) — chosen over a modifier riding on the ordinary attack. Same shape as Missiles.
2. **Cone shape.** A real expanding cone (1/3/5 tiles wide at steps 1/2/3) — chosen over a simpler frontal rectangle/block.
3. **Friendly fire.** Yes, allies caught in the blast are hit too, no side filter — chosen over excluding them. Same family as Missiles/`abil_severance`.

All three picked the recommended option.

## One thing checked and deliberately left alone, not fixed

The Weapon Branch Point System's cost/tier gate (`WEAPON_BRANCH_COSTS`/`WEAPON_BRANCH_TIER_GATE`) is keyed by **how many branches a pilot already owns**, not by which one — confirmed directly against the live `purchaseWeaponBranch`/`ShopPanel.ts` code, not assumed. That means a fresh Tank pilot can buy Maser Lance as their very first branch, skipping Grinder Claw and Riot Drum entirely, at the same 1st-branch price and tier gate either of those carries. This is **not a Maser-Lance-specific gap** — Meeps' Shock Claws and Tank's own Riot Drum were already buyable first too, ahead of their own path's "earlier" branches in `WEAPON_BRANCHES_BY_PATH`'s array order. It's the system's actual designed shape per its own source doc ("cost and tier-gate depend on purchase order... not on which specific branch"), so no special-case override was added here to force Maser Lance behind the other two. Documented in `data/weaponBranches.ts`'s own header comment and pinned with a real test (`maserLance.test.ts`'s "is buyable as a Tank pilot's very first branch" case) so this stays a known, verified fact rather than a silent assumption. If "no skipping the starter branch" ever becomes a real design goal, it needs a system-wide purchase-order lock touching every path's branches at once, not a one-branch patch.

## A real gap, flagged rather than built: the Rec Room / sim player-AI

`sim/playerAi/abilities.ts` has a real decision function for Missiles (`chooseMissileTile` — scores every tile in the unit's own attack range, picks the best splash target) wired into `sim/driveMission.ts`, so an AI-piloted Reeps with Missiles equipped actually fires it. **Nothing equivalent was built for Maser Lance this pass.** It's a genuinely different shape — a direction + cone, not a radius around a clicked tile — so it can't reuse the existing `strikeScoreAt` helper as written; it would need its own direction-scoring function, a `useAbilities` profile flag, and a `driveMission.ts` dispatch line. Net effect today: a Tank pilot with Maser Lance equipped, if AI-piloted in the Rec Room or a `npm run sim` batch, simply never fires it. Not broken — unused in that one context, the same state Missiles itself was presumably in before its own AI pass got built separately. Flagged rather than silently built, per the project's own scope-growth rule (this would be a second targeting-decision system, not a small addition) — see `Bloom_Wars_Now_And_Next.md`'s "Needs Maxime's call" #5.

## UI

New action-bar button (`MASER LANCE ×N`), new direction-pick targeting flow mirroring Gjallar/Requiem's own (arm → rose-colored wash over every legal direction, out to the board edge → hover preview outlines the actual resolved cone → click fires it), a new hover-tip damage forecast (`forecastMaserLance`, real per-victim numbers since — unlike Requiem's fixed damage — Maser Lance's damage varies by target, same "BLAST" readout style Fire Support/Missile already use), and a new HUD legend line. New color: `MASER_LANCE_TARGET_COLOR` (`0xf43f5e`, a hot rose/crimson), distinct from every existing hue on the board.

**One real, verified consequence for the action bar's own headroom.** `actionBarPaging.test.ts` is a live regression guard that enumerates every kit a player can actually assemble and checks none of them exceed the 6-button bar without paging correctly — its own comment says explicitly that "a second ability-granting weapon branch ships" is exactly the kind of change expected to move its pinned worst-case numbers. Updated it to also model a Tank pilot equipping Maser Lance (it previously only modeled Reeps + Missiles). Result: the worst-case button count stayed at exactly 6 (no headroom left, but the MORE button doesn't newly trigger) — but a *third* build now sits at that ceiling: a Surtr (`cinder_line`) wielder, who is Tank-chassis, equipped with Maser Lance. Test updated and re-pinned (`"names the builds that sit at the limit"` now lists three, not two) rather than silently passing on stale data.

## Verification

`npx tsc --noEmit` clean, `npx eslint src` clean, `npx vitest run`: **92 test files / 2155 tests, all passing** (baseline was 91/2136 after Riot Drum; +19 new tests in `maserLance.test.ts`, zero regressions, plus `actionBarPaging.test.ts` updated and re-verified for the new reachable build).

New test file: `src/engine/__tests__/maserLance.test.ts` — refusal cases, the granted-ability wiring itself (`createPlayerUnit` grants `abil_maser_lance` only when `tank_maser_lance` is equipped), cone geometry (cardinal, diagonal, edge-clipping, illegal-direction rejection, the direction-enumeration helper), friendly-fire/cone-boundary/Bloom-target splash behavior, the "never hits its own tile" invariant, per-unit charge budgeting, the dodge and friendly-counter house rules (mirrored from `missileStrike.test.ts`'s own established coverage), the damage forecast, and the purchase-order economy (3rd-branch gate/cost, and the deliberate "buyable first" test above).

## Files changed

- `src/data/combatTables.ts` — `MASER_LANCE_CONE_RANGE`, `MASER_LANCE_CHARGES_PER_MISSION`.
- `src/data/abilities.ts` — `abil_maser_lance` entry.
- `src/data/weaponBranches.ts` — `tank_maser_lance` (`WeaponBranchId`, `WEAPON_BRANCHES`, `WEAPON_BRANCHES_BY_PATH.tank`), `MASER_LANCE_GRANT_ABILITY`, header comment.
- `src/engine/units.ts` — `maserLanceUsesRemaining` field, `weaponBranchGrantedAbility()` wiring, `createPlayerUnit()`'s factory defaults (and the other 4 unit factories, for the same "every BattleUnit carries every charge field" uniformity `missileUsesRemaining` already established).
- `src/engine/mission.ts` — `maserLanceChargesRemaining`, `canMaserLanceStrike`, `maserLanceConeTiles`, `getMaserLanceDirectionTargets`, `previewMaserLanceCone`, `forecastMaserLance`, `maserLanceStrike`.
- `src/scenes/Battle.ts` — targeting state fields, click dispatch, action-bar button, highlight wash + hover preview outline, HUD legend line, hover-tip forecast, `MASER_LANCE_TARGET_COLOR`.
- `src/engine/__tests__/maserLance.test.ts` — new, 19 tests.
- `src/engine/__tests__/actionBarPaging.test.ts` — updated to model the new granted-ability branch; re-pinned the "builds at the limit" assertion.

All committed to the real machine, `expectedMtimeMs`-guarded against the pre-edit state, zero rejected.
