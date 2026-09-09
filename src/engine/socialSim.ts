// src/engine/socialSim.ts
// Background NPC social-sim harness — Maxime's "irl sim to test the social
// engine" request, resolved via AskUserQuestion (26 Aug 2026) into: build
// the cheap, off-screen version now (this file), keep the full live-Hub-
// visual NPC-to-NPC feature as an acknowledged future goal, and split the
// kids/children mechanic off into its own future doc entirely, untouched
// here.
//
// The design, as proposed and greenlit ("coolio wat next. go"): a
// day-by-day loop, off-screen, no live Hub visuals — picks an NPC pair,
// runs one of Talk/a minigame/Ask Out between them, updates their pairwise
// bond, logs what happened. Output starts as a debug log ("Day 4: Bosk and
// Anand played darts, Bosk won, bond +3"), not player-facing. See
// src/sim/runSocialSim.ts for the CLI harness that actually drives this,
// mirroring src/sim/run.ts's own headless-mission-sim conventions.
//
// One real correction made during implementation, worth flagging rather
// than silently building around: the original sketch said this would
// update "their bond and individual Favorability/Stress/Morale." Getting
// into the actual data model (campaignState.ts section 11's own header)
// made clear that's wrong — HubPilotSocialState.favorability is
// specifically a pilot's standing with the PLAYER, not with another NPC;
// an NPC-to-NPC event has no business moving it. This file only ever moves
// the pairwise BOND (campaignState.ts section 12, NpcSocialState.bonds) —
// a genuinely separate axis, same distinction npcBonds.ts's own header
// already drew. Individual per-pilot Stress/Morale stay untouched by this
// pass; wiring those to real NPC-NPC events (a game with a friend easing
// Stress a little, say) is a real, separate follow-up, not built here.
//
// Zero Phaser dependency, same discipline as pegBoard.ts/darts.ts/holdem.ts/
// romance.ts — this is pure logic, unit-testable without a scene, a
// CampaignState, or a browser. runSocialSim.ts is the thin layer that
// bridges this to a real CampaignState (bonds/relationships persistence)
// and prints the log.
import { pairKey } from "../data/npcBonds";
import type { RecGameId } from "../data/recRoomAptitude";
import { gate0Reacts } from "../data/reactionGate";
import { pickAmbientLine, type AmbientPilotState, type Catalyst, type Stage } from "../data/ambientLines";
import { pickCatalystReaction } from "../data/catalystProfile";
import { resolveAskOut, speciesCompatibleForRomance } from "../data/romance";
import type { Species } from "../data/types";
import { createPegGame, applyMove as applyPegMove, pickMove as pickPegMove, pegSkillFor } from "./pegBoard";
// Rec Room Standings & NPC Learning, slice 5 (3 Sep 2026) — the two
// engines that used to be unreachable for an NPC-vs-NPC session, now
// seat-agnostic and skill-parameterized. See each file's own "Skill
// parameterization" block.
import {
  createHoldemGame,
  startNextHand,
  applyHoldemAction,
  pickSeatAction,
  pokerSkillFor,
  type HoldemGameState,
} from "./holdem";
import { createDartsGame, throwDart, pickThrowValue, dartsSkillFor } from "./darts";

export interface SocialSimPilot {
  pilotId: string;
  displayName: string;
  catalyst: Catalyst;
  // Wired 27 Aug 2026 alongside the rest of the Stage gating
  // (ambientLines.ts's own header). Hub.ts's real NPCs already carry a
  // live-derived stage on their own ambient state; this just threads the
  // same value through so the background/live-Hub talk encounter draws
  // from the pilot's own rank-appropriate pool instead of a fixed one.
  stage: Stage;
  // Added 9 Sep 2026 for speciesCompatibleForRomance (data/romance.ts) —
  // see resolveAskOutEncounter's own header, just below, for why this file
  // now needs a real species per pilot instead of getting away with none.
  // Every real caller (Hub.ts's buildNpcs()/HubNpc.species, runSocialSim.ts's
  // roster) derives this the same data-driven way romanceable already was:
  // off the real UNIT_ARCHETYPES entry, never hand-set.
  species: Species;
}

