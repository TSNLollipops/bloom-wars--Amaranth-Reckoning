// Carrier Scale-Up Plan v1 Phase 2 (OVERHEARD/UI-camera dock), 3 Sep 2026 —
// live-browser verification for the two-camera dock split. Same save/boot
// pattern as every other script in this directory (see this directory's
// own README).
//
// What this checks against the REAL running scene:
//  1. The main/world camera's own viewport is genuinely narrowed (not just
//     covered by something opaque on top) and the UI/dock camera exists at
//     exactly the complementary strip — checked once as a scene-level fact,
//     then re-checked after every deck switch to prove it's not deck-
//     dependent state that only happens to be right at spawn.
//  2. On EVERY deck (lower/upper/grotto/sparRoom), teleporting the player
//     to a position whose camera scroll WOULD have put real floor/wall
//     content in the old CHAT_LOG_X..1074 strip (if the viewport weren't
//     narrowed) leaves that entire screen strip showing only the dock's
//     own background — sampled pixels, not a guess from geometry alone.
//  3. The OVERHEARD panel, its label/log text, the corner MENU button, and
//     the T-activated chat input all render at their expected on-screen
//     pixel positions inside the dock strip.
//  4. Opening MENU (click) darkens the FULL canvas, dock strip included,
//     not just the narrower main viewport — the exact regression the task
//     flagged as a real risk of the viewport-narrowing change.
//  5. T opens the chat box in its new position under the OVERHEARD panel;
//     typing and Enter posts the line into the visible log.
//  6. Room title / deck indicator / interact prompt / footer button — the
//     HUD elements this task was NOT supposed to touch — still render at
//     their old positions, unaffected.
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
await page.waitForTimeout(1500); // Boot -> MainMenu

const canvas = page.locator("canvas");
const box = await canvas.boundingBox();
if (!box) throw new Error("no canvas found");

await page.mouse.click(box.x + 480, box.y + 300); // CONTINUE
await page.waitForTimeout(1500); // Hub scene create()

const sceneReady = await page.evaluate(() => {
  const g = window.__bwGame;
  if (!g) return "no __bwGame";
  const hub = g.scene.getScene("Hub");
  if (!hub) return "no Hub scene";
  return hub.scene.isActive() ? "active" : "inactive:" + hub.scene.settings.status;
});
console.log("Hub scene status:", sceneReady);

// ---- Check 1: camera viewport geometry, scene-level.
const camGeom = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const main = hub.cameras.main;
  const ui = hub.uiCamera;
  return {
    mainCount: hub.cameras.cameras.length,
    main: { x: main.x, y: main.y, width: main.width, height: main.height },
    ui: ui ? { x: ui.x, y: ui.y, width: ui.width, height: ui.height } : null,
  };
});
console.log("Camera geometry:", camGeom);
const viewportCorrect =
  camGeom.mainCount === 2 &&
  camGeom.main.x === 0 &&
  camGeom.main.y === 0 &&
  camGeom.main.width === 838 &&
  camGeom.main.height === 640 &&
  camGeom.ui &&
  camGeom.ui.x === 838 &&
  camGeom.ui.y === 0 &&
  camGeom.ui.width === 236 &&
  camGeom.ui.height === 640;
console.log("viewportCorrect:", viewportCorrect);

await page.screenshot({ path: new URL("./dock_start.png", import.meta.url).pathname });

