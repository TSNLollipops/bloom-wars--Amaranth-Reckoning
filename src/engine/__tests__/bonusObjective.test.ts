// Generalized bonus-objective pass (24 Aug 2026, Maxime: "keep the rescue
// pilot and bloom patch thing around we are gonna use those as special
// objectif player can complete during mission for extra point" — then,
// asked about timing/reuse: "built the system to support adding those as
// 2cd objectif in later mission" — and, asked whether rescue's points
// replace or add to its existing free-recruit reward: "Points on top of
// the recruit"). Covers what changed on top of clearBloom.test.ts and
// rescuePilot.test.ts's existing coverage:
//   - data/types.ts's BonusObjective discriminated union (RescuePilotBonusObjective | ClearBloomPatchBonusObjective), both now carrying bonusPoints
//   - engine/mission.ts's armBonusObjective dispatch (no cross-contamination between rescueOutcome/clearBloomPatchOutcome)
//   - the new clear_bloom_patch kind end to end: armClearBloomPatch, checkClearBloomPatchComplete, no "failed" state
//   - engine/campaignEconomy.ts's computeBonusObjectivePoints/applyBonusObjectivePoints, for both kinds, including outcome-independence
//
// No shipped mission carries a clear_bloom_patch bonusObjective yet
// (Maxime's own framing — "we might even add bloom cleaning to mission
// 6-8" — is speculative, not a placement instruction), so every
// clear_bloom_patch test here builds its own synthetic CampaignMission by
// spreading AMARANTH_MISSION_3 (same map, same roster — Lask, Warden
// Company's one Munti, is the only pilot carrying abil_clear_bloom) with
// `objective` overridden away from "clear_bloom" — proving the bonus
// framework really is independent of the mission's own win condition, per
// data/types.ts's own comment on why ClearBloomPatchBonusObjective works
// this way, rather than only ever being exercised on the one mission
// whose objective already happens to be clear_bloom.
import { describe, it, expect } from "vitest";
import { Mission } from "../mission";
import { AMARANTH_MISSION_3, AMARANTH_MISSION_5 } from "../../data/campaignAmaranth";
import { MISSION_1A } from "../../data/campaign";
import { ALL_MAPS } from "../../data/mapRegistry";
import { BLOOM_CLEAR_RADIUS } from "../../data/combatTables";
import { createWardenCampaignState } from "../campaignState";
import { computeBonusObjectivePoints, applyBonusObjectivePoints } from "../campaignEconomy";
import type { CampaignMission, Coord } from "../../data/types";

// ---- Shared fixture-building helpers -------------------------------------
// Mirrors Mission's own private clearableBloomTiles()/hasBloomMat() scans,
// but reads straight from the map registry — same "verify against the
// actual current file, not memory" discipline clearBloom.test.ts's own
// map-singleton test already applies to this exact map.

function bloomMatTilesNear(mapId: string, from: Coord, radius: number): Coord[] {
  const map = ALL_MAPS[mapId];
  const tiles: Coord[] = [];
  for (let y = Math.max(0, from.y - radius); y <= Math.min(map.height - 1, from.y + radius); y++) {
    for (let x = Math.max(0, from.x - radius); x <= Math.min(map.width - 1, from.x + radius); x++) {
      if (map.tiles[y][x] === "bloom_mat") tiles.push({ x, y });
    }
  }
  return tiles;
}

function allBloomMatTiles(mapId: string): Coord[] {
  const map = ALL_MAPS[mapId];
  const tiles: Coord[] = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (map.tiles[y][x] === "bloom_mat") tiles.push({ x, y });
    }
  }
  return tiles;
}

const LOW_GROUND_MAP_ID = AMARANTH_MISSION_3.mapId;
const LASK_SPOT: Coord = { x: 7, y: 7 }; // same spot clearBloom.test.ts already verified is mid-patch
const CLEAR_BLOOM_PATCH_BONUS_POINTS = 40; // arbitrary for these tests — only the mechanism is under test, not any specific number

/** A mission whose real objective is eliminate_all (NOT clear_bloom) but that also carries a clear_bloom_patch bonus over a small, explicit set of tiles — proves the bonus framework doesn't depend on the mission's own win condition. */
function makeClearBloomPatchMission(patchTiles: Coord[]): CampaignMission {
  return {
    ...AMARANTH_MISSION_3,
    objective: "eliminate_all",
    bonusObjective: { kind: "clear_bloom_patch", patchTiles, bonusPoints: CLEAR_BLOOM_PATCH_BONUS_POINTS },
  };
}

