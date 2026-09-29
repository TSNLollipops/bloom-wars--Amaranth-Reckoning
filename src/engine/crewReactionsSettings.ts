// src/engine/crewReactionsSettings.ts
//
// The Options toggle for the Formula v2 crew-reaction changes, 28 Sep 2026
// (Bloom_Wars_Formula_v2_PreLaunch_Build_Plan_v1_27Sep2026.md, Q5: "behind an
// options toggle, on by default"). It gates exactly three things in
// scenes/Hub.ts: Gate 0's want check and idle beat (data/reactionGate.ts),
// Gate 4 on the Talk verb, and Gate 4 on NPC-to-NPC Ask Out. OFF restores the
// pre-v2 behaviour exactly, so if a playtest says it feels wrong it can be
// switched off without a build.
//
// Same shape as audioSettings.ts: Phaser-free (src/engine may not import
// Phaser) and guarded against a missing or throwing localStorage, which is
// also what lets a vitest file import it in plain Node.

const CREW_REACTIONS_V2_KEY = "bloomwars_crew_reactions_v2_enabled_v1";

/** True unless the player has explicitly switched it off. Absent key, no storage, or a throwing storage all read as ON. */
export function areCrewReactionsV2Enabled(): boolean {
  try {
    if (typeof localStorage === "undefined") return true;
    return localStorage.getItem(CREW_REACTIONS_V2_KEY) !== "0";
  } catch {
    return true;
  }
}

/** Best-effort save; a failed write just means the toggle resets to ON on reload. */
export function setCrewReactionsV2Enabled(enabled: boolean): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(CREW_REACTIONS_V2_KEY, enabled ? "1" : "0");
  } catch {
    // ignore
  }
}
