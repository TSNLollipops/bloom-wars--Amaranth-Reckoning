// Vault Phase 2, slice 6 (3 Sep 2026) — Simulacrum's full 3-ability kit
// (stolen_seal/The Stolen Seal, ABERRATION track, no aristocrat pilot). See
// data/heirlooms.ts's own "stolen_seal" entry and engine/mission.ts's
// rollInheritedWeight()/getFoughtOnHitEffectKindsThisMission()/
// canSealBorrowedAuthority()/sealBorrowedAuthority()/canLedgerhallStatic()/
// ledgerhallStatic() header comments for the full design and every flagged
// interpretation call — these tests assert the BEHAVIOR those comments
// already commit to, not repeat the reasoning. Sibling file to
// lastWord.test.ts — same house test style throughout, including that
// file's own stated convention of keeping local copies of
// quietMission()/pilot()/grant()/logsMatching() rather than importing them,
// and shockClaws.test.ts's neutralizeDefaultRoster/clearTerrain for the
// combat-wiring half.
import { describe, it, expect } from "vitest";
import { Mission } from "../mission";
import { AMARANTH_MISSION_1 } from "../../data/campaignAmaranth";
import { createBloomUnit, createHostileMechUnit, type BattleUnit } from "../units";
import { testUnit } from "./testHelpers";
import {
  MAX_ACTIONS_PER_TURN,
  SEAL_BORROWED_AUTHORITY_COOLDOWN_TURNS,
  SEAL_LEDGERHALL_STATIC_COOLDOWN_TURNS,
  SEAL_LEDGERHALL_STATIC_JAM_DURATION_TURNS,
  SEAL_INHERITED_WEIGHT_DEF_BONUS_MIN_RANK1,
  SEAL_INHERITED_WEIGHT_DEF_BONUS_MAX_RANK1,
  SEAL_INHERITED_WEIGHT_DEF_BONUS_MIN_RANK5,
  SEAL_INHERITED_WEIGHT_DEF_BONUS_MAX_RANK5,
} from "../../data/combatTables";
import { createWardenCampaignState, recordFoughtOnHitEffectKinds } from "../campaignState";
import { decideHostileAction } from "../ai";
import { findPilot, findMek } from "../../data/pilotRegistry";

function neutralizeDefaultRoster(mission: Mission) {
  for (const u of mission.units) u.downed = true;
}

function clearTerrain(mission: Mission, coords: { x: number; y: number }[]) {
  for (const { x, y } of coords) mission.map.tiles[y][x] = "plain";
}

// Unlike lastWord.test.ts's own quietMission() (which downs only HOSTILE
// units, leaving every player pilot untouched), this file's
// neutralizeDefaultRoster downs BOTH sides — shockClaws.test.ts's own
// convention, used here because several test groups below need a fully
// blank board on both sides to push synthetic units onto. So this local
// pilot() helper also clears `downed`, unlike lastWord.test.ts's identical-
// looking one: repositioning a pilot for one of these tests always means
// "make this the live unit under test," which neutralizeDefaultRoster just
// downed a moment earlier.
function pilot(mission: Mission, pilotId: string, pos?: { x: number; y: number }): BattleUnit {
  const u = mission.units.find((x) => x.pilotId === pilotId)!;
  if (pos) u.pos = { ...pos };
  u.downed = false;
  return u;
}

function grant(unit: BattleUnit, abilityId: string, rank = 1): void {
  unit.abilities = [...unit.abilities, abilityId];
  unit.heirloomAbilityRanks = { ...unit.heirloomAbilityRanks, [abilityId]: rank };
}

const logsMatching = (mission: Mission, needle: string) => mission.log.filter((l) => l.includes(needle));

// =====================================================================
// getFoughtOnHitEffectKindsThisMission — the live, this-mission scan
// =====================================================================

