// Mek track effects that were dead data until 6 Sep 2026 (second Frame
// Systems pass, Maxime's call on each — see claude/Bloom_Wars_Build_Log_
// Addendum_MekTrackEffectsWired_06Sep2026.md): Fieldwright's stationary
// heal (+ Stabilizer Struts on top), Runemaster's burrow detection, effect
// potency and initiative, Quartermaster's tier discount, and the
// Fabricator's spare parts re-pointed at Beacon Control. GDD §6.2 / Data
// Pack §5 described all six as shipped; nothing in the engine read them.
//
// Same house style as frameSystems.test.ts: real Missions built from real
// mission defs (MISSION_1A for the Team One meks — Barasj is Fieldwright-
// primary, Tourignie Runemaster-primary, Voss Fabricator-primary — and
// AMARANTH_MISSION_1 for Warden, where Rourke is Runemaster-primary), direct
// unit mutation to isolate one thing, local copies of the quiet-board
// helpers rather than a shared import.
import { describe, it, expect } from "vitest";
import { Mission, type MissionOptions } from "../mission";
import { MISSION_1A } from "../../data/campaign";
import { AMARANTH_MISSION_1 } from "../../data/campaignAmaranth";
import { createPlayerUnit, createBloomUnit, createHostileMechUnit, mekStationaryHeal, mekDetectsBurrowed, mekEffectPotency, mekInitiative, type BattleUnit } from "../units";
import { findPilot, findMek } from "../../data/pilotRegistry";
import { resolveMechAttack, defenderStrikesFirst } from "../combat";
import { isVisibleTo } from "../ai";
import { applyMechOnHitEffect, knockbackDestination, scaleByPotency } from "../turnManager";
import { makeUniformMap, testUnit } from "./testHelpers";
import { MEK_TRACK_EFFECTS } from "../../data/meks";
import { MAX_ACTIONS_PER_TURN } from "../../data/combatTables";
import { SEISMIC_TAP_DETECT_RADIUS, STABILIZER_STRUTS_MOVE_ALLOWANCE } from "../../data/frameSystems";
import { SHOCK_CLAWS_STUN_DURATION_TURNS, SUPPRESSION_AUTOCANNON_DEBUFF_DURATION_TURNS, RIOT_DRUM_KNOCKBACK_MAGNITUDE } from "../../data/weaponBranches";
import { createWardenCampaignState } from "../campaignState";
import type { ReservedBayId } from "../campaignState";
import { tierUpgradeCostFor, purchaseTierUpgrade, TIER_UPGRADE_COST, applySparePartsConsumption } from "../campaignEconomy";
import type { MekArchetype } from "../../data/types";

const FW = MEK_TRACK_EFFECTS.fieldwright;
const RM = MEK_TRACK_EFFECTS.runemaster;

// ---- fixtures ----------------------------------------------------------------

/** MISSION_1A with every hostile but one inert keeper neutralised, the squad parked in a corner. */
function quietTeamOne(): Mission {
  const mission = new Mission(MISSION_1A);
  const hostiles = mission.units.filter((u) => u.side === "hostile" && !u.downed);
  const [keep, ...rest] = hostiles;
  for (const u of rest) u.downed = true;
  if (keep) {
    keep.moveRange = 0;
    keep.attackRange = [99, 99];
    keep.pos = { x: 0, y: 0 };
  }
  for (const u of mission.units) if (u.side === "player") u.pos = { x: 17, y: 11 };
  return mission;
}

/** Ends the player turn with every hostile that MISSION_1A's own events may have just spawned neutralised first. */
function endQuietTurn(mission: Mission): void {
  const hostiles = mission.units.filter((u) => u.side === "hostile" && !u.downed);
  const [keep, ...rest] = hostiles;
  for (const u of rest) u.downed = true;
  if (keep) {
    keep.moveRange = 0;
    keep.attackRange = [99, 99];
    keep.pos = { x: 0, y: 0 };
  }
  mission.endPlayerTurn();
}

function flatten(mission: Mission, x0: number, y0: number, x1: number, y1: number): void {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) mission.map.tiles[y][x] = "road";
}

function unit(mission: Mission, pilotId: string, pos?: { x: number; y: number }): BattleUnit {
  const u = mission.units.find((x) => x.pilotId === pilotId)!;
  if (pos) u.pos = { ...pos };
  return u;
}

