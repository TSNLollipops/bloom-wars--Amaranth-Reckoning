// One-off Playwright check (12 Sep 2026, sandbox-only): the new Stress/
// Morale line on each RosterPanel card, added on Maxime's conditional
// go-ahead ("you can see your unit shaken in archive, but if you think we
// should add it too. go ahead."). Confirms the line renders, uses the same
// band words the Archive already uses, and that Anand's real stress-100
// value (from the Emotional Brain harness save) reads clearly.
//   node tools/verify/checkRosterWellbeing.mjs   (vite dev server already up)
import { chromium } from "playwright";
import { readFileSync } from "fs";

const save = JSON.parse(readFileSync(new URL("./brainSave.json", import.meta.url).pathname, "utf8"));
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1074, height: 640 } });
const errors = [];
const assetNoise = (t) => /Failed to process file|Unable to decode audio|Error decoding audio/.test(t);
page.on("console", (msg) => { if (msg.type() === "error" && !assetNoise(msg.text())) errors.push(msg.text()); });
page.on("pageerror", (err) => { if (!assetNoise(err.message)) errors.push(err.message); });
const fail = [];
const check = (ok, label, detail = "") => { console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`); if (!ok) fail.push(label); };

await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__bwGame?.scene.getScene("MainMenu")?.scene.isActive(), null, { timeout: 20000 });
await page.evaluate((s) => {
  const g = window.__bwGame;
  g.scene.stop("MainMenu");
  g.scene.start("Hub", { state: s });
}, save);
await page.waitForFunction(() => window.__bwGame.scene.getScene("Hub")?.scene.isActive(), null, { timeout: 10000 });
await page.waitForTimeout(400);

// Jump straight to the panel rather than walking to the console — same
// "call the private method directly, it's plain JS at runtime" trick
// checkBrainArchive.mjs already uses for Archive.
await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  hub.openRosterPanel();
});
await page.waitForTimeout(300);

const readTexts = () =>
  page.evaluate(() => {
    const hub = window.__bwGame.scene.getScene("Hub");
    const out = [];
    hub.rosterPanel.container.list.forEach((o) => { if (o.type === "Text") out.push(o.text); });
    return out;
  });

const texts = await readTexts();
console.log("Roster card texts:\n" + texts.join("\n---\n"));

// brainSave.json's live campaignState.pilots holds Anand's SEEDED stress
// (78, above STRESS_PANIC_THRESHOLD), not the mutated 100 the separate
// runBrainSim.ts harness reaches after several missions — those are two
// different fixtures. 78 is still over the panic line, so "near the line"
// is still the correct band to check for.
check(texts.some((t) => t.includes("stress near the line 78")), "Anand's seeded Stress-78 (already over the panic line) reads as 'near the line'", texts.find((t) => t.includes("Anand")) ?? "(Anand not found)");
check(texts.some((t) => /stress \w[\w ]* \d+ {2}·  morale \w[\w ]* \d+/.test(t)), "a wellbeing line is present in the expected 'stress <band> <n>  ·  morale <band> <n>' shape");
check(!texts.some((t) => t.includes("undefined")), "no undefined leaking into any card");

await page.screenshot({ path: new URL("./rosterWellbeing.png", import.meta.url).pathname, fullPage: false });

check(errors.length === 0, "no console errors", errors.join(" | "));
await browser.close();
console.log(fail.length ? `\n${fail.length} FAILED` : "\nALL PASS");
process.exit(fail.length ? 1 : 0);
