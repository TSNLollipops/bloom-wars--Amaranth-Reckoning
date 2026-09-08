# Morning report — the unattended overnight pass, 28 Aug 2026

You said "going to sleep... do a large bunch of stuff... u dont need me" and to have fun with it. Here's what actually happened, in the order it happened.

## The short version

Five things landed. The Player AI test harness had a real gap — it had no logic protecting your commander or your Munti from ordinary combat risk, which was making two missions look unbeatable when they probably weren't. That's fixed, verified, and already on your machine. Along the way I caught two stale numbers sitting in the build-log docs and fixed both. I went back and double-checked whether the three still-outstanding `.docx` edits (GDD, Data Pack) could finally get closed now that I have real access to your machine — they can't, for a genuine reason I checked twice rather than assumed, but I closed the one adjacent thing that actually was reachable. And I built and shipped the Rec Room help panel we'd talked about earlier in the day — all three minigames now have a persistent `[ ? ]` rules button.

Nothing that needed your own call got touched. The Wellroot boss fight's `attackPower` is still 60, unchanged, even though tonight turned up evidence that makes the case for cutting it stronger. Nothing in the three blocked `.docx` files got force-edited around. I'll flag both clearly below.

## 1. The commander-protection fix

Two missions — 8 ("The Choir Sings") and 12 ("The Fallow Line") — had been batch-testing at a flat, suspicious 0%, every single run ending the same way: your commander (Rourke) dying and the mission ending outright. I checked the actual test AI code instead of assuming it was a balance problem, and found the real cause: `sim/playerAi` — the automated player that runs these batch tests — had zero logic anywhere treating Rourke's death, or your Munti's, as more costly than any other unit's. She'd scout ahead alone on her faster move stat and get surrounded, or sit in melee taking repeated focus fire, with nothing pulling her back.

Fixed it two ways: she (and your Munti) now won't move further into a fight than your most-exposed other unit already is, and she retreats at a higher HP threshold than everyone else (50% instead of the normal 30%). Both only apply to her and the Munti — nobody else's behavior changed.

One real mistake I caught before it shipped: my first version applied this new caution everywhere, including missions where you're supposed to escort someone *out* of danger (`extract_unit` objectives). Mission 11 has a genuinely tight turn limit, and the extra caution cost just enough wasted movement to tank it from 97% down to as low as 20%. Fixed by exempting that whole objective type — the caution only makes sense when standing your ground is the right call, not when the clock is the enemy.

Re-ran a diagnostic sweep after the fix (informational only, not the rigorous `combat_sim.py`-grade validation — just enough to sanity-check the direction): several missions improved a lot (Mission 1 went 5%→40%, Mission 9 90%→100%, Mission 14 37%→100%, Mission 30 43%→80%), the extract missions held steady as intended, and Missions 3/5's pre-existing 0% didn't change (not new, not caused by this). Missions 8 and 12 themselves are still hard even with the fix — 0% and 5% — but now for a real, understood reason: several enemies can burst 60+ damage onto one target in a single turn, faster than "retreat once you're hurt" can react to. Actually solving that needs the AI to predict incoming danger before it lands, not just react to it — a bigger piece of work I didn't attempt tonight.

This is test-only code — none of it touches the actual game you or anyone else plays. But it does mean most of this campaign's previously-recorded win-rate numbers were measured against a less careful test player than exists now, and are worth re-checking properly at some point (flagged, not done tonight).

**A genuinely useful side effect:** the same diagnostic sweep happened to include Mission 21 — the Wellroot boss fight that's been sitting on your list waiting for a sign-off on cutting `attackPower` from 60 to 20. It went from a rock-solid 0/70 across three separate batches to roughly 25-45%, without me touching `attackPower` at all. That's new evidence the fight was partly failing for the same reason Missions 8/12 were — not proof the number doesn't also need cutting, but real information for whenever you want to make that call.

## 2. Two stale numbers fixed in the build-log docs

