// The test bot's Heirloom and Signature verbs, Beacon Control, and
// Protect Asset awareness (17 Sep 2026, Player Bot Reuse Plan §1).
// Real Mission instances with a real fielded Heirloom
// (sim/heirloomFielding.ts), units placed by hand, same discipline as the
// other files in this directory. What's pinned is the shape of each rule —
// fires when its case is on the board, stays quiet otherwise — not any
// balance number.
import { describe, it, expect } from "vitest";
import { Mission } from "../../../engine/mission";
import { AMARANTH_MISSION_8, AMARANTH_MISSION_22 } from "../../../data/campaignAmaranth";
import type { HeirloomId } from "../../../data/heirlooms";
import { createPlayerAiMemory, decidePlayerAiAction, EASY, HARD, MODERATE, type PlayerAiProfile } from "../index";
import { chooseHeirloomAction, type HeirloomInputs } from "../heirlooms";
import { chooseBeaconTarget } from "../abilities";
import { fieldHeirloom, parseHeirloomFlag, staticRoster } from "../../heirloomFielding";
import { driveMission } from "../../driveMission";
import type { BattleUnit } from "../../../engine/units";
import type { CampaignMission } from "../../../data/types";

/** A mission with `heirloom` fielded at `rank`, plus the wielder. Everyone else is parked in the top-left corner. */
function withHeirloom(def: CampaignMission, heirloom: HeirloomId, rank = 1) {
  const { roster, wielderId } = fieldHeirloom(staticRoster(def), { id: heirloom, rank });
  const m = new Mission(def, roster);
  const wielder = m.units.find((u) => u.pilotId === wielderId)!;
  return { m, wielder };
}

function park(m: Mission, keep: BattleUnit[]): void {
  let x = 0;
  for (const u of m.units) {
    if (keep.includes(u)) continue;
    if (u.side === "hostile") u.downed = true;
    else u.pos = { x: x++ % 3, y: 0 };
  }
}

function inputs(m: Mission, unit: BattleUnit, profile: PlayerAiProfile = MODERATE, extra: Partial<HeirloomInputs> = {}): HeirloomInputs {
  const allEnemies = m.units.filter((u) => u.side !== unit.side && !u.downed);
  return {
    map: m.map,
    unit,
    allUnits: m.units,
    turn: m.turn,
    context: m,
    profile,
    memory: createPlayerAiMemory(),
    enemies: allEnemies,
    allEnemies,
    hpFraction: unit.currentHp / unit.maxHp,
    frontLineProtected: false,
    ...extra,
  };
}

describe("chooseHeirloomAction — gating", () => {
  it("a squad with no Heirloom never reaches a rule", () => {
    const m = new Mission(AMARANTH_MISSION_8);
    for (const u of m.units.filter((x) => x.side === "player")) expect(chooseHeirloomAction(inputs(m, u))).toBeNull();
  });

  it("EASY never uses an Heirloom, even one it carries", () => {
    const { m, wielder } = withHeirloom(AMARANTH_MISSION_8, "farsights_reckoning");
    expect(wielder.abilities).toContain("farsight_signature");
    expect(chooseHeirloomAction(inputs(m, wielder, EASY, { enemies: [] }))).toBeNull();
  });
});

