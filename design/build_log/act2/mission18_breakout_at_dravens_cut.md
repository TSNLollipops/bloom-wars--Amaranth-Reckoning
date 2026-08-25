# Mission 18 — Breakout at Draven's Cut

**Objective:** eliminate_all (turn 12). **Map:** canyon corridor, 32×14, two mouths. **Enemy:** 4 House Amaranth Line Troopers (west) + 6 Crawlmass + 3 Splitfang (east) — a genuine two-front pincer.

**A real gotcha caught before ever writing the mission, not by testing:** `deriveZones()` pools every `enemy_deploy`-tagged tile into one flat array with no notion of "side" — using it for either wave here would have round-robined both fronts across both mouths combined, collapsing the intended pincer into one randomly-mixed wave. Fixed the only way this class of bug can be fixed (same technique as Mission 14's fixed Gallcyst and Mission 4's fixed Undertow): both waves use explicit `spawnAt` coordinate arrays, scoped to their own mouth only. Confirmed in the actual sim log — both sides' attack lines appear throughout every run, genuinely fighting from separate mouths.

**Result:** 14/14 clean, real combat on both fronts, no tuning needed past the first guess (house rule #5's no-turn-limit-fail gives an eliminate_all mission a lot of runway).

Full narrative: archive, "batch 3 built — missions 17-20," "Mission 18's pincer" section.
