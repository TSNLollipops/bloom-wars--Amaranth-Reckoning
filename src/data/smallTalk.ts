// src/data/smallTalk.ts
// Chat Keyword Categories Plan v1 (26 Aug 2026) named five small-talk
// categories worth adding to typed chat — Greeting, Mission-Worry check-in,
// Farewell, Advice, Banter (claude/Bloom_Wars_Chat_Keyword_Categories_
// Plan_v1.md). A first content/recognizer draft for all five went down the
// same day in claude/Bloom_Wars_Chat_Keyword_Categories_Delivery_v1.md, but
// that pass had no connected device and said so plainly: "not yet verified
// against the live chatIntent.ts/Hub.ts." Nothing from that draft shipped.
//
// On 1 Sep 2026, three fresh content-only docs picked Greeting/Farewell/
// Advice/Banter back up with richer, purpose-written banks:
//   - claude/Bloom_Wars_Crew_Greeting_Farewell_Line_Bank_v1.md (Greeting +
//     Farewell, 4 lines x 9 catalysts each, catalyst-only — not crossed
//     against Echo/Stage, a deliberate sizing call, see that doc's own §0)
//   - claude/Bloom_Wars_Crew_Advice_Banter_Line_Bank_v1.md (Advice + Banter,
//     same shape and scope call)
//   - claude/Bloom_Wars_CO_Bespoke_Dialogue_Bank_v1.md (the CO — Arangement
//     of Content — gets his own fixed voice for Greeting/Advice/Farewell
//     instead of drawing from the shared nine-catalyst pool everyone else
//     uses; he has no bespoke Banter/Worry content, so those two fall back
//     to his own catalyst's crew content like any other NPC)
// This file is where all three actually get wired in, closing the
// recognizer/routing gap every one of them flagged as still open, and
// superseding the 27 Aug Delivery doc's own sparser FAREWELL_LINES (3 x 9)
// /ADVICE_LINES (1 x 9)/BANTER_LINES (1 x 9) drafts, which never shipped —
// the fuller 1 Sep banks are what's actually implemented here.
//
// Two judgment calls worth flagging, since both change what the 26/27 Aug
// docs originally proposed:
//
// 1. Greeting used to mean "zero new content, just reuse pickAmbientLine"
//    (Categories Plan v1's own #1). Now that Greeting has real, dedicated
//    content of its own (the 1 Sep bank), Worry check-in's own "otherwise
//    fall back to the same general ambient pick as a greeting" (Categories
//    Delivery v1) is read against what Greeting means TODAY — Hub.ts's own
//    worry_checkin handling calls pickAmbientLineWithMemory (the same rich,
//    mood/needs/bleed-aware pick every ordinary Talk already uses) rather
//    than this file's own pickGreetingLine, since a worry check-in's whole
//    point is reflecting the listener's actual current state, which the
//    dedicated Greeting bank (deliberately mood-blind, see the Greeting/
//    Farewell bank's own §0) was never meant to do.
// 2. The CO's bespoke bank doesn't cover Banter or Worry check-in at all —
//    both fall back to treating him like any other pilot of his own
//    catalyst (wolf, as of the Background/Catalyst Formula pass), which
//    the CO bank's own §0 already establishes as his baseline for anything
//    this bank doesn't explicitly override.
import { type Catalyst, STRESS_PANIC_THRESHOLD } from "./ambientLines";

function pickOne(bank: string[]): string {
  return bank[Math.floor(Math.random() * bank.length)];
}

// ---- Crew Greeting & Farewell — Bloom_Wars_Crew_Greeting_Farewell_Line_Bank_v1.md, 1 Sep 2026 ----

