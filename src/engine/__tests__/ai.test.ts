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
import { unitsVisibleToSide, decideHostileAction } from "../ai";
import { Mission } from "../mission";
import { MISSION_1A } from "../../data/campaign";
import { testUnit, makeUniformMap } from "./testHelpers";
import { createHostileMechUnit, createBloomUnit } from "../units";

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

// Hostile-mech Munti priority (Maxime, 25 Aug 2026 — "in a mech to mech
// battle its kill the munties 1st"). decideHostileAction routes any
// unit.kind === "mech" through the new mechReflexiveDecision instead of
// plain reflexiveDecision; this suite is about that routing and the
// priority behaviour itself, not re-testing bestAttackTargetInRange or
// moveToward's own math from scratch.
describe("decideHostileAction — hostile mech Munti priority", () => {
  it("attacks a Munti already in range instead of a non-Munti target that would take more damage", () => {
    const map = makeUniformMap("plain", 10, 10);
    const mech = createHostileMechUnit("hostile_mech_amaranth_02", { x: 5, y: 5 }); // path: meeps, melee
    const munti = testUnit("munti", { x: 5, y: 6 }, { tierDefense: 500 }); // adjacent, high defense — NOT the best-damage pick
    const tank = testUnit("tank", { x: 6, y: 5 }); // also adjacent, ordinary defense — the best-damage pick under plain reflexive rules

    const decision = decideHostileAction(map, mech, [mech, munti, tank]);
    expect(decision.attackTargetId).toBe(munti.instanceId);
  });

  it("moves into range of a visible-but-out-of-range Munti and attacks it, rather than staying put", () => {
    const map = makeUniformMap("plain", 20, 20);
    const mech = createHostileMechUnit("hostile_mech_amaranth_02", { x: 0, y: 0 });
    mech.vision = 10;
    const munti = testUnit("munti", { x: 4, y: 0 }); // within moveRange+attackRange, not in range from (0,0)

    const decision = decideHostileAction(map, mech, [mech, munti]);
    expect(decision.attackTargetId).toBe(munti.instanceId);
    expect(decision.path).toBeDefined();
    expect(decision.path!.length).toBeGreaterThan(1);
  });

  it("falls back to a reachable non-Munti target when the visible Munti can't be reached into range this turn", () => {
    const map = makeUniformMap("plain", 30, 30);
    const mech = createHostileMechUnit("hostile_mech_amaranth_02", { x: 0, y: 0 }); // meeps: moveRange 6, attackRange [1,1]
    mech.vision = 25;
    const farMunti = testUnit("munti", { x: 20, y: 0 }); // visible, far past moveRange+attackRange
    const nearTank = testUnit("tank", { x: 1, y: 0 }); // adjacent — a real, reachable kill this turn

    const decision = decideHostileAction(map, mech, [mech, farMunti, nearTank]);
    expect(decision.attackTargetId).toBe(nearTank.instanceId);
  });

  it("does not prioritise a Munti when there isn't one on the enemy side at all (plain reflexive behaviour)", () => {
    const map = makeUniformMap("plain", 10, 10);
    const mech = createHostileMechUnit("hostile_mech_amaranth_02", { x: 5, y: 5 });
    const tank = testUnit("tank", { x: 5, y: 6 } );

    const decision = decideHostileAction(map, mech, [mech, tank]);
    expect(decision.attackTargetId).toBe(tank.instanceId);
  });

  it("leaves weak/reflexive-tier Bloom untouched — no Munti priority for kind: 'bloom', Bloom stays instinct-only", () => {
    const map = makeUniformMap("plain", 10, 10);
    const crawlmass = createBloomUnit("bloom_crawlmass", { x: 5, y: 5 }); // reflexive-tier Bloom archetype
    crawlmass.side = "hostile";
    const munti = testUnit("munti", { x: 5, y: 6 }, { tierDefense: 500 }); // adjacent, would win Munti-priority if it applied
    const tank = testUnit("tank", { x: 6, y: 5 }); // adjacent, ordinary defense — the actual best-damage pick

    const decision = decideHostileAction(map, crawlmass, [crawlmass, munti, tank]);
    // Plain reflexive rule ("attack whichever in-range target takes the
    // most damage") still governs Bloom — the high-defense Munti is NOT
    // preferred just because it's a Munti.
    expect(decision.attackTargetId).toBe(tank.instanceId);
  });
});