describe("Mission.getFoughtOnHitEffectKindsThisMission", () => {
  it("empty on a board with no Bloom hostiles at all", () => {
    const mission = new Mission(AMARANTH_MISSION_1, undefined, [], { rng: () => 0 });
    neutralizeDefaultRoster(mission);
    expect(mission.getFoughtOnHitEffectKindsThisMission()).toEqual([]);
  });

  it("includes acid_dot/debuff_attack/knockback for the Bloom archetypes that carry them, downed or not", () => {
    const mission = new Mission(AMARANTH_MISSION_1, undefined, [], { rng: () => 0 });
    neutralizeDefaultRoster(mission);
    const gallcyst = createBloomUnit("bloom_gallcyst", { x: 5, y: 5 }); // fx_acid_dot
    const sirenmaw = createBloomUnit("bloom_sirenmaw", { x: 6, y: 5 }); // fx_debuff_attack
    const heartwood = createBloomUnit("bloom_heartwood", { x: 7, y: 5 }); // fx_knockback_1
    gallcyst.downed = true; // "fought," not "killed," is the bar — downed still counts
    mission.units.push(gallcyst, sirenmaw, heartwood);

    const kinds = mission.getFoughtOnHitEffectKindsThisMission();
    expect(new Set(kinds)).toEqual(new Set(["acid_dot", "debuff_attack", "knockback"]));
  });

  it("dedups multiple hostiles carrying the same kind (Gallcyst and Wellroot both fx_acid_dot)", () => {
    const mission = new Mission(AMARANTH_MISSION_1, undefined, [], { rng: () => 0 });
    neutralizeDefaultRoster(mission);
    mission.units.push(createBloomUnit("bloom_gallcyst", { x: 5, y: 5 }), createBloomUnit("bloom_wellroot", { x: 6, y: 5 }));
    expect(mission.getFoughtOnHitEffectKindsThisMission()).toEqual(["acid_dot"]);
  });

  it("a Bloom archetype with no onHit field at all (Crawlmass) contributes nothing", () => {
    const mission = new Mission(AMARANTH_MISSION_1, undefined, [], { rng: () => 0 });
    neutralizeDefaultRoster(mission);
    mission.units.push(createBloomUnit("bloom_crawlmass", { x: 5, y: 5 }));
    expect(mission.getFoughtOnHitEffectKindsThisMission()).toEqual([]);
  });

  it("Undertow's fx_none is filtered out — flavor only, not a real effect to draw", () => {
    const mission = new Mission(AMARANTH_MISSION_1, undefined, [], { rng: () => 0 });
    neutralizeDefaultRoster(mission);
    mission.units.push(createBloomUnit("bloom_undertow", { x: 5, y: 5 }));
    expect(mission.getFoughtOnHitEffectKindsThisMission()).toEqual([]);
  });

  it("HOUSE AMARANTH FINDING: a House Amaranth hostile mech is reachable on the board but contributes nothing (no onHit data exists for any hostile mech)", () => {
    const mission = new Mission(AMARANTH_MISSION_1, undefined, [], { rng: () => 0 });
    neutralizeDefaultRoster(mission);
    mission.units.push(createHostileMechUnit("hostile_mech_amaranth_01", { x: 5, y: 5 }));
    expect(mission.getFoughtOnHitEffectKindsThisMission()).toEqual([]);
  });

  it("a player-side Bloom-shape unit (never happens in real play, but this method filters on side, not just kind) is excluded", () => {
    const mission = new Mission(AMARANTH_MISSION_1, undefined, [], { rng: () => 0 });
    neutralizeDefaultRoster(mission);
    const friendly = createBloomUnit("bloom_gallcyst", { x: 5, y: 5 });
    friendly.side = "player";
    mission.units.push(friendly);
    expect(mission.getFoughtOnHitEffectKindsThisMission()).toEqual([]);
  });
});

// =====================================================================
// recordFoughtOnHitEffectKinds — the campaign-persistent half
// =====================================================================

describe("recordFoughtOnHitEffectKinds (engine/campaignState.ts)", () => {
  it("starts undefined on a fresh campaign and records a first mission's kinds", () => {
    const state = createWardenCampaignState();
    expect(state.foughtOnHitEffectKinds).toBeUndefined();
    recordFoughtOnHitEffectKinds(state, ["acid_dot", "knockback"]);
    expect(new Set(state.foughtOnHitEffectKinds)).toEqual(new Set(["acid_dot", "knockback"]));
  });

  it("unions across missions — dedups an already-recorded kind, adds a genuinely new one", () => {
    const state = createWardenCampaignState();
    recordFoughtOnHitEffectKinds(state, ["acid_dot"]);
    recordFoughtOnHitEffectKinds(state, ["acid_dot", "stun"]);
    expect(new Set(state.foughtOnHitEffectKinds)).toEqual(new Set(["acid_dot", "stun"]));
    expect(state.foughtOnHitEffectKinds!.length).toBe(2); // no duplicate acid_dot entry
  });

  it("is a no-op given an empty array", () => {
    const state = createWardenCampaignState();
    recordFoughtOnHitEffectKinds(state, ["debuff_attack"]);
    recordFoughtOnHitEffectKinds(state, []);
    expect(state.foughtOnHitEffectKinds).toEqual(["debuff_attack"]);
  });
});

