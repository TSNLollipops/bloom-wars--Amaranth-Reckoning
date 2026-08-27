// src/data/friction.ts
// Surfacing friction — Social Sim Roadmap #7, first slice, 27 Aug 2026,
// built at Maxime's own direction while he's out for the day ("keep
// building the hub"). The roadmap doc's own framing: "the sim can
// produce enemies as easily as friends, but only friends get any UI or
// content right now." npcBonds.ts's RIVAL_THRESHOLD already exists and
// already drives real behavior (an NPC physically drifts away from their
// worst rival during roaming — see Hub.ts's updateNpcRoaming) — this
// closes the other half: a real rivalry now has a visible tag (mirroring
// the existing ♥-with-X tag) and its own dialogue flavor, instead of
// being invisible everywhere except NPC movement.
//
// Deliberately a display-only addition, same shape hot topics and
// relationship-stage banter both used: the real encounter math
// (simulateEncounter's kind roll, bondDelta) is completely untouched.
// Only what gets SHOWN for an already-established rivalry's "talk" kind
// changes — two people who can't stand each other having a warm
// back-and-forth reads wrong regardless of what the sim rolled
// mechanically underneath.
//
// Small, catalyst-neutral bank — same "generic first" scope call every
// other first-slice content bank this session made (hot topics,
// relationship stages, the two one-time reveals originally).
export const FRICTION_LINES: string[] = [
  "They talk for a minute. It doesn't go anywhere good.",
  "Same old friction. Neither one budges.",
  "A few clipped words, then both walk off in different directions.",
  "Civil, technically. Barely.",
];

export function pickFrictionLine(): string {
  return FRICTION_LINES[Math.floor(Math.random() * FRICTION_LINES.length)];
}
