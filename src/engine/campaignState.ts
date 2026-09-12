// src/engine/campaignState.ts
// Build Brief step 11 (meta layer) / step 12's roster half — the campaign-
// persistence rules engine. Nothing under this heading existed in code
// before this pass: no localStorage, no debrief/shop scene, no mutable
// "who's alive, what tier, how many spare parts" layer sitting on top of
// the static PilotRecord/MekArchetype rows in data/meks.ts and
// data/campaignAmaranth.ts. This file is that layer — plain TypeScript,
// unit-testable without Phaser or a live Mission, meant to be called by a
// future debrief/hangar screen (not built this pass; see the design docs
// below for what that screen owns).
//
// The design this implements is worked out in full, with every direct
// quote, in the project's own docs — this file's comments summarize
// rather than re-derive it:
//   - claude/Bloom_Wars_Independent_Campaign_The_Amaranth_Reckoning.md
//     (the campaign doc's own "Recruit-phase mechanic" + permadeath +
//     deploy-gate sections)
//   - claude/Bloom_Wars_Spitball_Ideas.md ("Real permadeath, gated on the
//     Munti — the XCOM/canon reconciliation, RESOLVED, 22 Aug 2026" — the
//     full back-and-forth this rule came out of)
//   - claude/Bloom_Wars_Antfarm_Carrier_Hub_v1.md §6a (confirms this has
//     to work from Mission 1 onward, as "plain engine/data work with no
//     room fiction attached" — this file, in other words)
//
// Maxime's own words, the whole rule in one line: "if there a muntie there
// is restock. no munties no restock." Checked live, fresh, every time a
// unit is reduced to 0 HP — not a flag that trips once and stays tripped.
//
// ---- Design decision, flagged rather than hidden (matches this repo's
// own README convention): every CampaignPilotEntry below stores a full,
// campaign-owned COPY of a PilotRecord, not a pilotId that gets resolved
// back through data/pilotRegistry.ts at read time. This was a deliberate
// call, not the default: src/data is pure, hand-authored, build-time data
// (Build Brief §5.2 — the ESLint rule that restricts data/ to importing
// only ./types enforces exactly this), so a generated recruit (rules 6
// below) has nowhere to live in that layer — it only ever exists in the
// mutable campaign layer. Rather than having two different code paths
// (one for named pilots that resolves through pilotRegistry, one for
// generated pilots that doesn't), every pilot in a CampaignState — seeded
// from a static roster or freshly recruited — is stored the same way: a
// self-sufficient copy. Mutating pilot.tier here never touches the
// original PILOTS/WARDEN_PILOTS array objects.
//
// One honest gap this creates, left for whoever builds the debrief/hangar
// screen: engine/units.ts's createPlayerUnit() still resolves pilots
// through data/pilotRegistry.ts's static findPilot(), which has no way to
// see a CampaignState's generated recruits. Deploying a generated recruit
// into an actual Mission isn't wired up this pass (no squad-selection UI
// exists to do it from either) — the fix is straightforward when that
// screen gets built (extend pilotRegistry's lookup to also check the
// active CampaignState, or have Mission accept resolved PilotRecords
// directly instead of ids) but is out of scope here.
import type { CampaignMission, MekArchetype, MekTrack, Path, PilotRecord } from "../data/types";
import type { Stage } from "../data/ambientLines";
import { UNIT_ARCHETYPES } from "../data/units";
import { rollBackground } from "../data/background";
import { generateCallsign, generateMekName, generateRecruitName, randomFrom } from "../data/names";
import { WARDEN_PILOTS, WARDEN_MEKS, SECOND_LANCE_PILOTS, SECOND_LANCE_MEKS, THIRD_LANCE_PILOTS, THIRD_LANCE_MEKS } from "../data/campaignAmaranth";
// House Amaranth — Mission Select + roster-seeding pass, 1 Sep 2026.
import {
  HOUSE_AMARANTH_PILOTS,
  HOUSE_AMARANTH_MEKS,
  HOUSE_AMARANTH_SECOND_LANCE_PILOTS,
  HOUSE_AMARANTH_SECOND_LANCE_MEKS,
  HOUSE_AMARANTH_THIRD_LANCE_PILOTS,
  HOUSE_AMARANTH_THIRD_LANCE_MEKS,
} from "../data/campaignHouseAmaranth";
import { findPilot } from "../data/pilotRegistry";
import type { SocialLogEntry } from "../data/verbs";
import type { HotTopic } from "../data/hotTopics";
import type { MemoryEntry } from "../data/memories";
import type { EchoWeights } from "../data/echoLean";
import type { CarrierModuleId } from "../data/carrierModules";
import type { HeirloomCampaignState } from "./heirlooms";
import type { BattleUnit, OnHitEffectKind } from "./units";
import type { RecRoomState } from "./recRoomRecord";
// Value import, not type-only: applyMissionLosses below stamps the calendar
// day a pilot was lost on. calendarClock.ts imports CampaignState from this
// file TYPE-ONLY, so this is not a runtime cycle.
import { currentDay } from "./calendarClock";

// ---- 4. Campaign-persistent roster state ----------------------------

// "reassigned" added 2 Sep 2026 — the Insult-system Tier-3 resolution
// (Praise/Insult/Apology Proposal §3a, resolved by Maxime as "wont fly with
// you, player will have to ask co to remove them from ship"). Distinct from
// permanently_lost: the pilot is alive and fine, just off THIS ship, and it
// only ever gets set by a deliberate CO conversation (scenes/Hub.ts's
// handleRemovePilotRequest), never automatically. Full-repo audit (2 Sep
// 2026) confirmed every existing status check is either `=== "active"`
// (safely excludes this new value) or an exact `=== "permanently_lost"`
// match — adding this third value can't silently break anything already
// built, including TransporterPad.ts's own roster filter (which also gets
// its own explicit `refusesDeployment` check alongside this, see
// HubPilotSocialState below — belt and suspenders: this status blocks
// deployment permanently, the flag blocks it the instant Tier 3 is hit,
// before the player's even talked to the CO).
//
// "discharged" added 5 Sep 2026 — Pilot Discharge & Roster Pressure
// (claude/Bloom_Wars_Pilot_Discharge_And_Roster_Pressure_Proposal_v1.md,
// shape decided 28 Aug 2026 per Maxime's own delegation). Deliberately its
// OWN value rather than reusing "reassigned", even though both currently
// read almost identically to every system that only checks `!== "active"`:
// "reassigned" is a forced departure the CO resolves after an Insult
// standoff; "discharged" is the player's own administrative choice, issued
// directly from the shop, with no conversation at all. Keeping the two
// distinguishable costs nothing today and matters the moment either gets
// its own memorial copy, its own narrative beat (the proposal's own §3
// flags "a real, bigger beat" for discharge as designed-but-not-built), or
// a House Amaranth reserve-pool reuse path that should only ever apply to
// one of the two. Same safety argument as "reassigned"'s own addition:
// every existing status check in this repo is either `=== "active"`
// (safely excludes this too) or an exact `=== "permanently_lost"` match —
// a fourth value can't silently break anything already built.
export type PilotStatus = "active" | "permanently_lost" | "reassigned" | "discharged";

// Campaign economy pass (22 Aug 2026, engine/campaignEconomy.ts — see that
// file's own header for the two-pool design this and CampaignState.points
// both belong to): 2nd Lt. Dessa Rourke's rank, per
// claude/Bloom_Wars_Independent_Campaign_The_Amaranth_Reckoning.md §10's
// squad-scaling table ("2nd Lt. -> Capt." across Act I, "-> Maj." from Act
// II). Only Rourke — the CO — has a rank at all in this game, so this is
// deliberately a three-value union rather than a generic rank system.
export type Rank = "2nd_lt" | "capt" | "maj";

// Social Sim Roadmap #5's own note on rourkeRank, 27 Aug 2026 (later
// pass): a small "Capt. Rourke"/"Maj. Rourke" readout in the Hub UI needs
// a display string for a Rank value — WARDEN_PILOTS' own
// `displayName: "2nd Lt. Dessa Rourke — ..."` bakes her STARTING rank in
// as a static string (campaignAmaranth.ts), which is exactly why
// Hub.ts's buildPlayer() already has its own note about not trusting that
// string for anything rank-related once it can actually change. This is
// the live counterpart — pure, testable, no Phaser — used by Hub.ts to
// build the readout off the real, current rourkeRank instead.
export function rankDisplayTitle(rank: Rank): string {
  return rank === "2nd_lt" ? "2nd Lt." : rank === "capt" ? "Capt." : "Maj.";
}

// Antfarm build economy, first slice, 27 Aug 2026 — the four reserved-bay
// markers Hub.ts placed in the egg-hull pass (Sensor Array + Beacon
// Control on Upper, Generator + Restock Room on Lower — see that pass's
// own RESERVED_BAYS) are becoming real, buildable rooms rather than
// staying visual-only. The id union lives here rather than in Hub.ts
// because it's now also persisted campaign state (CampaignState.builtBays,
// below) — an engine-layer concern, not a scene-layer one — with Hub.ts
// importing this type rather than owning a second copy of it.
//
// weaponsBay/fabricator added 28 Aug 2026, second slice — the first bay
// pair to actually DO something once built rather than just redraw solid
// (see engine/mission.ts's fireSupportBonusReadyTurn for Weapons Bay,
// engine/campaignEconomy.ts's fabricatorMaxSpareParts for Fabricator). The
// original four stay purely cosmetic markers for now — deliberately not in
// scope for this pass, flagged separately rather than silently expanded.
export type ReservedBayId = "sensorArray" | "beaconControl" | "generator" | "restockRoom" | "weaponsBay" | "fabricator";

/**
 * How a permanent loss actually happened, stamped once onto the lost
 * pilot's own entry at Debrief and never touched again.
 *
 * Deliberately the one place in this file that stores rather than derives.
 * The Mek-retirement comment in applyPermadeathCheck below argues the usual
 * rule — never mirror a fact the roster can be asked for — and that rule is
 * about facts whose source outlives the question. This one's source is a
 * Mission object that ceases to exist at the end of the debrief that writes
 * this. Ask an hour later and there is nobody left to ask.
 *
 * Written by scenes/Debrief.ts (step 1b), from engine/mission.ts's own
 * PermanentLossRecord plus the mission outcome, which only Debrief knows.
 * Optional because every entry written before this existed has none, and
 * because a pilot who is still alive should not carry an empty shape for a
 * thing that hasn't happened to them.
 */
export interface PilotLossContext {
  /** The mission they were lost on. */
  missionId: string;
  /**
   * What the company got for it. commander_down never reaches here (that
   * outcome voids the attempt outright and never runs a debrief), so this
   * is only ever the ordinary win/loss axis.
   */
  outcome: "win" | "loss";
  /** Mission turn they went down on. */
  turn: number;
  /** Turns the squad had been operating with no living Munti when they fell. */
  turnsWithoutMunti: number;
  /** Munti-path pilots the squad launched with. 1 is legal, and thin. */
  muntisDeployed: number;
  /** They were themselves the last Munti. */
  wasLastMunti: boolean;
  /**
   * The calendar day they were lost on. Added 3 Sep 2026 for the Rec Room
   * standings board, which keeps a dead pilot's row and wants to say when
   * they were lost beside it — that date existed nowhere in the save until
   * now (this context recorded the mission and the turn, not the day).
   *
   * Optional because every save written before this field existed has
   * none. A missing value reads as "we no longer know which day," and the
   * board says nothing rather than guessing — see StandingsPanel.
   */
  lostOnDay?: number;
}

export interface CampaignPilotEntry {
  pilot: PilotRecord; // a campaign-owned copy — pilot.tier is this pilot's live, campaign-persistent gear tier (rule 4: "an active pilot's tier can change between missions via existing gear-tier-purchase logic")
  status: PilotStatus;
  // Campaign economy pass (engine/campaignEconomy.ts): this pilot's own
  // points balance — earned individually per mission
  // (computeMissionEarnings) and spent only on that same pilot's own
  // gear-tier upgrades and mek secondary purchases (purchaseTierUpgrade /
  // purchaseMekSecondary). Never pooled with any other pilot's balance,
  // and never transferred anywhere if this pilot is later permanently
  // lost — see applyPermadeathCheck below. Distinct from
  // CampaignState.points, which is the company-wide shared pool.
  personalPoints: number;
  // Hub social state (Antfarm) — section 11 below. Optional because every
  // CampaignPilotEntry created before 26 Aug 2026's persistence pass (and
  // every generated recruit, who has never set foot in the Hub) has none;
  // ensureHubSocialState() is the only thing that ever creates one, lazily,
  // the first time Hub.ts actually asks for a given pilot's social state.
  social?: HubPilotSocialState;
  // Mek NPC Introduction Plan v1 §4, 29 Aug 2026 — "if their Matchset bond
  // with their pilot produced a child, the kid leaves with them." Pure
  // scaffolding: no "have a child" system exists anywhere in this game yet
  // (no event, no verb, no UI touches this), so nothing can actually set
  // this true today. It exists so scenes/Hub.ts's checkMekRetirement() has
  // a real field to branch its departure flavor text on the moment such a
  // system does exist, instead of that later system needing to invent a
  // place to put the flag AND retrofit the retirement text to read it.
  hasChildWithMek?: boolean;
  // B2, assignable lances (5 Sep 2026, Maxime's call: "real assignable
  // lances", over the cheaper static-batch reading the Hangar Roster plan
  // doc originally recommended). The lance this pilot has been MOVED to, if
  // the player has ever moved them. Absent means "wherever they arrived" —
  // see lanceOfPilotIn() below, which falls back to the static arrival
  // batches (lanceOfPilot) whenever this is unset.
  //
  // Stored as an override rather than written eagerly onto every pilot so
  // that (a) every save written before today keeps behaving exactly as it
  // always has with no migration step, and (b) a pilot the player has never
  // touched still follows their arrival batch even if that batch's
  // membership is ever edited in data. Nothing else in the codebase needs
  // to know this field exists — lanceOfPilotIn is the single read path.
  lance?: LanceId;
  // Set once, at the debrief that turns this pilot's status to
  // permanently_lost, and never updated after — see PilotLossContext above
  // for why this is stored rather than derived. Absent on every living
  // pilot, on every pilot lost before this field existed, and on any status
  // flip that doesn't come through Debrief (applyPermadeathCheck's own
  // mutation half, which has no Mission to read).
  lostContext?: PilotLossContext;
}

