// Heirlooms — campaign rules, 2 Sep 2026.
// Maxime: "for the heirloom thing, yeah go for it."
//
// Source design: claude/Bloom_Wars_Heirloom_Weapons_Plan_v1.md §1a-§1c.
// The kits, pilots and cost tables live in data/heirlooms.ts; this file is
// the rules that spend points and mutate CampaignState, matching the same
// division every purchase* function in campaignEconomy.ts keeps — data
// says what things are, the engine says what you're allowed to do.
//
// The four rules that actually matter, and all four are enforced here
// rather than by whatever UI happens to call in:
//
//   1. COMPANY points recruit; PERSONAL points rank up. "company, for
//      heirloom" — recruiting nobility is an outfit-level investment, not
//      one pilot's grind. Ranks 2-5 then come out of the pilot's own pool,
//      which is the one place the two economies touch the same Heirloom.
//   2. THREE recruits per campaign, ever. "the mc only get to pick up to 3
//      heirloom pilot during campaign."
//   3. ONE fielded at a time, across every source including the two
//      aberrations. "and field one at a time no matter what."
//   4. ACT II ONWARD. "player can only get heirloom at act 2 and onward."
//
// S tier is granted by recruitment and by nothing else — see
// data/types.ts's Tier and campaignEconomy.ts's TIER_ORDER for the two
// halves of why that had to be built carefully rather than appended.
//
// ---- 2 Sep 2026, later the same day: the aristocrats are real ---------
//
// The first pass shipped `assignedPilotId` and never wrote to it. That one
// gap made the whole system unreachable: with no pilot behind an Heirloom,
// nothing could be fielded, nothing could rank up against a real personal
// pool, and the S-tier safety work above was never exercised by an actual
// roster entry. recruitHeirloom now MINTS the named aristocrat — an
// active, deployable PilotRecord at tier S, with their own frame named
// after the Heirloom — via mintAristocrat below.
//
// Two rules that came out of that, both worth stating because both are
// choices rather than consequences:
//
//   5. A REFUSAL IS FREE. Everything that can refuse refuses before any
//      state is touched, so a failed recruitment never leaves company
//      points spent on an Heirloom nobody carries.
//   6. "WHO IS ACTUALLY CARRYING THIS" IS DERIVED, NEVER STORED TWICE.
//      An aristocrat is not exempt from permadeath, so a wielder can die.
//      When they do, `fielded` is deliberately left as the player set it —
//      the company still owns the artifact — and fieldedHeirloom() reads
//      the roster's own live status to answer what is actually deployable.
//      Same discipline campaignState.ts already argues for on Mek
//      retirement, and for the same reason: a second stored flag is one
//      more thing that can disagree with the roster.
//
// ---- DECIDED 2 Sep 2026: the houses take their property back ---------
//
// Maxime, asked what happens to a recruited Heirloom when its aristocrat
// is lost: "nah, recruite one are familly heirloom they get returned
// home." These are FAMILY heirlooms. The company never owned one — it
// borrowed one, through that family's own child, and when the child does
// not come back neither does the weapon.
//
// Three consequences, and the useful thing is that all three are already
// true of the model above rather than needing new machinery:
//
//   - It cannot be handed to a surviving pilot. Nothing anywhere assigns
//     an Heirloom to anyone but its own aristocrat at recruitment.
//   - It never resurfaces on a later shortlist. rollHeirloomShortlist
//     excludes everything in `recruited`, and `recruited` is a permanent
//     record of picks made EVER — nothing is ever removed from it.
//   - THE PICK IS SPENT FOR GOOD. heirloomPicksRemaining counts against
//     that same permanent `recruited` length, so a house taking its
//     heirloom home does not give the slot back. Maxime's own call,
//     against the softer alternatives, and consistent with the campaign
//     doc's standing "im a xcom purist" line: losing an aristocrat costs
//     the pilot, the company points, the weapon, and one of only three
//     chances the campaign will ever offer.
//
// So "has this gone home?" is asked, never stored: it is exactly "is the
// pilot who carried it still with the company," which the roster already
// answers. See isReturnedHome/heirloomsWithCompany below.

import type { CampaignState } from "./campaignState";
// A VALUE import from campaignState, deliberately, and it is not a cycle:
// campaignState.ts's only reference back to this file is `import type
// { HeirloomCampaignState }`, which TypeScript erases entirely. Importing
// the table rather than copying it is the point — a second copy of
// "which mek track does a <path> pilot default to" is exactly the kind of
// duplicated truth that has drifted in this repo before.
import { CLASS_DEFAULT_MEK_TRACK } from "./campaignState";
import type { MekArchetype, Path, PilotRecord } from "../data/types";
import { UNIT_ARCHETYPES } from "../data/units";
import {
  HEIRLOOMS,
  RECRUITABLE_HEIRLOOM_IDS,
  HEIRLOOM_RECRUIT_BUDGET,
  HEIRLOOM_MAX_ABILITY_RANK,
  HEIRLOOM_ABILITY_RANK_COST,
  ARISTOCRAT_SIGNING_POOL,
  HEIRLOOM_SHORTLIST_SIZE,
  HEIRLOOM_DEFAULT_PATH,
  HEIRLOOM_SHORTLIST_MIN,
  HOUSE_VERDICT_COST_STEPS,
  HOUSE_VERDICT_SHORTLIST_PENALTY,
  heirloomRecruitCost,
  type HeirloomDef,
  type HeirloomId,
  type HouseVerdict,
} from "../data/heirlooms";
import { houseGrievance, type HouseGrievance } from "./houseStanding";
import { findClosestBond } from "../data/npcBonds";

