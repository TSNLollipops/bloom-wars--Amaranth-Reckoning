// Frame Systems Layer, Tier 1 — live-browser verification (6 Sep 2026).
// Cloud-sandbox-only, not shipped. Same save/boot pattern as
// checkHangarShopFitsDock.mjs: seed localStorage, boot a real scene, drive
// the REAL Phaser input (page.mouse.click at a text object's own bounds —
// never a direct call into the verb), and read the live CampaignState back
// out of the scene to confirm each click did what the label said.
//
// Covers, in order, on the Hangar (standalone shop) scene:
//   1. the [ FRAME ] link on Bosk's shop card opens the overlay
//   2. MOUNT Riot Drum fills mount 2 (tier C = two mounts) — the live state's
//      equippedWeaponBranches reads both, the legacy single field reads mount 1
//   3. BUY Reinforced Plating deducts 120 and lands in ownedFrameSystems
//   4. INSTALL Reinforced Plating lands in equippedFrameSystems and the
//      header's Draw readout moves 0/6 -> 2/6
//   5. Wellroot Filament is BUYable (one kill on the books), Gallcyst Graft is listed+LOCKED, Struts listed; the doc's Heartwood
//      Graft is absent from the overlay (re-sourced to Gallcyst, 6 Sep 2026)
//   6. every text object in the overlay sits inside the 130..830 panel and
//      the 640px canvas — the exact clipping class of bug this project has
//      already shipped once (ShopPanel.fitWidth's own header)
// Then on the Hub: opens the Hangar Deck shop, opens Rourke's [ FRAME ]
// (tier A -> the REFIT row), confirms the overlay still fits inside Hub's
// 838px main-camera viewport, buys the Breacher Frame refit for real, and
// confirms Esc-closing the shop takes the overlay with it.
import { chromium } from "playwright";
import { readFileSync } from "fs";

const save = readFileSync(new URL("./frame_save.json", import.meta.url).pathname, "utf8");
const DOCK_SPLIT_X = 838;
const PANEL_L = 130;
const PANEL_R = 830;
let failed = false;
const fail = (msg) => {
  console.error("FAIL:", msg);
  failed = true;
};
const ok = (msg) => console.log("ok —", msg);

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1074, height: 640 } });
await page.addInitScript((s) => window.localStorage.setItem("bloomwars_campaign_state_v1", s), save);
await page.goto("http://localhost:5183/", { waitUntil: "load" });
await page.waitForTimeout(1500);

/**
 * Text objects in the given scene, with bounds. `overlayOnly` restricts the
 * walk to the Frame overlay's own container (the one holding a text that
 * starts with "FRAME — ") — necessary because the shop card UNDER the
 * overlay carries some of the same labels ("MOUNT Riot Drum" is on both),
 * and this harness's first run clicked the card's copy, which the overlay's
 * backdrop correctly swallowed. A real finding about the test, not the UI.
 */
const textsIn = (sceneKey, overlayOnly = false) =>
  page.evaluate(
    ({ key, overlayOnly }) => {
      const sc = window.__bwGame.scene.getScene(key);
      const out = [];
      const walk = (obj) => {
        if (obj.type === "Text" && obj.text && obj.visible) {
          const b = obj.getBounds();
          out.push({ text: obj.text, x: b.x, y: b.y, w: b.width, h: b.height });
        }
        if (obj.list) for (const c of obj.list) walk(c);
      };
      if (overlayOnly) {
        const isOverlay = (c) => c.list && c.list.some((o) => o.type === "Text" && typeof o.text === "string" && o.text.startsWith("FRAME — "));
        for (const child of sc.children.list) if (isOverlay(child)) walk(child);
      } else {
        for (const child of sc.children.list) walk(child);
      }
      return out;
    },
    { key: sceneKey, overlayOnly }
  );

const clickText = async (sceneKey, needle, overlayOnly = true) => {
  const texts = await textsIn(sceneKey, overlayOnly);
  const hit = texts.find((t) => t.text.includes(needle));
  if (!hit) {
    fail(`no on-screen text containing "${needle}"`);
    return false;
  }
  await page.mouse.click(hit.x + hit.w / 2, hit.y + hit.h / 2);
  await page.waitForTimeout(250);
  return true;
};

