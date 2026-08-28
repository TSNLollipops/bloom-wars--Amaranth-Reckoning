// src/scenes/Hub.ts
// The real, in-repo start of claude/Bloom_Wars_Walkable_Hub_Build_Plan_v1.md
// Phase 1 — "minimum walkable hub." Everything here was already proven out
// in an isolated canvas spike first (per that doc's own De-risking Note,
// §4) — this scene is that same proven shape (real-time WASD/arrow
// movement, room collision, sound-range Talk verb) rebuilt against the
// real engine's own conventions (Phaser Graphics/Text placeholders, GDD
// §12.2's circle+initials portrait rule, the muted blue-grey palette
// Boot/Hangar/TransporterPad already share) instead of the spike's
// throwaway plain-canvas code.
//
// Scope line, worth being explicit about (project's own "flag before
// growing scope" rule) — UPDATED 26 Aug 2026, see the correction below.
// Originally: this scene used LOCAL, scene-only pilot state for Stress/
// Morale/drunk/catalyst and for Favorability, none of it reading from or
// writing to CampaignState/PilotRecord.
//
// Correction, 26 Aug 2026 (Maxime's own pick, "Persistent hub state,"
// asked directly rather than assumed): Favorability, Stress, Morale,
// socialLog, and inRelationship now DO round-trip through CampaignState —
// see engine/campaignState.ts's own section 11 (HubPilotSocialState /
// ensureHubSocialState) for the persisted shape, and persistNpcSocial()
// below for where this scene writes back into it. One exception stays
// deliberately local, not an oversight: ambient.catalyst (fixed per-pilot
// identity data, not state that changes — NPC_SEED already reconstructs it
// identically every load). data/types.ts's own socialHook is a separate,
// unrelated stub field (a mission-data flag for "there's a social beat
// here," never read anywhere) — not the same gap this section closes.
//
// Second correction, same day, a few minutes later: ambient.drunk was
// excluded above specifically because there was no "sober up" mechanic —
// Maxime closed that gap directly ("drunk should last for a bit. but your
// call on duration"), so the objection resolved rather than the exclusion
// staying. drunk now persists too, gated by a real expiry (`drunkUntil`,
// HubPilotSocialState) rather than the one-way flag the original exclusion
// was worried about — see DRUNK_DURATION_MS and updateDrunkExpiry() below.
//
// Phase 1 scope: one room, NPCs are otherwise stationary (no autonomous
// roaming/cliques — that's the Build Plan doc's §4 addendum, explicitly
// Phase 3; the one exception is walking to MUSTER_POINT on a muster call,
// piece #2 of §9, 26 Aug 2026 — narrow and message-triggered, not general
// roaming AI), Talk only (no Rec Room minigames, no Ask Out, no calendar
// cost).
//
// Phase 2, 26 Aug 2026 — "build the antfarm" (Maxime, choosing the first
// slice of Phase 2 over the verb framework or the Rec Room minigames).
// Grows the walkable space from Rec Room alone to all six rooms Antfarm §2
// / §11.3 already names (Hangar Deck, the Workshop, the Vault, Berths,
// CIC/Bridge, the grotto) — per the Build Plan doc's own line, "same tech,
// more map content and room-to-room transitions, not new engineering."
// Deliberately NOT built here: any of those rooms' actual mechanical jobs
// (gear purchases, Heirloom dedication, fire-support config, recruitment,
// a CO character) — those stay exactly where they already live (the
// Campaign Shop scene, `Hangar.ts` — a different, unrelated use of the
// word "Hangar," see that file's own header) or wait for the verb
// framework and later content passes. Each new room is walkable and
// empty, with an honest "not built yet" note rather than a fake feature.
// Also deliberately NOT touched: which named pilot lives in which room —
// Bosk/Anand/Iyari stay exactly at their existing Rec Room seats. Moving
// them, or deciding who belongs in the Workshop vs. Berths, is a real
// content decision nothing on record has made yet.
//
// Architecture call: room-to-room movement is a discrete swap (same
// paradigm classic 2D RPGs use for interiors), not a scrolling camera
// following the player through one big contiguous world. A scrolling
// camera would force scrollFactor handling onto every existing
// fixed-position UI element (the instructions text, the interact prompt,
// the chat DOM input, the footer buttons) — real new-engineering risk for
// a placeholder pass. A room swap reuses Phase 1's existing single-room
// collision model unchanged: every room shares the exact same rectangle
// footprint (ROOM_BOUNDS), doors are proximity-triggered exactly like
// piece #4's bay (E to enter, same interact prompt), and switching rooms
// just swaps which room's doors/NPCs are active and repositions the
// player at the entry point. Zero changes needed to any fixed-position UI.
import Phaser from "phaser";
import { WARDEN_PILOTS, AMARANTH_MISSIONS_BY_ID } from "../data/campaignAmaranth";
import { PATH_COLORS, pilotInitials } from "./TransporterPad";
import {
  pickLineForMessage,
  distortMessage,
  stageFromTier,
  detectStagePromotion,
  pickStagePromotionLine,
  detectRankPromotion,
  pickRankGreetingLine,
  type AmbientPilotState,
  type HubMessage,
  type Stage,
  type Catalyst,
} from "../data/ambientLines";
import {
  interpretPlayerChat,
  detectUnbuiltVerbLine,
  detectVerbRequest,
  detectHistoryRequest,
  detectHighlightsRequest,
  detectBuildRequest,
  CHAT_FALLBACK_LINES,
  type BuildRequest,
  type KnownUnbuildableId,
  type BuildableBayId,
} from "../data/chatIntent";
import { pickCatalystReaction, pickAmbientLineWithBleed, findCatalystClash } from "../data/catalystProfile";
import { pickSlottedVariant, resolveSlotText, type SlotContext } from "../data/crewBanterSlots";
import { VERBS, type SocialLogEntry } from "../data/verbs";
import { buildFirstMilestones, buildStagePromotionMilestones } from "../data/highlights";
import { pruneExpiredHotTopics, pickHotTopicForSpeaker, renderHotTopicLine, type HotTopic } from "../data/hotTopics";
import { deriveRelationshipStage, relationshipStagePhrase, pickRelationshipStageLine } from "../data/relationshipStage";
import { pickFrictionLine } from "../data/friction";
import { worryTriggerChance } from "../data/missionWorry";
import { gate0Reacts } from "../data/reactionGate";
import { NEED_ROOM, NEEDS_FLAVOR_BANK, NEEDS_FLAVOR_CHANCE, needsStressMoraleDelta, tickNeed, worstNeed } from "../data/needsCounter";
import { resolveAskOut, isRomanceableSpecies, ALREADY_TOGETHER_LINES, CLOSE_FRIEND_ONLY_LINES } from "../data/romance";
import { UNIT_ARCHETYPES } from "../data/units";
import { pairKey, findClosestBond, findWorstRival, pointNear, pointAwayFrom, CLIQUE_THRESHOLD, RIVAL_THRESHOLD } from "../data/npcBonds";
import { makeShopButton } from "./shop/ShopPanel";
import { createPegGame, applyMove as applyPegBoardMove, legalMovesForTurn as pegLegalMoves, pickAiMove as pickPegAiMove, type PegGameState, type PegMove } from "../engine/pegBoard";
import { createHoldemGame, applyHoldemAction, startNextHand as startNextHoldemHand, legalActionsFor as pokerLegalActions, potTotal as pokerPotTotal, pickAiAction as pickPokerAiAction, type HoldemGameState } from "../engine/holdem";
import type { BettingAction } from "../engine/cardTable/bettingEngine";
import { cardLabel, cardIsRed, type Card } from "../engine/cardTable/deck";
import { describeHand } from "../engine/cardTable/handEval";
import { createDartsGame, throwDart, pickAiThrowValue, zoneLabel, DART_ZONE_THRESHOLDS, type DartsGameState } from "../engine/darts";
import {
  loadCampaignState,
  saveCampaignState,
  createWardenCampaignState,
  ensureHubSocialState,
  ensureNpcSocialState,
  rankDisplayTitle,
  type CampaignState,
  type NpcSocialState,
  type Rank,
  type ReservedBayId,
} from "../engine/campaignState";
import { NPC_SEED, NPC_BOND_SEED } from "../data/npcSeed";
// 26 Aug 2026 — the "visible interaction" piece §17.3's own roaming never
// had: two roaming NPCs closing distance meant nothing on arrival before
// this. Reuses today's background social-sim harness verbatim rather than
// re-deriving any of Talk/peg board/poker/fletchers/Ask Out — see
// updateNpcEncounters()/runNpcEncounter() below and socialSim.ts's own
// header for the full design history.
import { simulateEncounter, isCommitted, type SocialSimPilot } from "../engine/socialSim";
// The egg hull, 27 Aug 2026 — kept in its own Phaser-free module so its
// math is directly unit-testable; see hubGeometry.ts's own header for why.
import { clampToEllipse } from "../engine/hubGeometry";

// Every room reuses this exact footprint — placeholder-stage simplicity,
// GDD §12.2 style. Only which doors/NPCs are active changes between rooms;
// the box itself never resizes, so none of the fixed-position UI below
// (interact prompt, chat box, footer) ever needs to move.
const ROOM_BOUNDS = { left: 130, right: 830, top: 108, bottom: 552 };
const PLAYER_SPEED = 190; // px/sec
const PLAYER_R = 15;
const NPC_R = 16;

// 26 Aug 2026 — Maxime: "drunk should last for a bit. but your call on
// duration." Real wall-clock minutes, same clock persistence already uses
// (Date.now(), not this.time.now) since drunk now persists across a
// reload too (see HubPilotSocialState.drunkUntil). Placeholder, same "not
// a locked number" caveat as every other timing/tuning constant in this
// scene — 5 minutes picked to be long enough to actually color a Hub
// session (walk around, talk to someone, still be drunk) without becoming
// the default state for the rest of an extended one.
const DRUNK_DURATION_MS = 5 * 60 * 1000;
const TALK_RADIUS = 130; // sound range — everyone inside reacts on their own, per the locked broadcast model
const APPROACH_RADIUS = 78; // Favorability becomes visible once you're this close

// Phase 3 piece three, 26 Aug 2026 — autonomous roaming's own pacing.
// Placeholder numbers, same caveat as everywhere else in this scene: an
// idle NPC reconsiders where to stand every ROAM_INTERVAL_MIN-MAX_MS
// (randomized per-decision, not a fixed tick, so three NPCs don't move in
// lockstep), closes to ROAM_APPROACH_DIST of their closest bond (bigger
// than NPC_R*2 so two NPCs standing near each other never actually
// collide/block one another), or steps ROAM_DRIFT_DIST further away from
// their worst rival.
const ROAM_INTERVAL_MIN_MS = 5000;
const ROAM_INTERVAL_MAX_MS = 11000;
const ROAM_APPROACH_DIST = 50;
const ROAM_DRIFT_DIST = 70;

// 26 Aug 2026 — Maxime, on watching this play out: "make sure the npc talk
// to those they arent close too like normal human... i dont want the npc
// to stall and not make friend. even if they have zero familiarity with no
// one." Real gap, found by tracing the logic rather than guessing: the old
// destination pick was a strict if/else-if — a real clique bond always won,
// a real rival always got dodged, and anything short of either threshold
// fell to a directionless self-wander that never targeted another NPC at
// all. Two NPCs who'd never met (bond exactly 0, the true cold-start case a
// bigger future roster will actually hit) would NEVER walk toward each
// other — nothing about "neutral" ever pointed anywhere but empty space
// near wherever they already stood. Replaced with weighted rolls below:
// RIVAL_AVOID_CHANCE and CLIQUE_APPROACH_CHANCE are each real but NOT
// absolute (a normal human doesn't spend literally 100% of their free
// moments either fleeing one person or glued to their one favorite), and
// the fallback for everything else — including true zero-familiarity — is
// MINGLE: walk toward a random other roommate, not a random empty point.
// That fallback is what actually closes the stall Maxime flagged: there is
// no longer any branch that produces a destination pointing at nobody.
const RIVAL_AVOID_CHANCE = 0.75;
const CLIQUE_APPROACH_CHANCE = 0.6;

// 26 Aug 2026, Build Plan §24 — cross-room wandering. Roaming/encounters
// have been Rec-Room-bound since §17.3, even after the map grew to all
// seven rooms in Phase 2 (§10) — nobody has ever walked through a door on
// their own. Maxime, closing out §23's report: "yah once we are testing
// the hub later when its more full of stuff and near finish" — a fuller
// hub only reads as fuller if NPCs actually use the rest of it, and this
// is also what finally lets someone reach Berths for real (Ask Out's own
// still-open gating gap, flagged since §17.2 — nobody currently ever walks
// there). Placeholder chance, same "not tuned" caveat as every other
// weight in this file — deliberately lower than RIVAL_AVOID_CHANCE/
// CLIQUE_APPROACH_CHANCE above, since leaving the room entirely should
// read as an occasional errand, not the default response to being idle.
// Rolled ahead of (and independent from) the same-room logic below — see
// updateNpcRoaming's own body for why it has to come first rather than
// after the "nobody else here" bail-out.
const EXPLORE_CHANCE = 0.15;
// A door's own (toX, toY) is one fixed point; landing NPCs a real distance
// away from it, in a random direction (completeDoorHop's own comment has
// the full deadlock story this fixes), spreads simultaneous arrivals out
// instead of stacking them on the identical pixel.
const DOOR_LANDING_JITTER_DIST = 30;
// Hub polish, 26 Aug 2026 — hardens the residual risk §24 itself already
// flagged ("doesn't make a collision mathematically impossible... a real,
// honest residual risk, not swept away"). Measured, not guessed: a Monte
// Carlo check (200,000 trials, tools/measure_door_jitter.ts, not shipped)
// put a single DOOR_LANDING_JITTER_DIST draw at ~35.7% collide odds
// whenever two NPCs land at the same door close together — real enough to
// hit in ordinary play. pickDoorLanding below re-rolls (rejection
// sampling) against every NPC already in the destination room, up to this
// many tries, instead of accepting the first draw — independent ~35.7%
// odds per try means DOOR_LANDING_MAX_ATTEMPTS in a row all colliding is
// under 0.1% at 5 tries.
const DOOR_LANDING_MAX_ATTEMPTS = 5;

// Hub polish, 26 Aug 2026 — closes the gap §25 flagged in its own closing
// note: Ask Out is gated to Berths, but nothing biased an explore roll
// toward it, so an NPC had to independently roll EXPLORE_CHANCE, then land
// on Berths uniformly at random out of six rooms, and still be there when
// the player walked in — "basically never available" in practice. Not a
// mechanism built for Ask Out specifically: it's a realism fix (personal
// quarters plausibly get more off-duty idle time than a task-specific room
// like the Workshop or CIC) that happens to close that gap as a side
// effect. Weighted instead of uniform — every non-current room keeps an
// equal baseline share of 1, Berths alone gets BERTHS_EXPLORE_WEIGHT — so
// it's meaningfully more likely without being guaranteed. Placeholder
// number, same "not tuned" caveat as EXPLORE_CHANCE and every other weight
// in this file.
const BERTHS_EXPLORE_WEIGHT = 3;

// Off-Duty Needs Counter, 28 Aug 2026 (spec §4: "an NPC below a meter's
// threshold should roam toward the matching room more often, not just by
// the existing flat weight") — an extra weighted-bag bump toward
// `biasRoom` (worstNeed/NEED_ROOM, data/needsCounter.ts) on top of
// whatever that room's baseline weight already was. Stacks with
// BERTHS_EXPLORE_WEIGHT rather than replacing it — a below-threshold-sleep
// NPC gets Berths' existing romance-context bump AND this one at once, not
// one or the other. Placeholder magnitude, same "not tuned" caveat as
// BERTHS_EXPLORE_WEIGHT itself.
const NEEDS_ROAM_WEIGHT_BONUS = 3;

// Weighted pick among every room but fromRoom — Berths counted
// BERTHS_EXPLORE_WEIGHT times, everyone else once, plus NEEDS_ROAM_WEIGHT_BONUS
// more for `biasRoom` if one's passed. A plain weighted-bag approach rather
// than a probability table: cheap, obviously correct, and consistent with
// how small this room count is (six candidates, tops).
function pickExploreTarget(fromRoom: RoomId, biasRoom?: RoomId): RoomId {
  const otherRooms = (Object.keys(ROOM_TITLES) as RoomId[]).filter((r) => r !== fromRoom);
  const weighted: RoomId[] = [];
  for (const r of otherRooms) {
    let weight = r === "berths" ? BERTHS_EXPLORE_WEIGHT : 1;
    if (r === biasRoom) weight += NEEDS_ROAM_WEIGHT_BONUS;
    for (let i = 0; i < weight; i++) weighted.push(r);
  }
  return weighted[Math.floor(Math.random() * weighted.length)];
}

// Social history view, 26 Aug 2026 — how many of a socialLog's own entries
// the overlay shows at once. A display cap, not a data cap (see
// renderHistory's own comment) — placeholder number, same "not tuned"
// caveat as every other cap/weight in this file.
const HISTORY_ENTRY_LIMIT = 8;

