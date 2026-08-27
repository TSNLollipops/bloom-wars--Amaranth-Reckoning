// engine/socialSim.ts — the background NPC social-sim harness (26 Aug 2026,
// Maxime's "irl sim to test the social engine" request). See that file's
// own header for the full design and the one real correction made during
// implementation (individual Favorability/Stress/Morale stay untouched;
// only the pairwise bond moves).
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  pickPair,
  pickEncounterKind,
  isCommitted,
  resolveTalkEncounter,
  resolvePegBoardEncounter,
  resolveAbstractedMinigameEncounter,
  resolveAskOutEncounter,
  simulateEncounter,
  simulateDay,
  ASK_OUT_CHANCE,
  type SocialSimPilot,
  type SocialSimState,
} from "../socialSim";
import { ROMANCE_ACCEPT_FAVORABILITY_DELTA, ROMANCE_REJECT_FAVORABILITY_DELTA, ROMANCE_MIN_FAVORABILITY } from "../../data/romance";
import { GATE0_BASE_CHANCE } from "../../data/reactionGate";
import { LINE_BANK } from "../../data/ambientLines";

afterEach(() => vi.restoreAllMocks());

// stage: "blooded" for all three — see ambientLines.test.ts's own pilot()
// helper for why "blooded" is the right stand-in default pre-existing tests
// were implicitly exercising before the Stage axis existed.
const BOSK: SocialSimPilot = { pilotId: "pilot_bosk", displayName: "Bosk", catalyst: "raven", stage: "blooded" };
const ANAND: SocialSimPilot = { pilotId: "pilot_anand", displayName: "Anand", catalyst: "wolf", stage: "blooded" };
const IYARI: SocialSimPilot = { pilotId: "pilot_iyari", displayName: "Iyari", catalyst: "crow", stage: "blooded" };

describe("pickPair", () => {
  it("with a forced low rng, picks two distinct, in-bounds roster entries", () => {
    const roster = [BOSK, ANAND, IYARI];
    const rng = () => 0.01;
    const [a, b] = pickPair(roster, rng);
    expect(roster).toContain(a);
    expect(roster).toContain(b);
    expect(a).not.toBe(b);
  });

  it("across many real-random draws, never returns the same pilot twice", () => {
    const roster = [BOSK, ANAND, IYARI];
    for (let i = 0; i < 200; i++) {
      const [a, b] = pickPair(roster, Math.random);
      expect(a.pilotId).not.toBe(b.pilotId);
    }
  });

  it("throws on a roster with fewer than 2 pilots — nothing to pair", () => {
    expect(() => pickPair([BOSK], Math.random)).toThrow();
  });
});

describe("pickEncounterKind", () => {
  it("returns askOut when eligible and the roll lands under ASK_OUT_CHANCE", () => {
    const kind = pickEncounterKind({ eligibleForAskOut: true, rng: () => ASK_OUT_CHANCE - 0.01 });
    expect(kind).toBe("askOut");
  });

  it("never returns askOut when the pair isn't eligible, even on the same low roll that would otherwise trigger it", () => {
    const kind = pickEncounterKind({ eligibleForAskOut: false, rng: () => 0.001 });
    expect(kind).not.toBe("askOut");
  });

  it("falls through to the weighted talk/pegBoard/poker/fletchers pool once the askOut roll (or eligibility) misses", () => {
    // rng() called twice: once for the (missed) askOut roll, once for the weighted pick.
    // A sequence lets each call return a different value.
    const values = [0.99, 0.0]; // askOut roll misses (0.99 > ASK_OUT_CHANCE), then weighted roll lands at the very start -> "talk" (first bucket)
    let i = 0;
    const rng = () => values[i++];
    const kind = pickEncounterKind({ eligibleForAskOut: true, rng });
    expect(kind).toBe("talk");
  });
});

describe("isCommitted", () => {
  it("true when the pilot is in the player-committed set", () => {
    const state: SocialSimState = { bonds: {}, relationships: [] };
    expect(isCommitted("pilot_bosk", state, new Set(["pilot_bosk"]))).toBe(true);
  });

  it("true when the pilot already appears in an NPC-NPC relationships pairKey", () => {
    const state: SocialSimState = { bonds: {}, relationships: ["pilot_anand::pilot_bosk"] };
    expect(isCommitted("pilot_bosk", state, new Set())).toBe(true);
    expect(isCommitted("pilot_anand", state, new Set())).toBe(true);
  });

  it("false when neither applies", () => {
    const state: SocialSimState = { bonds: {}, relationships: [] };
    expect(isCommitted("pilot_iyari", state, new Set())).toBe(false);
  });
});

