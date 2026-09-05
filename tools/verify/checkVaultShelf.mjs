// One-off Playwright verification (3 Sep 2026) — cloud-sandbox-only, not
// shipped. Vault Phase 2 Slice 2: the field/unfield toggle and the
// live-ability rank-up shop added to Hub.ts's renderVault(). Boots the
// real game against tools/verify/vault_save.json (genVaultSave.ts — a
// recruited-but-unfielded "iron_oath" Heirloom, holder funded with enough
// personal points for one rank-up), opens the real Vault overlay via the
// scene's own openVault(), locates the real on-screen [ field ] and
// [ rank up ] buttons by reading their actual Phaser Text objects out of
// window.__bwGame, and clicks them with real mouse events at their real
// screen coordinates — not just calling the handler methods directly —
// so a missing setInteractive()/depth/scrollFactor bug would show up here.
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "fs";

const save = readFileSync(new URL("./vault_save.json", import.meta.url).pathname, "utf8");

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

await page.mouse.click(box.x + 480, box.y + 300); // MainMenu CONTINUE
await page.waitForTimeout(1500); // Hub scene create()

const sceneReady = await page.evaluate(() => {
  const g = window.__bwGame;
  if (!g) return "no __bwGame";
  const hub = g.scene.getScene("Hub");
  if (!hub) return "no Hub scene";
  return hub.scene.isActive() ? "active" : "inactive:" + hub.scene.settings.status;
});
console.log("Hub scene status:", sceneReady);
if (sceneReady !== "active") throw new Error("Hub scene not active: " + sceneReady);

// Open the Vault overlay via the scene's own real method — equivalent to
// clicking the Vault room, without needing to know that room's live pixel
// position on this particular map/deck layout.
const openResult = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  hub.openVault();
  return { vaultOpen: hub.vaultOpen, visible: hub.vaultOverlay.visible };
});
console.log("openVault():", openResult);
await page.waitForTimeout(200);
await page.screenshot({ path: new URL("./vault_before.png", import.meta.url).pathname });

async function readVaultButtons() {
  return page.evaluate(() => {
    const hub = window.__bwGame.scene.getScene("Hub");
    const out = [];
    for (const obj of hub.vaultOverlay.list) {
      if (obj.type === "Text" && typeof obj.text === "string") {
        out.push({ text: obj.text, x: obj.x, y: obj.y, w: obj.width, h: obj.height, interactive: !!obj.input });
      }
    }
    return out;
  });
}

function findButton(rows, label) {
  return rows.find((r) => r.text === label);
}

async function clickCanvasLocal(x, y) {
  await page.mouse.click(box.x + x, box.y + y);
}

async function readHeirloomState() {
  return page.evaluate(() => {
    const hub = window.__bwGame.scene.getScene("Hub");
    const state = hub.campaignState;
    const hs = state.heirlooms ?? {};
    const holderId = hs.assignedPilotId?.iron_oath;
    return {
      fielded: hs.fielded,
      recruited: hs.recruited,
      holderId,
      holderPersonalPoints: holderId ? state.pilots[holderId]?.personalPoints : undefined,
      ironWordRank: hs.abilityRanks?.["iron_oath:oath_iron_word"] ?? 1,
    };
  });
}

const before = await readHeirloomState();
console.log("state before:", before);
if (before.fielded === "iron_oath") throw new Error("expected iron_oath to start unfielded — genVaultSave.ts changed?");
if (before.ironWordRank !== 1) throw new Error("expected oath_iron_word to start at rank 1");

let rows = await readVaultButtons();
console.log(
  "\nVault overlay text rows:\n" + rows.map((r) => `  "${r.text}" @(${Math.round(r.x)},${Math.round(r.y)}) interactive=${r.interactive}`).join("\n"),
);

const fieldBtn = findButton(rows, "[ field ]");
if (!fieldBtn) throw new Error("[ field ] button not found in the rendered Vault overlay — holder not active, or renderVault didn't render it");
if (!fieldBtn.interactive) throw new Error("[ field ] button found but has no interactive input — setInteractive() missing?");

console.log(`\nClicking [ field ] at (${fieldBtn.x + 4}, ${fieldBtn.y + fieldBtn.h / 2})`);
await clickCanvasLocal(fieldBtn.x + 4, fieldBtn.y + fieldBtn.h / 2);
await page.waitForTimeout(300);

const afterField = await readHeirloomState();
console.log("state after field click:", afterField);
if (afterField.fielded !== "iron_oath") throw new Error(`FAIL: clicking [ field ] did not field iron_oath (fielded=${afterField.fielded})`);

rows = await readVaultButtons();
const fieldedTitle = rows.find((r) => r.text.includes("[FIELDED]"));
console.log("[FIELDED] tag present after re-render:", !!fieldedTitle, fieldedTitle?.text);
if (!fieldedTitle) throw new Error("FAIL: renderVault() did not re-render the [FIELDED] tag after a successful field()");

