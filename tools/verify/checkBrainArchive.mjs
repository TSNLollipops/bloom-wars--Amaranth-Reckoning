// One-off Playwright check (12 Sep 2026, sandbox-only, Emotional Brain):
// the Archive's pilot dossier shows a "Carries" block built off the real
// ledger (genBrainSave.ts ran the real Debrief write-back twice), the loss
// line is flagged, a fresh pilot has no Carries block, and a struck pilot's
// file keeps no mood lines. Screenshots for the build log.
//   npx tsx tools/verify/genBrainSave.ts && npx vite --port 5173 &  then
//   node tools/verify/checkBrainArchive.mjs
import { chromium } from "playwright";
import { readFileSync } from "fs";

const save = JSON.parse(readFileSync(new URL("./brainSave.json", import.meta.url).pathname, "utf8"));
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1074, height: 640 } });
const errors = [];
// Asset-load noise is filtered: this sandbox mirror carries src/ and tools/
// but not public/ (audio, portraits), so Phaser logs a decode/process
// failure per missing file. None of that is the Archive's doing.
const assetNoise = (t) => /Failed to process file|Unable to decode audio|Error decoding audio/.test(t);
page.on("console", (msg) => { if (msg.type() === "error" && !assetNoise(msg.text())) errors.push(msg.text()); });
page.on("pageerror", (err) => { if (!assetNoise(err.message)) errors.push(err.message); });
const fail = [];
const check = (ok, label, detail = "") => { console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`); if (!ok) fail.push(label); };

await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__bwGame?.scene.getScene("MainMenu")?.scene.isActive(), null, { timeout: 20000 });
await page.evaluate((s) => { const g = window.__bwGame; g.scene.stop("MainMenu"); g.scene.start("Archive", { state: s, returnScene: "MainMenu" }); }, save);
await page.waitForFunction(() => window.__bwGame.scene.getScene("Archive")?.scene.isActive(), null, { timeout: 10000 });
await page.waitForTimeout(400);

const readTexts = () => page.evaluate(() => window.__bwGame.scene.getScene("Archive").readLayer.list.filter((o) => o.type === "Text").map((o) => o.text));
const open = async (id) => {
  await page.evaluate((pid) => { const a = window.__bwGame.scene.getScene("Archive"); a.selectedId = pid; a.readScroll = 0; a.renderList(); a.renderReader(); }, id);
  await page.waitForTimeout(300);
  return readTexts();
};

let read = await open("pilot_anand");
console.log("Anand reader:", JSON.stringify(read));
check(read.includes("CARRIES"), "Anand's dossier has a Carries block");
check(read.some((t) => t.startsWith("Lost a squadmate (M.Sgt. Halvard Bosk)")), "the loss he was deployed for is carried, by name");
check(read.some((t) => t.includes("The Fallow Line") || t.includes("Foraging Party")), "the memory names the mission it happened on");
check(read.some((t) => /day \d+\./.test(t)), "the memory is dated by in-game day");
check(read.filter((t) => /, day \d+\.$/.test(t)).length <= 3, "at most three Carries lines");
await page.screenshot({ path: new URL("./brainArchive_anand.png", import.meta.url).pathname });

read = await open("pilot_lask");
check(read.includes("CARRIES"), "Lask (who patched someone and watched two fall) has a Carries block");
check(read.some((t) => t.startsWith("Lost a squadmate")), "Lask carries the loss too, with his own echo");
await page.screenshot({ path: new URL("./brainArchive_lask.png", import.meta.url).pathname });

read = await open("pilot_bosk");
check(!read.includes("STRESS") && !read.includes("CARRIES"), "the struck pilot's file keeps no mood and no Carries block (departed pilots lose their mood, decided 7 Sep)");

// Rourke never gets a ledger (no MC social state yet, build plan §8).
read = await open("pilot_rourke");
check(!read.includes("CARRIES"), "the MC has no Carries block (no persisted social state for her yet)");

check(errors.length === 0, "no console errors", errors.join(" | "));
await browser.close();
console.log(fail.length ? `\n${fail.length} FAILED` : "\nALL PASS");
process.exit(fail.length ? 1 : 0);
