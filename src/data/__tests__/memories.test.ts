// src/data/__tests__/memories.test.ts
// Emotional Brain Phase 1, 12 Sep 2026 — the Ledger (data/memories.ts).
// Covers salience decay on the in-game-day clock, the cap and its
// weakest-evicted rule, the top-N ordering, and the small readers the
// surfaces and the drift use. Writers (Debrief, Hub) are covered in
// engine/__tests__/debriefCatalyst.test.ts.
import { describe, it, expect } from "vitest";
import {
  addMemory,
  topMemories,
  memoriesAbout,
  countMemories,
  echoLoad,
  memorySalience,
  MEMORY_CAP,
  MEMORY_DECAY_PER_DAY,
  MEMORY_FLOOR,
  MEMORY_BIRTH_WEIGHT,
  MEMORY_KIND_LABEL,
  type MemoryEntry,
  type MemoryKind,
} from "../memories";

function mem(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return { kind: "got_the_kill", at: 1000, day: 10, about: [], witnesses: [], echo: "anger", weight: 0.3, ...overrides };
}

describe("memorySalience — decays by in-game day, never below the floor", () => {
  it("is the birth weight on the day it happened", () => {
    expect(memorySalience(mem({ weight: 0.7, day: 10 }), 10)).toBeCloseTo(0.7);
  });

  it("decays geometrically per day", () => {
    const m = mem({ weight: 1.0, day: 10 });
    expect(memorySalience(m, 11)).toBeCloseTo(MEMORY_DECAY_PER_DAY);
    expect(memorySalience(m, 20)).toBeCloseTo(Math.pow(MEMORY_DECAY_PER_DAY, 10));
  });

  it("a two-week-old loss still outranks a fresh minor memory; a month-old one has faded to about that level", () => {
    const loss = mem({ kind: "lost_squadmate", weight: MEMORY_BIRTH_WEIGHT.lost_squadmate, day: 1 });
    const kill = mem({ kind: "got_the_kill", weight: MEMORY_BIRTH_WEIGHT.got_the_kill, day: 15 });
    expect(memorySalience(loss, 15)).toBeGreaterThan(memorySalience(kill, 15));
    const monthOld = memorySalience(loss, 31);
    expect(monthOld).toBeGreaterThan(0.2);
    expect(monthOld).toBeLessThan(0.4);
  });

  it("never drops below the floor, and never exceeds 1", () => {
    expect(memorySalience(mem({ weight: 0.2, day: 0 }), 10_000)).toBe(MEMORY_FLOOR);
    expect(memorySalience(mem({ weight: 5, day: 0 }), 0)).toBe(1);
  });

  it("a future-dated memory (clock went backwards) reads as fresh, not negative-aged", () => {
    expect(memorySalience(mem({ weight: 0.5, day: 50 }), 10)).toBeCloseTo(0.5);
  });
});

describe("addMemory — fixed small stack, weakest evicted", () => {
  it("appends under the cap and returns a new array", () => {
    const before: MemoryEntry[] = [mem()];
    const after = addMemory(before, mem({ kind: "was_downed" }), 10);
    expect(after).toHaveLength(2);
    expect(before).toHaveLength(1);
  });

  it("treats undefined as an empty list (an old save)", () => {
    expect(addMemory(undefined, mem(), 10)).toHaveLength(1);
  });

  it("evicts the least salient entry once over the cap, not the oldest", () => {
    let list: MemoryEntry[] = [];
    for (let i = 0; i < MEMORY_CAP; i++) list = addMemory(list, mem({ weight: 0.5, day: i, at: i }), MEMORY_CAP);
    // A loud old loss (day 0, weight 1.0) must survive; the weakest is a
    // weight-0.5 entry from an early day, not the loss.
    list = addMemory(list, mem({ kind: "lost_squadmate", weight: 1.0, day: 0, at: -1 }), MEMORY_CAP);
    expect(list).toHaveLength(MEMORY_CAP);
    expect(list.some((m) => m.kind === "lost_squadmate")).toBe(true);
    list = addMemory(list, mem({ weight: 0.9, day: MEMORY_CAP, at: 999 }), MEMORY_CAP);
    expect(list).toHaveLength(MEMORY_CAP);
    expect(list.some((m) => m.kind === "lost_squadmate")).toBe(true);
    expect(list.some((m) => m.at === 999)).toBe(true);
  });

  it("on a salience tie, the older entry goes", () => {
    let list: MemoryEntry[] = [];
    for (let i = 0; i < MEMORY_CAP; i++) list = addMemory(list, mem({ weight: 0.5, day: 5, at: i }), 5);
    list = addMemory(list, mem({ weight: 0.5, day: 5, at: 500 }), 5);
    expect(list.some((m) => m.at === 0)).toBe(false);
    expect(list.some((m) => m.at === 500)).toBe(true);
  });
});