// abil_taunt (Meeps, 25 Aug 2026, mission 8 onward — see
// CampaignMission.bonusAbilityUnlocks). `taunting` is a plain flag on
// BattleUnit, set only by Mission.taunt() in real play — this suite sets
// it directly and is entirely about decideHostileAction honoring it ahead
// of every tier's own pick, including Munti priority. The verb itself
// (canTaunt/taunt/once-per-mission/ends-turn) is covered in
// abilities.test.ts, matching that file's own split between "the posture"
// and "what the posture does to targeting."
describe("decideHostileAction — abil_taunt overrides every tier's own pick", () => {
  it("mech-reflexive tier: a taunting unit outranks Munti priority", () => {
    const map = makeUniformMap("plain", 10, 10);
    const mech = createHostileMechUnit("hostile_mech_amaranth_02", { x: 5, y: 5 });
    const munti = testUnit("munti", { x: 5, y: 6 }); // adjacent — would win Munti-priority on its own
    const taunter = testUnit("meeps", { x: 6, y: 5 }); // also adjacent
    taunter.taunting = true;

    const decision = decideHostileAction(map, mech, [mech, munti, taunter]);
    expect(decision.attackTargetId).toBe(taunter.instanceId);
  });

  it("mech-reflexive tier: falls back to Munti priority when the taunter can't be reached into range this turn", () => {
    const map = makeUniformMap("plain", 30, 30);
    const mech = createHostileMechUnit("hostile_mech_amaranth_02", { x: 0, y: 0 }); // meeps: moveRange 6, attackRange [1,1]
    mech.vision = 25;
    const farTaunter = testUnit("tank", { x: 20, y: 0 }); // visible, far past moveRange+attackRange
    farTaunter.taunting = true;
    const nearMunti = testUnit("munti", { x: 1, y: 0 }); // adjacent — a real, reachable kill this turn

    const decision = decideHostileAction(map, mech, [mech, farTaunter, nearMunti]);
    expect(decision.attackTargetId).toBe(nearMunti.instanceId);
  });

  it("plain reflexive tier: a taunting unit outranks the best-damage pick", () => {
    const map = makeUniformMap("plain", 10, 10);
    const crawlmass = createBloomUnit("bloom_crawlmass", { x: 5, y: 5 });
    crawlmass.side = "hostile";
    const taunter = testUnit("munti", { x: 5, y: 6 }, { tierDefense: 500 }); // adjacent, high defense — would lose the best-damage pick on its own
    taunter.taunting = true;
    const tank = testUnit("tank", { x: 6, y: 5 }); // adjacent, ordinary defense — the best-damage pick under plain reflexive rules

    const decision = decideHostileAction(map, crawlmass, [crawlmass, taunter, tank]);
    expect(decision.attackTargetId).toBe(taunter.instanceId);
  });

  it("pack tier: a taunting unit outranks the pack's own lowest-HP×DEF pick", () => {
    const map = makeUniformMap("plain", 10, 10);
    const choir = createBloomUnit("bloom_choir", { x: 5, y: 5 });
    choir.side = "hostile";
    const packmate = createBloomUnit("bloom_choir", { x: 6, y: 5 }); // within SPLITFANG_PACK_RADIUS, same pack-tier intelligence — makes packDecision route through the shared target
    packmate.side = "hostile";
    const taunter = testUnit("tank", { x: 5, y: 6 }); // adjacent, ordinary HP×DEF — would lose the pack's own pick on its own
    taunter.taunting = true;
    const weakest = testUnit("munti", { x: 6, y: 6 }, { tierDefense: 20 }); // adjacent, deliberately the lowest HP×DEF — the pack's own pick without taunt

    const decision = decideHostileAction(map, choir, [choir, packmate, taunter, weakest]);
    expect(decision.attackTargetId).toBe(taunter.instanceId);
  });

  it("has no effect on a taunting unit the hostile can't see — taunt does not grant visibility", () => {
    const map = makeUniformMap("plain", 30, 30);
    const mech = createHostileMechUnit("hostile_mech_amaranth_02", { x: 0, y: 0 });
    mech.vision = 5;
    const unseenTaunter = testUnit("meeps", { x: 20, y: 0 }); // far outside vision
    unseenTaunter.taunting = true;
    const nearTank = testUnit("tank", { x: 1, y: 0 }); // adjacent — the only actually visible target

    const decision = decideHostileAction(map, mech, [mech, unseenTaunter, nearTank]);
    expect(decision.attackTargetId).toBe(nearTank.instanceId);
  });
});

