// Crew Banter §11 template-slot resolver — unit tests, 27 Aug 2026 (roadmap
// #17's curated-recall pass). Pure module, no engine imports (src/data/**
// purity rule, Build Brief §5.2) — same "test the exported functions
// directly with hand-built fixtures" convention hotTopics.test.ts already
// established for this file's sibling.
import { describe, it, expect } from "vitest";
import { SLOTTED_LINES, pickSlottedVariant, resolveSlotText, type SlottedLine, type SlotType } from "../crewBanterSlots";
import { LINE_BANK, type Catalyst, type Echo, type Stage } from "../ambientLines";

const ALL_CATALYSTS = Object.keys(LINE_BANK) as Catalyst[];
const ALL_ECHOES: Echo[] = ["love", "fear", "anger", "sadness"];
const ALL_STAGES: Stage[] = ["green", "blooded", "command"];
const ALL_SLOT_TYPES: SlotType[] = ["SQUADMATE", "CLASS", "LOADOUT", "ENEMY", "MISSION", "ROOM", "SHIP", "RIVAL", "LOST", "STAGE_MOMENT"];

function makeLine(overrides: Partial<SlottedLine> = {}): SlottedLine {
  return {
    catalyst: "wolf",
    echo: "love",
    stage: "blooded",
    slotType: "SQUADMATE",
    flat: "placeholder flat line",
    slotted: "placeholder {SQUADMATE} line",
    ...overrides,
  };
}

describe("SLOTTED_LINES — content sanity", () => {
  it("has exactly 39 entries — the doc's own delivery claims 36; hand-transcribing the tables found 39, recorded plainly in the file header rather than matching the doc's number", () => {
    expect(SLOTTED_LINES.length).toBe(39);
  });

  it("every entry has a valid catalyst, echo, and stage", () => {
    for (const entry of SLOTTED_LINES) {
      expect(ALL_CATALYSTS).toContain(entry.catalyst);
      expect(ALL_ECHOES).toContain(entry.echo);
      expect(ALL_STAGES).toContain(entry.stage);
    }
  });

  it("every entry's slotted string contains exactly one token, and it matches the entry's own slotType", () => {
    const tokenPattern = /\{[A-Z]+\}/g;
    for (const entry of SLOTTED_LINES) {
      const tokens = entry.slotted.match(tokenPattern) ?? [];
      expect(tokens.length).toBe(1);
      expect(tokens[0]).toBe(`{${entry.slotType}}`);
    }
  });

  it("every entry's flat string contains no token at all — it's the plain line already live in LINE_BANK", () => {
    const tokenPattern = /\{[A-Z]+\}/;
    for (const entry of SLOTTED_LINES) {
      expect(entry.flat).not.toMatch(tokenPattern);
    }
  });

  it("every entry's flat text exists verbatim in the LINE_BANK bucket its own catalyst/echo/stage names — this is the whole point of the field, so a mismatch here is a real transcription bug, not a style nit", () => {
    for (const entry of SLOTTED_LINES) {
      const bucket = LINE_BANK[entry.catalyst][entry.echo][entry.stage];
      expect(bucket).toContain(entry.flat);
    }
  });

  it("CLASS and ROOM have zero live entries — an honest gap, not a bug (see the file header): confirms the resolver's support for both slot types is currently untested by real content and only exercised here via synthetic fixtures below", () => {
    const usedTypes = new Set(SLOTTED_LINES.map((e) => e.slotType));
    expect(usedTypes.has("CLASS")).toBe(false);
    expect(usedTypes.has("ROOM")).toBe(false);
  });
});

describe("pickSlottedVariant", () => {
  it("returns undefined for a bucket with no slotted entries at all", () => {
    // wolf never has an anger-echo entry in SLOTTED_LINES at any stage.
    expect(pickSlottedVariant("wolf", "anger", "green")).toBeUndefined();
  });

  it("returns a matching entry for a bucket that has exactly one", () => {
    // crow/love/command has exactly one entry (the "pack shift" ENEMY line).
    const result = pickSlottedVariant("crow", "love", "command");
    expect(result).toBeDefined();
    expect(result?.catalyst).toBe("crow");
    expect(result?.echo).toBe("love");
    expect(result?.stage).toBe("command");
  });

  it("only ever returns an entry matching all three of catalyst, echo, and stage — never a neighbor bucket", () => {
    for (let i = 0; i < 25; i++) {
      const result = pickSlottedVariant("dog", "love", "blooded");
      expect(result).toBeDefined();
      expect(result?.catalyst).toBe("dog");
      expect(result?.echo).toBe("love");
      expect(result?.stage).toBe("blooded");
    }
  });

  it("picks across every eligible candidate in a multi-entry bucket, not just the first — wolf/love/blooded has two SQUADMATE entries", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const result = pickSlottedVariant("wolf", "love", "blooded");
      if (result) seen.add(result.slotted);
    }
    expect(seen.size).toBe(2);
  });

  it("covers every catalyst that actually has at least one entry, without throwing on any (catalyst, echo, stage) combination", () => {
    for (const catalyst of ALL_CATALYSTS) {
      for (const echo of ALL_ECHOES) {
        for (const stage of ALL_STAGES) {
          expect(() => pickSlottedVariant(catalyst, echo, stage)).not.toThrow();
        }
      }
    }
  });
});

