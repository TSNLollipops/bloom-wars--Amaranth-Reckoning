// B4 (portrait wiring), 5 Sep 2026 — live check for the three panels that
// got real layout work this pass (RosterPanel, MemorialPanel, Debrief's
// earnings rework), cloud-sandbox-only, not shipped. Confirms portrait
// <Image> objects are actually in each panel's display list and grabs a
// screenshot of each for a visual pass.
import { chromium } from "playwright";
import { readFileSync } from "fs";
import { fileURLToPath } from "node:url";

// fileURLToPath (not a bare `new URL(...)` or `.pathname`) — this repo's own
// container path has spaces ("The Bloom wars. Code project"), and
// page.screenshot's `path` option wants a plain decoded string.
const here = (rel) => fileURLToPath(new URL(rel, import.meta.url));

const PORT = 5183;
const save = readFileSync(here("./save.json"), "utf8");
const CAMPAIGN_ID = JSON.parse(save).campaignId;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1074, height: 640 } });
const pageErrors = [];
page.on("pageerror", (err) => pageErrors.push(err.message));

// Seed real service records (incl. one permanent loss for the Memorial) so
// both panels have real rows to draw, not just "no missions flown yet".
const statsRecords = [
  { pilotId: "pilot_rourke", n: 0, downed: false, lost: false },
  { pilotId: "pilot_bosk", n: 1, downed: false, lost: false },
  { pilotId: "pilot_iyari", n: 2, downed: false, lost: true },
].map((p) => ({
  campaignId: CAMPAIGN_ID,
  missionId: `mission_seed_${p.n}`,
  missionName: `Seed Mission ${p.n}`,
  outcome: "win",
  turns: 9 + p.n,
  finishedAt: `2026-09-0${p.n + 1}T10:00:00.000Z`,
  squad: [
    {
      pilotId: p.pilotId,
      displayName: p.pilotId,
      kills: 3 + p.n,
      assists: 1,
      damageDealt: 50,
      damageTaken: 20,
      downed: p.downed,
      permanentlyLost: p.lost,
      abilitiesUsed: { abil_overwatch: 4 },
    },
  ],
}));

await page.addInitScript((s) => window.localStorage.setItem("bloomwars_campaign_state_v1", s), save);
await page.addInitScript((r) => window.localStorage.setItem("bloomwars_stats_v1", JSON.stringify({ installId: "verify", records: r })), statsRecords);
await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });
await page.waitForTimeout(2000);
const box = await page.locator("canvas").boundingBox();
await page.mouse.click(box.x + 480, box.y + 300); // CONTINUE -> Hub
await page.waitForTimeout(1800);

// ---- RosterPanel ----------------------------------------------------------
const rosterPortraits = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  hub.openRosterPanel();
  function walk(obj, acc) {
    if (obj.type === "Image" && obj.texture && obj.texture.key && obj.texture.key.startsWith("portrait_")) acc.push(obj.texture.key);
    if (obj.list) for (const c of obj.list) walk(c, acc);
    return acc;
  }
  const acc = [];
  // @ts-expect-error - private, verification only
  walk(hub.rosterPanel.container, acc);
  return acc;
});
console.log("RosterPanel portrait Images:", rosterPortraits);
await page.screenshot({ path: here("./portraits_roster_panel.png") });

await page.evaluate(() => {
  // @ts-expect-error - private, verification only
  window.__bwGame.scene.getScene("Hub").rosterPanel.close();
});

// ---- MemorialPanel ---------------------------------------------------------
const memorialPortraits = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  hub.openMemorial();
  function walk(obj, acc) {
    if (obj.type === "Image" && obj.texture && obj.texture.key && obj.texture.key.startsWith("portrait_")) acc.push(obj.texture.key);
    if (obj.list) for (const c of obj.list) walk(c, acc);
    return acc;
  }
  const acc = [];
  // @ts-expect-error - private, verification only
  walk(hub.memorialPanel.container, acc);
  return acc;
});
console.log("MemorialPanel portrait Images:", memorialPortraits);
await page.screenshot({ path: here("./portraits_memorial_panel.png") });

// ---- Debrief earnings panel ------------------------------------------------
// Same setup checkCopyMissionLog.mjs already established: Debrief needs a
// real, live Mission instance (Debrief.ts's own init() signature), not a
// missionId — so drive Battle for a few real turns, force a win, then hand
// that same Mission object to Debrief the way Battle's own end-of-mission
// button does.
const DEPLOY = ["pilot_rourke", "pilot_bosk", "pilot_iyari", "pilot_anand", "pilot_lask"];
await page.evaluate(
  ({ pilotIds }) => {
    window.__bwGame.scene.stop("Hub");
    window.__bwGame.scene.start("Battle", { missionId: "mission_amaranth_1", selectedPilotIds: pilotIds });
  },
  { pilotIds: DEPLOY }
);
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const b = window.__bwGame.scene.getScene("Battle");
  for (let i = 0; i < 3; i++) b.confirmEndTurn();
  b.mission.outcome = "win";
  window.__bwMission = b.mission;
});
await page.evaluate(() => {
  window.__bwGame.scene.stop("Battle");
  window.__bwGame.scene.start("Debrief", { mission: window.__bwMission });
});
await page.waitForTimeout(1600);

const debriefCheck = await page.evaluate(() => {
  const s = window.__bwGame.scene.getScene("Debrief");
  if (!s) return { ok: false, reason: "no Debrief scene" };
  function walk(obj, acc) {
    if (obj.type === "Image" && obj.texture && obj.texture.key && obj.texture.key.startsWith("portrait_")) acc.push(obj.texture.key);
    if (obj.list) for (const c of obj.list) walk(c, acc);
    return acc;
  }
  const acc = [];
  for (const child of s.children.list) walk(child, acc);
  return { ok: true, active: s.scene.isActive(), portraits: acc };
});
console.log("Debrief scene check:", debriefCheck);
await page.screenshot({ path: here("./portraits_debrief.png") });

console.log("\nPage errors:", pageErrors.length ? pageErrors : "none");
await browser.close();
