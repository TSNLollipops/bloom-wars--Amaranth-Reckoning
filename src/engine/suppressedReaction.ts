// src/engine/suppressedReaction.ts
// Gate 4's write side, 14 Sep 2026 — Bloom_Wars_Reaction_Formula_v2_Locked_14Sep2026.md.
//
// data/reactionGate4.ts decides whether the room left a reaction available.
// This file is what happens next: it turns that verdict into a real ledger
// entry, a real Worry, or a held reaction, and it lives in engine/ rather than
// data/ for one concrete reason — it needs CampaignState and the calendar, and
// data/** is not allowed either (Build Brief §5.2).
//
// WHY THIS IS NOT A PURE data/ HELPER, stated plainly because the first draft
// of this piece was exactly that and it was wrong. A pure version builds a
// MemoryEntry by hand (kind, at, day, about, witnesses, echo, weight) and
// hands it back for a caller to push onto the list. That skips
// engine/memoryLedger.ts's recordMemory, and recordMemory is not a thin
// wrapper: it also relaxes the pilot's echo drift by the days elapsed and
// then nudges it toward the memory's echo (data/echoLean.ts). A memory
// written around it lands in the ledger and moves nothing.
//
// The failure that causes is quiet and exactly backwards. A pilot who
// swallows their temper twenty times in front of you would accumulate twenty
// `suppressed_anger_impulse` entries and drift no angrier at all, because
// nothing nudged them. Held anger that changes nobody is the one outcome the
// audience gate exists to rule out. So: every write here goes through
// recordMemory, no exceptions.
//
// WHAT THIS FILE OWNS AND WHAT IT HANDS BACK. Memories are persisted
// (HubPilotSocialState.memories, campaignState §11) so this writes them
// directly. Worries are scene-owned and unpersisted (HubNpc.worries, gone on
// reload by design — data/worries.ts's own header), and so is the deferral
// cache, so those come back as return values for the scene to assign. That
// split is not tidiness, it is the same persisted/ephemeral line the Worries
// system already draws.

import type { CampaignState } from "./campaignState";
import { recordMemory } from "./memoryLedger";
import type { Echo, Catalyst } from "../data/ambientLines";
import type { Gate4Suppression, Gate4Reason } from "../data/reactionGate4";
import type { MemoryEntry } from "../data/memories";
import type { WorryEntry } from "../data/worries";

/**
 * A reaction the room deferred rather than cancelled. Held until the pilot is
 * alone or with one bonded pilot, then fired for real.
 *
 * Only the sadness row produces one of these today. `lineText` is the line
 * that would have been spoken at the time, kept so the deferred beat reads as
 * the same thought surfacing later rather than a fresh unrelated one.
 */
export interface DeferredReaction {
  echo: Echo;
  lineText: string;
  /** Who it was about, when it was about anyone. */
  about: string[];
  reason: Gate4Reason;
  /** Epoch ms the reaction was held. Ordering, and a debug read on how long something sat. */
  heldAt: number;
}

/**
 * What a suppression produced. The memory (if any) is already written; the
 * worry and the deferral are for the caller to store.
 */
export interface SuppressionOutcome {
  memory?: MemoryEntry;
  worry?: WorryEntry;
  deferred?: DeferredReaction;
}

/**
 * Peak intensity a fresh suppression Worry is born at, and how long it takes
 * to fade to nothing.
 *
 * Placeholders in this project's usual sense — picked with reasoning, owed a
 * `npm run sim:brain` pass and a real playtest, expected to move. The
 * reasoning that picked them, so a retune is an argument rather than a guess:
 *
 * PEAK is deliberately well under 1.0, and that ceiling matters more than it
 * looks. data/ambientLines.ts's pickSoloEcho rolls `rng() < topWorry.intensity`
 * and returns fear on a hit, ahead of the pilot's own echo lean. A worry
 * sitting at 1.0 does not make a pilot seem worried, it overwrites their
 * personality with fear every single time they open their mouth until it
 * expires. 0.45 means it colours roughly half their lines while it is loud,
 * and less as it fades, which reads as preoccupied rather than replaced.
 *
 * WINDOW is real elapsed time, not in-game days, because that is the clock
 * Worries run on (data/worries.ts's own two-clocks resolution, checked twice
 * and settled as Option 2). Twelve minutes is sized against a hub visit, not
 * a campaign: the point is that it is still on the pilot's mind for the rest
 * of the time you are in the room with them, and gone by the time you come
 * back from a mission.
 */