describe("resolveSlotText", () => {
  it("SQUADMATE resolves when squadmateName is present", () => {
    const line = makeLine({ slotType: "SQUADMATE", slotted: "Ask {SQUADMATE} yourself." });
    expect(resolveSlotText(line, { squadmateName: "Bosk" })).toBe("Ask Bosk yourself.");
  });

  it("SQUADMATE returns undefined when squadmateName is missing — caller falls back to the flat line", () => {
    const line = makeLine({ slotType: "SQUADMATE", slotted: "Ask {SQUADMATE} yourself." });
    expect(resolveSlotText(line, {})).toBeUndefined();
  });

  it("MISSION resolves when missionName is present", () => {
    const line = makeLine({ slotType: "MISSION", slotted: "We walked off {MISSION} together." });
    expect(resolveSlotText(line, { missionName: "Ash on the Water" })).toBe("We walked off Ash on the Water together.");
  });

  it("MISSION returns undefined when missionName is missing", () => {
    const line = makeLine({ slotType: "MISSION", slotted: "We walked off {MISSION} together." });
    expect(resolveSlotText(line, {})).toBeUndefined();
  });

  it("CLASS resolves when speakerPath is present — untested by real content today (see the sanity block above), so this is the only coverage this branch gets", () => {
    const line = makeLine({ slotType: "CLASS", slotted: "Every {CLASS} pilot knows that much." });
    expect(resolveSlotText(line, { speakerPath: "meeps" })).toBe("Every Meeps pilot knows that much.");
  });

  it("CLASS resolves correctly for all four paths", () => {
    const line = makeLine({ slotType: "CLASS", slotted: "{CLASS}" });
    expect(resolveSlotText(line, { speakerPath: "meeps" })).toBe("Meeps");
    expect(resolveSlotText(line, { speakerPath: "tank" })).toBe("Tank");
    expect(resolveSlotText(line, { speakerPath: "reeps" })).toBe("Reeps");
    expect(resolveSlotText(line, { speakerPath: "munti" })).toBe("Munti");
  });

  it("CLASS returns undefined when speakerPath is missing", () => {
    const line = makeLine({ slotType: "CLASS", slotted: "Every {CLASS} pilot knows that much." });
    expect(resolveSlotText(line, {})).toBeUndefined();
  });

  it("LOADOUT resolves to the real Canon Pass §D gear-tier name (Maxime's own call, 27 Aug 2026) when both speakerPath and speakerTier are present", () => {
    const line = makeLine({ slotType: "LOADOUT", slotted: "You'll want a wider angle running {LOADOUT}." });
    expect(resolveSlotText(line, { speakerPath: "meeps", speakerTier: "C" })).toBe("You'll want a wider angle running Arcblade.");
  });

  it("LOADOUT covers a spot check of the gear-tier table across paths and tiers — the G/A ends and the middle", () => {
    const line = makeLine({ slotType: "LOADOUT", slotted: "{LOADOUT}" });
    expect(resolveSlotText(line, { speakerPath: "meeps", speakerTier: "G" })).toBe("Stocklance");
    expect(resolveSlotText(line, { speakerPath: "meeps", speakerTier: "A" })).toBe("Stormblade");
    expect(resolveSlotText(line, { speakerPath: "tank", speakerTier: "D" })).toBe("Groupshield");
    expect(resolveSlotText(line, { speakerPath: "reeps", speakerTier: "B" })).toBe("Twinmark");
    expect(resolveSlotText(line, { speakerPath: "munti", speakerTier: "G" })).toBe("Quickfix kit");
    expect(resolveSlotText(line, { speakerPath: "munti", speakerTier: "A" })).toBe("Overcharge");
  });

  it("LOADOUT returns undefined when speakerTier is missing, even with speakerPath present", () => {
    const line = makeLine({ slotType: "LOADOUT", slotted: "You'll want a wider angle running {LOADOUT}." });
    expect(resolveSlotText(line, { speakerPath: "meeps" })).toBeUndefined();
  });

  it("LOADOUT returns undefined when speakerPath is missing, even with speakerTier present", () => {
    const line = makeLine({ slotType: "LOADOUT", slotted: "You'll want a wider angle running {LOADOUT}." });
    expect(resolveSlotText(line, { speakerTier: "C" })).toBeUndefined();
  });

  it("LOADOUT returns undefined when both are missing", () => {
    const line = makeLine({ slotType: "LOADOUT", slotted: "You'll want a wider angle running {LOADOUT}." });
    expect(resolveSlotText(line, {})).toBeUndefined();
  });

  it("ENEMY always resolves — categorical, no context data needed", () => {
    const line = makeLine({ slotType: "ENEMY", slotted: "{ENEMY} is going in my theory." });
    const result = resolveSlotText(line, {});
    expect(result).toBeDefined();
    expect(result).not.toContain("{ENEMY}");
  });

  it("SHIP always resolves — categorical, no context data needed", () => {
    const line = makeLine({ slotType: "SHIP", slotted: "Anything on {SHIP} gets a theory." });
    const result = resolveSlotText(line, {});
    expect(result).toBeDefined();
    expect(result).not.toContain("{SHIP}");
  });

  it("ROOM always resolves — categorical, no context data needed, untested by real content today", () => {
    const line = makeLine({ slotType: "ROOM", slotted: "Meet me in {ROOM}." });
    const result = resolveSlotText(line, {});
    expect(result).toBeDefined();
    expect(result).not.toContain("{ROOM}");
  });

  it("the three categorical slot types draw more than one value across many trials, not a fixed single pick", () => {
    for (const slotType of ["ENEMY", "SHIP", "ROOM"] as const) {
      const token = `{${slotType}}`;
      const line = makeLine({ slotType, slotted: `x ${token} x` });
      const seen = new Set<string>();
      for (let i = 0; i < 40; i++) {
        seen.add(resolveSlotText(line, {}) ?? "");
      }
      expect(seen.size).toBeGreaterThan(1);
    }
  });

  it("never leaves a raw token in a resolved string, across every slot type with its data present", () => {
    const context = {
      squadmateName: "Anand",
      missionName: "Cut the Root",
      speakerPath: "tank" as const,
      speakerTier: "D" as const,
      rivalName: "Iyari",
      lostMuntiName: "Barasj",
      stageMomentText: "Blooded",
    };
    for (const slotType of ALL_SLOT_TYPES) {
      const token = `{${slotType}}`;
      const line = makeLine({ slotType, slotted: `before ${token} after` });
      const result = resolveSlotText(line, context);
      expect(result).toBeDefined();
      expect(result).not.toContain(token);
    }
  });

  it("real SLOTTED_LINES entries all resolve cleanly given a full context, with no stray tokens left over", () => {
    const context = {
      squadmateName: "Iyari",
      missionName: "The Amaranth Accord",
      speakerPath: "reeps" as const,
      speakerTier: "B" as const,
    };
    for (const entry of SLOTTED_LINES) {
      const result = resolveSlotText(entry, context);
      expect(result).toBeDefined();
      expect(result).not.toMatch(/\{[A-Z]+\}/);
    }
  });
});