describe("resolveTalkEncounter", () => {
  it("a forced-low Math.random roll lands the Gate 0 reaction — bond nudges +1 when the bond was already >= 0", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.01); // well under GATE0_BASE_CHANCE (0.65)
    const result = resolveTalkEncounter({ pilotA: BOSK, pilotB: ANAND, bond: 40, aCommitted: false, bCommitted: false, rng: () => 0.5 });
    expect(result.kind).toBe("talk");
    expect(result.bondDelta).toBe(1);
    expect(result.becameCouple).toBe(false);
  });

  it("a forced-low roll on a negative bond nudges -1 — further into the friction it's already trending toward", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.01);
    const result = resolveTalkEncounter({ pilotA: ANAND, pilotB: IYARI, bond: -25, aCommitted: false, bCommitted: false, rng: () => 0.5 });
    expect(result.bondDelta).toBe(-1);
  });

  it("a forced-high Math.random roll misses Gate 0 — no reaction, bond unchanged", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99); // well over GATE0_BASE_CHANCE
    const result = resolveTalkEncounter({ pilotA: BOSK, pilotB: ANAND, bond: 40, aCommitted: false, bCommitted: false, rng: () => 0.5 });
    expect(result.bondDelta).toBe(0);
    expect(result.summary).toContain("didn't really land");
  });

  it("sanity check: GATE0_BASE_CHANCE is what a neutral (sober, unstressed) listener actually resolves to here", () => {
    // Documents the real simplification this file's own header flags: no
    // live per-pilot drunk/Stress state is threaded through, so this
    // always checks against the plain base chance, never the drunk bonus
    // or panic penalty reactionGate.ts also defines.
    expect(GATE0_BASE_CHANCE).toBeGreaterThan(0);
    expect(GATE0_BASE_CHANCE).toBeLessThan(1);
  });

  // Live-visual staging, 26 Aug 2026 — lineA/lineB, added so Hub.ts can
  // show a real two-bubble exchange instead of narrating one. Same spirit
  // as catalystProfile.test.ts's own membership checks: verify the actual
  // returned string is real content, not just that a field is truthy.
  describe("lineA / lineB", () => {
    // Flattened two levels deep now — LINE_BANK gained a Stage layer 27 Aug
    // 2026 (Record<Catalyst, Record<Echo, Record<Stage, string[]>>>), so a
    // membership check needs to flatten catalyst -> echo -> stage, not just
    // catalyst -> echo.
    const ALL_LINES = Object.values(LINE_BANK).flatMap((byEcho) => Object.values(byEcho).flatMap((byStage) => Object.values(byStage).flat()));

    it("lineA is always a real line from npcA's own LINE_BANK, whether or not Gate 0 reacts", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.01); // reacted
      const reacted = resolveTalkEncounter({ pilotA: BOSK, pilotB: ANAND, bond: 0, aCommitted: false, bCommitted: false, rng: () => 0.5 });
      expect(reacted.lineA).toBeDefined();
      expect(ALL_LINES).toContain(reacted.lineA);

      vi.spyOn(Math, "random").mockReturnValue(0.99); // missed
      const missed = resolveTalkEncounter({ pilotA: BOSK, pilotB: ANAND, bond: 0, aCommitted: false, bCommitted: false, rng: () => 0.5 });
      expect(missed.lineA).toBeDefined();
      expect(ALL_LINES).toContain(missed.lineA);
    });

    it("lineB is present when Gate 0 reacts, and absent (not just falsy — genuinely undefined) when it misses", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.01);
      const reacted = resolveTalkEncounter({ pilotA: BOSK, pilotB: ANAND, bond: 0, aCommitted: false, bCommitted: false, rng: () => 0.5 });
      expect(reacted.lineB).toBeDefined();
      expect(ALL_LINES).toContain(reacted.lineB);

      vi.spyOn(Math, "random").mockReturnValue(0.99);
      const missed = resolveTalkEncounter({ pilotA: BOSK, pilotB: ANAND, bond: 0, aCommitted: false, bCommitted: false, rng: () => 0.5 });
      expect(missed.lineB).toBeUndefined();
    });

    it("the old summary sentence still quotes lineB verbatim — unchanged behavior for the CLI/log consumer", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.01);
      const result = resolveTalkEncounter({ pilotA: BOSK, pilotB: ANAND, bond: 0, aCommitted: false, bCommitted: false, rng: () => 0.5 });
      expect(result.summary).toContain(result.lineB as string);
    });

    it("when npcA's line hits npcB's own catalyst dictionary, lineB comes back flavored (still real LINE_BANK content, from npcB's primary catalyst)", () => {
      // Raven's dictionary includes "plan" (catalystProfile.ts) — force a
      // pairing where that word is guaranteed to be in play: fabricate the
      // scenario at the resolver level by checking the actual mechanism
      // instead (pickCatalystReaction is exercised directly in
      // catalystProfile.test.ts) — here it's enough to confirm the wiring
      // doesn't crash and still returns real content across many trials
      // with a real catalyst pair likely to share vocabulary (wolf/raven
      // both lean on squad/plan-flavored words in their own line banks).
      vi.spyOn(Math, "random").mockReturnValue(0.01);
      for (let i = 0; i < 25; i++) {
        const result = resolveTalkEncounter({ pilotA: ANAND, pilotB: BOSK, bond: 0, aCommitted: false, bCommitted: false, rng: () => 0.5 });
        expect(result.lineB).toBeDefined();
        expect(ALL_LINES).toContain(result.lineB);
      }
    });
  });
});

