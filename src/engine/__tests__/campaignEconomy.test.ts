// Campaign economy pass (engine/campaignEconomy.ts, 22 Aug 2026): the
// two-pool split on top of this morning's engine/campaignState.ts —
// personal points (per-pilot earning + spending) and the company pool
// (CampaignState.points, now explicitly company-level). See that file's
// own header for every placeholder number this suite pins down.
import { describe, it, expect } from "vitest";
import { Mission, ASSIST_MIN_FRACTION, ASSIST_MAX_FRACTION, REPAIR_ASSIST_FRACTION } from "../mission";
import { createHostileMechUnit } from "../units";
import { MAX_ACTIONS_PER_TURN } from "../../data/combatTables";
import { MISSION_1A, MISSION_3 } from "../../data/campaign";
import { AMARANTH_MISSION_1 } from "../../data/campaignAmaranth";
import { createCampaignState, createWardenCampaignState, applyPermadeathCheck } from "../campaignState";
import { testUnit } from "./testHelpers";
import {
  computeMissionEarnings,
  applyMissionEarnings,
  purchaseTierUpgrade,
  purchaseMekSecondary,
  purchaseSpareParts,
  computeMissionCompletionBonus,
  computeCoBonus,
  applyCompanyEarnings,
  TIER_UPGRADE_COST,
  MEK_SECONDARY_COST,
  SPARE_PART_COST,
  CO_BONUS_BY_RANK,
  KILL_BONUS,
  SURVIVAL_BONUS,
  OBJECTIVE_BONUS,
} from "../campaignEconomy";

describe("Mission per-unit performance tracking (the new bookkeeping this pass adds)", () => {
  it("credits the attacker's own damage and a kill when their attack downs a hostile Bloom", () => {
    const mission = new Mission(MISSION_1A);
    const attacker = mission.units.find((u) => u.pilotId === "pilot_thyns")!;
    const target = mission.units.find((u) => u.side === "hostile" && u.kind === "bloom")!;
    // Force a guaranteed one-hit kill regardless of the real Endurance/
    // Vitality numbers: Collapse already reached, 1 HP of Vitality left —
    // see combat.ts applyBloomDamage, any dmg >= vitality downs it.
    target.endurance = 0;
    target.collapsed = true;
    target.vitality = 1;
    target.currentHp = 1;
    attacker.pos = { x: target.pos.x + 1, y: target.pos.y };

    const outcome = mission.attack(attacker.instanceId, target.instanceId);
    expect(outcome).not.toBeNull();
    expect(outcome!.defenderDowned).toBe(true);
    expect(outcome!.damage).toBeGreaterThan(0);

    const perf = mission.unitPerformance["pilot_thyns"];
    expect(perf.damageDealt).toBe(outcome!.damage);
    expect(perf.kills).toBe(1);
    expect(perf.wasDowned).toBe(false);
  });

  it("credits a kill (and the counter damage) to the DEFENDER when their counter — not their own attack — downs the hostile attacker", () => {
    const mission = new Mission(MISSION_1A);
    const hostileAttacker = createHostileMechUnit("hostile_mech_01", { x: 5, y: 5 }); // path tank
    mission.units.push(hostileAttacker);
    hostileAttacker.currentHp = 1; // any nonzero counter-hit downs it; also keeps its own primary hit negligible

    const defender = mission.units.find((u) => u.pilotId === "pilot_thyns")!; // Tank: canCounter, counterMaxRange 1
    defender.pos = { x: 6, y: 5 };
    const damageBefore = mission.unitPerformance["pilot_thyns"].damageDealt;

    const outcome = mission.attack(hostileAttacker.instanceId, defender.instanceId);
    expect(outcome).not.toBeNull();
    expect(outcome!.countered).toBe(true);
    expect(outcome!.attackerDowned).toBe(true); // the hostile died to the counter, not to anything pilot_thyns "attacked"

    const perf = mission.unitPerformance["pilot_thyns"];
    expect(perf.kills).toBe(1);
    expect(perf.damageDealt).toBeGreaterThan(damageBefore);
    expect(perf.wasDowned).toBe(false); // pilot_thyns itself was never downed here
  });

  it("latches wasDowned the instant a deployed pilot is downed, even if nothing else about them changes", () => {
    const mission = new Mission(MISSION_1A);
    const hostileAttacker = createHostileMechUnit("hostile_mech_01", { x: 5, y: 5 });
    mission.units.push(hostileAttacker);
    // pilot_tourignie: Reeps, canCounter=false — no counter, no Meeps-dodge
    // randomness, so this stays fully deterministic.
    const victim = mission.units.find((u) => u.pilotId === "pilot_tourignie")!;
    victim.pos = { x: 6, y: 5 };
    victim.currentHp = 1;

    expect(mission.unitPerformance["pilot_tourignie"].wasDowned).toBe(false);
    const outcome = mission.attack(hostileAttacker.instanceId, victim.instanceId);
    expect(outcome!.defenderDowned).toBe(true);
    expect(mission.unitPerformance["pilot_tourignie"].wasDowned).toBe(true);
  });

  it("every deployed pilot gets a zeroed entry up front, even one who never acts", () => {
    const mission = new Mission(MISSION_1A);
    for (const pilotId of mission.mission.playerPilotIds) {
      expect(mission.unitPerformance[pilotId]).toEqual({ damageDealt: 0, kills: 0, assistCredit: 0, wasDowned: false });
    }
  });
});

