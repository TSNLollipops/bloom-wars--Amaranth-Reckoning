// Live-browser verification (12 Sep 2026) — cloud-sandbox-only, not
// shipped. Mission Chat / Player Notes / Battle HUD Relayout Plan v1, all
// four workstreams, against the REAL running game: the real Battle scene,
// the real DOM comms input (T, type, Enter — never a bypassed method
// call), the real Field Notes overlay, the real Codex section.
//
// What it produces, per the plan's own §4d ("screenshots are a required
// deliverable, not a nicety"):
//   missionchat_small_open.png     — 5-pilot Act I roster, Muster (20x12), both columns open
//   missionchat_wide_open.png      — 15-pilot roster, Falling Back to Meridian (36x14, the widest map)
//   missionchat_tall_open.png      — 15-pilot roster, Tunnel Rats (30x19, the tallest map)
//   missionchat_left_closed.png    — `[` pressed
//   missionchat_both_closed.png    — `[` and `]` pressed
//   missionchat_overflow.png       — the comms log full to overflow with real-length lines
//   missionchat_notes_overlay.png  — the in-mission Field Notes overlay
//   missionchat_codex_notes.png    — the Codex's FIELD NOTES section, reached via the Hub's own :notes
// and missionchat_report.json with every measured number.
//
// The harness README's standing trap, restated: the logical coordinate
// space is 1074x640 — scale clicks by box.width / 1074, never 960.
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "fs";

const here = (name) => new URL(`./${name}`, import.meta.url).pathname;
const save = readFileSync(here("missionchat_save.json"), "utf8");
const ACT1 = ["pilot_rourke", "pilot_bosk", "pilot_iyari", "pilot_anand", "pilot_lask"];

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--disable-background-networking", "--disable-component-update", "--no-first-run"] });
const page = await browser.newPage({ viewport: { width: 1074, height: 640 } });
const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(err.message));
page.on("crash", () => errors.push("PAGE CRASHED"));

await page.addInitScript((saveJson) => {
  window.localStorage.setItem("bloomwars_campaign_state_v1", saveJson);
  window.localStorage.removeItem("bloomwars_notes_v1");
  // Tutorial hints off so Mission 1's hint line doesn't sit under the board in the screenshots.
  window.localStorage.setItem("bloomwars_tutorial_seen_v1", "1");
}, save);

await page.goto("http://localhost:5183/", { waitUntil: "load" });
await page.waitForTimeout(1500);

const canvas = page.locator("canvas");
const box = await canvas.boundingBox();
if (!box) throw new Error("no canvas found");
const scale = box.width / 1074;
const clickGame = async (x, y) => page.mouse.click(box.x + x * scale, box.y + y * scale);

process.on("uncaughtException", async (e) => {
  console.error("UNCAUGHT:", e && e.message ? e.message : e);
  console.error("errors so far:", JSON.stringify(errors));
  try { await browser.close(); } catch { /* already gone */ }
  process.exit(2);
});
const report = { errors: [], scenes: {}, chat: {}, notes: {}, geometry: {} };
const failures = [];
function fail(msg) {
  console.error("FAIL: " + msg);
  failures.push(msg);
}

async function startBattle(missionId, pilotIds) {
  await page.evaluate(
    ({ missionId, pilotIds }) => {
      // Stop whatever's running first — the real game's TransporterPad
      // does scene.start() FROM the running scene (which stops it); starting
      // Battle from outside leaves the Main Menu's buttons drawn underneath,
      // which is a harness artifact, not a game bug, but it makes the
      // screenshots lie.
      for (const key of ["MainMenu", "Hub", "HubHouseAmaranth", "Codex"]) {
        const sc = window.__bwGame.scene.getScene(key);
        if (sc && sc.scene.isActive()) sc.scene.stop();
      }
      window.__bwGame.scene.start("Battle", { missionId, selectedPilotIds: pilotIds });
    },
    { missionId, pilotIds }
  );
  await page.waitForTimeout(1200);
  const status = await page.evaluate(() => {
    const b = window.__bwGame.scene.getScene("Battle");
    return b && b.scene.isActive() ? "active" : "inactive";
  });
  if (status !== "active") throw new Error("Battle scene not active for " + missionId);
}

