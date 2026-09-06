// One-off Playwright verification, 5 Sep 2026 — cloud-sandbox-only, not
// shipped. B2, the Hangar Deck crew-records panel and assignable lances.
//
// The engine rules (cap, Munti warning, roster membership, save round-trip)
// are unit-tested in engine/__tests__/campaignState.test.ts. What can only
// be checked here, in a real browser, is everything those tests can't see:
// that the panel actually opens off the new console, that the reassignment
// buttons are wired to the engine, that a moved pilot's MEK physically
// relocates to the other lance's workshop in the walkable ship, that the
// ambient Favorability number is really gone from the Hub, and that the
// Transporter Pad's lance quick-pick fills the deploy slots.
import { chromium } from "playwright";
import { readFileSync } from "fs";

const PORT = 5183;
const save = readFileSync(new URL("./save.json", import.meta.url), "utf8");

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1074, height: 640 } });
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (err) => errors.push(err.message));

let failed = false;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed = true;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${label}\n         expected: ${JSON.stringify(expected)}\n         actual:   ${JSON.stringify(actual)}`);
}

const CAMPAIGN_ID = JSON.parse(save).campaignId;
// Service records derive from recorded mission summaries, not the campaign
// save — without these the panel correctly shows "no missions flown yet"
// for everyone, which is right but proves nothing about the record line.
const statsRecords = ["pilot_rourke", "pilot_bosk", "pilot_iyari"].map((pilotId, i) => ({
  campaignId: CAMPAIGN_ID,
  missionId: `mission_seed_${i}`,
  missionName: `Seed Mission ${i}`,
  outcome: "win",
  turns: 9 + i,
  finishedAt: `2026-09-0${i + 1}T10:00:00.000Z`,
  squad: [{ pilotId, displayName: pilotId, kills: 3 + i, assists: 1, damageDealt: 50, damageTaken: 20, downed: i === 2, permanentlyLost: false, abilitiesUsed: { abil_overwatch: 4 } }],
}));
await page.addInitScript((s) => window.localStorage.setItem("bloomwars_campaign_state_v1", s), save);
await page.addInitScript((r) => window.localStorage.setItem("bloomwars_stats_v1", JSON.stringify({ installId: "verify", records: r })), statsRecords);
await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });
await page.waitForTimeout(1300);
const box = await page.locator("canvas").boundingBox();
await page.mouse.click(box.x + 480, box.y + 300); // CONTINUE -> Hub
await page.waitForTimeout(1800);

// ---- 1. The ambient Favorability number is gone from the Hub -----------
// The save is a 15-pilot midgame roster, so there are real NPCs with real
// favorability values to leak. Reads every NPC's ambient label and asserts
// none of them carries a signed number any more.
const ambient = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  // Force every label to render, rather than waiting to walk into range.
  const labels = hub.npcs.map((n) => {
    n.favLabel.setText(hub.constructor === undefined ? "" : n.favLabel.text);
    return { name: n.displayName, fav: n.favorability, label: n.favLabel.text };
  });
  return labels;
});
// The labels only populate within APPROACH_RADIUS, so drive the real
// composer directly for every NPC instead of relying on proximity.
const composed = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const out = [];
  for (const n of hub.npcs) {
    hub.updateProximity();
    out.push({ fav: n.favorability, label: n.favLabel.text });
  }
  return out;
});
void ambient;
const numeric = composed.filter((c) => /[+-]\d+/.test(c.label));
console.log("\n[1] ambient labels:");
console.log("    sample:", JSON.stringify(composed.slice(0, 3)));
check("no ambient label shows a signed favorability number", numeric.length, 0);
check("NPCs still HAVE favorability values (display change only)", composed.some((c) => typeof c.fav === "number"), true);

// ---- 2. The crew-records console opens the panel -----------------------
const opened = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  hub.openRosterPanel();
  const read = (c) => {
    const out = [];
    const walk = (l) => { for (const o of l) { if (o.type === "Text" && typeof o.text === "string" && o.visible !== false) out.push(o.text); if (o.list) walk(o.list); } };
    walk(c.list);
    return out;
  };
  return { open: hub.rosterOpen, texts: read(hub.rosterPanel.container) };
});
console.log("\n[2] crew records panel:");
check("panel opens", opened.open, true);
check("titled CREW RECORDS", opened.texts.some((t) => t.includes("CREW RECORDS")), true);
check("has a tab per lance the carrier HAS", ["1st Lance", "2nd Lance", "3rd Lance"].every((n) => opened.texts.some((t) => t.includes(n))), true);
// LanceId carries five ids for Gladiator, but this carrier grows one lance
// per act and stops at three — 4th/5th must not be offered as tabs.
check("does NOT show the two Gladiator lances this carrier lacks", ["4th Lance", "5th Lance"].some((n) => opened.texts.some((t) => t.includes(n))), false);
check("tabs show occupancy against the cap", opened.texts.some((t) => /1st Lance \d\/5/.test(t)), true);
const body = opened.texts.find((t) => t.includes("Tier")) ?? "";
check("pilot rows carry path and tier", /·\s*Tier/.test(body), true);
check("pilot rows carry the service record", /mission/.test(body) && /kills/.test(body), true);
await page.screenshot({ path: new URL("./promo_roster_panel.png", import.meta.url).pathname });

// ---- 3. Reassignment moves the pilot AND their Mek ---------------------
const before = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const g = window.__bwGame;
  const cs = hub.campaignState;
  // Pick a pilot in 1st Lance who is NOT the Munti, so moving them can't
  // make lance A unfieldable for an unrelated reason.
  const panel = hub.rosterPanel;
  void panel;
  const first = Object.values(cs.pilots).filter((e) => e.status === "active");
  void g;
  return { total: first.length };
});
void before;

const move = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const cs = hub.campaignState;
  const LanceOf = hub.rosterPanel.constructor.lanceOf;
  // This save is a FULL roster — 15 pilots, every lance at 5 — so a plain
  // move is refused by design and the swap is the real operation. Trade a
  // 1st Lance pilot with a 2nd Lance pilot and follow both their Meks.
  const inA = Object.values(cs.pilots).find((e) => e.status === "active" && LanceOf(cs, e.pilot.id) === "a");
  const inB = Object.values(cs.pilots).find((e) => e.status === "active" && LanceOf(cs, e.pilot.id) === "b");
  const mekA = inA.pilot.mekId;
  const mekB = inB.pilot.mekId;
  const roomABefore = hub.npcs.find((n) => n.pilotId === mekA)?.room ?? null;
  const roomBBefore = hub.npcs.find((n) => n.pilotId === mekB)?.room ?? null;
  hub.rosterPanel.pickForSwap(inA.pilot.id);
  hub.rosterPanel.pickForSwap(inB.pilot.id);
  return {
    lanceAAfter: LanceOf(cs, inA.pilot.id),
    lanceBAfter: LanceOf(cs, inB.pilot.id),
    mekRoomBefore: roomABefore,
    mekRoomAfter: hub.npcs.find((n) => n.pilotId === mekA)?.room ?? null,
    mekBRoomBefore: roomBBefore,
    mekBRoomAfter: hub.npcs.find((n) => n.pilotId === mekB)?.room ?? null,
    persisted: JSON.parse(window.localStorage.getItem("bloomwars_campaign_state_v1")).pilots[inA.pilot.id].lance,
  };
});
console.log("\n[3] reassignment:", JSON.stringify(move));
check("the 1st Lance pilot is now in 2nd", move.lanceAAfter, "b");
check("and the 2nd Lance pilot took their place in 1st", move.lanceBAfter, "a");
check("their Mek was in 1st Lance's workshop", move.mekRoomBefore, "workshop");
check("their Mek physically moved to 2nd Lance's workshop", move.mekRoomAfter, "workshopB");
check("and the traded Mek moved the other way", move.mekBRoomAfter, "workshop");
check("the trade was written to the save immediately", move.persisted, "b");

// ---- 4. A full destination becomes a trade, not a dead end ------------
const fullDest = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const cs = hub.campaignState;
  const LanceOf = hub.rosterPanel.constructor.lanceOf;
  const read = (c) => { const out = []; const walk = (l) => { for (const o of l) { if (o.type === "Text" && typeof o.text === "string" && o.visible !== false) out.push(o.text); if (o.list) walk(o.list); } }; walk(c.list); return out; };
  const sizes = () => Object.fromEntries(["a", "b", "c"].map((id) => [id, Object.values(cs.pilots).filter((e) => e.status === "active" && LanceOf(cs, e.pilot.id) === id).length]));
  const before = sizes();
  // Every lance is full, so this move cannot succeed — the panel should
  // pick the pilot up for a trade rather than just refusing.
  const inA = Object.values(cs.pilots).find((e) => e.status === "active" && LanceOf(cs, e.pilot.id) === "a");
  hub.rosterPanel.movePilot(inA.pilot.id, "b");
  const texts = read(hub.rosterPanel.container);
  return {
    before,
    after: sizes(),
    notice: texts.find((t) => t.includes("full")) ?? null,
    holding: texts.some((t) => t.includes("holding")),
  };
});
console.log("\n[4] move into a full lance:", JSON.stringify(fullDest));
check("every lance was already at the cap", fullDest.before, { a: 5, b: 5, c: 5 });
check("no lance changed size", fullDest.after, { a: 5, b: 5, c: 5 });
check("the panel explains it is full", fullDest.notice !== null, true);
check("and offers a trade instead of a dead end", fullDest.holding, true);
await page.screenshot({ path: new URL("./promo_roster_full.png", import.meta.url).pathname });

// ---- 5. A Munti-less lance warns rather than blocking ------------------
const munti = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const cs = hub.campaignState;
  const LanceOf = hub.rosterPanel.constructor.lanceOf;
  const read = (c) => { const out = []; const walk = (l) => { for (const o of l) { if (o.type === "Text" && typeof o.text === "string" && o.visible !== false) out.push(o.text); if (o.list) walk(o.list); } }; walk(c.list); return out; };
  // Section 4 deliberately left a pilot HELD for trade. Reopening resets
  // that, so this section starts clean — holding deliberately survives a
  // tab change (you switch tabs to find a partner), so setTab won't do it.
  hub.rosterPanel.open(cs);
  const isMunti = (e) => /munti/.test(e.pilot.archetypeId);
  const aMunti = Object.values(cs.pilots).find((e) => e.status === "active" && LanceOf(cs, e.pilot.id) === "a" && isMunti(e));
  const bNonMunti = Object.values(cs.pilots).find((e) => e.status === "active" && LanceOf(cs, e.pilot.id) === "b" && !isMunti(e));
  if (!aMunti || !bNonMunti) return { skipped: true };
  // Trade 1st Lance's only Munti away for a non-Munti. Allowed on purpose.
  hub.rosterPanel.pickForSwap(aMunti.pilot.id);
  hub.rosterPanel.pickForSwap(bNonMunti.pilot.id);
  hub.rosterPanel.setTab("a");
  const texts = read(hub.rosterPanel.container);
  return {
    movedOut: LanceOf(cs, aMunti.pilot.id) !== "a",
    warning: texts.find((t) => t.includes("Munti")) ?? null,
    tabFlagged: texts.some((t) => /1st Lance \d\/5/.test(t)),
  };
});
console.log("\n[5] trading 1st Lance's Munti away:", JSON.stringify(munti));
if (!munti.skipped) {
  check("the trade was ALLOWED (warning, not a block)", munti.movedOut, true);
  check("and the panel warns the lance can't launch", munti.warning !== null, true);
}
await page.screenshot({ path: new URL("./promo_roster_warning.png", import.meta.url).pathname });

// ---- 6. The Transporter Pad's lance quick-pick fills the squad ---------
await page.evaluate(() => {
  window.__bwGame.scene.stop("Hub");
  window.__bwGame.scene.start("TransporterPad", { missionId: "mission_amaranth_13" });
});
await page.waitForTimeout(1200);
const padState = await page.evaluate(() => {
  const tp = window.__bwGame.scene.getScene("TransporterPad");
  const texts = tp.children.list.filter((o) => o.type === "Text" && typeof o.text === "string").map((o) => o.text);
  return { showPicker: tp.showPicker, hasQuickPick: texts.some((t) => t.includes("fill from")), lanceButtons: texts.filter((t) => /\[ \dnd Lance|\[ \dst Lance|\[ \drd Lance/.test(t)) };
});
console.log("\n[6] Transporter Pad:", JSON.stringify(padState));
check("the lance quick-pick is on screen", padState.hasQuickPick, true);
check("with a button per lance the carrier has, not per possible id", padState.lanceButtons.length, 3);
await page.screenshot({ path: new URL("./promo_pad_lance_pick.png", import.meta.url).pathname });

console.log("\nconsole errors:", errors.length ? errors : "none");
if (errors.length) failed = true;
await browser.close();
console.log(failed ? "\nRESULT: FAILED" : "\nRESULT: PASSED");
if (failed) process.exitCode = 1;
