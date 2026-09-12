// src/sim/runBrainSim.ts
// Emotional Brain, Phase 5 — the harness, 12 Sep 2026.
// claude/Bloom_Wars_Emotional_Brain_Build_Plan_v1_12Sep2026.md §3e.
//   npm run sim:brain
//   npm run sim:brain -- --missions=12 --seeds=10 --tier=hard --hubdays=3 --care=2 --json=out.json
//
// Seeded, headless, no Phaser. Runs a Warden campaign end to end the way a
// real save would experience it, minus the screens: the mission bot plays
// each mission in WARDEN_MISSION_CHAIN order (progression roster, the
// project's own tier schedule), every result goes through the exact
// Debrief chain (applyMissionLosses, Grief Catalyst per loss, the
// Emotional Brain write-back, the calendar's flat mission cost, the Munti
// guarantee, the lance integrations at Missions 12/24), then a few Hub
// days pass (engine/socialSim.ts's simulateDay moves bonds; the calendar
// advances) and the next mission launches. Repeat for N seeds.
//
// Prints, per seed: one line per mission (outcome, losses, each pilot's
// take) and, at the end, each pilot's Stress/Morale trajectory, what they
// carry, their lean; each bonded pair's trajectory with what moved it.
// Then two campaign-level checks across all seeds, the build plan's own
// legibility and surprise tests:
//   Legibility: nobody pinned at 100 Stress before mission 8; no bonded
//     pair moving more than 8 in one ordinary mission.
//   Surprise: across seeds, the "closest pair" and each pilot's loudest
//     memory kind are not identical every time. If they are, the formula
//     is doing nothing and the printout says so.
//
// --care=N is the one thing here that is NOT a real game mechanic and is
// labelled as such in the output: N Stress relief per pilot per Hub day,
// a stand-in for the drinks, games and check-ins a player actually hands
// out in the Hub (Share a Drink alone is -8, data/verbs.ts). Set --care=0
// to see the raw engine with no player looking after anyone.
//
// Mirrors src/sim/run.ts / runSocialSim.ts conventions: plain tsx script,
// readable log, exits clean, nonzero exit if a check fails.
import { writeFileSync } from "node:fs";
import { WARDEN_MISSION_CHAIN } from "../data/allCampaigns";
import type { CampaignMission } from "../data/types";
import {
  createWardenCampaignState,
  applyMissionLosses,
  checkMuntiGuarantee,
  integrateSecondLance,
  integrateThirdLance,
  ensureNpcSocialState,
  type CampaignState,
} from "../engine/campaignState";
import { applyMissionCompletionDayCost, creditRealMs, currentDay, MS_PER_CALENDAR_DAY } from "../engine/calendarClock";
import { runGriefCatalyst, type GriefCatalystResult } from "../engine/griefCatalyst";
import { runDebriefCatalyst, debriefTakeLine, type DebriefCatalystResult } from "../engine/debriefCatalyst";
import { socialStateFor, settleDrift } from "../engine/memoryLedger";
import { simulateDay, type SocialSimPilot } from "../engine/socialSim";
import { NPC_BOND_SEED, catalystForPilot } from "../data/npcSeed";
import { stageFromTier, STRESS_PANIC_THRESHOLD, type Echo } from "../data/ambientLines";
import { UNIT_ARCHETYPES } from "../data/units";
import { topMemories, memorySalience, MEMORY_KIND_LABEL, type MemoryEntry } from "../data/memories";
import { effectiveEchoLean, dominantEcho } from "../data/echoLean";
import { driveMission } from "./driveMission";
import { buildProgressionRoster } from "./progressionRoster";
import { profileForTier } from "./playerAi";
import { mulberry32 } from "./rng";

// ---- args -------------------------------------------------------------------

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const hit = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  return hit.includes("=") ? hit.split("=").slice(1).join("=") : "";
};
const missionsToRun = Math.max(1, Math.min(WARDEN_MISSION_CHAIN.length, Number(flag("missions") ?? 12) || 12));
const seeds = Math.max(1, Number(flag("seeds") ?? 10) || 10);
// "hard" is the most competent bot (the tiers are player-skill tiers, see
// sim/playerAi/profile.ts), so it stands in for a real player best; Moderate
// loses Rourke on Muster most runs and voids the attempt.
const tier = flag("tier") || "hard";
const hubDays = Math.max(0, Number(flag("hubdays") ?? 3) || 0);
const care = Math.max(0, Number(flag("care") ?? 3) || 0);
const jsonPath = flag("json");
const quiet = flag("quiet") !== undefined;
const profile = profileForTier(tier);

