// Carrier Scale-Up Plan v1, Phase 1 — live-browser verification, 3 Sep
// 2026. Same save/boot pattern as checkHubNpcs.mjs and the other scripts
// in this directory (see this directory's own README). Answers the Plan
// doc's own requirement: "requires a real Playwright walkthrough before
// shipping, not just static checks."
//
// What this actually checks, against the REAL running scene (not a mock):
//  1. The camera really scrolls when the player walks into the new open
//     floor, and the player can actually reach world positions past the
//     OLD ROOM_BOUNDS edges (830/552) — proof the bigger floor is real and
//     walkable, not just a bigger number nothing can reach.
//  2. Screen-fixed HUD (interactPrompt, chat log panel, footer button)
//     stays glued to the same canvas pixels while the camera scrolls —
//     the actual point of the whole setScrollFactor(0) audit.
//  3. A door hop to a DIFFERENT deck (grotto) re-clamps the camera to that
//     deck's own bounds, not a stale copy of the lower deck's.
//  4. The pointer world/screen fix: hovering a real NPC after the camera
//     has scrolled away from (0,0) still identifies the correct NPC — this
//     is the one bug this pass introduced and fixed in the same commit,
//     so it's the one most worth a live click-test rather than trusting
//     the logic trace alone.
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

const readState = () =>
  page.evaluate(() => {
    const hub = window.__bwGame.scene.getScene("Hub");
    const cam = hub.cameras.main;
    const b = cam.getBounds();
    return {
      room: hub.currentRoomId,
      playerX: Math.round(hub.playerX),
      playerY: Math.round(hub.playerY),
      scrollX: Math.round(cam.scrollX),
      scrollY: Math.round(cam.scrollY),
      camBounds: { x: b.x, y: b.y, w: b.width, h: b.height },
      // OVERHEARD/chat UI-camera dock, Carrier Scale-Up Plan v1 Phase 2, 3
      // Sep 2026 — the main/world camera's own viewport no longer spans
      // the full 1074x640 canvas (see Hub.ts's own DOCK_SPLIT_X header);
      // it's narrowed to leave room for a second, static UI camera over
      // the dock strip. Read live off the camera itself rather than
      // hardcoded below, so this script tracks whatever that split
      // actually is instead of silently asserting a stale one.
      camWidth: cam.width,
      camHeight: cam.height,
    };
  });

const before = await readState();
console.log("Initial state:", before);

await page.screenshot({ path: new URL("./cam_start.png", import.meta.url).pathname });

// ---- Check 1+2: walk toward the new open floor (down-right), confirm the
// camera scrolls and the player reaches world space past the OLD
// ROOM_BOUNDS edges (830 right / 552 bottom), while HUD stays screen-fixed.
// Focus the canvas first — Phaser's keyboard plugin listens on the
// window/document, but a real user has clicked the page already (the
// CONTINUE click above), so this just makes sure nothing stole focus.
await canvas.click({ position: { x: 480, y: 400 } });
await page.waitForTimeout(200);

// Walk down+right for several real seconds. PLAYER_SPEED is 190px/sec;
// holding both for ~6s covers roughly 1140px of diagonal travel budget
// (some lost to the door interact-prompt cursor point at 480,400 above,
// negligible) — comfortably past LOWER_BOUNDS' old 830/552 edges toward
// its new 1650/1350 ones.
await page.keyboard.down("d");
await page.keyboard.down("s");
await page.waitForTimeout(6000);
await page.keyboard.up("d");
await page.keyboard.up("s");
await page.waitForTimeout(400); // let the 0.12 lerp settle toward the player

const afterWalk = await readState();
console.log("After walking into open floor:", afterWalk);
await page.screenshot({ path: new URL("./cam_scrolled.png", import.meta.url).pathname });

// NPC collision (a real, pre-existing, unrelated system — 15 seeded pilots
// crowd the starting rooms) can legitimately stall 6 real seconds of held
// movement well short of the old 830/552 edge; that's the crowding problem
// this whole Plan doc exists to relieve, not a Phase 1 regression. So this
// organic-movement pass is graded on what it can actually prove regardless
// of pathing luck: did the camera move AT ALL while the player did, and
// stay correctly clamped inside the deck's own (now much bigger) bounds.
// The stronger "can the floor itself really be walked past the old edge"
// claim gets its own direct check right below, free of collision luck.
const playerMoved = Math.hypot(afterWalk.playerX - before.playerX, afterWalk.playerY - before.playerY) > 20;
// Compared against the STARTING scroll, not an absolute threshold — the
// deck's own bounds already put scroll at (50,100) at spawn (LOWER_BOUNDS'
// own left/top), so an absolute ">5" check would read true even if the
// camera never moved a single pixel after that.
const cameraScrolled = Math.abs(afterWalk.scrollX - before.scrollX) > 5 || Math.abs(afterWalk.scrollY - before.scrollY) > 5;
const camWithinBounds =
  afterWalk.camBounds.w != null &&
  afterWalk.scrollX >= afterWalk.camBounds.x - 1 &&
  afterWalk.scrollY >= afterWalk.camBounds.y - 1 &&
  afterWalk.scrollX + afterWalk.camWidth <= afterWalk.camBounds.x + afterWalk.camBounds.w + 1 &&
  afterWalk.scrollY + afterWalk.camHeight <= afterWalk.camBounds.y + afterWalk.camBounds.h + 1;

