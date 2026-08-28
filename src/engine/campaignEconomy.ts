// src/engine/campaignEconomy.ts
// Campaign economy pass (22 Aug 2026), built directly on top of this
// morning's engine/campaignState.ts — read that file's own header first;
// this one assumes its roster-persistence design (campaign-owned pilot
// copies, live permadeath check, the two recruit tracks) and adds the
// points economy on top of it.
//
// The split into TWO pools (Maxime's brief, 22 Aug 2026, same day):
//   - PERSONAL points (CampaignPilotEntry.personalPoints, campaignState.ts)
//     — earned and spent per pilot, individually. Spendable only on that
//     pilot's own gear-tier upgrades and mek secondary purchases.
//   - COMPANY points (CampaignState.points, campaignState.ts — this field
//     predates this pass and was ambiguously "the shared pot" before it)
//     — fed by the mission-completion+performance formula and the Rourke
//     CO bonus; spent on discretionary recruiting (recruitDiscretionary,
//     campaignState.ts — unchanged) and spare mek parts (purchaseSpareParts,
//     below — new this pass).
//
// Kept in its own file rather than folded into campaignState.ts so that
// file can stay focused on "who's alive, what tier" roster state; this one
// owns "how points move." Every dollar figure below that is NOT already
// canon in the Data Pack is flagged inline as a placeholder judgment call,
// exactly like campaignState.ts's own DISCRETIONARY_RECRUIT_COST.
import type { MekTrack, Tier } from "../data/types";
import type { CampaignState, Rank, ReservedBayId } from "./campaignState";
import { ensureHubSocialState } from "./campaignState";
import type { Mission, UnitPerformance } from "./mission";
import { WEAPON_BRANCHES, WEAPON_BRANCHES_BY_PATH, WEAPON_BRANCH_COSTS, WEAPON_BRANCH_TIER_GATE, type WeaponBranchId } from "../data/weaponBranches";
import { UNIT_ARCHETYPES } from "../data/units";
import { stageFromTier } from "../data/ambientLines";

// ---- Personal points: earning -------------------------------------------

// Personal-earnings formula, REVISED 22 Aug 2026 against
// Qiraki_Weapons_And_Progression.md's "Scoring system, LOCKED" section
// (Maxime: "weapon and progression give you the per unit point system...
// only thing that isnt in it normaly is dmg point bonus because normally
// bloom unit doesnt have a lifepool"). That doc's own locked rule is
// "kills plus assists combined" — no damage-dealt term, for any target —
// so the old damagePoints/DAMAGE_POINTS_DIVISOR term is gone. What it
// counts against is engine/mission.ts's UnitPerformance.assistCredit
// (fractional kill-equivalents, accumulated by Mission itself — see that
// file's own ASSIST_MIN_FRACTION comment for the full canon citation and
// exactly how combat-assist vs. repair-assist credit gets earned), priced
// here the same way canon prices it — "a fraction of a full kill" — by
// literally multiplying it against KILL_BONUS, the same constant a whole
// kill uses. KILL_BONUS/SURVIVAL_BONUS/OBJECTIVE_BONUS themselves are
// otherwise unchanged from before this pass, still Maxime's own judgment
// call, unspecified in absolute point value anywhere in the design docs,
// flagged exactly like campaignState.ts's DISCRETIONARY_RECRUIT_COST —
// pending a real tuning pass once there's actual play data to weigh
// against.
export const KILL_BONUS = 5; // per finishing blow credited; an assist is priced as a fraction of this same value
export const SURVIVAL_BONUS = 5; // never downed this mission
export const OBJECTIVE_BONUS = 10; // deployed on a mission that ended in a win

/**
 * A pilot's personal earnings from one mission — finishing blows, combat/
 * repair assist credit, whether they were ever downed, and whether the
 * mission was won — all sourced from Mission.unitPerformance
 * (engine/mission.ts) plus Mission's own public outcome/deployedPilotIds.
 * Callable once a mission reaches its outcome (a win/loss result); calling
 * it mid-mission is not an error, it just scores objectiveBonus as 0
 * (mission.outcome isn't "win" yet) — everything else is a running total
 * that's already meaningful at any point.
 *
 * assistBonus rounds to the nearest whole point (Math.round, not floor) —
 * assistCredit is a sum of fractional kill-equivalents, not itself a point
 * value, so there's no "always round down" convention to preserve the way
 * there was for the old floor(damageDealt/divisor) term.
 *
 * Iterates `mission.deployedPilotIds` — every pilot who actually deployed,
 * which is `mission.mission.playerPilotIds` unless the transporter-pad
 * squad-selection pass (22 Aug 2026) gave Mission a real, possibly-smaller
 * DeployRosterEntry[] — rather than mission.units, so a pilot removed
 * mid-mission (the remove_from_roster event action) still gets scored for
 * whatever they did before that happened, using whatever unitPerformance
 * entry they accumulated; a pilot who somehow has no entry at all
 * (shouldn't happen — deployPlayerUnits() seeds one for every deployed id —
 * but this stays defensive rather than throwing) is scored as a zeroed
 * no-op mission.
 */
