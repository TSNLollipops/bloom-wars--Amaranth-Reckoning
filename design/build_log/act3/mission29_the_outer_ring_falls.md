# Mission 29 — The Outer Ring Falls

**Objective:** hold_zone. **Map:** 5-wave siege. **Enemy:** staged, 5 waves.

The design doc's own "scripted strategic loss" tag was resolved the same way Mission 12's header already resolved an identical question: a real, winnable-and-losable hold_zone, not a new forced-loss mechanic — "the ring falls" lands as Command's own withdrawal order on a genuine tactical win, via an `objective_complete` dialogue event, same technique as Marrow's Mission 28 closure.

**Same spawn-vision bug as Mission 27, found and fixed the same way:** first pass spawned off the map's own decorative far-edge tiles (the doorway only opens west; anything spawned due east never enters vision) — 15/15 win at exactly turn 10, zero combat. Fixed by moving actual spawn coordinates into the two corridors that reach the doorway.

**Result:** 20/20 after the fix, real attrition, no permanent losses across the sample — matches the mission's own "100%-clean-but-costly reads fine for a fight that ends in an ordered withdrawal either way" framing.

Full narrative: archive, "batch 6, 25 Aug 2026: missions 29-32," Mission 29's own section.