// protect_asset "overrun the zone" fallback (Maxime, 25 Aug 2026, on
// mission_amaranth_32's silent-freeze bug: "they arent intelligent, they
// are just overruning the zone... if they cant get to the ship, make theyr
// number go up"). Turned out numbers were never the lever — reflexiveDecision
// and packDecision both used to just return {} ("hold position") the instant
// nothing was visible, so a Bloom that never got within vision of a player
// unit sat frozen at its spawn tile for the whole mission, full stop, no
// matter how many of them there were. Both tiers now fall back to walking
// toward the map's defendZone when they have nothing to fight — but ONLY
// when the map has one (protect_asset only; every other objective type's
// maps have no defendZone at all, so decision stays {} there, unchanged).
describe("decideHostileAction — protect_asset defendZone fallback when nothing is visible", () => {
  it("reflexive tier: walks toward the nearest defendZone tile instead of holding, when the map has one", () => {
    const map = { ...makeUniformMap("plain", 20, 20), defendZone: [{ x: 19, y: 19 }] };
    const crawlmass = createBloomUnit("bloom_crawlmass", { x: 0, y: 0 });
    crawlmass.side = "hostile";

    const decision = decideHostileAction(map, crawlmass, [crawlmass]); // alone on the board — nothing visible
    expect(decision.attackTargetId).toBeUndefined();
    expect(decision.path).toBeDefined();
    const dest = decision.path![decision.path!.length - 1];
    // Manhattan, not Chebyshev — this grid's own movement/pathing is
    // 4-directional (no diagonal shortcuts), so a single move can easily
    // spend its whole range closing one axis and leaving the other
    // untouched. Total (dx+dy) is the metric moveToward's own distanceField
    // actually optimizes; Chebyshev's max(dx,dy) can misreport real
    // progress as a stall (or vice versa) under cardinal-only movement.
    const distBefore = Math.abs(0 - 19) + Math.abs(0 - 19);
    const distAfter = Math.abs(dest.x - 19) + Math.abs(dest.y - 19);
    expect(distAfter).toBeLessThan(distBefore);
  });

  it("reflexive tier: still holds position with nothing visible on a map with no defendZone — every non-protect_asset mission is unaffected", () => {
    const map = makeUniformMap("plain", 20, 20); // no defendZone field at all
    const crawlmass = createBloomUnit("bloom_crawlmass", { x: 0, y: 0 });
    crawlmass.side = "hostile";

    const decision = decideHostileAction(map, crawlmass, [crawlmass]);
    expect(decision).toEqual({});
  });

  it("reflexive tier: a visible target still wins over the defendZone fallback — this is a fallback, not a new priority", () => {
    const map = { ...makeUniformMap("plain", 20, 20), defendZone: [{ x: 19, y: 19 }] };
    const crawlmass = createBloomUnit("bloom_crawlmass", { x: 0, y: 0 });
    crawlmass.side = "hostile";
    crawlmass.vision = 5;
    const tank = testUnit("tank", { x: 1, y: 0 }); // adjacent and visible, opposite direction from defendZone

    const decision = decideHostileAction(map, crawlmass, [crawlmass, tank]);
    expect(decision.attackTargetId).toBe(tank.instanceId);
  });

  it("pack tier: walks toward the defendZone when neither this unit nor any packmate has a visible target", () => {
    const map = { ...makeUniformMap("plain", 20, 20), defendZone: [{ x: 19, y: 19 }] };
    const choir = createBloomUnit("bloom_choir", { x: 0, y: 0 });
    choir.side = "hostile";
    const packmate = createBloomUnit("bloom_choir", { x: 1, y: 0 }); // within SPLITFANG_PACK_RADIUS — routes through packDecision, not the lone-wolf reflexive fallback

    packmate.side = "hostile";

    const decision = decideHostileAction(map, choir, [choir, packmate]);
    expect(decision.attackTargetId).toBeUndefined();
    expect(decision.path).toBeDefined();
    const dest = decision.path![decision.path!.length - 1];
    // Manhattan, not Chebyshev — see the reflexive-tier test above's own
    // comment on why (this grid's movement is 4-directional, no diagonals).
    expect(Math.abs(dest.x - 19) + Math.abs(dest.y - 19)).toBeLessThan(38);
  });

  it("pack tier: still holds position with nothing visible on a map with no defendZone", () => {
    const map = makeUniformMap("plain", 20, 20);
    const choir = createBloomUnit("bloom_choir", { x: 0, y: 0 });
    choir.side = "hostile";
    const packmate = createBloomUnit("bloom_choir", { x: 1, y: 0 });
    packmate.side = "hostile";

    const decision = decideHostileAction(map, choir, [choir, packmate]);
    expect(decision).toEqual({});
  });
});