// =====================================================================
// seal_borrowed_authority — gating, refusal, draw, reroll
// =====================================================================

function setupSimulacrum(mission: Mission, abilityId: string, rank = 1): BattleUnit {
  const osric = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
  grant(osric, abilityId, rank);
  return osric;
}

describe("Mission.canSealBorrowedAuthority / sealBorrowedAuthority — gating and refusal", () => {
  it("refused without the ability, while downed, with no actions left, or on a hostile", () => {
    const mission = new Mission(AMARANTH_MISSION_1, undefined, [], {
      rng: () => 0,
      foughtOnHitEffectKinds: ["acid_dot"],
    });
    neutralizeDefaultRoster(mission);
    const hostile = createHostileMechUnit("hostile_mech_amaranth_01", { x: 9, y: 9 });
    hostile.abilities = ["seal_borrowed_authority"];
    mission.units.push(hostile);
    expect(mission.canSealBorrowedAuthority(hostile.instanceId)).toBe(false); // hostile side

    const osric = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    expect(mission.canSealBorrowedAuthority(osric.instanceId)).toBe(false); // no ability yet

    grant(osric, "seal_borrowed_authority");
    expect(mission.canSealBorrowedAuthority(osric.instanceId)).toBe(true);

    osric.actionsRemaining = 0;
    expect(mission.canSealBorrowedAuthority(osric.instanceId)).toBe(false);
    osric.actionsRemaining = MAX_ACTIONS_PER_TURN;

    osric.downed = true;
    expect(mission.canSealBorrowedAuthority(osric.instanceId)).toBe(false);
    osric.downed = false;
  });

  it("refuses with a real reason when nothing has been fought yet this campaign, without touching actions or cooldown", () => {
    const mission = new Mission(AMARANTH_MISSION_1, undefined, [], { rng: () => 0 }); // no foughtOnHitEffectKinds passed — defaults to []
    neutralizeDefaultRoster(mission);
    const osric = setupSimulacrum(mission, "seal_borrowed_authority");
    expect(mission.canSealBorrowedAuthority(osric.instanceId)).toBe(true); // the button itself is still "usable" — the refusal is inside the verb

    const result = mission.sealBorrowedAuthority(osric.instanceId);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/hasn't encountered anything to copy/);
    expect(result.kind).toBeUndefined();
    expect(osric.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN); // refusal cost nothing
    expect(osric.borrowedAuthorityFxKind).toBeUndefined();
  });

  it("is gated by SEAL_BORROWED_AUTHORITY_COOLDOWN_TURNS — refused right after use, ready exactly on schedule", () => {
    const mission = new Mission(AMARANTH_MISSION_1, undefined, [], { rng: () => 0, foughtOnHitEffectKinds: ["acid_dot"] });
    neutralizeDefaultRoster(mission);
    const osric = setupSimulacrum(mission, "seal_borrowed_authority");
    expect(mission.sealBorrowedAuthority(osric.instanceId).ok).toBe(true);

    const readyAtTurn = mission.turn + SEAL_BORROWED_AUTHORITY_COOLDOWN_TURNS;
    osric.actionsRemaining = MAX_ACTIONS_PER_TURN;
    mission.turn = readyAtTurn - 1;
    expect(mission.canSealBorrowedAuthority(osric.instanceId)).toBe(false);
    mission.turn = readyAtTurn;
    expect(mission.canSealBorrowedAuthority(osric.instanceId)).toBe(true);
  });

  it("rank1 draws a single kind from the pool via one rng call, consumes 1 action, primes borrowedAuthorityFxKind", () => {
    const pool = ["acid_dot", "debuff_attack", "knockback"] as const;
    let calls = 0;
    const mission = new Mission(AMARANTH_MISSION_1, undefined, [], {
      rng: () => {
        calls += 1;
        return 0.5; // index 1 of a 3-item pool -> "debuff_attack"
      },
      foughtOnHitEffectKinds: [...pool],
    });
    neutralizeDefaultRoster(mission);
    const osric = setupSimulacrum(mission, "seal_borrowed_authority", 1);
    const before = osric.actionsRemaining;

    const result = mission.sealBorrowedAuthority(osric.instanceId);

    expect(result).toEqual({ ok: true, kind: "debuff_attack" });
    expect(osric.borrowedAuthorityFxKind).toBe("debuff_attack");
    expect(osric.actionsRemaining).toBe(before - 1);
    expect(calls).toBe(1); // rank1 — exactly one draw, no reroll
    expect(logsMatching(mission, "Borrowed Authority").length).toBe(1);
  });

  it("rank5 consumes the rng stream TWICE and keeps the SECOND draw, discarding the first", () => {
    const pool = ["acid_dot", "debuff_attack", "knockback", "stun"] as const;
    const rolls = [0.01, 0.99]; // first draw -> index 0 ("acid_dot"), second -> index 3 ("stun")
    let i = 0;
    const mission = new Mission(AMARANTH_MISSION_1, undefined, [], {
      rng: () => rolls[i++],
      foughtOnHitEffectKinds: [...pool],
    });
    neutralizeDefaultRoster(mission);
    const osric = setupSimulacrum(mission, "seal_borrowed_authority", 5);

    const result = mission.sealBorrowedAuthority(osric.instanceId);

    expect(i).toBe(2); // both draws actually happened
    expect(result.kind).toBe("stun"); // the SECOND draw won, not the first
    expect(osric.borrowedAuthorityFxKind).toBe("stun");
  });
});