export interface CampaignState {
  // COMPANY pool as of the campaign economy pass (22 Aug 2026,
  // engine/campaignEconomy.ts): this field predates that pass and was
  // ambiguously "the shared pot" before it; now explicitly company-level
  // money (logistics, recruiting), never a stand-in for any one pilot's
  // own personalPoints (CampaignPilotEntry.personalPoints above). Fed by
  // computeMissionCompletionBonus + the Rourke CO bonus; spent on
  // discretionary recruiting (recruitDiscretionary, below — unchanged by
  // this pass) and purchaseSpareParts (engine/campaignEconomy.ts, new
  // this pass).
  points: number;
  pilots: Record<string, CampaignPilotEntry>; // keyed by pilot id
  // Mutable, campaign-persistent copies of MekArchetype rows. Moved off
  // the static data (data/meks.ts / data/campaignAmaranth.ts's
  // MekArchetype.spareParts) rather than left there, per rule 4's own
  // framing: "spare parts are explicitly campaign-persistent... decide
  // whether that needs to move into the mutable campaign state layer."
  // Decision: yes, move it. The static row is a *template* ("this mek
  // starts a fresh campaign with 2 Fabricator parts"); once the (not yet
  // built) Fabricator system starts spending parts mid-mission, the
  // *current* count has to live somewhere that can go down and stay down
  // across missions — a static data/ constant can't represent "current
  // remaining," only "starting value." Keeping MekArchetype in data/
  // meaning only ever the starting/template value, same as how
  // PilotRecord.tier in the static files always reads "G" (everyone's
  // starting tier) while CampaignPilotEntry.pilot.tier is the live number.
  meks: Record<string, MekArchetype>; // keyed by mek id
  // Monotonic counter, used to mint unique ids/callsigns for generated
  // recruits (rule 6). Never decremented, never reused.
  nextGeneratedId: number;
  // Campaign economy pass: Rourke's rank (see the Rank type comment
  // above). Only the data field and the CO-bonus lookup
  // (engine/campaignEconomy.ts's CO_BONUS_BY_RANK) are built this pass —
  // no automatic rank-up trigger tied to actual mission-completion counts
  // (out of scope per this pass's brief; §10's table ties it to specific
  // missions — 12, 24 — which a future debrief/campaign-progress screen
  // would call a setter for). Defaults to "2nd_lt", her Act I start rank,
  // for every CampaignState this file creates — including synthetic test
  // rosters that don't even include pilot_rourke, since the field always
  // exists regardless of roster contents (same reasoning as `points`
  // defaulting to 0 rather than being conditionally present).
  rourkeRank: Rank;
  // Mission real-time clock (25 Aug 2026 — see "9. Mission real-time
  // clock" below for the full mechanism). Set by scenes/TransporterPad.ts
  // the instant BEAM DOWN fires, cleared by scenes/Debrief.ts the instant
  // a mission actually resolves for real (win or loss), and read by
  // scenes/Boot.ts on every game load to catch the case where neither of
  // those happened — the tab was closed mid-mission and never came back.
  // Optional, not defaulted like rourkeRank/points above: "no active
  // attempt" is this field's normal resting state for most of a campaign,
  // not an edge case to paper over.
  activeMissionAttempt?: ActiveMissionAttempt;
  // Antfarm build economy, first slice, 27 Aug 2026 — which of the four
  // reserved bays the player has actually had the CO build. Optional and
  // read as `?? []` everywhere, same pattern as npcSocial/social below: a
  // save from before this pass has none, and that's identical in meaning
  // to an empty array, so no migration/backfill step is needed the way
  // rourkeRank's backfillRourkeRank had to be for a field whose absence
  // meant something different from its default.
  builtBays?: ReservedBayId[];
  // Carrier Upgrade Modules, 2 Sep 2026 — the Workshop's own purchases
  // (data/carrierModules.ts). Deliberately a SEPARATE list from builtBays
  // above rather than more ReservedBayIds: a bay is a physical space on
  // the Antfarm grid with a rank-gated slot budget (RANK_BAY_SLOTS), a
  // module is a company-pool upgrade with no slot cost, and the source
  // design prices and gates them differently. Same `?? []` optional shape
  // and same no-migration-needed reasoning as builtBays.
  builtModules?: CarrierModuleId[];
  // Heirlooms, 2 Sep 2026 — recruited aristocrats, which one is fielded,
  // and paid-for ability ranks. See engine/heirlooms.ts for the rules and
  // data/heirlooms.ts for the pool itself. Same optional/`?? default`
  // shape as builtBays and builtModules above, for the same reason: an
  // older save simply has none, which means exactly "nothing recruited."
  heirlooms?: HeirloomCampaignState;
  // Mission-order gating (12 Sep 2026, Maxime: "make the mission in the
  // campaign gated on completing the previous mission 1st") — which mission
  // ids this save has actually WON, ever, on any side. Deliberately
  // `undefined` rather than `{}` for every save that existed before this
  // field did: `loadCampaignState` never backfills it (contrast with
  // `builtBays`/`builtModules`/`heirlooms` above, which read fine as "empty"
  // either way) because there is no honest empty value here — an existing
  // save already has real progress this field was never around to record,
  // and guessing at it (from `lancesGranted`, say) would either lock a
  // mission that save could open yesterday or leave the guess permanently
  // wrong. `undefined` is read as "grandfathered — gate doesn't apply to
  // this save" by isMissionUnlocked() below, forever, not just until its
  // next win; only createCampaignState (brand-new campaigns, from now on)
  // ever sets this to `{}`, and recordMissionWin() below refuses to
  // initialize it retroactively for exactly the reason just given. See
  // isMissionUnlocked/recordMissionWin's own comments, and
  // data/allCampaigns.ts's WARDEN_MISSION_CHAIN/HOUSE_AMARANTH_MISSION_CHAIN
  // for the actual 36-mission-per-side ordering this gates against.
  completedMissionIds?: Record<string, true>;
  /**
   * seal_borrowed_authority (Simulacrum/The Stolen Seal, Vault Phase 2 slice
   * 6, 3 Sep 2026) — which on-hit-effect KINDS (OnHitEffectKind,
   * engine/units.ts — not which archetypes; see recordFoughtOnHitEffectKinds'
   * own comment for why kind rather than archetype id was the chosen
   * granularity) the player's squad has fought anywhere in this campaign so
   * far. "Fought" means a hostile carrying that kind appeared on the same
   * mission's own board, win or lose, kill or no kill — see
   * Mission.getFoughtOnHitEffectKindsThisMission()'s own comment for the
   * exact bar. Populated at Debrief (recordFoughtOnHitEffectKinds, below),
   * read once per mission at Mission construction
   * (MissionOptions.foughtOnHitEffectKinds) as an immutable snapshot for
   * that mission's own lifetime — same "campaign state doesn't change under
   * an in-progress mission" rule builtBays/builtModules above already
   * follow. Undefined/empty on every save from before this pass (needs no
   * migration, same `?? []` optional shape as every other array on this
   * interface) and on a fresh campaign that hasn't fought anything yet —
   * seal_borrowed_authority refuses cleanly in that case rather than
   * drawing from nothing (see sealBorrowedAuthority()'s own header).
   */
  foughtOnHitEffectKinds?: OnHitEffectKind[];
  // Vault dedication, 2 Sep 2026 (Mission 12 — "The Fallow Line," Act I's
  // finale) — Antfarm Carrier Hub §8 marks this scene "load-bearing, not
  // skippable," so it needs a permanent record the moment it resolves, not
  // just a live re-check. `fallenId` is the ONE piece of this that can't be
  // re-derived later and has to be stored, same exception `shortlist` above
  // already uses: CampaignPilotEntry.lostContext tells you SOMEONE died at
  // Mission 12, but the *pick* among multiple fallen candidates leans on
  // npcSocial.bonds (see engine/heirlooms.ts's resolveVaultDedication),
  // which keeps drifting after this scene resolves — re-deriving it on a
  // later Hub load could point the memorial at a different pilot than the
  // one actually named the day it happened. Undefined `fallenId` is a real,
  // distinct outcome (nobody fell at Mission 12 specifically — Gjallar
  // never changes hands this campaign), not "not yet resolved"; presence of
  // the whole `vaultDedication` object is what marks resolution done, same
  // one-shot-via-presence shape as `shortlist`. `seen` is a plain UI
  // acknowledgement flag with no derivable source, same class as
  // lastMissionEcho.announced below — starts false, flipped by Hub.ts
  // itself the moment the Vault overlay actually renders the dedication
  // panel, same "don't mark it seen before it's actually shown" discipline
  // ackRankGreeting already follows, not routed through an engine function
  // (matches markCoCheckedIn/ackRankGreeting, both plain Hub.ts writes).
  vaultDedication?: { fallenId?: string; seen: boolean };
  // Section 12 below (26 Aug 2026) — persistent NPC-to-NPC bonds and
  // pairing, for the background social-sim harness. Optional for the same
  // reason `social` on CampaignPilotEntry is: every save from before this
  // date, and every fresh createCampaignState() call, has none yet;
  // ensureNpcSocialState() is the only thing that ever creates it.
  npcSocial?: NpcSocialState;
  // Social state for Hub NPCs who are NOT on the roster — the ship's CO and
  // every Mek. Those have no CampaignPilotEntry to hang a `social` off, so
  // until 7 Sep 2026 ensureHubSocialState handed them a fresh throwaway
  // object every load: Hub.ts's persistNpcSocial dutifully mutated it and
  // called saveCampaignState, the save succeeded, and the change went
  // nowhere. Every drink with the CO and every point of favorability with a
  // Mek was lost on reload, silently, with no error anywhere.
  //
  // Same optional/lazy shape as npcSocial directly above: absent on every
  // save written before today, created on first write, so nothing needs
  // migrating. Keyed by the same pilotId the Hub's own NPC records use.
  npcSocialStates?: Record<string, HubPilotSocialState>;
  // Hot topics raised somewhere the Hub isn't, 12 Sep 2026 (Mission Chat
  // plan, Workstream 4). The Hub's hot topics are a scene-local list
  // (Hub.ts's this.hotTopics), rebuilt on every visit from one-shot flags
  // (muntiLossAnnounced, lastMissionEcho.announced, ...). Mission chat can
  // produce one from inside a Battle — an Insult reaching Tier 2 registers
  // the "insulted" topic exactly as it would aboard — with no Hub to push
  // into. This is the mailbox: Battle appends, the Hub drains it into its
  // live list on the next create() (drainPendingHotTopics) and clears it.
  // Same optional/lazy shape as the two fields above it: absent on every
  // older save, nothing to migrate. Also the natural landing spot for the
  // plan's flagged follow-up (what was said to a named human hostile,
  // surfaced post-mission as gossip) — not built, just already has a place.
  pendingHotTopics?: HotTopic[];
  // Rec Room Standings & NPC Learning, slice 2 (3 Sep 2026) — every
  // pilot's win/loss record at the three Rec Room minigames, plus the
  // player's own under PLAYER_RECORD_ID. Optional and lazily created by
  // ensureRecRoomState(), exactly the npcSocial pattern directly above,
  // so no save migration is needed for anything that predates it.
  //
  // Read engine/recRoomRecord.ts's closing comment before writing any
  // cleanup pass that touches this: entries for pilots who are no longer
  // on the roster are deliberate, not orphans.
  recRoom?: RecRoomState;
  // Debrief-side echo, 27 Aug 2026 (Social Sim Roadmap #9) — set by
  // scenes/Debrief.ts every time a mission resolves for real (win, loss, or
  // commander_down — see data/hotTopics.ts's own header for why
  // commander_down folds into "loss" here), OVERWRITTEN each time rather
  // than accumulated: this is "what just happened," not a history log,
  // matching the roadmap's own "a short real-time window right after
  // returning to the Hub" framing. Deliberately top-level on CampaignState,
  // not per-pilot the way muntiLossAnnounced above is — a mission outcome
  // isn't about any one pilot, so there's no single CampaignPilotEntry to
  // hang it off of (same reasoning section 12's own npcSocial already gives
  // for why NPC-to-NPC bonds live here instead of on one pilot's entry).
  // `announced` starts false every time this is set and flips true the
  // moment Hub.ts's buildNpcs() actually registers the hot topic for it —
  // same one-shot shape as muntiLossAnnounced, one level up.
  lastMissionEcho?: {
    missionId: string;
    outcome: "win" | "loss";
    announced: boolean;
  };
  // Main Menu / Save / Ironman UI Plan v1, §4/§6, 28 Aug 2026 — set once at
  // CampaignSetup, read everywhere that decides whether to show Save/Load
  // UI at all. createCampaignState below sets this true on every fresh
  // state (Ironman is the default/base experience per the Spitball doc's
  // own 25 Aug decision, not an opt-in extra); CampaignSetup.ts overwrites
  // it directly from the checkbox before the first save. Optional so an old
  // save from before this field existed still parses — loadCampaignState's
  // backfillIronman below treats a missing field as true, since "one
  // continuously-overwriting key, no manual saves" is the actual behavior
  // every such save has always had, not a feature it should quietly gain.
  ironman?: boolean;
  // B6, "name your company" (First Game Dev Feature Gap Report, 1 Sep 2026:
  // "Players name things they intend to lose") — built 5 Sep 2026. Set once
  // at CampaignSetup from a text field next to the Ironman checkbox, then
  // read anywhere the company's name is shown to the player rather than
  // hardcoded: TransporterPad's header today, the memorial header when B3
  // lands. Optional and backfilled (backfillCompanyName below) so every save
  // written before this field existed keeps the exact name it was always
  // displayed under, side-correct, instead of going blank.
  //
  // Deliberately NOT wired into ambient lines, though the gap report's own
  // B6 entry mentions a "{COMPANY} slot" — Claude, 5 Sep 2026: no such slot
  // exists. data/ambientLines.ts is ~96KB of literal strings with zero
  // template placeholders of any kind, so honoring that line would mean
  // designing and threading a substitution layer through the whole ambient
  // system, which is a system, not this field. Flagged for Maxime rather
  // than quietly built.
  companyName?: string;
  // B2 recruiting pass (5 Sep 2026, Maxime: "player should recruit their
  // lance teamate not have a team be creste for them"). How many lances this
  // carrier has been granted. Used to be derivable from roster membership —
  // a 2nd Lance existed because its five authored pilots were in the roster
  // — but lances 2 and 3 now arrive EMPTY for the player to fill, so an
  // empty lance would have read as "no lance at all". Stored instead.
  //
  // Optional and backfilled (backfillLancesGranted): a save from before this
  // existed gets its count derived from the batches actually in its roster,
  // so an in-progress Act III campaign keeps all three lances and everyone
  // in them, exactly as it was.
  lancesGranted?: number;
  // CO Check-In Gate Plan v1, 28 Aug 2026 — built 1 Sep 2026. Set true the
  // first time any real interaction (ordinary Talk, a build request, or
  // small talk) reaches Arangement of Content in the grotto — see Hub.ts's
  // markCoCheckedIn(). Once true, stays true for the rest of this save
  // (Maxime: "only once heavy nudge" — not a per-mission ritual). Optional,
  // defaults to falsy for every old save the same way every other flag on
  // this interface does; canLaunchMission below only starts enforcing this
  // once state.lastMissionEcho shows the save has actually had a debrief,
  // so a brand-new campaign's very first mission is never gated by it.
  hasCheckedInWithCo?: boolean;
  // Telemetry pass (1 Sep 2026, claude/Bloom_Wars_Player_Telemetry_Plan_v1.md
  // §3) — a random id minted once per campaign so every mission record in
  // the stats store (engine/statsStore.ts) can be tied back to one
  // playthrough, and so "attempt 3 of Mission 12" is countable across
  // retries. Purely a label — nothing in the game reads it for logic.
  // Optional so an older save still parses; loadCampaignState backfills
  // one on first load (backfillCampaignId below).
  campaignId?: string;
  // Crew-interaction brainstorm pass, 2 Sep 2026 — the first real slice of
  // giving the MC (player character) their own persisted state at all.
  // data/verbs.ts's own header and the Stress & Morale Trigger Proposal's
  // build notes both flagged the same gap: "the player character has no
  // walkable, ambient-tracked Stress/Morale state." This isn't the full
  // fix (no UI, nothing else reads it yet) — just enough real state for the
  // new CO grotto Confide interaction (Hub.ts's handleConfideRequest) to
  // actually mean something rather than being pure flavor. Optional,
  // defaults via socialActions.ts's MC_STRESS_DEFAULT the first time it's
  // read, same "absence means default, not zero" pattern every other
  // optional numeric field on this interface already uses.
  mcStress?: number;
  // Pre-mission Send-Off ritual, 2 Sep 2026 — records which pilot was most
  // recently sent off before a mission launch (scenes/Hub.ts's
  // sendOffNpc). Deliberately UNCONSUMED this pass: the real tactical
  // payoff (an in-Battle bonus for that pilot) needs a genuine tactical-
  // design conversation and a combat_sim.py tuning pass before it touches
  // live sim-tuned numbers, per this project's own standing rule on combat
  // math. This field exists now so that future pass has something real to
  // read rather than needing its own plumbing added later; the immediate,
  // real payoff this pass delivers (Favorability + Stress relief) is
  // applied directly in Hub.ts and doesn't need this field at all.
  preMissionSendOff?: { pilotId: string; grantedAt: number };
  // Calendar economy, 2 Sep 2026 (claude/Bloom_Wars_Calendar_Economy_Build_
  // Proposal_v2_RealTimeClock.md) — elapsed in-fiction campaign days. Maxime's
  // own model, and worth stating precisely because it overrides what
  // claude/Bloom_Wars_Calendar_System_v1.md originally locked: "time spent in
  // the hub and time spent on mission run on the same ckock... like a
  // inevitable day night cycle in wow. the calandar run when you play."
  // The original doc specified advancement "independent of real play speed" —
  // exactly backwards from what this field actually does now.
  //
  // A FLOAT, deliberately, not an integer day counter: the fractional
  // accumulation IS the mechanism (engine/calendarClock.ts adds
  // deltaMs / MS_PER_CALENDAR_DAY on every Hub/Battle update tick), so
  // truncating on write would round every tick to zero and the clock would
  // never move at all. Every DISPLAY floors it — see currentDay().
  //
  // Optional purely for save compatibility, same shape as campaignId above:
  // a save written before this pass has no field, and backfillCalendarDay
  // below heals it to day 1 on first load. Nothing should read this directly
  // anyway — calendarClock.ts's currentDay()/rawCalendarDay() own the
  // "absent means 1" default in one place.
  calendarDay?: number;
  // Beacon Control & Restock Room (claude/Bloom_Wars_Beacon_Restock_Economy_v1.md,
  // built 4 Sep 2026) — the crate/charge stockpile purchased at the
  // Fabricator (engine/campaignEconomy.ts's purchaseBeaconCrate/
  // purchaseBeaconCharge), drawn down mid-mission by engine/mission.ts's
  // useBeaconControl and read back into this state at Debrief
  // (applyBeaconStockConsumption). Optional, defaulting to 0 (NOT
  // BEACON_STARTING_CRATES/CHARGES below) at every read site — a save from
  // before this field existed gets none, same "absent means empty/zero"
  // convention every other optional field on this interface already
  // follows, deliberately NOT backfilled to the starting grant: that grant
  // is framed as "one-time, at campaign start" (source doc §7), and a
  // campaign already in progress already missed that moment, the same way
  // it would have missed any other one-time campaign-start bonus added
  // after it began. createCampaignState below is the only place that sets
  // these to a real starting value, for brand-new campaigns going forward.
  beaconCrates?: number;
  beaconCharges?: number;
  /**
   * Frame Systems Layer §7's salvage supply line (6 Sep 2026,
   * data/frameSystems.ts) — how many of each hostile archetype this company
   * has killed, campaign-wide, keyed by archetype id (data/bloom.ts's own
   * ids for Bloom; hostile mechs land here too, harmlessly, since Mission
   * counts every hostile kill in one table). Populated at Debrief
   * (recordHostileKills, below) from Mission.hostileKills — the "Mission
   * records the live fact, Debrief lands it on CampaignState" split every
   * other per-mission fact already follows — and read by
   * engine/campaignEconomy.ts's salvage gate. Counted on a loss as well as
   * a win: you cut salvage off what you killed, whatever happened after.
   *
   * Company-level on purpose, not per-pilot, so it survives permadeath
   * untouched (a dead pilot's kills still count — the doc's own "the
   * counter should start recording silently from day one and never be
   * told your first twenty missions didn't count" reasoning). Optional and
   * read as `?? {}` everywhere, same no-migration shape as builtBays: a
   * save from before this pass simply starts counting from its next
   * debrief. The doc's own worry — a mid-campaign player finding their
   * earlier kills uncounted — is real for every save that predates today,
   * and there is no honest way to reconstruct those; flagged rather than
   * faked with a backfill guess.
   */
  hostileKillsByArchetype?: Record<string, number>;
}

/**
 * Beacon Control's starting stockpile (source doc §7) — one-time, granted
 * at campaign creation only, never refilled at Act breaks. The source doc
 * scales this by the player's chosen AI-difficulty tier (Easy 5/5,
 * Moderate 2/2, Hard 0/0), reusing "the existing Easy/Moderate/Hard system
 * from the Player AI Difficulty Tiers build" — but that system
 * (src/sim/playerAi/) is the OFFLINE BATCH SIMULATOR's bot, used to
 * balance-test missions by having a bot play instead of a human
 * (src/sim/runBatch.ts's own --tier flag). It is not, and has never been, a
 * difficulty a real player picks anywhere in this game — grep-confirmed:
 * CampaignSetup.ts (the actual New Campaign screen) offers exactly two
 * choices, Warden/House Amaranth side and the Ironman checkbox, nothing
 * difficulty-shaped. Building a real player-facing difficulty picker to
 * make the source doc's table literally true would be a genuinely new
 * system, unplanned scope well beyond this pass — flagged to Maxime rather
 * than built silently. Until that exists (if it ever does), every campaign
 * gets this ONE flat starting stock instead: the Moderate row from that
 * table, since the source doc itself calls that one "an arbitrary midpoint,
 * not sim-checked" already, making it the least-committal number to
 * hardcode as a placeholder. If a real difficulty selector is ever added,
 * swapping this flat constant for a three-way lookup keyed off that
 * selection is the one place that change needs to happen.
 */
export const BEACON_STARTING_CRATES = 2;
export const BEACON_STARTING_CHARGES = 2;

/**
 * A random, meaningless id (1 Sep 2026, telemetry pass). crypto.randomUUID
 * where the platform has it (every modern browser, Node 19+), a
 * Math.random fallback otherwise — this is a label for grouping records,
 * not a security token, so the fallback's weaker randomness is fine.
 */
export function mintRandomId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** One in-flight mission attempt's real-world start time. `startedAt` is a `Date.now()` epoch-ms snapshot — deliberately real, wall-clock time, not a game-turn count (house rule #5 already covers in-mission turn pressure; this is a different axis entirely, "how long has Command been waiting on you," not "how many turns did the fight take"). */
export interface ActiveMissionAttempt {
  missionId: string;
  startedAt: number;
}

/**
 * Build a fresh CampaignState from a starting roster + mek set — a deep-ish
 * copy (each PilotRecord/MekArchetype shallow-cloned) so mutating the
 * campaign's copies never touches the static arrays in data/. Generic over
 * the roster on purpose (tests pass synthetic rosters); createWardenCampaignState
 * below is the real entry point for the one campaign this repo currently ships.
 */
export function createCampaignState(pilots: PilotRecord[], meks: Record<string, MekArchetype>, startingPoints = 0): CampaignState {
  // calendarDay: 1 — the calendar epoch is campaign start, not first-mission-
  // complete (Calendar Economy Proposal v2 §7). "Day 47 — Muster" only reads
  // right if real days have already elapsed before whatever Muster marks.
  const state: CampaignState = {
    points: startingPoints,
    pilots: {},
    meks: {},
    nextGeneratedId: 1,
    rourkeRank: "2nd_lt",
    ironman: true,
    campaignId: mintRandomId(),
    calendarDay: 1,
    beaconCrates: BEACON_STARTING_CRATES,
    beaconCharges: BEACON_STARTING_CHARGES,
    // Recruit Cap Rework (9 Sep 2026) bugfix: a fresh campaign must start
    // with an explicit lancesGranted=1, not undefined. Before this rework,
    // leaving it undefined was harmless — derivedLanceCount's roster-
    // membership fallback couldn't be fooled, because recruiting into
    // lances "b"/"c" was itself gated on the story beat. Now that
    // activeLanceIds opens "b"/"c"/"d" from Mission 1 regardless of the
    // beat, that same fallback would infer a higher lanceCount (and
    // therefore a higher deriveRourkeRank) purely from which authored
    // candidates got recruited — exactly the roster-size coupling Q1's
    // recommended default says NOT to have. Setting it explicitly here
    // keeps derivedLanceCount reserved for genuinely legacy saves (pre
    // 5 Sep 2026) loaded through backfillLancesGranted, never a fresh one.
    lancesGranted: 1,
    // Mission-order gating (12 Sep 2026) — every brand-new campaign from
    // here on tracks its own wins, starting from nothing. See
    // CampaignState.completedMissionIds' own comment for why this is the
    // ONLY place that ever sets this to `{}` rather than leaving it
    // `undefined` — a save from before this field existed must never pass
    // through here again, so it can't pick this up retroactively.
    completedMissionIds: {},
  };
  for (const p of pilots) state.pilots[p.id] = { pilot: { ...p }, status: "active", personalPoints: 0 };
  for (const [id, m] of Object.entries(meks)) state.meks[id] = { ...m };
  return state;
}

