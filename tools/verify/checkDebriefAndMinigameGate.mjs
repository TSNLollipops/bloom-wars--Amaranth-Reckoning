// One-off Playwright verification pass, 2 Sep 2026 — cloud-sandbox-only,
// not shipped. Follows the exact pattern checkHubNpcs.mjs already
// established (window.__bwGame as the real, dev-only Phaser.Game hook —
// see that file's own header and tools/verify/README.md). Boots the real
// game against a seeded 15-pilot midgame save, lands in the live Hub
// scene, and drives the REAL chat UI (T to open, type, Enter — not a
// bypassed submitChat() call) to confirm the two 2 Sep 2026 fixes actually
// hold up in a live browser, not just logic-traced/unit-tested:
//
// 1. "brief"/"debrief" said to the CO gives a real mission-echo reaction;
//    said to anyone else, redirects to the CO; said to the CO with no
//    mission flown yet, an honest "nothing to report" line.
// 2. The ambient/background NPC-to-NPC encounter roll (runNpcEncounter)
//    never resolves to pegBoard/poker/fletchers for a pair standing
//    outside the actual Rec Room, even though they're on the same "lower"
//    deck as it — exercised directly (300 real calls against two NPCs
//    forced into Hangar Deck) since waiting on the real ambient cooldown/
//    proximity timers to fire naturally would take real wall-clock
//    minutes for a single trial, let alone 300.
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "fs";

const save = readFileSync("/mnt/user-data/uploads/bloom-wars/bloom-wars/tools/verify/save.json", "utf8");

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1074, height: 640 } });

const pageErrors = [];
page.on("console", (msg) => { if (msg.type() === "error") pageErrors.push(msg.text()); });
page.on("pageerror", (err) => pageErrors.push(err.message));

await page.addInitScript((saveJson) => {
  window.localStorage.setItem("bloomwars_campaign_state_v1", saveJson);
}, save);

await page.goto("http://localhost:5183/", { waitUntil: "load" });
await page.waitForTimeout(1500); // Boot -> MainMenu

const canvas = page.locator("canvas");
const box = await canvas.boundingBox();
if (!box) throw new Error("no canvas found");

// MainMenu.ts drawButtons(): CONTINUE at (480, 300) in game coords, canvas rendered 1:1.
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
await page.screenshot({ path: "/mnt/user-data/uploads/bloom-wars/bloom-wars/tools/verify/debrief_start.png" });

// Teleport is a direct poke at the private field, same "any scene's private
// fields are reachable the same way" convention the README already
// documents for hub.npcs — TypeScript privacy is compile-time only. Only
// the SETUP (where the player stands, what campaignState says) is poked
// this way; the actual thing under test (submitChat's routing) always goes
// through the real DOM chat box below, never called directly.
async function teleportTo(x, y, roomId) {
  await page.evaluate(({ x, y, roomId }) => {
    const hub = window.__bwGame.scene.getScene("Hub");
    hub.playerX = x;
    hub.playerY = y;
    hub.currentRoomId = roomId;
  }, { x, y, roomId });
}

async function setLastMissionEcho(echo) {
  await page.evaluate((echo) => {
    const hub = window.__bwGame.scene.getScene("Hub");
    hub.campaignState.lastMissionEcho = echo;
  }, echo);
}

async function sayInChat(text) {
  await page.keyboard.press("t");
  await page.waitForTimeout(150);
  const input = page.locator("input[placeholder^='Type something']");
  await input.fill(text);
  await input.press("Enter");
  await page.waitForTimeout(150);
}

async function lastChatLogEntry() {
  return page.evaluate(() => {
    const hub = window.__bwGame.scene.getScene("Hub");
    const log = hub.chatLog;
    return log[log.length - 1];
  });
}

const results = {};

// --- Case 1: no mission flown yet, ask the CO for a debrief ---
await teleportTo(350, 330, "grotto"); // CO's own coPos, see Hub.ts's buildNpcs()
await setLastMissionEcho(undefined);
await sayInChat("debrief");
results.noMissionYet = await lastChatLogEntry();

// --- Case 2: a win on record, ask the CO for a brief ---
await setLastMissionEcho({ missionId: "mission_test_debrief", outcome: "win", announced: true });
await sayInChat("brief");
results.coWinDebrief = await lastChatLogEntry();

// --- Case 3: a loss on record, ask the CO for a debrief ---
await setLastMissionEcho({ missionId: "mission_test_debrief_2", outcome: "loss", announced: true });
await sayInChat("debrief");
results.coLossDebrief = await lastChatLogEntry();

// --- Case 4: ask a DIFFERENT NPC (not the CO) for a debrief — redirect ---
const otherNpcPos = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const other = hub.npcs.find((n) => n.pilotId !== "npc_co" && n.room === "recroom");
  return other ? { x: other.x, y: other.y, pilotId: other.pilotId } : null;
});
if (!otherNpcPos) throw new Error("no non-CO NPC found in recroom to test the redirect against");
await teleportTo(otherNpcPos.x, otherNpcPos.y, "recroom");
await sayInChat("debrief");
results.redirectFromOtherNpc = await lastChatLogEntry();

await page.screenshot({ path: "/mnt/user-data/uploads/bloom-wars/bloom-wars/tools/verify/debrief_end.png" });

// --- Case 5: ambient minigame room-gate — 300 real runNpcEncounter() calls
// against two NPCs forced into Hangar Deck, checking the actual committed
// Hub.ts code path never narrates a minigame for them.
const minigameGateResult = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const npcA = hub.npcs.find((n) => n.pilotId !== "npc_co");
  const npcB = hub.npcs.find((n) => n.pilotId !== "npc_co" && n.pilotId !== npcA.pilotId);
  npcA.room = "hangarDeck";
  npcB.room = "hangarDeck";
  npcA.x = 700; npcA.y = 200;
  npcB.x = 705; npcB.y = 200;
  const before = hub.chatLog.length;
  for (let i = 0; i < 300; i++) {
    hub.runNpcEncounter(npcA, npcB, hub.time.now + i);
  }
  const newEntries = hub.chatLog.slice(before);
  const minigameHits = newEntries.filter((e) => /poker|peg board|fletchers/i.test(e.line));
  return { totalNewEntries: newEntries.length, minigameHits, sampleLines: newEntries.slice(0, 5).map((e) => e.line) };
});

console.log("\n=== Debrief chat results ===");
console.log(JSON.stringify(results, null, 2));
console.log("\n=== Ambient minigame room-gate (300 calls, both NPCs in Hangar Deck) ===");
console.log(JSON.stringify(minigameGateResult, null, 2));
console.log("\n=== Page errors/console errors during the whole run ===");
console.log(pageErrors.length ? pageErrors : "none");

writeFileSync(
  "/mnt/user-data/uploads/bloom-wars/bloom-wars/tools/verify/debrief_report.json",
  JSON.stringify({ sceneReady, results, minigameGateResult, pageErrors }, null, 2)
);

await browser.close();
