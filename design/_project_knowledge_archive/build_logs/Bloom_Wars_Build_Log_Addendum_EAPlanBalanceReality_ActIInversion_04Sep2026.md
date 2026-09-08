# Build Log Addendum — Correcting the EA Plan's Balance Picture: Act I Inversion, Not the Enemy-Roam Story, 4 Sep 2026

**This corrects something I got wrong earlier in this same session.** In the previous addendum today (`Bloom_Wars_Build_Log_Addendum_EAWeek3PullForward_HowToPlayHub_Mission5And10_04Sep2026.md`) I called Mission 5's moderate-tier underperforming its own easy tier a "new finding, not yet investigated." Digging into the eliminate_all backlog afterward, I found that number sitting in the original 1-2 Sep fingerprint table the whole time: `mission_amaranth_5 | 66 | 46 | 100`. It's real, but it's not new, and I should have checked that table before calling it a discovery. Recorded here plainly rather than left standing.

## What I actually set out to check, and why the premise was wrong

The EA plan's "known open bugs" line has read the same way since 31 Aug: "a dozen-plus `eliminate_all` missions pushed toward 0% by a newly-shipped enemy-roam fallback (mechanism accepted by Maxime, tuning not yet decided)." Went to check whether the AI tier system (shipped 1-2 Sep, after that line was written) had quietly resolved this the same way it resolved Mission 5/10 — pulled the actual list of `eliminate_all` missions from `campaignAmaranth.ts` (15 of them: 1, 4, 6, 8, 13, 14, 16, 18, 19, 20, 21, 24, 25, 28, 30 — a real "dozen-plus," not the partial list of 9 an older doc had), and ran a fresh batch (`npm run sim:batch -- 100 <ids> --all-tiers`, n=100 per mission per tier — below Maxime's own n≥500 floor for anything that decides a balance call, so treat these as a spot-check, not a verdict).

**The premise turned out to be stale in a different way than Mission 5/10 was.** It's not that the AI tiers quietly fixed this — it's that the "enemy-roam fallback broke it" story itself got overtaken by two things that happened after 31 Aug and before I ever looked at this:

1. **1 Sep — Maxime's own whole-campaign retune to a ≤15% ceiling** (`Bloom_Wars_Build_Log_Addendum_WardenAmaranthReckoning_ActI_Retune_1Sep2026.md`). He extended a new rule — "if ai win more than 15% of the time, the map is too easy" — backward onto the entire existing Warden campaign, deliberately pushing most missions toward low win rates against the old test bot. Some of what the EA plan calls "broken" was, by this point, *working as intended* against a design goal that postdates the EA plan's own line about it.
2. **1-2 Sep — the Player AI tiers rebaseline** replaced that single-bot measurement with a three-tier fingerprint (Easy/Moderate/Hard) across all 76 missions, already run once at n=100 and already written up in `Bloom_Wars_Build_Log_Addendum_PlayerAiTiers_Telemetry_UI_01Sep2026.md` §4. That table already answers almost everything I went looking for — I just hadn't read it before running my own numbers.

