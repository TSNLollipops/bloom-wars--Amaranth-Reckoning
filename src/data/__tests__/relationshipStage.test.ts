// Relationship stages — first-slice unit tests, 27 Aug 2026. Pure module,
// no engine imports (src/data/** purity rule, Build Brief §5.2).
import { describe, it, expect, vi } from "vitest";
import {
  deriveRelationshipStage,
  relationshipStagePhrase,
  pickRelationshipStageLine,
  RELATIONSHIP_DATING_FAVORABILITY,
  RELATIONSHIP_COMMITTED_FAVORABILITY,
  RELATIONSHIP_STAGE_LINES,
} from "../relationshipStage";
import { ROMANCE_MIN_FAVORABILITY, ROMANCE_ACCEPT_FAVORABILITY_DELTA } from "../romance";

describe("deriveRelationshipStage", () => {
  it("returns flirting for a value just above the romance entry gate", () => {
    expect(deriveRelationshipStage(ROMANCE_MIN_FAVORABILITY)).toBe("flirting");
  });

  it("a couple that barely cleared the entry gate lands in flirting right after accepting, not skipped ahead", () => {
    // The exact scenario the module header documents: pre-ask favorability
    // right at the minimum, then the acceptance delta applied on top.
    const postAcceptFavorability = ROMANCE_MIN_FAVORABILITY + ROMANCE_ACCEPT_FAVORABILITY_DELTA;
    expect(deriveRelationshipStage(postAcceptFavorability)).toBe("flirting");
  });

  it("returns flirting for anything below the dating threshold", () => {
    expect(deriveRelationshipStage(RELATIONSHIP_DATING_FAVORABILITY - 1)).toBe("flirting");
  });

  it("returns dating exactly at the dating threshold", () => {
    expect(deriveRelationshipStage(RELATIONSHIP_DATING_FAVORABILITY)).toBe("dating");
  });

  it("returns dating for anything below the committed threshold", () => {
    expect(deriveRelationshipStage(RELATIONSHIP_COMMITTED_FAVORABILITY - 1)).toBe("dating");
  });

  it("returns committed exactly at the committed threshold", () => {
    expect(deriveRelationshipStage(RELATIONSHIP_COMMITTED_FAVORABILITY)).toBe("committed");
  });

  it("returns committed for a very high value", () => {
    expect(deriveRelationshipStage(999)).toBe("committed");
  });

  it("the three thresholds are strictly ordered — the module's own math can't quietly invert", () => {
    expect(RELATIONSHIP_DATING_FAVORABILITY).toBeGreaterThan(ROMANCE_MIN_FAVORABILITY);
    expect(RELATIONSHIP_COMMITTED_FAVORABILITY).toBeGreaterThan(RELATIONSHIP_DATING_FAVORABILITY);
  });
});

describe("relationshipStagePhrase", () => {
  it("phrases flirting as 'flirting with X'", () => {
    expect(relationshipStagePhrase("flirting", "you")).toBe("flirting with you");
  });

  it("phrases dating as 'dating X', not 'dating with X'", () => {
    expect(relationshipStagePhrase("dating", "you")).toBe("dating you");
  });

  it("phrases committed as 'committed to X'", () => {
    expect(relationshipStagePhrase("committed", "you")).toBe("committed to you");
  });

  it("substitutes a real NPC name for the NPC-NPC case, not just 'you'", () => {
    expect(relationshipStagePhrase("dating", "Anand")).toBe("dating Anand");
  });
});

describe("pickRelationshipStageLine", () => {
  it("returns a line from the correct stage's own bank", () => {
    const line = pickRelationshipStageLine("committed");
    expect(RELATIONSHIP_STAGE_LINES.committed).toContain(line);
  });

  it("never crosses banks — a flirting pick never returns a committed-only line", () => {
    for (let i = 0; i < 30; i++) {
      const line = pickRelationshipStageLine("flirting");
      expect(RELATIONSHIP_STAGE_LINES.flirting).toContain(line);
    }
  });

  it("picks from every line in the bank across enough draws, not just index 0", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) seen.add(pickRelationshipStageLine("dating"));
    expect(seen.size).toBeGreaterThan(1);
  });

  it("with Math.random pinned to 0, always returns the bank's first entry", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(pickRelationshipStageLine("flirting")).toBe(RELATIONSHIP_STAGE_LINES.flirting[0]);
    vi.restoreAllMocks();
  });
});

describe("content sanity — every stage has real content, no empty banks", () => {
  it("every RelationshipStage key has at least 2 lines", () => {
    for (const stage of Object.keys(RELATIONSHIP_STAGE_LINES) as Array<keyof typeof RELATIONSHIP_STAGE_LINES>) {
      expect(RELATIONSHIP_STAGE_LINES[stage].length).toBeGreaterThanOrEqual(2);
    }
  });
});