describe("armBonusObjective dispatch (Mission constructor) — no cross-contamination between kinds", () => {
  it("a rescue_pilot bonusObjective arms rescueOutcome only — clearBloomPatchOutcome stays 'none'", () => {
    const mission = new Mission(AMARANTH_MISSION_5);
    expect(mission.rescueOutcome).toBe("pending");
    expect(mission.clearBloomPatchOutcome).toBe("none");
  });

  it("a clear_bloom_patch bonusObjective arms clearBloomPatchOutcome only — rescueOutcome stays 'none'", () => {
    const patch = bloomMatTilesNear(LOW_GROUND_MAP_ID, LASK_SPOT, BLOOM_CLEAR_RADIUS);
    expect(patch.length).toBeGreaterThan(0);
    const mission = new Mission(makeClearBloomPatchMission(patch));
    expect(mission.clearBloomPatchOutcome).toBe("pending");
    expect(mission.rescueOutcome).toBe("none");
    expect(mission.units.some((u) => u.npcIncapacitated)).toBe(false); // no NPC spawned for this kind
  });
});

describe("clear_bloom_patch — checkClearBloomPatchComplete (via endPlayerTurn)", () => {
  it("stays 'pending' when only part of the listed patch is clear", () => {
    const nearPatch = bloomMatTilesNear(LOW_GROUND_MAP_ID, LASK_SPOT, BLOOM_CLEAR_RADIUS);
    const allTiles = allBloomMatTiles(LOW_GROUND_MAP_ID);
    const nearKeys = new Set(nearPatch.map((c) => `${c.x},${c.y}`));
    const farTile = allTiles.find((c) => !nearKeys.has(`${c.x},${c.y}`));
    expect(farTile).toBeDefined(); // clearBloom.test.ts's own radius test already confirms tiles remain outside a single clear from LASK_SPOT

    const mission = new Mission(makeClearBloomPatchMission([nearPatch[0], farTile!]));
    for (const u of mission.units) if (u.side === "hostile") u.downed = true; // isolate from combat noise
    const lask = mission.units.find((u) => u.pilotId === "pilot_lask")!;
    lask.pos = LASK_SPOT;
    mission.clearBloom(lask.instanceId); // clears every bloom_mat tile in radius, including nearPatch[0] — but not the far tile

    mission.endPlayerTurn();
    expect(mission.clearBloomPatchOutcome).toBe("pending");
    expect(mission.map.tiles[farTile!.y][farTile!.x]).toBe("bloom_mat"); // confirms *why* it's still pending
  });

  it("flips to 'succeeded' once every listed tile is clear, without touching mission.outcome", () => {
    const patch = bloomMatTilesNear(LOW_GROUND_MAP_ID, LASK_SPOT, BLOOM_CLEAR_RADIUS);
    const mission = new Mission(makeClearBloomPatchMission(patch));
    for (const u of mission.units) if (u.side === "hostile") u.downed = true;
    const lask = mission.units.find((u) => u.pilotId === "pilot_lask")!;
    lask.pos = LASK_SPOT;
    mission.clearBloom(lask.instanceId);

    expect(mission.clearBloomPatchOutcome).toBe("pending"); // not checked yet — only endPlayerTurn runs the check
    mission.endPlayerTurn();
    expect(mission.clearBloomPatchOutcome).toBe("succeeded");
    expect(mission.log).toContain("Bonus objective complete — the patch is clear.");
    // eliminate_all with hostiles downed wins outright regardless of the
    // bonus — this assertion is here to document that fact, not to test it.
    expect(mission.outcome).toBe("win");
  });

  it("never fails — an uncleared patch at a real mission loss just stays 'pending', with no third outcome value", () => {
    const patch = bloomMatTilesNear(LOW_GROUND_MAP_ID, LASK_SPOT, BLOOM_CLEAR_RADIUS);
    const mission = new Mission(makeClearBloomPatchMission(patch));
    for (const u of mission.units) if (u.side === "player") u.downed = true; // real squad wipe, patch never touched
    mission.endPlayerTurn();
    expect(mission.outcome).toBe("loss");
    expect(mission.clearBloomPatchOutcome).toBe("pending");
  });
});

