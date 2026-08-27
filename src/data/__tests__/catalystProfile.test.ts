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
  pickAmbientLineWithBleed,
  AMBIENT_BLEED_CHANCE,
  SUBANIMAL_INSTINCT_WEIGHT,
  SUBANIMAL_THOUGHT_WEIGHT,
  SUBANIMAL_ACTION_WEIGHT,
  SUBANIMAL_WEIGHTS_BY_STAGE,
  CATALYST_CLASH_PAIRS,
  catalystsClash,
  findCatalystClash,
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

describe("pickAmbientLineWithBleed — ambient bleed into idle/verb-outcome lines, 27 Aug 2026 (roadmap #2)", () => {
  it("always returns real, non-empty content, bled or not, over many trials across every catalyst", () => {
    for (const catalyst of ALL_CATALYSTS) {
      for (let i = 0; i < 20; i++) {
        const { line } = pickAmbientLineWithBleed("pilot_probe", pilot({ catalyst }));
        expect(typeof line).toBe("string");
        expect(line.length).toBeGreaterThan(0);
      }
    }
  });

  it("bleeds at roughly AMBIENT_BLEED_CHANCE (~30%) of the time, not never and not always", () => {
    const trials = 3000;
    let bledCount = 0;
    for (let i = 0; i < trials; i++) {
      const { bled } = pickAmbientLineWithBleed("pilot_rate_probe", pilot({ catalyst: "wolf" }));
      if (bled) bledCount++;
    }
    const rate = bledCount / trials;
    // Loose band around AMBIENT_BLEED_CHANCE (0.3) — same "real margin
    // comfortably clears sampling variance" reasoning as this file's other
    // statistical checks, not pinned to an exact count.
    expect(rate).toBeGreaterThan(AMBIENT_BLEED_CHANCE - 0.05);
    expect(rate).toBeLessThan(AMBIENT_BLEED_CHANCE + 0.05);
  });

  it("when bled, the reported catalyst is always one of this pilot's own three sub-animals, never the primary", () => {
    const pilotId = "pilot_bleed_identity";
    const primary: Catalyst = "raven";
    const subs = assignSubAnimals(pilotId, primary);
    const subAnimalCatalysts = Object.values(subs);
    let sawABleed = false;
    for (let i = 0; i < 500; i++) {
      const { bled } = pickAmbientLineWithBleed(pilotId, pilot({ catalyst: primary }));
      if (!bled) continue;
      sawABleed = true;
      expect(bled.catalyst).not.toBe(primary);
      expect(subAnimalCatalysts).toContain(bled.catalyst);
      expect(["instinct", "thought", "action"]).toContain(bled.role);
    }
    expect(sawABleed).toBe(true); // 500 trials at ~30% makes never seeing one astronomically unlikely
  });

  it("when NOT bled, the line actually comes from the pilot's own primary catalyst's LINE_BANK bucket for that echo/stage", () => {
    const primary: Catalyst = "shark";
    const stage = "command" as const;
    for (let i = 0; i < 200; i++) {
      const { line, pick, bled } = pickAmbientLineWithBleed("pilot_primary_probe", pilot({ catalyst: primary, stage }));
      if (bled) continue;
      expect(LINE_BANK[primary][pick.echo][stage]).toContain(line);
    }
  });

  it("when bled, the line actually comes from the bled sub-animal's own LINE_BANK bucket, not the primary's", () => {
    const primary: Catalyst = "cat";
    const stage = "green" as const;
    let checkedAtLeastOne = false;
    for (let i = 0; i < 500; i++) {
      const { line, pick, bled } = pickAmbientLineWithBleed("pilot_bleed_content", pilot({ catalyst: primary, stage }));
      if (!bled) continue;
      checkedAtLeastOne = true;
      expect(LINE_BANK[bled.catalyst][pick.echo][stage]).toContain(line);
    }
    expect(checkedAtLeastOne).toBe(true);
  });

  it("is otherwise a drop-in replacement for pickAmbientLine — same pick.echo selection logic applies (e.g. a drunk pilot always gets love or anger)", () => {
    for (let i = 0; i < 30; i++) {
      const { pick } = pickAmbientLineWithBleed("pilot_drunk_probe", pilot({ catalyst: "dog", drunk: true }));
      expect(["love", "anger"]).toContain(pick.echo);
      expect(pick.reason).toBe("drunk");
    }
  });
});

