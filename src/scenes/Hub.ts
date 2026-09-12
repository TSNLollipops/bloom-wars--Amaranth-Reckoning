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
// following the player through one big contiguous world. A room swap
// reuses Phase 1's existing single-room collision model unchanged: every
// room shares the exact same rectangle footprint (ROOM_BOUNDS), doors are
// proximity-triggered exactly like piece #4's bay (E to enter, same
// interact prompt), and switching rooms just swaps which room's doors/
// NPCs are active and repositions the player at the entry point.
//
// Carrier Scale-Up Plan v1, Phase 1, 2 Sep 2026 — the scrolling camera
// this comment originally argued against DID end up getting built (see
// startFollow/deckCameraBounds below), once Upper deck's overcrowding made
// "more floor per deck" worth that engineering cost. What this comment got
// right stands unchanged, though: the discrete swap BETWEEN decks (stairs/
// doors) is untouched — only the space WITHIN a deck now scrolls. Every
// fixed-position UI element this comment used to warn about
// (instructions text, interact prompt, chat DOM input, footer buttons —
// plus everything added since) got an explicit .setScrollFactor(0) as
// part of this pass, exactly the audit this paragraph once predicted would
// be needed if a scrolling camera ever shipped.
import Phaser from "phaser";
import { PATH_COLORS, PATH_SHAPES, pilotInitials, drawPilotAvatar } from "./TransporterPad";
import {
  pickLineForMessage,
  pickMusterDeclineLine,
  distortMessage,
  stageFromTier,
  detectStagePromotion,
  pickStagePromotionLine,
  detectRankPromotion,
  pickRankGreetingLine,
  STRESS_PANIC_THRESHOLD,
  type AmbientPilotState,
  type HubMessage,
  type Stage,
  type Catalyst,
} from "../data/ambientLines";
// Groups 3-5 batch rebuild, 28 Aug 2026 — Anger Blowup, Toxic Pairs, and
// Breakdown (see each module's own header for the full design). Third
// build of all three — the first two were verified clean in cloud sandboxes
// that were each lost before reaching this device; see
// claude/Bloom_Wars_Master_Index.md and claude/Bloom_Wars_Pending_Device_
// Commit_28Aug2026.md for that history.
import { isAngerBlowupEligible, applyAngerBlowupStressRelief, pickAngerBlowupExchange, ANGER_BLOWUP_CHANCE, ANGER_BLOWUP_BOND_DELTA } from "../data/angerBlowup";
import { applyToxicPairStressTick } from "../data/toxicPairs";
import {
  isBreakdownEligible,
  applyBreakdownStressRelief,
  pickBreakdownOnsetLine,
  pickBreakdownResolutionLine,
  BREAKDOWN_CHANCE,
  BREAKDOWN_FAVORABILITY_GAIN,
  BREAKDOWN_SLEEP_TIMEOUT_MS,
  type BreakdownFlavor,
} from "../data/breakdown";
import {
  interpretPlayerChat,
  detectUnbuiltVerbLine,
  detectVerbRequest,
  detectHistoryRequest,
  detectHighlightsRequest,
  detectBuildRequest,
  detectDebriefRequest,
  detectBriefRequest,
  mentionsCoByAlias,
  detectConfideRequest,
  detectRemovePilotIntent,
  detectSmallTalk,
  detectMoveItRequest,
  extractNamedTarget,
  CHAT_FALLBACK_LINES,
  detectCommand,
  unknownCommandLine,
  COMMAND_HELP_LINES,
  type ChatCommand,
  type BuildRequest,
  type KnownUnbuildableId,
  type BuildableBayId,
} from "../data/chatIntent";
// Crew-interaction brainstorm pass, 2 Sep 2026 — six new single-target
// verbs (Gift/Praise/Insult/Apology/Congratulate/Send-Off) plus the CO's
// two new bespoke lines (Confide, the Tier-3 call-out). See that file's own
// header for the full provenance; every function/constant below is used
// exactly once, in this scene's own new handler methods further down.
import {
  // The seven social verbs' own constants and line picks moved to
  // engine/socialVerbResolution.ts, 12 Sep 2026 — see applySocialVerb.
  MC_STRESS_DEFAULT,
  CONFIDE_STRESS_DELTA,
  pickCoConfideLine,
  pickCoCalloutLine,
} from "../data/socialActions";
// Chat Keyword Categories Plan v1 closing pass, 1 Sep 2026 — see
// data/smallTalk.ts's own header for the full provenance (three separate
// 1 Sep content docs) and the two judgment calls made wiring it in.
import { pickGreetingLine, pickFarewellLine, pickAdviceLine, pickBanterLine, pickCoGreetingLine, pickCoFarewellLine, pickCoAdviceLine } from "../data/smallTalk";
import { pickCatalystReaction, pickAmbientLineWithBleed, findCatalystClash } from "../data/catalystProfile";
import { pickSlottedVariant, resolveSlotText, type SlotContext } from "../data/crewBanterSlots";
import { VERBS, type SocialLogEntry } from "../data/verbs";
import { buildFirstMilestones, buildStagePromotionMilestones, buildMemoryMilestones } from "../data/highlights";
import { pruneExpiredHotTopics, pickHotTopicForSpeaker, renderHotTopicLine, type HotTopic } from "../data/hotTopics";
import { deriveRelationshipStage, relationshipStagePhrase, pickRelationshipStageLine } from "../data/relationshipStage";
import { pickFrictionLine } from "../data/friction";
import { worryTriggerChance } from "../data/missionWorry";
import { upsertWorry, removeWorry, loudestWorry, type WorryEntry } from "../data/worries";
import { gate0Reacts } from "../data/reactionGate";
import { NEED_ROOM, NEEDS_FLAVOR_BANK, NEEDS_FLAVOR_CHANCE, NEEDS_LOW_THRESHOLD, needsStressMoraleDelta, tickNeed, worstNeed } from "../data/needsCounter";
import { resolveAskOut, isRomanceableSpecies, ALREADY_TOGETHER_LINES, CLOSE_FRIEND_ONLY_LINES } from "../data/romance";
import { UNIT_ARCHETYPES } from "../data/units";
import { pairKey, findClosestBond, findWorstRival, pointNear, pointAwayFrom, CLIQUE_THRESHOLD, RIVAL_THRESHOLD } from "../data/npcBonds";
import { isNpcEngaged } from "../data/npcEngagement";
import { makeShopButton } from "./shop/ShopPanel";
import { addMenuOverlayButton } from "./MenuOverlay";
import { playAmbient, stopAmbient } from "./audio/AudioManager";
// Cursor-following hover tip, 2 Sep 2026 — shared with Battle.ts. See
// scenes/ui/HoverTip.ts (drawing) and engine/hoverTipLayout.ts (placement,
// unit-tested).
import { HoverTip } from "./ui/HoverTip";
import { wrapTipText } from "../engine/hoverTipLayout";
// The Workshop's own second layer, 2 Sep 2026 — see data/carrierModules.ts.
import { CARRIER_MODULES, LOCKED_MODULES, type CarrierModuleId } from "../data/carrierModules";
import { purchaseCarrierModule, bayNeedsGeneratorFirst } from "../engine/campaignEconomy";
import {
  heirloomHouseVerdicts,
  heirloomsUnlocked,
  heirloomPicksRemaining,
  currentShortlist,
  recruitHeirloom,
  aristocracyStanding,
  returnedHeirlooms,
  resolveVaultDedication,
  heirloomState,
  fieldedHeirloom,
  fieldHeirloom,
  unfieldHeirloom,
  abilityRank,
  purchaseAbilityRank,
} from "../engine/heirlooms";
import {
  HEIRLOOMS,
  HOUSE_VERDICT_CLAUSES,
  heirloomRecruitCost,
  HEIRLOOM_RECRUIT_BUDGET,
  HEIRLOOM_MAX_ABILITY_RANK,
  HEIRLOOM_ABILITY_RANK_COST,
  HEIRLOOM_ABILITIES_LIVE_IN_COMBAT,
  type HeirloomId,
} from "../data/heirlooms";
import { createPegGame, applyMove as applyPegBoardMove, legalMovesForTurn as pegLegalMoves, pickAiMove as pickPegAiMove, type PegGameState, type PegMove } from "../engine/pegBoard";
import { createHoldemGame, applyHoldemAction, startNextHand as startNextHoldemHand, legalActionsFor as pokerLegalActions, potTotal as pokerPotTotal, pickAiAction as pickPokerAiAction, type HoldemGameState } from "../engine/holdem";
import type { BettingAction } from "../engine/cardTable/bettingEngine";
import { cardLabel, cardIsRed, type Card } from "../engine/cardTable/deck";
import { describeHand } from "../engine/cardTable/handEval";
import { createDartsGame, throwDart, pickAiThrowValue, zoneLabel, DART_ZONE_THRESHOLDS, type DartsGameState } from "../engine/darts";
import {
  loadCampaignState,
  saveCampaignState,
  ensureHubSocialState,
  ensureNpcSocialState,
  rankDisplayTitle,
  type CampaignState,
  type LanceId,
  type NpcSocialState,
  type Rank,
  type ReservedBayId,
  ensureRecRoomState,
  lanceOfMekIn,
  lanceOfPilotIn,
  areTutorialHintsEnabled,
  hasSeenHubHint,
  markHubHintSeen,
  companyNameOf,
  drainPendingHotTopics,
  type HubHintId,
} from "../engine/campaignState";
// Emotional Brain, 12 Sep 2026 (claude/Bloom_Wars_Emotional_Brain_Build_Plan_
// v1_12Sep2026.md): recordMemory writes the Hub events a pilot carries
// (a blowup, a breakdown, being asked out) into their persisted ledger;
// effectiveEchoLean/settleDrift give every NPC on the floor their own
// archetype lean plus drift, so pickSoloEcho's idle rung draws from who they
// are and what they have been through instead of a flat coin flip.
import { recordMemory, settleDrift } from "../engine/memoryLedger";
import { topMemories } from "../data/memories";
import { effectiveEchoLean } from "../data/echoLean";
import { currentDay as calendarCurrentDay } from "../engine/calendarClock";
// Rec Room Standings & NPC Learning, slice 3 (3 Sep 2026) — the player's own
// finished sessions are now recorded on the same board the crew sit on.
import { PLAYER_RECORD_ID, recordSession, skillFor, type RecGameId, type RecRoomState, type StandingsEntrant } from "../engine/recRoomRecord";
import { REC_GAME_IDS } from "../data/recRoomAptitude";
import { StandingsPanel } from "./ui/StandingsPanel";
import { MemorialPanel } from "./ui/MemorialPanel";
import { RosterPanel } from "./ui/RosterPanel"; // B2, the Hangar Deck crew records // B3, the roll of pilots lost — opened from the Vault
// UI Prettiness Pass v1, 10 Sep 2026 — the Workshop and Vault overlays'
// shared chrome (see the field comments just above and buildWorkshopOverlay/
// buildVaultOverlay below). Only the class, not its palette constants: this
// file already declares its own PANEL_BG/PANEL_BORDER/TEXT_MAIN/TEXT_DIM
// below (used by every OTHER overlay in this file — History, Highlights,
// Hangar Shop, Peg Board, Poker, Darts — none of which this pass touches),
// and Panel.ts's own copies of those constants are numerically identical on
// purpose, not a second competing palette — importing both under the same
// names would collide.
import { Panel } from "./ui/Panel";
// Codex Rebuild & Live Briefing Plan v1, Part B (4 Sep 2026) — the CO's
// "brief" chat command now opens a real, live, per-mission briefing. See
// data/missionBriefing.ts's own header for why the next-mission lookup
// lives there rather than on CampaignState directly, and
// ui/MissionBriefingPanel.ts's own header for the panel itself.
import { MissionBriefingPanel } from "./ui/MissionBriefingPanel";
import type { CampaignMission, Path, Species } from "../data/types";
// Calendar economy, 2 Sep 2026 — the Hub is one of the two scenes whose real
// elapsed time feeds the campaign calendar (Battle.ts is the other). Maxime:
// "time spent in the hub and time spent on mission run on the same ckock."
import { tickCalendar, applyVerbDayCost, formatDayLabel, measureRealDelta, currentDay } from "../engine/calendarClock";
import { addPlayerNote } from "../data/playerNotes";
import { resolveSocialVerb, type SocialVerb } from "../engine/socialVerbResolution";
import { catalystForPilot } from "../data/npcSeed";
// Tier 3, 30 Aug 2026 (Consolidated Build Plan — Hub population driven by
// the real roster) — buildNpcs()'s pilot lookup used to go straight
// through WARDEN_PILOTS.find(), which only ever covers that one five-pilot
// source list. Fine while every walkable NPC came from NPC_SEED (all three
// entries happen to be Warden pilots), silently wrong the moment the cast
// grows to the real roster: a Second/Third Lance or bench pilot would
// still resolve to `pilot?.displayName ?? pilotId` and show their bare id
// instead of a name. Tier 3 fixed that with data/pilotRegistry.ts's
// findPilot(), which indexes every hand-authored source list
// (WARDEN/SECOND_LANCE/THIRD_LANCE/ROSTER_DEPTH/PILOTS) — wider than
// WARDEN_PILOTS.find() alone, but STILL a static index, and it does not
// and cannot cover a runtime-generated recruit (engine/campaignState.ts's
// generatePilot), which is in none of those five lists. That gap
// resurfaced the exact same bare-id symptom findPilot() was built to fix
// (Maxime, screenshot, 30 Aug 2026: "2cd npic is the recruit name not
// showing well" — "pilot_recruit_3" rendered as a name tag). The real
// fix: buildNpcs() already has `this.campaignState.pilots[pilotId].pilot`
// on hand for every id it loops over — the LIVE, per-campaign copy,
// always present and always complete, generated or hand-authored alike —
// so it now reads straight off that instead of any static index, and
// findPilot() is no longer called from this file at all.
// Tier 4, 30 Aug 2026 (Consolidated Build Plan — Hangar Deck roster/stats
// panel) — see HANGAR_SHOP_POINT's own header. ShopPanel is already scene-
// agnostic (Debrief.ts, Hangar.ts) — reused directly rather than building
// a third copy of the same roster/gear/recruit UI.
import { ShopPanel } from "./shop/ShopPanel";
// 26 Aug 2026 — the "visible interaction" piece §17.3's own roaming never
// had: two roaming NPCs closing distance meant nothing on arrival before
// this. Reuses today's background social-sim harness verbatim rather than
// re-deriving any of Talk/peg board/poker/fletchers/Ask Out — see
// updateNpcEncounters()/runNpcEncounter() below and socialSim.ts's own
// header for the full design history.
import { simulateEncounter, resolveSparEncounter, isCommitted, type SocialSimPilot } from "../engine/socialSim";
// The egg hull, 27 Aug 2026 — kept in its own Phaser-free module so its
// math is directly unit-testable; see hubGeometry.ts's own header for why.
import { clampToEllipse } from "../engine/hubGeometry";
// The ship's floor plan, 3 Sep 2026 — walls, corridors, rooms, furniture,
// stairs and every landmark coordinate, as data in one Phaser-free module
// (see its header). Hub.ts draws it, clamps against it, and paths through
// it (engine/hubNav.ts); it no longer owns any of the geometry itself.
import {
  type DeckId,
  type RoomId,
  type Rect,
  type Decor,
  layoutOf,
  roomAt,
  resolveAgainstSolids,
  WALL_T,
  C as PAL,
} from "../engine/hubLayout";
import { findPath } from "../engine/hubNav";
// Which building this is — 6 Sep 2026, House Amaranth Hub build (step 1 of
// claude/Bloom_Wars_House_Amaranth_Hub_Build_Plan_v1.md). Every landmark
// point, room/deck table, stair, reserved bay, the CO, the player's own
// pilot id and the seeds used to be Warden constants imported or declared
// in this file; they're a FacilityProfile now (engine/facility.ts),
// handed in by the constructor. `this.f` is the derived, total-typed view
// of it Hub.ts actually reads. Warden's profile is facilityWarden.ts —
// the old constants, moved, not changed.
//
// The comments below this line still name those constants where they tell
// the history of a decision (a hundred-odd mentions; rewriting them would
// lose more than it fixed). Reading key, old name -> where it lives now:
//   ROOM_DECK[r] / ROOM_TITLES[r] / ROOM_NOTES[r] / ROOM_ZONE_BOUNDS[r]
//     -> this.f.roomDeck(r) / roomTitle(r) / roomNote(r) / roomZone(r)
//   DECK_TITLES[d] -> this.f.deckTitle(d)   ROAMABLE_ROOMS -> this.f.roamableRooms
//   DOORS / DECK_ORDER / RESERVED_BAYS -> this.f.doors / deckOrder / reservedBays
//   LANCE_BERTHS / LANCE_WORKSHOP -> this.f.berthRoomFor(l) / workshopRoomFor(l)
//   MUSTER_POINT, HANGAR_SHOP_POINT, CREW_RECORDS_POINT, RECROOM_TABLE(_POINT),
//   RECROOM_BOARD_POINT, RECROOM_SEATS, WORKSHOP_BENCH_POINT, VAULT_PLINTH_POINT,
//   CO_POINT, PLAYER_SPAWN -> this.f.points.{muster, hangarShop, crewRecords,
//     recroomTable, recroomBoard, recroomSeats, workshopBench, vaultPlinth, co,
//     playerSpawn}
//   MEK_SPOTS[room] -> this.f.mekSpots(room)
//   NPC_SEED / NPC_BOND_SEED -> this.f.profile.regulars / bondSeed
//   WARDEN_PILOTS.find(rourke) -> this.campaignState.pilots[this.f.profile.mc.pilotId]
//   "pilot_rourke" (the player) -> this.f.profile.mc.pilotId
//   the hand-built CO / mekSeeds / MEK_CATALYST_OVERRIDES -> this.f.profile.co /
//     mekSeeds / mekCatalysts
//   sameDeck / nextHopDoor / pickDoorLanding / pickDoorApproach /
//   pickExploreTarget / berthRoomFor / workshopRoomFor -> methods on this class
import { type FacilityProfile, type FacilityTables, type DoorDef, type ReservedBayDef, buildFacilityTables, mekCatalystFor } from "../engine/facility";
import { WARDEN_FACILITY } from "../engine/facilityWarden";

// The 700x444 box every overlay (poker, darts, peg board, workshop, vault,
// history, highlights, help) draws itself inside, in SCREEN space. This
// used to be every room's world footprint too, back when the four decks
// were screen-locked; since the 3 Sep 2026 floor-plan pass no world
// geometry reads it any more — every world coordinate comes from
// engine/hubLayout.ts. Kept under its old name so the ~40 overlay call
// sites below stay untouched; it is an overlay box now, nothing else.
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
// Carrier Scale-Up Plan v1, Phase 1, 2 Sep 2026 — the Plan doc's own
// assumption ("a bigger deck bound is more likely to just mean NPCs have
// more room to wander") turned out to only be half true: the explore
// branch below has only ever picked a named room (pickExploreTarget, then
// a point inside that room's own small ROOM_ZONE_BOUNDS), and the mingle/
// clique/rival branches only ever walk toward another NPC's live position
// — so without this, a bigger deck floor changes what the PLAYER can walk
// on and what the camera can see, but changes nothing about where NPCs
// themselves ever actually go. That's a real gap against Maxime's own
// playtest complaint this whole pass exists to answer ("the 3rd lvl is
// way too overcroawed") — more empty floor around a crowd doesn't relieve
// the crowd. This is that fix: a fraction of explore rolls send an NPC to
// a random point on their own deck's full open floor (pickOpenFloorPoint
// below) instead of to a named room. Kept a minority of explore rolls, not
// a majority — 0.3 is a placeholder like DECK_FLOOR_RIGHT/BOTTOM above,
// not measured against a live playtest, but the intent is idle pilots
// visibly spreading out sometimes, not the Rec Room/Workshop emptying out
// or every actual need (hunger/thirst/sleep/boredom) losing its pull.
const EXPLORE_OPEN_FLOOR_CHANCE = 0.3;
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
// 3 Sep 2026 — candidates are ROAMABLE_ROOMS (corridors excluded), and
// with one berth room per lance the BERTHS_EXPLORE_WEIGHT bump goes to the
// NPC's OWN lance's berths (`homeBerths`); the other lances' bunks stay at
// the baseline 1 — you drift toward your own quarters, not any bunk room.
// pickExploreTarget is a method now (Hub.pickExploreTarget) — it reads the
// facility's roamable rooms. 6 Sep 2026, facility split.

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

// Tier 6 hotfix, 30 Aug 2026 — Maxime's "got stuck ... been there a while"
// report. Root cause: this whole encounter system (see updateNpcEncounters'
// own header a bit further down) was built and tuned for the ORIGINAL fixed
// 3-pilot Hub cast. Tier 3 (earlier this session) switched Hub population to
// the full active campaign roster — 15-20+ pilots by midgame. Nothing about
// the encounter loop itself broke: cooldowns/eligibility still work exactly
// as designed, per-pair. What breaks is the PLAYER-FACING result once the
// roster is that much bigger: (a) the clique-approach/mingle roaming logic
// (updateNpcRoaming, same-room branch) actively walks bonded/idle pairs
// toward each other, so a much bigger cast produces real physical clusters,
// not just more scattered pairs; (b) once several NPCs are clustered inside
// ENCOUNTER_RADIUS of each other, this O(n^2) scan can find and fire several
// DIFFERENT eligible pairs within the same few-second window, each popping
// its own bubble — and since each individual bubble already fades on its
// own timer (showBubble/updateBubbles — no single bubble is stuck), what the
// player actually sees isn't one frozen thing, it's a spot where something
// new keeps overlapping before the last thing finished fading. That reads
// as "stuck" even though every piece of it is, individually, working
// exactly as designed. Maxime's screenshot (dense overlapping NPC-vs-NPC
// result lines) matches this exactly, not a hang or a click-trap — there's
// no player/NPC collision in this scene (WASD movement only), so walking
// away from a crowded spot has always been the immediate way out; this
// throttle is the actual fix so a crowd can't recreate the pileup.
//
// Fix: cap how many bubbles can be visible AT ONCE on the deck the player
// is actually looking at, and simply skip firing new encounters for that
// deck once it's at the cap — cheap, and non-disruptive to the underlying
// social sim, since a skipped pair's own nextEncounterAt was never
// consumed, so it just tries again next tick and fires the moment a slot
// frees up (no double-counting, no lost encounters, just staggered ones).
// Decks the player isn't currently looking at are untouched — their
// bubbles aren't visible anyway, so there's nothing to throttle there, and
// their bond/stress mechanics keep running normally in the background.
const MAX_CONCURRENT_BUBBLES_PER_DECK = 3;

// Anger Blowup, 28 Aug 2026 (Groups 3-5 batch rebuild) — its own, longer,
// RANDOMIZED cooldown range, deliberately separate from
// ENCOUNTER_COOLDOWN_MIN/MAX_MS above. A blowup is the heavier of the two
// encounter kinds this scene can produce; letting it repeat on the same
// ~12-22s clock an ordinary encounter uses would make it read as routine
// instead of a real flare-up. 90 seconds to 3 real minutes, per the
// authoritative spec (Social Sim Roadmap #15 / Master Index Group 3) —
// the first rebuild pass used a flat 45s instead of this range.
const ANGER_BLOWUP_COOLDOWN_MIN_MS = 90_000;
const ANGER_BLOWUP_COOLDOWN_MAX_MS = 180_000;

// Breakdown, 28 Aug 2026 — how often updateBreakdownTrigger rerolls
// eligibility for an NPC not currently mid-crisis. 15 real seconds per
// the authoritative spec (Social Sim Roadmap #16 / Master Index Group 5)
// — the first rebuild pass used 30s, borrowed from WORRY_RECHECK_MS's own
// cadence rather than the real spec's own number.
const BREAKDOWN_CHECK_INTERVAL_MS = 15_000;

// Breakdown's own post-resolution cooldown — 90 seconds to 3 real
// minutes, mirroring Anger Blowup's cooldown shape exactly (Social Sim
// Roadmap #16: "sets a 90-180 second cooldown before the pilot can
// trigger again, mirroring #15's own cooldown shape exactly"). Reuses
// nextBreakdownCheckAt rather than a second dedicated field — the
// trigger recheck and the post-resolution cooldown are the same kind of
// "don't reroll yet" gate, just set to a longer value right after a
// resolution than an ordinary 15s recheck would.
const BREAKDOWN_RESOLUTION_COOLDOWN_MIN_MS = 90_000;
const BREAKDOWN_RESOLUTION_COOLDOWN_MAX_MS = 180_000;

// Boredom-driven Spar, 30 Aug 2026 (Maxime: "boredom should trigger spar")
// — the chance tryBoredomSpar actually fires once a same-room, eligible
// pair is already found in the Spar Room. Set noticeably higher than
// ANGER_BLOWUP_CHANCE (0.35, data/angerBlowup.ts) on purpose: a blowup is
// meant to read as a rare flare-up, but a bored pilot walking all the way
// to the Spar Room specifically looking for a bout should actually usually
// find one once someone else is there too, not whiff most of the time —
// same "not a locked number, tune against real play" placeholder status as
// every other chance/weight in this file.
const SPAR_CHANCE = 0.5;

// Live-visual staging, 26 Aug 2026 — Maxime: "we go ham bro" on the "full
// live-Hub-visual NPC-to-NPC feature" this file's own header already
// named as an acknowledged future goal. Gap between npcA's opening line
// and npcB's reply bubble — long enough to actually read npcA's line
// first (matches showBubble's own duration floor, 2600ms minimum), short
// enough that it still reads as one continuous exchange rather than two
// unrelated barks. Placeholder, same "not a locked number" caveat as
// every other timing constant in this file.
const NPC_REPLY_DELAY_MS = 1800;

// NPC Conversation Lock Fix, 6 Sep 2026 (Maxime bug report: Hub NPCs
// mid-conversation get pulled away by ambient roaming before finishing
// their scripted exchange). Root cause: showBubble()'s own bubbleUntil
// only gets set the instant a bubble actually appears — for npcB in a
// staged two-line exchange, that's NPC_REPLY_DELAY_MS in the future, so
// there was a real window (as low as ROAM_INTERVAL_MIN_MS, 5000ms) where
// neither updateNpcRoaming nor updateNpcEncounters had any reason yet to
// leave either participant alone. engagedUntil (HubNpc's own field, see
// its comment) is set the instant an encounter starts instead, covering
// the whole exchange up front rather than reacting to bubbles as they
// appear one at a time.
//
// BUBBLE_DURATION_CAP_MS names the same 6000ms hard cap showBubble()
// already computes inline (Math.min(6000, 2600 + line.length * 30)) —
// one name so the two can't quietly drift apart. NPC_ENGAGEMENT_HOLD_MS
// is a flat NPC_REPLY_DELAY_MS + BUBBLE_DURATION_CAP_MS applied
// uniformly by every encounter-staging function below (runNpcEncounter,
// runAngerBlowup, runBoredomSpar) — even the branches that only ever show
// one instant bubble with no delayed reply. Deliberate overestimate for
// those, same "flat cap instead of threading the real value out of a
// closure" simplification NPC_REPLY_DELAY_MS's own staged exchange
// already relies on, not a bug.
const BUBBLE_DURATION_CAP_MS = 6000;
const NPC_ENGAGEMENT_HOLD_MS = NPC_REPLY_DELAY_MS + BUBBLE_DURATION_CAP_MS;

// isNpcEngaged itself — the exact boolean this fix hinges on — lives in
// data/npcEngagement.ts, not here, same "this file composes, data/**
// decides" split every other predicate in this file already follows
// (findClosestBond/findWorstRival from npcBonds.ts, gate0Reacts from
// reactionGate.ts, and so on). Tried keeping it local first as this file's
// first-ever named export; that broke the moment a real test tried to
// import Hub.ts directly — Phaser's own OS-detection code runs at module
// load time and reaches for `window`, which doesn't exist under Vitest's
// default Node environment (no test file has ever imported a scenes/*.ts
// file before this, so nothing had hit that wall yet). A dependency-free
// data/ module sidesteps it entirely, which is also just the right home
// for a function with no Hub-specific logic in it at all.

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

// The room set — Build Plan §9's transporter-pad room, Antfarm §2/§11.3's
// five rooms + the grotto, sparRoom (28 Aug 2026), the per-lance
// workshops and berths, heads/engineering/forwardBays and the two spine
// corridors (3 Sep 2026 floor-plan pass) — is described, room by room with
// its history, next to the data it names: engine/facilityWarden.ts (Warden)
// and engine/facilityHouseAmaranth.ts (the Greathouse). RoomId/DeckId
// themselves live in engine/hubLayoutKit.ts alongside the geometry they
// index, so hubLayout.test.ts can name rooms without importing this
// Phaser-bound file.
// ROOM_TITLES, ROOM_NOTES, ROOM_DECK, DECK_TITLES, ROAMABLE_ROOMS, LANCE_BERTHS
// and their history moved to engine/facilityWarden.ts on 6 Sep 2026 (the
// facility split — see the FacilityProfile import above). Read them through
// this.f (roomTitle / roomNote / roomDeck / deckTitle / roamableRooms /
// berthRoomFor). isBerths stays: the three berth ids are shared between
// facilities on purpose (a Barracks IS `berths`).
function isBerths(room: RoomId): boolean {
  return room === "berths" || room === "berthsB" || room === "berthsC";
}

// The egg hull (27 Aug 2026), the Carrier Scale-Up (2-3 Sep 2026) and every
// per-deck bound that used to be declared here (ROOM_ZONE_BOUNDS,
// GROTTO_BOUNDS/GROTTO_ELLIPSE, LOWER/UPPER/SPAR_ROOM_BOUNDS,
// DECK_FLOOR_RIGHT/BOTTOM, ZONE_SPLIT_X/Y) were replaced wholesale by
// engine/hubLayout.ts's DECK_LAYOUTS on 3 Sep 2026. The history those
// comments carried — why the grotto is an oval, why the decks grew, why
// the old rooms tiled one box — is summarised in that module's header and
// in the build-log addendum for this pass rather than kept here as dead
// text next to constants that no longer exist.
// Antfarm build economy, first slice, 27 Aug 2026 — Arangement of
// Content's own pilotId, hoisted here from buildNpcs() (where it's set
// when he's actually seated) so submitChat can gate build requests on
// "standing with the CO specifically" without either duplicating the
// literal string or reaching into buildNpcs's own local scope.
const CO_PILOT_ID = "npc_co";

// Every key this scene asks Phaser to preventDefault, in one place — 2 Sep
// 2026. This used to be three hand-written string literals (create's
// addCapture, openChat's removeCapture, closeChat's addCapture) that had
// already drifted: the last two listed M and R unconditionally while
// create() only binds them in dev builds, so a production close-chat was
// capturing two keys nothing reads.
//
// Centralised because adding H and L this pass would have drifted it
// further in a way a player would actually feel: create() would capture
// them, openChat's literal wouldn't release them, and both letters would
// have been preventDefault'd straight out of the chat input — typing
// "hello" would have produced "ello". One source, three call sites, no
// way for the release to disagree with the capture.
function hubCaptureKeys(): string {
  return import.meta.env.DEV ? "W,A,S,D,E,M,R,T,H,L,B" : "W,A,S,D,E,T,H,L,B";
}

// CO Check-In Gate Plan v1, 28 Aug 2026 — built 1 Sep 2026. See
// engine/campaignState.ts's own CampaignState.hasCheckedInWithCo comment
// and canLaunchMission for the gate this satisfies. Called from every
// distinct place this file already resolves "the player reached the CO" —
// ordinary Talk (speak()), a chat build request, and small talk — rather
// than adding a fourth, separate detection path. Guarded so a save that's
// already checked in doesn't re-write/re-save on every later visit.

// Mek NPC Introduction Plan v1 §2, 29 Aug 2026 — the Matchset bond value a
// Mek and their own pilot start seeded at (npcBonds.ts's pairwise bond
// store, backfilled by buildNpcs()'s Mek-seeding loop below). Well above
// CLIQUE_THRESHOLD (20) on purpose — this is meant to read as the closest
// bond either of them has, not merely clique-eligible. Not derived from
// anything (there's no "how close should a 1:1 committed pairing be"
// formula anywhere else in this file to borrow), same placeholder caveat
// npcBonds.ts's own NPC_BOND_SEED values already carry.
const MEK_MATCHSET_BOND = 75;

// ReservedBayDef and RESERVED_BAYS (the six buildable slots and their
// positions) moved to engine/facility.ts / facilityWarden.ts, 6 Sep 2026 —
// read via this.f.reservedBays. Their history (Carrier Hub §11.2's twelve-
// bay list, the 28 Aug weaponsBay/fabricator additions, the 3 Sep move into
// Engineering / the Forward Bays) travelled with them.

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

// ROOM_ZONE_BOUNDS (every room's walkable interior, straight off the floor
// plan), sameDeck, LANCE_WORKSHOP and workshopRoomFor are facility-derived
// now — this.f.roomZone(room), this.sameDeck(a, b), this.f.workshopRoomFor
// (lance). 6 Sep 2026, facility split.

// Which of this deck's rooms a raw (x, y) currently sits over — used to keep
// currentRoomId / npc.room live as a position label while walking a shared
// floor. A point in a doorway or wall band (no room's interior) resolves to
// the NEAREST room, so a body halfway through a door never flickers to an
// arbitrary fallback — see hubLayout.ts's roomAt.
function zoneAt(deck: DeckId, x: number, y: number): RoomId {
  return roomAt(deck, x, y);
}

// The one place player/NPC movement decides which floor a body is allowed
// to occupy on the deck it's on. Two steps, in order: the deck's outer
// floor shape (a rectangle, or the grotto's ellipse — the same
// clampToEllipse the egg hull shipped with), then every wall and every
// piece of blocking furniture on that deck (hubLayout's
// resolveAgainstSolids, which pushes the circle out of anything it
// overlaps). Every site that produces a world position — tryMove,
// tryMoveNpc, door landings, spawn picks, roam targets, the muster pad,
// pickClearPoint — already flowed through here before this pass, which is
// exactly why walls only needed adding in ONE place to apply everywhere.
//
// Axis-separated movement (handleMovement/updateNpcMovement move x then y
// as two calls) turns the push-out into wall SLIDING for free: the x-step
// into a wall is pushed straight back, the y-step still lands, and the
// body slides along the wall face rather than sticking to it.
function clampToDeckFloor(deck: DeckId, x: number, y: number, radius: number): { x: number; y: number } {
  const layout = layoutOf(deck);
  const b = layout.bounds;
  let px = Phaser.Math.Clamp(x, b.left + radius, b.right - radius);
  let py = Phaser.Math.Clamp(y, b.top + radius, b.bottom - radius);
  if (layout.ellipse) {
    const e = layout.ellipse;
    const c = clampToEllipse(px, py, e.cx, e.cy, e.rx, e.ry, radius);
    px = c.x;
    py = c.y;
  }
  return resolveAgainstSolids(deck, px, py, radius);
}

// Carrier Scale-Up Plan v1, Phase 1, 2 Sep 2026 — the camera's own version
// of clampToDeckFloor just above: one place per deck that says how far the
// camera is allowed to pan, called from refreshRoomVisibility() every time
// the active deck changes (a stair crossing or the initial create() call).
// The grotto's bounds are its ellipse's bounding box — Phaser's camera
// bounds are axis-aligned rectangles only, so the camera may look at the
// oval's rectangular corners (background beyond the drawn floor). Nothing
// stands there; clampToDeckFloor keeps every body on the ellipse itself.
function deckCameraBounds(deck: DeckId): Rect {
  return layoutOf(deck).bounds;
}

// Carrier Scale-Up Plan v1, Phase 1, 2 Sep 2026 — see EXPLORE_OPEN_FLOOR_
// CHANCE's own comment for why this exists. A random point inside the
// deck's rectangle can land inside a wall, a bunk, or (grotto) outside the
// ellipse — expected, not a bug, and harmless: every caller runs the
// result through clampToDeckFloor immediately after, which pushes it onto
// real floor, and the pathfinder takes it from there.
function pickOpenFloorPoint(deck: DeckId): { x: number; y: number } {
  const bounds = deckCameraBounds(deck);
  return {
    x: bounds.left + Math.random() * (bounds.right - bounds.left),
    y: bounds.top + Math.random() * (bounds.bottom - bounds.top),
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
// 3 Sep 2026, floor-plan pass — MUSTER_POINT is now hubLayout.ts's, and it
// sits in the HANGAR DECK, not the Rec Room. The pad had been a
// "placeholder stand-in for an actual bay/door" in the one room the game
// had on 26 Aug 2026; with a real hangar on the same deck, a launch pad in
// the lounge was the leftover, not a design. Every consumer already read
// MUSTER_POINT/MUSTER_ROOM rather than a literal, so the move is two lines.
// Tier 1, 30 Aug 2026 (Consolidated Build Plan — "muster call fails to
// route cross-deck") — single source of truth for which room MUSTER_POINT
// actually sits in, read by sendToMuster below and by isNearBay's own
// currentRoomId check, which used to hardcode the same "recroom" literal
// separately. MUSTER_POINT predates the Antfarm Grid's multiple decks
// entirely (this comment block's own header, 26 Aug 2026, back when every
// NPC was Rec-Room-only) — nothing about it was ever revisited when decks
// were added 27 Aug, which is exactly the bug this constant's new use
// fixes.
const MUSTER_ROOM: RoomId = "hangarDeck";

// The Rec Room table, 30 Aug 2026 (Maxime: "ther eshould be a table in the
// rec room they can go around. assign sport around the table, if full the
// ant gonna find something else to do"). A real point + capacity, not just
// a visual — the same "landmark point other systems key off of" role
// MUSTER_POINT already plays, one deck over. Placed clear of every named
// pilot's own fixed seat (buildNpcs' `positions`: (220,268)/(460,268)/
// (340,462)) and of MUSTER_POINT itself (480,502), roughly the room's own
// open center instead.
//
// RECROOM_TABLE_SEATS is a headcount, not a literal ring of pre-computed
// seat coordinates — updateNpcRoaming's own mingle branch (see its
// "at the table" comment) only needs to know how many NPCs already count
// as "at the table" (within RECROOM_TABLE_RADIUS) to decide whether
// there's room for one more; it doesn't need to reserve a specific chair.
// 3 Sep 2026 — the table is a real solid now (hubLayout.ts's roundTable):
// bodies can't stand ON it any more, only around it, so "at the table"
// below means within RECROOM_TABLE_RADIUS + a body's own radius + a little
// slack of the rim rather than inside the disc.
// RECROOM_TABLE is this.f.points.recroomTable now (6 Sep 2026, facility split).
const RECROOM_TABLE_RADIUS = 46;
const RECROOM_TABLE_SEATS = 4;

// 3 Sep 2026 — how close an NPC has to get to a hubNav waypoint before it
// steers for the next one. Bigger than NPC_ARRIVE_THRESHOLD on purpose:
// waypoints are corners to cut past, not spots to stand on, and a tight
// reach makes a body wobble at every doorway.
const NAV_WAYPOINT_REACH = 12;
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

// Move It Verb Proposal, 3 Sep 2026 — the doorway/corridor-jam gap this same
// give-up mechanism above left open on purpose ("a shove, not manners" — see
// the Ship Interior addendum's own note). clearCluster() below reuses this
// exact NPC_R*2 sidestep, just applied to a whole local cluster in one pass
// instead of each member discovering it's stuck on its own separate
// STUCK_TIMEOUT_MS timer. NPC_R*3 (~48px): generous enough to catch two-and-
// a-half NPCs standing shoulder to shoulder in a doorway, tight enough not to
// sweep in someone across the corridor. Feel constant, not a balance number —
// tune by playtest, doesn't need combat_sim.py/maps.py.
const CLUSTER_RADIUS = NPC_R * 3;

// Tier 6 hotfix, 30 Aug 2026, REMOVED 5 Sep 2026 — this used to be the
// player-side counterpart to the NPC stuckMs give-up above: a belt-and-
// suspenders catch-all for a player genuinely encircled and boxed in by a
// crowd of NPCs (handleMovement's own per-axis NPC collision, tryMove,
// used to block every direction at once in that case). 5 Sep 2026, Maxime:
// "make people able to pass tru each other with no collision, getting
// stuck in corridor is anothing as fuck." Bodies no longer block movement
// at all (see tryMove/tryMoveNpc below) — a player can no longer be boxed
// in by NPCs, full stop, so this mechanism had zero conditions left under
// which it could correctly fire. Left in place it would have turned into a
// landmine instead of a safety net: still capable of firing (any time the
// player is genuinely wall-stuck AND a couple of NPCs happen to be walking
// past, which is common in exactly the corridors this was built for), but
// for the wrong reason every time — silently teleporting the player away
// for no visible cause. Removed outright rather than left dormant.
// NPC-side stuckMs/clearCluster just below carries the identical original
// justification (collision-caused deadlocks) but is left in place — it
// still does something harmless and occasionally useful even without body
// collision (a generic give-up-and-retry if a pathfinding step ever nets
// to zero progress against a wall), it doesn't misdiagnose and relocate
// anyone the way this one would have.

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

// Tier 4, 30 Aug 2026 (Consolidated Build Plan — Hangar Deck roster/stats
// panel). hangarDeck has been walkable since the Antfarm Grid shipped (27
// Aug) but purely decorative — ROOM_NOTES' own old text said as much
// ("still lives in the Campaign Shop for now"). The actual roster/gear/
// recruit UI already exists as ShopPanel (scenes/shop/ShopPanel.ts) and is
// already scene-agnostic by design (Debrief.ts and Hangar.ts both drive it
// against the same live CampaignState — see that file's own header on why
// it was extracted in the first place) — Maxime's call, asked directly:
// reuse it here too rather than build a second, thinner roster view, so a
// player never has to leave the Hub to manage their squad. Point sits
// centered in hangarDeck's own zone (ROOM_ZONE_BOUNDS.hangarDeck =
// [550,830]x[108,330]) with real clearance on every side — hangarDeck has
// no door of its own (DOORS only connects recroom/grotto/workshop/
// sparRoom), so there's nothing else in this zone to collide with.
// (3 Sep 2026: position now owned by hubLayout.ts, imported above.)
const HANGAR_SHOP_RADIUS = 60; // same magnitude as BAY_RADIUS — same "a real console you walk up to" interaction shape

// The Workshop bench, 2 Sep 2026 — Maxime: "finish the workshop add all
// the module from weapon and dev." Same walk-up-and-press-E console shape
// as HANGAR_SHOP_POINT above, in the Workshop's own zone this time.
//
// What this room is and ISN'T, since the source design gives the Workshop
// two layers (Bloom_Wars_Antfarm_Carrier_Hub_v1.md §3) and only one of
// them belongs here: layer one is "gear tier purchases, spare mek parts,
// mek secondary specializations... at their existing costs" — that's the
// Campaign Shop, and it is ALREADY reachable in this scene from the
// Hangar Deck's ROSTER & GEAR console. Putting a second door to the same
// panel in a second room would be two entrances to one screen, not a
// finished room. So the bench owns layer TWO, the Carrier Upgrade Modules,
// which is the half that has never had a home anywhere in the game.
//
// ROOM_ZONE_BOUNDS.workshop is the upper deck's own left/full-height
// column; this sits centred in it, clear of the deck's stairs.
// x=340 is that column's own centre ((130+550)/2). y=230 keeps a clear
// 100px from the workshop-to-grotto stair at (480, 130) — comfortably more
// than WORKSHOP_BENCH_RADIUS + DOOR_RADIUS (105), so a player standing at
// the bench can never be "at" both at once and get the wrong E action.
// (3 Sep 2026: position now owned by hubLayout.ts, imported above.)
const WORKSHOP_BENCH_RADIUS = 60;

// The Vault plinth, 2 Sep 2026 (Bloom_Wars_Vault_Build_Plan_v1.md §2) — same
// walk-up-and-press-E console shape as HANGAR_SHOP_POINT/WORKSHOP_BENCH_POINT
// above, third and last of this exact pattern, so this copies their own
// geometry rather than generalising it, same reasoning drawWorkshopBenchPoint
// already gives for its own copy-not-refactor call.
//
// ROOM_ZONE_BOUNDS.vault is `{ left: ZONE_SPLIT_X, right: ROOM_BOUNDS.right,
// top: ROOM_BOUNDS.top, bottom: ZONE_SPLIT_Y }` — textually IDENTICAL to
// ROOM_ZONE_BOUNDS.hangarDeck, which is fine and not a bug: vault (upper
// deck) and hangarDeck (lower deck) are different decks entirely (ROOM_DECK
// disagrees on both), so reusing the same local rectangle is just "the same
// quadrant shape, one floor up" — decks are never rendered at the same time.
// That means HANGAR_SHOP_POINT's own (690, 200) is already a proven-safe
// point in this exact quadrant shape (clear of every NPC/decor placement,
// no door in range — hangarDeck's own comment already notes it has no door
// of its own, and vault's zone has none either), so this reuses it exactly
// rather than picking a fresh point and re-deriving the same clearance
// checks HANGAR_SHOP_POINT already did.
// (3 Sep 2026: position now owned by hubLayout.ts, imported above.)
const VAULT_PLINTH_RADIUS = 60;

// The Archive console, 7 Sep 2026 (Maxime: "make the table in the cic the
// place to toggle it"). Same 60 every other walk-up console uses. Its room
// comes from the facility profile (archiveRoom) rather than a literal here,
// because Warden's stands in the CIC and the House's in Records.
const ARCHIVE_TABLE_RADIUS = 60;
// Rec Room Standings, 3 Sep 2026 — same walk-up radius as the Vault plinth.
// Verified against the real geometry rather than eyeballed: a body can
// stand 30-50px off the board on every approach without being resolved
// into a solid (see hubLayout.ts's RECROOM_BOARD_POINT comment).
const STANDINGS_BOARD_RADIUS = 60;

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

// DoorDef, the DOORS stair table, DECK_ORDER and nextHopDoor moved out with
// the facility split (6 Sep 2026): the type to engine/facility.ts, Warden's
// six stairs and four-deck line to engine/facilityWarden.ts (this.f.doors /
// this.f.deckOrder), nextHopDoor to a method below (it walks the facility's
// own deck order). The 28 Aug 2026 reasoning still holds and still lives
// with the data: the deck graph is a PATH, not a tree, so stepping one deck
// at a time toward the target and finding the door between the current
// deck and the next one is the whole algorithm.

// Hub polish, 26 Aug 2026 — see DOOR_LANDING_MAX_ATTEMPTS's own header for
// the measured collision odds this replaces a single draw with. Rejection
// sampling against every body already standing near the point in question —
// occupants is deliberately whoever's already there at the moment of the
// call, not a snapshot taken earlier, so a same-frame double-arrival (two
// NPCs completing a door hop on the identical update tick) still resolves
// correctly: whichever one's completeDoorHop runs second in that frame's
// loop sees the first one's real, just-placed position via this.npcs,
// since setNpcRoom updates it synchronously.
//
// Tier 1, 30 Aug 2026 — generalized from "pick a landing point on the far
// side of a door" (the original 26 Aug find, still exactly what
// pickDoorLanding below does) to "pick any point near a door," so the same
// proven jitter-and-reject logic can also place a body on the NEAR side —
// see pickDoorApproach below, and switchRoom's own use of this directly for
// the player. selfRadius is whichever body is about to stand at the result
// (NPC_R for an NPC, PLAYER_R for the player) so the collision check always
// matches the real radiusA+radiusB math this file uses everywhere else
// (tryMoveNpc, handleMovement) instead of assuming both sides are NPC_R.
// Tier 6 hotfix, 30 Aug 2026 — Maxime: "still cant move. from the cluster, I
// spawned on top of them when I changed room." pickPointNearDoor's original
// random-jitter-and-reject scheme (DOOR_LANDING_MAX_ATTEMPTS's own header)
// was measured and tuned against exactly ONE other nearby body — ~35.7%
// collide odds per try, "whenever two NPCs land at the same door close
// together" — which made 5 tries in a row all failing a sub-0.1% non-event
// by that math. Tier 3's roster growth (3 -> 15-20+ NPCs) plus the door-
// clustering roaming pulls means a door can now have several NPCs genuinely
// packed near it at once, not just one — collide odds against ANY of
// several nearby bodies climbs well past that original per-pair number, so
// "all 5 tries collide" stopped being a near-impossible fluke. When that
// happened, this used to just return the last (still-colliding) draw —
// landing the player, or an NPC, directly on top of someone, exactly what
// Maxime hit.
//
// pickClearPoint is the fix: same cheap random tries first (unchanged
// behavior for the common, uncrowded case this was always fine for), but
// escalates to a DETERMINISTIC outward ring search — fixed radii, evenly
// spaced angles at each — before giving up, so a crowded spot can't fail
// just because a handful of random draws happened to get unlucky. Every
// candidate is clamped to the deck floor before its collision check (not
// after, the way the old scheme's callers did it) so a point that reads as
// clear can't un-clear itself the moment it gets clamped back onto a wall.
// Only in a genuinely pathological case — occupants packed solid at every
// angle, at every radius tried — does it fall back to the least-bad point
// actually found, rather than a truly clear one; ordinary play, even at
// today's much bigger roster, should never reach that branch.
const CLEAR_POINT_RING_RADII = [
  DOOR_LANDING_JITTER_DIST * 2,
  DOOR_LANDING_JITTER_DIST * 3,
  DOOR_LANDING_JITTER_DIST * 4.5,
  DOOR_LANDING_JITTER_DIST * 7,
];
const CLEAR_POINT_RING_ANGLES = 10;

function pickClearPoint(
  deck: DeckId,
  center: { x: number; y: number },
  occupants: HubNpc[],
  selfRadius: number,
  jitterDist: number,
  maxRandomAttempts: number,
): { x: number; y: number } {
  const evaluate = (raw: { x: number; y: number }) => {
    const point = clampToDeckFloor(deck, raw.x, raw.y, selfRadius);
    const blocked = occupants.some((o) => Phaser.Math.Distance.Between(point.x, point.y, o.x, o.y) < selfRadius + NPC_R);
    return { point, blocked };
  };

  for (let attempt = 0; attempt < maxRandomAttempts; attempt++) {
    const { point, blocked } = evaluate(pointNear(center, jitterDist));
    if (!blocked) return point;
  }

  let fallback = clampToDeckFloor(deck, center.x, center.y, selfRadius);
  let fallbackClearance = -Infinity;
  for (const ringDist of CLEAR_POINT_RING_RADII) {
    for (let i = 0; i < CLEAR_POINT_RING_ANGLES; i++) {
      const angle = (i / CLEAR_POINT_RING_ANGLES) * Math.PI * 2;
      const { point, blocked } = evaluate({ x: center.x + Math.cos(angle) * ringDist, y: center.y + Math.sin(angle) * ringDist });
      if (!blocked) return point;
      const nearestOccupant = occupants.reduce(
        (min, o) => Math.min(min, Phaser.Math.Distance.Between(point.x, point.y, o.x, o.y)),
        Infinity,
      );
      if (nearestOccupant > fallbackClearance) {
        fallbackClearance = nearestOccupant;
        fallback = point;
      }
    }
  }
  return fallback; // least-bad point actually tried, never the untried original draw
}

function pickPointNearDoor(deck: DeckId, center: { x: number; y: number }, occupants: HubNpc[], selfRadius: number): { x: number; y: number } {
  return pickClearPoint(deck, center, occupants, selfRadius, DOOR_LANDING_JITTER_DIST, DOOR_LANDING_MAX_ATTEMPTS);
}

// pickDoorLanding / pickDoorApproach are methods now (they need the
// facility's room->deck table). Their history — the 26 Aug landing-jitter
// find and Tier 1's 30 Aug "NPC door-clustering blocking the player" fix
// that generalised it to the near side of a door — is on the methods.

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
// Comms log panel — Hub polish, 26 Aug 2026. Maxime: "put a chat window to
// the side so player can read what they hear if they haven't caught it yet
// in game." Docked in the right-hand gutter — the strip between
// ROOM_BOUNDS.right (830) and the canvas edge (main.ts's game config) is
// unused by anything else in this scene: every modal overlay
// (peg/poker/darts/history) draws its own background exactly
// ROOM_BOUNDS-wide, centered at x=480, never the full canvas — confirmed
// by reading each one before picking this spot, not assumed. That also
// means the log stays visible even while a minigame overlay is open,
// which is correct, not incidental: bystander chatter is still something
// you'd have heard.
//
// Tier 6 hotfix, 30 Aug 2026 — Maxime: "increase the size of the chat
// window. so player can read more of them. double it for now." This panel
// was already using every pixel of free space it had (full room height,
// out to the old canvas edge) — there was nowhere left to grow it without
// widening the game window itself, so main.ts's own width grew by exactly
// this panel's old width (114px), doubling this panel's own width to 228.
// See main.ts's own header for the other scenes that needed a matching fix
// so nothing shows a gap on the new strip of canvas.
//
// The OVERHEARD sidebar dock / UI camera split, Carrier Scale-Up Plan v1
// Phase 2, 3 Sep 2026 — Maxime noticed real map content (floor, walls,
// NPCs) scrolling underneath this panel and getting hidden behind its own
// opaque background once the Hub's world got a scrolling camera (Phase 1,
// 2 Sep 2026): this panel was sized and positioned for a small, screen-
// locked single room, back when ROOM_BOUNDS WAS the whole world — see that
// constant's own header. Once the floor grew into a real 1500+px-wide,
// camera-scrolled deck, nothing stopped the world from scrolling directly
// underneath this screen-fixed strip; the panel just happened to always be
// drawn on top, silently painting over whatever real, walkable content had
// scrolled into that same screen region. Fixed with the standard Phaser
// two-camera UI pattern: a second, static camera (`this.uiCamera`, created
// in create()) owns this screen region exclusively, and the main/world
// camera's own viewport is narrowed so it is PHYSICALLY INCAPABLE of
// drawing into it — not just usually covered by something opaque on top,
// which is what silently broke here once the world grew past this panel's
// old assumptions.
//
// DOCK_SPLIT_X is the screen x (canvas pixels) where that split happens —
// kept at the exact same value this panel's old left edge (CHAT_LOG_X) already
// used, so the dock's own footprint on screen doesn't move an inch, only
// which camera owns each side of that line changes:
//   - the main/world camera's own viewport becomes (0, 0, DOCK_SPLIT_X, 640)
//   - this.uiCamera's own viewport becomes (DOCK_SPLIT_X, 0, DOCK_WIDTH, 640)
// Every object inside the dock (this panel, the OVERHEARD label, the log
// text, its geometry mask, the T-activated chat input DOM element, and the
// corner MENU button — see this.uiCameraObjects) is now positioned in
// DOCK-LOCAL coordinates: x=0 is DOCK_SPLIT_X on screen, not the canvas's
// own x=0. See finalizeDockCameraSplit() (called once, at the very end of
// create()) for how each camera is told to ignore the other's half.
/**
 * Depth for the top-row HUD readouts drawn over the world (3 Sep 2026).
 *
 * WHY THIS EXISTS. Every one of the six pinned readouts along the top of
 * the Hub — the room title, the controls line, THREAT, Rourke's rank, the
 * campaign-day counter and the DECK indicator — was created at the default
 * depth 0 and then, later in the same create(), drawDeckLayout() drew the
 * deck floors at that same depth 0. Same depth means display-list order
 * decides, and the floors are added afterwards, so the floors won. Every
 * one of those six labels was INVISIBLE in the shipping game: created,
 * positioned, updated live, never once seen by a player.
 *
 * It was not always broken. It broke on 3 Sep, when the carrier scale-up
 * grew each deck's walkable floor to 1500x960 with a following camera.
 * Before that the floors were small enough to leave the top strip bare, so
 * depth never mattered. That pass correctly pinned every HUD element to the
 * screen with setScrollFactor(0) — which fixes WHERE a thing draws, and
 * says nothing about WHETHER anything draws on top of it. Position was
 * solved; z-order was not, and nothing failed to make it visible.
 *
 * Worth naming what this cost, because it is the argument for the check
 * that now guards it: `Day N` is the entire calendar economy's only
 * on-screen output, shipped 1 Sep and invisible from 2 Sep. The controls
 * line is the only place the game tells a new player how to move. Neither
 * a type error, a lint, nor any of the 1966 unit tests can see a label
 * that renders behind a floor — and `checkHubCameraScroll.mjs` had been
 * asserting these labels' screen POSITIONS this whole time, passing
 * cleanly, because a Text object's x/y is correct whether or not anything
 * ever painted it. tools/verify/auditUiText.mjs's PAINTED-OVER check is
 * the one that finds this: it hides a label, re-screenshots, and diffs the
 * pixels its own box covers.
 *
 * 20 sits above the world (depth 0) and well below every modal overlay
 * (60, with ShopPanel at 61), so an open Vault or Workshop still covers
 * the HUD exactly as it did before.
 */
const HUB_HUD_DEPTH = 20;

const DOCK_SPLIT_X = ROOM_BOUNDS.right + 8; // 838 — unchanged from the old CHAT_LOG_X
const DOCK_WIDTH = 1074 - DOCK_SPLIT_X; // 236 — the dock's own full screen width, canvas edge to canvas edge
const DOCK_HEIGHT = 640; // full canvas height — the UI camera is a static, full-height strip, not confined to old ROOM_BOUNDS.top/bottom
// This panel's own on-screen footprint within the dock, dock-local — same
// width this panel always used (flush against the dock's own left edge,
// 8px shy of the dock's own right edge), same height ROOM_BOUNDS.bottom -
// ROOM_BOUNDS.top always gave it, which keeps CHAT_LOG_VISIBLE_LINES' own
// hand-tuned wrapped-line estimate (see that constant's own header) valid
// without re-measuring it. Only the vertical START moved: up from the old
// ROOM_BOUNDS.top (108, back when this shared the same fixed row every
// modal overlay used) to DOCK_PANEL_TOP (48), the dock's own new full
// height leaving real room above it to clear the corner MENU button
// without needing that shared row at all.
const DOCK_LOG_WIDTH = DOCK_WIDTH - 8; // 228
const DOCK_LOG_CENTER_X = DOCK_LOG_WIDTH / 2; // 114
const DOCK_PANEL_TOP = 48;
const DOCK_PANEL_HEIGHT = ROOM_BOUNDS.bottom - ROOM_BOUNDS.top; // 444, unchanged
const DOCK_PANEL_BOTTOM = DOCK_PANEL_TOP + DOCK_PANEL_HEIGHT; // 492
const DOCK_PANEL_CENTER_Y = DOCK_PANEL_TOP + DOCK_PANEL_HEIGHT / 2; // 270
// The T-activated chat input DOM box, moved from its old spot (centered
// under the main play area, below ROOM_BOUNDS.bottom) to sit directly
// under this panel, inside the same dock strip — same "+44" clearance
// convention the old CHAT_BOX_Y used below ROOM_BOUNDS.bottom, just
// measured off this panel's own new bottom edge instead.
const DOCK_INPUT_Y = DOCK_PANEL_BOTTOM + 44; // 536
// The corner MENU button (see create()'s own addMenuOverlayButton call) —
// dock-local coordinates chosen so it lands at the exact same absolute
// screen pixel (900, 20) it always has; only which camera draws it changed,
// not where it visually sits. DOCK_SPLIT_X's own header above explains why
// it has to move cameras at all: at x=900 it sits past DOCK_SPLIT_X (838),
// so the narrowed main camera can no longer reach it.
const DOCK_MENU_X = 900 - DOCK_SPLIT_X; // 62
const DOCK_MENU_Y = 20;
// Memory bound only, not a display cap — see chatLog's own field comment.
const CHAT_LOG_MAX_STORED = 40;
// Display cap — how many of the most recent entries actually get rendered.
// Originally a real, hand-tuned placeholder picked by rendering real
// LINE_BANK-length lines into the actual panel and checking the result fit
// inside ROOM_BOUNDS's own height without overflowing (see Build Log
// Addendum for the specific check).
//
// Tier 6 hotfix, 30 Aug 2026 — doubled alongside CHAT_LOG_WIDTH above, per
// Maxime's own "double it for now." The doubled width roughly halves how
// much a typical line wraps (measured directly against a sample of real
// LINE_BANK-length lines via Playwright + canvas measureText, not
// eyeballed: the same 6 messages that used ~34 wrapped rows at the OLD
// 98px content width used only ~20 at the NEW 212px width), which is what
// actually makes room for more entries, not just a bigger box. Still an
// estimate, not a guarantee for every possible message-length combination
// — renderChatLog's own geometry mask (see buildChatLogPanel) is the real
// backstop: if a particular run of long lines ever would have overflowed
// this guess, it now clips cleanly at the panel's own edge instead of
// spilling text onto the game board.
const CHAT_LOG_VISIBLE_LINES = 12;

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
  // Widened Arc -> Shape, 12 Sep 2026 (shape-by-Path pass, see
  // TransporterPad.ts's PilotAvatar.hitCircle for the full reasoning) —
  // every combat pilot NPC below now gets PATH_SHAPES[path] instead of
  // always a circle; nothing here ever calls anything Arc-specific on
  // this field (only .setInteractive()/.disableInteractive(), the shared
  // Shape/GameObject API), so the widening changes nothing else.
  circle: Phaser.GameObjects.Shape;
  root: Phaser.GameObjects.Container;
  favLabel: Phaser.GameObjects.Text;
  bubbleContainer: Phaser.GameObjects.Container;
  bubbleUntil: number;
  // NPC Conversation Lock Fix, 6 Sep 2026 — see NPC_ENGAGEMENT_HOLD_MS's
  // own header comment for the full root cause. Set the instant any of
  // runNpcEncounter/runAngerBlowup/runBoredomSpar starts an exchange
  // between this NPC and a partner, covering the partner's still-to-come
  // reply bubble too, not just this NPC's own already-showing one.
  // Checked via isNpcEngaged() at the very top of updateNpcRoaming (before
  // even the journey-resume branch, same reason mustered has to run
  // before journey-resume too — an engaged NPC should hold through a
  // paused multi-hop journey exactly the way it holds through ordinary
  // idle roaming) and in both of updateNpcEncounters' own pairing guards.
  // undefined = not currently in a staged exchange, the overwhelming
  // majority of the time, same "undefined clock = opts out" convention
  // nextRoamAt/nextEncounterAt/nextBlowupAt already use.
  engagedUntil?: number;
  targetX?: number; // set = walking toward this point (piece #2); undefined = idle in place
  // 3 Sep 2026, floor-plan pass — the waypoints (engine/hubNav.ts) this NPC
  // is following toward targetX/targetY, computed lazily the first frame a
  // target is set and dropped the moment it's cleared or changed. Empty
  // array = straight line is clear, walk directly. undefined = not
  // computed yet for the current target. Every one of the ~10 sites that
  // set targetX stays untouched: updateNpcMovement notices the target
  // changed (pathTarget) and re-paths on its own.
  path?: { x: number; y: number }[];
  pathTarget?: { x: number; y: number };
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
  // Added 9 Sep 2026 for the new pairwise Hiopi-exclusivity rule
  // (speciesCompatibleForRomance, data/romance.ts) — engine/socialSim.ts's
  // SocialSimPilot needs a real species per pilot now, and this is the one
  // place every one of buildNpcs()'s four push sites (the main pilot loop,
  // the CO, and both Mek loops) already independently derives a species to
  // feed isRomanceableSpecies(); this just keeps that same value around on
  // the HubNpc itself instead of throwing it away, same as romanceable's
  // own derivation one line up.
  species: Species;
  inRelationship?: boolean;
  // Phase 3 piece three, 26 Aug 2026 — autonomous roaming's own decision
  // clock (npcBonds.ts). Undefined until buildNpcs seeds a first,
  // staggered value; updateNpcRoaming reads/rewrites it each tick.
  nextRoamAt?: number;
  // 26 Aug 2026 — updateNpcEncounters' own cooldown clock, same staggered-
  // seed/reread-each-tick shape as nextRoamAt above but pairwise in effect
  // (both participants get a fresh one after an encounter fires).
  nextEncounterAt?: number;
  // Anger Blowup, 28 Aug 2026 (Groups 3-5 batch rebuild) — its own,
  // separate cooldown clock, checked alongside (not instead of)
  // nextEncounterAt inside updateNpcEncounters. Kept apart from
  // nextEncounterAt on purpose: an ordinary encounter's own cooldown is
  // deliberately short (12-22s), and a blowup shouldn't be able to repeat
  // on that same short clock the instant it's next eligible again — see
  // ANGER_BLOWUP_COOLDOWN_MIN_MS/MAX_MS's own comment.
  nextBlowupAt?: number;
  // Worry with real texture, first slice, 27 Aug 2026 — same staggered
  // per-NPC recheck clock shape as nextEncounterAt above, but for
  // updateMissionWorry()'s own probabilistic reroll. Not persisted, same
  // as ambient.worried itself.
  nextWorryCheckAt?: number;
  // Worries System step 2, 6 Sep 2026 (data/worries.ts's own header has the
  // full design). This pilot's general "what's on my mind" stack —
  // undefined means empty, same "undefined = opts out" convention as every
  // other ephemeral clock/state field on this type. Refreshed on the same
  // nextWorryCheckAt cadence just above, by the same updateMissionWorry()
  // call, since Mission Worry is currently this list's only real source.
  // Not persisted, same as ambient.worried and ambient.topWorry themselves.
  worries?: WorryEntry[];
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
  // Mek Workshop confinement, 30 Aug 2026 (Maxime: "mek need to stay in the
  // workshop unless they are sleeping or eating"). Undefined for every
  // ordinary roaming NPC — the ship-wide explore/mingle behaviour above is
  // completely unaffected by this field existing. Set to "workshop" for
  // every Mek (buildNpcs' mekSeeds and generic-Mek loops) — updateNpcRoaming
  // reads it to skip the normal uniform-random pickExploreTarget entirely
  // for a confined NPC and instead only ever sends them to whichever real
  // need room (NEED_ROOM — Rec Room for hunger/thirst, Berths for sleep)
  // is currently worst, or straight back here once that need clears. This
  // is also the actual fix for a real inconsistency the generic-Mek loop's
  // own comment already claimed ("they don't otherwise roam the whole ship
  // on their own errands") without the code backing it up — every Mek had
  // nextRoamAt set exactly like any deployable pilot and could wander to
  // any of the ship's other five rooms before this field existed to stop
  // it.
  homeRoom?: RoomId;
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
  // Boredom, 30 Aug 2026 (Maxime: "boredom should trigger spar" — see this
  // file's own Rec Room table/updateNpcRoaming comments for the full
  // "table + spar" pass). Same shape and same tickNeed()/clampNeed()
  // machinery as hunger/thirst/sleep above (needsCounter.ts), added as a
  // fourth NeedKind there rather than a separate bespoke meter — but its
  // restore condition is deliberately NOT a room the way the other three
  // are (Berths for sleep, Rec Room for hunger/thirst): boredom is relieved
  // by actually being in an active encounter bubble (updateNpcEncounters'
  // own bubbleUntil), wherever that happens to be, not by standing in any
  // particular room. See its own tick call site (updateNpcNeeds) for the
  // exact condition, and NEED_ROOM.boredom (needsCounter.ts) — "sparRoom"
  // — for where a bored, idle pilot gets biased to roam toward once it's
  // their worst need.
  boredom: number;
  // Same staggered-real-minute-cooldown shape as nextRoamAt/nextEncounterAt
  // above. Deliberately left undefined for the CO (see his own push() call
  // below) — same "undefined clock = this NPC opts out" convention those
  // two already use: the needs counter is about a deployable pilot's
  // off-duty life, not the CO's.
  nextNeedsTickAt?: number;
  // Breakdown, 28 Aug 2026 (Groups 3-5 batch rebuild) — see
  // data/breakdown.ts's own header. Ephemeral, not persisted, same
  // deliberate choice Mission Worry already made (WORRY_ONSET_MS's own
  // comment) — a breakdown mid-crisis on save-out just isn't there anymore
  // on reload, rather than needing a whole new persisted-state shape for
  // an in-progress event. true from the moment updateBreakdownTrigger
  // fires one until updateBreakdownResolution resolves it; while true,
  // updateBreakdownTrigger skips this NPC outright (mirrors HubNpc.mustered's
  // own "one system owns you while this is true" shape).
  breakdown?: boolean;
  // this.time.now at onset — compared against BREAKDOWN_SLEEP_TIMEOUT_MS
  // by updateBreakdownResolution's own "sleep" fallback. undefined
  // whenever breakdown is falsy.
  breakdownSince?: number;
  // Same staggered-cooldown shape as nextRoamAt/nextEncounterAt/
  // nextBlowupAt above — how often updateBreakdownTrigger rerolls
  // eligibility for an NPC who isn't currently mid-breakdown. Also
  // doubles as the post-resolution cooldown (see
  // BREAKDOWN_RESOLUTION_COOLDOWN_MIN/MAX_MS's own comment) — resolveBreakdown
  // sets this to a 90-180s value on the way out rather than the ordinary
  // 15s recheck, same field, just a longer wait after a real event.
  nextBreakdownCheckAt?: number;
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
  // Hub Hints & Orientation, 11 Sep 2026 — the one on-screen banner slot
  // showHubHint() (below, near openWorkshop) reuses for whichever of the 6
  // one-shot hints just fired; destroyed and replaced (never stacked) if a
  // second one fires while the first is still showing, and auto-clears
  // itself a few seconds after showing either way. See showHubHint()'s own
  // header comment for the full design reasoning.
  private hubHintBanner: Phaser.GameObjects.Container | null = null;
  // Cursor tip, 2 Sep 2026 — see scenes/ui/HoverTip.ts. Nullable rather
  // than definite-assigned because updateHoverTip() is reachable from the
  // update() loop, which can tick before create() finishes on a scene
  // restart (the same first-tick hazard buildNpcs' own comment describes).
  private hoverTip: HoverTip | null = null;
  // Tooltip Coverage Standing Rule, 12 Sep 2026
  // (Bloom_Wars_Tooltip_Coverage_Standing_Rule_And_Checklist_v1_11Sep2026.md)
  // — true while the pointer is over a raw interactive element wired
  // through wireHoverTip() below, whether that's inside an open overlay
  // (Workshop/Vault/Rec Room) or the always-visible footer BACK button.
  // Both cases fight the scene-wide pointermove handler's own
  // updateHoverTip(), which either hides the tip (an overlay is open) or
  // overwrites it with room/NPC content (hubHoverLines()) on every single
  // pointer move — this flag is what lets a wired element's own
  // pointerover/pointerout claim the tip instead, the same "two hover
  // systems, one arbitration flag" shape Battle.ts's own hoveredActionSlot
  // already uses for its tile-hover conflict. See updateHoverTip() and
  // wireHoverTip() for the actual mechanism.
  private overlayHoverActive = false;
  private pointerX = 0;
  private pointerY = 0;
  // Carrier Scale-Up Plan v1, Phase 1, 2 Sep 2026 — pointerX/Y above are raw
  // screen/canvas coordinates (Phaser.Input.Pointer.x/y), which is exactly
  // what HoverTip.show() needs (it positions a box on screen, next to the
  // cursor). But hoveredNpc() and hubHoverLines() compare the pointer
  // against NPC/room positions, which live in WORLD space — the two were
  // silently the same numbers as long as the camera never moved, which is
  // exactly what stops being true the moment startFollow (below) starts
  // panning the camera per deck. These are that: the pointer's own worldX/
  // worldY, captured alongside pointerX/Y in the same pointermove handler,
  // for every comparison that isn't "where does the tip box render."
  private pointerWorldX = 0;
  private pointerWorldY = 0;
  private eKey?: Phaser.Input.Keyboard.Key;
  private mKey?: Phaser.Input.Keyboard.Key; // debug: test muster-call propagation (Build Plan §9 piece #1)
  // 27 Aug 2026 — tracks whether the debug M key's own muster is currently
  // "in effect," so a second press means cancel rather than calling a
  // second muster on top of the first. Deliberately scoped to just this
  // debug binding, not to musters in general (a real chat-triggered muster
  // has no cancel UI yet either) — see callMuster/endMuster's own headers.
  private musterActive = false;
  private rKey?: Phaser.Input.Keyboard.Key; // debug: test rumor propagation (Build Plan §9 piece #1)
  private tKey?: Phaser.Input.Keyboard.Key;
  // History / Highlights direct keys, 2 Sep 2026 — see update()'s own
  // comment. Player-facing, so not dev-gated the way mKey/rKey are.
  private hKey?: Phaser.Input.Keyboard.Key;
  private lKey?: Phaser.Input.Keyboard.Key; // piece #3: open the real typed-chat box
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
  // Rec Room Standings, slice 4 — a standalone class rather than another
  // overlay method on this already-8,000-line file. See StandingsPanel's
  // own header, and scenes/shop/ShopPanel.ts for the same precedent.
  private standingsPanel!: StandingsPanel;
  private standingsOpen = false;
  // Codex Rebuild & Live Briefing Plan v1, Part B, 4 Sep 2026 — same
  // standalone-panel-owned-by-Hub shape as standingsPanel just above.
  private missionBriefingPanel!: MissionBriefingPanel;
  private missionBriefingOpen = false;
  // B3, the memorial, 5 Sep 2026 — same standalone-panel shape again. Opened
  // from a button inside the Vault, and drawn ON TOP of it (depth 61 vs 60)
  // rather than replacing it, so closing the roll puts the player back in
  // the Vault they opened it from. See MemorialPanel's own header for why
  // this isn't a section inside the Vault, which is where it was built
  // first: that panel has two pixels of vertical headroom and no scrolling.
  private memorialPanel!: MemorialPanel;
  private memorialOpen = false;
  // B2, 5 Sep 2026 — the Hangar Deck's crew-records panel. Same
  // standalone-panel-owned-by-Hub shape as the three above it.
  private rosterPanel!: RosterPanel;
  private rosterOpen = false;
  private bKey?: Phaser.Input.Keyboard.Key;
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

  // Hangar Deck roster/stats panel — Tier 4, 30 Aug 2026. Same
  // open/close-flag shape as historyOpen/highlightsOpen above (owns input
  // entirely while open, escKey closes it — see the main update() switch)
  // but the content itself is a live ShopPanel instance, not a static text
  // block: hangarShop.render() is called fresh every time this opens so it
  // always reflects the current CampaignState, not a snapshot from scene
  // start. hangarShopOverlay is only the title/close-button chrome around
  // it — ShopPanel owns and clears its own two internal containers on
  // every render(), so it doesn't need to live inside this scene's overlay
  // container to be shown/hidden correctly, only to be title/close-button-
  // framed the same way the other overlays are.
  private hangarShopOpen = false;
  // The Workshop bench panel, 2 Sep 2026 — see buildWorkshopOverlay.
  // UI Prettiness Pass v1, 10 Sep 2026 — workshopOverlay/workshopRows
  // (hand-built container + a manually tracked rebuilt-row array) are now
  // one shared ui/Panel.ts instance, which owns both the chrome those two
  // fields used to split between them AND the clear-and-rebuild bookkeeping
  // workshopRows existed only to do by hand — see Panel.clearContent()/
  // add(). Same reasoning applies to the Vault fields just below.
  private workshopOpen = false;
  private workshopPanel!: Panel;
  private workshopBenchOutline?: Phaser.GameObjects.Graphics;
  private workshopBenchLabel?: Phaser.GameObjects.Text;
  // The Vault plinth, 2 Sep 2026 — see buildVaultOverlay.
  private vaultOpen = false;
  private vaultPanel!: Panel;
  // Vault scroll fix, 6 Sep 2026 (Maxime, screenshot: the Vault's own content
  // stack — dedication + House Offers + Holdings & the Shelf — outgrows
  // ROOM_BOUNDS the moment you've recruited a couple of Heirlooms, and
  // renderVault's own header comment already admitted the panel "neither
  // clips nor scrolls." Same mask+scroll idiom MapSelect.ts's mission list
  // already uses (see that file's own header comment): a nested container
  // holds every rebuilt row, a GeometryMask clips it to the panel body, and
  // a mouse-wheel handler offsets it, clamped so it can't scroll past its
  // own content in either direction. 10 Sep 2026: that container, mask, and
  // clamp now live inside vaultPanel itself (Panel's own `scrollable`
  // option) — see buildVaultOverlay and the wheel handler at the bottom of
  // it — rather than as three separate hand-maintained fields here.
  private standingsBoardOutline?: Phaser.GameObjects.Graphics;
  private standingsBoardLabel?: Phaser.GameObjects.Text;
  private archiveTableOutline?: Phaser.GameObjects.Graphics;
  private archiveTableLabel?: Phaser.GameObjects.Text;
  private vaultPlinthOutline?: Phaser.GameObjects.Graphics;
  private vaultPlinthLabel?: Phaser.GameObjects.Text;
  private hangarShopOverlay!: Phaser.GameObjects.Container;
  private hangarShop!: ShopPanel;
  private hangarShopOutline!: Phaser.GameObjects.Graphics;
  private hangarShopLabel!: Phaser.GameObjects.Text;
  // Crew Records had a working console (isAtCrewRecords/openRosterPanel)
  // with no floor marker and no interact-prompt line of its own — every
  // OTHER console in this room (Roster & Gear, Workshop, Vault, Archive)
  // gets both. Caught 11 Sep 2026 going looking for why Maxime couldn't
  // find the lance-reassignment feature he'd already asked for and gotten
  // (RosterPanel.ts, 9 Sep): the feature worked, it was just invisible on
  // screen. See drawCrewRecordsPoint below.
  private crewRecordsOutline!: Phaser.GameObjects.Graphics;
  private crewRecordsLabel!: Phaser.GameObjects.Text;

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
  // The Rec Room table, 30 Aug 2026 (Maxime: "ther eshould be a table in
  // the rec room they can go around") — same dashed-marker shape as
  // bayOutline/bayLabel just above, at RECROOM_TABLE instead of
  // MUSTER_POINT. See drawRecroomTable's own comment for the full account.
  private recroomTableOutline!: Phaser.GameObjects.Graphics;
  private recroomTableLabel!: Phaser.GameObjects.Text;
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
  // Calendar economy, 2 Sep 2026 — the "Day 52" HUD readout. Repainted only
  // on an actual day rollover (tickCalendar returns true on that one frame),
  // not every frame: at 6 real minutes per day that's one setText call every
  // ~21,600 frames instead of 60 a second.
  private calendarDayText!: Phaser.GameObjects.Text;
  // Calendar economy, 2 Sep 2026 — `Date.now()` at the previous calendar
  // tick. 0 means "no previous frame to diff against yet". See
  // calendarClock.ts's measureRealDelta for why this exists rather than
  // trusting Phaser's own smoothed delta.
  private lastCalendarTickAt = 0;
  // The egg hull, 27 Aug 2026 — drawRoom()'s single shared rectangle used
  // to be the background for every deck, always visible, never toggled
  // (nothing about it ever differed between rooms before this pass). Now
  // every deck draws its own floor at its own size/shape, and exactly one
  // of these three is visible at a time — see refreshRoomVisibility.
  // 3 Sep 2026, floor-plan pass — each of those per-deck floors is now a
  // whole Container (floor plating, room tints, walls, doorframes,
  // furniture, room name labels) drawn from engine/hubLayout.ts by
  // drawDeckLayout(), still exactly one visible at a time.
  // 6 Sep 2026, facility split — keyed by DeckId instead of four named
  // fields, so a facility with different decks needs no new fields here.
  private deckFloors: Partial<Record<DeckId, Phaser.GameObjects.Container>> = {};
  // The egg hull, second pass, 27 Aug 2026 — one marker per RESERVED_BAYS
  // entry, same "built once, toggled by deck" pattern as doorMarkers above.
  private reservedBayMarkers: { def: ReservedBayDef; outline: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text }[] = [];

  // The OVERHEARD/chat UI-camera dock, Carrier Scale-Up Plan v1 Phase 2, 3
  // Sep 2026 — see DOCK_SPLIT_X's own header for the full mechanism. A
  // second, static camera that owns the dock strip exclusively; the main
  // camera's own viewport is narrowed in create() so it can never draw
  // there. uiCameraObjects tracks every game object meant to render
  // EXCLUSIVELY through this camera (the OVERHEARD panel, its label, its
  // log text, the corner MENU button, and the T-activated chat input DOM
  // element — DOM Elements use this exact same cameraFilter/ignore
  // mechanism for which camera's transform positions them, see
  // buildChatBox's own comment for why that matters here) — appended to as
  // each is built, then consumed once by finalizeDockCameraSplit() at the
  // very end of create() to set up both cameras' ignore-lists in one pass.
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;
  private uiCameraObjects: Phaser.GameObjects.GameObject[] = [];

  // Which building this scene instance is — see the FacilityProfile import
  // comment at the top of the file. `f` is the total-typed view Hub.ts
  // reads (engine/facility.ts's buildFacilityTables): `this.f.roomDeck(r)`
  // where the module-level `this.f.roomDeck(r)` used to be, and so on. Readonly
  // and set once in the constructor: Phaser constructs every registered
  // scene at boot, so two Hub instances (Warden's and House Amaranth's)
  // exist side by side from the first frame, each with its own profile —
  // a module-level "current facility" would have been whichever one was
  // constructed last, which is why this is an instance field.
  private readonly f: FacilityTables;

  // Default to Warden so `scene: [..., Hub, ...]` (a bare class reference,
  // which Phaser instantiates with no arguments) still means the Antfarm —
  // main.ts registers House Amaranth's as an explicit instance,
  // `new Hub(HOUSE_AMARANTH_FACILITY)`.
  constructor(facility: FacilityProfile = WARDEN_FACILITY) {
    super(facility.sceneKey);
    this.f = buildFacilityTables(facility);
  }

  // The seven helpers below used to be module-level functions reading
  // Warden's module-level tables; they read this.f now. Their own headers
  // (moved with them) are unchanged in substance.

  // Weighted-bag pick of a roam destination: the NPC's own lance's berths
  // BERTHS_EXPLORE_WEIGHT times, everyone else once, plus
  // NEEDS_ROAM_WEIGHT_BONUS more for `biasRoom` if one's passed. A plain
  // weighted-bag approach rather than a probability table: cheap, obviously
  // correct, and consistent with how small this room count is. 3 Sep 2026
  // — candidates are the roamable rooms (corridors excluded), and with one
  // berth room per lance the BERTHS_EXPLORE_WEIGHT bump goes to the NPC's
  // OWN lance's berths (`homeBerths`); the other lances' bunks stay at the
  // baseline 1 — you drift toward your own quarters, not any bunk room.
  private pickExploreTarget(fromRoom: RoomId, biasRoom?: RoomId, homeBerths?: RoomId): RoomId {
    const otherRooms = this.f.roamableRooms.filter((r) => r !== fromRoom);
    const weighted: RoomId[] = [];
    for (const r of otherRooms) {
      let weight = r === homeBerths ? BERTHS_EXPLORE_WEIGHT : 1;
      if (r === biasRoom) weight += NEEDS_ROAM_WEIGHT_BONUS;
      for (let i = 0; i < weight; i++) weighted.push(r);
    }
    return weighted[Math.floor(Math.random() * weighted.length)];
  }

  private berthRoomFor(lance: LanceId): RoomId {
    return this.f.berthRoomFor(lance);
  }

  private workshopRoomFor(lance: LanceId): RoomId {
    return this.f.workshopRoomFor(lance);
  }

  private sameDeck(a: RoomId, b: RoomId): boolean {
    return this.f.roomDeck(a) === this.f.roomDeck(b);
  }

  // 26 Aug 2026, Build Plan §24 — cross-room NPC wandering's own routing.
  // Only ever fires for a genuinely cross-deck trip; two same-deck rooms
  // need no door at all (open floor — the caller just walks there). Walks
  // the facility's deck order generically (28 Aug 2026 rewrite): step one
  // deck at a time toward the target, find the door connecting the current
  // deck to that next one. Never more than three hops for a trip that spans
  // the whole line end to end.
  private nextHopDoor(fromRoom: RoomId, toRoom: RoomId): DoorDef | undefined {
    const fromDeck = this.f.roomDeck(fromRoom);
    const toDeck = this.f.roomDeck(toRoom);
    if (fromDeck === toDeck) return undefined; // same deck — open floor, no door to hop through
    const order = this.f.deckOrder;
    const fromIndex = order.indexOf(fromDeck);
    const toIndex = order.indexOf(toDeck);
    const step = toIndex > fromIndex ? 1 : -1;
    const nextDeck = order[fromIndex + step];
    return this.f.doors.find((d) => this.f.roomDeck(d.room) === fromDeck && this.f.roomDeck(d.toRoom) === nextDeck);
  }

  // Hub polish, 26 Aug 2026 — a landing point on the FAR side of a door,
  // jittered and rejection-sampled against whoever's already standing
  // there (pickPointNearDoor's own header), so a same-frame double-arrival
  // never stacks two bodies on one pixel.
  private pickDoorLanding(door: DoorDef, occupants: HubNpc[]): { x: number; y: number } {
    return pickPointNearDoor(this.f.roomDeck(door.toRoom), { x: door.toX, y: door.toY }, occupants, NPC_R);
  }

  // Tier 1, 30 Aug 2026 (Consolidated Build Plan, Tier 1 item #1 — "NPC
  // door-clustering blocking the player"). The NEAR side of a door hop —
  // where an NPC walks to before disappearing to the other room — used to
  // be every walker's literal, identical (door.x, door.y) with no jitter at
  // all; several NPCs converging on a shared door packed into a tight ring
  // right around the single point the player's own isAtDoor() has to reach.
  // Spreading approaches out the same way landings already are removes the
  // single shared point entirely, so there's nothing left to pack around.
  private pickDoorApproach(door: DoorDef, occupants: HubNpc[]): { x: number; y: number } {
    return pickPointNearDoor(this.f.roomDeck(door.room), { x: door.x, y: door.y }, occupants, NPC_R);
  }

  create() {
    // Same load idiom every other scene already uses (Battle/Boot/Debrief/
    // Hangar/TransporterPad) — see the file header's 26 Aug 2026
    // correction. Must happen before buildNpcs() below.
    this.campaignState = loadCampaignState() ?? this.f.profile.createCampaignState();
    // Must happen before buildNpcs() too — buildNpcs doesn't read this
    // directly, but updateNpcRoaming/updateNpcEncounters both do, starting
    // the very first update() tick after create() finishes.
    this.npcSocial = ensureNpcSocialState(this.campaignState, this.f.profile.bondSeed);

    this.cameras.main.setBackgroundColor("#0c0f12");

    // Audio, "enough for EA" scope (A6, 9 Sep 2026) — the Hub's own ambient
    // loop. Stopped on this scene's own SHUTDOWN, same event Battle.ts's
    // flushCalendarTime() hooks below already uses elsewhere in this file's
    // sibling scene, so leaving the Hub for any other scene silences it;
    // coming back re-runs create() and restarts the loop from 0 — see
    // AudioManager.ts's own header for why that's an accepted placeholder-
    // era simplification rather than a bug.
    playAmbient(this, "hub");
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => stopAmbient());

    // OVERHEARD/chat UI-camera dock, Carrier Scale-Up Plan v1 Phase 2, 3
    // Sep 2026 — see DOCK_SPLIT_X's own header (this file, above) for the
    // full mechanism and why this became necessary. Set up before anything
    // else in create() so nothing built below can accidentally rely on the
    // main camera's default full-canvas viewport for even one frame.
    //
    // Narrowing the main/world camera's own viewport is the actual fix:
    // Phaser clips a camera's rendering to its own viewport rectangle no
    // matter what's inside it or how far the world scrolls underneath, so
    // this makes it PHYSICALLY IMPOSSIBLE for any world content (floor,
    // walls, NPCs, the player) to ever be drawn into the dock strip again,
    // on any deck, regardless of scroll position — not just usually
    // covered by something opaque on top of it, which is what silently
    // broke here once the world outgrew that assumption (see this scene's
    // own build-log addendum for the regression this fixes).
    this.cameras.main.setViewport(0, 0, DOCK_SPLIT_X, DOCK_HEIGHT);
    // this.cameras.add(x, y, width, height) — a second camera, added (not
    // replacing main), viewing the exact strip the narrowed main camera can
    // no longer reach. makeMain:false (the 4th positional arg after
    // width/height in Phaser's own signature — see CameraManager#add) keeps
    // this.cameras.main pointing at the original camera, not this one.
    this.uiCamera = this.cameras.add(DOCK_SPLIT_X, 0, DOCK_WIDTH, DOCK_HEIGHT, false, "hubDock");
    // No .startFollow(), no scroll — "static" is the entire point: this
    // camera shows the dock's own screen-fixed content in dock-local
    // coordinates (x=0 here IS screen x=DOCK_SPLIT_X) regardless of
    // wherever the main camera's own follow target has scrolled to.
    this.uiCamera.setBackgroundColor("#0c0f12");
    // Player/HUD-only overlays (MenuOverlay's pause backdrop, etc.) still
    // need to darken this camera's own viewport too when they're open —
    // handled generically in MenuOverlay.ts's own showMenuOverlay, not
    // here; nothing about this camera's own setup needs to know about
    // those overlays.

    this.roomTitleText = this.add
      .text(480, 20, `${this.f.profile.displayName} — ${this.f.roomTitle(this.currentRoomId)}`, { fontFamily: "monospace", fontSize: "16px", color: TEXT_MAIN })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(HUB_HUD_DEPTH);
    // wordWrap added this pass — caught in Playwright verification, not by
    // eye: this line measured 1232px wide (checked via the Text object's
    // own .width) against a 960px-wide canvas, overflowing ~136px off
    // BOTH edges. Predates the Antfarm rewrite (piece #4's "door or"
    // wasn't the sole cause — the line was already close to the edge
    // before this pass added "a door or " to it), but nobody had caught it
    // because a screenshot alone doesn't tell you the text is clipped
    // versus just tight. A straightforward render bug, not a wording or
    // layout decision, so fixed directly rather than flagged.
    //
    // OVERHEARD dock / UI-camera split, 3 Sep 2026 — narrowed again, from
    // 900 to 700. This text sat centered at x=480 using the FULL old
    // 1074-wide canvas as its safe margin (900/2=450 either side, reaching
    // x=30..930) — harmless back when the single camera spanning that
    // whole canvas drew it. Now that the main/world camera's own viewport
    // stops at DOCK_SPLIT_X (838, see that constant's own header), a
    // 900-wide wrap could still center a line whose own right edge reaches
    // x=930, past where that camera can draw at all — caught the same way
    // the original bug was, in a live Playwright screenshot, not by eye:
    // the wrapped second line was visibly clipped mid-word at the dock
    // split. 700 keeps every line's own worst-case edge (480±350 = 130..830)
    // safely inside the narrowed viewport with an 8px margin to spare,
    // matching the same clearance DOCK_SPLIT_X itself already uses.
    this.add
      .text(
        480,
        44,
        // 2 Sep 2026 — H/L appended as part of the keybinding pass. Kept to
        // one added clause rather than rewriting the line: this text is
        // already at the width that clipped once (see the comment above),
        // so it earns its space by naming the two panels that had no way
        // in except typing at the chat box.
        "WASD / arrows to move — E or click room to talk, click an NPC to provoke. Walk to a door or the BAY and press E. T = type something real. H = history, L = highlights.",
        {
          fontFamily: "monospace",
          fontSize: "11px",
          color: TEXT_DIM,
          align: "center",
          wordWrap: { width: 700 },
        }
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(HUB_HUD_DEPTH);

    // Locked in Build Plan §4: "shipping it with zero signal... would read
    // as a rug-pull later." Cosmetic/inert here, on purpose — Phase 4 is
    // where a hub-goes-hot system actually reads this.
    this.add
      .text(818, 20, "THREAT: DISTANT", { fontFamily: "monospace", fontSize: "10px", color: "#6b7d8a" })
      .setOrigin(1, 0.5)
      .setScrollFactor(0)
      .setDepth(HUB_HUD_DEPTH);

    // Shared MENU corner control (Main Menu / Save / Ironman UI Plan v1
    // §2) — clear of THREAT's own right edge (818) with room to the canvas
    // edge (960) either side. DOCK_MENU_X/Y (dock-local) rather than the
    // absolute screen (900, 20) this always visually sat at: that absolute
    // x is past DOCK_SPLIT_X (838), so the narrowed main camera above can
    // no longer reach it — see DOCK_MENU_X's own header. Registered into
    // uiCameraObjects so finalizeDockCameraSplit() (end of create()) routes
    // it through this.uiCamera exclusively, landing it right back at that
    // same screen pixel.
    this.uiCameraObjects.push(addMenuOverlayButton(this, DOCK_MENU_X, DOCK_MENU_Y, 100, 22, () => this.campaignState));

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
    // 6 Sep 2026, facility split — the label itself is the profile's
    // (facilityWarden.ts's rourkeHeaderLabel is the exact code that used to
    // sit here; House Amaranth's is static until Marrow has a rank field).
    this.add
      .text(16, 20, this.f.profile.mc.headerLabel(this.campaignState), {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#6b7d8a",
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(HUB_HUD_DEPTH);

    // Calendar economy, 2 Sep 2026 — the campaign-day readout, sharing the
    // top HUD row with the rank line (left, x=16) and THREAT (right-aligned
    // at x=818). Right-aligned at x=700 puts it clear of both: "THREAT:
    // DISTANT" at 10px monospace is ~90px wide, so its own left edge sits
    // near x=728, leaving real gap rather than a near-miss. Deliberately NOT
    // tucked under the rank line at y=36 — the wide centered instructions
    // text at y=44 wraps to 900px and would clip it, the same collision the
    // deckIndicatorText comment just below already documents hitting.
    this.calendarDayText = this.add
      .text(700, 20, formatDayLabel(this.campaignState), {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#6b7d8a",
      })
      .setOrigin(1, 0.5)
      .setScrollFactor(0)
      .setDepth(HUB_HUD_DEPTH);

    // Antfarm Grid v0, 27 Aug 2026 — set once here, kept live by
    // refreshRoomVisibility below every time the deck actually changes.
    //
    // Moved from (16, 80) to (190, 20), 3 Sep 2026. The original comment
    // here explained that y=80 was chosen to duck under the wide centered
    // instructions block at y=44 — sound reasoning, and it stayed sound
    // right up until this row stopped being empty. y=80 is now on top of
    // the grotto's own room label ("▲ THE GROTTO"), which only became
    // visible-and-colliding once these readouts were raised above the deck
    // floors (see HUB_HUD_DEPTH). Sharing the top row with the rank line
    // instead: that line ends at x≈173 and the centered room title starts
    // at x≈374, so x=190 sits in real clear space between them rather than
    // in a gap that happens to be empty today. Verified by measurement,
    // not by eye — tools/verify/auditUiText.mjs's COLLIDE check is what
    // caught the grotto overlap in the first place.
    this.deckIndicatorText = this.add
      .text(190, 20, "", { fontFamily: "monospace", fontSize: "10px", color: "#6b7d8a" })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(HUB_HUD_DEPTH);

    // One container per deck this facility has (6 Sep 2026 — was four named
    // fields, lowerFloor/upperFloor/sparRoomFloor/grottoFloor).
    for (const deck of this.f.deckOrder) this.deckFloors[deck] = this.drawDeckLayout(deck);
    this.drawMusterPoint();
    this.drawRecroomTable();
    this.drawHangarShopPoint();
    this.drawCrewRecordsPoint();
    this.drawWorkshopBenchPoint();
    this.drawVaultPlinthPoint();
    this.drawArchiveTablePoint();
    this.drawStandingsBoardPoint();
    this.buildDoors();
    this.buildZoneDecor();
    this.buildReservedBays();
    // Carrier Scale-Up Plan v1, Phase 1, 2 Sep 2026 — deliberately NOT
    // given .setScrollFactor(0) in this pass's otherwise-blanket audit.
    // refreshRoomVisibility repositions this every room change to
    // ((zone.left+right)/2, (zone.top+bottom)/2) — a real WORLD-space
    // point, the physical center of that room's own floor — not a fixed
    // HUD line like the ones above it. Pinning it to the screen would
    // detach it from the room it's supposed to be labeling the moment the
    // camera scrolls away from wherever it happened to be when the text
    // was last positioned.
    this.roomNoteText = this.add.text(480, 330, "", { fontFamily: "monospace", fontSize: "12px", color: TEXT_DIM, align: "center", wordWrap: { width: 460 } }).setOrigin(0.5);
    this.buildNpcs();
    this.buildPlayer();
    this.refreshRoomVisibility();

    // Carrier Scale-Up Plan v1, Phase 1, 2 Sep 2026 — the actual camera
    // scroll this whole pass is for. Called once, here, after both the
    // player exists (startFollow needs a real target) and
    // refreshRoomVisibility has already set this deck's bounds (so the
    // camera never gets a frame of being unclamped). A soft lerp rather
    // than a hard snap-to-player — this is a slow-walk social space, not a
    // twitch shooter, so a camera that eases in reads calmer than one that
    // rigidly pins the player to the exact center every frame.
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    this.interactPrompt = this.add.text(480, ROOM_BOUNDS.bottom + 20, "", { fontFamily: "monospace", fontSize: "11px", color: ACCENT }).setOrigin(0.5).setScrollFactor(0);

    // Cursor tip, 2 Sep 2026 — the Hub half of the same feature Battle got
    // this pass (scenes/ui/HoverTip.ts). Built here after interactPrompt so
    // it sits later in the display list than every room/NPC object created
    // above; its own high depth handles the overlays built below.
    this.hoverTip = new HoverTip(this);
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      this.pointerX = p.x;
      this.pointerY = p.y;
      this.pointerWorldX = p.worldX;
      this.pointerWorldY = p.worldY;
      this.updateHoverTip();
    });

    const footer = this.add.container(0, 0).setScrollFactor(0);
    // Renamed from "BACK TO HANGAR" (3 Sep 2026, Maxime's call) — this button
    // jumps to the separate Hangar SCENE (the "CAMPAIGN SHOP" screen), not
    // the Hub's own internal "Hangar Deck" ROOM, and the old label read as
    // if it meant the latter. Widened 140 -> 165 to keep the longer label
    // clear of makeShopButton's own wordWrap at this font size.
    makeShopButton(this, footer, 95, 604, 165, 32, this.f.profile.backButtonLabel, true, () => this.scene.start("Hangar"));
    // Tooltip Coverage pass, 12 Sep 2026 — not passed as makeShopButton's
    // own trailing tooltip/hoverTip params on purpose: that built-in wiring
    // calls hoverTip.show() directly with no way to also flip
    // overlayHoverActive, so the scene-wide pointermove handler would
    // immediately overwrite it with room/NPC content on the very next
    // pixel of mouse movement. wireHoverTip() below is what actually
    // arbitrates that. footer.list[0] is the bg rectangle makeShopButton
    // just built (layer.add([bg, txt]) — see that function's own body) —
    // reaching in by index rather than by a returned reference since the
    // function returns void; footer had nothing in it before this one call,
    // so index 0 is exactly this button, not a guess.
    this.wireHoverTip(footer.list[0] as Phaser.GameObjects.GameObject, [
      "LEAVE THE HUB",
      "",
      ...wrapTipText(
        "Opens the separate Campaign Shop screen — an older, simpler gear and roster screen from before the Hub existed. Your progress here is already saved; nothing is lost by going there.",
        42,
      ),
    ]);

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
    // EA Launch Plan Week 1 hardening, 1 Sep 2026 — M (debug muster) and R
    // (debug rumor) stay real and bound in dev builds only. Readiness Plan
    // §3.1 asked to keep them usable for continued dev testing rather than
    // deleting them outright, just stop an EA player from ever seeing or
    // triggering them: import.meta.env.DEV is false in a production Vite
    // build, so mKey/rKey simply stay undefined there and every existing
    // `if (this.mKey && ...)`/`if (this.rKey && ...)` check below already
    // no-ops on undefined — no other call site needed to change.
    if (import.meta.env.DEV) {
      this.mKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.M);
      this.rKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    }
    this.tKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.T);
    // H (history) / L (highlights), 2 Sep 2026 — see update()'s own comment
    // for why these two got direct keys. Not dev-gated: unlike M/R above
    // these are real player-facing features, just ones that previously had
    // no way in except typing at the chat box.
    this.hKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.H);
    this.lKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.L);
    this.bKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.B);
    this.escKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.input.keyboard?.addCapture(hubCaptureKeys());

    this.buildChatBox();
    this.buildChatLogPanel();
    this.buildPegBoardOverlay();
    this.buildPokerOverlay();
    this.buildDartsOverlay();
    this.buildHistoryOverlay();
    this.standingsPanel = new StandingsPanel(this, ROOM_BOUNDS, () => this.closeStandings(), (obj, lines) => this.wireHoverTip(obj, lines));
    this.missionBriefingPanel = new MissionBriefingPanel(this, ROOM_BOUNDS, () => this.closeMissionBriefing(), (obj, lines) => this.wireHoverTip(obj, lines));
    this.memorialPanel = new MemorialPanel(this, ROOM_BOUNDS, () => this.closeMemorial(), (obj, lines) => this.wireHoverTip(obj, lines));
    this.rosterPanel = new RosterPanel(
      this,
      ROOM_BOUNDS,
      () => this.closeRosterPanel(),
      () => this.onLanceAssignmentChanged(),
      (obj, lines) => this.wireHoverTip(obj, lines)
    );
    this.buildHighlightsOverlay();
    this.buildHangarShopOverlay();
    this.buildWorkshopOverlay();
    this.buildVaultOverlay();

    this.input.on("pointerdown", (_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
      // Hangar-shop hotfix (30 Aug 2026, Maxime: "still cant interact with
      // the hangar window"). This scene-wide listener fires on EVERY
      // pointerdown, including clicks landing on ShopPanel's own buttons —
      // Phaser's own InputPlugin.processDownEvents fires each interactive
      // GameObject's own pointerdown listener first, then still emits this
      // plugin-level POINTER_DOWN afterward for the same click (see
      // node_modules/phaser/src/input/InputPlugin.js's own numbered
      // comments, "1) GAMEOBJECT_POINTER_DOWN" before "3) POINTER_DOWN") —
      // nothing here was stopping that second pass. History/Highlights/
      // Poker/Darts never hit this because they only ever open from an NPC
      // click, which already sets npcClickConsumed and returns below before
      // reaching the fallback dispatch. The Hangar Shop is the one overlay
      // opened by *proximity* (isAtHangarShop()), so the player is still
      // standing in range for every later click while it's open — each one
      // fell through to isAtHangarShop() → true → openHangarShop() → an
      // unconditional hangarShop.render() (see that function's own
      // comment: "fresh render on every open, not just the first"),
      // tearing down and rebuilding the panel's own interactive elements
      // right after whatever button the player had just actually clicked
      // already fired. That's the "can't interact with it" — a click on
      // Buy/Upgrade/Recruit worked, then got its visible result immediately
      // wiped by a same-click re-render, so nothing looked like it
      // happened until the NEXT click, one step behind.
      //
      // Fixed using `currentlyOver` (the plugin's own pre-computed hit-test
      // list, passed into this event) rather than checking hangarShopOpen —
      // ShopPanel's own full-screen interactive backdrop (ShopPanel.ts) is
      // in that list for any click anywhere inside the open panel,
      // including the overlay's own [close] button, so this check is
      // correct regardless of event order. Checking hangarShopOpen itself
      // was tried first and rejected: closeHangarShop() (fired by the
      // close button's own listener, which — per the ordering above — runs
      // BEFORE this one) already flips that flag to false by the time this
      // code runs, so that version would have let a close-button click fall
      // through to isAtHangarShop() and immediately reopen the panel it had
      // just closed.
      //
      // Placed AFTER the npcClickConsumed block below, not before — NPC
      // circles are also setInteractive() (see the npcClickConsumed-setting
      // loop further down this file), so they show up in currentlyOver too.
      // Checking currentlyOver first would return before npcClickConsumed
      // ever got reset back to false, leaving it stuck true and silently
      // eating the player's next ordinary floor click.
      if (this.npcClickConsumed) {
        this.npcClickConsumed = false; // this click already provoked a specific NPC — don't also broadcast
        return;
      }
      if (currentlyOver.length > 0) return;
      // Same context-sensitivity as the E key (see updateProximity) —
      // clicking the room while standing at a door or the bay does that
      // instead of talking, so click and E never disagree about what
      // pressing the "interact" affordance does from the same spot.
      const door = this.isAtDoor();
      if (door) this.switchRoom(door);
      else if (this.isAtBay()) this.deploy();
      else if (this.isAtCrewRecords()) this.openRosterPanel();
      else if (this.isAtHangarShop()) this.openHangarShop();
      // Workshop bench, 2 Sep 2026 — added to BOTH the click path and the
      // E-key path, since this file's own rule (see the click handler's
      // comment) is that the two must never disagree about what the
      // interact affordance does from a given spot. Can't collide with the
      // Hangar Deck console above: the two gate on different currentRoomId.
      else if (this.isAtWorkshopBench()) this.openWorkshop();
      // The Vault plinth, 2 Sep 2026 — same both-paths rule as the Workshop
      // bench just above; gates on its own currentRoomId, so it can't
      // collide with either console above it.
      else if (this.isAtVaultPlinth()) this.openVault();
      // The standings board, 3 Sep 2026 — same both-paths rule as the two
      // above; gates on its own currentRoomId, so it can't collide.
      else if (this.isAtStandingsBoard()) this.openStandings();
      // The Archive, 7 Sep 2026 — same both-paths rule as the three above;
      // gates on the facility's own archiveRoom, so it can't collide.
      else if (this.isAtArchiveTable()) this.openArchive();
      else this.speak();
    });

    // Must run LAST in create(), after every object this scene will ever
    // build during create() actually exists (including everything the
    // overlay builders above just added) — see this method's own header.
    this.finalizeDockCameraSplit();
  }

  // OVERHEARD/chat UI-camera dock, Carrier Scale-Up Plan v1 Phase 2, 3 Sep
  // 2026 — the other half of the split this.uiCamera's own creation-time
  // comment (top of create()) describes. Splits the scene's own top-level
  // display list into two halves and tells each camera to ignore the
  // other's: this.uiCamera ignores everything EXCEPT uiCameraObjects (the
  // dock content — OVERHEARD panel, its label, its log text, the corner
  // MENU button, the T-activated chat input DOM element), and the main
  // camera ignores uiCameraObjects itself.
  //
  // Why "everything except uiCameraObjects" rather than a hand-picked list
  // of world objects: this scene builds well over a hundred individually
  // top-level game objects across create() (every HUD text line, every
  // deck floor container, every door/decor/reserved-bay marker, every NPC
  // root/bubble/favLabel, the player, every minigame overlay container,
  // the hover tip) — hand-enumerating "every one of those that must never
  // render via the dock camera" would be exactly the kind of list that
  // silently goes stale the next time someone adds a new HUD element or
  // overlay to this file and never thinks to touch this method. Reading
  // this.children.list instead — the scene's own actual display list, at
  // the one moment (end of create()) it's known to hold everything except
  // what create() builds after this call (nothing does) — can't go stale
  // the same way: it's authoritative by construction, not a second list
  // someone has to remember to keep in sync with the first.
  //
  // Why this doesn't need to run again later: everything created AFTER
  // create() finishes (NPC speech bubbles via showBubble, minigame row
  // objects, etc.) is added as a CHILD of a container that already exists
  // in this snapshot (npc.bubbleContainer, this.pegOverlay, and so on) —
  // Phaser's own per-camera ignore check happens on whichever object is
  // actually walked by the renderer's display-list traversal, and for a
  // Container that's the container itself first: if a camera is already
  // ignoring that container, the renderer never even looks at its children
  // for that camera, no matter when they were added (see
  // ContainerWebGLRenderer.js's own per-child willRender(camera) check,
  // which only runs at all once the container's OWN willRender(camera) has
  // already passed). The one place this project creates genuinely NEW
  // top-level objects after create() is MenuOverlay.ts's own
  // showMenuOverlay — handled directly in that shared file instead, since
  // it already has to loop over every camera generically for its own
  // full-screen backdrop (see that file's own comment).
  private finalizeDockCameraSplit() {
    const dockObjects = this.uiCameraObjects;
    const dockSet = new Set<Phaser.GameObjects.GameObject>(dockObjects);
    const worldObjects = this.children.list.filter((obj) => !dockSet.has(obj));
    this.uiCamera.ignore(worldObjects);
    this.cameras.main.ignore(dockObjects);
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
  //
  // OVERHEARD dock, Carrier Scale-Up Plan v1 Phase 2, 3 Sep 2026 — moved
  // from centered under the main play area (below ROOM_BOUNDS.bottom) to
  // sit directly under the OVERHEARD panel, inside the dock strip — see
  // DOCK_INPUT_Y's own header. Positioned in DOCK-LOCAL coordinates
  // (DOCK_LOG_CENTER_X, not an absolute screen x) and registered into
  // uiCameraObjects for finalizeDockCameraSplit() to route exclusively
  // through this.uiCamera, same as every other dock object — a Phaser DOM
  // Element uses this exact same cameraFilter/ignore mechanism to decide
  // which camera's transform positions it (Phaser's own docs: "you should
  // only have DOM Elements in a Scene with a single Camera... if you
  // require multiple cameras, use parallel scenes" — this project can't
  // take that advice, the dock and the world genuinely need to coexist in
  // one scene, so this ignore-list is what makes a second camera safe here:
  // without it, whichever of the two cameras happens to render last each
  // frame would silently win the DOM element's own CSS transform, an
  // order-dependent race rather than a real guarantee). Width shrunk from
  // 320px to fit the dock's own DOCK_LOG_WIDTH (228px) rather than
  // overflowing it.
  private buildChatBox() {
    this.chatInput = this.add
      .dom(
        DOCK_LOG_CENTER_X,
        DOCK_INPUT_Y,
        "input",
        "width: 200px; padding: 6px 8px; font-family: monospace; font-size: 13px; " +
          "background: #1a2028; color: #e8e2d4; border: 1px solid #4a7a9a; outline: none;"
      )
      .setOrigin(0.5)
      .setVisible(false)
      .setScrollFactor(0);
    this.uiCameraObjects.push(this.chatInput);

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

  // See DOCK_SPLIT_X's own header for placement reasoning. Built once,
  // never rebuilt on room switch — same idiom as roomTitleText/the interact
  // prompt, both fixed HUD elements outside ROOM_BOUNDS. Every object here
  // is positioned in DOCK-LOCAL coordinates and registered into
  // uiCameraObjects so finalizeDockCameraSplit() (end of create()) routes
  // it exclusively through this.uiCamera — see that constant's own header
  // for why this panel needs its own camera at all now.
  private buildChatLogPanel() {
    const bg = this.add
      .rectangle(DOCK_LOG_CENTER_X, DOCK_PANEL_CENTER_Y, DOCK_LOG_WIDTH, DOCK_PANEL_HEIGHT, PANEL_BG, 0.9)
      .setStrokeStyle(1, PANEL_BORDER)
      .setScrollFactor(0);
    const label = this.add
      .text(DOCK_LOG_CENTER_X, DOCK_PANEL_TOP + 14, "OVERHEARD", { fontFamily: "monospace", fontSize: "10px", color: TEXT_DIM })
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.chatLogText = this.add
      .text(8, DOCK_PANEL_TOP + 32, "Quiet so far.", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: TEXT_MAIN,
        wordWrap: { width: DOCK_LOG_WIDTH - 16 },
        lineSpacing: 4,
      })
      .setOrigin(0, 0)
      .setScrollFactor(0);
    this.uiCameraObjects.push(bg, label, this.chatLogText);

    // Tier 6 hotfix, 30 Aug 2026 — see CHAT_LOG_VISIBLE_LINES's own header.
    // CHAT_LOG_VISIBLE_LINES was doubled based on a real (if approximate)
    // measurement, not certainty — this geometry mask (same idiom
    // MapSelect.ts's own scrollable list already uses) is the actual
    // guarantee: whatever renderChatLog puts in chatLogText, anything past
    // the panel's own bottom edge clips there instead of spilling out onto
    // the game board underneath it.
    //
    // Carrier Scale-Up Plan v1, Phase 1, 2 Sep 2026 — the Plan doc's own
    // "every persistent UI element needs a setScrollFactor(0) audit" note
    // flagged this exact mask as a real risk area, and it is one: a
    // GeometryMask is itself a GameObject with its own scrollFactor
    // (default 1, i.e. world-space), independent of whatever it's masking.
    // chatLogText above is now screen-fixed (scrollFactor 0); if this
    // shape stayed world-space, the mask would drift away from the text it
    // clips the instant the camera pans, clipping the wrong region (or
    // none at all). Pinned here defensively so the two stay locked
    // together regardless of camera position.
    //
    // Not pushed to uiCameraObjects: created via this.make.graphics({}),
    // never this.add — deliberately never added to the scene's own display
    // list (see Phaser's own this.make vs this.add distinction), so it
    // isn't camera-filtered independently at all; it just rides along with
    // whichever single camera ends up rendering chatLogText itself (only
    // this.uiCamera, once finalizeDockCameraSplit runs), which is exactly
    // where its own dock-local coordinates below already assume it lands.
    const maskShape = this.make.graphics({});
    maskShape.setScrollFactor(0);
    maskShape.fillRect(0, DOCK_PANEL_TOP + 30, DOCK_LOG_WIDTH, DOCK_PANEL_HEIGHT - 34);
    this.chatLogText.setMask(maskShape.createGeometryMask());
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
    // Exactly create()'s capture list — release it while typing so none of
    // those letters get preventDefault'd out of the input. Shared helper
    // rather than a repeated literal; see hubCaptureKeys' own header for
    // the bug that motivated it.
    this.input.keyboard?.removeCapture(hubCaptureKeys());
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
    this.input.keyboard?.addCapture(hubCaptureKeys());
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

    // The colon-command namespace, 12 Sep 2026 (Mission Chat / Player Notes
    // / Battle HUD Relayout Plan v1, Workstream 1) — checked FIRST, ahead of
    // every keyword bucket below, and an unknown command STOPS here with an
    // error line rather than falling through (see detectCommand's own
    // header for the ":notse hold the line" bug this rule exists for).
    const command = detectCommand(trimmed);
    if (command) {
      this.runChatCommand(command);
      return;
    }

    const verbId = detectVerbRequest(trimmed);
    if (verbId === "shareADrink") {
      if (this.currentRoomId !== "recroom") {
        this.showFallback("Nothing to pour outside the rec room.");
        return;
      }
      // Tier 2, 30 Aug 2026 — requireRoom, not just the radius check: see
      // nearestNpcInRange's own header. Without it this could hand back an
      // NPC actually standing in hangarDeck/berths, on the far side of the
      // open floor's zone seam but still within APPROACH_RADIUS.
      const target = this.nearestNpcInRange(APPROACH_RADIUS, "recroom");
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
      // Tier 2, 30 Aug 2026 — see nearestNpcInRange's own header (Tier 2,
      // minigame room gating): the peg table only exists in the rec room,
      // so the opponent has to actually be standing in it too.
      const target = this.nearestNpcInRange(APPROACH_RADIUS, "recroom");
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
      // Tier 2, 30 Aug 2026 — see nearestNpcInRange's own header (Tier 2,
      // minigame room gating): the card table only exists in the rec room.
      const target = this.nearestNpcInRange(APPROACH_RADIUS, "recroom");
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
      // Tier 2, 30 Aug 2026 — see nearestNpcInRange's own header (Tier 2,
      // minigame room gating): the dart board only exists in the rec room.
      const target = this.nearestNpcInRange(APPROACH_RADIUS, "recroom");
      if (!target) {
        this.showFallback("Nobody's close enough for a round.");
        return;
      }
      this.startDarts(target);
      return;
    }
    if (verbId === "askOut") {
      if (!isBerths(this.currentRoomId)) {
        this.showFallback("Not the place to ask that. Try the berths.");
        return;
      }
      // Tier 2, 30 Aug 2026 — same fix, same reasoning, see
      // nearestNpcInRange's own header — berths shares its deck with
      // recroom/hangarDeck too, so this needed the identical requireRoom
      // narrowing the three minigames and Share a Drink got.
      const target = this.nearestNpcInRange(APPROACH_RADIUS, this.currentRoomId);
      if (!target) {
        this.showFallback("Nobody's close enough to ask.");
        return;
      }
      this.askOut(target);
      return;
    }

    // Gift/Praise/Insult/Apology/Congratulate/Send-Off, 2 Sep 2026 — the
    // crew-interaction brainstorm pass ("add it all they are good"). Flirt
    // joined this group 12 Sep 2026 — same precedence slot, same shape
    // (flirtWithNpc's own header has the full reasoning for why it's
    // grouped here rather than with askOut above, despite the thematic
    // overlap). Same precedence slot as every real verb above (a genuine
    // request beats build/debrief/history/highlights/small-talk/the
    // generic shrug), and deliberately NOT room-gated the way Share a
    // Drink/the minigames/Ask Out are — nothing about complimenting,
    // flirting, insulting, apologizing to, or sending off a crewmate is
    // tied to one specific room's furniture, so resolveChatTarget's
    // ordinary deck-wide candidate pool applies exactly as it already does
    // for Talk/History/Highlights.
    if (verbId === "gift") {
      const target = this.resolveChatTarget(trimmed);
      if (!target) {
        this.showFallback("Nobody's close enough to give that to.");
        return;
      }
      this.giveGift(target);
      return;
    }
    if (verbId === "praise") {
      const target = this.resolveChatTarget(trimmed);
      if (!target) {
        this.showFallback("Nobody's close enough to hear that.");
        return;
      }
      this.praiseNpc(target);
      return;
    }
    if (verbId === "flirt") {
      const target = this.resolveChatTarget(trimmed);
      if (!target) {
        this.showFallback("Nobody's close enough to hear that.");
        return;
      }
      this.flirtWithNpc(target);
      return;
    }
    if (verbId === "insult") {
      const target = this.resolveChatTarget(trimmed);
      if (!target) {
        this.showFallback("Nobody's close enough to hear that.");
        return;
      }
      this.insultNpc(target);
      return;
    }
    if (verbId === "apology") {
      const target = this.resolveChatTarget(trimmed);
      if (!target) {
        this.showFallback("Nobody's close enough to hear that.");
        return;
      }
      this.apologizeToNpc(target);
      return;
    }
    if (verbId === "congratulate") {
      const target = this.resolveChatTarget(trimmed);
      if (!target) {
        this.showFallback("Nobody's close enough to congratulate.");
        return;
      }
      this.congratulateNpc(target);
      return;
    }
    if (verbId === "sendOff") {
      const target = this.resolveChatTarget(trimmed);
      if (!target) {
        this.showFallback("Nobody's close enough to ask.");
        return;
      }
      this.sendOffNpc(target);
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
    // Every CO-only gate below (build/debrief/brief/confide/remove-pilot)
    // used to repeat the same three lines — nearestNpcInRange, then check
    // pilotId !== CO_PILOT_ID — with no way for the player to reach him by
    // naming him instead of standing next to him. Centralized into
    // isReachingCo() 2 Sep 2026 (playtest tally item 7 part B) so "aoc,
    // debrief"/"aoc, brief" get the same treatment here that the six
    // social-action verbs' own resolveChatTarget already gives a named
    // target over "nearest" — see that method's own header just below.
    const buildRequest = detectBuildRequest(trimmed);
    if (buildRequest) {
      if (!this.isReachingCo(trimmed)) {
        this.showFallback("Only the CO signs off on that — find him in the grotto.");
        return;
      }
      this.markCoCheckedIn(); // CO Check-In Gate Plan v1 — a build request reaches him too
      this.handleBuildRequest(buildRequest);
      return;
    }

    // Debrief request — CO-specific, 2 Sep 2026. Same gate shape as the
    // build request just above, same reason: "who do I even ask" is a real
    // new-player question, so asking anyone but the CO gets a clear
    // redirect rather than a silent miss or a generic shrug. First pass
    // (same day) mapped "brief"/"debrief" onto the generic History request
    // below instead — Maxime's own correction: this is specifically a CO
    // ask, not something any NPC answers. See chatIntent.ts's own
    // DEBRIEF_KEYWORDS header and handleDebriefRequest below for what the
    // CO actually says. Checked before History so "debrief" can never
    // double-match there even if a future keyword list drifted — today the
    // two sets don't overlap at all (chatIntent.ts's own HISTORY_KEYWORDS
    // no longer includes either word).
    if (detectDebriefRequest(trimmed)) {
      if (!this.isReachingCo(trimmed)) {
        this.showFallback("Ask the CO about that — find him in the grotto.");
        return;
      }
      this.markCoCheckedIn(); // same as a build request reaching him — CO Check-In Gate Plan v1
      this.handleDebriefRequest();
      return;
    }

    // Brief request — CO-specific, 2 Sep 2026, split off from Debrief just
    // above the same day (playtest tally item 7: "brief does the same
    // thing as debrief. it should not. brief is before a mission debrief
    // is after a mission."). Checked right after Debrief for the same
    // reason Debrief is checked before History — the two keyword sets
    // don't overlap (chatIntent.ts's own header on this explains why
    // "debrief" can never double-match BRIEF_KEYWORDS), so order between
    // them doesn't matter structurally, but keeping them adjacent keeps the
    // pair readable as one unit. See chatIntent.ts's own BRIEF_KEYWORDS
    // header and handleBriefRequest below for what the CO actually says.
    if (detectBriefRequest(trimmed)) {
      if (!this.isReachingCo(trimmed)) {
        this.showFallback("Ask the CO about that — find him in the grotto.");
        return;
      }
      this.markCoCheckedIn();
      this.handleBriefRequest();
      return;
    }

    // Confide request — CO-specific, 2 Sep 2026 (Antfarm Carrier Hub v1
    // §11.3's long-flagged, never-built grotto stress-relief hook). Same
    // CO-only gate shape as the build/debrief/brief checks just above, same
    // reason: this is a direct ask of the CO specifically, not something
    // any nearby NPC can answer.
    if (detectConfideRequest(trimmed)) {
      if (!this.isReachingCo(trimmed)) {
        this.showFallback("That's between you and the CO — find him in the grotto.");
        return;
      }
      this.markCoCheckedIn();
      this.handleConfideRequest();
      return;
    }

    // Remove-pilot request — CO-specific, 2 Sep 2026, the Insult Tier-3
    // resolution path (Maxime: "wont fly with you, player will have to ask
    // co to remove them from ship"). Same CO-only gate as Confide just
    // above.
    if (detectRemovePilotIntent(trimmed)) {
      if (!this.isReachingCo(trimmed)) {
        this.showFallback("That's a call only the CO can make — find him in the grotto.");
        return;
      }
      this.markCoCheckedIn();
      this.handleRemovePilotRequest(trimmed);
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

    // Small talk — Chat Keyword Categories Plan v1 closing pass, 1 Sep 2026.
    // Checked in the same precedence slot as History/Highlights just above
    // (a specific, actionable read beats both "not open yet" and the
    // coarse muster/emotion pass interpretPlayerChat runs below) and,
    // crucially, BEFORE that muster/emotion pass — see chatIntent.ts's own
    // detectSmallTalk header for the two real keyword collisions ("mission"
    // inside a worry-checkin phrase, "worried" inside a fear-bucket phrase)
    // this ordering closes for real, not just in theory.
    const smallTalk = detectSmallTalk(trimmed);
    if (smallTalk) {
      if (this.pegOpen || this.pokerOpen || this.dartsOpen) return; // already mid-game — let that own the screen

      // Greeting/farewell broadcast to everyone in talk range, 5 Sep 2026
      // (Maxime: "when I say hello I want all my ant to hear it, not just
      // one"). "Hello"/"bye" read as addressing the room, not one specific
      // person, so every ant standing close enough reacts, each with their
      // own line and their own bubble — showBubble is already per-NPC
      // (bubbleUntil lives on the npc, not the scene), same machinery
      // ambient chatter and rumor-spread already lean on for several NPCs
      // reacting independently, so no new plumbing needed here. Worry
      // check-in/advice/banter stay single-target below: those read as the
      // player addressing one specific person, not the room.
      if (smallTalk === "greeting" || smallTalk === "farewell") {
        const targets = this.allNpcsInRange(APPROACH_RADIUS);
        if (targets.length === 0) {
          this.showFallback("Nobody's close enough to talk to.");
          return;
        }
        for (const target of targets) {
          const isCo = target.pilotId === CO_PILOT_ID;
          if (isCo) this.markCoCheckedIn(); // CO Check-In Gate Plan v1 — small talk reaches him too
          const line =
            smallTalk === "greeting"
              ? isCo
                ? pickCoGreetingLine()
                : pickGreetingLine(target.ambient.catalyst)
              : isCo
                ? pickCoFarewellLine()
                : pickFarewellLine(target.ambient.catalyst);
          this.showBubble(target, line, this.time.now);
          this.holdForPlayerTalk(target);
        }
        return;
      }

      const target = this.nearestNpcInRange(APPROACH_RADIUS);
      if (!target) {
        this.showFallback("Nobody's close enough to talk to.");
        return;
      }
      const isCo = target.pilotId === CO_PILOT_ID;
      if (isCo) this.markCoCheckedIn(); // CO Check-In Gate Plan v1 — small talk reaches him too
      let line: string;
      if (smallTalk === "worry_checkin") {
        // Reuses the same rich, mood/needs/bleed-aware pick every ordinary
        // Talk already uses — a genuinely worried listener surfaces a
        // fear-flavored line for free, via the same worried-state priority
        // pickSoloEcho already applies (data/ambientLines.ts), rather than
        // this file re-deriving that priority a second time. Not CO-special-
        // cased: his bespoke bank doesn't cover Worry check-in (see
        // data/smallTalk.ts's own header), so he falls back to his own
        // catalyst's read here, same as every other pilot.
        line = this.pickAmbientLineWithMemory(target).line;
      } else if (smallTalk === "advice") {
        line = isCo ? pickCoAdviceLine(target.ambient.stress) : pickAdviceLine(target.ambient.catalyst);
      } else {
        // banter — the CO has no bespoke joke content (data/smallTalk.ts's
        // own header), so he falls back to his own catalyst's crew banter
        // line rather than a silent gap.
        line = pickBanterLine(target.ambient.catalyst);
      }
      this.showBubble(target, line, this.time.now);
      this.holdForPlayerTalk(target);
      return;
    }

    // Move It, 4 Sep 2026 (Move It Verb Proposal v1) — a forced local-
    // cluster clear, on demand. Not a VerbDef (see chatIntent.ts's own
    // detectMoveItRequest header: no Cost/Outcome/SocialLogEntry, this is an
    // engine patch from inside the fiction, not a relationship beat), so
    // it's its own boolean check, same shape as detectHistoryRequest/
    // detectConfideRequest above it. Checked here — after every real verb
    // and CO-gated request, but before detectUnbuiltVerbLine's placeholder
    // and interpretPlayerChat's generic shrug — same "a genuine, actionable
    // request beats both" precedence every other check in this chain
    // already follows. Not room-gated: the fix is harmless anywhere in the
    // Hub. Anchor is the nearest NPC in range, same helper Share a Drink/
    // Ask Out already use; clearCluster (see its own header, right above
    // tryMoveNpc) sweeps in anyone actually touching them.
    if (detectMoveItRequest(trimmed)) {
      const target = this.nearestNpcInRange(APPROACH_RADIUS);
      if (!target) {
        this.showFallback("Nobody's close enough to move.");
        return;
      }
      this.clearCluster(target);
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

  // The colon-command namespace's Hub half, 12 Sep 2026. ":help" and an
  // unknown command print into the OVERHEARD log under a SYS tag (not a
  // bubble — nobody on the ship said it); ":notes <text>" writes a Field
  // Note stamped with this save and day; a bare ":notes" opens the Codex on
  // its FIELD NOTES section, same returnScene idiom MenuOverlay.ts's own
  // Codex button already uses (the Hub reloads from the save on return,
  // which is exactly what that path already does today); ":t <name>
  // <text>" is targeted talk — the named crewmate, deck-wide, gets `text`
  // routed to them specifically, no "nearest" fallback, since naming
  // someone and getting whoever's closest is the failure this command
  // exists to remove.
  private runChatCommand(command: ChatCommand) {
    switch (command.kind) {
      case "help":
        for (const line of COMMAND_HELP_LINES) this.logChatLine("SYS", line);
        return;
      case "unknown":
        this.logChatLine("SYS", unknownCommandLine(command.name));
        return;
      case "notes": {
        if (!command.text) {
          this.scene.start("Codex", { returnScene: this.scene.key, section: "notes", campaignState: this.campaignState });
          return;
        }
        const result = addPlayerNote(command.text, {
          scene: "hub",
          campaignId: this.campaignState.campaignId,
          campaignLabel: `${companyNameOf(this.campaignState)}, Day ${currentDay(this.campaignState)}`,
        });
        this.logChatLine("SYS", result.ok ? `Noted (${result.count} in the notebook). :notes opens it.` : result.reason);
        return;
      }
      case "talk": {
        if (!command.targetName || !command.text) {
          this.logChatLine("SYS", "Usage: :t <name> <what to say>");
          return;
        }
        const candidates = this.npcs.filter((npc) => this.sameDeck(npc.room, this.currentRoomId));
        const namedId = extractNamedTarget(command.targetName, candidates.map((n) => ({ pilotId: n.pilotId, displayName: n.displayName })));
        const target = namedId ? candidates.find((n) => n.pilotId === namedId) : undefined;
        if (!target) {
          this.logChatLine("SYS", `Nobody called "${command.targetName}" on this deck.`);
          return;
        }
        this.submitChatToTarget(target, command.text);
        return;
      }
    }
  }

  // ":t"'s dispatch — the same precedence submitChat uses for ordinary
  // text, minus every step that resolves a target (that's already decided),
  // minus the CO-only requests and room-gated verbs (a named social verb or
  // small talk is the whole point of addressing one person; "build me a
  // sensor array" is still a walk-up-to-the-CO thing and still goes
  // through submitChat's own gates). Deliberately reuses the exact handler
  // each verb already has rather than a second copy of any of them.
  private submitChatToTarget(npc: HubNpc, text: string) {
    const verbId = detectVerbRequest(text);
    switch (verbId) {
      case "gift": this.giveGift(npc); return;
      case "praise": this.praiseNpc(npc); return;
      case "flirt": this.flirtWithNpc(npc); return;
      case "insult": this.insultNpc(npc); return;
      case "apology": this.apologizeToNpc(npc); return;
      case "congratulate": this.congratulateNpc(npc); return;
      case "sendOff": this.sendOffNpc(npc); return;
      default: break;
    }
    const smallTalk = detectSmallTalk(text);
    if (smallTalk) {
      const isCo = npc.pilotId === CO_PILOT_ID;
      if (isCo) this.markCoCheckedIn();
      let line: string;
      if (smallTalk === "greeting") line = isCo ? pickCoGreetingLine() : pickGreetingLine(npc.ambient.catalyst);
      else if (smallTalk === "farewell") line = isCo ? pickCoFarewellLine() : pickFarewellLine(npc.ambient.catalyst);
      else if (smallTalk === "worry_checkin") line = this.pickAmbientLineWithMemory(npc).line;
      else if (smallTalk === "advice") line = isCo ? pickCoAdviceLine(npc.ambient.stress) : pickAdviceLine(npc.ambient.catalyst);
      else line = pickBanterLine(npc.ambient.catalyst);
      this.showBubble(npc, line, this.time.now);
      this.holdForPlayerTalk(npc);
      return;
    }
    // Same tail as showCatalystOrFallback, for one person: a catalyst-
    // dictionary hit in their own voice, else the shared shrug.
    const reaction = pickCatalystReaction(npc.ambient, npc.pilotId, text);
    const line = reaction ? reaction.line : CHAT_FALLBACK_LINES[Math.floor(Math.random() * CHAT_FALLBACK_LINES.length)];
    this.showBubble(npc, line, this.time.now);
    this.holdForPlayerTalk(npc);
  }

  // Verb framework's first real single-target verb, 26 Aug 2026 (see
  // data/verbs.ts's own header for the framework itself). "Nearest NPC
  // within range" stands in for real targeting since chat has no explicit
  // @-target syntax — reuses APPROACH_RADIUS (the same distance that
  // already makes Favorability visible) as "close enough to be who the
  // player obviously means," rather than inventing a second radius
  // constant for the same rough idea.
  //
  // Tier 2, 30 Aug 2026 (Consolidated Build Plan, Tier 2 — minigame room
  // gating). This originally scoped candidates to this.sameDeck(npc.room,
  // this.currentRoomId) only — correct, deliberately, for the callers that
  // want it: Talk/history/highlights/build-request are all meant to reach
  // anyone visible across a shared open-floor deck, not just the player's
  // exact room (ROOM_ZONE_BOUNDS's own split of one deck into several
  // RoomIds is a labeling/UI convenience — recroom/hangarDeck/berths share
  // one continuous floor with no wall between them, see its own header).
  // But three verbs — the minigames (peg board/poker/fletchers) and Share
  // a Drink/Ask Out — gate on a SPECIFIC room at their own call site
  // (`if (this.currentRoomId !== "recroom") ...`) precisely because their
  // furniture (the peg table, the card table, the dart board, the pour) is
  // physically only in that one room. That per-call-site check only ever
  // verified the PLAYER's own room, never the actual NPC nearestNpcInRange
  // was about to hand back — and since recroom/hangarDeck/berths share one
  // coordinate space with no gap at their shared boundary
  // (ROOM_ZONE_BOUNDS again), a player standing in the rec room within
  // APPROACH_RADIUS (78px) of that boundary line can trivially have an NPC
  // who is actually standing in hangarDeck or berths come back as the
  // "nearest" target — not a rare edge case, an ordinary distance at a
  // zone seam. The result: starting a poker hand, or Ask Out, with someone
  // the room-gate was supposed to have already ruled out. New optional
  // requireRoom param, passed only by the five call sites that already do
  // their own room check (shareADrink/pegBoard/poker/fletchers pass
  // "recroom", askOut passes "berths") — every other caller is unchanged,
  // deck-scoped exactly as before, since that breadth is correct for them.
  private nearestNpcInRange(radius: number, requireRoom?: RoomId): HubNpc | null {
    let best: HubNpc | null = null;
    let bestDist = radius;
    for (const npc of this.npcs) {
      if (!this.sameDeck(npc.room, this.currentRoomId)) continue;
      if (requireRoom !== undefined && npc.room !== requireRoom) continue;
      const dist = Phaser.Math.Distance.Between(this.playerX, this.playerY, npc.x, npc.y);
      if (dist <= bestDist) {
        best = npc;
        bestDist = dist;
      }
    }
    return best;
  }

  // Broadcast targeting, 5 Sep 2026 (Maxime: "when I say hello I want all
  // my ant to hear it, not just one"). Sibling of nearestNpcInRange just
  // above, same sameDeck/radius scope, but collects every match instead of
  // tracking a single closest one — greeting/farewell reads as addressing
  // the room, not one specific person, so it shouldn't pick a "nearest"
  // winner. Unused by anything else today; every other small-talk kind
  // (worry check-in, advice, banter) stays on nearestNpcInRange since those
  // read as the player addressing one specific person.
  private allNpcsInRange(radius: number): HubNpc[] {
    const found: HubNpc[] = [];
    for (const npc of this.npcs) {
      if (!this.sameDeck(npc.room, this.currentRoomId)) continue;
      const dist = Phaser.Math.Distance.Between(this.playerX, this.playerY, npc.x, npc.y);
      if (dist <= radius) found.push(npc);
    }
    return found;
  }

  // CO reach check, 2 Sep 2026 (playtest tally item 7 part B) — the five
  // CO-only gates in submitChat (build/debrief/brief/confide/remove-pilot)
  // used to check pure physical proximity only: whichever NPC is nearest
  // within APPROACH_RADIUS, with no way for the player to reach the CO by
  // naming him instead. That's different from resolveChatTarget just below,
  // which already lets a named target beat "nearest" for the six social
  // verbs — the CO's own requests never got that same treatment, and even
  // if they had, extractNamedTarget alone wouldn't have caught "aoc" (see
  // chatIntent.ts's own CO_ALIASES header). Naming him now resolves the
  // same way a social-verb target does: scoped to the same deck as the
  // player (resolveChatTarget's own candidate scope), not literally
  // "nearest" — but also not full-ship reach. There's no established
  // precedent yet for radioing the CO from anywhere on the ship, so this
  // stays consistent with the existing same-deck precedent rather than
  // inventing a bigger behavior no one asked for.
  private isReachingCo(raw: string): boolean {
    const nearby = this.nearestNpcInRange(APPROACH_RADIUS);
    if (nearby?.pilotId === CO_PILOT_ID) return true;
    if (!mentionsCoByAlias(raw)) return false;
    const co = this.npcs.find((n) => n.pilotId === CO_PILOT_ID);
    return !!co && this.sameDeck(co.room, this.currentRoomId);
  }

  // Named-target resolution, 2 Sep 2026 — the six new single-target verbs'
  // own targeting need (chatIntent.ts's extractNamedTarget header has the
  // full reasoning: "well done, Bosk" should reach Bosk specifically, not
  // whoever happens to be standing closest). Tries a name match first,
  // scoped to the exact same candidate set nearestNpcInRange would have
  // considered (deck-shared, optionally room-narrowed); falls back to that
  // same nearest-in-range behavior the instant no name is found, so every
  // one of these six verbs degrades to the exact behavior every earlier
  // verb already had rather than introducing a new failure mode.
  private resolveChatTarget(raw: string, requireRoom?: RoomId): HubNpc | null {
    const candidates = this.npcs.filter(
      (npc) => this.sameDeck(npc.room, this.currentRoomId) && (requireRoom === undefined || npc.room === requireRoom)
    );
    const namedId = extractNamedTarget(
      raw,
      candidates.map((n) => ({ pilotId: n.pilotId, displayName: n.displayName }))
    );
    if (namedId) {
      const named = candidates.find((n) => n.pilotId === namedId);
      if (named) return named;
    }
    return this.nearestNpcInRange(APPROACH_RADIUS, requireRoom);
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

  // Rec Room Standings, slice 3 — one helper, three callers (finishPegBoard,
  // finishPoker, finishDarts). Deliberately NOT folded into
  // persistNpcSocial above, for the same reason ackStagePromotion isn't:
  // that function runs from plenty of interactions that are not a finished
  // game, and a record row is a claim that a session actually happened.
  //
  // Both sides get a row. The player sits in the same map as the crew under
  // PLAYER_RECORD_ID, so beating them moves their record exactly like any
  // other session — Maxime's own call, and the reason the panel can rank
  // him inline instead of printing him above the table as a special case.
  private recordRecRoomSession(npc: HubNpc, gameId: RecGameId, humanWon: boolean, draw: boolean, bestPlayer?: number, bestNpc?: number) {
    const recRoom = ensureRecRoomState(this.campaignState);
    recordSession(recRoom, {
      gameId,
      a: PLAYER_RECORD_ID,
      b: npc.pilotId,
      winner: draw ? "draw" : humanWon ? PLAYER_RECORD_ID : npc.pilotId,
      bestA: bestPlayer,
      bestB: bestNpc,
      day: currentDay(this.campaignState),
    });
    saveCampaignState(this.campaignState);
  }

  /**
   * One NPC's live skill at all three games, derived from their own record
   * (see engine/recRoomRecord.ts — skill is a pure function of sessions
   * played and their catalyst-derived ceiling, and is never stored).
   *
   * The archetype nudge needs the pilot's own roster entry, which a Hub NPC
   * that isn't on the roster (the CO, a Mek) doesn't have. Left out in that
   * case rather than guessed — aptitudeFor treats a missing path as no
   * nudge, which is the honest reading.
   */
  private recRoomSkills(recRoom: RecRoomState, npc: HubNpc): Partial<Record<RecGameId, number>> {
    const entry = this.campaignState.pilots[npc.pilotId];
    const path = entry ? UNIT_ARCHETYPES[entry.pilot.archetypeId]?.path : undefined;
    const out: Partial<Record<RecGameId, number>> = {};
    for (const gameId of REC_GAME_IDS) {
      out[gameId] = skillFor(recRoom, npc.pilotId, npc.ambient.catalyst, gameId, path);
    }
    return out;
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
    const missionName = missionId ? this.f.profile.missionsById[missionId]?.displayName : undefined;

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

    // {FALLEN} / {SAVIOR}, 12 Sep 2026 (Emotional Brain) — off this pilot's
    // OWN ledger: the loudest `lost_squadmate` memory names who they saw go,
    // the loudest `was_pulled_out` names the Munti who was still standing.
    // Loudest today, not most recent, so an old wound that still weighs
    // more than last week's beats it. Resolves only from real memories;
    // no fallback to "any lost pilot on the roster" (that is {LOST}'s job).
    const today = calendarCurrentDay(this.campaignState);
    const ledger = speakerSocial?.memories;
    const fallen = topMemories(ledger, today, ledger?.length ?? 0).find((m) => m.kind === "lost_squadmate" && m.about.length > 0);
    const fallenName = fallen ? this.campaignState.pilots[fallen.about[0]]?.pilot.displayName.split("—")[0].trim() : undefined;
    const pulled = topMemories(ledger, today, ledger?.length ?? 0).find((m) => m.kind === "was_pulled_out" && m.about.length > 0);
    const saviorName = pulled ? this.campaignState.pilots[pulled.about[0]]?.pilot.displayName.split("—")[0].trim() : undefined;

    return { squadmateName, missionName, speakerPath, speakerTier, rivalName, lostMuntiName, stageMomentText, fallenName, saviorName };
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
    // boredom included here too, 30 Aug 2026 — once NEEDS_FLAVOR_BANK
    // needed a boredom entry anyway (Record<NeedKind, ...> requires all
    // four now that NeedKind has grown one), there's no reason this flavor
    // pick should be the one place that ignores it; a bored pilot's own
    // ambient line surfaces the same way an hungry/thirsty/tired one
    // already does.
    const kind = worstNeed(npc.hunger, npc.thirst, npc.sleep, npc.boredom);
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
    // Stress & Morale Trigger Proposal, 1 Sep 2026 — this verb's own
    // stressDelta (see verbs.ts's own comment on why "getting drunk" isn't
    // a separate trigger here).
    if (def.outcome?.stressDelta) {
      npc.ambient = { ...npc.ambient, stress: Math.max(0, Math.min(100, npc.ambient.stress + def.outcome.stressDelta)) };
    }
    const { line } = this.pickAmbientLineWithMemory(npc);
    this.showBubble(npc, line, this.time.now);
    this.holdForPlayerTalk(npc);
    npc.socialLog = npc.socialLog ?? [];
    this.logVerbAndCharge(npc, { verb: "shareADrink", line, at: Date.now() });
    this.persistNpcSocial(npc);
  }

  // Gift / Praise / Flirt / Insult / Apology / Congratulate / Send-Off —
  // the seven single-target social verbs (2 Sep 2026; Flirt 12 Sep 2026).
  // Their MECHANICS moved out of this file 12 Sep 2026 into
  // engine/socialVerbResolution.ts (Mission Chat plan, Workstream 4 §5c) so
  // the Battle scene can run the exact same verbs mid-mission without
  // importing a scene file — see that module's header for what it does and
  // deliberately doesn't do. Each method below is the same entry point
  // submitChat always dispatched to; what's left here is only what's
  // genuinely the Hub's: the bubble, the walk-hold, the calendar charge,
  // the live hot-topic list, and persisting the NPC.
  //
  // Behaviour is unchanged verb for verb, checked against the pre-extraction
  // bodies line by line: the same deltas, the same Insult ladder (Tier 2 →
  // "insulted" topic + stress bump, Tier 3 → refusesDeployment, never
  // cleared here), Congratulate's anti-farming "for what?" refusal (no log,
  // no charge, no save — exactly as before), Flirt's close-friend-only
  // redirect (logged and charged, as before), Send-Off's
  // preMissionSendOff write. The Hub passes repeatIndex 0 always — the
  // diminishing-returns rule is a mission-chat rule (see the module
  // header), not a Hub one.
  private applySocialVerb(npc: HubNpc, verb: SocialVerb) {
    const result = resolveSocialVerb(
      this.campaignState,
      {
        pilotId: npc.pilotId,
        displayName: npc.displayName,
        catalyst: npc.ambient.catalyst,
        romanceable: npc.romanceable,
        seed: { favorability: npc.favorability, stress: npc.ambient.stress, morale: npc.ambient.morale },
      },
      verb,
      { hotTopics: this.hotTopics, now: Date.now() }
    );
    // The persisted object is the source of truth now; the NPC mirrors it.
    npc.favorability = result.favorability;
    npc.ambient = { ...npc.ambient, stress: result.stress, morale: result.morale };
    // Keep the NPC's log the same array the save holds (an old save whose
    // social entry predated socialLog gets one minted by the resolver).
    npc.socialLog = ensureHubSocialState(this.campaignState, npc.pilotId, { favorability: npc.favorability, stress: npc.ambient.stress, morale: npc.ambient.morale }).socialLog;
    if (result.hotTopic) this.hotTopics.push(result.hotTopic);
    this.showBubble(npc, result.line, this.time.now);
    this.holdForPlayerTalk(npc);
    if (!result.logged) return; // Congratulate's "for what?" — nothing happened, nothing to charge or save
    if (applyVerbDayCost(this.campaignState, verb)) this.refreshCalendarReadout();
    this.persistNpcSocial(npc);
    if (result.sendOff) {
      // Hub-side payoff only this pass; the real in-Battle tactical bonus is
      // consumed by Battle.ts's resolveDeployRoster on the next launch —
      // see CampaignState.preMissionSendOff's own comment.
      this.campaignState.preMissionSendOff = { pilotId: npc.pilotId, grantedAt: Date.now() };
      saveCampaignState(this.campaignState);
    }
  }

  private giveGift(npc: HubNpc) {
    this.applySocialVerb(npc, "gift");
  }

  private praiseNpc(npc: HubNpc) {
    this.applySocialVerb(npc, "praise");
  }

  // Flirt, 12 Sep 2026 (Maxime: "Allow cute to be a flirt word... I could
  // say you are cute to a npc and itl raise fav") — a flat, guaranteed-
  // positive nudge, same mechanical shape as Praise; never touches
  // inRelationship, never has a rejection branch, never starts a real
  // relationship. The literal proposal phrasing ("ask her out") still goes
  // through askOut() below completely unchanged. Shares Ask Out's
  // romanceable-species cap (Hiopi/Carabil at close-friend) — Maxime's own
  // call via AskUserQuestion: flirting is romantic in nature, so it should
  // respect the same cap Ask Out does, unlike Praise, which works on
  // literally anyone.
  private flirtWithNpc(npc: HubNpc) {
    this.applySocialVerb(npc, "flirt");
  }

  // Insult — Praise/Insult/Apology Proposal v1 §3, the escalation ladder.
  // Maxime's own resolution of §3a: "wont fly with you, player will have to
  // ask co to remove them from ship" — the resolver only ever SETS
  // refusesDeployment, never clears it; only handleRemovePilotRequest below
  // (a deliberate CO conversation) can resolve the standoff.
  private insultNpc(npc: HubNpc) {
    this.applySocialVerb(npc, "insult");
  }

  private apologizeToNpc(npc: HubNpc) {
    this.applySocialVerb(npc, "apology");
  }

  private congratulateNpc(npc: HubNpc) {
    this.applySocialVerb(npc, "congratulate");
  }

  private sendOffNpc(npc: HubNpc) {
    this.applySocialVerb(npc, "sendOff");
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
      this.holdForPlayerTalk(npc);
      return;
    }
    if (outcome.result === "closeFriendOnly") {
      const line = CLOSE_FRIEND_ONLY_LINES[Math.floor(Math.random() * CLOSE_FRIEND_ONLY_LINES.length)];
      this.showBubble(npc, line, now);
      this.holdForPlayerTalk(npc);
      npc.socialLog = npc.socialLog ?? [];
      this.logVerbAndCharge(npc, { verb: "askOut", line, at: Date.now() });
      this.persistNpcSocial(npc);
      return;
    }

    npc.favorability += outcome.favorabilityDelta;
    if (outcome.result === "accepted") {
      npc.inRelationship = true;
      // Stress & Morale Trigger Proposal, 1 Sep 2026 — "Ask Out accepted ->
      // Morale gain." Proposed symmetric for both parties, but the asker
      // (the player/MC) has no walkable, ambient-tracked social state of
      // her own in this scene (verbs.ts's own header: "Actor isn't
      // modeled... always the MC") — applied to the accepting NPC only,
      // same honest scope limit the rejection branch below hits too.
      npc.ambient = { ...npc.ambient, morale: Math.max(0, Math.min(100, npc.ambient.morale + 10)) };
      const line = pickLineForMessage(npc.ambient, { kind: "emotion", echo: "love" });
      this.showBubble(npc, line, now);
      this.holdForPlayerTalk(npc);
      npc.socialLog = npc.socialLog ?? [];
      this.logVerbAndCharge(npc, { verb: "askOut", line, at: Date.now() });
      // Emotional Brain, 12 Sep 2026 — carried as warmth. Written before
      // persistNpcSocial so its save carries the memory too.
      recordMemory(this.campaignState, npc.pilotId, { kind: "asked_out", echo: "love", witnesses: this.roomWitnesses(npc) });
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
      // Real rumor, not just a HotTopic, 9 Sep 2026 — an accepted Ask Out
      // used to only ever be mentionable if you happened to talk to
      // someone who already knew. Now it ripples the same way a rejection
      // always has (same propagate() pipeline, same "a different NPC
      // starts it" shape, now shared with runNpcEncounter's own NPC-NPC
      // version via startNpcAskOutRumor), just with happy content instead
      // of sting. Passing npc.pilotId as both exclusions since there's
      // only one real NPC in a player-Ask-Out pair — the asker is the
      // player, never a candidate to exclude twice for.
      {
        const mcRecord = this.campaignState.pilots[this.f.profile.mc.pilotId]?.pilot;
        const askerName = mcRecord ? mcRecord.displayName.split("—")[0].trim() : "The Commander";
        const targetName = npc.displayName.split("—")[0].trim();
        this.startNpcAskOutRumor(askerName, targetName, "accepted", npc.pilotId, npc.pilotId);
      }
      return;
    }

    // Rejected — the direct reaction happens on her, right now, in her own
    // voice (sadness reads as a wistful decline better than anger here).
    // Stress & Morale Trigger Proposal, 1 Sep 2026 — the proposal's own
    // "small Stress tick for the asker only" is NOT applied here on
    // purpose: the asker is the player/MC, who has no walkable, ambient-
    // tracked Stress of her own in this scene (same gap the accepted
    // branch above flags). Not silently dropped — a real follow-up once
    // the player's own social state has somewhere to live.
    const rejectLine = pickLineForMessage(npc.ambient, { kind: "emotion", echo: "sadness" });
    this.showBubble(npc, rejectLine, now);
    this.holdForPlayerTalk(npc);
    npc.socialLog = npc.socialLog ?? [];
    this.logVerbAndCharge(npc, { verb: "askOut", line: rejectLine, at: Date.now() });
    // Emotional Brain, 12 Sep 2026 — a declined ask is still something she
    // carries, and it reads as sadness, same echo her own line just used.
    recordMemory(this.campaignState, npc.pilotId, { kind: "asked_out", echo: "sadness", witnesses: this.roomWitnesses(npc) });
    this.persistNpcSocial(npc);

    // Then, separately, word starts moving — same shape as startRumor()'s
    // debug version (a different NPC starts the gossip, not the rejector
    // herself, since her own in-voice reaction just happened above), but
    // with the real asker/rejector names instead of a fabricated pair.
    // Shares startNpcAskOutRumor with the accepted branch above and with
    // runNpcEncounter's own NPC-NPC version, 9 Sep 2026 — same reasoning
    // as that branch's own comment for passing npc.pilotId twice.
    const mcRecord = this.campaignState.pilots[this.f.profile.mc.pilotId]?.pilot;
    const askerName = mcRecord ? mcRecord.displayName.split("—")[0].trim() : "The Commander";
    const targetName = npc.displayName.split("—")[0].trim();
    this.startNpcAskOutRumor(askerName, targetName, "rejected", npc.pilotId, npc.pilotId);
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
    return this.f.reservedBays.find((b) => b.id === bayId)!.label.replace("\n(reserved)", "").replace(/\n/g, " ");
  }

  // Recognized, but no space carved out yet — see chatIntent.ts's own
  // KnownUnbuildableId header for why these two specifically get an honest
  // "not yet" instead of either silence or a fabricated build. weaponsBay/
  // fabricator GRADUATED out of this bank 28 Aug 2026 once real deck space
  // (RESERVED_BAYS above) and real effects existed for them — see
  // chatIntent.ts's own BuildableBayId comment for the same graduation
  // noted from that file's side. heads/berths joined 3 Sep 2026 for the
  // opposite reason recRoom is here: not "not built yet," but "already
  // built, nothing to build" — the ship interior pass gave both a real
  // room with no economy meaning at all, so there's no bayId/RESERVED_BAYS
  // entry for either and never will be.
  private readonly BUILD_UNAVAILABLE_LINES: Record<KnownUnbuildableId, string[]> = {
    recRoom: ["Rec Room's already up and running — you'll find it on the lower deck."],
    mekWorkshop: ["A proper workshop for the Meks — I like it. Nobody's drawn that one up yet, though."],
    heads: ["Heads are already standing — forward row, lower deck. Nothing to build there."],
    berths: ["Every lance already has its own berths, Commander — forward row, lower deck, one bunk room each."],
  };

  private handleBuildRequest(request: BuildRequest) {
    const co = this.npcs.find((n) => n.pilotId === CO_PILOT_ID);
    if (!co) return; // shouldn't happen — the CO exists the moment buildNpcs() runs
    const now = this.time.now;

    if (request.kind === "unbuildable") {
      this.showBubble(co, this.pickBuildLine(this.BUILD_UNAVAILABLE_LINES[request.id]), now);
      this.holdForPlayerTalk(co);
      return;
    }

    const bayId = request.id;
    const bayName = this.buildLine(bayId);
    const built = this.campaignState.builtBays ?? [];

    if (built.includes(bayId)) {
      this.showBubble(co, `${bayName}'s already standing, Commander.`, now);
      this.holdForPlayerTalk(co);
      return;
    }

    // Generator dependency (claude/Bloom_Wars_Beacon_Restock_Economy_v1.md
    // §6, enforced 4 Sep 2026 — Maxime, asked whether to build this for
    // real: "Sadly we need it enforced. Its gotta be something plsyer chose
    // to spend they company point on."). Checked at CONSTRUCTION time,
    // here, rather than only at point-of-use in a mission: refusing the
    // build itself (not just quietly letting a player build a bay that
    // does nothing yet) is what makes the Generator a real, felt choice —
    // "something player chose to spend their company points on" — instead
    // of an easy-to-miss prerequisite buried in a tooltip. The list of
    // which bays draw power moved out of this file on 7 Sep 2026, when
    // Weapons Bay and Sensor Array joined Beacon Control and Restock Room
    // behind the gate (Maxime: "better fix those two buildable room") —
    // engine/campaignEconomy.ts's GENERATOR_DEPENDENT_BAYS is the rule and
    // its own comment is the record of what's gated and what isn't
    // (Fabricator, still, deliberately). This scene owns only the CO's line.
    if (bayNeedsGeneratorFirst(bayId, built)) {
      this.showBubble(co, `${bayName} needs power first, Commander — get the Generator built before that one.`, now);
      this.holdForPlayerTalk(co);
      return;
    }

    const rank = this.campaignState.rourkeRank;
    if (built.length >= RANK_BAY_SLOTS[rank]) {
      this.showBubble(co, `Not at your rank yet — a ${rankDisplayTitle(rank)} doesn't get the space for that. Wait for the next bar.`, now);
      this.holdForPlayerTalk(co);
      return;
    }

    const cost = BAY_BUILD_COST[bayId];
    if (this.campaignState.points < cost) {
      this.showBubble(co, `We don't have the material for that yet. ${bayName} runs ${cost}, and we're sitting on ${this.campaignState.points}.`, now);
      this.holdForPlayerTalk(co);
      return;
    }

    this.campaignState.points -= cost;
    this.campaignState.builtBays = [...built, bayId];
    saveCampaignState(this.campaignState);
    this.markBayBuilt(bayId);
    this.showBubble(co, `Approved. ${bayName}, logged and building.`, now);
    this.holdForPlayerTalk(co);
  }

  // Debrief request — CO-specific, 2 Sep 2026. Reuses the exact mission-
  // echo content already built for the ambient hot-topics system
  // (checkMissionEcho above/HOT_TOPIC_LINES' own missionWin/missionLoss
  // banks) rather than writing new CO-bespoke lines — Maxime's own "for
  // now" scoping this pass to a CO-only redirect, not new content.
  // Deliberately independent of that ambient system's own one-shot
  // `announced` flag and HOT_TOPIC_SPEAK_CHANCE roll: those two gate
  // whether some RANDOM nearby NPC happens to bring the outcome up
  // unprompted, which has nothing to do with the player walking up and
  // asking the CO directly — asking should always get a real answer, never
  // silently miss because some other NPC already gossiped about it once,
  // or because this roll happened to miss.
  private handleDebriefRequest() {
    const co = this.npcs.find((n) => n.pilotId === CO_PILOT_ID);
    if (!co) return; // shouldn't happen — the CO exists the moment buildNpcs() runs
    const now = this.time.now;
    const echo = this.campaignState.lastMissionEcho;
    if (!echo) {
      this.showBubble(co, "Nothing to report yet — you haven't flown a mission.", now);
      this.holdForPlayerTalk(co);
      return;
    }
    // Same HotTopic shape checkMissionEcho itself constructs (kind derived
    // from echo.outcome, aboutPilotId holding the mission's own id as a
    // sentinel — see hotTopics.ts's own header for why a mission-outcome
    // topic still needs one). Built fresh here rather than reused from
    // this.hotTopics: this is a direct, deliberate ask, not gossip pulled
    // from the shared ambient pool, so it doesn't consume or depend on
    // whatever's sitting in that array.
    const topic: HotTopic = {
      kind: echo.outcome === "win" ? "missionWin" : "missionLoss",
      aboutPilotId: echo.missionId,
      aboutName: "",
      at: Date.now(),
      mentionedBy: [],
    };
    const line = renderHotTopicLine(topic, co.ambient.catalyst);
    this.showBubble(co, line, now);
    this.holdForPlayerTalk(co);
  }

  // Brief request — CO-specific, 2 Sep 2026, split off from Debrief just
  // above (playtest tally item 7: brief is PRE-mission, debrief is POST-
  // mission, and they used to be the same request). Originally an honest
  // placeholder line ("No formal briefing drawn up yet...") — replaced 4
  // Sep 2026, Codex Rebuild & Live Briefing Plan v1 Part B, with a real,
  // live briefing: nextWardenMission derives which mission is next from
  // the save's own lastMissionEcho (data/missionBriefing.ts), and
  // openMissionBriefing shows that mission's own narrative `briefing` text,
  // a plain-English objective line, and a composition/count-only passive
  // scan — a Freespace-style full panel, not a chat bubble (Maxime's own
  // confirmed shape, AskUserQuestion, same day).
  private handleBriefRequest() {
    const co = this.npcs.find((n) => n.pilotId === CO_PILOT_ID);
    if (!co) return; // shouldn't happen — the CO exists the moment buildNpcs() runs
    const mission = this.f.profile.nextMission(this.campaignState.lastMissionEcho);
    if (!mission) {
      const now = this.time.now;
      this.showBubble(co, "Every mission on the board's flown, Rourke. Command hasn't cut new orders yet.", now);
      this.holdForPlayerTalk(co);
      return;
    }
    this.openMissionBriefing(mission);
  }

  // Confide, 2 Sep 2026 — Antfarm Carrier Hub v1 §11.3's long-flagged grotto
  // stress-relief hook, finally content-backed. The first real slice of the
  // MC (player character) having their own persisted state at all — see
  // CampaignState.mcStress's own comment for the full gap this closes.
  // Deliberately minimal: one number, moved by one interaction, no UI yet
  // reading it back — just enough for this one interaction to mean
  // something rather than being pure flavor.
  private handleConfideRequest() {
    const co = this.npcs.find((n) => n.pilotId === CO_PILOT_ID);
    if (!co) return; // shouldn't happen — the CO exists the moment buildNpcs() runs
    const now = this.time.now;
    const before = this.campaignState.mcStress ?? MC_STRESS_DEFAULT;
    this.campaignState.mcStress = Math.max(0, before + CONFIDE_STRESS_DELTA);
    saveCampaignState(this.campaignState);
    this.showBubble(co, pickCoConfideLine(), now);
    this.holdForPlayerTalk(co);
  }

  // Remove-pilot, 2 Sep 2026 — the Insult Tier-3 resolution, and the only
  // way that standoff ever ends. Maxime's own words: "wont fly with you,
  // player will have to ask co to remove them from ship." Sets
  // CampaignPilotEntry.status to "reassigned" (never "permanently_lost" —
  // this pilot is alive and fine, just off this ship) and drops them out of
  // this.npcs so they stop appearing in the Hub. Named targeting
  // (extractNamedTarget) disambiguates when more than one pilot is
  // currently in the standoff; with exactly one, no name is required.
  private handleRemovePilotRequest(raw: string) {
    const co = this.npcs.find((n) => n.pilotId === CO_PILOT_ID);
    if (!co) return; // shouldn't happen — the CO exists the moment buildNpcs() runs
    const now = this.time.now;
    const flagged = Object.values(this.campaignState.pilots).filter((e) => e.status === "active" && e.social?.refusesDeployment);
    if (flagged.length === 0) {
      this.showBubble(co, "I don't have anyone that needs reassigning right now.", now);
      this.holdForPlayerTalk(co);
      return;
    }
    const namedId = extractNamedTarget(
      raw,
      flagged.map((e) => ({ pilotId: e.pilot.id, displayName: e.pilot.displayName }))
    );
    const target = namedId ? this.campaignState.pilots[namedId] : flagged.length === 1 ? flagged[0] : undefined;
    if (!target) {
      this.showBubble(co, "Who, specifically? I've got more than one pilot in that state right now.", now);
      this.holdForPlayerTalk(co);
      return;
    }
    target.status = "reassigned";
    saveCampaignState(this.campaignState);
    const name = target.pilot.displayName.split("—")[0].trim();
    const npcIndex = this.npcs.findIndex((n) => n.pilotId === target.pilot.id);
    if (npcIndex !== -1) this.npcs.splice(npcIndex, 1);
    this.showBubble(co, `Done. ${name}'s reassigned off the ship, effective now. Hope it was worth it.`, now);
    this.holdForPlayerTalk(co);
  }

  // --- Social history view — Hub polish, 26 Aug 2026 --------------------
  // Read-only, no engine state of its own — every socialLog entry already
  // existed and was already persisted (campaignState.ts section 11); this
  // is purely "read it back out and show it." Built once, up front, same
  // convention as the three minigame overlays, then shown/hidden and
  // re-rendered on open — but with no per-frame update loop of its own,
  // since nothing here animates or accepts input beyond the close button.
  // The Workshop bench panel, 2 Sep 2026 — Carrier Upgrade Modules.
  // Same container/bg/close-button shape as buildHistoryOverlay below,
  // deliberately: this scene already has a settled idiom for "a panel that
  // owns the screen until Esc," and a new room is not a reason to invent a
  // second one. The one structural difference is that the rows here are
  // interactive (each buyable module is a click target), so unlike the
  // history panel's single text object the rows are rebuilt on each render
  // rather than written once — a purchase changes what every other row can
  // afford, so there is no partial redraw that would be correct.
  private buildWorkshopOverlay() {
    // STANDING RULE for every overlay in this file, learned the hard way on
    // 3 Sep 2026 — pinning the CONTAINER is only half of it. Phaser renders
    // a container's children using the container's scroll factor, but
    // hit-tests each child using only that CHILD's own (see InputManager.
    // hitTest's `px = worldX + csx * gameObject.scrollFactorX - csx`
    // against ContainerWebGLRenderer's `child.setScrollFactor(childSF *
    // containerSF)`). So an interactive child left at the default factor of
    // 1 inside a pinned container DRAWS in the right place and takes clicks
    // somewhere else — off by exactly the camera's scroll. Panel.ts's own
    // frame/chrome already carries .setScrollFactor(0) on every interactive
    // piece it builds; this note is for anything Workshop-specific added
    // INSIDE the panel from here on (renderWorkshop's own rows already do —
    // see makeShopButton's call sites there). tsc, eslint and the whole
    // unit suite all pass clean either way, so nothing but a live
    // click-test catches a missed one (tools/verify/
    // checkHubInteractionAfterScroll.mjs is that test).
    //
    // 10 Sep 2026 (UI Prettiness Pass v1) — this used to hand-build a
    // container + background rectangle + close button here, the exact
    // shape ui/Panel.ts now exists to share across every overlay in this
    // file rather than reinvent. Same ROOM_BOUNDS footprint as before,
    // same depth 60, same "[ close — Esc ]" control — only where that code
    // lives changed.
    this.workshopPanel = new Panel(
      this,
      { left: ROOM_BOUNDS.left, right: ROOM_BOUNDS.right, top: ROOM_BOUNDS.top, bottom: ROOM_BOUNDS.bottom },
      () => this.closeWorkshop(),
      {
        title: "THE WORKSHOP — CARRIER UPGRADE MODULES",
        showTooltip: (obj, lines) => this.wireHoverTip(obj, lines),
        closeTooltipBody: "Back to the Hub floor. Anything you've bought here is already applied — there's no separate save step.",
      }
    );
  }

  /**
   * Hub Hints & Orientation (`Bloom_Wars_Hub_Hints_And_Orientation_Scoping_
   * v1_11Sep2026.md`), built 11 Sep 2026 per Maxime's own answers to that
   * doc's §3: shape = contextual (each hint below fires on its own real
   * first-time trigger, not a forced 0-to-5 order — see HubHintId's own
   * comment in campaignState.ts for why that's a flat set rather than a
   * step counter), coverage = everything in that doc's §1 list plus Vault/
   * Archive/Rec Room, and it shares TUTORIAL_HINTS_ENABLED_KEY's own
   * Options toggle (areTutorialHintsEnabled() below) rather than getting a
   * second switch.
   *
   * Deliberately reactive at every call site (fires right as the real
   * action happens — opening Roster & Gear, walking into Talk range, etc.)
   * rather than proactive. The scoping doc's own §2 sketched the Roster &
   * Gear hint as shown on Hub entry and dismissed once the player reaches
   * that room instead; simplified here to "shown once actually reached,"
   * since that needed no extra per-frame proximity watch and nothing that
   * could leak across a scene restart — at the real cost of not pointing a
   * player toward that room before they'd find it on their own. Worth
   * revisiting after an actual playtest rather than assumed to be enough.
   *
   * One shared banner, not a queue: if a second hint fires while the first
   * is still showing (unlikely — these are spread-out, rare first-time
   * actions — but not impossible back to back), the new one simply
   * replaces the old rather than waiting behind it.
   */
  private showHubHint(id: HubHintId, lines: string[]) {
    if (!areTutorialHintsEnabled() || hasSeenHubHint(id)) return;
    markHubHintSeen(id);
    this.hubHintBanner?.destroy();
    const width = 700;
    const text = this.add
      .text(0, 0, lines.join("\n"), {
        fontFamily: "monospace",
        fontSize: "12px",
        color: TEXT_MAIN,
        align: "center",
        wordWrap: { width: width - 28 },
      })
      .setOrigin(0.5);
    const bg = this.add.rectangle(0, 0, width, text.height + 20, 0x141a20, 0.92).setStrokeStyle(1, 0x4a7a9a);
    const banner = this.add.container(480, 78, [bg, text]).setScrollFactor(0).setDepth(HUB_HUD_DEPTH);
    this.hubHintBanner = banner;
    this.time.delayedCall(7000, () => {
      if (this.hubHintBanner === banner) this.hubHintBanner = null;
      banner.destroy();
    });
  }

  /**
   * Wraps the four hints (roster/vault/archive/rec_room) whose OWN trigger
   * opens something that would otherwise cover this banner before the
   * player ever saw it: Roster & Gear, the Vault, and every Rec Room game
   * render their overlay at depth 60 (see hangarShopOverlay/pegOverlay/
   * pokerOverlay/dartsOverlay above), the Archive is a whole separate
   * scene brought to the top of the draw order — either way, well above
   * this scene's own pinned depth-20 HUD text. First time ever (hints on,
   * this id not yet seen): show the banner against the plain Hub, hold
   * `after` for one beat so it's actually readable, then run it. Every
   * later call — this session or any future one — runs `after`
   * immediately, no added delay. crew_talk doesn't need this wrapper: an
   * NPC speech bubble doesn't cover the top of the screen the way a
   * full panel or a whole other scene does.
   */
  private gateFirstHubHint(id: HubHintId, lines: string[], after: () => void) {
    if (areTutorialHintsEnabled() && !hasSeenHubHint(id)) {
      this.showHubHint(id, lines);
      this.time.delayedCall(900, after);
      return;
    }
    after();
  }

  private openWorkshop() {
    this.workshopOpen = true;
    this.workshopPanel.open();
    this.renderWorkshop();
  }

  private closeWorkshop() {
    this.workshopOpen = false;
    this.workshopPanel.close();
  }

  /**
   * Rebuild the module list. Called on open and after every purchase.
   *
   * Rows are destroyed and recreated wholesale rather than updated in
   * place — the list is at most seven rows, and a purchase changes the
   * affordability of every OTHER row, so a targeted update would have to
   * touch nearly all of them anyway. workshopPanel.clearContent() is the
   * accumulate-once pool that gets cleared here (workshopRows' own hand-
   * tracked array, before 10 Sep 2026's UI Prettiness Pass); see
   * Battle.ts's actionSlots for the same discipline and the bug that taught
   * it.
   */
  private renderWorkshop() {
    // 10 Sep 2026 (UI Prettiness Pass v1) — workshopRows' destroy-and-clear
    // loop is now workshopPanel.clearContent() (same wholesale-rebuild
    // discipline, Panel just owns the bookkeeping); `add` now delegates to
    // Panel.add() instead of pushing onto a hand-tracked array.
    this.workshopPanel.clearContent();

    const owned = this.campaignState.builtModules ?? [];
    const points = this.campaignState.points;
    const add = (obj: Phaser.GameObjects.GameObject) => this.workshopPanel.add(obj);

    // The title used to be the first row of this rebuilt stack (destroyed
    // and redrawn every render for no reason — it's static text). Panel now
    // draws it once, fixed, in its own header — see buildWorkshopOverlay —
    // the same fixed-header move Vault's own 6 Sep 2026 scroll fix already
    // made for its own title; Workshop just never had a reason to catch up
    // until this pass touched it too.
    add(
      this.add
        .text(480, ROOM_BOUNDS.top + 46, `Company points: ${points}    (gear, tiers and spare parts are at the Hangar Deck console)`, {
          fontFamily: "monospace",
          fontSize: "11px",
          color: TEXT_DIM,
        })
        .setOrigin(0.5, 0),
    );

    let y = ROOM_BOUNDS.top + 80;
    for (const id of Object.keys(CARRIER_MODULES) as CarrierModuleId[]) {
      const def = CARRIER_MODULES[id];
      const isOwned = owned.includes(id);
      const affordable = points >= def.cost;
      // Three states, three colours: installed (dim green, done), buyable
      // (full white, clickable), too expensive (grey, deliberately still
      // shown so the player can see what they're saving toward).
      const color = isOwned ? "#7aa87a" : affordable ? TEXT_MAIN : "#5a6572";
      const suffix = isOwned ? "INSTALLED" : `${def.cost} pts`;
      const row = this.add
        .text(200, y, `${def.displayName}  —  ${suffix}`, { fontFamily: "monospace", fontSize: "12px", color })
        .setOrigin(0, 0);
      if (!isOwned && affordable) {
        // .setScrollFactor(0) alongside .setInteractive, 3 Sep 2026 — see
        // buildWorkshopOverlay's own close button for the full reasoning.
        // These rows are rebuilt on every render, so pinning them here, at
        // creation, is what keeps them clickable across rebuilds; a
        // one-time sweep over the container would only ever fix whichever
        // batch happened to exist when it ran.
        row.setInteractive({ useHandCursor: true }).setScrollFactor(0);
        row.on("pointerdown", () => this.buyCarrierModule(id));
        // Tooltip Coverage pass, 12 Sep 2026 — rebuilt fresh every
        // renderWorkshop() call same as the row itself (see this loop's own
        // header comment on why), so this can just read def/points straight
        // out of the closure instead of needing any dynamic-update path.
        this.wireHoverTip(row, [
          "INSTALL",
          "",
          ...wrapTipText(`Spends ${def.cost} Company points to permanently install ${def.displayName} on the carrier. Ship-wide, not tied to one pilot.`, 42),
        ]);
      }
      add(row);
      add(
        this.add
          .text(212, y + 16, def.effect, { fontFamily: "monospace", fontSize: "10px", color: TEXT_DIM, wordWrap: { width: 520 } })
          .setOrigin(0, 0),
      );
      y += 52;
    }

    // The designed-but-unsellable four. Shown rather than hidden so the
    // room reads as "four of these are waiting on something" instead of
    // silently pretending the design is only three modules long — and each
    // carries its real reason, not a generic "coming soon."
    y += 10;
    add(
      this.add
        .text(200, y, "NOT YET AVAILABLE", { fontFamily: "monospace", fontSize: "11px", color: TEXT_DIM }).setOrigin(0, 0),
    );
    y += 20;
    for (const locked of LOCKED_MODULES) {
      add(
        this.add
          .text(212, y, `${locked.displayName} — ${locked.reason}`, { fontFamily: "monospace", fontSize: "10px", color: "#5a6572", wordWrap: { width: 520 } })
          .setOrigin(0, 0),
      );
      y += 18;
    }
  }

  /**
   * Buy a module, then redraw. All the actual rules live in
   * engine/campaignEconomy.ts's purchaseCarrierModule — this scene only
   * reports the outcome, the same division every other purchase path in
   * this file keeps (see handleBuildRequest, which is the closest
   * comparable: company pool, permanent, CO-voiced).
   */
  private buyCarrierModule(id: CarrierModuleId) {
    const result = purchaseCarrierModule(this.campaignState, id);
    if (!result.ok) {
      this.showFallback(result.reason ?? "That can't be installed right now.");
      return;
    }
    saveCampaignState(this.campaignState);
    this.renderWorkshop();
  }

  // --- The Vault — Phase 1 (the counter) + Phase 3 (the wall), 2 Sep 2026 -
  // Vault_Build_Plan_v1.md. Same container/bg/close-button construction as
  // buildWorkshopOverlay above; renderVault follows renderWorkshop's own
  // "destroy and rebuild every row, don't update in place" discipline for
  // the same reason (a recruit changes the shortlist, the house standing,
  // AND the holdings list all at once — a targeted update would touch
  // nearly everything anyway).
  //
  // Phase 2 (the shelf — fielding, ability ranks), slice 2, 3 Sep 2026. The
  // original call above stands for most of the pool: 23 of ~28 abilities
  // still don't fire in combat, so a rank-up shop for those would read as
  // broken rather than finished. What changed is Vault Phase 2 Slice 1
  // (2 Sep 2026) wired exactly 5 abilities — one apiece on Widow's Ledger,
  // The Iron Oath, The Last Word, Delenda and Farsight's Reckoning — into
  // real combat effects (engine/mission.ts, engine/combat.ts). Building a
  // shop that only ever offers those 5 as purchasable, with everything else
  // shown but explicitly marked "not implemented in combat yet" (same
  // refusal-is-honest discipline recruitHeirloom's own sentences already
  // use), is a real, truthful Phase 2 rather than the all-or-nothing version
  // the plan doc originally weighed. HEIRLOOM_ABILITIES_LIVE_IN_COMBAT
  // (data/heirlooms.ts) is the single source of truth for which 5 those
  // are — never a second hand-copied list here.
  private buildVaultOverlay() {
    // 10 Sep 2026 (UI Prettiness Pass v1) — this used to hand-build its own
    // container/background/mask/close-button/title, duplicating
    // buildWorkshopOverlay's own shape with the scroll wiring the 6 Sep
    // Vault scroll fix added on top. ui/Panel.ts's own `scrollable` option
    // now does exactly what the old vaultContentLayer + maskShape +
    // vaultScrollMinY trio did (see that class's setContentExtent/scrollBy),
    // and `extraHeader` gives the memorial link below the same "outside the
    // scrolling well, in the fixed row" placement the old code needed a
    // dedicated container split to get.
    this.vaultPanel = new Panel(
      this,
      { left: ROOM_BOUNDS.left, right: ROOM_BOUNDS.right, top: ROOM_BOUNDS.top, bottom: ROOM_BOUNDS.bottom },
      () => this.closeVault(),
      {
        title: "THE VAULT — HOUSE OFFERS & STANDING",
        scrollable: true,
        showTooltip: (obj, lines) => this.wireHoverTip(obj, lines),
        closeTooltipBody: "Back to the Hub floor. Anything you've claimed or spent here is already applied — there's no separate save step.",
        // B3 — the way into the roll of pilots lost. Same reasoning as
        // before this pass: built in the fixed header row opposite the
        // close button, not in renderVault's own rebuilt content stack, so
        // it neither grows on every render nor ever scrolls off. See
        // MemorialPanel's own header for the button it opens.
        extraHeader: (bounds, add) => {
          // Was bounds.top + 20 — the exact same row as the title text
          // above (bounds.left+18, bounds.top+20 in Panel.ts), so the two
          // overlapped letter-on-letter. Caught live, 10 Sep 2026 (Maxime,
          // screenshot). Panel.ts now reserves a second row for this when
          // extraHeader is set (see its own headerExtra comment); this
          // moves down into that row.
          const memorialBtn = this.add
            .text(bounds.left + 20, bounds.top + 34, "[ the roll — pilots lost ]", { fontFamily: "monospace", fontSize: "11px", color: "#c17a6a" })
            .setOrigin(0, 0.5)
            .setInteractive({ useHandCursor: true })
            .setScrollFactor(0);
          memorialBtn.on("pointerdown", () => this.openMemorial());
          // Tooltip Coverage pass, 12 Sep 2026.
          this.wireHoverTip(memorialBtn, ["THE ROLL", "", ...wrapTipText("Every pilot your company has lost this campaign, one by one.", 42)]);
          add(memorialBtn);
        },
      }
    );

    // One mouse-wheel handler for the whole scene, same idiom and the same
    // re-create()-accumulation caution as MapSelect.ts's own listener
    // (Hub.create() re-runs every time the player leaves and comes back via
    // scene.start("Hub"), so this has to be reset, not stacked). Guarded on
    // vaultOpen so it's a no-op whenever the Vault isn't the thing on
    // screen; the actual clamp math now lives in vaultPanel.scrollBy.
    this.input.off("wheel");
    this.input.on("wheel", (_pointer: unknown, _over: unknown, _dx: number, dy: number) => {
      if (!this.vaultOpen) return;
      this.vaultPanel.scrollBy(dy);
    });
  }

  private openVault() {
    // Hub Hints & Orientation, 11 Sep 2026 — same "the panel this opens
    // would cover the hint instantly" fix as openHangarShop() above; see
    // gateFirstHubHint's own header.
    this.gateFirstHubHint(
      "vault",
      ["THE VAULT", "Tracks your standing with Heirloom-bonded houses and their offers — a slower, separate track from ordinary recruiting."],
      () => this.finishOpenVault()
    );
  }

  private finishOpenVault() {
    this.vaultOpen = true;
    this.vaultPanel.open(); // walking up fresh always starts at the top of the list — Panel.open() resets scroll to 0 itself
    this.renderVault();
  }

  /**
   * LAUNCH, not start. Every other screen this Hub opens replaces it and
   * rebuilds the whole floor on the way back; the Archive pauses the Hub
   * underneath instead, so the player is standing exactly where they left
   * off at the table when they close it (decided 7 Sep, Q4). First scene in
   * the game to return this way — Archive.leave() resumes this one by key.
   */
  private openArchive() {
    // Hub Hints & Orientation, 11 Sep 2026 — the Archive scene gets
    // bringToTop'd over the whole canvas a few lines below, which would
    // cover the hint instantly; see gateFirstHubHint's own header for the
    // one-beat hold that fixes it.
    this.gateFirstHubHint(
      "archive",
      ["THE ARCHIVE", "Your reference library — personnel dossiers, service records, and the wider world lore, all in one place."],
      () => this.finishOpenArchive()
    );
  }

  private finishOpenArchive() {
    this.scene.launch("Archive", { state: this.campaignState, returnScene: this.scene.key });
    // bringToTop is NOT optional here, and its absence is invisible until you
    // look at the screen. A PAUSED Phaser scene still RENDERS — pause only
    // stops update() — and scenes draw in the order main.ts lists them, where
    // Hub comes after Archive. Without this the Archive is launched, is
    // active, is receiving input, and is drawn underneath the Hub, which
    // reads to a player as "the button does nothing."
    this.scene.bringToTop("Archive");
    this.scene.pause();
  }

  private closeVault() {
    this.vaultOpen = false;
    this.vaultPanel.close();
  }

  /**
   * The dedication scene's own hand-authored text (Vault_Build_Plan_v1
   * Phase 4 — "hand-authored with named slots," not procedural). Three
   * variants, picked by resolveVaultDedication's own already-resolved
   * choice (state.vaultDedication.fallenId), never re-derived here: this
   * function only ever renders a decision that was already made and
   * stored, same read-only relationship every other render* function in
   * this class has to campaign state.
   */
  private vaultDedicationText(fallenId: string | undefined): string {
    if (!fallenId) {
      return (
        'Everyone walks off the Fallow Line. Gjallar stays where it has always been — with Bosk, cased, unsounded.\n\n' +
        "Some campaigns don't get a Requiem. This one, so far, doesn't need one."
      );
    }
    if (fallenId === "pilot_bosk") {
      return (
        "Gjallar doesn't make a sound until Bosk goes down covering the gate. Then it does. Once. The kind of quiet after that you don't come back from clean.\n\n" +
        "Anvil never explained a thing twice. He's not here to say it a third time, so I'm keeping the weapon and the habit both."
      );
    }
    const entry = this.campaignState.pilots[fallenId];
    const name = entry ? entry.pilot.displayName.split("—")[0].trim() : "one of ours";
    return (
      `${name} doesn't make it out of the Fallow Line. Bosk does. Somebody still has to carry what Gjallar means, and nobody in this company argues when it lands on me instead of him.\n\n` +
      "I didn't expect to be the one holding it. I am now."
    );
  }

  /**
   * Rebuild the Vault panel. Called on open and after every recruit — same
   * wholesale-rebuild discipline renderWorkshop already documents on its
   * own, for the same reason: a recruit changes the shortlist, the
   * standing, AND the holdings list all in one action.
   */
  private renderVault() {
    // Vault scroll fix, 6 Sep 2026 — every row goes into the panel's own
    // scrollable content well now, not the frame directly. The title used
    // to be the first row built here; it's a fixed header now (see
    // buildVaultOverlay), built once instead of destroyed/redrawn every
    // render for no reason, which is also why `y` starts where the title
    // used to END rather than where it used to begin.
    // 10 Sep 2026 (UI Prettiness Pass v1) — vaultRows' own destroy-and-clear
    // loop and the `add` closure's array bookkeeping are now
    // vaultPanel.clearContent()/vaultPanel.add(), same as Workshop's own
    // version just above in this file.
    this.vaultPanel.clearContent();
    const add = (obj: Phaser.GameObjects.GameObject) => this.vaultPanel.add(obj);

    const state = this.campaignState;
    // Was ROOM_BOUNDS.top + 46 — matched Panel's old contentTop, but the
    // title/extraHeader overlap fix (see buildVaultOverlay's extraHeader
    // callback) pushed the Vault panel's real content well down by 16px.
    // Content drawn above the new contentTop gets cut by the scroll mask,
    // not just visually crowded, so this has to track that number exactly.
    let y = ROOM_BOUNDS.top + 62;

    // The dedication, Phase 4 — guaranteed, not probabilistic (see
    // checkVaultDedication's own header comment on why this can't be a
    // hotTopics roll). Shown every time the Vault is opened once resolved,
    // same permanent-memorial framing a plaque gets; the ONLY thing `seen`
    // changes is the header, so the first look reads as a real moment and
    // every later look reads as what's already on record. Marked seen
    // AFTER being built into a row here, never before — same "don't mark
    // it seen before it's actually shown" discipline ackRankGreeting
    // already follows elsewhere in this class.
    const dedication = state.vaultDedication;
    if (dedication) {
      const header = dedication.seen ? "THE FALLOW LINE — IN MEMORIAM" : "THE FALLOW LINE";
      add(
        this.add
          .text(200, y, header, { fontFamily: "monospace", fontSize: "12px", color: "#d7b46a" })
          .setOrigin(0, 0),
      );
      y += 18;
      add(
        this.add
          .text(200, y, this.vaultDedicationText(dedication.fallenId), {
            fontFamily: "monospace",
            fontSize: "11px",
            color: TEXT_MAIN,
            wordWrap: { width: 560 },
            lineSpacing: 4,
          })
          .setOrigin(0, 0),
      );
      y += dedication.fallenId ? 78 : 62;
      if (!dedication.seen) {
        dedication.seen = true;
        saveCampaignState(state);
      }
      y += 12;
    }

    // Section A — the counter (Phase 1). Three states: Act I lockout, an
    // open shortlist, or the 3-pick budget already spent.
    add(
      this.add
        .text(200, y, "HOUSE OFFERS", { fontFamily: "monospace", fontSize: "12px", color: "#d7b46a" })
        .setOrigin(0, 0),
    );
    y += 18;
    if (!heirloomsUnlocked(state)) {
      add(
        this.add
          .text(212, y, "No house is offering yet. Heirloom candidates appear from Act II onward.", { fontFamily: "monospace", fontSize: "11px", color: TEXT_DIM, wordWrap: { width: 540 } })
          .setOrigin(0, 0),
      );
      y += 30;
    } else {
      const picksLeft = heirloomPicksRemaining(state);
      const standing = aristocracyStanding(state);
      add(
        this.add
          .text(212, y, `Company points: ${state.points}    Picks remaining: ${picksLeft}/${HEIRLOOM_RECRUIT_BUDGET}`, { fontFamily: "monospace", fontSize: "11px", color: TEXT_DIM })
          .setOrigin(0, 0),
      );
      y += 20;
      if (picksLeft <= 0) {
        add(
          this.add
            .text(212, y, `${this.f.profile.companyName} has taken on all three Heirloom pilots this campaign.`, { fontFamily: "monospace", fontSize: "11px", color: TEXT_DIM, wordWrap: { width: 540 } })
            .setOrigin(0, 0),
        );
        y += 26;
      } else {
        const rung = (HEIRLOOM_RECRUIT_BUDGET - picksLeft) + standing.costSteps;
        const cost = heirloomRecruitCost(rung);
        const shortlist = currentShortlist(state);
        if (shortlist.length === 0) {
          add(
            this.add
              .text(212, y, "No house has a name to put forward right now.", { fontFamily: "monospace", fontSize: "11px", color: TEXT_DIM, wordWrap: { width: 540 } })
              .setOrigin(0, 0),
          );
          y += 26;
        }
        for (const heirloomId of shortlist) {
          const def = HEIRLOOMS[heirloomId];
          const affordable = cost !== undefined && state.points >= cost;
          const color = affordable ? TEXT_MAIN : "#5a6572";
          const title = def.epithet ? `${def.displayName}, ${def.epithet}` : def.displayName;
          const row = this.add
            // No "House " prefix here (3 Sep 2026). HeirloomDef.pilot.house
            // already reads "House Dunmoor" / "House Rethwick" — every value
            // in data/heirlooms.ts carries the word — so prefixing it again
            // shipped "House House Dunmoor" on the shortlist. Found in a UI
            // sweep's own report text, not by anyone reading this line.
            // data/__tests__/heirloomHouseNames.test.ts pins the convention
            // at the data end so the next renderer doesn't re-add it.
            .text(212, y, `${title} — ${def.pilot?.displayName ?? "?"}, ${def.pilot?.house ?? "?"}  —  ${cost ?? "—"} pts`, { fontFamily: "monospace", fontSize: "12px", color })
            .setOrigin(0, 0);
          if (affordable) {
            // Pinned for the same reason the Workshop's own module rows
            // are — rebuilt per render, so it has to happen at creation.
            row.setInteractive({ useHandCursor: true }).setScrollFactor(0);
            row.on("pointerdown", () => this.recruitFromVault(heirloomId));
            // Tooltip Coverage pass, 12 Sep 2026 — cost/picksLeft read
            // straight from this render pass's own closure, same
            // no-dynamic-update-needed reasoning as the Workshop row above.
            this.wireHoverTip(row, [
              "RECRUIT",
              "",
              ...wrapTipText(`Spends ${cost} Company points and one of your ${picksLeft} remaining Heirloom picks (${HEIRLOOM_RECRUIT_BUDGET} total this campaign). Can't be undone.`, 42),
            ]);
          }
          add(row);
          // CLUSTERING FIX, 2 Sep 2026 — Maxime, screenshot: a long pilot
          // hook (Ichigeki/Dunmoor's especially) wraps to 3-4 lines at this
          // 500px width, but the old fixed `y += 44` assumed one short
          // line, so the next house's title started rendering while this
          // one's wrapped hook text was still going — Zanretsu's row
          // landing on top of Ichigeki's own description. hookText.height
          // already reflects the real wrapped line count (Phaser measures
          // it from wordWrap at construction), so read it back instead of
          // guessing a constant.
          const hookText = this.add
            .text(224, y + 16, def.pilot?.hook ?? "", { fontFamily: "monospace", fontSize: "10px", color: TEXT_DIM, wordWrap: { width: 500 } })
            .setOrigin(0, 0);
          add(hookText);
          y += 16 + hookText.height + 12;
        }
      }
    }

    y += 8;

    // Section C — the wall (Phase 3) + the shelf (Phase 2, slice 2). What's
    // actually with the company, who's carrying it, what's fielded, and
    // what its abilities are ranked to — the grievance system's only
    // visible surface anywhere in the game, plus the first real spend
    // target for an aristocrat's own personal points.
    add(
      this.add
        .text(200, y, "HOLDINGS & THE SHELF", { fontFamily: "monospace", fontSize: "12px", color: "#d7b46a" })
        .setOrigin(0, 0),
    );
    y += 18;

    const hs = heirloomState(state);
    const homeSet = new Set(returnedHeirlooms(state));
    const held = hs.recruited.filter((id) => !homeSet.has(id));
    const currentlyFielded = fieldedHeirloom(state);
    if (held.length === 0) {
      add(
        this.add
          .text(212, y, "Nothing in the company's keeping yet.", { fontFamily: "monospace", fontSize: "11px", color: TEXT_DIM })
          .setOrigin(0, 0),
      );
      y += 20;
    } else {
      for (const heirloomId of held) {
        const def = HEIRLOOMS[heirloomId];
        const holderId = hs.assignedPilotId[heirloomId];
        const holderEntry = holderId ? state.pilots[holderId] : undefined;
        const holderActive = holderEntry?.status === "active";
        const holderName = holderEntry ? holderEntry.pilot.displayName.split("—")[0].trim() : "unassigned";
        const isFielded = currentlyFielded === heirloomId;

        // Title + field/unfield toggle. Only offered when the holder is
        // actually alive and active — fieldHeirloom() already refuses
        // otherwise, but showing a dead-end button reads worse than not
        // showing one, same discipline the shortlist rows above already
        // follow (no button at all when a recruit isn't affordable).
        const titleRow = this.add
          .text(212, y, `${def.displayName} — carried by ${holderName}${isFielded ? "  [FIELDED]" : ""}`, {
            fontFamily: "monospace",
            fontSize: "11px",
            color: isFielded ? "#d7b46a" : TEXT_MAIN,
          })
          .setOrigin(0, 0);
        add(titleRow);
        if (holderActive) {
          const toggleLabel = isFielded ? "[ unfield ]" : "[ field ]";
          const toggleBtn = this.add
            .text(212 + titleRow.width + 12, y, toggleLabel, { fontFamily: "monospace", fontSize: "11px", color: "#8fb3c9" })
            .setOrigin(0, 0)
            .setInteractive({ useHandCursor: true })
            .setScrollFactor(0);
          toggleBtn.on("pointerdown", () => (isFielded ? this.unfieldFromVault() : this.fieldFromVault(heirloomId)));
          // Tooltip Coverage pass, 12 Sep 2026 — branches on isFielded same
          // as toggleLabel itself just above, rebuilt fresh every render.
          this.wireHoverTip(
            toggleBtn,
            isFielded
              ? ["UNFIELD", "", ...wrapTipText(`Stops bringing ${def.displayName} on missions, freeing the one active Heirloom slot for another.`, 42)]
              : ["FIELD", "", ...wrapTipText(`Brings ${def.displayName} on your next mission with ${holderName}. Only one Heirloom can be fielded at a time.`, 42)],
          );
          add(toggleBtn);
        }
        y += 18;

        // The shelf itself — all three abilities, always shown (the same
        // "show the refusal, don't hide the option" discipline the rest of
        // this panel already follows), but only the ones actually wired
        // into combat (HEIRLOOM_ABILITIES_LIVE_IN_COMBAT) ever get a buy
        // button. The other two per Heirloom are real content, honestly
        // labeled, not a placeholder pretending to be a feature.
        for (const ability of def.abilities) {
          const rank = abilityRank(state, heirloomId, ability.id);
          const live = HEIRLOOM_ABILITIES_LIVE_IN_COMBAT.has(ability.id);
          const atMax = rank >= HEIRLOOM_MAX_ABILITY_RANK;
          const nextCost = HEIRLOOM_ABILITY_RANK_COST[rank + 1];
          const personalPoints = holderEntry?.personalPoints ?? 0;
          const affordable = holderActive && live && !atMax && nextCost !== undefined && personalPoints >= nextCost;

          let status: string;
          if (!live) status = "(not implemented in combat yet)";
          else if (atMax) status = `rank ${rank}/${HEIRLOOM_MAX_ABILITY_RANK} (max)`;
          else status = `rank ${rank}/${HEIRLOOM_MAX_ABILITY_RANK} — next rank ${nextCost ?? "—"} pts`;

          const abilityColor = live ? (affordable ? TEXT_MAIN : TEXT_DIM) : "#5a6572";
          const abilityRow = this.add
            .text(224, y, `${ability.displayName} — ${status}`, { fontFamily: "monospace", fontSize: "10px", color: abilityColor })
            .setOrigin(0, 0);
          add(abilityRow);
          if (affordable) {
            const buyBtn = this.add
              .text(224 + abilityRow.width + 10, y, "[ rank up ]", { fontFamily: "monospace", fontSize: "10px", color: "#8fb3c9" })
              .setOrigin(0, 0)
              .setInteractive({ useHandCursor: true })
              .setScrollFactor(0);
            buyBtn.on("pointerdown", () => this.rankUpFromVault(heirloomId, ability.id, holderId!));
            // Tooltip Coverage pass, 12 Sep 2026 — PERSONAL points called
            // out explicitly since this is the one purchase path in this
            // whole panel that spends the pilot's own pool rather than the
            // Company one every other row on this screen spends.
            this.wireHoverTip(buyBtn, [
              "RANK UP",
              "",
              ...wrapTipText(`Spends ${nextCost} of ${holderName}'s personal points (not Company points) to raise ${ability.displayName} to rank ${rank + 1}/${HEIRLOOM_MAX_ABILITY_RANK}.`, 42),
            ]);
            add(buyBtn);
          }
          y += 14;
        }
        y += 6;
      }
    }

    y += 6;
    const verdicts = aristocracyStanding(state).verdicts;
    if (verdicts.length > 0) {
      add(
        this.add
          .text(212, y, "RETURNED HOME", { fontFamily: "monospace", fontSize: "11px", color: TEXT_DIM })
          .setOrigin(0, 0),
      );
      y += 16;
      for (const v of verdicts) {
        const def = HEIRLOOMS[v.heirloomId];
        const clause = HOUSE_VERDICT_CLAUSES[v.verdict];
        // Same doubled-prefix bug as the shortlist above — v.house comes
        // from the same HeirloomDef.pilot.house, which already says "House".
        const line = `${def?.displayName ?? v.heirloomId} — ${v.house}, ${v.pilotName.split("—")[0].trim()}. ${clause}.`;
        add(
          this.add
            .text(224, y, line, { fontFamily: "monospace", fontSize: "10px", color: v.verdict === "estranged" ? "#c17a6a" : TEXT_DIM, wordWrap: { width: 500 } })
            .setOrigin(0, 0),
        );
        y += 30;
      }
    }

    // Vault scroll fix, 6 Sep 2026 — same clamp math as MapSelect.ts's own
    // listScrollMinY (see that file's header comment): however far past the
    // panel's own bottom edge `y` landed is how far up the content is
    // allowed to scroll, floored at 0 (a short list — Act I, nothing
    // recruited yet — never scrolls at all). Re-clamped, not reset, so a
    // recruit/field/rank-up click that triggers this same rebuild doesn't
    // snap the player back to the top of a list they'd scrolled down —
    // openVault() is the only place that actually resets to the top. 10 Sep
    // 2026: the actual scrollMinY field and the clamp itself now live in
    // vaultPanel (setContentExtent) — this call is what feeds it the one
    // number it can't know on its own, where this particular render's
    // content actually ended.
    this.vaultPanel.setContentExtent(y);
  }

  /**
   * Recruit off the current shortlist, then redraw. All the actual rules
   * live in engine/heirlooms.ts's recruitHeirloom (path resolution
   * included — an "Any"-path Heirloom silently takes HEIRLOOM_DEFAULT_PATH
   * when nothing more specific is asked for, so this scene doesn't need its
   * own path-picker for v1); this scene only reports the outcome, same
   * division buyCarrierModule keeps just above.
   */
  private recruitFromVault(heirloomId: HeirloomId) {
    const result = recruitHeirloom(this.campaignState, heirloomId);
    if (!result.ok) {
      this.showFallback(result.reason ?? "That house isn't dealing with Warden Company right now.");
      return;
    }
    saveCampaignState(this.campaignState);
    this.renderVault();
  }

  /**
   * Vault Phase 2, slice 2 — field one Heirloom, benching whatever was out.
   * All the one-at-a-time enforcement lives in engine/heirlooms.ts's
   * fieldHeirloom (replacement, not refusal, per that function's own
   * comment); this scene only reports the outcome and redraws, same
   * division every other Vault/Workshop action in this file keeps.
   */
  private fieldFromVault(heirloomId: HeirloomId) {
    const result = fieldHeirloom(this.campaignState, heirloomId);
    if (!result.ok) {
      this.showFallback(result.reason ?? "That Heirloom can't be fielded right now.");
      return;
    }
    saveCampaignState(this.campaignState);
    this.renderVault();
  }

  /** Bench the fielded Heirloom. unfieldHeirloom() is idempotent, so this never fails in a way worth showing the player. */
  private unfieldFromVault() {
    unfieldHeirloom(this.campaignState);
    saveCampaignState(this.campaignState);
    this.renderVault();
  }

  /**
   * Raise one ability by one rank, spending the wielding pilot's PERSONAL
   * points. The row that calls this already gated the button on
   * affordability/live-in-combat/not-maxed, so a refusal here would mean
   * campaign state moved between render and click (e.g. the holder died) —
   * shown the same honest way any other late refusal in this file is.
   */
  private rankUpFromVault(heirloomId: HeirloomId, abilityId: string, pilotId: string) {
    const result = purchaseAbilityRank(this.campaignState, heirloomId, abilityId, pilotId);
    if (!result.ok) {
      this.showFallback(result.reason ?? "That ability can't be ranked up right now.");
      return;
    }
    saveCampaignState(this.campaignState);
    this.renderVault();
  }

  private buildHistoryOverlay() {
    this.historyOverlay = this.add.container(0, 0).setDepth(60).setVisible(false).setScrollFactor(0);

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
      .setInteractive({ useHandCursor: true }).setScrollFactor(0);
    closeBtn.on("pointerdown", () => this.closeHistory());
    this.wireHoverTip(closeBtn, ["CLOSE", "", "Back to the Hub floor."]);
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
    this.highlightsOverlay = this.add.container(0, 0).setDepth(60).setVisible(false).setScrollFactor(0);

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
      .setInteractive({ useHandCursor: true }).setScrollFactor(0);
    closeBtn.on("pointerdown", () => this.closeHighlights());
    this.wireHoverTip(closeBtn, ["CLOSE", "", "Back to the Hub floor."]);
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

  // --- Hangar Deck roster/stats panel — Tier 4, 30 Aug 2026 -------------
  // Same construction as buildHistoryOverlay/buildHighlightsOverlay above
  // (a container, a background card, a title, a close button) framing a
  // live ShopPanel instead of a static text block. Built once here, in
  // create(), same as every other overlay — ShopPanel's own constructor
  // already does its real work eagerly (creates its two containers), so
  // there's no lazy-construction step to defer; setVisible(false)
  // immediately after construction is what keeps it off-screen until
  // openHangarShop() actually opens it, since ShopPanel itself defaults
  // to visible (Debrief.ts/Hangar.ts each dedicate their whole scene to
  // it, so neither has ever needed it to start hidden).
  private buildHangarShopOverlay() {
    this.hangarShopOverlay = this.add.container(0, 0).setDepth(60).setVisible(false).setScrollFactor(0);

    // This chrome is Hub's OWN — not part of ShopPanel, so fitWidth() below
    // (called on this.hangarShop, ShopPanel's instance) never touches it.
    // It used SHOP_CARD_W/SHOP_CARD_R (900/930, sized for Debrief.ts/
    // Hangar.ts's full 1074-wide camera) until 4 Sep 2026, same bug and
    // same root cause as ShopPanel.fitWidth's own header describes — this
    // background and the close button both ran past Hub's 838px main-
    // camera viewport too. Widened to ROOM_BOUNDS instead, the same box
    // every other Hub overlay's own background already uses.
    const bg = this.add
      .rectangle(480, 320, ROOM_BOUNDS.right - ROOM_BOUNDS.left, 600, PANEL_BG, 0.97)
      .setStrokeStyle(1, PANEL_BORDER);
    this.hangarShopOverlay.add(bg);

    this.hangarShopOverlay.add(this.add.text(480, 26, "HANGAR DECK — ROSTER & GEAR", { fontFamily: "monospace", fontSize: "16px", color: TEXT_MAIN }).setOrigin(0.5));

    const closeBtn = this.add
      .text(ROOM_BOUNDS.right - 10, 20, "[ close — Esc ]", { fontFamily: "monospace", fontSize: "11px", color: TEXT_DIM })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true }).setScrollFactor(0);
    closeBtn.on("pointerdown", () => this.closeHangarShop());
    this.wireHoverTip(closeBtn, ["CLOSE", "", "Back to the Hub floor. Anything bought here is already saved."]);
    this.hangarShopOverlay.add(closeBtn);

    // Not added into hangarShopOverlay — ShopPanel owns and clears its own
    // two containers on every render() (see that class's own header on
    // why it was extracted scene-agnostic in the first place); nesting
    // them inside another container would work too, but keeping them as
    // ShopPanel's own top-level display objects, toggled via the new
    // setVisible() method this pass added to that class, is the smaller
    // change against a shared file two other scenes also depend on.
    this.hangarShop = new ShopPanel(
      this,
      this.campaignState,
      56,
      590,
      () => {
        // Tier 4, 30 Aug 2026 — ShopPanel's existing callers (Debrief.ts,
        // Hangar.ts) only ever save on their own footer's "leave" button,
        // not after every purchase. This Hub already saves immediately
        // after every state-mutating interaction elsewhere in this file
        // (persistNpcSocial's own header covers the "why") — matched here
        // rather than adopting the more lax convention, so a purchase made
        // from the Hub survives a crash/reload the same way everything
        // else the Hub touches already does.
        saveCampaignState(this.campaignState);
      },
      // "[ move lance ]" jump, 11 Sep 2026 — Maxime asked for an obvious
      // way to move a pilot between lances right here on Roster & Gear.
      // The actual mechanic already lives in RosterPanel (Crew Records,
      // 9 Sep) — click-to-carry, Codex-styled, already solid — and this
      // card is already the densest, most overlap-prone one in the file
      // (see drawPilotRow's own Convert-to-company/Weapon-Branch comments
      // for that history first-hand). Rebuilding a second picker inside
      // it risked exactly the class of bug this file keeps a paper trail
      // of, for no real gain. So this reuses the existing, proven UI
      // instead of duplicating it: close this shop, open Crew Records
      // already showing the pilot's current lance, and pick them straight
      // up — one click here gets you a pilot ready to drop onto a lance
      // tab there, rather than a second lance-picker to build and trust
      // blind.
      (pilotId) => {
        this.closeHangarShop();
        this.openRosterPanel();
        this.rosterPanel.setTab(RosterPanel.lanceOf(this.campaignState, pilotId));
        this.rosterPanel.pickForSwap(pilotId);
      }
    );
    this.hangarShop.setVisible(false);
    // Washed-out-panel hotfix (30 Aug 2026, Maxime's own screenshot).
    // ShopPanel's own two containers default to depth 0 (fine for
    // Debrief.ts/Hangar.ts, which have nothing else competing for depth)
    // but hangarShopOverlay's own background above sits at depth 60 —
    // without this, that near-opaque rectangle painted over ShopPanel's
    // actual content instead of framing it. See ShopPanel.setDepth's own
    // comment for the full mechanism. 61 (one above the overlay's own
    // depth) is enough to clear it.
    this.hangarShop.setDepth(61);
    // Carrier Scale-Up Plan v1, Phase 1, 2 Sep 2026 — same reasoning as
    // hangarShopOverlay's own .setScrollFactor(0) just above it in
    // create(): this Hub is the one ShopPanel host whose camera actually
    // scrolls, so its two internal layers need the new passthrough method
    // this pass added to ShopPanel (see that class's own comment on it).
    this.hangarShop.setScrollFactor(0);
    // Sidebar-clipping fix, 4 Sep 2026 — see ShopPanel.fitWidth's own
    // header for the full mechanism. ROOM_BOUNDS.right (830) rather than
    // DOCK_SPLIT_X (838) itself, so this overlay keeps the same clearance
    // from the dock every other Hub overlay already does, instead of
    // running flush up against it.
    this.hangarShop.fitWidth(ROOM_BOUNDS.right);
  }

  /**
   * B2 — the roster/stats panel. Deliberately a different console from the
   * ROSTER & GEAR one right beside it: that opens ShopPanel (gear, tiers,
   * recruiting), this is who your people are. See RosterPanel's own header.
   */
  private openRosterPanel() {
    this.rosterOpen = true;
    this.rosterPanel.open(this.campaignState);
  }

  private closeRosterPanel() {
    this.rosterOpen = false;
    this.rosterPanel.close();
  }

  /**
   * A lance reassignment landed. Persist it, then rebuild the crew so the
   * moved pilot's Mek is standing in their new lance's workshop and they
   * bunk in their new lance's berths — lanceOf/lanceOfMekIn already read the
   * live assignment, so this only has to re-run the seeding that consumes
   * them. Without it the change would be real in the save but invisible in
   * the ship until the next time the Hub was entered.
   */
  private onLanceAssignmentChanged() {
    saveCampaignState(this.campaignState);
    this.reseedCrewAfterLanceChange();
  }

  /**
   * Re-home every Mek NPC whose pilot's lance changed, in place. Targeted
   * rather than a buildNpcs() rerun on purpose: that function CREATES NPCs
   * and pushes them onto this.npcs, so calling it again would duplicate the
   * whole crew rather than move anyone.
   *
   * Only Meks need moving. A pilot's berth is resolved at the moment it's
   * needed (needRoomFor -> lanceOf, which already reads the live
   * assignment), so berths self-correct with no work here.
   */
  private reseedCrewAfterLanceChange() {
    for (const npc of this.npcs) {
      if (!npc.pilotId.startsWith("mek_")) continue;
      const want = this.workshopRoomFor(lanceOfMekIn(this.campaignState, npc.pilotId));
      if (npc.room === want) continue;
      // Same free-cradle rule buildNpcs uses, minus this Mek itself so it
      // can't block its own destination.
      const cradle = this.f.mekSpots(want).find(
        (spot) => !this.npcs.some((n) => n !== npc && n.room === want && Phaser.Math.Distance.Between(spot.x, spot.y, n.x, n.y) < NPC_R * 2),
      );
      const pos = cradle ?? this.pickInitialNpcSpot(want, this.npcs.filter((n) => n !== npc));
      npc.room = want;
      npc.homeRoom = want;
      npc.x = pos.x;
      npc.y = pos.y;
      npc.root.setPosition(pos.x, pos.y);
      npc.favLabel.setPosition(pos.x, pos.y - NPC_R - 14);
      npc.bubbleContainer.setPosition(pos.x, pos.y - NPC_R - 30);
      // Cancel any walk in progress — its waypoints were computed for the
      // room this Mek is no longer standing in.
      npc.targetX = undefined;
      npc.targetY = undefined;
      npc.path = undefined;
    }
    this.refreshRoomVisibility();
  }

  private openHangarShop() {
    // Hub Hints & Orientation, 11 Sep 2026 — hangarShopOverlay renders at
    // depth 60, above this scene's own depth-20 HUD text, so the hint has
    // to show BEFORE the shop actually opens over it — see
    // gateFirstHubHint's own header.
    this.gateFirstHubHint(
      "roster",
      ["ROSTER & GEAR", "This is where mission-to-mission progress actually happens — gear tiers, weapon branches, and recruiting new pilots.", "Full rules reference: MENU (top corner) → HOW TO PLAY."],
      () => this.finishOpenHangarShop()
    );
  }

  private finishOpenHangarShop() {
    this.hangarShopOpen = true;
    this.hangarShopOverlay.setVisible(true);
    this.hangarShop.setVisible(true);
    // Fresh render on every open, not just the first — reflects whatever's
    // changed in campaignState since this was last opened (a mission run,
    // a recruit added elsewhere), same "always current, never a stale
    // snapshot" reasoning ShopPanel's own callers already rely on.
    this.hangarShop.render();
  }

  private closeHangarShop() {
    this.hangarShopOpen = false;
    this.hangarShopOverlay.setVisible(false);
    this.hangarShop.setVisible(false);
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

    // Memory milestones, 12 Sep 2026 (Emotional Brain) — what this pilot
    // carries from missions, dated, alongside the verb and Stage entries.
    const memoryMilestones = buildMemoryMilestones(
      this.campaignState.pilots[npc.pilotId]?.social?.memories,
      (id) => this.campaignState.pilots[id]?.pilot.displayName.split("—")[0].trim(),
      (missionId) => this.f.profile.missionsById[missionId]?.displayName,
    );

    const reelEntries: { at: number; text: string }[] = [
      ...verbMilestones.map((m) => ({ at: m.at, text: `${m.label}: "${m.line}"` })),
      ...stageMilestones.map((m) => ({ at: m.at, text: m.label })),
      ...memoryMilestones.map((m) => ({ at: m.at, text: `${m.label}, ${m.missionName}` })),
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
      .setInteractive({ useHandCursor: true }).setScrollFactor(0);
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
    this.pegOverlay = this.add.container(0, 0).setDepth(60).setVisible(false).setScrollFactor(0);

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
      const zone = this.add.circle(p.x, p.y, PEG_ZONE_RADIUS, 0xffffff, 0).setInteractive({ useHandCursor: true }).setScrollFactor(0);
      zone.on("pointerdown", () => this.onPegDotClicked(id));
      // Tooltip Coverage pass, 12 Sep 2026 — one generic line for all 9 dots
      // rather than 9 near-identical ones; the status text above the board
      // already says exactly what a click on ANY dot does at this moment
      // (opening move vs. continuing a line vs. answering a Shield), so
      // duplicating that per-dot would just be stale the instant the turn
      // changes.
      this.wireHoverTip(zone, ["PEG", "", "Click a dot to start or continue a line. Follow the status text above, or press [ ? ] for the full rules."]);
      this.pegOverlay.add(zone);
    }

    const closeBtn = this.add
      .text(ROOM_BOUNDS.right - 20, ROOM_BOUNDS.top + 20, "[ leave — Esc ]", { fontFamily: "monospace", fontSize: "11px", color: TEXT_DIM })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true }).setScrollFactor(0);
    closeBtn.on("pointerdown", () => this.closePegBoard());
    this.wireHoverTip(closeBtn, ["LEAVE", "", "Ends this game with no result — no Favorability change either way."]);
    this.pegOverlay.add(closeBtn);

    const helpBtn = this.add
      .text(ROOM_BOUNDS.left + 20, ROOM_BOUNDS.top + 20, "[ ? ]", { fontFamily: "monospace", fontSize: "11px", color: ACCENT })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true }).setScrollFactor(0);
    helpBtn.on("pointerdown", () => this.togglePegHelp());
    this.wireHoverTip(helpBtn, ["RULES", "", "Full peg board rules — Reach and Knot explained."]);
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
    // Hub Hints & Orientation, 11 Sep 2026 — pegOverlay renders at depth
    // 60, above this scene's own depth-20 HUD text; see gateFirstHubHint's
    // own header for why the hint has to show before the game opens over it.
    this.gateFirstHubHint(
      "rec_room",
      ["REC ROOM GAMES", "Peg board, poker, and darts aren't just a distraction — a win gives real Stress relief and builds Favorability with whoever you played."],
      () => this.finishStartPegBoard(npc)
    );
  }

  private finishStartPegBoard(npc: HubNpc) {
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
    // Stress & Morale Trigger Proposal, 1 Sep 2026 — "minigame win -> small
    // Morale gain, loss -> small Stress tick," resolving that proposal's
    // own open question in favor of a real (small) cost on a loss, same
    // shape as the Favorability swing right above it.
    npc.ambient = {
      ...npc.ambient,
      morale: Math.max(0, Math.min(100, npc.ambient.morale + (humanWon ? 4 : draw ? 1 : 0))),
      stress: Math.max(0, Math.min(100, npc.ambient.stress + (humanWon || draw ? 0 : 2))),
    };
    const { line } = this.pickAmbientLineWithMemory(npc);
    npc.socialLog = npc.socialLog ?? [];
    this.logVerbAndCharge(npc, { verb: "pegBoard", line, at: Date.now() });
    this.persistNpcSocial(npc);
    // No `best` for the peg board — it has no score, only an outcome.
    this.recordRecRoomSession(npc, "pegBoard", humanWon, draw);

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
    const btn = this.add.text(x, y, label, { fontFamily: "monospace", fontSize: "12px", color: ACCENT }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setScrollFactor(0);
    btn.on("pointerdown", onClick);
    this.pokerOverlay.add(btn);
    return btn;
  }

  private buildPokerOverlay() {
    this.pokerOverlay = this.add.container(0, 0).setDepth(60).setVisible(false).setScrollFactor(0);

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
    // Tooltip Coverage pass, 12 Sep 2026 — static text on all four rather
    // than re-wiring per renderPoker() call: the button LABELS already
    // change live (CHECK vs CALL n, RAISE TO n) via setText in renderPoker,
    // but what each button actually DOES doesn't need a live number to
    // explain, so one wireHoverTip() call per button at construction covers
    // it for the button's whole lifetime.
    this.wireHoverTip(this.pokerFoldBtn, ["FOLD", "", "Give up this hand. You lose whatever's already in the pot, but risk nothing more this hand."]);
    this.wireHoverTip(this.pokerCheckCallBtn, ["CHECK / CALL", "", "Check for free if nobody's bet yet, or call to match the current bet — whichever applies right now."]);
    this.wireHoverTip(this.pokerRaiseBtn, ["RAISE", "", "Raises to the minimum next bet, forcing everyone still in to match it or fold."]);
    this.wireHoverTip(this.pokerAllInBtn, ["ALL-IN", "", "Pushes your entire remaining stack into the pot."]);

    const closeBtn = this.add
      .text(ROOM_BOUNDS.right - 20, ROOM_BOUNDS.top + 20, "[ leave — Esc ]", { fontFamily: "monospace", fontSize: "11px", color: TEXT_DIM })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true }).setScrollFactor(0);
    closeBtn.on("pointerdown", () => this.closePoker());
    this.wireHoverTip(closeBtn, ["LEAVE", "", "Ends this sitting — no Favorability change either way. Chips reset next time you sit down."]);
    this.pokerOverlay.add(closeBtn);

    const helpBtn = this.add
      .text(ROOM_BOUNDS.left + 20, ROOM_BOUNDS.top + 20, "[ ? ]", { fontFamily: "monospace", fontSize: "11px", color: ACCENT })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true }).setScrollFactor(0);
    helpBtn.on("pointerdown", () => this.togglePokerHelp());
    this.wireHoverTip(helpBtn, ["RULES", "", "Full Texas Hold'em rules and hand rankings."]);
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
    // Hub Hints & Orientation, 11 Sep 2026 — see startPegBoard's own comment
    // just above (same overlay depth, same fix).
    this.gateFirstHubHint(
      "rec_room",
      ["REC ROOM GAMES", "Peg board, poker, and darts aren't just a distraction — a win gives real Stress relief and builds Favorability with whoever you played."],
      () => this.finishStartPoker(npc)
    );
  }

  private finishStartPoker(npc: HubNpc) {
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
    // Stress & Morale Trigger Proposal, 1 Sep 2026 — same reasoning as the
    // peg board's own comment, wider swing to match this sitting's wider
    // Favorability delta right above (+6/-3 rather than the peg board's
    // +6/+2/-2).
    npc.ambient = {
      ...npc.ambient,
      morale: Math.max(0, Math.min(100, npc.ambient.morale + (humanWon ? 5 : 0))),
      stress: Math.max(0, Math.min(100, npc.ambient.stress + (humanWon ? 0 : 3))),
    };
    const { line } = this.pickAmbientLineWithMemory(npc);
    npc.socialLog = npc.socialLog ?? [];
    this.logVerbAndCharge(npc, { verb: "poker", line, at: Date.now() });
    this.persistNpcSocial(npc);
    // Poker's keepsake number is the stack they walked away with.
    this.recordRecRoomSession(npc, "poker", humanWon, false, game.players[0].stack, game.players[1].stack);

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
    this.dartsOverlay = this.add.container(0, 0).setDepth(60).setVisible(false).setScrollFactor(0);

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
    this.dartsThrowBtn = this.add.text(480, DARTS_THROW_BUTTON_Y, "[ THROW ]", { fontFamily: "monospace", fontSize: "13px", color: ACCENT }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setScrollFactor(0);
    this.dartsThrowBtn.on("pointerdown", () => this.onDartsThrow());
    this.wireHoverTip(this.dartsThrowBtn, ["THROW", "", "Locks in your aim wherever the meter marker sits right now. Time it for the center for the best zones."]);
    this.dartsOverlay.add(this.dartsThrowBtn);

    const closeBtn = this.add
      .text(ROOM_BOUNDS.right - 20, ROOM_BOUNDS.top + 20, "[ leave — Esc ]", { fontFamily: "monospace", fontSize: "11px", color: TEXT_DIM })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true }).setScrollFactor(0);
    closeBtn.on("pointerdown", () => this.closeDarts());
    this.wireHoverTip(closeBtn, ["LEAVE", "", "Ends this match — no Favorability change either way."]);
    this.dartsOverlay.add(closeBtn);

    const helpBtn = this.add
      .text(ROOM_BOUNDS.left + 20, ROOM_BOUNDS.top + 20, "[ ? ]", { fontFamily: "monospace", fontSize: "11px", color: ACCENT })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true }).setScrollFactor(0);
    helpBtn.on("pointerdown", () => this.toggleDartsHelp());
    this.wireHoverTip(helpBtn, ["RULES", "", "Full darts rules and scoring zones."]);
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
    // Hub Hints & Orientation, 11 Sep 2026 — see startPegBoard's own comment
    // above (same overlay depth, same fix).
    this.gateFirstHubHint(
      "rec_room",
      ["REC ROOM GAMES", "Peg board, poker, and darts aren't just a distraction — a win gives real Stress relief and builds Favorability with whoever you played."],
      () => this.finishStartDarts(npc)
    );
  }

  private finishStartDarts(npc: HubNpc) {
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
    // Stress & Morale Trigger Proposal, 1 Sep 2026 — reuses the peg board's
    // own +4/+1/stress-tick shape, same reasoning this delta right above
    // already reuses the peg board's Favorability swing instead of Poker's
    // wider one (a darts round is a quick game, not a multi-hand sitting).
    npc.ambient = {
      ...npc.ambient,
      morale: Math.max(0, Math.min(100, npc.ambient.morale + (humanWon ? 4 : draw ? 1 : 0))),
      stress: Math.max(0, Math.min(100, npc.ambient.stress + (humanWon || draw ? 0 : 2))),
    };
    const { line } = this.pickAmbientLineWithMemory(npc);
    npc.socialLog = npc.socialLog ?? [];
    this.logVerbAndCharge(npc, { verb: "fletchers", line, at: Date.now() });
    this.persistNpcSocial(npc);
    // Fletchers' keepsake number is the total they threw.
    this.recordRecRoomSession(npc, "fletchers", humanWon, draw, game.totals.human, game.totals.ai);

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
      if (!this.sameDeck(npc.room, this.currentRoomId)) continue;
      const dist = Phaser.Math.Distance.Between(this.playerX, this.playerY, npc.x, npc.y);
      if (dist > TALK_RADIUS) continue;
      this.showBubble(npc, line, now);
      this.holdForPlayerTalk(npc);
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
      if (!this.sameDeck(npc.room, this.currentRoomId)) continue;
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
        this.holdForPlayerTalk(npc);
        topic.mentionedBy.push(npc.pilotId);
        continue;
      }
      this.showBubble(npc, shrug, now);
      this.holdForPlayerTalk(npc);
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
          this.holdForPlayerTalk(npc);
        });
      } else {
        this.showBubble(hit.npc, hit.line, now);
        this.holdForPlayerTalk(hit.npc);
      }
    }
  }

  // The ship interior, 3 Sep 2026 — one Container per deck, drawn once from
  // engine/hubLayout.ts's DECK_LAYOUTS and toggled by refreshRoomVisibility
  // (exactly one visible at a time, same contract the four plain floor
  // rectangles this replaces had). Everything is Phaser Graphics
  // primitives — there is no tileset or sprite art in this project yet
  // (assets/tiles and assets/sprites are both .gitkeep-only), so the look
  // comes from layering: a hull shell, deck plating, per-room floor tints,
  // furniture, doorway thresholds, then bevelled walls on top. Layer order
  // matters: walls are drawn LAST so a bunk pushed against a wall never
  // paints over it.
  private drawDeckLayout(deck: DeckId): Phaser.GameObjects.Container {
    const layout = layoutOf(deck);
    const b = layout.bounds;
    const container = this.add.container(0, 0);
    const g = this.add.graphics();
    container.add(g);

    // Hull shell: a WALL_T-thick band just outside the walkable floor.
    const shell = WALL_T;
    if (layout.ellipse) {
      const e = layout.ellipse;
      g.fillStyle(PAL.wallDark, 1);
      g.fillEllipse(e.cx, e.cy, (e.rx + shell + 6) * 2, (e.ry + shell + 6) * 2);
      g.fillStyle(PAL.wall, 1);
      g.fillEllipse(e.cx, e.cy, (e.rx + shell) * 2, (e.ry + shell) * 2);
      const soleRoom = Object.keys(layout.rooms)[0] as RoomId | undefined; // an oval deck is one room
      g.fillStyle((soleRoom && layout.roomTint[soleRoom]) ?? PAL.floor, 1);
      g.fillEllipse(e.cx, e.cy, e.rx * 2, e.ry * 2);
      // Terraced rings instead of plating — this deck is a garden, not a
      // machine space.
      for (const k of [0.82, 0.62, 0.42]) {
        g.lineStyle(1, PAL.leafDark, 0.25);
        g.strokeEllipse(e.cx, e.cy, e.rx * 2 * k, e.ry * 2 * k);
      }
      g.lineStyle(2, PAL.wallLight, 0.5);
      g.strokeEllipse(e.cx, e.cy, e.rx * 2, e.ry * 2);
    } else {
      g.fillStyle(PAL.wallDark, 1);
      g.fillRect(b.left - shell - 6, b.top - shell - 6, b.right - b.left + (shell + 6) * 2, b.bottom - b.top + (shell + 6) * 2);
      g.fillStyle(PAL.wall, 1);
      g.fillRect(b.left - shell, b.top - shell, b.right - b.left + shell * 2, b.bottom - b.top + shell * 2);
      g.fillStyle(PAL.floor, 1);
      g.fillRect(b.left, b.top, b.right - b.left, b.bottom - b.top);
      // Room floor tints.
      for (const id of Object.keys(layout.rooms) as RoomId[]) {
        const r = layout.rooms[id]!;
        g.fillStyle(layout.roomTint[id] ?? PAL.floor, 1);
        g.fillRect(r.left, r.top, r.right - r.left, r.bottom - r.top);
      }
      // Deck plating — a faint 48px grid over the whole floor.
      g.lineStyle(1, PAL.plating, 0.45);
      for (let x = b.left + 48; x < b.right; x += 48) g.lineBetween(x, b.top, x, b.bottom);
      for (let y = b.top + 48; y < b.bottom; y += 48) g.lineBetween(b.left, y, b.right, y);
      // Corridor guide line: dashed amber down the spine's centre, and
      // thin edge stripes, so the hallway reads as a hallway even where
      // no wall happens to be in frame.
      const hall = layout.corridor ? layout.rooms[layout.corridor] : undefined;
      if (hall) {
        const cy = (hall.top + hall.bottom) / 2;
        g.lineStyle(2, PAL.amber, 0.22);
        for (let x = hall.left + 20; x < hall.right - 20; x += 28) g.lineBetween(x, cy, Math.min(x + 14, hall.right - 20), cy);
        g.lineStyle(1, PAL.wallLight, 0.18);
        g.lineBetween(hall.left, hall.top + 12, hall.right, hall.top + 12);
        g.lineBetween(hall.left, hall.bottom - 12, hall.right, hall.bottom - 12);
      }
    }

    // Furniture and details.
    for (const d of layout.decor) this.drawDecor(g, container, d);

    // Doorways: a threshold strip over the gap, frame ticks at both jambs.
    for (const d of layout.doorways) {
      const r = d.rect;
      g.fillStyle(PAL.door, 1);
      g.fillRect(r.left, r.top, r.right - r.left, r.bottom - r.top);
      g.fillStyle(PAL.doorFrame, 0.55);
      const horizontal = d.side === "top" || d.side === "bottom";
      if (horizontal) {
        g.fillRect(r.left - 3, r.top - 2, 6, WALL_T + 4);
        g.fillRect(r.right - 3, r.top - 2, 6, WALL_T + 4);
        g.lineStyle(1, PAL.doorFrame, 0.25);
        g.lineBetween(r.left + 6, (r.top + r.bottom) / 2, r.right - 6, (r.top + r.bottom) / 2);
      } else {
        g.fillRect(r.left - 2, r.top - 3, WALL_T + 4, 6);
        g.fillRect(r.left - 2, r.bottom - 3, WALL_T + 4, 6);
        g.lineStyle(1, PAL.doorFrame, 0.25);
        g.lineBetween((r.left + r.right) / 2, r.top + 6, (r.left + r.right) / 2, r.bottom - 6);
      }
    }

    // Walls, bevelled: fill, light edge on top/left, dark edge on bottom/right.
    for (const w of layout.walls) {
      g.fillStyle(PAL.wall, 1);
      g.fillRect(w.left, w.top, w.right - w.left, w.bottom - w.top);
      g.lineStyle(2, PAL.wallLight, 0.7);
      g.lineBetween(w.left, w.top + 1, w.right, w.top + 1);
      g.lineBetween(w.left + 1, w.top, w.left + 1, w.bottom);
      g.lineStyle(2, PAL.wallDark, 0.9);
      g.lineBetween(w.left, w.bottom - 1, w.right, w.bottom - 1);
      g.lineBetween(w.right - 1, w.top, w.right - 1, w.bottom);
    }
    // Hull edge highlight.
    if (!layout.ellipse) {
      g.lineStyle(2, PAL.wallLight, 0.6);
      g.strokeRect(b.left - shell, b.top - shell, b.right - b.left + shell * 2, b.bottom - b.top + shell * 2);
      g.lineStyle(1, PAL.wallLight, 0.35);
      g.strokeRect(b.left, b.top, b.right - b.left, b.bottom - b.top);
    }

    // Room name labels — every walled room, top-centre of its interior.
    // The corridors and the single-room decks skip it: the title bar
    // already names those the instant you're standing in them.
    for (const id of Object.keys(layout.rooms) as RoomId[]) {
      if (id === layout.corridor || Object.keys(layout.rooms).length === 1) continue;
      const r = layout.rooms[id]!;
      // Centred ON the bow wall band (a sign over the room), not inside
      // the room, so the plate never competes with furniture flush to
      // that wall.
      const t = this.add
        .text((r.left + r.right) / 2, r.top - WALL_T / 2, this.f.roomTitle(id), { fontFamily: "monospace", fontSize: "10px", color: TEXT_DIM })
        .setOrigin(0.5)
        .setAlpha(0.9);
      // A name plate behind the text so it stays legible over whatever
      // furniture hugs that wall.
      const plate = this.add.graphics();
      plate.fillStyle(PAL.wallDark, 0.85);
      plate.fillRect(t.x - t.width / 2 - 6, t.y - t.height / 2 - 2, t.width + 12, t.height + 4);
      plate.lineStyle(1, PAL.wallLight, 0.4);
      plate.strokeRect(t.x - t.width / 2 - 6, t.y - t.height / 2 - 2, t.width + 12, t.height + 4);
      container.add(plate);
      container.add(t);
    }
    return container;
  }

  private drawDecor(g: Phaser.GameObjects.Graphics, container: Phaser.GameObjects.Container, d: Decor) {
    switch (d.kind) {
      case "rect":
        g.fillStyle(d.fill, d.alpha ?? 1);
        g.fillRect(d.x, d.y, d.w, d.h);
        if (d.stroke !== undefined) {
          g.lineStyle(1, d.stroke, d.strokeAlpha ?? 1);
          g.strokeRect(d.x, d.y, d.w, d.h);
        }
        return;
      case "circle":
        g.fillStyle(d.fill, d.alpha ?? 1);
        g.fillCircle(d.x, d.y, d.r);
        if (d.stroke !== undefined) {
          g.lineStyle(1, d.stroke, d.strokeAlpha ?? 1);
          g.strokeCircle(d.x, d.y, d.r);
        }
        return;
      case "ellipse":
        g.fillStyle(d.fill, d.alpha ?? 1);
        g.fillEllipse(d.x, d.y, d.rx * 2, d.ry * 2);
        if (d.stroke !== undefined) {
          g.lineStyle(1, d.stroke, d.strokeAlpha ?? 1);
          g.strokeEllipse(d.x, d.y, d.rx * 2, d.ry * 2);
        }
        return;
      case "line":
        g.lineStyle(d.width ?? 1, d.color, d.alpha ?? 1);
        g.lineBetween(d.x1, d.y1, d.x2, d.y2);
        return;
      case "stripes": {
        // Diagonal hazard stripes clipped to the box by drawing them as
        // short parallelograms that never leave it.
        g.fillStyle(d.color, d.alpha ?? 1);
        const step = 16;
        for (let x = d.x - d.h; x < d.x + d.w; x += step) {
          const x0 = Math.max(d.x, x);
          const x1 = Math.min(d.x + d.w, x + 7);
          const x2 = Math.min(d.x + d.w, x + 7 + d.h);
          const x3 = Math.max(d.x, x + d.h);
          if (x1 <= x0 && x2 <= x3) continue;
          g.fillPoints(
            [
              { x: x0, y: d.y },
              { x: x1, y: d.y },
              { x: x2, y: d.y + d.h },
              { x: x3, y: d.y + d.h },
            ],
            true,
          );
        }
        return;
      }
      case "dashrect": {
        g.lineStyle(1, d.color, d.alpha ?? 1);
        const dash = 6;
        for (let dx = 0; dx < d.w; dx += dash * 2) {
          g.lineBetween(d.x + dx, d.y, d.x + Math.min(dx + dash, d.w), d.y);
          g.lineBetween(d.x + dx, d.y + d.h, d.x + Math.min(dx + dash, d.w), d.y + d.h);
        }
        for (let dy = 0; dy < d.h; dy += dash * 2) {
          g.lineBetween(d.x, d.y + dy, d.x, d.y + Math.min(dy + dash, d.h));
          g.lineBetween(d.x + d.w, d.y + dy, d.x + d.w, d.y + Math.min(dy + dash, d.h));
        }
        return;
      }
      case "label": {
        const t = this.add
          .text(d.x, d.y, d.text, { fontFamily: "monospace", fontSize: `${d.size ?? 9}px`, color: d.color ?? PAL.label })
          .setOrigin(0.5)
          .setAlpha(d.alpha ?? 1);
        container.add(t);
        return;
      }
    }
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
    const x = this.f.points.muster.x - w / 2;
    const y = this.f.points.muster.y - h / 2;
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
    this.bayLabel = this.add.text(this.f.points.muster.x, this.f.points.muster.y, "BAY", { fontFamily: "monospace", fontSize: "10px", color: "#6b7d8a" }).setOrigin(0.5);
  }

  // The Rec Room table, 30 Aug 2026 — same dashed-marker instinct as
  // drawMusterPoint just above, but a circle instead of a rectangle
  // (RECROOM_TABLE_RADIUS), so it reads as a round table you gather AROUND
  // rather than another rectangular pad you stand ON, matching Maxime's own
  // "a table... they can go around."
  private drawRecroomTable() {
    const g = this.add.graphics();
    g.lineStyle(1, 0x6b7d8a, 0.7);
    const dash = 6;
    const circumference = 2 * Math.PI * RECROOM_TABLE_RADIUS;
    const steps = Math.max(8, Math.round(circumference / (dash * 2)));
    for (let i = 0; i < steps; i++) {
      const a0 = (i / steps) * Math.PI * 2;
      const a1 = a0 + (dash / RECROOM_TABLE_RADIUS);
      g.lineBetween(
        this.f.points.recroomTable.x + Math.cos(a0) * RECROOM_TABLE_RADIUS,
        this.f.points.recroomTable.y + Math.sin(a0) * RECROOM_TABLE_RADIUS,
        this.f.points.recroomTable.x + Math.cos(a1) * RECROOM_TABLE_RADIUS,
        this.f.points.recroomTable.y + Math.sin(a1) * RECROOM_TABLE_RADIUS,
      );
    }
    this.recroomTableOutline = g;
    this.recroomTableLabel = this.add.text(this.f.points.recroomTable.x, this.f.points.recroomTable.y, "TABLE", { fontFamily: "monospace", fontSize: "10px", color: "#6b7d8a" }).setOrigin(0.5);
  }

  // Tier 4, 30 Aug 2026 — same dash-drawing shape as drawMusterPoint just
  // above, one more time, at HANGAR_SHOP_POINT instead of MUSTER_POINT.
  private drawHangarShopPoint() {
    const w = 90;
    const h = 46;
    const x = this.f.points.hangarShop.x - w / 2;
    const y = this.f.points.hangarShop.y - h / 2;
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
    this.hangarShopOutline = g;
    this.hangarShopLabel = this.add
      .text(this.f.points.hangarShop.x, this.f.points.hangarShop.y, "ROSTER\n& GEAR", { fontFamily: "monospace", fontSize: "10px", color: "#6b7d8a", align: "center" })
      .setOrigin(0.5);
  }

  // 11 Sep 2026 — same dashed-outline treatment as drawHangarShopPoint just
  // above, at CREW_RECORDS_POINT instead. This point already worked
  // (isAtCrewRecords/openRosterPanel, B2, 5 Sep 2026) but had no floor
  // marker of its own, unlike every other walk-up console in this file —
  // the actual reason it read as missing rather than just unmarked.
  private drawCrewRecordsPoint() {
    const w = 90;
    const h = 46;
    const x = this.f.points.crewRecords.x - w / 2;
    const y = this.f.points.crewRecords.y - h / 2;
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
    this.crewRecordsOutline = g;
    this.crewRecordsLabel = this.add
      .text(this.f.points.crewRecords.x, this.f.points.crewRecords.y, "CREW\nRECORDS", { fontFamily: "monospace", fontSize: "10px", color: "#6b7d8a", align: "center" })
      .setOrigin(0.5);
  }

  // 2 Sep 2026 — the Workshop bench, same dashed-outline treatment
  // drawMusterPoint/drawHangarShopPoint above already established for
  // "a real console you walk up to." Third use of this shape, so the
  // geometry is copied deliberately rather than generalised: the two
  // existing ones differ only in position and label, and a shared helper
  // would be a refactor of already-shipped drawing code this pass has no
  // other reason to touch.
  private drawWorkshopBenchPoint() {
    const w = 90;
    const h = 46;
    const x = this.f.points.workshopBench.x - w / 2;
    const y = this.f.points.workshopBench.y - h / 2;
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
    this.workshopBenchOutline = g;
    this.workshopBenchLabel = this.add
      .text(this.f.points.workshopBench.x, this.f.points.workshopBench.y, "CARRIER\nMODULES", { fontFamily: "monospace", fontSize: "10px", color: "#6b7d8a", align: "center" })
      .setOrigin(0.5);
  }

  // The Vault plinth, 2 Sep 2026 — fourth use of the dashed-outline "walk-up
  // console" shape; same copy-not-refactor call drawWorkshopBenchPoint's own
  // comment already makes.
  private drawVaultPlinthPoint() {
    const w = 90;
    const h = 46;
    const x = this.f.points.vaultPlinth.x - w / 2;
    const y = this.f.points.vaultPlinth.y - h / 2;
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
    this.vaultPlinthOutline = g;
    this.vaultPlinthLabel = this.add
      .text(this.f.points.vaultPlinth.x, this.f.points.vaultPlinth.y, "THE\nVAULT", { fontFamily: "monospace", fontSize: "10px", color: "#6b7d8a", align: "center" })
      .setOrigin(0.5);
  }

  // The Archive console, 7 Sep 2026 — sixth use of the dashed-outline
  // "walk-up console" shape, copied rather than refactored for the reason
  // drawWorkshopBenchPoint's own comment gives. Sized to the table it sits
  // on, which is real furniture in both buildings and was there first: the
  // CIC's tactical table, and the Records room's reading table.
  private drawArchiveTablePoint() {
    const w = 150;
    const h = 76;
    const x = this.f.points.archiveTable.x - w / 2;
    const y = this.f.points.archiveTable.y - h / 2;
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
    this.archiveTableOutline = g;
    this.archiveTableLabel = this.add
      .text(this.f.points.archiveTable.x, this.f.points.archiveTable.y, "THE\nARCHIVE", { fontFamily: "monospace", fontSize: "10px", color: "#6b7d8a", align: "center" })
      .setOrigin(0.5);
  }

  // The standings board, 3 Sep 2026 — fifth use of the dashed-outline
  // "walk-up console" shape. Copied rather than refactored into a shared
  // helper, same call drawWorkshopBenchPoint's own comment already makes
  // and for the same reason: five near-identical twenty-line blocks are
  // easier to read and change independently than one parameterized one.
  private drawStandingsBoardPoint() {
    const w = 84;
    const h = 40;
    const x = this.f.points.recroomBoard.x - w / 2;
    const y = this.f.points.recroomBoard.y - h / 2;
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
    this.standingsBoardOutline = g;
    this.standingsBoardLabel = this.add
      .text(this.f.points.recroomBoard.x, this.f.points.recroomBoard.y, "THE\nBOARD", { fontFamily: "monospace", fontSize: "10px", color: "#6b7d8a", align: "center" })
      .setOrigin(0.5);
  }

  // Phase 2 map growth — one marker per DOORS entry, built once up front
  // (not rebuilt per room-switch) and toggled visible/hidden by
  // refreshRoomVisibility() depending on whether its own `room` matches
  // wherever the player currently is. Solid outline, distinct from the
  // bay's dashed one, same GDD §12.2 placeholder spirit either way.
  private buildDoors() {
    for (const d of this.f.doors) {
      // 3 Sep 2026 — a stair, drawn as a stair: a recessed well with four
      // treads, the destination on a plate beside it. The trigger point
      // (d.x, d.y) is the well's centre; DOOR_RADIUS reaches past the plate.
      const w = 56;
      const h = 40;
      const g = this.add.graphics();
      g.fillStyle(PAL.wallDark, 1);
      g.fillRect(d.x - w / 2, d.y - h / 2, w, h);
      g.lineStyle(1, PAL.wallLight, 0.8);
      g.strokeRect(d.x - w / 2, d.y - h / 2, w, h);
      g.lineStyle(2, PAL.metalLight, 0.9);
      for (let i = 1; i <= 4; i++) {
        const y = d.y - h / 2 + (h / 5) * i;
        g.lineBetween(d.x - w / 2 + 6, y, d.x + w / 2 - 6, y);
      }
      g.fillStyle(PAL.amber, 0.8);
      g.fillTriangle(d.x - 5, d.y + h / 2 - 6, d.x + 5, d.y + h / 2 - 6, d.x, d.y + h / 2 - 12);
      const label = this.add
        .text(d.x, d.y + h / 2 + 10, `▲ ${d.label}`, { fontFamily: "monospace", fontSize: "9px", color: "#8fd0ff" })
        .setOrigin(0.5)
        .setAlpha(0.9);
      this.doorMarkers.push({ def: d, outline: g, label });
    }
  }

  // Antfarm Grid v0's dashed room dividers and floating labels (27 Aug
  // 2026) are gone as of the 3 Sep 2026 floor-plan pass — real walls and
  // per-room labels are drawn by drawDeckLayout() now, inside each deck's
  // own container. zoneDecor stays as an (empty) list so
  // refreshRoomVisibility's toggle loop needs no change.
  private buildZoneDecor() {}

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
    for (const bay of this.f.reservedBays) {
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

  // Tier 3, 30 Aug 2026 (Consolidated Build Plan — Hub population driven
  // by the real roster). buildNpcs() below used to only ever place exactly
  // three pilots (NPC_SEED) and five Meks (mekSeeds), both hand-authored
  // fixed-position lists — fine when the cast was fixed, no help once it's
  // "however many pilots are actually active." This is the same
  // zone-random-point idea updateNpcRoaming's own explore branch already
  // uses to send a roaming NPC to a fresh destination inside a target room
  // (ROOM_ZONE_BOUNDS + a random draw + clampToDeckFloor, so the grotto's
  // own off-center elliptical floor — see GROTTO_BOUNDS's header — is
  // respected the same way it already is everywhere else), reused here for
  // an NPC's very first placement instead of a mid-roam destination — same
  // math, different caller, same "reuse over rebuild" instinct as
  // pickDoorApproach just generalizing pickDoorLanding a page up. Rejection
  // -sampled against occupants (this.npcs so far, or a mek pass's own
  // running list) the same way pickPointNearDoor already rejection-samples
  // door placements, so a large roster doesn't spawn stacked on itself.
  private pickInitialNpcSpot(room: RoomId, occupants: HubNpc[]): { x: number; y: number } {
    const zone = this.f.roomZone(room);
    let point = { x: zone.left, y: zone.top };
    for (let attempt = 0; attempt < DOOR_LANDING_MAX_ATTEMPTS; attempt++) {
      point = clampToDeckFloor(
        this.f.roomDeck(room),
        zone.left + Math.random() * (zone.right - zone.left),
        zone.top + Math.random() * (zone.bottom - zone.top),
        NPC_R,
      );
      const collides = occupants.some((o) => o.room === room && Phaser.Math.Distance.Between(point.x, point.y, o.x, o.y) < NPC_R + NPC_R);
      if (!collides) break;
    }
    return point;
  }

  private buildNpcs() {
    // Fixed starting layout inside the room — seats at the Rec Room table,
    // for the three hand-authored NPC_SEED pilots specifically (Bosk,
    // Anand, Iyari — a real, deliberate content choice, kept as-is by
    // Tier 3 below, not a limitation to design away). Stationary by
    // default (Phase 1 scope; general autonomous roaming is still Phase 3,
    // per the Build Plan doc's 25 Aug addendum) — the one exception is a
    // muster call, which walks an NPC to MUSTER_POINT (see
    // updateNpcMovement/sendToMuster). All three stay in Rec Room — see
    // the file header's own note on why the Phase 2 map growth doesn't
    // move or reassign them.
    // 3 Sep 2026, floor-plan pass — the three seats are now literally at
    // the Rec Room table (hubLayout.ts's RECROOM_SEATS: three chairs around
    // the round table's rim), the same table the mingle branch gathers
    // everyone else around, instead of three points spread across the
    // old open box.
    const positions = this.f.points.recroomSeats;

    // Tier 3, 30 Aug 2026 (Consolidated Build Plan — Hub population driven
    // by the real roster). This used to be `NPC_SEED.map(...)` — the
    // walkable pilot cast WAS the three-name NPC_SEED list, full stop.
    // That predates every roster addition since 26 Aug (Second Lance,
    // Third Lance, the ROSTER_DEPTH bench, every generated recruit —
    // engine/campaignState.ts's own integrateSecondLance/
    // integrateThirdLance/generateRecruit-shaped code all add real entries
    // to campaignState.pilots that this scene simply never looked at). A
    // mid-campaign roster is routinely 15-20+ active pilots; all but three
    // of them were alive, recruited, and sitting in state the whole time,
    // just never rendered. Fixed at the source: the walkable cast is now
    // every ACTIVE pilot actually in campaignState.pilots, minus
    // pilot_rourke — the player's own avatar (this.player, built further
    // down from the same WARDEN_PILOTS row), never a walkable NPC and
    // never in NPC_SEED for that same reason. NPC_SEED's three pilots keep
    // their own hand-authored seats and starting favorability/stress/
    // morale exactly as before (checked below via `namedSeed`); everyone
    // else gets a spot in a real room instead of not existing.
    const activePilotIds = Object.keys(this.campaignState.pilots).filter(
      (id) => id !== this.f.profile.mc.pilotId && this.campaignState.pilots[id].status === "active",
    );
    // Every room pickExploreTarget already treats as a real destination
    // (Object.keys(ROOM_TITLES) — see its own header) is fair game for a
    // newly-populated pilot's starting spot too, not just Rec Room —
    // reads as an actual crew going about the ship rather than everyone
    // freshly spawned in one place and slowly filtering out over time.
    // 3 Sep 2026 — ROAMABLE_ROOMS, not every RoomId: nobody spawns standing
    // in a corridor.
    const roomChoices = this.f.roamableRooms;
    this.npcs = [];
    for (const pilotId of activePilotIds) {
      const namedSeed = this.f.profile.regulars.find((s) => s.pilotId === pilotId);
      // Hotfix, 30 Aug 2026 (Maxime, screenshot: "2cd npic is the recruit
      // name not showing well" — a raw id like "pilot_recruit_3" rendered
      // straight onto the Hub floor as a name tag). This used to be
      // findPilot(pilotId), the STATIC roster index (data/pilotRegistry.ts's
      // PILOT_INDEX, built only from PILOTS/ROSTER_DEPTH_PILOTS/
      // WARDEN_PILOTS/SECOND_LANCE_PILOTS/THIRD_LANCE_PILOTS) — a
      // runtime-generated recruit (engine/campaignState.ts's generatePilot)
      // is never in any of those five lists, so findPilot() returned
      // undefined for one and displayName fell back to the raw id. The Mek
      // loop below already had this right: pilotEntry.pilot is the LIVE
      // per-campaign copy activePilotIds itself is built from, always
      // present and always complete for every id in that list, generated or
      // hand-authored — it replaces the static lookup outright here rather
      // than falling back to it.
      const pilotEntry = this.campaignState.pilots[pilotId];
      const pilot = pilotEntry.pilot;
      const displayName = pilot.displayName;
      const initials = pilotInitials(displayName);
      // Real, data-driven romanceable/Path — see HubNpc's own comment for
      // why romanceable used to be a hand-set boolean and isn't anymore.
      // `pilot` is always defined now (30 Aug 2026 hotfix above), so the
      // only miss left is archetypeId not resolving in UNIT_ARCHETYPES —
      // falls back to true/meeps (open/default) rather than throwing if
      // that ever happens. Hoisted above color/shape, 12 Sep 2026 (shape-
      // by-Path pass), since both now need it — used to only get computed
      // below, after color's own separate (and, for Path purposes, buggy —
      // see comment there) inline check.
      const archetype = UNIT_ARCHETYPES[pilot.archetypeId];
      const romanceable = archetype ? isRomanceableSpecies(archetype.species) : true;
      // Same fallback reasoning as romanceable just above — "human" only
      // if archetypeId somehow doesn't resolve, which shouldn't happen.
      const species: Species = archetype ? archetype.species : "human";
      // Path resolved via the archetype lookup just above, not the old
      // inline `archetypeId.includes("tank")/("reeps")` string-sniff this
      // replaced — that check only ever tested for "tank" and "reeps",
      // falling through to "meeps" every other time, Munti pilots
      // included, so every Munti NPC on this floor has always shown up
      // meeps-teal. Shape pass, 12 Sep 2026 (Maxime: "the circle with the
      // npc name that move, can we change their shape to match the
      // individual npc combat specialty, so its easy to see. thats my
      // tank guy, thats a meeps thats a reeps") — needed a real Path here
      // anyway for the new PATH_SHAPES lookup, so the colour miss above
      // got fixed as a side effect of that, not a separate deliberate
      // change.
      const pilotPath: Path = archetype?.path ?? "meeps";
      const color = PATH_COLORS[pilotPath];
      const shape = PATH_SHAPES[pilotPath];
      // pickInitialNpcSpot's own header covers the collision-rejection —
      // reads this.npcs live, so it correctly avoids whoever this same
      // loop has already placed, not just the three seated pilots.
      const room: RoomId = namedSeed ? this.f.profile.spawnRoom : roomChoices[Math.floor(Math.random() * roomChoices.length)];
      const pos = namedSeed ? positions[this.f.profile.regulars.indexOf(namedSeed)] : this.pickInitialNpcSpot(room, this.npcs);

      // 26 Aug 2026 — Favorability/Stress/Morale/socialLog/inRelationship
      // now come from CampaignState, not straight off the seed. First time
      // ever seeing this pilot (a brand-new campaign, or an old save from
      // before this pass), ensureHubSocialState seeds it from NPC_SEED's
      // own placeholder values below — identical to what this scene always
      // did — and every load after that hands back whatever was last
      // persisted instead. See the file header's "Correction" note and
      // campaignState.ts section 11 for the full design, including why
      // catalyst alone is deliberately NOT part of this.
      const social = ensureHubSocialState(
        this.campaignState,
        pilotId,
        namedSeed
          ? { favorability: namedSeed.favorability, stress: namedSeed.stress, morale: namedSeed.morale }
          // Tier 3, 30 Aug 2026 — the exact same generic "no hand-authored
          // row yet" starting point the Mek loop below already uses for
          // the identical situation, reused rather than inventing a
          // second placeholder triple for the same idea.
          : { favorability: 0, stress: 10, morale: 70 },
      );
      // drunk is derived from social.drunkUntil, not carried as its own
      // seeded boolean — a stale `true` sitting in an old save with no
      // expiry check yet run against it would otherwise read as drunk
      // forever the instant this field started persisting.
      const stillDrunk = !!social.drunkUntil && social.drunkUntil > Date.now();

      // Stage, wired 27 Aug 2026 (Maxime: "do the ranking path") — reads the
      // pilot's LIVE campaign tier so a promoted pilot actually speaks in
      // their new Stage's voice, not the one they started the campaign
      // with (engine/campaignEconomy.ts's purchaseTierUpgrade mutates it
      // mid-campaign). `pilot` IS that live copy as of the 30 Aug 2026
      // hotfix above, so this no longer needs its own separate static/live
      // fallback — `pilot.tier` directly, "green" only if that's somehow
      // falsy.
      const stage = pilot.tier ? stageFromTier(pilot.tier) : "green";

      // Emotional Brain Phase 3, 12 Sep 2026 — this pilot's own lean: the
      // archetype's base row plus whatever drift their memories have left,
      // relaxed by the in-game days since it was last touched. Read once
      // per Hub load (drift only moves at Debrief and at the Hub events
      // that write a memory, all of which rebuild or persist through this
      // same social object), and handed to pickSoloEcho through the
      // ambient state below.
      const echoDrift = settleDrift(social, calendarCurrentDay(this.campaignState));

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

      // B4, 5 Sep 2026 — drawPilotAvatar (TransporterPad.ts) swaps in a
      // real portrait when one exists, same circle+initials placeholder
      // otherwise. avatar.hitCircle is the SAME real Circle GameObject
      // `circle` used to be (still what every npc.circle.setInteractive()/
      // .disableInteractive() call site below operates on) — just now
      // possibly hidden under a portrait image rather than always visibly
      // filled. Nested at local (0,0) inside `root` alongside nameTag,
      // same structure the bare circle+label used to have.
      // Hub Floor Portrait Revert, 6 Sep 2026 — forcePlaceholder: true (see
      // drawPilotAvatar's own header, TransporterPad.ts). Only this floor;
      // Transporter Pad/Roster/Memorial/Debrief keep showing this same
      // pilot's real portrait unchanged.
      const avatar = drawPilotAvatar(this, 0, 0, NPC_R, pilotId, displayName, color, undefined, true, shape);
      const circle = avatar.hitCircle;
      const nameTag = this.add
        .text(0, NPC_R + 12, displayName.split("—")[0].trim(), { fontFamily: "monospace", fontSize: "9px", color: TEXT_DIM })
        .setOrigin(0.5);
      const root = this.add.container(pos.x, pos.y, [avatar.container, nameTag]);

      const favLabel = this.add.text(pos.x, pos.y - NPC_R - 14, "", { fontFamily: "monospace", fontSize: "9px", color: "#facc15" }).setOrigin(0.5).setVisible(false);
      const bubbleContainer = this.add.container(pos.x, pos.y - NPC_R - 30).setVisible(false);

      this.npcs.push({
        pilotId,
        displayName,
        initials,
        color,
        room,
        x: pos.x,
        y: pos.y,
        // worried computed fresh here too, same as stillDrunk just above,
        // so an NPC reads correctly from the very first frame rather than
        // waiting on update()'s own updateMissionWorry() to catch up one
        // tick later — see isMissionWorrySignal's own header.
        //
        // catalystForPilot (Tier 3, 30 Aug 2026 — see this file's own
        // import comment) returns namedSeed's exact catalyst for the three
        // hand-authored pilots and a stable, deterministic pick for
        // everyone else, so this is behavior-identical to the old
        // `catalyst: seed.catalyst` for Bosk/Anand/Iyari specifically.
        // `pilot.background` (9 Sep 2026, the Catalyst Gauntlet recruit
        // generator) is undefined for every named pilot — only a
        // generated recruit carries one — so this changes nothing for
        // Bosk/Anand/Iyari/etc. and gives a shop recruit their real,
        // background-derived catalyst instead of the old hash pick.
        ambient: {
          catalyst: catalystForPilot(pilotId, pilot.background),
          stage,
          stress: social.stress,
          morale: social.morale,
          drunk: stillDrunk,
          worried: isMissionWorrySignal(this.campaignState),
          echoLean: effectiveEchoLean(catalystForPilot(pilotId, pilot.background), echoDrift),
        },
        favorability: social.favorability,
        circle,
        root,
        favLabel,
        bubbleContainer,
        bubbleUntil: 0,
        romanceable,
        species,
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
        // Anger Blowup, 28 Aug 2026 — same staggering instinct, independent
        // offset again.
        nextBlowupAt: Math.random() * 4000,
        pendingStagePromotion,
        pendingRankGreeting,
        // Needs Counter — always starts fully fine (spec §5, not persisted).
        hunger: 100,
        thirst: 100,
        sleep: 100,
        boredom: 100,
        // Same staggering instinct as nextRoamAt/nextEncounterAt above.
        nextNeedsTickAt: Math.random() * 4000,
        // Breakdown, 28 Aug 2026 — same staggering instinct one more time.
        // breakdown/breakdownSince stay unset — nobody starts the scene
        // mid-crisis.
        nextBreakdownCheckAt: Math.random() * 4000,
      });
    }

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
    // 6 Sep 2026, facility split — name, colour, species, catalyst, Stage,
    // room and social seed all come from the profile's `co` block
    // (facilityWarden.ts carries Arangement's, with the reasoning that used
    // to sit here; facilityHouseAmaranth.ts carries Verinis's). What stays
    // here is the plumbing: how a CO becomes a HubNpc.
    const co = this.f.profile.co;
    const coDisplayName = co.displayName;
    const coInitials = pilotInitials(coDisplayName);
    const CO_COLOR = co.color;
    const coSocial = ensureHubSocialState(this.campaignState, CO_PILOT_ID, co.socialSeed);
    // Grotto's open floor, off the x=480 line both stair markers sit on
    // (recroom/workshop hops land at (480,130)/(480,530) — see DOORS) so he
    // doesn't block the direct walking line between them.
    // 3 Sep 2026 — on the dais at the grotto's centre (hubLayout.ts's
    // CO_POINT), where the floor plan draws it.
    const coPos = this.f.points.co;
    // B4, 5 Sep 2026 — drawPilotAvatar (TransporterPad.ts). CO_PILOT_ID
    // matches neither the named-portrait nor generated-recruit id shapes
    // in engine/portraits.ts, so this always falls back to the placeholder
    // circle+initials, unchanged from before — no real portrait exists for
    // him, correctly.
    // Hub Floor Portrait Revert, 6 Sep 2026 — forcePlaceholder: true set
    // explicitly anyway, redundant with the above today but on purpose: so
    // a real CO portrait added later doesn't silently start rendering on
    // this floor without whoever adds it remembering this revert exists.
    const coAvatar = drawPilotAvatar(this, 0, 0, NPC_R, CO_PILOT_ID, coDisplayName, CO_COLOR, undefined, true);
    const coCircle = coAvatar.hitCircle;
    const coNameTag = this.add
      .text(0, NPC_R + 12, coDisplayName, { fontFamily: "monospace", fontSize: "9px", color: TEXT_DIM })
      .setOrigin(0.5);
    const coRoot = this.add.container(coPos.x, coPos.y, [coAvatar.container, coNameTag]);
    const coFavLabel = this.add.text(coPos.x, coPos.y - NPC_R - 14, "", { fontFamily: "monospace", fontSize: "9px", color: "#facc15" }).setOrigin(0.5).setVisible(false);
    const coBubbleContainer = this.add.container(coPos.x, coPos.y - NPC_R - 30).setVisible(false);

    this.npcs.push({
      pilotId: CO_PILOT_ID,
      displayName: coDisplayName,
      initials: coInitials,
      color: CO_COLOR,
      room: co.room,
      x: coPos.x,
      y: coPos.y,
      // Wolf — was "bear" (a placeholder pick, same "not a locked content
      // decision" caveat npcSeed.ts already carries for the other three).
      // Flipped 1 Sep 2026 once he got a real background: roster doc §4.3
      // (claude_Bloom_Wars_NPC_Catalyst_Formula_Closing_And_Roster_Assignments_v1.md)
      // resolves his Sector/Planet/Birthplace Texture/Academy to
      // Mid-Rim/Sheltered — Saturn on the Planet-12 table, which the
      // formula's §2 pairs with Wolf, not Bear. Reads better for a CO
      // besides: the duty-bound, team-first steadiness of Saturn/Wolf is
      // closer to what running a whole complement actually asks of him
      // than Bear's isolation ever was. Hardcoded here rather than looked
      // up via catalystForPilot() — same as before this change — since
      // he's a standalone HubNpc, not a WARDEN_PILOTS roster entry
      // (BACKGROUND_CATALYST_ASSIGNMENTS in npcSeed.ts doesn't list him
      // for the same reason; see that map's own header).
      // Stage hardcoded "command" rather than tier-derived — he isn't on
      // the WARDEN_PILOTS tier-promotion track this scene's other Stage
      // logic assumes, and "command" is the fitting register regardless.
      ambient: { catalyst: co.catalyst, stage: co.stage, stress: coSocial.stress, morale: coSocial.morale, drunk: false, worried: isMissionWorrySignal(this.campaignState) },
      favorability: coSocial.favorability,
      circle: coCircle,
      root: coRoot,
      favLabel: coFavLabel,
      bubbleContainer: coBubbleContainer,
      bubbleUntil: 0,
      romanceable: isRomanceableSpecies(co.species),
      species: co.species,
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
      // permanently 100/100/100/100 rather than opting into a system built
      // for pilots' off-duty life.
      hunger: 100,
      thirst: 100,
      sleep: 100,
      boredom: 100,
    });

    // Meks as walkable Hub NPCs — Mek NPC Introduction Plan v1, 29 Aug
    // 2026. First slice: the 5 Act I Meks (WARDEN_PILOTS' own matched
    // mekId records — Rourke/Bosk/Iyari/Anand/Lask), not the full eventual
    // roster — the plan doc's own §2 flags "up to 20 named characters" as
    // real content volume, so this ships the smallest real slice first
    // rather than all of it at once, same order this project already used
    // once for NPC_SEED itself (Canon Pass §H — bench pilots came later,
    // not at once). Second/Third Lance Meks (10 more) are deliberately
    // deferred, not forgotten.
    //
    // Deliberately NOT folded into NPC_SEED (data/npcSeed.ts) — same exact
    // reasoning the Carrier CO just above already gives for why HE isn't
    // in there either: NPC_SEED also feeds the headless social-sim
    // harness's mission-pairing events, which don't apply to a Mek who
    // never deploys, and a mekId would fail every WARDEN_PILOTS/
    // UNIT_ARCHETYPES lookup that loop runs. Built as standalone HubNpc
    // entries instead, same as the CO, pushed into this same this.npcs
    // array so every generic room/visibility/proximity/dialogue/roaming
    // system already keyed off that array picks them up for free.
    //
    // Placed in the workshop room (Upper deck, ROOM_ZONE_BOUNDS.workshop)
    // — Section 3 of the plan doc: the room already exists, walkable,
    // today; what's been missing is anyone actually staffing it.
    // Positions sit well clear of the workshop-to-grotto door (480, 130 —
    // see DOORS above).
    //
    // Unlike the CO, these DO roam (nextRoamAt/nextEncounterAt/etc. all
    // set below, not left undefined) — plan doc §2: "Otherwise they can
    // roam," the same ambient movement code as any deployable pilot.
    //
    // CORRECTED 30 Aug 2026 (Maxime: "mek need to stay in the workshop
    // unless they are sleeping or eating") — "otherwise roam" turns out to
    // mean roam WITHIN the Workshop and to their own needs' rooms, not the
    // whole ship: homeRoom "workshop" below is what actually enforces that
    // now (see its own field comment, updateNpcRoaming). Still uses the
    // exact same movement/encounter machinery as a deployable pilot — this
    // only narrows WHERE the explore branch is allowed to send them, not
    // which system does it.
    //
    // No bespoke dialogue content this pass, matching the CO's own launch
    // precedent just above (he shipped with zero bespoke lines too, only a
    // catalyst + Stage) — the generic catalyst/Stage ambient pool already
    // covers them. Stage hardcoded "blooded" for all five, same "not on
    // the WARDEN_PILOTS tier-promotion track, so tier-derivation doesn't
    // apply" reasoning as the CO's own "command" pick — "blooded" reads as
    // established crew who've been through Act I's fighting, without
    // claiming a leadership register that isn't theirs.
    //
    // romanceable — REVERSED 9 Sep 2026, Maxime's own call, prompted by a
    // real playtest hit: a flirt attempt on a Mek got the generic chat-
    // fallback shrug, which never reaches this flag at all (the typed
    // phrase didn't match any recognized verb) — that's what actually
    // surfaced the question of whether a Mek could even say yes. Used to
    // be a hardcoded false on the premise that a Mek's Matchset bond to
    // their own pilot precluded outside romance regardless of species.
    // Corrected: Matchset pairs default OPEN in this fiction — Maxime's own
    // words, "open couple like happen in environment with lots of
    // adrenaline and dangers, most of the pair family are cool with
    // exploring other option" — so a Mek is romanceable on the exact same
    // rule as everyone else, isRomanceableSpecies() off their own pilot's
    // species (mekRomanceable below), Hiopi/Carabil still capping at
    // close-friend same as always. inRelationship stays false regardless
    // (below, unchanged) — the Matchset pairing itself still lives in
    // npcSocial.relationships, not this field, so the game still never
    // claims a Mek is "already together" with the player just because
    // they're bonded to their own pilot; romance.ts's ALREADY_TOGETHER_LINES
    // ("You already have me") would misstate who that bond is actually
    // with, which is why alreadyInRelationship isn't the mechanism here.
    //
    // Catalyst picks are placeholders, same "not a locked content
    // decision" caveat npcSeed.ts's own NPC_SEED/NPC_BOND_SEED already
    // carry — chosen for voice variety across the five, not tied to any
    // MekTrack specialization.
    // 6 Sep 2026, facility split — the hand-placed list is the profile's
    // (facilityWarden.ts's mekSeeds: Warden's five Act I Meks, each in front
    // of their own cradle along the workshop's aft wall, 3 Sep 2026). Each
    // seed names a room and a cradle index; the coordinates are the
    // profile's mekSpots for that room.
    const mekSeeds = this.f.profile.mekSeeds.map((seed) => {
      const spot = this.f.mekSpots(seed.room)[seed.spot];
      if (!spot) throw new Error(`${this.f.profile.sceneKey}: mek seed ${seed.mekId} names cradle ${seed.spot} in ${seed.room}, which has no such spot`);
      return { mekId: seed.mekId, pilotId: seed.pilotId, catalyst: seed.catalyst, room: seed.room, x: spot.x, y: spot.y };
    });

    // Mek scope decision follow-through, 1 Sep 2026
    // (claude/Bloom_Wars_Build_Log_Addendum_MekScopeDecision_01Sep2026.md).
    // The generic loop after the hand-placed one already covers every
    // active pilot's Mek; the one real gap was that the un-seeded ten fell
    // through to catalystForPilot()'s deterministic hash instead of a
    // hand-picked catalyst. The profile's mekCatalysts closes that gap
    // (facilityWarden.ts carries Warden's ten picks and the CATALYST_CLASH_
    // PAIRS re-check that swapped mek_solheim from "shark" to "dog"). Anyone
    // not listed (a future lance, a generated recruit) keeps the safe hash
    // fallback.
    // 9 Sep 2026 — the precedence rule itself (seed catalyst, then the
    // profile's overrides, then catalystForPilot) now lives in
    // engine/facility.ts's mekCatalystFor, shared with the Archive's Mek
    // dossier so the floor and the file can never disagree.

    for (const seed of mekSeeds) {
      const pilotEntry = this.campaignState.pilots[seed.pilotId];
      // A Mek is never lost to combat, only retires the instant their own
      // matched pilot does (plan doc §4) — so "matched pilot still active" is the
      // one and only gate on whether this Mek still has a body standing
      // here. See engine/campaignState.ts's applyPermadeathCheck for the
      // status flip itself and why nothing on the Mek record needs to
      // mirror it separately.
      if (!pilotEntry || pilotEntry.status !== "active") continue;

      // Species-driven, same pattern the ordinary pilot loop already uses
      // (see isRomanceableSpecies() above) — a Mek shares their own
      // pilot's species per the plan doc's own assumption, so deriving off
      // pilotEntry.pilot.archetypeId rather than hand-setting is the same
      // anti-drift guarantee that check already gives everyone else.
      const mekArchetype = UNIT_ARCHETYPES[pilotEntry.pilot.archetypeId];
      const mekRomanceable = mekArchetype ? isRomanceableSpecies(mekArchetype.species) : true;
      const mekSpecies: Species = mekArchetype ? mekArchetype.species : "human";

      const mek = this.campaignState.meks[seed.mekId];
      const displayName = mek?.displayName ?? `${pilotEntry.pilot.displayName.split("—")[0].trim()}'s Mek`;
      const initials = pilotInitials(displayName);
      const color = 0x6a8f6a; // muted workshop green — distinct from PATH_COLORS (not a combat archetype) and the CO's brass, own placeholder pick

      // Own player-facing favorability/social-log axis, same shape as the
      // CO's coSocial just above — see this file's header on why this
      // doesn't actually persist across a full reload yet (npc_co has the
      // exact same gap today; not a new limitation this pass introduces).
      const mekSocial = ensureHubSocialState(this.campaignState, seed.mekId, { favorability: 0, stress: 10, morale: 70 });

      // Matchset bond with their own pilot (plan doc §2 — "a direct, cheap
      // use of npcBonds.ts"). Backfilled here rather than seeded through
      // NPC_BOND_SEED: an already-in-progress campaign's npcSocial state
      // was created before this pair existed, and ensureNpcSocialState
      // only ever applies ITS OWN seed argument the very first time
      // state.npcSocial doesn't exist at all (see its own comment) — a
      // save that already has an npcSocial object would never pick up a
      // brand-new NPC_BOND_SEED entry. Writing it directly here, guarded
      // on "not already set," is correct either way: a fresh campaign
      // (fires once, first Hub visit) and an in-progress one (fires once,
      // the first Hub visit after this patch) both land on the same
      // value, and neither overwrites a value gameplay has since moved.
      const matchKey = pairKey(seed.mekId, seed.pilotId);
      if (this.npcSocial.bonds[matchKey] === undefined) {
        this.npcSocial.bonds[matchKey] = MEK_MATCHSET_BOND;
      }
      // Registers the pairing as NPC-NPC "together," same array
      // engine/socialSim.ts's isCommitted() already reads — the actual
      // reason this exists: without it, the background social-sim pass
      // has no way to know these two are spoken for and could otherwise
      // try to pair a Mek (or their own bonded pilot) with someone else.
      if (!this.npcSocial.relationships.includes(matchKey)) {
        this.npcSocial.relationships.push(matchKey);
      }

      const pos = { x: seed.x, y: seed.y };
      // B4, 5 Sep 2026 — drawPilotAvatar (TransporterPad.ts). seed.mekId is
      // a `mek_<surname>` id, not `pilot_<surname>`, so this always falls
      // back to the placeholder circle+initials — correctly: B4 only ever
      // scoped portraits for the 15 named PILOTS, never the Mek/mechanic
      // characters, so no art exists for them and none should be implied.
      // Hub Floor Portrait Revert, 6 Sep 2026 — forcePlaceholder: true set
      // here too, same "no-op today, real insurance later" reasoning as
      // the CO's own call site above; not named in the original proposal
      // (which only checked the pilot/CO/player call sites), added for
      // consistency across every avatar this floor draws.
      const avatar = drawPilotAvatar(this, 0, 0, NPC_R, seed.mekId, displayName, color, undefined, true);
      const circle = avatar.hitCircle;
      const nameTag = this.add.text(0, NPC_R + 12, displayName, { fontFamily: "monospace", fontSize: "9px", color: TEXT_DIM }).setOrigin(0.5);
      const root = this.add.container(pos.x, pos.y, [avatar.container, nameTag]);
      const favLabel = this.add.text(pos.x, pos.y - NPC_R - 14, "", { fontFamily: "monospace", fontSize: "9px", color: "#facc15" }).setOrigin(0.5).setVisible(false);
      const bubbleContainer = this.add.container(pos.x, pos.y - NPC_R - 30).setVisible(false);

      this.npcs.push({
        pilotId: seed.mekId,
        displayName,
        initials,
        color,
        room: seed.room,
        homeRoom: seed.room,
        x: pos.x,
        y: pos.y,
        ambient: { catalyst: seed.catalyst, stage: "blooded", stress: mekSocial.stress, morale: mekSocial.morale, drunk: false, worried: isMissionWorrySignal(this.campaignState) },
        favorability: mekSocial.favorability,
        circle,
        root,
        favLabel,
        bubbleContainer,
        bubbleUntil: 0,
        romanceable: mekRomanceable,
        species: mekSpecies,
        // "With the player" axis — see this block's own header comment on
        // why the Matchset pairing itself lives in npcSocial.relationships
        // instead, not here.
        inRelationship: false,
        socialLog: mekSocial.socialLog,
        nextRoamAt: Math.random() * 4000,
        nextEncounterAt: Math.random() * 4000,
        nextBlowupAt: Math.random() * 4000,
        hunger: 100,
        thirst: 100,
        sleep: 100,
        boredom: 100,
        nextNeedsTickAt: Math.random() * 4000,
        nextBreakdownCheckAt: Math.random() * 4000,
      });
    }

    // Tier 3, 30 Aug 2026 (Consolidated Build Plan — Hub population driven
    // by the real roster). mekSeeds above is the same kind of fixed,
    // five-name list the old pilot loop's NPC_SEED was — kept exactly as
    // it was, on purpose, for its own hand-picked catalyst/position per
    // Mek — but every OTHER active pilot's own Mek was simply never given
    // a body in the Workshop at all, the identical gap one level down.
    // Reuses activePilotIds (computed once, near the top of this method)
    // rather than re-deriving "who's active" a second way — it already
    // excludes pilot_rourke and anyone not status "active"; the Mek for
    // pilot_rourke himself is still mekSeeds' own job, placed by the loop
    // just above, unaffected by activePilotIds not including him.
    const namedMekPilotIds = new Set(mekSeeds.map((s) => s.pilotId));
    // 6 Sep 2026, facility split — the MC's own Mek joins this loop's
    // candidates. activePilotIds excludes the MC on purpose (the player is
    // never a walkable NPC), and Warden's profile hand-places mek_rourke in
    // mekSeeds so this line changes nothing there; a profile with NO
    // hand-placed Meks (House Amaranth's, today) would otherwise leave the
    // Colonel's own Mek off the floor while every other pilot's stands in
    // the works — caught by checkHubHouseAmaranth.mjs's cast count.
    const mcEntry = this.campaignState.pilots[this.f.profile.mc.pilotId];
    const mekPilotIds = mcEntry && mcEntry.status === "active" ? [...activePilotIds, this.f.profile.mc.pilotId] : activePilotIds;
    for (const pilotId of mekPilotIds) {
      if (namedMekPilotIds.has(pilotId)) continue; // already placed above, with its own hand-picked catalyst/spot
      const pilotEntry = this.campaignState.pilots[pilotId];
      // romanceable — same 9 Sep 2026 reversal and reasoning as the
      // mekSeeds loop above (see its own header comment for the full
      // account): a Mek's Matchset bond no longer precludes outside
      // romance in this fiction, so this derives off their own paired
      // pilot's species exactly the way that loop does.
      const mekArchetype = UNIT_ARCHETYPES[pilotEntry.pilot.archetypeId];
      const mekRomanceable = mekArchetype ? isRomanceableSpecies(mekArchetype.species) : true;
      const mekSpecies: Species = mekArchetype ? mekArchetype.species : "human";
      const mekId = pilotEntry.pilot.mekId;
      const mek = this.campaignState.meks[mekId];
      const displayName = mek?.displayName ?? `${pilotEntry.pilot.displayName.split("—")[0].trim()}'s Mek`;
      const initials = pilotInitials(displayName);
      const color = 0x6a8f6a; // same muted workshop green as every other Mek — not a combat archetype, no PATH_COLORS entry applies

      const mekSocial = ensureHubSocialState(this.campaignState, mekId, { favorability: 0, stress: 10, morale: 70 });

      // Matchset bond with their own pilot — identical shape to the
      // mekSeeds loop's own bond-backfill just above, see its comment for
      // the full "why write it here, guarded on not-already-set" reasoning.
      const matchKey = pairKey(mekId, pilotId);
      if (this.npcSocial.bonds[matchKey] === undefined) {
        this.npcSocial.bonds[matchKey] = MEK_MATCHSET_BOND;
      }
      if (!this.npcSocial.relationships.includes(matchKey)) {
        this.npcSocial.relationships.push(matchKey);
      }

      // A workshop, same as every named Mek — thematically Meks stay tied
      // to their maintenance bay even though (unlike pilots, scattered
      // ship-wide by the loop above) they don't otherwise roam the whole
      // ship on their own errands.
      //
      // Carrier Scale-Up Plan v1 Phase 2, 3 Sep 2026 — WHICH workshop is
      // now this Mek's own lance's, not a single shared room. This is the
      // actual crowding fix the Plan doc is about: at the 15-pilot midgame
      // this seeding loop was built for (Tier 3, 30 Aug), every one of
      // those Meks used to stand in the same 420x444 room as Lance A's
      // five. The five hand-placed Act I Meks above keep their own
      // hand-picked spots in Lance A's workshop unchanged — they ARE
      // Warden Company, so their lance and their coordinates already
      // agree, and re-deriving a room for them would only risk moving a
      // deliberately-placed body somewhere it wasn't drawn for.
      // lanceOfMekIn, not lanceOfMek (B2, 5 Sep 2026) — reads the pilot's
      // LIVE lance assignment so a reassigned pilot's Mek is seeded into
      // that lance's workshop, per Maxime's "the Mek follows the pilot."
      // Falls back to the static answer for any mek whose pilot can't be
      // resolved, so this is never worse than what it replaces.
      const workshopRoom = this.workshopRoomFor(lanceOfMekIn(this.campaignState, mekId));
      // 3 Sep 2026 — the first free cradle in that workshop (hubLayout.ts's
      // MEK_SPOTS, five per room), else a random clear spot. A cradle is
      // "free" if no Mek already stands within a body's width of it.
      const cradle = this.f.mekSpots(workshopRoom).find(
        (spot) => !this.npcs.some((n) => n.room === workshopRoom && Phaser.Math.Distance.Between(spot.x, spot.y, n.x, n.y) < NPC_R * 2),
      );
      const pos = cradle ?? this.pickInitialNpcSpot(workshopRoom, this.npcs);
      // B4, 5 Sep 2026 — drawPilotAvatar (TransporterPad.ts). mekId is a
      // `mek_<surname>` id, never a portrait match (see the other workshop
      // loop's own comment above) — always falls back to the placeholder.
      // Hub Floor Portrait Revert, 6 Sep 2026 — forcePlaceholder: true, same
      // reasoning as the other Mek loop just above.
      const avatar = drawPilotAvatar(this, 0, 0, NPC_R, mekId, displayName, color, undefined, true);
      const circle = avatar.hitCircle;
      const nameTag = this.add.text(0, NPC_R + 12, displayName, { fontFamily: "monospace", fontSize: "9px", color: TEXT_DIM }).setOrigin(0.5);
      const root = this.add.container(pos.x, pos.y, [avatar.container, nameTag]);
      const favLabel = this.add.text(pos.x, pos.y - NPC_R - 14, "", { fontFamily: "monospace", fontSize: "9px", color: "#facc15" }).setOrigin(0.5).setVisible(false);
      const bubbleContainer = this.add.container(pos.x, pos.y - NPC_R - 30).setVisible(false);

      this.npcs.push({
        pilotId: mekId,
        displayName,
        initials,
        color,
        room: workshopRoom,
        homeRoom: workshopRoom,
        x: pos.x,
        y: pos.y,
        // catalystForPilot works off any string id via its deterministic
        // hash fallback (see npcSeed.ts's own header) — feeding it mekId
        // rather than pilotId gives this Mek its own independent-but-
        // stable catalyst, not a copy of their pilot's. `mek?.background`
        // (9 Sep 2026, the Catalyst Gauntlet recruit generator) is only
        // ever set on a generated recruit's Mek — the profile's own
        // overrides still win for every named Mek that has one, unaffected.
        ambient: { catalyst: mekCatalystFor(this.f.profile, mekId, mek?.background), stage: "blooded", stress: mekSocial.stress, morale: mekSocial.morale, drunk: false, worried: isMissionWorrySignal(this.campaignState) },
        favorability: mekSocial.favorability,
        circle,
        root,
        favLabel,
        bubbleContainer,
        bubbleUntil: 0,
        romanceable: mekRomanceable,
        species: mekSpecies,
        inRelationship: false,
        socialLog: mekSocial.socialLog,
        nextRoamAt: Math.random() * 4000,
        nextEncounterAt: Math.random() * 4000,
        nextBlowupAt: Math.random() * 4000,
        hunger: 100,
        thirst: 100,
        sleep: 100,
        boredom: 100,
        nextNeedsTickAt: Math.random() * 4000,
        nextBreakdownCheckAt: Math.random() * 4000,
      });
    }

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
    this.checkMekRetirement();
    this.checkHeirloomRecall();
    this.checkVaultDedication();
    this.drainPendingHotTopics();
  }

  // Mission chat's mailbox, 12 Sep 2026 — topics raised inside a Battle
  // (today: an Insult reaching Tier 2 mid-mission) land on
  // CampaignState.pendingHotTopics because there's no live Hub list to
  // push into from there; this moves them into this.hotTopics on arrival,
  // same one-shot shape as the four checks above it, and saves the cleared
  // mailbox at once so a reload can't re-deliver them.
  private drainPendingHotTopics() {
    const queued = drainPendingHotTopics(this.campaignState);
    if (queued.length === 0) return;
    for (const topic of queued) this.hotTopics.push(topic);
    saveCampaignState(this.campaignState);
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

  // Mek retirement hot topic, 29 Aug 2026 (Mek NPC Introduction Plan v1
  // §4). Same one-shot, full-roster-scan shape as checkMuntiLoss() just
  // above — a retired Mek isn't in this.npcs any more than a permanently
  // lost pilot is (the Mek-seeding loop in buildNpcs() above already
  // excludes them the moment their matched pilot's status flips), so there's no
  // one left to self-announce it. Scans every pilot CampaignState actually
  // knows about for one whose death has already retired their Mek (see
  // engine/campaignState.ts's applyPermadeathCheck) but hasn't had that
  // surfaced as gossip yet.
  //
  // Deliberately NOT gated on "was this one of the 5 Act I Meks with an
  // actual walkable body" — every one of the 15 static pilots already has
  // a real, named mekId (data/campaignAmaranth.ts), so the retirement
  // itself, and the gossip about it, are both true regardless of whether
  // that particular Mek ever had a body standing in the Workshop this
  // campaign. Decoupling those two on purpose: extending the walkable
  // roster later (Second/Third Lance) should never be a prerequisite for
  // this half already being correct.
  private checkMekRetirement() {
    for (const pilotId of Object.keys(this.campaignState.pilots)) {
      const entry = this.campaignState.pilots[pilotId];
      if (entry.status !== "permanently_lost") continue;
      const mek = this.campaignState.meks[entry.pilot.mekId];
      // No mekId on record at all — shouldn't happen for any of the 15
      // static pilots (all pre-assigned, see data/campaignAmaranth.ts),
      // but a discretionary recruit generated straight into the roster
      // (recruitDiscretionary) could plausibly lack a real mek entry;
      // fails open to "nothing to retire, nothing to announce" rather
      // than assuming one exists.
      if (!mek) continue;
      const social = ensureHubSocialState(this.campaignState, pilotId, { favorability: 0, stress: 0, morale: 0 });
      if (social.mekRetirementAnnounced) continue;
      social.mekRetirementAnnounced = true;
      // Saved immediately, same reasoning as checkMuntiLoss's own save
      // call above — ambient gossip any nearby NPC can surface, not a
      // direct one-on-one reveal, so there's no "don't mark it seen too
      // early" risk to weigh.
      saveCampaignState(this.campaignState);
      this.hotTopics.push({
        kind: "mekRetired",
        aboutPilotId: pilotId,
        aboutName: entry.pilot.displayName.split("—")[0].trim(),
        childWithMek: !!entry.hasChildWithMek,
        at: Date.now(),
        mentionedBy: [],
      });
    }
  }

  // Heirloom recall hot topic, 2 Sep 2026. Same one-shot, full-roster-scan
  // shape as checkMekRetirement above, for the same kind of event: a thing
  // that happens off-screen the instant a pilot is permanently lost, and
  // that nothing else in the game would ever tell the player about.
  //
  // Before this, a recall happened in total silence — fieldHeirloom simply
  // started refusing and the button greyed out. That is the moment the
  // arrangement shows its teeth (the company never owned the weapon, it
  // borrowed one through somebody's child), so it is worth a beat.
  //
  // Driven off heirloomHouseVerdicts rather than off returnedHeirlooms:
  // that reader already skips a holder who left without dying (a
  // reassignment is not a grievance) and already resolves how the family
  // took it, so this method never has to know the scoring rules. What it
  // does know is that a verdict exists, which is exactly the condition for
  // there being something to gossip about.
  private checkHeirloomRecall() {
    for (const verdict of heirloomHouseVerdicts(this.campaignState)) {
      const entry = this.campaignState.pilots[verdict.pilotId];
      if (!entry) continue;
      const social = ensureHubSocialState(this.campaignState, verdict.pilotId, { favorability: 0, stress: 0, morale: 0 });
      if (social.heirloomRecallAnnounced) continue;
      social.heirloomRecallAnnounced = true;
      // Saved immediately, same reasoning as checkMuntiLoss and
      // checkMekRetirement above: ambient gossip, not a one-on-one reveal.
      saveCampaignState(this.campaignState);
      this.hotTopics.push({
        kind: "heirloomRecalled",
        aboutPilotId: verdict.pilotId,
        aboutName: entry.pilot.displayName.split("—")[0].trim(),
        houseName: verdict.house,
        heirloomName: HEIRLOOMS[verdict.heirloomId]?.displayName ?? "the heirloom",
        verdictClause: HOUSE_VERDICT_CLAUSES[verdict.verdict],
        at: Date.now(),
        mentionedBy: [],
      });
    }
  }

  // Mission 12's Vault scene, 2 Sep 2026 (Vault Build Plan v1, Decision 3 —
  // one-shot check for EA). Deliberately NOT shaped like the hot-topic
  // checks just above (checkMuntiLoss/checkMissionEcho/checkMekRetirement/
  // checkHeirloomRecall): this scene is written up as "load-bearing, not
  // skippable" (Antfarm Carrier Hub §8), and this.hotTopics is a
  // probabilistic ~60%-chance-per-NPC surface — genuinely fine for ambient
  // gossip, wrong for the one scene the design explicitly won't let be
  // missed. So this only resolves state (all the real logic lives in
  // resolveVaultDedication, same engine/scene split every other function in
  // this class keeps); GUARANTEED delivery is renderVault()'s job, which
  // shows the dedication panel every time the Vault is opened until the
  // player has actually seen it once (state.vaultDedication.seen).
  private checkVaultDedication() {
    const result = resolveVaultDedication(this.campaignState);
    if (!result) return;
    // Saved immediately, same instinct as every other one-shot flip in this
    // class — the resolution itself (who's memorialised, whether Gjallar
    // transferred) must never be re-rolled by a reload before the player's
    // even seen the Vault.
    saveCampaignState(this.campaignState);
  }

  private buildPlayer() {
    // Derived from the real WARDEN_PILOTS record rather than hardcoded —
    // caught in review, 25 Aug 2026: an earlier draft hardcoded "DR" here
    // while every NPC correctly derived initials from pilotInitials(). Same
    // convention as the NPCs, not a special case for the player. B4, 5 Sep
    // 2026: drawPilotAvatar below now derives initials itself (only ever
    // used for its placeholder-fallback branch, which pilot_rourke never
    // takes — see the comment at that call), so this file no longer needs
    // its own copy of them.
    const mc = this.f.profile.mc;
    const mcRecord = this.campaignState.pilots[mc.pilotId]?.pilot;

    // 3 Sep 2026, floor-plan pass — spawn on the Rec Room's open floor
    // (hubLayout.ts's PLAYER_SPAWN), clear of whoever's already standing
    // there, instead of the old fixed (480,330), which the new plan puts
    // inside Second Lance's berths. buildNpcs has already run, so
    // pickClearPoint sees the real crowd.
    const spawnDeck = this.f.roomDeck(this.f.profile.spawnRoom);
    const spawn = pickClearPoint(spawnDeck, this.f.points.playerSpawn, this.npcs.filter((n) => this.sameDeck(n.room, this.f.profile.spawnRoom)), PLAYER_R, DOOR_LANDING_JITTER_DIST, DOOR_LANDING_MAX_ATTEMPTS);
    this.playerX = spawn.x;
    this.playerY = spawn.y;
    this.currentRoomId = zoneAt(spawnDeck, spawn.x, spawn.y);

    // B4, 5 Sep 2026 — drawPilotAvatar (TransporterPad.ts). pilot_rourke is
    // one of the 15 named portraits, so the player always gets their real
    // one here (Rourke's own gold ring kept, distinct from every NPC's
    // dimmer white one).
    // Hub Floor Portrait Revert, 6 Sep 2026 — forcePlaceholder: true as the
    // 9th arg, same as every other avatar on this floor; Rourke's gold
    // ring (the stroke object just below) is untouched, only the portrait
    // image itself is suppressed here.
    const avatar = drawPilotAvatar(
      this,
      0,
      0,
      PLAYER_R,
      mc.pilotId,
      mcRecord?.displayName ?? mc.shortName,
      PATH_COLORS.meeps,
      {
        color: 0xffd166,
        width: 2,
        alpha: 0.9,
      },
      true
    );
    this.player = this.add.container(this.playerX, this.playerY, [avatar.container]);
  }

  /** Calendar economy, 2 Sep 2026 — repaint the HUD day readout. Guarded because a day can roll over while a scene teardown is in flight. */
  private refreshCalendarReadout(): void {
    if (!this.calendarDayText || !this.calendarDayText.scene) return;
    this.calendarDayText.setText(formatDayLabel(this.campaignState));
  }

  /**
   * Calendar economy, 2 Sep 2026 — the single choke point where a resolved
   * verb both lands in the social log and pays its calendar cost.
   *
   * Every `npc.socialLog.push(...)` in this scene routes through here rather
   * than each verb charging itself at its own call site. That's the whole
   * point: there are 13 push sites and only 6 of them cost anything today,
   * so a per-site approach would mean the next person adding a verb has to
   * notice an invisible obligation and remember to meet it. Routing the log
   * write itself means a new verb is charged correctly by construction — and
   * since VERB_DAY_COST is a full Record<VerbId, number>, adding a VerbId
   * without pricing it is already a compile error. Free verbs no-op.
   */
  /**
   * The NPC under the pointer, if any (2 Sep 2026).
   *
   * Deliberately NOT Phaser's own `currentlyOver` hit-testing, which the
   * pointerdown handler above already uses: those circles are only
   * interactive while their room is visible AND they're not mid-minigame,
   * and several are re-`setInteractive()`d in three different places. A
   * plain distance check against the NPCs on the visible deck is both
   * simpler and immune to that; the tip is read-only, so it doesn't need
   * to agree with the click system about what's clickable.
   */
  private hoveredNpc(): HubNpc | null {
    const deck = this.f.roomDeck(this.currentRoomId);
    let best: HubNpc | null = null;
    let bestD = NPC_R + 6;
    for (const npc of this.npcs) {
      if (this.f.roomDeck(npc.room) !== deck) continue;
      const d = Phaser.Math.Distance.Between(this.pointerWorldX, this.pointerWorldY, npc.x, npc.y);
      if (d < bestD) {
        bestD = d;
        best = npc;
      }
    }
    return best;
  }

  /**
   * Lines for the cursor tip (2 Sep 2026). An NPC under the pointer gets a
   * crew card; anything else gets the room the pointer is over.
   *
   * Everything here is already visible somewhere in this scene (the fav
   * label over each NPC, the room note text, the chat log's own state
   * lines) — the tip's job is putting it under the cursor instead of
   * making the player go find it. Nothing is computed that wasn't already
   * being computed, so this can't drift from what the sim actually thinks.
   */
  private hubHoverLines(): string[] {
    const npc = this.hoveredNpc();
    if (npc) {
      const out: string[] = [];
      const archetype = UNIT_ARCHETYPES[this.campaignState.pilots[npc.pilotId]?.pilot.archetypeId ?? ""];
      out.push(npc.displayName);
      if (archetype?.path) out.push(`${archetype.path}${npc.pilotId === CO_PILOT_ID ? " — commanding officer" : ""}`);
      out.push(`Favor ${Math.round(npc.favorability)}`);
      // Stress and morale are the two numbers the whole social sim turns
      // on, and until now a player could only infer them from what an NPC
      // happened to say. Worded, not bare, because "Stress 74" means
      // nothing without knowing 70 is the panic threshold.
      const stress = Math.round(npc.ambient.stress);
      const morale = Math.round(npc.ambient.morale);
      out.push(`Stress ${stress}${stress >= 70 ? " — at breaking point" : stress >= 45 ? " — strained" : ""}`);
      out.push(`Morale ${morale}${morale <= 30 ? " — low" : morale >= 70 ? " — good" : ""}`);
      if (npc.ambient.drunk) out.push("Drunk");
      if (npc.ambient.worried) out.push("Worried about someone on mission");
      if (npc.inRelationship) out.push("In a relationship");
      if (npc.targetX !== undefined) out.push("(walking)");
      // Tooltip Coverage pass, 12 Sep 2026 — the one line this whole block
      // was missing: everything above says who they are, nothing said this
      // is a clickable at all. Appended here rather than wired through
      // wireHoverTip() like every other clickable in this pass, since NPCs
      // already have their own bespoke hover content (hubHoverLines(),
      // this method) running through the scene-wide handler with no
      // overlay in the way — a second, competing hover system would be
      // solving a problem that doesn't exist here.
      out.push("", "Click to talk");
      return out;
    }

    // Nothing under the cursor: name the room it's over, and what that room
    // is actually for. ROOM_NOTES is the same honest "not built yet" text
    // the centre of the screen already shows, so an unbuilt room reads the
    // same way here as it does there rather than promising anything.
    const deck = this.f.roomDeck(this.currentRoomId);
    const roomId = zoneAt(deck, this.pointerWorldX, this.pointerWorldY);
    const out = [this.f.roomTitle(roomId)];
    const note = this.roomNote(roomId);
    if (note) out.push(...wrapTipText(note, 44));
    return out;
  }

  /**
   * The note to show for a room right now — ROOM_NOTES, minus the one case
   * where a static string would be visibly untrue.
   *
   * Carrier Scale-Up Plan v1 Phase 2, 3 Sep 2026. The two new lance
   * workshops' notes say "Empty until they come aboard," which is honest
   * for a campaign that hasn't reached Mission 12/24 yet and a plain lie
   * afterward — caught in a verification screenshot showing that sentence
   * printed across the middle of a room with five Meks standing in it.
   * Once the lance is actually aboard the room needs no note at all: it
   * has no bench to explain and nothing unbuilt to apologise for, same as
   * the Rec Room, which has never had one.
   *
   * Read off the live NPC list rather than campaignState's roster, on
   * purpose — what the note is describing is literally "is anyone standing
   * in here," and this.npcs IS that, already filtered to active pilots by
   * buildNpcs. A roster check could disagree with what the player can see.
   */
  private roomNote(roomId: RoomId): string | undefined {
    const note = this.f.roomNote(roomId);
    if (!note) return undefined;
    if (roomId === "workshopB" || roomId === "workshopC") {
      if (this.npcs.some((n) => n.homeRoom === roomId)) return undefined;
    }
    return note;
  }

  /**
   * Is a full-screen overlay currently up? Collected here rather than
   * inlined so the tip can't fall out of sync as overlays are added — the
   * seven booleans below are this scene's own complete set (each declared
   * beside its own build*Overlay method).
   */
  private anyOverlayOpen(): boolean {
    // `vaultOpen` was missing here before 3 Sep 2026 — a real, small,
    // pre-existing bug rather than a deliberate omission. update()'s own
    // per-overlay early returns hid it from the hotkeys, but
    // updateHoverTip() is wired to the pointermove EVENT, not to update(),
    // so moving the mouse with the Vault open still popped a hover tip
    // about whichever NPC happened to be underneath the panel. Fixed here
    // in the one place that decides "is the screen owned right now,"
    // rather than by special-casing the tip.
    return (
      this.chatOpen ||
      this.pegOpen ||
      this.pokerOpen ||
      this.dartsOpen ||
      this.historyOpen ||
      this.highlightsOpen ||
      this.hangarShopOpen ||
      this.workshopOpen ||
      this.vaultOpen ||
      this.standingsOpen ||
      this.missionBriefingOpen
    );
  }

  /** Push the current hover content into the cursor tip, or hide it. */
  private updateHoverTip(): void {
    if (!this.hoverTip) return;
    // Tooltip Coverage pass, 12 Sep 2026 — a wireHoverTip()-wired element
    // (an overlay button, or the footer BACK button) is currently showing
    // its own tip. Checked first, unconditionally, before anyOverlayOpen()
    // below: this scene-wide handler fires on every pointer move regardless
    // of what's under the cursor, so without this it would immediately hide
    // or overwrite whatever that element's own pointerover just showed.
    // See overlayHoverActive's own field comment.
    if (this.overlayHoverActive) return;
    // Any overlay open (chat, a minigame, the shop) owns the screen — a tip
    // about whatever is underneath it would be pointing at something the
    // player can't currently interact with.
    if (this.anyOverlayOpen()) {
      this.hoverTip.hide();
      return;
    }
    this.hoverTip.show(this.hubHoverLines(), this.pointerX, this.pointerY);
  }

  /**
   * Wires a raw interactive object to this scene's shared cursor tip —
   * Tooltip Coverage Standing Rule, 12 Sep 2026. Every overlay-internal
   * tooltip in this file (Workshop, Vault, the three Rec Room games) and
   * the footer BACK button go through this one place rather than
   * hand-rolling the same three listeners per button (the pattern the
   * checklist doc itself documents as "established," minus the
   * overlayHoverActive bookkeeping ShopPanel.ts's own copy of this pattern
   * doesn't need — it has no competing scene-wide hover system).
   */
  private wireHoverTip(obj: Phaser.GameObjects.GameObject, lines: string[]): void {
    obj.on("pointerover", (p: Phaser.Input.Pointer) => {
      this.overlayHoverActive = true;
      this.hoverTip?.show(lines, p.x, p.y);
    });
    obj.on("pointermove", (p: Phaser.Input.Pointer) => {
      this.hoverTip?.show(lines, p.x, p.y);
    });
    obj.on("pointerout", () => {
      this.overlayHoverActive = false;
      this.hoverTip?.hide();
    });
  }

  private logVerbAndCharge(npc: HubNpc, entry: SocialLogEntry): void {
    // Optional-chained because HubNpc.socialLog is optional (an NPC built
    // before ensureHubSocialState ran has none). The calendar charge sits
    // OUTSIDE that condition on purpose: the verb happened either way, and
    // whether this NPC keeps a written record of it has nothing to do with
    // whether time passed.
    npc.socialLog?.push(entry);
    if (applyVerbDayCost(this.campaignState, entry.verb)) this.refreshCalendarReadout();
  }

  update(_time: number, delta: number) {
    // Calendar economy, 2 Sep 2026 — first, and unconditional for the same
    // reason as everything below it, but the reason matters more here than
    // anywhere else on this list. Maxime's model is "the calandar run when
    // you play. no matter what you do" — an ambient day/night cycle, not a
    // meter that only moves while the player is doing something the game
    // considers productive. Time spent sitting in the peg board overlay is
    // still time spent aboard, so the clock keeps running behind every
    // overlay gate below rather than freezing whenever one owns input.
    //
    // Deliberately NOT using Phaser's own `delta` above: it's smoothed and
    // clamped, and live browser testing measured the Hub crediting only ~41%
    // of real elapsed time on heavy frames because of it. See
    // calendarClock.ts's measureRealDelta for the full account.
    {
      const measured = measureRealDelta(this.lastCalendarTickAt, Date.now());
      this.lastCalendarTickAt = measured.at;
      if (tickCalendar(this.campaignState, measured.deltaMs)) this.refreshCalendarReadout();
    }
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
    // Breakdown, 28 Aug 2026 (Groups 3-5 batch rebuild) — same unconditional
    // placement as everything above: a pilot's Morale collapsing, and
    // whoever's nearby to help, shouldn't freeze just because an overlay
    // owns input this frame.
    this.updateBreakdownTrigger(this.time.now);
    this.updateBreakdownResolution(this.time.now);

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

    // Same shape again — Tier 4, 30 Aug 2026. ShopPanel owns its own
    // clicks/buttons internally (same as every other overlay's content
    // owning itself); this only needs to watch for the one key that isn't
    // part of ShopPanel's own UI.
    if (this.hangarShopOpen) {
      this.updateBubbles();
      if (this.escKey && Phaser.Input.Keyboard.JustDown(this.escKey)) this.closeHangarShop();
      return;
    }

    // Same shape again — the Workshop bench panel owns input entirely
    // while open (its rows are their own click targets), 2 Sep 2026.
    if (this.workshopOpen) {
      this.updateBubbles();
      if (this.escKey && Phaser.Input.Keyboard.JustDown(this.escKey)) this.closeWorkshop();
      return;
    }

    // Same shape again — the standings board owns input entirely while
    // open (its tab row is its own click target), 3 Sep 2026.
    if (this.standingsOpen) {
      this.updateBubbles();
      if (this.escKey && Phaser.Input.Keyboard.JustDown(this.escKey)) this.closeStandings();
      return;
    }

    // Same shape again — the mission briefing panel owns input entirely
    // while open, 4 Sep 2026.
    if (this.missionBriefingOpen) {
      this.updateBubbles();
      if (this.escKey && Phaser.Input.Keyboard.JustDown(this.escKey)) this.closeMissionBriefing();
      return;
    }

    // The memorial roll sits ON TOP of the Vault (depth 61 vs 60), so it has
    // to be checked BEFORE the vaultOpen branch below — both are open at the
    // same time by design, and whichever is tested first is the one Esc
    // closes. Esc here closes only the roll, putting the player back in the
    // Vault they opened it from. B3, 5 Sep 2026.
    if (this.rosterOpen) {
      this.updateBubbles();
      if (this.escKey && Phaser.Input.Keyboard.JustDown(this.escKey)) this.closeRosterPanel();
      return;
    }

    if (this.memorialOpen) {
      this.updateBubbles();
      if (this.escKey && Phaser.Input.Keyboard.JustDown(this.escKey)) this.closeMemorial();
      return;
    }

    // Same shape again — the Vault overlay owns input entirely while open,
    // 2 Sep 2026.
    if (this.vaultOpen) {
      this.updateBubbles();
      if (this.escKey && Phaser.Input.Keyboard.JustDown(this.escKey)) this.closeVault();
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
      else if (this.isAtHangarShop()) this.openHangarShop();
      // Workshop bench, 2 Sep 2026 — added to BOTH the click path and the
      // E-key path, since this file's own rule (see the click handler's
      // comment) is that the two must never disagree about what the
      // interact affordance does from a given spot. Can't collide with the
      // Hangar Deck console above: the two gate on different currentRoomId.
      else if (this.isAtWorkshopBench()) this.openWorkshop();
      // The Vault plinth, 2 Sep 2026 — same both-paths rule noted at the
      // click handler above.
      else if (this.isAtVaultPlinth()) this.openVault();
      // The standings board, 3 Sep 2026 — same both-paths rule noted at the
      // click handler above.
      else if (this.isAtStandingsBoard()) this.openStandings();
      // The Archive, 7 Sep 2026 — same both-paths rule as the three above;
      // gates on the facility's own archiveRoom, so it can't collide.
      else if (this.isAtArchiveTable()) this.openArchive();
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
    // History / Highlights hotkeys, 2 Sep 2026 (Maxime: "add some natural
    // keybinding for the majority of action"). Until now these two panels
    // were reachable ONLY by opening the chat box and typing a phrase
    // detectHistoryRequest/detectHighlightsRequest happens to match —
    // three deliberate steps for a read-only panel, and no way to discover
    // either one exists. The chat path stays exactly as it is (it's how an
    // NPC-directed request reads in fiction); this is the direct route.
    //
    // Both go through the same nearestNpcInRange(APPROACH_RADIUS) the chat
    // handlers use, so "who does this open" is one rule, not two, and both
    // give the same honest miss message when nobody's close enough.
    if (this.hKey && Phaser.Input.Keyboard.JustDown(this.hKey)) this.openNearestPanel("history");
    if (this.lKey && Phaser.Input.Keyboard.JustDown(this.lKey)) this.openNearestPanel("highlights");
    // B — the standings board. Simpler than H/L: it is not about any one
    // NPC, so there is no nearest-target rule, only "are you in the room
    // the board is bolted to."
    if (this.bKey && Phaser.Input.Keyboard.JustDown(this.bKey)) this.openStandings();
  }

  /**
   * Shared body of the H / L hotkeys above — same target rule and same
   * overlay guard the chat-typed versions apply, in one place rather than
   * copied twice.
   */
  private openNearestPanel(which: "history" | "highlights"): void {
    if (this.anyOverlayOpen()) return;
    const target = this.nearestNpcInRange(APPROACH_RADIUS);
    if (!target) {
      this.showFallback("Nobody's close enough to ask about.");
      return;
    }
    if (which === "history") this.openHistory(target);
    else this.openHighlights(target);
  }

  /**
   * Rec Room Standings, slice 4.
   *
   * Gated on being in the Rec Room, because the board is a physical object
   * bolted to that wall — the same reasoning that room-gates the three
   * minigames themselves (Tier 2, 30 Aug 2026). Anywhere else gets an
   * honest miss line rather than silence, matching openNearestPanel above.
   */
  private openStandings(): void {
    if (this.anyOverlayOpen()) return;
    if (this.currentRoomId !== "recroom") {
      this.showFallback("The board's in the Rec Room.");
      return;
    }
    this.standingsOpen = true;
    this.standingsPanel.open(ensureRecRoomState(this.campaignState), this.standingsEntrants(), currentDay(this.campaignState));
  }

  private closeStandings(): void {
    this.standingsOpen = false;
    this.standingsPanel.close();
  }

  /**
   * B3 — open the roll of pilots lost. Reached from a button inside the
   * Vault (renderVault), which stays open underneath: this draws over it and
   * closing returns there, rather than dumping the player back onto the deck
   * from two clicks deep.
   */
  private openMemorial(): void {
    this.memorialOpen = true;
    this.memorialPanel.open(this.campaignState.campaignId);
  }

  private closeMemorial(): void {
    this.memorialOpen = false;
    this.memorialPanel.close();
  }

  /**
   * Codex Rebuild & Live Briefing Plan v1, Part B, 4 Sep 2026 — opens the
   * real mission briefing panel for the given mission. The only caller is
   * handleBriefRequest below; not gated on room or proximity the way
   * openStandings is (the standings board is a physical object bolted to
   * one wall — a briefing from the CO isn't), since isReachingCo() already
   * covers "is the player actually talking to the CO" before this is ever
   * reached.
   */
  private openMissionBriefing(mission: CampaignMission): void {
    this.missionBriefingOpen = true;
    this.missionBriefingPanel.open(mission);
  }

  private closeMissionBriefing(): void {
    this.missionBriefingOpen = false;
    this.missionBriefingPanel.close();
  }

  /**
   * Everyone eligible for a row. Built fresh each time the board opens
   * rather than cached, so a pilot lost on the mission you just came back
   * from is already on it, greyed, the first time you walk in.
   *
   * Rourke is deliberately NOT taken from her roster entry: the player's
   * own sessions are recorded under PLAYER_RECORD_ID, so her `pilot_rourke`
   * row would sit at a permanent 0-0-0 and read as "the commander has
   * never played," which is the opposite of true. She appears exactly
   * once, as the YOU row.
   */
  private standingsEntrants(): StandingsEntrant[] {
    // this.f.profile.mc.pilotId's own background (9 Sep 2026 recruit
    // generator) is undefined in practice — Rourke/Marrow are both
    // explicitly excluded from the gauntlet (Catalyst_Gauntlet_v2 §6) —
    // read here anyway so this stays correct if that ever changes.
    const out: StandingsEntrant[] = [
      {
        pilotId: PLAYER_RECORD_ID,
        displayName: this.f.profile.mc.shortName,
        catalyst: catalystForPilot(this.f.profile.mc.pilotId, this.campaignState.pilots[this.f.profile.mc.pilotId]?.pilot.background),
        isPlayer: true,
      },
    ];
    for (const [pilotId, entry] of Object.entries(this.campaignState.pilots)) {
      if (pilotId === this.f.profile.mc.pilotId) continue;
      out.push({
        pilotId,
        // Just the name, not the callsign. `displayName` is the full
        // "Cpl. Faro Yeun — \u201cSplinter\u201d" form; a fixed-width table
        // column truncates that to "Cpl. Faro Yeun — \u201cSpli", which reads
        // like a bug. Same split every other roster-facing readout in this
        // file already uses (see runNpcEncounter's SocialSimPilot build).
        displayName: entry.pilot.displayName.split("—")[0].trim(),
        catalyst: catalystForPilot(pilotId, entry.pilot.background),
        path: UNIT_ARCHETYPES[entry.pilot.archetypeId]?.path,
        lost: entry.status === "permanently_lost",
        lostOnDay: entry.lostContext?.lostOnDay,
      });
    }
    return out;
  }

  private handleMovement(delta: number) {
    const dt = delta / 1000;
    let dx = 0;
    let dy = 0;
    if (this.keys.a.isDown || this.cursors?.left?.isDown) dx -= 1;
    if (this.keys.d.isDown || this.cursors?.right?.isDown) dx += 1;
    if (this.keys.w.isDown || this.cursors?.up?.isDown) dy -= 1;
    if (this.keys.s.isDown || this.cursors?.down?.isDown) dy += 1;
    if (dx === 0 && dy === 0) return; // no input held — standing still on purpose

    const len = Math.hypot(dx, dy) || 1;
    const stepX = (dx / len) * PLAYER_SPEED * dt;
    const stepY = (dy / len) * PLAYER_SPEED * dt;

    // Axis-separated movement so the player slides along a wall instead of
    // sticking dead the instant one axis would collide. 5 Sep 2026 — used to
    // say "a wall or an NPC" here; bodies no longer collide with each other
    // at all (see tryMove/tryMoveNpc's own headers), only clampToDeckFloor's
    // walls and furniture still do.
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
    const zone = zoneAt(this.f.roomDeck(this.currentRoomId), this.playerX, this.playerY);
    if (zone !== this.currentRoomId) {
      this.currentRoomId = zone;
      this.refreshRoomVisibility();
    }
  }

  // 5 Sep 2026, Maxime: "make people able to pass tru each other with no
  // collision, getting stuck in corridor is anothing as fuck." Used to loop
  // every NPC on this deck and block whichever axis would land within
  // PLAYER_R + NPC_R of one of them — that per-axis body block was the
  // actual mechanism behind every corridor jam this file's own history
  // documents (the cluster-stuck hotfixes, forceUnstickPlayer, the Move It
  // verb). Gone: only clampToDeckFloor's walls and furniture still stop the
  // player now, bodies pass straight through each other.
  private tryMove(dx: number, dy: number) {
    const clamped = clampToDeckFloor(this.f.roomDeck(this.currentRoomId), this.playerX + dx, this.playerY + dy, PLAYER_R);
    this.playerX = clamped.x;
    this.playerY = clamped.y;
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
        // Worries System step 2, 6 Sep 2026 — mission_pilot_missing drops
        // the instant there's no active attempt, same immediacy the flat
        // worried boolean below always had ("runs until the player exits,
        // what isn't saved is lost" — Maxime, 25 Aug 2026). Not left to
        // its own expiresAt safety net, which exists for the case this
        // loop stops running at all, not the ordinary case of the attempt
        // simply ending.
        if (npc.worries !== undefined) npc.worries = removeWorry(npc.worries, "mission_pilot_missing");
        if (!npc.ambient.worried && npc.ambient.topWorry === undefined) continue;
        npc.ambient = { ...npc.ambient, worried: false, topWorry: undefined };
      }
      return;
    }
    const now = Date.now();
    const elapsedSinceOnset = now - attempt.startedAt - WORRY_ONSET_MS;
    for (const npc of this.npcs) {
      if (npc.nextWorryCheckAt !== undefined && now < npc.nextWorryCheckAt) continue;
      npc.nextWorryCheckAt = now + WORRY_RECHECK_MS;
      const intensity = worryTriggerChance(elapsedSinceOnset, npc.favorability);
      const worried = Math.random() < intensity;

      // Worries System step 2, 6 Sep 2026 (Bloom_Wars_Worries_System_
      // Proposal_v1.md, build order step 2) — Mission Worry absorbed as
      // the general Worries list's first live source. Deliberately a
      // SEPARATE roll from `worried` just above, not derived from it:
      // `worried` still drives Breakdown's own isBreakdownEligible() gate
      // and the roster panel's readout unchanged, out of scope for this
      // pass (data/worries.ts's own header: "read-side only... nothing
      // else"), so the two are independent samples of the same underlying
      // probability and can disagree at any single instant. pickSoloEcho
      // (ambientLines.ts) is the one consumer of topWorry so far. Once a
      // real second Worries source exists (step 3's combat bridge), it'll
      // be worth deciding whether Breakdown should read the general list
      // too instead of staying stuck on Mission-Worry-only forever —
      // flagged, not decided here.
      //
      // catalyst: "wolf" (teamwork) — a judgment call, not something the
      // proposal pins down for this specific source. Grounded in this
      // exact function's own neighbor content rather than picked blind:
      // ambientLines.ts's pickSoloEcho comment already cites the wolf
      // catalyst's own fear-bank lines ("Don't scatter... we lose someone
      // else," "Sound off, I need to hear every voice") as reading like
      // crewmate-worry as much as self-panic. Doesn't drive any behavior
      // yet either way — pickSoloEcho keys content off the PILOT's own
      // catalyst, not the worry's — so this is forward-looking metadata
      // for the step 3 combat bridge, worth a gut-check with Maxime once
      // that's built, not a blocker now.
      const entry: WorryEntry = {
        source: "mission_pilot_missing",
        catalyst: "wolf",
        intensity,
        // Worries System step 3, 10 Sep 2026 — WorryEntry.context is new;
        // Mission Worry is (and stays) the only hub-context source. See
        // that field's own comment in data/worries.ts.
        context: "hub",
        bornAt: now,
        // Safety-net only (module header's own comment) — the no-attempt
        // branch above is the real removal path in the ordinary case.
        expiresAt: now + WORRY_RECHECK_MS * 3,
      };
      npc.worries = intensity > 0 ? upsertWorry(npc.worries ?? [], entry) : removeWorry(npc.worries ?? [], "mission_pilot_missing");
      const topWorry = loudestWorry(npc.worries, now);

      npc.ambient = { ...npc.ambient, worried, topWorry };
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
      npc.sleep = tickNeed(npc.sleep, isBerths(npc.room)); // any lance's bunks restore sleep — see LANCE_BERTHS
      // Boredom, 30 Aug 2026 — see this field's own comment (HubNpc) for why
      // its restore condition is "currently in a live encounter bubble"
      // rather than a fixed room the way the three needs just above are.
      // `now < npc.bubbleUntil` is the exact same "actually, visibly
      // socially engaged right now" check updateNpcEncounters' own
      // currentDeckBubbleCount already uses — real company relieves
      // boredom, just standing in a room (even the Rec Room) doesn't.
      npc.boredom = tickNeed(npc.boredom, now < npc.bubbleUntil);

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
        npc.path = undefined;
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

      // 3 Sep 2026 — walls. Path once per target (hubNav.findPath, on the
      // deck the NPC is standing on), then steer at the next waypoint
      // instead of the target itself. A waypoint counts as reached inside
      // NAV_WAYPOINT_REACH; the real arrival check above is still against
      // the true target, so nothing about "did I get there" changed. A
      // null path (no route at all — a layout bug hubLayout.test.ts is
      // meant to catch first) falls back to the straight line and lets the
      // stuck timeout below do what it always did.
      if (npc.path === undefined || npc.pathTarget === undefined || npc.pathTarget.x !== npc.targetX || npc.pathTarget.y !== npc.targetY) {
        npc.path = findPath(this.f.roomDeck(npc.room), npc.x, npc.y, npc.targetX, npc.targetY, NPC_R) ?? [];
        npc.pathTarget = { x: npc.targetX, y: npc.targetY };
      }
      while (npc.path.length > 1 && Phaser.Math.Distance.Between(npc.x, npc.y, npc.path[0].x, npc.path[0].y) <= NAV_WAYPOINT_REACH) {
        npc.path.shift();
      }
      const aim = npc.path.length > 0 ? npc.path[0] : { x: npc.targetX, y: npc.targetY };
      const dx = aim.x - npc.x;
      const dy = aim.y - npc.y;
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
          // retry's straight line clears whatever blocked the last one.
          //
          // Move It Verb Proposal, 3 Sep 2026 — this used to sidestep just
          // this one NPC; it now calls clearCluster(npc) instead, which does
          // the identical thing (same targetX/targetY/path/stuckMs reset,
          // same NPC_R*2 sidestep) but also sweeps in anyone else genuinely
          // touching this NPC, so a real doorway jam clears in one pass
          // instead of each member discovering it's stuck on a separate
          // timer. Strict superset, zero regression: when nothing else is
          // within CLUSTER_RADIUS, the cluster is just this NPC and the
          // behavior is byte-for-byte the same as before this pass.
          this.clearCluster(npc);
        }
      } else {
        npc.stuckMs = 0;
      }
    }
  }

  // Move It Verb Proposal, 3 Sep 2026 — the shared core both triggers call:
  // the player asking on demand (submitChat, Trigger 1 below) and an NPC's
  // own give-up-timeout above (Trigger 2). Targets a local CLUSTER, not one
  // NPC and not a room-wide sweep — a third targeting shape, deliberately
  // not stretched into VerbDef's single-target/broadcast model (see the
  // proposal doc's own header for why this isn't a VerbDef at all).
  //
  // No room gate — harmless everywhere in the Hub, not just corridors, so
  // restricting it to specific rooms would add complexity for no benefit.
  // sameDeck-scoped when gathering the cluster (matching tryMoveNpc's own
  // collision check just below, which is deck-scoped for the same reason):
  // every deck reuses the same on-screen coordinate region one at a time, so
  // an unscoped distance check could sweep in an NPC standing on a totally
  // different deck that happens to share similar on-screen coordinates.
  private clearCluster(anchor: HubNpc) {
    const cluster = this.npcs.filter(
      (npc) => npc === anchor || (this.sameDeck(npc.room, anchor.room) && Phaser.Math.Distance.Between(anchor.x, anchor.y, npc.x, npc.y) <= CLUSTER_RADIUS),
    );
    for (const npc of cluster) {
      npc.targetX = undefined;
      npc.targetY = undefined;
      npc.path = undefined;
      npc.stuckMs = 0;
      const sidestep = pointNear({ x: npc.x, y: npc.y }, NPC_R * 2);
      this.tryMoveNpc(npc, sidestep.x - npc.x, sidestep.y - npc.y);
    }
  }

  // 5 Sep 2026 — used to block against the player (within NPC_R + PLAYER_R)
  // and against every other NPC on the same deck (within NPC_R + NPC_R)
  // before applying a step; see tryMove's own header, same change, same
  // reason. Only clampToDeckFloor's walls and furniture still stop an NPC.
  private tryMoveNpc(npc: HubNpc, dx: number, dy: number) {
    const clamped = clampToDeckFloor(this.f.roomDeck(npc.room), npc.x + dx, npc.y + dy, NPC_R);
    const nx = clamped.x;
    const ny = clamped.y;
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
    npc.room = zoneAt(this.f.roomDeck(npc.room), nx, ny);
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
    const here = this.sameDeck(room, this.currentRoomId);
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
  // the same door via this.nextHopDoor() that set the target in the first place,
  // so there's no way for this to resolve to the wrong door. A two-hop trip
  // (through Rec Room, the map's only hub) keeps walking immediately rather
  // than sitting idle at the hub's own spawn point until the next roam
  // tick fires 5-11s later — a real "cross the ship" errand shouldn't read
  // as a stall at the midpoint any more than at either end.
  private completeDoorHop(npc: HubNpc) {
    if (npc.travelTargetRoom === undefined) return;
    const door = this.nextHopDoor(npc.room, npc.travelTargetRoom);
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
    const landing = this.pickDoorLanding(
      door,
      this.npcs.filter((n) => n !== npc && n.room === door.toRoom),
    );
    const land = clampToDeckFloor(this.f.roomDeck(door.toRoom), landing.x, landing.y, NPC_R);
    this.setNpcRoom(npc, door.toRoom, land.x, land.y);
    if (npc.room === npc.travelTargetRoom) {
      npc.travelTargetRoom = undefined;
      // Tier 1, 30 Aug 2026 — the last stretch of a cross-deck muster.
      // Ordinarily arriving in the target ROOM is the whole point (plain
      // explore roaming has no more specific destination than that), but a
      // muster's real destination is MUSTER_POINT, a precise spot inside
      // MUSTER_ROOM, not just anywhere in it — and the door landing spot
      // (pickDoorLanding, just above) is never that exact point. Without
      // this, a mustered NPC arriving via a door hop would stop dead at
      // whichever door they came in through, targetX/targetY both left
      // undefined by this function's caller, and never actually reach the
      // bay — the same "arrived at the wrong place, sat there" shape as the
      // original cross-deck bug this Tier 1 pass fixed, just moved one
      // step later. Same-deck musters (sendToMuster's other branch) never
      // hit this path at all — they walk straight to MUSTER_POINT with no
      // door involved — so this only ever fires for the case that's new.
      if (npc.mustered && npc.room === MUSTER_ROOM) {
        npc.targetX = this.f.points.muster.x;
        npc.targetY = this.f.points.muster.y;
      }
      return;
    }
    const nextDoor = this.nextHopDoor(npc.room, npc.travelTargetRoom);
    if (nextDoor) {
      const approach = this.approachDoorTarget(npc, nextDoor);
      npc.targetX = approach.x;
      npc.targetY = approach.y;
    } else {
      npc.travelTargetRoom = undefined;
    }
  }

  // Tier 1, 30 Aug 2026 — the single place every "walk toward this door to
  // hop through it" call site gets its walk target from (there are four:
  // completeDoorHop's own multi-hop continuation just above,
  // updateNpcRoaming's journey-resume and explore branches below, and
  // sendToMuster's cross-deck branch) — one function so they can't drift
  // apart later the way four hand-copied jitter calls risk. See
  // pickDoorApproach's own header, right after nextHopDoor near the top of
  // this file, for why a jittered approach point exists at all (Tier 1
  // item #1 — NPCs stacking on a door's literal coordinate blocked the
  // player from reaching it). The clampToDeckFloor call mirrors
  // completeDoorHop's own landing-side clamp (same reason: a raw jittered
  // point can land fractionally outside the deck's real floor, and
  // clamping the TARGET itself — not just each step toward it — keeps it
  // genuinely reachable, so the arrival check in updateNpcMovement can
  // actually satisfy instead of repeating the exact "unreachable target,
  // retries forever" failure that function's own arriveThreshold comment
  // already found and fixed once, for a different cause).
  private approachDoorTarget(npc: HubNpc, door: DoorDef): { x: number; y: number } {
    const approach = this.pickDoorApproach(
      door,
      this.npcs.filter((n) => n !== npc && n.room === npc.room),
    );
    return clampToDeckFloor(this.f.roomDeck(npc.room), approach.x, approach.y, NPC_R);
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
  /**
   * Send `npc` toward `room`, by whichever means that room actually needs —
   * Carrier Scale-Up Plan v1 Phase 2, 3 Sep 2026.
   *
   * Same deck: a direct walk to a random point inside that room's own zone,
   * no door involved. This is the identical shape the same-deck explore
   * branch below already uses (pick inside ROOM_ZONE_BOUNDS, then run it
   * through clampToDeckFloor so a grotto pick lands on the real ellipse
   * rather than its bounding rectangle's corner) — deliberately the same
   * code shape rather than a second way of doing it.
   *
   * Different deck: the existing travelTargetRoom/nextHopDoor machinery,
   * unchanged.
   *
   * Extracted because the Mek-confinement branch in updateNpcRoaming needs
   * both cases now and had only ever needed the second one. A no-op change
   * for every pre-Phase-2 caller: every trip a confined Mek used to take
   * (workshop <-> recroom/berths) was cross-deck and still goes through
   * exactly the same door path it always did.
   */
  private walkToRoomTarget(npc: HubNpc, room: RoomId): void {
    if (this.sameDeck(npc.room, room)) {
      const zone = this.f.roomZone(room);
      const pick = clampToDeckFloor(
        this.f.roomDeck(room),
        zone.left + Math.random() * (zone.right - zone.left),
        zone.top + Math.random() * (zone.bottom - zone.top),
        NPC_R,
      );
      npc.targetX = pick.x;
      npc.targetY = pick.y;
      return;
    }
    const door = this.nextHopDoor(npc.room, room);
    if (!door) return; // no route on this map — fail safe rather than stranding a target nothing can reach
    npc.travelTargetRoom = room;
    const approach = this.approachDoorTarget(npc, door);
    npc.targetX = approach.x;
    npc.targetY = approach.y;
  }

  // 3 Sep 2026 — which lance an NPC belongs to, for the per-lance berths.
  // A Mek NPC's pilotId IS the mek's own id (see buildNpcs), hence the
  // prefix check; both resolvers know both campaigns' rosters.
  // B2, 5 Sep 2026 — both resolvers now read the live lance assignment
  // rather than the static arrival batch, so reassigning a pilot moves both
  // their Mek's workshop and their own berth. Same fallback in both: an
  // unresolvable id still gets the static answer.
  private lanceOf(npc: HubNpc): LanceId {
    return npc.pilotId.startsWith("mek_") ? lanceOfMekIn(this.campaignState, npc.pilotId) : lanceOfPilotIn(this.campaignState, npc.pilotId);
  }

  // NEED_ROOM says "sleep restores in berths" without knowing there are
  // three berth rooms now; this resolves that one entry to the NPC's own
  // lance's bunks and passes every other need's room through untouched.
  private needRoomFor(npc: HubNpc, need: keyof typeof NEED_ROOM): RoomId {
    const base = NEED_ROOM[need];
    return base === "berths" ? this.berthRoomFor(this.lanceOf(npc)) : base;
  }

  private updateNpcRoaming(now: number) {
    for (const npc of this.npcs) {
      // NPC Conversation Lock Fix, 6 Sep 2026 — checked before targetX and
      // before the journey-resume branch below on purpose (see
      // HubNpc.engagedUntil's own comment): this NPC never has a walk
      // target while mid-exchange (encounters only ever start on an
      // already-idle pair), but a mid-journey NPC paused between door hops
      // could theoretically be pulled into one too, and this has to win
      // over resuming that journey the same way mustered already does.
      if (isNpcEngaged(npc.engagedUntil, now)) continue;
      if (npc.targetX !== undefined) continue;
      if (npc.nextRoamAt === undefined || now < npc.nextRoamAt) continue;

      npc.nextRoamAt = now + ROAM_INTERVAL_MIN_MS + Math.random() * (ROAM_INTERVAL_MAX_MS - ROAM_INTERVAL_MIN_MS);

      // 26 Aug 2026, Build Plan §24 — mid cross-room journey. Keep walking
      // the next hop rather than re-rolling anything below; this only ever
      // fires after a stuckMs give-up mid-journey (a genuine door arrival
      // is handled immediately in updateNpcMovement/completeDoorHop and
      // never leaves travelTargetRoom dangling with no active target).
      //
      // Tier 1, 30 Aug 2026 — deliberately checked BEFORE the `mustered`
      // guard below, not after (it used to run first, unconditionally,
      // blocking this). sendToMuster's own cross-deck fix can leave a
      // mustered NPC's travelTargetRoom set with targetX/targetY cleared
      // (the exact same stuck-give-up shape this branch already exists to
      // recover from) — gating this behind "not mustered" would strand
      // them mid-transit forever, since a mustered NPC never reaches
      // sendToMuster again to re-set a target. Resuming a journey already
      // in progress isn't "handing them a new roam target," so it doesn't
      // conflict with the mustered guard's own reason for existing —
      // that's still checked right below, before the explore/mingle logic
      // this journey-resume is not.
      if (npc.travelTargetRoom !== undefined) {
        const door = this.nextHopDoor(npc.room, npc.travelTargetRoom);
        if (door) {
          const approach = this.approachDoorTarget(npc, door);
          npc.targetX = approach.x;
          npc.targetY = approach.y;
        } else {
          npc.travelTargetRoom = undefined; // shouldn't happen on this map — fail safe, not stuck forever
        }
        continue;
      }

      // 27 Aug 2026 — see HubNpc.mustered's own header. Checked here, after
      // the journey-resume branch above but before any of the "pick a new
      // destination" logic below: a mustered NPC that has already arrived
      // at MUSTER_POINT has targetX cleared by ordinary arrival logic
      // (updateNpcMovement), and without this guard the very next
      // nextRoamAt tick would hand them a brand-new explore/mingle target
      // as if they were any other idle NPC — exactly the gap Maxime
      // flagged. Moved down from this function's very first line, Tier 1,
      // 30 Aug 2026 — see the journey-resume branch's own comment above for
      // why it has to run before this now.
      if (npc.mustered) continue;

      // Mek Workshop confinement, 30 Aug 2026 (Maxime: "mek need to stay in
      // the workshop unless they are sleeping or eating") — see homeRoom's
      // own field comment. Checked here, after mustered (a homeRoom NPC
      // isn't currently ever mustered, but nothing stops that from mattering
      // later, and mustered's own reason to take priority applies just the
      // same either way) and before the ordinary explore roll below, which
      // this replaces entirely for a confined NPC rather than narrowing.
      //
      // Two real cases, both driven by the exact same worstNeed/NEED_ROOM
      // read the ordinary explore-bias branch below already uses (kept
      // identical on purpose — "eating" and "sleeping" have to mean the
      // same rooms and the same threshold everywhere, not a second
      // definition that could drift from the first):
      //  - Away from home with the need that sent them out now satisfied
      //    (or, degenerately, away from home with no need at all —
      //    shouldn't happen given the branch below only ever sends them out
      //    FOR a need, but failing safe by sending them home either way
      //    costs nothing) -> walk straight back to the Workshop.
      //  - At home with a real need outstanding -> walk straight to that
      //    need's room (Rec Room for hunger/thirst, Berths for sleep),
      //    skipping pickExploreTarget's uniform pick across all six rooms
      //    entirely — a Mek never rolls a trip to the Hangar Deck, the
      //    Vault, the CIC, the Spar Room, or the Grotto.
      // Neither case fires: already home with nothing pulling them out, or
      // already away satisfying a real need that hasn't cleared yet — both
      // fall through to the same-room mingle logic at the bottom of this
      // loop unchanged, so a Mek still chats or games with whoever's
      // actually standing next to them, at home or in the Rec Room/Berths.
      //
      // Carrier Scale-Up Plan v1 Phase 2, 3 Sep 2026 — both branches below
      // used to reach for this.nextHopDoor() unconditionally, which was exactly
      // right while every Mek in the game shared one homeRoom ("workshop")
      // and every trip they ever made was therefore cross-deck. Phase 2
      // breaks that assumption: a Second Lance Mek's home is workshopB,
      // which sits on the SAME deck as Lance A's workshop, and nextHopDoor
      // deliberately returns undefined for a same-deck pair (there's no
      // door — it's one open floor). Left alone, a Lance B Mek walking home
      // from the Rec Room would come up the stairs, land inside Lance A's
      // workshop (where the upper-deck stair landing point is), find no
      // door to its own room, and simply stop there forever — permanently
      // parked in another lance's bay, which is both the wrong room and a
      // fresh little crowd in the exact room this plan is trying to thin
      // out. walkToRoomTarget handles both cases: a direct walk when the
      // target shares this deck, the existing door hop when it doesn't.
      if (npc.homeRoom !== undefined) {
        const worstOfNeeds = worstNeed(npc.hunger, npc.thirst, npc.sleep);
        const needRoom = worstOfNeeds ? this.needRoomFor(npc, worstOfNeeds) : undefined;
        if (npc.room !== npc.homeRoom && needRoom === undefined) {
          this.walkToRoomTarget(npc, npc.homeRoom);
          continue;
        }
        if (npc.room === npc.homeRoom && needRoom !== undefined && needRoom !== npc.homeRoom) {
          this.walkToRoomTarget(npc, needRoom);
          continue;
        }
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
      //
      // homeRoom guard, 30 Aug 2026: a confined NPC (Meks) never reaches
      // this branch at all — the block just above already handled both of
      // its real cases and continue'd past this point, so this only ever
      // runs now for npc.homeRoom === undefined (every ordinary pilot),
      // exactly as before this pass.
      if (npc.homeRoom === undefined && Math.random() < EXPLORE_CHANCE) {
        // Carrier Scale-Up Plan v1, Phase 1, 2 Sep 2026 — see EXPLORE_OPEN_
        // FLOOR_CHANCE's own header for the full reasoning. Rolled first,
        // ahead of the needs-biased named-room pick below: this NPC has
        // already committed to "leave and go somewhere" by reaching this
        // branch at all (the outer EXPLORE_CHANCE roll above), so this is
        // just deciding WHERE — a plain point on the open floor, or a named
        // room the way this branch has always worked. Worth being honest
        // about the one real trade-off: this CAN fire even when a real
        // need (hunger/thirst/sleep/boredom) is pulling the NPC toward a
        // specific room below, sending them to empty floor instead just
        // this once. Not a new problem this introduces, though — biasRoom
        // below was already only a weighted NUDGE (pickExploreTarget's own
        // header), never a guarantee, so a needy NPC could already roll a
        // different room entirely; this just adds one more possible miss
        // at roughly the same order of magnitude (EXPLORE_CHANCE 0.15 ×
        // EXPLORE_OPEN_FLOOR_CHANCE 0.3 ≈ 4-5% of idle ticks), not a
        // meaningfully bigger one.
        if (Math.random() < EXPLORE_OPEN_FLOOR_CHANCE) {
          const deck = this.f.roomDeck(npc.room);
          const openPoint = pickOpenFloorPoint(deck);
          const pick = clampToDeckFloor(deck, openPoint.x, openPoint.y, NPC_R);
          npc.targetX = pick.x;
          npc.targetY = pick.y;
          continue;
        }
        // Needs Counter roaming bias, 28 Aug 2026 — see NEEDS_ROAM_WEIGHT_BONUS's
        // own comment. worstNeed reads straight off this NPC's live
        // hunger/thirst/sleep/boredom; NEED_ROOM maps whichever one's worst
        // to the room that actually restores it. boredom passed here (30
        // Aug 2026, "boredom should trigger spar") — deliberately NOT
        // passed at the Mek homeRoom branch above (see that branch's own
        // 3-argument call and homeRoom's field comment) or at
        // pickNeedsFlavorLine's own 3-argument call (no boredom entry in
        // NEEDS_FLAVOR_BANK to return) — this is the one call site an idle
        // ordinary pilot's own roaming actually goes through.
        const worstOfNeeds = worstNeed(npc.hunger, npc.thirst, npc.sleep, npc.boredom);
        const biasRoom = worstOfNeeds ? this.needRoomFor(npc, worstOfNeeds) : undefined;
        const target = this.pickExploreTarget(npc.room, biasRoom, this.berthRoomFor(this.lanceOf(npc)));
        if (this.sameDeck(npc.room, target)) {
          // this.f.roomZone(target) is grotto's own (bigger, off-center)
          // bounding rect for that deck (see its own comment) — picking a
          // random point inside that RECT and then running it through
          // clampToDeckFloor pulls anything that landed outside the true
          // ellipse back onto the boundary, same as any other movement
          // clamp here. Upper/Lower targets are unaffected: their zone
          // rects fully tile ROOM_BOUNDS, so clampToDeckFloor's rectangle
          // branch is a no-op there, exactly like before this pass.
          const zone = this.f.roomZone(target);
          const pick = clampToDeckFloor(
            this.f.roomDeck(target),
            zone.left + Math.random() * (zone.right - zone.left),
            zone.top + Math.random() * (zone.bottom - zone.top),
            NPC_R,
          );
          npc.targetX = pick.x;
          npc.targetY = pick.y;
          continue;
        }
        const door = this.nextHopDoor(npc.room, target);
        if (door) {
          npc.travelTargetRoom = target;
          const approach = this.approachDoorTarget(npc, door);
          npc.targetX = approach.x;
          npc.targetY = approach.y;
          continue;
        }
        // No door found (shouldn't happen) — fall through to same-room logic below instead of doing nothing this tick.
      }

      const roommates = this.npcs.filter((n) => this.sameDeck(n.room, npc.room) && n.pilotId !== npc.pilotId);
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
      // The Rec Room table, 30 Aug 2026 (Maxime: "assign sport around the
      // table, if full the ant gonna find something else to do") — only
      // set true by the two "walking toward company" branches below
      // (clique-approach and the random mingle fallback), never the
      // rival-avoid branch just above them (fleeing someone shouldn't
      // detour through a table on the way out).
      let wantsCompany = false;
      if (worst && worst.value <= RIVAL_THRESHOLD && Math.random() < RIVAL_AVOID_CHANCE) {
        const rivalNpc = roommates.find((n) => n.pilotId === worst.otherId)!;
        dest = pointAwayFrom({ x: npc.x, y: npc.y }, { x: rivalNpc.x, y: rivalNpc.y }, ROAM_DRIFT_DIST);
      } else if (closest && closest.value >= CLIQUE_THRESHOLD && Math.random() < CLIQUE_APPROACH_CHANCE) {
        const bondNpc = roommates.find((n) => n.pilotId === closest.otherId)!;
        dest = pointNear({ x: bondNpc.x, y: bondNpc.y }, ROAM_APPROACH_DIST);
        wantsCompany = true;
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
        wantsCompany = true;
      }

      // The Rec Room table, continued — redirect an already-decided "walk
      // toward company" destination to the table instead, but only while a
      // real seat is open. RECROOM_TABLE_SEATS full falls straight through
      // to the dest already computed above, UNCHANGED — that IS "find
      // something else to do" here: still mingling with that same
      // roommate, just wherever they actually are, not queued at a full
      // table. Counts roommates currently within RECROOM_TABLE_RADIUS
      // (this NPC isn't there yet, so it isn't counted against its own
      // seat) — a live, per-tick count, not a reserved/claimed seat
      // system, same "cheap enough at today's roster size" ethos every
      // other O(n) scan in this file already runs on.
      if (npc.room === "recroom" && wantsCompany) {
        // 3 Sep 2026 — the table is solid now, so "at the table" is "at the
        // rim": within the table's radius plus a body's, plus a little slack.
        const atTable = roommates.filter((n) => n.room === "recroom" && Phaser.Math.Distance.Between(n.x, n.y, this.f.points.recroomTable.x, this.f.points.recroomTable.y) <= RECROOM_TABLE_RADIUS + NPC_R + 14).length;
        if (atTable < RECROOM_TABLE_SEATS) {
          // A point on the rim at a random angle; clampToDeckFloor below
          // pushes it the last few px clear of the table's own solid.
          const seatAngle = Math.random() * Math.PI * 2;
          dest = { x: this.f.points.recroomTable.x + Math.cos(seatAngle) * (RECROOM_TABLE_RADIUS + NPC_R + 2), y: this.f.points.recroomTable.y + Math.sin(seatAngle) * (RECROOM_TABLE_RADIUS + NPC_R + 2) };
        }
      }

      // Clamped here, not left to tryMoveNpc's own per-step clamp — an
      // unclamped target near a wall could sit outside the room entirely,
      // and since only the ACTUAL (clamped) position is compared against
      // the (unclamped) target for arrival, that would leave the NPC
      // walking toward a point it can structurally never reach. Deck-aware
      // for the same reason every other clamp site here is now.
      const destClamped = clampToDeckFloor(this.f.roomDeck(npc.room), dest.x, dest.y, NPC_R);
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
    // Tier 6 hotfix, 30 Aug 2026 — see MAX_CONCURRENT_BUBBLES_PER_DECK's own
    // comment for the full "why" (Tier 3's roster expansion straining a
    // system tuned for 3 NPCs). One O(n) pass, computed once per tick rather
    // than re-counted per candidate pair below — a live bubble can only
    // clear between ticks (updateBubbles), never mid-tick, so a single count
    // up front is exact, not just an approximation.
    let currentDeckBubbleCount = 0;
    for (const n of this.npcs) {
      if (now < n.bubbleUntil && this.sameDeck(n.room, this.currentRoomId)) {
        currentDeckBubbleCount++;
      }
    }
    const currentDeckAtCap = currentDeckBubbleCount >= MAX_CONCURRENT_BUBBLES_PER_DECK;

    for (let i = 0; i < this.npcs.length; i++) {
      const npcA = this.npcs[i];
      if (npcA.targetX !== undefined) continue; // mid-walk somewhere else — not settled enough to strike up anything
      // NPC Conversation Lock Fix, 6 Sep 2026 — belt-and-suspenders, not a
      // live bug on its own: every encounter already pushes both sides'
      // nextEncounterAt out by ENCOUNTER_COOLDOWN_MIN/MAX_MS (12-22s), well
      // past NPC_ENGAGEMENT_HOLD_MS (7.8s), so the check just below already
      // stops a third ant from pairing with an engaged npcA today. Checked
      // anyway so that invariant (one cooldown constant staying bigger than
      // another, unrelated one) doesn't have to hold forever for this to
      // stay correct.
      if (isNpcEngaged(npcA.engagedUntil, now)) continue;
      if (npcA.nextEncounterAt === undefined || now < npcA.nextEncounterAt) continue;
      // Every candidate npcB below is this.sameDeck(npcB.room, npcA.room) by
      // construction, so if npcA is on the saturated deck, no pair this
      // outer iteration could find would be allowed to show a bubble either
      // — skip the whole inner scan rather than doing the work and then
      // discarding the result. Both npcA's and npcB's own nextEncounterAt
      // stay untouched, so this pair just re-tries next tick.
      if (currentDeckAtCap && this.sameDeck(npcA.room, this.currentRoomId)) continue;

      for (let j = i + 1; j < this.npcs.length; j++) {
        const npcB = this.npcs[j];
        if (!this.sameDeck(npcB.room, npcA.room)) continue;
        if (npcB.targetX !== undefined) continue;
        // NPC Conversation Lock Fix, 6 Sep 2026 — same belt-and-suspenders
        // reasoning as npcA's own check above.
        if (isNpcEngaged(npcB.engagedUntil, now)) continue;
        if (npcB.nextEncounterAt === undefined || now < npcB.nextEncounterAt) continue;
        if (Phaser.Math.Distance.Between(npcA.x, npcA.y, npcB.x, npcB.y) > ENCOUNTER_RADIUS) continue;

        // Anger Blowup, 28 Aug 2026 (Groups 3-5 batch rebuild) — checked
        // ahead of the ordinary encounter roll, not on top of it: a pair
        // that blows up this tick gets that INSTEAD of an ordinary
        // encounter, same "one real thing happens per settled pair per
        // tick" shape this loop already has.
        if (this.tryAngerBlowup(npcA, npcB, now)) {
          break;
        }

        // Boredom-driven Spar, 30 Aug 2026 (Maxime: "boredom should trigger
        // spar") — same "instead of, not on top of" shape as Anger Blowup
        // just above, checked second: a settled pair in the Spar Room with
        // a real reason to be there gets an actual spar, not a coin-flip
        // chance at "talk"/pegBoard/poker/fletchers/askOut instead (none of
        // which make sense in the Spar Room's own context anyway).
        if (this.tryBoredomSpar(npcA, npcB, now)) {
          break;
        }

        this.runNpcEncounter(npcA, npcB, now);
        break;
      }
    }
  }

  // Anger Blowup, 28 Aug 2026 (Groups 3-5 batch rebuild) — see
  // data/angerBlowup.ts's own header for the full design and the gate-
  // verification chain this closes (needs -> Stress -> this -> a real bond
  // shift). Gated on both NPCs' own nextBlowupAt, not just npcA's — a
  // one-sided cooldown would let npcB re-trigger a blowup against a fresh
  // partner the very next tick after being the "calm" side of one.
  private tryAngerBlowup(npcA: HubNpc, npcB: HubNpc, now: number): boolean {
    if (npcA.nextBlowupAt === undefined || now < npcA.nextBlowupAt) return false;
    if (npcB.nextBlowupAt === undefined || now < npcB.nextBlowupAt) return false;
    const key = pairKey(npcA.pilotId, npcB.pilotId);
    const bond = this.npcSocial.bonds[key] ?? 0;
    if (!isAngerBlowupEligible(bond, npcA.ambient.stress, npcB.ambient.stress)) return false;
    if (Math.random() >= ANGER_BLOWUP_CHANCE) return false;
    this.runAngerBlowup(npcA, npcB, bond, key, now);
    return true;
  }

  // The actual blowup — bond takes a real hit, whichever side (or both)
  // was actually over STRESS_PANIC_THRESHOLD gets real relief (venting,
  // not a full reset — see applyAngerBlowupStressRelief's own comment),
  // and it's logged as a real socialLog entry so the Highlights reel and
  // any future curated-recall line can reference it by name, same as any
  // other verb.
  /**
   * Emotional Brain, 12 Sep 2026 — who was in the room when something
   * happened to `npc`. Recorded on the memory now (data/memories.ts
   * `witnesses`), acted on later (the audience gate, build plan §8).
   */
  private roomWitnesses(npc: HubNpc): string[] {
    return this.npcs.filter((n) => n !== npc && n.room === npc.room).map((n) => n.pilotId);
  }

  private runAngerBlowup(npcA: HubNpc, npcB: HubNpc, bond: number, key: string, now: number) {
    const exchange = pickAngerBlowupExchange();
    this.npcSocial.bonds[key] = bond + ANGER_BLOWUP_BOND_DELTA;

    if (npcA.ambient.stress >= STRESS_PANIC_THRESHOLD) {
      npcA.ambient.stress = applyAngerBlowupStressRelief(npcA.ambient.stress);
      this.persistNpcSocial(npcA);
    }
    if (npcB.ambient.stress >= STRESS_PANIC_THRESHOLD) {
      npcB.ambient.stress = applyAngerBlowupStressRelief(npcB.ambient.stress);
      this.persistNpcSocial(npcB);
    }
    // Covers the bond write above even on the (real, allowed) case where
    // neither side was individually over threshold this exact tick —
    // isAngerBlowupEligible only requires bond eligibility plus at least
    // one side's stress at eligibility TIME, which can drift by the time
    // this actually resolves in the same frame. persistNpcSocial already
    // calls saveCampaignState, so this is only ever a harmless extra call
    // when it does, never a missed one.
    saveCampaignState(this.campaignState);

    // Staged two-line exchange, same shape runNpcEncounter's own "talk"
    // kind already uses (npcA's line first, npcB's reply after a beat).
    this.showBubble(npcA, exchange.lineA, now);
    const lineB = exchange.lineB;
    this.time.delayedCall(NPC_REPLY_DELAY_MS, () => {
      this.showBubble(npcB, lineB, this.time.now);
    });

    // Logged into BOTH pilots' own socialLog — the first NPC-vs-NPC verb
    // entry to do that (every other verb is player-vs-one-NPC, so it only
    // ever logs to one side). The first rebuild pass only pushed to
    // npcA — missed per the authoritative spec (Social Sim Roadmap #15):
    // "both sides get their own dated entry holding the line they
    // actually said." Fixed here.
    npcA.socialLog?.push({ verb: "angerBlowup", line: `${exchange.lineA} / ${exchange.lineB}`, at: Date.now() });
    npcB.socialLog?.push({ verb: "angerBlowup", line: `${exchange.lineA} / ${exchange.lineB}`, at: Date.now() });
    // Emotional Brain, 12 Sep 2026 — both of them carry it, each about the
    // other, processed as anger. recordMemory persists straight onto the
    // social state persistNpcSocial/saveCampaignState above already wrote.
    recordMemory(this.campaignState, npcA.pilotId, { kind: "blowup", echo: "anger", about: [npcB.pilotId], witnesses: this.roomWitnesses(npcA) });
    recordMemory(this.campaignState, npcB.pilotId, { kind: "blowup", echo: "anger", about: [npcA.pilotId], witnesses: this.roomWitnesses(npcB) });
    saveCampaignState(this.campaignState);

    // NPC Conversation Lock Fix, 6 Sep 2026 — same fix as runNpcEncounter
    // above; this function always stages a real two-line exchange, so the
    // full NPC_ENGAGEMENT_HOLD_MS window is never an overestimate here.
    npcA.engagedUntil = npcB.engagedUntil = now + NPC_ENGAGEMENT_HOLD_MS;

    const nextA = now + ENCOUNTER_COOLDOWN_MIN_MS + Math.random() * (ENCOUNTER_COOLDOWN_MAX_MS - ENCOUNTER_COOLDOWN_MIN_MS);
    const nextB = now + ENCOUNTER_COOLDOWN_MIN_MS + Math.random() * (ENCOUNTER_COOLDOWN_MAX_MS - ENCOUNTER_COOLDOWN_MIN_MS);
    npcA.nextEncounterAt = nextA;
    npcB.nextEncounterAt = nextB;
    // Randomized 90s-3min range (ANGER_BLOWUP_COOLDOWN_MIN/MAX_MS), not a
    // flat 45s — the first rebuild pass used a flat cooldown instead of
    // the real spec's range. Independent draws per side, same pattern
    // ENCOUNTER_COOLDOWN_MIN/MAX_MS already uses just above.
    npcA.nextBlowupAt = now + ANGER_BLOWUP_COOLDOWN_MIN_MS + Math.random() * (ANGER_BLOWUP_COOLDOWN_MAX_MS - ANGER_BLOWUP_COOLDOWN_MIN_MS);
    npcB.nextBlowupAt = now + ANGER_BLOWUP_COOLDOWN_MIN_MS + Math.random() * (ANGER_BLOWUP_COOLDOWN_MAX_MS - ANGER_BLOWUP_COOLDOWN_MIN_MS);
  }

  // Boredom-driven Spar, 30 Aug 2026 (Maxime: "boredom should trigger
  // spar") — see socialSim.ts's own EncounterKind comment for the full
  // "how this differs from Breakdown's own spar flavor" account. No
  // dedicated cooldown clock the way Anger Blowup gets its own
  // nextBlowupAt — this is an everyday, low-stakes social event, not a rare
  // crisis, so the shared nextEncounterAt cooldown both sides already had
  // to clear to reach updateNpcEncounters' inner loop at all is enough on
  // its own (set at the end of runBoredomSpar, same as an ordinary
  // encounter). Eligible only when BOTH are actually standing in the Spar
  // Room (this makes no sense anywhere else) and at least one side's
  // boredom meter is genuinely low — mirrors isBreakdownEligible's own
  // "both a real gate AND a chance roll" shape (data/breakdown.ts), not a
  // guaranteed fire the instant two bored pilots happen to be in the room
  // together.
  private tryBoredomSpar(npcA: HubNpc, npcB: HubNpc, now: number): boolean {
    if (npcA.room !== "sparRoom" || npcB.room !== "sparRoom") return false;
    if (npcA.boredom >= NEEDS_LOW_THRESHOLD && npcB.boredom >= NEEDS_LOW_THRESHOLD) return false;
    if (Math.random() >= SPAR_CHANCE) return false;
    this.runBoredomSpar(npcA, npcB, now);
    return true;
  }

  // The actual spar — a real socialSim.ts encounter (resolveSparEncounter),
  // not a hand-rolled result here, same "this file composes, data/**
  // decides" split runNpcEncounter already keeps for its own five kinds
  // (Build Brief §5.2). No Stress relief applied here on purpose — that's
  // Breakdown's own crisis-resolution job (BREAKDOWN_STRESS_RELIEF); an
  // everyday bored-pilot spar only ever moves the bond and (via the next
  // updateNeeds tick reading this bubble's own bubbleUntil, same as any
  // other encounter — see boredom's own HubNpc field comment) relieves the
  // boredom that sent them here in the first place.
  private runBoredomSpar(npcA: HubNpc, npcB: HubNpc, now: number) {
    const key = pairKey(npcA.pilotId, npcB.pilotId);
    const bond = this.npcSocial.bonds[key] ?? 0;
    const pilotA: SocialSimPilot = { pilotId: npcA.pilotId, displayName: npcA.displayName.split("—")[0].trim(), catalyst: npcA.ambient.catalyst, stage: npcA.ambient.stage, species: npcA.species };
    const pilotB: SocialSimPilot = { pilotId: npcB.pilotId, displayName: npcB.displayName.split("—")[0].trim(), catalyst: npcB.ambient.catalyst, stage: npcB.ambient.stage, species: npcB.species };
    const result = resolveSparEncounter({ pilotA, pilotB, bond, aCommitted: false, bCommitted: false, rng: Math.random });
    this.npcSocial.bonds[key] = bond + result.bondDelta;
    saveCampaignState(this.campaignState);

    this.showBubble(npcA, result.summary, now);

    // Logged to both sides, same NPC-vs-NPC convention runAngerBlowup's own
    // comment already established (every other verb is player-vs-one-NPC).
    npcA.socialLog?.push({ verb: "spar", line: result.summary, at: Date.now() });
    npcB.socialLog?.push({ verb: "spar", line: result.summary, at: Date.now() });

    // NPC Conversation Lock Fix, 6 Sep 2026 — npcB never actually shows a
    // bubble here (only npcA gets the summary line), so there's no reply
    // for npcB to be caught mid-wait for, but holding both anyway matches
    // runNpcEncounter's own single-bubble kinds (pegBoard/poker/fletchers/
    // askOut), which get the same blanket treatment for the same reason:
    // one rule for "an encounter is in progress," not a special case per
    // branch depending on who does or doesn't get a bubble.
    npcA.engagedUntil = npcB.engagedUntil = now + NPC_ENGAGEMENT_HOLD_MS;

    const nextA = now + ENCOUNTER_COOLDOWN_MIN_MS + Math.random() * (ENCOUNTER_COOLDOWN_MAX_MS - ENCOUNTER_COOLDOWN_MIN_MS);
    const nextB = now + ENCOUNTER_COOLDOWN_MIN_MS + Math.random() * (ENCOUNTER_COOLDOWN_MAX_MS - ENCOUNTER_COOLDOWN_MIN_MS);
    npcA.nextEncounterAt = nextA;
    npcB.nextEncounterAt = nextB;
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

    // Toxic Pairs, 28 Aug 2026 (Groups 3-5 batch rebuild) — see
    // data/toxicPairs.ts's own header. A small ambient Stress cost for
    // sharing a hub with a real rival, applied every time this pair
    // actually encounters each other (not every frame) — a no-op for any
    // pair that isn't a real rivalry (toxicPairStressTick's own 0 return).
    // Deliberately doesn't skip the ordinary encounter below: this is the
    // quiet background cost of the interaction, on top of whatever
    // simulateEncounter itself rolls, not a replacement for it (Anger
    // Blowup, checked before this function is ever called, is that
    // replacement).
    const preStressA = npcA.ambient.stress;
    const preStressB = npcB.ambient.stress;
    npcA.ambient.stress = applyToxicPairStressTick(npcA.ambient.stress, bond);
    npcB.ambient.stress = applyToxicPairStressTick(npcB.ambient.stress, bond);
    if (npcA.ambient.stress !== preStressA) this.persistNpcSocial(npcA);
    if (npcB.ambient.stress !== preStressB) this.persistNpcSocial(npcB);

    const playerCommitted = new Set(this.npcs.filter((n) => n.inRelationship).map((n) => n.pilotId));
    const aCommitted = isCommitted(npcA.pilotId, this.npcSocial, playerCommitted);
    const bCommitted = isCommitted(npcB.pilotId, this.npcSocial, playerCommitted);

    const pilotA: SocialSimPilot = { pilotId: npcA.pilotId, displayName: npcA.displayName.split("—")[0].trim(), catalyst: npcA.ambient.catalyst, stage: npcA.ambient.stage, species: npcA.species };
    const pilotB: SocialSimPilot = { pilotId: npcB.pilotId, displayName: npcB.displayName.split("—")[0].trim(), catalyst: npcB.ambient.catalyst, stage: npcB.ambient.stage, species: npcB.species };
    // minigamesEligible, 2 Sep 2026 — real bug, not hypothetical: this
    // caller is only ever reached for a same-DECK pair (updateNpcEncounters'
    // own sameDeck check), and recroom/hangarDeck/berths all share the
    // "lower" deck with no wall at the seam (ROOM_DECK above). Without this,
    // socialSim.ts's pickEncounterKind could — and did — roll pegBoard/
    // poker/fletchers for a pair idling in Hangar Deck or Berths, narrating
    // a bubble about a poker game neither NPC was anywhere near. Checking
    // both actual rooms, not just sameDeck, mirrors the requireRoom fix
    // Tier 2 already applied to the player-triggered version of this same
    // verb set (nearestNpcInRange's own requireRoom param, above).
    const minigamesEligible = npcA.room === "recroom" && npcB.room === "recroom";
    // Rec Room Standings, slice 5 (3 Sep 2026) — the crew now play each
    // other for real, at their own practice-earned skill, instead of the
    // engine flipping a coin for poker and darts. Skills are supplied per
    // game because simulateEncounter is what picks which game happens; a
    // pilot who is a shark at cards and hopeless at darts is exactly what
    // the aptitude table exists to express, and one blended number would
    // throw that away.
    const recRoom = ensureRecRoomState(this.campaignState);
    const result = simulateEncounter({
      pilotA,
      pilotB,
      bond,
      aCommitted,
      bCommitted,
      minigamesEligible,
      skillA: this.recRoomSkills(recRoom, npcA),
      skillB: this.recRoomSkills(recRoom, npcB),
      rng: Math.random,
    });

    // ...and the session goes on the board, both sides. result.winner is a
    // real field the resolver sets, not something read back out of the
    // summary sentence — see EncounterResult.winner's own comment for why
    // that distinction mattered enough to add a field for.
    if (result.winner && (result.kind === "pegBoard" || result.kind === "poker" || result.kind === "fletchers")) {
      recordSession(recRoom, {
        gameId: result.kind,
        a: npcA.pilotId,
        b: npcB.pilotId,
        winner: result.winner === "draw" ? "draw" : result.winner === "a" ? npcA.pilotId : npcB.pilotId,
        bestA: result.detail?.scoreA,
        bestB: result.detail?.scoreB,
        day: currentDay(this.campaignState),
      });
    }

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
      this.startNpcAskOutRumor(pilotA.displayName, pilotB.displayName, "accepted", npcA.pilotId, npcB.pilotId);
    } else if (result.kind === "askOut") {
      // Rumor parity, 9 Sep 2026 — an NPC-NPC Ask Out rejection used to
      // only ever produce the narrated summary bubble below, on npcA
      // alone. That's the exact same event the player's own askOut()
      // rejection branch already turns into a REAL rumor (relayed
      // hop-to-hop through propagate(), decaying with distance,
      // occasionally exaggerated in transit), not just a one-off line.
      // Two NPCs turning each other down with nobody else on the ship
      // ever hearing about it was the actual gap "NPC-to-NPC rumors, not
      // just player-triggered" named — word travels the same way
      // regardless of who got turned down.
      this.startNpcAskOutRumor(pilotA.displayName, pilotB.displayName, "rejected", npcA.pilotId, npcB.pilotId);
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

    // NPC Conversation Lock Fix, 6 Sep 2026 — set unconditionally, covering
    // every branch above alike (see NPC_ENGAGEMENT_HOLD_MS's own comment
    // for why one flat window instead of one per branch).
    npcA.engagedUntil = npcB.engagedUntil = now + NPC_ENGAGEMENT_HOLD_MS;

    const nextA = now + ENCOUNTER_COOLDOWN_MIN_MS + Math.random() * (ENCOUNTER_COOLDOWN_MAX_MS - ENCOUNTER_COOLDOWN_MIN_MS);
    const nextB = now + ENCOUNTER_COOLDOWN_MIN_MS + Math.random() * (ENCOUNTER_COOLDOWN_MAX_MS - ENCOUNTER_COOLDOWN_MIN_MS);
    npcA.nextEncounterAt = nextA;
    npcB.nextEncounterAt = nextB;
  }

  // Extracted 9 Sep 2026 so runNpcEncounter's two askOut outcomes (accepted
  // via becameCouple, rejected via the kind==="askOut" else-branch) share
  // one "find a third party to start the gossip" implementation instead of
  // duplicating it. Excludes BOTH pilotAId and pilotBId — the player path
  // (askOut() above) only ever had one real NPC to exclude, since the
  // asker there is the player, never an NPC; here both halves of the pair
  // are NPCs, and neither should be the one who starts spreading word
  // about their own Ask Out. Silently no-ops with nobody else around to
  // start it, same "the direct reaction still stands on its own" call
  // askOut()'s own rejection branch already makes.
  private startNpcAskOutRumor(askerName: string, targetName: string, outcome: "accepted" | "rejected", pilotAId: string, pilotBId: string) {
    const others = this.npcs.filter((n) => n.pilotId !== pilotAId && n.pilotId !== pilotBId);
    if (others.length === 0) return;
    const gossipSource = others[Math.floor(Math.random() * others.length)];
    const message: HubMessage = { kind: "rumor", outcome, askerName, targetName };
    const gossipLine = pickLineForMessage(gossipSource.ambient, message);
    this.time.delayedCall(PROPAGATION_HOP_DELAY_MS, () => {
      this.showBubble(gossipSource, gossipLine, this.time.now);
      this.propagate(gossipSource, message, new Set([gossipSource.pilotId]), 1);
    });
  }

  // Piece #2's only trigger, on purpose — an emotion or a rumor reaching an
  // NPC never moves them, only a muster message does. Matches Maxime's own
  // words exactly ("the troop will assemble") rather than generalizing
  // movement to every message kind.
  //
  // Tier 1, 30 Aug 2026 (Consolidated Build Plan) — two fixes to a function
  // that was correct back when it was written (26 Aug, Rec-Room-only Hub,
  // every walkable NPC was a deployable pilot) and silently stopped being
  // correct as later passes changed both of those things without ever
  // touching this method:
  //
  // 1. Pilot-only gate ("muster incorrectly includes Mek NPCs"). "Shipping
  //    out to a mission" only means anything for a unit that can actually
  //    deploy — a Mek (or the CO) has no mission slot to head toward. Meks
  //    were deliberately given the exact same roaming/movement code as
  //    pilots (Mek NPC Introduction Plan v1, 29 Aug — this.npcs.push's own
  //    "Unlike the CO, these DO roam" comment above), which is what lets
  //    them get caught by a targetX/targetY assignment meant for pilots in
  //    the first place; nothing in this function had ever needed to ask
  //    "but is this unit actually deployable" before Meks existed to answer
  //    that "no." campaignState.pilots is the same deployable-roster lookup
  //    the Mek-seeding loop itself already gates on (that loop's own
  //    "pilotEntry.status !== 'active'" check) — a Mek's HubNpc.pilotId
  //    holds its MEK id ("mek_rourke", not "pilot_rourke", see that push
  //    call's own `pilotId: seed.mekId`), so it's never a key in
  //    campaignState.pilots and this lookup excludes it for free, no
  //    "mek_" prefix check needed. Same free exclusion catches the CO
  //    (CO_PILOT_ID = "npc_co") — not the reported bug, but the identical
  //    latent gap: he's stationary by design (no nextRoamAt at all — see
  //    his own buildNpcs push comment) and had no more business answering a
  //    muster call than a Mek does.
  // 2. Cross-deck routing ("muster call fails to route cross-deck"). This
  //    used to just set targetX/targetY straight to MUSTER_POINT — correct
  //    only when the NPC is already on MUSTER_ROOM's own deck, since plain
  //    free-roam movement never crosses a deck on its own (tryMoveNpc's own
  //    comment) and MUSTER_POINT is a single fixed pixel coordinate with no
  //    idea which deck it was even reachable from once the Grid grew past
  //    one. An NPC mustering from a different deck (Upper's workshop, say)
  //    would walk toward whatever that raw (x, y) happens to land on
  //    within ITS OWN current deck's floor — nowhere near the real bay —
  //    and then just sit there, arrived-but-wrong. Same
  //    sameDeck/nextHopDoor/travelTargetRoom machinery updateNpcRoaming's
  //    own cross-deck explore branch already uses (see that function's own
  //    comment): same-deck musters are unaffected (nextHopDoor returns
  //    undefined, direct walk to MUSTER_POINT exactly as before); a
  //    cross-deck muster now walks the first door instead, and
  //    updateNpcMovement's own completeDoorHop (which already knows how to
  //    keep chaining travelTargetRoom across multiple hops — see
  //    updateNpcRoaming's "mid cross-room journey" branch) carries it the
  //    rest of the way once it lands on each intermediate deck.
  private sendToMuster(npc: HubNpc) {
    if (!this.campaignState.pilots[npc.pilotId]) return; // Mek, CO, or anyone else with no mission slot to head toward
    if (this.sameDeck(npc.room, MUSTER_ROOM)) {
      npc.targetX = this.f.points.muster.x;
      npc.targetY = this.f.points.muster.y;
    } else {
      const door = this.nextHopDoor(npc.room, MUSTER_ROOM);
      if (door) {
        npc.travelTargetRoom = MUSTER_ROOM;
        const approach = this.approachDoorTarget(npc, door);
        npc.targetX = approach.x;
        npc.targetY = approach.y;
      }
      // No door found — shouldn't happen on this map's star/line topology
      // (nextHopDoor's own fail-safe comment elsewhere makes the same call)
      // — falls through without a target rather than guessing one; the next
      // muster call (or this NPC's own stuck-give-up retry, same as any
      // other travelTargetRoom journey) tries again instead of this
      // silently mis-sending them somewhere.
    }
    // 27 Aug 2026 — see HubNpc.mustered's own header. Marks this NPC as
    // "holding for muster" from the moment the message reaches them, not
    // just "currently walking somewhere" — updateNpcRoaming reads this to
    // keep them parked at the bay once they arrive, until endMuster() runs.
    // Set even on the cross-deck branch (mid-journey, not yet at
    // MUSTER_POINT) so updateNpcRoaming's own mustered guard stops them
    // from getting handed a fresh explore/mingle target partway through
    // the door hops, the exact gap that guard exists to close for the
    // same-deck case.
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

  // Breakdown, 28 Aug 2026 (Groups 3-5 batch rebuild) — a real NPC-NPC
  // couple, mirroring npcPartnerLabel's own NPC-NPC branch exactly
  // (this.npcSocial.relationships is the same source of truth, just
  // returning the actual HubNpc here instead of a display string). A
  // player-committed pilot has no separate NPC partner to find this way on
  // purpose — Ask Out's own "with you" relationship isn't a second pilot
  // who can physically walk over and comfort someone; updateBreakdownResolution
  // checks npc.inRelationship separately for that case. SECOND pass, gated
  // on deriveRelationshipStage(bond) === "committed" specifically — the
  // authoritative spec (Master Index Group 5): "gated specifically on
  // deriveRelationshipStage(...) === 'committed' (not 'dating' or
  // 'flirting')." The first rebuild pass returned the first NPC-NPC
  // relationships-list entry regardless of stage, which would've let a
  // pair still just "flirting" resolve someone else's breakdown as if
  // already committed.
  private findCommittedPartner(npc: HubNpc): HubNpc | undefined {
    for (const key of this.npcSocial.relationships) {
      const [a, b] = key.split("::");
      if (a !== npc.pilotId && b !== npc.pilotId) continue;
      const otherId = a === npc.pilotId ? b : a;
      const bond = this.npcSocial.bonds[key] ?? 0;
      if (deriveRelationshipStage(bond) !== "committed") continue;
      const other = this.npcs.find((n) => n.pilotId === otherId);
      if (other) return other;
    }
    return undefined;
  }

  // Breakdown trigger — see data/breakdown.ts's own header for the full
  // design and its place in the gate-verification chain (needs -> Stress
  // -> this, gated by Worry). Checked here, in update()'s unconditional
  // top block, rather than folded into updateNpcEncounters: unlike Anger
  // Blowup, a breakdown needs no second pilot present to START — it's a
  // single-pilot crisis, not a pair-scoped one. SECOND pass — the first
  // rebuild gated on Morale alone; the real spec gates on Stress AND the
  // live ambient.worried boolean together (isBreakdownEligible's own
  // header explains why Stress alone isn't enough here — that's Anger
  // Blowup's own gate, paired with a rivalry instead of Worry).
  private updateBreakdownTrigger(now: number) {
    for (const npc of this.npcs) {
      if (npc.breakdown) continue; // already mid-crisis — updateBreakdownResolution owns them until it resolves
      if (npc.nextBreakdownCheckAt === undefined || now < npc.nextBreakdownCheckAt) continue;
      npc.nextBreakdownCheckAt = now + BREAKDOWN_CHECK_INTERVAL_MS;
      if (!isBreakdownEligible(npc.ambient.stress, npc.ambient.worried ?? false)) continue;
      if (Math.random() >= BREAKDOWN_CHANCE) continue;

      npc.breakdown = true;
      npc.breakdownSince = now;
      this.showBubble(npc, pickBreakdownOnsetLine(), now);
    }
  }

  // Breakdown resolution — checked every tick a breakdown is open, not
  // just once: who's actually nearby can change frame to frame as NPCs
  // roam, and BREAKDOWN_SLEEP_TIMEOUT_MS only means anything if it's
  // genuinely being watched for. SECOND pass, rewritten against the real
  // spec's own three paths (Social Sim Roadmap #16 / Master Index Group
  // 5) rather than the first pass's invented partner/bondmate/alone shape:
  //  - "spar": the breakdown pilot is in the Spar Room together with
  //    either the player or another idle NPC also standing there.
  //  - "intimacy": the pilot has a committed partner — player or NPC,
  //    Maxime's own mid-build correction on the original, now-lost build
  //    ("the intimacy can be npc to npc... anything player can do npc can
  //    as well") — and that partner is at Berths too, and idle.
  //  - "sleep": unconditional once BREAKDOWN_SLEEP_TIMEOUT_MS (8 real
  //    minutes) passes unresolved, no location or partner required.
  // Checked in that order — a witnessed resolution always wins over the
  // sleep fallback on the rare tick both would technically qualify (only
  // possible right at the 8-minute mark itself).
  private updateBreakdownResolution(now: number) {
    for (const npc of this.npcs) {
      if (!npc.breakdown) continue;

      if (npc.room === "sparRoom") {
        const withPlayer = this.currentRoomId === "sparRoom";
        const sparPartner = this.npcs.find((n) => n.pilotId !== npc.pilotId && n.room === "sparRoom" && n.targetX === undefined);
        if (withPlayer || sparPartner) {
          this.resolveBreakdown(npc, "spar", withPlayer ? "player" : sparPartner, now);
          continue;
        }
      }

      if (isBerths(npc.room)) {
        // "committed partner (player or NPC)" — the spec's own wording
        // applies "committed" symmetrically to both cases (Social Sim
        // Roadmap #16: "once the pilot has a committed partner AND that
        // partner... is also there and idle"), so the player case checks
        // deriveRelationshipStage the same way findCommittedPartner does
        // for the NPC case, not just the flatter inRelationship boolean.
        const withPlayer =
          (npc.inRelationship ?? false) && deriveRelationshipStage(npc.favorability) === "committed" && this.currentRoomId === npc.room;
        const partner = this.findCommittedPartner(npc);
        const withNpcPartner = partner !== undefined && partner.room === npc.room && partner.targetX === undefined;
        if (withPlayer || withNpcPartner) {
          this.resolveBreakdown(npc, "intimacy", withPlayer ? "player" : partner, now);
          continue;
        }
      }

      if (npc.breakdownSince !== undefined && now - npc.breakdownSince >= BREAKDOWN_SLEEP_TIMEOUT_MS) {
        this.resolveBreakdown(npc, "sleep", undefined, now);
      }
    }
  }

  // The actual resolution — `partner` is whichever party
  // updateBreakdownResolution already identified for this flavor
  // ("player", a specific committed/present HubNpc, or undefined for
  // "sleep"), threaded straight through rather than re-derived here, so
  // whoever gets the Favorability/bond credit is always the exact same
  // one who's shown as having shown up. SECOND pass: Stress relief (not a
  // Morale gain) via applyBreakdownStressRelief, and a flat
  // BREAKDOWN_FAVORABILITY_GAIN applied UNCLAMPED — confirmed against the
  // real codebase convention (every other favorability/bond write in this
  // file has no ceiling/floor) rather than the clamped per-flavor gains
  // the first rebuild pass invented.
  private resolveBreakdown(npc: HubNpc, flavor: BreakdownFlavor, partner: HubNpc | "player" | undefined, now: number) {
    npc.ambient.stress = applyBreakdownStressRelief(npc.ambient.stress);
    this.persistNpcSocial(npc);

    if (partner === "player") {
      npc.favorability += BREAKDOWN_FAVORABILITY_GAIN;
      this.persistNpcSocial(npc);
    } else if (partner) {
      const key = pairKey(npc.pilotId, partner.pilotId);
      const bond = this.npcSocial.bonds[key] ?? 0;
      this.npcSocial.bonds[key] = bond + BREAKDOWN_FAVORABILITY_GAIN;
      saveCampaignState(this.campaignState);
    }
    // "sleep" (partner undefined) gets Stress relief only — nobody was
    // there to earn a relationship gain, per the spec's own framing.

    const line = pickBreakdownResolutionLine(flavor);
    this.showBubble(npc, line, now);
    npc.socialLog?.push({ verb: "breakdown", line, at: Date.now() });
    // Logged to both parties' socialLog when the partner is a real NPC —
    // same "both sides get their own dated entry" precedent Anger
    // Blowup's own runAngerBlowup already set. The player has no
    // socialLog of their own to push into.
    if (partner && partner !== "player") {
      partner.socialLog?.push({ verb: "breakdown", line, at: Date.now() });
    }
    // Emotional Brain, 12 Sep 2026 — the breakdown is carried as a memory:
    // slept off alone it stays sadness; worked through with someone (a
    // spar, an intimate scene) it is remembered as warmth, about them.
    recordMemory(this.campaignState, npc.pilotId, {
      kind: "breakdown",
      echo: partner ? "love" : "sadness",
      about: partner && partner !== "player" ? [partner.pilotId] : [],
      witnesses: this.roomWitnesses(npc),
    });
    saveCampaignState(this.campaignState);

    npc.breakdown = false;
    npc.breakdownSince = undefined;
    // Post-resolution cooldown — 90-180s before this pilot can trigger
    // again, mirroring Anger Blowup's own cooldown shape exactly. Reuses
    // nextBreakdownCheckAt rather than a new field — see that field's own
    // comment.
    npc.nextBreakdownCheckAt = now + BREAKDOWN_RESOLUTION_COOLDOWN_MIN_MS + Math.random() * (BREAKDOWN_RESOLUTION_COOLDOWN_MAX_MS - BREAKDOWN_RESOLUTION_COOLDOWN_MIN_MS);
  }

  private updateProximity() {
    let anyoneInRange = false;
    for (const npc of this.npcs) {
      if (!this.sameDeck(npc.room, this.currentRoomId)) continue;
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
    else if (this.isAtHangarShop()) this.interactPrompt.setText("E — roster & gear");
    else if (this.isAtCrewRecords()) this.interactPrompt.setText("E — crew records");
    else if (this.isAtWorkshopBench()) this.interactPrompt.setText("E — carrier modules");
    else if (this.isAtVaultPlinth()) this.interactPrompt.setText("E — the vault");
    else if (this.isAtArchiveTable()) this.interactPrompt.setText("E — the archive");
    else this.interactPrompt.setText(anyoneInRange ? "E — talk" : "");
  }

  // Tier 4, 30 Aug 2026 — same shape as isAtBay() just below: exact room
  // (not just deck) plus a real proximity radius, not just "visible from
  // anywhere on this deck" (HANGAR_SHOP_POINT's own marker IS visible from
  // the whole lower deck, same as the bay's — see refreshRoomVisibility —
  // but actually USING it needs the player standing at it specifically).
  private isAtHangarShop(): boolean {
    return this.currentRoomId === "hangarDeck" && Phaser.Math.Distance.Between(this.playerX, this.playerY, this.f.points.hangarShop.x, this.f.points.hangarShop.y) <= HANGAR_SHOP_RADIUS;
  }

  // B2, 5 Sep 2026 — the crew-records console. Same shape as
  // isAtHangarShop just above; CREW_RECORDS_POINT is placed 220px clear of
  // HANGAR_SHOP_POINT so these two can never both be true at once.
  private isAtCrewRecords(): boolean {
    return this.currentRoomId === "hangarDeck" && Phaser.Math.Distance.Between(this.playerX, this.playerY, this.f.points.crewRecords.x, this.f.points.crewRecords.y) <= HANGAR_SHOP_RADIUS;
  }

  private isAtWorkshopBench(): boolean {
    return this.currentRoomId === "workshop" && Phaser.Math.Distance.Between(this.playerX, this.playerY, this.f.points.workshopBench.x, this.f.points.workshopBench.y) <= WORKSHOP_BENCH_RADIUS;
  }

  private isAtVaultPlinth(): boolean {
    return this.currentRoomId === "vault" && Phaser.Math.Distance.Between(this.playerX, this.playerY, this.f.points.vaultPlinth.x, this.f.points.vaultPlinth.y) <= VAULT_PLINTH_RADIUS;
  }

  private isAtArchiveTable(): boolean {
    return this.currentRoomId === this.f.profile.archiveRoom && Phaser.Math.Distance.Between(this.playerX, this.playerY, this.f.points.archiveTable.x, this.f.points.archiveTable.y) <= ARCHIVE_TABLE_RADIUS;
  }

  private isAtStandingsBoard(): boolean {
    return this.currentRoomId === "recroom" && Phaser.Math.Distance.Between(this.playerX, this.playerY, this.f.points.recroomBoard.x, this.f.points.recroomBoard.y) <= STANDINGS_BOARD_RADIUS;
  }

  private isAtBay(): boolean {
    return this.currentRoomId === MUSTER_ROOM && Phaser.Math.Distance.Between(this.playerX, this.playerY, this.f.points.muster.x, this.f.points.muster.y) <= BAY_RADIUS;
  }

  // 6 Sep 2026, facility split — the estate's longest title ("THE
  // GREATHOUSE — CULTIVAR WORKS — 2ND LANCE", 42 chars) is ~100px wider than
  // Warden's longest and ran straight into the FLOOR: readout on its left
  // (caught in checkHubHouseAmaranth.mjs's ground-floor capture, the same
  // header row tools/verify/auditUiText.mjs's COLLIDE check watches). The
  // title is centred at x=480 between two left/right-anchored readouts, so
  // it shrinks a step at a time until it clears both — rather than renaming
  // rooms to fit a header, or moving readouts every other scene shares the
  // row with. Warden's titles all fit at 16px, so this is a no-op there.
  private fitRoomTitle() {
    const leftLimit = this.deckIndicatorText.x + this.deckIndicatorText.width + 12;
    const rightLimit = this.calendarDayText.x - this.calendarDayText.width - 12;
    for (const size of [16, 14, 12, 11]) {
      this.roomTitleText.setFontSize(size);
      const half = this.roomTitleText.width / 2;
      if (480 - half >= leftLimit && 480 + half <= rightLimit) break;
    }
  }

  // Phase 2 map growth — the nearest door in the CURRENT room within
  // DOOR_RADIUS, or null. Doors in other rooms are irrelevant by
  // construction (DOORS is filtered by d.room), same shape as every other
  // room-scoped check in this file.
  // 3 Sep 2026 — tiny public accessor for tools/verify scripts, which read
  // the live scene and have no other way to reach the module-level
  // ROOM_DECK table. Not used by gameplay code.
  roomDeckOf(room: RoomId): DeckId {
    return this.f.roomDeck(room);
  }

  private isAtDoor(): DoorDef | null {
    for (const d of this.f.doors) {
      if (d.room !== this.currentRoomId) continue;
      if (Phaser.Math.Distance.Between(this.playerX, this.playerY, d.x, d.y) <= DOOR_RADIUS) return d;
    }
    return null;
  }

  // Phase 2 map growth — the actual room-swap. Repositions the player at
  // the door's own entry point (chosen with clearance from that point's
  // own DOOR_RADIUS, see the DOORS table) and refreshes which room's
  // doors/NPCs/bay are visible and interactive.
  //
  // Tier 1, 30 Aug 2026 (Consolidated Build Plan, Tier 1 item #2 — "player
  // spawns on top of an NPC"). This used to place the player at the door's
  // literal (toX, toY) unconditionally — the exact same single-fixed-point
  // bug pickDoorLanding's own 26 Aug header already found and fixed for
  // NPCs landing on EACH OTHER; the player's own landing was simply never
  // brought in line with that fix at the time, since switchRoom predates
  // it and nothing revisited this spot afterward. An NPC can perfectly
  // well be standing at or near a door's landing point when the player
  // walks through it — same door, same coordinate, no reason it couldn't
  // — so the player needs the same jitter-and-reject treatment NPCs
  // already get, not a separate system: pickPointNearDoor with PLAYER_R
  // (not NPC_R — the player's own collision radius, so the rejection
  // check matches the real PLAYER_R+NPC_R math handleMovement's own NPC-
  // blocking check uses, not the NPC-on-NPC NPC_R+NPC_R distance), then
  // clamped the same way completeDoorHop already clamps an NPC's landing —
  // see that function's own comment for why clamping the point ITSELF,
  // not just each step toward it, is what keeps a jittered target from
  // ever being unreachable.
  private switchRoom(door: DoorDef) {
    this.currentRoomId = door.toRoom;
    const landing = pickPointNearDoor(
      this.f.roomDeck(door.toRoom),
      { x: door.toX, y: door.toY },
      this.npcs.filter((n) => n.room === door.toRoom),
      PLAYER_R,
    );
    const land = clampToDeckFloor(this.f.roomDeck(door.toRoom), landing.x, landing.y, PLAYER_R);
    this.playerX = land.x;
    this.playerY = land.y;
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
  // this.sameDeck(x, this.currentRoomId) — not by exact room. What stays
  // exact-room-scoped is the stuff that's genuinely about which room
  // you're standing IN specifically: the title bar's zone name and the
  // room note text (repositioned into that room's own zone rect below,
  // since it used to assume it was the only thing on screen).
  private refreshRoomVisibility() {
    const deck = this.f.roomDeck(this.currentRoomId);
    this.roomTitleText.setText(`${this.f.profile.displayName} — ${this.f.roomTitle(this.currentRoomId)}`);
    this.deckIndicatorText.setText(`${this.f.profile.levelWord}: ${this.f.deckTitle(deck)}`);
    this.fitRoomTitle();

    // Carrier Scale-Up Plan v1, Phase 1, 2 Sep 2026 — re-pin the camera to
    // whichever deck is now active every time this runs (a real stair
    // crossing, or the one-time create() call that sets up the starting
    // Rec Room state). setBounds is cheap and idempotent, so no dirty-
    // check against the previous deck is needed — just always set it.
    const camBounds = deckCameraBounds(deck);
    this.cameras.main.setBounds(camBounds.left, camBounds.top, camBounds.right - camBounds.left, camBounds.bottom - camBounds.top);

    // The egg hull, 27 Aug 2026 (both passes) — exactly one of the three
    // floors is ever visible: each deck's own. See drawDeckFloor/
    // drawGrottoFloor's own headers.
    for (const [id, floor] of Object.entries(this.deckFloors) as [DeckId, Phaser.GameObjects.Container][]) floor.setVisible(id === deck);

    // The egg hull, second pass, 27 Aug 2026 — same by-deck toggle as
    // doorMarkers/zoneDecor above.
    for (const marker of this.reservedBayMarkers) {
      const show = marker.def.deck === deck;
      marker.outline.setVisible(show);
      marker.label.setVisible(show);
    }

    for (const marker of this.doorMarkers) {
      const show = this.sameDeck(marker.def.room, this.currentRoomId);
      marker.outline.setVisible(show);
      marker.label.setVisible(show);
    }

    for (const decor of this.zoneDecor) {
      const show = this.sameDeck(decor.room, this.currentRoomId);
      for (const node of decor.nodes) node.setVisible(show);
    }

    const onLowerDeck = this.sameDeck("recroom", this.currentRoomId);
    this.bayOutline.setVisible(onLowerDeck);
    this.bayLabel.setVisible(onLowerDeck);
    // Tier 4, 30 Aug 2026 — same "visible across the whole deck, usable
    // only in the exact room" split as the bay marker just above (see
    // isAtHangarShop's own comment).
    this.hangarShopOutline.setVisible(onLowerDeck);
    this.hangarShopLabel.setVisible(onLowerDeck);
    // Crew Records, 11 Sep 2026 — same whole-deck visibility as the
    // Roster & Gear marker just above; see drawCrewRecordsPoint's header.
    this.crewRecordsOutline.setVisible(onLowerDeck);
    this.crewRecordsLabel.setVisible(onLowerDeck);
    // The Rec Room table, 30 Aug 2026 — same whole-deck visibility as the
    // bay/shop markers just above.
    this.recroomTableOutline.setVisible(onLowerDeck);
    this.recroomTableLabel.setVisible(onLowerDeck);
    // The Workshop bench, 2 Sep 2026 — upper deck, same whole-deck
    // visibility / exact-room usability split as every marker above.
    // Optional-chained because drawWorkshopBenchPoint runs in create()
    // alongside the others but these two fields are declared optional
    // (the marker is new this pass and nothing else depends on it
    // existing), so a partially-constructed scene can't throw here.
    const onUpperDeck = this.sameDeck("workshop", this.currentRoomId);
    this.workshopBenchOutline?.setVisible(onUpperDeck);
    this.workshopBenchLabel?.setVisible(onUpperDeck);
    // The Vault plinth, 2 Sep 2026 — vault shares the upper deck with
    // workshop (ROOM_DECK.vault === "upper"), so onUpperDeck already
    // answers "is this deck showing" for both markers.
    this.vaultPlinthOutline?.setVisible(onUpperDeck);
    this.vaultPlinthLabel?.setVisible(onUpperDeck);
    // The standings board, 3 Sep 2026 — Rec Room, so the LOWER deck, not
    // the upper one the two markers above share. Same visible-by-deck /
    // usable-by-exact-room split every other marker here uses.
    // The Archive table, 7 Sep 2026 — asks the profile which room it stands
    // in rather than naming one, because Warden's is in the CIC (upper deck)
    // and the House's is in Records (its own floor).
    const archiveDeckShowing = this.sameDeck(this.f.profile.archiveRoom, this.currentRoomId);
    this.archiveTableOutline?.setVisible(archiveDeckShowing);
    this.archiveTableLabel?.setVisible(archiveDeckShowing);
    const boardDeckShowing = this.sameDeck("recroom", this.currentRoomId);
    this.standingsBoardOutline?.setVisible(boardDeckShowing);
    this.standingsBoardLabel?.setVisible(boardDeckShowing);

    const note = this.roomNote(this.currentRoomId);
    const zone = this.f.roomZone(this.currentRoomId);
    this.roomNoteText.setPosition((zone.left + zone.right) / 2, (zone.top + zone.bottom) / 2);
    this.roomNoteText.setWordWrapWidth(Math.max(160, zone.right - zone.left - 60));
    this.roomNoteText.setText(note ?? "");
    this.roomNoteText.setVisible(!!note);

    for (const npc of this.npcs) {
      const here = this.sameDeck(npc.room, this.currentRoomId);
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
    // Hub Hints & Orientation, 11 Sep 2026 — deploy() ends in scene.start()
    // a few lines below, which tears down every game object in this scene
    // immediately (not a "sleep" — a real stop), so a banner shown here
    // would be destroyed before a single frame of it ever rendered without
    // gateFirstHubHint's own one-beat hold. See that method's own header.
    this.gateFirstHubHint(
      "bay",
      ["THE BAY", "Your deploy point — this sends you to pick your next mission. Whatever you set up in Roster & Gear before this moment is what heads out with you."],
      () => this.finishDeploy()
    );
  }

  private finishDeploy() {
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
  // CO Check-In Gate Plan v1, 28 Aug 2026 — built 1 Sep 2026. Permanent
  // once set (Maxime: "only once heavy nudge") — see canLaunchMission's own
  // comment (engine/campaignState.ts) for what this unblocks.
  private markCoCheckedIn() {
    if (this.campaignState.hasCheckedInWithCo) return;
    this.campaignState.hasCheckedInWithCo = true;
    saveCampaignState(this.campaignState);
  }

  private speak() {
    const now = this.time.now;
    // Hub Hints & Orientation, 11 Sep 2026 — fired on "someone is actually
    // in range to talk to," checked once here rather than inside the loop
    // below: that loop's own branches (stage promotions, rank greetings,
    // Gate 0's engagement roll, etc.) can legitimately produce NO bubble at
    // all on a given press, but the player still successfully walked up
    // and talked to someone for real, which is the moment this hint is
    // actually about.
    if (this.npcs.some((npc) => this.sameDeck(npc.room, this.currentRoomId) && Phaser.Math.Distance.Between(this.playerX, this.playerY, npc.x, npc.y) <= TALK_RADIUS)) {
      this.showHubHint("crew_talk", ["TALKING TO YOUR CREW", "This isn't flavor text — it's a real system. Every conversation moves Favorability, Stress, and Morale, and can grow into an actual relationship over time."]);
    }
    for (const npc of this.npcs) {
      if (!this.sameDeck(npc.room, this.currentRoomId)) continue;
      const dist = Phaser.Math.Distance.Between(this.playerX, this.playerY, npc.x, npc.y);
      if (dist > TALK_RADIUS) continue;
      // CO Check-In Gate Plan v1 — reaching him via ordinary Talk satisfies
      // it too, not just chat, regardless of which branch below actually
      // fires a line.
      if (npc.pilotId === CO_PILOT_ID) this.markCoCheckedIn();
      // Stage-promotion "graduation" reveal, 27 Aug 2026 — checked before
      // Gate 0, and deliberately bypasses it entirely: this is a one-time,
      // narratively real beat (the whole point is that a promotion is
      // guaranteed to actually surface, not "surfaces most of the time"),
      // not ordinary ambient chatter competing for the same engagement
      // roll everything else in this function rolls against.
      if (npc.pendingStagePromotion) {
        const line = pickStagePromotionLine(npc.ambient.catalyst, npc.pendingStagePromotion);
        this.showBubble(npc, line, now);
        this.holdForPlayerTalk(npc);
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
        this.holdForPlayerTalk(npc);
        npc.pendingRankGreeting = undefined;
        this.ackRankGreeting(npc);
        continue;
      }
      // CO Tier-3 call-out, 2 Sep 2026 — same Gate-0-bypassing, guaranteed-
      // to-surface treatment as the two reveals just above, for the same
      // reason: this is a real, one-time story beat (the CO confronting the
      // player about a pilot who refuses to fly with them), not ordinary
      // ambient chatter. Fires the next time the player talks to the CO
      // specifically, while at least one pilot is sitting in the Insult
      // Tier-3 standoff and hasn't been called out about yet — same
      // one-shot shape muntiLossAnnounced/mekRetirementAnnounced already
      // use (HubPilotSocialState.coCalloutGiven, engine/campaignState.ts).
      if (npc.pilotId === CO_PILOT_ID) {
        const flagged = Object.entries(this.campaignState.pilots).find(
          ([, e]) => e.status === "active" && e.social?.refusesDeployment && !e.social?.coCalloutGiven
        );
        if (flagged) {
          const [, entry] = flagged;
          const name = entry.pilot.displayName.split("—")[0].trim();
          const line = pickCoCalloutLine().replace("{NAME}", name);
          this.showBubble(npc, line, now);
          this.holdForPlayerTalk(npc);
          entry.social!.coCalloutGiven = true;
          saveCampaignState(this.campaignState);
          continue;
        }
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
        this.holdForPlayerTalk(npc);
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
        this.holdForPlayerTalk(npc);
        topic.mentionedBy.push(npc.pilotId);
        continue;
      }
      if (!gate0Reacts(npc.ambient)) continue;
      const { line } = this.pickAmbientLineWithMemory(npc);
      this.showBubble(npc, line, now);
      this.holdForPlayerTalk(npc);
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
      if (!this.sameDeck(npc.room, this.currentRoomId)) continue;
      const dist = Phaser.Math.Distance.Between(this.playerX, this.playerY, npc.x, npc.y);
      if (dist > TALK_RADIUS) continue;
      // Bug fix, 2 Sep 2026 (Bloom_Wars_Bug_MusterCrossDeckNoMove_02Sep2026.md)
      // — this used to show every in-range NPC an identical "aye, heading
      // out" bubble before even checking whether sendToMuster would
      // actually do anything. A Mek or the CO always fails sendToMuster's
      // own `campaignState.pilots[npc.pilotId]` guard (see its header —
      // neither has a mission slot to head toward), so standing near a Mek
      // in the Workshop and calling muster produced exactly the reported
      // symptom: a cheerful acknowledgment bubble, then no movement at
      // all, forever — not a routing failure (nextHopDoor is verified
      // complete for every room pair, including every upper-deck room to
      // MUSTER_ROOM), just an unconditional reply hiding a silent no-op.
      // Follow-up, same day (addendum's own flagged open question,
      // Maxime: "yes") — dead silence read as its own bug, so these NPCs
      // now get a real in-voice decline instead of either the fake
      // "on my way" or nothing at all. Still no sendToMuster call, still no
      // relay scheduled below — a decline doesn't spread the call onward
      // any more than a real acknowledgment always did before this fix.
      if (message.kind === "muster" && !this.campaignState.pilots[npc.pilotId]) {
        const declineLine = pickMusterDeclineLine(npc.pilotId === CO_PILOT_ID ? "co" : "mek");
        this.showBubble(npc, declineLine, now);
        continue;
      }
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
    const mcRecord = this.campaignState.pilots[this.f.profile.mc.pilotId]?.pilot;
    const askerName = mcRecord ? mcRecord.displayName.split("—")[0].trim() : "The Commander";

    const sourceIdx = Math.floor(Math.random() * this.npcs.length);
    let targetIdx = Math.floor(Math.random() * this.npcs.length);
    while (targetIdx === sourceIdx) targetIdx = Math.floor(Math.random() * this.npcs.length);

    const source = this.npcs[sourceIdx];
    const target = this.npcs[targetIdx];
    const targetName = target.displayName.split("—")[0].trim();

    // 9 Sep 2026 — coin-flipped rather than always "rejected," now that a
    // real accepted-outcome rumor exists too. Exercises both banks from
    // the same debug key instead of only ever proving the rejection half.
    const outcome: "rejected" | "accepted" = Math.random() < 0.5 ? "accepted" : "rejected";
    const message: HubMessage = { kind: "rumor", outcome, askerName, targetName };
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
      // Same muster exclusion as broadcastMessage's direct case, above —
      // see that comment for the full account. A relayed muster call must
      // not let a Mek or the CO catch it either, for the identical reason:
      // sendToMuster would silently refuse them regardless. Same follow-up
      // too: a decline line instead of silence, staggered by hop like the
      // ordinary reaction below so it doesn't pop in ahead of the wave
      // that's supposedly still travelling toward them. Marked visited so a
      // second relay path reaching the same NPC doesn't repeat the bubble;
      // deliberately not added to its own outward propagate — a decline
      // doesn't carry the call any further, same as before this pass.
      if (incoming.kind === "muster" && !this.campaignState.pilots[npc.pilotId]) {
        visited.add(npc.pilotId);
        const declineLine = pickMusterDeclineLine(npc.pilotId === CO_PILOT_ID ? "co" : "mek");
        this.time.delayedCall(hop * PROPAGATION_HOP_DELAY_MS, () => {
          this.showBubble(npc, declineLine, this.time.now);
        });
        continue;
      }

      visited.add(npc.pilotId);
      // Adjustment, 25 Aug 2026, revised same day per Maxime: first pass
      // just exempted the rumor's own subject from the relay so she
      // wouldn't overhear gossip about herself ("heard Iyari turned Rourke
      // down" reaching Iyari). Sharpened: she should still catch the wave
      // like anyone else, but what she reacts WITH is her own catalyst-
      // driven emotion, not the gossip line about her — and that reaction
      // is what keeps traveling outward from her, the same way any other
      // emotion echo would. So the rumor effectively converts into a
      // forced emotion the moment it reaches its own subject, then rides
      // the ordinary emotion relay/distort machinery from there.
      // Branch added 9 Sep 2026: back when a rumor could only ever mean a
      // rejection, forced-anger was the only sensible reaction to
      // overhearing it about yourself. Now that an ACCEPTED Ask Out rumor
      // exists too, forcing anger on someone hearing their own happy news
      // would be backwards — that case forces love instead.
      const message = isRumorSubject(npc, incoming)
        ? ({ kind: "emotion", echo: incoming.kind === "rumor" && incoming.outcome === "accepted" ? "love" : "anger" } as HubMessage)
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

  // Player-Talk Conversation Lock, 7 Sep 2026 — Maxime, verbatim: "today I
  // said hello to one of my ant. it replied but it didnt stop it kept
  // walking fast in the direction it wanted." Root cause, verified against
  // this live file, not memory: the 6 Sep NPC Conversation Lock Fix
  // (NPC_ENGAGEMENT_HOLD_MS/HubNpc.engagedUntil/isNpcEngaged, see that
  // constant's own header above) only ever gets set by
  // runNpcEncounter/runAngerBlowup/runBoredomSpar — the three AMBIENT
  // ant-to-ant encounter functions. Every PLAYER-initiated exchange calls
  // showBubble() directly and never touched engagedUntil at all, so an ant
  // mid-route when the player catches it just kept walking to wherever it
  // was already headed while the reply bubble showed — bubbleUntil (set
  // inside showBubble, just below) only ever controlled how long the
  // speech-bubble graphic stays up, never anyone's feet.
  //
  // holdForPlayerTalk() reuses the exact same engagedUntil/
  // NPC_ENGAGEMENT_HOLD_MS/isNpcEngaged machinery already built and tested
  // for the ambient case — same 7.8s hold, kept identical on purpose
  // rather than inventing a second tuned number for player talk — plus the
  // one thing the ambient fix never had to handle: canceling a walk
  // already in progress. Ambient encounters only ever start between two
  // ants already standing still (updateNpcEncounters' own pairing guard),
  // so engagedUntil alone was enough there; the player can catch an ant
  // mid-stride, and updateNpcMovement (above) only ever checks whether
  // targetX is set, never engagedUntil — so without clearing the target
  // too, an already-walking ant would just finish that walk regardless.
  // Clearing targetX/targetY/path/stuckMs mirrors updateNpcMovement's own
  // genuine-arrival branch exactly. A mid-door-hop ant (travelTargetRoom
  // still set) isn't touched here and resumes its trip on its own once
  // engagedUntil lapses — updateNpcRoaming's existing journey-resume
  // branch (same recovery shape sendToMuster's cross-deck fix already
  // leans on) re-paths from wherever it actually stopped.
  //
  // Deliberately NOT wired into every showBubble() call — see this pass's
  // own build-log addendum for the exact call-site inventory and why
  // ambient/incidental ones (rumor propagation, muster acknowledgment,
  // breakdown onset, the ambient encounter trio) are excluded on purpose.
  private holdForPlayerTalk(npc: HubNpc) {
    const now = this.time.now;
    npc.engagedUntil = now + NPC_ENGAGEMENT_HOLD_MS;
    npc.targetX = undefined;
    npc.targetY = undefined;
    npc.path = undefined;
    npc.stuckMs = 0;
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
    npc.bubbleContainer.setVisible(this.sameDeck(npc.room, this.currentRoomId));
    // Comms log, Hub polish 26 Aug 2026 — same room-gate as the visibility
    // line just above, on purpose: rumor/propagate() can call showBubble
    // for an NPC in a room the player isn't even standing in (see
    // propagate()'s own header, "not proximity-gated"), and that bubble is
    // correctly invisible in-world for the same reason. The log is a
    // record of what the player could actually have seen/heard, not an
    // omniscient transcript — so it stays gated the same way.
    if (this.sameDeck(npc.room, this.currentRoomId)) this.logChatLine(npc.initials, line);

    const duration = Math.min(BUBBLE_DURATION_CAP_MS, 2600 + line.length * 30);
    npc.bubbleUntil = now + duration;
  }
}

function isRumorSubject(npc: HubNpc, message: HubMessage): boolean {
  if (message.kind !== "rumor") return false;
  return npc.displayName.split("—")[0].trim() === message.targetName;
}

// Visible Stage cue, 27 Aug 2026 (later pass) — Social Sim Roadmap #5: "a
// small badge or pip near a pilot's portrait... would give players who
// miss the one-time bubble a persistent way to notice," complementing
// rather than replacing §37's graduation reveal — the reveal is the
// moment, this is the lasting evidence. Plain English over a cryptic
// abbreviation, matching this file's existing "with X" style rather than
// inventing a new pip/icon convention. Not exported: this string is only
// ever consumed by favorabilityLabel just below. (The "(demo)" suffix
// favorabilityLabel used to append was stripped 1 Sep 2026, EA Launch
// Plan Week 1 hardening — this comment's own reference to it is now
// historical only.)
function stageBadge(stage: Stage): string {
  const label = stage === "green" ? "Green" : stage === "blooded" ? "Blooded" : "Command";
  return `[${label}]`;
}

// rival param added 27 Aug 2026 (Social Sim Roadmap #7) — same optional,
// append-if-present shape partner already used. A pilot can in principle
// have both at once (dating one NPC, clashing with a totally different
// one — two independent axes, relationships list vs. worst bond), so
// both tags render together rather than one taking priority.
// B2, 5 Sep 2026 — the numeric Favorability value no longer renders here.
// Maxime's ask, verbatim: "dont let the player see the fsvorability incrase
// decrase. they just see the number in the hangsr room panel." That number
// now lives only in the Hangar Deck's crew-records panel
// (scenes/ui/RosterPanel.ts), checked on purpose rather than ticking up and
// down in the corner of the screen while you walk past someone.
//
// What stays, per Maxime's own call on the plan doc's open question: the
// name, the Stage badge, and the ♥/⚡ relationship tags. Those are status —
// they change rarely and mean something at a glance — rather than a live
// counter, so hiding them would have cost real ambient readability for no
// gain against the actual ask. npc.favorability itself is untouched and
// still drives everything it always did; this is a display change only.
function favorabilityLabel(npc: HubNpc, partner?: string, rival?: string): string {
  let base = `${npc.displayName.split("—")[0].trim()}  ${stageBadge(npc.ambient.stage)}`;
  if (partner) base += `  ♥ ${partner}`;
  if (rival) base += `  ⚡ ${rival}`;
  return base;
}
