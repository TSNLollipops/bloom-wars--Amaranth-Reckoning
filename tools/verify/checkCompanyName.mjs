// One-off Playwright verification, 5 Sep 2026 — cloud-sandbox-only, not
// shipped. B6, "name your company" (First Game Dev Feature Gap Report §B6).
//
// The reason this exists rather than trusting the unit tests: the engine half
// of B6 (companyNameOf / backfillCompanyName) is unit-testable and covered,
// but the half that can actually be broken in a way no unit test would see is
// the DOM text field itself. A Phaser scene can create an <input> that is
// positioned off-screen, covered by another game object, or silently swallowed
// by keyboard capture, and every unit test in the repo would still pass. So
// this types into the real field with real key events and then checks what
// came out the far end, in the saved state AND on the Transporter Pad header.
//
// Starts from EMPTY localStorage on purpose — with a live save, MainMenu's
// NEW CAMPAIGN routes through showNewCampaignConfirm() instead of straight to
// CampaignSetup (MainMenu.ts), which is a different path than the one under
// test here.
import { chromium } from "playwright";

const PORT = 5183;
const TYPED_NAME = "The Gravediggers";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1074, height: 640 } });

const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (err) => errors.push(err.message));

let failed = false;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failed = true;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${label}\n         expected: ${JSON.stringify(expected)}\n         actual:   ${JSON.stringify(actual)}`);
}

await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });
await page.evaluate(() => window.localStorage.clear());
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(1400); // Boot -> MainMenu

// ---- 1. Into New Campaign, and the field exists at all -----------------
const canvas = page.locator("canvas");
const box = await canvas.boundingBox();
await page.mouse.click(box.x + 480, box.y + 358); // NEW CAMPAIGN
await page.waitForTimeout(900);

const scene = await page.evaluate(() => {
  const g = window.__bwGame;
  return g.scene.getScenes(true).map((s) => s.scene.key);
});
console.log("\n[1] active scene(s) after NEW CAMPAIGN:", scene.join(", "));
check("landed on CampaignSetup", scene.includes("CampaignSetup"), true);

// The <input> is a real DOM node inside Phaser's DOM container, so it's
// reachable by an ordinary selector — if it were never created, or created
// without the dom container enabled, this is where it fails.
const inputCount = await page.locator("input").count();
check("company name <input> present in the DOM", inputCount >= 1, true);
const input = page.locator("input").first();
check("pre-filled with the Warden default", await input.inputValue(), "Warden Company");

// ---- 2. Side switch retargets an untouched field ------------------------
await page.mouse.click(box.x + 630, box.y + 140); // HOUSE AMARANTH
await page.waitForTimeout(250);
check("untouched field follows the side", await input.inputValue(), "House Amaranth");
await page.mouse.click(box.x + 330, box.y + 140); // back to WARDEN
await page.waitForTimeout(250);
check("and follows it back", await input.inputValue(), "Warden Company");

// ---- 3. Actually type in it, with real key events ----------------------
// fill() would set .value directly and prove nothing about whether a human
// can type here. click-then-press is what catches keyboard capture eating
// the keystrokes, and the space bar in particular (Phaser games commonly
// capture SPACE for their own input and would swallow it mid-word).
await input.click();
await page.keyboard.press("Control+A");
await page.keyboard.type(TYPED_NAME, { delay: 20 });
await page.waitForTimeout(200);
console.log("\n[3] after typing:");
check("field holds exactly what was typed (spaces included)", await input.inputValue(), TYPED_NAME);

// Once edited, a side change must NOT clobber the player's own text.
await page.mouse.click(box.x + 630, box.y + 140); // HOUSE AMARANTH
await page.waitForTimeout(250);
check("edited name survives a side switch", await input.inputValue(), TYPED_NAME);
await page.mouse.click(box.x + 330, box.y + 140); // back to WARDEN for the rest of the run
await page.waitForTimeout(250);

// ---- 4. maxLength is enforced -----------------------------------------
const maxLen = await input.evaluate((el) => el.maxLength);
check("maxLength is the engine's COMPANY_NAME_MAX_LENGTH", maxLen, 24);

// Layout proof: adding this field pushed the Ironman block from y=260 to
// y=320, and a shifted neighbor is exactly the kind of thing that reads fine
// in a diff and collides on screen. Measured, then also screenshotted.
const layout = await page.evaluate(() => {
  const cs = window.__bwGame.scene.getScene("CampaignSetup");
  const texts = cs.children.list.filter((o) => o.type === "Text" && typeof o.text === "string");
  const find = (startsWith) => {
    const t = texts.find((o) => o.text.startsWith(startsWith));
    return t ? { y: Math.round(t.y), h: Math.round(t.height) } : null;
  };
  return {
    sideHint: find("House Amaranth has no Hub"),
    companyLabel: find("COMPANY NAME"),
    companyHelp: find("Whatever you call them"),
    ironman: find("IRONMAN"),
    ironmanHelp: find("One save, no going back"),
    // The side buttons are Rectangles, not Text — grabbed separately so the
    // hint-overlaps-the-buttons regression can actually be asserted against
    // their real bottom edge rather than a remembered constant.
    sideButtonBottom: (() => {
      const rects = cs.children.list.filter((o) => o.type === "Rectangle" && o.width === 280);
      return rects.length ? Math.round(Math.max(...rects.map((r) => r.y + r.height / 2))) : null;
    })(),
  };
});
console.log("\n[4] CampaignSetup vertical layout:", JSON.stringify(layout));
const bottomOf = (b) => (b ? b.y + b.h / 2 : 0);
const topOf = (b) => (b ? b.y - b.h / 2 : 0);
check("company help text clears the Ironman checkbox", bottomOf(layout.companyHelp) < layout.ironman.y - 13, true);
check("side hint clears the COMPANY NAME label", bottomOf(layout.sideHint) < layout.companyLabel.y - 6, true);
// Pre-existing overlap fixed in this same pass — the hint used to start at
// y=155 while the side buttons ended at y=160.
check("side hint clears the side buttons above it", topOf(layout.sideHint) > layout.sideButtonBottom, true);
await page.screenshot({ path: new URL("./promo_campaign_setup.png", import.meta.url).pathname });

// ---- 5. BEGIN CAMPAIGN — does the name reach the save and the header? --
await input.click();
await page.keyboard.press("Control+A");
await page.keyboard.type(TYPED_NAME, { delay: 10 });
await page.waitForTimeout(150);
await page.mouse.click(box.x + 480, box.y + 540); // BEGIN CAMPAIGN
await page.waitForTimeout(1400);

const after = await page.evaluate(() => {
  const raw = window.localStorage.getItem("bloomwars_campaign_state_v1");
  const parsed = raw ? JSON.parse(raw) : null;
  const g = window.__bwGame;
  const active = g.scene.getScenes(true).map((s) => s.scene.key);
  // Pull the header straight off the live scene's own text objects rather
  // than trusting a screenshot to be readable.
  const tp = g.scene.getScene("TransporterPad");
  let header = null;
  if (tp) {
    const texts = tp.children.list.filter((o) => o.type === "Text" && typeof o.text === "string");
    header = texts.map((t) => t.text).find((t) => t.startsWith("TRANSPORTER PAD")) ?? null;
  }
  return { savedName: parsed?.companyName ?? null, ironman: parsed?.ironman ?? null, active, header };
});

console.log("\n[5] after BEGIN CAMPAIGN:");
console.log("    active scene(s):", after.active.join(", "));
check("name persisted into the save", after.savedName, TYPED_NAME);
check("ironman still set alongside it", after.ironman, true);
check("Transporter Pad header uses the typed name", after.header, `TRANSPORTER PAD — ${TYPED_NAME.toUpperCase()}`);

await page.screenshot({ path: new URL("./promo_company_name_pad.png", import.meta.url).pathname });

// ---- 6. A pre-B6 save (no companyName at all) backfills, not blanks ----
await page.evaluate(() => {
  const raw = window.localStorage.getItem("bloomwars_campaign_state_v1");
  const parsed = JSON.parse(raw);
  delete parsed.companyName; // exactly what every save written before 5 Sep 2026 looks like
  window.localStorage.setItem("bloomwars_campaign_state_v1", JSON.stringify(parsed));
});
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(1400);
const backfilled = await page.evaluate(() => {
  const g = window.__bwGame;
  g.scene.stop("MainMenu");
  g.scene.start("TransporterPad", { missionId: "mission_amaranth_1" });
  return true;
});
void backfilled;
await page.waitForTimeout(1000);
const legacyHeader = await page.evaluate(() => {
  const tp = window.__bwGame.scene.getScene("TransporterPad");
  const texts = tp.children.list.filter((o) => o.type === "Text" && typeof o.text === "string");
  return texts.map((t) => t.text).find((t) => t.startsWith("TRANSPORTER PAD")) ?? null;
});
console.log("\n[6] legacy save with no companyName field:");
check("backfills to the Warden default, not blank/undefined", legacyHeader, "TRANSPORTER PAD — WARDEN COMPANY");

console.log("\nconsole errors:", errors.length ? errors : "none");
if (errors.length) failed = true;
await browser.close();
console.log(failed ? "\nRESULT: FAILED" : "\nRESULT: PASSED");
if (failed) process.exitCode = 1;
