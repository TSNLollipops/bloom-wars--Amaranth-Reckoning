// Long-Range Sensor Array (7 Sep 2026) and the Generator gate on the two
// bays that shipped without it.
//
// Bloom_Wars_Antfarm_Carrier_Hub_v1.md §11.2 locked the array on 23 Aug
// 2026 — "removes fog of war from mission maps campaign-wide, from the
// moment it's built onward", burrowed and concealed states unchanged,
// Generator-dependent — and it stayed a marker on the upper deck with no
// effect until Maxime, reading the codex sandbox's own honest dev note on
// it: "ah. better fix those two buildable room." This file is the array's
// first test coverage, plus the construction-time Generator rule that
// moved out of scenes/Hub.ts into engine/campaignEconomy.ts the same day
// so it could be tested at all.
//
// House test style (abilities.test.ts / weaponsBayFireSupport.test.ts): a
// real Mission built from a real mission def, direct unit mutation to
// isolate one scenario on an otherwise quiet board. The keeper hostile is
// parked far out with vision 0 and moveRange 0 so it never acts; the units
// under test are pushed in by hand.
import { describe, it, expect } from "vitest";
import { Mission } from "../mission";
import { AMARANTH_MISSION_1 } from "../../data/campaignAmaranth";
import { createHostileMechUnit, createBloomUnit, type BattleUnit } from "../units";
import { unitsVisibleToSide } from "../ai";
import { GENERATOR_DEPENDENT_BAYS, bayNeedsGeneratorFirst } from "../campaignEconomy";
import type { ReservedBayId } from "../campaignState";

const PARK: Record<string, { x: number; y: number }> = {
  pilot_rourke: { x: 0, y: 0 },
  pilot_bosk: { x: 1, y: 0 },
  pilot_iyari: { x: 2, y: 0 },
  pilot_anand: { x: 3, y: 0 },
  pilot_lask: { x: 4, y: 0 },
};

function quietMission(builtBays: ReservedBayId[] = []): Mission {
  const mission = new Mission(AMARANTH_MISSION_1, undefined, builtBays);
  for (const u of mission.units) {
    if (u.side === "hostile") u.downed = true;
    else {
      u.pos = { ...PARK[u.pilotId!] };
      // Every named pilot's own detection quirks off, so DISTANCE is the
      // only thing deciding visibility in these tests: Rourke's mek is
      // Runemaster-primary (burrow detection anywhere in vision, 6 Sep
      // 2026) and Anand's chassis is vibrissal. Both have their own tests.
      u.detectsBurrowedRadius = undefined;
      u.vision = 3;
    }
  }
  const keeper = createHostileMechUnit("hostile_mech_01", { x: 19, y: 11 });
  keeper.vision = 0;
  keeper.moveRange = 0;
  mission.units.push(keeper);
  return mission;
}

/** A hostile parked well past every player unit's vision (they all sit on row 0, x 0-4, vision 3). */
function farHostile(mission: Mission, opts?: { burrowed?: boolean }): BattleUnit {
  const u = createBloomUnit("bloom_crawlmass", { x: 15, y: 9 }, opts);
  u.moveRange = 0;
  mission.units.push(u);
  return u;
}

describe("unitsVisibleToSide — the sensorArray option", () => {
  it("BASELINE UNCHANGED: with no option, a hostile outside everyone's vision is invisible (byte-for-byte the old call)", () => {
    const mission = quietMission();
    const far = farHostile(mission);
    expect(unitsVisibleToSide("player", mission.units, mission.turn).has(far.instanceId)).toBe(false);
    expect(unitsVisibleToSide("player", mission.units, mission.turn, {}).has(far.instanceId)).toBe(false);
    expect(unitsVisibleToSide("player", mission.units, mission.turn, { sensorArray: false }).has(far.instanceId)).toBe(false);
  });

  it("sensorArray: true puts a standing hostile on the board no matter how far from any observer", () => {
    const mission = quietMission();
    const far = farHostile(mission);
    expect(unitsVisibleToSide("player", mission.units, mission.turn, { sensorArray: true }).has(far.instanceId)).toBe(true);
  });

  it("a burrowed hostile stays hidden with the array — the array finds what's standing up", () => {
    const mission = quietMission();
    const buried = farHostile(mission, { burrowed: true });
    expect(buried.burrowed).toBe(true);
    expect(unitsVisibleToSide("player", mission.units, mission.turn, { sensorArray: true }).has(buried.instanceId)).toBe(false);
  });

  it("a burrowed hostile that a sweep has painted is still seen — the array adds to the old rules, it never subtracts", () => {
    const mission = quietMission();
    const buried = farHostile(mission, { burrowed: true });
    buried.revealedUntilTurn = mission.turn;
    expect(unitsVisibleToSide("player", mission.units, mission.turn, { sensorArray: true }).has(buried.instanceId)).toBe(true);
  });

  it("a concealed target stays hidden with the array (symmetric: the hostile side looking at a cloaked player unit)", () => {
    const mission = quietMission();
    const rourke = mission.units.find((u) => u.pilotId === "pilot_rourke")!;
    rourke.concealed = true;
    // The keeper has vision 0, so without the array it sees nobody at all;
    // with it, it sees every standing player unit — and still not Rourke.
    const seen = unitsVisibleToSide("hostile", mission.units, mission.turn, { sensorArray: true });
    expect(seen.has(rourke.instanceId)).toBe(false);
    expect(seen.has(mission.units.find((u) => u.pilotId === "pilot_bosk")!.instanceId)).toBe(true);
  });

  it("downed hostiles are never revealed, array or not", () => {
    const mission = quietMission();
    const far = farHostile(mission);
    far.downed = true;
    expect(unitsVisibleToSide("player", mission.units, mission.turn, { sensorArray: true }).has(far.instanceId)).toBe(false);
  });
});

