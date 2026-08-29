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
import type { MekArchetype, MekTrack, Path, PilotRecord } from "../data/types";
import type { Stage } from "../data/ambientLines";
import { UNIT_ARCHETYPES } from "../data/units";
import { WARDEN_PILOTS, WARDEN_MEKS, SECOND_LANCE_PILOTS, SECOND_LANCE_MEKS, THIRD_LANCE_PILOTS, THIRD_LANCE_MEKS } from "../data/campaignAmaranth";
import { findPilot } from "../data/pilotRegistry";
import type { SocialLogEntry } from "../data/verbs";
import type { BattleUnit } from "./units";

// ---- 4. Campaign-persistent roster state ----------------------------

export type PilotStatus = "active" | "permanently_lost";

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
  // Section 12 below (26 Aug 2026) — persistent NPC-to-NPC bonds and
  // pairing, for the background social-sim harness. Optional for the same
  // reason `social` on CampaignPilotEntry is: every save from before this
  // date, and every fresh createCampaignState() call, has none yet;
  // ensureNpcSocialState() is the only thing that ever creates it.
  npcSocial?: NpcSocialState;
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
  const state: CampaignState = { points: startingPoints, pilots: {}, meks: {}, nextGeneratedId: 1, rourkeRank: "2nd_lt", ironman: true };
  for (const p of pilots) state.pilots[p.id] = { pilot: { ...p }, status: "active", personalPoints: 0 };
  for (const [id, m] of Object.entries(meks)) state.meks[id] = { ...m };
  return state;
}

