// Placeholder-session verification, 18 Sep 2026 — the JOIN THE DISCORD row
// added to Options.ts's BACK/CREDITS row. Boots the dev server (so
// window.__bwGame is exposed per main.ts's own import.meta.env.DEV gate),
// jumps straight to the Options scene, and screenshots the bottom row to
// confirm the three buttons don't overlap or clip on the real 640px-tall
// canvas — this project's own standing rule that a layout change gets a
// screenshot, not just a green test suite.
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:5183/";
const outDir = process.argv[3] ?? "tools/verify";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
try {
  const page = await browser.newPage({ viewport: { width: 1074, height: 640 } });
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await page.goto(url, { waitUntil: "load" });
  await page.waitForFunction(() => Boolean(window.__bwGame), { timeout: 15000 });

  // Jump straight to Options, same returnScene shape MainMenu's own OPTIONS
  // button passes.
  await page.evaluate(() => {
    window.__bwGame.scene.start("Options", { returnScene: "MainMenu" });
  });
  await page.waitForTimeout(600);

  await page.screenshot({ path: `${outDir}/discordRow_full.png` });
  // Bottom row only (y=611-635 in the 960-wide legacy layout, shifted to
  // screen space by legacyCenter.ts's camera scroll — crop generously).
  await page.screenshot({ path: `${outDir}/discordRow_crop.png`, clip: { x: 150, y: 580, width: 750, height: 60 } });

  const buttonInfo = await page.evaluate(() => {
    const scene = window.__bwGame.scene.getScene("Options");
    const cam = scene.cameras.main;
    return { camScrollX: cam.scrollX, camWidth: cam.width, camHeight: cam.height };
  });

  console.log("Screenshot saved. Camera:", JSON.stringify(buttonInfo));
  console.log("Console errors during run:", consoleErrors.length ? consoleErrors : "none");
} finally {
  await browser.close();
}
