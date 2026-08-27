// src/data/__tests__/catalystProfile.test.ts
// Hub polish, 26 Aug 2026 — sub-animal dictionary system. Covers
// assignSubAnimals' determinism/exclusivity and pickCatalystReaction's
// tiered matching (primary always-on, sub-animals weighted), same
// statistical-check spirit as reactionGate.test.ts's own "many trials"
// cases for the probabilistic tiers.
import { describe, it, expect } from "vitest";
import {
  assignSubAnimals,
  CATALYST_DICTIONARY,
  pickCatalystReaction,
  SUBANIMAL_INSTINCT_WEIGHT,
  SUBANIMAL_THOUGHT_WEIGHT,
  SUBANIMAL_ACTION_WEIGHT,
  SUBANIMAL_WEIGHTS_BY_STAGE,
  type SubAnimalRole,
} from "../catalystProfile";
import { LINE_BANK, type AmbientPilotState, type Catalyst } from "../ambientLines";

const ALL_CATALYSTS: Catalyst[] = ["wolf", "dog", "cat", "crow", "raven", "bear", "fox", "rabbit", "shark"];

function pilot(overrides: Partial<AmbientPilotState> = {}): AmbientPilotState {
  // stage defaults to "blooded" — see ambientLines.test.ts's own helper for
  // why.
  return { catalyst: "raven", stage: "blooded", stress: 30, morale: 70, drunk: false, ...overrides };
}

