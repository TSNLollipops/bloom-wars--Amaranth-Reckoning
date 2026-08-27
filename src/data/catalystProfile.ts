// src/data/catalystProfile.ts
// Hub polish, 26 Aug 2026 — Maxime's own framing, two messages: "can we feed
// a chat box a dictionary with descriptions and have it work word based on
// its animal path? clearly im fishing for idea for less of a gate," then
// "add 2-3 sub animal randomly chosen per pilot for the dictionary or with
// a different weight. attached to it based on instinc, thought, action" —
// confirmed "yeah an animal for instinc thought actions. dude. go ham. but
// yeah we doing it."
//
// What this is: every pilot's primary catalyst (npcSeed.ts, unchanged) gets
// three SUB-animals sitting underneath it — one each for instinct, thought,
// action — deterministically assigned from pilotId (see assignSubAnimals).
// No new persisted state: same reasoning as Hub.ts's isMissionWorrySignal,
// recomputed on demand rather than round-tripped through CampaignState.
// CATALYST_DICTIONARY is a hand-curated word list per catalyst, read off
// the actual tone/content of that catalyst's real LINE_BANK entries
// (ambientLines.ts) plus the trait identity pilot_creator.html already
// established for each animal (wolf=teamwork, dog=loyalty, cat=selfishness,
// crow=indulgence, raven=instruction, bear=isolation, fox=trickery,
// rabbit=nurturing, shark=ambition) — not scraped/auto-extracted, since a
// naive word-frequency pull surfaces glue words ("the," "I," "don't"), not
// personality.
//
// Where this plugs in: Hub.ts's speak() (E key/click) is the one call site
// Gate 0/reactionGate.ts governs, and it's deliberately contentless — no
// player text reaches it at all (see its own header). The only place raw
// typed chat text exists is submitChat()'s own fallthrough: today, ANY
// text that doesn't match a real verb/history request/muster/one of the
// four EMOTION_KEYWORDS buckets gets exactly one shared, catalyst-neutral
// shrug line (CHAT_FALLBACK_LINES), identical for every nearby NPC no
// matter what was actually typed. That blanket shrug is the real "gate" —
// this file is what Hub.ts's showCatalystOrFallback() checks before giving
// up and falling back to it.
//
// Primary vs. sub-animal isn't a flat merge — a word landing in a pilot's
// own primary-catalyst dictionary always gets an answer (no roll: it's who
// they fundamentally are). A sub-animal match additionally needs its own
// weighted roll to actually take the wheel, checked instinct -> thought ->
// action (fastest-to-surface to slowest, per Maxime's own ordering) —
// these are secondary influences, not the pilot's core identity, so they
// don't get to answer every single time the way primary does. Weights are
// a real, hand-tuned placeholder, same "not a locked number" caveat as
// every other constant in this pass (reactionGate.ts's own header).
import { LINE_BANK, pickSoloEcho, type AmbientPilotState, type Catalyst, type Stage, type EchoPick } from "./ambientLines";

export type SubAnimalRole = "instinct" | "thought" | "action";
export type SubAnimals = Record<SubAnimalRole, Catalyst>;

const ALL_CATALYSTS: Catalyst[] = ["wolf", "dog", "cat", "crow", "raven", "bear", "fox", "rabbit", "shark"];

// Fixed, not arbitrary — instinct is checked before thought is checked
// before action, matching "instinct reacts fastest, action is the loosest
// association" (see the weight constants below). Also doubles as the pick
// order in assignSubAnimals, so each role draws from a shrinking pool in a
// stable sequence rather than depending on object key iteration order.
const ROLE_ORDER: SubAnimalRole[] = ["instinct", "thought", "action"];

// Sub-animal weights — how often a word landing in THAT role's dictionary
// actually lets it answer, once a hit is already found. Instinct is the
// most trusted secondary voice, action the least; primary catalyst isn't
// listed here at all because it isn't weighted — see the file header.
// These three are now specifically the BLOODED (career-midpoint) baseline
// — see SUBANIMAL_WEIGHTS_BY_STAGE just below for the per-stage table they
// anchor, added 27 Aug 2026 (later pass, roadmap #3). Kept as their own
// exported constants rather than inlined into the table, since the
// existing statistical tests in catalystProfile.test.ts already pin
// against them by name.
export const SUBANIMAL_INSTINCT_WEIGHT = 0.5;
export const SUBANIMAL_THOUGHT_WEIGHT = 0.3;
export const SUBANIMAL_ACTION_WEIGHT = 0.15;

