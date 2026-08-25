# Taunt and Fire Support — the two manual, mission-gated abilities

Both deliberately never used by the Player AI engine (see that file's "known limitations") — both are player-judgment tools, and a wrong automated heuristic for a once-per-mission resource was judged worse than never using it.

## Taunt (`abil_taunt`, Meeps, Mission 8 onward)

Maxime: "the taunt would have been made specifically for meep to save the munties in case of emergency." A considered, honest rejection of the WoW-threat-meter alternative — a simple "check this flag first" trick (already used for Munti-priority targeting) gets the identical guaranteed-redirect result for far less surface area than a general threat system.

Until the taunting unit's own next turn, every hostile targeting tier (reflexive, pack, mech, emergent) picks it first when choosing among already-visible targets — ahead of Munti-priority, ahead of pack's shared weakest-target pick. Does not grant visibility on its own (a hostile that can't see the taunter is unaffected) — a positioning tool, not a shout-across-the-map one. No defensive bonus, on purpose: a downed Meeps just restocks; a downed Munti doesn't have the same mid-campaign safety net.

**Mission-gating is genuinely new plumbing:** nothing tracked "which mission number is this" before this. Rather than add that tracking, the grant lives on mission data itself — `CampaignMission.bonusAbilityUnlocks: {path, abilityId}[]`, applied at deploy time, layered onto a path's normal kit without mutating the shared archetype array. Mission 8 carries the Meeps/Taunt entry; each later mission needs the same entry copied on, by design (not generalized further until that gets tedious).

## Fire Support / Meridian's Oath (`abil_fire_support`, Mission 14 onward, re-fluffed as "Meridian's Oath" from Mission 25)

A shared, squad-wide resource (2 charges per mission, one counter on the `Mission` itself, not per-unit — the fiction is one ship overhead, not a personal ability). Flat 60 damage, bypasses the normal attack/defense formula, hits every living hostile in a 3×3 box around the called-in tile.

**The real build:** the targeting UI. This is the first ability in the game that isn't "resolve on the caster" or "click an already-highlighted adjacent unit" — it's arm-then-click-a-tile. New `fireSupportTargeting` state in `Battle.ts`, a priority branch at the top of `handleBoardClick`, a sky-blue tile wash over the caster's vision range while armed. One real clobbering bug caught before ship: `recomputeSelectionHighlights()` was overwriting the just-armed empty highlight arrays in the same frame — fixed with an early-return guard. A second bug, unrelated: the action bar's 4-slot grid would have silently truncated a 5th/6th ability off any Munti chassis with a full kit — expanded to 6 slots before Fire Support could ever hide behind it.

Full narrative: archive, "a correction, then Taunt" and "batch 5... Meridian's Oath" and "batch 2... Fire Support."
