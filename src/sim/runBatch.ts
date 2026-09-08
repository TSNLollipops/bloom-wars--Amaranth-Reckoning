// src/sim/runBatch.ts
// Batch balance harness — Tier 0 (Consolidated Build Plan, 30 Aug 2026)
// gave the project its first win-RATE tool; the tiers pass (1 Sep 2026,
// claude/Bloom_Wars_Player_AI_Difficulty_Tiers_Plan_v1.md §3.4, §6) turns
// it into the difficulty-fingerprint tool the tuning job runs:
//
//   npm run sim:batch -- 20                          every mission, 20x, moderate
//   npm run sim:batch -- 200 mission_amaranth_8      one mission
//   npm run sim:batch -- 100 --tier=hard             one tier
//   npm run sim:batch -- 100 --all-tiers             easy / moderate / hard side by side
//   npm run sim:batch -- 100 --seed=1000             seeded: run i uses seed 1000+i, so any loss is replayable with `npm run sim -- <id> --seed=N`
//   npm run sim:batch -- 100 --json=out.json         also dump every run's MissionSummary record (the shape Debrief writes for humans)
//   npm run sim:batch -- 100 --progression           deploy the reference progression roster (src/sim/progressionRoster.ts) instead of the static G-tier registry
//
// Mission rework pass (8 Sep 2026) added two "how close was it" columns so a
// 0% row can be read as "unfair" vs "the bot nearly had it": on LOSSES,
// kill% = hostiles killed / hostiles ever spawned, and turn% = turn reached /
// turnLimit (capped at 100). A mission that loses at 90% kills on turn 95%
// is hard; one that loses at 15% kills on turn 30% is a wall.
//
// Per mission and tier it prints WIN/LOSS/COMMANDER_DOWN/TIMEOUT counts,
// the win %, and the two numbers Maxime's "XCOM is the benchmark" framing
// (1 Sep 2026) actually turns on: how many pilots go DOWN per run, and
// how many are permanently LOST per run — a mission that's won 80% of the
// time with nobody ever downed is not XCOM-hard, whatever the win rate says.
// The loop itself is driveMission.ts, shared with run.ts by import, not by
// eye.
import { ALL_MISSIONS_BY_ID as MISSIONS_BY_ID } from "../data/allCampaigns";
import { profileForTier, type PlayerAiTier } from "./playerAi";
import { driveMission, type DriveResult } from "./driveMission";
import type { MissionSummary } from "../engine/missionSummary";
import { writeFileSync } from "node:fs";
import { buildProgressionRoster, describeProgression } from "./progressionRoster";

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith("--"));
const flag = (name: string): string | undefined => {
  const hit = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  return hit.includes("=") ? hit.split("=").slice(1).join("=") : "";
};

const N = Number(positional[0] ?? 10);
const onlyIds = positional.slice(1);
const ids = onlyIds.length ? onlyIds : Object.keys(MISSIONS_BY_ID);
const tiers: PlayerAiTier[] = flag("all-tiers") !== undefined ? ["easy", "moderate", "hard"] : [((flag("tier") || "moderate") as PlayerAiTier)];
const seedBase = flag("seed") ? Number(flag("seed")) : undefined;
const jsonPath = flag("json") || null;
const progression = flag("progression") !== undefined;

interface Tally {
  win: number;
  loss: number;
  commander_down: number;
  ongoing_timeout: number;
  turnsOnWin: number[];
  downed: number;
  lost: number;
  lossKillPct: number[];
  lossTurnPct: number[];
  bonusDone: number;
}

function runOnce(missionId: string, tier: PlayerAiTier, seed: number | undefined): DriveResult {
  const def = MISSIONS_BY_ID[missionId];
  return driveMission(def, { profile: profileForTier(tier), seed, resetLog: true, deployRoster: progression ? buildProgressionRoster(def) : undefined });
}