describe("Mission.attack — seal_borrowed_authority's copy applies on the wielder's own next mech-attacks-Bloom hit", () => {
  function primedWielder(mission: Mission, kind: string): BattleUnit {
    const attacker = testUnit("meeps", { x: 5, y: 5 }, { hp: 200, maxHp: 200 });
    attacker.abilities = ["seal_borrowed_authority"];
    attacker.borrowedAuthorityFxKind = kind as BattleUnit["borrowedAuthorityFxKind"];
    mission.units.push(attacker);
    return attacker;
  }

  it("acid_dot: applies BLOOM_ON_HIT_EFFECTS' fx_acid_dot onto the Bloom defender and clears the primed flag", () => {
    const mission = new Mission(AMARANTH_MISSION_1, undefined, [], { rng: () => 0 });
    neutralizeDefaultRoster(mission);
    clearTerrain(mission, [{ x: 5, y: 5 }, { x: 5, y: 6 }]);
    const attacker = primedWielder(mission, "acid_dot");
    const defender = createBloomUnit("bloom_undertow", { x: 5, y: 6 }); // Undertow's own onHit is fx_none — isolates this to the COPIED effect, not its own
    mission.units.push(defender);

    mission.attack(attacker.instanceId, defender.instanceId);

    expect(defender.statusEffects).toEqual([{ kind: "acid_dot", magnitude: 8, turnsRemaining: 2 }]);
    expect(attacker.borrowedAuthorityFxKind).toBeUndefined();
    expect(mission.log.some((l) => l.includes("Borrowed Authority copies a acid_dot effect"))).toBe(true);
  });

  it("debuff_attack: applies fx_debuff_attack onto the Bloom defender", () => {
    const mission = new Mission(AMARANTH_MISSION_1, undefined, [], { rng: () => 0 });
    neutralizeDefaultRoster(mission);
    clearTerrain(mission, [{ x: 5, y: 5 }, { x: 5, y: 6 }]);
    const attacker = primedWielder(mission, "debuff_attack");
    const defender = createBloomUnit("bloom_undertow", { x: 5, y: 6 });
    mission.units.push(defender);

    mission.attack(attacker.instanceId, defender.instanceId);

    expect(defender.statusEffects).toEqual([{ kind: "debuff_attack", magnitude: 0.2, turnsRemaining: 2 }]);
  });

  it("knockback: pushes the Bloom defender one tile away", () => {
    const mission = new Mission(AMARANTH_MISSION_1, undefined, [], { rng: () => 0 });
    neutralizeDefaultRoster(mission);
    clearTerrain(mission, [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 5, y: 7 }]);
    const attacker = primedWielder(mission, "knockback");
    const defender = createBloomUnit("bloom_undertow", { x: 5, y: 6 });
    mission.units.push(defender);

    mission.attack(attacker.instanceId, defender.instanceId);

    expect(defender.pos).toEqual({ x: 5, y: 7 });
  });

  it("stun: applies MECH_ON_HIT_EFFECTS' fx_shock_claws_stun onto the Bloom defender via applyMechOnHitEffect, same as Shock Claws", () => {
    const mission = new Mission(AMARANTH_MISSION_1, undefined, [], { rng: () => 0 });
    neutralizeDefaultRoster(mission);
    clearTerrain(mission, [{ x: 5, y: 5 }, { x: 5, y: 6 }]);
    const attacker = primedWielder(mission, "stun");
    const defender = createBloomUnit("bloom_undertow", { x: 5, y: 6 });
    mission.units.push(defender);

    mission.attack(attacker.instanceId, defender.instanceId);

    expect(defender.statusEffects).toEqual([{ kind: "stun", magnitude: 0, turnsRemaining: 1 }]);
  });

  it("a hit that downs the defender outright clears the primed flag but applies no effect", () => {
    const mission = new Mission(AMARANTH_MISSION_1, undefined, [], { rng: () => 0 });
    neutralizeDefaultRoster(mission);
    clearTerrain(mission, [{ x: 5, y: 5 }, { x: 5, y: 6 }]);
    const attacker = primedWielder(mission, "acid_dot");
    const defender = createBloomUnit("bloom_undertow", { x: 5, y: 6 });
    defender.endurance = 0;
    defender.collapsed = true;
    defender.vitality = 1;
    defender.currentHp = 1; // any nonzero hit downs this outright
    mission.units.push(defender);

    mission.attack(attacker.instanceId, defender.instanceId);

    expect(defender.downed).toBe(true);
    expect(defender.statusEffects).toEqual([]);
    expect(attacker.borrowedAuthorityFxKind).toBeUndefined();
  });

  it("does NOT consume the primed flag on an attack against a mech-shape (non-Bloom) defender — scoped to the mech-attacks-Bloom branch only, per design", () => {
    const mission = new Mission(AMARANTH_MISSION_1, undefined, [], { rng: () => 0 });
    neutralizeDefaultRoster(mission);
    clearTerrain(mission, [{ x: 5, y: 5 }, { x: 5, y: 6 }]);
    const attacker = primedWielder(mission, "acid_dot");
    const defender = testUnit("tank", { x: 5, y: 6 }, { hp: 200, maxHp: 200 });
    defender.side = "hostile";
    mission.units.push(defender);

    mission.attack(attacker.instanceId, defender.instanceId);

    expect(attacker.borrowedAuthorityFxKind).toBe("acid_dot"); // still primed — untouched by a mech-vs-mech attack
  });
});