describe("chooseHeirloomAction — the rules", () => {
  it("Farsight: fires when enemies are out of sight, not when everything is visible", () => {
    const { m, wielder } = withHeirloom(AMARANTH_MISSION_8, "farsights_reckoning");
    const all = m.units.filter((u) => u.side === "hostile" && !u.downed);
    expect(chooseHeirloomAction(inputs(m, wielder, MODERATE, { enemies: [] }))?.decision.action).toBe("farsight");
    expect(chooseHeirloomAction(inputs(m, wielder, MODERATE, { enemies: all }))).toBeNull();
  });

  it("Field Triage: two hurt allies in radius, not one", () => {
    const { m, wielder } = withHeirloom(AMARANTH_MISSION_8, "last_word");
    const [a, b] = m.units.filter((u) => u.side === "player" && u !== wielder && u.pilotId !== "pilot_rourke");
    park(m, [wielder, a, b]);
    wielder.pos = { x: 10, y: 6 };
    a.pos = { x: 11, y: 6 };
    b.pos = { x: 20, y: 12 };
    a.currentHp = Math.floor(a.maxHp * 0.3);
    b.currentHp = Math.floor(b.maxHp * 0.3);
    expect(chooseHeirloomAction(inputs(m, wielder))?.decision.action).not.toBe("field_triage");
    b.pos = { x: 10, y: 7 };
    expect(chooseHeirloomAction(inputs(m, wielder))?.decision.action).toBe("field_triage");
  });

  it("Iron Word: arms Oathkeeper first when the Word alone isn't survivable, then speaks", () => {
    const { m, wielder } = withHeirloom(AMARANTH_MISSION_8, "iron_oath");
    expect(wielder.path).toBe("tank");
    const vip = m.units.find((u) => u.side === "player" && u.path === "munti")!;
    const raider = m.units.find((u) => u.side === "hostile" && !u.downed)!;
    park(m, [wielder, vip, raider]);
    wielder.pos = { x: 10, y: 6 };
    vip.pos = { x: 10, y: 8 };
    raider.pos = { x: 11, y: 7 };
    wielder.currentHp = Math.ceil(wielder.maxHp * 0.3); // too hurt to bait unprotected
    const first = chooseHeirloomAction(inputs(m, wielder));
    expect(first?.decision.action).toBe("oathkeeper");
    expect(m.oathkeeper(wielder.instanceId)).toBe(true);
    const second = chooseHeirloomAction(inputs(m, wielder));
    expect(second?.decision.action).toBe("iron_word");
  });

  it("Iron Word: silent when no enemy near the wielder threatens a VIP", () => {
    const { m, wielder } = withHeirloom(AMARANTH_MISSION_8, "iron_oath");
    park(m, [wielder]);
    wielder.pos = { x: 10, y: 6 };
    expect(chooseHeirloomAction(inputs(m, wielder))?.decision.action).not.toBe("iron_word");
  });

  it("Deadfall: takes a kill anywhere on the map", () => {
    const { m, wielder } = withHeirloom(AMARANTH_MISSION_8, "deadfall");
    const far = m.units.find((u) => u.side === "hostile" && !u.downed)!;
    park(m, [wielder, far]);
    wielder.pos = { x: 1, y: 1 };
    far.pos = { x: 20, y: 11 };
    far.currentHp = 1;
    if (far.kind === "bloom") {
      far.collapsed = true;
      far.vitality = 1;
    }
    // The engine only offers targets the player side can see.
    far.revealedUntilTurn = m.turn + 1;
    const choice = chooseHeirloomAction(inputs(m, wielder, MODERATE, { enemies: [far], allEnemies: [far] }));
    expect(choice?.decision).toEqual({ action: "deadfall_strike", abilityTargetId: far.instanceId });
  });

  it("Requiem: never fired by a wielder the line would kill", () => {
    const { m, wielder } = withHeirloom(AMARANTH_MISSION_8, "requiem");
    // Force the meter full the way a long fight would.
    (m as unknown as { requiemCharge: number }).requiemCharge = 100;
    const targets = m.units.filter((u) => u.side === "hostile" && !u.downed).slice(0, 3);
    park(m, [wielder, ...targets]);
    wielder.pos = { x: 5, y: 6 };
    targets.forEach((t, i) => (t.pos = { x: 7 + i, y: 6 }));
    wielder.currentHp = wielder.maxHp;
    const healthy = chooseHeirloomAction(inputs(m, wielder, MODERATE, { enemies: targets, allEnemies: targets }));
    expect(healthy?.decision.action).toBe("requiem");
    wielder.currentHp = 50;
    const hurt = chooseHeirloomAction(inputs(m, wielder, MODERATE, { enemies: targets, allEnemies: targets }));
    expect(hurt?.decision.action).not.toBe("requiem");
  });

  it("strikes wait while a plain kill is on the table", () => {
    const { m, wielder } = withHeirloom(AMARANTH_MISSION_8, "requiem");
    (m as unknown as { requiemCharge: number }).requiemCharge = 100;
    const targets = m.units.filter((u) => u.side === "hostile" && !u.downed).slice(0, 3);
    park(m, [wielder, ...targets]);
    wielder.pos = { x: 5, y: 6 };
    targets.forEach((t, i) => (t.pos = { x: 6 + i, y: 6 }));
    // The adjacent one dies to an ordinary hit.
    targets[0].currentHp = 1;
    if (targets[0].kind === "bloom") {
      targets[0].collapsed = true;
      targets[0].vitality = 1;
    }
    const choice = chooseHeirloomAction(inputs(m, wielder, MODERATE, { enemies: targets, allEnemies: targets }));
    expect(choice?.decision.action).not.toBe("requiem");
  });

  it("Ledgerhall Static is never chosen (hostiles don't use abilities, so the jam does nothing yet)", () => {
    const { m, wielder } = withHeirloom(AMARANTH_MISSION_8, "stolen_seal");
    for (const profile of [MODERATE, HARD]) {
      const choice = chooseHeirloomAction(inputs(m, wielder, profile));
      expect(choice?.decision.action).not.toBe("ledgerhall_static");
    }
  });
});

