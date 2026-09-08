# THE QIRAKI FILES — Outline Update Log, Books 1-6

*Part of the Qiraki files. Records what changed in the six chapter outlines during the reference-integration pass, and separates it cleanly into three categories: things carried in from docs that already locked them, things newly built, and things that contradict each other and were deliberately left for you to call. Format follows the Revision Changelog template in Qiraki_Bible_Architecture_Additions.md, which is itself still waiting to be merged into the Bible Skeleton.*

## The one-line version

Six new or expanded reference docs landed after the outlines were written. The outlines didn’t know about them. This pass folded them in, found one missing file, and found four real contradictions that need an author decision rather than a quiet fix.

## 1. The missing file

**There was no Book 5 chapter outline.** Books 1, 2, 3, 4 and 6 each had one. Book 5, “The Weight of It,” had only the act-level allocation in Qiraki_Book_Expansion_Plan.md. Book 1’s own open items claim “Books 2-6 now built at this same granularity, one file each, all 47 chapters, numbering verified by script,” which is not true and has been corrected there.

Qiraki_Book5_Chapter_Outline.md now exists, 47 chapters, same act split as every other book (12/11/13/11). Enough was genuinely locked across the other docs to build it: the spine and emotional target from the Expansion Plan, Year 5 entries in all three curriculum references, Ilyen’s reposition and Kest’s third appearance from the Character Sheets, four Year 5 fragment banks and the Tier 3 month themes from the Propaganda Bank, and the Munti equipment line from the Points Shop Catalog.

**Five items in it are marked PROPOSED and are suggestions, not decisions:** the Year 5 cooling component’s name, the enforced-rule trope’s in-book resolution, who first suggests Ilyen reposition, Study Session III’s subject, and Ilyen’s fourth tell. That last one matters most, the tells run Books 2 through 6 and the fourth is the only one not specified anywhere.

## 2. Decisions taken, author’s call

Four contradictions surfaced. Three were resolved directly and are now implemented. One remains open.

### 2a. When does the points shop open? RESOLVED

**Ruling: buying starts Year 1. Book 3 opens the path-specific catalogs.**

The split is by item type rather than by date. **Universal items are available from month 1-2 of Year 1**, the genetic/stimulant line and the power unit, since neither needs a path to exist. **Path catalogs (Meeps, Reeps, Tank, Munti) stay shut until specialization locks in Year 3.** Trav’s Stocklance is issued rather than bought, per the catalog’s own note, so his Year 1 weapon is unaffected.

This resolves the catalog’s cost bands against Book 3’s outline without either doc being wrong, and it improves Book 3’s Ch. 3 rather than just patching it: the chapter is no longer about a system switching on, it’s about four menus opening at once in front of cadets who just committed irreversibly to one of them, with real weight on what the other three lists contain.

**Implemented as:**

- B1.CH24 (“Faction Money”) gains **Quickstep** as a padding beat, G-tier at 150, first genetic upgrade in the cohort. Placed there deliberately so kids who bought their advantage with four months of combat points sit in the same chapter as a kid who didn’t have to. Neither the chapter nor any character connects the two. Chapter count holds at 47, no new chapter added.

- B3.CH03 rewritten to be the path catalogs opening.

- B3.CH07 retitled Quickstep to **Syncline** and re-tiered G to E, since Quickstep now lands three books earlier. Syncline is a better fit on merit as well as cost, it’s the first upgrade that changes how fast a cadet’s connective AI hands them information, and it lands in the same book where the symbiosis pain-spike starts coming through that same interface. The chapter should not remark on that.

- B4.CH07 (“Hotwire Money”) gains a chain note, it’s the fourth rung rather than the first.

**Resulting upgrade chain, one rung per book, matching the catalog’s bands:** Quickstep (Bk 1), Ironvein (Bk 1, a passing line rather than a beat), Syncline (Bk 3), Hotwire (Bk 4).

**Downstream consequence worth being explicit about:** the snowball starts compounding two years earlier than the outlines assumed, which means Book 2’s institutional-friction thread is landing on a cohort whose gear spread is already a year old. That makes the legacy-gear beat sharper, not weaker.

### 2b. Trav’s weapon endpoint. RESOLVED

**Ruling: the Pairblade is the academy endpoint. The Arcblade is military-era.**

