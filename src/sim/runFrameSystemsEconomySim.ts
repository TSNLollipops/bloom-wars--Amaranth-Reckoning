// src/sim/runFrameSystemsEconomySim.ts
//
// The economy sim harness for the Frame Systems Layer proposal
// (claude/Bloom_Wars_Frame_Systems_Layer_v1.md §12): "there is still no
// economy sim harness... Decided 27 Aug 2026: the economy sim harness gets
// built first, before Tier 1." This is that harness, first version, built
// 6 Sep 2026 after the same-day chat pass that locked five of the doc's
// open questions (see the dated build-log addendum for the full record).
//
// WHAT THIS SIMULATES: a synthetic company's PERSONAL-points earn/spend
// loop across a full 36-mission campaign — tier upgrades, weapon branches,
// mek secondaries, and the two NEW Frame Systems purchase categories
// (Draw-budgeted systems, the one-time A-tier Refit) — reusing the real,
// live economy constants (KILL_BONUS/SURVIVAL_BONUS/OBJECTIVE_BONUS,
// TIER_ORDER/TIER_UPGRADE_COST, MEK_SECONDARY_COST) from
// engine/campaignEconomy.ts and (WEAPON_BRANCH_COSTS/WEAPON_BRANCH_TIER_GATE/
// WEAPON_BRANCHES_BY_PATH) from data/weaponBranches.ts, so this harness can
// never quietly drift from the shipped economy the way a hand-copied
// number could. The Frame Systems numbers themselves
// (frameSystemsEconomyParams.ts) are a mix of doc-transcribed values and
// clearly-labeled placeholders — see that file's own header.
//
// WHAT THIS DELIBERATELY DOES NOT DO: replay actual combat. Kills/downs/
// wins per pilot per mission are drawn from a plausible statistical model,
// not driveMission() — combat balance is npm run sim / sim:batch's job
// already (see those files); this harness is only about whether the
// earn-and-spend loop holds together once a fourth and fifth purchase
// category exist alongside tier/branch/secondary. It also does not model
// the COMPANY pool (spare parts, carrier modules, Beacon stock) — that's
// existing, already-shipped economy this proposal doesn't touch.
//
// THE TWO FAILURE MODES THIS EXISTS TO CATCH (§12, verbatim): "a player who
// can afford everything by Act III, and a player who can never afford a
// second mount." Reported per pilot archetype, per company, aggregated
// across --runs companies for a stable read rather than one lucky/unlucky
// seed.
//
// Usage:
//   npm run sim:economy                     one company, seed 1
//   npm run sim:economy -- --runs=50         50 companies, aggregated
//   npm run sim:economy -- --seed=7 --verbose
//   npm run sim:economy -- --json=out.json   also dump every pilot's raw end-state record

import { mulberry32 } from "./rng";
import { KILL_BONUS, SURVIVAL_BONUS, OBJECTIVE_BONUS, TIER_ORDER, TIER_UPGRADE_COST, MEK_SECONDARY_COST } from "../engine/campaignEconomy";
import { WEAPON_BRANCH_COSTS, WEAPON_BRANCH_TIER_GATE, WEAPON_BRANCHES_BY_PATH } from "../data/weaponBranches";
import type { Path, Tier } from "../data/types";
import {
  FRAME_TIER_CAPACITY,
  SALVAGE_NON_RUNEMASTER_DRAW_SURCHARGE,
  PLACEHOLDER_POINTS_PER_DRAW,
  PLACEHOLDER_REFIT_COST,
  PLACEHOLDER_SALVAGE_KILL_THRESHOLD,
  SYSTEM_DRAW_COST_WEIGHTS,
  PLACEHOLDER_RUNEMASTER_FRACTION,
  SALVAGE_KILLS_PER_COVERED_MISSION,
  SALVAGE_MISSION_COVERAGE,
} from "./frameSystemsEconomyParams";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const hit = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  return hit.includes("=") ? hit.split("=").slice(1).join("=") : "";
};
const RUNS = Number(flag("runs") ?? 1);
const SEED_BASE = Number(flag("seed") ?? 1);
const VERBOSE = flag("verbose") !== undefined;
const JSON_PATH = flag("json") || null;

const MISSION_COUNT = 36;
const ACT3_START_MISSION = 25; // §12's own "by Act III" line — 36/3 = 12 missions/act
// Placeholder, matching Foundation.md's "the AI isn't supposed to win"
// framing — the player is expected to win the large majority of missions.
// Not simulated per-mission difficulty; a flat sampling probability, same
// "argued, not simulated" status as every other placeholder in this file.
const MISSION_WIN_PROB = 0.88;

