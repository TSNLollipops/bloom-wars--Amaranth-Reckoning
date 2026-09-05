// One-off Playwright verification, 4 Sep 2026 — cloud-sandbox-only, not
// shipped. Answers three open items from Bloom_Wars_UI_Improvement_Plan_v1.md
// Track 1: what the six largest maps actually look like at their real
// computed tile size, what Lance A's workshop looks like with its 5 Meks
// seated, and what the CO check-in gate's block message actually renders
// as. Same save/boot pattern as every other script in this directory (see
// the README): a seeded localStorage save, scene.start() calls matching
// the real game's own navigation, real screenshots.
import { chromium } from "playwright";
import { readFileSync } from "fs";

const save = readFileSync(new URL("./save.json", import.meta.url), "utf8");
const DEPLOY = ["pilot_rourke", "pilot_bosk", "pilot_iyari", "pilot_anand", "pilot_lask"];

// The 6 maps flagged in the UI Improvement Plan, Track 1 — the biggest
// maps in the game, computed via Battle.ts's own tileSize formula against
// all 72 live-campaign maps.
const BIG_MAPS = [
  { missionId: "mission_amaranth_27", name: "Falling Back to Meridian (36x14, 19px)" },
  { missionId: "mission_amaranth_25", name: "The Reckoning (34x16, 20px)" },
  { missionId: "mission_amaranth_11", name: "The Long Walk Back (34x13, 20px)" },
  { missionId: "mission_amaranth_18", name: "Draven's Cut (32x14, 21px)" },
  { missionId: "mission_amaranth_31", name: "The Last Convoy (32x13, 21px)" },
  { missionId: "mission_amaranth_35", name: "The Last Ring (32x17, 21px)" },
];

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });

async function newPage() {
  const page = await browser.newPage({ viewport: { width: 1074, height: 640 } });
  const errors = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", (err) => errors.push(err.message));
  return { page, errors };
}

// ---- Part 1: the 6 biggest maps, real tile size, real screenshot -------
{
  const { page, errors } = await newPage();
  await page.addInitScript((saveJson) => {
    window.localStorage.setItem("bloomwars_campaign_state_v1", saveJson);
  }, save);
  await page.goto("http://localhost:5183/", { waitUntil: "load" });
  await page.waitForTimeout(1200);

  for (const m of BIG_MAPS) {
    await page.evaluate(({ missionId, pilotIds }) => {
      window.__bwGame.scene.start("Battle", { missionId, selectedPilotIds: pilotIds });
    }, { missionId: m.missionId, pilotIds: DEPLOY });
    await page.waitForTimeout(900);
    const info = await page.evaluate(() => {
      const b = window.__bwGame.scene.getScene("Battle");
      return b ? { tileSize: b.tileSize, boardX: b.boardX, boardY: b.boardY, mapW: b.mission.map.width, mapH: b.mission.map.height, missionName: b.mission.name } : null;
    });
    console.log(m.missionId, "->", info);
    await page.screenshot({ path: new URL(`./screens_${m.missionId}.png`, import.meta.url).pathname });
  }
  console.log("Part 1 console errors:", errors.length ? errors : "none");
  await page.close();
}

// ---- Part 2: Lance A's workshop, 5 Meks seated -------------------------
{
  const { page, errors } = await newPage();
  await page.addInitScript((saveJson) => {
    window.localStorage.setItem("bloomwars_campaign_state_v1", saveJson);
  }, save);
  await page.goto("http://localhost:5183/", { waitUntil: "load" });
  await page.waitForTimeout(1200);
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  await page.mouse.click(box.x + 480, box.y + 300); // CONTINUE
  await page.waitForTimeout(1800); // Hub create()

  await page.evaluate(() => {
    const hub = window.__bwGame.scene.getScene("Hub");
    hub.currentRoomId = "workshop";
    hub.playerX = 250;
    hub.playerY = 700;
    hub.player.setPosition(250, 700);
    hub.refreshRoomVisibility();
  });
  await canvas.click({ position: { x: 537, y: 320 } });
  await page.keyboard.down("d");
  await page.waitForTimeout(300);
  await page.keyboard.up("d");
  await page.waitForTimeout(400);

  const workshopReport = await page.evaluate(() => {
    const hub = window.__bwGame.scene.getScene("Hub");
    const meks = hub.npcs.filter((n) => n.homeRoom === "workshop");
    return {
      currentRoomId: hub.currentRoomId,
      roomTitle: hub.roomTitleText?.text,
      mekCount: meks.length,
      meks: meks.map((m) => ({ name: m.displayName, x: Math.round(m.x), y: Math.round(m.y) })),
    };
  });
  console.log("Lance A workshop:", workshopReport);
  await page.screenshot({ path: new URL("./screens_workshop_lanceA.png", import.meta.url).pathname });
  console.log("Part 2 console errors:", errors.length ? errors : "none");
  await page.close();
}

// ---- Part 3: the CO check-in gate block message on the Transporter Pad -
{
  const { page, errors } = await newPage();
  const gatedSave = JSON.parse(save);
  gatedSave.lastMissionEcho = { missionId: "mission_amaranth_1", outcome: "win", announced: true };
  gatedSave.hasCheckedInWithCo = false;
  await page.addInitScript((saveJson) => {
    window.localStorage.setItem("bloomwars_campaign_state_v1", saveJson);
  }, JSON.stringify(gatedSave));
  await page.goto("http://localhost:5183/", { waitUntil: "load" });
  await page.waitForTimeout(1200);

  await page.evaluate(() => {
    window.__bwGame.scene.start("TransporterPad", { missionId: "mission_amaranth_2" });
  });
  await page.waitForTimeout(900);

  const gateReport = await page.evaluate(() => {
    const tp = window.__bwGame.scene.getScene("TransporterPad");
    return tp ? { state: tp.state ? { lastMissionEcho: tp.state.lastMissionEcho, hasCheckedInWithCo: tp.state.hasCheckedInWithCo } : null } : null;
  });
  console.log("TransporterPad gate state:", gateReport);
  await page.screenshot({ path: new URL("./screens_co_checkin_gate.png", import.meta.url).pathname });
  console.log("Part 3 console errors:", errors.length ? errors : "none");
  await page.close();
}

await browser.close();
console.log("\nDone — 8 screenshots written to tools/verify/screens_*.png");
