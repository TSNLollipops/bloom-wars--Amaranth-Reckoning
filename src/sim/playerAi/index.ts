// src/sim/playerAi/index.ts
// The Player AI engine — a test-only stand-in for a human player, used by
// src/sim/run.ts to autoplay the player side in headless balance runs.
// This is NOT part of the real hostile-AI tiers in engine/ai.ts and is
// never imported by mission.ts or Battle.ts — it exists purely so
// mission-balance numbers from the sim harness mean something closer to
// "how a careful human would do" instead of "how long a reflexive bot
// stalls."
//
// ---- Restructure, 25 Aug 2026 (Maxime: "make our test ai good enough to
// run mission 9-36... i want it to be able to test the game like a player
// would. make it a separate engine we can plug into our future games. its
// something we can reuse like the characterisation formula.") ----
//
// Moved out of the single flat src/sim/testPlayerAi.ts into this directory
// for two reasons. First, the concrete one: the original file's own header
// listed real, deliberately-unscoped gaps — no repair/support usage, no
// ability usage — and Act I's back half plus all of Acts II-III (missions
// 9-36, `claude/Bloom_Wars_Independent_Campaign_The_Amaranth_Reckoning.md`)
// lean on both harder than the first eight missions did. Repair usage
// (support.ts) is what actually landed this pass — see that file's own
// header for why it's the one gap worth closing right now. Second, the
// structural one Maxime asked for directly: treat this as a distinct,
// nameable system — decision logic (this file), targeting/threat math
// (combat.ts), support logic (support.ts), and the shared decision/log
// shape (types.ts) — the same way the NPC Reaction Engine formula
// (`claude/Bloom_Wars_NPC_Reaction_Engine_v1.md`) is being kept as its own
// documented, reusable thing rather than a subsection of something else.
//
// HONEST LIMIT on "reusable" (flagged rather than silently overclaimed):
// this is reusable in the sense that matters today — a clean, documented,
// self-contained module with one real entry point (decidePlayerAiAction),
// easy to lift wholesale into a future project and adapt. It is NOT
// engine-agnostic — every function here still imports Bloom Wars' own
// BattleUnit/MapDefinition/Coord types and engine/ai.ts's damage math
// directly, on purpose: building a generic adapter interface (a
// game-agnostic "unit"/"map"/"decide" contract) with no second game to
// design it against would mean guessing at an abstraction with nothing
// real to validate it, which is a good way to build the WRONG one. Porting
// this later means copying this directory and swapping the handful of
// engine/ai.ts imports for whatever the next game's equivalent is — a
// translation exercise, not a rewrite of the decision logic itself. If a
// second game actually materializes, that's the moment to design the real
// adapter layer, with a concrete second case to check it against.
//
// STILL explicitly out of scope this pass (same reasoning as before, now
// re-confirmed against 9-36 specifically rather than just restated):
//   - Ambush / Interdict / Screen / Sensor Sweep. All four are real,
//     already-shipped verbs (data/abilities.ts's 23 Aug ability-depth
//     pass) this engine still never uses. Not added here because a wrong
//     heuristic for any of them is worse than the current honest zero —
//     Sensor Sweep and Screen are charge-limited per mission
//     (SENSOR_SWEEP_CHARGES_PER_MISSION, once-per-mission-per-Munti), so a
//     heuristic that spends them at the wrong moment actively burns a
//     resource a real player would have held, which is a worse balance
//     signal than never using it at all. Ambush/Interdict both cost a
//     unit's entire remaining action budget for a positional bet (conceal;
//     hold a chokepoint) that needs real read-the-board judgment this
//     engine's flat move+range heuristics don't have. Worth a real pass
//     once we're building the missions that most exercise them.
//   - The Heirloom (abil_severance / Requiem). Not just deferred — there
//     is no engine hook to defer TO yet. engine/mission.ts has no
//     useSeverance()-shaped method; SEVERANCE (data/abilities.ts) is still
//     pure data. Requiem doesn't unlock until Mission 12 anyway (squad-
//     scaling table, Independent Campaign doc §10), so this isn't blocking
//     anything today.
//   - Any multi-turn planning (Bloom-collapse sequencing, baiting,
//     focus-fire coordination across units within one turn) or
//     terrain-aware threat beyond a flat move+range radius.
//   - Mission-objective awareness (hold a zone, protect an asset). This
//     engine still doesn't know what the mission's win condition IS, only
//     "where are the enemies" — engine/__tests__/mapsAmaranth.test.ts's own
//     header already documents the one place that gap was worth working
//     around by hand (Mission 2's hold_zone). Appendix A's three new
//     objective types (Survive N Turns, Contested Landing, Protect Asset)
//     will make this gap matter more, not less — flagged for a future pass
//     once those missions are actually being built, not guessed at now.
//
// Every decision is logged to `playerAiLog` — reused for exactly the
// reason the original file's header gave: "a starting point if any of this
// gets reused for multiplayer-map bot opponents later." Call
// `resetPlayerAiLog()` before a run; read `playerAiLog` after.
import type { MapDefinition } from "../../data/types";
import type { BattleUnit } from "../../engine/units";
import { livingTargets, bestAttackTargetInRange, moveToward, isVisibleTo } from "../../engine/ai";
import { RETREAT_HP_FRACTION, lastStep, weakestTarget, findLethalTargetFrom, retreatPath, reachableIntoRangePreferringSafety } from "./combat";
import { findCriticalRepairTarget, findRoutineRepairTarget } from "./support";
import type { PlayerAiDecision, PlayerAiLogEntry } from "./types";