// "spar" added 30 Aug 2026 (Maxime: "boredom should trigger spar") —
// deliberately NOT one of the KIND_WEIGHTS options below, so it never fires
// from the ordinary weighted roll pickEncounterKind makes for ANY same-room
// pair. Hub.ts's own tryBoredomSpar is the only caller of
// resolveSparEncounter, gated on both being in the Spar Room AND at least
// one side's boredom meter being genuinely low (needsCounter.ts) — same
// "checked ahead of, instead of, the ordinary roll" shape tryAngerBlowup
// already uses there. Also distinct from the existing Breakdown system's
// own "spar" resolution flavor (data/breakdown.ts) — that one is a
// Stress+Worried CRISIS caught in the Spar Room, this one is an everyday
// idle/bored pilot going there looking for a bout on purpose. Two real
// triggers, two separate code paths, same room and same flavor of event by
// coincidence, not by one implementing the other.
export type EncounterKind = "talk" | "pegBoard" | "poker" | "fletchers" | "askOut" | "spar";

export interface EncounterInput {
  pilotA: SocialSimPilot;
  pilotB: SocialSimPilot;
  bond: number;
  // Already spoken for today — in a relationship with the player, or
  // already paired with a DIFFERENT NPC. Excludes this pair from the
  // Ask Out branch only (see pickEncounterKind below) — a committed pair
  // can still Talk or play a minigame together like any other pair. The
  // original sketch had committed pairs fall back to Talk specifically;
  // restricting only the Ask Out branch instead is a deliberate refinement
  // made during implementation, closer to how two people already attached
  // elsewhere would actually keep hanging out.
  aCommitted: boolean;
  bCommitted: boolean;
  // Room-gating the three real minigames, 2 Sep 2026 — a real gap, not a
  // hypothetical: this file has no concept of physical rooms at all (see
  // file header, "no live Hub visuals"), so pickEncounterKind was rolling
  // pegBoard/poker/fletchers for ANY same-room pair Hub.ts's
  // updateNpcEncounters found — including pairs standing in Hangar Deck or
  // Berths, since those two share hub.ts's "lower" deck with the actual
  // Rec Room (sameDeck(), not sameRoom()) with no wall at the seam. The
  // player-triggered version of this exact bug (typing "let's play poker"
  // outside the Rec Room) was already fixed 30 Aug 2026 (Tier 2,
  // nearestNpcInRange's requireRoom) — this ambient/background path was
  // missed, so a bubble could narrate two NPCs playing poker while neither
  // was anywhere near the actual table. Optional, defaults to eligible
  // (`?? true` in pickEncounterKind) so runSocialSim.ts's day-level CLI
  // harness — which has no rooms to check at all — keeps rolling the full
  // pool exactly as before; only Hub.ts's live runNpcEncounter passes this
  // explicitly, computed from both NPCs' actual npc.room === "recroom".
  minigamesEligible?: boolean;
  // Rec Room Standings, slice 5 — each side's live 0..100 skill at whatever
  // game gets rolled, supplied by the caller (Hub.ts reads it off the real
  // per-pilot record). Optional and additive, exactly the way
  // minigamesEligible was on 2 Sep: left out, both sides play at the same
  // fixed default the shipped engines always used, so runSocialSim.ts's
  // day-level harness keeps working untouched.
  //
  // Per GAME, not one number, because simulateEncounter picks which game
  // gets played and the caller cannot know in advance which skill it will
  // need. A pilot who is a shark at poker and hopeless at darts is the
  // whole point of the aptitude table; collapsing that to one number here
  // would quietly throw it away.
  skillA?: Partial<Record<RecGameId, number>>;
  skillB?: Partial<Record<RecGameId, number>>;
  rng: () => number;
}

