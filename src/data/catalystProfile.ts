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
import { LINE_BANK, pickSoloEcho, type AmbientPilotState, type Catalyst, type Stage } from "./ambientLines";

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