/**
 * Per-campaign Heirloom state. Optional on CampaignState and read as
 * `?? ...` everywhere, same no-migration-needed shape as builtBays and
 * builtModules: a save from before this pass simply has none, which is
 * identical in meaning to "nothing recruited yet."
 */
export interface HeirloomCampaignState {
  /** Recruited Heirlooms, in the order picked. Length is the budget spent. */
  recruited: HeirloomId[];
  /** The one currently fielded, if any. Never more than one. */
  fielded?: HeirloomId;
  /**
   * Ability ranks, keyed `${heirloomId}:${abilityId}`. An absent entry
   * means rank 1 — the rank granted free at recruitment — so this map only
   * ever holds abilities the player has actually paid to raise.
   */
  abilityRanks: Record<string, number>;
  /**
   * Which pilot each recruited Heirloom is assigned to. Aberrations
   * (Requiem, The Stolen Seal) go to one of the player's own pilots via
   * their story beat; proper Heirlooms arrive with their own aristocrat,
   * whose generated pilot id is recorded here.
   */
  assignedPilotId: Partial<Record<HeirloomId, string>>;
  /**
   * The standing shortlist offer, decided 2 Sep 2026: roll once when Act II
   * opens, hold until a pick is made, then reroll — not re-rolled on every
   * open.
   *
   * Stored rather than derived, and that's worth a word since this file's
   * own standing rule elsewhere is "derive, never store": rollHeirloomShortlist
   * is a pure function, so if the caller (the Vault overlay) rolled fresh
   * on every open, a player could close and reopen the panel until a name
   * they wanted appeared — a slot machine, not a shortlist, deleting the
   * scarcity the 3-of-8 recruit budget exists to create. The roll destroys
   * its own source the instant it returns (the rng draw is gone), which is
   * exactly the "store when the event that answers it is the thing that
   * destroys its own source" case houseStanding.ts's PermanentLossRecord
   * already established for this project.
   */
  shortlist?: {
    ids: HeirloomId[];
    /** What the offer was rolled against — diagnostic, so a stale-looking offer is legible from a save rather than a mystery. Nothing currently branches on it. */
    rolledAtRank: CampaignState["rourkeRank"];
  };
}

export function emptyHeirloomState(): HeirloomCampaignState {
  return { recruited: [], abilityRanks: {}, assignedPilotId: {} };
}

/** Read the campaign's Heirloom state, defaulting rather than throwing. */
export function heirloomState(state: CampaignState): HeirloomCampaignState {
  return state.heirlooms ?? emptyHeirloomState();
}

/**
 * Is the campaign past Act I?
 *
 * Reads `rourkeRank` rather than a mission counter, deliberately: the rank
 * ladder already IS the act ladder in this campaign — 2nd Lt. covers
 * Missions 1-11, and `integrateSecondLance` promotes Rourke to Captain at
 * Mission 12, the Act I/II boundary (see campaignState.ts's own comment on
 * that function). Using it means the Act II gate can't drift out of sync
 * with the promotion that defines Act II, and no new state has to be
 * tracked or migrated into old saves.
 */
export function heirloomsUnlocked(state: CampaignState): boolean {
  return state.rourkeRank !== "2nd_lt";
}

/**
 * Recruit budget still unspent.
 *
 * Filters `recruited` down to non-aberration Heirlooms before counting.
 * Found necessary 2 Sep 2026, writing acquireAberration's own tests: an
 * aberration lands in the same `recruited` list every proper Heirloom
 * does (rollHeirloomShortlist's exclusion pool, isReturnedHome, and every
 * other "does the company have this" question all still want it there),
 * but acquireAberration's own doc comment already promises "no pick spent
 * against HEIRLOOM_RECRUIT_BUDGET — the budget is the three houses'
 * offers, and Gjallar was never a house's to offer." Counting `.length`
 * unfiltered would have quietly broken that promise the first time Gjallar
 * was ever acquired, docked a pick nobody spent, and made the third
 * shortlist recruit read as unavailable when it should still be open.
 *
 * Shared with recruitHeirloom below, which has the exact same filtering
 * to do for the exact same reason — its own budget check and its own
 * price-rung calculation both used to read hs.recruited.length raw, so an
 * acquired aberration silently ate a house pick AND bumped the next
 * proper recruit up the price ladder a rung early. Caught here, alongside
 * this function's own fix, rather than only in the one spot the first
 * failing test happened to point at.
 */
function properRecruitedCount(state: CampaignState): number {
  return heirloomState(state).recruited.filter((id) => HEIRLOOMS[id].track !== "aberration").length;
}

export function heirloomPicksRemaining(state: CampaignState): number {
  return Math.max(0, HEIRLOOM_RECRUIT_BUDGET - properRecruitedCount(state));
}

export interface HeirloomRecruitOptions {
  /**
   * Which path the aristocrat deploys as. Only meaningful for an
   * "Any"-path Heirloom (`def.path === null`); passing one that disagrees
   * with a fixed-path Heirloom is REFUSED rather than ignored, because
   * quietly overriding what a caller explicitly asked for is how a UI bug
   * becomes an unreproducible save-state bug.
   */
  path?: Path;
}

