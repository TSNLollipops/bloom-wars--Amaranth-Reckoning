# Mission 5 — Foraging Party

**Objective:** extract_unit (Anand). **Map:** wrecked supply depot, deploy west / exit east, 22×13. **Enemy:** 6 Crawlmass + 2 Splitfang. **Bonus:** rescue_pilot (Foraging Party is the objective type's own origin mission).

The rescue mechanic's debut — a downed NPC pilot, picked up by any adjacent unit, escorted to an exit, rolling a fully-random class+chassis recruit on success. See `engine_systems/bonus_objectives_system.md` for the mechanic itself.

**Two real balance/geometry bugs, found from an actual bad playtest ("couldnt save the downed pilot. he got completely shredded fast"):**
1. **Stat amplification** — the NPC's original `effectiveDefense: 70` wasn't "10% squishier," it was a 1.43× damage-taken multiplier under this engine's `100/effectiveDefense` formula, on top of `currentHp: 50`. A single un-dodged Splitfang hit could nearly one-shot him. Toughened to `effectiveDefense: 100` / `70 HP` (Maxime's chosen fix, tried before the geometry option).
2. **Spawn-distance, the bigger cause** — found later while re-checking, not assumed fixed: `npcSpawnAt` was 13 tiles from deploy, guaranteeing an entire undefended hostile phase before any player unit could arrive, regardless of toughness. Moved to `{x:6, y:6}`, close enough for a fast unit to reach in one turn.

**Bot result: 0/16, even after both fixes** — the objective-aware Player AI never breaks 0% here. **Real result: Maxime played it and won, "easy enough."** Direct confirmation this was a bot-tactical-ceiling problem, not a balance one — the same pattern later repeated on Mission 3's Screen finding. No mission rebalancing done off the sim number.

Full narrative: archive, "Mission 5's rescue was near-unwinnable" and "Mission 5's real spawn-distance bug" (both 25 Aug), plus "Mission 5 played for real" confirming the human result.
