// src/data/angerBlowup.ts
// Anger Blowup — Social Sim Roadmap #15, rebuilt 28 Aug 2026 (the Groups
// 3-5 batch rebuild — see claude/Bloom_Wars_Master_Index.md's "Batch
// rebuild from lost sandbox" entry and Bloom_Wars_Social_Sim_Roadmap_v1.md
// #15 for the full spec this file implements). Two prior builds of this
// exact file existed and were verified clean, both lost before reaching
// the real device — this is the third pass, written fresh against the
// actual current shape of npcBonds.ts and ambientLines.ts rather than
// assumed from either lost copy.
//
// This is also the missing reaction half of the Gate Verification chain
// (claude_Bloom_Wars_Gate_Verification_Spec_v1.md §2): needs feed Stress
// (needsCounter.ts, already live and unaffected by this file). Once a real
// rivalry (npcBonds.ts's RIVAL_THRESHOLD) sits next to a pilot running hot
// on Stress (ambientLines.ts's STRESS_PANIC_THRESHOLD), that's a blowup
// waiting to happen — not scripted, just two numbers that are already
// tracked for other reasons crossing paths.
//
// Deliberately narrow, src/data/** purity rule (Build Brief §5.2): this
// file only decides eligibility, content, and the stress/bond math. Hub.ts
// owns the roll (ANGER_BLOWUP_CHANCE), when to check it, and persisting
// the result — same split needsCounter.ts and Hub.ts's updateNeeds()
// already use.
import { RIVAL_THRESHOLD } from "./npcBonds";
import { STRESS_PANIC_THRESHOLD } from "./ambientLines";

// How much further a blowup pushes an already-bad bond. Not a reset to
// zero — two people who already can't stand each other get worse, on top
// of whatever put them at RIVAL_THRESHOLD in the first place.
export const ANGER_BLOWUP_BOND_DELTA = -15;

// What a blowup actually buys the pilot who was running hot: real relief,
// not a full reset — it's venting, not therapy.
export const ANGER_BLOWUP_STRESS_RELIEF = 25;

// Hub.ts rolls against this once eligibility is confirmed. Not every
// eligible tick blows up — most of the time two rivals under stress just
// avoid each other instead (see Hub.ts's existing drift-apart roaming
// behavior, npcBonds.ts's pointAwayFrom).
export const ANGER_BLOWUP_CHANCE = 0.35;

/**
 * True once a bond is bad enough (at or below npcBonds.ts's own
 * RIVAL_THRESHOLD — a "rival" here is the same rival Hub.ts's
 * npcRivalLabel and the Recall {RIVAL} slot already use, not a separate,
 * looser threshold invented just for this event) AND at least one side is
 * stressed enough for a blowup to be plausible. Either pilot's Stress can
 * trip it — doesn't take both of them running hot, just one person with a
 * short fuse and a rival standing nearby.
 */
export function isAngerBlowupEligible(bond: number, stressA: number, stressB: number): boolean {
  return bond <= RIVAL_THRESHOLD && (stressA >= STRESS_PANIC_THRESHOLD || stressB >= STRESS_PANIC_THRESHOLD);
}

// Floored at 0 — Stress is never negative, same convention needsCounter.ts's
// own clamps use.
export function applyAngerBlowupStressRelief(stress: number): number {
  return Math.max(0, stress - ANGER_BLOWUP_STRESS_RELIEF);
}

export interface AngerBlowupExchange {
  lineA: string;
  lineB: string;
}

// Five exchanges, generic rather than catalyst-specific — same "generic
// first" content-bank scope call every other first-slice content bank this
// session made (hot topics, friction, relationship stages). Which pilot is
// "A" and which is "B" doesn't matter mechanically; Hub.ts assigns real
// names to each side when it renders one of these into the social log.
export const ANGER_BLOWUP_EXCHANGES: AngerBlowupExchange[] = [
  { lineA: "You've been on my back for weeks. I'm done pretending it's fine.", lineB: "Maybe if you pulled your weight I'd have nothing to say." },
  { lineA: "Say that again. I dare you.", lineB: "I said it once. You heard me." },
  { lineA: "I'm not doing this with you right now.", lineB: "You never do. That's the problem." },
  { lineA: "Every time. Every single time, it's something with you.", lineB: "Then stop looking for it." },
  { lineA: "You want a fight? Fine, let's have it.", lineB: "Don't. Just — don't." },
];

export function pickAngerBlowupExchange(): AngerBlowupExchange {
  return ANGER_BLOWUP_EXCHANGES[Math.floor(Math.random() * ANGER_BLOWUP_EXCHANGES.length)];
}
