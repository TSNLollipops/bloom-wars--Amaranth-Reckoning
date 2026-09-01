# THE BLOOM WARS — House Amaranth Campaign: Full 36-Mission Plan v1

**Status: planning pass only — zero missions built, zero code touched.** This is the "before we start a determined build batch" document: it turns `Bloom_Wars_House_Amaranth_Campaign_Concept_v1.md`'s design pass into an actual 36-mission table, names the new content/tooling that table implies, and flags the scope questions the Concept doc didn't fully surface. Nothing here is locked until Maxime signs off — treat the mission table and every named proposal below as a first draft to argue with, not a finished spec.

**Provenance note (31 Aug 2026):** authored in Maxime's claude.ai planning Project (not this repo's own smaller attached Project), pasted directly into this Claude Code session so it could be worked from here — per the project's own workflow split (claude.ai plans, Claude Code implements). This copy is the implementation-side reference; the claude.ai Project copy is the one to treat as living/canonical if the two ever drift.

**Update, 28 Aug 2026 (later the same day) — the Hub question is resolved: yes, and it's a full Hub, not missions-only.** See §3, rewritten in full to cover this and the two architecture questions it opened. This is a real scope increase on top of an already-large plan — worth reading §3c specifically before assuming this batch matches Warden's *current* Hub depth.

**Scope flag, stated plainly, per this project's own rule ("say so before growing scope"):** this was already a second full 36-mission campaign before today — the Concept doc called that correctly on its own ("roughly the size of The Amaranth Reckoning itself"). Adding a second full Hub on top of that is not a small addition — it's the single largest thing this project has built for Warden Company's side, being built a second time, for a second roster, from scratch. §3 below lays out exactly how big and how it's being kept safe to build (a separate scene, not a refactor of anything shipped), but the honest framing is: this plan now covers a genuine second game's worth of both content types Warden Company has — missions and a living Hub — not one or the other.

---

## 1. What's already locked (carried from the Concept doc)

