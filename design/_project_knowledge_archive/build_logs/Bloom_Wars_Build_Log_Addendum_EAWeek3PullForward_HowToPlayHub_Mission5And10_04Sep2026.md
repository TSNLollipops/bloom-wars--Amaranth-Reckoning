# Build Log Addendum — EA Plan Week 3 Pull-Forward: HOW_TO_PLAY Hub Section + Mission 5/10 Re-Diagnosis, 4 Sep 2026

**Context.** Move It (verb) and its tests/lint shipped earlier today. Asked what to do next, Maxime: "Push the EA plan forward... There's supposed to be many small plans I did yesterday or the day before, if there's none, push the EA plan." Scanned the Project docs and the device `design/` folder for any 2-3 Sep plan that shipped code but never got marked done — found nothing outstanding (Vault's remaining 23/28 Heirloom abilities is an open backlog item, not a dropped plan; the Undertow ambush-hold flag is fully built, verified, and deliberately shipped OFF pending Maxime's own call on the balance fallout — neither is "unbuilt work," so neither triggered this addendum on its own).

With nothing to pick up there, moved to `Bloom_Wars_EA_Launch_Plan_31Aug2026.md`. Week 2 ("Build the Vault") shipped early, 2-3 Sep — so this pass pulled two of Week 3's three items forward instead of waiting for the 14th: the HOW_TO_PLAY.html Hub section, and balance triage on the two items the plan itself names as open ("Mission 10's low win rate (undiagnosed), Mission 5's tight turn limit"). Hub.ts test coverage (Week 3's third item, already flagged "stretch" in the plan) was not attempted this pass — 525 KB source file, lower priority than the other two, picked back up only if there's room after this.

## Part 1 — Mission 5 and Mission 10, re-diagnosed

Both of these have been open items since late August, carried forward across multiple addenda without ever getting a real second look. Reran them fresh instead of trusting the old notes, per this project's own "verify against the actual current file, not memory or an older plan" discipline — and there was a good reason to suspect the old numbers were stale: the Player AI difficulty-tier system (predictive threat map, front-line/commander protection) shipped 1-2 Sep, after both of these were originally flagged. That's exactly the kind of change that quietly fixes an old balance complaint without anyone going back to check.

Ran `npm run sim:batch -- 200 mission_amaranth_5 mission_amaranth_10 --all-tiers` (n=200 per mission per tier):

```
mission_amaranth_5         easy     WIN=148/200 ( 74%)  LOSS=  3  CMD_DOWN= 49  TIMEOUT=  0  turns/win=  9.7  downed/run=1.68  lost/run=1.38
mission_amaranth_5         moderate WIN= 93/200 ( 47%)  LOSS=  0  CMD_DOWN=107  TIMEOUT=  0  turns/win=  6.6  downed/run=0.93  lost/run=0.60
mission_amaranth_5         hard     WIN=198/200 ( 99%)  LOSS=  0  CMD_DOWN=  2  TIMEOUT=  0  turns/win=  7.5  downed/run=0.58  lost/run=0.00
mission_amaranth_10        easy     WIN=124/200 ( 62%)  LOSS=  0  CMD_DOWN= 76  TIMEOUT=  0  turns/win=  4.0  downed/run=0.79  lost/run=0.79
mission_amaranth_10        moderate WIN=200/200 (100%)  LOSS=  0  CMD_DOWN=  0  TIMEOUT=  0  turns/win=  6.0  downed/run=0.00  lost/run=0.00
mission_amaranth_10        hard     WIN=200/200 (100%)  LOSS=  0  CMD_DOWN=  0  TIMEOUT=  0  turns/win=  5.0  downed/run=0.00  lost/run=0.00

AGGREGATE easy     272/400 ( 68%) across 2 mission(s)  downed/run=1.23  lost/run=1.08
AGGREGATE moderate 293/400 ( 73%) across 2 mission(s)  downed/run=0.46  lost/run=0.30
AGGREGATE hard     398/400 (100%) across 2 mission(s)  downed/run=0.29  lost/run=0.00
```

**Mission 10 ("The Amaranth Betrayal," 14-turn extract, `pilot_iyari`):** the old "undiagnosed low win rate" flag doesn't hold up against the current AI. Hard tier clears it 200/200, moderate clears it 200/200, and even easy tier — which is supposed to lose sometimes — wins 62% with a mean win in 5 turns, well inside the 14-turn cap. This reads as a mission the pre-tiers test AI (the flat, non-predictive AI that was standard before 1-2 Sep) was losing to for reasons that no longer apply — most likely the predictive threat map keeping units out of the crawlmass/splitfang alpha strike that used to chip the squad down early. Calling this resolved, not a code fix — the fix already happened, in a different system, for a different reason, and nobody went back to close the loop on this specific flag until now.

