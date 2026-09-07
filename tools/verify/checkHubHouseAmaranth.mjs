// House Amaranth Hub — live verification, 6 Sep 2026 (Build Plan step 5,
// claude/Bloom_Wars_House_Amaranth_Hub_Build_Plan_v1.md). Same save/boot
// pattern as every other script here (see the README), against a House
// Amaranth save (genHouseAmaranthSave.ts) so baseSceneKeyFor routes
// CONTINUE into the "HubHouseAmaranth" scene — the same Hub class as
// Warden's, running the HOUSE_AMARANTH_FACILITY profile.
//
// What it proves, in order:
// 1. The save lands in the Greathouse, not the Antfarm, and the title bar
//    says so.
// 2. The cast is the estate's: Verinis in the Control Room, the three
//    Longhouse regulars seated, Orin roaming, every 1st-Lance Mek in
//    Cultivar Works — 1st Lance, Marrow NOT on the floor (she's the player),
//    and every body standing on walkable floor.
// 3. Every stair is reachable by real tryMove() walking from another room
//    on its floor (checkHubDoorReachability.mjs's own method), both ways.
// 4. Every walk-up point triggers its own isAt*() check when the player is
//    stood on it.
// 5. Each floor's camera clamps to that floor's bounds, and a screenshot of
//    each floor is written (hub_ha_<deck>.png) for the eyeball pass.
// 6. A short roam sample: nobody strands (stuckMs), nobody piles.
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "fs";

const SCENE = "HubHouseAmaranth";
const save = readFileSync(new URL("./save_house_amaranth.json", import.meta.url), "utf8");

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
await page.waitForTimeout(2000);

const failures = [];
const check = (ok, msg) => {
  console.log(`${ok ? "PASS" : "FAIL"} — ${msg}`);
  if (!ok) failures.push(msg);
};

// 1. Which scene are we in?
const landing = await page.evaluate((SCENE) => {
  const game = window.__bwGame;
  const ha = game.scene.getScene(SCENE);
  const warden = game.scene.getScene("Hub");
  return {
    haActive: game.scene.isActive(SCENE),
    wardenActive: game.scene.isActive("Hub"),
    title: ha.roomTitleText?.text ?? null,
    deckLine: ha.deckIndicatorText?.text ?? null,
    room: ha.currentRoomId,
    wardenHasNpcs: Array.isArray(warden.npcs) && warden.npcs.length > 0,
  };
}, SCENE);
check(landing.haActive && !landing.wardenActive, `CONTINUE on a House Amaranth save lands in ${SCENE} (Warden's Hub not active)`);
check(typeof landing.title === "string" && landing.title.startsWith("THE GREATHOUSE — "), `title bar reads the estate's name: "${landing.title}"`);
check(landing.deckLine === "FLOOR: GROUND FLOOR", `HUD level line is "FLOOR: GROUND FLOOR" (got "${landing.deckLine}")`);
check(landing.room === "recroom", `player spawns in the Longhouse (recroom), got ${landing.room}`);
check(!landing.wardenHasNpcs, "Warden's Hub instance built no NPCs (it was never started)");

// 2. The cast.
const cast = await page.evaluate(async (SCENE) => {
  const nav = await import("/src/engine/hubNav.ts");
  const hub = window.__bwGame.scene.getScene(SCENE);
  return hub.npcs.map((n) => ({
    id: n.pilotId,
    name: n.displayName,
    room: n.room,
    home: n.homeRoom ?? null,
    walkable: nav.isWalkable(hub.roomDeckOf(n.room), n.x, n.y, 16),
    x: Math.round(n.x),
    y: Math.round(n.y),
  }));
}, SCENE);
const byId = Object.fromEntries(cast.map((c) => [c.id, c]));
console.log("cast:", cast.map((c) => `${c.name}@${c.room}`).join(" | "));
check(byId.npc_co && byId.npc_co.name === "Brig. Verinis Amaranth" && byId.npc_co.room === "controlRoom", "Verinis is the CO, standing in the Control Room");
for (const id of ["pilot_vondra", "pilot_meir", "pilot_bray"]) check(byId[id] && byId[id].room === "recroom", `${id} seated in the Longhouse`);
check(byId.pilot_orin !== undefined, "Orin is on the floor (roaming)");
check(byId.pilot_marrow === undefined, "Marrow is NOT a walkable NPC (she is the player)");
const meks = cast.filter((c) => c.id.startsWith("mek_"));
check(meks.length >= 5, `at least the five 1st-Lance Meks are on the floor (${meks.length})`);
check(meks.every((m) => m.room.startsWith("workshop") && m.home === m.room), "every Mek stands in a Cultivar Works and calls it home");
check(cast.every((c) => c.walkable), "every body stands on walkable floor");
check(!cast.some((c) => /^pilot_(rourke|bosk|anand|iyari|lask)$/.test(c.id)), "no Warden pilot leaked onto the estate floor");

