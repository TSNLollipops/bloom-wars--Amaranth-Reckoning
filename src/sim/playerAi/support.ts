// src/sim/playerAi/support.ts
// Repair/support decisions for the Player AI engine — the one gap the old
// sim/testPlayerAi.ts's own header called out as real, deliberately
// unscoped work ("repair/support usage... would be real scope, not 'for
// testing' scope"), and the reason this whole restructure happened (25 Aug
// 2026, Maxime: "make our test ai good enough to run mission 9-36... i
// want it to be able to test the game like a player would"). A Munti that
// never heals produces systematically optimistic-about-difficulty (i.e.
// misleadingly pessimistic-about-survival) balance data for exactly the
// missions that matter most — the whole campaign's deploy gate lives and
// dies on a Munti staying alive (engine/campaignState.ts's
// canLaunchMission / evaluatePermadeathCheck).
//
// Deliberately heal-IN-PLACE only: this does not path a healer toward a
// hurt ally who isn't already adjacent. engine/mission.ts's own
// getRepairableFrom only ever offers adjacent (distance === 1) targets —
// this matches that exactly rather than inventing a "walk to whoever's
// hurt" pathing problem this pass doesn't need to solve. In practice this
// already covers the common case (a fireteam fights clustered, not
// scattered), and the harness's own per-unit action loop (sim/run.ts) means
// a Munti that heals with its first action still gets a second action to
// move or attack, rather than the heal eating the whole turn for nothing.
import type { BattleUnit } from "../../engine/units";
import { chebyshevDistance } from "../../engine/grid";

/** Below this HP fraction, an adjacent ally is worth interrupting anything else for — even this unit's own retreat-on-low-HP instinct (index.ts checks this ahead of that). */
export const CRITICAL_ALLY_HP_FRACTION = 0.4;
/** Below this HP fraction (but not critical), an adjacent ally is worth healing instead of chip-damaging a target that isn't dying to this attack anyway. */
export const ROUTINE_ALLY_HP_FRACTION = 0.85;

function worstAdjacentAlly(unit: BattleUnit, allUnits: BattleUnit[], belowFraction: number): BattleUnit | undefined {
  if (!unit.abilities.includes("abil_repair")) return undefined;
  const candidates = allUnits.filter(
    (t) =>
      !t.downed &&
      t.side === unit.side &&
      t.instanceId !== unit.instanceId &&
      t.maxHp > 0 &&
      t.currentHp / t.maxHp < belowFraction &&
      chebyshevDistance(unit.pos, t.pos) === 1
  );
  if (!candidates.length) return undefined;
  return candidates.reduce((worst, t) => (t.currentHp / t.maxHp < worst.currentHp / worst.maxHp ? t : worst));
}

/** A same-side ally adjacent to `unit`, hurt badly enough to be a priority — or undefined if `unit` can't repair or nobody adjacent qualifies. */
export function findCriticalRepairTarget(unit: BattleUnit, allUnits: BattleUnit[]): BattleUnit | undefined {
  return worstAdjacentAlly(unit, allUnits, CRITICAL_ALLY_HP_FRACTION);
}

/** Same as above at the lower-priority "top someone up" threshold — only meaningful once a kill and a critical repair have both already been ruled out. */
export function findRoutineRepairTarget(unit: BattleUnit, allUnits: BattleUnit[]): BattleUnit | undefined {
  return worstAdjacentAlly(unit, allUnits, ROUTINE_ALLY_HP_FRACTION);
}
