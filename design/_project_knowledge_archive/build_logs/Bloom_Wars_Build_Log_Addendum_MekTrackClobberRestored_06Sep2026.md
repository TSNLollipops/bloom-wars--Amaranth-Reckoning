# The mek-track pass was half-overwritten — found, recovered from git, merged — 6 Sep 2026 (night)

**Status: on Maxime's machine.** Four files (`engine/mission.ts`, `scenes/Battle.ts`, `scenes/Debrief.ts`, `engine/__tests__/mekTracks.test.ts`), mtime-guarded, committed 22:10 UTC. Gate afterwards: `tsc` 0 errors, 100 test files / **2510 / 2510** passing, `eslint` clean, **`vite build` clean** (first clean production build since the clobber), plus `checkActionBarPaging.mjs` (Battle) and `checkDebriefAndMinigameGate.mjs` (Debrief + Hub chat) both PASSED live.

## What was actually wrong

Not "three fields missing from `types.ts`," as first read. The House Amaranth Hub addendum reported 11 type errors and 11 failing tests on the tree as staged at 20:50, all in the mek-track area, and guessed at an unsaved file. Digging in for the fix showed something worse and more specific:

**Three files on disk had lost the mek-track pass.** `data/types.ts`, `engine/units.ts`, `engine/combat.ts`, `engine/campaignEconomy.ts`, `engine/turnManager.ts` and the tests all carried the 16:18 UTC mek-track changes. But `engine/mission.ts` (mtime 17:38), `scenes/Battle.ts` (17:24) and `scenes/Debrief.ts` (19:31) did not — each was an OLDER version plus a later session's own work on top:

- `mission.ts` = the pre-mek-track file **+ the Beacon/Rourke-rank-gate session's work** (`MissionOptions.rourkeRank`, the new `beaconHolderId()` — Rourke at Captain+, Marrow unconditionally). Missing: `tilesMovedThisTurn` (it still wrote the old `movedThisTurn` boolean nothing reads any more), `tickStationaryRepair` (the Fieldwright heal — never ran), `beaconCrateSourceFor` / `sparePartsSpent` (Fabricator parts as the pilot's own Beacon crate — never ran), the initiative log line, `AttackOutcome.defenderStruckFirst`, and the live-mek-copy read in `repairHealAmount`.
- `Battle.ts` = pre-mek-track **+ the rank-gate session's `rourkeRank` option and comment**. Missing: the initiative forecast text and the spare-part Beacon legend.
- `Debrief.ts` = pre-mek-track **+ the House Amaranth Third Lance session's work**. Missing: the `applySparePartsConsumption` call (parts spent in a mission were never decremented on the campaign).

Plain-language version of how this happens: three sessions each took a copy of the folder at roughly the same time, each edited its own files, and each wrote its copy back. The mek-track session wrote first. The two later sessions' copies of those three files were taken *before* the mek-track write, so when they wrote them back they put the old text underneath their own additions. The mtime guard on `device_commit_files` exists for exactly this — it refuses to overwrite a file that changed since you took your copy — so either the later writes were forced or the guard wasn't passed for those files. Either way, the result was a tree where `frameSystems.ts` read `tilesMovedThisTurn` and `mission.ts` never set it: the Battery Frame rule silently dead, the Fieldwright heal silently dead, spare parts silently never consumed. The 11 type errors were the only visible symptom, and only because `campaignEconomy.ts` and the test file *did* have the new code and referenced what `mission.ts` no longer had.

## How it was recovered

Maxime committed to git at **17:08 UTC** ("hub upgrade", `85ecbf03`) — after the mek-track write (16:18) and before all three clobbering writes (17:24 / 17:38 / 19:31). That commit's blobs of the three files are the mek-track versions, intact. With no shell on the device, the objects were read the long way: stage the commit object → its tree → `src` → `engine`/`scenes` → the three blobs, decompress each in the sandbox. Then a hand three-way merge per file, checked in both directions afterwards:

