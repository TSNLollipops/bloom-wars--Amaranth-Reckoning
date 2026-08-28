// src/data/toxicPairs.ts
// Toxic Pairs — Social Sim Roadmap #15's other half, rebuilt 28 Aug 2026
// (Groups 3-5 batch rebuild, same provenance note as angerBlowup.ts's own
// header — third pass, written fresh against the actual current shape of
// npcBonds.ts rather than assumed from a lost prior copy).
//
// Anger Blowup (angerBlowup.ts) is the loud, occasional event. This is the
// quiet, constant background cost of two rivals sharing a hub at all —
// npcBonds.ts's own movement logic already has them physically drifting
// apart (pointAwayFrom); this file is the Stress-side consequence of not
// always managing to. A small ambient tick, deliberately much smaller than
// a blowup's own relief swing, so it reads as friction wearing someone
// down over time rather than a second copy of the same event.
//
// src/data/** purity rule (Build Brief §5.2): pure math only. Hub.ts owns
// when this runs (inside runNpcEncounter, alongside the existing
// simulateEncounter roll) and the actual persisted write.
import { RIVAL_THRESHOLD } from "./npcBonds";

// The raw tick amount for a given bond — 0 above RIVAL_THRESHOLD (not a
// real rivalry, no ambient cost at all), otherwise a scaling formula
// (round(2 + (RIVAL_THRESHOLD - bond) * 0.15)) rather than a flat
// number: a bond that's barely toxic (right at the threshold) should
// cost less per tick than one that's genuinely venomous, the same
// "worse bond, worse bite" scaling pilot_creator.html's own
// toxicFriction() sandbox precedent already used (Antfarm Carrier Hub
// §11's own illustrative curve: -16 -> 2, -50 -> ~7, -100 -> ~15) rather
// than the flat-2 the first rebuild pass invented. Exposed on its own
// (not just folded into applyToxicPairStressTick) so Hub.ts can check
// "did this pair actually generate a tick" separately from "what's their
// new Stress number" — useful for the social log same way
// angerBlowup.ts's eligibility check is separate from its relief math.
export function toxicPairStressTick(bond: number): number {
  return bond > RIVAL_THRESHOLD ? 0 : Math.round(2 + (RIVAL_THRESHOLD - bond) * 0.15);
}

// Applies one tick to `stress` for the given `bond`, clamped to the same
// 0-100 range every other Stress/Morale number in the game uses
// (needsCounter.ts's own clampNeed). A non-toxic bond returns `stress`
// unchanged.
export function applyToxicPairStressTick(stress: number, bond: number): number {
  return Math.max(0, Math.min(100, stress + toxicPairStressTick(bond)));
}