describe("Combat/repair assist credit (Qiraki_Weapons_And_Progression.md's 'Scoring system, LOCKED': kills plus assists combined)", () => {
  it("a solo kill — one pilot deals all the damage and lands the finishing blow — earns the kill and NO self-assist", () => {
    const mission = new Mission(MISSION_1A);
    const attacker = mission.units.find((u) => u.pilotId === "pilot_thyns")!;
    const target = mission.units.find((u) => u.side === "hostile" && u.kind === "bloom")!;
    target.endurance = 0;
    target.collapsed = true;
    target.vitality = 1;
    target.currentHp = 1;
    attacker.pos = { x: target.pos.x + 1, y: target.pos.y };

    mission.attack(attacker.instanceId, target.instanceId);

    const perf = mission.unitPerformance["pilot_thyns"];
    expect(perf.kills).toBe(1);
    expect(perf.assistCredit).toBe(0);
  });

  it("a victim that's damaged but never dies resolves to nothing — no kill, no assist, for anyone", () => {
    const mission = new Mission(MISSION_1A);
    const attacker = mission.units.find((u) => u.pilotId === "pilot_thyns")!;
    const target = mission.units.find((u) => u.side === "hostile" && u.kind === "bloom")!;
    target.currentHp = 999999; // survives the hit
    attacker.pos = { x: target.pos.x + 1, y: target.pos.y };

    mission.attack(attacker.instanceId, target.instanceId);

    const perf = mission.unitPerformance["pilot_thyns"];
    expect(perf.kills).toBe(0);
    expect(perf.assistCredit).toBe(0);
  });

  it("two pilots damage the same hostile; whoever DOESN'T land the finishing blow gets a combat assist, not a kill", () => {
    const mission = new Mission(MISSION_1A);
    const softener = mission.units.find((u) => u.pilotId === "pilot_tourignie")!; // Reeps, no counter — deterministic
    const finisher = mission.units.find((u) => u.pilotId === "pilot_thyns")!;
    const target = mission.units.find((u) => u.side === "hostile" && u.kind === "bloom")!;
    target.pos = { x: 10, y: 10 };
    softener.pos = { x: 8, y: 10 }; // pilot_tourignie is Reeps — attackRange [2,4], distance 2 here
    finisher.pos = { x: 11, y: 10 }; // pilot_thyns is Tank — attackRange [1,1]
    target.endurance = 0;
    target.collapsed = false; // still up after the softening hit
    target.vitality = 1000;
    target.currentHp = 1000;

    const softenOutcome = mission.attack(softener.instanceId, target.instanceId)!;
    expect(softenOutcome.defenderDowned).toBe(false); // confirms it survived the softening hit

    // Now guaranteed one-hit for the finisher, same convention as the
    // existing "credits the attacker's own damage and a kill" test above.
    target.collapsed = true;
    target.vitality = 1;
    target.currentHp = 1;
    mission.attack(finisher.instanceId, target.instanceId);

    const softenerPerf = mission.unitPerformance["pilot_tourignie"];
    const finisherPerf = mission.unitPerformance["pilot_thyns"];
    expect(finisherPerf.kills).toBe(1);
    expect(finisherPerf.assistCredit).toBe(0); // the finisher doesn't also get an assist on their own kill
    expect(softenerPerf.kills).toBe(0);
    expect(softenerPerf.assistCredit).toBeGreaterThan(0);
    expect(softenerPerf.assistCredit).toBeLessThanOrEqual(ASSIST_MAX_FRACTION);
    expect(softenerPerf.assistCredit).toBeGreaterThanOrEqual(ASSIST_MIN_FRACTION);
  });

  it("a bigger contribution share earns a bigger assist fraction, within the 10%-50% band", () => {
    // Same contributing pilot both times, against two separate victims —
    // isolates "this pilot's share of the total damage dealt to a given
    // victim" as the only variable, by controlling how hard the FINISHER
    // hits relative to the contributor's own softening hit (resolveAttack-
    // OnBloom, combat.ts: damage = round(effectiveAttack * 0.5) on open
    // ground at full HP — directly settable, no RNG involved), rather than
    // relying on any assumption about how two different archetypes'
    // damage output compares to each other.
    const mission = new Mission(MISSION_1A);
    const contributor = mission.units.find((u) => u.pilotId === "pilot_tourignie")!; // Reeps — attackRange [2,4]
    const finisher = mission.units.find((u) => u.pilotId === "pilot_thyns")!; // Tank — attackRange [1,1]
    const [victimA, victimB] = mission.units.filter((u) => u.side === "hostile" && u.kind === "bloom");
    victimA.pos = { x: 10, y: 10 };
    victimB.pos = { x: 14, y: 10 };
    victimA.endurance = 0; // already past Collapse — every hit from here lands on vitality directly
    victimA.vitality = 1000; // survives the contributor's softening hit
    victimB.endurance = 0;
    victimB.vitality = 1000;

    // --- Case 1: finisher hits far harder than the contributor did — contributor's share, and assist, should land near the MIN end of the band.
    contributor.pos = { x: 8, y: 10 }; // distance 2
    mission.attack(contributor.instanceId, victimA.instanceId);
    victimA.vitality = 1; // guarantee the finisher's hit downs it next
    finisher.pos = { x: 9, y: 10 }; // distance 1
    finisher.effectiveAttack = 100000; // dwarfs the contributor's own hit
    mission.attack(finisher.instanceId, victimA.instanceId);
    const lowShareAssist = mission.unitPerformance["pilot_tourignie"].assistCredit;

    // --- Case 2: finisher barely contributes anything next to the same contributor's own hit — share, and assist, should land near the MAX end of the band.
    contributor.actionsRemaining = MAX_ACTIONS_PER_TURN; // attack() zeroes this — reused unit needs a fresh turn
    contributor.pos = { x: 12, y: 10 }; // distance 2
    mission.attack(contributor.instanceId, victimB.instanceId);
    victimB.vitality = 1;
    finisher.actionsRemaining = MAX_ACTIONS_PER_TURN;
    finisher.pos = { x: 13, y: 10 }; // distance 1
    finisher.effectiveAttack = 10; // small but still nonzero — must stay enough to actually down victimB (vitality 1)
    mission.attack(finisher.instanceId, victimB.instanceId);
    const totalAssist = mission.unitPerformance["pilot_tourignie"].assistCredit;
    const highShareAssist = totalAssist - lowShareAssist; // this pilot's own assistCredit accumulates across both cases

    expect(lowShareAssist).toBeGreaterThanOrEqual(ASSIST_MIN_FRACTION);
    expect(highShareAssist).toBeLessThanOrEqual(ASSIST_MAX_FRACTION);
    expect(highShareAssist).toBeGreaterThan(lowShareAssist);
  });

  it("a successful repair action credits the healer a flat REPAIR_ASSIST_FRACTION assist", () => {
    const mission = new Mission(MISSION_1A);
    const healer = mission.units.find((u) => u.pilotId === "pilot_barasj")!; // Munti, Fieldwright primary
    const target = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    healer.pos = { x: 5, y: 5 };
    target.pos = { x: 6, y: 5 };
    target.currentHp = target.maxHp - 50;

    mission.repairUnit(healer.instanceId, target.instanceId);

    expect(mission.unitPerformance["pilot_barasj"].assistCredit).toBe(REPAIR_ASSIST_FRACTION);
  });

  it("repairing twice in one turn (the two-action house rule) accumulates assist credit additively", () => {
    const mission = new Mission(MISSION_1A);
    const healer = mission.units.find((u) => u.pilotId === "pilot_barasj")!;
    const allyA = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    const allyB = mission.units.find((u) => u.pilotId === "pilot_thyns")!;
    healer.pos = { x: 5, y: 5 };
    allyA.pos = { x: 6, y: 5 };
    allyB.pos = { x: 4, y: 5 };
    allyA.currentHp -= 10;
    allyB.currentHp -= 10;

    mission.repairUnit(healer.instanceId, allyA.instanceId);
    mission.repairUnit(healer.instanceId, allyB.instanceId);

    expect(mission.unitPerformance["pilot_barasj"].assistCredit).toBe(REPAIR_ASSIST_FRACTION * 2);
  });

  it("a repair that heals 0 HP (already-full target) does NOT credit an assist", () => {
    const mission = new Mission(MISSION_1A);
    const healer = mission.units.find((u) => u.pilotId === "pilot_barasj")!;
    const fullHpAlly = mission.units.find((u) => u.pilotId === "pilot_tourignie")!;
    healer.pos = { x: 5, y: 5 };
    fullHpAlly.pos = { x: 6, y: 5 };
    // Bypass getRepairableFrom's own full-HP filter (repair.test.ts's
    // regression test) by calling repairUnit directly — this test is
    // specifically about the amount===0 guard inside repairUnit itself.
    const result = mission.repairUnit(healer.instanceId, fullHpAlly.instanceId);

    expect(result!.amount).toBe(0);
    expect(mission.unitPerformance["pilot_barasj"].assistCredit).toBe(0);
  });
});

