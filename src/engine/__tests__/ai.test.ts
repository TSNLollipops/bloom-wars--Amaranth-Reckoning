// Fog-of-war rendering pass (Maxime, 22 Aug 2026 — "missions resolve in
// minutes, XCOM missions take hours"). unitsVisibleToSide (engine/ai.ts) is
// the new party-wide query scenes/Battle.ts uses to decide what to draw and
// what's targetable: the union of isVisibleTo(observer, target) across
// every living unit of `side` and every living unit of the opposing side.
// It's built entirely out of isVisibleTo/livingTargets, already exported
// and already covered by the hostile-AI vision-gate pass — this suite is
// about the union/aggregation behaviour on top of those, not re-testing
// Chebyshev distance or the burrow rule from scratch.
import { describe, it, expect } from "vitest";
import { unitsVisibleToSide } from "../ai";
import { Mission } from "../mission";
import { MISSION_1A } from "../../data/campaign";
import { testUnit } from "./testHelpers";

describe("unitsVisibleToSide", () => {
  it("counts a hostile visible to only ONE of several player units (union, not intersection or single-observer)", () => {
    const near = testUnit("tank", { x: 0, y: 0 });
    near.vision = 3;
    const far = testUnit("reeps", { x: 20, y: 20 });
    far.vision = 3;

    const hostile = testUnit("meeps", { x: 2, y: 0 }); // distance 2 from `near`, distance far from `far`
    hostile.side = "hostile";

    const visible = unitsVisibleToSide("player", [near, far, hostile]);
    expect(visible.has(hostile.instanceId)).toBe(true);
    expect(visible.size).toBe(1);
  });

  it("excludes a hostile outside every living player unit's vision", () => {
    const a = testUnit("tank", { x: 0, y: 0 });
    a.vision = 3;
    const b = testUnit("reeps", { x: 1, y: 1 });
    b.vision = 3;

    const hostile = testUnit("meeps", { x: 30, y: 30 });
    hostile.side = "hostile";

    const visible = unitsVisibleToSide("player", [a, b, hostile]);
    expect(visible.size).toBe(0);
  });

  it("never includes a burrowed hostile, no matter how close, because isVisibleTo itself excludes it", () => {
    const observer = testUnit("tank", { x: 5, y: 5 });
    observer.vision = 10;

    const hostile = testUnit("munti", { x: 5, y: 6 }); // adjacent — would trivially pass the distance check alone
    hostile.side = "hostile";
    hostile.burrowed = true;

    const visible = unitsVisibleToSide("player", [observer, hostile]);
    expect(visible.size).toBe(0);
  });

  it("never counts a downed unit as an observer", () => {
    const downedObserver = testUnit("tank", { x: 5, y: 5 });
    downedObserver.vision = 10;
    downedObserver.downed = true;

    const liveObserverFarAway = testUnit("reeps", { x: 90, y: 90 });
    liveObserverFarAway.vision = 1;

    const hostile = testUnit("meeps", { x: 5, y: 6 }); // adjacent to the DOWNED observer only
    hostile.side = "hostile";

    const visible = unitsVisibleToSide("player", [downedObserver, liveObserverFarAway, hostile]);
    expect(visible.size).toBe(0);
  });

  it("never counts a downed unit as a target, even standing right next to a live observer", () => {
    const observer = testUnit("tank", { x: 5, y: 5 });
    observer.vision = 10;

    const downedHostile = testUnit("meeps", { x: 5, y: 6 });
    downedHostile.side = "hostile";
    downedHostile.downed = true;

    const visible = unitsVisibleToSide("player", [observer, downedHostile]);
    expect(visible.size).toBe(0);
    expect(visible.has(downedHostile.instanceId)).toBe(false);
  });

  it("works symmetrically for side: 'hostile' — what's visible to the hostile side, not the player side", () => {
    const hostileObserver = testUnit("meeps", { x: 0, y: 0 });
    hostileObserver.side = "hostile";
    hostileObserver.vision = 5;

    const nearPlayer = testUnit("tank", { x: 1, y: 1 });
    const farPlayer = testUnit("reeps", { x: 50, y: 50 });

    const visible = unitsVisibleToSide("hostile", [hostileObserver, nearPlayer, farPlayer]);
    expect(visible.has(nearPlayer.instanceId)).toBe(true);
    expect(visible.has(farPlayer.instanceId)).toBe(false);
    expect(visible.size).toBe(1);
  });

  it("returns an empty set when the requesting side has no living units at all", () => {
    const downedPlayer = testUnit("tank", { x: 0, y: 0 });
    downedPlayer.downed = true;
    const hostile = testUnit("meeps", { x: 0, y: 1 });
    hostile.side = "hostile";

    expect(unitsVisibleToSide("player", [downedPlayer, hostile]).size).toBe(0);
  });

  it("on a real populated Mission board (MISSION_1A), reflects positions moved after construction", () => {
    const mission = new Mission(MISSION_1A);
    const spotter = mission.units.find((u) => u.side === "player")!;
    const hostiles = mission.units.filter((u) => u.side === "hostile" && !u.downed);
    expect(hostiles.length).toBeGreaterThan(0);

    // Push every hostile far out of vision, then every player unit too —
    // isolates the scenario before pulling one hostile back into range.
    for (const h of hostiles) h.pos = { x: 900, y: 900 };
    for (const p of mission.units.filter((u) => u.side === "player")) p.pos = { x: 0, y: 0 };

    expect(unitsVisibleToSide("player", mission.units).size).toBe(0);

    const target = hostiles[0];
    target.pos = { x: spotter.pos.x, y: spotter.pos.y + 1 }; // adjacent to spotter, well within any real vision stat
    const visible = unitsVisibleToSide("player", mission.units);
    expect(visible.has(target.instanceId)).toBe(true);
    // Every other hostile is still parked at (900, 900) — not visible.
    expect(visible.size).toBe(1);
  });
});
