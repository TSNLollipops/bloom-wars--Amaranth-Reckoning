// Vault Phase 2, slice 3 (3 Sep 2026) — Surtr's full 3-ability kit:
// cinder_line_signature, cinder_firebreak, cinder_draft (Halden Kestrel,
// House Kestrel, "Any" path). See data/heirlooms.ts's own "VAULT PHASE 2,
// SLICE 3" header and engine/mission.ts's SurtrLine interface comment for
// the full design. Sibling file to heirloomSignatures2.test.ts (slice 2's
// three Heirloom signatures) — same house test style throughout: this file
// reuses that one's quietMission()/pilot()/mover()/grant()/logsMatching()
// convention verbatim rather than importing it (per that file's own header,
// each Vault-slice test file keeps its own local copy).
//
// One honestly-reported design call worth flagging up front, not just at
// its own definition site: "a chosen line of up to 5 tiles" has no
// line-targeting UI precedent anywhere in this codebase to transcribe
// (Requiem, the one other "line attack" this codebase's own vocabulary
// names, is itself unbuilt). The tests below pin the fallback actually
// built — engine/mission.ts's CINDER_LINE_DIRECTIONS comment has the full
// reasoning — an 8-directional (cardinal + diagonal) straight run starting
// adjacent to the wielder, one click setting both direction and length.
import { describe, it, expect } from "vitest";
import { Mission } from "../mission";
import { AMARANTH_MISSION_1 } from "../../data/campaignAmaranth";
import { createHostileMechUnit, createBloomUnit, type BattleUnit } from "../units";
import {
  MAX_ACTIONS_PER_TURN,
  CINDER_LINE_MAX_TILES,
  CINDER_LINE_DAMAGE_PER_TURN,
  CINDER_LINE_DURATION_TURNS,
  CINDER_LINE_RANK5_DURATION_TURNS,
  CINDER_LINE_SIGNATURE_COOLDOWN_TURNS,
  CINDER_FIREBREAK_COOLDOWN_TURNS,
  CINDER_DRAFT_DURATION_TURNS,
  CINDER_DRAFT_RANK5_DURATION_TURNS,
  CINDER_DRAFT_COOLDOWN_TURNS,
} from "../../data/combatTables";

const PARK: Record<string, { x: number; y: number }> = {
  pilot_rourke: { x: 0, y: 0 },
  pilot_bosk: { x: 1, y: 0 },
  pilot_iyari: { x: 2, y: 0 },
  pilot_anand: { x: 3, y: 0 },
  pilot_lask: { x: 4, y: 0 },
};

