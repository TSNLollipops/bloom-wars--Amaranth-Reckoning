// engine/socialVerbResolution.ts — the seven social verbs' mechanics,
// extracted out of scenes/Hub.ts 12 Sep 2026 (Mission Chat plan, Workstream
// 4 §5c) so Battle can share them. These tests pin the extracted behaviour
// to what Hub.ts's own private methods did before the move, constant for
// constant, so the refactor is checkable rather than trusted — and they
// cover the one rule that's new (diminishing returns on repeats).
import { describe, it, expect } from "vitest";
import { createWardenCampaignState, ensureHubSocialState } from "../campaignState";
import { resolveSocialVerb, repeatScale, isSocialVerb, SOCIAL_VERBS, type SocialVerbSubject } from "../socialVerbResolution";
import {
  GIFT_FAVORABILITY_DELTA,
  PRAISE_FAVORABILITY_DELTA,
  FLIRT_FAVORABILITY_DELTA,
  INSULT_FAVORABILITY_DELTA,
  APOLOGY_FAVORABILITY_DELTA,
  INSULT_TIER2_COUNT,
  INSULT_TIER2_STRESS_BUMP,
  INSULT_TIER3_COUNT,
  INSULT_TIER3_FAVORABILITY_CEILING,
  CONGRATULATE_FAVORABILITY_DELTA,
  CONGRATULATE_MORALE_DELTA,
  SEND_OFF_FAVORABILITY_DELTA,
  SEND_OFF_STRESS_DELTA,
  GIFT_LINES,
  PRAISE_LINES,
  INSULT_LINES,
  APOLOGY_LINES,
  CONGRATULATE_LINES,
  SEND_OFF_LINES,
} from "../../data/socialActions";
import { CLOSE_FRIEND_ONLY_LINES } from "../../data/romance";
import type { HotTopic } from "../../data/hotTopics";

const SEED = { favorability: 0, stress: 10, morale: 70 };
const bosk: SocialVerbSubject = { pilotId: "pilot_bosk", displayName: "Sgt. Aldo Bosk — “Deadfall”", catalyst: "wolf", romanceable: true, seed: SEED };
const hiopi: SocialVerbSubject = { ...bosk, pilotId: "pilot_iyari", displayName: "Pvt. Tegan Iyari — “Foxfire”", catalyst: "fox", romanceable: false };
const ctx = (hotTopics: HotTopic[] = [], repeatIndex = 0) => ({ hotTopics, now: 1_000, repeatIndex, rng: () => 0 });

