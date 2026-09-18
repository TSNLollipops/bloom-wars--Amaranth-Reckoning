// MissionOptions.hostileBrain (17 Sep 2026, Player Bot Reuse Plan §2b,
// E-lite) — the one engine seam that lets something other than
// decideHostileAction drive a hostile unit. Three things to pin: with no
// brain the hostile phase is untouched, a brain's decision is applied the
// same way the built-in one is (move, then attack), and a brain that says
// "not mine" hands the unit back to decideHostileAction. Plus the one
// engine/threat.ts change that rides with it: the threat map can describe
// either side's reach.
import { describe, it, expect } from "vitest";
import { Mission } from "../mission";
import { AMARANTH_MISSION_2, AMARANTH_MISSION_6 } from "../../data/campaignAmaranth";
import type { AiDecision, HostileBrain } from "../ai";
import { buildThreatMap } from "../threat";

/** A tiny seeded source (engine tests don't reach into sim/). */
function seeded(seed: number): () => number {
  let x = seed >>> 0;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

function runPhases(m: Mission, phases: number): void {
  for (let i = 0; i < phases && m.outcome === "ongoing"; i++) m.endPlayerTurn();
}

describe("MissionOptions.hostileBrain", () => {
  it("unset: the hostile phase is exactly what it was (same seed, same log)", () => {
    const a = new Mission(AMARANTH_MISSION_6, undefined, [], { rng: seeded(11) });
    const b = new Mission(AMARANTH_MISSION_6, undefined, [], { rng: seeded(11), hostileBrain: undefined });
    runPhases(a, 4);
    runPhases(b, 4);
    expect(b.log).toEqual(a.log);
    // instanceIds come from a module-level counter, so compare everything else.
    const board = (m: Mission) => m.units.map((u) => [u.side, u.archetypeId, u.pos.x, u.pos.y, u.currentHp, u.downed]);
    expect(board(b)).toEqual(board(a));
  });

  it("a brain that always answers undefined changes nothing", () => {
    const a = new Mission(AMARANTH_MISSION_6, undefined, [], { rng: seeded(12) });
    const b = new Mission(AMARANTH_MISSION_6, undefined, [], { rng: seeded(12), hostileBrain: () => undefined });
    runPhases(a, 4);
    runPhases(b, 4);
    expect(b.log).toEqual(a.log);
  });

  it("is only ever asked about hostile units, once each per hostile phase", () => {
    const asked: { side: string; turn: number; id: string }[] = [];
    const brain: HostileBrain = (_map, unit, _all, turn) => {
      asked.push({ side: unit.side, turn, id: unit.instanceId });
      return undefined;
    };
    const m = new Mission(AMARANTH_MISSION_6, undefined, [], { rng: seeded(13), hostileBrain: brain });
    const livingHostiles = m.units.filter((u) => u.side === "hostile" && !u.downed).length;
    m.endPlayerTurn();
    expect(asked.every((q) => q.side === "hostile")).toBe(true);
    expect(asked.length).toBeLessThanOrEqual(livingHostiles);
    expect(new Set(asked.map((q) => q.id)).size).toBe(asked.length);
  });

  it("a brain's hold is obeyed: nobody it controls moves", () => {
    const m = new Mission(AMARANTH_MISSION_6, undefined, [], { rng: seeded(14), hostileBrain: (): AiDecision => ({}) });
    const before = new Map(m.units.filter((u) => u.side === "hostile").map((u) => [u.instanceId, { ...u.pos }]));
    m.endPlayerTurn();
    for (const u of m.units.filter((x) => x.side === "hostile" && before.has(x.instanceId))) {
      expect(u.pos).toEqual(before.get(u.instanceId));
    }
  });

  it("a brain's move and attack are applied, move first", () => {
    // One hostile two tiles from a player unit; the brain steps it
    // adjacent and swings. The brain is read when the phase runs, so the
    // closure can name units set up after construction.
    let attackerId = "";
    let targetId = "";
    const brain: HostileBrain = (_map, unit) =>
      unit.instanceId === attackerId ? { path: [{ x: 17, y: 5 }, { x: 16, y: 5 }], attackTargetId: targetId } : undefined;
    const m = new Mission(AMARANTH_MISSION_2, undefined, [], { rng: seeded(15), hostileBrain: brain });
    // Not a Meeps: a Meeps can dodge, and a dodge would read as "no attack".
    const target = m.units.find((u) => u.side === "player" && !u.downed && u.path !== "meeps")!;
    const [attacker, ...rest] = m.units.filter((u) => u.side === "hostile" && !u.downed);
    for (const h of rest) h.downed = true;
    for (const u of m.units) if (u.side === "player" && u !== target) u.pos = { x: 0, y: 0 };
    target.pos = { x: 15, y: 5 };
    attacker.pos = { x: 17, y: 5 };
    attacker.attackRange = [1, 1];
    attackerId = attacker.instanceId;
    targetId = target.instanceId;
    const hpBefore = target.currentHp;
    m.endPlayerTurn();
    expect(attacker.pos).toEqual({ x: 16, y: 5 });
    expect(target.currentHp).toBeLessThan(hpBefore);
  });
});

describe("buildThreatMap — attackerSide", () => {
  it("defaults to the hostile side's reach", () => {
    const m = new Mission(AMARANTH_MISSION_2);
    const threat = buildThreatMap(m.map, m.units, m.turn);
    expect(threat.footprints.length).toBeGreaterThan(0);
    expect(threat.footprints.every((f) => f.hostile.side === "hostile")).toBe(true);
  });

  it("'player' maps the player squad's reach instead", () => {
    const m = new Mission(AMARANTH_MISSION_2);
    const threat = buildThreatMap(m.map, m.units, m.turn, "player");
    const living = m.units.filter((u) => u.side === "player" && !u.downed).length;
    expect(threat.footprints.length).toBe(living);
    expect(threat.footprints.every((f) => f.hostile.side === "player")).toBe(true);
  });

  it("a taunting player unit roots the hostile side, not the player side", () => {
    const m = new Mission(AMARANTH_MISSION_2);
    const p = m.units.find((u) => u.side === "player" && !u.downed)!;
    p.taunting = true;
    const hostileReach = buildThreatMap(m.map, m.units, m.turn, "hostile");
    expect(hostileReach.footprints.every((f) => f.standable.size === 1)).toBe(true);
    const playerReach = buildThreatMap(m.map, m.units, m.turn, "player");
    expect(playerReach.footprints.some((f) => f.standable.size > 1)).toBe(true);
  });
});
