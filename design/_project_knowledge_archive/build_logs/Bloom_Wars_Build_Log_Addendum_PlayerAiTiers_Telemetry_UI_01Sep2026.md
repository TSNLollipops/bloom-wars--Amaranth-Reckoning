# Build Log Addendum — Cheap UI fixes, Player Telemetry, and the Player-AI Difficulty Tiers (1–2 Sep 2026)

**Status: built, verified, committed to the device.** This is the build record for the three batches that turned the 1 Sep plans (`claude/Bloom_Wars_Player_AI_Difficulty_Tiers_Plan_v1.md`, `claude/Bloom_Wars_Player_Telemetry_Plan_v1.md`, `claude/Bloom_Wars_First_Game_Dev_Feature_Gap_Report_1Sep2026.md`) into code. Maxime's authorization, verbatim: *"alright. build the rest of the game. your coding freely for a while. if you need questions ask in popup."* His two answers to the popups: balance rule — *"Your call. I dunno enough about it to make a call. I want the mission to be hard and player have loss in them. Especially at hard."*; order — *"Cheap UI fixes → telemetry → bot tiers → Hard."* And the framing that governs §4 below: *"xcom is the benchmark. mission should feel as hard as xcom missions."* Later: *"as long as player actually find the game hard. ill be happy."*

Gates at the final commit: `tsc` clean, `eslint` clean, **vitest 63 files / 1319 tests** (was 60 / 1219), `vite build` clean. The naming-lock lint (`tools/lint-spoiler.mjs`) no-ops in the sandbox for want of the env var; nothing in this pass touches UI strings that could trip it, but run it on the device before shipping, as always.

Plain-language glossary for the terms this addendum leans on: a **threat map** is "for each tile, how much damage could the enemy land there next turn"; an **oracle** here means asking the enemy's own decision code what it would do against a hypothetical board; a **seed** is the starting number for a random generator, so the same seed replays the same battle; a **baseline** is a big batch of bot runs whose numbers everything later is compared against.

---

## 1. Batch 1 — the cheap UI fixes (committed earlier this session)

All from the feature-gap report's "table stakes" list, each verified in the running game (Playwright headless against the DEV `window.__bwGame` hook, and this evening a live look in Maxime's own Chrome at `localhost:5173`: version stamp visible, Options stats panel rendering, the Hub filling the window under FIT scaling).