// ---- Roster archetypes ----------------------------------------------------
//
// 15 pilots, matching the game's fixed roster size, split into four
// deployment/performance bands rather than 15 individually-tuned entries —
// the doc's own ask is "a plausible spending policy" across a company, not
// a simulation of any one named pilot. Paths cycle meeps/tank/reeps/munti
// so all four purchase-tracks (3 branches vs. Munti's 4) get exercised.
type Band = "anchor" | "focus" | "core" | "bench";

interface RosterSlot {
  id: string;
  path: Path;
  band: Band;
  deployRate: number; // chance this pilot is deployed on any given mission
  downRate: number; // chance of being downed, GIVEN deployed (no survival bonus that mission)
  killMean: number; // Poisson mean kills, GIVEN deployed
}

const BAND_PROFILE: Record<Band, { deployRate: number; downRate: number; killMean: number }> = {
  // "Anchor" stands in for a Bosk-like company pillar — deployed nearly
  // every mission. Deliberately NOT given any special Requiem/Heirloom
  // economics: per the 6 Sep decision, the core system is granted free
  // regardless of who holds it, so an Heirloom holder has zero different
  // PERSONAL-POINTS behavior to model here. Noted so the omission reads as
  // deliberate, not a gap nobody noticed.
  anchor: { deployRate: 0.95, downRate: 0.08, killMean: 2.0 },
  focus: { deployRate: 0.85, downRate: 0.1, killMean: 1.6 },
  core: { deployRate: 0.55, downRate: 0.12, killMean: 1.0 },
  bench: { deployRate: 0.25, downRate: 0.18, killMean: 0.5 },
};

function buildRoster(): RosterSlot[] {
  const paths: Path[] = ["meeps", "tank", "reeps", "munti"];
  const bands: Band[] = ["anchor", "focus", "focus", "focus", "focus", "core", "core", "core", "core", "core", "core", "bench", "bench", "bench", "bench"];
  return bands.map((band, i) => {
    const profile = BAND_PROFILE[band];
    return {
      id: `pilot_${band}_${i}`,
      path: paths[i % paths.length],
      band,
      ...profile,
    };
  });
}

// ---- Per-pilot campaign-persistent state ----------------------------------

interface PilotEconState {
  slot: RosterSlot;
  tier: Tier;
  personalPoints: number;
  ownedBranches: number;
  mekSecondary: boolean;
  isRunemaster: boolean;
  systemsOwned: number[]; // Draw cost of each system ever bought (ownership is uncapped — Draw only bounds what's EQUIPPED at once, per §4)
  ownsSalvageSystem: boolean;
  salvageKills: number;
  refit: boolean;
  // Mission index (1-based) each milestone was FIRST reached, or null if never reached by mission 36.
  missionReachedC: number | null;
  missionFullyMaxed: number | null; // tier A + all branches + mek secondary + refit, all four
}

function poissonSample(rng: () => number, mean: number): number {
  // Knuth's algorithm — fine at these small means, no need for anything fancier.
  const L = Math.exp(-mean);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L);
  return k - 1;
}

function weightedPick<T extends { weight: number }>(rng: () => number, options: readonly T[]): T {
  const total = options.reduce((sum, o) => sum + o.weight, 0);
  let roll = rng() * total;
  for (const o of options) {
    roll -= o.weight;
    if (roll <= 0) return o;
  }
  return options[options.length - 1];
}

function maxBranchesForPath(path: Path): number {
  return WEAPON_BRANCHES_BY_PATH[path]?.length ?? 0;
}

function isFullyMaxed(p: PilotEconState): boolean {
  return p.tier === "A" && p.ownedBranches >= maxBranchesForPath(p.slot.path) && p.mekSecondary && p.refit;
}

/**
 * The cost of whatever capped, single-purchase-per-pilot item is next in
 * line — tier upgrade, then branch, then mek secondary, then Refit, same
 * order spend() itself already prioritizes. Used as a SAVINGS FLOOR: a
 * plausible player doesn't blow this mission's points on a cheap flavor
 * system while still saving toward their next real milestone, so systems
 * and salvage purchases (both uncapped/optional) are only allowed to dip
 * into points ABOVE this floor. Without this guard, the naive "spend top
 * to bottom every mission" loop pathologically never accumulates savings
 * across missions — the uncapped systems sink (step 6) is always
 * reachable and always drains the balance back near zero before the next
 * mission's earnings land, so a pilot can get stuck well below a real
 * milestone's cost forever even while comfortably able to afford it over
 * 2-3 missions of saving. Caught by this harness's own first test run —
 * exactly the kind of bug a sim like this exists to surface.
 */