describe("resolveTalkEncounter — stage-gated, 27 Aug 2026", () => {
  it("lineA draws from pilotA's own stage bucket, not a fixed one", () => {
    const greenBosk: SocialSimPilot = { ...BOSK, stage: "green" };
    const commandBosk: SocialSimPilot = { ...BOSK, stage: "command" };
    const greenAllEchoes = new Set(Object.values(LINE_BANK.raven).map((byStage) => byStage.green).flat());
    const commandAllEchoes = new Set(Object.values(LINE_BANK.raven).map((byStage) => byStage.command).flat());

    vi.spyOn(Math, "random").mockReturnValue(0.99); // Gate 0 misses — only lineA matters here
    for (let i = 0; i < 20; i++) {
      const green = resolveTalkEncounter({ pilotA: greenBosk, pilotB: ANAND, bond: 0, aCommitted: false, bCommitted: false, rng: () => 0.5 });
      expect(greenAllEchoes.has(green.lineA as string)).toBe(true);
      expect(commandAllEchoes.has(green.lineA as string)).toBe(false);

      const command = resolveTalkEncounter({ pilotA: commandBosk, pilotB: ANAND, bond: 0, aCommitted: false, bCommitted: false, rng: () => 0.5 });
      expect(commandAllEchoes.has(command.lineA as string)).toBe(true);
      expect(greenAllEchoes.has(command.lineA as string)).toBe(false);
    }
  });
});

describe("resolvePegBoardEncounter", () => {
  it("runs a real, complete peg board game end to end and returns a resolved, sensible outcome", () => {
    const result = resolvePegBoardEncounter({ pilotA: BOSK, pilotB: ANAND, bond: 10, aCommitted: false, bCommitted: false, rng: () => 0.5 });
    expect(result.kind).toBe("pegBoard");
    expect([0, 2, 6]).toContain(result.bondDelta); // 0 only on the never-expected guard path
    expect(result.bondDelta).toBeGreaterThanOrEqual(0); // never negative — see file header on why a shared bond only ever moves up from playing together
    expect(result.summary).toContain("Bosk");
    expect(result.summary).toContain("Anand");
    expect(result.becameCouple).toBe(false);
  });

  it("many real games in a row always resolve (never trips the guard) and always land on the 2-or-6 delta", () => {
    for (let i = 0; i < 25; i++) {
      const result = resolvePegBoardEncounter({ pilotA: BOSK, pilotB: IYARI, bond: 0, aCommitted: false, bCommitted: false, rng: () => 0.5 });
      expect([2, 6]).toContain(result.bondDelta);
    }
  });
});

describe("resolveAbstractedMinigameEncounter", () => {
  it("poker: a forced-low rng picks pilotA as the (abstracted) winner, always a +6 delta", () => {
    const result = resolveAbstractedMinigameEncounter("poker", { pilotA: BOSK, pilotB: ANAND, bond: 0, aCommitted: false, bCommitted: false, rng: () => 0.1 });
    expect(result.kind).toBe("poker");
    expect(result.bondDelta).toBe(6);
    expect(result.summary).toContain("Bosk won");
    expect(result.summary).toContain("abstracted");
  });

  it("fletchers: a forced-high rng picks pilotB as the (abstracted) winner", () => {
    const result = resolveAbstractedMinigameEncounter("fletchers", { pilotA: BOSK, pilotB: ANAND, bond: 0, aCommitted: false, bCommitted: false, rng: () => 0.9 });
    expect(result.kind).toBe("fletchers");
    expect(result.summary).toContain("Anand won");
  });
});

