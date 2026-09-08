# Walking Animation (Tween-Based Movement + Input Lock)

Side pass, not mission-specific, 25 Aug 2026. Maxime: "can you make the sprite walk foward instead of jumping to new position? itl help if we have the code for it when it come time to build the hub" — then, once the design came into focus: "the walk thing should be a feature like xcom pause when the unit move. allowing you to have moment when the board is in flux."

**Why it jumped before this:** `Battle.ts` has no per-unit sprites — the whole board is one `Graphics` object, cleared and redrawn from live mission state every `render()` call. `moveUnit()` always computed a full path internally but only kept the destination.

**Built:** `Mission.getMovePath(unitId, destination)` — read-only, mirrors `moveUnit`'s reachability/path computation, mutates nothing. `Battle.ts` calls it before `moveUnit`, then plays the route back through `animateWalk()` — a chain of Phaser tweens (130ms/tile, so distance scales duration), driving an `animatingVisualPos` field that drawing code reads instead of the unit's real position mid-step. The engine's own state commits instantly and correctly, as always — only the *drawing* of one unit lags, for the length of its own animation.

**The actual feature — input lock:** `isAnimatingMove` blocks `handleBoardClick`, `doEndTurn` (button and spacebar), and `runActionSlot` for the animation's duration, same shape as the existing `mission.outcome !== "ongoing"` guards. Verified with real timestamps (not screenshot-timing) that clicks during a ~740ms walk are genuinely rejected, not just visually ignored.

**Not a Hub fix** — the Antfarm Carrier Hub's free-roam movement (§13.1) is its own unscoped Tier 3 system, untouched by this. What carries forward is the interpolate-a-drawn-position-over-time *technique*, now proven out once, which the Hub's own movement will need some version of.

**Known gap:** fog of war still reveals instantly at the destination the moment `moveUnit()` commits, not progressively as the drawn position advances — noticed, not fixed (a second, separate pass; fog isn't unit-scoped per-frame today).

Full narrative: archive, "units walk to their destination now, XCOM-style, instead of jumping."