describe("computeMissionEarnings — the personal-points formula", () => {
  it("matches killBonus + assistBonus + survivalBonus, with objectiveBonus at 0 while the mission is still ongoing", () => {
    const mission = new Mission(MISSION_1A);
    const attacker = mission.units.find((u) => u.pilotId === "pilot_thyns")!;
    const target = mission.units.find((u) => u.side === "hostile" && u.kind === "bloom")!;
    target.endurance = 0;
    target.vitality = 1;
    attacker.pos = { x: target.pos.x + 1, y: target.pos.y };
    mission.attack(attacker.instanceId, target.instanceId);

    const earnings = computeMissionEarnings(mission);
    // Solo kill, nobody else touched the target first — assistBonus is 0.
    const expected = KILL_BONUS * 1 + Math.round(KILL_BONUS * 0) + SURVIVAL_BONUS + 0;
    expect(earnings["pilot_thyns"]).toBe(expected);
  });

  it("a combat assist adds Math.round(KILL_BONUS * assistCredit) on top of the rest of the formula", () => {
    const mission = new Mission(MISSION_1A);
    const softener = mission.units.find((u) => u.pilotId === "pilot_tourignie")!;
    const finisher = mission.units.find((u) => u.pilotId === "pilot_thyns")!;
    const target = mission.units.find((u) => u.side === "hostile" && u.kind === "bloom")!;
    target.pos = { x: 10, y: 10 };
    softener.pos = { x: 8, y: 10 }; // pilot_tourignie is Reeps — attackRange [2,4], distance 2 here
    finisher.pos = { x: 11, y: 10 }; // pilot_thyns is Tank — attackRange [1,1]
    target.endurance = 0;
    target.collapsed = false;
    target.vitality = 1000;
    target.currentHp = 1000;

    mission.attack(softener.instanceId, target.instanceId);
    target.collapsed = true;
    target.vitality = 1;
    target.currentHp = 1;
    mission.attack(finisher.instanceId, target.instanceId);

    const earnings = computeMissionEarnings(mission);
    const perf = mission.unitPerformance["pilot_tourignie"];
    expect(perf.assistCredit).toBeGreaterThan(0);
    const expected = KILL_BONUS * 0 + Math.round(KILL_BONUS * perf.assistCredit) + SURVIVAL_BONUS + 0;
    expect(earnings["pilot_tourignie"]).toBe(expected);
  });

  it("an idle deployed pilot who never acts and never gets downed still earns exactly the survivalBonus", () => {
    const mission = new Mission(MISSION_1A);
    const earnings = computeMissionEarnings(mission);
    expect(earnings["pilot_barasj"]).toBe(SURVIVAL_BONUS);
  });

  it("survivalBonus drops to 0 for a pilot who was downed this mission, everything else staying 0 for an otherwise-idle victim", () => {
    const mission = new Mission(MISSION_1A);
    const hostileAttacker = createHostileMechUnit("hostile_mech_01", { x: 5, y: 5 });
    mission.units.push(hostileAttacker);
    const victim = mission.units.find((u) => u.pilotId === "pilot_tourignie")!;
    victim.pos = { x: 6, y: 5 };
    victim.currentHp = 1;
    mission.attack(hostileAttacker.instanceId, victim.instanceId);

    const earnings = computeMissionEarnings(mission);
    expect(earnings["pilot_tourignie"]).toBe(0); // 0 damage, 0 kills, 0 survival, 0 objective
  });

  it("objectiveBonus applies to every deployed pilot once the mission outcome is a win, including one who did nothing", () => {
    const mission = new Mission(MISSION_1A);
    mission.outcome = "win"; // forcing the outcome directly, same as this repo's other Mission-internals tests
    const earnings = computeMissionEarnings(mission);
    expect(earnings["pilot_barasj"]).toBe(SURVIVAL_BONUS + OBJECTIVE_BONUS);
  });
});

