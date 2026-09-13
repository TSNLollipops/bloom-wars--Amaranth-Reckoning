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
import { MEK_TRACK_EFFECTS } from "../data/meks";
import type { CampaignState, Rank, ReservedBayId } from "./campaignState";
import { CARRIER_MODULES, FABRICATION_BAY_CAP_BONUS, type CarrierModuleId } from "../data/carrierModules";
import { ensureHubSocialState } from "./campaignState";
import type { Mission, UnitPerformance } from "./mission";
import { WEAPON_BRANCHES, WEAPON_BRANCHES_BY_PATH, WEAPON_BRANCH_COSTS, WEAPON_BRANCH_TIER_GATE, type WeaponBranchId } from "../data/weaponBranches";
import { UNIT_ARCHETYPES } from "../data/units";
import { stageFromTier } from "../data/ambientLines";
import {
  FRAME_SYSTEMS,
  FRAME_REFITS,
  FRAME_REFITS_BY_PATH,
  FRAME_REFIT_COST,
  FRAME_REFIT_TIER_GATE,
  frameSystemPointCost,
  frameSystemDrawFor,
  type FrameSystemId,
  type FrameRefitId,
} from "../data/frameSystems";
import { BLOOM } from "../data/bloom";
import { CAMPAIGNS } from "../data/allCampaigns";
import { hostileKillCount } from "./campaignState";
import {
  equippedWeaponBranchesOf,
  setEquippedWeaponBranches,
  mountsFor,
  drawCapacityFor,
  ownedFrameSystemsOf,
  equippedFrameSystemsWithinDraw,
  frameDrawUsed,
} from "./frameSystems";

// ---- Personal points: earning -------------------------------------------

// Personal-earnings formula, REVISED 22 Aug 2026 against
// the book project's Weapons_And_Progression.md, "Scoring system, LOCKED" section
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
// kill uses.
//
// Retuned 5 Sep 2026 — Maxime, after actually watching the Shop's personal-
// point costs against how slowly they came in: "point take a while to get,
// we should increase the average." Put the actual target to him directly
// (personal points were spending-side documented — weapon branches
// 150/220/300/400, tier ladder G-A totalling 1320, Mek secondary 180, a
// full max-out on one pilot costs 2570 personal points — but nothing on
// the earning side had ever been sized against that total): his call was
// a favorite pilot should be able to fully max out — tier A, all 4 weapon
// branches, Mek secondary — well inside one campaign, roughly by the
// mission-25-to-30 mark of Warden Company's 36. All three constants below
// scale 3x from their previous 5/5/10 values to hit that: a central,
// frequently-deployed pilot averaging a couple kills a mission, usually
// surviving, mostly on winning missions, lands in that range by the math
// above. A support-role pilot (fewer kills, more assist fractions) earns
// slower and won't fully max by the same point — that's the intended
// shape, not an oversight; everyone gets meaningfully geared, only the
// squad's real focus pilot is expected to hit the ceiling.
//
// Retuned AGAIN 6 Sep 2026 — the Frame Systems Layer economy sim harness
// (npm run sim:economy, see Bloom_Wars_Build_Log_Addendum_
// FrameSystemsEconomySimHarness_06Sep2026.md) found the 5 Sep numbers above
// no longer hit their own target once Frame Systems adds a 5th purchase
// category (the one-time A-tier Refit, PLACEHOLDER_REFIT_COST = 350) on
// top of the old 2570-point max-out list, for a new 2920-point total:
// the "anchor" pilot archetype (heaviest-deployed, ~95% of missions) only
// fully maxed out 48% of the time across a 25-company/900-pilot pass,
// averaging mission 34 of 36 when it did — later than the "mission 25-30"
// target the 5 Sep retune itself was sized against. Worse: a "bench"
// archetype (~25% deployment) never reached even tier C (the 2nd mount,
// 500 points up the G-A ladder) 94-100% of the time — the exact "can't
// afford a second mount" failure mode §12 of the design doc names by name.
//
// Maxime's call, put to him directly with both those numbers and two
// candidate fixes (raise these three constants again — touches the whole
// economy — or lower Frame Systems' own Refit/system costs specifically):
// raise the earn rate. Landed on KILL_BONUS 18 / SURVIVAL_BONUS 26 /
// OBJECTIVE_BONUS 46 (up from 15/15/30) by iterating against the harness
// itself rather than guessing — this is the first configuration where
// NEITHER of the harness's own two named failure modes fires: at n=300
// companies (2 seeds checked), anchor fully maxes 100% of the time,
// averaging mission ~25.8 (back inside the 25-30 target, with only
// ~25-27% finishing before Act III, i.e. not the OTHER failure mode of
// maxing out too early), and bench pilots now reach tier C 52-54% of the
// time (was 0-6%) — a real majority rather than a rare exception, though
// still not a sure thing, which is an honest, not-fully-solved shape: a
// flat per-mission bonus inherently helps a 95%-deployed pilot's TOTAL far
// more than a 25%-deployed one even at the same per-mission rate, so this
// is the best trade-off found within "adjust these three constants," not
// proof the deployment-frequency gap itself is closed. Full before/after
// numbers: the dated build-log addendum for this retune. Reuses this
// file's own established pattern (comment stays, dated, rather than
// overwriting the 5 Sep rationale above it) since a future session hitting
// a THIRD retune need should be able to read why both prior ones happened.
// Retuned a THIRD time, 8 Sep 2026 — Maxime's report: "i shouldnt be in
// rank e after one mission. that just too big a jump." Verified against
// the real numbers first: at 5+ kills, survived, won, a pilot earned 162
// points in one mission — enough to buy BOTH the G->F and F->E upgrades
// (150) in a single go. Real and reproducible, not a fluke.
//
// His literal ask was to halve all three constants. Tested that against
// npm run sim:economy (300 companies, seed 1) before shipping it: it does
// cap every mission at one tier-up, but it also breaks the "favorite pilot
// fully maxes out well inside one campaign" goal from the 5/6 Sep retunes
// above — the anchor archetype never fully maxed out even once across 300
// simulated companies (final tier averaged ~B, not A).
//
// Shipped instead: KILL_BONUS only, 18 -> 9, SURVIVAL_BONUS/OBJECTIVE_BONUS
// left at 26/46. Same fix on the actual complaint — even a 6-kill mission
// now tops out at one tier-up (126 points, short of the 150 needed for
// two) — while the anchor archetype still fully maxes out 97% of the time
// (was 100%), just later (avg mission 31.8, was 25.8), comfortably inside
// the 36-mission campaign. Real cost, put to Maxime alongside the numbers
// rather than hidden: bench pilots' odds of ever reaching tier C (the
// second mount) drop from 53% to 38% — a known failure mode this harness
// already flags, made a bit worse, not a new one. Maxime's call, given
// both options with real numbers: "sadly I think well have to kill the
// kill bonus." Full account: Bloom_Wars_Sync_Note_08Sep2026_
// WeaponBranchAndEarnRate.md.
export const KILL_BONUS = 9; // per finishing blow credited; an assist is priced as a fraction of this same value
export const SURVIVAL_BONUS = 26; // never downed this mission
export const OBJECTIVE_BONUS = 46; // deployed on a mission that ended in a win

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
// THE PURCHASE LADDER, and deliberately not the full Tier union — 2 Sep
// 2026. "S" exists in data/types.ts's Tier but is intentionally absent
// here, because this array is what defines what a pilot can climb TO with
// points: upgradeTier reads the current tier's index and moves to index+1,
// and the shop's own "already maxed" check is `idx === TIER_ORDER.length -
// 1`. Appending "S" would therefore let any pilot in the game simply BUY
// S-tier, which is exactly the premise the Heirloom pool depends on not
// being possible (aristocrat mechs, 3 per campaign, one fielded at a
// time). S is granted with an Heirloom and by nothing else.
//
// Consequence worth knowing: TIER_ORDER.indexOf(tier) returns -1 for an
// S-tier pilot. Every caller here handles that already — upgradeTier's own
// guard below refuses them explicitly rather than relying on the
// arithmetic — but a NEW caller that assumes indexOf always succeeds would
// be wrong. See data/types.ts's Tier for the other half of this note.
export const TIER_ORDER: Tier[] = ["G", "F", "E", "D", "C", "B", "A"];

