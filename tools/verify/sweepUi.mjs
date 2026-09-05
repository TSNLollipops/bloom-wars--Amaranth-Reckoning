// Whole-game UI sweep (3 Sep 2026) — cloud-sandbox-only, not shipped.
//
// Visits every screen and overlay in the game, screenshots each one, and runs
// auditUiText.mjs's geometry audit against the live Phaser display list at
// each stop. Written the day the Battle action bar was found rendering
// "6LAST RITES" as "BAST RITES" — live, on the game's most invested build,
// with 1965 unit tests passing. See auditUiText.mjs's header for why a
// machine measuring boxes is the only thing that finds that class of bug.
//
// This is the "run the full checklist together as one system" pass the EA
// Launch Plan's Week 1 has owed since 31 Aug, for the text-legibility slice
// of it specifically.
//
// Findings are a LINT, not a verdict. Some overlap is deliberate. Read the
// report next to the screenshots.
//
// Needs: `npx vite --port 5183 --strictPort` and
// `npx tsx tools/verify/genActionBarSave.ts` (a 3-lance midgame roster with
// an Heirloom recruited and fielded — the densest state to draw).
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { auditActiveScenes, findPaintedOver, readPng, changedPixelsIn } from "./auditUiText.mjs";

const SHOT_DIR = new URL("./ui_sweep/", import.meta.url).pathname;
mkdirSync(SHOT_DIR, { recursive: true });

const save = readFileSync(new URL("./actionbar_save.json", import.meta.url).pathname, "utf8");
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1074, height: 640 } });

const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push(e.message));

await page.addInitScript((s) => window.localStorage.setItem("bloomwars_campaign_state_v1", s), save);
await page.goto("http://localhost:5183/", { waitUntil: "load" });
await page.waitForTimeout(1800);

const findings = [];
const visited = [];
const skipped = [];

/** Go somewhere, screenshot it, audit it. `go` runs in the page. */
async function stop(name, go, { wait = 700 } = {}) {
  try {
    const r = typeof go === "function" && go.constructor.name === "AsyncFunction" ? await go() : await page.evaluate(go);
    if (r && r.skip) {
      skipped.push({ name, why: r.skip });
      return null;
    }
    await page.waitForTimeout(wait);
    await page.screenshot({ path: `${SHOT_DIR}${name}.png` });
    const found = await auditActiveScenes(page);

    // PAINTEDOVER — pixels, not geometry. See auditUiText.mjs's header.
    const po = await findPaintedOver(page, () => page.screenshot());
    const a = readPng(po.before), b = readPng(po.after);
    for (const box of po.boxes) {
      if (changedPixelsIn(a, b, box) <= 3) {
        found.push({ kind: "PAINTEDOVER", scene: box.scene, text: box.text,
          detail: `nothing this label drew reached the screen (box ${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.w)}x${Math.round(box.h)})` });
      }
    }
    for (const f of found) findings.push({ ...f, screen: name });
    visited.push({ name, findings: found.length });
    console.log(`  ${found.length ? String(found.length).padStart(2) + " !" : "  ."} ${name}`);
    return found;
  } catch (err) {
    skipped.push({ name, why: String(err.message || err).slice(0, 160) });
    console.log(`   x ${name} — ${String(err.message || err).slice(0, 90)}`);
    return null;
  }
}

const S = (key, data) => `() => { window.__bwGame.scene.start(${JSON.stringify(key)}${data ? ", " + JSON.stringify(data) : ""}); }`;
const evalFn = (src) => new Function("return " + src)();

console.log("\n=== menus and standalone scenes ===");
await stop("01_main_menu", evalFn(S("MainMenu")));
await stop("02_options", evalFn(S("Options", { returnScene: "MainMenu" })));
await stop("03_codex", evalFn(S("Codex", { returnScene: "MainMenu" })));
await stop("04_load_game", evalFn(S("LoadGame")));
await stop("05_campaign_setup", evalFn(S("CampaignSetup")));
await stop("06_map_select", evalFn(S("MapSelect")));
await stop("07_hangar", evalFn(S("Hangar")));
await stop("08_transporter_pad", evalFn(S("TransporterPad", { missionId: "mission_1a" })));

// The Codex is a stack of categories; each one lays out differently, and a
// single screenshot of the first tab proves nothing about the rest.
console.log("\n=== codex categories ===");
await page.evaluate(() => window.__bwGame.scene.start("Codex", { returnScene: "MainMenu" }));
await page.waitForTimeout(900);
const codexCats = await page.evaluate(() => {
  const c = window.__bwGame.scene.getScene("Codex");
  return (c.categories || c.CATEGORIES || []).map((x) => (typeof x === "string" ? x : x.id ?? x.key ?? x.displayName));
});
console.log("  categories found:", JSON.stringify(codexCats));

console.log("\n=== battle ===");
await stop(
  "10_battle_deploy",
  () => {
    window.__bwGame.scene.start("Battle", {
      missionId: "mission_1a",
      selectedPilotIds: ["pilot_heirloom_last_word", "pilot_thyns", "pilot_barasj", "pilot_nagori", "pilot_voss"],
    });
  },
  { wait: 1600 },
);
await stop("11_battle_unit_selected", () => {
  const b = window.__bwGame.scene.getScene("Battle");
  const u = b.mission.units.find((x) => x.pilotId === "pilot_heirloom_last_word") ?? b.mission.units.find((x) => x.side === "player");
  b.selectedUnitId = u.instanceId;
  b.render();
});
// Battle has no pause menu (ESC is cancelCurrent, and the shared MENU
// overlay is a Hub/MapSelect/Hangar/Debrief control) — the modal it DOES
// have is the end-turn confirmation, so that is what gets checked.
await stop("12_battle_end_turn_prompt", () => {
  const b = window.__bwGame.scene.getScene("Battle");
  // openEndTurnPrompt takes the units that still have actions left — the
  // real call site passes exactly this.
  const pending = b.mission.units.filter((u) => u.side === "player" && !u.downed && u.actionsRemaining > 0);
  if (!pending.length) return { skip: "no unit still has an action, so the prompt would never open" };
  b.openEndTurnPrompt(pending);
});