function nextCappedCost(p: PilotEconState): number {
  if (p.tier !== "A") return TIER_UPGRADE_COST[p.tier as Exclude<Tier, "A" | "S">];
  const maxBranches = maxBranchesForPath(p.slot.path);
  if (p.ownedBranches < maxBranches) return WEAPON_BRANCH_COSTS[p.ownedBranches]; // tier is A, so every branch's tier gate is already met
  if (!p.mekSecondary) return MEK_SECONDARY_COST;
  if (!p.refit) return PLACEHOLDER_REFIT_COST;
  return 0; // fully maxed on every capped item — nothing left to save toward
}

/**
 * One mission-end's worth of spending, in priority order, looping until
 * nothing further is affordable. This is A plausible policy, not THE
 * policy — §12 only asks for "a plausible spending policy," and the order
 * below (tier first, since it gates everything else; then branch; then
 * salvage once unlocked, since it's free content sitting there; then mek
 * secondary; then refit once eligible; then dump the remainder into
 * generic systems) is a reasonable "buy what unlocks the most next"
 * reading of how a player actually shops, not a mathematically optimal one.
 */
function spend(p: PilotEconState, rng: () => number): void {
  let bought = true;
  while (bought) {
    bought = false;

    // 1. Tier upgrade — gates mounts, Draw, branch access, and (at A) the Refit.
    if (p.tier !== "A") {
      const cost = TIER_UPGRADE_COST[p.tier as Exclude<Tier, "A" | "S">];
      if (p.personalPoints >= cost) {
        p.personalPoints -= cost;
        const idx = TIER_ORDER.indexOf(p.tier);
        p.tier = TIER_ORDER[idx + 1];
        if (p.tier === "C" && p.missionReachedC === null) {
          // stamped by the caller, which knows the current mission number
        }
        bought = true;
        continue;
      }
    }

    // 2. Next weapon branch, if this path has one left and the tier gate is met.
    const maxBranches = maxBranchesForPath(p.slot.path);
    if (p.ownedBranches < maxBranches) {
      const requiredTier = WEAPON_BRANCH_TIER_GATE[p.ownedBranches];
      const tierIdx = TIER_ORDER.indexOf(p.tier);
      const requiredIdx = TIER_ORDER.indexOf(requiredTier);
      const cost = WEAPON_BRANCH_COSTS[p.ownedBranches];
      if (tierIdx >= requiredIdx && p.personalPoints >= cost) {
        p.personalPoints -= cost;
        p.ownedBranches += 1;
        bought = true;
        continue;
      }
    }

    // 3. Salvage system, once its kill counter clears threshold — priced
    // the same per-Draw as a Foundry system, plus §7's Draw surcharge for
    // a non-Runemaster pilot (Draw-only; doesn't change the point cost).
    if (!p.ownsSalvageSystem && p.salvageKills >= PLACEHOLDER_SALVAGE_KILL_THRESHOLD) {
      const draw = weightedPick(rng, SYSTEM_DRAW_COST_WEIGHTS).draw;
      const cost = draw * PLACEHOLDER_POINTS_PER_DRAW;
      if (p.personalPoints - cost >= nextCappedCost(p)) {
        p.personalPoints -= cost;
        const effectiveDraw = p.isRunemaster ? draw : draw + SALVAGE_NON_RUNEMASTER_DRAW_SURCHARGE;
        p.systemsOwned.push(effectiveDraw);
        p.ownsSalvageSystem = true;
        bought = true;
        continue;
      }
    }

    // 4. Mek secondary (unchanged existing purchase, still competing for the same pool).
    if (!p.mekSecondary && p.personalPoints >= MEK_SECONDARY_COST) {
      p.personalPoints -= MEK_SECONDARY_COST;
      p.mekSecondary = true;
      bought = true;
      continue;
    }

    // 5. Frame Refit, once at A tier — the sole capstone (6 Sep decision: no forced 4th branch on Meeps/Tank).
    if (p.tier === "A" && !p.refit && p.personalPoints >= PLACEHOLDER_REFIT_COST) {
      p.personalPoints -= PLACEHOLDER_REFIT_COST;
      p.refit = true;
      bought = true;
      continue;
    }

    // 6. Generic Foundry system — the uncapped sink. Ownership has no
    // ceiling (§4: Draw bounds what's EQUIPPED, not what's owned), so this
    // is where excess points go once every capped purchase is either
    // bought or not yet affordable this mission.
    const draw = weightedPick(rng, SYSTEM_DRAW_COST_WEIGHTS).draw;
    const cost = draw * PLACEHOLDER_POINTS_PER_DRAW;
    if (p.personalPoints - cost >= nextCappedCost(p)) {
      p.personalPoints -= cost;
      p.systemsOwned.push(draw);
      bought = true;
      continue;
    }
  }
}