export interface HeirloomRecruitResult {
  ok: boolean;
  reason?: string;
  heirloomId?: HeirloomId;
  cost?: number;
  /** The aristocrat minted onto the roster by this recruitment. */
  pilot?: PilotRecord;
}

/** Deterministic ids. An Heirloom can only ever be recruited once (recruitHeirloom refuses a duplicate), so these are unique by construction and need no counter — which also means a save can be reasoned about by eye, and assignedPilotId can be cross-checked against the roster without a lookup table. */
export function aristocratPilotId(heirloomId: HeirloomId): string {
  return `pilot_heirloom_${heirloomId}`;
}
export function aristocratMekId(heirloomId: HeirloomId): string {
  return `mek_heirloom_${heirloomId}`;
}

/**
 * Which path this Heirloom's aristocrat actually deploys as, given what
 * the caller asked for.
 *
 * Returns a `reason` instead of a path when the request is contradictory,
 * so the refusal reaches the player as a sentence rather than as a silent
 * substitution.
 */
export function resolveAristocratPath(
  def: HeirloomDef,
  requested?: Path,
): { path?: Path; reason?: string } {
  if (def.path) {
    if (requested && requested !== def.path) {
      return { reason: `${def.displayName} is a ${def.path} frame — it can't be taken as ${requested}` };
    }
    return { path: def.path };
  }
  // "Any"-path: the player's pick wins, and the table is only the fallback
  // for a caller that didn't ask. See HEIRLOOM_DEFAULT_PATH's own comment
  // for why each fallback is what it is, and why neither is locked.
  const fallback = HEIRLOOM_DEFAULT_PATH[def.id];
  if (requested) return { path: requested };
  if (fallback) return { path: fallback };
  return { reason: `${def.displayName} suits any path — one has to be chosen` };
}

/**
 * Mint the aristocrat onto the roster: a real, active, deployable
 * PilotRecord at S tier, plus their own named signature frame.
 *
 * Deliberately mirrors campaignState.ts's own generatePilot rather than
 * inventing a second shape — same `state.pilots[id] = { pilot, status:
 * "active", personalPoints: ... }` storage, same mek-track table, same
 * `arch_<path>_<chassis>` archetype convention. What differs is what's
 * actually different about an aristocrat: a real name instead of a rolled
 * callsign, tier "S" instead of "G", a frame named after the Heirloom
 * instead of after the pilot, and — see below — a non-zero starting
 * personal-points balance.
 *
 * NOT exempt from permadeath. `exemptFromPermadeath` stays absent, same as
 * every pilot but Rourke — an aristocrat can be lost like anyone else, and
 * that is the point of spending a third of the campaign's Heirloom budget
 * on one.
 *
 * Minted WITH personal points (ARISTOCRAT_SIGNING_POOL, see that constant's
 * own comment for why a fresh recruit's mission-earnings ceiling makes this
 * necessary rather than generous) — the one deliberate deviation from
 * generatePilot's `personalPoints: 0`. Zeroed like anyone else's on
 * permanent loss (applyPermadeathCheck), same as the rest of this function
 * mirrors that one.
 */
function mintAristocrat(state: CampaignState, def: HeirloomDef, path: Path): PilotRecord | { reason: string } {
  const pilotId = aristocratPilotId(def.id);
  const mekId = aristocratMekId(def.id);
  if (state.pilots[pilotId]) {
    // Unreachable through recruitHeirloom (the duplicate check above fires
    // first), but a roster id colliding is the kind of thing that must
    // never silently overwrite a living pilot.
    return { reason: `${pilotId} is already on the roster` };
  }
  const chassis = def.pilot?.chassis ?? "bipedal";
  const archetypeId = `arch_${path}_${chassis}`;
  if (!UNIT_ARCHETYPES[archetypeId]) {
    // A real guard, not ceremony: not every path × chassis pair exists in
    // data/units.ts, so a future Heirloom given a combination that was
    // never authored would otherwise mint a pilot who cannot be built into
    // a BattleUnit — a crash at deploy time, far from its cause.
    return { reason: `no unit archetype ${archetypeId} exists — ${def.displayName} can't be fielded as ${path}` };
  }

  const mek: MekArchetype = {
    id: mekId,
    // The frame carries the Heirloom's name, not the pilot's. Every other
    // mek in the game is "<callsign>'s Mek"; a named signature frame is
    // one of the two things recruitment actually grants (plan doc §1c).
    displayName: def.displayName,
    primary: CLASS_DEFAULT_MEK_TRACK[path],
    secondary: null,
    spareParts: 0,
  };
  state.meks[mekId] = mek;

  const pilot: PilotRecord = {
    id: pilotId,
    displayName: def.pilot?.displayName ?? def.displayName,
    archetypeId,
    mekId,
    tier: "S",
  };
  state.pilots[pilotId] = { pilot, status: "active", personalPoints: ARISTOCRAT_SIGNING_POOL };
  return pilot;
}

