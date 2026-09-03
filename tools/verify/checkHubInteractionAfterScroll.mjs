// Carrier Scale-Up Plan v1 Phase 1, follow-on verification — 3 Sep 2026.
// Same save/boot pattern as every other script here (see the README).
//
// checkHubCameraScroll.mjs proved the camera scrolls, clamps per deck, and
// that HOVER still resolves the right NPC afterward. This covers the other
// half of the same risk, which that script deliberately did not touch:
// CLICKING. Hover reads a pointer position this codebase computes itself
// (the bug that pass found and fixed); clicks are hit-tested by Phaser's
// own input plugin against each object's scrollFactor, which is exactly the
// property this pass changed on ~20 objects. If any of that were wrong, the
// symptom is a Hub that looks perfect in a screenshot and quietly ignores
// or misroutes every click the moment the player walks away from spawn.
//
// Checked here, all with the camera deliberately scrolled well off (0,0):
//  1. Clicking a WORLD-space object (an NPC circle) provokes THAT NPC and
//     no other — world hit-testing still lines up with what's drawn.
//  2. Clicking a SCREEN-FIXED button (MENU, top-right) still opens its
//     overlay — scrollFactor(0) hit-testing lines up with what's drawn.
//  3. That overlay renders centered on the actual screen, not offset by the
//     camera's scroll — this is the specific bug the MenuOverlay backdrop's
//     camera.centerX/centerY fix was for.
//  4. The chat box, which is a real DOM element rather than a canvas
//     object, sits where it's drawn — DOM elements take scrollFactor too,
//     and a wrong one here puts a floating HTML input somewhere off the
//     page entirely.
//  5. A keyboard-opened canvas overlay (History, H) renders on-screen.
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
if (!box) throw new Error("no canvas found");

await page.mouse.click(box.x + 480, box.y + 300); // CONTINUE
await page.waitForTimeout(1800);

// ---- Force a real, substantial camera scroll, then confirm it took.
await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  hub.playerX = 1000;
  hub.playerY = 900;
  hub.player.setPosition(1000, 900);
});
// Let the follow lerp settle — polled, not a fixed wait (3 Sep 2026): the
// sandbox's software-rendered headless Chromium runs the game at ~10fps,
// so the 0.12 lerp needs a few real seconds, and computing an NPC's screen
// position before the camera stops moving is a miss that has nothing to
// do with the hit-test under test.
for (let i = 0, prev = null; i < 40; i++) {
  await page.waitForTimeout(250);
  const cur = await page.evaluate(() => {
    const cam = window.__bwGame.scene.getScene("Hub").cameras.main;
    return `${Math.round(cam.scrollX)},${Math.round(cam.scrollY)}`;
  });
  if (cur === prev) break;
  prev = cur;
}
const scroll = await page.evaluate(() => {
  const cam = window.__bwGame.scene.getScene("Hub").cameras.main;
  return { x: Math.round(cam.scrollX), y: Math.round(cam.scrollY) };
});
console.log("Camera scrolled to:", scroll);
const cameraIsScrolled = scroll.x > 100 && scroll.y > 100;

// ---- Check 1: click a world-space NPC while scrolled.
// Move a specific NPC to a known spot near the player so it's certainly on
// screen and certainly the only thing under that pixel, then click exactly
// where the camera says it is drawn.
const clickTarget = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const cam = hub.cameras.main;
  // Must be an NPC on the PLAYER'S OWN deck: refreshRoomVisibility disables
  // interactivity (and visibility) for everyone else, so clicking one of
  // them would correctly hit nothing and fall through to the broadcast
  // Talk — which looks exactly like a hit-test bug in the results and
  // isn't one. (It reads as one because a nearby NPC then answers the
  // broadcast, so SOMETHING reacts, just not the one that was clicked.)
  const onDeck = hub.npcs.filter((n) => hub.roomDeckOf(n.room) === hub.roomDeckOf(hub.currentRoomId)); // 3 Sep 2026: live deck lookup, not a hand list
  if (onDeck.length === 0) return null;
  const npc = onDeck[0];
  // Park it right next to the player, well clear of any other body, and
  // stop it walking off before the click lands.
  npc.x = 1080;
  npc.y = 900;
  npc.root.setPosition(1080, 900);
  npc.targetX = undefined;
  npc.targetY = undefined;
  npc.nextRoamAt = Number.MAX_SAFE_INTEGER; // don't hand it a new target mid-check
  npc.bubbleUntil = 0;
  npc.bubbleContainer.setVisible(false);
  // Anyone else close enough to steal the click gets moved out of the way,
  // so a miss can only mean the hit-test itself is wrong.
  for (const other of hub.npcs) {
    if (other === npc) continue;
    if (Math.hypot(other.x - 1080, other.y - 900) < 120) {
      other.x -= 400;
      other.root.setPosition(other.x, other.y);
      other.targetX = undefined;
      other.nextRoamAt = Number.MAX_SAFE_INTEGER;
    }
  }
  return { id: npc.pilotId, name: npc.displayName, screenX: 1080 - cam.scrollX, screenY: 900 - cam.scrollY };
});

