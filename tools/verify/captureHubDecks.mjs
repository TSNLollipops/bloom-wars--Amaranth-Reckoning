// Floor-plan pass, 3 Sep 2026 — screenshots of every deck, whole-deck
// (camera zoomed out so the full plan fits one frame) and at gameplay
// scale, plus a live roaming check: does the crowd actually move through
// doorways now that walls exist? Same save/boot pattern as every other
// script here (see the README).
//
// The roaming check is the honest part. Walls without pathfinding would
// pass every static check and still leave half the roster nose-to-wall;
// so this samples every NPC's position over ~40s of real Hub time and
// reports how many changed ROOM (which, on a walled deck, can only happen
// by walking through a doorway), how many crossed a DECK (stairs), and
// how many ever sat stuck past STUCK_TIMEOUT_MS. It also asserts nobody
// is ever standing inside a wall or a piece of furniture — the collision
// hook in clampToDeckFloor is the only thing keeping that true.
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "fs";

const save = readFileSync(new URL("./save.json", import.meta.url), "utf8");
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1074, height: 640 } });
const pageErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") pageErrors.push(msg.text());
});
page.on("pageerror", (err) => pageErrors.push(err.message));
await page.addInitScript((saveJson) => {
  window.localStorage.setItem("bloomwars_campaign_state_v1", saveJson);
}, save);
await page.goto("http://localhost:5183/", { waitUntil: "load" });
await page.waitForTimeout(1500);
const canvas = page.locator("canvas");
const box = await canvas.boundingBox();
await page.mouse.click(box.x + 480, box.y + 300); // CONTINUE
await page.waitForTimeout(1800);

const shot = (name) => page.screenshot({ path: new URL(`./${name}.png`, import.meta.url).pathname });

// --- whole-deck views -------------------------------------------------------
const decks = await page.evaluate(async () => {
  const layout = await import("/src/engine/hubLayout.ts");
  return Object.values(layout.DECK_LAYOUTS).map((d) => ({ id: d.id, bounds: d.bounds, rooms: Object.keys(d.rooms) }));
});
// Hide every screen-pinned HUD element for the whole-deck captures (camera
// zoom scales pinned objects too, so they'd smear across the plan), and
// remember which were visible so they come back exactly as they were.
await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  hub.__hudWasVisible = hub.children.list.filter((o) => o.scrollFactorX === 0 && o.visible);
  for (const o of hub.__hudWasVisible) o.setVisible(false);
  const dom = document.querySelector("input");
  if (dom) dom.style.visibility = "hidden";
});
for (const deck of decks) {
  await page.evaluate(({ id, bounds }) => {
    const hub = window.__bwGame.scene.getScene("Hub");
    // Put the player on this deck (its first roamable room) so the deck's
    // own layer is the visible one, then frame the whole deck.
    const room = hub.doorMarkers.map((m) => m.def).find((d) => d.room && hub.roomDeckOf(d.room) === id)?.room;
    hub.currentRoomId = room;
    const cam = hub.cameras.main;
    hub.refreshRoomVisibility();
    cam.stopFollow();
    // Fit the deck into the main/world camera's own viewport — narrower
    // than the full 1074x640 canvas since the OVERHEARD/chat UI-camera
    // dock split (Carrier Scale-Up Plan v1 Phase 2, 3 Sep 2026 — see
    // Hub.ts's own DOCK_SPLIT_X header): cam.width/height read live off
    // the camera itself rather than the canvas's own full dimensions, so
    // this whole-deck capture frames what the main camera can actually
    // show, not a wider box that would clip the deck's own right/bottom
    // edge out of frame.
    const w = bounds.right - bounds.left + 60;
    const h = bounds.bottom - bounds.top + 60;
    const zoom = Math.min(cam.width / w, cam.height / h);
    cam.setZoom(zoom);
    cam.setBounds(bounds.left - 2000, bounds.top - 2000, w + 4000, h + 4000);
    cam.centerOn((bounds.left + bounds.right) / 2, (bounds.top + bounds.bottom) / 2);
  }, deck);
  await page.waitForTimeout(400);
  await shot(`deck_${deck.id}_full`);
}