const WARDEN_PARK: Record<string, { x: number; y: number }> = {
  pilot_rourke: { x: 8, y: 5 },
  pilot_bosk: { x: 1, y: 0 },
  pilot_iyari: { x: 2, y: 0 },
  pilot_anand: { x: 3, y: 0 },
  pilot_lask: { x: 4, y: 0 },
};
const ALL_BEACON_BAYS: ReservedBayId[] = ["beaconControl", "restockRoom", "generator"];

/** beaconControl.test.ts's own quietMission(), copied: Warden Mission 1, hostiles downed, one inert keeper, all three beacon bays built. */
function quietWarden(stock?: Pick<MissionOptions, "beaconCratesRemaining" | "beaconChargesRemaining">): Mission {
  const mission = new Mission(AMARANTH_MISSION_1, undefined, ALL_BEACON_BAYS, {
    rng: () => 1,
    beaconCratesRemaining: stock?.beaconCratesRemaining ?? 3,
    beaconChargesRemaining: stock?.beaconChargesRemaining ?? 3,
  });
  for (const u of mission.units) {
    if (u.side === "hostile") u.downed = true;
    else u.pos = { ...WARDEN_PARK[u.pilotId!] };
  }
  const keeper = createHostileMechUnit("hostile_mech_01", { x: 19, y: 11 });
  keeper.vision = 0;
  keeper.moveRange = 0;
  mission.units.push(keeper);
  return mission;
}

function downAlly(mission: Mission, u: BattleUnit): void {
  u.downed = true;
  u.currentHp = 0;
  u.downedOnTurn = mission.turn;
}

function mekWith(base: MekArchetype, patch: Partial<MekArchetype>): MekArchetype {
  return { ...base, ...patch };
}

// ---- data -> unit ------------------------------------------------------------

