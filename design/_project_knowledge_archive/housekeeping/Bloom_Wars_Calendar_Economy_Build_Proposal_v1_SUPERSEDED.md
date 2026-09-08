# THE BLOOM WARS — Calendar Economy: Build Proposal v1

**Design pass only — zero code written yet.** Written 2 September 2026, in direct response to Maxime's own request — "lets work on calandar econ. popup your proposal" — made instead of following the EA Launch Plan's own Week 2 schedule (which had recommended deferring this system: "defer and record it, not build it"). That's a deliberate override on Maxime's part, not an oversight on mine, so this proposal treats the calendar as the real next build, not a distraction from one.

This grew out of two already-locked design docs rather than starting from nothing: `claude/Bloom_Wars_Calendar_System_v1.md` (28 Aug 2026 — the ambient, cosmetic-only day counter itself) and `claude/Bloom_Wars_Walkable_Hub_Build_Plan_v1.md` §4 (the itemized-pricing lock: "a quick Talk should sit close to free... a CO conversation costs less than [Rec Room], [Rec Room] costs less than a Berths romance scene"). Neither doc picked actual numbers. This proposal does — as placeholders, same discipline as every other new number this project ships with — and lays out exactly what building it touches.

## 1. What's already locked, so this isn't re-litigating settled ground

Three things were decided before this proposal exists, and this build respects all three rather than reopening them:

- **Cosmetic only, no fail state, this pass.** The calendar is an in-fiction pacing landmark, not a resource the player can run out of. No mission deadlines, no escalating threat tied to day count. `Bloom_Wars_Calendar_System_v1.md` calls this out explicitly as a future, separately-scoped option — not this build.
- **Two advancement mechanisms, not one.** A fixed cost on mission completion, and an itemized per-verb/per-activity cost — both already named in the locked docs, not a choice this proposal is introducing.
- **The Worries system's clock stays separate.** Mission Worry runs on its own real-wall-clock timer and does NOT get normalized to calendar time — that was locked 25 Aug, before the calendar existed, for its own reasons ("it run until the player exit, what isnt saved is lost"). This build doesn't touch it.

Also worth noting: `src/data/verbs.ts` already has an empty `cost` field... actually, checking the real file just now, the field the header comments describe isn't literally named `cost` yet — every `VerbDef` in the file is simply missing any cost-shaped field at all, and the file's own header (lines 24-29) says so directly: *"Cost specifically stays unset on every verb below: §4 locked the SHAPE of calendar pricing... but explicitly not the numbers... Every verb is free until the calendar itself exists to spend against."* That sentence was written 26 August, waiting for exactly this proposal.

## 2. The data model

One new field on `CampaignState`: **`calendarDay: number`**, starting at `1` for a new campaign (see §5 for why Day 1, not Day 0). Following the exact backfill pattern this codebase already uses for every other field added after saves existed in the wild (`campaignId`'s `if (!state.campaignId) state.campaignId = mintRandomId();`): an old save loaded without this field gets `if (state.calendarDay === undefined) state.calendarDay = 1;` — treating any pre-calendar save as if it started on Day 1, which is the honest read since there's no way to reconstruct real elapsed time for a save that predates this system.

Kept as a plain `number`, not an integer-only counter — see §3, some activity costs are worth pricing as fractions of a day, and truncating early would throw away the actual pricing signal this whole system exists to carry. Every display reads `Math.floor(calendarDay)` for "Day N."

## 3. The itemized cost table

Grounded in the locked ordering — Talk ≈ free, CO conversation < Rec Room, Rec Room < a romance-tier activity — mapped onto the 14 real `VerbId`s that exist in the codebase today (`talk`, `shareADrink`, `pegBoard`, `poker`, `fletchers`, `askOut`, `angerBlowup`, `breakdown`, `spar`, `gift`, `praise`, `insult`, `apology`, `congratulate`, `sendOff`):

**Free tier (cost 0) — conversational gestures, not scheduled activities.** `talk`, `gift`, `praise`, `insult`, `apology`, `congratulate`. All six are chat-driven exchanges layered on top of the existing Talk system (the crew-interaction brainstorm pass built five of them as extensions of exactly that chat pipe) — a quick remark or handoff, not a scheduled block of in-fiction time. This is also where a CO conversation lives mechanically (talking to the CO is still just `talk`), so it satisfies "a CO conversation costs less than Rec Room" by definition — it's in the tier below Rec Room, not adjacent to it.

**Rec Room tier (cost 1) — a real, short sit-down activity.** `shareADrink`, `pegBoard`, `fletchers`. These are genuine scheduled activities (walking to a room, playing something out) but on the shorter end.

**Rec Room tier, longer (cost 2).** `poker` — a real multi-hand Hold'em session runs longer at the table than a Peg Board round or a few darts throws, so it sits at the top of the Rec Room bracket rather than tied with the other two.

**Above Rec Room (cost 2).** `askOut` — the closest thing that exists in the build today to the locked doc's "romance scene" tier, so it's priced above the Rec Room bracket, matching the lock. Once a real Berths romance scene exists (still parked per Spitball Ideas), it should cost more than this, not the same.

**Free by necessity, not by tier (cost 0, but for a different reason).** `angerBlowup`, `breakdown`, `spar` are all system-triggered, not player-initiated — Hub.ts fires them off Stress/Morale/boredom thresholds, never off a menu click. Charging calendar cost for something the player didn't choose to spend time on doesn't fit the economy's own premise (it's pricing *player decisions*, not narrating elapsed time in general), so these three should always cost 0 regardless of tier logic. `sendOff` also stays at 0 for a related but distinct reason: it's bound to the mission-departure moment itself, and the mission's own flat completion cost (§4) already represents that whole sortie's elapsed time — pricing Send-Off separately would double-charge the same stretch of in-fiction time.