He graduates on the swords. The laser upgrade doesn’t appear anywhere in Books 1-7. This retires the tier-timing problem entirely, since a D-tier weapon at Year 6 is now a deliberate spending signature rather than a lag, and the explanation was already locked elsewhere: weapon and mobility before all else, with underinvestment in power units so sustained he’s still on a D-or-C-tier unit deep into B-rank service.

**It also makes Book 7 better.** The graduation exam is the biggest set piece of the academy arc, and he fights it with a weapon he’s had for two years and knows completely rather than something new. The laser blades then become a marker of having left rather than a reward for finishing.

**Two other docs now need correcting and were not edited, since neither is an outline:**

- Qiraki_Weapons_And_Progression.md, Trav’s-weapon-progression entry, still says “two laser-blades by year 6/7.”

- Qiraki_Points_Shop_Catalog.md, Meeps table, prices the Arcblade as “late Year 6 / Devereux-Kastel” and calls it his “already-locked Year 6/7 endgame weapon.”

### 2c. Ilyen’s fourth tell. RESOLVED

**Ruling: she starts keeping the specific parts his build eats, stocked ahead of need, before he asks.**

Placed at B5.CH44. It works better than the diagnostic version because it requires having tracked a pattern across months, which is the most locked thing about her, the girl who keeps an unprompted private log of every AI-tutor correction the dorm gets purely because she likes knowing things precisely. Same faculty that made her the cohort’s rune-patterning prodigy, pointed at one person. And it’s completely deniable, a good Munti stocking for their team’s actual consumption is the job, not a favor.

**One drafting requirement it creates:** for the reader to work out that nobody else’s consumables are stocked this far ahead, at least one other teammate has to visibly wait on a part somewhere in Book 5. Without that, the tell has nothing to be measured against.

**The completed chain:** convenient scheduling (Bk 2), watching the door before he arrives (Bk 3), an unfinished sentence abandoned twice (Bk 4), the parts (Bk 5), a reaction that outlasts the conversation (Bk 6).

### 2d. Propaganda-fragment frequency. RESOLVED BY DOC PRECEDENCE, NOT A JUDGMENT CALL

Three docs disagreed. Qiraki_Propaganda_Bank.md is newest, holds the actual fragments, and states outright that it supersedes the “~34 per book” note. This pass followed it and rewrote every outline’s allocation. **Qiraki_Process_Notes.md**** ****is stale** and still says “roughly once every several chapters, not every chapter, texture rather than gimmick.” Correct it there rather than reconciling it in the outlines.

### 2e. Toma Ruiz. RESOLVED AS A MERGE, ENDPOINT STILL OPEN

Named in the Character Sheets as the Munti who fails to reach Soren, never named in Book 4’s outline. Now named there, and **merged into existing chapters rather than given his own, per author instruction. Chapter counts unchanged, all six books still at 47.**

**Seed, B4.CH30 (****“********Back to Class********”****).** One beat. He is in the room, back in a Munti seat, on schedule, the same week. Not approached, not blamed out loud, not comforted, because nobody has worked out what you say to him. That chapter’s stated subject is the system refusing to stop, and a named kid processed straight back into rotation six days after a failed extraction is that subject in a single concrete body rather than as a general observation about institutions. It cost nothing to place because the chapter was already about exactly this.

**Payoff, B5.CH29 (****“********What Precision Is For********”****).** He teaches Ilyen the Munti role. Same cohort, same year, two years into the path she’s entering with nothing, so a peer rather than a mentor, which keeps the institution out of it. **The thread his sheet recommends, made concrete:** he is obsessive about extraction timing specifically, not repair, not fabrication, not the parts that generate points. Cycle time, drilled past what anyone asked for, taught to her as if it were the only part of the job that counted. He never mentions Soren. Ilyen wasn’t on that team and has no reason to connect it. Trav is POV, was in that arena, and says nothing, which is what his locked cognition does with everything.

**One line more in Ch. 31**, where Ilyen starts the Munti equipment line from the bottom: he’s already carrying a Lifebox, the cockpit-evacuation tier, bought earlier than his points comfortably allowed. Neither of them remarks on why.

