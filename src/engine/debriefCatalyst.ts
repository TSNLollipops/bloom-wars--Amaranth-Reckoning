// src/engine/debriefCatalyst.ts
// Emotional Brain, Phase 2 — the Debrief write-back, 12 Sep 2026.
// claude/Bloom_Wars_Emotional_Brain_Build_Plan_v1_12Sep2026.md §3b. This is
// Worries System build-order step 5 (the Stress/Morale write-back the
// proposal deferred) and the combat bridge NPC_Reaction_Engine_v1.md §4a
// named a landing spot for, built for real.
//
// Before this file, a mission classified what every pilot did, turn by
// turn (Mission.combatWorries, data/combatWorry.ts), and then threw the
// Mission object away. scenes/Debrief.ts had zero references to stress or
// morale. A pilot who survived three losses and one who sat out the war
// were identical the next morning. Now, once per Debrief, for every
// deployed pilot still on the roster:
//
//   1. Roll their echo for the mission (the same pickSoloEcho chain the
//      Hub uses, with the pilot's archetype lean and drift applied, data/
//      echoLean.ts): how they took it.
//   2. Turn their own combat events into Stress/Morale deltas: a base per
//      source, scaled by the event's intensity, then by the echo (fear and
//      sadness take everything harder). A flat win/loss term on top. The
//      whole mission's contribution is clamped so one bad sortie bends a
//      pilot and never snaps them; then absolute 0..100.
//   3. Write memories (data/memories.ts, via engine/memoryLedger.ts): their
//      own events, plus `saw_fall` for every squadmate they watched go
//      down and `lost_squadmate` for every permanent loss they were
//      deployed alongside. Each memory nudges their drift.
//   4. Pair bond shift on an ORDINARY mission (Maxime's call, 12 Sep 2026,
//      build plan §7 Q2): the exact Grief Catalyst formula,
//      (ECHO_BOND_LEAN[echoA] + ECHO_BOND_LEAN[echoB]) × scale, over every
//      bonded pair of deployed survivors, at PAIR_SCALE_ORDINARY (1)
//      instead of grief's 4. On a mission WITH a permanent loss this step
//      is skipped entirely: engine/griefCatalyst.ts already ran the ×4
//      version per loss, and running both would double-count.
//
// Maxime's own scope call (build plan §7 Q3): "own events + outcome," the
// recommended option. Rourke / Marrow (the player character) is skipped:
// there is still no persisted Stress/Morale for the MC (build plan §8).
//
// Every number in this file is a placeholder in the same sense as every
// other social-layer constant: picked with reasoning, checked against
// `npm run sim:brain`, expected to move. They live at the top of this file
// on purpose, so a tuning pass touches one place.
//
// Pure with respect to Phaser and the clock: `now`/`today` come in through
// options (Debrief passes nothing and gets Date.now()/currentDay; the
// harness passes fixed values so a replay is byte-identical).
import type { CampaignState } from "./campaignState";
import { ensureNpcSocialState } from "./campaignState";
import { currentDay } from "./calendarClock";
import { pairKey } from "../data/npcBonds";
import { pickSoloEcho, stageFromTier, type AmbientPilotState, type Echo } from "../data/ambientLines";
import { catalystForPilot, NPC_BOND_SEED } from "../data/npcSeed";
import type { WorryEntry, WorrySourceId } from "../data/worries";
import { MEMORY_BIRTH_WEIGHT, type MemoryEntry, type MemoryKind } from "../data/memories";
import { reactionWeight } from "./pillars";
import { historyAdjustedEchoLean, recordMemory, settleDrift, socialStateFor } from "./memoryLedger";
import { ECHO_BOND_LEAN, type GriefBondShift, type GriefCatalystResult } from "./griefCatalyst";
import { UNIT_ARCHETYPES } from "../data/units";

// ---- Tunables -------------------------------------------------------------

