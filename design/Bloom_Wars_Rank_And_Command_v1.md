# Bloom Wars — Rank and Command

*Companion doc, not a new source of canon except where marked. Consolidates a rank/command structure that was previously scattered across the Amaranth Reckoning's §10 squad-scaling table and the Antfarm Carrier Hub's §12.1 hub-access gate into one usable reference — same job the uploaded Qiraki rank-path doc did for that project, structure borrowed deliberately, vocabulary not.*

**Status:** paper only, nothing here is built. First draft 25 Aug 2026.

**Depends on:** `Bloom_Wars_Independent_Campaign_The_Amaranth_Reckoning.md` §6/§10 (Rourke's locked rank beats, the Lance-scaling table), `claude/Bloom_Wars_Antfarm_Carrier_Hub_v1.md` §12.1 (the existing rank-gated hub access rule), `Bloom_Wars_Data_Pack_v0.1.docx` §6.4 (the G–A gear-tier cost table this doc hooks into rather than duplicates).

---

## 0. Where this came from, and why the source isn't reused

Maxime uploaded a Qiraki-side doc (`qiraki_military_rank_path.md`) and asked for it to be folded into the game. It's book canon start to finish — its own named cast, its own political/organizational vocabulary, its own historical grounding — none of it Bloom Wars material, and not one of the handful of docs the Master Index already flags as a deliberate one-way cross-reference. Per this project's own naming lock, none of that vocabulary is safe to bring over regardless of which specific term is the reserved one, so nothing here uses it — deliberately, this doc doesn't even name the source's own terms, just describes their shape.

What's worth stealing is the *shape*, not the words: that document splits **personal rank** (climbed alone, gated by demonstrated capability, no seniority bonus) from **command position** (a merit-based authority layered on top — a soldier can outrank someone and still take orders from them). Bloom Wars didn't have that split written down anywhere as a system; it had Rourke's own promotion beats (locked) and nothing else. This doc writes the split up properly, using vocabulary this project already owns: Warden Company's named pilots already carry real military rank titles (Pvt. Iyari, Cpl. Anand, M.Sgt. Bosk, Spec. Lask, 2nd Lt. Rourke), and the points economy already has a real, balanced, locked G-through-A tier ladder. Nothing new needs inventing to make either axis work — both pieces already exist, just not connected to each other.

One deliberate non-borrow, worth naming since the source doc leaned on it hard: it needed a real-world historical grounding metaphor specifically because its own project rule bars real military vocabulary from that ladder. Bloom Wars carries no such rule — Warden Company already uses real rank titles directly — so this doc doesn't need an invented frame either. The grounding here is just: this is how modern militaries already separate the two tracks, applied straight.

---

## 1. The two axes

**Personal rank** — an individual pilot's own standing, tied to their gear tier (already locked, Data Pack §6.4: G → F → E → D → C → B → A, upgraded with points, no participation bonus — "showing up and training isn't separately rewarded" is already this project's own rule, not borrowed from anywhere). Every pilot has one, whether or not they ever lead anyone.

**Command position** — a role, not a stat. Two rungs, matching what Bloom Wars' own campaign structure actually needs (no invented scale beyond it): **Lance Lead**, running one 5-pilot lance day to day, and **Company Commander**, running the whole multi-lance force. The two aren't a hand-off — Company Commander sits *above* Lance Lead, not in place of it. A pilot can hold both at once (Rourke does, §3), while other lances stand up their own separate Lead reporting up to the same Company Commander. A pilot can hold high personal rank and no command slot at all — most of the roster, by design. A pilot can be pulled into a command role without being the most senior person nearby, same as any merit-based promotion already assumes elsewhere in this project's own economy.

---

## 2. Personal rank — the enlisted ladder

Directly off the existing gear-tier table. No new currency, no new cost numbers — this is a naming layer on a system that's already balanced and shipped.

| Tier | Title | Note |
| --- | --- | --- |
| G | Pvt. | Every pilot starts here — matches the existing "same as Corin Lask on day one" rookie framing already used for emergency Munti replacements (Antfarm §13.2). |
| F | Pfc. | |
| E | Cpl. | Matches Anand's existing title exactly. |
| D | Sgt. | |
| C | Staff Sgt. | |
| B | M.Sgt. | Matches Bosk's existing title exactly. |
| A | Sgt. Maj. | Ceiling of the enlisted ladder — matches how the source doc treats its own top tier as "functionally exceptional rather than a normal endpoint," without needing an S-tier equivalent Bloom Wars has never had. |

**Suggested, not locked — a Munti variant.** Lask is "Spec." (Specialist), not "Cpl.," despite presumably comparable seniority to Anand — real-world usage already reserves that title for technical/support roles rather than line infantry, which fits Munti's support-first identity exactly. Worth considering "Spec." as the Munti-path title at the Cpl./Sgt. tiers specifically, rather than every path sharing one ladder — a small, class-flavored distinction, not a mechanical one.

**A real collision, surfaced rather than resolved — same discipline the source doc used for its own two open questions.** Warden Company's five named pilots already carry authored titles (M.Sgt. Bosk, Cpl. Anand, Spec. Lask, Pvt. Iyari, 2nd Lt. Rourke) as locked characterization, from Mission 1 — while mechanically, every pilot in the roster starts at G tier (Data Pack §3, `campaignAmaranth.ts`'s own `WARDEN_PILOTS`, all `tier: "G"`). Read literally, this ladder would put G-tier Bosk at "Pvt.," directly contradicting his own character sheet. **Recommended resolution, not decided here:** named, hand-authored pilots keep their story-locked titles as fixed flavor, untouched by gear tier — Bosk stays M.Sgt. regardless of what his mech is actually running. The mechanical ladder above applies to pilots with no authored title to protect: generated Lance recruits (Second/Third Lance, per §3 below), emergency Munti replacements, and anything built through the character editor. This is the same shape as the source doc's own author-lane flags — a real fork, worth a direct answer from Maxime, not guessed at here.