describe("computeBonusObjectivePoints / applyBonusObjectivePoints (engine/campaignEconomy.ts)", () => {
  it("is 0 for a mission with no bonusObjective at all", () => {
    const mission = new Mission(MISSION_1A);
    expect(computeBonusObjectivePoints(mission)).toBe(0);
  });

  it("rescue_pilot: pays the objective's own bonusPoints once rescueOutcome is 'succeeded'", () => {
    const mission = new Mission(AMARANTH_MISSION_5);
    const bonus = AMARANTH_MISSION_5.bonusObjective!;
    if (bonus.kind !== "rescue_pilot") throw new Error("expected AMARANTH_MISSION_5's bonusObjective to be rescue_pilot");
    const npc = mission.units.find((u) => u.npcIncapacitated)!;
    const rourke = mission.units.find((u) => u.pilotId === "pilot_rourke")!;
    rourke.pos = { x: npc.pos.x - 1, y: npc.pos.y };
    mission.rescueUnit(rourke.instanceId, npc.instanceId);
    rourke.pos = mission.map.exitTiles![0];
    for (const u of mission.units) if (u.side === "hostile") u.downed = true;
    mission.endPlayerTurn();
    expect(mission.rescueOutcome).toBe("succeeded");

    expect(computeBonusObjectivePoints(mission)).toBe(bonus.bonusPoints);

    const state = createWardenCampaignState();
    const before = state.points;
    const added = applyBonusObjectivePoints(state, mission);
    expect(added).toBe(bonus.bonusPoints);
    expect(state.points).toBe(before + bonus.bonusPoints);
  });

  it("rescue_pilot: pays nothing while pending, and nothing on a failed attempt", () => {
    const pendingMission = new Mission(AMARANTH_MISSION_5); // rescueOutcome stays "pending" — nobody rescued
    expect(computeBonusObjectivePoints(pendingMission)).toBe(0);
    const state = createWardenCampaignState();
    const before = state.points;
    expect(applyBonusObjectivePoints(state, pendingMission)).toBe(0);
    expect(state.points).toBe(before);

    const failedMission = new Mission(AMARANTH_MISSION_5);
    failedMission.rescueOutcome = "failed"; // forcing the outcome directly, same as this repo's other Mission-internals tests
    expect(computeBonusObjectivePoints(failedMission)).toBe(0);
  });

  it("clear_bloom_patch: pays the objective's own bonusPoints once clearBloomPatchOutcome is 'succeeded', nothing while pending", () => {
    const patch = bloomMatTilesNear(LOW_GROUND_MAP_ID, LASK_SPOT, BLOOM_CLEAR_RADIUS);
    const missionDef = makeClearBloomPatchMission(patch);
    const mission = new Mission(missionDef);

    expect(computeBonusObjectivePoints(mission)).toBe(0); // still pending — nothing cleared yet

    for (const u of mission.units) if (u.side === "hostile") u.downed = true;
    const lask = mission.units.find((u) => u.pilotId === "pilot_lask")!;
    lask.pos = LASK_SPOT;
    mission.clearBloom(lask.instanceId);
    mission.endPlayerTurn();
    expect(mission.clearBloomPatchOutcome).toBe("succeeded");

    expect(computeBonusObjectivePoints(mission)).toBe(CLEAR_BLOOM_PATCH_BONUS_POINTS);
    const state = createWardenCampaignState();
    const before = state.points;
    const added = applyBonusObjectivePoints(state, mission);
    expect(added).toBe(CLEAR_BLOOM_PATCH_BONUS_POINTS);
    expect(state.points).toBe(before + CLEAR_BLOOM_PATCH_BONUS_POINTS);
  });

  it("is NOT gated on mission.outcome — a bonus objective can pay out even on a mission that ends in a loss", () => {
    const patch = bloomMatTilesNear(LOW_GROUND_MAP_ID, LASK_SPOT, BLOOM_CLEAR_RADIUS);
    const mission = new Mission(makeClearBloomPatchMission(patch));
    for (const u of mission.units) if (u.side === "hostile") u.downed = true;
    const lask = mission.units.find((u) => u.pilotId === "pilot_lask")!;
    lask.pos = LASK_SPOT;
    mission.clearBloom(lask.instanceId);
    mission.endPlayerTurn();
    expect(mission.clearBloomPatchOutcome).toBe("succeeded");

    // Force a loss directly, same convention campaignEconomy.test.ts's own
    // computeMissionCompletionBonus suite uses for outcome — the point
    // here isn't how a real loss would arise alongside a resolved bonus,
    // it's that computeBonusObjectivePoints must not care either way.
    mission.outcome = "loss";
    expect(computeBonusObjectivePoints(mission)).toBe(CLEAR_BLOOM_PATCH_BONUS_POINTS);

    const state = createWardenCampaignState();
    expect(applyBonusObjectivePoints(state, mission)).toBe(CLEAR_BLOOM_PATCH_BONUS_POINTS);
  });
});

describe("AMARANTH_MISSION_5's bonusObjective now carries a bonusPoints value", () => {
  it("is a positive number, on top of (not instead of) the existing free-recruit reward", () => {
    const bonus = AMARANTH_MISSION_5.bonusObjective!;
    if (bonus.kind !== "rescue_pilot") throw new Error("expected AMARANTH_MISSION_5's bonusObjective to be rescue_pilot");
    expect(bonus.bonusPoints).toBeGreaterThan(0);
    // Comfortably below this mission's own rewardPoints (170, the reward
    // for actually winning it) — a sanity bound on the placeholder, not a
    // pin on its exact value, which this pass's own comment in
    // data/campaignAmaranth.ts already flags as pending a tuning pass.
    expect(bonus.bonusPoints).toBeLessThan(AMARANTH_MISSION_5.rewardPoints);
  });
});