// RIVAL and LOST — Recall Item 3 Decision + Spec v1 §3, 28 Aug 2026. Both
// verified against real code before building (see this file's own header
// on why STAGE_MOMENT, the spec's third proposed slot, isn't here at all).
describe("resolveSlotText — RIVAL", () => {
  it("resolves when rivalName is present", () => {
    const line = makeLine({ slotType: "RIVAL", slotted: "Touch {RIVAL} again and find out." });
    expect(resolveSlotText(line, { rivalName: "Iyari" })).toBe("Touch Iyari again and find out.");
  });

  it("returns undefined when rivalName is missing — caller falls back to the flat line, same as SQUADMATE/MISSION misses", () => {
    const line = makeLine({ slotType: "RIVAL", slotted: "Touch {RIVAL} again and find out." });
    expect(resolveSlotText(line, {})).toBeUndefined();
  });
});

describe("resolveSlotText — LOST", () => {
  it("resolves when lostMuntiName is present", () => {
    const line = makeLine({ slotType: "LOST", slotted: "Not since {LOST}." });
    expect(resolveSlotText(line, { lostMuntiName: "Barasj" })).toBe("Not since Barasj.");
  });

  it("returns undefined when lostMuntiName is missing — no fallen Munti on record yet is the normal, common case, not an edge case", () => {
    const line = makeLine({ slotType: "LOST", slotted: "Not since {LOST}." });
    expect(resolveSlotText(line, {})).toBeUndefined();
  });
});

