// One-off Playwright verification (3 Sep 2026) — cloud-sandbox-only, not
// shipped. Rec Room Standings & NPC Learning, slice 4: the board panel.
//
// Boots the real game against tools/verify/standings_save.json (400 real
// NPC-vs-NPC sessions, 40 of the player's own, and one pilot genuinely
// lost on day 94 through applyMissionLosses), then:
//   - opens the board the way a player would, by pressing B in the Rec Room
//   - checks it REFUSES to open from another room, which is the gate
//   - clicks the real tab texts with real mouse events at their real
//     screen coordinates, so a missing setInteractive/scrollFactor bug
//     surfaces here rather than in front of Maxime
//   - reads the rendered table back and asserts the dead pilot is still on
//     it, that the player is ranked inline, and that the best-player line
//     is present
//   - screenshots every tab
import { chromium } from "playwright";
import { readFileSync } from "fs";

const save = readFileSync(new URL("./standings_save.json", import.meta.url).pathname, "utf8");
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

// --- the room gate, tested by putting the player somewhere else first
console.log("\n=== room gate ===");
const gate = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const was = hub.currentRoomId;
  hub.currentRoomId = "berths";
  hub.openStandings();
  const openedElsewhere = hub.standingsOpen;
  hub.currentRoomId = was;
  return { openedElsewhere, was };
});
check(gate.openedElsewhere === false, "refuses to open outside the Rec Room");

// --- open it the way a player does: walk into the Rec Room, press B
console.log("\n=== opening with the B key ===");
await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  hub.currentRoomId = "recroom";
});
await page.keyboard.press("b");
await page.waitForTimeout(300);
let open = await page.evaluate(() => window.__bwGame.scene.getScene("Hub").standingsOpen);
check(open === true, "B opens the board from inside the Rec Room");

// The panel's own container is private, so this walks the scene's own
// display list for the visible depth-60 container instead — the same
// depth every other Hub overlay uses, so if the panel were ever built at
// the wrong depth this check would stop finding it, which is itself worth
// knowing.
const board = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const found = { body: "", tabs: [] };
  for (const obj of hub.children.list) {
    if (obj.type !== "Container" || !obj.visible || obj.depth !== 60) continue;
    for (const c of obj.list) {
      if (c.type !== "Text") continue;
      if (c.text.includes("THE BOARD")) found.body = c.text;
      else if (c.text.startsWith("[ ") && !c.text.includes("close")) {
        const b = c.getBounds();
        found.tabs.push({ text: c.text, cx: b.x + b.width / 2, cy: b.y + b.height / 2, interactive: !!c.input, sf: c.scrollFactorX });
      }
    }
  }
  return found;
});

console.log("\n=== the rendered table ===");
console.log(board.body.split("\n").map((l) => "  | " + l).join("\n"));

check(board.body.includes("THE BOARD"), "the table renders");
check(board.tabs.length === 4, "four tabs", board.tabs.map((t) => t.text).join(" "));
check(board.tabs.every((t) => t.interactive), "every tab is clickable");
check(board.tabs.every((t) => t.sf === 0), "every tab is screen-pinned (scrollFactor 0)", "the container-renders/child-hit-tests trap");
check(/\bYOU\b/.test(board.body), "the player is ranked inline as YOU");
check(board.body.includes("lost Day 94"), "the lost pilot keeps their row, with the day");
check(board.body.includes("Best player aboard"), "the skill line the points column can't say");
check(board.body.includes("Day 118"), "the current calendar day");

await page.screenshot({ path: new URL("./standings_all.png", import.meta.url).pathname });

// --- real clicks on the real tabs
console.log("\n=== clicking each tab for real ===");
for (const tab of board.tabs) {
  await page.mouse.click(box.x + tab.cx, box.y + tab.cy);
  await page.waitForTimeout(250);
  const body = await page.evaluate(() => {
    const hub = window.__bwGame.scene.getScene("Hub");
    for (const obj of hub.children.list) {
      if (obj.type !== "Container" || !obj.visible || obj.depth !== 60) continue;
      for (const c of obj.list) if (c.type === "Text" && c.text.includes("THE BOARD")) return c.text;
    }
    return "";
  });
  // Compare on the label itself, spaces and all — the first draft stripped
  // spaces from "[ Peg Board ]" to get "PEGBOARD" and then failed to find
  // it in a header that correctly read "PEG BOARD". A bug in the check,
  // not in the panel.
  const want = tab.text.replace(/^\[ | \]$/g, "").toUpperCase();
  const got = (body.split("\n")[0] || "").toUpperCase();
  check(got.includes(want), `clicking ${tab.text} switches the table`, got.trim().slice(0, 40));
  await page.screenshot({ path: new URL(`./standings_${want.toLowerCase()}.png`, import.meta.url).pathname });
}

// --- Esc closes it
console.log("\n=== Esc ===");
await page.keyboard.press("Escape");
await page.waitForTimeout(250);
open = await page.evaluate(() => window.__bwGame.scene.getScene("Hub").standingsOpen);
check(open === false, "Esc closes the board");

console.log("\nconsole errors:", errors.length ? errors : "none");
if (errors.length) fail.push("console errors");
await browser.close();
if (fail.length) { console.log(`\n${fail.length} FAILED: ${fail.join(", ")}`); process.exitCode = 1; }
else console.log("\nAll standings-board checks passed.");