describe("applyMissionEarnings — crediting personalPoints", () => {
  it("adds each pilot's earned amount to their own personalPoints, independently of everyone else's", () => {
    const state = createWardenCampaignState();
    applyMissionEarnings(state, { pilot_rourke: 12, pilot_bosk: 0, pilot_lask: 40 });
    expect(state.pilots["pilot_rourke"].personalPoints).toBe(12);
    expect(state.pilots["pilot_bosk"].personalPoints).toBe(0);
    expect(state.pilots["pilot_lask"].personalPoints).toBe(40);
    expect(state.pilots["pilot_iyari"].personalPoints).toBe(0); // untouched — not in the earnings record at all
  });

  it("accumulates across repeated calls rather than overwriting", () => {
    const state = createWardenCampaignState();
    applyMissionEarnings(state, { pilot_rourke: 10 });
    applyMissionEarnings(state, { pilot_rourke: 15 });
    expect(state.pilots["pilot_rourke"].personalPoints).toBe(25);
  });

  it("skips a pilot who is not active (belt-and-suspenders with applyPermadeathCheck's own zeroing)", () => {
    const state = createWardenCampaignState();
    state.pilots["pilot_lask"].status = "permanently_lost";
    applyMissionEarnings(state, { pilot_lask: 999 });
    expect(state.pilots["pilot_lask"].personalPoints).toBe(0);
  });

  it("silently ignores an earnings entry for an unknown pilot id rather than throwing", () => {
    const state = createWardenCampaignState();
    expect(() => applyMissionEarnings(state, { not_a_real_pilot: 50 })).not.toThrow();
  });
});