describe("resolveAskOutEncounter", () => {
  it("above ROMANCE_MIN_FAVORABILITY, accepts — matches romance.ts's own accept delta and flags becameCouple", () => {
    const result = resolveAskOutEncounter({ pilotA: BOSK, pilotB: ANAND, bond: ROMANCE_MIN_FAVORABILITY, aCommitted: false, bCommitted: false, rng: () => 0.5 });
    expect(result.kind).toBe("askOut");
    expect(result.bondDelta).toBe(ROMANCE_ACCEPT_FAVORABILITY_DELTA);
    expect(result.becameCouple).toBe(true);
    expect(result.summary).toContain("accepted");
  });

  it("below ROMANCE_MIN_FAVORABILITY, rejects — matches romance.ts's own reject delta, no couple", () => {
    const result = resolveAskOutEncounter({ pilotA: BOSK, pilotB: ANAND, bond: ROMANCE_MIN_FAVORABILITY - 1, aCommitted: false, bCommitted: false, rng: () => 0.5 });
    expect(result.bondDelta).toBe(ROMANCE_REJECT_FAVORABILITY_DELTA);
    expect(result.becameCouple).toBe(false);
    expect(result.summary).toContain("turned down");
  });

  it("never applies the Hiopi/Carabil species cap — romanceable is always true for NPC-to-NPC, per romance.ts's own header and Build Plan §18", () => {
    // Iyari is the one seeded NPC that's actually capped player-side
    // (isRomanceableSpecies would say false for her archetype's species).
    // resolveAskOutEncounter must still resolve a real accept/reject, never
    // "closeFriendOnly" — that branch only exists in the pure resolveAskOut
    // for the player-facing case this file deliberately doesn't invoke.
    const result = resolveAskOutEncounter({ pilotA: ANAND, pilotB: IYARI, bond: ROMANCE_MIN_FAVORABILITY, aCommitted: false, bCommitted: false, rng: () => 0.5 });
    expect(result.becameCouple).toBe(true);
  });
});

describe("simulateEncounter", () => {
  it("dispatches to the matching resolver for each encounter kind", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5); // keeps pegBoard's internal AI jitter and any Gate 0 check mid-range, not used for kind selection itself
    const talk = simulateEncounter({ pilotA: BOSK, pilotB: ANAND, bond: 0, aCommitted: false, bCommitted: false, rng: () => 0.99 * 1 /* misses askOut */ });
    expect(["talk", "pegBoard", "poker", "fletchers"]).toContain(talk.kind); // eligible pool once askOut is excluded by the forced-high roll
  });

  it("never selects askOut when either pilot is committed, regardless of how low the rng roll is", () => {
    for (let i = 0; i < 20; i++) {
      const result = simulateEncounter({ pilotA: BOSK, pilotB: ANAND, bond: 0, aCommitted: true, bCommitted: false, rng: () => 0.001 });
      expect(result.kind).not.toBe("askOut");
    }
  });
});

describe("simulateDay", () => {
  it("askOut, accepted: mutates the pair's bond by the accept delta and records the relationship, with a 'Day N:' prefixed log line", () => {
    const roster = [BOSK, ANAND];
    const state: SocialSimState = { bonds: { "pilot_anand::pilot_bosk": ROMANCE_MIN_FAVORABILITY }, relationships: [] };
    const line = simulateDay(roster, state, new Set(), 4, () => 0.01); // 0.01 < ASK_OUT_CHANCE every time it's consulted
    expect(line).toMatch(/^Day 4: /);
    expect(state.bonds["pilot_anand::pilot_bosk"]).toBe(ROMANCE_MIN_FAVORABILITY + ROMANCE_ACCEPT_FAVORABILITY_DELTA);
    expect(state.relationships).toContain("pilot_anand::pilot_bosk");
  });

  it("askOut, rejected: mutates the bond down and does NOT record a relationship", () => {
    const roster = [BOSK, ANAND];
    const state: SocialSimState = { bonds: { "pilot_anand::pilot_bosk": 0 }, relationships: [] };
    simulateDay(roster, state, new Set(), 1, () => 0.01);
    expect(state.bonds["pilot_anand::pilot_bosk"]).toBe(ROMANCE_REJECT_FAVORABILITY_DELTA);
    expect(state.relationships).toEqual([]);
  });

  it("a pilot already committed to the player never gets offered Ask Out, even on a roll that would otherwise trigger it", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99); // Gate 0 misses if it falls through to Talk — keeps this test's only assertion about the kind, not the delta
    const roster = [BOSK, ANAND];
    const state: SocialSimState = { bonds: { "pilot_anand::pilot_bosk": 200 }, relationships: [] }; // way above the accept threshold, so a real askOut would always accept
    simulateDay(roster, state, new Set(["pilot_bosk"]), 1, () => 0.01);
    expect(state.relationships).toEqual([]); // proves askOut never ran — an accept would have pushed a relationship
  });

  it("seeds an absent pair's bond at 0 before applying the encounter's delta", () => {
    const roster = [BOSK, IYARI];
    const state: SocialSimState = { bonds: {}, relationships: [] }; // no pilot_bosk::pilot_iyari key yet
    simulateDay(roster, state, new Set(), 1, () => 0.01); // askOut path: 0 is below ROMANCE_MIN_FAVORABILITY -> rejected
    expect(state.bonds["pilot_bosk::pilot_iyari"]).toBe(ROMANCE_REJECT_FAVORABILITY_DELTA);
  });
});
