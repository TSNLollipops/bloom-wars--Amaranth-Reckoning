// "Defensive focus fire — protect the VIP" (31 Aug 2026, Player AI
// hardening pass — see combat.ts's own header on enemiesThreateningVips/
// VIP_THREAT_PRIORITY_DISCOUNT for the full design). Maxime, after three
// straight Guard Taunt attempts each broke a different set of missions:
// "the playerai suck a lot still." This covers the new lever directly:
// enemiesThreateningVips' own reach math, targetPriorityScore/weakestTarget
// actually preferring a VIP-threatening target over a nominally "weaker"
// one, and the full focusFireTargetInRange integration composing the VIP
// discount with the existing boss-priority discount. Real Mission
// instances throughout, same discipline objectiveAwareness.test.ts already
// established for this directory — hostiles repositioned/re-stated
// directly on the live BattleUnit objects rather than hand-built stubs.
import { describe, it, expect } from "vitest";
import { Mission } from "../../../engine/mission";
import { AMARANTH_MISSION_2 } from "../../../data/campaignAmaranth";
import { enemiesThreateningVips, weakestTarget, focusFireTargetInRange, needsFrontLineProtection, visibleGangCount, GANG_UP_THRESHOLD } from "../combat";

/**
 * AMARANTH_MISSION_2 spawns a full multi-archetype hostile roster, not just
 * two — every test in this file that reasons about a specific COUNT of
 * threats (not just membership) needs the rest downed out of the way, same
 * "isolate from combat" discipline objectiveAwareness.test.ts already uses
 * for its own hold_zone/extract_unit fixtures. `near`/`far` stay alive and
 * are the only two hostiles callers should reposition/re-stat.
 */
function freshMission() {
  const mission = new Mission(AMARANTH_MISSION_2);
  const rourke = mission.units.find((u) => u.pilotId === "pilot_rourke")!;
  const lask = mission.units.find((u) => u.pilotId === "pilot_lask")!;
  const hostiles = mission.units.filter((u) => u.side === "hostile");
  expect(hostiles.length).toBeGreaterThanOrEqual(2);
  const [near, far] = hostiles;
  for (const h of hostiles) if (h !== near && h !== far) h.downed = true;
  return { mission, rourke, lask, near, far, hostiles: hostiles.filter((h) => !h.downed) };
}

describe("needsFrontLineProtection — sanity check the fixture matches the real flag", () => {
  it("Rourke is protected, an ordinary pilot is not", () => {
    const { mission, rourke } = freshMission();
    const bosk = mission.units.find((u) => u.pilotId === "pilot_bosk")!;
    expect(needsFrontLineProtection(rourke)).toBe(true);
    expect(needsFrontLineProtection(bosk)).toBe(false);
  });
});

describe("enemiesThreateningVips", () => {
  it("includes a hostile that can reach and attack the commander next turn, excludes one that can't", () => {
    const { mission, rourke, near, far, hostiles } = freshMission();
    rourke.pos = { x: 10, y: 10 };
    near.pos = { x: 11, y: 10 }; // adjacent — well within any reasonable moveRange+attackRange
    near.moveRange = 4;
    near.attackRange = [1, 1];
    far.pos = { x: 0, y: 0 }; // far corner of the map, nowhere near her
    far.moveRange = 3;
    far.attackRange = [1, 1];

    const threatening = enemiesThreateningVips(mission.units, hostiles);
    expect(threatening.has(near.instanceId)).toBe(true);
    expect(threatening.has(far.instanceId)).toBe(false);
  });

  it("a downed protected ally is never a reason to flag anything as threatening", () => {
    const { mission, rourke, near, hostiles } = freshMission();
    rourke.pos = { x: 10, y: 10 };
    rourke.downed = true;
    near.pos = { x: 11, y: 10 };
    near.moveRange = 4;
    near.attackRange = [1, 1];

    const threatening = enemiesThreateningVips(mission.units, hostiles);
    expect(threatening.has(near.instanceId)).toBe(false);
  });

  it("protects the Munti too, not just the commander", () => {
    const { mission, lask, near, hostiles } = freshMission();
    expect(needsFrontLineProtection(lask)).toBe(true);
    lask.pos = { x: 5, y: 5 };
    near.pos = { x: 5, y: 6 };
    near.moveRange = 4;
    near.attackRange = [1, 1];

    const threatening = enemiesThreateningVips(mission.units, hostiles);
    expect(threatening.has(near.instanceId)).toBe(true);
  });
});

