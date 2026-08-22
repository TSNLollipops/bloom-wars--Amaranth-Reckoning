// src/data/pilotRegistry.ts
// A single lookup surface over every pilot/mek source in the project: Team
// One's slice roster and bench (data/meks.ts's PILOTS/MEKS and
// ROSTER_DEPTH_PILOTS/ROSTER_DEPTH_MEKS) plus Warden Company
// (data/campaignAmaranth.ts's WARDEN_PILOTS/WARDEN_MEKS). engine/units.ts
// and engine/mission.ts look pilots and meks up through here instead of
// importing PILOTS/MEKS directly, so a second campaign's roster resolves
// without either engine file needing to know it exists. Mirrors the
// fallback `MEKS[mekId] ?? ROSTER_DEPTH_MEKS[mekId]` pattern that already
// existed in engine/units.ts for the bench roster — this just extends the
// same idea to a third (fourth, ...) source instead of hand-chaining more
// `??`s at every call site.
import type { MekArchetype, PilotRecord } from "./types";
import { PILOTS, MEKS, ROSTER_DEPTH_PILOTS, ROSTER_DEPTH_MEKS } from "./meks";
import { WARDEN_PILOTS, WARDEN_MEKS } from "./campaignAmaranth";

const PILOT_INDEX: Record<string, PilotRecord> = Object.fromEntries(
  [...PILOTS, ...ROSTER_DEPTH_PILOTS, ...WARDEN_PILOTS].map((p) => [p.id, p])
);

const MEK_INDEX: Record<string, MekArchetype> = {
  ...MEKS,
  ...ROSTER_DEPTH_MEKS,
  ...WARDEN_MEKS,
};

export function findPilot(pilotId: string | undefined): PilotRecord | undefined {
  if (!pilotId) return undefined;
  return PILOT_INDEX[pilotId];
}

export function findMek(mekId: string | undefined): MekArchetype | undefined {
  if (!mekId) return undefined;
  return MEK_INDEX[mekId];
}
