// 5 Sep 2026 — live check for "make people able to pass tru each other with
// no collision" (Maxime). Confirms tryMove (player) and tryMoveNpc (NPC) no
// longer block on body-to-body proximity, only on walls/furniture via
// clampToDeckFloor. Keyboard-driven player movement doesn't respond to this
// session's browser automation (a standing limitation), so this drives the
// scene's own private methods directly via window.__bwGame — the same
// convention every other tools/verify/*.mjs script in this repo already uses.
import { chromium } from "playwright";
import { readFileSync } from "fs";
import { fileURLToPath } from "node:url";

const here = (rel) => fileURLToPath(new URL(rel, import.meta.url));

const PORT = 5183;
const save = readFileSync(here("./save.json"), "utf8");

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1074, height: 640 } });
const pageErrors = [];
page.on("pageerror", (err) => pageErrors.push(err.message));

await page.addInitScript((s) => window.localStorage.setItem("bloomwars_campaign_state_v1", s), save);
await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });
await page.waitForTimeout(2000);
const box = await page.locator("canvas").boundingBox();
await page.mouse.click(box.x + 480, box.y + 300); // CONTINUE -> Hub
await page.waitForTimeout(1800);

const result = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const out = {};

  // --- Player walking directly into an NPC: used to block completely ---
  const npc = hub.npcs.find((n) => n.room === hub.currentRoomId);
  if (!npc) return { ok: false, reason: "no NPC on the player's current deck to test against" };

  // Stand the NPC exactly on top of the player (worst case: dead center,
  // distance 0 — the old check blocked at ANY distance under NPC_R+PLAYER_R,
  // so this is the strictest possible test, not a lucky near-miss).
  npc.x = hub.playerX;
  npc.y = hub.playerY;
  npc.root.setPosition(npc.x, npc.y);

  const beforePX = hub.playerX;
  const beforePY = hub.playerY;
  hub.tryMove(6, 0);
  hub.tryMove(0, 6);
  out.playerMovedThroughNpc = hub.playerX !== beforePX || hub.playerY !== beforePY;
  out.playerDelta = { dx: hub.playerX - beforePX, dy: hub.playerY - beforePY };

  // --- NPC walking directly into the player: same worst case, reversed ---
  hub.playerX = npc.x;
  hub.playerY = npc.y;
  const beforeNX = npc.x;
  const beforeNY = npc.y;
  hub.tryMoveNpc(npc, 6, 0);
  hub.tryMoveNpc(npc, 0, 6);
  out.npcMovedThroughPlayer = npc.x !== beforeNX || npc.y !== beforeNY;
  out.npcDelta = { dx: npc.x - beforeNX, dy: npc.y - beforeNY };

  // --- NPC walking directly into another NPC: the actual corridor-jam case ---
  const npc2 = hub.npcs.find((n) => n !== npc && n.room === npc.room);
  if (!npc2) return { ok: false, reason: "need a second NPC on the same deck for the NPC-vs-NPC case", partial: out };
  npc2.x = npc.x;
  npc2.y = npc.y;
  npc2.root.setPosition(npc2.x, npc2.y);
  const beforeN2X = npc2.x;
  const beforeN2Y = npc2.y;
  hub.tryMoveNpc(npc2, -6, 0);
  hub.tryMoveNpc(npc2, 0, -6);
  out.npcMovedThroughNpc = npc2.x !== beforeN2X || npc2.y !== beforeN2Y;
  out.npc2Delta = { dx: npc2.x - beforeN2X, dy: npc2.y - beforeN2Y };

  // --- Walls/furniture still block: sanity check the fix isn't "nothing blocks anything" ---
  // Try to walk the player far outside the deck's floor bounds; clampToDeckFloor should hold them inside.
  const beforeWallPX = hub.playerX;
  hub.tryMove(-100000, 0);
  out.wallStillBlocks = Math.abs(hub.playerX - beforeWallPX) < 100000; // clamped, not teleported off-map

  out.ok = true;
  return out;
});

console.log("No-body-collision check:", JSON.stringify(result, null, 2));
console.log("\nPage errors:", pageErrors.length ? pageErrors : "none");
await browser.close();

if (!result.ok || !result.playerMovedThroughNpc || !result.npcMovedThroughPlayer || !result.npcMovedThroughNpc || !result.wallStillBlocks) {
  console.error("\nFAIL — see result above.");
  process.exit(1);
}
console.log("\nPASS — bodies pass through each other; walls/furniture still hold.");
