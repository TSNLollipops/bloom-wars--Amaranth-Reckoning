import { describe, it, expect } from "vitest";
import { isCooldownReady, startCooldown, cooldownTurnsRemaining } from "../cooldown";

describe("isCooldownReady", () => {
  it("reads ready when readyAtTurn is 0 (never started) regardless of currentTurn", () => {
    expect(isCooldownReady(0, 0)).toBe(true);
    expect(isCooldownReady(0, 5)).toBe(true);
  });

  it("reads not-ready strictly before readyAtTurn, ready at and after it", () => {
    expect(isCooldownReady(5, 4)).toBe(false);
    expect(isCooldownReady(5, 5)).toBe(true);
    expect(isCooldownReady(5, 6)).toBe(true);
  });
});

describe("startCooldown", () => {
  it("returns currentTurn + cooldownTurns", () => {
    expect(startCooldown(3, 4)).toBe(7);
  });

  it("a 0-turn cooldown means ready again on the very same turn", () => {
    expect(startCooldown(3, 0)).toBe(3);
    expect(isCooldownReady(startCooldown(3, 0), 3)).toBe(true);
  });

  it("clamps a negative cooldownTurns to 0 rather than moving readyAtTurn backward", () => {
    expect(startCooldown(3, -5)).toBe(3);
  });
});

describe("cooldownTurnsRemaining", () => {
  it("is 0 once ready, positive while waiting", () => {
    expect(cooldownTurnsRemaining(5, 5)).toBe(0);
    expect(cooldownTurnsRemaining(5, 8)).toBe(0);
    expect(cooldownTurnsRemaining(5, 2)).toBe(3);
  });

  it("round-trips with startCooldown: using a cooldown then checking remaining on the same turn reports the full length", () => {
    const readyAt = startCooldown(10, 4);
    expect(cooldownTurnsRemaining(readyAt, 10)).toBe(4);
  });
});
