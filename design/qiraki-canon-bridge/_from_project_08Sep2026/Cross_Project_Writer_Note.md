# Cross-Project Writer's Note — Lessons from The Ninth, for Claude Working on Qiraki

Written for future-Claude, not for Maxime. Purpose: carry forward process lessons learned across a long collaborative drafting-and-editing pass on The Ninth, so the same mistakes don't get rediscovered from zero on Qiraki. Nothing genre-specific to Roman Britain lives in this document, everything here is about how the work got done, not what the work was about.

## 1. Tally, don't touch, until told to batch

The single most load-bearing workflow pattern of the whole collaboration: when the person is nitpicking prose line by line, hold every note in a running numbered tally, propose the fix inline for each one, but do not edit the actual file until explicitly told to apply. Then apply the whole batch in one pass and re-run every verification sweep fresh afterward.

Why it worked: it let a very long, very granular editing session stay legible. The person could see the full list of what would change before any of it was permanent, catch conflicts between two notes touching the same sentence, and change their mind on an earlier item without an already-applied edit getting in the way. Applying fixes one at a time as they arrive is worse, it makes each fix feel irreversible and makes late-arriving notes harder to reconcile with early ones.

Practical form: number the tally, restate it in full at the end of every response so nothing gets lost, note when two items touch the same sentence and will need combining, and only stop tallying when told something like "apply the batch."

## 2. Verify against the actual delivered text, not the plan, not memory

Multiple real continuity errors in this pass only surfaced because the actual chapter file was checked directly, not because a plan document or prior summary was consulted. A character's cause of death, a wound's physical sequence, a headcount at a specific hour, none of these were guessable from the outline, all of them were sitting in the prose itself, sometimes contradicting the outline.

Standing rule: any specific claim about what already happened on the page, who did what, when, in what order, gets checked against the actual chapter text before it's used in new material. Planning documents are intentions. Only the delivered prose is truth.

## 3. Turn "this feels off" into something countable

When a person says a passage feels robotic, or repetitive, or thin, the useful next step usually isn't a rewrite on instinct, it's finding the actual mechanism with a quick script: word-frequency counts, sentence-length distribution, causal-connector density, phrase-repeat detection. In this project that turned a vague "it feels mechanical" into a specific, actionable finding, one causal connector every 300 words, and the fix followed directly from the diagnosis instead of guessing at a rewrite and hoping it lands.

This matters more for genres or scenes that lean on internal reasoning or technical exposition, exactly the kind of thing a mech-combat or technobabble-heavy project is going to produce a lot of. Measure before rewriting.

## 4. Every fix has neighbors, audit them too

Several bugs in this pass were caused by an earlier, correct fix. Cutting a flashback for being overwritten also silently removed the only context an unrelated line of dialogue depended on. Inserting one new paragraph between two established beats quietly changed which noun a pronoun two paragraphs later pointed to. The individual edits were each right in isolation and still broke something.

Standing rule: after any edit, don't just re-read the edited passage, re-read what's now sitting immediately before and after it. An edit changes what its neighbors mean even when the neighbors' own text hasn't moved.

## 5. If the story tracks numbers, audit them as numbers

Death tallies, headcounts, days elapsed, ages, distances, anything with an arithmetic answer needs a literal, separate check across the full span it covers, not just a narrative read for whether it feels consistent. Prose attention naturally drifts toward voice and image and away from whether 12 plus 4 plus 3 plus 1 actually equals the number stated three paragraphs later. Two different numeric threads run through a chapter is fine and often good craft, but they need to be independently traceable and clearly distinguishable from each other, not just individually correct.

## 6. A rule discovered in one scene should get a permanent home, not just applied once

Mid-session, checking whether a small grief gesture was physically realistic turned up a genuinely reusable principle, ordinary actions should meet ordinary resistance from mundane sources under stress, not complete cleanly and not fail from added drama. That started as a fix to one sentence. The right move was generalizing it immediately and slating it for the project's permanent craft-reference document, not letting it evaporate as a one-off correction. Watch for this pattern: when a fix reveals something that's clearly a rule and not just a local patch, name the rule explicitly and give it a place to live.

## 7. Parallel emotional beats need to be mechanically different, not just present

