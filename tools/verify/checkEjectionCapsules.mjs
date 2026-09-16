// One-off Playwright check (15 Sep 2026, sandbox-only, ejection capsules).
// A real Battle on Mission 6 "House Colors" (Warden's first human-crewed
// hostiles): one pilot and one enemy trooper are downed through the real
// attack path, the Munti recovers the friendly capsule and a Tank takes the
// enemy pilot by REAL mouse clicks on the board, the mission is won, and the
// Debrief's PRISONERS panel is driven through RECRUIT and RETURN TO BASE.
//   npx tsx tools/verify/genCapsuleSave.ts
//   npx vite --port 5173 &   then   node tools/verify/checkEjectionCapsules.mjs
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
await page.waitForTimeout(1500);

// Board setup through the engine's own verbs: Iyari goes down to a trooper,
// Bosk (Tank) drops a second trooper. Everything else hostile is benched so
// the board reads clearly; nothing ends the turn until the win.
const setup = await page.evaluate(() => {
  const b = window.__bwGame.scene.getScene("Battle");
  const m = b.mission;
  const by = (id) => m.units.find((u) => u.pilotId === id);
  const plain = (c) => m.map.tiles[c.y]?.[c.x] === "plain" && !m.livingUnits().some((u) => u.pos.x === c.x && u.pos.y === c.y);
  const around = (c) => [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].map(([dx, dy]) => ({ x: c.x + dx, y: c.y + dy }));
  const mechs = m.units.filter((u) => u.side === "hostile" && u.kind === "mech" && !u.downed);
  for (const u of m.units) if (u.side === "hostile" && u.kind !== "mech") u.downed = true;
  const [h1, h2, ...rest] = mechs;
  for (const u of rest) u.downed = true;
  if (!h1 || !h2) return { error: `need two hostile mechs, found ${mechs.length}` };

  // Find a plain tile with plain room around it, near the player deploy.
  const iyari = by("pilot_iyari");
  let spot = null;
  for (let y = 1; y < m.map.height - 1 && !spot; y++) for (let x = 1; x < m.map.width - 4 && !spot; x++) {
    const c = { x, y };
    if (plain(c) && around(c).filter(plain).length >= 6 && plain({ x: x + 3, y }) && around({ x: x + 3, y }).filter(plain).length >= 6) spot = c;
  }
  if (!spot) return { error: "no clear spot" };
  iyari.pos = { ...spot };
  h1.pos = { x: spot.x, y: spot.y - 1 };
  iyari.currentHp = 1;
  for (let i = 0; i < 40 && !iyari.downed; i++) { h1.actionsRemaining = 2; m.attack(h1.instanceId, iyari.instanceId); iyari.currentHp = Math.min(iyari.currentHp, 1); }
  h1.downed = true; // benched, not killed: no capsule from it

  const bosk = by("pilot_bosk");
  h2.pos = { x: spot.x + 3, y: spot.y };
  bosk.pos = { x: spot.x + 3, y: spot.y + 1 };
  h2.currentHp = 1;
  for (let i = 0; i < 40 && !h2.downed; i++) { bosk.actionsRemaining = 2; m.attack(bosk.instanceId, h2.instanceId); h2.currentHp = Math.min(h2.currentHp, 1); }
  bosk.actionsRemaining = 2;

  // A keeper so nothing ends early, parked out of the way.
  h1.downed = false; h1.pos = { x: m.map.width - 1, y: m.map.height - 1 }; h1.moveRange = 0; h1.vision = 0;

  const lask = by("pilot_lask");
  lask.pos = { x: spot.x - 1, y: spot.y + 1 };
  lask.actionsRemaining = 2;
  // Everyone else out of the picture.
  const rourke = by("pilot_rourke"); rourke.pos = { x: spot.x - 1, y: spot.y + 3 };
  b.selectedUnitId = null;
  b.render();
  return {
    spot,
    iyariDown: iyari.downed,
    h2Down: h2.downed,
    capsules: m.fieldCapsules().map((c) => ({ id: c.id, side: c.side, pos: c.pos, name: c.displayName })),
    tile: b.tileSize, boardX: b.boardX, boardY: b.boardY,
    lask: lask.instanceId, bosk: bosk.instanceId, laskPos: lask.pos, boskPos: bosk.pos,
    gw: window.__bwGame.config.width,
  };
});
console.log("setup:", JSON.stringify(setup));
check(!setup.error, "board set up", setup.error ?? "");
check(setup.iyariDown && setup.h2Down, "Iyari and the trooper both went down through the real attack path");
check(setup.capsules?.length === 2, "two capsules on the field, one of each side", JSON.stringify(setup.capsules?.map((c) => c.side)));
await page.screenshot({ path: here("capsules_board.png") });

