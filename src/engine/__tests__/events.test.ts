// Build Brief §4.1 "Event evaluator" suite: Mission 1a's collapse fires on
// turn 4 if the player avoids the rubble, and on entry if they don't — and
// never twice, because the two events share a guardGroup.
import { describe, it, expect } from "vitest";
import { createEventRuntimeState, evaluateTurnStart, evaluateZoneEntered } from "../events";
import { MISSION_1A, MISSION_3 } from "../../data/campaign";

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