// Data Pack §12.1's own costs, transcribed, not invented here. Keyed by
// the tier being upgraded FROM, so neither "A" (the top of the ladder) nor
// "S" (never on the ladder at all — see TIER_ORDER above) has an entry.
export const TIER_UPGRADE_COST: Record<Exclude<Tier, "A" | "S">, number> = {
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
 * Quartermaster (GDD §6.2 / Data Pack §5, secondary-only track): "reduces
 * the point cost of every gear-tier purchase for the paired pilot by 25%,
 * for the rest of the campaign." Wired 6 Sep 2026 — the earlier note on
 * purchaseTierUpgrade below said no live mek carried the track "anyway,"
 * which was true of the starting roster and false of the shop: a
 * Quartermaster secondary has been purchasable through purchaseMekSecondary
 * (180 personal points) since 27 Aug and did nothing until this. Reads the
 * mek's LIVE campaign copy (state.meks), so a secondary bought mid-campaign
 * takes effect on the next tier purchase, and rounds to whole points
 * (60 -> 45, 90 -> 68, 140 -> 105, 210 -> 158, 320 -> 240, 500 -> 375).
 * Returns undefined for a pilot with nothing left to buy (A or S).
 */
export function tierUpgradeCostFor(state: CampaignState, pilotId: string): number | undefined {
  const entry = state.pilots[pilotId];
  if (!entry || entry.pilot.tier === "A" || entry.pilot.tier === "S") return undefined;
  const base = TIER_UPGRADE_COST[entry.pilot.tier as Exclude<Tier, "A" | "S">];
  const mek = state.meks[entry.pilot.mekId];
  const discount = mek?.secondary === "quartermaster" ? MEK_TRACK_EFFECTS.quartermaster.secondary.shopDiscount : 0;
  return Math.round(base * (1 - discount));
}

/**
 * Steps `pilotId`'s campaign-persistent gear tier up by exactly one rung,
 * deducting the Data Pack §12.1 cost from their PERSONAL balance — less the
 * Quartermaster discount when the paired mek carries that secondary
 * (tierUpgradeCostFor above). Fails cleanly (state untouched, a reason
 * string) on an unknown pilot, a non-active (permanently lost) pilot, an
 * already-A-tier pilot, or insufficient personal points.
 */
export function purchaseTierUpgrade(state: CampaignState, pilotId: string): TierPurchaseResult {
  const entry = state.pilots[pilotId];
  if (!entry) return { ok: false, reason: `unknown pilot id: ${pilotId}` };
  if (entry.status !== "active") {
    return { ok: false, reason: `${entry.pilot.displayName} is not active — cannot spend points on a lost pilot` };
  }
  // S-tier is off the ladder entirely (2 Sep 2026, Heirlooms) — granted
  // with an Heirloom, never purchasable. Checked FIRST and explicitly,
  // before any index arithmetic: TIER_ORDER.indexOf("S") is -1, so
  // without this the `idx === length - 1` test below would be false, the
  // cost lookup would come back undefined, and an S-tier pilot would get
  // silently "upgraded" to TIER_ORDER[0] — demoted to G, free. A real bug
  // that would have shipped quietly rather than crashing.
  if (entry.pilot.tier === "S") {
    return { ok: false, reason: `${entry.pilot.displayName} carries an Heirloom — S tier is granted, not bought` };
  }
  const idx = TIER_ORDER.indexOf(entry.pilot.tier);
  if (idx === TIER_ORDER.length - 1) {
    return { ok: false, reason: `${entry.pilot.displayName} is already at tier A — nothing further to buy` };
  }
  const cost = tierUpgradeCostFor(state, pilotId)!;
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
export function fabricatorMaxSpareParts(
  mek: { primary: MekTrack; secondary: MekTrack | null },
  builtBays: ReservedBayId[] = [],
  builtModules: CarrierModuleId[] = [],
): number {
  const base = mek.primary === "fabricator" ? 2 : mek.secondary === "fabricator" ? 1 : 0;
  // A mek with no Fabricator track anywhere holds no spare parts at all,
  // and neither the bay nor the module changes that — they raise a cap
  // that exists, they don't grant one. Checked before either bonus so
  // buying both still gives a Tank mek exactly zero.
  if (base === 0) return 0;
  let max = base;
  if (builtBays.includes("fabricator")) max += FABRICATOR_BAY_CAP_BONUS;
  // Fabrication Bay Expansion (2 Sep 2026, data/carrierModules.ts).
  // Stacks with the bay rather than replacing it — the source design
  // frames the bay as the room and the module as an expansion OF that
  // room, and they're bought from the same company pool at separate
  // prices, so a player who paid for both should get both. Deliberately
  // NOT gated on the bay being built first: nothing in the design says
  // so, and a silent dependency that eats 160 points is exactly the kind
  // of thing a player would rightly call a bug.
  if (builtModules.includes("fabricationBay")) max += FABRICATION_BAY_CAP_BONUS;
  return max;
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
  const max = fabricatorMaxSpareParts(mek, state.builtBays ?? [], state.builtModules ?? []);
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

// ---- Company points: spending — Carrier Upgrade Modules ---------------
//
// The Workshop's own second layer, 2 Sep 2026 (data/carrierModules.ts).
// Company pool, same as spare parts and bay builds above, per the Weapon
// Branch Point System doc's own split: modules are squad logistics, not
// pilot growth.

export interface CarrierModulePurchaseResult {
  ok: boolean;
  reason?: string;
  moduleId?: CarrierModuleId;
  cost?: number;
}

/**
 * Buys `moduleId` for the company — permanent, added to
 * CampaignState.builtModules, deducted from the COMPANY pool.
 *
 * One-time per module: every module in CARRIER_MODULES is a standing
 * campaign-wide effect (a raised cap, a better recruit tier, a HUD
 * warning), none of which mean anything bought twice — so a repeat
 * purchase is refused rather than silently charging for nothing. That's a
 * deliberate difference from the weapon-branch MODULES in that same source
 * doc, which are explicitly a consumable stockpile ("you gotta buy each
 * individual module to have multiple of each"); these are the carrier
 * upgrades, a different list with different rules.
 *
 * Fails cleanly on an unknown id or insufficient points, matching every
 * other purchase* function in this file — no throwing, the caller decides
 * how to say so.
 */
// ---- Company points: bay construction — the Generator rule ---------------
//
// Bloom_Wars_Antfarm_Carrier_Hub_v1.md §11.2 (23 Aug 2026): the Generator
// "powers the grid", and the bays that draw real power can't RUN without it
// — "built but not functional until Generator capacity exists." The
// project's enforcement of that rule has been uneven, and this list is the
// honest record of where it stands:
//
//   beaconControl, restockRoom — gated 4 Sep 2026 (Beacon Control build;
//     Maxime: "Sadly we need it enforced. Its gotta be something plsyer
//     chose to spend they company point on").
//   weaponsBay, sensorArray    — gated 7 Sep 2026 (Maxime: "better fix
//     those two buildable room"). Both were confirmed Generator-dependent
//     on 23 Aug and both shipped without the gate — Weapons Bay 28 Aug
//     (the delivery note flagged it and got no answer), Sensor Array as a
//     marker with no effect at all until the same 7 Sep pass wired it.
//   fabricator                 — NOT gated. It was the FIRST bay §11.2
//     named as Generator-dependent ("allow you to power fabricator and
//     other heavy room"), and it's the one Maxime's 7 Sep ask didn't name.
//     Left as shipped and flagged, not silently changed — same discipline
//     Hub.ts's own gate comment held on 4 Sep.
//
// Pure and exported rather than an inline list in scenes/Hub.ts, which is
// where it lived from 4 Sep to 7 Sep: a rule about what the company is
// allowed to build belongs with the other purchase rules in this file, and
// a Phaser scene can't be unit-tested. Hub.ts's handleBuildRequest calls
// this and owns only the CO's line.
export const GENERATOR_DEPENDENT_BAYS: readonly ReservedBayId[] = ["beaconControl", "restockRoom", "weaponsBay", "sensorArray"];

/** True when `bayId` draws Generator power and the Generator isn't built yet — the construction-time refusal, not a point-of-use one. */
export function bayNeedsGeneratorFirst(bayId: ReservedBayId, builtBays: readonly ReservedBayId[]): boolean {
  return GENERATOR_DEPENDENT_BAYS.includes(bayId) && !builtBays.includes("generator");
}

export function purchaseCarrierModule(state: CampaignState, moduleId: CarrierModuleId): CarrierModulePurchaseResult {
  const def = CARRIER_MODULES[moduleId];
  if (!def) return { ok: false, reason: `unknown carrier module: ${moduleId}` };
  const owned = state.builtModules ?? [];
  if (owned.includes(moduleId)) {
    return { ok: false, reason: `${def.displayName} is already installed` };
  }
  // Forward Battery is the one module with a prerequisite, and it's a real
  // one rather than a balance tax: it widens the Fire Support blast, and
  // the Weapons Bay is what the source design has always framed it as
  // bolted onto ("heavy, gated behind Weapons Bay"). Checked here rather
  // than in the data table because this is a rule, and rules live in the
  // engine — same division every other purchase* function keeps.
  if (moduleId === "forwardBattery" && !(state.builtBays ?? []).includes("weaponsBay")) {
    return { ok: false, reason: "Forward Battery needs the Weapons Bay built first" };
  }
  if (state.points < def.cost) {
    return {
      ok: false,
      reason: `not enough company points — ${def.displayName} costs ${def.cost}, company has ${state.points}`,
    };
  }
  state.points -= def.cost;
  // Rebuilt rather than pushed into, so a caller holding the old array
  // reference can't observe a half-applied purchase — same shape as
  // Hub.ts's own builtBays write.
  state.builtModules = [...owned, moduleId];
  return { ok: true, moduleId, cost: def.cost };
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
  // S sits ABOVE A but is deliberately absent from TIER_ORDER (it's the
  // purchase ladder, and S is never purchasable — see TIER_ORDER's own
  // comment). indexOf therefore returns -1 for an S-tier pilot, and -1 is
  // less than every real gate index, so without this an Heirloom pilot
  // would have been refused every weapon branch in the game and told they
  // "need gear tier D+" while standing at S. Same -1 trap as
  // purchaseTierUpgrade and ShopPanel, failing in the opposite direction.
  const tierIdx = entry.pilot.tier === "S" ? TIER_ORDER.length : TIER_ORDER.indexOf(entry.pilot.tier);
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
  /** Mount 1 after the change (the legacy single-branch answer), for callers that predate the second mount. */
  equipped?: WeaponBranchId | null;
  /** Every equipped branch after the change, mount order. */
  equippedAll?: WeaponBranchId[];
}

/**
 * Equips `branchId` onto `pilotId`'s frame for their next mission — free
 * (Option B, source doc's own decision: "collect-and-swap," no cost or
 * cooldown to switch between branches already owned). Pass `null` to
 * unequip EVERY mount back to the pilot's plain default weapon (the
 * pre-second-mount meaning of this call, kept).
 *
 * Second mount (Frame Systems Layer, 6 Sep 2026 — data/frameSystems.ts's
 * FRAME_TIER_CAPACITY: 1 mount below tier C, 2 from C). The rule, stated
 * once because the Shop, the Transporter Pad and the Frame panel all lean
 * on it:
 *   - already equipped -> no-op, ok;
 *   - a free mount -> the branch fills it;
 *   - every mount full and the frame has exactly ONE -> the new branch
 *     REPLACES it (this is the one-click swap every pre-6-Sep player has
 *     always had, preserved exactly);
 *   - every mount full and the frame has TWO -> refused with a reason,
 *     rather than guessing which of two live branches the player meant to
 *     drop. unequipWeaponBranch below is the explicit half of that.
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
  if (branchId === null) {
    setEquippedWeaponBranches(entry.pilot, []);
    return { ok: true, equipped: null, equippedAll: [] };
  }
  const owned = entry.pilot.ownedWeaponBranches ?? [];
  if (!owned.includes(branchId)) {
    return { ok: false, reason: `${entry.pilot.displayName} doesn't own ${WEAPON_BRANCHES[branchId]?.displayName ?? branchId} yet` };
  }
  const current = equippedWeaponBranchesOf(entry.pilot);
  if (current.includes(branchId)) return { ok: true, equipped: current[0], equippedAll: current };
  const mounts = mountsFor(entry.pilot);
  let next: WeaponBranchId[];
  if (current.length < mounts) {
    next = [...current, branchId];
  } else if (mounts === 1) {
    next = [branchId];
  } else {
    return {
      ok: false,
      reason: `${entry.pilot.displayName}'s ${mounts} mounts are full — unequip ${current.map((id) => WEAPON_BRANCHES[id]?.displayName ?? id).join(" or ")} first`,
      equipped: current[0],
      equippedAll: current,
    };
  }
  setEquippedWeaponBranches(entry.pilot, next);
  return { ok: true, equipped: next[0], equippedAll: next };
}

/**
 * The explicit other half of the two-mount rule above: takes ONE branch
 * off `pilotId`'s frame, leaving whatever else is mounted exactly where it
 * was (a branch that was in mount 2 moves up to mount 1 — mounts are an
 * ordered list, not named slots, and nothing in the engine cares which
 * slot a branch occupies). A branch that isn't equipped is a no-op, ok.
 */
export function unequipWeaponBranch(state: CampaignState, pilotId: string, branchId: WeaponBranchId): WeaponBranchEquipResult {
  const entry = state.pilots[pilotId];
  if (!entry) return { ok: false, reason: `unknown pilot id: ${pilotId}` };
  if (entry.status !== "active") {
    return { ok: false, reason: `${entry.pilot.displayName} is not active` };
  }
  const next = equippedWeaponBranchesOf(entry.pilot).filter((id) => id !== branchId);
  setEquippedWeaponBranches(entry.pilot, next);
  return { ok: true, equipped: next[0] ?? null, equippedAll: next };
}

// ---- Personal points: Frame Systems (data/frameSystems.ts, 6 Sep 2026) ---
//
// The fifth and sixth purchase categories the Frame Systems Layer adds on
// top of tier / spare part / mek secondary / branch: Draw-budgeted systems
// (owned permanently, installed freely pre-mission, bounded by the frame's
// Draw) and the one-time A-tier Refit. Same pool, same rule as branches:
// personal = pilot identity, company = squad logistics. Every function
// below follows purchaseWeaponBranch's own shape — refuse with a reason a
// player can read, never throw, never mutate on a refusal.

export interface FrameSystemPurchaseResult {
  ok: boolean;
  reason?: string;
  systemId?: FrameSystemId;
  cost?: number;
}

/**
 * Why a system is or isn't buyable for this pilot right now, for the shop
 * to render — `salvageLocked` carries the kill progress so the UI can show
 * "needs N <archetype> kills (have M)" without re-deriving it. `hidden` is
 * the one case the shop shouldn't even list: a salvage system whose source
 * archetype never appears in ANY mission of the campaign this save is
 * playing (the Heartwood, in both shipped campaigns today — see
 * data/frameSystems.ts's header), so the player is never shown a lock
 * they can't open. Determined by scanning the campaign's own mission
 * waves and spawn events, so the moment a mission featuring that
 * archetype is authored, the system appears with no code change.
 */
export interface FrameSystemAvailability {
  owned: boolean;
  affordable: boolean;
  cost: number;
  salvageLocked?: { archetypeId: string; archetypeName: string; needed: number; have: number };
  hidden: boolean;
}

/** Every archetype id that can ever spawn in the campaign `state` belongs to — waves and spawn events across every mission of that side. Cached per side, since the mission data never changes at runtime. */
const campaignArchetypeCache = new Map<string, Set<string>>();
function campaignArchetypes(state: CampaignState): Set<string> {
  // Same side signal baseSceneKeyFor/companyNameOf already use.
  const side = state.pilots["pilot_rourke"] ? "amaranth" : "house_amaranth";
  const cached = campaignArchetypeCache.get(side);
  if (cached) return cached;
  const ids = new Set<string>();
  for (const campaign of CAMPAIGNS) {
    if (!campaign.id.startsWith(side === "amaranth" ? "amaranth_" : "house_amaranth_")) continue;
    for (const mission of campaign.missions) {
      for (const wave of mission.enemyWaves) ids.add(wave.archetypeId);
      for (const ev of mission.events ?? []) {
        if (ev.action.type === "spawn") for (const id of ev.action.archetypeIds) ids.add(id);
      }
    }
  }
  campaignArchetypeCache.set(side, ids);
  return ids;
}

/**
 * Can the campaign `state` belongs to ever field `archetypeId`? The
 * question behind frameSystemAvailability's `hidden` flag, exported on its
 * own (6 Sep 2026) so the hide rule stays testable now that no SHIPPED
 * salvage system trips it any more — Heartwood Graft, the one that did,
 * was re-sourced to Gallcyst the same day.
 */
export function campaignCanSupplyArchetype(state: CampaignState, archetypeId: string): boolean {
  return campaignArchetypes(state).has(archetypeId);
}

export function frameSystemAvailability(state: CampaignState, pilotId: string, systemId: FrameSystemId): FrameSystemAvailability {
  const def = FRAME_SYSTEMS[systemId];
  const entry = state.pilots[pilotId];
  const cost = frameSystemPointCost(def);
  const owned = !!entry && ownedFrameSystemsOf(entry.pilot).includes(systemId);
  const affordable = !!entry && entry.personalPoints >= cost;
  let salvageLocked: FrameSystemAvailability["salvageLocked"];
  let hidden = false;
  if (def.salvage) {
    const have = hostileKillCount(state, def.salvage.archetypeId);
    if (have < def.salvage.kills) {
      salvageLocked = {
        archetypeId: def.salvage.archetypeId,
        archetypeName: BLOOM[def.salvage.archetypeId]?.displayName ?? def.salvage.archetypeId,
        needed: def.salvage.kills,
        have,
      };
    }
    hidden = !owned && !campaignArchetypes(state).has(def.salvage.archetypeId);
  }
  return { owned, affordable, cost, salvageLocked, hidden };
}

/**
 * Buys `systemId` for `pilotId` — permanent, added to their owned list, NOT
 * installed (equipFrameSystem does that, free, within the Draw budget).
 * Refuses on: unknown/non-active pilot; a system already owned; a salvage
 * system whose kill gate this company hasn't cleared (§7 — "can't be
 * bought at all until you've killed enough of the thing they come from");
 * insufficient personal points. No tier gate — the Draw budget is the
 * gate on what you can FIELD, and owning more than fits is the whole
 * point (§4: "you can own more systems than you can fit, and choosing
 * which ones go in is the actual game").
 */
export function purchaseFrameSystem(state: CampaignState, pilotId: string, systemId: FrameSystemId): FrameSystemPurchaseResult {
  const entry = state.pilots[pilotId];
  if (!entry) return { ok: false, reason: `unknown pilot id: ${pilotId}` };
  if (entry.status !== "active") {
    return { ok: false, reason: `${entry.pilot.displayName} is not active — cannot spend points on a lost pilot` };
  }
  const def = FRAME_SYSTEMS[systemId];
  if (!def) return { ok: false, reason: `${systemId} is not a frame system` };
  const avail = frameSystemAvailability(state, pilotId, systemId);
  if (avail.owned) return { ok: false, reason: `${entry.pilot.displayName} already owns ${def.displayName}` };
  if (avail.salvageLocked) {
    const l = avail.salvageLocked;
    return {
      ok: false,
      reason: `${def.displayName} is cut from the ${l.archetypeName} — needs ${l.needed} ${l.archetypeName} kill${l.needed === 1 ? "" : "s"} (have ${l.have})`,
    };
  }
  if (!avail.affordable) {
    return { ok: false, reason: `not enough personal points — ${def.displayName} costs ${avail.cost}, ${entry.pilot.displayName} has ${entry.personalPoints}` };
  }
  entry.personalPoints -= avail.cost;
  entry.pilot.ownedFrameSystems = [...ownedFrameSystemsOf(entry.pilot), systemId];
  return { ok: true, systemId, cost: avail.cost };
}

export interface FrameSystemEquipResult {
  ok: boolean;
  reason?: string;
  equipped?: FrameSystemId[];
  drawUsed?: number;
  drawCapacity?: number;
}

/**
 * Installs an owned system for the next mission — free, reversible
 * (unequipFrameSystem), bounded by the frame's Draw at its current tier
 * (data/frameSystems.ts's FRAME_TIER_CAPACITY) with §7's +1 surcharge on
 * a salvage system for a non-Runemaster loadout. Refuses, with the numbers
 * in the reason, when the system wouldn't fit — never silently benches
 * something else to make room.
 */
export function equipFrameSystem(state: CampaignState, pilotId: string, systemId: FrameSystemId): FrameSystemEquipResult {
  const entry = state.pilots[pilotId];
  if (!entry) return { ok: false, reason: `unknown pilot id: ${pilotId}` };
  if (entry.status !== "active") return { ok: false, reason: `${entry.pilot.displayName} is not active` };
  const def = FRAME_SYSTEMS[systemId];
  if (!def) return { ok: false, reason: `${systemId} is not a frame system` };
  if (!ownedFrameSystemsOf(entry.pilot).includes(systemId)) {
    return { ok: false, reason: `${entry.pilot.displayName} doesn't own ${def.displayName} yet` };
  }
  const mek = state.meks[entry.pilot.mekId];
  const current = equippedFrameSystemsWithinDraw(entry.pilot, mek);
  const capacity = drawCapacityFor(entry.pilot);
  const used = frameDrawUsed(entry.pilot, mek);
  if (current.includes(systemId)) return { ok: true, equipped: current, drawUsed: used, drawCapacity: capacity };
  const draw = frameSystemDrawFor(def, mek);
  if (used + draw > capacity) {
    return {
      ok: false,
      reason: `${def.displayName} needs ${draw} Draw — ${entry.pilot.displayName}'s frame has ${capacity - used} of ${capacity} free`,
      equipped: current,
      drawUsed: used,
      drawCapacity: capacity,
    };
  }
  const next = [...current, systemId];
  entry.pilot.equippedFrameSystems = next;
  return { ok: true, equipped: next, drawUsed: used + draw, drawCapacity: capacity };
}

/** Takes an installed system off the frame. Not equipped -> no-op, ok. The system stays owned. */
export function unequipFrameSystem(state: CampaignState, pilotId: string, systemId: FrameSystemId): FrameSystemEquipResult {
  const entry = state.pilots[pilotId];
  if (!entry) return { ok: false, reason: `unknown pilot id: ${pilotId}` };
  if (entry.status !== "active") return { ok: false, reason: `${entry.pilot.displayName} is not active` };
  const mek = state.meks[entry.pilot.mekId];
  const next = equippedFrameSystemsWithinDraw(entry.pilot, mek).filter((id) => id !== systemId);
  entry.pilot.equippedFrameSystems = next;
  return { ok: true, equipped: next, drawUsed: frameDrawUsed(entry.pilot, mek), drawCapacity: drawCapacityFor(entry.pilot) };
}

export interface FrameRefitPurchaseResult {
  ok: boolean;
  reason?: string;
  refitId?: FrameRefitId;
  cost?: number;
}

/**
 * Buys the A-tier Frame Refit — one per pilot, permanent, the sole
 * capstone purchase (doc §14 item 2). Refuses on: unknown/non-active
 * pilot; a refit that isn't one of this path's two; a pilot below tier A
 * (S qualifies — it sits above A); a pilot who already has a refit (there
 * is no swap and no refund — "permanent" is the design, §8); insufficient
 * personal points.
 */
export function purchaseFrameRefit(state: CampaignState, pilotId: string, refitId: FrameRefitId): FrameRefitPurchaseResult {
  const entry = state.pilots[pilotId];
  if (!entry) return { ok: false, reason: `unknown pilot id: ${pilotId}` };
  if (entry.status !== "active") {
    return { ok: false, reason: `${entry.pilot.displayName} is not active — cannot spend points on a lost pilot` };
  }
  const archetype = UNIT_ARCHETYPES[entry.pilot.archetypeId];
  if (!archetype) return { ok: false, reason: `unknown archetype id: ${entry.pilot.archetypeId}` };
  const def = FRAME_REFITS[refitId];
  if (!def || !(FRAME_REFITS_BY_PATH[archetype.path] ?? []).includes(refitId)) {
    return { ok: false, reason: `${refitId} is not a valid refit for ${entry.pilot.displayName}'s path (${archetype.path})` };
  }
  if (!FRAME_REFIT_TIER_GATE.includes(entry.pilot.tier)) {
    return { ok: false, reason: `a Frame Refit needs tier A — ${entry.pilot.displayName} is at tier ${entry.pilot.tier}` };
  }
  if (entry.pilot.frameRefit) {
    const have = FRAME_REFITS[entry.pilot.frameRefit as FrameRefitId]?.displayName ?? entry.pilot.frameRefit;
    return { ok: false, reason: `${entry.pilot.displayName}'s frame is already refitted (${have}) — a refit is permanent` };
  }
  if (entry.personalPoints < FRAME_REFIT_COST) {
    return { ok: false, reason: `not enough personal points — a Frame Refit costs ${FRAME_REFIT_COST}, ${entry.pilot.displayName} has ${entry.personalPoints}` };
  }
  entry.personalPoints -= FRAME_REFIT_COST;
  entry.pilot.frameRefit = refitId;
  return { ok: true, refitId, cost: FRAME_REFIT_COST };
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

// ---- Company points: spending — Beacon Control crate/charge stockpile --
//
// claude/Bloom_Wars_Beacon_Restock_Economy_v1.md §5, built 4 Sep 2026 —
// both bought at the Fabricator, the same bay that already sells spare mek
// parts (purchaseSpareParts above), COMPANY pool, half price once the
// Fabricator bay itself is built (matching that bay's own established
// "raises a cap/lowers a cost, doesn't gate the purchase" role — contrast
// purchaseCarrierModule's Forward Battery check, a real hard gate on a
// DIFFERENT bay). Two nearly-identical functions rather than one
// parameterized by resource kind: CampaignState.beaconCrates and
// .beaconCharges are separate fields, not a keyed record, so a generic
// version would need an awkward field-name parameter for two callers this
// small — not worth the abstraction.

export const BEACON_CRATE_COST = 50;
export const BEACON_CRATE_COST_DISCOUNTED = 25;
export const BEACON_CHARGE_COST = 50;
export const BEACON_CHARGE_COST_DISCOUNTED = 25;

export interface BeaconStockPurchaseResult {
  ok: boolean;
  reason?: string;
  stock?: number;
  cost?: number;
}

function fabricatorDiscount(state: CampaignState, full: number, discounted: number): number {
  return (state.builtBays ?? []).includes("fabricator") ? discounted : full;
}

/** Buys one Fabricator crate for the COMPANY stockpile — see engine/mission.ts's useBeaconControl for what it's spent on. Deliberately NOT gated on Beacon Control or the Generator being built (see the Hub.ts build-request Generator gate for where THAT dependency actually lives) — nothing stops a player stockpiling ahead of unlocking the ability, same as banking company points before spending them. */
export function purchaseBeaconCrate(state: CampaignState): BeaconStockPurchaseResult {
  const cost = fabricatorDiscount(state, BEACON_CRATE_COST, BEACON_CRATE_COST_DISCOUNTED);
  if (state.points < cost) {
    return { ok: false, reason: `not enough company points — a Fabricator crate costs ${cost}, company has ${state.points}` };
  }
  state.points -= cost;
  state.beaconCrates = (state.beaconCrates ?? 0) + 1;
  return { ok: true, stock: state.beaconCrates, cost };
}

/** Buys one Restock Room charge for the COMPANY stockpile — same shape as purchaseBeaconCrate above, see that function's own comment for the build-order reasoning. */
export function purchaseBeaconCharge(state: CampaignState): BeaconStockPurchaseResult {
  const cost = fabricatorDiscount(state, BEACON_CHARGE_COST, BEACON_CHARGE_COST_DISCOUNTED);
  if (state.points < cost) {
    return { ok: false, reason: `not enough company points — a Restock Room charge costs ${cost}, company has ${state.points}` };
  }
  state.points -= cost;
  state.beaconCharges = (state.beaconCharges ?? 0) + 1;
  return { ok: true, stock: state.beaconCharges, cost };
}

// ---- Company points: Beacon Control's Debrief-side reconciliation ------
//
// Two separate steps, called once each from scenes/Debrief.ts's own
// mission-end sequence — same split applyCompanyEarnings/
// applyBonusObjectivePoints above already keep, rather than one do-everything
// function.

/**
 * Writes back whatever the mission actually consumed from the crate/charge
 * stockpile. Mission only ever holds a SNAPSHOT (MissionOptions.
 * beaconCratesRemaining/beaconChargesRemaining, read once at construction —
 * same "campaign state doesn't change under an in-progress mission" rule
 * builtBays/builtModules already follow) — the real, persistent count lives
 * on CampaignState and has to be told what the mission ended with. Safe to
 * call even on a mission that never touched Beacon Control at all: the
 * ending numbers are just whatever was passed in, unchanged.
 */
export function applyBeaconStockConsumption(state: CampaignState, mission: Mission): void {
  state.beaconCrates = mission.beaconCratesRemaining;
  state.beaconCharges = mission.beaconChargesRemaining;
}

/**
 * Fabricator spare parts burned by Beacon Control this mission
 * (Mission.sparePartsSpent, keyed by mek id — see useBeaconControl and
 * data/meks.ts's Fabricator note for the 6 Sep 2026 meaning change), landed
 * on the campaign's live mek copies at Debrief. A DECREMENT, not a
 * write-back of the remaining count — the mission only ever saw the parts
 * of the meks that deployed, and a mek that stayed home must keep its own.
 * Floored at 0 defensively; a mek id the campaign doesn't know is skipped
 * (a directly-constructed test Mission can deploy registry pilots the state
 * never minted).
 */
export function applySparePartsConsumption(state: CampaignState, mission: Mission): void {
  for (const [mekId, spent] of Object.entries(mission.sparePartsSpent)) {
    const mek = state.meks[mekId];
    if (!mek || spent <= 0) continue;
    mek.spareParts = Math.max(0, mek.spareParts - spent);
  }
}

/**
 * §3 item 1: "a percentage of that mission's own point payout" per beacon
 * revive used, deducted from the COMPANY pool at Debrief — not at the
 * moment of use in-mission, since a mission's own payout isn't known until
 * it actually resolves. PLACEHOLDER percentage, same "argued, not
 * simulated" status every other unset number in this file already carries
 * (this project has no economy-sim harness yet — source doc's own framing,
 * repeated in its every-number-is-a-placeholder header) — 15%, picked as a
 * real but not crushing tax: reviving all 3 beacons in one mission costs
 * 45% of that mission's completion bonus, still leaves more than half.
 */
export const BEACON_REVIVE_PAYOUT_PERCENT = 0.15;

/**
 * "That mission's own point payout" is read as the Company-pool completion
 * bonus (computeMissionCompletionBonus's own `total` — base reward + the
 * turn/no-downed/no-severance bonuses), confirmed against the actual
 * current earning-split code per the source doc's own instruction to do so
 * before building this: personal earnings (computeMissionEarnings above) is
 * an entirely separate per-pilot kill/assist/survival formula with no
 * connection to "the mission's payout" as a single number, so Company pool
 * is the only reading that matches the doc's own language. Recomputes
 * computeMissionCompletionBonus itself rather than taking it as a
 * parameter — a pure derivation from `mission`, so there's no risk of a
 * caller passing a stale number, same reasoning fireSupportRadius's own
 * getter comment gives for reading through one place rather than a cached
 * value. A losing mission's payout is 0 (computeMissionCompletionBonus is
 * entirely win-gated), so this cost is correctly 0 on a loss too — a
 * beacon's crate/charge cost still applies either way (paid in-mission,
 * via useBeaconControl), but the payout-percentage tax only bites when
 * there was a payout to tax. Clamped so this can never push state.points
 * negative — a post-hoc deduction against value being added the same
 * Debrief cycle, not a pre-checked purchase the way purchaseBeaconCrate/
 * Charge above are, so there's nothing to refuse in advance the way those
 * two can.
 */
export function applyBeaconReviveCosts(state: CampaignState, mission: Mission): number {
  if (mission.beaconRevivesUsed <= 0) return 0;
  const payout = computeMissionCompletionBonus(mission).total;
  const cost = Math.round(payout * BEACON_REVIVE_PAYOUT_PERCENT * mission.beaconRevivesUsed);
  state.points = Math.max(0, state.points - cost);
  return cost;
}