**Why the merge is better than the chapter would have been.** A dedicated Toma chapter would have to be *about* his guilt, which means either narrating it or having a character say it, and both break Rule 4. Folded into Ilyen’s chapter his guilt is never the subject, it’s just why a competent fifteen-year-old drills one skill harder than the syllabus asks, and the reader assembles the rest from a Book 4 chapter they already have.

**Still open: his endpoint.** His sheet offers two shapes and doesn’t lock either, an obsessive focus on extraction speed (now implemented) and a transfer out of combat Munti work entirely into repair-and-diagnostic R&D. Whether that transfer happens is a Book 6 line either way, not another Book 5 beat.

## 3. Carried in from docs that already locked it

Everything in this section was already decided somewhere. The outlines just didn’t reflect it.

**All books.** Propaganda allocation rewritten against the 176-fragment structure, with each book assigned its month-theme tier (Tier 1 for Books 1-2, Tier 2 for 3-4, Tier 3 for 5-6) and its year-specific curriculum banks. **Three entirely new fragment banks now exist that no outline mentioned:** rune-tech, engineering, and combat, three fragments per academy year each, book-specific and never reused. That’s twelve unique year-tied fragments per book instead of the three the Bloom bank was carrying alone. Two new non-human banks (Hiopi, ten fragments, and Osnius, ten) also landed and are placed against Bruvald, the ritual chapters, and the cross-cohort chapters.

**All books.** Craft-discipline block added, covering Style Guide Rules 10, 11 and 12 and the Emotion Craft Reference’s verification-word ban, none of which existed when the outlines were written.

**Book 1.** Year 1 curriculum spine added (Literacy, Simple Machines, Physical Literacy), matching the format every other book already used. Emotional target added, also for consistency. Cohort scale corrected, only pilot-track cadets attend combat class, roughly 1,000 of the 2,000 intake, which changes how every arena chapter stages. First Contact expanded with the four-hour session length and the point-scoring detail that makes the Spawn Line the scoring mechanism rather than only the safety net. The Hill Ladder named as the exam format, with the exam-versus-Tuesday contrast the combat reference explicitly flags as worth carrying. All three study sessions given named subjects.

**Book 2.** Osnius bank placed against Bruvald’s introduction, Hiopi bank against the ritual chapter. Study Session I verified against the catalogs, it holds exactly, and its dependency identified: it needs the Diagnostic Ping to already exist for the reader, so Book 1’s Study Session III has been assigned that subject to set it up. Study Session III named.

**Book 3.** **Curriculum line corrected**, engineering Year 3 is hydraulics and pneumatics, not “fluid power and materials,” materials science is Year 4. **Workshop fabrication economy added**, locked to Year 3 in the progression doc and previously absent from this outline entirely, including the pilot-buys-schematic / mek-buys-matter cost split that is the actual mechanical grounding for Reqa’s technical edge by graduation. Study Sessions II and III named. Power unit introduced as a new purchasable category.

**Book 4.** **Materials science added to the curriculum line**, it was missing entirely, and it’s the year’s engineering content with an explicit thematic hook the reference doc already flags: a fatigue lesson landing in the same week as a real injury. The open Year 4 materials-science exercise slot filled at Ch. 22. Toma Ruiz named. The Book 1 arena-system contrast made explicit as the mechanical reason Soren’s death reads as an aberration rather than a statistic.

**Book 6.** Motor schema grounding named at Transition Trials, with a caution against letting real science function as protagonist-only advantage. Power unit signature added, making the build philosophy mechanically concrete. Study Session III named as the two-curricula convergence chapter.

## 4. Things that came up and were deliberately left alone

- **The Bestiary and the Bioterror Descriptive Bank have no use in Books 1-6.** No Bloom creature appears on the page during the academy years, the Bloom reaches these cadets only through curriculum fragments and study-session content. Both docs are Book 7-and-beyond assets. Noted in Book 1’s open items so nobody later reads two full unused descriptive banks as an oversight.

- **The Preserve Species roster likewise has no academy-era use**, and per its own note Trav doesn’t learn about the preserve system until after freeing Zeteii, which is well past this planning tier.

- **The study-session subject tracker in Qiraki_Book_Expansion_Plan.md is still empty.** Eighteen subjects are now named across the six books (three per book) and should be entered there. Not done in this pass because that doc needs its own reconciliation sweep, see below.

