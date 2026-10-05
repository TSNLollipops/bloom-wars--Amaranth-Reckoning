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
  it("warns about incoming reinforcements, but an arrival still wins", () => {
    expect(pickBattleTip({ ...base, reinforcementsIncoming: true }, new Set(["actions"]))).toBe("reinforcements_incoming");
    expect(pickBattleTip({ ...base, reinforcementsIncoming: true, reinforcementsJustArrived: true }, new Set(["actions"]))).toBe("reinforcements");
  });
  it("the incoming warning never beats the very first lesson", () => {
    expect(pickBattleTip({ ...base, reinforcementsIncoming: true }, new Set())).toBeNull();
    expect(pickBattleTip({ ...base, reinforcementsIncoming: true, selected: sel() }, new Set())).toBe("actions");
  });
  it("interdict for a unit that carries it, after the basics", () => {
    const seen = new Set(["actions", "class_tank", "abilities"]);
    expect(pickBattleTip({ ...base, selected: sel({ path: "tank", hasAbilities: true, hasInterdict: true }) }, seen)).toBe("interdict");
    expect(pickBattleTip({ ...base, selected: sel({ path: "tank", hasAbilities: true }) }, seen)).toBeNull();
  });
  it("overwatch only when the unit can use it and has nothing to shoot", () => {
    const seen = new Set(["actions", "class_meeps"]);
    expect(pickBattleTip({ ...base, selected: sel({ canOverwatch: true }) }, seen)).toBe("overwatch");
    expect(pickBattleTip({ ...base, selected: sel({ canOverwatch: true }), attackableCount: 1 }, new Set([...seen, "range", "triangle"]))).toBeNull();
    expect(pickBattleTip({ ...base, selected: sel({ canOverwatch: false }) }, seen)).toBeNull();
  });
  it("never repeats a seen tip", () => {
    const all = new Set(Object.keys(BATTLE_TIPS));
    expect(pickBattleTip({ ...base, selected: sel({ tilesMovedThisTurn: 1, actionsRemaining: 1, hasAbilities: true, canOverwatch: true, hasInterdict: true }), attackableCount: 2, repairableCount: 1, hovered: { kind: "bloom" }, reinforcementsJustArrived: true, reinforcementsIncoming: true, someUnitsDone: true }, all)).toBeNull();
  });
  it("no tip uses the engine's range notation", () => {
    for (const t of Object.values(BATTLE_TIPS)) expect(t).not.toMatch(/\b1-1\b/);
  });
});
