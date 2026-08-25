# Mission 23 — The Amaranth Accord

**Objective:** extract_unit (Anand, turn 17). **Map:** records-office grounds, 26×13. **Enemy:** 4 House Amaranth Line Troopers.

**Caught before ever running the sim:** the first draft's `extractUnitId` pointed at an invented NPC — but `extract_unit`'s own check only ever resolves ids already in `this.units` at deploy (i.e., a real deployed pilot). Rewrote so the actual extraction target is Anand, matching Mission 17's precedent; the records officer stays narrative-only.

**A real, previously-unknown Player AI pathing bug, found tuning this mission and partially fixed:** `nearestCoord` picked the single geometrically-nearest exit tile with zero regard for whether an ally already occupied it — if a squadmate happened to be standing on that one tile, the extract target's own distance search had nowhere to make progress and stalled, freezing the rest of the idle squad too. Fixed the "single tile occupied" half narrowly: both call sites resolving an exit destination now prefer unoccupied exits first. The deeper cause — `cohesiveMoveToward`'s greedy, non-detouring search can still be walled off by several idle allies standing shoulder-to-shoulder even with occupancy awareness — was diagnosed but deliberately not rewritten (real engine work, not a mission fix); mitigated at content level by widening the exit zone and extending the turn limit.

**Result:** ~86% (12/14) — a real improvement, with the underlying "wall of idle allies" limitation still there and confirmed to resurface at squad scale on Mission 26.

Full narrative: archive, "batch 4 built — missions 21-24," Mission 23's own section.
