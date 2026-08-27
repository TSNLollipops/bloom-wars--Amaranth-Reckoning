// src/data/ambientLines.ts
// Ported 25 Aug 2026 from claude/pilot_creator.html's LINE_BANK +
// pickSoloEchoForPilot, verbatim — per
// claude/Bloom_Wars_Walkable_Hub_Build_Plan_v1.md §5's own instruction for
// Phase 1: "port this selection logic and LINE_BANK directly rather than
// re-authoring placeholder lines the way the movement/interaction spike
// did." Nothing below is new writing; it's a straight copy of already-
// tested content out of the sandbox and into the real engine's data layer.
//
// Scope note, so this doesn't get mistaken for more than it is: this file
// only carries the SOLO echo pick (drunk / panicking / low morale / idle).
// pilot_creator.html's gossip variant (findClosestBond/findWorstRival,
// ~35% chance of naming a bonded or rival pilot) depends on a persistent
// Favorability store, which doesn't exist on the real PilotRecord/
// CampaignState yet (see types.ts's own `socialHook` comment — Favorability
// is explicitly still a stub, Antfarm §13.2, not built into the engine).
// The Hub scene's own Favorability readout is local/demo data for the same
// reason. Wiring a real, persistent Favorability store is a separate,
// unbuilt decision — not made here, not silently assumed.
//
// grief-worn (isGriefWorn, muntiesLost.length >= GRIEF_THRESHOLD) is left
// out for the same reason: it reads off a pilot's persistent loss history,
// which the real engine doesn't track per-pilot yet either (permadeath is
// tracked as roster removal, not as a log on the survivors). Every other
// branch of pickSoloEchoForPilot is ported as-is.

import type { Tier } from "./types";

export type Catalyst = "wolf" | "dog" | "cat" | "crow" | "raven" | "bear" | "fox" | "rabbit" | "shark";
export type Echo = "love" | "fear" | "anger" | "sadness";

// Stage — rank & gear tier, ported from claude/pilot_creator.html's own
// STAGES/STAGE_ORDER (Antfarm Carrier Hub §12): Green (2nd Lt., gear G–F),
// Blooded (Capt., gear E–C), Command (Maj., gear B–A). Wired 27 Aug 2026,
// Maxime: "do the ranking path" — the stage axis both content sources
// (the sandbox's 324 lines and the delivery's 378) already carried, and
// which the 26 Aug flat-port pass deliberately left un-gated pending this
// decision (see the LINE_BANK header below for that pass's own reasoning).
export type Stage = "green" | "blooded" | "command";
export const STAGE_ORDER: Stage[] = ["green", "blooded", "command"];

// Maps a pilot's persisted gear Tier (data/types.ts, already tracked per
// pilot via PilotRecord.tier — no new save-data field needed for this) onto
// a Stage, using pilot_creator.html's own already-locked ladder verbatim:
// G–F -> Green, E–C -> Blooded, B–A -> Command. A pilot's tier already
// changes over a campaign (engine/campaignEconomy.ts's purchaseTierUpgrade)
// so this is meant to be called fresh off the live tier each time a Stage
// is needed, not cached once and forgotten — see scenes/Hub.ts's buildNpcs()
// for the one real call site.
export function stageFromTier(tier: Tier): Stage {
  if (tier === "G" || tier === "F") return "green";
  if (tier === "B" || tier === "A") return "command";
  return "blooded"; // E, D, C
}

// Stage-promotion detection, 27 Aug 2026 — Maxime asked, point-blank,
// whether a player would actually notice the ranking path wired earlier
// the same day. Checked against the real UI rather than guessed: nothing
// in the Hub shows a pilot's Stage anywhere, so a promotion via a gear-
// tier purchase elsewhere in the game silently changed dialogue tone with
// zero signal pointing at it. This is the detection half of the fix — see
// scenes/Hub.ts's buildNpcs()/speak()/ackStagePromotion for the rest, and
// STAGE_PROMOTION_LINES below for what actually gets said.
//
// Pulled out as a pure function on purpose, same reasoning as
// stageFromTier itself living here rather than inline in Hub.ts:
// testable without Phaser, and this is genuinely about the Stage domain,
// not Hub-scene bookkeeping. `lastAcknowledged` is undefined for a
// brand-new pilot's social state, or an old save predating this field —
// either way there's nothing on record to graduate FROM, so the caller
// should backfill its own stored value to the pilot's current stage
// rather than treat this as a promotion (see Hub.ts's own comment at the
// one real call site for that half). A real change from one recorded
// stage to a different one is always exactly one step forward — a live
// tier only ever moves one TIER_ORDER step per purchase
// (engine/campaignEconomy.ts's purchaseTierUpgrade), and Stage buckets
// multiple tiers together, so a single purchase can cross at most one
// Stage boundary. Nothing promotes INTO green (there's no downgrade path
// anywhere in the campaign economy), so that's not a valid return value —
// if `currentStage` somehow reads as green after a real recorded change
// (it shouldn't, given the above, but this stays defensive rather than
// asserting), this reports no promotion rather than a nonsensical one.
export function detectStagePromotion(lastAcknowledged: Stage | undefined, currentStage: Stage): "blooded" | "command" | undefined {
  if (lastAcknowledged === undefined || lastAcknowledged === currentStage) return undefined;
  return currentStage === "green" ? undefined : currentStage;
}

const PANIC_THRESHOLD = 25; // matches pilot_creator.html's own "panicking" cutoff

// Exported, 26 Aug 2026 — Phase 3's reactionGate.ts needs the same Stress
// panic cutoff pickSoloEcho already reads inline below, so it's pulled out
// as a real constant rather than duplicated as a second magic 70 that could
// drift out of sync with this one (same reasoning as DART_ZONE_THRESHOLDS
// being shared between darts.ts and Hub.ts instead of hand-copied twice).
export const STRESS_PANIC_THRESHOLD = 70;

export type AmbientPilotState = {
  catalyst: Catalyst;
  // Stage, wired 27 Aug 2026 — see the Stage type's own comment above.
  // Required, not optional: every real pilot has a real gear tier and
  // therefore a real Stage, same as catalyst itself. Every existing
  // construction site (Hub.ts's live NPCs, socialSim.ts's simulated
  // listener/speaker states, this file's own tests) was updated alongside
  // this change rather than left to silently default.
  stage: Stage;
  stress: number; // 0-100
  morale: number; // 0-100
  drunk: boolean;
  // Mission Worry, Hub polish, 26 Aug 2026 — Spitball Ideas, locked 25-26
  // Aug: crew left behind in the Hub worry about a crewmate currently out
  // on a mission. Optional, not required like the four fields above,
  // deliberately: Hub.ts is the only real caller that can ever set this
  // (it's the only scene that reads CampaignState.activeMissionAttempt),
  // so every other existing construction site (socialSim.ts's simulated
  // listener state, this file's own tests) stays valid untouched with it
  // simply absent/undefined — same as leaving it out entirely. See
  // Hub.ts's isMissionWorrySignal() for how it actually gets computed;
  // this file only needs to know it's a plain boolean once decided.
  worried?: boolean;
};

export type EchoPick = { echo: Echo; reason: string };

// Solo echo pick — ported verbatim from pilot_creator.html's
// pickSoloEchoForPilot (line ~3753), minus the grief-worn branch (see file
// header). Order matters: acute states (drunk/panicking/low-morale) take
// priority over the idle fallback, same as the sandbox.
//
// worried folded into the existing fear branch, 26 Aug 2026, rather than
// given its own priority slot: panicking-from-Stress and worried-about-a-
// crewmate both read as the same echo (fear) today, since LINE_BANK is
// keyed by catalyst+echo only, not by reason — a spot check of the actual
// fear-bank content (e.g. the wolf catalyst: "Don't scatter... we lose
// someone else," "Sound off, I need to hear every voice") already reads as
// crewmate-worry as much as self-panic, so there's no content mismatch in
// sharing the pool. `reason` still records which one actually fired, in
// case a future pass wants to split the content for real.
export function pickSoloEcho(pilot: AmbientPilotState): EchoPick {
  if (pilot.drunk) return { echo: Math.random() < 0.5 ? "love" : "anger", reason: "drunk" };
  if (pilot.stress >= STRESS_PANIC_THRESHOLD) return { echo: "fear", reason: "panicking" };
  if (pilot.worried) return { echo: "fear", reason: "worried" };
  if (pilot.morale <= PANIC_THRESHOLD) return { echo: "sadness", reason: "low morale" };
  const pool: Echo[] = ["love", "fear", "anger", "sadness"];
  return { echo: pool[Math.floor(Math.random() * pool.length)], reason: "idle" };
}

export function pickAmbientLine(pilot: AmbientPilotState): { line: string; pick: EchoPick } {
  const pick = pickSoloEcho(pilot);
  const bank = LINE_BANK[pilot.catalyst][pick.echo][pilot.stage];
  return { line: bank[Math.floor(Math.random() * bank.length)], pick };
}

// ---- General "word travels through the hub" messages, 25 Aug 2026 -------
// Maxime: "the reaction spread gotta work in any situation that my call for
// it" — a mission-muster call and a rejection rumor, named as two concrete
// examples of the same underlying thing. This generalizes the telephone-
// wave prototype (scenes/Hub.ts) from "carries a forced emotion" to
// "carries any HubMessage" — the relay/decay/mutate plumbing in Hub.ts
// doesn't change, only what it's allowed to carry. Scope, kept to exactly
// what was asked (Maxime, same day: "keep to the plan"): this proves the
// message travels and reads correctly for two real payload kinds. It does
// NOT include NPCs walking anywhere, a real chat/command UI, or wiring
// into mission launch — those are the Build Plan doc's own §9 items 2-4,
// explicitly not started.
export type HubMessage =
  | { kind: "emotion"; echo: Echo }
  | { kind: "muster" }
  | { kind: "rumor"; askerName: string; rejectorName: string; exaggerated?: boolean };

