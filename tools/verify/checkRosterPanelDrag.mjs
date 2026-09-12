// One-off Playwright verification, 11 Sep 2026 — cloud-sandbox-only, not
// shipped. Real-drag-and-drop companion to checkRosterPanel.mjs.
//
// checkRosterPanel.mjs drives the crew-records panel's engine wiring
// headlessly (calling hub.rosterPanel.pickForSwap/movePilot/setTab
// directly) — it was never a test of the pointer interaction itself, and
// still isn't, because that interaction just changed. This file is the one
// that actually drives a real mouse down/move/up sequence against the live
// canvas, the same way a player's hand does, because the whole point of
// this build (Maxime, 11 Sep 2026: "switching a pilot from lance to lance
// is nit intuitive... I havent found out how to do it") was that clicking
// through it in devtools proves nothing about whether a real drag works.
//
// Reads the panel's own live tabRects/cardRects off hub.rosterPanel at
// runtime rather than hardcoding pixel coordinates — those are `private`
// in RosterPanel.ts's TypeScript source, but that's compile-time only,
// so they're ordinary readable properties on the live instance in the
// browser, same as checkRosterPanel.mjs already reads .container.list
// despite `container` also being private. This keeps the test honest
// (it drags to wherever the panel itself says its drop targets are) and
// keeps it from silently rotting if the layout ever shifts.
import { chromium } from "playwright";
import { readFileSync } from "fs";

const PORT = 5183;
const save = readFileSync(new URL("./save.json", import.meta.url), "utf8");

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1074, height: 640 } });
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (err) => errors.push(err.message));