export function computeMissionEarnings(mission: Mission): Record<string, number> {
  const earnings: Record<string, number> = {};
  const won = mission.outcome === "win";
  for (const pilotId of mission.deployedPilotIds) {
    const perf: UnitPerformance = mission.unitPerformance[pilotId] ?? { damageDealt: 0, kills: 0, assistCredit: 0, wasDowned: false };
    const killBonus = KILL_BONUS * perf.kills;
    const assistBonus = Math.round(KILL_BONUS * perf.assistCredit);
    const survivalBonus = perf.wasDowned ? 0 : SURVIVAL_BONUS;
    const objectiveBonus = won ? OBJECTIVE_BONUS : 0;
    earnings[pilotId] = killBonus + assistBonus + survivalBonus + objectiveBonus;
  }
  return earnings;
}

/**
 * Adds each pilot's earned amount (computeMissionEarnings' output) to
 * their own personalPoints. Silently skips a pilotId with no matching
 * campaign roster entry (an earnings record for a pilot the caller's
 * CampaignState doesn't know about — shouldn't happen in practice, but
 * this stays defensive rather than throwing) and, deliberately, any pilot
 * whose status isn't "active": a pilot already flagged permanently_lost
 * (applyPermadeathCheck, campaignState.ts) never receives new
 * personalPoints either. This is belt-and-suspenders with that function's
 * own zeroing of a lost pilot's banked balance — between the two, this
 * behaves correctly regardless of which order a future debrief screen
 * calls them in (permadeath-then-earnings, or earnings-then-permadeath).
 */
export function applyMissionEarnings(state: CampaignState, earnings: Record<string, number>): void {
  for (const [pilotId, amount] of Object.entries(earnings)) {
    const entry = state.pilots[pilotId];
    if (!entry || entry.status !== "active") continue;
    entry.personalPoints += amount;
  }
}

// ---- Personal points: spending — gear tier and mek secondary -----------

// Exported (Debrief pass, 22 Aug 2026) so scenes/Debrief.ts can read a
// pilot's next tier for a cost-preview label without duplicating this
// ordering or mutating state via purchaseTierUpgrade just to peek at it.
export const TIER_ORDER: Tier[] = ["G", "F", "E", "D", "C", "B", "A"];

// Data Pack §12.1's own costs, transcribed, not invented here.
export const TIER_UPGRADE_COST: Record<Exclude<Tier, "A">, number> = {
  G: 60,
  F: 90,
  E: 140,
  D: 210,
  C: 320,
  B: 500,
};

export interface TierPurchaseResult {
  ok: boolean;
  reason?: string;
  newTier?: Tier;
  cost?: number;
}

/**
 * Steps `pilotId`'s campaign-persistent gear tier up by exactly one rung,
 * deducting the Data Pack §12.1 cost from their PERSONAL balance. Fails
 * cleanly (state untouched, a reason string) on an unknown pilot, a
 * non-active (permanently lost) pilot, an already-A-tier pilot, or
 * insufficient personal points.
 *
 * Deliberately does NOT implement the Data Pack §12.2 Quartermaster
 * discount (a mek's Quartermaster track shaves a fraction off this cost)
 * — out of scope for this pass: the brief's own cost table gives flat
 * numbers with no mention of the discount, and no mek in the current live
 * roster (WARDEN_MEKS, data/campaignAmaranth.ts) carries Quartermaster as
 * a track anyway, so there's nothing yet for it to apply to. Flagged here
 * as a known gap rather than silently ignored, cheap to add later — the
 * discount only needs to touch this one cost lookup.
 */