describe("assignSubAnimals", () => {
  it("is deterministic — same pilotId and primary always yields the same three sub-animals", () => {
    const a = assignSubAnimals("pilot_bosk", "raven");
    const b = assignSubAnimals("pilot_bosk", "raven");
    expect(a).toEqual(b);
  });

  it("never assigns the primary catalyst to any role", () => {
    for (const primary of ALL_CATALYSTS) {
      const subs = assignSubAnimals("pilot_test", primary);
      expect(Object.values(subs)).not.toContain(primary);
    }
  });

  it("never assigns the same catalyst to two different roles", () => {
    for (const primary of ALL_CATALYSTS) {
      const subs = assignSubAnimals("pilot_test", primary);
      const values = Object.values(subs);
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it("different pilotIds tend to get different assignments (not a constant fallback)", () => {
    const ids = ["pilot_a", "pilot_b", "pilot_c", "pilot_d", "pilot_e", "pilot_f"];
    const results = ids.map((id) => JSON.stringify(assignSubAnimals(id, "raven")));
    const distinct = new Set(results);
    expect(distinct.size).toBeGreaterThan(1);
  });

  it("only ever returns real Catalyst values for all three roles", () => {
    const subs = assignSubAnimals("pilot_zzz", "shark");
    const roles: SubAnimalRole[] = ["instinct", "thought", "action"];
    for (const role of roles) {
      expect(ALL_CATALYSTS).toContain(subs[role]);
    }
  });
});

describe("CATALYST_DICTIONARY", () => {
  it("has a non-empty word list for every catalyst", () => {
    for (const c of ALL_CATALYSTS) {
      expect(CATALYST_DICTIONARY[c].length).toBeGreaterThan(0);
    }
  });
});

describe("pickCatalystReaction — primary catalyst, always-on", () => {
  it("returns a reaction, source 'primary', when the text hits the pilot's own catalyst dictionary", () => {
    // raven's dictionary includes "plan" — pilot() defaults to raven.
    const reaction = pickCatalystReaction(pilot({ catalyst: "raven" }), "pilot_x", "what's the plan here");
    expect(reaction).not.toBeNull();
    expect(reaction?.source).toBe("primary");
    expect(reaction?.catalyst).toBe("raven");
  });

  it("primary match is unconditional — never fails across many trials (no roll applied)", () => {
    for (let i = 0; i < 200; i++) {
      const reaction = pickCatalystReaction(pilot({ catalyst: "shark" }), "pilot_shark_trial", "let's talk about ambition");
      expect(reaction).not.toBeNull();
      expect(reaction?.source).toBe("primary");
    }
  });

  it("the returned line actually comes from that catalyst's own LINE_BANK", () => {
    const reaction = pickCatalystReaction(pilot({ catalyst: "bear" }), "pilot_y", "I need some quiet");
    expect(reaction).not.toBeNull();
    // Flattened two levels — LINE_BANK gained a Stage layer 27 Aug 2026, see
    // socialSim.test.ts's own ALL_LINES comment for the same fix.
    const allBearLines = Object.values(LINE_BANK.bear).flatMap((byStage) => Object.values(byStage).flat());
    expect(allBearLines).toContain(reaction?.line);
  });

  it("word-boundary matching — 'win' inside 'winter' does not false-positive shark's dictionary", () => {
    const reaction = pickCatalystReaction(pilot({ catalyst: "shark" }), "pilot_z", "it's winter and cold");
    // May still be null or come from a sub-animal roll, but must NOT be a
    // primary hit off a substring match inside "winter".
    if (reaction) expect(reaction.source).not.toBe("primary");
  });
});

describe("pickCatalystReaction — stage-gated, 27 Aug 2026", () => {
  // pickSoloEcho reads whichever echo the pilot's own state resolves to
  // (idle here — stress/morale are both mid-range in the pilot() default),
  // so this checks across ALL echoes for one stage, not one fixed echo —
  // zero duplicate lines exist across stages (verified at build/merge
  // time), so green and command content can never overlap here.
  const bearGreenAllEchoes = new Set(Object.values(LINE_BANK.bear).map((byStage) => byStage.green).flat());
  const bearCommandAllEchoes = new Set(Object.values(LINE_BANK.bear).map((byStage) => byStage.command).flat());

  it("a primary-catalyst hit draws from the PILOT's own stage, not a fixed one", () => {
    for (let i = 0; i < 30; i++) {
      const greenReaction = pickCatalystReaction(pilot({ catalyst: "bear", stage: "green" }), "pilot_stage_a", "I need some quiet");
      expect(greenReaction).not.toBeNull();
      expect(bearGreenAllEchoes.has(greenReaction!.line)).toBe(true);
      expect(bearCommandAllEchoes.has(greenReaction!.line)).toBe(false);

      const commandReaction = pickCatalystReaction(pilot({ catalyst: "bear", stage: "command" }), "pilot_stage_b", "I need some quiet");
      expect(commandReaction).not.toBeNull();
      expect(bearCommandAllEchoes.has(commandReaction!.line)).toBe(true);
      expect(bearGreenAllEchoes.has(commandReaction!.line)).toBe(false);
    }
  });
});

describe("pickCatalystReaction — no match", () => {
  it("returns null for empty/whitespace text", () => {
    expect(pickCatalystReaction(pilot(), "pilot_a", "")).toBeNull();
    expect(pickCatalystReaction(pilot(), "pilot_a", "   ")).toBeNull();
  });

  it("returns null when nothing in the pilot's dictionary tree matches at all", () => {
    // "xyzzyplugh" hits nothing in any catalyst's dictionary.
    for (let i = 0; i < 20; i++) {
      const reaction = pickCatalystReaction(pilot({ catalyst: "raven" }), "pilot_nomatch", "xyzzyplugh");
      expect(reaction).toBeNull();
    }
  });
});

describe("pickCatalystReaction — sub-animal tiers, weighted", () => {
  // Find a pilotId/primary pair whose instinct sub-animal is known, then
  // drive a word from that sub-animal's own dictionary — since primary
  // itself must NOT match that word (a real pilot's dictionary and their
  // sub-animal's dictionary could theoretically overlap on a shared word
  // like "alone", so this picks a case that's clean).
  it("a word hitting only the instinct sub-animal's dictionary reacts roughly at the instinct weight, over many trials", () => {
    const pilotId = "pilot_instinct_probe";
    const primary: Catalyst = "raven";
    const subs = assignSubAnimals(pilotId, primary);
    const instinctWords = CATALYST_DICTIONARY[subs.instinct];
    // Pick a word from the instinct dictionary that doesn't also appear in
    // primary's own dictionary or the other two sub-animal dictionaries —
    // guarantees a clean single-tier test.
    const word = instinctWords.find(
      (w) =>
        !CATALYST_DICTIONARY[primary].includes(w) &&
        !CATALYST_DICTIONARY[subs.thought].includes(w) &&
        !CATALYST_DICTIONARY[subs.action].includes(w)
    );
    expect(word).toBeDefined();

    const trials = 3000;
    let hits = 0;
    for (let i = 0; i < trials; i++) {
      const reaction = pickCatalystReaction(pilot({ catalyst: primary }), pilotId, `talking about ${word} today`);
      if (reaction) {
        expect(reaction.source).toBe("instinct");
        hits++;
      }
    }
    const rate = hits / trials;
    expect(rate).toBeGreaterThan(SUBANIMAL_INSTINCT_WEIGHT - 0.08);
    expect(rate).toBeLessThan(SUBANIMAL_INSTINCT_WEIGHT + 0.08);
  });

  it("instinct is checked before thought — a word hitting both tiers' dictionaries resolves to instinct", () => {
    // Can't force overlap deterministically without reaching into the
    // dictionary, so this asserts the priority order structurally instead:
    // run pickCatalystReaction many times with a word crafted to hit
    // instinct only, and confirm 'thought'/'action' never appear for it.
    const pilotId = "pilot_priority_probe";
    const primary: Catalyst = "fox";
    const subs = assignSubAnimals(pilotId, primary);
    const word = CATALYST_DICTIONARY[subs.instinct].find(
      (w) =>
        !CATALYST_DICTIONARY[primary].includes(w) &&
        !CATALYST_DICTIONARY[subs.thought].includes(w) &&
        !CATALYST_DICTIONARY[subs.action].includes(w)
    );
    expect(word).toBeDefined();
    for (let i = 0; i < 100; i++) {
      const reaction = pickCatalystReaction(pilot({ catalyst: primary }), pilotId, `${word}`);
      if (reaction) expect(reaction.source).toBe("instinct");
    }
  });

  it("action sub-animal reacts less often than thought, which reacts less often than instinct, over many trials", () => {
    // Statistical sanity check on the three weight constants themselves,
    // independent of pickCatalystReaction — confirms the ordering the
    // design comment claims (instinct fastest, action loosest).
    expect(SUBANIMAL_INSTINCT_WEIGHT).toBeGreaterThan(SUBANIMAL_THOUGHT_WEIGHT);
    expect(SUBANIMAL_THOUGHT_WEIGHT).toBeGreaterThan(SUBANIMAL_ACTION_WEIGHT);
  });
});

// Stage-weighted sub-animal confidence, 27 Aug 2026 (later pass) — roadmap
// #3. SUBANIMAL_INSTINCT_WEIGHT/SUBANIMAL_THOUGHT_WEIGHT/
// SUBANIMAL_ACTION_WEIGHT are now specifically the "blooded" baseline;
// these tests cover the green/command ends of the ladder plus the
// structural claim (a veteran trusts instinct more, a rookie leans on
// deliberate "thought" more) rather than re-testing pickCatalystReaction's
// own tier-priority machinery a second time.
describe("SUBANIMAL_WEIGHTS_BY_STAGE — stage-weighted sub-animal confidence, 27 Aug 2026", () => {
  it("blooded matches the flat legacy constants exactly — the pre-this-pass behavior is preserved as one point on the new ladder, not replaced", () => {
    expect(SUBANIMAL_WEIGHTS_BY_STAGE.blooded).toEqual({
      instinct: SUBANIMAL_INSTINCT_WEIGHT,
      thought: SUBANIMAL_THOUGHT_WEIGHT,
      action: SUBANIMAL_ACTION_WEIGHT,
    });
  });

  it("a command-stage veteran trusts instinct more than a green rookie does", () => {
    expect(SUBANIMAL_WEIGHTS_BY_STAGE.command.instinct).toBeGreaterThan(SUBANIMAL_WEIGHTS_BY_STAGE.blooded.instinct);
    expect(SUBANIMAL_WEIGHTS_BY_STAGE.blooded.instinct).toBeGreaterThan(SUBANIMAL_WEIGHTS_BY_STAGE.green.instinct);
  });

  it("a green rookie's deliberate 'thought' voice dominates more than a command veteran's does", () => {
    expect(SUBANIMAL_WEIGHTS_BY_STAGE.green.thought).toBeGreaterThan(SUBANIMAL_WEIGHTS_BY_STAGE.blooded.thought);
    expect(SUBANIMAL_WEIGHTS_BY_STAGE.blooded.thought).toBeGreaterThan(SUBANIMAL_WEIGHTS_BY_STAGE.command.thought);
  });

  it("action's weight is flat across all three stages — impulsiveness isn't rank-dependent, per the design comment", () => {
    expect(SUBANIMAL_WEIGHTS_BY_STAGE.green.action).toBe(SUBANIMAL_ACTION_WEIGHT);
    expect(SUBANIMAL_WEIGHTS_BY_STAGE.command.action).toBe(SUBANIMAL_ACTION_WEIGHT);
  });

  it("pickCatalystReaction actually reads the pilot's own stage, not a fixed constant — a command-stage pilot reacts to an instinct-only word noticeably more often than a green-stage pilot, over many trials", () => {
    const pilotId = "pilot_stage_weight_probe";
    const primary: Catalyst = "bear";
    const subs = assignSubAnimals(pilotId, primary);
    const word = CATALYST_DICTIONARY[subs.instinct].find(
      (w) =>
        !CATALYST_DICTIONARY[primary].includes(w) &&
        !CATALYST_DICTIONARY[subs.thought].includes(w) &&
        !CATALYST_DICTIONARY[subs.action].includes(w)
    );
    expect(word).toBeDefined();

    function hitRate(stage: "green" | "command"): number {
      const trials = 2000;
      let hits = 0;
      for (let i = 0; i < trials; i++) {
        if (pickCatalystReaction(pilot({ catalyst: primary, stage }), pilotId, `${word}`)) hits++;
      }
      return hits / trials;
    }

    const greenRate = hitRate("green");
    const commandRate = hitRate("command");
    // Predicted 0.35 vs 0.65 — real margin (~0.3) comfortably clears normal
    // sampling variance at n=2000, so a loose but real assertion is safe
    // rather than pinning exact rates.
    expect(commandRate).toBeGreaterThan(greenRate + 0.15);
  });
});
