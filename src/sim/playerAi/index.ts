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
//   - Ambush / Interdict / Sensor Sweep, and Screen beyond the one narrow
//     case below. All four are real, already-shipped verbs (data/abilities.ts's
//     23 Aug ability-depth pass); Screen picked up its first use this same
//     day (see the use_screen branch further down) but only for the exact
//     clear_bloom situation Maxime named, not as a general "screen whenever
//     useful" heuristic. The other three stay untouched because a wrong
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
//   - Mission-objective awareness (hold a zone, protect an asset) — SUPERSEDED
//     25 Aug 2026. This engine used to have zero idea what the mission's win
//     condition was, only "where are the enemies"; see the "Objective
//     awareness" section further down for what changed and why
//     engine/__tests__/mapsAmaranth.test.ts's hand-built Mission-2 workaround
//     is now redundant (not removed this pass — that's that file's own call,
//     not this one's). Appendix A's three new objective types (Survive N
//     Turns, Contested Landing, Protect Asset) still aren't covered — they
//     don't exist in the engine yet, so there's nothing here to be aware of
//     until they're built (plan doc §4, step 6).
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
// ---- Objective awareness, 25 Aug 2026 (Phase 1/2 of
// claude/Bloom_Wars_Player_AI_Ability_And_Objective_Plan_v1.md — Maxime:
// "plan everything the bot wont be able to finish mission 12-36 if he cant
// use ability at least at kids lvl of success", then "keep the plan in mind
// do what you recommend") ----
//
// New 5th parameter, `context: PlayerAiMissionContext` (types.ts) — a
// narrow, read-only slice of engine/mission.ts's real Mission class, shaped
// to match it structurally so run.ts just passes the live Mission instance
// straight in, no adapter. Turned out narrower than the plan's own original
// sketch: canClearBloom/canRescue-style ability gates didn't actually need
// a Mission reference at all (their other checks — abilities/side/downed/
// actionsRemaining — are already plain fields on `unit`), so
// hasClearableBloomNearby/findAdjacentRescuableNpc/findRescuableNpcOnBoard
// (combat.ts/support.ts) read map/unit state directly. The one thing that
// genuinely can't be inferred from board state alone is which objective
// this mission actually has — confirmed against MISSION_1A, which has
// bloom_mat tiles as plain damage terrain with no clear_bloom objective
// attached at all, so "a Munti stands near bloom_mat" can't by itself mean
// "clear it." That's the one thing `context` carries.
//
// Five new branches, each returning before the normal combat chain ever
// runs (or, for extract_to_exit/hold_zone/seek_rescue, replacing the
// seek_fight fallback specifically — see each branch's own comment for
// exactly where it sits and why):
//   - carryingRescueId set -> beeline for the nearest exit tile, full stop.
//     Combat is engine-refused while carrying (mission.ts's attack() guard)
//     so there's nothing else this decision could usefully do.
//   - adjacent to an uncarried rescuable NPC -> pick them up. Costs 1
//     action, doesn't end the turn (rescueUnit's own contract) — cheap
//     enough to take on sight, ahead of even the "any enemies at all" check.
//   - Munti, objective-gated (mission.objective === "clear_bloom" OR
//     bonusObjective?.kind === "clear_bloom_patch"), not in immediate danger
//     (hpFraction >= RETREAT_HP_FRACTION, same bar this file already uses
//     for critical-repair gating) -> clear bloom_mat in place instead of
//     attacking. Sits between the routine-repair and focus_weak checks —
//     "above focus_weak," per the plan's own table.
//   - the extract_unit objective's own named unit -> path to the nearest
//     exit tile instead of chasing a kill, once nothing better already
//     fired above it (a kill, a repair, a fight actually in range still
//     wins — this only replaces seek_fight, not everything above it).
//   - objective === "hold_zone" -> every unit without a better action
//     converges on (or, once there, simply stops advancing past) the
//     nearest hold-zone tile instead of chasing the weakest enemy across
//     the map — same "above seek_fight" slot.
//   - an uncarried rescuable NPC still exists somewhere on the board (bonus,
//     never the real objective) -> head toward them, lowest priority of the
//     five, and skipped entirely by the extract_unit's own named unit (a
//     bonus never gets to delay the actual objective).
// Kid-level, not optimal, on purpose — see the plan doc's own framing.
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
  COMMANDER_RETREAT_HP_FRACTION,
  needsFrontLineProtection,
  commanderSafePathPrefix,
  lastStep,
  weakestTarget,
  findLethalTargetFrom,
  retreatPath,
  reachableIntoRangePreferringSafety,
  cohesiveMoveToward,
  nearestLivingAlly,
  focusFireTargetInRange,
  regroupPath,
  nearestCoord,
  hasClearableBloomNearby,
} from "./combat";
import { findCriticalRepairTarget, findRoutineRepairTarget, findAdjacentRescuableNpc, findRescuableNpcOnBoard } from "./support";
import type { PlayerAiDecision, PlayerAiLogEntry, PlayerAiMissionContext } from "./types";

