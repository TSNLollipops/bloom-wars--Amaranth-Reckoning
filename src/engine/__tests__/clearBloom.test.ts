// Mission 3's "clean the bloom patch" pass (Maxime, 23 Aug 2026: "I'm
// thinking of making clean the bloom patch the objective of mission 3...
// this is me wishful thinking your call. i think this would be cool to add
// in game, something else to do than just smash"). Covers the three pieces
// engine/mission.ts added for it: the clear_bloom win condition
// (hasBloomMat), the abil_clear_bloom verb itself (canClearBloom/
// getClearableBloomFrom/clearBloom), and tickBloomRegrowth's deterministic
// countervailing pressure — plus the map-tiles-clone-on-construct
// correctness fix this pass's first-ever tile mutation made load-bearing
// (see Mission's own constructor comment in engine/mission.ts).
import { describe, it, expect } from "vitest";
import { Mission } from "../mission";
import { AMARANTH_MISSION_3 } from "../../data/campaignAmaranth";
import { MISSION_1A } from "../../data/campaign";
import { ALL_MAPS } from "../../data/mapRegistry";
import { MAX_ACTIONS_PER_TURN, BLOOM_REGROWTH_TILES_PER_TICK } from "../../data/combatTables";

describe("Mission constructor — map tile isolation (map singleton bug fix, 23 Aug 2026)", () => {
  it("clearing bloom_mat in one Mission instance never touches a second Mission built from the same map, nor the shared map registry entry itself", () => {
    const missionA = new Mission(AMARANTH_MISSION_3);
    const laskA = missionA.units.find((u) => u.pilotId === "pilot_lask")!;
    // Deep inside The Low Ground's bloom patch (data/mapsAmaranth.ts's
    // THE_LOW_GROUND_TILES) — asserted via the engine's own query rather
    // than a hand-transcribed coordinate, per this project's own "verify
    // against the actual current file" rule.
    laskA.pos = { x: 7, y: 7 };
    const clearableBefore = missionA.getClearableBloomFrom(laskA.instanceId, laskA.pos);
    expect(clearableBefore.length).toBeGreaterThan(0);

    missionA.clearBloom(laskA.instanceId);
    for (const c of clearableBefore) expect(missionA.map.tiles[c.y][c.x]).toBe("plain");

    // A second, freshly constructed Mission from the identical mission def
    // (and therefore the identical mapId) must see the patch untouched —
    // this is exactly the bug the constructor's tile-clone fixes: MAPS[id]
    // is one singleton object shared by every Mission ever built from it.
    const missionB = new Mission(AMARANTH_MISSION_3);
    for (const c of clearableBefore) expect(missionB.map.tiles[c.y][c.x]).toBe("bloom_mat");

    // And the raw registry entry itself — the actual singleton in question —
    // is untouched too, not just missionB's own (separately cloned) copy.
    const registryMap = ALL_MAPS[AMARANTH_MISSION_3.mapId];
    for (const c of clearableBefore) expect(registryMap.tiles[c.y][c.x]).toBe("bloom_mat");
  });
});

describe("Mission.canClearBloom / getClearableBloomFrom / clearBloom", () => {
  it("converts every bloom_mat tile within BLOOM_CLEAR_RADIUS to plain, costs 1 action, and does not end the turn", () => {
    const mission = new Mission(AMARANTH_MISSION_3);
    const lask = mission.units.find((u) => u.pilotId === "pilot_lask")!; // Warden Company's one Munti — the only pilot carrying abil_clear_bloom
    lask.pos = { x: 7, y: 7 };

    const before = mission.getClearableBloomFrom(lask.instanceId, lask.pos);
    expect(before.length).toBeGreaterThan(0);

    const result = mission.clearBloom(lask.instanceId);
    expect(result).not.toBeNull();
    expect(result!.tilesCleared).toBe(before.length);
    for (const c of before) expect(mission.map.tiles[c.y][c.x]).toBe("plain");
    // Nothing left to clear from the same spot — the UI's own "usable only
    // if it would do something" contract (mirrors getRepairableFrom).
    expect(mission.getClearableBloomFrom(lask.instanceId, lask.pos)).toEqual([]);

    expect(lask.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN - 1);
  });

  it("is radius-limited — clearing once from one spot does not clear the whole patch, and does not win the mission by itself", () => {
    const mission = new Mission(AMARANTH_MISSION_3);
    const lask = mission.units.find((u) => u.pilotId === "pilot_lask")!;
    lask.pos = { x: 7, y: 7 };
    mission.clearBloom(lask.instanceId);

    let remaining = 0;
    for (const row of mission.map.tiles) for (const t of row) if (t === "bloom_mat") remaining++;
    expect(remaining).toBeGreaterThan(0);

    for (const u of mission.units) if (u.side === "hostile") u.downed = true; // isolate from combat noise
    mission.endPlayerTurn();
    expect(mission.outcome).toBe("ongoing");
  });

  it("refuses a unit without abil_clear_bloom (e.g. a Tank), a unit with nothing in range, a downed unit, and a unit out of actions", () => {
    const mission = new Mission(AMARANTH_MISSION_3);
    const bosk = mission.units.find((u) => u.pilotId === "pilot_bosk")!; // Tank — no abil_clear_bloom
    bosk.pos = { x: 7, y: 7 };
    expect(mission.canClearBloom(bosk.instanceId)).toBe(false);
    expect(mission.clearBloom(bosk.instanceId)).toBeNull();

    const lask = mission.units.find((u) => u.pilotId === "pilot_lask")!;
    lask.pos = { x: 0, y: 0 }; // clear of the patch entirely
    expect(mission.canClearBloom(lask.instanceId)).toBe(false);
    expect(mission.clearBloom(lask.instanceId)).toBeNull();

    lask.pos = { x: 7, y: 7 };
    lask.downed = true;
    expect(mission.canClearBloom(lask.instanceId)).toBe(false);
    lask.downed = false;

    lask.actionsRemaining = 0;
    expect(mission.canClearBloom(lask.instanceId)).toBe(false);
  });

  it("refuses a hostile unit even standing in the middle of the patch", () => {
    const mission = new Mission(AMARANTH_MISSION_3);
    const hostile = mission.units.find((u) => u.side === "hostile")!;
    hostile.pos = { x: 7, y: 7 };
    expect(mission.canClearBloom(hostile.instanceId)).toBe(false);
  });
});

