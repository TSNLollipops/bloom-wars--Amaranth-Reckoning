# Build Log Addendum — Calendar Economy (real-time clock), 2 September 2026

**Status: built, tested, live-verified, committed to Maxime's device.** The authoritative design record is `claude/Bloom_Wars_Calendar_Economy_Build_Proposal_v2_RealTimeClock.md`; this is what actually shipped against it.

## 0. How this started, and the one decision that shaped everything

Maxime chose this over the EA Launch Plan's scheduled Week 2 item (the Vault), and over that plan's explicit recommendation to *defer* the calendar rather than build it. A deliberate override, recorded as such.

A first proposal (v1) followed the locked docs and proposed discrete per-action pricing. Maxime rejected the model outright and replaced it, verbatim:

> "time spent in the hub and time spent on mission run on the same ckock. depend on time player spend in each. like a inevitable day night cycle in wow. the calandar run when you play. no matter what you do. some event take some times some less. your call on it. byt this is my vision."

Plus two answers to specific forks: tier spread **"narrow the gap"**, and system-triggered events (Blowup/Breakdown/Spar) confirmed as **never** charging calendar time. The numbers were explicitly delegated ("your call on it").

## 1. The numbers, all placeholders

| Thing | Value | Note |
| --- | --- | --- |
| Base rate | **1 day per 6 real minutes** (`MS_PER_CALENDAR_DAY = 360_000`) | ~10 days/hour; a 30-hour campaign lands near Day 300, putting the locked doc's own "Day 212 — The Reckoning" example in late campaign |
| Mission completion | **+2 days flat** | On top of real battle time already ticked — the transit/prep/return never played on screen |
| Conversation (`talk`, `gift`, `praise`, `insult`, `apology`, `congratulate`, `sendOff`) | **0** | The running clock already covers it |
| System events (`angerBlowup`, `breakdown`, `spar`) | **0** | Never a player choice — Maxime's own call |
| `shareADrink`, `pegBoard`, `fletchers` | **+0.25 day** | Short sit-down activity |
| `poker`, `askOut` | **+0.5 day** | Preserves Walkable Hub §4's locked Rec Room < romance ordering |

Every one of these is a first guess, flagged the same way the Antfarm bay costs and the Insult-ladder tiers were. There is no `combat_sim.py`-equivalent for pacing numbers, so they want playtesting, not a script. All of them live in one file (`engine/calendarClock.ts`) specifically so tuning never means hunting through scenes.

Worth stating plainly, since the table invites the wrong reading: the accents are **not a duration model**. A poker session already ticks ~1.7 days of real clock while it's played. The +0.5 is a thumb on the scale marking "that was a real activity," nothing more.

## 2. The real finding — what live browser testing caught that 1,388 unit tests did not

The first live run measured the Hub crediting **~41% of real elapsed time** on ordinary frames, while crediting **~100%** with the chat box open. Every unit test passed throughout, and would have kept passing.

Cause: **Phaser's `update` delta is smoothed and clamped.** On a heavy frame it reports less time than actually passed. With the chat box open, `Hub.update` returns early, frames are cheap, and the delta is honest — which is exactly why the discrepancy between the two windows is what exposed it. Unit tests could never have found this: they all feed `tickCalendar` a delta by hand, so they test the arithmetic and nothing about where the number comes from.

Why it mattered rather than being a rounding curiosity: it would have shipped a calendar running at a speed set by the player's frame rate — meaningfully fewer days on a weak laptop than a fast desktop, for the same hours played. That is the direct opposite of the "inevitable clock" Maxime asked for.

Fix: measure wall-clock directly (`measureRealDelta`, diffing `Date.now()` between frames) instead of trusting Phaser's delta, still stall-guarded by `MAX_TICK_DELTA_MS`. Re-verified at ratio **1.00**. Four unit tests were added to pin the fixed behavior, including the specific regression (a 122ms frame must credit 122ms, not a smoothed ~16ms).

This is the second real defect the live-browser harness has caught before shipping, after the `extractNamedTarget` rank-token bug the day before.

## 3. Architecture

**`src/engine/calendarClock.ts`** (new) — every calendar number and every operation. `tickCalendar` / `measureRealDelta` / `accrueRealMs` / `creditRealMs` / `applyVerbDayCost` / `applyMissionCompletionDayCost` / `currentDay` / `formatDayLabel`.

**`CampaignState.calendarDay`** — a **float**, deliberately. The fractional accumulation *is* the mechanism (a 16ms frame is ~0.00004 days), so an integer field would round every tick to zero and the clock would never move. Optional for save compatibility, with `backfillCalendarDay` healing old saves to Day 1 — and guarding NaN/negative, because this value is arithmetic-accumulated every frame and a single corrupt write would otherwise poison it permanently.