- **Combat forecast on hover** (`engine/mission.ts` `forecastAttack(attackerId, defenderId)` and `forecastSplash(unitId, tile, kind)`; `scenes/Battle.ts` hover card). Reuses the real resolvers (`resolveMechAttack` / `resolveAttackOnBloom`) with the dodge roll switched off and reports the dodge chance separately, so the number you see is the number that lands — `engine/__tests__/forecast.test.ts` pins forecast-vs-actual with `Math.random` fixed. Shows shield absorbed, HP after, counter-attack, the decloak ×2, and the Collapse rule for Bloom.
- **"Units still have actions — end turn anyway?"** prompt; **Esc / right-click** cancels the current selection or targeting.
- **Missiles wired into the action bar** (the branch's ability was unreachable by any human before).
- **Window scaling**: `Phaser.Scale.FIT` + `CENTER_BOTH` in `main.ts`, `index.html` set to fill the viewport — the fixed 1074×640 box that would have sat small in the Electron window is gone.
- **Version stamp** (`vite.config.ts` defines `__APP_VERSION__` / `__BUILD_TIME__`, `src/buildInfo.d.ts` declares them; bottom-right of the main menu).
- Two pre-existing Shop bugs found by screenshot while there and fixed (`scenes/shop/ShopPanel.ts`: the Weapon Branch button was half off its card; the Convert label overlapped its button).

## 2. Batch 2 — player telemetry, local-first (committed earlier this session)

The telemetry plan's §3–§5, built exactly as specified so bot and human write the same row.

- `engine/mission.ts`: `UnitPerformance` gains `damageTaken` and `abilitiesUsed`; `Mission.hostileKills` tallies kills by archetype; tile/DoT damage is credited; every ability verb calls `noteAbilityUse`.
- `engine/missionSummary.ts` (new): `summarizeMission(mission, meta) → MissionSummary` — one record shape for a bot run (`source: "bot"`, tier, seed) and a human run (`source: "human"`, campaign id, install id, game version).
- `engine/statsStore.ts` (new): `bloomwars_stats_v1` in localStorage, capped at 500 records, with `pilotServiceRecords()` and `memorial()` queries ready for a UI, `exportStatsJson()`, `clearStats()`.
- `engine/telemetry.ts` (new): `recordHumanMissionSummary(...)`, called from `scenes/Debrief.ts` (which now shows an AFTER ACTION stat block) and from `Battle.ts`'s COMMAND DOWN path (which never reached Debrief before, so those attempts were invisible).
- `engine/campaignState.ts`: `campaignId` minted per campaign and back-filled on load.
- `scenes/Options.ts` rewritten: statistics summary, **COPY STATS + BUG REPORT TO CLIPBOARD**, **DELETE MY STATISTICS**, with the plain "everything stays on this computer" line. Opt-in upload is *not* built — the plan split that off as its own decision.
- `engine/__tests__/telemetry.test.ts` (8 tests).

## 3. Batch 3 — the Player-AI difficulty tiers (this commit)

### 3.1 What landed, file by file

**Plumbing (plan Phase A).**
- `src/sim/playerAi/profile.ts` (new): `PlayerAiProfile` and four presets — `EASY`, `MODERATE`, `HARD`, and `LEGACY`. LEGACY is the pre-1-Sep bot byte-for-byte (full board awareness, four verbs), kept so every batch number recorded before this pass can still be reproduced (`npm run sim:batch -- 20 --tier=legacy`).
- `src/sim/driveMission.ts` (new): the one per-unit dispatch loop, shared by `run.ts` and `runBatch.ts` by import instead of by eye. Honours Field Doctor's free repair at 0 actions. Returns the same `MissionSummary` a human's Debrief writes.
- `src/sim/rng.ts` (new, mulberry32) and `engine/mission.ts`'s `MissionOptions.rng` — `rollMeepsDodge` was the only random call in a battle, so injecting it makes a run replayable from a seed. Late-bound default, so a test's `vi.spyOn(Math, "random")` still works.
- `src/sim/run.ts` / `runBatch.ts` rewritten: `--tier=easy|moderate|hard|legacy`, `--seed=N` (run *i* of a batch uses seed N+i, so any loss is replayable with `npm run sim -- <id> --seed=…`), `--all-tiers`, `--json=out.json` (dumps every run's MissionSummary), `--ai-log`. The batch prints WIN / LOSS / CMD_DOWN / TIMEOUT, turns per win, and the two numbers the XCOM framing turns on — **downed per run** and **permanently lost per run**.

**Moderate and Easy (Phase B).**
- `src/sim/playerAi/abilities.ts` (new): the obvious-trigger rules for Sensor Sweep, Interdict, Overwatch, Ambush, Screen, Taunt, Fire Support, Missiles, plus Munti repair-pathing and fog exploration. Each gated by the profile.
- **Honest vision** for every tier but LEGACY: the bot can only target what the player side can see (`unitsVisibleToSide`, the same check the fog renderer uses). The old bot could and did shoot burrowed and concealed units no human can click.
- `EASY`: nearest thing, shoot it, retreat at 15%, no focus fire, no VIP protection, no cohesion, Repair + rescue + Clear Bloom only (the last because it *is* the objective on a clear-bloom map), and a seeded 20% chance per decision of taking the second-best option.

**Hard (Phase C).**
- `src/engine/threat.ts` (new, engine-side so a future player-facing enemy-range overlay can import it): `buildThreatMap` (each hostile's real next-turn footprint — its true movement kind, walls, blocking units; taunt-rooted hostiles collapse to in-place range), `incomingAt` (footprint sum), `predictedFocus` (the **oracle**: clone the board, stand the unit on the candidate tile, ask `decideHostileAction` what each hostile would do in the real phase order, deducting HP on the clones so a squadmate about to drop re-routes the hostiles behind it). The oracle never touches the live unit list — the plan's own trap (`bestAttackTargetInRange` writes `unit.pos` transiently) is why it clones.
- `src/sim/playerAi/hard.ts` (new): the Hard tier's five seams into the ordinary chain — pre-emptive retreat when the predicted incoming on the current tile beats the unit's **danger bar** (a line unit's bar is "would this kill me"; the commander's / Munti's is 60% of max HP, tightening to 60% of current HP once hurt), reposition-before-shooting to a seat fewer hostiles can punish, threat-aware advance-into-range, threat-trimmed plain advances with a stall breaker, and taunt survivability by real footprint damage. Plus an **allocation model** (which hostile would plausibly pick *this* unit, mirroring each enemy tier's own targeting rule and its vision from where it stands), hold-zone discipline (a line unit in the zone doesn't step out to reposition; the last unit in the zone never leaves; once the zone is about to be judged, units outside walk in), and the post-hit rule — wounding a Bloom into Collapse without killing it makes it hit at full power next phase, so a shot is scored with the target's *post-hit* damage.
- `driveMission.ts` runs Hard's units in role order (Tanks → Reeps → Meeps → Munti → commander last), and VIPs that haven't decided yet are assumed to move out of reach when the units before them estimate their incoming.
- Squad-stall breaker in the driver: a board state seen again within the last eight rounds (an unchanged board, or a retreat/cloak/wait/approach cycle) suspends caution and the hold-in-place postures until something changes. Any tier could stall on a hostile line that can't see it.

**Engine speed-up (semantics-preserving).** `engine/grid.ts`'s `reachableTiles` was half of every sim's CPU time under the oracle. Rewritten with the same algorithm and the same iteration order (typed arrays instead of parsing `"x,y"` strings on every visit); `engine/__tests__/reachableTilesEquivalence.test.ts` keeps the original verbatim as the reference and checks costs, predecessors and Map insertion order on all 76 campaign maps. Seeded batch output before/after was byte-identical. Hard now runs at roughly a third of a second per mission; the full 76-mission × 3-tier × 100-run baseline takes about half an hour.

**Tests.** `engine/__tests__/threat.test.ts` (7), `engine/__tests__/reachableTilesEquivalence.test.ts` (77), `sim/playerAi/__tests__/tiers.test.ts` (16): profile defaults, seed reproducibility, honest vision, the Interdict gate, taunt survivability, the danger bar, the threat-map cache, role order, allocation vision-gating, path trimming and the stall commit, and the pre-emptive retreat itself.

### 3.2 Behaviour changes that apply to EVERY tier (these move numbers)

Found by tracing losses, not by design — each one is a case where the bot was failing a mission for a reason no human would:

1. **Extraction target runs first, shoots second** (`index.ts`, extract_unit). A Reeps extraction target with something in range used to trade fire at the wrong end of the map until the turn limit. Now it moves toward the nearest open exit and shoots from the destination if it can. Effect: Missions 5 / 10 / 11 went from 0–46% to 100% on Hard and resolve in 5–7 turns at every tier. **Those missions now read as easy for the bots because the bot stopped throwing them; the tuning job should re-examine them.**
2. **The Munti walks to the bloom patch** on clear_bloom missions when nothing is in sight and no bloom is in reach (plain `moveToward`, not the cohesion leash — the leash was why it never arrived), and the rest of the squad escorts it. Mission 3 (Amaranth) was 0% at every tier with runs hitting the 500-loop cap; now 21 / 29 / 84.
3. **Interdict only when this Tank is the player unit the hostile is closest to** — the first cut braced every turn while the Bloom walked past it toward the rest of the squad.
4. **Stale sightings are forgotten** once the unit can see the remembered tile and nothing is there.

### 3.3 What was tried and put back (so nobody repeats it)

- **VIP danger bar at 0.35 or 0.5 of max HP** instead of 0.6: Mission 12 fell from 70% to 3–5%. A commander who never shoots is a squad with one fewer gun; 0.6 is where she still fights from safe seats.
- **Assume-VIPs-leave only when a VIP is deciding** vs **for every unit**: level in aggregate over 14 missions × 20 runs (201 vs 200 wins); the principled version (every unit assumes it) is kept.
- **Ambush gated on a pending objective move**: every hold-zone mission in the check batch got worse (House Amaranth 9 100% → 50%, Mission 12 50% → 30%) — a cloaked unit walking into the zone next turn is a unit the wave can't target.
- **"A flank is fine once two squadmates hold the zone"**: traded House Amaranth 9 100% → 63% for House Amaranth 5 33% → 60%; the simpler rule stays.

### 3.4 Known limits, said plainly

- Hard is a hand-written expert, not a learner (the plan's own framing). It still loses missions that are simply overwhelming — Mission 7's twelve-tile zone under three ranged Sporethrowers and an Undertow, the Mission 21 boss, most of House Amaranth Act III.
- Roughly 1 run in 100 on the old Warden slice (`mission_1a`) still hits the 500-loop cap with a lone survivor; counted as a loss, not investigated further.
- The oracle is a one-ply lookahead — no dodge, no overwatch fire, no wave spawns. It is confirmed only for the commander and Munti, and only when the cheaper allocation model says contact is close.
- The oracle *is* a cheat (no human reads the enemy's code). It's what makes Hard the "can a player who has fully learned this enemy beat it" ceiling; flip `hostileOracle: false` for any PvP use.

---

## 4. The re-baseline (plan Phase D) and the balance rule

Run: `npm run sim:batch -- 100 --all-tiers --seed=1000 --json=…` — all 76 missions (the old Warden slice, Warden Company 1–36, House Amaranth 1–36), 100 seeded runs per tier, 22,800 runs. The MissionSummary dump (86 MB) is kept in the sandbox; the table is below.

**Aggregate:** Easy 31% (2.68 downed / 1.07 lost per run), Moderate 48% (2.86 / 0.93), Hard 73% (2.09 / 0.42). The tiers separate cleanly, and Hard wins more while losing fewer pilots — which is what the tier was for.

### 4.1 The rule, given Maxime's "your call" and the XCOM benchmark

The single ≤15% ceiling was calibrated to the LEGACY bot and is now stale (the tiers plan said it would be). Replacing it with **per-mission target bands on the three-tier fingerprint, read together with Hard's cost columns**:

| Intended difficulty | Easy | Moderate | Hard | Hard downed / run | Hard lost / run |
|---|---|---|---|---|---|
| Opener (first 3–4 of an act) | 40–70% | 80–95% | ≥95% | ≤0.5 | ~0 |
| Standard | 10–30% | 50–75% | 85–100% | 0.5–2 | ≤0.3 |
| Hard (act climax) | ≤10% | 25–50% | 60–90% | 1–3 | ≤0.5 |
| Wall (finale, boss, deliberate) | ≤3% | 10–25% | 40–70% | 2–4 | ≤1 |

How to read it against XCOM: the win column says whether the mission is *beatable* at that skill; the two cost columns say whether it *hurts*. XCOM-hard is a Standard mission that Hard wins 90% of the time with one or two pilots down per run — usually won, always paid for. A mission Hard wins 100% with nobody ever downed is too easy whatever Moderate says; a mission Hard can't win 50% of is more likely unfair than hard (Hard reads the enemy's code — if *that* can't win, a human can't). Moderate's column is the one that should feel right to a competent human; Easy's is the onboarding check.

These bands are a proposal for the tuning job to argue with, not sim-validated targets — exactly as the plan said. **Docs this changes, per the project rule:** `Bloom_Wars_Consolidated_Build_Plan_Progress.md`'s "≤15%" rule (a note has been added there), the EA Launch Plan's Week 3 balance-triage slot, and the tiers plan's §6 (updated).

### 4.2 Fingerprint table (n=100 per tier, seed base 1000)

Flags: "Hard<50%" — likely unfair rather than hard, look at why; "Hard<Moderate" — the cautious tier loses to the brute one, which usually means a hold-zone map where standing and shooting beats positioning, or a map where retreating costs the mission; "trivial" — everyone wins; "nobody wins" — broken.

| Mission | Easy % | Moderate % | Hard % | Hard downed/run | Hard lost/run | Hard timeouts | Flags |
|---|---|---|---|---|---|---|---|
| mission_1a | 0 | 0 | 8 | 4.71 | 1.90 | 4 | Hard<50% (unfair?) |
| mission_1b | 99 | 100 | 100 | 0.00 | 0.00 | 0 | trivial |
| mission_2 | 0 | 3 | 23 | 4.31 | 2.78 | 0 | Hard<50% (unfair?) |
| mission_3 | 74 | 72 | 72 | 0.89 | 0.00 | 0 |  |
| mission_amaranth_1 | 0 | 0 | 21 | 2.16 | 0.36 | 0 | Hard<50% (unfair?) |
| mission_amaranth_2 | 19 | 39 | 84 | 0.81 | 0.00 | 0 |  |
| mission_amaranth_3 | 21 | 29 | 84 | 0.18 | 0.00 | 15 |  |
| mission_amaranth_4 | 16 | 22 | 89 | 2.04 | 1.18 | 0 |  |
| mission_amaranth_5 | 66 | 46 | 100 | 0.64 | 0.00 | 0 |  |
| mission_amaranth_6 | 56 | 99 | 100 | 0.01 | 0.00 | 0 |  |
| mission_amaranth_7 | 28 | 8 | 0 | 2.60 | 1.92 | 0 | Hard<50% (unfair?), Hard<Moderate |
| mission_amaranth_8 | 43 | 65 | 100 | 1.00 | 0.00 | 0 |  |
| mission_amaranth_9 | 6 | 9 | 86 | 0.96 | 0.01 | 0 |  |
| mission_amaranth_10 | 66 | 100 | 100 | 0.00 | 0.00 | 0 |  |
| mission_amaranth_11 | 52 | 100 | 100 | 0.00 | 0.00 | 0 |  |
| mission_amaranth_12 | 0 | 36 | 41 | 3.25 | 1.64 | 0 | Hard<50% (unfair?) |
| mission_amaranth_13 | 2 | 59 | 100 | 0.16 | 0.00 | 0 |  |
| mission_amaranth_14 | 1 | 60 | 92 | 0.09 | 0.00 | 0 |  |
| mission_amaranth_15 | 0 | 34 | 98 | 2.56 | 0.04 | 0 |  |
| mission_amaranth_16 | 3 | 58 | 80 | 2.87 | 0.48 | 1 |  |
| mission_amaranth_17 | 22 | 100 | 100 | 0.00 | 0.00 | 0 |  |
| mission_amaranth_18 | 0 | 48 | 97 | 1.47 | 0.05 | 0 |  |
| mission_amaranth_19 | 0 | 52 | 100 | 0.09 | 0.00 | 0 |  |
| mission_amaranth_20 | 17 | 100 | 98 | 0.22 | 0.00 | 0 | Hard<Moderate |
| mission_amaranth_21 | 0 | 0 | 0 | 6.08 | 0.82 | 0 | Hard<50% (unfair?), nobody wins |
| mission_amaranth_22 | 0 | 0 | 88 | 0.57 | 0.00 | 0 |  |
| mission_amaranth_23 | 88 | 91 | 100 | 0.02 | 0.00 | 0 |  |
| mission_amaranth_24 | 4 | 16 | 87 | 3.18 | 0.38 | 1 |  |
| mission_amaranth_25 | 0 | 0 | 66 | 5.57 | 0.46 | 0 |  |
| mission_amaranth_26 | 40 | 100 | 100 | 0.00 | 0.00 | 0 |  |
| mission_amaranth_27 | 26 | 13 | 66 | 1.14 | 0.00 | 0 |  |
| mission_amaranth_28 | 0 | 0 | 67 | 6.38 | 0.47 | 0 |  |
| mission_amaranth_29 | 2 | 62 | 68 | 1.58 | 0.00 | 0 |  |
| mission_amaranth_30 | 0 | 3 | 98 | 3.34 | 0.04 | 0 |  |
| mission_amaranth_31 | 33 | 77 | 100 | 0.28 | 0.00 | 0 |  |
| mission_amaranth_32 | 17 | 88 | 60 | 0.84 | 0.00 | 0 | Hard<Moderate |
| mission_amaranth_33 | 0 | 18 | 98 | 1.05 | 0.00 | 0 |  |
| mission_amaranth_34 | 0 | 35 | 95 | 7.12 | 0.08 | 0 |  |
| mission_amaranth_35 | 2 | 25 | 71 | 2.43 | 0.00 | 0 |  |
| mission_amaranth_36 | 0 | 12 | 87 | 8.63 | 0.13 | 0 |  |
| mission_house_amaranth_1 | 90 | 100 | 100 | 0.05 | 0.00 | 0 | trivial |
| mission_house_amaranth_2 | 100 | 100 | 100 | 0.00 | 0.00 | 0 | trivial |
| mission_house_amaranth_3 | 100 | 100 | 100 | 0.00 | 0.00 | 0 | trivial |
| mission_house_amaranth_4 | 91 | 97 | 99 | 0.15 | 0.00 | 0 | trivial |
| mission_house_amaranth_5 | 95 | 99 | 43 | 0.87 | 0.24 | 0 | Hard<50% (unfair?), Hard<Moderate |
| mission_house_amaranth_6 | 37 | 54 | 100 | 0.01 | 0.00 | 0 |  |
| mission_house_amaranth_7 | 100 | 100 | 100 | 0.16 | 0.00 | 0 | trivial |
| mission_house_amaranth_8 | 9 | 5 | 44 | 1.38 | 0.07 | 0 | Hard<50% (unfair?) |
| mission_house_amaranth_9 | 49 | 100 | 99 | 1.15 | 0.08 | 0 | Hard<Moderate |
| mission_house_amaranth_10 | 100 | 100 | 100 | 0.00 | 0.00 | 0 | trivial |
| mission_house_amaranth_11 | 100 | 100 | 100 | 0.00 | 0.00 | 0 | trivial |
| mission_house_amaranth_12 | 52 | 22 | 90 | 0.12 | 0.00 | 0 |  |
| mission_house_amaranth_13 | 9 | 91 | 97 | 0.41 | 0.00 | 0 |  |
| mission_house_amaranth_14 | 80 | 100 | 100 | 0.41 | 0.00 | 0 | trivial |
| mission_house_amaranth_15 | 6 | 0 | 100 | 1.69 | 0.00 | 0 |  |
| mission_house_amaranth_16 | 11 | 35 | 87 | 0.66 | 0.04 | 0 |  |
| mission_house_amaranth_17 | 98 | 100 | 100 | 0.06 | 0.00 | 0 | trivial |
| mission_house_amaranth_18 | 38 | 40 | 47 | 6.11 | 1.94 | 0 | Hard<50% (unfair?) |
| mission_house_amaranth_19 | 46 | 61 | 94 | 1.88 | 0.00 | 0 |  |
| mission_house_amaranth_20 | 99 | 100 | 100 | 3.43 | 0.93 | 0 | trivial |
| mission_house_amaranth_21 | 8 | 5 | 87 | 0.61 | 0.00 | 0 |  |
| mission_house_amaranth_22 | 42 | 31 | 78 | 0.24 | 0.00 | 0 |  |
| mission_house_amaranth_23 | 6 | 6 | 33 | 5.83 | 1.57 | 0 | Hard<50% (unfair?) |
| mission_house_amaranth_24 | 0 | 17 | 40 | 0.36 | 0.00 | 0 | Hard<50% (unfair?) |
| mission_house_amaranth_25 | 1 | 0 | 48 | 5.01 | 1.03 | 0 | Hard<50% (unfair?) |
| mission_house_amaranth_26 | 75 | 96 | 95 | 4.00 | 0.94 | 0 | Hard<Moderate |
| mission_house_amaranth_27 | 7 | 0 | 16 | 0.00 | 0.00 | 0 | Hard<50% (unfair?) |
| mission_house_amaranth_28 | 5 | 69 | 52 | 4.42 | 0.50 | 0 | Hard<Moderate |
| mission_house_amaranth_29 | 0 | 10 | 30 | 4.86 | 0.48 | 0 | Hard<50% (unfair?) |
| mission_house_amaranth_30 | 0 | 4 | 25 | 6.21 | 0.72 | 2 | Hard<50% (unfair?) |
| mission_house_amaranth_31 | 3 | 0 | 9 | 0.05 | 0.00 | 0 | Hard<50% (unfair?) |
| mission_house_amaranth_32 | 5 | 0 | 4 | 5.45 | 1.77 | 0 | Hard<50% (unfair?) |
| mission_house_amaranth_33 | 14 | 7 | 41 | 3.40 | 0.29 | 0 | Hard<50% (unfair?) |
| mission_house_amaranth_34 | 0 | 25 | 8 | 7.47 | 2.83 | 0 | Hard<50% (unfair?), Hard<Moderate |
| mission_house_amaranth_35 | 4 | 7 | 1 | 7.48 | 5.48 | 0 | Hard<50% (unfair?), Hard<Moderate |
| mission_house_amaranth_36 | 38 | 99 | 69 | 5.35 | 0.39 | 0 | Hard<Moderate |

### 4.3 What the table says, in five lines

- **Warden Act I is inverted right now.** Missions 1, 7, 12 and 21 sit at 0–41% on Hard while 5, 6, 10, 11 are 100% with nobody downed. The concurrent 1 Sep retune of Act I to a ≤15% LEGACY ceiling produced a first mission nobody can win (0 / 0 / 21). Under any XCOM reading, an opener at 0% for a newcomer is the first thing to fix.
- **Extract missions (5, 10, 11, 26, and House Amaranth's) are now easy** because the bot stopped throwing them (§3.2). Retune them up, not the bot down.
- **The three that Hard can't crack are boss/attrition shapes**: Mission 21 (0 / 0 / 0), Mission 7 (28 / 8 / 0 — Easy wins by charging, which is its own tell), Mission 1 (attrition against nine Crawlmass).
- **House Amaranth Act III (27–36) is very hard for every tier** — most under 50% on Hard, several under 10%, with 5–7 pilots downed per run. Some of that is design (act finale), some is objective failure with nobody downed (27, 31: Hard loses with 0.0 downed per run, which means the clock, not the enemy, beats it).
- **The old Warden slice (`mission_1a`, `mission_2`) is unwinnable at every tier** and was already superseded; leave it or delete it.

---

## 5. Things Maxime should decide (flagged, not done)

1. **The balance rule** (§4.1) — sign off, adjust the bands, or keep one number and say which tier it applies to.
2. **Considered and NOT built — an engine rule change:** "a hostile that attacks is revealed to the player for one turn." It would help every tier against burrowed/ambushing enemies and is what most tactics games do, but it's a gameplay change, so it's a decision, not a bot fix.
3. **Difficulty settings for players tied to these tiers** (the feature-gap report's item) — still unbuilt; the profiles exist, the settings screen doesn't.
4. **Upload half of telemetry** — still off, by the plan's own split.

## 6. Still open from the feature-gap report

Enemy-phase playback (A4), audio (A6), memorial / service-record screens (B2/B3 — the store queries exist, no UI), portraits wiring (B4), briefing room (B5), name-your-company, the French string table. None started.
