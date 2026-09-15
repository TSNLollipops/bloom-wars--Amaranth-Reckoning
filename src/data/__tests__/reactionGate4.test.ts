// src/data/__tests__/reactionGate4.test.ts
// Gate 4, the audience gate — Bloom_Wars_Reaction_Formula_v2_Locked_14Sep2026.md.
//
// Unlike Gate 0 next door, nothing here is probabilistic: gate4Check is a
// straight read of the room, so every case below is an exact assertion rather
// than reactionGate.test.ts's "lands in the right neighbourhood over many
// trials" shape.
//
// What these cases are actually defending, since a test that only restates the
// implementation is worth nothing. Three real ways this gate goes wrong:
//
//   1. A row fires when the room does not warrant it, or fails to fire when it
//      does. The boundary cases (exactly two witnesses vs. three, a rival on
//      the list but not in the room) are the ones that matter — the middle of
//      each range is never where an audience gate breaks.
//   2. A row produces only half of what the table says it produces. The anger
//      row is specified as a ledger mark AND a Worry, and an earlier shape of
//      Gate4Result could only express one route at a time, which would have
//      dropped one half silently. Those assertions are load-bearing.
//   3. The 1.5x on held anger drifts away from a blowup's own weight. Pinned
//      directly against BLOWUP_BIRTH_WEIGHT rather than against the literal
//      0.75, so retuning a blowup either keeps the relationship or fails here.
import { describe, it, expect } from "vitest";
import { gate4Check, SADNESS_WITNESS_LIMIT, type SceneContext, type Gate4Result, type Gate4Suppression } from "../reactionGate4";
import { MEMORY_BIRTH_WEIGHT, BLOWUP_BIRTH_WEIGHT, SUPPRESSED_ANGER_MULTIPLIER } from "../memories";
import type { AmbientPilotState } from "../ambientLines";

// stage defaults to "blooded", same as ambientLines.test.ts's own helper.
// gate4Check reads none of these fields today, but the type requires them.
function pilot(overrides: Partial<AmbientPilotState> = {}): AmbientPilotState {
  return { catalyst: "raven", stage: "blooded", stress: 30, morale: 70, drunk: false, ...overrides };
}

function scene(overrides: Partial<SceneContext> = {}): SceneContext {
  return { nearbyPilotIds: [], bondedPilotIds: [], rivalPilotIds: [], authorityPilotIds: [], ...overrides };
}

// Asserts the verdict is a suppression and hands back the narrowed half, so
// each case reads its outputs without repeating the discriminant check. The
// throw is the assertion: vitest reports it with the test name.
function suppressed(result: Gate4Result): Gate4Suppression {
  if (result.allowed) throw new Error("expected a suppression, got allowed");
  return result;
}

describe("gate4Check — the empty room allows everything", () => {
  it("allows every echo when nobody else is present", () => {
    for (const echo of ["love", "fear", "anger", "sadness"] as const) {
      expect(gate4Check(pilot(), echo, scene()).allowed).toBe(true);
    }
  });

  it("allows every echo in a crowded room with no authority, no rivals, no target", () => {
    const crowded = scene({ nearbyPilotIds: ["a", "b", "c", "d"] });
    for (const echo of ["love", "fear", "anger"] as const) {
      expect(gate4Check(pilot(), echo, crowded).allowed).toBe(true);
    }
  });
});

