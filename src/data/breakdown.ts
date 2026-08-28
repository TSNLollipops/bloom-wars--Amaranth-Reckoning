// src/data/breakdown.ts
// Breakdown — Social Sim Roadmap #16, rebuilt 28 Aug 2026 (Groups 3-5
// batch rebuild). SECOND rebuild the same session: the first pass built
// against an inferred design instead of the authoritative, already-
// Maxime-corrected spec sitting in claude/Bloom_Wars_Social_Sim_Roadmap_v1.md
// #16 and claude/Bloom_Wars_Master_Index.md's own "Group 5" account — both
// already read once this session before that first pass, but its most
// load-bearing details (Stress+Worried eligibility, not Morale; the
// spar/intimacy/sleep flavor model) didn't make it into the actual code.
// Caught before this reached Maxime, via this project's own standing
// discipline (Cross_Project_Writer_Note.md: verify against the actual
// current file/doc, don't trust memory) — re-read both docs directly
// before writing this version. Nothing here is ported from the first
// pass on purpose.
//
// Anger Blowup (angerBlowup.ts) and this file share one chain
// (claude_Bloom_Wars_Gate_Verification_Spec_v1.md §2): both read Stress
// specifically, not Morale — the real differentiator between the two
// events is the SECOND gating condition, not which meter they watch.
// Anger Blowup needs a live rivalry (bond <= RIVAL_THRESHOLD) sitting
// next to the panicking pilot. Breakdown needs AmbientPilotState.worried
// true instead — a live boolean (missionWorry.ts's own
// isMissionWorrySignal), true only while a mission is actively running
// and past its onset ramp, not a persisted magnitude sitting alongside
// Stress the way an earlier framing of the question implied. That's why
// this event can fire with nobody else around at all: the trigger isn't
// a rival in the room, it's a crewmate out on a mission the pilot can't
// stop worrying about while their own Stress is already redlining.
//
// Three-flavor resolution is the real design idea: WHERE a breakdown
// gets resolved, and by whom (if anyone), matters. "spar" — caught
// mid-crisis in the Spar Room, working it out physically, with the
// player or another idle pilot. "intimacy" — caught by a committed
// partner (player or NPC — Maxime's own correction: "anything player can
// do npc can as well") at Berths. "sleep" — nobody reached them in time;
// the pilot's own exhaustion resolves it alone, hours later, no
// relationship gain, nobody was there to earn one. Hub.ts owns deciding
// which flavor actually applies; this file only owns what each flavor
// says and the flat, unclamped relief/gain every non-sleep flavor shares
// (Maxime's own phrasing: "less stress more fav... same").
//
// src/data/** purity rule (Build Brief §5.2): pure math + content only.
import { STRESS_PANIC_THRESHOLD } from "./ambientLines";

// Eligibility needs BOTH a panicking Stress level AND a live worry
// signal — Stress alone is Anger Blowup's own gate (paired with a
// rivalry instead), so gating on Stress alone here would make the two
// events indistinguishable whenever a panicking pilot also happens to
// have a rival nearby. Reuses the same STRESS_PANIC_THRESHOLD (70) Anger
// Blowup itself reads, not a second invented cutoff — Maxime's own
// "both need to be high" resolves to this once Worry's real shape (a
// live boolean, not a second magnitude) is accounted for.
export function isBreakdownEligible(stress: number, worried: boolean): boolean {
  return stress >= STRESS_PANIC_THRESHOLD && worried;
}

// Hub.ts rolls against this once eligibility is confirmed — same shape
// AND same value as angerBlowup.ts's own ANGER_BLOWUP_CHANCE (0.35), not
// a lower "rarer event" number invented by analogy.
export const BREAKDOWN_CHANCE = 0.35;

// Stress relief on resolution — same magnitude as angerBlowup.ts's own
// ANGER_BLOWUP_STRESS_RELIEF, applied via applyBreakdownStressRelief
// below (clamped at the same 0 floor needsCounter.ts's own clampNeed
// enforces). Not a Morale gain — Morale never enters this file at all.
export const BREAKDOWN_STRESS_RELIEF = 25;