const MUSTER_LINES = [
  "On my way — meet you at the bay.",
  "Copy that. Suiting up now.",
  "Finally. Let's move.",
  "Heard. Heading over.",
  "About time — right behind you.",
  "Bay, got it. Moving.",
];

// Rumor content, ported from Maxime's own example verbatim ("mc asked
// someone out and got rejected, everyone will know it") rather than an
// invented scenario. Two tiers, not one — the exaggerated bank is what
// DISTORT_MESSAGE (below) swaps a rumor into partway through a relay
// chain, same "telephone" spirit as the emotion distortion, but here it's
// actually thematic instead of arbitrary: a rumor is exactly the kind of
// thing that grows in the retelling. Once a rumor exaggerates, it stays
// exaggerated for the rest of its trip — rumors don't walk themselves back.
const RUMOR_LINES_MILD = [
  "Wait — {asker} actually asked {rejector} out?",
  "Heard {rejector} turned {asker} down. Rough.",
  "{asker} asked {rejector} out? Didn't see that coming.",
  "Poor {asker}. {rejector} said no, apparently.",
];
const RUMOR_LINES_EXAGGERATED = [
  "You didn't hear? {asker} practically proposed and {rejector} laughed them out of the room.",
  "Word is {rejector} humiliated {asker} in front of half the deck.",
  "Apparently {asker} got shot down so hard {rejector} had to leave the room.",
  "I heard {asker} hasn't shown their face since {rejector} turned them down.",
];

// Stage-promotion "graduation" reveal content, 27 Aug 2026 — see
// detectStagePromotion's own header above for the full "why this exists"
// reasoning. Catalyst-NEUTRAL for the first pass, on purpose — see that
// pass's own reasoning, preserved in this file's git-less history via the
// Build Log Addendum §37. Roadmap doc #4 flagged catalyst-specific content
// as the real follow-up, sized deliberately small ("18 lines, not 700");
// written for real 27 Aug 2026, same day, once "Hello, Sir" needed its own
// catalyst-specific rank-greeting bank right below and it made sense to do
// both passes together rather than leave one generic and one flavored.
// Two lines per catalyst per transition (not the roadmap's literal minimum
// of one) — a promotion is heard exactly once by the pilot it happens to,
// so zero variety there would be fine, but the same content is ALSO what
// RANK_GREETING_LINES below draws from when several NPCs sharing a
// catalyst react to the same Rourke promotion in the same session, where a
// single line repeating verbatim across pilots would read as an obvious
// canned response. Every catalyst's own established persona (this file's
// own catalystProfile.ts header: wolf=teamwork, dog=loyalty, cat=
// selfishness, crow=indulgence, raven=instruction, bear=isolation, fox=
// trickery, rabbit=nurturing, shark=ambition) is written into both lines
// per bucket, not just referenced once and dropped.
const STAGE_PROMOTION_LINES: Record<Catalyst, Record<"blooded" | "command", string[]>> = {
  wolf: {
    blooded: [
      "Feels different holding position now — like the formation actually needs me there, not just fills a slot.",
      "Didn't expect new gear to change how I read the pack. Turns out it does.",
    ],
    command: [
      "They're putting the formation's shape in my hands now. Strange thing to trust a wolf with, but here we are.",
      "Command tier means the pack looks at me before they scatter or hold. I don't plan on letting them down.",
    ],
  },
  dog: {
    blooded: [
      "New kit, same promise — I follow through either way, but I'll admit this makes it easier.",
      "Didn't ask for an upgrade. Command gave me one anyway. Guess loyalty runs both directions.",
    ],
    command: [
      "Command rank on a dog like me — feels less like a reward and more like they're finally trusting the promise all the way.",
      "I've followed longer than I've led. This tier means somebody thinks I can do both now.",
    ],
  },
  cat: {
    blooded: [
      "New gear. Didn't ask, didn't need to — figured it'd find me eventually if I stuck around long enough.",
      "Upgrade came through. Doesn't change the exit plan, just makes it a better one.",
    ],
    command: [
      "Command tier. Funny — the higher they push me, the harder it gets to just walk when I want to.",
      "I keep telling myself this doesn't change anything. It changes plenty. I'm still working out how I feel about that.",
    ],
  },
  crow: {
    blooded: [
      "New kit's shinier, at least. That's about the only part of this I fully understand right now.",
      "They upgraded me mid-chaos and somehow that feels exactly right.",
    ],
    command: [
      "Command rank. Didn't see that one coming — least predictable thing that's happened to me all week, and that's saying something.",
      "They gave a crow real authority. Somebody upstairs has a sense of humor, or none at all.",
    ],
  },
  raven: {
    blooded: [
      "New tier means the plans I draw up actually have teeth behind them now.",
      "Upgrade came through. Good — means fewer of my own lessons get learned the hard way from here.",
    ],
    command: [
      "Command-grade now. The lesson I keep teaching myself: rank doesn't replace a plan, it just means more people are counting on mine.",
      "They handed a raven real command. I intend to make sure every mistake under it gets taught, not repeated.",
    ],
  },
  bear: {
    blooded: [
      "New kit. Didn't need the company to feel it — quieter confidence, same as always.",
      "Upgrade landed. Still prefer the corner. Just a better-armed corner now.",
    ],
    command: [
      "Command rank doesn't sit easy with a bear who'd rather be alone. Taking it anyway. Somebody has to.",
      "Funny — the higher the tier, the less quiet I get to be. Worth it. Still getting used to it.",
    ],
  },
  fox: {
    blooded: [
      "New gear. Already found three ways it changes my angles on a fight — that's the fun part.",
      "Upgrade came through clean, no scheme required. Almost disappointing.",
    ],
    command: [
      "Command tier. Nobody hands a fox real authority without expecting a few surprises. I don't intend to disappoint.",
      "Higher rank just means my angles get bigger. Command's going to regret this or thank me for it — no in-between with me.",
    ],
  },
  rabbit: {
    blooded: [
      "New kit. First thing I thought — good, now I can actually keep more people safe out there.",
      "Upgrade landed. Doesn't feel like it's about me. Feels like one more thing I can do for everyone else.",
    ],
    command: [
      "Command rank on someone who just wants everyone to make it home. Strange fit. I'll make it work.",
      "They gave me real authority. First thing I'm doing with it is making sure nobody out there feels alone.",
    ],
  },
  shark: {
    blooded: [
      "New tier. About time — I've been outworking this gear for a while now.",
      "Upgrade's in. Good. Gives me more room to push.",
    ],
    command: [
      "Command rank. Exactly where I was driving toward — now the real work starts.",
      "They gave me the ground I wanted. Now watch what I do with it.",
    ],
  },
};

export function pickStagePromotionLine(catalyst: Catalyst, toStage: "blooded" | "command"): string {
  const bank = STAGE_PROMOTION_LINES[catalyst][toStage];
  return bank[Math.floor(Math.random() * bank.length)];
}

// ---- Rourke rank-deference greeting ("Hello, Sir"), 27 Aug 2026 ---------
//
// Maxime's wishlist item, added to the roadmap then built the same day:
// "plugging in Hello, SIr from lower ranked to higher rank." Rourke ("Lark,"
// 2nd Lt.) is established female throughout the campaign doc ("she"
// throughout) — a literal "sir" would misgender her, so this uses her rank
// title directly ("Captain"/"Major") instead. Same information content
// (deference from a lower rank to a higher one), corrected for the one
// word that doesn't fit her.
//
// Modeled directly on detectStagePromotion/STAGE_PROMOTION_LINES/
// pickStagePromotionLine just above — same shape, same reveal-once-on-
// promotion trigger, same reasoning for why: every named pilot in the
// roster (Bosk M.Sgt., Anand Cpl., Iyari Pvt., Lask Spec., every generated
// recruit) sits below whatever rank Rourke holds
// (Bloom_Wars_Rank_And_Command_v1.md's own locked roster), so this fires
// for every NPC, unconditionally, the moment engine/campaignState.ts's
// rourkeRank actually changes — not a repeating ambient bark. Deliberately
// scoped this way rather than as a new standing "greets Rourke by rank
// every so often" system: that would need its own cooldown and a bank
// sized for real repetition without going stale, which is new-system scope
// flagged to claude/Bloom_Wars_Social_Sim_Roadmap_v1.md rather than
// improvised here — "finishing what we got" read as this bounded reveal.
//
// Takes/returns plain "2nd_lt" | "capt" | "maj" string literals rather than
// importing engine/campaignState.ts's own Rank type: Build Brief §5.2's
// data/-purity ESLint rule (enforced above this file too) forbids src/data
// importing from src/engine, and TypeScript's structural typing makes an
// actual import unnecessary here anyway — a real Rank value satisfies
// these literal unions with no cast needed at any call site.
export function detectRankPromotion(
  lastAcknowledged: "2nd_lt" | "capt" | "maj" | undefined,
  currentRank: "2nd_lt" | "capt" | "maj"
): "capt" | "maj" | undefined {
  if (lastAcknowledged === undefined || lastAcknowledged === currentRank) return undefined;
  return currentRank === "2nd_lt" ? undefined : currentRank;
}