Old saves backfill to Day 1 rather than to a reconstructed estimate. A pre-calendar save recorded no Hub or Battle time anywhere, so there is genuinely nothing to reconstruct from; inventing a plausible number would fabricate campaign history that reads authoritative and isn't.

**Hub** ticks per frame, placed *above* every overlay early-return so the clock keeps running behind the chat box and every minigame — directly serving "no matter what you do." Ticks only in **Hub and Battle**, the two contexts Maxime named. MapSelect, Debrief, the shop and menus deliberately don't: that's UI time, not world time, and burning days while someone reads a shop list charges them for deliberating.

**Battle** holds no live `CampaignState` (it loads/saves around events), so a per-frame tick there would mean a localStorage round trip 60 times a second. It accumulates into a field and flushes once on `SHUTDOWN` — on shutdown rather than on the Debrief handoff, because `scene.start("Debrief")` is only one of the ways out of a battle, and quitting to the menu shouldn't silently discard a whole session's play time.

**One central charge point.** All 13 `npc.socialLog.push(...)` sites in Hub now route through `logVerbAndCharge`, which logs *and* charges. Only 6 of those cost anything today, so charging at each site would leave the next person adding a verb with an invisible obligation to notice. Routing the log write means a new verb is charged by construction — and since `VERB_DAY_COST` is a full `Record<VerbId, number>`, adding a `VerbId` without pricing it is already a compile error.

**UI.** A live `Day N` readout in the Hub's top HUD row (right-aligned at x=700, clear of the rank line at x=16 and THREAT at x=818), repainted only on an actual day rollover rather than every frame. A `Day 47 → Day 52` transition stamp in the Debrief header — the span, not just the destination, because the span is what says what the sortie cost.

## 4. Verification

- `npx tsc --noEmit` clean; `npx eslint src/` clean.
- **1,388 unit tests pass** across 65 files (25 of them new, in `calendarClock.test.ts`).
- `tools/verify/checkCalendarClock.mjs` (new, documented in the harness README) — live headless-Chromium run against the real dev server and a seeded midgame save. All checks pass: clock rate ratio 1.00, clock still running with chat open (ratio 1.02), free verb charging 0.0003 days (i.e. nothing beyond ambient time), Share a Drink charging 0.2501 against an expected 0.25, HUD reading "Day 1" at (700, 20), and `calendarDay` surviving the real save path. Zero page errors.

The tests themselves needed a fix worth recording: the first draft fast-forwarded a day with one 360,000ms `tickCalendar` call, which the stall guard correctly rejected as a frozen loop. Five tests failed looking like a clock bug and were actually the guard working. They now accumulate in real frame-sized steps, which is both correct and a better description of what the game does.

## 5. Honestly still open

- **Every number is unplaytested.** The base rate especially — 6 minutes/day is a reasoned guess, not a measured one, and it is the single most consequential dial in the system.
- **The idle case.** A player who leaves the tab focused and walks away burns days. Harmless while the calendar is cosmetic; it is the first thing that needs rethinking if teeth are ever added, and that is now recorded in both the proposal and the corrected v1 doc.
- **Named landmarks** ("Day 47 — Muster") are still unwritten. Deciding which days earn a name is a writing task, not a mechanical one.
- **Final-day display at the campaign finale** is not built — the proposal's minimal end-of-campaign shareable stat. Small, and worth doing when the finale screen next gets touched.
- **No live test of the Debrief flat cost.** The arithmetic is unit-tested (`applyMissionCompletionDayCost`), but flying a real mission end-to-end in the harness wasn't done this pass. Stating it rather than letting "live-verified" imply more coverage than it has.

## 6. Docs corrected this pass

- `claude/Bloom_Wars_Calendar_System_v1.md` — its §1 specified advancement "independent of real play speed," now exactly backwards. Corrected in place with a status box, struck text kept visible, and each surviving section marked. A second, subtler drift was caught in the same pass: that doc's two-clocks argument rested on "the calendar has no resolution finer than a whole mission," which the new model makes false. The *conclusion* (Worries keeps its native clock) survives; the reasoning was replaced.
- `claude/Bloom_Wars_Walkable_Hub_Build_Plan_v1.md` §4's itemized-pricing lock is **partially** superseded — the ordering it locked is still implemented and still doing real work, but as an accent layer rather than the mechanism. Flagged here and in the v2 proposal; that doc has not been edited in place this pass.

## 7. Files

New: `src/engine/calendarClock.ts`, `src/engine/__tests__/calendarClock.test.ts`, `tools/verify/checkCalendarClock.mjs`.
Modified: `src/engine/campaignState.ts`, `src/scenes/Hub.ts`, `src/scenes/Battle.ts`, `src/scenes/Debrief.ts`, `tools/verify/README.md`.

## 8. Naming-lock safety check

No proper nouns invented. Nothing here approaches the reserved book-series terms.
