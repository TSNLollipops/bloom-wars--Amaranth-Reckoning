# THE BLOOM WARS — Master Index (Game Project)

*Last updated: 25 August 2026 — pointing this at reality after it was found stale in a different conversation, then updated again the same day to point at the new split build-log structure.*

**Scope note.** This project folder holds two entirely separate things: The Bloom Wars, a browser tactics game, and Qiraki, a book series. They share no canon obligations except two reserved names (see "Naming lock," below) and a handful of one-way lore borrows. This index covers the game project only — everything else in the project (all `Qiraki_*` files, `Rune_Patterning_Primer.md`, `Cross_Project_Writer_Note.md`) is book material and is indexed separately in `Qiraki_Master_Index.md`.

---

## READ THIS FIRST — current state, 25 August 2026

**This doc went stale and stayed stale for several days while the actual game moved on. If you're catching up on this project, start here, not with the "8 documents" table below.**

The game is no longer the original 4-mission Team One vertical slice the rest of this index describes. On 22 August 2026 Maxime decided to build the game around **The Amaranth Reckoning** exclusively — a self-contained, non-canon 36-mission campaign (new cast, new antagonist, same core engine/rules). Team One's 4-mission slice is archived in the repo, not deleted ("we might reuse them later"), but it is not what a player sees when they open the game today.

**Current build status, as of this session (25 Aug 2026):** all 36 missions of The Amaranth Reckoning are built, sim-tuned, tested, and delivered — Act I (Missions 1–12), Act II (13–24), and Act III (25–36, including the finale and its final boss "The Cradle"). The campaign is complete. On top of that, the live "mission commander down" fix landed the same day (Rourke reaching 0 HP now voids the mission attempt and returns the player to the briefing screen, rather than the old silent-restock bug — see `claude/build_log/engine_systems/permadeath_and_commander_down.md`).

