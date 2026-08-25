# THE BLOOM WARS — Walkable Hub & Live Social Layer: Build Plan v1

**Status:** paper only, zero code — same status as `Bloom_Wars_Character_Editor_v1.md` and `Bloom_Wars_Rank_And_Command_v1.md`. First draft 25 August 2026.

**Depends on:** `Bloom_Wars_Antfarm_Carrier_Hub_v1.md` §13 (the walkable-hub scope flag and Favorability), `Bloom_Wars_NPC_Reaction_Engine_v1.md` (the reaction formula this eventually wires into), `Bloom_Wars_Spitball_Ideas.md` (the calendar entry, the "live npc doing life stuff" entry, the Normandy-talk entry), `Bloom_Wars_Character_Editor_v1.md` §5 (which already named this doc's job as "the other half of the pipe"), `Bloom_Wars_Rank_And_Command_v1.md` (hub-access gating), `claude/pilot_creator.html` (the working Favorability/Stress/Morale/Rec-Room sandbox this plan leans on rather than re-designs).

---

## 0. Why now, not scope creep

Two sequencing rules already exist on record, both self-imposed, both now satisfied:

- Spitball Ideas: *"keep it queue. we gonna add the full calandar when we are done with the mission building. because after than I want to work on the ui for non combat interaction."*
- The standing rule repeated across the Reaction Engine, Character Editor, and Antfarm docs: nothing in this bucket gets built before the hard tactical loop is proven.

Mission building is done — 36/36 shipped, sim-tuned, tested. The tactical loop is proven. This plan isn't jumping the queue; it's the queue arriving.

---

## 1. The full pile, sorted against what already exists

Maxime dropped nine ideas across two messages. Sorting them against the project's own record before planning anything, so nothing gets redesigned that's already settled and nothing gets treated as settled that isn't:

| Idea | Status |
| --- | --- |
| Hub isn't a safe space — *"the war exist around them"* | **Decided.** Confirmed direction. Sequencing question only (see §4). |
| Carrier Defense Operation | **New.** Loosely kin to Spitball Ideas' parked "Company-scale battles / Sunrider two-layer" idea, not identical to it. Out of this plan's scope — Phase 4+, own doc later. |
| War-effort calendar | **Already queued**, not new. Spitball Ideas locked it as in-fiction time, explicitly *not* the same axis as the mission's real-world 12-hour recall clock — don't let the two "clocks" get merged in later docs. Two real open questions already on record there (what advances it, what things cost) — carried into §4 below, not re-solved here. |
| A reactive named enemy commander ("the Major") | **New**, but sits directly on Reaction Engine infrastructure that already exists. That doc was written with crew in mind, not a persistent antagonist across 36 missions — extending it that way is real, unscoped work. Out of this plan's scope — Phase 4+. |
| In-mission comms: "says" (proximity) vs. "transmit" (targeted, holoband) | **New, partially absorbed 25 Aug 2026.** The "says" half — broadcast to everyone in range rather than a single target — is now how Phase 1's own Talk verb works (see §3, §5); it's the hub's core interaction, not deferred anywhere. The battlefield in-mission comms system itself (a "says"/"transmit" toggle mid-mission, holoband-gated) is still a separate, unbuilt feature — buildable independently, any time. Out of this plan's scope, noted for continuity. |
| MC can provoke enemies — named **Insult**, 25 Aug 2026 | **New.** Named specifically to avoid colliding with "Taunt," the shipped Meeps aggro ability (`taunt_and_fire_support.md`, live since Mission 8) — the two are unrelated mechanics that happen to both involve provoking an enemy, and sharing a name would make every future doc reference ambiguous. Out of this plan's scope. |
| Enemies can be talked down | **New** — a third combat-resolution path alongside kill/Munti. Needs something like a Favorability-for-hostiles analog that doesn't exist yet. Out of this plan's scope. |
| Live, walkable, real-time hub interaction | **This plan's actual subject.** Antfarm §13.1, Tier 3, flagged unscoped since 23 Aug. |
| Meks join the mech crew | **Wishlist**, per Maxime's own last message. Parked, not in this plan. |
| NPCs learn and evolve from interacting with each other | **Partially already speced.** Spitball Ideas already has *"the social part of the game is gonna be live npc doing life stuff in real time... they gonna worry, form relationship evolve etc"* on record, and `pilot_creator.html`'s "Ensemble" panel already prototypes a whole-roster relationship web with auto-simulated days. This is further along than a from-scratch ask — see §5, Phase 3. |

Also already on record and directly relevant, easy to miss since it's buried in Spitball Ideas rather than the Antfarm doc: Maxime's own fuller picture of what the hub is *for* — *"I want the hub to be the social spot like the Normandy was... talk to the crew, the co once that open up and help alleviate stress, romance other pilot, eat shit because you let someone thst got romance die. get drunk at the rec room."* "Ask him out" isn't a new idea this week — it's Maxime finally reaching the thing he described wanting two days ago.

---

## 2. What this plan actually covers

Phases 1 through 3 below: the walkable hub itself, plus wiring in the systems that are already designed and mostly just need somewhere to live — Favorability, ambient dialogue, Rec Room minigames, the drunk debuff, CO's grotto stress relief, romance. Phase 4 and beyond (hub-goes-hot, Carrier Defense Ops, the Major's reactivity, comms, Insult/talk-down) are named for continuity but not scoped here — each is its own plan once this foundation exists, per the dependency order below.

