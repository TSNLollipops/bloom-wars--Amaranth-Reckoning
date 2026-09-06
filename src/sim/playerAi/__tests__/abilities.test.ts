// src/sim/playerAi/__tests__/abilities.test.ts (5 Sep 2026)
// chooseMaserLanceDirection — the gap flagged in Bloom_Wars_Now_And_Next.md
// right after abil_maser_lance itself shipped: chooseMissileTile already
// existed and was wired into driveMission.ts, but nothing equivalent picked
// a Maser Lance direction, so an AI-piloted Tank with the branch equipped
// simply never fired it. Missile/Fire Support have no dedicated unit tests
// of their own (only indirect coverage through tiers.test.ts/
// objectiveAwareness.test.ts's full decidePlayerAiAction runs) — this file
// is the first direct one for this module's own ability-trigger functions,
// added because the cone-vs-radius targeting shape is genuinely new logic
// (see abilities.ts's own chooseMaserLanceDirection header) rather than a
// copy of an already-proven pattern.
//
// Real Mission instances throughout, same house style as
// objectiveAwareness.test.ts and engine/__tests__/maserLance.test.ts's own
// quietMission — chooseMaserLanceDirection's whole point is that it asks
// the engine for cone geometry instead of re-deriving it, so a hand-built
// fake context would test nothing about whether that wiring actually works.
import { describe, it, expect } from "vitest";
import { Mission } from "../../../engine/mission";
import { AMARANTH_MISSION_1 } from "../../../data/campaignAmaranth";
import { decidePlayerAiAction, resetPlayerAiLog, playerAiLog } from "..";
import { chooseMaserLanceDirection } from "../abilities";
import { MODERATE, EASY } from "../profile";
import { createHostileMechUnit, type BattleUnit } from "../../../engine/units";

// Mirrors engine/__tests__/maserLance.test.ts's own PARK/quietMission —
// duplicated rather than imported, matching that file's own established
// per-file convention (see its header).
const PARK: Record<string, { x: number; y: number }> = {
  pilot_rourke: { x: 0, y: 0 },
  pilot_bosk: { x: 1, y: 0 },
  pilot_iyari: { x: 2, y: 0 },
  pilot_anand: { x: 3, y: 0 },
  pilot_lask: { x: 4, y: 0 },
};

function quietMission(): Mission {
  const mission = new Mission(AMARANTH_MISSION_1);
  for (const u of mission.units) {
    if (u.side === "hostile") u.downed = true;
    else u.pos = { ...PARK[u.pilotId!] };
  }
  return mission;
}

function pilot(mission: Mission, pilotId: string, pos: { x: number; y: number }): BattleUnit {
  const u = mission.units.find((x) => x.pilotId === pilotId)!;
  u.pos = { ...pos };
  return u;
}

function hostileAt(mission: Mission, id: string, pos: { x: number; y: number }): BattleUnit {
  const h = createHostileMechUnit(id, pos);
  mission.units.push(h);
  return h;
}

