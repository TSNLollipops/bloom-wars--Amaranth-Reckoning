# Build Log Addendum — the Move It verb, shipped 4 September 2026

Source spec: Maxime's own **"Move It — Verb Proposal, 3 Sep 2026"**, pasted in full
and fully authoritative — every design call in this build traces to a "Call:"
line in that doc, not a guess made while implementing it. Priority set the
same conversation, right after the Morning Report's three pending decisions
(poker left at 52%, Undertow ambush hold staying shipped OFF for Maxime's own
tonight's playtest): **"Primarily I want the move it verb added today before I
do that."**

## The problem this closes

The Ship Interior addendum already flagged the gap: the `stuckMs` give-up
sidestep resolves a doorway jam eventually, but it's a shove, not manners —
and only fires for the one NPC that happens to time out, one at a time, each
on its own clock. A real cluster of three or four NPCs jammed in a doorway
clears as three or four separate timeouts, not one moment.

## What shipped

**`clearCluster(anchor)` — one shared core, `Hub.ts`, right above `tryMoveNpc`.**
Sweeps in the anchor plus every NPC within `CLUSTER_RADIUS` (`NPC_R * 3`, ~48px)
on the same deck, and for each one: clears cached `targetX`/`targetY`/`path`,
resets `stuckMs`, and nudges via `pointNear(npc, NPC_R * 2)` through the
existing `tryMoveNpc` — the exact sidestep code the 26 Aug deterministic-lock
fix already proved safe, reused wholesale rather than re-derived.
Deliberately `sameDeck()`-scoped, matching `tryMoveNpc`'s own collision-check
discipline: all three decks reuse the same on-screen coordinate region one at
a time, so an unscoped radius check could sweep in an NPC standing on a
different deck. No room gate — harmless anywhere in the Hub.

**Trigger 1 — player chat command, `submitChat()`.** `detectMoveItRequest()`
(`data/chatIntent.ts`) recognizes six phrases — "move it", "make way", "get
out of the way", "excuse me", "clear the way", "outta my way" — via the
file's existing word-boundary `countHits()` helper, same shape as every other
`detect*` bucket there. Checked by inspection against every existing keyword
bucket in the file before shipping; none of the six collide, whole or as a
substring another bucket's own `\b`-anchoring would catch. Slotted in
`submitChat()`'s precedence chain right before `detectUnbuiltVerbLine` — after
every real verb and CO-gated request, before the unbuilt-placeholder and the
generic shrug, the same "a genuine actionable request wins" ordering every
other check in that chain already follows. Anchor is `nearestNpcInRange(APPROACH_RADIUS)`,
the same proximity helper Share a Drink/Ask Out already use; no target in
range shows a fallback ("Nobody's close enough to move.") instead of a silent
no-op.

**Trigger 2 — NPC self-resolve, `updateNpcMovement()`.** The existing
give-up-timeout sidestep (fires at `stuckMs >= STUCK_TIMEOUT_MS`) now calls
`clearCluster(npc)` instead of sidestepping just that one NPC. Strict
superset, zero regression risk: when nothing else is within `CLUSTER_RADIUS`,
the cluster is just that one NPC and the behavior is byte-for-byte identical
to before this pass.

**Deliberately not built, per the proposal's own scope lines:** no `VerbDef`
entry (no Cost/Requirements/Outcome/SocialLogEntry — this is an engine patch
from inside the fiction, not a relationship beat); no bark/acknowledgment
lines (the proposal flagged these as optional and asked to confirm before
drafting; no confirmation given yet); no real "queueing manners" (NPCs still
don't wait their turn or yield right-of-way — that's the still-unbuilt
follow-up the Ship Interior addendum already named, unchanged by this pass).

## Verification

This session has no `device_bash`, so the standard fallback applied: staged
the full `src/` tree plus config/tooling into a cloud sandbox, `npm install`,
then ran every gate directly (bypassing `npm test`/`npm run build`'s own
`pretest`/`prebuild` hooks, which need a `BW_RESERVED_TERM` env var this
sandbox doesn't have access to):

- `npx tsc --noEmit` — clean.
- `npx eslint .` — clean.
- `node tools/lint-cast-collision.mjs` — clean (33 reserved names, 11 approved
  crossover names exempted).
- `npx vitest run` — **2075/2075 passing, 89 suites** (`chatIntent.test.ts`
  itself now at 96 tests, up from 93 — three new cases covering all six
  phrases' recognition, non-collision against MUSTER/EMOTION/history/verb-request
  keyword text specifically, and empty/whitespace input).
- `npx vite build` — clean production build (one pre-existing chunk-size
  *warning*, unrelated to this change, already on record from earlier passes).

`lint-spoiler.mjs` could **not** be run — it needs `BW_RESERVED_TERM` from a
git-ignored `.env.local` this sandbox has no access to, the same standing gap
prior sessions hit. **Maxime should run `npm run lint` himself once before
tonight's playtest** to close that one gate; nothing else in this change
touches spoiler-relevant text (no new strings referencing either reserved
term).

## Committed

`src/scenes/Hub.ts`, `src/data/chatIntent.ts`, `src/data/__tests__/chatIntent.test.ts`
— 3 files, all pre-existing, all modified — committed to the real device
repo with a fresh mtime-drift guard (`expectedMtimeMs`) on each, zero
conflicts.

## Honestly still open

Not live-browser-verified — this session has no way to drive player chat
input against a running dev server. The logic is unit-tested and hand-traced
against the real precedence chain, not screenshotted. Worth Maxime's own eyes
typing "move it" at a jammed doorway before or during tonight's Undertow
playtest, since both are happening the same session. `CLUSTER_RADIUS`'s
`NPC_R * 3` starting value is explicitly a feel constant per the proposal's
own header, not a balance number — tune by playtest, no `combat_sim.py`/
`maps.py` run needed. Bark lines remain a real, cheap follow-up the moment
Maxime confirms he wants them.
