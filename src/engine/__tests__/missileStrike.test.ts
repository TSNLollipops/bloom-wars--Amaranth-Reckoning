// abil_missile — Reeps' AOE splash weapon (Maxime, 26 Aug 2026, SOFT pass;
// see data/abilities.ts's own comment on abil_missile for the full design
// context: "its a new wespon upgrade path. implement id softly for now. we
// gonna build the upgrade psth later."). Nothing grants this ability to any
// archetype or pilot yet — every test below attaches it to a fixture by
// hand, same bootstrap state abil_fire_support was in before Mission 14.
//
// Correction folded in same-day, before this file existed (Maxime): "spash
// shouldnt be dodgable" — MEEPS_DODGE_CHANCE models a Meeps reading an
// aimed shot and stepping out of its path, which doesn't hold for an
// explosion already covering the whole blast tile. engine/mission.ts's
// missileStrike() hardcodes the PRIMARY hit's dodge roll to false; a
// surviving victim's own counter-shot back at the attacker is unaffected —
// that's its own aimed, single-target hit, not part of the splash, so the
// attacker can still dodge IT normally. The "splash isn't dodgable, but a
// counter off it still can be" test below is the one that actually proves
// the fix landed where it was supposed to and nowhere else.
//
// House test style (see abilities.test.ts / dodge.test.ts): real Mission
// objects built from a real mission def, with direct unit mutation to
// isolate one scenario on an otherwise quiet board.
import { describe, it, expect, vi, afterEach } from "vitest";
import { Mission } from "../mission";
import { AMARANTH_MISSION_1 } from "../../data/campaignAmaranth";
import { createHostileMechUnit, createBloomUnit, type BattleUnit } from "../units";
import { MAX_ACTIONS_PER_TURN, MISSILE_SPLASH_RADIUS, MISSILE_CHARGES_PER_MISSION } from "../../data/combatTables";

// Mirrors abilities.test.ts's PARK/quietMission/pilot/logsMatching — see
// that file's own comments for why each exists. Duplicated rather than
// imported, matching this test suite's established per-file convention.
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
// canMissileStrike / missileStrike — refusal cases
// =====================================================================