export interface EncounterResult {
  kind: EncounterKind;
  bondDelta: number;
  summary: string;
  becameCouple: boolean; // true only for an accepted Ask Out
  // Live-visual staging, 26 Aug 2026 — Maxime: "we go ham bro" on the
  // "full live-Hub-visual NPC-to-NPC feature" this file's own header
  // already named as an acknowledged future goal. Optional and additive
  // on purpose: kind/bondDelta/summary/becameCouple are unchanged, still
  // exactly what runSocialSim.ts's CLI log and this file's own tests use.
  // These two exist only so Hub.ts can show a REAL two-line exchange
  // instead of narrating one — Hub.ts renders what's already decided
  // here, it doesn't get to re-decide anything (Build Brief §5.2: scenes
  // own no rules). Populated for "talk" only, this pass — see
  // resolveTalkEncounter. The other four kinds leave both undefined;
  // Hub.ts falls back to the existing single narrated summary bubble for
  // those, same as before this change.
  lineA?: string;
  lineB?: string;
  // Rec Room Standings, slice 5 — the real scoreline, when the game has
  // one. Darts reports the two totals; poker reports the two stacks at the
  // end of the sitting. The peg board leaves this undefined: it has an
  // outcome and no score at all. The standings board's `best` column reads
  // this, so a number here has to be a real result, never a stand-in.
  detail?: { scoreA: number; scoreB: number };
  // Who actually won, in the caller's own A/B terms. Added with slice 5
  // because the standings board needs to record a result and the only
  // previous statement of who won was inside the human-readable `summary`
  // string. Parsing that back out would have been a real bug waiting for
  // the first time somebody reworded a line. Set by the three minigame
  // resolvers and by spar; undefined for talk and askOut, which have no
  // winner.
  winner?: "a" | "b" | "draw";
}

// Placeholder, not a locked number — same caveat as every other constant
// in this scene's own systems (Hub.ts's file header; reactionGate.ts's
// GATE0_* constants; romance.ts's ROMANCE_* thresholds).
export const ASK_OUT_CHANCE = 0.12;

// Relative weights for the four non-Ask-Out encounter kinds. Talk is
// weighted heaviest since it's the cheapest, most-frequent real verb in
// the live Hub too (reactionGate.ts's own header: "the SINGLE MOST
// FREQUENT outcome... not a rare edge case"); the three minigames split
// the rest, pegBoard weighted a little above poker/fletchers since it's
// the one that runs for real rather than an abstracted coin flip (see
// resolveAbstractedMinigameEncounter's own header) and is worth surfacing
// more often while this harness is specifically testing the engine.
const KIND_WEIGHTS: { kind: Exclude<EncounterKind, "askOut">; weight: number }[] = [
  { kind: "talk", weight: 0.4 },
  { kind: "pegBoard", weight: 0.25 },
  { kind: "poker", weight: 0.2 },
  { kind: "fletchers", weight: 0.15 },
];

export function pickEncounterKind(input: {
  eligibleForAskOut: boolean;
  // See EncounterInput's own comment on the field this threads through —
  // undefined (every existing caller before 2 Sep 2026) means "eligible,"
  // same as explicit true, so this is purely additive.
  minigamesEligible?: boolean;
  rng: () => number;
}): EncounterKind {
  if (input.eligibleForAskOut && input.rng() < ASK_OUT_CHANCE) return "askOut";
  // Not in the actual Rec Room: the three real minigames drop out of the
  // pool entirely rather than being re-weighted among themselves — a
  // same-deck pair idling in Hangar Deck or Berths still gets an ordinary
  // Talk, it just can't roll into "played poker" while standing nowhere
  // near a poker table.
  const pool = (input.minigamesEligible ?? true) ? KIND_WEIGHTS : KIND_WEIGHTS.filter((w) => w.kind === "talk");
  const total = pool.reduce((sum, w) => sum + w.weight, 0);
  let roll = input.rng() * total;
  for (const { kind, weight } of pool) {
    if (roll < weight) return kind;
    roll -= weight;
  }
  return "talk"; // guard against float drift landing just past the last bucket — shouldn't fire
}

