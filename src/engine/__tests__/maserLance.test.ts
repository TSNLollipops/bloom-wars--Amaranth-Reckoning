// abil_maser_lance — Tank's 3rd weapon branch (Maxime, 5 Sep 2026, SOFT
// pass; see data/abilities.ts's own comment for the full design context: a
// three-question AskUserQuestion round, all three resolved to the
// recommended option — a separate granted ability, a real expanding cone
// picked from one of 8 directions, and friendly-fire capable with no side
// filter).
//
// Same "splash shouldn't be dodgable" / "the counter shouldn't be FF able"
// house rules abil_missile already established (see missileStrike.test.ts's
// own header for the original correction) — Maser Lance reuses both
// verbatim rather than re-deriving them, since a cone already covering its
// whole footprint isn't a single aimed shot to step out of any more than a
// missile's blast radius is.
//
// House test style (see missileStrike.test.ts / gjallarRequiem.test.ts):
// real Mission objects built from a real mission def, with direct unit
// mutation to isolate one scenario on an otherwise quiet board. The cone-
// geometry tests below borrow gjallarRequiem.test.ts's own "assert the
// exact tile array" style for its own direction-picking coverage, since
// this is this engine's first OTHER direction-picked shape after Requiem's
// line.
import { describe, it, expect, vi, afterEach } from "vitest";
import { Mission } from "../mission";
import { AMARANTH_MISSION_1 } from "../../data/campaignAmaranth";
import { createHostileMechUnit, createBloomUnit, createPlayerUnit, type BattleUnit } from "../units";
import { findPilot } from "../../data/pilotRegistry";
import { MAX_ACTIONS_PER_TURN, MASER_LANCE_CONE_RANGE, MASER_LANCE_CHARGES_PER_MISSION } from "../../data/combatTables";
import { createWardenCampaignState } from "../campaignState";
import { purchaseWeaponBranch, equipWeaponBranch } from "../campaignEconomy";
import { WEAPON_BRANCH_COSTS, WEAPON_BRANCH_TIER_GATE, MASER_LANCE_GRANT_ABILITY } from "../../data/weaponBranches";

// Mirrors missileStrike.test.ts's own PARK/quietMission/pilot/logsMatching —
// duplicated rather than imported, matching this test suite's established
// per-file convention.
const PARK: Record<string, { x: number; y: number }> = {
  pilot_rourke: { x: 0, y: 0 },
  pilot_bosk: { x: 1, y: 0 },
  pilot_iyari: { x: 2, y: 0 },
  pilot_anand: { x: 3, y: 0 },
  pilot_lask: { x: 4, y: 0 },
};

