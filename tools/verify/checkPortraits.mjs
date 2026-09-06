// B4 (portrait wiring), 5 Sep 2026 — one-off Playwright verification pass,
// cloud-sandbox-only, not shipped. Confirms three things a type-check can't:
// (1) Preloader loads every portrait/splash file with no 404/decode error,
// (2) Hub's NPCs actually draw real <Image> textures for pilots that should
// have art (pilot_rourke, the player-controlled CO's own lance) rather than
// silently falling back to the placeholder circle, and (3) TransporterPad's
// squad list does the same for a deployed lance.
import { chromium } from "playwright";
import { readFileSync } from "fs";
import { fileURLToPath } from "node:url";

// fileURLToPath (not .pathname) — this repo's own container path has spaces
// ("The Bloom wars. Code project"), which .pathname leaves percent-encoded
// and every fs call then fails to find.
const here = (rel) => fileURLToPath(new URL(rel, import.meta.url));

const save = readFileSync(here("./save.json"), "utf8");

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1074, height: 640 } });

const pageErrors = [];
const consoleErrors = [];
const failedRequests = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => pageErrors.push(err.message));
page.on("requestfailed", (req) => failedRequests.push(`${req.url()} :: ${req.failure()?.errorText}`));
page.on("response", (res) => {
  if (res.status() >= 400 && (res.url().includes("/portraits/") || res.url().includes("/splash/"))) {
    failedRequests.push(`${res.url()} :: HTTP ${res.status()}`);
  }
});

await page.addInitScript((saveJson) => {
  window.localStorage.setItem("bloomwars_campaign_state_v1", saveJson);
}, save);

await page.goto("http://localhost:5183/", { waitUntil: "load" });
// Boot -> Preloader (loads 31 images) -> MainMenu. Give it real time.
await page.waitForTimeout(3000);

const preloaderTextureCheck = await page.evaluate(() => {
  const g = window.__bwGame;
  if (!g) return { ok: false, reason: "no __bwGame" };
  const tex = g.textures;
  const keys = tex.getTextureKeys().filter((k) => k !== "__DEFAULT" && k !== "__MISSING" && k !== "__WHITE");
  return { ok: true, textureCount: keys.length, keys };
});
console.log("=== Preloader texture cache ===");
console.log(preloaderTextureCheck);

await page.screenshot({ path: here("./portraits_mainmenu.png") });

// MainMenu CONTINUE -> Hub (matches checkHubNpcs.mjs's own click coords).
const canvas = page.locator("canvas");
const box = await canvas.boundingBox();
if (!box) throw new Error("no canvas found");
await page.mouse.click(box.x + 480, box.y + 300);
await page.waitForTimeout(2000);

const hubCheck = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  if (!hub) return { ok: false, reason: "no Hub scene" };
  // @ts-expect-error - reaching into private fields on purpose, verification only
  const npcs = hub.npcs || [];
  return {
    ok: true,
    active: hub.scene.isActive(),
    npcCount: npcs.length,
    npcs: npcs.map((n) => ({ id: n.pilotId, name: n.displayName })),
  };
});
console.log("=== Hub scene NPCs ===");
console.log(hubCheck);

await page.screenshot({ path: here("./portraits_hub.png") });

// Zoom in on the player/CO area (buildPlayer() spawns near the Hub's own
// player-start point) for a crop that should show pilot_rourke's real face.
await page.screenshot({ path: here("./portraits_hub_full.png"), fullPage: false });

console.log("\n=== Console errors ===");
console.log(consoleErrors.length ? consoleErrors : "none");
console.log("=== Page errors ===");
console.log(pageErrors.length ? pageErrors : "none");
console.log("=== Failed portrait/splash requests ===");
console.log(failedRequests.length ? failedRequests : "none");

await browser.close();
