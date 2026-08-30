# Build Log Addendum — the real "stuck in a cluster" fix (30 Aug 2026)

Follows the same-day addendum on the NPC bubble-crowd throttle. Maxime's follow-up made clear that fix, while real and worth keeping, wasn't the whole story: "still cant move. from the cluster, I spawned on top of them when I changed room."

## Correcting the record

The previous addendum stated there's no player/NPC collision in Hub.ts, based on a grep near `handleMovement` that came up empty. That was wrong — a fuller read of `handleMovement`/`tryMove` (not just a grep near it) shows real, working collision: every step, on each axis independently, `tryMove` checks the candidate position against every same-deck NPC and refuses to move onto it if it's within `PLAYER_R + NPC_R`. That collision is deliberate and correct on its own — Tier 1 (26 Aug) added it specifically so the player can't walk through NPCs. The mistake was reporting "no collision exists" without having actually traced this function; the bubble throttle shipped earlier today is real and still worth having, but it was never going to fix "I can't move," because it was never the cause of that part.

## Root cause

Two things compound:

1. **The door-landing algorithm was tuned for one nearby body, not a crowd.** `pickPointNearDoor`'s original scheme drew up to 5 random jittered points near a door and rejected any that collided — its own comment cites a measured ~35.7% collide chance "whenever two NPCs land at the same door close together," making 5-in-a-row failures a sub-0.1% fluke *by that math*. That math assumed roughly one other body nearby. Tier 3's roster growth (3 → 15-20+ NPCs) plus the existing door-clustering pull means several NPCs can now be genuinely packed near a door at once — collide odds against *any* of several nearby bodies is far higher than the original per-pair number. When all 5 tries failed, the old code simply returned the last (still-colliding) draw anyway. That's the literal mechanism of "I spawned on top of them."

2. **Once inside a real cluster, `tryMove`'s per-axis collision can block every direction at once.** This part of the collision code was always correct and always doing its job — the actual bug was upstream, in how the player could end up standing inside a crowd's collision radius in the first place.

## Fix — two parts

**Part 1, the actual root cause: `pickClearPoint`.** Replaces the silent give-up. Same cheap random tries first (unchanged behavior for the ordinary, uncrowded case), but now escalates to a deterministic outward ring search — fixed radii, evenly spaced angles at each — before accepting defeat, so a crowded spot can't fail to find a real opening just because a handful of random draws got unlucky. Every candidate point is clamped to the deck floor *before* its collision check now (the old code's callers clamped after, which could silently re-collide a point that had just passed the check). Verified against a synthetic worst case matching the real report — 20 NPCs densely clustered around a door, 2000 trials: the old 5-random-try scheme would have failed to find a clear point on ~99.8% of those; the new search found a genuinely clear one on all 2000, with the pathological "no clear point anywhere" fallback never triggered once. `pickDoorLanding`, `pickDoorApproach`, and `switchRoom`'s own direct landing call all now route through this.

**Part 2, belt-and-suspenders: `forceUnstickPlayer`.** Even with Part 1, it felt right to have a real catch-all for any *other* way a crowd could box the player in — NPCs roaming into a ring around someone standing still, for instance, not just a bad door spawn. `handleMovement` now tracks how long the player has held a movement key with zero net position change *while at least 2 NPCs are genuinely close by* (a single NPC or a plain wall alone never trips this — that's ordinary wall-sliding, not being stuck). Past 700ms of that, it force-relocates the player using the same `pickClearPoint` search, centered on the player's own current position instead of a door.

## For right now, in Maxime's live session

This build wasn't loaded yet when he hit the bug, so neither fix was active in that session. Reloading picks up both: the improved landing search means a repeat of the exact "spawn on top of a cluster" scenario should no longer happen, and if any other crowd situation ever does trap the player, the 700ms auto-unstick should clear it on its own without needing a reload.

## Verification

Typecheck/lint clean, 1140/1140 tests passing (this is Phaser-scene UI code with no existing unit-test coverage in the headless harness, so the 1140 count is an unchanged-elsewhere check, not direct coverage of this fix). The escalating-search algorithm itself was additionally verified with a standalone reproduction of its exact math against a dense worst-case cluster (see above) — real evidence it solves the reported failure mode, not just logic-tracing. Still not click-tested live in an actual browser — same standing Playwright gap as every other Hub.ts/Battle.ts change this session, and arguably the change most worth closing that gap for first, given it's the second time in one day a "logic looks right" fix for this scene turned out to be incomplete.
