# Phase 1 Recon Pass — Gap Log (6 Sep 2026)

> **Fix-pass update, same day:** two items below got fixed, one turned out not
> to be a bug, one is staying with Maxime — see
> `Bloom_Wars_Build_Log_Addendum_AuditFixPass_06Sep2026.md` for the full
> writeup. This doc is kept as-is below as the original Phase 1 record.

Ran against a **fresh** stage of the live repo (re-pulled 6 Sep, same day as this
doc — not the earlier same-day snapshot, which was already stale by the time
this pass started). Full methodology: `npm install` clean, then `typecheck` /
`lint` / `test` in the cloud sandbox, then the whole `tools/verify/*.mjs`
Playwright harness against a live `npm run dev`, then a manual grep-based
reachability sweep over `src/data/`'s catalogs. This is Phase 1 of the audit
plan (the "find problems" plan) — Phase 2 (fix order) is separate and not
started.

Bottom line up front: **the mechanical foundation is solid.** Typecheck is
clean, 2298/2298 tests pass, and the live-browser harness came back green on
the large majority of real user-facing systems it covers, including two
systems Maxime asked about by name (Heartwood gating, and general catalog
reachability). Nothing found below is a "the game is broken" finding. Most of
it is *paperwork drift* — docs and one test fixture that didn't get updated
when the game moved past them — plus a small number of real, narrow bugs
worth a look.

---

## 1. Toolchain baseline (Pass C)

- `npm run typecheck` — **clean, 0 errors.**
- `npm run lint` — **1 error.** `tools/verify/checkNoBodyCollision.mjs:77`,
  unused variable `beforeWallPY` (`@typescript-eslint/no-unused-vars`). Lives
  in a verify script, not shipped game code; doesn't block `test` or `build`
  (those only run the spoiler/cast-collision lints via `pretest`/`prebuild`,
  not full eslint). Still, `npm run lint` itself is not currently clean —
  five-minute fix whenever it's convenient.
- `npm test` — **2298/2298 passing, 98/98 files.** `commanderDown.test.ts`
  passed clean this run (7/7) — consistent with "flaky," not "broken," per
  the root cause already on record in `Bloom_Wars_Master_Index.md`
  (`riggedHostileAttack()` never stubs the Meeps dodge roll). No new
  information here; still deprioritized per Maxime's own call.

## 2. Live-browser verify harness (Pass D)

Ran the self-test first (proves the audit tooling can actually detect
breakage) — **PASSED**, every injected bug caught, clean afterward. Then ran
26 of the ~30 scripts in `tools/verify/`. Real findings below; everything not
listed came back full PASS with no notes.

### 2a. Worth a look

- **Priced social verbs aren't charging their time cost.**
  `checkCalendarClock.mjs` measured the "share a drink" verb's `accent` (the
  extra calendar-day cost a *priced* verb is supposed to add on top of its
  base time cost) at `0.0000556` days against an expected `0.25` — roughly
  1/4500th of what it should be. Free verbs (praise) charged correctly in the
  same run. This reads like a live bug in whatever wires a verb's cost into
  `logVerbAndCharge` — haven't traced the exact line, flagging for a source
  dive rather than guessing at a fix.
- **The Battle action bar's own "worst case" assumption no longer holds.**
  `checkActionBarPaging.mjs` FAILED outright: its hardcoded expectation is
  that the heaviest real kit in the game (Osric Ferrow / Last Word,
  fully equipped) is exactly 6 verbs — filling the bar with no MORE button
  needed. Live count right now is **7** (adds BEACON to the kit this script
  and its save fixture were written against on 3 Sep). Beacon Control shipped
  4 Sep, one day later — so this is very likely new content the test never
  got updated for, not a regression. Two ways to close this: if a 7-verb
  heaviest kit (now needing MORE) is fine, update the script's expectation;
  if BEACON shouldn't be on this kit by default, that's a real content bug.
  Maxime's call which one it is.
- **`checkDockCameraSplit.mjs`'s own `instructionsFitAndClear` check reported
  `false`** — its self-check for whether the Hub's on-screen instructions
  text clears `deckIndicatorText` under the narrowed dock-split viewport (Spar
  Deck, specifically) came back failing. The whole-game 28-screen sweep
  (`sweepUi.mjs`, see 2b) did NOT catch this — its generic OVERRUN/COLLIDE
  checks came back clean everywhere, so this is either a narrower condition
  the sweep's screen list doesn't hit, or a tighter tolerance in this script's
  own check than sweepUi's. Given this harness's own track record (three
  previous real shipped bugs caught nowhere else), worth a five-minute manual
  look rather than dismissing it.
