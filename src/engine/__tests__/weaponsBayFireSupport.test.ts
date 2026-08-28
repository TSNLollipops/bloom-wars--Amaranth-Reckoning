// Weapons Bay's bonus Fire Support charge (28 Aug 2026, Antfarm buildable-
// bay pass #2 — see claude/Bloom_Wars_Antfarm_Carrier_Hub_v1.md §11.2 and
// data/combatTables.ts's own WEAPONS_BAY_FIRE_SUPPORT_COOLDOWN_TURNS
// comment for the design). Split into its own file rather than folded into
// abilities.test.ts's "abil_fire_support" section because abil_fire_support
// itself has no dedicated describe block there yet — this is that ability's
// first real test coverage, not an addition to existing coverage.
//
// House test style (see abilities.test.ts): a real Mission built from a
// real mission def, direct unit mutation to isolate one scenario on an
// otherwise quiet board. abil_fire_support is squad-wide from Mission 14
// ("Steel Rain") on, so every test here builds on AMARANTH_MISSION_14
// rather than Mission 1.
import { describe, it, expect } from "vitest";
import { Mission } from "../mission";
import { AMARANTH_MISSION_14 } from "../../data/campaignAmaranth";
import { createHostileMechUnit, type BattleUnit } from "../units";
import { FIRE_SUPPORT_CHARGES_PER_MISSION, WEAPONS_BAY_FIRE_SUPPORT_COOLDOWN_TURNS } from "../../data/combatTables";
import type { ReservedBayId } from "../campaignState";

/**
 * Mirrors abilities.test.ts's quietMission(), built on Mission 14 (where
 * abil_fire_support is actually granted) and optionally with builtBays
 * passed to the constructor. Unlike abilities.test.ts's own PARK (a
 * hand-written per-pilot map, sized for Act I's 5-pilot roster), Act II's
 * default squad carries 10 pilots (ACT2_DEFAULT_SQUAD) — parking by index
 * along row y=0 rather than by name avoids needing to enumerate all 10 and
 * silently mis-parking (pos.x/y undefined) whichever ones aren't listed.
 */
function quietMission14(builtBays: ReservedBayId[] = []): Mission {
  const mission = new Mission(AMARANTH_MISSION_14, undefined, builtBays);
  let i = 0;
  for (const u of mission.units) {
    if (u.side === "hostile") u.downed = true;
    else u.pos = { x: i++, y: 0 };
  }
  const keeper = createHostileMechUnit("hostile_mech_01", { x: 19, y: 11 });
  keeper.vision = 0;
  keeper.moveRange = 0;
  mission.units.push(keeper);
  return mission;
}

function pilot(mission: Mission, pilotId: string, pos?: { x: number; y: number }): BattleUnit {
  const u = mission.units.find((x) => x.pilotId === pilotId)!;
  if (pos) u.pos = { ...pos };
  return u;
}

const logsMatching = (mission: Mission, needle: string) => mission.log.filter((l) => l.includes(needle));

