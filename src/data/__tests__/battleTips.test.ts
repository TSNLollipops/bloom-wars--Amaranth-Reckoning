import { describe, it, expect } from "vitest";
import { pickBattleTip, BATTLE_TIPS, type BattleTipContext } from "../battleTips";

const base: BattleTipContext = { idle: true, attackableCount: 0, repairableCount: 0, reinforcementsJustArrived: false, someUnitsDone: false };
const sel = (over: Partial<NonNullable<BattleTipContext["selected"]>> = {}) => ({ path: "meeps", actionsRemaining: 2, tilesMovedThisTurn: 0, hasAbilities: false, ...over });

describe("pickBattleTip", () => {
  it("shows nothing while not idle", () => {
    expect(pickBattleTip({ ...base, idle: false, selected: sel() }, new Set())).toBeNull();
  });
  it("teaches actions first on the first selection, then the class", () => {
    expect(pickBattleTip({ ...base, selected: sel() }, new Set())).toBe("actions");
    expect(pickBattleTip({ ...base, selected: sel() }, new Set(["actions"]))).toBe("class_meeps");
  });
  it("each class gets its own tip", () => {
    expect(pickBattleTip({ ...base, selected: sel({ path: "munti" }) }, new Set(["actions", "class_meeps"]))).toBe("class_munti");
  });
  it("range when something is attackable", () => {
    expect(pickBattleTip({ ...base, selected: sel(), attackableCount: 1 }, new Set(["actions", "class_meeps"]))).toBe("range");
  });
  it("moved-but-can-act after a move with 1 action left", () => {
    const seen = new Set(["actions", "class_meeps"]);
    expect(pickBattleTip({ ...base, selected: sel({ tilesMovedThisTurn: 3, actionsRemaining: 1 }) }, seen)).toBe("moved_can_act");
  });
  it("bloom bars on first Bloom hover, before range", () => {
    expect(pickBattleTip({ ...base, hovered: { kind: "bloom" } }, new Set())).toBe("bloom_bars");
    expect(pickBattleTip({ ...base, hovered: { kind: "bloom" } }, new Set(["bloom_bars"]))).toBe("range");
  });
  it("cover only on real cover (2+ dots)", () => {
    expect(pickBattleTip({ ...base, hovered: { kind: "tile", defenceStars: 1 } }, new Set())).toBeNull();
    expect(pickBattleTip({ ...base, hovered: { kind: "tile", defenceStars: 3 } }, new Set())).toBe("cover");
  });
  it("reinforcements beats everything", () => {
    expect(pickBattleTip({ ...base, selected: sel(), reinforcementsJustArrived: true }, new Set())).toBe("reinforcements");
  });
  it("never repeats a seen tip", () => {
    const all = new Set(Object.keys(BATTLE_TIPS));
    expect(pickBattleTip({ ...base, selected: sel({ tilesMovedThisTurn: 1, actionsRemaining: 1, hasAbilities: true }), attackableCount: 2, repairableCount: 1, hovered: { kind: "bloom" }, reinforcementsJustArrived: true, someUnitsDone: true }, all)).toBeNull();
  });
  it("no tip uses the engine's range notation", () => {
    for (const t of Object.values(BATTLE_TIPS)) expect(t).not.toMatch(/\b1-1\b/);
  });
});