// ---- one campaign -------------------------------------------------------------

interface PilotTrack {
  pilotId: string;
  displayName: string;
  /** Over the panic line before their first Debrief ever touched them (a seed value, not this system's doing). */
  startedPanicking: boolean;
  stress: number[]; // after each mission
  morale: number[];
}

interface PairTrack {
  key: string;
  start: number;
  end: number;
  fromMissions: number; // ordinary-mission pair shifts
  fromGrief: number;
  fromHub: number;
}

interface MissionRow {
  index: number;
  missionId: string;
  displayName: string;
  outcome: string;
  losses: string[];
  takes: string[];
  day: number;
}

interface CampaignRun {
  seed: number;
  missions: MissionRow[];
  pilots: Record<string, PilotTrack>;
  pairs: Record<string, PairTrack>;
  carries: Record<string, { label: string; salience: number; about: string[]; missionId?: string; day: number }[]>;
  lean: Record<string, { dominant: Echo; drift: Record<Echo, number> }>;
  pinnedAt100Before8: string[];
  panicked: string[];
  maxOrdinaryPairShift: number;
  closestPair: string | null;
  loudestKindByPilot: Record<string, string>;
  finalDay: number;
}

function nameOf(state: CampaignState, id: string): string {
  return state.pilots[id]?.pilot.displayName ?? id;
}

function activeIds(state: CampaignState): string[] {
  return Object.values(state.pilots)
    .filter((e) => e.status === "active")
    .map((e) => e.pilot.id);
}

function rosterForHub(state: CampaignState): SocialSimPilot[] {
  return activeIds(state)
    .filter((id) => id !== "pilot_rourke" && id !== "pilot_marrow")
    .map((id) => {
      const entry = state.pilots[id];
      const arch = UNIT_ARCHETYPES[entry.pilot.archetypeId];
      return {
        pilotId: id,
        displayName: entry.pilot.displayName,
        catalyst: catalystForPilot(id, entry.pilot.background),
        stage: stageFromTier(entry.pilot.tier),
        species: arch ? arch.species : "human",
      };
    });
}

/** Attempts per mission before the harness gives up on it (a player would keep trying; the harness has a budget). */
const MAX_ATTEMPTS = 6;

/**
 * The deploy roster the way a real save would field it: the mission's
 * authored squad (at the project's own progression tiers) minus anyone the
 * campaign has already lost, plus generated recruits (the Munti guarantee's
 * replacement, say) filling in for the missing, so the squad size the
 * mission was tuned for is kept where the roster allows.
 */
function rosterFor(def: CampaignMission, state: CampaignState) {
  const authored = buildProgressionRoster(def).filter((e) => state.pilots[e.pilotId]?.status === "active");
  const authoredIds = new Set(def.playerPilotIds);
  const extras = activeIds(state)
    .filter((id) => !authoredIds.has(id) && id !== "pilot_rourke" && id !== "pilot_marrow")
    .map((id) => ({ pilotId: id, pilot: state.pilots[id].pilot }));
  const target = def.playerPilotIds.length;
  const roster = [...authored];
  for (const e of extras) {
    if (roster.length >= target) break;
    roster.push(e);
  }
  // Always at least one Munti aboard if one exists on the roster at all.
  if (!roster.some((e) => UNIT_ARCHETYPES[e.pilot.archetypeId]?.path === "munti")) {
    const munti = extras.find((e) => UNIT_ARCHETYPES[e.pilot.archetypeId]?.path === "munti");
    if (munti) roster.push(munti);
  }
  return roster;
}

