// src/engine/__tests__/pillars.test.ts
// Reaction Engine Slice 1, 17 Sep 2026 — the three pillars resolved against
// a real campaign state (engine/pillars.ts) on top of the pure tables
// (data/pillars.ts). Warden roster throughout, same cast every other engine
// test uses.
import { describe, it, expect } from "vitest";
import { createWardenCampaignState, ensureNpcSocialState, lanceOfPilotIn } from "../campaignState";
import { pairKey, CLIQUE_THRESHOLD } from "../../data/npcBonds";
import { matterRungFor, reactionWeight, volumeRingFor } from "../pillars";
import {
  MATTER_RUNG_WEIGHT,
  PILLAR_FLOOR,
  TIME_LIVE,
  VOLUME_RING_WEIGHT,
  pillarWeight,
  timeWeightForAge,
} from "../../data/pillars";
import { MEMORY_DECAY_PER_DAY } from "../../data/memories";

function state() {
  return createWardenCampaignState();
}

describe("VOLUME_RING_WEIGHT", () => {
  it("is a strictly descending ladder from self out to the world", () => {
    const order = ["self", "bonded", "lance", "company", "stranger", "world"] as const;
    for (let i = 1; i < order.length; i++) {
      expect(VOLUME_RING_WEIGHT[order[i]]).toBeLessThan(VOLUME_RING_WEIGHT[order[i - 1]]);
    }
    expect(VOLUME_RING_WEIGHT.self).toBe(1);
  });
});

describe("MATTER_RUNG_WEIGHT", () => {
  it("runs 0 to 1 over five rungs, ascending", () => {
    expect(MATTER_RUNG_WEIGHT).toHaveLength(5);
    expect(MATTER_RUNG_WEIGHT[0]).toBe(0);
    expect(MATTER_RUNG_WEIGHT[4]).toBe(1);
    for (let i = 1; i < MATTER_RUNG_WEIGHT.length; i++) {
      expect(MATTER_RUNG_WEIGHT[i]).toBeGreaterThan(MATTER_RUNG_WEIGHT[i - 1]);
    }
  });
});

describe("timeWeightForAge", () => {
  it("is 1 today and decays on the same curve memory salience does", () => {
    expect(timeWeightForAge(0)).toBe(1);
    expect(timeWeightForAge(10)).toBeCloseTo(Math.pow(MEMORY_DECAY_PER_DAY, 10), 10);
  });

  it("floors rather than reaching zero — a registered event is never worth nothing", () => {
    expect(timeWeightForAge(10_000)).toBe(PILLAR_FLOOR);
  });

  it("treats a negative age as today", () => {
    expect(timeWeightForAge(-3)).toBe(1);
  });
});

describe("pillarWeight", () => {
  it("is 1 when all three pillars are full", () => {
    expect(pillarWeight({ time: 1, volume: 1, matter: 1 })).toBe(1);
  });

  it("never drops below the floor", () => {
    expect(pillarWeight({ time: 0, volume: 0, matter: 0 })).toBe(PILLAR_FLOOR);
  });

  it("keeps the product's ordering under the mean it actually ships with", () => {
    const near = pillarWeight({ time: 1, volume: VOLUME_RING_WEIGHT.bonded, matter: 0.85 });
    const far = pillarWeight({ time: 1, volume: VOLUME_RING_WEIGHT.stranger, matter: 0.85 });
    expect(near).toBeGreaterThan(far);
  });
});

describe("volumeRingFor", () => {
  it("puts a pilot's own event on the self ring", () => {
    expect(volumeRingFor(state(), "pilot_rourke", "pilot_rourke")).toBe("self");
  });

  it("calls an event with nobody in it the world ring", () => {
    expect(volumeRingFor(state(), "pilot_rourke", undefined)).toBe("world");
  });

  it("promotes a real bond to the bonded ring at the same threshold the Hub calls a clique", () => {
    const s = state();
    const social = ensureNpcSocialState(s);
    social.bonds[pairKey("pilot_rourke", "pilot_bosk")] = CLIQUE_THRESHOLD;
    expect(volumeRingFor(s, "pilot_rourke", "pilot_bosk")).toBe("bonded");
    social.bonds[pairKey("pilot_rourke", "pilot_bosk")] = CLIQUE_THRESHOLD - 1;
    expect(volumeRingFor(s, "pilot_rourke", "pilot_bosk")).not.toBe("bonded");
  });

  it("falls back to lance for a squadmate with no particular closeness", () => {
    const s = state();
    ensureNpcSocialState(s).bonds[pairKey("pilot_rourke", "pilot_bosk")] = 0;
    const same = lanceOfPilotIn(s, "pilot_rourke") === lanceOfPilotIn(s, "pilot_bosk");
    expect(volumeRingFor(s, "pilot_rourke", "pilot_bosk")).toBe(same ? "lance" : "company");
  });

  it("calls a name that is not on the roster a stranger", () => {
    expect(volumeRingFor(state(), "pilot_rourke", "pilot_nobody_at_all")).toBe("stranger");
  });
});

