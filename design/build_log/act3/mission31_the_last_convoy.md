# Mission 31 — The Last Convoy

**Objective:** extract_unit + a new multi-civilian escort/extraction system, "not everyone gets out." **Enemy:** thinned, staggered ambush waves (thinned specifically because the civilians' fragile stats made the original composition close to a guaranteed loss regardless of AI behavior).

The multi-civilian system's debut — see `engine_systems/civilian_extraction_system.md` for the mechanic itself and its two launch bugs (flee-direction logic, escort/civilian map-side mismatch), both found and fixed the same day.

**Result:** 13/20 (65%) — real variance, both loss conditions (extraction-below-threshold, turn-limit) firing across the sample, matching "not everyone gets out" as genuine risk rather than a guaranteed specific or a coin flip.

Full narrative: archive, "batch 6, 25 Aug 2026: missions 29-32," Mission 31's own section and the civilian-system section above it.
