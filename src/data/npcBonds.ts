// src/data/npcBonds.ts
// Phase 3, piece three — autonomous NPC roaming and cliques. Build Plan §5:
// "NPC-to-NPC visible interaction... is where pilot_creator.html's
// 'Ensemble' panel stops being a design sandbox and starts being the
// actual spec," and §4's 25 Aug addendum: NPCs "pathing around the hub on
// their own... idle near their closest bonds, and drift from a toxic
// pair."
//
// Ported in spirit, not verbatim, from the Ensemble panel's own
// findClosestBond/findWorstRival plus its favPairs store — pairKey below
// is the same "sort the two ids, join them" shape pilot_creator.html
// itself uses.
//
// The one thing this file is careful to NOT be: HubNpc.favorability (see
// Hub.ts's own field comment) tracks a pilot's standing with the PLAYER —
// every existing verb (Share a Drink, the three minigames, Ask Out) reads
// and writes THAT number. A "clique" is a different axis entirely — NPC
// A's standing with NPC B, which has nothing to do with either of their
// standing with Rourke. Nothing in the real engine tracked that axis at
// all before this file. It's a real, separate store (pairKey-keyed), not
// a reuse or a rename of the existing Favorability field.
//
// Scoped narrowly, same discipline as piece #2 of Build Plan §9 (NPC
// movement's own "minimal, literal first slice" note): this pass makes
// bonds spatially VISIBLE (an NPC idles near their closest bond, drifts
// from their worst rival) using bonds that are seeded once and held fixed.
// It does NOT port the Ensemble panel's other half — the "auto-simulated
// days" loop where random pairs get fielded together and these numbers
// actually move from real events. That's real, further work, flagged here
// rather than silently assumed done: nothing in this file changes a bond
// value, only reads them.

export function pairKey(idA: string, idB: string): string {
  return [idA, idB].sort().join("::");
}

export interface BondReading {
  otherId: string;
  value: number;
}

function bondValue(bonds: Record<string, number>, idA: string, idB: string): number {
  return bonds[pairKey(idA, idB)] ?? 0;
}

// Highest-value bond among `others` — mirrors findClosestBond's own name
// and shape from pilot_creator.html. Returns null when there's nobody else
// to have a bond with (a room with only one NPC in it).
export function findClosestBond(pilotId: string, others: string[], bonds: Record<string, number>): BondReading | null {
  let best: BondReading | null = null;
  for (const otherId of others) {
    if (otherId === pilotId) continue;
    const value = bondValue(bonds, pilotId, otherId);
    if (!best || value > best.value) best = { otherId, value };
  }
  return best;
}

// Lowest-value bond among `others` — mirrors findWorstRival.
export function findWorstRival(pilotId: string, others: string[], bonds: Record<string, number>): BondReading | null {
  let worst: BondReading | null = null;
  for (const otherId of others) {
    if (otherId === pilotId) continue;
    const value = bondValue(bonds, pilotId, otherId);
    if (!worst || value < worst.value) worst = { otherId, value };
  }
  return worst;
}

// Thresholds for when a bond is strong enough to actually pull movement —
// placeholder numbers, same "not a locked number" caveat as the rest of
// this scene. A pair sitting in the neutral middle (neither a real clique
// nor real friction) doesn't get a forced destination at all — see
// Hub.ts's updateNpcRoaming, which falls back to an ordinary random idle
// point in that case rather than treating "neutral" as "hostile."
export const CLIQUE_THRESHOLD = 20;
export const RIVAL_THRESHOLD = -20;

export interface Point {
  x: number;
  y: number;
}

// A point `distance` away from `target`, at a random angle — "stand near
// your closest bond" without ever computing the exact same spot they're
// standing on (which would just be a collision every time). Takes an
// injectable rng purely so this is deterministically testable; Hub.ts
// calls it with the real Math.random.
export function pointNear(target: Point, distance: number, rng: () => number = Math.random): Point {
  const angle = rng() * Math.PI * 2;
  return { x: target.x + Math.cos(angle) * distance, y: target.y + Math.sin(angle) * distance };
}

// A point `distance` further along the line from `avoid` through `self` —
// "keep walking away from your worst rival" in whatever direction is
// already carrying you away from them, rather than picking a fresh random
// direction that could coincidentally walk back toward them.
export function pointAwayFrom(self: Point, avoid: Point, distance: number): Point {
  const dx = self.x - avoid.x;
  const dy = self.y - avoid.y;
  const len = Math.hypot(dx, dy) || 1; // guards the degenerate case of standing exactly on top of them
  return { x: self.x + (dx / len) * distance, y: self.y + (dy / len) * distance };
}
