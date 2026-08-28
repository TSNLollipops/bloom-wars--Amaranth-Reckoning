// src/data/crewBanterSlots.ts
// Crew Banter §11 template-slot resolver — Social Sim Roadmap #17's
// "curated recall" path, built 27 Aug 2026 (a third unattended stretch the
// same day; Maxime: "go for it. im only a 3rd of the way into my day.").
// `Bloom_Wars_Ambient_Line_Content_Brief_v1.md`'s Phase C and
// `Bloom_Wars_Ambient_Line_Bank_Delivery_v1.md` both authored slotted
// line variants — a flat line already live in `LINE_BANK`, rewritten with
// one {SLOT} token, ready to fire the moment a real resolver exists.
// Nothing has resolved a single one of them until this file: grep-
// confirmed zero {SQUADMATE}/{MISSION}/etc. tokens anywhere in
// `ambientLines.ts`'s live `LINE_BANK` before this was built.
//
// src/data/** purity rule (Build Brief §5.2): this file may only import
// from ./types or other src/data files, never ../engine/* or ../scenes/*.
// Hub.ts assembles a real SlotContext from live roster/campaign-state data
// and calls resolveSlotText — same division of labor catalystProfile.ts
// and hotTopics.ts already established this session (pure pick/render
// logic here, real data gluing on the engine side).
//
// Count found while transcribing the delivery doc's nine per-catalyst
// tables by hand: 39 slotted variants, not the doc's own claimed "36" —
// worth recording plainly rather than quietly matching a number that
// doesn't match the doc's own content. Every entry below is copied
// verbatim from the doc; 39 is what's actually there.
//
// {LOADOUT} naming-lock judgment call — resolved by Maxime directly, same
// day. First shipped resolving to the plain "Tier X" format already shown
// in the live UI (ShopPanel.ts, TransporterPad.ts), deliberately avoiding
// Canon Pass §D's per-path gear names (Stocklance, Stormblade, and the
// rest) since those trace back to a book-side source document
// (Qiraki_Points_Shop_Catalog.md) and Bloom_Wars_Codex_Design_v1.md §9
// (item 4) had flagged pulling them into game-facing text as needing
// Maxime's own call. Asked directly, he said "use the named gear tiers" —
// so GEAR_TIER_NAMES below is that table, Canon Pass §D's own 4×7 grid,
// copied verbatim. Worth being precise about why this is fine even though
// the table's ultimate source is a Qiraki document: the project's own
// naming-lock policy (see the Master Index's "Cross-project references"
// section, 26 Aug 2026) already draws the real line — the ONE hard block
// is the specific reserved term plus "The Synker Wars," both untouched
// here; general Qiraki-sourced flavor (species, culture, and — per Canon
// Pass §D's own note that the game's four paths ARE the book's own path
// system, not a coincidence — gear-tier names) is explicitly the standing
// default for deliberate one-way borrowing, not an exception. This was
// still worth asking rather than assuming, since the Codex Design doc had
// specifically called this one instance out; now that Maxime's made the
// call himself, it's resolved, not still open.
import type { Catalyst, Echo, Stage } from "./ambientLines";
import type { Path, Tier } from "./types";

// Canon Pass §D's own 4×7 table, Qiraki_Points_Shop_Catalog.md's Meeps/
// Tank/Reeps/Munti tiers G through A, copied verbatim (Meeps column
// follows Trav's own blade-branch progression — the doc notes a
// lance-branch fork exists as an alternate flavor set, not used here).
// Display strings only, same as the doc's own framing — no new stats or
// slots, just what {LOADOUT} says instead of "Tier X".
const GEAR_TIER_NAMES: Record<Path, Record<Tier, string>> = {
  meeps: { G: "Stocklance", F: "Heavylance", E: "Twinlance", D: "Pairblade", C: "Arcblade", B: "Flareblade", A: "Stormblade" },
  tank: { G: "Blockshield", F: "Wallpanel", E: "Skinshield", D: "Groupshield", C: "Maserline", B: "Tachlance", A: "Bastion" },
  reeps: { G: "Popgun", F: "Burstrifle", E: "Twinburst", D: "Longeye", C: "Farmark", B: "Twinmark", A: "Skyline" },
  munti: { G: "Quickfix kit", F: "Longarm", E: "Farfix", D: "Lifebox", C: "Quickbox", B: "Widefix", A: "Overcharge" },
};