So the EA plan's line isn't describing current reality on either count: not the mechanism (enemy-roam fallback isn't really the operative story anymore, the deliberate retune is) and not the status (most of it isn't "tuning not yet decided," it's already measured and mostly fine).

## What my fresh n=100 spot-check actually shows, mission by mission

| Mission | Easy | Moderate | Hard | Matches 1-2 Sep table? |
|---|---|---|---|---|
| 1 — Muster | 0% | 0% | 20% | Yes (0/0/21) |
| 4 — Tunnel Rats | 10% | 15% | 91% | Yes (16/22/89) |
| 6 — House Colors | 63% | 99% | 100% | Yes (56/99/100) |
| 8 — The Choir Sings | 41% | 70% | 100% | Yes (43/65/100) |
| 13 — New Colors, Old Wounds | 5% | 58% | 100% | Yes (2/59/100) |
| 14 — Steel Rain | 0% | 63% | 96% | Yes (1/60/92) |
| 16 — Collaborators | 0% | 59% | 74% | Yes (3/58/80) |
| 18 — Breakout at Draven's Cut | 0% | 46% | 100% | Yes (0/48/97) |
| 19 — The Silent Ward | 0% | 57% | 100% | Yes (0/52/100) |
| 20 — Marrow's Line | 16% | 98% | 98% | Yes (17/100/98) |
| 21 — Cut the Root | **0%** | **0%** | **0%** | Yes (0/0/0) — still true |
| 24 — Two Fires | 4% | 17% | 80% | Roughly (4/16/87) |
| 25 — The Reckoning | 0% | 0% | 73% | Roughly (0/0/66) |
| 28 — Marrow's Reckoning | 0% | 0% | 65% | Roughly (0/0/67) |
| 30 — Ashes of the Second Ring | 0% | 2% | 97% | Roughly (0/3/98) |

Every number lines up with what was already measured 1-2 Sep, well inside normal sampling noise. Nothing has drifted since then — the campaign has been sitting in exactly this state for two days without anyone checking whether it still needed a decision.

**Read against the target-band system that same 1-2 Sep addendum proposed** (§4.1 of `PlayerAiTiers_Telemetry_UI`): most of this list is actually fine. A "Standard" mission's band is Easy 10-30% / Moderate 50-75% / Hard 85-100% — Missions 4, 8, 13, 14, 18, 19, 20 all land inside or close to that once you're on Moderate or Hard, even though their Easy numbers look alarming in isolation (Easy is supposed to struggle; that's what an Easy bot is for). Missions 24, 25, 28 read as "Wall" (finale-tier: Easy ≤3%, Moderate 10-25%, Hard 40-70%) but their Moderate numbers (17%, 0%, 0%) are under even that permissive floor — genuinely soft, not catastrophic.

**Mission 1 and Mission 21 are the real problem, and they're not new — they were already named in the 1-2 Sep table's own reading** ("Warden Act I is inverted... Missions 1, 7, 12, 21 unwinnable or nearly so on every tier"). I only checked the eliminate_all subset, so I can independently confirm 1 and 21 (both `eliminate_all`); Missions 7 and 12 use different objective types and weren't part of this pass, but the existing table already has them at 28/8/0 and 0/36/41.

- **Mission 1, "Muster," is Act I's opening mission** — the very first thing anyone playing this campaign sees — and it wins 0% on Easy, 0% on Moderate, and only 20% on Hard, with turns/win in the 40s (this mission runs long). An opener is supposed to be Easy 40-70% / Moderate 80-95% under the proposed band system. This isn't in a different band, it's inverted from the band an opener is supposed to be in.
- **Mission 21, "Cut the Root," is a deliberately-tuned boss fight** (per its own extensive in-file tuning history) that's now sitting at a flat 0% across all three tiers, including Hard — the tier built specifically to be "the tactics-veteran ceiling." The 1-2 Sep table already flagged it "nobody wins." When even the AI that reads the enemy's own code and plans a whole squad's turn can't win a mission, the honest read per that table's own framing is "this is unfair, not hard" — not a difficulty setting, a design problem.

## What's actually still open, now that the story's corrected

1. **The target-band balance rule (§4.1/§6 of the tiers docs) has never been formally signed off.** Maxime said "your call" on 2 Sep when asked how to handle the philosophy question generally, and it's been used as "the working rule" since — but the docs themselves still list "sign off, adjust the bands, or replace them" as an open item, not a closed one. Worth a real yes/no rather than continuing to run on an implicit default.
2. **Act I's inversion (Missions 1, 7, 12, 21) has been sitting undecided since 1-2 Sep.** The docs already asked, and never got an answer: does this get a dedicated re-tuning session now, or does it wait and get flagged as testers actually hit it live? Given Mission 1 is the literal first mission in the campaign, I don't think this is a "wait and see" item the way the rest of the eliminate_all list is — a new player's first mission being close to unwinnable is a first-impression risk in a way nothing else on this list is.
3. **The rest of the eliminate_all list (14, 16, 18, 19, 24, 25, 28, 30) is genuinely lower priority** — Moderate and Hard mostly clear or nearly clear them, Easy struggling is by design. Worth logging, not worth a dedicated session on its own.

## What I did NOT do, on purpose

Did not retune any mission. Did not sign off on the target-band rule myself — that's explicitly flagged in the docs themselves as Maxime's call, and unilaterally deciding a whole campaign's difficulty philosophy is exactly the kind of scope this project's own rules say to flag, not just build through. Did not run the n≥500 floor Maxime set 2 Sep for anything that actually decides a balance call — everything above is a spot-check confirming the existing n=100 table still holds, not a new tuning pass.

## Files changed

- `Bloom_Wars_EA_Launch_Plan_31Aug2026.md` — "Known open bugs/balance items" line rewritten to drop the stale enemy-roam framing and point at the real open items (target-band sign-off, Act I inversion).
