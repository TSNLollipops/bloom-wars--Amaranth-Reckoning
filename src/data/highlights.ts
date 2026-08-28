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
//     derivable as of this file's original build. lastAcknowledgedStage /
//     lastAcknowledgedRourkeRank (HubPilotSocialState) are snapshot fields
//     — "the last value the player has seen," not "the moment it
//     changed." No timestamp existed for when a Stage or rourkeRank
//     transition actually happened.
//     CORRECTION, 28 Aug 2026: the Stage half of this is no longer true.
//     Maxime asked for it directly after this exact gap got flagged in a
//     delivery note ("highlight reel should date itself with calandar.
//     down to the sec.") — engine/campaignEconomy.ts's purchaseTierUpgrade
//     now records a real epoch-ms timestamp the moment a purchase crosses
//     a Stage boundary (HubPilotSocialState.stagePromotedAt). See
//     buildStagePromotionMilestones below. rourkeRank's own transition
//     still has no timestamp anywhere — that half of this bullet still
//     stands, nothing asked for it and nothing built it.
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
import type { Stage } from "./ambientLines";

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

// Stage-promotion milestones, 28 Aug 2026 — closes the honest gap this
// file's own header flagged during the original build ("the stage-
// promotion moment... NOT derivable... no timestamp exists"). That's no
// longer true: engine/campaignEconomy.ts's purchaseTierUpgrade now records
// a real epoch-ms timestamp the instant a purchase actually crosses a
// Stage boundary (CampaignState.pilots[id].social.stagePromotedAt) — see
// that field's own comment in engine/campaignState.ts. This is a sibling
// to buildFirstMilestones above, not a merge into it: a Stage promotion
// isn't a VerbId (nothing a player presses, no SocialLogEntry line to
// quote), so it gets its own small parallel type rather than being forced
// into HighlightMilestone's verb-shaped fields. Hub.ts's renderHighlights
// merges both lists' output by `at` into one chronological reel.
export interface StagePromotionMilestone {
  stage: Exclude<Stage, "green">; // nothing promotes INTO green — see detectStagePromotion's own comment
  label: string; // "Reached Blooded" / "Reached Command"
  at: number;
}

const STAGE_MILESTONE_LABEL: Record<Exclude<Stage, "green">, string> = {
  blooded: "Reached Blooded",
  command: "Reached Command",
};

// At most two entries (blooded, then command, in that fixed order — tiers
// only ever move up, so command can never be recorded before blooded).
// Returns an empty array for a pilot with no recorded promotions at all —
// every pilot who started the campaign already at a mid/high tier, or
// simply hasn't purchased one yet, falls here honestly rather than
// fabricating a "promotion" that never actually happened as a live event.
export function buildStagePromotionMilestones(stagePromotedAt: Partial<Record<Stage, number>> | undefined): StagePromotionMilestone[] {
  const milestones: StagePromotionMilestone[] = [];
  if (stagePromotedAt?.blooded !== undefined) {
    milestones.push({ stage: "blooded", label: STAGE_MILESTONE_LABEL.blooded, at: stagePromotedAt.blooded });
  }
  if (stagePromotedAt?.command !== undefined) {
    milestones.push({ stage: "command", label: STAGE_MILESTONE_LABEL.command, at: stagePromotedAt.command });
  }
  milestones.sort((a, b) => a.at - b.at);
  return milestones;
}
