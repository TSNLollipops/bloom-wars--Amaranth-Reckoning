// Functional follow-up to checkDiscordOptionsRow.mjs — confirms the new
// JOIN THE DISCORD button is actually clickable at its drawn position (not
// just visually present — see ShopPanel.ts's own scrollFactor warning about
// buttons that render in one place and hit-test in another after a camera
// scroll, which is exactly the class of bug a screenshot alone can't catch)
// and that it calls window.open with the real invite URL. Also re-confirms
// BACK still works now that its width/position changed.
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:5183/";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
try {
  const page = await browser.newPage({ viewport: { width: 1074, height: 640 } });
  await page.goto(url, { waitUntil: "load" });
  await page.waitForFunction(() => Boolean(window.__bwGame), { timeout: 15000 });

  // Stub window.open so we can see what the button actually calls it with,
  // without actually opening a new tab/window in the headless browser.
  await page.evaluate(() => {
    window.__openCalls = [];
    window.open = (...args) => {
      window.__openCalls.push(args);
      return null;
    };
  });

  await page.evaluate(() => window.__bwGame.scene.start("Options", { returnScene: "MainMenu" }));
  await page.waitForTimeout(400);

  // Locate the JOIN THE DISCORD button by its known screen position: legacy
  // x=642,y=623 in the 960-wide layout. centerLegacyLayout sets
  // cam.scrollX = -57, and Phaser maps screenX = worldX - scrollX, so
  // screenX = worldX + 57 (canvas at 1:1 in this viewport, 1074x640, no
  // letterboxing since it matches the game's native resolution exactly).
  const canvasBox = await page.evaluate(() => {
    const c = document.querySelector("canvas");
    const r = c.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  });
  console.log("Canvas box:", JSON.stringify(canvasBox));
  const scale = canvasBox.width / 1074;

  const toScreen = (worldX, worldY) => ({
    x: canvasBox.left + (worldX + 57) * scale,
    y: canvasBox.top + worldY * scale,
  });

  const discordPt = toScreen(642, 623);
  await page.mouse.click(discordPt.x, discordPt.y);
  await page.waitForTimeout(200);

  const openCalls = await page.evaluate(() => window.__openCalls);
  console.log("window.open calls after clicking JOIN THE DISCORD:", JSON.stringify(openCalls));

  // Now confirm BACK (legacy x=293, resized/recentred alongside it) still
  // returns to MainMenu.
  const backPt = toScreen(293, 623);
  await page.mouse.click(backPt.x, backPt.y);
  await page.waitForTimeout(300);
  const activeScene = await page.evaluate(() => window.__bwGame.scene.getScenes(true).map((s) => s.scene.key));
  console.log("Active scenes after clicking BACK:", JSON.stringify(activeScene));
} finally {
  await browser.close();
}