/**
 * Recruit one aristocrat and their Heirloom, spending COMPANY points.
 *
 * Refuses, in this order, on: an unknown id; an aberration (Requiem and
 * The Stolen Seal arrive through their own story beats and were never on
 * a shortlist); Act I; an exhausted 3-pick budget; a duplicate; and
 * finally insufficient points. Order matters for the message the player
 * gets — "you're still in Act I" is more useful than "you can't afford
 * it" when both are true.
 */
export function recruitHeirloom(
  state: CampaignState,
  heirloomId: HeirloomId,
  opts: HeirloomRecruitOptions = {},
): HeirloomRecruitResult {
  const def = HEIRLOOMS[heirloomId];
  if (!def) return { ok: false, reason: `unknown heirloom: ${heirloomId}` };
  if (def.track !== "proper") {
    return { ok: false, reason: `${def.displayName} isn't recruited — it comes from its own story beat` };
  }
  if (!heirloomsUnlocked(state)) {
    return { ok: false, reason: "No house is offering yet — Heirloom candidates appear from Act II onward" };
  }
  const hs = heirloomState(state);
  // properRecruitedCount, not hs.recruited.length — recruited also holds
  // any acquired aberration (Gjallar, via acquireAberration), and the
  // budget/ladder below are both specifically about the THREE HOUSES'
  // offers. See that function's own comment: found because it's the exact
  // bug acquireAberration's own doc comment promises can't happen ("no
  // pick is spent against HEIRLOOM_RECRUIT_BUDGET").
  const properRecruited = properRecruitedCount(state);
  if (properRecruited >= HEIRLOOM_RECRUIT_BUDGET) {
    return { ok: false, reason: `Warden Company has already taken on ${HEIRLOOM_RECRUIT_BUDGET} Heirloom pilots — that's the campaign's limit` };
  }
  if (hs.recruited.includes(heirloomId)) {
    return { ok: false, reason: `${def.displayName} is already with the company` };
  }
  // The ladder rung is the number of HOUSE picks made PLUS whatever the
  // houses have added on the company's behalf (aristocracyStanding above).
  // A house that got its child back in a box tells the others, and the
  // others reprice accordingly. Gjallar joining the roster is not a house
  // pick and must not nudge this ladder either.
  const standing = aristocracyStanding(state);
  const rung = properRecruited + standing.costSteps;
  const cost = heirloomRecruitCost(rung);
  if (cost === undefined) {
    // Two ways to land here now, and they deserve different sentences.
    //
    // Pushed off the end of the ladder by standing is the designed end
    // state of the full-teeth rule, not an error: enough houses have gone
    // estranged that nobody will put a name forward at any price. It can
    // genuinely cost the player the rest of the campaign's Heirloom
    // content, which is the accepted cost of the version Maxime asked for
    // ("full teeth, same pass") and is worth keeping visible here.
    //
    // The other way is the original one: the budget and the price list are
    // separate constants and could drift apart. Refusing stays the safe
    // direction either way — a missing price must never mean free.
    if (standing.costSteps > 0) {
      return { ok: false, reason: "No house will put a name forward to Warden Company now" };
    }
    return { ok: false, reason: "no price is set for that pick" };
  }
  if (state.points < cost) {
    return { ok: false, reason: `not enough company points — ${def.pilot?.displayName ?? def.displayName} costs ${cost}, company has ${state.points}` };
  }

  // Everything that can refuse must refuse BEFORE any state is touched.
  // The path resolution and the archetype guard are the two new ways this
  // can fail, and both are resolved here, while the campaign is still
  // exactly as it was — so a refusal never leaves a half-recruited
  // Heirloom with company points already spent.
  const resolved = resolveAristocratPath(def, opts.path);
  if (!resolved.path) return { ok: false, reason: resolved.reason };
  const minted = mintAristocrat(state, def, resolved.path);
  if ("reason" in minted) return { ok: false, reason: minted.reason };

  state.points -= cost;
  state.heirlooms = {
    ...hs,
    recruited: [...hs.recruited, heirloomId],
    // The roster and the Heirloom pool now agree on who holds what. This
    // is the field that made the whole foundation pass unreachable: it
    // existed and was never written, so nothing could ever be fielded.
    assignedPilotId: { ...hs.assignedPilotId, [heirloomId]: minted.id },
    // Deliberately NOT auto-fielded. Fielding is its own decision with its
    // own one-at-a-time rule, and silently benching whatever was already
    // out because the player recruited someone new would be a change they
    // didn't ask for.
    //
    // The standing shortlist IS cleared, on purpose: the offer that was
    // just acted on shouldn't keep showing the name that's no longer
    // available, and clearing it is what makes the next currentShortlist
    // call roll a genuinely fresh three.
    shortlist: undefined,
  };
  return { ok: true, heirloomId, cost, pilot: minted };
}

/**
 * Assign an ABERRATION (Gjallar/Requiem, Simulacrum/The Stolen Seal) to a
 * pilot from its own story beat — Mission 12's Vault dedication, in
 * Gjallar's case. NOT a recruitment: no company points change hands, no
 * pick is spent against HEIRLOOM_RECRUIT_BUDGET, and it never touches the
 * shortlist. The 3-pick budget is what the THREE HOUSES offer; Gjallar was
 * never a house's to offer, and recruitHeirloom already refuses it for
 * exactly that reason ("isn't recruited — it comes from its own story
 * beat").
 *
 * The holder is an EXISTING pilot, not a minted one — an aberration has no
 * `def.pilot`, so there's no aristocrat to mint and nothing to name a
 * frame after. This function only ever writes `recruited` and
 * `assignedPilotId`; it never touches `state.pilots` or `state.meks`.
 *
 * Refuses, in this order, on: an unknown id; a proper (non-aberration)
 * Heirloom (recruitHeirloom is the door for those); already assigned (an
 * aberration changes hands via its own scene logic, e.g. Bosk to Rourke —
 * that's a second call to this function naming the new holder, not
 * something this function decides on its own); an unknown or non-active
 * pilot.
 */