// A coarse, human-readable "how long ago" — exact-to-the-minute precision
// isn't the point for a social log (nobody needs to know an interaction
// happened at 14:32:07 versus 14:33:02), and this avoids pulling in a
// date-formatting dependency for one label.
function historyTimeLabel(at: number): string {
  const minutes = Math.floor((Date.now() - at) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Real calendar date/time, down to the second — Maxime, 28 Aug 2026,
// specifically for the Highlights reel: "highlight reel should date
// itself with calandar. down to the sec." Deliberately separate from
// historyTimeLabel just above rather than a shared/renamed function: the
// two panels stay on their own established conventions — renderHistory's
// relative "3d ago" labels are untouched, this is scoped to
// renderHighlights only, which is the panel actually named in the ask.
// Hand-formatted (getFullYear/getMonth/etc.) rather than toLocaleString —
// same reasoning every other display string in this file avoids locale-
// dependent formatting: deterministic output regardless of the machine's
// locale settings, real calendar precision either way.
function calendarTimeLabel(at: number): string {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// 26 Aug 2026 — the missing other half of autonomous roaming: two NPCs
// closing distance used to mean nothing once they arrived. An idle
// (targetX undefined — not mid-walk to anywhere else), same-room, close-
// enough pair whose own cooldowns have both elapsed runs one real
// engine/socialSim.ts encounter — same logic runSocialSim.ts's CLI already
// drives headless, now shown live as a bubble instead of a log line. See
// updateNpcEncounters()/runNpcEncounter() below. Placeholder numbers, same
// "not a locked number" caveat as every other timing constant in this
// scene. ENCOUNTER_RADIUS is deliberately a bit more generous than
// ROAM_APPROACH_DIST (the distance roaming itself aims for) — two NPCs
// converging from different directions don't always end up exactly
// ROAM_APPROACH_DIST apart, and this only needs to catch "clearly
// hanging out together," not pixel-perfect proximity. The cooldown is
// longer than ROAM_INTERVAL so a settled, clustered pair has real visible
// silence between encounters rather than replaying one every few seconds.
const ENCOUNTER_RADIUS = 90;
const ENCOUNTER_COOLDOWN_MIN_MS = 12000;
const ENCOUNTER_COOLDOWN_MAX_MS = 22000;

// Live-visual staging, 26 Aug 2026 — Maxime: "we go ham bro" on the "full
// live-Hub-visual NPC-to-NPC feature" this file's own header already
// named as an acknowledged future goal. Gap between npcA's opening line
// and npcB's reply bubble — long enough to actually read npcA's line
// first (matches showBubble's own duration floor, 2600ms minimum), short
// enough that it still reads as one continuous exchange rather than two
// unrelated barks. Placeholder, same "not a locked number" caveat as
// every other timing constant in this file.
const NPC_REPLY_DELAY_MS = 1800;

// Rec Room Help Panel, 28 Aug 2026 (Bloom_Wars_Rec_Room_Help_Panel_Plan_v1.md)
// — persistent "?" rules text per minigame, always available (Maxime's own
// call: not a first-time tooltip that dismisses itself, the pattern the
// Mission 1 combat tutorial hints use — a control the player can reopen
// any time, every session). Draft copy is the plan doc's own, lightly
// reflowed to fit the panel's wordWrap width; still a draft per that
// doc's own "worth a pass once it's actually readable at the modal's real
// size" note, not re-litigated here.
const PEG_BOARD_RULES_TEXT =
  "THE PEG BOARD\n\n" +
  "Nine dots in a 3x3 grid. You and your opponent each draw one line per turn, connecting two dots that don't already have a line between them.\n\n" +
  "Your first line is fixed — you don't get to choose it. After that, every line you draw has to start from wherever your last line ended. Your lines have to form one continuous path.\n\n" +
  "Lines can never cross an existing line — yours or your opponent's.\n\n" +
  "REACH: if your last two lines form a bend through three dots, you're threatening to win. Your opponent gets exactly one move — closing the triangle — to stop it. If they can't (the closing line would cross something already down), you win on the spot.\n\n" +
  "KNOT: land three of your own lines on a single dot and it locks — nobody can draw through it again, for either side, for the rest of the game.\n\n" +
  "If the board fills up and nobody's completed a Reach, whoever has more Knots wins. Equal Knots, it's a draw.";

const POKER_RULES_TEXT =
  "POKER — TEXAS HOLD'EM\n\n" +
  "You and your opponent are each dealt two hole cards face down; five community cards come out face up in stages (flop, turn, river), shared by both of you. Best five-card hand out of your two plus the five shared wins.\n\n" +
  "Betting happens after each stage — fold, check, call, or raise. Folding ends the hand immediately and hands the pot to whoever didn't fold; your cards stay hidden either way.";

const DARTS_RULES_TEXT =
  "FLETCHERS — DARTS\n\n" +
  "Three rounds, three darts each, you and your opponent alternating whole rounds. Highest total after all darts are thrown wins; a tie is a draw.\n\n" +
  "Each throw: a marker sweeps back and forth across a bar. Time your click (or press E) to lock it — the closer to center, the better your aim. Landing dead center doesn't perfectly guarantee a bullseye (your hand isn't that steady), but it gets you close, and a bad lock reliably misses.\n\n" +
  "SCORING: bullseye (50), inner ring (30), mid ring (20), outer ring (10), miss (0).";

// The peg board — Rec Room minigame #3 of 3, 26 Aug 2026. See
// src/engine/pegBoard.ts's own header for the ruleset/naming-lock
// discipline; this is only the interactive click-based board on top of
// that pure engine. The engine's side "a" is always the one with the
// auto-applied locked opening (nothing to click for it); the human is
// always side "b" here.
const PEG_CENTER = { x: 480, y: 330 };
const PEG_SPACING = 95;
const PEG_DOT_RADIUS = 9;
const PEG_ZONE_RADIUS = 26; // generous click target, well clear of neighboring dots at PEG_SPACING
const PEG_PLAYER_COLOR = 0x4a7a9a; // matches ACCENT
const PEG_AI_COLOR = 0xb85c38;
const PEG_DOT_COLOR = 0x8a97a6;
const PEG_LOCKED_COLOR = 0x5a3a3a;
const PEG_HUMAN_SIDE = "b";
const PEG_AI_SIDE = "a";

function pegDotPixel(id: number): { x: number; y: number } {
  const col = id % 3;
  const row = Math.floor(id / 3);
  return { x: PEG_CENTER.x + (col - 1) * PEG_SPACING, y: PEG_CENTER.y + (row - 1) * PEG_SPACING };
}

// Poker — Rec Room minigame #2 of 3 to ship (Fletchers still unbuilt), 26
// Aug 2026. Texas Hold'em specifically (Maxime: "pker is the texas
// version"), real interactive UI on top of the pure engine
// (src/engine/holdem.ts, itself built on the generic src/engine/cardTable/
// substrate — Maxime's own "generic card-table shape now" call, made so a
// future second card game is cheaper to add than Hold'em was). No
// bet-sizing slider this pass — a minimum legal raise and an all-in cover
// the real decisions without needing a drag/text-entry control; a cash-
// game-style fixed stack/blinds sitting, not an escalating tournament
// (see holdem.ts's own header for the full scope note).
const POKER_STATUS_Y = ROOM_BOUNDS.top + 48;
const POKER_POT_Y = ROOM_BOUNDS.top + 78;
const POKER_AI_ROW_Y = ROOM_BOUNDS.top + 132;
const POKER_COMMUNITY_Y = ROOM_BOUNDS.top + 210;
const POKER_HUMAN_ROW_Y = ROOM_BOUNDS.top + 288;
const POKER_BUTTON_Y = ROOM_BOUNDS.top + 358;
const POKER_CARD_GAP = 46;
const POKER_CARD_BACK = "#232a33"; // face-down / not-yet-dealt slot
const POKER_CARD_FACE = "#e8e2d4";
const POKER_RED_SUIT = "#8a2b2b";
const POKER_BLACK_SUIT = "#20242b";
const STREET_LABEL: Record<HoldemGameState["street"], string> = { preflop: "Preflop", flop: "The Flop", turn: "The Turn", river: "The River" };

function pokerRowSlots(y: number, count: number): { x: number; y: number }[] {
  const startX = 480 - ((count - 1) * POKER_CARD_GAP) / 2;
  return Array.from({ length: count }, (_, i) => ({ x: startX + i * POKER_CARD_GAP, y }));
}

// Fletchers (darts) — Rec Room minigame #3 of 3, and the last one to ship,
// 26 Aug 2026. See src/engine/darts.ts's own header for the design
// history (Maxime's P5R reference, then "the dart is a zone in the rec
// room" plus a separate "dart" locking the mechanic). Lives inside Rec
// Room as its own drawn zone, same as the peg board's table and Poker's
// felt — not a new walkable room. Real rules/AI live in darts.ts; this is
// purely rendering + input, same division of labor as the two sections
// above it. The aim meter's sweep itself (a value continuously bouncing
// 0..1..0 that the player locks near the favorable end) is genuinely new
// here — neither the peg board nor Poker had a live-timing mechanic, both
// resolve on a single click/turn.
const DARTS_BOARD_CENTER = { x: 480, y: ROOM_BOUNDS.top + 132 };
const DARTS_BOARD_RADIUS = 68;
const DARTS_STATUS_Y = ROOM_BOUNDS.top + 224;
const DARTS_RESULT_Y = ROOM_BOUNDS.top + 246;
const DARTS_SCORE_Y = ROOM_BOUNDS.top + 268;
const DARTS_METER_Y = ROOM_BOUNDS.top + 306;
const DARTS_METER_LEFT = 300;
const DARTS_METER_RIGHT = 660;
const DARTS_METER_HEIGHT = 14;
const DARTS_THROW_BUTTON_Y = ROOM_BOUNDS.top + 340;
const DARTS_METER_SPEED = 0.0045; // rad/ms — a full 0..1..0 sweep takes a bit under 1.4s
const DARTS_PLAYER_COLOR = 0x4a7a9a; // matches ACCENT/PEG_PLAYER_COLOR
const DARTS_AI_COLOR = 0xb85c38; // matches PEG_AI_COLOR
const DARTS_MISS_RING_COLOR = 0x2a323c;
// Graphics fills/strokes take a numeric color, not the CSS hex strings
// ACCENT/TEXT_MAIN already are — same numeric value, just re-expressed for
// Graphics's own API rather than introducing a real second color.
const DARTS_INNER_RING_COLOR = 0x4a7a9a; // == ACCENT
const DARTS_METER_MARKER_COLOR = 0xe8e2d4; // == TEXT_MAIN

// The meter's raw sweep position (0..1, left edge to right edge) maps to
// accuracy as distance from its own center — locking dead-center is a
// perfect 1.0, locking at either edge is 0. Kept as its own small pair of
// functions (not folded into darts.ts) since this mapping is pure
// UI/timing, not a rule the engine needs to know about.
function dartsMeterPos(elapsedMs: number): number {
  return (Math.sin(elapsedMs * DARTS_METER_SPEED) + 1) / 2;
}
function dartsAccuracyFromPos(pos: number): number {
  return 1 - Math.abs(pos - 0.5) * 2;
}

// Build Plan §9, piece #4's own room ("transporter pad is its own room")
// plus Antfarm §2/§11.3's five rooms + the grotto. "recroom" is Phase 1's
// original room, unchanged; the other six are new this pass.
type RoomId = "recroom" | "hangarDeck" | "workshop" | "vault" | "berths" | "cic" | "grotto";

const ROOM_TITLES: Record<RoomId, string> = {
  recroom: "REC ROOM",
  hangarDeck: "HANGAR DECK",
  workshop: "THE WORKSHOP",
  vault: "THE VAULT",
  berths: "BERTHS",
  cic: "CIC / BRIDGE",
  grotto: "THE GROTTO",
};

// Antfarm §2 (the five-room table) and §11.3 (the grotto) already give
// every one of these a real mechanical job — none of it is built here.
// An honest placeholder note per room, not a feature list, so an empty
// room reads as "not built yet" rather than "broken." recroom has none —
// it's the one room with real content already. grotto lost its own note
// the same way, 27 Aug 2026 — buildNpcs() seats a real CO there now
// (Arangement of Content), so "no CO exists yet" is stale; caught by a
// Playwright screenshot showing his name label overlapping this text.
const ROOM_NOTES: Partial<Record<RoomId, string>> = {
  hangarDeck: "Roster & deploy management still lives in the Campaign Shop for now.",
  workshop: "Gear, mek upgrades, carrier modules — still in the Campaign Shop.",
  vault: "Heirloom dedications belong here eventually. Nothing built yet.",
  berths: "Recruitment, romance, one-on-one scenes — not wired in yet.",
  cic: "Fire-support config, Energy allocation — not wired in yet.",
};

// The Antfarm Grid, v0 — 27 Aug 2026 ("start the antfarm... stress test the
// hub function in a real environment"). Full design in
// claude/Bloom_Wars_Antfarm_Grid_v1.md; that doc's own §6 leaves the real
// player-placement economy (tile costs, footprint upgrades, the tutorial
// that lets a player lay out their own starter set) explicitly unresolved
// ("im planing this out," Maxime's own words) — none of that is built here.
// What IS resolved and built: §3/§3a (top-down, bounded per-deck grid, no
// camera-follow rework — reuses ROOM_BOUNDS's existing single-box footprint
// for every deck, unchanged), §3c (three fixed decks, the grotto alone on
// the middle one), and §3f (within a deck, only stairs — and the bay,
// unchanged — are real press-E portals; everything else is one open,
// walkable floor, no door-per-room).
//
// Room-to-deck assignment below is MY placeholder split, not Maxime's
// design call — the doc leaves "which deck the other six rooms occupy" an
// open question (§3c). Easy to redraw once the real placement system
// exists, same "recommendation, not load-bearing" status the doc's own
// §11.1 bay-to-room mapping already carries. Recroom/Hangar Deck/Berths
// (the everyday crew spaces) went to the lower deck; Workshop/Vault/CIC
// (the more operational rooms) went to the upper deck — arbitrary but
// legible, and it keeps recroom's existing NPC seats and the bay/muster
// point exactly where they already are (see ROOM_ZONE_BOUNDS.recroom).
type DeckId = "lower" | "grotto" | "upper";

const ROOM_DECK: Record<RoomId, DeckId> = {
  recroom: "lower",
  hangarDeck: "lower",
  berths: "lower",
  grotto: "grotto",
  workshop: "upper",
  vault: "upper",
  cic: "upper",
};

const DECK_TITLES: Record<DeckId, string> = {
  lower: "LOWER DECK",
  grotto: "GROTTO DECK",
  upper: "UPPER DECK",
};

// Every room used to reuse the exact same ROOM_BOUNDS box as its own,
// private, discretely-swapped space (Phase 2's whole model). An open floor
// needs same-deck rooms to occupy genuinely distinct regions of ONE shared
// coordinate space instead — these are those regions. Lower and upper decks
// each tile ROOM_BOUNDS into a left column (the deck's "main" room, full
// height) and a right column split top/bottom between its other two rooms.
// The grotto deck has exactly one room, so it just gets the whole box —
// matching §3c's "insulated... middle deck to itself" framing. Recroom's
// existing NPC seats (buildNpcs) and MUSTER_POINT already sit inside
// recroom's own slice here without needing to move.
const ZONE_SPLIT_X = 550;
const ZONE_SPLIT_Y = 330;

// The egg hull, first pass — 27 Aug 2026. Maxime: "lets build us an egg
// shape 3 layered cake of a ship with preplaned space for each buildable
// room and more room to expand," then, asked to choose between an
// outline-only version and the real thing: "have fun take your take. do
// everything." This first pass gave that treatment to ONE of the three
// decks — see the comment on LOWER_BOUNDS/UPPER_BOUNDS below for the
// second pass, same day, that gives the other two real (if more modest)
// new floor too, without touching their existing rooms at all.
//
// Why the grotto got the dramatic version and the other two didn't:
// Upper and Lower's three rooms already tile ROOM_BOUNDS corner-to-corner
// with zero spare pixels (see ROOM_ZONE_BOUNDS just below — the left
// column plus the two right rows add up to the exact same box, nothing
// left over). Swapping their movement clamp from that rectangle to a
// same-size ellipse would cut off those rooms' own corners — real,
// already-shipped, already-tested floor the player can stand on today — a
// regression, not a redesign. The grotto has no such conflict: its "zone"
// has only ever BEEN the whole box, and Bloom_Wars_Antfarm_Grid_v1.md §3c
// already frames it as the deck "insulated... to itself," the one the
// design docs themselves point to as where the ship has room to grow. So
// the grotto gets pushed out into genuinely empty screen margin and
// reshaped into a real ellipse; Upper and Lower's existing 700×444
// rectangles are never resized or reshaped — see below for how they still
// get real new floor without touching that rectangle at all.
const GROTTO_BOUNDS = {
  // Right stays at ROOM_BOUNDS.right (830) — CHAT_LOG_X sits 8px past it,
  // so there's no free margin on that side without relocating the chat
  // panel, a separate change this pass doesn't make.
  left: 40, // clear of both fixed-position corner texts (16,20)/(16,80) at y<=85, well above this deck's own top below
  right: ROOM_BOUNDS.right,
  // deckIndicatorText sits at (16, 80); this deck's zone doesn't start
  // until x=40, but the text's own 10px height (y 75-85) is the real
  // constraint on how far up ANY deck's floor can safely reach. 100 leaves
  // it clear with room to spare.
  top: 100,
  // interactPrompt is fixed at (480, ROOM_BOUNDS.bottom + 20) = (480, 572)
  // regardless of deck; 566 keeps this deck's floor a clean 6px short of
  // it. BACK TO HANGAR's footer button starts at y=588 — well clear either
  // way.
  bottom: 566,
};
const GROTTO_ELLIPSE = {
  cx: (GROTTO_BOUNDS.left + GROTTO_BOUNDS.right) / 2,
  cy: (GROTTO_BOUNDS.top + GROTTO_BOUNDS.bottom) / 2,
  rx: (GROTTO_BOUNDS.right - GROTTO_BOUNDS.left) / 2,
  ry: (GROTTO_BOUNDS.bottom - GROTTO_BOUNDS.top) / 2,
};

// The egg hull, second pass, same day — 27 Aug 2026. Maxime, asked whether
// to stop at the grotto or keep going and give Upper/Lower the reserved-bay
// space from the hull proposal too: "keep going now." The key realization
// that makes this safe, unlike the ellipse swap above: Upper and Lower's
// screen-margin constraints are IDENTICAL to the grotto's (all three decks
// reuse the same on-screen region, one at a time) — what made an ellipse
// unsafe there was RESHAPING their existing rectangle, not the idea of
// having more space at all. So this doesn't touch ROOM_ZONE_BOUNDS or
// either deck's three existing rooms in any way — it only makes the
// OUTER walkable box each deck's rectangle sits inside strictly BIGGER,
// bolting new floor onto the left/top/bottom (the same margin the grotto
// used), for the two reserved-bay markers below to stand on. A bigger
// superset can never make an already-reachable point unreachable, so
// there's no version of the corner-cutting problem here — confirmed by
// the full pre-existing suite passing unchanged (checked again after this
// second pass, not just the first).
//
// Left edges differ slightly per deck (40/50/60) to keep a little of the
// egg's own taper — grotto (middle, widest) got the most margin, Lower
// (base) a bit less, Upper (crown, narrowest) the least — though with only
// ~90px of real slack on screen to work with, the visible difference is
// modest, not dramatic; said plainly rather than oversold.
const LOWER_BOUNDS = { left: 50, right: ROOM_BOUNDS.right, top: GROTTO_BOUNDS.top, bottom: GROTTO_BOUNDS.bottom };
const UPPER_BOUNDS = { left: 60, right: ROOM_BOUNDS.right, top: GROTTO_BOUNDS.top, bottom: GROTTO_BOUNDS.bottom };

// Antfarm build economy, first slice, 27 Aug 2026 — Arangement of
// Content's own pilotId, hoisted here from buildNpcs() (where it's set
// when he's actually seated) so submitChat can gate build requests on
// "standing with the CO specifically" without either duplicating the
// literal string or reaching into buildNpcs's own local scope.
const CO_PILOT_ID = "npc_co";

interface ReservedBayDef {
  id: ReservedBayId;
  deck: DeckId;
  label: string;
  x: number;
  y: number;
}

// The two reserved bays per deck named in the hull proposal — Sensor Array
// + Beacon Control on Upper, Generator + Restock Room on Lower, both from
// Bloom_Wars_Antfarm_Carrier_Hub_v1.md §11.2's own twelve-bay list.
// Deliberately visual-only markers, not real rooms: no RoomId, no
// ROOM_NOTES, no door, no minigame — "reserved" means exactly that, a
// placeholder for wherever the real player-placement economy (still fully
// unbuilt — Antfarm Grid §3b/§3d/§3e/§6) eventually lets a player build one
// of these for real. Positioned inside the new LOWER_BOUNDS/UPPER_BOUNDS
// margin strip, at x < ROOM_BOUNDS.left (130) — nothing could ever stand
// there before this pass, so placement here can't collide with anything
// that already existed.
// weaponsBay/fabricator added 28 Aug 2026, second slice — one more marker
// per deck, dropped into the untouched gap between the original pair's
// y=200/y=450 (250px apart; a third marker at the midpoint sits 125px from
// each neighbor, well clear of the 40px-tall marker box drawn by
// drawReservedBayOutline). Same x as that deck's existing pair — the
// margin strip's width was already sized for one column of markers, not a
// second, so a new column isn't needed. Unlike the original four, these
// two aren't purely visual — see engine/mission.ts's weaponsBayBuilt and
// engine/campaignEconomy.ts's fabricatorMaxSpareParts for the real effects
// building them now has.
const RESERVED_BAYS: ReservedBayDef[] = [
  { id: "sensorArray", deck: "upper", label: "SENSOR\nARRAY\n(reserved)", x: 95, y: 200 },
  { id: "beaconControl", deck: "upper", label: "BEACON\nCONTROL\n(reserved)", x: 95, y: 450 },
  { id: "weaponsBay", deck: "upper", label: "WEAPONS\nBAY\n(reserved)", x: 95, y: 325 },
  { id: "generator", deck: "lower", label: "GENERATOR\n(reserved)", x: 90, y: 200 },
  { id: "restockRoom", deck: "lower", label: "RESTOCK\nROOM\n(reserved)", x: 90, y: 450 },
  { id: "fabricator", deck: "lower", label: "FABRICATOR\n(reserved)", x: 90, y: 325 },
];

// Antfarm build economy, first slice, 27 Aug 2026 — the reserved markers
// above stop being visual-only: talking to the CO and asking for one of
// these four now actually builds it (see submitChat/handleBuildRequest).
// Every number below is a placeholder, same footing as every other unset
// balance figure in this project (Energy's cap, Stress's math, the peg
// game's turn counts) — reuses the campaign's existing shared `points`
// pool rather than a new currency (AskUserQuestion, 27 Aug 2026: "reuse
// existing points" over inventing a fifth resource). Generator priced a
// little above the other three since Carrier Hub §11.2 already flags it
// as the bay everything else plausibly needs built first.
// weaponsBay/fabricator (28 Aug 2026) priced the same first-pass-placeholder
// way as the original four: weaponsBay a shade above the 110 baseline,
// alongside generator, since it's the one bay in this pass that moves a
// real combat number (a bonus Fire Support charge) rather than a purely
// economic one; fabricator stays at the 110 baseline, same footing as
// restockRoom's own logistics role. Neither number has been through
// combat_sim.py or any equivalent — needs real playtesting once these are
// actually reachable in a run, same caveat as every other figure here.
const BAY_BUILD_COST: Record<ReservedBayId, number> = {
  generator: 140,
  sensorArray: 110,
  beaconControl: 110,
  restockRoom: 110,
  weaponsBay: 130,
  fabricator: 110,
};

// Scaled down from Carrier Hub §12.1's own three-tier rank/space table
// (2-3 bay slots at 2nd Lt., "medium" at Capt., "full" — the whole
// twelve-bay grid — at Maj.). That table was sized for the eventual full
// twelve-bay grid; with only these four bays actually buildable this
// pass, the same small/medium/full shape lands on 1/3/4 instead of
// 2-3/~6/12. Confirmed direction (AskUserQuestion, 27 Aug 2026: reuse
// §12's rank gating rather than design fresh numbers for a literal grid)
// — the specific integers here are still a first-pass placeholder, same
// "flagged, not locked" footing §12.1's own table carries.
// Bumped 28 Aug 2026 when RESERVED_BAYS grew from 4 to 6 (weaponsBay/
// fabricator). "maj = full" is the load-bearing invariant from the comment
// above (Major unlocks the entire grid this pass actually has), so maj
// tracks RESERVED_BAYS.length exactly rather than staying at the old
// literal 4. capt keeps roughly its old 3-of-4 (75%) share, rounded down
// against the new total of 6 rather than re-derived from scratch — still a
// first-pass placeholder, not re-litigated here.
const RANK_BAY_SLOTS: Record<Rank, number> = {
  "2nd_lt": 1,
  capt: 4,
  maj: 6,
};

const ROOM_ZONE_BOUNDS: Record<RoomId, { left: number; right: number; top: number; bottom: number }> = {
  recroom: { left: ROOM_BOUNDS.left, right: ZONE_SPLIT_X, top: ROOM_BOUNDS.top, bottom: ROOM_BOUNDS.bottom },
  hangarDeck: { left: ZONE_SPLIT_X, right: ROOM_BOUNDS.right, top: ROOM_BOUNDS.top, bottom: ZONE_SPLIT_Y },
  berths: { left: ZONE_SPLIT_X, right: ROOM_BOUNDS.right, top: ZONE_SPLIT_Y, bottom: ROOM_BOUNDS.bottom },
  // The egg hull, 27 Aug 2026 — GROTTO_BOUNDS, not ROOM_BOUNDS: this deck's
  // real floor is now bigger than (and off-center from) the shared box
  // every other room still uses. zoneAt only needs this as a bounding-box
  // membership test (see its own comment on the rectangle-vs-ellipse
  // distinction not mattering there), so the rectangle here being a loose
  // superset of the true elliptical floor is fine — nothing can actually
  // stand in the rectangle's corners, since movement is clamped to the
  // ellipse, not this rect.
  grotto: { left: GROTTO_BOUNDS.left, right: GROTTO_BOUNDS.right, top: GROTTO_BOUNDS.top, bottom: GROTTO_BOUNDS.bottom },
  workshop: { left: ROOM_BOUNDS.left, right: ZONE_SPLIT_X, top: ROOM_BOUNDS.top, bottom: ROOM_BOUNDS.bottom },
  vault: { left: ZONE_SPLIT_X, right: ROOM_BOUNDS.right, top: ROOM_BOUNDS.top, bottom: ZONE_SPLIT_Y },
  cic: { left: ZONE_SPLIT_X, right: ROOM_BOUNDS.right, top: ZONE_SPLIT_Y, bottom: ROOM_BOUNDS.bottom },
};

function sameDeck(a: RoomId, b: RoomId): boolean {
  return ROOM_DECK[a] === ROOM_DECK[b];
}

// Which of this deck's rooms a raw (x, y) currently sits over — used to keep
// currentRoomId / npc.room live as a position label while walking a shared
// open floor, instead of only ever changing on a door press. Falls back to
// the deck's own "main" room (the first RoomId found on that deck, which is
// always the left/full-height column per ROOM_ZONE_BOUNDS above) if a point
// somehow lands outside every zone rect — shouldn't happen since the rects
// above fully tile each deck's box, but a live-recomputed label needs
// somewhere safe to fall back to rather than throwing.
function zoneAt(deck: DeckId, x: number, y: number): RoomId {
  for (const id of Object.keys(ROOM_ZONE_BOUNDS) as RoomId[]) {
    if (ROOM_DECK[id] !== deck) continue;
    const b = ROOM_ZONE_BOUNDS[id];
    if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) return id;
  }
  return (Object.keys(ROOM_DECK) as RoomId[]).find((id) => ROOM_DECK[id] === deck)!;
}

// The one place player/NPC movement decides which floor shape/size actually
// applies for the deck they're on — grotto gets the real ellipse
// (GROTTO_BOUNDS/GROTTO_ELLIPSE), Lower and Upper get their own bigger
// rectangle (LOWER_BOUNDS/UPPER_BOUNDS, a strict superset of the old shared
// ROOM_BOUNDS both decks' three existing rooms still use unchanged — see
// the egg-hull comments above for why a bigger rectangle is safe where a
// same-size ellipse wasn't). Every one of tryMove/tryMoveNpc/
// completeDoorHop's landing clamp/updateNpcRoaming's two target-clamp
// sites goes through this now instead of inlining Phaser.Math.Clamp
// against ROOM_BOUNDS directly, so there's exactly one place that ever
// needs to change if a deck's floor shape changes again later.
function clampToDeckFloor(deck: DeckId, x: number, y: number, radius: number): { x: number; y: number } {
  if (deck === "grotto") {
    const rectClamped = {
      x: Phaser.Math.Clamp(x, GROTTO_BOUNDS.left + radius, GROTTO_BOUNDS.right - radius),
      y: Phaser.Math.Clamp(y, GROTTO_BOUNDS.top + radius, GROTTO_BOUNDS.bottom - radius),
    };
    return clampToEllipse(rectClamped.x, rectClamped.y, GROTTO_ELLIPSE.cx, GROTTO_ELLIPSE.cy, GROTTO_ELLIPSE.rx, GROTTO_ELLIPSE.ry, radius);
  }
  const bounds = deck === "lower" ? LOWER_BOUNDS : UPPER_BOUNDS;
  return {
    x: Phaser.Math.Clamp(x, bounds.left + radius, bounds.right - radius),
    y: Phaser.Math.Clamp(y, bounds.top + radius, bounds.bottom - radius),
  };
}

// Experimental, 25 Aug 2026 — Maxime: "can you check if its possible to get
// a single guy angry and have his answer trigger a wave of conversation
// across the hub as the npc play telephone with each other." Started as a
// forced-anger-only prototype; generalized the same day once Maxime named
// two more concrete uses for the same mechanism ("cmon guys to the bay,
// we are heading out to mission" and "mc asked someone out and got
// rejected, everyone will know it") — carries any HubMessage now
// (ambientLines.ts), not just an emotion. Still NOT part of Phase 1's
// locked spec (Build Plan §4) — an extra layer bolted onto the sound-range
// machinery, same spirit as the rest of this file's own De-risking Note.
// Still local/demo, not wired to a real Favorability store, real NPC
// movement, or a real chat UI — see the Build Plan doc's §9 for the pieces
// this deliberately does not include (per Maxime, same day: "keep to the
// plan").
const PROPAGATION_RADIUS = 280; // NPC-to-NPC earshot — wider than TALK_RADIUS so a message can skip past whoever's out of the source's own direct range but still needs an intermediary to relay it
const PROPAGATION_MAX_HOPS = 5;
const PROPAGATION_CATCH_BASE = 0.75; // chance the next hop's listener actually reacts at all
const PROPAGATION_CATCH_DECAY = 0.82; // multiplied in per hop — the wave fizzles the farther it travels
const PROPAGATION_DISTORT_CHANCE = 0.3; // chance the passed-along message mutates instead of staying true, per hop — see ambientLines.ts's distortMessage for what that means per message kind
const PROPAGATION_HOP_DELAY_MS = 700;

// Build Plan §9, piece #2, 26 Aug 2026 — "do what's next" after piece #1
// shipped. Flagged in that doc as genuinely new engineering (basic NPC
// movement), not a small extension, so keeping this slice narrow and
// literal rather than building the fuller Phase-3 roaming/cliques system:
// an NPC that catches a MUSTER message (and only that kind — an emotion or
// a rumor never moves anyone) walks to MUSTER_POINT and stops. That's
// "the troop will assemble... on their own," and nothing past it — no
// general-purpose pathing/AI (still Phase 3). Movement reuses the same
// axis-separated, clamp-then-circle-collision approach the player already
// uses (tryMove) rather than inventing a second movement model. Rec-Room-
// only, same as every NPC in this pass — see the file header's own note on
// not moving/reassigning named pilots as part of the map growth below.
const MUSTER_POINT = { x: 480, y: ROOM_BOUNDS.bottom - 50 };
const NPC_WALK_SPEED = 90; // px/sec — slower than the player's 190; this is "heading to muster," not urgent
const NPC_ARRIVE_THRESHOLD = 5;
// 26 Aug 2026 — found verifying the new live encounters (updateNpcEncounters
// below), not caused by them: a real, pre-existing deadlock in this already-
// shipped movement code. Two NPCs both roaming toward a point near each
// other's CURRENT position (updateNpcRoaming) can converge on a target that
// goes stale mid-walk — the bond partner moved too, and now stands
// collision-blocking the last few pixels of the route. Without this, that
// pair freezes forever: dist-to-target never drops to NPC_ARRIVE_THRESHOLD,
// targetX never clears, and updateNpcRoaming's own "already has a target,
// leave it alone" gate means neither NPC ever reconsiders either. See
// updateNpcMovement's own stuckMs tracking below for the fix: zero net
// progress for this long gets treated as arrived (close enough, blocked,
// give up) instead of waiting forever for a gap that was never going to
// open.
const STUCK_TIMEOUT_MS = 500;

// Build Plan §9, piece #4, 26 Aug 2026 — "transporter pad is its own room"
// / "something player dont need to build" (Maxime). Resolves the doc's own
// open question about whether launching a mission from the Hub replaces or
// sits beside the existing MapSelect -> TransporterPad -> BEAM DOWN flow:
// sits beside. This does NOT invent a "next mission" resolver — MapSelect
// itself has no locked-progression concept to hook into (any mission is
// replayable any time, per its own header comment), so a specific mission
// still gets chosen there exactly as it always has. The bay is just a door
// back to that existing screen, not a new mission-selection system — the
// literal reading of "nothing to build." Reuses the already-drawn
// MUSTER_POINT marker (piece #2) as that door rather than adding a second
// destination; walking a mustered NPC there and walking the PLAYER there
// are now two different, independent uses of the same point on the map.
// Rec-Room-only, same as everything else that's Rec-Room-specific below.
const BAY_RADIUS = 60; // how close the player has to be to trigger the E-to-deploy prompt

// Antfarm Grid v0, 27 Aug 2026 — DOORS used to hold twelve entries, a door
// between Rec Room and each of the other six rooms. Every one of those is
// gone now: those six rooms are split across the lower/upper decks (see
// ROOM_DECK above), and per §3f, rooms sharing a deck are one continuous
// open floor — no door, no scene-swap, just walking. What DOORS holds now
// is the only thing that's still a real press-E portal within this scene:
// the stairs between decks, same trigger mechanism (E to use it, same
// interact prompt) the old room-to-room doors already used, just crossing
// a deck boundary instead of a room one. Same DOOR_RADIUS/DoorDef shape —
// a stair is structurally just a door whose toRoom happens to sit on a
// different deck.
const DOOR_RADIUS = 45;

type DoorDef = {
  id: string;
  room: RoomId; // which room this door's trigger point sits in
  x: number;
  y: number;
  toRoom: RoomId;
  toX: number; // where the player lands in toRoom
  toY: number;
  label: string; // shown in the interact prompt and on the door's own marker
};

// Landing points are placed with real clearance from the destination's own
// stair marker (same DOOR_RADIUS-clearance convention the old room doors
// already used) and, on the grotto deck specifically, from BOTH of its own
// stairs — recroom's seats/MUSTER_POINT and workshop's own layout are
// otherwise untouched by any of this, see ROOM_ZONE_BOUNDS above.
const DOORS: DoorDef[] = [
  { id: "recroom-to-grotto", room: "recroom", x: 480, y: ROOM_BOUNDS.top + 22, toRoom: "grotto", toX: 480, toY: 470, label: "THE GROTTO" },
  { id: "grotto-to-recroom", room: "grotto", x: 480, y: ROOM_BOUNDS.bottom - 22, toRoom: "recroom", toX: 480, toY: 170, label: "LOWER DECK" },
  { id: "grotto-to-workshop", room: "grotto", x: 480, y: ROOM_BOUNDS.top + 22, toRoom: "workshop", toX: 480, toY: 470, label: "UPPER DECK" },
  { id: "workshop-to-grotto", room: "workshop", x: 480, y: ROOM_BOUNDS.top + 22, toRoom: "grotto", toX: 480, toY: 300, label: "THE GROTTO" },
];

// 26 Aug 2026, Build Plan §24 — cross-room NPC wandering's own routing.
// Rewritten for the Antfarm Grid, 27 Aug 2026: used to rely on DOORS being
// a star with Rec Room at the center (every other room had exactly one
// door, straight back to Rec Room). That's gone — DOORS now only connects
// decks, not rooms — so this only ever fires for a genuinely cross-deck
// trip; two same-deck rooms need no door at all (open floor, the caller
// should just walk there directly — see updateNpcRoaming's own explore
// branch for that split). The three decks form a straight line, lower —
// grotto — upper, so routing is still just as cheap as before: from the
// lower or upper deck there's exactly one stair, straight to the grotto;
// from the grotto, pick whichever of its two stairs actually leads toward
// the target deck. Never more than two hops, same as the old star.
function nextHopDoor(fromRoom: RoomId, toRoom: RoomId): DoorDef | undefined {
  const fromDeck = ROOM_DECK[fromRoom];
  const toDeck = ROOM_DECK[toRoom];
  if (fromDeck === toDeck) return undefined; // same deck — open floor, no door to hop through
  if (fromDeck === "lower") return DOORS.find((d) => d.room === "recroom" && d.toRoom === "grotto");
  if (fromDeck === "upper") return DOORS.find((d) => d.room === "workshop" && d.toRoom === "grotto");
  return DOORS.find((d) => d.room === "grotto" && ROOM_DECK[d.toRoom] === toDeck);
}

// Hub polish, 26 Aug 2026 — see DOOR_LANDING_MAX_ATTEMPTS's own header for
// the measured collision odds this replaces a single draw with. Rejection
// sampling against every NPC already standing in the destination room —
// occupants is deliberately whoever's already there at the moment of the
// call, not a snapshot taken earlier, so a same-frame double-arrival (two
// NPCs completing a door hop on the identical update tick) still resolves
// correctly: whichever one's completeDoorHop runs second in that frame's
// loop sees the first one's real, just-placed position via this.npcs,
// since setNpcRoom updates it synchronously.
function pickDoorLanding(door: DoorDef, occupants: HubNpc[]): { x: number; y: number } {
  const center = { x: door.toX, y: door.toY };
  let point = pointNear(center, DOOR_LANDING_JITTER_DIST);
  for (let attempt = 0; attempt < DOOR_LANDING_MAX_ATTEMPTS; attempt++) {
    const collides = occupants.some((o) => Phaser.Math.Distance.Between(point.x, point.y, o.x, o.y) < NPC_R + NPC_R);
    if (!collides) break;
    point = pointNear(center, DOOR_LANDING_JITTER_DIST);
  }
  return point;
}

// Mission Worry, Hub polish, 26 Aug 2026 — Spitball Ideas, locked 25-26 Aug:
// crew left behind in the Hub worry about a crewmate currently out on a
// mission. Maxime's own resolving quote: "the worry goes paralel to
// mission time. it run until the player exit, what isnt saved is lost."
// That quote settles two things this function embodies directly:
//
// 1. Real wall-clock time, not in-fiction calendar time — the exact same
//    Date.now()-elapsed-time TECHNIQUE campaignState.ts §9's mission
//    real-time recall clock already uses (activeMissionAttempt.startedAt
//    vs. now), just a second, independent read of it. Zero changes to
//    campaignState.ts itself: activeMissionAttempt is already exported on
//    CampaignState, so this is a plain read of state this scene already
//    holds (this.campaignState), not new persisted state or a new field
//    on that file.
// 2. Never persisted — this is recomputed fresh every frame (see
//    updateMissionWorry() below) straight from activeMissionAttempt and
//    Date.now(), and never written to HubPilotSocialState/CampaignState
//    anywhere. Close the tab and it's really gone, same as the design
//    note requires — meaningfully less engineering than the mission clock
//    itself needed, since there's no Boot.ts-style catch-up to write.
//
// Worth confirming why this scenario is even real: doesn't finishing a
// mission clear activeMissionAttempt before the player could ever be back
// in the Hub to notice? Yes for a normal finish (Debrief.ts clears it) —
// but Boot.ts's own header spells out the other case this field exists
// for at all: an attempt that's still inside its 12-hour window "falls
// straight through to MapSelect exactly as before," meaning a player who
// beamed down, then left without finishing (closed the tab, backed out),
// can freely wander MapSelect/the Hub with that attempt still live in the
// background. That's the exact window this reads.
//
// WORRY_ONSET_MS is its own placeholder, same "not tuned" caveat as every
// other timing constant in this file — deliberately much shorter than
// MISSION_REAL_TIME_LIMIT_MS (12 real hours): that constant exists to
// catch an attempt abandoned for days, this one exists to notice within a
// single ordinary Hub session (minutes), a very different scale on
// purpose.
const WORRY_ONSET_MS = 60_000; // placeholder — 1 real minute

// Worry with real texture, first slice, 27 Aug 2026 — see
// data/missionWorry.ts's own header for the full design and the honest
// scope adaptation (closeness reads as favorability-with-Rourke, since no
// other "who's actually missing" data exists to read). How often
// updateMissionWorry() re-rolls a given NPC's probabilistic worried
// state — deliberately NOT every frame (a per-frame reroll would flicker
// on/off many times a second, which reads as noise, not a ramping mood).
// Placeholder, not tuned, same as every other timing constant on this line.
const WORRY_RECHECK_MS = 20_000; // 20 real seconds between rerolls, per NPC

// Off-Duty Needs Counter, 28 Aug 2026 — data/needsCounter.ts's own decay/
// restore numbers (NEEDS_DECAY_PER_MIN, NEEDS_RESTORE_PER_MIN) are both
// stated per real minute (spec §2), so this scene's own tick clock fires
// once a real minute too, same staggered-per-NPC shape as WORRY_RECHECK_MS
// just above. Placeholder, same "not tuned" caveat as every other timing
// constant on this line.
const NEEDS_TICK_INTERVAL_MS = 60_000;

// Hot topics, first slice, 27 Aug 2026 — see data/hotTopics.ts's own header
// for the full scope cut. Chance a given NPC leads with a fresh topic
// instead of their ordinary ambient line, checked in speak() below.
// Deliberately not 1.0: real gossip isn't guaranteed the instant you walk
// up, and a flat "always fires" would make it read as a scripted trigger
// rather than something the crew organically brings up. Placeholder, not
// tuned, same as every other constant on this line.
const HOT_TOPIC_SPEAK_CHANCE = 0.6;

// Relationship stages, first slice, 27 Aug 2026 — see
// data/relationshipStage.ts's own header. Chance a Talk with your own
// partner leads with a stage-flavored warm exchange instead of ordinary
// ambient — not 1.0, same "shouldn't read as a scripted trigger" reasoning
// HOT_TOPIC_SPEAK_CHANCE already carries.
const PARTNER_BANTER_CHANCE = 0.5;

function isMissionWorrySignal(state: CampaignState): boolean {
  const attempt = state.activeMissionAttempt;
  if (!attempt) return false;
  return Date.now() - attempt.startedAt >= WORRY_ONSET_MS;
}

// Build Plan §9, piece #3, 26 Aug 2026 — the real typed-chat entry point.
// Real design conversation behind this, not a default: Maxime ruled out a
// picklist ("a menu is rigid, I want flexibility"), named a live language
// model as the real target ("I ultimately want the chat bot to be able to
// react to typed chat"), then chose to build the rule-based version first
// once the actual cost of the alternatives was on the table — a live API
// needs a backend this project has never had, plus a running per-message
// bill; even a local, in-browser model is a multi-MB-to-GB download
// competing with the game's own frame loop for the player's CPU/GPU, and
// still needs a fallback since WebGPU isn't universal. "Lets build with
// longevity in mind" — see data/chatIntent.ts's own header for what that
// means concretely: this scene only ever calls interpretPlayerChat(text),
// never touches how the answer was produced, so swapping rule-matching for
// a real model later never touches this file.
const CHAT_BOX_Y = ROOM_BOUNDS.bottom + 44; // clear of both the interact prompt (ROOM_BOUNDS.bottom+20) and the far-left BACK TO HANGAR button

// Comms log panel — Hub polish, 26 Aug 2026. Maxime: "put a chat window to
// the side so player can read what they hear if they haven't caught it yet
// in game." Docked in the right-hand gutter — the strip between
// ROOM_BOUNDS.right (830) and the 960px canvas edge (main.ts's game
// config) is unused by anything else in this scene: every modal overlay
// (peg/poker/darts/history) draws its own background exactly
// ROOM_BOUNDS-wide, centered at x=480, never the full canvas — confirmed
// by reading each one before picking this spot, not assumed. That also
// means the log stays visible even while a minigame overlay is open,
// which is correct, not incidental: bystander chatter is still something
// you'd have heard.
const CHAT_LOG_X = ROOM_BOUNDS.right + 8;
const CHAT_LOG_WIDTH = 960 - 8 - CHAT_LOG_X;
const CHAT_LOG_CENTER_X = CHAT_LOG_X + CHAT_LOG_WIDTH / 2;
// Memory bound only, not a display cap — see chatLog's own field comment.
const CHAT_LOG_MAX_STORED = 40;
// Display cap — how many of the most recent entries actually get rendered.
// A real, hand-tuned placeholder: picked by rendering real LINE_BANK-length
// lines into the actual panel and checking the result fit inside
// ROOM_BOUNDS's own height without overflowing (see Build Log Addendum for
// the specific check), not a guessed number.
const CHAT_LOG_VISIBLE_LINES = 6;

const PANEL_BG = 0x1a2028;
const PANEL_BORDER = 0x3a4552;
const TEXT_MAIN = "#e8e2d4";
const TEXT_DIM = "#8a97a6";
const ACCENT = "#4a7a9a";

type HubNpc = {
  pilotId: string;
  displayName: string;
  initials: string;
  color: number;
  room: RoomId; // which room this NPC is physically in — every current NPC is "recroom" (see file header)
  x: number;
  y: number;
  ambient: AmbientPilotState;
  favorability: number; // persisted via CampaignState — see the file header's 26 Aug 2026 correction and campaignState.ts section 11
  circle: Phaser.GameObjects.Arc;
  root: Phaser.GameObjects.Container;
  favLabel: Phaser.GameObjects.Text;
  bubbleContainer: Phaser.GameObjects.Container;
  bubbleUntil: number;
  targetX?: number; // set = walking toward this point (piece #2); undefined = idle in place
  targetY?: number;
  // 26 Aug 2026 — updateNpcMovement's own stuck-timeout tracking (see
  // STUCK_TIMEOUT_MS's own comment for why this exists). Accumulated ms of
  // zero net progress toward the current target; reset to 0 on any real
  // movement or on arrival.
  stuckMs?: number;
  socialLog?: SocialLogEntry[]; // verb framework, 26 Aug 2026 — persisted via CampaignState as of the same day's later pass (see campaignState.ts section 11); this is the exact array reference buildNpcs() gets back from ensureHubSocialState(), not a scene-local copy
  // Phase 3 piece two, 26 Aug 2026 — romance.ts's own header covers the
  // design call (Favorability at high standing + a flag, not a second
  // track). Corrected same day: this used to be a hand-set boolean on
  // NPC_SEED (which wrongly had all three current NPCs as true — Iyari is
  // actually Hiopi, see NPC_SEED's own comment below). Now genuinely
  // data-driven — buildNpcs() derives it from the real WARDEN_PILOTS
  // archetype's species (units.ts's UNIT_ARCHETYPES) via
  // romance.ts's isRomanceableSpecies(), same discipline as PilotRecord's
  // own exemptFromPermadeath field, so this can't silently drift from
  // canon again the way it just did.
  romanceable: boolean;
  inRelationship?: boolean;
  // Phase 3 piece three, 26 Aug 2026 — autonomous roaming's own decision
  // clock (npcBonds.ts). Undefined until buildNpcs seeds a first,
  // staggered value; updateNpcRoaming reads/rewrites it each tick.
  nextRoamAt?: number;
  // 26 Aug 2026 — updateNpcEncounters' own cooldown clock, same staggered-
  // seed/reread-each-tick shape as nextRoamAt above but pairwise in effect
  // (both participants get a fresh one after an encounter fires).
  nextEncounterAt?: number;
  // Worry with real texture, first slice, 27 Aug 2026 — same staggered
  // per-NPC recheck clock shape as nextEncounterAt above, but for
  // updateMissionWorry()'s own probabilistic reroll. Not persisted, same
  // as ambient.worried itself.
  nextWorryCheckAt?: number;
  // 26 Aug 2026 — drunk's real expiry, epoch ms (Date.now()), mirroring
  // HubPilotSocialState.drunkUntil (campaignState.ts section 11). undefined
  // whenever ambient.drunk is false; set by shareADrink, cleared by
  // updateDrunkExpiry() the moment it elapses. ambient.drunk itself stays
  // the single boolean other systems (pickSoloEcho, reactionGate) already
  // read — this is only the timer deciding when that boolean flips back.
  drunkUntil?: number;
  // 26 Aug 2026, Build Plan §24 — cross-room wandering. Undefined = not
  // mid-journey. Set to a real destination RoomId the instant an idle roam
  // decision rolls EXPLORE_CHANCE (or, mid-journey, stays set across a
  // two-hop trip through Rec Room); cleared the moment npc.room reaches it.
  // While set, updateNpcRoaming skips the normal same-room clique/rival/
  // mingle branches entirely and just computes the next door to walk
  // through via nextHopDoor() instead.
  travelTargetRoom?: RoomId;
  // 27 Aug 2026 — Maxime: "the antfarmer need to stay near the bay when a
  // muster waiting until muster is done or cancelled." Before this, a
  // mustered NPC's stay at MUSTER_POINT lasted exactly until its own
  // nextRoamAt cooldown next fired — sendToMuster only ever set a target
  // to walk toward, nothing distinguished "arrived and holding" from
  // ordinary idle, so updateNpcRoaming would eventually send them
  // wandering off again like any other idle NPC. This flag is that
  // missing distinction: true from the moment a muster message reaches
  // this NPC (sendToMuster) until endMuster() releases them (deploy — the
  // muster's real end — or the debug M-key toggle standing in for a
  // cancel). While true, updateNpcRoaming skips this NPC outright, so
  // once they arrive at the bay they simply stay — no new roam/explore/
  // mingle target ever gets assigned to them until this clears.
  mustered?: boolean;
  // Stage-promotion "graduation" reveal, 27 Aug 2026 — set by buildNpcs()
  // when detectStagePromotion finds a real, unacknowledged Stage change;
  // consumed exactly once by speak()'s new branch, which shows the
  // special line instead of the ordinary ambient pool and clears this via
  // ackStagePromotion. Undefined the overwhelming majority of the time —
  // only set for the one Talk press right after a real promotion.
  pendingStagePromotion?: "blooded" | "command";
  // "Hello, Sir" rank-deference greeting, 27 Aug 2026 — same shape as
  // pendingStagePromotion just above, one axis over: set by buildNpcs()
  // when detectRankPromotion (data/ambientLines.ts) finds a real,
  // unacknowledged change in Rourke's OWN rank (engine/campaignState.ts's
  // rourkeRank), not this pilot's Stage. Consumed exactly once by speak(),
  // cleared via ackRankGreeting.
  pendingRankGreeting?: "capt" | "maj";
  // Off-Duty Needs Counter, 28 Aug 2026 (Bloom_Wars_Needs_Counter_Spec_v1,
  // Maxime's own build spec — item 1 of the Antfarm Réalisation plan's
  // Phase 1 gate, written under his "you'll make a lot of decisions for
  // me" latitude). Per-pilot, 0-100, 100 = fully fine, off-duty only. Not
  // persisted (spec §5 — same "ephemeral, gone on reload" choice Mission
  // Worry already made) — buildNpcs() reseeds every one of these to 100
  // every time this scene is (re)created, which is also what makes
  // "frozen while deployed" true for free: nothing ticks these while the
  // Hub scene itself isn't running (a live mission attempt runs in the
  // Battle scene instead), and a fresh 100 on return is the "resumes
  // decaying the moment they're back" the spec asked for, not a separate
  // freeze/resume mechanism.
  hunger: number;
  thirst: number;
  sleep: number;
  // Same staggered-real-minute-cooldown shape as nextRoamAt/nextEncounterAt
  // above. Deliberately left undefined for the CO (see his own push() call
  // below) — same "undefined clock = this NPC opts out" convention those
  // two already use: the needs counter is about a deployable pilot's
  // off-duty life, not the CO's.
  nextNeedsTickAt?: number;
};

// NPC_SEED / NPC_BOND_SEED used to be declared right here as scene-local
// consts. Moved out to data/npcSeed.ts, 26 Aug 2026 (imported up in this
// file's own import block above) — see that new file's own header for why
// (the background social-sim harness needs the same data under plain
// Node, where importing this Phaser.Scene file isn't safe). Content is
// unchanged, only the location moved.

export class Hub extends Phaser.Scene {
  // 26 Aug 2026 — see the file header's "Correction" note and
  // campaignState.ts section 11. Loaded once in create(), before
  // buildNpcs() (buildNpcs reads/seeds each NPC's HubPilotSocialState off
  // this), and saved again every time persistNpcSocial() runs.
  private campaignState!: CampaignState;
  // 26 Aug 2026 — section 12's persisted NPC-to-NPC bonds. Same "seed once,
  // hand back the same object after" contract as campaignState.ts's own
  // ensureNpcSocialState — mutating this.npcSocial.bonds/relationships
  // directly mutates this.campaignState too (it's the same object, not a
  // copy), so runNpcEncounter only needs saveCampaignState() after, no
  // separate write-back step. Also now the live bond source updateNpcRoaming
  // reads from — see that function's own updated comment.
  private npcSocial!: NpcSocialState;
  private player!: Phaser.GameObjects.Container;
  private playerX = 480;
  private playerY = 330;
  private npcs: HubNpc[] = [];
  // Hot topics, first slice, 27 Aug 2026 — in-memory only, never persisted
  // (see data/hotTopics.ts's own header for why). Registered at the real
  // event points (Stage promotion, NPC-NPC couple, player-NPC
  // relationship) and pruned every frame in update(), same "cheap,
  // unconditional housekeeping" shape as npcs itself and the drunk/worry
  // fields.
  private hotTopics: HotTopic[] = [];
  private keys!: { w: Phaser.Input.Keyboard.Key; a: Phaser.Input.Keyboard.Key; s: Phaser.Input.Keyboard.Key; d: Phaser.Input.Keyboard.Key };
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private interactPrompt!: Phaser.GameObjects.Text;
  private eKey?: Phaser.Input.Keyboard.Key;
  private mKey?: Phaser.Input.Keyboard.Key; // debug: test muster-call propagation (Build Plan §9 piece #1)
  // 27 Aug 2026 — tracks whether the debug M key's own muster is currently
  // "in effect," so a second press means cancel rather than calling a
  // second muster on top of the first. Deliberately scoped to just this
  // debug binding, not to musters in general (a real chat-triggered muster
  // has no cancel UI yet either) — see callMuster/endMuster's own headers.
  private musterActive = false;
  private rKey?: Phaser.Input.Keyboard.Key; // debug: test rumor propagation (Build Plan §9 piece #1)
  private tKey?: Phaser.Input.Keyboard.Key; // piece #3: open the real typed-chat box
  private chatInput!: Phaser.GameObjects.DOMElement;
  private chatOpen = false;
  private npcClickConsumed = false;

  // The peg board — see PEG_* constants' own header.
  private escKey?: Phaser.Input.Keyboard.Key;
  private pegOpen = false;
  private pegGame: PegGameState | null = null;
  private pegOpponent: HubNpc | null = null;
  private pegOverlay!: Phaser.GameObjects.Container;
  private pegBoardGfx!: Phaser.GameObjects.Graphics;
  private pegStatusText!: Phaser.GameObjects.Text;
  private pegFinalLine = ""; // set once, by finishPegBoard, so pegStatusLine() can keep showing it while the closing delay runs
  private pegFirstClick: number | null = null; // side b's free opening is the only two-click move — this holds the first click between the two
  private pegHelpOpen = false; // the persistent "?" rules panel — see PEG_BOARD_RULES_TEXT's own header
  private pegHelpOverlay!: Phaser.GameObjects.Container;

  // Poker — see the POKER_* constants' own header. pokerFinalLine mirrors
  // pegFinalLine's role but only ever gets set at SESSION end (someone
  // busts) — a normal hand-over pause between hands reads its summary
  // live off game.lastResult instead (pokerStatusLine), since a session is
  // many hands, not one round.
  private pokerOpen = false;
  private pokerGame: HoldemGameState | null = null;
  private pokerOpponent: HubNpc | null = null;
  private pokerOverlay!: Phaser.GameObjects.Container;
  private pokerStatusText!: Phaser.GameObjects.Text;
  private pokerPotText!: Phaser.GameObjects.Text;
  private pokerAiCardTexts: Phaser.GameObjects.Text[] = [];
  private pokerCommunityTexts: Phaser.GameObjects.Text[] = [];
  private pokerHumanCardTexts: Phaser.GameObjects.Text[] = [];
  private pokerFoldBtn!: Phaser.GameObjects.Text;
  private pokerCheckCallBtn!: Phaser.GameObjects.Text;
  private pokerRaiseBtn!: Phaser.GameObjects.Text;
  private pokerAllInBtn!: Phaser.GameObjects.Text;
  private pokerFinalLine = "";
  private pokerHelpOpen = false; // the persistent "?" rules panel — see POKER_RULES_TEXT's own header
  private pokerHelpOverlay!: Phaser.GameObjects.Container;

  // Fletchers (darts) — see the DARTS_* constants' own header. dartsMeterLive
  // gates whether the meter is actually animating and lockable right now
  // (true only during the human's own throw, false during the AI's turn,
  // the brief pause after a throw resolves, and the session-over pause) —
  // dartsMeterElapsed only accumulates while it's true.
  private dartsOpen = false;
  private dartsGame: DartsGameState | null = null;
  private dartsOpponent: HubNpc | null = null;
  private dartsOverlay!: Phaser.GameObjects.Container;
  private dartsBoardGfx!: Phaser.GameObjects.Graphics;
  private dartsMeterGfx!: Phaser.GameObjects.Graphics;
  private dartsStatusText!: Phaser.GameObjects.Text;
  private dartsResultText!: Phaser.GameObjects.Text;
  private dartsScoreText!: Phaser.GameObjects.Text;
  private dartsThrowBtn!: Phaser.GameObjects.Text;
  private dartsFinalLine = "";
  private dartsMeterLive = false;
  private dartsMeterElapsed = 0;
  private dartsLastResultLine = "";
  private dartsHelpOpen = false; // the persistent "?" rules panel — see DARTS_RULES_TEXT's own header
  private dartsHelpOverlay!: Phaser.GameObjects.Container;

  // Social history view — Hub polish, 26 Aug 2026. Read-only: shows the
  // nearest NPC's own socialLog (verbs.ts's "Log entry" ask, §3), real and
  // persisted since the campaignState persistence pass but never surfaced
  // anywhere until now. Deliberately the simplest overlay in this file —
  // a title/body text block and a close button, no interaction beyond
  // closing it, same shape as the other three overlays minus the game
  // logic. Not room-gated (unlike Share a Drink/the minigames/Ask Out) —
  // there's no in-fiction reason viewing your own history with someone
  // would require a specific room.
  private historyOpen = false;
  private historyOverlay!: Phaser.GameObjects.Container;
  private historyText!: Phaser.GameObjects.Text;

  // Highlights reel — Social Sim Roadmap #11, 27 Aug 2026. Same shape as
  // the history overlay directly above (read-only, no engine state of its
  // own, not room-gated) but a different cut of the same data: dated
  // "First <verb>" milestones (data/highlights.ts's buildFirstMilestones,
  // real timestamps) plus an explicitly UNDATED "Currently:" section
  // (relationship status via npcPartnerLabel, Stage via stageBadge) — see
  // highlights.ts's own header for exactly which of the roadmap's original
  // example milestones turned out to be real data versus not.
  private highlightsOpen = false;
  private highlightsOverlay!: Phaser.GameObjects.Container;
  private highlightsText!: Phaser.GameObjects.Text;

  // Comms log — see CHAT_LOG_* constants' own header for the full design
  // reasoning. Always-visible (not a toggled overlay like the four above).
  // chatLog is the full in-memory transcript for this scene instance's
  // lifetime — not persisted through CampaignState, same "scene-local,
  // gone on reload" shape as every other purely-ambient piece of state in
  // this file (drunk expiry, worry). chatLogText only ever renders the
  // most recent CHAT_LOG_VISIBLE_LINES of it — a display cap, not a data
  // cap, same distinction §28's history overlay already draws for the same
  // reason (no scroll/mask mechanism built for either yet).
  private chatLog: { speaker: string; line: string }[] = [];
  private chatLogText!: Phaser.GameObjects.Text;

  // Phase 2 map growth — current room, the title text that names it, the
  // door markers (one Graphics+Text pair per DOORS entry, all built up
  // front and toggled visible per room rather than rebuilt on every
  // switch), and the one empty-room note shown in any non-Rec-Room room.
  private currentRoomId: RoomId = "recroom";
  private roomTitleText!: Phaser.GameObjects.Text;
  private doorMarkers: { def: DoorDef; outline: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text }[] = [];
  private roomNoteText!: Phaser.GameObjects.Text;
  private bayOutline!: Phaser.GameObjects.Graphics;
  private bayLabel!: Phaser.GameObjects.Text;
  // Antfarm Grid v0, 27 Aug 2026 — one entry per non-grotto room, the
  // divider line(s) + floating name label that make a deck's other zones
  // legible before you've walked into them. Toggled by DECK, not by exact
  // zone, same as doorMarkers above — the whole point of an open floor is
  // seeing the rest of it. deckIndicatorText is the small "DECK: LOWER"
  // readout near the rank line (buildPlayer's own corner), since the main
  // title bar already carries deck name + zone and a second copy there
  // risked repeating the exact wordWrap-overflow bug this file already
  // fixed once (see roomTitleText's own history).
  private zoneDecor: { room: RoomId; nodes: (Phaser.GameObjects.Graphics | Phaser.GameObjects.Text)[] }[] = [];
  private deckIndicatorText!: Phaser.GameObjects.Text;
  // The egg hull, 27 Aug 2026 — drawRoom()'s single shared rectangle used
  // to be the background for every deck, always visible, never toggled
  // (nothing about it ever differed between rooms before this pass). Now
  // every deck draws its own floor at its own size/shape, and exactly one
  // of these three is visible at a time — see refreshRoomVisibility.
  private lowerFloor!: Phaser.GameObjects.Graphics;
  private upperFloor!: Phaser.GameObjects.Graphics;
  private grottoFloor!: Phaser.GameObjects.Graphics;
  // The egg hull, second pass, 27 Aug 2026 — one marker per RESERVED_BAYS
  // entry, same "built once, toggled by deck" pattern as doorMarkers above.
  private reservedBayMarkers: { def: ReservedBayDef; outline: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text }[] = [];

  constructor() {
    super("Hub");
  }

  create() {
    // Same load idiom every other scene already uses (Battle/Boot/Debrief/
    // Hangar/TransporterPad) — see the file header's 26 Aug 2026
    // correction. Must happen before buildNpcs() below.
    this.campaignState = loadCampaignState() ?? createWardenCampaignState();
    // Must happen before buildNpcs() too — buildNpcs doesn't read this
    // directly, but updateNpcRoaming/updateNpcEncounters both do, starting
    // the very first update() tick after create() finishes.
    this.npcSocial = ensureNpcSocialState(this.campaignState, NPC_BOND_SEED);

    this.cameras.main.setBackgroundColor("#0c0f12");

    this.roomTitleText = this.add
      .text(480, 20, `THE ANTFARM — ${ROOM_TITLES[this.currentRoomId]} (PROTOTYPE)`, { fontFamily: "monospace", fontSize: "16px", color: TEXT_MAIN })
      .setOrigin(0.5);
    // wordWrap added this pass — caught in Playwright verification, not by
    // eye: this line measured 1232px wide (checked via the Text object's
    // own .width) against a 960px-wide canvas, overflowing ~136px off
    // BOTH edges. Predates the Antfarm rewrite (piece #4's "door or"
    // wasn't the sole cause — the line was already close to the edge
    // before this pass added "a door or " to it), but nobody had caught it
    // because a screenshot alone doesn't tell you the text is clipped
    // versus just tight. A straightforward render bug, not a wording or
    // layout decision, so fixed directly rather than flagged.
    this.add
      .text(
        480,
        44,
        "WASD / arrows to move — E or click room to talk, click an NPC to provoke. Walk to a door or the BAY and press E. T = type something real. M = muster call (debug), R = test rumor (debug).",
        {
          fontFamily: "monospace",
          fontSize: "11px",
          color: TEXT_DIM,
          align: "center",
          wordWrap: { width: 900 },
        }
      )
      .setOrigin(0.5);

    // Locked in Build Plan §4: "shipping it with zero signal... would read
    // as a rug-pull later." Cosmetic/inert here, on purpose — Phase 4 is
    // where a hub-goes-hot system actually reads this.
    this.add
      .text(818, 20, "THREAT: DISTANT", { fontFamily: "monospace", fontSize: "10px", color: "#6b7d8a" })
      .setOrigin(1, 0.5);

    // Rourke's own rank readout, 27 Aug 2026 (later pass) — Social Sim
    // Roadmap #5's own follow-on note: now that CampaignState.rourkeRank
    // is a real, live stat (§38's rourkeRank fix), it deserves the same
    // "moment AND lasting evidence" treatment as a pilot's own Stage badge
    // (favorabilityLabel's stageBadge, below) — the rank-deference
    // greeting (§38) is the moment, this is the evidence. Deliberately
    // NOT read off WARDEN_PILOTS' own displayName ("2nd Lt. Dessa Rourke
    // — ...") — that string's rank prefix is static campaign-start data
    // and never changes, exactly the trap buildPlayer()'s own header
    // already warns about; this builds a fresh label from the live rank
    // instead, keeping only the name/callsign half of the static string.
    // Static text, set once here rather than kept live: rourkeRank only
    // ever changes via integrateSecondLance/integrateThirdLance, both of
    // which run in Debrief.ts — never while a Hub scene instance is alive
    // — same accepted assumption §36 already documents for
    // HubNpc.ambient.stage itself (a scene rebuild always sits between
    // "rank changed" and "player can act on it again").
    const rourkeStatic = WARDEN_PILOTS.find((p) => p.id === "pilot_rourke");
    const ROURKE_STATIC_RANK_PREFIX = "2nd Lt. ";
    const rourkeNameAndCallsign =
      rourkeStatic && rourkeStatic.displayName.startsWith(ROURKE_STATIC_RANK_PREFIX)
        ? rourkeStatic.displayName.slice(ROURKE_STATIC_RANK_PREFIX.length)
        : (rourkeStatic?.displayName ?? "Rourke");
    this.add
      .text(16, 20, `${rankDisplayTitle(this.campaignState.rourkeRank)} ${rourkeNameAndCallsign}`, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#6b7d8a",
      })
      .setOrigin(0, 0.5);

    // Antfarm Grid v0, 27 Aug 2026 — set once here, kept live by
    // refreshRoomVisibility below every time the deck actually changes.
    // y=80, not directly under the rank line at y=20/36: the wide centered
    // instructions text just above (y=44, two wrapped lines) spans nearly
    // the full canvas width, so anything left-aligned at y<~60 collides
    // with it — caught by eye in the smoke-test screenshot, not a guess.
    this.deckIndicatorText = this.add
      .text(16, 80, "", { fontFamily: "monospace", fontSize: "10px", color: "#6b7d8a" })
      .setOrigin(0, 0.5);

    this.lowerFloor = this.drawDeckFloor(LOWER_BOUNDS);
    this.upperFloor = this.drawDeckFloor(UPPER_BOUNDS);
    this.drawGrottoFloor();
    this.drawMusterPoint();
    this.buildDoors();
    this.buildZoneDecor();
    this.buildReservedBays();
    this.roomNoteText = this.add.text(480, 330, "", { fontFamily: "monospace", fontSize: "12px", color: TEXT_DIM, align: "center", wordWrap: { width: 460 } }).setOrigin(0.5);
    this.buildNpcs();
    this.buildPlayer();
    this.refreshRoomVisibility();

    this.interactPrompt = this.add.text(480, ROOM_BOUNDS.bottom + 20, "", { fontFamily: "monospace", fontSize: "11px", color: ACCENT }).setOrigin(0.5);

    const footer = this.add.container(0, 0);
    makeShopButton(this, footer, 90, 604, 140, 32, "BACK TO HANGAR", true, () => this.scene.start("Hangar"));

    // Explicit per-key binding rather than addKeys("W,A,S,D") — that batch
    // form keys its returned object by the exact string tokens passed in
    // (.W/.A/.S/.D), not the lowercased .w/.a/.s/.d this file reads; an `as`
    // cast there would have compiled fine and thrown at runtime on the
    // first press. Caught in review before it ever ran.
    const kb = this.input.keyboard!;
    this.keys = {
      w: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.eKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.mKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    this.rKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.tKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.T);
    this.escKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.input.keyboard?.addCapture("W,A,S,D,E,M,R,T");

    this.buildChatBox();
    this.buildChatLogPanel();
    this.buildPegBoardOverlay();
    this.buildPokerOverlay();
    this.buildDartsOverlay();
    this.buildHistoryOverlay();
    this.buildHighlightsOverlay();

    this.input.on("pointerdown", () => {
      if (this.npcClickConsumed) {
        this.npcClickConsumed = false; // this click already provoked a specific NPC — don't also broadcast
        return;
      }
      // Same context-sensitivity as the E key (see updateProximity) —
      // clicking the room while standing at a door or the bay does that
      // instead of talking, so click and E never disagree about what
      // pressing the "interact" affordance does from the same spot.
      const door = this.isAtDoor();
      if (door) this.switchRoom(door);
      else if (this.isAtBay()) this.deploy();
      else this.speak();
    });
  }

  // Piece #3, 26 Aug 2026 — the real typed-chat box, a Phaser DOM Element
  // (first use of one in this project; requires main.ts's `dom:
  // {createContainer:true}` game config). A plain HTML <input>, styled to
  // match the rest of the Hub's palette, hidden until T opens it. Enter and
  // Escape are read as native DOM keydown events on the input node itself
  // — deliberately NOT Phaser's keyboard plugin, since that plugin is what
  // gets suspended (via removeCapture, see openChat/closeChat) while this
  // box has focus, precisely so typed letters that happen to match a game
  // hotkey (w/a/s/d/e/m/r/t) don't get eaten by the game instead of typed.
  private buildChatBox() {
    this.chatInput = this.add
      .dom(
        480,
        CHAT_BOX_Y,
        "input",
        "width: 320px; padding: 6px 8px; font-family: monospace; font-size: 13px; " +
          "background: #1a2028; color: #e8e2d4; border: 1px solid #4a7a9a; outline: none;"
      )
      .setOrigin(0.5)
      .setVisible(false);

    const node = this.chatInput.node as HTMLInputElement;
    node.placeholder = "Type something — Enter to say it, Esc to cancel";
    node.maxLength = 120;
    node.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.submitChat(node.value);
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.closeChat();
      }
      e.stopPropagation();
    });
  }

  // See CHAT_LOG_* constants' own header for placement reasoning. Built
  // once, never rebuilt on room switch — same idiom as roomTitleText/the
  // interact prompt, both fixed HUD elements outside ROOM_BOUNDS.
  private buildChatLogPanel() {
    this.add
      .rectangle(CHAT_LOG_CENTER_X, 330, CHAT_LOG_WIDTH, ROOM_BOUNDS.bottom - ROOM_BOUNDS.top, PANEL_BG, 0.9)
      .setStrokeStyle(1, PANEL_BORDER);
    this.add.text(CHAT_LOG_CENTER_X, ROOM_BOUNDS.top + 14, "OVERHEARD", { fontFamily: "monospace", fontSize: "10px", color: TEXT_DIM }).setOrigin(0.5);
    this.chatLogText = this.add
      .text(CHAT_LOG_X + 8, ROOM_BOUNDS.top + 32, "Quiet so far.", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: TEXT_MAIN,
        wordWrap: { width: CHAT_LOG_WIDTH - 16 },
        lineSpacing: 4,
      })
      .setOrigin(0, 0);
  }

  // The one funnel every real line in this scene passes through — see
  // this method's two call sites (showBubble, for every NPC line no matter
  // its source; submitChat, for the player's own raw typed text) rather
  // than every individual verb/muster/gossip/rumor call site logging for
  // itself. speaker is npc.initials for an NPC line (same short tag
  // already shown on their in-world portrait — no new naming convention
  // introduced) or the literal "YOU" for the player's own line.
  private logChatLine(speaker: string, line: string) {
    this.chatLog.push({ speaker, line });
    if (this.chatLog.length > CHAT_LOG_MAX_STORED) this.chatLog.shift();
    this.renderChatLog();
  }

  private renderChatLog() {
    if (this.chatLog.length === 0) {
      this.chatLogText.setText("Quiet so far.");
      return;
    }
    const recent = this.chatLog.slice(-CHAT_LOG_VISIBLE_LINES);
    this.chatLogText.setText(recent.map((entry) => `${entry.speaker}: ${entry.line}`).join("\n\n"));
  }

  private openChat() {
    if (this.chatOpen) return;
    this.chatOpen = true;
    // Same capture list as create()'s addCapture — release it while typing
    // so none of those letters get preventDefault'd out of the input.
    this.input.keyboard?.removeCapture("W,A,S,D,E,M,R,T");
    const node = this.chatInput.node as HTMLInputElement;
    node.value = "";
    // Set the underlying node's display directly rather than calling
    // Phaser's own setVisible() — that only takes effect on Phaser's next
    // internal DOMElement update pass, not synchronously, so a focus()
    // call made the same tick still hits a display:none element and
    // silently no-ops. Caught via a temporary debug log during this
    // build's own Playwright pass (removed before shipping): setVisible(true)
    // followed immediately by focus() left document.activeElement on BODY
    // every time, node.style.display still read "none" at the moment
    // focus() ran.
    node.style.display = "block";
    this.chatInput.setVisible(true); // keep Phaser's own tracked state in sync
    node.focus();
  }

  private closeChat() {
    this.chatOpen = false;
    const node = this.chatInput.node as HTMLInputElement;
    node.blur();
    node.value = "";
    node.style.display = "none"; // see openChat's comment — same direct-node reasoning, kept symmetric
    this.chatInput.setVisible(false);
    this.input.keyboard?.addCapture("W,A,S,D,E,M,R,T");
  }

  // Where a typed message actually becomes something the reaction engine
  // understands — see data/chatIntent.ts's own header for the design
  // reasoning behind this being rule-based rather than a real model.
  // Recognized text reuses broadcastMessage(), the exact same path
  // callMuster() (debug M key) already uses — a typed "cmon guys to the
  // bay" and pressing M produce an identical message, on purpose.
  //
  // Verb framework requests (data/verbs.ts, 26 Aug 2026) are checked
  // FIRST, ahead of everything else — a real, runnable verb (right now
  // just Share a Drink) beats both "not open yet" and "didn't catch
  // that." Chat stays the interaction model for verbs on purpose, not a
  // new per-NPC click-menu: Maxime already ruled a menu out for the
  // general case ("a menu is rigid, I want flexibility"), and typed chat
  // already had a placeholder for exactly this phrase — graduating it is
  // the smaller move than inventing a second UI. detectVerbRequest only
  // resolves verbs that actually have a VerbDef (today: Share a Drink);
  // Poker/peg/spar still fall through to detectUnbuiltVerbLine below.
  //
  // Named-but-unbuilt verb requests ("let's play poker," "let's spar," 26
  // Aug 2026) are checked next, before interpretPlayerChat — see
  // detectUnbuiltVerbLine's own header. This is deliberately a distinct
  // third outcome from "understood, acted on it" and "no idea what that
  // meant": the player asked for something real that just isn't open yet.
  //
  // Unrecognized text gets a shrug, not silence, but that shrug is NOT a
  // real HubMessage and does not propagate — nobody relays confusion.
  private submitChat(raw: string) {
    this.closeChat();
    const trimmed = raw.trim();
    if (!trimmed) return;
    // Comms log, Hub polish 26 Aug 2026 — logged verbatim (not lowercased,
    // not reinterpreted) regardless of how — or whether — the game
    // understood it, so the log reads as an actual transcript ("what did I
    // say that got this response") rather than only ever showing the
    // NPCs' half of the conversation.
    this.logChatLine("YOU", trimmed);

    const verbId = detectVerbRequest(trimmed);
    if (verbId === "shareADrink") {
      if (this.currentRoomId !== "recroom") {
        this.showFallback("Nothing to pour outside the rec room.");
        return;
      }
      const target = this.nearestNpcInRange(APPROACH_RADIUS);
      if (!target) {
        this.showFallback("Nobody's close enough to share one with.");
        return;
      }
      this.shareADrink(target);
      return;
    }
    if (verbId === "pegBoard") {
      if (this.currentRoomId !== "recroom") {
        this.showFallback("Nothing to play out here.");
        return;
      }
      if (this.pegOpen || this.pokerOpen || this.dartsOpen) return; // already mid-game
      const target = this.nearestNpcInRange(APPROACH_RADIUS);
      if (!target) {
        this.showFallback("Nobody's close enough for a game.");
        return;
      }
      this.startPegBoard(target);
      return;
    }
    if (verbId === "poker") {
      if (this.currentRoomId !== "recroom") {
        this.showFallback("Nothing to deal out here.");
        return;
      }
      if (this.pokerOpen || this.pegOpen || this.dartsOpen) return; // already mid-game
      const target = this.nearestNpcInRange(APPROACH_RADIUS);
      if (!target) {
        this.showFallback("Nobody's close enough for a hand.");
        return;
      }
      this.startPoker(target);
      return;
    }
    if (verbId === "fletchers") {
      if (this.currentRoomId !== "recroom") {
        this.showFallback("Nothing to throw out here.");
        return;
      }
      if (this.dartsOpen || this.pegOpen || this.pokerOpen) return; // already mid-game
      const target = this.nearestNpcInRange(APPROACH_RADIUS);
      if (!target) {
        this.showFallback("Nobody's close enough for a round.");
        return;
      }
      this.startDarts(target);
      return;
    }
    if (verbId === "askOut") {
      if (this.currentRoomId !== "berths") {
        this.showFallback("Not the place to ask that. Try the berths.");
        return;
      }
      const target = this.nearestNpcInRange(APPROACH_RADIUS);
      if (!target) {
        this.showFallback("Nobody's close enough to ask.");
        return;
      }
      this.askOut(target);
      return;
    }

    // Build request — Antfarm build economy, first slice, 27 Aug 2026.
    // Checked in the same slot as the real verbs above (a genuine build
    // request beats both the history/highlights reads and the generic
    // catch-all below), but unlike those verbs it isn't room-gated — the CO
    // sits in the grotto, not a room the player toggles into — it's gated on
    // standing next to the CO specifically. Asking to build while standing
    // next to anyone else gets a clear redirect rather than a silent miss or
    // a fallback shrug, since "who do I even ask" is a real new-player
    // question this design creates.
    const buildRequest = detectBuildRequest(trimmed);
    if (buildRequest) {
      const nearby = this.nearestNpcInRange(APPROACH_RADIUS);
      if (nearby?.pilotId !== CO_PILOT_ID) {
        this.showFallback("Only the CO signs off on that — find him in the grotto.");
        return;
      }
      this.handleBuildRequest(buildRequest);
      return;
    }

    // History request — Hub polish, 26 Aug 2026. Checked after the real
    // verbs (a genuine "let's drink" always wins over a false-positive
    // reading) but before detectUnbuiltVerbLine/interpretPlayerChat, same
    // precedence reasoning as every check above it: a real, actionable
    // request beats both "not open yet" and a generic shrug. Not room- or
    // overlay-gated the way the verbs above are, except for the one real
    // conflict — another overlay already owns the screen.
    if (detectHistoryRequest(trimmed)) {
      if (this.pegOpen || this.pokerOpen || this.dartsOpen) return; // already mid-game — let that own the screen
      const target = this.nearestNpcInRange(APPROACH_RADIUS);
      if (!target) {
        this.showFallback("Nobody's close enough to ask about.");
        return;
      }
      this.openHistory(target);
      return;
    }

    // Highlights request — Social Sim Roadmap #11, 27 Aug 2026. Same
    // precedence slot and same reasoning as the History check immediately
    // above (a real, actionable read beats both "not open yet" and a
    // generic shrug), checked right after it since the two are the closest
    // things to each other in this file — deliberately still a separate
    // check with its own keyword set rather than folded into
    // detectHistoryRequest, see chatIntent.ts's own comment on why.
    if (detectHighlightsRequest(trimmed)) {
      if (this.pegOpen || this.pokerOpen || this.dartsOpen) return; // already mid-game — let that own the screen
      const target = this.nearestNpcInRange(APPROACH_RADIUS);
      if (!target) {
        this.showFallback("Nobody's close enough to ask about.");
        return;
      }
      this.openHighlights(target);
      return;
    }

    const unbuiltLine = detectUnbuiltVerbLine(trimmed);
    if (unbuiltLine) {
      this.showFallback(unbuiltLine);
      return;
    }

    const message = interpretPlayerChat(trimmed);
    if (message) {
      this.broadcastMessage(message);
    } else {
      this.showCatalystOrFallback(trimmed);
    }
  }

  // Verb framework's first real single-target verb, 26 Aug 2026 (see
  // data/verbs.ts's own header for the framework itself). "Nearest NPC
  // within range" stands in for real targeting since chat has no explicit
  // @-target syntax — reuses APPROACH_RADIUS (the same distance that
  // already makes Favorability visible) as "close enough to be who the
  // player obviously means," rather than inventing a second radius
  // constant for the same rough idea.
  private nearestNpcInRange(radius: number): HubNpc | null {
    let best: HubNpc | null = null;
    let bestDist = radius;
    for (const npc of this.npcs) {
      if (!sameDeck(npc.room, this.currentRoomId)) continue;
      const dist = Phaser.Math.Distance.Between(this.playerX, this.playerY, npc.x, npc.y);
      if (dist <= bestDist) {
        best = npc;
        bestDist = dist;
      }
    }
    return best;
  }

  // 26 Aug 2026 — the write-back half of ensureHubSocialState (see
  // campaignState.ts section 11 for the full design). Call this after any
  // mutation to npc.favorability, npc.ambient.stress/morale,
  // npc.inRelationship, or npc.drunkUntil. npc.socialLog needs no copy step
  // here — it's already the same array reference ensureHubSocialState
  // handed back in buildNpcs(), so a .push() on it already lives in
  // this.campaignState. Every call site below (shareADrink, askOut's three
  // branches, the three minigame-finish methods, and updateDrunkExpiry's
  // own clear) calls this once, right after its own mutation, then this
  // saves the whole campaign — the same "mutate, then saveCampaignState"
  // idiom every other scene already uses.
  private persistNpcSocial(npc: HubNpc) {
    const social = ensureHubSocialState(this.campaignState, npc.pilotId, {
      favorability: npc.favorability,
      stress: npc.ambient.stress,
      morale: npc.ambient.morale,
    });
    social.favorability = npc.favorability;
    social.stress = npc.ambient.stress;
    social.morale = npc.ambient.morale;
    social.inRelationship = npc.inRelationship ?? false;
    social.drunkUntil = npc.drunkUntil;
    saveCampaignState(this.campaignState);
  }

  // Stage-promotion "graduation" reveal, 27 Aug 2026 — the write-back half,
  // called from exactly one place: speak()'s new branch, right after the
  // special line has actually been shown. Deliberately NOT folded into
  // persistNpcSocial above: that function runs from plenty of unrelated
  // interactions too (Share a Drink, the three minigames, updateDrunkExpiry
  // — anything that touches Favorability/Stress/Morale/drunk), and any of
  // those firing before the player ever talks to a freshly-promoted pilot
  // would silently mark the promotion "seen" before the reveal line was
  // ever shown.
  private ackStagePromotion(npc: HubNpc) {
    const social = ensureHubSocialState(this.campaignState, npc.pilotId, {
      favorability: npc.favorability,
      stress: npc.ambient.stress,
      morale: npc.ambient.morale,
    });
    social.lastAcknowledgedStage = npc.ambient.stage;
    saveCampaignState(this.campaignState);
  }

  // "Hello, Sir" rank-deference greeting, 27 Aug 2026 — the write-back
  // half, mirroring ackStagePromotion immediately above line for line, same
  // reasoning for why it's a dedicated method rather than folded into
  // persistNpcSocial (an unrelated interaction firing first would mark the
  // greeting "seen" before the player ever actually heard it).
  private ackRankGreeting(npc: HubNpc) {
    const social = ensureHubSocialState(this.campaignState, npc.pilotId, {
      favorability: npc.favorability,
      stress: npc.ambient.stress,
      morale: npc.ambient.morale,
    });
    social.lastAcknowledgedRourkeRank = this.campaignState.rourkeRank;
    saveCampaignState(this.campaignState);
  }

  // Roadmap #17's curated-recall layer (data/crewBanterSlots.ts), 27 Aug
  // 2026 — assembles real per-speaker context so the resolver can fill
  // {SQUADMATE}/{MISSION}/{CLASS}/{LOADOUT}, plus (28 Aug 2026, Recall Item
  // 3 spec §3) {RIVAL}/{LOST}. Every field is optional on purpose
  // (SlotContext's own shape): resolveSlotText falls back to the flat line
  // the instant a needed field is missing, so there's no failure mode here
  // worth guarding against beyond "return undefined."
  //
  // {SQUADMATE} is bond-biased, not uniform-random — reuses the exact same
  // findClosestBond(pilotId, otherIds, this.npcSocial.bonds) call
  // updateNpcRoaming already makes (see its own use a little further down
  // this file) so "who does this pilot bring up unprompted" tracks the same
  // relationship data their actual behavior already does. Falls back to any
  // other living pilot, uniform-random, when there's no real bond yet (a
  // fresh save, or two pilots who've simply never crossed paths) — a
  // recall that names *somebody* real beats losing the slot outright.
  //
  // {CLASS} and {LOADOUT} read the SPEAKING pilot's own live roster entry
  // (CampaignState.pilots, not the static WARDEN_PILOTS seed) so a
  // mid-campaign tier-up shows up here the same way it already does in
  // ShopPanel/TransporterPad. Passed as the raw (path, tier) pair rather
  // than pre-formatted strings — crewBanterSlots.ts's own GEAR_TIER_NAMES/
  // CLASS_DISPLAY_NAMES tables are what turn that into display text, so
  // this scene doesn't need to know the naming scheme at all. {LOADOUT}
  // resolves to Canon Pass §D's named gear tiers (Stocklance, Stormblade,
  // etc.) — Maxime's own call, asked directly 27 Aug 2026 ("use the named
  // gear tiers"); see crewBanterSlots.ts's own header for the full naming-
  // lock reasoning behind why that's fine to use here.
  private buildSlotContext(npc: HubNpc): SlotContext {
    const others = this.npcs.filter((n) => n.pilotId !== npc.pilotId);
    let squadmateName: string | undefined;
    if (others.length > 0) {
      const otherIds = others.map((n) => n.pilotId);
      const closest = findClosestBond(npc.pilotId, otherIds, this.npcSocial.bonds);
      const bonded = closest ? others.find((n) => n.pilotId === closest.otherId) : undefined;
      const chosen = bonded ?? others[Math.floor(Math.random() * others.length)];
      squadmateName = chosen.displayName.split("—")[0].trim();
    }

    const missionId = this.campaignState.lastMissionEcho?.missionId;
    const missionName = missionId ? AMARANTH_MISSIONS_BY_ID[missionId]?.displayName : undefined;

    const pilotEntry = this.campaignState.pilots[npc.pilotId]?.pilot;
    const archetype = pilotEntry ? UNIT_ARCHETYPES[pilotEntry.archetypeId] : undefined;
    const speakerPath = archetype?.path;
    const speakerTier = pilotEntry?.tier;

    // {RIVAL}, 28 Aug 2026 (Recall Item 3 spec §3) — deliberately reuses
    // npcRivalLabel's own logic rather than a looser "closest negative
    // bond" read: only a bond that actually clears RIVAL_THRESHOLD counts
    // as a real rivalry worth a pilot naming out loud, same standard the
    // Hub's own rival-status UI already holds itself to. No fallback to
    // "just pick somebody" the way SQUADMATE has one — a neutral or
    // friendly bond isn't a rival, so the slot stays unresolved (caller
    // falls back to the flat line) rather than naming the wrong person.
    let rivalName: string | undefined;
    if (others.length > 0) {
      const otherIds = others.map((n) => n.pilotId);
      const worst = findWorstRival(npc.pilotId, otherIds, this.npcSocial.bonds);
      if (worst && worst.value <= RIVAL_THRESHOLD) {
        const rival = others.find((n) => n.pilotId === worst.otherId);
        rivalName = rival?.displayName.split("—")[0].trim();
      }
    }

    // {LOST}, 28 Aug 2026 (Recall Item 3 spec §3) — "a fallen Munti's
    // name, off the existing tally." Reads the same status +
    // archetype-path check checkMuntiLoss() already uses to decide whether
    // a Munti loss ever happened, rather than a new tracked list — the
    // roster itself already IS the tally (a permanently_lost entry's
    // record, including its displayName, is never deleted, only flagged).
    // Picks uniform-random among however many qualify, same as ENEMY/SHIP/
    // ROOM's own categorical-pick shape when there's more than one.
    const lostMuntis = Object.values(this.campaignState.pilots).filter(
      (entry) => entry.status === "permanently_lost" && UNIT_ARCHETYPES[entry.pilot.archetypeId]?.path === "munti"
    );
    const lostMuntiName =
      lostMuntis.length > 0 ? lostMuntis[Math.floor(Math.random() * lostMuntis.length)].pilot.displayName.split("—")[0].trim() : undefined;

    // {STAGE_MOMENT}, 28 Aug 2026 (Recall Item 3 follow-up — Maxime:
    // "highlight reel should date itself with calandar. down to the
    // sec."). Only resolves off a REAL recorded promotion
    // (social.stagePromotedAt), never off the pilot's current stage alone
    // — a pilot who started the campaign already at Blooded has nothing to
    // recall here, since no live promotion event ever happened for them.
    // Prefers "Command" over "Blooded" when both are on record, same
    // "most significant/most recent" instinct stageBadge's own display
    // already follows for a pilot's current Stage.
    const speakerSocial = this.campaignState.pilots[npc.pilotId]?.social;
    const promotedAt = speakerSocial?.stagePromotedAt;
    const stageMomentText = promotedAt?.command !== undefined ? "Command" : promotedAt?.blooded !== undefined ? "Blooded" : undefined;

    return { squadmateName, missionName, speakerPath, speakerTier, rivalName, lostMuntiName, stageMomentText };
  }

  // Layers curated recall on top of pickAmbientLineWithBleed (roadmap #2):
  // still rolls the same bleed chance and picks from the same catalyst/
  // echo/stage bucket that function already computes, then asks
  // crewBanterSlots.ts whether that exact bucket has a slotted sibling and,
  // if so and buildSlotContext() actually has data to fill it, swaps in the
  // "remembers something real" version. Falls straight back to the flat
  // line whenever either check misses — same "graceful miss, never a raw
  // {TOKEN}" contract crewBanterSlots.ts's own header documents. Wired into
  // every call site pickAmbientLineWithBleed itself is (that function's own
  // header names the set: shareADrink, pegBoard, poker, darts, and the
  // general ambient idle roll) — same population, one layer deeper, not a
  // new decision about which call sites qualify.
  private pickAmbientLineWithMemory(npc: HubNpc): { line: string } {
    // Off-Duty Needs Counter, 28 Aug 2026 (spec §4: "drawn the same way
    // sub-animal bleed already draws an off-primary line... a curious
    // player gets a real textual tell without a meter ever being shown").
    // Checked first, ahead of sub-animal bleed and the curated-recall
    // slotted-variant layer below — a flat override, not routed through
    // LINE_BANK/pickSlottedVariant, since these six lines are fixed text,
    // not personality-flavored per catalyst. Every one of this function's
    // five call sites (Gate 0's own fallback in speak(), shareADrink, peg
    // board, poker, darts — pickAmbientLineWithBleed's own header names
    // the same five) picks this up for free.
    const needsLine = this.pickNeedsFlavorLine(npc);
    if (needsLine) return { line: needsLine };
    const { line, pick, bled } = pickAmbientLineWithBleed(npc.pilotId, npc.ambient);
    const catalyst = bled?.catalyst ?? npc.ambient.catalyst;
    const variant = pickSlottedVariant(catalyst, pick.echo, npc.ambient.stage);
    if (!variant) return { line };
    const resolved = resolveSlotText(variant, this.buildSlotContext(npc));
    return { line: resolved ?? line };
  }

  // Off-Duty Needs Counter, 28 Aug 2026 — the flavor-bank half of spec §4.
  // worstNeed/NEEDS_FLAVOR_BANK/NEEDS_FLAVOR_CHANCE all live in
  // data/needsCounter.ts (pure); this just reads this NPC's own live
  // meters and rolls the chance. undefined (no override) the large
  // majority of the time — nothing below threshold, or the chance roll
  // missed — same "usually nothing happens" shape GATE0_BASE_CHANCE/
  // AMBIENT_BLEED_CHANCE already have.
  private pickNeedsFlavorLine(npc: HubNpc): string | undefined {
    const kind = worstNeed(npc.hunger, npc.thirst, npc.sleep);
    if (!kind) return undefined;
    if (Math.random() >= NEEDS_FLAVOR_CHANCE) return undefined;
    const bank = NEEDS_FLAVOR_BANK[kind];
    return bank.lines[Math.floor(Math.random() * bank.lines.length)];
  }

  // Sets ambient.drunk and lets pickAmbientLineWithBleed (catalystProfile.ts,
  // wrapping ambientLines.ts's own pickAmbientLine since 27 Aug 2026's
  // ambient-bleed pass, roadmap #2) pick the reaction — that branch (50/50
  // love/anger, "drunk" reason) was ported
  // verbatim from pilot_creator.html back in Phase 1 and has sat unreachable
  // ever since; this is the first thing in the real repo that can actually
  // set the flag. +5 Favorability is a placeholder nudge, same caveat as
  // every other demo-Favorability number in this scene. The −20% hit-chance
  // combat debuff §5 locks is Battle-scene state this Hub scene has no
  // access to and isn't applying here — a real drunk-into-battle mission
  // isn't a thing yet in the actual campaign flow, and inventing that wiring
  // now would be answering a question nobody's asked yet, per this same
  // pass's file-header discipline (don't build past what's actually needed).
  private shareADrink(npc: HubNpc) {
    const def = VERBS.shareADrink;
    npc.ambient = { ...npc.ambient, drunk: true };
    // Re-sharing a drink with someone already drunk restarts the clock
    // rather than stacking — one duration, refreshed, not extended.
    npc.drunkUntil = Date.now() + DRUNK_DURATION_MS;
    if (def.outcome?.favorabilityDelta) npc.favorability += def.outcome.favorabilityDelta;
    const { line } = this.pickAmbientLineWithMemory(npc);
    this.showBubble(npc, line, this.time.now);
    npc.socialLog = npc.socialLog ?? [];
    npc.socialLog.push({ verb: "shareADrink", line, at: Date.now() });
    this.persistNpcSocial(npc);
  }

  // Phase 3 piece two, 26 Aug 2026 — Ask Out. All the actual deciding
  // happens in romance.ts's resolveAskOut (see that file's own header for
  // the design call); this just turns the answer into a bubble, a
  // Favorability write, and — on a real rejection — a real rumor through
  // the exact propagation pipeline §9 already anticipated ("a rejected Ask
  // Out is a concrete trigger event this same system could fire on, once
  // Ask Out itself exists"). Retires that caveat: startRumor() (the R
  // debug key) still fabricates a random pair for manual testing, but a
  // real in-fiction rejection now spreads for real.
  private askOut(npc: HubNpc) {
    const now = this.time.now;
    const outcome = resolveAskOut({
      favorability: npc.favorability,
      romanceable: npc.romanceable,
      alreadyInRelationship: npc.inRelationship ?? false,
    });

    if (outcome.result === "alreadyTogether") {
      const line = ALREADY_TOGETHER_LINES[Math.floor(Math.random() * ALREADY_TOGETHER_LINES.length)];
      this.showBubble(npc, line, now);
      return;
    }
    if (outcome.result === "closeFriendOnly") {
      const line = CLOSE_FRIEND_ONLY_LINES[Math.floor(Math.random() * CLOSE_FRIEND_ONLY_LINES.length)];
      this.showBubble(npc, line, now);
      npc.socialLog = npc.socialLog ?? [];
      npc.socialLog.push({ verb: "askOut", line, at: Date.now() });
      this.persistNpcSocial(npc);
      return;
    }

    npc.favorability += outcome.favorabilityDelta;
    if (outcome.result === "accepted") {
      npc.inRelationship = true;
      const line = pickLineForMessage(npc.ambient, { kind: "emotion", echo: "love" });
      this.showBubble(npc, line, now);
      npc.socialLog = npc.socialLog ?? [];
      npc.socialLog.push({ verb: "askOut", line, at: Date.now() });
      this.persistNpcSocial(npc);
      // Hot topics, first slice, 27 Aug 2026 — a new player-NPC
      // relationship is exactly the kind of news the rest of the crew
      // would pick up on. "you" reads naturally here since this always
      // surfaces IN a Talk exchange with the player themselves (see
      // renderHotTopicLine's own test for this exact case).
      this.hotTopics.push({
        kind: "gotTogether",
        aboutPilotId: npc.pilotId,
        aboutName: npc.displayName.split("—")[0].trim(),
        withName: "you",
        at: Date.now(),
        mentionedBy: [],
      });
      return;
    }

    // Rejected — the direct reaction happens on her, right now, in her own
    // voice (sadness reads as a wistful decline better than anger here).
    const rejectLine = pickLineForMessage(npc.ambient, { kind: "emotion", echo: "sadness" });
    this.showBubble(npc, rejectLine, now);
    npc.socialLog = npc.socialLog ?? [];
    npc.socialLog.push({ verb: "askOut", line: rejectLine, at: Date.now() });
    this.persistNpcSocial(npc);

    // Then, separately, word starts moving — same shape as startRumor()'s
    // debug version (a different NPC starts the gossip, not the rejector
    // herself, since her own in-voice reaction just happened above), but
    // with the real asker/rejector names instead of a fabricated pair.
    const others = this.npcs.filter((n) => n.pilotId !== npc.pilotId);
    if (others.length === 0) return; // nobody else around to start the gossip — the direct reaction above still stands on its own
    const gossipSource = others[Math.floor(Math.random() * others.length)];
    const rourke = WARDEN_PILOTS.find((p) => p.id === "pilot_rourke");
    const askerName = rourke ? rourke.displayName.split("—")[0].trim() : "The Commander";
    const rejectorName = npc.displayName.split("—")[0].trim();
    const message: HubMessage = { kind: "rumor", askerName, rejectorName };
    const gossipLine = pickLineForMessage(gossipSource.ambient, message);
    this.time.delayedCall(PROPAGATION_HOP_DELAY_MS, () => {
      this.showBubble(gossipSource, gossipLine, this.time.now);
      this.propagate(gossipSource, message, new Set([gossipSource.pilotId]), 1);
    });
  }

  // --- Antfarm build economy, first slice, 27 Aug 2026 -------------------
  // Maxime: "the room should be built from asking the CO carabil... he ask
  // what you wana build. player gotta ask. 'build me this' mek workshop."
  // Small line banks rather than one hardcoded string apiece per outcome,
  // matching this file's own established pattern for any repeatable
  // in-fiction response (TOXIC_LINES, GOSSIP_WARM_LINES/GOSSIP_TOXIC_LINES).
  // {bay}/{cost}/{points}/{rank} are plain string placeholders substituted
  // in handleBuildRequest below — not a general template engine, just
  // enough to keep four outcome banks from needing four separate
  // hand-written sentences per bay.
  private pickBuildLine(lines: string[]): string {
    return lines[Math.floor(Math.random() * lines.length)];
  }

  private buildLine(bayId: BuildableBayId): string {
    return RESERVED_BAYS.find((b) => b.id === bayId)!.label.replace("\n(reserved)", "").replace(/\n/g, " ");
  }

  // Recognized, but no space carved out yet — see chatIntent.ts's own
  // KnownUnbuildableId header for why these two specifically get an honest
  // "not yet" instead of either silence or a fabricated build. weaponsBay/
  // fabricator GRADUATED out of this bank 28 Aug 2026 once real deck space
  // (RESERVED_BAYS above) and real effects existed for them — see
  // chatIntent.ts's own BuildableBayId comment for the same graduation
  // noted from that file's side.
  private readonly BUILD_UNAVAILABLE_LINES: Record<KnownUnbuildableId, string[]> = {
    recRoom: ["Rec Room's already up and running — you'll find it on the lower deck."],
    mekWorkshop: ["A proper workshop for the Meks — I like it. Nobody's drawn that one up yet, though."],
  };

  private handleBuildRequest(request: BuildRequest) {
    const co = this.npcs.find((n) => n.pilotId === CO_PILOT_ID);
    if (!co) return; // shouldn't happen — the CO exists the moment buildNpcs() runs
    const now = this.time.now;

    if (request.kind === "unbuildable") {
      this.showBubble(co, this.pickBuildLine(this.BUILD_UNAVAILABLE_LINES[request.id]), now);
      return;
    }

    const bayId = request.id;
    const bayName = this.buildLine(bayId);
    const built = this.campaignState.builtBays ?? [];

    if (built.includes(bayId)) {
      this.showBubble(co, `${bayName}'s already standing, Commander.`, now);
      return;
    }

    const rank = this.campaignState.rourkeRank;
    if (built.length >= RANK_BAY_SLOTS[rank]) {
      this.showBubble(co, `Not at your rank yet — a ${rankDisplayTitle(rank)} doesn't get the space for that. Wait for the next bar.`, now);
      return;
    }

    const cost = BAY_BUILD_COST[bayId];
    if (this.campaignState.points < cost) {
      this.showBubble(co, `We don't have the material for that yet. ${bayName} runs ${cost}, and we're sitting on ${this.campaignState.points}.`, now);
      return;
    }

    this.campaignState.points -= cost;
    this.campaignState.builtBays = [...built, bayId];
    saveCampaignState(this.campaignState);
    this.markBayBuilt(bayId);
    this.showBubble(co, `Approved. ${bayName}, logged and building.`, now);
  }

  // --- Social history view — Hub polish, 26 Aug 2026 --------------------
  // Read-only, no engine state of its own — every socialLog entry already
  // existed and was already persisted (campaignState.ts section 11); this
  // is purely "read it back out and show it." Built once, up front, same
  // convention as the three minigame overlays, then shown/hidden and
  // re-rendered on open — but with no per-frame update loop of its own,
  // since nothing here animates or accepts input beyond the close button.
  private buildHistoryOverlay() {
    this.historyOverlay = this.add.container(0, 0).setDepth(60).setVisible(false);

    const bg = this.add
      .rectangle(480, 330, ROOM_BOUNDS.right - ROOM_BOUNDS.left, ROOM_BOUNDS.bottom - ROOM_BOUNDS.top, PANEL_BG, 0.96)
      .setStrokeStyle(1, PANEL_BORDER);
    this.historyOverlay.add(bg);

    this.historyText = this.add
      .text(480, ROOM_BOUNDS.top + 26, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: TEXT_MAIN,
        align: "left",
        wordWrap: { width: 600 },
        lineSpacing: 8,
      })
      .setOrigin(0.5, 0);
    this.historyOverlay.add(this.historyText);

    const closeBtn = this.add
      .text(ROOM_BOUNDS.right - 20, ROOM_BOUNDS.top + 20, "[ close — Esc ]", { fontFamily: "monospace", fontSize: "11px", color: TEXT_DIM })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    closeBtn.on("pointerdown", () => this.closeHistory());
    this.historyOverlay.add(closeBtn);
  }

  private openHistory(npc: HubNpc) {
    this.historyOpen = true;
    this.historyOverlay.setVisible(true);
    this.renderHistory(npc);
  }

  private closeHistory() {
    this.historyOpen = false;
    this.historyOverlay.setVisible(false);
  }

  // Most-recent-first, capped at HISTORY_ENTRY_LIMIT — a full unbounded
  // dump would run off the panel for anyone with a long history, and
  // "recent" is what §3's own ask ("the record take in everything") needs
  // surfaced first regardless. The full log is still all on record in
  // CampaignState either way; this is a display cap, not a data cap — same
  // "no silent caps" distinction this project holds elsewhere, worth
  // stating since it's the kind of thing that's easy to conflate.
  private renderHistory(npc: HubNpc) {
    const name = npc.displayName.split("—")[0].trim();
    const log = npc.socialLog ?? [];
    if (log.length === 0) {
      this.historyText.setText(`${name} — nothing on record yet.\n\nNo interactions logged between you two so far.`);
      return;
    }
    const recent = log.slice(-HISTORY_ENTRY_LIMIT).reverse();
    const omitted = log.length - recent.length;
    const lines = recent.map((e) => `${historyTimeLabel(e.at)} — ${e.line}`);
    const header = omitted > 0 ? `${name} — recent history (${omitted} earlier entr${omitted === 1 ? "y" : "ies"} not shown)` : `${name} — history`;
    this.historyText.setText(`${header}\n\n${lines.join("\n\n")}`);
  }

  // --- Highlights reel — Social Sim Roadmap #11, 27 Aug 2026 -----------
  // Same construction as buildHistoryOverlay directly above (one text
  // block, one close button, no per-frame update of its own) — the two
  // are siblings, not variants of each other, so this is its own
  // container/text pair rather than a second mode bolted onto History's.
  private buildHighlightsOverlay() {
    this.highlightsOverlay = this.add.container(0, 0).setDepth(60).setVisible(false);

    const bg = this.add
      .rectangle(480, 330, ROOM_BOUNDS.right - ROOM_BOUNDS.left, ROOM_BOUNDS.bottom - ROOM_BOUNDS.top, PANEL_BG, 0.96)
      .setStrokeStyle(1, PANEL_BORDER);
    this.highlightsOverlay.add(bg);

    this.highlightsText = this.add
      .text(480, ROOM_BOUNDS.top + 26, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: TEXT_MAIN,
        align: "left",
        wordWrap: { width: 600 },
        lineSpacing: 8,
      })
      .setOrigin(0.5, 0);
    this.highlightsOverlay.add(this.highlightsText);

    const closeBtn = this.add
      .text(ROOM_BOUNDS.right - 20, ROOM_BOUNDS.top + 20, "[ close — Esc ]", { fontFamily: "monospace", fontSize: "11px", color: TEXT_DIM })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    closeBtn.on("pointerdown", () => this.closeHighlights());
    this.highlightsOverlay.add(closeBtn);
  }

  private openHighlights(npc: HubNpc) {
    this.highlightsOpen = true;
    this.highlightsOverlay.setVisible(true);
    this.renderHighlights(npc);
  }

  private closeHighlights() {
    this.highlightsOpen = false;
    this.highlightsOverlay.setVisible(false);
  }

  // Two sections, deliberately built and labeled differently — see
  // highlights.ts's own header for why. The dated reel itself is now two
  // real sources merged into one chronological list, 28 Aug 2026 (Maxime:
  // "highlight reel should date itself with calandar. down to the sec."):
  // "First <verb>" milestones (buildFirstMilestones, reading
  // npc.socialLog directly, same array reference every other verb-logging
  // call site already writes into) and, new this pass, real Stage-
  // promotion milestones (buildStagePromotionMilestones, reading the
  // pilot's own campaign-persistent stagePromotedAt). Both render with
  // calendarTimeLabel now — a real date/time, not the vague relative "Xd
  // ago" historyTimeLabel still uses for the separate History panel. The
  // "Currently:" block below them stays a live, deliberately undated
  // snapshot — reusing exactly the same data updateProximity()'s
  // favorability label already shows (npcPartnerLabel, stageBadge) rather
  // than inventing a second source of truth for either; a pilot's CURRENT
  // Stage is still worth showing even once their promotion INTO it has its
  // own dated entry above.
  private renderHighlights(npc: HubNpc) {
    const name = npc.displayName.split("—")[0].trim();
    const verbMilestones = buildFirstMilestones(npc.socialLog);
    const stageMilestones = buildStagePromotionMilestones(this.campaignState.pilots[npc.pilotId]?.social?.stagePromotedAt);

    const reelEntries: { at: number; text: string }[] = [
      ...verbMilestones.map((m) => ({ at: m.at, text: `${m.label}: "${m.line}"` })),
      ...stageMilestones.map((m) => ({ at: m.at, text: m.label })),
    ].sort((a, b) => a.at - b.at);

    const milestoneLines =
      reelEntries.length > 0 ? reelEntries.map((e) => `${calendarTimeLabel(e.at)} — ${e.text}`) : ["Nothing to look back on yet."];

    const partner = this.npcPartnerLabel(npc);
    const rival = this.npcRivalLabel(npc);
    const statusLines = [`Stage: ${stageBadge(npc.ambient.stage)}`, partner ? `Relationship: ${partner}` : "Relationship: not together"];
    if (rival) statusLines.push(`Friction: ${rival}`);

    const body = [`${name} — highlights`, "", ...milestoneLines, "", "Currently: (undated — a status, not a moment)", ...statusLines].join("\n");
    this.highlightsText.setText(body);
  }

  // --- Rec Room help panel, 28 Aug 2026 ---------------------------------
  // Shared by all three minigames (Bloom_Wars_Rec_Room_Help_Panel_Plan_v1.md)
  // rather than three near-duplicate panels — a fourth minigame later
  // (Tetris/Asteroids, "one day," per the plan doc's own note) just needs
  // its own rules string passed in here, nothing else new. Built as a
  // child of the caller's own overlay container, so hiding the parent
  // overlay (leaving the minigame) always hides an open help panel too —
  // no separate cleanup needed, no stale "help was left open" state to
  // carry into the next session at that table.
  private buildRulesHelpPanel(bodyText: string, onDismiss: () => void): Phaser.GameObjects.Container {
    const panel = this.add.container(0, 0).setVisible(false);

    // Interactive on purpose, not just a backdrop: this panel is added
    // last (on top) within its parent overlay, so without its own
    // listener a click here would otherwise hit-test through to whatever
    // sits underneath at that pixel (the leave/close button included,
    // per §12.1's own topOnly hit-testing) and silently exit the whole
    // minigame instead of just the help text. Click-anywhere-to-dismiss
    // is also the friendlier interaction, and makes the hint text below
    // literally true instead of just Esc-true.
    const bg = this.add
      .rectangle(480, 330, ROOM_BOUNDS.right - ROOM_BOUNDS.left - 32, ROOM_BOUNDS.bottom - ROOM_BOUNDS.top - 32, PANEL_BG, 0.98)
      .setStrokeStyle(1, 0x4a7a9a) // == ACCENT — Graphics/shape strokes take a numeric color, not the CSS hex string, same distinction DARTS_INNER_RING_COLOR's own comment already makes
      .setInteractive({ useHandCursor: true });
    bg.on("pointerdown", onDismiss);
    panel.add(bg);

    // Smaller/tighter than the History and Highlights text panels
    // (11px/8 lineSpacing) on purpose — the peg board's ruleset is the
    // longest of the three (Reach + Knot both need real explaining) and
    // was measured, in a live screenshot smoke test, to run right up
    // against the hint line below at 11px/6. 10px/4 was re-checked the
    // same way and clears it with real margin on all three panels.
    const text = this.add
      .text(480, ROOM_BOUNDS.top + 32, bodyText, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: TEXT_MAIN,
        align: "left",
        wordWrap: { width: 560 },
        lineSpacing: 4,
      })
      .setOrigin(0.5, 0);
    panel.add(text);

    const hint = this.add.text(480, ROOM_BOUNDS.bottom - 24, "[ ? or Esc — back to the game ]", { fontFamily: "monospace", fontSize: "10px", color: TEXT_DIM }).setOrigin(0.5);
    panel.add(hint);

    return panel;
  }

  // --- The peg board — Rec Room minigame #3 of 3, 26 Aug 2026 ----------
  // Built once, up front (same convention as the door markers), then
  // shown/hidden and re-rendered as the game actually plays. All of the
  // real rules live in src/engine/pegBoard.ts; everything below is purely
  // "turn engine state into pixels and clicks."
  private buildPegBoardOverlay() {
    this.pegOverlay = this.add.container(0, 0).setDepth(60).setVisible(false);

    const bg = this.add
      .rectangle(480, 330, ROOM_BOUNDS.right - ROOM_BOUNDS.left, ROOM_BOUNDS.bottom - ROOM_BOUNDS.top, PANEL_BG, 0.96)
      .setStrokeStyle(1, PANEL_BORDER);
    this.pegOverlay.add(bg);

    const title = this.add.text(PEG_CENTER.x, ROOM_BOUNDS.top + 24, "THE PEG BOARD", { fontFamily: "monospace", fontSize: "14px", color: TEXT_MAIN }).setOrigin(0.5);
    this.pegOverlay.add(title);

    this.pegStatusText = this.add
      .text(PEG_CENTER.x, ROOM_BOUNDS.top + 46, "", { fontFamily: "monospace", fontSize: "12px", color: ACCENT, align: "center", wordWrap: { width: 560 } })
      .setOrigin(0.5);
    this.pegOverlay.add(this.pegStatusText);

    this.pegBoardGfx = this.add.graphics();
    this.pegOverlay.add(this.pegBoardGfx);

    for (let id = 0; id < 9; id++) {
      const p = pegDotPixel(id);
      const zone = this.add.circle(p.x, p.y, PEG_ZONE_RADIUS, 0xffffff, 0).setInteractive({ useHandCursor: true });
      zone.on("pointerdown", () => this.onPegDotClicked(id));
      this.pegOverlay.add(zone);
    }

    const closeBtn = this.add
      .text(ROOM_BOUNDS.right - 20, ROOM_BOUNDS.top + 20, "[ leave — Esc ]", { fontFamily: "monospace", fontSize: "11px", color: TEXT_DIM })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    closeBtn.on("pointerdown", () => this.closePegBoard());
    this.pegOverlay.add(closeBtn);

    const helpBtn = this.add
      .text(ROOM_BOUNDS.left + 20, ROOM_BOUNDS.top + 20, "[ ? ]", { fontFamily: "monospace", fontSize: "11px", color: ACCENT })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true });
    helpBtn.on("pointerdown", () => this.togglePegHelp());
    this.pegOverlay.add(helpBtn);

    this.pegHelpOverlay = this.buildRulesHelpPanel(PEG_BOARD_RULES_TEXT, () => this.closePegHelp());
    this.pegOverlay.add(this.pegHelpOverlay);
  }

  private togglePegHelp() {
    this.pegHelpOpen = !this.pegHelpOpen;
    this.pegHelpOverlay.setVisible(this.pegHelpOpen);
  }

  private closePegHelp() {
    this.pegHelpOpen = false;
    this.pegHelpOverlay.setVisible(false);
  }

  private startPegBoard(npc: HubNpc) {
    this.pegOpponent = npc;
    this.pegGame = createPegGame();
    this.pegFirstClick = null;
    this.pegFinalLine = "";
    this.pegOpen = true;
    this.pegOverlay.setVisible(true);
    this.renderPegBoard();
  }

  private closePegBoard() {
    this.pegOpen = false;
    this.pegOverlay.setVisible(false);
    this.pegGame = null;
    this.pegOpponent = null;
    this.pegFirstClick = null;
    this.closePegHelp(); // don't leave the panel open for next time this table's opened
  }

  private onPegDotClicked(dotId: number) {
    if (this.pegHelpOpen) return; // help panel owns input while open — see togglePegHelp
    const game = this.pegGame;
    if (!game || game.status !== "playing" || game.turn !== PEG_HUMAN_SIDE) return;

    const legal = pegLegalMoves(game);
    const isFreeOpening = game.pathEnd[PEG_HUMAN_SIDE] === null && !(game.pendingReach && game.pendingReach.side !== PEG_HUMAN_SIDE);

    if (isFreeOpening) {
      if (this.pegFirstClick === null) {
        if (!legal.some((m) => m.from === dotId)) return; // not a usable starting dot
        this.pegFirstClick = dotId;
        this.renderPegBoard();
        return;
      }
      const from = this.pegFirstClick;
      this.pegFirstClick = null;
      if (from === dotId) {
        this.renderPegBoard();
        return;
      }
      const move = legal.find((m) => m.from === from && m.to === dotId);
      if (!move) {
        this.renderPegBoard();
        return;
      }
      this.applyPegMove(move);
      return;
    }

    // Every other case (continuing an existing path, or answering a
    // Shield) — the start point is fixed by the engine, so one click
    // (the destination) is the whole move.
    const move = legal.find((m) => m.to === dotId);
    if (!move) return;
    this.applyPegMove(move);
  }

  private applyPegMove(move: PegMove) {
    if (!this.pegGame) return;
    this.pegGame = applyPegBoardMove(this.pegGame, move);
    this.renderPegBoard();
    this.maybeAdvancePegGame();
  }

  // Runs after every move, human or AI: ends the game if it's over,
  // otherwise hands the AI its turn (on a short delay, purely for
  // pacing — an instant AI reply reads as the board just being on rails).
  private maybeAdvancePegGame() {
    const game = this.pegGame;
    if (!game) return;
    if (game.status !== "playing") {
      this.finishPegBoard(game.status);
      return;
    }
    if (game.turn === PEG_AI_SIDE) {
      this.time.delayedCall(500, () => {
        const current = this.pegGame;
        if (!current || current.status !== "playing" || current.turn !== PEG_AI_SIDE) return;
        const move = pickPegAiMove(current, PEG_AI_SIDE);
        if (!move) return; // shouldn't happen — resolveEndConditions inside applyMove would already have ended the game
        this.pegGame = applyPegBoardMove(current, move);
        this.renderPegBoard();
        this.maybeAdvancePegGame();
      });
    }
  }

  // Win/lose/draw against the peg board is a real, dynamic outcome (see
  // verbs.ts's own note on why pegBoard has no fixed VerbOutcome) — the
  // Favorability nudge and flavor line are applied here, same shape and
  // same "not a locked number" caveat as shareADrink's own +5 above.
  private finishPegBoard(status: Exclude<PegGameState["status"], "playing">) {
    const npc = this.pegOpponent;
    if (!npc) {
      this.closePegBoard();
      return;
    }
    const humanWon = status.winner === PEG_HUMAN_SIDE;
    const draw = status.winner === "draw";
    this.pegFinalLine = humanWon ? "You win the peg board." : draw ? "The board jams — a draw." : "You lose the peg board.";
    this.renderPegBoard();

    const delta = humanWon ? 6 : draw ? 2 : -2;
    npc.favorability += delta;
    const { line } = this.pickAmbientLineWithMemory(npc);
    npc.socialLog = npc.socialLog ?? [];
    npc.socialLog.push({ verb: "pegBoard", line, at: Date.now() });
    this.persistNpcSocial(npc);

    this.time.delayedCall(1800, () => {
      const closingNpc = this.pegOpponent;
      this.closePegBoard();
      if (closingNpc) this.showBubble(closingNpc, line, this.time.now);
    });
  }

  private renderPegBoard() {
    const game = this.pegGame;
    if (!game) return;
    const g = this.pegBoardGfx;
    g.clear();

    const humanTurnLegal = game.status === "playing" && game.turn === PEG_HUMAN_SIDE ? pegLegalMoves(game) : [];
    const legalTargets = new Set(humanTurnLegal.map((m) => m.to));

    for (const line of game.lines) {
      const p1 = pegDotPixel(line.a);
      const p2 = pegDotPixel(line.b);
      g.lineStyle(line.exempt ? 4 : 3, line.side === PEG_HUMAN_SIDE ? PEG_PLAYER_COLOR : PEG_AI_COLOR, line.exempt ? 0.7 : 1);
      g.lineBetween(p1.x, p1.y, p2.x, p2.y);
    }

    for (let id = 0; id < 9; id++) {
      const p = pegDotPixel(id);
      g.fillStyle(game.locked.has(id) ? PEG_LOCKED_COLOR : PEG_DOT_COLOR, 1);
      g.fillCircle(p.x, p.y, PEG_DOT_RADIUS);
      if (this.pegFirstClick === id) {
        g.lineStyle(2, PEG_PLAYER_COLOR, 1);
        g.strokeCircle(p.x, p.y, PEG_DOT_RADIUS + 5);
      } else if (legalTargets.has(id)) {
        g.lineStyle(2, PEG_PLAYER_COLOR, 0.7);
        g.strokeCircle(p.x, p.y, PEG_DOT_RADIUS + 4);
      }
    }

    this.pegStatusText.setText(this.pegStatusLine());
  }

  private pegStatusLine(): string {
    const game = this.pegGame;
    if (!game) return "";
    if (game.status !== "playing") return this.pegFinalLine;
    if (game.pendingReach) {
      return game.pendingReach.side === PEG_HUMAN_SIDE
        ? "Reach! Waiting to see if it holds..."
        : "SHIELD OR LOSE — click either end to close it.";
    }
    if (game.turn === PEG_HUMAN_SIDE) {
      return game.pathEnd[PEG_HUMAN_SIDE] === null
        ? "Your opening — click a dot, then where to draw from it."
        : "Your move — click where to draw.";
    }
    const name = this.pegOpponent?.displayName.split("—")[0].trim() ?? "Opponent";
    return `${name} is thinking...`;
  }

  // --- Poker (Texas Hold'em) — Rec Room minigame, 26 Aug 2026 -----------
  // Real rules/AI live in src/engine/holdem.ts (on top of the generic
  // src/engine/cardTable/ substrate); everything below is purely "turn
  // engine state into pixels and clicks," same division of labor as the
  // peg board above it.
  private makeCardSlot(pos: { x: number; y: number }): Phaser.GameObjects.Text {
    const t = this.add
      .text(pos.x, pos.y, "", { fontFamily: "monospace", fontSize: "15px", color: TEXT_MAIN, backgroundColor: POKER_CARD_BACK, padding: { x: 6, y: 4 } })
      .setOrigin(0.5);
    this.pokerOverlay.add(t);
    return t;
  }

  private makeActionButton(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Text {
    const btn = this.add.text(x, y, label, { fontFamily: "monospace", fontSize: "12px", color: ACCENT }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    btn.on("pointerdown", onClick);
    this.pokerOverlay.add(btn);
    return btn;
  }

  private buildPokerOverlay() {
    this.pokerOverlay = this.add.container(0, 0).setDepth(60).setVisible(false);

    const bg = this.add
      .rectangle(480, 330, ROOM_BOUNDS.right - ROOM_BOUNDS.left, ROOM_BOUNDS.bottom - ROOM_BOUNDS.top, PANEL_BG, 0.96)
      .setStrokeStyle(1, PANEL_BORDER);
    this.pokerOverlay.add(bg);

    const title = this.add.text(480, ROOM_BOUNDS.top + 24, "POKER — TEXAS HOLD'EM", { fontFamily: "monospace", fontSize: "14px", color: TEXT_MAIN }).setOrigin(0.5);
    this.pokerOverlay.add(title);

    this.pokerStatusText = this.add
      .text(480, POKER_STATUS_Y, "", { fontFamily: "monospace", fontSize: "12px", color: ACCENT, align: "center", wordWrap: { width: 620 } })
      .setOrigin(0.5);
    this.pokerOverlay.add(this.pokerStatusText);

    this.pokerPotText = this.add.text(480, POKER_POT_Y, "", { fontFamily: "monospace", fontSize: "12px", color: TEXT_DIM }).setOrigin(0.5);
    this.pokerOverlay.add(this.pokerPotText);

    this.pokerAiCardTexts = pokerRowSlots(POKER_AI_ROW_Y, 2).map((p) => this.makeCardSlot(p));
    this.pokerCommunityTexts = pokerRowSlots(POKER_COMMUNITY_Y, 5).map((p) => this.makeCardSlot(p));
    this.pokerHumanCardTexts = pokerRowSlots(POKER_HUMAN_ROW_Y, 2).map((p) => this.makeCardSlot(p));

    this.pokerFoldBtn = this.makeActionButton(230, POKER_BUTTON_Y, "[ FOLD ]", () => this.onPokerAction({ type: "fold" }));
    this.pokerCheckCallBtn = this.makeActionButton(380, POKER_BUTTON_Y, "", () => {
      if (!this.pokerGame) return;
      const legal = pokerLegalActions(this.pokerGame, 0);
      this.onPokerAction(legal.check ? { type: "check" } : { type: "call" });
    });
    this.pokerRaiseBtn = this.makeActionButton(530, POKER_BUTTON_Y, "[ RAISE ]", () => {
      if (!this.pokerGame) return;
      const legal = pokerLegalActions(this.pokerGame, 0);
      if (legal.raise) this.onPokerAction({ type: "raise", to: legal.raise.minTo });
    });
    this.pokerAllInBtn = this.makeActionButton(680, POKER_BUTTON_Y, "[ ALL-IN ]", () => {
      if (!this.pokerGame) return;
      const legal = pokerLegalActions(this.pokerGame, 0);
      if (legal.raise) this.onPokerAction({ type: "raise", to: legal.raise.maxTo });
      else if (legal.call) this.onPokerAction({ type: "call" }); // stack is already <= a call — this IS the all-in
    });

    const closeBtn = this.add
      .text(ROOM_BOUNDS.right - 20, ROOM_BOUNDS.top + 20, "[ leave — Esc ]", { fontFamily: "monospace", fontSize: "11px", color: TEXT_DIM })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    closeBtn.on("pointerdown", () => this.closePoker());
    this.pokerOverlay.add(closeBtn);

    const helpBtn = this.add
      .text(ROOM_BOUNDS.left + 20, ROOM_BOUNDS.top + 20, "[ ? ]", { fontFamily: "monospace", fontSize: "11px", color: ACCENT })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true });
    helpBtn.on("pointerdown", () => this.togglePokerHelp());
    this.pokerOverlay.add(helpBtn);

    this.pokerHelpOverlay = this.buildRulesHelpPanel(POKER_RULES_TEXT, () => this.closePokerHelp());
    this.pokerOverlay.add(this.pokerHelpOverlay);
  }

  private togglePokerHelp() {
    this.pokerHelpOpen = !this.pokerHelpOpen;
    this.pokerHelpOverlay.setVisible(this.pokerHelpOpen);
  }

  private closePokerHelp() {
    this.pokerHelpOpen = false;
    this.pokerHelpOverlay.setVisible(false);
  }

  private startPoker(npc: HubNpc) {
    this.pokerOpponent = npc;
    this.pokerGame = createHoldemGame();
    this.pokerFinalLine = "";
    this.pokerOpen = true;
    this.pokerOverlay.setVisible(true);
    this.renderPoker();
    this.maybeAdvancePoker();
  }

  private closePoker() {
    this.pokerOpen = false;
    this.pokerOverlay.setVisible(false);
    this.pokerGame = null;
    this.pokerOpponent = null;
    this.closePokerHelp(); // don't leave the panel open for next time this table's opened
  }

  private onPokerAction(action: BettingAction) {
    if (this.pokerHelpOpen) return; // help panel owns input while open — see togglePokerHelp
    const game = this.pokerGame;
    if (!game || game.status !== "playing" || game.betting.actingIndex !== 0) return;
    applyHoldemAction(game, 0, action);
    this.renderPoker();
    this.maybeAdvancePoker();
  }

  // Runs after every action (human or AI) and after every hand resolves.
  // Three cases: the AI owes the next action (short delay, same pacing
  // purpose as the peg board's own 500ms — an instant reply reads as
  // rigged); a hand just ended but nobody's busted (pause on the result,
  // then deal the next hand automatically — a poker sitting is many hands,
  // not a per-hand button click); or the session itself just ended
  // (someone busted — finishPoker applies the real Favorability outcome).
  private maybeAdvancePoker() {
    const game = this.pokerGame;
    if (!game) return;

    if (game.status === "handOver") {
      this.renderPoker();
      if (game.bustedPlayer) {
        this.time.delayedCall(2200, () => this.finishPoker());
      } else {
        this.time.delayedCall(2200, () => {
          const current = this.pokerGame;
          if (!current || current.status !== "handOver" || current.bustedPlayer) return;
          startNextHoldemHand(current);
          this.renderPoker();
          this.maybeAdvancePoker();
        });
      }
      return;
    }

    if (game.betting.actingIndex === 1) {
      this.renderPoker();
      this.time.delayedCall(600, () => {
        const current = this.pokerGame;
        if (!current || current.status !== "playing" || current.betting.actingIndex !== 1) return;
        applyHoldemAction(current, 1, pickPokerAiAction(current));
        this.renderPoker();
        this.maybeAdvancePoker();
      });
    } else {
      this.renderPoker();
    }
  }

  // Session end (someone's felted) is the real, dynamic outcome — same
  // "no fixed VerbOutcome, Hub.ts applies the delta itself" shape as the
  // peg board (verbs.ts's own note). A poker sitting is a bigger
  // commitment than one peg board game, so its swing is a little wider:
  // ±6/-3 rather than the peg board's +6/+2/-2 — not a locked number,
  // same placeholder caveat as every other Favorability touch in this scene.
  private finishPoker() {
    const game = this.pokerGame;
    const npc = this.pokerOpponent;
    if (!game || !npc) {
      this.closePoker();
      return;
    }
    const humanWon = game.bustedPlayer === "ai";
    this.pokerFinalLine = humanWon ? "You clean out the table." : "You're felted — the table's done.";
    this.renderPoker();

    const delta = humanWon ? 6 : -3;
    npc.favorability += delta;
    const { line } = this.pickAmbientLineWithMemory(npc);
    npc.socialLog = npc.socialLog ?? [];
    npc.socialLog.push({ verb: "poker", line, at: Date.now() });
    this.persistNpcSocial(npc);

    this.time.delayedCall(1800, () => {
      const closingNpc = this.pokerOpponent;
      this.closePoker();
      if (closingNpc) this.showBubble(closingNpc, line, this.time.now);
    });
  }

  private setPokerCardSlot(slot: Phaser.GameObjects.Text, card: Card | null, faceUp: boolean) {
    if (!card) {
      slot.setText("");
      slot.setBackgroundColor(POKER_CARD_BACK);
      return;
    }
    if (!faceUp) {
      slot.setText("??");
      slot.setColor(TEXT_DIM);
      slot.setBackgroundColor(POKER_CARD_BACK);
      return;
    }
    slot.setText(cardLabel(card));
    slot.setColor(cardIsRed(card) ? POKER_RED_SUIT : POKER_BLACK_SUIT);
    slot.setBackgroundColor(POKER_CARD_FACE);
  }

  private pokerOpponentName(): string {
    return this.pokerOpponent?.displayName.split("—")[0].trim() ?? "Opponent";
  }

  private renderPoker() {
    const game = this.pokerGame;
    if (!game) return;

    this.pokerPotText.setText(`Pot: ${pokerPotTotal(game)}   You: ${game.players[0].stack}   ${this.pokerOpponentName()}: ${game.players[1].stack}`);

    for (let i = 0; i < 5; i++) this.setPokerCardSlot(this.pokerCommunityTexts[i], game.community[i] ?? null, true);
    for (let i = 0; i < 2; i++) this.setPokerCardSlot(this.pokerHumanCardTexts[i], game.players[0].holeCards[i] ?? null, true);

    // The AI's hole cards only ever show up at a real showdown — folding
    // never reveals either hand, same as real poker.
    const revealAi = game.status === "handOver" && game.lastResult !== null && !game.lastResult.wonByFold;
    for (let i = 0; i < 2; i++) this.setPokerCardSlot(this.pokerAiCardTexts[i], game.players[1].holeCards[i] ?? null, revealAi);

    this.pokerStatusText.setText(this.pokerStatusLine());

    const isHumanTurn = game.status === "playing" && game.betting.actingIndex === 0;
    const legal = isHumanTurn ? pokerLegalActions(game, 0) : null;

    this.pokerFoldBtn.setVisible(!!legal?.fold);
    if (legal?.check) {
      this.pokerCheckCallBtn.setText("[ CHECK ]").setVisible(true);
    } else if (legal?.call) {
      this.pokerCheckCallBtn.setText(`[ CALL ${legal.call.amount} ]`).setVisible(true);
    } else {
      this.pokerCheckCallBtn.setVisible(false);
    }
    if (legal?.raise) {
      this.pokerRaiseBtn.setText(`[ RAISE TO ${legal.raise.minTo} ]`).setVisible(true);
    } else {
      this.pokerRaiseBtn.setVisible(false);
    }
    this.pokerAllInBtn.setVisible(!!legal && (!!legal.raise || !!legal.call));
  }

  private pokerStatusLine(): string {
    const game = this.pokerGame;
    if (!game) return "";
    if (game.status === "handOver") {
      if (this.pokerFinalLine) return this.pokerFinalLine; // the session itself just ended — finishPoker set this
      const r = game.lastResult;
      if (!r) return "Hand over.";
      if (r.wonByFold) {
        return r.winner === "human" ? `${this.pokerOpponentName()} folds — you take the pot.` : `You fold — ${this.pokerOpponentName()} takes the pot.`;
      }
      if (r.winner === "split") return "Split pot — the same hand both ways.";
      const handName = describeHand((r.winner === "human" ? r.humanHand : r.aiHand)!);
      return r.winner === "human" ? `You win with ${handName}.` : `${this.pokerOpponentName()} wins with ${handName}.`;
    }
    if (game.betting.actingIndex === 1) return `${this.pokerOpponentName()} is thinking...`;
    return `Your move — ${STREET_LABEL[game.street]}.`;
  }

  // --- Fletchers (darts) — Rec Room minigame, 26 Aug 2026 ---------------
  // Real rules/AI live in src/engine/darts.ts; everything below is purely
  // rendering + input, same division of labor as the peg board/Poker
  // sections above. The one genuinely new piece here is the live aim
  // meter: dartsMeterElapsed accumulates in update() while dartsMeterLive
  // is true, dartsMeterPos()/dartsAccuracyFromPos() (module-level
  // functions, above) turn that into the value a throw actually locks in.
  private buildDartsOverlay() {
    this.dartsOverlay = this.add.container(0, 0).setDepth(60).setVisible(false);

    const bg = this.add
      .rectangle(480, 330, ROOM_BOUNDS.right - ROOM_BOUNDS.left, ROOM_BOUNDS.bottom - ROOM_BOUNDS.top, PANEL_BG, 0.96)
      .setStrokeStyle(1, PANEL_BORDER);
    this.dartsOverlay.add(bg);

    // "FLETCHERS — DARTS," not just "FLETCHERS": Maxime's own ease-of-use
    // call, 26 Aug 2026 — "dart" is easier to remember than the in-fiction
    // name alone, so the mechanical name rides along on-screen rather than
    // being chat-only. Fletchers stays the canonical verb/room name
    // (VERBS.fletchers.label, the Rec Room's own flavor); this is purely
    // the modal's own display text.
    const title = this.add.text(480, ROOM_BOUNDS.top + 24, "FLETCHERS — DARTS", { fontFamily: "monospace", fontSize: "14px", color: TEXT_MAIN }).setOrigin(0.5);
    this.dartsOverlay.add(title);

    // The board itself — concentric rings drawn once from
    // DART_ZONE_THRESHOLDS so this drawing can never quietly drift out of
    // sync with what actually scores. Static (never redrawn); only the
    // last-throw marker dots below it change per render.
    this.dartsBoardGfx = this.add.graphics();
    this.drawDartsBoardRings();
    this.dartsOverlay.add(this.dartsBoardGfx);

    this.dartsStatusText = this.add
      .text(480, DARTS_STATUS_Y, "", { fontFamily: "monospace", fontSize: "12px", color: ACCENT, align: "center", wordWrap: { width: 620 } })
      .setOrigin(0.5);
    this.dartsOverlay.add(this.dartsStatusText);

    this.dartsResultText = this.add.text(480, DARTS_RESULT_Y, "", { fontFamily: "monospace", fontSize: "11px", color: TEXT_DIM, align: "center" }).setOrigin(0.5);
    this.dartsOverlay.add(this.dartsResultText);

    this.dartsScoreText = this.add.text(480, DARTS_SCORE_Y, "", { fontFamily: "monospace", fontSize: "12px", color: TEXT_MAIN }).setOrigin(0.5);
    this.dartsOverlay.add(this.dartsScoreText);

    // The meter's static frame (outline + colored zone bands, derived from
    // the same thresholds as the board rings) — drawn once, doesn't move.
    const meterFrame = this.add.graphics();
    this.drawDartsMeterFrame(meterFrame);
    this.dartsOverlay.add(meterFrame);

    // The moving marker — redrawn every frame while dartsMeterLive.
    this.dartsMeterGfx = this.add.graphics();
    this.dartsOverlay.add(this.dartsMeterGfx);

    // Not reusing makeActionButton here — it hardcodes adding to
    // pokerOverlay (fine for Poker's own four buttons, wrong parent for
    // this one), so this button is built the same way inline instead.
    this.dartsThrowBtn = this.add.text(480, DARTS_THROW_BUTTON_Y, "[ THROW ]", { fontFamily: "monospace", fontSize: "13px", color: ACCENT }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.dartsThrowBtn.on("pointerdown", () => this.onDartsThrow());
    this.dartsOverlay.add(this.dartsThrowBtn);

    const closeBtn = this.add
      .text(ROOM_BOUNDS.right - 20, ROOM_BOUNDS.top + 20, "[ leave — Esc ]", { fontFamily: "monospace", fontSize: "11px", color: TEXT_DIM })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    closeBtn.on("pointerdown", () => this.closeDarts());
    this.dartsOverlay.add(closeBtn);

    const helpBtn = this.add
      .text(ROOM_BOUNDS.left + 20, ROOM_BOUNDS.top + 20, "[ ? ]", { fontFamily: "monospace", fontSize: "11px", color: ACCENT })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true });
    helpBtn.on("pointerdown", () => this.toggleDartsHelp());
    this.dartsOverlay.add(helpBtn);

    this.dartsHelpOverlay = this.buildRulesHelpPanel(DARTS_RULES_TEXT, () => this.closeDartsHelp());
    this.dartsOverlay.add(this.dartsHelpOverlay);
  }

  private toggleDartsHelp() {
    this.dartsHelpOpen = !this.dartsHelpOpen;
    this.dartsHelpOverlay.setVisible(this.dartsHelpOpen);
  }

  private closeDartsHelp() {
    this.dartsHelpOpen = false;
    this.dartsHelpOverlay.setVisible(false);
  }

  private drawDartsBoardRings() {
    const g = this.dartsBoardGfx;
    const c = DARTS_BOARD_CENTER;
    const r = DARTS_BOARD_RADIUS;
    // Largest (miss boundary) first, smallest (bullseye) last — each fill
    // paints over the ring outside it, same "outer to inner" order real
    // dartboard art uses.
    g.fillStyle(DARTS_MISS_RING_COLOR, 1);
    g.fillCircle(c.x, c.y, r);
    g.fillStyle(0x3a4552, 1);
    g.fillCircle(c.x, c.y, r * (1 - DART_ZONE_THRESHOLDS.outer));
    g.fillStyle(0x4a5568, 1);
    g.fillCircle(c.x, c.y, r * (1 - DART_ZONE_THRESHOLDS.mid));
    g.fillStyle(DARTS_INNER_RING_COLOR, 1);
    g.fillCircle(c.x, c.y, r * (1 - DART_ZONE_THRESHOLDS.inner));
    g.fillStyle(0xd88a4a, 1);
    g.fillCircle(c.x, c.y, r * (1 - DART_ZONE_THRESHOLDS.bullseye));
    g.lineStyle(1, PANEL_BORDER, 1);
    g.strokeCircle(c.x, c.y, r);
  }

  private drawDartsMeterFrame(g: Phaser.GameObjects.Graphics) {
    const left = DARTS_METER_LEFT;
    const right = DARTS_METER_RIGHT;
    const width = right - left;
    const mid = (left + right) / 2;
    const y = DARTS_METER_Y - DARTS_METER_HEIGHT / 2;
    // Bands mirrored left/right of center, same thresholds as the board —
    // widthFor(threshold) is how far from center a given accuracy zone
    // reaches, in meter pixels, per dartsAccuracyFromPos's own inverse.
    const widthFor = (threshold: number) => ((1 - threshold) / 2) * width;
    g.fillStyle(DARTS_MISS_RING_COLOR, 1);
    g.fillRect(left, y, width, DARTS_METER_HEIGHT);
    g.fillStyle(0x3a4552, 1);
    g.fillRect(mid - widthFor(DART_ZONE_THRESHOLDS.outer), y, widthFor(DART_ZONE_THRESHOLDS.outer) * 2, DARTS_METER_HEIGHT);
    g.fillStyle(0x4a5568, 1);
    g.fillRect(mid - widthFor(DART_ZONE_THRESHOLDS.mid), y, widthFor(DART_ZONE_THRESHOLDS.mid) * 2, DARTS_METER_HEIGHT);
    g.fillStyle(DARTS_INNER_RING_COLOR, 1);
    g.fillRect(mid - widthFor(DART_ZONE_THRESHOLDS.inner), y, widthFor(DART_ZONE_THRESHOLDS.inner) * 2, DARTS_METER_HEIGHT);
    g.fillStyle(0xd88a4a, 1);
    g.fillRect(mid - widthFor(DART_ZONE_THRESHOLDS.bullseye), y, widthFor(DART_ZONE_THRESHOLDS.bullseye) * 2, DARTS_METER_HEIGHT);
    g.lineStyle(1, PANEL_BORDER, 1);
    g.strokeRect(left, y, width, DARTS_METER_HEIGHT);
  }

  private startDarts(npc: HubNpc) {
    this.dartsOpponent = npc;
    this.dartsGame = createDartsGame();
    this.dartsFinalLine = "";
    this.dartsLastResultLine = "";
    this.dartsOpen = true;
    this.dartsOverlay.setVisible(true);
    this.renderDarts();
    this.maybeAdvanceDarts();
  }

  private closeDarts() {
    this.dartsOpen = false;
    this.dartsMeterLive = false;
    this.dartsOverlay.setVisible(false);
    this.dartsGame = null;
    this.dartsOpponent = null;
    this.closeDartsHelp(); // don't leave the panel open for next time this table's opened
  }

  private onDartsThrow() {
    if (this.dartsHelpOpen) return; // help panel owns input while open — see toggleDartsHelp
    const game = this.dartsGame;
    if (!game || game.status !== "playing" || game.turn !== "human" || !this.dartsMeterLive) return;
    const pos = dartsMeterPos(this.dartsMeterElapsed);
    const aim = dartsAccuracyFromPos(pos);
    this.dartsMeterLive = false;
    const { state, result } = throwDart(game, aim);
    this.dartsGame = state;
    this.dartsLastResultLine = `You: ${zoneLabel(result.zone)} (+${result.score})`;
    this.renderDarts();
    this.maybeAdvanceDarts();
  }

  // Runs after every throw (human or AI) and at session start. Three
  // cases, same shape as maybeAdvancePoker: the AI owes the next throw
  // (short delay, same pacing purpose as the peg board's 500ms/Poker's
  // 600ms — an instant AI throw reads as rigged); it's the human's turn
  // again, so the meter starts sweeping fresh; or the session itself just
  // ended (all rounds complete — finishDarts applies the real
  // Favorability outcome).
  private maybeAdvanceDarts() {
    const game = this.dartsGame;
    if (!game) return;

    if (game.status === "over") {
      this.dartsMeterLive = false;
      this.finishDarts();
      return;
    }

    if (game.turn === "ai") {
      this.dartsMeterLive = false;
      this.renderDarts();
      this.time.delayedCall(700, () => {
        const current = this.dartsGame;
        if (!current || current.status !== "playing" || current.turn !== "ai") return;
        const aim = pickAiThrowValue();
        const { state, result } = throwDart(current, aim);
        this.dartsGame = state;
        this.dartsLastResultLine = `${this.dartsOpponentName()}: ${zoneLabel(result.zone)} (+${result.score})`;
        this.renderDarts();
        this.maybeAdvanceDarts();
      });
    } else {
      this.dartsMeterLive = true;
      this.dartsMeterElapsed = 0;
      this.renderDarts();
    }
  }

  // Session end (all rounds thrown) is the real, dynamic outcome — same
  // "no fixed VerbOutcome, Hub.ts applies the delta itself" shape as the
  // peg board and Poker (verbs.ts's own note). Reuses the peg board's own
  // +6/+2/-2 swing rather than Poker's wider one — a darts round is a
  // quick game like the peg board, not a multi-hand sitting.
  private finishDarts() {
    const game = this.dartsGame;
    const npc = this.dartsOpponent;
    if (!game || !npc) {
      this.closeDarts();
      return;
    }
    const humanWon = game.winner === "human";
    const draw = game.winner === "draw";
    this.dartsFinalLine = humanWon
      ? `You take the board, ${game.totals.human}-${game.totals.ai}.`
      : draw
        ? `Dead even, ${game.totals.human}-${game.totals.ai} — a draw.`
        : `You lose the board, ${game.totals.human}-${game.totals.ai}.`;
    this.renderDarts();

    const delta = humanWon ? 6 : draw ? 2 : -2;
    npc.favorability += delta;
    const { line } = this.pickAmbientLineWithMemory(npc);
    npc.socialLog = npc.socialLog ?? [];
    npc.socialLog.push({ verb: "fletchers", line, at: Date.now() });
    this.persistNpcSocial(npc);

    this.time.delayedCall(1800, () => {
      const closingNpc = this.dartsOpponent;
      this.closeDarts();
      if (closingNpc) this.showBubble(closingNpc, line, this.time.now);
    });
  }

  private dartsOpponentName(): string {
    return this.dartsOpponent?.displayName.split("—")[0].trim() ?? "Opponent";
  }

  // Marker dots for each side's most recent throw — fixed opposite angles
  // (human upper-left, AI upper-right) rather than a random-per-throw
  // angle, so a redraw never makes an already-thrown dart appear to move.
  // Radius comes straight from that throw's own accuracy, same
  // 1-accuracy mapping the meter uses, so a dot's position on the board
  // always matches the zone its status/result text names.
  private drawDartsMarkers() {
    const g = this.dartsBoardGfx;
    // Re-draw the static rings first (Graphics has no per-shape removal),
    // then layer the marker dots on top.
    this.drawDartsBoardRings();
    const game = this.dartsGame;
    if (!game) return;
    const c = DARTS_BOARD_CENTER;
    const r = DARTS_BOARD_RADIUS;
    const lastHuman = game.throws.human[game.throws.human.length - 1];
    const lastAi = game.throws.ai[game.throws.ai.length - 1];
    if (lastHuman) {
      const radius = r * (1 - lastHuman.accuracy);
      g.fillStyle(DARTS_PLAYER_COLOR, 1);
      g.fillCircle(c.x - radius * 0.7, c.y - radius * 0.7, 5);
    }
    if (lastAi) {
      const radius = r * (1 - lastAi.accuracy);
      g.fillStyle(DARTS_AI_COLOR, 1);
      g.fillCircle(c.x + radius * 0.7, c.y - radius * 0.7, 5);
    }
  }

  private renderDarts() {
    const game = this.dartsGame;
    if (!game) return;

    this.dartsScoreText.setText(`You: ${game.totals.human}   ${this.dartsOpponentName()}: ${game.totals.ai}   Round ${Math.min(game.round, game.totalRounds)}/${game.totalRounds}`);
    this.dartsStatusText.setText(this.dartsStatusLine());
    this.dartsResultText.setText(this.dartsLastResultLine);
    this.drawDartsMarkers();

    const canThrow = game.status === "playing" && game.turn === "human" && this.dartsMeterLive;
    this.dartsThrowBtn.setVisible(game.status === "playing").setAlpha(canThrow ? 1 : 0.4);
    // The moving marker only redraws itself per-frame while dartsMeterLive
    // (see update()'s dartsOpen gate) — clear it here whenever the meter
    // isn't live, so it never sits frozen mid-sweep during the AI's turn
    // or the pause after a throw resolves.
    if (!this.dartsMeterLive) this.dartsMeterGfx.clear();
  }

  private dartsStatusLine(): string {
    const game = this.dartsGame;
    if (!game) return "";
    if (game.status === "over") return this.dartsFinalLine;
    if (game.turn === "ai") return `${this.dartsOpponentName()} is aiming...`;
    return `Round ${game.round}/${game.totalRounds} — your throw (dart ${game.dartsThrownThisTurn + 1}/${game.dartsPerRound}). Click THROW when the marker's where you want it.`;
  }

  // Redraws just the moving marker line — called every frame from
  // update() while dartsMeterLive, kept separate from renderDarts() (which
  // only needs to run on real state changes, not 60x/sec).
  private renderDartsMeter() {
    const g = this.dartsMeterGfx;
    g.clear();
    const pos = dartsMeterPos(this.dartsMeterElapsed);
    const x = DARTS_METER_LEFT + pos * (DARTS_METER_RIGHT - DARTS_METER_LEFT);
    g.lineStyle(3, DARTS_METER_MARKER_COLOR, 1);
    g.lineBetween(x, DARTS_METER_Y - DARTS_METER_HEIGHT / 2 - 4, x, DARTS_METER_Y + DARTS_METER_HEIGHT / 2 + 4);
  }

  // overrideLine: used by the not-yet-built-verb case above so it shows a
  // specific "not open yet" line instead of the generic CHAT_FALLBACK_LINES
  // shrug, while still reusing the exact same nearby-NPCs/no-propagation
  // shape — neither case is a real HubMessage, so neither ever ripples.
  private showFallback(overrideLine?: string) {
    const now = this.time.now;
    const line = overrideLine ?? CHAT_FALLBACK_LINES[Math.floor(Math.random() * CHAT_FALLBACK_LINES.length)];
    for (const npc of this.npcs) {
      if (!sameDeck(npc.room, this.currentRoomId)) continue;
      const dist = Phaser.Math.Distance.Between(this.playerX, this.playerY, npc.x, npc.y);
      if (dist > TALK_RADIUS) continue;
      this.showBubble(npc, line, now);
    }
  }

  // Catalyst dictionary reaction, Hub polish 26 Aug 2026 — see
  // catalystProfile.ts's own header for the full design reasoning
  // (Maxime: "feed a chat box a dictionary... work word based on its
  // animal path... less of a gate," then the instinct/thought/action
  // sub-animal follow-up, confirmed "go ham... we doing it"). Only called
  // from submitChat's own true catch-all (interpretPlayerChat returned
  // null) — every other showFallback() call site (verb/history requests
  // made in the wrong room, no target in range, etc.) is untouched and
  // still shows its own specific override line, unconditionally, exactly
  // as before this pass.
  //
  // The shrug line is picked ONCE per submit, same as showFallback() —
  // every NPC who doesn't get a dictionary hit still shares the one
  // generic line, so a room full of misses doesn't read as N different
  // random shrugs. Same non-propagation rule as showFallback() itself:
  // neither a hit nor a miss is a real HubMessage, so nothing here ripples.
  private showCatalystOrFallback(raw: string) {
    const now = this.time.now;
    const shrug = CHAT_FALLBACK_LINES[Math.floor(Math.random() * CHAT_FALLBACK_LINES.length)];
    // Dictionary hits are collected rather than shown immediately, so a
    // genuine catalyst clash (below) can be told apart from an ordinary hit
    // before any bubble goes up. Hot-topic and shrug branches are
    // unaffected — they still show the instant they're decided, exactly as
    // before this pass.
    const hits: { npc: HubNpc; line: string; catalyst: Catalyst }[] = [];
    for (const npc of this.npcs) {
      if (!sameDeck(npc.room, this.currentRoomId)) continue;
      const dist = Phaser.Math.Distance.Between(this.playerX, this.playerY, npc.x, npc.y);
      if (dist > TALK_RADIUS) continue;
      const reaction = pickCatalystReaction(npc.ambient, npc.pilotId, raw);
      if (reaction) {
        // reaction.catalyst, not npc.ambient.catalyst — a hit can come from
        // a sub-animal (source: "instinct"/"thought"/"action"), and a clash
        // is about which VALUES the shown line actually voices, not the
        // pilot's fixed primary identity. A wolf pilot whose sub-animal
        // happens to be shark, answering via that sub-animal, genuinely
        // clashes with a real shark pilot's line the same way two primary
        // sharks would — reaction.catalyst is what pickAmbientLineWithBleed
        // (roadmap #2, just above) already treats as the source of truth
        // for "which catalyst is actually speaking," same reasoning here.
        hits.push({ npc, line: reaction.line, catalyst: reaction.catalyst });
        continue;
      }
      // Hot topics, second consumer, 27 Aug 2026 (roadmap #1's own
      // deferred stretch goal) — a dictionary miss no longer always means
      // the shared shrug. If this NPC has fresh gossip about someone
      // else, it can surface here instead, same roll/reuse-once rules as
      // the speak() consumer. Checked only on a MISS, on purpose: a real
      // dictionary hit is always the more specific, more relevant thing
      // to say about what the player actually typed, so gossip never
      // preempts it — this only fills in what used to be a flat shrug.
      const topic = pickHotTopicForSpeaker(this.hotTopics, npc.pilotId);
      if (topic && Math.random() < HOT_TOPIC_SPEAK_CHANCE) {
        const line = renderHotTopicLine(topic, npc.ambient.catalyst);
        this.showBubble(npc, line, now);
        topic.mentionedBy.push(npc.pilotId);
        continue;
      }
      this.showBubble(npc, shrug, now);
    }

    // Catalyst "clash" reactions, 27 Aug 2026 (roadmap #10) — see
    // catalystProfile.ts's own header for the full design, including the
    // honest correction that multiple NPCs independently reacting to the
    // same line already worked before this pass (verified live, not
    // assumed). What's new here is staging a genuinely OPPOSED pair as a
    // two-beat back-and-forth — the first NPC's line immediately, the
    // clashing NPC's line NPC_REPLY_DELAY_MS later — the same beat
    // runNpcEncounter's own talk-result rebuttal already uses for the exact
    // same "let the first line land before the second one answers it"
    // reason, so it reads as a real disagreement rather than two bubbles
    // that both happened to pop up at once. Every non-clashing hit (the
    // ordinary case) still shows immediately, unchanged. Only the first
    // opposed pair found is staged this way — see findCatalystClash's own
    // comment for why more than one pair at once isn't attempted.
    const clash = findCatalystClash(hits.map((h) => ({ pilotId: h.npc.pilotId, catalyst: h.catalyst })));
    for (const hit of hits) {
      if (clash && hit.npc.pilotId === clash[1].pilotId) {
        const { npc, line } = hit;
        this.time.delayedCall(NPC_REPLY_DELAY_MS, () => {
          this.showBubble(npc, line, this.time.now);
        });
      } else {
        this.showBubble(hit.npc, hit.line, now);
      }
    }
  }

  // Every deck draws its own floor rectangle/ellipse now — Lower and Upper
  // each at their own (bigger, since the egg-hull second pass) box, the
  // grotto as a real ellipse (drawGrottoFloor, right below). Built once
  // per deck, not per room-switch, since nothing about any of their
  // positions/sizes changes between rooms sharing a deck. Exactly one of
  // lowerFloor/upperFloor/grottoFloor is visible at a time —
  // refreshRoomVisibility toggles by current deck, since drawing more than
  // one at once would show overlapping straight-edged rectangles (or a
  // rectangle poking out past the grotto's curve).
  private drawDeckFloor(bounds: { left: number; right: number; top: number; bottom: number }): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    g.fillStyle(0x14181c, 1);
    g.fillRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
    g.lineStyle(2, PANEL_BORDER, 1);
    g.strokeRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
    return g;
  }

  // The egg hull, 27 Aug 2026 — the grotto's real oval floor, drawn as its
  // own layer rather than reshaping drawRoom() itself, since Upper/Lower
  // still need the plain rectangle unchanged. Phaser's fillEllipse/
  // strokeEllipse both take a CENTER point plus full width/height (not a
  // corner + size, like fillRect above) — GROTTO_ELLIPSE already stores
  // radii, hence the *2 below.
  private drawGrottoFloor() {
    const g = this.add.graphics();
    g.fillStyle(0x14181c, 1);
    g.fillEllipse(GROTTO_ELLIPSE.cx, GROTTO_ELLIPSE.cy, GROTTO_ELLIPSE.rx * 2, GROTTO_ELLIPSE.ry * 2);
    g.lineStyle(2, PANEL_BORDER, 1);
    g.strokeEllipse(GROTTO_ELLIPSE.cx, GROTTO_ELLIPSE.cy, GROTTO_ELLIPSE.rx * 2, GROTTO_ELLIPSE.ry * 2);
    this.grottoFloor = g;
  }

  // Where a mustered NPC walks to (piece #2) — a placeholder stand-in for
  // an actual bay/door, since the room has neither yet. Drawn distinctly
  // (dashed-style outline, GDD §12.2 placeholder conventions) so it reads
  // as a real destination rather than an invisible game-logic point.
  // Rec-Room-only — visibility toggled by refreshRoomVisibility(), same as
  // the door markers below.
  private drawMusterPoint() {
    const w = 90;
    const h = 46;
    const x = MUSTER_POINT.x - w / 2;
    const y = MUSTER_POINT.y - h / 2;
    const g = this.add.graphics();
    g.lineStyle(1, 0x6b7d8a, 0.7);
    const dash = 6;
    for (let dx = 0; dx < w; dx += dash * 2) {
      g.lineBetween(x + dx, y, x + Math.min(dx + dash, w), y);
      g.lineBetween(x + dx, y + h, x + Math.min(dx + dash, w), y + h);
    }
    for (let dy = 0; dy < h; dy += dash * 2) {
      g.lineBetween(x, y + dy, x, y + Math.min(dy + dash, h));
      g.lineBetween(x + w, y + dy, x + w, y + Math.min(dy + dash, h));
    }
    this.bayOutline = g;
    this.bayLabel = this.add.text(MUSTER_POINT.x, MUSTER_POINT.y, "BAY", { fontFamily: "monospace", fontSize: "10px", color: "#6b7d8a" }).setOrigin(0.5);
  }

  // Phase 2 map growth — one marker per DOORS entry, built once up front
  // (not rebuilt per room-switch) and toggled visible/hidden by
  // refreshRoomVisibility() depending on whether its own `room` matches
  // wherever the player currently is. Solid outline, distinct from the
  // bay's dashed one, same GDD §12.2 placeholder spirit either way.
  private buildDoors() {
    for (const d of DOORS) {
      const w = 90;
      const h = 20;
      const g = this.add.graphics();
      g.lineStyle(1, 0x6b7d8a, 0.9);
      g.strokeRect(d.x - w / 2, d.y - h / 2, w, h);
      const label = this.add.text(d.x, d.y, `> ${d.label}`, { fontFamily: "monospace", fontSize: "9px", color: "#6b7d8a" }).setOrigin(0.5);
      this.doorMarkers.push({ def: d, outline: g, label });
    }
  }

  // Antfarm Grid v0, 27 Aug 2026 — §3f's open floor: a deck with more than
  // one room needs its OTHER rooms to read as real places even before the
  // player's walked into them, since there's no door forcing a discrete
  // "you have arrived" moment anymore. Two things per non-grotto room: a
  // thin dashed divider along its own zone rect's edges (reusing the exact
  // dash-drawing loop drawMusterPoint already uses, so this reads as the
  // same placeholder visual language rather than a new one) and a floating
  // name label near the top of its own zone. Built once, toggled by DECK
  // (not exact zone) in refreshRoomVisibility — you can see the rest of an
  // open deck from anywhere on it, same as the stairs/bay markers.
  private buildZoneDecor() {
    const dash = 6;
    const dashedRect = (b: { left: number; right: number; top: number; bottom: number }) => {
      const g = this.add.graphics();
      g.lineStyle(1, PANEL_BORDER, 0.8);
      for (let dx = b.left; dx < b.right; dx += dash * 2) {
        g.lineBetween(dx, b.top, Math.min(dx + dash, b.right), b.top);
        g.lineBetween(dx, b.bottom, Math.min(dx + dash, b.right), b.bottom);
      }
      for (let dy = b.top; dy < b.bottom; dy += dash * 2) {
        g.lineBetween(b.left, dy, b.left, Math.min(dy + dash, b.bottom));
        g.lineBetween(b.right, dy, b.right, Math.min(dy + dash, b.bottom));
      }
      return g;
    };
    for (const id of Object.keys(ROOM_ZONE_BOUNDS) as RoomId[]) {
      if (id === "grotto") continue; // alone on its own deck — the deck-wide box already reads as its one room, no divider/second label needed
      const b = ROOM_ZONE_BOUNDS[id];
      const nodes: (Phaser.GameObjects.Graphics | Phaser.GameObjects.Text)[] = [dashedRect(b)];
      // Only the two smaller right-column rooms per deck (hangarDeck/
      // berths/vault/cic) get a floating label — recroom and workshop are
      // each their deck's own full-height "main" room and already read
      // via the title bar the instant you're standing in them.
      if (b.right - b.left < ROOM_BOUNDS.right - ROOM_BOUNDS.left) {
        nodes.push(this.add.text((b.left + b.right) / 2, b.top + 16, ROOM_TITLES[id], { fontFamily: "monospace", fontSize: "10px", color: TEXT_DIM }).setOrigin(0.5));
      }
      this.zoneDecor.push({ room: id, nodes });
    }
  }

  // The egg hull, second pass, 27 Aug 2026 — one dashed marker + label per
  // RESERVED_BAYS entry (see its own header for what "reserved" means
  // here). Same dash-drawing shape as drawMusterPoint's BAY marker above,
  // built once up front and toggled by deck in refreshRoomVisibility, same
  // pattern as doorMarkers/zoneDecor.
  //
  // Antfarm build economy, first slice, 27 Aug 2026 — split the actual
  // drawing out into drawReservedBayOutline() so the same shape can be
  // redrawn solid once a bay is actually built (markBayBuilt, called from
  // handleBuildRequest) instead of only ever drawn once as dashed. Reads
  // campaignState.builtBays on scene start too, so a save that already has
  // a bay built shows it correctly from the first frame, not just after
  // the next build this session.
  private drawReservedBayOutline(g: Phaser.GameObjects.Graphics, bay: ReservedBayDef, built: boolean) {
    const w = 68;
    const h = 40;
    const dash = 6;
    const x = bay.x - w / 2;
    const y = bay.y - h / 2;
    g.clear();
    if (built) {
      // Solid outline, brighter color — reads as "real" against the still-
      // dashed reserved markers around it, same visual language a built
      // vs. planned structure would use anywhere else in this file.
      g.lineStyle(2, 0x8fd0ff, 0.9);
      g.strokeRect(x, y, w, h);
      return;
    }
    g.lineStyle(1, 0x556270, 0.7);
    for (let dx = 0; dx < w; dx += dash * 2) {
      g.lineBetween(x + dx, y, x + Math.min(dx + dash, w), y);
      g.lineBetween(x + dx, y + h, x + Math.min(dx + dash, w), y + h);
    }
    for (let dy = 0; dy < h; dy += dash * 2) {
      g.lineBetween(x, y + dy, x, y + Math.min(dy + dash, h));
      g.lineBetween(x + w, y + dy, x + w, y + Math.min(dy + dash, h));
    }
  }

  private buildReservedBays() {
    const built = this.campaignState.builtBays ?? [];
    for (const bay of RESERVED_BAYS) {
      const isBuilt = built.includes(bay.id);
      const g = this.add.graphics();
      this.drawReservedBayOutline(g, bay, isBuilt);
      const label = this.add
        .text(bay.x, bay.y, isBuilt ? bay.label.replace("\n(reserved)", "") : bay.label, {
          fontFamily: "monospace",
          fontSize: "8px",
          color: isBuilt ? "#8fd0ff" : "#556270",
          align: "center",
        })
        .setOrigin(0.5);
      this.reservedBayMarkers.push({ def: bay, outline: g, label });
    }
  }

  // Called from handleBuildRequest the moment a build actually goes
  // through — flips one marker from dashed/"(reserved)" to solid/built
  // without rebuilding the other three or touching campaignState again
  // (the caller already did that).
  private markBayBuilt(bayId: ReservedBayId) {
    const marker = this.reservedBayMarkers.find((m) => m.def.id === bayId);
    if (!marker) return; // shouldn't happen — every ReservedBayId has exactly one marker
    this.drawReservedBayOutline(marker.outline, marker.def, true);
    marker.label.setColor("#8fd0ff");
    marker.label.setText(marker.def.label.replace("\n(reserved)", ""));
  }

  private buildNpcs() {
    // Fixed starting layout inside the room — seats at the Rec Room table.
    // Stationary by default (Phase 1 scope; general autonomous roaming is
    // still Phase 3, per the Build Plan doc's 25 Aug addendum) — the one
    // exception is a muster call, which walks an NPC to MUSTER_POINT
    // (see updateNpcMovement/sendToMuster). All three stay in Rec Room —
    // see the file header's own note on why the Phase 2 map growth doesn't
    // move or reassign them.
    const positions = [
      // Antfarm Grid v0, 27 Aug 2026 — these three used to be spread across
      // the FULL ROOM_BOUNDS width (130-830); recroom is now only the
      // left-hand slice of that box (130-550, see ROOM_ZONE_BOUNDS above),
      // shared with Hangar Deck and Berths on the rest of the lower deck's
      // open floor. Re-centered within recroom's own narrower zone so
      // nobody's still sitting in what's now Hangar Deck's floor space.
      { x: ROOM_ZONE_BOUNDS.recroom.left + 90, y: ROOM_BOUNDS.top + 160 },
      { x: ROOM_ZONE_BOUNDS.recroom.right - 90, y: ROOM_BOUNDS.top + 160 },
      { x: (ROOM_ZONE_BOUNDS.recroom.left + ROOM_ZONE_BOUNDS.recroom.right) / 2, y: ROOM_BOUNDS.bottom - 90 },
    ];
    this.npcs = NPC_SEED.map((seed, i) => {
      const pilot = WARDEN_PILOTS.find((p) => p.id === seed.pilotId);
      const displayName = pilot?.displayName ?? seed.pilotId;
      const initials = pilotInitials(displayName);
      const color = PATH_COLORS[(pilot?.archetypeId.includes("tank") ? "tank" : pilot?.archetypeId.includes("reeps") ? "reeps" : "meeps") as keyof typeof PATH_COLORS];
      const pos = positions[i];
      // Real, data-driven romanceable — see HubNpc's own comment for why
      // this used to be a hand-set boolean and isn't anymore. Falls back to
      // true (open) only if the pilot or archetype lookup somehow misses —
      // matches every other WARDEN_PILOTS fallback in this file (e.g.
      // displayName above), which all fail open to something harmless
      // rather than throwing.
      const archetype = pilot ? UNIT_ARCHETYPES[pilot.archetypeId] : undefined;
      const romanceable = archetype ? isRomanceableSpecies(archetype.species) : true;

      // 26 Aug 2026 — Favorability/Stress/Morale/socialLog/inRelationship
      // now come from CampaignState, not straight off the seed. First time
      // ever seeing this pilot (a brand-new campaign, or an old save from
      // before this pass), ensureHubSocialState seeds it from NPC_SEED's
      // own placeholder values below — identical to what this scene always
      // did — and every load after that hands back whatever was last
      // persisted instead. See the file header's "Correction" note and
      // campaignState.ts section 11 for the full design, including why
      // catalyst alone is deliberately NOT part of this.
      const social = ensureHubSocialState(this.campaignState, seed.pilotId, {
        favorability: seed.favorability,
        stress: seed.stress,
        morale: seed.morale,
      });
      // drunk is derived from social.drunkUntil, not carried as its own
      // seeded boolean — a stale `true` sitting in an old save with no
      // expiry check yet run against it would otherwise read as drunk
      // forever the instant this field started persisting.
      const stillDrunk = !!social.drunkUntil && social.drunkUntil > Date.now();

      // Stage, wired 27 Aug 2026 (Maxime: "do the ranking path") — reads the
      // pilot's LIVE campaign tier (CampaignState.pilots[id].pilot.tier),
      // not the static WARDEN_PILOTS starting value the `pilot` lookup
      // above already uses for archetype/species — tier is a real,
      // mid-campaign-mutable stat (engine/campaignEconomy.ts's
      // purchaseTierUpgrade), so a promoted pilot needs to actually speak
      // in their new Stage's voice, not the one they started the campaign
      // with. Falls back to the static row's own tier if this pilot has no
      // live campaign entry yet (mirrors ensureHubSocialState's own
      // fail-open shape just above), then to "green" if neither exists.
      const liveTier = this.campaignState.pilots[seed.pilotId]?.pilot.tier ?? pilot?.tier;
      const stage = liveTier ? stageFromTier(liveTier) : "green";

      // Stage-promotion "graduation" reveal, 27 Aug 2026 — direct answer to
      // Maxime asking whether a player would ever actually notice the
      // ranking path. detectStagePromotion (ambientLines.ts) compares this
      // pilot's last-acknowledged stage against the one just derived above;
      // a real, unacknowledged change arms pendingStagePromotion for
      // speak()'s new branch below. undefined lastAcknowledgedStage (a
      // brand-new social state, or an old save predating this field) means
      // nothing to graduate FROM as far as the Hub's ever recorded, so it's
      // backfilled to the current stage rather than treated as a pending
      // promotion — see detectStagePromotion's own header for the full
      // reasoning, including why a real change is always exactly one Stage
      // step and never lands back on green.
      const pendingStagePromotion = detectStagePromotion(social.lastAcknowledgedStage, stage);
      if (social.lastAcknowledgedStage === undefined) {
        social.lastAcknowledgedStage = stage;
      }

      // "Hello, Sir" rank-deference greeting, 27 Aug 2026 — exact same
      // detect/backfill shape as pendingStagePromotion just above, but
      // compares against Rourke's OWN rank (campaignState-wide, not
      // per-pilot) rather than this pilot's Stage. See
      // data/ambientLines.ts's detectRankPromotion for the "why" and
      // HubPilotSocialState.lastAcknowledgedRourkeRank (campaignState.ts)
      // for the persisted half.
      const pendingRankGreeting = detectRankPromotion(social.lastAcknowledgedRourkeRank, this.campaignState.rourkeRank);
      if (social.lastAcknowledgedRourkeRank === undefined) {
        social.lastAcknowledgedRourkeRank = this.campaignState.rourkeRank;
      }

      const circle = this.add.circle(0, 0, NPC_R, color, 1).setStrokeStyle(2, 0xffffff, 0.25);
      const label = this.add.text(0, 0, initials, { fontFamily: "monospace", fontSize: "12px", color: "#ffffff" }).setOrigin(0.5);
      const nameTag = this.add
        .text(0, NPC_R + 12, displayName.split("—")[0].trim(), { fontFamily: "monospace", fontSize: "9px", color: TEXT_DIM })
        .setOrigin(0.5);
      const root = this.add.container(pos.x, pos.y, [circle, label, nameTag]);

      const favLabel = this.add.text(pos.x, pos.y - NPC_R - 14, "", { fontFamily: "monospace", fontSize: "9px", color: "#facc15" }).setOrigin(0.5).setVisible(false);
      const bubbleContainer = this.add.container(pos.x, pos.y - NPC_R - 30).setVisible(false);

      return {
        pilotId: seed.pilotId,
        displayName,
        initials,
        color,
        room: "recroom" as RoomId,
        x: pos.x,
        y: pos.y,
        // worried computed fresh here too, same as stillDrunk just above,
        // so an NPC reads correctly from the very first frame rather than
        // waiting on update()'s own updateMissionWorry() to catch up one
        // tick later — see isMissionWorrySignal's own header.
        ambient: { catalyst: seed.catalyst, stage, stress: social.stress, morale: social.morale, drunk: stillDrunk, worried: isMissionWorrySignal(this.campaignState) },
        favorability: social.favorability,
        circle,
        root,
        favLabel,
        bubbleContainer,
        bubbleUntil: 0,
        romanceable,
        inRelationship: social.inRelationship,
        drunkUntil: stillDrunk ? social.drunkUntil : undefined,
        // The exact array ensureHubSocialState handed back, not a copy —
        // see persistNpcSocial's own comment for why that's load-bearing.
        socialLog: social.socialLog,
        // Staggered starting offset (0-4s) so all three don't reconsider
        // their roam target on the exact same frame — same "don't move in
        // lockstep" instinct as the darts AI's own jitter.
        nextRoamAt: Math.random() * 4000,
        // Same staggering instinct as nextRoamAt, independent offset —
        // there's no reason the two clocks should sync up.
        nextEncounterAt: Math.random() * 4000,
        pendingStagePromotion,
        pendingRankGreeting,
        // Needs Counter — always starts fully fine (spec §5, not persisted).
        hunger: 100,
        thirst: 100,
        sleep: 100,
        // Same staggering instinct as nextRoamAt/nextEncounterAt above.
        nextNeedsTickAt: Math.random() * 4000,
      };
    });

    // The Carrier CO — Antfarm Grid v0 stress-test follow-up, 27 Aug 2026.
    // Maxime: "the groto suposed to be a room on the [middle] floor... free
    // roam to talk to the Carrier pilot. mr carabil" / confirmed "yeah him"
    // against the doc's already-locked name. Deliberately NOT folded into
    // NPC_SEED/the .map() above: every entry there is a real, deployable
    // WARDEN_PILOTS roster pilot — npcSeed.ts's own header says that data
    // also feeds the headless social-sim harness's mission-pairing events,
    // which don't apply to a CO who never deploys. He'd also fail the
    // WARDEN_PILOTS/UNIT_ARCHETYPES lookup above (undefined pilot, wrong
    // fallback color/name/romanceable) since he was never meant to be a mek
    // archetype. Built as a standalone HubNpc instead, pushed into the same
    // this.npcs array so every generic room/visibility/proximity/dialogue
    // system already keyed off that array picks him up for free.
    //
    // Name locked in Bloom_Wars_Antfarm_Carrier_Hub_v1.md §11.3, 23 Aug
    // 2026: Arangement of Content. Species confirmed Carabil this session —
    // "carabil" is now a real Species (data/types.ts) and a
    // ROMANCE_CAPPED_SPECIES entry (data/romance.ts), so his non-romanceable
    // status ("anything but Hiopi/Carabil," Antfarm §13) comes from the same
    // isRomanceableSpecies() check every other NPC uses, not a hand-set
    // boolean — the exact drift bug that check exists to prevent (see
    // romance.ts's own header on the Iyari miss).
    // CO_PILOT_ID is now a module-level const (see its own header, added
    // for the build-economy pass) — submitChat needs the same identifier
    // to gate build requests, so it moved out of this function's own
    // local scope rather than being duplicated as a second literal.
    const coDisplayName = "Arangement of Content";
    const coInitials = pilotInitials(coDisplayName);
    // Own color, not a PATH_COLORS pick — he isn't a meeps/tank/reeps/munti
    // combat archetype, so borrowing one of those four would misrepresent
    // him as a deployable pilot. Muted brass reads as rank/command.
    const CO_COLOR = 0xb08d4f;
    const coSocial = ensureHubSocialState(this.campaignState, CO_PILOT_ID, { favorability: 0, stress: 20, morale: 70 });
    // Grotto's open floor, off the x=480 line both stair markers sit on
    // (recroom/workshop hops land at (480,130)/(480,530) — see DOORS) so he
    // doesn't block the direct walking line between them.
    const coPos = { x: 350, y: 330 };
    const coCircle = this.add.circle(0, 0, NPC_R, CO_COLOR, 1).setStrokeStyle(2, 0xffffff, 0.25);
    const coLabel = this.add.text(0, 0, coInitials, { fontFamily: "monospace", fontSize: "12px", color: "#ffffff" }).setOrigin(0.5);
    const coNameTag = this.add
      .text(0, NPC_R + 12, coDisplayName, { fontFamily: "monospace", fontSize: "9px", color: TEXT_DIM })
      .setOrigin(0.5);
    const coRoot = this.add.container(coPos.x, coPos.y, [coCircle, coLabel, coNameTag]);
    const coFavLabel = this.add.text(coPos.x, coPos.y - NPC_R - 14, "", { fontFamily: "monospace", fontSize: "9px", color: "#facc15" }).setOrigin(0.5).setVisible(false);
    const coBubbleContainer = this.add.container(coPos.x, coPos.y - NPC_R - 30).setVisible(false);

    this.npcs.push({
      pilotId: CO_PILOT_ID,
      displayName: coDisplayName,
      initials: coInitials,
      color: CO_COLOR,
      room: "grotto",
      x: coPos.x,
      y: coPos.y,
      // Bear — placeholder catalyst pick, same "not a locked content
      // decision" caveat npcSeed.ts already carries for the other three;
      // steady/watchful/authority read fits a CO better than the three
      // catalysts already in use (raven/wolf/crow — Bosk/Anand/Iyari).
      // Stage hardcoded "command" rather than tier-derived — he isn't on
      // the WARDEN_PILOTS tier-promotion track this scene's other Stage
      // logic assumes, and "command" is the fitting register regardless.
      ambient: { catalyst: "bear", stage: "command", stress: coSocial.stress, morale: coSocial.morale, drunk: false, worried: isMissionWorrySignal(this.campaignState) },
      favorability: coSocial.favorability,
      circle: coCircle,
      root: coRoot,
      favLabel: coFavLabel,
      bubbleContainer: coBubbleContainer,
      bubbleUntil: 0,
      romanceable: isRomanceableSpecies("carabil"),
      inRelationship: coSocial.inRelationship,
      socialLog: coSocial.socialLog,
      // Deliberately no nextRoamAt/nextEncounterAt — updateNpcRoaming and
      // updateNpcEncounters both skip any NPC whose clock is undefined
      // (their own `=== undefined` guards), so leaving these unset is what
      // keeps him stationed at his post rather than wandering the ship or
      // getting swept into clique/rival rolls built for deployable pilots.
      // Needs Counter fields set (type requires them) but nextNeedsTickAt
      // deliberately left unset too, same convention — a CO who never
      // deploys isn't who this system is about; he just reads as
      // permanently 100/100/100 rather than opting into a system built for
      // pilots' off-duty life.
      hunger: 100,
      thirst: 100,
      sleep: 100,
    });

    // Click an NPC directly (as opposed to clicking empty room space, which
    // triggers the ordinary broadcast Talk verb) to provoke them — the
    // telephone-wave prototype's entry point. npcClickConsumed stops the
    // scene-wide pointerdown handler from ALSO firing a broadcast Talk on
    // the same click. Interactivity itself is toggled per room by
    // refreshRoomVisibility() — an NPC standing in a room the player isn't
    // in can't be clicked, on top of not being visible.
    for (const npc of this.npcs) {
      npc.circle.setInteractive({ useHandCursor: true });
      npc.circle.on("pointerdown", () => {
        this.npcClickConsumed = true;
        this.provoke(npc);
      });
    }

    this.checkMuntiLoss();
    this.checkMissionEcho();
  }

  // Munti-loss hot topic, 27 Aug 2026 (roadmap #13). Deliberately NOT shaped
  // like pendingStagePromotion/pendingRankGreeting just above — those are
  // per-NPC fields an NPC uses to self-announce their OWN news the next
  // time they're talked to. A permanently-lost pilot isn't in this.npcs at
  // all (NPC_SEED only ever seeds the 3 living Rec Room regulars), so
  // there's no one to hang a "pending" field off of and no self-announcing
  // possible. Instead this scans the full roster directly — every pilot
  // CampaignState actually knows about, not just the ones currently walking
  // around the Hub — for a Munti-path pilot marked permanently_lost whose
  // loss hasn't been surfaced yet, and registers the hot topic straight
  // into this.hotTopics so any nearby NPC can bring it up in their own
  // voice via speak()'s existing hot-topic check. Munti-path check mirrors
  // engine/campaignState.ts's own canLaunchMission (UNIT_ARCHETYPES[...].
  // path === "munti") — the same lookup, not a new one. ensureHubSocialState
  // is safe to call even for a pilot who was never in NPC_SEED (a generated
  // recruit who died before ever setting foot in the Hub): it creates a
  // fresh HubPilotSocialState on the spot, same fail-open behavior every
  // other call site already relies on.
  private checkMuntiLoss() {
    for (const pilotId of Object.keys(this.campaignState.pilots)) {
      const entry = this.campaignState.pilots[pilotId];
      if (entry.status !== "permanently_lost") continue;
      if (UNIT_ARCHETYPES[entry.pilot.archetypeId]?.path !== "munti") continue;
      const social = ensureHubSocialState(this.campaignState, pilotId, { favorability: 0, stress: 0, morale: 0 });
      if (social.muntiLossAnnounced) continue;
      social.muntiLossAnnounced = true;
      // Saved immediately, same instinct as ackStagePromotion/
      // ackRankGreeting persisting right when they flip their own one-shot
      // flag — not deferred to whatever verb happens to trigger the next
      // saveCampaignState call. Unlike those two, there's no "don't mark it
      // seen before the player's actually heard it" risk to weigh here
      // (this is ambient gossip any nearby NPC can surface, not a direct
      // one-on-one reveal), so there's no reason to hold off.
      saveCampaignState(this.campaignState);
      this.hotTopics.push({
        kind: "muntiLost",
        aboutPilotId: pilotId,
        aboutName: entry.pilot.displayName.split("—")[0].trim(),
        at: Date.now(),
        mentionedBy: [],
      });
    }
  }

  // Debrief-side echo, 27 Aug 2026 (roadmap #9). Same one-shot shape as
  // checkMuntiLoss just above, except reading a CampaignState-level flag
  // (lastMissionEcho) instead of scanning the roster — a mission outcome
  // isn't about any one pilot, so there's nothing to loop over here. See
  // campaignState.ts's own CampaignState.lastMissionEcho comment and
  // data/hotTopics.ts's own header for the full design, including the two
  // deliberate scope cuts (commander_down folded into "loss," the
  // "conspicuously avoided name" nuance not built).
  private checkMissionEcho() {
    const echo = this.campaignState.lastMissionEcho;
    if (!echo || echo.announced) return;
    echo.announced = true;
    // Saved immediately, same reasoning as checkMuntiLoss's own save call
    // just above — ambient gossip any nearby NPC can surface, not a
    // direct one-on-one reveal, so there's no "don't mark it seen too
    // early" risk to weigh.
    saveCampaignState(this.campaignState);
    this.hotTopics.push({
      kind: echo.outcome === "win" ? "missionWin" : "missionLoss",
      // Sentinel, not a real pilotId — see data/hotTopics.ts's own header
      // for why a mission-outcome topic still needs an aboutPilotId value
      // (pickHotTopicForSpeaker's "not about the speaker themselves"
      // check) despite not being about any one pilot. Mission ids and
      // pilot ids are two disjoint namespaces (mission_amaranth_12 vs.
      // pilot_bosk), so this can never accidentally match a real speaker.
      aboutPilotId: echo.missionId,
      aboutName: "",
      at: Date.now(),
      mentionedBy: [],
    });
  }

  private buildPlayer() {
    // Derived from the real WARDEN_PILOTS record rather than hardcoded —
    // caught in review, 25 Aug 2026: an earlier draft hardcoded "DR" here
    // while every NPC correctly derived initials from pilotInitials(). Same
    // convention as the NPCs, not a special case for the player.
    const rourke = WARDEN_PILOTS.find((p) => p.id === "pilot_rourke");
    const initials = rourke ? pilotInitials(rourke.displayName) : "??";

    const circle = this.add.circle(0, 0, PLAYER_R, PATH_COLORS.meeps, 1).setStrokeStyle(2, 0xffd166, 0.9);
    const label = this.add.text(0, 0, initials, { fontFamily: "monospace", fontSize: "12px", color: "#ffffff" }).setOrigin(0.5);
    this.player = this.add.container(this.playerX, this.playerY, [circle, label]);
  }

  update(_time: number, delta: number) {
    // Cheap, unconditional, independent of whatever overlay (if any) owns
    // input this frame — a drunk NPC's clock should keep running even
    // while, say, the peg board is open, not stall until it closes.
    this.updateDrunkExpiry();
    // Same reasoning, same unconditional placement — worry should keep
    // ticking even while an overlay owns input, not freeze the moment the
    // player opens the peg board.
    this.updateMissionWorry();
    // Same unconditional placement as the two above — a hungry or
    // under-slept pilot's meter shouldn't stall just because an overlay
    // owns input this frame.
    this.updateNeeds(this.time.now);
    // Same unconditional placement as the three above — a hot topic should
    // go stale on its own clock even while an overlay owns input.
    this.hotTopics = pruneExpiredHotTopics(this.hotTopics, Date.now());

    // Chat box open: suspend the game's own input handling entirely except
    // bubble fade-out (purely visual, harmless either way). Enter/Escape
    // are handled by the native DOM listener on the input itself (see
    // buildChatBox), not here — this is what stops WASD from also moving
    // the player around while the box has focus.
    if (this.chatOpen) {
      this.updateBubbles();
      return;
    }

    // Same shape as the chat-box gate above: the peg board overlay owns
    // input entirely while it's open (clicks go to its own dot zones, set
    // up in buildPegBoardOverlay), so normal movement/E/M/R/T are
    // suspended. Esc is the one key this scene still reads directly, to
    // let the player bail out mid-game.
    if (this.pegOpen) {
      this.updateBubbles();
      // Help panel open: it owns Esc for itself (back to the game, not
      // out of the game) — same "one level at a time" shape as any other
      // nested modal. Falls through to nothing else while open, same as
      // the outer gates below suspend normal play input.
      if (this.pegHelpOpen) {
        if (this.escKey && Phaser.Input.Keyboard.JustDown(this.escKey)) this.closePegHelp();
        return;
      }
      if (this.escKey && Phaser.Input.Keyboard.JustDown(this.escKey)) this.closePegBoard();
      return;
    }

    // Same shape again — the poker overlay owns input entirely while open
    // (clicks go to its own action buttons, set up in buildPokerOverlay).
    if (this.pokerOpen) {
      this.updateBubbles();
      if (this.pokerHelpOpen) {
        if (this.escKey && Phaser.Input.Keyboard.JustDown(this.escKey)) this.closePokerHelp();
        return;
      }
      if (this.escKey && Phaser.Input.Keyboard.JustDown(this.escKey)) this.closePoker();
      return;
    }

    // Same shape again — the darts overlay owns input entirely while
    // open. The one thing genuinely new versus the peg board/Poker gates
    // above: while dartsMeterLive, the aim meter needs to keep animating
    // every frame regardless of any click/key, so its own render call
    // happens here rather than only in response to a state change.
    if (this.dartsOpen) {
      this.updateBubbles();
      // Help open: freeze the meter rather than let it keep sweeping
      // unseen behind the panel — reopening the game shouldn't hand the
      // player a lock they didn't choose the timing of.
      if (this.dartsHelpOpen) {
        if (this.escKey && Phaser.Input.Keyboard.JustDown(this.escKey)) this.closeDartsHelp();
        return;
      }
      if (this.dartsMeterLive) {
        this.dartsMeterElapsed += delta;
        this.renderDartsMeter();
      }
      if (this.eKey && Phaser.Input.Keyboard.JustDown(this.eKey)) this.onDartsThrow();
      if (this.escKey && Phaser.Input.Keyboard.JustDown(this.escKey)) this.closeDarts();
      return;
    }

    // Same shape again — the history overlay owns input entirely while
    // open. No live-updating content of its own (unlike darts' meter), so
    // this is just the bubble tick plus the one key it still reads.
    if (this.historyOpen) {
      this.updateBubbles();
      if (this.escKey && Phaser.Input.Keyboard.JustDown(this.escKey)) this.closeHistory();
      return;
    }

    // Same shape again — the highlights overlay owns input entirely while
    // open, same as History immediately above it.
    if (this.highlightsOpen) {
      this.updateBubbles();
      if (this.escKey && Phaser.Input.Keyboard.JustDown(this.escKey)) this.closeHighlights();
      return;
    }

    this.handleMovement(delta);
    this.updateNpcMovement(delta);
    this.updateNpcRoaming(this.time.now);
    this.updateNpcEncounters(this.time.now);
    this.updateProximity();
    this.updateBubbles();

    if (this.eKey && Phaser.Input.Keyboard.JustDown(this.eKey)) {
      const door = this.isAtDoor();
      if (door) this.switchRoom(door);
      else if (this.isAtBay()) this.deploy();
      else this.speak();
    }
    if (this.mKey && Phaser.Input.Keyboard.JustDown(this.mKey)) {
      // 27 Aug 2026 — toggle, not a one-shot call, so a second press stands
      // in for "muster cancelled" (Maxime's own "done or cancelled"; deploy()
      // above already covers "done"). See musterActive's own header.
      if (this.musterActive) {
        this.endMuster();
        this.musterActive = false;
      } else {
        this.callMuster();
        this.musterActive = true;
      }
    }
    if (this.rKey && Phaser.Input.Keyboard.JustDown(this.rKey)) this.startRumor();
    if (this.tKey && Phaser.Input.Keyboard.JustDown(this.tKey)) this.openChat();
  }

  private handleMovement(delta: number) {
    const dt = delta / 1000;
    let dx = 0;
    let dy = 0;
    if (this.keys.a.isDown || this.cursors?.left?.isDown) dx -= 1;
    if (this.keys.d.isDown || this.cursors?.right?.isDown) dx += 1;
    if (this.keys.w.isDown || this.cursors?.up?.isDown) dy -= 1;
    if (this.keys.s.isDown || this.cursors?.down?.isDown) dy += 1;
    if (dx === 0 && dy === 0) return;

    const len = Math.hypot(dx, dy) || 1;
    const stepX = (dx / len) * PLAYER_SPEED * dt;
    const stepY = (dy / len) * PLAYER_SPEED * dt;

    // Axis-separated movement so the player slides along a wall or an NPC
    // instead of sticking dead the instant one axis would collide.
    this.tryMove(stepX, 0);
    this.tryMove(0, stepY);

    this.player.setPosition(this.playerX, this.playerY);

    // Antfarm Grid v0, 27 Aug 2026 — §3f's "open floor, no door-per-room":
    // within a deck, currentRoomId is now a LIVE label (which zone the
    // player's standing over), not something that only changes on a door
    // press. Recomputed every step but only actually acted on when it's
    // genuinely different — refreshRoomVisibility is cheap (setText/
    // setVisible, no object churn) but there's no reason to call it while
    // the player's just walking around inside one zone. Never crosses a
    // deck by itself — zoneAt only searches the CURRENT deck's own rooms —
    // so this can't accidentally teleport the player to another deck the
    // way stepping through a stair (switchRoom) deliberately does.
    const zone = zoneAt(ROOM_DECK[this.currentRoomId], this.playerX, this.playerY);
    if (zone !== this.currentRoomId) {
      this.currentRoomId = zone;
      this.refreshRoomVisibility();
    }
  }

  private tryMove(dx: number, dy: number) {
    const clamped = clampToDeckFloor(ROOM_DECK[this.currentRoomId], this.playerX + dx, this.playerY + dy, PLAYER_R);
    const nx = clamped.x;
    const ny = clamped.y;
    for (const npc of this.npcs) {
      if (!sameDeck(npc.room, this.currentRoomId)) continue; // an NPC on a different deck can't physically block this one
      if (Phaser.Math.Distance.Between(nx, ny, npc.x, npc.y) < PLAYER_R + NPC_R) return; // blocked, don't apply this axis
    }
    this.playerX = nx;
    this.playerY = ny;
  }

  // 26 Aug 2026 — the sober-up half of DRUNK_DURATION_MS. Cheap linear
  // scan, run every frame (see update()'s own comment on why this isn't
  // gated behind the overlay-input branches) — three NPCs is nothing to
  // scan, and the alternative (a scheduled Phaser timer per NPC) buys
  // nothing here since drunk state already needs deriving fresh from
  // drunkUntil on every buildNpcs() anyway. Only touches an NPC that's
  // actually drunk and past its own expiry — no-ops on every other frame
  // for every sober NPC, which is the common case.
  private updateDrunkExpiry() {
    const now = Date.now();
    for (const npc of this.npcs) {
      if (!npc.ambient.drunk || npc.drunkUntil === undefined || npc.drunkUntil > now) continue;
      npc.ambient = { ...npc.ambient, drunk: false };
      npc.drunkUntil = undefined;
      this.persistNpcSocial(npc);
    }
  }

  // Mission Worry, Hub polish, 26 Aug 2026, textured 27 Aug 2026 — see
  // isMissionWorrySignal's own header for the base design and
  // data/missionWorry.ts's own header for the texture pass (roadmap #8).
  // Same shape and same "run every frame, unconditional" reasoning as
  // updateDrunkExpiry just above (three NPCs is nothing to scan), but
  // deliberately does NOT call persistNpcSocial: this is the one piece of
  // ambient state in this scene that's supposed to never round-trip
  // through CampaignState — recomputed straight from
  // activeMissionAttempt/Date.now() every time, gone the instant the tab
  // closes, per the design note's own "what isnt saved is lost."
  //
  // No active attempt at all: every NPC's worried flag clears
  // unconditionally (same as the old flat-boolean version's implicit
  // behavior, isMissionWorrySignal returning false with no attempt) and
  // their recheck clocks are dropped, so a fresh attempt later starts
  // ramping from onset again rather than resuming a stale schedule.
  //
  // An active attempt: each NPC only rerolls once its own
  // nextWorryCheckAt clock elapses (WORRY_RECHECK_MS apart, staggered
  // per-NPC the same way nextEncounterAt already is) — not every frame,
  // which would flicker the flag many times a second and read as noise
  // rather than a mood ramping over real minutes. The roll itself is
  // worryTriggerChance(elapsed-since-onset, this NPC's own favorability
  // with Rourke) — see that function's own header for exactly why
  // favorability stands in for "closeness to the missing pilot."
  private updateMissionWorry() {
    const attempt = this.campaignState.activeMissionAttempt;
    if (!attempt) {
      for (const npc of this.npcs) {
        npc.nextWorryCheckAt = undefined;
        if (!npc.ambient.worried) continue;
        npc.ambient = { ...npc.ambient, worried: false };
      }
      return;
    }
    const now = Date.now();
    const elapsedSinceOnset = now - attempt.startedAt - WORRY_ONSET_MS;
    for (const npc of this.npcs) {
      if (npc.nextWorryCheckAt !== undefined && now < npc.nextWorryCheckAt) continue;
      npc.nextWorryCheckAt = now + WORRY_RECHECK_MS;
      const worried = Math.random() < worryTriggerChance(elapsedSinceOnset, npc.favorability);
      if (npc.ambient.worried === worried) continue;
      npc.ambient = { ...npc.ambient, worried };
    }
  }

  // Off-Duty Needs Counter, 28 Aug 2026 — data/needsCounter.ts's own header
  // has the full spec account; this is just the wiring. Same shape and same
  // "run every frame, unconditional" reasoning as updateDrunkExpiry/
  // updateMissionWorry just above (three NPCs is nothing to scan, and a
  // hungry pilot's clock shouldn't stall just because the peg board is
  // open) — each NPC only actually ticks once its own staggered
  // nextNeedsTickAt clock elapses, one real minute apart, same convention
  // as nextRoamAt/nextEncounterAt/nextWorryCheckAt. Undefined clock (the CO
  // — see his own buildNpcs() comment) skips entirely, same guard shape
  // those other clocks already use.
  private updateNeeds(now: number) {
    for (const npc of this.npcs) {
      if (npc.nextNeedsTickAt === undefined || now < npc.nextNeedsTickAt) continue;
      npc.nextNeedsTickAt = now + NEEDS_TICK_INTERVAL_MS;

      npc.hunger = tickNeed(npc.hunger, npc.room === "recroom");
      npc.thirst = tickNeed(npc.thirst, npc.room === "recroom");
      npc.sleep = tickNeed(npc.sleep, npc.room === "berths");

      const { stressDelta, moraleDelta } = needsStressMoraleDelta(npc.hunger, npc.thirst, npc.sleep);
      if (stressDelta === 0 && moraleDelta === 0) continue;
      npc.ambient = {
        ...npc.ambient,
        stress: Math.max(0, Math.min(100, npc.ambient.stress + stressDelta)),
        morale: Math.max(0, Math.min(100, npc.ambient.morale + moraleDelta)),
      };
      this.persistNpcSocial(npc);
    }
  }

  // Piece #2's actual movement: any NPC with a target set walks toward it,
  // one axis at a time, same clamp-then-collide shape as the player's own
  // tryMove — deliberately not a new movement model. Arrival just clears
  // the target and leaves the NPC standing there.
  private updateNpcMovement(delta: number) {
    const dt = delta / 1000;
    for (const npc of this.npcs) {
      if (npc.targetX === undefined || npc.targetY === undefined) continue;

      // 26 Aug 2026, Build Plan §24 — a real bug caught by the long natural-
      // run check, not by eye: every DOORS entry sits exactly on a room
      // boundary edge (x/y === one of ROOM_BOUNDS's own four values), but
      // tryMoveNpc clamps an NPC's own position to stay NPC_R (16px) inside
      // that boundary — it can structurally never get closer than 16px to
      // a door's exact point. NPC_ARRIVE_THRESHOLD (5px) is tighter than
      // that gap, so a door-hop target could never register "arrived" and
      // just retried forever, travelTargetRoom permanently stuck true. The
      // player never hits this because isAtDoor() was already built around
      // the same clamping reality with a real proximity radius (DOOR_RADIUS,
      // 45px), not a tight arrival check — reusing that same, already-
      // proven-correct tolerance here instead of NPC_ARRIVE_THRESHOLD,
      // scoped to exactly the case that needs it (a door-hop in progress).
      const arriveThreshold = npc.travelTargetRoom !== undefined ? DOOR_RADIUS : NPC_ARRIVE_THRESHOLD;
      const dist = Phaser.Math.Distance.Between(npc.x, npc.y, npc.targetX, npc.targetY);
      if (dist <= arriveThreshold) {
        npc.targetX = undefined;
        npc.targetY = undefined;
        npc.stuckMs = 0;
        // A genuine arrival, not a give-up. Only here, never in the
        // stuckMs give-up branch below: a stuck NPC that gave up short of
        // a door hasn't actually reached it, and treating that as
        // "arrived, switch rooms" would teleport them in from the wrong
        // spot. A stuck NPC mid-journey just goes idle and retries the
        // same door on its next roam tick instead (updateNpcRoaming's
        // travelTargetRoom branch), same recovery every other stuck target
        // already gets.
        if (npc.travelTargetRoom !== undefined) this.completeDoorHop(npc);
        continue;
      }

      const dx = npc.targetX - npc.x;
      const dy = npc.targetY - npc.y;
      const len = Math.hypot(dx, dy) || 1;
      const stepX = (dx / len) * NPC_WALK_SPEED * dt;
      const stepY = (dy / len) * NPC_WALK_SPEED * dt;

      const beforeX = npc.x;
      const beforeY = npc.y;
      this.tryMoveNpc(npc, stepX, 0);
      this.tryMoveNpc(npc, 0, stepY);

      // STUCK_TIMEOUT_MS's own comment covers why — collision (usually the
      // bond partner it's walking toward) can block every step indefinitely
      // without ever satisfying the arrival check above.
      if (npc.x === beforeX && npc.y === beforeY) {
        npc.stuckMs = (npc.stuckMs ?? 0) + delta;
        if (npc.stuckMs >= STUCK_TIMEOUT_MS) {
          npc.targetX = undefined;
          npc.targetY = undefined;
          npc.stuckMs = 0;
          // 26 Aug 2026, Build Plan §24 — a real gap caught by the final,
          // long natural-run pass: giving up alone never moves the NPC even
          // one pixel, so when both the NPC's own position and the target
          // are fixed points (always true for a door-hop target — see
          // completeDoorHop's comment — and often true for a same-room
          // target too), the very next retry re-walks the IDENTICAL blocked
          // line and gets blocked at the IDENTICAL point — not bad luck
          // repeating, a deterministic lock. Confirmed live: an NPC whose
          // straight line to a door happened to run through the player's
          // own (stationary, in these headless tests) position retried the
          // same door for 100+ seconds without ever budging. A small random
          // sidestep here is enough to break that exact-repeat lock without
          // building real pathfinding — it doesn't even need to succeed
          // (tryMoveNpc's own collision/bounds safety already makes a
          // blocked attempt a harmless no-op), it just needs to occasionally
          // change the NPC's own starting point enough that the next
          // retry's straight line clears whatever blocked the last one. In
          // real play the player rarely stands still this long in one spot,
          // so this mostly matters for the same-room case (another NPC
          // parked on a bond partner) — but it costs nothing to apply
          // everywhere give-up already fires.
          const sidestep = pointNear({ x: npc.x, y: npc.y }, NPC_R * 2);
          this.tryMoveNpc(npc, sidestep.x - npc.x, sidestep.y - npc.y);
        }
      } else {
        npc.stuckMs = 0;
      }
    }
  }

  private tryMoveNpc(npc: HubNpc, dx: number, dy: number) {
    const clamped = clampToDeckFloor(ROOM_DECK[npc.room], npc.x + dx, npc.y + dy, NPC_R);
    const nx = clamped.x;
    const ny = clamped.y;
    if (sameDeck(npc.room, this.currentRoomId) && Phaser.Math.Distance.Between(nx, ny, this.playerX, this.playerY) < NPC_R + PLAYER_R) return; // blocked by the player, only when they're actually sharing this deck's open floor
    for (const other of this.npcs) {
      if (other === npc) continue;
      if (!sameDeck(other.room, npc.room)) continue; // different deck, can't collide
      if (Phaser.Math.Distance.Between(nx, ny, other.x, other.y) < NPC_R + NPC_R) return; // blocked by another NPC
    }
    npc.x = nx;
    npc.y = ny;
    npc.root.setPosition(nx, ny);
    npc.favLabel.setPosition(nx, ny - NPC_R - 14);
    npc.bubbleContainer.setPosition(nx, ny - NPC_R - 30);
    // Antfarm Grid v0, 27 Aug 2026 — free-roam movement never crosses a
    // deck (only completeDoorHop's stair mechanism does that, via
    // setNpcRoom), so this never needs the interactivity/bubble-visibility
    // dance setNpcRoom runs — just keep the zone LABEL honest as an NPC
    // wanders across a same-deck open floor, same reason the player's own
    // handleMovement does the equivalent sync below.
    npc.room = zoneAt(ROOM_DECK[npc.room], nx, ny);
  }

  // 26 Aug 2026, Build Plan §24 — an NPC's own room changing, independent
  // of the player's. Mirrors refreshRoomVisibility's per-NPC block exactly
  // (that one only ever runs off a PLAYER room change, via switchRoom/
  // create — this is the NPC-side equivalent, since nothing before this
  // pass ever needed one) so a wandering NPC's sprite/interactivity/bubble
  // visibility stays correct whether or not the player happens to be
  // standing in the room they just left or entered.
  private setNpcRoom(npc: HubNpc, room: RoomId, x: number, y: number) {
    npc.room = room;
    npc.x = x;
    npc.y = y;
    npc.root.setPosition(x, y);
    npc.favLabel.setPosition(x, y - NPC_R - 14);
    npc.bubbleContainer.setPosition(x, y - NPC_R - 30);
    const here = sameDeck(room, this.currentRoomId);
    npc.root.setVisible(here);
    if (here) {
      npc.circle.setInteractive({ useHandCursor: true });
    } else {
      npc.circle.disableInteractive();
      npc.favLabel.setVisible(false);
      npc.bubbleContainer.setVisible(false);
    }
  }

  // 26 Aug 2026, Build Plan §24 — called the instant a traveling NPC
  // actually reaches the door they were walking toward (updateNpcMovement's
  // own real-arrival branch, never its stuckMs give-up branch). Looks up
  // the same door via nextHopDoor() that set the target in the first place,
  // so there's no way for this to resolve to the wrong door. A two-hop trip
  // (through Rec Room, the map's only hub) keeps walking immediately rather
  // than sitting idle at the hub's own spawn point until the next roam
  // tick fires 5-11s later — a real "cross the ship" errand shouldn't read
  // as a stall at the midpoint any more than at either end.
  private completeDoorHop(npc: HubNpc) {
    if (npc.travelTargetRoom === undefined) return;
    const door = nextHopDoor(npc.room, npc.travelTargetRoom);
    if (!door) {
      npc.travelTargetRoom = undefined; // shouldn't happen on this map's star topology — fail safe, not stuck forever
      return;
    }
    // 26 Aug 2026, Build Plan §24 — a real deadlock caught by the long
    // natural-run check, worse than §22's stuck-target bug: every door has
    // exactly ONE fixed (toX, toY) landing spot, and setNpcRoom places an
    // arriving NPC there directly, with zero collision awareness (unlike
    // tryMoveNpc's own per-step check) — nothing stopped two NPCs who
    // happened to travel to the same room from landing on the exact same
    // pixel. Once that happens, tryMoveNpc's own collision check (which
    // reads as "blocked" at ANY distance under NPC_R+NPC_R) blocks every
    // direction equally from a zero-distance start, a permanent deadlock
    // stuckMs's own give-up-and-retry can never actually resolve, since
    // every retry lands the walker right back in the same trap. Confirmed
    // live: Anand and Iyari both independently explored to Hangar Deck and
    // landed stacked exactly on top of each other at its one door spawn
    // point, and neither ever moved again. Fixed by landing at a jittered
    // point near the door instead of its exact coordinate — same pointNear()
    // helper the same-room roam logic already uses for this exact kind of
    // "near, not on top of" placement.
    //
    // Correction, Hub polish, 26 Aug 2026: this comment originally called
    // a single jittered draw "astronomically less likely" to still
    // collide — that was optimism, not a measured claim. A real Monte
    // Carlo check (DOOR_LANDING_MAX_ATTEMPTS's own header) put a single
    // draw at ~35.7% collide odds, real enough to hit in ordinary play,
    // not astronomically small at all. pickDoorLanding (see its own
    // header, right after nextHopDoor above) replaces the single draw
    // with rejection sampling against whoever's already in the
    // destination room, which is what actually earns the "no longer a
    // real practical risk" claim this comment used to make prematurely.
    const landing = pickDoorLanding(
      door,
      this.npcs.filter((n) => n !== npc && n.room === door.toRoom),
    );
    const land = clampToDeckFloor(ROOM_DECK[door.toRoom], landing.x, landing.y, NPC_R);
    this.setNpcRoom(npc, door.toRoom, land.x, land.y);
    if (npc.room === npc.travelTargetRoom) {
      npc.travelTargetRoom = undefined;
      return;
    }
    const nextDoor = nextHopDoor(npc.room, npc.travelTargetRoom);
    if (nextDoor) {
      npc.targetX = nextDoor.x;
      npc.targetY = nextDoor.y;
    } else {
      npc.travelTargetRoom = undefined;
    }
  }

  // Phase 3 piece three, 26 Aug 2026 — autonomous roaming, the spatial half
  // of "real cliques." npcBonds.ts's own header covers the scoping call in
  // full. Only ever assigns a target to an NPC that doesn't already have
  // one — an active muster walk or a still-in-progress previous roam
  // decision both take priority; this never interrupts either, matching
  // updateNpcMovement's own "one target field, whoever set it last owns it"
  // shape.
  //
  // Correction, 26 Aug 2026, same day: this used to read NPC_BOND_SEED — a
  // value seeded once and held fixed, per this comment's own original
  // wording ("seeded bonds made spatially visible, not a simulation of
  // bonds changing over time"). Now that updateNpcEncounters() below
  // actually moves bonds for real and persists them (campaignState.ts
  // section 12), leaving this on the frozen seed would mean roaming and
  // the real relationship state visibly disagree — an NPC could keep
  // drifting from a "rival" whose bond had long since recovered. Reads
  // this.npcSocial.bonds now (the same live object runNpcEncounter
  // mutates), so where an NPC chooses to walk always reflects where the
  // relationship actually stands right now.
  private updateNpcRoaming(now: number) {
    for (const npc of this.npcs) {
      // 27 Aug 2026 — see HubNpc.mustered's own header. Checked before the
      // targetX check on purpose: a mustered NPC that has already arrived
      // at MUSTER_POINT has targetX cleared by ordinary arrival logic
      // (updateNpcMovement), and without this guard the very next
      // nextRoamAt tick would hand them a brand-new explore/mingle target
      // as if they were any other idle NPC — exactly the gap Maxime flagged.
      if (npc.mustered) continue;
      if (npc.targetX !== undefined) continue;
      if (npc.nextRoamAt === undefined || now < npc.nextRoamAt) continue;

      npc.nextRoamAt = now + ROAM_INTERVAL_MIN_MS + Math.random() * (ROAM_INTERVAL_MAX_MS - ROAM_INTERVAL_MIN_MS);

      // 26 Aug 2026, Build Plan §24 — mid cross-room journey. Keep walking
      // the next hop rather than re-rolling anything below; this only ever
      // fires after a stuckMs give-up mid-journey (a genuine door arrival
      // is handled immediately in updateNpcMovement/completeDoorHop and
      // never leaves travelTargetRoom dangling with no active target).
      if (npc.travelTargetRoom !== undefined) {
        const door = nextHopDoor(npc.room, npc.travelTargetRoom);
        if (door) {
          npc.targetX = door.x;
          npc.targetY = door.y;
        } else {
          npc.travelTargetRoom = undefined; // shouldn't happen on this map — fail safe, not stuck forever
        }
        continue;
      }

      // Explore — Build Plan §24. Leave the current room outright,
      // occasionally, rather than only ever mingling with whoever's
      // already here. Rolled before the same-room logic below (and before
      // its own "nobody else here" bail-out) on purpose: an NPC who's
      // alone in a room needs this branch to ever do anything at all, not
      // just NPCs with company to mingle with.
      //
      // Split in two, Antfarm Grid v0, 27 Aug 2026: pickExploreTarget can
      // land on a room sharing the NPC's own deck now (open floor, §3f) —
      // that's a direct walk to a point inside that room's own zone, no
      // door/stair involved, exactly the same shape as the mingle branch
      // below just aimed at a zone instead of a person. Only a genuinely
      // cross-deck target still uses the stairs/travelTargetRoom machinery.
      if (Math.random() < EXPLORE_CHANCE) {
        // Needs Counter roaming bias, 28 Aug 2026 — see NEEDS_ROAM_WEIGHT_BONUS's
        // own comment. worstNeed reads straight off this NPC's live
        // hunger/thirst/sleep; NEED_ROOM maps whichever one's worst to the
        // room that actually restores it.
        const worstOfNeeds = worstNeed(npc.hunger, npc.thirst, npc.sleep);
        const biasRoom = worstOfNeeds ? NEED_ROOM[worstOfNeeds] : undefined;
        const target = pickExploreTarget(npc.room, biasRoom);
        if (sameDeck(npc.room, target)) {
          // ROOM_ZONE_BOUNDS[target] is grotto's own (bigger, off-center)
          // bounding rect for that deck (see its own comment) — picking a
          // random point inside that RECT and then running it through
          // clampToDeckFloor pulls anything that landed outside the true
          // ellipse back onto the boundary, same as any other movement
          // clamp here. Upper/Lower targets are unaffected: their zone
          // rects fully tile ROOM_BOUNDS, so clampToDeckFloor's rectangle
          // branch is a no-op there, exactly like before this pass.
          const zone = ROOM_ZONE_BOUNDS[target];
          const pick = clampToDeckFloor(
            ROOM_DECK[target],
            zone.left + Math.random() * (zone.right - zone.left),
            zone.top + Math.random() * (zone.bottom - zone.top),
            NPC_R,
          );
          npc.targetX = pick.x;
          npc.targetY = pick.y;
          continue;
        }
        const door = nextHopDoor(npc.room, target);
        if (door) {
          npc.travelTargetRoom = target;
          npc.targetX = door.x;
          npc.targetY = door.y;
          continue;
        }
        // No door found (shouldn't happen) — fall through to same-room logic below instead of doing nothing this tick.
      }

      const roommates = this.npcs.filter((n) => sameDeck(n.room, npc.room) && n.pilotId !== npc.pilotId);
      if (roommates.length === 0) continue;
      const otherIds = roommates.map((n) => n.pilotId);
      const closest = findClosestBond(npc.pilotId, otherIds, this.npcSocial.bonds);
      const worst = findWorstRival(npc.pilotId, otherIds, this.npcSocial.bonds);

      // Weighted, not strict if/else-if — see RIVAL_AVOID_CHANCE/
      // CLIQUE_APPROACH_CHANCE's own comment for why. A real rival mostly
      // (not always) gets dodged; failing that, a real clique bond mostly
      // (not always) gets approached; failing BOTH of those — including
      // the case where neither a clique nor a rival exists at all, true
      // zero familiarity — falls through to mingling with someone picked
      // at random from the room. Mingling never targets empty space.
      let dest: { x: number; y: number };
      if (worst && worst.value <= RIVAL_THRESHOLD && Math.random() < RIVAL_AVOID_CHANCE) {
        const rivalNpc = roommates.find((n) => n.pilotId === worst.otherId)!;
        dest = pointAwayFrom({ x: npc.x, y: npc.y }, { x: rivalNpc.x, y: rivalNpc.y }, ROAM_DRIFT_DIST);
      } else if (closest && closest.value >= CLIQUE_THRESHOLD && Math.random() < CLIQUE_APPROACH_CHANCE) {
        const bondNpc = roommates.find((n) => n.pilotId === closest.otherId)!;
        dest = pointNear({ x: bondNpc.x, y: bondNpc.y }, ROAM_APPROACH_DIST);
      } else {
        // Mingle — a close friend gave way this round, a rival wasn't
        // worth dodging this time, or there's simply nobody with a strong
        // bond either way yet. Pick any roommate at random (could land on
        // the same closest bond or worst rival by chance too — that's
        // fine, real) and walk toward them. This is the branch that
        // actually stops a zero-familiarity NPC from stalling: there's
        // always a person to walk toward, never a blind self-wander.
        const target = roommates[Math.floor(Math.random() * roommates.length)];
        dest = pointNear({ x: target.x, y: target.y }, ROAM_APPROACH_DIST);
      }

      // Clamped here, not left to tryMoveNpc's own per-step clamp — an
      // unclamped target near a wall could sit outside the room entirely,
      // and since only the ACTUAL (clamped) position is compared against
      // the (unclamped) target for arrival, that would leave the NPC
      // walking toward a point it can structurally never reach. Deck-aware
      // for the same reason every other clamp site here is now.
      const destClamped = clampToDeckFloor(ROOM_DECK[npc.room], dest.x, dest.y, NPC_R);
      npc.targetX = destClamped.x;
      npc.targetY = destClamped.y;
    }
  }

  // 26 Aug 2026 — the piece roaming never had: something actually happening
  // once two NPCs close the distance. O(n^2) over this.npcs, which is fine
  // at today's roster size (3) — same "cheap linear scan, three NPCs is
  // nothing" reasoning updateDrunkExpiry's own comment already uses; worth
  // revisiting if the roster ever grows enough for that to matter. A pair
  // fires at most once per (i, break) pass — after npcA spends its turn on
  // a match, it moves on to the next i rather than also checking npcA
  // against every remaining npcB.
  private updateNpcEncounters(now: number) {
    for (let i = 0; i < this.npcs.length; i++) {
      const npcA = this.npcs[i];
      if (npcA.targetX !== undefined) continue; // mid-walk somewhere else — not settled enough to strike up anything
      if (npcA.nextEncounterAt === undefined || now < npcA.nextEncounterAt) continue;

      for (let j = i + 1; j < this.npcs.length; j++) {
        const npcB = this.npcs[j];
        if (!sameDeck(npcB.room, npcA.room)) continue;
        if (npcB.targetX !== undefined) continue;
        if (npcB.nextEncounterAt === undefined || now < npcB.nextEncounterAt) continue;
        if (Phaser.Math.Distance.Between(npcA.x, npcA.y, npcB.x, npcB.y) > ENCOUNTER_RADIUS) continue;

        this.runNpcEncounter(npcA, npcB, now);
        break;
      }
    }
  }

  // Turns a same-room, idle, close-enough pair into one real
  // engine/socialSim.ts encounter — the exact Talk/peg board/poker/
  // fletchers/Ask Out logic runSocialSim.ts's CLI already drives headless,
  // now resolved instantly (no move-by-move visual playout — same "abstract
  // the resolution, show the result" scope line socialSim.ts's own header
  // already draws for poker/fletchers, applied here to all five kinds
  // rather than reinventing a live rendered minigame two NPCs play at each
  // other) and shown as a bubble instead of a log line.
  //
  // displayName is split the same way every other line in this file already
  // splits it (favorabilityLabel, the muster/rumor gossip lines) — the raw
  // WARDEN_PILOTS displayName carries a "— <callsign>" suffix that reads
  // fine in a label but not stitched into a sentence.
  private runNpcEncounter(npcA: HubNpc, npcB: HubNpc, now: number) {
    const key = pairKey(npcA.pilotId, npcB.pilotId);
    const bond = this.npcSocial.bonds[key] ?? 0;
    const playerCommitted = new Set(this.npcs.filter((n) => n.inRelationship).map((n) => n.pilotId));
    const aCommitted = isCommitted(npcA.pilotId, this.npcSocial, playerCommitted);
    const bCommitted = isCommitted(npcB.pilotId, this.npcSocial, playerCommitted);

    const pilotA: SocialSimPilot = { pilotId: npcA.pilotId, displayName: npcA.displayName.split("—")[0].trim(), catalyst: npcA.ambient.catalyst, stage: npcA.ambient.stage };
    const pilotB: SocialSimPilot = { pilotId: npcB.pilotId, displayName: npcB.displayName.split("—")[0].trim(), catalyst: npcB.ambient.catalyst, stage: npcB.ambient.stage };
    const result = simulateEncounter({ pilotA, pilotB, bond, aCommitted, bCommitted, rng: Math.random });

    this.npcSocial.bonds[key] = bond + result.bondDelta;
    if (result.becameCouple) {
      this.npcSocial.relationships.push(key);
      // Hot topics, first slice, 27 Aug 2026 — an NPC-NPC pairing is
      // newsworthy the same way a player-NPC one is above. Registered
      // once, about pilotA specifically (not both directions) — the
      // pick/render pair only ever needs one anchor pilot per topic, and
      // pilotB is already carried as withName.
      this.hotTopics.push({
        kind: "gotTogether",
        aboutPilotId: pilotA.pilotId,
        aboutName: pilotA.displayName,
        withName: pilotB.displayName,
        at: Date.now(),
        mentionedBy: [],
      });
    }
    saveCampaignState(this.campaignState);

    // Live-visual staging, 26 Aug 2026 — "talk" (the most common encounter
    // kind, weight 0.4 in socialSim.ts) now shows a REAL two-line exchange:
    // npcA's own bubble first, npcB's reply bubble staged after it, instead
    // of one narrated sentence hosted over npcA. lineB's absence (Gate 0
    // miss — resolveTalkEncounter) means no reply bubble at all, not a
    // shrug — npcA said something, npcB just didn't engage, and that reads
    // correctly on its own. The other four kinds (pegBoard/poker/fletchers/
    // askOut) keep the single narrated summary bubble for now — same
    // mechanism would extend to them, not built this pass.
    // Surfacing friction, first slice, 27 Aug 2026 — see data/friction.ts's
    // own header. Checked against `bond` (the PRE-encounter value read
    // above), not the post-delta one — this is about whether they were
    // already rivals walking in, not whatever this one encounter happens
    // to move it to. Display-only: result.kind/bondDelta/becameCouple are
    // untouched either way, only what bubble text gets shown for an
    // already-established rivalry's "talk" kind changes.
    if (bond <= RIVAL_THRESHOLD && result.kind === "talk") {
      this.showBubble(npcA, pickFrictionLine(), now);
    } else if (result.kind === "talk" && result.lineA) {
      this.showBubble(npcA, result.lineA, now);
      if (result.lineB) {
        const lineB = result.lineB;
        this.time.delayedCall(NPC_REPLY_DELAY_MS, () => {
          this.showBubble(npcB, lineB, this.time.now);
        });
      }
    } else {
      this.showBubble(npcA, result.summary, now);
    }

    const nextA = now + ENCOUNTER_COOLDOWN_MIN_MS + Math.random() * (ENCOUNTER_COOLDOWN_MAX_MS - ENCOUNTER_COOLDOWN_MIN_MS);
    const nextB = now + ENCOUNTER_COOLDOWN_MIN_MS + Math.random() * (ENCOUNTER_COOLDOWN_MAX_MS - ENCOUNTER_COOLDOWN_MIN_MS);
    npcA.nextEncounterAt = nextA;
    npcB.nextEncounterAt = nextB;
  }

  // Piece #2's only trigger, on purpose — an emotion or a rumor reaching an
  // NPC never moves them, only a muster message does. Matches Maxime's own
  // words exactly ("the troop will assemble") rather than generalizing
  // movement to every message kind.
  private sendToMuster(npc: HubNpc) {
    npc.targetX = MUSTER_POINT.x;
    npc.targetY = MUSTER_POINT.y;
    // 27 Aug 2026 — see HubNpc.mustered's own header. Marks this NPC as
    // "holding for muster" from the moment the message reaches them, not
    // just "currently walking somewhere" — updateNpcRoaming reads this to
    // keep them parked at the bay once they arrive, until endMuster() runs.
    npc.mustered = true;
  }

  // 27 Aug 2026 — the release valve for sendToMuster's mustered flag. Two
  // callers: deploy() (the muster's real fulfillment — the player actually
  // takes the troop out) and the debug M key's second press (standing in
  // for a future real "cancel muster" action, per Maxime's own "done or
  // cancelled" phrasing). Unconditionally clears every NPC rather than
  // tracking which ones actually answered the call — cheap, and correct
  // either way: an NPC who never got mustered has mustered === undefined
  // already, so clearing it again is a no-op for them.
  private endMuster() {
    for (const npc of this.npcs) npc.mustered = false;
  }

  // Hub polish, 26 Aug 2026 — closes a gap flagged since §22/§19: neither
  // an NPC-to-NPC couple (this.npcSocial.relationships, written by
  // runNpcEncounter above) nor the player's own inRelationship flag (set
  // by askOut's accept branch) had any visible indicator anywhere in the
  // Hub — both were real, persisted state with zero UI surface. Reuses the
  // exact data both systems already write; adds no new state of its own.
  // The player's own case reads simply as "with you" rather than naming
  // Rourke specifically, since her callsign/rank could change (§9's own
  // buildPlayer() note) and this label shouldn't have to track that.
  private npcPartnerLabel(npc: HubNpc): string | undefined {
    // Relationship stages, first slice, 27 Aug 2026 — see
    // data/relationshipStage.ts's own header. Both branches below reuse
    // whatever "closeness" number this specific pairing already moves
    // (the player relationship's own favorability; an NPC-NPC pairing's
    // own bond) rather than adding any new persisted state.
    if (npc.inRelationship) return relationshipStagePhrase(deriveRelationshipStage(npc.favorability), "you");
    for (const key of this.npcSocial.relationships) {
      const [a, b] = key.split("::");
      if (a !== npc.pilotId && b !== npc.pilotId) continue;
      const otherId = a === npc.pilotId ? b : a;
      const other = this.npcs.find((n) => n.pilotId === otherId);
      if (!other) continue;
      const bond = this.npcSocial.bonds[key] ?? 0;
      return relationshipStagePhrase(deriveRelationshipStage(bond), other.displayName.split("—")[0].trim());
    }
    return undefined;
  }

  // Surfacing friction, first slice, 27 Aug 2026 — see data/friction.ts's
  // own header. Mirrors npcPartnerLabel's shape exactly (findWorstRival
  // is already imported and already drives roaming — see
  // updateNpcRoaming — this is the same data, just read for the UI too),
  // but deliberately NOT room-scoped the way roaming's own "roommates"
  // computation is: a standing rivalry is a relationship fact, not a
  // physical-proximity one, same reasoning npcPartnerLabel's own
  // NPC-NPC branch already treats relationships as room-independent.
  private npcRivalLabel(npc: HubNpc): string | undefined {
    const otherIds = this.npcs.filter((n) => n.pilotId !== npc.pilotId).map((n) => n.pilotId);
    const worst = findWorstRival(npc.pilotId, otherIds, this.npcSocial.bonds);
    if (!worst || worst.value > RIVAL_THRESHOLD) return undefined;
    const other = this.npcs.find((n) => n.pilotId === worst.otherId);
    return other ? `clashing with ${other.displayName.split("—")[0].trim()}` : undefined;
  }

  private updateProximity() {
    let anyoneInRange = false;
    for (const npc of this.npcs) {
      if (!sameDeck(npc.room, this.currentRoomId)) continue;
      const dist = Phaser.Math.Distance.Between(this.playerX, this.playerY, npc.x, npc.y);
      const close = dist <= APPROACH_RADIUS;
      if (close) anyoneInRange = true;
      npc.favLabel.setVisible(close);
      if (close) npc.favLabel.setText(favorabilityLabel(npc, this.npcPartnerLabel(npc), this.npcRivalLabel(npc)));
    }
    // Priority when more than one would apply: a door beats the bay beats
    // talk — the most specific available action wins. Geometrically rare
    // for any two of these to overlap (see the DOORS table's own spacing
    // notes) but an explicit order beats an ambiguous one regardless.
    const door = this.isAtDoor();
    if (door) this.interactPrompt.setText(`E — enter ${door.label}`);
    else if (this.isAtBay()) this.interactPrompt.setText("E — deploy");
    else this.interactPrompt.setText(anyoneInRange ? "E — talk" : "");
  }

  private isAtBay(): boolean {
    return this.currentRoomId === "recroom" && Phaser.Math.Distance.Between(this.playerX, this.playerY, MUSTER_POINT.x, MUSTER_POINT.y) <= BAY_RADIUS;
  }

  // Phase 2 map growth — the nearest door in the CURRENT room within
  // DOOR_RADIUS, or null. Doors in other rooms are irrelevant by
  // construction (DOORS is filtered by d.room), same shape as every other
  // room-scoped check in this file.
  private isAtDoor(): DoorDef | null {
    for (const d of DOORS) {
      if (d.room !== this.currentRoomId) continue;
      if (Phaser.Math.Distance.Between(this.playerX, this.playerY, d.x, d.y) <= DOOR_RADIUS) return d;
    }
    return null;
  }

  // Phase 2 map growth — the actual room-swap. Repositions the player at
  // the door's own entry point (chosen with clearance from that point's
  // own DOOR_RADIUS, see the DOORS table) and refreshes which room's
  // doors/NPCs/bay are visible and interactive.
  private switchRoom(door: DoorDef) {
    this.currentRoomId = door.toRoom;
    this.playerX = door.toX;
    this.playerY = door.toY;
    this.player.setPosition(this.playerX, this.playerY);
    this.refreshRoomVisibility();
  }

  // Phase 2 map growth — the single place that decides what's visible and
  // interactive for whichever room currentRoomId names. Called once from
  // create() (to set up the starting Rec Room state), from every
  // switchRoom() call (a real stair crossing), and now also from
  // handleMovement() whenever the live zone recompute finds the player's
  // crossed into a different same-deck room (Antfarm Grid v0, 27 Aug 2026).
  //
  // Antfarm Grid v0 rewrite: everything that's really about SEEING the
  // rest of an open deck (door/stair markers, the bay, the other rooms'
  // divider+label decor, which NPCs render at all) now toggles by DECK —
  // sameDeck(x, this.currentRoomId) — not by exact room. What stays
  // exact-room-scoped is the stuff that's genuinely about which room
  // you're standing IN specifically: the title bar's zone name and the
  // room note text (repositioned into that room's own zone rect below,
  // since it used to assume it was the only thing on screen).
  private refreshRoomVisibility() {
    const deck = ROOM_DECK[this.currentRoomId];
    this.roomTitleText.setText(`THE ANTFARM — ${ROOM_TITLES[this.currentRoomId]} (PROTOTYPE)`);
    this.deckIndicatorText.setText(`DECK: ${DECK_TITLES[deck]}`);

    // The egg hull, 27 Aug 2026 (both passes) — exactly one of the three
    // floors is ever visible: each deck's own. See drawDeckFloor/
    // drawGrottoFloor's own headers.
    this.lowerFloor.setVisible(deck === "lower");
    this.upperFloor.setVisible(deck === "upper");
    this.grottoFloor.setVisible(deck === "grotto");

    // The egg hull, second pass, 27 Aug 2026 — same by-deck toggle as
    // doorMarkers/zoneDecor above.
    for (const marker of this.reservedBayMarkers) {
      const show = marker.def.deck === deck;
      marker.outline.setVisible(show);
      marker.label.setVisible(show);
    }

    for (const marker of this.doorMarkers) {
      const show = sameDeck(marker.def.room, this.currentRoomId);
      marker.outline.setVisible(show);
      marker.label.setVisible(show);
    }

    for (const decor of this.zoneDecor) {
      const show = sameDeck(decor.room, this.currentRoomId);
      for (const node of decor.nodes) node.setVisible(show);
    }

    const onLowerDeck = sameDeck("recroom", this.currentRoomId);
    this.bayOutline.setVisible(onLowerDeck);
    this.bayLabel.setVisible(onLowerDeck);

    const note = ROOM_NOTES[this.currentRoomId];
    const zone = ROOM_ZONE_BOUNDS[this.currentRoomId];
    this.roomNoteText.setPosition((zone.left + zone.right) / 2, (zone.top + zone.bottom) / 2);
    this.roomNoteText.setWordWrapWidth(Math.max(160, zone.right - zone.left - 60));
    this.roomNoteText.setText(note ?? "");
    this.roomNoteText.setVisible(!!note);

    for (const npc of this.npcs) {
      const here = sameDeck(npc.room, this.currentRoomId);
      npc.root.setVisible(here);
      if (here) {
        npc.circle.setInteractive({ useHandCursor: true });
      } else {
        npc.circle.disableInteractive();
        npc.favLabel.setVisible(false);
        npc.bubbleContainer.setVisible(false);
      }
    }
  }

  // Piece #4's actual trigger — walking up to the bay and pressing E, same
  // interact button as talk, just context-sensitive by position (see
  // updateProximity). Hands off to the existing MapSelect screen exactly
  // as CAMPAIGN SHOP -> MapSelect already does elsewhere; no new mission-
  // choice logic lives here.
  private deploy() {
    // 27 Aug 2026 — the muster's real "done" case (see HubNpc.mustered's
    // header). Also resets musterActive: this Hub scene instance is reused
    // (Phaser doesn't recreate the class on scene.start), so without this
    // the debug M key's next first-press-after-returning would read as a
    // cancel of a muster nobody's currently in, instead of calling a fresh one.
    this.endMuster();
    this.musterActive = false;
    this.scene.start("MapSelect");
  }

  private updateBubbles() {
    const now = this.time.now;
    for (const npc of this.npcs) {
      if (npc.bubbleUntil && now > npc.bubbleUntil) {
        npc.bubbleContainer.setVisible(false);
        npc.bubbleUntil = 0;
      }
    }
  }

  // Sound-range broadcast Talk verb — locked in Build Plan §4, 25 Aug 2026:
  // press once, everyone currently within TALK_RADIUS reacts on their own,
  // each pulling their own line. Not aimed at a single NPC.
  //
  // Phase 3, piece one, 26 Aug 2026 — Gate 0 (Bloom_Wars_NPC_Reaction_
  // Engine_v1.md §1a / reactionGate.ts). Before this, every nearby NPC
  // reacted to every single Talk press, always — the one place in this
  // scene where the Reaction Engine's own "most pilots, most of the time,
  // don't react to what's happening around them" default was entirely
  // missing. gate0Reacts() is checked per NPC, per press, now: some
  // presses land with everyone in range responding, some land with only
  // some of them, occasionally none at all — a real "not right now" is
  // possible, same as a real person not always looking up when someone
  // speaks nearby. Scoped to speak() only (see reactionGate.ts's own
  // header for why every other call site — provoke's forced click, the
  // deterministic verbs, propagate's own separate catch-chance — stays
  // untouched).
  private speak() {
    const now = this.time.now;
    for (const npc of this.npcs) {
      if (!sameDeck(npc.room, this.currentRoomId)) continue;
      const dist = Phaser.Math.Distance.Between(this.playerX, this.playerY, npc.x, npc.y);
      if (dist > TALK_RADIUS) continue;
      // Stage-promotion "graduation" reveal, 27 Aug 2026 — checked before
      // Gate 0, and deliberately bypasses it entirely: this is a one-time,
      // narratively real beat (the whole point is that a promotion is
      // guaranteed to actually surface, not "surfaces most of the time"),
      // not ordinary ambient chatter competing for the same engagement
      // roll everything else in this function rolls against.
      if (npc.pendingStagePromotion) {
        const line = pickStagePromotionLine(npc.ambient.catalyst, npc.pendingStagePromotion);
        this.showBubble(npc, line, now);
        npc.pendingStagePromotion = undefined;
        this.ackStagePromotion(npc);
        // Hot topics, first slice, 27 Aug 2026 — the rest of the crew
        // gets a chance to hear about this the next time THEY talk to
        // you, via speak()'s own hot-topic check below. Registered here,
        // not inside pickStagePromotionLine/data/hotTopics.ts itself,
        // since this is the one real place the event is known to have
        // actually happened.
        this.hotTopics.push({
          kind: "promoted",
          aboutPilotId: npc.pilotId,
          aboutName: npc.displayName.split("—")[0].trim(),
          at: Date.now(),
          mentionedBy: [],
        });
        continue;
      }
      // "Hello, Sir" rank-deference greeting, 27 Aug 2026 — same
      // Gate-0-bypassing treatment as pendingStagePromotion just above and
      // for the same reason (a one-time, guaranteed-to-surface beat, not
      // ordinary ambient chatter competing for an engagement roll). Checked
      // second, so a pilot who happens to have BOTH a fresh Stage
      // promotion and a fresh Rourke-rank greeting pending on the exact
      // same Talk press shows the Stage one first and the rank greeting on
      // the next press, rather than picking one arbitrarily.
      if (npc.pendingRankGreeting) {
        const line = pickRankGreetingLine(npc.ambient.catalyst, npc.pendingRankGreeting);
        this.showBubble(npc, line, now);
        npc.pendingRankGreeting = undefined;
        this.ackRankGreeting(npc);
        continue;
      }
      // Relationship-stage warm exchange, first slice, 27 Aug 2026 — only
      // for the player's own partner (npc.inRelationship), checked before
      // hot topics on purpose: a personal moment with your own partner
      // should win over gossip about someone else, not compete with it.
      // See data/relationshipStage.ts's own header — the stage itself is
      // derived live from favorability, nothing new persisted.
      if (npc.inRelationship && Math.random() < PARTNER_BANTER_CHANCE) {
        const stage = deriveRelationshipStage(npc.favorability);
        const line = pickRelationshipStageLine(stage);
        this.showBubble(npc, line, now);
        continue;
      }
      // Hot topics, first slice, 27 Aug 2026, catalyst-flavored content
      // added same day (roadmap #1's own stretch goal) — checked after the
      // two guaranteed one-time reveals above (this NPC's own news always
      // wins if both are pending) but before Gate 0's ordinary ambient
      // roll, so a fresh piece of gossip about someone ELSE can preempt
      // ordinary idle chatter.
      const topic = pickHotTopicForSpeaker(this.hotTopics, npc.pilotId);
      if (topic && Math.random() < HOT_TOPIC_SPEAK_CHANCE) {
        const line = renderHotTopicLine(topic, npc.ambient.catalyst);
        this.showBubble(npc, line, now);
        topic.mentionedBy.push(npc.pilotId);
        continue;
      }
      if (!gate0Reacts(npc.ambient)) continue;
      const { line } = this.pickAmbientLineWithMemory(npc);
      this.showBubble(npc, line, now);
    }
  }

  // Telephone-wave prototype — see the PROPAGATION_* constants' own
  // comment for what this is answering. Provoking forces the clicked NPC's
  // message to a forced-anger emotion (a direct reading of "get a single
  // guy angry"), shows their line immediately, then hands off to
  // propagate() for the ripple.
  private provoke(npc: HubNpc) {
    const now = this.time.now;
    const message: HubMessage = { kind: "emotion", echo: "anger" };
    const line = pickLineForMessage(npc.ambient, message);
    this.showBubble(npc, line, now);
    this.time.delayedCall(PROPAGATION_HOP_DELAY_MS, () => {
      this.propagate(npc, message, new Set([npc.pilotId]), 1);
    });
  }

  // Piece #1 of Build Plan §9, 25 Aug 2026: "cmon guys to the bay, we are
  // heading out to mission." M is a debug key standing in for the real
  // "walk up, open chat, muster the troop" flow — now that piece #3 exists,
  // this and a typed "cmon guys to the bay" both funnel through the same
  // broadcastMessage() below rather than duplicating the broadcast logic.
  private callMuster() {
    this.broadcastMessage({ kind: "muster" });
  }

  // Extracted from callMuster(), piece #3, 26 Aug 2026, so the debug M key
  // and a real typed chat message can't drift out of sync with each other.
  // Same TALK_RADIUS earshot model as speak() — everyone directly in range
  // acknowledges immediately, then each of THEM independently starts their
  // own propagate() from their own position, so the message can reach
  // pilots standing outside the player's own direct range via relay.
  private broadcastMessage(message: HubMessage) {
    const now = this.time.now;
    for (const npc of this.npcs) {
      if (!sameDeck(npc.room, this.currentRoomId)) continue;
      const dist = Phaser.Math.Distance.Between(this.playerX, this.playerY, npc.x, npc.y);
      if (dist > TALK_RADIUS) continue;
      const line = pickLineForMessage(npc.ambient, message);
      this.showBubble(npc, line, now);
      if (message.kind === "muster") this.sendToMuster(npc);
      this.time.delayedCall(PROPAGATION_HOP_DELAY_MS, () => {
        this.propagate(npc, message, new Set([npc.pilotId]), 1);
      });
    }
  }

  // Piece #1's second test case: "rumor on a ship — mc asked someone out
  // and got rejected, everyone will know it." No real Ask Out/Romance
  // system exists yet to trigger this for real (Build Plan §9's own note),
  // so R is a debug key that fabricates the event: two different NPCs are
  // picked at random, one as the rejector, one as wherever the rumor
  // happens to start spreading from — same shape a real rejection would
  // have, just without a real player-driven Ask Out to cause it. Not
  // proximity-gated — a rumor doesn't need the player nearby to start —
  // so this still works from any room, same as before the map grew.
  private startRumor() {
    if (this.npcs.length < 2) return;
    const rourke = WARDEN_PILOTS.find((p) => p.id === "pilot_rourke");
    const askerName = rourke ? rourke.displayName.split("—")[0].trim() : "The Commander";

    const sourceIdx = Math.floor(Math.random() * this.npcs.length);
    let rejectorIdx = Math.floor(Math.random() * this.npcs.length);
    while (rejectorIdx === sourceIdx) rejectorIdx = Math.floor(Math.random() * this.npcs.length);

    const source = this.npcs[sourceIdx];
    const rejector = this.npcs[rejectorIdx];
    const rejectorName = rejector.displayName.split("—")[0].trim();

    const message: HubMessage = { kind: "rumor", askerName, rejectorName };
    const line = pickLineForMessage(source.ambient, message);
    this.showBubble(source, line, this.time.now);
    this.time.delayedCall(PROPAGATION_HOP_DELAY_MS, () => {
      this.propagate(source, message, new Set([source.pilotId]), 1);
    });
  }

  private propagate(source: HubNpc, incoming: HubMessage, visited: Set<string>, hop: number) {
    if (hop > PROPAGATION_MAX_HOPS) return;
    const catchChance = PROPAGATION_CATCH_BASE * Math.pow(PROPAGATION_CATCH_DECAY, hop - 1);

    for (const npc of this.npcs) {
      if (visited.has(npc.pilotId)) continue;
      // 26 Aug 2026, Build Plan §24 — a real latent bug this pass exposed,
      // not caused: every room reuses the exact same ROOM_BOUNDS rectangle
      // (see that const's own header), so two NPCs standing in physically
      // different rooms can have numerically close x/y all the same. This
      // distance check was written back when every NPC was permanently in
      // Rec Room (§9), so the gap was invisible — nothing could ever be in
      // a different room to leak across. Now that NPCs actually change
      // rooms (this pass), a rumor/muster/emotion could otherwise hop
      // straight through a wall. Room-gated the same way every other
      // NPC-to-NPC/NPC-to-player proximity check in this file already is.
      if (npc.room !== source.room) continue;
      const dist = Phaser.Math.Distance.Between(source.x, source.y, npc.x, npc.y);
      if (dist > PROPAGATION_RADIUS) continue;
      if (Math.random() > catchChance) continue; // heard about it, didn't actually react

      visited.add(npc.pilotId);
      // Adjustment, 25 Aug 2026, revised same day per Maxime: first pass
      // just exempted the rumor's own subject from the relay so she
      // wouldn't overhear gossip about herself ("heard Iyari turned Rourke
      // down" reaching Iyari). Sharpened: she should still catch the wave
      // like anyone else, but what she reacts WITH is her own catalyst-
      // driven emotion, not the gossip line about her — and that reaction
      // is what keeps traveling outward from her, the same way any other
      // emotion echo would. So the rumor effectively converts into a
      // forced-anger emotion the moment it reaches its own subject, then
      // rides the ordinary emotion relay/distort machinery from there.
      const message = isRumorSubject(npc, incoming)
        ? ({ kind: "emotion", echo: "anger" } as HubMessage)
        : Math.random() < PROPAGATION_DISTORT_CHANCE
          ? distortMessage(incoming)
          : incoming;
      const line = pickLineForMessage(npc.ambient, message);
      if (message.kind === "muster") this.sendToMuster(npc);

      // Staggered per relay so the wave visibly travels across the room
      // instead of every catch popping in on the same frame.
      this.time.delayedCall(hop * PROPAGATION_HOP_DELAY_MS, () => {
        this.showBubble(npc, line, this.time.now);
      });
      this.time.delayedCall((hop + 1) * PROPAGATION_HOP_DELAY_MS, () => {
        this.propagate(npc, message, visited, hop + 1);
      });
    }
  }

  private showBubble(npc: HubNpc, line: string, now: number) {
    npc.bubbleContainer.removeAll(true);
    const wrapWidth = 190;
    const text = this.add.text(0, 0, line, {
      fontFamily: "monospace",
      fontSize: "11px",
      color: TEXT_MAIN,
      wordWrap: { width: wrapWidth - 16 },
      align: "left",
    });
    text.setOrigin(0.5, 1);
    const bounds = text.getBounds();
    const bg = this.add
      .rectangle(0, 0, Math.max(bounds.width + 16, 60), bounds.height + 12, PANEL_BG, 0.96)
      .setStrokeStyle(1, PANEL_BORDER)
      .setOrigin(0.5, 1);
    text.setPosition(0, -6);
    bg.setPosition(0, 0);
    npc.bubbleContainer.add([bg, text]);
    // 26 Aug 2026, Build Plan §24 — another real latent bug this pass
    // exposed, same root cause and same fix shape as propagate()'s own
    // comment just above: bubbleContainer is a top-level GameObject, not a
    // child of npc.root, so its visibility was never actually tied to
    // whether the NPC itself is visible — harmless while every NPC was
    // permanently in Rec Room with the player, wrong the instant an
    // encounter can fire between two NPCs standing in a room the player
    // isn't even in. Only show it if this NPC is actually in the room the
    // player's currently looking at; refreshRoomVisibility/setNpcRoom
    // already hide it correctly on a room change, this is the other half —
    // stopping it from being shown true in the first place.
    npc.bubbleContainer.setVisible(sameDeck(npc.room, this.currentRoomId));
    // Comms log, Hub polish 26 Aug 2026 — same room-gate as the visibility
    // line just above, on purpose: rumor/propagate() can call showBubble
    // for an NPC in a room the player isn't even standing in (see
    // propagate()'s own header, "not proximity-gated"), and that bubble is
    // correctly invisible in-world for the same reason. The log is a
    // record of what the player could actually have seen/heard, not an
    // omniscient transcript — so it stays gated the same way.
    if (sameDeck(npc.room, this.currentRoomId)) this.logChatLine(npc.initials, line);

    const duration = Math.min(6000, 2600 + line.length * 30);
    npc.bubbleUntil = now + duration;
  }
}