export function purchaseTierUpgrade(state: CampaignState, pilotId: string): TierPurchaseResult {
  const entry = state.pilots[pilotId];
  if (!entry) return { ok: false, reason: `unknown pilot id: ${pilotId}` };
  if (entry.status !== "active") {
    return { ok: false, reason: `${entry.pilot.displayName} is not active — cannot spend points on a lost pilot` };
  }
  const idx = TIER_ORDER.indexOf(entry.pilot.tier);
  if (idx === TIER_ORDER.length - 1) {
    return { ok: false, reason: `${entry.pilot.displayName} is already at tier A — nothing further to buy` };
  }
  const cost = TIER_UPGRADE_COST[entry.pilot.tier as Exclude<Tier, "A">];
  if (entry.personalPoints < cost) {
    return {
      ok: false,
      reason: `not enough personal points — ${entry.pilot.tier}→${TIER_ORDER[idx + 1]} costs ${cost}, ${entry.pilot.displayName} has ${entry.personalPoints}`,
    };
  }
  entry.personalPoints -= cost;
  const oldStage = stageFromTier(entry.pilot.tier);
  entry.pilot.tier = TIER_ORDER[idx + 1];

  // Stage-promotion timestamp, 28 Aug 2026 — Maxime, closing the
  // STAGE_MOMENT gap the Recall Item 3 delivery flagged: "highlight reel
  // should date itself with calandar. down to the sec." This is the real
  // event — the actual moment a purchase crosses a Stage boundary — so
  // it's recorded HERE, not backfilled later whenever the Hub scene next
  // happens to rebuild its NPCs. Epoch ms (Date.now()), same precision
  // every other dated field in this codebase already uses
  // (SocialLogEntry.at, HubPilotSocialState.drunkUntil) — well past "down
  // to the sec." Only writes once per Stage: an already-recorded entry for
  // the newly-reached Stage is left untouched (shouldn't be reachable in
  // practice, since a pilot can only cross into a given Stage once ever —
  // tiers only move up, never down — but this stays defensive rather than
  // clobbering a real timestamp on the off chance something calls this
  // twice for the same transition).
  const newStage = stageFromTier(entry.pilot.tier);
  if (newStage !== oldStage) {
    const social = ensureHubSocialState(state, pilotId, { favorability: 0, stress: 0, morale: 0 });
    social.stagePromotedAt = social.stagePromotedAt ?? {};
    if (social.stagePromotedAt[newStage] === undefined) {
      social.stagePromotedAt[newStage] = Date.now();
    }
  }

  return { ok: true, newTier: entry.pilot.tier, cost };
}

// Data Pack §12.1's own cost, transcribed, not invented here.
export const MEK_SECONDARY_COST = 180;

export interface SecondaryPurchaseResult {
  ok: boolean;
  reason?: string;
  track?: MekTrack;
  cost?: number;
}

/**
 * Adds `track` as `pilotId`'s mek's secondary specialisation, deducting
 * MEK_SECONDARY_COST from that pilot's PERSONAL balance. Fails cleanly on
 * an unknown pilot/mek, a non-active pilot, a mek that already has a
 * secondary (Data Pack §12.1: "once per mek"), or insufficient personal
 * points.
 */
export function purchaseMekSecondary(state: CampaignState, pilotId: string, track: MekTrack): SecondaryPurchaseResult {
  const entry = state.pilots[pilotId];
  if (!entry) return { ok: false, reason: `unknown pilot id: ${pilotId}` };
  if (entry.status !== "active") {
    return { ok: false, reason: `${entry.pilot.displayName} is not active — cannot spend points on a lost pilot` };
  }
  const mek = state.meks[entry.pilot.mekId];
  if (!mek) return { ok: false, reason: `unknown mek id: ${entry.pilot.mekId}` };
  if (mek.secondary) {
    return { ok: false, reason: `${mek.displayName} already has a secondary (${mek.secondary}) — only one per mek, per Data Pack §12.1` };
  }
  // Judgment call, not specified anywhere in the brief or the Data Pack:
  // refusing a secondary identical to the mek's own primary. A second
  // copy of the same track would just double an existing bonus rather
  // than open a new one, which doesn't match "specialisation" as a
  // concept — cheap to relax later if that reading turns out wrong.
  if (mek.primary === track) {
    return { ok: false, reason: `${mek.displayName}'s primary is already ${track} — pick a different track for the secondary` };
  }
  if (entry.personalPoints < MEK_SECONDARY_COST) {
    return {
      ok: false,
      reason: `not enough personal points — a mek secondary costs ${MEK_SECONDARY_COST}, ${entry.pilot.displayName} has ${entry.personalPoints}`,
    };
  }
  entry.personalPoints -= MEK_SECONDARY_COST;
  mek.secondary = track;
  return { ok: true, track, cost: MEK_SECONDARY_COST };
}

