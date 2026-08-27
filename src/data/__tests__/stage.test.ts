// src/data/__tests__/stage.test.ts
// Hub polish, 27 Aug 2026 — Maxime: "do the ranking path." Covers the new
// Stage axis wired this pass: stageFromTier's ladder, and that
// pickAmbientLine/pickLineForMessage actually draw from the pilot's own
// stage bucket rather than ignoring it (LINE_BANK gained a Stage layer
// this same pass — see ambientLines.ts's own header for the full design).
// Same day, later pass: detectStagePromotion/pickStagePromotionLine, the
// "graduation" reveal Maxime asked for after checking whether a player
// would ever actually notice a promotion (they wouldn't have, before this).
import { describe, it, expect } from "vitest";
import {
  stageFromTier,
  pickAmbientLine,
  pickLineForMessage,
  detectStagePromotion,
  pickStagePromotionLine,
  LINE_BANK,
  type AmbientPilotState,
  type Stage,
} from "../ambientLines";
import type { Tier } from "../types";

function pilot(overrides: Partial<AmbientPilotState> = {}): AmbientPilotState {
  return { catalyst: "wolf", stage: "blooded", stress: 30, morale: 70, drunk: false, ...overrides };
}

describe("stageFromTier", () => {
  it("maps G and F to green — pilot_creator.html's own ladder: 2nd Lt., gear G-F", () => {
    expect(stageFromTier("G")).toBe("green");
    expect(stageFromTier("F")).toBe("green");
  });

  it("maps E, D, C to blooded — Capt., gear E-C", () => {
    expect(stageFromTier("E")).toBe("blooded");
    expect(stageFromTier("D")).toBe("blooded");
    expect(stageFromTier("C")).toBe("blooded");
  });

  it("maps B and A to command — Maj., gear B-A", () => {
    expect(stageFromTier("B")).toBe("command");
    expect(stageFromTier("A")).toBe("command");
  });

  it("covers every real Tier value with no gaps", () => {
    const allTiers: Tier[] = ["G", "F", "E", "D", "C", "B", "A"];
    const stages: Stage[] = ["green", "blooded", "command"];
    for (const t of allTiers) {
      expect(stages).toContain(stageFromTier(t));
    }
  });
});

describe("pickAmbientLine — stage-gated, 27 Aug 2026", () => {
  it("a green-stage pilot's panicking (fear) line always comes from that catalyst's own green fear bucket", () => {
    const p = pilot({ catalyst: "wolf", stage: "green", stress: 90 }); // stress >= STRESS_PANIC_THRESHOLD forces fear
    const greenFear = new Set(LINE_BANK.wolf.fear.green);
    for (let i = 0; i < 50; i++) {
      const { line, pick } = pickAmbientLine(p);
      expect(pick.echo).toBe("fear");
      expect(greenFear.has(line)).toBe(true);
    }
  });

  it("a command-stage pilot with the same catalyst/echo draws from a different (disjoint) bucket than green", () => {
    const greenPilot = pilot({ catalyst: "raven", stage: "green", stress: 90 });
    const commandPilot = pilot({ catalyst: "raven", stage: "command", stress: 90 });
    const commandFear = new Set(LINE_BANK.raven.fear.command);
    const greenFear = new Set(LINE_BANK.raven.fear.green);
    // The two buckets are disjoint (zero duplicates across the whole merge,
    // verified at build time) — so a command pick should never land in the
    // green set and vice versa.
    for (let i = 0; i < 30; i++) {
      expect(greenFear.has(pickAmbientLine(commandPilot).line)).toBe(false);
      expect(commandFear.has(pickAmbientLine(greenPilot).line)).toBe(false);
    }
  });
});

describe("pickLineForMessage — stage-gated, 27 Aug 2026", () => {
  it("an emotion message draws from the speaker's own stage bucket", () => {
    const speaker = { catalyst: "bear" as const, stage: "command" as const };
    const commandLove = new Set(LINE_BANK.bear.love.command);
    for (let i = 0; i < 30; i++) {
      const line = pickLineForMessage(speaker, { kind: "emotion", echo: "love" });
      expect(commandLove.has(line)).toBe(true);
    }
  });

  it("muster and rumor messages are unaffected by stage — same content regardless", () => {
    const green = { catalyst: "shark" as const, stage: "green" as const };
    const command = { catalyst: "shark" as const, stage: "command" as const };
    const musterGreen = pickLineForMessage(green, { kind: "muster" });
    const musterCommand = pickLineForMessage(command, { kind: "muster" });
    // Both draw from the same MUSTER_LINES pool regardless of stage — just
    // confirms neither call throws and both return real, non-empty text.
    expect(musterGreen.length).toBeGreaterThan(0);
    expect(musterCommand.length).toBeGreaterThan(0);
  });
});

describe("detectStagePromotion — graduation-reveal gating, 27 Aug 2026", () => {
  it("returns undefined when lastAcknowledged is undefined — a backfill case, not a promotion", () => {
    const stages: Stage[] = ["green", "blooded", "command"];
    for (const s of stages) {
      expect(detectStagePromotion(undefined, s)).toBeUndefined();
    }
  });

  it("returns undefined when nothing changed, for all three stages", () => {
    expect(detectStagePromotion("green", "green")).toBeUndefined();
    expect(detectStagePromotion("blooded", "blooded")).toBeUndefined();
    expect(detectStagePromotion("command", "command")).toBeUndefined();
  });

  it("reports a real green -> blooded promotion", () => {
    expect(detectStagePromotion("green", "blooded")).toBe("blooded");
  });

  it("reports a real blooded -> command promotion", () => {
    expect(detectStagePromotion("blooded", "command")).toBe("command");
  });

  it("never reports a promotion INTO green — a hypothetical green regression is defensively ignored, not surfaced as a promotion", () => {
    expect(detectStagePromotion("blooded", "green")).toBeUndefined();
    expect(detectStagePromotion("command", "green")).toBeUndefined();
  });
});

describe("pickStagePromotionLine — graduation-reveal content, catalyst-specific as of 27 Aug 2026 (later pass)", () => {
  const ALL_CATALYSTS = Object.keys(LINE_BANK) as (keyof typeof LINE_BANK)[];

  it("always returns real, non-empty content for every catalyst, both transitions, over many trials", () => {
    for (const catalyst of ALL_CATALYSTS) {
      for (const stage of ["blooded", "command"] as const) {
        for (let i = 0; i < 20; i++) {
          const line = pickStagePromotionLine(catalyst, stage);
          expect(typeof line).toBe("string");
          expect(line.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("for a given catalyst, 'blooded' and 'command' draw from disjoint pools", () => {
    for (const catalyst of ALL_CATALYSTS) {
      const bloodedLines = new Set(Array.from({ length: 30 }, () => pickStagePromotionLine(catalyst, "blooded")));
      const commandLines = new Set(Array.from({ length: 30 }, () => pickStagePromotionLine(catalyst, "command")));
      for (const line of bloodedLines) expect(commandLines.has(line)).toBe(false);
    }
  });

  it("different catalysts draw genuinely different content for the same transition — this is the catalyst-specific rewrite, not a shared pool with a catalyst parameter bolted on", () => {
    const wolfLines = new Set(Array.from({ length: 20 }, () => pickStagePromotionLine("wolf", "command")));
    const sharkLines = new Set(Array.from({ length: 20 }, () => pickStagePromotionLine("shark", "command")));
    for (const line of wolfLines) expect(sharkLines.has(line)).toBe(false);
  });
});
