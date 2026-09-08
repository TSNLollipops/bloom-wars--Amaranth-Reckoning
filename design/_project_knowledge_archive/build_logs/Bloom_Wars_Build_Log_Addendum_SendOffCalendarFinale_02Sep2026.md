# Bloom Wars — Build Log Addendum: Send-Off Battle Payoff, Finale Day-Count, Named Landmarks — 2 Sep 2026

Session context: after the calendar economy v2 (real-time clock) and the crew-interactions brainstorm both shipped earlier the same day, Maxime asked what's next, got a breakdown of small ready-to-build items vs. bigger items needing his own call, and green-lit the small ones directly: "1: do it" (Send-Off tactical bonus) and "3: you can do the smaller stuff that doesnt need my input while I chose the rest" (the rest of the small items), while explicitly reserving Calendar Teeth mechanics, the House Amaranth Hub, AI tier sign-off, and mission balance rough edges for himself. This addendum covers everything built under that instruction.

## Shipped

**Send-Off's Battle-side tactical payoff.** The Send-Off social verb shipped Hub-side only on 2 Sep 2026 (crew-interactions pass) — `CampaignState.preMissionSendOff = { pilotId, grantedAt }` was written but never read anywhere. That was a deliberately named, unconsumed hook, not an oversight (see that day's crew-interactions addendum). Wired it up:

- `data/socialActions.ts` — new `SEND_OFF_DEFENSE_BONUS = 8` constant, flagged in its own comment as an unvalidated placeholder number, same discipline already used for Antfarm costs, Insult tiers, and Weapon Branch bonuses: reasoned and shipped, not run through `combat_sim.py`, because the "run it through the sim" bar this project holds strictly is for Bloom archetype stats and maps, not every social-sim number.
- `engine/units.ts` — `createPlayerUnit` takes a new `overrides.sendOffBonus?: boolean`; when true, adds the flat bonus to `effectiveDefense` and sets a new `sentOff` flag on the returned unit. Matches the existing Weapon Branch Point pattern (`IMPACT_LANCE_ATK_BONUS`) rather than inventing a new mechanism.
- `engine/mission.ts` — `DeployRosterEntry` gets a matching `sendOffBonus?: boolean`, threaded through to `createPlayerUnit` in `deployPlayerUnits()`.
- `scenes/Battle.ts` — `resolveDeployRoster()` is where `CampaignState.preMissionSendOff` actually gets read: finds the matching roster entry by `pilotId`, flags it, then clears `preMissionSendOff` and saves state, so the bonus fires exactly once regardless of whether the flagged pilot actually deploys that mission.

Defense bonus, not attack — matches the "watch my back" protective flavor of the line bank rather than a generic stat-up.

**Finale day-count display.** `scenes/Debrief.ts` already reuses one screen for every mission including both campaign finales (`mission_amaranth_36`, `mission_house_amaranth_36`). Added a `CAMPAIGN COMPLETE` callout that only fires on a winning finale mission, showing `formatDayLabel(state)` — the player's own real run length in in-fiction days. Framed as a shareable personal stat, no leaderboard or comparison attached, matching the calendar system's own stated design intent.

**Named calendar landmarks.** `engine/calendarClock.ts` gets `CALENDAR_LANDMARKS: Record<number, string>` and `landmarkForDay()`, seeded with the two examples Maxime had already approved during the calendar design pass: Day 47 ("Muster") and Day 212 ("The Reckoning"). `formatDayLabel()` now appends the landmark name when the current day has one (`"Day 47 — Muster"`), falling back to the plain `"Day 47"` format everywhere else. Empty room left to add more landmarks later — it's just more entries in the record.

## Found already done, not rebuilt

The fourth item on the small-items list — a pause-menu link to `HOW_TO_PLAY.html` — turned out to already be shipped, under a bigger form: the in-game Codex (`scenes/Codex.ts`, reachable via a CODEX button in `MenuOverlay.ts`'s pause menu), built 1 Sep 2026 as part of the Forgotten Plans audit follow-up. `Bloom_Wars_Forgotten_Plans_Audit_1Sep2026.md`'s "Lower-stakes" bucket still said this link was missing — corrected in place today rather than left to drift further, per this project's own "don't let docs quietly drift" rule.

## Verification

New/expanded test coverage: `engine/__tests__/sendOff.test.ts` (new, 4 tests) covers `createPlayerUnit`'s defense-bonus/`sentOff`-flag behavior directly and through the real `Mission`/`DeployRosterEntry` path, using real registry pilots (`pilot_rourke`, `pilot_nagori`, `pilot_barasj`) and `MISSION_1A`. `engine/__tests__/calendarClock.test.ts` gained a `named calendar landmarks` block (4 tests) covering both seeded landmarks, the no-landmark default, and the day-213 boundary.

Full pipeline run clean in the cloud sandbox (this session had no `device_bash`, so verification happened on a staged mirror rather than the live repo directly):
- `npx tsc --noEmit` — clean
- `npx eslint src/` — clean
- `npx vitest run` — **all 66 test files, 1396 tests passed**, zero regressions
- `npm run build` — clean production build (80 modules, no tsc errors; the usual >500kB single-chunk warning, pre-existing and unrelated)

All 8 changed/new files were then committed back to the real repo via the device bridge, each guarded by a fresh on-disk mtime check immediately before writing, and confirmed afterward by a second listing showing the new sizes/mtimes actually landed:
- `src/data/socialActions.ts`
- `src/engine/units.ts`
- `src/engine/mission.ts`
- `src/scenes/Battle.ts`
- `src/engine/calendarClock.ts`
- `src/scenes/Debrief.ts`
- `src/engine/__tests__/calendarClock.test.ts` (expanded)
- `src/engine/__tests__/sendOff.test.ts` (new)

## Honest gaps

- `SEND_OFF_DEFENSE_BONUS = 8` is a reasoned placeholder, not a `combat_sim.py`-validated number — flagged in the code comment itself, same as this project's other shipped social-sim constants.
- `Battle.ts`'s `resolveDeployRoster()` consumption logic (the actual read-and-clear of `preMissionSendOff`) is not covered by an automated test — `Battle.ts` imports Phaser at module scope, same reason `Hub.ts` has zero unit tests. Verified by direct code reading instead: straight-line find-and-flip, no branching, mirrors the already-proven "resolve once against whatever state exists" pattern used elsewhere (Munti guarantee, bonus objectives).
- No live-browser check this session — no dev server reachable from this sandbox. `tsc`/`eslint`/`vitest`/`npm run build` all clean is strong evidence, not the same as clicking through it. Worth a real playtest of a Send-Off → mission → Debrief loop and a finale run when convenient.

## Not touched

Per Maxime's own instruction, none of the reserved bigger items were touched: Calendar Teeth mechanics, the House Amaranth Hub build, AI tier sign-off, or the Mission 8/12/21 balance rough edges. Still his call.