const pilotState = (sceneKey, pilotId) =>
  page.evaluate(
    ({ key, id }) => {
      const sc = window.__bwGame.scene.getScene(key);
      const st = sc.state ?? sc.campaignState;
      const e = st.pilots[id];
      return {
        points: e.personalPoints,
        owned: e.pilot.ownedFrameSystems ?? [],
        installed: e.pilot.equippedFrameSystems ?? [],
        mounts: e.pilot.equippedWeaponBranches ?? [],
        legacyMount: e.pilot.equippedWeaponBranch ?? null,
        refit: e.pilot.frameRefit ?? null,
      };
    },
    { key: sceneKey, id: pilotId }
  );

// ---------------------------------------------------------------- Hangar
await page.evaluate(() => window.__bwGame.scene.start("Hangar"));
await page.waitForTimeout(1200);

// Bosk's card is on page 1 in a 10-pilot roster? Page until his [ FRAME ] link is on screen.
for (let i = 0; i < 6; i++) {
  const texts = await textsIn("Hangar");
  const bosk = texts.find((t) => t.text.startsWith("Bosk") || t.text.includes("Bosk"));
  if (bosk) break;
  if (!(await clickText("Hangar", "NEXT >"))) break;
}
const cardTexts = await textsIn("Hangar");
const boskName = cardTexts.find((t) => t.text.includes("Bosk"));
if (!boskName) fail("Bosk's shop card never came on screen");
// The [ FRAME ] link on his card sits at his card's top + 44 — find the frame link nearest below his name.
const frameLinks = cardTexts.filter((t) => t.text.startsWith("[ FRAME"));
const boskLink = frameLinks.find((t) => boskName && Math.abs(t.y - boskName.y) < 60);
if (!boskLink) fail("no [ FRAME ] link on Bosk's card");
else {
  ok(`Bosk's card shows "${boskLink.text}"`);
  if (!boskLink.text.includes("Draw 0/6") || !boskLink.text.includes("mounts 1/2")) fail(`expected Draw 0/6 and mounts 1/2 on the card link, got "${boskLink.text}"`);
  await page.mouse.click(boskLink.x + boskLink.w / 2, boskLink.y + boskLink.h / 2);
  await page.waitForTimeout(300);
}

let overlay = await textsIn("Hangar", true);
if (!overlay.some((t) => t.text.startsWith("FRAME — ") && t.text.includes("Bosk"))) fail("Frame overlay header for Bosk not on screen after clicking [ FRAME ]");
else ok("Frame overlay opened for Bosk");
await page.screenshot({ path: new URL("./frame_panel_bosk_open.png", import.meta.url).pathname });

// 2. MOUNT Riot Drum
await clickText("Hangar", "MOUNT Riot Drum");
let s = await pilotState("Hangar", "pilot_bosk");
if (s.mounts.join(",") !== "tank_grinder_claw,tank_riot_drum") fail(`after MOUNT Riot Drum, equippedWeaponBranches = ${JSON.stringify(s.mounts)}`);
else ok("Riot Drum mounted alongside Grinder Claw — two live branches");
if (s.legacyMount !== "tank_grinder_claw") fail(`legacy equippedWeaponBranch should still be mount 1 (Grinder Claw), got ${s.legacyMount}`);
overlay = await textsIn("Hangar", true);
if (!overlay.some((t) => t.text.includes("Mounts 2/2"))) fail("header does not read Mounts 2/2 after mounting");

// 3. BUY Reinforced Plating (120)
{
  const rows = await textsIn("Hangar", true);
  const name = rows.find((t) => t.text.startsWith("Reinforced Plating ["));
  const buy = rows.filter((t) => t.text.startsWith("BUY (")).find((t) => name && Math.abs(t.y - name.y) < 12);
  if (!name || !buy) fail("Reinforced Plating row or its BUY button not found");
  else {
    await page.mouse.click(buy.x + buy.w / 2, buy.y + buy.h / 2);
    await page.waitForTimeout(250);
  }
}
s = await pilotState("Hangar", "pilot_bosk");
if (s.points !== 2000 - 120) fail(`expected 1880 pts after buying Reinforced Plating, got ${s.points}`);
else ok("Reinforced Plating bought for 120");
if (!s.owned.includes("frame_reinforced_plating")) fail("ownedFrameSystems missing frame_reinforced_plating");