export function acquireAberration(state: CampaignState, heirloomId: HeirloomId, pilotId: string): HeirloomRecruitResult {
  const def = HEIRLOOMS[heirloomId];
  if (!def) return { ok: false, reason: `unknown heirloom: ${heirloomId}` };
  if (def.track !== "aberration") {
    return { ok: false, reason: `${def.displayName} isn't an aberration — recruit it through the Vault shortlist instead` };
  }
  const entry = state.pilots[pilotId];
  if (!entry) return { ok: false, reason: `unknown pilot id: ${pilotId}` };
  if (entry.status !== "active") {
    return { ok: false, reason: `${entry.pilot.displayName} is not active — cannot assign ${def.displayName} to a lost pilot` };
  }
  const hs = heirloomState(state);
  const currentHolder = hs.assignedPilotId[heirloomId];
  if (currentHolder === pilotId) {
    return { ok: false, reason: `${entry.pilot.displayName} already carries ${def.displayName}` };
  }
  state.heirlooms = {
    ...hs,
    recruited: hs.recruited.includes(heirloomId) ? hs.recruited : [...hs.recruited, heirloomId],
    assignedPilotId: { ...hs.assignedPilotId, [heirloomId]: pilotId },
  };
  return { ok: true, heirloomId, cost: 0, pilot: entry.pilot };
}

export interface VaultDedicationResult {
  /** The pilot memorialised — undefined means nobody fell at Mission 12. */
  fallenId?: string;
  /** True iff Gjallar/Requiem was actually handed to Rourke by this call. */
  transferred: boolean;
}

/**
 * Mission 12's Vault scene — "The Fallow Line," Act I's finale. Antfarm
 * Carrier Hub §8 calls this "load-bearing, not skippable": the one moment
 * the friend-or-foe permadeath rule is supposed to read as grief rather
 * than as game design. See Bloom_Wars_Vault_Build_Plan_v1.md Decision 3:
 * LOCKED as a one-shot check for EA, the same cheap pattern Hub.ts already
 * uses for checkMekRetirement/checkHeirloomRecall, rather than building the
 * general HubScene system Antfarm §7 designs (a data-driven trigger/beat
 * player) for a single beat. If a second hand-authored scene is ever
 * needed, THAT is the trigger to build HubScene for real — hoist the
 * one-shot-via-presence gating below, the trigger condition, and the
 * candidate-selection logic out into it; this function's own body is
 * deliberately the only thing that would need to move.
 *
 * Trigger: `heirloomsUnlocked(state)` becoming true. integrateSecondLance
 * (engine/campaignState.ts) is the ONLY code path that ever moves
 * state.rourkeRank off "2nd_lt", and it only ever fires from
 * scenes/Debrief.ts on `mission.mission.id === "mission_amaranth_12" &&
 * win` — so "Heirlooms are unlocked" is already an exact, reusable proxy
 * for "Mission 12 has just been won," with no second mission-id check
 * needed here.
 *
 * Who gets memorialised: campaign doc §6a killed the old scripted "Bosk
 * doesn't make it out" beat — permadeath is live and general now, so Bosk
 * reaching Mission 12 at all, let alone falling there, is no longer
 * guaranteed. This scans CampaignPilotEntry.lostContext (stamped once, at
 * Debrief, by applyMissionLosses — never touched again) for whoever fell
 * SPECIFICALLY at Mission 12, not just whoever's currently dead, so an
 * earlier loss (say, Mission 7) never gets credited with this beat.
 * pilot_bosk wins on presence (the beat was written for him); otherwise
 * the Walkable Hub Build Plan's own locked substitution rule applies —
 * findClosestBond, pivoted on Rourke same as every other Hub substitution
 * — among whoever else fell at Mission 12. Ties or an empty bonds table
 * fall back to the first candidate rather than leaving the pick undefined,
 * so a real Mission-12 loss is never quietly dropped for lack of bond data.
 *
 * Nobody falling at Mission 12 is a real, distinct outcome, not a
 * degenerate case to paper over: no death, no dedication, Gjallar never
 * changes hands this campaign. Consistent with the project's own "im a
 * xcom purist" line — the scene's weight comes from the loss actually
 * costing something, and a survived Mission 12 is allowed to cost this.
 *
 * One-shot via presence, same shape `shortlist` already uses on
 * HeirloomCampaignState: `state.vaultDedication` existing at all — with or
 * without a `fallenId` — means "resolved," so a later call is a no-op
 * (returns undefined) rather than re-rolling the pick against bonds that
 * have since moved on. Persisting the state is the caller's job (Hub.ts's
 * create(), alongside checkMekRetirement/checkHeirloomRecall, then
 * saveCampaignState) — this function only mutates the in-memory state, same
 * division every other function in this file keeps.
 */
