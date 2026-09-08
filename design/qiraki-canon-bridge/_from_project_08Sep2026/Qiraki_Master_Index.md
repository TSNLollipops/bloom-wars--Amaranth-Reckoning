# THE QIRAKI FILES — Master Index

*Part of the Qiraki files. This is the file that names every other file: what it is, what tier it sits at, what it owns, and where it defers. Its whole job is making file drift and stale duplicates visible before they cause a silent contradiction, per §7 below.*

**RECONSTRUCTION NOTICE, 2026-08-21.** This file was confirmed absent from the working project folder this session. It is not recovered from a backup, it's rebuilt from the citation trail other files left behind (BIBLE, POL, QUEUE, LENS all quote or reference specific IDX sections). Where content below is a direct quote or a near-exact reconstruction of cited text, it's marked **[RECOVERED]**. Where I've had to infer structure that wasn't directly quoted anywhere (mainly Tier assignments for files nobody happened to cite by ID), it's marked **[CLAUDE, first pass]**, same provenance convention Qiraki_Book7_Chapter_Outline_v40.md already uses. Treat every [CLAUDE] tag as something to eyeball and correct, not as decided.

**Best evidence on when it went missing:** last confirmed live edit is DEF-25, 2026-08-12 (Political Web pass, POL Tier-1 row added). DEF-26 the next day (2026-08-13) caught Concept.md, Bible Skeleton, and Physical Description Bank all independently drifting out of the folder in that same window and logged each as a restore. This file never got a matching restore entry, nothing was cross-checking it against itself, so its own disappearance is the one instance of the failure it exists to catch.

## Revision changelog

*Most recent entry first.*

**2026-08-21 — POL cleanup, one more stale item found in QUEUE along the way.** Qiraki_Political_Web.md's POL-DEF-D, E, F reviewed against current files, not assumed: D and F fully resolved (IDX has its POL row; Concept's Osnius entry checked directly, bear-adjacent, contradiction gone). E partially resolved, the stale-annotation defect is fixed but the underlying "not yet absorbed into Bible" gap is real and already tracked in Bible itself. While checking POL-DEF-B, found Qiraki_Defect_Queue.md's own DEF-23 marked "Still open" a full day after Qiraki_Book7_Chapter_Outline_v40.md recorded it as ruled and closed 2026-08-20, the exact bug this file exists to catch, now inside QUEUE itself. Fixed in both files. POL-DEF-C checked and confirmed still genuinely open, 10 em-dash instances still present in Qiraki_Propaganda_Bank.md, untouched.