// ---- Company points: spending — spare mek parts -------------------------

// Data Pack §12.1's own cost, transcribed, not invented here.
export const SPARE_PART_COST = 40;

// Fabricator (Antfarm buildable bay, 28 Aug 2026) — see
// claude/Bloom_Wars_Antfarm_Carrier_Hub_v1.md §11.2 for the room itself.
// Deliberately does NOT grant a spare-parts cap to a mek with no Fabricator
// track at all (primary or secondary) — the bay raises the ceiling for a
// mek already routed through Fabricator, it doesn't open the track up to
// every mek in the roster. First-pass placeholder, same "not run through
// combat_sim.py, needs real playtesting" status as SPARE_PART_COST's
// neighbors in this file.
export const FABRICATOR_BAY_CAP_BONUS = 1;

/**
 * Data Pack §12.1: "Up to the Fabricator track maximum (2 primary, 1
 * secondary)." Exported (Debrief pass, 22 Aug 2026) so the debrief shop can
 * decide which meks have anywhere to put a spare part before calling
 * purchaseSpareParts, instead of re-deriving this rule in scenes/Debrief.ts.
 *
 * `builtBays` (28 Aug 2026, Fabricator pass) is optional and defaults to
 * none built, so every pre-existing call site keeps returning exactly what
 * it always did until it's updated to pass the campaign's real builtBays.
 */
export function fabricatorMaxSpareParts(mek: { primary: MekTrack; secondary: MekTrack | null }, builtBays: ReservedBayId[] = []): number {
  const base = mek.primary === "fabricator" ? 2 : mek.secondary === "fabricator" ? 1 : 0;
  if (base === 0) return 0;
  return builtBays.includes("fabricator") ? base + FABRICATOR_BAY_CAP_BONUS : base;
}

export interface SparePartsPurchaseResult {
  ok: boolean;
  reason?: string;
  spareParts?: number;
  cost?: number;
}

/**
 * Adds one spare part to `mekId`, deducting SPARE_PART_COST from the
 * COMPANY pool — deliberately NOT personal, unlike the two purchases
 * above. Judgment call (flagged per this pass's brief): the design docs
 * never had to say which pool spare parts draw from, since the two-pool
 * split is new this pass. Spare mek parts are logistics/equipment for the
 * mek itself — not an investment in growing one specific pilot the way a
 * gear tier or a mek secondary is — so this reading is what keeps
 * "personal points only ever buy that pilot's own growth" true without
 * exception, and matches the GDD's own framing of spare parts as a
 * campaign-wide logistics resource (§6.3: "Spare parts are a campaign
 * resource, not a per-mission one").
 *
 * Fails cleanly on an unknown mek, a mek with no Fabricator track at all
 * (primary or secondary), a mek already at its Fabricator-track maximum,
 * or insufficient company points.
 */
export function purchaseSpareParts(state: CampaignState, mekId: string): SparePartsPurchaseResult {
  const mek = state.meks[mekId];
  if (!mek) return { ok: false, reason: `unknown mek id: ${mekId}` };
  const max = fabricatorMaxSpareParts(mek, state.builtBays ?? []);
  if (max === 0) {
    return { ok: false, reason: `${mek.displayName} has no Fabricator track (primary or secondary) — cannot hold spare parts` };
  }
  if (mek.spareParts >= max) {
    return { ok: false, reason: `${mek.displayName} is already at its Fabricator track maximum (${max})` };
  }
  if (state.points < SPARE_PART_COST) {
    return { ok: false, reason: `not enough company points — a spare part costs ${SPARE_PART_COST}, company has ${state.points}` };
  }
  state.points -= SPARE_PART_COST;
  mek.spareParts += 1;
  return { ok: true, spareParts: mek.spareParts, cost: SPARE_PART_COST };
}

// ---- Personal points: spending — Weapon Branch Point System ------------
//
// claude/Bloom_Wars_Weapon_Branch_Point_System_v1.md, decided 27 Aug 2026,
// data model in data/weaponBranches.ts. Same personal-pool shape as
// purchaseTierUpgrade/purchaseMekSecondary above: priced off, and
// deducted from, the buying pilot's own personalPoints — never the
// company pool, matching "personal points only ever buy that pilot's own
// growth" (see purchaseSpareParts' own comment for why spare parts are
// the one exception, and why this isn't another one).
//
// Cost and tier-gate are keyed by PURCHASE ORDER — how many branches this
// pilot already owns, i.e. entry.pilot.ownedWeaponBranches.length — not by
// which branch, per the source doc's own §3/§9. WEAPON_BRANCH_COSTS/
// WEAPON_BRANCH_TIER_GATE (data/weaponBranches.ts) are both indexed that
// way already; this function just looks them up.