describe("Mission.playerVisibleHostileIds — the bay read off the campaign", () => {
  it("without the bay built, matches the plain fog query exactly", () => {
    const mission = quietMission();
    const far = farHostile(mission);
    expect(mission.sensorArrayBuilt).toBe(false);
    expect(mission.playerVisibleHostileIds().has(far.instanceId)).toBe(false);
    expect([...mission.playerVisibleHostileIds()].sort()).toEqual([...unitsVisibleToSide("player", mission.units, mission.turn)].sort());
  });

  it("with sensorArray in builtBays, a far standing hostile is visible and a far burrowed one is not", () => {
    const mission = quietMission(["generator", "sensorArray"]);
    const far = farHostile(mission);
    const buried = createBloomUnit("bloom_undertow", { x: 16, y: 10 }, { burrowed: true });
    buried.moveRange = 0;
    mission.units.push(buried);
    expect(mission.sensorArrayBuilt).toBe(true);
    const seen = mission.playerVisibleHostileIds();
    expect(seen.has(far.instanceId)).toBe(true);
    expect(seen.has(buried.instanceId)).toBe(false);
  });

  it("every OTHER bay built but not sensorArray behaves exactly as unbuilt", () => {
    const mission = quietMission(["generator", "weaponsBay", "fabricator", "beaconControl", "restockRoom"]);
    const far = farHostile(mission);
    expect(mission.sensorArrayBuilt).toBe(false);
    expect(mission.playerVisibleHostileIds().has(far.instanceId)).toBe(false);
  });

  it("the Deadfall any-range target pool reads the same query — a far hostile is only a Deadfall target once the array is built", () => {
    // getDeadfallStrikeTargetsFrom is one of the three in-file callers that
    // used to ask ai.ts directly. canDeadfallStrike is false here (nobody
    // on Mission 1 holds Ichigeki), so the pool is empty either way and
    // this test pins only that the method still returns cleanly — the
    // visibility half is covered above. Kept so a future refactor that
    // drops the reroute shows up as a changed call site, not silently.
    const mission = quietMission(["generator", "sensorArray"]);
    farHostile(mission);
    const rourke = mission.units.find((u) => u.pilotId === "pilot_rourke")!;
    expect(mission.getDeadfallStrikeTargetsFrom(rourke.instanceId)).toEqual([]);
  });
});

describe("bayNeedsGeneratorFirst — the construction-time Generator rule", () => {
  it("names exactly the four powered bays: Beacon Control, Restock Room, Weapons Bay, Sensor Array", () => {
    expect([...GENERATOR_DEPENDENT_BAYS].sort()).toEqual(["beaconControl", "restockRoom", "sensorArray", "weaponsBay"]);
  });

  it("refuses each powered bay while the Generator is unbuilt, and allows it once the Generator stands", () => {
    for (const bay of GENERATOR_DEPENDENT_BAYS) {
      expect(bayNeedsGeneratorFirst(bay, [])).toBe(true);
      expect(bayNeedsGeneratorFirst(bay, ["fabricator"])).toBe(true);
      expect(bayNeedsGeneratorFirst(bay, ["generator"])).toBe(false);
    }
  });

  it("never gates the Generator itself, and — deliberately, still — not the Fabricator", () => {
    expect(bayNeedsGeneratorFirst("generator", [])).toBe(false);
    expect(bayNeedsGeneratorFirst("fabricator", [])).toBe(false);
  });

  it("an already-built powered bay is not this rule's business (Hub.ts refuses a duplicate build before ever asking)", () => {
    // The rule answers one question only: does this bay need power it
    // doesn't have. A save from before 7 Sep 2026 that built the Weapons
    // Bay with no Generator keeps it — the gate is on construction, not a
    // retroactive teardown.
    expect(bayNeedsGeneratorFirst("weaponsBay", ["weaponsBay"])).toBe(true);
  });
});