A character processing two different losses with the exact same physical shape, same gesture, same interruption, same restraint, reads as an absence of feeling even when restraint was the actual intent. The fix wasn't adding more emotion, it was making the two beats cost the character something different from each other. Repetition of an emotional beat's mechanics undercuts the beat even when each individual instance is well-written.

## 8. Research real-world grounding properly, don't reason from training data alone

When historical or factual grounding matters to the person, actually search rather than assert from memory, then present findings ranked by how well-supported they actually are, with the weakest-but-most-dramatic option clearly labeled as such. This project's audience explicitly wanted "archaeology to support the story," and the payoff was real, a specific attested historical detail (dated women at named forts) ended up more useful and more citable than anything invented would have been. This generalizes past history, any project with technical or factual grounding claims (orbital mechanics, weapons physics, biology) benefits from the same discipline: check, rank by support, let the person choose.

## 9. Merge new canon into existing documents, don't append

When new worldbuilding surfaces mid-conversation and the project already has a living Bible or canon document, the new material should be located and woven into the specific existing section it belongs to, not tacked onto the end. This project's Bible already had a buried, unexplained detail seeded in the actual manuscript text that the new lore turned out to be the mechanism for, found only by actually reading the existing document before writing anything new. Always check whether new lore is secretly a refinement of something already locked before treating it as new.

## 10. Popups for decisions, prose for discussion

When a question has a small number of genuinely discrete options and the person needs to choose one before work can proceed, use a structured choice tool rather than asking in prose. When the person is thinking out loud, reconsidering, or wants genuine back-and-forth, prose is right and a forced-choice tool would flatten it. Getting this distinction right kept a long session efficient without ever making the collaboration feel like a form to fill out.

*End of note. Written after the Ch.33 drafting-and-revision pass on The Ninth. Add to whichever Qiraki document holds process or meta notes, or keep standalone.*

# File-Porting Tally — The Ninth → Qiraki

Candidates for bringing over, ranked by how directly portable they are. "Portable" means the structure or approach transfers even where genre-specific content doesn't.

**1. Emotion_Craft_Reference.docx — bring over, as a template, not a copy.** Confirmed by Maxime as wanted. The document's actual content, banned-phrase list, replacement patterns, per-character notes, is Ninth-specific and won't transfer, wrong characters, wrong voice registers. What transfers is the structure: a standing document that accumulates emotion-craft rules as they're discovered mid-session (see Lesson 6 above) rather than losing them to a single conversation. Qiraki needs its own populated version, built the same way, starting from zero content but the same shape. The "ordinary resistance" rule from this session (item 35 in the Ch.33 tally) is a good candidate for its first entry, since it's genuinely general-purpose and not Ninth-specific.

**2. THE_NINTH_BIBLE_v21/v22's document architecture — bring over the shape, not the content.** The revision changelog at the top (most recent entry first, one paragraph per revision, cross-referenced to sections), the "Dropped-Thread Register" (threads opened once and not yet carried forward, logged so they're deliberately used or deliberately abandoned rather than forgotten), and the "Needs a Decision" list (short, book-wide only, with a resolved/still-open split) are all reusable canon-document patterns regardless of genre. Qiraki's existing Bible skeleton could adopt this architecture directly.

**3. Master_Style_Guide.docx — bring over as a template, expect the actual rules to differ.** The pattern of a short, numbered, hard-ban style document (certain punctuation banned outright, certain sentence shapes banned outright, tense locked and named explicitly) is worth having for any long project with a single consistent narrative voice to maintain. The specific rules in Ninth's version, continuous present tense, zero em dashes, no paragraph-ending morals, are tuned to Ninth's voice and shouldn't be assumed to fit Qiraki's. Rebuild the document, don't copy the rules.

**4. The chapter-drafting workflow itself — bring over, it's not a file.** Single running markdown file per chapter organized by phase with status flags, a revision log table at the bottom, a standing-notes section for locked decisions, regenerate to docx after each edit pass. This isn't a document to port, it's a process to repeat. Worth a short note in whatever holds Qiraki's process documentation, if that doesn't already exist yet.

**Not recommended for porting:** the historical-research PDFs, the terminology locks (pen-bleiddwr, Hendad, and so on), anything specific to Roman Britain or the Votadini. These are content, not structure, and Qiraki's own technobabble glossary and bestiary generator are already doing the equivalent job for its own world.
