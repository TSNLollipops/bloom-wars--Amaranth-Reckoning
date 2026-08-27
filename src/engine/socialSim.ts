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
import { gate0Reacts } from "../data/reactionGate";
import { pickAmbientLine, type AmbientPilotState, type Catalyst, type Stage } from "../data/ambientLines";
import { pickCatalystReaction } from "../data/catalystProfile";
import { resolveAskOut } from "../data/romance";
import { createPegGame, applyMove as applyPegMove, pickAiMove as pickPegAiMove } from "./pegBoard";

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
}

export type EncounterKind = "talk" | "pegBoard" | "poker" | "fletchers" | "askOut";

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

export function pickEncounterKind(input: { eligibleForAskOut: boolean; rng: () => number }): EncounterKind {
  if (input.eligibleForAskOut && input.rng() < ASK_OUT_CHANCE) return "askOut";
  const total = KIND_WEIGHTS.reduce((sum, w) => sum + w.weight, 0);
  let roll = input.rng() * total;
  for (const { kind, weight } of KIND_WEIGHTS) {
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
  while (game.status === "playing" && guard < 200) {
    guard += 1;
    const move = pickPegAiMove(game, game.turn);
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
    };
  }
  if (status.winner === "draw") {
    return {
      kind: "pegBoard",
      bondDelta: 2,
      summary: `${input.pilotA.displayName} and ${input.pilotB.displayName} played the peg board to a draw. Bond +2.`,
      becameCouple: false,
    };
  }
  const winner = status.winner === "a" ? input.pilotA : input.pilotB;
  return {
    kind: "pegBoard",
    bondDelta: 6,
    summary: `${input.pilotA.displayName} and ${input.pilotB.displayName} played the peg board — ${winner.displayName} won. Bond +6.`,
    becameCouple: false,
  };
}

// Poker and Fletchers — explicitly ABSTRACTED, not a real hand-by-hand or
// throw-by-throw session. holdem.ts and darts.ts both hardcode a "human"
// vs "ai" seat (SeatId / DartsPlayerId), with no exported decision function
// for the "human" side the way pegBoard.ts's pickAiMove is genuinely
// side-agnostic — holdem.ts's own AI logic (preflopStrength/
// postflopStrength/decideAction) is module-private and not exported at
// all. Making either of those two engines run a real NPC-vs-NPC session
// would mean refactoring two other shipped, tested files — real, separate
// scope, not undertaken in this pass. Stated plainly here AND in the log
// line itself (this project's own "no silent caps" discipline), not hidden
// behind a result that looks like a real session.
export function resolveAbstractedMinigameEncounter(kind: "poker" | "fletchers", input: EncounterInput): EncounterResult {
  const aWon = input.rng() < 0.5;
  const winner = aWon ? input.pilotA : input.pilotB;
  const label = kind === "poker" ? "played poker" : "played Fletchers";
  return {
    kind,
    bondDelta: 6, // see resolvePegBoardEncounter's own header — same "decisive session" magnitude
    summary: `${input.pilotA.displayName} and ${input.pilotB.displayName} ${label} (abstracted — no real hand-by-hand/throw-by-throw session, see file header) — ${winner.displayName} won. Bond +6.`,
    becameCouple: false,
  };
}

// Ask Out — reuses romance.ts's resolveAskOut() directly, with the pair's
// persisted bond standing in for "favorability" and romanceable always
// true. That second part is a deliberate, locked call, not an oversight:
// romance.ts's own header (fixed 26 Aug 2026, same day this was caught for
// the live Hub) makes the species cap (ROMANCE_CAPPED_SPECIES, Hiopi
// today) explicitly player-facing only — "species only gates whether
// Rourke specifically can romance a pilot, never whether two NPCs can
// romance each other." Applying isRomanceableSpecies() here would be
// re-introducing the exact bug that got fixed there.
export function resolveAskOutEncounter(input: EncounterInput): EncounterResult {
  const outcome = resolveAskOut({ favorability: input.bond, romanceable: true, alreadyInRelationship: false });
  // alreadyInRelationship is always false here by construction — this
  // branch is only ever reached when pickEncounterKind's eligibleForAskOut
  // was true, which already means neither pilot is committed (see
  // simulateEncounter below).
  const becameCouple = outcome.result === "accepted";
  const summary = becameCouple
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
  const eligibleForAskOut = !input.aCommitted && !input.bCommitted;
  const kind = pickEncounterKind({ eligibleForAskOut, rng: input.rng });
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