// B6 "name your company" (5 Sep 2026) — the two per-side defaults, and the
// longest name the UI will accept. Exported so CampaignSetup's text field
// seeds and validates against the same values these factories use, rather
// than a second copy of the strings that could drift from them.
//
// 24 characters is not arbitrary: TransporterPad's header renders as
// `TRANSPORTER PAD — ${name}` at 30px monospace centered on a 1074px-wide
// canvas, and that template plus a 24-char name is what still fits without
// running into the "< mission select" button at the top right. Longer names
// aren't rejected on load (an old save or a hand-edited one keeps whatever
// it has); the cap only applies to what the player can type in.
export const DEFAULT_WARDEN_COMPANY_NAME = "Warden Company";
export const DEFAULT_HOUSE_AMARANTH_COMPANY_NAME = "House Amaranth";
export const COMPANY_NAME_MAX_LENGTH = 24;

/**
 * The company name to actually show for `state` — B6's single read path, so
 * no scene has to repeat the undefined-check or guess a fallback. Falls back
 * to the same per-side default backfillCompanyName would have written, using
 * baseSceneKeyFor's own Rourke rule for which side this is, so a state that
 * somehow reaches a scene without passing through loadCampaignState (a fresh
 * createCampaignState in a test, say) still renders a correct name instead
 * of "undefined".
 */
export function companyNameOf(state: CampaignState): string {
  if (state.companyName && state.companyName.trim()) return state.companyName;
  return state.pilots["pilot_rourke"] ? DEFAULT_WARDEN_COMPANY_NAME : DEFAULT_HOUSE_AMARANTH_COMPANY_NAME;
}

/** The live campaign's actual starting state (Warden Company, data/campaignAmaranth.ts — the non-archived roster; data/campaign.ts's Team One slice is intentionally untouched by this whole pass). */
export function createWardenCampaignState(startingPoints = 0): CampaignState {
  const state = createCampaignState(WARDEN_PILOTS, WARDEN_MEKS, startingPoints);
  // B6 default (5 Sep 2026) — the name this side has always been shown under
  // everywhere in the UI. CampaignSetup overwrites it from its text field
  // before the first save, exactly the way it already does for `ironman`.
  state.companyName = DEFAULT_WARDEN_COMPANY_NAME;
  return state;
}

/**
 * House Amaranth's own starting state (1 Sep 2026, Mission Select +
 * roster-seeding pass) — mirrors createWardenCampaignState exactly, same
 * generic factory this file's own doc comment above already says was built
 * "on purpose" for a second roster. Deliberately reuses the shared
 * CampaignState shape/save system rather than a separate module: the
 * campaign plan doc (Bloom_Wars_House_Amaranth_Mission_Plan_v1.md §3d)
 * floated a fully separate state module as a possibility but explicitly
 * left it as an open question ("confirm before it's built") in the context
 * of the FULL Hub-integration build (isolating Hub.ts's own mutation
 * logic from a not-yet-built HubHouseAmaranth.ts) — a different, bigger
 * concern than this pass's actual scope. This function only creates a
 * CampaignState with House Amaranth's pilots/meks in it and saves/loads it
 * through the exact same STORAGE_KEY and manual-save-slot mechanism
 * Warden already uses, which is faction-agnostic under the hood (it just
 * serializes whatever CampaignState it's given). Practical consequence
 * worth knowing: Ironman mode still has exactly one active save at a time,
 * regardless of which side it's for — same behavior Warden alone already
 * had, not a new limitation this introduces. A player who wants a Warden
 * run AND a House Amaranth run going simultaneously needs Ironman off and
 * two manual save slots, same mechanism either side already uses for
 * multiple saves.
 *
 * Known simplification, flagged rather than silently accepted:
 * `rourkeRank` (and the CO bonus it drives, engine/campaignEconomy.ts's
 * computeCoBonus) stays at its "2nd_lt" default for a House Amaranth
 * campaign forever — integrateHouseAmaranthSecondLance below deliberately
 * does not touch it, since there is no Marrow-equivalent rank field or
 * promotion schedule designed yet, and inventing one wasn't part of what
 * this pass was asked to build. The field/bonus still works, it just never
 * increases for this side — a missing nice-to-have, not a bug.
 */
export function createHouseAmaranthCampaignState(startingPoints = 0): CampaignState {
  const state = createCampaignState(HOUSE_AMARANTH_PILOTS, HOUSE_AMARANTH_MEKS, startingPoints);
  state.companyName = DEFAULT_HOUSE_AMARANTH_COMPANY_NAME; // B6 default, see createWardenCampaignState's own note
  return state;
}

/**
 * Real gap found and fixed 1 Sep 2026, same wiring pass: every "return to
 * base" button in this codebase (scenes/MainMenu.ts's CONTINUE,
 * scenes/Debrief.ts's RETURN TO BASE, scenes/Boot.ts's recall notice) was
 * unconditionally `this.scene.start("Hub")` — harmless while Warden
 * Company was the only campaign a save could ever hold, but scenes/Hub.ts
 * is built entirely around WARDEN_PILOTS/SECOND_LANCE/THIRD_LANCE (its own
 * NPCs, rooms, ambient lines, the `rourkeRank` header). Handed a House
 * Amaranth CampaignState, it would try to resolve pilot ids it has no
 * record of at all — not a clean "wrong content," a real risk of missing
 * NPCs or a lookup that assumes pilot_rourke exists. House Amaranth has no
 * Hub of its own yet (Maxime, 1 Sep 2026: "ill do the hub some other
 * day"), so there's nowhere narratively appropriate to send it instead —
 * scenes/Hangar.ts (the roster-agnostic "CAMPAIGN SHOP" screen, already
 * built 25 Aug 2026 as Act I's own pre-Hub meta-screen) is the existing,
 * already-generic stand-in.
 *
 * Presence of `pilot_rourke` is the cheapest reliable signal for "this is
 * a Warden Company save" without adding a new field to CampaignState —
 * every Warden save has that pilot from creation and no other roster ever
 * will. Correctly (if incidentally) routes a Team One save the same way a
 * House Amaranth save gets routed, which is more correct than the old
 * unconditional behavior for that archived roster too, not a new special
 * case invented for House Amaranth specifically.
 */
// 6 Sep 2026, House Amaranth Hub build — a House Amaranth save now has a
// hub of its own (scenes/Hub.ts running the HOUSE_AMARANTH_FACILITY
// profile, registered as "HubHouseAmaranth" in main.ts), so the Hangar
// fallback above only applies to a save with NEITHER MC — the archived Team
// One roster. Same cheapest-reliable-signal idea, one more pilot id: every
// House Amaranth save has pilot_marrow from creation and no other roster
// ever will.
export function baseSceneKeyFor(state: CampaignState): "Hub" | "HubHouseAmaranth" | "Hangar" {
  if (state.pilots["pilot_rourke"]) return "Hub";
  if (state.pilots["pilot_marrow"]) return "HubHouseAmaranth";
  return "Hangar";
}

// ---- Save / load (Build Brief step 11: "campaign persistence across
// missions in localStorage" — basic save/load only, not over-built) -----

const STORAGE_KEY = "bloomwars_campaign_state_v1";

// A minimal Storage-shaped interface (matches window.localStorage's real
// shape) instead of importing the DOM lib.Storage type directly, so a test
// can hand in a plain in-memory object without needing jsdom — this repo
// has no DOM test environment configured (vitest defaults to Node), and
// `npm run sim` runs under plain Node too, where `localStorage` doesn't
// exist at all.
export interface CampaignStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Real localStorage when it exists (the browser build), the caller's injected storage (tests), or null (headless Node — npm run sim / npm test) — never throws either way. Exported 1 Sep 2026 so engine/statsStore.ts follows the exact same rule rather than a copy of it. */
export function resolveStorage(storage?: CampaignStorage): CampaignStorage | null {
  if (storage) return storage;
  if (typeof localStorage !== "undefined") return localStorage;
  return null;
}

/**
 * Basic save. A no-op (not an error) when no storage is available, e.g. the
 * headless sim harness. `key` defaults to the one live/continuing-state key
 * (STORAGE_KEY) — Main Menu / Save / Ironman UI Plan v1 §6's manual save
 * slots pass their own `bloomwars_manual_save_<n>_v1` key here instead, so
 * "Save As..." is a straight call to this same function with a different
 * key, not a second save mechanism. The three existing autosave call sites
 * (TransporterPad's BEAM DOWN, Debrief, the Hangar shop) are unaffected —
 * none of them pass a key, so they keep writing the live key exactly as
 * before this param existed.
 */
export function saveCampaignState(state: CampaignState, storage?: CampaignStorage, key: string = STORAGE_KEY): void {
  const s = resolveStorage(storage);
  if (!s) return;
  s.setItem(key, JSON.stringify(state));
}

/**
 * Basic load. Returns null on no storage, no saved value, or a value that
 * fails to parse (a corrupt/foreign localStorage entry should read as "no
 * save," not crash the game). 27 Aug 2026: also runs backfillRourkeRank
 * (section 8a below) on the way out — a pure in-memory correction, not an
 * extra write to storage — so every scene's normal load path self-heals a
 * save whose rourkeRank never got updated by an older build. 28 Aug 2026:
 * same treatment for `ironman` (backfillIronman, immediately below) — a
 * save from before that field existed self-heals to `ironman: true` the
 * moment it's next loaded, matching the actual behavior it's always had.
 * `key` — see saveCampaignState's own comment; LoadGame.ts reads a manual
 * slot by passing that slot's key here instead of the default live one.
 */
export function loadCampaignState(storage?: CampaignStorage, key: string = STORAGE_KEY): CampaignState | null {
  const s = resolveStorage(storage);
  if (!s) return null;
  const raw = s.getItem(key);
  if (!raw) return null;
  try {
    const state = JSON.parse(raw) as CampaignState;
    backfillRourkeRank(state);
    backfillIronman(state);
    backfillCampaignId(state);
    backfillCompanyName(state);
    backfillLancesGranted(state);
    backfillCalendarDay(state);
    return state;
  } catch {
    return null;
  }
}

/** See saveCampaignState's own comment on `key`. */
export function clearCampaignState(storage?: CampaignStorage, key: string = STORAGE_KEY): void {
  const s = resolveStorage(storage);
  if (!s) return;
  s.removeItem(key);
}

/**
 * Manual save-slot keys (Main Menu / Save / Ironman UI Plan v1 §6) —
 * `bloomwars_manual_save_<n>_v1`, n from 0 to MANUAL_SAVE_SLOT_COUNT - 1.
 * 3 slots to start, per that doc's own "3-5 is a reasonable start, easy to
 * raise later" — raising this constant is the entire cost of adding a slot,
 * nothing about the key-override plumbing above needs to change with it.
 */
export const MANUAL_SAVE_SLOT_COUNT = 3;
export function manualSaveSlotKey(slot: number): string {
  return `bloomwars_manual_save_${slot}_v1`;
}

/**
 * A slot's own display metadata — captured at "Save As..." time, kept
 * separately from the slot's actual CampaignState JSON (under its own key,
 * `bloomwars_manual_save_meta_v1`) rather than wrapping the state itself.
 * Keeping the slot's stored JSON a bare CampaignState (identical in shape
 * to the live key) means loadManualSlot below is just loadCampaignState
 * with a different key — no separate parse path, no risk of this UI-only
 * metadata ever leaking into a real CampaignState a mission/sim harness
 * reads. LoadGame.ts (§7) is this record's only real reader.
 */
export interface ManualSaveSlotMeta {
  slot: number;
  savedAt: number; // Date.now() epoch-ms, when "Save As..." was pressed
  rosterSize: number; // active (non-permanently_lost) pilot count at save time
  rourkeRank: Rank;
}

const MANUAL_SAVE_META_KEY = "bloomwars_manual_save_meta_v1";

function loadManualSaveMeta(storage?: CampaignStorage): Record<number, ManualSaveSlotMeta> {
  const s = resolveStorage(storage);
  if (!s) return {};
  const raw = s.getItem(MANUAL_SAVE_META_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<number, ManualSaveSlotMeta>;
  } catch {
    return {};
  }
}

function saveManualSaveMeta(meta: Record<number, ManualSaveSlotMeta>, storage?: CampaignStorage): void {
  const s = resolveStorage(storage);
  if (!s) return;
  s.setItem(MANUAL_SAVE_META_KEY, JSON.stringify(meta));
}

/** Writes a manual save slot: the state itself (same round-trip machinery the live key uses, just keyed to this slot) plus its metadata record. This is the entire implementation of "Save As..." (§6/§7) — Hangar.ts and Debrief.ts's own buttons call this directly. */
export function saveManualSlot(slot: number, state: CampaignState, storage?: CampaignStorage): void {
  saveCampaignState(state, storage, manualSaveSlotKey(slot));
  const meta = loadManualSaveMeta(storage);
  meta[slot] = {
    slot,
    savedAt: Date.now(),
    rosterSize: Object.values(state.pilots).filter((p) => p.status === "active").length,
    rourkeRank: state.rourkeRank,
  };
  saveManualSaveMeta(meta, storage);
}

/** One entry per slot, 0 to MANUAL_SAVE_SLOT_COUNT - 1, null for an empty slot — LoadGame.ts's own list, in slot order. */
export function listManualSlots(storage?: CampaignStorage): (ManualSaveSlotMeta | null)[] {
  const meta = loadManualSaveMeta(storage);
  const out: (ManualSaveSlotMeta | null)[] = [];
  for (let i = 0; i < MANUAL_SAVE_SLOT_COUNT; i++) out.push(meta[i] ?? null);
  return out;
}

/** Loading a slot per §6's own "rewind" semantics — the caller is responsible for then writing the result back onto the live key (saveCampaignState(loaded, storage)) so it becomes the new continuing save; this function only reads the slot, it doesn't touch the live key itself. */
export function loadManualSlot(slot: number, storage?: CampaignStorage): CampaignState | null {
  return loadCampaignState(storage, manualSaveSlotKey(slot));
}

export function clearManualSlot(slot: number, storage?: CampaignStorage): void {
  clearCampaignState(storage, manualSaveSlotKey(slot));
  const meta = loadManualSaveMeta(storage);
  delete meta[slot];
  saveManualSaveMeta(meta, storage);
}

// ---- Mission 1 tutorial hints — a tiny flag OUTSIDE CampaignState -------
// (`Bloom_Wars_Onboarding_Tutorial_Plan_v1.md` §3/§5/§6, built 27 Aug 2026.
// Its own §5 open question — "shown every fresh campaign restart" vs.
// "shown once ever, tracked per save" — was left as "a real, small
// decision either way works for"; Maxime didn't pick either explicitly, so
// this defaults to the lowest-friction convention most games use: once
// ever, per browser, not tied to any one campaign save at all. Deliberately
// its own key rather than a new CampaignState field — the plan's own §6
// sizing note calls out "no new persisted data" as part of why this stays
// small, and a flag that outlives `clearCampaignState()` (a fresh campaign
// shouldn't re-teach a player who already knows the loop) only works if
// it's genuinely separate storage, not a field that gets wiped along with
// everything else on a New Game.
const TUTORIAL_SEEN_KEY = "bloomwars_tutorial_seen_v1";

/** True once the Mission 1 hint sequence has ever been shown to completion on this browser. False (never true-by-accident) on no storage, e.g. the headless sim harness — it has no UI to hint at in the first place. */
export function hasSeenTutorial(storage?: CampaignStorage): boolean {
  const s = resolveStorage(storage);
  if (!s) return false;
  return s.getItem(TUTORIAL_SEEN_KEY) === "1";
}

/** Marks the hint sequence seen. A no-op (not an error) when no storage is available, same contract as saveCampaignState. */
export function markTutorialSeen(storage?: CampaignStorage): void {
  const s = resolveStorage(storage);
  if (!s) return;
  s.setItem(TUTORIAL_SEEN_KEY, "1");
}

/**
 * Reverses markTutorialSeen — Options screen's "reset tutorial hints"
 * toggle (Main Menu / Save / Ironman UI Plan v1 §7), 28 Aug 2026. Same
 * no-op-on-no-storage contract as its two siblings above; removeItem on an
 * already-clear key is also a safe no-op (CampaignStorage's own contract),
 * so this never needs to check hasSeenTutorial first.
 */
export function resetTutorialSeen(storage?: CampaignStorage): void {
  const s = resolveStorage(storage);
  if (!s) return;
  s.removeItem(TUTORIAL_SEEN_KEY);
}

// Tutorial hints ON/OFF switch — Options screen, 8 Sep 2026 (Maxime's own
// call, put to him directly in a popup: a simple hint toggle rather than a
// bigger XCOM-style separate tutorial mission). Deliberately its own key,
// same shape as TUTORIAL_SEEN_KEY above and for the same reason: this is a
// standing browser preference ("don't ever show me these"), not campaign
// state, so it must survive a New Game the same way the seen-flag does.
// Absent key reads as enabled (true) — an existing player who's never
// touched this control keeps today's behavior exactly as shipped; only an
// explicit OFF click changes anything.
const TUTORIAL_HINTS_ENABLED_KEY = "bloomwars_tutorial_hints_enabled_v1";

/** True unless the player has explicitly turned tutorial hints off in Options. Also true (never false-by-accident) on no storage — same contract as hasSeenTutorial. */
export function areTutorialHintsEnabled(storage?: CampaignStorage): boolean {
  const s = resolveStorage(storage);
  if (!s) return true;
  return s.getItem(TUTORIAL_HINTS_ENABLED_KEY) !== "0";
}

/** Sets the tutorial-hints preference. A no-op when no storage is available, same contract as its siblings above. */
export function setTutorialHintsEnabled(enabled: boolean, storage?: CampaignStorage): void {
  const s = resolveStorage(storage);
  if (!s) return;
  s.setItem(TUTORIAL_HINTS_ENABLED_KEY, enabled ? "1" : "0");
}

// Hub hints & orientation — own key, survives New Game, same reasoning as
// TUTORIAL_SEEN_KEY above (`Bloom_Wars_Hub_Hints_And_Orientation_Scoping_v1_
// 11Sep2026.md`, built 11 Sep 2026). Maxime's own answers to that doc's §3:
// shape = a contextual sequence (each hint fires on ITS OWN real first-time
// trigger — first Roster & Gear visit, first NPC talk, first Vault/Archive
// visit, first Rec Room game, first deploy — not a forced walkthrough
// order), coverage = everything in that doc's §1 list plus Vault/Archive/
// Rec Room, and it shares TUTORIAL_HINTS_ENABLED_KEY's own switch above
// rather than a second toggle (Hub.ts's showHubHint() reads
// areTutorialHintsEnabled() directly before ever calling markHubHintSeen
// below).
//
// One id-keyed set rather than six copies of the hasSeenTutorial/
// markTutorialSeen pair above: each hint is independent and can fire in
// whatever order the player actually visits these six things, so "which
// ids have already fired" is both the more honest data shape (nothing here
// is actually sequential) and a lot less copy-pasted boilerplate than six
// near-identical booleans would be.
export type HubHintId = "roster" | "crew_talk" | "vault" | "archive" | "rec_room" | "bay";

const HUB_HINTS_SEEN_KEY = "bloomwars_hub_hints_seen_v1";

function loadHubHintsSeen(storage?: CampaignStorage): Set<HubHintId> {
  const s = resolveStorage(storage);
  if (!s) return new Set();
  const raw = s.getItem(HUB_HINTS_SEEN_KEY);
  if (!raw) return new Set();
  try {
    return new Set(JSON.parse(raw) as HubHintId[]);
  } catch {
    return new Set();
  }
}

