// One-off Playwright verification (3 Sep 2026) — cloud-sandbox-only, not
// shipped. Battle action-bar paging (engine/actionBarPaging.ts).
//
// Two things get checked, and the first matters as much as the second:
//
//  1. NOTHING CHANGED for the game as it ships today. The heaviest kit a
//     player can actually assemble is six verbs (Migawari on a Munti
//     bipedal), which is exactly the slot count — so the bar must show six
//     real actions and NO "MORE" button. Paging that quietly stole a slot
//     from every heavy build would be a regression dressed as a fix.
//
//  2. When a kit does overflow, every verb is still reachable. Forced here
//     by pushing two more REAL ability ids onto the deployed unit in-page
//     (abil_taunt, abil_interdict — both have real bar entries and real
//     canX() predicates, so the bar is built by the real code path, just
//     for a unit that couldn't normally hold them). Then MORE is clicked
//     with real mouse events at its real screen position — not by calling
//     runActionSlot() — so a missing setInteractive() or a mis-set
//     moreSlotIndex would fail here rather than pass silently.
//
// Boots against tools/verify/actionbar_save.json (genActionBarSave.ts).
import { chromium } from "playwright";
import { readFileSync } from "fs";

const save = readFileSync(new URL("./actionbar_save.json", import.meta.url).pathname, "utf8");
const HEIRLOOM_PILOT = "pilot_heirloom_last_word";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1074, height: 640 } });

const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(err.message));

await page.addInitScript((saveJson) => {
  window.localStorage.setItem("bloomwars_campaign_state_v1", saveJson);
}, save);

await page.goto("http://localhost:5183/", { waitUntil: "load" });
await page.waitForTimeout(1500); // Boot -> MainMenu

const canvas = page.locator("canvas");
const box = await canvas.boundingBox();
if (!box) throw new Error("no canvas found");
// The canvas is letterboxed inside the viewport (Phaser Scale.FIT), and the
// game's logical coordinate space is 1074x640 — see src/main.ts's own width/
// height. Using 960 here is what made the first run of this script miss the
// MORE button by ~110px and report a click that never happened.
const GAME_W = 1074;
const scale = box.width / GAME_W;
const clickGame = async (x, y) => page.mouse.click(box.x + x * scale, box.y + y * scale);

// Straight into a real mission with the Heirloom wielder deployed. Same
// scene.start() call TransporterPad.ts makes on BEAM DOWN, same arguments.
await page.evaluate((pilotId) => {
  window.__bwGame.scene.start("Battle", {
    missionId: "mission_1a",
    selectedPilotIds: [pilotId, "pilot_thyns", "pilot_barasj"],
  });
}, HEIRLOOM_PILOT);
await page.waitForTimeout(1500);

const battleStatus = await page.evaluate(() => {
  const b = window.__bwGame.scene.getScene("Battle");
  if (!b) return "no Battle scene";
  return b.scene.isActive() ? "active" : "inactive:" + b.scene.settings.status;
});
console.log("Battle scene status:", battleStatus);
if (battleStatus !== "active") throw new Error("Battle scene not active: " + battleStatus);

/** Select the wielder and report what the bar actually drew. */
async function selectAndRead(extraAbilities = []) {
  return page.evaluate(
    ({ pilotId, extras }) => {
      const b = window.__bwGame.scene.getScene("Battle");
      const unit = b.mission.units.find((u) => u.pilotId === pilotId);
      if (!unit) return { error: "wielder not deployed: " + pilotId };
      for (const a of extras) if (!unit.abilities.includes(a)) unit.abilities.push(a);
      b.selectedUnitId = unit.instanceId;
      b.render();
      return {
        unit: unit.displayName,
        archetypeId: unit.archetypeId,
        abilities: unit.abilities,
        allOptions: b.actionOptions.map((o) => o.label),
        moreSlotIndex: b.moreSlotIndex,
        page: b.actionPage,
        slots: b.actionSlots.map((s) => ({
          text: s.label.text,
          visible: s.btn.visible,
          interactive: !!s.btn.input,
          x: s.btn.x,
          y: s.btn.y,
          // Real measured geometry, straight off the live Phaser objects —
          // this is what catches a label overrunning its button or fusing
          // into the hotkey digit, which no unit test can see.
          btnLeft: s.btn.x - s.btn.width / 2,
          btnRight: s.btn.x + s.btn.width / 2,
          labelLeft: s.label.x,
          labelRight: s.label.x + s.label.width,
          keyRight: s.key.x + s.key.width,
        })),
      };
    },
    { pilotId: HEIRLOOM_PILOT, extras: extraAbilities },
  );
}

function drawnLabels(state) {
  return state.slots.filter((s) => s.visible).map((s) => s.text);
}

function fail(msg) {
  console.error("FAIL: " + msg);
  process.exitCode = 1;
}

// ---- 1. The shipping case: six verbs, six slots, no MORE ----------------
const base = await selectAndRead();
if (base.error) throw new Error(base.error);
console.log("\n[1] wielder:", base.unit, base.archetypeId);
console.log("    kit:", base.abilities.join(", "));
console.log("    bar:", drawnLabels(base).join(" | "));
console.log("    options:", base.allOptions.length, "moreSlotIndex:", base.moreSlotIndex);
await page.screenshot({ path: new URL("./actionbar_base.png", import.meta.url).pathname });