// RIVAL and LOST added 28 Aug 2026 — Recall Item 3 Decision + Spec v1's
// "expanded curated recall" (the replacement for the original, shelved
// generative-recall item — see that doc's own §1/§2 for why). STAGE_MOMENT,
// the spec's third proposed slot, was HELD BACK the same day (its own
// justification didn't hold up against the actual code — see this file's
// own note further down, right above SlotContext) and then added for real
// once Maxime closed the underlying gap directly: "highlight reel should
// date itself with calandar. down to the sec." — see
// engine/campaignEconomy.ts's purchaseTierUpgrade and
// engine/campaignState.ts's HubPilotSocialState.stagePromotedAt for the
// real timestamp this now reads.
export type SlotType = "SQUADMATE" | "CLASS" | "LOADOUT" | "ENEMY" | "MISSION" | "ROOM" | "SHIP" | "RIVAL" | "LOST" | "STAGE_MOMENT";

export interface SlottedLine {
  catalyst: Catalyst;
  echo: Echo;
  stage: Stage;
  flat: string; // already live in LINE_BANK — shown as-is whenever resolution isn't possible
  slotted: string; // the templated sibling; contains one token matching slotType, plus a second matching slotType2 if that's set
  slotType: SlotType;
  // Two-fact lines, 28 Aug 2026 (Recall Item 3 spec §3: "a line that names
  // both a squadmate AND a mission in the same breath reads as noticeably
  // more specific than either alone"). Optional and additive — every one of
  // the 39 existing entries below leaves this undefined and resolves
  // exactly as it did before this field existed. When set, resolveSlotText
  // requires BOTH tokens to have real data before returning anything —
  // same all-or-nothing "never a raw {TOKEN} on screen" contract a
  // single-slot miss already has, just checked twice instead of once.
  slotType2?: SlotType;
}

