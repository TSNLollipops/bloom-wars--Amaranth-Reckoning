// One-off Playwright verification, 5 Sep 2026 — cloud-sandbox-only, not
// shipped. B7, "save the battle report" (First Game Dev Feature Gap Report
// §B7) plus the refactor it dragged along with it.
//
// Two things get checked, and the second matters as much as the first:
//
//  1. Debrief's new COPY MISSION LOG button opens a panel containing the
//     mission's REAL turn-by-turn log — not an empty box, not a header with
//     nothing under it. Checked by reading the live textarea's value and
//     comparing it against the actual Mission.log the scene was handed.
//
//  2. Options' COPY STATS + BUG REPORT still works. That panel's body was
//     moved into scenes/ui/CopyTextPanel.ts during this pass so B7 wouldn't
//     be a second copy of it — which means a working, tester-facing feature
//     got edited to serve a new one. If that refactor broke it, this is
//     where it shows up rather than in someone's bug report.
import { chromium } from "playwright";
import { readFileSync } from "fs";

const PORT = 5183;
const save = readFileSync(new URL("./save.json", import.meta.url), "utf8");
const DEPLOY = ["pilot_rourke", "pilot_bosk", "pilot_iyari", "pilot_anand", "pilot_lask"];

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1074, height: 640 } });

const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (err) => errors.push(err.message));