export type { PlayerAiDecision, PlayerAiReason, PlayerAiLogEntry, PlayerAiMissionContext } from "./types";

export const playerAiLog: PlayerAiLogEntry[] = [];

export function resetPlayerAiLog(): void {
  playerAiLog.length = 0;
}

function log(entry: PlayerAiLogEntry): void {
  playerAiLog.push(entry);
}

export function decidePlayerAiAction(
  map: MapDefinition,
  unit: BattleUnit,
  allUnits: BattleUnit[],
  turn: number,
  context: PlayerAiMissionContext
): PlayerAiDecision {
  const hpFraction = unit.maxHp > 0 ? unit.currentHp / unit.maxHp : 1;
  // Commander/Munti protection (28 Aug 2026, test-only — see combat.ts's
  // own "Commander protection" section, and its "Extended to the Munti"
  // follow-up, for the root-cause trace this responds to).
  //
  // Switched off entirely on extract_unit missions — found via a real
  // regression, not guessed. First cut exempted only the named extract
  // target from the front-line cap; that wasn't enough, because the OTHER
  // protected unit(s) (an escorting Rourke, say) still slowed down for
  // their own caution, which in turn slowed the squad's ability to clear
  // the way and reach the exit tile in time. Exempting the retreat
  // threshold too still didn't fully recover it — the interaction runs
  // through the whole squad's pacing, not just one unit's own decisions,
  // and isn't worth chasing further tile-by-tile at this hour. Mission
  // 11's own turn limit is razor-thin (a win completes on turn 18, a loss
  // hits the limit on turn 19), and this mission's whole point is racing
  // that clock, not fighting cautiously — extra caution from anyone is
  // actively the wrong instinct here, so the simplest correct fix is to
  // not apply any of it while the objective itself is a race. Every other
  // objective type (including hold_zone, which has its own turn pressure
  // but no single unit racing a personal deadline the way extract_unit's
  // named target does) keeps the full protection below.
  const isExtractMission = context.mission.objective === "extract_unit";
  const frontLineProtected = needsFrontLineProtection(unit) && !isExtractMission;
  // Every self-preservation gate below that reads RETREAT_HP_FRACTION
  // against THIS unit's own hpFraction uses `retreatThreshold` instead, so
  // Rourke and the field Munti specifically fall back sooner than an
  // ordinary pilot would — for every other unit, and for everyone on an
  // extract_unit mission, this is exactly RETREAT_HP_FRACTION, unchanged.
  const retreatThreshold = frontLineProtected ? COMMANDER_RETREAT_HP_FRACTION : RETREAT_HP_FRACTION;

  // Already carrying the rescued NPC — combat is engine-refused while
  // carryingRescueId is set (mission.ts's attack() guard), so the only
  // useful thing this decision can do is close on the nearest exit. Checked
  // before the "any enemies at all" gate below on purpose: a carrier still
  // has somewhere to be even on a board with nothing left alive.
  if (unit.carryingRescueId) {
    const exits = context.map.exitTiles ?? [];
    if (exits.length) {
      const dest = nearestCoord(unit.pos, exits);
      const path = cohesiveMoveToward(map, unit, dest, allUnits);
      log({
        turn,
        unitId: unit.instanceId,
        displayName: unit.displayName,
        hpFraction,
        reason: "rescue_carry",
        destination: path.length > 1 ? lastStep(path) : undefined,
      });
      return { path };
    }
    // No exit tiles on this map (shouldn't happen on a real rescue mission)
    // — fall through rather than stall the unit outright.
  }

  // Adjacent to an uncarried rescuable NPC — pick them up. Cheap enough
  // (1 action, doesn't end the turn — rescueUnit's own contract) to take on
  // sight, ahead of even the enemies check just below: grabbing a downed
  // ally standing right next to you isn't a decision a real player agonizes
  // over.
  const adjacentRescue = findAdjacentRescuableNpc(unit, allUnits);
  if (adjacentRescue) {
    log({
      turn,
      unitId: unit.instanceId,
      displayName: unit.displayName,
      hpFraction,
      reason: "rescue_pickup",
      targetId: adjacentRescue.instanceId,
      targetName: adjacentRescue.displayName,
    });
    return { action: "rescue" };
  }

  const enemies = livingTargets(allUnits, "hostile"); // full awareness — see file header

  // No blanket "no enemies -> nothing to decide" return any more (Phase 2,
  // 25 Aug 2026): a hold_zone/extract_unit/clear_bloom mission still has
  // real work to do after the board's clear of hostiles (holding the zone
  // out, walking the extract target home, finishing the patch) — an empty
  // `enemies` array is safe to pass through every branch below it
  // (findLethalTargetFrom/focusFireTargetInRange both just find nothing;
  // `enemies.some(...)` is false; regroupPath's own exposure check finds
  // nothing to be exposed to), EXCEPT weakestTarget(enemies), which throws
  // on an empty array — that one call (and everything downstream of it,
  // advance_into_range and the final seek_fight fallback) is explicitly
  // gated on `enemies.length > 0` below instead. hold_no_target is now the
  // true last resort at the very end of this function, not an early exit.

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

  // Extract-target survival override (26 Aug 2026 — found via Mission 5
  // "Foraging Party" stress-testing sitting at 0/8, root-caused with a full
  // --ai-log trace, not guessed at: Farsight (Anand, the named extract
  // target) dropped to 10% hp by turn 11 — her only Munti was already a
  // permanent loss by then — and then spent the mission's entire remaining
  // turn limit locked in retreat_low_hp/regroup_low_hp, never once falling
  // through to extract_to_exit again. Both of those branches fire
  // unconditionally once hp drops below RETREAT_HP_FRACTION, with no notion
  // that THIS unit's actual objective is "reach that tile over there," not
  // "stay alive in the abstract" — regroup_low_hp in particular pulled her
  // toward whichever ally was still moving, which on this map's geometry
  // (deploy west, exit east, the enemy wave spawns in between) meant
  // repeatedly walking away from the exit. A single Munti loss shouldn't be
  // able to permanently softlock an extraction this way.
  //
  // Fixed narrowly, reusing the exact "gate self-preservation on spotted"
  // reasoning this file already applies to retreat_low_hp itself (see that
  // block's own Mission 3 comment two blocks below): nobody able to see this
  // unit right now means there's nothing to actually flee FROM, so a
  // critically wounded extract target in that lull should spend the turn
  // making real progress toward the exit instead of wandering toward a
  // squad that may have no healer left either. Deliberately NOT touching the
  // spotted case — mid-firefight, blindly beelining the exit through a live
  // threat at 10% hp is a worse call than falling back, so
  // retreat_low_hp/regroup_low_hp still govern exactly as before whenever
  // something can actually see this unit. This is a real improvement, not a
  // full fix for every extraction — a threat sitting squarely between the
  // target and the exit still forces retreat/regroup while spotted, same as
  // before; see the build log addendum for the honest before/after numbers.
  if (
    context.mission.objective === "extract_unit" &&
    unit.instanceId === context.mission.objectiveParams.extractUnitId &&
    hpFraction < RETREAT_HP_FRACTION &&
    !spotted
  ) {
    const exits = context.map.exitTiles ?? [];
    if (exits.length) {
      // openExits (Mission 23 "The Amaranth Accord," 25 Aug 2026 — see this
      // mission's own build-log tuning note for the full stall this fixes):
      // nearestCoord picks a single geometric target with no regard for
      // whether anything is already standing on it. An ally parked on the
      // literal nearest exit tile (easy to happen — every unit converging
      // from the same direction tends to resolve to the same "nearest"
      // tile) left the extraction target permanently unable to improve its
      // distance to that one blocked coordinate, stalling the WHOLE squad
      // for the rest of the mission, not just this unit. Filtering to
      // unoccupied exit tiles first, falling back to the full set only if
      // every exit tile happens to be occupied, is the narrow fix — it
      // doesn't touch cohesiveMoveToward's own pathing/lead-cap logic.
      const openExits = exits.filter(
        (c) => !allUnits.some((u) => !u.downed && u.instanceId !== unit.instanceId && u.pos.x === c.x && u.pos.y === c.y)
      );
      const dest = nearestCoord(unit.pos, openExits.length ? openExits : exits);
      const path = cohesiveMoveToward(map, unit, dest, allUnits);
      if (path.length > 1) {
        log({
          turn,
          unitId: unit.instanceId,
          displayName: unit.displayName,
          hpFraction,
          reason: "extract_to_exit",
          destination: lastStep(path),
          note: `${Math.round(hpFraction * 100)}% hp, unspotted — running for the exit instead of regrouping`,
        });
        return { path };
      }
    }
  }

  if (hpFraction < retreatThreshold && spotted) {
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
  if (hpFraction < retreatThreshold) {
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

  // Screen (25 Aug 2026, Maxime: "add screen too. its probably why mission 3
  // still fail sometimes"). abil_screen was fully engine-built already
  // (engine/mission.ts's canScreen/screenAllies, wired into engine/ai.ts's
  // isVisibleTo since the 23 Aug ability-depth pass) but the header above
  // still listed it as fully out of scope for this engine, for the same
  // reason Ambush/Interdict/Sensor Sweep still are: Screen is once-per-
  // mission per Munti (canScreen's own usedScreenThisMission gate), and a
  // heuristic that spends a once-per-mission resource at the wrong moment
  // is worse than never using it at all — a real player would have held it
  // for the turn that actually needed it.
  //
  // Deliberately NOT a general "screen whenever it looks dangerous"
  // heuristic — that's real judgment (how dangerous is dangerous enough to
  // spend the only charge this Munti gets?) this engine has no board-reading
  // for, and guessing at it risks the exact "wrong-moment burn" this was
  // just flagged as worse than doing nothing. Scoped instead to the precise
  // situation Maxime named: a Munti standing in a clear_bloom firing
  // line — objective-gated the same way the clear_bloom branch below is,
  // `hasClearableBloomNearby` confirming there's actually a patch here —
  // that a hostile can actually see right now (`spotted`, the exact
  // isVisibleTo check the retreat gate above already computed for this same
  // unit) with the charge still unspent. No HP gate: by the time execution
  // reaches this point, hpFraction < RETREAT_HP_FRACTION with `spotted` true
  // has already returned via retreat_low_hp above, so this only ever sees
  // either a healthy Munti or a cornered one retreat couldn't save — Screen
  // is a good answer to both.
  //
  // Fires ahead of clear_bloom on purpose, not instead of it: screenAllies
  // costs 1 action and does NOT end the turn (its own doc comment, same
  // contract as Repair and Clear Bloom), so run.ts's per-unit action loop
  // naturally chains screen-then-clear in the same turn the way it already
  // chains repair-then-move — the second sub-decision this turn hits
  // usedScreenThisMission=true and falls straight through to clear_bloom
  // below.
  if (
    unit.path === "munti" &&
    unit.abilities.includes("abil_screen") &&
    !unit.usedScreenThisMission &&
    (context.mission.objective === "clear_bloom" || context.mission.bonusObjective?.kind === "clear_bloom_patch") &&
    hasClearableBloomNearby(map, unit.pos) &&
    spotted
  ) {
    log({ turn, unitId: unit.instanceId, displayName: unit.displayName, hpFraction, reason: "use_screen" });
    return { action: "screen" };
  }

  // Munti, objective-gated: the patch is this mission's actual job (or a
  // bonus explicitly built around it), not a discretionary pick — prefer
  // clearing over chip-damaging a target that isn't dying to this attack
  // anyway. Objective-gated on purpose, not "any Munti near any bloom_mat":
  // MISSION_1A (map_city_sweep_01) has bloom_mat tiles as plain damage
  // terrain with no clear_bloom objective attached at all — checked directly
  // against that map before writing this gate, not assumed. hpFraction gate
  // mirrors the critical-repair bar above ("not in immediate danger").
  // "Above focus_weak," per the plan doc's own table — this is the slot.
  // abilities.includes check mirrors canClearBloom's own gate exactly
  // (every real Munti archetype carries abil_clear_bloom today —
  // data/units.ts's own comment: "on all [chassis]" — but checking the
  // ability directly, not just unit.path === "munti", is what keeps this in
  // sync with canClearBloom if that ever stops being true, and avoids
  // burning a wasted sub-decision loop in run.ts if it doesn't).
  if (
    unit.path === "munti" &&
    unit.abilities.includes("abil_clear_bloom") &&
    hpFraction >= RETREAT_HP_FRACTION &&
    (context.mission.objective === "clear_bloom" || context.mission.bonusObjective?.kind === "clear_bloom_patch") &&
    hasClearableBloomNearby(map, unit.pos)
  ) {
    log({ turn, unitId: unit.instanceId, displayName: unit.displayName, hpFraction, reason: "clear_bloom" });
    return { action: "clear_bloom" };
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

  // Nothing in range from here — close on the weakest target, preferring a
  // safe (ranged-kiting-aware) tile. Guarded on enemies.length: weakestTarget
  // throws on an empty array, and there's nothing to close distance on
  // anyway once the board's clear of hostiles — see this function's own
  // "no blanket early return" comment above for why that case now falls
  // through to the objective-awareness branches below instead of stopping
  // here.
  if (enemies.length > 0) {
    const goal = weakestTarget(enemies);
    let pathIntoRange = reachableIntoRangePreferringSafety(map, unit, goal.pos, allUnits);
    // Commander protection (28 Aug 2026, test-only — see combat.ts's own
    // "Commander protection" section for the full trace, including a
    // first attempt that didn't work). Truncate to the longest prefix that
    // doesn't put her ahead of her own front line — she still advances,
    // just never past whichever ally is already most exposed. Gated on
    // frontLineProtected (commander + Munti, minus this mission's own
    // extract target — see that flag's own comment above) so every other
    // unit's already-tuned behaviour here is completely unchanged.
    if (pathIntoRange && frontLineProtected) {
      // A truncated-to-length-1 path (no move) still falls through to the
      // atDest check below exactly like a normal "already here" case —
      // deliberately not nulled out, since she may still have a real shot
      // from wherever the front line currently caps her at.
      pathIntoRange = commanderSafePathPrefix(pathIntoRange, unit, allUnits, enemies);
    }
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
  }

  // Still too far to attack from anywhere reachable this turn. A
  // critically wounded unit already had its shot at regrouping toward the
  // squad above (before offense was even considered) — if that couldn't
  // make progress then, it can't now either (nothing about the board
  // changed in between), so there's no second regroup check here.
  //
  // Nothing better to do combat-wise — this is the "above seek_fight" slot
  // the plan doc's table names for extract_to_exit/hold_zone, and the
  // (lower-priority, bonus-only) slot for seek_rescue. Checked in that
  // order — the real objective, then the bonus — never the other way
  // around.

  // extract_unit's own named target overrides the normal chase: getting
  // them out is the actual mission, not a discretionary pick. Other units
  // on an extract_unit mission are NOT special-cased here — they fall
  // through to normal seek_fight/seek_rescue like any other mission; the
  // plan doc's own "escorts screen the extract target" idea is deliberately
  // NOT built this pass (see that doc's §2 vs. this comment) — squad
  // cohesion (cohesiveMoveToward's own MAX_LEAD_FROM_ALLIES cap) already
  // pulls stragglers toward whichever ally is closest, which in practice
  // includes an extract target who's already moving toward the exit; a
  // bespoke escort heuristic on top of that is more machinery than a
  // kid-level pass needs today.
  if (context.mission.objective === "extract_unit" && unit.instanceId === context.mission.objectiveParams.extractUnitId) {
    const exits = context.map.exitTiles ?? [];
    if (exits.length) {
      // openExits — same fix, same reason as the unspotted/low-hp branch
      // above (see that branch's own comment for the full stall story).
      const openExits = exits.filter(
        (c) => !allUnits.some((u) => !u.downed && u.instanceId !== unit.instanceId && u.pos.x === c.x && u.pos.y === c.y)
      );
      const dest = nearestCoord(unit.pos, openExits.length ? openExits : exits);
      const path = cohesiveMoveToward(map, unit, dest, allUnits);
      log({
        turn,
        unitId: unit.instanceId,
        displayName: unit.displayName,
        hpFraction,
        reason: "extract_to_exit",
        destination: path.length > 1 ? lastStep(path) : undefined,
      });
      return { path };
    }
    // No exit tiles defined — fall through to normal seek_fight rather than stall.
  }

  // hold_zone: every unit without a better action converges on the nearest
  // zone tile instead of chasing the weakest enemy across the map. Once a
  // unit is actually standing on a hold tile this naturally becomes a
  // no-op (nearestCoord picks the tile it's already on, so
  // cohesiveMoveToward returns a length-1 "path") — "prefer not leaving it
  // once there" falls out for free rather than needing its own check.
  if (context.mission.objective === "hold_zone") {
    const hold = context.map.holdZone ?? [];
    if (hold.length) {
      const dest = nearestCoord(unit.pos, hold);
      const path = cohesiveMoveToward(map, unit, dest, allUnits);
      log({
        turn,
        unitId: unit.instanceId,
        displayName: unit.displayName,
        hpFraction,
        reason: "hold_zone",
        destination: path.length > 1 ? lastStep(path) : undefined,
      });
      return { path };
    }
    // No holdZone defined on this map (shouldn't happen on a real hold_zone
    // mission) — fall through to normal seek_fight rather than stall.
  }

  // Bonus objective, never the real one — an uncarried rescuable NPC still
  // out there is worth heading toward once nothing higher in this chain had
  // a better use for the turn, but never ahead of the mission's own
  // objective (the two branches just above already claimed that priority
  // when applicable).
  if (hpFraction >= RETREAT_HP_FRACTION) {
    const npc = findRescuableNpcOnBoard(allUnits);
    if (npc) {
      const path = cohesiveMoveToward(map, unit, npc.pos, allUnits);
      if (path.length > 1) {
        log({
          turn,
          unitId: unit.instanceId,
          displayName: unit.displayName,
          hpFraction,
          reason: "seek_rescue",
          targetId: npc.instanceId,
          targetName: npc.displayName,
          destination: lastStep(path),
        });
        return { path };
      }
      // No progress reachable toward them this turn — fall through to normal seek_fight.
    }
  }

  // Close the distance on the weakest target — cohesion-capped (Maxime, 25
  // Aug 2026 — see combat.ts's own header for the full Mission 1 diagnosis)
  // so a fast unit doesn't sprint alone into a fight the rest of the squad
  // is turns away from reaching. Guarded on enemies.length for the same
  // reason as the advance_into_range block above (weakestTarget throws on
  // an empty array) — recomputed here rather than threading a `goal`
  // variable across the objective-awareness branches in between, since
  // weakestTarget is a cheap reduce over however many enemies are left.
  if (enemies.length > 0) {
    const goal = weakestTarget(enemies);
    let path = cohesiveMoveToward(map, unit, goal.pos, allUnits);
    // Commander protection (28 Aug 2026, test-only — same front-line cap
    // as the advance_into_range branch above; see combat.ts's own
    // "Commander protection" section). cohesiveMoveToward's own leash only
    // ever checks distance-from-allies, not distance-to-the-enemy, so on
    // its own it doesn't stop her ending up the most exposed unit in a
    // formation that's advancing together — this closes that gap the same
    // way, without touching any other unit's behaviour. Same
    // frontLineProtected gate as advance_into_range above.
    if (frontLineProtected) path = commanderSafePathPrefix(path, unit, allUnits, enemies);
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

  // Escort convergence on extract_unit missions (25 Aug 2026 — found via
  // Mission 11 "The Long Walk Back" stress-testing, not guessed at: 0/8
  // wins, every single one a turn-limit timeout with the extract target
  // stalled a few tiles short of the exit for the mission's entire back
  // half; see the build log addendum for the full trace). Root cause: the
  // extract_to_exit branch above only ever moves the NAMED target — every
  // OTHER unit on the mission just falls through the normal combat chain
  // like any other mission, same as this file's own header already
  // documents as the deliberate choice ("a bespoke escort heuristic... felt
  // like more machinery than a kid-level pass needs today"). That was fine
  // on the assumption escorts would always have a fight pulling them
  // roughly toward the target anyway — true until the board clears BEFORE
  // the target reaches the exit, at which point every non-target unit hits
  // hold_no_target and simply stops, forever. cohesiveMoveToward's own
  // MAX_LEAD_FROM_ALLIES cap (combat.ts) then reads those four frozen
  // units as "the squad" and refuses to let the target outpace them — a
  // real deadlock, not a difficulty problem: the mission becomes
  // mechanically unwinnable the moment combat ends early.
  //
  // Fixed the same shape hold_zone already uses above (converge everyone
  // without a better action onto the objective), deliberately placed here
  // — after seek_rescue, not before it — so it changes nothing about
  // already-tested behaviour: a unit with a bonus rescue to chase still
  // chases it first (the real objective already outranks the bonus for the
  // extract TARGET itself; this keeps the same order for everyone else),
  // and this only ever fires once there is truly nothing else, which is
  // exactly the gap that let escorts freeze in the first place.
  if (context.mission.objective === "extract_unit") {
    const exits = context.map.exitTiles ?? [];
    if (exits.length) {
      const dest = nearestCoord(unit.pos, exits);
      const path = cohesiveMoveToward(map, unit, dest, allUnits);
      if (path.length > 1) {
        log({
          turn,
          unitId: unit.instanceId,
          displayName: unit.displayName,
          hpFraction,
          reason: "escort_to_exit",
          destination: lastStep(path),
        });
        return { path };
      }
      // Already as close as cohesion allows (or already there) — fall
      // through to hold_no_target rather than return a no-op decision.
    }
  }

  // Truly nothing left to do: no enemies, nothing to hold/extract/clear/
  // rescue, no ally to help. This is the real "hold_no_target" case now —
  // see this function's own comment where the old blanket early-return used
  // to sit for why it's here instead.
  log({ turn, unitId: unit.instanceId, displayName: unit.displayName, hpFraction, reason: "hold_no_target" });
  return {};
}
