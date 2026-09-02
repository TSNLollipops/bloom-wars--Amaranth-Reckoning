// src/data/socialActions.ts
// 2 Sep 2026 — the "what else can our player do with the crew" brainstorm
// pass. Maxime picked essentially the whole list ("add it all they are
// good") after one design conversation, most notably resolving the one
// real open fork in the already-written Praise/Insult/Apology proposal
// (claude/Bloom_Wars_Praise_Insult_Apology_System_Proposal_v1.md, 1 Sep
// 2026, §3a): a maxed-out Insult streak ends in the pilot refusing to fly
// with the MC, full stop — "wont fly with you, player will have to ask co
// to remove them from ship." Not the doc's own "recoverable via real
// Apology use" default, and not silent/automatic reassignment either — a
// real standoff that only ever resolves through a deliberate CO
// conversation (see scenes/Hub.ts's handleRemovePilotRequest).
//
// This file holds the content banks and placeholder numbers for six new
// single-target verbs (Gift, Praise, Insult, Apology, Congratulate,
// Send-Off) plus the CO's own two new bespoke lines (a Tier-3 call-out, and
// a stress-relief confide line) — everything data/verbs.ts's own header
// already says stays out of that file (content banks live in dedicated
// data files, same split ambientLines.ts/hotTopics.ts/smallTalk.ts already
// use). Recognition lives in chatIntent.ts, execution in Hub.ts, same
// three-way split every other verb in this project already follows.
//
// Every number below is a placeholder under "your call on their value"
// latitude, same caveat every other new constant in this project carries at
// birth (Stress & Morale Trigger Proposal's own numbers, the Antfarm bay
// costs) — not sim-tuned, not locked, real playtesting owed before any of
// it should be treated as final.
import type { Catalyst } from "./ambientLines";

function pickOne(bank: string[]): string {
  return bank[Math.floor(Math.random() * bank.length)];
}

// ---- Gift ------------------------------------------------------------
// Named in data/verbs.ts's own header as a real verb-framework slot left
// empty since Phase 2 ("Rec Room Invite, Gift... wait on content"). No
// real inventory/item system exists to pick a SPECIFIC gift from — this is
// the cheapest version that could work: one generic gesture, a
// catalyst-flavored reaction, same "flavor first, mechanic later" order
// this project already used for Share a Drink before the drunk debuff ever
// mattered mechanically.
export const GIFT_FAVORABILITY_DELTA = 4;

export const GIFT_LINES: Record<Catalyst, string> = {
  wolf: "Didn't have to do that. Appreciate it — good for morale too.",
  dog: "You remembered. That actually means a lot.",
  cat: "Huh. Didn't expect that. I'll take it.",
  crow: "Ooh, for me? Okay, you've officially got my attention.",
  raven: "Thoughtful. I'll put it to good use.",
  bear: "...Thanks. Didn't need it, but thanks.",
  fox: "Careful, now I owe you one. I don't like owing people.",
  rabbit: "That's so sweet of you. Thank you, really.",
  shark: "Not bad. I'll take useful over sentimental any day.",
};

export function pickGiftLine(catalyst: Catalyst): string {
  return GIFT_LINES[catalyst];
}

// ---- Praise / Insult / Apology ----------------------------------------
// System Proposal v1, 1 Sep 2026. Three confirmed decisions from that doc
// drove every number below: (1) repeated Insult escalates past a Favorability
// number into a real story consequence, (2) Apology exists and forgiveness
// is catalyst-gated, (3) Insult always hits harder than Praise heals.
//
// PRAISE_FAVORABILITY_DELTA is flat across catalysts (the doc only asked
// for catalyst-flavored INSULT sting / APOLOGY forgiveness magnitude, not a
// third table for Praise) — kept smaller than every catalyst's own Insult
// magnitude below, satisfying decision #3 for every catalyst, not just on
// average.
export const PRAISE_FAVORABILITY_DELTA = 4;

// The doc's own qualitative table (§4: "Insult stings... / Forgives...")
// turned into real numbers here — my own call under the same latitude the
// Stress & Morale Trigger Proposal's numbers were made under, not something
// Maxime specified digit-by-digit. Rabbit stings hardest and forgives most
// generously ("very hard" / "almost too readily"); cat and shark barely
// register either way; dog is the one genuine both-directions-strong
// catalyst (stings hard, forgives easily if it feels genuine).
export const INSULT_FAVORABILITY_DELTA: Record<Catalyst, number> = {
  wolf: -8,
  dog: -12,
  cat: -5,
  crow: -7,
  raven: -11,
  bear: -10,
  fox: -6,
  rabbit: -14,
  shark: -5,
};

export const APOLOGY_FAVORABILITY_DELTA: Record<Catalyst, number> = {
  wolf: 5,
  dog: 9,
  cat: 2,
  crow: 6,
  raven: 3,
  bear: 2,
  fox: 7,
  rabbit: 10,
  shark: 2,
};

