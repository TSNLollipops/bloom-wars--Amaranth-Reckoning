// src/data/__tests__/combatWorry.test.ts
// Worries System, build order step 3, 10 Sep 2026 — pure unit tests for
// classifyCombatWorry() itself. Engine-side wiring (which mission.ts hook
// point pushes which event, using a real Mission and real pilots) is
// covered separately in engine/__tests__/combatWorry.test.ts, same split
// missionWorry.test.ts/worries.test.ts already use between formula and
// list-management tests.
import { describe, it, expect } from "vitest";
import { classifyCombatWorry, REPAIR_INTENSITY_BASE, REPAIR_INTENSITY_MAX, COMBAT_WORRY_EXPIRY_MS } from "../combatWorry";

describe("classifyCombatWorry", () => {
  it("kill -> combat_kill, shark", () => {
    const result = classifyCombatWorry({ kind: "kill" });
    expect(result.source).toBe("combat_kill");
    expect(result.catalyst).toBe("shark");
    expect(result.intensity).toBeGreaterThan(0);
    expect(result.intensity).toBeLessThanOrEqual(1);
  });

  it("downed -> combat_downed, rabbit", () => {
    const result = classifyCombatWorry({ kind: "downed" });
    expect(result.source).toBe("combat_downed");
    expect(result.catalyst).toBe("rabbit");
  });

  it("overwatch_trigger -> combat_overwatch, wolf", () => {
    const result = classifyCombatWorry({ kind: "overwatch_trigger" });
    expect(result.source).toBe("combat_overwatch");
    expect(result.catalyst).toBe("wolf");
  });

  it("dodge -> combat_dodge, cat", () => {
    const result = classifyCombatWorry({ kind: "dodge" });
    expect(result.source).toBe("combat_dodge");
    expect(result.catalyst).toBe("cat");
  });

  describe("permadeath_check", () => {
    it("permanentlyLost: true -> combat_permadeath_lost, raven, the heaviest intensity of any source", () => {
      const lost = classifyCombatWorry({ kind: "permadeath_check", permanentlyLost: true });
      expect(lost.source).toBe("combat_permadeath_lost");
      expect(lost.catalyst).toBe("raven");
      const others = [
        classifyCombatWorry({ kind: "kill" }),
        classifyCombatWorry({ kind: "downed" }),
        classifyCombatWorry({ kind: "overwatch_trigger" }),
        classifyCombatWorry({ kind: "dodge" }),
        classifyCombatWorry({ kind: "permadeath_check", permanentlyLost: false }),
      ];
      for (const other of others) expect(lost.intensity).toBeGreaterThan(other.intensity);
    });

    it("permanentlyLost: false -> combat_permadeath_recoverable, fox — a distinct source, not the same entry re-tagged", () => {
      const recoverable = classifyCombatWorry({ kind: "permadeath_check", permanentlyLost: false });
      expect(recoverable.source).toBe("combat_permadeath_recoverable");
      expect(recoverable.catalyst).toBe("fox");
      const lost = classifyCombatWorry({ kind: "permadeath_check", permanentlyLost: true });
      expect(recoverable.source).not.toBe(lost.source);
      expect(recoverable.catalyst).not.toBe(lost.catalyst);
    });
  });

  describe("repair — scales with healedAmount, per the design doc's own callout", () => {
    it("a small heal lands close to the base intensity", () => {
      const result = classifyCombatWorry({ kind: "repair", healedAmount: 5 });
      expect(result.source).toBe("combat_repair");
      expect(result.catalyst).toBe("dog");
      expect(result.intensity).toBeCloseTo(REPAIR_INTENSITY_BASE + 5 * 0.01);
    });

    it("Data Pack §6's base 30 HP heal and Fieldwright's own 38 HP version (repair.test.ts) both land under the cap and strictly increase with amount", () => {
      const base = classifyCombatWorry({ kind: "repair", healedAmount: 30 });
      const fieldwright = classifyCombatWorry({ kind: "repair", healedAmount: 38 });
      expect(fieldwright.intensity).toBeGreaterThan(base.intensity);
      expect(fieldwright.intensity).toBeLessThan(REPAIR_INTENSITY_MAX);
    });

    it("a very large heal is capped at REPAIR_INTENSITY_MAX, never exceeds it", () => {
      const result = classifyCombatWorry({ kind: "repair", healedAmount: 10_000 });
      expect(result.intensity).toBe(REPAIR_INTENSITY_MAX);
    });

    it("a zero heal still classifies (the caller — mission.ts's repairUnit — is the one that gates on amount > 0, not this function)", () => {
      const result = classifyCombatWorry({ kind: "repair", healedAmount: 0 });
      expect(result.intensity).toBeCloseTo(REPAIR_INTENSITY_BASE);
    });
  });

  it("every intensity returned is within [0, 1]", () => {
    const events: Parameters<typeof classifyCombatWorry>[0][] = [
      { kind: "kill" },
      { kind: "repair", healedAmount: 50 },
      { kind: "downed" },
      { kind: "permadeath_check", permanentlyLost: true },
      { kind: "permadeath_check", permanentlyLost: false },
      { kind: "overwatch_trigger" },
      { kind: "dodge" },
    ];
    for (const event of events) {
      const result = classifyCombatWorry(event);
      expect(result.intensity).toBeGreaterThanOrEqual(0);
      expect(result.intensity).toBeLessThanOrEqual(1);
    }
  });

  it("every source id is distinct across the seven event shapes — no accidental collision that would make two different outcomes overwrite each other via upsertWorry", () => {
    const events: Parameters<typeof classifyCombatWorry>[0][] = [
      { kind: "kill" },
      { kind: "repair", healedAmount: 20 },
      { kind: "downed" },
      { kind: "permadeath_check", permanentlyLost: true },
      { kind: "permadeath_check", permanentlyLost: false },
      { kind: "overwatch_trigger" },
      { kind: "dodge" },
    ];
    const sources = events.map((e) => classifyCombatWorry(e).source);
    expect(new Set(sources).size).toBe(sources.length);
  });
});

describe("COMBAT_WORRY_EXPIRY_MS", () => {
  it("is a generous safety-net window, comfortably longer than any single mission attempt could plausibly run", () => {
    expect(COMBAT_WORRY_EXPIRY_MS).toBeGreaterThan(30 * 60_000); // > 30 real minutes
  });
});