interface CompanyResult {
  roster: PilotEconState[];
}

function simulateCompany(seed: number): CompanyResult {
  const rng = mulberry32(seed);
  const roster = buildRoster().map((slot): PilotEconState => ({
    slot,
    tier: "G",
    personalPoints: 0,
    ownedBranches: 0,
    mekSecondary: false,
    isRunemaster: rng() < PLACEHOLDER_RUNEMASTER_FRACTION,
    systemsOwned: [],
    ownsSalvageSystem: false,
    salvageKills: 0,
    refit: false,
    missionReachedC: null,
    missionFullyMaxed: null,
  }));

  for (let mission = 1; mission <= MISSION_COUNT; mission++) {
    const won = rng() < MISSION_WIN_PROB;
    const missionCoversSalvage = rng() < SALVAGE_MISSION_COVERAGE;

    for (const p of roster) {
      if (rng() >= p.slot.deployRate) continue; // not deployed this mission

      const kills = poissonSample(rng, p.slot.killMean);
      const downed = rng() < p.slot.downRate;
      const assistCredit = rng() * 0.5; // small fractional assist credit, same rough order of magnitude as computeMissionEarnings' own real formula

      const earnings = KILL_BONUS * kills + Math.round(KILL_BONUS * assistCredit) + (downed ? 0 : SURVIVAL_BONUS) + (won ? OBJECTIVE_BONUS : 0);
      p.personalPoints += earnings;

      if (missionCoversSalvage && kills > 0) {
        p.salvageKills += weightedPick(rng, SALVAGE_KILLS_PER_COVERED_MISSION).kills;
      }

      const tierBefore = p.tier;
      spend(p, rng);
      if (tierBefore !== "C" && p.tier === "C" && p.missionReachedC === null) {
        p.missionReachedC = mission;
      }
      if (p.missionFullyMaxed === null && isFullyMaxed(p)) {
        p.missionFullyMaxed = mission;
      }
    }
  }

  return { roster };
}

// ---- Reporting -------------------------------------------------------------

interface BandAggregate {
  band: Band;
  companies: number;
  pilots: number;
  avgFinalTierIndex: number; // 0=G ... 6=A, averaged
  neverReachedCRate: number;
  avgMissionReachedC: number | null; // among those who DID reach it
  maxedBeforeAct3Rate: number;
  avgMissionFullyMaxed: number | null; // among those who DID fully max
  neverFullyMaxedRate: number;
  avgBranchesOwned: number;
  avgSystemsOwned: number;
  avgSalvageUnlockRate: number;
  // §4's own "own more than you can equip" dynamic: total Draw of every
  // system ever bought vs. the Draw ceiling FRAME_TIER_CAPACITY grants at
  // the pilot's final tier. Ownership is uncapped (Draw only bounds what's
  // EQUIPPED pre-mission), so this ratio going above 100% is the expected,
  // healthy shape of the feature working as designed — not a bug reading.
  avgFinalDrawCapacity: number;
  avgTotalSystemsDrawOwned: number;
}

function aggregate(results: CompanyResult[]): BandAggregate[] {
  const bands: Band[] = ["anchor", "focus", "core", "bench"];
  return bands.map((band): BandAggregate => {
    const pilots = results.flatMap((r) => r.roster.filter((p) => p.slot.band === band));
    const n = pilots.length;
    const reachedC = pilots.filter((p) => p.missionReachedC !== null);
    const fullyMaxed = pilots.filter((p) => p.missionFullyMaxed !== null);
    const maxedEarly = pilots.filter((p) => p.missionFullyMaxed !== null && p.missionFullyMaxed < ACT3_START_MISSION);
    return {
      band,
      companies: results.length,
      pilots: n,
      avgFinalTierIndex: pilots.reduce((s, p) => s + TIER_ORDER.indexOf(p.tier), 0) / n,
      neverReachedCRate: 1 - reachedC.length / n,
      avgMissionReachedC: reachedC.length ? reachedC.reduce((s, p) => s + (p.missionReachedC ?? 0), 0) / reachedC.length : null,
      maxedBeforeAct3Rate: maxedEarly.length / n,
      avgMissionFullyMaxed: fullyMaxed.length ? fullyMaxed.reduce((s, p) => s + (p.missionFullyMaxed ?? 0), 0) / fullyMaxed.length : null,
      neverFullyMaxedRate: 1 - fullyMaxed.length / n,
      avgBranchesOwned: pilots.reduce((s, p) => s + p.ownedBranches, 0) / n,
      avgSystemsOwned: pilots.reduce((s, p) => s + p.systemsOwned.length, 0) / n,
      avgSalvageUnlockRate: pilots.filter((p) => p.ownsSalvageSystem).length / n,
      avgFinalDrawCapacity: pilots.reduce((s, p) => s + FRAME_TIER_CAPACITY[p.tier as Exclude<Tier, "S">].draw, 0) / n,
      avgTotalSystemsDrawOwned: pilots.reduce((s, p) => s + p.systemsOwned.reduce((a, b) => a + b, 0), 0) / n,
    };
  });
}