export const INSULT_LINES: Record<Catalyst, string> = {
  wolf: "That's not how you talk to someone who's got your back out there.",
  dog: "...That one actually hurt. I won't forget it.",
  cat: "Wow. Noted. I'll remember that the next time you need something.",
  crow: "Ouch. Okay. Didn't expect that from you.",
  raven: "That was uncalled for, and you know it.",
  bear: "...Fine. Whatever you say.",
  fox: "Careful. I keep a longer memory than you'd like.",
  rabbit: "That really hurt. I didn't deserve that.",
  shark: "Cute. Doesn't change anything, but noted.",
};

export const PRAISE_LINES: Record<Catalyst, string> = {
  wolf: "Good to hear. Means more coming from someone who's actually in the fight with me.",
  dog: "That actually means a lot. Thank you.",
  cat: "Didn't need to hear that, but I won't pretend it didn't land.",
  crow: "Say more of that, actually. I could listen to this all day.",
  raven: "Noted. Good to know the effort's actually visible.",
  bear: "...Thanks. I'll take that.",
  fox: "Careful, compliments like that get you favors later.",
  rabbit: "That's really kind of you to say. Really.",
  shark: "Good. That's the standard — glad it shows.",
};

export const APOLOGY_LINES: Record<Catalyst, string> = {
  wolf: "Appreciate you saying it. We're square — for the team's sake, if nothing else.",
  dog: "Okay. I believe you. Don't make me regret that.",
  cat: "Sure. Whatever. Doesn't really change anything, but fine.",
  crow: "Aw, see, that's better. Let's just have fun again.",
  raven: "I hear you. It'll take more than words, but I hear you.",
  bear: "...Alright. Leave it there.",
  fox: "Apology accepted. Water under the bridge — I don't hold onto much.",
  rabbit: "Thank you for saying that. I really needed to hear it.",
  shark: "Fine. Doesn't cost me anything to move on.",
};

export function pickPraiseLine(catalyst: Catalyst): string {
  return PRAISE_LINES[catalyst];
}
export function pickInsultLine(catalyst: Catalyst): string {
  return INSULT_LINES[catalyst];
}
export function pickApologyLine(catalyst: Catalyst): string {
  return APOLOGY_LINES[catalyst];
}

// The escalation ladder — proposal doc §3, placeholder counts same as
// every number in this file. Tier 2 registers a real hot topic (see
// data/hotTopics.ts's own new "insulted" kind) plus a Stress bump on the
// insulted pilot; Tier 3 is the real standoff, resolved only by
// scenes/Hub.ts's handleRemovePilotRequest, never by Apology alone (see
// this file's own header for why — Maxime's own resolution of §3a).
export const INSULT_TIER2_COUNT = 3;
export const INSULT_TIER2_STRESS_BUMP = 10;
export const INSULT_TIER3_COUNT = 6;
// A pilot who's actually been apologized to and rebuilt real standing
// doesn't get blindsided by Tier 3 even at a high lifetime insultsGiven
// count — same "no real amends landed" gate the proposal doc's own §3
// already specified. Favorability has no fixed scale elsewhere in this
// project (every verb's own delta is its own placeholder), so this is a
// relative floor, not a percentage.
export const INSULT_TIER3_FAVORABILITY_CEILING = -10;

// ---- Congratulate -------------------------------------------------------
// Hot-topic attendance, 2 Sep 2026 — the deliberate half of this pass's
// "let the player actually respond to news instead of only overhearing it"
// idea. Only pays out against a real, still-live "promoted" HotTopic about
// the specific pilot being congratulated (see Hub.ts's congratulateNpc) —
// otherwise this could be farmed for free Favorability by saying the
// phrase to anyone at any time. The muntiLost half of this same idea
// (condolences) is deliberately NOT built this pass — unlike a promotion,
// there's no single living NPC to walk up to for a loss, and forcing a
// weaker version of both halves seemed worse than shipping one real one;
// flagged here as a genuine, well-reasoned trim, not an oversight.
export const CONGRATULATE_FAVORABILITY_DELTA = 5;
export const CONGRATULATE_MORALE_DELTA = 6;

export const CONGRATULATE_LINES: Record<Catalyst, string> = {
  wolf: "Appreciate it. Wouldn't have gotten here without the rest of you, though.",
  dog: "Thanks. Means more coming from you.",
  cat: "Yeah, yeah. I earned it. Thanks for noticing.",
  crow: "Right?! Somebody get a drink going, this deserves a toast.",
  raven: "Thank you. Earned the hard way, like it should be.",
  bear: "...Thanks. Didn't expect the fuss.",
  fox: "Appreciate it. Knew it was coming before Command did, honestly.",
  rabbit: "Thank you so much. That really means a lot to hear.",
  shark: "Thanks. Now watch me earn the next one too.",
};

export function pickCongratulateLine(catalyst: Catalyst): string {
  return CONGRATULATE_LINES[catalyst];
}