// Stage-weighted sub-animal confidence, 27 Aug 2026 (later pass) —
// Social Sim Roadmap #3: "let a pilot's Stage nudge... rather than using
// the same flat constant for a Green rookie and a Command veteran... a
// veteran trusts their gut more; a rookie's 'thought' voice (the
// deliberate, overthinking one) dominates more often." Built FROM the
// three flat constants above rather than duplicating their blooded values
// as fresh literals, so the two can't silently drift apart — blooded IS
// the untouched baseline, unchanged in effect from before this pass (every
// existing test that doesn't override stage away from the "blooded"
// default still exercises the exact same numbers as before).
//
// Action's weight is deliberately flat across all three stages: it's the
// loosest, most impulsive association (this file's own header), and
// nothing about rank experience should reasonably damp impulsiveness the
// way it plausibly sharpens instinct or quiets overthinking — only
// instinct and thought trade off with Stage, action holds steady.
export const SUBANIMAL_WEIGHTS_BY_STAGE: Record<Stage, { instinct: number; thought: number; action: number }> = {
  green: { instinct: 0.35, thought: 0.45, action: SUBANIMAL_ACTION_WEIGHT },
  blooded: { instinct: SUBANIMAL_INSTINCT_WEIGHT, thought: SUBANIMAL_THOUGHT_WEIGHT, action: SUBANIMAL_ACTION_WEIGHT },
  command: { instinct: 0.65, thought: 0.2, action: SUBANIMAL_ACTION_WEIGHT },
};

// Same small string hash used nowhere else in this project yet, but same
// spirit as pilot_creator.html's hueFromString — deterministic, stable
// across runs, no dependency on Math.random() or any persisted field.
// Math.imul keeps the multiply in 32-bit range without the multi-step
// overflow dance a plain `h * 31` needs once h gets large.
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

// Deterministic per pilot — same pilotId always yields the same three
// sub-animals, no persisted state required (recomputed on demand, same
// reasoning as Hub.ts's isMissionWorrySignal). Each role draws from the
// catalysts not yet claimed by primary or an earlier role in ROLE_ORDER,
// so the three sub-animals are always distinct from each other and from
// the pilot's own primary catalyst.
export function assignSubAnimals(pilotId: string, primary: Catalyst): SubAnimals {
  const chosen: Catalyst[] = [];
  const result = {} as SubAnimals;
  for (const role of ROLE_ORDER) {
    const pool = ALL_CATALYSTS.filter((c) => c !== primary && !chosen.includes(c));
    const pick = pool[hashString(`${pilotId}:${role}`) % pool.length];
    chosen.push(pick);
    result[role] = pick;
  }
  return result;
}

// Hand-curated, not exhaustive by design — same "grows from playtesting,
// not from guessing every synonym up front" philosophy chatIntent.ts's own
// EMOTION_KEYWORDS already uses. A few words repeat across catalysts on
// purpose (e.g. "alone" for both cat and bear) — they mean different
// things to each (self-preservation vs. solitude) in their own LINE_BANK
// content, same as chatIntent.ts's emotion buckets already overlapping in
// places. Multi-word phrases are fine — see hasWordHit below, same
// word-boundary matching as chatIntent.ts's countHits, so "close ranks"
// matches as a whole phrase, not two independent single-word checks.
export const CATALYST_DICTIONARY: Record<Catalyst, string[]> = {
  wolf: ["pack", "squad", "formation", "together", "team", "unity", "backup", "headcount", "scatter", "close ranks"],
  dog: ["loyal", "loyalty", "follow", "faithful", "devoted", "trust", "promise", "worry about you", "wherever you go"],
  cat: ["alone", "myself", "independent", "exit plan", "self-preservation", "solo", "distance", "not my problem"],
  crow: ["fun", "distract", "party", "forget", "thrill", "chaos", "dumb fun", "spiral", "anything else"],
  raven: ["teach", "learn", "lesson", "plan", "mentor", "wisdom", "mistake", "strategy", "contingency"],
  bear: ["alone", "quiet", "space", "solitude", "silence", "corner", "leave me", "handle it myself"],
  fox: ["trick", "clever", "angle", "scheme", "cunning", "sly", "outsmart", "no plan"],
  rabbit: ["care", "comfort", "gentle", "heal", "safe", "soft", "worry", "patch up", "take care of you"],
  shark: ["ambition", "drive", "win", "push", "relentless", "stakes", "ground", "fuel", "outwork"],
};

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Same word-boundary reasoning as chatIntent.ts's countHits (found the hard
// way there: "mad" inside "made," "cry" inside "cryptic," "mission" inside
// "submission") — this file's own words have the same risk ("win" inside
// "winter," "care" inside "careful" reads fine here actually, but the
// principle holds), so word-boundary matching stays the default rather
// than a plain substring search.
function hasWordHit(text: string, words: string[]): boolean {
  for (const w of words) {
    const pattern = new RegExp(`\\b${escapeRegExp(w)}\\b`);
    if (pattern.test(text)) return true;
  }
  return false;
}