// Talk — reuses Gate 0 (reactionGate.ts) exactly as speak() does in the
// live Hub: a plain yes/no on whether the listener even registers this at
// all, with "no" being the common, cheap, valid outcome (that file's own
// header). One real simplification, flagged rather than hidden: the
// background sim doesn't track a live, per-pilot drunk/Stress ambient
// state the way Hub.ts's own update loop does, so Gate 0 is checked
// against a neutral baseline (sober, not panicking) — this always resolves
// to GATE0_BASE_CHANCE (0.65), never the drunk bonus or panic penalty.
// Wiring this to the real, persisted HubPilotSocialState.stress/drunkUntil
// is a real follow-up, not built this pass (see this file's own header on
// why individual Stress/Morale stay untouched here for now).
export function resolveTalkEncounter(input: EncounterInput): EncounterResult {
  const speakerState: AmbientPilotState = { catalyst: input.pilotA.catalyst, stage: input.pilotA.stage, stress: 0, morale: 100, drunk: false };
  const listenerState: AmbientPilotState = { catalyst: input.pilotB.catalyst, stage: input.pilotB.stage, stress: 0, morale: 100, drunk: false };
  // lineA — 26 Aug 2026, live-visual staging. Picked unconditionally: npcA
  // opens the exchange regardless of how Gate 0 lands for npcB (someone
  // said something either way — whether it landed is npcB's problem, not
  // npcA's). Same neutral-baseline simplification as listenerState below
  // (no live per-pilot Stress/drunk threaded through here, see file
  // header) — this is npcA's own catalyst voice, same pickAmbientLine
  // every other solo idle line in the live Hub already uses.
  const { line: lineA } = pickAmbientLine(speakerState);
  const reacted = gate0Reacts(listenerState);
  if (!reacted) {
    return {
      kind: "talk",
      bondDelta: 0,
      summary: `${input.pilotA.displayName} talked to ${input.pilotB.displayName}, but it didn't really land. Bond +0.`,
      becameCouple: false,
      lineA,
      // lineB deliberately absent — npcB didn't engage. Hub.ts reads that
      // absence as "no reply bubble," not a shrug to paper over it.
    };
  }
  // Nudges the bond one point further in whichever direction it's already
  // trending — an ordinary chat deepens an existing friendship or an
  // existing friction a little, it doesn't flip either on its own.
  const direction = input.bond >= 0 ? 1 : -1;
  // 26 Aug 2026 — npcB's reply tries the catalyst dictionary first
  // (catalystProfile.ts, the same system a player's own typed chat
  // reacts through) against npcA's actual line, so two NPCs whose
  // vocabularies genuinely overlap get a real, specific-sounding
  // exchange instead of two lines picked independently of each other.
  // Falls back to npcB's own generic ambient line on a dictionary miss —
  // same content pickLineForMessage's summary already quoted before this
  // change, so a total miss looks identical to the old behavior.
  const dictionaryReply = pickCatalystReaction(listenerState, input.pilotB.pilotId, lineA);
  const lineB = dictionaryReply ? dictionaryReply.line : pickAmbientLine(listenerState).line;
  return {
    kind: "talk",
    bondDelta: direction,
    summary: `${input.pilotA.displayName} talked to ${input.pilotB.displayName} ("${lineB}"). Bond ${direction > 0 ? "+1" : "-1"}.`,
    becameCouple: false,
    lineA,
    lineB,
  };
}

