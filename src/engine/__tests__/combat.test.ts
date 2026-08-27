// Reproduces Data Pack §13 / sim_output.txt exactly. If any assertion
// here disagrees with a number in that file, the resolver is wrong —
// per the Data Pack's own framing, the table is the source of truth and
// the code is the thing that can have a typo.
import { describe, it, expect } from "vitest";
import type { Path } from "../../data/types";
import { POWER, TIERS, FULL_HP_DAMAGE_CAP } from "../../data/combatTables";
import { resolveMechAttack } from "../combat";
import { applyBloomDamage } from "../combat";
import { BLOOM } from "../../data/bloom";
import { makeUniformMap, testUnit } from "./testHelpers";
import { createBloomUnit } from "../units";

const PATHS: Path[] = ["meeps", "tank", "reeps", "munti"];
const OPEN = makeUniformMap("road"); // 0 defence stars, matches sim_output's "open ground"

describe("Base damage matrix (G-tier, full HP, 0 terrain stars)", () => {
  for (const atk of PATHS) {
    for (const def of PATHS) {
      it(`${atk} -> ${def} deals ${POWER[atk][def]}`, () => {
        const attacker = testUnit(atk, { x: 0, y: 0 });
        const defender = testUnit(def, { x: 5, y: 5 }); // far apart: isolates the base hit, no counter
        const r = resolveMechAttack(OPEN, attacker, defender, [defender], [attacker], false);
        expect(r.damage).toBe(POWER[atk][def]);
      });
    }
  }
});

describe("Triangle check — meeps > reeps > tank > meeps, margin >= 20", () => {
  const edges: [Path, Path][] = [
    ["meeps", "reeps"],
    ["reeps", "tank"],
    ["tank", "meeps"],
  ];
  for (const [winner, loser] of edges) {
    it(`${winner} beats ${loser} with a real margin`, () => {
      expect(POWER[winner][loser]).toBeGreaterThan(POWER[loser][winner]);
      expect(POWER[winner][loser] - POWER[loser][winner]).toBeGreaterThanOrEqual(20);
    });
  }
});

describe("Hits to kill vs a 100 HP defender", () => {
  const expected: Record<Path, Record<Path, number>> = {
    meeps: { meeps: 2, tank: 4, reeps: 2, munti: 2 },
    tank: { meeps: 2, tank: 3, reeps: 2, munti: 2 },
    reeps: { meeps: 3, tank: 2, reeps: 2, munti: 2 },
    munti: { meeps: 4, tank: 5, reeps: 3, munti: 4 },
  };
  for (const atk of PATHS) {
    for (const def of PATHS) {
      it(`${atk} needs ${expected[atk][def]} hits to kill a full ${def}`, () => {
        const attacker = testUnit(atk, { x: 0, y: 0 });
        const defender = testUnit(def, { x: 5, y: 5 });
        let hits = 0;
        while (defender.currentHp > 0 && hits < 20) {
          const r = resolveMechAttack(OPEN, attacker, defender, [defender], [attacker], false);
          defender.currentHp = r.defenderHpAfter;
          hits += 1;
        }
        expect(hits).toBe(expected[atk][def]);
      });
    }
  }
});

describe("Melee exchange, open ground — attacker initiates, defender counters", () => {
  const cases: { atk: Path; def: Path; defHp: number; atkHp: number }[] = [
    { atk: "meeps", def: "meeps", defHp: 45, atkHp: 75 },
    { atk: "meeps", def: "tank", defHp: 70, atkHp: 54 },
    { atk: "meeps", def: "reeps", defHp: 25, atkHp: 100 },
    { atk: "meeps", def: "munti", defHp: 30, atkHp: 91 },
    { atk: "tank", def: "meeps", defHp: 35, atkHp: 89 },
    { atk: "tank", def: "tank", defHp: 60, atkHp: 76 },
    { atk: "tank", def: "reeps", defHp: 50, atkHp: 100 },
    { atk: "tank", def: "munti", defHp: 40, atkHp: 92 },
    { atk: "munti", def: "meeps", defHp: 70, atkHp: 51 },
    { atk: "munti", def: "tank", defHp: 80, atkHp: 52 },
    { atk: "munti", def: "reeps", defHp: 65, atkHp: 100 },
    { atk: "munti", def: "munti", defHp: 70, atkHp: 79 },
  ];
  for (const c of cases) {
    it(`${c.atk} attacks ${c.def} -> def ${c.defHp} HP, atk ${c.atkHp} HP`, () => {
      const attacker = testUnit(c.atk, { x: 0, y: 0 });
      const defender = testUnit(c.def, { x: 1, y: 0 }); // adjacent: melee range, in counter range
      const r = resolveMechAttack(OPEN, attacker, defender, [defender], [attacker], false);
      expect(r.defenderHpAfter).toBe(c.defHp);
      expect(r.attackerHpAfter ?? attacker.maxHp).toBe(c.atkHp);
    });
  }
});