export type CatalystReactionSource = "primary" | "instinct" | "thought" | "action";

export type CatalystReactionPick = {
  line: string;
  source: CatalystReactionSource;
  catalyst: Catalyst; // which catalyst's LINE_BANK the line actually came from — not always pilot.catalyst
};

// Emotional flavor (the echo — love/fear/anger/sadness) still comes from
// the pilot's own current state via pickSoloEcho, same as every other
// ambient line in the game. Only WHICH catalyst's wording answers shifts
// here — a sub-animal taking the wheel changes voice, not the underlying
// feeling.
function buildReaction(pilot: AmbientPilotState, source: CatalystReactionSource, catalyst: Catalyst): CatalystReactionPick {
  const { echo } = pickSoloEcho(pilot);
  // pilot.stage, not a stage tied to `catalyst` — Stage is the pilot's own
  // career progression, not an identity of whichever catalyst is answering
  // (primary or sub-animal). Wired 27 Aug 2026 alongside the rest of the
  // Stage gating (ambientLines.ts's own header for the full design).
  const bank = LINE_BANK[catalyst][echo][pilot.stage];
  const line = bank[Math.floor(Math.random() * bank.length)];
  return { line, source, catalyst };
}

// The one real entry point. Returns null if nothing in this pilot's
// dictionary (primary or any sub-animal) matched the typed text, or if a
// sub-animal matched but lost its own weighted roll — either way, the
// caller's existing generic-shrug fallback still applies, unchanged.
export function pickCatalystReaction(pilot: AmbientPilotState, pilotId: string, raw: string): CatalystReactionPick | null {
  const text = raw.trim().toLowerCase();
  if (!text) return null;

  if (hasWordHit(text, CATALYST_DICTIONARY[pilot.catalyst])) {
    return buildReaction(pilot, "primary", pilot.catalyst);
  }

  const subAnimals = assignSubAnimals(pilotId, pilot.catalyst);
  // Stage-weighted as of 27 Aug 2026 (later pass) — see
  // SUBANIMAL_WEIGHTS_BY_STAGE's own header for the design. pilot.stage,
  // same reasoning as buildReaction's own LINE_BANK lookup just above:
  // Stage is the pilot's own career progression, independent of which
  // catalyst (primary or sub-animal) is doing the answering.
  const weights = SUBANIMAL_WEIGHTS_BY_STAGE[pilot.stage];
  const tiers: { role: SubAnimalRole; weight: number }[] = [
    { role: "instinct", weight: weights.instinct },
    { role: "thought", weight: weights.thought },
    { role: "action", weight: weights.action },
  ];
  for (const tier of tiers) {
    const catalyst = subAnimals[tier.role];
    if (!hasWordHit(text, CATALYST_DICTIONARY[catalyst])) continue;
    if (Math.random() >= tier.weight) continue;
    return buildReaction(pilot, tier.role, catalyst);
  }

  return null;
}

