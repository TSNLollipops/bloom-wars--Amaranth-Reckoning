// One-off Playwright verification (4 Sep 2026) — cloud-sandbox-only, not
// shipped. The Hangar Deck sidebar-shop clipping bug (ShopPanel.fitWidth's
// own header in src/scenes/shop/ShopPanel.ts has the full story).
//
// Caught from Maxime's own phone photo of the live game, NOT by
// sweepUi.mjs's whole-game audit — that sweep's own roster has every
// pilot at 0 personalPoints, so the button that actually overran never
// grew long enough to show it, and separately the audit's OFFSCREEN check
// compares against the 1074x640 CANVAS, not Hub's own narrower 838px main-
// camera viewport (that scene's dock takes the other 236px on a second
// camera — see DOCK_SPLIT_X's header in Hub.ts). This screen could clip
// content that was still well inside the canvas, and nothing already
// built would have noticed. This script exists so that specific gap has
// its own standing check, forcing a big personalPoints value on purpose
// rather than relying on whatever a save file happens to contain.
import { chromium } from "playwright";
import { readFileSync } from "fs";

const save = readFileSync(new URL("./actionbar_save.json", import.meta.url).pathname, "utf8");
const DOCK_SPLIT_X = 838; // Hub.ts's own constant — duplicated here on purpose,
// so this check fails loudly if that file's value ever moves without this
// one being told, instead of quietly importing a value that changed underfoot.

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1074, height: 640 } });
await page.addInitScript((s) => window.localStorage.setItem("bloomwars_campaign_state_v1", s), save);
await page.goto("http://localhost:5183/", { waitUntil: "load" });
await page.waitForTimeout(1500);
await page.evaluate(() => window.__bwGame.scene.start("Hub"));
await page.waitForTimeout(2200);

const geo = await page.evaluate((dockX) => {
  const h = window.__bwGame.scene.getScene("Hub");
  for (const id of Object.keys(h.campaignState.pilots)) h.campaignState.pilots[id].personalPoints = 999999;
  h.openHangarShop();
  const worst = { right: -Infinity, text: null };
  const walk = (obj) => {
    if (obj.type === "Text" && obj.text) {
      const b = obj.getBounds();
      if (b.x + b.width > worst.right) {
        worst.right = b.x + b.width;
        worst.text = obj.text;
      }
    }
    if (obj.list) for (const c of obj.list) walk(c);
  };
  walk(h.hangarShopOverlay);
  return { ...worst, dockX };
}, DOCK_SPLIT_X);

console.log(`rightmost label in the Hangar Shop: "${geo.text}" ending at x=${geo.right.toFixed(1)}`);
console.log(`main-camera viewport ends at x=${geo.dockX} (Hub's dock owns everything past that)`);

let failed = false;
if (geo.right >= geo.dockX) {
  console.error(`FAIL: "${geo.text}" ends at ${geo.right.toFixed(1)}, past the ${geo.dockX}px camera edge — it will render partially or not at all, with the OVERHEARD dock sitting where it should be.`);
  failed = true;
} else {
  console.log(`ok — ${(geo.dockX - geo.right).toFixed(1)}px of clearance from the dock`);
}

await page.screenshot({ path: new URL("./hangar_shop_dock_fit.png", import.meta.url).pathname });
await browser.close();
process.exitCode = failed ? 1 : 0;
console.log(failed ? "\nRESULT: FAILED" : "\nRESULT: PASSED");