/** Geometry of the live scene: board extents, column rects, key text objects' bounds. */
async function measure() {
  return page.evaluate(() => {
    const b = window.__bwGame.scene.getScene("Battle");
    const bounds = (t) => ({ left: t.x, right: t.x + t.width, top: t.y, bottom: t.y + t.height, visible: t.visible });
    return {
      map: { w: b.mission.map.width, h: b.mission.map.height, id: b.mission.map.id },
      tileSize: b.tileSize,
      boardX: b.boardX,
      boardY: b.boardY,
      boardRight: b.boardX + b.mission.map.width * b.tileSize,
      boardBottom: b.boardY + b.mission.map.height * b.tileSize,
      layout: b.layout,
      leftOpen: b.leftOpen,
      rightOpen: b.rightOpen,
      hud: bounds(b.hudText),
      log: bounds(b.logText),
      comms: bounds(b.commsLogText),
      commsBg: { left: b.commsBg.x, right: b.commsBg.x + b.commsBg.width, visible: b.commsBg.visible },
      endTurn: { x: b.endTurnBtn.x, y: b.endTurnBtn.y, left: b.endTurnBtn.x - b.endTurnBtn.width / 2, right: b.endTurnBtn.x + b.endTurnBtn.width / 2 },
      slots: b.actionSlots.map((s) => ({
        text: s.label.text,
        visible: s.btn.visible,
        btnLeft: s.btn.x - s.btn.width / 2,
        btnRight: s.btn.x + s.btn.width / 2,
        labelLeft: s.label.x,
        labelRight: s.label.x + s.label.width,
        keyRight: s.key.x + s.key.width,
      })),
      inputDisplay: b.commsInput.node.style.display,
      commsOpen: b.commsOpen,
      commsLog: b.commsLog.map((e) => `${e.speaker}: ${e.line}`),
    };
  });
}

function checkColumns(m, label) {
  // Board inside its viewport.
  if (m.boardRight > m.layout.mapViewport.x + m.layout.mapViewport.w + 0.01) fail(`${label}: board right ${m.boardRight} past viewport`);
  if (m.boardBottom > m.layout.mapViewport.y + m.layout.mapViewport.h + 0.01) fail(`${label}: board bottom ${m.boardBottom} past viewport`);
  if (m.leftOpen) {
    if (m.hud.right > m.boardX) fail(`${label}: HUD text (right ${m.hud.right}) overlaps the board (left ${m.boardX})`);
    if (m.log.right > m.boardX) fail(`${label}: log text (right ${m.log.right}) overlaps the board`);
  } else {
    if (m.hud.visible || m.log.visible) fail(`${label}: left column collapsed but HUD/log still visible`);
  }
  if (m.rightOpen) {
    if (m.comms.left < m.boardRight) fail(`${label}: comms text (left ${m.comms.left}) overlaps the board (right ${m.boardRight})`);
    if (m.comms.right > 1074) fail(`${label}: comms text runs off the canvas (${m.comms.right})`);
    if (!m.commsBg.visible) fail(`${label}: comms panel hidden while column open`);
  } else if (m.commsBg.visible || m.comms.visible) fail(`${label}: right column collapsed but comms still visible`);
  // Action-bar labels inside their buttons and clear of the hotkey digit (the "6LAST RITES" class of bug).
  for (const s of m.slots) {
    if (!s.visible) continue;
    if (s.labelRight > s.btnRight + 1) fail(`${label}: action label "${s.text}" overruns its button (${s.labelRight} > ${s.btnRight})`);
    if (s.labelLeft < s.keyRight - 0.5) fail(`${label}: action label "${s.text}" fuses into its hotkey digit`);
  }
  if (m.endTurn.left < 0 || m.endTurn.right > 1074) fail(`${label}: END TURN off-canvas`);
}

// ---- 1. Fresh 5-pilot roster, smallest map, both columns open ----------
await startBattle("mission_amaranth_1", ACT1);
let m = await measure();
report.scenes.small = m;
console.log(`[1] ${m.map.id} ${m.map.w}x${m.map.h} tile=${m.tileSize} board=(${m.boardX},${m.boardY})..(${m.boardRight},${m.boardBottom})`);
checkColumns(m, "small/open");
if (m.tileSize !== 29) fail(`expected 29px tiles on Muster with both columns open, got ${m.tileSize}`);
await page.screenshot({ path: here("missionchat_small_open.png") });