// Ambient bleed into ordinary idle/verb-outcome lines, 27 Aug 2026 (Social
// Sim Roadmap #2 — "sub-animal ambient bleed"). §32 above only ever let a
// sub-animal answer a piece of TYPED chat (pickCatalystReaction, requiring
// an actual dictionary hit in the player's own words); this is the
// separate, explicitly-deferred half of that idea — a pilot's ordinary
// idle/Gate-0 line and every verb-outcome line (shareADrink, pegBoard,
// poker, darts) occasionally drawing from a sub-animal's own LINE_BANK
// voice instead of the primary catalyst's, with no typed text or dictionary
// hit involved at all. pilot_creator.html's own sandbox already has
// precedent for exactly this: "a ~30% chance an idle line draws from a
// secondary catalyst instead of the primary" (roadmap doc's own wording) —
// AMBIENT_BLEED_CHANCE below is that same number, not a fresh guess.
//
// Lives here rather than in ambientLines.ts's own pickAmbientLine, on
// purpose: this file already imports FROM ambientLines.ts (LINE_BANK,
// pickSoloEcho, the shared types) for pickCatalystReaction above — having
// ambientLines.ts import assignSubAnimals back from here would be a
// circular dependency, and the src/data/** purity rule (Build Brief §5.2)
// only allows data-file-to-data-file imports one direction at a time in
// practice, so this stays the higher-level file that composes the two
// lower-level ones instead of merging them.
//
// Which sub-animal bleeds through, GIVEN that the 30% roll already
// succeeded, is picked via SUBANIMAL_WEIGHTS_BY_STAGE — the same per-stage
// instinct/thought/action weighting pickCatalystReaction's own dictionary
// cascade already uses, renormalized into a single three-way draw instead
// of three independent trial gates (those three weights don't sum to
// exactly 1 — see that table's own header for why — so they can't be used
// as-is as a probability distribution over "which one wins"; a second
// sequential gate here would instead shrink the top-level 30% by whatever
// fraction of rolls fail all three trials, which isn't what "a ~30% chance
// an idle line draws from a secondary catalyst" asked for). Reusing this
// table rather than inventing a fresh flat 1-in-3 split keeps "instinct is
// the loudest secondary voice, action the quietest" consistent across both
// bleed contexts (typed-chat dictionary matching and this one), same
// identity, two different places it can surface.
export const AMBIENT_BLEED_CHANCE = 0.3;

function pickBleedRole(stage: Stage): SubAnimalRole {
  const w = SUBANIMAL_WEIGHTS_BY_STAGE[stage];
  const total = w.instinct + w.thought + w.action;
  const roll = Math.random() * total;
  if (roll < w.instinct) return "instinct";
  if (roll < w.instinct + w.thought) return "thought";
  return "action";
}

export type AmbientBleedPick = {
  line: string;
  pick: EchoPick;
  // Which sub-animal actually spoke, and in what role — undefined means
  // the 30% roll missed and the primary catalyst answered as usual, same
  // as plain pickAmbientLine. Not needed by every caller (Hub.ts's own
  // call sites only ever destructure `.line`), but kept on the return
  // value rather than thrown away — the one piece of state that actually
  // proves this feature is doing anything, useful for verification and for
  // any future consumer that wants to say so out loud (a debug overlay, a
  // socialLog entry that notes "this one wasn't really them").
  bled?: { role: SubAnimalRole; catalyst: Catalyst };
};

// Drop-in replacement for ambientLines.ts's own pickAmbientLine at every
// Hub.ts call site that shows an ordinary idle/verb-outcome line (Gate 0's
// own fallback in speak(), shareADrink, pegBoard, poker, darts) — NOT
// wired into socialSim.ts's own two pickAmbientLine call sites (the
// background NPC-NPC simulation), matching the exact same boundary
// data/hotTopics.ts's own header already drew for a different feature:
// socialSim.ts stays a deliberately separate, not-yet-extended consumer
// until a later pass decides otherwise.
export function pickAmbientLineWithBleed(pilotId: string, pilot: AmbientPilotState): AmbientBleedPick {
  const pick = pickSoloEcho(pilot);
  let catalyst = pilot.catalyst;
  let bled: AmbientBleedPick["bled"];
  if (Math.random() < AMBIENT_BLEED_CHANCE) {
    const subAnimals = assignSubAnimals(pilotId, pilot.catalyst);
    const role = pickBleedRole(pilot.stage);
    catalyst = subAnimals[role];
    bled = { role, catalyst };
  }
  const bank = LINE_BANK[catalyst][pick.echo][pilot.stage];
  const line = bank[Math.floor(Math.random() * bank.length)];
  return { line, pick, bled };
}