function quietMission(): Mission {
  const mission = new Mission(AMARANTH_MISSION_1);
  for (const u of mission.units) {
    if (u.side === "hostile") u.downed = true;
    else u.pos = { ...PARK[u.pilotId!] };
  }
  const keeper = createHostileMechUnit("hostile_mech_01", { x: 19, y: 11 });
  keeper.vision = 0; // sees nothing, so decideHostileAction returns {} — never moves, never shoots
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

// =====================================================================
// createPlayerUnit — the granted-ability wiring itself
// =====================================================================

describe("createPlayerUnit — tank_maser_lance grants abil_maser_lance (engine/units.ts)", () => {
  it("grants abil_maser_lance and a full charge budget when equipped, and grants neither when unequipped or on a different branch", () => {
    const base = findPilot("pilot_bosk")!; // Tank archetype
    const equipped = { ...base, equippedWeaponBranch: "tank_maser_lance" };
    const unit = createPlayerUnit("pilot_bosk", { x: 0, y: 0 }, { pilot: equipped });
    expect(unit.abilities).toContain("abil_maser_lance");
    expect(unit.abilities).toContain(MASER_LANCE_GRANT_ABILITY);
    expect(unit.maserLanceUsesRemaining).toBe(MASER_LANCE_CHARGES_PER_MISSION);

    const noBranch = createPlayerUnit("pilot_bosk", { x: 0, y: 0 }, { pilot: base });
    expect(noBranch.abilities).not.toContain("abil_maser_lance");

    const otherBranch = { ...base, equippedWeaponBranch: "tank_riot_drum" };
    const riotDrum = createPlayerUnit("pilot_bosk", { x: 0, y: 0 }, { pilot: otherBranch });
    expect(riotDrum.abilities).not.toContain("abil_maser_lance");
  });
});

describe("Mission.maserLanceStrike (abil_maser_lance — Tank)", () => {
  // =====================================================================
  // Refusal cases
  // =====================================================================

  it("refuses a unit without the ability, a spent unit, a downed unit, an unknown id, and any hostile", () => {
    const mission = quietMission();
    const bosk = pilot(mission, "pilot_bosk", { x: 4, y: 6 });
    const rourke = pilot(mission, "pilot_rourke", { x: 5, y: 6 }); // no abil_maser_lance granted

    expect(rourke.abilities).not.toContain("abil_maser_lance");
    expect(mission.canMaserLanceStrike(rourke.instanceId)).toBe(false);
    expect(mission.maserLanceStrike(rourke.instanceId, { x: 7, y: 6 })).toBeNull();

    bosk.abilities = [...bosk.abilities, "abil_maser_lance"];
    expect(mission.canMaserLanceStrike(bosk.instanceId)).toBe(true);

    bosk.actionsRemaining = 0;
    expect(mission.canMaserLanceStrike(bosk.instanceId)).toBe(false);
    expect(mission.maserLanceStrike(bosk.instanceId, { x: 7, y: 6 })).toBeNull();
    bosk.actionsRemaining = MAX_ACTIONS_PER_TURN;

    bosk.downed = true;
    expect(mission.canMaserLanceStrike(bosk.instanceId)).toBe(false);
    expect(mission.maserLanceStrike(bosk.instanceId, { x: 7, y: 6 })).toBeNull();
    bosk.downed = false;

    expect(mission.canMaserLanceStrike("nonexistent_unit")).toBe(false);
    expect(mission.maserLanceStrike("nonexistent_unit", { x: 7, y: 6 })).toBeNull();

    const hostile = createHostileMechUnit("hostile_mech_03", { x: 9, y: 6 }); // Tank-path hostile
    hostile.abilities = [...hostile.abilities, "abil_maser_lance"]; // even forced on, side gates it first
    mission.units.push(hostile);
    expect(mission.canMaserLanceStrike(hostile.instanceId)).toBe(false);
    expect(mission.maserLanceStrike(hostile.instanceId, { x: 7, y: 6 })).toBeNull();
  });

  // =====================================================================
  // Cone geometry — getMaserLanceDirectionTargets / previewMaserLanceCone
  // =====================================================================

  describe("cone geometry", () => {
    it("cardinal fire: a widening wedge along +x, 1/3/5 tiles at forward-steps 1/2/3, origin's own tile excluded", () => {
      expect(MASER_LANCE_CONE_RANGE).toBe(3); // pins the actual request to the test
      const mission = quietMission();
      const bosk = pilot(mission, "pilot_bosk", { x: 4, y: 6 });
      bosk.abilities = [...bosk.abilities, "abil_maser_lance"];

      const preview = mission.previewMaserLanceCone(bosk.instanceId, { x: 8, y: 6 }); // any tile due east selects +x
      expect(preview).toEqual([
        { x: 5, y: 6 },
        { x: 6, y: 5 },
        { x: 6, y: 6 },
        { x: 6, y: 7 },
        { x: 7, y: 4 },
        { x: 7, y: 5 },
        { x: 7, y: 6 },
        { x: 7, y: 7 },
        { x: 7, y: 8 },
      ]);
      expect(preview).not.toContainEqual(bosk.pos); // the wielder's own tile is never part of its own cone
    });

    it("diagonal fire widens across the OTHER diagonal — the same perpendicular-offset formula, not a special case", () => {
      const mission = quietMission();
      const bosk = pilot(mission, "pilot_bosk", { x: 10, y: 5 });
      bosk.abilities = [...bosk.abilities, "abil_maser_lance"];

      const preview = mission.previewMaserLanceCone(bosk.instanceId, { x: 11, y: 6 }); // down-right diagonal
      expect(preview).toEqual([
        { x: 11, y: 6 },
        { x: 13, y: 6 },
        { x: 12, y: 7 },
        { x: 11, y: 8 },
        { x: 15, y: 6 },
        { x: 14, y: 7 },
        { x: 13, y: 8 },
        { x: 12, y: 9 },
        { x: 11, y: 10 },
      ]);
    });

    it("clips at the board edge rather than erroring — a partial cone near a corner, not a crash", () => {
      const mission = quietMission(); // map_amaranth_muster is 20 wide x 12 tall (0..19, 0..11)
      const bosk = pilot(mission, "pilot_bosk", { x: 1, y: 1 });
      bosk.abilities = [...bosk.abilities, "abil_maser_lance"];

      const preview = mission.previewMaserLanceCone(bosk.instanceId, { x: 0, y: 0 }); // up-left diagonal, straight into the corner
      expect(preview).toEqual([{ x: 0, y: 0 }]); // step 1 survives; every step-2 tile falls off-board
    });

    it("rejects a click that isn't a legal cardinal/diagonal direction from the wielder", () => {
      const mission = quietMission();
      const bosk = pilot(mission, "pilot_bosk", { x: 5, y: 5 });
      bosk.abilities = [...bosk.abilities, "abil_maser_lance"];

      expect(mission.previewMaserLanceCone(bosk.instanceId, { x: 8, y: 6 })).toBeNull();
      expect(mission.maserLanceStrike(bosk.instanceId, { x: 8, y: 6 })).toBeNull();
    });

    it("getMaserLanceDirectionTargets enumerates all 8 directions out to the board edge, and empties once unusable", () => {
      const mission = quietMission();
      const bosk = pilot(mission, "pilot_bosk", { x: 18, y: 5 });
      bosk.abilities = [...bosk.abilities, "abil_maser_lance"];

      const targets = mission.getMaserLanceDirectionTargets(bosk.instanceId);
      expect(targets.some((c) => c.x === 19 && c.y === 5)).toBe(true); // +x only reaches the board edge, one tile
      expect(targets.some((c) => c.x === 20)).toBe(false);
      expect(targets.filter((c) => c.y === 5 && c.x < 18).length).toBeGreaterThan(1); // -x has plenty of room

      bosk.actionsRemaining = 0;
      expect(mission.getMaserLanceDirectionTargets(bosk.instanceId)).toEqual([]);
    });
  });

  // =====================================================================
  // Splash — friendly fire, cone boundary, Bloom targets
  // =====================================================================

  it("hits everyone inside the cone regardless of side, and no one outside it", () => {
    const mission = quietMission();
    const bosk = pilot(mission, "pilot_bosk", { x: 4, y: 6 });
    bosk.abilities = [...bosk.abilities, "abil_maser_lance"];
    const target = { x: 8, y: 6 }; // selects +x — cone tiles per the geometry test above

    const ally = pilot(mission, "pilot_anand", { x: 6, y: 7 }); // inside the cone (step 2, lateral +1)
    const hostileNear = createHostileMechUnit("hostile_mech_01", { x: 7, y: 6 }); // inside the cone (step 3, lateral 0)
    mission.units.push(hostileNear);
    const allyOutside = pilot(mission, "pilot_iyari", { x: 6, y: 8 }); // just outside the cone
    const hostileOutside = createHostileMechUnit("hostile_mech_02", { x: 5, y: 7 }); // just outside the cone
    mission.units.push(hostileOutside);

    const [allyHpBefore, hostileNearHpBefore, allyOutsideHpBefore, hostileOutsideHpBefore] = [
      ally.currentHp,
      hostileNear.currentHp,
      allyOutside.currentHp,
      hostileOutside.currentHp,
    ];

    const result = mission.maserLanceStrike(bosk.instanceId, target);
    expect(result).not.toBeNull();
    expect(result!.hitIds).toContain(ally.instanceId);
    expect(result!.hitIds).toContain(hostileNear.instanceId);
    expect(result!.hitIds).not.toContain(allyOutside.instanceId);
    expect(result!.hitIds).not.toContain(hostileOutside.instanceId);

    expect(ally.currentHp).toBeLessThan(allyHpBefore); // friendly fire actually lands
    expect(hostileNear.currentHp).toBeLessThan(hostileNearHpBefore);
    expect(allyOutside.currentHp).toBe(allyOutsideHpBefore);
    expect(hostileOutside.currentHp).toBe(hostileOutsideHpBefore);
    expect(logsMatching(mission, "fires Maser Lance").length).toBe(1);
  });

  it("a Bloom-shape target in the cone takes damage through resolveAttackOnBloom/applyBloomDamage", () => {
    const mission = quietMission();
    const bosk = pilot(mission, "pilot_bosk", { x: 4, y: 6 });
    bosk.abilities = [...bosk.abilities, "abil_maser_lance"];
    const target = { x: 8, y: 6 };
    const bloom = createBloomUnit("bloom_crawlmass", { x: 7, y: 6 }); // inside the cone
    mission.units.push(bloom);
    const hpBefore = bloom.currentHp;

    const result = mission.maserLanceStrike(bosk.instanceId, target);
    expect(result!.hitIds).toContain(bloom.instanceId);
    expect(bloom.currentHp).toBeLessThan(hpBefore);
  });

  it("the wielder's own tile is never in the cone footprint, by construction (step starts at 1, not 0)", () => {
    const mission = quietMission();
    const bosk = pilot(mission, "pilot_bosk", { x: 4, y: 6 });
    bosk.abilities = [...bosk.abilities, "abil_maser_lance"];
    const boskHpBefore = bosk.currentHp;

    const result = mission.maserLanceStrike(bosk.instanceId, { x: 8, y: 6 });
    expect(result!.hitIds).not.toContain(bosk.instanceId);
    expect(bosk.currentHp).toBe(boskHpBefore); // untouched by its own shot
  });

  // =====================================================================
  // Charges — per-unit, whole-action-budget, no refill
  // =====================================================================

  it("is a per-unit budget, not squad-shared: MASER_LANCE_CHARGES_PER_MISSION uses, whole action budget + ends the turn each time, and time does not refill it", () => {
    expect(MASER_LANCE_CHARGES_PER_MISSION).toBe(2); // pins the actual request to the test
    const mission = quietMission();
    const bosk = pilot(mission, "pilot_bosk", { x: 4, y: 6 });
    bosk.abilities = [...bosk.abilities, "abil_maser_lance"];
    const lask = pilot(mission, "pilot_lask", { x: 10, y: 6 }); // second unit, own independent charge pool
    lask.abilities = [...lask.abilities, "abil_maser_lance"];
    const target = { x: 8, y: 6 }; // empty cone — an intentionally wasted call

    expect(mission.maserLanceChargesRemaining(bosk.instanceId)).toBe(MASER_LANCE_CHARGES_PER_MISSION);

    expect(mission.maserLanceStrike(bosk.instanceId, target)).not.toBeNull();
    expect(mission.maserLanceChargesRemaining(bosk.instanceId)).toBe(1);
    expect(bosk.actionsRemaining).toBe(0); // whole action budget, not just 1 action
    expect(mission.canMaserLanceStrike(bosk.instanceId)).toBe(false); // no actions left this turn, charge or no charge

    // lask's own pool is untouched by bosk's use — not a shared squad pool.
    expect(mission.maserLanceChargesRemaining(lask.instanceId)).toBe(MASER_LANCE_CHARGES_PER_MISSION);

    mission.endPlayerTurn(); // turn 1's hostile phase, then turn 2 begins
    expect(mission.turn).toBe(2);

    expect(mission.maserLanceStrike(bosk.instanceId, target)).not.toBeNull();
    expect(mission.maserLanceChargesRemaining(bosk.instanceId)).toBe(0);
    expect(mission.canMaserLanceStrike(bosk.instanceId)).toBe(false); // out of charges now, not just out of actions

    // Unlike a cooldown, turns passing do not bring a charge back.
    for (let t = 0; t < 5; t++) mission.endPlayerTurn();
    expect(mission.maserLanceChargesRemaining(bosk.instanceId)).toBe(0);
    expect(mission.maserLanceStrike(bosk.instanceId, target)).toBeNull();

    // lask's independent pool is STILL untouched.
    expect(mission.maserLanceChargesRemaining(lask.instanceId)).toBe(MASER_LANCE_CHARGES_PER_MISSION);
  });

  // =====================================================================
  // The dodge house rule — "splash shouldn't be dodgable" (mirrors
  // missileStrike.test.ts's own correction, reused verbatim for this shape)
  // =====================================================================

  describe("splash and the Meeps dodge house rule", () => {
    afterEach(() => vi.restoreAllMocks());

    it("a forced low Math.random() roll does NOT let a Meeps victim dodge the cone hit", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.01); // well under MEEPS_DODGE_CHANCE (0.4) — would dodge a normal attack, see dodge.test.ts
      const mission = quietMission();
      const bosk = pilot(mission, "pilot_bosk", { x: 4, y: 6 });
      bosk.abilities = [...bosk.abilities, "abil_maser_lance"];
      const target = { x: 8, y: 6 };
      const meepsVictim = createHostileMechUnit("hostile_mech_02", { x: 7, y: 6 }); // Meeps-path, inside the cone
      meepsVictim.canCounter = false; // isolate the primary-hit dodge from any counter noise
      mission.units.push(meepsVictim);
      const hpBefore = meepsVictim.currentHp;

      const result = mission.maserLanceStrike(bosk.instanceId, target);
      expect(result!.hitIds).toContain(meepsVictim.instanceId);
      expect(meepsVictim.currentHp).toBeLessThan(hpBefore); // the hit landed — no dodge, despite the forced-low roll
    });

    it("does not touch the SEPARATE counter-dodge roll: a surviving victim's counter is still a real, independently-rolled hit", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.01); // well under MEEPS_DODGE_CHANCE
      const mission = quietMission();
      // The attacker herself needs to be Meeps-path for rollMeepsDodge to
      // ever return true for HER — same engine-level hand-grant missileStrike.
      // test.ts's identical test already establishes, not gated by path in
      // code.
      const rourke = pilot(mission, "pilot_rourke", { x: 4, y: 6 });
      rourke.abilities = [...rourke.abilities, "abil_maser_lance"];
      const target = { x: 8, y: 6 };
      // hostile_mech_02 is Meeps-path (not Tank) deliberately: House rule
      // #1b (dodge.test.ts) means a Meeps can never dodge a hit whose
      // SOURCE is a Tank, which would make this counter undodgeable no
      // matter what Math.random returns. Placed at the cone's own step-1
      // tile — the only tile adjacent to rourke, so its own counter is
      // geometrically live (within its counterMaxRange), not just present.
      const meepsVictim = createHostileMechUnit("hostile_mech_02", { x: 5, y: 6 });
      mission.units.push(meepsVictim);
      const [rourkeHpBefore, victimHpBefore] = [rourke.currentHp, meepsVictim.currentHp];

      const result = mission.maserLanceStrike(rourke.instanceId, target);
      expect(result!.hitIds).toContain(meepsVictim.instanceId);
      expect(meepsVictim.currentHp).toBeLessThan(victimHpBefore); // primary hit: NOT dodgable, lands as always
      expect(rourke.currentHp).toBe(rourkeHpBefore); // counter hit: dodge roll still real, fully whiffs the counter
      expect(logsMatching(mission, "fires Maser Lance").length).toBe(1);
    });
  });

  // =====================================================================
  // The friendly-counter correction — mirrors missileStrike.test.ts's own
  // "the counter shouldn't be FF able" coverage, reused for this shape
  // =====================================================================

  describe("friendly-fire counters", () => {
    it("a friendly, counter-capable victim caught in the cone takes the primary hit but does NOT counter its own caster", () => {
      const mission = quietMission();
      const bosk = pilot(mission, "pilot_bosk", { x: 4, y: 6 });
      bosk.abilities = [...bosk.abilities, "abil_maser_lance"];
      const target = { x: 8, y: 6 };
      const ally = pilot(mission, "pilot_anand", { x: 5, y: 6 }); // step 1 — inside the cone, adjacent to bosk (within Tank's counterMaxRange)
      ally.canCounter = true;
      const [boskHpBefore, allyHpBefore] = [bosk.currentHp, ally.currentHp];

      const result = mission.maserLanceStrike(bosk.instanceId, target);
      expect(result!.hitIds).toContain(ally.instanceId);
      expect(ally.currentHp).toBeLessThan(allyHpBefore); // the primary cone hit still lands on the ally
      expect(bosk.currentHp).toBe(boskHpBefore); // but the ally's counter never fires back at its own caster
    });

    it("control: a HOSTILE victim in the identical geometry still counters the caster normally — the suppression is side-specific, not a blanket no-counters rule", () => {
      const mission = quietMission();
      const bosk = pilot(mission, "pilot_bosk", { x: 4, y: 6 });
      bosk.abilities = [...bosk.abilities, "abil_maser_lance"];
      const target = { x: 8, y: 6 };
      const hostileVictim = createHostileMechUnit("hostile_mech_01", { x: 5, y: 6 }); // same geometry as the friendly case above
      mission.units.push(hostileVictim);
      const [boskHpBefore, victimHpBefore] = [bosk.currentHp, hostileVictim.currentHp];

      const result = mission.maserLanceStrike(bosk.instanceId, target);
      expect(result!.hitIds).toContain(hostileVictim.instanceId);
      expect(hostileVictim.currentHp).toBeLessThan(victimHpBefore); // primary hit lands
      expect(bosk.currentHp).toBeLessThan(boskHpBefore); // and this one DOES counter back — a real hostile counter is untouched by the fix
    });
  });

  // =====================================================================
  // Damage forecast — forecastMaserLance (the hover-tip readout)
  // =====================================================================

  it("forecastMaserLance reports every victim actually inside the resolved cone, with real per-target damage, and nothing for an illegal direction", () => {
    const mission = quietMission();
    const bosk = pilot(mission, "pilot_bosk", { x: 4, y: 6 });
    bosk.abilities = [...bosk.abilities, "abil_maser_lance"];
    const target = { x: 8, y: 6 };
    const ally = pilot(mission, "pilot_anand", { x: 6, y: 7 }); // inside the cone
    const hostileOutside = createHostileMechUnit("hostile_mech_01", { x: 5, y: 7 }); // just outside
    mission.units.push(hostileOutside);

    const victims = mission.forecastMaserLance(bosk.instanceId, target);
    expect(victims.some((v) => v.unitId === ally.instanceId && v.side === "player" && v.damage > 0)).toBe(true);
    expect(victims.some((v) => v.unitId === hostileOutside.instanceId)).toBe(false);

    expect(mission.forecastMaserLance(bosk.instanceId, { x: 8, y: 7 })).toEqual([]); // not a legal direction from bosk's tile
  });
});