| File | Base taken | Re-applied from disk | Verified dropped |
|---|---|---|---|
| `mission.ts` | git 17:08 (mek-track) | `Rank` import, `MissionOptions.rourkeRank`, the `rourkeRank` field + constructor line, the new `beaconHolderId()` and its doc; removed the now-unused `Tier` import and `BEACON_TIER_ORDER` | only the old code the mek-track pass had replaced (23 lines: registry `repairHealAmount`, `movedThisTurn`, old log, old crate logic) and the old highest-tier `beaconHolderId` (14 lines) |
| `Battle.ts` | git 17:08 | `rourkeRank: campaignForMission?.rourkeRank ?? "2nd_lt"` and the rewritten Beacon-button comment | the old "costs a Fabricator crate" legend line |
| `Debrief.ts` | **disk** (the Third Lance work is the larger side) | — | nothing; re-added the `applySparePartsConsumption` import and call |

**One real merge conflict, in a test.** `mekTracks.test.ts`'s four Fabricator/Beacon tests build a Warden mission and take `beaconHolderId()`'s answer as the holder. Under the rank-gate rule that is `null` at the `"2nd_lt"` default, so all four threw on `undefined.pos`. Neither session could have seen this: the tests didn't exist in the rank-gate session's base, and the rank gate didn't exist in the mek-track session's. Fixed the way `beaconControl.test.ts`'s own helper already does — `quietWarden` now passes `rourkeRank: "maj"`, with a comment saying why. The tests are about the crate source, not the holder rule.

## What this means for what you were told earlier tonight

- The mek-track addendum's claims are true again: Fieldwright heals a stationary pilot, Battery Frame refuses an attack after a move, a Fabricator's parts feed the Beacon and decrement at Debrief, initiative is logged and forecast. **Between roughly 17:38 and 22:10 UTC none of that ran**, and a Warden mission played in that window would have had Lask never healing himself. No save was harmed — nothing here persists wrongly, it just didn't happen.
- The Beacon/Rourke-rank-gate work and the House Amaranth Third Lance work are intact and still on disk.
- The House Amaranth Hub build is unaffected (its files were not among the three).
- **Process, said plainly:** this is the second time today the "several sessions, one evening" pattern has bitten (the first was the doc-sync gap `Now_And_Next` opens with). The guard that would have caught it is the `expectedMtimeMs` check on every write; it only works if every session passes it and none forces past a rejection. Worth a line in the project instructions.

## Verification

- `npx tsc --noEmit`: 0 errors (was 11).
- `npx vitest run`: 100 files, **2510 passed, 0 failed** (was 11 failed).
- `npx eslint` on the four files: clean.
- **`npx vite build`: clean** — the production build was blocked while the errors stood.
- Live, headless Chromium against the dev server: `checkActionBarPaging.mjs` PASSED (Battle scene boots, the action bar pages with the repaired `mission.ts` underneath); `checkDebriefAndMinigameGate.mjs` PASSED (Debrief resolves a mission and the Hub's CO brief/debrief chat answers), no console or page errors in either.
- Not verified: nobody has watched the recovered behaviour on Maxime's machine — the same "sandbox only" caveat the mek-track addendum itself carried.

## Queued next, at Maxime's word: Verinis's voice

Logged here because he asked for it to be: *"log the co line ill deal with it next."* Today the CO in either hub is one slot reading one set of shared line banks written for Arangement of Content (`data/smallTalk.ts`'s `pickCoGreetingLine` / `pickCoFarewellLine` / `pickCoAdviceLine`, `data/socialActions.ts`'s `pickCoConfideLine` / `pickCoCalloutLine`, the check-in nudge, the brief/debrief reactions, and the build-approval sentences hard-written in `Hub.ts`'s `handleBuildRequest`). Verinis functions — check-in, brief, build approval, advice, confide all work — in a warm mentor's words, and one line in `Hub.ts` calls the player "Rourke" by name ("Every mission on the board's flown, Rourke.").

The plumbing half, which can go in before a single line is written: (1) key the CO banks by a `coVoice` id on the facility profile (`"arangement"` / `"verinis"`) so each `pickCo*` reads its own bank and falls back to Arangement's until Verinis's exists; (2) make `Hub.ts`'s hard-written CO sentences (`handleBuildRequest`, the brief/debrief bubbles, the check-in nudge) read the same bank instead of literals; (3) replace the hardcoded "Rourke" with the MC's short name from the profile. The content half is Maxime's, per the 4 Sep workflow: his first batch of Verinis lines, a matching second batch after, in the register the Facility Plan locked ("an asshole, plain and simple" — full authority over the estate, none over Marrow in the field).