// 3. Stairs, both ways, by real walking.
const doors = await page.evaluate((SCENE) => {
  const hub = window.__bwGame.scene.getScene(SCENE);
  return hub.doorMarkers.map((m) => ({ id: m.def.id, room: m.def.room, x: m.def.x, y: m.def.y, toRoom: m.def.toRoom, label: m.def.label }));
}, SCENE);
check(doors.length === 6, `six stairs on the live table (${doors.length}): ${doors.map((d) => d.id).join(", ")}`);
// Remember where everyone stands: the stair walks park every NPC far off
// the floor (so a body can't mask a real reachability miss), once PER door.
const parked = await page.evaluate((SCENE) => window.__bwGame.scene.getScene(SCENE).npcs.map((n) => ({ x: n.x, y: n.y })), SCENE);
for (const door of doors) {
  const outcome = await page.evaluate(
    async ({ SCENE, door }) => {
      const nav = await import("/src/engine/hubNav.ts");
      const layout = await import("/src/engine/hubLayout.ts");
      const hub = window.__bwGame.scene.getScene(SCENE);
      const deck = hub.roomDeckOf(door.room);
      const rooms = Object.keys(layout.DECK_LAYOUTS[deck].rooms).filter((r) => r !== door.room && !r.endsWith("Hall"));
      const fromRoom = rooms[0] ?? door.room;
      const r = layout.DECK_LAYOUTS[deck].rooms[fromRoom];
      const start = layout.resolveAgainstSolids(deck, (r.left + r.right) / 2, (r.top + r.bottom) / 2, 15);
      hub.currentRoomId = door.room;
      for (const npc of hub.npcs) {
        npc.x -= 6000;
        npc.y -= 6000;
        npc.root.setPosition(npc.x, npc.y);
      }
      hub.playerX = start.x;
      hub.playerY = start.y;
      hub.player.setPosition(start.x, start.y);
      const path = nav.findPath(deck, start.x, start.y, door.x, door.y, 15);
      if (path === null) return { fromRoom, noRoute: true, hitId: null, dist: -1 };
      for (const wp of [...path, { x: door.x, y: door.y }]) {
        let lastX = null;
        let lastY = null;
        let stalled = 0;
        for (let i = 0; i < 600; i++) {
          const dx = Math.max(-6, Math.min(6, wp.x - hub.playerX));
          const dy = Math.max(-6, Math.min(6, wp.y - hub.playerY));
          if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) break;
          hub.tryMove(dx, 0);
          hub.tryMove(0, dy);
          if (hub.playerX === lastX && hub.playerY === lastY) {
            if (++stalled > 5) break;
          } else stalled = 0;
          lastX = hub.playerX;
          lastY = hub.playerY;
        }
      }
      hub.player.setPosition(hub.playerX, hub.playerY);
      hub.currentRoomId = layout.roomAt(deck, hub.playerX, hub.playerY);
      const at = hub.isAtDoor();
      return { fromRoom, noRoute: false, hitId: at ? at.id : null, dist: Math.round(Math.hypot(hub.playerX - door.x, hub.playerY - door.y)), waypoints: path.length };
    },
    { SCENE, door },
  );
  check(outcome.hitId === door.id, `${door.id} (${door.label}) reachable from ${outcome.fromRoom}: ${outcome.noRoute ? "NO ROUTE" : `${outcome.waypoints} waypoint(s), ${outcome.dist}px off, isAtDoor -> ${outcome.hitId}`}`);
}

