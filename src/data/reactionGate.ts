// src/data/reactionGate.ts
// Phase 3, piece one — Bloom_Wars_NPC_Reaction_Engine_v1.md §1a, "Gate 0."
// That document specs a full formula ((A+B)+(a+b4(c))=D+E: scene context,
// player POV, per-pilot archetype run through animal-catalyst echoes,
// pillars, scene-level self/other/propagate gates) and is explicit that
// it's design-only, unscheduled, and bigger in scope than Favorability
// itself — several of its own sub-questions (how D/E map to a Favorability
// delta, how pillar weights get assigned per pilot, the data schema) are
// still genuinely open. This file does NOT build that formula.
//
// What it builds is exactly what §1a and §4 both name as "the cheapest
// real starting point" and "the natural first slice to prototype, not the
// full formula at once": Gate 0 alone — a plain yes/no, checked before
// anything else, on whether a given pilot even registers a given ambient
// moment at all. The source's own framing: this should be the SINGLE MOST
// FREQUENT outcome across ordinary play, not a rare edge case — most
// pilots, most of the time, watching most things happen around them,
// don't react in any way worth rendering.
//
// Scoped to exactly one call site (Hub.ts's speak(), the ambient
// broadcast Talk verb) — not provoke() (a deliberate, forced click should
// always land), not propagate()'s own catch-chance (a different,
// already-probabilistic mechanic serving hop decay, not this gate), not
// any of the deterministic verbs (Share a Drink, the minigames, Ask Out —
// those need reliable outcomes to function as actual game systems, not
// ambient flavor). Right now speak() gets a reaction from EVERY nearby
// NPC, always — this is the one place in the scene where Gate 0's "no" is
// entirely missing.
//
// What decides yes/no isn't specified in the source beyond "checked
// first, cheapest" — left open there, same as here. This is a real,
// hand-tuned placeholder model, not a locked number: a base chance
// (most Talk presses still land, since the ambient loop needs to feel
// alive), nudged by the pilot's own current state — drunk pilots are
// looser and more likely to chime in on anything; a pilot already at the
// Stress panic threshold (ambientLines.ts's own STRESS_PANIC_THRESHOLD)
// is too consumed by their own moment to register ordinary chatter. Same
// "not a locked number" caveat as every other placeholder constant in
// this scene (Hub.ts's own file header).
//
// worried, Hub polish 26 Aug 2026 — a bonus, not a penalty, and
// deliberately a different shape from the panic penalty just above even
// though both read off a kind of fear. Panic is about being overwhelmed —
// too consumed by your own moment to register anything else, hence it
// SUBTRACTS. Worry about a crewmate out on a mission reads the opposite
// way: it's the kind of anxious that wants to talk about it, check in,
// vent to whoever's nearby — so it ADDS, same direction as drunk's own
// bonus (looser, more likely to chime in), just a smaller nudge. The two
// can stack (a worried pilot who's also independently panicking from
// Stress still nets negative — panic's own −0.3 dominates a +0.1 bump),
// which is the correct behavior, not a bug: crossing the Stress panic
// threshold is a much more acute state than background mission-worry.
import { STRESS_PANIC_THRESHOLD, type AmbientPilotState } from "./ambientLines";

export const GATE0_BASE_CHANCE = 0.65;
export const GATE0_DRUNK_BONUS = 0.15;
export const GATE0_PANIC_PENALTY = 0.3;
export const GATE0_WORRY_BONUS = 0.1;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

// Exported separately from the coin-flip itself so it's directly
// testable without fighting Math.random() — same split every other
// probabilistic piece in this project already uses (darts' HAND_JITTER
// bound vs. throwDart, the peg board AI's scoring vs. its tiebreak roll).
export function gate0ReactionChance(pilot: AmbientPilotState): number {
  let chance = GATE0_BASE_CHANCE;
  if (pilot.drunk) chance += GATE0_DRUNK_BONUS;
  if (pilot.stress >= STRESS_PANIC_THRESHOLD) chance -= GATE0_PANIC_PENALTY;
  if (pilot.worried) chance += GATE0_WORRY_BONUS;
  return clamp01(chance);
}

export function gate0Reacts(pilot: AmbientPilotState): boolean {
  return Math.random() < gate0ReactionChance(pilot);
}

// ---- Formula v2, Gate 0: the want check and idle, 28 Sep 2026 ----------------
//
// Bloom_Wars_Formula_v2_PreLaunch_Build_Plan_v1_27Sep2026.md, Part A. THE
// FORMULA Master Reference v2 (25 Sep 2026) changed Gate 0 in two ways, both
// Maxime's rulings:
//
//   1. It decides with a WANT test before anything else: does the moment touch
//      this self's scene-want? If not, its long-term want? Only if neither is
//      touched does the ordinary "not right now" apply. In this game the
//      scene-want is read off what the pilot is carrying right now: a live
//      Worry loud enough to be on their mind, or an unmet need. The long-term
//      want has no field anywhere in the game yet, and Maxime's plan answer
//      (Q2) was to skip it for now, so a pilot with nothing on their mind
//      falls through to the existing roll, unchanged.
//   2. A "no" is IDLE, not blank: a small, cheap beat that shows the pilot is
//      there. His pick (Q1): a rare silent "…" bubble. No written content, no
//      memory, no Favorability/Stress/Morale movement, by design.
//
// Pure: no clock, no Phaser. `rng` is injectable so the tests never fight
// Math.random.

/** A live Worry at or above this intensity counts as "on their mind" for Gate 0. SUPPRESSION_WORRY_PEAK is 0.45 and Mission Worry peaks near 1, so both qualify while they are fresh and drop out as they fade. Placeholder. */
export const GATE0_WANT_WORRY_THRESHOLD = 0.3;
/** How often a Gate 0 "no" shows the idle beat instead of nothing. Rare on purpose, so a Talk press into a crowded room doesn't fill it with dots. Placeholder. */
export const GATE0_IDLE_BEAT_CHANCE = 0.25;
/** The idle beat itself. Deliberately wordless: Maxime writes every line a character says. */
export const GATE0_IDLE_TEXT = "…";

export interface Gate0WantState {
  /** Intensity of the pilot's loudest live Worry right now, if any. */
  loudestWorryIntensity?: number;
  /** True when at least one need meter is under the Needs Counter's low threshold. */
  hasUnmetNeed: boolean;
}

/** Formula v2's want check: true when the moment has something to land on. */
export function gate0WantTouched(want: Gate0WantState): boolean {
  if (want.hasUnmetNeed) return true;
  return (want.loudestWorryIntensity ?? 0) >= GATE0_WANT_WORRY_THRESHOLD;
}

export type Gate0Decision = "react" | "idle" | "silent";

/**
 * The whole v2 Gate 0 in one call. A want that is touched always reacts;
 * otherwise the pre-v2 chance roll runs exactly as it always has, and its
 * "no" becomes an idle beat GATE0_IDLE_BEAT_CHANCE of the time.
 */
export function gate0Decision(pilot: AmbientPilotState, want: Gate0WantState, rng: () => number = Math.random): Gate0Decision {
  if (gate0WantTouched(want)) return "react";
  if (rng() < gate0ReactionChance(pilot)) return "react";
  return rng() < GATE0_IDLE_BEAT_CHANCE ? "idle" : "silent";
}