/** The live campaign's actual starting state (Warden Company, data/campaignAmaranth.ts — the non-archived roster; data/campaign.ts's Team One slice is intentionally untouched by this whole pass). */
export function createWardenCampaignState(startingPoints = 0): CampaignState {
  return createCampaignState(WARDEN_PILOTS, WARDEN_MEKS, startingPoints);
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

/** Real localStorage when it exists (the browser build), the caller's injected storage (tests), or null (headless Node — npm run sim / npm test) — never throws either way. */
function resolveStorage(storage?: CampaignStorage): CampaignStorage | null {
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
  return { ok: true };
}

// ---- 6. Emergency Munti replacement + discretionary recruiting ---------
// Two functions, deliberately different guarantees (campaign doc's own
// split): the emergency track is what makes the deploy gate above safe to
// have at all — without it, a roster that hits zero living Muntis could
// never launch another mission, a spreadsheet dead end instead of a story
// beat. The discretionary track is an ordinary points-shop purchase and is
// allowed to fail.

const RECRUIT_CALLSIGNS = ["Sprocket", "Halfmoon", "Thistle", "Coldsnap", "Marrow", "Windup", "Juniper", "Rattler", "Fenwick", "Hollow"];

/** Cycles the small callsign pool, appending a generation number once it wraps ("Sprocket", ... "Hollow", "Sprocket 2", ...) so every generated pilot's name stays unique without needing an ever-growing name list. Placeholder identity scheme — meant to be replaced by real character creation (name/portrait/chassis choice) per the design docs' own "still open" note. */
function generateCallsign(n: number): string {
  const base = RECRUIT_CALLSIGNS[(n - 1) % RECRUIT_CALLSIGNS.length];
  const cycle = Math.floor((n - 1) / RECRUIT_CALLSIGNS.length);
  return cycle === 0 ? base : `${base} ${cycle + 1}`;
}

// A generated recruit's mek needs *some* primary track (MekTrack is
// required, non-nullable — PilotRecord/MekArchetype have no real concept
// of "unassigned"). Rather than pick arbitrarily, this follows the one
// existing pattern in the data: every named pilot of a given class in
// PILOTS/WARDEN_PILOTS combined uses a consistent primary track, except
// Meeps, which is mixed (Nagori/Rourke: Runemaster, Iyari: Armorer, Trav:
// Fabricator) — Armorer is picked there as the flattest, no-special-
// interaction default for a generic rookie.
const CLASS_DEFAULT_MEK_TRACK: Record<Path, MekTrack> = {
  munti: "fieldwright", // both named Muntis (Barasj, Lask) — the class's defining support track
  tank: "armorer", // both named Tanks (Thyns, Bosk)
  reeps: "runemaster", // both named Reeps (Tourignie, Anand)
  meeps: "armorer", // mixed precedent — see comment above
};

// data/units.ts archetype ids are arch_<class>_<suffix>, where suffix is
// "bipedal"/"centauroid"/"vibrissal" — NOT the Chassis type's own value
// ("bipedal_vibrissal"), which is why this is its own small type rather
// than importing Chassis from data/types. Kept local to this file since
// nothing else needs it.
type ArchetypeChassisSuffix = "bipedal" | "centauroid" | "vibrissal";

/** Shared by both recruit paths below: mints a brand-new baseline G-tier pilot (and a fresh, unassigned-track-default mek) of the given class and adds both to the campaign state. Never reuses a lost pilot's identity, tier, or mek — a genuinely new record, so there is nothing to carry over by construction (rule 6's own point). `chassisSuffix` defaults to "bipedal" — every existing call site (checkMuntiGuarantee, recruitDiscretionary) is unaffected; only generateRandomRescuedPilot below passes a rolled value. */
function generatePilot(state: CampaignState, targetClass: Path, chassisSuffix: ArchetypeChassisSuffix = "bipedal"): PilotRecord {
  const n = state.nextGeneratedId;
  state.nextGeneratedId += 1;
  const callsign = generateCallsign(n);
  const pilotId = `pilot_recruit_${n}`;
  const mekId = `mek_recruit_${n}`;

  const mek: MekArchetype = {
    id: mekId,
    displayName: `${callsign}'s Mek`,
    primary: CLASS_DEFAULT_MEK_TRACK[targetClass],
    secondary: null,
    spareParts: 0,
  };
  state.meks[mekId] = mek;

  // arch_${class}_bipedal is every class's "standard" archetype — the same
  // convention data/units.ts's own HOSTILE_MECHS comment describes ("All
  // four use the standard bipedal archetypes," Data Pack §9). Every OTHER
  // caller of this function still gets exactly that (chassisSuffix defaults
  // to "bipedal"); only a rescue-generated recruit's chassis is ever
  // anything else.
  const pilot: PilotRecord = {
    id: pilotId,
    displayName: `Recruit "${callsign}"`,
    archetypeId: `arch_${targetClass}_${chassisSuffix}`,
    mekId,
    tier: "G",
  };
  state.pilots[pilotId] = { pilot, status: "active", personalPoints: 0 };
  return pilot;
}

const ALL_RECRUITABLE_PATHS: Path[] = ["meeps", "tank", "reeps", "munti"];
const ALL_CHASSIS_SUFFIXES: ArchetypeChassisSuffix[] = ["bipedal", "centauroid", "vibrissal"];

/**
 * Mission 5's rescue-and-recruit bonus objective (Maxime, 23 Aug 2026 —
 * asked whether a rescue should hand back a fixed class or a real wildcard:
 * "Chassis and class, both random." — a genuinely different guarantee from
 * both existing recruit paths above: checkMuntiGuarantee always wants a
 * Munti, recruitDiscretionary lets the PLAYER choose the class; this is the
 * only one where NEITHER axis is chosen by anything except an equal-odds
 * roll). Call this once, only when a Mission's rescueOutcome reads
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
  const chassisSuffix = ALL_CHASSIS_SUFFIXES[Math.floor(Math.random() * ALL_CHASSIS_SUFFIXES.length)];
  return generatePilot(state, targetClass, chassisSuffix);
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
 */
export function checkMuntiGuarantee(state: CampaignState): MuntiGuaranteeResult {
  if (countActiveMuntis(state) > 0) return { recruited: false };
  const pilot = generatePilot(state, "munti");
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
 */
export function recruitDiscretionary(state: CampaignState, targetClass: Path): RecruitResult {
  if (state.points < DISCRETIONARY_RECRUIT_COST) {
    return {
      ok: false,
      reason: `not enough points — recruiting a ${targetClass} pilot costs ${DISCRETIONARY_RECRUIT_COST}, campaign has ${state.points}.`,
    };
  }
  state.points -= DISCRETIONARY_RECRUIT_COST;
  const pilot = generatePilot(state, targetClass);
  return { ok: true, pilot };
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
  if (state.pilots[SECOND_LANCE_PILOTS[0].id]) return { integrated: false };
  for (const p of SECOND_LANCE_PILOTS) state.pilots[p.id] = { pilot: { ...p }, status: "active", personalPoints: 0 };
  for (const [id, m] of Object.entries(SECOND_LANCE_MEKS)) state.meks[id] = { ...m };
  state.rourkeRank = "capt";
  return { integrated: true, pilots: SECOND_LANCE_PILOTS };
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
  if (state.pilots[THIRD_LANCE_PILOTS[0].id]) return { integrated: false };
  for (const p of THIRD_LANCE_PILOTS) state.pilots[p.id] = { pilot: { ...p }, status: "active", personalPoints: 0 };
  for (const [id, m] of Object.entries(THIRD_LANCE_MEKS)) state.meks[id] = { ...m };
  state.rourkeRank = "maj";
  return { integrated: true, pilots: THIRD_LANCE_PILOTS };
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
  if (state.pilots[THIRD_LANCE_PILOTS[0].id]) return "maj";
  if (state.pilots[SECOND_LANCE_PILOTS[0].id]) return "capt";
  return "2nd_lt";
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
 * Fails open for a pilotId with no CampaignPilotEntry at all (shouldn't
 * happen for the three currently-seeded Hub NPCs — all real WARDEN_PILOTS
 * ids — but Hub.ts's own WARDEN_PILOTS.find() fallback already treats a
 * missing pilot as "fail open to something harmless" rather than throwing,
 * so this matches): hands back a fresh, unattached HubPilotSocialState
 * instead of throwing. It just won't be there to reload next time, since
 * there's no CampaignPilotEntry to hang it off of.
 */
export function ensureHubSocialState(
  state: CampaignState,
  pilotId: string,
  seed: { favorability: number; stress: number; morale: number }
): HubPilotSocialState {
  const entry = state.pilots[pilotId];
  if (!entry) {
    return { favorability: seed.favorability, stress: seed.stress, morale: seed.morale, inRelationship: false, socialLog: [] };
  }
  if (!entry.social) {
    entry.social = { favorability: seed.favorability, stress: seed.stress, morale: seed.morale, inRelationship: false, socialLog: [] };
  }
  return entry.social;
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