const box = await page.locator("canvas").boundingBox();
const scale = box.width / setup.gw;
const clickTile = async (c) => {
  await page.mouse.click(box.x + (setup.boardX + c.x * setup.tile + setup.tile / 2) * scale, box.y + (setup.boardY + c.y * setup.tile + setup.tile / 2) * scale);
  await page.waitForTimeout(400);
};
const friendly = setup.capsules.find((c) => c.side === "player");
const enemy = setup.capsules.find((c) => c.side === "hostile");

// Munti: select, see the lime wash + legend, click the capsule.
await clickTile(setup.laskPos);
const laskSel = await page.evaluate((id) => {
  const b = window.__bwGame.scene.getScene("Battle");
  const walk = (o, out) => { if (o.type === "Text") out.push(o.text); if (o.list) o.list.forEach((c) => walk(c, out)); return out; };
  const texts = b.children.list.reduce((acc, o) => walk(o, acc), []);
  return { selected: b.selectedUnitId === id, wash: b.recoverableCapsules.map((c) => c.side), legend: texts.some((t) => /Lime box = RECOVER/.test(t)), status: texts.some((t) => /Capsules: 1 yours, 1 enemy/.test(t)) };
}, setup.lask);
check(laskSel.selected, "clicking the Munti selects her");
check(laskSel.wash.includes("player"), "the Munti sees the friendly capsule as recoverable", JSON.stringify(laskSel.wash));
check(laskSel.legend, "HUD legend explains the lime tile");
check(laskSel.status, "HUD status line counts the capsule out");
await page.screenshot({ path: here("capsules_recover_wash.png") });
// hover the capsule for the tooltip, then screenshot
await page.mouse.move(box.x + (setup.boardX + friendly.pos.x * setup.tile + setup.tile / 2) * scale, box.y + (setup.boardY + friendly.pos.y * setup.tile + setup.tile / 2) * scale);
await page.waitForTimeout(500);
await page.screenshot({ path: here("capsules_recover_selected.png") });
await clickTile(friendly.pos);
const afterRecover = await page.evaluate(({ id, lask }) => {
  const m = window.__bwGame.scene.getScene("Battle").mission;
  return { status: m.capsules.find((c) => c.id === id).status, laskActions: m.unitById(lask).actionsRemaining };
}, { id: friendly.id, lask: setup.lask });
check(afterRecover.status === "recovered", "a real click on the capsule recovers it", afterRecover.status);
check(afterRecover.laskActions === 1, "it cost the Munti exactly one action", String(afterRecover.laskActions));

// Tank: select, capture the enemy pilot. Deselect the Munti first, or a
// click on a hurt Bosk would read as her Repair.
await page.evaluate(() => { const b = window.__bwGame.scene.getScene("Battle"); b.selectedUnitId = null; b.clearSelectionHighlights(); b.render(); });
await clickTile(setup.boskPos);
const boskSel = await page.evaluate(() => {
  const b = window.__bwGame.scene.getScene("Battle");
  const walk = (o, out) => { if (o.type === "Text") out.push(o.text); if (o.list) o.list.forEach((c) => walk(c, out)); return out; };
  return { wash: b.recoverableCapsules.map((c) => c.side), legend: b.children.list.reduce((acc, o) => walk(o, acc), []).some((t) => /Salmon box = CAPTURE/.test(t)) };
});
check(boskSel.wash.includes("hostile") && !boskSel.wash.includes("player"), "a Tank can capture but not recover", JSON.stringify(boskSel.wash));
check(boskSel.legend, "HUD legend explains the salmon box");
await page.mouse.move(box.x + (setup.boardX + enemy.pos.x * setup.tile + setup.tile / 2) * scale, box.y + (setup.boardY + enemy.pos.y * setup.tile + setup.tile / 2) * scale);
await page.waitForTimeout(500);
await page.screenshot({ path: here("capsules_capture_selected.png") });
await clickTile(enemy.pos);
const captured = await page.evaluate((id) => window.__bwGame.scene.getScene("Battle").mission.capsules.find((c) => c.id === id).status, enemy.id);
check(captured === "captured", "a real click takes the enemy pilot prisoner", captured);

// Win, overlay, Debrief.
await page.evaluate(() => {
  const b = window.__bwGame.scene.getScene("Battle");
  for (const u of b.mission.units) if (u.side === "hostile") u.downed = true;
  b.selectedUnitId = null;
  b.mission.endPlayerTurn();
  b.render();
});
await page.waitForTimeout(800);
const overlay = await page.evaluate(() => {
  const b = window.__bwGame.scene.getScene("Battle");
  const walk = (o, out) => { if (o.type === "Text") out.push(o.text); if (o.list) o.list.forEach((c) => walk(c, out)); return out; };
  return { outcome: b.mission.outcome, texts: b.children.list.reduce((acc, o) => walk(o, acc), []), lost: b.mission.permanentLosses.length };
});
check(overlay.outcome === "win", "the mission is won");
check(overlay.lost === 0, "nobody lost — Iyari's capsule was recovered");
check(overlay.texts.some((t) => /1 pilot recovered/.test(t) && /1 prisoner taken/.test(t)), "the outcome overlay reports the recovery and the prisoner", overlay.texts.filter((t) => /recovered|prisoner/.test(t)).join(" | "));
await page.screenshot({ path: here("capsules_overlay.png") });