// STAGE_MOMENT — added 28 Aug 2026 after being held back earlier the same
// day (see this file's own header on SlotType for why, and
// engine/campaignEconomy.ts's purchaseTierUpgrade for where
// stageMomentText's underlying real timestamp now actually gets written).
describe("resolveSlotText — STAGE_MOMENT", () => {
  it("resolves when stageMomentText is present", () => {
    const line = makeLine({ slotType: "STAGE_MOMENT", slotted: "Everything's different since I made {STAGE_MOMENT}." });
    expect(resolveSlotText(line, { stageMomentText: "Blooded" })).toBe("Everything's different since I made Blooded.");
  });

  it("returns undefined when stageMomentText is missing — a pilot with no recorded live promotion has nothing to recall here", () => {
    const line = makeLine({ slotType: "STAGE_MOMENT", slotted: "Everything's different since I made {STAGE_MOMENT}." });
    expect(resolveSlotText(line, {})).toBeUndefined();
  });
});

// Two-fact lines — Recall Item 3 spec §3: "a line that names both a
// squadmate AND a mission in the same breath." slotType2 is additive and
// optional (SlottedLine's own comment) — every one of the 39 real entries
// above leaves it undefined and is untouched by this addition, covered
// already by the "real SLOTTED_LINES entries" test just above.
describe("resolveSlotText — two-fact lines (slotType2)", () => {
  it("resolves both tokens when both facts are present", () => {
    const line = makeLine({ slotType: "SQUADMATE", slotType2: "MISSION", slotted: "{SQUADMATE} and I walked off {MISSION} together." });
    expect(resolveSlotText(line, { squadmateName: "Bosk", missionName: "Cut the Root" })).toBe("Bosk and I walked off Cut the Root together.");
  });

  it("falls back to undefined when only the FIRST fact is present — never a half-resolved line with one stray token", () => {
    const line = makeLine({ slotType: "SQUADMATE", slotType2: "MISSION", slotted: "{SQUADMATE} and I walked off {MISSION} together." });
    const result = resolveSlotText(line, { squadmateName: "Bosk" });
    expect(result).toBeUndefined();
  });

  it("falls back to undefined when only the SECOND fact is present", () => {
    const line = makeLine({ slotType: "SQUADMATE", slotType2: "MISSION", slotted: "{SQUADMATE} and I walked off {MISSION} together." });
    const result = resolveSlotText(line, { missionName: "Cut the Root" });
    expect(result).toBeUndefined();
  });

  it("falls back to undefined when neither fact is present", () => {
    const line = makeLine({ slotType: "SQUADMATE", slotType2: "MISSION", slotted: "{SQUADMATE} and I walked off {MISSION} together." });
    expect(resolveSlotText(line, {})).toBeUndefined();
  });

  it("works with a categorical second slot (always resolvable) paired with a real-data first slot", () => {
    const line = makeLine({ slotType: "SQUADMATE", slotType2: "SHIP", slotted: "{SQUADMATE} and I, somewhere on {SHIP}." });
    const result = resolveSlotText(line, { squadmateName: "Anand" });
    expect(result).toBeDefined();
    expect(result).toMatch(/^Anand and I, somewhere on (Providence|the Antfarm)\.$/);
  });

  it("a single-slot line (no slotType2) is completely unaffected by this feature existing", () => {
    const line = makeLine({ slotType: "SQUADMATE", slotted: "Ask {SQUADMATE} yourself." });
    expect(resolveSlotText(line, { squadmateName: "Bosk" })).toBe("Ask Bosk yourself.");
    expect(resolveSlotText(line, {})).toBeUndefined();
  });

  it("resolves two DIFFERENT tokens correctly even though String.replace only touches the first occurrence — order doesn't bleed between the two fills", () => {
    const line = makeLine({ slotType: "RIVAL", slotType2: "LOST", slotted: "{RIVAL} took it harder than most, after {LOST}." });
    expect(resolveSlotText(line, { rivalName: "Iyari", lostMuntiName: "Barasj" })).toBe("Iyari took it harder than most, after Barasj.");
  });
});