describe("purchaseTierUpgrade — personal-pool spending", () => {
  it("succeeds, deducting the Data Pack §12.1 cost and stepping the tier up exactly one rung", () => {
    const state = createWardenCampaignState();
    state.pilots["pilot_lask"].personalPoints = TIER_UPGRADE_COST.G;
    const result = purchaseTierUpgrade(state, "pilot_lask");
    expect(result.ok).toBe(true);
    expect(result.newTier).toBe("F");
    expect(result.cost).toBe(60);
    expect(state.pilots["pilot_lask"].pilot.tier).toBe("F");
    expect(state.pilots["pilot_lask"].personalPoints).toBe(0);
  });

  it("fails cleanly, changing nothing, when the pilot can't afford it", () => {
    const state = createWardenCampaignState();
    state.pilots["pilot_lask"].personalPoints = TIER_UPGRADE_COST.G - 1;
    const result = purchaseTierUpgrade(state, "pilot_lask");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not enough personal points/);
    expect(state.pilots["pilot_lask"].pilot.tier).toBe("G");
    expect(state.pilots["pilot_lask"].personalPoints).toBe(TIER_UPGRADE_COST.G - 1);
  });

  it("refuses to spend a lost pilot's (nonexistent) balance", () => {
    const state = createWardenCampaignState();
    state.pilots["pilot_lask"].status = "permanently_lost";
    state.pilots["pilot_lask"].personalPoints = 10000;
    const result = purchaseTierUpgrade(state, "pilot_lask");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not active/);
  });

  it("refuses a pilot already at tier A", () => {
    const state = createWardenCampaignState();
    state.pilots["pilot_lask"].pilot.tier = "A";
    state.pilots["pilot_lask"].personalPoints = 100000;
    const result = purchaseTierUpgrade(state, "pilot_lask");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/already at tier A/);
  });

  it("fails cleanly on an unknown pilot id", () => {
    const state = createWardenCampaignState();
    const result = purchaseTierUpgrade(state, "not_a_real_pilot");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/unknown pilot id/);
  });
});