**2026-08-21 — Full audit pass: missing-file check, self-registration gap closed, one regression caught and fixed.** No files missing, registry now matches folder exactly (was off by one, IDX wasn't registering itself, fixed below). Two real problems found and fixed: (1) BIBLE's §8 chapter-ID sweep had been silently lost when the standing-check edit was applied to a stale local copy instead of the swept one, 12 instances reverted to old format, re-applied and verified. (2) LENS (Qiraki_Character_Lens_Reference.md) was never included in the original 18-file sweep, a file-discovery regex required BkN with no space and missed this file's Bk N (spaced) instances, 4 conversions applied now. Also flagged, not yet fixed, author call: Qiraki_Political_Web.md's own POL-DEF-D, E, and F all appear resolved by later work (IDX has its POL row, BIBLE is current through 2026-08-20, Concept's Osnius contradiction is fixed) but aren't marked resolved in POL itself, same stale-annotation pattern as BIBLE's original DEF-09 bug, now in a third file.

**2026-08-21 — §9 added, IDX now has two standing watchers.** QUEUE and BIBLE both got a one-line standing check added this session: confirm IDX is present and current before closing a session, log a new DEF if not. See §8. Neither file takes ownership of IDX, both just check.

**2026-08-21 — §8 Chapter ID convention locked, project-wide sweep completed.** B{book}.CH{2-digit} locked as the standard, see §4. 136 instances of the two competing formats converted across 18 files, zero left unconverted, verified. Full detail in §4, not duplicated here.

**2026-08-21 — All three reconstruction-pass issues closed, same day.** ISSUE A: Qiraki_Chapter_Index.docx (no-suffix) removed by author, Qiraki_Chapter_Index_v2.docx now the sole CHIDX file. ISSUE B: Qiraki_Book7_Chapter_Outline.docx (stub) removed by author, Qiraki_Book7_Chapter_Outline_v40.docx now the sole OUTLINE-7 file. ISSUE C: BIBLE's stale DEF-09 bullet deleted from its own Needs-a-decision list, logged in BIBLE's own changelog rather than duplicated here. Registry below updated to match, both files' Tier 2 entries no longer carry a duplicate flag. Working folder now 45 files.

**2026-08-21 — Full reconstruction after confirmed missing.** See notice above. Registry rebuilt for all 46 files then in the working folder. Three unlogged file-drift issues found during reconstruction, tallied in §3, author call on each.

## Tier system **[CLAUDE, first pass — confirm or correct]**

- **Tier 1 — Core canon & governance.** Facts, precedence, standing rules. Contradicts something here, something else is wrong.

- **Tier 2 — Structural / planning.** Chapter-by-chapter shape: outlines, indices, the expansion plan, the build protocol, the cross-book audit.

- **Tier 3 — Specialized reference layers.** Systems and craft support docs, each owns one domain (species, gear, tech grammar, propaganda, curricula).

- **Tier 4 — Drafted prose.** What's actually been written.

- **Tier 5 — Process / session log.** Working notes, spoiler lock, cross-project discipline. Not canon, governs how canon gets made.

## 1. File registry

### Tier 1 — Core canon & governance

| ID | File | Owns |
| --- | --- | --- |
| BIBLE | Qiraki_Bible_Skeleton.docx | Canon once organized: timeline, cast, world mechanics. Authoritative over CONCEPT on anything already folded in. |
| CONCEPT | Qiraki_Concept_v4.docx | Prototyping layer. Authoritative on raw material BIBLE hasn't absorbed yet. |
| POL | Qiraki_Political_Web.docx | Institutional address: factions, governance structure. Registered Tier 1, DEF-25. |
| CAST | Qiraki_Character_Sheets_v5.docx | Locked character canon, the baseline every other file's character mentions defer to. |
| STYLE | Qiraki_Master_Style_Guide_v2.docx | Prose mechanics, voice, craft discipline. Wins over BIBLE on *how* something's written; BIBLE wins on *what happened*. |
| IDX | Qiraki_Master_Index.docx | This file. Registers every other file, tier, ID, and status. Watched by QUEUE and BIBLE, per §8. |
| LOCKS | Qiraki_Session_Locks_Addendum.docx | Session-by-session locked decisions, staging area before a lock gets folded into BIBLE proper. |
| QUEUE | Qiraki_Defect_Queue_v2.docx | Every open DEF/DEC item and its resolution history. The project's own memory of what's already been decided. |
| PROC | Qiraki_Process_Notes.docx | Spoiler lock (Qiraki reveal), working-relationship rules, standing craft flags. |

### Tier 2 — Structural / planning

| ID | File | Owns |
| --- | --- | --- |
| CHIDX | Qiraki_Chapter_Index_v2.docx | Flat chapter lookup, Books 1–6, regenerated from the outlines. |
| EXPAND | Qiraki_Book_Expansion_Plan_v2.docx | Trope-callback tracking, chapter/act math. (Cited elsewhere as PLAN.) |
| BUILD | Qiraki_Chapter_Build_Protocol.docx | The actual chapter-drafting procedure. |
| AUDIT | Qiraki_Path_Audit_Books1-6.docx | Cross-book consistency audit. |
| OUTLINE-1 | Qiraki_Book1_Chapter_Outline_v3.docx | Book 1 beat-by-beat. |
| OUTLINE-2 | Qiraki_Book2_Chapter_Outline.docx | Book 2 beat-by-beat. |
| OUTLINE-3 | Qiraki_Book3_Chapter_Outline.docx | Book 3 beat-by-beat. |
| OUTLINE-4 | Qiraki_Book4_Chapter_Outline.docx | Book 4 beat-by-beat. |
| OUTLINE-5 | Qiraki_Book5_Chapter_Outline.docx | Book 5 beat-by-beat. |
| OUTLINE-6 | Qiraki_Book6_Chapter_Outline.docx | Book 6 beat-by-beat. |
| OUTLINE-7 | Qiraki_Book7_Chapter_Outline_v40.docx | Book 7 full 54-chapter outline, promoted out of stub. |
| MIL | Qiraki_Military_Era_Outline_v3.docx | Books 8+ (military/political era) outline. |

### Tier 3 — Specialized reference layers

| ID | File | Owns |
| --- | --- | --- |
| LENS | Qiraki_Character_Lens_Reference.docx | Per-character POV/perception filters, 18 lenses. |
| DESC | Qiraki_Physical_Description_Bank.docx | Species and per-character description-variance register. |
| EMOTION | Qiraki_Emotion_Craft_Reference_md.docx | Emotion-craft theory. Two entries (Rules 10–11) already promoted into STYLE; this file now points back rather than duplicating. |
| TERM | Qiraki_Technobabble_Glossary_v2.docx | In-universe terminology, canonical spellings. |
| RUNE | Qiraki_Rune_Tech_Reference.docx | Rune-tech grammar and theory. |
| RUNEPRIM | Rune_Patterning_Primer.docx | Rune-patterning on-ramp / teaching layer. |
| COMBAT | Qiraki_Combat_Curriculum_Reference_RECOVERED_v4.docx | Combat class curriculum. |
| ENG | Qiraki_Engineering_Curriculum_Reference_v2.docx | Engineering curriculum. |
| WEAP | Qiraki_Weapons_And_Progression.docx | Trav's weapon path and gear progression logic. |
| SHOP | Qiraki_Points_Shop_Catalog.docx | Points-shop tiers and catalog. |
| PROP | Qiraki_Propaganda_Bank_RECOVERED.docx | Propaganda-fragment bank and frequency rule. |
| BEST | Qiraki_Bestiary.md | Bloom biology / creature reference. |
| PRESERVE | Qiraki_Preserve_Species.md | Preserve-system species reference. |
| BIOTERROR | Qiraki_Bioterror_Bank_v2.docx | Bioterror mechanics reference. |
| COSMO | Qiraki_Cosmology_And_Spread_Math_v1.docx | Bloom/Qiraki/Coalition cosmology, spread arithmetic. |
| VISUAL | Qiraki_Visual_Reference_Bank.docx | Visual reference material. |

### Tier 4 — Drafted prose

| ID | File | Status |
| --- | --- | --- |
| B1CH1 | Qiraki_Book1_Chapter1_v4.docx | **Canonical.** "Arrival," confirmed by author 2026-08-14 (DEF-09). |
| B1CH1-ALPHA-1 | Qiraki_Book1_Chapter1_ALPHA_v1.docx | Archival only. Self-labeled non-canonical, superseded. |
| B1CH1-ALPHA-2 | Qiraki_Book1_Chapter1_ALPHA_v2.docx | Archival only. Self-labeled non-canonical, superseded. |
| B1CH2 | Qiraki_Book1_Chapter2_v23.docx | "The First Pattern." |
| B1CH3 | Qiraki_Book1_Chapter3_v14.docx | "The Standard Message." |
| B1CH4 | Qiraki_Book1_Chapter4_v20.docx | "First Contact," Friday-only flesh combat per the mech-debut move to Ch.7. |

### Tier 5 — Process / session log

| ID | File | Owns |
| --- | --- | --- |
| LOG | Qiraki_Outline_Update_Log.docx | Session-by-session outline change log. |
| ESIM | Qiraki_Emotional_Simulation_Check.docx | Emotional-simulation verification passes. |
| XPROJ | Cross_Project_Writer_Note.docx | Cross-project craft lessons ported from The Ninth. Technique only, never voice or rules, per PROC. |

## 2. Duplication-hotspot table

*Where two files' domains genuinely overlap. Not a defect list, a watch list.*

| Files | Overlap | Current discipline |
| --- | --- | --- |
| BIBLE / POL | Faction material | BIBLE owns characterization, POL owns institutional address. Currently disciplined, flagged to watch. |
| BIBLE / CONCEPT | Everything not yet organized | CONCEPT is prototyping, BIBLE is fact once folded in. Resolved 2026-08-06, DEC-01. |
| STYLE / BIBLE | Anything both touch | STYLE wins on how it's written, BIBLE wins on what happened. |
| STYLE / EMOTION | Character emotional tells (Rules 10–11) | Promoted to STYLE, EMOTION carries only a pointer back. Single authoritative copy. |
| **[CLAUDE, first pass]** COMBAT / WEAP / SHOP | Gear and combat progression | Not yet audited this pass for actual overlap. Flagging as a plausible hotspot given "gear reflects character" is a cross-cutting rule (PROC), not confirmed drifting. |

## 3. Known file-state issues, this reconstruction pass

*Currently clean. Three issues found at reconstruction, all closed same day, per this file's own §7 rule: resolved items get deleted from the open list, not left here annotated. Full history in the changelog above.*

## 4. §8 — Chapter ID convention **[AUTHOR, locked 2026-08-21]**

Standard form for citing a specific chapter from any file: **B{book}.CH{chapter, zero-padded to 2 digits}**, e.g. B1.CH04, B7.CH54. Ranges keep the dash, book prefix on the first number only: B2.CH21-22.

Before this lock, three formats were live in the wild simultaneously: B1.CH08 (5 uses, QUEUE/BUILD), Bk1 Ch.4 (the majority, BIBLE/CONCEPT), and Book 1 Ch. 4 (long form, scattered). B1.CH08 won because it was already the pattern in the two files whose whole job is being looked up fast.

**Swept 2026-08-21, same session as the lock: 136 instances converted across 18 files.** BIBLE (12), CONCEPT (11), QUEUE (12), all 7 book outlines (10 total), BUILD (1), CAST (5), ESIM (5), STYLE (1), LOG (30), AUDIT (46), PROP (1), RUNE (1), LOCKS (2). Verified zero instances of either old format remain anywhere in the folder. No content changed, format only, chapter titles and surrounding prose untouched. Not version-bumped on the individual files, this was a formatting pass, not a canon or craft decision.

**Applies going forward:** any new chapter citation in any file uses this form from here on. Plain Ch. 12 inside a book's own outline, referring to itself, is unaffected, this convention is for cross-file citation only.

## 5. §5 — Header block standard **[CLAUDE draft, pending author confirm — DEF-18 has flagged this unbuilt since 2026-08-06]**

Every Tier 1–3 file should open with a one-line block directly under its title:

*IDX: [ID] · Tier [N] · Owns: [one clause] · Defers to: [ID or "none"] · Updated: [date]*

This is the cheap defense DEF-18 and DEF-19 both point at: a file that states its own ID and last-update date is a file that's easy to cross-check against this index instead of drifting silently. Not yet applied to any actual file. Applying it is mechanical once you confirm the format, flag if you want it done as its own pass.

## 6. §7 — Stale open-item rule **[RECOVERED]**

A resolved open item gets deleted from the open list it lived in, not annotated as resolved in place. History belongs in the resolving file's own changelog (usually QUEUE), not as a dead bullet in the list that raised it. This is the rule that caught BIBLE's stale DEF-09 bullet at reconstruction, see changelog above.

## 7. Regeneration rule

Like CHIDX, this file is derived from what actually exists in the folder, not hand-authored canon. Regenerate rather than hand-edit whenever a file is added, renamed, retired, or promoted out of stub/draft status — and drop the superseded copy in the same pass, don't let it sit alongside the new one (see §3 for what happens when that step gets skipped).

## 8. §9 — Who watches IDX **[AUTHOR, locked 2026-08-21]**

This file doesn't watch itself, that's what made its own disappearance invisible for a week. Two files now carry a standing check instead of one: **QUEUE**, because it's touched almost every session and is the natural home for catching drift generally, not because IDX belongs to it; and **BIBLE**, redundantly, because it gets opened at the same book-worth-of-new-material sessions IDX does, and because BIBLE, CONCEPT, and DESC all drifted out the same week IDX did, so one watcher in that same fragile folder isn't enough. Neither file owns IDX. Both just check it's still there before closing a session. Full text of both checks lives in QUEUE's opening rules and BIBLE's precedence note, not duplicated here.