let failed = false;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed = true;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${label}\n         expected: ${JSON.stringify(expected)}\n         actual:   ${JSON.stringify(actual)}`);
}

await page.addInitScript((s) => window.localStorage.setItem("bloomwars_campaign_state_v1", s), save);
await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });
await page.waitForTimeout(1300);
const box = await page.locator("canvas").boundingBox();
await page.mouse.click(box.x + 480, box.y + 300); // CONTINUE -> Hub
await page.waitForTimeout(1800);

await page.evaluate(() => window.__bwGame.scene.getScene("Hub").openRosterPanel());
await page.waitForTimeout(300);

// A drag needs real intermediate pointermove events, not one jump, both to
// clear Phaser's own drag-distance threshold and to actually exercise the
// hover-tab-switch this build depends on (onDragMove only fires between
// dragstart and dragend, so a single teleport would skip it entirely).
async function dragTo(fromX, fromY, toX, toY, { viaX, viaY } = {}) {
  await page.mouse.move(fromX, fromY);
  await page.mouse.down();
  await page.waitForTimeout(60);
  if (viaX !== undefined) {
    await page.mouse.move(viaX, viaY, { steps: 8 });
    await page.waitForTimeout(120); // let onDragMove's render() settle before reading state off it
  }
  await page.mouse.move(toX, toY, { steps: 8 });
  await page.waitForTimeout(120);
}
async function drop() {
  await page.mouse.up();
  await page.waitForTimeout(200);
}

// ---- 1. Drag a 1st Lance pilot onto a 2nd Lance pilot's card — a real ----
// ---- mouse trade, hovering the tab mid-drag to get there. ---------------
const setup1 = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const cs = hub.campaignState;
  const LanceOf = hub.rosterPanel.constructor.lanceOf;
  const inA = Object.values(cs.pilots).find((e) => e.status === "active" && LanceOf(cs, e.pilot.id) === "a");
  const inB = Object.values(cs.pilots).find((e) => e.status === "active" && LanceOf(cs, e.pilot.id) === "b");
  const cardA = hub.rosterPanel.cardRects.find((r) => r.pilotId === inA.pilot.id);
  const tabB = hub.rosterPanel.tabRects.find((r) => r.id === "b");
  return {
    pilotA: inA.pilot.id,
    pilotB: inB.pilot.id,
    mekA: inA.pilot.mekId,
    mekB: inB.pilot.mekId,
    cardA: cardA ? { cx: cardA.x + cardA.w / 2, cy: cardA.y + cardA.h / 2 } : null,
    tabB: tabB ? { cx: tabB.x + tabB.w / 2, cy: tabB.y + tabB.h / 2 } : null,
  };
});
console.log("\n[1a] setup:", JSON.stringify(setup1));
check("found a card rect for the 1st Lance pilot", setup1.cardA !== null, true);
check("found a tab rect for 2nd Lance", setup1.tabB !== null, true);

await dragTo(box.x + setup1.cardA.cx, box.y + setup1.cardA.cy, box.x + setup1.tabB.cx, box.y + setup1.tabB.cy);
const midDrag = await page.evaluate(() => ({ tab: window.__bwGame.scene.getScene("Hub").rosterPanel.tab }));
console.log("[1b] mid-drag, still holding the pointer:", JSON.stringify(midDrag));
check("hovering 2nd Lance's tab mid-drag switched the visible roster to it", midDrag.tab, "b");

const cardB = await page.evaluate((pilotB) => {
  const r = window.__bwGame.scene.getScene("Hub").rosterPanel.cardRects.find((c) => c.pilotId === pilotB);
  return r ? { cx: r.x + r.w / 2, cy: r.y + r.h / 2 } : null;
}, setup1.pilotB);
check("2nd Lance pilot's card is now on screen to drop onto", cardB !== null, true);
await page.mouse.move(box.x + cardB.cx, box.y + cardB.cy, { steps: 8 });
await page.waitForTimeout(120);
await drop();

const after1 = await page.evaluate(({ pilotA, pilotB, mekA, mekB }) => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const cs = hub.campaignState;
  const LanceOf = hub.rosterPanel.constructor.lanceOf;
  return {
    lanceAAfter: LanceOf(cs, pilotA),
    lanceBAfter: LanceOf(cs, pilotB),
    mekARoom: hub.npcs.find((n) => n.pilotId === mekA)?.room ?? null,
    mekBRoom: hub.npcs.find((n) => n.pilotId === mekB)?.room ?? null,
    persisted: JSON.parse(window.localStorage.getItem("bloomwars_campaign_state_v1")).pilots[pilotA].lance,
  };
}, setup1);
console.log("[1c] after the real mouse drag-trade:", JSON.stringify(after1));
check("the dragged pilot really is in 2nd Lance now", after1.lanceAAfter, "b");
check("the pilot they were dropped on really did trade into 1st", after1.lanceBAfter, "a");
check("their Mek followed them to 2nd Lance's workshop", after1.mekARoom, "workshopB");
check("and the traded Mek followed the other way", after1.mekBRoom, "workshop");
check("the drag-trade was written to the save immediately", after1.persisted, "b");
await page.screenshot({ path: new URL("./drag_trade_result.png", import.meta.url).pathname });

// ---- 2. Dropping straight on a FULL tab (not a specific card) offers a --
// ---- trade instead of silently failing. --------------------------------
const setup2 = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const cs = hub.campaignState;
  const LanceOf = hub.rosterPanel.constructor.lanceOf;
  hub.rosterPanel.setTab("a");
  const inA = Object.values(cs.pilots).find((e) => e.status === "active" && LanceOf(cs, e.pilot.id) === "a");
  const cardA = hub.rosterPanel.cardRects.find((r) => r.pilotId === inA.pilot.id);
  const tabC = hub.rosterPanel.tabRects.find((r) => r.id === "c");
  const sizes = () => Object.fromEntries(["a", "b", "c"].map((id) => [id, Object.values(cs.pilots).filter((e) => e.status === "active" && LanceOf(cs, e.pilot.id) === id).length]));
  return { pilotId: inA.pilot.id, cardA: cardA && { cx: cardA.x + cardA.w / 2, cy: cardA.y + cardA.h / 2 }, tabC: tabC && { cx: tabC.x + tabC.w / 2, cy: tabC.y + tabC.h / 2 }, before: sizes() };
});
console.log("\n[2a] setup:", JSON.stringify(setup2));
check("every lance is at the cap (15-pilot save)", setup2.before, { a: 5, b: 5, c: 5 });

await dragTo(box.x + setup2.cardA.cx, box.y + setup2.cardA.cy, box.x + setup2.tabC.cx, box.y + setup2.tabC.cy);
await drop();
const after2 = await page.evaluate((pilotId) => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const cs = hub.campaignState;
  const LanceOf = hub.rosterPanel.constructor.lanceOf;
  const read = (c) => { const out = []; const walk = (l) => { for (const o of l) { if (o.type === "Text" && typeof o.text === "string" && o.visible !== false) out.push(o.text); if (o.list) walk(o.list); } }; walk(c.list); return out; };
  const sizes = () => Object.fromEntries(["a", "b", "c"].map((id) => [id, Object.values(cs.pilots).filter((e) => e.status === "active" && LanceOf(cs, e.pilot.id) === id).length]));
  const texts = read(hub.rosterPanel.container);
  return { after: sizes(), stillInA: LanceOf(cs, pilotId) === "a", notice: texts.find((t) => t.includes("full")) ?? null, holding: texts.some((t) => t.includes("holding")) };
}, setup2.pilotId);
console.log("[2b] after dropping on a full tab:", JSON.stringify(after2));
check("no lance changed size", after2.after, { a: 5, b: 5, c: 5 });
check("the dragged pilot stayed put", after2.stillInA, true);
check("the panel explains 3rd Lance is full", after2.notice !== null, true);
check("and offers a trade instead of a silent no-op", after2.holding, true);
await page.screenshot({ path: new URL("./drag_full_lance_result.png", import.meta.url).pathname });

// ---- 3. Releasing outside every tab and every card cancels cleanly -----
const setup3 = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const cs = hub.campaignState;
  const LanceOf = hub.rosterPanel.constructor.lanceOf;
  hub.rosterPanel.open(cs); // clears whatever "holding" state test 2 left behind
  const inA = Object.values(cs.pilots).find((e) => e.status === "active" && LanceOf(cs, e.pilot.id) === "a");
  const cardA = hub.rosterPanel.cardRects.find((r) => r.pilotId === inA.pilot.id);
  const sizes = () => Object.fromEntries(["a", "b", "c"].map((id) => [id, Object.values(cs.pilots).filter((e) => e.status === "active" && LanceOf(cs, e.pilot.id) === id).length]));
  return { pilotId: inA.pilot.id, cardA: cardA && { cx: cardA.x + cardA.w / 2, cy: cardA.y + cardA.h / 2 }, before: sizes() };
});
// Released well above the canvas entirely — guaranteed to miss every tab
// and card rect regardless of this campaign's current panel layout.
await dragTo(box.x + setup3.cardA.cx, box.y + setup3.cardA.cy, box.x - 30, box.y - 30);
await drop();
const after3 = await page.evaluate((pilotId) => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const cs = hub.campaignState;
  const LanceOf = hub.rosterPanel.constructor.lanceOf;
  const sizes = () => Object.fromEntries(["a", "b", "c"].map((id) => [id, Object.values(cs.pilots).filter((e) => e.status === "active" && LanceOf(cs, e.pilot.id) === id).length]));
  return { after: sizes(), stillInA: LanceOf(cs, pilotId) === "a" };
}, setup3.pilotId);
console.log("\n[3] released outside every drop target:", JSON.stringify(after3));
check("nothing changed size", after3.after, setup3.before);
check("the dragged pilot stayed exactly where they started", after3.stillInA, true);

console.log("\nconsole errors:", errors.length ? errors : "none");
if (errors.length) failed = true;
await browser.close();
console.log(failed ? "\nRESULT: FAILED" : "\nRESULT: PASSED");
if (failed) process.exitCode = 1;
