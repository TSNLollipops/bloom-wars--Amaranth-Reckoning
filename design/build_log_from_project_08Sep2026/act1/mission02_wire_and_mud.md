# Mission 2 — Wire and Mud

**Objective:** hold_zone (hold from turn 6, limit 12 — originally 10). **Map:** listening post, single-tile-doorway hold room, 16×10. **Enemy:** 6+6 Splitfang across turns 1 and 3 (originally 3+3).

**Two real engagement bugs, found and fixed same-day at launch (22 Aug):** (1) spawn tiles sat outside Splitfang's own vision range entirely — hostiles never got a reason to move, ever; moved spawn column 15→11 to bring worst-case distance to exactly vision range. (2) `moveToward()` used straight-line distance, which can't route around a chokepoint (the only path to a single doorway requires walking *away* in a straight line first) — added a proper walls-aware `distanceField()` (Dijkstra flood fill) so pathing correctly recognizes progress around a wall.

**A second, deeper bug found tuning "twice as many enemy":** doubling the wave straight to 6+6 broke the mission outright (full wipe) — root cause wasn't pack-AI concentration (the first, wrong theory tested and discarded) but `findFreeAdjacent()` placing an overflow spawn unit by raw distance with no wall awareness, spawning a Splitfang *through* the sealed east wall directly onto a hold-zone tile. Fixed by rewriting `findFreeAdjacent` as a walls-aware BFS. With the real bug gone, Maxime's original literal "twice as many" (6+6) ships clean.

**Final result:** 8/8 win, every run, turn 6 — both the door-plug regression test and the fighting sim agree.

Full narrative: archive, "Mission 2 fix — hostiles weren't engaging at all" (22 Aug) and "the real Mission 2 fix" (23 Aug, cont'd).
