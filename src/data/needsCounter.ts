// src/data/needsCounter.ts
// The Off-Duty Needs Counter — Hunger/Thirst/Sleep — built 28 Aug 2026
// straight off Maxime's own `Bloom_Wars_Needs_Counter_Spec_v1` PDF, written
// under his explicit "you'll make a lot of decisions for me" latitude for
// item 1 of the Antfarm Réalisation plan's Phase 1 gate. That spec answers
// the four open questions `Bloom_Wars_Stress_Morale_Trigger_Proposal_v1.md`
// left on the table (minigame losses stay flavor-only, mission outcomes
// stay out of scope, the counter stays implicit — no bar — and, since no
// real CO/grotto Stress-relief content exists yet, this counter is the
// primary passive Stress/Morale driver for now, not a stopgap next to one).
//
// Pure logic only, same "data files are plain math, the scene composes it"
// split every other src/data/** file in this project keeps (Build Brief
// §5.2's purity rule) — Hub.ts owns the three per-pilot HubNpc fields
// (hunger/thirst/sleep), the real-minute tick loop that calls into this
// file, the room-presence check that decides which restore applies, and
// the roaming/ambient-line call sites this file's exports feed into. No
// new verb, no new room (spec §2) — Berths and Rec Room already exist;
// this file doesn't know Phaser or RoomId, Hub.ts's own "berths"/"recroom"
// string literals are all that's threaded through.
//
// All numeric constants below are first guesses, same "not a locked
// number, tune against real play" status as every other placeholder in
// this project (WORRY_ONSET_MS, RIVAL_AVOID_CHANCE, etc.) — the spec's own
// framing, quoted rather than reworded (§2, §7).
import type { Echo } from "./ambientLines";

export type NeedKind = "hunger" | "thirst" | "sleep";

// §2 — decay is a flat rate for all three, always, off-duty. Restore is a
// separate, additive bonus while standing in the matching room — the spec
// states them as two independent rules ("Decay: -1 per real minute... flat
// rate for all three" as the unconditional baseline, restore listed after
// as its own effect "while there"), not restore replacing decay outright.
// Net effect: -1/min anywhere, +1/min net while actually resting/eating in
// the right room. Named and commented here specifically so this reading is
// easy to spot and overrule if a flat "no decay while restoring" was
// actually meant instead.
export const NEEDS_DECAY_PER_MIN = 1;
export const NEEDS_RESTORE_PER_MIN = 2;

// §3 — once a meter drops below this line, it starts ticking Stress/Morale
// (below). Also doubles as the flavor-bank eligibility threshold (§4) and
// the roaming-bias threshold inside worstNeed below — the spec frames all
// three off the same "below 30" line, not three separate numbers.
export const NEEDS_LOW_THRESHOLD = 30;

// §3 — "a flat -3 Stress/+3 Morale-loss ceiling per tick, regardless of how
// many meters are low." With exactly three meters this can never actually
// bind tighter than "one point per low meter" (3 meters x 1 point each =
// 3) — kept as its own named cap anyway, not left as an implicit
// consequence of "there happen to be three meters," so a future fourth
// meter can't silently blow past what this spec actually asked for.
export const NEEDS_STRESS_MORALE_TICK_CAP = 3;