// Then actually take each stair with the real switchRoom and confirm the
// landing room + deck.
for (const door of doors) {
  const landed = await page.evaluate(
    ({ SCENE, door }) => {
      const hub = window.__bwGame.scene.getScene(SCENE);
      const def = hub.doorMarkers.find((m) => m.def.id === door.id).def;
      hub.currentRoomId = door.room;
      hub.playerX = door.x;
      hub.playerY = door.y;
      hub.switchRoom(def);
      return { room: hub.currentRoomId, deck: hub.roomDeckOf(hub.currentRoomId), deckLine: hub.deckIndicatorText.text };
    },
    { SCENE, door },
  );
  check(landed.room === door.toRoom, `taking ${door.id} lands in ${door.toRoom} (${landed.deck}, HUD "${landed.deckLine}") — got ${landed.room}`);
}

// Put every NPC back exactly where they stood before the stair walks,
// before anything below reads a position.
await page.evaluate(
  ({ SCENE, parked }) => {
    const hub = window.__bwGame.scene.getScene(SCENE);
    hub.npcs.forEach((npc, i) => {
      npc.x = parked[i].x;
      npc.y = parked[i].y;
      npc.root.setPosition(npc.x, npc.y);
    });
  },
  { SCENE, parked },
);

// 4. Walk-up points.
const walkups = await page.evaluate((SCENE) => {
  const hub = window.__bwGame.scene.getScene(SCENE);
  const p = hub.f.points;
  const tryAt = (room, pt, fn) => {
    hub.currentRoomId = room;
    hub.playerX = pt.x;
    hub.playerY = pt.y;
    return { room, pt, ok: !!hub[fn]() };
  };
  return {
    roster: tryAt("hangarDeck", p.hangarShop, "isAtHangarShop"),
    records: tryAt("hangarDeck", p.crewRecords, "isAtCrewRecords"),
    bay: tryAt("hangarDeck", p.muster, "isAtBay"),
    board: tryAt("recroom", p.recroomBoard, "isAtStandingsBoard"),
    bench: tryAt("workshop", p.workshopBench, "isAtWorkshopBench"),
    plinth: tryAt("vault", p.vaultPlinth, "isAtVaultPlinth"),
    coNear: (() => {
      hub.currentRoomId = "controlRoom";
      hub.playerX = p.co.x + 30;
      hub.playerY = p.co.y;
      const co = hub.npcs.find((n) => n.pilotId === "npc_co");
      return { ok: Math.hypot(co.x - hub.playerX, co.y - hub.playerY) < 60, room: co.room };
    })(),
  };
}, SCENE);
for (const [k, v] of Object.entries(walkups)) check(v.ok, `walk-up ${k} triggers in ${v.room}`);

// 5. Per-floor camera clamp + screenshots.
const floors = await page.evaluate(async (SCENE) => {
  const layout = await import("/src/engine/hubLayout.ts");
  const hub = window.__bwGame.scene.getScene(SCENE);
  const out = [];
  for (const deck of hub.f.deckOrder) {
    const rooms = Object.keys(layout.DECK_LAYOUTS[deck].rooms);
    const room = rooms.find((r) => !r.endsWith("Hall")) ?? rooms[0];
    const rect = layout.DECK_LAYOUTS[deck].rooms[room];
    hub.currentRoomId = room;
    hub.playerX = (rect.left + rect.right) / 2;
    hub.playerY = (rect.top + rect.bottom) / 2;
    hub.player.setPosition(hub.playerX, hub.playerY);
    hub.refreshRoomVisibility();
    const b = hub.cameras.main.getBounds();
    const want = layout.DECK_LAYOUTS[deck].bounds;
    out.push({ deck, room, title: hub.roomTitleText.text, deckLine: hub.deckIndicatorText.text, clampOk: b.x === want.left && b.y === want.top && b.right === want.right && b.bottom === want.bottom });
  }
  return out;
}, SCENE);
for (const f of floors) check(f.clampOk, `camera clamps to ${f.deck}'s bounds (${f.title} / ${f.deckLine})`);