export interface WeaponBranchPurchaseResult {
  ok: boolean;
  reason?: string;
  branchId?: WeaponBranchId;
  cost?: number;
}

/**
 * Buys `branchId` for `pilotId` — permanent, added to their
 * ownedWeaponBranches — deducting the cost from their PERSONAL balance.
 * Does NOT equip it (see equipWeaponBranch below); a pilot can own several
 * branches and only ever has one active at a time.
 *
 * Fails cleanly on an unknown pilot, a non-active pilot, a branch that
 * doesn't exist on this pilot's own path (WEAPON_BRANCHES_BY_PATH — a
 * Meeps pilot can't buy a Reeps branch), a branch this pilot already owns
 * (buying the same branch twice would just waste points — nothing in the
 * source doc suggests duplicates do anything), a pilot whose current gear
 * tier hasn't reached this purchase's tier gate yet (WEAPON_BRANCH_TIER_GATE
 * — the Nth branch bought needs at least the Nth tier in TIER_ORDER above,
 * D/C/B/A respectively), or insufficient personal points.
 */
export function purchaseWeaponBranch(state: CampaignState, pilotId: string, branchId: WeaponBranchId): WeaponBranchPurchaseResult {
  const entry = state.pilots[pilotId];
  if (!entry) return { ok: false, reason: `unknown pilot id: ${pilotId}` };
  if (entry.status !== "active") {
    return { ok: false, reason: `${entry.pilot.displayName} is not active — cannot spend points on a lost pilot` };
  }
  const archetype = UNIT_ARCHETYPES[entry.pilot.archetypeId];
  if (!archetype) return { ok: false, reason: `unknown archetype id: ${entry.pilot.archetypeId}` };
  const branch = WEAPON_BRANCHES[branchId];
  const buildableForPath = WEAPON_BRANCHES_BY_PATH[archetype.path] ?? [];
  if (!branch || !buildableForPath.includes(branchId)) {
    return { ok: false, reason: `${branchId} is not a valid weapon branch for ${entry.pilot.displayName}'s path (${archetype.path})` };
  }
  const owned = entry.pilot.ownedWeaponBranches ?? [];
  if (owned.includes(branchId)) {
    return { ok: false, reason: `${entry.pilot.displayName} already owns ${branch.displayName}` };
  }
  const purchaseIndex = owned.length; // 0 = this pilot's 1st branch, 1 = 2nd, etc.
  if (purchaseIndex >= WEAPON_BRANCH_COSTS.length) {
    return { ok: false, reason: `${entry.pilot.displayName} already owns the maximum number of weapon branches` };
  }
  const requiredTier = WEAPON_BRANCH_TIER_GATE[purchaseIndex];
  const tierIdx = TIER_ORDER.indexOf(entry.pilot.tier);
  const requiredIdx = TIER_ORDER.indexOf(requiredTier);
  if (tierIdx < requiredIdx) {
    return {
      ok: false,
      reason: `${entry.pilot.displayName} needs gear tier ${requiredTier}+ to buy their ${ordinal(purchaseIndex + 1)} weapon branch (currently ${entry.pilot.tier})`,
    };
  }
  const cost = WEAPON_BRANCH_COSTS[purchaseIndex];
  if (entry.personalPoints < cost) {
    return {
      ok: false,
      reason: `not enough personal points — ${branch.displayName} costs ${cost}, ${entry.pilot.displayName} has ${entry.personalPoints}`,
    };
  }
  entry.personalPoints -= cost;
  entry.pilot.ownedWeaponBranches = [...owned, branchId];
  return { ok: true, branchId, cost };
}

function ordinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

export interface WeaponBranchEquipResult {
  ok: boolean;
  reason?: string;
  equipped?: WeaponBranchId | null;
}

/**
 * Sets `pilotId`'s ACTIVE weapon branch for their next mission — free
 * (Option B, source doc's own decision: "collect-and-swap," no cost or
 * cooldown to switch between branches already owned). Pass `null` to
 * unequip back to the pilot's plain default weapon.
 *
 * Fails cleanly on an unknown pilot, a non-active pilot, or a branch this
 * pilot hasn't purchased yet (equipping is not the same gate as owning —
 * see purchaseWeaponBranch above for how a branch is actually acquired).
 */