describe("chooseMaserLanceDirection", () => {
  it("refuses without the ability, without an action left, or without a remaining charge", () => {
    const mission = quietMission();
    const bosk = pilot(mission, "pilot_bosk", { x: 4, y: 6 });
    const enemies = () => mission.units.filter((u) => u.side === "hostile" && !u.downed);
    hostileAt(mission, "hostile_mech_01", { x: 7, y: 6 });
    hostileAt(mission, "hostile_mech_02", { x: 6, y: 6 });

    expect(chooseMaserLanceDirection(bosk, enemies(), mission.units, mission, MODERATE)).toBeNull(); // no abil_maser_lance yet

    bosk.abilities = [...bosk.abilities, "abil_maser_lance"];
    expect(chooseMaserLanceDirection(bosk, enemies(), mission.units, mission, MODERATE)).not.toBeNull();

    bosk.actionsRemaining = 0;
    expect(chooseMaserLanceDirection(bosk, enemies(), mission.units, mission, MODERATE)).toBeNull();
    bosk.actionsRemaining = 2;

    bosk.maserLanceUsesRemaining = 0;
    expect(chooseMaserLanceDirection(bosk, enemies(), mission.units, mission, MODERATE)).toBeNull();
  });

  it("EASY never fires it, even with the ability and a full charge", () => {
    const mission = quietMission();
    const bosk = pilot(mission, "pilot_bosk", { x: 4, y: 6 });
    bosk.abilities = [...bosk.abilities, "abil_maser_lance"];
    hostileAt(mission, "hostile_mech_01", { x: 7, y: 6 });
    hostileAt(mission, "hostile_mech_02", { x: 6, y: 6 });
    const enemies = mission.units.filter((u) => u.side === "hostile" && !u.downed);

    expect(chooseMaserLanceDirection(bosk, enemies, mission.units, mission, EASY)).toBeNull();
  });

  it("holds the charge when nothing clears the profile's strikeMinTargets bar (MODERATE: 2)", () => {
    const mission = quietMission();
    const bosk = pilot(mission, "pilot_bosk", { x: 4, y: 6 });
    bosk.abilities = [...bosk.abilities, "abil_maser_lance"];
    hostileAt(mission, "hostile_mech_01", { x: 7, y: 6 }); // alone in its cone — only 1
    const enemies = mission.units.filter((u) => u.side === "hostile" && !u.downed);

    expect(chooseMaserLanceDirection(bosk, enemies, mission.units, mission, MODERATE)).toBeNull();
  });

  it("picks the best-scoring direction and skips one that would also catch a friendly, even when that direction has more hostiles", () => {
    const mission = quietMission();
    const bosk = pilot(mission, "pilot_bosk", { x: 4, y: 6 });
    bosk.abilities = [...bosk.abilities, "abil_maser_lance"];

    // +x cone from (4,6) (per engine/__tests__/maserLance.test.ts's own
    // geometry test): step2/step3 tiles include (6,6) and (7,6) — 2 clean
    // hostiles, no friendly.
    hostileAt(mission, "hostile_mech_01", { x: 6, y: 6 });
    hostileAt(mission, "hostile_mech_02", { x: 7, y: 6 });

    // south cone from (4,6): step1 (4,7), step2 (3,8)/(4,8)/(5,8) — 3
    // hostiles (a higher raw score than +x) but with pilot_anand parked
    // inside the same cone at step1, so this direction must be rejected
    // outright rather than merely scored lower.
    const anand = pilot(mission, "pilot_anand", { x: 4, y: 7 });
    hostileAt(mission, "hostile_mech_03", { x: 3, y: 8 });
    hostileAt(mission, "hostile_mech_04", { x: 4, y: 8 });
    hostileAt(mission, "hostile_mech_01", { x: 5, y: 8 }); // only 4 archetypes exist (data/units.ts) — reusing an id is fine, instanceId is still generated fresh

    const enemies = mission.units.filter((u) => u.side === "hostile" && !u.downed);
    const choice = chooseMaserLanceDirection(bosk, enemies, mission.units, mission, MODERATE);
    expect(choice).not.toBeNull();
    expect(choice!.hostiles).toBe(2); // the clean +x cone, not south's higher-count-but-contaminated one

    // Sanity: the returned tile really does reproduce that same cone
    // through the engine's own preview, not a coincidentally-matching count.
    const cone = mission.previewMaserLanceCone(bosk.instanceId, choice!.tile)!;
    expect(cone).not.toContainEqual(anand.pos);
    expect(cone.some((c) => c.x === 6 && c.y === 6)).toBe(true);
    expect(cone.some((c) => c.x === 7 && c.y === 6)).toBe(true);
  });

  it("decidePlayerAiAction actually returns the maser_lance action end to end, with a targetTile the engine accepts", () => {
    const mission = quietMission();
    const bosk = pilot(mission, "pilot_bosk", { x: 4, y: 6 });
    bosk.abilities = [...bosk.abilities, "abil_maser_lance"];
    hostileAt(mission, "hostile_mech_01", { x: 6, y: 6 });
    hostileAt(mission, "hostile_mech_02", { x: 7, y: 6 });

    resetPlayerAiLog();
    const decision = decidePlayerAiAction(mission.map, bosk, mission.units, mission.turn, mission, MODERATE);
    expect(decision.action).toBe("maser_lance");
    expect(decision.targetTile).toBeDefined();
    expect(playerAiLog.at(-1)?.reason).toBe("maser_lance");

    const before = mission.maserLanceChargesRemaining(bosk.instanceId);
    const result = mission.maserLanceStrike(bosk.instanceId, decision.targetTile!);
    expect(result).not.toBeNull(); // the AI's own chosen tile is a real, engine-legal direction
    expect(mission.maserLanceChargesRemaining(bosk.instanceId)).toBe(before - 1);
  });
});