- **Qiraki_Book_Expansion_Plan.md has at least four stale notes**, and it says so itself in its own open items (“this doc hasn’t had a full pass reconciling every downstream fix against every earlier note”). The Kest question for Book 5, the Vrassik transfer-slot reaction, Vrassik’s mating-win location, and the Kestrel Academy naming check are all resolved or answered elsewhere. Worth a dedicated pass rather than patching piecemeal.

## 5. What this pass did not touch

Chapter counts, act structures, the locked spines, character fates, the trope-discipline rules, the B1.CH01 opening question (still genuinely open, still touches drafted prose), and any decision the Process Notes assign to the author’s lane. Structural calls got flagged, not made.

## 6. Toma Ruiz endpoint, LOCKED, and the one drafting requirement it carries

**Ruling: deliberately unresolved. He stops appearing.** No transfer to repair-and-diagnostic R&D, no closing scene, no acknowledgement. B5.CH29 and Ch. 31 are his last appearances in the series.

**The reasoning is the setting’s own and it’s the harder version.** The economy compounds advantage and it compounds disadvantage identically. Cohorts run 2,000 a month. The institution does not track individuals who fall behind, and carving an exception for the one kid the reader happens to feel sorry for would be the story granting a mercy the world it’s built doesn’t have. His sheet warned against him being “quietly forgotten.” This deliberately walks up to that line, and the difference is that the documents know and the prose doesn’t.

**The craft risk, stated plainly because it’s real.** On the page, “deliberately dropped” and “accidentally dropped” are the same thing unless the reader is given one place where his presence would be expected and isn’t. A careful reader who notices a character evaporate with no marker will read a continuity lapse, not a structural point, and that reading is unrecoverable once it lands.

**The fix, one line, no chapter cost, now written into B6.CH20.** Somewhere in Book 6’s Act 1 or Act 2, in a context where the cohort’s Muntis are counted or listed, a roster, an exercise pairing, a results board, the count comes up and his name isn’t on it and the scene moves on inside the same sentence. Nobody reacts. That single absence makes every later silence legible as a silence.

**What he leaves behind, and this is the actual payoff.** Ilyen’s best skill as a Munti is extraction cycle time, drilled harder than the syllabus asks, and she learned it that way from him for a reason nobody ever said out loud. The skill outlives the kid. **Do not name him in Book 6. Do not have anyone wonder where he went.** Stating any part of it turns a cold structural fact into a sentimental one.

**Register entry, ready to paste.** Qiraki_Bible_Architecture_Additions.md defines a Dropped-Thread Register whose entire purpose is that a thread is “either deliberately used or deliberately abandoned, never just forgotten.” It is currently empty and still needs merging into the Bible Skeleton. Toma is its first and best entry:

| **Thread** | **Opened in** | **Status** | **Notes** |
| --- | --- | --- | --- |
| Toma Ruiz, the Munti who failed Soren’s extraction | B4.CH25, seeded B4.CH30 | Deliberately dropped after B5.CH31 | Falls behind and is not tracked, per the setting’s own compounding logic. Absence marked once in Bk 6 Act 1-2 so it reads as deliberate. His extraction-timing obsession survives in Ilyen and is never attributed to him on the page. |

## 7. Standing working rule, added at author’s instruction

**Beats get merged into existing chapters wherever the merge works, rather than flagged as floating or given a chapter of their own.** No permission needed each time. Chapter counts hold at 47 by default, and adding a chapter becomes a real decision that gets surfaced rather than a quiet drift.

This has already paid for itself three times, and in each case the merged version is better than the standalone would have been, not merely cheaper:

- **Toma Ruiz into B4.CH30 and B5.CH29.** A dedicated chapter would have had to be *about* his guilt, which means narrating it or having someone say it, and both break Rule 4.

- **Quickstep into B1.CH24 (****“********Faction Money********”****).** The purchase beat alone is inert. Sitting it beside faction-sponsored privilege in the same chapter does the whole earned-versus-inherited contrast without a word of commentary.

- **Ironvein into B1.CH27 (****“********Ambition Month********”****).** An unglamorous stamina purchase landing in the month about ambition quietly identifies which kids are actually paying attention.