describe("mek track readers — the data-to-unit mapping", () => {
  const fieldwrightPrimary = findMek("mek_barasj")!;
  const runemasterPrimary = findMek("mek_tourignie")!;
  const armorerOnly = findMek("mek_thyns")!;

  it("Fieldwright: 15 primary, 8 secondary, 0 without", () => {
    expect(mekStationaryHeal(fieldwrightPrimary)).toBe(FW.primary.stationaryHeal);
    expect(mekStationaryHeal(mekWith(armorerOnly, { secondary: "fieldwright" }))).toBe(FW.secondary.stationaryHeal);
    expect(mekStationaryHeal(armorerOnly)).toBe(0);
    expect(mekStationaryHeal(undefined)).toBe(0);
  });

  it("Runemaster: detection primary-only, potency 1.5/1.25/1, initiative 1/0/0", () => {
    expect(mekDetectsBurrowed(runemasterPrimary)).toBe(true);
    expect(mekDetectsBurrowed(mekWith(armorerOnly, { secondary: "runemaster" }))).toBe(false);
    expect(mekEffectPotency(runemasterPrimary)).toBe(RM.primary.effectPotency);
    expect(mekEffectPotency(mekWith(armorerOnly, { secondary: "runemaster" }))).toBe(RM.secondary.effectPotency);
    expect(mekEffectPotency(armorerOnly)).toBe(1);
    expect(mekInitiative(runemasterPrimary)).toBe(RM.primary.initiative);
    expect(mekInitiative(mekWith(armorerOnly, { secondary: "runemaster" }))).toBe(0);
    expect(mekInitiative(undefined)).toBe(0);
  });

  it("createPlayerUnit bakes each onto the unit, and leaves every field undefined for an Armorer mek", () => {
    const barasj = createPlayerUnit("pilot_barasj", { x: 0, y: 0 });
    expect(barasj.stationaryHeal).toBe(FW.primary.stationaryHeal);
    expect(barasj.effectPotency).toBeUndefined();
    expect(barasj.initiative).toBeUndefined();
    expect(barasj.detectsBurrowedRadius).toBeUndefined();
    expect(barasj.mekId).toBe("mek_barasj");
    expect(barasj.fabricatorPartsRemaining).toBeUndefined();

    const tourignie = createPlayerUnit("pilot_tourignie", { x: 0, y: 0 });
    expect(tourignie.stationaryHeal).toBeUndefined();
    expect(tourignie.effectPotency).toBe(RM.primary.effectPotency);
    expect(tourignie.initiative).toBe(RM.primary.initiative);
    expect(tourignie.detectsBurrowedRadius).toBe(tourignie.vision); // "anywhere inside the pilot's vision"

    const thyns = createPlayerUnit("pilot_thyns", { x: 0, y: 0 });
    for (const f of ["stationaryHeal", "effectPotency", "initiative", "detectsBurrowedRadius", "fabricatorPartsRemaining"] as const) {
      expect(thyns[f]).toBeUndefined();
    }
  });

  it("reads the LIVE mek copy passed in overrides, not the registry — a secondary bought mid-campaign counts", () => {
    const base = findPilot("pilot_thyns")!;
    const live = mekWith(findMek("mek_thyns")!, { secondary: "fieldwright" });
    expect(createPlayerUnit("pilot_thyns", { x: 0, y: 0 }, { pilot: base, mek: live }).stationaryHeal).toBe(FW.secondary.stationaryHeal);
    const rm = mekWith(findMek("mek_thyns")!, { secondary: "runemaster" });
    const u = createPlayerUnit("pilot_thyns", { x: 0, y: 0 }, { pilot: base, mek: rm });
    expect(u.effectPotency).toBe(RM.secondary.effectPotency);
    expect(u.initiative).toBeUndefined(); // secondary: "no initiative and no burrow detection"
    expect(u.detectsBurrowedRadius).toBeUndefined();
  });

  it("Fabricator: parts remaining is the mek's spareParts when it has the track (0 reads as 0, not undefined)", () => {
    const base = findPilot("pilot_voss")!;
    const voss = findMek("mek_voss")!;
    expect(voss.primary).toBe("fabricator");
    expect(createPlayerUnit("pilot_voss", { x: 0, y: 0 }, { pilot: base, mek: mekWith(voss, { spareParts: 2 }) }).fabricatorPartsRemaining).toBe(2);
    expect(createPlayerUnit("pilot_voss", { x: 0, y: 0 }, { pilot: base, mek: mekWith(voss, { spareParts: 0 }) }).fabricatorPartsRemaining).toBe(0);
  });

  it("Runemaster + Seismic Tap: the larger radius wins (vision), and Signal Booster extends it", () => {
    const base = findPilot("pilot_tourignie")!;
    const both = createPlayerUnit("pilot_tourignie", { x: 0, y: 0 }, {
      pilot: { ...base, tier: "C", ownedFrameSystems: ["sensor_seismic_tap", "sensor_signal_booster"], equippedFrameSystems: ["sensor_seismic_tap", "sensor_signal_booster"] },
    });
    expect(both.detectsBurrowedRadius).toBe(both.vision);
    expect(both.detectsBurrowedRadius).toBeGreaterThan(SEISMIC_TAP_DETECT_RADIUS);
    const plain = createPlayerUnit("pilot_tourignie", { x: 0, y: 0 }, { pilot: base });
    expect(both.vision).toBe(plain.vision + 1);
  });
});

// ---- Fieldwright stationary heal + Stabilizer Struts ---------------------------