describe("purchaseMekSecondary — personal-pool spending", () => {
  it("succeeds, deducting MEK_SECONDARY_COST and assigning the requested track", () => {
    const state = createWardenCampaignState();
    state.pilots["pilot_lask"].personalPoints = MEK_SECONDARY_COST; // mek_lask: primary fieldwright, no secondary
    const result = purchaseMekSecondary(state, "pilot_lask", "armorer");
    expect(result.ok).toBe(true);
    expect(result.track).toBe("armorer");
    expect(state.meks["mek_lask"].secondary).toBe("armorer");
    expect(state.pilots["pilot_lask"].personalPoints).toBe(0);
  });

  it("refuses a mek that already has a secondary", () => {
    const state = createWardenCampaignState();
    state.pilots["pilot_lask"].personalPoints = MEK_SECONDARY_COST * 2;
    purchaseMekSecondary(state, "pilot_lask", "armorer");
    const second = purchaseMekSecondary(state, "pilot_lask", "runemaster");
    expect(second.ok).toBe(false);
    expect(second.reason).toMatch(/already has a secondary/);
  });

  it("refuses a secondary identical to the mek's own primary", () => {
    const state = createWardenCampaignState();
    state.pilots["pilot_lask"].personalPoints = MEK_SECONDARY_COST;
    const result = purchaseMekSecondary(state, "pilot_lask", "fieldwright"); // mek_lask's own primary
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/pick a different track/);
  });

  it("fails cleanly when the pilot can't afford it", () => {
    const state = createWardenCampaignState();
    state.pilots["pilot_lask"].personalPoints = MEK_SECONDARY_COST - 1;
    const result = purchaseMekSecondary(state, "pilot_lask", "armorer");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not enough personal points/);
    expect(state.meks["mek_lask"].secondary).toBeNull();
  });
});

describe("purchaseSpareParts — company-pool spending, deliberately NOT personal", () => {
  it("succeeds against the COMPANY pool for a mek with Fabricator as primary, up to its cap of 2", () => {
    const state = createCampaignState([], { mek_fab: { id: "mek_fab", displayName: "Fab Mek", primary: "fabricator", secondary: null, spareParts: 0 } }, SPARE_PART_COST * 2);
    const first = purchaseSpareParts(state, "mek_fab");
    expect(first.ok).toBe(true);
    expect(first.spareParts).toBe(1);
    expect(state.points).toBe(SPARE_PART_COST);

    const second = purchaseSpareParts(state, "mek_fab");
    expect(second.ok).toBe(true);
    expect(second.spareParts).toBe(2);
    expect(state.points).toBe(0);

    const third = purchaseSpareParts(state, "mek_fab");
    expect(third.ok).toBe(false);
    expect(third.reason).toMatch(/Fabricator track maximum/);
  });

  it("caps at 1 for a mek with Fabricator only as a secondary", () => {
    const state = createCampaignState(
      [],
      { mek_fab_sec: { id: "mek_fab_sec", displayName: "Fab-Secondary Mek", primary: "armorer", secondary: "fabricator", spareParts: 0 } },
      SPARE_PART_COST * 2
    );
    expect(purchaseSpareParts(state, "mek_fab_sec").ok).toBe(true);
    const second = purchaseSpareParts(state, "mek_fab_sec");
    expect(second.ok).toBe(false);
    expect(second.reason).toMatch(/Fabricator track maximum \(1\)/);
  });

  it("refuses a mek with no Fabricator track at all", () => {
    const state = createWardenCampaignState(1000); // mek_lask: fieldwright primary, no secondary
    const result = purchaseSpareParts(state, "mek_lask");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/no Fabricator track/);
  });

  it("fails cleanly when the COMPANY pool can't afford it, leaving that pool (and the mek) untouched", () => {
    const state = createCampaignState([], { mek_fab: { id: "mek_fab", displayName: "Fab Mek", primary: "fabricator", secondary: null, spareParts: 0 } }, SPARE_PART_COST - 1);
    const result = purchaseSpareParts(state, "mek_fab");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not enough company points/);
    expect(state.points).toBe(SPARE_PART_COST - 1);
    expect(state.meks["mek_fab"].spareParts).toBe(0);
  });
});

