// Phase 1/2 of claude/Bloom_Wars_Player_AI_Ability_And_Objective_Plan_v1.md
// (25 Aug 2026, Maxime: "plan everything the bot wont be able to finish
// mission 12-36 if he cant use ability at least at kids lvl of success",
// then "keep the plan in mind do what you recommend"). Covers
// decidePlayerAiAction's new PlayerAiMissionContext-aware branches:
// hold_zone convergence, extract_unit's own named-unit override, the
// Munti clear_bloom preference (both the main-objective and
// clear_bloom_patch-bonus cases, and the decorative-bloom_mat non-case that
// is the whole reason this stayed objective-gated instead of "any Munti
// near any bloom_mat"), and the rescue_pilot bonus's three states
// (carrying, adjacent-uncarried, distant-uncarried). Real Mission instances
// throughout — decidePlayerAiAction's new 5th argument is typed as a narrow
// structural slice (PlayerAiMissionContext, types.ts) specifically so a
// live Mission can be passed directly, the same way run.ts now does; these
// tests exercise exactly that path, not a hand-built stub.
import { describe, it, expect } from "vitest";
import { Mission } from "../../../engine/mission";
import { decidePlayerAiAction, resetPlayerAiLog, playerAiLog } from "..";
import { AMARANTH_MISSION_2, AMARANTH_MISSION_3, AMARANTH_MISSION_5 } from "../../../data/campaignAmaranth";
import { MISSION_1A } from "../../../data/campaign";
import { ALL_MAPS } from "../../../data/mapRegistry";
import { BLOOM_CLEAR_RADIUS } from "../../../data/combatTables";
import type { CampaignMission, Coord } from "../../../data/types";

function decide(mission: Mission, unit: ReturnType<Mission["unitById"]>, turn = mission.turn) {
  resetPlayerAiLog();
  const decision = decidePlayerAiAction(mission.map, unit!, mission.units, turn, mission);
  return { decision, lastLog: playerAiLog.at(-1) };
}

describe("decidePlayerAiAction — hold_zone objective awareness", () => {
  it("a unit off the zone, nothing else to do, paths toward the nearest hold-zone tile", () => {
    const mission = new Mission(AMARANTH_MISSION_2);
    for (const u of mission.units) if (u.side === "hostile") u.downed = true; // isolate from combat
    const hold = mission.map.holdZone!;
    expect(hold.length).toBeGreaterThan(0);
    const bosk = mission.units.find((u) => u.pilotId === "pilot_bosk")!;
    bosk.pos = { x: 0, y: 0 }; // far from every hold tile on this map

    const { decision, lastLog } = decide(mission, bosk);
    expect(lastLog?.reason).toBe("hold_zone");
    expect(decision.path).toBeDefined();
    expect(decision.path!.length).toBeGreaterThan(1);
  });

  it("once already standing on a hold tile with the squad nearby, does not walk off it", () => {
    const mission = new Mission(AMARANTH_MISSION_2);
    for (const u of mission.units) if (u.side === "hostile") u.downed = true;
    const hold = mission.map.holdZone!;
    // Also bring the rest of the squad up near the zone — leaving them at
    // their far-off deploy positions would (correctly) have
    // cohesiveMoveToward's own MAX_LEAD_FROM_ALLIES cap pull Bosk back
    // toward them instead of letting him hold; in real sequential play the
    // whole squad converges together, so this matches that, not an
    // isolated single-unit snapshot.
    for (const u of mission.units) if (u.side === "player") u.pos = hold[0];
    const bosk = mission.units.find((u) => u.pilotId === "pilot_bosk")!;

    const { decision, lastLog } = decide(mission, bosk);
    expect(lastLog?.reason).toBe("hold_zone");
    // cohesiveMoveToward always returns a path array (possibly length 1,
    // meaning "stay put") — run.ts only actually moves when length > 1.
    expect(decision.path!.length).toBe(1);
  });
});

