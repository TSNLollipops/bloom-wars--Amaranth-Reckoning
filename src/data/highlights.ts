// src/data/highlights.ts
// Social Sim Roadmap #11 ("Highlights reel"), 27 Aug 2026 — the fourth and
// last of the "Small/Small-to-medium" roadmap items built in this
// unattended pass (after Hello, Sir's rank-greeting content going
// catalyst-specific, the visible Stage/rank badge, and stage-weighted
// sub-animal confidence). Same discipline as those three: verify the
// pitch against the actual data before building it, not just against the
// original wishlist wording.
//
// The roadmap doc's own original pitch named example milestones — "first
// Talk," "the stage-promotion moment," "became a couple," "a bad fight" —
// as if all of them were equally derivable. They aren't, and building this
// as originally pitched would mean silently fabricating precision the save
// data doesn't have. Checked each one against the actual code before
// writing a line of this file:
//
//   - "First Talk": NOT derivable. The ambient E-key Talk (Hub.ts's
//     speak()/broadcastMessage() path) never writes a SocialLogEntry —
//     only the deliberate, room-gated verbs (Share a Drink, the three Rec
//     Room minigames, Ask Out) push to socialLog. Confirmed via grep:
//     "talk" never appears as a `verb:` value anywhere a push() happens.
//   - "Became a couple" (player + NPC): derivable, WITH a real timestamp —
//     the last "askOut" socialLog entry, when npc.inRelationship is true,
//     is guaranteed to be the actual acceptance moment. Hub.ts's askOut()
//     only pushes a socialLog entry on the *first* accept or on a
//     rejection; every later askOut press against an already-accepted
//     pair hits the "alreadyTogether" branch, which does not log. So the
//     newest logged "askOut" entry for a currently-together pilot cannot
//     be anything other than the acceptance itself.
//   - "Became a couple" (NPC + NPC): NOT derivable. Both
//     this.npcSocial.relationships (Hub.ts) and state.relationships
//     (engine/socialSim.ts) are plain string[] of pairKeys — pushed with
//     no `at`/timestamp field at all. There is no NPC-NPC pairing event
//     with a date anywhere in the save.
//   - "The stage-promotion moment" / a rank-promotion moment: NOT
//     derivable. lastAcknowledgedStage / lastAcknowledgedRourkeRank
//     (HubPilotSocialState) are snapshot fields — "the last value the
//     player has seen," not "the moment it changed." No timestamp exists
//     for when a Stage or rourkeRank transition actually happened.
//   - "A bad fight": not a system that exists at all yet (roadmap #7,
//     "surfacing friction," is explicitly still backlog — see the roadmap
//     doc). Nothing to derive.
//
// What's actually left standing, honestly: every VerbId that has ever
// resolved against a given pilot IS timestamped (SocialLogEntry.at), so a
// dated "First <verb>" milestone per verb-type-present is real data, not
// an inference — this is category one below. Everything else worth
// showing (current relationship status, current Stage) is a live fact
// with no date attached to when it started, so it's shown separately and
// explicitly undated — Hub.ts's own renderHighlights() builds that
// "Currently:" section directly (it needs npc.inRelationship,
// this.npcSocial.relationships, and npc.ambient.stage — all Hub-scene
// state this module deliberately doesn't reach into, same
// data/vs-scene split every other file in src/data/ already holds).
//
// Pure and synchronous by design (src/data/**'s own import-purity rule,
// Build Brief §5.2: no imports from ../engine/*) — takes a log array,
// returns milestones, does no reading of CampaignState or Hub scene state
// itself. Mirrors buildHistoryOverlay's own "read it back out, don't
// invent new engine state" shape.
import type { SocialLogEntry, VerbId } from "./verbs";
import { VERBS } from "./verbs";

export interface HighlightMilestone {
  verb: VerbId;
  // "First Share a Drink," "First The Peg Board," etc. — built from
  // VERBS[verb].label rather than hand-written per verb, so a new verb
  // added to data/verbs.ts automatically gets a correctly-labeled
  // milestone the moment it starts writing to socialLog, no second edit
  // needed here.
  label: string;
  // The actual logged line from that first occurrence, not a generic
  // placeholder — reuses content that was already written for the
  // interaction itself (Hub.ts's shareADrink/askOut/minigame-finish
  // methods each build a real line before pushing the log entry).
  line: string;
  at: number;
}

// One entry per distinct VerbId present in the log, earliest occurrence
// only, sorted chronologically (oldest first) — a reel plays forward, and
// "first" only means something as a sequence. socialLog itself is already
// push-ordered (append-only, per persistNpcSocial/askOut/etc.), so a
// single forward pass keeping the first-seen entry per verb is sufficient;
// no need to re-sort the source log before scanning it.
export function buildFirstMilestones(log: SocialLogEntry[] | undefined): HighlightMilestone[] {
  const firstByVerb = new Map<VerbId, SocialLogEntry>();
  for (const entry of log ?? []) {
    if (!firstByVerb.has(entry.verb)) firstByVerb.set(entry.verb, entry);
  }
  const milestones: HighlightMilestone[] = [];
  for (const entry of firstByVerb.values()) {
    milestones.push({ verb: entry.verb, label: `First ${VERBS[entry.verb].label}`, line: entry.line, at: entry.at });
  }
  milestones.sort((a, b) => a.at - b.at);
  return milestones;
}