export const SUPPRESSION_WORRY_PEAK = 0.45;
export const SUPPRESSION_WORRY_WINDOW_MS = 12 * 60 * 1000;

/**
 * How loud a suppression Worry is right now: linear falloff from
 * SUPPRESSION_WORRY_PEAK at birth to zero at expiry.
 *
 * data/worries.ts never reads a clock itself, by design — it is handed a fresh
 * intensity by whoever owns a given source's timing, and for these two sources
 * that owner is this file. The scene calls this on its own refresh tick and
 * upserts the result, the same shape Hub.ts's updateMissionWorry already uses
 * for mission_pilot_missing.
 *
 * Linear rather than exponential on purpose: an exponential tail leaves a
 * worry technically alive at 0.02 for a long time, which does nothing visible
 * but still occupies one of the four WORRIES_STACK_CAP slots. Linear reaches
 * actual zero and gets out of the way.
 */
export function suppressionWorryIntensity(entry: WorryEntry, now: number): number {
  const span = entry.expiresAt - entry.bornAt;
  if (span <= 0) return 0;
  const remaining = (entry.expiresAt - now) / span;
  return Math.max(0, Math.min(1, remaining)) * SUPPRESSION_WORRY_PEAK;
}

export interface ApplySuppressionInput {
  /** The pilot whose reaction was blocked. */
  pilotId: string;
  /** Their animal tag, for the Worry's catalyst field. */
  catalyst: Catalyst;
  /** The echo that was blocked. */
  echo: Echo;
  /** The line they would have said, kept for a deferral to fire later. */
  lineText: string;
  /** Who was in the room. Passed straight to the memory; recordMemory filters the reactor out itself. */
  witnesses: string[];
  /** Epoch ms. Injectable so a harness replay is byte-identical, same as recordMemory's own `now`. */
  now?: number;
}

/**
 * Apply one Gate 4 suppression.
 *
 * Writes the ledger entry when the verdict calls for one, and returns the
 * Worry and the deferral for the scene to store. Safe to call for any
 * suppression: every field on the verdict is optional and a row that produces
 * nothing simply returns an empty outcome.
 */
export function applySuppression(
  state: CampaignState,
  suppression: Gate4Suppression,
  input: ApplySuppressionInput
): SuppressionOutcome {
  const now = input.now ?? Date.now();
  const outcome: SuppressionOutcome = {};

  // The ledger half. Weight is deliberately not passed: recordMemory looks it
  // up from MEMORY_BIRTH_WEIGHT, where suppressed_anger_impulse already
  // carries its own 1.5x (derived there from BLOWUP_BIRTH_WEIGHT). Passing a
  // computed weight here would be the second copy of that number.
  if (suppression.memoryKind !== undefined) {
    outcome.memory = recordMemory(state, input.pilotId, {
      kind: suppression.memoryKind,
      echo: input.echo,
      about: suppression.worry ? [suppression.worry.about] : [],
      witnesses: input.witnesses,
      now,
    });
  }

  // The Worry half. Returned rather than written: HubNpc.worries is scene-owned
  // and unpersisted, so this file has nothing to write it onto.
  if (suppression.worry !== undefined) {
    outcome.worry = {
      source: suppression.worry.source,
      catalyst: input.catalyst,
      intensity: SUPPRESSION_WORRY_PEAK,
      context: "hub",
      bornAt: now,
      expiresAt: now + SUPPRESSION_WORRY_WINDOW_MS,
      about: suppression.worry.about,
    };
  }

  // The deferral half. Also scene-owned: a held reaction that survived a
  // reload would fire into a room that no longer exists.
  if (suppression.deferred === true) {
    outcome.deferred = {
      echo: input.echo,
      lineText: input.lineText,
      about: suppression.worry ? [suppression.worry.about] : [],
      reason: suppression.reason,
      heldAt: now,
    };
  }

  return outcome;
}

/**
 * Has the room thinned out enough for a held reaction to fire?
 *
 * The table's own condition for the sadness row, verbatim: "fires next time
 * the pilot is alone or with exactly one bonded pilot." Both halves matter —
 * one stranger in the room is not privacy, and one friend is.
 */
export function deferralCanFire(nearbyPilotIds: string[], bondedPilotIds: string[]): boolean {
  if (nearbyPilotIds.length === 0) return true;
  if (nearbyPilotIds.length === 1) return bondedPilotIds.includes(nearbyPilotIds[0]);
  return false;
}