**Mission 5 ("Foraging Party," 14-turn extract, `pilot_anand`, rescue-and-recruit bonus):** same story on the turn-limit complaint specifically — hard tier wins in a mean 7.5 turns, half the cap, with zero permanent losses across 200 runs. The turn limit is not actually tight for a competent AI. Calling that part resolved too.

**But this pass turned up something the old flag never mentioned, and I'm not going to smooth it over: Mission 5's moderate tier (47%) loses more than its own easy tier (74%).** That's backwards. Mission 10 shows the difficulty curve you'd expect — easy 62% < moderate 100% = hard 100%. Mission 5 does not: easy 74% > moderate 47% < hard 99%, a dip in the middle. `CMD_DOWN=107` on moderate is the highest commander-down count in either table, more than double easy's 49 on the same mission. Something about how the moderate profile plays this specific map/enemy-wave combination is worse than both its neighbors, and I don't know what yet — didn't chase it, because that's a real investigation (probably means reading `profile.ts`/`hard.ts` to see what moderate does differently on a 2-wave crawlmass/splitfang opener, maybe map-specific), not something to guess at and patch blind. Flagging it here as a genuine open finding rather than either hiding it or half-fixing it under time pressure.

**Your call, not mine:** ship as-is (moderate difficulty being harder than easy on one specific mission is a real balance oddity, but it's not broken in the sense of unwinnable or exploitable), or add "diagnose Mission 5's moderate-tier dip" as its own small ticket before EA. I'd lean toward logging it and moving on — it's one mission out of 36, on a tier most players won't specifically compare against easy — but you're the one who'll feel it if a playtester picks moderate and bounces off Mission 5 specifically.

## Part 2 — HOW_TO_PLAY.html, Section 10: The Hub

The existing doc (dated 22 Aug 2026) only ever covered the original 4-mission Amaranth Act I vertical slice — controls, board, terrain, health, the class triangle, abilities, objectives, roster, missions (Sections 01-09). It predates the Hub entirely. Added a new Section 10 ("The Hub") without touching 01-09 — a full rewrite of the older sections wasn't in scope for this pass and would have been a much bigger, riskier edit for a doc that's mostly still accurate on fundamentals (board, terrain, triangle, abilities haven't changed).

Section 10 covers: movement and controls (WASD, E to interact, T to type, H for history, L for highlights, the muster-hold behavior at BAY); a deck-by-deck room table (Lower: Rec Room, Hangar Deck, three Berths, Heads; Grotto: The Grotto, three Workshops, Engineering; Upper: Vault, CIC, Forward Bays; Spar Room); a "talking to the crew" section with the actual typed-phrase-to-verb table pulled straight from `chatIntent.ts`'s keyword lists (so it matches what the game really recognizes, not a paraphrase); and three short cards on the CO check-in gate, the Vault, and the Rec Room standings board. Sourced from `Hub.ts`'s own `ROOM_NOTES` block and legend text, `verbs.ts`, and `chatIntent.ts` — not written from memory of what the Hub does.

Also flagged the doc's own staleness honestly in the masthead rather than letting it pass as fully current: added a line stating plainly that Sections 01-09 haven't been re-checked against the current 36-mission build, and that a fuller pass is owed but wasn't done here. Better to say that out loud than have the doc quietly imply it's all equally current when only Section 10 actually is.

**Verification on this file specifically:** ran a full HTML tag-balance check (Python's `html.parser`, walking the open/close stack) — zero errors, nothing unclosed. Grepped the whole `src/` tree for any code that references `HOW_TO_PLAY.html`: one hit, a comment in `main.ts` noting the tutorial has no in-game link to it yet — no actual code depends on this file's structure, anchors, or content, so there's no "neighbor" in the codebase this edit could have broken.

**Deliberately did not re-run the full `tsc`/`eslint`/`vitest`/`vite build` suite for this change.** No `.ts` file was touched — the only change is a standalone static HTML doc that nothing in the module graph imports or depends on, confirmed by the grep above. Running the full test suite (87 files, ~2020 tests) would mean staging dozens of files across the codebase into the cloud sandbox to re-verify code that is, by construction, unchanged since this morning's clean run (Morning Report, 4 Sep: all 14 live Playwright scripts pass, 87/2020 tests pass). That's a real cost/benefit call, made openly rather than silently: if you'd rather I run the full suite anyway as a blanket sanity check regardless of what changed, say so and I will.

## What's still open after this pass

- Mission 5's moderate-tier dip (47% vs. 74% easy) — logged above, not investigated further. Your call on whether it gets its own ticket.
- HOW_TO_PLAY.html Sections 01-09 are still dated to the 4-mission slice and haven't been checked against the current 36-mission build. Flagged in the doc itself; a real pass is still owed.
- Hub.ts test coverage (Week 3's "stretch" item) — not attempted this pass.

## Files changed

- `HOW_TO_PLAY.html` — added Section 10 (The Hub); masthead staleness flag. Committed to the device.
