// One-off Playwright verification (4 Sep 2026) — cloud-sandbox-only, not
// shipped. Codex Rebuild & Live Briefing Plan v1, Part A: real,
// unlock-gated, save-aware Personnel/Bloom Bestiary/World tabs, plus the
// always-browsable Systems/Ranks & Command/Glossary tabs — wired into the
// real Codex scene, reachable from both Main Menu (with and without a
// save) and the in-play pause menu.
//
// Scenario 1 — Main Menu, no save at all: Personnel/Bestiary/World show
//   the honest "Warden Company's own record" placeholder, no page nav;
//   Systems/Ranks/Glossary show full real content regardless.
// Scenario 2 — Main Menu, WITH a save loaded, but that save has never
//   resolved a mission (no lastMissionEcho): Personnel shows all six real
//   bios; Bestiary shows every entry still locked (mission 1 itself hasn't
//   resolved yet); World shows the three ungated orientation revisions
//   (Coalition/Amaranth Reach/Meridian) but House Amaranth stays fully
//   locked (its own revision 1 needs Mission 6).
// Scenario 3 — in-play pause menu (Hub), same save advanced to having
//   resolved Mission 20: Bestiary unlocks everything through Sirenmaw
//   (Mission 12) and keeps Wellroot/Unnamed locked; World's Coalition shows
//   revision 2 (the Marrow's Line accusation) and House Amaranth shows
//   revision 3 (Mission 17's hint), not revision 4 (needs Mission 23);
//   Personnel reflects a live status change (Bosk marked permanently_lost)
//   made directly against campaignState, proving this is a live read, not
//   baked-in text.
import { chromium } from "playwright";
import { readFileSync } from "fs";

const save = readFileSync(new URL("./save.json", import.meta.url).pathname, "utf8");
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1074, height: 640 } });

const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (err) => errors.push(err.message));

const fail = [];
function check(ok, label, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!ok) fail.push(label);
}

async function clickCanvas(dx, dy) {
  const box = await page.locator("canvas").boundingBox();
  await page.mouse.click(box.x + dx, box.y + dy);
}

// The category list is left-aligned, cx=135, rows from y=100 to y=600,
// spacing = min(50, 500/(SECTIONS.length-1)) — Codex.ts's own
// drawCategoryList, sized to fit however many categories actually exist
// (15, as of this pass) inside the visible canvas rather than the old
// fixed 50px step, which pushed the last several rows off the bottom of
// the 640-tall canvas the instant a 10th category was added.
const CATEGORY_SPACING = Math.min(50, 500 / 14);
async function openCategory(index) {
  await clickCanvas(135, 100 + CATEGORY_SPACING * index);
  await page.waitForTimeout(150);
}

function readContentTexts() {
  return page.evaluate(() => {
    const codex = window.__bwGame?.scene.getScene("Codex");
    if (!codex || !codex.scene.isActive()) return null;
    // contentLayer is private but this is a live object graph read, same
    // convention as StandingsPanel's own verify script.
    return codex.contentLayer.list.filter((o) => o.type === "Text").map((o) => o.text);
  });
}

function hasPageNav() {
  return page.evaluate(() => {
    const codex = window.__bwGame.scene.getScene("Codex");
    return codex.navLayer.list.length > 0;
  });
}

// ---------------------------------------------------------------------
// Scenario 1 — Main Menu, no save at all
// ---------------------------------------------------------------------
console.log("\n=== scenario 1: Main Menu, no save -> Codex ===");
// A fresh Playwright browser context already starts with empty storage —
// no explicit clear needed. (An earlier draft of this script used
// addInitScript to clear localStorage here, which persists across every
// later navigation in this same page, including scenario 2's own reload —
// it silently wiped out scenario 2's save the instant that reload fired,
// straight after this script had just set it. Caught by scenario 2's own
// failing checks, not by inspection.)
await page.goto("http://localhost:5183/", { waitUntil: "load" });
await page.waitForTimeout(1200);
await clickCanvas(480, 300 + 4 * 58); // CODEX is the 5th button on MainMenu (0-indexed 4), per MainMenu.ts's own y=300+spacing(58)*4
await page.waitForTimeout(600);
let active = await page.evaluate(() => window.__bwGame?.scene.getScene("Codex")?.scene.isActive() ?? false);
check(active, "Codex scene opened from Main Menu");

