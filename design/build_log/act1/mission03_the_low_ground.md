# Mission 3 — The Low Ground

**Objective:** clear_bloom (win the instant no `bloom_mat` tile remains — replaced eliminate_all). **Map:** heavy bloom-mat terrain, 18×11 originally, enlarged +40-70% in the mission-length pass. **Enemy:** 8 Crawlmass + 2 Splitfang (unchanged throughout).

The objective-type origin point: Maxime, unprompted, proposed making bloom-clearing the actual objective rather than flavor. New Munti-only `abil_clear_bloom` (1-tile radius, 1 action, doesn't end turn, no per-mission limit — this is the mission's actual job). House rule #7 (`tickBloomRegrowth`) is this mission's own countervailing pressure, deterministic on turns 4/7/10/13.

**Playtested for real, tallied not acted on:** "mission 3 was fun, tho the bloom are weak. we will really have to lean on it as a swarm entity with various variety" — read as a composition signal (8-of-10 hostiles here are the entry-level Crawlmass), not a wave-size one. A separate self-assessment ("the only think it took a while was clearing the bloom and that was because I cant path well for shit") was deliberately NOT treated as a UX complaint — Maxime framed it as his own execution, not the controls.

**Bot result: 0/8, every run, even once the Player AI engine gained real clear_bloom awareness** (`clear_bloom=3` in a typical log, up from always-zero) — a genuine gap between "the bot now attempts the objective" and "the bot can actually win it." The Screen-ability heuristic built specifically to help this mission (see `engine_systems/ability_depth_and_targeting_ai.md`) turned out to almost never fire in this mission's actual flow — an honest null result, not a further fix. Root cause of the squad's actual losses, traced directly: ordinary attrition (two Crawlmass + a Splitfang ganging up on whoever's reachable), not an exposed-clearing moment specifically.

**Still open:** genuinely unresolved fork — either a real balance question, or the bot's tactical ceiling isn't enough for this mission. Not diagnosed further, matching the standing "more content first, tuning later" holding pattern. Human play (see above) suggests it's playable and not undertuned.

Full narrative: archive, "Mission 3's clear_bloom objective" (24 Aug), "first real playtest of Mission 3" and its pathing follow-up, "Screen gets a first, deliberately narrow heuristic" (25 Aug).