await page.evaluate(() => {
  const b = window.__bwGame.scene.getScene("Battle");
  b.scene.start("Debrief", { mission: b.mission });
});
await page.waitForFunction(() => window.__bwGame.scene.getScene("Debrief")?.scene.isActive(), null, { timeout: 15000 });
await page.waitForTimeout(800);
const debriefTexts = async () =>
  page.evaluate(() => {
    const d = window.__bwGame.scene.getScene("Debrief");
    const out = [];
    const walk = (o) => { if (o.type === "Text") { const m = o.getWorldTransformMatrix(); out.push({ text: o.text, x: m.tx, y: m.ty, visible: o.visible }); } if (o.list) o.list.forEach(walk); };
    d.children.list.forEach(walk);
    return { items: out, scrollY: d.cameras.main.scrollY };
  });
let dt = await debriefTexts();
check(dt.items.some((t) => /^PRISONERS — 1 enemy pilot/.test(t.text)), "Debrief shows the PRISONERS panel");
const pointsBefore = await page.evaluate(() => window.__bwGame.scene.getScene("Debrief").state.points);
await page.screenshot({ path: here("capsules_debrief.png") });

const recruitBtn = dt.items.find((t) => t.text === "RECRUIT");
check(!!recruitBtn, "RECRUIT button is drawn");
if (recruitBtn) {
  await page.mouse.click(box.x + recruitBtn.x * scale, box.y + (recruitBtn.y - dt.scrollY) * scale);
  await page.waitForTimeout(800);
}
await page.screenshot({ path: here("capsules_recruit_creator.png") });
dt = await debriefTexts();
const confirm = dt.items.filter((t) => t.text === "CONFIRM").pop();
check(!!confirm, "the Character Creator opens for the new recruit");
if (confirm) {
  await page.mouse.click(box.x + confirm.x * scale, box.y + (confirm.y - dt.scrollY) * scale);
  await page.waitForTimeout(600);
}
dt = await debriefTexts();
check(dt.items.some((t) => /^Signed on: .+, on the bench$/.test(t.text)), "the row now reads Signed on", dt.items.filter((t) => /Signed|Ransom/.test(t.text)).map((t) => t.text).join(" | "));
check(!dt.items.some((t) => t.text === "RECRUIT"), "the choice buttons are gone once decided");
const tipVisible = await page.evaluate(() => {
  const d = window.__bwGame.scene.getScene("Debrief");
  const out = [];
  const walk = (o) => { if (o.type === "Text" && /^Sign them on/.test(o.text)) out.push(o.visible && (o.parentContainer?.visible ?? true)); if (o.list) o.list.forEach(walk); };
  d.children.list.forEach(walk);
  return out.some(Boolean);
});
check(!tipVisible, "the RECRUIT tooltip doesn't linger after its button is gone");
await page.screenshot({ path: here("capsules_debrief_decided.png") });

const ret = dt.items.find((t) => t.text === "RETURN TO BASE");
check(!!ret, "RETURN TO BASE is on screen");
const rosterBefore = await page.evaluate(() => Object.keys(JSON.parse(window.localStorage.getItem("bloomwars_campaign_state_v1")).pilots).length);
if (ret) {
  await page.mouse.click(box.x + ret.x * scale, box.y + ret.y * scale); // footer is pinned: no scroll offset
  await page.waitForTimeout(1200);
}
const saved = await page.evaluate(() => {
  const s = JSON.parse(window.localStorage.getItem("bloomwars_campaign_state_v1"));
  const recruits = Object.values(s.pilots).filter((e) => e.pilot.id.startsWith("pilot_recruit_"));
  return { pilots: Object.keys(s.pilots).length, recruits: recruits.map((e) => ({ name: e.pilot.displayName, arch: e.pilot.archetypeId, tier: e.pilot.tier, status: e.status })), points: s.points, iyari: s.pilots.pilot_iyari.status };
});
console.log("saved:", JSON.stringify(saved), "pointsBefore:", pointsBefore, "rosterBefore:", rosterBefore);
check(saved.pilots === rosterBefore + 1, "the save gained exactly one pilot");
check(saved.recruits.length === 1 && saved.recruits[0].tier === "G" && /_bipedal$/.test(saved.recruits[0].arch), "the recruit is a G-tier human of the trooper's class", JSON.stringify(saved.recruits));
check(saved.points === pointsBefore, "no ransom was paid for a recruited prisoner");
check(saved.iyari === "active", "Iyari is still on the roster");

check(errors.length === 0, "no console errors", errors.join(" | "));
await browser.close();
console.log(fail.length ? `\n${fail.length} FAILED` : "\nALL PASS");
process.exit(fail.length ? 1 : 0);
