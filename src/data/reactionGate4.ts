// src/data/reactionGate4.ts
// Reaction Formula v2, Gate 4 — Bloom_Wars_Reaction_Formula_v2_Locked_14Sep2026.md
//
// Gate 4: Self vs. environment — "Given witnesses and standing, which of my
// usual moves are even available?" When a reaction's normal output is
// suppressed by rank, witnesses, or standing, the reaction does not vanish.
// It is written to memory at a heavier weight, and (when it has a target) it
// also becomes a Worry.
//
// The four rows of that document's own Gate 4 table, and what each produces:
//
//   anger, authority in the room      -> memory (1.5x) AND a Worry about the target
//   sadness, more than two witnesses  -> deferred, fires when alone or with one bonded
//   love/ask-out, rival in the room   -> a Worry about the rival, plus a ledger mark
//   any echo, struck / off-roster     -> memory only, normal weight        [NOT BUILT]
//
// src/data/** purity rule (Build Brief §5.2): this file decides, it never
// writes. It reads no engine state, holds no clock, and returns a plain
// verdict. Turning that verdict into a real ledger entry is engine-side, in
// engine/suppressedReaction.ts, which goes through memoryLedger's recordMemory
// so a suppressed reaction nudges echo drift exactly like every other memory.
//
// WHO FILLS IN THE SCENE. This file does not decide what "authority" means —
// it is handed a list. scenes/Hub.ts passes the player's own pilot id when the
// player is standing in the room, which is the whole of the rule as of
// 14 Sep 2026: your pilots swallow it while you are watching. Keeping that
// judgement at the call site is what lets a real chain-of-command table
// replace it later without this file changing at all.

import type { Echo, AmbientPilotState } from "./ambientLines";
import type { MemoryKind } from "./memories";
import type { WorrySourceId } from "./worries";

export type Standing = "full" | "restricted" | "struck";

/**
 * Metadata about a scene context — who's around, what's their relationship to the reactor
 */
export interface SceneContext {
  /** Pilot IDs currently in the same room/area, excluding the reactor themselves. */
  nearbyPilotIds: string[];
  /** The target of this reaction, if any (e.g., who is this anger directed at?) */
  targetPilotId?: string;
  /** Pilot IDs this reactor is bonded with (at any strength) */
  bondedPilotIds: string[];
  /** Pilot IDs considered rivals/enemies of the reactor */
  rivalPilotIds: string[];
  /** Whoever counts as authority over the reactor and is present right now. Hub.ts passes the player when the player is in the room. */
  authorityPilotIds: string[];
}

/**
 * The reactor's standing/capacity in this moment
 * - full: can do anything
 * - restricted: grounded/limited but present
 * - struck: off-roster, can't act at all
 *
 * Stub. Nothing in the engine writes a standing yet, so the Matter-ladder row
 * of the Gate 4 table is deliberately unbuilt rather than half-built against
 * invented data — see gate4Check's own note where that row would go. The
 * parameter is named `_rank` because it is genuinely unread, not because the
 * signature is provisional: the eventual implementation needs it.
 */
export function standingFromRank(_rank: "2Lt" | "Capt" | "Maj"): Standing {
  return "full";
}

/** Which row of the Gate 4 table fired. Carried through to the deferral cache and the debug log. */
export type Gate4Reason = "anger_authority_present" | "sadness_too_many_witnesses" | "askout_rival_present";

/**
 * Suppression result — tells the caller what this blocked reaction produces.
 *
 * Reshaped 14 Sep 2026, and the reason is worth stating because the previous
 * shape looked reasonable and could not express the headline case. It was a
 * three-way union on a `route` field: "memory" OR "worry" OR "deferred". But
 * the formula document's own first row is BOTH — "the blowup memory writes at
 * roughly 1.5x normal weight, a Worry about the target opens." A single route
 * has to drop one half of a spec line that has two halves, silently, with the
 * type system agreeing it is fine.
 *
 * So the three routes become three independent optional outputs. A suppression
 * says what it produces, however many things that is, and a caller that
 * handles all three fields correctly handles all four table rows without
 * knowing which one it is looking at.
 *
 * A DISCRIMINATED UNION, ON PURPOSE, AND CHECKED. `{ allowed: true } |
 * Gate4Suppression` means a caller that writes `if (!r.allowed)` gets a
 * Gate4Suppression on the other side, with `reason` guaranteed present and
 * the three optional outputs typed. That guarantee is only real when
 * strictNullChecks is on, which it is here: package.json pins typescript
 * ~6.0, and TypeScript 6 made `strict` the default, so tsconfig.json not
 * mentioning it means ON, not off.
 *
 * Recorded because it was got wrong once. An earlier draft of this file
 * flattened the type to `allowed: boolean` plus optionals, on the strength of
 * a sandbox that happened to be running TypeScript 5 — where strict defaults
 * OFF and the union genuinely does not narrow. The flattened shape then failed
 * the real build in engine/suppressedReaction.ts with "Gate4Reason |
 * undefined is not assignable to Gate4Reason", which is strictNullChecks
 * talking. The lesson is about toolchains, not types: check `npx tsc -v`
 * against package.json before trusting what a sandbox says about narrowing.
 *
 * `memoryKind` carries no weight of its own on purpose: the 1.5x multiplier
 * lives in data/memories.ts's own MEMORY_BIRTH_WEIGHT table (derived there
 * from BLOWUP_BIRTH_WEIGHT, so it tracks retunes), and recordMemory looks it
 * up from the kind. One number, one home.
 */
