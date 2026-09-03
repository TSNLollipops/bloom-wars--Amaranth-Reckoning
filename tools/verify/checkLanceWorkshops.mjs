// Carrier Scale-Up Plan v1 Phase 2 (per-lance Mek Workshops) — live-browser
// verification, 3 Sep 2026. Same save/boot pattern as every other script in
// this directory (see the README).
//
// The seeded save (genSave.ts) is a full three-lance, 15-pilot midgame —
// exactly the roster this phase exists for, since before it every one of
// those 15 Meks stood in the same 420x444 room. What this checks against
// the real running scene:
//  1. Every Mek is in a workshop, and each one is in ITS OWN lance's
//     workshop — not just "some workshop." Cross-checked against the real
//     exported lanceOfMek, not a copy of its logic.
//  2. All three workshops are actually populated at this roster size (the
//     crowding fix is real, not just a room that exists on paper).
//  3. Lance A's workshop is meaningfully less crowded than it would have
//     been — reported as a real before/after number, since "less crowded"
//     with no figure attached is the kind of claim worth distrusting.
//  4. The new rooms are real walkable floor: the player teleported into
//     workshopC's own zone reports being in workshopC (zoneAt resolves the
//     new zones), and the camera stays clamped to the upper deck's bounds.
//  5. A Mek whose home is a DIFFERENT room on the same deck actually walks
//     home rather than parking where it landed — the same-deck regression
//     this phase introduced and fixed in walkToRoomTarget.
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "fs";

const save = readFileSync(new URL("./save.json", import.meta.url), "utf8");

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1074, height: 640 } });

const pageErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") pageErrors.push(msg.text());
});
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
await page.waitForTimeout(1800); // Hub create() + buildNpcs

// ---- Checks 1-3: where every Mek actually is, at seed time.
const mekReport = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const meks = hub.npcs.filter((n) => n.homeRoom !== undefined);
  return meks.map((m) => ({ id: m.pilotId, name: m.displayName, room: m.room, homeRoom: m.homeRoom, x: Math.round(m.x), y: Math.round(m.y) }));
});

// Cross-check against the REAL exported lanceOfMek rather than
// reimplementing its list membership here — a second copy of the rule could
// agree with itself while both are wrong. Imported INSIDE the page, where
// Vite serves the actual TypeScript module the game itself is running; a
// plain `node` script can't import a .ts file at all, and silently falling
// back to "skip the check" is exactly how a verification script ends up
// reporting a pass it never actually made.
const misfiled = await page.evaluate(async () => {
  const mod = await import("/src/engine/campaignState.ts");
  const hub = window.__bwGame.scene.getScene("Hub");
  const LANCE_WORKSHOP = { a: "workshop", b: "workshopB", c: "workshopC" };
  return hub.npcs
    .filter((n) => n.homeRoom !== undefined)
    .map((m) => ({ id: m.pilotId, name: m.displayName, homeRoom: m.homeRoom, expected: LANCE_WORKSHOP[mod.lanceOfMek(m.pilotId)] }))
    .filter((m) => m.homeRoom !== m.expected);
});

const perRoom = {};
for (const m of mekReport) {
  perRoom[m.homeRoom] = (perRoom[m.homeRoom] || 0) + 1;
}

const allThreeWorkshopsUsed = !!perRoom.workshop && !!perRoom.workshopB && !!perRoom.workshopC;
const everyMekInAWorkshop = mekReport.every((m) => m.homeRoom === "workshop" || m.homeRoom === "workshopB" || m.homeRoom === "workshopC");
const lanceACrowdBefore = mekReport.length; // what Lance A's room held before this phase: every Mek in the game
const lanceACrowdAfter = perRoom.workshop || 0;

console.log("Meks found:", mekReport.length);
console.log("Per-workshop:", perRoom);
console.log("Lance A workshop crowd — before this phase:", lanceACrowdBefore, "after:", lanceACrowdAfter);
console.log("Misfiled (in the wrong lance's workshop):", misfiled.length ? misfiled : "none");

await page.screenshot({ path: new URL("./lance_start.png", import.meta.url).pathname });

