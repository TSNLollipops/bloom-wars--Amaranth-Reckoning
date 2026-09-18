// Playwright verification, 17 Sep 2026 — Codex §13 "Crew Verbs" plus the two
// new Hub verbs (Ask About, Gossip's gate). Cloud-sandbox-only, not shipped.
// Same pattern as checkDartsBoard.mjs. Needs save.json (genSave.ts) and the
// dev server on 5183.
//
// Part A — the Codex: start the Codex scene directly with the seeded save
// (the real scene.start the Main Menu makes), select section 13 through the
// scene's own state, render every page, screenshot pages 1 and the last,
// assert every card's title is on screen across the pages.
// Part B — the Hub: teleport beside Anand, type "where are you from" three
// times and "what do you think of bosk" once through the REAL chat box;
// read the bubbles/log; assert the sentences advance and the gossip gate
// answers "not open yet".
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "fs";

const save = readFileSync(new URL("./save.json", import.meta.url).pathname, "utf8");
const exe = process.env.PW_CHROME ?? "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1074, height: 640 } });
const pageErrors = [];
page.on("console", (msg) => { if (msg.type() === "error") pageErrors.push(msg.text()); });
page.on("pageerror", (err) => pageErrors.push(err.message));
await page.addInitScript((saveJson) => {
  window.localStorage.setItem("bloomwars_campaign_state_v1", saveJson);
  window.localStorage.setItem("bloomwars_hub_hints_seen_v1", JSON.stringify(["roster", "crew_talk", "vault", "archive", "rec_room", "bay"]));
}, save);
await page.goto("http://localhost:5183/", { waitUntil: "load" });
await page.waitForTimeout(2500);

const report = { codex: {}, hub: {}, pageErrors };

// ---- Part A: Codex §13 ----
await page.evaluate(() => {
  const g = window.__bwGame;
  const mm = g.scene.getScene("MainMenu");
  const state = mm?.campaignState ?? null;
  g.scene.stop("MainMenu");
  g.scene.start("Codex", { returnScene: "MainMenu", campaignState: state, section: "verbs" });
});
await page.waitForTimeout(1200);
const codexInfo = await page.evaluate(() => {
  const codex = window.__bwGame.scene.getScene("Codex");
  return { active: codex.scene.isActive(), sectionIndex: codex.sectionIndex, page: codex.page };
});
report.codex.landed = codexInfo;
const titlesSeen = new Set();
const textsOnPage = async () => page.evaluate(() => {
  const codex = window.__bwGame.scene.getScene("Codex");
  return codex.contentLayer.list.filter((o) => o.type === "Text").map((o) => o.text);
});
let pageIdx = 0;
let shot1 = false;
for (let i = 0; i < 20; i++) {
  const texts = await textsOnPage();
  for (const t of texts) titlesSeen.add(t);
  if (!shot1) { await page.screenshot({ path: new URL("./crewVerbs_p1.png", import.meta.url).pathname }); shot1 = true; }
  const next = await page.evaluate(() => {
    const codex = window.__bwGame.scene.getScene("Codex");
    const sec = codex.sectionIndex;
    const before = codex.page;
    codex.page = before + 1;
    codex.renderSection();
    return { sec, before, after: codex.page };
  });
  pageIdx = next.after;
  if (next.after === next.before) break;
  await page.waitForTimeout(120);
}
await page.screenshot({ path: new URL("./crewVerbs_last.png", import.meta.url).pathname });
const expectedTitles = ["Praise", "Congratulate", "Reassurance", "Condolences", "Gift", "Flirt", "Ask Out", "Share a Drink", "Send-Off", "Check In", "Ask About", "Small talk", "Insult", "Apology", "Challenge to Spar", "The Rec Room games", "The standings board", "The CO", "Commands", "Blowup, Breakdown, Spar", "History and highlights"];
const missing = expectedTitles.filter((t) => !titlesSeen.has(t));
report.codex.lastPage = pageIdx;
report.codex.missingTitles = missing;
report.codex.sectionHeader = [...titlesSeen].find((t) => t.startsWith("SEC. 13")) ?? null;