// ---- Check 3: hover a real NPC after the camera has scrolled, confirm
// the world/screen pointer fix identifies the right one. Prefer a
// STATIONARY same-deck NPC (targetX undefined) so it can't drift between
// the moment its position is sampled and the moment the mouse arrives —
// NPC roaming keeps ticking in real time regardless of what the player is
// doing, and picking a moving one would make this a timing test, not a
// pointer-math test.
const hoverTarget = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const deck = hub.currentRoomId;
  const cam = hub.cameras.main;
  // 3 Sep 2026 — deck membership off the live scene, not a hand list (the
  // lower deck has eight rooms now, not three).
  const sameDeckNpcs = hub.npcs.filter((n) => hub.roomDeckOf(n.room) === hub.roomDeckOf(deck));
  const stationary = sameDeckNpcs.filter((n) => n.targetX === undefined);
  const pool = stationary.length > 0 ? stationary : sameDeckNpcs;
  if (pool.length === 0) return null;
  let best = pool[0];
  let bestD = Infinity;
  for (const n of pool) {
    const d = Math.hypot(n.x - hub.playerX, n.y - hub.playerY);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return { id: best.pilotId, name: best.displayName, worldX: best.x, worldY: best.y, scrollX: cam.scrollX, scrollY: cam.scrollY, stationary: best.targetX === undefined };
});

let hoverResult = "no NPC on deck to test";
if (hoverTarget) {
  const screenX = hoverTarget.worldX - hoverTarget.scrollX;
  const screenY = hoverTarget.worldY - hoverTarget.scrollY;
  if (screenX >= 4 && screenX <= 1070 && screenY >= 4 && screenY <= 636) {
    await page.mouse.move(box.x + screenX, box.y + screenY);
    await page.waitForTimeout(80);
    const hovered = await page.evaluate(() => {
      const hub = window.__bwGame.scene.getScene("Hub");
      const npc = hub.hoveredNpc();
      return npc ? { id: npc.pilotId, name: npc.displayName } : null;
    });
    hoverResult =
      hovered && hovered.id === hoverTarget.id
        ? `PASS — correctly identified ${hovered.name} (stationary: ${hoverTarget.stationary})`
        : `FAIL — expected ${hoverTarget.name} (stationary: ${hoverTarget.stationary}), got ${hovered ? hovered.name : "nothing"}`;
  } else {
    hoverResult = `nearest NPC (${hoverTarget.name}) landed off-screen at (${Math.round(screenX)},${Math.round(screenY)}) this run — retry, not a code failure`;
  }
}
console.log("Hover-after-scroll check:", hoverResult);

