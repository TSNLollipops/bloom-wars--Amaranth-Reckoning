// src/engine/testerNotes.ts
//
// Tester Notes — a free-text scratchpad testers/players can jot into,
// spitballed 8 Sep 2026 (Bloom_Wars_Spitball_Ideas_Addendum_ReassuranceVerbAndTesterNotepad_08Sep2026.md
// §2, Maxime's own words: "I want my tester and player to be able to take
// notes in anotepad in hte game, a sort of scratch pad. because I want them
// to tell me anything they'd love to be able to do with hteir ant so we can
// code it in. i'm never gonna be able to think of everything myself.") —
// built 10 Sep 2026 for the first outside-friend alpha share, scoped down
// from that doc's own open questions to the cheapest honest version:
//
//   - Local-only, one string, no backend. This game has no
//     telemetry-to-Maxime pipeline (Options.ts's own STATISTICS & BUG
//     REPORTS panel says as much: "Everything stays on this computer.
//     Nothing is sent anywhere unless you paste it somewhere yourself.")
//     — a tester's notes follow that exact same rule, and reuse the exact
//     same "copy it yourself" idiom (scenes/ui/CopyTextPanel.ts's own
//     clipboard-plus-selectable-textarea pattern, mirrored for an editable
//     box in scenes/ui/NotesPanel.ts) rather than inventing a second one
//     for one string.
//   - Global, not per-campaign-save. A note like "I wish my Mek could X"
//     isn't campaign state — it's not part of the fiction, doesn't need a
//     save slot, and should survive a deleted campaign. Same tier as
//     areTutorialHintsEnabled/getDisplayScaleOption/getMusicVolume: a
//     browser-local setting, not a game-state field — deliberately kept
//     out of engine/campaignState.ts.
//   - Scoped to closed testing (Maxime handing a build directly to people
//     he knows), not a public EA free-text box — that's a genuinely
//     bigger, unscoped ask per the spitball doc's own §2 "closed testing,
//     or real strangers on itch.io?" question, deliberately not answered
//     here.
//
// Phaser-free and DOM-guarded (safe to import from a vitest file, which
// runs in plain Node — see displayScale.ts's own header for why), same
// shape as audioSettings.ts exactly.

const TESTER_NOTES_KEY = "bloomwars_tester_notes_v1";

/** The tester's saved scratchpad text. Empty string if nothing saved yet or localStorage is unavailable. */
export function getTesterNotes(): string {
  try {
    if (typeof localStorage === "undefined") return "";
    return localStorage.getItem(TESTER_NOTES_KEY) ?? "";
  } catch {
    // localStorage can throw in a locked-down embed (same guard every
    // other settings module in this file's family uses) — treat as empty.
    return "";
  }
}

/** Saves the tester's scratchpad text as-is (empty string clears it). Best-effort — a failed save just means it doesn't survive a reload. */
export function setTesterNotes(text: string): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(TESTER_NOTES_KEY, text);
  } catch {
    // best-effort, same as every sibling module
  }
}
