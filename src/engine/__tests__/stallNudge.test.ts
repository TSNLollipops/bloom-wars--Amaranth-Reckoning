// Stalled-eliminate_all nudge (27 Aug 2026, Campaign Playtest Review —
// "I ran one mission (Mission 1) passively for 26 turns with nothing
// happening... eliminate_all apparently has no proactive 'hunt the player'
// behavior once contact breaks and no turn-limit fail state either...
// [it] means a stalled eliminate_all mission can go on forever with the
// game giving you no signal that you're stuck. Might be worth a soft
// nudge at some point, even just flavor text."). See mission.ts's
// turnsWithoutContact field for the full reasoning.
import { describe, it, expect } from "vitest";
import { Mission, STALL_NUDGE_TURN_THRESHOLD } from "../mission";
import { AMARANTH_MISSION_1, AMARANTH_MISSION_2 } from "../../data/campaignAmaranth";
import { MAX_ACTIONS_PER_TURN } from "../../data/combatTables";

const NUDGE_TEXT = "Command: no contact reported in some time — sweep wider, the Bloom doesn't always come to you.";

/** Drags every hostile unit to whichever map corner is farthest from the current player cluster — same "nothing in sensor range" shape Mission 27's own real bug (Build Log) already proved keeps reflexive-tier Bloom from ever engaging, just deliberately invoked here instead of hit by accident. */
function scatterHostilesFar(mission: Mission) {
  const players = mission.units.filter((u) => u.side === "player");
  const maxX = Math.max(...players.map((u) => u.pos.x));
  const maxY = Math.max(...players.map((u) => u.pos.y));
  const far = { x: maxX > mission.map.width / 2 ? 0 : mission.map.width - 1, y: maxY > mission.map.height / 2 ? 0 : mission.map.height - 1 };
  for (const h of mission.units.filter((u) => u.side === "hostile")) h.pos = { ...far };
}

describe("Mission — stalled eliminate_all nudge", () => {
  it("fires exactly once, on the threshold turn, when nothing engages", () => {
    const mission = new Mission(AMARANTH_MISSION_1);
    expect(mission.mission.objective).toBe("eliminate_all"); // control — this is the one objective the nudge applies to
    scatterHostilesFar(mission);

    for (let t = 0; t < STALL_NUDGE_TURN_THRESHOLD - 1; t++) {
      mission.endPlayerTurn();
      expect(mission.log).not.toContain(NUDGE_TEXT);
    }
    mission.endPlayerTurn(); // the threshold-th cycle
    expect(mission.log).toContain(NUDGE_TEXT);
    expect(mission.log.filter((l) => l === NUDGE_TEXT)).toHaveLength(1);

    // Keeps not re-firing on every subsequent quiet turn — a one-time nudge,
    // not a recurring nag.
    for (let t = 0; t < 5; t++) mission.endPlayerTurn();
    expect(mission.log.filter((l) => l === NUDGE_TEXT)).toHaveLength(1);
  });

  it("a real attack resets the counter, delaying the nudge", () => {
    const mission = new Mission(AMARANTH_MISSION_1);
    scatterHostilesFar(mission);

    for (let t = 0; t < STALL_NUDGE_TURN_THRESHOLD - 2; t++) mission.endPlayerTurn();
    expect(mission.log).not.toContain(NUDGE_TEXT);

    // A real, resolving attack right before the threshold would have hit —
    // same public attack() path any player shot uses. Picks a melee-range
    // (attackRange[0] === 1) player unit specifically, so a fixed 1-tile
    // offset is guaranteed in range regardless of archetype; moves the
    // target to the attacker, not the other way around, since the attacker
    // may be sitting flush against the map edge (scatterHostilesFar's own
    // corner) and target.pos + 1 tile could land off the grid.
    const attacker = mission.units.find((u) => u.side === "player" && u.attackRange[0] === 1)!;
    const target = mission.units.find((u) => u.side === "hostile")!;
    expect(attacker).toBeDefined(); // control — Muster's roster has at least one melee-range unit
    const dx = attacker.pos.x + 1 < mission.map.width ? 1 : -1; // stay on-grid even if deploy happened to sit on the right edge
    target.pos = { x: attacker.pos.x + dx, y: attacker.pos.y };
    attacker.actionsRemaining = MAX_ACTIONS_PER_TURN;
    mission.attack(attacker.instanceId, target.instanceId);

    // Scatter again — the attack above pulled a hostile into range on
    // purpose to prove the reset, but it should go back to no-contact
    // afterward rather than the AI now finding this hostile every turn.
    scatterHostilesFar(mission);

    for (let t = 0; t < STALL_NUDGE_TURN_THRESHOLD - 1; t++) {
      mission.endPlayerTurn();
      expect(mission.log).not.toContain(NUDGE_TEXT); // still short of a fresh threshold-turns-since-contact
    }
    mission.endPlayerTurn();
    expect(mission.log).toContain(NUDGE_TEXT);
  });

  it("never fires on an objective other than eliminate_all", () => {
    // AMARANTH_MISSION_2 is hold_zone (Antfarm/Social Sim Roadmap docs both
    // reference it as such) — a different objective shape entirely, and
    // one the nudge is deliberately scoped away from since hold_zone
    // missions already converge/resolve on their own clock.
    const holdZoneMission = new Mission(AMARANTH_MISSION_2);
    expect(holdZoneMission.mission.objective).not.toBe("eliminate_all");
    scatterHostilesFar(holdZoneMission);
    for (let t = 0; t < STALL_NUDGE_TURN_THRESHOLD + 5; t++) holdZoneMission.endPlayerTurn();
    expect(holdZoneMission.log).not.toContain(NUDGE_TEXT);
  });
});
