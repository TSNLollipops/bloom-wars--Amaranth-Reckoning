// engine/threat.ts — the Hard tier's threat map (Player AI Difficulty Tiers
// Plan §5.1, 1 Sep 2026). Real Mission instances, hostiles repositioned on
// the live BattleUnit objects, same discipline as sim/playerAi/__tests__/.
// Two things worth pinning: the footprint is the REAL reach (walls and
// the hostile's own movement kind, not moveRange+attackRange as the crow
// flies), and the oracle answers exactly what decideHostileAction would
// do, including the re-routing when a squadmate drops mid-phase.
import { describe, it, expect } from "vitest";
import { Mission } from "../mission";
import { AMARANTH_MISSION_2 } from "../../data/campaignAmaranth";
import { buildThreatMap, incomingAt, attackersAt, predictedFocus, movementKindOf } from "../threat";
import { decideHostileAction, estimateDamage } from "../ai";
import { coordKey } from "../grid";
import { BLOOM } from "../../data/bloom";

function fixture() {
  const mission = new Mission(AMARANTH_MISSION_2);
  const rourke = mission.units.find((u) => u.pilotId === "pilot_rourke")!;
  const bosk = mission.units.find((u) => u.pilotId === "pilot_bosk")!;
  const hostiles = mission.units.filter((u) => u.side === "hostile");
  const [a, b] = hostiles;
  for (const h of hostiles) if (h !== a && h !== b) h.downed = true;
  // Park everyone else far away so only the units a test moves matter.
  // Tests below use the open plain on the map's right half (x 13-19,
  // y 1-9 on map_amaranth_wire_and_mud) — the walled hold zone in the
  // middle would otherwise block the short paths they reason about.
  for (const u of mission.units) if (u.side === "player" && u !== rourke && u !== bosk) u.pos = { x: 0, y: 0 };
  rourke.pos = { x: 2, y: 9 };
  bosk.pos = { x: 3, y: 9 };
  return { mission, rourke, bosk, a, b };
}

describe("buildThreatMap — footprints", () => {
  it("a hostile's attackable set is its attack range measured from every tile it can actually reach", () => {
    const { mission, a, b } = fixture();
    b.downed = true;
    a.pos = { x: 15, y: 5 };
    a.moveRange = 1;
    a.attackRange = [1, 1];
    const threat = buildThreatMap(mission.map, mission.units, mission.turn);
    const fp = threat.footprints.find((f) => f.hostile === a)!;
    expect(fp.standable.has(coordKey({ x: 15, y: 5 }))).toBe(true);
    // Chebyshev 2 from (15,5) is only attackable if some standable tile is
    // adjacent to it — (17,5) needs standing on (16,5), one step: yes.
    expect(fp.attackable.has(coordKey({ x: 17, y: 5 }))).toBe(true);
    // (18,5) would need two steps of movement: no.
    expect(fp.attackable.has(coordKey({ x: 18, y: 5 }))).toBe(false);
    expect(attackersAt(threat, { x: 17, y: 5 })).toBe(1);
    expect(attackersAt(threat, { x: 18, y: 5 })).toBe(0);
  });

  it("a taunt on the board roots every hostile: footprint collapses to in-place range", () => {
    const { mission, rourke, a, b } = fixture();
    b.downed = true;
    a.pos = { x: 15, y: 5 };
    a.moveRange = 4;
    a.attackRange = [1, 1];
    const before = buildThreatMap(mission.map, mission.units, mission.turn).footprints.find((f) => f.hostile === a)!;
    expect(before.standable.size).toBeGreaterThan(1);
    rourke.taunting = true;
    const after = buildThreatMap(mission.map, mission.units, mission.turn).footprints.find((f) => f.hostile === a)!;
    expect(after.standable.size).toBe(1);
    expect(after.attackable.has(coordKey({ x: 16, y: 5 }))).toBe(true);
    expect(after.attackable.has(coordKey({ x: 19, y: 5 }))).toBe(false);
  });

  it("movementKindOf: flying Bloom fly, everything else walks its chassis", () => {
    const { a } = fixture();
    const flyer = Object.keys(BLOOM).find((id) => BLOOM[id].movementType === "flight_membrane");
    if (flyer) {
      a.kind = "bloom";
      a.archetypeId = flyer;
      expect(movementKindOf(a)).toBe("flying");
    }
    a.kind = "bloom";
    a.archetypeId = "bloom_crawlmass";
    a.chassis = undefined;
    expect(movementKindOf(a)).toBe("bipedal");
  });
});