export function resolveVaultDedication(state: CampaignState): VaultDedicationResult | undefined {
  if (state.vaultDedication) return undefined;
  if (!heirloomsUnlocked(state)) return undefined;

  const fallenAtMission12 = Object.entries(state.pilots)
    .filter(([, entry]) => entry.status === "permanently_lost" && entry.lostContext?.missionId === "mission_amaranth_12")
    .map(([pilotId]) => pilotId);

  let fallenId: string | undefined;
  if (fallenAtMission12.includes("pilot_bosk")) {
    fallenId = "pilot_bosk";
  } else if (fallenAtMission12.length > 0) {
    const bonds = state.npcSocial?.bonds ?? {};
    fallenId = findClosestBond("pilot_rourke", fallenAtMission12, bonds)?.otherId ?? fallenAtMission12[0];
  }

  let transferred = false;
  if (fallenId) {
    transferred = acquireAberration(state, "requiem", "pilot_rourke").ok;
  }

  state.vaultDedication = { fallenId, seen: false };
  return { fallenId, transferred };
}

/**
 * Is this Heirloom's holder still alive and with the company?
 *
 * Derived from the roster's own live status rather than mirrored into a
 * second stored flag, matching the discipline campaignState.ts already
 * argues for on Mek retirement: a Mek's "still active" is read off its
 * pilot's status flip, never stored twice. Same reasoning here, same
 * failure avoided — a stored `heirloomLost` boolean would be one more
 * thing that can disagree with the roster.
 *
 * An Heirloom with no assigned pilot is holdable but not wieldable: the
 * company owns the artifact, nobody is carrying it.
 */
export function heirloomHasLivingHolder(state: CampaignState, heirloomId: HeirloomId): boolean {
  const pilotId = heirloomState(state).assignedPilotId[heirloomId];
  if (!pilotId) return false;
  return state.pilots[pilotId]?.status === "active";
}

/**
 * Has this Heirloom gone back to the house that lent it?
 *
 * True the moment its aristocrat stops being an active member of the
 * company — killed, or reassigned off the ship. Derived, deliberately:
 * a stored `returnedHome` flag would be a second copy of a fact the
 * roster already holds, and the two could disagree.
 *
 * Note this is not quite the negation of "the company has it": an
 * Heirloom that was never recruited has no holder either, and has not
 * gone home, because it was never here. Hence the `recruited` check.
 */
export function isReturnedHome(state: CampaignState, heirloomId: HeirloomId): boolean {
  const hs = heirloomState(state);
  if (!hs.recruited.includes(heirloomId)) return false;
  return !heirloomHasLivingHolder(state, heirloomId);
}

/** The recruited Heirlooms still actually in the company's hands. */
export function heirloomsWithCompany(state: CampaignState): HeirloomId[] {
  return heirloomState(state).recruited.filter((id) => heirloomHasLivingHolder(state, id));
}

/** The recruited Heirlooms their houses have taken back. Their picks stay spent. */
export function returnedHeirlooms(state: CampaignState): HeirloomId[] {
  return heirloomState(state).recruited.filter((id) => !heirloomHasLivingHolder(state, id));
}

// ---- What the other houses make of it (2 Sep 2026) ----------------------

export interface HeirloomHouseVerdict extends HouseGrievance {
  heirloomId: HeirloomId;
  /** The family that lent it, for a line of dialogue that names them. */
  house: string;
  /** The aristocrat who didn't come back. */
  pilotId: string;
  pilotName: string;
}

/**
 * Every recalled Heirloom, with the verdict its house reached.
 *
 * Derived on every call — the standing rule, and it holds here because the
 * source of truth genuinely outlives the question: the roster still knows
 * who is gone, and each of those pilots carries the one stored fact this
 * needs (CampaignPilotEntry.lostContext, stamped at their own debrief).
 * Nothing about a house's opinion is written into the save.
 *
 * An Heirloom whose holder is gone but who has no lostContext is skipped
 * rather than guessed at. That is a real case, not a defensive stub: a
 * pilot reassigned off the ship also stops holding their Heirloom, and no
 * house blames a company for a transfer. It also covers a save made before
 * lostContext existed, which should quietly grant the benefit of the doubt
 * rather than invent a grievance out of missing data.
 */
export function heirloomHouseVerdicts(state: CampaignState): HeirloomHouseVerdict[] {
  const hs = heirloomState(state);
  const out: HeirloomHouseVerdict[] = [];
  for (const heirloomId of returnedHeirlooms(state)) {
    const pilotId = hs.assignedPilotId[heirloomId];
    if (!pilotId) continue;
    const entry = state.pilots[pilotId];
    if (!entry?.lostContext) continue;
    const def = HEIRLOOMS[heirloomId];
    out.push({
      heirloomId,
      house: def?.pilot?.house ?? "The house",
      pilotId,
      pilotName: entry.pilot.displayName,
      ...houseGrievance(entry.lostContext),
    });
  }
  return out;
}

export interface AristocracyStanding {
  verdicts: HeirloomHouseVerdict[];
  /**
   * How many rungs up the recruit ladder the company has been pushed. The
   * ladder is short (three prices, one per pick), so this runs off the end
   * quickly — and running off the end is the designed outcome, not an
   * oversight: it is the point where no house will deal with Warden Company
   * any more. recruitHeirloom refuses in that case, by name.
   */
  costSteps: number;
  /** How many candidates the houses have withdrawn from any future shortlist. */
  shortlistPenalty: number;
  /** Whether any house has gone as far as estranged. Convenience for a UI. */
  anyEstranged: boolean;
}

