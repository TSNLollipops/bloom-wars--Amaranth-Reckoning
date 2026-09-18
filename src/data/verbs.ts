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
//
// flirt, 12 Sep 2026 — the softer tier askOut's own comment above says
// nothing about, because it didn't exist yet when that was written. Same
// flat-delta shape as gift/praise/insult/apology/congratulate/sendOff
// below (a real outcome resolved here, in Hub.ts, off a fixed
// FLIRT_FAVORABILITY_DELTA — no dynamic accept/reject the way askOut has),
// not askOut's shape, despite the thematic overlap. data/socialActions.ts's
// own header has the full reasoning and the exact phrase split against
// askOut's keyword list (data/chatIntent.ts).
// angerBlowup / breakdown, 28 Aug 2026 — Groups 3-5 batch rebuild (see
// data/angerBlowup.ts and data/breakdown.ts for the real math and content
// these two ids stand for). Not player-initiated the way every verb above
// is — Hub.ts triggers these on its own, off Stress/Morale crossing a
// threshold, not off a menu click. Given VerbId entries anyway, same
// reasoning as Talk sharing this shape despite also being different in
// kind from Share a Drink/Ask Out: every socialLog entry and the
// Highlights reel (highlights.ts's buildFirstMilestones, keyed off
// VERBS[verb].label) already work generically over VerbId, so routing
// these two through the same pipe means "First Blowup"/"First Breakdown"
// milestones and social-log lines come for free, no parallel plumbing
// needed for the fact that these two didn't come from a click.
// spar, 30 Aug 2026 (Maxime: "boredom should trigger spar") — same
// not-player-initiated shape as angerBlowup/breakdown just above (Hub.ts's
// tryBoredomSpar fires this off boredom crossing NEEDS_LOW_THRESHOLD in the
// Spar Room, not off a menu click), given a real VerbId for the identical
// reason those two were: socialLog entries and the Highlights reel
// (highlights.ts's buildFirstMilestones) already work generically over
// VerbId, so a "First Spar" milestone and social-log line come for free.
// Distinct from Breakdown's own "spar" RESOLUTION FLAVOR (data/breakdown.ts
// — a Stress+Worried crisis caught in the Spar Room) — that one still logs
// under the "breakdown" verb id, unchanged; this is a separate, everyday
// event with its own id.
//
// condolences / reassurance / checkIn / challengeSpar, 15 Sep 2026 — the
// "Any new verb we can add in?" brainstorm, all four picked at once
// (Maxime). Same single-target, player-initiated shape as the crew-
// interaction batch below, but not a uniform mechanic underneath:
// condolences and reassurance are flat-delta verbs slotting into the same
// generic resolver as gift/praise/flirt/insult/apology/congratulate/
// sendOff (engine/socialVerbResolution.ts) — condolences gates on a live
// "muntiLost" HotTopic (targets whichever surviving pilot is carrying the
// grief, not a specific pilotId the way Congratulate's "promoted" gate
// does — see socialActions.ts's own header for why this isn't Congratulate
// with different words), reassurance has no hot-topic gate at all but
// carries its own small per-pilot cooldown (enforced in Hub.ts, not the
// resolver — see REASSURANCE_COOLDOWN_MS in socialActions.ts). checkIn and
// challengeSpar don't go through that generic resolver: checkIn surfaces
// the real per-pilot Worries state (data/worries.ts) through a small
// 4-bucket content read of its own (built fresh rather than reusing
// ambientLines.ts's pickSoloEcho/pickLineForMessage, because that existing
// pipeline was found, while building this, to never actually vary its line
// by worry source — see socialActions.ts's Check-In header for the full
// finding); challengeSpar is a deliberately separate, simpler resolution
// (socialActions.ts's rollSparChallengeOutcome) rather than a reuse of the
// existing NPC-vs-NPC Spar engine (engine/socialSim.ts's
// resolveSparEncounter), because that engine needs a full SocialSimPilot
// record (catalyst/stage/species) for both participants and the player/MC
// has no such record anywhere in this codebase.
//
// gift / praise / insult / apology / congratulate / sendOff, 2 Sep 2026 —
// the crew-interaction brainstorm pass ("add it all they are good. code it.
// you are free to go."). All six are single-target, player-initiated, and
// share pegBoard/askOut's shape below: no fixed `outcome` here, since every
// one of them resolves a catalyst-flavored (and, for Insult, escalation-
// ladder-aware) effect that only Hub.ts has the context to apply — see
// data/socialActions.ts for the actual content banks and numbers, and
// chatIntent.ts's VERB_REQUEST_KEYWORDS for how a chat line maps to one of
// these. Gift fills the verb-framework slot this file's own header already
// named and left empty since Phase 2 ("Rec Room Invite, Gift... wait on
// content"). Praise/Insult/Apology are the three-part system from
// claude/Bloom_Wars_Praise_Insult_Apology_System_Proposal_v1.md. Congratulate
// is the "attend a hot topic" half of that same brainstorm (condolences for
// a Munti loss deliberately NOT built this pass — see socialActions.ts's own
// header). Send-Off is the pre-mission ritual — Hub-side payoff only this
// pass, the in-Battle tactical bonus deliberately deferred pending a real
// combat_sim.py tuning pass (see CampaignState.preMissionSendOff).
export type VerbId =
  | "talk"
  | "shareADrink"
  | "pegBoard"
  | "poker"
  | "fletchers"
  | "askOut"
  | "flirt"
  | "angerBlowup"
  | "breakdown"
  | "spar"
  | "gift"
  | "praise"
  | "insult"
  | "apology"
  | "congratulate"
  | "sendOff"
  | "condolences"
  | "reassurance"
  | "checkIn"
  | "challengeSpar"
  | "askAbout"
  | "gossip";

