import { describe, it, expect } from "vitest";
import {
  ARCHIVE_ENTRIES,
  ARCHIVE_SHELVES,
  type ArchiveEntry,
  type ArchiveFacility,
  bodyFor,
  entriesInSection,
  forFacility,
  gateValue,
  isEntryOnFacility,
  isEntryUnlocked,
  latestRevision,
  moraleBand,
  playerTitle,
  relationshipWord,
  revisionCount,
  stressBand,
} from "../archive";
import { MORALE_PANIC_THRESHOLD, STRESS_PANIC_THRESHOLD } from "../ambientLines";
import {
  RELATIONSHIP_COMMITTED_FAVORABILITY,
  RELATIONSHIP_DATING_FAVORABILITY,
  deriveRelationshipStage,
} from "../relationshipStage";

const FACS: ArchiveFacility[] = ["warden", "amaranth"];
const SECTION_IDS = ARCHIVE_SHELVES.flatMap((s) => s.sections.map((x) => x.id));

describe("archive structure", () => {
  it("has no duplicate entry ids", () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const e of ARCHIVE_ENTRIES) {
      if (seen.has(e.id)) dupes.push(e.id);
      seen.add(e.id);
    }
    expect(dupes).toEqual([]);
  });

  it("puts every entry on a section that actually exists on a shelf", () => {
    const orphans = ARCHIVE_ENTRIES.filter((e) => !SECTION_IDS.includes(e.section));
    expect(orphans.map((e) => `${e.id}/${e.section}`)).toEqual([]);
  });

  it("leaves no section empty on either console", () => {
    const empty: string[] = [];
    for (const fac of FACS) {
      for (const id of SECTION_IDS) {
        if (entriesInSection(id, fac).length === 0) empty.push(`${fac}:${id}`);
      }
    }
    expect(empty).toEqual([]);
  });

  it("gives every entry exactly one body source", () => {
    const bad = ARCHIVE_ENTRIES.filter(
      (e) => (e.body ? 1 : 0) + (e.revisions ? 1 : 0) !== 1,
    );
    expect(bad.map((e) => e.id)).toEqual([]);
  });

  it("never ships an empty paragraph", () => {
    const bad: string[] = [];
    for (const e of ARCHIVE_ENTRIES) {
      const bodies = e.revisions ? e.revisions.map((r) => r.body) : [e.body ?? []];
      for (const b of bodies) {
        if (b.length === 0 || b.some((p) => p.trim() === "")) bad.push(e.id);
      }
    }
    expect(bad).toEqual([]);
  });

  it("keeps revisions in ascending gate order on both consoles", () => {
    const bad: string[] = [];
    for (const e of ARCHIVE_ENTRIES) {
      if (!e.revisions) continue;
      for (const fac of FACS) {
        let prev = -Infinity;
        for (const r of e.revisions) {
          const g = gateValue(r.after, fac) ?? -Infinity;
          if (g < prev) bad.push(`${e.id}@${fac}`);
          prev = g;
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("gates every entry inside the 36-mission campaign", () => {
    const bad: string[] = [];
    for (const e of ARCHIVE_ENTRIES) {
      for (const fac of FACS) {
        if (!isEntryOnFacility(e, fac)) continue;
        const gates = [gateValue(e.gate, fac), ...(e.revisions ?? []).map((r) => gateValue(r.after, fac))];
        for (const g of gates) {
          if (g !== null && (g < 0 || g > 36)) bad.push(`${e.id}@${fac}=${g}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  // The Glossary and the Field Manual are the two sections reachable with NO
  // save loaded — the manual is HOW TO PLAY from the Main Menu and the pause
  // menu. A gate on either would render as a locked row to a player who has
  // no campaign to unlock it with, which is a dead end rather than a tease.
  // Systems and Ranks may be gated: system_requiem deliberately is, because
  // the ungated shipped version spoiled the Mission 12 transfer.
  it("never gates a section that is reachable with no save", () => {
    const gated = ARCHIVE_ENTRIES.filter(
      (e) => ["glossary", "manual"].includes(e.section) && e.gate !== null,
    );
    expect(gated.map((e) => e.id)).toEqual([]);
  });

  it("keeps the Requiem system gated, so the Systems shelf cannot spoil Mission 12", () => {
    const requiem = ARCHIVE_ENTRIES.find((e) => e.id === "system_requiem");
    expect(requiem).toBeDefined();
    expect(gateValue(requiem!.gate, "warden")).not.toBeNull();
  });
});

describe("archive gating", () => {
  const entry = (over: Partial<ArchiveEntry> = {}): ArchiveEntry => ({
    id: "t", section: "history", kind: "Record", title: "T", gate: null, body: ["b"], ...over,
  });

  it("treats a null gate as always unlocked", () => {
    expect(isEntryUnlocked(entry(), "warden", 0)).toBe(true);
  });

  it("unlocks a numeric gate only once that mission is resolved", () => {
    const e = entry({ gate: 12 });
    expect(isEntryUnlocked(e, "warden", 11)).toBe(false);
    expect(isEntryUnlocked(e, "warden", 12)).toBe(true);
  });

  it("reads each console's own gate out of a dual gate", () => {
    const e = entry({ gate: { warden: 4, amaranth: 12 } });
    expect(isEntryUnlocked(e, "warden", 5)).toBe(true);
    expect(isEntryUnlocked(e, "amaranth", 5)).toBe(false);
    expect(isEntryUnlocked(e, "amaranth", 12)).toBe(true);
  });

  it("shows the latest unlocked revision and counts it", () => {
    const e = entry({
      body: undefined,
      revisions: [
        { after: null, body: ["one"] },
        { after: 14, body: ["two"] },
        { after: 22, body: ["three"] },
      ],
    });
    expect(bodyFor(e, "warden", 0)).toEqual(["one"]);
    expect(bodyFor(e, "warden", 21)).toEqual(["two"]);
    expect(bodyFor(e, "warden", 36)).toEqual(["three"]);
    expect(revisionCount(e, "warden", 21)).toEqual({ shown: 2, total: 3 });
  });

  it("hides a revisioned entry until its first revision lands", () => {
    const e = entry({ body: undefined, revisions: [{ after: 20, body: ["late"] }] });
    expect(isEntryUnlocked(e, "warden", 19)).toBe(false);
    expect(latestRevision(e, "warden", 19)).toBeNull();
    expect(isEntryUnlocked(e, "warden", 20)).toBe(true);
  });

  it("resolves a per-facility value", () => {
    expect(forFacility({ warden: "CIC", amaranth: "Records" }, "amaranth")).toBe("Records");
    expect(forFacility("shared", "warden")).toBe("shared");
  });
});

describe("archive bands never drift from the engine's own thresholds", () => {
  it("puts the stress band's top cut exactly on the panic threshold", () => {
    expect(stressBand(STRESS_PANIC_THRESHOLD)).toBe("near the line");
    expect(stressBand(STRESS_PANIC_THRESHOLD - 1)).toBe("strained");
  });

  it("puts the morale band's bottom cut exactly on the low-morale line", () => {
    expect(moraleBand(MORALE_PANIC_THRESHOLD)).toBe("flagging");
    expect(moraleBand(MORALE_PANIC_THRESHOLD + 1)).toBe("low");
  });

  it("covers the whole 0-100 range with no gap", () => {
    for (let n = 0; n <= 100; n++) {
      expect(stressBand(n)).toBeTruthy();
      expect(moraleBand(n)).toBeTruthy();
    }
  });

  it("agrees with deriveRelationshipStage at every boundary", () => {
    for (const n of [
      0, 49, 50, 69,
      RELATIONSHIP_DATING_FAVORABILITY - 1,
      RELATIONSHIP_DATING_FAVORABILITY,
      RELATIONSHIP_COMMITTED_FAVORABILITY - 1,
      RELATIONSHIP_COMMITTED_FAVORABILITY,
      100,
    ]) {
      expect(relationshipWord(n)).toBe(deriveRelationshipStage(n));
    }
  });
});

describe("archive register", () => {
  it("addresses the player by title, never as you", () => {
    expect(playerTitle("warden")).toBe("the Commander");
    expect(playerTitle("amaranth")).toBe("the Colonel");
  });

  it("keeps pilot, not synker, in the shelves that teach", () => {
    const teaching = ARCHIVE_ENTRIES.filter((e) => ["glossary", "manual"].includes(e.section));
    const offenders = teaching.filter(
      (e) => e.id !== "gloss_synker" && (e.body ?? []).some((p) => /\bsynkers?\b/i.test(p)),
    );
    expect(offenders.map((e) => e.id)).toEqual([]);
  });
});
