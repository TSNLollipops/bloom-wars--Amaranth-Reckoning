# Build Log Addendum — Mission 5's real bug, found while continuing the batch (30 Aug 2026)

Continuing autonomously per Maxime's "keep going," picked up the earlier-flagged Mission 5 (Foraging Party) finding — "already at 0% win rate... blocking its own planned Undertow addition until it's looked at" — and Mission 10, to actually diagnose rather than leave open indefinitely.

## What Mission 5 actually is

Batch-simmed fresh: 7% win (4/60), 56/60 `COMMANDER_DOWN`. A verbose trace showed the exact same mechanism this same day's Mission 16 fix already closed — Rourke (the commander) picking up Mission 5's rescue NPC turn 2 and running for the exit alone, defenseless (`carryingRescueId` disables combat entirely), getting focus-fired down turn 4.

That's surprising, because the Mission 16 fix was supposed to have already stopped exactly this. It hadn't — not here.

## The actual gap in today's own earlier fix

The Mission 16 fix gated the rescue-pickup branch on `frontLineProtected`. That flag is defined as `needsFrontLineProtection(unit) && !isExtractMission` — the `!isExtractMission` half is itself a real, deliberate, earlier fix (28-29 Aug, Mission 11's own razor-thin turn limit: protecting the commander made the whole squad too cautious to make the clock). Mission 16 is `eliminate_all`, so `frontLineProtected` was true there and the fix worked. Mission 5 is `extract_unit`, so `frontLineProtected` is unconditionally false for every unit on it, Rourke included — the Mission 16 fix silently never applied to any extract_unit mission at all.

The two protections don't actually conflict. Mission 11's regression was about the whole squad slowing its *pace* (retreat threshold, path caution) to protect the commander — a real cost against a hard clock. Avoiding one specific, always-bad pickup doesn't slow anyone down, extract_unit or not; it's not a caution trade-off, it's just not volunteering to become defenseless.

**Fix:** split rescue-pickup avoidance into its own flag, `avoidsRescuePickup = needsFrontLineProtection(unit)`, with no `isExtractMission` exemption. `frontLineProtected` itself is untouched — still scoped off on extract_unit missions, exactly as Mission 11 needed. `src/sim/playerAi/index.ts`.

## A pre-existing test was pinning the buggy behavior

Two tests in `objectiveAwareness.test.ts` (25 Aug 2026, predating both the commander-protection system and the extract_unit carve-out) used Rourke as their fixture for "does rescue_pickup/seek_rescue fire at all" — not deliberately testing commander behavior, just an incidental roster pick from before either system existed. They broke once the fix landed, correctly: they were asserting Rourke *should* grab the rescue. Switched both to Bosk (an ordinary, unprotected unit — same assertions, same intent, no longer entangled with commander-protection). Added a new test locking in the actual fix: Rourke, adjacent to the same NPC on the same mission, now skips it entirely. 1141/1141 passing (was 1140 — one net new test).

## Verification

Mission 5 alone, n=60: `COMMANDER_DOWN` 56/60 → 26/60 — a real, large drop, confirming the mechanism. Win rate moved less (7% → 13-18% across a few batch runs) — see below for why. Broad regression sweep, n=30 each, across every mission this change could touch (all extract_unit missions — 5, 10, 11, 17, 23, 26, 31 — plus the two other rescue_pilot missions, 9 and 16, plus Mission 12 as an unrelated sanity check): nothing moved in an unexplained direction; Mission 11's own numbers (90% win, 0 commander deaths) confirm its pacing protection is intact. typecheck/lint/test clean throughout.

Also confirmed: Missions 9 and 16 are the only other two `rescue_pilot`-bonus missions, and neither is `extract_unit` — Mission 5 was the only mission this specific gap could have affected. Nothing else campaign-wide had this exposure.

## Mission 5 is fixed of this bug, but still a weak mission — flagged, not glossed over

Even with `COMMANDER_DOWN` cut in half, Mission 5 sits around 13-18% win, now dominated by `LOSS: turn limit reached before extraction` rather than commander deaths. A verbose trace of a losing run shows why: 8 hostiles (6 Crawlmass, 2 Splitfang) on `turnLimit: 14` simply take the squad 10-12 turns to clear before they can even start closing the distance to the exit, leaving 2-3 turns for a trip that needs more. Tested the hypothesis that the sim AI's own optional rescue-detour was eating the clock (temporarily disabling `seek_rescue` outright on extract missions) — n=150 comparison showed no real difference (18% vs 17%, well inside noise), so that's not it. This reads as the map/turn-limit combination itself being tuned tighter than the fight it front-loads, independent of any AI decision quality — a genuine balance question (retune `turnLimit`, thin the enemy count, or accept it as a hard mission), not a bug, and not attempted here. Flagged as its own open item rather than folded into "fixed."

Mission 10 (Amaranth Betrayal) was batch-tested alongside this (13%, 12 LOSS / 14 COMMANDER_DOWN at n=30) — also extract_unit, but has no `rescue_pilot` bonus, so today's fix doesn't touch it. Its own low baseline remains a separate, still-undiagnosed open item.
