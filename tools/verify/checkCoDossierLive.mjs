// Live Playwright check, 9 Sep 2026: the CO's own dossier (Codex Rework
// Plan §9a) — reachable on the Personnel shelf, opens on a Command group,
// shows Registered partner + Command record when applicable, never
// Stress/Morale/Standing. Checked for both Warden (Arangement) and House
// Amaranth (Verinis).
import { chromium } from "playwright";
import { readFileSync } from "fs";

const wardenSave = JSON.parse(readFileSync(new URL("./mekArchiveSave.json", import.meta.url).pathname, "utf8"));

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1074, height: 640 } });
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (err) => errors.push(err.message));
const fail = [];
const check = (ok, label, detail = "") => { console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`); if (!ok) fail.push(label); };

await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__bwGame?.scene.getScene("MainMenu")?.scene.isActive(), null, { timeout: 20000 });

// --- Warden: give Arangement a relationship with the player and a loss on the books.
const wSave = structuredClone(wardenSave);
wSave.npcSocialStates = wSave.npcSocialStates || {};
wSave.npcSocialStates["npc_co"] = { favorability: 62, stress: 5, morale: 5, inRelationship: true, socialLog: [] };
wSave.pilots["pilot_iyari"].status = "permanently_lost";

await page.evaluate((s) => { const g = window.__bwGame; g.scene.stop("MainMenu"); g.scene.start("Archive", { state: s, returnScene: "MainMenu" }); }, wSave);
await page.waitForFunction(() => window.__bwGame.scene.getScene("Archive")?.scene.isActive(), null, { timeout: 10000 });
await page.waitForTimeout(400);

const listTexts = () => page.evaluate(() => window.__bwGame.scene.getScene("Archive").listLayer.list.filter((o) => o.type === "Text").map((o) => o.text));
const readTexts = () => page.evaluate(() => window.__bwGame.scene.getScene("Archive").readLayer.list.filter((o) => o.type === "Text").map((o) => o.text));

let list = await listTexts();
console.log("Warden Personnel list:", JSON.stringify(list));
check(list[0] === "COMMAND", "a COMMAND group heads the Personnel list");
check(list.includes("the CO — the ship's Commanding Officer"), "the CO's own title is a real row on the shelf");

// Select the CO row — it's the first selectable row, so it should already
// be the default selection (renderList auto-selects the first pilot/mek/co).
let read = await readTexts();
console.log("Warden CO reader:", JSON.stringify(read));
check(read.includes("DOSSIER"), "opens as a dossier");
check(read.includes("the CO — the ship's Commanding Officer"), "titled with the CO's own name");
check(read.includes("REGISTERED PARTNER"), "shows the relationship line when he has one");
check(read.some((t) => t === "the Commander (dating)"), "names the player 'the Commander', not 'you'");
check(read.includes("COMMAND RECORD"), "shows the command record line");
check(read.some((t) => t.includes("mission") && t.includes("resolved") && t.includes("1 pilot lost")), "reads a real 'missions resolved / pilots lost' figure", read.find((t) => t.includes("resolved")));
check(!read.includes("STRESS") && !read.includes("MORALE") && !read.includes("STANDING"), "never shows his own Stress/Morale/Standing");
check(read.some((t) => t.includes("Carabil")), "still carries his authored bio underneath the live block");
await page.screenshot({ path: new URL("./coDossier_warden.png", import.meta.url).pathname });

// --- House Amaranth: Verinis, no relationship this time.
const haSave = JSON.parse(readFileSync(new URL("./mekArchiveSave.json", import.meta.url).pathname, "utf8"));
// mekArchiveSave.json is a Warden save; build a minimal House Amaranth
// stand-in isn't available here, so instead just re-check the facility
// fork directly against the live game's own House Amaranth starting state.
await page.evaluate(() => {
  const g = window.__bwGame;
  g.scene.stop("Archive");
});
const houseState = await page.evaluate(async () => {
  const mod = await import("/src/engine/campaignState.ts");
  return mod.createHouseAmaranthCampaignState(0);
});
await page.evaluate((s) => { const g = window.__bwGame; g.scene.start("Archive", { state: s, returnScene: "MainMenu" }); }, houseState);
await page.waitForFunction(() => window.__bwGame.scene.getScene("Archive")?.scene.isActive(), null, { timeout: 10000 });
await page.waitForTimeout(400);
list = await listTexts();
console.log("House Amaranth Personnel list:", JSON.stringify(list));
check(list.includes("Brig. Verinis Amaranth — field commander"), "Verinis, not Arangement, is the CO row on a House Amaranth save");
read = await readTexts();
check(read.includes("Brig. Verinis Amaranth — field commander"), "his dossier is titled correctly");
check(!read.includes("REGISTERED PARTNER"), "no relationship line when he isn't seeing anyone");
check(read.includes("COMMAND RECORD"), "still shows a command record");
check(read.some((t) => t.includes("Amaranth")), "still carries his authored bio");
await page.screenshot({ path: new URL("./coDossier_amaranth.png", import.meta.url).pathname });

check(errors.length === 0, "no console errors across both checks", errors.join(" | "));
await browser.close();
console.log(fail.length ? `\n${fail.length} FAILED` : "\nALL PASS");
process.exit(fail.length ? 1 : 0);