export const GREETING_LINES: Record<Catalyst, string[]> = {
  wolf: [
    "There you are — we were about to start without you.",
    "Good, the whole crew's closer to together now.",
    "Hey. Who else is around today?",
    "Perfect timing, actually — needed another set of hands.",
  ],
  dog: [
    "Hey. Good to see you, for real.",
    "Was hoping you'd swing by.",
    "There you are. I mean that.",
    "Good — was starting to wonder where you'd gotten to.",
  ],
  cat: [
    "Oh. It's you.",
    "You want something, or is this just a social call?",
    "Fine, you can stay. Doesn't cost me anything.",
    "Make it quick, I was in the middle of something.",
  ],
  crow: [
    "Finally, someone worth talking to shows up.",
    "Tell me something fun happened today.",
    "Perfect timing — I was bored out of my skull.",
    "Oh good, an excuse to stop what I'm doing.",
  ],
  raven: [
    "Good timing — I've got something worth telling you.",
    "You look like you could use a pointer or two.",
    "Come here, let me set you straight on something.",
    "Ah — someone willing to actually listen for once.",
  ],
  bear: [
    "...Didn't expect company.",
    "You can sit. I won't talk much.",
    "Hm. You again.",
    "Not much to say, but go ahead.",
  ],
  fox: [
    "Well, well. Look who wandered over.",
    "Careful, I might talk you into something.",
    "You've got that look — like you already know I'm trouble.",
    "Come closer. I don't bite. Much.",
  ],
  rabbit: [
    "Oh, hi — how are you holding up, really?",
    "There you are. Have you eaten anything today?",
    "Come sit, you look like you need a minute.",
    "Hey — I've been meaning to check on you.",
  ],
  shark: [
    "You. Good. I've got a minute for you.",
    "Talk fast, I've got places to be.",
    "What do you need — let's make this count.",
    "Good, you're here. Let's not waste the time.",
  ],
};

export const FAREWELL_LINES: Record<Catalyst, string[]> = {
  wolf: [
    "Go on, we've got this covered.",
    "Catch up with the others, yeah? Don't disappear on us.",
    "See you back with the group.",
    "Don't be a stranger — we're better with you in it.",
  ],
  dog: [
    "I'll be right here if you need anything.",
    "Take care of yourself out there.",
    "Same time tomorrow, yeah?",
    "You know where to find me.",
  ],
  cat: [
    "Yeah, yeah. Go.",
    "Don't take it personal if I don't walk you out.",
    "That's my cue to get back to my own business.",
    "See you whenever. I'll survive either way.",
  ],
  crow: [
    "Don't have too much fun without me.",
    "Go on — I'll find something to entertain myself.",
    "Come back when there's actually something interesting to talk about.",
    "Later. Try not to be boring in the meantime.",
  ],
  raven: [
    "Remember what I told you.",
    "Go put that into practice.",
    "Think about what we covered.",
    "You'll do better next time, now that you know.",
  ],
  bear: [
    "Alright. I'll be here. Alone, probably.",
    "Go on. I've got quiet to get back to.",
    "See you around, I suppose.",
    "That's enough talking for one day.",
  ],
  fox: [
    "Watch your back — mine too, probably.",
    "Go on, before I talk you into something dumb.",
    "See you. Try to keep up.",
    "Later. Don't trust everything I just told you.",
  ],
  rabbit: [
    "Take care of yourself, okay?",
    "Come find me if you need anything at all.",
    "Get some rest if you can.",
    "I'll be thinking of you — go on now.",
  ],
  shark: [
    "Go get something done.",
    "Don't stand around — momentum matters.",
    "See you at the top of whatever's next.",
    "Make the most of the rest of your day.",
  ],
};

export function pickGreetingLine(catalyst: Catalyst): string {
  return pickOne(GREETING_LINES[catalyst]);
}

export function pickFarewellLine(catalyst: Catalyst): string {
  return pickOne(FAREWELL_LINES[catalyst]);
}

// ---- Crew Advice & Banter — Bloom_Wars_Crew_Advice_Banter_Line_Bank_v1.md, 1 Sep 2026 ----
// Peer-to-peer crew advice, casual register, not gated on a Stress read —
// distinct from the CO's own Advice/Stress-relief bank below, which is a
// specific mentor-register response to an elevated Stress read from one
// fixed character. The two don't compete for the same trigger.