export function equipWeaponBranch(state: CampaignState, pilotId: string, branchId: WeaponBranchId | null): WeaponBranchEquipResult {
  const entry = state.pilots[pilotId];
  if (!entry) return { ok: false, reason: `unknown pilot id: ${pilotId}` };
  if (entry.status !== "active") {
    return { ok: false, reason: `${entry.pilot.displayName} is not active` };
  }
  if (branchId !== null) {
    const owned = entry.pilot.ownedWeaponBranches ?? [];
    if (!owned.includes(branchId)) {
      return { ok: false, reason: `${entry.pilot.displayName} doesn't own ${WEAPON_BRANCHES[branchId]?.displayName ?? branchId} yet` };
    }
  }
  entry.pilot.equippedWeaponBranch = branchId ?? undefined;
  return { ok: true, equipped: branchId };
}

// ---- Personal points: the conversion valve ------------------------------
//
// claude/Bloom_Wars_Weapon_Branch_Point_System_v1.md §5, decided 27 Aug
// 2026 — a universal release valve, not specific to Weapon Branch, for two
// reasons the source doc names explicitly: (1) a pilot who's bought
// everything (tier maxed, mek secondary, all owned weapon branches) would
// otherwise have nowhere for new personal points to go, and (2) a
// permanently-lost pilot's banked personal points are zeroed outright by
// applyPermadeathCheck (campaignState.ts) — this gives a player a real,
// deliberate way to hedge that before a mission they're worried about,
// rather than just watching the balance evaporate if the worst happens.
//
// One-directional only — company points never convert back to personal —
// and deliberately lossy, so it reads as a real sacrifice rather than a
// free way to launder a maxed-out pilot's idle points into shared spending
// power (Maxime's own framing: a rate "bad enough that converting is a
// real sacrifice, not a free insurance policy"). The 2:1 rate is
// confirmed staying a placeholder — "conversion would be adjust in
// testing," Maxime, 27 Aug 2026 — until there's a real economy-sim harness
// to tune it against, the same discipline combat_sim.py already holds for
// balance numbers but that this project doesn't have an equivalent tool
// for yet on the economy side.

export const CONVERSION_RATE = 2; // N personal points -> floor(N / CONVERSION_RATE) company points

export interface ConversionResult {
  ok: boolean;
  reason?: string;
  personalSpent?: number;
  companyGained?: number;
}

/**
 * Converts `amount` of `pilotId`'s PERSONAL points into COMPANY points at
 * the placeholder CONVERSION_RATE (floor, so an odd amount loses the
 * remainder rather than rounding in the player's favor — e.g. converting
 * 5 personal points yields 2 company points, not 2.5 or 3). There is no
 * inverse function; this only ever moves value personal -> company, never
 * back, matching the source doc's own asymmetry between the two pools
 * (personal is scarce and pilot-specific, company is the shared, more
 * fungible pool).
 *
 * Fails cleanly (state untouched, a reason string) on an unknown pilot, a
 * non-active pilot, a non-positive amount, or insufficient personal
 * points — never partially converts.
 */
export function convertPersonalToCompany(state: CampaignState, pilotId: string, amount: number): ConversionResult {
  const entry = state.pilots[pilotId];
  if (!entry) return { ok: false, reason: `unknown pilot id: ${pilotId}` };
  if (entry.status !== "active") {
    return { ok: false, reason: `${entry.pilot.displayName} is not active — cannot convert a lost pilot's points` };
  }
  if (amount <= 0) {
    return { ok: false, reason: `conversion amount must be positive (got ${amount})` };
  }
  if (entry.personalPoints < amount) {
    return {
      ok: false,
      reason: `not enough personal points — ${entry.pilot.displayName} has ${entry.personalPoints}, tried to convert ${amount}`,
    };
  }
  entry.personalPoints -= amount;
  const companyGained = Math.floor(amount / CONVERSION_RATE);
  state.points += companyGained;
  return { ok: true, personalSpent: amount, companyGained };
}

// ---- Company points: earning — mission completion + CO bonus -----------

export interface MissionCompletionBonus {
  base: number;
  turnsUnderLimitBonus: number;
  noPilotDownedBonus: number;
  noSparePartsSpentBonus: number;
  noSeveranceBonus: number;
  total: number;
}