// The header row: the centred title must clear the FLOOR: readout on its
// left and the Day readout on its right in EVERY room — the estate's long
// flavour names are what made Hub.fitRoomTitle necessary.
const headerFit = await page.evaluate((SCENE) => {
  const hub = window.__bwGame.scene.getScene(SCENE);
  const out = [];
  for (const room of hub.f.rooms) {
    hub.currentRoomId = room;
    hub.refreshRoomVisibility();
    const t = hub.roomTitleText;
    const left = t.x - t.width / 2;
    const right = t.x + t.width / 2;
    const leftLimit = hub.deckIndicatorText.x + hub.deckIndicatorText.width;
    const rightLimit = hub.calendarDayText.x - hub.calendarDayText.width;
    out.push({ room, text: t.text, size: t.style.fontSize, ok: left > leftLimit && right < rightLimit, left: Math.round(left), leftLimit: Math.round(leftLimit) });
  }
  return out;
}, SCENE);
const headerBad = headerFit.filter((h) => !h.ok);
check(headerBad.length === 0, `title bar clears both readouts in all ${headerFit.length} rooms${headerBad.length ? ` — overlapping: ${headerBad.map((h) => `${h.room} (${h.text} @${h.size})`).join(", ")}` : ""}`);
console.log("smallest title font used:", headerFit.map((h) => h.size).sort()[0], "| e.g.", headerFit.find((h) => h.room === "workshopB")?.text);

for (const deck of floors.map((f) => f.deck)) {
  await page.evaluate(
    async ({ SCENE, deck }) => {
      const layout = await import("/src/engine/hubLayout.ts");
      const hub = window.__bwGame.scene.getScene(SCENE);
      const rooms = Object.keys(layout.DECK_LAYOUTS[deck].rooms);
      const room = rooms.find((r) => !r.endsWith("Hall")) ?? rooms[0];
      const rect = layout.DECK_LAYOUTS[deck].rooms[room];
      hub.currentRoomId = room;
      hub.playerX = (rect.left + rect.right) / 2;
      hub.playerY = (rect.top + rect.bottom) / 2;
      hub.player.setPosition(hub.playerX, hub.playerY);
      hub.refreshRoomVisibility();
      // Look at the floor's centre for the screenshot.
      const b = layout.DECK_LAYOUTS[deck].bounds;
      hub.cameras.main.centerOn((b.left + b.right) / 2, (b.top + b.bottom) / 2);
    },
    { SCENE, deck },
  );
  await page.waitForTimeout(400);
  await page.screenshot({ path: new URL(`./hub_ha_${deck}.png`, import.meta.url).pathname });
}

// 6. Roam sample.
await page.evaluate((SCENE) => {
  const hub = window.__bwGame.scene.getScene(SCENE);
  hub.currentRoomId = "recroom";
  hub.playerX = hub.f.points.playerSpawn.x;
  hub.playerY = hub.f.points.playerSpawn.y;
  hub.player.setPosition(hub.playerX, hub.playerY);
  hub.refreshRoomVisibility();
}, SCENE);
const samples = [];
for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(5000);
  samples.push(
    await page.evaluate((SCENE) => {
      const hub = window.__bwGame.scene.getScene(SCENE);
      return hub.npcs.map((n) => ({ id: n.pilotId, room: n.room, x: n.x, y: n.y, stuckMs: n.stuckMs ?? 0 }));
    }, SCENE),
  );
}
const stuck = new Set();
const moved = {};
for (const s of samples) for (const n of s) if (n.stuckMs > 2000) stuck.add(n.id);
for (const n of samples[0]) {
  const last = samples[samples.length - 1].find((m) => m.id === n.id);
  moved[n.id] = Math.round(Math.hypot(last.x - n.x, last.y - n.y));
}
check(stuck.size === 0, `no NPC stuck > 2s over a 30s roam sample${stuck.size ? ` — stuck: ${[...stuck].join(", ")}` : ""}`);
check(moved.npc_co === 0, "Verinis holds his post (never roams)");
console.log("moved (px over 30s):", Object.entries(moved).map(([k, v]) => `${k}:${v}`).join(" "));

const report = { landing, cast, doors, walkups, floors, moved, stuck: [...stuck], failures, pageErrors };
writeFileSync(new URL("./hub_house_amaranth_report.json", import.meta.url), JSON.stringify(report, null, 2));
console.log("\n=== SUMMARY ===");
console.log(`${failures.length === 0 ? "ALL PASS" : `${failures.length} FAILURE(S)`}`);
if (failures.length) for (const f of failures) console.log("  -", f);
console.log("pageErrors:", pageErrors.length ? pageErrors : "none");
await browser.close();
process.exit(failures.length === 0 ? 0 : 1);