/** True once this specific Hub hint has ever fired to completion on this browser. False (never true-by-accident) on no storage — same contract as hasSeenTutorial. */
export function hasSeenHubHint(id: HubHintId, storage?: CampaignStorage): boolean {
  return loadHubHintsSeen(storage).has(id);
}

/** Marks one Hub hint fired so it never shows again. A no-op when no storage is available, same contract as markTutorialSeen. */
export function markHubHintSeen(id: HubHintId, storage?: CampaignStorage): void {
  const s = resolveStorage(storage);
  if (!s) return;
  const seen = loadHubHintsSeen(storage);
  seen.add(id);
  s.setItem(HUB_HINTS_SEEN_KEY, JSON.stringify([...seen]));
}

/** RESET TUTORIAL HINTS (Options.ts) calls this alongside resetTutorialSeen() — one button, read by its own label as "reset every tutorial hint," clears both rather than leaving Hub hints half-reset behind it. */
export function resetHubHintsSeen(storage?: CampaignStorage): void {
  const s = resolveStorage(storage);
  if (!s) return;
  s.removeItem(HUB_HINTS_SEEN_KEY);
}

// ---- 1 & 3. Live Munti-gated restock/permadeath check ------------------

export interface PermadeathCheckResult {
  permanent: boolean;
  reason: string;
}

/**
 * The permadeath rule, evaluated fresh at the exact moment a unit is
 * downed — not a flag latched for the rest of the mission. Call this
 * from wherever a unit is actually reduced to 0 HP (see
 * Mission.handleDowned() in mission.ts, the one live call site).
 *
 * `sameSideUnits` should be every unit currently on `downedUnit`'s side,
 * downed or not, at this exact instant. This function does its own
 * "alive, not the unit currently going down" filtering — it does not
 * trust the caller to have already excluded downedUnit — because the
 * ordering nuance matters: a Munti has no one to save itself if it's the
 * only one. Concretely: `!u.downed && u.instanceId !== downedUnit.instanceId`.
 * In practice, by the time a caller reaches this function `downedUnit.downed`
 * is already `true` (engine/combat.ts's applyMechDamage/applyBloomDamage
 * set it before Mission.handleDowned ever runs), so the `!u.downed` half
 * alone would already exclude it — the explicit instanceId check is kept
 * anyway as defense-in-depth against a future caller that evaluates this
 * before flipping the flag.
 *
 * Hostile-side units (Bloom, unmarked mechs) and any player-side unit with
 * no pilotId (there shouldn't be one, but the type allows it) are not
 * campaign-tracked pilots, so this is a no-op for them — always a
 * standard restock, which for a hostile unit means nothing at all (the
 * campaign roster has no concept of a hostile "roster").
 */
export function evaluatePermadeathCheck(downedUnit: BattleUnit, sameSideUnits: BattleUnit[]): PermadeathCheckResult {
  if (downedUnit.side !== "player" || !downedUnit.pilotId) {
    return { permanent: false, reason: "not a campaign-tracked player pilot — standard restock" };
  }

  // Rule 3: no plot armor except the one exempt protagonist pilot, checked
  // via an explicit, data-driven flag (PilotRecord.exemptFromPermadeath —
  // see data/types.ts and pilot_rourke's record in data/campaignAmaranth.ts)
  // rather than a hardcoded id comparison buried here.
  //
  // Commander-down correction (25 Aug 2026): this branch's "always a
  // standard restock" framing was live-engine's own bug, not this file's
  // design intent — Independent Campaign doc §6a is explicit that the
  // exempt pilot going down "doesn't get redirected onto someone else and
  // it doesn't get waved off," it ends the mission attempt outright. Fixed
  // at the one real call site, engine/mission.ts's Mission.handleDowned(),
  // which now checks PilotRecord.exemptFromPermadeath itself and
  // short-circuits to a distinct "commander_down" mission outcome BEFORE
  // ever calling this function — so in live play this branch is
  // unreachable for that pilot. Left in place, not deleted, because
  // evaluatePermadeathCheck is still a general-purpose pure check that a
  // test (or any future caller evaluating a downing in isolation, outside
  // a live Mission) can call directly; "not a permanent loss" remains the
  // technically correct answer for an exempt pilot even though nothing in
  // live play ever reaches this line to hear it.
  const pilot = findPilot(downedUnit.pilotId);
  if (pilot?.exemptFromPermadeath) {
    return { permanent: false, reason: `${pilot.displayName} is exempt from permadeath — always a standard restock` };
  }

  const livingOtherMuntis = sameSideUnits.filter(
    (u) => u.side === downedUnit.side && u.path === "munti" && !u.downed && u.instanceId !== downedUnit.instanceId
  );
  if (livingOtherMuntis.length > 0) {
    return { permanent: false, reason: "a living Munti is still on the field — standard restock" };
  }

  // Deliberately correct, not a gap: the Fabricator's mid-mission
  // spare-parts redeploy is a wholly separate system (not built this
  // pass) that only decides whether a downed unit gets back onto the
  // board *this* mission. Whether losing them *again* is reversible is
  // decided purely by this same live check, every time — so "no living
  // Munti to save this unit" correctly reads as permanent here even for
  // a unit that a Fabricator might otherwise have field-repaired, exactly
  // as the design doc specifies.
  return { permanent: true, reason: "no living Munti remains on this side — permanent loss" };
}

/** Runs evaluatePermadeathCheck and, if permanent, flips that pilot's campaign status. Convenience wrapper for a debrief screen replaying a mission's downing events against the persistent roster. */
export function applyPermadeathCheck(state: CampaignState, downedUnit: BattleUnit, sameSideUnits: BattleUnit[]): PermadeathCheckResult {
  const result = evaluatePermadeathCheck(downedUnit, sameSideUnits);
  if (result.permanent && downedUnit.pilotId) {
    const entry = state.pilots[downedUnit.pilotId];
    if (entry) {
      entry.status = "permanently_lost";
      // Campaign economy pass: any personalPoints this pilot had banked
      // but not yet spent are discarded here, not transferred anywhere —
      // a deliberate design call (per this pass's brief), matching the
      // theme this repo already established for mek/tier investment (a
      // lost pilot's PilotRecord — tier included — simply stops being
      // reachable; Canon Pass §C.3: "points invested in a lost pilot are
      // NOT carried forward"). This is intentional, not a bug: a pilot's
      // personal points are their own growth, and that growth doesn't
      // outlive them any more than their gear tier does.
      entry.personalPoints = 0;
      // Mek NPC Introduction Plan v1 §4, 29 Aug 2026 — a Mek is never lost
      // to combat, they retire to civilian life the instant their own
      // matched pilot (this pilot) goes permanently_lost, exactly what just
      // happened above. Deliberately NOT a second mutation here on
      // state.meks[entry.pilot.mekId] — "is this Mek still active" is
      // fully derived from this same status flip wherever it's asked
      // (scenes/Hub.ts's buildNpcs() Mek-seeding loop only builds a
      // walkable Mek NPC for a pilot whose live status is still "active"),
      // so a stored second flag would just be the same fact told twice —
      // exactly the un-merged-registry drift this project has hit before
      // (see pilotRegistry.ts's own header). checkMekRetirement() (Hub.ts)
      // handles the one-shot gossip announcement, gated on
      // HubPilotSocialState.mekRetirementAnnounced above, not on anything
      // stored here.
    }
  }
  return result;
}

/**
 * The mutation half of a permanent loss, applied at debrief.
 *
 * Extracted out of scenes/Debrief.ts (2 Sep 2026) when the loss-context
 * stamp was added. Two reasons, both real. It is now four fields of real
 * campaign consequence rather than two assignments, and a Phaser scene is
 * the one place in this repo nothing can unit-test — this project's own
 * rule is that a number only counts once it has been run and passed, and a
 * rule buried in a scene can't be. Second, it puts the stamp next to
 * PilotLossContext's own definition, so the two can't drift.
 *
 * Deliberately NOT re-running evaluatePermadeathCheck: Mission already
 * answered that live, at the exact instant of each downing, against the
 * side roster as it stood then. Re-deciding it here against end-of-mission
 * state would be wrong for anyone downed while a Munti was still alive.
 *
 * Returns the pilotIds actually flipped, so a caller can tell a real loss
 * from a record naming a pilot this campaign has never heard of.
 */
export function applyMissionLosses(
  state: CampaignState,
  losses: readonly (Omit<PilotLossContext, "missionId" | "outcome"> & { pilotId: string })[],
  missionId: string,
  outcome: "win" | "loss",
): string[] {
  const flipped: string[] = [];
  for (const loss of losses) {
    const entry = state.pilots[loss.pilotId];
    if (!entry) continue;
    entry.status = "permanently_lost";
    // A lost pilot's banked personal points are discarded, not transferred
    // — unchanged behaviour, moved here with the rest of it. See
    // applyPermadeathCheck above for the full reasoning.
    entry.personalPoints = 0;
    entry.lostContext = {
      missionId,
      outcome,
      turn: loss.turn,
      turnsWithoutMunti: loss.turnsWithoutMunti,
      muntisDeployed: loss.muntisDeployed,
      wasLastMunti: loss.wasLastMunti,
      lostOnDay: currentDay(state),
    };
    flipped.push(loss.pilotId);
  }
  return flipped;
}

/**
 * The mutation half of lastword_signature's (Migawari/The Last Word) own
 * permanent cost, applied at debrief — same evaluate-live/apply-later split
 * as applyMissionLosses just above, and for the identical reason: the
 * Mission object that recorded each use is torn down at Debrief, so the
 * fact has to be written down once, live, at the moment it happened
 * (engine/mission.ts's Mission.signatureHpCosts / LastWordSignatureCostRecord)
 * and only landed on the persistent PilotRecord here.
 *
 * Multiplicative, and deliberately walked in array order rather than
 * collapsed into one combined factor first: `costs` can hold more than one
 * entry for the SAME pilotId (a long mission where the 6-turn cooldown
 * comes back around twice), and multiplying each into
 * `entry.pilot.permanentMaxHpMultiplier` in the order they were recorded is
 * exactly the same compounding LAST_WORD_SIGNATURE_HP_MULTIPLIER_RANK1's
 * own comment (data/combatTables.ts) documents for the cross-mission case
 * — there is nothing special about two uses landing in the same debrief
 * versus two different debriefs one campaign-week apart; it's the same
 * multiplication, applied in the same order, either way.
 *
 * No-op for a pilotId this campaign doesn't recognize (defense in depth,
 * matching applyMissionLosses' own `if (!entry) continue` just above) —
 * should never happen in live play (the wielder recording a use is always
 * a currently fielded, campaign-tracked pilot), but a directly-constructed
 * test Mission could hand this a synthetic id.
 *
 * Deliberately does NOT touch currentHp/maxHp on any live BattleUnit —
 * there is no live BattleUnit here, only the persistent PilotRecord. The
 * CURRENT mission's own wielder already had their in-mission maxHp/currentHp
 * shrunk directly, at the instant of each use, by
 * engine/mission.ts's lastWordSignature() itself (see that method's own
 * header comment for why the reduction is read as applying immediately,
 * not deferred to next deployment) — this function only carries the SAME
 * multiplier forward onto every future mission that pilot ever deploys
 * into again.
 */
export function applyLastWordSignatureCosts(
  state: CampaignState,
  costs: readonly { pilotId: string; hpMultiplier: number }[],
): void {
  for (const cost of costs) {
    const entry = state.pilots[cost.pilotId];
    if (!entry) continue;
    entry.pilot.permanentMaxHpMultiplier = (entry.pilot.permanentMaxHpMultiplier ?? 1) * cost.hpMultiplier;
  }
}

/**
 * seal_borrowed_authority's (Simulacrum/The Stolen Seal, Vault Phase 2
 * slice 6, 3 Sep 2026) own persistence half — see
 * CampaignState.foughtOnHitEffectKinds' own comment for the full design.
 * Called once per Debrief with
 * Mission.getFoughtOnHitEffectKindsThisMission() (engine/mission.ts): every
 * on-hit-effect kind any hostile on THIS mission's own board ever carried,
 * unioned into the campaign-wide set. Idempotent — a kind already recorded
 * from an earlier mission is simply a no-op, never a duplicate entry, since
 * this always rebuilds from a Set — and safe to call with an empty array
 * (every mission with no Bloom hostiles at all, if one is ever authored;
 * every mission today has at least one). Mutates `state` directly, same
 * void/mutate shape as applyLastWordSignatureCosts right above.
 */
export function recordFoughtOnHitEffectKinds(state: CampaignState, kinds: readonly OnHitEffectKind[]): void {
  const seen = new Set<OnHitEffectKind>(state.foughtOnHitEffectKinds ?? []);
  for (const kind of kinds) seen.add(kind);
  state.foughtOnHitEffectKinds = Array.from(seen);
}

/**
 * Frame Systems Layer §7 (6 Sep 2026) — fold one mission's hostile kills
 * (Mission.hostileKills, keyed by archetype id) into the campaign-wide
 * tally. Additive, idempotent per call only in the sense every Debrief
 * calls it exactly once; safe with an empty table. Mutates `state`
 * directly, same void shape as recordFoughtOnHitEffectKinds above.
 */
export function recordHostileKills(state: CampaignState, kills: Readonly<Record<string, number>>): void {
  const tally = { ...(state.hostileKillsByArchetype ?? {}) };
  for (const [archetypeId, n] of Object.entries(kills)) {
    if (!n || n <= 0) continue;
    tally[archetypeId] = (tally[archetypeId] ?? 0) + n;
  }
  state.hostileKillsByArchetype = tally;
}

/** How many of `archetypeId` this company has killed, campaign-wide. 0 for any save predating the counter. */
export function hostileKillCount(state: CampaignState, archetypeId: string): number {
  return state.hostileKillsByArchetype?.[archetypeId] ?? 0;
}

// ---- 5. The deploy gate -------------------------------------------------

export interface LaunchCheckResult {
  ok: boolean;
  reason?: string;
}

/**
 * A mission cannot launch unless at least one currently-active, living
 * Munti-class pilot is among the deploying squad (Maxime: "cant go into
 * mission without a munties. Munties are essentially vip that fight back
 * and heal."). Pure validation — a future deploy-selection screen calls
 * this before allowing "Launch."
 *
 * Note on current bite: every Act I mission built so far (Muster / Wire
 * and Mud / The Low Ground / Tunnel Rats) deploys the full 5-of-5 roster —
 * there is no squad-selection UI yet, so this function currently can never
 * actually block anything in play (Warden Company's one Munti, Corin
 * Lask, is always in the deploying squad by construction). It starts
 * doing real work once Act II's composition choice ships (5–8 deploy out
 * of a 10-pilot roster, per the campaign doc's §10 squad-scaling table).
 * Built correctly now anyway, per this pass's brief.
 */
export function canLaunchMission(deployedPilotIds: string[], state: CampaignState): LaunchCheckResult {
  const hasActiveLivingMunti = deployedPilotIds.some((id) => {
    const entry = state.pilots[id];
    if (!entry || entry.status !== "active") return false;
    return UNIT_ARCHETYPES[entry.pilot.archetypeId]?.path === "munti";
  });
  if (!hasActiveLivingMunti) {
    return {
      ok: false,
      reason: "no active Munti-class pilot is in the deploying squad — at least one is required to launch.",
    };
  }
  // CO Check-In Gate Plan v1, 28 Aug 2026 — built 1 Sep 2026. Maxime:
  // "cant start a new mission if you havent debrief[ed with the CO]. after
  // [the debrief]." Deliberately reads state.lastMissionEcho rather than a
  // new counter — that field is already set the moment Debrief.ts's
  // create() runs for the first time (see its own doc comment above) and
  // stays undefined until then, so it's a free "has this save had a real
  // debrief yet" signal. Without this guard, hasCheckedInWithCo's own
  // default-false would incorrectly block a brand-new campaign's Mission 1,
  // before there's any debrief — or any CO interaction — to have happened.
  if (state.lastMissionEcho !== undefined && !state.hasCheckedInWithCo) {
    return {
      ok: false,
      reason: "The CO hasn't signed off yet — find him in the grotto.",
    };
  }
  return { ok: true };
}

// ---- 6. Emergency Munti replacement + discretionary recruiting ---------
// Two functions, deliberately different guarantees (campaign doc's own
// split): the emergency track is what makes the deploy gate above safe to
// have at all — without it, a roster that hits zero living Muntis could
// never launch another mission, a spreadsheet dead end instead of a story
// beat. The discretionary track is an ordinary points-shop purchase and is
// allowed to fail.

// Recruit name pools and the callsign cycle moved to data/names.ts on
// 9 Sep 2026 (Maxime: "we should also make a name generator for the
// character generator") — the 5 Sep pools' own comment said they belonged
// to the character creator/editor, and one file both this generator and
// that editor import from is how that stops being a comment. What is
// still true here: a recruit joins as "Cpl. Vera Okonkwo" — a real rank
// and a real name, never a callsign, because a callsign is EARNED
// (awardCallsign below). The Mek side is new: a generated recruit's Mek
// now gets a single given name of their own (generateMekName) instead of
// "<Surname>'s Mek", per Bloom_Wars_Mek_NPC_Introduction_Plan_v1.md §10.

/**
 * The crew gives a pilot a callsign (5 Sep 2026). Recruits join nameless in
 * that sense and earn one by doing something worth naming — the trigger
 * lives at the call site, not here, so what "earns" it can change without
 * touching this.
 *
 * No-op for anyone who already has one, which includes every authored pilot
 * (their callsign is baked into the displayName they were written with, so
 * they must never be re-named by this). That means the ten authored recruit
 * candidates arrive already named — they are written characters, and Okafor
 * has been "Ledger" since before the player met him. Only a GENERATED
 * recruit joins nameless and earns one, which is the case this exists for.
 */
export function awardCallsign(state: CampaignState, pilotId: string, callsign?: string): string | null {
  const entry = state.pilots[pilotId];
  if (!entry) return null;
  if (entry.pilot.callsign) return null; // already named
  if (entry.pilot.displayName.includes("\u201c")) return null; // authored cast, callsign already in the name
  const name = callsign ?? generateCallsign(state.nextGeneratedId++);
  entry.pilot.callsign = name;
  entry.pilot.displayName = `${entry.pilot.displayName} \u2014 \u201c${name}\u201d`;
  return name;
}

// A generated recruit's mek needs *some* primary track (MekTrack is
// required, non-nullable — PilotRecord/MekArchetype have no real concept
// of "unassigned"). Rather than pick arbitrarily, this follows the one
// existing pattern in the data: every named pilot of a given class in
// PILOTS/WARDEN_PILOTS combined uses a consistent primary track, except
// Meeps, which is mixed (Nagori/Rourke: Runemaster, Iyari: Armorer, Voss:
// Fabricator) — Armorer is picked there as the flattest, no-special-
// interaction default for a generic rookie.
export const CLASS_DEFAULT_MEK_TRACK: Record<Path, MekTrack> = {
  munti: "fieldwright", // both named Muntis (Barasj, Lask) — the class's defining support track
  tank: "armorer", // both named Tanks (Thyns, Bosk)
  reeps: "runemaster", // both named Reeps (Tourignie, Anand)
  meeps: "armorer", // mixed precedent — see comment above
};

// data/units.ts archetype ids are arch_<class>_<suffix>, where suffix is
// "bipedal"/"centauroid"/"vibrissal" — NOT the Chassis type's own value
// ("bipedal_vibrissal"), which is why this is its own small type rather
// than importing Chassis from data/types.
// (engine/heirlooms.ts carries its own copy of these three values as
// HeirloomChassis, since this one is deliberately file-local to
// campaignState.ts's own id-building. Exported, 9 Sep 2026 (Character
// Creator pass) — the "third consumer" this comment used to say would be
// the trigger to move the union into data/types.ts turned out to be
// scenes/shop/CharacterCreatorOverlay.ts, and importing this existing
// declaration is exactly the "don't write it a third time" outcome the
// old note wanted, so it stays put rather than relocating.)
export type ArchetypeChassisSuffix = "bipedal" | "centauroid" | "vibrissal";

