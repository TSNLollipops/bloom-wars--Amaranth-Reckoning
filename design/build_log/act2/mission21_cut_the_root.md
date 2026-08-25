# Mission 21 — Cut the Root

**Objective:** eliminate_all [boss]. **Map:** dug-in root cluster, 26×15. **Enemy:** Bloom Heartwood (boss) + Undertow reinforcements, 2 burrowed, every 2 turns starting turn 3.

The Heartwood boss debut — first sessile archetype (`moveRange: 0`, 400 endurance), its own board-omniscient `emergentDecision()` AI tier, first mission to use a genuinely repeating `MissionEvent` (`repeatEvery: 2`, no new engine code needed — the event system already supported it).

**The real, still-open finding:** the squad's own Player AI never engages the boss at all. `focusFireTargetInRange`'s `focus_weak` heuristic (lowest HP × defense) always loses to the disposable low-HP Undertow reinforcements — the squad spends the whole mission mopping up reinforcements and never lands a real hit on the objective. Not fixed at the engine level (judged as deserving its own dedicated pass, not a one-off patch under this mission's own pressure) — mitigated at content level instead by removing the mission's opening Crawlmass escort wave, buying two clean turns against Heartwood before reinforcements start.

**Result:** ~60-70% across ~10 runs post-mitigation — accepted as reasonable "first proper boss" difficulty, explicitly flagged as a mitigation, not a fix. This same `focus_weak` gap is the reason Marrow (Mission 20/28) needed no such mitigation — she isn't competing against cheap disposable spawns the way Heartwood is.

Full narrative: archive, "batch 4 built — missions 21-24," Mission 21's own section.