// Catalyst-specific, written the same pass as STAGE_PROMOTION_LINES' own
// catalyst-flavored rewrite above and for the same reason — see that
// bank's own comment for the full "why now, why two lines" reasoning. This
// is the crew SPEAKING TO Rourke (deference), not about themselves, so the
// voice here is each catalyst's persona filtered through "how do I react
// to someone else's promotion" rather than "how do I feel about my own."
const RANK_GREETING_LINES: Record<Catalyst, Record<"capt" | "maj", string[]>> = {
  wolf: {
    capt: [
      "Captain now. Good — the formation holds better when the person leading it has the rank to back the calls.",
      "Word's already gone through the pack, Captain. Nobody's arguing with it.",
    ],
    maj: [
      "Major. The whole formation answers to you now, not just the lance. Good — you've earned every bit of that ground.",
      "Didn't figure the pack would grow this fast under one CO. Good thing it's you, Major.",
    ],
  },
  dog: {
    capt: [
      "Congratulations, Captain. Wasn't following you for the rank. Doesn't hurt that Command's finally caught up, though.",
      "Captain suits you. I'd have followed either way — figured you should know that.",
    ],
    maj: [
      "Major now. Feels right, somehow — like the rank's just catching up to what this crew already knew about you.",
      "Wherever you're leading us next, Major, count me in. Same as always.",
    ],
  },
  cat: {
    capt: [
      "Captain. Didn't expect to care about a promotion that isn't mine, but here we are.",
      "Congratulations, Captain. Doesn't change my exit plan. Does make me a little less eager to use it.",
    ],
    maj: [
      "Major. Didn't think I'd stick around this long under anyone's command. Still here, though.",
      "You made Major. I'm still mostly in this for myself — mostly.",
    ],
  },
  crow: {
    capt: [
      "Captain! Somebody get a drink going, this is worth celebrating properly.",
      "Didn't see the promotion coming, Captain, but I'll take any excuse for good news right now.",
    ],
    maj: [
      "Major?! Command's really speedrunning this. Good for you — good for all of us, honestly.",
      "This calls for something louder than a salute, Major. I'm working on it.",
    ],
  },
  raven: {
    capt: [
      "Captain. Good — the lessons land harder when the person teaching them actually holds the rank for it.",
      "Congratulations, Captain. Hope Command's paying as much attention as the rest of us have been.",
    ],
    maj: [
      "Major now. That's a lot of people learning from your calls instead of just this lance. Good — they're learning from someone worth it.",
      "Command finally caught up to what you already were, Major. About time.",
    ],
  },
  bear: {
    capt: [
      "Captain. Didn't say much when I heard. Still glad it's you.",
      "Congratulations, Captain. That's the whole sentence — I mean it plenty.",
    ],
    maj: [
      "Major. Don't need to make a thing of it. Just — good. That's all.",
      "Rank's bigger now, Major. Doesn't change how I see you. Figured you'd want that said plainly.",
    ],
  },
  fox: {
    capt: [
      "Captain now, huh? Command finally noticed what the rest of us already knew how to use.",
      "Congratulations, Captain. I've got three ideas already for how this changes what we can get away with.",
    ],
    maj: [
      "Major. Didn't think Command moved that fast for anyone. Good angle to have on our side now.",
      "You outrank half the deck now, Major. I can work with that.",
    ],
  },
  rabbit: {
    capt: [
      "Captain. First thing I thought — good, now more people are safer with you calling it.",
      "Congratulations, Captain. However this changes things, I'm glad it's someone who actually looks out for us.",
    ],
    maj: [
      "Major. That's a lot more people counting on you now. I know you'll look out for every one of them.",
      "Wish it came at a quieter time, Major. Congratulations, all the same.",
    ],
  },
  shark: {
    capt: [
      "Captain. About time Command noticed. You've been outworking that rank for a while.",
      "Congratulations, Captain. Wear it. You earned every inch of it.",
    ],
    maj: [
      "Major. That's the ground you were driving for. Glad to be standing on it with you.",
      "You pushed for this, Major, and it shows. Good — now push further.",
    ],
  },
};

export function pickRankGreetingLine(catalyst: Catalyst, rank: "capt" | "maj"): string {
  const bank = RANK_GREETING_LINES[catalyst][rank];
  return bank[Math.floor(Math.random() * bank.length)];
}

function fillTemplate(line: string, vars: Record<string, string>): string {
  return line.replace(/\{(\w+)\}/g, (_match, key: string) => vars[key] ?? `{${key}}`);
}

// The single place that turns "what is this NPC saying" from a HubMessage
// into an actual line — every message kind funnels through here, same as
// pickAmbientLine does for the solo-idle case above.
//
// Takes the speaker's catalyst + stage (a plain subset, not the full
// AmbientPilotState — muster/rumor callers don't have Stress/Morale/drunk
// handy and don't need them) rather than catalyst alone, wired 27 Aug 2026
// alongside the rest of the Stage gating — every Hub.ts call site already
// had `npc.ambient` on hand, so this only changed what got passed in, not
// what got looked up.
export function pickLineForMessage(speaker: { catalyst: Catalyst; stage: Stage }, message: HubMessage): string {
  if (message.kind === "emotion") {
    const bank = LINE_BANK[speaker.catalyst][message.echo][speaker.stage];
    return bank[Math.floor(Math.random() * bank.length)];
  }
  if (message.kind === "muster") {
    return MUSTER_LINES[Math.floor(Math.random() * MUSTER_LINES.length)];
  }
  const bank = message.exaggerated ? RUMOR_LINES_EXAGGERATED : RUMOR_LINES_MILD;
  const line = bank[Math.floor(Math.random() * bank.length)];
  return fillTemplate(line, { asker: message.askerName, rejector: message.rejectorName });
}

const EMOTION_DISTORT_MAP: Record<Echo, Echo> = { anger: "fear", fear: "anger", love: "sadness", sadness: "love" };

// Per-kind distortion — what "the message mutates in transit" means is
// different per kind, not one universal rule. An emotion flips to an
// adjacent one (existing behavior). A rumor exaggerates (see the two rumor
// banks' own comment) and stays exaggerated once it has. A muster call
// does NOT distort — a call-to-arms garbling into nonsense mid-relay would
// undermine the one thing it needs to do, so this is a deliberate no-op,
// not an oversight.
export function distortMessage(message: HubMessage): HubMessage {
  if (message.kind === "emotion") return { kind: "emotion", echo: EMOTION_DISTORT_MAP[message.echo] };
  if (message.kind === "rumor") return { ...message, exaggerated: true };
  return message;
}

// LINE_BANK — stage-gated 27 Aug 2026, replacing the 26 Aug flat port.
//
// History: originally a straight port of pilot_creator.html's LINE_BANK
// (180 lines, no stage axis). That grew, in the project's own canonical
// claude/pilot_creator.html, into a staged bank (324 lines: 9 catalysts x
// 4 echoes x (2 Green + 5 Blooded + 2 Command)) — the original 180 survives
// inside it untouched as the Blooded tier (spot-verified word for word).
// A separate writing pass then delivered 378 more lines on top of that
// (claude/Bloom_Wars_Ambient_Line_Bank_Delivery_v1.md — 297 of Crew Banter
// Phrase Bank's lines correctly re-sorted onto this engine's echo AND stage
// axes, plus 81 new lines targeting the thin buckets, anger chief among
// them), each row individually tagged Green/Blooded/Command.
//
// 26 Aug 2026's pass folded all 702 lines (324 + 378) into one flat pool
// per catalyst x echo bucket, deliberately NOT wiring the stage axis yet —
// Maxime, that day: "for the next stage your call as long as the fork isnt
// forgotten." 27 Aug 2026, Maxime: "do the ranking path" — this pass
// re-partitions that same 702-line pool by its already-authored Stage tag
// instead of discarding it, and wires Stage as a real, live-derived
// property of AmbientPilotState (see the Stage type and stageFromTier
// above) rather than flattening it away. Every one of the 702 lines still
// present, now correctly bucketed — the merge was re-verified two ways
// before this shipped: (1) every catalyst x echo x stage cell's size
// against the delivery doc's own §12 census math, and (2) flattening this
// entire nested structure back down reproduces the prior flat pool
// exactly, catalyst by catalyst, echo by echo, zero lines gained or lost.
//
// The fork, recorded here so it keeps surviving outside chat history: this
// session's own local sandbox copy of pilot_creator.html (outside this
// repo) went stale at some point and no longer matches the project's own
// canonical claude/pilot_creator.html doc. Any future design-content check
// of "the sandbox" should read the project doc directly, not a local copy.
//
// What changed in the surrounding engine to make this real rather than
// cosmetic: LINE_BANK's own type gained a Stage layer (Record<Catalyst,
// Record<Echo, Record<Stage, string[]>>>); AmbientPilotState.stage is now
// a required field, set from stageFromTier(pilot.tier) at the one real
// construction site (scenes/Hub.ts's buildNpcs(), reading the pilot's
// LIVE campaign tier — CampaignState.pilots[id].pilot.tier — not the
// static WARDEN_PILOTS starting value, so a pilot promoted mid-campaign
// via gear-tier purchases speaks in their new Stage's voice, not their
// starting one); pickAmbientLine and pickLineForMessage both index by
// stage now; catalystProfile.ts's pickCatalystReaction reads the
// responding pilot's own stage regardless of which catalyst (primary or
// sub-animal) actually answers, since Stage is a property of the pilot's
// career, not of any one catalyst identity; socialSim.ts's SocialSimPilot
// carries stage too, so the background NPC-to-NPC sim and the live Hub's
// staged encounters draw from the same rank-appropriate pool. Every
// existing test file's pilot-construction helper was updated to supply a
// stage (defaulting to "blooded," matching what those tests were
// implicitly exercising before the axis existed).