This is a genuine placeholder table, flagged the same way the Insult/Praise/Apology proposal flagged its own tier numbers: there's no `combat_sim.py`-equivalent for social/pacing numbers, so these want real playtesting, not a sim script, before they're load-bearing.

## 4. Mission completion cost

**Proposed placeholder: 5 days per mission**, applied once in `Debrief.ts` (where earnings already land — see §6). This is the one number in this whole proposal I have the least real grounding for — I don't have an in-fiction sense of how long a sortie is supposed to take start to finish (prep, transit, the mission itself, return), and that's a fiction-pacing call more than a systems one. Flagging this explicitly rather than presenting 5 as anything but a first guess: if the target is something like "Day 212 — The Reckoning" landing around, say, the campaign's climactic late mission, the total mission count times this number is the actual lever that gets you there, and I'd rather Maxime's own sense of pacing pick it than my guess.

## 5. Epoch

**Day 1 = the day the campaign starts** (first Hub load on a new save), not Day 1 = first mission complete. This reads naturally against the locked doc's own example landmarks ("Day 47 — Muster" implies real days already elapsed before whatever "Muster" marks, which only works if the count starts at true campaign start, not at first-mission-complete).

## 6. UI placement

**Hub corner readout.** `Hub.ts` already has two fixed-position corner-text anchors — the rank line at `(16, 20)` and a second known anchor at `(16, 80)` (an existing code comment even flags intent for "a readout near the rank line, buildPlayer's own corner"). The natural move is a third corner-text line following that same convention, reading something like `Day 52`. I haven't read enough of Hub.ts's full corner-text block yet to commit to an exact pixel position without risking a collision with whatever's already at `(16, 80)` — that's a five-minute check at build time, not a design question, so I'm flagging it as a build-time detail rather than guessing a number here.

**Debrief.** A richer stamp at the moment each mission resolves — something like "Day 47 → Day 52" — landing right where `Debrief.ts` already shows earnings, since that's the screen built specifically for "this is where the mission's consequences land." Named landmarks in the style of "Day 47 — Muster" or "Day 212 — The Reckoning" are a separate, later content task — someone has to decide which specific day numbers or story beats earn a named landmark, and that's a writing decision, not a mechanical one this build should try to guess at.

**End-of-campaign comparison.** Per the locked doc's own call — no backend exists for a real leaderboard, this is a pure-`localStorage` game — the honest version is just displaying the final day count at the finale Debrief ("Campaign completed on Day 340") as a shareable stat, not a comparison against anyone else's number.

## 7. What this build touches — the scope-size flag

Per this project's own standing rule ("if something would meaningfully grow scope, say so before building"): this is a real multi-file wiring pass, similar in size to the crew-interaction brainstorm pass that just shipped (which touched 11 files). Concretely:

- `campaignState.ts` — new `calendarDay` field + backfill line.
- `verbs.ts` — populate the cost table across all 14 `VerbDef` entries.
- `Hub.ts` — the actual spend: every player-initiated verb resolution point (shareADrink, pegBoard, poker, fletchers, askOut, gift, praise, insult, apology, congratulate — ten call sites) needs to add its verb's cost to `calendarDay` when it resolves. Talk/Blowup/Breakdown/Spar/Send-Off need no wiring beyond confirming they stay at 0.
- `Debrief.ts` — the flat mission-completion add, the "Day N → Day N+cost" stamp, and the finale-only final tally.
- Likely `TransporterPad.ts` or wherever mission briefing lives, if a pre-mission date-stamp is wanted there too (not strictly required for v1 — flagging as optional, not committing to it in this pass unless Maxime wants it).
- New tests — at minimum a `campaignState` backfill test, and probably an extension to `checkSocialActions.mjs`'s pattern (or a new small verify script) to confirm `calendarDay` actually advances correctly through a real chat-driven verb round-trip, matching this project's own "click-test it live, don't just typecheck it" discipline.

## 8. Open questions — genuinely Maxime's call, not guessed through

1. **The mission-completion flat cost (§4)** — 5 days is a bare placeholder with no fictional grounding behind it. Does that feel right, too small, or too large against however long a sortie is supposed to take in-fiction?
2. **The itemized tier numbers (§3)** — 0/1/2 as three tiers, or does the gap between "free" and "Rec Room" want to be wider (so a player really feels choosing to hang out costs something)?
3. **Confirm the "system-triggered verbs stay free" call** — Blowup/Breakdown/Spar never costing calendar days because the player didn't choose them. This seems like the only defensible read given the economy's own premise, but it wasn't explicitly addressed in either locked doc, so flagging it as a real decision rather than assuming it slides through unchallenged.

Nothing above should get built until these are answered — this doc is the proposal, not the build.

## 9. Naming-lock safety check

No proper nouns invented, nothing here approaches the reserved book-series terms.
