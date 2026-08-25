# Mission 35 — The Last Ring

**Objective:** hold_zone (holdUntilTurn 16 / turnLimit 22). **Map:** single-doorway walled room, same shape as Mission 33. **Enemy:** the campaign's final boss, **The Cradle** (`bloom_cradle`), debuts turn 6.

The Cradle — Independent Campaign doc §8's "true final boss, largest Endurance wall in the campaign." Same lineage as Heartwood (concussive/sessile/seismic/emergent), every stat pushed past it: END 400→560 (+40%), VIT 60→70 (nudged up but still low enough to stay Severance-vulnerable per the Collapse rule), attackPower 60→75, attackRange [1,4]→[1,5], vision 8→9.

**A real interpretation call, documented rather than left implicit:** the doc tags this mission "[final boss breaches]," not "[eliminate_all boss]" the way Mission 21 tagged Heartwood — read literally as hold_zone, not eliminate_all. Killing the Cradle is a reasonable way to play (560 endurance is a lot to burn while also holding a doorway) but never required; the win check never reads hostile-alive count.

**A real bug in the first draft, not a tuning number:** the Cradle's sealed pocket was placed beside the room's east wall (~9 tiles from where the squad naturally clusters to plug the doorway) — it spawned every run but never once logged an attack in 20 test runs, since hold_zone doesn't require covering every tile. Fixed by moving the pocket to a single sealed tile centered under the room's south wall, so its [1,5] attack range covers every hold tile from one position (worst case exactly 5, at the far corners) regardless of how the squad spreads out.

**Result:** 11/20 (55%) — the campaign's hardest fight by design, real permanent losses even on wins.

Full narrative: archive, "Batch 7, 25 Aug 2026: Act III finale," "The Cradle archetype" and Mission 35's own sections.
