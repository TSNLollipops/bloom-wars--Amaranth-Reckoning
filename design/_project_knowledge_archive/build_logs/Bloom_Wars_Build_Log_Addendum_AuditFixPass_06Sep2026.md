# Build Log Addendum — Audit Fix Pass (6 Sep 2026)

Follow-up to `Bloom_Wars_Audit_Phase1_GapLog_06Sep2026.md`. Maxime's ask: *"check
current game version then fix the bug."* Before touching anything, re-verified
against the live repo — byte-for-byte diffed the files this pass needed
(`Hub.ts`, `calendarClock.ts`, `checkCalendarClock.mjs`,
`checkNoBodyCollision.mjs`, `checkDebriefAndMinigameGate.mjs`) against what's
actually on the device right now. All five were identical to the Phase 1
snapshot — nothing had drifted, so the fixes below are against current code,
not a stale copy.

Four items were on the table from the Gap Log. Two got fixed, one turned out
not to be a bug at all, and one is staying with Maxime on purpose.

## Fixed: `checkDebriefAndMinigameGate.mjs` crash

Root cause found, and it's a real one, just not in the game. The CO's
"brief" chat command stopped being a chat bubble on 4 Sep (Codex Rebuild &
Live Briefing Plan v1 Part B) — it now opens a real `MissionBriefingPanel`
that, like every other overlay in `Hub.ts`, "owns input entirely while open"
and only closes on Esc. This verify script was written 2 Sep, before that
change shipped. It asks for a brief, then immediately tries to reopen chat
for the next case — but the panel is still up, eating every keypress
including "t", so the chat input never becomes visible and Playwright's
`fill()` sits for its full 30s timeout before crashing the whole script.

**Not a game bug.** `missionBriefingOpen` gates input exactly the way
`vaultOpen`/`standingsOpen`/`workshopOpen` already do — same pattern, working
as designed. The script just never learned about the new panel. Fixed by
reading the panel's own title/body text for the record, then pressing Escape
to close it before moving on — the same thing a real player would do.
Confirmed clean over three back-to-back runs after the fix.

While in there, verifying the fix ran the room-gate test (Case 5, 300 calls)
and turned up a second, smaller issue in the same file: its "did a minigame
leak into Hangar Deck" check was a bare keyword scan (`/poker|peg
board|fletchers/i`), which false-positived on an unrelated ambient banter
line — `data/ambientLines.ts` has a "green" pilot advice line that says *"I
can walk you through Fletchers technique"* as in-fiction flavor text, nothing
to do with the actual minigame. Confirmed by reading `socialSim.ts`: every
real pegBoard/poker/fletchers narration starts with the literal
`"{pilotA} and {pilotB} "` prefix, so the check now requires that prefix
alongside the keyword instead of the keyword alone. The room-gate itself
(`minigamesEligible` in `Hub.ts`'s `runNpcEncounter`) was never the problem —
confirmed zero real leaks across every run, this pass and Phase 1 both.

Also hardened `sayInChat`'s single "t"-press-then-150ms-wait into the same
retry-loop `checkCalendarClock.mjs` already uses (press "t", wait for the
input to actually go visible, retry up to 6 times) — three sequential runs
during this fix hit three different, unrelated crash points from a keypress
race under this sandbox's slower headless rendering, which had nothing to do
with any of the above and would have kept crashing the script at random
afterward otherwise.

## Fixed: ESLint unused-variable error

`tools/verify/checkNoBodyCollision.mjs:77` — `beforeWallPY` was captured but
the wall-block sanity check below it only ever tested X-axis movement
(`hub.tryMove(-100000, 0)`), so the Y value was genuinely dead. Deleted the
line. `npm run lint` is clean again; re-ran the script live afterward,
still passes.

## Not a bug: the priced-verb calendar "accent"

This was the headline finding from Phase 1 — `checkCalendarClock.mjs` had
measured Share a Drink's day-cost at `0.0000556` against an expected `0.25`.
Traced the whole path before touching anything: `VERB_DAY_COST`,
`applyVerbDayCost`, the chat dispatcher's room gate, `shareADrink`'s handler,
`logVerbAndCharge` — all correct on inspection, no bug found in any of them.

Ran the actual script live against the current code, twice: **both times it
measured the accent at `~0.250`, dead on expected, and printed "ALL CHECKS
PASSED."** This doesn't reproduce. Best explanation is Phase 1 hitting a
timing race in this sandbox's own slow headless rendering (documented
elsewhere as running the game at roughly 10-15fps) — the same category of
flakiness `sayInChat`'s retry-loop fix above exists to guard against,
just caught in a different script that already happened to have the loop.
Nothing in the game changed here and nothing needed to. Flagging this
explicitly rather than quietly closing it, since "the number was wrong once
and now it isn't" deserves the honest version of that story, not a silent
drop.

## Left alone, on purpose: the action-bar 6-vs-7 slot mismatch

`checkActionBarPaging.mjs`'s hardcoded expectation is a 6-verb heaviest kit;
live count is 7 now that Beacon Control (shipped 4 Sep) applies to the same
loadout the test fixture uses. This is a content/balance call, not a code
bug — either the 7-verb kit is intended and the test's expectation needs
updating, or Beacon shouldn't be on that kit by default and it's a real
content bug. Didn't touch it. **Maxime's call which one it is** — same as
the Gap Log already said.

## What else is still open

Everything else in the Gap Log is unchanged by this pass: the
`checkDockCameraSplit.mjs` instructions-overlap finding, all four doc-drift
items (Master Index staleness above all), and `genSave.ts`'s stale
lance-recruitment assumption. None of those were "the bug" this pass was
scoped to. See the Gap Log itself for the full list.

## Files touched

- `tools/verify/checkNoBodyCollision.mjs` — dead variable removed.
- `tools/verify/checkDebriefAndMinigameGate.mjs` — panel dismissal added,
  minigame-leak detector tightened, `sayInChat` hardened.

No game source under `src/` changed. `npm run typecheck`, `npm run lint`,
and `npm test` (2298/2298) all clean after these edits. Both files committed
back to the device.
