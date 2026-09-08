# Build Log Addendum — Undertow ambush hold: built, verified, shipped OFF (3–4 Sep 2026)

Source plan: `claude/Bloom_Wars_Undertow_Ambush_Hold_Scoping_v1.md`
(2 Sep 2026, status *"SCOPED, NOT BUILT — awaiting Maxime's go-ahead"*).

**Short version: the diagnosis in that doc is exactly right, the fix is
built exactly as specified, it passes its tests, and it is shipped with the
switch off — because running the doc's own verification plan showed it does
not do the thing it was scoped to do, and does do several things it wasn't.**

---

## The bug, which is real

An Undertow is an ambusher: it burrows, is invisible while burrowed, and
hits for 1.5× on the turn it surfaces. All of that already worked. What did
not work is that it never held still long enough to ambush anything.
`engine/ai.ts`'s `idleRoamTarget` checks `map.defendZone` first and
unconditionally, and every `protect_asset` map has one — so on exactly the
maps where an ambush matters, *"hold position"* was not a reachable outcome
at all. It walked at the squad in the open, surfaced, and by then nobody was
surprised.

## The fix, as specified

- `BloomArchetype.holdWhenIdle?: boolean` (`data/types.ts`)
- `true` on `bloom_undertow` only (`data/bloom.ts`)
- checked **before** `idleRoamTarget` in both `reflexiveDecision` and
  `packDecision` (`engine/ai.ts`) — after it would never run

Scoped as a per-archetype flag rather than a change to `idleRoamTarget`
itself, because roaming is right for everything else: a Crawlmass pack that
freezes when it loses sight of you is a worse enemy, not a better one.

## The verification the doc asked for, run in full

Seeded A/B, identical seeds on both sides.

**Mission 22 — the mission this was actually for — n=500 per tier:**

| tier | before | after |
| --- | --- | --- |
| easy | 0% | 0% |
| moderate | 0% | 0% |
| hard | 2% | 2% |

Completely unmoved. (Worth noting on its own: Mission 22 is a wall at every
tier with or without this, which is a separate finding.)

**Full 76-mission sweep, n=25, moderate:** aggregate 48% → 50%. Nine
missions moved, six up and three down.

**The five biggest movers re-measured at n=200** — these are signal, not
sampling noise:

| mission | before | after |
| --- | --- | --- |
| `mission_amaranth_4` | 27% | **0%** (and 122/200 TIMEOUT, from zero) |
| `mission_amaranth_26` | 100% | 82% |
| `mission_amaranth_29` | 61% | 33% |
| `mission_house_amaranth_15` | 0% | 53% |
| `mission_house_amaranth_21` | 5% | 95% |

## Why it ships off

`mission_amaranth_4` decides it. Timing out 61% of runs, from zero timeouts
before, is the signature of precisely the failure the scoping doc named:
enemies that hold position on a map whose premise is that they come to you.
That is a real design change to Mission 4, not a tuning nudge. A human
would still win it by sweeping; the point is that the mission becomes a
different mission.

Set against that, the change does not deliver its own stated purpose on
Mission 22, and it swings `house_amaranth_21` from 5% to 95%.

Rebalancing five missions — one of them into a timeout — while nobody is
around to have an opinion is not a call I should make. So the work is
finished and parked one line from live.

## How to turn it on

`ENABLE_UNDERTOW_AMBUSH_HOLD` in `engine/ai.ts` — flip `false` to `true`.
Nothing else changes: the data flag, the checks and four tests all exist and
pass. Same killswitch shape as `ENABLE_ENEMY_ROAM_FALLBACK` directly above
it, which has its own history of being shipped off, measured, then turned on.

**Proof the shipped default is untouched:** the full 76-mission sweep at the
same seed after the flag was added returns `909/1900 (48%) downed/run=2.86
lost/run=0.93` — byte-identical to the pre-change baseline.

## If you do turn it on

The three regressions want attention first — `mission_amaranth_4` above all,
which probably needs its own objective or spawn revisited rather than a
number nudged. And `house_amaranth_21` going 5% → 95% suggests that mission
was leaning hard on Undertows walking into the squad, which is worth
knowing either way.
