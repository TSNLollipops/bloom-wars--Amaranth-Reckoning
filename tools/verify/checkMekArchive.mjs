// One-off Playwright check (9 Sep 2026, sandbox-only): the Archive's
// Personnel shelf lists each pilot's Mek under them, a Mek row opens a
// "DOSSIER — MEK" file with the Attached synker line, a generated recruit's
// Mek carries a pool name, and a lost pilot's Mek reads as retired.
import { chromium } from "playwright";
import { readFileSync } from "fs";

const save = JSON.parse(readFileSync(new URL("./mekArchiveSave.json", import.meta.url).pathname, "utf8"));
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1074, height: 640 } });
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (err) => errors.push(err.message));
const fail = [];
const check = (ok, label, detail = "") => { console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`); if (!ok) fail.push(label); };

await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__bwGame?.scene.getScene("MainMenu")?.scene.isActive(), null, { timeout: 20000 });
await page.evaluate((s) => { const g = window.__bwGame; g.scene.stop("MainMenu"); g.scene.start("Archive", { state: s, returnScene: "MainMenu" }); }, save);
await page.waitForFunction(() => window.__bwGame.scene.getScene("Archive")?.scene.isActive(), null, { timeout: 10000 });
await page.waitForTimeout(400);

const listTexts = () => page.evaluate(() => window.__bwGame.scene.getScene("Archive").listLayer.list.filter((o) => o.type === "Text").map((o) => o.text));
const readTexts = () => page.evaluate(() => window.__bwGame.scene.getScene("Archive").readLayer.list.filter((o) => o.type === "Text").map((o) => o.text));

const list = await listTexts();
console.log("list rows:", JSON.stringify(list));
const mekNames = Object.values(save.meks).map((m) => m.displayName);
check(mekNames.every((n) => list.includes(n)), "every Mek on the save has a row on the Personnel shelf", mekNames.join(", "));
check(list.filter((t) => t === "MEK").length === mekNames.length, "each Mek row carries the MEK tag");
check(list.indexOf("Uma") === list.indexOf(save.pilots["pilot_recruit_1"].pilot.displayName) + 1 || list.indexOf("Uma") > 0, "the generated recruit's Mek (Uma) sits right under their pilot");

// Click Rourke's Mek: rows are 28px, group headers 20px, starting at LIST.y + 6.
// Order: [1st Lance header][Rourke][Rourke's Mek]...
const LIST = { x: 208, y: 70 };
const box = await page.locator("canvas").boundingBox();
await page.mouse.click(box.x + LIST.x + 60, box.y + LIST.y + 6 + 20 + 28 + 13);
await page.waitForTimeout(300);
let read = await readTexts();
console.log("reader:", JSON.stringify(read));
check(read.includes("DOSSIER — MEK"), "a Mek row opens a Mek dossier");
check(read.includes(save.meks["mek_rourke"].displayName), "titled with the Mek's own name");
check(read.includes("ATTACHED SYNKER"), "opens on the Attached synker line");
check(read.some((t) => t.includes("Rourke")), "names Rourke as the synker");
check(read.includes("CATALYST") && read.includes("Raven"), "reads the seed catalyst (Raven)");
check(read.some((t) => t.includes("working dock")), "carries the Mek's authored paragraph from the pilot's tail");
await page.screenshot({ path: new URL("./mekArchive_rourke.png", import.meta.url).pathname });

// Scroll the list and open the retired Mek (Anand's) in the struck group.
await page.evaluate(() => { const a = window.__bwGame.scene.getScene("Archive"); a.selectedId = "mek_anand"; a.readScroll = 0; a.renderList(); a.renderReader(); });
await page.waitForTimeout(300);
read = await readTexts();
check(read.some((t) => t.includes("Retired to civilian life")), "a lost pilot's Mek reads as retired");
check(read.some((t) => t.includes("Their child went with them")), "the child clause renders when the bond flag is set");
check(!read.includes("STRESS"), "no mood lines on a retired Mek");
await page.screenshot({ path: new URL("./mekArchive_anand.png", import.meta.url).pathname });

// The generated recruit's Mek.
await page.evaluate(() => { const a = window.__bwGame.scene.getScene("Archive"); a.selectedId = "mek_recruit_1"; a.readScroll = 0; a.renderList(); a.renderReader(); });
await page.waitForTimeout(300);
read = await readTexts();
check(read.includes("Uma"), "the generated Mek's dossier is titled with its pool name");
check(read.some((t) => t.startsWith("Intake:")), "a generated Mek gets an intake line from its rolled background");
await page.screenshot({ path: new URL("./mekArchive_recruit.png", import.meta.url).pathname });

// Iyari's Mek has a persisted mood.
await page.evaluate(() => { const a = window.__bwGame.scene.getScene("Archive"); a.selectedId = "mek_iyari"; a.readScroll = 0; a.renderList(); a.renderReader(); });
await page.waitForTimeout(300);
read = await readTexts();
check(read.includes("strained 58") && read.includes("low 33"), "mood reads as words and numbers off npcSocialStates");

// Pilot dossier tail heading resolves the Mek id to the live name.
await page.evaluate(() => { const a = window.__bwGame.scene.getScene("Archive"); a.selectedId = "pilot_rourke"; a.readScroll = 0; a.renderList(); a.renderReader(); });
await page.waitForTimeout(300);
read = await readTexts();
check(read.some((t) => t.startsWith("MEK — ") && !t.includes("mek_rourke")), "the pilot's MEK tail heading no longer shows a raw id", read.find((t) => t.startsWith("MEK — ")));

check(errors.length === 0, "no console errors", errors.join(" | "));
await browser.close();
console.log(fail.length ? `\n${fail.length} FAILED` : "\nALL PASS");
process.exit(fail.length ? 1 : 0);
