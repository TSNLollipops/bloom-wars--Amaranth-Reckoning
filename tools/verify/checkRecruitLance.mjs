// One-off Playwright verification, 5 Sep 2026 — cloud-sandbox-only, not
// shipped. "Recruit your own lance" (Maxime: "player should recruit their
// lance teamate not have a team be creste for them").
//
// The engine rules are unit-tested. What has to be proven HERE is the thing
// that would make this change worse than not making it: lances now arrive
// EMPTY, so if the recruiting UI doesn't actually work, the player is left
// with berths they can never fill. This drives the real ShopPanel recruit
// card in the real Hangar Deck and checks a pilot comes out the far end, in
// the right lance, showing up in the crew records.
import { chromium } from "playwright";
import { readFileSync } from "fs";

const PORT = 5183;
const save = readFileSync(new URL("./save.json", import.meta.url), "utf8");

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1074, height: 640 } });
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (err) => errors.push(err.message));

let failed = false;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed = true;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${label}\n         expected: ${JSON.stringify(expected)}\n         actual:   ${JSON.stringify(actual)}`);
}

// An Act-II save the NEW way: 1st Lance staffed, 2nd Lance granted but
// empty, points to hire with. This is what a player actually reaches now.
const fresh = JSON.parse(save);
for (const id of Object.keys(fresh.pilots)) {
  if (!["pilot_rourke", "pilot_bosk", "pilot_iyari", "pilot_anand", "pilot_lask"].includes(id)) delete fresh.pilots[id];
}
fresh.lancesGranted = 2;
fresh.rourkeRank = "capt";
fresh.points = 5000;

await page.addInitScript((s) => window.localStorage.setItem("bloomwars_campaign_state_v1", s), JSON.stringify(fresh));
await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });
await page.waitForTimeout(1300);
const box = await page.locator("canvas").boundingBox();
await page.mouse.click(box.x + 480, box.y + 300); // CONTINUE -> Hub
await page.waitForTimeout(1800);

// ---- 1. The starting state: a granted but empty 2nd Lance --------------
const before = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const cs = hub.campaignState;
  const LanceOf = hub.rosterPanel.constructor.lanceOf;
  const count = (id) => Object.values(cs.pilots).filter((e) => e.status === "active" && LanceOf(cs, e.pilot.id) === id).length;
  return { rank: cs.rourkeRank, first: count("a"), second: count("b") };
});
console.log("\n[1] an Act II carrier, the new way:", JSON.stringify(before));
check("1st Lance is staffed with the authored five", before.first, 5);
check("2nd Lance was granted but arrives EMPTY", before.second, 0);
check("and Rourke is still a Captain for commanding it", before.rank, "capt");

// ---- 2/3. Recruit by CLICKING the real [ sign ] buttons ---------------
// Driving the engine directly would prove nothing about whether the panel is
// wired up — that's exactly the failure this whole check exists to catch. So
// find the real text objects in the real shop layer and click them where
// they actually are on screen.
async function shopSignButtons() {
  return page.evaluate(() => {
    const hub = window.__bwGame.scene.getScene("Hub");
    const out = [];
    const walk = (list) => {
      for (const o of list) {
        if (o.type === "Text" && typeof o.text === "string" && o.text.startsWith("[ sign ]") && o.visible !== false) {
          const m = o.getWorldTransformMatrix();
          out.push({ text: o.text, x: Math.round(m.tx + o.width / 2), y: Math.round(m.ty + o.height / 2) });
        }
        if (o.list) walk(o.list);
      }
    };
    walk(hub.children.list);
    return out;
  });
}

// The recruit card is the LAST entry in the shop, and the shop paginates —
// with five pilots at 148px a row it lands several pages in. Page to it the
// way the player would, rather than asserting against page 1 and concluding
// the feature is missing.
const shopPages = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  hub.openHangarShop();
  return hub.hangarShop.shopPage;
});
void shopPages;
await page.waitForTimeout(400);
let signs = [];
for (let p = 0; p < 8; p++) {
  await page.evaluate((n) => window.__bwGame.scene.getScene("Hub").hangarShop.goToPage(n), p);
  await page.waitForTimeout(250);
  signs = await shopSignButtons();
  if (signs.length) break;
}
console.log("\n[2] candidate [ sign ] buttons on the recruit card:", signs.length);
console.log("    first:", signs[0]?.text ?? "(none)");
check("the authored candidates are offered by name", signs.length > 0, true);
check("and they are real written characters, not placeholders", /Sgt\.|Cpl\.|Pvt\.|Spec\./.test(signs[0]?.text ?? ""), true);

const recruitedNames = [];
const pointsBefore = await page.evaluate(() => window.__bwGame.scene.getScene("Hub").campaignState.points);
for (let i = 0; i < 5; i++) {
  signs = await shopSignButtons();
  if (!signs.length) break;
  recruitedNames.push(signs[0].text.replace("[ sign ] ", ""));
  await page.mouse.click(box.x + signs[0].x, box.y + signs[0].y);
  await page.waitForTimeout(350);
}
const pointsAfter = await page.evaluate(() => window.__bwGame.scene.getScene("Hub").campaignState.points);
console.log("\n[3] signed by clicking:");
for (const n of recruitedNames) console.log("   ", n);
check("five pilots signed through the real UI", recruitedNames.length, 5);
check("and each hire cost company points", pointsBefore - pointsAfter > 0, true);

// ---- 4. They show up in the crew records, in the right lance ----------
const after = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const cs = hub.campaignState;
  const LanceOf = hub.rosterPanel.constructor.lanceOf;
  hub.closeHangarShop?.();
  hub.openRosterPanel();
  hub.rosterPanel.setTab("b");
  const read = (c) => { const out = []; const walk = (l) => { for (const o of l) { if (o.type === "Text" && typeof o.text === "string" && o.visible !== false) out.push(o.text); if (o.list) walk(o.list); } }; walk(c.list); return out; };
  return {
    second: Object.values(cs.pilots).filter((e) => e.status === "active" && LanceOf(cs, e.pilot.id) === "b").length,
    texts: read(hub.rosterPanel.container),
  };
});
console.log("\n[4] crew records, 2nd Lance:");
check("2nd Lance now holds five", after.second, 5);
check("the tab shows it full", after.texts.some((t) => /2nd Lance 5\/5/.test(t)), true);
check("and they're listed with no missions flown yet", after.texts.some((t) => t.includes("no missions flown yet")), true);
await page.screenshot({ path: new URL("./promo_recruited_lance.png", import.meta.url).pathname });

console.log("\nconsole errors:", errors.length ? errors : "none");
if (errors.length) failed = true;
await browser.close();
console.log(failed ? "\nRESULT: FAILED" : "\nRESULT: PASSED");
if (failed) process.exitCode = 1;
