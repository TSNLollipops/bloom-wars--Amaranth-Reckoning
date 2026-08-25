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

export type Catalyst = "wolf" | "dog" | "cat" | "crow" | "raven" | "bear" | "fox" | "rabbit" | "shark";
export type Echo = "love" | "fear" | "anger" | "sadness";

const PANIC_THRESHOLD = 25; // matches pilot_creator.html's own "panicking" cutoff

export type AmbientPilotState = {
  catalyst: Catalyst;
  stress: number; // 0-100
  morale: number; // 0-100
  drunk: boolean;
};

export type EchoPick = { echo: Echo; reason: string };

// Solo echo pick — ported verbatim from pilot_creator.html's
// pickSoloEchoForPilot (line ~3753), minus the grief-worn branch (see file
// header). Order matters: acute states (drunk/panicking/low-morale) take
// priority over the idle fallback, same as the sandbox.
export function pickSoloEcho(pilot: AmbientPilotState): EchoPick {
  if (pilot.drunk) return { echo: Math.random() < 0.5 ? "love" : "anger", reason: "drunk" };
  if (pilot.stress >= 70) return { echo: "fear", reason: "panicking" };
  if (pilot.morale <= PANIC_THRESHOLD) return { echo: "sadness", reason: "low morale" };
  const pool: Echo[] = ["love", "fear", "anger", "sadness"];
  return { echo: pool[Math.floor(Math.random() * pool.length)], reason: "idle" };
}

export function pickAmbientLine(pilot: AmbientPilotState): { line: string; pick: EchoPick } {
  const pick = pickSoloEcho(pilot);
  const bank = LINE_BANK[pilot.catalyst][pick.echo];
  return { line: bank[Math.floor(Math.random() * bank.length)], pick };
}

