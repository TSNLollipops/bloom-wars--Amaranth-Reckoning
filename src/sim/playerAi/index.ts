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
//
// ---- Difficulty tiers, 1 Sep 2026 (claude/Bloom_Wars_Player_AI_Difficulty_
// Tiers_Plan_v1.md; Maxime: "plan a update to playertest ai so it can play
// 3 way. easy, moderate, hard. hard being tactical genius... i know i
// havent made my bit able to use spell and ability yet") ----
//
// Two new trailing parameters: `profile` (profile.ts — the settings sheet
// every former module constant now reads from; MODERATE by default, so a
// call site that never passes one behaves as the pre-tiers bot with
// fog-honest vision and abilities on) and `memory` (types.ts's
// PlayerAiMemory — per-run cooldowns, the seeded rng, and Hard's last-seen
// map). The decision chain below is the same priority order as before with
// the ability branches (abilities.ts) slotted where the plan's §4.1 puts
// them, each gated by profile.useAbilities so a tier can drop any of them.
//
// The one behavior change that applies to every tier but LEGACY: honest
// vision. This engine used to be handed every living hostile regardless of
// fog — it could and did attack burrowed/concealed units no human can
// target. `enemies` is now the set the player side can actually see
// (engine/ai.ts's unitsVisibleToSide, the exact check scenes/Battle.ts
// draws from), and a board with nothing in sight sends the squad toward
// the nearest spawn seam (`explore`) instead of freezing. LEGACY keeps the
// old full awareness so pre-1-Sep batch numbers stay reproducible.
import type { Coord, MapDefinition } from "../../data/types";
import type { BattleUnit } from "../../engine/units";
import { livingTargets, isVisibleTo, unitsVisibleToSide, moveToward } from "../../engine/ai";
import { chebyshevDistance } from "../../engine/grid";
import { AMBUSH_DECLOAK_DAMAGE_MULTIPLIER } from "../../data/combatTables";
import {
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
  nearestDamageableInRange,
  regroupPath,
  nearestCoord,
  hasClearableBloomNearby,
  bloomPatchEdgeTiles,
} from "./combat";
import { findCriticalRepairTarget, findRoutineRepairTarget, findAdjacentRescuableNpc, findRescuableNpcOnBoard } from "./support";
import {
  shouldSensorSweep,
  shouldInterdict,
  shouldOverwatch,
  shouldAmbush,
  shouldScreen,
  shouldTaunt,
  chooseFireSupportTile,
  chooseMissileTile,
  chooseMaserLanceDirection,
  repairMove,
  explorationTarget,
} from "./abilities";
import { MODERATE, type PlayerAiProfile } from "./profile";
import { createPlayerAiMemory, type PlayerAiDecision, type PlayerAiLogEntry, type PlayerAiMissionContext, type PlayerAiMemory, type PlayerAiReason } from "./types";
import { hardTierOverride, threatMapFor, betterFiringTile, threatAwareIntoRange, threatTrimmedPath, bestHoldTile } from "./hard";