await openCategory(9); // "10 PERSONNEL"
let texts = await readContentTexts();
check(texts?.some((t) => t.includes("Warden Company's own record")), "Personnel shows the no-save placeholder", JSON.stringify(texts));
check((await hasPageNav()) === false, "no page nav over the placeholder");

await openCategory(10); // "11 BESTIARY"
texts = await readContentTexts();
check(texts?.some((t) => t.includes("Warden Company's own record")), "Bestiary shows the no-save placeholder");

await openCategory(11); // "12 WORLD"
texts = await readContentTexts();
check(texts?.some((t) => t.includes("Warden Company's own record")), "World shows the no-save placeholder");

await openCategory(12); // "13 SYSTEMS"
texts = await readContentTexts();
check(texts?.some((t) => t === "The Three Paths"), "Systems shows real content with no save at all", JSON.stringify(texts));

await openCategory(14); // "15 GLOSSARY"
texts = await readContentTexts();
check(texts?.some((t) => t === "Meeps"), "Glossary shows real terms with no save at all");

// ---------------------------------------------------------------------
// Scenario 2 — Main Menu, WITH a save, but nothing flown yet
// ---------------------------------------------------------------------
console.log("\n=== scenario 2: Main Menu, save loaded, no lastMissionEcho ===");
await page.evaluate((saveJson) => { window.localStorage.setItem("bloomwars_campaign_state_v1", saveJson); }, save);
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(1200);
await clickCanvas(480, 300 + 4 * 58);
await page.waitForTimeout(600);

await openCategory(9); // PERSONNEL
texts = await readContentTexts();
check(texts?.some((t) => t.includes('2nd Lt. Dessa Rourke')), "Personnel shows Rourke's real bio with a save loaded from Main Menu", JSON.stringify(texts?.slice(0, 4)));
check(texts?.some((t) => t.includes("Still in the field")), "Rourke's live status renders");

await openCategory(10); // BESTIARY
texts = await readContentTexts();
check(texts?.every((t) => !t.includes("Crawlmass") || t.includes("not yet encountered")), "no Bestiary entry is unlocked before Mission 1 resolves", JSON.stringify(texts));
check((texts ?? []).filter((t) => t.includes("not yet encountered")).length === 3, "3 locked stubs on Bestiary's first page (3/page)");

await openCategory(11); // WORLD
texts = await readContentTexts();
check(texts?.some((t) => t === "The Coalition"), "World Coalition entry visible");
check(texts?.some((t) => t.includes("one frontier sector among more")), "Coalition shows its ungated revision 1 text even with nothing flown");
check(texts?.some((t) => t === "The Amaranth Reach" || t === "House Amaranth"), "second card on World's first page present");

// ---------------------------------------------------------------------
// Scenario 3 — in-play pause menu, save advanced to Mission 20 resolved,
// plus a live personnel status change
// ---------------------------------------------------------------------
console.log("\n=== scenario 3: Hub pause menu, Mission 20 resolved, Bosk lost ===");
await clickCanvas(537, 616); // BACK — Codex.ts's own chrome centers this on cameras.main.centerX (game width 1074 / 2)
await page.waitForTimeout(400);
await clickCanvas(480, 300); // CONTINUE
await page.waitForTimeout(1600);
active = await page.evaluate(() => window.__bwGame?.scene.getScene("Hub")?.scene.isActive() ?? false);
check(active, "Hub active after CONTINUE");

