// src/data/hotTopics.ts
// Hot topics — Social Sim Roadmap #1, first slice, 27 Aug 2026, built at
// Maxime's own direction ("fire the next item on the list") right after
// the commanderDown.test.ts flaky-test fix, with one piece of fresh
// feedback in mind: he'd rather test and adjust in smaller pieces than
// get handed another long solo build all at once. This file is the
// deliberately narrow first cut, not the full roadmap vision.
//
// What this is: a small, generic "the crew has heard the news" layer.
// When something notable happens to one pilot, that becomes a HotTopic
// other pilots can bring up when they talk to you — instead of every Hub
// conversation running as if nobody overheard anything that happened
// five minutes ago in the same room.
//
// Scope cut vs. the roadmap doc's own sizing ("Medium-to-large, touches
// pickAmbientLine, the catalyst dictionary, and socialSim's banter"):
//   - Two topic kinds at first cut: a Stage promotion, and a new couple
//     (NPC-NPC OR player-NPC — both read the same to an onlooker: "X is
//     with Y now"). A third, muntiLost, was added later the same day —
//     see its own comment further down, right above the HotTopicKind
//     type. Rourke's own military rank ("Hello, Sir") is deliberately
//     NOT a hot topic — that beat is already covered, directly and
//     one-on-one, by the rank-greeting system; folding it in here would
//     just be two systems saying the same thing at each other. Mission
//     Worry is also deliberately left out: it's a shared flag every
//     present NPC gets at once the instant a mission's been running long
//     enough (see isMissionWorrySignal in Hub.ts), not pilot-specific
//     news, so it doesn't fit the "X happened to Y" shape below without
//     redesigning worry itself first — a separate decision, not made
//     here.
//   - One content bank, catalyst-neutral. The full roadmap vision wants
//     catalyst-flavored reactions (a Wolf hears this differently than a
//     Crow) — deferred, same order this project already used once before
//     for the Stage-promotion reveal itself (generic content shipped
//     first, catalyst-specific variants came later once the mechanism
//     was proven).
//   - One consumer: Hub.ts's own solo Talk exchange (speak()). Not wired
//     into the catalyst dictionary's typed-chat reactions or
//     socialSim.ts's NPC-NPC banter yet — those are the other two legs
//     the roadmap doc names, left for a later pass once this slice has
//     actually been played with.
//   - Not persisted. A HotTopic lives only in Hub.ts's own in-memory
//     array for as long as the tab stays open and the topic hasn't
//     expired or already been mentioned by that speaker. This mirrors
//     Mission Worry's own "recomputed live, gone on reload" choice — not
//     a new precedent — but it does mean a topic doesn't survive closing
//     the tab. Worth revisiting if this turns out to be the one piece
//     that should persist; flagged here, not decided.
//
// No template/slot-substitution infrastructure existed anywhere in the
// codebase before this (grep-confirmed: no {SQUADMATE}, no resolveTemplate,
// nothing) — renderHotTopicLine below is the smallest version that could
// work, a single plain .replace() per placeholder, not a general engine.
//
// Catalyst-flavored content, added 27 Aug 2026 (roadmap #1's own deferred
// stretch goal, built the same day in a second unattended stretch at
// Maxime's direction — "keep building the hub"). Same order this project
// already used once for the Stage-promotion reveal and rank-greeting lines
// (ambientLines.ts's STAGE_PROMOTION_LINES/RANK_GREETING_LINES): generic
// content shipped first to prove the mechanism, catalyst-specific content
// came once it had. Same voice logic as RANK_GREETING_LINES specifically,
// not STAGE_PROMOTION_LINES — this is the crew reacting to someone ELSE's
// news, not describing their own feelings, so each catalyst's persona is
// filtered through "how do I react to someone else's moment" (9 catalysts
// x 2 kinds = 18 buckets, 2 lines each, 36 lines total at this point — the
// flat generic bank below is retired, not kept as a fallback, same as the
// two banks this mirrors did. A third kind, muntiLost, was added the same
// day per its own comment below, bringing the total to 27 buckets / 54
// lines — same voice-per-catalyst treatment, not a regression to generic
// content for the new kind).
import type { Catalyst } from "./ambientLines";