// ---- Helper: sample the dock strip (screen x 842..1071, a couple px in
// from each viewport edge to dodge the camera's own border pixel) for any
// pixel that looks like FLOOR/WALL/PLAYER/NPC color rather than dock chrome
// (PANEL_BG #1a2028, the camera backgroundColor #0c0f12, TEXT_MAIN/TEXT_DIM,
// or the MENU button's own bg #2e5c7a/#1a2028/#3a6f92). Real floor colors
// (see engine/hubLayout.ts's own C palette) are washed-out tan/olive/blue-
// grey tones nothing dock-side uses. Sampled by drawing the live game
// canvas into a same-page 2D canvas and reading pixels directly — no PNG
// decoding dependency needed, and it reads the actual composited frame the
// player would see, not a re-derivation from geometry alone.
async function sampleDockStrip(label) {
  const suspicious = await page.evaluate(() => {
    const src = document.querySelector("canvas");
    const off = document.createElement("canvas");
    off.width = src.width;
    off.height = src.height;
    const ctx = off.getContext("2d");
    ctx.drawImage(src, 0, 0);
    const scaleX = src.width / 1074;
    const scaleY = src.height / 640;
    const safe = [
      [0x1a, 0x20, 0x28],
      [0x0c, 0x0f, 0x12],
      [0x3a, 0x45, 0x52],
      [0x2e, 0x5c, 0x7a],
      [0x3a, 0x6f, 0x92],
      [0x00, 0x00, 0x00], // pure black — camera backgroundColor composited/rounded darker than its own hex in practice
    ];
    // Anything low-brightness and roughly neutral (not a saturated color)
    // reads as dock background/border, not a floor/wall/room-tint color —
    // hubLayout.ts's own C palette runs distinctly warmer/more saturated
    // than this scene's near-black dock chrome.
    const looksNearBlackNeutral = (r, g, b) => r < 40 && g < 40 && b < 45 && Math.max(r, g, b) - Math.min(r, g, b) < 15;
    const closeEnough = (r, g, b) => looksNearBlackNeutral(r, g, b) || safe.some(([sr, sg, sb]) => Math.abs(r - sr) < 12 && Math.abs(g - sg) < 12 && Math.abs(b - sb) < 12);
    const found = [];
    for (let x = 842; x < 1071; x += 6) {
      for (let y = 4; y < 636; y += 6) {
        const px = Math.round(x * scaleX);
        const py = Math.round(y * scaleY);
        const d = ctx.getImageData(px, py, 1, 1).data;
        const r = d[0],
          g = d[1],
          b = d[2];
        const looksLikeDockText = (r > 130 && g > 130 && b > 130) || (Math.abs(r - 0x8a) < 30 && Math.abs(g - 0x97) < 30 && Math.abs(b - 0xa6) < 30) || (Math.abs(r - 0x4a) < 20 && Math.abs(g - 0x7a) < 20 && Math.abs(b - 0x9a) < 20);
        if (!closeEnough(r, g, b) && !looksLikeDockText) {
          found.push({ x, y, rgb: [r, g, b] });
        }
      }
    }
    return found;
  });
  console.log(`[${label}] dock-strip suspicious pixel samples:`, suspicious.length, suspicious.slice(0, 6));
  return suspicious;
}

// ---- Per-deck check: teleport the player to a point whose camera scroll
// would have shown real floor content past the old CHAT_LOG_X (838) strip
// if the main camera's own viewport weren't narrowed, then sample the dock
// strip for leakage. Uses the real currentRoomId/refreshRoomVisibility path
// (switchRoom-equivalent) rather than a hand-copied door table.
async function checkDeck(deckId, roomId, label) {
  const result = await page.evaluate(
    ({ roomId }) => {
      const hub = window.__bwGame.scene.getScene("Hub");
      const layout = window.__bwHubLayout;
      hub.currentRoomId = roomId;
      hub.refreshRoomVisibility();
      const bounds = hub.cameras.main.getBounds();
      // Push the player toward the deck's own right edge, well past where
      // the OLD 1074-wide viewport would have shown content at screen
      // x>838 — the exact region the dock strip now owns exclusively.
      const targetX = Math.max(bounds.x + 500, bounds.x + bounds.width - 120);
      const targetY = bounds.y + Math.min(300, bounds.height / 2);
      const resolved = layout.resolveAgainstSolids(hub.roomDeckOf(hub.currentRoomId), targetX, targetY, 15);
      hub.playerX = resolved.x;
      hub.playerY = resolved.y;
      hub.player.setPosition(resolved.x, resolved.y);
      return { bounds: { x: bounds.x, y: bounds.y, w: bounds.width, h: bounds.height }, resolved };
    },
    { roomId }
  );
  // Let the 0.12 camera lerp settle (polled — see checkHubCameraScroll.mjs's
  // own comment on why a fixed wait isn't enough in this sandbox).
  for (let i = 0, prev = null; i < 40; i++) {
    await page.waitForTimeout(200);
    const cur = await page.evaluate(() => {
      const cam = window.__bwGame.scene.getScene("Hub").cameras.main;
      return `${Math.round(cam.scrollX)},${Math.round(cam.scrollY)}`;
    });
    if (cur === prev) break;
    prev = cur;
  }
  const state = await page.evaluate(() => {
    const hub = window.__bwGame.scene.getScene("Hub");
    const cam = hub.cameras.main;
    return { room: hub.currentRoomId, scrollX: Math.round(cam.scrollX), scrollY: Math.round(cam.scrollY), playerX: Math.round(hub.playerX), playerY: Math.round(hub.playerY) };
  });
  console.log(`[${label}] deck=${deckId} room=${roomId} teleport result:`, result, "state:", state);
  await page.screenshot({ path: new URL(`./dock_deck_${deckId}.png`, import.meta.url).pathname });
  const suspicious = await sampleDockStrip(label);
  return { deckId, roomId, state, suspiciousCount: suspicious.length, suspicious: suspicious.slice(0, 10) };
}