if (base.allOptions.length !== 6) fail(`expected the shipping worst case to be 6 options, got ${base.allOptions.length} (${base.allOptions.join(", ")})`);
if (base.moreSlotIndex !== -1) fail("a six-verb kit must not spend a slot on MORE");
if (drawnLabels(base).length !== 6) fail(`expected 6 drawn buttons, got ${drawnLabels(base).length}`);
if (drawnLabels(base).some((t) => t.startsWith("MORE"))) fail("MORE drawn on a bar that fits");
if (JSON.stringify(drawnLabels(base)) !== JSON.stringify(base.allOptions)) {
  fail("the six drawn buttons are not the six options, in order");
}

// ---- 1b. Labels fit their buttons and clear the hotkey digit -----------
// The bug this catches shipped for a day and a half unnoticed: the label
// used to be centred while the digit sat on the left edge, so the real bar
// for this exact pilot read "1OVERWATCH" / "5MIGAWARI" / "6LAST RITES" —
// the last one with the digit fused into the L. Measured, not eyeballed.
function checkLabelFit(state, where) {
  for (const s of state.slots) {
    if (!s.visible || !s.text) continue;
    if (s.labelLeft < s.keyRight) fail(`${where}: "${s.text}" overlaps its hotkey digit (label starts ${s.labelLeft}, digit ends ${s.keyRight})`);
    if (s.labelRight > s.btnRight - 2) fail(`${where}: "${s.text}" overruns its button (label ends ${s.labelRight.toFixed(1)}, button ends ${s.btnRight})`);
  }
}
checkLabelFit(base, "shipping bar");
console.log("    label fit: every label clears its digit and stays inside its button");

// ---- 2. Forced overflow: paging, real clicks ---------------------------
const over = await selectAndRead(["abil_taunt", "abil_interdict"]);
console.log("\n[2] forced overflow to", over.allOptions.length, "options:", over.allOptions.join(", "));
console.log("    page 1 bar:", drawnLabels(over).join(" | "));
console.log("    moreSlotIndex:", over.moreSlotIndex);

if (over.allOptions.length !== 8) fail(`expected 8 options after forcing, got ${over.allOptions.length}`);
if (over.moreSlotIndex !== 5) fail(`expected MORE in the last slot (5), got ${over.moreSlotIndex}`);
const moreSlot = over.slots[over.moreSlotIndex];
if (!moreSlot.visible) fail("MORE slot not visible");
if (!moreSlot.interactive) fail("MORE slot has no input handler — a click would fall through to the board");
if (moreSlot.text !== "MORE 1/2") fail(`expected "MORE 1/2", got "${moreSlot.text}"`);

checkLabelFit(over, "overflow bar");
const page1 = drawnLabels(over).slice(0, 5);
await page.screenshot({ path: new URL("./actionbar_page1.png", import.meta.url).pathname });

// Real mouse click on the real button, at its real position.
await clickGame(moreSlot.x, moreSlot.y);
await page.waitForTimeout(150);
const after1 = await page.evaluate(() => {
  const b = window.__bwGame.scene.getScene("Battle");
  return {
    page: b.actionPage,
    slots: b.actionSlots.filter((s) => s.btn.visible).map((s) => s.label.text),
    more: b.actionSlots[b.moreSlotIndex]?.label.text,
  };
});
await page.screenshot({ path: new URL("./actionbar_page2.png", import.meta.url).pathname });
console.log("    after clicking MORE:", after1.slots.join(" | "));
if (after1.page !== 1) fail(`expected to be on page index 1, got ${after1.page}`);
if (after1.more !== "MORE 2/2") fail(`expected "MORE 2/2", got "${after1.more}"`);

const page2 = after1.slots.filter((t) => !t.startsWith("MORE"));
const seen = [...page1, ...page2].sort();
const expected = [...over.allOptions].sort();
if (JSON.stringify(seen) !== JSON.stringify(expected)) {
  fail(`pages do not cover the kit.\n  seen:     ${seen.join(", ")}\n  expected: ${expected.join(", ")}`);
} else {
  console.log("    both pages together cover all 8 verbs");
}

// Clicking MORE again wraps back rather than stranding the player.
await clickGame(moreSlot.x, moreSlot.y);
await page.waitForTimeout(150);
const after2 = await page.evaluate(() => {
  const b = window.__bwGame.scene.getScene("Battle");
  return { page: b.actionPage, more: b.actionSlots[b.moreSlotIndex]?.label.text };
});
console.log("    after clicking MORE again:", after2.more, "(page index", after2.page + ")");
if (after2.page !== 0) fail(`MORE did not wrap back to page 1, landed on ${after2.page}`);

// ---- 3. Selecting a different unit resets to page 1 --------------------
await page.evaluate(() => {
  const b = window.__bwGame.scene.getScene("Battle");
  b.actionPage = 1; // pretend the player had paged the previous unit
  const other = b.mission.units.find((u) => u.side === "player" && u.instanceId !== b.selectedUnitId);
  b.selectedUnitId = other.instanceId;
  b.render();
});
const reset = await page.evaluate(() => {
  const b = window.__bwGame.scene.getScene("Battle");
  return { page: b.actionPage, more: b.moreSlotIndex, labels: b.actionSlots.filter((s) => s.btn.visible).map((s) => s.label.text) };
});
console.log("\n[3] after selecting another pilot:", reset.labels.join(" | "), "page index", reset.page);
if (reset.page !== 0) fail(`selecting a new unit left the bar on page index ${reset.page}`);

await page.screenshot({ path: new URL("./actionbar_paging.png", import.meta.url).pathname });

console.log("\nconsole errors:", errors.length ? errors : "none");
if (errors.length) process.exitCode = 1;
await browser.close();
console.log(process.exitCode ? "\nRESULT: FAILED" : "\nRESULT: PASSED");
