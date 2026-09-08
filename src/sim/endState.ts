// src/sim/endState.ts
// Mission rework pass (8 Sep 2026) — drive one seeded Hard run with the
// progression roster and print the board at the end: every living hostile
// with position, HP, burrowed flag and whether it stands on a hold tile,
// then every living player unit. The answer to "why did the hold never
// finish" is usually on this print-out (The Outer Ring Falls: four full-HP
// sporethrowers standing on the far side of the ring).
//   npx tsx src/sim/endState.ts mission_amaranth_29 1001
import { ALL_MISSIONS_BY_ID } from "../data/allCampaigns";
import { ALL_MAPS } from "../data/mapRegistry";
import { driveMission } from "./driveMission";
import { profileForTier } from "./playerAi";
import { buildProgressionRoster } from "./progressionRoster";

const id = process.argv[2];
const seed = Number(process.argv[3] ?? 1001);
const def = ALL_MISSIONS_BY_ID[id];
if (!def) {
  console.error(`Unknown mission id: ${id}`);
  process.exit(1);
}
const r = driveMission(def, { profile: profileForTier("hard"), seed, deployRoster: buildProgressionRoster(def) });
const m = r.mission;
const map = ALL_MAPS[def.mapId];
const hold = new Set((map.holdZone ?? []).map((c) => `${c.x},${c.y}`));
console.log("outcome", r.outcome, "turn", m.turn);
const hs = m.units.filter((u) => u.side === "hostile" && !u.downed);
console.log("living hostiles", hs.length);
for (const u of hs) console.log(` ${u.displayName} @(${u.pos.x},${u.pos.y}) hp=${u.currentHp}/${u.maxHp} burrowed=${!!u.burrowed} onHold=${hold.has(`${u.pos.x},${u.pos.y}`)}`);
const ps = m.units.filter((u) => u.side === "player" && !u.downed);
console.log("player:", ps.map((u) => `${u.displayName}@(${u.pos.x},${u.pos.y})${hold.has(`${u.pos.x},${u.pos.y}`) ? "*" : ""}`).join("  "));
