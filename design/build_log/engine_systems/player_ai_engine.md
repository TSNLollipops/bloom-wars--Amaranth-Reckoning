# The Player AI Engine (`src/sim/playerAi/`)

Maxime: "make it a separate engine we can plug into our future games... something we can reuse like the characterisation formula." Replaced the old flat `src/sim/testPlayerAi.ts`. Structure: `types.ts` (shared shapes), `combat.ts` (kill/focus-fire/retreat/kiting/cohesion/terrain), `support.ts` (repair decisions), `index.ts` (priority chain: kill > critical repair > retreat/hold > routine repair > focus fire > advance > seek fight, plus objective branches — see below).

## What it does today

- **Combat basics** — kill-if-lethal, focus fire on a squad-shared weakest target (not per-attacker), retreat/kiting at low HP, repair (heal-in-place, two HP thresholds).
- **Squad cohesion** — `cohesiveMoveToward` caps how far a unit advances ahead of its nearest living ally; a wounded, unspotted unit with nothing to kill/heal regroups toward the squad instead of chasing alone. Fixed a real oscillation bug (retreat/seek_fight ping-ponging) and a real infinite-regroup stall along the way.
- **Terrain/cover** — reachable-tile scoring folds in `defenceStars` as a tiebreaker (tuned down 5-10x from its first cut, which was strong enough to fight the cohesion fix).
- **Objective awareness** — reads a narrow `PlayerAiMissionContext` (objective, extractUnitId, bonusObjective kind, holdZone, exitTiles) and branches: beeline for an exit while carrying a rescue; pick up an adjacent uncarried rescuable NPC; clear bloom for a Munti on a clear-bloom objective/bonus (with a first `use_screen` heuristic layered on top, though it turned out to rarely actually fire in practice — see the Screen note below); path to the exit for the named `extract_unit` target; converge on the nearest hold-zone tile for `hold_zone`; escort convergence on the exit once nothing better is left to do (`escort_to_exit`, fixes a real deadlock where idle escorts froze and boxed in the extract target).
- **Civilian awareness** — none; civilians run their own separate `decideCivilianAction` (see `civilian_extraction_system.md`), not this engine.

## Known, un-fixed limitations (flagged repeatedly, not silently)

- **No ability usage.** Ambush/Interdict/Screen/Sensor Sweep/Taunt are all real, shipped verbs the bot never uses (Screen got one narrow, rarely-firing heuristic — see Mission 3's file). A wrong heuristic for a charge-limited ability was judged worse than an honest zero.
- **`focus_weak` has no notion of "this is the boss."** Surfaced hard on Mission 21 (Heartwood) — the bot always deprioritizes a tough, low-priority-by-the-formula boss in favor of cheap reinforcement kills. Mitigated at the mission-content level each time it recurs, never fixed at the engine level.
- **No real detour-seeking.** `cohesiveMoveToward`'s distance-field search is terrain-only and greedy — several idle units standing shoulder-to-shoulder can still wall off a narrow approach even with occupied-exit-tile awareness (Mission 23; recurred at squad-scale on Mission 26).
- **The sim is not a difficulty oracle.** Multiple missions (3, 5) went 0% under the bot and were cleared easily by Maxime playing for real — the bot's flat, reactive heuristics have a real tactical ceiling below "protect the fragile unit before it's critical," not a balance problem with the mission.

Full narrative: archive, the four "Player AI engine" / "squad cohesion" / "terrain/cover, focus fire" / "objective awareness" addenda, all dated 25 Aug 2026.
