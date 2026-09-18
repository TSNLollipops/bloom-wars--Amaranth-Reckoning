// Playwright verification, 17 Sep 2026 — the Fletchers board fix. Cloud-
// sandbox-only, not shipped. Same pattern as checkDebriefAndMinigameGate.mjs
// (window.__bwGame dev hook, seeded save in localStorage, CONTINUE at
// (480, 300), teleport the player next to a Rec Room NPC, then drive the
// REAL chat box and the REAL throw key).
//
// What it proves: a full darts session against a crew member, every throw
// landing on the drawn board at its own angle — not nine AI throws stacked
// on one diagonal, which is what Maxime reported ("npc only shoot same
// point"). Screenshots: darts_round1.png (after the first round), and
// darts_final.png (all 18 darts, earlier rounds dimmed). The JSON report
// lists every throw's angle so "not all the same" is checkable by eye too.
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
const canvas = page.locator("canvas");
const box = await canvas.boundingBox();
if (!box) throw new Error("no canvas found");
await page.mouse.click(box.x + 480, box.y + 300);
await page.waitForTimeout(2500);

const sceneReady = await page.evaluate(() => {
  const g = window.__bwGame;
  if (!g) return "no __bwGame";
  const hub = g.scene.getScene("Hub");
  if (!hub) return "no Hub scene";
  return hub.scene.isActive() ? "active" : "inactive:" + hub.scene.settings.status;
});
console.log("Hub scene status:", sceneReady);
if (sceneReady !== "active") {
  await page.screenshot({ path: new URL("./darts_notready.png", import.meta.url).pathname });
  throw new Error("Hub not active: " + sceneReady);
}

const npc = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const n = hub.npcs.find((n) => n.pilotId !== "npc_co" && n.room === "recroom");
  return n ? { x: n.x, y: n.y, pilotId: n.pilotId, name: n.displayName } : null;
});
if (!npc) throw new Error("no Rec Room NPC to play against");
console.log("opponent:", npc.name);

await page.evaluate(({ x, y }) => {
  const hub = window.__bwGame.scene.getScene("Hub");
  hub.playerX = x + 20;
  hub.playerY = y;
  hub.currentRoomId = "recroom";
}, npc);

async function sayInChat(text) {
  const input = page.locator("input[placeholder^='Type something']");
  for (let attempt = 0; attempt < 6; attempt++) {
    await page.keyboard.press("t");
    try {
      await input.waitFor({ state: "visible", timeout: 1500 });
      await input.fill(text);
      await input.press("Enter");
      await page.waitForTimeout(200);
      return;
    } catch {
      await page.waitForTimeout(200);
    }
  }
  throw new Error(`sayInChat: chat box never became visible for: ${text}`);
}

await sayInChat("darts");
await page.waitForTimeout(400);
let opened = await page.evaluate(() => window.__bwGame.scene.getScene("Hub").dartsOpen);
let openedVia = "chat";
if (!opened) {
  // A first-visit hint panel can sit over the board; dismiss it the way a
  // player would (click anywhere / Enter), then re-check.
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  opened = await page.evaluate(() => window.__bwGame.scene.getScene("Hub").dartsOpen);
  if (!opened) {
    await page.mouse.click(box.x + 480, box.y + 400);
    await page.waitForTimeout(300);
    opened = await page.evaluate(() => window.__bwGame.scene.getScene("Hub").dartsOpen);
  }
  if (!opened) {
    // Last resort: the direct entry point, so the RENDER under test still
    // gets exercised even if the hint gate swallowed the chat open.
    await page.evaluate((pilotId) => {
      const hub = window.__bwGame.scene.getScene("Hub");
      const n = hub.npcs.find((n) => n.pilotId === pilotId);
      hub.finishStartDarts(n);
    }, npc.pilotId);
    await page.waitForTimeout(300);
    opened = await page.evaluate(() => window.__bwGame.scene.getScene("Hub").dartsOpen);
    openedVia = "finishStartDarts (chat open was swallowed by an overlay)";
  }
}
console.log("darts open:", opened, "via", openedVia);
// 17 Sep 2026, opponent-skill floor: log what the opponent actually plays at.
const skillInfo = await page.evaluate((pilotId) => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const n = hub.npcs.find((n) => n.pilotId === pilotId);
  const recRoom = hub.campaignState.recRoom ?? { records: {} };
  const raw = hub.recRoomSkills(recRoom, n).fletchers;
  return { raw, effective: hub.opponentSkill(n, "fletchers") };
}, npc.pilotId);
console.log("opponent darts skill (raw learned / effective with floor):", JSON.stringify(skillInfo));
if (!opened) {
  await page.screenshot({ path: new URL("./darts_notopen.png", import.meta.url).pathname });
  throw new Error("darts overlay never opened");
}

const state = () => page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const g = hub.dartsGame;
  return g ? { status: g.status, turn: g.turn, round: g.round, meterLive: hub.dartsMeterLive, h: g.throws.human.length, a: g.throws.ai.length } : null;
});

let shotRound1 = false;
for (let i = 0; i < 200; i++) {
  const s = await state();
  if (!s) break;
  if (s.status === "over") break;
  if (s.turn === "human" && s.meterLive) {
    await page.waitForTimeout(80 + Math.floor(Math.random() * 700)); // let the meter sweep somewhere
    await page.keyboard.press("e"); // the real throw key (Hub.update reads eKey while dartsOpen)
    await page.waitForTimeout(250);
  } else {
    await page.waitForTimeout(250);
  }
  const after = await state();
  if (!shotRound1 && after && after.h === 3 && after.a === 3) {
    await page.waitForTimeout(300);
    await page.screenshot({ path: new URL("./darts_round1.png", import.meta.url).pathname });
    shotRound1 = true;
  }
}
await page.waitForTimeout(400);
const final = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const g = hub.dartsGame;
  if (!g) return null;
  const angles = (side) => g.throws[side].map((t) => Number(t.angle.toFixed(2)));
  const accs = (side) => g.throws[side].map((t) => Number(t.accuracy.toFixed(2)));
  return { status: g.status, winner: g.winner, totals: g.totals, humanAngles: angles("human"), aiAngles: angles("ai"), humanAcc: accs("human"), aiAcc: accs("ai") };
});
await page.screenshot({ path: new URL("./darts_final.png", import.meta.url).pathname });

const distinctAi = new Set(final?.aiAngles ?? []).size;
const verdict = {
  sceneReady,
  skillInfo,
  openedVia,
  played: final?.status === "over",
  throwsHuman: final?.humanAngles.length,
  throwsAi: final?.aiAngles.length,
  distinctAiAngles: distinctAi,
  pass: final?.status === "over" && final.humanAngles.length === 9 && final.aiAngles.length === 9 && distinctAi >= 5 && pageErrors.length === 0,
  final,
  pageErrors,
};
console.log(JSON.stringify(verdict, null, 2));
writeFileSync(new URL("./darts_report.json", import.meta.url).pathname, JSON.stringify(verdict, null, 2));
await browser.close();
process.exit(verdict.pass ? 0 : 1);
