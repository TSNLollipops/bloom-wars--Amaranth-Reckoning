// One-off Playwright verification (4 Sep 2026) — cloud-sandbox-only, not
// shipped. Codex Rebuild & Live Briefing Plan v1, Part B: the CO's "brief"
// chat command now opens a real, live, per-mission briefing panel instead
// of the old hardcoded placeholder line.
//
// Boots the real game against tools/verify/save.json (genSave.ts's midgame
// Warden roster, no lastMissionEcho — a fresh "hasn't flown anything yet"
// save is exactly what's needed for the first scenario below), then:
//   - reaches the CO by typing "aoc, brief" through the REAL chat UI (T,
//     type, Enter — not a bypassed handleBriefRequest() call), same
//     real-input discipline as checkStandingsBoard.mjs's B-key press
//   - scenario 1 (no echo): confirms the panel opens showing Mission 1's
//     own displayName, its actual briefing narrative, a plain-English
//     OBJECTIVE line, and a SCAN line — reads the rendered text back off
//     the live scene the same way checkStandingsBoard.mjs reads its table
//   - scenario 2 (echo names mission 5): confirms the panel now shows
//     Mission 6 instead — proves this is live per-save data, not a static
//     screen, and proves the scan correctly resolves Mission 6's named
//     hostile-mech archetypes (not just Bloom creatures)
//   - scenario 3 (echo names the final mission, 36): confirms the CO gives
//     an honest "campaign complete" line instead of opening an empty panel
//   - Esc closes the panel from scenario 1
import { chromium } from "playwright";
import { readFileSync } from "fs";

const save = readFileSync(new URL("./save.json", import.meta.url).pathname, "utf8");
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1074, height: 640 } });

const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (err) => errors.push(err.message));

await page.addInitScript((saveJson) => {
  window.localStorage.setItem("bloomwars_campaign_state_v1", saveJson);
}, save);

await page.goto("http://localhost:5183/", { waitUntil: "load" });
await page.waitForTimeout(1500);
const canvas = page.locator("canvas");
const box = await canvas.boundingBox();
if (!box) throw new Error("no canvas found");
await page.mouse.click(box.x + 480, box.y + 300); // CONTINUE
await page.waitForTimeout(1600);

const status = await page.evaluate(() => {
  const hub = window.__bwGame?.scene.getScene("Hub");
  return hub ? (hub.scene.isActive() ? "active" : "inactive") : "missing";
});
console.log("Hub scene:", status);
if (status !== "active") throw new Error("Hub not active");

const fail = [];
function check(ok, label, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!ok) fail.push(label);
}

// Put the player on the CO's own deck. isReachingCo()'s named-target path
// ("aoc, brief") only requires being on the SAME DECK as him, not literal
// adjacency — see Hub.ts's own isReachingCo comment — so this is enough to
// reach him without needing to walk a real path there.
await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const co = hub.npcs.find((n) => n.pilotId === "npc_co");
  hub.currentRoomId = co.room;
});

async function sendChat(text) {
  await page.keyboard.press("t");
  await page.waitForTimeout(200);
  await page.keyboard.type(text, { delay: 15 });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
}

// The panel's own container is private on Hub, so this walks the scene's
// display list for the visible depth-60 container the same way
// checkStandingsBoard.mjs finds the standings board — every Hub overlay
// panel uses that same depth.
function readPanel() {
  return page.evaluate(() => {
    const hub = window.__bwGame.scene.getScene("Hub");
    for (const obj of hub.children.list) {
      if (obj.type !== "Container" || !obj.visible || obj.depth !== 60) continue;
      const texts = obj.list.filter((c) => c.type === "Text").map((c) => c.text);
      const title = texts.find((t) => t.startsWith("MISSION BRIEFING"));
      if (!title) continue;
      const body = texts.find((t) => t !== title && !t.startsWith("[ close"));
      return { title, body, open: hub.missionBriefingOpen };
    }
    return { title: null, body: null, open: hub.missionBriefingOpen };
  });
}