describe("resolveSocialVerb — parity with the Hub's own pre-extraction handlers", () => {
  it("Gift: +GIFT_FAVORABILITY_DELTA, the catalyst's gift line, one log entry", () => {
    const s = createWardenCampaignState(0);
    const r = resolveSocialVerb(s, bosk, "gift", ctx());
    expect(r.applied).toBe(true);
    expect(r.logged).toBe(true);
    expect(r.favorability).toBe(SEED.favorability + GIFT_FAVORABILITY_DELTA);
    expect(r.line).toBe(GIFT_LINES.wolf);
    const social = ensureHubSocialState(s, "pilot_bosk", SEED);
    expect(social.favorability).toBe(r.favorability);
    expect(social.socialLog).toEqual([{ verb: "gift", line: GIFT_LINES.wolf, at: 1_000 }]);
  });

  it("Praise: +PRAISE_FAVORABILITY_DELTA, the catalyst's praise line", () => {
    const s = createWardenCampaignState(0);
    const r = resolveSocialVerb(s, bosk, "praise", ctx());
    expect(r.favorability).toBe(PRAISE_FAVORABILITY_DELTA);
    expect(r.line).toBe(PRAISE_LINES.wolf);
  });

  it("Flirt on a romanceable pilot: +FLIRT_FAVORABILITY_DELTA, a flirt line", () => {
    const s = createWardenCampaignState(0);
    const r = resolveSocialVerb(s, bosk, "flirt", ctx());
    expect(r.applied).toBe(true);
    expect(r.favorability).toBe(FLIRT_FAVORABILITY_DELTA);
  });

  it("Flirt on a close-friend-only species: the Ask Out redirect line, nothing moves, but it IS logged (Hub.ts always logged that one)", () => {
    const s = createWardenCampaignState(0);
    const r = resolveSocialVerb(s, hiopi, "flirt", ctx());
    expect(r.applied).toBe(false);
    expect(r.logged).toBe(true);
    expect(r.favorability).toBe(SEED.favorability);
    expect(CLOSE_FRIEND_ONLY_LINES).toContain(r.line);
    expect(ensureHubSocialState(s, "pilot_iyari", SEED).socialLog).toHaveLength(1);
  });

  it("Apology: the catalyst's own forgiveness delta and line, and it never touches insultsGiven or refusesDeployment", () => {
    const s = createWardenCampaignState(0);
    const social = ensureHubSocialState(s, "pilot_bosk", SEED);
    social.insultsGiven = 5;
    social.refusesDeployment = true;
    const r = resolveSocialVerb(s, bosk, "apology", ctx());
    expect(r.favorability).toBe(APOLOGY_FAVORABILITY_DELTA.wolf);
    expect(r.line).toBe(APOLOGY_LINES.wolf);
    expect(social.insultsGiven).toBe(5);
    expect(social.refusesDeployment).toBe(true);
  });

  it("Congratulate with no live 'promoted' topic about this pilot: 'Congrats for what?', nothing moves, nothing logged", () => {
    const s = createWardenCampaignState(0);
    const other: HotTopic = { kind: "promoted", aboutPilotId: "pilot_anand", aboutName: "Anand", at: 1, mentionedBy: [] };
    const r = resolveSocialVerb(s, bosk, "congratulate", ctx([other]));
    expect(r.applied).toBe(false);
    expect(r.logged).toBe(false);
    expect(r.line).toBe("Congrats for what?");
    expect(r.favorability).toBe(SEED.favorability);
    expect(ensureHubSocialState(s, "pilot_bosk", SEED).socialLog).toHaveLength(0);
  });

  it("Congratulate with a live topic: favor and morale move, morale clamped to 100", () => {
    const s = createWardenCampaignState(0);
    const social = ensureHubSocialState(s, "pilot_bosk", SEED);
    social.morale = 98;
    const topic: HotTopic = { kind: "promoted", aboutPilotId: "pilot_bosk", aboutName: "Bosk", at: 1, mentionedBy: [] };
    const r = resolveSocialVerb(s, bosk, "congratulate", ctx([topic]));
    expect(r.applied).toBe(true);
    expect(r.favorability).toBe(CONGRATULATE_FAVORABILITY_DELTA);
    expect(r.morale).toBe(100);
    expect(CONGRATULATE_MORALE_DELTA).toBeGreaterThan(2); // the clamp above is only meaningful if the delta would overshoot
    expect(r.line).toBe(CONGRATULATE_LINES.wolf);
  });

  it("Send-Off: favor up, stress relieved (floored at 0), and the sendOff flag for the caller to write preMissionSendOff", () => {
    const s = createWardenCampaignState(0);
    const social = ensureHubSocialState(s, "pilot_bosk", SEED);
    social.stress = 2;
    const r = resolveSocialVerb(s, bosk, "sendOff", ctx());
    expect(r.favorability).toBe(SEND_OFF_FAVORABILITY_DELTA);
    expect(r.stress).toBe(0);
    expect(SEND_OFF_STRESS_DELTA).toBeLessThan(-2);
    expect(r.sendOff).toBe(true);
    expect(r.line).toBe(SEND_OFF_LINES.wolf);
  });
});

