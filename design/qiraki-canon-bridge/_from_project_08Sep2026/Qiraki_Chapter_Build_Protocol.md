# THE QIRAKI FILES — Chapter Build Protocol

*Part of the Qiraki files. This is the program. Input is a chapter address. Output is drafted prose plus the write-backs that keep the reference set current. Seven stages, run in order, no stage skipped. Document IDs used throughout are defined in Qiraki_Master_Index.md.*

*The point of a fixed pipeline is not bureaucracy. It is that a seven-book project cannot be held in anyone's head, and the alternative to a pipeline is not freedom, it is rediscovering the same six mistakes every few months.*

## The pipeline

1 ADDRESS resolve the chapter to an absolute number 2 LOAD pull the fixed context set, in order 3 BRIEF assemble the chapter brief 4 GATE check the brief against the walls before writing a word 5 DRAFT write 6 LINT run the checks against delivered text, not against the brief 7 COMMIT write back what the chapter changed

Stages 1 through 4 are lookup and assembly and should be fast and boring. Stage 5 is the only stage that is writing. Stages 6 and 7 are what stop book 4 contradicting book 2.

## Stage 1 — ADDRESS

Resolve to CH.Bn.mm, absolute numbering.

- Look the number up in CHIDX. Do not compute it from act position. Acts run 12 / 11 / 13 / 11, so act 3's sixth chapter is Ch. 29 and act 4's eighth is Ch. 44.

- Confirm the chapter title from CHIDX, not from memory or from the outline prose.

- Note the month. Act 1 is January to March, act 2 April to July, act 3 August to October, act 4 November to December.

- Note the year and therefore the ages. BIBLE §3 for the arc, CAST for exact ages.

Output: CH.B4.25 — "The Session" — act 3, September, year 4, Trav 15.

## Stage 2 — LOAD

Fixed load order. Same every time, so nothing gets skipped because it did not occur to anyone.

| # | Load | From | Looking for |
| --- | --- | --- | --- |
| 1 | The walls | PROC spoiler lock, STYLE §9 | Anything this chapter is forbidden to contain |
| 2 | The chapter beats | B1..B6 | What the outline says happens |
| 3 | Neighbours | B1..B6, chapters *n*-1 and *n*+1 | What this chapter inherits and what it owes forward |
| 4 | Who is present | CAST | Want, tell, register, execution rules for every named body in the room |
| 5 | The curriculum | CBT / RUNE / ENG for that year | The named exercise, the real science, the correct difficulty |
| 6 | The gear state | WEAP, PTS | What Trav is actually carrying by this chapter, and what he is not |
| 7 | The opener | PROP | Which fragment, and which type was used in *n*-1 |
| 8 | Trope obligations | PLAN | What this chapter deploys, resolves, or echoes |
| 9 | Known defects | QUEUE | Whether this chapter sits on top of an unresolved decision |
| 10 | Delivered prose | Tier 6 files | Only if this chapter references something already written |

**Item 3 is the one people skip and the one that causes the most damage.** Cross-project Lesson 4: every edit changes what its neighbours mean, even when the neighbours' own text has not moved. Reading *n*-1 and *n*+1 before drafting *n* is the cheap version of that lesson.

**Item 9 is a stop condition, not a note.** If the chapter depends on an open DEC, stop and surface it. Drafting on top of an unresolved structural decision is how a fix becomes a rewrite.

## Stage 3 — BRIEF

Assemble before writing. The brief is disposable, it exists to make stage 4 possible.

ADDRESS CH.B4.25 "The Session", act 3, September, Y4, Trav 15 POV Trav, first person, continuous present OPENER PROP fragment: [id] — type: [poster / curriculum / memo / broadcast] type used in CH.B4.24 was: [x], so this one must differ

PRESENT [character] — want: [ ] — tell: [ ] — register: [ ] [character] — want: [ ] — tell: [ ] — register: [ ]

CURRICULUM [named exercise from CBT/RUNE/ENG] — real grounding: [ ] what a reader learns, and through whose failure: [ ]

GEAR STATE Trav carries: [ ] Trav does not yet have: [ ] any purchase this chapter: in-fiction reason FIRST, stat second

BEATS 1. [ ] 2. [ ] 3. [ ] 4. [ ]

TROPE deploys: [ ] resolves in-book at: CH.Bn.mm echoes: [ ] from CH.Bn.mm owes downstream: [ ] planted at CH.Bn.mm

INHERITS from CH.B4.24: [ ] OWES to CH.B4.26: [ ]

WALLS spoiler: [clear / touches] minors: [clear / touches] thesis risk: [which character is most likely to say the quiet part]

SPELLING Reqa / Reaka (Reaka through B1.CH08 inclusive, Reqa after)

**On the SPELLING line.** It is on the brief because it is the single most reader-visible mechanical rule in the project and it is invisible to any check that is not looking for it. AUDIT §1.1 claims the correction scene is unassigned. It is not, LOCKS assigns it to B1.CH08. The audit is stale on this point.

**On the "thesis risk" line.** PROC names Halvorsen and Osei as the likeliest characters to state the quiet part out loud on Trav's behalf. Naming the risk before drafting is cheaper than catching it after.

## Stage 4 — GATE

Four walls. Any one of them means stop and fix the brief, not fix the draft.

- **Spoiler.** The word "Qiraki" appears nowhere in prose, dialogue, in-universe document, or fragment. Not as an easter egg, not in a description, not as a word a character stumbles on.

- **Minors.** Nothing romantic or sexual involving any character while a minor, and no narration that discusses adolescent sexuality in the academy books. The fertility-suppression mechanism is never explained during the academy years, its reveal is military era. If a beat seems to invite otherwise, that is the signal to cut the beat.

