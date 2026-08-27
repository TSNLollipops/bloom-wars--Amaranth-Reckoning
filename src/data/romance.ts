// src/data/romance.ts
// Phase 3, piece two — Ask Out / romance, per Build Plan §5's own line for
// this phase: "Ask Out and romance come online using the already-locked
// romanceable rules."
import type { Species } from "./types";
//
// The one real design fork here was already flagged, not newly invented:
// Bloom_Wars_Antfarm_Carrier_Hub_v1.md §13.3 left open whether romance is
// its OWN track (a second number per relationship) or Favorability at high
// standing plus a milestone flag on top of the same number the Hiopi/
// Carabil "close friend / bromance" ceiling already caps out at. That doc's
// own analysis favors the second reading — cheaper, one number instead of
// two, and consistent with "close friend / bromance" already being
// described as a real ceiling (implying romance is a FURTHER tier on the
// same scale, not a parallel one) — so that's the reading this file builds.
// Not re-litigated here; applying the call that doc already leaned toward.
//
// romanceable: false is the Hiopi/Carabil case specifically (Antfarm §13:
// "anything but Hiopi/Carabil, who cap out at close friend/bromance
// instead"). Correction, 26 Aug 2026: the comment that used to sit here
// claimed neither species was seeded into the Hub yet — wrong. Pvt. Tegan
// Iyari (data/campaignAmaranth.ts's WARDEN_PILOTS) is arch_meeps_centauroid,
// which units.ts's own UNIT_ARCHETYPES marks species: "hiopi" — she was live
// in the Hub with romanceable hardcoded true the whole time Phase 3 shipped,
// a real miss (Hub.ts set `romanceable: true` for all three seeded NPCs by
// hand instead of deriving it from the species already sitting one file
// away). Fixed the same day it was caught: isRomanceableSpecies() below is
// the real, data-driven check — species: "hiopi" caps at close-friend/
// bromance, everything else stays open — and Hub.ts's buildNpcs() now calls
// it off the real WARDEN_PILOTS/UNIT_ARCHETYPES lookup instead of a
// hand-set boolean that can silently drift from canon again. Carabil isn't
// in the Species union yet (data/types.ts) — no Carabil pilot exists in the
// Bloom Wars roster as of this writing — so it can't be listed below; add
// it to ROMANCE_CAPPED_SPECIES and the Species union together the moment
// one ever is.
export const ROMANCE_CAPPED_SPECIES: Species[] = ["hiopi"];

export function isRomanceableSpecies(species: Species): boolean {
  return !ROMANCE_CAPPED_SPECIES.includes(species);
}

// ROMANCE_MIN_FAVORABILITY and the two deltas below are placeholder
// numbers, same "not a locked number" caveat as every other Favorability
// touch in this scene (Hub.ts's own file header, darts/pegBoard/poker's
// win-loss swings) — picked to be a real, earned threshold (above every
// current NPC's seeded starting Favorability) rather than trivially
// reachable turn one, not claimed as tuned.
export const ROMANCE_MIN_FAVORABILITY = 50;
export const ROMANCE_ACCEPT_FAVORABILITY_DELTA = 15;
export const ROMANCE_REJECT_FAVORABILITY_DELTA = -8;

export type AskOutResult = "accepted" | "rejected" | "alreadyTogether" | "closeFriendOnly";

export interface AskOutOutcome {
  result: AskOutResult;
  favorabilityDelta: number;
}

export interface AskOutInput {
  favorability: number;
  romanceable: boolean;
  alreadyInRelationship: boolean;
}

// Pure decision function — Hub.ts calls this, then only handles bubbles/
// propagation/state-writes off the result. Same split as pegBoard/holdem/
// darts: the rules live here, testable without a Phaser scene; Hub.ts
// turns the answer into pixels and, for a rejection, a real rumor.
export function resolveAskOut(input: AskOutInput): AskOutOutcome {
  if (input.alreadyInRelationship) return { result: "alreadyTogether", favorabilityDelta: 0 };
  if (!input.romanceable) return { result: "closeFriendOnly", favorabilityDelta: 0 };
  if (input.favorability >= ROMANCE_MIN_FAVORABILITY) {
    return { result: "accepted", favorabilityDelta: ROMANCE_ACCEPT_FAVORABILITY_DELTA };
  }
  return { result: "rejected", favorabilityDelta: ROMANCE_REJECT_FAVORABILITY_DELTA };
}

// Small, catalyst-neutral line banks for the two outcomes that aren't
// already covered by the existing emotion echoes (accepted reuses a real
// "love" line, rejected reuses a real "sadness" line — both via
// ambientLines.ts's pickLineForMessage, same as everything else in this
// scene). These two are genuinely new response shapes with nothing to
// reuse: catalyst-neutral on purpose, same reasoning CHAT_FALLBACK_LINES
// and MUSTER_LINES already use for content that isn't a personality beat
// worth writing nine times over.
export const ALREADY_TOGETHER_LINES = [
  "Still counts as together, last I checked.",
  "You already have me. No second ask needed.",
  "Didn't we already do this part?",
  "Still yes. Ask me something new sometime.",
  "That's already settled, isn't it?",
];

export const CLOSE_FRIEND_ONLY_LINES = [
  "You're important to me. Just not like that.",
  "I care about you — this just isn't the shape it takes.",
  "That's not where this is going. Doesn't mean it means less.",
  "Close as it gets, just not that close.",
  "I'm not going there, but I'm not going anywhere either.",
];