console.log("\n=== hub: decks ===");
await stop(
  "20_hub",
  () => {
    window.__bwGame.scene.start("Hub");
  },
  { wait: 2000 },
);
// There is no setDeck() to call: the Hub derives the current deck from
// currentRoomId (ROOM_DECK), so visiting a deck means standing in one of
// its rooms and asking it to refresh. One representative room per deck.
const DECK_ROOMS = { lower: "recroom", grotto: "grotto", upper: "workshop", sparRoom: "sparRoom" };
for (const [deck, room] of Object.entries(DECK_ROOMS)) {
  await stop(
    `21_hub_deck_${deck}`,
    new Function(
      "return () => { const h = window.__bwGame.scene.getScene('Hub'); h.currentRoomId = " +
        JSON.stringify(room) +
        "; h.refreshRoomVisibility(); }",
    )(),
    { wait: 900 },
  );
}

// Close whatever is open before opening the next thing. Without this the
// sweep stacked overlays — the Hangar Shop stayed open under History, under
// Highlights, under the Peg Board — and the PAINTEDOVER check then
// correctly reported the buried panel's labels as invisible, which they
// were, because of the harness rather than the game. 118 findings, none of
// them real. A sweep that creates its own bugs teaches you nothing.
const CLOSERS = ["closeHangarShop", "closeHistory", "closeHighlights", "closePegHelp", "closePegBoard",
  "closePokerHelp", "closePoker", "closeDartsHelp", "closeDarts", "closeWorkshop", "closeVault", "closeChat"];
const closeAll = new Function("return () => { const h = window.__bwGame.scene.getScene('Hub'); for (const fn of " +
  JSON.stringify(CLOSERS) + ") { try { if (typeof h[fn] === 'function') h[fn](); } catch (e) { void e; } } }")();

console.log("\n=== hub: overlays ===");
const hubOverlay = (fn) => async () => {
  await page.evaluate(closeAll);
  await page.waitForTimeout(120);
  return page.evaluate(new Function("return () => { const h = window.__bwGame.scene.getScene('Hub'); " + fn + " }")());
};
const anyNpc = "const npc = h.npcs?.find?.((n) => n && n.pilotId) ?? h.npcs?.[0]; if (!npc) return { skip: 'no npc on this deck' };";

await stop("30_hub_chat", hubOverlay("if (typeof h.openChat !== 'function') return { skip: 'no openChat' }; h.openChat();"));
await stop("31_hub_workshop", hubOverlay("if (typeof h.openWorkshop !== 'function') return { skip: 'no openWorkshop' }; h.openWorkshop();"));
await stop("32_hub_vault", hubOverlay("h.openVault();"));
await stop("33_hub_hangar_shop", hubOverlay("h.openHangarShop();"));
await stop("34_hub_history", hubOverlay(anyNpc + " h.openHistory(npc);"));
await stop("35_hub_highlights", hubOverlay(anyNpc + " h.openHighlights(npc);"));
await stop("36_hub_pegboard", hubOverlay(anyNpc + " h.startPegBoard(npc);"));
await stop("37_hub_pegboard_help", async () => page.evaluate(() => window.__bwGame.scene.getScene("Hub").togglePegHelp()));
await stop("38_hub_poker", hubOverlay(anyNpc + " h.startPoker(npc);"));
await stop("39_hub_poker_help", async () => page.evaluate(() => window.__bwGame.scene.getScene("Hub").togglePokerHelp()));
await stop("40_hub_darts", hubOverlay(anyNpc + " h.startDarts(npc);"));
await stop("41_hub_darts_help", async () => page.evaluate(() => window.__bwGame.scene.getScene("Hub").toggleDartsHelp()));

// ---------------------------------------------------------------------------
console.log("\n=== report ===");
const byKind = {};
for (const f of findings) byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;
console.log("screens visited:", visited.length, "| skipped:", skipped.length);
console.log("findings:", JSON.stringify(byKind));

const lines = [];
lines.push("# UI text-geometry sweep — " + new Date().toISOString());
lines.push("");
lines.push(`Screens visited: ${visited.length}. Skipped: ${skipped.length}. Findings: ${findings.length}.`);
lines.push("");
for (const kind of ["PAINTEDOVER", "OVERRUN", "OFFSCREEN", "COLLIDE"]) {
  const rows = findings.filter((f) => f.kind === kind);
  lines.push(`## ${kind} (${rows.length})`);
  lines.push("");
  if (!rows.length) lines.push("_none_");
  for (const r of rows) lines.push(`- **${r.screen}** \`${r.scene}\` — ${r.text} — ${r.detail}`);
  lines.push("");
}
if (skipped.length) {
  lines.push("## Screens not reached");
  lines.push("");
  for (const s of skipped) lines.push(`- **${s.name}** — ${s.why}`);
  lines.push("");
}
lines.push("## Console errors");
lines.push("");
lines.push(consoleErrors.length ? consoleErrors.map((e) => "- " + e).join("\n") : "_none_");
writeFileSync(`${SHOT_DIR}report.md`, lines.join("\n"));
console.log("console errors:", consoleErrors.length);
console.log("wrote", `${SHOT_DIR}report.md`);

await browser.close();