// Third kind, 27 Aug 2026 (roadmap #13, "wire the Munti Respect grief lines
// to their real trigger events") — see campaignState.ts's
// HubPilotSocialState.muntiLossAnnounced and Hub.ts's buildNpcs() for the
// full trigger design (registered directly, not through the
// pendingStagePromotion per-NPC shape, since the lost pilot isn't in the
// Hub to self-announce it). Scope note, worth being explicit about: the roadmap
// item's OTHER half — Shark's "save log hit double digits" / Crow's
// "catalogued every save" flavor — is NOT this. Those two lines already
// shipped as ordinary ambient/echo flavor text in data/ambientLines.ts's
// LINE_BANK (roadmap #14, the Munti Respect fold-in, same day) — they fire
// probabilistically like every other line in their bucket, not gated on a
// real, counted save tally, because no per-pilot save-count actually exists
// in CampaignState yet. Building a literal "your Munti's Nth save" trigger
// would mean adding new persisted state nothing currently tracks — real new
// scope, flagged for Maxime to decide on, not built here. What THIS kind
// covers is narrower and fully honest against real state: a Munti pilot's
// permanent loss, which campaignState.ts's evaluatePermadeathCheck already
// computes for real, live, at the instant of downing.
//
// Fourth and fifth kinds, 27 Aug 2026 (roadmap #9, "a debrief-side echo") —
// missionWin/missionLoss. The roadmap doc's own framing: "The entire Hub
// social layer currently runs completely independent of how the actual war
// is going... A short real-time window right after returning to the Hub
// where ambient/banter content leans toward reacting to that specific
// outcome." Reuses this file's own register/prune/pick/render plumbing
// unchanged, exactly as the roadmap doc predicted once #1's core mechanism
// existed — the "short real-time window" is just this file's own
// HOT_TOPIC_TTL_MS, not a second timer invented for this one kind.
//
// Neither kind uses {ABOUT}/{WITH} substitution — a mission outcome isn't
// "about" one pilot the way a promotion or a loss is, so aboutPilotId holds
// a sentinel (the mission's own id, from campaignState.ts's
// CampaignState.lastMissionEcho) that can never collide with a real
// pilotId, just so pickHotTopicForSpeaker's "not about the speaker
// themselves" check has something real to compare against. aboutName is
// unused for these two kinds (kept as an empty string) since the content
// never references it.
//
// Two deliberate scope cuts, stated so they don't quietly happen later:
// (1) "commander_down" (engine/mission.ts's third real MissionOutcome,
// distinct from an ordinary "loss") folds into missionLoss here rather
// than getting its own flavor — that specific beat already has its own
// dedicated handling elsewhere in the game (see commanderDown.test.ts),
// and duplicating it here would be two systems describing the same event.
// (2) the roadmap doc's own extra texture — "a name conspicuously avoided
// after a loss of that name" — is NOT built. That's a real narrative nuance
// (making an absence itself the content) that doesn't fit this file's
// existing template-substitution shape without new infrastructure; this
// pass ships the more concrete half (catalyst-flavored win/loss reactions,
// correctly gated to fire once per mission) and leaves that refinement
// explicitly open rather than faking it.
export type HotTopicKind = "promoted" | "gotTogether" | "muntiLost" | "missionWin" | "missionLoss";

