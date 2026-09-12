// src/data/combatWorryLines.ts
// Combat-log Worry Lines, wired 11 Sep 2026 — Maxime's own lines
// (claude/Bloom_Wars_Combat_Worry_Lines_v1.md, written directly in chat,
// 10-11 Sep 2026). Claude does not write character dialogue on this
// project, full stop, per that doc's own header — every line below is
// Maxime's; this file only sorts them under the WorrySourceId
// data/combatWorry.ts's classifier already produces, and picks one at
// display time.
//
// Cleanup applied per the doc's own closing instruction ("clean these up
// at wiring time, don't treat the doc's transcription as the shipped copy
// verbatim"): missing apostrophes in a handful of contractions, spelled
// out here so nobody has to diff against the doc to see what changed —
//   Itl -> It'll, Shouldnt -> Shouldn't, dispear -> disappear, Im -> I'm,
//   Whatching -> Watching, Thats -> That's (this last one wasn't in the
//   doc's own "e.g." list but is the same class of slip).
// Everything else — word choice, register, "Go wack em," "Y'all" — is
// Maxime's actual voice, not a typo, and is transcribed exactly as
// written. If any of that reads better changed, that's his call to make,
// not a cleanup pass to assume.
//
// Selection: bank[Math.floor(Math.random() * bank.length)] — the same
// random-pick idiom every LINE_BANK lookup in data/ambientLines.ts already
// uses (pickSoloEcho, resolveMusterLine, etc.), not a new pattern
// introduced for this.
//
// Surfaced through Battle's existing "(dialogue) ..." log-entry
// convention — engine/mission.ts's `action.type === "dialogue"` path
// writes authored mission-event lines as `(dialogue) ${action.text}`, and
// Mission.pushCombatWorry (see that method's own comment) reuses the same
// text format for these, live from gameplay rather than from a mission's
// own scripted action list.
//
// Throttle rule lives in mission.ts, not here (the doc's own "For whoever
// wires this in" section): once per pilot per mission, and only when the
// just-classified worry is currently that pilot's own loudest live entry
// in Mission.combatWorries. This file only holds the content and the
// picker — no gameplay state.
import type { WorrySourceId } from "./worries";

const COMBAT_WORRY_LINES: Partial<Record<WorrySourceId, string[]>> = {
  // mission_pilot_missing is a Hub-context source (Mission Worry, step 2) —
  // it never appears in a Mission instance's own combatWorries list (see
  // that field's comment in mission.ts), so it has no pool here.
  combat_kill: [
    "Ah! That's mine.",
    "Not today, you don't!",
    "Love their misery — let's give it company!",
    "I like the look of my weapon full of viscera.",
    "One more for the tally.",
    "One less monster on the field.",
  ],
  combat_repair: ["It'll take a while to clean that one.", "Y'all patched up.", "Gave you back your arm. Go wack em!", "Just in time."],
  combat_downed: ["Not gonna let you disappear on me.", "Nothing to lose."],
  combat_permadeath_recoverable: ["No need to restock you yet.", "If nothing else, I owe you."],
  combat_permadeath_lost: ["Got a dead one here.", "Shouldn't there be another one here?"],
  combat_overwatch: ["I never miss.", "No one going to get to you while I'm primed.", "Looking after you.", "Just in time.", "I'm on overwatch.", "Watching over you all."],
  combat_dodge: ["They nearly got you there.", "Just in time.", "That's a near hit."],
};

/**
 * A random line from `source`'s pool, or undefined for a source with no
 * combat-log lines (mission_pilot_missing — see COMBAT_WORRY_LINES' own
 * comment). Callers should treat undefined as "nothing to show," not
 * retry or fall back to another pool — confirmed 10 Sep in the source doc
 * that ambientLines.ts's Hub bank doesn't fit this register, so there is
 * deliberately no fallback bank to reach for here either.
 */
export function pickCombatWorryLine(source: WorrySourceId): string | undefined {
  const bank = COMBAT_WORRY_LINES[source];
  if (!bank || bank.length === 0) return undefined;
  return bank[Math.floor(Math.random() * bank.length)];
}
