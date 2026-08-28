// Data Pack §6's abil_repair: 30 HP base to an adjacent friendly unit,
// instead of attacking, once per turn; x1.25 if the Munti's own mek has
// Fieldwright as primary (Data Pack §5's MEK_TRACK_EFFECTS). Added after
// Maxime found the ability had data but no way to trigger it in the
// Battle scene during Mission 1a playtesting (22 Aug 2026).
import { describe, it, expect } from "vitest";
import { Mission } from "../mission";
import { MISSION_1A } from "../../data/campaign";
import { testUnit } from "./testHelpers";
import { MAX_ACTIONS_PER_TURN } from "../../data/combatTables";
import { DEFAULT_REPAIR_RANGE, RAPID_RESPONSE_REPAIR_RANGE } from "../../data/weaponBranches";

describe("Mission.repairUnit", () => {
  it("Barasj (Fieldwright primary) heals 38 HP (30 x 1.25, rounded) to an adjacent damaged ally", () => {
    const mission = new Mission(MISSION_1A);
    const healer = mission.units.find((u) => u.pilotId === "pilot_barasj")!;
    const target = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    healer.pos = { x: 5, y: 5 };
    target.pos = { x: 6, y: 5 };
    target.currentHp = target.maxHp - 50;

    const result = mission.repairUnit(healer.instanceId, target.instanceId);
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(38);
    expect(target.currentHp).toBe(target.maxHp - 50 + 38);
    // Repair costs 1 action and does NOT end the turn (two-action house
    // rule, Maxime, 22 Aug 2026) — Barasj still has an action left.
    expect(healer.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN - 1);
  });

  it("caps the heal at the target's max HP — no overheal", () => {
    const mission = new Mission(MISSION_1A);
    const healer = mission.units.find((u) => u.pilotId === "pilot_barasj")!;
    const target = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    healer.pos = { x: 5, y: 5 };
    target.pos = { x: 6, y: 5 };
    target.currentHp = target.maxHp - 5; // less than the 38 heal would give

    const result = mission.repairUnit(healer.instanceId, target.instanceId);
    expect(result!.amount).toBe(5);
    expect(target.currentHp).toBe(target.maxHp);
  });

  it("refuses a non-adjacent target, and (two-action house rule) can repair two different adjacent allies in one turn", () => {
    // This is the actual point of the two-action system for Munti, per
    // Maxime: "id build munties like medics in xcom" — a Specialist's
    // Medikit costs 1 action and doesn't end the turn, so it can patch up
    // two allies in the same turn. Verified against xcom.fandom.com.
    const mission = new Mission(MISSION_1A);
    const healer = mission.units.find((u) => u.pilotId === "pilot_barasj")!;
    const allyA = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    const allyB = mission.units.find((u) => u.pilotId === "pilot_thyns")!;
    const far = mission.units.find((u) => u.pilotId === "pilot_tourignie")!;
    healer.pos = { x: 5, y: 5 };
    allyA.pos = { x: 6, y: 5 };
    allyB.pos = { x: 4, y: 5 };
    far.pos = { x: 20, y: 20 };
    allyA.currentHp -= 10;
    allyB.currentHp -= 10;
    far.currentHp -= 10;

    expect(mission.repairUnit(healer.instanceId, far.instanceId)).toBeNull();

    const first = mission.repairUnit(healer.instanceId, allyA.instanceId);
    expect(first).not.toBeNull();
    expect(healer.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN - 1);

    const second = mission.repairUnit(healer.instanceId, allyB.instanceId);
    expect(second).not.toBeNull();
    expect(healer.actionsRemaining).toBe(0);

    // Out of actions now — even a third still-damaged-adjacent-ally target refuses.
    expect(mission.repairUnit(healer.instanceId, allyA.instanceId)).toBeNull();
  });

  it("refuses to repair an enemy, and refuses a unit with no abil_repair", () => {
    const mission = new Mission(MISSION_1A);
    const nonHealer = mission.units.find((u) => u.pilotId === "pilot_thyns")!; // Tank — no abil_repair
    const ally = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    const enemy = mission.units.find((u) => u.side === "hostile")!;
    nonHealer.pos = { x: 5, y: 5 };
    ally.pos = { x: 6, y: 5 };
    enemy.pos = { x: 4, y: 5 };

    const healer = mission.units.find((u) => u.pilotId === "pilot_barasj")!;
    healer.pos = { x: 5, y: 5 };

    expect(mission.repairUnit(nonHealer.instanceId, ally.instanceId)).toBeNull();
    expect(mission.repairUnit(healer.instanceId, enemy.instanceId)).toBeNull();
  });

  it("a healer with no matched pilot record (no Fieldwright bonus resolvable) heals the base 30 HP", () => {
    const mission = new Mission(MISSION_1A);
    const healer = testUnit("munti", { x: 0, y: 0 });
    healer.abilities = ["abil_repair"];
    mission.units.push(healer);
    const target = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    healer.pos = { x: 6, y: 6 };
    target.pos = { x: 7, y: 6 };
    target.currentHp -= 50;

    const result = mission.repairUnit(healer.instanceId, target.instanceId);
    expect(result!.amount).toBe(30);
  });

  it("getRepairableFrom mirrors getAttackableFrom's shape — adjacent allies only, empty once used", () => {
    const mission = new Mission(MISSION_1A);
    const healer = mission.units.find((u) => u.pilotId === "pilot_barasj")!;
    const ally = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    healer.pos = { x: 5, y: 5 };
    ally.pos = { x: 6, y: 5 };
    ally.currentHp -= 10; // must be damaged to be offered as a target — see next test

    expect(mission.getRepairableFrom(healer.instanceId, healer.pos).map((u) => u.instanceId)).toEqual([ally.instanceId]);
    mission.repairUnit(healer.instanceId, ally.instanceId);
    expect(mission.getRepairableFrom(healer.instanceId, healer.pos)).toEqual([]);
  });

  it("regression (Maxime, mission 1a, 22 Aug 2026): a full-HP ally is never offered as a repair target", () => {
    // Bug report: clicking Repair "healed the wrong unit" — the engine was
    // actually healing exactly who was clicked, but the target (Yren
    // Tourignie) was already at full HP, so the heal capped at 0 and the
    // action looked like it did nothing / hit the wrong person. Fix: don't
    // let the UI offer a full-HP ally as a target in the first place.
    const mission = new Mission(MISSION_1A);
    const healer = mission.units.find((u) => u.pilotId === "pilot_barasj")!;
    const fullHpAlly = mission.units.find((u) => u.pilotId === "pilot_tourignie")!;
    healer.pos = { x: 5, y: 5 };
    fullHpAlly.pos = { x: 6, y: 5 };
    expect(fullHpAlly.currentHp).toBe(fullHpAlly.maxHp);

    expect(mission.getRepairableFrom(healer.instanceId, healer.pos)).toEqual([]);
  });

  // Munti base Repair range, 28 Aug 2026: raised 1 -> DEFAULT_REPAIR_RANGE
  // (3), Rapid Response one tile further still — getRepairableFrom() used
  // to hardcode adjacent-only regardless of these constants; these two
  // tests pin the actual range edges now that it reads them.
  it("default range (DEFAULT_REPAIR_RANGE): reaches exactly to the range edge, refuses one tile beyond it", () => {
    const mission = new Mission(MISSION_1A);
    const healer = testUnit("munti", { x: 0, y: 0 });
    healer.abilities = ["abil_repair"];
    mission.units.push(healer);
    const atEdge = testUnit("munti", { x: DEFAULT_REPAIR_RANGE, y: 0 });
    const oneBeyond = testUnit("munti", { x: DEFAULT_REPAIR_RANGE + 1, y: 0 });
    atEdge.currentHp -= 10;
    oneBeyond.currentHp -= 10;
    mission.units.push(atEdge, oneBeyond);

    expect(mission.getRepairableFrom(healer.instanceId, healer.pos).map((u) => u.instanceId)).toEqual([atEdge.instanceId]);
    expect(mission.repairUnit(healer.instanceId, atEdge.instanceId)).not.toBeNull();
    expect(mission.repairUnit(healer.instanceId, oneBeyond.instanceId)).toBeNull();
  });

  it("Rapid Response (RAPID_RESPONSE_REPAIR_RANGE): extends one tile past the default range, still refuses beyond that", () => {
    const mission = new Mission(MISSION_1A);
    const healer = testUnit("munti", { x: 0, y: 0 });
    healer.abilities = ["abil_repair"];
    healer.weaponBranchId = "munti_rapid_response";
    mission.units.push(healer);
    const atExtendedEdge = testUnit("munti", { x: RAPID_RESPONSE_REPAIR_RANGE, y: 0 });
    const oneBeyond = testUnit("munti", { x: RAPID_RESPONSE_REPAIR_RANGE + 1, y: 0 });
    atExtendedEdge.currentHp -= 10;
    oneBeyond.currentHp -= 10;
    mission.units.push(atExtendedEdge, oneBeyond);

    expect(mission.getRepairableFrom(healer.instanceId, healer.pos).map((u) => u.instanceId)).toEqual([atExtendedEdge.instanceId]);
    expect(mission.repairUnit(healer.instanceId, atExtendedEdge.instanceId)).not.toBeNull();
    expect(mission.repairUnit(healer.instanceId, oneBeyond.instanceId)).toBeNull();
  });
});