export interface Gate4Suppression {
  allowed: false;
  /** Which row of the table fired. */
  reason: Gate4Reason;
  /** Write this kind into the reactor's ledger. Absent when the row leaves no ledger mark. */
  memoryKind?: MemoryKind;
  /** Open a Worry on the reactor, about `about`. Absent when the row opens none. */
  worry?: { source: WorrySourceId; about: string };
  /** Hold the reaction and fire it once the room clears. Absent when the row is not a deferral. */
  deferred?: boolean;
}

export type Gate4Result = { allowed: true } | Gate4Suppression;

/** More than two witnesses, per the table's own wording. Three or more other pilots in the room. */
export const SADNESS_WITNESS_LIMIT = 2;

/**
 * Gate 4: check if this reaction's normal output is available given scene conditions
 *
 * @param _pilot The reacting pilot's current state. Unread by the three rows
 *   built so far, all of which are reads of the ROOM rather than of the pilot,
 *   and underscored for tsconfig's noUnusedParameters. Kept in the signature
 *   rather than dropped because the unbuilt struck/off-roster row is a read of
 *   the pilot and nothing else, so the eventual fourth row needs it and every
 *   existing call site would otherwise have to change to get it back.
 * @param echo The emotion driving the reaction (love/fear/anger/sadness)
 * @param scene The surrounding scene context (witnesses, targets, authority)
 * @returns Suppression verdict
 */
export function gate4Check(_pilot: AmbientPilotState, echo: Echo, scene: SceneContext): Gate4Result {
  // Matter pillar, the struck / off-roster row: NOT BUILT. It would sit here,
  // ahead of everything else, because a pilot who cannot act at all cannot act
  // on any echo. It stays out because standingFromRank above is a stub with no
  // writer anywhere in the engine, and a row keyed off invented data would
  // fire on nothing or on everything with no way to tell which.

  // Anger with authority in the room. Produces both halves of the table's
  // first row: the ledger mark at 1.5x, and a Worry about whoever it was
  // aimed at.
  if (echo === "anger" && scene.targetPilotId && scene.authorityPilotIds.length > 0) {
    return {
      allowed: false,
      reason: "anger_authority_present",
      memoryKind: "suppressed_anger_impulse",
      worry: { source: "hub_suppressed_anger", about: scene.targetPilotId },
    };
  }

  // Sadness with more than two witnesses. Deferred, not suppressed — it still
  // fires, later, when the room has thinned out, and writes an ordinary
  // `breakdown` entry at that point. No memoryKind here for exactly that
  // reason: a mark now plus the real breakdown later would be one event
  // counted twice (see data/memories.ts's MemoryKind comment).
  if (echo === "sadness" && scene.nearbyPilotIds.length > SADNESS_WITNESS_LIMIT) {
    return {
      allowed: false,
      reason: "sadness_too_many_witnesses",
      deferred: true,
    };
  }

  // Love with the rival actually present. rivalPilotIds is the reactor's whole
  // rival list, which is not the same question as "is one of them standing
  // here" — so this intersects it against the room before firing.
  if (echo === "love" && scene.targetPilotId) {
    const rivalInRoom = scene.nearbyPilotIds.find((id) => scene.rivalPilotIds.includes(id));
    if (rivalInRoom !== undefined) {
      return {
        allowed: false,
        reason: "askout_rival_present",
        memoryKind: "suppressed_askout_rival",
        worry: { source: "hub_suppressed_askout", about: rivalInRoom },
      };
    }
  }

  // No suppression conditions triggered
  return { allowed: true };
}
