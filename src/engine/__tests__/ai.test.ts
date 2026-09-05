// Fog-of-war rendering pass (Maxime, 22 Aug 2026 — "missions resolve in
// minutes, XCOM missions take hours"). unitsVisibleToSide (engine/ai.ts) is
// the new party-wide query scenes/Battle.ts uses to decide what to draw and
// what's targetable: the union of isVisibleTo(observer, target) across
// every living unit of `side` and every living unit of the opposing side.
// It's built entirely out of isVisibleTo/livingTargets, already exported
// and already covered by the hostile-AI vision-gate pass — this suite is
// about the union/aggregation behaviour on top of those, not re-testing
// Chebyshev distance or the burrow rule from scratch.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  unitsVisibleToSide,
  decideHostileAction,
  ENABLE_ENEMY_ROAM_FALLBACK,
  __setEnableUndertowAmbushHoldForTests,
  __setEnableEnemyRoamFallbackForTests,
} from "../ai";
import { Mission } from "../mission";
import { MISSION_1A } from "../../data/campaign";
import { testUnit, makeUniformMap } from "./testHelpers";
import { createHostileMechUnit, createBloomUnit } from "../units";
import { IRON_WORD_RADIUS } from "../../data/combatTables";
import { BLOOM } from "../../data/bloom";

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

  it("mech-reflexive tier: ROOTED — does NOT fall back to Munti priority (or move at all) when the taunter can't be reached into range this turn", () => {
    // Root/lock addition, 30 Aug 2026 (Maxime: "taunt should also lock the
    // target in place so they dont run away") — this used to fall through
    // to Munti-priority when the taunter itself was unreachable. It no
    // longer does: a hostile a taunt redirects is fully locked onto that
    // redirect, not just given a preference for it.
    const map = makeUniformMap("plain", 30, 30);
    const mech = createHostileMechUnit("hostile_mech_amaranth_02", { x: 0, y: 0 }); // meeps: moveRange 6, attackRange [1,1]
    mech.vision = 25;
    const farTaunter = testUnit("tank", { x: 20, y: 0 }); // visible, far past moveRange+attackRange
    farTaunter.taunting = true;
    const nearMunti = testUnit("munti", { x: 1, y: 0 }); // adjacent — a real, reachable kill, but no longer considered while rooted by taunt

    const decision = decideHostileAction(map, mech, [mech, farTaunter, nearMunti]);
    expect(decision.attackTargetId).toBeUndefined();
    expect(decision.path).toBeUndefined();
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

// oath_iron_word (Vindex/The Iron Oath, Vault Phase 2 slice 1, 2 Sep 2026) —
// the same redirect as abil_taunt above, but gated to hostiles within
// tauntRadius of the taunter. Set directly on the unit, same as every test
// above (Mission.ironWord() itself is abilities.test.ts's own job, mirrored
// now by heirloomVaultAbilities.test.ts). The radius check lives in the
// `taunter` lookup itself (`targets.find((t) => t.taunting && (t.tauntRadius
// === undefined || chebyshevDistance(...) <= t.tauntRadius))`), so this is
// really one new describe block per redirect tier could theoretically need —
// mech-reflexive is enough to prove the gate works; the "plain abil_taunt
// still ignores distance" half is the load-bearing regression check.
describe("decideHostileAction — oath_iron_word's radius gate (tauntRadius-bearing taunters only redirect hostiles within it)", () => {
  it("a hostile WITHIN tauntRadius, already adjacent: redirected and attacks in place, same as plain Taunt", () => {
    const map = makeUniformMap("plain", 20, 20);
    const mech = createHostileMechUnit("hostile_mech_amaranth_02", { x: 0, y: 0 });
    mech.vision = 25;
    const taunter = testUnit("tank", { x: 1, y: 0 }); // adjacent — inPlaceTarget picks it up with no movement needed
    taunter.taunting = true;
    taunter.tauntRadius = IRON_WORD_RADIUS;
    const munti = testUnit("munti", { x: 0, y: 1 }); // also adjacent — would win Munti-priority on its own, per the plain-Taunt precedent above

    const decision = decideHostileAction(map, mech, [mech, taunter, munti]);
    expect(decision.attackTargetId).toBe(taunter.instanceId);
  });

  it("a hostile WITHIN tauntRadius but NOT already adjacent: ROOTED, same ROOT/LOCK rule as plain Taunt — does not fall through to a closer, easier target", () => {
    // This is the case that actually needed a second look: Taunt's own
    // ROOT/LOCK rule (this file's header comment, "if it can already attack
    // the taunting unit... if not, it does NOTHING this turn rather than
    // moving to close distance") fires the instant a taunter is found and
    // isn't already in range — it never tries to path toward it, radius
    // gate or not. So "within radius" for Iron Word doesn't mean "will walk
    // over and hit it"; it means "is even recognized as a taunter at all,"
    // same as plain Taunt always has been.
    const map = makeUniformMap("plain", 20, 20);
    const mech = createHostileMechUnit("hostile_mech_amaranth_02", { x: 0, y: 0 }); // meeps: moveRange 6, attackRange [1,1]
    mech.vision = 25;
    const taunter = testUnit("tank", { x: IRON_WORD_RADIUS, y: 0 }); // within radius, but not adjacent
    taunter.taunting = true;
    taunter.tauntRadius = IRON_WORD_RADIUS;
    const closer = testUnit("meeps", { x: 1, y: 0 }); // adjacent, and NOT the taunter — would be the obvious pick if taunt weren't recognized here

    const decision = decideHostileAction(map, mech, [mech, taunter, closer]);
    expect(decision.attackTargetId).toBeUndefined();
    expect(decision.path).toBeUndefined();
  });

  it("a hostile OUTSIDE tauntRadius is NOT recognized as taunted at all — falls through to its own normal targeting instead", () => {
    const map = makeUniformMap("plain", 20, 20);
    const mech = createHostileMechUnit("hostile_mech_amaranth_02", { x: 0, y: 0 });
    mech.vision = 25;
    const taunter = testUnit("tank", { x: IRON_WORD_RADIUS + 1, y: 0 }); // one tile past the radius
    taunter.taunting = true;
    taunter.tauntRadius = IRON_WORD_RADIUS;
    const closer = testUnit("meeps", { x: 1, y: 0 }); // adjacent — with the taunter excluded, this is a completely ordinary pick

    const decision = decideHostileAction(map, mech, [mech, taunter, closer]);
    expect(decision.attackTargetId).toBe(closer.instanceId);
  });

  it("REGRESSION: a plain abil_taunt user (tauntRadius undefined) is still recognized as a taunter at ANY distance — purely additive, zero behavior change", () => {
    // Mirrors the pre-existing "ROOTED — does NOT fall back to Munti
    // priority" test above almost exactly (same shape, same expected
    // outcome) — the point here is narrower: proving the radius-gate edit
    // itself (`t.tauntRadius === undefined || ...`) didn't accidentally
    // start filtering out a tauntRadius-less taunter at long range too.
    const map = makeUniformMap("plain", 30, 30);
    const mech = createHostileMechUnit("hostile_mech_amaranth_02", { x: 0, y: 0 }); // meeps: moveRange 6, attackRange [1,1]
    mech.vision = 25;
    const farPlainTaunter = testUnit("tank", { x: 20, y: 0 }); // far past any Iron Word radius, and this is plain Taunt: no tauntRadius at all
    farPlainTaunter.taunting = true;
    expect(farPlainTaunter.tauntRadius).toBeUndefined();
    const closer = testUnit("meeps", { x: 1, y: 0 }); // would otherwise be the obvious pick

    const decision = decideHostileAction(map, mech, [mech, farPlainTaunter, closer]);
    expect(decision.attackTargetId).toBeUndefined(); // rooted on the far taunter, not diverted onto `closer`
    expect(decision.path).toBeUndefined();
  });
});

// Root/lock addition, 30 Aug 2026 — Maxime, on the PvP use of Taunt:
// "taunt should also lock the target in place so they dont run away." Every
// hostile a targeting tier redirects onto the taunting unit is also fully
// rooted: attacks in place if it can, does NOTHING (no path, no fallback to
// a different target) if it can't. The mech-reflexive case is covered
// inline above (same describe block, same "outranks Munti priority" story);
// this block covers the other three tiers plus the in-place case, which
// none of the tests above happen to isolate cleanly.
describe("decideHostileAction — abil_taunt's root/lock (rooted hostiles don't move)", () => {
  it("plain reflexive tier: attacks in place when the taunter is already in range — root doesn't block a legitimate in-place hit", () => {
    const map = makeUniformMap("plain", 10, 10);
    const crawlmass = createBloomUnit("bloom_crawlmass", { x: 5, y: 5 });
    crawlmass.side = "hostile";
    const taunter = testUnit("meeps", { x: 5, y: 6 }); // adjacent
    taunter.taunting = true;

    const decision = decideHostileAction(map, crawlmass, [crawlmass, taunter]);
    expect(decision.attackTargetId).toBe(taunter.instanceId);
    expect(decision.path).toBeUndefined();
  });

  it("plain reflexive tier: ROOTED — stands still (no path, no attack) rather than closing distance on an out-of-range taunter", () => {
    const map = makeUniformMap("plain", 30, 30);
    const crawlmass = createBloomUnit("bloom_crawlmass", { x: 0, y: 0 });
    crawlmass.side = "hostile";
    crawlmass.vision = 25;
    const farTaunter = testUnit("meeps", { x: 20, y: 0 }); // visible, far past moveRange+attackRange
    farTaunter.taunting = true;

    const decision = decideHostileAction(map, crawlmass, [crawlmass, farTaunter]);
    expect(decision.attackTargetId).toBeUndefined();
    expect(decision.path).toBeUndefined();
  });

  it("pack tier: ROOTED — a packmate doesn't close distance on an out-of-range taunter either", () => {
    const map = makeUniformMap("plain", 30, 30);
    const choir = createBloomUnit("bloom_choir", { x: 0, y: 0 });
    choir.side = "hostile";
    choir.vision = 25;
    const packmate = createBloomUnit("bloom_choir", { x: 1, y: 0 }); // within SPLITFANG_PACK_RADIUS — routes through packDecision
    packmate.side = "hostile";
    const farTaunter = testUnit("tank", { x: 20, y: 0 });
    farTaunter.taunting = true;

    const decision = decideHostileAction(map, choir, [choir, packmate, farTaunter]);
    expect(decision.attackTargetId).toBeUndefined();
    expect(decision.path).toBeUndefined();
  });

  it("emergent tier: ROOTED — a boss with real move range still doesn't chase an out-of-range taunter (distinct from the moveRange===0 sessile case every live boss happens to have)", () => {
    const map = makeUniformMap("plain", 30, 30);
    const boss = createBloomUnit("bloom_wellroot", { x: 0, y: 0 }); // attackRange [1,3]
    boss.side = "hostile";
    boss.moveRange = 5; // every real emergent archetype is sessile (moveRange 0) — overridden here so this test actually isolates root from "can't move anyway"
    const farTaunter = testUnit("meeps", { x: 20, y: 0 }); // outside attackRange, otherwise reachable if this weren't rooted

    farTaunter.taunting = true;
    const decision = decideHostileAction(map, boss, [boss, farTaunter]);
    expect(decision.attackTargetId).toBeUndefined();
    expect(decision.path).toBeUndefined();
  });

  it("emergent tier: attacks in place when the taunter is already in range", () => {
    const map = makeUniformMap("plain", 10, 10);
    const boss = createBloomUnit("bloom_wellroot", { x: 5, y: 5 }); // attackRange [1,3]
    boss.side = "hostile";
    const taunter = testUnit("meeps", { x: 5, y: 7 }); // distance 2 — in range, not adjacent
    taunter.taunting = true;

    const decision = decideHostileAction(map, boss, [boss, taunter]);
    expect(decision.attackTargetId).toBe(taunter.instanceId);
    expect(decision.path).toBeUndefined();
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

// Enemy-roam fallback, generalized 30 Aug 2026 (Maxime, live playtest: "we
// also need to make our enemy roam so they have more chance of attacking
// the player" — see the Enemy Roaming & Mission Difficulty plan doc, and
// idleRoamTarget's own comment in ai.ts). The defendZone fallback above was
// scoped to protect_asset maps only; this extends the same mechanism to
// every map via deployZones.player, which — unlike defendZone — is a
// required field on every MapDefinition, so this reaches all 40 campaign
// missions, not one objective type.
describe("decideHostileAction — deployZones.player roam fallback when nothing is visible and there's no defendZone", () => {
  // Shipped ON by default, 30 Aug 2026 — see ai.ts's own doc comment on
  // ENABLE_ENEMY_ROAM_FALLBACK for the full sequence: the campaign sim
  // sweep this plan always said was required first found a real problem
  // (71%→54% aggregate, several missions to near-0%), that was reported
  // to Maxime rather than guessed past, and his actual call was to accept
  // the commander-focus-fire concentration as intended pressure and fix
  // the extract_unit break specifically (BattleUnit.isExtractionTarget,
  // see the describe block below this one) rather than hold the whole
  // mechanism back. `let`, not `const`, stays anyway — the killswitch
  // shape is worth keeping even on by default, and this block still uses
  // the test-only setter to pin the flag for its own assertions rather
  // than depending on whatever the live default happens to be.
  const originalFlag = ENABLE_ENEMY_ROAM_FALLBACK;
  beforeAll(() => {
    __setEnableEnemyRoamFallbackForTests(true);
  });
  afterAll(() => {
    __setEnableEnemyRoamFallbackForTests(originalFlag);
  });

  it("ships ON by default — Maxime's call after seeing the campaign sweep's findings, not a default anyone should flip back without asking first", () => {
    expect(originalFlag).toBe(true);
  });

  it("reflexive tier: walks toward the nearest player deployZone tile instead of holding, when the map has no defendZone", () => {
    const map = { ...makeUniformMap("plain", 20, 20), deployZones: { player: [{ x: 19, y: 19 }], enemy: [] } };
    const crawlmass = createBloomUnit("bloom_crawlmass", { x: 0, y: 0 });
    crawlmass.side = "hostile";

    const decision = decideHostileAction(map, crawlmass, [crawlmass]); // alone on the board — nothing visible
    expect(decision.attackTargetId).toBeUndefined();
    expect(decision.path).toBeDefined();
    const dest = decision.path![decision.path!.length - 1];
    const distBefore = Math.abs(0 - 19) + Math.abs(0 - 19); // Manhattan — see the defendZone suite's own comment on why
    const distAfter = Math.abs(dest.x - 19) + Math.abs(dest.y - 19);
    expect(distAfter).toBeLessThan(distBefore);
  });

  it("reflexive tier: defendZone still wins over deployZones.player when a map has both — the more specific, most-literal fallback takes priority", () => {
    const map = {
      ...makeUniformMap("plain", 20, 20),
      defendZone: [{ x: 0, y: 19 }],
      deployZones: { player: [{ x: 19, y: 0 }], enemy: [] }, // opposite corner from defendZone
    };
    const crawlmass = createBloomUnit("bloom_crawlmass", { x: 0, y: 0 });
    crawlmass.side = "hostile";

    const decision = decideHostileAction(map, crawlmass, [crawlmass]);
    const dest = decision.path![decision.path!.length - 1];
    // Walked toward (0,19), not (19,0) — y decreased its distance, x didn't move toward 19.
    expect(dest.x).toBe(0);
  });

  it("reflexive tier: a visible target still wins over the deployZones.player fallback — this is a fallback, not a new priority", () => {
    const map = { ...makeUniformMap("plain", 20, 20), deployZones: { player: [{ x: 19, y: 19 }], enemy: [] } };
    const crawlmass = createBloomUnit("bloom_crawlmass", { x: 0, y: 0 });
    crawlmass.side = "hostile";
    crawlmass.vision = 5;
    const tank = testUnit("tank", { x: 1, y: 0 }); // adjacent and visible, opposite direction from the deploy zone

    const decision = decideHostileAction(map, crawlmass, [crawlmass, tank]);
    expect(decision.attackTargetId).toBe(tank.instanceId);
  });

  it("reflexive tier: still holds position with nothing visible on a map with neither defendZone nor a populated deployZones.player", () => {
    const map = makeUniformMap("plain", 20, 20); // deployZones.player: [] per testHelpers' own default
    const crawlmass = createBloomUnit("bloom_crawlmass", { x: 0, y: 0 });
    crawlmass.side = "hostile";

    const decision = decideHostileAction(map, crawlmass, [crawlmass]);
    expect(decision).toEqual({});
  });

  it("pack tier: walks toward the player deployZone when neither this unit nor any packmate has a visible target, and there's no defendZone", () => {
    const map = { ...makeUniformMap("plain", 20, 20), deployZones: { player: [{ x: 19, y: 19 }], enemy: [] } };
    const choir = createBloomUnit("bloom_choir", { x: 0, y: 0 });
    choir.side = "hostile";
    const packmate = createBloomUnit("bloom_choir", { x: 1, y: 0 });
    packmate.side = "hostile";

    const decision = decideHostileAction(map, choir, [choir, packmate]);
    expect(decision.attackTargetId).toBeUndefined();
    expect(decision.path).toBeDefined();
    const dest = decision.path![decision.path!.length - 1];
    expect(Math.abs(dest.x - 19) + Math.abs(dest.y - 19)).toBeLessThan(38);
  });
});

// "Enemy ignore rescue" (30 Aug 2026 — Maxime, after the roam fallback's
// campaign sweep found mission_amaranth_26's stranded extraction target
// dying to a roaming Undertow: "for the rescue, make it so enemy ignore
// rescue. like the save the civilian mission in xcom"). See
// BattleUnit.isExtractionTarget's own comment (units.ts) for the full
// design — this suite proves the actual exclusion mechanism, engine/ai.ts's
// isTargetableBy, at the two places a reflexive/pack-tier hostile ever
// builds a target list.
describe("decideHostileAction — isExtractionTarget: a hostile never attacks or chases the extraction target", () => {
  it("reflexive tier: with nothing else visible, an adjacent extraction target is not attacked — falls through to the roam/hold fallback instead", () => {
    const map = makeUniformMap("plain", 20, 20); // deployZones.player: [] — nothing to roam toward either
    const crawlmass = createBloomUnit("bloom_crawlmass", { x: 0, y: 0 });
    crawlmass.side = "hostile";
    crawlmass.vision = 5;
    const okafor = testUnit("tank", { x: 1, y: 0 }); // adjacent, well within vision and attack range
    okafor.isExtractionTarget = true;

    const decision = decideHostileAction(map, crawlmass, [crawlmass, okafor]);
    expect(decision.attackTargetId).toBeUndefined();
    expect(decision).toEqual({}); // no defendZone, no populated deployZones.player — holds, doesn't attack her by default either
  });

  it("reflexive tier: a normal visible unit is still attacked even with the extraction target also in range — she's skipped, not everyone", () => {
    const map = makeUniformMap("plain", 20, 20);
    const crawlmass = createBloomUnit("bloom_crawlmass", { x: 0, y: 0 });
    crawlmass.side = "hostile";
    crawlmass.vision = 5;
    const okafor = testUnit("tank", { x: 1, y: 0 });
    okafor.isExtractionTarget = true;
    const anand = testUnit("meeps", { x: 0, y: 1 }); // also adjacent, NOT the extraction target

    const decision = decideHostileAction(map, crawlmass, [crawlmass, okafor, anand]);
    expect(decision.attackTargetId).toBe(anand.instanceId);
  });

  it("reflexive tier: roams toward deployZones.player instead of holding, when the extraction target is the only 'visible' unit and a deploy zone exists", () => {
    const map = { ...makeUniformMap("plain", 20, 20), deployZones: { player: [{ x: 19, y: 19 }], enemy: [] } };
    const crawlmass = createBloomUnit("bloom_crawlmass", { x: 0, y: 0 });
    crawlmass.side = "hostile";
    crawlmass.vision = 5;
    const okafor = testUnit("tank", { x: 1, y: 0 });
    okafor.isExtractionTarget = true;

    const decision = decideHostileAction(map, crawlmass, [crawlmass, okafor]);
    expect(decision.attackTargetId).toBeUndefined();
    expect(decision.path).toBeDefined(); // roamed toward deploy, exactly as if okafor weren't on the board at all
  });

  it("pack tier: sharedPackTarget skips her too — a pack with only the extraction target 'visible' has no target, not a taunt-free pick of her", () => {
    const map = makeUniformMap("plain", 20, 20);
    const choir = createBloomUnit("bloom_choir", { x: 0, y: 0 });
    choir.side = "hostile";
    choir.vision = 5;
    const okafor = testUnit("tank", { x: 1, y: 0 });
    okafor.isExtractionTarget = true;

    const decision = decideHostileAction(map, choir, [choir, okafor]);
    expect(decision.attackTargetId).toBeUndefined();
    expect(decision).toEqual({}); // no defendZone, no deployZones.player on this map — holds
  });

  it("pack tier: a packmate's own normal target still wins even when the extraction target is the closer/weaker option", () => {
    const map = makeUniformMap("plain", 20, 20);
    const choir = createBloomUnit("bloom_choir", { x: 0, y: 0 });
    choir.side = "hostile";
    choir.vision = 5;
    const okafor = testUnit("tank", { x: 1, y: 0 }, { hp: 1, maxHp: 100 }); // adjacent AND critically low — would win "lowest HP x DEF" if eligible at all
    okafor.isExtractionTarget = true;
    const anand = testUnit("meeps", { x: 3, y: 0 });

    const decision = decideHostileAction(map, choir, [choir, okafor, anand]);
    expect(decision.attackTargetId).not.toBe(okafor.instanceId);
  });
});

// Undertow ambush hold, 3 Sep 2026 — Bloom_Wars_Undertow_Ambush_Hold_Scoping_v1.
// The bug this closes: idleRoamTarget checks map.defendZone FIRST and
// unconditionally, and every protect_asset map has one, so "hold position"
// was not a reachable outcome on those maps at all. An ambusher that walks
// at you in the open is not an ambusher.
describe("holdWhenIdle — the ambush hold", () => {
  // Shipped OFF (see ENABLE_UNDERTOW_AMBUSH_HOLD's own doc comment in
  // ai.ts for the measured reason), so these tests turn it on and put it
  // back — the same shape the ENABLE_ENEMY_ROAM_FALLBACK block above uses
  // to exercise a mechanism regardless of its live default.
  beforeAll(() => __setEnableUndertowAmbushHoldForTests(true));
  afterAll(() => __setEnableUndertowAmbushHoldForTests(false));

  function holdMap() {
    const map = makeUniformMap("plain", 12, 12);
    map.defendZone = [{ x: 1, y: 1 }];
    return map;
  }

  it("an Undertow with nothing visible holds instead of walking the defendZone", () => {
    const map = holdMap();
    const undertow = createBloomUnit("bloom_undertow", { x: 8, y: 8 });
    const decision = decideHostileAction(map, undertow, [undertow]);
    expect(decision.path).toBeUndefined();
    expect(decision.attackTargetId).toBeUndefined();
  });

  it("but still attacks the moment something IS visible — holding is not passivity", () => {
    const map = holdMap();
    const undertow = createBloomUnit("bloom_undertow", { x: 8, y: 8 });
    const prey = testUnit("tank", { x: 8, y: 9 });
    const decision = decideHostileAction(map, undertow, [undertow, prey]);
    expect(decision.attackTargetId).toBe(prey.instanceId);
  });

  it("a Crawlmass on the same map still roams — the flag is opt-in, not a change for everyone", () => {
    const map = holdMap();
    const crawl = createBloomUnit("bloom_crawlmass", { x: 8, y: 8 });
    const decision = decideHostileAction(map, crawl, [crawl]);
    expect(decision.path).toBeDefined();
  });

  it("holds nothing when the feature flag is off — the shipped default", () => {
    __setEnableUndertowAmbushHoldForTests(false);
    const map = holdMap();
    const undertow = createBloomUnit("bloom_undertow", { x: 8, y: 8 });
    expect(decideHostileAction(map, undertow, [undertow]).path).toBeDefined();
    __setEnableUndertowAmbushHoldForTests(true);
  });

  it("only the Undertow carries the flag today", () => {
    const flagged = Object.values(BLOOM).filter((b) => b.holdWhenIdle);
    expect(flagged.map((b) => b.id)).toEqual(["bloom_undertow"]);
  });
});