// The peg board — the one Rec Room minigame engine that's genuinely
// side-agnostic (pegBoard.ts's pickAiMove(state, aiSide) takes a PegSide,
// not a hardcoded human/ai seat), so this runs the REAL engine end-to-end,
// both sides driven by its own AI, exactly the way a live human-vs-AI
// session would run except neither side is a human. Side "a" is always
// pilotA and side "b" is always pilotB — an arbitrary but consistent
// convention (createPegGame() always opens on side "a").
//
// Bond delta, mirroring finishPegBoard's own win=+6/draw=+2/loss=-2
// convention (Hub.ts) for consistency — with one necessary translation,
// flagged rather than silently invented: finishPegBoard's numbers are a
// delta on ONE pilot's own Favorability (their standing with the player),
// which has a real winner and a real loser. A pairwise bond is a single
// SHARED number for the pair, so there's no separate "loser's side" to
// dock — two friends playing a game together doesn't sensibly damage their
// friendship just because one of them lost. This applies the magnitude
// only: +6 for a decisive win/loss (a more eventful, memorable session),
// +2 for a draw — always upward, never negative.
export function resolvePegBoardEncounter(input: EncounterInput): EncounterResult {
  let game = createPegGame();
  let guard = 0;
  // Slice 5, 3 Sep 2026 — this loop already drove both sides through the
  // engine; what is new is that the two sides can now be genuinely
  // different players. Seat "a" is pilotA, seat "b" is pilotB. With no
  // skills supplied the two skill objects are both the shipped default, so
  // this is byte-for-byte the old behaviour.
  const rawA = input.skillA?.pegBoard;
  const rawB = input.skillB?.pegBoard;
  const skillA = rawA === undefined ? undefined : pegSkillFor(rawA);
  const skillB = rawB === undefined ? undefined : pegSkillFor(rawB);
  while (game.status === "playing" && guard < 200) {
    guard += 1;
    const move = pickPegMove(game, game.turn, game.turn === "a" ? skillA : skillB);
    if (!move) break; // shouldn't happen — resolveEndConditions inside applyMove already ends the game the instant nobody has a legal move
    game = applyPegMove(game, move);
  }
  const status = game.status;
  if (status === "playing") {
    // Guard tripped without the game ever resolving — genuinely shouldn't
    // happen (pegBoard.ts's own end conditions always resolve once no
    // legal move exists), but this harness is meant to run many simulated
    // days unattended, so it fails safe (a null event) rather than
    // crashing the whole sim over what would be a real engine bug.
    return {
      kind: "pegBoard",
      bondDelta: 0,
      summary: `${input.pilotA.displayName} and ${input.pilotB.displayName} sat down at the peg board, but the session never resolved (guard hit — this would be a real bug in pegBoard.ts, not expected). Bond +0.`,
      becameCouple: false,
      // No winner deliberately: a session that never resolved is not a
      // draw, and recording it as one would put a fake row on the board.
    };
  }
  if (status.winner === "draw") {
    return {
      kind: "pegBoard",
      bondDelta: 2,
      summary: `${input.pilotA.displayName} and ${input.pilotB.displayName} played the peg board to a draw. Bond +2.`,
      becameCouple: false,
      winner: "draw",
    };
  }
  const winner = status.winner === "a" ? input.pilotA : input.pilotB;
  return {
    kind: "pegBoard",
    bondDelta: 6,
    summary: `${input.pilotA.displayName} and ${input.pilotB.displayName} played the peg board — ${winner.displayName} won. Bond +6.`,
    becameCouple: false,
    winner: status.winner === "a" ? "a" : "b",
  };
}

// Poker and Fletchers — REAL sessions as of 3 Sep 2026 (Rec Room Standings
// & NPC Learning, slice 5). Both used to be a `rng() < 0.5` coin flip,
// because holdem.ts and darts.ts each hardcoded a "human" seat and neither
// exported a decision function the second side could use. Slice 1 fixed
// that in the engines themselves; this is the payoff.
//
// The bubble stops narrating a coin flip and starts reporting a scoreline:
//
//   before: "Bosk and Anand played Fletchers (abstracted - no real
//            throw-by-throw session) - Bosk won. Bond +6."
//   after:  "Bosk and Anand played Fletchers - Bosk took it 87-64."
//
// resolveAbstractedMinigameEncounter is kept as a thin router to the two
// real resolvers below, rather than deleted, because it is the exported
// name simulateEncounter and this file's own tests already call. Its
// "abstracted" name is now wrong; renaming it is a separate, mechanical
// change and is deliberately not bundled into a behaviour change.
export function resolveAbstractedMinigameEncounter(kind: "poker" | "fletchers", input: EncounterInput): EncounterResult {
  return kind === "poker" ? resolvePokerEncounter(input) : resolveFletchersEncounter(input);
}

/**
 * A real Hold'em sitting, capped at NPC_POKER_HANDS hands and scored on
 * chips won rather than played to bust-out.
 *
 * The cap is a real design decision, not a shortcut, and it is stated in
 * the summary line rather than hidden behind a result that looks like a
 * full session — this codebase's own "no silent caps" discipline. Two
 * reasons for it:
 *
 *   1. A full sitting to bust-out at 500 chips with 10/20 blinds can run
 *      hundreds of hands. This resolver is called from Hub.ts inside a
 *      single frame, and hundreds of hands there is a visible hitch. The
 *      alternative (chunking a session across frames) is a lot more code
 *      for a worse story.
 *   2. It is better fiction anyway. Two crew on a break play a few hands.
 *      They do not sit there until one of them is broke.
 */
export const NPC_POKER_HANDS = 8;