- **`checkDebriefAndMinigameGate.mjs` crashes outright** — a genuine
  Playwright timeout trying to open the chat box right after teleporting the
  player onto the CO's grotto dais (`hub.currentRoomId = "grotto"` then press
  T). The general chat mechanism is proven fine moments before and after in
  this same run (`checkSocialActions.mjs`, `checkCalendarClock.mjs` both open
  chat successfully elsewhere), and `checkHubCameraScroll.mjs`'s own direct
  teleport into the grotto works fine for camera state — so this looks
  narrowly scoped to "open chat immediately after this specific teleport,"
  not a broad regression. The two behaviors this script exists to protect —
  the CO's brief/debrief routing, and the ambient-encounter room-leak fix —
  have had **zero live-browser coverage** for however long this has been
  broken. Recommend reproducing by hand once (walk to the CO on the grotto
  dais, press T) before assuming either way.

### 2b. Full PASS, no notes

Self-test, `checkHubNpcs`, `checkSocialActions`, `checkHubCameraScroll`,
`checkHubInteractionAfterScroll`, `checkHubDoorReachability` (6/6 doors),
`captureHubDecks`, `checkActionBarPaging`'s label-fit sub-checks,
`sweepUi` (28/28 screens, zero OVERRUN/COLLIDE/OFFSCREEN/PAINTEDOVER
findings), `checkRecruitLance`, `checkNoBodyCollision`, `checkMemorial`,
`checkCodex` (all bestiary/personnel/world unlock-gating scenarios),
`checkFramePanel` (both Hangar and Hub shop entry points, plus the
Transporter Pad link), `checkStandingsBoard`, `checkVaultShelf`,
`checkCompanyName`, `checkMissionBriefing`, `checkMusterMekAck`,
`checkCopyMissionLog`, `checkPortraits`, `checkHangarShopFitsDock`,
`checkRosterMemorialDebriefPortraits`, `checkTransporterPortraits`,
`promoScreens`, `uiPlanScreens`.

`checkPortraitImages.mjs` printed an empty list with no pass/fail verdict —
informational script, not a finding on its own.

### 2c. Harness fixture is stale, not the game (see §4 for the full story)

- `checkLanceWorkshops.mjs`: `allThreeWorkshopsUsed: false`. Correct result
  against the actual seeded save — see §4.
- `checkRosterPanel.mjs`: crashes on an assumed 2nd Lance pilot that doesn't
  exist in the seeded save (`Cannot read properties of undefined (reading
  'pilot')` at line 133, trying to pick a 2nd Lance pilot to swap). Same root
  cause as above.

## 3. Catalog reachability sweep (Pass B)

Extracted every id in `data/bloom.ts` (11 Bloom archetypes) and
`data/units.ts` (12 unit archetypes + 2 hostile mechs), grepped the whole
`src/` tree for both defined-but-unreferenced and referenced-but-undefined
ids. **Clean.** Every archetype is referenced from real mission/campaign
content; no code anywhere references a `bloom_*` or `arch_*` id that isn't
actually defined. (The raw grep surfaced ~18 candidates that looked like
dangling references at first glance — all resolved on inspection to sprite
keys, an unrelated `SilhouetteKind` enum sharing the `bloom_` prefix by
coincidence, a `TileType` constant, comment shorthand, and one deliberate
test fixture literally named `bloom_does_not_exist`. None were real.)

This was the most direct test available for "is there missing data I haven't
found yet" — for these two catalogs, the answer is no. Heirlooms, Frame
Systems, and Carrier Modules weren't swept the same grep-based way, but got
equivalent-strength evidence for free from Pass D: `checkVaultShelf.mjs` and
`checkFramePanel.mjs` exercised every heirloom/system/module end to end
through the real UI and came back clean.

One real (harmless) finding: `data/allCampaigns.ts` line 80's own comment
names the Mission 35 finale creature as "data/bloom.ts's own `bloom_cradle`"
— no such id exists in `bloom.ts`. The actual Act III finale archetype is
`bloom_unnamed`. Comment-only drift, doesn't affect anything at runtime, but
worth a one-line fix so nobody goes looking for a `bloom_cradle` that isn't
there.

## 4. The one root cause worth understanding: `genSave.ts` is stale

