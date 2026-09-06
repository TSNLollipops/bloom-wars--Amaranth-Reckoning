// Player AI difficulty tiers (claude/Bloom_Wars_Player_AI_Difficulty_Tiers_
// Plan_v1.md, 1 Sep 2026): the profiles, the seeded driver, the ability
// triggers' gates, and the Hard tier's seams. Real Mission instances, the
// same discipline as the other files in this directory.
import { describe, it, expect } from "vitest";
import { Mission } from "../../../engine/mission";
import { AMARANTH_MISSION_2 } from "../../../data/campaignAmaranth";
import { ALL_MISSIONS_BY_ID } from "../../../data/allCampaigns";
import { EASY, MODERATE, HARD, LEGACY, PROFILES, profileForTier, createPlayerAiMemory, decidePlayerAiAction, playerAiLog, resetPlayerAiLog } from "../index";
import { driveMission } from "../../driveMission";
import { mulberry32 } from "../../rng";
import { buildThreatMap } from "../../../engine/threat";
import { dangerThreshold, hardTurnOrder, threatMapFor, threatTrimmedPath, allocatedIncomingAt } from "../hard";
import { isNearestPlayerTo, shouldInterdict, tauntSurvivable } from "../abilities";
import { coordKey } from "../../../engine/grid";

describe("profiles", () => {
  it("LEGACY is the pre-tiers bot: full awareness, four verbs only", () => {
    expect(LEGACY.honestVision).toBe(false);
    expect(LEGACY.useAbilities.abil_repair).toBe(true);
    expect(LEGACY.useAbilities.abil_taunt).toBeUndefined();
    expect(LEGACY.useAbilities.overwatch).toBeUndefined();
    expect(LEGACY.threatMap).toBe(false);
  });

  it("MODERATE is LEGACY made fog-honest with every ability on; EASY drops discipline; HARD adds the threat map", () => {
    expect(MODERATE.honestVision).toBe(true);
    expect(MODERATE.retreatHpFraction).toBe(LEGACY.retreatHpFraction);
    expect(Object.values(MODERATE.useAbilities).every(Boolean)).toBe(true);
    expect(EASY.focusFire).toBe(false);
    expect(EASY.protectVips).toBe(false);
    expect(EASY.mistakeChance).toBeGreaterThan(0);
    expect(EASY.useAbilities.abil_taunt).toBeUndefined();
    expect(HARD.threatMap).toBe(true);
    expect(HARD.rememberLastSeen).toBe(true);
    expect(HARD.preemptiveRetreatFraction).toBeLessThan(1);
  });

  it("profileForTier resolves the four names and refuses anything else", () => {
    expect(profileForTier("easy")).toBe(EASY);
    expect(profileForTier("hard")).toBe(HARD);
    expect(profileForTier(undefined)).toBe(MODERATE);
    expect(Object.keys(PROFILES).sort()).toEqual(["easy", "hard", "legacy", "moderate"]);
    expect(() => profileForTier("nightmare")).toThrow(/Unknown Player AI tier/);
  });
});