export type { PlayerAiDecision, PlayerAiReason, PlayerAiLogEntry, PlayerAiMissionContext, PlayerAiMemory, PlayerAiTier, PlayerAiAction } from "./types";
export { createPlayerAiMemory } from "./types";
export { EASY, MODERATE, HARD, LEGACY, PROFILES, profileForTier, type PlayerAiProfile } from "./profile";

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
  context: PlayerAiMissionContext,
  profile: PlayerAiProfile = MODERATE,
  memory: PlayerAiMemory = createPlayerAiMemory()
): PlayerAiDecision {
  const hpFraction = unit.maxHp > 0 ? unit.currentHp / unit.maxHp : 1;
  const entry = (reason: PlayerAiReason, extra: Partial<PlayerAiLogEntry> = {}): PlayerAiLogEntry => ({
    turn,
    unitId: unit.instanceId,
    displayName: unit.displayName,
    hpFraction,
    reason,
    ...extra,
  });

  // Commander/Munti protection (28 Aug 2026, test-only — see combat.ts's
  // own "Commander protection" section for the root-cause trace). Switched
  // off entirely on extract_unit missions (Mission 11's razor-thin turn
  // limit — extra caution from anyone is actively the wrong instinct while
  // the objective itself is a race; see the 28 Aug trace). Now also gated
  // on profile.protectVips — EASY has none, the way a newcomer has none.
  const isExtractMission = context.mission.objective === "extract_unit";
  // A VIP with no line unit left to stand behind IS the line — the
  // caution that keeps her alive behind a squad only delays the end once
  // the squad is gone (Hard, Mission 1: a lone commander cycling retreat /
  // cloak / overwatch / approach for 480 turns against two Crawlmass).
  const lineUnitsAlive = allUnits.some((u) => !u.downed && u.side === unit.side && u.instanceId !== unit.instanceId && !needsFrontLineProtection(u) && !u.isExtractionTarget);
  // Hard keeps the VIP bar on extract missions too: its protection is
  // threat-aware and doesn't slow the extraction target (hard.ts exempts
  // it outright), and the Mission 10 trace without it was the commander
  // walking into three Splitfangs on turn 3 with a line unit's bar.
  const frontLineProtected = profile.protectVips && needsFrontLineProtection(unit) && (!isExtractMission || profile.threatMap) && lineUnitsAlive;
  // Rescue-pickup avoidance (30 Aug 2026, Mission 5 trace — the commander
  // grabbing the rescue and dying alone while carrying) deliberately drops
  // the extract carve-out: avoiding one always-bad pickup slows nobody.
  const avoidsRescuePickup = profile.protectVips && needsFrontLineProtection(unit);
  const retreatThreshold = frontLineProtected ? profile.commanderRetreatHpFraction : profile.retreatHpFraction;
  // Easy's deliberate mistake: with probability mistakeChance, take the
  // second-best of a ranked list instead of the best. Seeded, so it replays.
  const pick = <T>(ranked: T[]): T | undefined => {
    if (!ranked.length) return undefined;
    if (profile.mistakeChance > 0 && ranked.length > 1 && memory.rng() < profile.mistakeChance) return ranked[1];
    return ranked[0];
  };
  // Squad cohesion (25 Aug 2026 — "wierd mission 1 is easy") — EASY has
  // none: every unit sprints toward its own target, the exact two-clusters
  // failure the cohesion fix closed for everyone else.
  // Hard (hard.ts seam 4): every plain advance is cut back to the last
  // step under the unit's danger bar, with a stalemate breaker.
  // `objectiveTile`: an advance whose whole point is to stand on the
  // target (a hold-zone tile) is NOT trimmed when it gets there — the zone
  // is the mission; the threat-aware part is choosing WHICH zone tile
  // (hard.ts bestHoldTile).
  const advance = (target: Coord, objectiveTile = false): Coord[] => {
    const path = profile.squadCohesion ? cohesiveMoveToward(map, unit, target, allUnits) : moveToward(map, unit, target, allUnits);
    if (!profile.threatMap || !livingTargets(allUnits, "hostile").length) return path;
    // A VIP keeps the trim even then — the zone is for the line to hold
    // (House Amaranth 9 trace: the commander walking into the zone on
    // turn 2 and dying in it on turn 4).
    if (objectiveTile && !frontLineProtected && path.length > 1 && lastStep(path).x === target.x && lastStep(path).y === target.y) return path;
    return threatTrimmedPath(path, map, unit, allUnits, threatMapFor(memory, map, allUnits, turn), profile, frontLineProtected, memory);
  };

  // Already carrying the rescued NPC — combat is engine-refused while
  // carrying, so the only useful thing this decision can do is close on
  // the nearest exit. Checked before anything else on purpose.
  if (unit.carryingRescueId) {
    const exits = context.map.exitTiles ?? [];
    if (exits.length) {
      const dest = nearestCoord(unit.pos, exits);
      const path = advance(dest);
      log(entry("rescue_carry", { destination: path.length > 1 ? lastStep(path) : undefined }));
      return { path };
    }
  }

  // The extraction target on an extract_unit mission runs FIRST and shoots
  // second (1 Sep 2026, Mission 5 trace at every tier: a Reeps extraction
  // target with a target in range spent nine turns trading fire at the
  // wrong end of the map while the turn limit ran out — the attack
  // branches below all outrank the exit move). Move toward the nearest
  // open exit tile, then attack from the destination if something is in
  // range and an action is left. Not threat-trimmed: the limit is the
  // threat.
  if (isExtractMission && unit.isExtractionTarget && !unit.carryingRescueId) {
    const exits = context.map.exitTiles ?? [];
    if (exits.length) {
      const openExits = exits.filter((c) => !allUnits.some((u) => !u.downed && u.instanceId !== unit.instanceId && u.pos.x === c.x && u.pos.y === c.y));
      const dest = nearestCoord(unit.pos, openExits.length ? openExits : exits);
      const path = moveToward(map, unit, dest, allUnits);
      const hostilesAlive = livingTargets(allUnits, "hostile");
      const seen = profile.honestVision ? unitsVisibleToSide("player", allUnits, turn, { sensorArray: context.sensorArrayBuilt ?? false }) : new Set(hostilesAlive.map((h) => h.instanceId));
      const visibleNow = hostilesAlive.filter((e) => seen.has(e.instanceId));
      const from = path.length > 1 ? lastStep(path) : unit.pos;
      const canShoot = path.length > 1 ? unit.actionsRemaining >= 2 : unit.actionsRemaining >= 1;
      const target = canShoot
        ? (findLethalTargetFrom(map, unit, from, visibleNow, allUnits) ?? (profile.focusFire ? focusFireTargetInRange(map, unit, from, visibleNow, allUnits) : nearestDamageableInRange(map, unit, from, visibleNow, allUnits)))
        : undefined;
      if (path.length > 1 || target) {
        log(entry("extract_to_exit", { destination: path.length > 1 ? lastStep(path) : undefined, targetId: target?.instanceId, targetName: target?.displayName, note: "run first, shoot second" }));
        return { path: path.length > 1 ? path : undefined, attackTargetId: target?.instanceId };
      }
    }
  }

  // Adjacent to an uncarried rescuable NPC — pick them up (1 action, turn
  // continues). The commander/Munti never volunteer (Mission 16/5 traces).
  const adjacentRescue = avoidsRescuePickup || !profile.useAbilities.rescue ? undefined : findAdjacentRescuableNpc(unit, allUnits);
  if (adjacentRescue) {
    log(entry("rescue_pickup", { targetId: adjacentRescue.instanceId, targetName: adjacentRescue.displayName }));
    return { action: "rescue" };
  }

  // Ejection capsules (15 Sep 2026). Clicking a friendly capsule is
  // insurance, not a rescue: a win with a Munti still standing brings every
  // capsule home anyway. So the bot pays the action when the insurance is
  // worth it — this Munti is hurt enough to die, the squad is down to its
  // last two, or the shooting is over — and otherwise keeps healing and
  // holding. The first cut recovered on sight and dropped House Amaranth 19
  // (a hold) from 19/20 wins to 9/20: a Munti spending half her turn on a
  // capsule every time one landed next to her, instead of on the line.
  // An enemy capsule is only taken once nothing hostile is left standing
  // (the cleanup window between the last kill and the end of the turn), so
  // the bot never trades a shot it needed for a prisoner. Opportunistic
  // only: nobody walks toward a capsule.
  if (profile.useAbilities.capsule && context.getRecoverableCapsules) {
    const pods = context.getRecoverableCapsules(unit.instanceId);
    const own = pods.find((p) => p.side === "player");
    const shootingOver = livingTargets(allUnits, "hostile").length === 0;
    const squadLeft = allUnits.filter((u) => u.side === "player" && !u.downed && !u.npcIncapacitated && !u.isCivilian).length;
    if (own && (shootingOver || hpFraction < 0.5 || squadLeft <= 2)) {
      log(entry("recover_capsule", { targetId: own.id }));
      return { action: "recover_capsule", capsuleId: own.id };
    }
    const enemy = pods.find((p) => p.side === "hostile");
    if (enemy && shootingOver) {
      log(entry("capture_prisoner", { targetId: enemy.id }));
      return { action: "recover_capsule", capsuleId: enemy.id };
    }
  }

  // ---- What this unit knows about the enemy ----
  const allEnemies = livingTargets(allUnits, "hostile");
  const visibleIds = profile.honestVision ? unitsVisibleToSide("player", allUnits, turn, { sensorArray: context.sensorArrayBuilt ?? false }) : new Set(allEnemies.map((e) => e.instanceId));
  // Hard's last-seen memory: refresh for anything visible, forget the dead.
  if (profile.rememberLastSeen) {
    for (const e of allEnemies) if (visibleIds.has(e.instanceId)) memory.lastSeen.set(e.instanceId, { ...e.pos });
    for (const [id, at] of [...memory.lastSeen.entries()]) {
      if (!allEnemies.some((e) => e.instanceId === id)) memory.lastSeen.delete(id);
      // A remembered spot this unit can see into with nothing there is
      // stale — forget it, or the squad walks to it forever (mission_1a
      // trace: a survivor oscillating between a ghost sighting on his own
      // tile and the spawn seam for 400 turns).
      else if (!visibleIds.has(id) && chebyshevDistance(unit.pos, at) <= unit.vision) memory.lastSeen.delete(id);
    }
  }
  const visibleEnemies = allEnemies.filter((e) => visibleIds.has(e.instanceId));
  // Mission rework pass (8 Sep 2026): escort discipline. On an extract
  // mission every unit but the target used to fight whatever it could see
  // wherever it was — Foraging Party, traced: Anand at the corked gap for
  // six turns while the whole escort chased Crawlmass around the far side
  // of the map, and nobody ever shot the Gallcyst in the gap (0/50). The
  // escort's fight is the fight around the target, the exit, and itself;
  // everything else is noise it walks past. Test-harness code only.
  const escortTarget = isExtractMission && !unit.isExtractionTarget ? allUnits.find((u) => !u.downed && u.side === unit.side && u.isExtractionTarget) : undefined;
  const escortExit = escortTarget && (context.map.exitTiles ?? []).length ? nearestCoord(escortTarget.pos, context.map.exitTiles ?? []) : undefined;
  const escortRelevant = (e: BattleUnit): boolean =>
    !escortTarget || chebyshevDistance(e.pos, escortTarget.pos) <= 5 || chebyshevDistance(e.pos, unit.pos) <= 2 || (!!escortExit && chebyshevDistance(e.pos, escortExit) <= 3);
  const enemies = escortTarget ? visibleEnemies.filter(escortRelevant) : visibleEnemies;
  // "Can something see ME" is computed against every living hostile, not
  // just the ones I can see — a Bloom with longer eyes than mine is exactly
  // the one to retreat from, and this gate is about self-preservation, not
  // targeting information. Same as the bot always did.
  const spotted = allEnemies.some((e) => isVisibleTo(e, unit, turn));
  // A cloaked Meeps' first hit lands at 2x — read the kill check that way.
  const strikeMult = unit.concealed && unit.stealthTurnsRemaining !== undefined && unit.stealthTurnsRemaining > 0 ? AMBUSH_DECLOAK_DAMAGE_MULTIPLIER : 1;

  // Hard tier (hard.ts): the threat map / squad planner may pre-empt the
  // whole chain below with a pre-emptive retreat or a planned position —
  // see that file. Returns null to let the ordinary chain decide.
  if (profile.tier === "hard") {
    const override = hardTierOverride(map, unit, allUnits, allEnemies, enemies, turn, context, profile, memory, frontLineProtected);
    if (override) {
      log(entry(override.reason, override.logExtra));
      return override.decision;
    }
  }

  // Guaranteed kill in place beats everything, even at low HP or next to a
  // dying ally.
  const killNow = findLethalTargetFrom(map, unit, unit.pos, enemies, allUnits, strikeMult);
  if (killNow) {
    log(entry("kill", { targetId: killNow.instanceId, targetName: killNow.displayName }));
    return { attackTargetId: killNow.instanceId };
  }

  // A critically hurt ally in repair range outranks even the healer's own
  // retreat, as long as the healer itself isn't in retreat territory.
  if (hpFraction >= profile.retreatHpFraction && profile.useAbilities.abil_repair) {
    const critical = findCriticalRepairTarget(unit, allUnits, profile.criticalAllyHpFraction);
    if (critical) {
      log(entry("repair_critical_ally", { targetId: critical.instanceId, targetName: critical.displayName, note: `${Math.round((critical.currentHp / critical.maxHp) * 100)}% hp` }));
      return { repairTargetId: critical.instanceId };
    }
  }

  // Taunt (tiers pass) — the trigger the three reverted 30 Aug attempts
  // lacked: it reasons about the taunter's own survival first. See
  // abilities.ts's shouldTaunt. Ahead of the retreat gate, below
  // kill/critical-repair, exactly where the disabled Guard Taunt sat.
  if (shouldTaunt(map, unit, enemies, allUnits, turn, hpFraction, memory, profile, profile.threatMap ? threatMapFor(memory, map, allUnits, turn) : undefined)) {
    memory.lastTauntTurn.set(unit.instanceId, turn);
    log(entry("guard_taunt"));
    return { action: "taunt" };
  }

  // Extract-target survival override (26 Aug 2026, Mission 5 trace): a
  // critically wounded, UNSPOTTED extract target runs for the exit rather
  // than regrouping toward a squad that may have no healer left.
  if (isExtractMission && unit.isExtractionTarget && hpFraction < profile.retreatHpFraction && !spotted) {
    const exits = context.map.exitTiles ?? [];
    if (exits.length) {
      const openExits = exits.filter((c) => !allUnits.some((u) => !u.downed && u.instanceId !== unit.instanceId && u.pos.x === c.x && u.pos.y === c.y));
      const dest = nearestCoord(unit.pos, openExits.length ? openExits : exits);
      const path = advance(dest);
      if (path.length > 1) {
        log(entry("extract_to_exit", { destination: lastStep(path), note: `${Math.round(hpFraction * 100)}% hp, unspotted — running for the exit instead of regrouping` }));
        return { path };
      }
    }
  }

  // Low HP, no kill on the table, something can see me — fall back if
  // there's somewhere safer (Mission 3 stalemate fix: only while spotted).
  // Easy's mistake roll can skip the retreat outright — retreating too late
  // is the newcomer's signature error.
  // The squad-stall commit (driveMission.ts) also suspends this retreat
  // for a line unit: a 2-HP last survivor kiting a Sporethrower that
  // never closes is a game with no ending (mission_2, seed 1007, 500
  // loops of explore / retreat_low_hp).
  const skipRetreat = (profile.mistakeChance > 0 && memory.rng() < profile.mistakeChance) || (memory.commitThisTurn && !frontLineProtected);
  if (hpFraction < retreatThreshold && spotted && !skipRetreat) {
    const path = retreatPath(map, unit, allEnemies, allUnits);
    if (path && path.length > 1) {
      log(entry("retreat_low_hp", { destination: lastStep(path), note: `${Math.round(hpFraction * 100)}% hp, no kill available` }));
      return { path };
    }
    log(entry("hold_cornered", { note: `${Math.round(hpFraction * 100)}% hp, nowhere safer reachable — fighting anyway` }));
  } else if (hpFraction < retreatThreshold && spotted && skipRetreat) {
    log(entry("mistake", { note: "should have retreated" }));
  }

  // Critically wounded, unspotted, no kill — regroup toward the squad
  // before considering marginal offense (25 Aug 2026 trace: the 4%-hp
  // Farsight poking a Crawlmass for 3 damage a turn, 273 decisions running).
  if (hpFraction < retreatThreshold && profile.squadCohesion) {
    const ally = nearestLivingAlly(unit, allUnits);
    const pathToSquad = ally ? regroupPath(map, unit, ally, allEnemies, allUnits, turn) : null;
    if (pathToSquad && pathToSquad.length > 1) {
      log(entry("regroup_low_hp", { targetId: ally!.instanceId, targetName: ally!.displayName, destination: lastStep(pathToSquad), note: `${Math.round(hpFraction * 100)}% hp, prioritizing the squad over marginal offense` }));
      return { path: pathToSquad };
    }
  }

  // Routine top-up beats chip damage on a target that isn't dying anyway.
  if (profile.useAbilities.abil_repair) {
    const routine = findRoutineRepairTarget(unit, allUnits, profile.routineAllyHpFraction);
    if (routine) {
      log(entry("repair_ally", { targetId: routine.instanceId, targetName: routine.displayName, note: `${Math.round((routine.currentHp / routine.maxHp) * 100)}% hp` }));
      return { repairTargetId: routine.instanceId };
    }
  }

  // Sensor Sweep (tiers pass): something the squad can't see is inside
  // sweep reach. Costs 1 action and the turn continues, so the driver
  // re-asks and the unit can still shoot whatever the sweep painted.
  if (shouldSensorSweep(unit, allEnemies, visibleIds, turn, memory, profile)) {
    memory.lastSweepTurn.set(unit.instanceId, turn);
    log(entry("sensor_sweep"));
    return { action: "sensor_sweep" };
  }

  // Fire Support / Missile (tiers pass): a cluster, a boss, or a VIP
  // threat inside one blast is worth more than a single focus shot.
  const fireTile = chooseFireSupportTile(unit, enemies, allUnits, context, turn, memory, profile, map.width, map.height);
  if (fireTile) {
    memory.lastStrikeTurn = turn;
    log(entry("fire_support", { destination: fireTile.tile, note: `${fireTile.hostiles} in the blast` }));
    return { action: "fire_support", targetTile: fireTile.tile };
  }
  const missileTile = chooseMissileTile(unit, enemies, allUnits, profile, map.width, map.height);
  if (missileTile) {
    log(entry("missile", { destination: missileTile.tile, note: `${missileTile.hostiles} in the blast, no friendly` }));
    return { action: "missile", targetTile: missileTile.tile };
  }
  // Maser Lance (5 Sep 2026, the day the ability itself shipped): same
  // "obvious trigger" slot as Missile just above — a Tank with the branch
  // equipped never fired it here before this, the exact gap flagged in
  // Bloom_Wars_Now_And_Next.md right after Maser Lance landed. Mutually
  // exclusive with the missile branch in practice (one unit never has both
  // abilities), so the ordering between them doesn't matter; kept directly
  // below it because they're the same kind of decision.
  const maserLanceDirection = chooseMaserLanceDirection(unit, enemies, allUnits, context, profile);
  if (maserLanceDirection) {
    log(entry("maser_lance", { destination: maserLanceDirection.tile, note: `${maserLanceDirection.hostiles} in the cone, no friendly` }));
    return { action: "maser_lance", targetTile: maserLanceDirection.tile };
  }

  // Screen — the narrow 25 Aug clear-bloom case (a spotted Munti in a
  // clear_bloom firing line with the charge unspent), plus the general
  // "two-plus under the umbrella, two-plus enemies bearing down" trigger.
  const clearBloomObjective = context.mission.objective === "clear_bloom" || context.mission.bonusObjective?.kind === "clear_bloom_patch";
  if (
    profile.useAbilities.abil_screen &&
    unit.path === "munti" &&
    unit.abilities.includes("abil_screen") &&
    !unit.usedScreenThisMission &&
    unit.actionsRemaining > 0 &&
    ((clearBloomObjective && hasClearableBloomNearby(map, unit.pos) && spotted) || shouldScreen(unit, enemies, allUnits, profile))
  ) {
    log(entry("use_screen"));
    return { action: "screen" };
  }

  // Munti, objective-gated: clear the patch that IS the mission.
  if (
    profile.useAbilities.abil_clear_bloom &&
    unit.path === "munti" &&
    unit.abilities.includes("abil_clear_bloom") &&
    hpFraction >= profile.retreatHpFraction &&
    clearBloomObjective &&
    hasClearableBloomNearby(map, unit.pos)
  ) {
    log(entry("clear_bloom"));
    return { action: "clear_bloom" };
  }

  // Munti, objective-gated, nothing to clear from here: walk to the patch.
  // (1 Sep 2026, Mission 3 at every tier: once the last hostile died the
  // Munti stood wherever it was and the run hit the 500-loop cap with the
  // patch untouched — nothing ever moved it toward bloom it couldn't
  // already reach.) Only when nothing is visible to shoot, so the fight
  // still comes first; the destination is a clean tile beside the patch,
  // never a bloom tile itself (turnStartDamage).
  if (profile.useAbilities.abil_clear_bloom && unit.path === "munti" && unit.abilities.includes("abil_clear_bloom") && clearBloomObjective && enemies.length === 0 && !hasClearableBloomNearby(map, unit.pos) && unit.actionsRemaining > 0) {
    const standing = new Set(allUnits.filter((u) => !u.downed && u.instanceId !== unit.instanceId).map((u) => `${u.pos.x},${u.pos.y}`));
    const edge = bloomPatchEdgeTiles(map).filter((c) => !standing.has(`${c.x},${c.y}`));
    if (edge.length) {
      const dest = nearestCoord(unit.pos, edge);
      // Plain moveToward, not the cohesion leash: with nothing in sight
      // the rest of the squad has no reason to move, and a leashed Munti
      // never reaches the patch (the escort branch at the bottom of this
      // chain brings them along instead).
      const path = moveToward(map, unit, dest, allUnits);
      if (path.length > 1) {
        log(entry("clear_bloom", { destination: lastStep(path), note: "walking to the patch" }));
        return { path };
      }
    }
  }

  // Mission rework pass (8 Sep 2026): the hold-zone deadline. The hold_zone
  // objective move further down only runs for a unit with nothing better
  // to do, so in any mission that keeps hostiles in sight through the hold
  // turn the squad fought where it stood, never walked to the ring, and ate
  // "hostiles hold the zone" at the start of holdUntil (The Root Answers
  // Back: 20/20 losses on turn 8 with the whole squad alive at the deploy
  // edge). A human counts backwards from the deadline; so does this now.
  // Once a unit's own walk to the nearest free zone tile would not get it
  // there by the end of holdUntil-1, the walk is the action this turn and
  // the shot (if any) is taken from wherever the walk ends. Test-harness
  // code only — nothing in the game reads this.
  if (context.mission.objective === "hold_zone" && (context.map.holdZone ?? []).length && unit.actionsRemaining > 0) {
    const hold = context.map.holdZone ?? [];
    const onHold = hold.some((c) => c.x === unit.pos.x && c.y === unit.pos.y);
    const holdUntil = context.mission.objectiveParams.holdUntilTurn ?? context.mission.objectiveParams.turnLimit ?? 99;
    // A VIP (commander, last Munti) never takes the walk while anyone else
    // can: the hostile AI focus-fires the commander by design (engine/ai.ts,
    // Maxime's own call), so the one unit the mission cannot lose is the
    // one unit that should not be standing on the tile the whole Bloom is
    // converging on. Sporewatch Ridge, traced: six attacks a turn on Rourke
    // inside the ring, commander_down on 8, 30/30. Only one unit needs to
    // be in the zone.
    // She does follow once the squad itself is there (half the living
    // non-VIPs in or beside the zone): Wire and Mud's room is the safe
    // place, and a commander left outside it alone died 22/30.
    const others = allUnits.filter((u) => !u.downed && u.side === unit.side && u.instanceId !== unit.instanceId && !needsFrontLineProtection(u));
    const nearZone = (u: BattleUnit): boolean => hold.some((c) => chebyshevDistance(c, u.pos) <= 1);
    const squadAtZone = others.length > 0 && others.filter(nearZone).length * 2 >= others.length;
    if (!onHold && holdUntil < 99 && (!needsFrontLineProtection(unit) || others.length === 0 || squadAtZone)) {
      const standing = new Set(allUnits.filter((u) => !u.downed && u.instanceId !== unit.instanceId).map((u) => `${u.pos.x},${u.pos.y}`));
      const free = hold.filter((c) => !standing.has(`${c.x},${c.y}`));
      const dest = nearestCoord(unit.pos, free.length ? free : hold);
      // +1: rubble, doorways and the hostiles standing in them make the
      // straight-line estimate optimistic (The Outer Ring Falls: the squad
      // started walking on 8 for a turn-10 hold and never got past the door).
      const turnsNeeded = Math.max(1, Math.ceil(chebyshevDistance(unit.pos, dest) / Math.max(1, unit.moveRange))) + 1;
      if (turn + turnsNeeded >= holdUntil - 1) {
        const path = moveToward(map, unit, dest, allUnits);
        if (path.length > 1) {
          const at = lastStep(path);
          const target =
            findLethalTargetFrom(map, unit, at, enemies, allUnits, strikeMult) ??
            (profile.focusFire ? focusFireTargetInRange(map, unit, at, enemies, allUnits) : nearestDamageableInRange(map, unit, at, enemies, allUnits));
          log(entry("hold_zone", { targetId: target?.instanceId, targetName: target?.displayName, destination: at, note: "deadline: into the zone now" }));
          return { path, attackTargetId: target?.instanceId };
        }
      }
    }
  }

  // No kill, no repair in place — shoot the squad's shared priority target
  // (focus fire), or, for Easy, the nearest thing that can be hurt.
  const inPlace = profile.focusFire
    ? focusFireTargetInRange(map, unit, unit.pos, enemies, allUnits)
    : nearestDamageableInRange(map, unit, unit.pos, enemies, allUnits);
  if (inPlace) {
    // Easy's mistake: any other damageable in-range target instead.
    const alternatives = enemies.filter((e) => e.instanceId !== inPlace.instanceId && nearestDamageableInRange(map, unit, unit.pos, [e], allUnits));
    const chosen = pick([inPlace, ...alternatives]) ?? inPlace;
    if (chosen !== inPlace) log(entry("mistake", { note: "shot the wrong target" }));
    // Hard (hard.ts seam 2): same shot from a seat fewer hostiles can reach.
    if (profile.threatMap) {
      const seat = betterFiringTile(map, unit, chosen, allUnits, threatMapFor(memory, map, allUnits, turn), profile, frontLineProtected, memory, context, turn);
      if (seat) {
        log(entry("focus_weak", { targetId: chosen.instanceId, targetName: chosen.displayName, destination: lastStep(seat), note: "repositioned to a safer firing tile first" }));
        return { path: seat, attackTargetId: chosen.instanceId };
      }
    }
    log(entry("focus_weak", { targetId: chosen.instanceId, targetName: chosen.displayName }));
    return { attackTargetId: chosen.instanceId };
  }

  // Nothing in range from here — close on the weakest target, preferring a
  // safe (kiting-aware) tile; the commander never past her own front line.
  if (enemies.length > 0) {
    const ranked = [...enemies].sort((a, b) => (weakestTarget([a, b]) === a ? -1 : 1));
    const goal = pick(ranked) ?? ranked[0];
    // Hard (hard.ts seam 3): the in-range tile under the danger bar with
    // the best damage/incoming/terrain trade, instead of "far edge of my
    // range." Falls through to the ordinary pick only when NO reachable
    // tile is in range of the goal at all (null) — when tiles exist but
    // are all past the bar, Hard declines the advance and lets the
    // later branches (overwatch, hold) run.
    let hardHandled = false;
    if (profile.threatMap) {
      const threat = threatMapFor(memory, map, allUnits, turn);
      const aware = threatAwareIntoRange(map, unit, goal, enemies, allUnits, threat, profile, frontLineProtected, memory, context, turn);
      if (aware && (aware.path.length > 1 || aware.attackTargetId)) {
        const dest = lastStep(aware.path);
        log(entry("advance_into_range", { targetId: aware.attackTargetId, targetName: aware.attackTargetId ? enemies.find((e) => e.instanceId === aware.attackTargetId)?.displayName : undefined, destination: dest, note: "threat-aware tile" }));
        return { path: aware.path, attackTargetId: aware.attackTargetId };
      }
      hardHandled = !(memory.commitThisTurn && !frontLineProtected) && reachableIntoRangePreferringSafety(map, unit, goal.pos, allUnits) !== null; // in-range tiles existed but were all past the bar (unless the stall breaker is on)
    }
    let pathIntoRange = hardHandled ? null : reachableIntoRangePreferringSafety(map, unit, goal.pos, allUnits);
    if (pathIntoRange && frontLineProtected) pathIntoRange = commanderSafePathPrefix(pathIntoRange, unit, allUnits, enemies);
    if (pathIntoRange) {
      const dest = lastStep(pathIntoRange);
      const atDest =
        findLethalTargetFrom(map, unit, dest, enemies, allUnits, strikeMult) ??
        (profile.focusFire ? focusFireTargetInRange(map, unit, dest, enemies, allUnits) : nearestDamageableInRange(map, unit, dest, enemies, allUnits));
      if (pathIntoRange.length > 1 || atDest) {
        log(entry("advance_into_range", { targetId: atDest?.instanceId, targetName: atDest?.displayName, destination: dest }));
        return { path: pathIntoRange, attackTargetId: atDest?.instanceId };
      }
    }
  }

  // Munti with nobody in range: walk into range of the worst ally and heal
  // (repairPathing — MODERATE and up).
  const rm = repairMove(map, unit, allUnits, enemies, profile);
  if (rm) {
    log(entry("repair_move", { targetId: rm.targetId, destination: lastStep(rm.path) }));
    return { path: rm.path, repairTargetId: rm.targetId };
  }

  // Hold-in-place postures (ambush / interdict / overwatch) all yield while
  // an objective still needs this unit to move (a hold-zone tile it isn't
  // standing on, an extraction it IS, a rescue nobody has reached).
  const onHoldTile = (context.map.holdZone ?? []).some((c) => c.x === unit.pos.x && c.y === unit.pos.y);
  const objectiveMovePending =
    (context.mission.objective === "hold_zone" && !onHoldTile) || (isExtractMission && !!unit.isExtractionTarget) || !!findRescuableNpcOnBoard(allUnits);

  // Ambush (tiers pass): unseen, healthy, nothing to shoot, an enemy in
  // striking reach — cloak now, strike at 2x next turn. Deliberately NOT
  // gated on objectiveMovePending like the two postures below: tried it
  // (1 Sep 2026, House Amaranth 5 — two Meeps cloaking outside the zone on
  // turn 2 looked like wasted turns) and every hold-zone mission in the
  // check batch got worse (House Amaranth 9 100% → 50%, Mission 12 50% →
  // 30%): a cloaked unit walking into the zone next turn is a unit the
  // wave can't target, arriving with a 2x strike loaded.
  if (!memory.commitThisTurn && shouldAmbush(unit, enemies, allUnits, spotted, hpFraction, profile)) {
    log(entry("ambush"));
    return { action: "ambush" };
  }

  // Interdict / Overwatch (tiers pass): they're coming and there's nothing
  // to shoot yet — let them walk into it.
  if (!objectiveMovePending && enemies.length > 0 && !memory.commitThisTurn) {
    if (shouldInterdict(unit, enemies, allUnits, profile)) {
      log(entry("interdict"));
      return { action: "interdict" };
    }
    if (shouldOverwatch(unit, enemies, profile)) {
      log(entry("overwatch"));
      return { action: "overwatch" };
    }
  }

  // ---- Objective moves (25 Aug 2026 objective-awareness pass) ----
  if (isExtractMission && unit.isExtractionTarget) {
    const exits = context.map.exitTiles ?? [];
    if (exits.length) {
      const openExits = exits.filter((c) => !allUnits.some((u) => !u.downed && u.instanceId !== unit.instanceId && u.pos.x === c.x && u.pos.y === c.y));
      const dest = nearestCoord(unit.pos, openExits.length ? openExits : exits);
      const path = advance(dest);
      log(entry("extract_to_exit", { destination: path.length > 1 ? lastStep(path) : undefined }));
      return { path };
    }
  }
  if (context.mission.objective === "hold_zone") {
    const hold = context.map.holdZone ?? [];
    if (hold.length) {
      // Hard picks the zone tile nobody can punish (hard.ts bestHoldTile);
      // everyone else takes the nearest.
      const dest = (profile.threatMap ? bestHoldTile(map, unit, allUnits, threatMapFor(memory, map, allUnits, turn), context, memory) : null) ?? nearestCoord(unit.pos, hold);
      let path = advance(dest, true);
      // Mission rework pass (8 Sep 2026): a VIP (the commander, the last
      // Munti) does not walk into the zone ahead of the line. Traced on
      // Wire and Mud: with the squad pinned at the deploy edge by the
      // turn-1 sporethrowers, Rourke — moving last, nothing in reach —
      // took the objective move alone, sat in the zone by herself for two
      // turns and ate commander_down. threatTrimmedPath didn't catch it
      // (nothing had line on the doorway yet). Until the turn before the
      // hold matters, she stops at the last step that still has a living
      // ally within 2 tiles; from holdUntil-1 on, the zone is worth the
      // risk. Test-harness code only — nothing in the game reads this.
      const holdUntil = context.mission.objectiveParams.holdUntilTurn ?? context.mission.objectiveParams.turnLimit ?? 99;
      // Same rule as the deadline branch above: while any non-VIP is
      // alive, the VIP stays out of the zone entirely (falls through to
      // the ordinary fight/regroup branches, which keep her behind the
      // line) — the zone only needs one unit, and it should never be her.
      const othersAlive = allUnits.filter((u) => !u.downed && u.side === unit.side && u.instanceId !== unit.instanceId && !needsFrontLineProtection(u));
      const squadThere = othersAlive.length > 0 && othersAlive.filter((u) => hold.some((c) => chebyshevDistance(c, u.pos) <= 1)).length * 2 >= othersAlive.length;
      if (needsFrontLineProtection(unit) && othersAlive.length > 0 && !squadThere && !onHoldTile) {
        // fall through — no zone move for the VIP
      } else {
      if (needsFrontLineProtection(unit) && turn < holdUntil - 1 && path.length > 1) {
        const allies = allUnits.filter((u) => !u.downed && u.side === unit.side && u.instanceId !== unit.instanceId);
        if (allies.length) {
          // Never ahead of the most-exposed line unit, and never with fewer
          // than two allies within 2 tiles of where she ends up.
          path = commanderSafePathPrefix(path, unit, allUnits, enemies.length ? enemies : allEnemies);
          let cut = 0;
          for (let i = 1; i < path.length; i++) {
            if (allies.filter((a) => chebyshevDistance(a.pos, path[i]) <= 2).length < Math.min(2, allies.length)) break;
            cut = i;
          }
          path = path.slice(0, cut + 1);
        }
      }
      log(entry("hold_zone", { destination: path.length > 1 ? lastStep(path) : undefined }));
      return { path };
      }
    }
  }
  if (hpFraction >= profile.retreatHpFraction && !avoidsRescuePickup && profile.useAbilities.rescue) {
    const npc = findRescuableNpcOnBoard(allUnits);
    if (npc) {
      const path = advance(npc.pos);
      if (path.length > 1) {
        log(entry("seek_rescue", { targetId: npc.instanceId, targetName: npc.displayName, destination: lastStep(path) }));
        return { path };
      }
    }
  }

  // Close the distance on the weakest visible target (cohesion-capped).
  if (enemies.length > 0) {
    const goal = weakestTarget(enemies);
    let path = advance(goal.pos);
    if (frontLineProtected) path = commanderSafePathPrefix(path, unit, allUnits, enemies);
    log(entry("seek_fight", { targetId: goal.instanceId, targetName: goal.displayName, destination: path.length > 1 ? lastStep(path) : undefined }));
    return { path };
  }

  // Fog-honest and nothing in sight, but the enemy is still out there:
  // head for where the Bloom comes from rather than freezing. Hard uses
  // its last-seen memory first.
  if (allEnemies.length > 0) {
    // In order: where a hostile was last seen (Hard), the map's spawn
    // seams, and — only on a squad-stall commit turn — the nearest
    // hostile's real position. That last one is a small, deliberate cheat
    // for the test harness: a lone 6-HP survivor at the far end of a map
    // from seven Crawlmass that can't see him is a game nobody can end
    // (mission_1a, 10/100 Hard runs at the 500-loop cap), and a human
    // would go looking.
    const guesses: Coord[] = [];
    if (memory.commitThisTurn) guesses.push(nearestCoord(unit.pos, allEnemies.map((e) => e.pos)));
    if (profile.rememberLastSeen && memory.lastSeen.size > 0) guesses.push(nearestCoord(unit.pos, [...memory.lastSeen.values()]));
    const seam = explorationTarget(map, unit.pos);
    if (seam) guesses.push(seam);
    for (const target of guesses) {
      let path = advance(target);
      if (frontLineProtected) path = commanderSafePathPrefix(path, unit, allUnits, allEnemies);
      if (path.length > 1) {
        log(entry("explore", { destination: lastStep(path) }));
        return { path };
      }
    }
  }

  // Escort convergence on extract_unit missions (Mission 11 deadlock fix).
  // Mission rework pass (8 Sep 2026): toward the target while she is still
  // walking (and more than two tiles off), the exit otherwise.
  if (isExtractMission) {
    const exits = context.map.exitTiles ?? [];
    if (exits.length) {
      const dest = escortTarget && chebyshevDistance(unit.pos, escortTarget.pos) > 2 ? escortTarget.pos : nearestCoord(unit.pos, exits);
      const path = advance(dest);
      if (path.length > 1) {
        log(entry("escort_to_exit", { destination: lastStep(path) }));
        return { path };
      }
    }
  }

  // Nothing to fight and nothing to walk to: stay with the unit doing the
  // objective's work (the Munti clearing a patch), so it isn't alone when
  // the next wave lands.
  if (clearBloomObjective && unit.path !== "munti") {
    const worker = allUnits.find((u) => !u.downed && u.side === unit.side && u.path === "munti" && u.abilities.includes("abil_clear_bloom"));
    if (worker && chebyshevDistance(unit.pos, worker.pos) > 2) {
      const path = moveToward(map, unit, worker.pos, allUnits);
      if (path.length > 1) {
        log(entry("escort_to_exit", { targetId: worker.instanceId, targetName: worker.displayName, destination: lastStep(path), note: "staying with the Munti on the patch" }));
        return { path };
      }
    }
  }

  log(entry("hold_no_target"));
  return {};
}