// SQUADMATE and MISSION carry real per-pilot/per-campaign memory — Roadmap
// #17's actual "curated recall" ask. Both can fail to resolve (a lone NPC
// with nobody else around; no mission completed yet this session) and the
// caller falls back to the flat line when that happens — same "graceful
// miss" shape every other optional-data feature this project has built.
// CLASS and LOADOUT resolve off the SPEAKING pilot's own real data too
// (recall about themselves, always available once their record exists) —
// both derived from the same raw (path, tier) pair Hub.ts already has on
// hand, rather than two separately pre-formatted strings, so
// GEAR_TIER_NAMES stays the one place that knows how to turn a path/tier
// into display text. ENEMY, SHIP, and ROOM are categorical flavor picks —
// always resolvable, no real per-pilot history behind them yet (honest
// gap, see the roadmap doc's #17 entry: a genuine "last enemy actually
// fought this mission" version would need new persisted state this pass
// didn't add).
//
// RIVAL and LOST, added 28 Aug 2026 (Recall Item 3 spec §3), both real,
// both checked against actual code before building rather than assumed
// from the spec's own one-line description:
//   - RIVAL mirrors Hub.ts's own npcRivalLabel exactly — findWorstRival
//     (data/npcBonds.ts) plus the same RIVAL_THRESHOLD gate that function
//     already uses. Deliberately NOT a "closest of the others" fallback the
//     way SQUADMATE has one: SQUADMATE names *somebody* real because any
//     squadmate is a valid thing to recall, but a friendly or neutral bond
//     isn't a rivalry, so a line built to say "my rival" only fires once a
//     real one (bond <= RIVAL_THRESHOLD) exists — same standard the Hub's
//     own UI already holds itself to for this exact fact.
//   - LOST is a fallen MUNTI's name specifically, not any permanent loss —
//     matches the spec's own wording and Hub.ts's existing checkMuntiLoss()
//     semantics (a lost Munti is the one loss type with a dedicated
//     one-shot announcement already, since Munti presence is what keeps
//     everyone else's permadeath check from firing at all). Reads directly
//     off CampaignState.pilots filtered to status "permanently_lost" +
//     path "munti" — real, persisted, no new state needed.
//
// STAGE_MOMENT, added 28 Aug 2026, resolved after being held back earlier
// the same day. The spec's original justification ("their own promotion
// history, off the Highlights reel's dated milestones") didn't hold up
// against the actual code at the time — data/highlights.ts's own header
// had already checked this exact question during Roadmap #11's build and
// recorded the honest answer: no timestamp existed anywhere for when a
// Stage transition actually happened. Rather than fake one or quietly
// redefine the slot, that gap got flagged in the delivery note instead —
// Maxime's direct answer closed it for real: "highlight reel should date
// itself with calandar. down to the sec." engine/campaignEconomy.ts's
// purchaseTierUpgrade now stamps the REAL moment (epoch ms) a purchase
// crosses a Stage boundary, so this slot fills off genuine recorded
// history, not a current-status guess. stageMomentText carries the
// already-resolved display name of the pilot's most recently RECORDED
// promotion (Hub.ts's buildSlotContext picks "Command" over "Blooded" when
// both exist) — a short noun-phrase token, same shape as {CLASS}/
// {LOADOUT}, meant for a template like "since I made {STAGE_MOMENT}", not
// a full date embedded in spoken dialogue (the calendar precision lives in
// the Highlights reel's own display, not in what an NPC says out loud).
export interface SlotContext {
  squadmateName?: string;
  missionName?: string;
  speakerPath?: Path;
  speakerTier?: Tier;
  rivalName?: string;
  lostMuntiName?: string;
  stageMomentText?: string;
}

const CLASS_DISPLAY_NAMES: Record<Path, string> = { meeps: "Meeps", tank: "Tank", reeps: "Reeps", munti: "Munti" };

const ENEMY_NAMES = ["Crawlmass", "Splitfang", "Undertow", "Sporethrower", "Gallcyst", "Sirenmaw", "The Heartwood"];
const SHIP_NAMES = ["Providence", "the Antfarm"];
const ROOM_NAMES = ["Hangar Deck", "the Workshop", "the Vault", "Berths", "CIC"];

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