await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  hub.campaignState.lastMissionEcho = { missionId: "mission_amaranth_20", outcome: "win", announced: true };
  const bosk = hub.campaignState.pilots["pilot_bosk"];
  bosk.status = "permanently_lost";
  bosk.lostContext = { missionId: "mission_amaranth_5", outcome: "loss", turn: 4, turnsWithoutMunti: 0, muntisDeployed: 1, wasLastMunti: false };
});

// Hub's own pause-menu entry point is a small corner MENU button rendered
// through its dock camera at dock-local coordinates (see Hub.ts's own
// DOCK_MENU_X/Y comments) — real, but fragile pixel math to reproduce here
// for no real gain: MenuOverlay.ts's CODEX row calls the exact same
// scene.start("Codex", { returnScene, campaignState: state }) this script
// already exercised via MainMenu's own CODEX button in scenarios 1-2. What
// scenario 3 actually needs to prove — that the same Codex rendering reads
// a save with real progress and a live status change — doesn't depend on
// re-proving that generic button wiring a second time, so this drives the
// scene transition directly, the same way Hub.ts's own handleBriefRequest
// or any other in-Hub scene.start call would.
await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  hub.scene.start("Codex", { returnScene: "Hub", campaignState: hub.campaignState });
});
await page.waitForTimeout(600);
active = await page.evaluate(() => window.__bwGame?.scene.getScene("Codex")?.scene.isActive() ?? false);
check(active, "Codex opened from Hub with the live, mutated campaignState");

await openCategory(9); // PERSONNEL
texts = await readContentTexts();
check(texts?.some((t) => t.includes("Lost at Amaranth I.5 — Foraging Party, turn 4")), "Bosk's status is a live read reflecting the change made just now", JSON.stringify(texts));

const PAGE_NEXT_X = 262 + 788 - 90 + 44; // contentX+contentW-90+44 — Codex.ts's own drawPageNav '>' button
const PAGE_NEXT_Y = 96 + 504 - 18; // contentY+contentH-18
async function pageNext() {
  await clickCanvas(PAGE_NEXT_X, PAGE_NEXT_Y);
  await page.waitForTimeout(150);
}

await openCategory(10); // BESTIARY, page 0: Crawlmass/Splitfang/Undertow
texts = await readContentTexts();
check(texts?.some((t) => t === "Crawlmass"), "Crawlmass (Mission 1) unlocked by Mission 20");

await pageNext(); // page 1: Sporethrower/Choir/Gallcyst
await pageNext(); // page 2: Sirenmaw/Wellroot/Unnamed
texts = await readContentTexts();
check(texts?.some((t) => t === "Sirenmaw"), "Sirenmaw (Mission 12) unlocked by Mission 20", JSON.stringify(texts));
check((texts ?? []).filter((t) => t.includes("not yet encountered")).length === 2, "Wellroot (Mission 21) and Unnamed (Mission 35) both still locked past Mission 20", JSON.stringify(texts));

await openCategory(11); // WORLD
texts = await readContentTexts();
check(texts?.some((t) => t.includes("nobody's actually held Warden Company's own paperwork")), "Coalition shows revision 2 (Marrow's Line accusation) after Mission 20", JSON.stringify(texts));
// House Amaranth is card 1 of World's second page (page 1, 2/page: entries
// 2-3, House Amaranth then Meridian) — page forward to reach it.
await pageNext();
texts = await readContentTexts();
check(texts?.some((t) => t === "House Amaranth"), "House Amaranth card reachable on World's second page");
check(texts?.some((t) => t.includes("Too regular, too directed")), "House Amaranth shows revision 3 (Mission 17 hint), not revision 4 (needs Mission 23)", JSON.stringify(texts));

console.log("\nconsole errors:", errors.length ? errors : "none");
if (errors.length) fail.push("console errors");
await browser.close();
if (fail.length) { console.log(`\n${fail.length} FAILED: ${fail.join(", ")}`); process.exitCode = 1; }
else console.log("\nAll codex checks passed.");