---

## 3. Command position — the officer ladder

This one needed almost nothing invented — Rourke's own progression, already locked in the Amaranth Reckoning (§6/§10), already *is* this ladder. Formalizing the mapping is the whole job.

| Command position | Title | Unit led | Locked example |
| --- | --- | --- | --- |
| Pilot | (enlisted title, §2) | Self, one seat in a lance | Everyone who isn't in command of anything |
| Lance Lead | 2nd Lt. | One 5-pilot lance | Rourke, Act I — "Rourke's five-mech lance," already the campaign doc's own flavor text for Lance A before Warden Company even has that name |
| Company Commander | Capt. → Maj. | The full multi-lance force — *and*, for Rourke specifically, still Lance A directly underneath that | Rourke again: Capt. at Mission 12 (Act I's finale, already locked), Maj. at Mission 24 (Act II's finale, already locked) — both already gate Antfarm hub access under Antfarm §12.1 |

No new rungs above Maj. — the campaign never needs one. Warden Company never splits into multiple companies under one player's command; "Maj.+" in the Amaranth Reckoning's own §10 table is already the open-ended top of this ladder, not a placeholder for something above it.

**Corrected, 25 Aug 2026 — Maxime: "shes still leading lance a, she just lead lance b and c as well. even if they got their own co."** Not a hand-off. Rourke's promotion to Company Commander doesn't pull her out of Lance A — she stays its Lead in person, the same unit she's run since Mission 1, *and* holds overall command of the whole force on top of that. Lance B and Lance C can each stand up their own Lead (their own "CO," in Maxime's words) once they form, reporting up to her — but that's a subordinate post under her, not a replacement for her. So the open casting question from the first draft was scoped wrong: it's not "who replaces Rourke on Lance A" (nobody does), it's narrower — **who becomes Lance B's and Lance C's own Lead** once each forms, still genuinely open, still not guessed at here.

---

## 4. What this doesn't change

- **Rourke's own promotion beats** — Mission 12, Mission 24, both already locked, both already gating Antfarm hub access. This doc formalizes the label, changes no mission numbers.
- **The G-through-A gear-tier costs and effects** (Data Pack §6.4) — completely untouched. Personal rank is a name painted on an existing number, not a second economy.
- **The permadeath/restock rules, the deploy gate, the recruit system** — none of this touches who can be lost or how; it's purely a display/flavor layer on already-locked systems.

## 5. Where this would actually plug in, when built

Not the pilot-creator sandbox — it has no gear-tier progression to hang a live rank label off (every sandbox pilot is flavor-only, no points economy, no upgrades), so a rank display there would just be a static, permanently-"Pvt." label with nothing behind it. Not worth building until the sandbox tracks tier at all, which it currently has no reason to.

The real hook is `PilotRecord.tier` (`src/data/types.ts`), which already exists and already gets upgraded through the real points economy (`engine/campaignEconomy.ts`, `Debrief.ts`). A rank-title lookup off that one existing field is a small, later addition wherever pilot info is already rendered (`TransporterPad.ts`'s roster cards, `Debrief.ts`) — not scoped or built here, just noting it's a cheap follow-on once wanted, not a dead end.

## 6. Open items, for the Defect Queue

- **Named-pilot titles vs. the mechanical ladder** (§2) — recommended resolution (decouple, named pilots keep authored titles) stated but not locked.
- **Who becomes Lance B's and Lance C's own Lead** once each forms (§3) — Rourke stays Lance A's Lead throughout, so this is scoped to the two new lances only; genuinely unanswered, not guessed at.
- **Whether personal rank should carry mechanical teeth** (a points multiplier, a morale/Favorability bonus, anything beyond a display title) — deliberately out of scope this pass, flagged as a possible future extension rather than invented unbidden.
- **The Spec. variant for Munti pilots** (§2) — a suggestion, not a lock.