**The real current-state sources, in order of trust:**
1. **`src/data/campaignAmaranth.ts`** (in the repo) — the actual shipped mission data. This is ground truth; nothing else can contradict it.
2. **`claude/build_log/README.md`** — the build history, split by act/mission/engine-system for navigability (see that file's own index). This is the doc to read for "what's actually done and how it was tuned," mission by mission or system by system. The original single-file running log, `claude/Bloom_Wars_Amaranth_Act1_Build_Log_v1.md`, is preserved unedited as the full chronological narrative archive (through Batch 7 / campaign complete) — the split structure is a synthesized index into it, not a replacement of its content; read the archive when you want the exact blow-by-blow, playtest quotes, and every intermediate tuning attempt.
3. **`claude/Bloom_Wars_Independent_Campaign_The_Amaranth_Reckoning.md`** — the campaign's own design doc: the full 36-mission outline, roster, rival, the Bloom's three new named threats (The Choir, The Wellroot, The Cradle), the Heirloom pool, permadeath/Munti rules (§6a/§6b). Read this for *why* a mission is shaped the way it is.

The 8 documents below (GDD, Data Pack, Build Brief, Canon Pass) are **not wrong** — the core engine rules they define (the class triangle, chassis layer, meks, Collapse rule, the Bloom Bestiary category system, Severance) are all still in force and reused by the Amaranth campaign per that doc's own §1. What's stale about them is the *campaign content*: the 4-mission Team One slice, its roster, and its Mission 3 wipe are archived, not current. Read the 8 documents for shared systems and mechanics; read the three sources above for what mission content actually exists today.

---

## The 8 documents (original vertical-slice handoff — mechanics still live, campaign content archived)

| Doc | What it is |
| --- | --- |
| **Bloom_Wars_GDD_v0.2.docx** | The Game Design Document. Vision and scope, the class triangle, the chassis layer, the Meks system, the Heirloom (Severance), mission objective types, the *original* 4-mission vertical-slice campaign (archived), art direction, the scenario-editor plan, and a decision log. Still the right read for how the shared systems work. |
| **Bloom_Wars_Data_Pack_v0.1.docx** | Companion to GDD §14. Every number: type schema, unit archetypes, the original Team One roster and meks (archived), mek track effects, abilities, combat/damage tables, the 7 pre-rolled Bloom archetypes, hostile mechs, the original 4 maps/missions (archived), the points economy, and the balance simulation output. |
| **Bloom_Wars_Build_Brief_v0.1.docx** | The handoff / build instructions. Four non-negotiable rules (the spoiler lock is still absolute and still enforced by `tools/lint-spoiler.mjs`), a 12-step build order, the test plan, naming/file-layout conventions. |
| **Bloom_Wars_Canon_Pass_v1.docx** | Resolves open items in the three docs above against the Qiraki source files — the original Team One roster corrections, real gear-tier names, real Bloom colour families. The colour-family *system* (Canon Pass §E) is reused for the Amaranth campaign's own new Bloom threats; the roster-specific content is archived with Team One. |
| **README.md** | Explains the two original Python scripts (`combat_sim.py`, `maps.py`) used to validate the vertical slice's numbers and maps. Superseded in practice by the live `npm run sim` harness (`src/sim/run.ts`) and ad hoc per-batch map-generator scripts for the Amaranth campaign — see the build log. |
| **maps_generated.ts** | Auto-generated TypeScript for the original 4 validated maps (archived). |
| **sim_output.txt** | Console output of `combat_sim.py` — Data Pack §13 (archived numbers). |
| **maps_output.txt** | Console output of `maps.py` — the original map validation table (archived). |

*Reading order for the shared systems: GDD → Data Pack → Canon Pass → Build Brief. For current campaign content: the Independent Campaign doc → `claude/build_log/README.md` → `campaignAmaranth.ts` itself.*

---

## Locked decisions (for quick reference — still true for both the archived slice and the live Amaranth campaign)

Web-first (TypeScript + Vite + Phaser 3, Steam port later); Meks are Option B — passive, one per pilot, never on the board; class triangle is Meeps > Reeps > Tank > Meeps; full-HP damage cap of 90 (Severance is the sole exception); art is placeholder geometric shapes, not sprites. Mission 3's scripted extraction-failure wipe is a Team One-specific, archived beat — the Amaranth campaign uses a *live* permadeath rule instead (Independent Campaign doc §6a), not a scripted one.

## Naming lock (shared with the book project — the only real coupling)

One reserved term (defined in the Build Brief, deliberately not written in these docs — enforced by a build-failing lint rule, not a convention) must never appear anywhere in the game's code, comments, filenames, or UI strings. "The Synker Wars" — the book series' military-arc name — is separately reserved and also must not surface as a game-facing string. This applies to the Amaranth campaign's own content exactly as much as it did to Team One's — nothing about the naming lock is slice-specific.

## Cross-project references

The GDD and Data Pack pull one-way inspiration/verification from a few Qiraki documents (checked as of the 21 Aug canon pass — see that document for the full list: Military Era Outline, Bestiary, Bioterror Bank, Points Shop Catalog, Rune Tech Reference). They are **not** Bloom Wars files and remain indexed under `Qiraki_Master_Index.md`. The Amaranth campaign reuses the same Bestiary/Bioterror Bank systems (see the Independent Campaign doc §1, §8) rather than re-deriving them.

## Repo layout

Unchanged — see GDD §2.1 / README "Where they go". The live campaign's own mission/map data lives in `src/data/campaignAmaranth.ts` and `src/data/mapsAmaranth.ts`, parallel to (not replacing) `src/data/campaign.ts`/`src/data/maps.ts`, which hold the archived Team One slice.

## Build log structure (25 Aug 2026)

The build history is split for navigability: `claude/build_log/README.md` is the index, with `act1/`, `act2/`, `act3/` (one file per mission) and `engine_systems/` (one file per cross-cutting mechanic — Player AI, permadeath/commander-down, the mission clock, bonus objectives, civilian extraction, Taunt/Fire Support, ability depth/targeting AI, walking animation, squad/deploy structure, house rules). Each split file is a concise synthesis with a pointer back to the archive's own section for full narrative detail. The original single-file log, `claude/Bloom_Wars_Amaranth_Act1_Build_Log_v1.md`, stays in place unedited as the permanent archive — it's kept specifically for archival purposes even though it won't ship with the game, and nothing in the split structure removes or replaces it.