describe("decidePlayerAiAction — extract_unit objective awareness", () => {
  it("the named extract target, nothing else to do, paths toward the nearest exit tile", () => {
    const mission = new Mission(AMARANTH_MISSION_5);
    for (const u of mission.units) if (u.side === "hostile") u.downed = true;
    const npc = mission.units.find((u) => u.npcIncapacitated)!;
    npc.downed = true; // keep the rescue bonus out of this test's way entirely
    const anand = mission.units.find((u) => u.pilotId === "pilot_anand")!;
    expect(mission.mission.objectiveParams.extractUnitId).toBe("pilot_anand");
    anand.pos = { x: 0, y: 0 }; // far from the exit

    const { decision, lastLog } = decide(mission, anand);
    expect(lastLog?.reason).toBe("extract_to_exit");
    expect(decision.path).toBeDefined();
    expect(decision.path!.length).toBeGreaterThan(1);
  });

  it("a different unit on the same extract_unit mission is not overridden by it", () => {
    const mission = new Mission(AMARANTH_MISSION_5);
    for (const u of mission.units) if (u.side === "hostile") u.downed = true;
    const npc = mission.units.find((u) => u.npcIncapacitated)!;
    npc.downed = true;
    const bosk = mission.units.find((u) => u.pilotId === "pilot_bosk")!;
    bosk.pos = { x: 0, y: 0 };

    const { lastLog } = decide(mission, bosk);
    expect(lastLog?.reason).not.toBe("extract_to_exit");
  });
});

describe("decidePlayerAiAction — Munti clear_bloom preference", () => {
  it("clears in place on the mission whose real objective is clear_bloom (AMARANTH_MISSION_3)", () => {
    const mission = new Mission(AMARANTH_MISSION_3);
    for (const u of mission.units) if (u.side === "hostile") u.downed = true;
    const lask = mission.units.find((u) => u.pilotId === "pilot_lask")!; // Warden Company's one Munti
    lask.pos = { x: 7, y: 7 }; // clearBloom.test.ts's own verified mid-patch spot
    expect(mission.getClearableBloomFrom(lask.instanceId, lask.pos).length).toBeGreaterThan(0);

    const { decision, lastLog } = decide(mission, lask);
    expect(lastLog?.reason).toBe("clear_bloom");
    expect(decision.action).toBe("clear_bloom");
  });

  it("does not fire below the self-preservation hp bar, even mid-patch", () => {
    const mission = new Mission(AMARANTH_MISSION_3);
    for (const u of mission.units) if (u.side === "hostile") u.downed = true;
    const lask = mission.units.find((u) => u.pilotId === "pilot_lask")!;
    lask.pos = { x: 7, y: 7 };
    lask.currentHp = Math.floor(lask.maxHp * 0.1); // well under RETREAT_HP_FRACTION

    const { decision } = decide(mission, lask);
    expect(decision.action).not.toBe("clear_bloom");
  });

  it("clears in place for a clear_bloom_patch BONUS objective on a mission whose real objective is eliminate_all", () => {
    // Mirrors bonusObjective.test.ts's own makeClearBloomPatchMission
    // fixture — same map, same reasoning (no shipped mission carries this
    // bonus kind yet, per that file's header).
    const mapId = AMARANTH_MISSION_3.mapId;
    const map = ALL_MAPS[mapId];
    const from: Coord = { x: 7, y: 7 };
    const patch: Coord[] = [];
    for (let y = Math.max(0, from.y - BLOOM_CLEAR_RADIUS); y <= Math.min(map.height - 1, from.y + BLOOM_CLEAR_RADIUS); y++) {
      for (let x = Math.max(0, from.x - BLOOM_CLEAR_RADIUS); x <= Math.min(map.width - 1, from.x + BLOOM_CLEAR_RADIUS); x++) {
        if (map.tiles[y][x] === "bloom_mat") patch.push({ x, y });
      }
    }
    expect(patch.length).toBeGreaterThan(0);
    const missionDef: CampaignMission = {
      ...AMARANTH_MISSION_3,
      objective: "eliminate_all",
      bonusObjective: { kind: "clear_bloom_patch", patchTiles: patch, bonusPoints: 40 },
    };
    const mission = new Mission(missionDef);
    for (const u of mission.units) if (u.side === "hostile") u.downed = true;
    const lask = mission.units.find((u) => u.pilotId === "pilot_lask")!;
    lask.pos = from;

    const { decision, lastLog } = decide(mission, lask);
    expect(lastLog?.reason).toBe("clear_bloom");
    expect(decision.action).toBe("clear_bloom");
  });

  it("does NOT clear decorative bloom_mat on a mission with no clear_bloom objective or bonus at all (MISSION_1A)", () => {
    const mission = new Mission(MISSION_1A);
    for (const u of mission.units) if (u.side === "hostile") u.downed = true;
    const barasj = mission.units.find((u) => u.pilotId === "pilot_barasj")!; // Team One's one Munti
    // Find an actual bloom_mat tile on this map and stand Barasj next to it —
    // verified against the real map rather than assumed, per this project's
    // own "verify against the actual current file" rule.
    let matTile: Coord | undefined;
    outer: for (let y = 0; y < mission.map.height; y++) {
      for (let x = 0; x < mission.map.width; x++) {
        if (mission.map.tiles[y][x] === "bloom_mat") {
          matTile = { x, y };
          break outer;
        }
      }
    }
    expect(matTile).toBeDefined();
    barasj.pos = matTile!;

    const { decision, lastLog } = decide(mission, barasj);
    expect(decision.action).not.toBe("clear_bloom");
    expect(lastLog?.reason).not.toBe("clear_bloom");
  });
});