describe("weakestTarget — vipThreatIds composes correctly with the existing score", () => {
  it("a target actively threatening the commander is preferred over an equal-stat target that isn't", () => {
    const { near, far } = freshMission();
    near.currentHp = 100;
    near.effectiveDefense = 1;
    far.currentHp = 100;
    far.effectiveDefense = 1;
    const vipThreatIds = new Set([near.instanceId]);

    const picked = weakestTarget([near, far], [], false, vipThreatIds);
    expect(picked.instanceId).toBe(near.instanceId);
  });

  it("does not override a genuinely much easier kill sitting right next to it — a moderate discount, not an always-first override", () => {
    const { near, far } = freshMission();
    near.currentHp = 100; // threatening the VIP, but nearly full HP
    near.effectiveDefense = 1;
    far.currentHp = 1; // one-shot away from dead, not threatening anyone
    far.effectiveDefense = 1;
    const vipThreatIds = new Set([near.instanceId]);

    const picked = weakestTarget([near, far], [], false, vipThreatIds);
    expect(picked.instanceId).toBe(far.instanceId);
  });

  it("omitted vipThreatIds behaves exactly as before — no regression to the unweighted call shape", () => {
    const { near, far } = freshMission();
    near.currentHp = 50;
    near.effectiveDefense = 1;
    far.currentHp = 100;
    far.effectiveDefense = 1;
    expect(weakestTarget([near, far]).instanceId).toBe(near.instanceId);
  });
});

describe("visibleGangCount — gang-up retreat (31 Aug 2026)", () => {
  it("counts only enemies that are both visible and within reach, not just visible or just in range", () => {
    const { mission, rourke, near, far, hostiles } = freshMission();
    rourke.pos = { x: 10, y: 10 };
    near.pos = { x: 11, y: 10 }; // adjacent — visible and in reach
    near.moveRange = 4;
    near.attackRange = [1, 1];
    far.pos = { x: 0, y: 0 }; // nowhere near reach, regardless of visibility
    far.moveRange = 1;
    far.attackRange = [1, 1];

    expect(visibleGangCount(rourke, hostiles, mission.turn)).toBe(1);
  });

  it("GANG_UP_THRESHOLD is 2 — a single attacker is an ordinary fight, not a pile-on", () => {
    expect(GANG_UP_THRESHOLD).toBe(2);
  });
});

// NOTE: gang-up retreat's own index.ts wiring was tried, measured, and
// reverted (see combat.ts's own "Gang-up retreat" section and index.ts's
// disabled call site for the full numbers — a real win on
// mission_amaranth_12, a real regression on mission_amaranth_21, and a
// genuine batch-timeout-level performance problem on two others). No
// decidePlayerAiAction integration test for it here on purpose, same as
// Guard Taunt above it has none — the primitive tests just above
// (visibleGangCount, GANG_UP_THRESHOLD) cover what's actually live.

describe("focusFireTargetInRange — full integration", () => {
  it("a unit with two in-range, equally-stated targets prefers the one bearing down on the commander over the nominally-equal alternative", () => {
    const { mission, rourke, near, far } = freshMission();
    const bosk = mission.units.find((u) => u.pilotId === "pilot_bosk")!;
    bosk.attackRange = [1, 6];
    rourke.pos = { x: 10, y: 10 };
    bosk.pos = { x: 9, y: 10 };

    near.pos = { x: 11, y: 10 }; // adjacent to the commander — a real threat...
    near.moveRange = 4;
    near.attackRange = [1, 1]; // ...reach 5, well past the 1 tile separating them
    near.currentHp = 100;
    near.effectiveDefense = 1;
    near.downed = false;

    far.pos = { x: 9, y: 4 }; // in Bosk's own attack range too, but nowhere near the commander
    far.moveRange = 1;
    far.attackRange = [1, 1]; // reach 2, well short of the 6 tiles separating them from Rourke
    far.currentHp = 100;
    far.effectiveDefense = 1;
    far.downed = false;

    // Sanity-check the geometry this test's whole premise rests on before
    // asserting the actual pick — both genuinely in Bosk's [1,6] range, only
    // `near` genuinely threatening the commander.
    const threatening = enemiesThreateningVips(mission.units, [near, far]);
    expect(threatening.has(near.instanceId)).toBe(true);
    expect(threatening.has(far.instanceId)).toBe(false);

    const picked = focusFireTargetInRange(mission.map, bosk, bosk.pos, [near, far], mission.units);
    expect(picked?.instanceId).toBe(near.instanceId);
  });
});
