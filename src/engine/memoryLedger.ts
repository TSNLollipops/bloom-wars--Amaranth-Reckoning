// src/engine/memoryLedger.ts
// Emotional Brain, 12 Sep 2026 — the one place a memory gets written into a
// pilot's persisted ledger (HubPilotSocialState.memories, campaignState.ts
// §11), with the two side effects every write carries: the pilot's echo
// drift gets nudged toward the memory's echo (data/echoLean.ts), and the
// drift is first relaxed by however many in-game days have passed since it
// was last touched. Debrief (engine/debriefCatalyst.ts) and the Hub
// (scenes/Hub.ts: blowup, breakdown, the verbs that leave a mark) both go
// through recordMemory so neither can forget the drift half.
//
// Also the home of the "what social state does a pilot start with" lookup
// (socialSeedFor) that Debrief needs: engine/griefCatalyst.ts used to seed a
// never-before-seen pilot at {0, 0, 0}, which on a loss before the first Hub
// visit would have left a survivor at Morale 0 for good (Hub.ts's own
// buildNpcs() only seeds a pilot the FIRST time it sees them, and never
// re-seeds). The seed now comes from the facility profile's own regulars
// (Bosk 30/75, Anand 58/60 — down from 78, 13 Sep 2026 — ...) or the Hub's generic recruit triple, the
// exact values buildNpcs() would have used, so it no longer matters which
// screen meets a pilot first.
import type { CampaignState, HubPilotSocialState } from "./campaignState";
import { baseSceneKeyFor, ensureHubSocialState } from "./campaignState";
import { currentDay } from "./calendarClock";
import { WARDEN_FACILITY } from "./facilityWarden";
import { HOUSE_AMARANTH_FACILITY } from "./facilityHouseAmaranth";
import type { Echo } from "../data/ambientLines";
import { addMemory, MEMORY_BIRTH_WEIGHT, type MemoryEntry, type MemoryKind } from "../data/memories";
import { nudgeDrift, relaxDrift, type EchoWeights } from "../data/echoLean";

export interface SocialSeed {
  favorability: number;
  stress: number;
  morale: number;
}

/** Hub.ts's own "no hand-authored row yet" triple, verbatim (buildNpcs(), Tier 3, 30 Aug 2026). */
export const GENERIC_SOCIAL_SEED: SocialSeed = { favorability: 0, stress: 10, morale: 70 };

/** The starting Favorability/Stress/Morale for `pilotId` on this save's facility, exactly as Hub.ts's buildNpcs() would seed them. */
export function socialSeedFor(state: CampaignState, pilotId: string): SocialSeed {
  const profile = baseSceneKeyFor(state) === "HubHouseAmaranth" ? HOUSE_AMARANTH_FACILITY : WARDEN_FACILITY;
  const regular = profile.regulars.find((r) => r.pilotId === pilotId);
  return regular ? { favorability: regular.favorability, stress: regular.stress, morale: regular.morale } : { ...GENERIC_SOCIAL_SEED };
}

/** ensureHubSocialState with the right seed for this save, so Debrief and the Hub agree on where a pilot starts. */
export function socialStateFor(state: CampaignState, pilotId: string): HubPilotSocialState {
  return ensureHubSocialState(state, pilotId, socialSeedFor(state, pilotId));
}

/**
 * Relax a pilot's drift by the in-game days since it was last touched, and
 * stamp today. Idempotent within a day. Returns the relaxed vector (also
 * written back). Called by recordMemory; exported for the harness printout.
 */
export function settleDrift(social: HubPilotSocialState, today: number): EchoWeights {
  const last = social.echoDriftDay;
  const days = last === undefined ? 0 : Math.max(0, today - last);
  const relaxed = relaxDrift(social.echoDrift, days);
  social.echoDrift = relaxed;
  social.echoDriftDay = today;
  return relaxed;
}

export interface RecordMemoryInput {
  kind: MemoryKind;
  echo: Echo;
  about?: string[];
  witnesses?: string[];
  missionId?: string;
  /** Override the kind's birth weight (a repair scaled by amount, say). Clamped 0..1. */
  weight?: number;
  /** Epoch ms; defaults to Date.now(). Passed explicitly by the harness so a replay is byte-identical. */
  now?: number;
  /** In-game day; defaults to currentDay(state). */
  today?: number;
}

/**
 * Write one memory into `pilotId`'s ledger and nudge their drift. The
 * pilot's social state is created with the facility's own seed if this is
 * the first time anything has touched them. Returns the entry written.
 */
export function recordMemory(state: CampaignState, pilotId: string, input: RecordMemoryInput): MemoryEntry {
  const social = socialStateFor(state, pilotId);
  const today = input.today ?? currentDay(state);
  const weight = Math.max(0, Math.min(1, input.weight ?? MEMORY_BIRTH_WEIGHT[input.kind]));
  const entry: MemoryEntry = {
    kind: input.kind,
    at: input.now ?? Date.now(),
    day: today,
    missionId: input.missionId,
    about: [...(input.about ?? [])],
    witnesses: [...(input.witnesses ?? [])].filter((id) => id !== pilotId),
    echo: input.echo,
    weight,
  };
  social.memories = addMemory(social.memories, entry, today);
  settleDrift(social, today);
  social.echoDrift = nudgeDrift(social.echoDrift, input.echo, weight);
  return entry;
}