export const ADVICE_LINES: Record<Catalyst, string[]> = {
  wolf: [
    "Best advice I've got — don't try to do this alone. None of us do.",
    "Lean on the squad. That's what we're here for.",
    "Whatever it is, it's lighter split between more people.",
    "Ask for help before you need it, not after.",
  ],
  dog: [
    "Stick with the people who've already proven they've got you.",
    "Loyalty's not blind — it's just choosing who's earned it and staying with them.",
    "Whatever you decide, decide it for the people who'd do the same for you.",
    "Don't burn a bridge over a bad day. Bad days pass, bridges don't rebuild themselves.",
  ],
  cat: [
    "Look out for yourself first. Nobody else is going to do it for you.",
    "Ask what's actually in it for you before you say yes to anything.",
    "You don't owe everyone an explanation.",
    "Take care of your own business. Everyone else is taking care of theirs.",
  ],
  crow: [
    "Whatever's stressing you out, go do something that isn't that for a while.",
    "You're allowed to have fun even when things are bad. Especially then.",
    "Don't let this place turn you into someone who forgot how to enjoy anything.",
    "Go blow off some steam. The problem will still be there after.",
  ],
  raven: [
    "Learn the lesson the first time so you don't have to learn it twice.",
    "Slow down and think it through before you act on it.",
    "Ask yourself what you'd tell someone else in your position.",
    "Every mistake's a lesson if you actually pay attention to it.",
  ],
  bear: [
    "Sometimes the answer is just — don't. Walk away from it.",
    "You don't have to solve it today.",
    "Not everything needs company to get through.",
    "Give yourself space before you decide anything.",
  ],
  fox: [
    "There's always more than one way through a problem. Find the sneaky one.",
    "Don't take the straight path if a clever one gets you there faster.",
    "The rules bend more than people think. Use that.",
    "If it's not working head-on, come at it sideways.",
  ],
  rabbit: [
    "Be gentle with yourself. You're doing better than you think.",
    "Make sure you're actually taking care of yourself, not just everyone else.",
    "It's okay to ask for help. That's not weakness.",
    "Whatever it is, you don't have to carry it alone.",
  ],
  shark: [
    "Stop overthinking it and just move. Momentum solves more than planning does.",
    "Figure out what you actually want, then go get it.",
    "Don't wait for the perfect moment. It's not coming.",
    "Every setback's just a detour if you keep pushing.",
  ],
};

export const BANTER_LINES: Record<Catalyst, string[]> = {
  wolf: [
    "Why'd the squad cross the minefield? Because none of us wanted to go alone.",
    "You know what's funny? Two people trying to squeeze through one doorway at the same time. Every time.",
    "Best joke I know is 'solo mission.' Like that's a real thing that happens here.",
    "Does a group hug count as tactical positioning? Asking for a friend.",
  ],
  dog: [
    "I'd tell you a joke, but I already told it to you twice and you laughed both times, so I know it's good.",
    "Nothing's funnier than watching someone realize I remembered their birthday.",
    "Knock knock. ...You're supposed to say 'who's there.' See, this is why I like you — you never play along either.",
    "Funniest thing I've seen all week was you thinking you could sneak past me.",
  ],
  cat: [
    "You want a joke? Fine — you, thinking I have free jokes to give away.",
    "Here's one that's funny to me and probably not to you.",
    "I laugh at plenty of things. Most of them are other people's problems.",
    "Sure, I've got a joke. It's gonna cost you, though.",
  ],
  crow: [
    "Why did the Munti bring a toolkit to a party? Because every party's an emergency if you look hard enough.",
    "You ever laugh so hard at your own joke nobody else even needs to?",
    "I've got about six jokes queued up and zero shame about any of them.",
    "Life's too short for bad jokes. Luckily, I only tell great ones. Allegedly.",
  ],
  raven: [
    "Here's a joke with a lesson buried in it — see if you catch it.",
    "The funniest thing is watching someone learn the hard way what I already told them.",
    "I'll tell you a joke if you promise to remember the point of it.",
    "Humor's just a lesson that doesn't feel like one yet.",
  ],
  bear: [
    "...I don't really do jokes.",
    "Fine. Two guys walk into a bar. I stayed home. The end.",
    "I laughed once. It was a good day.",
    "You want funny, go find Crow. I've got nothing.",
  ],
  fox: [
    "Here's a joke — but I might be lying about the punchline.",
    "I'd tell you one, but I'd rather just let you walk into it.",
    "The best joke's the one you don't see coming. Watch yourself.",
    "Ask me for a joke and you might end up the punchline.",
  ],
  rabbit: [
    "Why did the little Bloom cross the road? Nobody knows, but I hope it made it safe.",
    "I mostly just like seeing you smile, joke or not.",
    "Here's a silly one, just for you.",
    "I'm not the funniest, but I'll always try if it means you laugh.",
  ],
  shark: [
    "Fastest joke I've got — ready? Go.",
    "I don't really do jokes. I do results. But fine, here's one.",
    "You want funny? Watch me close this next objective.",
    "One joke, then back to work. Ready?",
  ],
};