describe("resolveSocialVerb — the Insult ladder", () => {
  it("Tier 1: the catalyst's own negative delta, no topic, no refusal", () => {
    const s = createWardenCampaignState(0);
    const r = resolveSocialVerb(s, bosk, "insult", ctx());
    expect(r.favorability).toBe(INSULT_FAVORABILITY_DELTA.wolf);
    expect(r.line).toBe(INSULT_LINES.wolf);
    expect(r.hotTopic).toBeUndefined();
    expect(r.refusesDeploymentSet).toBe(false);
    expect(ensureHubSocialState(s, "pilot_bosk", SEED).insultsGiven).toBe(1);
  });

  it("Tier 2 (exactly INSULT_TIER2_COUNT lifetime insults): returns the 'insulted' topic for the caller and bumps stress — once, on that insult only", () => {
    const s = createWardenCampaignState(0);
    let r = resolveSocialVerb(s, bosk, "insult", ctx());
    for (let i = 1; i < INSULT_TIER2_COUNT; i++) r = resolveSocialVerb(s, bosk, "insult", ctx());
    expect(r.hotTopic).toEqual({ kind: "insulted", aboutPilotId: "pilot_bosk", aboutName: "Sgt. Aldo Bosk", at: 1_000, mentionedBy: [] });
    expect(r.stress).toBe(SEED.stress + INSULT_TIER2_STRESS_BUMP);
    const next = resolveSocialVerb(s, bosk, "insult", ctx());
    expect(next.hotTopic).toBeUndefined();
    expect(next.stress).toBe(SEED.stress + INSULT_TIER2_STRESS_BUMP);
  });

  it("Tier 3 (INSULT_TIER3_COUNT with favor at or under the ceiling): sets refusesDeployment exactly once and never clears it", () => {
    const s = createWardenCampaignState(0);
    let r = resolveSocialVerb(s, bosk, "insult", ctx());
    for (let i = 1; i < INSULT_TIER3_COUNT; i++) r = resolveSocialVerb(s, bosk, "insult", ctx());
    expect(r.favorability).toBeLessThanOrEqual(INSULT_TIER3_FAVORABILITY_CEILING);
    expect(r.refusesDeploymentSet).toBe(true);
    expect(ensureHubSocialState(s, "pilot_bosk", SEED).refusesDeployment).toBe(true);
    const again = resolveSocialVerb(s, bosk, "insult", ctx());
    expect(again.refusesDeploymentSet).toBe(false); // already set — not "set by this call"
    expect(ensureHubSocialState(s, "pilot_bosk", SEED).refusesDeployment).toBe(true);
  });

  it("Tier 3 does not fire when favor has been apologized back above the ceiling (a pilot who's been won back isn't blindsided)", () => {
    const s = createWardenCampaignState(0);
    const social = ensureHubSocialState(s, "pilot_bosk", SEED);
    for (let i = 0; i < INSULT_TIER3_COUNT - 1; i++) resolveSocialVerb(s, bosk, "insult", ctx());
    social.favorability = INSULT_TIER3_FAVORABILITY_CEILING + 50;
    const r = resolveSocialVerb(s, bosk, "insult", ctx());
    expect(r.refusesDeploymentSet).toBe(false);
    expect(social.refusesDeployment).toBeFalsy();
  });
});

describe("resolveSocialVerb — diminishing returns on repeats (mission chat only)", () => {
  it("repeatScale halves each repeat and floors at zero past the fourth", () => {
    expect([0, 1, 2, 3, 4, 9].map(repeatScale)).toEqual([1, 0.5, 0.25, 0.125, 0, 0]);
  });

  it("scaled deltas round toward zero, and a zero scale moves nothing while the line still plays", () => {
    const s = createWardenCampaignState(0);
    const first = resolveSocialVerb(s, bosk, "praise", ctx([], 0));
    expect(first.favorability).toBe(PRAISE_FAVORABILITY_DELTA); // 4
    const second = resolveSocialVerb(s, bosk, "praise", ctx([], 1));
    expect(second.favorability).toBe(PRAISE_FAVORABILITY_DELTA + Math.trunc(PRAISE_FAVORABILITY_DELTA / 2)); // +2
    const third = resolveSocialVerb(s, bosk, "praise", ctx([], 2));
    expect(third.favorability).toBe(second.favorability + 1); // trunc(4 * 0.25) = 1
    const fifth = resolveSocialVerb(s, bosk, "praise", ctx([], 4));
    expect(fifth.favorability).toBe(third.favorability);
    expect(fifth.line).toBe(PRAISE_LINES.wolf);
    expect(fifth.applied).toBe(true);
    expect(fifth.scale).toBe(0);
  });

  it("the Insult ladder still counts every repeat at full weight — scaling limits the standing lost, not the strikes", () => {
    const s = createWardenCampaignState(0);
    for (let i = 0; i < INSULT_TIER2_COUNT; i++) resolveSocialVerb(s, bosk, "insult", ctx([], i));
    expect(ensureHubSocialState(s, "pilot_bosk", SEED).insultsGiven).toBe(INSULT_TIER2_COUNT);
  });
});

describe("isSocialVerb", () => {
  it("accepts exactly the seven social verbs and nothing else", () => {
    for (const v of SOCIAL_VERBS) expect(isSocialVerb(v)).toBe(true);
    expect(isSocialVerb("shareADrink")).toBe(false);
    expect(isSocialVerb("askOut")).toBe(false);
    expect(isSocialVerb(null)).toBe(false);
    expect(isSocialVerb(undefined)).toBe(false);
  });
});