describe("decidePlayerAiAction — Screen usage (25 Aug 2026, Maxime: \"add screen too. its probably why mission 3 still fail sometimes\")", () => {
  it("puts up Screen instead of clearing, when a hostile can actually see the Munti and the charge is unspent", () => {
    const mission = new Mission(AMARANTH_MISSION_3);
    const hostiles = mission.units.filter((u) => u.side === "hostile");
    const spotter = hostiles[0];
    for (const h of hostiles.slice(1)) h.downed = true; // isolate to exactly one spotter
    const lask = mission.units.find((u) => u.pilotId === "pilot_lask")!;
    lask.pos = { x: 7, y: 7 }; // clearBloom.test.ts's own verified mid-patch spot
    expect(mission.getClearableBloomFrom(lask.instanceId, lask.pos).length).toBeGreaterThan(0);
    // Distance 3: outside Lask's own attackRange ([1,2], units.ts), so this
    // can't accidentally trigger killNow/focus_weak instead — but within
    // every Bloom archetype's vision stat (data/bloom.ts's lowest is 3), so
    // `spotted` (isVisibleTo(spotter, lask)) is true regardless of which
    // archetype this mission's spotter actually is.
    spotter.pos = { x: 7, y: Math.max(0, lask.pos.y - 3) };
    expect(lask.usedScreenThisMission).toBeFalsy();

    const { decision, lastLog } = decide(mission, lask);
    expect(lastLog?.reason).toBe("use_screen");
    expect(decision.action).toBe("screen");
  });

  it("falls through to clear_bloom once the once-per-mission charge is already spent", () => {
    const mission = new Mission(AMARANTH_MISSION_3);
    const hostiles = mission.units.filter((u) => u.side === "hostile");
    const spotter = hostiles[0];
    for (const h of hostiles.slice(1)) h.downed = true;
    const lask = mission.units.find((u) => u.pilotId === "pilot_lask")!;
    lask.pos = { x: 7, y: 7 };
    spotter.pos = { x: 7, y: Math.max(0, lask.pos.y - 3) };
    lask.usedScreenThisMission = true; // same "spotted, objective-gated" setup as above, charge already gone

    const { decision, lastLog } = decide(mission, lask);
    expect(lastLog?.reason).toBe("clear_bloom");
    expect(decision.action).toBe("clear_bloom");
  });

  it("does not fire when nothing can see the Munti — the existing clear_bloom-on-a-cleared-board tests already prove this (spotted stays false there), asserted explicitly here too", () => {
    const mission = new Mission(AMARANTH_MISSION_3);
    for (const u of mission.units) if (u.side === "hostile") u.downed = true; // nothing left to spot Lask
    const lask = mission.units.find((u) => u.pilotId === "pilot_lask")!;
    lask.pos = { x: 7, y: 7 };

    const { decision, lastLog } = decide(mission, lask);
    expect(lastLog?.reason).not.toBe("use_screen");
    expect(decision.action).not.toBe("screen");
  });
});