// =====================================================================
// seal_ledgerhall_static — gating, target selection, jam draw, expiry
// =====================================================================

describe("Mission.canLedgerhallStatic / getLedgerhallStaticTargetsFrom", () => {
  it("refused without the ability, while downed, with no actions left, or on a hostile", () => {
    const mission = new Mission(AMARANTH_MISSION_1, undefined, [], { rng: () => 0 });
    neutralizeDefaultRoster(mission);
    const hostile = createHostileMechUnit("hostile_mech_amaranth_01", { x: 9, y: 9 });
    hostile.abilities = ["seal_ledgerhall_static"];
    mission.units.push(hostile);
    expect(mission.canLedgerhallStatic(hostile.instanceId)).toBe(false);

    const osric = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    expect(mission.canLedgerhallStatic(osric.instanceId)).toBe(false);
    grant(osric, "seal_ledgerhall_static");
    expect(mission.canLedgerhallStatic(osric.instanceId)).toBe(true);

    osric.actionsRemaining = 0;
    expect(mission.canLedgerhallStatic(osric.instanceId)).toBe(false);
    osric.actionsRemaining = MAX_ACTIONS_PER_TURN;

    osric.downed = true;
    expect(mission.canLedgerhallStatic(osric.instanceId)).toBe(false);
    osric.downed = false;
  });

  it("target list excludes Bloom (no abilities to jam) and non-visible hostiles, includes a visible hostile mech", () => {
    const mission = new Mission(AMARANTH_MISSION_1, undefined, [], { rng: () => 0 });
    neutralizeDefaultRoster(mission);
    const osric = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(osric, "seal_ledgerhall_static");
    const bloom = createBloomUnit("bloom_gallcyst", { x: 5, y: 6 }); // abilities: [] — nothing to jam
    const mech = createHostileMechUnit("hostile_mech_amaranth_01", { x: 5, y: 7 }); // path: tank -> real abilities
    mission.units.push(bloom, mech);

    const targets = mission.getLedgerhallStaticTargetsFrom(osric.instanceId).map((t) => t.instanceId);
    expect(targets).not.toContain(bloom.instanceId);
    expect(targets).toContain(mech.instanceId);
  });

  it("empty whenever canLedgerhallStatic is false", () => {
    const mission = new Mission(AMARANTH_MISSION_1, undefined, [], { rng: () => 0 });
    neutralizeDefaultRoster(mission);
    const osric = pilot(mission, "pilot_rourke", { x: 5, y: 5 }); // no ability granted
    const mech = createHostileMechUnit("hostile_mech_amaranth_01", { x: 5, y: 7 });
    mission.units.push(mech);
    expect(mission.getLedgerhallStaticTargetsFrom(osric.instanceId)).toEqual([]);
  });
});

