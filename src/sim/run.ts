// src/sim/run.ts
// Headless mission harness — Build Brief step 9. Runs a full mission with
// both sides on AI, no renderer, printing a turn log.
//   npm run sim -- mission_amaranth_8
//   npm run sim -- mission_amaranth_8 --tier=hard --seed=42 --ai-log
//
// Player side autoplays with the Player AI engine (src/sim/playerAi/)
// instead of the real hostile-AI tiers (Maxime, 22 Aug 2026) — see that
// module's own header. Since the tiers pass (1 Sep 2026, claude/Bloom_Wars_
// Player_AI_Difficulty_Tiers_Plan_v1.md) the per-unit action loop lives in
// driveMission.ts, shared with runBatch.ts, and this file is just the
// single-run reporter around it:
//   --tier=easy|moderate|hard|legacy   which profile plays (default moderate)
//   --seed=N                           replay this exact run (dodge rolls + Easy's mistakes)
//   --ai-log[=path.json]               dump every bot decision as JSON
//   --progression                      deploy the reference progression roster (see progressionRoster.ts)
//   --hostile=easy|moderate|hard       enemy mechs played by the Player AI at that tier (17 Sep 2026)
//   --heirloom=<id>[:rank][@pilot]     one deployed pilot carries that Heirloom (17 Sep 2026, heirloomFielding.ts)
import { ALL_MISSIONS_BY_ID as MISSIONS_BY_ID } from "../data/allCampaigns";
import { playerAiLog, profileForTier, type PlayerAiReason, type PlayerAiTier } from "./playerAi";
import { driveMission } from "./driveMission";
import { writeFileSync } from "node:fs";
import { buildProgressionRoster, describeProgression } from "./progressionRoster";
import { parseHeirloomFlag } from "./heirloomFielding";

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith("--"));
const flag = (name: string): string | undefined => {
  const hit = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  return hit.includes("=") ? hit.split("=").slice(1).join("=") : "";
};

const missionId = positional[0] ?? "mission_1a";
const tier = flag("tier") || "moderate";
const seedRaw = flag("seed");
const seed = seedRaw ? Number(seedRaw) : undefined;
const aiLogFlag = flag("ai-log");
const hostileTier = (flag("hostile") || undefined) as PlayerAiTier | undefined;
// --beacon[=N] (17 Sep 2026): Beacon Control built, N crates and charges (default 2).
const beaconFlag = flag("beacon");
const beacons = beaconFlag === undefined ? undefined : Number(beaconFlag || 2);
const heirloomFlag = flag("heirloom");
const heirloom = heirloomFlag ? parseHeirloomFlag(heirloomFlag) : undefined;
const aiLogPath = aiLogFlag === undefined ? null : aiLogFlag || `${missionId}_ai_log.json`;

const mission = MISSIONS_BY_ID[missionId];
if (!mission) {
  console.error(`Unknown mission id: ${missionId}. Known: ${Object.keys(MISSIONS_BY_ID).join(", ")}`);
  process.exit(1);
}

console.log(`=== ${mission.displayName} === (tier ${tier}${seed !== undefined ? `, seed ${seed}` : ""}${hostileTier ? `, hostile mechs: ${hostileTier} bot` : ""})`);
console.log(mission.briefing);
console.log("");

const progression = flag("progression") !== undefined;
if (progression) console.log(`Progression roster: ${describeProgression(mission)}`);
const result = driveMission(mission, { profile: profileForTier(tier), seed, hostileTier, heirloom, beacons, deployRoster: progression ? buildProgressionRoster(mission) : undefined });
const m = result.mission;
if (heirloom) console.log(result.heirloomWielderId ? `Heirloom ${heirloom.id} (rank ${heirloom.rank ?? 1}) carried by ${result.heirloomWielderId}` : `Heirloom ${heirloom.id}: nobody on this squad can carry it — run is without it`);

for (const line of m.log) console.log(line);
console.log("");
console.log(`RESULT: ${result.outcome.toUpperCase()} on turn ${m.turn} (loop iterations: ${result.loops})`);
if (m.removedFromRoster.length) {
  console.log(`Removed from roster: ${m.removedFromRoster.join(", ")}`);
}
if (m.permanentLosses.length) {
  console.log(`Permanent losses (capsule never recovered): ${m.permanentLosses.map((l) => l.pilotId).join(", ")}`);
}
const downed = result.summary.squad.filter((p) => p.downed).map((p) => p.pilotId);
if (downed.length) console.log(`Downed this mission: ${downed.join(", ")}`);

// Compact summary of what the test player AI actually did.
const counts: Partial<Record<PlayerAiReason, number>> = {};
for (const entry of playerAiLog) counts[entry.reason] = (counts[entry.reason] ?? 0) + 1;
console.log("");
console.log(
  `Player AI decisions (${playerAiLog.length} total): ${Object.entries(counts)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .map(([reason, n]) => `${reason}=${n}`)
    .join(", ")}`
);

if (aiLogPath) {
  writeFileSync(aiLogPath, JSON.stringify(playerAiLog, null, 2));
  console.log(`Full AI decision log written to ${aiLogPath}`);
}