describe("gate4Check — anger, authority in the room", () => {
  const angry = scene({ targetPilotId: "bosk", authorityPilotIds: ["player"], nearbyPilotIds: ["bosk", "player"] });

  it("suppresses anger when authority is present and the anger has a target", () => {
    const result = suppressed(gate4Check(pilot(), "anger", angry));
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("anger_authority_present");
  });

  it("produces BOTH a ledger mark and a Worry, not one or the other", () => {
    const result = suppressed(gate4Check(pilot(), "anger", angry));
    expect(result.memoryKind).toBe("suppressed_anger_impulse");
    expect(result.worry).toEqual({ source: "hub_suppressed_anger", about: "bosk" });
  });

  it("opens the Worry about the target of the anger, not about the authority figure", () => {
    const result = suppressed(gate4Check(pilot(), "anger", angry));
    expect(result.worry?.about).toBe("bosk");
    expect(result.worry?.about).not.toBe("player");
  });

  it("allows anger when no authority is present, however crowded the room", () => {
    const noBrass = scene({ targetPilotId: "bosk", nearbyPilotIds: ["bosk", "anand", "lask", "munti"] });
    expect(gate4Check(pilot(), "anger", noBrass).allowed).toBe(true);
  });

  it("allows undirected anger even with authority present — there is nobody to swallow it at", () => {
    const noTarget = scene({ authorityPilotIds: ["player"], nearbyPilotIds: ["player"] });
    expect(gate4Check(pilot(), "anger", noTarget).allowed).toBe(true);
  });

  it("does not defer — held anger is recorded now, not replayed later", () => {
    const result = suppressed(gate4Check(pilot(), "anger", angry));
    expect(result.deferred).toBeUndefined();
  });
});

describe("gate4Check — sadness, more than two witnesses", () => {
  it("allows sadness at exactly the witness limit", () => {
    const atLimit = scene({ nearbyPilotIds: ["a", "b"] });
    expect(atLimit.nearbyPilotIds.length).toBe(SADNESS_WITNESS_LIMIT);
    expect(gate4Check(pilot(), "sadness", atLimit).allowed).toBe(true);
  });

  it("defers sadness one witness past the limit", () => {
    const overLimit = scene({ nearbyPilotIds: ["a", "b", "c"] });
    const result = suppressed(gate4Check(pilot(), "sadness", overLimit));
    expect(result.reason).toBe("sadness_too_many_witnesses");
    expect(result.deferred).toBe(true);
  });

  it("writes no ledger mark — the deferred breakdown writes its own when it fires", () => {
    const result = suppressed(gate4Check(pilot(), "sadness", scene({ nearbyPilotIds: ["a", "b", "c"] })));
    expect(result.memoryKind).toBeUndefined();
    expect(result.worry).toBeUndefined();
  });

  it("does not care about authority — a breakdown is about the audience, not the rank", () => {
    const brassOnly = scene({ nearbyPilotIds: ["player"], authorityPilotIds: ["player"] });
    expect(gate4Check(pilot(), "sadness", brassOnly).allowed).toBe(true);
  });
});

describe("gate4Check — love, rival in the room", () => {
  it("suppresses love when a rival is actually standing there", () => {
    const rivalPresent = scene({ targetPilotId: "anand", rivalPilotIds: ["lask"], nearbyPilotIds: ["anand", "lask"] });
    const result = suppressed(gate4Check(pilot(), "love", rivalPresent));
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("askout_rival_present");
    expect(result.memoryKind).toBe("suppressed_askout_rival");
  });

  it("opens the Worry about the RIVAL, not about the person they wanted to ask", () => {
    const rivalPresent = scene({ targetPilotId: "anand", rivalPilotIds: ["lask"], nearbyPilotIds: ["anand", "lask"] });
    const result = suppressed(gate4Check(pilot(), "love", rivalPresent));
    expect(result.worry).toEqual({ source: "hub_suppressed_askout", about: "lask" });
  });

  it("allows love when the rival exists but is somewhere else on the ship", () => {
    // The real bug this defends: rivalPilotIds is the pilot's whole rival
    // list, which is a different question from "is one of them in this room."
    const rivalAway = scene({ targetPilotId: "anand", rivalPilotIds: ["lask"], nearbyPilotIds: ["anand"] });
    expect(gate4Check(pilot(), "love", rivalAway).allowed).toBe(true);
  });

  it("allows love with no target — there is no ask-out to block", () => {
    const noTarget = scene({ rivalPilotIds: ["lask"], nearbyPilotIds: ["lask"] });
    expect(gate4Check(pilot(), "love", noTarget).allowed).toBe(true);
  });

  it("picks the rival who is present when several rivals exist", () => {
    const manyRivals = scene({ targetPilotId: "anand", rivalPilotIds: ["lask", "bosk"], nearbyPilotIds: ["anand", "bosk"] });
    const result = suppressed(gate4Check(pilot(), "love", manyRivals));
    expect(result.worry?.about).toBe("bosk");
  });
});