**Belongs in Qiraki_Process_Notes.md** under structure, alongside the mission-chapter rhythm, rather than living only here.

## 8. Cross-reference audit, and a caution worth keeping

**Six chapter references written during this pass were wrong** and are now corrected. They were all mine, all introduced while writing prose about chapters rather than counting them:

| Was | Should be | Where |
| --- | --- | --- |
| Faction Money at Ch. 25 | **Ch. 24** | Bk 1 header, update log |
| Hiopi/Osnius placed at Ch. 29 | **Ch. 28** (Cross-Cohort, not Unity) | Bk 2 additions log |
| Twinlance at Ch. 47 | **Ch. 43** | Bk 3 additions log |
| Kest’s address at Ch. 26 | **Ch. 27** (Ch. 26 is “After”) | B4.CH30, B5.CH26 |
| Legacy Cadet payoff at B2.CH35 | **Ch. 34** | B5.CH05 |
| Ilyen’s fourth tell at Ch. 40 | **Ch. 44** | Bk 5 header, open items, update log |

**The caution:** every one of these was written confidently and none of them were checked, because act-relative position feels like it should map onto absolute numbering and it doesn’t. Acts run 12/11/13/11, so Act 3 chapter 6 is Ch. 29 and Act 4 chapter 8 is Ch. 44, and neither is intuitive. Qiraki_Chapter_Index.md now exists specifically so cross-references get looked up rather than recalled. Worth using it before writing any “see Ch. N” note, including mine.

## 9. Toma Ruiz, revised. Supersedes section 6 above.

**Section 6 is now stale and left in place for history.** The earlier ruling was that he falls behind and the story stops tracking him. The author revised it: **he’s talented, and he doesn’t reappear because he got moved to another unit.**

**Why the revision is stronger, stated plainly since the first version was argued for at length.** A kid who fails an extraction and then declines is the expected narrative shape, and worse, it makes his guilt legible *through* his decline, which is a soft way of instructing the reader how to feel about him. That’s adjacent to exactly what Rule 4 exists to prevent. A kid who fails once and answers it by becoming the best in his cohort at the specific thing that failed refuses to resolve into either tragedy or redemption. The world neither punishes nor rewards him, it just needed a Munti somewhere else. It also costs nothing thematically, compounding advantage moves people up and out of your frame for the same structural reason it drops others out of it.

**The thing the revision unlocks, and it comes free from a constraint already locked.** Trav does not introspect and does not follow up. So whether Toma was promoted or washed out is **genuinely unavailable from inside this POV**, not authorial coyness but an actual property of the narrator. The reader gets what Trav gets, an empty slot and nobody to ask. Most readers will fill it with the sad version, which means the book carries that weight without ever having claimed it. **The documents know the answer. The prose does not.**

**Changes made:**

- **B4.CH30**, the seed now has to hold both readings at once. He is present and functional six days after, and whether that reads as resilience or dissociation depends on the reader, which is correct rather than unclear.

- **B5.CH29**, his excellence is craft rather than symptom. Ilyen is receiving the best available instruction on the subject rather than absorbing somebody’s damage. Warmer scene, same silence.

- **B5.CH31**, the early Lifebox now reads as a good Munti prioritizing correctly, and it is deliberately impossible to tell that from penance.

- **B6.CH04**, the absence marker rewritten. **The old**** ****“****the count comes up one short****”**** ****was wrong**, a short count implies loss and the point is that nobody can tell. It is now a posted pairing list or station roster with his name simply not on it. Reassignment and attrition look identical on a list, which is the entire content of the beat.

- **B6.CH20**, endpoint restated, documented truth recorded, prose still silent.

**Corrected register entry, supersedes the row in section 6:**

| **Thread** | **Opened in** | **Status** | **Notes** |
| --- | --- | --- | --- |
| Toma Ruiz, the Munti who failed Soren’s extraction | B4.CH25, seeded B4.CH30 | Deliberately dropped after B5.CH31 | **Documented truth: he is excellent and gets reassigned.** Prose never establishes this, and the ambiguity is a property of Trav’s non-reflective POV rather than an authorial withholding. Absence marked once as a roster omission in B6.CH04, neutral wording, no implication of loss. His extraction-timing excellence survives in Ilyen and is never attributed to him on the page. |