describe("Mission.missileStrike (abil_missile — Reeps)", () => {
  it("refuses a unit without the ability, a spent unit, a downed unit, an unknown id, and any hostile", () => {
    const mission = quietMission();
    const anand = pilot(mission, "pilot_anand", { x: 4, y: 6 });
    const rourke = pilot(mission, "pilot_rourke", { x: 5, y: 6 }); // no abil_missile granted

    expect(rourke.abilities).not.toContain("abil_missile");
    expect(mission.canMissileStrike(rourke.instanceId)).toBe(false);
    expect(mission.missileStrike(rourke.instanceId, { x: 7, y: 6 })).toBeNull();

    anand.abilities = [...anand.abilities, "abil_missile"];
    expect(mission.canMissileStrike(anand.instanceId)).toBe(true);

    anand.actionsRemaining = 0;
    expect(mission.canMissileStrike(anand.instanceId)).toBe(false);
    expect(mission.missileStrike(anand.instanceId, { x: 7, y: 6 })).toBeNull();
    anand.actionsRemaining = MAX_ACTIONS_PER_TURN;

    anand.downed = true;
    expect(mission.canMissileStrike(anand.instanceId)).toBe(false);
    expect(mission.missileStrike(anand.instanceId, { x: 7, y: 6 })).toBeNull();
    anand.downed = false;

    expect(mission.canMissileStrike("nonexistent_unit")).toBe(false);
    expect(mission.missileStrike("nonexistent_unit", { x: 7, y: 6 })).toBeNull();

    const hostile = createHostileMechUnit("hostile_mech_04", { x: 9, y: 6 }); // Reeps-path hostile
    hostile.abilities = [...hostile.abilities, "abil_missile"]; // even forced on, side gates it first
    mission.units.push(hostile);
    expect(mission.canMissileStrike(hostile.instanceId)).toBe(false);
    expect(mission.missileStrike(hostile.instanceId, { x: 7, y: 6 })).toBeNull();
  });

  it("refuses a target outside the unit's own attackRange", () => {
    const mission = quietMission();
    const anand = pilot(mission, "pilot_anand", { x: 4, y: 6 });
    anand.abilities = [...anand.abilities, "abil_missile"];
    expect(anand.attackRange).toEqual([2, 4]);

    expect(mission.missileStrike(anand.instanceId, { x: 5, y: 6 })).toBeNull(); // distance 1, under minR
    expect(mission.missileStrike(anand.instanceId, { x: 9, y: 6 })).toBeNull(); // distance 5, over maxR
    expect(mission.missileChargesRemaining(anand.instanceId)).toBe(MISSILE_CHARGES_PER_MISSION); // neither attempt spent a charge
  });

  // =====================================================================
  // getMissileAreaFrom
  // =====================================================================

  it("getMissileAreaFrom returns the clipped attackRange annulus, and empties once unusable", () => {
    const mission = quietMission();
    const anand = pilot(mission, "pilot_anand", { x: 10, y: 6 });
    anand.abilities = [...anand.abilities, "abil_missile"];

    const area = mission.getMissileAreaFrom(anand.instanceId, anand.pos);
    expect(area.length).toBeGreaterThan(0);
    expect(area.every((t) => t.x >= 0 && t.x <= 19 && t.y >= 0 && t.y <= 11)).toBe(true); // map_amaranth_muster is 20x12

    const contains = (t: { x: number; y: number }) => area.some((a) => a.x === t.x && a.y === t.y);
    expect(contains({ x: 13, y: 6 })).toBe(true); // distance 3 — inside [2,4]
    expect(contains({ x: 11, y: 6 })).toBe(false); // distance 1 — under minR
    expect(contains({ x: 10, y: 6 })).toBe(false); // distance 0 — the unit's own tile
    expect(contains({ x: 15, y: 6 })).toBe(false); // distance 5 — over maxR

    anand.actionsRemaining = 0;
    expect(mission.getMissileAreaFrom(anand.instanceId, anand.pos)).toEqual([]);
  });

  // =====================================================================
  // Splash — friendly fire, radius boundary, Bloom targets
  // =====================================================================

  it("hits everyone within MISSILE_SPLASH_RADIUS of the target tile regardless of side, and no one past it", () => {
    expect(MISSILE_SPLASH_RADIUS).toBe(1); // pins the actual request to the test
    const mission = quietMission();
    const anand = pilot(mission, "pilot_anand", { x: 4, y: 6 });
    anand.abilities = [...anand.abilities, "abil_missile"];
    const target = { x: 8, y: 6 }; // distance 4 from anand — inside [2,4]

    const ally = pilot(mission, "pilot_bosk", { x: 8, y: 7 }); // distance 1 from target — friendly fire
    const hostileNear = createHostileMechUnit("hostile_mech_01", { x: 9, y: 6 }); // distance 1 from target
    mission.units.push(hostileNear);
    const allyOutside = pilot(mission, "pilot_iyari", { x: 8, y: 9 }); // distance 2 from target — outside splash
    const hostileOutside = createHostileMechUnit("hostile_mech_02", { x: 6, y: 6 }); // distance 2 from target
    mission.units.push(hostileOutside);

    const [allyHpBefore, hostileNearHpBefore, allyOutsideHpBefore, hostileOutsideHpBefore] = [
      ally.currentHp,
      hostileNear.currentHp,
      allyOutside.currentHp,
      hostileOutside.currentHp,
    ];

    const result = mission.missileStrike(anand.instanceId, target);
    expect(result).not.toBeNull();
    expect(result!.hitIds).toContain(ally.instanceId);
    expect(result!.hitIds).toContain(hostileNear.instanceId);
    expect(result!.hitIds).not.toContain(allyOutside.instanceId);
    expect(result!.hitIds).not.toContain(hostileOutside.instanceId);

    expect(ally.currentHp).toBeLessThan(allyHpBefore); // friendly fire actually lands
    expect(hostileNear.currentHp).toBeLessThan(hostileNearHpBefore);
    expect(allyOutside.currentHp).toBe(allyOutsideHpBefore);
    expect(hostileOutside.currentHp).toBe(hostileOutsideHpBefore);
    expect(logsMatching(mission, "fires a missile").length).toBe(1);
  });

  it("a Bloom-shape target in the blast takes damage through resolveAttackOnBloom/applyBloomDamage", () => {
    const mission = quietMission();
    const anand = pilot(mission, "pilot_anand", { x: 4, y: 6 });
    anand.abilities = [...anand.abilities, "abil_missile"];
    const target = { x: 7, y: 6 }; // distance 3 — inside [2,4]
    const bloom = createBloomUnit("bloom_crawlmass", { x: 7, y: 7 }); // distance 1 from target
    mission.units.push(bloom);
    const hpBefore = bloom.currentHp;

    const result = mission.missileStrike(anand.instanceId, target);
    expect(result!.hitIds).toContain(bloom.instanceId);
    expect(bloom.currentHp).toBeLessThan(hpBefore);
  });

  it("excludes the caster from its own blast even when geometrically within MISSILE_SPLASH_RADIUS of the target", () => {
    const mission = quietMission();
    const anand = pilot(mission, "pilot_anand", { x: 4, y: 6 });
    anand.abilities = [...anand.abilities, "abil_missile"];
    anand.attackRange = [0, 4]; // widened purely to let the target land on her own tile — see test name
    const ally = pilot(mission, "pilot_bosk", { x: 4, y: 7 }); // distance 1 from the target — should still be hit
    // Tank-path, canCounter true by default — turned off here purely to
    // keep this test isolated to the exclusion-from-the-hit-list behavior
    // it actually targets. A friendly counter back at the caster is its
    // own separate, real behavior now (suppressed as of the "counter
    // shouldnt be ff able" fix — see the "friendly-fire counters" describe
    // block below), not something this particular test needs to exercise.
    ally.canCounter = false;
    const anandHpBefore = anand.currentHp;
    const allyHpBefore = ally.currentHp;

    const result = mission.missileStrike(anand.instanceId, anand.pos);
    expect(result!.hitIds).not.toContain(anand.instanceId);
    expect(result!.hitIds).toContain(ally.instanceId);
    expect(anand.currentHp).toBe(anandHpBefore); // untouched by her own shot
    expect(ally.currentHp).toBeLessThan(allyHpBefore); // but the ally next to her still eats it
  });

  // =====================================================================
  // Charges — per-unit, whole-action-budget, no refill
  // =====================================================================

  it("is a per-unit budget, not squad-shared: MISSILE_CHARGES_PER_MISSION uses, whole action budget + ends the turn each time, and time does not refill it", () => {
    expect(MISSILE_CHARGES_PER_MISSION).toBe(2); // pins the actual request to the test
    const mission = quietMission();
    const anand = pilot(mission, "pilot_anand", { x: 4, y: 6 });
    anand.abilities = [...anand.abilities, "abil_missile"];
    const lask = pilot(mission, "pilot_lask", { x: 10, y: 6 }); // second unit, own independent charge pool
    lask.abilities = [...lask.abilities, "abil_missile"];
    const target = { x: 7, y: 6 }; // empty tile — an intentionally wasted call, distance 3 from anand

    expect(mission.missileChargesRemaining(anand.instanceId)).toBe(MISSILE_CHARGES_PER_MISSION);

    expect(mission.missileStrike(anand.instanceId, target)).not.toBeNull();
    expect(mission.missileChargesRemaining(anand.instanceId)).toBe(1);
    expect(anand.actionsRemaining).toBe(0); // whole action budget, not just 1 action
    expect(mission.canMissileStrike(anand.instanceId)).toBe(false); // no actions left this turn, charge or no charge

    // lask's own pool is untouched by anand's use — not a shared squad pool.
    expect(mission.missileChargesRemaining(lask.instanceId)).toBe(MISSILE_CHARGES_PER_MISSION);

    mission.endPlayerTurn(); // turn 1's hostile phase, then turn 2 begins
    expect(mission.turn).toBe(2);

    expect(mission.missileStrike(anand.instanceId, target)).not.toBeNull();
    expect(mission.missileChargesRemaining(anand.instanceId)).toBe(0);
    expect(mission.canMissileStrike(anand.instanceId)).toBe(false); // out of charges now, not just out of actions

    // Unlike a cooldown, turns passing do not bring a charge back.
    for (let t = 0; t < 5; t++) mission.endPlayerTurn();
    expect(mission.missileChargesRemaining(anand.instanceId)).toBe(0);
    expect(mission.missileStrike(anand.instanceId, target)).toBeNull();

    // lask's independent pool is STILL untouched.
    expect(mission.missileChargesRemaining(lask.instanceId)).toBe(MISSILE_CHARGES_PER_MISSION);
  });

  // =====================================================================
  // The dodge correction — "spash shouldnt be dodgable" (Maxime)
  // =====================================================================

  describe("splash and the Meeps dodge house rule", () => {
    afterEach(() => vi.restoreAllMocks());

    it("a forced low Math.random() roll does NOT let a Meeps victim dodge the splash hit", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.01); // well under MEEPS_DODGE_CHANCE (0.4) — would dodge a normal attack, see dodge.test.ts
      const mission = quietMission();
      const anand = pilot(mission, "pilot_anand", { x: 4, y: 6 });
      anand.abilities = [...anand.abilities, "abil_missile"];
      const target = { x: 7, y: 6 }; // distance 3 — inside [2,4]
      const meepsVictim = createHostileMechUnit("hostile_mech_02", { x: 7, y: 6 }); // Meeps-path, right on the target tile
      meepsVictim.canCounter = false; // isolate the primary-hit dodge from any counter noise
      mission.units.push(meepsVictim);
      const hpBefore = meepsVictim.currentHp;

      const result = mission.missileStrike(anand.instanceId, target);
      expect(result!.hitIds).toContain(meepsVictim.instanceId);
      expect(meepsVictim.currentHp).toBeLessThan(hpBefore); // the hit landed — no dodge, despite the forced-low roll
    });

    it("does not touch the SEPARATE counter-dodge roll: a surviving victim's counter is still a real, independently-rolled hit", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.01); // well under MEEPS_DODGE_CHANCE
      const mission = quietMission();
      // The attacker herself needs to be Meeps-path for rollMeepsDodge to
      // ever return true for HER (it only fires for unit.path === "meeps"),
      // so this test hand-grants abil_missile to a Meeps pilot purely as an
      // engine-level fixture — the SOFT-pass design doesn't gate the
      // ability by path in code yet (see abilities.ts's own comment).
      const rourke = pilot(mission, "pilot_rourke", { x: 4, y: 6 });
      rourke.abilities = [...rourke.abilities, "abil_missile"];
      expect(rourke.attackRange).toEqual([1, 1]);
      const target = { x: 5, y: 6 }; // distance 1 — inside [1,1]
      // hostile_mech_02 is Meeps-path (not Tank) deliberately: House rule
      // #1b (dodge.test.ts) means a Meeps can never dodge a hit whose
      // SOURCE is a Tank, which would make this counter undodgeable no
      // matter what Math.random returns.
      const meepsVictim = createHostileMechUnit("hostile_mech_02", target);
      mission.units.push(meepsVictim);
      const [rourkeHpBefore, victimHpBefore] = [rourke.currentHp, meepsVictim.currentHp];

      const result = mission.missileStrike(rourke.instanceId, target);
      expect(result!.hitIds).toContain(meepsVictim.instanceId);
      expect(meepsVictim.currentHp).toBeLessThan(victimHpBefore); // primary hit: NOT dodgable, lands as always
      expect(rourke.currentHp).toBe(rourkeHpBefore); // counter hit: dodge roll still real, fully whiffs the counter
      expect(logsMatching(mission, "fires a missile").length).toBe(1);
    });
  });

  // =====================================================================
  // The friendly-counter correction — "the counter shouldnt be ff able" (Maxime)
  // =====================================================================

  describe("friendly-fire counters", () => {
    it("a friendly, counter-capable victim caught in the blast takes the primary hit but does NOT counter its own caster", () => {
      const mission = quietMission();
      const anand = pilot(mission, "pilot_anand", { x: 4, y: 6 });
      anand.abilities = [...anand.abilities, "abil_missile"];
      const target = { x: 6, y: 6 }; // distance 2 from anand — inside [2,4]
      // Placed at the midpoint on purpose: distance 1 from anand (inside
      // Tank's own counterMaxRange of 1 — a counter is geometrically live)
      // AND distance 1 from the target (inside MISSILE_SPLASH_RADIUS).
      const ally = pilot(mission, "pilot_bosk", { x: 5, y: 6 }); // Tank-path, canCounter true by default
      const [anandHpBefore, allyHpBefore] = [anand.currentHp, ally.currentHp];

      const result = mission.missileStrike(anand.instanceId, target);
      expect(result!.hitIds).toContain(ally.instanceId);
      expect(ally.currentHp).toBeLessThan(allyHpBefore); // the primary splash hit still lands on the ally
      expect(anand.currentHp).toBe(anandHpBefore); // but the ally's counter never fires back at its own caster
    });

    it("control: a HOSTILE victim in the identical geometry still counters the caster normally — the suppression is side-specific, not a blanket no-counters rule", () => {
      const mission = quietMission();
      const anand = pilot(mission, "pilot_anand", { x: 4, y: 6 });
      anand.abilities = [...anand.abilities, "abil_missile"];
      const target = { x: 6, y: 6 }; // distance 2 from anand — inside [2,4]
      const hostileVictim = createHostileMechUnit("hostile_mech_01", { x: 5, y: 6 }); // Tank-path, same geometry as the friendly case above
      mission.units.push(hostileVictim);
      const [anandHpBefore, victimHpBefore] = [anand.currentHp, hostileVictim.currentHp];

      const result = mission.missileStrike(anand.instanceId, target);
      expect(result!.hitIds).toContain(hostileVictim.instanceId);
      expect(hostileVictim.currentHp).toBeLessThan(victimHpBefore); // primary hit lands
      expect(anand.currentHp).toBeLessThan(anandHpBefore); // and this one DOES counter back — a real hostile counter is untouched by the fix
    });
  });
});