describe("Fieldwright stationary heal (tickStationaryRepair)", () => {
  it("heals +15 at cycle end for a Fieldwright-primary pilot who did not move, capped at maxHp", () => {
    const mission = quietTeamOne();
    const barasj = unit(mission, "pilot_barasj", { x: 17, y: 11 });
    barasj.currentHp = barasj.maxHp - 40;
    endQuietTurn(mission);
    // Barasj is a Munti standing on his own aura too — the two stack (see muntiRegen.test.ts).
    expect(barasj.currentHp).toBe(barasj.maxHp - 40 + FW.primary.stationaryHeal + 8);
    barasj.currentHp = barasj.maxHp - 3;
    endQuietTurn(mission);
    expect(barasj.currentHp).toBe(barasj.maxHp);
  });

  it("does NOT heal a pilot who moved this turn, even 1 tile — the GDD's rule is strict", () => {
    const mission = quietTeamOne();
    flatten(mission, 10, 8, 17, 11);
    const barasj = unit(mission, "pilot_barasj", { x: 15, y: 10 });
    barasj.currentHp = barasj.maxHp - 40;
    expect(mission.moveUnit(barasj.instanceId, { x: 16, y: 10 })).toBe(true);
    expect(barasj.tilesMovedThisTurn).toBe(1);
    endQuietTurn(mission);
    expect(barasj.currentHp).toBe(barasj.maxHp - 40 + 8); // the Munti aura still ticks; the Fieldwright heal doesn't
    expect(barasj.tilesMovedThisTurn).toBe(0); // reset for the new turn
  });

  it("Stabilizer Struts: a 1-tile move still heals; 2 tiles (even as two 1-tile moves) does not", () => {
    const mission = quietTeamOne();
    flatten(mission, 10, 8, 17, 11);
    const barasj = unit(mission, "pilot_barasj", { x: 14, y: 10 });
    barasj.frameSystemIds = ["support_stabilizer_struts"];
    barasj.currentHp = barasj.maxHp - 40;
    expect(mission.moveUnit(barasj.instanceId, { x: 15, y: 10 })).toBe(true);
    endQuietTurn(mission);
    expect(barasj.currentHp).toBe(barasj.maxHp - 40 + FW.primary.stationaryHeal + 8);

    barasj.currentHp = barasj.maxHp - 40;
    barasj.actionsRemaining = MAX_ACTIONS_PER_TURN;
    expect(mission.moveUnit(barasj.instanceId, { x: 16, y: 10 })).toBe(true);
    expect(mission.moveUnit(barasj.instanceId, { x: 17, y: 10 })).toBe(true);
    expect(barasj.tilesMovedThisTurn).toBe(2);
    expect(barasj.tilesMovedThisTurn).toBeGreaterThan(STABILIZER_STRUTS_MOVE_ALLOWANCE);
    endQuietTurn(mission);
    expect(barasj.currentHp).toBe(barasj.maxHp - 40 + 8);
  });

  it("a pilot without a Fieldwright track never self-heals from standing still — Struts alone do nothing", () => {
    const mission = quietTeamOne();
    const thyns = unit(mission, "pilot_thyns", { x: 12, y: 3 }); // out of Barasj's aura
    thyns.frameSystemIds = ["support_stabilizer_struts"];
    thyns.currentHp = thyns.maxHp - 40;
    endQuietTurn(mission);
    expect(thyns.currentHp).toBe(thyns.maxHp - 40);
  });

  it("a downed Fieldwright pilot is not healed back up by it", () => {
    const mission = quietTeamOne();
    const barasj = unit(mission, "pilot_barasj", { x: 17, y: 11 });
    barasj.downed = true;
    barasj.currentHp = 0;
    endQuietTurn(mission);
    expect(barasj.currentHp).toBe(0);
    expect(barasj.downed).toBe(true);
  });
});

// ---- Runemaster burrow detection ----------------------------------------------

describe("Runemaster burrow detection (anywhere in vision, primary only)", () => {
  it("Rourke, Runemaster-primary, sees a burrowed Undertow at the edge of her vision and not one tile past it", () => {
    const rourke = createPlayerUnit("pilot_rourke", { x: 0, y: 0 });
    expect(rourke.detectsBurrowedRadius).toBe(rourke.vision);
    const undertow = createBloomUnit("bloom_undertow", { x: rourke.vision, y: 0 }, { burrowed: true });
    expect(isVisibleTo(rourke, undertow)).toBe(true);
    undertow.pos = { x: rourke.vision + 1, y: 0 };
    expect(isVisibleTo(rourke, undertow)).toBe(false);
  });

  it("an Armorer pilot (Bosk) still can't, and a Runemaster SECONDARY can't either", () => {
    const bosk = createPlayerUnit("pilot_bosk", { x: 0, y: 0 });
    const undertow = createBloomUnit("bloom_undertow", { x: 2, y: 0 }, { burrowed: true });
    expect(isVisibleTo(bosk, undertow)).toBe(false);
    const base = findPilot("pilot_bosk")!;
    const secondary = createPlayerUnit("pilot_bosk", { x: 0, y: 0 }, { pilot: base, mek: mekWith(findMek("mek_bosk")!, { secondary: "runemaster" }) });
    expect(isVisibleTo(secondary, undertow)).toBe(false);
  });
});

