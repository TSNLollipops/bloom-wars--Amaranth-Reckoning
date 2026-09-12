// Munti passive regen house rule (data/combatTables.ts MUNTI_REGEN_RADIUS /
// MUNTI_REGEN_PER_TURN, Maxime, 22 Aug 2026): every living Munti passively
// heals itself and same-side allies within radius 2 for a flat amount each
// turn, on top of — not instead of — their existing active Repair ability.
// Same "flag it, keep it isolated to one tick function" treatment as the
// Tank shield and Meeps dodge house rules.
import { describe, it, expect } from "vitest";
import { Mission } from "../mission";
import { MISSION_1A } from "../../data/campaign";
import { MUNTI_REGEN_RADIUS, MUNTI_REGEN_PER_TURN } from "../../data/combatTables";
import { COMBAT_MEDIC_REGEN_RADIUS, COMBAT_MEDIC_REGEN_MULTIPLIER } from "../../data/weaponBranches";
import { MEK_TRACK_EFFECTS } from "../../data/meks";

// Barasj's mek (data/meks.ts, the Team One slice MISSION_1A deploys) is
// Fieldwright-PRIMARY — and since 6 Sep 2026 that track's stationary heal
// is real (engine/mission.ts's tickStationaryRepair): a Munti who didn't
// move this turn heals its own +15 on top of the aura's +8. The two
// self-heal tests below deliberately leave him stationary and assert the
// SUM, so the stacking rule ("auras don't stack with auras; the mek's own
// heal is not an aura") is pinned here rather than assumed.
const BARASJ_STATIONARY_HEAL = MEK_TRACK_EFFECTS.fieldwright.primary.stationaryHeal;

