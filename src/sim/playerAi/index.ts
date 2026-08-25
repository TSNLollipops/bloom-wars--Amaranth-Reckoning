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
// ---- Squad cohesion + regroup fix, same day (cont'd) ----
// Maxime playtested and called it: "wierd mission 1 is easy" — Mission 1
// (6 Crawlmass vs. a 5-unit squad) was losing in sim, and it shouldn't be
// close. Root-caused against the actual turn log rather than guessed at:
// two distinct bugs, both pre-existing (confirmed against the pre-restructure
// AI via git history, same result either way — this pass didn't introduce
// either one). See combat.ts's own header for the full Mission-1 evidence.
// (1) seek_fight had no concept of the squad at all — a fast unit (Meeps,
// move 6) would sprint alone toward the nearest enemy while a slow one
// (Tank, move 3) fell three-plus tiles behind, so the squad fought as two
// separate, isolated clusters from turn 2 onward and Lask (the only unit
// that can heal) never once ended up adjacent to a hurt ally the whole
// mission. Fixed with cohesiveMoveToward (combat.ts): seek_fight now caps
// how far a unit will advance ahead of its nearest living ally. (2) a
// wounded, unspotted unit with nothing to kill or heal fell straight
// through to normal chase logic, which walked it right back into the
// enemy's sight the very next turn — Rourke's actual sim coordinates
// ping-ponged between two tiles for five turns straight doing nothing
// while her squad died around her. Fixed by having that specific case
// (low HP, no kill/repair available) close on the nearest living ally
// instead of the enemy — see the `regroup_low_hp` branch below.
//
// ---- Terrain, cover, focus fire, same day (cont'd) ----
// Maxime: "can you teach the ai to traverse terrain, use cover, focus
// fire, bait?" Three of four landed this pass — see combat.ts's own
// header (terrain/cover) and its focus-fire section for the full
// reasoning. Short version: cover was a real gap, not a new mechanic —
// data/tiles.ts's defenceStars already gives every attack a genuine
// 10%-per-star damage reduction, the positioning code just never asked
// which reachable tile was actually defensible. Folded into
// retreatPath/reachableIntoRangePreferringSafety (combat.ts) as a scoring
// nudge, not a hard override — a genuinely better tactical position (a
// safer retreat, a better kiting range) still wins; cover only breaks
// ties. Focus fire replaces bestAttackTargetInRange (engine/ai.ts's
// attacker-relative "who do I hit hardest," the correct answer for the
// real hostile AI it's shared with) with focusFireTargetInRange
// (combat.ts) — the squad's shared, attacker-INDEPENDENT priority target,
// so different units asking "who do I shoot" in the same turn actually
// converge on finishing the same enemy instead of splitting damage across
// two half-dead ones.
//
// Bait is NOT this pass. Flagged rather than attempted: everything above
// is a reactive heuristic (score the tiles/targets I can already see);
// bait is fundamentally a different kind of thing — deliberately
// exposing a unit and predicting how the hostile AI will respond to it,
// which means actually running decideHostileAction (engine/ai.ts) against
// hypothetical player positions before committing to one, not just
// scoring the position itself. It also has a real prerequisite this
// engine doesn't have yet: overwatch usage. A bait unit's whole point is
// usually "step out far enough that something takes the bait, while an
// ally is already braced to punish it" — and this engine has never once
// called enterOverwatch. Worth doing right, not worth guessing at in the
// same pass as three lower-risk, already-well-understood fixes — see the
// build log addendum for the actual ask back to Maxime on this.
//
// Every decision is logged to `playerAiLog` — reused for exactly the
// reason the original file's header gave: "a starting point if any of this
// gets reused for multiplayer-map bot opponents later." Call
// `resetPlayerAiLog()` before a run; read `playerAiLog` after.
import type { MapDefinition } from "../../data/types";
import type { BattleUnit } from "../../engine/units";
import { livingTargets, isVisibleTo } from "../../engine/ai";
import {
  RETREAT_HP_FRACTION,
  lastStep,
  weakestTarget,
  findLethalTargetFrom,
  retreatPath,
  reachableIntoRangePreferringSafety,
  cohesiveMoveToward,
  nearestLivingAlly,
  focusFireTargetInRange,
  regroupPath,
} from "./combat";
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

  // Critically wounded, no kill on the table — regroup toward the squad's
  // healer BEFORE considering any further offense, not after (Maxime, 25
  // Aug 2026 — same "wierd mission 1 is easy" thread, found by a stress-test
  // log that outlasted the fix above). This used to sit much lower in the
  // priority order, only reached once focus_weak/advance_into_range both
  // came up empty — which sounds safe, but "empty" meant "literally zero
  // damage possible," and it turns out that's a much narrower bar than
  // "worth doing." resolveAttackOnBloom (engine/combat.ts) scales an
  // attacker's own damage by ITS OWN currentHp/maxHp fraction (a flagged,
  // not-fully-validated placeholder formula, but it's what's live) — so a
  // unit at 4% hp still finds a real, positive-damage target almost every
  // turn, just for a few points at a time. Confirmed against a captured
  // 290-turn WIN (Mission 1): Farsight sat at 4% hp from turn ~13 onward,
  // unspotted the entire time (so retreat_low_hp above never even fired),
  // and focus_weak kept finding SOME crawlmass she could tickle for a
  // handful of damage every single turn — 273 of 340 total decisions that
  // run — because the old priority order only ever asked "can I hurt
  // anything," never "is this worth doing given how close to dead I am."
  // No real player grinds out 3-damage pokes at 4% hp when nothing is
  // chasing them; they fall back to the medic. Guaranteed kills are
  // already exempted (the killNow check at the top of this function is
  // unconditional and always wins regardless of hp) — this only affects
  // marginal, non-lethal offense. Same regroupPath (combat.ts) and same
  // "only take real progress" guard as before — a unit that can't get any
  // closer to its squad falls straight through to the normal combat chain
  // below, so this can't stall a lone survivor with nowhere left to go.
  if (hpFraction < RETREAT_HP_FRACTION) {
    const ally = nearestLivingAlly(unit, allUnits);
    const pathToSquad = ally ? regroupPath(map, unit, ally, enemies, allUnits, turn) : null;
    if (pathToSquad && pathToSquad.length > 1) {
      log({
        turn,
        unitId: unit.instanceId,
        displayName: unit.displayName,
        hpFraction,
        reason: "regroup_low_hp",
        targetId: ally!.instanceId,
        targetName: ally!.displayName,
        destination: lastStep(pathToSquad),
        note: `${Math.round(hpFraction * 100)}% hp, prioritizing the squad over marginal offense`,
      });
      return { path: pathToSquad };
    }
    // No living ally, or already as close to one as this turn can get —
    // nothing better to do than fall through to the normal chain below.
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

  // No kill, no repair in place — attack the squad's shared priority target
  // instead (focusFireTargetInRange, not bestAttackTargetInRange — see
  // combat.ts's own header for why this unit's own "who do I hit hardest"
  // isn't the right question for a coordinated squad).
  const inPlace = focusFireTargetInRange(map, unit, unit.pos, enemies, allUnits);
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
    const atDest = findLethalTargetFrom(map, unit, dest, enemies, allUnits) ?? focusFireTargetInRange(map, unit, dest, enemies, allUnits);
    // Only commit to this branch if it's actually worth something — a real
    // move (path.length > 1) or a target worth shooting once there. A
    // reachable-into-range tile that turns out to just be "stay exactly
    // where I already am, and there's nothing here worth shooting" (the
    // damageable-only filter in focusFireTargetInRange can now correctly
    // say so — see that function's own header) used to still return here
    // and short-circuit the whole decision, permanently pre-empting the
    // low-hp regroup fallback below every single turn. Found via the same
    // 500-turn ONGOING run as that filter itself.
    if (pathIntoRange.length > 1 || atDest) {
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
    // Already here, and nothing here is worth attacking — fall through
    // instead of returning a no-op decision.
  }

  // Still too far to attack from anywhere reachable this turn. A
  // critically wounded unit already had its shot at regrouping toward the
  // squad above (before offense was even considered) — if that couldn't
  // make progress then, it can't now either (nothing about the board
  // changed in between), so there's no second regroup check here. Just the
  // same cohesion-capped chase everyone else falls through to.

  // Close the distance on the weakest target — cohesion-capped (Maxime, 25
  // Aug 2026 — see combat.ts's own header for the full Mission 1 diagnosis)
  // so a fast unit doesn't sprint alone into a fight the rest of the squad
  // is turns away from reaching.
  const path = cohesiveMoveToward(map, unit, goal.pos, allUnits);
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