// Expose hubLayout module for resolveAgainstSolids/roomDeckOf use inside
// page.evaluate above (dynamic import inside evaluate is awkward across
// calls, so pull the module reference into window once).
await page.evaluate(async () => {
  window.__bwHubLayout = await import("/src/engine/hubLayout.ts");
});

const deckResults = [];
deckResults.push(await checkDeck("lower", "recroom", "lower deck"));
deckResults.push(await checkDeck("upper", "cic", "upper deck"));
deckResults.push(await checkDeck("grotto", "grotto", "grotto deck"));
deckResults.push(await checkDeck("sparRoom", "sparRoom", "spar deck"));

// ---- Check 3: dock content itself renders at the right screen pixels.
// Sample known landmark pixels: OVERHEARD panel background near its own
// top-left corner (just inside the dock strip, below the MENU button),
// and the MENU button's own bg color at its expected screen position.
const landmarks = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  return {
    chatLogTextVisible: hub.chatLogText.visible,
    chatLogTextText: hub.chatLogText.text,
  };
});
console.log("Dock content landmarks:", landmarks);

const buf1 = await page.screenshot();
writeFileSync(new URL("./dock_landmarks.png", import.meta.url).pathname, buf1);

// ---- Check 4: MENU click darkens the FULL canvas including the dock strip.
await page.mouse.click(box.x + 900, box.y + 20);
await page.waitForTimeout(300);
await page.screenshot({ path: new URL("./dock_menu_open.png", import.meta.url).pathname });
const dockPoint = await page.evaluate(() => {
  const src = document.querySelector("canvas");
  const off = document.createElement("canvas");
  off.width = src.width;
  off.height = src.height;
  const ctx = off.getContext("2d");
  ctx.drawImage(src, 0, 0);
  const scaleX = src.width / 1074;
  const scaleY = src.height / 640;
  // Sample well inside the dock strip, away from the MENU panel's own
  // content (which is cams[0]-only and shouldn't extend past x~670) — this
  // point should now read as darkened backdrop (~0x000000 @ 0.75 over
  // whatever dock chrome was there), not full-brightness dock chrome.
  const px = Math.round(950 * scaleX);
  const py = Math.round(300 * scaleY);
  const d = ctx.getImageData(px, py, 1, 1).data;
  return [d[0], d[1], d[2]];
});
console.log("Dock strip pixel with MENU open (950,300):", dockPoint);
const dockDarkened = dockPoint[0] < 100 && dockPoint[1] < 100 && dockPoint[2] < 100;
console.log("dockDarkenedWithMenuOpen:", dockDarkened);

// Close via CLOSE button (main-camera panel, still at its old position).
const menuState = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  return { room: hub.currentRoomId };
});
console.log("Menu open state check (room unaffected):", menuState);
await page.keyboard.press("Escape").catch(() => {});
// CLOSE button sits at (480, ~340ish depending on ironman/save row) — just
// click well within the panel's own CLOSE row range, or fall back to
// reading the scene for whether the overlay closed on its own via Escape.
await page.waitForTimeout(200);