// ---- Runemaster initiative ------------------------------------------------------

describe("Runemaster initiative — the defender counter-strikes first", () => {
  const map = makeUniformMap("plain", 8, 8);

  it("defenderStrikesFirst: needs initiative on the defender, and beats an equal-or-slower attacker only", () => {
    const def = testUnit("tank", { x: 1, y: 1 });
    const atk = testUnit("meeps", { x: 2, y: 1 });
    expect(defenderStrikesFirst(def, atk)).toBe(false); // no initiative: never, even when faster
    def.moveRange = 9;
    expect(defenderStrikesFirst(def, atk)).toBe(false);
    def.moveRange = atk.moveRange;
    def.initiative = 1;
    expect(defenderStrikesFirst(def, atk)).toBe(true); // equal move + initiative: wins the tie
    atk.moveRange = def.moveRange + 1;
    expect(defenderStrikesFirst(def, atk)).toBe(false); // attacker faster by one: tie on move+init, attacker keeps first strike
    atk.initiative = 1;
    atk.moveRange = def.moveRange;
    expect(defenderStrikesFirst(def, atk)).toBe(false); // both have it, equal move: attacker keeps first strike
  });

  it("the counter is computed at the defender's untouched HP, lands first, and the attacker then swings at reduced HP", () => {
    const attacker = testUnit("meeps", { x: 2, y: 1 });
    const defender = testUnit("tank", { x: 1, y: 1 });
    const plain = resolveMechAttack(map, attacker, defender, [defender], [attacker], false);
    expect(plain.defenderStruckFirst).toBeUndefined();
    expect(plain.countered).toBe(true);

    defender.initiative = 1;
    const first = resolveMechAttack(map, attacker, defender, [defender], [attacker], false);
    expect(first.defenderStruckFirst).toBe(true);
    expect(first.countered).toBe(true);
    // Counter at full HP > the plain case's counter at post-hit HP.
    expect(first.counterDamage!).toBeGreaterThan(plain.counterDamage!);
    // Attacker's own hit is weaker: thrown at post-counter HP.
    expect(first.damage).toBeLessThan(plain.damage);
    expect(first.attackerHpAfter).toBe(attacker.currentHp - first.counterDamage!);
    expect(first.defenderHpAfter).toBe(defender.currentHp - first.damage);
  });

  it("if the pre-emptive counter downs the attacker, the attack never lands — damage 0, defender untouched, not 'dodged'", () => {
    const attacker = testUnit("meeps", { x: 2, y: 1 }, { hp: 5 });
    const defender = testUnit("tank", { x: 1, y: 1 });
    defender.initiative = 1;
    const r = resolveMechAttack(map, attacker, defender, [defender], [attacker], false, true /* defender would have dodged */);
    expect(r.defenderStruckFirst).toBe(true);
    expect(r.attackerDowned).toBe(true);
    expect(r.attackerHpAfter).toBe(0);
    expect(r.damage).toBe(0);
    expect(r.defenderHpAfter).toBe(defender.currentHp);
    expect(r.defenderDowned).toBe(false);
    expect(r.dodged).toBe(false);
  });

  it("never gives a Tank reach: a Reeps attacking from range 3 is still not countered at all, initiative or not", () => {
    const attacker = testUnit("reeps", { x: 4, y: 1 });
    attacker.attackRange = [2, 3];
    const defender = testUnit("tank", { x: 1, y: 1 });
    defender.initiative = 1;
    const r = resolveMechAttack(map, attacker, defender, [defender], [attacker], false);
    expect(r.countered).toBe(false);
    expect(r.defenderStruckFirst).toBeUndefined();
  });

  it("is a no-op for the whole existing roster in a mech-vs-mech exchange without a Runemaster: byte-identical result shape", () => {
    const attacker = testUnit("meeps", { x: 2, y: 1 });
    const defender = testUnit("tank", { x: 1, y: 1 });
    const r = resolveMechAttack(map, attacker, defender, [defender], [attacker], false);
    expect(r).toEqual({
      damage: r.damage,
      defenderHpAfter: defender.currentHp - r.damage,
      defenderDowned: false,
      countered: true,
      counterDamage: r.counterDamage,
      attackerHpAfter: attacker.currentHp - r.counterDamage!,
      attackerDowned: false,
      dodged: false,
      counterDodged: false,
    });
  });

  it("Mission.attack logs the struck-first exchange in the order it happened, and applies both hits", () => {
    const mission = quietTeamOne();
    flatten(mission, 10, 8, 17, 11);
    // Nagori — Meeps with a Runemaster-primary mek, so initiative 1 AND a
    // counter to swing. (Tourignie has the same mek but is Reeps: Reeps
    // never counter, so initiative can never fire for them — which is also
    // true of Anand and Solheim in Warden. Rourke, Meeps + Runemaster, is
    // the one Warden pilot it's live for.)
    const nagori = unit(mission, "pilot_nagori", { x: 15, y: 10 });
    expect(nagori.initiative).toBe(1);
    expect(nagori.canCounter).toBe(true);
    const hostile = createHostileMechUnit("hostile_mech_01", { x: 16, y: 10 });
    hostile.moveRange = nagori.moveRange; // equal move: Nagori wins the tie
    hostile.actionsRemaining = MAX_ACTIONS_PER_TURN;
    hostile.attackRange = [1, 1];
    mission.units.push(hostile);
    const hpBefore = { t: nagori.currentHp, h: hostile.currentHp };
    const outcome = mission.attack(hostile.instanceId, nagori.instanceId)!;
    expect(outcome).not.toBeNull();
    expect(outcome.defenderStruckFirst).toBe(true);
    expect(hostile.currentHp).toBe(hpBefore.h - outcome.counterDamage!);
    expect(nagori.currentHp).toBe(hpBefore.t - outcome.damage);
    const line = mission.log.find((l) => l.includes("strikes first (initiative)"))!;
    expect(line).toBeDefined();
    expect(line).toContain(`for ${outcome.counterDamage}`);
    expect(line).toContain(`then hits for ${outcome.damage}`);
  });
});