// ---- Send-Off ----------------------------------------------------------
// Pre-mission ritual, 2 Sep 2026 — the first real bridge between "I like
// this person" and "it matters when it counts." Shipped Hub-side only that
// pass: the actual tactical payoff (an in-Battle bonus for whoever was sent
// off) needs a real tactical-design conversation and, per this project's own
// combat_sim.py rule, a real tuning pass before it touches live sim-tuned
// numbers — not something to guess at under time pressure. That pass wired
// the ritual and a real, immediate Hub-side payoff (a Favorability bump plus
// genuine Stress relief, reusing the exact mechanism the Stress & Morale
// Trigger Proposal already wired for Share a Drink) and left engine/
// campaignState.ts's CampaignState.preMissionSendOff as a real, named, but
// intentionally UNCONSUMED hook for a future pass.
//
// SEND_OFF_DEFENSE_BONUS, 2 Sep 2026 (later the same day) — that future pass.
// Consumed in scenes/Battle.ts's resolveDeployRoster: the very next mission
// launched after a Send-Off, whether or not the sent-off pilot is actually
// in the deployed squad, clears the flag (see that method's own comment for
// why "the next launch" rather than "whenever this pilot next deploys").
// A flat effectiveDefense bonus for that one mission, matching the "watch my
// back out there" / "look out for me out there" framing of half the line
// bank below more than an attack bonus would have — the ritual is protective
// in flavor, so the mechanic follows.
//
// The number itself is a first-guess placeholder, same discipline as every
// other new social-sim number this project has shipped without a
// combat_sim.py pass (Antfarm bay costs, the Insult-ladder tiers, the
// calendar's own accent costs): reasoned, not simulated. Pitched below
// IMPACT_LANCE_ATK_BONUS (a permanent, purchased +15 ATK) since this is a
// free, one-mission blessing rather than a paid permanent upgrade — needs a
// real playtest pass before anyone treats it as tuned.
export const SEND_OFF_FAVORABILITY_DELTA = 3;
export const SEND_OFF_STRESS_DELTA = -6;
export const SEND_OFF_DEFENSE_BONUS = 8;

export const SEND_OFF_LINES: Record<Catalyst, string> = {
  wolf: "Copy that. I'll bring everyone back, that's the job.",
  dog: "I've got you. Every time, no question.",
  cat: "Sure, sure. I was already planning to come back anyway.",
  crow: "Don't worry about me, worry about how good the story's gonna be after.",
  raven: "Noted. I've got a plan for out there — I always do.",
  bear: "...I'll be fine. Go do your part.",
  fox: "Relax. I've got three ways out of anything they throw at us.",
  rabbit: "Thank you. I'll be careful, I promise.",
  shark: "Watch me. I'm not coming back with anything less than a win.",
};

export function pickSendOffLine(catalyst: Catalyst): string {
  return SEND_OFF_LINES[catalyst];
}

// ---- CO grotto stress relief (Confide) ----------------------------------
// Antfarm Carrier Hub v1 §11.3 always named the grotto as "a Stress-relief
// conversation partner once the grotto opens," and the Stress & Morale
// Trigger Proposal's own open question 4 (resolved 28 Aug 2026) left this
// hook explicitly unbuilt for lack of real CO content: "no real CO
// Stress-relief content exists to hang it on." This is that content.
//
// The MC has never had persisted Stress/Morale of their own —
// data/verbs.ts's own header says so outright ("Actor isn't modeled...
// always the MC"), and the Stress & Morale Trigger Proposal's own build
// note names the exact same gap a second time ("The player character has
// no walkable, ambient-tracked Stress/Morale state"). CampaignState.mcStress
// is the first real slice of fixing that — not the full vision (no NPCs
// asking about the player's stress yet, no UI), just enough real state for
// this one interaction to mean something rather than being all flavor.
export const MC_STRESS_DEFAULT = 40;
export const CONFIDE_STRESS_DELTA = -15;

export const CO_CONFIDE_LINES: string[] = [
  "Alright. Talk. That's what this room's for.",
  "Get it off your chest. Nobody else needs to hear this but me.",
  "Command doesn't mean carrying it alone. Go ahead.",
  "This stays in the room. Say what you need to say.",
];

export function pickCoConfideLine(): string {
  return pickOne(CO_CONFIDE_LINES);
}

// ---- CO Tier-3 call-out --------------------------------------------------
// Fires once, unprompted, the next time the player talks to the CO while a
// pilot is sitting in the Insult Tier-3 standoff (refusesDeployment true)
// and hasn't been called out about yet — same one-shot-per-event shape
// muntiLossAnnounced/mekRetirementAnnounced already use elsewhere in this
// project (HubPilotSocialState.coCalloutGiven, engine/campaignState.ts).
// {NAME} is a plain string substitution, same "one .replace() per
// placeholder, not a general engine" discipline data/hotTopics.ts's own
// renderHotTopicLine already committed to — not worth pulling in a second
// templating approach for one placeholder.
export const CO_CALLOUT_LINES: string[] = [
  "Before you say anything else — {NAME} came to see me. Says they won't fly with you anymore. That's not something I can wave off.",
  "We need to talk about {NAME}. They've asked me directly not to put them on your wing again.",
  "{NAME} won't deploy with you until this is settled. I need to hear from you what you want done about it.",
];

export function pickCoCalloutLine(): string {
  return pickOne(CO_CALLOUT_LINES);
}