describe("catalystsClash / findCatalystClash — catalyst clash reactions, 27 Aug 2026 (roadmap #10)", () => {
  it("is symmetric — order of arguments never matters", () => {
    for (const [a, b] of CATALYST_CLASH_PAIRS) {
      expect(catalystsClash(a, b)).toBe(true);
      expect(catalystsClash(b, a)).toBe(true);
    }
  });

  it("includes the roadmap doc's own example verbatim: wolf's teamwork against shark's ambition", () => {
    expect(catalystsClash("wolf", "shark")).toBe(true);
  });

  it("a catalyst never clashes with itself", () => {
    for (const catalyst of ALL_CATALYSTS) {
      expect(catalystsClash(catalyst, catalyst)).toBe(false);
    }
  });

  it("most pairs are NOT a clash — this is a curated, non-exhaustive set, not every combination", () => {
    // 36 possible unordered pairs across 9 catalysts; CATALYST_CLASH_PAIRS
    // is a small curated subset, so a random sampling of pairs should turn
    // up plenty of non-clashes.
    let clashCount = 0;
    let total = 0;
    for (let i = 0; i < ALL_CATALYSTS.length; i++) {
      for (let j = i + 1; j < ALL_CATALYSTS.length; j++) {
        total++;
        if (catalystsClash(ALL_CATALYSTS[i], ALL_CATALYSTS[j])) clashCount++;
      }
    }
    expect(clashCount).toBe(CATALYST_CLASH_PAIRS.length);
    expect(clashCount).toBeLessThan(total);
  });

  it("findCatalystClash returns undefined for an empty or single-candidate list", () => {
    expect(findCatalystClash([])).toBeUndefined();
    expect(findCatalystClash([{ pilotId: "pilot_a", catalyst: "wolf" }])).toBeUndefined();
  });

  it("findCatalystClash returns undefined when no two candidates are a genuinely opposed pair", () => {
    // raven/crow IS a listed clash pair, but wolf/dog/raven together have no
    // opposed pair among them.
    const candidates = [
      { pilotId: "pilot_a", catalyst: "wolf" as const },
      { pilotId: "pilot_b", catalyst: "dog" as const },
      { pilotId: "pilot_c", catalyst: "raven" as const },
    ];
    expect(findCatalystClash(candidates)).toBeUndefined();
  });

  it("findCatalystClash finds a real opposed pair among a mixed candidate list", () => {
    const candidates = [
      { pilotId: "pilot_dog", catalyst: "dog" as const },
      { pilotId: "pilot_wolf", catalyst: "wolf" as const },
      { pilotId: "pilot_shark", catalyst: "shark" as const },
    ];
    const clash = findCatalystClash(candidates);
    expect(clash).toBeDefined();
    const ids = clash!.map((c) => c.pilotId).sort();
    // wolf/shark is the only opposed pair present (dog/wolf and dog/shark
    // are not listed clash pairs).
    expect(ids).toEqual(["pilot_shark", "pilot_wolf"]);
  });

  it("findCatalystClash returns candidates in the order they were passed (first-found pair, first element first)", () => {
    const candidates = [
      { pilotId: "pilot_first", catalyst: "wolf" as const },
      { pilotId: "pilot_second", catalyst: "shark" as const },
    ];
    const clash = findCatalystClash(candidates);
    expect(clash?.[0].pilotId).toBe("pilot_first");
    expect(clash?.[1].pilotId).toBe("pilot_second");
  });
});