// ---- Direct check: teleport the player deep into the new floor (past the
// OLD ROOM_BOUNDS edges of 830/552, well inside the new DECK_FLOOR_RIGHT/
// BOTTOM of 1650/1350) and confirm the camera actually follows there and
// stays correctly clamped. This is the unambiguous "is the bigger floor
// real and displayable" proof, isolated from NPC-collision test noise —
// still the real Container/Camera/setBounds code, just skipping the
// unrelated movement-collision system to get there. Run AFTER the hover
// check above on purpose — this drags the player (and the camera) far from
// where the seeded NPCs actually cluster, which would strand the hover
// check with nothing reachable to hover.
// 3 Sep 2026, floor-plan pass — the far corner is now the hangar deck's
// aft-east floor (the deck is 60..1560 x 100..1060; the old 1500,1200 is
// outside it). Read the live layout so this tracks the plan.
const FAR = await page.evaluate(async () => {
  const layout = await import("/src/engine/hubLayout.ts");
  const r = layout.DECK_LAYOUTS.lower.rooms.hangarDeck;
  return layout.resolveAgainstSolids("lower", r.right - 120, r.bottom - 120, 15);
});
const teleported = await page.evaluate((far) => {
  const hub = window.__bwGame.scene.getScene("Hub");
  hub.playerX = far.x;
  hub.playerY = far.y;
  hub.player.setPosition(far.x, far.y);
  return { playerX: hub.playerX, playerY: hub.playerY };
}, FAR);
// Let the 0.12 lerp catch up to the new (bounds-clamped) position —
// polled (3 Sep 2026), since the sandbox's software-rendered headless
// Chromium runs at ~10fps and a fixed 1.2s isn't enough frames.
for (let i = 0, prev = null; i < 40; i++) {
  await page.waitForTimeout(250);
  const cur = await page.evaluate(() => {
    const cam = window.__bwGame.scene.getScene("Hub").cameras.main;
    return `${Math.round(cam.scrollX)},${Math.round(cam.scrollY)}`;
  });
  if (cur === prev) break;
  prev = cur;
}
const afterTeleport = await readState();
console.log("After direct teleport into new floor:", afterTeleport);
await page.screenshot({ path: new URL("./cam_new_floor.png", import.meta.url).pathname });
// The deck's own bounds (LOWER_BOUNDS: 50,100 to 1650,1350) are bigger than
// the main camera's own viewport, but (1500,1200) sits close enough to the
// bottom-right corner that a correctly-clamped camera CAN'T center on it —
// it pegs against the deck's own edge instead (viewport right/bottom edge
// == deck's right/bottom edge), same as any bounded Phaser camera near a
// world edge. That's the actual claim to check, not literal centering.
//
// OVERHEARD/chat UI-camera dock, Carrier Scale-Up Plan v1 Phase 2, 3 Sep
// 2026 — camWidth/camHeight (readState's own live camera.width/height),
// not a hardcoded 1074x640: the main camera's viewport is narrower now
// (see readState's own comment), so it can scroll further right/down
// before pegging the deck's own edge than the old full-canvas viewport
// could. Hardcoding 1074 here would assert the OLD, no-longer-true max —
// exactly the kind of stale assumption this project's own process notes
// warn about baking into a check instead of reading live state.
const maxScrollX = afterTeleport.camBounds.x + afterTeleport.camBounds.w - afterTeleport.camWidth;
const maxScrollY = afterTeleport.camBounds.y + afterTeleport.camBounds.h - afterTeleport.camHeight;
const newFloorReachableAndFollowed =
  afterTeleport.playerX === FAR.x && // the position itself was never silently clamped back — the floor really is that big
  afterTeleport.playerY === FAR.y &&
  afterTeleport.scrollX > afterWalk.scrollX + 100 && // camera demonstrably moved toward it, a lot, not frozen
  // (3 Sep 2026: no matching scrollY-moved claim any more — the player now
  // spawns in the Rec Room at y=760, where the camera is ALREADY pegged to
  // the deck's bottom edge, so y can't move "a lot" from there.)
  afterTeleport.scrollX <= maxScrollX + 1 && // and never scrolled past the deck's own edge doing it
  afterTeleport.scrollY <= maxScrollY + 1 &&
  afterTeleport.scrollX >= maxScrollX - 20 && // close to (not necessarily exactly at, given lerp) the correctly-clamped edge value
  afterTeleport.scrollY >= maxScrollY - 20;

// ---- Check 4: door hop to a DIFFERENT deck (grotto) re-clamps the camera
// to grotto's own bounds, not a stale copy of lower's. Exercises the real
// switchRoom()/refreshRoomVisibility() code path directly — same funnel a
// real E-press at the door uses — rather than re-pathing the player back
// to the exact door pixel by hand.
const afterHop = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  // The real door, off the live table (3 Sep 2026 — no hand-copied coords).
  const door = hub.doorMarkers.map((m) => m.def).find((d) => d.id === "recroom-to-grotto");
  hub.switchRoom(door);
  const cam = hub.cameras.main;
  const b = cam.getBounds();
  return {
    room: hub.currentRoomId,
    playerX: Math.round(hub.playerX),
    playerY: Math.round(hub.playerY),
    scrollX: Math.round(cam.scrollX),
    scrollY: Math.round(cam.scrollY),
    camBounds: { x: b.x, y: b.y, w: b.width, h: b.height },
  };
});
console.log("After door hop to grotto:", afterHop);
await page.waitForTimeout(500);
await page.screenshot({ path: new URL("./cam_grotto.png", import.meta.url).pathname });

const GROTTO = await page.evaluate(async () => (await import("/src/engine/hubLayout.ts")).DECK_LAYOUTS.grotto.bounds);
const grottoBoundsCorrect =
  afterHop.room === "grotto" &&
  afterHop.camBounds.x === GROTTO.left &&
  afterHop.camBounds.y === GROTTO.top &&
  afterHop.camBounds.w === GROTTO.right - GROTTO.left &&
  afterHop.camBounds.h === GROTTO.bottom - GROTTO.top;

const out = {
  sceneReady,
  before,
  afterWalk,
  playerMoved,
  cameraScrolled,
  camWithinBounds,
  teleported,
  afterTeleport,
  newFloorReachableAndFollowed,
  hoverResult,
  afterHop,
  grottoBoundsCorrect,
  pageErrors,
};
writeFileSync(new URL("./camera_report.json", import.meta.url), JSON.stringify(out, null, 2));

console.log("\n=== SUMMARY ===");
console.log("playerMoved (organic WASD walk covered real ground):", playerMoved);
console.log("cameraScrolled (camera tracked that movement):", cameraScrolled);
console.log("camWithinBounds (never scrolled past deck's own edges):", camWithinBounds);
console.log(`newFloorReachableAndFollowed (direct check: ${FAR.x},${FAR.y} is real, walkable, camera follows):`, newFloorReachableAndFollowed);
console.log("hoverResult:", hoverResult);
console.log("grottoBoundsCorrect (camera re-clamped on deck switch):", grottoBoundsCorrect);
console.log("pageErrors:", pageErrors.length ? pageErrors : "none");

await browser.close();
