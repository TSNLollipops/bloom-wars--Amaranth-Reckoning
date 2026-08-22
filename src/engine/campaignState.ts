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
import { UNIT_ARCHETYPES } from "../data/units";
import { WARDEN_PILOTS, WARDEN_MEKS } from "../data/campaignAmaranth";
import { findPilot } from "../data/pilotRegistry";
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
}

/**
 * Build a fresh CampaignState from a starting roster + mek set — a deep-ish
 * copy (each PilotRecord/MekArchetype shallow-cloned) so mutating the
 * campaign's copies never touches the static arrays in data/. Generic over
 * the roster on purpose (tests pass synthetic rosters); createWardenCampaignState
 * below is the real entry point for the one campaign this repo currently ships.
 */
export function createCampaignState(pilots: PilotRecord[], meks: Record<string, MekArchetype>, startingPoints = 0): CampaignState {
  const state: CampaignState = { points: startingPoints, pilots: {}, meks: {}, nextGeneratedId: 1, rourkeRank: "2nd_lt" };
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

/** Basic save. A no-op (not an error) when no storage is available, e.g. the headless sim harness. */
export function saveCampaignState(state: CampaignState, storage?: CampaignStorage): void {
  const s = resolveStorage(storage);
  if (!s) return;
  s.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** Basic load. Returns null on no storage, no saved value, or a value that fails to parse (a corrupt/foreign localStorage entry should read as "no save," not crash the game). */
export function loadCampaignState(storage?: CampaignStorage): CampaignState | null {
  const s = resolveStorage(storage);
  if (!s) return null;
  const raw = s.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CampaignState;
  } catch {
    return null;
  }
}

export function clearCampaignState(storage?: CampaignStorage): void {
  const s = resolveStorage(storage);
  if (!s) return;
  s.removeItem(STORAGE_KEY);
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
  // rather than a hardcoded id comparison buried here. This overrides
  // everything below, regardless of Munti presence.
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

/** Shared by both recruit paths below: mints a brand-new baseline G-tier pilot (and a fresh, unassigned-track-default mek) of the given class and adds both to the campaign state. Never reuses a lost pilot's identity, tier, or mek — a genuinely new record, so there is nothing to carry over by construction (rule 6's own point). */
function generatePilot(state: CampaignState, targetClass: Path): PilotRecord {
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
  // four use the standard bipedal archetypes," Data Pack §9).
  const pilot: PilotRecord = {
    id: pilotId,
    displayName: `Recruit "${callsign}"`,
    archetypeId: `arch_${targetClass}_bipedal`,
    mekId,
    tier: "G",
  };
  state.pilots[pilotId] = { pilot, status: "active", personalPoints: 0 };
  return pilot;
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