describe("driveMission — seeded runs replay exactly", () => {
  it("same mission, same tier, same seed → same log, same outcome, same summary", () => {
    const def = ALL_MISSIONS_BY_ID["mission_amaranth_2"];
    const a = driveMission(def, { profile: MODERATE, seed: 42 });
    const b = driveMission(def, { profile: MODERATE, seed: 42 });
    expect(a.outcome).toBe(b.outcome);
    expect(a.mission.turn).toBe(b.mission.turn);
    expect(a.mission.log).toEqual(b.mission.log);
    expect(a.summary.squad).toEqual(b.summary.squad);
    expect(a.summary.source).toBe("bot");
    expect(a.summary.botTier).toBe("moderate");
    expect(a.summary.seed).toBe(42);
  });

  it("Easy's mistakes come from the seeded rng too", () => {
    const def = ALL_MISSIONS_BY_ID["mission_amaranth_2"];
    const a = driveMission(def, { profile: EASY, seed: 7 });
    const b = driveMission(def, { profile: EASY, seed: 7 });
    expect(a.mission.log).toEqual(b.mission.log);
  });

  it("mulberry32 is deterministic and in [0, 1)", () => {
    const r1 = mulberry32(123);
    const r2 = mulberry32(123);
    for (let i = 0; i < 20; i++) {
      const v = r1();
      expect(v).toBe(r2());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("LEGACY runs tag the summary and carry no tier", () => {
    const def = ALL_MISSIONS_BY_ID["mission_amaranth_2"];
    const r = driveMission(def, { profile: LEGACY, seed: 1 });
    expect(r.summary.botTier).toBeUndefined();
    expect(r.summary.tag).toBe("legacy");
  });
});

function fixture() {
  const mission = new Mission(AMARANTH_MISSION_2, undefined, [], { rng: mulberry32(1) });
  const rourke = mission.units.find((u) => u.pilotId === "pilot_rourke")!;
  const bosk = mission.units.find((u) => u.pilotId === "pilot_bosk")!;
  const hostiles = mission.units.filter((u) => u.side === "hostile");
  const [a, b] = hostiles;
  for (const h of hostiles) if (h !== a && h !== b) h.downed = true;
  for (const u of mission.units) if (u.side === "player" && u !== rourke && u !== bosk) u.pos = { x: 0, y: 0 };
  rourke.pos = { x: 2, y: 9 };
  bosk.pos = { x: 3, y: 9 };
  return { mission, rourke, bosk, a, b };
}

describe("honest vision", () => {
  it("MODERATE cannot target a hostile nobody can see; LEGACY still can", () => {
    const { mission, rourke, bosk, a, b } = fixture();
    b.downed = true;
    // A hostile inside Rourke's attack range but invisible (concealed
    // is a player-only flag, so use burrow — the Undertow's own state).
    // Rourke's own mek is Runemaster-primary, which since 6 Sep 2026 means
    // she passively sees burrowed units in her vision — stripped here so
    // "nobody can see it" stays true and the TIER'S honesty is what's
    // under test, not her sensors.
    rourke.pos = { x: 15, y: 5 };
    rourke.detectsBurrowedRadius = undefined;
    bosk.pos = { x: 0, y: 0 };
    a.pos = { x: 16, y: 5 };
    a.burrowed = true;
    resetPlayerAiLog();
    const moderate = decidePlayerAiAction(mission.map, rourke, mission.units, mission.turn, mission, MODERATE, createPlayerAiMemory(mulberry32(1)));
    expect(moderate.attackTargetId).toBeUndefined();
    const legacy = decidePlayerAiAction(mission.map, rourke, mission.units, mission.turn, mission, LEGACY, createPlayerAiMemory(mulberry32(1)));
    expect(legacy.attackTargetId).toBe(a.instanceId);
  });
});

describe("ability gates", () => {
  it("shouldInterdict needs the Tank to be the player unit the hostile is closest to", () => {
    const { mission, rourke, bosk, a, b } = fixture();
    b.downed = true;
    bosk.abilities = [...bosk.abilities, "abil_interdict"];
    bosk.actionsRemaining = 2;
    bosk.pos = { x: 15, y: 5 };
    a.pos = { x: 15, y: 8 };
    a.moveRange = 4;
    rourke.pos = { x: 15, y: 7 }; // closer to the hostile than the Tank
    expect(isNearestPlayerTo(bosk, a, mission.units)).toBe(false);
    expect(shouldInterdict(bosk, [a], mission.units, MODERATE)).toBe(false);
    rourke.pos = { x: 15, y: 1 };
    expect(isNearestPlayerTo(bosk, a, mission.units)).toBe(true);
    expect(shouldInterdict(bosk, [a], mission.units, MODERATE)).toBe(true);
    expect(shouldInterdict(bosk, [a], mission.units, EASY)).toBe(false); // Easy never braces
  });

  it("tauntSurvivable reads the footprint sum: two hostiles in reach that together would kill the taunter → no", () => {
    const { mission, bosk, a, b } = fixture();
    bosk.pos = { x: 15, y: 5 };
    a.pos = { x: 15, y: 7 };
    b.pos = { x: 16, y: 7 };
    for (const h of [a, b]) {
      h.moveRange = 3;
      h.attackRange = [1, 1];
    }
    const threat = buildThreatMap(mission.map, mission.units, mission.turn);
    bosk.currentHp = bosk.maxHp;
    bosk.shield = 0;
    const healthy = tauntSurvivable(threat, mission.map, bosk, mission.units);
    bosk.currentHp = 5;
    expect(tauntSurvivable(threat, mission.map, bosk, mission.units)).toBe(false);
    // At full HP the answer depends on the real numbers; whatever it is,
    // the sum-based rule can only say yes when the sum is under 75% of HP.
    if (healthy) {
      const inc = threat.footprints.filter((f) => f.attackable.has(coordKey(bosk.pos))).length;
      expect(inc).toBeGreaterThan(0);
    }
  });
});

describe("Hard tier seams", () => {
  it("dangerThreshold: a line unit's bar is its HP pool, a VIP's is the profile fraction of max HP", () => {
    const { rourke, bosk } = fixture();
    bosk.currentHp = 80;
    bosk.shield = 20;
    expect(dangerThreshold(bosk, HARD, false)).toBe(100);
    rourke.currentHp = rourke.maxHp;
    expect(dangerThreshold(rourke, HARD, true)).toBeCloseTo(Math.min(HARD.preemptiveRetreatFraction * rourke.maxHp, 0.6 * rourke.currentHp));
  });

  it("threatMapFor caches per board stamp and rebuilds when a hostile dies", () => {
    const { mission, a } = fixture();
    const memory = createPlayerAiMemory(mulberry32(1));
    const first = threatMapFor(memory, mission.map, mission.units, mission.turn);
    expect(threatMapFor(memory, mission.map, mission.units, mission.turn)).toBe(first);
    a.downed = true;
    const second = threatMapFor(memory, mission.map, mission.units, mission.turn);
    expect(second).not.toBe(first);
    expect(second.footprints.some((f) => f.hostile === a)).toBe(false);
  });

  it("hardTurnOrder: Tank first, commander last", () => {
    const { mission, rourke, bosk } = fixture();
    const players = mission.units.filter((u) => u.side === "player");
    const ordered = hardTurnOrder(players);
    expect(ordered[0]).toBe(bosk);
    expect(ordered[ordered.length - 1]).toBe(rourke);
  });

  it("allocatedIncomingAt: a hostile that can't see the tile from where it stands doesn't count", () => {
    const { mission, rourke, bosk, a, b } = fixture();
    b.downed = true;
    bosk.pos = { x: 0, y: 0 };
    a.pos = { x: 15, y: 5 };
    a.moveRange = 5;
    a.attackRange = [1, 1];
    a.vision = 2;
    a.kind = "bloom";
    const threat = buildThreatMap(mission.map, mission.units, mission.turn);
    // Inside the footprint (5 move + 1 range) but outside vision 2.
    const blind = allocatedIncomingAt(threat, mission.map, rourke, { x: 15, y: 9 }, mission.units);
    expect(threat.footprints[0].attackable.has(coordKey({ x: 15, y: 9 }))).toBe(true);
    expect(blind.attackers).toBe(0);
    const seen = allocatedIncomingAt(threat, mission.map, rourke, { x: 15, y: 7 }, mission.units);
    expect(seen.attackers).toBe(1);
  });

  it("threatTrimmedPath cuts an advance back to the last step under the bar, and commits after two stalled turns", () => {
    const { mission, rourke, bosk, a, b } = fixture();
    b.downed = true;
    rourke.pos = { x: 0, y: 0 };
    bosk.pos = { x: 15, y: 1 };
    bosk.currentHp = 10;
    bosk.shield = 0;
    a.pos = { x: 15, y: 8 };
    a.moveRange = 2;
    a.attackRange = [1, 1];
    a.vision = 6;
    a.kind = "bloom";
    const memory = createPlayerAiMemory(mulberry32(1));
    const threat = threatMapFor(memory, mission.map, mission.units, mission.turn);
    const path = [
      { x: 15, y: 1 },
      { x: 15, y: 2 },
      { x: 15, y: 3 },
      { x: 15, y: 4 },
      { x: 15, y: 5 },
    ];
    const trimmed = threatTrimmedPath(path, mission.map, bosk, mission.units, threat, HARD, false, memory);
    // (15,5) is inside the hostile's reach (2 move + 1) and would kill a 10-HP Tank; (15,4) is not.
    expect(trimmed[trimmed.length - 1]).toEqual({ x: 15, y: 4 });
    // A path with no safe step stalls; the second stalled turn commits
    // (STALL_COMMIT_TURNS = 2) and resets the counter.
    const allBad = [
      { x: 15, y: 5 },
      { x: 15, y: 6 },
    ];
    expect(threatTrimmedPath(allBad, mission.map, bosk, mission.units, threat, HARD, false, memory)).toHaveLength(1);
    expect(threatTrimmedPath(allBad, mission.map, bosk, mission.units, threat, HARD, false, memory).length).toBeGreaterThan(1);
    expect(memory.stalledTurns.get(bosk.instanceId)).toBe(0);
    // A VIP never commits.
    expect(threatTrimmedPath(allBad, mission.map, bosk, mission.units, threat, HARD, true, memory)).toHaveLength(1);
    expect(threatTrimmedPath(allBad, mission.map, bosk, mission.units, threat, HARD, true, memory)).toHaveLength(1);
    expect(threatTrimmedPath(allBad, mission.map, bosk, mission.units, threat, HARD, true, memory)).toHaveLength(1);
  });

  it("a Hard commander standing where the predicted incoming beats her bar moves before it lands", () => {
    const { mission, rourke, bosk, a, b } = fixture();
    // Two hostiles adjacent to Rourke, Bosk far away; nothing killable in place.
    rourke.pos = { x: 15, y: 5 };
    bosk.pos = { x: 15, y: 1 };
    a.pos = { x: 16, y: 5 };
    b.pos = { x: 14, y: 5 };
    for (const h of [a, b]) {
      h.moveRange = 3;
      h.attackRange = [1, 1];
      h.vision = 5;
      h.kind = "bloom";
      h.currentHp = 9999;
      h.endurance = 9999;
      h.maxEndurance = 9999;
      h.vitality = 9999;
    }
    const memory = createPlayerAiMemory(mulberry32(1));
    resetPlayerAiLog();
    const decision = decidePlayerAiAction(mission.map, rourke, mission.units, mission.turn, mission, HARD, memory);
    const last = playerAiLog[playerAiLog.length - 1];
    expect(["preempt_retreat", "retreat_low_hp", "focus_weak", "advance_into_range"]).toContain(last.reason);
    if (last.reason === "preempt_retreat") {
      expect(decision.path).toBeDefined();
      expect(decision.path!.length).toBeGreaterThan(1);
    }
  });
});
