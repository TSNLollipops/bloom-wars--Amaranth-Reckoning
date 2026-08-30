# Build Log Addendum — Tier 6 spawn-variety pass, batch 5: Act I whole-act sweep (30 Aug 2026)

Maxime, live-playtest feedback: "act 1 mission are absolute cakewalk." Followed up when asked to scope it ("the whole act, some mission just need more variety, some need more enemy. the amaranth one need more enemy").

## Splitting the act before touching anything

Act I (missions 1-12) reads as two different stories in the sim data. Six missions were already genuine, unambiguous cakewalks — 1 (76-96%, though its own build log flags real historical noise, not retuned here), 2, 4, 6, 7, 11 all sitting at 84-100% with no fragility flag. Five others were already brutal for the bot (0-24%): 3, 5, 8, 10, 12. Given Maxime plays live and the bot is known-weak (the whole reason for the parallel session's own Tier 6.5 AI-hardening thread), that split doesn't necessarily match what he's feeling — asked directly, and he confirmed: the whole act, not just the easy half.

Read each of the twelve missions' own build logs before touching anything (same discipline as every prior batch). Verdict per mission:

- **Mission 1 (Muster):** its own build log already flags real, unexplained noise in the bot's win rate (~30-40%, sometimes 0-10%) from a change validated against human play, never rechecked against later stress-testing. Not a clean "add more" case — flagged for its own dedicated look, not touched this batch.
- **Mission 2 (Wire and Mud):** 100% at n=150, single archetype (Splitfang only) for the whole mission. Clean candidate.
- **Mission 3 (The Low Ground):** 0% for the bot, but its own build log already recorded Maxime's own explicit prior feedback — "we will really have to lean on it as a swarm entity with various variety" — read at the time as a composition ask, not acted on until now. Real candidate for variety, though win-rate can't be used to verify it (already at floor).
- **Mission 4 (Tunnel Rats):** 100% at n=150, and its own build log already logged "my team eat the bloom... not acted on." Clean candidate.
- **Mission 6 (House Colors):** the one Bloom-free House Amaranth mission in the act — matches "the amaranth one" directly. 84% at n=150, real margin.
- **Mission 7 (Sporewatch Ridge):** still 100% at n=150 even after batch 1's own Undertow addition. Real margin left.
- **Mission 8 (The Choir Sings):** Act I's mid-boss spike. Its own build log records Maxime explicitly endorsing this difficulty at the time ("that might just be what's needed to teach player how unforgiving this game is... there some loss you gotta accept"). Not touched — already a deliberate design call, not a gap.
- **Mission 9 (Cut Off):** already touched in batch 1 (Undertow + Gallcyst), now at 73% with real commander_down pressure already present (40/150). Left alone — already at a reasonable difficulty, not spare margin.
- **Mission 10 (The Amaranth Betrayal):** its own build log's only data is a 3-run spot-check from original build ("no red flags") — nothing like the real n=150 samples this pass otherwise uses. Current campaign-wide batches put it at only 12-24%, already flagged as a "Not started" open item (undiagnosed). Adding enemies to an already-weak, undiagnosed mission would be reckless — needs real diagnosis first, not blind buffing. Not touched.
- **Mission 11 (The Long Walk Back):** 99% at n=150 (148/150) going in — see below, tried and reverted.
- **Mission 12 (The Fallow Line):** Act I's own finale, already the hardest mission in the act by design per its own build log, and now additionally weighed down by the already-tracked commander-focus-fire issue (Tier 6.5, reserved for the AI pass). Not touched — the real fix here isn't more enemies.

## The edits (2, 3, 4, 6, 7)

- **Mission 2:** +2 Sporethrower at "enemy_deploy" (the same pool the existing Splitfang waves already use safely). 100%→100% at n=150 — completely absorbed, no measurable cost.
- **Mission 3:** +2 Sporethrower at "enemy_deploy." Bot stays at 0% (as expected — this mission's own build log already traced its losses to ordinary attrition the bot's tactical ceiling can't clear, not a count problem), but the failure-mode mix shifted from a 50/50 commander_down/timeout split toward almost entirely commander_down — consistent with more pressure, not a new kind of break. Shipped for real variety credit (Maxime's own explicit, twice-stated ask), not a measured difficulty change.
- **Mission 4:** +2 Splitfang at "enemy_deploy." 100%→100% — same as Mission 2, fully absorbed.
- **Mission 7:** +2 Splitfang at turn 6 (the hold window's own opening turn), "enemy_deploy." 100%→100% — fully absorbed even on top of batch 1's own Undertow addition.
- **Mission 6:** the one that needed real calibration — see below.

## Mission 6 and Mission 11: both overshot on the first attempt, both corrected or reverted

**Mission 6** went in at 84% (n=150). First attempt added 2 more House Amaranth Line Troopers (turn 4) — this mission's roster is 4 small, fixed, 1-for-1 named mechs, not a scalable swarm pool, so a "+2" here is actually a 50% force increase, not a modest bump. Result: 84%→11%, a real cliff. Backed off to +1 trooper at the same turn: still 84%→51%, a 33-point drop, too steep. Final version: +1 trooper, delayed to turn 7 (closer to this mission's own turnLimit of 10, so it matters less in a fight the squad has usually already mostly resolved by then). Result: 84%→69-71% across two separate n=150 runs — a 13-15 point drop, in line with the biggest single-mission drop this whole Tier 6 pass has otherwise accepted (Mission 14's own 85%→70% in batch 2).

**Mission 11** went in at 99% (148/150). First attempt (+2 Sporethrower, turn 1, stacked directly on the existing Splitfang blocking wave's own coordinates) overshot hard: 99%→56%, with a brand-new LOSS failure mode that hadn't existed before this edit at all (0→66/150) — this mission's own comment already named the exact risk (Mission 17's "extract_unit is far more sensitive to any single enemy's damage-per-turn" lesson) before making the same mistake anyway. Cut to a single Sporethrower, moved off turn 1 to turn 3 to de-stack from the Splitfang wave's own opening damage: still 99%→72%, LOSS 0→42/150. **Reverted entirely** rather than keep calibrating down — this is now the third extract_unit mission this whole Tier 6 pass has found unusually fragile (after Mission 17, which needed a full multi-round tuning pass just to land its own addition, and Mission 26, which stayed thinned rather than restored after its own isolation-kill bug). Read as a real, campaign-wide pattern worth naming plainly: `extract_unit`'s single-named-target loss condition seems to punish added enemy damage-per-turn far harder than its surface win rate would suggest, regardless of which specific mission it's on. Left as a note for whoever picks up `extract_unit` balance as its own dedicated topic — it isn't safe to treat like any other objective type in a routine variety pass.

## Full verification

typecheck clean, lint clean, full test suite **1146/1146** (data-only edits, no test touches campaign data directly). Full 40-mission/1000-run campaign batch (n=25) after shipping: **70% aggregate (703/1000)**, dead center of the range this whole session has tracked. Nothing outside the six missions touched here moved; Mission 11 confirmed back at its original ~97-100% range after the revert.

## What this leaves open

The AI-reactivity half of Maxime's own diagnosis — "player eat the bot because they dont move and dont react until they are targeted. give bot amaranth same vision as player ai" — is a different kind of change entirely: hostile AI behavior (`engine/ai.ts`), not mission data. That's the same root cause the parallel session's own paper-only "Enemy Roaming And Mission Difficulty" plan already scoped, and it's engine-wide (every mission at once, not a per-mission edit). Not touched this batch — flagged back to Maxime directly rather than built unilaterally, both because it reverses his own earlier "I'll do the AI pass later" call and because it's the exact file/topic a second concurrent session already has a live plan against (the same kind of collision that caused today's earlier `index.ts` overwrite incident, this time on a much more central file).