function isRumorSubject(npc: HubNpc, message: HubMessage): boolean {
  if (message.kind !== "rumor") return false;
  return npc.displayName.split("—")[0].trim() === message.rejectorName;
}

// Visible Stage cue, 27 Aug 2026 (later pass) — Social Sim Roadmap #5: "a
// small badge or pip near a pilot's portrait... would give players who
// miss the one-time bubble a persistent way to notice," complementing
// rather than replacing §37's graduation reveal — the reveal is the
// moment, this is the lasting evidence. Plain English over a cryptic
// abbreviation, matching this file's existing "with X"/"(demo)" style
// rather than inventing a new pip/icon convention. Not exported: this
// string is only ever consumed by favorabilityLabel just below.
function stageBadge(stage: Stage): string {
  const label = stage === "green" ? "Green" : stage === "blooded" ? "Blooded" : "Command";
  return `[${label}]`;
}

// rival param added 27 Aug 2026 (Social Sim Roadmap #7) — same optional,
// append-if-present shape partner already used. A pilot can in principle
// have both at once (dating one NPC, clashing with a totally different
// one — two independent axes, relationships list vs. worst bond), so
// both tags render together rather than one taking priority.
function favorabilityLabel(npc: HubNpc, partner?: string, rival?: string): string {
  const sign = npc.favorability >= 0 ? "+" : "";
  let base = `${npc.displayName.split("—")[0].trim()}  ${stageBadge(npc.ambient.stage)}  ${sign}${npc.favorability} (demo)`;
  if (partner) base += `  ♥ ${partner}`;
  if (rival) base += `  ⚡ ${rival}`;
  return base;
}
