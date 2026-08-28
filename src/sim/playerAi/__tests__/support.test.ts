// Regression coverage for sim/playerAi/support.ts's own repair-target
// search — added 28 Aug 2026 alongside Munti's base Repair range change
// (1 -> DEFAULT_REPAIR_RANGE, Rapid Response one tile further). This
// module's own header explains why it has to match engine/mission.ts's
// getRepairableFrom() exactly (see engine/__tests__/repair.test.ts for
// that side); these tests pin the same range edges from the Player AI's
// side so the two can't silently drift apart again.
import { describe, it, expect } from "vitest";
import { testUnit } from "../../../engine/__tests__/testHelpers";
import { findCriticalRepairTarget, findRoutineRepairTarget, CRITICAL_ALLY_HP_FRACTION } from "../support";
import { DEFAULT_REPAIR_RANGE, RAPID_RESPONSE_REPAIR_RANGE } from "../../../data/weaponBranches";

describe("sim/playerAi/support repair-target search", () => {
  it("default range (DEFAULT_REPAIR_RANGE): finds an ally at the range edge, ignores one tile beyond", () => {
    const healer = testUnit("munti", { x: 0, y: 0 });
    healer.abilities = ["abil_repair"];
    const atEdge = testUnit("munti", { x: DEFAULT_REPAIR_RANGE, y: 0 });
    const oneBeyond = testUnit("munti", { x: DEFAULT_REPAIR_RANGE + 1, y: 0 });
    atEdge.currentHp = atEdge.maxHp * (CRITICAL_ALLY_HP_FRACTION - 0.1);
    oneBeyond.currentHp = oneBeyond.maxHp * (CRITICAL_ALLY_HP_FRACTION - 0.1);

    expect(findCriticalRepairTarget(healer, [healer, atEdge, oneBeyond])?.instanceId).toBe(atEdge.instanceId);
    expect(findCriticalRepairTarget(healer, [healer, oneBeyond])).toBeUndefined();
  });

  it("Rapid Response (RAPID_RESPONSE_REPAIR_RANGE): extends one tile past the default range, still ignores beyond that", () => {
    const healer = testUnit("munti", { x: 0, y: 0 });
    healer.abilities = ["abil_repair"];
    healer.weaponBranchId = "munti_rapid_response";
    const atExtendedEdge = testUnit("munti", { x: RAPID_RESPONSE_REPAIR_RANGE, y: 0 });
    const oneBeyond = testUnit("munti", { x: RAPID_RESPONSE_REPAIR_RANGE + 1, y: 0 });
    atExtendedEdge.currentHp = atExtendedEdge.maxHp * (CRITICAL_ALLY_HP_FRACTION - 0.1);
    oneBeyond.currentHp = oneBeyond.maxHp * (CRITICAL_ALLY_HP_FRACTION - 0.1);

    expect(findCriticalRepairTarget(healer, [healer, atExtendedEdge, oneBeyond])?.instanceId).toBe(atExtendedEdge.instanceId);
    expect(findCriticalRepairTarget(healer, [healer, oneBeyond])).toBeUndefined();
  });

  it("without Rapid Response, a unit at the extended range is still out of reach", () => {
    const healer = testUnit("munti", { x: 0, y: 0 });
    healer.abilities = ["abil_repair"];
    const atExtendedEdge = testUnit("munti", { x: RAPID_RESPONSE_REPAIR_RANGE, y: 0 }); // one past DEFAULT_REPAIR_RANGE
    atExtendedEdge.currentHp = atExtendedEdge.maxHp * (CRITICAL_ALLY_HP_FRACTION - 0.1);

    expect(findCriticalRepairTarget(healer, [healer, atExtendedEdge])).toBeUndefined();
  });

  it("among multiple in-range candidates, picks the worst HP fraction", () => {
    const healer = testUnit("munti", { x: 0, y: 0 });
    healer.abilities = ["abil_repair"];
    const lightlyHurt = testUnit("munti", { x: 1, y: 0 });
    const badlyHurt = testUnit("munti", { x: 2, y: 0 });
    lightlyHurt.currentHp = lightlyHurt.maxHp * 0.7; // below ROUTINE_ALLY_HP_FRACTION only
    badlyHurt.currentHp = badlyHurt.maxHp * 0.1; // below CRITICAL_ALLY_HP_FRACTION too

    expect(findRoutineRepairTarget(healer, [healer, lightlyHurt, badlyHurt])?.instanceId).toBe(badlyHurt.instanceId);
  });

  it("a unit without abil_repair never returns a target, however hurt or close an ally is", () => {
    const nonHealer = testUnit("munti", { x: 0, y: 0 }); // no abilities assigned
    const dying = testUnit("munti", { x: 1, y: 0 });
    dying.currentHp = 1;

    expect(findCriticalRepairTarget(nonHealer, [nonHealer, dying])).toBeUndefined();
  });
});