// Catalyst "clash" reactions in chat, 27 Aug 2026 (Social Sim Roadmap #10).
//
// Honest correction first, worth recording here rather than silently
// building on top of a wrong premise: the roadmap doc's own framing —
// "pickCatalystReaction currently only ever produces one reply per
// trigger... just letting more than one dictionary hit surface at once
// instead of taking the first" — reads as if something in the code stops
// after the FIRST NPC's hit and discards the rest. Checked directly against
// Hub.ts's real showCatalystOrFallback() before writing anything here (this
// project's own standing rule: verify a specific claim against the actual
// file, not memory or an older plan): that function already loops over
// EVERY nearby NPC and calls pickCatalystReaction independently for each
// one, with no early exit — verified live in a real browser, pinning three
// differently-catalysted NPCs to the player's own position and sending one
// typed line ("team party") that hits both wolf's and crow's primary
// dictionaries at once: both NPCs already produced their own real, distinct
// reactions, every time, with the third (raven, no dictionary hit) getting
// the ordinary shared shrug. So "more than one dictionary hit surfacing at
// once" was already true before this pass touched anything — that part of
// the roadmap item was stale, not unbuilt.
//
// What was genuinely still missing, and what this section actually adds:
// nothing marked any particular pair of simultaneous reactions as a
// deliberate values DISAGREEMENT as opposed to two catalysts that just
// happen to both have a dictionary hit on the same sentence for unrelated
// reasons. "Wolf and Crow both answered" isn't inherently a clash — Wolf
// and Shark answering IS, because teamwork and ambition genuinely pull
// against each other. CATALYST_CLASH_PAIRS below is that missing piece: a
// curated set of genuinely opposed value pairs, grounded in this file's own
// established trait identities (see the file header), not an exhaustive
// 36-pair grid — most catalyst pairs aren't meaningfully "opposed," just
// different, and forcing every combination into a clash would cheapen the
// ones that actually mean something. The roadmap doc's own example (wolf's
// teamwork against shark's ambition) is included verbatim, not reinterpreted.
export const CATALYST_CLASH_PAIRS: [Catalyst, Catalyst][] = [
  ["wolf", "shark"], // teamwork vs. ambition — the roadmap doc's own example
  ["wolf", "cat"], // teamwork vs. selfishness
  ["dog", "fox"], // loyalty vs. trickery
  ["dog", "cat"], // loyalty vs. selfishness
  ["rabbit", "shark"], // nurturing vs. ambition
  ["raven", "crow"], // instruction/discipline vs. indulgence/impulse
  ["bear", "wolf"], // isolation vs. teamwork
];

// Symmetric on purpose — the pairing table above only lists each pair once,
// but "does A clash with B" and "does B clash with A" are the same
// question, so callers shouldn't have to know or care which order a pair
// was written in.
export function catalystsClash(a: Catalyst, b: Catalyst): boolean {
  return CATALYST_CLASH_PAIRS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

export type ClashCandidate = { pilotId: string; catalyst: Catalyst };

// Finds the first genuinely opposed pair among a set of real reactions
// gathered from the SAME typed line (Hub.ts's showCatalystOrFallback: one
// call per submitChat, one candidate per NPC that actually got a real
// dictionary hit — misses/shrugs never reach this function at all). Pure,
// no randomness of its own: whether two already-decided reactions clash is
// either true or false, same as the rest of this pairing table. Returns the
// first opposed pair found, not every pair — Hub.ts only ever needs one to
// stage a two-line back-and-forth (see its own comment for why more than a
// pair at once would start reading as noise rather than a disagreement).
export function findCatalystClash(candidates: ClashCandidate[]): [ClashCandidate, ClashCandidate] | undefined {
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      if (catalystsClash(candidates[i].catalyst, candidates[j].catalyst)) {
        return [candidates[i], candidates[j]];
      }
    }
  }
  return undefined;
}
