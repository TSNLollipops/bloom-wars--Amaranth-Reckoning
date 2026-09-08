# Project Knowledge Archive — 8 September 2026

**Read this before concluding a doc "doesn't exist."** On 8 September 2026 the project knowledge store hit 82% of its 2,000,000-unit cap. 218 of its 347 documents were copied to Maxime's PC and removed from project knowledge. 129 remain here. The store now sits at 867,934 units, **43.4%**.

Nothing was lost. Everything removed is on the F: drive, in two forms: loose readable files, and a complete zip of all 347 docs as they stood that day.

## Where it went

All paths below are under `F:\The Bloom wars. Code project\bloom-wars\bloom-wars\design\`.

| What | Where on disk | Count |
| --- | --- | --- |
| Complete snapshot of all 347 docs, original project paths preserved inside | `_project_knowledge_archive\Bloom_Wars_project_knowledge_snapshot_08Sep2026.zip` | 347 |
| Index of that zip — every filename and byte size | `_project_knowledge_archive\README_project_knowledge_snapshot_08Sep2026.md` | — |
| Every `Bloom_Wars_Build_Log_Addendum_*` plus `Bloom_Wars_Amaranth_Act1_Build_Log_v1.md` | `_project_knowledge_archive\build_logs\` | 93 |
| Morning reports, sync notes, sitreps, playtest notes, superseded plans, generated script output | `_project_knowledge_archive\housekeeping\` | 28 |
| The `claude/build_log/` tree — act1-3 mission records, engine_systems, README | `build_log_from_project_08Sep2026\` | 52 |
| All Qiraki book-series docs | `qiraki-canon-bridge\_from_project_08Sep2026\` | 45 |

## Two things a future session needs to know

**The `build_log` copies that were in the project were newer than the ones already in `design\build_log\`.** Nine files differed and two (`engine_systems/missile_splash.md`, `engine_systems/needs_counter.md`) existed only in the project. The fresher project versions went into `build_log_from_project_08Sep2026\` rather than overwriting `design\build_log\`, so both are intact and nothing was clobbered. **These two folders have not been reconciled.** When the build log matters, read `build_log_from_project_08Sep2026\` — it is the newer of the two. Merging them is an open job.

**The Qiraki copies that were in the project were newer than the ones in `design\qiraki-canon-bridge\`.** The project carried `Qiraki_Concept_v4.md`, `Qiraki_Character_Sheets_v5.md` and similar version-suffixed files; the canon-bridge folder holds unsuffixed, older ones. The newer set went into `_from_project_08Sep2026\` beside them, again without overwriting. **Also not reconciled.** For Qiraki canon, the `_from_project_08Sep2026\` subfolder is the newer set.

## What was kept in project knowledge, and why

The four canonical source docs (`Bloom_Wars_GDD_v0.2.docx`, `Bloom_Wars_Data_Pack_v0.1.docx`, `Bloom_Wars_Canon_Pass_v1.docx`, `Bloom_Wars_Build_Brief_v0.1.docx`), the four-file index set (`Master_Index`, `Foundation`, `Now_And_Next`, `History` plus the frozen `History_Aug2026`), every live plan and proposal, every codex entry set, every line and voice bank, and the campaign and system design docs.

The removals were history and duplicates: session build logs whose outcomes are already summarized in `Bloom_Wars_History.md`, per-mission records duplicated on disk, dated status notes for work that has shipped, one superseded copy of the consolidated build plan (147KB, 96% of it present in the newer 2 Sep copy), the 21 August master index the four-file router replaced, and three regenerable script outputs.

## Rule of thumb going forward

The store fills at roughly 1 unit per 3.7 bytes of document text. At the pace of early September — a build log per session, several per day — it climbs about 2% a week. Archiving build logs to disk once a month, rather than waiting for the cap, keeps this from becoming an emergency. `Bloom_Wars_History.md` is what makes that safe: it is the summary that lets the raw logs leave.