describe("Counterattack rule — exhaustive by distance", () => {
  const table: { path: Path; counters: boolean }[] = [
    { path: "meeps", counters: true },
    { path: "tank", counters: true },
    { path: "reeps", counters: false },
    { path: "munti", counters: true },
  ];
  for (const { path, counters } of table) {
    for (const distance of [1, 2, 3]) {
      it(`defender ${path} attacked from distance ${distance}: ${counters && distance === 1 ? "COUNTERS" : "no counter"}`, () => {
        const attacker = testUnit("meeps", { x: 0, y: 0 });
        const defender = testUnit(path, { x: distance, y: 0 });
        const r = resolveMechAttack(OPEN, attacker, defender, [defender], [attacker], false);
        expect(r.countered).toBe(counters && distance === 1);
      });
    }
  }
});

describe("Reeps from range — no counter possible at range >= 2", () => {
  const expected: Record<Path, { dmg: number; shots: number }> = {
    meeps: { dmg: 45, shots: 3 },
    tank: { dmg: 70, shots: 2 },
    reeps: { dmg: 50, shots: 2 },
    munti: { dmg: 55, shots: 2 },
  };
  for (const def of PATHS) {
    it(`reeps -> ${def}: ${expected[def].dmg} dmg, 0 counter, ${expected[def].shots} shots to kill`, () => {
      const attacker = testUnit("reeps", { x: 0, y: 0 });
      const defender = testUnit(def, { x: 3, y: 0 }); // range 3, out of any counterMaxRange
      const first = resolveMechAttack(OPEN, attacker, defender, [defender], [attacker], false);
      expect(first.damage).toBe(expected[def].dmg);
      expect(first.countered).toBe(false);

      defender.currentHp = defender.maxHp;
      let hits = 0;
      while (defender.currentHp > 0 && hits < 20) {
        const r = resolveMechAttack(OPEN, attacker, defender, [defender], [attacker], false);
        defender.currentHp = r.defenderHpAfter;
        hits += 1;
      }
      expect(hits).toBe(expected[def].shots);
    });
  }
});

describe("Tier gap stress test — A-tier attacker vs G-tier defender, full HP", () => {
  const cases: { atk: Path; def: Path; raw: number; dealt: number }[] = [
    { atk: "meeps", def: "meeps", raw: 77, dealt: 77 },
    { atk: "meeps", def: "tank", raw: 42, dealt: 42 },
    { atk: "meeps", def: "reeps", raw: 105, dealt: 90 },
    { atk: "meeps", def: "munti", raw: 98, dealt: 90 },
    { atk: "tank", def: "meeps", raw: 91, dealt: 90 },
    { atk: "tank", def: "tank", raw: 56, dealt: 56 },
    { atk: "tank", def: "reeps", raw: 70, dealt: 70 },
    { atk: "tank", def: "munti", raw: 84, dealt: 84 },
    { atk: "reeps", def: "meeps", raw: 63, dealt: 63 },
    { atk: "reeps", def: "tank", raw: 98, dealt: 90 },
    { atk: "reeps", def: "reeps", raw: 70, dealt: 70 },
    { atk: "reeps", def: "munti", raw: 77, dealt: 77 },
    { atk: "munti", def: "meeps", raw: 42, dealt: 42 },
    { atk: "munti", def: "tank", raw: 28, dealt: 28 },
    { atk: "munti", def: "reeps", raw: 49, dealt: 49 },
    { atk: "munti", def: "munti", raw: 42, dealt: 42 },
  ];
  for (const c of cases) {
    it(`A-${c.atk} -> G-${c.def}: raw ${c.raw}, dealt ${c.dealt}`, () => {
      const attacker = testUnit(c.atk, { x: 0, y: 0 }, { tierAttack: TIERS.A.attack });
      const defender = testUnit(c.def, { x: 5, y: 5 }, { tierDefense: TIERS.G.defense });
      const r = resolveMechAttack(OPEN, attacker, defender, [defender], [attacker], false);
      expect(r.damage).toBe(c.dealt);
      expect(r.damage).toBeLessThanOrEqual(FULL_HP_DAMAGE_CAP);
    });
  }
});

