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

// ---- Verb line banks by state, 17 Sep 2026 ------------------------------
//
// Until today eight of the nine resolver verbs had exactly ONE line per
// catalyst (`Record<Catalyst, string>`): praise a drunk rabbit and a
// grieving rabbit and you got the same sentence. Verb plan §5, Maxime's
// decision 2 (§11): the banks move to the greeting bank's shape, one bucket
// per state the pilot can be in when the verb lands, and HE writes the new
// lines in a line thread. So this migration ships every bucket except
// `idle` EMPTY, with the existing line as idle's single entry — behaviour
// is byte-identical until a bucket is filled. Do not draft lines into the
// empty buckets; they are his.
//
// The four states are what the resolver can actually read off the pilot's
// persisted social state (engine/socialVerbResolution.ts): Stress, Morale,
// drunkUntil. The brief called the second bucket "worried"; it is named
// `stressed` here because the Hub-side Worries list is not persisted and
// the resolver never sees it — Stress past STRESS_PANIC_THRESHOLD is the
// honest, readable equivalent. Order of precedence when more than one
// holds, decided here so a line thread can rely on it: drunk beats
// stressed beats low_morale beats idle (a drunk pilot sounds drunk
// whatever else is true).
export type VerbLineState = "idle" | "stressed" | "drunk" | "low_morale";

export const VERB_LINE_STATES: readonly VerbLineState[] = ["idle", "stressed", "drunk", "low_morale"];

/** `idle` is required and non-empty by convention; the other buckets may be absent or empty and fall back to it. */
export type VerbLineBank = Record<Catalyst, { idle: string[] } & Partial<Record<Exclude<VerbLineState, "idle">, string[]>>>;

/** Pick a line for this catalyst in this state, falling back to `idle` when the state's bucket is missing or empty. */
export function pickVerbLine(bank: VerbLineBank, catalyst: Catalyst, state: VerbLineState, rng: () => number = Math.random): string {
  const entry = bank[catalyst];
  const bucket = state === "idle" ? entry.idle : entry[state];
  const lines = bucket && bucket.length > 0 ? bucket : entry.idle;
  return lines[Math.floor(rng() * lines.length)];
}