function coBubbleText() {
  return page.evaluate(() => {
    const hub = window.__bwGame.scene.getScene("Hub");
    const co = hub.npcs.find((n) => n.pilotId === "npc_co");
    const t = co?.bubbleContainer?.list.find((c) => c.type === "Text");
    return t ? t.text : null;
  });
}

// --- scenario 1: fresh save, no lastMissionEcho — Mission 1
console.log("\n=== scenario 1: fresh save (no echo) -> Mission 1 ===");
await sendChat("aoc, brief");
let panel = await readPanel();
check(panel.open === true, "missionBriefingOpen is true");
check(!!panel.title && panel.title.includes("Amaranth I.1 — Muster"), "title names Mission 1", panel.title ?? "(none)");
check(!!panel.body && panel.body.startsWith("First light on the Fallow Line."), "body opens with Mission 1's real briefing text");
check(!!panel.body && panel.body.includes("OBJECTIVE"), "OBJECTIVE section present");
check(!!panel.body && panel.body.includes("Eliminate every hostile on the field."), "objective line matches eliminate_all");
check(!!panel.body && panel.body.includes("SCAN"), "SCAN section present");
check(!!panel.body && panel.body.includes("Scans show roughly 30 hostiles, all Crawlmass."), "scan sums all 3 waves (12+11+7) into one Crawlmass bucket", panel.body?.split("SCAN")[1]?.trim());
await page.screenshot({ path: new URL("./briefing_mission1.png", import.meta.url).pathname });

console.log("\n=== Esc closes it ===");
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
const afterEsc = await page.evaluate(() => window.__bwGame.scene.getScene("Hub").missionBriefingOpen);
check(afterEsc === false, "Esc closes the panel");

// --- scenario 2: echo names Mission 5 -> next should be Mission 6, with
// its own named hostile-mech scan (not Bloom)
console.log("\n=== scenario 2: echo names Mission 5 -> Mission 6 (named hostile mechs) ===");
await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  hub.campaignState.lastMissionEcho = { missionId: "mission_amaranth_5", outcome: "win", announced: true };
});
await sendChat("aoc, brief");
panel = await readPanel();
check(panel.open === true, "missionBriefingOpen is true");
check(!!panel.title && panel.title.includes("Amaranth I.6 — House Colors"), "title names Mission 6, not Mission 1 again", panel.title ?? "(none)");
check(!!panel.body && panel.body.startsWith("House Amaranth's detachment has held the Thane's Crossing checkpoint"), "body carries Mission 6's own real briefing text");
// Mission 6 fields 4 named troopers at turn 1 plus a 5th (a repeat of
// hostile_mech_amaranth_01) at turn 7 — all 5 share the identical
// "House Amaranth Line Trooper" displayName, so they merge into one bucket.
check(!!panel.body && panel.body.includes("Scans show roughly 5 hostiles, all House Amaranth Line Trooper."), "scan resolves named hostile-mech archetypes, not just Bloom, merging all 5 waves into one bucket by displayName", panel.body?.split("SCAN")[1]?.trim());
await page.screenshot({ path: new URL("./briefing_mission6.png", import.meta.url).pathname });
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

// --- scenario 3: echo names the final mission (36) — campaign complete
console.log("\n=== scenario 3: echo names Mission 36 -> campaign complete ===");
await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  hub.campaignState.lastMissionEcho = { missionId: "mission_amaranth_36", outcome: "win", announced: true };
});
await sendChat("aoc, brief");
await page.waitForTimeout(200);
const stillClosed = await page.evaluate(() => window.__bwGame.scene.getScene("Hub").missionBriefingOpen);
check(stillClosed === false, "panel does NOT open once the campaign is complete");
const bubble = await coBubbleText();
check(!!bubble && bubble.includes("Every mission on the board's flown"), "CO gives the honest campaign-complete line instead", bubble ?? "(none)");

console.log("\nconsole errors:", errors.length ? errors : "none");
if (errors.length) fail.push("console errors");
await browser.close();
if (fail.length) { console.log(`\n${fail.length} FAILED: ${fail.join(", ")}`); process.exitCode = 1; }
else console.log("\nAll mission-briefing checks passed.");
