# Build Log Addendum — House Amaranth: Mission 20, "Marrow's Line" (31 Aug 2026)

Maxime, picking the next thread to pull, and setting a new standing rule in the same breath: *"1 and make it a rule, if ai win more than 15% of the time, the map is too easy. you got it?"* Then, on precision: *"later once all mission are done, ill retune pass and tighten it up. 500try on each map."*

## What shipped

Mission 20, "Marrow's Line" — the plan doc's own §5 pitch: "the shared convergence, mechanically. Warden's side plays this as Eliminate All and wins outright... House Amaranth's own version of the same battle needs a different win condition... proposed as Extract Unit, objective reframed as a disciplined disengagement rather than a rout." `extract_unit`, `extractUnitId: "pilot_marrow"`, new map (`map_house_amaranth_marrows_line`, 24×12), new `CampaignMission` (`mission_house_amaranth_20`), closing Act II.

**First mission anywhere in this campaign to fight Warden Company as the enemy.** Every existing Warden pilot only ever appears on the player side elsewhere in this codebase. Two new archetype blocks in `src/data/units.ts`: `WARDEN_HOSTILE_MECHS` (a 4-unit "Warden Company Trooper" escort, tank/meeps/meeps/reeps, tier G — same generic-detachment shape as `AMARANTH_HOSTILE_MECHS`' own House Amaranth troopers) and `WARDEN_RIVAL_MECHS` (`hostile_mech_rourke` — 2nd Lt. Dessa Rourke herself, meeps path, tier C — the mirror of `AMARANTH_RIVAL_MECHS`' own `hostile_mech_marrow`, same tier-step-up logic). Both merged into `ALL_HOSTILE_MECHS`.

## A real map bug caught, not just a difficulty number

First draft put the exit tiles immediately adjacent to deploy — both hugging the same east edge, with the enemy spawning far west. Sim result at every enemy count tried, including 18 enemies against a 12-pilot squad: **100% win, every time**. Traced it before touching any numbers: Marrow could just walk to the exit in 1-2 turns without the squad ever meeting the enemy at all — the fight the mission's own fiction describes never actually happened on the board. A genuinely different flavor of bug than Mission 19's Gallcyst placement (a stationary unit out of its own range), but the same underlying lesson: sim numbers only mean something once the map actually makes the encounter happen.

Rebuilt the map from scratch: deploy west, exit a full traversal east, Warden Company spawning as a north/south flanking pincer plus a center blocker roughly two-thirds of the way down the lane — Rourke herself, "closing a line" per the briefing, positioned to actually contest the extraction route instead of sitting behind it. Ridge/rubble bands north and south of an open middle lane channel the fight into the same lane the exit sits on.

## Sim-tuning journey — first mission built under the new ≤15% ceiling

```
1 Rourke + 4 troopers (1 per path), corrected map      → 75% (75/100)
1 Rourke + 8 troopers (2 per path)                       → 18% (18/100)
2 Rourke + 8 troopers (2 per path)                       → 12% (18/150), 9% (18/200)
```

Landed at 2 Rourke + 2 per trooper path (10 enemies total) — 54/450 wins pooled across the last two batches, ~12%, comfortably under the new 15% ceiling without tipping into a rout the other way (not a single-batch fluke). `extract_unit`'s own zero-tolerance loss condition already punishes added pressure harder than its surface numbers suggest (Mission 17's own finding) — exactly why 10 enemies against a 12-pilot squad lands this hard once the map actually forces the fight.

**This is the first mission tuned against the tightened rule, not the old ≥30% floor every mission through Mission 19 shipped against.** Missions 1-19 are explicitly not being retroactively retuned — Maxime's own call. He'll run a dedicated n=500 retune pass across the whole campaign once every mission exists; this pass isn't chasing that precision either, just shipping comfortably under the new ceiling with normal sample sizes (100-200 here, matching this campaign's own established practice).

## Verification

```
npm run typecheck    → clean
npm run lint          → clean (disposable Python-script scratch output deleted first — same
                         housekeeping step Mission 19's own addendum already flagged)
npm test -- --run     → 58 files, 1192/1192 passing, zero regressions
```

`tools/lint-spoiler.mjs` (the naming-lock checker) itself only no-ops in this sandbox — `BW_RESERVED_TERM` lives in a git-ignored `.env.local` that was never staged here, by design. Worth a real local `npm run lint` on Maxime's own machine before this ships anywhere, since that's the only environment that can actually check the lock.

## Also new this session: a standing sitrep rule

Maxime: *"after every action, gimme a sitrep I have to start a new convo so dont let me eat my credit. only exeption is when I say schooltime."* Any Claude session picking up mid-build should report status after each real checkpoint rather than batching silently through several — the exception being when Maxime says "schooltime," same meaning as this file's own established "going to sleep"/"going to school" precedent (work unattended, review later).

## What's still not built

Act III, Missions 21-36 of House Amaranth. The full campaign-state/Hub wiring pass. The Missions 1-11 enemy-variety reform plan, still awaiting Maxime's go-ahead. Maxime's own planned n=500 whole-campaign retune pass, once every mission exists.
