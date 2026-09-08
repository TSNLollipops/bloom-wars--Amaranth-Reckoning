// Mission rework pass (8 Sep 2026): a hostile-mech wave or spawn event may
// name the gear tier its mechs arrive at — EnemyWave.tier / the spawn
// action's tier (data/types.ts), read by engine/units.ts's
// createHostileMechUnit through engine/mission.ts's two spawn paths. The
// spawn action's field had existed since the event system shipped and was
// never read; this is the first time either does anything.
//
// House style: real Mission objects from a real def (AMARANTH_MISSION_6,
// the first mech-vs-mech mission) with a synthetic wave/event override,
// same pattern as mirrorDeployment.test.ts.
import { describe, it, expect } from "vitest";
import { Mission } from "../mission";
import { AMARANTH_MISSION_6 } from "../../data/campaignAmaranth";
import { TIERS } from "../../data/combatTables";
import { UNIT_ARCHETYPES, ALL_HOSTILE_MECHS } from "../../data/units";
import type { CampaignMission, EnemyWave, MissionEvent } from "../../data/types";

function missionWith(enemyWaves: EnemyWave[], events: MissionEvent[] = []): CampaignMission {
  return { ...AMARANTH_MISSION_6, enemyWaves, events };
}

function hostilesOf(m: Mission) {
  return m.units.filter((u) => u.side === "hostile");
}

describe("hostile mech tier override", () => {
  const mechId = "hostile_mech_amaranth_01";
  const arch = UNIT_ARCHETYPES[`arch_${ALL_HOSTILE_MECHS[mechId].path}_bipedal`];

  it("a wave with no tier deploys at the archetype's own tier (G) — the pre-pass behaviour", () => {
    const m = new Mission(missionWith([{ archetypeId: mechId, count: 1, atTurn: 1, spawnAt: "enemy_deploy" }]));
    const [u] = hostilesOf(m);
    expect(u.effectiveAttack).toBe(arch.baseAttack + (TIERS.G.attack - 100));
    expect(u.maxHp).toBe(arch.baseHp + (TIERS.G.hp - 100));
    expect(u.moveRange).toBe(arch.moveRange + TIERS.G.move);
  });

  it("a wave's tier is applied to every mech it spawns", () => {
    const m = new Mission(missionWith([{ archetypeId: mechId, count: 3, atTurn: 1, spawnAt: "enemy_deploy", tier: "B" }]));
    const hs = hostilesOf(m);
    expect(hs).toHaveLength(3);
    for (const u of hs) {
      expect(u.effectiveAttack).toBe(arch.baseAttack + (TIERS.B.attack - 100));
      expect(u.effectiveDefense).toBe(arch.baseDefense + (TIERS.B.defense - 100));
      expect(u.maxHp).toBe(arch.baseHp + (TIERS.B.hp - 100));
      expect(u.currentHp).toBe(u.maxHp);
      expect(u.moveRange).toBe(arch.moveRange + TIERS.B.move);
    }
  });

  it("a spawn event's tier (declared since the event system shipped, unread until now) is applied too", () => {
    const m = new Mission(
      missionWith(
        [],
        [
          {
            id: "ev_test_tiered_spawn",
            trigger: { type: "turn_start", turn: 1 },
            action: { type: "spawn", archetypeIds: [mechId, mechId], at: [{ x: 15, y: 4 }, { x: 15, y: 7 }], tier: "C" },
            once: true,
          },
        ]
      )
    );
    const hs = hostilesOf(m);
    expect(hs).toHaveLength(2);
    for (const u of hs) expect(u.effectiveAttack).toBe(arch.baseAttack + (TIERS.C.attack - 100));
  });

  it("a Bloom wave ignores the field entirely (Bloom has no tier)", () => {
    const m = new Mission(missionWith([{ archetypeId: "bloom_crawlmass", count: 2, atTurn: 1, spawnAt: "enemy_deploy", tier: "A" }]));
    const hs = hostilesOf(m);
    expect(hs).toHaveLength(2);
    for (const u of hs) expect(u.tier).toBeUndefined();
  });
});