/**
 * Data Pack §12.3's mission-completion + performance-bonus formula,
 * COMPANY-pool money — nothing in this codebase computed or routed this
 * anywhere before this pass (flagged per the brief: "if this scoring
 * isn't implemented anywhere yet, implement a reasonable version of it").
 * The point values below (base reward, +10/turn, +40, +30, +25) are the
 * Data Pack's own, not invented here; three implementation choices this
 * function makes ARE judgment calls, since the doc doesn't spell out how
 * they map onto this engine's actual state:
 *
 *   1. Gated entirely on `mission.outcome === "win"` — the §12.3 table is
 *      headed "Mission completed"; a loss earns none of it. This is a
 *      real, deliberate contrast with computeMissionEarnings above, where
 *      only the objectiveBonus term is win-gated and damage/kills/
 *      survival pay out regardless of outcome — personal growth rewards
 *      individual effort even in a loss; company money specifically
 *      rewards completing the mission.
 *   2. "No spare mek parts spent" (+30) is scored as always true. The
 *      mid-mission Fabricator spend this bonus is about doesn't exist as
 *      a system yet — campaignState.ts's own header notes spare parts
 *      currently only ever move through the between-mission shop, never
 *      spent mid-mission — so there is nothing for any mission to have
 *      spent. Revisit the moment that system gets built.
 *   3. The Severance bonus (+25) is scored via
 *      `mission.mission.heirloomCharge === "available"` rather than an
 *      actual "was Severance used" flag, because Severance itself isn't
 *      implemented as a usable ability anywhere in engine/combat.ts yet.
 *      Every Amaranth mission built so far ships heirloomCharge:
 *      "locked" (data/campaignAmaranth.ts), so this term is always 0 for
 *      the current 4-mission slice — correctly inert rather than wrongly
 *      awarding a bonus for an ability nobody can use yet.
 *
 * `mission.turn` at the moment a mission's outcome flips to "win" is read
 * as "turns actually used" — see Mission.finishWin()/checkWinLoss() in
 * engine/mission.ts, which never increments `turn` again once outcome
 * stops being "ongoing".
 */
export function computeMissionCompletionBonus(mission: Mission): MissionCompletionBonus {
  if (mission.outcome !== "win") {
    return { base: 0, turnsUnderLimitBonus: 0, noPilotDownedBonus: 0, noSparePartsSpentBonus: 0, noSeveranceBonus: 0, total: 0 };
  }
  const base = mission.mission.rewardPoints;
  const turnLimit = mission.mission.objectiveParams.turnLimit;
  const turnsUnder = Math.max(0, turnLimit - mission.turn);
  const turnsUnderLimitBonus = turnsUnder * 10;
  const noPilotDowned = Object.values(mission.unitPerformance).every((p) => !p.wasDowned);
  const noPilotDownedBonus = noPilotDowned ? 40 : 0;
  const noSparePartsSpentBonus = 30; // always true this pass — see note 2 above
  const noSeveranceBonus = mission.mission.heirloomCharge === "available" ? 25 : 0; // see note 3 above
  const total = base + turnsUnderLimitBonus + noPilotDownedBonus + noSparePartsSpentBonus + noSeveranceBonus;
  return { base, turnsUnderLimitBonus, noPilotDownedBonus, noSparePartsSpentBonus, noSeveranceBonus, total };
}

const ROURKE_PILOT_ID = "pilot_rourke";

// Placeholder CO-bonus amounts — Maxime's own judgment call, unspecified
// in the design docs, flagged exactly like campaignState.ts's
// DISCRETIONARY_RECRUIT_COST. Company points Rourke contributes every
// mission just for being CO, scaled by her current rank
// (CampaignState.rourkeRank) — unconditional, not tied to performance or
// mission outcome (contrast with computeMissionCompletionBonus above,
// which is entirely win-gated). Strictly additive to, never a substitute
// for, her own personal earnings from computeMissionEarnings — the two
// functions read entirely different data and neither call site should
// ever let one stand in for the other.
export const CO_BONUS_BY_RANK: Record<Rank, number> = {
  "2nd_lt": 10,
  capt: 20,
  maj: 35,
};