describe("Mission.ledgerhallStatic — jam draw, cooldown, and expiry", () => {
  it("rank1 picks a uniformly random ability from the target's own list, sets the 2-turn jam, spends 1 action, starts the cooldown", () => {
    const mission = new Mission(AMARANTH_MISSION_1, undefined, [], { rng: () => 0 }); // index 0 of ["abil_overshield","abil_interdict"] -> abil_overshield
    neutralizeDefaultRoster(mission);
    const osric = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(osric, "seal_ledgerhall_static", 1);
    const mech = createHostileMechUnit("hostile_mech_amaranth_01", { x: 5, y: 7 }); // arch_tank_bipedal tier G: ["abil_overshield","abil_interdict"]
    mission.units.push(mech);
    const before = osric.actionsRemaining;

    const ok = mission.ledgerhallStatic(osric.instanceId, mech.instanceId);

    expect(ok).toBe(true);
    expect(mech.jammedAbilityId).toBe("abil_overshield");
    expect(mech.jammedAbilityTurnsRemaining).toBe(SEAL_LEDGERHALL_STATIC_JAM_DURATION_TURNS);
    expect(osric.actionsRemaining).toBe(before - 1);
    expect(mission.isAbilityJammed(mech, "abil_overshield")).toBe(true);
    expect(mission.isAbilityJammed(mech, "abil_interdict")).toBe(false);

    const readyAtTurn = mission.turn + SEAL_LEDGERHALL_STATIC_COOLDOWN_TURNS;
    osric.actionsRemaining = MAX_ACTIONS_PER_TURN;
    mission.turn = readyAtTurn - 1;
    expect(mission.canLedgerhallStatic(osric.instanceId)).toBe(false);
    mission.turn = readyAtTurn;
    expect(mission.canLedgerhallStatic(osric.instanceId)).toBe(true);
  });

  it("rank5 always picks by SEAL_LEDGERHALL_STATIC_ABILITY_PRIORITY (abil_overshield over abil_interdict), ignoring the random roll entirely", () => {
    const mission = new Mission(AMARANTH_MISSION_1, undefined, [], { rng: () => 0.99 }); // would pick index 1 (abil_interdict) at rank1
    neutralizeDefaultRoster(mission);
    const osric = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(osric, "seal_ledgerhall_static", 5);
    const mech = createHostileMechUnit("hostile_mech_amaranth_01", { x: 5, y: 7 });
    mission.units.push(mech);

    mission.ledgerhallStatic(osric.instanceId, mech.instanceId);

    expect(mech.jammedAbilityId).toBe("abil_overshield"); // higher SEAL_LEDGERHALL_STATIC_ABILITY_PRIORITY than abil_interdict
  });

  it("the jam expires after exactly SEAL_LEDGERHALL_STATIC_JAM_DURATION_TURNS passes through the start-of-own-next-turn reset loop", () => {
    const mission = new Mission(AMARANTH_MISSION_1, undefined, [], { rng: () => 0 });
    neutralizeDefaultRoster(mission);
    const osric = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(osric, "seal_ledgerhall_static");
    const mech = createHostileMechUnit("hostile_mech_amaranth_01", { x: 5, y: 7 }); // within osric's vision, unlike the AI-decision test above which doesn't need visibility at all
    mech.moveRange = 0;
    mech.attackRange = [99, 99]; // never reaches anyone — keeps the mission "ongoing" and quiet
    mission.units.push(mech);
    const jammed = mission.ledgerhallStatic(osric.instanceId, mech.instanceId);
    expect(jammed).toBe(true);
    expect(mech.jammedAbilityTurnsRemaining).toBe(2);

    mission.endPlayerTurn(); // one full round
    expect(mech.jammedAbilityTurnsRemaining).toBe(1);
    expect(mech.jammedAbilityId).toBe("abil_overshield"); // still jammed, not yet cleared

    mission.endPlayerTurn(); // second round — expires
    expect(mech.jammedAbilityTurnsRemaining).toBeUndefined();
    expect(mech.jammedAbilityId).toBeUndefined();
  });

  it("HONEST LIMITATION, proven rather than just asserted: decideHostileAction's decision for a jammed hostile is byte-identical to its decision when un-jammed — there is no per-ability AI dispatch for the jam to gate", () => {
    const mission = new Mission(AMARANTH_MISSION_1, undefined, [], { rng: () => 0 });
    neutralizeDefaultRoster(mission);
    clearTerrain(mission, [{ x: 5, y: 5 }, { x: 5, y: 6 }]);
    const target = testUnit("meeps", { x: 5, y: 6 }, { hp: 200, maxHp: 200 });
    mission.units.push(target);
    const mech = createHostileMechUnit("hostile_mech_amaranth_01", { x: 5, y: 5 });
    mission.units.push(mech);

    const before = decideHostileAction(mission.map, mech, mission.units);
    mech.jammedAbilityId = "abil_overshield";
    mech.jammedAbilityTurnsRemaining = 2;
    const after = decideHostileAction(mission.map, mech, mission.units);

    expect(after).toEqual(before);
  });
});

