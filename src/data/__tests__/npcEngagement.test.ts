import { describe, it, expect } from "vitest";
import { isNpcEngaged } from "../npcEngagement";

// NPC Conversation Lock Fix, 6 Sep 2026 — see npcEngagement.ts's own header
// for the full root cause and why this predicate lives here rather than in
// Hub.ts (importing Hub.ts directly crashes under Vitest — Phaser reaches
// for `window` at module load time). This covers the one boolean the fix
// hinges on; it does NOT exercise updateNpcRoaming/updateNpcEncounters
// themselves, which stay scene-instance-only and untested here, same as
// the rest of Hub.ts. Live verification (two ants actually holding still
// through a full staged exchange in a real Hub session) is still what
// proves the fix end to end.
describe("isNpcEngaged — the NPC Conversation Lock Fix's own guard, 6 Sep 2026", () => {
  it("is false when engagedUntil was never set (the overwhelming majority of NPCs, most of the time)", () => {
    expect(isNpcEngaged(undefined, 1_000)).toBe(false);
  });

  it("is true while now is still before engagedUntil — the exact window that used to leak", () => {
    expect(isNpcEngaged(2_000, 1_000)).toBe(true);
  });

  it("is false the instant now reaches engagedUntil — release is immediate, not delayed further", () => {
    expect(isNpcEngaged(1_000, 1_000)).toBe(false);
  });

  it("is false once engagedUntil is safely in the past", () => {
    expect(isNpcEngaged(1_000, 5_000)).toBe(false);
  });
});