describe("heirloomFielding", () => {
  it("parses id, rank and pilot", () => {
    expect(parseHeirloomFlag("cinder_line")).toEqual({ id: "cinder_line", rank: undefined, pilotId: undefined });
    expect(parseHeirloomFlag("last_word:5@pilot_lask")).toEqual({ id: "last_word", rank: 5, pilotId: "pilot_lask" });
    expect(() => parseHeirloomFlag("nope")).toThrow();
    expect(() => parseHeirloomFlag("last_word:6")).toThrow();
  });

  it("gives a path-locked Heirloom to a pilot of that path, every ability at the rank asked", () => {
    const { roster, wielderId } = fieldHeirloom(staticRoster(AMARANTH_MISSION_8), { id: "iron_oath", rank: 4 });
    const entry = roster.find((e) => e.pilotId === wielderId)!;
    expect(entry.pilot.archetypeId).toContain("tank");
    expect(Object.values(entry.heirloomAbilityRanks ?? {}).every((r) => r === 4)).toBe(true);
    expect(roster.filter((e) => e.heirloomAbilityRanks)).toHaveLength(1);
  });

  it("prefers anyone over the commander for an any-path Heirloom", () => {
    const { roster, wielderId } = fieldHeirloom(staticRoster(AMARANTH_MISSION_8), { id: "cinder_line" });
    expect(roster.find((e) => e.pilotId === wielderId)!.pilot.exemptFromPermadeath).toBeFalsy();
  });

  it("driveMission reports the wielder and still replays from its seed", () => {
    const a = driveMission(AMARANTH_MISSION_8, { seed: 77, heirloom: { id: "iron_oath", rank: 3 } });
    const b = driveMission(AMARANTH_MISSION_8, { seed: 77, heirloom: { id: "iron_oath", rank: 3 } });
    expect(a.heirloomWielderId).toBeDefined();
    expect(b.mission.log).toEqual(a.mission.log);
  });
});

describe("Beacon Control", () => {
  it("is off in a plain run and on with `beacons`", () => {
    const plain = new Mission(AMARANTH_MISSION_8);
    const rourke = plain.units.find((u) => u.pilotId === "pilot_rourke")!;
    expect(plain.canPlaceBeacon(rourke.instanceId)).toBe(false);
    const run = driveMission(AMARANTH_MISSION_8, { seed: 3, beacons: 2, maxLoops: 0 });
    const r = run.mission.units.find((u) => u.pilotId === "pilot_rourke")!;
    expect(run.mission.canPlaceBeacon(r.instanceId)).toBe(true);
  });

  it("chooseBeaconTarget picks a downed Munti first, and nothing once the fight is over", () => {
    const run = driveMission(AMARANTH_MISSION_8, { seed: 3, beacons: 2, maxLoops: 0 });
    const m = run.mission;
    const holder = m.units.find((u) => u.pilotId === "pilot_rourke")!;
    const munti = m.units.find((u) => u.side === "player" && u.path === "munti")!;
    const other = m.units.find((u) => u.side === "player" && u !== holder && u !== munti)!;
    for (const u of [munti, other]) {
      u.pos = { x: holder.pos.x + 1, y: holder.pos.y };
      u.downed = true;
      u.currentHp = 0;
    }
    other.pos = { x: holder.pos.x, y: holder.pos.y + 1 };
    const enemies = m.units.filter((u) => u.side === "hostile" && !u.downed);
    expect(chooseBeaconTarget(holder, enemies, m, MODERATE)?.instanceId).toBe(munti.instanceId);
    expect(chooseBeaconTarget(holder, [], m, MODERATE)).toBeNull();
    expect(chooseBeaconTarget(holder, enemies, m, EASY)).toBeNull();
  });
});

describe("Protect Asset awareness", () => {
  it("shoots the raider about to reach the perimeter before a weaker target elsewhere", () => {
    const m = new Mission(AMARANTH_MISSION_22);
    const zone = m.map.defendZone!;
    const shooter = m.units.find((u) => u.side === "player" && u.path === "reeps")!;
    const [raider, bystander] = m.units.filter((u) => u.side === "hostile" && !u.downed);
    park(m, [shooter, raider, bystander]);
    const z = zone[0];
    shooter.pos = { x: z.x - 2, y: z.y + 2 };
    raider.pos = { x: z.x, y: z.y + 1 }; // one step from the perimeter
    bystander.pos = { x: z.x - 4, y: z.y + 2 };
    bystander.currentHp = 1; // the weaker target a plain fight would prefer
    shooter.attackRange = [1, 4];
    const decision = decidePlayerAiAction(m.map, shooter, m.units, m.turn, m, MODERATE, createPlayerAiMemory());
    expect(decision.attackTargetId).toBe(raider.instanceId);
  });

  it("Easy still plays it as a plain fight", () => {
    const m = new Mission(AMARANTH_MISSION_22);
    const zone = m.map.defendZone!;
    const shooter = m.units.find((u) => u.side === "player" && u.path === "reeps")!;
    const [raider, bystander] = m.units.filter((u) => u.side === "hostile" && !u.downed);
    park(m, [shooter, raider, bystander]);
    const z = zone[0];
    shooter.pos = { x: z.x - 2, y: z.y + 2 };
    raider.pos = { x: z.x, y: z.y + 1 };
    bystander.pos = { x: z.x - 3, y: z.y + 2 };
    shooter.attackRange = [1, 4];
    const decision = decidePlayerAiAction(m.map, shooter, m.units, m.turn, m, { ...EASY, mistakeChance: 0 }, createPlayerAiMemory());
    // Easy shoots the nearest thing it can hurt.
    expect(decision.attackTargetId).toBe(bystander.instanceId);
  });
});