describe("checkWinLoss — clear_bloom objective", () => {
  it("wins the instant no bloom_mat tile remains anywhere on the board", () => {
    const mission = new Mission(AMARANTH_MISSION_3);
    for (let y = 0; y < mission.map.height; y++) {
      for (let x = 0; x < mission.map.width; x++) {
        if (mission.map.tiles[y][x] === "bloom_mat") mission.map.tiles[y][x] = "plain";
      }
    }
    expect(mission.outcome).toBe("ongoing");
    mission.endPlayerTurn();
    expect(mission.outcome).toBe("win");
    expect(mission.log.at(-1)).toBe("Win: objective complete.");
  });

  it("never fails on turn count alone (house rule #5, extended to clear_bloom) — staying past objectiveParams.turnLimit does not end the mission", () => {
    const mission = new Mission(AMARANTH_MISSION_3);
    for (const u of mission.units) if (u.side === "hostile") u.downed = true;
    expect(AMARANTH_MISSION_3.objectiveParams.turnLimit).toBe(12);
    for (let i = 0; i < 13; i++) mission.endPlayerTurn();
    expect(mission.turn).toBeGreaterThan(12);
    expect(mission.outcome).toBe("ongoing");
  });
});

describe("tickBloomRegrowth — deterministic pacing (data/combatTables.ts BLOOM_REGROWTH_*)", () => {
  it("never fires before turn 4, then fires on turn 4 and every 3 turns after, converting BLOOM_REGROWTH_TILES_PER_TICK tiles each time", () => {
    const mission = new Mission(AMARANTH_MISSION_3);
    // Neutralize combat entirely so nothing but the regrowth tick can change
    // tile state (or unit HP) across the turns this test drives through —
    // the point here is pacing, not squad survival.
    for (const u of mission.units) if (u.side === "hostile") u.downed = true;

    const countBloomTiles = () => mission.map.tiles.flat().filter((t) => t === "bloom_mat").length;
    const spreadLogLines = () => mission.log.filter((l) => l.startsWith("Bloom mat spreads"));
    const before = countBloomTiles();

    mission.endPlayerTurn(); // processes turn 1 (1 < 4, skip) -> turn becomes 2
    mission.endPlayerTurn(); // processes turn 2 (skip) -> turn becomes 3
    mission.endPlayerTurn(); // processes turn 3 (skip) -> turn becomes 4
    expect(mission.turn).toBe(4);
    expect(countBloomTiles()).toBe(before);
    expect(spreadLogLines()).toHaveLength(0);

    mission.endPlayerTurn(); // processes turn 4 -> FIRES -> turn becomes 5
    expect(mission.turn).toBe(5);
    const afterFirstTick = countBloomTiles();
    expect(afterFirstTick).toBe(before + BLOOM_REGROWTH_TILES_PER_TICK);
    expect(spreadLogLines()).toHaveLength(1);

    mission.endPlayerTurn(); // turn 5 (skip) -> 6
    mission.endPlayerTurn(); // turn 6 (skip) -> 7
    expect(countBloomTiles()).toBe(afterFirstTick);
    expect(spreadLogLines()).toHaveLength(1);

    mission.endPlayerTurn(); // turn 7 -> FIRES -> 8
    const afterSecondTick = countBloomTiles();
    expect(afterSecondTick).toBe(afterFirstTick + BLOOM_REGROWTH_TILES_PER_TICK);
    expect(spreadLogLines()).toHaveLength(2);
  });

  it("is a no-op for a mission whose objective isn't clear_bloom, even on a map that has bloom_mat tiles as flavor terrain", () => {
    // map_city_sweep_01 (data/maps.ts) has bloom_mat tiles but MISSION_1A's
    // objective is eliminate_all — tickBloomRegrowth must never touch them.
    const mission = new Mission(MISSION_1A);
    for (const u of mission.units) if (u.side === "hostile") u.downed = true;
    const countBloomTiles = () => mission.map.tiles.flat().filter((t) => t === "bloom_mat").length;
    const before = countBloomTiles();
    expect(before).toBeGreaterThan(0);

    for (let i = 0; i < 13; i++) mission.endPlayerTurn();
    expect(countBloomTiles()).toBe(before);
    expect(mission.log.some((l) => l.startsWith("Bloom mat spreads"))).toBe(false);
  });
});
