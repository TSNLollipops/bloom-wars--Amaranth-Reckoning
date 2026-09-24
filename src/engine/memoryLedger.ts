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
import { addMemory, MEMORY_BIRTH_WEIGHT, memorySalience, type MemoryEntry, type MemoryKind } from "../data/memories";
import { bankEcho, bankTotal, effectiveEchoLean, nudgeDrift, purgeBank, relaxDrift, type EchoWeights } from "../data/echoLean";
import { historyAdjustedLean, historyGains, spacingMultiplier } from "../data/dualProcess";
import type { Catalyst } from "../data/ambientLines";
import { catalystForPilot } from "../data/npcSeed";

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
  // The bank rides the same clock (22 Sep 2026). At ECHO_BANK_PURGE_PER_DAY
  // = 1.0 this is a copy; the field is only created once something has
  // actually been banked, so an untouched save stays untouched.
  if (social.echoBank) social.echoBank = purgeBank(social.echoBank, days);
  social.echoDriftDay = today;
  return relaxed;
}

/**
 * The read side of E (17 Sep 2026, dual-process threshold rule). Sums the
 * decayed weight of this pilot's memories per echo — the same
 * memorySalience curve everything else reads, so a memory's pull here and
 * its pull in the dossier never disagree — and applies the spacing factor:
 * a run of matching memories crammed into one bad week counts for less than
 * the same run spread over a season (data/dualProcess.ts's own comment for
 * why that direction, and not the other).
 *
 * Reads nothing but the ledger. Returns 0s for a pilot with no memories,
 * which is exactly a day-one pilot, which is exactly the old behaviour.
 */
export function echoHistoryWeight(social: HubPilotSocialState, today: number): Record<Echo, number> {
  const totals: Record<Echo, number> = { love: 0, fear: 0, anger: 0, sadness: 0 };
  const days: Record<Echo, number[]> = { love: [], fear: [], anger: [], sadness: [] };
  for (const entry of social.memories ?? []) {
    totals[entry.echo] += memorySalience(entry, today);
    days[entry.echo].push(entry.day);
  }
  for (const echo of Object.keys(totals) as Echo[]) totals[echo] *= spacingMultiplier(days[echo]);
  return totals;
}

/**
 * The echo lean Gate 3 should read for this pilot: their ordinary lean, bent
 * by what they carry (the ledger, via dual-process gains) and by what they
 * have become (the bank, 22 Sep 2026). Both call sites in the game
 * (scenes/Hub.ts idle pick, engine/debriefCatalyst.ts Debrief pick) come
 * through here, so the bank reaches both without either knowing about it.
 *
 * The bank is read twice here, deliberately, for two different things:
 * effectiveEchoLean bends WHICH echo leans heavier (what the pilot has
 * become), and historyGains uses it as sensitization's clock (whether a
 * long career has wound that echo up). The ledger is habituation's clock.
 * Two clocks, 22 Sep 2026 — data/dualProcess.ts's header.
 */
export function historyAdjustedEchoLean(catalyst: Catalyst, social: HubPilotSocialState, drift: EchoWeights, today: number): EchoWeights {
  const bank = social.echoBank ?? {};
  return historyAdjustedLean(effectiveEchoLean(catalyst, drift, social.echoBank), historyGains(catalyst, echoHistoryWeight(social, today), bank));
}

/**
 * Food-to-microorganism ratio, ported (22 Sep 2026, THE_FORMULA_Master_
 * Reference_v1 §11.3): recent experience over accumulated self. High means a
 * pilot is being hit with more than they have a self to absorb it with;
 * low means a heavy history and not much new coming in. A harness
 * diagnostic, not a game mechanic: nothing reads this but runBrainSim.ts.
 * Infinity for a pilot with recent memories and an empty bank; 0 for a
 * pilot with a bank and nothing recent; NaN never (returns 0 for 0/0).
 */
export function foodToMass(social: HubPilotSocialState, today: number, windowDays = 14): number {
  let food = 0;
  for (const entry of social.memories ?? []) {
    if (today - entry.day <= windowDays) food += memorySalience(entry, today);
  }
  const mass = bankTotal(social.echoBank);
  if (mass <= 0) return food > 0 ? Infinity : 0;
  return food / mass;
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
  /**
   * The pilot's catalyst, for the bank's establishment rate (data/echoLean.ts
   * bankRate). Optional: when absent, recordMemory looks it up from the
   * roster, so Hub writers that never knew about catalysts get the right
   * rate anyway. A pilot not on the roster banks at the neutral 1.0.
   */
  catalyst?: Catalyst;
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
  // The return line (22 Sep 2026): part of E goes back into B. Drift above
  // is the two-week version of the same idea; this one does not relax.
  // Nature filters what sticks: the animal's own lean row sets the rate.
  const roster = state.pilots[pilotId];
  const catalyst = input.catalyst ?? (roster ? catalystForPilot(pilotId, roster.pilot.background) : undefined);
  social.echoBank = bankEcho(social.echoBank, input.echo, weight, catalyst);
  return entry;
}
