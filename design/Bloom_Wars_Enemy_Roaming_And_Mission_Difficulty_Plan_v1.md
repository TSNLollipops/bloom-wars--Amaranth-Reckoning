# Enemy Roaming & Real Mission Difficulty — Plan, not started, 30 Aug 2026

Maxime, playtesting live (screenshot of an in-progress battle attached, two units still un-engaged near their spawn on the right edge of the map): "still mission are too easy. add more stealthboy per spawn. I could split my team 8-2 and clean it all easy." Then, after being asked to hold: "seriously mission are going to need me to do a full pass to test them all out. ive been doing it slowly. all mission with house amaranth is too easy too. we also need to make our enemy roam so they have more chance of attacking the player. just plan it out for now with the rest of what we working on."

Explicitly a PLAN ONLY per that last line — nothing in this doc is built. Written so the next session (or Maxime himself) can pick it straight up.

---

## 0. Two asks, kept separate on purpose (same discipline the rest of this build already uses)

1. **Enemy roaming — the structural fix.** Right now, a hostile with nothing in its sensor range simply stands still (see §1). A player can split forces, route a small group somewhere that never enters any hostile's vision, and clear the rest of the map against units that never react. This is the "8-2 split, clean it all easy" finding — not a spawn-count problem, a *behavior* problem.
2. **More "stealthboy" per spawn — a spawn-density/composition ask**, distinct from #1. **Term not confirmed** — nothing in the repo or design docs uses "stealthboy." Best-guess reading, flagged for Maxime to confirm before any number gets picked: `bloom_undertow`, the only archetype that spawns burrowed/hidden (`burrowed: true`, not drawn or targetable until it surfaces — Data Pack §8.1), already the subject of the in-flight Tier 6 Enemy Variety pass (`Bloom_Wars_Enemy_Variety_Reuse_Principle_Note_29Aug2026.md`, `Bloom_Wars_Tier6_EnemyVarietyAudit_30Aug2026.md`). If that's right, this folds into Tier 6's own "more Undertow, more places" work already tracked in the Project's Consolidated Build Plan Progress log, rather than being a new system. **Open question for Maxime, §4.**

---

## 1. Root cause, read directly from `engine/ai.ts` this session, not guessed

Every hostile-side targeting tier that finds nothing currently visible does one of two things:

- **reflexive / pack tiers** (`reflexiveDecision`, `packDecision`) — `if (!targets.length) { ...defendZone fallback...; return {}; }`. The `{}` (do nothing, hold position) is the default. The *only* existing exception: a `protect_asset` map's `defendZone` gives idle reflexive/pack units somewhere to walk toward even with nobody visible (added 25 Aug, Maxime: "if they cant get to the ship, make theyr number go up" — Mission 32's frozen center-lane wave). Every other objective type (the overwhelming majority of the 40-mission campaign) has no such fallback — a hostile that never sees anyone just never moves.
- **emergent tier** (`emergentDecision`) — omniscient (sees the whole board regardless of vision), but every real boss archetype has `moveRange: 0` (sessile — Wellroot, Heartwood, The Unnamed all confirmed this session). Irrelevant to the roaming ask; bosses were never going to roam.
- **mech-reflexive tier** — same "hold position" shape as plain reflexive when nothing's visible.

**This is exactly the mechanism behind Maxime's 8-2 split finding.** A small decoy or a routed force that stays outside every hostile's vision radius leaves those hostiles frozen at their spawn tile for the entire mission — the `defendZone` fallback already proves the fix works (Mission 32 went from a frozen, zero-damage swarm to one that actually overruns an undefended lane), it's just scoped to one objective type today.

---

## 2. What "roam" could mean — options, not decided

Not scoped to a single shape yet — this needs a decision, not just a build:

