// src/engine/cooldown.ts
//
// A tiny, generic turn-based cooldown primitive — three pure functions
// over a single number, no class, no Mission/campaign coupling. Built
// 28 Aug 2026 for Weapons Bay's bonus Fire Support charges (see
// mission.ts's fireSupport()/canFireSupport()), but kept deliberately
// generic: Maxime's own reason for wanting a real cooldown here rather
// than another flat per-mission charge count is that a future Heirloom
// mechanic is expected to want the same shape ("heirloom will use same
// system," 28 Aug 2026). Nothing Heirloom-specific — or Fire-Support-
// specific — lives in this file; whoever needs a "ready again after N
// turns" gate next should import these same three functions, not
// reinvent them.
//
// This also isn't a brand-new shape for this codebase — it's an
// extraction. `Mission.cooldownReadyTurn()`/`abilityCooldownRemaining()`
// already carried this exact "readyAtTurn vs. currentTurn" math for the
// per-unit `BattleUnit.abilityCooldowns` map (present on every unit,
// typed, initialized to `{}` everywhere — but, confirmed by grep before
// writing this, never actually written to by any ability yet: real
// scaffolding for a cooldown-gated ability that hasn't shipped). Pulling
// the math out here means Weapons Bay and that still-unused per-unit map
// share one real implementation instead of two copies that could drift —
// see mission.ts's own refactor of those two methods to call into this
// file.
//
// Model: a cooldown is represented as a single number, `readyAtTurn` —
// the turn number at or after which the gated thing is usable again. 0
// (or any value <= the current turn) reads as "ready now" — the "never
// used yet" state doesn't need its own sentinel. There's no shared
// mutable state in this file — the caller owns wherever readyAtTurn
// actually lives (a Mission field, a per-unit map entry, a future
// Heirloom-charge field), same "pure function over caller-owned state"
// shape most of src/data/**'s own helpers already use, just living in
// engine/ since Mission (not a data file) is its first real caller.

/** True if a cooldown last started so it becomes ready at readyAtTurn is usable again on currentTurn. readyAtTurn <= 0 always reads ready — the "never started" state. */
export function isCooldownReady(readyAtTurn: number, currentTurn: number): boolean {
  return currentTurn >= readyAtTurn;
}

/** The new readyAtTurn after using a cooldown-gated thing on currentTurn, given cooldownTurns (how many turns must pass before it's ready again — 0 means ready again immediately, i.e. no real cooldown at all). */
export function startCooldown(currentTurn: number, cooldownTurns: number): number {
  return currentTurn + Math.max(0, cooldownTurns);
}

/** Turns still to wait before a cooldown at readyAtTurn is usable again on currentTurn — 0 once it's ready. Convenience wrapper so callers exposing a HUD-facing "N turns left" number don't hand-roll the same Math.max(0, ...) themselves. */
export function cooldownTurnsRemaining(readyAtTurn: number, currentTurn: number): number {
  return Math.max(0, readyAtTurn - currentTurn);
}