// ---- Runemaster effect potency --------------------------------------------------

describe("Runemaster effect potency (on-hit duration / knockback distance)", () => {
  it("scaleByPotency: x1.5 rounds 1 -> 2 and 2 -> 3; x1.25 keeps 1 and pushes 2 -> 3; x1 is identity", () => {
    expect(scaleByPotency(1, 1)).toBe(1);
    expect(scaleByPotency(1, 1.5)).toBe(2);
    expect(scaleByPotency(2, 1.5)).toBe(3);
    expect(scaleByPotency(1, 1.25)).toBe(1);
    expect(scaleByPotency(2, 1.25)).toBe(3);
    expect(scaleByPotency(0, 1.5)).toBe(0);
  });

  it("a Runemaster-primary attacker's Shock Claws stun lasts 2 turns instead of 1; a plain attacker's still 1", () => {
    const map = makeUniformMap("plain", 8, 8);
    const attacker = testUnit("meeps", { x: 1, y: 1 });
    const defender = testUnit("tank", { x: 2, y: 1 });
    applyMechOnHitEffect("fx_shock_claws_stun", attacker, defender, [defender], map, new Set());
    expect(defender.statusEffects.find((e) => e.kind === "stun")!.turnsRemaining).toBe(SHOCK_CLAWS_STUN_DURATION_TURNS);

    const rune = testUnit("meeps", { x: 1, y: 1 });
    rune.effectPotency = RM.primary.effectPotency;
    const victim = testUnit("tank", { x: 2, y: 1 });
    applyMechOnHitEffect("fx_shock_claws_stun", rune, victim, [victim], map, new Set());
    expect(victim.statusEffects.find((e) => e.kind === "stun")!.turnsRemaining).toBe(scaleByPotency(SHOCK_CLAWS_STUN_DURATION_TURNS, RM.primary.effectPotency));
    expect(victim.statusEffects.find((e) => e.kind === "stun")!.turnsRemaining).toBe(2);
  });

  it("Suppression's debuff runs 3 turns under a Runemaster, magnitude unchanged", () => {
    const map = makeUniformMap("plain", 8, 8);
    const rune = testUnit("reeps", { x: 1, y: 1 });
    rune.effectPotency = RM.primary.effectPotency;
    const victim = testUnit("tank", { x: 2, y: 1 });
    applyMechOnHitEffect("fx_suppression_autocannon_debuff", rune, victim, [victim], map, new Set());
    const fx = victim.statusEffects.find((e) => e.kind === "debuff_attack")!;
    expect(fx.turnsRemaining).toBe(SUPPRESSION_AUTOCANNON_DEBUFF_DURATION_TURNS + 1);
    expect(fx.magnitude).toBe(0.2);
  });

  it("Riot Drum's knockback pushes 2 tiles under a Runemaster, stepping tile by tile and stopping short of a wall or a body", () => {
    const map = makeUniformMap("plain", 8, 8);
    const rune = testUnit("tank", { x: 1, y: 1 });
    rune.effectPotency = RM.primary.effectPotency;
    const victim = testUnit("meeps", { x: 2, y: 1 });
    applyMechOnHitEffect("fx_riot_drum_knockback", rune, victim, [victim], map, new Set());
    expect(victim.pos).toEqual({ x: 2 + scaleByPotency(RIOT_DRUM_KNOCKBACK_MAGNITUDE, RM.primary.effectPotency), y: 1 });
    expect(victim.pos).toEqual({ x: 4, y: 1 });

    // A body on the second tile: the push lands on the first.
    const blocked = new Set(["4,1"]);
    expect(knockbackDestination(map, { x: 1, y: 1 }, { x: 2, y: 1 }, 2, blocked)).toEqual({ x: 3, y: 1 });
    // A body on the first tile: no push at all, as before.
    expect(knockbackDestination(map, { x: 1, y: 1 }, { x: 2, y: 1 }, 2, new Set(["3,1"]))).toBeNull();
    // Magnitude 1 (every pre-existing knockback) is exactly the old single-tile check.
    expect(knockbackDestination(map, { x: 1, y: 1 }, { x: 2, y: 1 }, 1, new Set())).toEqual({ x: 3, y: 1 });
    expect(knockbackDestination(map, { x: 1, y: 1 }, { x: 2, y: 1 }, 1, new Set(["3,1"]))).toBeNull();
  });
});