export interface HotTopic {
  kind: HotTopicKind;
  // The pilot this topic is about — excluded from ever hearing it
  // reflected back at them through this mechanic (see
  // pickHotTopicForSpeaker below). For missionWin/missionLoss this holds a
  // non-pilot sentinel (the mission id) instead — see this file's own
  // header for why.
  aboutPilotId: string;
  aboutName: string; // display name, already split off the "— callsign" suffix — unused for missionWin/missionLoss
  withName?: string; // gotTogether only — the other half of the pair, or "you" for a player relationship
  at: number; // Date.now() when it happened — same wall-clock convention SocialLogEntry.at already uses
  mentionedBy: string[]; // pilotIds who have already brought this topic up once
}

// How long a topic stays worth bringing up. Placeholder, not tuned — same
// caveat every other timing constant in this system (WORRY_ONSET_MS,
// PROPAGATION_HOP_DELAY_MS, ...) already carries in Hub.ts.
export const HOT_TOPIC_TTL_MS = 10 * 60 * 1000; // 10 real minutes

const HOT_TOPIC_LINES: Record<Catalyst, Record<HotTopicKind, string[]>> = {
  wolf: {
    promoted: [
      "Good — the formation's stronger with {ABOUT} carrying more weight now.",
      "{ABOUT} got bumped up a Stage. About time the pack caught up to what they already were.",
    ],
    gotTogether: [
      "{ABOUT} and {WITH}? Good. Two more people watching each other's back — I'll take it.",
      "Didn't see {ABOUT} and {WITH} coming, but it tracks. They already moved like a pair out there.",
    ],
    muntiLost: [
      "We lost {ABOUT}. No Munti was left standing to save them — that's the hard rule, and it doesn't care whose fault anything was.",
      "{ABOUT}'s gone. The formation's got a gap in it now that's not just a name off the roster.",
    ],
    missionWin: [
      "Clean sweep. Everyone made it back to the formation — that's the real win.",
      "Good work out there. The pack held together the whole way through.",
    ],
    missionLoss: [
      "Rough one. We're closing ranks tighter until it stops feeling like this.",
      "Lost ground today. We hold the line tighter next time — together, not scattered.",
    ],
  },
  dog: {
    promoted: [
      "{ABOUT} earned that. I don't say that about everyone.",
      "Good for {ABOUT}. Followed them plenty of times — glad Command's finally caught up.",
    ],
    gotTogether: [
      "{ABOUT} and {WITH}. Didn't need to hear it from anyone — I could already tell.",
      "Happy for {ABOUT} and {WITH}. That's the kind of thing worth being loyal to.",
    ],
    muntiLost: [
      "{ABOUT} didn't make it back. I owed them more than I ever got the chance to pay off.",
      "We lost {ABOUT}. I don't care what the report says — I should've been closer.",
    ],
    missionWin: [
      "Everyone came home. I don't take that for granted, not once.",
      "Good mission. Followed every one of you out there and you all came back.",
    ],
    missionLoss: [
      "Tough one. I'm not leaving anyone's memory behind, whatever the report says.",
      "Lost people today. Doesn't change who I show up for tomorrow.",
    ],
  },
  cat: {
    promoted: [
      "{ABOUT} got bumped up. Doesn't change my exit plan, but good for them.",
      "Heard {ABOUT}'s a Stage higher now. Didn't ask, don't really care — just passing it along.",
    ],
    gotTogether: [
      "{ABOUT} and {WITH} are a thing now, apparently. None of my business, but there it is.",
      "{ABOUT} and {WITH}, huh. Didn't expect it. Doesn't concern me either way.",
    ],
    muntiLost: [
      "{ABOUT}'s gone. Didn't think a name on a casualty list could still get to me like this.",
      "We lost {ABOUT}. Doesn't change my exit plan. Still sat with me longer than I expected it to.",
    ],
    missionWin: [
      "Clean mission. Nobody owes anybody anything extra tonight.",
      "We got out intact. I'll take the win without overthinking it.",
    ],
    missionLoss: [
      "Rough one. Doesn't change my plans, but it's sitting heavier than I'd like to admit.",
      "Lost ground today. I priced this job knowing days like this existed. Still costs more than expected.",
    ],
  },
  crow: {
    promoted: [
      "{ABOUT} got bumped up a Stage! Somebody get a drink going, I'm not waiting for an excuse.",
      "Did you hear about {ABOUT}? Bumped up and everything. Big week for them.",
    ],
    gotTogether: [
      "{ABOUT} and {WITH}?! Okay, that's the best gossip I've had all week.",
      "So {ABOUT}'s with {WITH} now — I need every detail, and I need it immediately.",
    ],
    muntiLost: [
      "{ABOUT} didn't make it. I don't have a bit ready for this one. Not today.",
      "We lost {ABOUT}. Every part of me wants to go find something to obsess over instead of just feeling it.",
    ],
    missionWin: [
      "We WON. Somebody find a reason to celebrate, I'm not waiting for one.",
      "Clean mission! Tonight's earned, no arguments.",
    ],
    missionLoss: [
      "Rough one. Don't really feel like a bit tonight, if I'm honest.",
      "Lost people today. I don't have the distraction for this one yet.",
    ],
  },
  raven: {
    promoted: [
      "{ABOUT} moved up a Stage. Good — means the lessons they're teaching land with more weight now.",
      "Heard {ABOUT} got bumped up. Earned, from what I've seen of them.",
    ],
    gotTogether: [
      "{ABOUT} and {WITH}. Good pairing, if you ask me — they'll teach each other plenty.",
      "Word is {ABOUT}'s with {WITH} now. Makes sense, watching how they work together.",
    ],
    muntiLost: [
      "{ABOUT}'s gone. No living Munti to save them — I've taught that exact rule for years and it still didn't stop this.",
      "We lost {ABOUT}. There's no lesson in this one. Just the gap where they used to stand.",
    ],
    missionWin: [
      "Clean execution out there. Whatever we did right, we're doing it again.",
      "Good mission. I'm already writing down what worked.",
    ],
    missionLoss: [
      "Hard one. There's a lesson in it somewhere — not ready to find it yet.",
      "Lost ground today. We'll debrief it properly once it doesn't still hurt to look at.",
    ],
  },
  bear: {
    promoted: [
      "{ABOUT} got bumped up. Didn't say much when I heard. Still glad for them.",
      "Heard about {ABOUT}'s promotion. Good. That's the whole thought.",
    ],
    gotTogether: [
      "{ABOUT} and {WITH}, apparently. Wasn't expecting to hear that, but good for them.",
      "So {ABOUT}'s with {WITH} now. Didn't ask around — it found me anyway.",
    ],
    muntiLost: [
      "{ABOUT} didn't make it back. Give me the room. I'll be functional tomorrow.",
      "We lost {ABOUT}. I watch every flank I can reach. Wasn't watching that one closely enough.",
    ],
    missionWin: [
      "Good mission. Don't need to say much more than that.",
      "Clean one. Noticed everyone made it back. That's mine, quietly.",
    ],
    missionLoss: [
      "Rough one. Give me the room for a while.",
      "Lost people today. I'll be functional tomorrow. Not tonight.",
    ],
  },
  fox: {
    promoted: [
      "{ABOUT} got bumped up a Stage. Already thinking of three ways that changes the angles around here.",
      "Heard about {ABOUT}. Command's finally noticing what the rest of us already knew.",
    ],
    gotTogether: [
      "{ABOUT} and {WITH}, huh. Didn't see that coming — I usually see everything coming.",
      "So {ABOUT}'s with {WITH} now. That's going to be fun to watch play out.",
    ],
    muntiLost: [
      "{ABOUT}'s gone. I don't have an angle that gets anyone out of a loss like that one.",
      "We lost {ABOUT}. No trick worth running today. Just the loss, plain and ugly.",
    ],
    missionWin: [
      "Clean win. Whatever angle worked out there, I'm filing it away.",
      "Good mission — didn't even need a trick this time. Almost boring.",
    ],
    missionLoss: [
      "Rough one. No clever angle gets us out of a day like this.",
      "Lost ground today. Even I don't have a play for this one.",
    ],
  },
  rabbit: {
    promoted: [
      "{ABOUT} got bumped up a Stage. Good — means one more person out there who can keep the rest of us safer.",
      "Heard about {ABOUT}'s promotion. However it happened, I'm glad it's someone who looks out for people.",
    ],
    gotTogether: [
      "{ABOUT} and {WITH}? That's good news. We could use more of that around here.",
      "So {ABOUT}'s with {WITH} now. Glad they've got someone looking out for them too.",
    ],
    muntiLost: [
      "We lost {ABOUT}. If the Munti's not there to catch the fall, none of us are as safe as we act like we are.",
      "{ABOUT}'s gone. I keep running the math on who else was standing near them. It doesn't help. I do it anyway.",
    ],
    missionWin: [
      "Everyone came home whole. That's the whole job, far as I'm concerned.",
      "Clean mission — means I get a quiet night for once. I'll take it.",
    ],
    missionLoss: [
      "Rough one. Come find me if you need to talk, any of you.",
      "Lost people today. Let me know if you need anything — I mean that.",
    ],
  },
  shark: {
    promoted: [
      "{ABOUT} got bumped up. About time — they've been outworking that tier for a while.",
      "Heard about {ABOUT}'s promotion. Earned, not handed. Good.",
    ],
    gotTogether: [
      "{ABOUT} and {WITH}, huh. Didn't see the angle, but good for them.",
      "So {ABOUT}'s with {WITH} now. Fine — as long as it doesn't slow either of them down.",
    ],
    muntiLost: [
      "We lost {ABOUT}. Every kill I've ever gotten only happened because a Munti was somewhere keeping me standing long enough to get it. That math just changed.",
      "{ABOUT}'s gone. No board, no ranking makes that one worth anything today.",
    ],
    missionWin: [
      "Clean win. That's the standard now — let's keep it there.",
      "Good mission. Numbers looked right across the board.",
    ],
    missionLoss: [
      "Rough one. Doesn't change the target, just the cost of hitting it.",
      "Lost ground today. We earn it back. That's the only move.",
    ],
  },
};

