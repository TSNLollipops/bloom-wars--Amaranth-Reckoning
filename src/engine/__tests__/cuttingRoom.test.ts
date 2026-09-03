// Vault Phase 2, slice 4 (3 Sep 2026) — Zanretsu's full 3-ability kit:
// cutting_room_charge, cutting_room_momentum, cutting_room_sure_footing
// (Vann Rethwick, House Rethwick, centauroid chassis, Meeps path). See
// data/heirlooms.ts's own "cutting_room" entry and engine/mission.ts's
// cuttingRoomCharge() header comment for the full design. Sibling file to
// cinderLine.test.ts (slice 3's own Surtr kit) — same house test style
// throughout, including that file's own stated convention of keeping a
// local copy of quietMission()/pilot()/mover()/grant()/logsMatching()
// rather than importing them.
//
// Every genuinely ambiguous piece of cutting_room_charge's own prose that
// this file pins down has its full reasoning at cuttingRoomCharge()'s own
// header comment in engine/mission.ts, not repeated here — these tests
// assert the BEHAVIOR that comment already commits to.
import { describe, it, expect } from "vitest";
import { Mission } from "../mission";
import { AMARANTH_MISSION_1 } from "../../data/campaignAmaranth";
import { createHostileMechUnit, createBloomUnit, type BattleUnit } from "../units";
import {
  MAX_ACTIONS_PER_TURN,
  CUTTING_ROOM_CHARGE_MAX_LINE_TILES,
  CUTTING_ROOM_CHARGE_FALLOFF_MULTIPLIER,
  CUTTING_ROOM_CHARGE_COOLDOWN_TURNS,
  CUTTING_ROOM_MOMENTUM_MOVE_BONUS,
  CUTTING_ROOM_SURE_FOOTING_DURATION_TURNS,
  CUTTING_ROOM_SURE_FOOTING_RANK5_DURATION_TURNS,
  CUTTING_ROOM_SURE_FOOTING_COOLDOWN_TURNS,
} from "../../data/combatTables";

const PARK: Record<string, { x: number; y: number }> = {
  pilot_rourke: { x: 0, y: 0 },
  pilot_bosk: { x: 1, y: 0 },
  pilot_iyari: { x: 2, y: 0 },
  pilot_anand: { x: 3, y: 0 },
  pilot_lask: { x: 4, y: 0 },
};

