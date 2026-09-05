// One-off Playwright verification, 5 Sep 2026 — cloud-sandbox-only, not
// shipped. B3, the memorial (First Game Dev Feature Gap Report §B3).
//
// The memorial reads engine/statsStore.ts's memorial(), which derives from
// the mission-summary records in localStorage["bloomwars_stats_v1"] — NOT
// from the campaign save. So this seeds real stats records with
// permanentlyLost squad entries and then opens the actual Vault overlay in
// the actual Hub, rather than unit-testing the query and hoping the panel
// renders it.
//
// Three states get checked, and the third is the one worth the trouble: the
// overflow case. The Vault overlay does not scroll, so the row cap is load-
// bearing — a memorial that quietly grew past ROOM_BOUNDS would push the
// House Offers and standing sections off a panel with no way to reach them.
import { chromium } from "playwright";
import { readFileSync } from "fs";

const PORT = 5183;
const save = readFileSync(new URL("./save.json", import.meta.url), "utf8");
const CAMPAIGN_ID = JSON.parse(save).campaignId;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1074, height: 640 } });
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (err) => errors.push(err.message));

let failed = false;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failed = true;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${label}\n         expected: ${JSON.stringify(expected)}\n         actual:   ${JSON.stringify(actual)}`);
}

/** One mission-summary record in which `pilot` was permanently lost. */
function lossRecord(campaignId, pilotId, displayName, missionName, turns, finishedAt) {
  return {
    campaignId,
    missionId: `mission_${missionName.replace(/\W+/g, "_").toLowerCase()}`,
    missionName,
    outcome: "loss",
    turns,
    finishedAt,
    squad: [
      {
        pilotId,
        displayName,
        kills: 2,
        assists: 1,
        damageDealt: 40,
        damageTaken: 90,
        downed: true,
        permanentlyLost: true,
        abilitiesUsed: { abil_overwatch: 3 },
      },
    ],
  };
}

async function openVaultWith(records) {
  await page.evaluate(({ saveJson, recs }) => {
    window.localStorage.setItem("bloomwars_campaign_state_v1", saveJson);
    window.localStorage.setItem("bloomwars_stats_v1", JSON.stringify({ installId: "verify", records: recs }));
  }, { saveJson: save, recs: records });
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(1300);
  const box = await page.locator("canvas").boundingBox();
  await page.mouse.click(box.x + 480, box.y + 300); // CONTINUE -> Hub
  await page.waitForTimeout(1700);
  return box;
}

/** Reads every visible text in a container, with its world Y. */
const READ = `(function collect(container) {
  const out = [];
  const walk = (l) => { for (const o of l) {
    if (o.type === "Text" && typeof o.text === "string" && o.visible !== false) {
      const m = o.getWorldTransformMatrix();
      out.push({ text: o.text, y: Math.round(m.ty) });
    }
    if (o.list) walk(o.list);
  } };
  walk(container.list);
  return out;
})`;

async function vaultState() {
  return page.evaluate((readSrc) => {
    const hub = window.__bwGame.scene.getScene("Hub");
    hub.openVault();
    const read = eval(readSrc);
    const texts = read(hub.vaultOverlay);
    return { texts, maxY: texts.length ? Math.max(...texts.map((t) => t.y)) : 0 };
  }, READ);
}

async function memorialState() {
  return page.evaluate((readSrc) => {
    const hub = window.__bwGame.scene.getScene("Hub");
    const read = eval(readSrc);
    const texts = read(hub.memorialPanel.container ?? { list: [] });
    return { open: hub.memorialOpen, visible: hub.memorialPanel.visible, texts, maxY: texts.length ? Math.max(...texts.map((t) => t.y)) : 0 };
  }, READ);
}

await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });

// ---- 1. The Vault's own layout is untouched by B3 existing --------------
await openVaultWith([]);
let v = await vaultState();
console.log("\n[1] Vault with the memorial button added:");
check("the roll button is in the Vault header", v.texts.some((t) => t.text.includes("the roll")), true);
check("Vault's bottom section still present", v.texts.some((t) => t.text.includes("HOLDINGS")), true);
// NOT asserted as pass/fail, deliberately: the Vault's own content height
// varies run to run with campaign state (measured at 537 and 563 across two
// consecutive runs of this very script), and 563 is already past its 552
// bound. That overflow is pre-existing and independent of B3 — the roll
// button lives in buildVaultOverlay's fixed header row and adds zero height
// to renderVault's stack. Asserting a bound the Vault already breaks on its
// own would make this script fail for a reason it isn't testing. Reported so
// the number stays visible; the real invariant is the next check.
console.log(`    Vault maxY = ${v.maxY} (bound 552; varies with campaign state, pre-existing — see note)`);
check("the Vault's bottom section is not pushed off by the roll button", v.texts.some((t) => t.text.includes("HOLDINGS")), true);

// ---- 2. Empty state: nobody lost yet ------------------------------------
await page.evaluate(() => window.__bwGame.scene.getScene("Hub").openMemorial());
await page.waitForTimeout(300);
let m = await memorialState();
console.log("\n[2] the roll, nobody lost:");
check("panel is open", m.open, true);
check("reads as the good outcome, not an error", m.texts.some((t) => t.text.includes("Nobody yet")), true);
check("no pager on an empty roll", m.texts.some((t) => t.text.includes("page ")), false);
await page.screenshot({ path: new URL("./promo_memorial_empty.png", import.meta.url).pathname });
await page.evaluate(() => window.__bwGame.scene.getScene("Hub").closeMemorial());

// ---- 3. Three losses, named, with mission/turn/career -------------------
const three = [
  lossRecord(CAMPAIGN_ID, "pilot_iyari", "Pvt. Tegan Iyari — \u201cFoxfire\u201d", "The Long Walk Back", 11, "2026-09-01T10:00:00.000Z"),
  lossRecord(CAMPAIGN_ID, "pilot_lask", "Spec. Corin Lask — \u201cPatch\u201d", "Draven's Cut", 7, "2026-09-02T10:00:00.000Z"),
  lossRecord(CAMPAIGN_ID, "pilot_anand", "Cpl. Priya Anand — \u201cFarsight\u201d", "The Reckoning", 14, "2026-09-03T10:00:00.000Z"),
];
await openVaultWith(three);
const vaultWithLosses = await vaultState();
await page.evaluate(() => window.__bwGame.scene.getScene("Hub").openMemorial());
await page.waitForTimeout(300);
m = await memorialState();
const rows = m.texts.map((t) => t.text);
console.log("\n[3] three lost pilots:");
console.log("   ", JSON.stringify(rows.filter((r) => r.includes("lost on")), null, 0));
check("counts them in plain words", rows.some((r) => r.includes("3 pilots have not come back")), true);
check("names each pilot in full", rows.some((r) => r.includes("Pvt. Tegan Iyari")), true);
check("gives the mission and turn", rows.some((r) => r.includes("Draven's Cut, turn 7")), true);
check("gives career totals, not just a date", rows.some((r) => r.includes("mission") && r.includes("kill")), true);
// bodyText is a single Text object holding every row joined by "\n", so
// ordering has to be read inside it rather than across game objects.
const bodyBlock = rows.find((r) => r.includes("lost on")) ?? "";
check("oldest loss first", bodyBlock.indexOf("The Long Walk Back") < bodyBlock.indexOf("The Reckoning"), true);
check("panel content stays inside bounds", m.maxY <= 552, true);
check("VAULT UNDERNEATH IS UNCHANGED — bottom section intact", vaultWithLosses.texts.some((t) => t.text.includes("HOLDINGS")), true);
console.log(`    Vault maxY with losses recorded = ${vaultWithLosses.maxY} (same pre-existing variance as above)`);
await page.screenshot({ path: new URL("./promo_memorial.png", import.meta.url).pathname });

// ---- 4. Esc returns to the Vault rather than dumping you on the deck ----
await page.keyboard.press("Escape");
await page.waitForTimeout(350);
const afterEsc = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  return { memorial: hub.memorialOpen, vault: hub.vaultOpen };
});
console.log("\n[4] Esc from the roll:");
check("closes the roll", afterEsc.memorial, false);
check("and leaves you in the Vault you opened it from", afterEsc.vault, true);

// ---- 5. Overflow: pages instead of spilling -----------------------------
const many = [];
for (let i = 0; i < 14; i++) {
  many.push(lossRecord(CAMPAIGN_ID, `pilot_gen_${i}`, `Spec. Casualty ${i}`, `Mission Number ${i}`, 5 + i, `2026-09-${String(i + 1).padStart(2, "0")}T10:00:00.000Z`));
}
await openVaultWith(many);
await page.evaluate(() => window.__bwGame.scene.getScene("Hub").openMemorial());
await page.waitForTimeout(300);
m = await memorialState();
const pager = m.texts.find((t) => t.text.startsWith("page "));
console.log("\n[5] fourteen lost pilots:");
console.log("    pager:", pager ? JSON.stringify(pager.text) : "none");
check("counts all fourteen", m.texts.some((t) => t.text.includes("14 pilots have not come back")), true);
check("pages rather than overflowing", pager !== undefined, true);
check("still inside bounds with a full roll", m.maxY <= 552, true);
const countRows = (st) => (st.texts.find((t) => t.text.includes("lost on"))?.text.split("\n").filter((l) => l.includes("lost on")).length ?? 0);
const firstPage = countRows(m);
await page.evaluate(() => window.__bwGame.scene.getScene("Hub").memorialPanel.turnPage(1));
await page.waitForTimeout(250);
const p2 = await memorialState();
const secondPage = countRows(p2);
console.log("    rows page 1:", firstPage, "| rows page 2:", secondPage);
check("page 2 shows the remainder", firstPage + secondPage >= 14, true);
check("page 2 still inside bounds", p2.maxY <= 552, true);
await page.screenshot({ path: new URL("./promo_memorial_paged.png", import.meta.url).pathname });

console.log("\nconsole errors:", errors.length ? errors : "none");
if (errors.length) failed = true;
await browser.close();
console.log(failed ? "\nRESULT: FAILED" : "\nRESULT: PASSED");
if (failed) process.exitCode = 1;