On 5 Sep, Second/Third Lance integration was deliberately redesigned
(`campaignState.ts`'s own comment, quoting Maxime: *"player should recruit
their lance teamate not have a team be creste for them"*) — lances now arrive
**empty** for the player to recruit into, instead of handing over 5
pre-built pilots each. `checkRecruitLance.mjs` verifies this whole new flow
works correctly end to end (**PASSED**).

`tools/verify/genSave.ts` — the fixture generator most of the verify harness
boots against — was never updated for this. Its own header comment and
`tools/verify/README.md`'s description of it both still say "all three
lances integrated, 15 pilots / 10 meks." It actually now produces a **5-pilot**
save (1st Lance only), because `integrateSecondLance`/`integrateThirdLance`
correctly grant empty lances and nothing in the fixture script recruits into
them. Two downstream scripts hit this directly: `checkLanceWorkshops.mjs`
(correctly reports only 1 of 3 workshops used) and `checkRosterPanel.mjs`
(crashes trying to test a 2nd-Lance swap against a pilot that doesn't exist).

Not a game bug — the game's new behavior is verified correct. The fixture
generator just needs a handful of `pickForSwap`-equivalent calls added so it
recruits a full roster the way a real player would, matching what
`checkRecruitLance.mjs` already proves works.

## 5. Doc drift (Pass A)

- **`Bloom_Wars_Master_Index.md` — the doc Maxime's own project instructions
  say to check first for current state — hasn't been touched since 25 Aug.**
  In that time the project shipped (per this project's own doc list): Frame
  Systems Layer, a 10-entry Heirlooms system, a Weapon Branches expansion,
  Riot Drum, Suppression Autocannon, Maser Lance, Combat Medic, Pilot
  Discharge, and the 5 Sep recruit-your-own-lance redesign covered in §4 —
  none of it mentioned. This is the single highest-value doc fix on this
  whole list, since it's the one place Maxime is told to look first.
- **Root `README.md`** — already self-flagged as stale inside
  `Bloom_Wars_Master_Index.md` (still describes the 4-mission Team One
  slice as current). Confirmed still stale, unchanged.
- **`data/carrierModules.ts`'s own `LOCKED_MODULES` list** gives "No Heirloom
  exists in code yet" as the reason "Runic Integration Line" stays
  unbuildable. Heirlooms are now a fully built, tested, 10-entry system
  (confirmed live and working in §2b). Either that module should come off
  the locked list now, or there's a different, still-real reason to keep it
  locked that the comment hasn't been updated to say.
- `tools/verify/README.md`'s description of `genSave.ts` — see §4.

## 6. Already handled — no action needed, recorded so nobody re-checks these

- **`bloom_heartwood`** — confirmed still orphaned from both shipped
  campaigns' spawn tables (superseded by `bloom_unnamed`, exactly as Maxime
  found) — **and** already correctly gated in the shop:
  `checkFramePanel.mjs` confirms "Heartwood Graft hidden because its source
  never spawns in this campaign," live, PASSED. This item from Maxime's
  original message is done.
- **The Hub NPC named "Arangement of Content"** — flagged this as a
  suspicious placeholder on first sight, checked the source before writing
  it up: it's the real, deliberately-named Carrier CO character, documented
  in `Bloom_Wars_Antfarm_Carrier_Hub_v1.md` §11.3 and referenced consistently
  across 11 files. Not a bug. (Purely cosmetic aside: it's spelled the same
  missing-an-r way — "Arangement," not "Arrangement" — everywhere it
  appears, including the design doc. If that's not a deliberate stylization
  it's a very old, very consistent typo. Not treating it as an action item.)
- **Cross-campaign parity** — House Amaranth correctly has no Third Lance
  (by design, stays on a combined 10-pilot squad from Mission 13 on, per
  `campaignState.ts`'s own comment), and its Second Lance pilots/meks are
  correctly wired into the shared `pilotRegistry.ts` lookup — unlike three
  earlier, now-fixed instances of exactly this bug shape for Warden's own
  lances (that file's own comments document all three). Worth remembering
  as a pattern: **any future new pilot batch, for either campaign, needs an
  entry in `pilotRegistry.ts` or it'll throw "Unknown pilot id" the moment
  a mission tries to deploy them** — it's bitten this codebase three times
  already. The one known cross-campaign gap remains the one already
  self-flagged in `allCampaigns.ts`: nothing stops a Warden save from
  browsing into an empty House Amaranth tab, or vice versa. Unchanged,
  still open, still exactly as low-risk as before.

## Still open from Maxime's original ask

- The "missing data... bad news" item Maxime mentioned at the start of this
  audit hasn't been detailed yet — nothing found in this pass obviously
  matches "bad news" scale (the reachability sweep in §3 came back clean).
  Add the specifics here whenever ready, or point at the file it lives in and
  this can get traced directly.
