// src/data/worries.ts
// Worries System, build order step 2, 6 Sep 2026 — see
// Bloom_Wars_Worries_System_Proposal_v1.md's own header for the full
// design pass (28 Aug 2026, Maxime's sign-off on the open questions below).
// A general-purpose, short-window "what's currently on this pilot's mind
// right now" list, deliberately distinct from the persisted, slow-moving
// favorability/stress/morale numbers on HubPilotSocialState (campaignState.ts)
// — this is unpersisted and fast-moving, gone on reload, same "runs until
// the player exits, what isn't saved is lost" framing Mission Worry always
// had (Maxime, 25 Aug 2026).
//
// Absorbs missionWorry.ts as its first live source, per Maxime's own
// direction, 28 Aug 2026: "it becomes one entry source on the general
// list, not a parallel system." Scoped to build order step 2 ONLY —
// read-side, wired into ambientLines.ts's pickSoloEcho chain. Deliberately
// NOT built here: the mission.ts combat-outcome bridge (step 3, mission-
// scoped entries only), the domestic bucket (step 4 — "is the oven off,"
// needs its own content brief first), or any real Stress/Morale feedback
// (step 5, explicitly deferred pending actual playtesting).
//
// The "two clocks" problem (real-world-time entries like Mission Worry vs.
// an in-game-time framing for others) is resolved as Option 2, checked
// against the actual repo twice (28 Aug, then again 2 Sep once the
// Calendar System shipped and still didn't reopen it — see the proposal's
// own closing addendum): every entry keeps its own native clock, and only
// the resulting 0-1 intensity is ever compared across sources. This module
// never reads a clock itself — it's handed a fresh intensity by whoever
// owns a given source's own timing (Hub.ts, for Mission Worry) and only
// manages the list: insertion, the fixed-small-stack cap, expiry, and
// "which one is loudest right now."

import type { Catalyst } from "./ambientLines";

// AnimalTag reuses Catalyst verbatim — Wolf(teamwork)/Dog(loyalty)/
// Cat(selfishness)/Crow(indulgence)/Raven(instruction)/Bear(isolation)/
// Fox(trickery)/Rabbit(nurturing)/Shark(ambition), the exact same 9-entry
// vocabulary AmbientPilotState.catalyst already uses for a pilot's own
// personality read (NPC_Reaction_Engine_v1.md §2). The proposal is explicit
// this needs the SAME taxonomy, not a new one ("don't invent a new
// taxonomy") — it's a different axis (what's making this pilot worried
// right now, not who they are), so this re-exports Catalyst under its own
// name to document that relationship instead of silently aliasing an
// unrelated type.
export type AnimalTag = Catalyst;

// Only one real source exists after this pass — more join this union in
// steps 3 (mission.ts combat outcomes) and 4 (the domestic bucket).
export type WorrySourceId = "mission_pilot_missing";

export type WorryEntry = {
  source: WorrySourceId;
  catalyst: AnimalTag;
  intensity: number; // 0-1 — whatever the owning source's own clock/formula says right now
  bornAt: number;
  // Real elapsed time, not an in-game-day unit — the proposal's own
  // verification pass rejected that framing twice (28 Aug: no in-game
  // calendar exists to normalize to; 2 Sep, re-checked once the real
  // Calendar System shipped: it advances per-mission, not continuously,
  // and never ticks inside a still-open mission attempt, so it still has
  // nothing to offer here). Acts as a safety-net expiry, not the primary
  // removal path for a live source like Mission Worry — see
  // removeWorry's own comment.
  expiresAt: number;
};

// Gate 3's own "loudest thing wins" resolution rule (NPC_Reaction_Engine_v1
// §4b), applied here instead of a hand-tuned priority stack. A fixed small
// stack, not unbounded — Maxime's own sign-off, 28 Aug 2026 — so "what's
// loudest" stays cheap to compute regardless of how many sources ever fire
// close together once steps 3/4 exist. Only one source exists today, so
// this cap is inert for now, exercised for real the moment a second one
// lands.
export const WORRIES_STACK_CAP = 4;

// Insert-or-refresh: a fresh reading from a source replaces that SAME
// source's own prior entry (a source never stacks against itself). Only
// once the list already holds WORRIES_STACK_CAP different sources does the
// weakest of them get bumped to make room for a new one — "a new entry
// bumps the weakest off a full list," the proposal's own wording.
export function upsertWorry(entries: WorryEntry[], entry: WorryEntry): WorryEntry[] {
  const withoutThisSource = entries.filter((e) => e.source !== entry.source);
  const next = [...withoutThisSource, entry];
  if (next.length <= WORRIES_STACK_CAP) return next;
  next.sort((a, b) => b.intensity - a.intensity);
  return next.slice(0, WORRIES_STACK_CAP);
}

// Explicit removal, independent of expiresAt — Mission Worry's own
// underlying signal can disappear instantly (the mission attempt ends, or
// the onset gate hasn't been reached), and the entry needs to go with it
// right then, not linger until a real-time buffer lapses. Every other
// current caller of this module also goes through this rather than
// waiting on pruneExpiredWorries alone, matching Mission Worry's original
// flat-boolean behavior exactly (Hub.ts's own updateMissionWorry, pre-
// this-pass: cleared unconditionally the instant there's no active
// attempt).
export function removeWorry(entries: WorryEntry[], source: WorrySourceId): WorryEntry[] {
  return entries.filter((e) => e.source !== source);
}

// Drops anything past its own expiresAt. Called from loudestWorry below so
// a stale entry (a source that stopped refreshing without an explicit
// removeWorry call — the scenario expiresAt exists as a safety net for)
// never wins just because nothing's pruned the list since it lapsed.
export function pruneExpiredWorries(entries: WorryEntry[], now: number): WorryEntry[] {
  return entries.filter((e) => now < e.expiresAt);
}

// The actual "what's on this pilot's mind right now" read — ambientLines.ts
// is the one real consumer so far (step 2's whole point). undefined once
// the list is empty after pruning, the overwhelming majority of pilots,
// most of the time — same common case the old flat worried boolean always
// had.
export function loudestWorry(entries: WorryEntry[], now: number): WorryEntry | undefined {
  const live = pruneExpiredWorries(entries, now);
  if (live.length === 0) return undefined;
  return live.reduce((loudest, e) => (e.intensity > loudest.intensity ? e : loudest));
}