const records: MissionSummary[] = [];
const aggregate: Record<PlayerAiTier, { wins: number; total: number; downed: number; lost: number }> = {
  easy: { wins: 0, total: 0, downed: 0, lost: 0 },
  moderate: { wins: 0, total: 0, downed: 0, lost: 0 },
  hard: { wins: 0, total: 0, downed: 0, lost: 0 },
  legacy: { wins: 0, total: 0, downed: 0, lost: 0 },
};

const pct = (n: number, d: number) => (d === 0 ? "  0%" : `${String(Math.round((n / d) * 100)).padStart(3)}%`);

for (const id of ids) {
  if (!MISSIONS_BY_ID[id]) {
    console.error(`Unknown mission id: ${id}. Known: ${Object.keys(MISSIONS_BY_ID).join(", ")}`);
    continue;
  }
  for (const tier of tiers) {
    const t: Tally = { win: 0, loss: 0, commander_down: 0, ongoing_timeout: 0, turnsOnWin: [], downed: 0, lost: 0, lossKillPct: [], lossTurnPct: [], bonusDone: 0 };
    for (let i = 0; i < N; i++) {
      const r = runOnce(id, tier, seedBase !== undefined ? seedBase + i : undefined);
      t[r.outcome === "ongoing" ? "ongoing_timeout" : r.outcome] += 1;
      if (r.outcome === "win") t.turnsOnWin.push(r.mission.turn);
      else {
        const spawned = r.mission.units.filter((u) => u.side === "hostile").length;
        const killed = Object.values(r.summary.hostilesKilledByArchetype).reduce((a, b) => a + b, 0);
        t.lossKillPct.push(spawned ? Math.min(1, killed / spawned) : 0);
        t.lossTurnPct.push(Math.min(1, r.mission.turn / Math.max(1, r.summary.turnLimit ?? 1)));
      }
      const b = r.summary.bonusObjective;
      if (b && b.outcome === "succeeded") t.bonusDone += 1;
      t.downed += r.summary.squad.filter((p) => p.downed).length;
      t.lost += r.summary.squad.filter((p) => p.permanentlyLost).length;
      if (jsonPath) records.push(r.summary);
    }
    const agg = aggregate[tier];
    agg.wins += t.win;
    agg.total += N;
    agg.downed += t.downed;
    agg.lost += t.lost;
    const meanTurns = t.turnsOnWin.length ? (t.turnsOnWin.reduce((a, b) => a + b, 0) / t.turnsOnWin.length).toFixed(1) : "-";
    const mean = (xs: number[]) => (xs.length ? `${String(Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100)).padStart(3)}%` : "   -");
    const bonus = MISSIONS_BY_ID[id].bonusObjective ? `  bonus=${pct(t.bonusDone, N)}` : "";
    const squad = progression ? `  squad=[${describeProgression(MISSIONS_BY_ID[id])}]` : "";
    console.log(
      `${id.padEnd(26)} ${tier.padEnd(8)} WIN=${String(t.win).padStart(3)}/${N} (${pct(t.win, N)})  LOSS=${String(t.loss).padStart(3)}  CMD_DOWN=${String(t.commander_down).padStart(3)}  TIMEOUT=${String(t.ongoing_timeout).padStart(3)}  turns/win=${meanTurns.padStart(5)}  downed/run=${(t.downed / N).toFixed(2)}  lost/run=${(t.lost / N).toFixed(2)}  loss:kill=${mean(t.lossKillPct)} turn=${mean(t.lossTurnPct)}${bonus}${squad}`
    );
  }
}

if (ids.length > 1 || tiers.length > 1) {
  console.log("");
  for (const tier of tiers) {
    const a = aggregate[tier];
    if (a.total === 0) continue;
    console.log(`AGGREGATE ${tier.padEnd(8)} ${a.wins}/${a.total} (${pct(a.wins, a.total)}) across ${ids.length} mission(s)  downed/run=${(a.downed / a.total).toFixed(2)}  lost/run=${(a.lost / a.total).toFixed(2)}`);
  }
}

if (jsonPath) {
  writeFileSync(jsonPath, JSON.stringify(records, null, 2));
  console.log(`\n${records.length} MissionSummary record(s) written to ${jsonPath}`);
}