- **The shape:** two mirrored, Red Alert–style campaigns sharing one war. Warden Company's side (The Amaranth Reckoning) is built and complete. This is House Amaranth's own side.
- **Missions 1–19:** genuinely distinct content, own maps/encounters/pacing — not Warden's nineteen replayed from the other side.
- **Mission 20:** the one shared convergence point, "Marrow's Line" — the same battle, played from House Amaranth's side, with a different win condition (see §5).
- **After Mission 20:** House Amaranth's story is its own, no longer mirroring Warden's Act 2/3 beat-for-beat.
- **The ending:** House Amaranth's Bloom-taming actually works, at their own scale — Mission 36 ends with the Bloom genuinely pacified for House Amaranth, a real earned win, not a mirrored tragedy. This doesn't touch Qiraki canon: it's explicitly a stalling solution that can't scale galaxy-wide and gets abandoned sometime after this campaign's own ending — the playable campaign ends on the high note; the abandonment is epilogue-level context, not something the player plays through.
- **Colonel Ysolde Marrow** is the one built character this campaign already has real material for — three story beats on record in the Independent Campaign doc (Missions 6/20/28, Warden's numbering).

## 2. Decisions made 28 Aug 2026, confirmed with Maxime

1. **Protagonist: Colonel Marrow herself**, not a new original character. Direct 1:1 mirror to Rourke — same war, opposite side, and she already has a real arc on record instead of needing one invented from nothing.
2. **Missions 21–35: a genuinely separate front**, not a mirror of Warden's Act 2/3 beats. After Mission 20, House Amaranth's war and Warden's war barely overlap — House Amaranth spends the back half on their own objective, not chasing the same battles Warden fights.
3. **This plan pass goes to full depth** — all 36 missions get an objective type and a one-line pitch now (§6), the same format the original Amaranth Reckoning doc used, rather than stopping at act-level shape.
4. **House Amaranth gets a full Hub, not missions-only.** Maxime: "honestly I wana do the 2cd hub. because the otherside get to live it too. itl make genuinely real stroy its part of aliicialisation plan too." See §3.
5. **The Hub is a separate, parallel scene** (`HubHouseAmaranth.ts`), not a refactor of Warden's `Hub.ts`. Zero risk to Warden's already-shipped, heavily-tested Hub.
6. **Set on the ward-crop terraces — a ground estate, not a second carrier.** House Amaranth is a landed dynasty; the Hub should read as that from the geometry up, not as Warden's ship with different labels.

## 3. The Hub — RESOLVED 28 Aug 2026: yes, a full Hub, built as its own scene

Confirmed: House Amaranth's campaign ships with its own full Hub — walkable base, roster, social layer — not missions-only. This is the single biggest lever this plan has, and it's worth being precise about what it does and doesn't commit to.

**Built as a separate, parallel scene — `src/scenes/HubHouseAmaranth.ts` — not a refactor of `Hub.ts`.** Maxime's own call, and the recommended option: zero risk to Warden Company's Hub, which has 950+ tests and roughly a dozen separate build passes riding on it staying exactly as it is. The real cost, worth saying plainly rather than glossing over: two Hub scenes means every *future* Hub feature — a new minigame, a new social-sim mechanic — gets built twice from here on if both sides are meant to keep it, not automatically shared between them. `src/engine/hubGeometry.ts` (the Phaser-free ellipse/clamp math) has no Warden-specific assumptions baked in and should be reused directly, not duplicated — that's genuinely free.

**Set on the ward-crop terraces, not a second carrier.** A fortified estate/manor complex, not a ship — gives every room a natural, different shape than Warden's deck-and-corridor layout instead of reading as a reskin, and ties the Hub directly into the actual mission content (§6) rather than sitting apart from it.

### 3a. Estate room set — proposed, not built

A first-draft mapping of Warden's seven Hub rooms onto an estate setting, kept close enough in *function* that the underlying systems (muster, Talk, Shop, minigames) port over with minimal new logic, but different enough in *setting* that it doesn't read as a reskin:

| Warden's Hub | Estate equivalent (proposed) | Function |
|---|---|---|
| Rec Room | **The Greathouse** | Social hub — ambient banter, minigames, the crew off-duty. |
| Hangar Deck | **The Motor Court** | Mek maintenance, deploy staging. |
| Berths | **The Longhouse** | Crew quarters. |
| Workshop | **The Cultivar Works** | Gear crafting / Weapon Branch purchases — ties directly into the ward-crop program's own tech. |
| Vault | **The Reliquary** | Heirloom-grade gear storage. |
| CIC | **The War Room** | Mission briefing/planning. |
| The grotto (Carabil CO's room) | **The Terraces** | An open walkable zone, not a sealed room — where the estate's own steward/seneschal (§3b) is actually found, tending the program the whole campaign is built around. |

Same three-deck-equivalent split as Warden's Antfarm Grid is a reasonable starting geometry (open floor per level, stairs between), but nothing here is locked — worth a real pass once building starts, same as Warden's own room-to-deck split was explicitly left redrawable in that doc.

### 3b. A steward/seneschal NPC — proposed, not named

Warden's Hub has a CO distinct from Rourke (the Carabil pilot, Arangement of Content) — someone who runs day-to-day ship life so the protagonist isn't also voicing every piece of Hub content. House Amaranth's own equivalent, proposed here: a **seneschal** — a non-combat household/estate authority figure, answerable to Halcyon Amaranth rather than to Marrow directly, who actually runs the terraces day to day the way Arangement of Content runs the ship. Gives the estate a second real voice besides Marrow's own command staff, and a natural reason for Halcyon's own political presence (§4, Mission 19) to be felt in the Hub even when she's not physically there. Name, species, and personality all open — not invented here on purpose, same reasoning as the supporting roster in §4.

### 3c. Content depth — a phased build, not a day-one match to Warden's current Hub

Worth being honest about this rather than implying House Amaranth's Hub launches as rich as Warden's does today. Warden's Hub's current depth — 700+ ambient lines, hot topics, relationship stages, friction, breakdown events, Anger Blowup, the Munti Respect bank, catalyst clash reactions, a per-NPC Highlights reel — is the result of roughly a dozen separate build passes *after* the base Hub shipped, not something that landed in one batch. Proposing the same shape here:

- **Hub v1 (part of this batch):** the walkable estate itself, the roster seated in it, basic Talk/ambient-line pools per pilot, the Shop/Weapon Branch economy wired to House Amaranth's roster (this system is already class-generic and data-driven per its own build notes — low marginal cost to point it at a second roster), and a starter ambient-line bank sized more like Warden's *original* 180-line flat pool than its current 700+, since that's what a first pass realistically produces.
- **Ongoing, after v1 ships:** hot topics, relationship stages, breakdown/blowup events, catalyst-specific content, the Highlights reel — all the texture that made Warden's Hub feel alive was itself post-launch, iterative work, across many sessions. No reason House Amaranth's side can't get the same treatment over time; just naming that "genuinely real story" is a real commitment across many future sessions, not one batch, the same way it was for Warden Company.

**Flagging this explicitly rather than assuming it:** if the goal is closer to "exactly as deep as Warden's Hub is today, in this one batch," say so — that roughly matches the actual size of everything this project has built on the Hub side to date, which took months of session time. The phased plan above gets a real, playable, alive-feeling Hub in this batch, and the same depth Warden's has now over further ones.

**RESOLVED, 31 Aug 2026 — full parity, not the phased v1 above.** Maxime's call, asked directly: full parity with Warden's current Hub depth (700+ ambient lines, hot topics, relationship stages, friction, breakdown events, Anger Blowup, Munti Respect bank, catalyst clash reactions, the Highlights reel), not the ~180-line phased starter this section proposed. Flagging the real consequence rather than quietly absorbing it, per this project's own scope-growth rule: Warden's Hub reached its current depth over roughly a dozen separate build passes across many sessions, not one batch — targeting that same depth for House Amaranth's Hub inside "one determined batch" is very likely the single biggest line item in this whole plan, bigger than the 36 missions and the Bramble combined. §8's batch order should treat Hub content depth as its own multi-session sub-track once the estate scene itself and its roster exist, not a same-day step 7.

### 3d. Save/progress architecture — new question this decision opens

Not addressed anywhere yet: does a player's House Amaranth progress live in the same save state as Warden Company's (`campaignState.ts`), or its own separate, parallel state module? Given the "separate scene, zero risk to what's shipped" reasoning behind §3's own architecture call, the consistent answer is **a separate state module** (e.g. `campaignStateHouseAmaranth.ts`, its own `localStorage` key) — mirrors the Hub decision's own logic and means nothing about this build can touch Warden's save data even by accident. Flagged here rather than assumed, since it's a real design choice with a real UX consequence: two campaigns, two independent save slots, not one combined "campaign progress" a player tracks in one place.

**Superseded/expanded, 28 Aug 2026 (later the same day) — the full mechanism (Ironman, manual save slots, the New Campaign screen this all lives on, and how side-select fits into it) is now its own doc: `Bloom_Wars_Main_Menu_Save_Ironman_UI_Plan_v1.md`.** That doc's §5 specifically answers how a side choice (Warden Company vs. House Amaranth) fits into the New Campaign flow. Read it instead of treating this paragraph as the final word on save architecture — this note stays only as the pointer.

## 4. Narrative shape — proposal, not locked

**Overall campaign title (proposed): "The Amaranth Bargain."** Mirrors the existing "The Amaranth Reckoning" naming pattern and names the actual throughline — a deal, and its cost.

**Three-act structure (proposed):**

| Act | Missions | Title (proposed) | Shape |
|---|---|---|---|
| I | 1–12 | **Harvest Ground** | Establishing the bargain: the ward-crop terraces, Marrow's early command, the diversion program working as intended, first cracks. |
| II | 13–20 | **The Bargain Holds** | The program strains under its own growth and outside political pressure, ending at the shared Mission 20 duel. |
| III | 21–36 | **The Stalling Season** | The genuinely separate front — House Amaranth alone, managing a containment crisis and a political one at once, ending in real, local vindication. |

**Marrow's own arc — proposed, and this is the one place I'm pitching something the Concept doc left fully open, flagged clearly as a suggestion:** where Warden's version of this story has Marrow eventually break from Halcyon Amaranth (Mission 28, Warden's numbering — "she finally chooses who she actually serves"), this campaign's own Mission 28 could resolve the opposite way — Marrow, tested by the Mission 20 duel, chooses to back Halcyon fully rather than break from her, and it's that full commitment (not betrayal) that makes the stalling solution actually work at House Amaranth's scale. Two versions of the same person facing the same test, resolving oppositely, is a clean way to make both campaigns feel like real mirrors of each other rather than one being simply "the other side, reskinned." Fully optional — easy to swap for a different resolution if this doesn't feel right once you see it laid out.

**A connective-tissue idea, same spirit — also just a proposal:** the Wellroot that Warden Company fights and destroys in Mission 21 (their numbering) is explicitly rooted in House Amaranth's own terraces (Independent Campaign doc §8/§17). This plan's Act II/III (missions 15, 17, 23, 32, 35 below) treat that as literally the same growth — House Amaranth doesn't discover it as a hostile boss the way Warden does, they've been cultivating it the whole time, and Mission 36's "pacified" ending is specifically about finally succeeding at domesticating that same node Warden's story destroys outright. Same object, two completely different outcomes depending on whose campaign you're playing — a tight, free piece of continuity between the two campaigns that costs nothing extra to build.

**A new signature threat (proposed name: "The Bramble")** — introduced Mission 26, this campaign's own equivalent to the Choir/Wellroot/the Unnamed. Where those are named threats Warden fights as enemies, the Bramble is what happens when the *domestication itself* fails: a strain of the diverted Bloom that rejects containment doctrine outright — fast, aggressive, spreading uncontrolled, the literal weed that grows when a garden stops being tended. Fits the farming metaphor this whole campaign is built on, and gives Act III a real tactical throughline distinct from anything Warden's side fights. Lineage/stat-block decision deferred to the actual build batch (§7) — likely Splitfang-descended (uncontrolled multiplication) or Gallcyst-descended (acid/growth family, matching the terraces' own biology); worth combat_sim.py-ing both before picking.

**Marrow's own combat path — proposed: Tank, not Meeps.** Rourke is Meeps (aggressive, quick, green-to-veteran). Making Marrow Tank instead — someone who holds ground and proves herself through steadiness rather than speed — gives Mission 20's duel a real asymmetry (a Meeps duelist against a Tank duelist plays differently than a mirror match), and it fits the "career officer proving herself, common-born, brilliant" characterization already on record. Open to Meeps instead if a direct mirror-match duel is the more interesting version of that fight — flagging the tradeoff rather than picking silently.

**Supporting cast beyond Marrow and the seneschal (§3b) — deliberately not named here.** Inventing four or five more full characters (names, callsigns, chassis species, personal arcs) is real authorial work on the scale of what Warden Company's five-pilot roster took, and it's exactly the kind of content this doc shouldn't guess at wholesale. Recommend naming them together, the same conversational way Warden's own roster and callsigns were set, rather than this plan inventing a cast unilaterally.

## 5. Mission 20 — the shared convergence, mechanically

Warden's side plays this as *Eliminate All* and wins outright, with Marrow "withdrawing in good order" per the existing doc. House Amaranth's own version of the same battle needs a different win condition to make sense from the losing side — proposed as **Extract Unit**, objective reframed as a disciplined disengagement rather than a rout: Marrow's real goal isn't beating Rourke, it's proving House Amaranth's battlegroup can hold long enough to withdraw its own way, on its own terms. Same map, same two commanders, same moment — a genuinely different objective on each side, which is a nice mechanical expression of "two playable perspectives on one battle" rather than just narrative color.

**Technical note for the build batch:** this almost certainly needs its own separate map/mission entry in `mapsHouseAmaranth.ts`/`campaignHouseAmaranth.ts` rather than literally reusing Warden's Mission 20 data — deploy zones, unit composition, and the objective itself all differ by side even though the battlefield and beat are conceptually the same.

## 6. The full 36-mission table

### Act I — Harvest Ground (Missions 1–12)

| # | Title | Objective | Pitch |
|---|---|---|---|
| 1 | **First Harvest** | Eliminate All (tutorial) | A Crawlmass drift wanders onto a ward-crop terrace on Marrow's first morning in command. Establishes the command staff. |
| 2 | **The Long Contract** | Hold Zone | Defending a diversion relay — the bargain's actual machinery, shown for the first time. |
| 3 | **Second Harvest** | Extract Unit | A ward-crop survey team is cut off when a drift runs heavier than predicted. |
| 4 | **Good Neighbors** | Eliminate All | First contact with Warden Company patrols on the shared border — wary, correct, unfriendly. |
| 5 | **The Seal Arrives** | Hold Zone | A House officer holding Halcyon's seal visits for a muster; Marrow has to make it look easy. |
| 6 | **House Colors** | Eliminate All *(mirrors Warden's Mission 6 — same incident, other side)* | The checkpoint dispute Warden remembers as "House Amaranth abandoning a position" reads, from here, as a bargain-mandated withdrawal Marrow was ordered into and hated. |
| 7 | **Deeper Terraces** | Extract Unit | Expanding the ward-crop program onto a new tier; a research team needs pulling out when the drift there runs hot. |
| 8 | **The Quiet Growth** | Survive N Turns | First sign the diverted Bloom isn't staying where it's put — a night watch that shouldn't need this much watching. |
| 9 | **Loyalist Eyes** | Hold Zone | A sector-governor auditor tours the program; Marrow has to hold a clean, boring battle for an audience hoping for a mess. |
| 10 | **The Choir, Heard From Afar** | Eliminate All *(mirrors Warden's mid-boss encounter)* | The same coordinated Bloom pack Warden's lance meets head-on; House Amaranth doctrine handles it by redirection, not annihilation — kill only what won't be steered. |
| 11 | **What the Terraces Cost** | Extract Unit | A ward-crop technician goes missing inside the growth zone — the bargain's first quiet, unlogged casualty. |
| 12 | **Harvest's End** | Hold Zone *(act finale)* | A diversion relay fails under real load for the first time. Marrow holds the line alone long enough for a fix, at real cost to her own staff — and is confirmed in permanent command, seal-holder's blessing or not. |

### Act II — The Bargain Holds (Missions 13–20)

| # | Title | Objective | Pitch |
|---|---|---|---|
| 13 | **New Terraces, New Faces** | Eliminate All | Integrating a second lance as the program expands past what one company can hold. |
| 14 | **The Governor's Patience** | Extract Unit | Political pressure sharpens; a loyalist liaison officer needs escorting out once he's seen too much. |
| 15 | **Rootbound** | Hold Zone | First real sign of what will become the Wellroot — a diversion relay's target zone growing faster than it's told to. |
| 16 | **The Long Ledger** | Eliminate All | A rival House tries to poach the diversion contract by force — the bargain has enemies who aren't the Bloom. |
| 17 | **What Grows Beneath** | Extract Unit *(mirrors Warden's Mission 17, other side)* | House Amaranth's own survey team finds what Warden will later call the Wellroot — and reports, against Marrow's instinct, that it's still within tolerance. |
| 18 | **Cultivator's Gambit** | Contested Landing | Deploying a new containment array directly onto contested, still-hot ground. |
| 19 | **The Weight of the Seal** | Hold Zone | Halcyon Amaranth herself visits the front for the first time; Marrow holds a real fight while explaining, live, why the numbers still work. |
| 20 | **Marrow's Line** | Extract Unit *(shared convergence — see §5)* | Same battle as Warden's Mission 20. Marrow's objective is a disciplined disengagement, not a win — proving the battlegroup holds on its own terms. |

### Act III — The Stalling Season (Missions 21–36, House Amaranth's own front)

| # | Title | Objective | Pitch |
|---|---|---|---|
| 21 | **After the Line** | Eliminate All | Marrow returns from the duel changed — not broken from the bargain, committed to it harder, for reasons the squad doesn't fully understand yet. |
| 22 | **Audit Under Fire** | Protect Asset | The loyalist audit turns hostile — literally — when a diversion relay comes under attack mid-inspection. |
| 23 | **The Root Answers Back** | Hold Zone | The Wellroot pushes back against containment for the first time — not an escape, a negotiation, in the only language it has. |
| 24 | **Seizure Order** | Extract Unit | Sector command moves to seize the program by force, convinced it's a lie or a liability; Marrow has to get Halcyon out ahead of loyalist troops. |
| 25 | **Going Dark** | Survive N Turns | Cut off from sector command and from Warden's border entirely, the front holds alone for the first time. |
| 26 | **The Bramble** | Eliminate All *(new signature threat introduced)* | A strain of the diverted Bloom breaks true containment doctrine for the first time — fast, aggressive, nothing like the tame drift the program is built around. |
| 27 | **Salvage the Season** | Extract Unit | Pulling a whole terrace's ward-crop technicians out ahead of a Bramble breach. |
| 28 | **Marrow's Choice** | Eliminate All *(personal turn — mirrors Warden's Mission 28, resolved oppositely, see §4)* | Where Warden's story has Marrow break from Halcyon, here she backs her fully — the last moment either of them could still have walked away clean. |
| 29 | **The Governor's Answer** | Hold Zone *(scripted strategic cost, mirrors Warden's Mission 29)* | Sector command's seizure force actually lands; House Amaranth loses a whole outer terrace holding them off. |
| 30 | **Two Fronts** | Eliminate All | Fighting the Bramble and loyalist regulars in the same battle for the first time — the two-front pressure the act has been building toward. |
| 31 | **What the Program Costs** | Extract Unit (multi-unit) *(scripted partial loss, mirrors Warden's Mission 31)* | Evacuating House Amaranth's own civilian ward-crop workers ahead of the Bramble breach — not everyone gets out. |
| 32 | **Hold the Root** | Protect Asset | Defending the original diversion relay — the one the whole program was built around — through the Bramble's worst push. |
| 33 | **The Innermost Terrace** | Hold Zone (multi-wave) | Final perimeter around House Amaranth's own seat of power; tone shifts from managing a program to surviving one. |
| 34 | **No Word From the Seal** | Survive N Turns *(darkest hour, mirrors Warden's Mission 34)* | Halcyon's gone silent — no confirmation House Amaranth still has political cover at all. |
| 35 | **The Root Turns** | Hold Zone *(final threat breaches containment)* | The Bramble and the original Wellroot node move together for the first time — the two threats becoming one. |
| 36 | **The Stalling Season Ends** | Survive N Turns → Victory *(campaign finale)* | Hold until the containment doctrine actually closes the loop. The Bloom, at House Amaranth's own scale, genuinely pacified. Epilogue: it works here — it won't work galaxy-wide, and gets abandoned someday, but not on this campaign's own last page. |

**Objective-type check:** every mission above reuses one of the six objective types already built for Warden's campaign (Eliminate All, Hold Zone, Extract Unit, Survive N Turns, Contested Landing, Protect Asset) — no new engine-side objective type is required to build this table as written. That was a deliberate constraint while drafting it, not an accident.

## 7. New content and tooling this plan implies

**Mission side:**
- **`src/data/campaignHouseAmaranth.ts`** — new mission-list data file, same shape as `campaignAmaranth.ts`.
- **`src/data/mapsHouseAmaranth.ts`** — 36 new maps (Mission 20 included — see §5's technical note on why it needs its own entry, not a reuse of Warden's).
- **`design/maps_house_amaranth.py`** — a third sibling map-validation script, matching the project's own established discipline of keeping each campaign's validator separate and self-contained (the same reasoning that kept `maps_amaranth.py` from touching `maps.py`).
- **A new Bloom archetype, "The Bramble"** (§4) — needs a real stat block and a `combat_sim.py` pass before it counts, same house rule as every other archetype. Lineage (Splitfang vs. Gallcyst) is an open call, worth testing both.

**Hub side (new as of today's decision, §3):**
- **`src/scenes/HubHouseAmaranth.ts`** — the estate Hub scene, its own file, per §3.
- **`src/engine/campaignStateHouseAmaranth.ts`** (or similar) — a separate save/progress state module, per §3d, rather than extending Warden's `campaignState.ts`.
- The estate room set (§3a), the steward/seneschal NPC (§3b), and a v1-sized ambient-line bank (§3c) — all proposed, none written.
- Directly reusable as-is, no duplication needed: `src/engine/hubGeometry.ts` (ellipse/clamp math), the Shop/Weapon Branch economy (already class-generic and data-driven), and the `data/chatIntent.ts` classifier pattern (rule-based, NPC-agnostic already).

**Roster (both sides of this batch):**
- **Marrow's starting roster** — Marrow herself (proposed Tank path, §4) plus a supporting lance whose names/callsigns/chassis are deliberately not invented in this doc (§4) — needs its own naming pass. The Hub decision makes this more urgent than it was in the missions-only version of this plan, since a Hub needs walkable, nameable NPCs, not just deployable stat blocks.

**Cross-cutting:**
- **Naming-lock check** — same as every other piece of content in this project: run `tools/lint-spoiler.mjs` against all new mission/map/character/room/estate content before it ships. Nothing above was drafted with either reserved term in mind, but the lint check is what actually proves it, not this sentence.

## 8. Proposed batch execution order

Assuming the shape above gets a green light (with whatever adjustments come out of reading it), the actual build — the "one determined batch" — breaks down like this:

1. **Sign-off pass.** Confirm/adjust: campaign title, act titles, Marrow's combat path, the Bramble's name and lineage, the Mission 20 win-condition framing — plus, new this round: the estate room-set naming (§3a), the steward/seneschal's identity (§3b), the save-architecture approach (§3d), and the Hub v1 content-volume target (§3c). Everything downstream depends on these landing first.
2. **Scaffolding.** New mission data files (`campaignHouseAmaranth.ts`, `mapsHouseAmaranth.ts`) and new Hub-side data files (the separate campaign-state module, Marrow + supporting-lance pilot records) together, since the roster feeds both. The new `maps_house_amaranth.py` script skeleton.
3. **Act I content (Missions 1–12).** Maps, waves, mission text, run through `maps_house_amaranth.py` as they're built rather than all at the end — matches how Team One's and the Reckoning's own maps were validated incrementally, not in one final pass.
4. **Act II content (Missions 13–20),** including the Mission 20 convergence map/objective built as its own real entry.
5. **The Bramble.** Stat block, `combat_sim.py` validation, wired to whichever archetype family wins the lineage call.
6. **Act III content (Missions 21–36).**
7. **Hub v1 build.** `HubHouseAmaranth.ts`, the estate room set and its walkable geometry (reusing `hubGeometry.ts`), the roster seated in it, Talk/ambient-line wiring at the v1 volume target from §3c, the Shop/Weapon Branch economy pointed at House Amaranth's roster, the seneschal NPC. Can realistically start once step 2's scaffolding lands — doesn't strictly need to wait for every mission to be built first, if there's bandwidth to run it alongside steps 3–6 rather than strictly after.
8. **Full validation pass** — all 36 maps through `maps_house_amaranth.py` (matching the 72/72-check discipline `maps_amaranth.py` already set), a `combat_sim.py` pass covering the Bramble specifically, `npm run sim` batch runs per mission the same way every Warden mission was tuned, and the Hub's own checks (`tsc`/lint/vitest/build clean, plus a live walkthrough if a real browser/device check is available that session).
9. **Mission-select and Hub entry wiring** — a real "choose your campaign" entry point, now firmly required (not optional, per §3's own resolution) — picking a side should land the player in that side's own Hub, using the save-architecture decision from §3d for real.
10. **Doc updates** — this plan doc's own status line, the Master Index, a new `build_log/house_amaranth/` structure mirroring `build_log/act1`–`act3`, and the Concept doc's §5 (already updated today to reflect the decisions above).

## 9. Open items — need Maxime's call before or during the build batch

**Resolved, 31 Aug 2026 (asked directly in the Claude Code session):**
- **§4 — Marrow's combat path: Tank**, as proposed.
- **§4 — the Bramble's lineage: Splitfang-descended**, confirmed after checking the actual archetype code (see §10) — Gallcyst's stationary-turret shape didn't match the pitch.
- **§4 — Marrow's Mission 28 resolution: backs Halcyon fully**, as proposed.
- **§3c — Hub v1 content-volume target: full parity with Warden's current Hub**, NOT the phased ~180-line proposal — see §3c's own resolved note for the real scope consequence this opens.

**Still open:**
- **§3a — estate room-set naming** (The Greathouse / The Motor Court / The Longhouse / The Cultivar Works / The Reliquary / The War Room / The Terraces) — all proposals, easy to swap.
- **§3b — the steward/seneschal's identity** — name, species, personality all open.
- **§3d — save/progress architecture** — proposed as a fully separate state module per campaign; confirm before it's built, since it's a real UX choice (two independent save slots vs. one combined one).
- **§4 — the supporting cast** (names, callsigns, chassis species for Marrow's lance beyond her) — more urgent now that the Hub needs them to be real, walkable, nameable NPCs, not just stat blocks.
- **Act/campaign titles** ("The Amaranth Bargain" / "Harvest Ground" / "The Bargain Holds" / "The Stalling Season") — all proposals, easy to swap.
- **Mission-by-mission text above** — first-draft pitches, meant to be argued with, not a locked script.

---

## 10. Claude Code's own read, added 31 Aug 2026 — one item resolved with real evidence, not a guess

**The Bramble's lineage: Splitfang, not Gallcyst — checked against the actual archetype data (`src/data/bloom.ts`), not just narrative feel.** Splitfang is built as `movementType: "swarm"`, `intelligence: "pack"`, `moveRange: 5`, `swarmSize: [3, 5]` — fast, mobile, multiplies. Gallcyst is `movementType: "sessile"`, `moveRange: 0`, a fixed acid turret. The Bramble is pitched explicitly as "fast, aggressive, spreading uncontrolled... the literal weed that grows when a garden stops being tended" — that's Splitfang's actual mechanical shape, not Gallcyst's, which reads as a stationary pillbox no matter what name goes on it. Recommend closing this one as Splitfang-descended; a real `combat_sim.py` numeric pass still belongs in step 5 of the build order before the stat block ships, per this doc's own house rule, but the *family* choice doesn't need to wait on that pass — the mechanics already point one way.
