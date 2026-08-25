# THE BLOOM WARS — NPC Reaction Engine v1

*Confirmed design direction, 25 Aug 2026 — zero code, not scheduled. Captures
the formula Maxime is building for how NPCs (pilots first, House Amaranth
actors and eventually the CO later) react to what's happening around them —
the mechanism underneath Favorability (`Bloom_Wars_Antfarm_Carrier_Hub_v1.md`
§13.2) and Stress (§11.4), and the likely engine for the in-mission
talk/fight/ambush choices flagged in `Bloom_Wars_Spitball_Ideas.md`.*

**Scope flag, per the project's own standing rule.** This is a new system,
not a tuning pass on an existing one — a formula for computing how a pilot
reacts to a given moment, not a Favorability-bar increment. Bigger in scope
than Favorability itself, since Favorability (a single number moving up or
down) could plausibly turn out to be one of this engine's *outputs* rather
than a separate thing. Flagging that plainly rather than letting this read as
a subsection of something already sized. Nothing here is built, and nothing
here changes the standing sequencing rule already locked in Spitball Ideas —
hard tactical loop before the social part of the game. This document exists
so the formula doesn't drift or get lost before that gate clears, not to
schedule building it.

**Where it comes from.** Maxime, introducing it: "let me show you something.
v30 is usable for now. its the best character engine I know." Adapted from a
personal character/story-generation reference Maxime maintains outside this
project — not Qiraki canon, not detailed further here, kept out of this doc
on purpose. What follows is the formula itself, translated into something
this project can build against, not the source material it came from.

## 1. The formula

```
(A + B) + (a + b4(c)) = D + E
```

- **A** — the scene's context. A position on a 12-point abstract diagram
  (nine numbered positions plus three more, called the three pillars: Time,
  Volume, Matter — all twelve read as one sequence, the pillars aren't a
  separate add-on) plus whatever else is active in the moment.
- **B** — fixed, not a variable. Always the player's own point of view.
  Confirmed 25 Aug 2026: "POV being from the consumer POV." This formula
  isn't modeling a pilot's true internal state — it's computing what the
  player actually perceives, which is the only thing a game needs to render
  anyway.
- **a** — A, scoped down to one specific pilot rather than the whole scene.
- **b4(c)** — that pilot's archetype, run through its four echoes: love,
  fear, anger, sadness, in that order (confirmed), combined with **c**.
- **c** — the catalyst. What the pilot is visibly doing at the moment
  someone can look at them — confirmed 25 Aug 2026: "c is what the guy is
  going at the moment someone can look at him." Simplified on purpose to a
  single pass through one list (the animal list, below) rather than the
  fuller three-layer version the source material also describes — Maxime's
  own call: "yeah, building it simpler for the game. for now, its
  complicated enough."
- **D** — the output. What actually shows in-game.
- **E** — feedback. How D changes the state that the next pass reads back in
  as A and a.

## 2. The animal list (confirmed)

Nine entries, the most recent recovery from the source material (dated 24
Aug 2026 in that document) — checked directly against the source rather than
assumed, since an earlier, non-matching eight-item version exists in the
same reference:

Wolf (teamwork), Dog (loyalty), Cat (selfishness), Crow (indulgence), Raven
(instruction), Bear (isolation), Fox (trickery), Rabbit (nurturing), Shark
(ambition).

This is the full content of **c** — nine possible read-outs for "what the
pilot is visibly doing right now."

## 3. Deliberate simplifications from the source material

Worth keeping on record, since the source itself is a much bigger, still
actively-changing system, and this project is only taking one piece of it —
so a future pass doesn't accidentally "correct" this back toward the fuller
original:

- **One list, not three.** The source material's best-supported reading
  runs the catalyst through three separate lists, one per phase — instinct,
  thinking, action. This project runs all three phases through the animal
  list alone. A deliberate simplification, confirmed 25 Aug 2026, not an
  oversight.
- **Addition, not division.** The source's own fullest notation attempt
  uses division — an abstract possibility-space narrowing down to the one
  concrete thing that happened. This project uses addition instead — a
  combinable score is more buildable than a narrowing operation, and
  division was never confirmed as anything more than one candidate reading
  in the source itself.