describe("computeMissionCompletionBonus — Data Pack §12.3, company-pool money", () => {
  it("is entirely zero while the mission hasn't been won yet", () => {
    const mission = new Mission(MISSION_1A);
    const bonus = computeMissionCompletionBonus(mission);
    expect(bonus).toEqual({ base: 0, turnsUnderLimitBonus: 0, noPilotDownedBonus: 0, noSparePartsSpentBonus: 0, noSeveranceBonus: 0, total: 0 });
  });

  it("sums base reward + turns-under-limit + no-pilot-downed + no-spare-parts on a clean win", () => {
    const mission = new Mission(MISSION_1A); // rewardPoints 120, turnLimit 12
    mission.outcome = "win";
    mission.turn = 5; // 7 turns under the limit
    const bonus = computeMissionCompletionBonus(mission);
    expect(bonus.base).toBe(120);
    expect(bonus.turnsUnderLimitBonus).toBe(70); // 7 * 10
    expect(bonus.noPilotDownedBonus).toBe(40);
    expect(bonus.noSparePartsSpentBonus).toBe(30); // always true this pass — see the function's own header
    expect(bonus.noSeveranceBonus).toBe(0); // MISSION_1A ships heirloomCharge "locked"
    expect(bonus.total).toBe(120 + 70 + 40 + 30);
  });

  it("drops the no-pilot-downed bonus to 0 the moment any deployed pilot was downed this mission", () => {
    const mission = new Mission(MISSION_1A);
    mission.outcome = "win";
    mission.turn = 5;
    mission.unitPerformance["pilot_nagori"].wasDowned = true;
    const bonus = computeMissionCompletionBonus(mission);
    expect(bonus.noPilotDownedBonus).toBe(0);
  });

  it("clamps turns-under-limit at 0 rather than going negative when the win lands past the limit", () => {
    const mission = new Mission(MISSION_1A);
    mission.outcome = "win";
    mission.turn = 999;
    const bonus = computeMissionCompletionBonus(mission);
    expect(bonus.turnsUnderLimitBonus).toBe(0);
  });

  it("awards the Severance bonus only on a mission whose Heirloom is actually available", () => {
    const mission = new Mission(MISSION_3); // heirloomCharge: "available"
    mission.outcome = "win";
    mission.turn = mission.mission.objectiveParams.turnLimit; // 0 turns under, isolates just this term plus base/flat bonuses
    const bonus = computeMissionCompletionBonus(mission);
    expect(bonus.noSeveranceBonus).toBe(25);
    expect(bonus.base).toBe(200);
    expect(bonus.total).toBe(200 + 0 + 40 + 30 + 25);
  });
});

