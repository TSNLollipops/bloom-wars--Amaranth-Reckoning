// Carrier Scale-Up Plan v1 Phase 1, follow-on verification — 3 Sep 2026.
// Same save/boot pattern as every other script here (see the README).
//
// Direct answer to the gap the grotto-to-workshop hotfix exposed (see
// `claude/Bloom_Wars_Build_Log_Addendum_GrottoUpperStairUnreachable_03Sep2026.md`
// in the Project): none of the existing scripts ever actually walk to a
// door and confirm it triggers. `checkHubCameraScroll.mjs` proved the new
// floor is walkable and the camera clamps correctly; `checkHubInteraction
// AfterScroll.mjs` proved clicks still hit the right thing after the
// scroll-factor pass. Neither one asks "if I actually try to reach this
// specific stair marker, do I arrive close enough to use it?" — which is
// exactly the question the grotto's up-stair failed, silently, past
// `tsc`/`eslint`/1607 unit tests, because Hub.ts has none (it imports
// Phaser at module scope, so this class of bug is invisible to the
// automated suite no matter how many tests it grows).
//
// Deliberately does NOT hardcode the door table — it pulls the real one
// live off the running scene (`hub.doorMarkers.map(m => m.def)`), the same
// data `buildDoors()` drew the on-screen markers from and `isAtDoor()`
// checks against. A second, hand-copied table in this file could drift
// from `Hub.ts`'s own and agree with itself while both were wrong; reading
// it off the live instance means this check tests whatever DOORS actually
// contains today, automatically, forever — add a seventh door to the game
// and this script picks it up with no edit needed here.
//
// For each door: force the player into that door's room (bypassing the
// normal room-swap machinery on purpose — this test is about whether the
// FLOOR SHAPE lets you stand next to the marker, not about switchRoom's
// own transition logic, which the other scripts already exercise), park
// every NPC on that deck far out of the way (so a collision can't mask a
// real reachability miss, or fake a pass by nudging the player somewhere
// it shouldn't be), then call the REAL `tryMove(dx, dy)` — the exact method
// every WASD frame calls, which runs the exact `clampToDeckFloor` that
// broke the grotto's up-stair — repeatedly, stepping toward the door's own
// (x, y), until the player stops making progress. Then ask the scene's own
// `isAtDoor()` whether it recognizes that spot. No shortcuts: if the floor
// won't let the player get there, this fails exactly the way a real player
// would find out, just automated.
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
await page.waitForTimeout(1800);

const doors = await page.evaluate(() => {
  const hub = window.__bwGame.scene.getScene("Hub");
  return hub.doorMarkers.map((m) => ({ id: m.def.id, room: m.def.room, x: m.def.x, y: m.def.y, label: m.def.label }));
});
console.log(`Found ${doors.length} doors on the live DOORS table:`, doors.map((d) => d.id));

// 3 Sep 2026, floor-plan pass — decks have walls now, so "walk straight at
// the marker from a fixed point" would fail for the honest reason that
// there's a wall in the way. The player has no pathfinder (WASD), but
// this test stands in for a player who knows the way: it starts from a
// DIFFERENT room on the door's deck (so the walk has to cross at least
// one doorway), asks engine/hubNav.ts for the waypoints a body of PLAYER_R
// can follow, and then drives every leg with the REAL tryMove(), which
// runs the real clampToDeckFloor and its wall collision. If the plan has
// a doorway too narrow, a marker behind furniture, or a landing inside a
// wall, this stops short exactly the way a real player would.
const plan = await page.evaluate(async () => {
  const layout = await import("/src/engine/hubLayout.ts");
  const hub = window.__bwGame.scene.getScene("Hub");
  const out = {};
  for (const m of hub.doorMarkers) {
    const deck = hub.roomDeckOf(m.def.room);
    const rooms = Object.keys(layout.DECK_LAYOUTS[deck].rooms).filter((r) => r !== m.def.room && !r.endsWith("Hall"));
    const fromRoom = rooms[0] ?? m.def.room;
    const r = layout.DECK_LAYOUTS[deck].rooms[fromRoom];
    const c = layout.resolveAgainstSolids(deck, (r.left + r.right) / 2, (r.top + r.bottom) / 2, 15);
    out[m.def.id] = { deck, fromRoom, start: c };
  }
  return out;
});