describe("Weapons Bay's bonus Fire Support charge", () => {
  it("BASELINE UNCHANGED: without the bay built, exhausting the charge pool refuses fireSupport exactly as before", () => {
    const mission = quietMission14(); // no builtBays at all
    const rourke = pilot(mission, "pilot_rourke", { x: 9, y: 1 });
    expect(rourke.abilities).toContain("abil_fire_support");

    for (let i = 0; i < FIRE_SUPPORT_CHARGES_PER_MISSION; i++) {
      rourke.actionsRemaining = 1;
      expect(mission.canFireSupport(rourke.instanceId)).toBe(true);
      expect(mission.fireSupport(rourke.instanceId, { x: 9, y: 1 })).not.toBeNull();
    }
    expect(mission.fireSupportChargesRemaining).toBe(0);

    rourke.actionsRemaining = 1;
    expect(mission.canFireSupport(rourke.instanceId)).toBe(false);
    expect(mission.fireSupport(rourke.instanceId, { x: 9, y: 1 })).toBeNull();
    // ...and waiting out turns doesn't change that — same as the baseline
    // flat-pool behavior always had, bay or no bay.
    for (let t = 0; t < 5; t++) mission.endPlayerTurn();
    rourke.actionsRemaining = 1;
    expect(mission.canFireSupport(rourke.instanceId)).toBe(false);
  });

  it("with sensorArray/beaconControl/generator/restockRoom built but NOT weaponsBay, behaves exactly as unbuilt", () => {
    const mission = quietMission14(["sensorArray", "beaconControl", "generator", "restockRoom"]);
    const rourke = pilot(mission, "pilot_rourke", { x: 9, y: 1 });
    for (let i = 0; i < FIRE_SUPPORT_CHARGES_PER_MISSION; i++) {
      rourke.actionsRemaining = 1;
      mission.fireSupport(rourke.instanceId, { x: 9, y: 1 });
    }
    rourke.actionsRemaining = 1;
    expect(mission.fireSupportBonusChargeReady()).toBe(false);
    expect(mission.canFireSupport(rourke.instanceId)).toBe(false);
  });

  it("WITH the bay built: a bonus charge opens up once the baseline pool is spent", () => {
    const mission = quietMission14(["weaponsBay"]);
    const rourke = pilot(mission, "pilot_rourke", { x: 9, y: 1 });

    // While baseline charges remain, the bonus gate is irrelevant — spending
    // still draws from fireSupportChargesRemaining first.
    rourke.actionsRemaining = 1;
    mission.fireSupport(rourke.instanceId, { x: 9, y: 1 });
    expect(mission.fireSupportChargesRemaining).toBe(FIRE_SUPPORT_CHARGES_PER_MISSION - 1);
    expect(mission.fireSupportBonusChargeReady()).toBe(true); // built, cooldown never started yet

    rourke.actionsRemaining = 1;
    mission.fireSupport(rourke.instanceId, { x: 9, y: 1 });
    expect(mission.fireSupportChargesRemaining).toBe(0);

    // Baseline exhausted, bay built, cooldown not yet started: the bonus
    // charge is usable right now.
    rourke.actionsRemaining = 1;
    expect(mission.canFireSupport(rourke.instanceId)).toBe(true);
    const out = mission.fireSupport(rourke.instanceId, { x: 9, y: 1 });
    expect(out).not.toBeNull();
    // Spending it does NOT touch the (already-zero) baseline pool.
    expect(mission.fireSupportChargesRemaining).toBe(0);
    expect(logsMatching(mission, "Weapons Bay's reserve line").length).toBe(1);

    // Immediately after, it's on cooldown — refused even with actions to spare.
    rourke.actionsRemaining = 1;
    expect(mission.fireSupportBonusChargeReady()).toBe(false);
    expect(mission.canFireSupport(rourke.instanceId)).toBe(false);
    expect(mission.fireSupport(rourke.instanceId, { x: 9, y: 1 })).toBeNull();
  });

  it("the bonus charge's cooldown actually elapses after WEAPONS_BAY_FIRE_SUPPORT_COOLDOWN_TURNS turns", () => {
    const mission = quietMission14(["weaponsBay"]);
    const rourke = pilot(mission, "pilot_rourke", { x: 9, y: 1 });

    for (let i = 0; i < FIRE_SUPPORT_CHARGES_PER_MISSION; i++) {
      rourke.actionsRemaining = 1;
      mission.fireSupport(rourke.instanceId, { x: 9, y: 1 });
    }
    rourke.actionsRemaining = 1;
    mission.fireSupport(rourke.instanceId, { x: 9, y: 1 }); // spends the bonus charge, starts its cooldown
    const readyAtTurn = mission.turn + WEAPONS_BAY_FIRE_SUPPORT_COOLDOWN_TURNS;

    for (let t = mission.turn; t < readyAtTurn; t++) {
      rourke.actionsRemaining = 1;
      expect(mission.canFireSupport(rourke.instanceId)).toBe(false);
      mission.endPlayerTurn();
    }

    expect(mission.turn).toBe(readyAtTurn);
    rourke.actionsRemaining = 1;
    expect(mission.fireSupportBonusChargeReady()).toBe(true);
    expect(mission.canFireSupport(rourke.instanceId)).toBe(true);
    expect(mission.fireSupport(rourke.instanceId, { x: 9, y: 1 })).not.toBeNull();
  });

  it("a hostile squad member never draws the bonus charge either — the side guard still runs first", () => {
    const mission = quietMission14(["weaponsBay"]);
    const hostile = createHostileMechUnit("hostile_mech_02", { x: 15, y: 8 });
    hostile.abilities = ["abil_fire_support"];
    mission.units.push(hostile);
    expect(mission.canFireSupport(hostile.instanceId)).toBe(false);
    expect(mission.fireSupport(hostile.instanceId, { x: 15, y: 8 })).toBeNull();
  });
});