/**
 * What the aristocracy collectively thinks of Warden Company right now.
 *
 * Aimed at the OTHER houses on purpose. The house whose child died has
 * already taken back the only thing it had to take — punishing it further
 * would punish nothing. Houses are 1:1 with Heirlooms in this campaign
 * (data/heirlooms.ts), so a grievance can only travel sideways, which is
 * also the better story: the arrangement was never with one family, it was
 * with a class, and the class compares notes.
 */
export function aristocracyStanding(state: CampaignState): AristocracyStanding {
  const verdicts = heirloomHouseVerdicts(state);
  let costSteps = 0;
  let shortlistPenalty = 0;
  for (const v of verdicts) {
    costSteps += HOUSE_VERDICT_COST_STEPS[v.verdict];
    shortlistPenalty += HOUSE_VERDICT_SHORTLIST_PENALTY[v.verdict];
  }
  return {
    verdicts,
    costSteps,
    shortlistPenalty,
    anyEstranged: verdicts.some((v) => v.verdict === "estranged"),
  };
}

/** The verdict for one recalled Heirloom, or undefined if its house has no opinion. */
export function heirloomHouseVerdict(state: CampaignState, heirloomId: HeirloomId): HouseVerdict | undefined {
  return heirloomHouseVerdicts(state).find((v) => v.heirloomId === heirloomId)?.verdict;
}

/**
 * The Heirloom actually going into the next mission — which is not always
 * the one the player last chose.
 *
 * `hs.fielded` records the player's stated intent and is deliberately left
 * alone when its wielder dies: the company still owns the artifact, and
 * clearing the field slot inside a permadeath resolution would mean
 * campaignState.ts reaching into Heirloom rules from the middle of an
 * unrelated function. Callers that need to know what is actually deployable
 * ask this instead.
 */
export function fieldedHeirloom(state: CampaignState): HeirloomId | undefined {
  const fielded = heirloomState(state).fielded;
  if (!fielded) return undefined;
  return heirloomHasLivingHolder(state, fielded) ? fielded : undefined;
}

/** Which Heirloom, if any, this pilot is carrying. */
export function heirloomForPilot(state: CampaignState, pilotId: string): HeirloomId | undefined {
  const assigned = heirloomState(state).assignedPilotId;
  return (Object.keys(assigned) as HeirloomId[]).find((id) => assigned[id] === pilotId);
}

export interface HeirloomFieldResult {
  ok: boolean;
  reason?: string;
  fielded?: HeirloomId;
  benched?: HeirloomId;
}

/**
 * Field one Heirloom, benching whatever was out.
 *
 * The one-at-a-time rule is enforced by REPLACEMENT rather than refusal —
 * a player swapping their fielded Heirloom shouldn't have to unfield the
 * old one first, and the rule is "one on the field," not "one change per
 * visit." The benched id comes back in the result so a caller can say what
 * happened.
 */
export function fieldHeirloom(state: CampaignState, heirloomId: HeirloomId): HeirloomFieldResult {
  const def = HEIRLOOMS[heirloomId];
  if (!def) return { ok: false, reason: `unknown heirloom: ${heirloomId}` };
  const hs = heirloomState(state);
  if (!hs.recruited.includes(heirloomId)) {
    return { ok: false, reason: `${def.displayName} isn't with the company` };
  }
  if (hs.fielded === heirloomId) {
    return { ok: false, reason: `${def.displayName} is already fielded` };
  }
  if (!heirloomHasLivingHolder(state, heirloomId)) {
    const holder = hs.assignedPilotId[heirloomId];
    return {
      ok: false,
      reason: holder
        ? `${def.pilot?.house ?? "The house"} recalled ${def.displayName} when ${state.pilots[holder]?.pilot.displayName ?? "its pilot"} didn't come back`
        : `${def.displayName} has no pilot assigned`,
    };
  }
  const benched = hs.fielded;
  state.heirlooms = { ...hs, fielded: heirloomId };
  return { ok: true, fielded: heirloomId, benched };
}

/** Bench the fielded Heirloom, if any. Idempotent — benching nothing is not an error. */
export function unfieldHeirloom(state: CampaignState): HeirloomFieldResult {
  const hs = heirloomState(state);
  const benched = hs.fielded;
  state.heirlooms = { ...hs, fielded: undefined };
  return { ok: true, benched };
}

/** Current rank of one ability. Rank 1 is the free floor granted at recruitment. */
export function abilityRank(state: CampaignState, heirloomId: HeirloomId, abilityId: string): number {
  return heirloomState(state).abilityRanks[`${heirloomId}:${abilityId}`] ?? 1;
}

export interface AbilityRankResult {
  ok: boolean;
  reason?: string;
  newRank?: number;
  cost?: number;
}

/**
 * Raise one ability by one rank, spending the wielding pilot's PERSONAL
 * points.
 *
 * `pilotId` is passed in rather than derived because an Heirloom's holder
 * is not always its aristocrat: Requiem is Bosk's, then Rourke's, and the
 * assignment for the two aberrations is a story beat rather than a
 * recruitment. The caller knows who's holding it; this function only
 * enforces that they can pay.
 */