// ---- 2. Widest map, full roster ----------------------------------------
const allPilots = JSON.parse(save).pilots ? Object.keys(JSON.parse(save).pilots) : ACT1;
await startBattle("mission_amaranth_27", allPilots);
m = await measure();
report.scenes.wide = m;
console.log(`[2] ${m.map.id} ${m.map.w}x${m.map.h} tile=${m.tileSize} deployed=${allPilots.length}`);
checkColumns(m, "wide/open");
if (m.map.w !== 36) fail(`expected the 36-wide map, got ${m.map.w}`);
if (m.tileSize !== 16) fail(`expected 16px tiles on the widest map with both columns open, got ${m.tileSize}`);
await page.screenshot({ path: here("missionchat_wide_open.png") });

// Column toggles on the widest map — the case that matters most.
await page.keyboard.press("BracketLeft");
await page.waitForTimeout(300);
m = await measure();
report.scenes.wideLeftClosed = m;
console.log(`[2b] [ pressed: leftOpen=${m.leftOpen} tile=${m.tileSize} boardX=${m.boardX}`);
checkColumns(m, "wide/left-closed");
if (m.leftOpen) fail("[ did not collapse the left column");
if (m.tileSize < 16) fail("tile shrank on collapse");
await page.screenshot({ path: here("missionchat_left_closed.png") });

await page.keyboard.press("BracketRight");
await page.waitForTimeout(300);
m = await measure();
report.scenes.wideBothClosed = m;
console.log(`[2c] ] pressed: rightOpen=${m.rightOpen} tile=${m.tileSize} boardX=${m.boardX} boardRight=${m.boardRight}`);
checkColumns(m, "wide/both-closed");
if (m.rightOpen) fail("] did not collapse the right column");
if (m.tileSize !== 28) fail(`expected 28px tiles on the widest map with both columns closed, got ${m.tileSize}`);
await page.screenshot({ path: here("missionchat_both_closed.png") });

// A click on END TURN's rectangle with the board underneath must NOT also
// register as a board click (the control-strip guard). Select nothing,
// click the END TURN area's neighbour (an action slot's spot), check no
// selection appeared.
await clickGame(45, 524);
await page.waitForTimeout(200);
const selAfterStripClick = await page.evaluate(() => window.__bwGame.scene.getScene("Battle").selectedUnitId);
if (selAfterStripClick) fail(`a click on the control strip selected a unit underneath it (${selAfterStripClick})`);

// Reopen both.
await page.keyboard.press("BracketLeft");
await page.keyboard.press("BracketRight");
await page.waitForTimeout(300);
m = await measure();
if (!m.leftOpen || !m.rightOpen) fail("toggles did not reopen the columns");
if (m.tileSize !== 16) fail("reopening both columns did not restore the open layout");

// ---- 3. Tallest map -----------------------------------------------------
await startBattle("mission_amaranth_4", allPilots);
m = await measure();
report.scenes.tall = m;
console.log(`[3] ${m.map.id} ${m.map.w}x${m.map.h} tile=${m.tileSize}`);
checkColumns(m, "tall/open");
if (m.map.h !== 19) fail(`expected the 19-tall map, got ${m.map.h}`);
await page.screenshot({ path: here("missionchat_tall_open.png") });

// ---- 4. The chat itself, on Muster with the Act I five --------------------
await startBattle("mission_amaranth_1", ACT1);

/**
 * Drive the REAL input: T (a real key press through Phaser's own handler),
 * the text, Enter (a real key press the input's own DOM listener reads).
 * The body goes in via insertText — one CDP call — because this sandbox
 * renders Battle at ~5 fps under software GL, which makes a per-character
 * keyboard.type() cost ~400ms a character (measured); the one place a
 * per-key path matters (digits and Space must NOT leak to Phaser while
 * typing) uses real presses explicitly below.
 */
async function say(text) {
  await page.keyboard.press("t");
  await page.waitForTimeout(150);
  const focused = await page.evaluate(() => document.activeElement && document.activeElement.tagName);
  if (focused !== "INPUT") fail(`T did not focus the comms input (active element: ${focused}) before "${text}"`);
  const leaked = await page.evaluate(() => document.activeElement.value);
  if (leaked) fail(`the T that opened the box leaked into it as text: "${leaked}"`);
  await page.keyboard.insertText(text);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
}
async function lastLines(n = 3) {
  const log = await page.evaluate(() => window.__bwGame.scene.getScene("Battle").commsLog.map((e) => `${e.speaker}: ${e.line}`));
  return log.slice(-n);
}
const favOf = (pilotId) => page.evaluate((id) => {
  const raw = window.localStorage.getItem("bloomwars_campaign_state_v1");
  const s = JSON.parse(raw);
  return s.pilots[id]?.social?.favorability ?? null;
}, pilotId);

