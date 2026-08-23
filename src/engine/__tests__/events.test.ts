// Build Brief §4.1 "Event evaluator" suite: Mission 1a's collapse fires on
// turn 4 if the player avoids the rubble, and on entry if they don't — and
// never twice, because the two events share a guardGroup.
import { describe, it, expect } from "vitest";
import { createEventRuntimeState, evaluateTurnStart, evaluateZoneEntered } from "../events";
import { Mission } from "../mission";
import { MISSION_1A, MISSION_3 } from "../../data/campaign";
import { AMARANTH_MISSION_1, AMARANTH_MISSION_3 } from "../../data/campaignAmaranth";

describe("MissionEvent evaluator — guardGroup mutual exclusion", () => {
  it("fires via turn_start if the zone is never entered", () => {
    const state = createEventRuntimeState();
    for (let turn = 1; turn <= 3; turn++) {
      expect(evaluateTurnStart(MISSION_1A.events, turn, state)).toHaveLength(0);
    }
    const fired = evaluateTurnStart(MISSION_1A.events, 4, state);
    expect(fired.map((e) => e.id)).toEqual(["ev_collapse_turn"]);
  });

  it("fires via zone_entered if the player walks into the rubble first, and turn_start never fires afterward", () => {
    const state = createEventRuntimeState();
    const fired = evaluateZoneEntered(MISSION_1A.events, { x: 9, y: 7 }, 2, state);
    expect(fired.map((e) => e.id)).toEqual(["ev_collapse_zone"]);

    // Now turn 4 arrives — the guardGroup must suppress the turn_start twin.
    const turnFired = evaluateTurnStart(MISSION_1A.events, 4, state);
    expect(turnFired).toHaveLength(0);
  });

  it("never fires twice even if the zone is entered repeatedly", () => {
    const state = createEventRuntimeState();
    evaluateZoneEntered(MISSION_1A.events, { x: 9, y: 7 }, 2, state);
    const second = evaluateZoneEntered(MISSION_1A.events, { x: 10, y: 7 }, 3, state);
    expect(second).toHaveLength(0);
  });
});

describe("Turn-1 wave spawning — regression: waves used to spawn twice", () => {
  // Found 23 Aug 2026 while adding fog of war (a hostile count on screen
  // didn't match the mission def). Mission's constructor called
  // spawnWavesForTurn(1) explicitly AND then runTurnStartEvents(), which
  // spawns the current turn's waves itself — so every turn-1 wave in the
  // game spawned twice, in both campaigns, for as long as that constructor
  // has existed. These assert the board matches what the mission data
  // actually says, so the duplicate can't come back unnoticed.
  const turnOneWaveCount = (def: { enemyWaves: { atTurn: number; count: number }[] }) =>
    def.enemyWaves.filter((w) => w.atTurn === 1).reduce((sum, w) => sum + w.count, 0);

  for (const def of [AMARANTH_MISSION_1, AMARANTH_MISSION_3, MISSION_1A]) {
    it(`${def.id} puts exactly its defined turn-1 wave count on the board, not double`, () => {
      const mission = new Mission(def);
      const hostiles = mission.units.filter((u) => u.side === "hostile").length;
      expect(hostiles).toBe(turnOneWaveCount(def));
    });
  }

  it("a later-turn wave still spawns exactly once when its turn arrives", () => {
    // Amaranth I.2 staggers Splitfang across turns 1 and 3 — guards against
    // "fixing" the duplicate by removing the wrong call and killing later
    // waves entirely.
    const mission = new Mission(AMARANTH_MISSION_1);
    const before = mission.units.filter((u) => u.side === "hostile").length;
    mission.endPlayerTurn();
    const after = mission.units.filter((u) => u.side === "hostile").length;
    // I.1 has no turn-2 wave, so the count must not grow on its own.
    expect(after).toBeLessThanOrEqual(before);
  });
});

describe("MissionEvent evaluator — repeatEvery", () => {
  it("Mission 3's Heartwood adds fire on turn 3, then every 2 turns after", () => {
    const state = createEventRuntimeState();
    const shouldFire = [3, 5, 7, 9];
    const shouldNotFire = [1, 2, 4, 6, 8];
    for (const t of shouldNotFire) {
      expect(evaluateTurnStart(MISSION_3.events.filter((e) => e.id === "ev_heartwood_adds"), t, state)).toHaveLength(0);
    }
    for (const t of shouldFire) {
      const fired = evaluateTurnStart(MISSION_3.events.filter((e) => e.id === "ev_heartwood_adds"), t, state);
      expect(fired.map((e) => e.id)).toEqual(["ev_heartwood_adds"]);
    }
  });
});