/** Per-source base deltas, before intensity and echo scaling. `kind` is the memory the source leaves; none for a dodge (a worry, not something you carry). */
export const SOURCE_TAKE: Record<WorrySourceId, { stress: number; morale: number; kind?: MemoryKind }> = {
  mission_pilot_missing: { stress: 0, morale: 0 }, // Hub-side source, never on a Mission's list
  combat_kill: { stress: 1, morale: 3, kind: "got_the_kill" },
  combat_repair: { stress: 0.5, morale: 2, kind: "patched_someone" },
  combat_downed: { stress: 6, morale: -4, kind: "was_downed" },
  combat_permadeath_recoverable: { stress: 6, morale: -3, kind: "was_pulled_out" },
  combat_permadeath_lost: { stress: 0, morale: 0 }, // the pilot is gone; survivors are handled via LOSS_TAKE
  combat_overwatch: { stress: 0.5, morale: 2, kind: "held_the_line" },
  combat_dodge: { stress: 2, morale: 1 },
  // Gate 4, 14 Sep 2026 — same case as mission_pilot_missing above: Hub-side
  // sources (engine/suppressedReaction.ts writes them onto HubNpc.worries),
  // never on a Mission's combatWorries list, so this lookup never reaches
  // them. Zero take, present only because the Record is exhaustive over
  // WorrySourceId. The memory each one leaves is written at the moment of
  // suppression through recordMemory, not here at Debrief, so no `kind`.
  hub_suppressed_anger: { stress: 0, morale: 0 },
  hub_suppressed_askout: { stress: 0, morale: 0 },
};

/** How the echo colours the take. stressUp scales any Stress increase; moraleUp any Morale gain; moraleDown any Morale loss. */
export const ECHO_TAKE: Record<Echo, { stressUp: number; moraleUp: number; moraleDown: number }> = {
  love: { stressUp: 0.8, moraleUp: 1.2, moraleDown: 0.9 },
  fear: { stressUp: 1.3, moraleUp: 0.8, moraleDown: 1.2 },
  anger: { stressUp: 0.9, moraleUp: 1.2, moraleDown: 0.8 },
  sadness: { stressUp: 1.1, moraleUp: 0.6, moraleDown: 1.4 },
};

/** Intensity scaling: delta × (INTENSITY_FLOOR + intensity). A 0.5 event reads at 1.0×, a 0.95 downing-to-death at 1.45×. */
export const INTENSITY_FLOOR = 0.5;

/** Watching a squadmate go down (they came back). */
export const SAW_FALL_TAKE = { stress: 2, morale: 0 };
/** Losing a squadmate for good. The heaviest single term in the file. */
export const LOSS_TAKE = { stress: 10, morale: -8 };
/** The flat outcome term. A win is the one thing in a mission that eases Stress. */
export const OUTCOME_TAKE: Record<"win" | "loss", { stress: number; morale: number }> = {
  win: { stress: -4, morale: 5 },
  loss: { stress: 5, morale: -6 },
};

/**
 * Per-mission clamp on the whole contribution. Bends, never snaps. First
 * harness read (12 Sep 2026, 3 seeds, hard bot, 3 Hub days between
 * missions): at 20/15 with downed=10 and recoverable=12, a WIN with two
 * pilots downed-and-restocked still hit the Stress clamp for both of them,
 * and Anand (seeded at Stress 78, already panicking) was pinned at 100
 * from mission 2 on. Retuned to what a player can plausibly counter with
 * the Hub's own relief verbs (Share a Drink is -8): an ordinary sortie
 * with a downing nets +6..+10, a bad one +12..+16, a clean win -3.
 * (His seed itself came down separately, 78 to 58, on 13 Sep 2026 — see
 * data/npcSeed.ts — once it was clear the clamp alone couldn't give a
 * player any way to help him if the seed stayed structurally over the
 * line before a single mission ran.)
 */
export const MISSION_STRESS_CLAMP = 16;
export const MISSION_MORALE_CLAMP = 12;

/** Grief's own ECHO_BOND_SCALE is 4 (a loss). An ordinary mission moves a bonded pair at this scale instead. */
export const PAIR_SCALE_ORDINARY = 1;

// ---- Types ------------------------------------------------------------------

export interface DebriefCatalystInput {
  missionId: string;
  outcome: "win" | "loss";
  deployedPilotIds: readonly string[];
  /** Mission.combatWorries, verbatim. */
  combatWorries: Readonly<Record<string, readonly WorryEntry[]>>;
  /** pilotIds from Mission.permanentLosses. Their roster status has already been flipped by applyMissionLosses. */
  permanentlyLostPilotIds: readonly string[];
  /** What engine/griefCatalyst.ts already produced this Debrief, one per loss, so a mourner's memory carries the echo they actually mourned with. */
  griefResults?: readonly GriefCatalystResult[];
}

export interface DebriefCatalystOptions {
  rng?: () => number;
  now?: number;
  today?: number;
}

export interface DebriefPilotTake {
  pilotId: string;
  displayName: string;
  echo: Echo;
  reason: string;
  stressDelta: number;
  moraleDelta: number;
  stressAfter: number;
  moraleAfter: number;
  memories: MemoryEntry[];
}