/**
 * Shared by every recruit path below: mints a brand-new baseline G-tier
 * pilot (and a fresh, unassigned-track-default mek) of the given class and
 * adds both to the campaign state. Never reuses a lost pilot's identity,
 * tier, or mek — a genuinely new record, so there is nothing to carry over
 * by construction (rule 6's own point).
 *
 * `chassisSuffix` defaults to "bipedal" purely as a safety net for any
 * future caller that forgets to pass one — every real call site as of 9
 * Sep 2026 (checkMuntiGuarantee, recruitDiscretionary, recruitIntoLance's
 * generated-fallback branch, generateRandomRescuedPilot) now passes an
 * explicit value, almost always randomChassisSuffix() below. Before this
 * pass only generateRandomRescuedPilot ever varied it — the other three
 * silently minted human/bipedal recruits every time, not by any design
 * decision on record, just because nobody had wired the roll in yet.
 * Maxime, 9 Sep 2026: "we should make sure player truly get randomized
 * npc if they recruit a soldier in the hangar bay. and when they receive
 * brand new munties from various source." This is that fix.
 */
function generatePilot(state: CampaignState, targetClass: Path, chassisSuffix: ArchetypeChassisSuffix = "bipedal"): PilotRecord {
  const n = state.nextGeneratedId;
  state.nextGeneratedId += 1;
  // A real rank and name, not a callsign — see data/names.ts's own header
  // and awardCallsign for why a recruit starts unnamed in that sense.
  const recruitName = generateRecruitName();
  const pilotId = `pilot_recruit_${n}`;
  const mekId = `mek_recruit_${n}`;

  // The Catalyst Gauntlet, 9 Sep 2026 (Catalyst_Gauntlet_v2_ThirdLance_
  // Verinis_Recruits.md §5 item 3, "go" 7 Sep 2026): every generated pilot
  // and their Mek now roll a real background, not just a class/chassis.
  // The Mek's is deliberately excluded from the pilot's own sector — "a
  // second, contrasting one for the Mek (a different sector, at least)" —
  // so a recruit and their Mek never read as having grown up in the same
  // place by pure chance.
  const pilotBackground = rollBackground();
  const mekBackground = rollBackground(Math.random, { excludeSector: pilotBackground.sector });

  const mek: MekArchetype = {
    id: mekId,
    // A given name of their own, not "<Surname>'s Mek" — Bloom_Wars_Mek_NPC_
    // Introduction_Plan_v1.md §10 (8 Sep 2026): once a Mek has a name, the
    // possessive label retires everywhere the player reads it, and the
    // pairing lives on the Mek's own Archive dossier as "Attached synker"
    // instead. Skips every name already on this save so no two Meks
    // aboard share one.
    displayName: generateMekName(Object.values(state.meks).map((m) => m.displayName)),
    primary: CLASS_DEFAULT_MEK_TRACK[targetClass],
    secondary: null,
    spareParts: 0,
    background: mekBackground,
  };
  state.meks[mekId] = mek;

  // arch_${class}_bipedal is every class's "standard" archetype — the same
  // convention data/units.ts's own HOSTILE_MECHS comment describes ("All
  // four use the standard bipedal archetypes," Data Pack §9). Not the only
  // chassis a generated recruit gets anymore as of 9 Sep 2026 — see this
  // function's own header — but still the parameter's fallback value, so
  // this stays the right shape to reference for that convention.
  const pilot: PilotRecord = {
    id: pilotId,
    displayName: recruitName,
    archetypeId: `arch_${targetClass}_${chassisSuffix}`,
    mekId,
    // Combat Medic Cadre (2 Sep 2026, data/carrierModules.ts) — the one
    // carrier module that changes what a generated pilot IS rather than
    // what they can carry. Munti only, exactly as the source design words
    // it ("discretionary Munti recruits enter at F-tier instead of G"): a
    // medic cadre training up field doctors has no reason to improve a
    // Tank recruit, and widening it to every class would quietly make this
    // the strongest module in the game.
    tier: targetClass === "munti" && (state.builtModules ?? []).includes("combatMedic") ? "F" : "G",
    background: pilotBackground,
  };
  state.pilots[pilotId] = { pilot, status: "active", personalPoints: 0 };
  return pilot;
}

const ALL_RECRUITABLE_PATHS: Path[] = ["meeps", "tank", "reeps", "munti"];

/** Every chassis suffix generatePilot understands. Exported (9 Sep 2026) for randomChassisSuffix below and for scenes/shop/CharacterCreatorOverlay.ts's species picker — one list, so the two never drift apart. */
export const ALL_CHASSIS_SUFFIXES: ArchetypeChassisSuffix[] = ["bipedal", "centauroid", "vibrissal"];

/**
 * One equal-odds pick among the three chassis suffixes — human, Hiopi,
 * Osnian (`ArchetypeChassisSuffix`'s own header has the id-suffix-to-
 * species mapping). Added 9 Sep 2026 pulling the roll generateRandomRescuedPilot
 * already did for chassis out into its own function, so checkMuntiGuarantee
 * and recruitDiscretionary can share the exact same roll instead of each
 * silently defaulting to human. `rng` is injectable so a test can be
 * deterministic, same idiom as data/names.ts's randomFrom.
 */
export function randomChassisSuffix(rng: () => number = Math.random): ArchetypeChassisSuffix {
  return ALL_CHASSIS_SUFFIXES[Math.floor(rng() * ALL_CHASSIS_SUFFIXES.length)];
}

export type RechassisResult = { ok: true } | { ok: false; reason: string };

/**
 * The Character Creator overlay's species/chassis change, for a pilot
 * that generatePilot minted (a real, generated recruit — never one of the
 * hand-authored named-cast entries, which don't carry a class/chassis
 * split this cleanly and aren't meant to be re-chassised by a player;
 * callers are responsible for only ever pointing this at a
 * generatePilot-made id, same discretion recruitDiscretionary/
 * checkMuntiGuarantee/generateRandomRescuedPilot's callers already need).
 * Rebuilds `archetypeId` as `arch_<same class>_<new chassis>` — the class
 * half never changes here, only the chassis suffix — and validates the
 * result actually exists in UNIT_ARCHETYPES before committing (every
 * class x chassis combination does exist today, per data/units.ts, but
 * this stays a real check rather than a blind string rebuild in case that
 * ever stops being true). Everything downstream that cares about species
 * — isRomanceableSpecies, Hub.ts's buildNpcs — already reads it live off
 * archetypeId every time rather than caching it anywhere, so there is
 * nothing else to update once this returns ok.
 */
export function rechassisPilot(state: CampaignState, pilotId: string, chassisSuffix: ArchetypeChassisSuffix): RechassisResult {
  const entry = state.pilots[pilotId];
  if (!entry) return { ok: false, reason: "no such pilot" };
  const currentArchetype = UNIT_ARCHETYPES[entry.pilot.archetypeId];
  if (!currentArchetype) return { ok: false, reason: "pilot's current archetype is unknown" };
  const nextArchetypeId = `arch_${currentArchetype.path}_${chassisSuffix}`;
  if (!UNIT_ARCHETYPES[nextArchetypeId]) return { ok: false, reason: `no archetype for ${currentArchetype.path}/${chassisSuffix}` };
  entry.pilot = { ...entry.pilot, archetypeId: nextArchetypeId };
  return { ok: true };
}

/**
 * The Character Creator overlay's name field/"reroll name" button. Plain
 * trim-or-keep, same idiom as CampaignSetup.ts's resolveCompanyName — an
 * accidental blank submit keeps whatever name the pilot already had
 * rather than saving an empty displayName.
 */
export function renamePilot(state: CampaignState, pilotId: string, displayName: string): RechassisResult {
  const entry = state.pilots[pilotId];
  if (!entry) return { ok: false, reason: "no such pilot" };
  const trimmed = displayName.trim();
  if (trimmed.length === 0) return { ok: true }; // no-op, not an error — see header
  entry.pilot = { ...entry.pilot, displayName: trimmed };
  return { ok: true };
}

/**
 * Mission 5's rescue-and-recruit bonus objective (Maxime, 23 Aug 2026 —
 * asked whether a rescue should hand back a fixed class or a real wildcard:
 * "Chassis and class, both random." — this used to be the only recruit
 * path where chassis was ever anything but human; as of 9 Sep 2026 it no
 * longer is, but it stays the only one where NEITHER class nor chassis is
 * chosen by anything except an equal-odds roll — checkMuntiGuarantee still
 * always wants a Munti, recruitDiscretionary still lets the PLAYER choose
 * the class). Call this once, only when a Mission's rescueOutcome reads
 * "succeeded" (engine/mission.ts) — scenes/Debrief.ts is the one real call
 * site, mirroring checkMuntiGuarantee's own "run once on entry" shape.
 *
 * Lands on the bench, not the active roster (Maxime's own answer, "The
 * bench") — which for this campaign layer means exactly what it means for
 * every other generated recruit: `status: "active"` in CampaignState.pilots
 * with nobody currently required to deploy them. There is no separate
 * "bench" collection to insert into; see generatePilot's own call above and
 * campaignState.ts's header for why every pilot here, named or generated,
 * is stored the same way.
 */
export function generateRandomRescuedPilot(state: CampaignState): PilotRecord {
  const targetClass = ALL_RECRUITABLE_PATHS[Math.floor(Math.random() * ALL_RECRUITABLE_PATHS.length)];
  return generatePilot(state, targetClass, randomChassisSuffix());
}

function countActiveMuntis(state: CampaignState): number {
  return Object.values(state.pilots).filter(
    (e) => e.status === "active" && UNIT_ARCHETYPES[e.pilot.archetypeId]?.path === "munti"
  ).length;
}

export interface MuntiGuaranteeResult {
  recruited: boolean;
  pilot?: PilotRecord;
}

/**
 * The automatic-trigger half of rule 6. Call this once, at the point a
 * mission's outcome is finalized (win/loss/mission end) — it looks at the
 * campaign's *whole* roster, not just whoever deployed, since the point is
 * "can the campaign still launch a mission at all," not "did this
 * particular squad have one." Unconditional: no points cost, cannot fail,
 * by design — this is the mechanism that guarantees the deploy gate
 * (canLaunchMission above) can never permanently brick a save.
 *
 * Chassis randomized (9 Sep 2026 — see generatePilot's own header) rather
 * than silently always human: "brand new munties from various source"
 * should actually vary, same as any other generated recruit now does.
 * checkMuntiGuarantee itself still ONLY ever varies chassis, never class —
 * guaranteeing a Munti specifically is the entire point of this function.
 */
export function checkMuntiGuarantee(state: CampaignState): MuntiGuaranteeResult {
  if (countActiveMuntis(state) > 0) return { recruited: false };
  const pilot = generatePilot(state, "munti", randomChassisSuffix());
  return { recruited: true, pilot };
}

export interface RecruitResult {
  ok: boolean;
  pilot?: PilotRecord;
  reason?: string;
}

// Placeholder balance number. The design docs explicitly leave this open
// ("the discretionary track's actual points cost — a balance number, not
// a design question — still open," Spitball Ideas / Antfarm Carrier Hub
// v1, 22 Aug 2026). Data Pack §12.1's cheapest existing shop purchase is
// the G→F gear-tier step at 60 points; a whole extra deploy-capable pilot
// is worth a little more than one stat bump on an existing pilot, so this
// sits just above that floor. Pending a real tuning pass once there's
// actual play data to weigh "a 6th/7th pilot" against "better gear for
// the five you have."
export const DISCRETIONARY_RECRUIT_COST = 80;

/**
 * The discretionary half of rule 6 — an ordinary points-shop purchase, NOT
 * guaranteed. Deducts DISCRETIONARY_RECRUIT_COST and adds a new baseline
 * G-tier pilot of `targetClass` if the campaign can afford it; otherwise
 * leaves the campaign state untouched and returns a failure reason. Unlike
 * checkMuntiGuarantee, this can target any of the four classes — including
 * a second Munti bought proactively before the roster ever hits zero,
 * which the campaign doc calls out as a real tactical purchase once Act
 * II's composition choice opens deploy slots up to 8-of-10.
 *
 * Chassis randomized (9 Sep 2026 — see generatePilot's own header) rather
 * than silently always human: the player still only chooses class here
 * (targetClass, via the Hangar/shop's own class selector), same as always
 * — species is the roll, same as every other generated recruit now gets,
 * and the Character Creator overlay this ships alongside
 * (scenes/shop/CharacterCreatorOverlay.ts) is where the player actually
 * sees and can reroll that result before it's final.
 */
export function recruitDiscretionary(state: CampaignState, targetClass: Path): RecruitResult {
  if (state.points < DISCRETIONARY_RECRUIT_COST) {
    return {
      ok: false,
      reason: `not enough points — recruiting a ${targetClass} pilot costs ${DISCRETIONARY_RECRUIT_COST}, campaign has ${state.points}.`,
    };
  }
  state.points -= DISCRETIONARY_RECRUIT_COST;
  const pilot = generatePilot(state, targetClass, randomChassisSuffix());
  return { ok: true, pilot };
}

// ---- 6b. Pilot Discharge (5 Sep 2026) ----------------------------------
// claude/Bloom_Wars_Pilot_Discharge_And_Roster_Pressure_Proposal_v1.md —
// design pass, zero code, 28 Aug 2026; shape decided that same day per
// Maxime's own delegation ("your call on unanswered question i dunno
// enough"). The release valve for the roster pressure this project already
// built without a new number: the RIVAL_THRESHOLD-gated Stress bleed and
// Anger Blowup (data/toxicPairs.ts, data/angerBlowup.ts) both make a bad
// pairing cost something every encounter, forever, with no way to stop it
// short of rotating the pairing out. Discharge is that way out — the
// player's own order, issued directly (no CO, no chat needed: the player
// already holds command authority over their own single carrier), most
// naturally from wherever roster management already lives (the shop, next
// to Discretionary recruiting — see scenes/shop/ShopPanel.ts).

export interface DischargeResult {
  ok: boolean;
  reason?: string;
  /**
   * Set only when discharging this pilot dropped the roster's active Munti
   * count to zero and this call minted a free replacement to cover it (see
   * the Munti-safety note below) — undefined otherwise, including on every
   * ordinary discharge.
   */
  muntiReplacement?: PilotRecord;
}

/**
 * Cost — matches permadeath, deliberately (the proposal's own words):
 * "Discharge isn't cheaper than losing them in the field — it's the same
 * mechanical weight, minus the death and minus the grief beat." Concretely,
 * that means exactly what applyPermadeathCheck/applyMissionLosses already
 * do above: personalPoints banked but unspent are discarded, and the
 * pilot's own tier and mek investment simply stop being reachable once
 * their CampaignPilotEntry leaves the active roster — there is no separate
 * "forfeit" mutation to write, because nothing else in this file ever lets
 * a non-active pilot's PilotRecord or mek be reused. If discharge were
 * free, it would quietly undercut permadeath's own sting by giving players
 * a safe exit for any pilot they're not attached to; costing the same
 * keeps it a real, considered decision instead of a loophole. No cooldown
 * and no use limit (Maxime: "No limit (Recommended)") — the cost alone is
 * the brake.
 *
 * Commander exemption: refuses on PilotRecord.exemptFromPermadeath, the
 * same data-driven flag evaluatePermadeathCheck itself checks (Rourke in
 * Warden, her House Amaranth counterpart) — not a hardcoded id, so this
 * stays correct if that flag ever moves. Permadeath already treats this
 * pilot's departure as never an ordinary roster event; discharge shouldn't
 * quietly become the back door around that.
 *
 * The Munti case, worth real care rather than assuming the proposal's own
 * reasoning still holds once actually wired up: the proposal says
 * discharging the roster's last living Munti is safe because
 * checkMuntiGuarantee already exists as a free, unconditional replacement
 * — true, but checkMuntiGuarantee is only ever CALLED from Debrief.ts, at
 * the end of a mission. A Hub-side discharge has no upcoming debrief to
 * trigger it, and canLaunchMission already refuses to launch ANY mission
 * without an active Munti in the deploying squad — so discharging the
 * roster's last one from the shop, with nothing else done, would soft-lock
 * a real campaign (no Munti to deploy -> can't launch -> can't reach a
 * debrief -> the guarantee that was supposed to save this never fires).
 * Not a hypothetical: caught by tracing canLaunchMission/checkMuntiGuarantee
 * against the real call sites before writing this, not by assuming the
 * proposal's own description of the safety net still applied verbatim.
 * Fixed by calling checkMuntiGuarantee itself, immediately, right here —
 * the exact same free, guaranteed replacement the proposal already
 * describes, just triggered at the moment it's actually needed instead of
 * a debrief that would never come. This does not replace the confirm
 * prompt Maxime's own answer asked for ("worth a confirm prompt so it's
 * not an accidental click") — that's a caller/UI concern (ShopPanel's own
 * arm-then-confirm click) — it only guarantees the campaign stays
 * launchable regardless of whether that prompt was heeded.
 */
export function dischargePilot(state: CampaignState, pilotId: string): DischargeResult {
  const entry = state.pilots[pilotId];
  if (!entry) return { ok: false, reason: "no such pilot" };
  if (entry.status !== "active") return { ok: false, reason: "that pilot is not on the active roster" };
  if (entry.pilot.exemptFromPermadeath) return { ok: false, reason: "the commander can't be discharged" };
  entry.status = "discharged";
  // Matches applyPermadeathCheck's own comment exactly: a lost (here,
  // discharged) pilot's personal points are their own growth, and that
  // growth doesn't outlive their time on this roster any more than their
  // gear tier does.
  entry.personalPoints = 0;
  const guarantee = checkMuntiGuarantee(state);
  return { ok: true, muntiReplacement: guarantee.recruited ? guarantee.pilot : undefined };
}

// ---- 7. Second Lance integration (Act II opening, 25 Aug 2026) ---------

export interface SecondLanceResult {
  integrated: boolean;
  pilots?: PilotRecord[];
}

/**
 * Adds the five Second Lance pilots (data/campaignAmaranth.ts's
 * SECOND_LANCE_PILOTS/SECOND_LANCE_MEKS) to the campaign roster as active,
 * deployable pilots — the mechanical half of "Warden Company forms around
 * Rourke's survivors and a second lance" (Independent Campaign doc, Act
 * II's own opening line). Free, unconditional, cannot fail, same shape as
 * checkMuntiGuarantee — this is a scripted story beat, not a purchase.
 *
 * Call site (scenes/Debrief.ts) fires this once, gated on
 * `mission.mission.id === "mission_amaranth_12" && mission.outcome ===
 * "win"` — Mission 12 is Act I's own finale (Thistledown Watch, Rourke's
 * promotion to Captain), and the campaign doc frames the second lance as
 * arriving at that exact act transition, not as a reward doled out
 * partway through Act II. Idempotent by construction, same technique
 * generatePilot's callers rely on elsewhere: checks whether the first
 * Second Lance pilot id is already in the roster before adding anything,
 * so a player who reaches Mission 12's debrief screen more than once in
 * the same browser session (a retry, a reload) never gets five duplicate
 * entries — matches this codebase's existing "check the actual state,
 * don't assume a screen renders exactly once" discipline.
 *
 * 27 Aug 2026 addendum: also sets state.rourkeRank to "capt" — this
 * function's own doc comment above already cited "Rourke's promotion to
 * Captain" as landing on this exact beat, but nothing ever actually wrote
 * the rank until now (found while building the "Hello, Sir" rank-greeting
 * mechanic; see CO_BONUS_BY_RANK's own comment in campaignEconomy.ts,
 * which has been reading rourkeRank, unchanging, since 22 Aug). Only runs
 * on the `integrated: true` path, so it can't refire on a repeat visit —
 * see deriveRourkeRank/backfillRourkeRank below for the companion fix that
 * catches a save that already passed this beat before this line existed.
 */