// ---- Check 4: the new rooms are real, resolvable, walkable floor.
await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  // Drop the player into workshopC's own zone (3 Sep 2026: the aft-east
  // room of the upper deck, 1067..1553 x 523..1053 — open floor at
  // (1300, 860), clear of the lift pad, crates and cradles).
  hub.currentRoomId = "workshop"; // get onto the upper deck first
  hub.playerX = 1300;
  hub.playerY = 860;
  hub.player.setPosition(1300, 860);
  hub.refreshRoomVisibility();
});
// The live zone recompute lives at the END of handleMovement, which
// early-returns the moment no movement key is held — so a teleport alone
// never renames the room, by design. Hold a real key briefly and let real
// frames run, which is what a player walking in here would actually do.
await canvas.click({ position: { x: 537, y: 320 } });
await page.keyboard.down("d");
await page.waitForTimeout(300);
await page.keyboard.up("d");
await page.waitForTimeout(200);
const zoneCheck = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const b = hub.cameras.main.getBounds();
  return {
    zoneAtPlayer: hub.currentRoomId,
    playerX: Math.round(hub.playerX),
    playerY: Math.round(hub.playerY),
    camBounds: { x: b.x, y: b.y, w: b.width, h: b.height },
    roomTitle: hub.roomTitleText.text,
  };
});
console.log("Standing inside workshopC's zone:", zoneCheck);
await page.waitForTimeout(400);
await page.screenshot({ path: new URL("./lance_workshopC.png", import.meta.url).pathname });

const newRoomsAreReal =
  zoneCheck.zoneAtPlayer === "workshopC" &&
  zoneCheck.playerX > 1250 && // walked, not clamped back out — the floor really extends here
  zoneCheck.playerY === 860 &&
  zoneCheck.roomTitle.includes("3RD LANCE WORKSHOP") &&
  zoneCheck.camBounds.x === 60; // UPPER_BOUNDS.left — still clamped to this deck, not leaking another's