// Hand-transcribed from Bloom_Wars_Ambient_Line_Bank_Delivery_v1.md's own
// per-catalyst tables (§3–11), one entry per row whose "Slot variant"
// column isn't "—". Text copied verbatim, including the Munti Respect
// bank's own three slotted rows (Dog anger/blooded, Rabbit love/blooded,
// Shark love/command) — those already live in LINE_BANK's flat form too.
// Every `flat` string below was verified word-for-word against the live
// LINE_BANK bucket it claims to belong to (a small script run once while
// writing the unit tests, not a standing check) — caught and fixed one
// real drift in the process: Rabbit/love/blooded's own "I'm not the
// Munti..." line had picked up an extra "there" and swapped quote style
// somewhere between the delivery doc and the fold-in. Doesn't affect
// runtime behavior (`flat` is a reference field only — pickSlottedVariant/
// resolveSlotText never read it, and Hub.ts's own fallback uses whatever
// pickAmbientLineWithBleed already drew, not this field), but worth fixing
// for the same reason every other doc-drift catch this session got fixed
// rather than left alone.
//
// Also worth recording plainly: of the 39 entries, zero use CLASS and zero
// use ROOM, even though both are real slotType values crewBanterSlots.ts
// supports end to end (resolveSlotText's own switch, Hub.ts's own
// buildSlotContext already derives speakerClassName). The delivery doc's
// own "Slot variant" pass just never happened to land on either — SQUADMATE
// (17), MISSION (15), ENEMY (5), SHIP (1), and LOADOUT (1) account for all
// 39. Nothing broken, nothing to fix — CLASS/ROOM support is just inert
// until a future content pass writes lines that use them (the doc's own
// §11 flags "roughly a third of the bank" as further headroom past this
// first 39).
export const SLOTTED_LINES: SlottedLine[] = [
  // WOLF — 5
  { catalyst: "wolf", echo: "love", stage: "blooded", slotType: "SQUADMATE",
    flat: "Ask me who's got point today and I already know, without checking the board.",
    slotted: "Ask me where {SQUADMATE}'s standing right now. I know without checking the board." },
  { catalyst: "wolf", echo: "love", stage: "blooded", slotType: "SQUADMATE",
    flat: "You covered a lane you didn't have to. I noticed. I always notice now.",
    slotted: "You covered for {SQUADMATE} out there when you didn't have to. I noticed. I always notice now." },
  { catalyst: "wolf", echo: "love", stage: "command", slotType: "MISSION",
    flat: "Every one of you walked back. I don't say that lightly and I don't say it every time — today I'm saying it.",
    slotted: "Every one of you walked back from {MISSION}. I don't say that lightly and I don't say it every time — today I'm saying it." },
  { catalyst: "wolf", echo: "fear", stage: "green", slotType: "MISSION",
    flat: "We didn't lose anyone. I keep saying that like it's not the whole point.",
    slotted: "We didn't lose anyone on {MISSION}. I keep saying that like it's not the whole point." },
  { catalyst: "wolf", echo: "fear", stage: "blooded", slotType: "SQUADMATE",
    flat: "Talk to me like I'm one of the team having a bad day, not like I'm about to break.",
    slotted: "Talk to me like I'm one of the team having a bad day, not like I'm about to break — same as you would for {SQUADMATE}." },

  // DOG — 7
  { catalyst: "dog", echo: "love", stage: "green", slotType: "SQUADMATE",
    flat: "I already know I'd take a hit for half this lance and we've known each other a week.",
    slotted: "I already know I'd take a hit for {SQUADMATE} and we've known each other a week." },
  { catalyst: "dog", echo: "love", stage: "green", slotType: "MISSION",
    flat: "You didn't have to circle back for me. You did anyway. I'm not going to forget that.",
    slotted: "You didn't have to circle back for me on {MISSION}. You did anyway. I'm not going to forget that." },
  { catalyst: "dog", echo: "love", stage: "blooded", slotType: "SQUADMATE",
    flat: "You'd have done the same for me. I know because I've watched you do it for someone else.",
    slotted: "You'd have done the same for me. I know because I've watched you do it for {SQUADMATE}." },
  { catalyst: "dog", echo: "love", stage: "blooded", slotType: "MISSION",
    flat: "That's the third time we've walked off the same field together. I keep a count now. Didn't used to.",
    slotted: "We walked off {MISSION} together. I keep a count of those now. Didn't used to." },
  { catalyst: "dog", echo: "love", stage: "command", slotType: "SQUADMATE",
    flat: "Sit. Drink. I'll tell you which one of you I'm proudest of tonight, and it changes every week.",
    slotted: "Sit. Drink. Tonight the one I'm proudest of is {SQUADMATE}, and next week it'll change." },
  { catalyst: "dog", echo: "fear", stage: "blooded", slotType: "SQUADMATE",
    flat: "I don't panic when someone I care about gets hurt anymore. I get quiet and I fix it. Learned that the hard way.",
    slotted: "I don't panic when {SQUADMATE} gets hurt anymore. I get quiet and I fix it. Learned that the hard way." },
  { catalyst: "dog", echo: "anger", stage: "blooded", slotType: "SQUADMATE",
    flat: "Somebody flanked him today. I was already moving before I decided to. Touch our Munti again and find out what happens to the rest of your afternoon.",
    slotted: "Touch {SQUADMATE} again and find out what happens to the rest of your afternoon." },

  // CAT — 4
  { catalyst: "cat", echo: "love", stage: "green", slotType: "SQUADMATE",
    flat: "I covered you because a dead squad is a squad that can't cover me next time. Purely practical.",
    slotted: "I covered {SQUADMATE} because a dead squad is a squad that can't cover me next time. Purely practical." },
  { catalyst: "cat", echo: "love", stage: "blooded", slotType: "MISSION",
    flat: "I got everyone out intact this time. Even me being smug about it is a group activity, apparently.",
    slotted: "I got everyone out of {MISSION} intact. Even me being smug about it is a group activity, apparently." },
  { catalyst: "cat", echo: "love", stage: "command", slotType: "MISSION",
    flat: "Everyone's accounted for. I'd call that a good return on investment, if I still believed that's what this is.",
    slotted: "Everyone's accounted for after {MISSION}. I'd call that a good return on investment, if I still believed that's what this is." },
  { catalyst: "cat", echo: "anger", stage: "green", slotType: "SQUADMATE",
    flat: "What's in it for me if I cover your flank? I'm asking for real.",
    slotted: "What's in it for me if I cover {SQUADMATE}'s flank? I'm asking for real." },

  // CROW — 5
  { catalyst: "crow", echo: "love", stage: "green", slotType: "SHIP",
    flat: "Give me five minutes and a bored afternoon and I will find you a conspiracy theory about literally anything on this ship.",
    slotted: "Give me five minutes and a bored afternoon and I will find you a conspiracy theory about anything on {SHIP}." },
  { catalyst: "crow", echo: "love", stage: "green", slotType: "ENEMY",
    flat: "That fight is going straight into my theory. Everything goes into the theory eventually.",
    slotted: "{ENEMY} is going straight into my theory. Everything goes into the theory eventually." },
  { catalyst: "crow", echo: "love", stage: "blooded", slotType: "SQUADMATE",
    flat: "My theories used to be about the Bloom. Half of them are about keeping this squad alive now. Priorities shifted.",
    slotted: "My theories used to be about the Bloom. The current one is about keeping {SQUADMATE} alive. Priorities shifted." },
  { catalyst: "crow", echo: "love", stage: "blooded", slotType: "SQUADMATE",
    flat: "That detail I obsessed over last month just saved someone's life today. I'm allowed to be smug about that one.",
    slotted: "That detail I obsessed over last month just saved {SQUADMATE}'s life today. I'm allowed to be smug about that one." },
  { catalyst: "crow", echo: "love", stage: "command", slotType: "ENEMY",
    flat: "I called that pack shift four minutes before it happened. Nobody's surprised anymore. I still am, a little.",
    slotted: "I called the {ENEMY} shift four minutes before it happened. Nobody's surprised anymore. I still am, a little." },

  // RAVEN — 4
  { catalyst: "raven", echo: "love", stage: "green", slotType: "LOADOUT",
    flat: "Actually, you'll want to angle your approach two degrees wider than that — I read it in a manual, don't look at me like that.",
    slotted: "You'll want a wider angle running {LOADOUT} — I read it in a manual, don't look at me like that." },
  { catalyst: "raven", echo: "love", stage: "blooded", slotType: "MISSION",
    flat: "Good instinct out there. You didn't need my help on that one and I noticed.",
    slotted: "Good instinct out there on {MISSION}. You didn't need my help and I noticed." },
  { catalyst: "raven", echo: "love", stage: "command", slotType: "ENEMY",
    flat: "Every hard lesson I've got, I'll hand over free. No charge, no ego attached anymore.",
    slotted: "Every hard lesson I've got about {ENEMY}, I'll hand over free. No charge, no ego attached." },
  { catalyst: "raven", echo: "love", stage: "command", slotType: "MISSION",
    flat: "You made that call yourself out there. I didn't have to say a word. That's the whole point of teaching, and I finally believe it.",
    slotted: "You made that call on {MISSION} yourself. I didn't have to say a word. That's the whole point of teaching." },

  // BEAR — 3
  { catalyst: "bear", echo: "love", stage: "green", slotType: "MISSION",
    flat: "I noticed before anyone called it. Didn't say anything. Would've if it went the other way.",
    slotted: "I noticed before anyone called it on {MISSION}. Didn't say anything. Would've if it went the other way." },
  { catalyst: "bear", echo: "love", stage: "blooded", slotType: "MISSION",
    flat: "I caught the angle nobody else had eyes on. Again. Somebody has to be the one watching the edges.",
    slotted: "I caught the angle nobody else had eyes on during {MISSION}. Again. Somebody has to watch the edges." },
  { catalyst: "bear", echo: "love", stage: "command", slotType: "MISSION",
    flat: "I don't say this often — I was glad every one of you made it back. Write that down, it won't happen twice this month.",
    slotted: "I don't say this often — I was glad every one of you walked out of {MISSION}. Write that down." },

  // FOX — 3
  { catalyst: "fox", echo: "love", stage: "green", slotType: "ENEMY",
    flat: "I baited them left, everyone else hit right. Worked better than I expected, honestly.",
    slotted: "I baited {ENEMY} left, everyone else hit right. Worked better than I expected, honestly." },
  { catalyst: "fox", echo: "love", stage: "blooded", slotType: "ENEMY",
    flat: "I baited the whole pack into a kill box. Command's going to ask how I knew that would work. I'm not telling them it was a guess.",
    slotted: "I baited {ENEMY} into a kill box. Command's going to ask how I knew that would work. I'm not telling them it was a guess." },
  { catalyst: "fox", echo: "love", stage: "command", slotType: "MISSION",
    flat: "I got everyone home using a play nobody else would have tried. I don't need credit for it. I'll take it anyway, quietly.",
    slotted: "I got everyone home from {MISSION} using a play nobody else would have tried. No credit needed. I'll take it anyway, quietly." },

  // RABBIT — 4
  { catalyst: "rabbit", echo: "love", stage: "blooded", slotType: "SQUADMATE",
    flat: "I got to you in time because I trusted the read instead of freezing on it. That's new. That's good.",
    slotted: "I got to {SQUADMATE} in time because I trusted the read instead of freezing on it. That's new. That's good." },
  { catalyst: "rabbit", echo: "love", stage: "command", slotType: "MISSION",
    flat: "Nobody's down. That's not luck at this point. That's a decade of learning exactly where to be standing.",
    slotted: "Nobody's down after {MISSION}. That's not luck. That's a decade of learning exactly where to be standing." },
  { catalyst: "rabbit", echo: "fear", stage: "green", slotType: "SQUADMATE",
    flat: "I keep replaying whether I could've reached you faster. You're fine. I know you're fine. I still replay it.",
    slotted: "I keep replaying whether I could've reached {SQUADMATE} faster. They're fine. I know they're fine. I still replay it." },
  { catalyst: "rabbit", echo: "love", stage: "blooded", slotType: "SQUADMATE",
    flat: "I'm not the Munti. I get the job anyway, more than most — the one where the only stat anyone remembers is 'was I there.' I make sure somebody remembers he was.",
    slotted: "I'm not the Munti. I get the job anyway, more than most — the one where the only stat anyone remembers is 'was I there.' I make sure somebody remembers {SQUADMATE} was." },

  // SHARK — 4
  { catalyst: "shark", echo: "love", stage: "green", slotType: "MISSION",
    flat: "I got the most kills today. I know that's not the point. I'm still going to mention it.",
    slotted: "I got the most kills on {MISSION}. I know that's not the point. I'm still going to mention it." },
  { catalyst: "shark", echo: "love", stage: "blooded", slotType: "MISSION",
    flat: "Everyone's numbers looked good today, mine included. I've started meaning that plural on purpose.",
    slotted: "Everyone's numbers looked good on {MISSION}, mine included. I've started meaning that plural on purpose." },
  { catalyst: "shark", echo: "love", stage: "command", slotType: "SQUADMATE",
    flat: "Every one of you is sharper than when you started under me. That's the only score I actually track these days.",
    slotted: "Every one of you is sharper than when you started under me. {SQUADMATE} especially, this month. That's the only score I track." },
  { catalyst: "shark", echo: "love", stage: "command", slotType: "SQUADMATE",
    flat: "Used to think the kill count was the whole score. Changed my mind the day I watched our Munti's save log hit double digits and did the actual math on how many of my own kills only happened because he kept me standing long enough to get them.",
    slotted: "Used to think the kill count was the whole score. Changed my mind the day I watched {SQUADMATE}'s save log hit double digits and did the math on how many of my own kills only happened because they kept me standing that long." },
];

