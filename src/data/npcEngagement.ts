// src/data/npcEngagement.ts
// NPC Conversation Lock Fix, 6 Sep 2026 (Maxime bug report: Hub NPCs
// mid-conversation get pulled away by ambient roaming before finishing
// their scripted exchange). Root cause, traced against Hub.ts: showBubble()
// only sets an NPC's own bubbleUntil the instant a bubble actually appears
// — for the second half of a staged two-line exchange, that's
// NPC_REPLY_DELAY_MS in the future (Hub.ts), so there was a real window
// (shorter than ROAM_INTERVAL_MIN_MS, Hub.ts's own roam-reroll cadence)
// where neither updateNpcRoaming nor updateNpcEncounters had any reason
// yet to leave either participant alone.
//
// isNpcEngaged is the fix distilled to one boolean: HubNpc.engagedUntil
// (Hub.ts) gets set the instant an exchange starts, covering the whole
// thing — including the reply that hasn't shown up yet — rather than
// reacting to bubbles as they individually appear.
//
// This is its own file, not a Hub.ts-local function, entirely because of
// one thing: Hub.ts imports Phaser, and Phaser's own OS-detection code
// runs at module load time and reaches for `window` — fine in a real
// browser, a ReferenceError under Vitest's default Node test environment.
// No test had ever imported a scenes/*.ts file directly before this fix,
// so nothing had hit that wall yet. This function has no Hub-specific
// logic in it — it's a generic "is this timestamp still ahead of now"
// check — so it costs nothing to give it a dependency-free home here,
// same "this file composes, data/** decides" split Hub.ts already applies
// to findClosestBond/findWorstRival (npcBonds.ts), gate0Reacts
// (reactionGate.ts), and everything else it imports from data/**.
export function isNpcEngaged(engagedUntil: number | undefined, now: number): boolean {
  return engagedUntil !== undefined && now < engagedUntil;
}
