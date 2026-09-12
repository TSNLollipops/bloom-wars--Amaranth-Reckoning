// One-off Playwright check (12 Sep 2026, sandbox-only, Emotional Brain):
// the real Debrief scene, reached from a real Battle scene on Mission 1,
// draws the "WHAT THEY TOOK FROM IT" block off the real write-back, and
// the save that RETURN TO BASE writes carries Stress/Morale/memories.
// The mission itself is not played to completion (the bot harness covers
// outcomes): a few combat worries are placed on the live Mission the same
// shape mission.ts's own pushCombatWorry writes, the outcome is set, and
// Battle's own hand-off to Debrief is used.
//   npx tsx tools/verify/genBrainSave.ts   (any Warden save works; this one has history)
//   npx vite --port 5173 &   then   node tools/verify/checkBrainDebrief.mjs
import { chromium } from "playwright";
import { readFileSync } from "fs";

const save = readFileSync(new URL("./brainSave.json", import.meta.url).pathname, "utf8");
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1074, height: 640 } });
const errors = [];
const assetNoise = (t) => /Failed to process file|Unable to decode audio|Error decoding audio/.test(t);
page.on("console", (msg) => { if (msg.type() === "error" && !assetNoise(msg.text())) errors.push(msg.text()); });
page.on("pageerror", (err) => { if (!assetNoise(err.message)) errors.push(err.message); });
const fail = [];
const check = (ok, label, detail = "") => { console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`); if (!ok) fail.push(label); };

await page.addInitScript((saveJson) => {
  window.localStorage.setItem("bloomwars_campaign_state_v1", saveJson);
  window.localStorage.setItem("bloomwars_tutorial_seen_v1", "1");
}, save);
await page.goto("http://localhost:5173/", { waitUntil: "load" });
await page.waitForFunction(() => window.__bwGame?.scene.getScene("MainMenu")?.scene.isActive(), null, { timeout: 20000 });

// Start a real Battle on Mission 1 with the living Act I squad (Bosk is struck on this save).
await page.evaluate(() => {
  const g = window.__bwGame;
  for (const key of ["MainMenu", "Hub", "HubHouseAmaranth", "Codex"]) {
    const sc = g.scene.getScene(key);
    if (sc && sc.scene.isActive()) sc.scene.stop();
  }
  g.scene.start("Battle", { missionId: "mission_amaranth_1", selectedPilotIds: ["pilot_rourke", "pilot_iyari", "pilot_anand", "pilot_lask"] });
});
await page.waitForFunction(() => window.__bwGame.scene.getScene("Battle")?.scene.isActive(), null, { timeout: 15000 });
await page.waitForTimeout(1200);

const before = await page.evaluate(() => {
  const s = JSON.parse(window.localStorage.getItem("bloomwars_campaign_state_v1"));
  return { anandStress: s.pilots.pilot_anand.social.stress, iyariMorale: s.pilots.pilot_iyari.social.morale, iyariMemories: s.pilots.pilot_iyari.social.memories.length };
});

// Place worries on the live Mission the way mission.ts's pushCombatWorry does, set the outcome, hand off.
await page.evaluate(() => {
  const b = window.__bwGame.scene.getScene("Battle");
  const m = b.mission;
  const now = Date.now();
  const entry = (source, catalyst, intensity) => ({ source, catalyst, intensity, context: "battle", bornAt: now, expiresAt: now + 3600000 });
  m.combatWorries = {
    pilot_iyari: [entry("combat_downed", "rabbit", 0.8), entry("combat_permadeath_recoverable", "fox", 0.55)],
    pilot_anand: [entry("combat_kill", "shark", 0.4)],
    pilot_lask: [entry("combat_repair", "dog", 0.6), entry("combat_overwatch", "wolf", 0.45)],
  };
  m.outcome = "win";
  b.scene.start("Debrief", { mission: m });
});
await page.waitForFunction(() => window.__bwGame.scene.getScene("Debrief")?.scene.isActive(), null, { timeout: 15000 });
await page.waitForTimeout(800);

const texts = await page.evaluate(() => window.__bwGame.scene.getScene("Debrief").children.list.filter((o) => o.type === "Text").map((o) => o.text));
console.log("debrief texts:", JSON.stringify(texts.filter((t) => /TOOK|took it|Bond/.test(t))));
check(texts.includes("WHAT THEY TOOK FROM IT"), "the Debrief draws the take block");
check(texts.some((t) => t.startsWith("Pvt. Tegan Iyari") && /took it/.test(t) && /Stress \+/.test(t)), "Iyari, downed and restocked, reads as Stress up");
check(texts.some((t) => t.startsWith("Spec. Corin Lask") && /Morale \+/.test(t)), "Lask, who patched and covered, reads as Morale up");
check(!texts.some((t) => t.startsWith("2nd Lt.") && /took it/.test(t)), "the MC gets no take line");
check(texts.some((t) => /Bond [+-]\d/.test(t)), "an ordinary-mission bond shift is listed");
await page.screenshot({ path: new URL("./brainDebrief_win.png", import.meta.url).pathname });

// RETURN TO BASE persists it.
const box = await page.locator("canvas").boundingBox();
const btn = await page.evaluate(() => {
  const d = window.__bwGame.scene.getScene("Debrief");
  // The footer buttons live inside a Container (footerLayer), so walk it.
  const all = [];
  const walk = (o) => { if (o.type === "Text") all.push(o); if (o.list) o.list.forEach(walk); };
  d.children.list.forEach(walk);
  const t = all.find((o) => o.text === "RETURN TO BASE");
  if (!t) return null;
  const m = t.getWorldTransformMatrix();
  return { x: m.tx, y: m.ty };
});
check(!!btn, "RETURN TO BASE is on screen");
if (btn) {
  await page.mouse.click(box.x + btn.x, box.y + btn.y);
  await page.waitForTimeout(800);
}
const after = await page.evaluate(() => {
  const s = JSON.parse(window.localStorage.getItem("bloomwars_campaign_state_v1"));
  return { anandStress: s.pilots.pilot_anand.social.stress, iyariMorale: s.pilots.pilot_iyari.social.morale, iyariMemories: s.pilots.pilot_iyari.social.memories.length, iyariDrift: s.pilots.pilot_iyari.social.echoDrift, kinds: s.pilots.pilot_iyari.social.memories.map((m) => m.kind) };
});
console.log("before:", JSON.stringify(before), "after:", JSON.stringify(after));
check(after.iyariMemories === before.iyariMemories + 3, "Iyari's saved ledger grew by three (downed, pulled out, the win)", `${before.iyariMemories} -> ${after.iyariMemories}`);
check(after.kinds.includes("was_pulled_out") && after.kinds.includes("mission_won"), "the new memories are the right kinds");
check(after.iyariMorale !== before.iyariMorale, "Iyari's saved Morale moved");
check(!!after.iyariDrift, "Iyari's drift is on the save");

check(errors.length === 0, "no console errors", errors.join(" | "));
await browser.close();
console.log(fail.length ? `\n${fail.length} FAILED` : "\nALL PASS");
process.exit(fail.length ? 1 : 0);
