# The Qiraki Files — Canon Bridge

Mirrored into the Bloom Wars code project on 2026-08-25, so the two projects (the *Enlightened* novel series, working title *The Qiraki Files*, and the *Bloom Wars* game) can draw on the same worldbuilding, systems, and tone instead of drifting apart independently.

## Where this came from, and where it stays current

Canonical source lives in the **"qiraki files. book title: Enlightened"** Claude project. Everything in this folder is a snapshot taken 2026-08-25. **Treat this folder as read reference, not the source of truth** — if a Qiraki writing session locks something new, this mirror goes stale until someone re-syncs it. If you're working on Bloom Wars and need to check whether something here is still current, the writing project is where to look.

The reverse direction matters too: this project already has its own design docs (`Bloom_Wars_Rank_And_Command_v1.md`, `Bloom_Wars_Antfarm_Carrier_Hub_v1.md`, the Independent Campaign doc, the Crew Banter bank, and so on) that the *writing* side hasn't seen. `Qiraki_Military_Rank_Path_v1.md` in this bridge was written the same day as `Bloom_Wars_Rank_And_Command_v1.md` already in your `design/` folder — worth diffing the two directly if the rank ladders need to agree, or worth deliberately keeping them distinct if the game and the novel are meant to depict different eras or factions.

## What's in here

Worldbuilding and systems reference only — no drafted prose (chapters), no outline/planning meta-docs (defect queues, revision logs, process notes). The idea is to hand over the load-bearing *facts* a game needs to stay consistent with the novel's universe, not the novel-writing process itself.

- `Qiraki_Concept.md` — the original raw concept dump: setting, the Bloom/Qiraki cosmology, factions, the energy-credit economy, species roster, the academy system, the endgame.
- `Qiraki_Bible_Skeleton.md` — the organized canon reference: premise, timeline, cast, species, factions, locations, terminology. Start here for a fast orientation.
- `Qiraki_Cosmology_And_Spread_Math.md` — the hard-science grounding for how the Bloom spreads, why it can't actually consume the universe, and the derived "point of no return" math. Directly useful if the game ever needs spread/threat-scaling numbers.
- `Qiraki_Political_Web.md` — the COE's constitutional structure (the Close, the Roll, the three pillars, the five factions mapped onto them). Useful for any faction-reputation or political-consequence systems.
- `Qiraki_Military_Rank_Path_v1.md` — the consolidated rank-and-command ladder (Pilot → Raid Lead → Guildmaster → Legion Commander → Faction Leader), with the Warrant/Hand distinction. Cross-check against your own `Bloom_Wars_Rank_And_Command_v1.md`.
- `Qiraki_Weapons_And_Progression.md` + `Qiraki_Points_Shop_Catalog.md` — the G-through-S tier system, the four combat paths (Meeps/Reeps/Tank/Munti), point-generation formulas, and the full shop catalog with costs. Probably the single most directly reusable doc for game balance/economy.
- `Qiraki_Technobabble_Glossary.md` + `Qiraki_Rune_Tech_Reference.md` + `Rune_Patterning_Primer.md` — the rune-patterning system (peg/trace/knot/circuit/circle grammar, the 21-letter alphabet, the childhood peg-game with a full playable ruleset). The peg-game ruleset in particular is a genuinely standalone playable minigame if Bloom Wars ever wants one.
- `Qiraki_Engineering_Curriculum_Reference.md` + `Qiraki_Combat_Curriculum_Reference.md` — the real-science grounding (simple machines through control theory; motor-learning theory) behind the academy curriculum, useful for any in-game tutorial/training-arc pacing.
- `Qiraki_Bestiary.md` + `Qiraki_Bioterror_Bank.md` — the Bloom's modular creature-generation system (weapons/movement/perception/intelligence/endurance/vitality/swarm-type categories) plus the full descriptive/sensory and color-palette bank. Built to be "rolled" like a game system already.
- `Qiraki_Visual_Reference_Bank.md` + `Qiraki_Physical_Description_Bank.md` — mech class silhouettes by combat path, species baselines and individual-variance rules, ship/vista design language.
- `Qiraki_Character_Sheets.md` — the full named cast (Trav, Reqa, Zeteii, Vrassik, and the rest), useful if the game ever wants cameos, tie-in characters, or just tonally-consistent NPC writing.
- `Qiraki_Preserve_Species.md` — the 26 preserve species roster (mostly one-line entries, deliberately thin).
- `Qiraki_Master_Style_Guide.md` — prose/voice rules for the novel. Less directly applicable to a game, but useful for in-game text (flavor text, propaganda fragments, UI copy) that wants to sound like it belongs to the same universe: no caricatures, real science under every invented system, quiet critique rather than stated theme, gritty/gory/gorgeous in balance.

## A few things worth knowing before using any of this in-game

- **"Qiraki" is spoiler-locked** in the novel — it's the enemy's true name and doesn't appear in drafted prose before the reveal point. That constraint is specific to the book's reveal structure; it's your call whether Bloom Wars (as a separate work) needs to honor it too, but flagging it so it's a deliberate choice either way.
- **The hard content boundary**: no romantic or sexual content involving any character while a minor, full stop — this governs the novel's cast (tracked from early adolescence into adulthood) and is worth carrying over as a floor for any tie-in material using these characters, even though it may not be directly relevant to Bloom Wars' own content.
- Several numeric systems here (the points economy, the G–S tier costs, the spread-math tables) were built for pacing a ~130k-word-per-book prose series, not for real-time game balance. Treat the *shape* of these systems (tiered progression, points-for-gear, exponential-then-frontier-limited threat scaling) as the reusable part, and re-derive actual numbers against Bloom Wars' own pacing rather than importing them verbatim.
