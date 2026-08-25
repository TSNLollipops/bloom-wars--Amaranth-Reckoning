# THE BLOOM WARS — Character Editor v1

**Design pass only — zero code, per Maxime's own explicit call.**

*Written 25 August 2026. Answers a specific three-part ask, via AskUserQuestion: "its to allow player to make their own npc and it must include way for them to react to the karma of the other npc, the karma being the favorability they have with each other. it should also be able to connect to future social system the social part of the game will run on." Sits on top of three docs already in the project rather than inventing new ground — `claude/Bloom_Wars_Spitball_Ideas.md` (the recruit-creation baseline, and the parked "character mod kit + map editor" idea), `claude/Bloom_Wars_Antfarm_Carrier_Hub_v1.md` §13 (Favorability, the walkable hub), and `claude/Bloom_Wars_NPC_Reaction_Engine_v1.md` (the formula this doc's Layer 2 exists to feed). Same standing rule as all three: nothing here gets built before the hard tactical loop is proven.*

## 0. What this is actually answering

Three requirements, not one feature:

1. **A player-facing NPC creator.** The already-scoped recruit-creation ask (Spitball Ideas) plus the newer, bigger version of it from this same conversation: "we will need a set of 50 character's... csnt you just mash up a character's creation screen ith options like in various game so player can mod their units?" Volume matters here as much as the creation screen itself — 50 hand-built characters one at a time isn't really what's being asked for.
2. **A way for created NPCs to react to karma (Favorability) with other NPCs.** Not a new relationship system — Favorability already exists, fully designed, in Antfarm Hub §13.2. The job here is making sure a player-created pilot is a real, first-class participant in it, not a special case bolted on the side.
3. **A connection point to the future social system.** That's the NPC Reaction Engine — the `(A + B) + (a + b4(c)) = D + E` formula — and, further out, the walkable hub (§13.1). The Reaction Engine's own §4 leaves open exactly the question this doc has to answer for player-made pilots: how does a pilot's Planet position, pillar weights, and archetype get assigned? For a named, hand-authored character, presumably by hand. For fifty player-created ones, that's not realistic — this doc proposes an answer.

Everything below is organized as two layers on top of a created pilot, because that's the shape this project already uses everywhere else it's hit this exact problem (Tier 0/Tier 1 in Antfarm §6a and §9, the bare-screen/room-skin split): a mechanical floor that already exists and doesn't need rework, and a new layer on top that makes the pilot legible to systems that don't exist in the engine yet.

## 1. What already exists — don't rebuild this part

Spitball Ideas already resolved the mechanical floor, in the emergency-replacement context, but the scope note there says it plainly: *"Emergency replacements are real, nameable, customizable recruits, not placeholders — matching the character-creation ask directly, at minimum name/portrait/chassis choice at the moment they're assigned."* And: *"'natural balance' already rules out custom stat allocation, so there may not be much more to design there than portrait/name/chassis/class selection."*

That's Layer 1, confirmed already:

- **Chassis / species / class.** The existing `UnitArchetype` / `PilotRecord` split (Data Pack §1.2) already separates "what a Meeps on a centauroid chassis is" from "who this specific person is" — a created pilot picks a path (Meeps/Tank/Reeps/Munti), a chassis, and gets the species that chassis implies (bipedal → human, centauroid → Hiopi, bipedal_vibrissal → Osnius), same matrix every named pilot already uses.
- **Name.** Typed, or rolled — see §5.
- **Portrait.** GDD §12.2's existing placeholder — a coloured circle with two initials — is the art budget this project actually has, and it already scales to arbitrary numbers of pilots for free. No new art decision needed here; created pilots use the same placeholder named pilots use today.
- **Tier.** Starts at G, same as every fresh recruit, per the existing recruit-phase rules (Antfarm §6a) — Combat Medic Cadre (§11.2) is the one existing lever that changes this, and only for Munti.
- **No stat sliders.** "Natural balance" stays locked. A created Reeps has the same base stats as any other Reeps on that chassis. This doc doesn't reopen that.

This is already designed and, per Antfarm's own status notes, partially shipped as engine/data work (`recruitDiscretionary`, the emergency-replacement path). Nothing in this section is new; it's the floor everything below stands on.

## 2. Layer 2 — the part that's actually new: a personality a system can read

Layer 1 makes a pilot exist and fight. It doesn't make them *legible* to Favorability's karma or the Reaction Engine's formula — those need something to read that a chassis/class pick doesn't provide. That gap is what this section designs.

**The proposal:** reuse the animal list. The Reaction Engine's catalyst layer (**c**, §2 of that doc) is already a closed, confirmed set of nine entries — Wolf (teamwork), Dog (loyalty), Cat (selfishness), Crow (indulgence), Raven (instruction), Bear (isolation), Fox (trickery), Rabbit (nurturing), Shark (ambition) — built for reading *what a pilot is doing in the moment*, not for character creation. But it's already exactly the right shape for a trait picker: nine short, flavorful, mutually distinct labels, no math attached, the kind of chunky option list plenty of games use for personality at creation (Darkest Dungeon's quirks, The Sims' traits, Fire Emblem's support archetypes — different mechanics, same instinct: pick a label, not a stat block).

At creation, the player picks one animal as the pilot's **primary read** — their default catalyst, what they gravitate toward under normal circumstances — and optionally a second for pilots meant to read as more complicated (a Fox with a Dog's loyalty underneath, say). This does two things at once: it gives the player a real, game-native creation choice (the "options like in various games" ask), and it gives the Reaction Engine something concrete to consume the moment it's ever wired up, without inventing a second vocabulary alongside the one that already exists.

**What this doesn't do:** expose the actual 12-point diagram (Planet position, the three pillars) to the player, ever. That diagram is Maxime's own personal reference tool, deliberately kept out of this project's docs in detail (Reaction Engine §1: "not detailed further here, kept out of this doc on purpose"). The proposal here is a small preset table instead — each animal label maps to a default position/pillar-weight starting point (Shark leans toward whatever corner of the diagram reads as high-ambition/high-Volume, Bear toward isolation, and so on) that the engine uses internally. The player only ever sees and picks the animal name. This keeps the actual formula's internals out of the player-facing game the same way they're already kept out of this doc.

**Named pilots stay hand-assigned**, same as everything else about them (their stats, their story beats) — this section only answers the question for player-created ones. Still open, same as Reaction Engine §4 already flags: the preset table's actual values, and whether named pilots get animal labels too or something more bespoke.

## 3. Karma / Favorability — a created pilot is just another node

This is the good news: nothing structural needs to change. Favorability (Antfarm §13.2) is already designed as one number per relationship, not a property of any specific named character — "a simple bar like in DAO," farmed the same way for anyone: fielded together on missions, Rec Room minigames (Poker, Fletchers, the peg game), sharing a drink at the ship bar. A created pilot slots into that exactly the way Rourke or Bosk does. No special case, no separate system — the karma the ask refers to already exists and already generalizes.

One real design call this doc needs to make, because it only becomes visible at the scale this doc is actually aiming for:

**Pair-scaling — resolved, 25 Aug 2026.** Favorability is per-*pair*, not per-pilot. A hand-authored cast of ~20 by Act III (Antfarm §10) already implies up to 190 possible pairs if every pair were tracked. A player-built roster of 50 pushes that past 1,200. Pre-populating a full relationship matrix for a roster that size is real memory/data weight for numbers that mostly never matter — most pairs of pilots will never be fielded together. Maxime: "oh yeah, better to make them be generated only when they interact." Locked: **lazy-init.** A pair's Favorability value doesn't exist until the first mission that fields both of them, and starts neutral from there — nothing is pre-populated, nothing is computed for a pair that's never actually shared a mission.

**Default standing for a brand-new pilot** falls out of the same call rather than needing a separate one: neutral/unset toward everyone, including named pilots, until they're actually fielded together. No pilot starts "liked" or "disliked" by construction of being new — there's no value to start them at until lazy-init creates one.

## 4. Roster generation — solving the "50" problem directly

The ask, verbatim: *"i think we will need a set of 50 character's. csnt you just mash up a character's creation screen ith options like in various game so player can mod their units?"* Fifty hand-built pilots, one creation-screen session each, isn't really what's being asked for — the actual ask is volume without proportional effort.

**Proposal:** the editor supports both paths through the same Layer 1 + Layer 2 choices above, not two separate systems:

- **Hand-built.** Walk through chassis/species/class, name, portrait, animal-label pick — same screen either way.
- **Generate.** A single action that rolls all of the above within the existing "natural balance" rules — a legal chassis/species/class combination, a rolled name, a rolled animal label (optionally weighted so the nine labels don't come out perfectly uniform across a roster, if that turns out to matter) — and hands the player a finished pilot they can accept as-is or edit from there. This is the actual answer to "mod their units" at 50-character scale: most of a roster gets generated and lightly reviewed, a handful of pilots the player actually cares about get hand-built.

**Name generation is its own small subordinate task**, not designed here — it needs a name bank or generator, distinct from anything on the Qiraki side of this project per the naming-lock rule (this doc isn't borrowing content, only noting that "generate a name from a bank" is a pattern this project already has reason to build well once, generically, rather than reinventing per-need).

## 5. Where this actually leads — the walkable hub dependency

Worth being honest about what this doc does and doesn't unlock on its own, per the project's standing rule about flagging scope. A created pilot with a name, portrait, animal label, and a live Favorability number is fully useful *today's* way — deployable on missions, tracked in the roster, participating in Favorability through missions and Rec Room, all without any new rendering work. That's Layer 1 + Layer 2 + §3, and none of it needs the walkable hub to matter.

The specific experience Maxime actually described wanting, though — *"i want the hub to me like a city you can move your unit in... visit other characters... mek and synkers and the co"* — needs Antfarm §13.1's walkable hub on top of this, which that section already flags as real, new engineering surface (a second movement/rendering mode, not a reskin of the room-menu model). This doc doesn't design that; it just makes explicit that the character editor is one half of the pipe and the walkable hub is the other. Building this doc's half doesn't commit to building that one — but the full payoff needs both.

## 6. Data format — a prerequisite this doc makes concrete

Spitball Ideas already flagged this in the abstract, for the mod-kit idea generally: *"Current unit/mek/map definitions are TypeScript modules, which need a recompile to change. A real in-game or external editor eventually wants those as data files (JSON or similar) loaded at runtime instead."* This doc is where that stops being abstract. A player creating pilots at runtime — potentially fifty of them, potentially edited repeatedly — cannot be writing to `.ts` source files. `PilotRecord` (Data Pack §2) already has the right shape for this; what's missing is a runtime store (save file, JSON blob, whatever the actual persistence layer ends up being once campaign save/load is designed) separate from the compiled data the named cast currently lives in. Not deciding to build this now — flagging that this doc is the thing that makes the migration non-optional whenever it does get built, since "player-authored NPCs" and "data that requires a recompile to exist" are incompatible on their face.

## 7. What this doc does not decide

- The animal-label preset table's actual Planet-position/pillar-weight values (§2) — proposal only.
- Whether one animal label is enough per pilot, or two is the right ceiling for "complicated" ones (§2).
- Rolled-name weighting, and the name bank itself (§4).
- The walkable hub (§5) — already its own flagged, unscoped system elsewhere; not touched here.
- The canon-vs-custom separation question Spitball Ideas already raised for the mod kit generally — this doc doesn't resolve it, though it's worth noting that anything built through this editor is obviously workshop/custom content by construction, which may do most of that separation's work for free.
- The JSON/runtime-data migration (§6) — flagged as a real prerequisite, not scheduled.

## 8. Build cost, honestly

Design only, per Maxime's own explicit choice this session over starting code. Same sequencing rule as the Reaction Engine and the rest of the hub/social layer: nothing here builds before the hard tactical loop is proven.

If and when this does get greenlit, the cheapest real first slice is Layer 1 (already effectively designed, close to what the emergency-recruit path already does) plus Layer 2's animal-label picker (small — the vocabulary already exists, this is a UI pick and a lookup table, not new mechanics). The two pieces with real engineering weight are the lazy-init Favorability store (§3) and the JSON/runtime-data migration (§6) — both worth a small prototype before committing, rather than discovering the cost mid-build.

## Cross-references

- `claude/Bloom_Wars_Spitball_Ideas.md` — Layer 1's source, and the original "character mod kit + map editor" entry this doc grows out of.
- `claude/Bloom_Wars_Antfarm_Carrier_Hub_v1.md` §13.1–13.4 — Favorability's full mechanics, and the walkable-hub dependency in §5 above.
- `claude/Bloom_Wars_NPC_Reaction_Engine_v1.md` §4 — the open question ("how does a pilot's Planet position, pillar weights, and archetype get assigned") this doc's §2 proposes an answer to, for player-created pilots specifically.