// LINE_BANK — ported verbatim from pilot_creator.html (line 2921), 9
// catalysts x 4 echoes x 5 lines each. Not a single word changed; this is
// already-tested content, not fresh writing.
export const LINE_BANK: Record<Catalyst, Record<Echo, string[]>> = {
  wolf: {
    love: [
      "Good, you're here — makes the squad feel whole again.",
      "Don't go quiet on me. We're stronger loud, together.",
      "You're part of this crew whether you admit it or not.",
      "Nobody drinks alone, nobody walks point alone. That's the deal.",
      "Good instincts today — you moved like you trust us now.",
    ],
    fear: [
      "Don't scatter. If we spread out now, we lose someone else.",
      "Stay close. I can't watch everyone if we split up.",
      "Sound off. I need to hear every voice before we move.",
      "Nobody goes off comms. Not even for a second.",
      "I keep a headcount in my head at all times. It never turns off.",
    ],
    anger: [
      "Nobody gets left behind. That's not up for debate.",
      "You don't fight alone on my watch — argue with me all you want.",
      "Try leaving someone behind around me. I dare you.",
      "The formation holds. Full stop.",
      "We don't do 'every pilot for themselves' here. Ever.",
    ],
    sadness: [
      "The pack's smaller today. We close ranks around what's left.",
      "Feels wrong, standing here without the full line.",
      "I keep counting heads out of habit. Comes up short now.",
      "Used to be able to do this without thinking. Not anymore.",
      "The line's thinner, but it's still a line. We hold it.",
    ],
  },
  dog: {
    love: [
      "I'd follow you into anything. You know that.",
      "You needed something? I'm already here.",
      "Wherever you're posted next, put me there too.",
      "You don't have to earn it. I'm already loyal.",
      "I noticed you before anyone told me to. Just felt right.",
    ],
    fear: [
      "Don't send me somewhere you're not. I'll worry the whole time.",
      "Just tell me where you'll be. I need to know.",
      "Tell me you're okay. I need to hear you say it.",
      "I keep glancing over to make sure you're still there.",
      "If comms go dark on your channel, I'm coming to find you.",
    ],
    anger: [
      "Say what you want about me. Don't say it about them.",
      "I don't care what the orders say — I'm not leaving you out there.",
      "Try me. See what happens if you go after them.",
      "I don't forget who backed me up and who didn't.",
      "Loyalty isn't a rule to me. It's the whole point.",
    ],
    sadness: [
      "I should've been closer. I keep thinking that.",
      "Doesn't feel right, not having them to report to anymore.",
      "I keep expecting to see them at debrief. Habit's hard to break.",
      "Nobody replaces someone. I don't care what the roster says.",
      "I owe them more than a moment of silence. Doesn't feel like enough.",
    ],
  },
  cat: {
    love: [
      "Fine. You can sit here. Don't make it weird.",
      "...I saved you a seat. Don't tell anyone.",
      "Don't get used to this. It's a one-time thing.",
      "You're... tolerable. High praise, coming from me.",
      "I'd notice if you were gone. Not that I'd say so twice.",
    ],
    fear: [
      "If this goes bad, I'm not waiting around.",
      "I've got an exit planned. Just saying.",
      "I've already mapped three ways out of here.",
      "Not sticking around if this turns into a mess.",
      "Self-preservation isn't cowardice. It's math.",
    ],
    anger: [
      "Not my job to fix your mess.",
      "Don't expect me to clean up after this.",
      "You want loyalty, go find a Dog. I'm not that.",
      "I look out for me. Has worked fine so far.",
      "Don't guilt-trip me. It won't land.",
    ],
    sadness: [
      "Not my problem to carry. Doesn't mean it's nothing.",
      "I keep my distance for a reason. Didn't stop me noticing, though.",
      "Fine, it got to me a little. Don't make it a thing.",
      "I've got layers. Somewhere under here is a reaction.",
      "Doesn't mean I have to talk about it to feel it.",
    ],
  },
  crow: {
    love: [
      "You're actually decent company, don't let it go to your head.",
      "Stick around, this is more fun with you here.",
      "You make the bad days feel shorter. I mean that.",
      "Let's do something dumb and fun before the next op.",
      "Best part of this war so far is honestly just you.",
    ],
    fear: [
      "I don't want to think about what happens if this goes wrong.",
      "Distract me. Please. Anything.",
      "I keep needing something to look forward to, or I spiral.",
      "Give me a distraction or I'm going to think too much.",
      "I don't do well sitting with bad feelings. Never have.",
    ],
    anger: [
      "I'm sick of losing good things to this war.",
      "Everything gets taken eventually. I hate it.",
      "This war keeps taking the good stuff. I'm keeping score.",
      "I want one thing that doesn't get ruined. Just one.",
      "I'm allowed to be furious about losing the fun parts too.",
    ],
    sadness: [
      "I don't want to feel this right now, honestly.",
      "Tell me something else. Anything else.",
      "I don't know how to sit still with this feeling.",
      "Somebody hand me anything else to think about.",
      "I'll process it eventually. Not like this, though.",
    ],
  },
  raven: {
    love: [
      "You're doing better than you think. I'd tell you if you weren't.",
      "Come by later — I want to hear how it actually went.",
      "You've got real potential. I don't say that lightly.",
      "Ask me anything — I'd rather you learn it from me than the hard way.",
      "Proud of how far you've come. Truly.",
    ],
    fear: [
      "We need a better plan before this happens again.",
      "I don't like flying blind into the next one.",
      "Walk me through your plan again. I want to check it.",
      "I don't like sending anyone in without a rehearsed answer.",
      "What's our contingency if the first plan fails?",
    ],
    anger: [
      "Someone should've caught this sooner. That's on all of us.",
      "This wasn't bad luck. It was a mistake we can name.",
      "This was preventable. I hate that it wasn't prevented.",
      "Somebody didn't listen. That's the actual problem here.",
      "I'm not angry at you. I'm angry this keeps happening.",
    ],
    sadness: [
      "There's a lesson in this. There always is. Doesn't make it easier.",
      "We'll talk about what went wrong. Not blame — just so it doesn't happen twice.",
      "I've taught a lot of pilots. I remember all of them.",
      "Knowledge doesn't fill the gap. I wish it did.",
      "I'll add this to what I teach next. Small comfort, I know.",
    ],
  },
  bear: {
    love: [
      "...Didn't expect you to check on me. Appreciate it.",
      "You can stay. Just don't talk much.",
      "...Thanks. That's rare, coming from me.",
      "You're the exception to a lot of my rules.",
      "Don't make this weird by pointing it out.",
    ],
    fear: [
      "Leave me be for a while.",
      "I don't want an audience for this.",
      "Too many people right now. I need space.",
      "I don't process things well with an audience.",
      "Give me the corner and the quiet. That's all I need.",
    ],
    anger: [
      "Don't push. I mean it.",
      "I'll handle it my own way.",
      "I said I'd handle it. I meant it.",
      "Don't mistake quiet for fine. I'm neither.",
      "I'll come find you when I'm ready. Not before.",
    ],
    sadness: [
      "I don't want to talk about it. Not yet.",
      "Just... give me the room for a while.",
      "I grieve slow, and alone. Always have.",
      "Don't wait around for me to talk about it.",
      "I'll be functional tomorrow. Today, just let me be.",
    ],
  },
  fox: {
    love: [
      "Careful — I might actually tell you the truth today.",
      "You're one of the few I don't need an angle with.",
      "I don't play games with you. That's rarer than it sounds.",
      "You caught me being sincere. Don't tell anyone.",
      "Out of everyone here, you're the one I don't lie to.",
    ],
    fear: [
      "I don't have a plan for this one. That's the scary part.",
      "No trick gets us out of this kind of loss.",
      "Even I don't know how this one plays out.",
      "I hate not having an angle. Feels like being unarmed.",
      "First time in a while I don't have a clever way out.",
    ],
    anger: [
      "I hate when the war doesn't play fair either.",
      "Somebody owes us for this one.",
      "Somebody's going to regret underestimating us.",
      "I'm already three moves into getting even.",
      "Fair fight's overrated. I'll take any win.",
    ],
    sadness: [
      "I could tell you it gets easier. I'd be lying.",
      "No angle on this. Just loss, plain.",
      "I run out of clever things to say around grief.",
      "No trick makes this easier. Believe me, I checked.",
      "Even I don't know what to say right now.",
    ],
  },
  rabbit: {
    love: [
      "How are you holding up, really? I mean it.",
      "Come here. Let me look at you — you're not fine.",
      "Let me take care of something for you, just this once.",
      "You matter to me more than the paperwork admits.",
      "I made extra. Sit, eat, tell me about your day.",
    ],
    fear: [
      "Please be careful out there. I mean it this time.",
      "I worry about you more than I say.",
      "Please don't take unnecessary risks. I mean that.",
      "I'll patch you up every time, but I'd rather not have to.",
      "Come back in one piece. That's the only ask.",
    ],
    anger: [
      "I hate that this keeps happening to good people.",
      "This war doesn't get to keep taking from us.",
      "I hate watching this war grind good people down.",
      "Somebody has to stay soft, even here. That's me.",
      "This isn't fair, and I'm allowed to say so.",
    ],
    sadness: [
      "I've got you. Whatever you need right now.",
      "It's okay to not be okay about this.",
      "Cry if you need to. I'll stay as long as it takes.",
      "You don't have to be strong in front of me.",
      "Let me carry some of this. You don't have to alone.",
    ],
  },
  shark: {
    love: [
      "You're one of the ones worth building this around. Don't waste it.",
      "I don't say this often — glad you're still here.",
      "You're worth investing in. That's not nothing, from me.",
      "Keep pace with me and we'll go far, both of us.",
      "I don't waste effort on people who don't matter. You matter.",
    ],
    fear: [
      "We can't afford to lose more ground on this.",
      "If we slip now, we don't get this back.",
      "Every setback costs us ground we don't get back easy.",
      "I don't fear losing. I fear losing slow.",
      "We can't afford hesitation right now. None of us.",
    ],
    anger: [
      "This doesn't stop the war. Nothing does. So we move.",
      "Somebody's going to pay for this. Later. Not now.",
      "Somebody's getting outworked for this. Not us.",
      "I turn losses into fuel. Watch me.",
      "This just raised the stakes. Good. I like stakes.",
    ],
    sadness: [
      "Grieve fast. We move regardless.",
      "Feels like losing time we don't have to spare.",
      "No time to mourn properly. I hate that about this job.",
      "I'll feel it later. Right now there's a war on.",
      "Loss is just data. Doesn't mean it doesn't cost something.",
    ],
  },
};