let npcClickResult = "no NPC available on this deck";
if (clickTarget && clickTarget.screenX > 0 && clickTarget.screenX < 1074 && clickTarget.screenY > 0 && clickTarget.screenY < 640) {
  await page.mouse.click(box.x + clickTarget.screenX, box.y + clickTarget.screenY);
  await page.waitForTimeout(400);
  const bubbles = await page.evaluate(() => {
    const hub = window.__bwGame.scene.getScene("Hub");
    return hub.npcs.filter((n) => n.bubbleUntil > 0).map((n) => ({ id: n.pilotId, name: n.displayName }));
  });
  const hitTheRightOne = bubbles.some((b) => b.id === clickTarget.id);
  npcClickResult = hitTheRightOne
    ? `PASS — clicking ${clickTarget.name} at scrolled screen (${Math.round(clickTarget.screenX)},${Math.round(clickTarget.screenY)}) provoked that NPC`
    : `FAIL — clicked where ${clickTarget.name} is drawn; reacting NPCs were ${bubbles.length ? bubbles.map((b) => b.name).join(", ") : "none at all"}`;
} else if (clickTarget) {
  npcClickResult = `NPC landed off-screen at (${Math.round(clickTarget.screenX)},${Math.round(clickTarget.screenY)}) — retry, not a code failure`;
}
console.log("World-space NPC click:", npcClickResult);
await page.screenshot({ path: new URL("./click_npc.png", import.meta.url).pathname });

// ---- Check 4: the chat box DOM element, opened with T while scrolled.
await page.keyboard.press("t");
await page.waitForTimeout(400);
const chatBox = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const el = hub.chatInput.node;
  const r = el.getBoundingClientRect();
  const canvasRect = document.querySelector("canvas").getBoundingClientRect();
  return {
    visible: hub.chatInput.visible,
    centerXOnCanvas: Math.round(r.left + r.width / 2 - canvasRect.left),
    centerYOnCanvas: Math.round(r.top + r.height / 2 - canvasRect.top),
  };
});
// OVERHEARD/chat UI-camera dock, Carrier Scale-Up Plan v1 Phase 2, 3 Sep
// 2026 — buildChatBox now draws this at DOCK_LOG_CENTER_X/DOCK_INPUT_Y,
// dock-local coordinates that land it at absolute screen x≈952 (under the
// OVERHEARD panel, inside the dock strip at DOCK_SPLIT_X=838..1074), not
// the old centered-under-the-play-area x=480 this assertion originally
// checked. The actual regression risk this check still guards against is
// unchanged: a wrong scrollFactor (or, now, a wrong camera routing) would
// drag it off by the camera's own scroll (hundreds of px) rather than
// leaving it pinned to this fixed screen spot regardless of where the
// world camera has scrolled to — see checkDockCameraSplit.mjs for the
// fuller, dedicated verification of the new dock split itself.
const chatBoxOk = chatBox.visible && Math.abs(chatBox.centerXOnCanvas - 952) < 12 && chatBox.centerYOnCanvas > 0 && chatBox.centerYOnCanvas < 640;
console.log("Chat box (DOM element) while scrolled:", chatBox, chatBoxOk ? "PASS" : "FAIL");
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

// ---- Check 5: History overlay, a canvas overlay container. Opened
// directly rather than with the H key: H routes through openNearestPanel,
// which needs an NPC standing within range of the player, and this check is
// about where the overlay RENDERS once open, not about the proximity gate.
await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const npc = hub.npcs[0];
  hub.openHistory(npc);
});
await page.waitForTimeout(400);
const historyOverlay = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const o = hub.historyOverlay;
  const b = o.getBounds();
  return { visible: o.visible, scrollFactorX: o.scrollFactorX, left: Math.round(b.x), top: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height) };
});
const historyOk = historyOverlay.visible && historyOverlay.scrollFactorX === 0 && historyOverlay.left > -50 && historyOverlay.left < 1074;
console.log("History overlay while scrolled:", historyOverlay, historyOk ? "PASS" : "FAIL");
await page.screenshot({ path: new URL("./click_history.png", import.meta.url).pathname });
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

// ---- Checks 2+3: the MENU button (screen-fixed, top-right at 900,20) and
// the overlay it opens.
await page.mouse.click(box.x + 900, box.y + 20);
await page.waitForTimeout(500);
const menu = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  // showMenuOverlay builds a fresh container at depth 15 each open — find it
  // by depth rather than by a field, since it's deliberately not stored.
  const layer = hub.children.list.filter((c) => c.depth === 15 && c.type === "Container").pop();
  if (!layer) return { opened: false };
  const b = layer.getBounds();
  return {
    opened: true,
    scrollFactorX: layer.scrollFactorX,
    left: Math.round(b.x),
    top: Math.round(b.y),
    width: Math.round(b.width),
    height: Math.round(b.height),
    childCount: layer.list.length,
  };
});
// A backdrop still using camera.centerX/centerY under a scrollFactor(0)
// layer would sit hundreds of px off to the bottom-right of the canvas —
// this is the check for that specific bug.
const menuOk = menu.opened && menu.scrollFactorX === 0 && menu.left > -60 && menu.left < 200 && menu.top > -60 && menu.top < 200;
console.log("MENU button + overlay while scrolled:", menu, menuOk ? "PASS" : "FAIL");
await page.screenshot({ path: new URL("./click_menu.png", import.meta.url).pathname });

const out = { scroll, cameraIsScrolled, npcClickResult, chatBox, chatBoxOk, historyOverlay, historyOk, menu, menuOk, pageErrors };
writeFileSync(new URL("./interaction_report.json", import.meta.url), JSON.stringify(out, null, 2));

console.log("\n=== SUMMARY ===");
console.log("cameraIsScrolled (checks below are meaningful):", cameraIsScrolled);
console.log("npcClickResult:", npcClickResult);
console.log("chatBoxOk (DOM input stays on screen):", chatBoxOk);
console.log("historyOk (canvas overlay stays on screen):", historyOk);
console.log("menuOk (screen-fixed button clickable + overlay centered):", menuOk);
console.log("pageErrors:", pageErrors.length ? pageErrors : "none");

await browser.close();
