// src/sim/showMap.ts
// Mission rework pass (8 Sep 2026) — print a mission's map as ASCII with
// coordinates, with every wave's explicit spawn points, event spawns, the
// rescue NPC, the bonus patch and civilian starts overlaid. The tool the
// whole pass was designed against: a spawn point is only ever chosen while
// looking at this.
//   npx tsx src/sim/showMap.ts mission_amaranth_5
import { ALL_MISSIONS_BY_ID } from "../data/allCampaigns";
import { ALL_MAPS } from "../data/mapRegistry";

const CH: Record<string, string> = {
  plain: ".", road: "=", scrub: ",", rubble: "%", structure: "#", bloom_mat: "~", ridge: "^", sump: "w",
  deploy: "P", spawn: "E", exit: "X", hold: "H", wall: "B", dock: "D",
};
const id = process.argv[2];
const m = ALL_MISSIONS_BY_ID[id];
if (!m) {
  console.error(`Unknown mission id: ${id}`);
  process.exit(1);
}
const map = ALL_MAPS[m.mapId];
const grid = map.tiles.map((r) => r.map((t) => CH[t] ?? "?"));
const marks: Record<string, string> = {};
m.enemyWaves.forEach((w, wi) => {
  if (w.spawnAt !== "enemy_deploy") for (const c of w.spawnAt) marks[`${c.x},${c.y}`] = String.fromCharCode(97 + (wi % 26));
});
for (const e of m.events) if (e.action.type === "spawn") for (const c of e.action.at) marks[`${c.x},${c.y}`] = "*";
if (m.bonusObjective?.kind === "rescue_pilot") marks[`${m.bonusObjective.npcSpawnAt.x},${m.bonusObjective.npcSpawnAt.y}`] = "R";
if (m.bonusObjective?.kind === "clear_bloom_patch") for (const c of m.bonusObjective.patchTiles) marks[`${c.x},${c.y}`] = "@";
for (const c of m.civilianSpawns ?? []) marks[`${c.at.x},${c.at.y}`] = "C";
console.log(`${m.displayName}  map=${m.mapId} ${map.width}x${map.height}  objective=${m.objective} ${JSON.stringify(m.objectiveParams)}`);
console.log("    " + [...Array(map.width).keys()].map((x) => String(x % 10)).join(""));
console.log("    " + [...Array(map.width).keys()].map((x) => (x >= 10 ? String(Math.floor(x / 10)) : " ")).join(""));
for (let y = 0; y < map.height; y++) {
  const row = grid[y].map((c, x) => marks[`${x},${y}`] ?? c).join("");
  console.log(String(y).padStart(2) + "  " + row);
}
console.log(
  "waves:",
  m.enemyWaves
    .map(
      (w, i) =>
        `${String.fromCharCode(97 + i)}=${w.archetypeId.replace("bloom_", "").replace("hostile_mech_", "HM:")}x${w.count}@t${w.atTurn}${w.tier ? w.tier : ""}${w.burrowed ? "b" : ""}${w.spawnAt === "enemy_deploy" ? "(E)" : ""}`
    )
    .join("  ")
);
console.log("legend: lowercase=wave spawn pts, *=event spawn, R=rescue npc, @=bonus patch, C=civilian");
