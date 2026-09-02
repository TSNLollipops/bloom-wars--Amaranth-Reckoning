// One-off Playwright verification pass, 2 Sep 2026 — cloud-sandbox-only,
// not shipped. Follows the exact pattern checkDebriefAndMinigameGate.mjs
// already established (window.__bwGame as the real, dev-only Phaser.Game
// hook; the real chat UI — T, type, Enter — for everything actually under
// test; direct pokes at private fields reserved for SETUP only). Boots the
// real game against a seeded 15-pilot midgame save, lands in the live Hub
// scene, and exercises the crew-interaction brainstorm pass end-to-end:
//
// 1. Named targeting (extractNamedTarget/resolveChatTarget) — praising a
//    named pilot standing next to another pilot moves only the named one.
// 2. Gift/Apology/Send-Off — each a real Favorability (and, for Send-Off,
//    Stress + preMissionSendOff) change via the real chat line.
// 3. Congratulate — the "Congrats for what?" no-op when there's no live
//    promoted HotTopic about that pilot, then the real payoff once one
//    exists.
// 4. The Insult escalation ladder — Tier 2 (a real "insulted" HotTopic +
//    Stress bump) and Tier 3 (refusesDeployment flips true) via six real
//    chat-driven insults, not a direct call into insultNpc().
// 5. The CO Tier-3 call-out — a real E-press Talk exchange with the CO
//    once a pilot is in the standoff, and coCalloutGiven flipping true.
// 6. The remove-pilot resolution — a real chat request to the CO that sets
//    PilotStatus to "reassigned" and drops the pilot out of hub.npcs.
// 7. Confide — a real chat request to the CO that moves CampaignState.mcStress.
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "fs";

const save = readFileSync("/mnt/user-data/uploads/bloom-wars/bloom-wars/tools/verify/save.json", "utf8");

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1074, height: 640 } });

const pageErrors = [];
page.on("console", (msg) => { if (msg.type() === "error") pageErrors.push(msg.text()); });
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
await page.screenshot({ path: "/mnt/user-data/uploads/bloom-wars/bloom-wars/tools/verify/social_start.png" });

async function teleportTo(x, y, roomId) {
  await page.evaluate(({ x, y, roomId }) => {
    const hub = window.__bwGame.scene.getScene("Hub");
    hub.playerX = x;
    hub.playerY = y;
    hub.currentRoomId = roomId;
  }, { x, y, roomId });
}

async function sayInChat(text) {
  const input = page.locator("input[placeholder^='Type something']");
  // Retrying "t"-presses, not a single one — occasional flakiness observed
  // where the very next "t" press right after an Enter-driven closeChat()
  // doesn't reopen the box on the first try (Hub.ts's openChat/closeChat
  // toggle real DOM node visibility, and Playwright can catch it between
  // Phaser's own DOM-update tick and the key handler). Cheap to retry a
  // few times with a real visibility wait rather than a fixed sleep.
  for (let attempt = 0; attempt < 6; attempt++) {
    await page.keyboard.press("t");
    try {
      await input.waitFor({ state: "visible", timeout: 1500 });
      await input.fill(text);
      await input.press("Enter");
      await page.waitForTimeout(200);
      return;
    } catch {
      await page.waitForTimeout(200);
    }
  }
  throw new Error(`sayInChat: chat box never became visible for: ${text}`);
}

async function lastChatLogEntry() {
  return page.evaluate(() => {
    const hub = window.__bwGame.scene.getScene("Hub");
    const log = hub.chatLog;
    return log[log.length - 1];
  });
}

async function getNpcs() {
  return page.evaluate(() => {
    const hub = window.__bwGame.scene.getScene("Hub");
    return hub.npcs.map((n) => ({
      pilotId: n.pilotId,
      displayName: n.displayName,
      room: n.room,
      x: n.x,
      y: n.y,
      catalyst: n.ambient.catalyst,
      stress: n.ambient.stress,
      favorability: n.favorability,
    }));
  });
}

async function getSocial(pilotId) {
  return page.evaluate((pilotId) => {
    const hub = window.__bwGame.scene.getScene("Hub");
    return hub.campaignState.pilots[pilotId]?.social ?? null;
  }, pilotId);
}

async function getPilotStatus(pilotId) {
  return page.evaluate((pilotId) => {
    const hub = window.__bwGame.scene.getScene("Hub");
    return hub.campaignState.pilots[pilotId]?.status ?? null;
  }, pilotId);
}

async function getMcStress() {
  return page.evaluate(() => window.__bwGame.scene.getScene("Hub").campaignState.mcStress);
}

async function getPreMissionSendOff() {
  return page.evaluate(() => window.__bwGame.scene.getScene("Hub").campaignState.preMissionSendOff);
}