const results = [];
for (const door of doors) {
  const outcome = await page.evaluate(
    async ({ door, start }) => {
      const nav = await import("/src/engine/hubNav.ts");
      const hub = window.__bwGame.scene.getScene("Hub");
      hub.currentRoomId = door.room;
      // Clear the deck of NPCs first — tryMove silently no-ops an axis if
      // an NPC is standing in the way, which would either mask a real
      // unreachable spot or fake a pass by nudging the player somewhere it
      // shouldn't be.
      for (const npc of hub.npcs) {
        npc.x -= 6000;
        npc.y -= 6000;
        npc.root.setPosition(npc.x, npc.y);
      }
      hub.playerX = start.x;
      hub.playerY = start.y;
      hub.player.setPosition(start.x, start.y);
      const deck = hub.roomDeckOf(door.room);
      const path = nav.findPath(deck, start.x, start.y, door.x, door.y, 15);
      if (path === null) return { landedX: Math.round(start.x), landedY: Math.round(start.y), distFromDoor: -1, hitId: null, waypoints: -1, noRoute: true };
      const legs = [...path, { x: door.x, y: door.y }];
      let steps = 0;
      for (const wp of legs) {
        let lastX = null;
        let lastY = null;
        let stalled = 0;
        for (let i = 0; i < 600; i++) {
          const dx = Math.max(-6, Math.min(6, wp.x - hub.playerX));
          const dy = Math.max(-6, Math.min(6, wp.y - hub.playerY));
          if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) break;
          hub.tryMove(dx, 0);
          hub.tryMove(0, dy);
          steps++;
          if (hub.playerX === lastX && hub.playerY === lastY) {
            stalled += 1;
            if (stalled > 5) break;
          } else {
            stalled = 0;
          }
          lastX = hub.playerX;
          lastY = hub.playerY;
        }
      }
      hub.player.setPosition(hub.playerX, hub.playerY);
      // The live zone label only updates inside handleMovement; mirror it
      // here (same roomAt the scene uses) so isAtDoor's exact-room filter
      // sees where we actually ended up, not where we started.
      const layout = await import("/src/engine/hubLayout.ts");
      hub.currentRoomId = layout.roomAt(deck, hub.playerX, hub.playerY);
      const at = hub.isAtDoor();
      const dist = Math.hypot(hub.playerX - door.x, hub.playerY - door.y);
      return { landedX: Math.round(hub.playerX), landedY: Math.round(hub.playerY), distFromDoor: Math.round(dist), hitId: at ? at.id : null, waypoints: path.length, steps };
    },
    { door, start: plan[door.id].start },
  );
  const pass = outcome.hitId === door.id;
  results.push({ ...door, from: plan[door.id].fromRoom, ...outcome, pass });
  console.log(
    `${pass ? "PASS" : "FAIL"} — ${door.id} (${door.label}) at (${door.x},${door.y}), from ${plan[door.id].fromRoom}: ` +
      `${outcome.waypoints} waypoint(s), walked to (${outcome.landedX},${outcome.landedY}), ${outcome.distFromDoor}px from the marker, ` +
      `isAtDoor() ${outcome.hitId ? `returned "${outcome.hitId}"` : "returned nothing"}${outcome.noRoute ? " — NO ROUTE" : ""}`,
  );
}

await page.screenshot({ path: new URL("./door_reachability_last.png", import.meta.url).pathname });

const allPass = results.every((r) => r.pass);
const out = { doorCount: doors.length, allPass, results, pageErrors };
writeFileSync(new URL("./door_reachability_report.json", import.meta.url), JSON.stringify(out, null, 2));

console.log("\n=== SUMMARY ===");
console.log(`${results.filter((r) => r.pass).length}/${results.length} doors reachable`);
if (!allPass) console.log("FAILING:", results.filter((r) => !r.pass).map((r) => r.id));
console.log("pageErrors:", pageErrors.length ? pageErrors : "none");

await browser.close();
process.exit(allPass ? 0 : 1);