export function resolvePokerEncounter(input: EncounterInput): EncounterResult {
  const rawA = input.skillA?.poker;
  const rawB = input.skillB?.poker;
  const skillA = rawA === undefined ? undefined : pokerSkillFor(rawA);
  const skillB = rawB === undefined ? undefined : pokerSkillFor(rawB);
  let game: HoldemGameState = createHoldemGame();

  // Seat 0 is pilotA, seat 1 is pilotB. The engine has no idea either of
  // them is an NPC, which is the whole point of slice 1.
  let handsPlayed = 0;
  let guard = 0;
  // The hand counter is incremented where the hand actually ENDS, not in
  // the loop condition. First draft put `!game.bustedPlayer` in the while
  // condition, which meant a session where someone busted on hand one
  // exited before counting it and reported "0 hands" — caught by the
  // cap-holds test in socialSim.test.ts, not by inspection.
  for (;;) {
    guard += 1;
    if (guard > 5000) break; // engine bug guard; this harness runs unattended
    if (game.status === "handOver") {
      handsPlayed += 1;
      if (handsPlayed >= NPC_POKER_HANDS || game.bustedPlayer) break;
      game = startNextHand(game);
      continue;
    }
    const seat = game.betting.actingIndex as 0 | 1;
    const action = pickSeatAction(game, seat, seat === 0 ? skillA : skillB);
    game = applyHoldemAction(game, seat, action);
  }

  const stackA = game.players[0].stack;
  const stackB = game.players[1].stack;
  const bustNote = game.bustedPlayer ? " (one of them ran out of chips early)" : "";
  const capNote = `${handsPlayed} hands${bustNote}`;

  if (stackA === stackB) {
    return {
      kind: "poker",
      bondDelta: 2,
      summary: `${input.pilotA.displayName} and ${input.pilotB.displayName} played poker — dead even after ${capNote}, ${stackA} chips each. Bond +2.`,
      becameCouple: false,
      winner: "draw",
      detail: { scoreA: stackA, scoreB: stackB },
    };
  }
  const aWon = stackA > stackB;
  const winner = aWon ? input.pilotA : input.pilotB;
  return {
    kind: "poker",
    bondDelta: 6, // see resolvePegBoardEncounter's own header — same "decisive session" magnitude
    summary: `${input.pilotA.displayName} and ${input.pilotB.displayName} played poker — ${winner.displayName} came out ahead after ${capNote}, ${Math.max(stackA, stackB)} to ${Math.min(stackA, stackB)}. Bond +6.`,
    becameCouple: false,
    winner: aWon ? "a" : "b",
    detail: { scoreA: stackA, scoreB: stackB },
  };
}

/**
 * A real Fletchers session — three rounds, three darts a round, both sides
 * throwing through the same engine and the same hand-jitter a player's own
 * throw gets.
 *
 * Darts needed no seat refactor at all: DartsPlayerId's "human" / "ai" were
 * only ever two labels, and nothing in the engine did anything
 * human-specific with them. Here "human" is seat A and "ai" is seat B, and
 * the engine never knows the difference. It only ever needed the skill.
 */
export function resolveFletchersEncounter(input: EncounterInput): EncounterResult {
  const rawA = input.skillA?.fletchers;
  const rawB = input.skillB?.fletchers;
  const skillA = rawA === undefined ? undefined : dartsSkillFor(rawA);
  const skillB = rawB === undefined ? undefined : dartsSkillFor(rawB);
  let game = createDartsGame();
  let guard = 0;
  while (game.status === "playing" && guard < 100) {
    guard += 1;
    const aim = pickThrowValue(game.turn === "human" ? skillA : skillB);
    game = throwDart(game, aim).state;
  }

  const scoreA = game.totals.human;
  const scoreB = game.totals.ai;
  if (game.winner === "draw" || game.status !== "over") {
    return {
      kind: "fletchers",
      bondDelta: 2,
      summary: `${input.pilotA.displayName} and ${input.pilotB.displayName} threw Fletchers to a draw, ${scoreA}-${scoreB}. Bond +2.`,
      becameCouple: false,
      winner: "draw",
      detail: { scoreA, scoreB },
    };
  }
  const winner = game.winner === "human" ? input.pilotA : input.pilotB;
  return {
    kind: "fletchers",
    bondDelta: 6,
    summary: `${input.pilotA.displayName} and ${input.pilotB.displayName} played Fletchers — ${winner.displayName} took it ${Math.max(scoreA, scoreB)}-${Math.min(scoreA, scoreB)}. Bond +6.`,
    becameCouple: false,
    winner: game.winner === "human" ? "a" : "b",
    detail: { scoreA, scoreB },
  };
}

