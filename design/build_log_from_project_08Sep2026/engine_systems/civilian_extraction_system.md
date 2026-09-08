# Multi-Civilian Escort/Extraction

Debuted Mission 31 ("The Last Convoy," "not everyone gets out"), built as a genuinely reusable system rather than a one-mission special case — same discipline as every other cross-cutting system in this file.

**Why not just more `extract_unit` targets:** civilians can't be referenced by a predictable runtime `instanceId` (the same reason Mission 28's own header comment gives for never hooking a `unit_downed` trigger to a hostile's id — `nextInstanceId` is one counter shared across everything a mission ever spawns).

**Shape:** `CampaignMission.civilianSpawns?: {at, displayName}[]` (positions + names only, no ids) and `objectiveParams.extractThreshold?` (defaults to "everyone"). `createCivilianUnit()` mirrors the existing `npcIncapacitated` precedent — `side: "player"` (real threat target for hostile AI, no fake immunity), `isCivilian` flag excludes it from squad-wipe tallies, click-to-select, and the sim's player-autoplay loop. `decideCivilianAction()` is its own tiny AI: flee any visible hostile, else path to the nearest exit — "one scared person's own instinct, not a squad's," deliberately not reusing `moveHostile()` (which would wrongly trigger Overwatch/Interdiction reactions on a friendly).

**Two real bugs found before shipping, both fixed the same day:**
1. `moveAwayFrom`'s flee logic maximized distance from threats with zero notion of *which direction* was safe — civilians sprinted to the map's far corner and got stranded. Fixed to prefer any tile at least as safe as the current one, biased toward the exit, with true panic-mode (accept less safety) only when actually boxed in.
2. The map itself deployed the squad next to the exit with the convoy stranded at the far end — an escort mission needs the escort to start next to what it's escorting. Fixed at the map source.

`checkWinLoss` gets threshold math: win at `extracted >= threshold`; lose the instant the threshold becomes mathematically unreachable (`extracted + stillAlive < threshold`), or on turn limit otherwise. 14 new regression tests (`civilianExtraction.test.ts`), including a direct check that civilian movement never triggers a nearby player unit's held Overwatch.

Full narrative: archive, "Batch 6, 25 Aug 2026... the new system: multi-civilian escort/extraction" and its "two real bugs" section.