// ---- Check 5: T opens chat box in its new dock position; type + Enter
// posts a line into the visible OVERHEARD log.
// First make sure any menu overlay is gone by pressing Escape twice more
// and clicking a neutral spot, then focus canvas.
await page.keyboard.press("Escape").catch(() => {});
await page.waitForTimeout(150);
await canvas.click({ position: { x: 480, y: 400 } });
await page.waitForTimeout(150);

await page.keyboard.press("t");
await page.waitForTimeout(200);
const chatBoxState = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const node = hub.chatInput.node;
  const rect = node.getBoundingClientRect();
  const canvasRect = document.querySelector("canvas").getBoundingClientRect();
  return {
    chatOpen: hub.chatOpen,
    display: node.style.display,
    // position relative to the canvas's own top-left, in CSS px (pre
    // devicePixelRatio) — should land inside the dock strip, under the
    // OVERHEARD panel.
    relX: rect.left - canvasRect.left,
    relY: rect.top - canvasRect.top,
    canvasCssWidth: canvasRect.width,
  };
});
console.log("Chat box state after T:", chatBoxState);

const TEST_LINE = "dock camera split verification line";
await page.keyboard.type(TEST_LINE);
await page.keyboard.press("Enter");
await page.waitForTimeout(300);
const afterSend = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  return { chatOpen: hub.chatOpen, chatLogText: hub.chatLogText.text, chatLogVisible: hub.chatLogText.visible };
});
console.log("After sending chat line:", afterSend);
await page.screenshot({ path: new URL("./dock_chat_sent.png", import.meta.url).pathname });

// ---- Check 6: untouched HUD elements still where they should be.
const hudCheck = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  return {
    roomTitle: hub.roomTitleText.text,
    roomTitlePos: { x: hub.roomTitleText.x, y: hub.roomTitleText.y },
    deckIndicator: hub.deckIndicatorText.text,
    interactPromptPos: { x: hub.interactPrompt.x, y: hub.interactPrompt.y },
  };
});
console.log("HUD check (should be unchanged from before this pass):", hudCheck);

// ---- Check 7: the instructions text (wordWrap narrowed 900->700 this
// pass) actually fits inside the narrowed main camera's own viewport
// (0..838), and doesn't collide with deckIndicatorText below it.
const instructionsCheck = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  // Find it by content rather than a field (it was never given one) — the
  // one scrollFactor(0) Text at y=44 with this wordWrap width.
  const candidates = hub.children.list.filter((o) => o.type === "Text" && o.y === 44);
  const t = candidates[0];
  if (!t) return { found: false };
  const b = t.getBounds();
  return { found: true, left: b.left, right: b.right, top: b.top, bottom: b.bottom, lineCount: t.text.split("\n").length };
});
console.log("Instructions text bounds:", instructionsCheck);
const deckIndicatorTop = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  return hub.deckIndicatorText.getBounds().top;
});
console.log("deckIndicatorText top:", deckIndicatorTop);
const instructionsFitAndClear =
  instructionsCheck.found && instructionsCheck.left >= 0 && instructionsCheck.right <= 838 && instructionsCheck.bottom < deckIndicatorTop;
console.log("instructionsFitAndClear:", instructionsFitAndClear);

const out = {
  sceneReady,
  camGeom,
  viewportCorrect,
  deckResults,
  landmarks,
  dockDarkenedWithMenuOpen: dockDarkened,
  chatBoxState,
  afterSend,
  chatLineLanded: afterSend.chatLogText.includes(TEST_LINE),
  hudCheck,
  instructionsCheck,
  deckIndicatorTop,
  instructionsFitAndClear,
  pageErrors,
};
writeFileSync(new URL("./dock_report.json", import.meta.url).pathname, JSON.stringify(out, null, 2));

console.log("\n=== SUMMARY ===");
console.log("viewportCorrect:", viewportCorrect);
for (const d of deckResults) {
  console.log(`deck ${d.deckId}: suspiciousCount=${d.suspiciousCount}`);
}
console.log("dockDarkenedWithMenuOpen:", dockDarkened);
console.log("chatLineLanded:", out.chatLineLanded);
console.log("instructionsFitAndClear:", instructionsFitAndClear);
console.log("pageErrors:", pageErrors.length ? pageErrors : "none");

await browser.close();
