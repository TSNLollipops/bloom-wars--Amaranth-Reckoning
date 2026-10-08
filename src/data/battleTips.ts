/**
 * First-time battle tips (WePlaytestGames playtest, 30 Sep 2026).
 *
 * The tester's main note: the rules live in How to Play, so a new player has
 * to leave the fight and read pages to learn what "range 1-1" means, why a
 * unit that moved can't attack, how a Munti repairs, and so on. "These first
 * three or four pages could be done in the fight." Each tip below fires ONCE,
 * the first time its situation comes up in any mission (not only Mission 1),
 * and never again unless the player presses RESET TUTORIAL HINTS. The
 * Tutorial hints ON/OFF option turns them all off.
 *
 * Pure data + a pure picker, no Phaser, so the trigger logic is unit-tested.
 * Battle.ts builds a BattleTipContext from its own state every render and
 * shows whatever pickBattleTip() returns. System text only: no character
 * voice lives here. Every rule stated matches the engine as of 30 Sep 2026:
 * 2 actions a turn (combatTables MAX_ACTIONS_PER_TURN), attack ends the turn,
 * Repair 30 HP adjacent (mission.ts REPAIR_BASE_HEAL), Munti regen 8 HP within
 * 2 tiles, 10% less damage per defence star, Bloom endurance overflow does
 * not carry into vitality (combat.ts applyBloomDamage).
 */
import { CLASS_PRIMER, type PathId } from "./classPrimer";

export type BattleTipId =
  | "actions"
  | "moved_can_act"
  | "range"
  | "class_meeps"
  | "class_tank"
  | "class_reeps"
  | "class_munti"
  | "triangle"
  | "repair"
  | "abilities"
  | "cover"
  | "bloom_bars"
  | "reinforcements"
  | "reinforcements_incoming"
  | "overwatch"
  | "interdict"
  | "rescue_spot"
  | "rescue_pickup"
  | "capsule_recover"
  | "capsule_prisoner"
  | "done_units";

export const BATTLE_TIPS: Record<BattleTipId, string> = {
  actions:
    "Every unit gets 2 actions a turn. Moving costs 1. Attacking ends that unit's turn, so move first, then attack. The dots at a unit's top-left are its actions left.",
  moved_can_act:
    "This unit moved and still has 1 action: attack, repair, or move again. Attack now or it just stands there.",
  range:
    "Red enemies are in range right now. Range 1 means adjacent only (melee). Range 2-4 means 2 to 4 tiles away, and it can't hit something right next to it.",
  class_meeps: CLASS_PRIMER.meeps,
  class_tank: CLASS_PRIMER.tank,
  class_reeps: CLASS_PRIMER.reeps,
  class_munti: CLASS_PRIMER.munti,
  triangle:
    "Class triangle: Meeps beat Reeps, Reeps beat Tank, Tank beats Meeps. Hover an enemy while a unit is selected to see the exact damage before you commit.",
  repair:
    "Cyan allies can be repaired. Click one to heal it 30 HP. Costs 1 action and doesn't end the Munti's turn.",
  abilities:
    "The numbered buttons bottom-left are this unit's abilities (keys 1-6). Hover one to read what it does and what it costs.",
  cover:
    "The small dots at a tile's bottom-left are its cover. Each dot means 10% less damage for whoever stands there. Rubble and structures cover well but cost more movement.",
  bloom_bars:
    "Bloom have two bars. Blue is endurance: empty it and the Bloom collapses, and leftover damage is lost. Red is vitality: once collapsed, one hit that big kills it.",
  reinforcements:
    "More hostiles just arrived. Missions bring waves, so don't spend everything on the first group. The left panel tracks the objective.",
  reinforcements_incoming:
    "Red crossed boxes on the board = hostiles arriving there next turn. Get into cover facing them, or set Overwatch so they walk into your fire.",
  overwatch:
    "Nothing in range? OVERWATCH (key 1) skips this unit's turn to take one free shot at the first hostile that moves into its range and sight. Good for covering a door or those red arrival boxes.",
  interdict:
    "This Tank can INTERDICT: it braces and any hostile that ends a move near it loses the rest of its turn. No damage, it just stops them cold. Costs the Tank's whole turn.",
  // Playtest 7 Oct 2026 (Maxime, Mission 5): nothing said the downed pilot
  // is picked up by clicking her. Same gap for ejection capsules. Rules as
  // of that date: rescue and capsule recovery are adjacent, 1 action, the
  // turn continues (mission.ts canRescue / canRecoverCapsule); a carrier
  // can't attack; only a Munti recovers a friendly capsule, anyone takes a
  // prisoner; ransom or recruit is decided at Debrief.
  rescue_spot:
    "The pale dashed circle is a downed pilot. Move a unit next to them, then click them to pick them up.",
  rescue_pickup:
    "Click the downed pilot to pick them up (1 action). Then walk this unit to an exit tile. A unit carrying someone can't attack.",
  capsule_recover:
    "Click the capsule to recover your pilot (1 action). Only a Munti can do this.",
  capsule_prisoner:
    "Click the capsule to take the pilot prisoner (1 action). You decide ransom or recruit after the mission.",
  done_units:
    "A check mark means that unit is done for this turn. Press Space or END TURN when everyone is done. You'll get a warning if someone still has actions.",
};