Small, but worth knowing about since they'd have misled anyone reading those files. Mission 35's write-up still said 55% — that was measured against a 12-pilot squad before your roster grew to 15 pilots a couple days ago, and nobody had gone back and updated the number since. The real current figure (from the weapon-branch balance check's proper N=100 pass) is 72%. I also caught and flagged an "88%" that had circulated the same day as a casual mid-conversation number — that wasn't the rigorous result either, just an earlier partial check.

Mission 36 ("Until Relief," your campaign finale) has a real, still-unsolved problem: its win rate genuinely won't hold still. Four separate large-sample batches of the exact same code gave 29%, 40%, 51%, and 73% — way more spread than random chance should produce. I re-ran it three more times tonight against both the old and new code and got 68%, 63%, 65% — same wide spread, ruling out both weapon branches and tonight's commander fix as the cause, without finding the actual one. Gave it its own dedicated write-up so it doesn't stay buried in a footnote. It needs a proper seeded-harness investigation to actually run down — didn't attempt that tonight, it's real work in its own right.

## 3. The `.docx` edits — checked again, still genuinely blocked

Two of the four `.docx` design documents (the GDD and Data Pack) have had edits waiting on them for a couple days — a weapon-branch cost row in both, and a movement-type row in the GDD's sprite-encoding table. Every session so far has said "can't touch the raw file," but tonight's session actually has real access to your machine for the first time, so I went and checked properly instead of repeating the old note on faith.

It's still blocked, for a real reason: your GDD, Data Pack, Build Brief, and Canon Pass only exist as uploads inside the Claude project — never as actual files sitting in your repo folder. The tool I have for reading project docs only ever gives me the extracted text of a `.docx`, never the real file bytes, so there's nothing for me to edit even with your computer connected. I also considered rebuilding a fresh `.docx` from that extracted text using a Python library — decided against it, because a rebuild would lose all your original formatting (styling, tables, callout boxes) with no way to check what got dropped, since I've never seen the real bytes to compare against. That felt like exactly the kind of corner-cutting your project's own rules ask me to flag rather than just do.

One adjacent thing I *could* actually close: the Canon Pass has a plain-text twin doc in the project (separate from the real `.docx` I can't touch), used specifically so future sessions have something editable. Checked your actual game code and found the Choir, Wellroot, and Unnamed all already have real, finished color palettes — they'd just never been written up in that doc. Added them. So the GDD and Data Pack edits are still sitting there waiting for you to either paste the text in yourself or for a session that has the real files to work with — I wrote up exactly where that ready-to-paste text lives so nobody has to re-discover any of this from scratch.

## 4. The Rec Room help panel — shipped

The plan we talked about earlier in the day: all three minigames (the peg board, Poker, and darts) now have a `[ ? ]` button in the corner that opens a rules panel, any time, every session — not a one-time tooltip. All three share the same panel-builder code, so a future minigame gets one for free. Escape closes the help panel first and the game second if you press it twice, and I made sure the panel itself blocks clicks from falling through to the buttons underneath it — worth mentioning because that's an easy thing to get subtly wrong with overlapping game UI.

Caught one real cosmetic bug via an actual screenshot: the peg board's rules text (the longest of the three, since it has to explain both "Reach" and "Knot") ran a little close to the "back to the game" hint line. Tightened the text size slightly and confirmed it's clean now.

Tested this one for real, not just by reading the code — a live browser pass actually clicked the buttons and pressed the actual keys, confirmed everything opens, closes, and reopens correctly, and confirmed no errors showed up anywhere. Full test suite, type-checker, linter, and build all clean too.

## Decisions I made without you

Gathered in one place rather than scattered above:

- Exempted `extract_unit` missions entirely from the new commander-caution logic, after the narrower first attempt (protect only the named extract target) still wasn't enough to save Mission 11.
- Decided not to rebuild the GDD/Data Pack `.docx` files from extracted text via Python — real formatting-loss risk, no way to verify against bytes I've never seen.
- Used the Canon Pass's plain-text twin to close the one closable piece of that same problem (the missing Choir/Wellroot/Unnamed palette write-up) rather than leaving it bundled with the two genuinely blocked edits.
- Left `bloom_wellroot.attackPower` at 60, even with new evidence pointing toward the already-proposed cut to 20 — still your number to set.
- Didn't touch Mission 36's instability beyond documenting it — a real fix needs a seeded harness and dedicated time, not a guess bolted on at 2am.

None of these are irreversible.

## What's still sitting there, waiting on you

- **The Wellroot fight's `attackPower`** — 60 vs. the validated candidate of 20. Tonight's new evidence (the 0/70→25-45% shift from the commander fix alone) makes a stronger case the number should move, but it's still your call on how the fight should feel, not just its win rate.
- **Three `.docx` edits** — the weapon-branch cost row in the GDD and Data Pack, and the movement-type row in the GDD's sprite table. The text is ready to paste; genuinely nobody but you (or a session with the real files) can apply it right now.
- **Mission 36's instability** — real, unexplained, needs its own seeded investigation.
- **A proper full-campaign re-validation** — most of this campaign's win-rate numbers were measured against a less capable test AI than exists as of tonight. Worth a real pass at some point, larger sample sizes, seeded for reproducibility. Not urgent, but the old numbers shouldn't be trusted blindly anymore.

## Where everything is

Everything above that's actual game code (`sim/playerAi/combat.ts`, `sim/playerAi/index.ts`, `scenes/Hub.ts`) is already on your machine — I double-checked this morning by pulling the live files back down and confirming the changes are really there, not just something I believe I sent. The doc updates (Master Index, the build-log fixes, the docx-status doc, the Canon Pass addendum, the Help Panel plan's own build-status writeup) are all in the project, not just this conversation.

No pressure on any of it — that's just the honest state of things this morning.
