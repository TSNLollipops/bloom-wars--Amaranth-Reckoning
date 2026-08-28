// Bloom on-hit effects engine (engine/turnManager.ts, 27 Aug 2026) —
// mission-level integration coverage. turnManager.test.ts covers the pure
// functions in isolation; this file exercises the real wiring through
// Mission.resolveAttack (the "Bloom attacking a mech-shape defender"
// branch) and Mission.environmentStep (the once-per-turn DoT tick), using
// real Bloom archetypes (data/bloom.ts) inside a real Mission instance.
//
// Defenders throughout are synthetic "tank"-path units, never "meeps" —
// rollMeepsDodge only ever rolls for a meeps defender, so this keeps every
// test here deterministic without needing to mock Math.random (one
// exception below, where the dodge itself is the point).
//
// All positions sit well inside map_city_sweep_01 (18x12) and every tile
// this file touches is force-set to "plain" first, so these tests don't
// depend on that map's actual terrain layout (defenceStars, existing
// bloom_mat, etc.) or drift if it's ever redrawn.
import { describe, it, expect, vi } from "vitest";
import { Mission } from "../mission";
import { MISSION_1A } from "../../data/campaign";
import { createBloomUnit } from "../units";
import { testUnit } from "./testHelpers";

// Mission 1a's own default roster (both sides) would otherwise act,
// regen, or take tile damage during endPlayerTurn() and muddy these
// tests' HP/status-effect assertions — pilot_barasj in particular is a
// Munti (arch_munti_bipedal), whose passive regen aura could otherwise
// heal the synthetic defenders below mid-test. Downing every pre-existing
// unit (both sides) before pushing the synthetic ones under test isolates
// this file completely; it never relies on the default roster's stats or
// starting positions. The synthetic units themselves stay "player"/
// "hostile" as needed, so checkWinLoss's own playerAlive check is never
// starved into an unrelated instant loss.
function neutralizeDefaultRoster(mission: Mission) {
  for (const u of mission.units) u.downed = true;
}

function clearTerrain(mission: Mission, coords: { x: number; y: number }[]) {
  for (const { x, y } of coords) mission.map.tiles[y][x] = "plain";
}

// eliminate_all's checkWinLoss runs at the very top of endPlayerTurn(),
// before the hostile phase or environmentStep ever execute — downing
// every hostile (neutralizeDefaultRoster, plus not adding a live one of
// our own) would read as "no hostiles left" and finish the mission as an
// instant win, skipping environmentStep entirely. Both environmentStep
// tests below need at least one hostile alive to reach that call at all,
// so this parks one far off in a corner, stripped of any way to act.
function parkHarmlessHostile(mission: Mission) {
  mission.map.tiles[0][0] = "plain"; // no free tile damage/repair for the decoy either
  const decoy = testUnit("meeps", { x: 0, y: 0 });
  decoy.side = "hostile";
  decoy.moveRange = 0;
  decoy.attackRange = [99, 99];
  mission.units.push(decoy);
}

describe("Bloom on-hit effects — mission.attack() wiring", () => {
  it("Gallcyst's fx_acid_dot lands a status effect on the defender and converts its tile to bloom_mat", () => {
    const mission = new Mission(MISSION_1A);
    neutralizeDefaultRoster(mission);
    clearTerrain(mission, [{ x: 5, y: 5 }, { x: 5, y: 6 }]);
    const gallcyst = createBloomUnit("bloom_gallcyst", { x: 5, y: 5 });
    mission.units.push(gallcyst);
    const defender = testUnit("tank", { x: 5, y: 6 }, { hp: 200, maxHp: 200 });
    mission.units.push(defender);

    mission.attack(gallcyst.instanceId, defender.instanceId);

    expect(defender.statusEffects).toEqual([{ kind: "acid_dot", magnitude: 8, turnsRemaining: 2 }]);
    // tiles are indexed [y][x] — the defender stands at (x:5, y:6).
    expect(mission.map.tiles[6][5]).toBe("bloom_mat");
  });

  it("Sirenmaw's fx_debuff_attack reaches the defender and a same-side ally within 2 tiles", () => {
    const mission = new Mission(MISSION_1A);
    neutralizeDefaultRoster(mission);
    clearTerrain(mission, [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 7, y: 6 }]);
    const sirenmaw = createBloomUnit("bloom_sirenmaw", { x: 5, y: 5 });
    mission.units.push(sirenmaw);
    const defender = testUnit("tank", { x: 5, y: 6 }, { hp: 200, maxHp: 200 });
    const ally = testUnit("meeps", { x: 7, y: 6 }, { hp: 200, maxHp: 200 }); // 2 tiles away, Chebyshev — in range
    mission.units.push(defender, ally);

    mission.attack(sirenmaw.instanceId, defender.instanceId);

    expect(defender.statusEffects).toEqual([{ kind: "debuff_attack", magnitude: 0.2, turnsRemaining: 2 }]);
    expect(ally.statusEffects).toEqual([{ kind: "debuff_attack", magnitude: 0.2, turnsRemaining: 2 }]);
  });

  it("Heartwood's fx_knockback_1 pushes the defender one tile away", () => {
    const mission = new Mission(MISSION_1A);
    neutralizeDefaultRoster(mission);
    clearTerrain(mission, [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 5, y: 7 }]);
    const heartwood = createBloomUnit("bloom_heartwood", { x: 5, y: 5 });
    mission.units.push(heartwood);
    const defender = testUnit("tank", { x: 5, y: 6 }, { hp: 200, maxHp: 200 });
    mission.units.push(defender);

    mission.attack(heartwood.instanceId, defender.instanceId);

    expect(defender.pos).toEqual({ x: 5, y: 7 });
  });

  it("no effect is applied when the hit downs the defender outright", () => {
    const mission = new Mission(MISSION_1A);
    neutralizeDefaultRoster(mission);
    clearTerrain(mission, [{ x: 5, y: 5 }, { x: 5, y: 6 }]);
    const gallcyst = createBloomUnit("bloom_gallcyst", { x: 5, y: 5 });
    mission.units.push(gallcyst);
    const defender = testUnit("tank", { x: 5, y: 6 }, { hp: 1, maxHp: 200 }); // any nonzero hit downs this
    mission.units.push(defender);

    mission.attack(gallcyst.instanceId, defender.instanceId);

    expect(defender.downed).toBe(true);
    expect(defender.statusEffects).toEqual([]);
  });

  it("a Meeps dodge suppresses the on-hit effect the same way it suppresses damage", () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0); // < MEEPS_DODGE_CHANCE, guarantees the dodge roll
    try {
      const mission = new Mission(MISSION_1A);
      neutralizeDefaultRoster(mission);
      clearTerrain(mission, [{ x: 5, y: 5 }, { x: 5, y: 6 }]);
      const gallcyst = createBloomUnit("bloom_gallcyst", { x: 5, y: 5 });
      mission.units.push(gallcyst);
      const defender = testUnit("meeps", { x: 5, y: 6 }, { hp: 200, maxHp: 200 });
      mission.units.push(defender);

      const result = mission.attack(gallcyst.instanceId, defender.instanceId);

      expect(result?.defenderDodged).toBe(true);
      expect(defender.statusEffects).toEqual([]);
    } finally {
      randomSpy.mockRestore();
    }
  });
});