describe("gate4Check — fear has no row in the table", () => {
  it("never suppresses fear, whatever the room looks like", () => {
    const worstCase = scene({
      targetPilotId: "bosk",
      nearbyPilotIds: ["a", "b", "c", "bosk", "player"],
      rivalPilotIds: ["bosk"],
      authorityPilotIds: ["player"],
    });
    expect(gate4Check(pilot(), "fear", worstCase).allowed).toBe(true);
  });
});

describe("the union's own invariants, checked at runtime as well", () => {
  // The discriminated union already guarantees at the type level that a
  // suppression carries a reason. These cases check the RUNTIME side of the
  // same contract: that each row actually returns the suppressed member (not
  // an allowed one by mistake), and that an allowed result carries no stray
  // payload. The type cannot see either of those.
  const suppressing: [string, Parameters<typeof gate4Check>[1], SceneContext][] = [
    ["anger", "anger", scene({ targetPilotId: "bosk", authorityPilotIds: ["player"], nearbyPilotIds: ["bosk", "player"] })],
    ["sadness", "sadness", scene({ nearbyPilotIds: ["a", "b", "c"] })],
    ["love", "love", scene({ targetPilotId: "anand", rivalPilotIds: ["lask"], nearbyPilotIds: ["anand", "lask"] })],
  ];

  it.each(suppressing)("every suppressing row sets a reason (%s)", (_label, echo, ctx) => {
    const result = suppressed(gate4Check(pilot(), echo, ctx));
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it.each(suppressing)("every suppressing row produces at least one output (%s)", (_label, echo, ctx) => {
    const result = suppressed(gate4Check(pilot(), echo, ctx));
    const produced = [result.memoryKind, result.worry, result.deferred].filter((v) => v !== undefined);
    expect(produced.length).toBeGreaterThan(0);
  });

  it("an allowed result is exactly { allowed: true } and carries nothing else", () => {
    // Under the union an allowed result has no reason/memoryKind/worry/deferred
    // fields at the type level, so this checks the runtime object too: no
    // stray payload riding along on a pass.
    expect(gate4Check(pilot(), "fear", scene())).toEqual({ allowed: true });
  });
});

describe("Gate 4 weights stay tied to the reactions they mirror", () => {
  it("held anger is exactly the multiplier times a blowup's own weight", () => {
    expect(MEMORY_BIRTH_WEIGHT.suppressed_anger_impulse).toBeCloseTo(BLOWUP_BIRTH_WEIGHT * SUPPRESSED_ANGER_MULTIPLIER);
  });

  it("held anger outweighs a breakdown — the thing you swallowed sits heavier than the thing you let out", () => {
    expect(MEMORY_BIRTH_WEIGHT.suppressed_anger_impulse).toBeGreaterThan(MEMORY_BIRTH_WEIGHT.breakdown);
  });

  it("a held confession sits just under a real one", () => {
    expect(MEMORY_BIRTH_WEIGHT.suppressed_askout_rival).toBeLessThan(MEMORY_BIRTH_WEIGHT.asked_out);
  });

  it("every Gate 4 kind stays inside the 0..1 salience range", () => {
    for (const kind of ["suppressed_anger_impulse", "suppressed_askout_rival"] as const) {
      expect(MEMORY_BIRTH_WEIGHT[kind]).toBeGreaterThan(0);
      expect(MEMORY_BIRTH_WEIGHT[kind]).toBeLessThanOrEqual(1);
    }
  });
});
