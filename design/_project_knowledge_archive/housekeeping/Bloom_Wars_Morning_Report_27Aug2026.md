# Morning report — the unattended stretch, 27 Aug 2026

You said "go ham, plus ultra" and to read about it in a doc this morning. Here's what actually happened, in the order it happened, written for someone who wants the real story rather than just a list of checkmarks.

## The short version

You asked for two things: add "Hello, Sir" (NPCs deferring to your rising military rank) to the wishlist, then keep working the Hub as far as I reasonably could without you. Both happened. Along the way I found and fixed a real bug that had been sitting in the code since the rank system was designed — your character's rank was never actually being tracked, despite the code comments saying it should be. Then I built four more items off the backlog list I'd written up the day before, picking the ones small enough to build solo and responsibly, and left the bigger ones (the ones that really want your own taste) alone on purpose. Everything is tested, everything is already synced to your machine — pull up the game and it's all there waiting.

One heads-up before the details: there's one pre-existing flaky test (`commanderDown.test.ts`) that shows up as 1-2 failures depending on the run. It's not new, it's not from anything I touched, and it's already on your known-issues list — I just re-confirmed it a few more times along the way. More on that below.

## The bug nobody asked me to find

Before writing a single line of "Hello, Sir" content, I went looking for the right thing for NPCs to defer to. Your character Rourke has a real military rank that's supposed to climb over the campaign — 2nd Lieutenant, then Captain after Mission 12, then Major after Mission 24. Three different design docs all describe this, and all three say "this is designed on paper, nothing here is built yet."

I checked the actual code instead of trusting that note, and found something worse than "not built": it was *half*-built. There's a real field for the rank in the save data. It gets read every mission to calculate a pay bonus. But nothing, anywhere in the code, ever actually changed it. The two functions that are supposed to promote you when you clear Mission 12 and Mission 24 already had comments saying "this is where Rourke gets promoted to Captain" — sitting right next to code that never did that. It was designed twice over (once in the docs, once in the code's own comments) and silently never wired up.