/** Everything the picker needs, read off Battle.ts's own state. */
export interface BattleTipContext {
  /** True when it's the player phase and nothing is animating or targeting. */
  idle: boolean;
  /** The selected player unit, if any. */
  selected?: { path?: string; actionsRemaining: number; tilesMovedThisTurn: number; hasAbilities: boolean; canOverwatch?: boolean; hasInterdict?: boolean };
  attackableCount: number;
  repairableCount: number;
  /** What the pointer is over on the board (visible things only). */
  hovered?: { kind: "bloom" | "hostile_mech" | "player" | "tile"; defenceStars?: number };
  /** True the render after the living hostile count went UP (a spawn wave), from turn 2 on. */
  reinforcementsJustArrived: boolean;
  /** True while hostiles are scheduled to arrive next turn (Mission.upcomingWaves). */
  reinforcementsIncoming?: boolean;
  /** True when at least one of your units is at 0 actions while others still have some. */
  someUnitsDone: boolean;
  /** True while a downed pilot waiting for rescue is on the board (Mission 5's bonus objective). */
  downedPilotOnBoard?: boolean;
  /** Downed pilots the selected unit can pick up right now (adjacent, action free). */
  rescuableCount?: number;
  /** Friendly capsules the selected unit can recover right now (a Munti, adjacent). */
  recoverableFriendlyCapsules?: number;
  /** Enemy capsules the selected unit can capture right now (anyone, adjacent). */
  capturableEnemyCapsules?: number;
}

/**
 * The next tip to show, or null. Order matters: the more urgent or more
 * basic lesson wins when two are eligible on the same frame. Pure; `seen`
 * is whatever has already fired.
 */
export function pickBattleTip(ctx: BattleTipContext, seen: ReadonlySet<string>): BattleTipId | null {
  if (!ctx.idle) return null;
  const want = (id: BattleTipId, cond: boolean) => cond && !seen.has(id);
  if (want("reinforcements", ctx.reinforcementsJustArrived)) return "reinforcements";
  // Waits for the basics: on Mission 1 a wave lands on turn 2, and this
  // must not be the first thing a brand-new player is told. The red boxes
  // and the COMMS line show regardless; only the explanation waits.
  if (want("reinforcements_incoming", !!ctx.reinforcementsIncoming && seen.has("actions"))) return "reinforcements_incoming";
  const sel = ctx.selected;
  if (sel) {
    // "Click it now" beats every general lesson: the unit is standing next
    // to the thing and the highlight is already on screen.
    if (want("rescue_pickup", (ctx.rescuableCount ?? 0) > 0)) return "rescue_pickup";
    if (want("capsule_recover", (ctx.recoverableFriendlyCapsules ?? 0) > 0)) return "capsule_recover";
    if (want("capsule_prisoner", (ctx.capturableEnemyCapsules ?? 0) > 0)) return "capsule_prisoner";
    if (want("actions", true)) return "actions";
    const classId = sel.path && (["meeps", "tank", "reeps", "munti"] as const).includes(sel.path as PathId) ? (`class_${sel.path}` as BattleTipId) : null;
    if (classId && want(classId, true)) return classId;
    if (want("range", ctx.attackableCount > 0)) return "range";
    if (want("triangle", ctx.attackableCount > 0)) return "triangle";
    if (want("repair", ctx.repairableCount > 0)) return "repair";
    if (want("moved_can_act", sel.tilesMovedThisTurn > 0 && sel.actionsRemaining === 1)) return "moved_can_act";
    if (want("abilities", sel.hasAbilities)) return "abilities";
    if (want("interdict", !!sel.hasInterdict)) return "interdict";
    // Overwatch is on every unit's bar, so it waits for the moment it's the
    // right answer: this unit can still act and has nothing to shoot.
    if (want("overwatch", !!sel.canOverwatch && ctx.attackableCount === 0)) return "overwatch";
  }
  const h = ctx.hovered;
  if (h) {
    if (want("bloom_bars", h.kind === "bloom")) return "bloom_bars";
    if (want("range", h.kind === "bloom" || h.kind === "hostile_mech")) return "range";
    if (want("cover", h.kind === "tile" && (h.defenceStars ?? 0) >= 2)) return "cover";
  }
  // Waits for the basics, like reinforcements_incoming: on a first campaign
  // Mission 5 opens with class tips still unseen, and "there's a pilot
  // down" should not be the first thing said on turn 1 before "actions".
  if (want("rescue_spot", !!ctx.downedPilotOnBoard && seen.has("actions"))) return "rescue_spot";
  if (want("done_units", ctx.someUnitsDone)) return "done_units";
  return null;
}