- **B redefined.** In the source material, B is a self-referential formula
  (Archetype's own internal structure). Here, B is fixed as the player's
  point of view — see §1.
- **Volume, defined for this project as personal significance** — how much
  space something takes up in the pilot's own life/priorities. Worth
  flagging: the source material has at least two other live, unreconciled
  readings for this same term (a "footprint of story consequences" reading,
  and a "physical distance" reading) — this project isn't adopting either of
  those, it's picking a third one that reads clearest for a game context.

## 4. Where this plugs in — not yet decided

Genuinely open, not designed here:

- How **D** and **E** concretely translate into a Favorability delta
  (Antfarm Hub §13.2), a Stress change (§11.4), or an in-mission dialogue
  outcome (the talk/fight/ambush idea, Spitball Ideas).
- Whether this runs once per mission, once per meaningful choice, or
  continuously.
- How a pilot's Planet position, pillar weights, and archetype get assigned
  — by hand per named pilot, generated for player-created recruits, or some
  mix of the two. **Cross-ref, 25 Aug 2026 — partially answered for one
  case:** `claude/Bloom_Wars_Character_Editor_v1.md` §2 proposes an answer
  for player-created pilots specifically — the player picks a label off the
  animal list (§2 above) as the pilot's catalyst read, and a small preset
  table (not designed here either) maps that label to a starting Planet
  position / pillar weighting, so the player never has to touch the
  diagram directly. Named, hand-authored pilots are untouched by that
  proposal — this bullet's "by hand per named pilot" half is still exactly
  as open as it was.
- Data schema — none of this exists as a type or a data file yet.

## 4a. A combat-side bridge point (25 Aug 2026 — captured, not designed)

Maxime, unprompted, mid-conversation about the Player AI engine work
(`src/sim/playerAi/`): "personally I wonder how the characterisation formula
handle combat. but thats for later XD" — then, asked to precise it: "any way
to bridge the social and the fighting."

Not designed here — same standing rule as everything else in this doc — but
worth recording the observation before it's lost, because it's a real one:
**c**, the catalyst, is defined as "what the pilot is visibly doing at the
moment someone can look at them," and combat is already producing exactly
that, turn by turn, without anyone building it for this purpose.
`engine/mission.ts` logs a structured outcome for every action already — a
kill, a repair and how much it healed, a downing, a permadeath check's
verdict, an overwatch trigger, a dodge. Separately, `src/sim/playerAi/`'s own
decision reasons (`kill`, `repair_critical_ally`, `retreat_low_hp`,
`hold_cornered`, `regroup_low_hp`, ...) are the test bot's own read of "what
is this pilot doing right now" — which is the identical question **c** asks.
The two vocabularies already line up without forcing it: a Munti healing a
critical ally under fire reads as Rabbit or Dog; landing the kill reads as
Shark; fighting on alone because retreat had nowhere left to go
(`hold_cornered`) reads as Bear, forced into the open.

**The one precision worth keeping on record:** the bridge should NOT be
"read the Player AI engine's own reason codes directly." Those only exist
inside the headless sim bot (`src/sim/playerAi/`) — a human playing a real
mission through `scenes/Battle.ts` never produces a `PlayerAiReason` at all,
since no AI is choosing their actions for them. The reusable part sits one
level down: a classifier that reads catalyst off the **engine's own action
outcomes** (mission.ts's kill/repair/downed/permadeath/overwatch events),
which exist identically whether a human or the sim bot triggered them. Built
that way, whenever this engine's gate actually opens, combat doesn't need to
be touched or re-instrumented to feed it — the raw material is already being
produced every turn, for every unit, human-played or not.

## 5. Status

Design only. Not scheduled. Same standing rule as the rest of the
social/hub layer: nothing here gets built before the hard tactical loop is
proven (`Bloom_Wars_Spitball_Ideas.md`, "the game is Amaranth now" entry).
This document exists to keep the confirmed formula from drifting before that
gate clears, not to schedule it.