export function clampNeed(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/** One real-minute tick's worth of decay, plus NEEDS_RESTORE_PER_MIN on top if `inRestoreRoom` (this meter's own matching room — Berths for sleep, Rec Room for hunger/thirst — see NEED_ROOM below) is true this tick. */
export function tickNeed(value: number, inRestoreRoom: boolean): number {
  return clampNeed(value - NEEDS_DECAY_PER_MIN + (inRestoreRoom ? NEEDS_RESTORE_PER_MIN : 0));
}

/** §3 — Stress/Morale deltas for one real-minute tick, given the three meters' CURRENT (post-decay/restore) values. {0, 0} when nothing's below threshold — Hub.ts's own tick loop skips the persist/write-back step entirely in that case rather than writing a no-op zero. */
export function needsStressMoraleDelta(hunger: number, thirst: number, sleep: number): { stressDelta: number; moraleDelta: number } {
  const lowCount = [hunger, thirst, sleep].filter((v) => v < NEEDS_LOW_THRESHOLD).length;
  const magnitude = Math.min(lowCount, NEEDS_STRESS_MORALE_TICK_CAP);
  // magnitude === 0 ? 0 : -magnitude, not a bare -magnitude — JS's -0 is a
  // distinct value from 0 under the strict equality tests/toEqual use, and
  // a "no-op" tick should read back as a plain, printable 0, not -0.
  return { stressDelta: magnitude, moraleDelta: magnitude === 0 ? 0 : -magnitude };
}

// §2/§4 — which room restores (and, via worstNeed below, biases roaming
// toward) each meter. Only Berths and Rec Room are in play at all — every
// other room stays exactly as weighted as pickExploreTarget/EXPLORE_CHANCE
// already had it before this pass.
export const NEED_ROOM: Record<NeedKind, "berths" | "recroom"> = {
  hunger: "recroom",
  thirst: "recroom",
  sleep: "berths",
};

/**
 * Single source of truth for "which of this pilot's needs is the one that
 * matters right now" — feeds both §4's roaming bias (via NEED_ROOM above)
 * and §4's flavor-line pick (via NEEDS_FLAVOR_BANK below), so the room an
 * NPC gets biased toward and the line they might say about it can never
 * disagree with each other. undefined when every meter is at/above
 * NEEDS_LOW_THRESHOLD. Ties (two meters equally low) resolve to whichever
 * this scan hits first (hunger, then thirst, then sleep) — arbitrary, but
 * deterministic, and not worth a real tie-break rule for a first pass.
 */
export function worstNeed(hunger: number, thirst: number, sleep: number): NeedKind | undefined {
  // Typed here, as its own statement, rather than inline before .filter() —
  // TS infers an inline array literal's element type from the array itself
  // first (widening `kind` to plain `string`) when the annotation only sits
  // on the post-.filter() result, several steps removed; a direct
  // annotation on this array avoids that.
  const all: { kind: NeedKind; value: number }[] = [
    { kind: "hunger", value: hunger },
    { kind: "thirst", value: thirst },
    { kind: "sleep", value: sleep },
  ];
  const candidates = all.filter((c) => c.value < NEEDS_LOW_THRESHOLD);
  if (candidates.length === 0) return undefined;
  return candidates.reduce((worst, c) => (c.value < worst.value ? c : worst)).kind;
}

// §4 — "A small flavor bank. 2 lines each for hungry/thirsty/tired, fear-
// or sadness-echo coded, drawn the same way sub-animal bleed already draws
// an off-primary line... a curious player gets a real textual tell without
// a meter ever being shown." Echo-tagged (ambientLines.ts's own Echo type)
// so these lines read as coming from the same emotional vocabulary as
// everything else pickSoloEcho already sorts into fear/sadness, even
// though they're drawn as a flat override rather than through the
// catalyst/LINE_BANK machinery those two echoes normally index into.
export type NeedsFlavorEntry = { echo: Echo; lines: readonly [string, string] };

export const NEEDS_FLAVOR_BANK: Record<NeedKind, NeedsFlavorEntry> = {
  hunger: {
    echo: "sadness",
    lines: ["Haven't eaten since the last muster. Keep meaning to fix that.", "Rations later. If there's time."],
  },
  thirst: {
    echo: "sadness",
    lines: ["Throat's been dry for hours. Barely noticed until just now.", "Water's on the list. Not near the top of it."],
  },
  sleep: {
    echo: "fear",
    lines: ["Haven't really slept. Every time I close my eyes it's the last mission again.", "Running on fumes out here. Don't tell the CO."],
  },
};

// §4 — same mechanism shape as catalystProfile.ts's own AMBIENT_BLEED_CHANCE
// (a chance roll that substitutes an alternate line source instead of the
// primary catalyst's own bank) — a separate, distinctly-named constant even
// though it starts at the same value, since this is a different feature and
// isn't meant to drift together with that one just because they happen to
// agree today.
export const NEEDS_FLAVOR_CHANCE = 0.3;