// =====================================================================
// purchaseWeaponBranch / equipWeaponBranch — Maser Lance (Tank's 3rd branch)
// =====================================================================

describe("purchaseWeaponBranch / equipWeaponBranch — Maser Lance (Tank's 3rd branch)", () => {
  it("gates a Tank pilot's 3rd branch (Maser Lance) at WEAPON_BRANCH_TIER_GATE[2] (B), priced at WEAPON_BRANCH_COSTS[2], then equips like any other owned branch", () => {
    const state = createWardenCampaignState();
    state.pilots["pilot_bosk"].pilot.tier = WEAPON_BRANCH_TIER_GATE[2]; // "B" — enough for the 3rd, not gate-blocked
    state.pilots["pilot_bosk"].personalPoints = WEAPON_BRANCH_COSTS[0] + WEAPON_BRANCH_COSTS[1] + WEAPON_BRANCH_COSTS[2];
    purchaseWeaponBranch(state, "pilot_bosk", "tank_grinder_claw");
    purchaseWeaponBranch(state, "pilot_bosk", "tank_riot_drum");
    const third = purchaseWeaponBranch(state, "pilot_bosk", "tank_maser_lance");
    expect(third.ok).toBe(true);
    expect(third.cost).toBe(WEAPON_BRANCH_COSTS[2]);
    expect(state.pilots["pilot_bosk"].personalPoints).toBe(0);
    expect(state.pilots["pilot_bosk"].pilot.ownedWeaponBranches).toEqual(["tank_grinder_claw", "tank_riot_drum", "tank_maser_lance"]);

    const equip = equipWeaponBranch(state, "pilot_bosk", "tank_maser_lance");
    expect(equip.ok).toBe(true);
    expect(state.pilots["pilot_bosk"].pilot.equippedWeaponBranch).toBe("tank_maser_lance");
  });

  it("refuses Maser Lance below tier B even with unlimited points", () => {
    const state = createWardenCampaignState();
    state.pilots["pilot_bosk"].pilot.tier = "A"; // enough for the first two branches (D/C-gated), not gate-blocked
    state.pilots["pilot_bosk"].personalPoints = 100000;
    purchaseWeaponBranch(state, "pilot_bosk", "tank_grinder_claw");
    purchaseWeaponBranch(state, "pilot_bosk", "tank_riot_drum");
    state.pilots["pilot_bosk"].pilot.tier = "C"; // below the 3rd branch's own B gate
    const third = purchaseWeaponBranch(state, "pilot_bosk", "tank_maser_lance");
    expect(third.ok).toBe(false);
    expect(third.reason).toMatch(/needs gear tier B/);
  });

  // Pins the purchase-order design note in data/weaponBranches.ts's own
  // header comment: cost/tier is keyed by HOW MANY branches a pilot already
  // owns, not by which one — verified directly against the live code rather
  // than assumed, so a fresh Tank pilot really can buy Maser Lance FIRST,
  // skipping Grinder Claw/Riot Drum, at the exact same 1st-branch price/gate
  // as either of them. Not a Maser-Lance-specific gap (Shock Claws and Riot
  // Drum are both already buyable first too) — see that comment for why no
  // override was added here.
  it("is buyable as a Tank pilot's very first branch, at the ordinary 1st-branch price and tier gate — not locked behind Grinder Claw/Riot Drum", () => {
    const state = createWardenCampaignState();
    state.pilots["pilot_bosk"].pilot.tier = WEAPON_BRANCH_TIER_GATE[0]; // "D" — the 1st branch's own gate, nothing higher
    state.pilots["pilot_bosk"].personalPoints = WEAPON_BRANCH_COSTS[0];
    expect(state.pilots["pilot_bosk"].pilot.ownedWeaponBranches ?? []).toEqual([]);

    const first = purchaseWeaponBranch(state, "pilot_bosk", "tank_maser_lance");
    expect(first.ok).toBe(true);
    expect(first.cost).toBe(WEAPON_BRANCH_COSTS[0]);
    expect(state.pilots["pilot_bosk"].pilot.ownedWeaponBranches).toEqual(["tank_maser_lance"]);
  });
});
