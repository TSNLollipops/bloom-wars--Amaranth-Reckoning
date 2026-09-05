// Clean promo-quality recapture, 4 Sep 2026 — cloud-sandbox-only, not shipped.
// Same 8 shots as uiPlanScreens.mjs (Track 1's largest-maps/workshop/gate
// pass), but for handing to Maxime as actual promotional material rather
// than debug verification. Two differences from that script, both because
// "verification screenshot" and "promo screenshot" have different bars:
//
//  1. Routes through MainMenu's own CONTINUE button (same click MainMenu.ts's
//     handler makes real players use, this.scene.start(...) to Hub) instead
//     of calling scene.start("Battle") cold right after boot. That cold-start
//     path is what uiPlanScreens.mjs uses and it's fine for verification, but
//     it left MainMenu's own LOAD GAME/OPTIONS/CODEX/NEW CAMPAIGN buttons
//     visibly drawn UNDER the Battle scene in every one of that script's
//     screenshots — an artifact of skipping MainMenu's real scene-transition
//     code, not a bug real players can reach (they always arrive at Battle
//     via TransporterPad, several real scene.start() hops downstream of
//     MainMenu already being long gone). Going through CONTINUE first closes
//     MainMenu the same way a real player's session does, so it's gone.
//
//  2. Still runs against the DEV server, not a production build — tried
//     production first, but window.__bwGame (what every script in this
//     directory drives scene.start() through) is itself behind the same
//     `if (import.meta.env.DEV)` gate as the corner build-stamp (main.ts).
//     No dev flag, no scripted navigation at all. So the corner stamp
//     ("v0.6.1 Build ...") still renders here — it's cropped out of the
//     final PNGs in the same pass that saves them (see the project chat:
//     it's a dev-only debug seam, never in the shipped build, cropping it
//     here is a promo-asset concern, not a game fix).
import { chromium } from "playwright";
import { readFileSync } from "fs";

const save = readFileSync(new URL("./save.json", import.meta.url), "utf8");
const DEPLOY = ["pilot_rourke", "pilot_bosk", "pilot_iyari", "pilot_anand", "pilot_lask"];
const PORT = 5183; // vite dev server — see the header comment for why not preview/production

const BIG_MAPS = [
  { missionId: "mission_amaranth_27", name: "Falling Back to Meridian" },
  { missionId: "mission_amaranth_25", name: "The Reckoning" },
  { missionId: "mission_amaranth_11", name: "The Long Walk Back" },
  { missionId: "mission_amaranth_18", name: "Draven's Cut" },
  { missionId: "mission_amaranth_31", name: "The Last Convoy" },
  { missionId: "mission_amaranth_35", name: "The Last Ring" },
];

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });

async function newPage() {
  const page = await browser.newPage({ viewport: { width: 1074, height: 640 } });
  const errors = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", (err) => errors.push(err.message));
  return { page, errors };
}

/** Boots to MainMenu, seeds the save, clicks CONTINUE for real — same code path a player's session takes. */
async function bootToHub(page) {
  await page.addInitScript((saveJson) => {
    window.localStorage.setItem("bloomwars_campaign_state_v1", saveJson);
  }, save);
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });
  await page.waitForTimeout(1200); // Boot -> Preloader -> MainMenu
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  await page.mouse.click(box.x + 480, box.y + 300); // CONTINUE — real click, real handler, real scene.start("Hub")
  await page.waitForTimeout(1500); // Hub create()
}

// ---- Part 1: the 6 biggest maps, real tile size, clean screenshot -------
{
  const { page, errors } = await newPage();
  await bootToHub(page);

  for (const m of BIG_MAPS) {
    // window.__bwGame.scene is the GAME's top-level SceneManager, not a
    // scene's own ScenePlugin — calling .start() on it queues Battle to run
    // but does NOT stop whatever's currently active (that auto-stop-the-
    // caller behavior is specific to a Scene's own `this.scene.start()`,
    // which is what every real in-game transition uses instead). Found this
    // the hard way: getScene("Battle") below came back with fully correct
    // mission data every time, but the screenshots kept showing Hub — Battle
    // really was running, just underneath/behind a Hub that was still active
    // too. Explicit stop first, same as the real game gets for free.
    await page.evaluate(({ missionId, pilotIds }) => {
      window.__bwGame.scene.stop("Hub");
      window.__bwGame.scene.start("Battle", { missionId, selectedPilotIds: pilotIds });
    }, { missionId: m.missionId, pilotIds: DEPLOY });
    await page.waitForTimeout(900);
    const info = await page.evaluate(() => {
      const b = window.__bwGame.scene.getScene("Battle");
      return b ? { tileSize: b.tileSize, mapW: b.mission.map.width, mapH: b.mission.map.height } : null;
    });
    console.log(m.missionId, "->", info);
    await page.screenshot({ path: new URL(`./promo_${m.missionId}.png`, import.meta.url).pathname });
  }
  console.log("Part 1 console errors:", errors.length ? errors : "none");
  await page.close();
}

// ---- Part 2: Lance A's workshop, 5 Meks seated -------------------------
{
  const { page, errors } = await newPage();
  await bootToHub(page);

  await page.evaluate(() => {
    const hub = window.__bwGame.scene.getScene("Hub");
    hub.currentRoomId = "workshop";
    hub.playerX = 250;
    hub.playerY = 700;
    hub.player.setPosition(250, 700);
    hub.refreshRoomVisibility();
  });
  const canvas = page.locator("canvas");
  await canvas.click({ position: { x: 537, y: 320 } });
  await page.keyboard.down("d");
  await page.waitForTimeout(300);
  await page.keyboard.up("d");
  await page.waitForTimeout(400);
  await page.screenshot({ path: new URL("./promo_workshop_lanceA.png", import.meta.url).pathname });
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
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  await page.mouse.click(box.x + 480, box.y + 300); // CONTINUE
  await page.waitForTimeout(1500);

  await page.evaluate(() => {
    window.__bwGame.scene.stop("Hub"); // same global-SceneManager gotcha as Part 1 — see its comment
    window.__bwGame.scene.start("TransporterPad", { missionId: "mission_amaranth_2" });
  });
  await page.waitForTimeout(900);
  await page.screenshot({ path: new URL("./promo_co_checkin_gate.png", import.meta.url).pathname });
  console.log("Part 3 console errors:", errors.length ? errors : "none");
  await page.close();
}

await browser.close();
console.log("\nDone — 8 clean promo screenshots written to tools/verify/promo_*.png");
