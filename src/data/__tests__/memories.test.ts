// src/data/__tests__/memories.test.ts
// Emotional Brain Phase 1, 12 Sep 2026 — the Ledger (data/memories.ts).
// Covers salience decay on the in-game-day clock, the cap and its
// weakest-evicted rule (retention, not salience, since 22 Sep 2026), the
// top-N ordering, and the small readers the surfaces and the drift use.
// Writers (Debrief, Hub) are covered in engine/__tests__/debriefCatalyst.test.ts.
import { describe, it, expect } from "vitest";
import {
  addMemory,
  topMemories,
  memoriesAbout,
  countMemories,
  echoLoad,
  memorySalience,
  memoryRetention,
  MEMORY_CAP,
  MEMORY_DECAY_PER_DAY,
  MEMORY_RETENTION_DECAY_PER_DAY,
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

  it("evicts the least retained entry once over the cap, not the oldest", () => {
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

  it("on a retention tie, the older entry goes", () => {
    let list: MemoryEntry[] = [];
    for (let i = 0; i < MEMORY_CAP; i++) list = addMemory(list, mem({ weight: 0.5, day: 5, at: i }), 5);
    list = addMemory(list, mem({ weight: 0.5, day: 5, at: 500 }), 5);
    expect(list.some((m) => m.at === 0)).toBe(false);
    expect(list.some((m) => m.at === 500)).toBe(true);
  });
});

describe("memoryRetention — the eviction clock, far slower than the salience clock", () => {
  it("is the birth weight on the day it happened, same as salience", () => {
    const m = mem({ weight: 0.7, day: 10 });
    expect(memoryRetention(m, 10)).toBeCloseTo(0.7);
    expect(memoryRetention(m, 10)).toBeCloseTo(memorySalience(m, 10));
  });

  it("decays on its own, much slower constant", () => {
    expect(MEMORY_RETENTION_DECAY_PER_DAY).toBeGreaterThan(MEMORY_DECAY_PER_DAY);
    const m = mem({ weight: 1.0, day: 0 });
    expect(memoryRetention(m, 60)).toBeCloseTo(Math.pow(MEMORY_RETENTION_DECAY_PER_DAY, 60));
    expect(memoryRetention(m, 60)).toBeGreaterThan(0.7);
  });

  it("a two-month-old loss is quiet by salience but still firmly held by retention", () => {
    // This is the exact pair the old eviction got backwards: salience says
    // the loss (≈0.086) is weaker than a fresh mission_won (0.2); retention
    // says the loss (≈0.74) holds its place easily.
    const loss = mem({ kind: "lost_squadmate", weight: MEMORY_BIRTH_WEIGHT.lost_squadmate, day: 0 });
    const win = mem({ kind: "mission_won", weight: MEMORY_BIRTH_WEIGHT.mission_won, day: 60 });
    expect(memorySalience(loss, 60)).toBeLessThan(memorySalience(win, 60));
    expect(memoryRetention(loss, 60)).toBeGreaterThan(memoryRetention(win, 60));
  });

  it("floors and caps like salience does", () => {
    expect(memoryRetention(mem({ weight: 0.2, day: 0 }), 100_000)).toBe(MEMORY_FLOOR);
    expect(memoryRetention(mem({ weight: 5, day: 0 }), 0)).toBe(1);
  });

  it("memorySalience is untouched by the split — readers still hear recent things loudest", () => {
    const loss = mem({ kind: "lost_squadmate", weight: 1.0, day: 0 });
    expect(memorySalience(loss, 60)).toBeCloseTo(Math.pow(MEMORY_DECAY_PER_DAY, 60), 3);
    expect(memorySalience(loss, 60)).toBeLessThan(0.1);
  });
});

describe("addMemory — eviction under retention, the 22 Sep 2026 fix", () => {
  /** A ledger full of ordinary weight-0.3 memories spread over `span` days. */
  function fullOf(weight: number, span: number, at0 = 0): MemoryEntry[] {
    let list: MemoryEntry[] = [];
    for (let i = 0; i < MEMORY_CAP; i++) {
      const day = Math.round((i / (MEMORY_CAP - 1)) * span);
      list = addMemory(list, mem({ weight, day, at: at0 + i }), span);
    }
    return list;
  }

  it("a two-month-old loss survives a fresh mission_won — the defect this fixes", () => {
    // Under the old rule the loss (salience 0.086) was the weakest thing in
    // the ledger and went. Under retention it holds at 0.74; whatever goes,
    // it is the entry with the least retention, and it is not the loss.
    let list = fullOf(0.3, 59, 100);
    list = list.map((m, i) => (i === 0 ? { ...m, kind: "lost_squadmate" as const, weight: 1.0, day: 0, at: 1 } : m));
    const win = mem({ kind: "mission_won", weight: MEMORY_BIRTH_WEIGHT.mission_won, day: 60, at: 999 });
    const after = addMemory(list, win, 60);
    expect(after).toHaveLength(MEMORY_CAP);
    expect(after.some((m) => m.kind === "lost_squadmate")).toBe(true);
    const gone = [...list, win].find((m) => !after.some((k) => k.at === m.at))!;
    const minRetention = Math.min(...[...list, win].map((m) => memoryRetention(m, 60)));
    expect(memoryRetention(gone, 60)).toBeCloseTo(minRetention);
    expect(gone.kind).not.toBe("lost_squadmate");
  });

  it("a fresh heavier memory gets in AND the old loss stays — an old filler goes instead", () => {
    // Same ledger, but the arrival is a was_downed (0.7). It outranks every
    // 0.3 filler on retention, so it lands; the loss (0.74) still outranks
    // it, so the loss stays; the oldest filler is what leaves.
    let list = fullOf(0.3, 59, 100);
    list = list.map((m, i) => (i === 0 ? { ...m, kind: "lost_squadmate" as const, weight: 1.0, day: 0, at: 1 } : m));
    const downed = mem({ kind: "was_downed", weight: MEMORY_BIRTH_WEIGHT.was_downed, day: 60, at: 999 });
    const after = addMemory(list, downed, 60);
    expect(after).toHaveLength(MEMORY_CAP);
    expect(after.some((m) => m.kind === "lost_squadmate")).toBe(true);
    expect(after.some((m) => m.at === 999)).toBe(true);
    expect(after.some((m) => m.at === 101)).toBe(false);
  });

  it("a fresh heavy memory can still displace an old loss — the ledger cannot starve", () => {
    // 24 old losses, then a fresh was_downed (0.7). Under birth-weight-only
    // eviction the downing would be refused forever. Under retention, the
    // oldest loss has decayed enough (0.995^400 ≈ 0.13) to make room.
    let list: MemoryEntry[] = [];
    for (let i = 0; i < MEMORY_CAP; i++) {
      list = addMemory(list, mem({ kind: "lost_squadmate", weight: 1.0, day: i * 20, at: i }), 500);
    }
    const downed = mem({ kind: "was_downed", weight: MEMORY_BIRTH_WEIGHT.was_downed, day: 500, at: 999 });
    const after = addMemory(list, downed, 500);
    expect(after.some((m) => m.at === 999)).toBe(true);
    expect(after.some((m) => m.at === 0)).toBe(false);
  });

  it("a year of fresh ordinary input can finally displace a loss, but not before", () => {
    // Day 0 loss, retention at day 200 ≈ 0.37, at day 400 ≈ 0.13. A fresh
    // got_the_kill is 0.3: refused at day 200, accepted at day 400.
    const build = (today: number) => {
      let list: MemoryEntry[] = [];
      list = addMemory(list, mem({ kind: "lost_squadmate", weight: 1.0, day: 0, at: 1 }), today);
      for (let i = 1; i < MEMORY_CAP; i++) list = addMemory(list, mem({ weight: 0.3, day: today - 1, at: 100 + i }), today);
      return list;
    };
    const kill = (today: number) => mem({ kind: "got_the_kill", weight: 0.3, day: today, at: 999 });
    expect(addMemory(build(200), kill(200), 200).some((m) => m.at === 1)).toBe(true);
    expect(addMemory(build(400), kill(400), 400).some((m) => m.at === 1)).toBe(false);
  });

  it("does not change what topMemories reports — a quiet old loss stays quiet in the dossier", () => {
    let list = fullOf(0.3, 59, 100);
    list = list.map((m, i) => (i === 0 ? { ...m, kind: "lost_squadmate" as const, weight: 1.0, day: 0, at: 1 } : m));
    const top = topMemories(list, 60, 3);
    expect(top.some((m) => m.kind === "lost_squadmate")).toBe(false);
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