/**
 * Zero unless pilot_rourke both deployed on this specific mission
 * (`mission.deployedPilotIds` — see that field's own doc comment in
 * engine/mission.ts for why this reads that instead of
 * mission.mission.playerPilotIds) and is currently active in the campaign
 * roster. Judgment call: "contributes EXTRA company points every mission"
 * is read as "every mission she's actually in," not literally every
 * mission regardless of whether she deployed — she can't act as CO of a
 * fight she wasn't at. In practice she can never be permanently_lost
 * (PilotRecord.exemptFromPermadeath, data/campaignAmaranth.ts), so the
 * active-status check only ever matters for a synthetic/test CampaignState
 * that omits her entirely — and, as of the transporter-pad squad-selection
 * pass, for a real deploy selection that simply leaves her on the bench.
 */
export function computeCoBonus(state: CampaignState, mission: Mission): number {
  if (!mission.deployedPilotIds.includes(ROURKE_PILOT_ID)) return 0;
  const entry = state.pilots[ROURKE_PILOT_ID];
  if (!entry || entry.status !== "active") return 0;
  return CO_BONUS_BY_RANK[state.rourkeRank];
}

export interface CompanyEarningsResult {
  completionBonus: MissionCompletionBonus;
  coBonus: number;
  totalAdded: number;
}

/**
 * The company pool's single mission-end entry point: computes both
 * sources (the completion+performance formula and the Rourke CO bonus)
 * and adds their sum to state.points explicitly, right here — the one
 * place either number actually touches campaign state. Returns the full
 * breakdown too, for a future debrief screen to display without having
 * to re-derive it.
 */
export function applyCompanyEarnings(state: CampaignState, mission: Mission): CompanyEarningsResult {
  const completionBonus = computeMissionCompletionBonus(mission);
  const coBonus = computeCoBonus(state, mission);
  state.points += completionBonus.total + coBonus;
  return { completionBonus, coBonus, totalAdded: completionBonus.total + coBonus };
}

// ---- Company points: earning — bonus objectives -------------------------

/**
 * Generalized bonus-objective points pass (24 Aug 2026, Maxime: "keep the
 * rescue pilot and bloom patch thing around we are gonna use those as
 * special objectif player can complete during mission for extra point").
 * Reads whichever outcome field on the live Mission actually resolved
 * (engine/mission.ts's rescueOutcome for a rescue_pilot bonusObjective,
 * clearBloomPatchOutcome for a clear_bloom_patch one — a mission carries
 * at most one bonusObjective, so at most one of the two fields is ever
 * relevant) and returns that objective's own bonusPoints if it succeeded,
 * 0 for a mission with no bonusObjective at all, a still-pending one, or
 * (rescue only — clear_bloom_patch has no failure state) a failed one.
 *
 * Deliberately NOT gated on mission.outcome === "win", unlike
 * computeMissionCompletionBonus above — a bonus objective is scored as its
 * own achievement, independent of whether the mission's own main
 * objective was won or lost. scenes/Debrief.ts's rescue-callout reveal
 * already reads this way (`mission.rescueOutcome === "succeeded"`, no
 * outcome check anywhere near it, predating this function); this just
 * prices what that condition already governed, rather than changing when
 * it applies.
 */
export function computeBonusObjectivePoints(mission: Mission): number {
  const bonus = mission.mission.bonusObjective;
  if (!bonus) return 0;
  if (bonus.kind === "rescue_pilot") {
    return mission.rescueOutcome === "succeeded" ? bonus.bonusPoints : 0;
  }
  return mission.clearBloomPatchOutcome === "succeeded" ? bonus.bonusPoints : 0;
}

/**
 * Adds computeBonusObjectivePoints' result to the COMPANY pool
 * (state.points), returning the amount added. A bonus objective is
 * squad-level achievement, not an individual pilot's combat performance
 * metric, so it's priced through the same pool applyCompanyEarnings feeds
 * rather than any one pilot's personalPoints — Rourke or whoever else
 * doesn't personally bank it just for being deployed on the mission that
 * happened to carry one.
 *
 * Kept as its own function/call rather than folded into
 * applyCompanyEarnings itself: that function's own doc comment already
 * names it as covering exactly two sources (the completion formula and
 * the Rourke CO bonus), and a bonus objective's win-independence (see
 * computeBonusObjectivePoints' own comment above) means it doesn't
 * actually share that function's gating logic — merging them would just
 * move an "is this one win-gated or not" branch inside it instead of
 * keeping the two concerns apart. scenes/Debrief.ts calls both, once
 * each, at the same point in its own mission-end sequence.
 */
export function applyBonusObjectivePoints(state: CampaignState, mission: Mission): number {
  const amount = computeBonusObjectivePoints(mission);
  state.points += amount;
  return amount;
}