// Relationship gain on resolution — flat, single constant, identical
// across whichever of the three flavors actually resolved it (no
// per-flavor tiering). Applied UNCLAMPED — confirmed against the real
// codebase (Hub.ts: every `npc.favorability += delta` and
// `bonds[key] = bond + result.bondDelta` call site has no ceiling/floor
// anywhere), matching that established convention rather than inventing
// a clamped one for this event alone.
export const BREAKDOWN_FAVORABILITY_GAIN = 4;

// How long an unresolved breakdown sits before it resolves itself as
// "sleep" — 8 real minutes. Long enough that a genuinely present partner
// or a Spar Room session has real room to catch it first; short enough
// the player isn't watching one NPC sit frozen in crisis all session.
export const BREAKDOWN_SLEEP_TIMEOUT_MS = 8 * 60 * 1000;

export type BreakdownFlavor = "spar" | "intimacy" | "sleep";

// Stress relief, same clamp shape as angerBlowup.ts's own
// applyAngerBlowupStressRelief — floor 0, no ceiling needed since this
// only ever subtracts.
export function applyBreakdownStressRelief(stress: number): number {
  return Math.max(0, stress - BREAKDOWN_STRESS_RELIEF);
}

// Onset — what's visible the moment a breakdown starts, before Hub.ts
// knows which of the three flavors will end up resolving it (or whether
// any of the first two ever will, versus running out the sleep timer).
export const BREAKDOWN_ONSET_LINES: string[] = [
  "Something gives. Not a scene, just — gone quiet, hands not quite steady.",
  "Sits down hard, back against the bulkhead, and doesn't get back up right away.",
  "Stops mid-sentence and doesn't finish it. Doesn't seem to notice.",
  "Everything's fine, everything's fine, everything is very clearly not fine.",
  "Just needs a minute. Says it like it's true.",
];

export function pickBreakdownOnsetLine(): string {
  return BREAKDOWN_ONSET_LINES[Math.floor(Math.random() * BREAKDOWN_ONSET_LINES.length)];
}

// Resolution — three flavors, keyed the same as BreakdownFlavor above.
// "spar" reads as physical, working it out through the body rather than
// talking about it — the ring doesn't ask questions. "intimacy" reads as
// real closeness already earned by that point in the relationship,
// whoever the partner actually is. "sleep" is the honest, harder one:
// nobody reached them, exhaustion just runs its course alone.
export const BREAKDOWN_RESOLUTION_LINES: Record<BreakdownFlavor, string[]> = {
  spar: [
    "Doesn't say a word about it. Just squares up and starts swinging, like the ring's the only place it makes sense right now.",
    "Works it out of their own hands one exchange at a time, same as any of them.",
    "Nobody's keeping score today. Just two pilots and a mat until the shaking stops.",
    "Comes off the mat winded and steadier than they walked in — not fixed, just further from the edge.",
    "Doesn't want to talk. The Spar Room doesn't ask them to.",
  ],
  intimacy: [
    "Doesn't say much. Just stays, and that's enough.",
    "Pulled in close, forehead to shoulder, until the shaking stops.",
    "\"I've got you.\" Two words. They land like a lot more than two words.",
    "No speech, no fixing anything — just present, for exactly as long as it takes.",
    "Whatever gets said afterward isn't the point. The staying was.",
  ],
  sleep: [
    "Rides it out alone. Eventually gets back up, steadier but not fixed.",
    "Nobody comes. Breathes through it anyway, on their own timeline.",
    "Whatever this was, it passes the way it came — quietly, and unwitnessed.",
    "Sleep does what nobody else got the chance to. Not the same. Still something.",
    "Wakes up hours later with no memory of drifting off, and no one to tell about it.",
  ],
};

export function pickBreakdownResolutionLine(flavor: BreakdownFlavor): string {
  const bank = BREAKDOWN_RESOLUTION_LINES[flavor];
  return bank[Math.floor(Math.random() * bank.length)];
}
