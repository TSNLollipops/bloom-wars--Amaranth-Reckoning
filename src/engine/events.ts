// src/engine/events.ts
// The MissionEvent evaluator (Build Brief step 8). Triggers are checked at
// turn start, on movement completion (zone_entered), and on objective
// resolution. guardGroup gives mutual exclusion between events that should
// fire at most once between them (Mission 1a's collapse ambush: turn 4 OR
// zone entry, never both). repeatEvery lets a turn_start event recur
// (Mission 3's Heartwood adds).
import type { Coord, MissionEvent } from "../data/types";
import { coordKey } from "./grid";

export interface EventRuntimeState {
  firedOnce: Set<string>; // event ids that have fired and are `once: true`
  firedGuardGroups: Set<string>; // guardGroups that have already fired an event
  lastFiredTurn: Map<string, number>; // event id -> last turn it fired, for repeatEvery
}

export function createEventRuntimeState(): EventRuntimeState {
  return { firedOnce: new Set(), firedGuardGroups: new Set(), lastFiredTurn: new Map() };
}

function canFire(ev: MissionEvent, state: EventRuntimeState): boolean {
  if (ev.once && state.firedOnce.has(ev.id)) return false;
  if (ev.guardGroup && state.firedGuardGroups.has(ev.guardGroup)) return false;
  return true;
}

function markFired(ev: MissionEvent, state: EventRuntimeState, turn: number): void {
  if (ev.once) state.firedOnce.add(ev.id);
  if (ev.guardGroup) state.firedGuardGroups.add(ev.guardGroup);
  state.lastFiredTurn.set(ev.id, turn);
}

/** Evaluate turn_start triggers (including repeatEvery) for the given turn. */
export function evaluateTurnStart(events: MissionEvent[], turn: number, state: EventRuntimeState): MissionEvent[] {
  const fired: MissionEvent[] = [];
  for (const ev of events) {
    if (ev.trigger.type !== "turn_start") continue;
    if (!canFire(ev, state)) continue;
    const { turn: triggerTurn, repeatEvery } = ev.trigger;
    let matches = turn === triggerTurn;
    if (!matches && repeatEvery && turn > triggerTurn && (turn - triggerTurn) % repeatEvery === 0) {
      matches = true;
    }
    if (matches) {
      fired.push(ev);
      markFired(ev, state, turn);
    }
  }
  return fired;
}

/** Evaluate zone_entered triggers — call after a unit finishes a move. */
export function evaluateZoneEntered(events: MissionEvent[], enteredTile: Coord, turn: number, state: EventRuntimeState): MissionEvent[] {
  const fired: MissionEvent[] = [];
  const key = coordKey(enteredTile);
  for (const ev of events) {
    if (ev.trigger.type !== "zone_entered") continue;
    if (!canFire(ev, state)) continue;
    if (ev.trigger.zone.some((c) => coordKey(c) === key)) {
      fired.push(ev);
      markFired(ev, state, turn);
    }
  }
  return fired;
}

export function evaluateUnitDowned(events: MissionEvent[], unitId: string, turn: number, state: EventRuntimeState): MissionEvent[] {
  const fired: MissionEvent[] = [];
  for (const ev of events) {
    if (ev.trigger.type !== "unit_downed") continue;
    if (!canFire(ev, state)) continue;
    if (ev.trigger.unitId === unitId) {
      fired.push(ev);
      markFired(ev, state, turn);
    }
  }
  return fired;
}

export function evaluateObjectiveComplete(events: MissionEvent[], turn: number, state: EventRuntimeState): MissionEvent[] {
  const fired: MissionEvent[] = [];
  for (const ev of events) {
    if (ev.trigger.type !== "objective_complete") continue;
    if (!canFire(ev, state)) continue;
    fired.push(ev);
    markFired(ev, state, turn);
  }
  return fired;
}