describe("decidePlayerAiAction — rescue_pilot bonus awareness", () => {
  it("adjacent to the uncarried NPC — picks them up", () => {
    const mission = new Mission(AMARANTH_MISSION_5);
    for (const u of mission.units) if (u.side === "hostile") u.downed = true;
    const npc = mission.units.find((u) => u.npcIncapacitated)!;
    const rourke = mission.units.find((u) => u.pilotId === "pilot_rourke")!;
    rourke.pos = { x: npc.pos.x - 1, y: npc.pos.y };

    const { decision, lastLog } = decide(mission, rourke);
    expect(lastLog?.reason).toBe("rescue_pickup");
    expect(decision.action).toBe("rescue");
  });

  it("not yet adjacent — heads toward the NPC instead of chasing a fight", () => {
    const mission = new Mission(AMARANTH_MISSION_5);
    for (const u of mission.units) if (u.side === "hostile") u.downed = true;
    const rourke = mission.units.find((u) => u.pilotId === "pilot_rourke")!;
    rourke.pos = { x: 0, y: 0 }; // far from the NPC, not adjacent

    const { decision, lastLog } = decide(mission, rourke);
    expect(lastLog?.reason).toBe("seek_rescue");
    expect(decision.path).toBeDefined();
    expect(decision.path!.length).toBeGreaterThan(1);
  });

  it("already carrying — heads for the nearest exit regardless of enemies, ignoring the (engine-refused) fight entirely", () => {
    const mission = new Mission(AMARANTH_MISSION_5);
    // Deliberately NOT downing hostiles this time — proving carrying takes
    // priority even with live enemies still on the board.
    const npc = mission.units.find((u) => u.npcIncapacitated)!;
    const rourke = mission.units.find((u) => u.pilotId === "pilot_rourke")!;
    rourke.pos = { x: npc.pos.x - 1, y: npc.pos.y };
    mission.rescueUnit(rourke.instanceId, npc.instanceId);
    expect(rourke.carryingRescueId).toBe(npc.instanceId);

    const { decision, lastLog } = decide(mission, rourke);
    expect(lastLog?.reason).toBe("rescue_carry");
    expect(decision.path).toBeDefined();
  });

  it("the extract_unit target itself skips the rescue-pursuit branch — the real objective outranks the bonus", () => {
    const mission = new Mission(AMARANTH_MISSION_5);
    for (const u of mission.units) if (u.side === "hostile") u.downed = true;
    const npc = mission.units.find((u) => u.npcIncapacitated)!;
    const anand = mission.units.find((u) => u.pilotId === "pilot_anand")!;
    anand.pos = { x: 0, y: 0 }; // far from both the NPC and the exit — not adjacent to the NPC either
    expect(Math.abs(anand.pos.x - npc.pos.x) + Math.abs(anand.pos.y - npc.pos.y)).toBeGreaterThan(1);

    const { lastLog } = decide(mission, anand);
    expect(lastLog?.reason).toBe("extract_to_exit");
    expect(lastLog?.reason).not.toBe("seek_rescue");
  });
});
