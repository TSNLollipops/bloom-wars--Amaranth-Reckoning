// src/data/combatWorry.ts
// Worries System, build order step 3, 10 Sep 2026 — the "mission.ts
// outcome classifier" Bloom_Wars_Worries_System_Proposal_v1.md's own build
// order names, and the combat bridge Bloom_Wars_NPC_Reaction_Engine_v1.md
// §4a already flagged a landing spot for. Quoting the proposal directly:
// "a classifier sitting one level down from the sim bot's own reasons —
// reading catalyst off the engine's own action outcomes directly, since
// those exist identically whether a human or the test bot triggered them."
//
// Pure, data-layer, no engine imports (src/data/** purity rule, Build
// Brief §5.2) — this never sees a BattleUnit. engine/mission.ts (the one
// real caller) does the BattleUnit -> CombatWorryEvent translation itself
// at each of its own real hook points, then hands the small event shape
// below to classifyCombatWorry() and pushes whatever comes back onto that
// pilot's own mission-scoped WorryEntry list (Mission.combatWorries — see
// that field's comment in mission.ts for the full wiring and for why
// "mission-scoped, cleared on mission end" needs no explicit clear call).
//
// Catalyst mapping — a placeholder call, same standing as Mission Worry's
// own "wolf" tag (worries.ts's header, and Bloom_Wars_Now_And_Next.md's
// "Needs Maxime's call" #3): reasoned from the existing 9-animal
// vocabulary's own established connotations (NPC_Reaction_Engine_v1.md §2:
// Wolf=teamwork, Dog=loyalty, Cat=selfishness, Crow=indulgence,
// Raven=instruction, Bear=isolation, Fox=trickery, Rabbit=nurturing,
// Shark=ambition) read through a combat lens, not a fresh design pass.
// Flagged explicitly as easy to override — these seven picks drive zero
// visible behavior today (same as Mission Worry's own catalyst tag:
// pickSoloEcho keys LINE_BANK content off the PILOT's own catalyst, never
// the WorryEntry's), so changing any of them later is a one-line edit with
// no downstream consequence to chase.
//
//   kill                    -> Shark   (ambition/finishing — ended it)
//   repair                  -> Dog     (loyalty/protection — the doc's own
//                                       worked example: "a Munti healing a
//                                       critical ally under fire reads as
//                                       Rabbit or Dog")
//   downed                  -> Rabbit  (the doc's other half of that same
//                                       example, given to the OWN pilot who
//                                       just got hit hard and dropped —
//                                       fear/vulnerability, not the healer)
//   permadeath, permanent   -> Raven   (instruction/omen register — the
//                                       heaviest possible reading, no
//                                       standing Munti left to save them)
//   permadeath, recoverable -> Fox     (trickery/a close call — survived a
//                                       downing that could have gone the
//                                       other way)
//   overwatch trigger       -> Wolf    (teamwork — held a position and
//                                       watched the squad's approach for
//                                       them; matches ambientLines.ts's own
//                                       wolf-bank precedent Mission Worry's
//                                       tag already leans on: "Sound off, I
//                                       need to hear every voice")
//   dodge                   -> Cat     (self-reliance — their own reflexes,
//                                       nobody else's, got them clear)
//
// Bear and Crow are left unmapped in this pass on purpose, not by
// oversight: the doc's own worked example ("fighting on alone because
// retreat had nowhere left to go reads as Bear, forced into the open")
// describes a sim-bot AI *reason* (playerAi's own hold_cornered/
// retreat_low_hp vocabulary), not a structured outcome mission.ts itself
// logs. This classifier is scoped to the engine's own logged action
// outcomes only, per the proposal's own explicit instruction not to read
// the sim bot's reasons directly — a future pass adding a real "cornered/
// no retreat" event to mission.ts would have a natural home for Bear.
import type { AnimalTag, WorrySourceId } from "./worries";

export type CombatWorryEvent =
  | { kind: "kill" }
  | { kind: "repair"; healedAmount: number }
  | { kind: "downed" }
  | { kind: "permadeath_check"; permanentlyLost: boolean }
  | { kind: "overwatch_trigger" }
  | { kind: "dodge" };

export type ClassifiedCombatWorry = {
  source: WorrySourceId;
  catalyst: AnimalTag;
  intensity: number; // 0-1, same placeholder-number status every other tuning constant in this project carries — not run through combat_sim.py, since this doesn't touch balance math at all
};

// Flat placeholders for every event kind except repair, which the design
// doc explicitly calls out as wanting to reflect "how much it healed," not
// just that it happened.
const KILL_INTENSITY = 0.4;
const DOWNED_INTENSITY = 0.8;
const PERMADEATH_LOST_INTENSITY = 0.95;
const PERMADEATH_RECOVERABLE_INTENSITY = 0.55;
const OVERWATCH_INTENSITY = 0.45;
const DODGE_INTENSITY = 0.3;

// Repair scales with healedAmount rather than landing on one flat number —
// a graze and a full Fieldwright-boosted heal shouldn't read the same.
// Reference points, not derived from any real data: Data Pack §6's base
// abil_repair heal (30 HP) lands at REPAIR_INTENSITY_BASE + 0.30 = 0.6;
// Fieldwright's own 1.25x version of that (38 HP, repair.test.ts's own
// worked example) lands at 0.68. Capped well short of 1 so a repair alone
// never reads as more urgent than a downing.
export const REPAIR_INTENSITY_BASE = 0.3;
export const REPAIR_INTENSITY_PER_HP = 0.01;
export const REPAIR_INTENSITY_MAX = 0.9;

// Safety-net expiry only, same status as WorryEntry.expiresAt's own header
// comment — the real removal path for these entries is the Mission
// instance itself going away at mission end, not this timer. A generous
// hour comfortably outlasts any single mission attempt.
export const COMBAT_WORRY_EXPIRY_MS = 60 * 60_000;

export function classifyCombatWorry(event: CombatWorryEvent): ClassifiedCombatWorry {
  switch (event.kind) {
    case "kill":
      return { source: "combat_kill", catalyst: "shark", intensity: KILL_INTENSITY };
    case "repair": {
      const intensity = Math.min(REPAIR_INTENSITY_MAX, REPAIR_INTENSITY_BASE + event.healedAmount * REPAIR_INTENSITY_PER_HP);
      return { source: "combat_repair", catalyst: "dog", intensity };
    }
    case "downed":
      return { source: "combat_downed", catalyst: "rabbit", intensity: DOWNED_INTENSITY };
    case "permadeath_check":
      return event.permanentlyLost
        ? { source: "combat_permadeath_lost", catalyst: "raven", intensity: PERMADEATH_LOST_INTENSITY }
        : { source: "combat_permadeath_recoverable", catalyst: "fox", intensity: PERMADEATH_RECOVERABLE_INTENSITY };
    case "overwatch_trigger":
      return { source: "combat_overwatch", catalyst: "wolf", intensity: OVERWATCH_INTENSITY };
    case "dodge":
      return { source: "combat_dodge", catalyst: "cat", intensity: DODGE_INTENSITY };
  }
}