export function purchaseAbilityRank(
  state: CampaignState,
  heirloomId: HeirloomId,
  abilityId: string,
  pilotId: string,
): AbilityRankResult {
  const def = HEIRLOOMS[heirloomId];
  if (!def) return { ok: false, reason: `unknown heirloom: ${heirloomId}` };
  const ability = def.abilities.find((a) => a.id === abilityId);
  if (!ability) return { ok: false, reason: `${def.displayName} has no ability ${abilityId}` };
  const hs = heirloomState(state);
  if (!hs.recruited.includes(heirloomId)) {
    return { ok: false, reason: `${def.displayName} isn't with the company` };
  }
  // `recruited` alone is NOT enough, and this was a real hole: it is a
  // permanent record of picks made ever, so it still contains an Heirloom
  // its house has since taken back. Without this check a player could keep
  // buying ability ranks — with real personal points — for a weapon that
  // is no longer on the ship and can never be fielded again.
  if (isReturnedHome(state, heirloomId)) {
    return { ok: false, reason: `${def.pilot?.house ?? "The house"} took ${def.displayName} home — there is nothing left to train on` };
  }
  const entry = state.pilots[pilotId];
  if (!entry) return { ok: false, reason: `unknown pilot id: ${pilotId}` };
  if (entry.status !== "active") {
    return { ok: false, reason: `${entry.pilot.displayName} is not active — cannot spend points on a lost pilot` };
  }

  const current = abilityRank(state, heirloomId, abilityId);
  if (current >= HEIRLOOM_MAX_ABILITY_RANK) {
    return { ok: false, reason: `${ability.displayName} is already at rank ${HEIRLOOM_MAX_ABILITY_RANK}` };
  }
  const next = current + 1;
  const cost = HEIRLOOM_ABILITY_RANK_COST[next];
  if (cost === undefined) return { ok: false, reason: `no price is set for rank ${next}` };
  if (entry.personalPoints < cost) {
    return {
      ok: false,
      reason: `not enough personal points — ${ability.displayName} rank ${next} costs ${cost}, ${entry.pilot.displayName} has ${entry.personalPoints}`,
    };
  }

  entry.personalPoints -= cost;
  state.heirlooms = {
    ...hs,
    abilityRanks: { ...hs.abilityRanks, [`${heirloomId}:${abilityId}`]: next },
  };
  return { ok: true, newRank: next, cost };
}

/**
 * Build a shortlist of candidates to offer.
 *
 * Excludes anything already recruited; everything else stays eligible,
 * which is the doc's own "declined candidates can resurface later"
 * confirmed directly. Deterministic given `rng`, so a shortlist can be
 * replayed from a seed the same way a battle can (see MissionOptions.rng
 * for the same treatment).
 *
 * Returns fewer than HEIRLOOM_SHORTLIST_SIZE only when fewer candidates
 * remain — with 8 in the pool and a 3-pick budget that can't happen in a
 * normal campaign, but returning a short list beats padding it with
 * duplicates.
 */
export function rollHeirloomShortlist(
  state: CampaignState,
  rng: () => number = Math.random,
  size: number = HEIRLOOM_SHORTLIST_SIZE,
): HeirloomId[] {
  const hs = heirloomState(state);
  // Houses that have gone estranged stop putting names forward at all, so
  // the offer itself narrows — applied to whatever size the caller asked
  // for rather than only to the default, because a withdrawal is the
  // houses' decision, not the UI's. Floored at HEIRLOOM_SHORTLIST_MIN: a
  // shortlist of nothing is a lockout wearing a shortlist's clothes, and
  // the lockout already has its own, clearer expression in
  // recruitHeirloom's refusal.
  const offered = Math.max(HEIRLOOM_SHORTLIST_MIN, size - aristocracyStanding(state).shortlistPenalty);
  const pool = RECRUITABLE_HEIRLOOM_IDS.filter((id) => !hs.recruited.includes(id));
  // Fisher-Yates on a copy, so the source order isn't mutated and the
  // draw is uniform rather than the biased sort-by-random it's easy to
  // reach for.
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.max(0, offered));
}

/**
 * The Vault's actual read: the STANDING offer, rolling one only the first
 * time there's nothing stored, and returning the stored list on every call
 * after that. See HeirloomCampaignState.shortlist's own comment for why
 * this wraps the pure rollHeirloomShortlist instead of the UI calling that
 * directly.
 *
 * Returns [] without rolling or storing anything before Act II
 * (heirloomsUnlocked false) — an empty Vault panel that early is real
 * content (the houses aren't offering yet), not a placeholder waiting to
 * be filled.
 *
 * Cleared by a successful recruitHeirloom, so the call right after a pick
 * rolls a fresh three rather than showing a stale offer with the taken
 * name still on it.
 */
export function currentShortlist(state: CampaignState, rng: () => number = Math.random): HeirloomId[] {
  if (!heirloomsUnlocked(state)) return [];
  const hs = heirloomState(state);
  if (hs.shortlist) return hs.shortlist.ids;
  const ids = rollHeirloomShortlist(state, rng);
  state.heirlooms = { ...hs, shortlist: { ids, rolledAtRank: state.rourkeRank } };
  return ids;
}
