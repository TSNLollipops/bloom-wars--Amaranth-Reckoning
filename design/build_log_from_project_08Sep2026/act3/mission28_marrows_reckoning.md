# Mission 28 — Marrow's Reckoning

**Objective:** eliminate_all. **Map:** bigger version of Mission 20's dueling ground. **Enemy:** `hostile_mech_marrow` fixed center + 4-trooper escort (turn 1), 2 more troopers (turn 5) — 7 total, later 10 for the bigger squad.

Marrow's rival arc closes here. The §7 "she finally chooses who she actually serves" beat is delivered via a new `objective_complete`-triggered dialogue event, firing right after the win — not mid-fight. Deliberately not `unit_downed`-triggered: `remove_from_roster` is semantically built for a player-pilot extraction failure, wrong fit for a hostile side-switch; and separately, a hostile's exact runtime `instanceId` isn't something mission data can predict (shared counter across every unit a mission ever spawns), so no mission in this campaign has ever hooked a trigger to one. Stays a normal eliminate_all — no mechanical side-switch, confirmed the closure dialogue actually fires in a real sim log.

**Result:** 14/15 (~93%) on first pass, no retuning needed at 8-pilot squad. At 12-pilot Act III squad, a third wave (2 more mechs at turn 8, 10 total) was added to keep the finale-adjacent fight meaningful; retested clean.

Full narrative: archive, "batch 5 built — missions 25-28" and "Act III scope confirmed... retuned against the bigger roster," Mission 28's own section.