// ---- Quartermaster ------------------------------------------------------------

describe("Quartermaster secondary — -25% on every gear-tier purchase", () => {
  it("tierUpgradeCostFor is the flat table without the track, 75% rounded with it, and undefined at the top", () => {
    const state = createWardenCampaignState();
    expect(tierUpgradeCostFor(state, "pilot_bosk")).toBe(TIER_UPGRADE_COST.G);
    state.meks[state.pilots.pilot_bosk.pilot.mekId].secondary = "quartermaster";
    expect(tierUpgradeCostFor(state, "pilot_bosk")).toBe(Math.round(TIER_UPGRADE_COST.G * 0.75));
    expect(tierUpgradeCostFor(state, "pilot_bosk")).toBe(45);
    state.pilots.pilot_bosk.pilot.tier = "B";
    expect(tierUpgradeCostFor(state, "pilot_bosk")).toBe(375);
    state.pilots.pilot_bosk.pilot.tier = "A";
    expect(tierUpgradeCostFor(state, "pilot_bosk")).toBeUndefined();
  });

  it("purchaseTierUpgrade actually charges the discounted price", () => {
    const state = createWardenCampaignState();
    state.meks[state.pilots.pilot_bosk.pilot.mekId].secondary = "quartermaster";
    state.pilots.pilot_bosk.personalPoints = 50; // short of 60, enough for 45
    const r = purchaseTierUpgrade(state, "pilot_bosk");
    expect(r.ok).toBe(true);
    expect(r.cost).toBe(45);
    expect(state.pilots.pilot_bosk.personalPoints).toBe(5);
    expect(state.pilots.pilot_bosk.pilot.tier).toBe("F");
  });
});

// ---- Fabricator spare parts feed the Beacon ---------------------------------------