- **Thesis.** No paragraph or scene ends by explaining what it meant. The Cradle Circle critique, the preserve system, the propaganda device only work if nobody on the page states the point.

- **Unresolved decision.** Nothing in QUEUE marked SEV-1 sits underneath this chapter.

## Stage 5 — DRAFT

The constraints that are cheaper to hold while writing than to fix afterward.

- First person, continuous present, Trav unless the chapter is a locked exception.

- Zero em dashes. Zero semicolons.

- Two tracks running at once. Real curriculum or systems content, and real character interaction. Neither waits for the other to finish.

- Show what a system costs through action. If a fact cannot be shown through action, restructure the scene rather than narrating it.

- Teach through failure. A character getting something wrong for a specific real reason teaches the mechanism without anyone explaining it.

- Adolescent psychology, not adult psychology in smaller bodies. Peer approval outweighs adult approval, public embarrassment lands harder than private failure, risk perception is genuinely immature.

- Every character acts on genuine emotion, including the ones who are wrong.

- Gear reflects character, never the reverse. In-fiction reason first, stat change second.

- Ordinary actions meet ordinary resistance under stress. They do not complete cleanly and they do not fail dramatically.

- No vague-truth placeholders surviving from the brief. "She says something true" is a planning shorthand and an AI tell the moment it reaches prose.

## Stage 6 — LINT

Run against the delivered text. Not against the brief, not against memory. Cross-project Lesson 2: planning documents are intentions, only delivered prose is truth.

**Mechanical, countable, worth actually scripting:**

- em dash count = 0

- semicolon count = 0

- "thing", "stuff", "true" — count, then justify each survivor

- banned phrases from EMO — count = 0

- "Qiraki" — count = 0

- Reqa / Reaka — correct form for this chapter's position

- word count against the ~2,500 average

- sentence-length distribution, flag if it flattens

- causal-connector density, the diagnostic that turned "feels mechanical" into a countable finding on the last project

- paragraph-final sentences, scan for stated morals

**Structural:**

- Does every named present character do something only they would do?

- Is any emotional beat mechanically identical to a nearby one? Parallel beats need to cost different things, not just be present.

- Do the neighbours still work? Re-read *n*-1's last page and *n*+1's first beats.

- Does any number in this chapter need arithmetic checking against the whole span it belongs to? Death tallies, headcounts, days, ages, blood-count numbering.

- Did the propaganda fragment type differ from the previous chapter's?

- Mek and mech, never interchanged.

## Stage 7 — COMMIT

The stage that keeps the reference set from going stale. Each item writes back to exactly one owner.

| If this chapter… | Write to | What |
| --- | --- | --- |
| deployed a trope | PLAN | trope, in-book resolution chapter, planted downstream echo |
| used a study-session subject | PLAN | book, chapter, subject, source doc |
| coined a term | TERM | term, meaning, first use, constraints |
| locked a character detail | CAST | the detail, marked LOCKED |
| opened a thread not yet closed | BIBLE Dropped-Thread Register | thread, opened in, status, why it matters |
| purchased gear | WEAP | current loadout state at this chapter |
| invented an item, gesture, or object | CAST or TERM | flag it as a Claude-lane call so it can be swapped if wrong |
| revealed a new craft rule | STYLE or EMO | the rule, named, with the scene that produced it |
| surfaced a structural fork | QUEUE | as a DEC, not resolved |
| changed a chapter title or count | CHIDX | **regenerate, do not patch** |
| contradicted an existing doc | that doc | the doc is stale, fix it there |

**The write-back is not optional and it is not housekeeping.** Every defect currently in QUEUE exists because a stage 7 did not happen. The trope tracker is empty. The study-session tracker is empty. The Dropped-Thread Register does not exist yet. Two chapters are drafted and neither has been mined for either.

## Worked example — CH.B1.08, "The Workshop"

Running the pipeline on a chapter that already has beats, to show what it produces.

**1 ADDRESS.** CH.B1.08, "The Workshop", act 1, February, year 1, Trav 12, Reqa 14.

**2 LOAD.** B1 says this is a daily-rhythm chapter: breakfast opens on Trav and Reqa, the workshop period is class 2, Doyle, Fenn and Petra's beats distribute across the remaining class periods and the evening rather than stacking. LOCKS says the workshop is Party-scale, one shared bay per five-pilot team, subdivided into pair stations. LOCKS also assigns the Reqa name correction here. CAST supplies Doyle's pride in careful numbers, Petra having already clocked Ilyen, Fenn unbothered by Corw from day one.

**3 BRIEF.** Four named bonds open or advance in one chapter, all inside the daily-rhythm shape, plus the single most reader-visible mechanical event in the project. That is a lot of load for one chapter and the brief is where you find that out, not the draft.

**4 GATE.** Spoiler clear. Minors clear. Thesis risk is low, no sympathetic authority figure present. QUEUE check flags **DEC-02**, the Chapter 1 opening question, which touches drafted material upstream of this chapter but does not block it.

**5 DRAFT.** Spelling: "Reaka" throughout, one final time in the correction beat, "Reqa" from the next chapter onward.

**6 LINT.** Additional check specific to this chapter: the four mek and pilot bonds must each cost something different. Four warm beats with the same shape read as one beat repeated.

**7 COMMIT.** CAST gets the correction scene confirmed as delivered. BIBLE's Dropped-Thread Register gets the socket logged if it is referenced. Every subsequent chapter's brief now carries "Reqa" on the spelling line.

## Applying this to what is already drafted

Chapters 1 and 2 exist as prose and were written before this protocol did. They have never had a stage 6 or stage 7 run against them. That is the smallest, highest-value place to start, two chapters, one lint pass, one commit pass, and the trackers stop being empty.
