// src/data/__tests__/worries.test.ts
// Worries System, build order step 2, 6 Sep 2026 — first real test file
// for the general Worries list itself (see worries.ts's own header for the
// full design pass). Covers the four exported functions directly: the
// fixed-small-stack cap and eviction rule, explicit removal, expiry
// pruning, and "loudest wins." pickSoloEcho's own consumption of topWorry
// is covered separately in ambientLines.test.ts; Mission Worry's specific
// wiring (catalyst choice, the two-independent-rolls design) is Hub.ts-only
// and only verifiable live, same as the rest of that scene.
import { describe, it, expect } from "vitest";
import { upsertWorry, removeWorry, pruneExpiredWorries, loudestWorry, WORRIES_STACK_CAP, type WorryEntry } from "../worries";

function entry(overrides: Partial<WorryEntry> = {}): WorryEntry {
  return { source: "mission_pilot_missing", catalyst: "wolf", intensity: 0.5, bornAt: 0, expiresAt: 1000, ...overrides };
}

describe("upsertWorry — insert-or-refresh with a fixed small stack cap", () => {
  it("inserts a first entry into an empty list", () => {
    const result = upsertWorry([], entry());
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("mission_pilot_missing");
  });

  it("a fresh reading from the SAME source replaces its own prior entry, never stacks against itself", () => {
    const stale = entry({ intensity: 0.2 });
    const fresh = entry({ intensity: 0.9 });
    const result = upsertWorry([stale], fresh);
    expect(result).toHaveLength(1);
    expect(result[0].intensity).toBe(0.9);
  });

  it("stays under the cap untouched when different sources fit within it", () => {
    // Cast source since the real union only has one member today
    // (mission_pilot_missing) — these stand in for steps 3/4's future
    // sources without waiting on them to exist.
    const a = entry({ source: "a" as WorryEntry["source"], intensity: 0.3 });
    const b = entry({ source: "b" as WorryEntry["source"], intensity: 0.6 });
    const result = upsertWorry([a], b);
    expect(result).toHaveLength(2);
  });

  it("bumps the weakest entry once a NEW source would push the list past the cap", () => {
    const entries: WorryEntry[] = [];
    let list = entries;
    for (let i = 0; i < WORRIES_STACK_CAP; i++) {
      list = upsertWorry(list, entry({ source: `s${i}` as WorryEntry["source"], intensity: 0.1 * (i + 1) }));
    }
    expect(list).toHaveLength(WORRIES_STACK_CAP);
    // The weakest so far is s0 at intensity 0.1 — a new, louder source
    // should bump exactly that one, not any of the others.
    const result = upsertWorry(list, entry({ source: "new" as WorryEntry["source"], intensity: 0.99 }));
    expect(result).toHaveLength(WORRIES_STACK_CAP);
    expect(result.some((e) => (e.source as string) === "s0")).toBe(false);
    expect(result.some((e) => (e.source as string) === "new")).toBe(true);
  });
});

describe("removeWorry — explicit removal, independent of expiresAt", () => {
  it("removes only the named source, leaving everything else untouched", () => {
    const a = entry({ source: "mission_pilot_missing" });
    const b = entry({ source: "other" as WorryEntry["source"] });
    const result = removeWorry([a, b], "mission_pilot_missing");
    expect(result).toEqual([b]);
  });

  it("is a no-op on a list that doesn't contain the source", () => {
    const b = entry({ source: "other" as WorryEntry["source"] });
    expect(removeWorry([b], "mission_pilot_missing")).toEqual([b]);
  });
});

describe("pruneExpiredWorries — drops anything past its own expiresAt", () => {
  it("drops an expired entry", () => {
    const result = pruneExpiredWorries([entry({ expiresAt: 500 })], 1000);
    expect(result).toEqual([]);
  });

  it("keeps an entry still within its window", () => {
    const live = entry({ expiresAt: 2000 });
    const result = pruneExpiredWorries([live], 1000);
    expect(result).toEqual([live]);
  });

  it("expiresAt is exclusive — now === expiresAt counts as expired, matching isNpcEngaged's own convention", () => {
    const result = pruneExpiredWorries([entry({ expiresAt: 1000 })], 1000);
    expect(result).toEqual([]);
  });
});

describe("loudestWorry — Gate 3's own 'loudest thing wins' rule", () => {
  it("returns undefined for an empty list", () => {
    expect(loudestWorry([], 1000)).toBeUndefined();
  });

  it("returns undefined once every entry has expired", () => {
    expect(loudestWorry([entry({ expiresAt: 500 })], 1000)).toBeUndefined();
  });

  it("picks the highest-intensity entry among several", () => {
    const quiet = entry({ source: "quiet" as WorryEntry["source"], intensity: 0.2 });
    const loud = entry({ source: "loud" as WorryEntry["source"], intensity: 0.8 });
    const mid = entry({ source: "mid" as WorryEntry["source"], intensity: 0.5 });
    expect(loudestWorry([quiet, loud, mid], 0)?.source).toBe("loud");
  });

  it("ignores an expired entry even if it would otherwise be loudest", () => {
    const expiredLoud = entry({ source: "expiredLoud" as WorryEntry["source"], intensity: 0.99, expiresAt: 500 });
    const live = entry({ source: "live" as WorryEntry["source"], intensity: 0.4, expiresAt: 2000 });
    expect(loudestWorry([expiredLoud, live], 1000)?.source).toBe("live");
  });
});