const results: CompanyResult[] = [];
for (let i = 0; i < RUNS; i++) {
  results.push(simulateCompany(SEED_BASE + i));
}

console.log(`=== Frame Systems Layer — economy sim (${RUNS} compan${RUNS === 1 ? "y" : "ies"}, seed base ${SEED_BASE}) ===`);
console.log(`${MISSION_COUNT} missions, win prob ${MISSION_WIN_PROB} (placeholder — see file header), Act III starts mission ${ACT3_START_MISSION}`);
console.log("");

const aggs = aggregate(results);
for (const a of aggs) {
  const tierLabel = TIER_ORDER[Math.round(a.avgFinalTierIndex)] ?? "A";
  console.log(`${a.band.toUpperCase().padEnd(8)} (${a.pilots} pilot-runs)`);
  console.log(
    `  final tier ~${tierLabel} (avg index ${a.avgFinalTierIndex.toFixed(2)})   branches ${a.avgBranchesOwned.toFixed(1)}   systems owned ${a.avgSystemsOwned.toFixed(1)}   salvage unlocked ${(a.avgSalvageUnlockRate * 100).toFixed(0)}%`
  );
  console.log(
    `  Draw: ${a.avgFinalDrawCapacity.toFixed(1)} cap at final tier vs. ${a.avgTotalSystemsDrawOwned.toFixed(1)} total Draw owned across all systems ever bought (owning > cap is expected — Draw only bounds what's equipped, §4)`
  );
  console.log(
    `  reaches C: ${((1 - a.neverReachedCRate) * 100).toFixed(0)}% (avg mission ${a.avgMissionReachedC?.toFixed(1) ?? "-"})` +
      `   NEVER reaches C: ${(a.neverReachedCRate * 100).toFixed(0)}%`
  );
  console.log(
    `  fully maxed (A + all branches + secondary + refit): ${((1 - a.neverFullyMaxedRate) * 100).toFixed(0)}% (avg mission ${a.avgMissionFullyMaxed?.toFixed(1) ?? "-"})` +
      `   maxed BEFORE Act III (mission ${ACT3_START_MISSION}): ${(a.maxedBeforeAct3Rate * 100).toFixed(0)}%`
  );
  console.log("");
}

console.log("--- Failure-mode read ---");
const neverCBand = aggs.find((a) => a.neverReachedCRate > 0.5);
const maxedEarlyBand = aggs.find((a) => a.maxedBeforeAct3Rate > 0.5);
if (neverCBand) {
  console.log(`FLAG: ${neverCBand.band} pilots never reach tier C (2nd mount) more than half the time — the second-mount ceiling is out of reach for that band under this policy.`);
} else {
  console.log("No band majority-fails to reach tier C under this policy.");
}
if (maxedEarlyBand) {
  console.log(`FLAG: ${maxedEarlyBand.band} pilots fully max out before Act III more than half the time — the ladder runs out of things to sell that band too early.`);
} else {
  console.log("No band majority-maxes-out before Act III under this policy.");
}

if (VERBOSE) {
  console.log("");
  console.log("--- Per-pilot detail (first company) ---");
  for (const p of results[0].roster) {
    console.log(
      `${p.slot.id.padEnd(18)} path=${p.slot.path.padEnd(6)} tier=${p.tier} branches=${p.ownedBranches}/${maxBranchesForPath(p.slot.path)} ` +
        `secondary=${p.mekSecondary} refit=${p.refit} salvage=${p.ownsSalvageSystem}(${p.salvageKills}kl) systems=${p.systemsOwned.length} ` +
        `reachedC@${p.missionReachedC ?? "-"} maxed@${p.missionFullyMaxed ?? "-"} pts_left=${p.personalPoints}`
    );
  }
}

if (JSON_PATH) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(
    JSON_PATH,
    JSON.stringify(
      results.map((r) => r.roster),
      null,
      2
    )
  );
  console.log(`\nRaw per-pilot records for ${results.length} compan${results.length === 1 ? "y" : "ies"} written to ${JSON_PATH}`);
}