describe("Bloom on-hit effects — environmentStep DoT tick", () => {
  it("ticks acid_dot damage once per turn cycle and expires it after its duration", () => {
    const mission = new Mission(MISSION_1A);
    neutralizeDefaultRoster(mission);
    clearTerrain(mission, [{ x: 5, y: 5 }, { x: 5, y: 6 }]);
    // Left ALIVE rather than downed — eliminate_all's checkWinLoss (run at
    // the very top of endPlayerTurn, before the hostile phase or
    // environmentStep ever execute) would otherwise read "no hostiles
    // left" and finish the mission as an instant win, skipping the DoT
    // tick entirely. Kept alive but stripped of any way to act — an
    // unreachable attackRange, same belt-and-braces shape shield.test.ts's
    // own neutralizeHostiles() uses — so it can't land a second real hit
    // on the defender and muddy the exact-damage assertions below.
    const gallcyst = createBloomUnit("bloom_gallcyst", { x: 5, y: 5 });
    gallcyst.attackRange = [99, 99];
    mission.units.push(gallcyst);
    const defender = testUnit("tank", { x: 5, y: 6 }, { hp: 200, maxHp: 200 });
    defender.statusEffects.push({ kind: "acid_dot", magnitude: 8, turnsRemaining: 2 });
    mission.units.push(defender);

    // Each call runs a full player-phase-then-hostile-phase cycle and ends
    // by resetting phase back to "player" itself (Mission.runHostileTurn),
    // so no manual phase reset is needed between calls.
    mission.endPlayerTurn();
    expect(defender.currentHp).toBe(192); // one tick of 8 dmg
    expect(defender.statusEffects).toEqual([{ kind: "acid_dot", magnitude: 8, turnsRemaining: 1 }]);

    mission.endPlayerTurn();
    expect(defender.currentHp).toBe(184); // second and final tick
    expect(defender.statusEffects).toEqual([]); // expired after 2 turns

    mission.endPlayerTurn();
    expect(defender.currentHp).toBe(184); // no third tick — effect already gone
  });

  it("does not double-fire handleDowned when tile damage alone already downed the unit this tick", () => {
    // bloom_mat's own turnStartDamage (5) is enough by itself to down a
    // unit already at 5 HP; giving that same unit a live acid_dot effect
    // means BOTH the tile-damage block and the status-effect block in
    // environmentStep run for it in the same loop iteration — exactly the
    // scenario the `!unit.downed` guard in mission.ts exists for. A real
    // double-call would push a second "is downed" log line.
    const mission = new Mission(MISSION_1A);
    neutralizeDefaultRoster(mission);
    parkHarmlessHostile(mission);
    clearTerrain(mission, [{ x: 5, y: 6 }]);
    const defender = testUnit("tank", { x: 5, y: 6 }, { hp: 5, maxHp: 200 });
    defender.statusEffects.push({ kind: "acid_dot", magnitude: 8, turnsRemaining: 2 });
    mission.units.push(defender);
    mission.map.tiles[6][5] = "bloom_mat"; // turnStartDamage: 5 — lethal to this unit alone

    mission.endPlayerTurn();

    expect(defender.downed).toBe(true);
    const downedLines = mission.log.filter((line) => line === `${defender.displayName} is downed.`);
    expect(downedLines).toHaveLength(1);
  });
});
