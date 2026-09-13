import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  MEK_GIVEN_NAMES,
  RECRUIT_CALLSIGNS,
  RECRUIT_FIRST_NAMES,
  RECRUIT_RANKS,
  RECRUIT_SURNAMES,
  generateCallsign,
  generateMekName,
  generateRecruitName,
  RECRUIT_FIRST_NAMES_MALE,
  RECRUIT_FIRST_NAMES_FEMALE,
} from "../names";
import { SECOND_LANCE_PILOTS, THIRD_LANCE_PILOTS, WARDEN_PILOTS } from "../campaignAmaranth";
import {
  HOUSE_AMARANTH_PILOTS,
  HOUSE_AMARANTH_SECOND_LANCE_PILOTS,
  HOUSE_AMARANTH_THIRD_LANCE_PILOTS,
} from "../campaignHouseAmaranth";
import { PILOTS, ROSTER_DEPTH_PILOTS } from "../meks";
import { WARDEN_FACILITY } from "../../engine/facilityWarden";
import { HOUSE_AMARANTH_FACILITY } from "../../engine/facilityHouseAmaranth";

// ---------------------------------------------------------------------
// The collision discipline names.ts's header promises, as a test rather
// than a promise. Every token of every authored name on either campaign —
// given name, surname, callsign, the two COs, the archived Team One/Two
// roster, and the book series' own named cast — is a name no generated
// pilot or Mek may ever be handed.
// ---------------------------------------------------------------------

