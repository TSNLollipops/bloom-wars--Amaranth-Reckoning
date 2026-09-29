import { describe, it, expect } from "vitest";
import { COMBAT_WORRY_LINES, pickCombatWorryLine } from "../combatWorryLines";

// 26 Sep 2026 customer playtest: three pilots said the same overwatch line
// on one turn. pickCombatWorryLine now skips lines already spoken this
// mission while the pool has anything else left.
describe("pickCombatWorryLine: no repeats within a mission", () => {
  it("never returns an already-used line while fresh ones remain", () => {
    const bank = COMBAT_WORRY_LINES.combat_overwatch!;
    const used = new Set<string>();
    for (let i = 0; i < bank.length; i++) {
      const line = pickCombatWorryLine("combat_overwatch", () => 0, used)!;
      expect(used.has(line)).toBe(false);
      used.add(line);
    }
    expect(used.size).toBe(bank.length);
  });

  it("falls back to the whole pool once every line has been used", () => {
    const bank = COMBAT_WORRY_LINES.combat_overwatch!;
    const line = pickCombatWorryLine("combat_overwatch", () => 0, new Set(bank));
    expect(bank).toContain(line);
  });

  it("behaves exactly as before when no used-set is passed", () => {
    const bank = COMBAT_WORRY_LINES.combat_overwatch!;
    expect(pickCombatWorryLine("combat_overwatch", () => 0.99)).toBe(bank[bank.length - 1]);
  });
});