// Ask Out — reuses romance.ts's resolveAskOut() directly, with the pair's
// persisted bond standing in for "favorability."
//
// CORRECTED 9 Sep 2026: this comment used to say `romanceable` was always
// hardcoded true here, "a deliberate, locked call, not an oversight,"
// reasoning from romance.ts's single-species ROMANCE_CAPPED_SPECIES cap
// being player-facing only. That reasoning is still correct as far as it
// goes — isRomanceableSpecies() (the single-species cap) genuinely never
// belongs here, and still isn't called in this file. But it was never the
// whole story: Maxime's later, separate ask ("hiopi can only truly pair
// with other hiopi") is a real PAIRWISE rule, not a reapplication of the
// single-species one, and it DOES apply NPC-to-NPC — see
// speciesCompatibleForRomance's own header (data/romance.ts) for why.
// `romanceable` below is now that pairwise check, not a hardcoded true.

// Spar — boredom-driven, everyday, NOT a crisis (see EncounterKind's own
// comment for how this differs from Breakdown's own "spar" flavor). Same
// abstracted "no real move-by-move session" shape as
// resolveAbstractedMinigameEncounter's poker/fletchers branch above — a
// physical bout has even less reason to be modeled hit-by-hit than a card
// game or a dart throw would, and the same +6 "decisive session" bond
// magnitude those two already use, for the same reason (this file's own
// resolvePegBoardEncounter header): two people who spar together and one
// of them wins doesn't sensibly cost the loser anything on a SHARED
// pairwise bond, so this only ever moves upward, same as every other
// resolve*Encounter in this file.
export function resolveSparEncounter(input: EncounterInput): EncounterResult {
  const aWon = input.rng() < 0.5;
  const winner = aWon ? input.pilotA : input.pilotB;
  return {
    kind: "spar",
    bondDelta: 6,
    summary: `${input.pilotA.displayName} and ${input.pilotB.displayName} went a few rounds in the Spar Room — ${winner.displayName} came out on top. Bond +6.`,
    becameCouple: false,
  };
}

export function resolveAskOutEncounter(input: EncounterInput): EncounterResult {
  const compatible = speciesCompatibleForRomance(input.pilotA.species, input.pilotB.species);
  const outcome = resolveAskOut({ favorability: input.bond, romanceable: compatible, alreadyInRelationship: false });
  // alreadyInRelationship is always false here by construction — this
  // branch is only ever reached when pickEncounterKind's eligibleForAskOut
  // was true, which already means neither pilot is committed (see
  // simulateEncounter below).
  //
  // "closeFriendOnly" is a real, reachable outcome now, not just the
  // player-facing branch it used to be exclusively: a species-incompatible
  // pair (an Osnian and a Hiopi, say) always lands here regardless of
  // bond. Own inline summary line below, same as the accept/reject
  // branches already write their own rather than pulling from romance.ts's
  // ALREADY_TOGETHER_LINES/CLOSE_FRIEND_ONLY_LINES banks (those are Hub.ts's
  // own player-facing askOut() content, never imported here) — consistent
  // with how this function already handles its other two outcomes.
  const becameCouple = outcome.result === "accepted";
  const summary =
    outcome.result === "closeFriendOnly"
      ? `${input.pilotA.displayName} asked ${input.pilotB.displayName} out — it's just not that kind of match between them.`
      : becameCouple
        ? `${input.pilotA.displayName} asked ${input.pilotB.displayName} out — accepted! They're together now.`
        : `${input.pilotA.displayName} asked ${input.pilotB.displayName} out — turned down.`;
  return {
    kind: "askOut",
    bondDelta: outcome.favorabilityDelta,
    summary: `${summary} Bond ${outcome.favorabilityDelta >= 0 ? "+" : ""}${outcome.favorabilityDelta}.`,
    becameCouple,
  };
}