describe("topMemories, memoriesAbout, countMemories, echoLoad", () => {
  const list: MemoryEntry[] = [
    mem({ kind: "got_the_kill", weight: 0.3, day: 10, at: 1, echo: "anger" }),
    mem({ kind: "lost_squadmate", weight: 1.0, day: 2, at: 2, echo: "sadness", about: ["pilot_bosk"] }),
    mem({ kind: "was_downed", weight: 0.7, day: 9, at: 3, echo: "fear" }),
    mem({ kind: "saw_fall", weight: 0.5, day: 9, at: 4, echo: "fear", about: ["pilot_bosk"] }),
  ];

  it("topMemories orders by current salience, loudest first, and honours n", () => {
    // The loss is 8 days old (1.0 × 0.96^8 ≈ 0.72) and still edges the
    // day-old downing (0.7 × 0.96 ≈ 0.67); the fresh kill (0.3) is last.
    const top = topMemories(list, 10, 2);
    expect(top.map((m) => m.kind)).toEqual(["lost_squadmate", "was_downed"]);
    expect(topMemories(list, 10, 0)).toEqual([]);
    expect(topMemories(undefined, 10)).toEqual([]);
  });

  it("a tie on salience goes to the more recent memory", () => {
    const tie = [mem({ weight: 0.5, day: 10, at: 1 }), mem({ weight: 0.5, day: 10, at: 2 })];
    expect(topMemories(tie, 10, 1)[0].at).toBe(2);
  });

  it("memoriesAbout finds every memory naming a pilot, most recent first", () => {
    const about = memoriesAbout(list, "pilot_bosk");
    expect(about.map((m) => m.kind)).toEqual(["saw_fall", "lost_squadmate"]);
    expect(memoriesAbout(list, "nobody")).toEqual([]);
  });

  it("countMemories tallies one kind", () => {
    expect(countMemories(list, "lost_squadmate")).toBe(1);
    expect(countMemories(list, "mission_won")).toBe(0);
    expect(countMemories(undefined, "mission_won")).toBe(0);
  });

  it("echoLoad sums current salience per echo", () => {
    const load = echoLoad(list, 10);
    expect(load.fear).toBeGreaterThan(load.anger);
    expect(load.love).toBe(0);
    expect(load.sadness).toBeCloseTo(memorySalience(list[1], 10));
  });
});

describe("content tables", () => {
  const kinds: MemoryKind[] = [
    "saw_fall", "was_downed", "was_pulled_out", "lost_squadmate", "got_the_kill", "held_the_line", "patched_someone",
    "mission_won", "mission_lost", "blowup", "breakdown", "was_insulted", "was_gifted", "asked_out",
  ];

  it("every kind has a birth weight in (0, 1] and a label", () => {
    for (const k of kinds) {
      expect(MEMORY_BIRTH_WEIGHT[k]).toBeGreaterThan(0);
      expect(MEMORY_BIRTH_WEIGHT[k]).toBeLessThanOrEqual(1);
      expect(MEMORY_KIND_LABEL[k].length).toBeGreaterThan(0);
    }
  });

  it("losses outrank everything else at birth", () => {
    for (const k of kinds) {
      if (k === "lost_squadmate") continue;
      expect(MEMORY_BIRTH_WEIGHT.lost_squadmate).toBeGreaterThan(MEMORY_BIRTH_WEIGHT[k]);
    }
  });

  it("labels follow the Archive prose rule: no em dashes, no semicolons", () => {
    for (const k of kinds) {
      expect(MEMORY_KIND_LABEL[k]).not.toMatch(/[—;]/);
    }
  });
});