export type { PlayerAiDecision, PlayerAiReason, PlayerAiLogEntry } from "./types";

export const playerAiLog: PlayerAiLogEntry[] = [];

export function resetPlayerAiLog(): void {
  playerAiLog.length = 0;
}

function log(entry: PlayerAiLogEntry): void {
  playerAiLog.push(entry);
}

export function decidePlayerAiAction(map: MapDefinition, unit: BattleUnit, allUnits: BattleUnit[], turn: number): PlayerAiDecision {
  const enemies = livingTargets(allUnits, "hostile"); // full awareness — see file header
  const hpFraction = unit.maxHp > 0 ? unit.currentHp / unit.maxHp : 1;

  if (!enemies.length) {
    log({ turn, unitId: unit.instanceId, displayName: unit.displayName, hpFraction, reason: "hold_no_target" });
    return {};
  }

  // Guaranteed kill in place beats everything, even at low HP or next to a
  // dying ally — unchanged priority from before this pass.
  const killNow = findLethalTargetFrom(map, unit, unit.pos, enemies, allUnits);
  if (killNow) {
    log({
      turn,
      unitId: unit.instanceId,
      displayName: unit.displayName,
      hpFraction,
      reason: "kill",
      targetId: killNow.instanceId,
      targetName: killNow.displayName,
    });
    return { attackTargetId: killNow.instanceId };
  }

  // No kill on the table — a critically hurt ally standing next to a
  // healer outranks even that healer's own self-preservation retreat
  // (support.ts's CRITICAL_ALLY_HP_FRACTION), as long as the healer itself
  // isn't ALSO in retreat territory (then self-preservation still governs,
  // same as before this pass — see the retreat check just below).
  if (hpFraction >= RETREAT_HP_FRACTION) {
    const critical = findCriticalRepairTarget(unit, allUnits);
    if (critical) {
      log({
        turn,
        unitId: unit.instanceId,
        displayName: unit.displayName,
        hpFraction,
        reason: "repair_critical_ally",
        targetId: critical.instanceId,
        targetName: critical.displayName,
        note: `${Math.round((critical.currentHp / critical.maxHp) * 100)}% hp`,
      });
      return { repairTargetId: critical.instanceId };
    }
  }

  // Low HP, no kill on the table this turn — fall back if there's somewhere
  // safer, but ONLY if something can actually see this unit right now.
  //
  // Mission 3 sim-stalemate fix (Maxime, 22 Aug 2026): the last survivor of
  // a wiped squad, badly wounded and nowhere near the remaining hostile
  // cluster, would retreat every OTHER turn regardless of whether anything
  // was anywhere near it — retreatPath only asks "is there a reachable
  // tile strictly farther than where I am now," which a unit standing in
  // open, empty space always satisfies. The turn in between, with retreat
  // exhausted (or, cornered, immediately after), it fell through into the
  // normal engage logic and advanced toward the fight — then retreated the
  // full distance right back the next turn since hpFraction never changes
  // on its own. Two fixed points, zero net progress, forever — confirmed
  // via a debug instrumentation run: the sole survivor sat at one map
  // corner while an entire untouched hostile cluster sat frozen at the
  // other, both sides further apart than anyone's vision stat, for 400+
  // turns straight.
  //
  // Retreating only makes sense against a threat that can actually see you
  // — decideHostileAction (engine/ai.ts) never acts on a target outside
  // its own vision (reflexiveDecision: "nothing in sensor range — hold
  // position"), so a hostile with no line of sight cannot chase or punish
  // you regardless of raw distance. Gating on isVisibleTo (imported from
  // engine/ai.ts, the exact same check the real hostile AI itself uses,
  // not a separate geometric approximation) means: nobody can currently
  // see me, so there is nothing to retreat FROM — skip straight to closing
  // the distance instead of pointlessly running from empty space. The
  // moment a hostile genuinely spots this unit, the gate opens and retreat
  // behaves exactly as before.
  const spotted = enemies.some((e) => isVisibleTo(e, unit));
  if (hpFraction < RETREAT_HP_FRACTION && spotted) {
    const path = retreatPath(map, unit, enemies, allUnits);
    if (path && path.length > 1) {
      log({
        turn,
        unitId: unit.instanceId,
        displayName: unit.displayName,
        hpFraction,
        reason: "retreat_low_hp",
        destination: lastStep(path),
        note: `${Math.round(hpFraction * 100)}% hp, no kill available`,
      });
      return { path };
    }
    log({
      turn,
      unitId: unit.instanceId,
      displayName: unit.displayName,
      hpFraction,
      reason: "hold_cornered",
      note: `${Math.round(hpFraction * 100)}% hp, nowhere safer reachable — fighting anyway`,
    });
    // fall through — no safe retreat, so fight from here same as normal
  }

  // Still no kill, and no critical repair fired — a routine top-up beats
  // chip-damaging a target that isn't dying to this attack anyway. Lower
  // priority than the critical check above on purpose: this only matters
  // once retreat/hold_cornered has already had its say for THIS unit.
  const routine = findRoutineRepairTarget(unit, allUnits);
  if (routine) {
    log({
      turn,
      unitId: unit.instanceId,
      displayName: unit.displayName,
      hpFraction,
      reason: "repair_ally",
      targetId: routine.instanceId,
      targetName: routine.displayName,
      note: `${Math.round((routine.currentHp / routine.maxHp) * 100)}% hp`,
    });
    return { repairTargetId: routine.instanceId };
  }

  // No kill, no repair in place — attack the weakest reachable target instead (focus fire).
  const inPlace = bestAttackTargetInRange(map, unit, unit.pos, [weakestTarget(enemies), ...enemies], allUnits);
  if (inPlace) {
    log({
      turn,
      unitId: unit.instanceId,
      displayName: unit.displayName,
      hpFraction,
      reason: "focus_weak",
      targetId: inPlace.instanceId,
      targetName: inPlace.displayName,
    });
    return { attackTargetId: inPlace.instanceId };
  }

  // Nothing in range from here — close on the weakest target, preferring a safe (ranged-kiting-aware) tile.
  const goal = weakestTarget(enemies);
  const pathIntoRange = reachableIntoRangePreferringSafety(map, unit, goal.pos, allUnits);
  if (pathIntoRange) {
    const dest = lastStep(pathIntoRange);
    const atDest = findLethalTargetFrom(map, unit, dest, enemies, allUnits) ?? bestAttackTargetInRange(map, unit, dest, enemies, allUnits);
    log({
      turn,
      unitId: unit.instanceId,
      displayName: unit.displayName,
      hpFraction,
      reason: "advance_into_range",
      targetId: atDest?.instanceId,
      targetName: atDest?.displayName,
      destination: dest,
    });
    return { path: pathIntoRange, attackTargetId: atDest?.instanceId };
  }

  // Still too far — just close the distance.
  const path = moveToward(map, unit, goal.pos, allUnits);
  log({
    turn,
    unitId: unit.instanceId,
    displayName: unit.displayName,
    hpFraction,
    reason: "seek_fight",
    targetId: goal.instanceId,
    targetName: goal.displayName,
    destination: path.length > 1 ? lastStep(path) : undefined,
  });
  return { path };
}