export function simulateEncounter(input: EncounterInput): EncounterResult {
  // Species-incompatible pairs (9 Sep 2026) are excluded from the Ask Out
  // branch the same way a committed pair already is, just above — not
  // resolved-and-rebuffed on every single roll. They still Talk/play
  // minigames together like any other pair; resolveAskOutEncounter's own
  // closeFriendOnly branch above stays correct as a second, defensive
  // layer for any caller (a test, or a future direct call) that reaches it
  // without going through this gate.
  const eligibleForAskOut = !input.aCommitted && !input.bCommitted && speciesCompatibleForRomance(input.pilotA.species, input.pilotB.species);
  const kind = pickEncounterKind({ eligibleForAskOut, minigamesEligible: input.minigamesEligible, rng: input.rng });
  switch (kind) {
    case "talk":
      return resolveTalkEncounter(input);
    case "pegBoard":
      return resolvePegBoardEncounter(input);
    case "poker":
      return resolveAbstractedMinigameEncounter("poker", input);
    case "fletchers":
      return resolveAbstractedMinigameEncounter("fletchers", input);
    case "askOut":
      return resolveAskOutEncounter(input);
    // pickEncounterKind never actually returns "spar" (see EncounterKind's
    // own comment — it's deliberately outside KIND_WEIGHTS) — Hub.ts's
    // tryBoredomSpar calls resolveSparEncounter directly instead. This case
    // only exists so this switch stays exhaustive over the real type.
    case "spar":
      return resolveSparEncounter(input);
  }
}

// ---- Day-level orchestration --------------------------------------------

export interface SocialSimState {
  bonds: Record<string, number>; // pairKey -> value, mutated in place by simulateDay
  relationships: string[]; // pairKeys currently "together," NPC-to-NPC only
}

// A pilot counts as committed today if they're already paired with a
// DIFFERENT NPC (tracked in state.relationships) or already in a
// relationship with the player (playerCommitted — the caller computes this
// fresh each day from live CampaignState/HubPilotSocialState.inRelationship,
// not stored here; see runSocialSim.ts).
export function isCommitted(pilotId: string, state: SocialSimState, playerCommitted: Set<string>): boolean {
  if (playerCommitted.has(pilotId)) return true;
  return state.relationships.some((key) => key.split("::").includes(pilotId));
}

// Picks two distinct roster entries at random — the classic "pick a second
// index, bump it past the first" trick so both draws come from one rng
// call each and the pair is always distinct without a reject-and-retry
// loop.
export function pickPair(roster: SocialSimPilot[], rng: () => number): [SocialSimPilot, SocialSimPilot] {
  if (roster.length < 2) throw new Error("socialSim needs at least 2 pilots in the roster to pick a pair");
  const i = Math.floor(rng() * roster.length);
  let j = Math.floor(rng() * (roster.length - 1));
  if (j >= i) j += 1;
  return [roster[i], roster[j]];
}

// Runs exactly one encounter for `day` — one random pair, one resolved
// encounter, one mutation to `state`, one log line. runSocialSim.ts calls
// this once per simulated day (matching the "one pair, one event per day"
// shape from the original sketch); nothing here stops a future pass from
// running more than one encounter per day if that turns out to be more
// interesting to watch, but that's a real tuning question, not decided
// here.
export function simulateDay(
  roster: SocialSimPilot[],
  state: SocialSimState,
  playerCommitted: Set<string>,
  day: number,
  rng: () => number = Math.random
): string {
  const [pilotA, pilotB] = pickPair(roster, rng);
  const key = pairKey(pilotA.pilotId, pilotB.pilotId);
  const bond = state.bonds[key] ?? 0;
  const aCommitted = isCommitted(pilotA.pilotId, state, playerCommitted);
  const bCommitted = isCommitted(pilotB.pilotId, state, playerCommitted);
  const result = simulateEncounter({ pilotA, pilotB, bond, aCommitted, bCommitted, rng });
  state.bonds[key] = bond + result.bondDelta;
  if (result.becameCouple) state.relationships.push(key);
  return `Day ${day}: ${result.summary}`;
}
