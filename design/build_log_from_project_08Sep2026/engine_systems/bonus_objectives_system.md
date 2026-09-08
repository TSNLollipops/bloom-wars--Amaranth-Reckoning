# Bonus Objectives (`rescue_pilot`, `clear_bloom_patch`)

Started narrow (Mission 5's rescue, Mission 3's clear as its own real objective), generalized once both existed: "keep the rescue pilot and bloom patch thing around we are gonna use those as special objectif player can complete during mission for extra point."

`BonusObjective` (`data/types.ts`) is a discriminated union — `RescuePilotBonusObjective` / `ClearBloomPatchBonusObjective`, each with its own `bonusPoints`. `CampaignMission.bonusObjective` is a single optional field (one bonus per mission, of either kind) — the *kind* axis generalized, not the *count* axis; nothing so far has asked for more than one bonus per mission.

**Rescue:** a downed NPC (`createRescuableNpcUnit`, `path: "meeps"` for the dodge house rule) spawns on the board; any adjacent player unit can carry it to an exit tile (three-part shape mirroring Repair: `getRescuableFrom`/`canRescue`/`rescueUnit`). A carrying unit can't attack until it extracts or goes down. On success, `generateRandomRescuedPilot` rolls class+chassis independently (a coin flip on both axes — the only fully-random recruit path in the game) and adds the pilot to the bench.

**Clear bloom patch:** reuses `abil_clear_bloom` as-is (no new clearing code) — just adds completion tracking (`clearBloomPatchOutcome`) against the bonus's own `patchTiles` list. No "failed" state, unlike rescue — an uncleared patch is just "pending" if the mission ends first.

**Payout:** `computeBonusObjectivePoints`/`applyBonusObjectivePoints` (`engine/campaignEconomy.ts`) pay into the company pool, deliberately NOT gated on `mission.outcome === "win"` — a bonus is scored independent of the main objective's outcome.

**A real bug caught proactively:** `Mission`'s constructor originally held a bare reference to the shared `MAPS[mapId]` singleton — Clear Bloom was the first thing to ever mutate `map.tiles`, which would have let one Low Ground playthrough permanently rewrite the map for every future one in the same process. Fixed by cloning the tile grid in the constructor before any objective logic could expose it.

Full narrative: archive, "Mission 3's clear_bloom objective and Mission 5's rescue-and-recruit bonus objective" and "the bonus-objective system generalized," both 24 Aug 2026.