// 4. INSTALL it
{
  const rows = await textsIn("Hangar", true);
  // "[" excludes the feedback line ("Reinforced Plating bought — ..."), which this harness's own second run matched instead of the row.
  const name = rows.find((t) => t.text.startsWith("Reinforced Plating ["));
  const install = rows.filter((t) => t.text.startsWith("INSTALL (")).find((t) => name && Math.abs(t.y - name.y) < 12);
  if (!name || !install) fail(`Reinforced Plating's INSTALL button not found after purchase — rows near it: ${rows.filter((t) => name && Math.abs(t.y - name.y) < 30).map((t) => `"${t.text.slice(0, 30)}"@${t.x.toFixed(0)},${t.y.toFixed(0)}`).join(" | ")}`);
  else {
    if (!install.text.includes("2 Draw")) fail(`INSTALL label should say 2 Draw, got "${install.text}"`);
    await page.mouse.click(install.x + install.w / 2, install.y + install.h / 2);
    await page.waitForTimeout(250);
  }
}
s = await pilotState("Hangar", "pilot_bosk");
if (!s.installed.includes("frame_reinforced_plating")) fail("equippedFrameSystems missing frame_reinforced_plating after INSTALL");
else ok("Reinforced Plating installed");
overlay = await textsIn("Hangar", true);
if (!overlay.some((t) => t.text.includes("Draw 2/6"))) fail("header does not read Draw 2/6 after installing a 2-Draw system");
else ok("header reads Draw 2/6");

// 5. salvage visibility
if (!overlay.some((t) => t.text.startsWith("Wellroot Filament ["))) fail("Wellroot Filament row missing (one Wellroot kill is on the books)");
else {
  const name = overlay.find((t) => t.text.startsWith("Wellroot Filament ["));
  const buy = overlay.filter((t) => t.text.startsWith("BUY (")).find((t) => Math.abs(t.y - name.y) < 12);
  if (!buy) fail("Wellroot Filament should be BUYable with 1 kill recorded");
  else ok("Wellroot Filament is buyable after its one kill");
  if (!name.text.includes("[2+1 Draw]")) fail(`Wellroot Filament should show the non-Runemaster surcharge, got "${name.text}"`);
  else ok("Wellroot Filament shows the +1 Draw surcharge on Bosk's armorer loadout");
}
// Second pass, 6 Sep 2026: the doc's Heartwood Graft became Gallcyst Graft
// (a donor that actually spawns), so it must now be LISTED and LOCKED —
// no Gallcyst kill is on the books in frame_save.json — and Stabilizer
// Struts, built once the Fieldwright heal was wired, must be on the shelf.
if (overlay.some((t) => t.text.startsWith("Heartwood Graft"))) fail("Heartwood Graft still listed — it was re-sourced to Gallcyst on 6 Sep 2026");
{
  const graft = overlay.find((t) => t.text.startsWith("Gallcyst Graft ["));
  if (!graft) fail("Gallcyst Graft row missing (Gallcyst spawns in Warden — it must be listed, not hidden)");
  else {
    const locked = overlay.find((t) => t.y > graft.y - 4 && t.y < graft.y + 4 && t.text.startsWith("LOCKED"));
    if (!locked) fail("Gallcyst Graft should read LOCKED with no Gallcyst kill recorded");
    else ok(`Gallcyst Graft listed and locked ("${locked.text}")`);
  }
  if (!overlay.some((t) => t.text.startsWith("Stabilizer Struts ["))) fail("Stabilizer Struts row missing from SUPPORT");
  else ok("Stabilizer Struts on the shelf");
}

