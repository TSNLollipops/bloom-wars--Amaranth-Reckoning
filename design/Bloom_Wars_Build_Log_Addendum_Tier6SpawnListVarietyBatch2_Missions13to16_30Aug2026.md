# Build Log Addendum — Tier 6 Variety, Batch 2: Missions 13-16 (30 Aug 2026)

Follows the first Tier 6 edit batch (`Bloom_Wars_Build_Log_Addendum_Tier6SpawnListVarietyEditsAndFindings_30Aug2026.md`). Maxime, after playing the shipped batch: "id rather do them now if possible. mission 13-16 are pretty cool.. easy still. giving them more variety would be cool. youre authorise to make whatever change u want."

## What shipped

| Mission | Addition | Baseline (n=60) | After edit (n=60) |
|---|---|---|---|
| 13 — New Colors, Old Wounds | +3 Sporethrower, turn 1 | 97% (58/60) | 88% (53/60) |
| 14 — Steel Rain | +2 Undertow (burrowed), turn 4, on top of Batch 1's +2 Sporethrower | 85% (51/60) | 70% (42/60) |
| 15 — Landfall | *(no further change — see below)* | 67% (40/60), already carrying Batch 1's edit | — |
| 16 — Collaborators | *(no change — see below)* | | |

Mission 13's own comment flags a *nonlinear squad-size response* from an earlier tuning pass — that's a different lever than adding a new archetype at a fixed squad size, so it wasn't treated as a blanket "stay away," just tested for real before shipping rather than assumed safe. 97% baseline confirmed there was genuine room; 88% after is still a comfortably easy mission, just no longer a mechanical formality.

Mission 14 already picked up a Sporethrower pair in Batch 1. This pass re-baselined it fresh (85%, not the 95% n=20 sample Batch 1 reported — n=60 is the more trustworthy number, same lesson as Batch 1's own noise discussion) before adding Undertow on top, landing at 70%. That's a bigger single-edit drop than Mission 13's (15 points vs. 9), but still well clear of anything resembling the knife-edge missions' own history — no run ended in an outright loss, every failure was a commander-down.

## Why 15 and 16 didn't get more

**Mission 15 (Landfall)** already took a Sporethrower addition in Batch 1 and is sitting at 67% — a real, meaningful difficulty bump from its 83% pre-Batch-1 baseline. Stacking a second new archetype on top of that risks the same kind of thing Batch 1's addendum flagged for the genuinely fragile Act III missions: a mission that already absorbed one real hit to its win rate doesn't have the same headroom left that 13 and 14 did. Left alone this pass rather than push it further on the strength of "authorized to do whatever" alone — the sim numbers are what actually decide this, not the authorization.

**Mission 16 (Collaborators)** isn't a Bloom mission at all, by design — House Amaranth conscripts only, the mission's entire point is a moral-complexity beat about human collaborators, not the war against the Bloom. It's one of the audit's confirmed no-Bloom missions (alongside 6, 20, 23, 28). Adding Bloom archetypes here would mean inventing a two-front mixed mission the original design never called for, not just varying an existing spawn list — a bigger, different call than what "give it the missing types" was asking for elsewhere. Left as-is; flagging this rather than silently skipping it, since Maxime named 13-16 as one group and 16 not moving is worth him seeing explicitly, not just inferring from its absence.

## Verification

- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm test` — 1140/1140 passing, zero regressions.
- `npm run sim:batch -- 60` — every touched mission re-verified at n=60 (table above).
