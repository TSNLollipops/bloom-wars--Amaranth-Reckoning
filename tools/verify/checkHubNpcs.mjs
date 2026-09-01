// One-off Playwright verification pass (31 Aug 2026) — cloud-sandbox-only,
// not shipped. Boots the real game against a seeded 15-pilot midgame save
// (tools/verify/genSave.ts), lands in the live Hub scene, and samples
// window.__bwGame's real NPC list over real wall-clock time to check the
// door-clustering/stuck fixes (Hub.ts, Tier 1 item #1, and the 30 Aug
// stuckMs give-up fix) actually hold up in a live browser instead of just
// logic-traced.
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "fs";

const save = readFileSync("/home/claude/bloomwars/tools/verify/save.json", "utf8");

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1074, height: 640 } });

page.on("console", (msg) => {
  if (msg.type() === "error") console.log("[page error]", msg.text());
});
page.on("pageerror", (err) => console.log("[pageerror]", err.message));

await page.addInitScript((saveJson) => {
  window.localStorage.setItem("bloomwars_campaign_state_v1", saveJson);
}, save);

await page.goto("http://localhost:5183/", { waitUntil: "load" });
await page.waitForTimeout(1500); // Boot -> MainMenu

const canvas = page.locator("canvas");
const box = await canvas.boundingBox();
if (!box) throw new Error("no canvas found");

// MainMenu.ts drawButtons(): CONTINUE at (480, 300) in game coords, canvas rendered 1:1 (no Scale config).
await page.mouse.click(box.x + 480, box.y + 300);
await page.waitForTimeout(1500); // Hub scene create()

const sceneReady = await page.evaluate(() => {
  const g = window.__bwGame;
  if (!g) return "no __bwGame";
  const hub = g.scene.getScene("Hub");
  if (!hub) return "no Hub scene";
  return hub.scene.isActive() ? "active" : "inactive:" + hub.scene.settings.status;
});
console.log("Hub scene status:", sceneReady);

await page.screenshot({ path: "/home/claude/bloomwars/tools/verify/hub_start.png" });

async function sampleNpcs() {
  return page.evaluate(() => {
    const hub = window.__bwGame.scene.getScene("Hub");
    // @ts-expect-error - reaching into the private field on purpose, verification only
    const npcs = hub.npcs || [];
    return npcs.map((n) => ({
      id: n.pilotId,
      name: n.displayName,
      room: n.room,
      x: Math.round(n.x),
      y: Math.round(n.y),
      stuckMs: n.stuckMs ?? 0,
      hasTarget: n.targetX !== undefined,
    }));
  });
}

const samples = [];
const SAMPLE_COUNT = 14;
const INTERVAL_MS = 6000; // ~84s of real Hub time total
for (let i = 0; i < SAMPLE_COUNT; i++) {
  const s = await sampleNpcs();
  samples.push({ t: i * INTERVAL_MS, npcs: s });
  await page.waitForTimeout(INTERVAL_MS);
}

await page.screenshot({ path: "/home/claude/bloomwars/tools/verify/hub_end.png" });

// ---- Analysis ----
const byId = {};
for (const sample of samples) {
  for (const n of sample.npcs) {
    (byId[n.id] ??= []).push({ t: sample.t, ...n });
  }
}

const report = [];
for (const [id, seq] of Object.entries(byId)) {
  const first = seq[0];
  const last = seq[seq.length - 1];
  const totalDist = seq.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - seq[i].x, p.y - seq[i].y), 0);
  const roomsVisited = new Set(seq.map((p) => p.room));
  const everStuckHigh = seq.some((p) => p.stuckMs > 1000); // meaningfully above STUCK_TIMEOUT_MS's 500ms give-up
  report.push({
    id,
    name: first.name,
    startRoom: first.room,
    endRoom: last.room,
    roomsVisited: [...roomsVisited],
    totalMovementPx: Math.round(totalDist),
    everStuckHigh,
    neverMoved: totalDist < 5,
  });
}

// Door-cluster check: at each sample, look for 2+ NPCs within 20px of each
// other for the FULL observation window (a real pile, not a passing overlap).
const pairKey = (a, b) => [a, b].sort().join("|");
const closeCounts = {};
for (const sample of samples) {
  const ns = sample.npcs;
  for (let i = 0; i < ns.length; i++) {
    for (let j = i + 1; j < ns.length; j++) {
      const d = Math.hypot(ns[i].x - ns[j].x, ns[i].y - ns[j].y);
      if (d < 20 && ns[i].room === ns[j].room) {
        const k = pairKey(ns[i].id, ns[j].id);
        closeCounts[k] = (closeCounts[k] || 0) + 1;
      }
    }
  }
}
const persistentClusters = Object.entries(closeCounts).filter(([, c]) => c >= SAMPLE_COUNT - 1);

const out = { sceneReady, samples, report, persistentClusters };
writeFileSync("/home/claude/bloomwars/tools/verify/report.json", JSON.stringify(out, null, 2));

console.log("\n=== Per-NPC summary ===");
for (const r of report) {
  console.log(
    `${r.name.padEnd(28)} rooms:${r.roomsVisited.join(",").padEnd(20)} moved:${r.totalMovementPx}px stuckHigh:${r.everStuckHigh} neverMoved:${r.neverMoved}`
  );
}
console.log("\n=== Persistent close pairs (potential door clustering) ===");
console.log(persistentClusters.length ? persistentClusters : "none");

await browser.close();