export function integrateSecondLance(state: CampaignState): SecondLanceResult {
  // 5 Sep 2026 — this used to hand the player five finished pilots. Maxime:
  // "player should recruit their lance teamate not have a team be creste for
  // them." So Act II now grants an EMPTY 2nd Lance and the five authored
  // pilots who used to arrive here move into the recruit pool
  // (recruitCandidates) instead — you can still end up with Okafor and
  // Solheim, but only by choosing them.
  //
  // Rourke's promotion to Captain is unchanged and still fires here: the
  // rank comes from commanding a second lance, not from who's standing in
  // it. An empty lance is still a lance you were given.
  if ((state.lancesGranted ?? derivedLanceCount(state)) >= 2) return { integrated: false };
  grantLance(state);
  state.rourkeRank = "capt";
  return { integrated: true, pilots: [] };
}

/**
 * House Amaranth's own Second Lance integration (1 Sep 2026; reworked 6 Sep
 * 2026 to match Warden's own post-5-Sep recruit-pool shape). Maxime, asked
 * directly whether "the two missions should recruit the same way" meant
 * Mission 12/20 matching each other or House Amaranth matching Warden's
 * newer system: "House Amaranth matching Warden's newer system." This used
 * to hand the player five finished pilots directly (mirroring
 * integrateSecondLance's own PRE-5-Sep shape); it now mirrors
 * integrateSecondLance's CURRENT shape instead — grants an empty lance, and
 * the five authored pilots (Kessler, Vantana, Reyken, Solano, Marrin) move
 * into the recruit pool (recruitCandidates) instead of arriving pre-added.
 *
 * This was previously reasoned to be a deliberate, permanent difference
 * from Warden (see this function's own history: House Amaranth's Hangar.ts
 * was believed to have no recruiting screen to present a pool on). That
 * belief was wrong — re-checked directly against scenes/Hangar.ts and
 * scenes/shop/ShopPanel.ts on this pass: Hangar.ts already instantiates the
 * same scene-agnostic ShopPanel Warden's Hub.ts uses, meaning House
 * Amaranth already had a working recruiting screen the whole time. There
 * was never an actual blocker to unifying the two campaigns' lance-growth
 * feel — just an unverified claim that there was one.
 *
 * Call site (scenes/Debrief.ts) fires this gated on
 * `mission.mission.id === "mission_house_amaranth_12" && outcome ===
 * "win"` — Mission 12, "Harvest's End," is this campaign's own Act I
 * finale, matching Warden's own "the previous act's own last mission,
 * won" trigger shape exactly. Deliberately does NOT set any rank field
 * (there's no Marrow-equivalent rank field built for House Amaranth).
 */
export function integrateHouseAmaranthSecondLance(state: CampaignState): SecondLanceResult {
  if ((state.lancesGranted ?? derivedLanceCount(state)) >= 2) return { integrated: false };
  grantLance(state);
  return { integrated: true, pilots: [] };
}

// ---- 8. Third Lance integration (Act III opening, 25 Aug 2026 — same-day
// correction, batch 5) ----

export interface ThirdLanceResult {
  integrated: boolean;
  pilots?: PilotRecord[];
}

/**
 * Adds the five Third Lance pilots (data/campaignAmaranth.ts's
 * THIRD_LANCE_PILOTS/THIRD_LANCE_MEKS) to the campaign roster, mirroring
 * integrateSecondLance above line for line — same free/unconditional/
 * idempotent shape, same reasoning for why a scripted story beat rather
 * than a purchase.
 *
 * Call site (scenes/Debrief.ts) fires this once, gated on
 * `mission.mission.id === "mission_amaranth_24" && mission.outcome ===
 * "win"` — Mission 24 is Act II's own finale AND the mission where Rourke
 * is promoted to Major (Independent Campaign doc, Mission 24: "Rourke
 * promoted to Major"). Maxime's own words when asked when the third lance
 * should join: "just add the ne wlance on promotion" — this is that
 * promotion. One mission earlier than Second Lance's own Mission-12-win
 * trigger relative to its act boundary is not a mismatch: Mission 24 IS
 * Act II's finale, exactly as Mission 12 is Act I's, so both lances
 * integrate on "the previous act's own last mission, won."
 *
 * 27 Aug 2026 addendum: also sets state.rourkeRank to "maj" — same fix,
 * same reasoning, as integrateSecondLance's own addendum above (this
 * function's doc comment already cited the Major promotion; nothing ever
 * wrote it). See deriveRourkeRank/backfillRourkeRank below.
 */
export function integrateThirdLance(state: CampaignState): ThirdLanceResult {
  // Same change as integrateSecondLance above, same reasoning — Act III
  // grants an empty 3rd Lance, and its five authored pilots (Kova, Ness,
  // Onwuka, Delgado, Yeun) join the recruit pool rather than the roster.
  if ((state.lancesGranted ?? derivedLanceCount(state)) >= 3) return { integrated: false };
  grantLance(state);
  state.rourkeRank = "maj";
  return { integrated: true, pilots: [] };
}

/**
 * House Amaranth's own Third Lance integration (6 Sep 2026; reworked same
 * day to match Warden's recruit-pool shape — see
 * integrateHouseAmaranthSecondLance's own updated doc comment above for
 * the full story of why the original direct-add design was reversed
 * within hours of shipping). Now mirrors integrateThirdLance exactly:
 * grants an empty lance, and the five authored pilots (Thorne, Kastan,
 * Osei, Dunmore, Amsel) move into the recruit pool instead of arriving
 * pre-added.
 *
 * Call site (scenes/Debrief.ts) fires this gated on
 * `mission.mission.id === "mission_house_amaranth_20" && outcome ===
 * "win"` — Mission 20, "Marrow's Line," is this campaign's own Act II
 * finale (Act III opens at Mission 21), the same "previous act's own
 * last mission, won" shape every other lance-integration trigger in this
 * file already uses. Does NOT set any rank field, matching
 * integrateHouseAmaranthSecondLance's own reasoning above (no
 * Marrow-equivalent rank field exists to set).
 */
export function integrateHouseAmaranthThirdLance(state: CampaignState): ThirdLanceResult {
  if ((state.lancesGranted ?? derivedLanceCount(state)) >= 3) return { integrated: false };
  grantLance(state);
  return { integrated: true, pilots: [] };
}

// ---- 8b. Mission-order gating (12 Sep 2026, Maxime: "make the mission in
// the campaign gated on completing the previous mission 1st") -------------
//
// Before this: scenes/MapSelect.ts's own mission cards had zero order
// enforcement (its own tooltip said so outright — "Nothing here is locked
// by mission order") and nothing in this file recorded which missions a
// save had actually won, ever, anywhere. Four real decisions, all Maxime's
// own call rather than guessed at:
//   1. Only a WIN unlocks the next mission — a loss doesn't, matching the
//      "only a win counts" reading integrateSecondLance/integrateThirdLance
//      above already use for their own Act-finale beats.
//   2. Existing saves are grandfathered, permanently, never retroactively
//      locked — see CampaignState.completedMissionIds' own comment for why
//      `undefined` (not a guessed-at partial history) is what makes that
//      work.
//   3. The gate reads as ONE continuous chain per side across all three
//      Acts (mission 13 needs mission 12 won), not three separately-reset
//      per-Act chains — matching the "missions 13-24 of 24" continuous
//      numbering data/allCampaigns.ts's own CampaignDef.subtitle strings
//      already use.
//   4. A locked mission's card stays visible (greyed out, tooltip explains
//      it) rather than disappearing from the list — scenes/MapSelect.ts's
//      own concern, not this file's.

/**
 * Is `missionId` unlocked in `chain` (WARDEN_MISSION_CHAIN or
 * HOUSE_AMARANTH_MISSION_CHAIN, data/allCampaigns.ts — the full 36-mission,
 * three-Act-concatenated order for one side)? The chain's own first mission
 * is always unlocked; every mission after that needs the one immediately
 * before it IN THIS SAME CHAIN already won. A mission id this chain doesn't
 * contain (the other side's chain, Team One's archived slice) reads as
 * unlocked too — this function only ever locks something it can actually
 * place in the chain it was handed, never a mission it doesn't recognize.
 *
 * `state.completedMissionIds === undefined` is the grandfather case — see
 * that field's own comment on CampaignState above — and short-circuits to
 * "everything unlocked" before any chain lookup happens at all.
 */
export function isMissionUnlocked(state: CampaignState, chain: readonly CampaignMission[], missionId: string): boolean {
  if (!state.completedMissionIds) return true;
  const index = chain.findIndex((m) => m.id === missionId);
  if (index <= 0) return true; // not this chain's mission to gate, or its own first entry — both always open
  return chain[index - 1].id in state.completedMissionIds;
}

/**
 * Records a real mission win for isMissionUnlocked() above to read back.
 * Call site: scenes/Debrief.ts, right alongside the lastMissionEcho write,
 * gated on `this.mission.outcome === "win"` only (see this section's own
 * header, point 1) — never called at all on a loss.
 *
 * Deliberately a no-op when `state.completedMissionIds` is `undefined`
 * (this save predates the gate) rather than initializing it to `{ [missionId]: true }`
 * here: doing that would start tracking a save mid-chain, which would then
 * read as "only THIS one mission won" the next time isMissionUnlocked runs
 * — silently re-locking every earlier mission in its own chain that this
 * save already has real, legitimate access to. Grandfathering has to mean
 * forever, not "until the next win," or it isn't really grandfathering.
 */
export function recordMissionWin(state: CampaignState, missionId: string): void {
  if (!state.completedMissionIds) return;
  state.completedMissionIds[missionId] = true;
}

// ---- 8a. Rourke rank correctness backfill (27 Aug 2026 — same-day
// discovery while building the "Hello, Sir" rank-greeting mechanic) -------
//
// CampaignState.rourkeRank was initialized to "2nd_lt" in
// createWardenCampaignState above and read every mission by
// campaignEconomy.ts's computeCoBonus (CO_BONUS_BY_RANK[state.rourkeRank])
// — but nothing in this codebase ever WROTE it, despite
// integrateSecondLance/integrateThirdLance's own doc comments already
// citing Rourke's promotions to Captain/Major as exactly the beats those
// two functions fire on. Cross-checked against three separate design docs
// (Bloom_Wars_Rank_And_Command_v1.md, Bloom_Wars_Crew_Banter_Phrase_Bank_v1.md,
// Bloom_Wars_Antfarm_Carrier_Hub_v1.md §12) — all three independently state
// the same locked schedule (Capt. at Mission 12, Maj. at Mission 24) and
// all three flag it "paper only, nothing here is built."
//
// integrateSecondLance/integrateThirdLance above are now fixed to set the
// rank themselves at the exact moment they fire — that covers every
// campaign played from here on. This section is the second half: a save
// that already passed Mission 12 or 24 before this fix existed has the
// lance pilots sitting in its roster but never got the rank bump, and
// would otherwise stay stuck at "2nd_lt" forever, since those two
// functions are idempotent and will never fire again for a roster that
// already has their pilots in it.
//
// deriveRourkeRank reads the exact same roster-presence signal
// integrateSecondLance/integrateThirdLance already treat as source of
// truth (has the lance's first pilot id been added yet), so it can never
// disagree with them, and it only ever moves rank forward — there's no
// un-integrate path anywhere in this codebase, so "derived rank went
// down" can't happen. backfillRourkeRank is wired into loadCampaignState
// below, so every scene's normal load path self-heals an old save the
// first time it's opened after this fix, with no separate migration step
// or save-format version bump needed.

/**
 * What Rourke's rank SHOULD be, purely from current roster composition —
 * Third Lance present means Mission 24 (Two Fires, Act II's own finale)
 * was already won, which the Independent Campaign doc calls "Rourke
 * promoted to Major"; Second Lance present (without Third) means Mission
 * 12 (the Fallow Line, Act I's own finale) was won, "Rourke's promotion to
 * Captain." Neither present: still the starting 2nd Lt. Exported for the
 * same reason every other pure check in this file is — unit-testable
 * without touching localStorage, Phaser, or a live Mission.
 */
export function deriveRourkeRank(state: CampaignState): Rank {
  // Derived from how many lances Rourke COMMANDS, not from which authored
  // pilots are in the roster (5 Sep 2026). Those used to be the same fact —
  // a 2nd Lance existed because its five pilots had been handed over — but
  // lances now arrive empty for the player to recruit into, so roster
  // membership stopped implying command.
  //
  // This mattered more than a rename: left as it was, an Act III player's
  // rank derived as 2nd_lt, and backfillRourkeRank would then have quietly
  // DEMOTED a Major on every load. lanceCount reads the stored grant and
  // falls back to the old roster derivation for pre-5-Sep saves, so both
  // eras answer correctly.
  const lances = lanceCount(state);
  if (lances >= 3) return "maj";
  if (lances >= 2) return "capt";
  return "2nd_lt";
}

/**
 * Which lance a pilot belongs to — Carrier Scale-Up Plan v1 Phase 2, 3 Sep
 * 2026 (per-lance Mek Workshops). "a" is the starting company, "b" the
 * lance that integrates at Mission 12, "c" the one at Mission 24.
 *
 * Lives here, in one exported pure function, rather than as an id check
 * inlined into Hub.ts, for three reasons this project's own history keeps
 * proving out:
 *  - It has to answer for BOTH campaigns. Warden Company has three lances
 *    (WARDEN/SECOND_LANCE/THIRD_LANCE_PILOTS); House Amaranth has two
 *    (HOUSE_AMARANTH_PILOTS + its own second lance) and no third at all.
 *    A caller that only knew about Warden's three lists would silently
 *    file every House Amaranth pilot under the wrong lance.
 *  - It's the same "extract before duplicating" call ShopPanel.ts and
 *    MenuOverlay.ts already set; the Hangar roster panel's own lance tabs
 *    are an obvious second consumer if they ever want to stop deriving
 *    this themselves.
 *  - It's unit-testable without Phaser, localStorage, or a live scene,
 *    same as every other pure check in this file.
 *
 * A pilot in none of the six static lists — a shop recruit, most obviously
 * — reads as "a". That's a real judgment call, not a fallback that can't
 * happen: recruits genuinely have no lance of their own on record, and the
 * starting company is the one the player themselves flies with, so a new
 * hire standing in Lance A's workshop is the least surprising answer.
 * Revisit if recruiting ever gets its own lance assignment.
 */
// Five, not three, deliberately (Maxime, 5 Sep 2026: "maximum number of
// lance total is 5 because i want to plan ahead for gladiator"). Gladiator
// fields 30 mechs as lance-sized activation groups and grows a fleet to 5
// carriers (Bloom_Wars_Gladiator_Fleet_Battle_Concept_v1.md), so the ID
// space is sized for that now rather than being widened later against live
// saves.
//
// The CURRENT campaign never reaches e. Recruit Cap Rework (9 Sep 2026,
// Bloom_Wars_Recruit_Cap_Rework_Plan_v1.md) opened a/b/c/d to recruiting
// from Mission 1, cost-gated only — see RECRUITABLE_LANCES and
// activeLanceIds below. That's deliberately a SEPARATE fact from
// lanceCount()/state.lancesGranted, which still only advances on the
// Mission 12/24 story beat (A from the start, B at Mission 12, C at
// Mission 24) — that beat still drives Rourke's rank and the Debrief
// "you've been given a lance" callout, it just no longer gates the
// roster. LANCE_IDS is the id space, not "the lances you have";
// activeLanceIds is what any recruiting/assignment UI should ask.
export type LanceId = "a" | "b" | "c" | "d" | "e";

export function lanceOfPilot(pilotId: string): LanceId {
  if (THIRD_LANCE_PILOTS.some((p) => p.id === pilotId)) return "c";
  if (HOUSE_AMARANTH_THIRD_LANCE_PILOTS.some((p) => p.id === pilotId)) return "c";
  if (SECOND_LANCE_PILOTS.some((p) => p.id === pilotId)) return "b";
  if (HOUSE_AMARANTH_SECOND_LANCE_PILOTS.some((p) => p.id === pilotId)) return "b";
  return "a";
}

// ---- B2: assignable lances (5 Sep 2026) ---------------------------------
//
// lanceOfPilot above answers "where did this pilot ARRIVE", which is a pure
// function of static data and stays exactly as it was — every existing
// caller that wants the arrival batch still gets it. Everything below
// answers "where is this pilot NOW", which needs the save.
//
// Maxime's decisions on this feature, recorded here because the rules are
// not derivable from the code and a future reader will otherwise wonder:
//   - Lances are player-assignable for real, not derived from arrival.
//   - Hard cap of MAX_LANCE_SIZE per lance, matching the deploy cap.
//   - A Munti is a WARNING, not a save-block. The roster is exactly three
//     Muntis for three lances, so a required-Munti rule would (a) permit
//     exactly one legal arrangement and (b) permanently brick a lance the
//     first time a Munti is killed, in a permadeath game. canLaunchMission
//     already refuses a Munti-less squad at the point that matters, so the
//     block would add no safety and create a dead end. See
//     lanceFieldability below.
//   - A pilot's Mek follows them: Hub's workshop rooms read the live
//     assignment (lanceOfMekIn), so reassigning moves the Mek's NPC too.

/** The most pilots that may be assigned to one lance — matches the Transporter Pad's own deploy cap. */
export const MAX_LANCE_SIZE = 5;

/** Every lance id the system can represent. NOT the lances a given carrier has — see activeLanceIds. */
export const LANCE_IDS: readonly LanceId[] = ["a", "b", "c", "d", "e"];

/** The ceiling on how many lances one carrier can ever hold. Gladiator's number; this campaign stops at 3. */
export const MAX_LANCES = 5;

/**
 * Recruit Cap Rework (9 Sep 2026, Bloom_Wars_Recruit_Cap_Rework_Plan_v1.md).
 * How many lances the ROSTER can actually be recruited and assigned into,
 * starting Mission 1 — gated on cost alone (DISCRETIONARY_RECRUIT_COST, at
 * ROSTER & GEAR / the Campaign Shop), not on the Mission 12/24 story beat
 * lanceCount/state.lancesGranted still tracks below. 4 * MAX_LANCE_SIZE
 * (5) = 20, Maxime's own confirmed math ("you can have up to 20 pair
 * recruited but only able to fill the rooster of 5 in act 1 10 in act 2
 * and 15 in act 3" — deploy caps are untouched by this, see
 * TransporterPad.ts's ACT1/2/3_DEPLOY_CAP, this is the bench behind them).
 * Deliberately less than MAX_LANCES (5) — the 5th lance id stays
 * Gladiator-only, exactly as before this rework.
 */
export const RECRUITABLE_LANCES = 4;

/**
 * How many lances THIS carrier has been GRANTED, as its own story beat —
 * unchanged by the Recruit Cap Rework: one per act, advanced only by the
 * integrate*Lance functions below, on Mission 12/24's win. What
 * deriveRourkeRank and the Debrief "you've been given a lance" callout
 * read. It is NOT the roster's recruiting ceiling any more — see
 * RECRUITABLE_LANCES/activeLanceIds for that, and don't reach for this to
 * answer "which lances can I recruit into right now."
 *
 * Deliberately checks membership in the static arrival batches rather than
 * current assignment, so it stays correct after the player reshuffles
 * everyone — emptying 3rd Lance by moving its pilots elsewhere must not
 * delete the lance. Also counts permanently lost pilots, whose entries stay
 * in state.pilots, so losing an entire lance to casualties doesn't retract
 * the slot either.
 */
export function lanceCount(state: CampaignState): number {
  return Math.min(state.lancesGranted ?? derivedLanceCount(state), MAX_LANCES);
}

