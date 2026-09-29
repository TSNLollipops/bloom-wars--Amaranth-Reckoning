// src/engine/__tests__/crewReactionsSettings.test.ts — the Formula v2 toggle, 28 Sep 2026.
// Plain Node has no localStorage, which is exactly the "no storage" case: it must read ON.
import { describe, it, expect } from "vitest";
import { areCrewReactionsV2Enabled, setCrewReactionsV2Enabled } from "../crewReactionsSettings";

describe("crew reactions v2 toggle", () => {
  it("reads ON with no storage, and a write without storage does not throw", () => {
    expect(areCrewReactionsV2Enabled()).toBe(true);
    expect(() => setCrewReactionsV2Enabled(false)).not.toThrow();
  });

  it("round-trips through a storage when one exists", () => {
    const store = new Map<string, string>();
    const g = globalThis as { localStorage?: unknown };
    g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    try {
      expect(areCrewReactionsV2Enabled()).toBe(true);
      setCrewReactionsV2Enabled(false);
      expect(areCrewReactionsV2Enabled()).toBe(false);
      setCrewReactionsV2Enabled(true);
      expect(areCrewReactionsV2Enabled()).toBe(true);
    } finally {
      delete g.localStorage;
    }
  });
});
