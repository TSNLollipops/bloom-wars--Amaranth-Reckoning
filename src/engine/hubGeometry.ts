// The egg hull, 27 Aug 2026 — Hub.ts's one bit of movement-boundary math
// pulled out into its own Phaser-free module. Every scene file in this
// repo (Hub.ts included) imports "phaser" at module scope, and that import
// throws immediately outside a real browser ("window is not defined") —
// the actual reason Hub.ts has had zero unit tests since Phase 1, not an
// oversight. This file imports nothing, so hubGeometry.test.ts can exercise
// the ellipse math directly rather than only trusting a browser smoke-test
// (matching combat_sim.py/maps.py's own standing rule: a number this easy
// to get subtly wrong deserves a real test).
//
// (x, y) is where something tried to move; if it's already inside the
// ellipse (radii shrunk by `inset`, so a PLAYER_R/NPC_R-sized circle never
// visually pokes past the drawn line), it's returned unchanged. Otherwise
// it's pulled straight back along the line from the center to the nearest
// point ON the ellipse — cheap, and exact for that purpose, even though
// shrinking both radii by the same flat `inset` is only an approximation
// of a true constant-width offset curve (a hair tighter on the flatter of
// the two axes). Close enough at PLAYER_R/NPC_R's actual size (15-16px
// against Hub.ts's own 233-395px grotto radii) that it's not something a
// player could ever see, which is the only thing this needs to guarantee.
export function clampToEllipse(
  x: number,
  y: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  inset: number,
): { x: number; y: number } {
  const erx = Math.max(1, rx - inset);
  const ery = Math.max(1, ry - inset);
  const dx = x - cx;
  const dy = y - cy;
  const e = (dx / erx) ** 2 + (dy / ery) ** 2;
  if (e <= 1) return { x, y };
  const scale = 1 / Math.sqrt(e);
  return { x: cx + dx * scale, y: cy + dy * scale };
}
