// Live-browser verification, 2 Sep 2026 — checks the muster-acknowledgment
// fix (Bloom_Wars_Bug_MusterCrossDeckNoMove_02Sep2026.md) against the REAL
// running game, not just logic-tracing/unit tests. Same boot pattern as
// checkHubNpcs.mjs: seeded midgame save, real Hub scene, window.__bwGame
// dev hook. Teleports the player next to a real Mek NPC via direct state
// poke (same "reach into private state, verification only" convention
// checkHubNpcs.mjs already uses for hub.npcs/stuckMs) rather than walking
// there with real key presses — the thing under test is broadcastMessage's
// guard logic, not pathfinding-to-the-workshop, and this keeps the script
// simple and deterministic. Calls the real, committed hub.callMuster()
// (same function the M key calls) so the exact shipped code path runs.
//
// Updated same day for the addendum's own flagged follow-up (Maxime: "yes"
// — give Meks/CO a real decline line instead of dead silence). Two things
// checked against the live scene:
// 1. A Mek NPC (no campaignState.pilots entry) gets a real bubble with a
//    decline line, but NEVER gets `mustered: true` or a movement target
//    from a muster call it's in earshot of — reacts, never deploys.
// 2. A real pilot NPC still gets the ordinary muster bubble AND a movement
//    target from the same call — the regression check, so neither pass
//    broke the feature it was patching.
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "fs";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/\/$/, ""); // repo root — was a hardcoded sandbox path (fixed 3 Sep 2026)
const save = readFileSync(`${ROOT}/tools/verify/save.json`, "utf8");

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1074, height: 640 } });

page.on("console", (msg) => {
  if (msg.type() === "error") console.log("[page error]", msg.text());
});
page.on("pageerror", (err) => console.log("[pageerror]", err.message));

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
if (sceneReady !== "active") {
  await page.screenshot({ path: `${ROOT}/tools/verify/muster_ack_fail.png` });
  throw new Error("Hub scene not active, aborting — see muster_ack_fail.png");
}

// Pick one Mek and one real pilot NPC straight from the live scene's own
// roster (not hand-picked IDs) so this works against whatever save is fed
// in, and set up the direct-earshot condition by teleporting the player.
const setup = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const mek = hub.npcs.find((n) => !hub.campaignState.pilots[n.pilotId] && n.pilotId !== "npc_co");
  const pilot = hub.npcs.find((n) => !!hub.campaignState.pilots[n.pilotId]);
  if (!mek) return { error: "no Mek-like NPC (no pilots[] entry) found in hub.npcs" };
  if (!pilot) return { error: "no real pilot NPC found in hub.npcs" };
  return {
    mek: { pilotId: mek.pilotId, name: mek.displayName, room: mek.room, x: mek.x, y: mek.y },
    pilot: { pilotId: pilot.pilotId, name: pilot.displayName, room: pilot.room, x: pilot.x, y: pilot.y },
  };
});
console.log("Setup:", setup);
if (setup.error) {
  await page.screenshot({ path: `${ROOT}/tools/verify/muster_ack_fail.png` });
  throw new Error(setup.error + " — see muster_ack_fail.png");
}

// --- Case 1: Mek, direct earshot ---
const mekBefore = await page.evaluate((pilotId) => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const npc = hub.npcs.find((n) => n.pilotId === pilotId);
  hub.currentRoomId = npc.room;
  // Beside the NPC, not ON it (3 Sep 2026): a player standing exactly on
  // an NPC's coordinates pins it in place — tryMoveNpc refuses any step
  // that lands within NPC_R+PLAYER_R of the player — which reads as "the
  // muster call didn't move them" and isn't. 60px is inside TALK_RADIUS.
  hub.playerX = npc.x + 60;
  hub.playerY = npc.y;
  hub.player.setPosition(hub.playerX, hub.playerY);
  return {
    x: npc.x,
    y: npc.y,
    mustered: npc.mustered ?? false,
    bubbleChildren: npc.bubbleContainer.length,
    targetX: npc.targetX ?? null,
    targetY: npc.targetY ?? null,
  };
}, setup.mek.pilotId);

await page.evaluate(() => {
  window.__bwGame.scene.getScene("Hub").callMuster();
});

const mekImmediatelyAfter = await page.evaluate((pilotId) => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const npc = hub.npcs.find((n) => n.pilotId === pilotId);
  return {
    mustered: npc.mustered ?? false,
    bubbleChildren: npc.bubbleContainer.length,
    bubbleText: npc.bubbleContainer.list[1]?.text ?? null,
    targetX: npc.targetX ?? null,
    targetY: npc.targetY ?? null,
  };
}, setup.mek.pilotId);

await page.waitForTimeout(4000); // real wall-clock — would this Mek have visibly moved?

const mekAfterWait = await page.evaluate((pilotId) => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const npc = hub.npcs.find((n) => n.pilotId === pilotId);
  return { x: npc.x, y: npc.y, mustered: npc.mustered ?? false };
}, setup.mek.pilotId);

