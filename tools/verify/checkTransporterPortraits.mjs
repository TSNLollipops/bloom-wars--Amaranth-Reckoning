// Ad hoc B4 check — TransporterPad's squad row portraits. Drives straight
// to the scene via window.__bwGame (dev-only harness, same pattern as this
// folder's other scripts) rather than clicking through MapSelect, since all
// this needs is a valid missionId. Must scene.stop("Hub") first per the
// project's own harness convention (see this folder's README).
import { chromium } from "playwright";
import { readFileSync } from "fs";
import { fileURLToPath } from "node:url";

const here = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const save = readFileSync(here("./save.json"), "utf8");

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1074, height: 640 } });

const failedRequests = [];
page.on("response", (res) => {
  if (res.status() >= 400 && (res.url().includes("/portraits/") || res.url().includes("/splash/"))) {
    failedRequests.push(`${res.url()} :: HTTP ${res.status()}`);
  }
});
page.on("pageerror", (err) => console.log("[pageerror]", err.message));

await page.addInitScript((saveJson) => {
  window.localStorage.setItem("bloomwars_campaign_state_v1", saveJson);
}, save);
await page.goto("http://localhost:5183/", { waitUntil: "load" });
await page.waitForTimeout(3000); // Boot -> Preloader -> MainMenu

const canvas = page.locator("canvas");
const box = await canvas.boundingBox();
await page.mouse.click(box.x + 480, box.y + 300); // CONTINUE -> Hub
await page.waitForTimeout(1500);

await page.evaluate(() => {
  const g = window.__bwGame;
  g.scene.stop("Hub");
  g.scene.start("TransporterPad", { missionId: "mission_1a" });
});
await page.waitForTimeout(1500);

const sceneReady = await page.evaluate(() => {
  const g = window.__bwGame;
  const s = g.scene.getScene("TransporterPad");
  return s ? (s.scene.isActive() ? "active" : "inactive") : "no scene";
});
console.log("TransporterPad scene status:", sceneReady);

await page.screenshot({ path: here("./portraits_transporterpad.png") });

const imagesInDisplayList = await page.evaluate(() => {
  const s = window.__bwGame.scene.getScene("TransporterPad");
  function walk(obj, acc) {
    if (obj.type === "Image" && obj.texture && obj.texture.key && obj.texture.key.startsWith("portrait_")) {
      acc.push(obj.texture.key);
    }
    if (obj.list) for (const c of obj.list) walk(c, acc);
    return acc;
  }
  const acc = [];
  for (const child of s.children.list) walk(child, acc);
  return acc;
});
console.log("Portrait Images in TransporterPad's display list:", imagesInDisplayList);
console.log("Failed portrait/splash requests:", failedRequests.length ? failedRequests : "none");

await browser.close();