describe("Bloom Endurance / Vitality Collapse rule", () => {
  const cases: { id: string; hitDmg: number; hitsToKill: number }[] = [
    { id: "bloom_gallcyst", hitDmg: 45, hitsToKill: 5 },
    { id: "bloom_sporethrower", hitDmg: 45, hitsToKill: 4 },
    { id: "bloom_crawlmass", hitDmg: 45, hitsToKill: 3 },
    { id: "bloom_heartwood", hitDmg: 70, hitsToKill: 7 },
    // Wellroot (27 Aug 2026, real stat block replacing the old Heartwood
    // reuse) — deliberately checked at the same 70 dmg/hit as Heartwood so
    // the two boss hit-counts are directly comparable: this is the
    // "strictly escalating Act I (7) < Act II (8) < Act III (9)" gate from
    // design/combat_sim.py's own "THE WELLROOT" section.
    { id: "bloom_wellroot", hitDmg: 70, hitsToKill: 8 },
  ];
  for (const c of cases) {
    it(`${c.id} dies in ${c.hitsToKill} hits at ${c.hitDmg}/hit`, () => {
      const unit = createBloomUnit(c.id, { x: 0, y: 0 });
      let hits = 0;
      while (!unit.downed && hits < 20) {
        applyBloomDamage(unit, c.hitDmg);
        hits += 1;
      }
      expect(hits).toBe(c.hitsToKill);
    });

    it(`${c.id} damage overflow does not carry from endurance into vitality`, () => {
      const arch = BLOOM[c.id];
      const unit = createBloomUnit(c.id, { x: 0, y: 0 });
      applyBloomDamage(unit, arch.endurance + 1000); // absurd overkill on the shell
      expect(unit.endurance).toBe(0);
      expect(unit.vitality).toBe(arch.vitality); // untouched by the overflow
      expect(unit.downed).toBe(false); // collapsed, not dead — vitality still has to be chipped
    });
  }
});

describe("Terrain — reeps attacking a tank at each defence-star tile", () => {
  const cases: { tile: "road" | "rubble" | "structure" | "ridge"; dmg: number; shots: number }[] = [
    { tile: "road", dmg: 70, shots: 2 },
    { tile: "rubble", dmg: 56, shots: 2 },
    { tile: "structure", dmg: 49, shots: 3 },
    { tile: "ridge", dmg: 42, shots: 3 },
  ];
  for (const c of cases) {
    it(`reeps -> tank on ${c.tile}: ${c.dmg} dmg, ${c.shots} shots`, () => {
      const map = makeUniformMap(c.tile);
      const attacker = testUnit("reeps", { x: 0, y: 0 });
      const defender = testUnit("tank", { x: 3, y: 0 });
      const first = resolveMechAttack(map, attacker, defender, [defender], [attacker], false);
      expect(first.damage).toBe(c.dmg);

      defender.currentHp = defender.maxHp;
      let hits = 0;
      while (defender.currentHp > 0 && hits < 20) {
        const r = resolveMechAttack(map, attacker, defender, [defender], [attacker], false);
        defender.currentHp = r.defenderHpAfter;
        hits += 1;
      }
      expect(hits).toBe(c.shots);
    });
  }
});

describe("Centauroid charge (>=3 tiles straight line over cost-1 terrain)", () => {
  const cases: { def: Path; raw: number; dealt: number }[] = [
    { def: "meeps", raw: 55, dealt: 69 },
    { def: "tank", raw: 30, dealt: 38 },
    { def: "reeps", raw: 75, dealt: 90 },
    { def: "munti", raw: 70, dealt: 88 },
  ];
  for (const c of cases) {
    it(`charging meeps -> ${c.def}: ${c.raw} -> ${c.dealt}`, () => {
      const attacker = testUnit("meeps", { x: 0, y: 0 });
      const defender = testUnit(c.def, { x: 5, y: 5 });
      const r = resolveMechAttack(OPEN, attacker, defender, [defender], [attacker], true);
      expect(r.damage).toBe(c.dealt);
    });
  }
});