- **A. Generalize the existing `defendZone` fallback to every map**, using something already on every map instead of a per-objective field — e.g. wander/advance toward the player's known deploy tiles or map center when nothing's visible. Cheapest to build (the fallback mechanism already exists and is proven at Mission 32); the open question is *what* idle units walk toward on a map with no natural "the thing to defend" tile.
- **B. A leashed random wander** near each unit's spawn point (move a tile or two per turn within some radius, purely cosmetic-feeling but breaks the "frozen forever" case). Cheaper to reason about balance-wise (small, bounded movement) but doesn't directly close the "route around and never trigger this squad" exploit the way A does — a wandering-in-place unit can still be avoided if the player just stays outside its (small) wander radius.
- **C. Patrol waypoints per spawn/wave**, authored per mission (most design control, most authoring cost — 40 missions' worth of waypoints is real content work, not a one-line engine change).

**Recommendation to weigh, not a decision**: A is the smallest, most reusable engine change and has a working precedent already shipped and verified (Mission 32) — the natural first thing to try, with B as a possible refinement layered on top (advance toward the deploy zone, but not in a dead straight line) rather than a full rewrite.

---

## 3. Why this is a bigger, more careful pass than anything else in flight

Everything this session's Player AI work touched (`src/sim/playerAi/`) is test-only infrastructure — zero blast radius on real missions, provably (never imported by `mission.ts`/`Battle.ts`). This is the opposite: `engine/ai.ts`'s `decideHostileAction` is the **real, shipped hostile AI** every one of the 40 missions runs on. A change here touches every mission simultaneously, not one spawn list at a time.

This session's own track record on "one heuristic, no clean win" (Guard Taunt, tried three separate times, reverted three times, each attempt fixing some missions while breaking others) and the Tier 6 batch history (Mission 17's spawn-doubling: 88-92%→worse across every archetype tried, reverted) both say the same thing: a campaign-wide AI behavior change needs the full `npm run sim:batch` discipline (40-mission, n≥25 per mission, before/after, per-mission breakdown read — not just the aggregate) before it ships, not a "looks right" pass. Whatever shape gets picked in §2, build it gated/opt-in the same way the class-triangle and boss-priority passes were (a flag that's easy to revert cleanly), and expect a real per-mission re-tuning pass to follow, the same way Tier 6's spawn edits needed their own mission-by-mission sim verification.

---

## 4. Open questions for Maxime

- **"Stealthboy" — confirm or correct.** Best guess is `bloom_undertow` (burrowed/hidden until surfaced), which would fold this ask into the already-tracked Tier 6 Enemy Variety pass. If it means something else (a different archetype, or a new ambush-on-approach mechanic that doesn't exist yet), that changes the whole ask.
- **Roaming shape (§2)**: generalize the existing defend-zone-style fallback to every map (A), a bounded random wander near spawn (B), authored patrol waypoints (C), or some mix — his call, not a default I should just pick and build.
- **Sequencing**: this is now a second, independent signal (his own manual play, on top of the sim bot's numbers from earlier today) pointing at the same underlying "missions are too easy" problem, from two different systems (real hostile AI here vs. the test-only Player AI worked on earlier). Worth asking directly whether this jumps ahead of the rest of Tier 6's Act II/III variety pass and the still-open Guard Taunt/commander-protection thread, or slots in after them.
- **His own manual mission-by-mission pass**: he's already doing this "slowly" on his own. Worth asking if he wants to just report specific missions/findings as he hits them (fastest, lowest-effort on his side) versus anything more structured — not proposing he hand the whole pass over, since he said he's already mid-way through it himself.

---

## 5. What this doesn't change

Nothing in this doc is built. No files touched, no `sim:batch` run, no engine code read beyond confirming the root-cause hypothesis in §1 (which is a real code read, not a guess — cited directly). This sits alongside, not ahead of, the still-open items already tracked in the Project's Consolidated Build Plan Progress log (Tier 6's Act II/III continuation, the commander-protection/Guard Taunt thread from `Bloom_Wars_PlayerAI_Hardening_And_Alicialisation_Roadmap_v1.md`) until Maxime says otherwise.