---

## 3. The flexible core: an Interaction Verb framework

This is the actual answer to "keep it flexible, just in case" — instead of hand-building "Talk," "Ask Out," and "Invite to Rec Room" as three separate one-off features, every hub interaction is the same shape:

- **Actor** — the MC (always, for now).
- **Target** — which NPC, for most verbs. Talk is the one exception: it isn't aimed at a single NPC at all. Speaking is a sound-range broadcast — press the verb once and every NPC currently within earshot reacts on their own, independently, each with their own line. Rec Room Invite, Gift, Ask Out, and Share a Drink stay single-target; Talk's broadcast model only changes how "Target" resolves for that one verb, not the shape of the framework.
- **Verb** — Talk / Rec Room Invite / Gift / Ask Out / Share a Drink / CO Check-in, and later: Insult, Talk Down, Carrier-Defense Briefing — whatever gets added down the line. Maxime confirmed the original three examples — ask him out, ask him to a game, talk about stuff — are just basic cases, not special ones: *"the 3 thing I said are just basic thing."* Good sign the shape above is right, since it doesn't need bespoke handling for any of them.
- **Requirements** — a Favorability threshold, a rank gate (reuses `Bloom_Wars_Rank_And_Command_v1.md`), a room-unlock state (reuses Antfarm §12's rank-gated build system), a romanceable flag (already locked: anything but Hiopi/Carabil, who cap out at "close friend/bromance" instead).
- **Cost** — an Energy cost and/or a calendar-day cost, once the calendar's own open pricing question (§4) is answered.
- **Outcome** — a Favorability delta, a Stress/Morale delta, a line pulled from the ambient pool or `LINE_BANK`, any flags it sets.
- **Log entry** — feeds the social-history record Maxime already asked for in the Antfarm doc: *"add a history of socialisation to a character, its record like in Primal Hunter... it's the record and the record take in everything."*

New verbs slot into this shape without touching the ones that already work. That's what makes "ask him out, ask him to game, or other thing, talk about stuff, etc." buildable as one system instead of four.

---

## 4. Decisions — locked 25 Aug 2026

Maxime, handing the remaining calls over: *"your call. your the pro here."* Locking them rather than leaving them open, with reasoning attached so the "why" survives alongside the "what":

- **Phase 1 stays mechanically safe, with one cheap foreshadow.** The hub-isn't-safe direction itself was already decided — this was purely a sequencing call. No live threat, no Carrier Defense trigger, no timer in Phase 1: proving real-time movement plus walk-up interaction is enough of a first build without also debugging a danger system on day one. But shipping it with *zero* signal, when Phase 4 is explicitly going to make it dangerous, would read as a rug-pull later. Locked instead: one near-free addition — a status readout or a line of NPC dialogue acknowledging the war is close (a threat-level indicator that's cosmetic/inert in Phase 1, or similar). Costs a UI label and a sentence of flavor text; sets up Phase 4 honestly instead of as a surprise.
- **Calendar cost model: itemized, not a flat tax — the shape is locked, the numbers aren't.** Different verbs cost different amounts: a quick Talk should sit close to free (so the ambient-interaction loop actually gets used), a Rec Room session costs more, a Berths romance scene costs the most. Matches the direction Spitball Ideas was already leaning ("a Rec Room night costs less than a Berths romance scene"). Exact day-costs are deliberately not invented here — per this project's own rule, a number counts once it's run through tuning, not because it sounded reasonable in a planning doc.
- **What advances the calendar: a flat per-mission cost, not real-world play speed.** The calendar exists, per Spitball Ideas, so players can compare how efficiently they ran the war — that comparison only holds if it tracks choices, not typing speed or how long a session ran. Real-world elapsed time stays entirely out of it; only verb costs and mission completion move the number.
- **Phase 1 footprint: locked as proposed.** One room — Rec Room, since it already has the most designed content (three minigames with real rules, the drink mechanic, the drunk debuff). 2-3 NPCs. Talk only. Rec Room Invite, Gift, Share a Drink, Ask Out, and CO Check-in all wait for Phase 2's verb framework.
- ~~Naming for MC's provoke-verb~~ — resolved, see §1: **Insult**.
- **Movement tech, noted rather than decided — this one has no real choice to make yet, just an explanation.** The tactical battle grid moves units turn-by-turn on a fixed tile map. The hub needs continuous, real-time movement instead — closer to how an old top-down RPG moves a character than how the battle grid does. The tween-based movement animation already built for the battle grid (`walking_animation.md`) is reusable for the *look* of walking; the input handling, room collision, and "you're now close enough to interact" detection are genuinely new and don't exist yet.
- **Talk verb interaction model: sound-range broadcast, not single-NPC click — locked 25 Aug 2026.** Maxime: *"can we model sound range and patch it in for speech? instead of clicking a single guy. everyone in range hear it."* Press the verb once, everyone currently within a fixed radius reacts independently — folds the "says" proximity-comms idea from §1 directly into Phase 1's core interaction rather than leaving it deferred (see the updated §1 row). See §3 for how this fits the verb framework's shape.
- **Full-Antfarm walkability: confirmed as the target, staged rather than pulled into Phase 1 — locked 25 Aug 2026 (Maxime handed the call back: "your call").** Maxime: *"the sntfarm should be walkable. allowing greater surface area for npc to roam and form cliques."* This matches Antfarm §13.1's original ask almost exactly — visiting the CO, mek techs, and pilots across the whole ship was never a one-room idea; Phase 1 just started small on purpose. Locked: Phase 1's footprint stays exactly as already decided above (Rec Room only, 2-3 NPCs, still pending Maxime's own hands-on movement test) — the walk/collide/interact tech itself is still unproven, and one room is the cheapest place to find out if it's wrong. Phase 2 is where the map grows from one room to the full Antfarm (Hangar Deck, Workshop, Vault, Berths, CIC, the grotto) — same tech, more map content and room-to-room transitions, not new engineering.
- **NPCs roaming and forming cliques on their own is new work — it sharpens Phase 3, doesn't sit in Phase 1 or 2. Locked alongside the above.** "Roam and form cliques" asks for more than a bigger walkable map: NPCs moving through the space on their own and clustering by relationship, which nothing in this project has designed yet. The closest existing system is `pilot_creator.html`'s Ensemble panel (already Phase 3's spec, per §5) — but that simulates Favorability/Stress/Morale drift over abstract in-fiction days, not physical movement or visible grouping. This request adds a spatial layer on top of that engine rather than replacing it: the relationship math stays as designed, Phase 3 gains basic NPC pathing/AI so pilots can walk to a room, idle near their closest bonds, and drift from a toxic pair — real new engineering, not a data problem. Recording it now so Phase 3 gets scoped with this in mind from the start; not designed further here.

**Hub NPC permadeath: closest-bond substitution — locked 25 Aug 2026.** Maxime: *"as for the scripted death. maybe replace those with picking the closest npc to you karma wise."* Resolves the flag this section used to carry: when a hub NPC in a role (a Rec Room seat, an ambient Talk line, a walk-up slot) dies mid-campaign, the slot doesn't go empty and nobody hardcodes who fills it — whichever living pilot has the highest Favorability with Rourke gets substituted into that role dynamically. Not new work: this is `findClosestBond()`, already built and tested in `pilot_creator.html`, just always pivoted off Rourke specifically instead of off the pilot who died. (Reading "closest to you" as closest to Rourke, not closest to whoever died — flag it if that's not what you meant.)

**The Vault nuance — also locked 25 Aug 2026.** The Vault's Mission 12 dedication is explicitly the one *load-bearing* beat in this whole system (Antfarm §4/§8 — "the only place that reading actually gets delivered"), and a purely mechanical substitution risked that scene reading generic when it's supposed to land hard. Locked: the substitution rule is the *selector* everywhere, Vault included, but that specific scene stays a hand-authored template with named slots (who died, who's stepping up, what they meant to Rourke) rather than fully procedural text — whoever gets picked still gets a scene that reads like it was written for them. Ambient hub presence (Rec Room, walk-up lines) stays fully procedural since none of that is a one-time authored beat.

**De-risking note.** Before touching the real repo, both the continuous real-time movement and the sound-range broadcast Talk verb were proven out in an isolated, throwaway canvas spike (plain HTML/JS, not Phaser) — same verify-before-you-commit discipline as `combat_sim.py`/`maps.py` and the `pilot_creator.html` sandbox. Two real bugs were found and fixed in the spike itself: an NPC click-hit-test that didn't account for their idle bob animation, and (during the broadcast rework) a case that looked like reactions weren't firing at all — root-caused to this session's own remote-testing tooling having enough screenshot latency to outrace the reactions' short auto-fade window, not a bug in the interaction logic. Confirmed working correctly once verified with an extended-duration test. Movement feel itself still needs Maxime's own hands-on check with a real held key — that can't be verified remotely. Tasks #3-5 (scaffolding the real Hub scene in Phaser) hold until that feedback comes back.

---

## 5. Phased build order

**Phase 1 — minimum walkable hub.** One room, 2-3 NPCs, real-time movement, walk-up-to-interact. Talk is a sound-range broadcast, not a single-NPC click target — speak once (E, or click anywhere) and everyone currently within earshot reacts, each pulling their own line from a small rotating ambient-line pool keyed to their current state (recent mission, Stress, wounded, grieving) — this exact shape is already proposed in Spitball Ideas, not invented here.

**Found while adding to this doc, 25 Aug 2026 — Phase 1's ambient-line selection doesn't need to be authored, it's already built.** `pilot_creator.html`'s "Ambient" button (`logIdleLine`/`pickSoloEchoForPilot`) already does exactly what Phase 1's Talk verb needs: reads a pilot's current state — drunk, Stress ≥ 70 (panicking), Morale at/below the panic threshold, grief-worn (too many lost Muntis), or none of those (idle) — picks an echo (love/fear/anger/sadness) off that read, and pulls a line from the live `LINE_BANK` (324 lines, catalyst × echo × stage). It even has a ~35% gossip variant that names a bonded or rival pilot instead of the plain solo line, when one exists. This is solo/state-only, not the full relational Reaction Engine (that's still genuinely Phase 3's new work, per below) — but it's more than "static," and it's already tested against real content. Phase 1 should port this selection logic and `LINE_BANK` directly rather than re-authoring placeholder lines the way the movement/interaction spike did (that spike's Bosk/Anand lines are throwaway test content only, never meant to ship).

Favorability visible on approach. No calendar cost yet.

**Phase 2 — the verb framework, for real.** Rec Room Invite (the three minigames already have real rules — Poker, Fletchers, the peg game), Share a Drink (drunk debuff already locked at −20% hit chance for a few turns), CO's grotto as a Stress-relief conversation once rank-gated access opens. Calendar turns on — interactions start costing real in-fiction time, per whatever gets decided in §4. Also where the hub's map grows from Phase 1's single room to the full Antfarm — Hangar Deck, Workshop, Vault, Berths, CIC, the grotto — per §4's 25 Aug addendum; same walk/interact tech as Phase 1, more rooms and transitions.

**Phase 3 — the engine goes live, and this is where "NPCs evolve" actually happens.** The Reaction Engine replaces static ambient lines with contextual reactions. Ask Out and romance come online using the already-locked romanceable rules. NPC-to-NPC visible interaction — the piece that makes relationships read as evolving rather than static — is where `pilot_creator.html`'s "Ensemble" panel stops being a design sandbox and starts being the actual spec: it already runs a whole-roster relationship web with auto-simulated days, real Favorability/Stress/Morale numbers, and outcome-aware flavor text. Porting that logic into the live hub is most of this phase's real work, not fresh design. Per §4's 25 Aug addendum, this phase now also covers the spatial half of that — NPCs pathing around the hub on their own and visibly clustering near close bonds, not just the relationship numbers updating in the background.

**Phase 4 and later — named, not scoped.** Hub-goes-hot, Carrier Defense Operations, the Major's campaign-long reactivity, in-mission comms (says/transmit), MC Insult/talk-down. Each gets its own plan doc once Phase 1-3 exist to build on.

**Captured for that future doc, not scoped now — Carrier Defense Ops scales with promotion.** Maxime: *"carrier defence incrase in scope as thr mc get promoted. small srea to defend. vs larger one with harder enemy."* Small area, lower threat early; a larger area and harder enemies later. `Bloom_Wars_Rank_And_Command_v1.md`'s command ladder already gives this a real gate to hang off rather than an invented one — Rourke's locked promotion beats (Capt. at Mission 12, Maj. at Mission 24) are already the moments the campaign marks as "she now commands more." Worth building Carrier Defense Ops as a hub-triggered variant of the `protect_asset` objective type that already exists and is already tuned twice over (Mission 22, Mission 32 — see `engine_systems/ability_depth_and_targeting_ai.md` for the defendZone fallback fix both missions surfaced), rather than a new combat-resolution system from scratch: same underlying mechanic, bigger map and harder waves at Company Commander rank than at Lance Lead. Not designed further here — just recorded so it isn't lost before Phase 4 has a real doc.

---

## 6. What this doesn't change

- **`HubScene`'s existing fire-once system** (Antfarm §7) — untouched, keeps doing its job for scripted, mandatory story beats. The walkable hub is a second, parallel interaction mode for optional, repeatable player-initiated contact, not a replacement.
- **Every shipped Favorability/Stress/Morale number and rule** — this plan wires them into a new space, it doesn't re-derive them.
- **Rourke's permadeath rule, the tactical grid, the mission clock** — none of this touches combat or the campaign structure.

## 7. Where this plugs into the rest of the project

`Bloom_Wars_Character_Editor_v1.md` already named this doc as the other half of its own pipe — a player-created pilot with Favorability wired in still needs this to have somewhere to be walked up to. `Bloom_Wars_Rank_And_Command_v1.md` supplies the titles and gating this doc leans on for room/verb access. Once Phase 1 actually starts getting built, this doc is the one to update — not the Antfarm doc, which stays the room/economy source of truth, and not the Master Index, which tracks shipped state rather than paper plans (same treatment as the Character Editor and Rank/Command docs).
