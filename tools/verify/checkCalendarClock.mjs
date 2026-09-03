// One-off Playwright verification pass, 2 Sep 2026 — cloud-sandbox-only,
// not shipped. Same save/boot pattern as checkSocialActions.mjs.
//
// Verifies the calendar economy
// (claude/Bloom_Wars_Calendar_Economy_Build_Proposal_v2_RealTimeClock.md) in
// a real running browser. Deliberately scoped to what unit tests CANNOT
// cover — engine/__tests__/calendarClock.test.ts already pins the arithmetic
// with a fake frame loop, and re-asserting that here would prove nothing new.
// What only a live browser can answer:
//
// 1. Phaser's REAL update loop actually drives the clock. The unit tests call
//    tickCalendar by hand; nothing there proves Hub.update is wired to it, or
//    that a real ~16ms browser delta survives MAX_TICK_DELTA_MS's stall guard
//    (a guard that is exactly the kind of thing that silently rejects every
//    real frame if the threshold is wrong).
// 2. The rate is right end-to-end — real elapsed wall-clock maps to the
//    expected number of days at MS_PER_CALENDAR_DAY.
// 3. The clock keeps running with the CHAT BOX OPEN. Hub.update returns early
//    for chat and every minigame overlay, and the tick was placed above those
//    returns on purpose ("the calandar run when you play. no matter what you
//    do"). A regression that moved it below would pass every unit test.
// 4. A real chat-driven verb charges its accent through logVerbAndCharge —
//    the 13-call-site refactor, exercised through the actual chat UI rather
//    than by calling the helper directly.
// 5. The HUD readout exists and renders a real day.
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "fs";

const DIR = new URL(".", import.meta.url).pathname.replace(/\/$/, ""); // this script's own folder — was a hardcoded sandbox path (fixed 3 Sep 2026)
const save = readFileSync(`${DIR}/save.json`, "utf8");

// Must match engine/calendarClock.ts. Duplicated rather than imported: this
// is a plain .mjs script with no TS pipeline, same as every other script
// here. If the constant moves and this doesn't, the rate assertion below
// fails loudly — which is the correct outcome, not a maintenance trap.
const MS_PER_CALENDAR_DAY = 360_000;
const SHARE_A_DRINK_COST = 0.25;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1074, height: 640 } });

const pageErrors = [];
page.on("console", (msg) => { if (msg.type() === "error") pageErrors.push(msg.text()); });
page.on("pageerror", (err) => pageErrors.push(err.message));

await page.addInitScript((saveJson) => {
  window.localStorage.setItem("bloomwars_campaign_state_v1", saveJson);
}, save);

await page.goto("http://localhost:5183/", { waitUntil: "load" });
await page.waitForTimeout(1500);

const canvas = page.locator("canvas");
const box = await canvas.boundingBox();
if (!box) throw new Error("no canvas found");

await page.mouse.click(box.x + 480, box.y + 300); // CONTINUE
await page.waitForTimeout(1500);

const report = {};

report.sceneStatus = await page.evaluate(() => {
  const hub = window.__bwGame?.scene.getScene("Hub");
  return hub ? (hub.scene.isActive() ? "active" : "inactive:" + hub.scene.settings.status) : "no Hub";
});
console.log("Hub scene status:", report.sceneStatus);
await page.screenshot({ path: `${DIR}/calendar_start.png` });

const rawDay = () => page.evaluate(() => window.__bwGame.scene.getScene("Hub").campaignState.calendarDay);

// The seeded save predates the calendar entirely, so this also exercises the
// real backfill path through loadCampaignState rather than a synthetic state.
report.dayOnLoad = await rawDay();
console.log("calendarDay on load (backfilled):", report.dayOnLoad);

// ---- 1 + 2. The real Phaser loop drives the clock, at the right rate -----
{
  const before = await rawDay();
  const t0 = Date.now();
  await page.waitForTimeout(12_000);
  const elapsedMs = Date.now() - t0;
  const after = await rawDay();

  const observed = after - before;
  const expected = elapsedMs / MS_PER_CALENDAR_DAY;
  report.rateCheck = {
    elapsedMs,
    observedDays: observed,
    expectedDays: expected,
    // Ratio rather than absolute delta: it stays meaningful whatever the
    // sample window is, and it's the number that tells you WHICH way a
    // failure went (0 = never ticking, ~2 = double-ticking).
    ratio: observed / expected,
  };
  console.log("rate check:", report.rateCheck);
}

// ---- 3. The clock keeps running while the chat box owns input ------------
{
  const input = page.locator("input[placeholder^='Type something']");
  let opened = false;
  for (let attempt = 0; attempt < 6 && !opened; attempt++) {
    await page.keyboard.press("t");
    try {
      await input.waitFor({ state: "visible", timeout: 1500 });
      opened = true;
    } catch {
      await page.waitForTimeout(200);
    }
  }
  if (!opened) throw new Error("chat box never opened for the overlay-tick check");

  const before = await rawDay();
  const t0 = Date.now();
  await page.waitForTimeout(6_000);
  const elapsedMs = Date.now() - t0;
  const after = await rawDay();

  report.ticksWithChatOpen = {
    chatOpen: await page.evaluate(() => window.__bwGame.scene.getScene("Hub").chatOpen),
    elapsedMs,
    observedDays: after - before,
    ratio: (after - before) / (elapsedMs / MS_PER_CALENDAR_DAY),
  };
  console.log("ticks with chat open:", report.ticksWithChatOpen);

  await input.press("Escape");
  await page.waitForTimeout(300);
}