export interface VerbRequirements {
  minFavorability?: number;
  // Room/rank/romanceable gates: real fields per §3, left unmodeled until
  // a verb actually needs one — see file header.
}

export interface VerbOutcome {
  favorabilityDelta?: number;
  setsDrunk?: boolean;
  // Stress/Morale Trigger Proposal, 1 Sep 2026 — the real Stress-relief
  // verb this comment used to say hadn't shown up yet. shareADrink is the
  // one fixed-outcome verb that uses this field directly; pegBoard/poker/
  // fletchers/askOut still resolve their own dynamic outcome in Hub.ts (see
  // each of those ids' own header above) and apply their stress/morale
  // deltas there, same as they already do for favorabilityDelta.
  stressDelta?: number;
  moraleDelta?: number;
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
  //
  // stressDelta: -8, 1 Sep 2026 — the Stress & Morale Trigger Proposal's
  // "Share a Drink -> small Stress relief, no Morale change." This is also
  // this verb's whole answer to that same proposal's separate "getting
  // drunk" trigger: setsDrunk above already fires on every Share a Drink
  // (there's no separate drinking-to-excess action in this codebase), so
  // one instant relief tick covers both named triggers rather than also
  // building a second, timed effect that reverts when drunkUntil expires —
  // flagged as a deliberate simplification, not an oversight.
  shareADrink: {
    id: "shareADrink",
    label: "Share a Drink",
    broadcast: false,
    outcome: { favorabilityDelta: 5, setsDrunk: true, stressDelta: -8 },
  },
  pegBoard: { id: "pegBoard", label: "The Peg Board", broadcast: false },
  poker: { id: "poker", label: "Poker", broadcast: false },
  fletchers: { id: "fletchers", label: "Fletchers", broadcast: false },
  askOut: { id: "askOut", label: "Ask Out", broadcast: false },
  flirt: { id: "flirt", label: "Flirt", broadcast: false },
  // broadcast: false for both — these are a pair-scoped event (Blowup) and
  // a single-pilot event (Breakdown), never a room-wide announcement the
  // way Talk is.
  angerBlowup: { id: "angerBlowup", label: "Blowup", broadcast: false },
  breakdown: { id: "breakdown", label: "Breakdown", broadcast: false },
  spar: { id: "spar", label: "Spar", broadcast: false },
  // Crew-interaction brainstorm pass, 2 Sep 2026 — see this file's own
  // header just above for the full reasoning. Same shape as pegBoard/
  // askOut: no fixed `outcome`, Hub.ts resolves each one's real effect
  // (data/socialActions.ts has the content and numbers).
  gift: { id: "gift", label: "Gift", broadcast: false },
  praise: { id: "praise", label: "Praise", broadcast: false },
  insult: { id: "insult", label: "Insult", broadcast: false },
  apology: { id: "apology", label: "Apology", broadcast: false },
  congratulate: { id: "congratulate", label: "Congratulate", broadcast: false },
  sendOff: { id: "sendOff", label: "Send-Off", broadcast: false },
  // 15 Sep 2026 batch — see this file's own header above for the full
  // per-verb reasoning. All four broadcast: false, same as every other
  // single-target verb in this file.
  condolences: { id: "condolences", label: "Condolences", broadcast: false },
  reassurance: { id: "reassurance", label: "Reassurance", broadcast: false },
  checkIn: { id: "checkIn", label: "Check In", broadcast: false },
  challengeSpar: { id: "challengeSpar", label: "Challenge to Spar", broadcast: false },
  // askAbout, 17 Sep 2026 — verb plan §6 #2. "where are you from" / "tell me
  // about yourself": the pilot's own Archive record, read to the player one
  // sentence at a time, in order, tracked through their socialLog so it
  // rotates and can't be farmed. Zero new character lines — the whole
  // reason it could ship pre-EA. Resolves in engine/askAbout.ts (shape D,
  // like checkIn: its own small read, not the generic resolver), Hub.ts
  // applies the one-time Favorability nudge and the bubble.
  askAbout: { id: "askAbout", label: "Ask About", broadcast: false },
  // gossip, 17 Sep 2026 — verb plan §6 #1. "what do you think of Bosk?":
  // the target says how they feel about a NAMED crewmate, read off the
  // real bond store (data/npcBonds.ts) — the first time the player can see
  // the bond graph the sim has run on since 26 Aug. A read, no delta.
  // Ships gated off until Maxime's five band lines are in data/gossip.ts
  // (gossipBankReady); Hub.ts answers "not open yet" until then.
  gossip: { id: "gossip", label: "Gossip", broadcast: false },
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