describe("Fabricator spare parts as the pilot's own Beacon crate", () => {
  it("a beacon revive of a part-carrying pilot burns their part, not a company crate, and tallies it by mek", () => {
    const mission = quietWarden({ beaconCratesRemaining: 2, beaconChargesRemaining: 2 });
    const holder = mission.unitById(mission.beaconHolderId()!)!;
    const target = unit(mission, "pilot_iyari", { x: holder.pos.x + 1, y: holder.pos.y });
    target.fabricatorPartsRemaining = 1;
    target.mekId = "mek_iyari";
    downAlly(mission, target);
    expect(mission.getBeaconTargetsFrom(holder.instanceId).map((u) => u.pilotId)).toContain("pilot_iyari");
    expect(mission.useBeaconControl(holder.instanceId, target.instanceId)).toBe(true);
    expect(target.downed).toBe(false);
    expect(target.currentHp).toBe(target.maxHp);
    expect(target.fabricatorPartsRemaining).toBe(0);
    expect(mission.beaconCratesRemaining).toBe(2); // untouched
    expect(mission.beaconChargesRemaining).toBe(2); // Lask (a living Munti) waives the charge
    expect(mission.sparePartsSpent).toEqual({ mek_iyari: 1 });
    expect(mission.log.some((l) => l.includes("own Fabricator spare part covers the crate (0 part(s) left)"))).toBe(true);
  });

  it("works with ZERO company crates — the part is a real crate source, so the button stays usable and the target stays listed", () => {
    const mission = quietWarden({ beaconCratesRemaining: 0, beaconChargesRemaining: 2 });
    const holder = mission.unitById(mission.beaconHolderId()!)!;
    const target = unit(mission, "pilot_iyari", { x: holder.pos.x + 1, y: holder.pos.y });
    downAlly(mission, target);
    expect(mission.canPlaceBeacon(holder.instanceId)).toBe(false); // no crate anywhere
    target.fabricatorPartsRemaining = 2;
    target.mekId = "mek_iyari";
    expect(mission.canPlaceBeacon(holder.instanceId)).toBe(true);
    expect(mission.getBeaconTargetsFrom(holder.instanceId)).toHaveLength(1);
    expect(mission.useBeaconControl(holder.instanceId, target.instanceId)).toBe(true);
    expect(target.fabricatorPartsRemaining).toBe(1);
    expect(mission.beaconCratesRemaining).toBe(0);
  });

  it("a pilot WITHOUT parts still needs a company crate — with none left, they're not a target even while a part-carrier is", () => {
    const mission = quietWarden({ beaconCratesRemaining: 0, beaconChargesRemaining: 2 });
    const holder = mission.unitById(mission.beaconHolderId()!)!;
    const carrier = unit(mission, "pilot_iyari", { x: holder.pos.x + 1, y: holder.pos.y });
    const plain = unit(mission, "pilot_bosk", { x: holder.pos.x - 1, y: holder.pos.y });
    carrier.fabricatorPartsRemaining = 1;
    carrier.mekId = "mek_iyari";
    downAlly(mission, carrier);
    downAlly(mission, plain);
    expect(mission.getBeaconTargetsFrom(holder.instanceId).map((u) => u.pilotId)).toEqual(["pilot_iyari"]);
  });

  it("a company crate is only spent when the target has no part of their own", () => {
    const mission = quietWarden({ beaconCratesRemaining: 1, beaconChargesRemaining: 2 });
    const holder = mission.unitById(mission.beaconHolderId()!)!;
    const plain = unit(mission, "pilot_bosk", { x: holder.pos.x - 1, y: holder.pos.y });
    downAlly(mission, plain);
    expect(mission.useBeaconControl(holder.instanceId, plain.instanceId)).toBe(true);
    expect(mission.beaconCratesRemaining).toBe(0);
    expect(mission.sparePartsSpent).toEqual({});
  });

  it("applySparePartsConsumption decrements the campaign's live mek copy, floors at 0, skips unknown meks and meks that stayed home", () => {
    const state = createWardenCampaignState();
    state.meks.mek_iyari.spareParts = 2;
    state.meks.mek_bosk.spareParts = 1;
    const mission = quietWarden();
    mission.sparePartsSpent = { mek_iyari: 1, mek_nobody: 3 };
    applySparePartsConsumption(state, mission);
    expect(state.meks.mek_iyari.spareParts).toBe(1);
    expect(state.meks.mek_bosk.spareParts).toBe(1);
    mission.sparePartsSpent = { mek_iyari: 5 };
    applySparePartsConsumption(state, mission);
    expect(state.meks.mek_iyari.spareParts).toBe(0);
  });
});