// ---- helpers, mirroring checkSocialActions.mjs's own conventions ---------
async function sayInChat(text) {
  const input = page.locator("input[placeholder^='Type something']");
  for (let attempt = 0; attempt < 6; attempt++) {
    await page.keyboard.press("t");
    try {
      await input.waitFor({ state: "visible", timeout: 1500 });
      await input.fill(text);
      await input.press("Enter");
      await page.waitForTimeout(200);
      return;
    } catch {
      await page.waitForTimeout(200);
    }
  }
  throw new Error(`sayInChat: chat box never became visible for: ${text}`);
}

// Setup-only poke, same convention as checkSocialActions.mjs: put one target
// on the player and everyone else far away so the unnamed-verb target
// resolves unambiguously.
async function isolateNpcOnPlayer(pilotId) {
  return page.evaluate((pilotId) => {
    const hub = window.__bwGame.scene.getScene("Hub");
    let room = null;
    for (const n of hub.npcs) {
      if (n.pilotId === "npc_co") continue;
      if (n.pilotId === pilotId) {
        n.room = hub.currentRoomId;
        n.x = hub.playerX;
        n.y = hub.playerY;
        room = n.room;
      } else {
        n.x = -5000;
        n.y = -5000;
      }
    }
    return room;
  }, pilotId);
}

const targetId = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  return hub.npcs.find((n) => n.pilotId !== "npc_co")?.pilotId ?? null;
});
report.targetPilotId = targetId;

/**
 * Run one chat line and separate the accent from the time that passed while
 * saying it. The clock never stops, so a raw before/after delta always
 * contains both — subtracting the measured elapsed time is what isolates the
 * verb's own charge.
 */
async function measureVerb(line) {
  await isolateNpcOnPlayer(targetId);
  const before = await rawDay();
  const t0 = Date.now();
  await sayInChat(line);
  await page.waitForTimeout(400);
  const elapsedMs = Date.now() - t0;
  const after = await rawDay();
  const timeComponent = elapsedMs / MS_PER_CALENDAR_DAY;
  return {
    line,
    rawDelta: after - before,
    timeComponent,
    accent: (after - before) - timeComponent,
    lastLog: await page.evaluate(() => {
      const log = window.__bwGame.scene.getScene("Hub").chatLog;
      return log[log.length - 1];
    }),
  };
}

// ---- 4. A free verb charges nothing; a priced one charges its accent -----
report.freeVerb = await measureVerb("you did great out there");
console.log("free verb (praise):", report.freeVerb);

report.pricedVerb = await measureVerb("lets share a drink");
console.log("priced verb (share a drink):", report.pricedVerb);

// ---- 5. The HUD readout is real and renders a real day ------------------
report.hudReadout = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const t = hub.calendarDayText;
  if (!t) return { present: false };
  return { present: true, text: t.text, x: t.x, y: t.y, visible: t.visible };
});
console.log("HUD readout:", report.hudReadout);

// ---- 6. It survives the real save path ----------------------------------
// No manual save poke needed: the Share a Drink above goes through Hub's own
// verb path, which already calls saveCampaignState. Reading localStorage
// straight afterwards therefore tests the REAL persistence path rather than
// one this script triggered artificially.
report.persisted = await page.evaluate(() => {
  const raw = window.localStorage.getItem("bloomwars_campaign_state_v1");
  return raw ? JSON.parse(raw).calendarDay : null;
});
report.liveAtSave = await rawDay();
console.log("persisted calendarDay:", report.persisted, "live:", report.liveAtSave);

report.pageErrors = pageErrors;
await page.screenshot({ path: `${DIR}/calendar_end.png` });
writeFileSync(`${DIR}/calendar_report.json`, JSON.stringify(report, null, 2));

// ---- verdict ------------------------------------------------------------
const problems = [];
const near = (v, target, tol) => Math.abs(v - target) <= tol;

if (!near(report.rateCheck.ratio, 1, 0.15)) problems.push(`clock rate off: ratio ${report.rateCheck.ratio}`);
if (!near(report.ticksWithChatOpen.ratio, 1, 0.15)) problems.push(`clock stalls with chat open: ratio ${report.ticksWithChatOpen.ratio}`);
if (Math.abs(report.freeVerb.accent) > 0.01) problems.push(`free verb charged ${report.freeVerb.accent}`);
if (!near(report.pricedVerb.accent, SHARE_A_DRINK_COST, 0.02)) problems.push(`priced verb accent ${report.pricedVerb.accent}, expected ${SHARE_A_DRINK_COST}`);
if (!report.hudReadout.present || !/^Day \d+$/.test(report.hudReadout.text || "")) problems.push(`HUD readout wrong: ${JSON.stringify(report.hudReadout)}`);
if (report.persisted === null) problems.push("calendarDay did not persist");
if (pageErrors.length) problems.push(`page errors: ${pageErrors.join(" | ")}`);

console.log(problems.length ? "\nPROBLEMS:\n" + problems.map((p) => " - " + p).join("\n") : "\nALL CHECKS PASSED");
writeFileSync(`${DIR}/calendar_report.json`, JSON.stringify({ ...report, problems }, null, 2));

await browser.close();