// Pure filter — Hub.ts owns actually replacing its own array with the
// result each frame (same shape updateDrunkExpiry/updateMissionWorry
// already use for their own per-frame housekeeping).
export function pruneExpiredHotTopics(topics: HotTopic[], now: number): HotTopic[] {
  return topics.filter((t) => now - t.at < HOT_TOPIC_TTL_MS);
}

// A topic is only fair game for a given speaker if it isn't ABOUT that
// speaker (hearing your own news echoed back at you by the same mouth
// that could just tell you directly isn't gossip, it's redundant) and
// this speaker hasn't already brought it up once before (same "said
// once, not on a loop" shape every other one-time beat in Hub.ts uses —
// pendingStagePromotion, pendingRankGreeting).
export function pickHotTopicForSpeaker(topics: HotTopic[], speakerPilotId: string): HotTopic | undefined {
  return topics.find((t) => t.aboutPilotId !== speakerPilotId && !t.mentionedBy.includes(speakerPilotId));
}

// speakerCatalyst is the pilot BRINGING UP the topic, not the pilot it's
// about — same "reacting to someone else's moment" voice RANK_GREETING_LINES
// already established, not STAGE_PROMOTION_LINES' own "how I feel about
// MY OWN moment" voice (see this file's header for the full reasoning).
export function renderHotTopicLine(topic: HotTopic, speakerCatalyst: Catalyst): string {
  const bank = HOT_TOPIC_LINES[speakerCatalyst][topic.kind];
  const template = bank[Math.floor(Math.random() * bank.length)];
  return template.replace("{ABOUT}", topic.aboutName).replace("{WITH}", topic.withName ?? "");
}
