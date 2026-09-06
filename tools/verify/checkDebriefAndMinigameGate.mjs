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

const save = readFileSync(new URL("./save.json", import.meta.url).pathname, "utf8");

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
await page.screenshot({ path: new URL("./debrief_start.png", import.meta.url).pathname });

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

// Retry loop added 6 Sep 2026, same shape as checkCalendarClock.mjs's own
// sayInChat: a single "t" press with a flat 150ms wait (the original here)
// occasionally lost the race against Phaser's own input polling under load
// — a single dropped keypress left the input still display:none, and
// input.fill()'s 30s auto-wait then timed out and crashed the whole script
// with no relation to game logic at all. Caught live, 6 Sep 2026: three
// back-to-back runs in this same sandbox failed at three different call
// sites (Case 1, Case 4, and previously Case 3), which is what a flaky
// keypress race looks like, not a real per-case bug. Retrying the press
// against an explicit waitFor is what checkCalendarClock.mjs already does
// and it has never failed this way across this same investigation's runs.
async function sayInChat(text) {
  const input = page.locator("input[placeholder^='Type something']");
  for (let attempt = 0; attempt < 6; attempt++) {
    await page.keyboard.press("t");
    try {
      await input.waitFor({ state: "visible", timeout: 1500 });
      await input.fill(text);
      await input.press("Enter");
      await page.waitForTimeout(150);
      return;
    } catch {
      await page.waitForTimeout(200);
    }
  }
  throw new Error(`sayInChat: chat box never became visible for: ${text}`);
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
// 3 Sep 2026 — the CO stands on the grotto dais (hubLayout.ts's CO_POINT);
// read it live rather than hand-copying the coordinate.
const CO = await page.evaluate(async () => (await import("/src/engine/hubLayout.ts")).CO_POINT);
await teleportTo(CO.x, CO.y + 40, "grotto");
await setLastMissionEcho(undefined);
await sayInChat("debrief");
results.noMissionYet = await lastChatLogEntry();

// --- Case 2: a win on record, ask the CO for a brief ---
// 4 Sep 2026, Codex Rebuild & Live Briefing Plan v1 Part B: "brief" no
// longer drops a chat bubble — it opens the real MissionBriefingPanel
// (Hub.ts's openMissionBriefing/missionBriefingOpen), which "owns input
// entirely while open" (Hub.ts's own comment on the pattern) and only
// closes on Esc. This script predates that change and used to just read
// lastChatLogEntry() here, then move straight to Case 3's sayInChat —
// with the panel still up and eating every keypress, "t" never reopened
// chat and the next fill() timed out 30s later. Read the panel's own text
// instead, then close it the same way a player would, before continuing.
await setLastMissionEcho({ missionId: "mission_test_debrief", outcome: "win", announced: true });
await sayInChat("brief");
results.coWinBrief = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  return {
    missionBriefingOpen: hub.missionBriefingOpen,
    title: hub.missionBriefingPanel?.titleText?.text ?? null,
    body: hub.missionBriefingPanel?.bodyText?.text ?? null,
  };
});
await page.keyboard.press("Escape");
await page.waitForTimeout(150);
results.coWinBriefClosed = await page.evaluate(() => window.__bwGame.scene.getScene("Hub").missionBriefingOpen);

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

await page.screenshot({ path: new URL("./debrief_end.png", import.meta.url).pathname });

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
  // A bare keyword scan false-positives on ordinary ambient banter that
  // happens to name-drop a minigame in-fiction (data/ambientLines.ts has a
  // "green" pilot line literally offering to "walk you through Fletchers
  // technique" as advice, nothing to do with actually playing one) — caught
  // live, 6 Sep 2026. Every REAL pegBoard/poker/fletchers narration is
  // runNpcEncounter's own this.showBubble(npcA, result.summary, now), and
  // every one of socialSim.ts's summary strings for those three kinds
  // starts with the exact `${pilotA.displayName} and ${pilotB.displayName}`
  // pair (see resolvePegBoardEncounter/resolvePokerEncounter/
  // resolveFletchersEncounter) — the same split(\"—\")[0].trim() this file
  // applies to build pilotA/pilotB above. Requiring the line to open with
  // both names is what a real leak actually looks like; a keyword alone
  // isn't.
  const nameA = npcA.displayName.split("—")[0].trim();
  const nameB = npcB.displayName.split("—")[0].trim();
  const bothNamesPrefix = new RegExp(`^${nameA} and ${nameB} `);
  const minigameHits = newEntries.filter((e) => /poker|peg board|fletchers/i.test(e.line) && bothNamesPrefix.test(e.line));
  const keywordOnlyHits = newEntries.filter((e) => /poker|peg board|fletchers/i.test(e.line) && !bothNamesPrefix.test(e.line));
  return { totalNewEntries: newEntries.length, minigameHits, keywordOnlyHits, sampleLines: newEntries.slice(0, 5).map((e) => e.line) };
});

console.log("\n=== Debrief chat results ===");
console.log(JSON.stringify(results, null, 2));
console.log("\n=== Ambient minigame room-gate (300 calls, both NPCs in Hangar Deck) ===");
console.log(JSON.stringify(minigameGateResult, null, 2));
console.log("\n=== Page errors/console errors during the whole run ===");
console.log(pageErrors.length ? pageErrors : "none");

writeFileSync(
  new URL("./debrief_report.json", import.meta.url).pathname,
  JSON.stringify({ sceneReady, results, minigameGateResult, pageErrors }, null, 2)
);

await browser.close();
