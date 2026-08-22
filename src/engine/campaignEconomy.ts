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
import type { CampaignState, Rank } from "./campaignState";
import type { Mission, UnitPerformance } from "./mission";

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
  entry.pilot.tier = TIER_ORDER[idx + 1];
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

/**
 * Data Pack §12.1: "Up to the Fabricator track maximum (2 primary, 1
 * secondary)." Exported (Debrief pass, 22 Aug 2026) so the debrief shop can
 * decide which meks have anywhere to put a spare part before calling
 * purchaseSpareParts, instead of re-deriving this rule in scenes/Debrief.ts.
 */
export function fabricatorMaxSpareParts(mek: { primary: MekTrack; secondary: MekTrack | null }): number {
  if (mek.primary === "fabricator") return 2;
  if (mek.secondary === "fabricator") return 1;
  return 0;
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
  const max = fabricatorMaxSpareParts(mek);
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