// 6. bounds — overlay's own text only
{
  const worstR = Math.max(...overlay.map((t) => t.x + t.w));
  const worstB = Math.max(...overlay.map((t) => t.y + t.h));
  const outside = overlay.filter((t) => t.x + t.w > PANEL_R + 1 || t.x < PANEL_L - 1);
  if (outside.length) fail(`overlay text outside the panel: ${outside.map((t) => `"${t.text}"@${t.x.toFixed(0)}..${(t.x + t.w).toFixed(0)}`).join(", ")}`);
  else ok(`every overlay label inside ${PANEL_L}..${PANEL_R} (rightmost ends ${worstR.toFixed(0)})`);
  if (worstB > 640) fail(`overlay text runs below the canvas: bottom at ${worstB.toFixed(0)}`);
  else ok(`overlay bottom at ${worstB.toFixed(0)}px, inside the 640px canvas`);
}
await page.screenshot({ path: new URL("./frame_panel_bosk_after.png", import.meta.url).pathname });

// close
await clickText("Hangar", "[ close ]");
overlay = await textsIn("Hangar", true);
if (overlay.some((t) => t.text.startsWith("FRAME — "))) fail("overlay still on screen after [ close ]");
else ok("overlay closed");
// the card link re-rendered with the new numbers
{
  const texts = await textsIn("Hangar");
  const link = texts.find((t) => t.text.startsWith("[ FRAME") && t.text.includes("Draw 2/6"));
  if (!link) fail("shop card's [ FRAME ] link did not re-render to Draw 2/6 · mounts 2/2");
  else ok(`shop card now reads "${link.text}"`);
}

// ---------------------------------------------------------------- Hub
await page.evaluate(() => window.__bwGame.scene.start("Hub"));
await page.waitForTimeout(2200);
await page.evaluate(() => window.__bwGame.scene.getScene("Hub").openHangarShop());
await page.waitForTimeout(500);
{
  // Rourke is first on page 1 of the Hub shop.
  const texts = await textsIn("Hub");
  // Rourke's card is the first pilot card in the Hub's shop; his link is the
  // first [ FRAME ] link in walk order, and reads Draw 0/10 (tier A).
  const link = texts.find((t) => t.text.startsWith("[ FRAME") && t.text.includes("0/10"));
  if (!link) fail(`no [ FRAME · Draw 0/10 ] link (Rourke, tier A) in the Hub shop — links seen: ${texts.filter((t) => t.text.startsWith("[ FRAME")).map((t) => t.text).join(" | ")}`);
  else {
    await page.mouse.click(link.x + link.w / 2, link.y + link.h / 2);
    await page.waitForTimeout(300);
  }
  const overlayHub = await textsIn("Hub", true);
  const header = overlayHub.find((t) => t.text.startsWith("FRAME — ") && t.text.includes("Rourke"));
  if (!header) fail("Frame overlay for Rourke not on screen in the Hub");
  else ok("Frame overlay opened from the Hub's Hangar Deck shop");
  const refitRow = overlayHub.find((t) => t.text.startsWith("REFIT — one permanent pick"));
  if (!refitRow) fail("tier-A Rourke should see the REFIT purchase row");
  else ok("REFIT row shown for a tier-A pilot");
  const worstR = Math.max(...overlayHub.filter((t) => t.y > 10).map((t) => t.x + t.w));
  if (worstR >= DOCK_SPLIT_X) fail(`Hub overlay text ends at ${worstR.toFixed(0)}, past the ${DOCK_SPLIT_X}px main-camera edge`);
  else ok(`Hub overlay fits the ${DOCK_SPLIT_X}px viewport (rightmost ${worstR.toFixed(0)})`);
  await page.screenshot({ path: new URL("./frame_panel_hub_rourke.png", import.meta.url).pathname });
  // buy the Breacher Frame refit
  const btn = overlayHub.find((t) => t.text === "REFIT: Breacher Frame");
  if (!btn) fail("REFIT: Breacher Frame button missing");
  else {
    await page.mouse.click(btn.x + btn.w / 2, btn.y + btn.h / 2);
    await page.waitForTimeout(300);
    const r = await pilotState("Hub", "pilot_rourke");
    if (r.refit !== "refit_meeps_breacher_frame") fail(`refit not recorded: ${r.refit}`);
    else ok(`Breacher Frame refit bought (${r.points} pts left)`);
    const after = await textsIn("Hub", true);
    if (!after.some((t) => t.text.startsWith("REFIT — Breacher Frame (permanent)"))) fail("overlay did not re-render to the permanent refit line");
  }
  // Esc closes the shop and must take the overlay with it
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  const afterEsc = await textsIn("Hub", true);
  if (afterEsc.some((t) => t.text.startsWith("FRAME — "))) fail("Frame overlay survived closing the Hangar Deck shop");
  else ok("Esc closed the shop and the Frame overlay with it");
  await page.screenshot({ path: new URL("./frame_panel_hub_closed.png", import.meta.url).pathname });
}