// Setup-only poke, same convention checkDebriefAndMinigameGate.mjs already
// established: place ONE target npc right on the player and every OTHER
// non-CO npc far away, so resolveChatTarget's nearest-in-range fallback
// unambiguously resolves to the target for every unnamed single-target verb
// test below.
async function isolateNpcOnPlayer(pilotId, room) {
  await page.evaluate(({ pilotId, room }) => {
    const hub = window.__bwGame.scene.getScene("Hub");
    for (const n of hub.npcs) {
      if (n.pilotId === "npc_co") continue;
      if (n.pilotId === pilotId) {
        n.room = room;
        n.x = hub.playerX;
        n.y = hub.playerY;
      } else {
        n.x = -9000;
        n.y = -9000;
      }
    }
  }, { pilotId, room });
}

async function pushPromotedTopic(pilotId, aboutName) {
  await page.evaluate(({ pilotId, aboutName }) => {
    const hub = window.__bwGame.scene.getScene("Hub");
    hub.hotTopics.push({ kind: "promoted", aboutPilotId: pilotId, aboutName, at: Date.now(), mentionedBy: [] });
  }, { pilotId, aboutName });
}

async function findHotTopic(kind, aboutPilotId) {
  return page.evaluate(({ kind, aboutPilotId }) => {
    const hub = window.__bwGame.scene.getScene("Hub");
    return hub.hotTopics.find((t) => t.kind === kind && t.aboutPilotId === aboutPilotId) ?? null;
  }, { kind, aboutPilotId });
}

const results = {};
const allNpcs = await getNpcs();
const nonCo = allNpcs.filter((n) => n.pilotId !== "npc_co");
if (nonCo.length < 4) throw new Error(`need at least 4 non-CO npcs for isolated tests, got ${nonCo.length}`);
const [npcNamed, npcBystander, npcGift, npcInsult] = nonCo;
const npcApology = nonCo[4] ?? nonCo[0];
const npcCongrats = nonCo[5] ?? nonCo[1];
const npcSendOff = nonCo[6] ?? nonCo[2];

await teleportTo(400, 300, "recroom");

