# Bloom Wars — Build Log Index

**What this is.** The Amaranth Reckoning's build history, split for navigability: one file per mission (grouped by act), plus one file per cross-cutting engine system that isn't about any single mission. Each file is a concise synthesis — spec table, what actually happened (bugs found, design calls made), and the final sim-tuned numbers — not a verbatim copy of the original addenda. Full blow-by-blow narrative (exact playtest quotes, full bug traces, every intermediate tuning attempt) lives in the archive; every mission/system file below points at the archive section that covers it.

**Why split.** The original running build log (`claude/Bloom_Wars_Amaranth_Act1_Build_Log_v1.md`) grew to ~40 addenda across 36 missions and is now too large to safely rewrite in one pass (Project docs have no in-place patch — a full rewrite is the only edit, and at this size that's a real risk of truncating real history). Splitting by act/mission/system keeps each file small, means updating one mission doesn't touch 35 others, and makes "what's the state of Mission 17" a one-file lookup instead of a search through a 500KB document.

**The archive.** `claude/Bloom_Wars_Amaranth_Act1_Build_Log_v1.md` is preserved exactly as it was — the complete, unedited chronological narrative through Batch 7 (campaign complete at 36/36) plus the Taunt/Fire Support/Player-AI/mission-clock/civilian-extraction passes. `claude/Bloom_Wars_Build_Log_Addendum_CommanderDown_25Aug2026.md` covers the one addendum written after that (the commander-down fix) — its content now also lives in `engine_systems/permadeath_and_commander_down.md` below. Neither archive file gets edited going forward; new work goes into this split structure instead.

**Ground truth reminder** (same as the Master Index): `src/data/campaignAmaranth.ts` is the actual shipped mission data and outranks every doc, including this one, if they ever disagree.

## Cross-cutting engine systems

Not tied to one mission — read these for how a shared mechanic works, then check the specific mission file for how it landed there.

| File | Covers |
| --- | --- |
| `engine_systems/house_rules.md` | The 7 numbered house rules (no turn-limit fail on eliminate_all, Meeps dodge, etc.) |
| `engine_systems/permadeath_and_commander_down.md` | Live permadeath (§6a), the Munti guarantee, and the 25 Aug commander-down fix |
| `engine_systems/mission_clock.md` | The 12-hour real-time recall (BEAM DOWN → Boot.ts enforcement) |
| `engine_systems/player_ai_engine.md` | `src/sim/playerAi/` — combat, repair, objective awareness, cohesion, terrain/cover, focus fire, known limitations |
| `engine_systems/bonus_objectives_system.md` | The generalized `rescue_pilot` / `clear_bloom_patch` bonus-objective framework |
| `engine_systems/civilian_extraction_system.md` | Multi-civilian escort/extraction (debuted Mission 31, reusable) |
| `engine_systems/taunt_and_fire_support.md` | Both manual, mission-gated abilities (Meeps Taunt from Mission 8; Fire Support/Meridian's Oath from Mission 14) |
| `engine_systems/ability_depth_and_targeting_ai.md` | Ambush/Interdict/Screen/Sensor Sweep, hostile-mech Munti-priority, the protect_asset defendZone fallback fix |
| `engine_systems/walking_animation.md` | Tween-based unit movement + the input-lock-during-move feature |
| `engine_systems/squad_and_deploy_structure.md` | Act I/II/III deploy caps, Second Lance, Third Lance, squad composition |

## Act I — The Fallow Line (Missions 1–12)

See `act1/act1_overview.md` for roster, shared systems introduced, and the full mission table. Individual files: `act1/mission01_muster.md` through `act1/mission12_the_fallow_line.md`.

## Act II — Two Fires (Missions 13–24)

See `act2/act2_overview.md`. Individual files: `act2/mission13_new_colors_old_wounds.md` through `act2/mission24_two_fires.md`.

## Act III — The Last Ring (Missions 25–36)

See `act3/act3_overview.md`. Individual files: `act3/mission25_the_reckoning.md` through `act3/mission36_until_relief.md`. Campaign complete as of Batch 7 (25 Aug 2026).

## Still open (campaign-wide, carried from the archive's own closing notes)

The Heirloom pool (19 of 20 unbuilt, only Requiem implemented); the Wellroot reusing Heartwood's stat block rather than a distinct archetype; Command Fatigue/Stress-Morale (§6b); the mission clock's "social part" banter seeding (`socialHook` fields exist, nothing reads them); two Player AI limitations (no Ambush/Interdict/Sensor Sweep/general-Screen usage, and `focus_weak`'s cheap-target-over-boss bias); the "huge maps with a hidden allied squad" exploration idea (never designed); and Marrow's "disengage when losing" mechanic / the bait feature (both flagged, both unbuilt).