describe("incomingAt — footprint sum", () => {
  it("sums estimateDamage over every hostile that covers the tile, none for a tile nobody reaches", () => {
    const { mission, rourke, a, b } = fixture();
    a.pos = { x: 15, y: 5 };
    b.pos = { x: 16, y: 5 };
    for (const h of [a, b]) {
      h.moveRange = 2;
      h.attackRange = [1, 1];
    }
    const threat = buildThreatMap(mission.map, mission.units, mission.turn);
    const tile = { x: 15, y: 7 };
    const saved = rourke.pos;
    rourke.pos = tile;
    const expected = estimateDamage(mission.map, a, rourke, mission.units) + estimateDamage(mission.map, b, rourke, mission.units);
    rourke.pos = saved;
    const inc = incomingAt(threat, mission.map, rourke, tile, mission.units);
    expect(inc.attackers).toBe(2);
    expect(inc.total).toBe(expected);
    expect(rourke.pos).toEqual(saved); // transient write restored
    const far = incomingAt(threat, mission.map, rourke, { x: 2, y: 1 }, mission.units);
    expect(far.attackers).toBe(0);
    expect(far.total).toBe(0);
  });
});

describe("predictedFocus — the one-ply oracle", () => {
  it("credits the defender exactly when decideHostileAction would pick it, and touches nothing on the real board", () => {
    const { mission, rourke, bosk, a, b } = fixture();
    b.downed = true;
    bosk.pos = { x: 0, y: 0 };
    a.pos = { x: 15, y: 5 };
    a.moveRange = 3;
    a.attackRange = [1, 1];
    a.vision = 6;
    const tile = { x: 15, y: 7 };
    const snapshot = JSON.stringify(mission.units);
    const inc = predictedFocus(mission.map, rourke, tile, mission.units);
    expect(JSON.stringify(mission.units)).toBe(snapshot);
    // Cross-check against the real decision on a hand-made clone board.
    const saved = rourke.pos;
    rourke.pos = tile;
    const decision = decideHostileAction(mission.map, a, mission.units);
    const picksRourke = decision.attackTargetId === rourke.instanceId;
    const dmg = estimateDamage(mission.map, a, rourke, mission.units);
    rourke.pos = saved;
    expect(inc.attackers).toBe(picksRourke ? 1 : 0);
    expect(inc.total).toBe(picksRourke ? dmg : 0);
  });

  it("deducts HP on the clones: a squadmate about to drop re-routes the hostiles behind it onto the defender", () => {
    const { mission, rourke, bosk, a, b } = fixture();
    // Two adjacent hostiles, Bosk at 1 HP next to them, Rourke just behind.
    a.pos = { x: 15, y: 5 };
    b.pos = { x: 15, y: 6 };
    for (const h of [a, b]) {
      h.moveRange = 0;
      h.attackRange = [1, 1];
      h.vision = 3;
      h.kind = "bloom";
    }
    bosk.pos = { x: 16, y: 5 };
    bosk.currentHp = 1;
    const tile = { x: 16, y: 6 }; // adjacent to both hostiles as well
    const inc = predictedFocus(mission.map, rourke, tile, mission.units);
    // The first hostile drops Bosk; the second can no longer pick a downed
    // unit and turns on Rourke.
    expect(inc.attackers).toBeGreaterThanOrEqual(1);
    expect(bosk.currentHp).toBe(1); // clone was deducted, not the real unit
    expect(bosk.downed).toBe(false);
  });

  it("assumeGone hides the named squadmates from the hostile AI", () => {
    const { mission, rourke, bosk, a, b } = fixture();
    b.downed = true;
    a.pos = { x: 15, y: 5 };
    a.moveRange = 3;
    a.attackRange = [1, 1];
    a.vision = 6;
    a.kind = "bloom";
    bosk.pos = { x: 15, y: 6 }; // adjacent: the nearest, so reflexive targeting picks Bosk...
    const tile = { x: 15, y: 8 }; // three away — reachable around Bosk with moveRange 3
    const withBosk = predictedFocus(mission.map, rourke, tile, mission.units);
    const withoutBosk = predictedFocus(mission.map, rourke, tile, mission.units, new Set([bosk.instanceId]));
    expect(withBosk.attackers).toBe(0);
    expect(withoutBosk.attackers).toBe(1); // ...unless told he'll be gone
  });
});