export interface DebriefCatalystResult {
  pilots: DebriefPilotTake[];
  /** The ordinary-mission pair shifts. Empty on a mission with a loss (grief already did the pairs at ×4). */
  bondShifts: GriefBondShift[];
  hadLoss: boolean;
}

// ---- The write-back ---------------------------------------------------------

function isPlayerCharacter(pilotId: string): boolean {
  return pilotId === "pilot_rourke" || pilotId === "pilot_marrow";
}

function clampDelta(value: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, Math.round(value)));
}

function clamp100(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scaledTake(base: { stress: number; morale: number }, intensity: number, echo: Echo, pillars = 1): { stress: number; morale: number } {
  const k = (INTENSITY_FLOOR + Math.max(0, Math.min(1, intensity))) * Math.max(0, Math.min(1, pillars));
  const t = ECHO_TAKE[echo];
  const stress = base.stress > 0 ? base.stress * k * t.stressUp : base.stress * k;
  const morale = base.morale > 0 ? base.morale * k * t.moraleUp : base.morale * k * t.moraleDown;
  return { stress, morale };
}

export function runDebriefCatalyst(state: CampaignState, input: DebriefCatalystInput, opts: DebriefCatalystOptions = {}): DebriefCatalystResult {
  const rng = opts.rng ?? Math.random;
  const now = opts.now ?? Date.now();
  const today = opts.today ?? currentDay(state);
  const lost = new Set(input.permanentlyLostPilotIds);
  const hadLoss = lost.size > 0;

  // Survivors: deployed, still active, not the player character.
  const survivors = input.deployedPilotIds.filter((id) => !lost.has(id) && !isPlayerCharacter(id) && state.pilots[id]?.status === "active");
  const witnesses = input.deployedPilotIds.filter((id) => !isPlayerCharacter(id));

  // Which squadmates went down (and came back) this mission, for saw_fall.
  const downed = new Set<string>();
  for (const id of input.deployedPilotIds) {
    if (lost.has(id)) continue;
    if ((input.combatWorries[id] ?? []).some((w) => w.source === "combat_downed")) downed.add(id);
  }
  // Living Muntis this mission: the ones who could still reach a downed pilot. `about` for was_pulled_out.
  const muntis = survivors.filter((id) => UNIT_ARCHETYPES[state.pilots[id]?.pilot.archetypeId ?? ""]?.path === "munti");

  // A mourner's own grief echo, when grief already ran.
  const griefEcho: Record<string, Record<string, Echo>> = {};
  for (const g of input.griefResults ?? []) {
    griefEcho[g.lostPilotId] = {};
    for (const m of g.mourners) griefEcho[g.lostPilotId][m.pilotId] = m.echo;
  }

  const pilots: DebriefPilotTake[] = [];
  const echoByPilot: Record<string, Echo> = {};

  for (const pilotId of survivors) {
    const entry = state.pilots[pilotId];
    const social = socialStateFor(state, pilotId);
    const catalyst = catalystForPilot(pilotId, entry.pilot.background);
    const drift = settleDrift(social, today);
    const ambient: AmbientPilotState = {
      catalyst,
      stage: stageFromTier(entry.pilot.tier),
      stress: social.stress,
      morale: social.morale,
      drunk: !!social.drunkUntil && social.drunkUntil > now,
      echoLean: historyAdjustedEchoLean(catalyst, social, drift, today),
    };
    const pick = pickSoloEcho(ambient, rng);
    const echo = pick.echo;
    echoByPilot[pilotId] = echo;

    let stress = 0;
    let morale = 0;
    const memories: MemoryEntry[] = [];
    const others = witnesses.filter((id) => id !== pilotId);

    // 1. Own events.
    // Slice 1 (17 Sep 2026): every take below is scaled by the three
    // pillars — Time (this is happening now, so 1.0), Volume (whose event
    // it was), Matter (this pilot's own agency rung). engine/pillars.ts.
    // NOT the "world" ring: that one is for something the campaign narrates
    // at a pilot who wasn't in it. Everything Debrief scales here happened to
    // a pilot who was on the board, so the subject is always a person —
    // themselves for their own events and the outcome of the fight they
    // fought, the other pilot for what happened to the others.
    const selfWeight = reactionWeight(state, { pilotId, aboutId: pilotId, inTheFight: true }).weight;

    const own = input.combatWorries[pilotId] ?? [];
    for (const w of own) {
      const take = SOURCE_TAKE[w.source];
      if (!take) continue;
      const s = scaledTake(take, w.intensity, echo, selfWeight);
      stress += s.stress;
      morale += s.morale;
      if (take.kind) {
        const about = take.kind === "was_pulled_out" ? muntis.filter((id) => id !== pilotId) : [];
        // A repair's memory scales with how much it healed, same as its intensity did.
        const weight = take.kind === "patched_someone" ? Math.min(1, MEMORY_BIRTH_WEIGHT.patched_someone * (0.5 + w.intensity)) : undefined;
        memories.push(recordMemory(state, pilotId, { kind: take.kind, echo, about, witnesses: others, missionId: input.missionId, weight, now, today }));
      }
    }

    // 2. What happened to the others.
    for (const otherId of others) {
      if (otherId === pilotId) continue;
      const otherWeight = reactionWeight(state, { pilotId, aboutId: otherId, inTheFight: true }).weight;
      if (lost.has(otherId)) {
        const s = scaledTake(LOSS_TAKE, 1, echo, otherWeight);
        stress += s.stress;
        morale += s.morale;
        const mournEcho = griefEcho[otherId]?.[pilotId] ?? echo;
        memories.push(recordMemory(state, pilotId, { kind: "lost_squadmate", echo: mournEcho, about: [otherId], witnesses: others, missionId: input.missionId, now, today }));
      } else if (downed.has(otherId)) {
        const s = scaledTake(SAW_FALL_TAKE, 0.5, echo, otherWeight);
        stress += s.stress;
        morale += s.morale;
        memories.push(recordMemory(state, pilotId, { kind: "saw_fall", echo, about: [otherId], witnesses: others, missionId: input.missionId, now, today }));
      }
    }

    // 3. The outcome.
    const o = OUTCOME_TAKE[input.outcome];
    const so = scaledTake(o, 0.5, echo, selfWeight);
    stress += so.stress;
    morale += so.morale;
    memories.push(recordMemory(state, pilotId, { kind: input.outcome === "win" ? "mission_won" : "mission_lost", echo, witnesses: others, missionId: input.missionId, now, today }));

    // 4. Clamp and apply. The reported delta is the REALIZED one (after
    // the 0..100 clamp), so a pilot already at Stress 100 reads "+0", not
    // "+9" that went nowhere.
    const stressBefore = social.stress;
    const moraleBefore = social.morale;
    social.stress = clamp100(stressBefore + clampDelta(stress, MISSION_STRESS_CLAMP));
    social.morale = clamp100(moraleBefore + clampDelta(morale, MISSION_MORALE_CLAMP));
    const stressDelta = social.stress - stressBefore;
    const moraleDelta = social.morale - moraleBefore;

    pilots.push({
      pilotId,
      displayName: entry.pilot.displayName,
      echo,
      reason: pick.reason,
      stressDelta,
      moraleDelta,
      stressAfter: social.stress,
      moraleAfter: social.morale,
      memories,
    });
  }

  // 5. Ordinary-mission pair shift. Skipped when grief ran (it did the pairs at ×4 per loss).
  const bondShifts: GriefBondShift[] = [];
  if (!hadLoss && survivors.length >= 2) {
    const npcSocial = ensureNpcSocialState(state, NPC_BOND_SEED);
    for (let i = 0; i < survivors.length; i++) {
      for (let j = i + 1; j < survivors.length; j++) {
        const idA = survivors[i];
        const idB = survivors[j];
        const key = pairKey(idA, idB);
        if (!Object.prototype.hasOwnProperty.call(npcSocial.bonds, key)) continue; // lazy-init respected, same as grief
        const delta = (ECHO_BOND_LEAN[echoByPilot[idA]] + ECHO_BOND_LEAN[echoByPilot[idB]]) * PAIR_SCALE_ORDINARY;
        if (delta === 0) continue;
        npcSocial.bonds[key] += delta;
        bondShifts.push({ pairKey: key, pilotIdA: idA, pilotIdB: idB, delta, newValue: npcSocial.bonds[key] });
      }
    }
  }

  return { pilots, bondShifts, hadLoss };
}

/** The plain-language word for an echo in the Debrief line. System text, not character voice. */
export const ECHO_TAKE_WORD: Record<Echo, string> = {
  love: "warmly",
  fear: "shaken",
  anger: "angry",
  sadness: "heavily",
};

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

/** One Debrief line per pilot: "Anand: took it shaken. Stress +12, Morale -6." */
export function debriefTakeLine(take: DebriefPilotTake): string {
  return `${take.displayName}: took it ${ECHO_TAKE_WORD[take.echo]}. Stress ${signed(take.stressDelta)}, Morale ${signed(take.moraleDelta)}.`;
}