export const LINE_BANK: Record<Catalyst, Record<Echo, Record<Stage, string[]>>> = {
  wolf: {
    love: {
      green: ["First time out and you already had my back — I won't forget that.", "We're a team now, right? Say we're a team.", "Just tell me where you need me and I'll be there. That's — that's the whole plan, right? Stick together?", "Nobody warned me how much of this job is just knowing where everyone else is standing.", "That was the first time I actually felt like part of something instead of just next to it.", "I moved because you moved. Didn't even think about it. Is that bad?", "Deal me in. I'm terrible at this, but I'd rather lose with everyone watching than win alone.", "One drink. I want to remember tonight, not black it out.", "Okay — okay, that's twice now I've almost had a heart attack over someone who's standing right there laughing at me."],
      blooded: ["Good, you're here — makes the squad feel whole again.", "Don't go quiet on me. We're stronger loud, together.", "You're part of this crew whether you admit it or not.", "Nobody drinks alone, nobody walks point alone. That's the deal.", "Good instincts today — you moved like you trust us now.", "Ask me who's got point today and I already know, without checking the board.", "Nobody got left. I stopped taking that for granted a while ago.", "You covered a lane you didn't have to. I noticed. I always notice now.", "There's a version of that fight where I go it alone and it goes worse. I know which version I picked.", "Fletchers, and I'm not letting anyone hustle me twice in one deployment.", "Buy the next round. Not because I lost — because we're all still here to drink it.", "You scared ten years off every one of us. Ten. We counted."],
      command: ["Nobody fights alone under me. That's not a policy, it's a promise.", "You're not just squadmates. You're the reason any of this works.", "This isn't my squad. It's ours. I just happen to be the one who says 'move' first.", "Half of leading is knowing which of you needs a push and which of you needs me to shut up and trust it.", "I've stopped keeping score of who saved who. Lost track years ago. That's the point.", "Every one of you walked back. I don't say that lightly and I don't say it every time — today I'm saying it.", "That's what a squad that trusts each other looks like from the outside. Good. Remember what it felt like.", "I gave the order. You made it work. Don't let anyone tell you different, including me on a bad day.", "Pull up a chair. Rank doesn't get you out of losing at Fletchers on my watch.", "Drink's on me tonight. Every one of you earned it in a different way and I noticed all of them.", "We're framing that moment. Someday it's a story with a happy ending instead of the alternative, and I want it on the wall."]
    },
    fear: {
      green: ["Don't wander off, please — I don't know this squad well enough yet to lose anyone.", "Stay where I can see you. I mean it.", "I keep counting heads before I move. Probably overkill this early. Feels wrong not to.", "We didn't lose anyone. I keep saying that like it's not the whole point.", "I don't know how to be useful to people I haven't fought next to yet.", "Tell me the squad's fine and I'll believe whatever else you say after that."],
      blooded: ["Don't scatter. If we spread out now, we lose someone else.", "Stay close. I can't watch everyone if we split up.", "Sound off. I need to hear every voice before we move.", "Nobody goes off comms. Not even for a second.", "I keep a headcount in my head at all times. It never turns off.", "I don't spiral anymore when someone's late back. I used to. The squad taught me patience I didn't have.", "Talk to me like I'm one of the team having a bad day, not like I'm about to break."],
      command: ["I've buried the count of close calls. Stay in formation and we don't add to it.", "Every voice I don't hear is a name I have to remember later. Sound off.", "I've learned to say 'I need a minute' out loud instead of pretending I don't. Try it. It works.", "Quiet comms make my neck itch. Everyone check in — humor me.", "I've planned for every way tomorrow goes wrong. It's the ways I haven't thought of that keep me up."]
    },
    anger: {
      green: ["Nobody gets left — I don't care if I'm the newest one here.", "Say that again about leaving someone behind. I dare you.", "I lost sight of you for one minute out there and I'm still mad about it. At me, not you.", "Don't plan around me like I'm not standing right here. I'm part of this squad too."],
      blooded: ["Nobody gets left behind. That's not up for debate.", "You don't fight alone on my watch — argue with me all you want.", "Try leaving someone behind around me. I dare you.", "The formation holds. Full stop.", "We don't do 'every pilot for themselves' here. Ever.", "You broke formation for a kill and it worked. That's the only reason this is a talk and not a shouting match."],
      command: ["The formation holds because I've made it hold for years. Don't test that now.", "I've buried the argument for every-pilot-for-themselves a dozen times. Don't dig it up.", "You went dark on comms mid-push. Once. That's the whole allowance you get from me.", "I don't spend pilots to win faster. Whoever's math that is, it isn't mine."]
    },
    sadness: {
      green: ["First loss and I already feel like I failed the whole squad.", "Didn't think it would hurt this much this early.", "I memorized everyone's names my first day. Didn't think I'd be crossing one out this soon.", "The table's just quieter than it's supposed to be. Nobody warned me about that part."],
      blooded: ["The pack's smaller today. We close ranks around what's left.", "Feels wrong, standing here without the full line.", "I keep counting heads out of habit. Comes up short now.", "Used to be able to do this without thinking. Not anymore.", "The line's thinner, but it's still a line. We hold it.", "I used to think 'watch each other's backs' was just something people said. Turns out it's a skill. Took losing count to learn it.", "We don't talk about the ones we lost keeping this squad tight. Maybe we should. Not today."],
      command: ["I've led this squad through enough losses to know the shape of this one already.", "The line's thinner again. I've held it thinner before. Doesn't get easier.", "You don't have to carry that alone just because you outrank the person who'd help you carry it.", "Some mornings I still count one head too many before I catch myself. The catching is the part that stings.", "I write the letters home myself. Every single one. That duty doesn't get delegated."]
    }
  },
  dog: {
    love: {
      green: ["I don't know you well yet but I'd already follow you anywhere.", "Tell me where to be and I'm there. That's just how I work.", "You're my wingman now. I've decided. You don't get a vote.", "I already know I'd take a hit for half this lance and we've known each other a week.", "Is it weird that I feel more loyal to you people than I did to half my old unit?", "You didn't have to circle back for me. You did anyway. I'm not going to forget that.", "I stuck by you out there because that's just — that's just what you do. Right?", "First mission and I already know who I'm not leaving behind. That was fast.", "I'll sit with you even if you don't want to talk. Just say the word.", "Pull up a stool. You don't drink alone on my watch, not tonight.", "Don't you ever do that to me again. I mean it. Also — glad you're fine. Also, don't."],
      blooded: ["I'd follow you into anything. You know that.", "You needed something? I'm already here.", "Wherever you're posted next, put me there too.", "You don't have to earn it. I'm already loyal.", "I noticed you before anyone told me to. Just felt right.", "You don't have to earn my loyalty twice. Once was enough, and it's still holding.", "I choose who I stand next to now. It's not automatic anymore. It's better because it's not.", "I've buried the version of loyalty that just runs on instinct. What's left is the kind that survives losing someone. This is that kind.", "You'd have done the same for me. I know because I've watched you do it for someone else.", "That's the third time we've walked off the same field together. I keep a count now. Didn't used to.", "Peg board. Loser buys, same as always, and I'm not losing to you again.", "One drink for the ones who made it back. Second one's just because I like your company.", "You keep doing this to me. I keep showing up anyway. That's the deal, apparently."],
      command: ["Years in and it's still true — wherever you're posted, put me there too.", "I've earned the right to say this plainly: I'd follow you into anything.", "People say loyalty like it, but around here it's a job. I do the job. Every day, on purpose.", "I've earned the right to worry about all of you out loud now. Don't take that away from me.", "Every one of you knows exactly where I stand. That's not an accident. That's years of showing up.", "I don't say 'I've got you' lightly anymore. When I say it, it's load-bearing.", "Sit. Drink. I'll tell you which one of you I'm proudest of tonight, and it changes every week.", "You don't need to prove anything to me. That ship sailed a long time ago, in your favor.", "I've stopped being surprised when this squad pulls someone back from the edge. I'd be more surprised if we ever stopped."]
    },
    fear: {
      green: ["Please don't go somewhere I'm not — I'll worry the whole time, I already do.", "Just tell me you're safe. First time caring this much scares me.", "I get attached fast. I know. I'm working on not making that everyone else's problem.", "Tell me you're okay and I'll believe you even when I shouldn't. That's on me to fix."],
      blooded: ["Don't send me somewhere you're not. I'll worry the whole time.", "Just tell me where you'll be. I need to know.", "Tell me you're okay. I need to hear you say it.", "I keep glancing over to make sure you're still there.", "If comms go dark on your channel, I'm coming to find you.", "I don't panic when someone I care about gets hurt anymore. I get quiet and I fix it. Learned that the hard way.", "Ask me how I'm holding up. I'll actually tell you now instead of saying 'fine.'"],
      command: ["I've worried about you for years now. Doesn't get quieter with practice.", "If your channel goes dark, I'm coming, same as I always have.", "I've learned the difference between loyalty and not letting people rest. Go rest. I've got the watch.", "I know everyone's footsteps on this deck. I notice a missing set before the roster does."]
    },
    anger: {
      green: ["I don't even know the rules yet but I already know I won't leave you.", "Try me. I may be new but I already know where I stand.", "They benched you and told me it wasn't my business. You are my business. That's the whole arrangement.", "I heard what got said in the mess about them. Say it once more where I'm standing."],
      blooded: ["Say what you want about me. Don't say it about them.", "I don't care what the orders say — I'm not leaving you out there.", "Try me. See what happens if you go after them.", "I don't forget who backed me up and who didn't.", "Loyalty isn't a rule to me. It's the whole point.", "You lied to me about being fine. I'd forgive you anything, but don't do that."],
      command: ["I've said this for years and meant it every time: don't touch them.", "Loyalty isn't new to me anymore. It's the only thing about me that never changed.", "You can rotate anyone out of this squad except the loyalty. That part's not for sale.", "Don't tell me who's worth going back for. It's everyone. It's always been everyone.", "Orders end where they start costing my people. That line is older than my rank."]
    },
    sadness: {
      green: ["I barely knew them and it still hollowed me out.", "Is this what it's supposed to feel like? Because it's awful.", "I said 'see you at chow' like always. That's the part I can't stop hearing.", "Everyone says I attach too fast. Maybe. It just means I already had something to lose."],
      blooded: ["I should've been closer. I keep thinking that.", "Doesn't feel right, not having them to report to anymore.", "I keep expecting to see them at debrief. Habit's hard to break.", "Nobody replaces someone. I don't care what the roster says.", "I owe them more than a moment of silence. Doesn't feel like enough.", "I lost someone I was that loyal to once. Doesn't stop me being loyal again. Just makes it heavier.", "Their old callsign still tops my comms list. I can't bring myself to bump it down."],
      command: ["I've lost people before. Doesn't make this one lighter.", "Every one of them stays with me. That's the cost of caring this long.", "I've buried people I was loyal to. That doesn't make me loyal to the rest of you any less — it makes me sure of what I'm choosing.", "Poker night. I'm buying because I remember what it cost to still have a table full of people to buy for."]
    }
  },
  cat: {
    love: {
      green: ["Don't get used to this — I don't do this for just anyone yet.", "Fine, you can sit here. Still figuring out if I like you.", "I covered you because a dead squad is a squad that can't cover me next time. Purely practical.", "Don't thank me. I did the math and helping you was the correct play.", "I'm playing to win, not to be friendly. Ante up.", "Glad you're not dead. Would've been annoying to train a replacement."],
      blooded: ["Fine. You can sit here. Don't make it weird.", "...I saved you a seat. Don't tell anyone.", "Don't get used to this. It's a one-time thing.", "You're... tolerable. High praise, coming from me.", "I'd notice if you were gone. Not that I'd say so twice.", "Turns out keeping a couple of you alive is cheaper long-term than starting over with strangers. I've done the math twice now.", "I still don't do this out of the goodness of my heart. I do it because losing you costs me something real now.", "Careful — I've started caring what happens to a few of you specifically. Don't make it weird.", "I covered you because losing you would actually cost me something now. That's new. I'm not thrilled about it.", "You'd have done the same for me by now. I checked. You would have.", "I got everyone out intact this time. Even me being smug about it is a group activity, apparently.", "Fletchers. I'm still playing to win, but I'll admit it's better with people I don't hate.", "Fine. I'll buy the round. Don't make this a thing."],
      command: ["Years of pretending I don't care, and somehow you're still the exception.", "I've built a whole reputation on not needing anyone. You're the crack in it.", "I still call it self-interest. Nobody's corrected me because they've noticed my self-interest looks a lot like protecting all of you now.", "I've stopped pretending this is transactional. It just sounds better when I keep saying it is.", "Ask anyone — I still negotiate everything. I just negotiate on your behalf now too.", "Everyone's accounted for. I'd call that a good return on investment, if I still believed that's what this is.", "I used to keep score of what I owed people. I've lost track completely. Feels like losing, honestly. I don't mind.", "You're all mine to look after now, whether I ever agreed to that in so many words or not.", "I'm still playing to win. I'm also making sure everyone's actually having a good night. Both things, apparently.", "Round's on me. Don't read into it. Read into it a little.", "I've learned looking after people isn't weakness. It's just a longer-term kind of selfish. I'm at peace with that.", "I nearly lost someone I've spent years pretending I don't care about. Pretending's officially over."]
    },
    fear: {
      green: ["First real op and I've already got three ways out mapped. Judge me later.", "I'm not sticking around if this goes bad. New here, not stupid.", "I keep my gear in better shape than anyone here. That's not vanity, that's math.", "I don't do the whole 'talk about your feelings' thing. Ask me something useful instead.", "I'm fine. I'm always fine. It's less effort than not being fine."],
      blooded: ["If this goes bad, I'm not waiting around.", "I've got an exit planned. Just saying.", "I've already mapped three ways out of here.", "Not sticking around if this turns into a mess.", "Self-preservation isn't cowardice. It's math.", "I don't do feelings talk. I do 'here's the actual problem, let's fix it.' Same effect, less crying.", "I'm not fine, and unlike a year ago I'll admit that to exactly one or two people. You're one of them.", "You scared me. I don't love saying that. But you scared me, and I'm saying it."],
      command: ["I've survived this long by always having an exit. Still do.", "Self-preservation got me through everything so far. Not changing that now.", "I don't do sentiment. I do results. The result, right now, is you sitting down and letting me handle this.", "I've counted the exits in this room already. Old habit. It's kept everyone I bother keeping.", "I plan like I'm the only one coming back. That way any number above one is good news."]
    },
    anger: {
      green: ["New here, but already sure of one thing — not my job to fix your mess.", "Don't guilt-trip the new pilot. Won't work.", "I'm not here to make friends. I'm here to not die. If those overlap, great.", "What's in it for me if I cover your flank? I'm asking for real.", "I got mine out intact. Everyone else's business is everyone else's business.", "One drink. I'm not buying a round for people I've known a week."],
      blooded: ["Not my job to fix your mess.", "Don't expect me to clean up after this.", "You want loyalty, go find a Dog. I'm not that.", "I look out for me. Has worked fine so far.", "Don't guilt-trip me. It won't land.", "I did my half and everyone's still breathing. Take the complaint somewhere it's earned."],
      command: ["Years of looking out for myself first. Ask literally anyone.", "Don't expect loyalty from me. I've been consistent about that the whole time.", "My people come home whole. That's the one clause I don't negotiate.", "You spent my squad like loose change out there. I count change. I always count change."]
    },
    sadness: {
      green: ["Didn't expect to feel this, this early in. Don't tell anyone.", "I keep my distance on purpose. Still got to me somehow.", "Barely knew them. My math says that shouldn't cost anything. My math's wrong.", "I came in with everything I own in one crate. Turns out that's not the stuff you can lose."],
      blooded: ["Not my problem to carry. Doesn't mean it's nothing.", "I keep my distance for a reason. Didn't stop me noticing, though.", "Fine, it got to me a little. Don't make it a thing.", "I've got layers. Somewhere under here is a reaction.", "Doesn't mean I have to talk about it to feel it.", "I priced getting attached out here exactly once. Paid it anyway. Worst deal I keep making."],
      command: ["Even after all this time keeping people at arm's length, this one landed.", "I've got walls for a reason. This one found a gap anyway.", "I ran the numbers on caring about all of you years ago. Losing one still isn't a cost I know where to file.", "The seat I always pretend I'm not saving — it's empty tonight for real. I hate that I can tell the difference."]
    }
  },
  crow: {
    love: {
      green: ["You make the bad days shorter, I mean that, don't make it weird though.", "New here and already decided you're my favorite distraction.", "Okay but hear me out — what if the Bloom isn't random, what if there's a pattern, I've been tracking it—", "I collect weird stuff. Bolts, bad jokes, one Bloom carapace piece I'm definitely not supposed to have.", "Give me five minutes and a bored afternoon and I will find you a conspiracy theory about literally anything on this ship.", "That fight is going straight into my theory. Everything goes into the theory eventually.", "I got distracted mid-fight thinking about why the pack broke formation like that. Nearly got hit. Worth it, probably.", "New data point! I'm annoyingly pleased about this given what it cost to get it.", "Poker's just an excuse for me to watch everyone's faces and build theories about them. Deal me in.", "One drink turns into me explaining my whole Bloom-migration theory to whoever's still listening. Fair warning.", "See, THIS is going in the theory. 'Munti saves override probability entirely.' I'm onto something."],
      blooded: ["You're actually decent company, don't let it go to your head.", "Stick around, this is more fun with you here.", "You make the bad days feel shorter. I mean that.", "Let's do something dumb and fun before the next op.", "Best part of this war so far is honestly just you.", "My theories used to be about the Bloom. Half of them are about keeping this squad alive now. Priorities shifted.", "I still chase every weird lead. I've just learned which ones are worth chasing during a fight and which ones wait.", "Turns out half my 'conspiracy theories' were just me noticing patterns nobody else had time to. That's a compliment I give myself now.", "My attention wanders less in a fight now. Not gone. Less. I call that progress.", "That detail I obsessed over last month just saved someone's life today. I'm allowed to be smug about that one.", "Peg board. I've got a theory about the pattern in this game too. Of course I do.", "One drink, one new obsession explained in too much detail. It's basically a ritual at this point.", "That's going in the log under 'things that nearly broke my brain and also my heart, same afternoon.'"],
      command: ["Years of chasing distractions and you're still the best one I've found.", "I've learned to want good things on purpose. You're one of them.", "People used to roll their eyes at my theories. Half of them are standard doctrine around here now. I notice things. Turns out that's a skill.", "I still chase tangents. I've just learned to bring the squad along for the useful ones.", "Ask me anything. I probably have a theory. Most of them are right now, which honestly still surprises me.", "I called that pack shift four minutes before it happened. Nobody's surprised anymore. I still am, a little.", "My attention doesn't wander in a fight anymore. It's not that I stopped noticing everything — I just stopped letting it cost anyone.", "Every strange detail I ever chased down came together today. I'd call that vindication, if I were the type to gloat. I am the type.", "Fletchers. I'll walk you through my current theory whether you asked or not — that's the deal, that's always been the deal.", "Drinks are on me. Ask me what I'm obsessed with this week. It's a good story, I promise."]
    },
    fear: {
      green: ["I don't know how to sit with bad feelings yet — distract me, please.", "First real scare and I already need something else to think about.", "I deal with stress by finding something new to obsess over. It's not healthy. It works, though.", "Don't ask me how I'm doing, ask me what I'm currently fixated on. Same answer, better mood."],
      blooded: ["I don't want to think about what happens if this goes wrong.", "Distract me. Please. Anything.", "I keep needing something to look forward to, or I spiral.", "Give me a distraction or I'm going to think too much.", "I don't do well sitting with bad feelings. Never have.", "I chase distractions on purpose now. It's not avoidance, it's maintenance. There's a difference and I've learned it.", "Give me something to dig into and I'll steady out. Always has worked. Now I actually trust that about myself."],
      command: ["I've learned to manage this — give me something to do with my hands and I'm fine.", "Still don't sit well with fear. Just handle it on purpose now instead of spiraling.", "I still cope by chasing something strange and specific. I've just learned to notice when someone else needs that same outlet, and hand it to them.", "My mind still won't sit still. I've made peace with steering it instead of fighting it. Recommend it, honestly."]
    },
    anger: {
      green: ["New here and already furious this war takes the good stuff so fast.", "One thing. I want one thing that doesn't get ruined.", "Somebody 'tidied' my collection while we were dirtside. Tidied. I had a system. I want a tribunal.", "I called that ambush two days ago and got laughed out of the briefing. Next time I'm charging admission to be right."],
      blooded: ["I'm sick of losing good things to this war.", "Everything gets taken eventually. I hate it.", "This war keeps taking the good stuff. I'm keeping score.", "I want one thing that doesn't get ruined. Just one.", "I'm allowed to be furious about losing the fun parts too.", "I clocked the pack behavior shift before anyone called it. Nobody believed me the first three times. I've stopped needing them to."],
      command: ["Years of watching this war take things. I've turned the fury into something useful now.", "I've stopped being surprised by what this war takes. Still allowed to be angry about it.", "I don't get dismissed in briefings anymore. It cost me years of being right in public to buy that. It shouldn't have.", "Whoever decided pattern-watching wasn't 'real soldiering' can come read my file of confirmed calls. Slowly. Out loud."]
    },
    sadness: {
      green: ["Don't know how to process this yet. Give me literally anything else to think about.", "First one like this. I don't have a system for it.", "They never did hear the end of my migration theory. I keep catching myself saving up the next part.", "My collection's just stuff today. That's the tell, when it all goes flat like that."],
      blooded: ["I don't want to feel this right now, honestly.", "Tell me something else. Anything else.", "I don't know how to sit still with this feeling.", "Somebody hand me anything else to think about.", "I'll process it eventually. Not like this, though.", "I know sixteen facts about the Bloom nobody asked for and not one thing to say at a memorial. Working on it."],
      command: ["I've built a whole system for sitting with this eventually. Not today though.", "Years of practice and I still need a minute before I can feel this properly.", "I've got a whole file of near-misses like that one. I don't reread it for fun anymore. I reread it because it reminds me why we do the rest of this.", "I've catalogued every way this war surprises you. The grief ones I still file under 'pending.'"]
    }
  },
  raven: {
    love: {
      green: ["Still new at this whole 'giving advice' thing — but you're doing better than you think.", "Ask me anything. I might actually know the answer now.", "Actually, you'll want to angle your approach two degrees wider than that — I read it in a manual, don't look at me like that.", "I know I sound like I've done this for years. I have not. I've just read everything.", "Let me walk you through why that worked. I promise it's useful and not just me showing off. Mostly.", "Told you the approach angle mattered. I wasn't sure until it actually worked, if I'm honest.", "I called the timing on that and got lucky it landed right. I'll take it.", "Next time, hold two turns longer before the push. I'm learning this in real time right alongside you.", "I can walk you through Fletchers technique or we can just play. Your call. I vote technique.", "One drink and I promise not to explain the fermentation process. No promises on anything else."],
      blooded: ["You're doing better than you think. I'd tell you if you weren't.", "Come by later — I want to hear how it actually went.", "You've got real potential. I don't say that lightly.", "Ask me anything — I'd rather you learn it from me than the hard way.", "Proud of how far you've come. Truly.", "I only teach what actually almost got someone killed now. Cuts the material down a lot, honestly.", "I used to explain everything. I've learned which lessons land and which ones just make me feel useful. Different skill.", "Ask me a real question and I'll give you a real answer, no manual quotes attached. Learned that the hard way.", "I taught you that angle because I've seen what happens to pilots who never learn it. Once was enough.", "Good instinct out there. You didn't need my help on that one and I noticed.", "Peg board — I'll teach you the pattern this time, no lecture attached, I promise.", "One drink. I'll actually just talk instead of instructing for once. Rare, savor it."],
      command: ["I've taught a lot of pilots by now. You're one of the ones I'm proud of.", "Come by after — I want to hear how it actually went. I mean that every time.", "People come to me before a fight now, not after. That's the actual job, I think. Nobody told me, I just noticed.", "I don't lecture anymore unless it's asked for. Funny how much more people listen once you stop insisting.", "Every hard lesson I've got, I'll hand over free. No charge, no ego attached anymore.", "You made that call yourself out there. I didn't have to say a word. That's the whole point of teaching, and I finally believe it.", "I've buried the version of me that needed to be the smartest person in the briefing. What's left just wants everyone walking home.", "Sit. I'll teach you the peg board properly this time — not to win, just because it's a good thing to know.", "Drinks on me. Ask me anything. I've got fewer answers than I used to pretend, and I'm finally okay saying that.", "I've watched that scenario go every possible way over the years. I'll take this ending every single time."]
    },
    fear: {
      green: ["I don't have a plan for everything yet and that scares me more than the enemy does.", "New at leading. Still figuring out the contingencies.", "I deal with nerves by explaining things to people whether they asked or not. Bear with me.", "Ask me something you actually want to know. I'm better at answering than I am at just sitting with it.", "See, that's exactly the scenario the manual warns about. I did not expect to see it in person quite so fast."],
      blooded: ["We need a better plan before this happens again.", "I don't like flying blind into the next one.", "Walk me through your plan again. I want to check it.", "I don't like sending anyone in without a rehearsed answer.", "What's our contingency if the first plan fails?", "I've stopped explaining my way through everything. Some things you just have to sit in. Learning that too.", "Tell me what's actually wrong. I'll skip the lesson and just listen this time."],
      command: ["Years of planning and I still hate flying blind into anything new.", "I don't send anyone in without a rehearsed answer anymore. Learned that the hard way.", "You don't need a lesson right now. You need someone to sit with you. I can do both, but I know which one this is.", "I've learned the best thing I can teach is that it's fine to not have it together today."]
    },
    anger: {
      green: ["Still learning, but I already know a mistake when I see one.", "Someone should've caught this. I'm new and even I caught it.", "I flagged that hazard in the pre-brief. Page two. Highlighted. I'm allowed to be loud about that for one day.", "You skimmed the brief. People improvised with my flank because of it. Read. The. Brief."],
      blooded: ["Someone should've caught this sooner. That's on all of us.", "This wasn't bad luck. It was a mistake we can name.", "This was preventable. I hate that it wasn't prevented.", "Somebody didn't listen. That's the actual problem here.", "I'm not angry at you. I'm angry this keeps happening.", "There's a checklist for exactly this, and it's written in someone's bad day. Use it."],
      command: ["Years of teaching and this still happens. That's on all of us, me included.", "I've taught this exact lesson before. Somebody didn't listen.", "I've rewritten that doctrine twice with better information. Command shelved it twice. Third draft's going over their heads.", "Every shortcut you're defending, I've watched cost somebody something. Pick a different hill."]
    },
    sadness: {
      green: ["First time losing a student. Nobody told me it would feel like this.", "Don't know how to teach through this yet.", "My manuals don't have a chapter for this part. First gap I've found in them. I hate it.", "I read everything before I got here. Nothing I read weighs anything today."],
      blooded: ["There's a lesson in this. There always is. Doesn't make it easier.", "We'll talk about what went wrong. Not blame — just so it doesn't happen twice.", "I've taught a lot of pilots. I remember all of them.", "Knowledge doesn't fill the gap. I wish it did.", "I'll add this to what I teach next. Small comfort, I know.", "That call I made — I got it from a mistake I watched someone else make once. Didn't want to repeat it.", "I've seen that exact scenario end differently. I'm glad this is the version I get to remember instead."],
      command: ["I've taught a lot of pilots. I remember every one I couldn't save.", "There's a lesson in this, same as always. Doesn't make it hurt less, same as always.", "That's a lesson I learned from losing someone. I'd rather hand it to you than watch you learn it the same way.", "Somewhere in every lesson I give, there's a name I don't say out loud. The good students hear it anyway.", "I've taught the recovery drill a hundred times. Today I finally understand why my own teacher's voice always went quiet on it."]
    }
  },
  bear: {
    love: {
      green: ["Didn't expect anyone to check on me this early. Don't make it a thing.", "You can stay. Still working out if I want company.", "I don't know how to small-talk. I know how to watch a room. That's what I've got right now.", "I hung back and covered the angle nobody else was watching. That's just where I end up.", "I don't celebrate loud. I noticed everyone made it back, though. That's mine, quietly.", "Ask someone else how it went. I'll just say it went fine and mean it more than it sounds.", "I'll watch the game. I don't need to be dealt in to enjoy it.", "One drink, alone, at the end of the bar. That's not a rejection. That's just the shape of my evening.", "I noticed before anyone called it. Didn't say anything. Would've if it went the other way."],
      blooded: ["...Didn't expect you to check on me. Appreciate it.", "You can stay. Just don't talk much.", "...Thanks. That's rare, coming from me.", "You're the exception to a lot of my rules.", "Don't make this weird by pointing it out.", "I still take the corner table. Nobody questions it anymore. That's its own kind of belonging, I've decided.", "I watch the room because it's useful, not because I'm avoiding it. Both used to be true. Now it's mostly the first one.", "I don't talk much. When I do, people have started actually listening. That's new, and I don't hate it.", "I caught the angle nobody else had eyes on. Again. Somebody has to be the one watching the edges.", "I don't need thanks for holding the line alone out there. I'd have done it whether anyone noticed or not.", "Everyone made it back. I'll admit that mattered to me more than I let on.", "I'll sit at the edge of the table. Deal me in anyway. I like watching more than I like winning.", "One drink, still alone, still at the end of the bar. A couple of you have started just — sitting there with me. I've stopped minding.", "I don't do relief out loud well. Just know I felt it. All of it."],
      command: ["Years of keeping people out and you're still the exception to all of it.", "Don't make this weird by pointing it out. I've let very few people in this far.", "I still keep to the edges. I've just noticed the edges are where this whole squad's safety usually gets decided, so I don't mind the reputation.", "People assume isolation means I don't care. It's the opposite. I watch you all closer than anyone.", "I don't need the room anymore. I've got the handful of you that matter, and that's plenty.", "I watched every angle out there so none of you had to. That's the job I picked, and I'd pick it again.", "I don't say this often — I was glad every one of you made it back. Write that down, it won't happen twice this month.", "Solitude taught me to notice everything. Everything I notice, I spend on keeping you alive now.", "I'll sit with the squad tonight. Still not talking much. Still here. That's the whole message.", "Drink's on me, for once. I don't do this for many people. Consider it noted.", "I don't scare easy. That scared me. I'm not going to pretend otherwise anymore — not to you."]
    },
    fear: {
      green: ["New here and already need space. Not personal.", "Too many people, too soon. Give me a minute.", "I'm not being rude. I just don't do the group thing well yet. Give it time.", "I'll take the corner table. Not because I dislike you. I just need the corner.", "I don't want company right now. I might in an hour. Ask again in an hour.", "I process things by myself first. Always have. I'll talk when there's something worth saying."],
      blooded: ["Leave me be for a while.", "I don't want an audience for this.", "Too many people right now. I need space.", "I don't process things well with an audience.", "Give me the corner and the quiet. That's all I need.", "I still need distance first. I've learned to say so instead of just disappearing. Small improvement, real one.", "I don't need you to fix it. I need you to know it's there. That's enough."],
      command: ["Years in and I still need the corner and the quiet. Never stopped needing that.", "I don't process things well with an audience. Never have, never will.", "I've learned the difference between needing space and needing to be alone. Come find me when I need the first one. I'll let you, now.", "You don't have to talk me through it. Just don't leave the room yet. That's what I actually need."]
    },
    anger: {
      green: ["Barely know you and I'm already telling you not to push. Learn that fast.", "I'll handle it my own way. New here, still true.", "You moved my kit to 'make room.' Put it back. The corner works because nobody helps it work.", "Stop translating me to people. If I wanted the room to know, the room would know."],
      blooded: ["Don't push. I mean it.", "I'll handle it my own way.", "I said I'd handle it. I meant it.", "Don't mistake quiet for fine. I'm neither.", "I'll come find you when I'm ready. Not before.", "I don't raise my voice. Notice how quiet I just got instead."],
      command: ["Years of handling things alone. Don't start doubting that now.", "I said I'd handle it. Still mean it, same as every time before.", "Anyone with opinions about my distance can hold the edge themselves for a year. Then we'll talk.", "Crowd me in a briefing again and I'll start attending by comms. Your pick."]
    },
    sadness: {
      green: ["Don't know how to grieve out loud yet. Give me the room.", "First time doing this. Doing it alone, same as I'll probably always do it.", "I only knew how to like them from across the room. Should've crossed the room.", "People keep asking if I'm okay. I was quiet before. It's a different quiet now."],
      blooded: ["I don't want to talk about it. Not yet.", "Just... give me the room for a while.", "I grieve slow, and alone. Always have.", "Don't wait around for me to talk about it.", "I'll be functional tomorrow. Today, just let me be.", "They were the only one who never tried to fix the silence. Sitting here's harder without that."],
      command: ["Years of grieving slow and alone. Still the only way I know how.", "I'll be functional tomorrow. Same promise I've kept every time before.", "I've watched this deck from the same corner for years. It's never once looked this empty with this many people on it.", "I keep watch so I never lose anyone I'm looking at. Wasn't looking. That's the whole wound."]
    }
  },
  fox: {
    love: {
      green: ["New here, but you're already one of the few I'm not running an angle on.", "Careful — I might actually mean what I just said.", "I swapped the labels on the ration crates. Don't tell the Quartermaster. Actually, tell him. It'll be funnier.", "I like knowing something you don't. It's not personal. It's just fun.", "Watch — I bet I can talk my way past that duty roster before end of shift.", "I baited them left, everyone else hit right. Worked better than I expected, honestly.", "I got a little too pleased with myself out there. In my defense, it worked.", "That feint was mostly improvised. Don't tell command it was mostly improvised.", "Poker. I will absolutely bluff you and I will absolutely enjoy it.", "One drink, and I'm definitely going to tell an exaggerated version of today. It's more fun that way."],
      blooded: ["Careful — I might actually tell you the truth today.", "You're one of the few I don't need an angle with.", "I don't play games with you. That's rarer than it sounds.", "You caught me being sincere. Don't tell anyone.", "Out of everyone here, you're the one I don't lie to.", "I still like knowing something you don't. These days it's usually the thing that keeps you alive, so I've decided that's fine.", "My tricks used to be for fun. Half of them are tactics now. The other half are still just for fun.", "I read the room better these days. Mostly so I know exactly when to make it worse on purpose.", "That feint wasn't improvised this time. I planned it. Felt strange being the responsible one for a second.", "I baited the whole pack into a kill box. Command's going to ask how I knew that would work. I'm not telling them it was a guess.", "I got everyone out using a trick that could've gone very wrong. I've started thinking harder before I commit to those. Progress.", "Fletchers. I'm still bluffing you, but I'll admit it's more fun when you actually see it coming half the time now.", "One drink, and this time the exaggerated story has an actual point to it. Character growth."],
      command: ["Years of angles and you're still the one I never needed one for.", "Out of everyone here, you're still the one I don't lie to. Hasn't changed.", "I don't play tricks for fun much anymore. I play them because I've watched the right one save a whole squad. That's a better reason.", "People trust my read on a bad situation now. Feels strange, being the reliable one. I'm still funny about it, don't worry.", "I know something you don't. This time it's a plan that keeps all of you breathing. Old habits, better reasons.", "I've stopped needing anyone to be impressed by the trick. I just need it to work. It worked.", "That misdirection came from years of learning exactly how far I can push a bad plan before it stops being clever. We're under that line. Barely.", "I got everyone home using a play nobody else would have tried. I don't need credit for it. I'll take it anyway, quietly.", "Poker night, my rules. I'll still bluff every one of you, and every one of you will still fall for it, and that's exactly why I love this crew.", "Drinks are on me. I'll tell the real version of the story tonight, for once. Don't get used to it.", "I've made peace with not turning every near-miss into a bit. This one, I'm just glad about. No joke attached."]
    },
    fear: {
      green: ["Don't have an angle for this yet. Still building the toolkit.", "First time not having a clever way out. Not enjoying it.", "I deal with nerves by pulling pranks. Bad coping mechanism. Effective one.", "Don't take my jokes as me not taking this seriously. It's just how I get through it.", "Okay, that one wasn't funny. I'm still going to make it funny later, but not right now."],
      blooded: ["I don't have a plan for this one. That's the scary part.", "No trick gets us out of this kind of loss.", "Even I don't know how this one plays out.", "I hate not having an angle. Feels like being unarmed.", "First time in a while I don't have a clever way out.", "I still crack jokes under stress. I've learned to check who needs the joke and who needs me to stop.", "I trick my own head into calm the same way I trick the enemy into a bad position. Whatever works."],
      command: ["Years of always having a plan and this one still doesn't have an angle.", "Even after all this time, some losses just don't have a trick out of them.", "I still cope with a joke first. I've learned to follow it with something real, right after, so it doesn't just deflect.", "I read this room the way I read a battlefield. Right now it's telling me someone needs quiet, not a punchline. I can do quiet."]
    },
    anger: {
      green: ["New here, already keeping score on who owes us.", "Somebody's going to regret underestimating the new pilot.", "Somebody re-labeled MY crates back. Fine. FINE. This means escalation.", "They put my feint in the after-action report as 'unplanned maneuver.' Unplanned. I planned it TWICE."],
      blooded: ["I hate when the war doesn't play fair either.", "Somebody owes us for this one.", "Somebody's going to regret underestimating us.", "I'm already three moves into getting even.", "Fair fight's overrated. I'll take any win.", "Three days setting that trap, and command marched us straight past it. The Bloom I forgive. Command, less."],
      command: ["Years of turning losses into leverage. Still my whole method.", "I'm already three moves into getting even. Some things never change.", "The play leaked and the other side adapted. Fine. The second version has no briefing document.", "I've run out of patience for people who call cunning 'cheating' right up until it saves their hull."]
    },
    sadness: {
      green: ["Don't have the clever thing to say yet. Still learning that part.", "First time grief beat the trick. Didn't expect that.", "I had a whole bit ready for when they got back. It's just sitting there now. Worst timing I've ever done.", "Turns out there's a kind of quiet I can't work a room out of. Today's kind."],
      blooded: ["I could tell you it gets easier. I'd be lying.", "No angle on this. Just loss, plain.", "I run out of clever things to say around grief.", "No trick makes this easier. Believe me, I checked.", "Even I don't know what to say right now.", "I'm going to make a joke about this eventually. Today's not that day. Ask me next week."],
      command: ["Years of having an angle for everything, and grief still doesn't take one.", "I run out of clever things to say around this. Every time, still.", "The best audience I ever had is gone. Everything I do lands a beat late now, and only I can hear it.", "My whole trade is making things look like other things. This refuses to look like anything but what it is."]
    }
  },
  rabbit: {
    love: {
      green: ["New at this, but I already want to know how you're really doing.", "Let me take care of something for you. I'm still learning how, be patient.", "I patched you up with my hands shaking the whole time. Got it done anyway. I'll take that as a win.", "I'll play, but I'm also going to check on you twice during the hand. Occupational habit.", "One drink, and I'm still going to ask if you're actually okay underneath the joking around."],
      blooded: ["How are you holding up, really? I mean it.", "Come here. Let me look at you — you're not fine.", "Let me take care of something for you, just this once.", "You matter to me more than the paperwork admits.", "I made extra. Sit, eat, tell me about your day.", "I've saved enough of you now that I believe it when I say I've got this. Took a while to believe that.", "Tell me if something hurts. I'll actually know what to do about it this time, and it won't be shaking while I do it.", "I got to you in time because I trusted the read instead of freezing on it. That's new. That's good.", "I've stopped replaying every call after the fact. Mostly. I trust the ones I made today.", "Everyone's stable. I believed it the first time I said it, for once.", "I'll play properly this time instead of half-watching the room for injuries that aren't happening. Progress.", "One drink. I'm still checking on you underneath the joking. That part never goes away and I've stopped apologizing for it.", "I got there. My hands didn't even shake this time. I noticed that, right in the middle of it."],
      command: ["Years of taking care of this crew and you still matter more than the paperwork says.", "I made extra, same as always. Sit, eat, tell me about your day.", "Everyone orients around me without saying it out loud. I noticed a while back. I try to be worth orienting around.", "I don't panic-check the roster anymore. I just know. Years of this does that to you.", "Tell me if something hurts. I'll fix it, and I won't need to be told twice, and I won't shake doing it. Not anymore.", "Nobody's down. That's not luck at this point. That's a decade of learning exactly where to be standing.", "I stopped replaying my calls after the fact years ago. I trust them. They've earned it.", "Everyone's stable, and for once that sentence doesn't cost me anything to say. It's just true.", "I'll play, and for once I'm not watching the room for injuries — I'm just here, with all of you, actually resting.", "Drinks are on me tonight. I've spent years making sure you're all fine. Let me buy the round for once.", "I've stopped needing to say it three times before I believe it. One look, and I know. That's what all this practice was for."]
    },
    fear: {
      green: ["New here and already worried sick about all of you. Didn't expect that so fast.", "Please be careful. I mean it more than the job requires.", "I keep a mental list of everyone's HP even when we're not in a fight. I don't know how to turn that off.", "Tell me if something hurts. Please. I'd rather know too early than too late.", "I'm not as steady as I want to be yet. I'm working on it. I promise I'm working on it.", "I keep replaying whether I could've reached you faster. You're fine. I know you're fine. I still replay it.", "Everyone's stable. I said it three times to myself before I believed it.", "I worry about everyone else so I don't have to sit with how I'm doing. I know that's backwards. I do it anyway.", "Ask me how I'm holding up and I'll deflect to how you're holding up. Every time. It's a whole thing.", "I got there in time. I got there in time. I need to say that a few more times before my hands stop shaking."],
      blooded: ["Please be careful out there. I mean it this time.", "I worry about you more than I say.", "Please don't take unnecessary risks. I mean that.", "I'll patch you up every time, but I'd rather not have to.", "Come back in one piece. That's the only ask.", "I still keep the mental list. It doesn't scare me the way it used to — I trust my hands now more than I trust my worry.", "I've learned to let people worry about me back. Still strange. Still letting it happen.", "Ask me how I'm doing and I might actually answer honestly this time. Might."],
      command: ["Years of worrying about every one of you and it's never once gotten quieter.", "I'll patch you up every time. Still wish I never had to.", "I let people take care of me now. Learned it late. Learned it anyway.", "You don't have to hide it from me. I've built this whole life around noticing exactly this. Let me in."]
    },
    anger: {
      green: ["New here, and I already hate watching this war grind people down.", "Someone has to stay soft, even this early in. Might as well be me.", "You walked on that leg for two days without telling me. I'm not mad you got hurt. I'm mad you hid it.", "Don't call it 'just a scratch' to make my job easier. My job was never supposed to be easy."],
      blooded: ["I hate that this keeps happening to good people.", "This war doesn't get to keep taking from us.", "I hate watching this war grind good people down.", "Somebody has to stay soft, even here. That's me.", "This isn't fair, and I'm allowed to say so.", "Whoever cleared them to deploy at half-strength can come hold the kit while I fix what that decision cost."],
      command: ["Years of watching this war take from good people. Still not over it.", "Someone has to stay soft, even here, even after everything. Still me.", "I can fix almost anything this war does to you. The preventable ones are the only ones I stay angry about.", "Push your luck with your own hide if you must. Push it with theirs and you'll find out how un-soft I can get."]
    },
    sadness: {
      green: ["Don't know how to hold someone else's grief yet. Teach me.", "First time and I already don't want to let go.", "My kit has everything they told me I'd need. Nobody packed the part for after.", "I did my rounds tonight like always. There's one stop my feet keep trying to make."],
      blooded: ["I've got you. Whatever you need right now.", "It's okay to not be okay about this.", "Cry if you need to. I'll stay as long as it takes.", "You don't have to be strong in front of me.", "Let me carry some of this. You don't have to alone.", "I know exactly which calls I got right. It's the one I never got to make that stays."],
      command: ["Years of carrying this for everyone. I've got you, same as always.", "It's okay to not be okay. I've said that more times than I can count, still mean it every time.", "I've learned to save almost everyone. It's the 'almost' I sit with after lights-out.", "Everyone brings me their grief because I know how to hold it. Some nights I'd give anything to know where to put mine."]
    }
  },
  shark: {
    love: {
      green: ["New here, still proving I'm worth building around. Watch me.", "Haven't earned much yet. Glad you're still here anyway.", "I'm going to be the best pilot on this ship. Not being modest about it. Watch the board.", "I got the most kills today. I know that's not the point. I'm still going to mention it.", "I pushed harder than I needed to. Nearly cost me. Worth it for the numbers, probably.", "Next time I want the lead position. I've earned it. I think I've earned it.", "Poker. I'm playing to win, obviously. What else would I be playing for?", "One drink, and yes I'm still thinking about tomorrow's board standings. Sue me.", "Glad you're fine. Also, that's going to mess up the squad's numbers if it happens again, so — glad you're fine, mostly."],
      blooded: ["You're one of the ones worth building this around. Don't waste it.", "I don't say this often — glad you're still here.", "You're worth investing in. That's not nothing, from me.", "Keep pace with me and we'll go far, both of us.", "I don't waste effort on people who don't matter. You matter.", "I stopped chasing the kill count after watching what chasing it almost cost someone. Still competitive. Aimed it somewhere better.", "I still want to be the best on this ship. I've just learned that includes making everyone around me better too.", "I didn't push past the line today. Learned that lesson the expensive way once already. Not doing it twice.", "Everyone's numbers looked good today, mine included. I've started meaning that plural on purpose.", "Fletchers. I'm still playing to win. I've just stopped needing you to lose badly for it to count.", "One drink. I'll admit the board standings mattered less to me tonight than just being here did.", "That would've cost the squad someone good. I'm allowed to care about that as its own thing, not just the math."],
      command: ["Years in and I still don't waste effort on people who don't matter. You matter.", "Keep pace with me and we'll go far, same offer I've made from day one.", "I stopped measuring myself against the board a while back. Now I measure myself against whether the people under me are getting better. Harder bar. Better one.", "Ambition got me here. What keeps me here is making sure it's not just mine anymore.", "I don't chase the numbers anymore. I chase everyone walking back with a number attached to their name at all. Different math.", "Every one of you is sharper than when you started under me. That's the only score I actually track these days.", "Poker night. I'll still win, probably. I've started enjoying watching the rest of you get good enough to actually threaten that.", "Drinks on me. I've spent a long time chasing being the best. Turns out the actual prize was building people who could take my place.", "I built rank chasing being the best pilot on this ship. Losing you would've cost more than any board position ever could. I mean that."]
    },
    fear: {
      green: ["New here, and I already know we can't afford to lose ground this early.", "Every setback costs more when you're new. I feel that.", "I don't like losing. To the Bloom, to a hand of cards, to anyone. I know that's a problem. Working on it.", "Tell me I'm still on track. I need to hear it more than I'd like to admit."],
      blooded: ["We can't afford to lose more ground on this.", "If we slip now, we don't get this back.", "Every setback costs us ground we don't get back easy.", "I don't fear losing. I fear losing slow.", "We can't afford hesitation right now. None of us.", "I still hate losing. I've learned which losses are actually about me and which ones I need to let go of.", "Tell me I'm still on track. I mean it differently now — less about the score, more about whether I'm still someone worth following.", "We're one bad week from being the lance people stop betting on. I don't sleep great on bad weeks."],
      command: ["Years of clawing back ground and I still hate losing any of it.", "I don't fear losing. Still fear losing slow, same as always.", "I still don't love losing. I've learned some things are worth losing for. That took most of a career to learn.", "Tell me the squad's still on track. That's the only scoreboard that's mattered to me in years."]
    },
    anger: {
      green: ["New here, already turning first losses into fuel.", "Somebody's getting outworked. Not us, not even this early.", "I clock everyone's kill count. Don't take it personally. I clock my own harder.", "Give me the hard mission. I want the one people remember."],
      blooded: ["This doesn't stop the war. Nothing does. So we move.", "Somebody's going to pay for this. Later. Not now.", "Somebody's getting outworked for this. Not us.", "I turn losses into fuel. Watch me.", "This just raised the stakes. Good. I like stakes.", "Give me the hard mission. I've earned it for real this time, not just on paper."],
      command: ["Years of turning losses into fuel. Still the whole method.", "This just raised the stakes. Good. Still like stakes, same as day one.", "Give me the hard mission — for the squad's sake this time, not the scoreboard's.", "You benched my best pilot to make a point. Points don't hold ground. People do."]
    },
    sadness: {
      green: ["New to this, and losing time already feels like losing everything.", "Don't know how to mourn on this schedule yet.", "I knew their numbers by heart. Turns out that's not the part of them I remember first.", "The board updated this morning like nothing happened. First time I've ever hated seeing it current."],
      blooded: ["Grieve fast. We move regardless.", "Feels like losing time we don't have to spare.", "No time to mourn properly. I hate that about this job.", "I'll feel it later. Right now there's a war on.", "Loss is just data. Doesn't mean it doesn't cost something.", "I wanted the lead position and I got it and it cost more than I expected. I'm recalibrating what 'winning' actually means out here."],
      command: ["Years of grieving fast because the war doesn't wait. Still hate that about this job.", "Loss is still just data to everyone else. Still costs me something every time.", "I held the line instead of pushing for the kill. Old me would've pushed. Old me got someone hurt once doing that. I remember.", "The record board keeps my name. The roster doesn't keep theirs. I've stopped calling the first one the real one."]
    }
  }
};