/** The pre-5-Sep-2026 rule: a lance existed because its authored batch was in the roster. Kept as the backfill for old saves. */
function derivedLanceCount(state: CampaignState): number {
  let n = 1;
  const has = (list: { id: string }[]) => list.some((p) => state.pilots[p.id] !== undefined);
  if (has(SECOND_LANCE_PILOTS) || has(HOUSE_AMARANTH_SECOND_LANCE_PILOTS)) n = 2;
  if (has(THIRD_LANCE_PILOTS) || has(HOUSE_AMARANTH_THIRD_LANCE_PILOTS)) n = 3;
  return n;
}

/**
 * The lances open for recruiting and assignment RIGHT NOW — every
 * roster/deploy UI's own "which lances exist" question. Recruit Cap
 * Rework, 9 Sep 2026: this is now a fixed shape, RECRUITABLE_LANCES from
 * Mission 1, deliberately decoupled from lanceCount/state.lancesGranted —
 * that's a separate, narrower fact about the Mission 12/24 story beat
 * (Rourke's rank, the Debrief callout), not the roster's own ceiling.
 * `state` stays a parameter for every existing call site (and in case a
 * future carrier type ever needs to vary this) even though the current
 * body doesn't read it. A lance being "active" here has never meant
 * "staffed" — see lanceRoster for who's actually in it, which can be
 * anywhere from empty to full independent of this.
 */
export function activeLanceIds(_state: CampaignState): LanceId[] {
  return LANCE_IDS.slice(0, RECRUITABLE_LANCES);
}

/** Display name for a lance, in the game's own voice. */
export function lanceDisplayName(lance: LanceId): string {
  return { a: "1st Lance", b: "2nd Lance", c: "3rd Lance", d: "4th Lance", e: "5th Lance" }[lance];
}

/**
 * Where this pilot is NOW: their assigned lance if the player has ever moved
 * them, otherwise the lance they arrived with. The single read path for
 * everything that cares about current membership.
 */
export function lanceOfPilotIn(state: CampaignState, pilotId: string): LanceId {
  return state.pilots[pilotId]?.lance ?? lanceOfPilot(pilotId);
}

/**
 * Everyone currently in `lance`. Living pilots only, and deliberately so:
 * per Maxime's call, a permanently lost pilot leaves the lance page entirely
 * and is recorded in the Vault's roll instead (scenes/ui/MemorialPanel.ts),
 * rather than being listed in two places.
 */
export function lanceRoster(state: CampaignState, lance: LanceId): CampaignPilotEntry[] {
  return Object.values(state.pilots).filter((e) => e.status === "active" && lanceOfPilotIn(state, e.pilot.id) === lance);
}

export interface LanceFieldability {
  /** Can this lance be sent on a mission as it stands? */
  fieldable: boolean;
  /** Player-facing reason it can't be, or undefined when it can. */
  warning?: string;
}

/**
 * Whether a lance could actually deploy, as a WARNING rather than a
 * constraint on saving it — see this section's header for why a hard Munti
 * requirement was rejected. Mirrors canLaunchMission's own Munti rule so the
 * roster screen and the deploy gate can never disagree about what's legal;
 * canLaunchMission remains the thing that actually enforces it.
 */
export function lanceFieldability(state: CampaignState, lance: LanceId): LanceFieldability {
  const roster = lanceRoster(state, lance);
  if (roster.length === 0) return { fieldable: false, warning: "empty — no one assigned" };
  const hasMunti = roster.some((e) => UNIT_ARCHETYPES[e.pilot.archetypeId]?.path === "munti");
  if (!hasMunti) return { fieldable: false, warning: "no Munti — this lance can't launch as it stands" };
  return { fieldable: true };
}

/**
 * Grant this carrier another lance — an EMPTY one, for the player to recruit
 * into. Idempotent and capped at MAX_LANCES.
 */
export function grantLance(state: CampaignState): boolean {
  const current = lanceCount(state);
  if (current >= MAX_LANCES) return false;
  state.lancesGranted = current + 1;
  return true;
}

/**
 * The authored candidates a player can recruit (5 Sep 2026; made
 * campaign-aware 6 Sep 2026 when House Amaranth adopted the same
 * recruit-pool shape). For a Warden save these are the ten pilots who
 * USED to be handed over as a finished 2nd and 3rd Lance — Okafor,
 * Solheim, Tarrant, Vashti, Reyes, Kova, Ness, Onwuka, Delgado, Yeun. For
 * a House Amaranth save it's that campaign's own ten — Kessler, Vantana,
 * Reyken, Solano, Marrin, Thorne, Kastan, Osei, Dunmore, Amsel. Rather
 * than delete ten written characters to make room for recruiting,
 * recruiting draws from them: you still choose your squad, and the ones
 * you pick are real people with real names instead of generated
 * placeholders. Which of them you end up with is now yours, and a campaign
 * where Solheim (or Kessler) never joined is a different campaign.
 *
 * baseSceneKeyFor's own "does pilot_rourke exist" check is the established
 * pattern for telling the two campaigns apart without a new field on
 * CampaignState — reused here rather than inventing a second detector.
 *
 * Once the pool is exhausted, recruiting generates pilots with names from
 * data/names.ts's RECRUIT_FIRST_NAMES/RECRUIT_SURNAMES instead, so the well never runs dry.
 */
export function recruitCandidates(state: CampaignState): PilotRecord[] {
  const authored =
    baseSceneKeyFor(state) === "Hub"
      ? [...SECOND_LANCE_PILOTS, ...THIRD_LANCE_PILOTS]
      : [...HOUSE_AMARANTH_SECOND_LANCE_PILOTS, ...HOUSE_AMARANTH_THIRD_LANCE_PILOTS];
  return authored.filter((p) => state.pilots[p.id] === undefined);
}

export type LanceAssignResult = { ok: true } | { ok: false; reason: string };

/**
 * Move `pilotId` into `lance`. The only rule enforced here is the size cap;
 * everything else is advisory (lanceFieldability). Writes the override even
 * when it matches the arrival batch, so a pilot deliberately put back where
 * they started stays put if the static arrays are ever edited.
 *
 * Does NOT save — callers batch their own saveCampaignState, same as every
 * other mutator in this file.
 */
/**
 * Trade two pilots' lances. The counterpart to assignPilotToLance, and NOT
 * optional sugar over it — without this the whole feature deadlocks.
 *
 * Found by live verification, 5 Sep 2026: the Warden roster is 15 pilots and
 * there are 3 lances capped at MAX_LANCE_SIZE (5), so from Act III onward
 * every lance is permanently at 5/5. Under a hard cap that means no move is
 * legal in any direction, and there is no "make room first" either, because
 * every other lance is full too. assignPilotToLance alone is usable at 5 and
 * 10 pilots and completely frozen at 15.
 *
 * A swap is exempt from the cap by construction — it never changes any
 * lance's size — so it's the operation that keeps a full roster editable.
 * Same-lance swaps are a no-op success rather than an error, since a UI
 * cycling through pilots can easily land on one.
 */
export function swapPilotLances(state: CampaignState, pilotIdA: string, pilotIdB: string): LanceAssignResult {
  const a = state.pilots[pilotIdA];
  const b = state.pilots[pilotIdB];
  if (!a || !b) return { ok: false, reason: "no such pilot" };
  if (a.status !== "active" || b.status !== "active") return { ok: false, reason: "both pilots must be on the active roster" };
  if (pilotIdA === pilotIdB) return { ok: true };
  const lanceA = lanceOfPilotIn(state, pilotIdA);
  const lanceB = lanceOfPilotIn(state, pilotIdB);
  if (lanceA === lanceB) return { ok: true }; // already together, nothing to trade
  a.lance = lanceB;
  b.lance = lanceA;
  return { ok: true };
}

export type RecruitIntoLanceResult = { ok: true; pilot: PilotRecord } | { ok: false; reason: string };

/**
 * Recruit one pilot into `lance` (5 Sep 2026). Takes an authored candidate by
 * id when one is named, otherwise the first available candidate, otherwise
 * generates a pilot with a pooled name.
 *
 * The recruit arrives with NO callsign — see awardCallsign. Free at the
 * point of this function: whether it costs company points is the caller's
 * business (scenes/shop/ShopPanel.ts owns the existing recruit economy), so
 * that a story-granted pilot and a bought one can share this path.
 */
export function recruitIntoLance(state: CampaignState, lance: LanceId, candidateId?: string): RecruitIntoLanceResult {
  if (!activeLanceIds(state).includes(lance)) {
    return { ok: false, reason: `${lanceDisplayName(lance)} isn't part of this campaign — up to ${RECRUITABLE_LANCES} lances can be recruited` };
  }
  if (lanceRoster(state, lance).length >= MAX_LANCE_SIZE) {
    return { ok: false, reason: `${lanceDisplayName(lance)} is full (${MAX_LANCE_SIZE} is the most that can deploy together)` };
  }

  const pool = recruitCandidates(state);
  const chosen = candidateId ? pool.find((p) => p.id === candidateId) : pool[0];
  if (candidateId && !chosen) return { ok: false, reason: "that candidate is no longer available" };

  let pilot: PilotRecord;
  if (chosen) {
    pilot = { ...chosen };
    state.pilots[pilot.id] = { pilot, status: "active", personalPoints: 0, lance };
    // The authored candidates arrive with their own written Meks. Merges
    // both campaigns' dictionaries unconditionally rather than branching by
    // baseSceneKeyFor like recruitCandidates does above — every mek id
    // across all four lists is globally unique (pilotRegistry.ts's own
    // flat MEK_INDEX merge depends on that already), so there's no
    // collision risk and one merged lookup is simpler than repeating the
    // branch.
    const mek = { ...SECOND_LANCE_MEKS, ...THIRD_LANCE_MEKS, ...HOUSE_AMARANTH_SECOND_LANCE_MEKS, ...HOUSE_AMARANTH_THIRD_LANCE_MEKS }[pilot.mekId];
    if (mek) state.meks[pilot.mekId] = { ...mek };
  } else {
    // Chassis randomized (9 Sep 2026 — see generatePilot's own header),
    // same fix as the other two generated-recruit paths: a story-granted
    // or fully-blind recruit through this branch used to always be human,
    // silently, same unwired-not-decided gap as the other two.
    pilot = generatePilot(state, randomFrom(ALL_RECRUITABLE_PATHS), randomChassisSuffix());
    state.pilots[pilot.id] = { pilot, status: "active", personalPoints: 0, lance };
  }
  return { ok: true, pilot };
}

export function assignPilotToLance(state: CampaignState, pilotId: string, lance: LanceId): LanceAssignResult {
  const entry = state.pilots[pilotId];
  if (!entry) return { ok: false, reason: "no such pilot" };
  if (entry.status !== "active") return { ok: false, reason: "that pilot is no longer on the active roster" };
  if (!activeLanceIds(state).includes(lance)) {
    return { ok: false, reason: `${lanceDisplayName(lance)} isn't part of this campaign — up to ${RECRUITABLE_LANCES} lances can be recruited` };
  }
  if (lanceOfPilotIn(state, pilotId) === lance) return { ok: true }; // already there, nothing to do
  if (lanceRoster(state, lance).length >= MAX_LANCE_SIZE) {
    return { ok: false, reason: `${lanceDisplayName(lance)} is full (${MAX_LANCE_SIZE} is the most that can deploy together)` };
  }
  entry.lance = lance;
  return { ok: true };
}

/**
 * The same answer for a pilot's MEK, by that mek's own id — which is what
 * Hub.ts actually holds when it seeds the Workshop rooms (a Mek NPC's
 * `pilotId` field is the MEK's id, not its pilot's; see Hub.ts's own
 * comment on that deliberate reuse). Walks the same six static lists by
 * `mekId` instead of `id`, so it stays correct for both campaigns without
 * the caller needing to resolve mek -> pilot first.
 */
export function lanceOfMek(mekId: string): LanceId {
  if (THIRD_LANCE_PILOTS.some((p) => p.mekId === mekId)) return "c";
  if (HOUSE_AMARANTH_THIRD_LANCE_PILOTS.some((p) => p.mekId === mekId)) return "c";
  if (SECOND_LANCE_PILOTS.some((p) => p.mekId === mekId)) return "b";
  if (HOUSE_AMARANTH_SECOND_LANCE_PILOTS.some((p) => p.mekId === mekId)) return "b";
  return "a";
}

/**
 * B2 — where a MEK's workshop is now, following its pilot's live lance
 * assignment (Maxime's call: "the Mek follows the pilot"). Resolves the mek
 * to its owning pilot through the same seven static lists lanceOfMek walks
 * (six until 6 Sep 2026's House Amaranth Third Lance addition), then asks
 * lanceOfPilotIn.
 *
 * Falls back to lanceOfMek for any mek whose pilot can't be resolved — a
 * generated recruit's mek, or a mek id that isn't in the static roster at
 * all — so this can never return a worse answer than the static version it
 * replaces at Hub's workshop-seeding call site.
 */
export function lanceOfMekIn(state: CampaignState, mekId: string): LanceId {
  for (const list of [
    WARDEN_PILOTS,
    SECOND_LANCE_PILOTS,
    THIRD_LANCE_PILOTS,
    HOUSE_AMARANTH_PILOTS,
    HOUSE_AMARANTH_SECOND_LANCE_PILOTS,
    HOUSE_AMARANTH_THIRD_LANCE_PILOTS,
  ]) {
    const owner = list.find((p) => p.mekId === mekId);
    if (owner) return lanceOfPilotIn(state, owner.id);
  }
  return lanceOfMek(mekId);
}

/**
 * Mutates state.rourkeRank in place to match deriveRourkeRank, if it
 * doesn't already — see the section header above for why this exists and
 * why it's safe to run unconditionally on every load. A no-op the
 * overwhelming majority of the time (any campaign played entirely after
 * this fix already has the right rank set by integrateSecondLance/
 * integrateThirdLance themselves); only actually corrects anything for a
 * save that predates this pass.
 */
function backfillRourkeRank(state: CampaignState): void {
  const derived = deriveRourkeRank(state);
  if (state.rourkeRank !== derived) state.rourkeRank = derived;
}

/**
 * 28 Aug 2026 (Main Menu / Save / Ironman UI Plan v1 §6) — a save written
 * before `CampaignState.ironman` existed has no field at all, and its real
 * behavior has always been "one continuously-overwriting key, no manual
 * saves" — exactly what `ironman: true` means. Backfilling to `true` rather
 * than `false` keeps that save's actual behavior unchanged on load, instead
 * of quietly granting it a feature (manual saves) it was never built with.
 * Same pure-in-memory-correction shape as backfillRourkeRank above.
 */
function backfillIronman(state: CampaignState): void {
  if (state.ironman === undefined) state.ironman = true;
}

/** Telemetry pass (1 Sep 2026) — a save from before `campaignId` existed gets one minted on first load, same pure-in-memory shape as the two backfills above. Persists on the next save. */
function backfillCampaignId(state: CampaignState): void {
  if (!state.campaignId) state.campaignId = mintRandomId();
}

/**
 * B6, 5 Sep 2026 — a save written before `companyName` existed gets the name
 * that side was actually always displayed under, so nothing a player has
 * been looking at for weeks silently changes or blanks out. Side is decided
 * by baseSceneKeyFor's own rule (Warden has pilot_rourke, House Amaranth
 * doesn't) rather than a second discriminator that could disagree with it.
 * Also repairs a whitespace-only name, which is the one thing a text field
 * can produce that would otherwise render as an empty header.
 */
/**
 * B2 recruiting pass, 5 Sep 2026 — a save written before `lancesGranted`
 * existed has its lance count implied by which authored batches are in its
 * roster, which is exactly what derivedLanceCount computes. Backfilling it
 * means an in-progress campaign keeps every lance and every pilot it already
 * had, and never sees the new empty-lance behavior retroactively applied to
 * lances it was already given.
 */
function backfillLancesGranted(state: CampaignState): void {
  if (state.lancesGranted === undefined) state.lancesGranted = derivedLanceCount(state);
}

function backfillCompanyName(state: CampaignState): void {
  if (!state.companyName || !state.companyName.trim()) {
    state.companyName = state.pilots["pilot_rourke"] ? DEFAULT_WARDEN_COMPANY_NAME : DEFAULT_HOUSE_AMARANTH_COMPANY_NAME;
  }
}

/**
 * Calendar economy pass (2 Sep 2026) — a save written before `calendarDay`
 * existed heals to day 1 on first load. Same pure-in-memory shape as the
 * three backfills above.
 *
 * Day 1 rather than any attempt to reconstruct elapsed time is the honest
 * answer, not a shortcut: the clock this field tracks is real time spent in
 * the Hub and in Battle, and a pre-calendar save recorded none of that
 * anywhere. There is no signal to reconstruct from, so inventing a plausible
 * number would be fabricating campaign history. A returning player's old
 * campaign starts counting from today; the alternative is a made-up figure
 * that reads authoritative and isn't.
 *
 * Guards NaN/negative as well as undefined — calendarDay is arithmetic-
 * accumulated every frame, so a single corrupt write would otherwise poison
 * every later tick (NaN + anything is NaN, forever, with no way back).
 */
function backfillCalendarDay(state: CampaignState): void {
  if (typeof state.calendarDay !== "number" || !Number.isFinite(state.calendarDay) || state.calendarDay < 1) {
    state.calendarDay = 1;
  }
}

// ---- 9. Mission real-time clock (25 Aug 2026) ---------------------------
//
// Maxime: "add a clock timer to how long you take to do missions. add that
// timer as something soldier keep track of(social part) force a failed
// mission if you take more than 12hour to do the mission. its lore
// acurate. 12hour real time btw. from the computer or web clock."
//
// Checked the actual repo before proposing anything: nothing before this
// pass persisted a mission attempt at all — scenes/TransporterPad.ts's
// BEAM DOWN never wrote to CampaignState, only scenes/Debrief.ts (a
// mission actually finishing) and scenes/Hangar.ts (the shop) ever called
// saveCampaignState. Closing the tab mid-mission simply forgot the attempt
// existed. Flagged that back to Maxime as the real fork this ask turns on
// — track the clock only while the tab happens to stay open (cheap, but
// doesn't match "started this morning, back tonight"), or persist it
// properly. He picked persistence, "from the biginin of the save data" —
// this field lives in CampaignState itself, saved/loaded through the same
// localStorage blob as everything else, not a separate mechanism.
//
// On cost: asked directly whether a timeout should carry full loss weight
// (permadeath rolls, same as a real defeat) or something lighter. Maxime:
// "they are forcefully recalled to ship for a dressing down by the co." —
// narratively a real consequence (Command's patience, not nothing), but
// mechanically the soft option: no permadeath, no earnings (the mission
// never actually happened), roster untouched. See applyMissionTimeout.

/** 12 real hours, in milliseconds — Command's own operational window before a lance that's gone quiet gets recalled rather than left hanging. Deliberately real, wall-clock time, not a turn count: house rule #5 (README) already covers in-mission turn pressure ("eliminate_all has no turn-limit fail condition... give player more freedom"); this is a different axis, how long you've kept Command waiting, not how the fight itself went. */
export const MISSION_REAL_TIME_LIMIT_MS = 12 * 60 * 60 * 1000;

export interface MissionTimeoutResult {
  timedOut: boolean;
  missionId?: string;
  elapsedMs?: number;
}

/**
 * Pure check, same evaluate/apply split evaluatePermadeathCheck/
 * applyPermadeathCheck already use above: reads state, mutates nothing.
 * `now` is passed in rather than read internally via Date.now() so a test
 * can assert the exact 12-hour boundary without actually waiting 12 hours
 * — the one live caller (scenes/Boot.ts) passes the real Date.now().
 */
