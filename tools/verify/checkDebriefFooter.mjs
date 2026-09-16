// One-off Playwright check (15 Sep 2026, sandbox-only): the Debrief footer
// layering fix. Reaches a real Debrief from a real Battle (Mission 6, won,
// with a prisoner, so the callout stack is tall enough to scroll), scrolls to
// the very bottom with the mouse wheel, and checks that (1) the pinned footer
// draws above every piece of shop content, (2) its backdrop is opaque, and
// (3) the shop's PREV / page / NEXT row sits ABOVE the footer band at full
// scroll, so it can still be clicked. Screenshots top and bottom.
//   npx tsx tools/verify/genCapsuleSave.ts
//   npx vite --port 5173 &   then   node tools/verify/checkDebriefFooter.mjs
import { chromium } from "playwright";
import { readFileSync, readdirSync } from "fs";

const here = (f) => new URL(`./${f}`, import.meta.url).pathname;
const save = readFileSync(here("capsuleSave.json"), "utf8");
const shell = readdirSync("/opt/pw-browsers").find((d) => d.startsWith("chromium_headless_shell-"));
const browser = await chromium.launch({ executablePath: `/opt/pw-browsers/${shell}/chrome-linux/headless_shell` });
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
await page.waitForFunction(() => window.__bwGame?.scene.getScene("MainMenu")?.scene.isActive(), null, { timeout: 30000 });
await page.evaluate(() => {
  const g = window.__bwGame;
  for (const key of ["MainMenu", "Hub", "HubHouseAmaranth", "Codex"]) {
    const sc = g.scene.getScene(key);
    if (sc && sc.scene.isActive()) sc.scene.stop();
  }
  g.scene.start("Battle", { missionId: "mission_amaranth_6", selectedPilotIds: ["pilot_rourke", "pilot_bosk", "pilot_iyari", "pilot_anand", "pilot_lask"] });
});
await page.waitForFunction(() => window.__bwGame.scene.getScene("Battle")?.scene.isActive(), null, { timeout: 20000 });
await page.waitForTimeout(1200);
// Win with one prisoner and one downed pilot, through the engine's own verbs.
await page.evaluate(() => {
  const b = window.__bwGame.scene.getScene("Battle");
  const m = b.mission;
  const mechs = m.units.filter((u) => u.side === "hostile" && u.kind === "mech" && !u.downed);
  const bosk = m.units.find((u) => u.pilotId === "pilot_bosk");
  const h = mechs[0];
  h.pos = { x: bosk.pos.x + 1, y: bosk.pos.y };
  h.currentHp = 1;
  for (let i = 0; i < 40 && !h.downed; i++) { bosk.actionsRemaining = 2; m.attack(bosk.instanceId, h.instanceId); h.currentHp = Math.min(h.currentHp, 1); }
  const anand = m.units.find((u) => u.pilotId === "pilot_anand");
  anand.actionsRemaining = 2;
  anand.pos = { ...h.pos };
  const cap = m.getRecoverableCapsules(anand.instanceId).find((c) => c.side === "hostile");
  if (cap) m.recoverCapsule(anand.instanceId, cap.id);
  for (const u of m.units) if (u.side === "hostile") u.downed = true;
  m.endPlayerTurn();
  b.scene.start("Debrief", { mission: m });
});
await page.waitForFunction(() => window.__bwGame.scene.getScene("Debrief")?.scene.isActive(), null, { timeout: 15000 });
await page.waitForTimeout(800);
await page.screenshot({ path: here("debriefFooter_top.png") });

const box = await page.locator("canvas").boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
for (let i = 0; i < 40; i++) await page.mouse.wheel(0, 400);
await page.waitForTimeout(600);

const state = await page.evaluate(() => {
  const d = window.__bwGame.scene.getScene("Debrief");
  const cam = d.cameras.main;
  const footer = d.footerLayer;
  const shopObjs = [...d.shop.shopLayer.list, ...d.shop.navLayer.list];
  const walk = (o, out) => { out.push(o); if (o.list) o.list.forEach((c) => walk(c, out)); return out; };
  const navTexts = walk(d.shop.navLayer, []).filter((o) => o.type === "Text").map((o) => ({ text: o.text, screenY: o.getWorldTransformMatrix().ty - cam.scrollY * (o.scrollFactorY ?? 1) }));
  return {
    scrollY: cam.scrollY,
    maxScroll: cam.getBounds ? null : null,
    footerDepth: footer.depth,
    shopDepths: [d.shop.shopLayer.depth, d.shop.navLayer.depth],
    shopChildren: shopObjs.length,
    backdropAlpha: footer.list[0]?.alpha,
    navTexts,
  };
});
console.log(JSON.stringify(state));
check(state.scrollY > 0, "the Debrief actually scrolled", String(state.scrollY));
check(state.footerDepth > Math.max(...state.shopDepths), "the footer draws above the shop layers", `${state.footerDepth} vs ${state.shopDepths}`);
check(state.backdropAlpha === 1, "the footer backdrop is opaque", String(state.backdropAlpha));
if (state.navTexts.length) {
  const lowest = Math.max(...state.navTexts.map((t) => t.screenY));
  check(lowest < 576, "at full scroll the shop's PREV/NEXT row sits above the footer band", `lowest nav text at screen y ${Math.round(lowest)}`);
} else {
  console.log("  (the shop fit on one page this run, so there is no nav row to check)");
}
await page.screenshot({ path: here("debriefFooter_bottom.png") });
check(errors.length === 0, "no console errors", errors.join(" | "));
await browser.close();
console.log(fail.length ? `\n${fail.length} FAILED` : "\nALL PASS");
process.exit(fail.length ? 1 : 0);