await page.evaluate(() => window.__bwGame.scene.getScene("Hub").endMuster());

// --- Case 2: real pilot, direct earshot (regression check) ---
const pilotBefore = await page.evaluate((pilotId) => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const npc = hub.npcs.find((n) => n.pilotId === pilotId);
  hub.currentRoomId = npc.room;
  // Beside the NPC, not ON it (3 Sep 2026): a player standing exactly on
  // an NPC's coordinates pins it in place — tryMoveNpc refuses any step
  // that lands within NPC_R+PLAYER_R of the player — which reads as "the
  // muster call didn't move them" and isn't. 60px is inside TALK_RADIUS.
  hub.playerX = npc.x + 60;
  hub.playerY = npc.y;
  hub.player.setPosition(hub.playerX, hub.playerY);
  return { x: npc.x, y: npc.y, mustered: npc.mustered ?? false, bubbleChildren: npc.bubbleContainer.length };
}, setup.pilot.pilotId);

await page.evaluate(() => {
  window.__bwGame.scene.getScene("Hub").callMuster();
});

const pilotImmediatelyAfter = await page.evaluate((pilotId) => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const npc = hub.npcs.find((n) => n.pilotId === pilotId);
  return {
    mustered: npc.mustered ?? false,
    bubbleChildren: npc.bubbleContainer.length,
    hasTarget: npc.targetX !== undefined && npc.targetX !== null,
  };
}, setup.pilot.pilotId);

await page.waitForTimeout(4000);

const pilotAfterWait = await page.evaluate((pilotId) => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const npc = hub.npcs.find((n) => n.pilotId === pilotId);
  return { x: npc.x, y: npc.y, mustered: npc.mustered ?? false };
}, setup.pilot.pilotId);

await page.evaluate(() => window.__bwGame.scene.getScene("Hub").endMuster());

await page.screenshot({ path: `${ROOT}/tools/verify/muster_ack_end.png` });

const mekDist = Math.hypot(mekAfterWait.x - mekBefore.x, mekAfterWait.y - mekBefore.y);
const pilotDist = Math.hypot(pilotAfterWait.x - pilotBefore.x, pilotAfterWait.y - pilotBefore.y);
// Decisive check for the Mek: did the muster call itself write a new
// movement target at all? Ambient idle-roam can still nudge a Mek's x/y
// over the 4s wait independent of muster (it's a living Hub, NPCs don't
// stand frozen when not mustered) — that's expected and not a failure.
// What must NOT happen is sendToMuster ever assigning a route, which
// would show up as targetX/targetY changing the instant callMuster() ran.
const mekTargetChangedByMuster = mekImmediatelyAfter.targetX !== mekBefore.targetX || mekImmediatelyAfter.targetY !== mekBefore.targetY;

const result = {
  mek: { id: setup.mek.pilotId, name: setup.mek.name, before: mekBefore, immediatelyAfter: mekImmediatelyAfter, afterWaitMs: 4000, afterWait: mekAfterWait, ambientDriftPx: Math.round(mekDist) },
  pilot: { id: setup.pilot.pilotId, name: setup.pilot.name, before: pilotBefore, immediatelyAfter: pilotImmediatelyAfter, afterWaitMs: 4000, afterWait: pilotAfterWait, movedPx: Math.round(pilotDist) },
};

writeFileSync(`${ROOT}/tools/verify/muster_ack_report.json`, JSON.stringify(result, null, 2));

// Updated 2 Sep 2026, same session — Maxime confirmed the follow-up: Meks/
// CO should get a real in-voice decline line instead of dead silence. So
// the Mek check now REQUIRES a bubble (with real text) instead of banning
// one, while still requiring mustered to stay false and the movement
// target to stay untouched — a decline reacts, but never deploys.
const mekPass =
  mekImmediatelyAfter.bubbleChildren > 0 &&
  typeof mekImmediatelyAfter.bubbleText === "string" &&
  mekImmediatelyAfter.bubbleText.length > 0 &&
  mekImmediatelyAfter.mustered === false &&
  !mekTargetChangedByMuster;
const pilotPass = pilotImmediatelyAfter.bubbleChildren > 0 && pilotImmediatelyAfter.mustered === true && pilotDist > 5;

console.log("\n=== Mek (should get a real decline line: bubble WITH text, no mustered flag, muster must not touch its movement target — ambient idle drift is fine and expected) ===");
console.log(JSON.stringify(result.mek, null, 2));
console.log("MEK CHECK:", mekPass ? "PASS" : "FAIL");

console.log("\n=== Real pilot (should get bubble + mustered + real movement, unaffected by fix) ===");
console.log(JSON.stringify(result.pilot, null, 2));
console.log("PILOT CHECK:", pilotPass ? "PASS" : "FAIL");

console.log("\nOVERALL:", mekPass && pilotPass ? "PASS" : "FAIL");

await browser.close();
process.exit(mekPass && pilotPass ? 0 : 1);