describe("computeCoBonus / applyCompanyEarnings — the Rourke CO bonus, company-pool only", () => {
  it("defaults to the 2nd Lt. rate when Rourke is deployed and active", () => {
    const state = createWardenCampaignState();
    const mission = new Mission(AMARANTH_MISSION_1);
    expect(state.rourkeRank).toBe("2nd_lt");
    expect(computeCoBonus(state, mission)).toBe(CO_BONUS_BY_RANK["2nd_lt"]);
  });

  it("scales with rank at each tier", () => {
    const state = createWardenCampaignState();
    const mission = new Mission(AMARANTH_MISSION_1);
    state.rourkeRank = "capt";
    expect(computeCoBonus(state, mission)).toBe(20);
    state.rourkeRank = "maj";
    expect(computeCoBonus(state, mission)).toBe(35);
  });

  it("is 0 when Rourke did not deploy on this particular mission", () => {
    const state = createWardenCampaignState();
    const missionWithoutRourke = new Mission(MISSION_1A); // Team One roster — no pilot_rourke at all
    expect(computeCoBonus(state, missionWithoutRourke)).toBe(0);
  });

  it("is 0 when Rourke's campaign entry isn't active (defensive — can't happen in play, she's permadeath-exempt)", () => {
    const state = createWardenCampaignState();
    state.pilots["pilot_rourke"].status = "permanently_lost";
    const mission = new Mission(AMARANTH_MISSION_1);
    expect(computeCoBonus(state, mission)).toBe(0);
  });

  it("never substitutes for or reduces Rourke's own personal earnings — the two are wholly separate additions", () => {
    const state = createWardenCampaignState();
    const mission = new Mission(AMARANTH_MISSION_1);
    const personalBefore = state.pilots["pilot_rourke"].personalPoints;
    const companyBefore = state.points;

    applyMissionEarnings(state, computeMissionEarnings(mission)); // her own personal stream
    applyCompanyEarnings(state, mission); // the wholly separate CO stream

    expect(state.pilots["pilot_rourke"].personalPoints).toBeGreaterThan(personalBefore); // she still earned her own share (survivalBonus, at least)
    expect(state.points).toBeGreaterThan(companyBefore); // and the company pool grew too, independently
  });

  it("applyCompanyEarnings routes completionBonus.total + coBonus into state.points explicitly, and returns the breakdown", () => {
    const state = createWardenCampaignState(); // points starts at 0
    const mission = new Mission(AMARANTH_MISSION_1); // rewardPoints 100, turnLimit 8
    mission.outcome = "win";
    mission.turn = 3; // 5 turns under the limit

    const result = applyCompanyEarnings(state, mission);
    const expectedCompletion = 100 + 5 * 10 + 40 + 30 + 0; // base + turns-under + no-downed + no-spare-parts + no-severance(locked)
    expect(result.completionBonus.total).toBe(expectedCompletion);
    expect(result.coBonus).toBe(CO_BONUS_BY_RANK["2nd_lt"]);
    expect(result.totalAdded).toBe(expectedCompletion + CO_BONUS_BY_RANK["2nd_lt"]);
    expect(state.points).toBe(expectedCompletion + CO_BONUS_BY_RANK["2nd_lt"]);
  });
});

describe("Permanent loss discards banked personal points (intentional, per this pass's brief)", () => {
  it("zeroes a newly-lost pilot's personalPoints the moment applyPermadeathCheck flips them permanent, and never transfers it anywhere", () => {
    const state = createWardenCampaignState();
    state.pilots["pilot_anand"].personalPoints = 250;
    const companyPoolBefore = state.points;

    const downed = testUnit("reeps", { x: 0, y: 0 });
    downed.pilotId = "pilot_anand"; // Warden roster, not exempt
    downed.downed = true;
    const result = applyPermadeathCheck(state, downed, [downed]); // no living Munti in sameSideUnits — permanent

    expect(result.permanent).toBe(true);
    expect(state.pilots["pilot_anand"].status).toBe("permanently_lost");
    expect(state.pilots["pilot_anand"].personalPoints).toBe(0); // banked points gone, not a bug
    expect(state.points).toBe(companyPoolBefore); // and definitely not swept into the company pool either
  });

  it("leaves personalPoints untouched when the check resolves to a standard restock instead", () => {
    const state = createWardenCampaignState();
    state.pilots["pilot_bosk"].personalPoints = 75;
    const mission = new Mission(AMARANTH_MISSION_1);
    const downed = mission.units.find((u) => u.pilotId === "pilot_bosk")!;
    downed.downed = true;
    const munti = mission.units.find((u) => u.pilotId === "pilot_lask")!; // living Munti present
    applyPermadeathCheck(state, downed, [downed, munti]);
    expect(state.pilots["pilot_bosk"].status).toBe("active");
    expect(state.pilots["pilot_bosk"].personalPoints).toBe(75);
  });
});