const unfieldBtn = rows.find((r) => r.text === "[ unfield ]");
if (!unfieldBtn) throw new Error("FAIL: button did not flip to [ unfield ] after fielding");

// Pick the [ rank up ] on the IRON WORD row, not simply the first one.
//
// Fixed 3 Sep 2026. This check used to take rows.find(text === "[ rank up ]")
// — the first such button on the shelf — and then assert about
// oath_iron_word. Vindex (oath_oathkeeper) is listed above Iron Word and is
// ALSO in HEIRLOOM_ABILITIES_LIVE_IN_COMBAT, so it has its own rank-up
// button and that is the one the click was landing on. The purchase worked
// perfectly every time: it ranked Vindex to 2 and debited exactly 250,
// which is why the points assertion passed while the rank assertion failed.
//
// Worth being clear about, because the failure looked alarming: the game
// was never wrong here. A player was never charged for nothing. The check
// was clicking one button and grading another, and it has been doing that
// since the shelf shipped — a green run of this file was, on this one
// assertion, telling nobody anything.
const ironWordRow = rows.find((r) => r.text.startsWith("Iron Word"));
if (!ironWordRow) throw new Error("Iron Word row not found on the shelf — did the ability list change?");
const rankBtn = rows
  .filter((r) => r.text === "[ rank up ]")
  .sort((a, b) => Math.abs(a.y - ironWordRow.y) - Math.abs(b.y - ironWordRow.y))[0];
if (!rankBtn) throw new Error("[ rank up ] button not found — holder personalPoints/live-ability gating wrong?");
if (Math.abs(rankBtn.y - ironWordRow.y) > 12) {
  throw new Error(`the nearest [ rank up ] is ${Math.round(Math.abs(rankBtn.y - ironWordRow.y))}px from the Iron Word row — rows no longer line up, so this check cannot tell which button belongs to which ability`);
}
if (!rankBtn.interactive) throw new Error("[ rank up ] button found but has no interactive input");

console.log(`\nClicking [ rank up ] at (${rankBtn.x + 4}, ${rankBtn.y + rankBtn.h / 2})`);
await clickCanvasLocal(rankBtn.x + 4, rankBtn.y + rankBtn.h / 2);
await page.waitForTimeout(300);

const afterRank = await readHeirloomState();
console.log("state after rank-up click:", afterRank);
if (afterRank.ironWordRank !== 2) throw new Error(`FAIL: oath_iron_word rank did not advance to 2 (got ${afterRank.ironWordRank})`);
if (afterRank.holderPersonalPoints !== before.holderPersonalPoints - 250) {
  throw new Error(`FAIL: personalPoints not debited correctly (before=${before.holderPersonalPoints}, after=${afterRank.holderPersonalPoints})`);
}

await page.screenshot({ path: new URL("./vault_after_field_rank.png", import.meta.url).pathname });

// Now click [ unfield ] to exercise the other half of the toggle.
rows = await readVaultButtons();
const unfieldBtn2 = rows.find((r) => r.text === "[ unfield ]");
if (!unfieldBtn2) throw new Error("[ unfield ] button missing before unfield click");
console.log(`\nClicking [ unfield ] at (${unfieldBtn2.x + 4}, ${unfieldBtn2.y + unfieldBtn2.h / 2})`);
await clickCanvasLocal(unfieldBtn2.x + 4, unfieldBtn2.y + unfieldBtn2.h / 2);
await page.waitForTimeout(300);

const afterUnfield = await readHeirloomState();
console.log("state after unfield click:", afterUnfield);
if (afterUnfield.fielded !== undefined) throw new Error(`FAIL: [ unfield ] click did not clear fielded (got ${afterUnfield.fielded})`);

// Reload the page fresh (simulating relaunch) and confirm the rank + the
// unfielded state actually persisted via saveCampaignState(), not just
// held in the live scene.
await page.evaluate(() => {
  const raw = window.localStorage.getItem("bloomwars_campaign_state_v1");
  window.__persistedCheck = JSON.parse(raw);
});
const persisted = await page.evaluate(() => {
  const s = window.__persistedCheck;
  const hs = s.heirlooms ?? {};
  return { fielded: hs.fielded, ironWordRank: hs.abilityRanks?.["iron_oath:oath_iron_word"] ?? 1 };
});
console.log("\nlocalStorage after both clicks (persistence check):", persisted);
if (persisted.ironWordRank !== 2) throw new Error("FAIL: rank-up did not persist to localStorage");
if (persisted.fielded !== undefined) throw new Error("FAIL: unfield did not persist to localStorage");

console.log("\nconsole/page errors seen:", errors.length ? errors : "none");

const summary = { sceneReady, before, afterField, afterRank, afterUnfield, persisted, consoleErrors: errors };
writeFileSync(new URL("./vault_shelf_report.json", import.meta.url).pathname, JSON.stringify(summary, null, 2));

console.log("\n=== ALL CHECKS PASSED ===");

await browser.close();
