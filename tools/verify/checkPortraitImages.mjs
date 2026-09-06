// Ad hoc B4 check — confirms real portrait <Image> objects are actually in
// the Hub scene's display list (not just texture-cache presence, which
// checkPortraits.mjs already covers), for both roaming NPCs and the
// player's own pilot_rourke avatar (buildPlayer(), a separate code path).
import { chromium } from "playwright";
import { readFileSync } from "fs";
import { fileURLToPath } from "node:url";

const here = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const save = readFileSync(here("./save.json"), "utf8");

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1074, height: 640 } });
await page.addInitScript((saveJson) => {
  window.localStorage.setItem("bloomwars_campaign_state_v1", saveJson);
}, save);
await page.goto("http://localhost:5183/", { waitUntil: "load" });
await page.waitForTimeout(3000);
const canvas = page.locator("canvas");
const box = await canvas.boundingBox();
await page.mouse.click(box.x + 480, box.y + 300);
await page.waitForTimeout(2000);

const result = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  function walk(obj, acc) {
    if (obj.type === "Image" && obj.texture && obj.texture.key && obj.texture.key.startsWith("portrait_")) {
      acc.push(obj.texture.key);
    }
    if (obj.list) for (const c of obj.list) walk(c, acc);
    return acc;
  }
  const acc = [];
  for (const child of hub.children.list) walk(child, acc);
  return acc;
});
console.log("Portrait Images actually in Hub's display list:", result);
await browser.close();