// rng always returns 1 (never < MEEPS_DODGE_CHANCE) so every Meeps-path
// victim's dodge roll — and every dodge-eligible counter-roll — is
// deterministically "no dodge" throughout this file. Damage numbers below
// would otherwise be flaky against hostile_mech_02 (Meeps path, mover()'s
// own default).
function quietMission(): Mission {
  const mission = new Mission(AMARANTH_MISSION_1, undefined, [], { rng: () => 1 });
  for (const u of mission.units) {
    if (u.side === "hostile") u.downed = true;
    else u.pos = { ...PARK[u.pilotId!] };
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

function mover(mission: Mission, pos: { x: number; y: number }, opts?: { hp?: number }): BattleUnit {
  const h = createHostileMechUnit("hostile_mech_02", { ...pos });
  h.moveRange = 0;
  h.vision = 0;
  if (opts?.hp !== undefined) {
    h.currentHp = opts.hp;
    h.maxHp = opts.hp;
  }
  mission.units.push(h);
  return h;
}

function grant(unit: BattleUnit, abilityId: string, rank = 1): void {
  unit.abilities = [...unit.abilities, abilityId];
  unit.heirloomAbilityRanks = { ...unit.heirloomAbilityRanks, [abilityId]: rank };
}

function clearTerrain(mission: Mission, coords: { x: number; y: number }[], tile: "plain" = "plain") {
  for (const { x, y } of coords) mission.map.tiles[y][x] = tile;
}

const logsMatching = (mission: Mission, needle: string) => mission.log.filter((l) => l.includes(needle));

const LINE_TILES = [
  { x: 5, y: 5 },
  { x: 6, y: 5 },
  { x: 7, y: 5 },
  { x: 8, y: 5 },
  { x: 9, y: 5 },
  { x: 10, y: 5 },
];

function setupWielder(mission: Mission, rank = 1): BattleUnit {
  const halden = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
  clearTerrain(mission, LINE_TILES);
  grant(halden, "cutting_room_charge", rank);
  return halden;
}

// =====================================================================
// cutting_room_charge — targeting shape (cardinal-only, passability)
// =====================================================================

describe("Mission.cuttingRoomCharge — targeting shape", () => {
  it("getCuttingRoomChargeAreaFrom: only the 4 cardinal directions, up to CUTTING_ROOM_CHARGE_MAX_LINE_TILES, wielder's own tile excluded", () => {
    const mission = quietMission();
    const halden = setupWielder(mission);
    const area = mission.getCuttingRoomChargeAreaFrom(halden.instanceId, halden.pos);
    expect(area).toEqual(
      expect.arrayContaining([
        { x: 6, y: 5 },
        { x: 5 + CUTTING_ROOM_CHARGE_MAX_LINE_TILES, y: 5 },
        { x: 4, y: 5 },
        { x: 5, y: 6 },
        { x: 5, y: 4 },
      ])
    );
    // No diagonal entries at all — CUTTING_ROOM_CHARGE_DIRECTIONS is
    // cardinal-only, unlike CINDER_LINE_DIRECTIONS.
    expect(area).not.toContainEqual({ x: 6, y: 6 });
    expect(area).not.toContainEqual({ x: 4, y: 4 });
    expect(area).not.toContainEqual({ x: 5, y: 5 });
  });

  it("previewCuttingRoomChargeFrom matches cuttingRoomChargeLineTo's own result, and is null for a diagonal / illegal endpoint", () => {
    const mission = quietMission();
    const halden = setupWielder(mission);
    expect(mission.previewCuttingRoomChargeFrom(halden.instanceId, { x: 8, y: 5 })).toEqual([
      { x: 6, y: 5 },
      { x: 7, y: 5 },
      { x: 8, y: 5 },
    ]);
    expect(mission.previewCuttingRoomChargeFrom(halden.instanceId, { x: 7, y: 6 })).toBeNull(); // diagonal
    expect(mission.previewCuttingRoomChargeFrom(halden.instanceId, { x: 5, y: 5 })).toBeNull(); // own tile
    expect(mission.previewCuttingRoomChargeFrom(halden.instanceId, { x: 5 + CUTTING_ROOM_CHARGE_MAX_LINE_TILES + 1, y: 5 })).toBeNull(); // beyond max
  });

  it("a wall blocks the charge — the area stops before it, and a target beyond it is illegal", () => {
    const mission = quietMission();
    const halden = setupWielder(mission);
    mission.map.tiles[5][7] = "wall"; // two tiles east of the wielder
    const area = mission.getCuttingRoomChargeAreaFrom(halden.instanceId, halden.pos);
    expect(area).toContainEqual({ x: 6, y: 5 });
    expect(area).not.toContainEqual({ x: 7, y: 5 });
    expect(area).not.toContainEqual({ x: 8, y: 5 });
    expect(mission.previewCuttingRoomChargeFrom(halden.instanceId, { x: 8, y: 5 })).toBeNull();
    expect(mission.cuttingRoomCharge(halden.instanceId, { x: 8, y: 5 })).toBe(false);
  });

  it("ignores terrain COST, not passability: a moveRange-1 wielder still charges the full line across rubble", () => {
    const mission = quietMission();
    const halden = setupWielder(mission);
    halden.moveRange = 1; // rubble alone (centauroid cost 3) would normally block this after zero tiles
    mission.map.tiles[5][6] = "rubble";
    mission.map.tiles[5][7] = "rubble";
    mission.map.tiles[5][8] = "rubble";
    const victim = mover(mission, { x: 9, y: 5 });

    const area = mission.getCuttingRoomChargeAreaFrom(halden.instanceId, halden.pos);
    expect(area).toContainEqual({ x: 9, y: 5 });
    expect(mission.cuttingRoomCharge(halden.instanceId, { x: 9, y: 5 })).toBe(true);
    expect(victim.currentHp).toBeLessThan(victim.maxHp);
    expect(halden.pos).toEqual({ x: 8, y: 5 }); // adjacent to the one enemy hit
  });

  it("refuses a unit without the ability, an unknown id, a downed unit, a spent unit, and any hostile", () => {
    const mission = quietMission();
    const iyari = pilot(mission, "pilot_iyari", { x: 5, y: 5 });
    expect(iyari.abilities).not.toContain("cutting_room_charge");
    expect(mission.cuttingRoomCharge(iyari.instanceId, { x: 8, y: 5 })).toBe(false);

    expect(mission.cuttingRoomCharge("no_such_unit", { x: 8, y: 5 })).toBe(false);

    const hostile = mover(mission, { x: 15, y: 8 });
    grant(hostile, "cutting_room_charge", 1);
    expect(mission.canCuttingRoomCharge(hostile.instanceId)).toBe(false);

    const halden = setupWielder(mission);
    halden.actionsRemaining = 0;
    expect(mission.canCuttingRoomCharge(halden.instanceId)).toBe(false);
    halden.actionsRemaining = MAX_ACTIONS_PER_TURN;
    halden.downed = true;
    expect(mission.canCuttingRoomCharge(halden.instanceId)).toBe(false);
  });

  it("is gated by CUTTING_ROOM_CHARGE_COOLDOWN_TURNS — refused right after use, ready exactly on schedule", () => {
    const mission = quietMission();
    const halden = setupWielder(mission);
    mission.cuttingRoomCharge(halden.instanceId, { x: 8, y: 5 });
    const readyAtTurn = mission.turn + CUTTING_ROOM_CHARGE_COOLDOWN_TURNS;
    halden.actionsRemaining = MAX_ACTIONS_PER_TURN;
    mission.turn = readyAtTurn - 1;
    expect(mission.canCuttingRoomCharge(halden.instanceId)).toBe(false);
    mission.turn = readyAtTurn;
    expect(mission.canCuttingRoomCharge(halden.instanceId)).toBe(true);
  });
});

// =====================================================================
// cutting_room_charge — hit resolution: 0/1/2/3+ enemies, falloff, landing
// =====================================================================

describe("Mission.cuttingRoomCharge — hit resolution and landing position", () => {
  it("zero enemies on the line: still a legal (wasted) action, ends the turn, wielder moves the full line length", () => {
    const mission = quietMission();
    const halden = setupWielder(mission);
    expect(mission.cuttingRoomCharge(halden.instanceId, { x: 8, y: 5 })).toBe(true);
    expect(halden.pos).toEqual({ x: 8, y: 5 }); // as far up the chosen line as the wielder can legally stand
    expect(halden.actionsRemaining).toBe(0);
    expect(logsMatching(mission, "nothing there to hit").length).toBe(1);
  });

  it("one enemy hit: full damage (reuses the ordinary resolveMechAttack formula), wielder ends adjacent to it", () => {
    const mission = quietMission();
    const halden = setupWielder(mission);
    const victim = mover(mission, { x: 8, y: 5 }, { hp: 999 });

    expect(mission.cuttingRoomCharge(halden.instanceId, { x: 8, y: 5 })).toBe(true);
    expect(victim.currentHp).toBeLessThan(999);
    expect(halden.pos).toEqual({ x: 7, y: 5 }); // one tile before the victim
    expect(logsMatching(mission, "1 hit").length).toBe(1);
  });

  // Every multi-victim test below starts placing victims at (7,5) — index 1
  // of the line, Chebyshev distance 2 from the wielder's own (5,5) start —
  // rather than the closer (6,5). Deliberate: hostile_mech_02 (Meeps path)
  // has counterMaxRange 1, and `attacker.pos` (the wielder) doesn't move
  // until AFTER the whole hits loop finishes (see cuttingRoomCharge()'s own
  // header comment), so a victim placed exactly 1 tile from the wielder's
  // STARTING position could land a real counter mid-loop and reduce the
  // wielder's currentHp/maxHp ratio before the next victim's own damage is
  // computed — a real interaction (missileStrike's own doc calls out the
  // identical case), just not what THESE tests are isolating. Starting at
  // distance 2 keeps every victim here out of counter range of the
  // wielder's fixed starting tile, so cross-victim damage comparisons stay
  // apples-to-apples.
  it("two enemies hit at rank 1: neither takes the 3rd+ falloff (both are full damage)", () => {
    const missionA = quietMission();
    const halden = setupWielder(missionA);
    const soloVictim = mover(missionA, { x: 7, y: 5 }, { hp: 999 });
    missionA.cuttingRoomCharge(halden.instanceId, { x: 7, y: 5 });
    const soloDamage = 999 - soloVictim.currentHp;

    const missionB = quietMission();
    const halden2 = setupWielder(missionB);
    const v1 = mover(missionB, { x: 7, y: 5 }, { hp: 999 });
    const v2 = mover(missionB, { x: 8, y: 5 }, { hp: 999 });
    missionB.cuttingRoomCharge(halden2.instanceId, { x: 8, y: 5 });

    expect(999 - v1.currentHp).toBe(soloDamage);
    expect(999 - v2.currentHp).toBe(soloDamage);
  });

  it("three enemies hit at rank 1: the 3rd falls off by CUTTING_ROOM_CHARGE_FALLOFF_MULTIPLIER, the first two don't", () => {
    const mission = quietMission();
    const halden = setupWielder(mission, 1);
    const v1 = mover(mission, { x: 7, y: 5 }, { hp: 999 });
    const v2 = mover(mission, { x: 8, y: 5 }, { hp: 999 });
    const v3 = mover(mission, { x: 9, y: 5 }, { hp: 999 });

    expect(mission.cuttingRoomCharge(halden.instanceId, { x: 9, y: 5 })).toBe(true);
    const fullDamage = 999 - v1.currentHp;
    expect(999 - v2.currentHp).toBe(fullDamage);
    const thirdDamage = 999 - v3.currentHp;
    expect(thirdDamage).toBe(Math.round(fullDamage * CUTTING_ROOM_CHARGE_FALLOFF_MULTIPLIER));
    expect(thirdDamage).toBeLessThan(fullDamage);
  });

  it("rank 5: the 3rd+ target takes full damage too, no falloff", () => {
    const mission = quietMission();
    const halden = setupWielder(mission, 5);
    const v1 = mover(mission, { x: 7, y: 5 }, { hp: 999 });
    const v2 = mover(mission, { x: 8, y: 5 }, { hp: 999 });
    const v3 = mover(mission, { x: 9, y: 5 }, { hp: 999 });
    const v4 = mover(mission, { x: 10, y: 5 }, { hp: 999 });

    expect(mission.cuttingRoomCharge(halden.instanceId, { x: 10, y: 5 })).toBe(true);
    const fullDamage = 999 - v1.currentHp;
    expect(999 - v2.currentHp).toBe(fullDamage);
    expect(999 - v3.currentHp).toBe(fullDamage);
    expect(999 - v4.currentHp).toBe(fullDamage);
  });

  it("landing tile skips over an occupied tile: two enemies packed at the far end land the wielder short of the last one hit", () => {
    const mission = quietMission();
    const halden = setupWielder(mission);
    // (6,5) stays empty; (7,5) and (8,5) both hold a living hostile.
    mover(mission, { x: 7, y: 5 }, { hp: 999 });
    const last = mover(mission, { x: 8, y: 5 }, { hp: 999 });

    expect(mission.cuttingRoomCharge(halden.instanceId, { x: 8, y: 5 })).toBe(true);
    expect(last.downed).toBe(false); // still standing — its own tile is still occupied
    expect(halden.pos).toEqual({ x: 6, y: 5 }); // (7,5) is occupied, so the scan falls back one tile further
  });

  it("landing tile fallback: every candidate tile occupied — the wielder doesn't move at all", () => {
    const mission = quietMission();
    const halden = setupWielder(mission);
    mover(mission, { x: 6, y: 5 }, { hp: 999 });
    mover(mission, { x: 7, y: 5 }, { hp: 999 });
    mover(mission, { x: 8, y: 5 }, { hp: 999 });

    expect(mission.cuttingRoomCharge(halden.instanceId, { x: 8, y: 5 })).toBe(true);
    expect(halden.pos).toEqual({ x: 5, y: 5 }); // no legal landing tile anywhere on the line — stays put
  });
});

// =====================================================================
// cutting_room_momentum — passive trigger, one round only
// =====================================================================

describe("Mission.cuttingRoomCharge — cutting_room_momentum side effect", () => {
  it("grants +2 move starting the wielder's OWN next round, not the round the charge happened on — and reverts the round after", () => {
    const mission = quietMission();
    const halden = setupWielder(mission);
    grant(halden, "cutting_room_momentum", 1);
    const baseMove = halden.moveRange;

    mission.cuttingRoomCharge(halden.instanceId, { x: 8, y: 5 });
    expect(halden.moveRange).toBe(baseMove); // not yet — still the same turn the charge happened on

    mission.endPlayerTurn(); // advance one full round
    expect(halden.moveRange).toBe(baseMove + CUTTING_ROOM_MOMENTUM_MOVE_BONUS);

    mission.endPlayerTurn(); // advance another round — the window was scoped to exactly one
    expect(halden.moveRange).toBe(baseMove);
  });

  it("never triggers without an actual Zanretsu use", () => {
    const mission = quietMission();
    const halden = setupWielder(mission);
    grant(halden, "cutting_room_momentum", 1);
    const baseMove = halden.moveRange;

    mission.endPlayerTurn();
    mission.endPlayerTurn();
    expect(halden.moveRange).toBe(baseMove);
  });

  it("still triggers on a whiffed (zero-hit) charge — 'any Zanretsu use,' no hit-count qualifier", () => {
    const mission = quietMission();
    const halden = setupWielder(mission);
    grant(halden, "cutting_room_momentum", 1);
    const baseMove = halden.moveRange;

    mission.cuttingRoomCharge(halden.instanceId, { x: 8, y: 5 }); // nobody there
    mission.endPlayerTurn();
    expect(halden.moveRange).toBe(baseMove + CUTTING_ROOM_MOMENTUM_MOVE_BONUS);
  });

  it("rank 5 also grants +10% ATK for that one round — verified both as a live flag and through a real attack's actual damage", () => {
    const mission = quietMission();
    const halden = setupWielder(mission);
    grant(halden, "cutting_room_momentum", 5);

    mission.cuttingRoomCharge(halden.instanceId, { x: 8, y: 5 });
    expect(halden.momentumAtkBoostActive).toBeFalsy();
    mission.endPlayerTurn();
    expect(halden.momentumAtkBoostActive).toBe(true);

    // Real damage comparison: same attacker/defender shape, boosted vs not.
    // halden's own currentHp is reset to full before each attack — a
    // counter from the earlier attack shouldn't be allowed to leak into the
    // second measurement and muddy a comparison that's isolating the ATK
    // multiplier specifically.
    const boosted = mover(mission, { x: 6, y: 5 }, { hp: 9999 });
    halden.pos = { x: 5, y: 5 };
    halden.actionsRemaining = MAX_ACTIONS_PER_TURN;
    halden.currentHp = halden.maxHp;
    mission.attack(halden.instanceId, boosted.instanceId);
    const boostedDamage = 9999 - boosted.currentHp;

    mission.endPlayerTurn(); // window closes
    expect(halden.momentumAtkBoostActive).toBe(false);
    const unboosted = mover(mission, { x: 6, y: 5 }, { hp: 9999 });
    halden.pos = { x: 5, y: 5 };
    halden.actionsRemaining = MAX_ACTIONS_PER_TURN;
    halden.currentHp = halden.maxHp;
    mission.attack(halden.instanceId, unboosted.instanceId);
    const unboostedDamage = 9999 - unboosted.currentHp;

    expect(boostedDamage).toBeGreaterThan(unboostedDamage);
  });
});

// =====================================================================
// cutting_room_sure_footing — knockback/forced-movement immunity
// =====================================================================

describe("Mission.cuttingRoomSureFooting", () => {
  it("blocks a knockback attempt while the window is active", () => {
    const mission = quietMission();
    clearTerrain(mission, [
      { x: 5, y: 5 },
      { x: 5, y: 6 },
      { x: 5, y: 7 },
    ]);
    const heartwood = createBloomUnit("bloom_heartwood", { x: 5, y: 5 });
    mission.units.push(heartwood);
    const defender = pilot(mission, "pilot_rourke", { x: 5, y: 6 }); // tank/meeps path irrelevant here — Heartwood's own onHit doesn't roll a dodge
    defender.path = "tank"; // sidesteps rollMeepsDodge entirely, same reasoning bloomOnHitEffects.test.ts's own knockback test uses
    grant(defender, "cutting_room_sure_footing", 1);

    expect(mission.cuttingRoomSureFooting(defender.instanceId)).toBe(true);
    expect(defender.sureFootingActive).toBe(true);

    mission.attack(heartwood.instanceId, defender.instanceId);
    expect(defender.pos).toEqual({ x: 5, y: 6 }); // unmoved
  });

  it("does NOT block a knockback outside the window — before activation, and after it expires", () => {
    const mission = quietMission();
    clearTerrain(mission, [
      { x: 5, y: 5 },
      { x: 5, y: 6 },
      { x: 5, y: 7 },
    ]);
    const heartwood = createBloomUnit("bloom_heartwood", { x: 5, y: 5 });
    mission.units.push(heartwood);
    // pilot_bosk, not pilot_rourke, deliberately: this test runs a real
    // endPlayerTurn() cycle after the first knockback lands damage on the
    // defender, and pilot_rourke is the game's protagonist pilot with the
    // codebase's own documented "no plot armor except Rourke" rule (see
    // mission.ts) — a Rourke defender left at reduced HP going into a
    // hostile-phase turn can trigger the special commander_down outcome and
    // short-circuit the round-completion bookkeeping this test relies on
    // (it did, before this fix — confirmed by instrumenting a standalone
    // repro). None of that is what this test is isolating (Sure Footing's
    // OWN expiry timing), so it sidesteps Rourke's special case entirely by
    // using a different roster pilot, same pattern the "refuses a unit
    // without the ability" checks elsewhere in this file already use.
    const defender = pilot(mission, "pilot_bosk", { x: 5, y: 6 });
    defender.path = "tank";

    // Before ever activating Sure Footing: knockback lands normally.
    mission.attack(heartwood.instanceId, defender.instanceId);
    expect(defender.pos).toEqual({ x: 5, y: 7 });

    // Expire the window (rank 1, CUTTING_ROOM_SURE_FOOTING_DURATION_TURNS
    // rounds), then confirm a fresh knockback lands again.
    defender.pos = { x: 5, y: 6 };
    defender.currentHp = defender.maxHp; // undo the first knockback attack's own damage before the second, so it can't interfere with the round-completion path either
    grant(defender, "cutting_room_sure_footing", 1);
    defender.actionsRemaining = MAX_ACTIONS_PER_TURN;
    mission.cuttingRoomSureFooting(defender.instanceId);
    for (let i = 0; i < CUTTING_ROOM_SURE_FOOTING_DURATION_TURNS; i++) mission.endPlayerTurn();
    expect(defender.sureFootingActive).toBe(false);
    mission.attack(heartwood.instanceId, defender.instanceId);
    expect(defender.pos).toEqual({ x: 5, y: 7 });
  });

  it("rank 5: duration is CUTTING_ROOM_SURE_FOOTING_RANK5_DURATION_TURNS", () => {
    const mission = quietMission();
    const halden = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(halden, "cutting_room_sure_footing", 5);
    mission.cuttingRoomSureFooting(halden.instanceId);
    expect(halden.sureFootingTurnsLeft).toBe(CUTTING_ROOM_SURE_FOOTING_RANK5_DURATION_TURNS);
  });

  it("is gated by CUTTING_ROOM_SURE_FOOTING_COOLDOWN_TURNS — refused right after use, ready exactly on schedule", () => {
    const mission = quietMission();
    const halden = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(halden, "cutting_room_sure_footing", 1);
    mission.cuttingRoomSureFooting(halden.instanceId);
    const readyAtTurn = mission.turn + CUTTING_ROOM_SURE_FOOTING_COOLDOWN_TURNS;
    halden.actionsRemaining = MAX_ACTIONS_PER_TURN;
    mission.turn = readyAtTurn - 1;
    expect(mission.canCuttingRoomSureFooting(halden.instanceId)).toBe(false);
    mission.turn = readyAtTurn;
    expect(mission.canCuttingRoomSureFooting(halden.instanceId)).toBe(true);
  });

  it("refuses a unit without the ability, an unknown id, a downed unit, and a spent unit", () => {
    const mission = quietMission();
    const iyari = pilot(mission, "pilot_iyari", { x: 5, y: 5 });
    expect(iyari.abilities).not.toContain("cutting_room_sure_footing");
    expect(mission.cuttingRoomSureFooting(iyari.instanceId)).toBe(false);

    expect(mission.cuttingRoomSureFooting("no_such_unit")).toBe(false);

    const halden = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(halden, "cutting_room_sure_footing", 1);
    halden.actionsRemaining = 0;
    expect(mission.canCuttingRoomSureFooting(halden.instanceId)).toBe(false);
    halden.actionsRemaining = MAX_ACTIONS_PER_TURN;
    halden.downed = true;
    expect(mission.canCuttingRoomSureFooting(halden.instanceId)).toBe(false);
  });
});
