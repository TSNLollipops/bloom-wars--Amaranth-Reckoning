// src/data/__tests__/prologueIntro.test.ts
// Universe Intro Plan v1, 17 Sep 2026 — codifies the Qiraki Master Style
// Guide craft-rule subset this content is written to (see prologueIntro.ts's
// own header) as an actual check, rather than leaving it to review alone —
// this project's own habit for anything with a "never do X" rule attached
// (see tools/lint-spoiler.mjs, tools/lint-cast-collision.mjs applying the
// same idea to different rules). Not a full style linter: just the
// mechanical, unambiguous parts (banned characters, banned filler words,
// beat-count shape) a human still has to judge the rest of by eye.
import { describe, it, expect } from "vitest";
import { PROLOGUE_BEATS_WARDEN, resolvePrologueBeats } from "../prologueIntro";

const EM_DASH = "—";

function allLines(): string[] {
  return PROLOGUE_BEATS_WARDEN.flatMap((beat) => [beat.title, ...beat.body]);
}

describe("PROLOGUE_BEATS_WARDEN shape", () => {
  it("has three to five beats — the locked shape (AskUserQuestion, 17 Sep 2026)", () => {
    expect(PROLOGUE_BEATS_WARDEN.length).toBeGreaterThanOrEqual(3);
    expect(PROLOGUE_BEATS_WARDEN.length).toBeLessThanOrEqual(5);
  });

  it("gives every beat a title and at least one non-empty body paragraph", () => {
    for (const beat of PROLOGUE_BEATS_WARDEN) {
      expect(beat.title.length).toBeGreaterThan(0);
      expect(beat.body.length).toBeGreaterThan(0);
      for (const para of beat.body) expect(para.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("Qiraki craft-rule subset (Foundation.md's Archive-prose scope, borrowed here 17 Sep 2026)", () => {
  it("uses zero em dashes", () => {
    for (const line of allLines()) expect(line).not.toContain(EM_DASH);
  });

  it("uses zero semicolons", () => {
    for (const line of allLines()) expect(line).not.toContain(";");
  });

  it("minimizes the flagged filler words as standalone words, not substrings like 'nothing'/'something'", () => {
    const banned = /\b(thing|stuff|true|plain)\b/i;
    for (const line of allLines()) expect(banned.test(line)).toBe(false);
  });
});

describe("resolvePrologueBeats", () => {
  it("substitutes the company name into every {{COMPANY}} token, titles included", () => {
    const resolved = resolvePrologueBeats("Scrapyard Dogs");
    const flat = resolved.flatMap((b) => [b.title, ...b.body]);
    for (const line of flat) expect(line).not.toContain("{{COMPANY}}");
    expect(flat.some((line) => line.includes("Scrapyard Dogs"))).toBe(true);
  });

  it("falls back cleanly with the default Warden name", () => {
    const resolved = resolvePrologueBeats("Warden Company");
    expect(resolved[0].body[0]).toContain("Warden Company");
  });

  it("returns the same number of beats as the source, unchanged in order and shape", () => {
    const resolved = resolvePrologueBeats("Test Co");
    expect(resolved.length).toBe(PROLOGUE_BEATS_WARDEN.length);
    resolved.forEach((beat, i) => expect(beat.body.length).toBe(PROLOGUE_BEATS_WARDEN[i].body.length));
  });
});