export function evaluateMissionTimeout(state: CampaignState, now: number): MissionTimeoutResult {
  const attempt = state.activeMissionAttempt;
  if (!attempt) return { timedOut: false };
  const elapsedMs = now - attempt.startedAt;
  if (elapsedMs < MISSION_REAL_TIME_LIMIT_MS) return { timedOut: false };
  return { timedOut: true, missionId: attempt.missionId, elapsedMs };
}

/**
 * Applies a timed-out attempt as a stand-down — clears activeMissionAttempt
 * so the same mission can be relaunched immediately with a fresh clock,
 * same as if this attempt had never happened. Deliberately does NOT touch
 * pilots, points, or personalPoints: no permadeath roll (the squad was
 * never actually in the fight when the clock ran out — nothing to roll
 * against), no earnings (nothing was accomplished). The only real cost is
 * narrative — Command's own read on you — which scenes/Boot.ts surfaces as
 * the recall notice, not anything this function tracks. A no-op, safe to
 * call speculatively, when evaluateMissionTimeout would already say false.
 */
export function applyMissionTimeout(state: CampaignState, now: number): MissionTimeoutResult {
  const result = evaluateMissionTimeout(state, now);
  if (result.timedOut) state.activeMissionAttempt = undefined;
  return result;
}

// ---- 10. Commander down — voiding a mission attempt ---------------------
//
// Independent Campaign doc §6a, Maxime's own words: "the mc only has plot
// armor becasuse if she dies the missions failed and its back to mission
// briefing." Not the Munti-gated permadeath outcome sections 1 & 3 above
// cover, and not the old, wrong "exempt from permadeath — always a
// standard restock" framing evaluatePermadeathCheck's own exempt branch
// used to mean in practice (see that branch's own updated comment) — a
// third, distinct outcome. engine/mission.ts's Mission.handleDowned()
// checks PilotRecord.exemptFromPermadeath BEFORE ever calling
// evaluatePermadeathCheck and short-circuits straight to
// MissionOutcome "commander_down" the instant that pilot goes down.
// Nothing about that attempt resolves — no permadeath roll, no earnings,
// no roster change — the same "costs nothing mechanical" shape
// applyMissionTimeout above already established for a 12-hour recall.
// This function is that shape's other half: the one piece of actual
// CampaignState mutation a commander-down attempt needs.
//
// Called once, from scenes/Battle.ts, the instant its own overlay first
// draws for a commander_down outcome (mirrors scenes/Debrief.ts clearing
// this same field unconditionally the moment a mission resolves for real
// — see that scene's own step 1a comment). Deliberately no evaluate/apply
// split the way evaluateMissionTimeout/applyMissionTimeout above have one:
// there's nothing to evaluate here — Battle.ts already knows
// mission.outcome is "commander_down" by the time it calls this, so this
// is unconditional by design, not a check.
export function applyCommanderDownAttempt(state: CampaignState): void {
  state.activeMissionAttempt = undefined;
}

// ---- 11. Hub social state — persistent Favorability/Stress/Morale/
// relationship/social-log (26 Aug 2026) ----
//
// Closes the gap Hub.ts's own file header flagged from the day the Antfarm
// shipped: "this scene uses LOCAL, scene-only pilot state for Stress/
// Morale/drunk/catalyst and for Favorability... none of it reads from or
// writes to CampaignState/PilotRecord." Maxime picked this over three other
// options (a Phase 4 design doc, closing a different flagged gap, or
// something else) when asked "go next" after the Iyari romanceable bug fix
// — "Persistent hub state (Recommended)."
//
// Deliberately NOT everything Hub.ts tracks locally. Two exclusions, both
// on purpose, not an oversight:
//   - ambient.drunk stays scene-only. There is no "sober up" mechanic
//     anywhere in the game — shareADrink sets it true and nothing ever sets
//     it back false. Persisting it would turn a transient scene effect into
//     a permanent one-way flag the instant a player shares one drink, which
//     is a real behavior change, not a neutral persistence upgrade.
//   - ambient.catalyst stays scene-only too, but for a different reason:
//     it's fixed per-pilot identity data (NPC_SEED's own placeholder pick,
//     e.g. Bosk = raven), not state that changes over a campaign. NPC_SEED
//     already reconstructs the same value every load; there's nothing to
//     persist because nothing about it ever moves.
//
// Favorability/socialLog/inRelationship ARE actively mutated today (six
// call sites in Hub.ts: shareADrink, askOut's three branches, and the
// three minigame-finish methods). Stress/Morale are included too even
// though nothing currently writes them — this gives them a real persisted
// home now, rather than leaving a second migration to do later once some
// future Stress-relief verb (CO Check-in, Phase 3+, per verbs.ts's own
// VerbOutcome comment) actually needs one.
//
// drunkUntil, 26 Aug 2026 — added the same day the "no sober-up mechanic"
// exclusion above was written, once Maxime gave drunk one: "drunk should
// last for a bit." That's exactly the missing piece the original exclusion
// was waiting on — with a real expiry, persisting it stopped being "makes
// a transient effect permanent" and became "makes a temporary effect
// survive a reload correctly," so it moved from excluded to included.
// Epoch ms (Date.now()), same clock as SocialLogEntry.at; undefined means
// not drunk. Hub.ts derives HubNpc.ambient.drunk from whether this is
// still in the future — see buildNpcs() and the new updateDrunkExpiry().
export interface HubPilotSocialState {
  favorability: number;
  stress: number;
  morale: number;
  inRelationship: boolean;
  socialLog: SocialLogEntry[];
  drunkUntil?: number;
  // Stage-promotion "graduation" reveal, 27 Aug 2026 — see
  // data/ambientLines.ts's detectStagePromotion and Hub.ts's buildNpcs()/
  // speak()/ackStagePromotion for the full design. Records the last Stage
  // this pilot's promotion was actually surfaced to the player for, so a
  // real stage change (buildNpcs() compares this against the pilot's
  // current live-tier-derived stage every load) can be told apart from
  // "nothing changed" or "an old save that predates this field entirely."
  // Undefined means neither has happened yet — buildNpcs() backfills it to
  // the CURRENT stage the first time it sees that, rather than assuming a
  // promotion is pending for a change that may have happened before this
  // feature ever shipped.
  lastAcknowledgedStage?: Stage;
  // "Hello, Sir" rank-deference greeting, 27 Aug 2026 (Maxime's wishlist:
  // "plugging in Hello, SIr from lower ranked to higher rank"). Same shape
  // as lastAcknowledgedStage just above, one axis over: records the last
  // rourkeRank this pilot's deference line was actually surfaced for, so
  // buildNpcs() can tell a real promotion from "nothing changed" or "an old
  // save predating this field." See data/ambientLines.ts's
  // detectRankPromotion and Hub.ts's ackRankGreeting for the rest of the
  // design — deliberately its own field rather than reusing
  // lastAcknowledgedStage, since Rourke's rank and a pilot's own Stage are
  // two independent axes (a pilot's gear tier says nothing about whether
  // THEY'VE personally clocked Rourke's latest promotion).
  lastAcknowledgedRourkeRank?: Rank;
  // Munti-loss hot topic, 27 Aug 2026 (roadmap #13) — lives on the LOST
  // pilot's own social entry, not on each observer's, since this is a
  // single one-time crew-wide event ("a Munti died"), not a per-observer
  // axis the way lastAcknowledgedStage/lastAcknowledgedRourkeRank are (each
  // of those tracks what THIS pilot has personally caught up on). A boolean
  // is enough — unlike the Stage/Rank fields above, there's nothing to
  // compare against, just "has this already been surfaced as a hot topic."
  // Set by scenes/Debrief.ts the instant a permanent loss lands on a Munti-
  // path pilot (mirroring this same file's evaluatePermadeathCheck: the
  // only way a loss is ever permanent is "no living Munti remained to save
  // them" — so every muntiLost hot topic is, by construction, honestly
  // describing that exact mechanic, not a scripted beat bolted on after the
  // fact). Consumed by scenes/Hub.ts's buildNpcs(), which registers the
  // actual HotTopic and flips this true in the same pass — see that
  // function's own comment for why this can't reuse the
  // pendingStagePromotion per-NPC-field shape (the pilot this is ABOUT is
  // no longer in the Hub to self-announce it).
  muntiLossAnnounced?: boolean;
  // Mek retirement hot topic, 29 Aug 2026 (Mek NPC Introduction Plan v1
  // §4) — same one-shot shape as muntiLossAnnounced just above, and the
  // same reason it lives here rather than on the Mek: a Mek has no
  // CampaignPilotEntry of its own (a mekId is not a pilotId — see
  // CampaignState.meks), so there's nowhere else to hang "has this
  // already been surfaced" off of. Lives on the pilot whose death actually
  // triggered the retirement (their own Mek's match), set the instant
  // scenes/Hub.ts's checkMekRetirement() registers the hot topic —
  // mirrors checkMuntiLoss()'s own save-immediately discipline exactly.
  mekRetirementAnnounced?: boolean;
  // Heirloom recall hot topic, 2 Sep 2026 — same one-shot shape as the two
  // flags above, and it lives on the aristocrat's own entry for the same
  // reason mekRetirementAnnounced lives on the dead pilot's: an Heirloom
  // has no CampaignPilotEntry, and the pilot whose death triggered the
  // recall is the only party to the event that does. Set the instant
  // scenes/Hub.ts's checkHeirloomRecall() registers the topic.
  heirloomRecallAnnounced?: boolean;
  // Real Stage-promotion timestamps, 28 Aug 2026 (Maxime, closing the
  // STAGE_MOMENT gap flagged in the Recall Item 3 delivery: "highlight
  // reel should date itself with calandar. down to the sec."). Distinct
  // from lastAcknowledgedStage above on purpose — that field tracks what
  // the PLAYER has been shown, a UI-consumption flag; this one tracks when
  // the promotion actually, really happened, epoch ms, written once by
  // engine/campaignEconomy.ts's purchaseTierUpgrade at the real moment a
  // purchase crosses a Stage boundary, never backfilled or guessed at
  // later. Keyed by the Stage reached — nothing promotes INTO green (see
  // detectStagePromotion's own comment in data/ambientLines.ts), so at
  // most two keys, "blooded" and "command", ever exist. Feeds both the
  // Highlights reel (data/highlights.ts's buildStagePromotionMilestones)
  // and the {STAGE_MOMENT} recall slot (data/crewBanterSlots.ts).
  stagePromotedAt?: Partial<Record<Stage, number>>;
  // Insult escalation ladder, 2 Sep 2026 (Praise/Insult/Apology Proposal
  // v1 §3, socialActions.ts's own INSULT_TIER2_COUNT/INSULT_TIER3_COUNT).
  // Lifetime count of Insult verb uses against this pilot specifically —
  // never decremented, not reset by a later Apology (an apology repairs
  // Favorability, it doesn't erase the fact that the insults happened;
  // see INSULT_TIER3_FAVORABILITY_CEILING for how genuine amends still
  // matter — a pilot who's been apologized back up past that ceiling won't
  // trip Tier 3 even at a high lifetime count).
  insultsGiven?: number;
  // Insult Tier 3 — the real standoff. Set true the instant a pilot's
  // insultsGiven crosses INSULT_TIER3_COUNT while their Favorability is
  // still at or below INSULT_TIER3_FAVORABILITY_CEILING. Maxime's own
  // resolution of the proposal doc's §3a fork: "wont fly with you, player
  // will have to ask co to remove them from ship" — so this flag alone
  // blocks deployment (TransporterPad.ts's roster filter) immediately,
  // but never resolves on its own. Only scenes/Hub.ts's
  // handleRemovePilotRequest (a deliberate CO conversation) clears it, by
  // setting this pilot's CampaignPilotEntry.status to "reassigned" —
  // Apology alone can raise Favorability back up but can never clear this
  // flag once it's set.
  refusesDeployment?: boolean;
  // One-shot gate so the CO's Tier-3 call-out line (socialActions.ts's
  // CO_CALLOUT_LINES) fires exactly once per standoff, the next time the
  // player talks to him — same shape as muntiLossAnnounced/
  // mekRetirementAnnounced above, one section up in spirit if not in code
  // order (this one's new, 2 Sep 2026, added down here since it's part of
  // the same Insult-ladder cluster as the two fields just above it).
  coCalloutGiven?: boolean;
  // Emotional Brain, 12 Sep 2026 (claude/Bloom_Wars_Emotional_Brain_Build_
  // Plan_v1_12Sep2026.md). Three optional, additive fields, so every save
  // that predates them loads unchanged and gets them on first write.
  //
  // memories — the Ledger (data/memories.ts): what this pilot carries.
  // Written by engine/debriefCatalyst.ts at Debrief (combat) and by
  // scenes/Hub.ts at the real Hub events (blowup, breakdown, the verbs
  // that leave a mark). Capped at MEMORY_CAP, weakest evicted. Read by the
  // Archive dossier's "Carries" block, the Highlights reel, the recall
  // slots, and echoDrift's own nudges.
  memories?: MemoryEntry[];
  // echoDrift — the pilot's own lean on top of their archetype's
  // (data/echoLean.ts): love/fear/anger/sadness, each 0..ECHO_DRIFT_CAP,
  // nudged by every memory written, relaxed toward zero as in-game days
  // pass. Undefined reads as all-zero (the archetype's base row alone).
  echoDrift?: EchoWeights;
  // echoDriftDay — the in-game calendar day echoDrift was last relaxed,
  // so the next writer knows how many days to relax it by. Undefined
  // means "never relaxed yet": the first writer stamps today and relaxes
  // nothing.
  echoDriftDay?: number;
}

/**
 * Pure-ish evaluate/apply-style helper, same family as
 * evaluatePermadeathCheck/evaluateMissionTimeout above, except this one
 * legitimately writes on a miss: state.pilots[pilotId].social is created,
 * seeded from `seed`, and attached to the entry the FIRST time this is
 * called for a given pilot (a brand-new campaign, or an old save from
 * before 26 Aug 2026) — every call after that just hands back the same
 * object already sitting there. Hub.ts's buildNpcs() calls this once per
 * seeded NPC and keeps the returned object's array (socialLog) as the
 * exact array HubNpc.socialLog points at, so a push into one is a push
 * into the other with no separate sync step; favorability/stress/morale/
 * inRelationship are plain numbers/booleans copied by value, so Hub.ts's
 * persistNpcSocial() re-copies those back in after every mutation, right
 * before calling saveCampaignState.
 *
 * A pilotId with no CampaignPilotEntry — the ship's CO, and every Mek — is
 * kept in CampaignState.npcSocialStates instead (7 Sep 2026). It used to get
 * a fresh unattached object every call, which meant persistNpcSocial wrote
 * the CO's and the Meks' favorability into something nobody held and the
 * save that followed dropped it on the floor. Same behaviour for callers
 * either way: ask, get the object, mutate it, save. The difference is that
 * it is still there next load.
 */
export function ensureHubSocialState(
  state: CampaignState,
  pilotId: string,
  seed: { favorability: number; stress: number; morale: number }
): HubPilotSocialState {
  const entry = state.pilots[pilotId];
  if (!entry) {
    // Not on the roster (the CO, any Mek) — keep it in the side table so it
    // survives a reload, instead of handing back an orphan nobody holds.
    const table = (state.npcSocialStates ??= {});
    return (table[pilotId] ??= {
      favorability: seed.favorability,
      stress: seed.stress,
      morale: seed.morale,
      inRelationship: false,
      socialLog: [],
    });
  }
  if (!entry.social) {
    entry.social = { favorability: seed.favorability, stress: seed.stress, morale: seed.morale, inRelationship: false, socialLog: [] };
  }
  return entry.social;
}

/** Queue a hot topic for the Hub to pick up on its next visit — see CampaignState.pendingHotTopics. */
export function queuePendingHotTopic(state: CampaignState, topic: HotTopic): void {
  (state.pendingHotTopics ??= []).push(topic);
}

/** Take every queued topic (oldest first) and clear the mailbox. Empty on any save that never had one. */
export function drainPendingHotTopics(state: CampaignState): HotTopic[] {
  const out = state.pendingHotTopics ?? [];
  state.pendingHotTopics = undefined;
  return out;
}

// ---- 12. Persistent NPC-to-NPC social state — pairwise bonds and
// NPC-to-NPC relationship pairing (26 Aug 2026, the background social-sim
// harness — engine/socialSim.ts) ----
//
// npcBonds.ts's own header already drew this axis: HubNpc.favorability
// (and this file's own HubPilotSocialState.favorability, section 11 above)
// is a pilot's standing with the PLAYER — every existing verb (Share a
// Drink, the three minigames, Ask Out) reads and writes THAT number. A
// "bond" is a different axis entirely: NPC A's standing with NPC B, which
// has nothing to do with either of their standing with Rourke. Hub.ts's
// own NPC_BOND_SEED constant is exactly that axis, but scene-local and
// frozen — seeded once when the Hub scene is built, thrown away when the
// scene closes, never moved by anything (npcBonds.ts's own header: "seeded
// once and held fixed... nothing in this file changes a bond value, only
// reads them"). This section is what makes that axis actually persistent,
// so a background sim day can move a bond and have the next simulated day
// — or the next time the Hub scene itself loads — see the result.
//
// Deliberately top-level on CampaignState, not nested per-pilot the way
// section 11 is: a bond belongs to a PAIR, not to either pilot alone, so
// there's no single CampaignPilotEntry to hang it off the way
// ensureHubSocialState hangs Favorability off one pilot's own entry.
// Keyed via npcBonds.ts's own pairKey(idA, idB) — the same sorted-join
// shape Hub.ts's NPC_BOND_SEED already uses, so a value seeded from that
// exact constant round-trips through this store with no re-keying step.
//
// relationships is the NPC-to-NPC analog of HubPilotSocialState.
// inRelationship — a list of pairKeys currently "together." Kept as a
// separate array rather than a boolean per pilot because a pilot's
// relationship status alone doesn't say WHO they're with, which
// engine/socialSim.ts needs (to know a pairing already exists before it
// can ever propose breaking one up — not modeled this pass, see that
// file's own header).
export interface NpcSocialState {
  bonds: Record<string, number>; // pairKey(idA, idB) -> bond value
  relationships: string[]; // pairKeys currently "together," NPC-to-NPC only — never includes the player
}

/**
 * Same "seed once, hand back the same object after" pattern as
 * ensureHubSocialState above, except there's exactly one of these per
 * CampaignState rather than one per pilot, so there's no missing-entry
 * case to fail open on the way ensureHubSocialState does. `seed` is
 * normally Hub.ts's own NPC_BOND_SEED, passed in by the caller rather than
 * imported here — this file is plain engine code with no scenes/ import,
 * same discipline as every other file in this module (see the file's own
 * header on CampaignPilotEntry.pilot being a full copy rather than an id
 * resolved through a different layer). A bond pair missing from both the
 * live state and the seed reads as 0 (npcBonds.ts's own bondValue already
 * treats an absent key as neutral), so `seed` only matters the very first
 * time this is called for a given save.
 */
export function ensureNpcSocialState(state: CampaignState, seed: Record<string, number> = {}): NpcSocialState {
  if (!state.npcSocial) {
    state.npcSocial = { bonds: { ...seed }, relationships: [] };
  }
  return state.npcSocial;
}

/**
 * Rec Room Standings, slice 2 — same "seed once, hand back the same object
 * after" shape as ensureNpcSocialState directly above, and for the same
 * reason: every save that predates this field has none, and there is
 * exactly one of these per CampaignState rather than one per pilot.
 *
 * There is no seed argument here because there is nothing to seed. A
 * pilot with no record has played nothing, which is the correct starting
 * truth for everyone — including the crew who were already aboard before
 * this system existed. Their skill starts at 0 and climbs from their
 * first real session, and that reads as honest rather than as a gap:
 * nobody has a record at a game the ship never kept score at.
 */
export function ensureRecRoomState(state: CampaignState): RecRoomState {
  if (!state.recRoom) {
    state.recRoom = { records: {} };
  }
  return state.recRoom;
}