// ---- Part B: Hub verbs ----
await page.evaluate(() => {
  const g = window.__bwGame;
  g.scene.stop("Codex");
  g.scene.start("MainMenu");
});
await page.waitForTimeout(1500);
const canvas = page.locator("canvas");
const box = await canvas.boundingBox();
await page.mouse.click(box.x + 480, box.y + 300); // CONTINUE
await page.waitForTimeout(2500);
const hubReady = await page.evaluate(() => window.__bwGame.scene.getScene("Hub")?.scene.isActive() ?? false);
report.hub.active = hubReady;
if (!hubReady) throw new Error("Hub not active");

const anand = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const n = hub.npcs.find((n) => n.pilotId === "pilot_anand") ?? hub.npcs.find((n) => n.pilotId !== "npc_co");
  return { x: n.x, y: n.y, room: n.room, pilotId: n.pilotId, name: n.displayName };
});
await page.evaluate(({ x, y, room }) => {
  const hub = window.__bwGame.scene.getScene("Hub");
  hub.playerX = x + 20; hub.playerY = y; hub.currentRoomId = room;
  // keep her still so nearest-in-range stays true across four lines
  const n = hub.npcs.find((n) => n.pilotId === "pilot_anand") ?? hub.npcs[0];
  n.engagedUntil = hub.time.now + 60000;
}, anand);

async function sayInChat(text) {
  const input = page.locator("input[placeholder^='Type something']");
  for (let attempt = 0; attempt < 6; attempt++) {
    await page.keyboard.press("t");
    try {
      await input.waitFor({ state: "visible", timeout: 1500 });
      await input.fill(text);
      await input.press("Enter");
      await page.waitForTimeout(250);
      return;
    } catch { await page.waitForTimeout(200); }
  }
  throw new Error("chat box never opened for: " + text);
}
const lastLog = () => page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const log = hub.chatLog;
  return log.slice(-2).map((e) => e.line);
});
const favOf = () => page.evaluate((id) => window.__bwGame.scene.getScene("Hub").npcs.find((n) => n.pilotId === id).favorability, anand.pilotId);
const socialLogOf = () => page.evaluate((id) => (window.__bwGame.scene.getScene("Hub").npcs.find((n) => n.pilotId === id).socialLog ?? []).filter((e) => e.verb === "askAbout").map((e) => e.line), anand.pilotId);

const favBefore = await favOf();
await sayInChat("where are you from");
const a1 = await lastLog();
const favAfter1 = await favOf();
await sayInChat("tell me about yourself");
const a2 = await lastLog();
await sayInChat("what's your story");
const a3 = await lastLog();
const favAfter3 = await favOf();
const askLog = await socialLogOf();
await page.screenshot({ path: new URL("./askAbout_hub.png", import.meta.url).pathname });
await sayInChat("what do you think of bosk");
const g1 = await lastLog();

report.hub.opponent = anand.name;
report.hub.askAbout = { a1, a2, a3, favBefore, favAfter1, favAfter3, loggedSentences: askLog };
report.hub.gossipGate = g1;
const askOk = askLog.length === 3 && new Set(askLog).size === 3 && askLog.every((l) => l.startsWith("[from the file] ")) && favAfter1 === favBefore + 1 && favAfter3 === favBefore + 1;
const gossipOk = g1.some((l) => /not open yet/i.test(l));
report.pass = report.codex.landed.active && missing.length === 0 && askOk && gossipOk && pageErrors.length === 0;
console.log(JSON.stringify(report, null, 2));
writeFileSync(new URL("./crewVerbs_report.json", import.meta.url).pathname, JSON.stringify(report, null, 2));
await browser.close();
process.exit(report.pass ? 0 : 1);