// --- gameplay-scale views ---------------------------------------------------
await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  for (const o of hub.__hudWasVisible) o.setVisible(true);
  const dom = document.querySelector("input");
  if (dom) dom.style.visibility = "";
  const cam = hub.cameras.main;
  cam.setZoom(1);
  hub.currentRoomId = "recroom";
  hub.playerX = 480;
  hub.playerY = 760;
  hub.player.setPosition(480, 760);
  hub.refreshRoomVisibility();
  cam.startFollow(hub.player, true, 1, 1);
});
await page.waitForTimeout(500);
await shot("deck_lower_recroom_1x");
await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  hub.currentRoomId = "upperHall";
  hub.playerX = 700;
  hub.playerY = 468;
  hub.player.setPosition(700, 468);
  hub.refreshRoomVisibility();
});
await page.waitForTimeout(500);
await shot("deck_upper_corridor_1x");
await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  hub.currentRoomId = "grotto";
  hub.playerX = 700;
  hub.playerY = 560;
  hub.player.setPosition(700, 560);
  hub.refreshRoomVisibility();
});
await page.waitForTimeout(500);
await shot("deck_grotto_1x");

// --- roaming through doorways ---------------------------------------------
await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  hub.currentRoomId = "recroom";
  hub.playerX = 480;
  hub.playerY = 760;
  hub.player.setPosition(480, 760);
  hub.refreshRoomVisibility();
  hub.cameras.main.startFollow(hub.player, true, 0.12, 0.12);
});
const samples = [];
const SAMPLE_EVERY_MS = 2000;
const SAMPLES = 20;
for (let i = 0; i < SAMPLES; i++) {
  const s = await page.evaluate(async () => {
    const layout = await import("/src/engine/hubLayout.ts");
    const hub = window.__bwGame.scene.getScene("Hub");
    return hub.npcs.map((n) => ({
      id: n.pilotId,
      room: n.room,
      deck: hub.roomDeckOf(n.room),
      x: Math.round(n.x),
      y: Math.round(n.y),
      walking: n.targetX !== undefined,
      pathLen: n.path ? n.path.length : -1,
      stuckMs: n.stuckMs ?? 0,
      inSolid: layout.circleHitsSolid(hub.roomDeckOf(n.room), n.x, n.y, 16 - 1),
    }));
  });
  samples.push(s);
  await page.waitForTimeout(SAMPLE_EVERY_MS);
}
await shot("deck_lower_roam_end");

const byId = new Map();
for (const s of samples) {
  for (const n of s) {
    const e = byId.get(n.id) ?? { rooms: new Set(), decks: new Set(), moved: 0, last: null, everInSolid: false, maxStuck: 0, walked: 0 };
    e.rooms.add(n.room);
    e.decks.add(n.deck);
    if (e.last) e.moved += Math.hypot(n.x - e.last.x, n.y - e.last.y);
    e.last = n;
    if (n.inSolid) e.everInSolid = true;
    e.maxStuck = Math.max(e.maxStuck, n.stuckMs);
    if (n.walking) e.walked++;
    byId.set(n.id, e);
  }
}
const summary = [...byId.entries()].map(([id, e]) => ({ id, rooms: [...e.rooms], decks: [...e.decks], moved: Math.round(e.moved), everInSolid: e.everInSolid, maxStuck: e.maxStuck, walkedSamples: e.walked }));
const changedRoom = summary.filter((s) => s.rooms.length > 1).length;
const changedDeck = summary.filter((s) => s.decks.length > 1).length;
const inSolid = summary.filter((s) => s.everInSolid).map((s) => s.id);
const stuckLong = summary.filter((s) => s.maxStuck > 4000).map((s) => s.id);
console.log(`NPCs sampled: ${summary.length}`);
console.log(`changed ROOM during the window (walked through a doorway): ${changedRoom}`);
console.log(`changed DECK during the window (took stairs): ${changedDeck}`);
console.log(`ever inside a wall/solid: ${inSolid.length ? inSolid : "none"}`);
console.log(`stuck > 4s: ${stuckLong.length ? stuckLong : "none"}`);
console.log(`pageErrors: ${pageErrors.length ? pageErrors : "none"}`);
writeFileSync(new URL("./capture_report.json", import.meta.url), JSON.stringify({ summary, pageErrors }, null, 2));
await browser.close();
process.exit(inSolid.length === 0 && pageErrors.length === 0 && changedRoom > 0 ? 0 : 1);