describe("matterRungFor", () => {
  it("gives a pilot who was on the board the acting rung", () => {
    const s = state();
    expect(matterRungFor(s, "pilot_bosk", true)).toBe(3);
  });

  it("drops a pilot who only heard about it a rung", () => {
    const s = state();
    expect(matterRungFor(s, "pilot_bosk", false)).toBe(2);
  });

  it("gives a plot-armoured pilot the top rung — it was theirs to decide", () => {
    // Bosk, not Rourke: the MC already ships exempt, so asserting on him
    // would pass even if this code ignored the flag entirely.
    const s = state();
    expect(matterRungFor(s, "pilot_bosk", true)).toBe(3);
    s.pilots["pilot_bosk"].pilot.exemptFromPermadeath = true;
    expect(matterRungFor(s, "pilot_bosk", true)).toBe(4);
  });

  it("gives the MC the top rung, because he ships plot-armoured", () => {
    expect(matterRungFor(state(), "pilot_rourke", true)).toBe(4);
  });

  it("puts a permanently lost pilot at rung 0 — no say in it at all", () => {
    const s = state();
    s.pilots["pilot_bosk"].status = "permanently_lost";
    expect(matterRungFor(s, "pilot_bosk", true)).toBe(0);
  });

  it("puts an off-roster but living pilot at rung 1 — they could have acted, and did not get to", () => {
    const s = state();
    s.pilots["pilot_bosk"].status = "reassigned";
    expect(matterRungFor(s, "pilot_bosk", true)).toBe(1);
  });

  it("puts an unknown pilot at rung 0 rather than throwing", () => {
    expect(matterRungFor(state(), "pilot_nobody_at_all", true)).toBe(0);
  });
});

describe("reactionWeight", () => {
  it("reports the ring and rung it used alongside the multiplier", () => {
    const w = reactionWeight(state(), { pilotId: "pilot_bosk", aboutId: "pilot_bosk", inTheFight: true });
    expect(w.ring).toBe("self");
    expect(w.rung).toBe(3);
    expect(w.time).toBe(TIME_LIVE);
    expect(w.volume).toBe(VOLUME_RING_WEIGHT.self);
    expect(w.matter).toBe(MATTER_RUNG_WEIGHT[3]);
    expect(w.weight).toBeCloseTo(pillarWeight(w), 10);
  });

  it("weighs a bonded squadmate's loss above a stranger's", () => {
    const s = state();
    ensureNpcSocialState(s).bonds[pairKey("pilot_rourke", "pilot_bosk")] = CLIQUE_THRESHOLD;
    const bonded = reactionWeight(s, { pilotId: "pilot_rourke", aboutId: "pilot_bosk", inTheFight: true }).weight;
    const stranger = reactionWeight(s, { pilotId: "pilot_rourke", aboutId: "pilot_nobody_at_all", inTheFight: true }).weight;
    expect(bonded).toBeGreaterThan(stranger);
  });

  it("weighs a live event above a remembered one", () => {
    const s = state();
    const now = reactionWeight(s, { pilotId: "pilot_rourke", aboutId: "pilot_bosk", inTheFight: true }).weight;
    const old = reactionWeight(s, { pilotId: "pilot_rourke", aboutId: "pilot_bosk", inTheFight: true, daysAgo: 30 }).weight;
    expect(now).toBeGreaterThan(old);
  });

  it("weighs being in the fight above hearing about it", () => {
    const s = state();
    const inIt = reactionWeight(s, { pilotId: "pilot_rourke", aboutId: "pilot_bosk", inTheFight: true }).weight;
    const heard = reactionWeight(s, { pilotId: "pilot_rourke", aboutId: "pilot_bosk", inTheFight: false }).weight;
    expect(inIt).toBeGreaterThan(heard);
  });

  it("never returns a weight outside the floor and 1", () => {
    const s = state();
    s.pilots["pilot_bosk"].status = "permanently_lost";
    for (const days of [0, 1, 400]) {
      for (const about of [undefined, "pilot_bosk", "pilot_nobody_at_all"]) {
        const w = reactionWeight(s, { pilotId: "pilot_bosk", aboutId: about, inTheFight: false, daysAgo: days }).weight;
        expect(w).toBeGreaterThanOrEqual(PILLAR_FLOOR);
        expect(w).toBeLessThanOrEqual(1);
      }
    }
  });
});