/** One line per catalyst → the bank shape above, with that line as idle's only entry. The migration helper; the eight banks below all use it. */
function singleLineBank(lines: Record<Catalyst, string>): VerbLineBank {
  const out = {} as VerbLineBank;
  for (const [catalyst, line] of Object.entries(lines) as [Catalyst, string][]) out[catalyst] = { idle: [line] };
  return out;
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

// The authored lines, one per catalyst — unchanged. GIFT_LINES below is the bank shape the resolver reads.
export const GIFT_IDLE_LINES: Record<Catalyst, string> = {
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

export const GIFT_LINES: VerbLineBank = singleLineBank(GIFT_IDLE_LINES);

export function pickGiftLine(catalyst: Catalyst, state: VerbLineState = "idle", rng: () => number = Math.random): string {
  return pickVerbLine(GIFT_LINES, catalyst, state, rng);
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

// The authored lines, one per catalyst — unchanged. INSULT_LINES below is the bank shape the resolver reads.
export const INSULT_IDLE_LINES: Record<Catalyst, string> = {
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

export const INSULT_LINES: VerbLineBank = singleLineBank(INSULT_IDLE_LINES);

// The authored lines, one per catalyst — unchanged. PRAISE_LINES below is the bank shape the resolver reads.
export const PRAISE_IDLE_LINES: Record<Catalyst, string> = {
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

export const PRAISE_LINES: VerbLineBank = singleLineBank(PRAISE_IDLE_LINES);

// The authored lines, one per catalyst — unchanged. APOLOGY_LINES below is the bank shape the resolver reads.
export const APOLOGY_IDLE_LINES: Record<Catalyst, string> = {
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

export const APOLOGY_LINES: VerbLineBank = singleLineBank(APOLOGY_IDLE_LINES);

export function pickPraiseLine(catalyst: Catalyst, state: VerbLineState = "idle", rng: () => number = Math.random): string {
  return pickVerbLine(PRAISE_LINES, catalyst, state, rng);
}
export function pickInsultLine(catalyst: Catalyst, state: VerbLineState = "idle", rng: () => number = Math.random): string {
  return pickVerbLine(INSULT_LINES, catalyst, state, rng);
}
export function pickApologyLine(catalyst: Catalyst, state: VerbLineState = "idle", rng: () => number = Math.random): string {
  return pickVerbLine(APOLOGY_LINES, catalyst, state, rng);
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

// The authored lines, one per catalyst — unchanged. CONGRATULATE_LINES below is the bank shape the resolver reads.
export const CONGRATULATE_IDLE_LINES: Record<Catalyst, string> = {
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

export const CONGRATULATE_LINES: VerbLineBank = singleLineBank(CONGRATULATE_IDLE_LINES);

export function pickCongratulateLine(catalyst: Catalyst, state: VerbLineState = "idle", rng: () => number = Math.random): string {
  return pickVerbLine(CONGRATULATE_LINES, catalyst, state, rng);
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

// The authored lines, one per catalyst — unchanged. SEND_OFF_LINES below is the bank shape the resolver reads.
export const SEND_OFF_IDLE_LINES: Record<Catalyst, string> = {
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

export const SEND_OFF_LINES: VerbLineBank = singleLineBank(SEND_OFF_IDLE_LINES);

export function pickSendOffLine(catalyst: Catalyst, state: VerbLineState = "idle", rng: () => number = Math.random): string {
  return pickVerbLine(SEND_OFF_LINES, catalyst, state, rng);
}

// ---- Flirt ---------------------------------------------------------------
// New verb, 12 Sep 2026 (Maxime: "Allow cute to be a flirt word... I could
// say you are cute to a npc and itl raise fav"). Answers a real gap flagged
// but deliberately left unbuilt in the 9 Sep Ask Out phrase-widening pass
// (Build_Log_Addendum_RumorSystemExpansion_09Sep2026.md): "you're cute" and
// its siblings used to fall into Ask Out's own full accept/reject roll
// against the 50-Favorability threshold (data/romance.ts's resolveAskOut) —
// the same mechanical weight as literally proposing a relationship, and a
// real risk of a -8 Favorability hit below that threshold rather than the
// harmless compliment it reads as. Flirt is the softer tier that pass
// named as missing: same flat, guaranteed-positive shape as Praise/Gift
// above, just its own tone and content, so an NPC doesn't respond to
// "you're cute" with a line about their combat performance (Praise's own
// lines, reused, would have read exactly that way). chatIntent.ts moved the
// casual-compliment phrasing ("you're cute," "flirt with you," "i like
// you," etc.) off Ask Out's own list and onto this one; the literal
// proposal phrasing ("ask her out," "be my girlfriend," "will you go out
// with me," "i love you") stayed on Ask Out exactly as it was — Maxime's
// own split, confirmed via AskUserQuestion rather than guessed.
//
// FLIRT_FAVORABILITY_DELTA sits above Praise's flat +4 (costs a little more
// nerve to say than "good job") and well below Ask Out's accepted +15
// (which also starts an actual relationship — Flirt never does that, on
// purpose, that's the whole point of the softer tier). Placeholder under
// this file's own "not sim-tuned" caveat, same as every other number here.
export const FLIRT_FAVORABILITY_DELTA = 6;

// Favorability gate, 12 Sep 2026 (Placeholder TODO item N — the Flirt design
// collision) — Maxime's own locked spec: "Requires 40+ existing Favorability
// with the target already." Layers ON TOP of the species gate above
// (romanceable) rather than replacing it — his own call between the two
// options that collision surfaced. Below this, Flirt refuses exactly like
// any other requirements-gated verb (Congratulate's own "Congrats for
// what?" precedent): a plain line, nothing moves, nothing logged. Ask Out's
// own ROMANCE_MIN_FAVORABILITY (romance.ts, 50) is a separate number for a
// separate verb — Maxime's own call was to leave that one alone.
export const FLIRT_FAVORABILITY_GATE = 40;

// Three lines per catalyst rather than Praise/Gift's one flat line each —
// Maxime's own call, made when asked whether this verb should get its own
// content or just borrow Praise's ("At least 27 new line"). Same array-and-
// pickOne shape CO_CONFIDE_LINES/CO_CALLOUT_LINES below already use, picked
// at random per use so spamming the same phrase at the same NPC doesn't
// just echo one static reply back forever the way Praise/Gift/Congratulate/
// Send-Off's flat Record<Catalyst, string> banks would.
export const FLIRT_LINES: Record<Catalyst, string[]> = {
  wolf: [
    "Careful. Keep saying things like that and I'll start walking you back to quarters personally.",
    "Cute goes further with me than you'd think. Don't let it go to your head.",
    "Noted. And appreciated more than I probably let on.",
  ],
  dog: [
    "You can't just say that and walk away, you know.",
    "...Okay, that got me. Say it again sometime.",
    "I'm going to be smiling about that for the rest of the shift, so thanks.",
  ],
  cat: [
    "Hm. Keep talking like that and I might actually start listening.",
    "Flattery. I see what you're doing. It's working, a little.",
    "Don't get used to me agreeing with you, but... yeah, I heard that.",
  ],
  crow: [
    "Oh, we're doing THIS now? Fine by me, keep it coming.",
    "Careful, I'll start showing up wherever you are on purpose.",
    "Flattery gets you everywhere with me. Absolutely everywhere.",
  ],
  raven: [
    "Noted, and — for what it's worth — received exactly the way you meant it.",
    "That's a more direct approach than I expected from you. I don't mind it.",
    "I don't say this often, so take it seriously: that landed.",
  ],
  bear: [
    "...Huh. Didn't see that coming. ...Thanks.",
    "Say that again and I might actually smile. Might.",
    "Don't make a habit of it. ...Actually, do.",
  ],
  fox: [
    "Careful now — compliments like that put you in my debt.",
    "Oh, I like this game. Let's keep playing it.",
    "Flirting with me is a bold financial decision. I approve.",
  ],
  rabbit: [
    "You can't just say that to me and expect me to function normally after.",
    "...That's really sweet. I mean it, that's really sweet.",
    "Okay, now I'm blushing. Thanks for that, I think.",
  ],
  shark: [
    "Noted. Don't expect a blush, but I heard you.",
    "Cute. Doesn't change the mission. But cute.",
    "That's a first from you. I'll allow it.",
  ],
};

export function pickFlirtLine(catalyst: Catalyst): string {
  return pickOne(FLIRT_LINES[catalyst]);
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

// ---- Condolences ---------------------------------------------------------
// 15 Sep 2026 — the half of the 2 Sep "hot-topic attendance" idea this file's
// own Congratulate header named as deliberately NOT built that pass ("unlike
// a promotion, there's no single living NPC to walk up to for a loss").
// That's still true, and it's the actual design question this verb has to
// answer, not a blocker: a loss has no single correct target the way a
// promotion does (the promoted pilot is right there; the pilot who died
// obviously isn't), so this pays out against ANY living pilot while a
// muntiLost HotTopic is still live — you're not consoling the specific
// person the topic is "about" (aboutPilotId is the deceased), you're
// comforting whoever you're standing in front of while the loss is still
// fresh news, the same way ambient chatter lets any nearby pilot bring it up
// (data/hotTopics.ts's own pickHotTopicForSpeaker has no aboutPilotId tie
// either, for the identical reason). Gated the same anti-farming way
// Congratulate gates on "promoted" — no live muntiLost topic, no payout, per
// engine/socialVerbResolution.ts's own "for what?" refusal shape.
export const CONDOLENCE_FAVORABILITY_DELTA = 5;
export const CONDOLENCE_STRESS_DELTA = -6;

// The authored lines, one per catalyst — unchanged. CONDOLENCE_LINES below is the bank shape the resolver reads.
export const CONDOLENCE_IDLE_LINES: Record<Catalyst, string> = {
  wolf: "...Yeah. Doesn't feel real yet. Glad you came by, though — means we're still a company, not just a roster.",
  dog: "Thank you. I keep looking over at where they'd be standing. Stupid, I know.",
  cat: "I'm fine. I don't need — okay. Thanks. I heard you.",
  crow: "Not really in a joking mood today, if that tells you anything. Thanks for checking.",
  raven: "Appreciate it. I'll mourn on my own time — right now there's still a war on, and that's what they'd want anyway.",
  bear: "...Yeah. Thanks. I don't really talk about it. But thanks.",
  fox: "Careful, I might actually let that land instead of deflecting it. ...Thanks. Really.",
  rabbit: "I can't stop thinking about it. Thank you for not pretending everything's fine.",
  shark: "Won't lie, it shook me more than I expected. Appreciate you saying something instead of walking past.",
};

export const CONDOLENCE_LINES: VerbLineBank = singleLineBank(CONDOLENCE_IDLE_LINES);

export function pickCondolenceLine(catalyst: Catalyst, state: VerbLineState = "idle", rng: () => number = Math.random): string {
  return pickVerbLine(CONDOLENCE_LINES, catalyst, state, rng);
}

// ---- Reassurance -----------------------------------------------------------
// Spitball Ideas Addendum, 8 Sep 2026 — Maxime's own ask, verbatim: "I want
// to be able to tell my ant 'you'll be fine''name'' and it lower stress and
// raise moral." That doc named this as slotting straight into the existing
// verb framework with no new resolution model — "a straightforward
// Stress-down/Morale-up delta on the target... just a third lever on numbers
// that already exist" — so, unlike Gift/Praise/Congratulate/etc., this one
// deliberately has NO Favorability line: the doc's own spec was Stress and
// Morale only, and adding a Favorability nudge nobody asked for would be
// scope creep on a verb that was scoped down to exactly two numbers on
// purpose.
//
// Cooldown, 15 Sep 2026 — the doc's own open question #2, resolved: a real
// per-pilot cooldown rather than free-every-time, so this can't be the
// obvious always-do-it button before every mission (the doc's own stated
// risk: "flatten Stress into a number you always zero out"). Enforced in
// Hub.ts (HubNpc.reassuranceCooldownUntil), not in the generic resolver —
// same reasoning as drunkUntil/engagedUntil living on HubNpc rather than in
// engine/socialVerbResolution.ts: this is a per-scene pacing rule, not part
// of what the verb mechanically DOES. Placeholder number, same "not
// sim-tuned" caveat as everything else in this file.
export const REASSURANCE_STRESS_DELTA = -10;
export const REASSURANCE_MORALE_DELTA = 8;
export const REASSURANCE_COOLDOWN_MS = 3 * 60 * 1000;

// The authored lines, one per catalyst — unchanged. REASSURANCE_LINES below is the bank shape the resolver reads.
export const REASSURANCE_IDLE_LINES: Record<Catalyst, string> = {
  wolf: "Yeah. Yeah, okay. We'll get through it together, like always.",
  dog: "...Thank you. I needed to hear that more than I realized.",
  cat: "I wasn't worried. But — fine. It helps. A little.",
  crow: "Aw, look at you, being all supportive. Okay, I feel better. Don't tell anyone.",
  raven: "Noted. And believed, for what that's worth coming from you.",
  bear: "...Alright. I'll be fine either way, but... thanks.",
  fox: "You didn't have to do that. I'll pretend I don't appreciate it. I do, though.",
  rabbit: "Really? You mean that? ...Okay. Okay, I believe you. Thank you.",
  shark: "I wasn't losing sleep over it. But that's good to hear regardless.",
};

export const REASSURANCE_LINES: VerbLineBank = singleLineBank(REASSURANCE_IDLE_LINES);

export function pickReassuranceLine(catalyst: Catalyst, state: VerbLineState = "idle", rng: () => number = Math.random): string {
  return pickVerbLine(REASSURANCE_LINES, catalyst, state, rng);
}

// ---- Check-In (surfacing a pilot's real Worries state) --------------------
// 15 Sep 2026 — reads data/worries.ts's already-shipped Worries System
// (9 real sources: a missing squadmate, 7 combat outcomes, 2 Gate-4
// suppression sources) instead of inventing new content from nothing. Real
// gap this verb closes: today that whole system only ever surfaces through
// ambient chatter's own probability roll (pickSoloEcho, ambientLines.ts) —
// a player who wants to know what's actually bothering a pilot has no way to
// just ASK and get a guaranteed answer, only to wait around and hope the
// idle-chatter dice land on it.
//
// Honest scope line, worth stating plainly rather than leaving implicit: the
// live pickSoloEcho path doesn't actually differentiate its "fear" line by
// WorrySourceId at all — every worry, missing-pilot or combat or suppressed,
// currently renders the exact same generic dread content (LINE_BANK[catalyst]
// ["fear"][stage], no per-source variant exists anywhere in this codebase
// today). Reusing that path verbatim for Check-In would technically work but
// would answer "what's wrong?" with the same flavorless line regardless of
// what's actually wrong — a real letdown for a verb whose entire point is
// finding out something specific. This block goes one step further than the
// bare minimum without going all the way to a full 9-source content matrix
// (81 lines): three real content buckets, grouping the 9 sources by what
// they're actually about, plus a fourth "nothing's wrong" bucket for when a
// pilot has no live worry — 4 buckets × 9 catalysts, matching the same
// per-catalyst array scale Flirt already set as this project's going rate
// for "this verb deserves its own real content."
export type CheckInBucket = "missing" | "combat" | "suppressed" | "clear";

// mission_pilot_missing -> missing; every combat_* source -> combat; both
// hub_suppressed_* sources -> suppressed. worries.ts's own WorrySourceId
// union is the source of truth for this mapping — if a tenth source is ever
// added there, TypeScript's exhaustiveness on the switch in
// bucketForWorrySource (below) is what will flag it, not memory.
export const CHECK_IN_FAVORABILITY_DELTA = 2;

export const CHECK_IN_LINES: Record<CheckInBucket, Record<Catalyst, string>> = {
  missing: {
    wolf: "Honestly? I keep checking the board for word on the squad still out there. Can't help it.",
    dog: "I won't lie, I'm worried sick about them. Any word at all would help.",
    cat: "...I've been keeping half an eye on the deployment board, if you must know.",
    crow: "Trying not to think about it, which means I'm thinking about it constantly. Great system.",
    raven: "I'm tracking it. Doesn't mean I'm not concerned — I just don't say it every five minutes.",
    bear: "...They're late. I noticed. I'm not gonna make a thing of it.",
    fox: "I've got three theories on what's holding them up, none of them good. Don't ask.",
    rabbit: "I can't stop thinking about them out there. What if something's wrong?",
    shark: "They'd better have a good reason for running this long. I'm watching the clock.",
  },
  combat: {
    wolf: "Still running the last mission back in my head. Wondering if I could've covered someone better.",
    dog: "Something from out there's still sitting with me. I'll be alright, just... still there.",
    cat: "It's fine. I'm fine. I've just been a little off since the last sortie, that's all.",
    crow: "Weird after-mission brain, you know? Can't shake a few seconds of it.",
    raven: "Replaying the last engagement. Looking for what I'd change, if there's anything.",
    bear: "...It was a rough one out there. I don't need to talk about it. But it was rough.",
    fox: "I've got it handled. Mostly. There's just one part of the last op I keep circling back to.",
    rabbit: "I keep seeing it when I close my eyes. The last mission, I mean. I'm okay, I just — yeah.",
    shark: "Still recalibrating after the last sortie. Nothing I can't push through.",
  },
  suppressed: {
    wolf: "There's something I've been sitting on. Not the time, probably. Maybe later.",
    dog: "I've got something on my mind I haven't said out loud yet. It's fine. It'll keep.",
    cat: "There's a thing I decided not to say earlier. Still deciding if that was right.",
    crow: "Oh, there's definitely a whole thing I'm not talking about. Nice of you to notice, though.",
    raven: "I held something back earlier. Deliberately. I'll bring it up when it's actually useful to.",
    bear: "...There's something. I'm not saying it. Leave it there.",
    fox: "Let's just say I've got a card I'm not showing yet. Ask me again some other time.",
    rabbit: "I wanted to say something earlier and didn't. I probably should have. Sorry.",
    shark: "There's a conversation I'm putting off. Not today, though. Today I've got a job to do.",
  },
  clear: {
    wolf: "Nothing on my mind, honestly. Squad's good, I'm good. Ask me again after the next op.",
    dog: "Doing alright, actually! Thanks for asking, that's genuinely nice of you.",
    cat: "I'm fine. Why does everyone keep asking. I'm FINE.",
    crow: "Clear skies up here! Well, figuratively. Ask me literally and it's a different answer.",
    raven: "Nothing pressing. I'd tell you if there were — no sense carrying quiet weather like a storm.",
    bear: "...Nothing. I'm good. Was there something else?",
    fox: "Nothing you need to worry about. That's not a deflection, for once — I mean it.",
    rabbit: "I'm okay! Really. Things have actually been pretty good lately.",
    shark: "Nothing's slowing me down right now. Ask me again once something actually goes wrong.",
  },
};

// worries.ts's own WorrySourceId union, mapped down to the four content
// buckets above. Exhaustive switch on purpose — a tenth WorrySourceId added
// there without a matching case here is a compile error, not a silent gap.
export function bucketForWorrySource(source: import("./worries").WorrySourceId): CheckInBucket {
  switch (source) {
    case "mission_pilot_missing":
      return "missing";
    case "combat_kill":
    case "combat_repair":
    case "combat_downed":
    case "combat_permadeath_lost":
    case "combat_permadeath_recoverable":
    case "combat_overwatch":
    case "combat_dodge":
      return "combat";
    case "hub_suppressed_anger":
    case "hub_suppressed_askout":
      return "suppressed";
  }
}

export function pickCheckInLine(catalyst: Catalyst, bucket: CheckInBucket): string {
  return CHECK_IN_LINES[bucket][catalyst];
}

// ---- Challenge to Spar (player-initiated) ---------------------------------
// 15 Sep 2026 — the player-facing counterpart to the existing ambient,
// boredom-triggered Spar (scenes/Hub.ts's tryBoredomSpar/runBoredomSpar,
// 30 Aug 2026). Deliberately NOT the same resolution path: that one runs
// through engine/socialSim.ts's resolveSparEncounter, which resolves two
// full SocialSimPilot records against each other (catalyst, stage, species)
// — the MC has never been modeled as one of those (data/verbs.ts's own
// header: "Actor isn't modeled... always the MC," the same gap the CO
// Confide header names a second time). Bolting the player onto a function
// built for two NPCs would mean inventing a fake catalyst/stage/species for
// a character that doesn't canonically have any, which reads as a hack
// dressed up as a reuse. This is a small, separate, honestly-simpler
// resolution instead: a flat three-way roll, no hidden stat comparison
// (there's nothing to compare against), same spirit as a friendly sparring
// match between two people where the actual skill numbers don't exist yet.
//
// All three outcomes move Favorability up, never down — a friendly challenge
// in the Spar Room isn't Insult-tier risk, and losing a spar to your own
// commanding officer is, if anything, a better story than winning one.
// Placeholder magnitudes and odds, same "not sim-tuned" caveat as everything
// else in this file.
export type SparChallengeOutcome = "win" | "lose" | "draw";

export const SPAR_CHALLENGE_FAVORABILITY_DELTA: Record<SparChallengeOutcome, number> = {
  win: 6,
  lose: 8,
  draw: 4,
};

// Roughly even thirds, lose given a slight edge — these are trained mech
// pilots and the MC's own combat record isn't modeled as a stat anywhere,
// so "the pilot usually holds their own against the boss" reads truer than
// a flat coin-flip would. Not simulated, not tuned — a reasoned guess under
// the same latitude every other placeholder number in this file carries.
export function rollSparChallengeOutcome(rng: () => number = Math.random): SparChallengeOutcome {
  const roll = rng();
  if (roll < 0.3) return "win";
  if (roll < 0.7) return "lose";
  return "draw";
}

export const SPAR_CHALLENGE_LINES: Record<Catalyst, Record<SparChallengeOutcome, string>> = {
  wolf: {
    win: "Ha! Good bout. You've been holding out on us — that's a real fight stance.",
    lose: "Yeah, that's a win, no argument. Good spar, though — you kept up.",
    draw: "Even match. I'll take that as a compliment, coming from command.",
  },
  dog: {
    win: "You got me! No hard feelings, that was a genuinely good fight.",
    lose: "That one's mine, sorry! You'll get me next time.",
    draw: "Even trade. That was actually really fun, thank you for asking.",
  },
  cat: {
    win: "...Fine. You won. Don't let it go to your head.",
    lose: "I win. Obviously. Better luck next time, Commander.",
    draw: "A draw. I'll allow it. This time.",
  },
  crow: {
    win: "Okay THAT was embarrassing, but also kind of fun? Rematch?",
    lose: "Ha, got you! That felt amazing, ask me again sometime.",
    draw: "Nobody wins, everybody's tired — perfect spar, honestly.",
  },
  raven: {
    win: "Clean win, your side. I'll adjust my footwork before we go again.",
    lose: "Mine, this round. You left an opening early — worth knowing for next time.",
    draw: "Dead even. Good data either way.",
  },
  bear: {
    win: "...Yeah. You got me. Good spar.",
    lose: "That's mine. No hard feelings.",
    draw: "...Even. Fine by me.",
  },
  fox: {
    win: "Alright, alright — you got the better of me. Won't happen twice.",
    lose: "That's a win for me. Don't worry, I won't tell anyone the Commander lost.",
    draw: "A draw. Neither of us has to admit anything. I like this outcome.",
  },
  rabbit: {
    win: "You beat me! That was really impressive, actually.",
    lose: "I won that one — you're really not bad though, seriously!",
    draw: "That was so close! That was fun, we should do it again sometime.",
  },
  shark: {
    win: "You earned that one. Don't expect it twice.",
    lose: "That's a win on my ledger. Come back when you've trained more.",
    draw: "Even. I don't love a draw, but I respect it.",
  },
};

export function pickSparChallengeLine(catalyst: Catalyst, outcome: SparChallengeOutcome): string {
  return SPAR_CHALLENGE_LINES[catalyst][outcome];
}
