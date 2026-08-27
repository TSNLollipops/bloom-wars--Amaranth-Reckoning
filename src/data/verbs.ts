// src/data/verbs.ts
// Build Plan §3 / §5 Phase 2, 26 Aug 2026 — "Build the antfarm then the
// verb then the rec room" (Maxime, choosing Phase 2's own internal order).
// The Antfarm map expansion (Hub.ts, this same pass) is piece one; this is
// piece two — the real Interaction Verb framework §3 already specced on
// paper, not another one-off feature bolted onto Hub.ts the way Talk and
// provoke() were.
//
// §3's own case for this: instead of hand-building "Talk," "Ask Out," and
// "Invite to Rec Room" as three separate features, every hub interaction
// is the same shape (Actor / Target / Verb / Requirements / Cost /
// Outcome / Log). Maxime confirmed the three original examples aren't
// special cases: "the 3 thing I said are just basic thing." This module
// is that shape as real types and data — Hub.ts still owns actually
// RUNNING a verb (bubbles, Favorability, propagation), same split
// chatIntent.ts already has between parsing and acting.
//
// Deliberately narrow this pass, same discipline as every other piece of
// this build: Actor isn't modeled (always the MC, nothing else can act,
// so there's nothing to represent). Requirements/Cost exist as real
// fields because §3 names them, but nothing populates a room/rank/
// romanceable gate yet — none of that reads real CampaignState/
// PilotRecord data yet either (Hub.ts's own scope-line comment). Cost
// specifically stays unset on every verb below: §4 locked the SHAPE of
// calendar pricing ("itemized, not a flat tax") but explicitly not the
// numbers — "a number counts once it's run through tuning, not because
// it sounded reasonable in a planning doc," the same rule this project
// already holds combat_sim.py/maps.py to. Every verb is free until the
// calendar itself exists to spend against.
// Talk is listed here as real data (so it's genuinely "verb #1" the way
// Maxime's ordering implies) but Hub.ts's speak()/broadcastMessage() keep
// doing the actual work unchanged — those are tested, playtested, and
// already correct; rebuilding Talk's execution path against this new
// framework as a first move would risk regressing something that already
// works, for a cosmetic win. Share a Drink is the first verb this module
// actually drives end-to-end.
//
// pegBoard, 26 Aug 2026 — Rec Room minigame #3 of 3 (Poker/Fletchers still
// need their own design pass first — see the Build Plan doc's own "still
// not built" line). Listed here, same as Talk, mostly for the id/label/
// chat-keyword plumbing (see chatIntent.ts's VERB_REQUEST_KEYWORDS) —
// unlike Share a Drink, its real outcome isn't a fixed VerbOutcome, it's
// whatever the actual game (src/engine/pegBoard.ts) resolves to, so
// `outcome` stays unset here on purpose and Hub.ts applies the
// win/lose/draw Favorability nudge itself once a game ends.
//
// poker, 26 Aug 2026 — the second of the three named Rec Room minigames.
// Maxime confirmed it's Texas Hold'em specifically, with a real AI
// opponent, built on a generic card-table engine (src/engine/cardTable/)
// rather than a Hold'em-only one, since he wants to grow the card game
// list past just Hold'em eventually. Same shape as pegBoard here: no fixed
// `outcome` — a poker session is a real, dynamic multi-hand result
// (src/engine/holdem.ts), not a static delta, so Hub.ts applies the
// Favorability nudge itself once a session actually ends (someone busts).
//
// fletchers, 26 Aug 2026 — the last of the three named Rec Room minigames.
// Maxime's "fletcher is like persona 5 royal" resolved (via an
// AskUserQuestion fork) to both the chill vibe and a real mini-game, then
// sharpened again the same day: "the fletcher game in the pool zone... the
// dart is a zone in the rec room" plus a separate "dart" confirming the
// mechanic — darts, staying inside the existing Rec Room rather than a new
// walkable room, with a real skill-based aim/power throw (his own pick
// over a cheaper turn-based-click option). Same shape as pegBoard/poker:
// no fixed `outcome` — a darts session's real result comes from
// src/engine/darts.ts, so Hub.ts applies the Favorability nudge itself
// once a session ends.
//
// askOut, 26 Aug 2026 — Phase 3, piece two (Build Plan §5: "Ask Out and
// romance come online using the already-locked romanceable rules"). Same
// shape as Share a Drink (a real outcome resolved elsewhere and applied
// here) rather than pegBoard/poker/fletchers' shape (no fixed outcome at
// all) — accept/reject is a real decision (src/data/romance.ts's
// resolveAskOut), not a static delta, so `outcome` stays unset here too;
// Hub.ts applies whichever of the two deltas resolveAskOut returns. Not
// room-gated the way Share a Drink is to the Rec Room specifically —
// Spitball Ideas' own Berths entry names Berths as "already the named
// home for the parked romance mechanic," but no NPC currently ever walks
// there (Bosk/Anand/Iyari are fixed in Rec Room per §10), so hard-gating
// Ask Out to a room nobody visits would make it unreachable. Left open
// (askable wherever the target NPC currently is) for this first pass —
// flagged, not silently decided, since tightening it to Berths once NPCs
// actually inhabit that room (piece three, autonomous roaming) is a real
// follow-up worth doing on purpose rather than by accident.
export type VerbId = "talk" | "shareADrink" | "pegBoard" | "poker" | "fletchers" | "askOut";