function runCampaign(seed: number): CampaignRun {
  const rng = mulberry32(seed * 7919 + 17);
  const state = createWardenCampaignState();
  const npcSocial = ensureNpcSocialState(state, NPC_BOND_SEED);
  const pilots: Record<string, PilotTrack> = {};
  const pairs: Record<string, PairTrack> = {};
  const ensurePair = (key: string) => (pairs[key] ??= { key, start: npcSocial.bonds[key] ?? 0, end: 0, fromMissions: 0, fromGrief: 0, fromHub: 0 });
  for (const key of Object.keys(npcSocial.bonds)) ensurePair(key);
  const missions: MissionRow[] = [];
  const pinnedAt100Before8 = new Set<string>();
  const panicked = new Set<string>();
  let maxOrdinaryPairShift = 0;
  let clock = 1_700_000_000_000; // a fixed epoch base so `at` stamps replay too

  for (let i = 0; i < missionsToRun; i++) {
    const def: CampaignMission = WARDEN_MISSION_CHAIN[i];
    const missionSeed = seed * 1000 + i;
    const roster = rosterFor(def, state);
    if (!roster.some((e) => UNIT_ARCHETYPES[e.pilot.archetypeId]?.path === "munti")) {
      // canLaunchMission would refuse this; the Munti guarantee below should have prevented it.
      missions.push({ index: i + 1, missionId: def.id, displayName: def.displayName, outcome: "NO MUNTI, skipped", losses: [], takes: [], day: currentDay(state) });
      continue;
    }
    // A commander_down or a timeout voids the attempt in the real game (back
    // to the briefing, nothing resolves) and the player tries again. The
    // harness does the same: up to MAX_ATTEMPTS seeds until a real win/loss.
    let drive = driveMission(def, { profile, seed: missionSeed, deployRoster: roster, resetLog: true });
    let attempts = 1;
    while (drive.outcome !== "win" && drive.outcome !== "loss" && attempts < MAX_ATTEMPTS) {
      attempts += 1;
      drive = driveMission(def, { profile, seed: missionSeed * 31 + attempts, deployRoster: roster, resetLog: true });
    }
    const m = drive.mission;
    const outcome = drive.outcome;
    const row: MissionRow = { index: i + 1, missionId: def.id, displayName: def.displayName, outcome: attempts > 1 ? `${outcome} (attempt ${attempts})` : outcome, losses: [], takes: [], day: currentDay(state) };

    if (outcome === "win" || outcome === "loss") {
      // The Debrief chain, in Debrief.ts's own order.
      applyMissionLosses(state, m.permanentLosses, def.id, outcome);
      const grief: GriefCatalystResult[] = [];
      for (const loss of m.permanentLosses) {
        row.losses.push(nameOf(state, loss.pilotId));
        const g = runGriefCatalyst(state, m.deployedPilotIds, loss.pilotId, rng);
        grief.push(g);
        for (const s of g.bondShifts) ensurePair(s.pairKey).fromGrief += s.delta;
      }
      const take: DebriefCatalystResult = runDebriefCatalyst(
        state,
        {
          missionId: def.id,
          outcome,
          deployedPilotIds: m.deployedPilotIds,
          combatWorries: m.combatWorries,
          permanentlyLostPilotIds: m.permanentLosses.map((l) => l.pilotId),
          griefResults: grief,
        },
        { rng, now: clock, today: currentDay(state) },
      );
      for (const s of take.bondShifts) {
        ensurePair(s.pairKey).fromMissions += s.delta;
        maxOrdinaryPairShift = Math.max(maxOrdinaryPairShift, Math.abs(s.delta));
      }
      for (const p of take.pilots) {
        row.takes.push(debriefTakeLine(p));
        const track = (pilots[p.pilotId] ??= { pilotId: p.pilotId, displayName: p.displayName, startedPanicking: p.stressAfter - p.stressDelta >= STRESS_PANIC_THRESHOLD, stress: [], morale: [] });
        track.stress.push(p.stressAfter);
        track.morale.push(p.moraleAfter);
        // Legibility check 1 excludes a pilot who was ALREADY over the panic
        // line when the campaign met them (Anand is seeded at Stress 78,
        // data/npcSeed.ts, by design "the stressed one"): the write-back
        // cannot be blamed for a seed value, and that pilot is the Hub's
        // job (Share a Drink, the Check-In) before he is this file's.
        if (p.stressAfter >= 100 && i < 7 && !track.startedPanicking) pinnedAt100Before8.add(p.displayName);
        if (p.stressAfter >= STRESS_PANIC_THRESHOLD) panicked.add(p.displayName);
      }
      applyMissionCompletionDayCost(state);
      checkMuntiGuarantee(state);
      if (def.id === "mission_amaranth_12" && outcome === "win") integrateSecondLance(state);
      if (def.id === "mission_amaranth_24" && outcome === "win") integrateThirdLance(state);
    } else {
      row.outcome = `${outcome} after ${attempts} attempts (every attempt voided, no debrief)`;
    }
    missions.push(row);

    // Hub days between missions: bonds move through the social sim, the
    // calendar advances, and --care stands in for the player's own relief verbs.
    const hubRoster = rosterForHub(state);
    for (let d = 0; d < hubDays; d++) {
      const before = { ...npcSocial.bonds };
      if (hubRoster.length >= 2) simulateDay(hubRoster, npcSocial, new Set(), currentDay(state), rng);
      for (const key of Object.keys(npcSocial.bonds)) {
        const delta = npcSocial.bonds[key] - (before[key] ?? 0);
        if (delta !== 0) ensurePair(key).fromHub += delta;
      }
      creditRealMs(state, MS_PER_CALENDAR_DAY);
      clock += MS_PER_CALENDAR_DAY;
      if (care > 0) {
        for (const p of hubRoster) {
          const social = socialStateFor(state, p.pilotId);
          social.stress = Math.max(0, social.stress - care);
        }
      }
    }
  }

  for (const key of Object.keys(pairs)) pairs[key].end = npcSocial.bonds[key] ?? 0;
  const today = currentDay(state);
  const carries: CampaignRun["carries"] = {};
  const lean: CampaignRun["lean"] = {};
  const loudestKindByPilot: Record<string, string> = {};
  for (const id of Object.keys(pilots)) {
    const social = state.pilots[id]?.social;
    const top = topMemories(social?.memories, today, 3);
    carries[pilots[id].displayName] = top.map((mm: MemoryEntry) => ({
      label: MEMORY_KIND_LABEL[mm.kind],
      salience: Math.round(memorySalience(mm, today) * 100) / 100,
      about: mm.about.map((a) => nameOf(state, a)),
      missionId: mm.missionId,
      day: mm.day,
    }));
    if (top[0]) loudestKindByPilot[pilots[id].displayName] = top[0].kind;
    if (social) {
      const drift = settleDrift(social, today);
      const catalyst = catalystForPilot(id, state.pilots[id].pilot.background);
      lean[pilots[id].displayName] = { dominant: dominantEcho(effectiveEchoLean(catalyst, drift)), drift: { love: r2(drift.love), fear: r2(drift.fear), anger: r2(drift.anger), sadness: r2(drift.sadness) } };
    }
  }
  let closestPair: string | null = null;
  let closestValue = -Infinity;
  for (const key of Object.keys(pairs)) {
    if (pairs[key].end > closestValue) {
      closestValue = pairs[key].end;
      closestPair = key;
    }
  }
  return {
    seed,
    missions,
    pilots,
    pairs,
    carries,
    lean,
    pinnedAt100Before8: [...pinnedAt100Before8],
    panicked: [...panicked],
    maxOrdinaryPairShift,
    closestPair,
    loudestKindByPilot,
    finalDay: today,
  };
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---- report -------------------------------------------------------------------

const runs: CampaignRun[] = [];
console.log(`=== Emotional Brain harness: ${seeds} seed${seeds === 1 ? "" : "s"} × ${missionsToRun} missions, tier ${tier}, ${hubDays} Hub day${hubDays === 1 ? "" : "s"} between missions, care ${care}/day ===`);
console.log(care > 0 ? `(care=${care} is NOT a game mechanic: it stands in for the player's own relief verbs in the Hub. --care=0 shows the raw engine.)` : "(care=0: the raw engine, nobody looking after anyone.)");
console.log("");

for (let s = 1; s <= seeds; s++) {
  const run = runCampaign(s);
  runs.push(run);
  if (quiet && s > 1) continue;
  console.log(`--- seed ${s} ---`);
  for (const row of run.missions) {
    const lossText = row.losses.length ? `  LOST: ${row.losses.join(", ")}` : "";
    console.log(`M${String(row.index).padStart(2, "0")} day ${String(row.day).padStart(3)}  ${row.displayName.padEnd(28)} ${row.outcome.toUpperCase()}${lossText}`);
    for (const t of row.takes) console.log(`      ${t}`);
  }
  console.log("");
  console.log("  Pilots after the run:");
  for (const id of Object.keys(run.pilots)) {
    const p = run.pilots[id];
    console.log(`    ${p.displayName}`);
    console.log(`      Stress ${p.stress.join(" > ")}`);
    console.log(`      Morale ${p.morale.join(" > ")}`);
    const l = run.lean[p.displayName];
    if (l) console.log(`      Lean: ${l.dominant}  (drift love ${l.drift.love}, fear ${l.drift.fear}, anger ${l.drift.anger}, sadness ${l.drift.sadness})`);
    const c = run.carries[p.displayName] ?? [];
    for (const mm of c) console.log(`      Carries: ${mm.label}${mm.about.length ? ` (${mm.about.join(", ")})` : ""}, ${mm.missionId ?? "the Hub"}, day ${mm.day}, salience ${mm.salience}`);
  }
  console.log("");
  console.log("  Bonds:");
  for (const key of Object.keys(run.pairs).sort()) {
    const pr = run.pairs[key];
    const [a, b] = key.split("::");
    const label = `${a.replace(/^pilot_/, "")} & ${b.replace(/^pilot_/, "")}`;
    console.log(`    ${label.padEnd(22)} ${String(pr.start).padStart(4)} -> ${String(pr.end).padStart(4)}   missions ${signed(pr.fromMissions)}, grief ${signed(pr.fromGrief)}, hub ${signed(pr.fromHub)}`);
  }
  console.log(`  Final day ${run.finalDay}. Panicked at some point: ${run.panicked.length ? run.panicked.join(", ") : "nobody"}.`);
  console.log("");
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

// ---- checks -------------------------------------------------------------------

let failed = false;
console.log("=== Checks across all seeds ===");
const pinned = runs.flatMap((r) => r.pinnedAt100Before8.map((n) => `seed ${r.seed}: ${n}`));
console.log(`Legibility 1, nobody who started below the panic line is pinned at Stress 100 before mission 8: ${pinned.length === 0 ? "OK" : `FAIL (${pinned.join("; ")})`}`);
const startedHot = new Set(runs.flatMap((r) => Object.values(r.pilots).filter((p) => p.startedPanicking).map((p) => p.displayName)));
if (startedHot.size) console.log(`  (excluded, already over the line at seed: ${[...startedHot].join(", ")})`);
if (pinned.length) failed = true;
const maxShift = Math.max(...runs.map((r) => r.maxOrdinaryPairShift));
console.log(`Legibility 2, largest ordinary-mission pair shift ≤ 8: ${maxShift <= 8 ? `OK (${maxShift})` : `FAIL (${maxShift})`}`);
if (maxShift > 8) failed = true;
const panicRate = runs.filter((r) => r.panicked.length > 0).length / runs.length;
console.log(`Info, share of campaigns where at least one pilot crossed the panic line: ${Math.round(panicRate * 100)}%`);
const closest = new Set(runs.map((r) => r.closestPair ?? "none"));
const loudest = new Set(runs.map((r) => JSON.stringify(r.loudestKindByPilot)));
const outcomes = new Set(runs.map((r) => r.missions.map((m) => m.outcome[0]).join("")));
console.log(`Surprise 1, distinct closest pairs across ${runs.length} seeds: ${closest.size} (${[...closest].join(", ")})`);
console.log(`Surprise 2, distinct "what each pilot carries loudest" profiles: ${loudest.size} of ${runs.length}`);
console.log(`Info, distinct win/loss sequences: ${outcomes.size} of ${runs.length}`);
if (runs.length >= 5 && closest.size === 1 && loudest.size === 1) {
  console.log("Surprise: FAIL. Every seed lands on the same closest pair AND the same loudest memories. The formula is doing nothing that a fixed script wouldn't.");
  failed = true;
} else {
  console.log("Surprise: OK. Different campaigns produce different crews.");
}

if (jsonPath) {
  writeFileSync(jsonPath, JSON.stringify(runs, null, 2));
  console.log(`JSON written to ${jsonPath}`);
}
if (failed) process.exitCode = 1;
