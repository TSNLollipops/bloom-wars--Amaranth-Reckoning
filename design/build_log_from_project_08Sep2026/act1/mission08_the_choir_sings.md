# Mission 8 — The Choir Sings

**Objective:** eliminate_all [Act I mid-boss]. **Map:** open killing field, ridge fringes, 22×13. **Enemy:** 4 Choir (new archetype debut) + 4 Crawlmass.

`bloom_choir` (`data/bloom.ts`) — the design doc's own Act I mid-boss, Sirenmaw-descended, `intelligence: "pack"` (load-bearing — inherits pack-coordination AI for free), tuned above Sirenmaw across the board (END 80→110, VIT 70→85, attackPower 25→32), new on-hit effect `fx_choir_dissonance`.

**A real spike, endorsed rather than nerfed:** the bot's own test run had all four Choir pack-focus Bosk for 27 damage each in one hostile phase, well over his HP, full wipe by turn 8. Flagged rather than quietly shipped — Maxime's own read: "that might just be whats need to teach player how unforgiving this game is... there some loss you gotta accept." No rebalancing done.

**This is where Taunt gates in** ("Meeps, mission 8 onward" — see `engine_systems/taunt_and_fire_support.md`). A forced point-blank test (Rourke and Lask both adjacent to a live spawn, taunted) confirmed all four Choir converge on the taunter exactly as designed — and downed her outright in that specific worst-case scenario (32×4 vs 105 HP), restock kicking in correctly. The real ceiling of a bad Taunt, worth knowing before playing it.

Full narrative: archive, "23 Aug 2026: missions 5-8 built" and "Mission 8 accepted, spacebar end-turn..." and "a correction, then Taunt."