export interface VerbRequirements {
  minFavorability?: number;
  // Room/rank/romanceable gates: real fields per §3, left unmodeled until
  // a verb actually needs one — see file header.
}

export interface VerbOutcome {
  favorabilityDelta?: number;
  setsDrunk?: boolean;
  // Stress/Morale deltas: no verb below needs them yet — added when a
  // real Stress-relief verb (CO Check-in, Phase 3+) does, not guessed at
  // now for a verb that doesn't move either number.
}

export interface VerbDef {
  id: VerbId;
  label: string;
  // Talk's real shape (§3: "Speaking is a sound-range broadcast... every
  // NPC currently within earshot reacts on their own") vs. every other
  // verb's single-target shape. Hub.ts branches on this to decide how a
  // verb resolves its target, same distinction §3 itself draws.
  broadcast: boolean;
  requirements?: VerbRequirements;
  outcome?: VerbOutcome;
}

export const VERBS: Record<VerbId, VerbDef> = {
  talk: { id: "talk", label: "Talk", broadcast: true },
  // Drunk debuff (-20% hit chance for a few turns) is locked in §5 but
  // lives in Battle/combat state, not here — this scene has no battle to
  // apply it to. What Share a Drink actually does at the Hub layer: sets
  // ambient.drunk on the target, which pickAmbientLine (ambientLines.ts)
  // already reads to pick drunk-flavored lines (50/50 love/anger) —
  // wiring this verb costs zero new content, that branch was ported
  // verbatim from pilot_creator.html back in Phase 1 and has just been
  // unreachable until now. +5 Favorability is a placeholder nudge, same
  // "not a locked number" caveat as everything else demo-Favorability
  // touches in this scene (Hub.ts's own header).
  shareADrink: {
    id: "shareADrink",
    label: "Share a Drink",
    broadcast: false,
    outcome: { favorabilityDelta: 5, setsDrunk: true },
  },
  pegBoard: { id: "pegBoard", label: "The Peg Board", broadcast: false },
  poker: { id: "poker", label: "Poker", broadcast: false },
  fletchers: { id: "fletchers", label: "Fletchers", broadcast: false },
  askOut: { id: "askOut", label: "Ask Out", broadcast: false },
};

// The "Log entry" §3 asks for ("feeds the social-history record... it's
// the record and the record take in everything"). Originally scene-only —
// "demo-only, not persisted to PilotRecord/CampaignState" — until Hub.ts's
// 26 Aug 2026 persistence pass. As of that pass, this is exactly what gets
// written into CampaignState.pilots[id].social.socialLog
// (engine/campaignState.ts section 11, HubPilotSocialState) every time a
// verb resolves — the type itself didn't need to change, only what happens
// to an entry after Hub.ts builds one.
export interface SocialLogEntry {
  verb: VerbId;
  line: string;
  // Date.now() — wall-clock epoch ms — as of the same 26 Aug 2026 pass.
  // Was this.time.now (Phaser's own scene-relative clock, which resets
  // near 0 every scene load) back when this was scene-only; that stopped
  // being safe the instant these entries started persisting across
  // sessions, since a scene-relative timestamp from one session is
  // meaningless compared against one from another.
  at: number;
}
