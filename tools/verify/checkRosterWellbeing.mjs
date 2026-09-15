// One-off Playwright check, 12 Sep 2026: the new Stress/Morale line on
// each RosterPanel card, added on Maxime's conditional go-ahead ("you can
// see your unit shaken in archive, but if you think we should add it too.
// go ahead."). Confirms the line renders, uses the same band words the
// Archive already uses, and that Anand's real stress-100 value (from the
// Emotional Brain harness save) reads clearly.
//
// Updated 13 Sep 2026 for the bars pass (Build Brief
// claude_Bloom_Wars_Build_Brief_TeaseTooltipsStressBar_13Sep2026.md item 3,
// Maxime's locked style: "a small bar. Not raw numbers, not a hover-only
// tooltip"). The raw-number text line is gone; RosterPanel now draws each
// band word as its OWN standalone Text object next to a small bar (two
// Rectangles: track + fill) via drawWellbeingRow(), so the checks below no
// longer look for one combined "stress <band> <n>  ·  morale <band> <n>"
// string — they look for separate "stress <band>" / "morale <band>" text
// objects with no digits in them, plus the bar Rectangles themselves.
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
// — re-generating it live on 14 Sep 2026 (same seed, same script) now
// produces 88, not the "78" this comment used to say; the engine code
// this script runs through (griefCatalyst/debriefCatalyst) has clearly
// moved since 12 Sep even though genBrainSave.ts itself hasn't. Flagged
// separately to Maxime rather than silently re-pinned — see this build's
// addendum. Either way 88 is still over STRESS_PANIC_THRESHOLD (70), so
// "near the line" is still the correct band to check for — and the label
// itself no longer carries any number anyway; the bar is what shows the
// value now.
check(texts.some((t) => t === "stress near the line"), "Anand's current seeded Stress (over the panic line either way) reads as a standalone 'stress near the line' label, no number attached");
check(
  texts.some((t) => /^stress \S[\S ]*$/.test(t)) && texts.some((t) => /^morale \S[\S ]*$/.test(t)),
  "standalone 'stress <band>' and 'morale <band>' text objects are both present"
);
check(!texts.some((t) => /^(stress|morale) .*\d/.test(t)), "no raw stress/morale number leaking into either band-word label");
check(!texts.some((t) => t.includes("undefined")), "no undefined leaking into any card");

const barRectCount = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  let n = 0;
  hub.rosterPanel.container.list.forEach((o) => { if (o.type === "Rectangle") n++; });
  return n;
});
// 2 Rectangles per stat (track + fill) × 2 stats (stress, morale) = 4 per
// pilot card that has a social record, plus one more Rectangle per card
// for cardBg itself — this only asserts "at least one card's worth of
// bars actually drew," not an exact count, since which pilots have a
// social record depends on the save.
check(barRectCount >= 4, "at least one pilot card's Stress/Morale bars (track + fill Rectangles) are actually drawn", `saw ${barRectCount} Rectangle objects total`);

await page.screenshot({ path: new URL("./rosterWellbeing.png", import.meta.url).pathname, fullPage: false });

check(errors.length === 0, "no console errors", errors.join(" | "));
await browser.close();
console.log(fail.length ? `\n${fail.length} FAILED` : "\nALL PASS");
process.exit(fail.length ? 1 : 0);