// Random eligible slotted variant for this exact (catalyst, echo, stage)
// bucket, or undefined if none exists — most buckets have none, since only
// 39 of LINE_BANK's 720 lines have a slotted sibling at all.
export function pickSlottedVariant(catalyst: Catalyst, echo: Echo, stage: Stage): SlottedLine | undefined {
  const candidates = SLOTTED_LINES.filter((s) => s.catalyst === catalyst && s.echo === echo && s.stage === stage);
  if (candidates.length === 0) return undefined;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// Fills exactly one {SLOT} token of the given type in `text`. Pulled out of
// resolveSlotText below, 28 Aug 2026, so a two-fact line (slotType2 set)
// can call this twice — once per token — without duplicating the per-type
// logic. Returns undefined when the needed data isn't available (no
// squadmate around, no completed mission yet this session, no real rival,
// no fallen Munti on record); the caller's job is to fall back to
// `line.flat` in that case, never to show a raw {TOKEN}.
function resolveOneSlot(slotType: SlotType, text: string, context: SlotContext): string | undefined {
  switch (slotType) {
    case "SQUADMATE":
      return context.squadmateName ? text.replace("{SQUADMATE}", context.squadmateName) : undefined;
    case "MISSION":
      return context.missionName ? text.replace("{MISSION}", context.missionName) : undefined;
    case "CLASS":
      return context.speakerPath ? text.replace("{CLASS}", CLASS_DISPLAY_NAMES[context.speakerPath]) : undefined;
    case "LOADOUT":
      return context.speakerPath && context.speakerTier
        ? text.replace("{LOADOUT}", GEAR_TIER_NAMES[context.speakerPath][context.speakerTier])
        : undefined;
    case "ENEMY":
      return text.replace("{ENEMY}", pickRandom(ENEMY_NAMES));
    case "SHIP":
      return text.replace("{SHIP}", pickRandom(SHIP_NAMES));
    case "ROOM":
      return text.replace("{ROOM}", pickRandom(ROOM_NAMES));
    case "RIVAL":
      return context.rivalName ? text.replace("{RIVAL}", context.rivalName) : undefined;
    case "LOST":
      return context.lostMuntiName ? text.replace("{LOST}", context.lostMuntiName) : undefined;
    case "STAGE_MOMENT":
      return context.stageMomentText ? text.replace("{STAGE_MOMENT}", context.stageMomentText) : undefined;
  }
}

// Fills every token in `line.slotted` using real context data — one token
// for an ordinary single-slot line, two for a two-fact line (slotType2
// set). All-or-nothing: if either token's data is missing, the whole call
// returns undefined and the caller falls back to `line.flat`, same as a
// single-slot miss always has — a two-fact line never partially resolves
// with one real fact and one leftover {TOKEN}.
export function resolveSlotText(line: SlottedLine, context: SlotContext): string | undefined {
  const first = resolveOneSlot(line.slotType, line.slotted, context);
  if (first === undefined) return undefined;
  if (!line.slotType2) return first;
  return resolveOneSlot(line.slotType2, first, context);
}