let failed = false;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failed = true;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${label}\n         expected: ${JSON.stringify(expected)}\n         actual:   ${JSON.stringify(actual)}`);
}

await page.addInitScript((s) => window.localStorage.setItem("bloomwars_campaign_state_v1", s), save);
await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });
await page.waitForTimeout(1300);
const box = await page.locator("canvas").boundingBox();
await page.mouse.click(box.x + 480, box.y + 300); // CONTINUE -> Hub
await page.waitForTimeout(1500);

// ---- Reach a real Debrief with a real, non-empty log -------------------
// Runs a mission far enough to generate actual log lines (ending turns makes
// the engine write real entries), then hands that same Mission object to
// Debrief the way Battle's own end-of-mission path does.
await page.evaluate(({ pilotIds }) => {
  window.__bwGame.scene.stop("Hub");
  window.__bwGame.scene.start("Battle", { missionId: "mission_amaranth_1", selectedPilotIds: pilotIds });
}, { pilotIds: DEPLOY });
await page.waitForTimeout(1200);

const logInfo = await page.evaluate(() => {
  const b = window.__bwGame.scene.getScene("Battle");
  // Real turns, driven through the scene's own confirmEndTurn() — the same
  // path the END TURN button and the space bar use — so the log fills with
  // genuine engine output (enemy phase included) rather than only the
  // spawn/dialogue lines a turn-1 mission starts with.
  for (let i = 0; i < 3; i++) b.confirmEndTurn();
  b.mission.outcome = "win";
  const mission = b.mission;
  window.__bwMission = mission; // hand-off, same object Battle would pass
  return { logLines: mission.log.length, turn: mission.turn, lastLine: mission.log[mission.log.length - 1] ?? null };
});
console.log("\n[setup] mission log lines:", logInfo.logLines, "| turn:", logInfo.turn);
check("the mission actually produced log lines to copy", logInfo.logLines > 0, true);

await page.evaluate(() => {
  window.__bwGame.scene.stop("Battle");
  window.__bwGame.scene.start("Debrief", { mission: window.__bwMission });
});
await page.waitForTimeout(1600);

const onDebrief = await page.evaluate(() => window.__bwGame.scene.getScenes(true).map((s) => s.scene.key));
console.log("[setup] active scene(s):", onDebrief.join(", "));
check("reached Debrief", onDebrief.includes("Debrief"), true);

// ---- 1. The button exists, and clicking it opens a real panel ----------
const btn = await page.evaluate(() => {
  const d = window.__bwGame.scene.getScene("Debrief");
  const found = [];
  const walk = (list) => {
    for (const o of list) {
      if (o.type === "Text" && typeof o.text === "string" && o.text.includes("COPY MISSION LOG")) {
        const m = o.getWorldTransformMatrix();
        found.push({ x: Math.round(m.tx), y: Math.round(m.ty) });
      }
      if (o.list) walk(o.list);
    }
  };
  walk(d.children.list);
  return found[0] ?? null;
});
console.log("\n[1] COPY MISSION LOG button at:", JSON.stringify(btn));
check("button is on the Debrief footer", btn !== null, true);

await page.mouse.click(box.x + btn.x, box.y + btn.y);
await page.waitForTimeout(700);

const textareas = await page.locator("textarea").count();
check("clicking it opened the copy panel", textareas >= 1, true);
const contents = await page.locator("textarea").first().inputValue();

// ---- 2. The panel holds the REAL log, header and all ------------------
const expected = await page.evaluate(() => {
  const m = window.__bwMission;
  return { first: m.log[0], last: m.log[m.log.length - 1], name: m.mission.displayName, count: m.log.length };
});
console.log("\n[2] panel contents: %d chars", contents.length);
console.log("    first 3 lines:", contents.split("\n").slice(0, 3).join(" / "));
check("names the mission", contents.includes(expected.name), true);
check("says which company", contents.includes("Warden Company"), true);
check("says the outcome", contents.includes("outcome: WON"), true);
check("carries the log's FIRST real line", contents.includes(expected.first), true);
check("carries the log's LAST real line", contents.includes(expected.last), true);
check("carries every log line, not a truncated slice", contents.split("\n").filter((l) => l.trim()).length >= expected.count, true);

await page.screenshot({ path: new URL("./promo_copy_mission_log.png", import.meta.url).pathname });

// Double-click guard: opening it twice must not stack two panels.
const closeBtn = { x: 480, y: 556 };
await page.mouse.click(box.x + closeBtn.x, box.y + closeBtn.y); // CLOSE
await page.waitForTimeout(400);
check("CLOSE removes the panel", await page.locator("textarea").count(), 0);
await page.mouse.click(box.x + btn.x, box.y + btn.y);
await page.waitForTimeout(300);
await page.mouse.click(box.x + btn.x, box.y + btn.y); // second click while open
await page.waitForTimeout(400);
check("a second click does not stack a second panel", await page.locator("textarea").count(), 1);
await page.mouse.click(box.x + closeBtn.x, box.y + closeBtn.y);
await page.waitForTimeout(400);

// ---- 3. The refactor didn't break Options' own export panel -----------
await page.evaluate(() => {
  window.__bwGame.scene.stop("Debrief");
  window.__bwGame.scene.start("Options");
});
await page.waitForTimeout(900);
const optBtn = await page.evaluate(() => {
  const o = window.__bwGame.scene.getScene("Options");
  const found = [];
  const walk = (list) => {
    for (const c of list) {
      if (c.type === "Text" && typeof c.text === "string" && c.text.includes("COPY STATS")) {
        const m = c.getWorldTransformMatrix();
        found.push({ x: Math.round(m.tx), y: Math.round(m.ty) });
      }
      if (c.list) walk(c.list);
    }
  };
  walk(o.children.list);
  return found[0] ?? null;
});
console.log("\n[3] Options COPY STATS button at:", JSON.stringify(optBtn));
check("Options' export button still there", optBtn !== null, true);
await page.mouse.click(box.x + optBtn.x, box.y + optBtn.y);
await page.waitForTimeout(700);
check("Options' export panel still opens after the refactor", await page.locator("textarea").count(), 1);
const optContents = await page.locator("textarea").first().inputValue();
check("and still contains the bug-report header", optContents.includes("bug report / statistics"), true);

console.log("\nconsole errors:", errors.length ? errors : "none");
if (errors.length) failed = true;
await browser.close();
console.log(failed ? "\nRESULT: FAILED" : "\nRESULT: PASSED");
if (failed) process.exitCode = 1;