/** Split a displayName into its name tokens: drop rank abbreviations (anything with a "."), keep the callsign inside the quotes as its own token. */
function tokensOf(displayName: string): string[] {
  return displayName
    .replace(/[“”"—–]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !t.includes(".") && /[a-z]/i.test(t))
    .map((t) => t.toLowerCase());
}

const AUTHORED = new Set<string>();
for (const list of [
  WARDEN_PILOTS,
  SECOND_LANCE_PILOTS,
  THIRD_LANCE_PILOTS,
  HOUSE_AMARANTH_PILOTS,
  HOUSE_AMARANTH_SECOND_LANCE_PILOTS,
  HOUSE_AMARANTH_THIRD_LANCE_PILOTS,
  PILOTS,
  ROSTER_DEPTH_PILOTS,
]) {
  for (const p of list) for (const t of tokensOf(p.displayName)) AUTHORED.add(t);
}
for (const t of tokensOf(WARDEN_FACILITY.co.displayName)) AUTHORED.add(t);
for (const t of tokensOf(HOUSE_AMARANTH_FACILITY.co.displayName)) AUTHORED.add(t);
// The House's own family, named in mission data rather than on a roster.
for (const t of tokensOf("Halcyon Amaranth")) AUTHORED.add(t);

// The book series' named cast — the same list tools/lint-cast-collision.mjs
// checks source text against at build time. Read from disk here so the
// list never enters the game bundle; a test runs in node, the game doesn't.
const cast = JSON.parse(readFileSync("tools/qiraki_named_cast.json", "utf8")) as {
  reserved: { name: string; match: "single" | "full" }[];
  approvedCrossover: { name: string }[];
};
const RESERVED_TOKENS = new Set<string>();
const RESERVED_FULL = new Set<string>();
for (const r of [...cast.reserved, ...cast.approvedCrossover]) {
  for (const t of tokensOf(r.name)) RESERVED_TOKENS.add(t);
  RESERVED_FULL.add(r.name.toLowerCase());
}

const POOLS: [string, readonly string[]][] = [
  ["RECRUIT_FIRST_NAMES", RECRUIT_FIRST_NAMES],
  ["RECRUIT_SURNAMES", RECRUIT_SURNAMES],
  ["RECRUIT_CALLSIGNS", RECRUIT_CALLSIGNS],
  ["MEK_GIVEN_NAMES", MEK_GIVEN_NAMES],
];

describe("the name pools — collision discipline", () => {
  it("has no duplicates inside any pool", () => {
    for (const [label, pool] of POOLS) {
      const lower = pool.map((n) => n.toLowerCase());
      expect(new Set(lower).size, label).toBe(pool.length);
    }
  });

  it("keeps the four pools disjoint from each other — a Mek can never share a name with a possible recruit", () => {
    for (let i = 0; i < POOLS.length; i++) {
      for (let j = i + 1; j < POOLS.length; j++) {
        const a = new Set(POOLS[i][1].map((n) => n.toLowerCase()));
        const overlap = POOLS[j][1].filter((n) => a.has(n.toLowerCase()));
        expect(overlap, `${POOLS[i][0]} ∩ ${POOLS[j][0]}`).toEqual([]);
      }
    }
  });

  it("never hands out a name any hand-authored pilot, Mek, or CO already carries, on either campaign", () => {
    expect(AUTHORED.size).toBeGreaterThan(60); // sanity: the token set actually loaded
    for (const [label, pool] of POOLS) {
      const hits = pool.filter((n) => AUTHORED.has(n.toLowerCase()));
      expect(hits, label).toEqual([]);
    }
  });

  it("never hands out a name from the book series' named cast — same list the cast-collision lint checks", () => {
    expect(RESERVED_TOKENS.size).toBeGreaterThan(40); // sanity: the JSON actually loaded
    for (const [label, pool] of POOLS) {
      const hits = pool.filter((n) => RESERVED_TOKENS.has(n.toLowerCase()));
      expect(hits, label).toEqual([]);
    }
  });

  it("cannot assemble a book character's full name from a first name and a surname by chance", () => {
    // The 5 Sep pools could: one first name and one surname in them made a
    // book character's full name between them. Both are gone.
    const possible: string[] = [];
    for (const f of RECRUIT_FIRST_NAMES) for (const s of RECRUIT_SURNAMES) possible.push(`${f} ${s}`.toLowerCase());
    const hits = possible.filter((n) => RESERVED_FULL.has(n));
    expect(hits).toEqual([]);
  });

  it("keeps the pools at the sizes the 5 Sep design shipped, so the odds never quietly narrow", () => {
    expect(RECRUIT_FIRST_NAMES.length).toBe(24);
    expect(RECRUIT_SURNAMES.length).toBe(24);
    expect(RECRUIT_CALLSIGNS.length).toBe(10);
    expect(RECRUIT_RANKS).toEqual(["Pvt.", "Spec.", "Cpl."]);
    expect(MEK_GIVEN_NAMES.length).toBeGreaterThanOrEqual(40);
  });
});

/** A deterministic rng that walks a fixed sequence, for tests that need the same answer twice. */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("generateRecruitName", () => {
  // Took a gender as its first argument from 13 Sep 2026 — the first name
  // is drawn from the pool matching it. Everything these two tests were
  // already pinning (the shape of the string, determinism under an
  // injected rng, three draws in rank/first/surname order) is unchanged;
  // they just have to say which pool now. The gender-specific behaviour
  // itself is covered in data/__tests__/gender.test.ts.
  it("is rank, given name, surname — no callsign, that is earned", () => {
    for (const gender of ["male", "female"] as const) {
      for (let i = 0; i < 50; i++) {
        const name = generateRecruitName(gender);
        expect(name).toMatch(/^(Pvt\.|Spec\.|Cpl\.) [A-Z][a-z]+ [A-Z][a-z]+$/);
        expect(name).not.toContain("“");
      }
    }
  });

  it("is deterministic under an injected rng", () => {
    expect(generateRecruitName("male", seq([0, 0, 0]))).toBe(
      `${RECRUIT_RANKS[0]} ${RECRUIT_FIRST_NAMES_MALE[0]} ${RECRUIT_SURNAMES[0]}`,
    );
    expect(generateRecruitName("female", seq([0, 0, 0]))).toBe(
      `${RECRUIT_RANKS[0]} ${RECRUIT_FIRST_NAMES_FEMALE[0]} ${RECRUIT_SURNAMES[0]}`,
    );
  });
});

describe("generateCallsign — unchanged from campaignState.ts, moved", () => {
  it("cycles the pool and numbers the second lap", () => {
    expect(generateCallsign(1)).toBe("Sprocket");
    expect(generateCallsign(10)).toBe("Hollow");
    expect(generateCallsign(11)).toBe("Sprocket 2");
    expect(generateCallsign(21)).toBe("Sprocket 3");
  });

  it("no longer hands a Warden recruit the House's own Colonel's name as a callsign", () => {
    for (let n = 1; n <= 10; n++) expect(generateCallsign(n)).not.toBe("Marrow");
  });
});

describe("generateMekName", () => {
  it("returns a single given name from the Mek pool — no rank, no surname, no possessive", () => {
    for (let i = 0; i < 50; i++) {
      const name = generateMekName();
      expect(MEK_GIVEN_NAMES).toContain(name);
      expect(name).not.toContain(" ");
      expect(name).not.toContain("'s");
    }
  });

  it("skips every name already taken on the save, case-insensitively", () => {
    const taken = MEK_GIVEN_NAMES.slice(0, MEK_GIVEN_NAMES.length - 1).map((n) => n.toUpperCase());
    const last = MEK_GIVEN_NAMES[MEK_GIVEN_NAMES.length - 1];
    for (let i = 0; i < 20; i++) expect(generateMekName(taken)).toBe(last);
  });

  it("still answers when the whole pool is spoken for, rather than throwing", () => {
    const name = generateMekName([...MEK_GIVEN_NAMES]);
    expect(MEK_GIVEN_NAMES).toContain(name);
  });

  it("is deterministic under an injected rng", () => {
    expect(generateMekName([], seq([0]))).toBe(MEK_GIVEN_NAMES[0]);
    expect(generateMekName([MEK_GIVEN_NAMES[0]], seq([0]))).toBe(MEK_GIVEN_NAMES[1]);
  });
});
