# Missile — Reeps' AOE splash weapon (`abil_missile`, SOFT pass, 26 Aug 2026)

Started as a totally different question: "should we modify reep for delayed dmg. to give the impression of distance?" — a cosmetic ask, a tracer/delay on ranged shots to sell range. Clarifying that split into a cosmetic half (a visual delay on ranged attacks generally — **not built this pass, still open**) and a mechanical half, which is what actually got built: "both? but no friendly fire unless the dude has missile. missiles will be aoe splash at range." Then the framing that decided the shape of the code: "its a wespon upgrade path. implement id softly for now. we gonna build the upgrade psth later. speciality are thing I wanna play around with." So this is deliberately a soft pass — a real, testable mechanic, with the actual G→A gear-tier acquisition fork left alone on purpose.

## What exists now

`abil_missile` (`data/abilities.ts`) — target a tile in the caster's own `attackRange`, and every living unit within `MISSILE_SPLASH_RADIUS` (Chebyshev, currently `1`) of that tile takes damage, through the *ordinary* per-target combat formula — `resolveMechAttack` for a mech-shape victim, `resolveAttackOnBloom` for a Bloom-shape one — exactly the branches a normal attack already uses, just run once per unit caught in the blast. Costs the whole action budget and ends the turn, one of the caster's own `MISSILE_CHARGES_PER_MISSION` (currently `2`) — a per-unit budget, not a squad-shared pool.

`Mission` gets four new methods: `canMissileStrike`, `getMissileAreaFrom`, `missileStrike`, `missileChargesRemaining`. Nothing currently grants `abil_missile` to any archetype or pilot — same pre-Mission-14 bootstrap state Fire Support was in. Attach it by hand (`unit.abilities.push("abil_missile")` or a mission's `bonusAbilityUnlocks`) to test or play with it.

## Missile vs. Fire Support — the actually-relevant precedent, and why it's different

Fire Support is the closest existing thing (arm-then-click-a-tile, area, off-board), but it's a meaningfully different animal, and the difference is the point: Fire Support is a call-in — flat 60 damage, hostile-only, one shared 2-charge pool for the whole squad. Missile is the Reeps' *own weapon* — real per-target formula damage scaled by the caster's own stats, unfiltered by side (a splash can hit your own allies), and a charge pool that belongs to the individual unit carrying it, not the squad. That's what "no friendly fire unless the dude has missile" meant in practice: nobody else's attacks change, but a missile blast doesn't check sides at all.

## Correction 1: "spash shouldnt be dodgable"

First pass had the Meeps 40%-dodge house rule (`MEEPS_DODGE_CHANCE`) applying to a splash hit exactly like it does to a normal attack. Maxime caught it same-day: an explosion already covering the whole blast tile isn't something a Meeps reads and steps out of the way of the way it can read an aimed shot. Fixed in `Mission.missileStrike()` — the primary hit's `defenderDodged` param is now hardcoded `false` for every victim in the blast, never rolled.

What did **not** change: if a victim survives the hit and is within its own `counterMaxRange` of the caster, it still counters back — and the caster's own chance to dodge *that* counter-hit is untouched, still a real roll. The reasoning: a counter is its own aimed, single-target retaliation, not part of the splash itself, so the "can't dodge an explosion" logic doesn't apply to it. One test proves both halves in a single scenario — a Meeps victim's primary hit lands despite a forced-low dodge roll, while the Meeps *attacker* fully dodges the resulting counter on that same forced-low roll.

## Correction 2: "the counter shouldnt be ff able"

Writing tests for Correction 1 surfaced a second, separate issue: bring a counter-capable ally into your own blast radius and it would counter *you* back — the counter logic was never side-aware to begin with, and the primary hit's own "not filtered by side" design meant nothing stopped it. Flagged as a real, sharp edge rather than fixed silently; Maxime called it same-day: the counter itself shouldn't be able to happen between a caster and its own side.

Fixed at the `missileStrike()` call site, same layer as Correction 1 (not in `combat.ts` — that formula still just answers "would a normal 1-v-1 here draw a counter," with no idea a splash victim might share the caster's side): when `resolveMechAttack` reports a counter and the countering victim is on the attacker's own side, the counter damage is never applied and the `AttackOutcome` reports `countered: false`. The primary splash hit still lands on a friendly victim exactly as before — a Tank ally caught in your blast still takes damage — it just doesn't shoot back at whoever cast it. A hostile victim in the identical geometry still counters normally; the suppression is side-specific, not a blanket "missile never draws counters" rule.

## Test coverage

`src/engine/__tests__/missileStrike.test.ts`, 11 tests: the standard refusal sweep (no ability / spent / downed / unknown id / hostile-side holder), out-of-range target rejection, `getMissileAreaFrom`'s clipped attack-range annulus (and that it empties once unusable), friendly fire actually landing plus the splash-radius boundary (in vs. just outside), a Bloom-shape victim taking damage through its own formula, the caster's exclusion from its own blast even when geometrically inside the radius, the per-unit non-refilling charge budget (independent from a second unit's own pool), the two dodge-correction cases (Correction 1), and the two friendly-counter cases — suppressed for an ally, still real for a hostile in the identical geometry (Correction 2).

`npm run typecheck` / `lint` / `test` (582/584 — the 2 non-passing are the pre-existing, already-flagged `commanderDown.test.ts` flake, confirmed unrelated by re-running in isolation) / `build` all clean.

## Still open

- The cosmetic half of the original ask — a distance-scaled visual delay/tracer on ranged attacks in `Battle.ts`'s presentation layer — hasn't been touched. That was the actual first ask; only the mechanical (splash) half has shipped so far.
- The real acquisition path — an alternative G→A tier-ladder fork in `combatTables.ts`'s `TIERS`, so Missile is something you build toward rather than something hand-attached — is explicitly deferred: "we gonna build the upgrade psth later."