// =====================================================================
// seal_inherited_weight — mission-start-only passive DEF roll
// =====================================================================

/**
 * Builds a real DeployRosterEntry[] for AMARANTH_MISSION_1's own default
 * squad (findPilot/findMek, data/pilotRegistry.ts — the exact resolution
 * createPlayerUnit itself uses), with `pilot_rourke`'s entry carrying
 * `heirloomAbilityRanks: { seal_inherited_weight: rank }` — the real,
 * public mechanism (BattleUnit.heirloomAbilityRanks' own comment, and
 * scenes/Battle.ts's resolveDeployRoster) a fielded Heirloom ability
 * reaches a unit through, exercised here instead of reaching for a private
 * method or a post-construction ability graft: this is the only way
 * seal_inherited_weight's automatic, construction-time roll is actually
 * reachable in real play, so it's the only way these tests reach it too.
 */
function rosterWithInheritedWeight(rank: number) {
  return AMARANTH_MISSION_1.playerPilotIds.map((pilotId) => {
    const pilotRecord = findPilot(pilotId)!;
    const mek = findMek(pilotRecord.mekId);
    return {
      pilotId,
      pilot: pilotRecord,
      mek,
      heirloomAbilityRanks: pilotId === "pilot_rourke" ? { seal_inherited_weight: rank } : undefined,
    };
  });
}

