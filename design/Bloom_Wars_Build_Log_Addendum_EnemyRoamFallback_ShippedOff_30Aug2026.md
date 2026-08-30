# Build Log Addendum — Hostile AI "Roam When Nothing Visible" Fallback (Shipped OFF), 30 Aug 2026

## Where this came from

Maxime's live playtest feedback this session: *"polayer eat the bot becayse
they dont move and dont react until they are targeted. give bot amaranth
same vision as player ame ai as play test."* Confirmed by reading
`engine/ai.ts` directly, not guessed: every hostile AI tier except the one
`protect_asset` fallback (Mission 32's fix, 25 Aug) held perfectly still
once it had nothing in sensor range. A squad that routed itself outside
every hostile's vision left those hostiles frozen at spawn for the entire
mission, no matter how long it ran.

A separate, parallel Claude session had already written a paper-only plan
for this exact problem: `design/Bloom_Wars_Enemy_Roaming_And_Mission_
Difficulty_Plan_v1.md`. Read in full before building anything. Its §2
picked **Option A** (generalize the existing `defendZone` fallback to use
`deployZones.player`, which unlike `defendZone` is a required field on
every map) over Option B (bounded random wander) or Option C (authored
per-mission patrol waypoints) — cheapest, reuses a proven mechanism, no new
per-map authoring. Its own risk section flagged that this needed the full
`npm run sim:batch` discipline before shipping, not a "looks right" pass,
and recommended building it gated behind a flag specifically so a bad
outcome wouldn't need a mid-flight revert.

## What was built

`engine/ai.ts`:
- `idleRoamTarget(map)` — returns `map.defendZone` if the map has one
  (unchanged, existing behavior), else `map.deployZones.player` if
  `ENABLE_ENEMY_ROAM_FALLBACK` is on and the map has one, else
  `undefined` (hold position — the old universal behavior).
- `reflexiveDecision` and `packDecision`'s "nothing visible" branches both
  route through `idleRoamTarget` instead of checking `defendZone` alone.
  `mechReflexiveDecision` inherits this for free (falls through to
  `reflexiveDecision`). `emergentDecision` (boss-tier, deliberately
  omniscient) was left untouched — not applicable.
- `ENABLE_ENEMY_ROAM_FALLBACK` — an exported `let`, not `const`, so it can
  be flipped in one line. **Shipped as `false`.** See below for why.

Test coverage: `ai.test.ts` gained a 7-test describe block exercising the
mechanism directly (flag flipped `true` locally via a test-only setter,
`__setEnableEnemyRoamFallbackForTests`, so the suite proves the mechanism
itself works correctly independent of the live default) — reflexive tier
roams, defendZone still wins priority when a map has both, a visible
target still wins over the fallback, pack tier roams, and a map with
neither zone still holds. `abilities.test.ts` and `stallNudge.test.ts`
each had one pre-existing test that encoded the old "holds forever"
assumption; both were touched during development and the abilities one
was reverted back to its original expectation once the flag shipped off
(see below). Full suite: **1152/1152 passing.**

## Why it ships OFF

The plan doc's own instruction — full `sim:batch` before shipping, not a
"looks right" pass — was followed, and it did its job. Two runs, same
`sim:batch -- 25`, same 40-mission campaign, everything else identical:

| | Aggregate |
|---|---|
| Before (flag off, today's baseline, includes this session's earlier Tier 6 spawn-variety batch) | 706/1000 (71%) |
| After (flag on) | 541/1000 (54%) |

A 17-point aggregate drop is already a lot for one change. What made it a
"stop and check" rather than "expected, re-tune it" was *where* the drop
concentrated. Six missions collapsed to near-0% that weren't before:
`mission_amaranth_4`, `_6`, `_13`, `_18`, `_24` (all `eliminate_all`,
all failing via `COMMANDER_DOWN`), and `mission_amaranth_26` (`extract_unit`,
a brand-new pure-`LOSS` mode it never had before).

Read the verbose logs for two of them rather than guessing from the
aggregate (`npx tsx src/sim/run.ts <id>`):

**`mission_amaranth_4`** (100%→100% is what it should still be — see
below on why this one specifically dropped hard): once every hostile on
the map converges on the squad's own start position instead of only the
ones already in a fight, several attacks land on whichever unit is most
exposed in the same hostile phase. That's landing disproportionately on
the commander — which is the campaign's known, still-unsolved soft spot
(Tier 6.5, commander focus-fire, three prior reverts logged elsewhere in
this build log). This change doesn't cause that weakness, but it pours a
lot more simultaneous pressure directly onto it. Worth naming directly:
`mission_amaranth_4` was also one of today's earlier Tier 6 spawn-variety
additions (batch 5, +2 Splitfang at turn 1) — so part of its specific drop
is two same-day changes landing on one mission with no re-check in
between. A process note for next time: re-run a mission's own sim after
*each* change that touches it, not just at the end of a batch.

**`mission_amaranth_26`** ("The Unnamed Beneath," extract_unit): a
burrowed Undertow that used to stay put until spotted now beelines toward
the player's own deploy zone unconditionally from turn 1 — and that path
runs directly through Okafor, the deliberately-immobile stranded
extraction target the mission is built around ("I'm not hurt, I'm just
not going anywhere fast down here"). She's dead by turn 2 in the run I
read, before the player has any real chance to reach her. That's not
"harder," it's a different and worse failure: the fallback broke the
mission's own premise, not just its win rate. This is the exact risk the
plan doc's own write-up called out by name for burrowed/vision-gated
ambush setups.

## The actual verdict

The mechanism itself is correct and does what it was asked to do — verify
via the flag-on test suite, all passing, all behaving exactly as designed
(defendZone still wins priority, a visible target still wins over the
fallback, hold-position-with-neither-zone still holds). This isn't a bug
in `idleRoamTarget`. It's exactly the outcome the plan doc's own risk
section predicted: turning "the AI reacts more" on for the whole campaign
at once needs a real per-mission re-tuning pass to follow, the same way
each individual Tier 6 spawn addition this session got its own before/after
check at n=60-150 before shipping. Flipping one flag campaign-wide skipped
that per-mission step entirely — 40 missions' worth of it at once, not one.

So: code is in, fully built, fully tested, campaign-wide numbers are on
the record. `ENABLE_ENEMY_ROAM_FALLBACK = false` for now — the campaign
plays exactly as it did before this addendum (confirmed: a fresh n=25
sweep with the flag off came back at 688/1000, 69%, matching the 71%
baseline within normal sampling noise). Nothing live changes until someone
decides how to spend the re-tuning cost.

## What "shipping it for real" would take, if that's the direction

Roughly the same discipline as today's Tier 6 spawn-variety pass, but
scoped to whichever missions the flag actually touches (anything without
an existing `defendZone`, so most of the 40) — check each one's own
before/after at n≥60, and for the ones that break structurally rather than
just get harder (like Mission 26), a design fix, not just a numbers
tweak: either exempt vision-gated ambush/burrow setups from the roam
fallback specifically, or add a turn delay/distance cap so a burrowed unit
doesn't start closing distance the instant it spawns. Worth deciding
whether that's the whole campaign at once or a mission-type-by-mission-type
scope-in (e.g. start with straightforward `eliminate_all` missions that
have no stranded/immobile unit on the board, leave `extract_unit` for a
separate pass).
