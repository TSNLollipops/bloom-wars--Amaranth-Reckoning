// src/data/relationshipStage.ts
// Relationship stages — Social Sim Roadmap #6, built 27 Aug 2026, at
// Maxime's own direction while he's out for the day ("keep building the
// hub... gimme something I can sink my teeth into"). The roadmap doc's
// own framing: "inRelationship is currently flat true/false — a couple
// on day one reads identically to a couple three acts later."
//
// Deliberately NOT a new persisted field or counter. The ladder is
// derived LIVE from the same favorability/bond number that already
// moves every time a couple actually interacts (Share a Drink, the
// minigames, Talk, an NPC-NPC encounter's own bondDelta) — the exact
// same "derive from a number that already exists" pattern career Stage
// (Green/Blooded/Command) already uses off gear tier, and the same
// pattern the roadmap doc itself pointed at ("mirroring the Stage
// pattern conceptually without literally reusing the type"). No new
// schema, no backfill, nothing that can go stale on an old save — a
// save from before this feature existed just starts deriving a stage
// the instant it's next loaded, same as Stage itself already does for
// gear tier.
//
// Thresholds sit above ROMANCE_MIN_FAVORABILITY (romance.ts, 50 — the
// entry gate resolveAskOut already uses to become a couple at all) and
// above that same acceptance's own +15 favorability bump
// (ROMANCE_ACCEPT_FAVORABILITY_DELTA): a couple that only just cleared
// the entry gate (pre-ask favorability right at 50) lands at 65
// immediately after accepting — safely inside "flirting," not skipped
// straight to "dating." A couple that was already unusually close before
// asking starts further up the ladder on day one — intended, not a bug:
// they were already close. Placeholder numbers, same "not tuned" caveat
// every other Favorability touch in this scene already carries
// (Hub.ts's own file header, romance.ts's own header on
// ROMANCE_MIN_FAVORABILITY).
export type RelationshipStage = "flirting" | "dating" | "committed";

export const RELATIONSHIP_DATING_FAVORABILITY = 70;
export const RELATIONSHIP_COMMITTED_FAVORABILITY = 90;

// Only meaningful once a pair is already together — a favorability/bond
// value for a pair that was never a couple at all doesn't mean anything
// on its own. The caller is responsible for checking inRelationship /
// npcSocial.relationships membership first, same as Hub.ts's
// npcPartnerLabel already does before this ever gets called.
export function deriveRelationshipStage(favorability: number): RelationshipStage {
  if (favorability >= RELATIONSHIP_COMMITTED_FAVORABILITY) return "committed";
  if (favorability >= RELATIONSHIP_DATING_FAVORABILITY) return "dating";
  return "flirting";
}

// Distinct phrasing per stage rather than one template with a swapped
// word — "with you" doesn't read naturally for all three ("committed
// with you" is off; "committed to you" is the one that actually reads
// right).
export function relationshipStagePhrase(stage: RelationshipStage, targetName: string): string {
  switch (stage) {
    case "flirting":
      return `flirting with ${targetName}`;
    case "dating":
      return `dating ${targetName}`;
    case "committed":
      return `committed to ${targetName}`;
  }
}

// Small, catalyst-neutral warm-exchange bank — same "generic first"
// scope call hot topics and the two one-time reveals both made
// originally. Surfaced when Talking to your OWN partner specifically
// (Hub.ts's speak()), not ordinary ambient chatter — a curated moment,
// not a personality beat, so catalyst-neutral content is the right call
// here same as it was for ALREADY_TOGETHER_LINES/CLOSE_FRIEND_ONLY_LINES.
export const RELATIONSHIP_STAGE_LINES: Record<RelationshipStage, string[]> = {
  flirting: [
    "You keep finding a reason to walk past me. I've noticed.",
    "Still figuring this out. I don't mind figuring it out with you.",
  ],
  dating: [
    "Good. You're here. I was hoping you'd swing by.",
    "I keep a running list of things I want to tell you. You're on it a lot lately.",
  ],
  committed: [
    "Feels less like a thing that's happening and more like a thing that just is, now.",
    "I stopped being surprised you're still here. That's the good kind of stopped.",
  ],
};

export function pickRelationshipStageLine(stage: RelationshipStage): string {
  const bank = RELATIONSHIP_STAGE_LINES[stage];
  return bank[Math.floor(Math.random() * bank.length)];
}