describe("Mission construction — seal_inherited_weight's passive DEF roll", () => {
  it("rank1: rolls exactly once at construction, in [0,15], added directly onto effectiveDefense, recorded on inheritedWeightDefBonus", () => {
    const baseline = new Mission(AMARANTH_MISSION_1); // no ability, no rng override — just the base stat to compare against
    const baseDefense = baseline.units.find((u) => u.pilotId === "pilot_rourke")!.effectiveDefense;

    const mission = new Mission(AMARANTH_MISSION_1, rosterWithInheritedWeight(1), [], { rng: () => 0 }); // floor of the range
    const osric = mission.units.find((u) => u.pilotId === "pilot_rourke")!;

    expect(osric.inheritedWeightDefBonus).toBe(SEAL_INHERITED_WEIGHT_DEF_BONUS_MIN_RANK1);
    expect(osric.effectiveDefense).toBe(baseDefense + SEAL_INHERITED_WEIGHT_DEF_BONUS_MIN_RANK1);
    expect(mission.log.some((l) => l.includes("Inherited Weight"))).toBe(true);
  });

  it("rank1 with rng forced to just under 1 rolls the ceiling of the rank1 range (+15)", () => {
    const baseline = new Mission(AMARANTH_MISSION_1);
    const baseDefense = baseline.units.find((u) => u.pilotId === "pilot_rourke")!.effectiveDefense;

    const mission = new Mission(AMARANTH_MISSION_1, rosterWithInheritedWeight(1), [], { rng: () => 0.9999 });
    const osric = mission.units.find((u) => u.pilotId === "pilot_rourke")!;

    expect(osric.inheritedWeightDefBonus).toBe(SEAL_INHERITED_WEIGHT_DEF_BONUS_MAX_RANK1);
    expect(osric.effectiveDefense).toBe(baseDefense + SEAL_INHERITED_WEIGHT_DEF_BONUS_MAX_RANK1);
  });

  it("rank5's floor narrows to +8 (rng forced to 0 rolls exactly +8, not +0), ceiling stays +15", () => {
    const floor = new Mission(AMARANTH_MISSION_1, rosterWithInheritedWeight(5), [], { rng: () => 0 });
    const osricFloor = floor.units.find((u) => u.pilotId === "pilot_rourke")!;
    expect(osricFloor.inheritedWeightDefBonus).toBe(SEAL_INHERITED_WEIGHT_DEF_BONUS_MIN_RANK5);
    expect(osricFloor.inheritedWeightDefBonus).toBe(8);

    const ceiling = new Mission(AMARANTH_MISSION_1, rosterWithInheritedWeight(5), [], { rng: () => 0.9999 });
    const osricCeiling = ceiling.units.find((u) => u.pilotId === "pilot_rourke")!;
    expect(osricCeiling.inheritedWeightDefBonus).toBe(SEAL_INHERITED_WEIGHT_DEF_BONUS_MAX_RANK5);
  });

  it("respects the mission's own seeded rng for reproducibility — two missions built with the identical rng function roll the identical bonus", () => {
    const rngFactory = () => {
      let seed = 12345;
      return () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      };
    };
    const missionA = new Mission(AMARANTH_MISSION_1, rosterWithInheritedWeight(1), [], { rng: rngFactory() });
    const missionB = new Mission(AMARANTH_MISSION_1, rosterWithInheritedWeight(1), [], { rng: rngFactory() });

    const osricA = missionA.units.find((u) => u.pilotId === "pilot_rourke")!;
    const osricB = missionB.units.find((u) => u.pilotId === "pilot_rourke")!;
    expect(osricA.inheritedWeightDefBonus).toBe(osricB.inheritedWeightDefBonus);
  });

  it("stays fixed for the whole mission — survives multiple endPlayerTurn() round-trips unchanged", () => {
    const mission = new Mission(AMARANTH_MISSION_1, rosterWithInheritedWeight(1), [], { rng: () => 0.5 });
    neutralizeDefaultRoster(mission);
    const osric = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    osric.downed = false;
    const bonus = osric.inheritedWeightDefBonus;
    const defenseAfterRoll = osric.effectiveDefense;
    const decoy = testUnit("meeps", { x: 0, y: 0 });
    decoy.side = "hostile";
    decoy.moveRange = 0;
    decoy.attackRange = [99, 99];
    mission.units.push(decoy);

    mission.endPlayerTurn();
    mission.endPlayerTurn();

    expect(osric.inheritedWeightDefBonus).toBe(bonus);
    expect(osric.effectiveDefense).toBe(defenseAfterRoll);
  });

  it("never rolls for a unit that doesn't carry the ability", () => {
    const mission = new Mission(AMARANTH_MISSION_1, rosterWithInheritedWeight(1), [], { rng: () => 0 });
    const anand = mission.units.find((u) => u.pilotId === "pilot_anand")!;
    expect(anand.inheritedWeightDefBonus).toBeUndefined();
  });
});