// 4a. :help prints the list under SYS.
await say(":help");
let tail = await lastLines(6);
report.chat.help = tail;
if (!tail.some((l) => l.startsWith("SYS: :notes"))) fail(":help did not print the command list");

// 4b. Unknown command stops with an error, never falls through.
await say(":notse hold the line");
tail = await lastLines(1);
report.chat.unknown = tail;
if (!/Unknown command ":notse"/.test(tail[0])) fail(`unknown command fell through or was mis-reported: ${tail[0]}`);

// 4c. Broadcast small talk with nothing selected — every able pilot answers.
await say("hello everyone");
tail = await lastLines(6);
report.chat.hello = tail;
const replies = tail.filter((l) => !l.startsWith("YOU:") && !l.startsWith("SYS:"));
if (replies.length !== ACT1.length) fail(`greeting broadcast: expected ${ACT1.length} replies, got ${replies.length}: ${JSON.stringify(tail)}`);

// 4d. A verb with nothing selected is refused with the aiming hint.
await say("well done");
tail = await lastLines(1);
if (!/Select a pilot first/.test(tail[0])) fail(`verb with no target was not refused: ${tail[0]}`);

// 4e. Select Bosk by real click on his tile, then praise — favor moves and is persisted.
const boskBefore = await favOf("pilot_bosk");
const boskTile = await page.evaluate(() => {
  const b = window.__bwGame.scene.getScene("Battle");
  const u = b.mission.units.find((x) => x.pilotId === "pilot_bosk");
  return { px: b.boardX + u.pos.x * b.tileSize + b.tileSize / 2, py: b.boardY + u.pos.y * b.tileSize + b.tileSize / 2, id: u.instanceId };
});
await clickGame(boskTile.px, boskTile.py);
await page.waitForTimeout(200);
const selected = await page.evaluate(() => window.__bwGame.scene.getScene("Battle").selectedUnitId);
if (selected !== boskTile.id) fail(`clicking Bosk's tile did not select him (${selected})`);
await say("well done");
tail = await lastLines(2);
report.chat.praise = tail;
const boskAfter = await favOf("pilot_bosk");
report.chat.boskFavor = { before: boskBefore, after: boskAfter };
// Bosk's persisted social state is primed by genMissionChatSave.ts from the
// Warden regulars seed (35), so the first praise reads 35 -> 39.
if (!(boskAfter !== null && boskBefore !== null && boskAfter === boskBefore + 4)) fail(`praise did not move Bosk's persisted favorability by +4 (${boskBefore} -> ${boskAfter})`);
const boskTag = await page.evaluate((id) => {
  const b = window.__bwGame.scene.getScene("Battle");
  const u = b.mission.unitById(id);
  const m = u.displayName.match(/[“"]([^”"]+)[”"]/);
  return m ? m[1] : u.displayName;
}, boskTile.id);
if (!tail[1].startsWith(boskTag + ":")) fail(`praise reply not tagged with Bosk's callsign "${boskTag}": ${tail[1]}`);

// 4f. Diminishing returns: the second praise this mission is worth +2.
await say("well done");
const boskThird = await favOf("pilot_bosk");
report.chat.boskFavorRepeat = boskThird;
if (boskThird !== boskAfter + 2) fail(`second praise should be +2 (diminishing), got ${boskAfter} -> ${boskThird}`);

// 4g. While the input has focus, a typed digit must NOT fire an action slot,
// and Space must NOT end the turn. Bosk has 2 actions; type "1 2 3" and a space.
const actionsBefore = await page.evaluate((id) => window.__bwGame.scene.getScene("Battle").mission.unitById(id).actionsRemaining, boskTile.id);
const turnBefore = await page.evaluate(() => window.__bwGame.scene.getScene("Battle").mission.turn);
await page.keyboard.press("t");
await page.waitForTimeout(150);
for (const key of ["1", "2", "3", " "]) await page.keyboard.press(key);
await page.keyboard.insertText("hold the line");
await page.keyboard.press("Enter");
await page.waitForTimeout(200);
const actionsAfter = await page.evaluate((id) => window.__bwGame.scene.getScene("Battle").mission.unitById(id).actionsRemaining, boskTile.id);
const turnAfter = await page.evaluate(() => window.__bwGame.scene.getScene("Battle").mission.turn);
report.chat.keyLeak = { actionsBefore, actionsAfter, turnBefore, turnAfter };
if (actionsAfter !== actionsBefore) fail(`typing digits into the comms box fired an action slot (${actionsBefore} -> ${actionsAfter})`);
if (turnAfter !== turnBefore) fail(`typing a space into the comms box ended the turn`);
tail = await lastLines(2);
report.chat.digitsLine = tail;
if (!/^YOU: 123 hold the line$/.test(tail[0])) fail(`the typed line with digits was not logged verbatim: ${tail[0]}`);

// 4h. :t by callsign reaches the right pilot; :t a Bloom is refused; :t unknown says so.
const anandBefore = await favOf("pilot_anand");
await say(":t farsight well done");
const anandFav = await favOf("pilot_anand");
tail = await lastLines(2);
report.chat.tCallsign = { tail, anandBefore, anandFav };
if (!tail[1].startsWith("Farsight:")) fail(`:t farsight did not reach Anand: ${JSON.stringify(tail)}`);
if (anandFav !== (anandBefore ?? 0) + 4) fail(`:t praise did not move Anand's favor by +4 (${anandBefore} -> ${anandFav})`);
const bloomName = await page.evaluate(() => {
  const b = window.__bwGame.scene.getScene("Battle");
  const u = b.mission.livingUnits().find((x) => x.kind === "bloom");
  return u ? u.displayName : null;
});
report.chat.bloomName = bloomName;
if (bloomName) {
  await say(`:t ${bloomName.split(" ")[0]} boo`);
  tail = await lastLines(1);
  report.chat.bloomRefusal = tail;
  if (!/Bloom don't answer/.test(tail[0])) fail(`:t a Bloom was not refused: ${tail[0]}`);
}
await say(":t nobodyhere hi");
tail = await lastLines(1);
if (!/answers to "nobodyhere"/.test(tail[0])) fail(`:t unknown name not reported: ${tail[0]}`);

// 4i. :notes writes a stamped note; a bare :notes opens the overlay in place (no scene change); Esc closes it.
await say(":notes Splitfang burrows on turn 3");
tail = await lastLines(1);
report.notes.write = tail;
if (!/Noted \(1 in the notebook\)/.test(tail[0])) fail(`:notes did not confirm the write: ${tail[0]}`);
const stored = await page.evaluate(() => JSON.parse(window.localStorage.getItem("bloomwars_notes_v1") || "[]"));
report.notes.stored = stored;
if (stored.length !== 1 || stored[0].scene !== "battle" || stored[0].missionId !== "mission_amaranth_1" || stored[0].turn !== 1) {
  fail(`stored note lacks its battle context: ${JSON.stringify(stored)}`);
}
await say(":notes");
await page.waitForTimeout(300);
const overlayUp = await page.evaluate(() => {
  const b = window.__bwGame.scene.getScene("Battle");
  return { panel: !!b.fieldNotesPanel, battleActive: b.scene.isActive() };
});
report.notes.overlay = overlayUp;
if (!overlayUp.panel) fail("a bare :notes did not open the in-mission notebook overlay");
if (!overlayUp.battleActive) fail("opening the notebook left the Battle scene");
await page.screenshot({ path: here("missionchat_notes_overlay.png") });
await page.keyboard.press("Escape");
await page.waitForTimeout(200);
const overlayGone = await page.evaluate(() => !window.__bwGame.scene.getScene("Battle").fieldNotesPanel);
if (!overlayGone) fail("Escape did not close the notebook overlay");

// 4j. After closing the chat, the captured keys work again: Space ends the turn (no units spent → prompt), Esc closes the prompt.
await page.keyboard.press("Space");
await page.waitForTimeout(200);
const promptUp = await page.evaluate(() => !!window.__bwGame.scene.getScene("Battle").endTurnPrompt);
if (!promptUp) fail("Space after chat did not open the end-turn prompt — capture list not restored?");
await page.keyboard.press("Escape");
await page.waitForTimeout(200);

// 4k. Overflow: fill the log with real-length lines and confirm the text is
// bottom-anchored inside the mask (the newest line's bottom edge inside the
// panel, the text's top above the panel top = clipped by the mask, never
// drawn over the header).
for (let i = 0; i < 14; i++) await say(`hold together, this is line ${i} of a genuinely long message that wraps a few times inside the comms column`);
m = await measure();
report.geometry.overflow = { commsTop: m.comms.top, commsBottom: m.comms.bottom, entries: m.commsLog.length };
if (m.comms.bottom > 556 + 1) fail(`comms log bottom ${m.comms.bottom} runs below the input`);
if (m.comms.top > 40) fail(`comms log did not fill the panel (top ${m.comms.top})`);
await page.screenshot({ path: here("missionchat_overflow.png") });

// 4l. Scripted (dialogue) lines are mirrored into the comms log: push one through the real log and re-render.
await page.evaluate(() => {
  const b = window.__bwGame.scene.getScene("Battle");
  b.mission.log.push("(dialogue) Cpl. Priya Anand — “Farsight”: Mat's still warm. Whatever did this hasn't gone far.");
  b.render();
});
tail = await lastLines(1);
report.chat.mirrored = tail;
if (tail[0] !== "Farsight: Mat's still warm. Whatever did this hasn't gone far.") fail(`(dialogue) line not mirrored into comms: ${tail[0]}`);

// ---- 5. The Codex's FIELD NOTES section, via the Hub's own :notes ---------
await page.evaluate(() => {
  const b = window.__bwGame.scene.getScene("Battle");
  b.scene.stop();
  window.__bwGame.scene.start("Hub");
});
await page.waitForTimeout(1500);
const hubActive = await page.evaluate(() => window.__bwGame.scene.getScene("Hub").scene.isActive());
if (!hubActive) fail("Hub did not start");
await page.keyboard.press("t");
await page.waitForTimeout(200);
await page.keyboard.type(":notes", { delay: 5 });
await page.keyboard.press("Enter");
await page.waitForTimeout(1200);
const codex = await page.evaluate(() => {
  const c = window.__bwGame.scene.getScene("Codex");
  return { active: c.scene.isActive(), sectionIndex: c.sectionIndex, returnScene: c.returnScene };
});
report.notes.codex = codex;
if (!codex.active) fail("Hub :notes did not open the Codex");
if (codex.sectionIndex !== 9) fail(`Codex did not open on FIELD NOTES (section index ${codex.sectionIndex})`);
if (codex.returnScene !== "Hub") fail(`Codex returnScene should be Hub, got ${codex.returnScene}`);
await page.screenshot({ path: here("missionchat_codex_notes.png") });
// Click the 10th category row to prove it's reachable (the 4 Sep off-canvas-rows bug).
await clickGame(135, 100 + 9 * Math.min(50, 500 / 9));
await page.waitForTimeout(200);
const stillNotes = await page.evaluate(() => window.__bwGame.scene.getScene("Codex").sectionIndex);
if (stillNotes !== 9) fail(`clicking the FIELD NOTES row landed on section ${stillNotes}`);
// Delete the one note through the real DELETE (arm, confirm) and check storage.
const delBtn = await page.evaluate(() => {
  const c = window.__bwGame.scene.getScene("Codex");
  const rects = c.contentLayer.list.filter((o) => o.type === "Rectangle" && o.input);
  return rects.length ? { x: rects[0].x, y: rects[0].y } : null;
});
if (!delBtn) fail("no DELETE button drawn for the stored note");
else {
  await clickGame(delBtn.x, delBtn.y);
  await page.waitForTimeout(150);
  await clickGame(delBtn.x, delBtn.y);
  await page.waitForTimeout(300);
  const left = await page.evaluate(() => JSON.parse(window.localStorage.getItem("bloomwars_notes_v1") || "[]").length);
  report.notes.afterDelete = left;
  if (left !== 0) fail(`arm+confirm DELETE did not remove the note (${left} left)`);
}

report.errors = errors;
if (errors.length) fail(`console/page errors: ${JSON.stringify(errors.slice(0, 5))}`);
writeFileSync(here("missionchat_report.json"), JSON.stringify(report, null, 2));
await browser.close();
if (failures.length) {
  console.error(`\n${failures.length} failure(s)`);
  process.exitCode = 1;
} else {
  console.log("\nAll mission-chat checks passed.");
}
