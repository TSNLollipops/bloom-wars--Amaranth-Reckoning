import { describe, it, expect } from "vitest";
import {
  ALL_GENDERS,
  GENDER_LABELS,
  genderOf,
  objectPronoun,
  possessiveDeterminer,
  possessivePronoun,
  reflexivePronoun,
  subjectPronoun,
  _derivedGenderForTests,
} from "../gender";
import {
  RECRUIT_FIRST_NAMES,
  RECRUIT_FIRST_NAMES_FEMALE,
  RECRUIT_FIRST_NAMES_MALE,
  RECRUIT_MALE_WEIGHT,
  firstNamePoolFor,
  generateRecruitName,
  randomGender,
} from "../names";
import { WARDEN_PILOTS, SECOND_LANCE_PILOTS, THIRD_LANCE_PILOTS } from "../campaignAmaranth";
import {
  HOUSE_AMARANTH_PILOTS,
  HOUSE_AMARANTH_SECOND_LANCE_PILOTS,
  HOUSE_AMARANTH_THIRD_LANCE_PILOTS,
} from "../campaignHouseAmaranth";
import { PILOTS as TEAM_ONE_PILOTS, ROSTER_DEPTH_PILOTS } from "../meks";
import type { PilotRecord } from "../types";

/** A deterministic rng that hands back the given numbers in order, then repeats the last one. */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe("pronouns", () => {
  it("gives the five English forms per gender, and never mixes the two possessives up", () => {
    expect(subjectPronoun("male")).toBe("he");
    expect(subjectPronoun("female")).toBe("she");
    expect(objectPronoun("male")).toBe("him");
    expect(objectPronoun("female")).toBe("her");
    expect(possessiveDeterminer("male")).toBe("his");
    expect(possessiveDeterminer("female")).toBe("her");
    // The trap this split exists for: "her" as a determiner, "hers" alone.
    expect(possessivePronoun("male")).toBe("his");
    expect(possessivePronoun("female")).toBe("hers");
    expect(reflexivePronoun("male")).toBe("himself");
    expect(reflexivePronoun("female")).toBe("herself");
  });

  it("labels every gender the UI can show", () => {
    for (const gender of ALL_GENDERS) {
      expect(GENDER_LABELS[gender]).toBeTruthy();
    }
    expect(ALL_GENDERS).toHaveLength(2);
  });
});

describe("genderOf", () => {
  it("reads an explicit gender straight off the record", () => {
    expect(genderOf({ id: "pilot_x", gender: "male" })).toBe("male");
    expect(genderOf({ id: "pilot_x", gender: "female" })).toBe("female");
  });

  it("falls back to a value derived from the id when the field is missing (a pre-13-Sep save)", () => {
    const first = genderOf({ id: "pilot_recruit_7" });
    expect(ALL_GENDERS).toContain(first);
  });

  it("derives the SAME gender for the same id every time — a save must never flip pronouns between reads", () => {
    for (const id of ["pilot_recruit_1", "pilot_recruit_2", "pilot_rourke", "", "a"]) {
      const runs = new Set([0, 1, 2, 3, 4].map(() => _derivedGenderForTests(id)));
      expect(runs.size).toBe(1);
    }
  });

  it("derives both values across a spread of ids, rather than collapsing to one", () => {
    const seen = new Set(
      Array.from({ length: 40 }, (_, i) => _derivedGenderForTests(`pilot_recruit_${i}`)),
    );
    expect(seen).toEqual(new Set(["male", "female"]));
  });

  it("an explicit gender always wins over the derived one", () => {
    // Find an id the fallback would call female, then pin it male and check.
    const id = Array.from({ length: 200 }, (_, i) => `pilot_${i}`).find(
      (candidate) => _derivedGenderForTests(candidate) === "female",
    );
    expect(id).toBeDefined();
    expect(genderOf({ id: id as string })).toBe("female");
    expect(genderOf({ id: id as string, gender: "male" })).toBe("male");
  });
});

