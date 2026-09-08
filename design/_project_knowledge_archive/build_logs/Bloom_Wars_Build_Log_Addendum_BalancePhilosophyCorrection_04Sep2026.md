# Build Log Addendum — Balance Philosophy Correction: AI Sim Tests for Cheese, Not Win Rate; Act I Is Maxime's, 4 Sep 2026

**What prompted this.** Following up on the eliminate_all re-check (`Bloom_Wars_Build_Log_Addendum_EAPlanBalanceReality_ActIInversion_04Sep2026.md`), I asked Maxime directly for two decisions: whether to dig into Warden Act I's inverted missions (1, 7, 12, 21 — unwinnable or near so at every AI tier, including Hard) now or later, and whether to formally sign off on the 1-2 Sep target-band balance rule. His two answers reframe more than the questions asked.

## Answer 1 — Act I tuning is his, not mine

*"Missions issue are mine to deal with. I will personally tune each of them but later."*

Plain and final. Missions 1, 7, 12, and 21 are off the build queue entirely — not logged as an open Claude task, not something to dig into unprompted, not a launch-risk framing to keep repeating in status updates. Maxime owns the tuning call on these four missions and will get to it on his own schedule. If he wants help when he does — running the batch sim, tracing a specific loss, drafting candidate changes — that's a normal ask at that point, but it starts from him.

## Answer 2 — the target-band system was built on the wrong premise

*"Ai arent really suposed to win the mission btw. Ai test are to see if mission is cheesable."*

This corrects something that had been drifting since 1-2 Sep without anyone naming it plainly. The tiers plan's §6 proposed replacing the old ≤15% ceiling with per-mission win-rate bands — Openers at 80-95% on Moderate, Standard missions at 85-100% on Hard, and so on — treating "does the AI win at roughly the rate its tier implies" as the balance signal. That system was informally adopted as "the working rule" from 2 Sep onward (Maxime's "your call" at the time), and it's what I was reading Act I's inversion against when I called it a launch risk.

Maxime's own framing removes the floor from that system entirely. **The AI isn't supposed to win.** It's a hand-written heuristic bot standing in for a tester, not a target a mission's difficulty curve should be tuned against. What the batch sim is actually for is catching **cheese** — a mission that's technically winnable, but only because of some degenerate, unintended exploit (a chokepoint the AI can stack, a spawn pattern it can bait, a positional trick that trivializes what's supposed to be a real fight) rather than because the mission plays fair. A mission the AI loses 0/100 at every tier, including Hard, isn't automatically broken under this framing — it just means the AI (which is not a genius, it's a hand-tuned heuristic stack, however "tactical genius" its own docs call it) couldn't find a way through, fair or unfair. That's not evidence of anything by itself.

**This retires the target-band table in `Bloom_Wars_Player_AI_Difficulty_Tiers_Plan_v1.md` §6 as "the working rule."** It was never formally right, just informally run on since nobody had asked the question this directly. A short correction note is being added to that doc's own §6 so a future session reading it doesn't keep citing the bands as adopted.

## What actually still holds

The older ≤15% ceiling rule (31 Aug, extended to the whole Warden campaign 1 Sep) is an upper bound, not a floor — "if AI win more than 15% of the time, the map is too easy" — and that's consistent with "AI isn't supposed to win": it caps how often the AI is allowed to win without saying it should win often. Whether that specific number is still the standing check (it was calibrated against the old LEGACY bot, and nobody has re-anchored it to the tiered bots specifically) is genuinely unclear from what's been said so far — recording that as open rather than guessing at it. Cheese-detection itself doesn't need a number at all; it needs someone (currently: whoever reads a batch run) to notice when a win came from something that doesn't look like real play.

## What this changes about how I read the eliminate_all backlog and Mission 5's moderate dip

Both of those get re-read under the corrected framing, not retracted:

- **Mission 5's moderate-tier dip below its own easy tier (46-47% vs. 66-74%)** was flagged as "backwards from the expected difficulty curve" — that framing assumed a curve was expected at all. Under "AI isn't supposed to win," an inconsistent-looking curve across tiers isn't inherently a problem either. It would only matter if there's a *cheese* explanation — e.g., if Moderate is doing something dumber than Easy in a way that's really a bug in the Moderate profile itself, not a balance question about the mission. Not investigated; flagged only as "worth a look if you're ever touching Mission 5 for other reasons," not as an open balance item.
- **The rest of the eliminate_all list (14, 16, 18, 19, 24, 25, 28, 30 — Easy near 0%, Moderate and Hard mostly recovering)** reads as unremarkable now. Easy losing almost everything is exactly what "AI isn't supposed to win" predicts for the weakest tier on a mission with any real teeth. Nothing here needs a decision.

## What's genuinely still open

Whether the ≤15% ceiling is still the standing numeric check, gets re-anchored to the tiered bots, or gets dropped in favor of pure cheese review — worth asking only if it comes up naturally, not worth a dedicated round of questions on its own.

## Files changed

- `Bloom_Wars_EA_Launch_Plan_31Aug2026.md` — balance line rewritten again to record both answers plainly instead of carrying the target-band/Act I framing forward.
- `Bloom_Wars_Player_AI_Difficulty_Tiers_Plan_v1.md` — short correction note appended to §6.