export function pickAdviceLine(catalyst: Catalyst): string {
  return pickOne(ADVICE_LINES[catalyst]);
}

export function pickBanterLine(catalyst: Catalyst): string {
  return pickOne(BANTER_LINES[catalyst]);
}

// ---- The CO's own bespoke bank — Bloom_Wars_CO_Bespoke_Dialogue_Bank_v1.md, 1 Sep 2026 ----
// One fixed voice, not crossed against the nine catalysts — see that doc's
// own §0 for why (he's a specific named character, not a Wolf/Bear reading
// from the shared pool). Deliberately non-romantic throughout, per the same
// doc — he's locked non-romanceable so "can I date my CO" never becomes the
// answer to "does my CO help me cope."

export const CO_GREETING_LINES: string[] = [
  "Grotto's yours as long as you need it. What's on your mind?",
  "You made it down here in one piece. That's a start.",
  "No line today. Come on in.",
  "I was starting to think you'd forgotten where I sit.",
  "Door's always open. Doesn't mean the news is always good — just that it's open.",
  "Sit if you want. I don't stand on ceremony down here.",
  "Whatever you're carrying topside, you can set it down for a minute first.",
  "Talk first, business after. That's the order down here.",
];

// Calm/elevated split keys off the same STRESS_PANIC_THRESHOLD (>=70)
// every other panicking-Stress check in this codebase already uses
// (pickSoloEcho, breakdown.ts) — the CO bank's own §2 cites this exact
// threshold by name, so this isn't a new number, just the existing one
// reused for a fourth consumer.
export const CO_ADVICE_CALM_LINES: string[] = [
  "You're not required to have it all figured out by the time you leave this room.",
  "Everyone topside's got an opinion on how you should be handling it. I've got exactly one — however you're actually managing to.",
  "The ones who never ask for a minute are the ones I keep an eye on. You asking is the healthy part.",
  "You did the job. Let that be enough for tonight.",
  "This outfit doesn't run on people who never need to stop. It runs on people who know when to.",
];

export const CO_ADVICE_ELEVATED_LINES: string[] = [
  "You're wound tight enough I can hear it from the doorway. Sit down before you say anything.",
  "Whatever's chewing on you doesn't get solved standing at attention. Sit.",
  "I've watched good pilots run themselves into the ground insisting they were fine. I'd rather you weren't one of them.",
  "You don't have to tell me what it is. You do have to stop carrying it alone for five minutes.",
  "This isn't the room where you have to be squared away. Save that for topside.",
];

export const CO_FAREWELL_LINES: string[] = [
  "Go on. I'll be here.",
  "Get some rest if you can find it.",
  "Come back down when you need to. I'm not going anywhere.",
  "Head up. Watch the deck plates near the hatch, they've been sticking.",
  "That's enough for today. Go.",
  "Door's open behind you too, for what it's worth.",
  "Don't make me come find you next time.",
  "Topside's waiting. So am I, whenever you're back.",
];

export function pickCoGreetingLine(): string {
  return pickOne(CO_GREETING_LINES);
}

export function pickCoFarewellLine(): string {
  return pickOne(CO_FAREWELL_LINES);
}

export function pickCoAdviceLine(stress: number): string {
  return pickOne(stress >= STRESS_PANIC_THRESHOLD ? CO_ADVICE_ELEVATED_LINES : CO_ADVICE_CALM_LINES);
}
