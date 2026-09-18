// src/engine/pillars.ts
// Reaction Engine Slice 1, engine half (17 Sep 2026). data/pillars.ts says
// what a ring or a rung is worth; this file answers which one a real pilot
// is standing on, reading the campaign the same way every other engine
// module does (roster status, lance, the pairwise bond table).
//
// Nothing here writes. It reads state and returns numbers.
import type { CampaignState } from "./campaignState";
import { lanceOfPilotIn } from "./campaignState";
import { pairKey, CLIQUE_THRESHOLD } from "../data/npcBonds";
import {
  MATTER_RUNG_WEIGHT,
  TIME_LIVE,
  VOLUME_RING_WEIGHT,
  pillarWeight,
  timeWeightForAge,
  type PillarReading,
  type VolumeRing,
} from "../data/pillars";

/**
 * Which ring `aboutId` sits in, from `pilotId`'s point of view.
 *
 *   self     — it happened to them
 *   bonded   — a real bond (the same CLIQUE_THRESHOLD the Hub already calls a clique)
 *   lance    — same lance, no particular closeness
 *   company  — on the roster somewhere
 *   stranger — a name they know of
 *   world    — no person involved at all (a mission's own outcome)
 */
export function volumeRingFor(state: CampaignState, pilotId: string, aboutId?: string): VolumeRing {
  if (!aboutId) return "world";
  if (aboutId === pilotId) return "self";
  const bond = state.npcSocial?.bonds?.[pairKey(pilotId, aboutId)] ?? 0;
  if (bond >= CLIQUE_THRESHOLD) return "bonded";
  if (state.pilots[aboutId] && state.pilots[pilotId] && lanceOfPilotIn(state, aboutId) === lanceOfPilotIn(state, pilotId)) return "lance";
  if (state.pilots[aboutId]) return "company";
  return "stranger";
}

/**
 * The agency rung for `pilotId` right now. `inTheFight` is what separates a
 * pilot who was on the board from one who read about it afterwards — the
 * controllability half of the dual-process rule leans entirely on this.
 */
export function matterRungFor(state: CampaignState, pilotId: string, inTheFight: boolean): number {
  const entry = state.pilots[pilotId];
  const status = entry?.status;
  // PilotStatus is "active" | "permanently_lost" | "reassigned" | "discharged"
  // (engine/campaignState.ts). Gone for good is rung 0; off the roster but
  // alive is rung 1 — they could have acted, and didn't get to.
  if (!entry || status === "permanently_lost") return 0;
  if (status !== "active") return 1;
  if (!inTheFight) return 2;
  return entry.pilot.exemptFromPermadeath ? 4 : 3;
}

export interface ReactionWeightInput {
  /** Whose reaction this is. */
  pilotId: string;
  /** Who it was about, if anyone. Omitted for a mission's own outcome. */
  aboutId?: string;
  /** Was this pilot on the board when it happened? */
  inTheFight: boolean;
  /** In-game days since it happened. 0 (or omitted) means it is happening now. */
  daysAgo?: number;
}

export interface ReactionWeight extends PillarReading {
  ring: VolumeRing;
  rung: number;
  /** The single multiplier callers apply. */
  weight: number;
}

/** The three pillars for one reaction, plus the combined multiplier. */
export function reactionWeight(state: CampaignState, input: ReactionWeightInput): ReactionWeight {
  const ring = volumeRingFor(state, input.pilotId, input.aboutId);
  const rung = matterRungFor(state, input.pilotId, input.inTheFight);
  const reading: PillarReading = {
    time: input.daysAgo === undefined || input.daysAgo <= 0 ? TIME_LIVE : timeWeightForAge(input.daysAgo),
    volume: VOLUME_RING_WEIGHT[ring],
    matter: MATTER_RUNG_WEIGHT[Math.max(0, Math.min(MATTER_RUNG_WEIGHT.length - 1, rung))],
  };
  return { ...reading, ring, rung, weight: pillarWeight(reading) };
}