// --- 1. Named targeting: praise npcNamed while npcBystander stands right next to them ---
await page.evaluate(
  ({ a, b }) => {
    const hub = window.__bwGame.scene.getScene("Hub");
    for (const n of hub.npcs) {
      if (n.pilotId === a) { n.room = "recroom"; n.x = hub.playerX; n.y = hub.playerY; }
      else if (n.pilotId === b) { n.room = "recroom"; n.x = hub.playerX + 5; n.y = hub.playerY; }
      else if (n.pilotId !== "npc_co") { n.x = -9000; n.y = -9000; }
    }
  },
  { a: npcNamed.pilotId, b: npcBystander.pilotId }
);
// Pick a real given/surname token, not a rank prefix ("Spec.", "2nd",
// "M.Sgt." all contain a digit or period and are excluded) — mirrors
// extractNamedTarget's own word filter exactly, so this test drives a name
// the real function is actually meant to resolve.
const nameWords = npcNamed.displayName
  .split("—")[0]
  .trim()
  .split(/\s+/)
  .filter((w) => /^[A-Za-z']+$/.test(w));
const namedFirstToken = nameWords.sort((a, b) => b.length - a.length)[0];
const beforeNamedA = (await getNpcs()).find((n) => n.pilotId === npcNamed.pilotId).favorability;
const beforeNamedB = (await getNpcs()).find((n) => n.pilotId === npcBystander.pilotId).favorability;
await sayInChat(`well done, ${namedFirstToken}`);
results.namedTargetLog = await lastChatLogEntry();
const afterNamed = await getNpcs();
results.namedTargetDeltaA = afterNamed.find((n) => n.pilotId === npcNamed.pilotId).favorability - beforeNamedA;
results.namedTargetDeltaB = afterNamed.find((n) => n.pilotId === npcBystander.pilotId).favorability - beforeNamedB;

// --- 2. Gift ---
await isolateNpcOnPlayer(npcGift.pilotId, "recroom");
const beforeGift = (await getNpcs()).find((n) => n.pilotId === npcGift.pilotId).favorability;
await sayInChat("I brought you something");
results.giftLog = await lastChatLogEntry();
results.giftDelta = (await getNpcs()).find((n) => n.pilotId === npcGift.pilotId).favorability - beforeGift;

// --- 3. Apology ---
await isolateNpcOnPlayer(npcApology.pilotId, "recroom");
const beforeApology = (await getNpcs()).find((n) => n.pilotId === npcApology.pilotId).favorability;
await sayInChat("sorry about that");
results.apologyLog = await lastChatLogEntry();
results.apologyDelta = (await getNpcs()).find((n) => n.pilotId === npcApology.pilotId).favorability - beforeApology;

// --- 4. Congratulate — no live topic, then a real one ---
await isolateNpcOnPlayer(npcCongrats.pilotId, "recroom");
await sayInChat("congrats");
results.congratulateNoTopicLog = await lastChatLogEntry();
const congratsName = npcCongrats.displayName.split("—")[0].trim();
await pushPromotedTopic(npcCongrats.pilotId, congratsName);
const beforeCongrats = (await getNpcs()).find((n) => n.pilotId === npcCongrats.pilotId);
await sayInChat("congrats");
results.congratulateRealLog = await lastChatLogEntry();
const afterCongrats = (await getNpcs()).find((n) => n.pilotId === npcCongrats.pilotId);
results.congratulateFavDelta = afterCongrats.favorability - beforeCongrats.favorability;
results.congratulateMoraleDelta = afterCongrats.stress; // logged for reference; morale isn't in getNpcs() below, see note

// --- 5. Send-Off ---
await isolateNpcOnPlayer(npcSendOff.pilotId, "recroom");
const beforeSendOff = (await getNpcs()).find((n) => n.pilotId === npcSendOff.pilotId);
await sayInChat("wish me luck");
results.sendOffLog = await lastChatLogEntry();
const afterSendOff = (await getNpcs()).find((n) => n.pilotId === npcSendOff.pilotId);
results.sendOffFavDelta = afterSendOff.favorability - beforeSendOff.favorability;
results.sendOffStressDelta = afterSendOff.stress - beforeSendOff.stress;
results.preMissionSendOff = await getPreMissionSendOff();

// --- 6. Insult escalation ladder — six real chat-driven insults ---
// Re-isolate (re-pin the target's position on the player) before EVERY
// send, not just once up front — live NPC roaming (updateNpcRoaming) can
// walk the target back out of APPROACH_RADIUS during the real wall-clock
// time six sequential chat round-trips take, which would silently turn a
// later insult into a "nobody's close enough" fallback instead of a real
// hit. Caught by this script's own first run (insultsGiven stalled at 5,
// never reaching the real Tier-3 threshold) before this shipped.
async function sayInsult() {
  await isolateNpcOnPlayer(npcInsult.pilotId, "recroom");
  await sayInChat("you're so stupid");
}
for (let i = 0; i < 2; i++) await sayInsult();
results.insultSocialAfter2 = await getSocial(npcInsult.pilotId);
await sayInsult(); // 3rd — Tier 2
results.insultSocialAfterTier2 = await getSocial(npcInsult.pilotId);
results.insultedHotTopicAfterTier2 = await findHotTopic("insulted", npcInsult.pilotId);
for (let i = 0; i < 3; i++) await sayInsult(); // 4th, 5th, 6th — Tier 3
results.insultSocialAfterTier3 = await getSocial(npcInsult.pilotId);
results.insultLastLog = await lastChatLogEntry();

// --- 7. CO Tier-3 call-out — real E-press Talk, standing on the CO ---
const co = (await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const c = hub.npcs.find((n) => n.pilotId === "npc_co");
  return { x: c.x, y: c.y, room: c.room };
}));
await teleportTo(co.x, co.y, co.room);
await page.keyboard.press("e");
await page.waitForTimeout(200);
results.coCalloutLog = await lastChatLogEntry();
results.insultSocialAfterCallout = await getSocial(npcInsult.pilotId);

// --- 8. Remove-pilot resolution — real chat request to the CO ---
const npcCountBeforeRemoval = (await getNpcs()).length;
await sayInChat("I want to remove them from the ship");
results.removePilotLog = await lastChatLogEntry();
results.removedPilotStatus = await getPilotStatus(npcInsult.pilotId);
const npcCountAfterRemoval = (await getNpcs()).length;
results.npcRemovedFromHub = npcCountAfterRemoval === npcCountBeforeRemoval - 1;

// --- 9. Confide — real chat request to the CO, still standing on him ---
const mcStressBefore = await getMcStress();
await sayInChat("can we talk");
results.confideLog = await lastChatLogEntry();
const mcStressAfter = await getMcStress();
results.mcStressBefore = mcStressBefore;
results.mcStressAfter = mcStressAfter;
results.mcStressDelta = (mcStressAfter ?? 0) - (mcStressBefore ?? 40);

await page.screenshot({ path: "/mnt/user-data/uploads/bloom-wars/bloom-wars/tools/verify/social_end.png" });

console.log("\n=== Social actions verification results ===");
console.log(JSON.stringify(results, null, 2));
console.log("\n=== Page errors/console errors during the whole run ===");
console.log(pageErrors.length ? pageErrors : "none");

writeFileSync(
  "/mnt/user-data/uploads/bloom-wars/bloom-wars/tools/verify/social_report.json",
  JSON.stringify({ sceneReady, results, pageErrors }, null, 2)
);

await browser.close();