describe("Mission — Munti passive regen tick", () => {
  // Same rationale as shield.test.ts: mission 1a is eliminate_all, so
  // fully clearing the hostile side instantly wins the mission and skips
  // environmentStep. Keep one hostile alive but stripped of the ability to
  // move or attack, and re-neutralize after each turn to catch mission
  // 1a's scripted turn-4 ambush before it can act.
  function neutralizeHostiles(mission: Mission) {
    const hostiles = mission.units.filter((u) => u.side === "hostile" && !u.downed);
    const [keep, ...rest] = hostiles;
    for (const u of rest) u.downed = true;
    if (keep) {
      keep.moveRange = 0;
      keep.attackRange = [99, 99];
      keep.pos = { x: 0, y: 0 };
    }
  }

  it("heals a damaged ally within radius, capped at maxHp", () => {
    const mission = new Mission(MISSION_1A);
    neutralizeHostiles(mission);
    const munti = mission.units.find((u) => u.pilotId === "pilot_barasj")!;
    const ally = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    munti.pos = { x: 5, y: 5 };
    ally.pos = { x: 6, y: 5 }; // distance 1, within radius 2
    ally.currentHp = ally.maxHp - 3; // less than the regen amount — should cap, not overheal

    mission.endPlayerTurn();
    expect(ally.currentHp).toBe(ally.maxHp);
  });

  it("heals for the flat amount when the deficit is larger than one tick", () => {
    const mission = new Mission(MISSION_1A);
    neutralizeHostiles(mission);
    const munti = mission.units.find((u) => u.pilotId === "pilot_barasj")!;
    const ally = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    munti.pos = { x: 5, y: 5 };
    ally.pos = { x: 7, y: 5 }; // distance 2 — right at the radius edge
    const hpBefore = ally.maxHp - 50;
    ally.currentHp = hpBefore;

    mission.endPlayerTurn();
    expect(ally.currentHp).toBe(hpBefore + MUNTI_REGEN_PER_TURN);
  });

  it("does not heal an ally outside the radius", () => {
    const mission = new Mission(MISSION_1A);
    neutralizeHostiles(mission);
    const munti = mission.units.find((u) => u.pilotId === "pilot_barasj")!;
    const ally = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    munti.pos = { x: 5, y: 5 };
    ally.pos = { x: 5 + MUNTI_REGEN_RADIUS + 1, y: 5 }; // one tile past the radius
    const hpBefore = ally.maxHp - 20;
    ally.currentHp = hpBefore;

    mission.endPlayerTurn();
    expect(ally.currentHp).toBe(hpBefore);
  });

  it("heals the Munti itself too, not just allies", () => {
    const mission = new Mission(MISSION_1A);
    neutralizeHostiles(mission);
    const munti = mission.units.find((u) => u.pilotId === "pilot_barasj")!;
    munti.pos = { x: 5, y: 5 };
    const hpBefore = munti.maxHp - 40;
    munti.currentHp = hpBefore;

    mission.endPlayerTurn();
    expect(munti.stationaryHeal).toBe(BARASJ_STATIONARY_HEAL);
    expect(munti.currentHp).toBe(hpBefore + MUNTI_REGEN_PER_TURN + BARASJ_STATIONARY_HEAL);
  });

  it("stacks with — doesn't replace — the active Repair ability in the same turn", () => {
    const mission = new Mission(MISSION_1A);
    neutralizeHostiles(mission);
    const munti = mission.units.find((u) => u.pilotId === "pilot_barasj")!;
    const ally = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    munti.pos = { x: 5, y: 5 };
    ally.pos = { x: 6, y: 5 };
    ally.currentHp = ally.maxHp - 60;

    const repairResult = mission.repairUnit(munti.instanceId, ally.instanceId);
    expect(repairResult).not.toBeNull();
    const afterRepair = ally.currentHp;

    mission.endPlayerTurn();
    expect(ally.currentHp).toBe(Math.min(ally.maxHp, afterRepair + MUNTI_REGEN_PER_TURN));
  });

  it("does not touch a full-HP ally", () => {
    const mission = new Mission(MISSION_1A);
    neutralizeHostiles(mission);
    const munti = mission.units.find((u) => u.pilotId === "pilot_barasj")!;
    const ally = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    munti.pos = { x: 5, y: 5 };
    ally.pos = { x: 6, y: 5 };
    expect(ally.currentHp).toBe(ally.maxHp);

    mission.endPlayerTurn();
    expect(ally.currentHp).toBe(ally.maxHp);
  });

  // Aegis Ward used to have its own pair of tests here (radius-only bump,
  // 1 Sep 2026) — cut 12 Sep 2026, a strict subset of Combat Medic below:
  // same radius formula, plus triple the healing on top. See
  // data/weaponBranches.ts's own header for the full account.

  // Combat Medic (Munti's flagship support branch, Weapon Branch Point
  // System, data/weaponBranches.ts, 5 Sep 2026, Maxime's own design:
  // "triple passive regen. to those within 3 tile of themself"). This
  // branch scales BOTH the tickMuntiRegen aura's radius (to
  // COMBAT_MEDIC_REGEN_RADIUS) and its healing amount (triple) at once.
  it("Combat Medic heals for triple the flat amount within its own radius", () => {
    const mission = new Mission(MISSION_1A);
    neutralizeHostiles(mission);
    const munti = mission.units.find((u) => u.pilotId === "pilot_barasj")!;
    const ally = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    munti.weaponBranchId = "munti_combat_medic";
    munti.pos = { x: 5, y: 5 };
    ally.pos = { x: 5 + COMBAT_MEDIC_REGEN_RADIUS, y: 5 }; // right at the edge of Combat Medic's own radius
    const hpBefore = ally.maxHp - 50;
    ally.currentHp = hpBefore;

    mission.endPlayerTurn();
    expect(ally.currentHp).toBe(hpBefore + MUNTI_REGEN_PER_TURN * COMBAT_MEDIC_REGEN_MULTIPLIER);
  });

  it("Combat Medic does not reach one tile past its own radius", () => {
    const mission = new Mission(MISSION_1A);
    neutralizeHostiles(mission);
    const munti = mission.units.find((u) => u.pilotId === "pilot_barasj")!;
    const ally = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    munti.weaponBranchId = "munti_combat_medic";
    munti.pos = { x: 5, y: 5 };
    ally.pos = { x: 5 + COMBAT_MEDIC_REGEN_RADIUS + 1, y: 5 };
    const hpBefore = ally.maxHp - 50;
    ally.currentHp = hpBefore;

    mission.endPlayerTurn();
    expect(ally.currentHp).toBe(hpBefore);
  });

  it("Combat Medic caps at maxHp, same as the plain aura", () => {
    const mission = new Mission(MISSION_1A);
    neutralizeHostiles(mission);
    const munti = mission.units.find((u) => u.pilotId === "pilot_barasj")!;
    const ally = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    munti.weaponBranchId = "munti_combat_medic";
    munti.pos = { x: 5, y: 5 };
    ally.pos = { x: 6, y: 5 };
    ally.currentHp = ally.maxHp - 5; // smaller deficit than even the plain tick

    mission.endPlayerTurn();
    expect(ally.currentHp).toBe(ally.maxHp);
  });

  it("heals the Combat Medic Munti itself too, not just allies", () => {
    const mission = new Mission(MISSION_1A);
    neutralizeHostiles(mission);
    const munti = mission.units.find((u) => u.pilotId === "pilot_barasj")!;
    munti.weaponBranchId = "munti_combat_medic";
    munti.pos = { x: 5, y: 5 };
    const hpBefore = munti.maxHp - 60;
    munti.currentHp = hpBefore;

    mission.endPlayerTurn();
    expect(munti.currentHp).toBe(hpBefore + MUNTI_REGEN_PER_TURN * COMBAT_MEDIC_REGEN_MULTIPLIER + BARASJ_STATIONARY_HEAL);
  });

  it("takes the best applicable amount, not a sum, when a plain Munti and a Combat Medic Munti are both in range", () => {
    const mission = new Mission(MISSION_1A);
    neutralizeHostiles(mission);
    const combatMedic = mission.units.find((u) => u.pilotId === "pilot_barasj")!;
    const plainMunti = mission.units.find((u) => u.path === "munti" && u.pilotId !== "pilot_barasj");
    const ally = mission.units.find((u) => u.pilotId === "pilot_nagori")!;
    combatMedic.weaponBranchId = "munti_combat_medic";
    combatMedic.pos = { x: 5, y: 5 };
    ally.pos = { x: 6, y: 5 };
    if (plainMunti) plainMunti.pos = { x: 6, y: 6 }; // also in range of ally, if a second Munti exists on this map
    const hpBefore = ally.maxHp - 50;
    ally.currentHp = hpBefore;

    mission.endPlayerTurn();
    expect(ally.currentHp).toBe(hpBefore + MUNTI_REGEN_PER_TURN * COMBAT_MEDIC_REGEN_MULTIPLIER);
  });
});