I fixed it properly: those two functions now actually set the rank when they fire. And because some of you (well, hypothetically — this only matters if you'd already played past Mission 12 or 24 before this fix) might already have a save file where the roster moved on but the rank number never did, I also built a self-healing check that runs every time the game loads a save. It looks at who's actually in your roster and derives what your rank *should* be, and quietly corrects it if it's wrong. No save-file reset needed, no version bump — it just fixes itself the next time you open the game.

## "Hello, Sir" — and why it doesn't say "sir"

With the rank actually working, I built the greeting: the first time you talk to an NPC after a real promotion, they say something deferential and then never repeat it — same pattern as the "graduation" moment we already built for gear-tier promotions (Green → Blooded → Command).

One thing I changed on purpose, without being able to ask you first: Rourke is established as female throughout the campaign doc ("she" throughout), so a literal "Hello, Sir" would misgender her. I used her rank title instead — "Captain," "Major" — same deference, same moment, just the one word swapped for one that fits. There's now a test that locks this in, so it can't quietly slip back to "sir" later.

I also made a scope call here worth flagging: I built this as a one-time moment, not a standing thing NPCs say every so often. A repeating version would need its own cooldown and enough content that it doesn't go stale from repetition — that's a real new system, not "finishing what we got," so I wrote it up as an open question on the roadmap doc instead of guessing which way you'd want it.

## The four backlog items I picked to build next

The day before, I'd written up an 11-item wishlist doc for the Hub's social sim — things that would be cool, not authorized to build yet. Rather than try to build all 11 to the same standard in one go (which I judged as unrealistic — either the quality drops or I quietly cut corners), I picked the four I'd already tagged as small enough to build solo and left the bigger ones (the ones that really want your own taste on pacing and tone) for whenever we sit down together. Here's what actually shipped:

**1. Catalyst-specific content for both one-time reveals.** The Stage-promotion moment and the rank greeting above both originally used generic, catalyst-neutral lines — the same six lines regardless of whether the NPC was a Wolf, a Shark, a Raven, etc. I rewrote both so each of the nine catalysts has its own flavor for both transitions. I kept it to 2 lines per catalyst per moment rather than writing a full new bank (which would've meant over a hundred new lines for something that fires once per pilot, ever) — enough that two pilots of the same catalyst getting promoted don't necessarily hear the identical line, without over-investing in a moment nobody replays.

**2. A rank/Stage readout you can actually see, not just hear once.** Up to this point, both the graduation reveal and the rank greeting were spoken lines that happen once and vanish — if you missed the bubble, there was no other way to know a promotion happened. Now there's a small `[Green]` / `[Blooded]` / `[Command]` tag next to every NPC's name when you're close to them (same style as the "♥ with you" relationship tag we already had), and a small persistent readout in the Hub's own top-left corner showing your current rank and name — "Capt. Dessa Rourke," updating live as you're promoted, mirroring the threat readout that's already in the top-right corner.

**3. Veterans trust their gut more; rookies overthink more.** This is a small, mostly invisible tuning change to the "sub-animal" system (the one where each pilot has a primary personality plus two backup personalities that occasionally answer instead). Previously every pilot used the same odds regardless of rank. Now a Command-stage veteran leans more instinct-driven, a Green rookie leans more toward the deliberate/overthinking voice, and the impulsive third voice stays flat across all of them — impulsiveness doesn't get fixed by seniority. It's a texture thing, not something you'll consciously notice, but it should make veterans and rookies subtly read differently in conversation.

**4. A "Highlights" view for each pilot.** You can already ask an NPC for their interaction "history" and get a raw chronological list of everything you two have done. I added a second, different view: ask for "highlights" (or "milestones," or "memories") and instead of the raw list, you get a curated recap — the first time you shared a drink with them, the first time you played the peg board together, the first time you asked them out, each with a real date — plus a separate "Currently" section showing their relationship status and career Stage right now, explicitly marked as not-dated (a status, not a moment).

That last one comes with an honest caveat I want to flag directly, because the original wishlist item promised more than the save data can actually deliver. I'd originally pitched this as covering things like "the first time you talked," "the moment they got promoted," "when a couple formed," or "a bad fight." I checked each of those against the actual game data before building anything, and none of the four are real, dated facts in the save file today: casual "Talk" (the E-key ambient chat) was never being logged at all; promotions only ever remember the *last* value seen, not *when* it changed; NPC-to-NPC couples have no timestamp anywhere; and there's no "fight" system at all yet. So what shipped is narrower but honest — dated milestones for the deliberate interactions that genuinely are logged with a timestamp (drinks, games, asking someone out), plus an explicitly undated status line for everything else. If you want the fuller version later, each of those four gaps is its own small, separate fix (log Talk properly, timestamp promotions, timestamp NPC-NPC pairings) — none of them got touched this pass.

## Decisions I made without you — the full list

Since you weren't there to ask, here's every judgment call, gathered in one place rather than scattered through the sections above:

- Used "Captain"/"Major" instead of the literal word "sir," since Rourke is female. (Covered above.)
- Built the rank greeting and the earlier graduation reveal as one-time moments, not repeating ambient chatter — a repeating version is new scope, not "finishing what we got."
- Picked which 4 of the 11 roadmap items to build (the ones I'd tagged Small/Small-to-medium: catalyst-specific content, the visible rank/Stage readout, stage-weighted sub-animal confidence, the Highlights reel) and deliberately left the bigger four (a system connecting Stage/relationships/worry into a shared "hot topics" feed, relationship stages beyond a flat yes/no, surfacing rivalries the way friendships are already surfaced, and reacting to how the last mission actually went) for an interactive session, since those genuinely benefit from your own taste rather than just implementation time.
- Narrowed the Highlights reel's scope once the data check showed four of its five original example milestones weren't real, dateable facts yet. (Covered above.)
- Wrote 2 lines per catalyst per moment for the new content rather than a full writing pass, given how rarely each line actually gets heard.
- Fixed the rourkeRank bug as part of "Hello, Sir" rather than treating it as a separate, bigger ask — it was the one piece of "finishing what we got" that made the feature make sense at all.

None of these are irreversible — if any read wrong to you, they're all easy to revisit.

## What's still sitting on the shelf

From the same roadmap doc, these are real ideas, still just proposals, untouched this pass:

A "hot topics" system that would let the crew react to each other's recent news (a promotion, a new couple, someone being worried about) instead of every conversation running independently — this is the one I'd personally front-load if you want to tackle the list next, since a couple of the others become nearly free once it exists. Sub-animal personalities occasionally coloring ordinary idle chatter, not just typed-chat replies. Relationship stages with real texture instead of a flat yes/no. Surfacing rivalries and friction the way friendships already get a "♥ with X" tag. Mission Worry (the "crew worries about someone still out on a mission" feature) scaling by how close they actually are, and ramping instead of snapping on all at once. Ambient dialogue reacting to how the last mission actually went. Two catalysts with clashing values both reacting to the same word in chat, producing a visible disagreement.

Also still untouched, from further back: the older, unrelated Stress/Morale trigger proposal and the chat-keyword-categories plan (both zero-code design docs waiting on you), the template-slot system that would make 36 already-written line variants actually usable, and the cheap "drop a nearby NPC's name into existing solo lines" idea that first got this whole banter conversation going.

## How I checked all of this actually works

Every piece above has real automated tests behind it — 15 new ones this stretch (9 for the Highlights logic, 6 for the new chat keywords), on top of 20 more from the "Hello, Sir" rank-fix work the same night. The full test suite sits at 820-ish passing tests; the only thing that ever fails is that one pre-existing flaky combat test mentioned up top, and I re-ran it enough times to be confident it's the same known issue, not something new.

Beyond the automated tests, I also drove the actual game in a real browser for the harder-to-test parts — the visible rank readout, the Highlights overlay opening from real typed chat, the "Currently" section showing the right relationship and Stage info, the History overlay still working correctly alongside the new Highlights one. Everything came back exactly as designed, with the game itself, not just the underlying logic.

I also ran the full type-checker, linter, and production build one more time after finishing, so what's on your machine right now genuinely builds clean.

## Where everything is

Every file this stretch touched is already synced to your actual project folder — the code, the tests, all of it. Nothing is sitting only in this session waiting to be sent over. You can open the game right now and everything above is live.

Three project docs got updated to match: the Master Index (the "what's the current state" doc), the Social Sim Roadmap (now marks four more items as built instead of proposed, with the Highlights entry explaining exactly what got narrowed), and the Hub Build Log Addendum (the detailed technical write-up, if you ever want the full blow-by-blow with exact numbers and verification steps).

## If you want to keep going

No pressure on any of this — just laying out the menu. The hot-topics system is the biggest lever left on the list. Worry-with-real-texture and the catalyst "clash" reactions are both small enough to be realistic for another solo stretch like this one, if you want me to keep chewing through the list. Relationship stages, surfacing friction, and the debrief-side echo are the three I'd actually want your input on before building — not because they're hard, but because they're the kind of thing where your gut call on tone matters more than my guess.