await browser.close();
process.exitCode = failed ? 1 : 0;
console.log(failed ? "\nRESULT: FAILED" : "\nRESULT: PASSED");

// ---------------------------------------------------------------- Transporter Pad (appended run)
// Re-uses the same browser session pattern in a fresh page so the state
// above (Bosk's install, Rourke's refit) doesn't matter here: what's being
// checked is only that the pad's own [ frame ] link opens the overlay and
// that a two-mount pilot's track line reads "A + B".
{
  const page2 = await (await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" })).newPage({ viewport: { width: 1074, height: 640 } });
  await page2.addInitScript((s) => window.localStorage.setItem("bloomwars_campaign_state_v1", s), save);
  await page2.goto("http://localhost:5183/", { waitUntil: "load" });
  await page2.waitForTimeout(1500);
  await page2.evaluate(() => {
    // Give Bosk both mounts up front so the pad shows the joined label.
    const raw = JSON.parse(window.localStorage.getItem("bloomwars_campaign_state_v1"));
    raw.pilots.pilot_bosk.pilot.equippedWeaponBranches = ["tank_grinder_claw", "tank_riot_drum"];
    window.localStorage.setItem("bloomwars_campaign_state_v1", JSON.stringify(raw));
    window.__bwGame.scene.start("TransporterPad", { missionId: "mission_amaranth_3" });
  });
  await page2.waitForTimeout(1500);
  const texts = await page2.evaluate(() => {
    const sc = window.__bwGame.scene.getScene("TransporterPad");
    const out = [];
    const walk = (obj) => {
      if (obj.type === "Text" && obj.text && obj.visible) {
        const b = obj.getBounds();
        out.push({ text: obj.text, x: b.x, y: b.y, w: b.width, h: b.height });
      }
      if (obj.list) for (const c of obj.list) walk(c);
    };
    for (const child of sc.children.list) walk(child);
    return out;
  });
  const track = texts.find((t) => t.text.includes("Weapon: Grinder Claw + Riot Drum"));
  if (!track) fail(`pad track line for a two-mount Bosk should read "Weapon: Grinder Claw + Riot Drum" — lines seen: ${texts.filter((t) => t.text.includes("Weapon:")).map((t) => t.text).join(" | ")}`);
  else ok("Transporter Pad shows both mounts on Bosk's track line");
  const link = texts.find((t) => t.text.startsWith("[ frame") && track && Math.abs(t.y - track.y) < 4);
  if (!link) fail("no [ frame ] link on Bosk's pad row");
  else {
    if (link.x + link.w > 1074) fail(`pad [ frame ] link runs off the canvas: ends at ${(link.x + link.w).toFixed(0)}`);
    await page2.mouse.click(link.x + link.w / 2, link.y + link.h / 2);
    await page2.waitForTimeout(300);
    const after = await page2.evaluate(() => {
      const sc = window.__bwGame.scene.getScene("TransporterPad");
      let found = false;
      const walk = (obj) => {
        if (obj.type === "Text" && typeof obj.text === "string" && obj.text.startsWith("FRAME — ") && obj.text.includes("Bosk")) found = true;
        if (obj.list) for (const c of obj.list) walk(c);
      };
      for (const child of sc.children.list) walk(child);
      return found;
    });
    if (!after) fail("Frame overlay did not open from the Transporter Pad");
    else ok("Frame overlay opened from the Transporter Pad");
    await page2.screenshot({ path: new URL("./frame_panel_pad.png", import.meta.url).pathname });
  }
  await page2.context().browser().close();
}
process.exitCode = failed ? 1 : 0;
console.log(failed ? "\nRESULT (with pad): FAILED" : "\nRESULT (with pad): PASSED");