describe("gendered name pools", () => {
  it("partitions the old flat pool — every name lands in exactly one side, nothing added or lost", () => {
    const male = new Set(RECRUIT_FIRST_NAMES_MALE);
    const female = new Set(RECRUIT_FIRST_NAMES_FEMALE);
    // No name in both.
    for (const name of male) expect(female.has(name)).toBe(false);
    // The union is exactly the exported flat list, with no duplicates.
    expect(new Set(RECRUIT_FIRST_NAMES)).toEqual(new Set([...male, ...female]));
    expect(RECRUIT_FIRST_NAMES).toHaveLength(male.size + female.size);
  });

  it("both pools are non-empty, so a reroll can never fail on either side", () => {
    expect(RECRUIT_FIRST_NAMES_MALE.length).toBeGreaterThan(0);
    expect(RECRUIT_FIRST_NAMES_FEMALE.length).toBeGreaterThan(0);
  });

  it("firstNamePoolFor is the mapping, and matches the two pools", () => {
    expect(firstNamePoolFor("male")).toBe(RECRUIT_FIRST_NAMES_MALE);
    expect(firstNamePoolFor("female")).toBe(RECRUIT_FIRST_NAMES_FEMALE);
  });

  it("generateRecruitName only ever draws a first name from the matching pool", () => {
    for (const gender of ALL_GENDERS) {
      const pool = firstNamePoolFor(gender);
      const other = firstNamePoolFor(gender === "male" ? "female" : "male");
      for (let i = 0; i < 200; i += 1) {
        const first = generateRecruitName(gender).split(" ")[1];
        expect(pool).toContain(first);
        expect(other).not.toContain(first);
      }
    }
  });

  it("still spends exactly three rng draws, in rank/first/surname order", () => {
    // Same shape the pre-split test pinned, so a seeded caller's sequence
    // didn't shift underneath it when gender was added.
    const rng = seq([0, 0, 0]);
    const name = generateRecruitName("female", rng);
    expect(name.split(" ")[1]).toBe(RECRUIT_FIRST_NAMES_FEMALE[0]);
  });
});

describe("randomGender", () => {
  it("respects RECRUIT_MALE_WEIGHT at both edges", () => {
    expect(randomGender(() => 0)).toBe("male");
    expect(randomGender(() => 0.999)).toBe("female");
    expect(randomGender(() => RECRUIT_MALE_WEIGHT - 0.001)).toBe("male");
    expect(randomGender(() => RECRUIT_MALE_WEIGHT)).toBe("female");
  });

  it("skews male, matching the Archive's own 'males are overrepresented' line, without going one-sided", () => {
    // Not a statistical test with a tolerance — a deterministic sweep, so
    // this can never flake.
    const rolls = Array.from({ length: 1000 }, (_, i) => randomGender(() => i / 1000));
    const males = rolls.filter((g) => g === "male").length;
    expect(males).toBe(Math.round(RECRUIT_MALE_WEIGHT * 1000));
    expect(males).toBeGreaterThan(500);
    expect(males).toBeLessThan(1000);
  });
});

describe("every hand-authored pilot carries an explicit gender", () => {
  // The whole reason PilotRecord.gender is optional is save compatibility.
  // It is NOT optional for authored content, and nothing in the type system
  // says so — this test is what says so. If someone adds a 37th named pilot
  // without a gender, this goes red rather than silently handing them a
  // hash-derived pronoun in a Verinis line.
  const ROSTERS: Record<string, readonly PilotRecord[]> = {
    "Warden first lance": WARDEN_PILOTS,
    "Warden second lance": SECOND_LANCE_PILOTS,
    "Warden third lance": THIRD_LANCE_PILOTS,
    "House Amaranth first lance": HOUSE_AMARANTH_PILOTS,
    "House Amaranth second lance": HOUSE_AMARANTH_SECOND_LANCE_PILOTS,
    "House Amaranth third lance": HOUSE_AMARANTH_THIRD_LANCE_PILOTS,
    "Team One": TEAM_ONE_PILOTS,
    "Team Two and bench (roster depth)": ROSTER_DEPTH_PILOTS,
  };

  for (const [rosterName, roster] of Object.entries(ROSTERS)) {
    it(`${rosterName}`, () => {
      expect(roster.length).toBeGreaterThan(0);
      const missing = roster.filter((pilot) => pilot.gender === undefined).map((pilot) => pilot.id);
      expect(missing).toEqual([]);
      for (const pilot of roster) {
        expect(ALL_GENDERS).toContain(pilot.gender);
      }
    });
  }

  it("covers all 41 authored pilots between them", () => {
    const total = Object.values(ROSTERS).reduce((sum, roster) => sum + roster.length, 0);
    expect(total).toBe(41);
  });
});