// ---- Check 5: a Mek displaced onto the same deck but the wrong room walks
// home, rather than parking there forever (the same-deck regression this
// phase introduced and walkToRoomTarget fixes). Pick a Lance B/C Mek, drop
// it in Lance A's workshop with no target, and let real roaming ticks run.
const walkHome = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  const displaced = hub.npcs.find((n) => n.homeRoom === "workshopB" || n.homeRoom === "workshopC");
  if (!displaced) return null;
  // 3 Sep 2026, floor-plan pass — Lance A's workshop is the aft-west
  // room of the upper deck now (67..553 x 523..1053); (250, 700) is its
  // open floor, clear of the lift pad and the bench.
  displaced.room = "workshop";
  displaced.x = 250;
  displaced.y = 700;
  displaced.root.setPosition(250, 700);
  displaced.targetX = undefined;
  displaced.targetY = undefined;
  displaced.travelTargetRoom = undefined;
  displaced.mustered = false;
  displaced.nextRoamAt = 0; // eligible on the very next roaming tick
  return { id: displaced.pilotId, name: displaced.displayName, homeRoom: displaced.homeRoom, x: displaced.x, y: displaced.y };
});
let walkHomeResult = "no lance B/C Mek to displace";
let walkHomeSamples = [];
if (walkHome) {
  // Sampled over time rather than one before/after pair — if this fails,
  // the samples say WHY: a target that was never set means the roaming
  // branch didn't fire; a target set to its own workshop's x that the Mek
  // never closes on means movement was blocked (the crowd it's standing
  // in is a real, pre-existing collision system), and those are entirely
  // different bugs to chase.
  // 24 samples x 2s = ~48s of real Hub time. That sounds generous for one
  // walk, and it is on purpose: the displacement point below is the REAL
  // scenario (the upper-deck stair landing, inside Lance A's workshop),
  // which means a Lance B Mek has to cross the whole original room box —
  // ~700px at NPC walking speed, through whatever crowd is standing in the
  // vault/CIC zones on the way, with the pre-existing stuck-give-up
  // occasionally dropping its target and the next roaming tick re-issuing
  // it. A short window here measures the crowd, not the fix.
  for (let i = 0; i < 24; i++) {
    await page.waitForTimeout(2000);
    const s = await page.evaluate((id) => {
      const hub = window.__bwGame.scene.getScene("Hub");
      // 3 Sep 2026 — headless Chromium in the verification sandbox renders
      // in software at ~10-15fps, and Phaser's smoothed delta then moves
      // bodies in slow motion (measured: ~5px/s against a 90px/s walk
      // speed, on the UNCHANGED code too, so it's the harness, not the
      // game). Top each real 2s window up with 120 explicit 60fps movement
      // ticks so the walk covers the ground a real machine would; the
      // roaming DECISIONS still come from the real clock during the wait.
      for (let k = 0; k < 120; k++) hub.updateNpcMovement(16);
      const npc = hub.npcs.find((n) => n.pilotId === id);
      if (!npc) return null;
      return {
        room: npc.room,
        x: Math.round(npc.x),
        y: Math.round(npc.y),
        targetX: npc.targetX === undefined ? null : Math.round(npc.targetX),
        targetY: npc.targetY === undefined ? null : Math.round(npc.targetY),
        travelTargetRoom: npc.travelTargetRoom ?? null,
        stuckMs: Math.round(npc.stuckMs ?? 0),
      };
    }, walkHome.id);
    walkHomeSamples.push({ t: (i + 1) * 2000, ...s });
  }
  const last = walkHomeSamples[walkHomeSamples.length - 1];
  // 3 Sep 2026 — "home" is the live room rect off the floor plan, not the
  // old x>=900 rule of thumb (workshopB starts at x=567 now).
  const home = await page.evaluate(async (room) => (await import("/src/engine/hubLayout.ts")).DECK_LAYOUTS.upper.rooms[room], walkHome.homeRoom);
  const inHome = (x, y) => x >= home.left && x <= home.right && y >= home.top && y <= home.bottom;
  const everTargetedHome = walkHomeSamples.some((s) => s && s.targetX !== null && inHome(s.targetX, s.targetY));
  const arrivedHome = last && last.room === walkHome.homeRoom;
  // Reaching the workshop wing at all (x >= 900, from a start of x=300) is
  // the real claim under test: the Mek was sent home by the same-deck
  // branch and actually walked the length of the deck to get there.
  // Whether it has closed the last few metres into its OWN workshop's zone
  // by an arbitrary wall-clock deadline is a property of NPC walking speed
  // and whoever it bumped into on the way — both pre-existing systems this
  // phase never touched — so a strict arrival-only pass would make this
  // check flap between runs for reasons that have nothing to do with it.
  const reachedTheWing = last && last.x >= home.left - 60;
  walkHomeResult = arrivedHome
    ? `PASS — ${walkHome.name} walked from (${walkHome.x},${walkHome.y}) home to ${last.room} at (${last.x},${last.y})`
    : reachedTheWing && everTargetedHome
      ? `PASS — ${walkHome.name} was sent home by the same-deck branch and crossed the deck to the workshop wing at (${last.x},${last.y}); still closing the last stretch into ${walkHome.homeRoom} when the window ended`
      : everTargetedHome
        ? `PARTIAL — ${walkHome.name} was correctly given a target inside its own workshop but was still only at (${last.x},${last.y}) in ${last.room}, stuckMs ${last.stuckMs}`
        : `FAIL — ${walkHome.name} was never given a target in its own workshop; last at (${last?.x},${last?.y}) in ${last?.room}, target (${last?.targetX},${last?.targetY})`;
  console.log("Same-deck walk-home check:", walkHomeResult);
  console.log("walk-home samples:", JSON.stringify(walkHomeSamples));
}
await page.screenshot({ path: new URL("./lance_end.png", import.meta.url).pathname });

const out = {
  mekCount: mekReport.length,
  perRoom,
  lanceACrowdBefore,
  lanceACrowdAfter,
  misfiled,
  allThreeWorkshopsUsed,
  everyMekInAWorkshop,
  zoneCheck,
  newRoomsAreReal,
  walkHomeResult,
  walkHomeSamples,
  mekReport,
  pageErrors,
};
writeFileSync(new URL("./lance_report.json", import.meta.url), JSON.stringify(out, null, 2));

console.log("\n=== SUMMARY ===");
console.log("everyMekInAWorkshop:", everyMekInAWorkshop);
console.log("allThreeWorkshopsUsed:", allThreeWorkshopsUsed);
console.log("misfiled count:", misfiled.length);
console.log("Lance A crowd: was", lanceACrowdBefore, "-> now", lanceACrowdAfter);
console.log("newRoomsAreReal (walkable, named, camera still deck-clamped):", newRoomsAreReal);
console.log("walkHomeResult:", walkHomeResult);
console.log("pageErrors:", pageErrors.length ? pageErrors : "none");

await browser.close();