function quietMission(): Mission {
  const mission = new Mission(AMARANTH_MISSION_1);
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

// hostile_mech_02 (Meeps path), not _01 (Tank path) — deliberately, same
// reason heirloomSignatures2.test.ts's own dodge test picks a non-Tank
// source: TANK_SHIELD_CAPACITY's regen (engine/mission.ts's
// tickShieldRegen, called at the TOP of environmentStep — before
// tickSurtrLines runs later in that same method) would silently absorb part
// of a burn tick against a Tank-path hostile, a REAL interaction but not
// what these tests isolate. Found the same way the Oathkeeper tests' own
// comment describes: tracing a short-by-8 damage assertion to a nonzero
// unit.shield at the tick, not by inspection.
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

const logsMatching = (mission: Mission, needle: string) => mission.log.filter((l) => l.includes(needle));

// =====================================================================
// cinder_line_signature (Surtr) — placing a line
// =====================================================================

describe("Mission.cinderLineSignature (cinder_line_signature — Surtr/Cinder Line)", () => {
  it("cardinal placement: ignites every tile from the wielder's adjacent tile out to the click, at rank-1 duration/damage, costs the full action budget, and logs it", () => {
    const mission = quietMission();
    const halden = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(halden, "cinder_line_signature", 1);

    expect(mission.canCinderLineSignature(halden.instanceId)).toBe(true);
    expect(mission.cinderLineSignature(halden.instanceId, { x: 8, y: 5 })).toBe(true);

    const lines = mission.getActiveSurtrLines();
    expect(lines.length).toBe(1);
    const line = lines[0];
    expect(line.ownerId).toBe(halden.instanceId);
    expect(line.ownerSide).toBe("player");
    expect(line.tiles).toEqual([
      { x: 6, y: 5 },
      { x: 7, y: 5 },
      { x: 8, y: 5 },
    ]);
    expect(line.damagePerTurn).toBe(CINDER_LINE_DAMAGE_PER_TURN);
    expect(line.turnsRemaining).toBe(CINDER_LINE_DURATION_TURNS);
    expect(line.friendlyImmuneTurnsRemaining).toBe(0);
    expect(halden.actionsRemaining).toBe(0);
    expect(logsMatching(mission, "sets a 3-tile line burning").length).toBe(1);
  });

  it("diagonal placement works identically to cardinal", () => {
    const mission = quietMission();
    const halden = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(halden, "cinder_line_signature", 1);
    mission.cinderLineSignature(halden.instanceId, { x: 8, y: 8 });
    expect(mission.getActiveSurtrLines()[0].tiles).toEqual([
      { x: 6, y: 6 },
      { x: 7, y: 7 },
      { x: 8, y: 8 },
    ]);
  });

  it("rank 5: duration is CINDER_LINE_RANK5_DURATION_TURNS, damage unchanged", () => {
    const mission = quietMission();
    const halden = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(halden, "cinder_line_signature", 5);
    mission.cinderLineSignature(halden.instanceId, { x: 8, y: 5 });
    const line = mission.getActiveSurtrLines()[0];
    expect(line.turnsRemaining).toBe(CINDER_LINE_RANK5_DURATION_TURNS);
    expect(line.damagePerTurn).toBe(CINDER_LINE_DAMAGE_PER_TURN);
    expect(CINDER_LINE_RANK5_DURATION_TURNS).toBeGreaterThan(CINDER_LINE_DURATION_TURNS);
  });

  it("rejects a target that isn't a straight cardinal/diagonal run from the wielder (a knight's-move offset) — no line created, action untouched", () => {
    const mission = quietMission();
    const halden = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(halden, "cinder_line_signature", 1);
    expect(mission.cinderLineSignature(halden.instanceId, { x: 7, y: 6 })).toBe(false);
    expect(mission.getActiveSurtrLines().length).toBe(0);
    expect(halden.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN);
  });

  it("rejects a target beyond CINDER_LINE_MAX_TILES", () => {
    const mission = quietMission();
    const halden = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(halden, "cinder_line_signature", 1);
    expect(mission.cinderLineSignature(halden.instanceId, { x: 5 + CINDER_LINE_MAX_TILES + 1, y: 5 })).toBe(false);
    expect(mission.getActiveSurtrLines().length).toBe(0);
  });

  it("rejects the wielder's own tile as a target (a zero-length line is meaningless)", () => {
    const mission = quietMission();
    const halden = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(halden, "cinder_line_signature", 1);
    expect(mission.cinderLineSignature(halden.instanceId, { x: 5, y: 5 })).toBe(false);
    expect(mission.getActiveSurtrLines().length).toBe(0);
  });

  it("getCinderLineAreaFrom: every legal endpoint in all 8 directions up to CINDER_LINE_MAX_TILES, clipped at the board edge, wielder's own tile excluded", () => {
    const mission = quietMission();
    const halden = pilot(mission, "pilot_rourke", { x: 0, y: 0 }); // top-left corner — clipping exercised on both axes
    grant(halden, "cinder_line_signature", 1);
    const area = mission.getCinderLineAreaFrom(halden.instanceId, halden.pos);
    // Only the 3 directions that stay in-bounds from a corner: +x, +y, +x+y.
    expect(area).toEqual(
      expect.arrayContaining([
        { x: 1, y: 0 },
        { x: CINDER_LINE_MAX_TILES, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: CINDER_LINE_MAX_TILES },
        { x: 1, y: 1 },
        { x: CINDER_LINE_MAX_TILES, y: CINDER_LINE_MAX_TILES },
      ])
    );
    expect(area).not.toContainEqual({ x: 0, y: 0 });
    expect(area).not.toContainEqual({ x: -1, y: 0 });
    expect(area).not.toContainEqual({ x: 0, y: -1 });
  });

  it("previewCinderLineFrom matches what cinderLineSignature would actually ignite, and is null for an illegal endpoint", () => {
    const mission = quietMission();
    const halden = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(halden, "cinder_line_signature", 1);
    expect(mission.previewCinderLineFrom(halden.instanceId, { x: 8, y: 5 })).toEqual([
      { x: 6, y: 5 },
      { x: 7, y: 5 },
      { x: 8, y: 5 },
    ]);
    expect(mission.previewCinderLineFrom(halden.instanceId, { x: 7, y: 6 })).toBeNull();
  });

  it("is gated by CINDER_LINE_SIGNATURE_COOLDOWN_TURNS — refused right after use, ready exactly on schedule", () => {
    const mission = quietMission();
    const halden = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(halden, "cinder_line_signature", 1);
    mission.cinderLineSignature(halden.instanceId, { x: 8, y: 5 });
    const readyAtTurn = mission.turn + CINDER_LINE_SIGNATURE_COOLDOWN_TURNS;
    halden.actionsRemaining = MAX_ACTIONS_PER_TURN;
    mission.turn = readyAtTurn - 1;
    expect(mission.canCinderLineSignature(halden.instanceId)).toBe(false);
    mission.turn = readyAtTurn;
    expect(mission.canCinderLineSignature(halden.instanceId)).toBe(true);
  });

  it("refuses a unit without the ability, an unknown id, a downed unit, a spent unit, and any hostile", () => {
    const mission = quietMission();
    const iyari = pilot(mission, "pilot_iyari", { x: 5, y: 5 });
    expect(iyari.abilities).not.toContain("cinder_line_signature");
    expect(mission.canCinderLineSignature(iyari.instanceId)).toBe(false);
    expect(mission.cinderLineSignature(iyari.instanceId, { x: 8, y: 5 })).toBe(false);

    expect(mission.cinderLineSignature("no_such_unit", { x: 8, y: 5 })).toBe(false);

    const hostile = mover(mission, { x: 15, y: 8 });
    grant(hostile, "cinder_line_signature", 1);
    expect(mission.canCinderLineSignature(hostile.instanceId)).toBe(false);

    const halden = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(halden, "cinder_line_signature", 1);
    halden.actionsRemaining = 0;
    expect(mission.canCinderLineSignature(halden.instanceId)).toBe(false);
    halden.actionsRemaining = MAX_ACTIONS_PER_TURN;
    halden.downed = true;
    expect(mission.canCinderLineSignature(halden.instanceId)).toBe(false);
  });
});

// =====================================================================
// tickSurtrLines (via environmentStep/endPlayerTurn) — the per-turn burn
// =====================================================================

describe("Mission: Surtr line environment tick — friendly fire, expiry, and reach", () => {
  it("damages a hostile standing on the line at the next environment tick", () => {
    const mission = quietMission();
    const halden = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(halden, "cinder_line_signature", 1);
    const hostile = mover(mission, { x: 6, y: 5 }, { hp: 999 });
    mission.cinderLineSignature(halden.instanceId, { x: 8, y: 5 });

    mission.endPlayerTurn(); // one full round -> one environmentStep tick
    expect(hostile.currentHp).toBe(999 - CINDER_LINE_DAMAGE_PER_TURN);
  });

  it("damages a FRIENDLY unit standing on the line too — no exception on the tiles themselves", () => {
    const mission = quietMission();
    const halden = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(halden, "cinder_line_signature", 1);
    const ally = pilot(mission, "pilot_iyari", { x: 6, y: 5 });
    ally.maxHp = 999;
    ally.currentHp = 999;
    mission.cinderLineSignature(halden.instanceId, { x: 8, y: 5 });

    mission.endPlayerTurn();
    expect(ally.currentHp).toBe(999 - CINDER_LINE_DAMAGE_PER_TURN);
  });

  it("does not damage a unit standing off the line", () => {
    const mission = quietMission();
    const halden = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(halden, "cinder_line_signature", 1);
    const bystander = mover(mission, { x: 6, y: 9 }, { hp: 999 });
    mission.cinderLineSignature(halden.instanceId, { x: 8, y: 5 });

    mission.endPlayerTurn();
    expect(bystander.currentHp).toBe(999);
  });

  it("works against a Bloom-shape defender too, through applyBloomDamage", () => {
    const mission = quietMission();
    const halden = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(halden, "cinder_line_signature", 1);
    const bloom = createBloomUnit("bloom_crawlmass", { x: 6, y: 5 });
    mission.units.push(bloom);
    const hpBefore = bloom.currentHp;
    mission.cinderLineSignature(halden.instanceId, { x: 8, y: 5 });

    mission.endPlayerTurn();
    expect(bloom.currentHp).toBeLessThan(hpBefore);
  });

  it("ticks for exactly CINDER_LINE_DURATION_TURNS rounds, then the line is gone", () => {
    const mission = quietMission();
    const halden = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(halden, "cinder_line_signature", 1);
    const hostile = mover(mission, { x: 6, y: 5 }, { hp: 99999 });
    mission.cinderLineSignature(halden.instanceId, { x: 8, y: 5 });

    for (let i = 0; i < CINDER_LINE_DURATION_TURNS; i++) {
      expect(mission.getActiveSurtrLines().length).toBe(1);
      mission.endPlayerTurn();
    }
    expect(mission.getActiveSurtrLines().length).toBe(0);
    expect(hostile.currentHp).toBe(99999 - CINDER_LINE_DAMAGE_PER_TURN * CINDER_LINE_DURATION_TURNS);
    expect(logsMatching(mission, "burns itself out").length).toBe(1);
  });

  it("a lethal tick downs a unit through the real handleDowned path", () => {
    const mission = quietMission();
    const halden = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(halden, "cinder_line_signature", 1);
    const hostile = mover(mission, { x: 6, y: 5 }, { hp: CINDER_LINE_DAMAGE_PER_TURN });
    mission.cinderLineSignature(halden.instanceId, { x: 8, y: 5 });

    mission.endPlayerTurn();
    expect(hostile.currentHp).toBe(0);
    expect(hostile.downed).toBe(true);
    expect(logsMatching(mission, `${hostile.displayName} is downed.`).length).toBe(1);
  });
});

// =====================================================================
// cinder_firebreak (Firebreak)
// =====================================================================

describe("Mission.firebreak (cinder_firebreak — Firebreak)", () => {
  it("extinguishes the wielder's own active line, costs 1 action, does NOT end the turn, and logs it", () => {
    const mission = quietMission();
    const halden = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(halden, "cinder_line_signature", 1);
    grant(halden, "cinder_firebreak", 1);
    mission.cinderLineSignature(halden.instanceId, { x: 8, y: 5 });
    halden.actionsRemaining = MAX_ACTIONS_PER_TURN; // isolate from the signature's own turn-ending cost

    expect(mission.canFirebreak(halden.instanceId)).toBe(true);
    expect(mission.firebreak(halden.instanceId)).toBe(true);
    expect(mission.getActiveSurtrLines().length).toBe(0);
    expect(halden.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN - 1);
    expect(logsMatching(mission, "snuffs the line").length).toBe(1);
  });

  it("rank 1: no bonus burst — a hostile standing on the extinguished line takes no damage from Firebreak itself", () => {
    const mission = quietMission();
    const halden = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(halden, "cinder_line_signature", 1);
    grant(halden, "cinder_firebreak", 1);
    const hostile = mover(mission, { x: 6, y: 5 }, { hp: 999 });
    mission.cinderLineSignature(halden.instanceId, { x: 8, y: 5 });
    halden.actionsRemaining = MAX_ACTIONS_PER_TURN;

    mission.firebreak(halden.instanceId);
    expect(hostile.currentHp).toBe(999);
    expect(hostile.downed).toBe(false);
  });

  it("rank 5: deals the line's remaining total damage (damagePerTurn * turnsRemaining) to every hostile on it, all at once, credited as a kill through the real path", () => {
    const mission = quietMission();
    const halden = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(halden, "cinder_line_signature", 1);
    grant(halden, "cinder_firebreak", 5);
    const remainingTotal = CINDER_LINE_DAMAGE_PER_TURN * CINDER_LINE_DURATION_TURNS;
    const hostile = mover(mission, { x: 6, y: 5 }, { hp: remainingTotal });
    mission.cinderLineSignature(halden.instanceId, { x: 8, y: 5 });
    halden.actionsRemaining = MAX_ACTIONS_PER_TURN;

    mission.firebreak(halden.instanceId);
    expect(hostile.currentHp).toBe(0);
    expect(hostile.downed).toBe(true);
    expect(mission.unitPerformance["pilot_rourke"].kills).toBe(1);
    expect(logsMatching(mission, "caught in the burst").length).toBe(1);
  });

  it("rank 5's burst does NOT hit a friendly standing on the same line — 'every hostile' means hostile, not everyone", () => {
    const mission = quietMission();
    const halden = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(halden, "cinder_line_signature", 1);
    grant(halden, "cinder_firebreak", 5);
    const ally = pilot(mission, "pilot_iyari", { x: 6, y: 5 });
    ally.maxHp = 999;
    ally.currentHp = 999;
    mission.cinderLineSignature(halden.instanceId, { x: 8, y: 5 });
    halden.actionsRemaining = MAX_ACTIONS_PER_TURN;

    mission.firebreak(halden.instanceId);
    expect(ally.currentHp).toBe(999);
  });

  it("is gated by CINDER_FIREBREAK_COOLDOWN_TURNS — refused right after use, ready exactly on schedule", () => {
    const mission = quietMission();
    const halden = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(halden, "cinder_line_signature", 1);
    grant(halden, "cinder_firebreak", 1);
    mission.cinderLineSignature(halden.instanceId, { x: 8, y: 5 });
    halden.actionsRemaining = MAX_ACTIONS_PER_TURN;
    mission.firebreak(halden.instanceId);
    const readyAtTurn = mission.turn + CINDER_FIREBREAK_COOLDOWN_TURNS;

    // Isolate the cooldown check: re-arm a fresh line so canFirebreak's own
    // "is there anything to extinguish" gate doesn't mask the cooldown gate.
    grant(halden, "cinder_line_signature", 1);
    halden.abilityCooldowns!["cinder_line_signature"] = 0;
    halden.actionsRemaining = MAX_ACTIONS_PER_TURN;
    mission.cinderLineSignature(halden.instanceId, { x: 8, y: 5 });
    halden.actionsRemaining = MAX_ACTIONS_PER_TURN;

    mission.turn = readyAtTurn - 1;
    expect(mission.canFirebreak(halden.instanceId)).toBe(false);
    mission.turn = readyAtTurn;
    expect(mission.canFirebreak(halden.instanceId)).toBe(true);
  });

  it("refuses cleanly when the wielder has no active line to extinguish", () => {
    const mission = quietMission();
    const halden = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(halden, "cinder_firebreak", 1);
    expect(mission.getActiveSurtrLines().length).toBe(0);
    expect(mission.canFirebreak(halden.instanceId)).toBe(false);
    expect(mission.firebreak(halden.instanceId)).toBe(false);
    expect(halden.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN); // untouched — nothing happened
  });

  it("refuses a unit without the ability, an unknown id, a downed unit, a spent unit, and any hostile", () => {
    const mission = quietMission();
    const iyari = pilot(mission, "pilot_iyari", { x: 5, y: 5 });
    expect(mission.canFirebreak(iyari.instanceId)).toBe(false);
    expect(mission.firebreak(iyari.instanceId)).toBe(false);
    expect(mission.firebreak("no_such_unit")).toBe(false);

    const hostile = mover(mission, { x: 15, y: 8 });
    grant(hostile, "cinder_firebreak", 1);
    expect(mission.canFirebreak(hostile.instanceId)).toBe(false);

    const halden = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(halden, "cinder_line_signature", 1);
    grant(halden, "cinder_firebreak", 1);
    mission.cinderLineSignature(halden.instanceId, { x: 8, y: 5 });
    halden.actionsRemaining = 0;
    expect(mission.canFirebreak(halden.instanceId)).toBe(false);
    halden.actionsRemaining = MAX_ACTIONS_PER_TURN;
    halden.downed = true;
    expect(mission.canFirebreak(halden.instanceId)).toBe(false);
  });
});

// =====================================================================
// cinder_draft (Draft)
// =====================================================================

describe("Mission.draft (cinder_draft — Draft)", () => {
  it("grants the wielder's own active line's friendlies immunity — an ally on it takes no damage while the window is open, a hostile on the SAME line still does", () => {
    const mission = quietMission();
    const halden = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(halden, "cinder_line_signature", 1);
    grant(halden, "cinder_draft", 1);
    const ally = pilot(mission, "pilot_iyari", { x: 6, y: 5 });
    ally.maxHp = 999;
    ally.currentHp = 999;
    const hostile = mover(mission, { x: 7, y: 5 }, { hp: 999 });
    mission.cinderLineSignature(halden.instanceId, { x: 8, y: 5 });
    halden.actionsRemaining = MAX_ACTIONS_PER_TURN;

    expect(mission.canDraft(halden.instanceId)).toBe(true);
    expect(mission.draft(halden.instanceId)).toBe(true);
    const line = mission.getActiveSurtrLines()[0];
    expect(line.friendlyImmuneTurnsRemaining).toBe(CINDER_DRAFT_DURATION_TURNS);
    expect(halden.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN - 1);
    expect(logsMatching(mission, "calls Draft").length).toBe(1);

    mission.endPlayerTurn();
    expect(ally.currentHp).toBe(999); // immune
    expect(hostile.currentHp).toBe(999 - CINDER_LINE_DAMAGE_PER_TURN); // not immune — Draft only excuses the wielder's own side
  });

  it("rank 5: immunity lasts CINDER_DRAFT_RANK5_DURATION_TURNS ticks instead of 1, then damage resumes", () => {
    const mission = quietMission();
    const halden = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(halden, "cinder_line_signature", 5); // rank 5 signature so the line outlives a 2-turn immunity window
    grant(halden, "cinder_draft", 5);
    const ally = pilot(mission, "pilot_iyari", { x: 6, y: 5 });
    ally.maxHp = 999;
    ally.currentHp = 999;
    mission.cinderLineSignature(halden.instanceId, { x: 8, y: 5 });
    halden.actionsRemaining = MAX_ACTIONS_PER_TURN;
    mission.draft(halden.instanceId);
    expect(mission.getActiveSurtrLines()[0].friendlyImmuneTurnsRemaining).toBe(CINDER_DRAFT_RANK5_DURATION_TURNS);

    for (let i = 0; i < CINDER_DRAFT_RANK5_DURATION_TURNS; i++) {
      mission.endPlayerTurn();
      expect(ally.currentHp).toBe(999); // still immune through both windowed ticks
    }
    mission.endPlayerTurn(); // window closed — this tick lands
    expect(ally.currentHp).toBe(999 - CINDER_LINE_DAMAGE_PER_TURN);
  });

  it("is gated by CINDER_DRAFT_COOLDOWN_TURNS — refused right after use, ready exactly on schedule", () => {
    const mission = quietMission();
    const halden = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(halden, "cinder_line_signature", 5); // rank 5 duration so the line survives long enough to re-check
    grant(halden, "cinder_draft", 1);
    mission.cinderLineSignature(halden.instanceId, { x: 8, y: 5 });
    halden.actionsRemaining = MAX_ACTIONS_PER_TURN;
    mission.draft(halden.instanceId);
    const readyAtTurn = mission.turn + CINDER_DRAFT_COOLDOWN_TURNS;

    halden.actionsRemaining = MAX_ACTIONS_PER_TURN;
    mission.turn = readyAtTurn - 1;
    expect(mission.canDraft(halden.instanceId)).toBe(false);
    mission.turn = readyAtTurn;
    expect(mission.canDraft(halden.instanceId)).toBe(true);
  });

  it("refuses cleanly when the wielder has no active line", () => {
    const mission = quietMission();
    const halden = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(halden, "cinder_draft", 1);
    expect(mission.canDraft(halden.instanceId)).toBe(false);
    expect(mission.draft(halden.instanceId)).toBe(false);
    expect(halden.actionsRemaining).toBe(MAX_ACTIONS_PER_TURN);
  });

  it("refuses a unit without the ability, an unknown id, a downed unit, a spent unit, and any hostile", () => {
    const mission = quietMission();
    const iyari = pilot(mission, "pilot_iyari", { x: 5, y: 5 });
    expect(mission.canDraft(iyari.instanceId)).toBe(false);
    expect(mission.draft(iyari.instanceId)).toBe(false);
    expect(mission.draft("no_such_unit")).toBe(false);

    const hostile = mover(mission, { x: 15, y: 8 });
    grant(hostile, "cinder_draft", 1);
    expect(mission.canDraft(hostile.instanceId)).toBe(false);

    const halden = pilot(mission, "pilot_rourke", { x: 5, y: 5 });
    grant(halden, "cinder_line_signature", 1);
    grant(halden, "cinder_draft", 1);
    mission.cinderLineSignature(halden.instanceId, { x: 8, y: 5 });
    halden.actionsRemaining = 0;
    expect(mission.canDraft(halden.instanceId)).toBe(false);
    halden.actionsRemaining = MAX_ACTIONS_PER_TURN;
    halden.downed = true;
    expect(mission.canDraft(halden.instanceId)).toBe(false);
  });
});
